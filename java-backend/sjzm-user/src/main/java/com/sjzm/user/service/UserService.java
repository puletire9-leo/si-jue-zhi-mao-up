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
}
