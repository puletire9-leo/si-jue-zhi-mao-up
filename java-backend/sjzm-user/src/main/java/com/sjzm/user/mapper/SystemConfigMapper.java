package com.sjzm.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.user.entity.SystemConfig;
import org.apache.ibatis.annotations.Mapper;

/**
 * system_config 表 Mapper。放 com.sjzm.user.mapper（老约定），
 * 被 UserApplication.@MapperScan("com.sjzm.user.mapper") 覆盖，无需额外注册。
 */
@Mapper
public interface SystemConfigMapper extends BaseMapper<SystemConfig> {
}
