package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.entity.Product;
import com.sjzm.entity.RecycleBin;
import com.sjzm.mapper.ProductMapper;
import com.sjzm.mapper.RecycleBinMapper;
import com.sjzm.service.ProductService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@CacheConfig(cacheNames = "products")
public class ProductServiceImpl implements ProductService {

    private final ProductMapper productMapper;
    private final RecycleBinMapper recycleBinMapper;
    private final ObjectMapper objectMapper;

    private static final int RECYCLE_EXPIRE_DAYS = 30;
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public PageResult<Product> listProducts(int page, int size, String keyword, String category, String type) {
        log.info("查询产品列表: page={}, size={}, keyword={}, category={}, type={}", page, size, keyword, category, type);

        if (size > 50) {
            size = 50;
            log.warn("页码大小超出限制，已调整为50");
        }

        Page<Product> pageParam = new Page<>(page, size);

        LambdaQueryWrapper<Product> wrapper = buildQueryWrapper(keyword, category, type, null, null, null, null);

        wrapper.orderByDesc(Product::getCreateTime);

        Page<Product> productPage = productMapper.selectPage(pageParam, wrapper);

        return PageResult.of(
                productPage.getRecords(),
                productPage.getTotal(),
                (long) page,
                (long) size
        );
    }

    public PageResult<Product> listProducts(int page, int size, String keyword, String category, String type,
                                            BigDecimal minPrice, BigDecimal maxPrice, String sortBy, String sortOrder) {
        log.info("查询产品列表(扩展): page={}, size={}, keyword={}, category={}, type={}, minPrice={}, maxPrice={}, sortBy={}, sortOrder={}",
                page, size, keyword, category, type, minPrice, maxPrice, sortBy, sortOrder);

        if (size > 50) {
            size = 50;
            log.warn("页码大小超出限制，已调整为50");
        }

        Page<Product> pageParam = new Page<>(page, size);

        LambdaQueryWrapper<Product> wrapper = buildQueryWrapper(keyword, category, type, minPrice, maxPrice, sortBy, sortOrder);

        Page<Product> productPage = productMapper.selectPage(pageParam, wrapper);

        return PageResult.of(
                productPage.getRecords(),
                productPage.getTotal(),
                (long) page,
                (long) size
        );
    }

