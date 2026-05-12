package com.sjzm.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.PageResult;
import com.sjzm.entity.Product;

import java.util.List;
import java.util.Map;

/**
 * 产品服务接口
 */
public interface ProductService {

    /**
     * 分页查询产品
     */
    PageResult<Product> listProducts(int page, int size, String keyword, String category, String type);

    /**
     * 根据ID获取产品
     */
    Product getProductById(Long id);

    /**
     * 根据SKU获取产品
     */
    Product getProductBySku(String sku);

    /**
     * 创建产品
     */
    Product createProduct(Product product);

    /**
     * 更新产品
     */
    Product updateProduct(Long id, Product product);

    /**
     * 删除产品
     */
    void deleteProduct(Long id);

    /**
     * 批量删除产品
     */
    Map<String, Object> batchDeleteProducts(List<Long> ids);

    /**
     * 批量导入产品
     */
    Map<String, Object> batchImportProducts(List<Product> products, boolean overwrite);

    /**
     * 获取产品统计
     */
    Map<String, Object> getProductStats();
}
