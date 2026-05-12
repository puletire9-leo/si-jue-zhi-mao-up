package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.entity.MaterialLibrary;
import com.sjzm.entity.MaterialLibraryRecycleBin;
import com.sjzm.mapper.MaterialLibraryMapper;
import com.sjzm.mapper.MaterialLibraryRecycleBinMapper;
import com.sjzm.service.MaterialLibraryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 素材库服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
@CacheConfig(cacheNames = "materials")
public class MaterialLibraryServiceImpl implements MaterialLibraryService {

    private final MaterialLibraryMapper materialLibraryMapper;
    private final MaterialLibraryRecycleBinMapper recycleBinMapper;

    private static final String ELEMENT_TAGS_FILE = "scripts/元素词库/元素词库.txt";
    private static final int RECYCLE_BIN_EXPIRE_DAYS = 30;

    @Override
    public PageResult<MaterialLibrary> listMaterials(int page, int size, String searchType, String searchContent,
                                                      List<String> developers, List<String> statuses, List<String> carriers) {
        log.info("查询素材列表: page={}, size={}, searchType={}, searchContent={}, developers={}, statuses={}, carriers={}",
                page, size, searchType, searchContent, developers, statuses, carriers);

        Page<MaterialLibrary> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<MaterialLibrary> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(searchType) && StringUtils.hasText(searchContent)) {
            switch (searchType) {
                case "sku":
                    wrapper.like(MaterialLibrary::getSku, searchContent);
                    break;
                case "batch":
                    wrapper.like(MaterialLibrary::getBatch, searchContent);
                    break;
                case "developer":
                    wrapper.like(MaterialLibrary::getDeveloper, searchContent);
                    break;
                default:
                    log.warn("未知的搜索类型: {}", searchType);
                    break;
            }
        }

        if (!CollectionUtils.isEmpty(developers)) {
            wrapper.in(MaterialLibrary::getDeveloper, developers);
        }

        if (!CollectionUtils.isEmpty(statuses)) {
            wrapper.in(MaterialLibrary::getStatus, statuses);
        }

        if (!CollectionUtils.isEmpty(carriers)) {
            wrapper.in(MaterialLibrary::getCarrier, carriers);
        }

        wrapper.orderByDesc(MaterialLibrary::getCreateTime);
        Page<MaterialLibrary> materialPage = materialLibraryMapper.selectPage(pageParam, wrapper);

