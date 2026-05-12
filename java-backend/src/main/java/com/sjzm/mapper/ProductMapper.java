package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.entity.Product;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 产品 Mapper
 */
@Mapper
public interface ProductMapper extends BaseMapper<Product> {

    /**
     * 根据 SKU 列表查询产品
     */
    @Select("<script>" +
            "SELECT * FROM products WHERE sku IN " +
            "<foreach item='item' index='index' collection='skus' open='(' separator=',' close=')'>" +
            "#{item}" +
            "</foreach>" +
            "</script>")
    List<Product> selectBySkus(@Param("skus") List<String> skus);

    /**
     * 根据 SKU 查询单个产品
     */
    @Select("SELECT * FROM products WHERE sku = #{sku} LIMIT 1")
    Product selectBySku(@Param("sku") String sku);

    /**
     * 导出产品数据
     */
    @Select("SELECT sku, name, type, description, category, tags, price, stock, image, create_time as createTime, update_time as updateTime " +
            "FROM products ORDER BY create_time DESC LIMIT #{size} OFFSET #{offset}")
    List<Product> selectAllForExport(@Param("size") int size, @Param("offset") int offset);

    /**
     * 获取所有产品（分页用）
     */
    @Select("SELECT * FROM products ORDER BY create_time DESC LIMIT #{limit} OFFSET #{offset}")
    List<Product> selectAllForProduct(@Param("limit") int limit, @Param("offset") int offset);
}
