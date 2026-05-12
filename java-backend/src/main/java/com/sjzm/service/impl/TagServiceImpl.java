package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.entity.Tag;
import com.sjzm.mapper.TagMapper;
import com.sjzm.service.TagService;
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
 * 标签服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
@CacheConfig(cacheNames = "tags")
public class TagServiceImpl implements TagService {

    private final TagMapper tagMapper;

    @Override
    public PageResult<Tag> listTags(int page, int size, String keyword, String type) {
        log.info("查询标签列表: page={}, size={}, keyword={}, type={}", page, size, keyword, type);

        // 1. 构建分页对象
        Page<Tag> pageParam = new Page<>(page, size);

        // 2. 构建查询条件
        LambdaQueryWrapper<Tag> wrapper = new LambdaQueryWrapper<>();

        // keyword 模糊匹配 name 字段
        if (StringUtils.hasText(keyword)) {
            wrapper.like(Tag::getName, keyword);
        }

        // type 精确匹配
        if (StringUtils.hasText(type)) {
            wrapper.eq(Tag::getType, type);
        }

        // 按 sortOrder 升序
        wrapper.orderByAsc(Tag::getSortOrder);

        // 3. 执行分页查询
        Page<Tag> tagPage = tagMapper.selectPage(pageParam, wrapper);

        // 4. 返回分页结果
        return PageResult.of(
                tagPage.getRecords(),
                tagPage.getTotal(),
                (long) page,
                (long) size
        );
    }

    @Override
    @Cacheable(key = "'all'")
    public List<Tag> listAllTags() {
        log.info("查询所有标签");

        LambdaQueryWrapper<Tag> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByAsc(Tag::getSortOrder);

        return tagMapper.selectList(wrapper);
    }

    @Override
    @Cacheable(key = "#id")
    public Tag getTagById(Long id) {
        log.info("查询标签: id={}", id);

        Tag tag = tagMapper.selectById(id);
        if (tag == null) {
            throw new BusinessException(404, "标签不存在");
        }
        return tag;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Tag createTag(Tag tag) {
        log.info("创建标签: name={}", tag.getName());

        // 1. 检查名称是否已存在
        if (StringUtils.hasText(tag.getName())) {
            LambdaQueryWrapper<Tag> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(Tag::getName, tag.getName());
            Long count = tagMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "标签名称已存在: " + tag.getName());
            }
        }

        // 2. 设置默认值
        if (!StringUtils.hasText(tag.getStatus())) {
            tag.setStatus("active");
        }

        // 3. 插入数据库
        tagMapper.insert(tag);

        return tag;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public Tag updateTag(Long id, Tag tag) {
        log.info("更新标签: id={}", id);

        // 1. 检查标签是否存在
        Tag existingTag = tagMapper.selectById(id);
        if (existingTag == null) {
            throw new BusinessException(404, "标签不存在");
        }

        // 2. 设置 ID
        tag.setId(id);

        // 3. 如果名称变更，检查新名称是否已存在
        if (StringUtils.hasText(tag.getName()) && !tag.getName().equals(existingTag.getName())) {
            LambdaQueryWrapper<Tag> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(Tag::getName, tag.getName());
            Long count = tagMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "标签名称已存在: " + tag.getName());
            }
        }

        // 4. 更新数据库
        tagMapper.updateById(tag);

        // 5. 返回更新后的标签
        return tagMapper.selectById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public void deleteTag(Long id) {
        log.info("删除标签: id={}", id);

        // 1. 检查标签是否存在
        Tag existingTag = tagMapper.selectById(id);
        if (existingTag == null) {
            throw new BusinessException(404, "标签不存在");
        }

        // 2. 逻辑删除（MyBatis-Plus @TableLogic 会自动处理）
        tagMapper.deleteById(id);
    }
}
