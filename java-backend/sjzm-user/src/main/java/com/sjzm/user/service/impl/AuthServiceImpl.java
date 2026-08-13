package com.sjzm.user.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.common.BusinessException;
import com.sjzm.security.JwtUtil;
import com.sjzm.user.dto.LoginRequest;
import com.sjzm.user.dto.LoginResponse;
import com.sjzm.user.dto.RegisterRequest;
import com.sjzm.user.entity.User;
import com.sjzm.user.mapper.UserMapper;
import com.sjzm.user.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserMapper userMapper;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    // 简单内存黑名单，生产环境应使用 Redis
    private final Set<String> tokenBlacklist = ConcurrentHashMap.newKeySet();

    @Override
    public LoginResponse login(LoginRequest request) {
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .and(query -> query
                                .eq(User::getUsername, request.getUsername())
                                .or(nameless -> nameless
                                        .and(emptyUsername -> emptyUsername
                                                .isNull(User::getUsername)
                                                .or()
                                                .eq(User::getUsername, ""))
                                        .eq(User::getName, request.getUsername())))
        );

        if (user == null || !passwordMatches(request.getPassword(), user.getPassword())) {
            throw new BusinessException(401, "用户名或密码错误");
        }

        if (user.getStatus() == null || user.getStatus() != 1) {
            throw new BusinessException(403, "账户已被禁用");
        }

        String role = normalizeRole(user.getRole());
        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getUsername(), role);
        String refreshToken = jwtUtil.generateRefreshToken(user.getId());

        // 更新最后登录时间
        user.setLastLoginAt(LocalDateTime.now());
        userMapper.updateById(user);

        log.info("用户登录成功: username={}, role={}", user.getUsername(), user.getRole());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getExpiration())
                .userInfo(LoginResponse.UserInfo.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .email(user.getEmail())
                        .realName(user.getRealName())
                        .avatar(user.getAvatar())
                        .role(role)
                        .build())
                .build();
    }

    @Override
    public void register(RegisterRequest request) {
        Long count = userMapper.selectCount(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, request.getUsername())
        );
        if (count > 0) {
            throw new BusinessException(400, "用户名已存在");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(request.getPassword());
        user.setRealName(request.getRealName());
        user.setPhone(request.getPhone());
        user.setRole("OPERATOR");
        user.setStatus(1);
        preparePlatformFields(user);

        userMapper.insert(user);
        log.info("用户注册成功: username={}", user.getUsername());
    }

    @Override
    public LoginResponse refresh(String refreshToken) {
        if (!jwtUtil.validateToken(refreshToken)) {
            throw new BusinessException(401, "刷新令牌无效或已过期");
        }

        String tokenType = jwtUtil.getTokenType(refreshToken);
        if (!"refresh".equals(tokenType)) {
            throw new BusinessException(401, "请使用刷新令牌");
        }

        Long userId = jwtUtil.getUserId(refreshToken);
        User user = userMapper.selectById(userId);
        if (user == null || user.getStatus() == null || user.getStatus() != 1) {
            throw new BusinessException(403, "账户不存在或已被禁用");
        }

        String role = normalizeRole(user.getRole());
        String newAccessToken = jwtUtil.generateAccessToken(user.getId(), user.getUsername(), role);
        String newRefreshToken = jwtUtil.generateRefreshToken(user.getId());

        return LoginResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getExpiration())
                .userInfo(LoginResponse.UserInfo.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .role(role)
                        .build())
                .build();
    }

    @Override
    public void logout(String accessToken) {
        tokenBlacklist.add(accessToken);
        log.info("用户登出，token 已加入黑名单");
    }

    public boolean isTokenBlacklisted(String token) {
        return tokenBlacklist.contains(token);
    }

    @Override
    public User getUserById(Long id) {
        return userMapper.selectById(id);
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

    private static String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return "user";
        }
        return switch (role) {
            case "MANAGER" -> "admin";
            case "DEVELOPER" -> "developer";
            case "ART_MANAGER", "ARTIST" -> "editor";
            case "OPERATOR" -> "user";
            default -> role;
        };
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
}
