package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.entity.RolePermission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RolePermissionMapper extends BaseMapper<RolePermission> {

    @Select("SELECT permission_id FROM role_permissions WHERE role_id = #{roleId}")
    List<Integer> selectPermissionIdsByRoleId(@Param("roleId") Integer roleId);

    @Select("<script>" +
            "SELECT permission_id FROM role_permissions " +
            "WHERE role_id IN " +
            "<foreach collection='roleIds' item='roleId' open='(' separator=',' close=')'>" +
            "#{roleId}" +
            "</foreach>" +
            "</script>")
    List<Integer> selectPermissionIdsByRoleIds(@Param("roleIds") List<Integer> roleIds);
}
