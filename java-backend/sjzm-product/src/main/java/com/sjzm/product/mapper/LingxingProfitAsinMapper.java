package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingProfitAsin;
import org.apache.ibatis.annotations.Mapper;

/**
 * 领星利润统计-ASIN Mapper。
 * 放 com.sjzm.product.mapper（@MapperScan 只扫这个包）。
 */
@Mapper
public interface LingxingProfitAsinMapper extends BaseMapper<LingxingProfitAsin> {
}
