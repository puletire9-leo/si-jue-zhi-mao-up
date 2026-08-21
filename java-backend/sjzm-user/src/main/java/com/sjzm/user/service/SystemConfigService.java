package com.sjzm.user.service;

import com.sjzm.user.entity.SystemConfig;

import java.util.List;

/**
 * RDS 操作中心 - 系统配置/凭证读取服务。
 *
 * <p>只读为主，凭证集中管理。写入（upsert）供后续运维脚本/接口使用。
 */
public interface SystemConfigService {

    /** 全部配置 */
    List<SystemConfig> listAll();

    /** 按分类查询：rds / feishu / proxy / system */
    List<SystemConfig> listByCategory(String category);

    /** 按键查询单条配置值；不存在返回 null */
    String getValue(String configKey);

    /** 按键查询整条记录；不存在返回 null */
    SystemConfig getByKey(String configKey);

    /** upsert：存在则更新 value/description，不存在则插入 */
    void upsert(String configKey, String configValue, String category, String description);
}
