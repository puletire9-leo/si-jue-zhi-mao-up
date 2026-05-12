package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.common.BusinessException;
import com.sjzm.entity.Product;
import com.sjzm.entity.RecycleBin;
import com.sjzm.mapper.ProductMapper;
import com.sjzm.mapper.RecycleBinMapper;
import com.sjzm.service.RecycleBinService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
public class RecycleBinServiceImpl implements RecycleBinService {

    @Autowired
    private RecycleBinMapper recycleBinMapper;

    @Autowired
    private ProductMapper productMapper;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new LinkedHashMap<>();

        QueryWrapper<RecycleBin> wrapper = new QueryWrapper<>();
        Long totalCount = recycleBinMapper.selectCount(wrapper);

        QueryWrapper<RecycleBin> expiringWrapper = new QueryWrapper<>();
        expiringWrapper.le("expires_at", LocalDateTime.now().plusDays(7));
        Long expiringCount = recycleBinMapper.selectCount(expiringWrapper);

        stats.put("total_products", totalCount);
        stats.put("expiring_products", expiringCount);

        return stats;
    }

    @Override
    public Page<RecycleBin> listRecycleBinItems(
            int page,
            int size,
            String keyword,
            String startDate,
            String endDate) {

        Page<RecycleBin> pageParam = new Page<>(page, size);
        QueryWrapper<RecycleBin> wrapper = new QueryWrapper<>();
        wrapper.orderByDesc("deleted_at");

        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like("product_sku", keyword)
                    .or().like("product_name", keyword));
        }

        if (startDate != null && !startDate.isEmpty()) {
            wrapper.ge("deleted_at", startDate);
        }

        if (endDate != null && !endDate.isEmpty()) {
            wrapper.le("deleted_at", endDate);
        }

        return recycleBinMapper.selectPage(pageParam, wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> restoreProduct(String sku) {
        log.info("恢复产品: sku={}", sku);

        RecycleBin recycleBin = recycleBinMapper.selectBySku(sku);
        if (recycleBin == null) {
            throw new BusinessException(404, "产品不在回收站中");
        }

        try {
            Product product = objectMapper.readValue(
                    recycleBin.getOriginalData(),
                    Product.class
            );

            Product existingProduct = productMapper.selectBySku(sku);
            if (existingProduct != null) {
                productMapper.deleteById(existingProduct.getId());
            }

            product.setId(null);
            product.setStatus("active");
            product.setCreateTime(LocalDateTime.now());
            product.setUpdateTime(LocalDateTime.now());
            productMapper.insert(product);

            recycleBinMapper.deleteById(recycleBin.getId());

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", true);
            result.put("sku", sku);
            result.put("message", "恢复成功");

            return result;

        } catch (Exception e) {
            log.error("恢复产品失败: sku={}", sku, e);
            throw new BusinessException("恢复产品失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchRestoreProducts(String[] skus) {
        log.info("批量恢复产品: count={}", skus.length);

        int success = 0;
        int failed = 0;
        List<Map<String, Object>> errors = new ArrayList<>();

        for (String sku : skus) {
            try {
                restoreProduct(sku);
                success++;
            } catch (Exception e) {
                failed++;
                Map<String, Object> error = new LinkedHashMap<>();
                error.put("sku", sku);
                error.put("error", e.getMessage());
                errors.add(error);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);
        result.put("message", String.format("批量恢复完成：成功 %d 条，失败 %d 条", success, failed));

        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> deletePermanently(String sku) {
        log.info("永久删除产品: sku={}", sku);

        RecycleBin recycleBin = recycleBinMapper.selectBySku(sku);
        if (recycleBin == null) {
            throw new BusinessException(404, "产品不在回收站中");
        }

        recycleBinMapper.deleteById(recycleBin.getId());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("sku", sku);
        result.put("message", "删除成功");

        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchDeletePermanently(String[] skus) {
        log.info("批量永久删除产品: count={}", skus.length);

        if (skus == null || skus.length == 0) {
            throw new BusinessException(400, "请选择要删除的产品");
        }

        List<String> skuList = Arrays.asList(skus);
        QueryWrapper<RecycleBin> wrapper = new QueryWrapper<>();
        wrapper.in("product_sku", skuList);
        recycleBinMapper.delete(wrapper);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", skus.length);
        result.put("message", String.format("成功删除 %d 个产品", skus.length));

        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> cleanExpiredProducts() {
        log.info("清理过期产品");

        int deletedCount = recycleBinMapper.deleteExpired();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("deleted_count", deletedCount);
        result.put("message", String.format("清理了 %d 个过期产品", deletedCount));

        return result;
    }
}
