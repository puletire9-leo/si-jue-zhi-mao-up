package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuWeeklyRaw;
import org.apache.ibatis.annotations.Mapper;

/**
 * 八爪鱼每周原始采集数据 Mapper。
 * 放 com.sjzm.product.mapper（@MapperScan 只扫这个包）。
 */
@Mapper
public interface BazhuayuWeeklyRawMapper extends BaseMapper<BazhuayuWeeklyRaw> {
}
