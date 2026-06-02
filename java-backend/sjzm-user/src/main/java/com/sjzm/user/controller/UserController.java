package com.sjzm.user.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.user.entity.User;
import com.sjzm.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "用户管理", description = "用户 CRUD")
public class UserController {

    private final UserService userService;

    @GetMapping({"", "/"})
    @Operation(summary = "用户列表")
    public Result<PageResult<User>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer size) {
        return Result.success(userService.list(page, size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "用户详情")
    public Result<User> detail(@PathVariable Long id) {
        return Result.success(userService.detail(id));
    }

    @PutMapping("/{id}/password")
    @Operation(summary = "修改密码")
    public Result<String> updatePassword(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> body) {
        String oldPassword = body.get("oldPassword");
        String newPassword = body.get("newPassword");
        if (oldPassword == null || newPassword == null || newPassword.isBlank()) {
            return Result.error(400, "密码不能为空");
        }
        userService.updatePassword(id, oldPassword, newPassword);
        return Result.success("密码修改成功");
    }

    @PostMapping({"", "/"})
    @Operation(summary = "创建用户")
    public Result<String> create(@RequestBody User user) {
        if (user.getUsername() == null || user.getUsername().isBlank()) {
            return Result.error(400, "用户名不能为空");
        }
        if (user.getPassword() == null || user.getPassword().length() < 6) {
            return Result.error(400, "密码长度不能少于6位");
        }
        // 限制可设置的角色
        String role = user.getRole();
        if (role != null && !role.isBlank()) {
            java.util.Set<String> validRoles = java.util.Set.of(
                    "admin", "管理员", "developer", "开发", "editor", "美术", "仓库", "运营", "user", "viewer");
            if (!validRoles.contains(role)) {
                return Result.error(400, "无效的角色: " + role);
            }
        }
        userService.create(user);
        return Result.success("用户创建成功");
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新用户信息")
    public Result<String> update(@PathVariable Long id, @RequestBody User user) {
        userService.update(id, user);
        return Result.success("用户信息更新成功");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除用户")
    public Result<String> delete(@PathVariable Long id) {
        userService.delete(id);
        return Result.success("用户删除成功");
    }

    @PutMapping("/{id}/role")
    @Operation(summary = "更新用户角色")
    public Result<String> updateRole(@PathVariable Long id, @RequestBody java.util.Map<String, String> body) {
        String role = body.get("role");
        if (role == null || role.isBlank()) {
            return Result.error(400, "角色不能为空");
        }
        java.util.List<String> validRoles = java.util.List.of("管理员", "admin", "开发", "developer", "美术", "artist", "仓库", "warehouse", "运营", "operator", "user");
        if (!validRoles.contains(role)) {
            return Result.error(400, "无效的角色，可选值：" + String.join(", ", validRoles));
        }
        userService.updateRole(id, role);
        return Result.success("角色更新成功");
    }
}
