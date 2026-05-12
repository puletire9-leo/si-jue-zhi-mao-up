package com.sjzm.service;

import com.sjzm.common.PageResult;
import com.sjzm.entity.Tag;

import java.util.List;

/**
 * 标签服务接口
 */
public interface TagService {

    /**
     * 分页查询标签
     */
    PageResult<Tag> listTags(int page, int size, String keyword, String type);

    /**
     * 获取所有标签
     */
    List<Tag> listAllTags();

    /**
     * 根据ID获取标签
     */
    Tag getTagById(Long id);

    /**
     * 创建标签
     */
    Tag createTag(Tag tag);

    /**
     * 更新标签
     */
    Tag updateTag(Long id, Tag tag);

    /**
     * 删除标签
     */
    void deleteTag(Long id);
}
