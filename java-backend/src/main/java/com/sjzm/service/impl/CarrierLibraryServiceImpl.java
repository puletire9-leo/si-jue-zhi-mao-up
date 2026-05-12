package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.entity.CarrierLibrary;
import com.sjzm.entity.CarrierLibraryRecycleBin;
import com.sjzm.mapper.CarrierLibraryMapper;
import com.sjzm.mapper.CarrierLibraryRecycleBinMapper;
import com.sjzm.service.CarrierLibraryService;
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
 * 运营商库服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
@CacheConfig(cacheNames = "carriers")
public class CarrierLibraryServiceImpl implements CarrierLibraryService {

    private final CarrierLibraryMapper carrierLibraryMapper;
    private final CarrierLibraryRecycleBinMapper recycleBinMapper;

    private static final int RECYCLE_BIN_EXPIRE_DAYS = 30;

    @Override
    public PageResult<CarrierLibrary> listCarriers(int page, int size, String searchType, String searchContent,
                                                    List<String> developers, List<String> carriers) {
        log.info("查询运营商列表: page={}, size={}, searchType={}, searchContent={}, developers={}, carriers={}",
                page, size, searchType, searchContent, developers, carriers);

        Page<CarrierLibrary> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<CarrierLibrary> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(searchType) && StringUtils.hasText(searchContent)) {
            switch (searchType) {
                case "sku":
                    wrapper.like(CarrierLibrary::getSku, searchContent);
                    break;
                case "batch":
                    wrapper.like(CarrierLibrary::getBatch, searchContent);
                    break;
                case "developer":
                    wrapper.like(CarrierLibrary::getDeveloper, searchContent);
                    break;
                case "carrierName":
                    wrapper.like(CarrierLibrary::getCarrierName, searchContent);
                    break;
                default:
                    log.warn("未知的搜索类型: {}", searchType);
                    break;
            }
        }

        if (!CollectionUtils.isEmpty(developers)) {
            wrapper.in(CarrierLibrary::getDeveloper, developers);
        }

        if (!CollectionUtils.isEmpty(carriers)) {
            wrapper.in(CarrierLibrary::getCarrierName, carriers);
        }

        wrapper.orderByDesc(CarrierLibrary::getCreateTime);
        Page<CarrierLibrary> carrierPage = carrierLibraryMapper.selectPage(pageParam, wrapper);

