package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.entity.FinalDraft;
import com.sjzm.entity.FinalDraftRecycleBin;
import com.sjzm.mapper.FinalDraftMapper;
import com.sjzm.mapper.FinalDraftRecycleBinMapper;
import com.sjzm.service.FinalDraftService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 定稿服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
@CacheConfig(cacheNames = "finalDrafts")
public class FinalDraftServiceImpl implements FinalDraftService {

    private final FinalDraftMapper finalDraftMapper;
    private final FinalDraftRecycleBinMapper recycleBinMapper;

    private static final int RECYCLE_BIN_EXPIRE_DAYS = 30;

    @Override
    public PageResult<FinalDraft> listFinalDrafts(int page, int size, String searchType, String searchContent,
                                                   List<String> developers, List<String> statuses, List<String> carriers) {
        log.info("查询定稿列表: page={}, size={}, searchType={}, searchContent={}, developers={}, statuses={}, carriers={}",
                page, size, searchType, searchContent, developers, statuses, carriers);

        Page<FinalDraft> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<FinalDraft> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(searchContent) && StringUtils.hasText(searchType)) {
            switch (searchType) {
                case "sku":
                    wrapper.like(FinalDraft::getSku, searchContent);
                    break;
                case "batch":
                    wrapper.like(FinalDraft::getBatch, searchContent);
                    break;
                case "developer":
                    wrapper.like(FinalDraft::getDeveloper, searchContent);
                    break;
                default:
                    break;
            }
        }

        if (!CollectionUtils.isEmpty(developers)) {
            wrapper.in(FinalDraft::getDeveloper, developers);
        }

        if (!CollectionUtils.isEmpty(statuses)) {
            wrapper.in(FinalDraft::getStatus, statuses);
        }

        if (!CollectionUtils.isEmpty(carriers)) {
            wrapper.in(FinalDraft::getCarrier, carriers);
        }

        wrapper.orderByDesc(FinalDraft::getCreateTime);
        Page<FinalDraft> draftPage = finalDraftMapper.selectPage(pageParam, wrapper);

