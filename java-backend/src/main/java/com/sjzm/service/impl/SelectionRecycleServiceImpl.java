package com.sjzm.service.impl;

import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.service.SelectionRecycleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 选品回收站服务实现
 * <p>
 * 对齐 Python selection_recycle_service.py：
 * 1. 支持多条件筛选（asin, product_title, product_type, store_name, category, start_date, end_date）
 * 2. 从回收站恢复到 selection_products 表
 * 3. 更完善的统计信息
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SelectionRecycleServiceImpl implements SelectionRecycleService {

    private final JdbcTemplate jdbcTemplate;

    // ==================== 分页查询回收站选品 ====================

    @Override
    public PageResult<Map<String, Object>> listRecycleProducts(int page, int size, String keyword) {
        return listRecycleProducts(page, size, keyword, null, null, null, null, null, null, null);
    }

    public PageResult<Map<String, Object>> listRecycleProducts(int page, int size, String keyword,
                                                                 String asin, String productTitle,
                                                                 String productType, String storeName,
                                                                 String category, String startDate, String endDate) {
        log.info("查询回收站选品列表: page={}, size={}, keyword={}, asin={}, productTitle={}, productType={}, storeName={}, category={}, startDate={}, endDate={}",
                page, size, keyword, asin, productTitle, productType, storeName, category, startDate, endDate);

        if (page < 1) page = 1;
        if (size < 1) size = 10;
        if (size > 100) size = 100;

        StringBuilder countSql = new StringBuilder("SELECT COUNT(*) FROM selection_recycle_bin WHERE 1=1");
        StringBuilder querySql = new StringBuilder(
                "SELECT id, original_id, asin, product_title, price, image_url, local_path, thumb_path, " +
                "store_name, store_url, shop_id, main_category_name, main_category_rank, " +
                "main_category_bsr_growth, main_category_bsr_growth_rate, tags, notes, " +
                "product_link, sales_volume, listing_date, listing_days, delivery_method, similar_products, " +
                "source, country, data_filter_mode, product_type, score, grade, week_tag, is_current, " +
                "deleted_at, deleted_by, restore_count, original_data " +
                "FROM selection_recycle_bin WHERE 1=1");

        List<Object> params = new ArrayList<>();

        if (StringUtils.hasText(keyword)) {
            String safeKeyword = "%" + keyword.trim().replace("'", "''") + "%";
            String keywordCondition = " AND (product_title LIKE ? OR asin LIKE ?)";
            countSql.append(keywordCondition);
            querySql.append(keywordCondition);
            params.add(safeKeyword);
            params.add(safeKeyword);
        }

        if (StringUtils.hasText(asin)) {
            String safeAsin = "%" + asin.trim().replace("'", "''") + "%";
            countSql.append(" AND asin LIKE ?");
            querySql.append(" AND asin LIKE ?");
            params.add(safeAsin);
        }

        if (StringUtils.hasText(productTitle)) {
            String safeTitle = "%" + productTitle.trim().replace("'", "''") + "%";
            countSql.append(" AND product_title LIKE ?");
            querySql.append(" AND product_title LIKE ?");
            params.add(safeTitle);
        }

        if (StringUtils.hasText(productType)) {
            countSql.append(" AND product_type = ?");
            querySql.append(" AND product_type = ?");
            params.add(productType);
        }

        if (StringUtils.hasText(storeName)) {
            String safeStore = "%" + storeName.trim().replace("'", "''") + "%";
            countSql.append(" AND store_name LIKE ?");
            querySql.append(" AND store_name LIKE ?");
            params.add(safeStore);
        }

        if (StringUtils.hasText(category)) {
            countSql.append(" AND main_category_name = ?");
            querySql.append(" AND main_category_name = ?");
            params.add(category);
        }

        if (StringUtils.hasText(startDate)) {
            countSql.append(" AND deleted_at >= ?");
            querySql.append(" AND deleted_at >= ?");
            params.add(startDate + " 00:00:00");
        }

        if (StringUtils.hasText(endDate)) {
            countSql.append(" AND deleted_at <= ?");
            querySql.append(" AND deleted_at <= ?");
            params.add(endDate + " 23:59:59");
        }

        querySql.append(" ORDER BY deleted_at DESC");

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
        log.info("获取选品回收站统计");

        Map<String, Object> stats = new HashMap<>();

        Long totalCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM selection_recycle_bin", Long.class);
        stats.put("total", totalCount != null ? totalCount : 0);

        Long todayDeleted = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM selection_recycle_bin WHERE DATE(deleted_at) = CURDATE()",
                Long.class);
        stats.put("todayDeleted", todayDeleted != null ? todayDeleted : 0);

        Long weekDeleted = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM selection_recycle_bin WHERE YEARWEEK(deleted_at) = YEARWEEK(CURDATE())",
                Long.class);
        stats.put("weekDeleted", weekDeleted != null ? weekDeleted : 0);

        String recentDelete = jdbcTemplate.queryForObject(
                "SELECT MAX(deleted_at) FROM selection_recycle_bin",
                String.class);
        stats.put("recentDelete", recentDelete);

        return stats;
    }

    // ==================== 恢复单个选品 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void restoreSelection(Long id) {
        log.info("恢复选品: id={}", id);

        if (id == null) {
            throw new BusinessException("选品ID不能为空");
        }

        Map<String, Object> recycleRecord = jdbcTemplate.queryForMap(
                "SELECT * FROM selection_recycle_bin WHERE id = ?", id);

        if (recycleRecord == null || recycleRecord.isEmpty()) {
            throw new BusinessException("回收站中未找到该选品: " + id);
        }

        String insertSql = """
            INSERT INTO selection_products 
            (asin, product_title, price, image_url, local_path, thumb_path, 
             store_name, store_url, shop_id, main_category_name, main_category_rank,
             main_category_bsr_growth, main_category_bsr_growth_rate,
             tags, notes, product_link, sales_volume, listing_date, listing_days,
             delivery_method, similar_products, source, country, data_filter_mode,
             product_type, score, grade, week_tag, is_current,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            """;

        jdbcTemplate.update(insertSql,
                recycleRecord.get("asin"),
                recycleRecord.get("product_title"),
                recycleRecord.get("price"),
                recycleRecord.get("image_url"),
                recycleRecord.get("local_path"),
                recycleRecord.get("thumb_path"),
                recycleRecord.get("store_name"),
                recycleRecord.get("store_url"),
                recycleRecord.get("shop_id"),
                recycleRecord.get("main_category_name"),
                recycleRecord.get("main_category_rank"),
                recycleRecord.get("main_category_bsr_growth"),
                recycleRecord.get("main_category_bsr_growth_rate"),
                recycleRecord.get("tags"),
                recycleRecord.get("notes"),
                recycleRecord.get("product_link"),
                recycleRecord.get("sales_volume"),
                recycleRecord.get("listing_date"),
                recycleRecord.get("listing_days"),
                recycleRecord.get("delivery_method"),
                recycleRecord.get("similar_products"),
                recycleRecord.get("source"),
                recycleRecord.get("country"),
                recycleRecord.get("data_filter_mode"),
                recycleRecord.get("product_type"),
                recycleRecord.get("score"),
                recycleRecord.get("grade"),
                recycleRecord.get("week_tag"),
                recycleRecord.get("is_current")
        );

        jdbcTemplate.update("DELETE FROM selection_recycle_bin WHERE id = ?", id);

        log.info("选品恢复成功: id={}, asin={}", id, recycleRecord.get("asin"));
    }

    // ==================== 批量恢复选品 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchRestoreSelections(List<Long> ids) {
        log.info("批量恢复选品: ids={}", ids);

        Map<String, Object> result = new HashMap<>();
        if (CollectionUtils.isEmpty(ids)) {
            throw new BusinessException("选品ID列表不能为空");
        }

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        String placeholders = ids.stream().map(id -> "?").collect(Collectors.joining(","));
        String selectSql = String.format("SELECT * FROM selection_recycle_bin WHERE id IN (%s)", placeholders);

        List<Map<String, Object>> records = jdbcTemplate.queryForList(selectSql, ids.toArray());

        if (records.isEmpty()) {
            throw new BusinessException("没有找到有效的回收站选品");
        }

        String insertSql = """
            INSERT INTO selection_products 
            (asin, product_title, price, image_url, local_path, thumb_path, 
             store_name, store_url, shop_id, main_category_name, main_category_rank,
             main_category_bsr_growth, main_category_bsr_growth_rate,
             tags, notes, product_link, sales_volume, listing_date, listing_days,
             delivery_method, similar_products, source, country, data_filter_mode,
             product_type, score, grade, week_tag, is_current,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            """;

        for (Map<String, Object> record : records) {
            try {
                jdbcTemplate.update(insertSql,
                        record.get("asin"),
                        record.get("product_title"),
                        record.get("price"),
                        record.get("image_url"),
                        record.get("local_path"),
                        record.get("thumb_path"),
                        record.get("store_name"),
                        record.get("store_url"),
                        record.get("shop_id"),
                        record.get("main_category_name"),
                        record.get("main_category_rank"),
                        record.get("main_category_bsr_growth"),
                        record.get("main_category_bsr_growth_rate"),
                        record.get("tags"),
                        record.get("notes"),
                        record.get("product_link"),
                        record.get("sales_volume"),
                        record.get("listing_date"),
                        record.get("listing_days"),
                        record.get("delivery_method"),
                        record.get("similar_products"),
                        record.get("source"),
                        record.get("country"),
                        record.get("data_filter_mode"),
                        record.get("product_type"),
                        record.get("score"),
                        record.get("grade"),
                        record.get("week_tag"),
                        record.get("is_current")
                );
                success++;
            } catch (Exception e) {
                failed++;
                errors.add("id=" + record.get("id") + ": " + e.getMessage());
                log.warn("恢复选品失败: id={}, error={}", record.get("id"), e.getMessage());
            }
        }

        List<Long> successIds = records.stream()
                .map(r -> ((Number) r.get("id")).longValue())
                .collect(Collectors.toList());

        String deletePlaceholders = successIds.stream().map(id -> "?").collect(Collectors.joining(","));
        String deleteSql = String.format("DELETE FROM selection_recycle_bin WHERE id IN (%s)", deletePlaceholders);
        jdbcTemplate.update(deleteSql, successIds.toArray());

        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);

        log.info("批量恢复选品完成: 成功={}, 失败={}", success, failed);
        return result;
    }

    // ==================== 永久删除单个选品 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void permanentlyDeleteSelection(Long id) {
        log.info("永久删除选品: id={}", id);

        if (id == null) {
            throw new BusinessException("选品ID不能为空");
        }

        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM selection_recycle_bin WHERE id = ?", Long.class, id);
        if (count == null || count == 0) {
            throw new BusinessException("回收站中未找到该选品: " + id);
        }

        int deleted = jdbcTemplate.update("DELETE FROM selection_recycle_bin WHERE id = ?", id);

        if (deleted == 0) {
            throw new BusinessException("永久删除选品失败: " + id);
        }

        log.info("选品永久删除成功: id={}", id);
    }

    // ==================== 根据ASIN永久删除选品 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> permanentlyDeleteByAsins(List<String> asins) {
        log.info("根据ASIN永久删除选品: asins={}", asins);

        Map<String, Object> result = new HashMap<>();
        if (CollectionUtils.isEmpty(asins)) {
            throw new BusinessException("ASIN列表不能为空");
        }

        String placeholders = asins.stream().map(a -> "?").collect(Collectors.joining(","));
        String deleteSql = String.format("DELETE FROM selection_recycle_bin WHERE asin IN (%s)", placeholders);

        int deleted = jdbcTemplate.update(deleteSql, asins.toArray());

        result.put("deleted", deleted);
        result.put("requested", asins.size());
        result.put("errors", Collections.emptyList());

        log.info("根据ASIN永久删除选品完成: 删除={}", deleted);
        return result;
    }

    // ==================== 批量永久删除选品 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchPermanentlyDeleteSelections(List<Long> ids) {
        log.info("批量永久删除选品: ids={}", ids);

        Map<String, Object> result = new HashMap<>();
        if (CollectionUtils.isEmpty(ids)) {
            throw new BusinessException("选品ID列表不能为空");
        }

        String placeholders = ids.stream().map(id -> "?").collect(Collectors.joining(","));
        String deleteSql = String.format("DELETE FROM selection_recycle_bin WHERE id IN (%s)", placeholders);

        int deleted = jdbcTemplate.update(deleteSql, ids.toArray());

        result.put("success", deleted);
        result.put("failed", ids.size() - deleted);
        result.put("errors", Collections.emptyList());

        log.info("批量永久删除选品完成: 删除={}", deleted);
        return result;
    }

    // ==================== 清空回收站 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> clearRecycleBin() {
        log.info("清空选品回收站");

        Map<String, Object> result = new HashMap<>();

        Long beforeCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM selection_recycle_bin", Long.class);

        int deleted = jdbcTemplate.update("DELETE FROM selection_recycle_bin");

        result.put("deleted", deleted);
        result.put("beforeCount", beforeCount != null ? beforeCount : 0);

        log.info("清空选品回收站完成: 删除={}, 删除前总数={}", deleted, beforeCount);
        return result;
    }

    // ==================== 清理过期选品 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> clearExpiredProducts(int days) {
        log.info("清理过期选品: days={}", days);

        Map<String, Object> result = new HashMap<>();

        Long beforeCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM selection_recycle_bin", Long.class);

        String sql = "DELETE FROM selection_recycle_bin WHERE deleted_at <= DATE_SUB(NOW(), INTERVAL ? DAY)";
        int deleted = jdbcTemplate.update(sql, days);

        result.put("deleted", deleted);
        result.put("days", days);
        result.put("beforeCount", beforeCount != null ? beforeCount : 0);

        log.info("清理过期选品完成: 删除={}, 过期天数={}", deleted, days);
        return result;
    }

    // ==================== 辅助方法 ====================

    private List<Map<String, Object>> convertToResultList(List<Map<String, Object>> list) {
        List<Map<String, Object>> resultList = new ArrayList<>();
        for (Map<String, Object> row : list) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", row.get("id"));
            item.put("originalId", row.get("original_id"));
            item.put("asin", row.get("asin"));
            item.put("productTitle", row.get("product_title"));
            item.put("price", row.get("price"));
            item.put("imageUrl", row.get("image_url"));
            item.put("localPath", row.get("local_path"));
            item.put("thumbPath", row.get("thumb_path"));
            item.put("storeName", row.get("store_name"));
            item.put("storeUrl", row.get("store_url"));
            item.put("shopId", row.get("shop_id"));
            item.put("mainCategoryName", row.get("main_category_name"));
            item.put("mainCategoryRank", row.get("main_category_rank"));
            item.put("mainCategoryBsrGrowth", row.get("main_category_bsr_growth"));
            item.put("mainCategoryBsrGrowthRate", row.get("main_category_bsr_growth_rate"));
            item.put("tags", row.get("tags"));
            item.put("notes", row.get("notes"));
            item.put("productLink", row.get("product_link"));
            item.put("salesVolume", row.get("sales_volume"));
            item.put("listingDate", row.get("listing_date"));
            item.put("listingDays", row.get("listing_days"));
            item.put("deliveryMethod", row.get("delivery_method"));
            item.put("similarProducts", row.get("similar_products"));
            item.put("source", row.get("source"));
            item.put("country", row.get("country"));
            item.put("dataFilterMode", row.get("data_filter_mode"));
            item.put("productType", row.get("product_type"));
            item.put("score", row.get("score"));
            item.put("grade", row.get("grade"));
            item.put("weekTag", row.get("week_tag"));
            item.put("isCurrent", row.get("is_current"));
            item.put("deletedAt", row.get("deleted_at"));
            item.put("deletedBy", row.get("deleted_by"));
            item.put("restoreCount", row.get("restore_count"));
            item.put("originalData", row.get("original_data"));
            resultList.add(item);
        }
        return resultList;
    }
}
