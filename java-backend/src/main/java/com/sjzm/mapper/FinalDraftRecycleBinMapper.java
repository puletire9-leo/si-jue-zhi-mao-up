package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.entity.FinalDraftRecycleBin;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 定稿回收站 Mapper
 */
@Mapper
public interface FinalDraftRecycleBinMapper extends BaseMapper<FinalDraftRecycleBin> {

    /**
     * 根据SKU查询回收站记录
     */
    @Select("SELECT * FROM final_draft_recycle_bin WHERE sku = #{sku} ORDER BY delete_time DESC LIMIT 1")
    FinalDraftRecycleBin selectBySku(@Param("sku") String sku);

    /**
     * 分页查询回收站记录
     */
    @Select("SELECT * FROM final_draft_recycle_bin ORDER BY delete_time DESC")
    IPage<FinalDraftRecycleBin> selectPage(Page<FinalDraftRecycleBin> page);

    /**
     * 清理过期记录
     */
    @Select("DELETE FROM final_draft_recycle_bin WHERE expires_at < NOW()")
    int deleteExpired();
}