        return PageResult.of(
                carrierPage.getRecords(),
                carrierPage.getTotal(),
                (long) page,
                (long) size
        );
    }

    @Override
    @Cacheable(key = "#id")
    public CarrierLibrary getCarrierById(Long id) {
        log.info("查询运营商: id={}", id);

        CarrierLibrary carrier = carrierLibraryMapper.selectById(id);
        if (carrier == null) {
            throw new BusinessException(404, "运营商不存在");
        }
        return carrier;
    }

    @Override
    @Cacheable(key = "'sku:' + #sku")
    public CarrierLibrary getCarrierBySku(String sku) {
        log.info("查询运营商: sku={}", sku);

        LambdaQueryWrapper<CarrierLibrary> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CarrierLibrary::getSku, sku);
        CarrierLibrary carrier = carrierLibraryMapper.selectOne(wrapper);

        if (carrier == null) {
            throw new BusinessException(404, "运营商不存在");
        }
        return carrier;
    }

    @Override
    public Long getBatchCount(String batch) {
        log.info("获取批次数量: batch={}", batch);
        LambdaQueryWrapper<CarrierLibrary> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CarrierLibrary::getBatch, batch);
        return carrierLibraryMapper.selectCount(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public CarrierLibrary createCarrier(CarrierLibrary carrier) {
        log.info("创建运营商: sku={}, carrierName={}", carrier.getSku(), carrier.getCarrierName());

        if (StringUtils.hasText(carrier.getSku())) {
            LambdaQueryWrapper<CarrierLibrary> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(CarrierLibrary::getSku, carrier.getSku());
            Long count = carrierLibraryMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "SKU 已存在: " + carrier.getSku());
            }
        }

        carrierLibraryMapper.insert(carrier);
        return carrier;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public CarrierLibrary updateCarrier(Long id, CarrierLibrary carrier) {
        log.info("更新运营商: id={}", id);

        CarrierLibrary existingCarrier = carrierLibraryMapper.selectById(id);
        if (existingCarrier == null) {
            throw new BusinessException(404, "运营商不存在");
        }

        carrier.setId(id);

        if (StringUtils.hasText(carrier.getSku()) && !carrier.getSku().equals(existingCarrier.getSku())) {
            LambdaQueryWrapper<CarrierLibrary> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(CarrierLibrary::getSku, carrier.getSku());
            Long count = carrierLibraryMapper.selectCount(wrapper);
            if (count > 0) {
                throw new BusinessException(400, "SKU 已存在: " + carrier.getSku());
            }
        }

        carrierLibraryMapper.updateById(carrier);
        return carrierLibraryMapper.selectById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(key = "#id")
    public void deleteCarrier(Long id) {
        log.info("删除运营商: id={}", id);

        CarrierLibrary carrier = carrierLibraryMapper.selectById(id);
        if (carrier == null) {
            throw new BusinessException(404, "运营商不存在");
        }

        moveToRecycleBin(carrier, 1L, "system");
        carrierLibraryMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchDeleteCarriers(List<Long> ids) {
        log.info("批量删除运营商: ids={}", ids);

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (Long id : ids) {
            try {
                CarrierLibrary carrier = carrierLibraryMapper.selectById(id);
                if (carrier == null) {
                    failed++;
                    errors.add("ID " + id + ": 运营商不存在");
                    continue;
                }
                moveToRecycleBin(carrier, 1L, "system");
                carrierLibraryMapper.deleteById(id);
                success++;
            } catch (Exception e) {
                failed++;
                errors.add("ID " + id + ": " + e.getMessage());
                log.error("删除运营商失败: id={}", id, e);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);
        return result;
    }

    private void moveToRecycleBin(CarrierLibrary carrier, Long deletedBy, String deletedByName) {
        CarrierLibraryRecycleBin recycleBin = new CarrierLibraryRecycleBin();
        recycleBin.setCarrierId(carrier.getId());
        recycleBin.setSku(carrier.getSku());
        recycleBin.setCarrierName(carrier.getCarrierName());
        recycleBin.setBatch(carrier.getBatch());
        recycleBin.setDeveloper(carrier.getDeveloper());
        recycleBin.setImages(carrier.getImages());
        recycleBin.setReferenceImages(carrier.getReferenceImages());
        recycleBin.setStatus(carrier.getStatus());
        recycleBin.setDeletedBy(deletedBy);
        recycleBin.setDeletedByName(deletedByName);
        recycleBin.setDeleteTime(LocalDateTime.now());
        recycleBin.setExpiresAt(LocalDateTime.now().plusDays(RECYCLE_BIN_EXPIRE_DAYS));
        recycleBinMapper.insert(recycleBin);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchImportCarriers(List<CarrierLibrary> carriers) {
        log.info("批量导入运营商: count={}", carriers.size());

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (CarrierLibrary carrier : carriers) {
            try {
                if (StringUtils.hasText(carrier.getSku())) {
                    LambdaQueryWrapper<CarrierLibrary> wrapper = new LambdaQueryWrapper<>();
                    wrapper.eq(CarrierLibrary::getSku, carrier.getSku());
                    Long count = carrierLibraryMapper.selectCount(wrapper);

                    if (count > 0) {
                        failed++;
                        errors.add("SKU " + carrier.getSku() + ": 已存在，已跳过");
                        continue;
                    }
                }

                carrierLibraryMapper.insert(carrier);
                success++;

            } catch (Exception e) {
                failed++;
                errors.add("SKU " + carrier.getSku() + ": " + e.getMessage());
                log.error("导入运营商失败: sku={}", carrier.getSku(), e);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);
        return result;
    }

    @Override
    public PageResult<CarrierLibraryRecycleBin> listRecycleBin(int page, int size) {
        log.info("查询回收站运营商: page={}, size={}", page, size);

        Page<CarrierLibraryRecycleBin> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<CarrierLibraryRecycleBin> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(CarrierLibraryRecycleBin::getDeleteTime);

        Page<CarrierLibraryRecycleBin> recyclePage = recycleBinMapper.selectPage(pageParam, wrapper);

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
        log.info("恢复运营商: sku={}", sku);

        CarrierLibraryRecycleBin recycleBin = recycleBinMapper.selectBySku(sku);
        if (recycleBin == null) {
            throw new BusinessException(404, "回收站中不存在该运营商");
        }

        CarrierLibrary carrier = new CarrierLibrary();
        carrier.setId(recycleBin.getCarrierId());
        carrier.setSku(recycleBin.getSku());
        carrier.setCarrierName(recycleBin.getCarrierName());
        carrier.setBatch(recycleBin.getBatch());
        carrier.setDeveloper(recycleBin.getDeveloper());
        carrier.setImages(recycleBin.getImages());
        carrier.setReferenceImages(recycleBin.getReferenceImages());
        carrier.setStatus(recycleBin.getStatus());
        carrier.setCreateTime(LocalDateTime.now());
        carrier.setUpdateTime(LocalDateTime.now());

        carrierLibraryMapper.insert(carrier);
        recycleBinMapper.deleteById(recycleBin.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchRestoreMaterials(List<String> skus) {
        log.info("批量恢复运营商: skus={}", skus);

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
                log.error("恢复运营商失败: sku={}", sku, e);
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
        log.info("永久删除运营商: sku={}", sku);

        CarrierLibraryRecycleBin recycleBin = recycleBinMapper.selectBySku(sku);
        if (recycleBin == null) {
            throw new BusinessException(404, "回收站中不存在该运营商");
        }

        recycleBinMapper.deleteById(recycleBin.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchPermanentDeleteMaterials(List<String> skus) {
        log.info("批量永久删除运营商: skus={}", skus);

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
                log.error("永久删除运营商失败: sku={}", sku, e);
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
