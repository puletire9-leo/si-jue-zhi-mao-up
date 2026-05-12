package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.entity.User;
import com.sjzm.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 用户管理控制器
 */
@Tag(name = "用户管理", description = "用户 CRUD、密码管理、角色管理")
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @Operation(summary = "获取用户列表", description = "分页查询用户（需要管理员权限）")
    @GetMapping
    public Result<PageResult<User>> listUsers(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword) {
        try {
            PageResult<User> result = userService.listUsers(page, size, keyword);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        }
    }

    @Operation(summary = "获取用户详情", description = "根据ID获取用户详细信息")
    @GetMapping("/{id}")
    public Result<User> getUser(@PathVariable Long id) {
        try {
            User user = userService.getUserById(id);
            return Result.success(user);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        }
    }

    @Operation(summary = "创建用户", description = "创建新用户（需要管理员权限）")
    @PostMapping
    public Result<User> createUser(@RequestBody User user) {
        try {
            User createdUser = userService.createUser(user);
            return Result.success(createdUser);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        }
    }

    @Operation(summary = "更新用户", description = "根据ID更新用户信息")
    @PutMapping("/{id}")
    public Result<User> updateUser(@PathVariable Long id, @RequestBody User user) {
        try {
            User updatedUser = userService.updateUser(id, user);
            return Result.success(updatedUser);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        }
    }

    @Operation(summary = "删除用户", description = "根据ID删除用户（逻辑删除）")
    @DeleteMapping("/{id}")
    public Result<Void> deleteUser(@PathVariable Long id) {
        try {
            userService.deleteUser(id);
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        }
    }

    @Operation(summary = "更新用户密码", description = "更新指定用户的密码")
    @PutMapping("/{id}/password")
    public Result<Void> updateUserPassword(@PathVariable Long id, @RequestBody Map<String, String> passwordRequest) {
        try {
            String oldPassword = passwordRequest.get("oldPassword");
            String newPassword = passwordRequest.get("newPassword");
            userService.updateUserPassword(id, oldPassword, newPassword);
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        }
    }

    @Operation(summary = "更新用户角色", description = "更新指定用户的角色（需要管理员权限）")
    @PutMapping("/{id}/role")
    public Result<Void> updateUserRole(@PathVariable Long id, @RequestBody Map<String, String> roleRequest) {
        try {
            String role = roleRequest.get("role");
            userService.updateUserRole(id, role);
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        }
    }
}
