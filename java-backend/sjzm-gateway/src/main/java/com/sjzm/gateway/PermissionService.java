package com.sjzm.gateway;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
@ConfigurationProperties(prefix = "rbac")
public class PermissionService {

    private Map<String, List<String>> roles = new HashMap<>();
    private Map<String, String> routePermissions = new HashMap<>();

    public void setRoles(Map<String, List<String>> roles) {
        this.roles = roles;
    }

    public void setRoutePermissions(Map<String, String> routePermissions) {
        this.routePermissions = routePermissions;
    }

    @PostConstruct
    public void init() {
        log.info("RBAC 权限加载完成: 角色数={}, 路由权限数={}", roles.size(), routePermissions.size());
    }

    /**
     * 检查角色是否有指定权限（兼容多角色逗号分隔，如 "管理员,运营"）
     */
    public boolean hasPermission(String role, String permission) {
        if (role == null || permission == null) return false;

        // 支持多角色：按逗号拆分，任一子角色拥有权限即通过
        for (String subRole : role.split(",")) {
            subRole = subRole.trim();
            List<String> permissions = roles.get(subRole);
            if (permissions != null && !permissions.isEmpty()) {
                if (permissions.contains("*")) return true;
                if (permissions.contains(permission)) return true;
            }
        }
        return false;
    }

    /**
     * 根据请求路径获取所需权限
     */
    public String getRequiredPermission(String path) {
        // 精确匹配
        if (routePermissions.containsKey(path)) {
            return routePermissions.get(path);
        }
        // 通配符匹配
        for (Map.Entry<String, String> entry : routePermissions.entrySet()) {
            String pattern = entry.getKey();
            if (pattern.endsWith("/**")) {
                String prefix = pattern.substring(0, pattern.length() - 3);
                if (path.startsWith(prefix)) {
                    return entry.getValue();
                }
            }
        }
        return null;
    }
}
