package com.sjzm.product.modules.categorytree.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.mapper.CategoryTreeNodeMapper;
import com.sjzm.product.modules.categorytree.entity.CategoryTreeNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 新品榜类目树服务。
 * 从 competitor_products（source=新品榜）按 node_label_path 构建完整层级树，物化到 category_tree_node。
 * 计数口径：每个节点 productCount = 该节点子树下去重 ASIN 数（父节点 = 子孙 ASIN 并集，不虚高）。
 * 见 java-backend/sql/create_category_tree_node.sql
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryTreeService {

    /** 新品榜数据来源标记（与 competitor_products.source 一致） */
    static final String SOURCE_RANKING = "新品榜";
    /** 单次刷新的插入分批大小 */
    static final int INSERT_BATCH = 500;

    private final CategoryTreeNodeMapper mapper;

    // ── 内存建树用节点 ──
    private static class BuildNode {
        String label;
        String nodeId;
        String bsrId;
        final Map<String, BuildNode> children = new LinkedHashMap<>();
        final Set<String> asins = new HashSet<>();   // 直接挂在此路径末端的 asin

        BuildNode(String label) {
            this.label = label;
        }
    }

    /**
     * 刷新指定站点的类目树（先删后建）。返回写入的节点数。
     */
    @Transactional(rollbackFor = Exception.class)
    public int refresh(String marketplace) {
        String mkt = normalize(marketplace);
        List<Map<String, Object>> rows = mapper.selectRankingRows(mkt, SOURCE_RANKING);
        if (rows.isEmpty()) {
            log.warn("类目树刷新: {} 无新品榜数据，跳过", mkt);
            return 0;
        }

        BuildNode root = new BuildNode("__ROOT__");
        for (Map<String, Object> row : rows) {
            String asin = str(row.get("asin"));
            String labelPath = str(row.get("nodeLabelPath"));
            String idPath = str(row.get("nodeIdPath"));
            String bsrId = str(row.get("bsrId"));
            if (labelPath == null || labelPath.isBlank()) continue;

            String[] labels = splitPath(labelPath);
            String[] ids = idPath == null ? new String[0] : idPath.split(":");
            if (labels.length == 0) continue;

            BuildNode node = root;
            for (int i = 0; i < labels.length; i++) {
                String lab = labels[i];
                node = node.children.computeIfAbsent(lab, BuildNode::new);
                if (node.nodeId == null && i < ids.length && !ids[i].isBlank()) {
                    node.nodeId = ids[i].trim();
                }
                if (i == 0 && node.bsrId == null && bsrId != null && !bsrId.isBlank()) {
                    node.bsrId = bsrId;
                }
            }
            if (asin != null && !asin.isBlank()) {
                node.asins.add(asin);   // 只挂在最深已知节点
            }
        }

        String batchDate = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        List<CategoryTreeNode> flat = new ArrayList<>();
        for (BuildNode top : root.children.values()) {
            flatten(top, 1, null, mkt, batchDate, flat);
        }

        // 先删旧数据，再分批写入
        mapper.delete(new LambdaQueryWrapper<CategoryTreeNode>()
                .eq(CategoryTreeNode::getMarketplace, mkt));
        for (int i = 0; i < flat.size(); i += INSERT_BATCH) {
            for (CategoryTreeNode n : flat.subList(i, Math.min(i + INSERT_BATCH, flat.size()))) {
                mapper.insert(n);
            }
        }
        log.info("类目树刷新: {} 完成，源行 {}，节点 {}，批次 {}", mkt, rows.size(), flat.size(), batchDate);
        return flat.size();
    }

    /** 刷新所有有新品榜数据的站点。返回 { marketplace -> 节点数 }。 */
    public Map<String, Integer> refreshAll() {
        Map<String, Integer> result = new LinkedHashMap<>();
        for (String mkt : mapper.selectMarketplacesWithRanking(SOURCE_RANKING)) {
            result.put(mkt, refresh(mkt));
        }
        return result;
    }

    /**
     * 收集子树去重 ASIN，同时把 flat 行填好（product_count 用并集大小）。
     * 返回本节点子树的去重 ASIN 集合，供父节点合并。
     */
    private Set<String> flatten(BuildNode node, int level, String parentPath,
                                String marketplace, String batchDate,
                                List<CategoryTreeNode> out) {
        String labelPath = parentPath == null ? node.label : parentPath + ":" + node.label;

        Set<String> subtree = new HashSet<>(node.asins);
        List<CategoryTreeNode> childRows = new ArrayList<>();
        for (BuildNode c : node.children.values()) {
            // 先递归子节点（其行已加入 out），再合并 asin
            int before = out.size();
            Set<String> childAsins = flatten(c, level + 1, labelPath, marketplace, batchDate, out);
            subtree.addAll(childAsins);
            childRows.addAll(out.subList(before, out.size()));
        }

        CategoryTreeNode row = new CategoryTreeNode();
        row.setMarketplace(marketplace);
        row.setLevel(level);
        row.setLabel(node.label);
        row.setLabelPath(labelPath);
        row.setParentLabelPath(parentPath);
        row.setNodeId(node.nodeId);
        row.setBsrId(level == 1 ? node.bsrId : null);
        row.setProductCount(subtree.size());
        row.setDirectCount(node.asins.size());
        row.setBatchDate(batchDate);
        out.add(row);
        return subtree;
    }

    /**
     * 查询整棵树（嵌套结构），按 productCount 降序。marketplace 必填。
     */
    public Map<String, Object> getTree(String marketplace) {
        String mkt = normalize(marketplace);
        List<CategoryTreeNode> nodes = mapper.selectList(new LambdaQueryWrapper<CategoryTreeNode>()
                .eq(CategoryTreeNode::getMarketplace, mkt)
                .orderByAsc(CategoryTreeNode::getLevel));

        // labelPath -> 组装节点
        Map<String, Map<String, Object>> byPath = new HashMap<>();
        List<Map<String, Object>> tops = new ArrayList<>();
        for (CategoryTreeNode n : nodes) {
            Map<String, Object> dto = toDto(n);
            byPath.put(n.getLabelPath(), dto);
        }
        for (CategoryTreeNode n : nodes) {
            Map<String, Object> dto = byPath.get(n.getLabelPath());
            if (n.getParentLabelPath() == null) {
                tops.add(dto);
            } else {
                Map<String, Object> parent = byPath.get(n.getParentLabelPath());
                if (parent != null) {
                    childrenOf(parent).add(dto);
                } else {
                    tops.add(dto);   // 父缺失时挂到顶层，避免丢节点
                }
            }
        }
        sortByCount(tops);

        Map<String, Object> tree = new LinkedHashMap<>();
        tree.put("marketplace", mkt);
        tree.put("source", SOURCE_RANKING);
        tree.put("topCategories", tops.size());
        tree.put("totalProducts", tops.stream()
                .mapToInt(t -> ((Number) t.get("productCount")).intValue()).sum());
        tree.put("batchDate", nodes.isEmpty() ? null : nodes.get(0).getBatchDate());
        tree.put("children", tops);
        return tree;
    }

    /** 只取某站点顶层大类（懒加载/概览用） */
    public List<Map<String, Object>> getTopCategories(String marketplace) {
        String mkt = normalize(marketplace);
        List<CategoryTreeNode> nodes = mapper.selectList(new LambdaQueryWrapper<CategoryTreeNode>()
                .eq(CategoryTreeNode::getMarketplace, mkt)
                .eq(CategoryTreeNode::getLevel, 1)
                .orderByDesc(CategoryTreeNode::getProductCount));
        List<Map<String, Object>> list = new ArrayList<>();
        for (CategoryTreeNode n : nodes) list.add(toDto(n));
        return list;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> childrenOf(Map<String, Object> node) {
        return (List<Map<String, Object>>) node.computeIfAbsent("children", k -> new ArrayList<>());
    }

    @SuppressWarnings("unchecked")
    private void sortByCount(List<Map<String, Object>> list) {
        list.sort((a, b) -> Integer.compare(
                ((Number) b.get("productCount")).intValue(),
                ((Number) a.get("productCount")).intValue()));
        for (Map<String, Object> n : list) {
            Object ch = n.get("children");
            if (ch instanceof List) sortByCount((List<Map<String, Object>>) ch);
        }
    }

    private Map<String, Object> toDto(CategoryTreeNode n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", n.getLabel());
        m.put("nodeId", n.getNodeId());
        m.put("level", n.getLevel());
        m.put("productCount", n.getProductCount());
        m.put("directCount", n.getDirectCount());
        if (n.getLevel() != null && n.getLevel() == 1 && n.getBsrId() != null) {
            m.put("bsrId", n.getBsrId());
        }
        return m;
    }

    private String[] splitPath(String path) {
        String[] raw = path.split(":");
        List<String> parts = new ArrayList<>();
        for (String p : raw) {
            String t = p.trim();
            if (!t.isEmpty()) parts.add(t);
        }
        return parts.toArray(new String[0]);
    }

    private String normalize(String marketplace) {
        return marketplace == null ? "UK" : marketplace.trim().toUpperCase();
    }

    private String str(Object o) {
        return o == null ? null : o.toString();
    }
}
