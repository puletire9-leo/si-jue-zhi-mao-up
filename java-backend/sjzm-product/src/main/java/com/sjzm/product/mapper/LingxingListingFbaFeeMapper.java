package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingListingFbaFee;
import com.sjzm.product.rds.lingxing.LingxingRdsMapper;

/**
 * 领星 Listing FBA 预估费中间表 Mapper（getPrices 落库）。
 * 放 com.sjzm.product.mapper（@MapperScan 扫此包）。
 */
public interface LingxingListingFbaFeeMapper extends BaseMapper<LingxingListingFbaFee>, LingxingRdsMapper {
}
