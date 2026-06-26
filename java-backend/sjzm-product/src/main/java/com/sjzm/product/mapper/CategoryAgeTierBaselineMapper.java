package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.CategoryAgeTierBaseline;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface CategoryAgeTierBaselineMapper extends BaseMapper<CategoryAgeTierBaseline> {

    /**
     * 月度刷新基线：删本月当前 marketplace 已有行，按 (marketplace × bsr_id × age_bucket × month) 重算。
     * 数据源：competitor_products_clean（已按父 ASIN 去重）
     * 硬门槛：listing_days < 90 AND weight_g < 300
     */
    int deleteByBaselineMonth(@Param("baselineMonth") String baselineMonth,
                              @Param("marketplace") String marketplace);

    int insertComputedSlices(@Param("baselineMonth") String baselineMonth,
                             @Param("marketplace") String marketplace);

    /**
     * 周度增量打标 competitor_products + competitor_products_clean 的 m04_* 5 列。
     * 只处理 WHERE week_tag = ? AND listing_days < 90 AND weight_g < 300 的行。
     */
    int tagAsinsByWeek(@Param("weekTag") String weekTag,
                       @Param("baselineMonth") String baselineMonth,
                       @Param("marketplace") String marketplace);

    /**
     * 月度全量打标（基线刷新后，对全月新品打标，包括无 week_tag 的老数据）。
     */
    int tagAsinsByMonth(@Param("baselineMonth") String baselineMonth,
                       @Param("marketplace") String marketplace);
}
