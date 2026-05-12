package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.entity.Category;
import com.sjzm.mapper.CategoryMapper;
import com.sjzm.service.CategoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * 分类服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
@CacheConfig(cacheNames = "categories")
public class CategoryServiceImpl implements CategoryService {

    private final CategoryMapper categoryMapper;

    @Override
    public PageResult<Category> listCategories(int page, int size, String keyword) {
        log.info("查询分类列表: page={}, size={}, keyword={}", page, size, keyword);

        // 1. 构建分页对象
        Page<Category> pageParam = new Page<>(page, size);

        // 2. 构建查询条件
        LambdaQueryWrapper<Category> wrapper = new LambdaQueryWrapper<>();

        // keyword 模糊匹配 name 字段
        if (StringUtils.hasText(keyword)) {
            wrapper.like(Category::getName, keyword);
        }

        // 按 sortOrder 升序, parentId 升序
        wrapper.orderByAsc(Category::getSortOrder, Category::getParentId);

        // 3. 执行分页查询
        Page<Category> categoryPage = categoryMapper.selectPage(pageParam, wrapper);

        // 4. 返回分页结果
        return PageResult.of(
                categoryPage.getRecords(),
                categoryPage.getTotal(),
                (long) page,
                (long) size
        );
    }

    @Override
    @Cacheable(key = "'all'")
    public List<Category> listAllCategories() {
        log.info("查询所有分类");

        LambdaQueryWrapper<Category> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByAsc(Category::getSortOrder, Category::getParentId);

        return categoryMapper.selectList(wrapper);
    }

    @Override
    @Cacheable(key = "#id")
    public Category getCategoryById(Long id) {
        log.info("查询分类: id={}", id);

        Category category = categoryMapper.selectById(id);
        if (category == null) {
            throw new BusinessException(404, "分类不存在");
        }
        return category;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Category createCategory(Category category) {
        log.info("创建分类: name={}", category.getName());

        // 1. 检查名称是否已存在
        if (StringUtils.hasText(category.getName())) {
            LambdaQueryWrapper<Category> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(Category::getName, category.getName());
            Long count = categoryMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "分类名称已存在: " + category.getName());
            }
        }

        // 2. 设置默认值
        if (!StringUtils.hasText(category.getStatus())) {
            category.setStatus("active");
        }

        // 3. 插入数据库
        categoryMapper.insert(category);

        return category;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public Category updateCategory(Long id, Category category) {
        log.info("更新分类: id={}", id);

        // 1. 检查分类是否存在
        Category existingCategory = categoryMapper.selectById(id);
        if (existingCategory == null) {
            throw new BusinessException(404, "分类不存在");
        }

        // 2. 设置 ID
        category.setId(id);

        // 3. 如果名称变更，检查新名称是否已存在
        if (StringUtils.hasText(category.getName()) && !category.getName().equals(existingCategory.getName())) {
            LambdaQueryWrapper<Category> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(Category::getName, category.getName());
            Long count = categoryMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "分类名称已存在: " + category.getName());
            }
        }

        // 4. 更新数据库
        categoryMapper.updateById(category);

        // 5. 返回更新后的分类
        return categoryMapper.selectById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public void deleteCategory(Long id) {
        log.info("删除分类: id={}", id);

        // 1. 检查分类是否存在
        Category existingCategory = categoryMapper.selectById(id);
        if (existingCategory == null) {
            throw new BusinessException(404, "分类不存在");
        }

        // 2. 逻辑删除（MyBatis-Plus @TableLogic 会自动处理）
        categoryMapper.deleteById(id);
    }
}
