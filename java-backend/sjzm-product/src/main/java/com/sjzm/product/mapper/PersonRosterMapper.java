package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.roster.entity.PersonRoster;
import org.apache.ibatis.annotations.Mapper;

/**
 * Person roster mapper.
 * Placed in com.sjzm.product.mapper (the only package scanned by @MapperScan).
 */
@Mapper
public interface PersonRosterMapper extends BaseMapper<PersonRoster> {
}
