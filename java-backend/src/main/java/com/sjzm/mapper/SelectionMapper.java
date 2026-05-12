package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.entity.Selection;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 选品 Mapper
 */
@Mapper
public interface SelectionMapper extends BaseMapper<Selection> {

    /**
     * 重置所有 is_current 标记为 0
     */
    @Update("UPDATE selection_products SET is_current = 0")
    int resetAllCurrentFlag();

    /**
     * 更新周标记
     */
    @Update("UPDATE selection_products SET week_tag = #{weekTag}, is_current = 1 WHERE created_at >= #{monday}")
    int updateWeekTag(String weekTag, LocalDateTime monday);

    /**
     * 导出选品数据
     */
    @Select("SELECT * FROM selection_products ORDER BY created_at DESC LIMIT #{size} OFFSET #{offset}")
    List<Selection> selectAllForExport(@Param("size") int size, @Param("offset") int offset);
}
