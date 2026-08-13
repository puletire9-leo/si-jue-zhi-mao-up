package com.sjzm.user.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("users")
public class User {

    @TableId(value = "numeric_id", type = IdType.AUTO)
    private Long id;

    @TableField("id")
    private String platformId;

    private String name;

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

    @TableField("createdAt")
    private String createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableField("last_login_time")
    private LocalDateTime lastLoginAt;
}
