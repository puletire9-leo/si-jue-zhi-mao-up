package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.entity.ImageVector;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 图片向量 Mapper
 */
@Mapper
public interface ImageVectorMapper extends BaseMapper<ImageVector> {

    /**
     * 根据图片ID查询
     */
    @Select("SELECT * FROM image_vectors WHERE image_id = #{imageId} LIMIT 1")
    ImageVector selectByImageId(@Param("imageId") Long imageId);

    /**
     * 根据SKU查询
     */
    @Select("SELECT * FROM image_vectors WHERE sku = #{sku} LIMIT 1")
    ImageVector selectBySku(@Param("sku") String sku);

    /**
     * 查询待索引向量
     */
    @Select("SELECT * FROM image_vectors WHERE status = 'pending' ORDER BY created_at ASC LIMIT #{limit}")
    List<ImageVector> selectPendingVectors(@Param("limit") int limit);

    /**
     * 查询已索引向量
     */
    @Select("SELECT * FROM image_vectors WHERE status = 'indexed' ORDER BY updated_at DESC LIMIT #{limit}")
    List<ImageVector> selectIndexedVectors(@Param("limit") int limit);
}
