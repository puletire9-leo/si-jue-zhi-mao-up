package com.sjzm.service;

import com.sjzm.common.PageResult;
import com.sjzm.entity.User;

import java.util.List;
import java.util.Map;

/**
 * 用户服务接口
 */
public interface UserService {

    /**
     * 分页查询用户
     */
    PageResult<User> listUsers(int page, int size, String keyword);

    /**
     * 根据ID获取用户
     */
    User getUserById(Long id);

    /**
     * 根据用户名获取用户
     */
    User getUserByUsername(String username);

    /**
     * 创建用户
     */
    User createUser(User user);

    /**
     * 更新用户
     */
    User updateUser(Long id, User user);

    /**
     * 删除用户
     */
    void deleteUser(Long id);

    /**
     * 更新用户密码
     */
    void updateUserPassword(Long id, String oldPassword, String newPassword);

    /**
     * 更新用户角色
     */
    void updateUserRole(Long id, String role);
}
