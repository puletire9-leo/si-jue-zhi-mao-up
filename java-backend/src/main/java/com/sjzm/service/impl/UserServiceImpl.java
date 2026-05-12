package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.entity.User;
import com.sjzm.mapper.UserMapper;
import com.sjzm.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
@CacheConfig(cacheNames = "users")
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    private static final Set<String> VALID_ROLES = new HashSet<>(Arrays.asList(
            "admin", "user", "管理员", "开发", "美术", "仓库"
    ));

    @Override
    public PageResult<User> listUsers(int page, int size, String keyword) {
        log.info("查询用户列表: page={}, size={}, keyword={}", page, size, keyword);

        Page<User> pageParam = new Page<>(page, size);

        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(User::getUsername, keyword)
                    .or()
                    .like(User::getEmail, keyword));
        }

        wrapper.orderByDesc(User::getCreatedAt);

        Page<User> userPage = userMapper.selectPage(pageParam, wrapper);

        List<User> users = userPage.getRecords();
        users.forEach(this::clearSensitiveInfo);

        return PageResult.of(
                users,
                userPage.getTotal(),
                (long) page,
                (long) size
        );
    }

    public PageResult<User> getUserList(int page, int size, String keyword) {
        return listUsers(page, size, keyword);
    }

    @Override
    @Cacheable(key = "#id")
    public User getUserById(Long id) {
        log.info("查询用户: id={}", id);

        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }

        clearSensitiveInfo(user);
        return user;
    }

    @Override
    @Cacheable(key = "'username:' + #username")
    public User getUserByUsername(String username) {
        log.info("查询用户: username={}", username);

        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(User::getUsername, username);
        User user = userMapper.selectOne(wrapper);

        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }

        return user;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public User createUser(User user) {
        log.info("创建用户: username={}", user.getUsername());

        if (StringUtils.hasText(user.getUsername())) {
            LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(User::getUsername, user.getUsername());
            Long count = userMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "用户名已存在: " + user.getUsername());
            }
        }

        if (StringUtils.hasText(user.getEmail())) {
            LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(User::getEmail, user.getEmail());
            Long count = userMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "邮箱已存在: " + user.getEmail());
            }
        }

        if (StringUtils.hasText(user.getPassword())) {
            user.setPassword(passwordEncoder.encode(user.getPassword()));
        } else {
            throw new BusinessException(400, "密码不能为空");
        }

        if (!StringUtils.hasText(user.getRole())) {
            user.setRole("user");
        }

        if (!VALID_ROLES.contains(user.getRole())) {
            throw new BusinessException(400, "无效的角色: " + user.getRole());
        }

        if (!StringUtils.hasText(user.getStatus())) {
            user.setStatus("active");
        }

        userMapper.insert(user);

        clearSensitiveInfo(user);
        return user;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public User updateUser(Long id, User user) {
        log.info("更新用户: id={}", id);

        User existingUser = userMapper.selectById(id);
        if (existingUser == null) {
            throw new BusinessException(404, "用户不存在");
        }

        user.setId(id);

        if (StringUtils.hasText(user.getUsername()) && !user.getUsername().equals(existingUser.getUsername())) {
            LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(User::getUsername, user.getUsername());
            Long count = userMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "用户名已存在: " + user.getUsername());
            }
        }

        if (StringUtils.hasText(user.getEmail()) && !user.getEmail().equals(existingUser.getEmail())) {
            LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(User::getEmail, user.getEmail());
            Long count = userMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "邮箱已存在: " + user.getEmail());
            }
        }

        user.setPassword(null);

        if (StringUtils.hasText(user.getRole()) && !VALID_ROLES.contains(user.getRole())) {
            throw new BusinessException(400, "无效的角色: " + user.getRole());
        }

        userMapper.updateById(user);

        User updatedUser = userMapper.selectById(id);
        clearSensitiveInfo(updatedUser);
        return updatedUser;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public void deleteUser(Long id) {
        log.info("删除用户: id={}", id);

        User existingUser = userMapper.selectById(id);
        if (existingUser == null) {
            throw new BusinessException(404, "用户不存在");
        }

        userMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public void updateUserPassword(Long id, String oldPassword, String newPassword) {
        log.info("更新用户密码: id={}", id);

        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }

        if (!verifyPassword(oldPassword, user.getPassword())) {
            throw new BusinessException(400, "旧密码错误");
        }

        if (!StringUtils.hasText(newPassword)) {
            throw new BusinessException(400, "新密码不能为空");
        }
        if (newPassword.length() < 6) {
            throw new BusinessException(400, "新密码长度不能少于6位");
        }

        String encodedPassword = passwordEncoder.encode(newPassword);

        User updateUser = new User();
        updateUser.setId(id);
        updateUser.setPassword(encodedPassword);
        userMapper.updateById(updateUser);

        log.info("用户密码更新成功: id={}", id);
    }

    public void updatePassword(Long id, String oldPassword, String newPassword) {
        updateUserPassword(id, oldPassword, newPassword);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public void updateUserRole(Long id, String role) {
        log.info("更新用户角色: id={}, role={}", id, role);

        if (!VALID_ROLES.contains(role)) {
            throw new BusinessException(400, "无效的角色: " + role);
        }

        User existingUser = userMapper.selectById(id);
        if (existingUser == null) {
            throw new BusinessException(404, "用户不存在");
        }

        User updateUser = new User();
        updateUser.setId(id);
        updateUser.setRole(role);
        userMapper.updateById(updateUser);

        log.info("用户角色更新成功: id={}, role={}", id, role);
    }

    private boolean verifyPassword(String rawPassword, String storedPassword) {
        if (storedPassword == null) {
            return false;
        }

        if (storedPassword.startsWith("$2")) {
            return passwordEncoder.matches(rawPassword, storedPassword);
        }

        String md5Hash = md5(rawPassword);
        if (md5Hash.equals(storedPassword)) {
            return true;
        }

        return rawPassword.equals(storedPassword);
    }

    private String md5(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hashBytes = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("MD5计算失败", e);
        }
    }

    private void clearSensitiveInfo(User user) {
        if (user != null) {
            user.setPassword(null);
        }
    }
}
