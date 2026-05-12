package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.entity.Image;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Delete;

import java.util.List;

/**
 * 图片 Mapper
 */
@Mapper
public interface ImageMapper extends BaseMapper<Image> {

    /**
     * 导出图片数据
     */
    @Select("SELECT id, filename, filepath, category, tags, description, width, height, format, file_size, created_at " +
            "FROM images ORDER BY created_at DESC LIMIT #{size} OFFSET #{offset}")
    List<Image> selectAllForExport(@Param("size") int size, @Param("offset") int offset);

    /**
     * 分页查询图片列表
     */
    @Select("<script>" +
            "SELECT * FROM images WHERE 1=1 " +
            "<if test='keyword != null and keyword != \"\"'> AND (filename LIKE CONCAT('%', #{keyword}, '%') OR description LIKE CONCAT('%', #{keyword}, '%') OR tags LIKE CONCAT('%', #{keyword}, '%')) </if>" +
            "<if test='category != null and category != \"\"'> AND category = #{category} </if>" +
            "ORDER BY created_at DESC" +
            "</script>")
    IPage<Image> selectPageByKeyword(Page<Image> page, @Param("keyword") String keyword, @Param("category") String category);

    /**
     * 根据分类查询图片列表
     */
    @Select("SELECT * FROM images WHERE category = #{category} ORDER BY created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<Image> selectByCategory(@Param("category") String category, @Param("limit") int limit, @Param("offset") int offset);

    /**
     * 获取所有产品图片（分页）
     */
    @Select("SELECT * FROM images ORDER BY created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<Image> selectAllForProduct(@Param("limit") int limit, @Param("offset") int offset);

    /**
     * 根据分类统计数量
     */
    @Select("SELECT COUNT(*) FROM images WHERE category = #{category}")
    Long countByCategory(@Param("category") String category);

    /**
     * 统计总数
     */
    @Select("SELECT COUNT(*) FROM images")
    Long countAll();

    /**
     * 根据SKU列表查询
     */
    @Select("<script>SELECT * FROM images WHERE sku IN " +
            "<foreach item='item' index='index' collection='skus' open='(' separator=',' close=')'>" +
            "#{item}" +
            "</foreach> ORDER BY created_at DESC</script>")
    List<Image> selectBySkus(@Param("skus") List<String> skus);

    /**
     * 更新标签
     */
    @Update("UPDATE images SET tags = #{tags}, updated_at = NOW() WHERE id = #{id}")
    int updateTags(@Param("id") Long id, @Param("tags") String tags);

    /**
     * 更新描述
     */
    @Update("UPDATE images SET description = #{description}, updated_at = NOW() WHERE id = #{id}")
    int updateDescription(@Param("id") Long id, @Param("description") String description);

    /**
     * 更新分类
     */
    @Update("UPDATE images SET category = #{category}, updated_at = NOW() WHERE id = #{id}")
    int updateCategory(@Param("id") Long id, @Param("category") String category);

    /**
     * 批量更新URL（修复//开头等问题）
     */
    @Update("<script>" +
            "UPDATE images SET url = CASE " +
            "<foreach item='item' collection='images'>" +
            "WHEN id = #{item.id} THEN #{item.url} " +
            "</foreach>" +
            "END WHERE id IN " +
            "<foreach item='item' collection='images' open='(' separator=',' close=')'>" +
            "#{item.id}" +
            "</foreach>" +
            "</script>")
    int batchUpdateUrl(@Param("images") List<Image> images);

    /**
     * 批量删除
     */
    @Delete("<script>" +
            "DELETE FROM images WHERE id IN " +
            "<foreach item='id' collection='ids' open='(' separator=',' close=')'>" +
            "#{id}" +
            "</foreach>" +
            "</script>")
    int batchDeleteByIds(@Param("ids") List<Long> ids);
}
