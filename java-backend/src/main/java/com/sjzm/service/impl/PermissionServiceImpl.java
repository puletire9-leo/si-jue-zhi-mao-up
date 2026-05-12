package com.sjzm.service.impl;

import com.sjzm.entity.Permission;
import com.sjzm.entity.Role;
import com.sjzm.mapper.PermissionMapper;
import com.sjzm.mapper.RoleMapper;
import com.sjzm.service.PermissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PermissionServiceImpl implements PermissionService {

    private final RoleMapper roleMapper;
    private final PermissionMapper permissionMapper;

    @Override
    @Cacheable(value = "userPermissions", key = "#userId", unless = "#result == null || #result.isEmpty()")
    public List<Permission> getUserPermissions(Long userId) {
        log.info("查询用户权限: userId={}", userId);
        return permissionMapper.selectPermissionsByUserId(userId);
    }

    @Override
    public List<String> getUserPermissionCodes(Long userId) {
        List<Permission> permissions = getUserPermissions(userId);
        return permissions.stream()
                .map(Permission::getCode)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    @Override
    public List<Role> getRoleHierarchy(Integer roleId) {
        List<Role> hierarchy = new ArrayList<>();
        Integer currentRoleId = roleId;

        while (currentRoleId != null) {
            Role role = roleMapper.selectById(currentRoleId);
            if (role == null) {
                break;
            }
            hierarchy.add(role);
            currentRoleId = role.getParentId();
        }

        return hierarchy;
    }

    @Override
    public List<Role> getUserRoles(Long userId) {
        return roleMapper.selectRolesByUserId(userId);
    }

    @Override
    public List<Permission> getRolePermissions(Integer roleId) {
        return permissionMapper.selectPermissionsByRoleId(roleId);
    }

    @Override
    public List<Permission> getRolePermissionsWithInheritance(Integer roleId) {
        List<Role> hierarchy = getRoleHierarchy(roleId);
        List<Integer> roleIds = hierarchy.stream()
                .map(Role::getId)
                .collect(Collectors.toList());

        if (roleIds.isEmpty()) {
            return Collections.emptyList();
        }

        return permissionMapper.selectPermissionsByRoleIds(roleIds);
    }

    @Override
    public boolean hasPermission(Long userId, String permissionCode) {
        List<String> userPermissions = getUserPermissionCodes(userId);
        return userPermissions.contains(permissionCode);
    }

    @Override
    public boolean hasAnyPermission(Long userId, Set<String> permissionCodes) {
        List<String> userPermissions = getUserPermissionCodes(userId);
        return userPermissions.stream().anyMatch(permissionCodes::contains);
    }

    @Override
    public boolean hasAllPermissions(Long userId, Set<String> permissionCodes) {
        List<String> userPermissions = getUserPermissionCodes(userId);
        Set<String> userPermissionSet = new HashSet<>(userPermissions);
        return userPermissionSet.containsAll(permissionCodes);
    }
}
