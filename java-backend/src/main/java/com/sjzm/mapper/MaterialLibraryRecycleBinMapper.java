package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.entity.MaterialLibraryRecycleBin;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 素材库回收站 Mapper
 */
@Mapper
public interface MaterialLibraryRecycleBinMapper extends BaseMapper<MaterialLibraryRecycleBin> {

    /**
     * 根据SKU查询回收站记录
     */
    @Select("SELECT * FROM material_library_recycle_bin WHERE sku = #{sku} ORDER BY delete_time DESC LIMIT 1")
    MaterialLibraryRecycleBin selectBySku(@Param("sku") String sku);

    /**
     * 分页查询回收站记录
     */
    @Select("SELECT * FROM material_library_recycle_bin ORDER BY delete_time DESC")
    IPage<MaterialLibraryRecycleBin> selectPage(Page<MaterialLibraryRecycleBin> page);

    /**
     * 清理过期记录
     */
    @Select("DELETE FROM material_library_recycle_bin WHERE expires_at < NOW()")
    int deleteExpired();

    /**
     * 永久删除记录
     */
    @Select("DELETE FROM material_library_recycle_bin WHERE sku IN (#{skus})")
    int permanentDeleteBySkus(@Param("skus") String skus);
}
