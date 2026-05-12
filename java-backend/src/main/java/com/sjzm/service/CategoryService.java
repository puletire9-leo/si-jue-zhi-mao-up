package com.sjzm.service;

import com.sjzm.common.PageResult;
import com.sjzm.entity.Category;

import java.util.List;

/**
 * 分类服务接口
 */
public interface CategoryService {

    /**
     * 分页查询分类
     */
    PageResult<Category> listCategories(int page, int size, String keyword);

    /**
     * 获取所有分类（树形）
     */
    List<Category> listAllCategories();

    /**
     * 根据ID获取分类
     */
    Category getCategoryById(Long id);

    /**
     * 创建分类
     */
    Category createCategory(Category category);

    /**
     * 更新分类
     */
    Category updateCategory(Long id, Category category);

    /**
     * 删除分类
     */
    void deleteCategory(Long id);
}
