package com.sjzm.service.impl;

import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.service.ProductRecycleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 产品回收站服务实现
 * <p>
 * 对齐 Python product_recycle_service.py：
 * 1. 支持多条件筛选（sku, name, type, category）
 * 2. 永久删除时清理 product_bundles 关联表
 * 3. 清除 Redis 缓存
 * 4. 更详细的统计信息
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductRecycleServiceImpl implements ProductRecycleService {

    private final JdbcTemplate jdbcTemplate;
    private final StringRedisTemplate redisTemplate;

    private static final String CACHE_KEY_PREFIX = "product:";
    private static final int DEFAULT_EXPIRE_DAYS = 30;

    // ==================== 分页查询回收站产品 ====================

    @Override
    public PageResult<Map<String, Object>> listRecycleProducts(int page, int size, String keyword) {
        return listRecycleProducts(page, size, keyword, null, null, null, null);
    }

    public PageResult<Map<String, Object>> listRecycleProducts(int page, int size, String keyword,
                                                                 String sku, String name,
                                                                 String type, String category) {
        log.info("查询回收站产品列表: page={}, size={}, keyword={}, sku={}, name={}, type={}, category={}",
                page, size, keyword, sku, name, type, category);

        if (page < 1) page = 1;
        if (size < 1) size = 10;
        if (size > 100) size = 100;

        StringBuilder countSql = new StringBuilder("SELECT COUNT(*) FROM products WHERE deleted = 1");
        StringBuilder querySql = new StringBuilder(
                "SELECT id, sku, name, description, category, tags, price, stock, status, type, " +
                "image, developer, local_path, thumb_path, included_items, " +
                "created_at, updated_at, delete_time " +
                "FROM products WHERE deleted = 1");

        List<Object> params = new ArrayList<>();

        if (StringUtils.hasText(keyword)) {
            String safeKeyword = "%" + keyword.trim().replace("'", "''") + "%";
            String keywordCondition = " AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)";
            countSql.append(keywordCondition);
            querySql.append(keywordCondition);
            params.add(safeKeyword);
            params.add(safeKeyword);
            params.add(safeKeyword);
        }

        if (StringUtils.hasText(sku)) {
            String safeSku = "%" + sku.trim().replace("'", "''") + "%";
            countSql.append(" AND sku LIKE ?");
            querySql.append(" AND sku LIKE ?");
            params.add(safeSku);
        }

        if (StringUtils.hasText(name)) {
            String safeName = "%" + name.trim().replace("'", "''") + "%";
            countSql.append(" AND name LIKE ?");
            querySql.append(" AND name LIKE ?");
            params.add(safeName);
        }

        if (StringUtils.hasText(type)) {
            countSql.append(" AND type = ?");
            querySql.append(" AND type = ?");
            params.add(type);
        }

        if (StringUtils.hasText(category)) {
            String safeCategory = "%" + category.trim().replace("'", "''") + "%";
            countSql.append(" AND category LIKE ?");
            querySql.append(" AND category LIKE ?");
            params.add(safeCategory);
        }

        querySql.append(" ORDER BY delete_time DESC");

        Long total = jdbcTemplate.queryForObject(countSql.toString(), Long.class, params.toArray());
        if (total == null || total == 0) {
            return PageResult.empty((long) page, (long) size);
        }

        long offset = (page - 1) * size;
        querySql.append(" LIMIT ").append(size).append(" OFFSET ").append(offset);

        List<Map<String, Object>> list = jdbcTemplate.queryForList(querySql.toString(), params.toArray());

        List<Map<String, Object>> resultList = convertToResultList(list);

        return PageResult.of(resultList, total, (long) page, (long) size);
    }

    // ==================== 获取回收站统计 ====================

    @Override
    public Map<String, Object> getRecycleStats() {
        log.info("获取回收站统计");

        Map<String, Object> stats = new HashMap<>();

        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM products WHERE deleted = 1", Long.class);
        stats.put("total", total != null ? total : 0);

        Long expired = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM products WHERE deleted = 1 AND delete_time < DATE_SUB(NOW(), INTERVAL 30 DAY)",
                Long.class);
        stats.put("expired", expired != null ? expired : 0);

        Long todayDeleted = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM products WHERE deleted = 1 AND DATE(delete_time) = CURDATE()",
                Long.class);
        stats.put("todayDeleted", todayDeleted != null ? todayDeleted : 0);

        Long weekDeleted = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM products WHERE deleted = 1 AND YEARWEEK(delete_time) = YEARWEEK(CURDATE())",
                Long.class);
        stats.put("weekDeleted", weekDeleted != null ? weekDeleted : 0);

        String recentDelete = jdbcTemplate.queryForObject(
                "SELECT MAX(delete_time) FROM products WHERE deleted = 1",
                String.class);
        stats.put("recentDelete", recentDelete);

        return stats;
    }

    // ==================== 恢复产品 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void restoreProduct(String sku) {
        log.info("恢复产品: sku={}", sku);

        if (!StringUtils.hasText(sku)) {
            throw new BusinessException("SKU不能为空");
        }

        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM products WHERE sku = ? AND deleted = 1", Long.class, sku);
        if (count == null || count == 0) {
            throw new BusinessException("回收站中未找到该产品: " + sku);
        }

        int updated = jdbcTemplate.update(
                "UPDATE products SET deleted = 0, delete_time = NULL, updated_at = NOW() WHERE sku = ? AND deleted = 1",
                sku);

        if (updated == 0) {
            throw new BusinessException("恢复产品失败: " + sku);
        }

        clearProductCache(sku);

        log.info("产品恢复成功: sku={}", sku);
    }

    // ==================== 批量恢复产品 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchRestoreProducts(List<String> skus) {
        log.info("批量恢复产品: skus={}", skus);

        Map<String, Object> result = new HashMap<>();
        if (CollectionUtils.isEmpty(skus)) {
            throw new BusinessException("SKU列表不能为空");
        }

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        String placeholders = skus.stream().map(s -> "?").collect(Collectors.joining(","));
        String checkSql = String.format("SELECT sku FROM products WHERE sku IN (%s) AND deleted = 1", placeholders);

        List<Map<String, Object>> existingProducts = jdbcTemplate.queryForList(checkSql, skus.toArray());
        List<String> validSkus = existingProducts.stream()
                .map(p -> (String) p.get("sku"))
                .collect(Collectors.toList());

        if (validSkus.isEmpty()) {
            throw new BusinessException("没有找到有效的回收站产品SKU");
        }

        String updatePlaceholders = validSkus.stream().map(s -> "?").collect(Collectors.joining(","));
        String updateSql = String.format(
                "UPDATE products SET deleted = 0, delete_time = NULL, updated_at = NOW() WHERE sku IN (%s)",
                updatePlaceholders);

        int updated = jdbcTemplate.update(updateSql, validSkus.toArray());
        success = updated;
        failed = skus.size() - success;

        for (String sku : validSkus) {
            clearProductCache(sku);
        }

        for (String sku : skus) {
            if (!validSkus.contains(sku)) {
                errors.add(sku + ": 不在回收站中");
            }
        }

        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);

        log.info("批量恢复产品完成: 成功={}, 失败={}", success, failed);
        return result;
    }

    // ==================== 永久删除产品 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void permanentlyDeleteProduct(String sku) {
        log.info("永久删除产品: sku={}", sku);

        if (!StringUtils.hasText(sku)) {
            throw new BusinessException("SKU不能为空");
        }

        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM products WHERE sku = ? AND deleted = 1", Long.class, sku);
        if (count == null || count == 0) {
            throw new BusinessException("回收站中未找到该产品: " + sku);
        }

        try {
            int bundlesDeleted = jdbcTemplate.update(
                    "DELETE FROM product_bundles WHERE parent_sku = ?", sku);
            log.debug("删除产品关联的bundles记录: sku={}, count={}", sku, bundlesDeleted);
        } catch (Exception e) {
            log.warn("删除product_bundles关联记录失败，可能是表不存在: sku={}", sku);
        }

        int deleted = jdbcTemplate.update(
                "DELETE FROM products WHERE sku = ? AND deleted = 1", sku);

        if (deleted == 0) {
            throw new BusinessException("永久删除产品失败: " + sku);
        }

        clearProductCache(sku);

        log.info("产品永久删除成功: sku={}", sku);
    }

    // ==================== 批量永久删除产品 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchPermanentlyDeleteProducts(List<String> skus) {
        log.info("批量永久删除产品: skus={}", skus);

        Map<String, Object> result = new HashMap<>();
        if (CollectionUtils.isEmpty(skus)) {
            throw new BusinessException("SKU列表不能为空");
        }

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        String placeholders = skus.stream().map(s -> "?").collect(Collectors.joining(","));
        String checkSql = String.format("SELECT sku FROM products WHERE sku IN (%s) AND deleted = 1", placeholders);

        List<Map<String, Object>> existingProducts = jdbcTemplate.queryForList(checkSql, skus.toArray());
        List<String> validSkus = existingProducts.stream()
                .map(p -> (String) p.get("sku"))
                .collect(Collectors.toList());

        if (validSkus.isEmpty()) {
            throw new BusinessException("没有找到有效的回收站产品SKU");
        }

        try {
            String bundlesPlaceholders = validSkus.stream().map(s -> "?").collect(Collectors.joining(","));
            int bundlesDeleted = jdbcTemplate.update(
                    String.format("DELETE FROM product_bundles WHERE parent_sku IN (%s)", bundlesPlaceholders),
                    validSkus.toArray());
            log.debug("批量删除产品关联的bundles记录: count={}", bundlesDeleted);
        } catch (Exception e) {
            log.warn("批量删除product_bundles关联记录失败，可能是表不存在");
        }

        String deletePlaceholders = validSkus.stream().map(s -> "?").collect(Collectors.joining(","));
        String deleteSql = String.format(
                "DELETE FROM products WHERE sku IN (%s) AND deleted = 1",
                deletePlaceholders);

        int deleted = jdbcTemplate.update(deleteSql, validSkus.toArray());
        success = deleted;
        failed = skus.size() - success;

        for (String sku : validSkus) {
            clearProductCache(sku);
        }

        for (String sku : skus) {
            if (!validSkus.contains(sku)) {
                errors.add(sku + ": 不在回收站中");
            }
        }

        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);

        log.info("批量永久删除产品完成: 成功={}, 失败={}", success, failed);
        return result;
    }

    // ==================== 清理过期产品 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> clearExpiredProducts() {
        return clearExpiredProducts(DEFAULT_EXPIRE_DAYS);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> clearExpiredProducts(int days) {
        log.info("清理过期产品（删除时间超过{}天）", days);

        Map<String, Object> result = new HashMap<>();

        String countSql = "SELECT sku FROM products WHERE deleted = 1 AND delete_time < DATE_SUB(NOW(), INTERVAL ? DAY)";
        List<Map<String, Object>> expiredProducts = jdbcTemplate.queryForList(countSql, days);

        if (expiredProducts.isEmpty()) {
            result.put("deleted", 0);
            result.put("expected", 0);
            log.info("没有过期的产品需要清理");
            return result;
        }

        List<String> expiredSkus = expiredProducts.stream()
                .map(p -> (String) p.get("sku"))
                .collect(Collectors.toList());

        Map<String, Object> deleteResult = batchPermanentlyDeleteProducts(expiredSkus);

        result.put("deleted", deleteResult.get("success"));
        result.put("expected", expiredSkus.size());
        result.put("failed", deleteResult.get("failed"));

        log.info("清理过期产品完成: 预期清理={}, 实际清理={}", expiredSkus.size(), deleteResult.get("success"));
        return result;
    }

    // ==================== 辅助方法 ====================

    private List<Map<String, Object>> convertToResultList(List<Map<String, Object>> list) {
        List<Map<String, Object>> resultList = new ArrayList<>();
        for (Map<String, Object> row : list) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", row.get("id"));
            item.put("sku", row.get("sku"));
            item.put("name", row.get("name"));
            item.put("description", row.get("description"));
            item.put("category", row.get("category"));
            item.put("tags", row.get("tags"));
            item.put("price", row.get("price"));
            item.put("stock", row.get("stock"));
            item.put("status", row.get("status"));
            item.put("type", row.get("type"));
            item.put("image", row.get("image"));
            item.put("developer", row.get("developer"));
            item.put("localPath", row.get("local_path"));
            item.put("thumbPath", row.get("thumb_path"));
            item.put("includedItems", row.get("included_items"));
            item.put("createdAt", row.get("created_at"));
            item.put("updatedAt", row.get("updated_at"));
            item.put("deleteTime", row.get("delete_time"));
            resultList.add(item);
        }
        return resultList;
    }

    private void clearProductCache(String sku) {
        try {
            String cacheKey = CACHE_KEY_PREFIX + sku;
            redisTemplate.delete(cacheKey);
            log.debug("清除产品缓存: sku={}", sku);
        } catch (Exception e) {
            log.warn("清除产品缓存失败: sku={}, error={}", sku, e.getMessage());
        }
    }
}
