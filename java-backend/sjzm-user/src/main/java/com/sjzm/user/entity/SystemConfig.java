package com.sjzm.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 系统配置/凭证集中存储（RDS ai_platform.system_config）。
 *
 * <p>凭证总账：集中存 RDS 账号、飞书 App 凭证、白名单 IP、代理等配置，
 * 经业主明确授权含明文密码。查询接口仅 admin 可访问（见 SystemConfigController）。
 *
 * <p>表由 2026-08-13 建，DDL 主键 AUTO_INCREMENT，故用 {@link IdType#AUTO}。
 */
@Data
@TableName("system_config")
public class SystemConfig {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 配置键（唯一），如 rds.host / feishu.app_id */
    private String configKey;

    /** 配置值（含明文账号密码，经业主授权） */
    private String configValue;

    /** 分类：rds / feishu / proxy / system */
    private String category;

    /** 说明 */
    private String description;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
