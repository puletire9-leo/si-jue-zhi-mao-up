package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingSeller;
import com.sjzm.product.rds.lingxing.LingxingRdsMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 领星亚马逊店铺 Mapper。
 * 放 com.sjzm.product.mapper（@MapperScan 只扫这个包）。
 */
@Mapper
public interface LingxingSellerMapper extends BaseMapper<LingxingSeller>, LingxingRdsMapper {
}
