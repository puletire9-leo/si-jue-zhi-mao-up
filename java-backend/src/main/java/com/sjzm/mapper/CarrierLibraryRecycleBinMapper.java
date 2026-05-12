package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.entity.CarrierLibraryRecycleBin;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 运营商库回收站 Mapper
 */
@Mapper
public interface CarrierLibraryRecycleBinMapper extends BaseMapper<CarrierLibraryRecycleBin> {

    /**
     * 根据SKU查询回收站记录
     */
    @Select("SELECT * FROM carrier_library_recycle_bin WHERE sku = #{sku} ORDER BY delete_time DESC LIMIT 1")
    CarrierLibraryRecycleBin selectBySku(@Param("sku") String sku);

    /**
     * 分页查询回收站记录
     */
    @Select("SELECT * FROM carrier_library_recycle_bin ORDER BY delete_time DESC")
    IPage<CarrierLibraryRecycleBin> selectPage(Page<CarrierLibraryRecycleBin> page);

    /**
     * 清理过期记录
     */
    @Select("DELETE FROM carrier_library_recycle_bin WHERE expires_at < NOW()")
    int deleteExpired();
}
