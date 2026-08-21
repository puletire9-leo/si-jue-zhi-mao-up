package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingProductPerformanceDaily;
import org.apache.ibatis.annotations.Mapper;

/**
 * 领星产品表现日表 Mapper。
 * <p>沿用老约定放在 com.sjzm.product.mapper，已被 ProductApplication.@MapperScan 第一行覆盖，无需改 @MapperScan。
 */
@Mapper
public interface LingxingProductPerformanceDailyMapper
        extends BaseMapper<LingxingProductPerformanceDaily> {
}
