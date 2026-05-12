package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.entity.Permission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface PermissionMapper extends BaseMapper<Permission> {

    @Select("SELECT p.* FROM permissions p " +
            "INNER JOIN role_permissions rp ON p.id = rp.permission_id " +
            "WHERE rp.role_id = #{roleId} ORDER BY p.id")
    List<Permission> selectPermissionsByRoleId(@Param("roleId") Integer roleId);

    @Select("<script>" +
            "SELECT DISTINCT p.* FROM permissions p " +
            "INNER JOIN role_permissions rp ON p.id = rp.permission_id " +
            "WHERE rp.role_id IN " +
            "<foreach collection='roleIds' item='roleId' open='(' separator=',' close=')'>" +
            "#{roleId}" +
            "</foreach>" +
            " ORDER BY p.id" +
            "</script>")
    List<Permission> selectPermissionsByRoleIds(@Param("roleIds") List<Integer> roleIds);

    @Select("SELECT p.* FROM permissions p " +
            "INNER JOIN role_permissions rp ON p.id = rp.permission_id " +
            "INNER JOIN roles r ON r.id = rp.role_id " +
            "INNER JOIN users u ON u.role = r.name " +
            "WHERE u.id = #{userId} ORDER BY p.id")
    List<Permission> selectPermissionsByUserId(@Param("userId") Long userId);
}
