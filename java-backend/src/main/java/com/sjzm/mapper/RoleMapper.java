package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.entity.Role;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RoleMapper extends BaseMapper<Role> {

    @Select("SELECT * FROM roles WHERE name = #{name}")
    Role selectByName(String name);

    @Select("SELECT * FROM roles WHERE id = #{id}")
    Role selectById(Integer id);

    @Select("SELECT r.* FROM roles r " +
            "LEFT JOIN users u ON u.role = r.name " +
            "WHERE u.id = #{userId}")
    List<Role> selectRolesByUserId(Long userId);
}