        return PageResult.of(
                materialPage.getRecords(),
                materialPage.getTotal(),
                (long) page,
                (long) size
        );
    }

    @Override
    @Cacheable(key = "#id")
    public MaterialLibrary getMaterialById(Long id) {
        log.info("查询素材: id={}", id);

        MaterialLibrary material = materialLibraryMapper.selectById(id);
        if (material == null) {
            throw new BusinessException(404, "素材不存在");
        }
        return material;
    }

    @Override
    @Cacheable(key = "'sku:' + #sku")
    public MaterialLibrary getMaterialBySku(String sku) {
        log.info("查询素材: sku={}", sku);

        LambdaQueryWrapper<MaterialLibrary> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MaterialLibrary::getSku, sku);
        MaterialLibrary material = materialLibraryMapper.selectOne(wrapper);

        if (material == null) {
            throw new BusinessException(404, "素材不存在");
        }
        return material;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public MaterialLibrary createMaterial(MaterialLibrary material) {
        log.info("创建素材: sku={}", material.getSku());

        if (StringUtils.hasText(material.getSku())) {
            LambdaQueryWrapper<MaterialLibrary> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(MaterialLibrary::getSku, material.getSku());
            Long count = materialLibraryMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "SKU 已存在: " + material.getSku());
            }
        }

        if (!StringUtils.hasText(material.getStatus())) {
            material.setStatus("concept");
        }

        materialLibraryMapper.insert(material);
        return material;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public MaterialLibrary updateMaterial(Long id, MaterialLibrary material) {
        log.info("更新素材: id={}", id);

        MaterialLibrary existingMaterial = materialLibraryMapper.selectById(id);
        if (existingMaterial == null) {
            throw new BusinessException(404, "素材不存在");
        }

        material.setId(id);

        if (StringUtils.hasText(material.getSku()) && !material.getSku().equals(existingMaterial.getSku())) {
            LambdaQueryWrapper<MaterialLibrary> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(MaterialLibrary::getSku, material.getSku());
            Long count = materialLibraryMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "SKU 已存在: " + material.getSku());
            }
        }

        materialLibraryMapper.updateById(material);
        return materialLibraryMapper.selectById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public void deleteMaterial(Long id) {
        log.info("删除素材: id={}", id);

        MaterialLibrary material = materialLibraryMapper.selectById(id);
        if (material == null) {
            throw new BusinessException(404, "素材不存在");
        }

        moveToRecycleBin(material, 1L, "system");
        materialLibraryMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchDeleteMaterials(List<Long> ids) {
        log.info("批量删除素材: ids={}", ids);

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (Long id : ids) {
            try {
                MaterialLibrary material = materialLibraryMapper.selectById(id);
                if (material == null) {
                    failed++;
                    errors.add("ID " + id + ": 素材不存在");
                    continue;
                }
                moveToRecycleBin(material, 1L, "system");
                materialLibraryMapper.deleteById(id);
                success++;
            } catch (Exception e) {
                failed++;
                errors.add("ID " + id + ": " + e.getMessage());
                log.error("删除素材失败: id={}", id, e);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);
        return result;
    }

    private void moveToRecycleBin(MaterialLibrary material, Long deletedBy, String deletedByName) {
        MaterialLibraryRecycleBin recycleBin = new MaterialLibraryRecycleBin();
        recycleBin.setMaterialId(material.getId());
        recycleBin.setSku(material.getSku());
        recycleBin.setBatch(material.getBatch());
        recycleBin.setDeveloper(material.getDeveloper());
        recycleBin.setCarrier(material.getCarrier());
        recycleBin.setElement(material.getElement());
        recycleBin.setModificationRequirement(material.getModificationRequirement());
        recycleBin.setImages(material.getImages());
        recycleBin.setReferenceImages(material.getReferenceImages());
        recycleBin.setFinalDraftImages(material.getFinalDraftImages());
        recycleBin.setStatus(material.getStatus());
        recycleBin.setLocalThumbnailPath(material.getLocalThumbnailPath());
        recycleBin.setDeletedBy(deletedBy);
        recycleBin.setDeletedByName(deletedByName);
        recycleBin.setDeleteTime(LocalDateTime.now());
        recycleBin.setExpiresAt(LocalDateTime.now().plusDays(RECYCLE_BIN_EXPIRE_DAYS));
        recycleBinMapper.insert(recycleBin);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchImportMaterials(List<MaterialLibrary> materials) {
        log.info("批量导入素材: count={}", materials.size());

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (MaterialLibrary material : materials) {
            try {
                if (StringUtils.hasText(material.getSku())) {
                    LambdaQueryWrapper<MaterialLibrary> wrapper = new LambdaQueryWrapper<>();
                    wrapper.eq(MaterialLibrary::getSku, material.getSku());
                    Long count = materialLibraryMapper.selectCount(wrapper);

                    if (count > 0) {
                        failed++;
                        errors.add("SKU " + material.getSku() + ": 已存在，已跳过");
                        continue;
                    }
                }

                if (!StringUtils.hasText(material.getStatus())) {
                    material.setStatus("concept");
                }

                materialLibraryMapper.insert(material);
                success++;

            } catch (Exception e) {
                failed++;
                errors.add("SKU " + material.getSku() + ": " + e.getMessage());
                log.error("导入素材失败: sku={}", material.getSku(), e);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);
        return result;
    }

    @Override
    public PageResult<MaterialLibraryRecycleBin> listRecycleBin(int page, int size) {
        log.info("查询回收站素材: page={}, size={}", page, size);

        Page<MaterialLibraryRecycleBin> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<MaterialLibraryRecycleBin> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(MaterialLibraryRecycleBin::getDeleteTime);

        Page<MaterialLibraryRecycleBin> recyclePage = recycleBinMapper.selectPage(pageParam, wrapper);

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
        log.info("恢复素材: sku={}", sku);

        MaterialLibraryRecycleBin recycleBin = recycleBinMapper.selectBySku(sku);
        if (recycleBin == null) {
            throw new BusinessException(404, "回收站中不存在该素材");
        }

        MaterialLibrary material = new MaterialLibrary();
        material.setId(recycleBin.getMaterialId());
        material.setSku(recycleBin.getSku());
        material.setBatch(recycleBin.getBatch());
        material.setDeveloper(recycleBin.getDeveloper());
        material.setCarrier(recycleBin.getCarrier());
        material.setElement(recycleBin.getElement());
        material.setModificationRequirement(recycleBin.getModificationRequirement());
        material.setImages(recycleBin.getImages());
        material.setReferenceImages(recycleBin.getReferenceImages());
        material.setFinalDraftImages(recycleBin.getFinalDraftImages());
        material.setStatus(recycleBin.getStatus());
        material.setLocalThumbnailPath(recycleBin.getLocalThumbnailPath());
        material.setCreateTime(LocalDateTime.now());
        material.setUpdateTime(LocalDateTime.now());

        materialLibraryMapper.insert(material);
        recycleBinMapper.deleteById(recycleBin.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchRestoreMaterials(List<String> skus) {
        log.info("批量恢复素材: skus={}", skus);

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
                log.error("恢复素材失败: sku={}", sku, e);
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
        log.info("永久删除素材: sku={}", sku);

        MaterialLibraryRecycleBin recycleBin = recycleBinMapper.selectBySku(sku);
        if (recycleBin == null) {
            throw new BusinessException(404, "回收站中不存在该素材");
        }

        recycleBinMapper.deleteById(recycleBin.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchPermanentDeleteMaterials(List<String> skus) {
        log.info("批量永久删除素材: skus={}", skus);

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
                log.error("永久删除素材失败: sku={}", sku, e);
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

    @Override
    public List<String> getElementTags() {
        log.info("获取元素词库");

        File file = new File(ELEMENT_TAGS_FILE);
        if (!file.exists()) {
            return new ArrayList<>();
        }

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            return reader.lines()
                    .map(String::trim)
                    .filter(line -> !line.isEmpty())
                    .distinct()
                    .collect(Collectors.toList());
        } catch (IOException e) {
            log.error("读取元素词库失败: {}", e.getMessage(), e);
            return new ArrayList<>();
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> updateElementTags(List<String> elements) {
        log.info("更新元素词库: count={}", elements.size());

        if (elements == null || elements.isEmpty()) {
            throw new BusinessException(400, "元素词库不能为空");
        }

        List<String> filtered = elements.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        if (filtered.isEmpty()) {
            throw new BusinessException(400, "元素词库不能为空");
        }

        File file = new File(ELEMENT_TAGS_FILE);
        File parentDir = file.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
        }

        try (BufferedWriter writer = new BufferedWriter(
                new OutputStreamWriter(new FileOutputStream(file), StandardCharsets.UTF_8))) {
            for (String element : filtered) {
                writer.write(element);
                writer.newLine();
            }
        } catch (IOException e) {
            log.error("保存元素词库失败: {}", e.getMessage(), e);
            throw new BusinessException(500, "保存元素词库文件失败");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("updated_count", filtered.size());
        return result;
    }

    @Override
    public Map<String, Object> analyzeImage(Map<String, Object> request) {
        log.info("AI分析图片（占位实现）");
        Map<String, Object> result = new HashMap<>();
        result.put("message", "AI功能开发中");
        result.put("suggestion", "请使用Python后端进行AI分析");
        return result;
    }

    @Override
    public Map<String, Object> analyzeImageDetailed(Map<String, Object> request) {
        log.info("AI详细分析图片（占位实现）");
        Map<String, Object> result = new HashMap<>();
        result.put("message", "AI功能开发中");
        result.put("suggestion", "请使用Python后端进行AI分析");
        return result;
    }

    @Override
    public Map<String, Object> processLocalFiles(Map<String, Object> request) {
        log.info("处理本地文件（占位实现）");
        Map<String, Object> result = new HashMap<>();
        result.put("message", "本地文件处理功能开发中");
        return result;
    }
}
