package com.sjzm.user.controller;

import com.sjzm.common.Result;
import com.sjzm.user.dto.LoginRequest;
import com.sjzm.user.dto.LoginResponse;
import com.sjzm.user.dto.RegisterRequest;
import com.sjzm.user.entity.User;
import com.sjzm.user.service.AuthService;
import com.sjzm.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "认证", description = "登录/注册/刷新/登出")
public class AuthController {

    private final AuthService authService;
    private final UserService userService;

    @PostMapping("/login")
    @Operation(summary = "用户登录")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return Result.success("登录成功", authService.login(request));
    }

    @PostMapping("/register")
    @Operation(summary = "用户注册")
    public Result<String> register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request);
        return Result.success("注册成功");
    }

    @PostMapping("/refresh")
    @Operation(summary = "刷新令牌")
    public Result<LoginResponse> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank()) {
            refreshToken = body.get("refresh_token");
        }
        if (refreshToken == null || refreshToken.isBlank()) {
            return Result.error(400, "refreshToken不能为空");
        }
        return Result.success("令牌刷新成功", authService.refresh(refreshToken));
    }

    @PostMapping("/logout")
    @Operation(summary = "用户登出")
    public Result<String> logout(@RequestHeader("Authorization") String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            authService.logout(authHeader.substring(7));
        }
        return Result.success("登出成功");
    }

    @GetMapping("/me")
    @Operation(summary = "获取当前用户信息")
    public Result<LoginResponse.UserInfo> me() {
        Long userId = currentUserId();
        if (userId == null) {
            return Result.error(401, "未登录");
        }
        User user = authService.getUserById(userId);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }
        return Result.success(toUserInfo(user));
    }

    @PutMapping("/me/password")
    @Operation(summary = "修改当前用户密码（需旧密码校验）")
    public Result<String> updateMyPassword(@RequestBody Map<String, String> body) {
        Long userId = currentUserId();
        if (userId == null) {
            return Result.error(401, "未登录");
        }
        String oldPassword = body.get("oldPassword");
        String newPassword = body.get("newPassword");
        if (oldPassword == null || oldPassword.isBlank()) {
            return Result.error(400, "旧密码不能为空");
        }
        if (newPassword == null || newPassword.isBlank()) {
            return Result.error(400, "新密码不能为空");
        }
        userService.updatePassword(userId, oldPassword, newPassword);
        return Result.success("密码修改成功");
    }

    private Long currentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return principal instanceof Long ? (Long) principal : null;
    }

    private LoginResponse.UserInfo toUserInfo(User user) {
        return LoginResponse.UserInfo.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .realName(user.getRealName())
                .avatar(user.getAvatar())
                .role(user.getRole())
                .build();
    }
}
