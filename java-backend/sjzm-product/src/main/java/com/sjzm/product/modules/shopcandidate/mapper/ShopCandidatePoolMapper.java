package com.sjzm.product.modules.shopcandidate.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.shopcandidate.entity.ShopCandidatePool;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 店铺候选池 Mapper。
 *
 * <p>upsert：唯一键 {@code uk_candidate_source (marketplace, seller_name, source_type, source_code, batch_code)}
 * 的 ON DUPLICATE KEY UPDATE——同店同周同方法卡只刷新命中数据/原因，不覆盖人工操作的状态。
 * atomicLockForFetch：候选确认抓取前原子抢锁，只有 PENDING/SELECTED/FETCH_FAILED 可进入 FETCHING。</p>
 */
@Mapper
public interface ShopCandidatePoolMapper extends BaseMapper<ShopCandidatePool> {

    @Insert({"<script>",
        "INSERT INTO shop_candidate_pool (marketplace, seller_name, seller_id, source_type, source_code, ",
        "batch_code, batch_date, reason, hit_count, top_category, ",
        "sales_tier_summary_json, sample_products_json, status, operator, note, created_at, updated_at) VALUES (",
        "#{marketplace}, #{sellerName}, #{sellerId}, #{sourceType}, #{sourceCode}, ",
        "#{batchCode}, #{batchDate}, #{reason}, #{hitCount}, #{topCategory}, ",
        "#{salesTierSummaryJson}, #{sampleProductsJson}, ",
        "COALESCE(#{status}, 'PENDING'), #{operator}, #{note}, NOW(), NOW())",
        "ON DUPLICATE KEY UPDATE",
        "seller_id=VALUES(seller_id), batch_date=VALUES(batch_date),",
        "reason=VALUES(reason), hit_count=VALUES(hit_count), top_category=VALUES(top_category),",
        "sales_tier_summary_json=VALUES(sales_tier_summary_json),",
        "sample_products_json=VALUES(sample_products_json),",
        "operator=VALUES(operator), note=VALUES(note), updated_at=NOW()",
        "</script>"})
    int upsert(ShopCandidatePool entity);

    int upsertBatch(@Param("items") List<ShopCandidatePool> items);

    List<ShopCandidatePool> selectByRequestState(
            @Param("marketplace") String marketplace,
            @Param("batchCode") String batchCode,
            @Param("sourceType") String sourceType,
            @Param("sourceCode") String sourceCode,
            @Param("status") String status,
            @Param("minHitCount") Integer minHitCount,
            @Param("sellerName") String sellerName,
            @Param("requestState") String requestState,
            @Param("offset") int offset,
            @Param("limit") int limit);

    long countByRequestState(
            @Param("marketplace") String marketplace,
            @Param("batchCode") String batchCode,
            @Param("sourceType") String sourceType,
            @Param("sourceCode") String sourceCode,
            @Param("status") String status,
            @Param("minHitCount") Integer minHitCount,
            @Param("sellerName") String sellerName,
            @Param("requestState") String requestState);

    List<ShopCandidatePool> selectFetchableByRequestState(
            @Param("marketplace") String marketplace,
            @Param("batchCode") String batchCode,
            @Param("sourceType") String sourceType,
            @Param("sourceCode") String sourceCode,
            @Param("status") String status,
            @Param("minHitCount") Integer minHitCount,
            @Param("sellerName") String sellerName,
            @Param("requestState") String requestState,
            @Param("limit") int limit);

    /**
     * 原子抢锁——只有允许的状态才能进入 FETCHING。
     * @return affected rows（0 表示已被其它操作占用或状态不允许）
     */
    @Update({"<script>",
        "UPDATE shop_candidate_pool SET status = 'FETCHING', last_fetch_at = NOW(), updated_at = NOW()",
        "WHERE id = #{id}",
        "  AND status IN ('PENDING', 'SELECTED', 'FETCH_FAILED')",
        "</script>"})
    int atomicLockForFetch(Long id);
}
