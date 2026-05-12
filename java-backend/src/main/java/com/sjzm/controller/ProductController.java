package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.entity.Product;
import com.sjzm.service.ProductExportService;
import com.sjzm.service.ProductImportService;
import com.sjzm.service.ProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 产品管理控制器
 */
@Slf4j
@Tag(name = "产品管理", description = "产品 CRUD、批量操作、导入导出")
@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;
    private final ProductImportService productImportService;
    private final ProductExportService productExportService;

    @Operation(summary = "获取产品列表", description = "分页查询产品，支持关键词、分类、类型筛选")
    @GetMapping
    public Result<PageResult<Product>> listProducts(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword,
            @Parameter(description = "分类") @RequestParam(required = false) String category,
            @Parameter(description = "类型") @RequestParam(required = false) String type) {
        try {
            PageResult<Product> result = productService.listProducts(page, size, keyword, category, type);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取产品列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取产品列表（/list端点）", description = "分页查询产品，支持关键词、分类、类型筛选")
    @GetMapping("/list")
    public Result<PageResult<Product>> listProductsEndpoint(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword,
            @Parameter(description = "分类") @RequestParam(required = false) String category,
            @Parameter(description = "类型") @RequestParam(required = false) String type) {
        try {
            PageResult<Product> result = productService.listProducts(page, size, keyword, category, type);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取产品列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取产品详情", description = "根据SKU获取产品详细信息")
    @GetMapping("/{sku}")
    public Result<Product> getProduct(@PathVariable String sku) {
        try {
            Product product = productService.getProductBySku(sku);
            return Result.success(product);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取产品详情失败: " + e.getMessage());
        }
    }

    @Operation(summary = "创建产品", description = "创建新产品")
    @PostMapping
    public Result<Product> createProduct(@RequestBody Product product) {
        try {
            Product created = productService.createProduct(product);
            return Result.success(created);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("创建产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新产品", description = "根据SKU更新产品信息")
    @PutMapping("/{sku}")
    public Result<Product> updateProduct(@PathVariable String sku, @RequestBody Product product) {
        try {
            Product existing = productService.getProductBySku(sku);
            Product updated = productService.updateProduct(existing.getId(), product);
            return Result.success(updated);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("更新产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "删除产品", description = "根据SKU删除产品（逻辑删除）")
    @DeleteMapping("/{sku}")
    public Result<Void> deleteProduct(@PathVariable String sku) {
        try {
            Product existing = productService.getProductBySku(sku);
            productService.deleteProduct(existing.getId());
            return Result.success();
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("删除产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量删除产品", description = "根据ID列表批量删除产品")
    @DeleteMapping("/batch")
    public Result<Map<String, Object>> batchDeleteProducts(@RequestBody List<Long> ids) {
        try {
            Map<String, Object> result = productService.batchDeleteProducts(ids);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量删除产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量导入产品", description = "批量导入产品数据")
    @PostMapping("/import")
    @SuppressWarnings("unchecked")
    public Result<Map<String, Object>> batchImportProducts(@RequestBody Map<String, Object> importRequest) {
        try {
            List<Product> products = (List<Product>) importRequest.get("products");
            boolean overwrite = importRequest.containsKey("overwrite") && (Boolean) importRequest.get("overwrite");
            Map<String, Object> result = productService.batchImportProducts(products, overwrite);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量导入产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "Excel导入产品", description = "上传Excel文件批量导入产品")
    @PostMapping("/import/excel")
    public Result<Map<String, Object>> importFromExcel(
            @Parameter(description = "Excel文件(.xlsx/.xls)") @RequestParam("file") MultipartFile file,
            @Parameter(description = "是否覆盖已存在的SKU") @RequestParam(defaultValue = "false") boolean overwrite) {
        try {
            log.info("Excel导入产品: filename={}, size={}, overwrite={}",
                    file.getOriginalFilename(), file.getSize(), overwrite);
            Map<String, Object> result = productImportService.importFromExcel(file, overwrite);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Excel导入产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "下载产品导入模板", description = "下载Excel导入模板文件")
    @GetMapping("/import/template")
    public ResponseEntity<byte[]> downloadImportTemplate() {
        try {
            byte[] template = productImportService.generateImportTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "product_import_template.xlsx");
            return ResponseEntity.ok().headers(headers).body(template);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("下载导入模板失败: " + e.getMessage());
        }
    }

    @Operation(summary = "导出产品", description = "导出产品为Excel文件")
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportProducts(
            @Parameter(description = "产品ID列表") @RequestParam(required = false) List<Long> ids,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword,
            @Parameter(description = "分类") @RequestParam(required = false) String category,
            @Parameter(description = "产品类型") @RequestParam(required = false) String type) {
        try {
            log.info("导出产品: ids={}, keyword={}, category={}, type={}",
                    ids != null ? ids.size() : 0, keyword, category, type);
            byte[] data = productExportService.exportProducts(ids, keyword, category, type);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "products_export.xlsx");
            return ResponseEntity.ok().headers(headers).body(data);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("导出产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "按SKU导出产品", description = "根据SKU列表导出产品为Excel文件")
    @GetMapping("/export/by-skus")
    public ResponseEntity<byte[]> exportProductsBySkus(
            @Parameter(description = "SKU列表") @RequestParam List<String> skus) {
        try {
            log.info("按SKU导出产品: {}条", skus.size());
            byte[] data = productExportService.exportProductsBySkus(skus);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "products_export.xlsx");
            return ResponseEntity.ok().headers(headers).body(data);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("按SKU导出产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "下载产品导出模板", description = "下载产品导出模板文件")
    @GetMapping("/export/template")
    public ResponseEntity<byte[]> downloadExportTemplate() {
        try {
            byte[] template = productExportService.exportProductsTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "product_export_template.xlsx");
            return ResponseEntity.ok().headers(headers).body(template);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("下载导出模板失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取产品统计", description = "获取产品统计数据")
    @GetMapping("/stats")
    public Result<Map<String, Object>> getProductStats() {
        try {
            Map<String, Object> stats = productService.getProductStats();
            return Result.success(stats);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取产品统计失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量删除产品（按SKU）", description = "根据SKU列表批量删除产品")
    @PostMapping("/batch-delete")
    public Result<Map<String, Object>> batchDeleteBySkus(@RequestBody List<String> skus) {
        try {
            List<Long> ids = new ArrayList<>();
            for (String sku : skus) {
                Product product = productService.getProductBySku(sku);
                ids.add(product.getId());
            }
            Map<String, Object> result = productService.batchDeleteProducts(ids);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("按SKU批量删除产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量更新产品", description = "批量更新产品信息")
    @PutMapping("/batch")
    public Result<Map<String, Object>> batchUpdateProducts(@RequestBody List<Product> products) {
        try {
            int successCount = 0;
            List<String> failedSkus = new ArrayList<>();
            for (Product product : products) {
                try {
                    Product existing = productService.getProductBySku(product.getSku());
                    productService.updateProduct(existing.getId(), product);
                    successCount++;
                } catch (Exception e) {
                    failedSkus.add(product.getSku());
                }
            }
            Map<String, Object> resultMap = new HashMap<>();
            resultMap.put("total", products.size());
            resultMap.put("success", successCount);
            resultMap.put("failed", failedSkus.size());
            resultMap.put("failedSkus", failedSkus);
            return Result.success(resultMap);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量更新产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取所有SKU列表", description = "获取所有产品的SKU列表")
    @GetMapping("/skus")
    public Result<List<String>> getAllSkus() {
        try {
            PageResult<Product> result = productService.listProducts(1, 10000, null, null, null);
            List<String> skuList = result.getList().stream()
                    .map(Product::getSku)
                    .collect(Collectors.toList());
            return Result.success(skuList);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取SKU列表失败: " + e.getMessage());
        }
    }
}
