package com.sjzm.service;

import com.sjzm.entity.Permission;
import com.sjzm.entity.Role;

import java.util.List;
import java.util.Set;

public interface PermissionService {

    List<Permission> getUserPermissions(Long userId);

    List<String> getUserPermissionCodes(Long userId);

    List<Role> getRoleHierarchy(Integer roleId);

    List<Role> getUserRoles(Long userId);

    List<Permission> getRolePermissions(Integer roleId);

    List<Permission> getRolePermissionsWithInheritance(Integer roleId);

    boolean hasPermission(Long userId, String permissionCode);

    boolean hasAnyPermission(Long userId, Set<String> permissionCodes);

    boolean hasAllPermissions(Long userId, Set<String> permissionCodes);
}
