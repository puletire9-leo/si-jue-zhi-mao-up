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
                        .orderByDesc(User::getCreatedAt)
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
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new BusinessException(400, "原密码错误");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
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
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        if (user.getStatus() == null) {
            user.setStatus(1);
        }
        userMapper.insert(user);
        log.info("用户创建成功: username={}, role={}", user.getUsername(), user.getRole());
    }

    private static final java.util.List<String> VALID_ROLES = java.util.List.of(
            "管理员", "admin", "开发", "developer", "美术", "artist", "仓库", "warehouse", "运营", "operator", "user");

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
            if (!VALID_ROLES.contains(user.getRole())) {
                throw new BusinessException(400, "无效的角色: " + user.getRole());
            }
            existing.setRole(user.getRole());
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
        user.setRole(role);
        userMapper.updateById(user);
        log.info("用户角色已更新: userId={}, role={}", id, role);
    }

    @Override
    public void updateSelf(Long id, User user) {
        User existing = userMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(404, "用户不存在");
        }
        // 只允许改 realName 和 email，其他字段一律忽略
        if (user.getRealName() != null) existing.setRealName(user.getRealName());
        if (user.getEmail() != null) existing.setEmail(user.getEmail());
        userMapper.updateById(existing);
        log.info("用户改自己资料: userId={}", id);
    }
}
