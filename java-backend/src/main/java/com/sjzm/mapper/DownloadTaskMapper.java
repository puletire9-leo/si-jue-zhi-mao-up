package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.entity.DownloadTask;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 下载任务 Mapper
 */
@Mapper
public interface DownloadTaskMapper extends BaseMapper<DownloadTask> {

    /**
     * 根据用户ID查询任务
     */
    @Select("SELECT * FROM download_tasks WHERE user_id = #{userId} ORDER BY created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<DownloadTask> selectByUserId(@Param("userId") Long userId, @Param("limit") int limit, @Param("offset") int offset);

    /**
     * 查询所有任务（管理员）
     */
    @Select("SELECT * FROM download_tasks ORDER BY created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<DownloadTask> selectAll(@Param("limit") int limit, @Param("offset") int offset);
}
