package com.sjzm.user.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.user.entity.User;
import com.sjzm.user.mapper.UserMapper;
import com.sjzm.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Override
    public PageResult<User> list(Integer page, Integer size) {
        Page<User> userPage = userMapper.selectPage(
                new Page<>(page, size),
                new LambdaQueryWrapper<User>()
                        .select(User.class, f -> !"password".equals(f.getProperty()))
                        .orderByDesc(User::getId)
        );
        return PageResult.of(
                userPage.getRecords(),
                userPage.getTotal(),
                (long) page,
                (long) size
        );
    }

    @Override
    public User detail(Long id) {
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .select(User.class, f -> !"password".equals(f.getProperty()))
                        .eq(User::getId, id)
        );
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }
        return user;
    }

    @Override
    public void updatePassword(Long id, String oldPassword, String newPassword) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }
        if (!passwordMatches(oldPassword, user.getPassword())) {
            throw new BusinessException(400, "原密码错误");
        }
        user.setPassword(newPassword);
        userMapper.updateById(user);
        log.info("用户密码已修改: userId={}", id);
    }

    @Override
    public void create(User user) {
        // 检查用户名是否已存在
        Long count = userMapper.selectCount(
                new LambdaQueryWrapper<User>().eq(User::getUsername, user.getUsername())
        );
        if (count > 0) {
            throw new BusinessException(400, "用户名已存在");
        }
        user.setPassword(user.getPassword());
        user.setRole(toPlatformRole(user.getRole()));
        if (user.getStatus() == null) {
            user.setStatus(1);
        }
        preparePlatformFields(user);
        userMapper.insert(user);
        log.info("用户创建成功: username={}, role={}", user.getUsername(), user.getRole());
    }

    private static final java.util.Set<String> VALID_ROLES = java.util.Set.of(
            "管理员", "admin", "开发", "developer", "美术", "artist", "仓库", "warehouse",
            "运营", "operator", "采购员", "purchaser", "user", "viewer");

    @Override
    public void update(Long id, User user) {
        User existing = userMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(404, "用户不存在");
        }
        // 只更新允许的字段
        if (user.getUsername() != null) {
            // 改用户名时查重：撞到别的用户报友好提示（避免直接抛 DB 唯一约束异常）
            if (!user.getUsername().equals(existing.getUsername())) {
                Long dup = userMapper.selectCount(
                        new LambdaQueryWrapper<User>()
                                .eq(User::getUsername, user.getUsername())
                                .ne(User::getId, id)
                );
                if (dup > 0) {
                    throw new BusinessException(400, "用户名已存在");
                }
            }
            existing.setUsername(user.getUsername());
        }
        if (user.getEmail() != null) existing.setEmail(user.getEmail());
        if (user.getRealName() != null) existing.setRealName(user.getRealName());
        if (user.getRole() != null) {
            for (String r : user.getRole().split(",")) {
                String trimmed = r.trim();
                if (trimmed.isEmpty()) continue;
                if (!VALID_ROLES.contains(trimmed)) {
                    throw new BusinessException(400, "无效的角色: " + trimmed);
                }
            }
            existing.setRole(toPlatformRole(user.getRole()));
        }
        if (user.getDeveloper() != null) existing.setDeveloper(user.getDeveloper());
        if (user.getStatus() != null) existing.setStatus(user.getStatus());
        userMapper.updateById(existing);
        log.info("用户信息已更新: userId={}", id);
    }

    @Override
    public void delete(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }
        userMapper.deleteById(id);
        log.info("用户已删除: userId={}", id);
    }

    @Override
    public void updateRole(Long id, String role) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }
        user.setRole(toPlatformRole(role));
        userMapper.updateById(user);
        log.info("用户角色已更新: userId={}, role={}", id, role);
    }

    @Override
    public void resetPassword(Long id, String newPassword) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }
        user.setPassword(newPassword);
        userMapper.updateById(user);
        log.warn("[Admin] 重置用户密码: userId={}, username={}", id, user.getUsername());
    }

    private boolean passwordMatches(String rawPassword, String storedPassword) {
        if (storedPassword == null) {
            return false;
        }
        if (storedPassword.startsWith("$2a$")
                || storedPassword.startsWith("$2b$")
                || storedPassword.startsWith("$2y$")) {
            return passwordEncoder.matches(rawPassword, storedPassword);
        }
        return storedPassword.equals(rawPassword);
    }

    private static void preparePlatformFields(User user) {
        if (user.getPlatformId() == null || user.getPlatformId().isBlank()) {
            user.setPlatformId(java.util.UUID.randomUUID().toString());
        }
        if (user.getName() == null || user.getName().isBlank()) {
            user.setName(user.getRealName() == null || user.getRealName().isBlank()
                    ? user.getUsername() : user.getRealName());
        }
        if (user.getCreatedAt() == null || user.getCreatedAt().isBlank()) {
            user.setCreatedAt(java.time.Instant.now().toString());
        }
    }

    private static String toPlatformRole(String role) {
        if (role == null || role.isBlank()) {
            return "OPERATOR";
        }
        String normalizedRole = role.toLowerCase(java.util.Locale.ROOT);
        if (normalizedRole.contains("admin") || role.contains("管理员")) {
            return "MANAGER";
        }
        if (role.contains("开发") || normalizedRole.contains("developer")) {
            return "DEVELOPER";
        }
        if (role.contains("美术") || normalizedRole.contains("artist")) {
            return "ART_MANAGER";
        }
        if (role.contains("采购员") || normalizedRole.contains("purchaser")) {
            return "PURCHASER";
        }
        return "OPERATOR";
    }
}
