package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingLocalProduct;
import org.apache.ibatis.annotations.Mapper;

/**
 * 领星本地产品 Mapper。
 * 放 com.sjzm.product.mapper（@MapperScan 只扫这个包）。
 */
@Mapper
public interface LingxingLocalProductMapper extends BaseMapper<LingxingLocalProduct> {
}
