package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 用户实体
 */
@Data
@TableName("user")
public class User implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 用户名 */
    private String username;

    /** 密码 */
    private String password;

    /** 邮箱 */
    private String email;

    /** 角色 */
    private String role;

    /** 开发人标识 */
    private String developer;

    /** 最后登录时间 */
    private LocalDateTime lastLoginTime;

    /** 状态 */
    private String status;

    /** 删除标记 */
    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
