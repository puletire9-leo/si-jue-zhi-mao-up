package com.sjzm.user.service;

import com.sjzm.common.PageResult;
import com.sjzm.user.entity.User;

public interface UserService {

    PageResult<User> list(Integer page, Integer size);

    User detail(Long id);

    void updatePassword(Long id, String oldPassword, String newPassword);

    void create(User user);

    void update(Long id, User user);

    void delete(Long id);

    void updateRole(Long id, String role);

    /**
     * 管理员重置他人密码（无需旧密码校验）
     * 仅 admin 角色可调用，权限由网关 user:manage 控制
     */
    void resetPassword(Long id, String newPassword);
}
