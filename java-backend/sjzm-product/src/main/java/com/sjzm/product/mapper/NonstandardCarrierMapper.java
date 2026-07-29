package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.NonstandardCarrier;
import org.apache.ibatis.annotations.Mapper;

/**
 * 非标载体配置 Mapper。CRUD 走 MyBatis-Plus BaseMapper。
 */
@Mapper
public interface NonstandardCarrierMapper extends BaseMapper<NonstandardCarrier> {
}
