package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingProductPerformance;
import com.sjzm.product.rds.lingxing.LingxingRdsMapper;

/**
 * 领星产品表现 Mapper。
 * <p>沿用老约定放在 com.sjzm.product.mapper，已被 ProductApplication.@MapperScan 第一行覆盖，无需改 @MapperScan。
 */
public interface LingxingProductPerformanceMapper extends BaseMapper<LingxingProductPerformance>, LingxingRdsMapper {
}
