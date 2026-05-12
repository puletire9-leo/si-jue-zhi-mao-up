package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.entity.Selection;
import com.sjzm.entity.SelectionRecycleBin;
import com.sjzm.mapper.SelectionMapper;
import com.sjzm.mapper.SelectionRecycleBinMapper;
import com.sjzm.service.SelectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 选品服务实现（对齐 Python 的 selection_service.py）
 * 
 * 软删除机制：
 * 1. 删除选品时，将数据保存到 selection_recycle_bin 表
 * 2. 从 selection_products 表物理删除该记录
 * 3. 恢复时，从 selection_recycle_bin 恢复到 selection_products
 * 
 * 排序规则（对齐 Python）：
 * - 本周数据优先（is_current DESC）
 * - 按评分降序（score DESC）
 * - 按创建时间降序（created_at DESC）
 */
@Slf4j
@Service
@RequiredArgsConstructor
@CacheConfig(cacheNames = "selections")
public class SelectionServiceImpl implements SelectionService {

    private final SelectionMapper selectionMapper;
    private final SelectionRecycleBinMapper selectionRecycleBinMapper;
    private final ObjectMapper objectMapper;

    /** 回收站过期天数 */
    private static final int RECYCLE_EXPIRE_DAYS = 30;

    @Override
    public PageResult<Selection> listSelections(int page, int size, String keyword, String productType,
                                                 String source, String country, String dataFilterMode) {
        log.info("查询选品列表: page={}, size={}, keyword={}, productType={}", page, size, keyword, productType);

        // 1. 构建分页对象
        Page<Selection> pageParam = new Page<>(page, size);

        // 2. 构建查询条件
        LambdaQueryWrapper<Selection> wrapper = new LambdaQueryWrapper<>();

        // keyword 模糊匹配 productTitle 和 asin 字段
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(Selection::getProductTitle, keyword)
                    .or()
                    .like(Selection::getAsin, keyword));
        }

        // productType 精确匹配（新品榜/参考产品）
        if (StringUtils.hasText(productType)) {
            wrapper.eq(Selection::getProductType, productType);
        }

        // source 精确匹配（对齐 Python：支持模糊匹配）
        if (StringUtils.hasText(source)) {
            wrapper.like(Selection::getSource, source);
        }

        // country 精确匹配
        if (StringUtils.hasText(country)) {
            wrapper.eq(Selection::getCountry, country);
        }

        // dataFilterMode 精确匹配
        if (StringUtils.hasText(dataFilterMode)) {
            wrapper.eq(Selection::getDataFilterMode, dataFilterMode);
        }

        // 排序（对齐 Python：本周优先 + 评分降序 + 创建时间降序）
        wrapper.orderByDesc(Selection::getIsCurrent)
               .orderByDesc(Selection::getScore)
               .orderByDesc(Selection::getCreatedAt);

        // 3. 执行分页查询
        Page<Selection> selectionPage = selectionMapper.selectPage(pageParam, wrapper);

        // 4. 返回分页结果
        return PageResult.of(
                selectionPage.getRecords(),
                selectionPage.getTotal(),
                (long) page,
                (long) size
        );
    }

    @Override
    @Cacheable(key = "#id")
    public Selection getSelectionById(Long id) {
        log.info("查询选品: id={}", id);

        Selection selection = selectionMapper.selectById(id);
        if (selection == null) {
            throw new BusinessException(404, "选品不存在");
        }
        return selection;
    }

    @Override
    @Cacheable(key = "'asin:' + #asin")
    public Selection getSelectionByAsin(String asin) {
        log.info("查询选品: asin={}", asin);

        LambdaQueryWrapper<Selection> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Selection::getAsin, asin);
        Selection selection = selectionMapper.selectOne(wrapper);

        if (selection == null) {
            throw new BusinessException(404, "选品不存在");
        }
        return selection;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Selection createSelection(Selection selection) {
        log.info("创建选品: asin={}", selection.getAsin());

        // 1. 检查 ASIN 是否已存在
        if (StringUtils.hasText(selection.getAsin())) {
            LambdaQueryWrapper<Selection> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(Selection::getAsin, selection.getAsin());
            Long count = selectionMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "ASIN 已存在: " + selection.getAsin());
            }
        }

        // 2. 设置默认值（对齐 Python）
        if (!StringUtils.hasText(selection.getProductType())) {
            selection.setProductType(Selection.TYPE_NEW);
        }
        if (selection.getScore() == null) {
            selection.setScore(0);
        }
        if (!StringUtils.hasText(selection.getGrade())) {
            selection.setGrade("C");
        }
        if (selection.getIsCurrent() == null) {
            selection.setIsCurrent(0);
        }

        // 3. 插入数据库
        selectionMapper.insert(selection);

        return selection;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public Selection updateSelection(Long id, Selection selection) {
        log.info("更新选品: id={}", id);

        // 1. 检查选品是否存在
        Selection existingSelection = selectionMapper.selectById(id);
        if (existingSelection == null) {
            throw new BusinessException(404, "选品不存在");
        }

        // 2. 设置 ID
        selection.setId(id);

        // 3. 如果 ASIN 变更，检查新 ASIN 是否已存在
        if (StringUtils.hasText(selection.getAsin()) && !selection.getAsin().equals(existingSelection.getAsin())) {
            LambdaQueryWrapper<Selection> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(Selection::getAsin, selection.getAsin());
            Long count = selectionMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "ASIN 已存在: " + selection.getAsin());
            }
        }

        // 4. 更新数据库
        selectionMapper.updateById(selection);

        // 5. 返回更新后的选品
        return selectionMapper.selectById(id);
    }

    /**
     * 删除选品（对齐 Python 的软删除逻辑）
     * 
     * 流程：
     * 1. 将选品数据保存到 selection_recycle_bin 表
     * 2. 从 selection_products 表物理删除该记录
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public void deleteSelection(Long id) {
        log.info("删除选品: id={}", id);

        // 1. 检查选品是否存在
        Selection existingSelection = selectionMapper.selectById(id);
        if (existingSelection == null) {
            throw new BusinessException(404, "选品不存在");
        }

        // 2. 保存到回收站（对齐 Python）
        SelectionRecycleBin recycleBin = new SelectionRecycleBin();
        recycleBin.setOriginalId(existingSelection.getId());
        recycleBin.setAsin(existingSelection.getAsin());
        recycleBin.setProductTitle(existingSelection.getProductTitle());
        recycleBin.setPrice(existingSelection.getPrice());
        recycleBin.setImageUrl(existingSelection.getImageUrl());
        recycleBin.setLocalPath(existingSelection.getLocalPath());
        recycleBin.setThumbPath(existingSelection.getThumbPath());
        recycleBin.setStoreName(existingSelection.getStoreName());
        recycleBin.setStoreUrl(existingSelection.getStoreUrl());
        recycleBin.setShopId(existingSelection.getShopId());
        recycleBin.setMainCategoryName(existingSelection.getMainCategoryName());
        recycleBin.setMainCategoryRank(existingSelection.getMainCategoryRank());
        recycleBin.setMainCategoryBsrGrowth(existingSelection.getMainCategoryBsrGrowth());
        recycleBin.setMainCategoryBsrGrowthRate(existingSelection.getMainCategoryBsrGrowthRate());
        recycleBin.setTags(existingSelection.getTags());
        recycleBin.setNotes(existingSelection.getNotes());
        recycleBin.setProductLink(existingSelection.getProductLink());
        recycleBin.setSalesVolume(existingSelection.getSalesVolume());
        recycleBin.setListingDate(existingSelection.getListingDate());
        recycleBin.setDeliveryMethod(existingSelection.getDeliveryMethod());
        recycleBin.setSimilarProducts(existingSelection.getSimilarProducts());
        recycleBin.setSource(existingSelection.getSource());
        recycleBin.setCountry(existingSelection.getCountry());
        recycleBin.setDataFilterMode(existingSelection.getDataFilterMode());
        recycleBin.setProductType(existingSelection.getProductType());
        recycleBin.setScore(existingSelection.getScore());
        recycleBin.setGrade(existingSelection.getGrade());
        recycleBin.setWeekTag(existingSelection.getWeekTag());
        recycleBin.setIsCurrent(existingSelection.getIsCurrent());
        recycleBin.setDeletedAt(LocalDateTime.now());
        recycleBin.setExpiresAt(LocalDateTime.now().plusDays(RECYCLE_EXPIRE_DAYS));
        recycleBin.setDeletedBy(1L); // TODO: 从上下文获取当前用户ID
        
        // 保存原始数据为 JSON
        try {
            recycleBin.setOriginalData(objectMapper.writeValueAsString(existingSelection));
        } catch (Exception e) {
            log.warn("序列化选品数据失败: {}", e.getMessage());
        }
        
        selectionRecycleBinMapper.insert(recycleBin);

        // 3. 物理删除原记录（对齐 Python）
        selectionMapper.deleteById(id);

        log.info("选品已移入回收站: asin={}, recycleId={}", existingSelection.getAsin(), recycleBin.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchDeleteSelections(List<Long> ids) {
        log.info("批量删除选品: ids={}", ids);

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (Long id : ids) {
            try {
                deleteSelection(id);
                success++;
            } catch (BusinessException e) {
                failed++;
                errors.add("ID " + id + ": " + e.getMessage());
            } catch (Exception e) {
                failed++;
                errors.add("ID " + id + ": " + e.getMessage());
                log.error("删除选品失败: id={}", id, e);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchImportSelections(List<Selection> selections, boolean overwrite) {
        log.info("批量导入选品: count={}, overwrite={}", selections.size(), overwrite);

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (Selection selection : selections) {
            try {
                // 检查 ASIN 是否已存在
                if (StringUtils.hasText(selection.getAsin())) {
                    LambdaQueryWrapper<Selection> wrapper = new LambdaQueryWrapper<>();
                    wrapper.eq(Selection::getAsin, selection.getAsin());
                    Selection existingSelection = selectionMapper.selectOne(wrapper);

                    if (existingSelection != null) {
                        if (overwrite) {
                            // 更新现有选品
                            selection.setId(existingSelection.getId());
                            selectionMapper.updateById(selection);
                            success++;
                        } else {
                            // 跳过
                            failed++;
                            errors.add("ASIN " + selection.getAsin() + ": 已存在，已跳过");
                        }
                        continue;
                    }
                }

                // 设置默认值
                if (!StringUtils.hasText(selection.getProductType())) {
                    selection.setProductType(Selection.TYPE_NEW);
                }
                if (selection.getScore() == null) {
                    selection.setScore(0);
                }
                if (!StringUtils.hasText(selection.getGrade())) {
                    selection.setGrade("C");
                }
                if (selection.getIsCurrent() == null) {
                    selection.setIsCurrent(0);
                }

                // 插入选品
                selectionMapper.insert(selection);
                success++;

            } catch (Exception e) {
                failed++;
                errors.add("ASIN " + selection.getAsin() + ": " + e.getMessage());
                log.error("导入选品失败: asin={}", selection.getAsin(), e);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);
        return result;
    }

    @Override
    public Map<String, Object> getSelectionStats() {
        log.info("获取选品统计");

        // 统计总选品数
        Long totalCount = selectionMapper.selectCount(null);

        // 统计新品数
        LambdaQueryWrapper<Selection> newWrapper = new LambdaQueryWrapper<>();
        newWrapper.eq(Selection::getProductType, Selection.TYPE_NEW);
        Long newCount = selectionMapper.selectCount(newWrapper);

        // 统计参考产品数
        LambdaQueryWrapper<Selection> refWrapper = new LambdaQueryWrapper<>();
        refWrapper.eq(Selection::getProductType, Selection.TYPE_REFERENCE);
        Long refCount = selectionMapper.selectCount(refWrapper);

        // 统计本周数据
        LambdaQueryWrapper<Selection> currentWrapper = new LambdaQueryWrapper<>();
        currentWrapper.eq(Selection::getIsCurrent, 1);
        Long currentCount = selectionMapper.selectCount(currentWrapper);

        // 统计各等级数量
        List<Selection> allSelections = selectionMapper.selectList(null);
        Map<String, Long> gradeCount = new HashMap<>();
        for (Selection s : allSelections) {
            String grade = s.getGrade();
            if (grade != null) {
                gradeCount.put(grade, gradeCount.getOrDefault(grade, 0L) + 1);
            }
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", totalCount);
        stats.put("newProducts", newCount);
        stats.put("referenceProducts", refCount);
        stats.put("currentWeek", currentCount);
        stats.put("gradeDistribution", gradeCount);

        return stats;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchUpdateSelections(List<Selection> selections) {
        log.info("批量更新选品: count={}", selections.size());

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (Selection selection : selections) {
            try {
                if (selection.getId() == null && !StringUtils.hasText(selection.getAsin())) {
                    failed++;
                    errors.add("选品缺少ID或ASIN");
                    continue;
                }

                Selection existingSelection = null;
                if (selection.getId() != null) {
                    existingSelection = selectionMapper.selectById(selection.getId());
                } else {
                    LambdaQueryWrapper<Selection> wrapper = new LambdaQueryWrapper<>();
                    wrapper.eq(Selection::getAsin, selection.getAsin());
                    existingSelection = selectionMapper.selectOne(wrapper);
                }

                if (existingSelection == null) {
                    failed++;
                    errors.add("ASIN " + selection.getAsin() + ": 未找到");
                    continue;
                }

                // 更新非空字段
                updateSelectionFields(existingSelection, selection);
                existingSelection.setUpdatedAt(LocalDateTime.now());

                selectionMapper.updateById(existingSelection);
                success++;
                log.debug("更新选品成功: id={}, asin={}", existingSelection.getId(), existingSelection.getAsin());

            } catch (Exception e) {
                failed++;
                errors.add("ASIN " + selection.getAsin() + ": " + e.getMessage());
                log.error("更新选品失败: asin={}", selection.getAsin(), e);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors.size() > 10 ? errors.subList(0, 10) : errors);

        log.info("批量更新选品完成: 成功={}, 失败={}", success, failed);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchUpdateTags(List<Long> ids, String tags) {
        log.info("批量更新选品标签: ids={}, tags={}", ids.size(), tags);

        if (ids == null || ids.isEmpty()) {
            throw new BusinessException("ID列表不能为空");
        }

        int updated = 0;
        for (Long id : ids) {
            Selection selection = selectionMapper.selectById(id);
            if (selection != null) {
                selection.setTags(tags);
                selection.setUpdatedAt(LocalDateTime.now());
                selectionMapper.updateById(selection);
                updated++;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("updated", updated);
        result.put("total", ids.size());

        log.info("批量更新标签完成: 更新={}", updated);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchUpdateNotes(List<Long> ids, String notes) {
        log.info("批量更新选品备注: ids={}", ids.size());

        if (ids == null || ids.isEmpty()) {
            throw new BusinessException("ID列表不能为空");
        }

        int updated = 0;
        for (Long id : ids) {
            Selection selection = selectionMapper.selectById(id);
            if (selection != null) {
                selection.setNotes(notes);
                selection.setUpdatedAt(LocalDateTime.now());
                selectionMapper.updateById(selection);
                updated++;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("updated", updated);
        result.put("total", ids.size());

        log.info("批量更新备注完成: 更新={}", updated);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchUpdateScores(List<Long> ids, Double score, String grade) {
        log.info("批量更新选品评分: ids={}, score={}, grade={}", ids.size(), score, grade);

        if (ids == null || ids.isEmpty()) {
            throw new BusinessException("ID列表不能为空");
        }

        int updated = 0;
        for (Long id : ids) {
            Selection selection = selectionMapper.selectById(id);
            if (selection != null) {
                if (score != null) {
                    selection.setScore(score.intValue());
                }
                if (StringUtils.hasText(grade)) {
                    selection.setGrade(grade);
                }
                selection.setUpdatedAt(LocalDateTime.now());
                selectionMapper.updateById(selection);
                updated++;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("updated", updated);
        result.put("total", ids.size());

        log.info("批量更新评分完成: 更新={}", updated);
        return result;
    }

    private void updateSelectionFields(Selection existing, Selection updates) {
        if (StringUtils.hasText(updates.getProductTitle())) {
            existing.setProductTitle(updates.getProductTitle());
        }
        if (updates.getPrice() != null) {
            existing.setPrice(updates.getPrice());
        }
        if (StringUtils.hasText(updates.getImageUrl())) {
            existing.setImageUrl(updates.getImageUrl());
        }
        if (StringUtils.hasText(updates.getLocalPath())) {
            existing.setLocalPath(updates.getLocalPath());
        }
        if (StringUtils.hasText(updates.getThumbPath())) {
            existing.setThumbPath(updates.getThumbPath());
        }
        if (StringUtils.hasText(updates.getStoreName())) {
            existing.setStoreName(updates.getStoreName());
        }
        if (StringUtils.hasText(updates.getStoreUrl())) {
            existing.setStoreUrl(updates.getStoreUrl());
        }
        if (StringUtils.hasText(updates.getMainCategoryName())) {
            existing.setMainCategoryName(updates.getMainCategoryName());
        }
        if (updates.getMainCategoryRank() != null) {
            existing.setMainCategoryRank(updates.getMainCategoryRank());
        }
        if (updates.getMainCategoryBsrGrowth() != null) {
            existing.setMainCategoryBsrGrowth(updates.getMainCategoryBsrGrowth());
        }
        if (updates.getMainCategoryBsrGrowthRate() != null) {
            existing.setMainCategoryBsrGrowthRate(updates.getMainCategoryBsrGrowthRate());
        }
        if (StringUtils.hasText(updates.getTags())) {
            existing.setTags(updates.getTags());
        }
        if (StringUtils.hasText(updates.getNotes())) {
            existing.setNotes(updates.getNotes());
        }
        if (StringUtils.hasText(updates.getProductLink())) {
            existing.setProductLink(updates.getProductLink());
        }
        if (updates.getSalesVolume() != null) {
            existing.setSalesVolume(updates.getSalesVolume());
        }
        if (updates.getListingDate() != null) {
            existing.setListingDate(updates.getListingDate());
        }
        if (updates.getListingDays() != null) {
            existing.setListingDays(updates.getListingDays());
        }
        if (StringUtils.hasText(updates.getDeliveryMethod())) {
            existing.setDeliveryMethod(updates.getDeliveryMethod());
        }
        if (StringUtils.hasText(updates.getSimilarProducts())) {
            existing.setSimilarProducts(updates.getSimilarProducts());
        }
        if (StringUtils.hasText(updates.getSource())) {
            existing.setSource(updates.getSource());
        }
        if (StringUtils.hasText(updates.getCountry())) {
            existing.setCountry(updates.getCountry());
        }
        if (StringUtils.hasText(updates.getDataFilterMode())) {
            existing.setDataFilterMode(updates.getDataFilterMode());
        }
        if (StringUtils.hasText(updates.getProductType())) {
            existing.setProductType(updates.getProductType());
        }
        if (updates.getScore() != null) {
            existing.setScore(updates.getScore());
        }
        if (StringUtils.hasText(updates.getGrade())) {
            existing.setGrade(updates.getGrade());
        }
        if (StringUtils.hasText(updates.getWeekTag())) {
            existing.setWeekTag(updates.getWeekTag());
        }
        if (updates.getIsCurrent() != null) {
            existing.setIsCurrent(updates.getIsCurrent());
        }
    }
}
