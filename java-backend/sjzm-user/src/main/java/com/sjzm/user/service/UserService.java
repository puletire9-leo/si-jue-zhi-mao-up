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
     * 用户改自己的资料（仅允许改 realName / email）
     * 不接受 username / role / status / password 变更，避免越权
     */
    void updateSelf(Long id, User user);
}
