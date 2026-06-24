package com.sjzm.user.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("users")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;

    private String password;

    private String email;

    @TableField("full_name")
    private String realName;

    @TableField(exist = false)
    private String phone;

    @TableField(exist = false)
    private String avatar;

    private String role;

    private String developer;

    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableField("last_login_time")
    private LocalDateTime lastLoginAt;
}
