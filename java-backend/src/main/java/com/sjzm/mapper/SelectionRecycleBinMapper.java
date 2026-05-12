package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.entity.SelectionRecycleBin;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 选品回收站 Mapper
 */
@Mapper
public interface SelectionRecycleBinMapper extends BaseMapper<SelectionRecycleBin> {

    /**
     * 根据原ID查询回收站记录
     */
    @Select("SELECT * FROM selection_recycle_bin WHERE original_id = #{originalId} ORDER BY deleted_at DESC LIMIT 1")
    SelectionRecycleBin selectByOriginalId(@Param("originalId") Long originalId);

    /**
     * 查询未过期的回收站记录
     */
    @Select("SELECT * FROM selection_recycle_bin WHERE expires_at > NOW() ORDER BY deleted_at DESC")
    List<SelectionRecycleBin> selectValidRecords();

    /**
     * 清理过期记录
     */
    @Select("DELETE FROM selection_recycle_bin WHERE expires_at < NOW()")
    int deleteExpired();
}
