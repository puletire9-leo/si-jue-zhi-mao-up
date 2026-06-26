package com.sjzm.product.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface CompetitorProductsCleanMapper {

    /**
     * 按 (marketplace, effective_week_tag) 增量清洗：
     * 把 competitor_products 里指定批次的行按父 ASIN 去重，INSERT/UPDATE 进 competitor_products_clean。
     *
     * 同周父群组幂等：用唯一键 (marketplace, effective_week_tag, dedup_key) 防重复。
     * 重复导入 → ON DUPLICATE KEY UPDATE 覆盖最新数据。
     *
     * 性能：每批 4-8k 行 → 2-3k 代表，<2 秒
     *
     * @param marketplace        UK/DE/US
     * @param effectiveWeekTag   yyyy-Www 或 yyyyMM-W00（老数据占位）
     * @return 影响行数（每行 +1，UPDATE 也算 +2）
     */
    int refreshBatch(@Param("marketplace") String marketplace,
                     @Param("effectiveWeekTag") String effectiveWeekTag);

    /**
     * 按 marketplace + week_tag 字段（不含 effective_ 前缀）触发清洗。
     * 给业务侧使用：导入完成后只知道 week_tag 是 yyyy-Www，不知道有 month-W00 占位约定。
     */
    int refreshByWeekTag(@Param("marketplace") String marketplace,
                         @Param("weekTag") String weekTag);
}
