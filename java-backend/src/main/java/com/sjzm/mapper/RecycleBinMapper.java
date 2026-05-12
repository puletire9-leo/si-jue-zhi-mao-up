package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.entity.RecycleBin;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 产品回收站 Mapper
 */
@Mapper
public interface RecycleBinMapper extends BaseMapper<RecycleBin> {

    /**
     * 根据SKU查询回收站记录
     */
    @Select("SELECT * FROM recycle_bin WHERE product_sku = #{sku} ORDER BY deleted_at DESC LIMIT 1")
    RecycleBin selectBySku(@Param("sku") String sku);

    /**
     * 查询未过期的回收站记录
     */
    @Select("SELECT * FROM recycle_bin WHERE expires_at > NOW() ORDER BY deleted_at DESC")
    List<RecycleBin> selectValidRecords();

    /**
     * 清理过期记录
     */
    @Select("DELETE FROM recycle_bin WHERE expires_at < NOW()")
    int deleteExpired();
}