        return PageResult.of(
                draftPage.getRecords(),
                draftPage.getTotal(),
                (long) page,
                (long) size
        );
    }

    @Override
    @Cacheable(key = "#id")
    public FinalDraft getFinalDraftById(Long id) {
        log.info("查询定稿: id={}", id);

        FinalDraft finalDraft = finalDraftMapper.selectById(id);
        if (finalDraft == null) {
            throw new BusinessException(404, "定稿不存在");
        }
        return finalDraft;
    }

    @Override
    @Cacheable(key = "'sku:' + #sku")
    public FinalDraft getFinalDraftBySku(String sku) {
        log.info("查询定稿: sku={}", sku);

        LambdaQueryWrapper<FinalDraft> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(FinalDraft::getSku, sku);
        FinalDraft finalDraft = finalDraftMapper.selectOne(wrapper);

        if (finalDraft == null) {
            throw new BusinessException(404, "定稿不存在");
        }
        return finalDraft;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public FinalDraft createFinalDraft(FinalDraft finalDraft) {
        log.info("创建定稿: sku={}", finalDraft.getSku());

        if (StringUtils.hasText(finalDraft.getSku())) {
            LambdaQueryWrapper<FinalDraft> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(FinalDraft::getSku, finalDraft.getSku());
            Long count = finalDraftMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "SKU 已存在: " + finalDraft.getSku());
            }
        }

        if (!StringUtils.hasText(finalDraft.getStatus())) {
            finalDraft.setStatus("concept");
        }

        finalDraftMapper.insert(finalDraft);
        return finalDraft;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public FinalDraft updateFinalDraft(Long id, FinalDraft finalDraft) {
        log.info("更新定稿: id={}", id);

        FinalDraft existingDraft = finalDraftMapper.selectById(id);
        if (existingDraft == null) {
            throw new BusinessException(404, "定稿不存在");
        }

        finalDraft.setId(id);

        if (StringUtils.hasText(finalDraft.getSku()) && !finalDraft.getSku().equals(existingDraft.getSku())) {
            LambdaQueryWrapper<FinalDraft> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(FinalDraft::getSku, finalDraft.getSku());
            Long count = finalDraftMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "SKU 已存在: " + finalDraft.getSku());
            }
        }

        finalDraftMapper.updateById(finalDraft);
        return finalDraftMapper.selectById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public void deleteFinalDraft(Long id) {
        log.info("删除定稿: id={}", id);

        FinalDraft finalDraft = finalDraftMapper.selectById(id);
        if (finalDraft == null) {
            throw new BusinessException(404, "定稿不存在");
        }

        moveToRecycleBin(finalDraft, 1L, "system");
        finalDraftMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchDeleteFinalDrafts(List<Long> ids) {
        log.info("批量删除定稿: ids={}", ids);

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (Long id : ids) {
            try {
                FinalDraft finalDraft = finalDraftMapper.selectById(id);
                if (finalDraft == null) {
                    failed++;
                    errors.add("ID " + id + ": 定稿不存在");
                    continue;
                }
                moveToRecycleBin(finalDraft, 1L, "system");
                finalDraftMapper.deleteById(id);
                success++;
            } catch (Exception e) {
                failed++;
                errors.add("ID " + id + ": " + e.getMessage());
                log.error("删除定稿失败: id={}", id, e);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);
        return result;
    }

    private void moveToRecycleBin(FinalDraft finalDraft, Long deletedBy, String deletedByName) {
        FinalDraftRecycleBin recycleBin = new FinalDraftRecycleBin();
        recycleBin.setDraftId(finalDraft.getId());
        recycleBin.setSku(finalDraft.getSku());
        recycleBin.setBatch(finalDraft.getBatch());
        recycleBin.setDeveloper(finalDraft.getDeveloper());
        recycleBin.setCarrier(finalDraft.getCarrier());
        recycleBin.setElement(finalDraft.getElement());
        recycleBin.setModificationRequirement(finalDraft.getModificationRequirement());
        recycleBin.setInfringementLabel(finalDraft.getInfringementLabel());
        recycleBin.setImages(finalDraft.getImages());
        recycleBin.setReferenceImages(finalDraft.getReferenceImages());
        recycleBin.setStatus(finalDraft.getStatus());
        recycleBin.setDeletedBy(deletedBy);
        recycleBin.setDeletedByName(deletedByName);
        recycleBin.setDeleteTime(LocalDateTime.now());
        recycleBin.setExpiresAt(LocalDateTime.now().plusDays(RECYCLE_BIN_EXPIRE_DAYS));
        recycleBinMapper.insert(recycleBin);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchImportFinalDrafts(List<FinalDraft> finalDrafts) {
        log.info("批量导入定稿: count={}", finalDrafts.size());

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (FinalDraft finalDraft : finalDrafts) {
            try {
                if (StringUtils.hasText(finalDraft.getSku())) {
                    LambdaQueryWrapper<FinalDraft> wrapper = new LambdaQueryWrapper<>();
                    wrapper.eq(FinalDraft::getSku, finalDraft.getSku());
                    Long count = finalDraftMapper.selectCount(wrapper);

                    if (count > 0) {
                        failed++;
                        errors.add("SKU " + finalDraft.getSku() + ": 已存在，已跳过");
                        continue;
                    }
                }

                if (!StringUtils.hasText(finalDraft.getStatus())) {
                    finalDraft.setStatus("concept");
                }

                finalDraftMapper.insert(finalDraft);
                success++;

            } catch (Exception e) {
                failed++;
                errors.add("SKU " + finalDraft.getSku() + ": " + e.getMessage());
                log.error("导入定稿失败: sku={}", finalDraft.getSku(), e);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);
        return result;
    }

    @Override
    public PageResult<FinalDraftRecycleBin> listRecycleBin(int page, int size) {
        log.info("查询回收站定稿: page={}, size={}", page, size);

        Page<FinalDraftRecycleBin> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<FinalDraftRecycleBin> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(FinalDraftRecycleBin::getDeleteTime);

        Page<FinalDraftRecycleBin> recyclePage = recycleBinMapper.selectPage(pageParam, wrapper);

        return PageResult.of(
                recyclePage.getRecords(),
                recyclePage.getTotal(),
                (long) page,
                (long) size
        );
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public void restoreMaterial(String sku) {
        log.info("恢复定稿: sku={}", sku);

        FinalDraftRecycleBin recycleBin = recycleBinMapper.selectBySku(sku);
        if (recycleBin == null) {
            throw new BusinessException(404, "回收站中不存在该定稿");
        }

        FinalDraft finalDraft = new FinalDraft();
        finalDraft.setId(recycleBin.getDraftId());
        finalDraft.setSku(recycleBin.getSku());
        finalDraft.setBatch(recycleBin.getBatch());
        finalDraft.setDeveloper(recycleBin.getDeveloper());
        finalDraft.setCarrier(recycleBin.getCarrier());
        finalDraft.setElement(recycleBin.getElement());
        finalDraft.setModificationRequirement(recycleBin.getModificationRequirement());
        finalDraft.setInfringementLabel(recycleBin.getInfringementLabel());
        finalDraft.setImages(recycleBin.getImages());
        finalDraft.setReferenceImages(recycleBin.getReferenceImages());
        finalDraft.setStatus(recycleBin.getStatus());
        finalDraft.setCreateTime(LocalDateTime.now());
        finalDraft.setUpdateTime(LocalDateTime.now());

        finalDraftMapper.insert(finalDraft);
        recycleBinMapper.deleteById(recycleBin.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchRestoreMaterials(List<String> skus) {
        log.info("批量恢复定稿: skus={}", skus);

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (String sku : skus) {
            try {
                restoreMaterial(sku);
                success++;
            } catch (Exception e) {
                failed++;
                errors.add("SKU " + sku + ": " + e.getMessage());
                log.error("恢复定稿失败: sku={}", sku, e);
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
    public void permanentDeleteMaterial(String sku) {
        log.info("永久删除定稿: sku={}", sku);

        FinalDraftRecycleBin recycleBin = recycleBinMapper.selectBySku(sku);
        if (recycleBin == null) {
            throw new BusinessException(404, "回收站中不存在该定稿");
        }

        recycleBinMapper.deleteById(recycleBin.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchPermanentDeleteMaterials(List<String> skus) {
        log.info("批量永久删除定稿: skus={}", skus);

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (String sku : skus) {
            try {
                permanentDeleteMaterial(sku);
                success++;
            } catch (Exception e) {
                failed++;
                errors.add("SKU " + sku + ": " + e.getMessage());
                log.error("永久删除定稿失败: sku={}", sku, e);
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
    public Map<String, Object> clearRecycleBin() {
        log.info("清空回收站");

        int count = recycleBinMapper.delete(null);

        Map<String, Object> result = new HashMap<>();
        result.put("deleted", count);
        return result;
    }
}