    private LambdaQueryWrapper<Product> buildQueryWrapper(String keyword, String category, String type,
                                                          BigDecimal minPrice, BigDecimal maxPrice,
                                                          String sortBy, String sortOrder) {
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();

        wrapper.eq(Product::getStatus, "normal");

        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(Product::getName, keyword)
                    .or()
                    .like(Product::getSku, keyword));
        }

        if (StringUtils.hasText(category)) {
            wrapper.eq(Product::getCategory, category);
        }

        if (StringUtils.hasText(type)) {
            wrapper.eq(Product::getType, type);
        }

        if (minPrice != null) {
            wrapper.ge(Product::getPrice, minPrice);
        }

        if (maxPrice != null) {
            wrapper.le(Product::getPrice, maxPrice);
        }

        if (StringUtils.hasText(sortBy)) {
            boolean isDesc = !"asc".equalsIgnoreCase(sortOrder);
            switch (sortBy.toLowerCase()) {
                case "created_at":
                    if (isDesc) wrapper.orderByDesc(Product::getCreateTime);
                    else wrapper.orderByAsc(Product::getCreateTime);
                    break;
                case "updated_at":
                    if (isDesc) wrapper.orderByDesc(Product::getUpdateTime);
                    else wrapper.orderByAsc(Product::getUpdateTime);
                    break;
                case "price":
                    if (isDesc) wrapper.orderByDesc(Product::getPrice);
                    else wrapper.orderByAsc(Product::getPrice);
                    break;
                case "name":
                    if (isDesc) wrapper.orderByDesc(Product::getName);
                    else wrapper.orderByAsc(Product::getName);
                    break;
                default:
                    wrapper.orderByDesc(Product::getCreateTime);
            }
        } else {
            wrapper.orderByDesc(Product::getCreateTime);
        }

        return wrapper;
    }

    @Override
    @Cacheable(key = "#id")
    public Product getProductById(Long id) {
        log.info("查询产品: id={}", id);

        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Product::getId, id);
        wrapper.eq(Product::getStatus, "normal");

        Product product = productMapper.selectOne(wrapper);
        if (product == null) {
            throw new BusinessException(404, "产品不存在");
        }
        return product;
    }

    @Override
    @Cacheable(key = "'sku:' + #sku")
    public Product getProductBySku(String sku) {
        log.info("查询产品: sku={}", sku);

        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Product::getSku, sku);
        wrapper.eq(Product::getStatus, "normal");

        Product product = productMapper.selectOne(wrapper);
        if (product == null) {
            throw new BusinessException(404, "产品不存在: " + sku);
        }
        return product;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Product createProduct(Product product) {
        log.info("创建产品: sku={}", product.getSku());

        if (!StringUtils.hasText(product.getSku())) {
            throw new BusinessException(400, "SKU不能为空");
        }

        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Product::getSku, product.getSku());
        wrapper.eq(Product::getStatus, "normal");

        Long count = productMapper.selectCount(wrapper);
        if (count > 0) {
            throw new BusinessException(400, "SKU已存在: " + product.getSku());
        }

        if (!StringUtils.hasText(product.getStatus())) {
            product.setStatus("normal");
        }
        if (!StringUtils.hasText(product.getType())) {
            product.setType(Product.TYPE_STANDARD);
        }

        product.setDeleteTime(null);
        product.setCreateTime(LocalDateTime.now());
        product.setUpdateTime(LocalDateTime.now());

        productMapper.insert(product);

        log.info("创建产品成功: sku={}", product.getSku());
        return product;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Product updateProduct(Long id, Product product) {
        log.info("更新产品: id={}", id);

        Product existingProduct = productMapper.selectById(id);
        if (existingProduct == null || !"normal".equals(existingProduct.getStatus())) {
            throw new BusinessException(404, "产品不存在");
        }

        product.setId(id);
        product.setUpdateTime(LocalDateTime.now());
        product.setDeleteTime(null);

        if (product.getStatus() != null && !"normal".equals(product.getStatus()) && !"active".equals(product.getStatus())) {
            product.setStatus(existingProduct.getStatus());
        }

        productMapper.updateById(product);

        log.info("更新产品成功: id={}", id);
        return productMapper.selectById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public void deleteProduct(Long id) {
        log.info("删除产品: id={}", id);

        Product existingProduct = productMapper.selectById(id);
        if (existingProduct == null || !"normal".equals(existingProduct.getStatus())) {
            throw new BusinessException(404, "产品不存在");
        }

        saveToRecycleBin(existingProduct);

        LambdaUpdateWrapper<Product> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(Product::getId, id)
                .set(Product::getStatus, "deleted")
                .set(Product::getDeleteTime, LocalDateTime.now())
                .set(Product::getUpdateTime, LocalDateTime.now());
        productMapper.update(null, updateWrapper);

        log.info("产品已移入回收站: sku={}", existingProduct.getSku());
    }

    private void saveToRecycleBin(Product product) {
        RecycleBin recycleBin = new RecycleBin();
        recycleBin.setProductSku(product.getSku());
        recycleBin.setProductName(product.getName());
        recycleBin.setCategory(product.getCategory());
        recycleBin.setPrice(product.getPrice());
        recycleBin.setDeveloper(product.getDeveloper());
        recycleBin.setDeletedAt(LocalDateTime.now());
        recycleBin.setExpiresAt(LocalDateTime.now().plusDays(RECYCLE_EXPIRE_DAYS));
        recycleBin.setDeletedBy(1L);

        try {
            Map<String, Object> originalData = new HashMap<>();
            originalData.put("sku", product.getSku());
            originalData.put("name", product.getName());
            originalData.put("description", product.getDescription());
            originalData.put("category", product.getCategory());
            originalData.put("type", product.getType());
            originalData.put("price", product.getPrice());
            originalData.put("stock", product.getStock());
            originalData.put("image", product.getImage());
            originalData.put("developer", product.getDeveloper());
            originalData.put("localPath", product.getLocalPath());
            originalData.put("thumbPath", product.getThumbPath());
            originalData.put("includedItems", product.getIncludedItems());
            originalData.put("tags", product.getTags());
            originalData.put("createTime", product.getCreateTime() != null ? product.getCreateTime().format(DATE_FORMATTER) : null);
            originalData.put("updateTime", product.getUpdateTime() != null ? product.getUpdateTime().format(DATE_FORMATTER) : null);

            recycleBin.setOriginalData(objectMapper.writeValueAsString(originalData));
        } catch (Exception e) {
            log.warn("序列化产品数据失败: {}", e.getMessage());
        }

        recycleBinMapper.insert(recycleBin);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchDeleteProducts(List<Long> ids) {
        log.info("批量删除产品: ids={}", ids);

        if (ids == null || ids.isEmpty()) {
            throw new BusinessException(400, "ID列表不能为空");
        }

        if (ids.size() > 100) {
            throw new BusinessException(400, "批量删除数量不能超过100个");
        }

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        List<Product> existingProducts = productMapper.selectBatchIds(ids);
        List<Product> validProducts = existingProducts.stream()
                .filter(p -> "normal".equals(p.getStatus()))
                .collect(Collectors.toList());

        if (validProducts.isEmpty()) {
            throw new BusinessException(404, "没有找到有效的产品");
        }

        for (Product product : validProducts) {
            try {
                saveToRecycleBin(product);

                LambdaUpdateWrapper<Product> updateWrapper = new LambdaUpdateWrapper<>();
                updateWrapper.eq(Product::getId, product.getId())
                        .set(Product::getStatus, "deleted")
                        .set(Product::getDeleteTime, LocalDateTime.now())
                        .set(Product::getUpdateTime, LocalDateTime.now());
                productMapper.update(null, updateWrapper);

                success++;
            } catch (Exception e) {
                failed++;
                errors.add("SKU " + product.getSku() + ": " + e.getMessage());
                log.error("删除产品失败: sku={}", product.getSku(), e);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);
        result.put("total", ids.size());

        log.info("批量删除完成: 成功={}, 失败={}", success, failed);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(allEntries = true)
    public Map<String, Object> batchImportProducts(List<Product> products, boolean overwrite) {
        log.info("批量导入产品: count={}, overwrite={}", products.size(), overwrite);

        if (products == null || products.isEmpty()) {
            throw new BusinessException(400, "产品列表不能为空");
        }

        int success = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        List<String> skus = products.stream()
                .map(Product::getSku)
                .filter(StringUtils::hasText)
                .collect(Collectors.toList());

        Map<String, Product> existingMap = new HashMap<>();
        if (!skus.isEmpty()) {
            LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
            wrapper.in(Product::getSku, skus);
            wrapper.eq(Product::getStatus, "normal");
            List<Product> existingList = productMapper.selectList(wrapper);
            for (Product p : existingList) {
                existingMap.put(p.getSku(), p);
            }
        }

        List<Product> productsToInsert = new ArrayList<>();
        List<Product> productsToUpdate = new ArrayList<>();

        for (Product product : products) {
            if (!StringUtils.hasText(product.getSku()) || !StringUtils.hasText(product.getName())) {
                failed++;
                errors.add("SKU或产品名称不能为空");
                continue;
            }

            Product existing = existingMap.get(product.getSku());
            if (existing != null) {
                if (overwrite) {
                    product.setId(existing.getId());
                    product.setStatus("normal");
                    product.setDeleteTime(null);
                    product.setCreateTime(existing.getCreateTime());
                    product.setUpdateTime(LocalDateTime.now());
                    productsToUpdate.add(product);
                } else {
                    failed++;
                    errors.add("SKU " + product.getSku() + ": 已存在，已跳过");
                }
            } else {
                if (!StringUtils.hasText(product.getStatus())) {
                    product.setStatus("normal");
                }
                if (!StringUtils.hasText(product.getType())) {
                    product.setType(Product.TYPE_STANDARD);
                }
                product.setDeleteTime(null);
                product.setCreateTime(LocalDateTime.now());
                product.setUpdateTime(LocalDateTime.now());
                productsToInsert.add(product);
            }
        }

        if (!productsToInsert.isEmpty()) {
            for (Product product : productsToInsert) {
                try {
                    productMapper.insert(product);
                    success++;
                } catch (Exception e) {
                    failed++;
                    errors.add("SKU " + product.getSku() + ": " + e.getMessage());
                    log.error("插入产品失败: sku={}", product.getSku(), e);
                }
            }
        }

        if (!productsToUpdate.isEmpty()) {
            for (Product product : productsToUpdate) {
                try {
                    productMapper.updateById(product);
                    success++;
                } catch (Exception e) {
                    failed++;
                    errors.add("SKU " + product.getSku() + ": " + e.getMessage());
                    log.error("更新产品失败: sku={}", product.getSku(), e);
                }
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors.size() > 10 ? errors.subList(0, 10) : errors);

        log.info("批量导入完成: 成功={}, 失败={}", success, failed);
        return result;
    }

    @Override
    public Map<String, Object> getProductStats() {
        log.info("获取产品统计");

        LambdaQueryWrapper<Product> normalWrapper = new LambdaQueryWrapper<>();
        normalWrapper.eq(Product::getStatus, "normal");
        Long totalCount = productMapper.selectCount(normalWrapper);

        LambdaQueryWrapper<Product> typeWrapper = new LambdaQueryWrapper<>();
        typeWrapper.eq(Product::getStatus, "normal");
        List<Product> allNormalProducts = productMapper.selectList(typeWrapper);

        Map<String, Long> typeCounts = allNormalProducts.stream()
                .collect(Collectors.groupingBy(
                        p -> p.getType() != null ? p.getType() : "未知",
                        Collectors.counting()
                ));

        long categoryCount = allNormalProducts.stream()
                .map(Product::getCategory)
                .filter(c -> c != null && !c.isEmpty())
                .distinct()
                .count();

        long imageCount = allNormalProducts.stream()
                .filter(p -> p.getImage() != null && !p.getImage().isEmpty())
                .count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalProducts", totalCount);
        stats.put("activeProducts", typeCounts.getOrDefault("普通产品", 0L));
        stats.put("inactiveProducts", typeCounts.getOrDefault("组合产品", 0L));
        stats.put("draftProducts", typeCounts.getOrDefault("定制产品", 0L));
        stats.put("totalCategories", categoryCount);
        stats.put("totalImages", imageCount);

        return stats;
    }

    public List<String> getAllSkus(String productType) {
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Product::getStatus, "normal");

        if (StringUtils.hasText(productType)) {
            wrapper.eq(Product::getType, productType);
        }

        wrapper.orderByDesc(Product::getCreateTime);

        List<Product> products = productMapper.selectList(wrapper);
        return products.stream()
                .map(Product::getSku)
                .filter(StringUtils::hasText)
                .collect(Collectors.toList());
    }

    public List<Product> getAllProducts() {
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Product::getStatus, "normal");
        wrapper.orderByDesc(Product::getCreateTime);

        return productMapper.selectList(wrapper);
    }

    public List<Map<String, Object>> getCategories() {
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Product::getStatus, "normal");
        wrapper.isNotNull(Product::getCategory);
        wrapper.ne(Product::getCategory, "");

        List<Product> products = productMapper.selectList(wrapper);

        Map<String, Long> categoryCounts = products.stream()
                .collect(Collectors.groupingBy(
                        Product::getCategory,
                        Collectors.counting()
                ));

        return categoryCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(entry -> {
                    Map<String, Object> categoryInfo = new HashMap<>();
                    categoryInfo.put("category", entry.getKey());
                    categoryInfo.put("count", entry.getValue());
                    return categoryInfo;
                })
                .collect(Collectors.toList());
    }
}
