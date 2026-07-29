package com.sjzm.product.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.common.Result;
import com.sjzm.product.entity.DengZongShop;
import com.sjzm.product.entity.DengZongShopSeller;
import com.sjzm.product.dto.DengZongShopSyncBatchRequest;
import com.sjzm.product.service.DengZongShopService;
import com.sjzm.product.modules.requestcenter.service.SellerspriteRequestCenterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/deng-zong-shop")
@RequiredArgsConstructor
@Tag(name = "邓总店铺", description = "邓总店铺产品数据")
public class DengZongShopController {

    // FIXED: MED-6 — Controller 不再直接注入 Mapper，改用 Service 委托
    private final DengZongShopService dengZongShopService;
    private final SellerspriteRequestCenterService requestCenterService;

    @GetMapping("/products")
    @Operation(summary = "查询邓总店铺产品（按父ASIN去重）")
    public Result<Map<String, Object>> list(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) String sellerName,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) List<String> asins,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String bsrId,
            @RequestParam(required = false) Long nodeId,
            @RequestParam(required = false) java.math.BigDecimal priceMin,
            @RequestParam(required = false) java.math.BigDecimal priceMax,
            @RequestParam(required = false) Integer unitsMin,
            @RequestParam(required = false) Integer unitsMax,
            @RequestParam(required = false) Integer listingDaysMin,
            @RequestParam(required = false) Integer listingDaysMax,
            @RequestParam(required = false) Integer bsrMax,
            @RequestParam(required = false) java.math.BigDecimal ratingMin,
            @RequestParam(required = false) java.math.BigDecimal weightMax,
            @RequestParam(required = false) List<String> fulfillment,
            @RequestParam(required = false) Integer maxVariantCount,
            @RequestParam(required = false) String batchDate,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "60") Integer size) {

        int safePage = Math.max(1, page == null ? 1 : page);
        int offset = (safePage - 1) * size;
        // 验证 sortOrder 防止 SQL 注入
        String safeSortOrder = "asc".equalsIgnoreCase(sortOrder) ? "ASC" : "DESC";
        long total = dengZongShopService.countGroupedByParent(
                marketplace, month, brand, sellerName, title, asins, category, bsrId, nodeId,
                priceMin, priceMax, unitsMin, unitsMax, listingDaysMin, listingDaysMax,
                bsrMax, ratingMin, weightMax, fulfillment, maxVariantCount, batchDate);
        List<DengZongShop> list = dengZongShopService.selectGroupedByParent(
                marketplace, month, brand, sellerName, title, asins, category, bsrId, nodeId,
                priceMin, priceMax, unitsMin, unitsMax, listingDaysMin, listingDaysMax,
                bsrMax, ratingMin, weightMax, fulfillment, maxVariantCount, batchDate,
                sortBy, safeSortOrder, offset, size);

        List<Map<String, Object>> items = list.stream().map(this::toResponse).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", items);
        result.put("total", total);
        result.put("page", page);
        result.put("size", size);
        return Result.success(result);
    }

    @GetMapping("/variants")
    @Operation(summary = "查询某父ASIN下的所有变体")
    public Result<List<Map<String, Object>>> variants(
            @RequestParam String marketplace,
            @RequestParam @Size(min = 10, max = 20) String parentAsin,
            @RequestParam(required = false) String batchDate) { // FIXED: MED-7
        LambdaQueryWrapper<DengZongShop> qw = new LambdaQueryWrapper<>();
        qw.eq(DengZongShop::getMarketplace, marketplace);
        qw.and(w -> w.eq(DengZongShop::getParentAsin, parentAsin)
                .or().eq(DengZongShop::getAsin, parentAsin));
        qw.isNotNull(DengZongShop::getTitle);
        if (batchDate != null) {
            qw.eq(DengZongShop::getBatchDate, batchDate);
        }
        qw.orderByAsc(DengZongShop::getBsr);
        List<DengZongShop> list = dengZongShopService.shopSelectList(qw);
        List<Map<String, Object>> items = list.stream().map(this::toResponse).collect(Collectors.toList());
        return Result.success(items);
    }

    @GetMapping("/stats")
    @Operation(summary = "邓总店铺统计")
    public Result<Map<String, Object>> stats(
            @RequestParam(required = false) String batchDate) {
        Map<String, Object> stats = new LinkedHashMap<>();
        LambdaQueryWrapper<DengZongShop> qw = new LambdaQueryWrapper<>();
        if (batchDate != null) {
            qw.eq(DengZongShop::getBatchDate, batchDate);
        }
        stats.put("total", dengZongShopService.shopSelectCount(qw));
        return Result.success(stats);
    }

    @GetMapping("/max-month")
    @Operation(summary = "邓总店铺最新数据月份")
    public Result<String> maxMonth(@RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(dengZongShopService.getMaxMonth(marketplace));
    }

    @GetMapping("/max-batch-date")
    @Operation(summary = "邓总店铺最新批次日期")
    public Result<String> maxBatchDate(@RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(dengZongShopService.getMaxBatchDate(marketplace));
    }

    @GetMapping("/batch-dates")
    @Operation(summary = "郑总店铺批次日期列表")
    public Result<List<Map<String, Object>>> batchDates(
            @RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(dengZongShopService.selectBatchDatesWithCount(marketplace));
    }

    @GetMapping("/completeness")
    @Operation(summary = "郑总店铺数据完整性", description = "名单全集 vs 最新批次已抓取，返回缺数据店铺名单")
    public Result<Map<String, Object>> completeness(@RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(dengZongShopService.getCompleteness(marketplace));
    }

    // ========== 卖家 CRUD ==========

    @GetMapping("/seller-summary")
    @Operation(summary = "按卖家分组汇总（商品数/营收/评分）")
    public Result<List<Map<String, Object>>> sellerSummary(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String batchDate) {
        List<Map<String, Object>> summary = dengZongShopService.selectSellerSummary(marketplace, batchDate);
        // 合并 seller 表的 storeUrl 和 notes
        LambdaQueryWrapper<DengZongShopSeller> qw = new LambdaQueryWrapper<>();
        if (marketplace != null && !marketplace.isEmpty()) {
            qw.eq(DengZongShopSeller::getMarketplace, marketplace);
        }
        List<DengZongShopSeller> sellers = dengZongShopService.sellerSelectList(qw);
        Map<String, DengZongShopSeller> sellerMap = sellers.stream()
                .collect(Collectors.toMap(
                        s -> s.getMarketplace() + ":" + s.getSellerName(),
                        s -> s, (a, b) -> a));
        for (Map<String, Object> row : summary) {
            Object mp = row.get("marketplace");
            Object sn = row.get("sellerName");
            if (mp == null || sn == null) continue;
            String key = mp + ":" + sn;
            DengZongShopSeller seller = sellerMap.get(key);
            if (seller != null) {
                row.put("storeUrl", seller.getStoreUrl());
                row.put("notes", seller.getNotes());
                row.put("sellerId", seller.getId());
                row.put("lastSyncedAt", seller.getLastSyncedAt());
            }
        }
        return Result.success(summary);
    }

    @GetMapping("/sellers")
    @Operation(summary = "查询卖家列表")
    public Result<List<DengZongShopSeller>> listSellers(
            @RequestParam(required = false) String marketplace) {
        LambdaQueryWrapper<DengZongShopSeller> qw = new LambdaQueryWrapper<>();
        if (marketplace != null && !marketplace.isEmpty()) {
            qw.eq(DengZongShopSeller::getMarketplace, marketplace);
        }
        qw.orderByAsc(DengZongShopSeller::getMarketplace, DengZongShopSeller::getSellerName);
        return Result.success(dengZongShopService.sellerSelectList(qw));
    }

    @PostMapping("/sellers")
    @Operation(summary = "新增卖家")
    public Result<DengZongShopSeller> createSeller(@RequestBody DengZongShopSeller seller) {
        dengZongShopService.sellerInsert(seller);
        return Result.success(seller);
    }

    @PutMapping("/sellers/{id}")
    @Operation(summary = "更新卖家")
    public Result<DengZongShopSeller> updateSeller(@PathVariable Long id, @RequestBody DengZongShopSeller seller) {
        seller.setId(id);
        dengZongShopService.sellerUpdateById(seller);
        return Result.success(seller);
    }

    @DeleteMapping("/sellers/{id}")
    @Operation(summary = "删除卖家")
    public Result<Void> deleteSeller(@PathVariable Long id) {
        dengZongShopService.sellerDeleteById(id);
        return Result.success(null);
    }

    // ========== 同步 ==========

    @PostMapping("/sync")
    @Operation(summary = "创建单店非标店铺上新任务（兼容入口）",
            description = "只允许已登记在 deng_zong_shop_seller 的店铺，并代理到非标店铺专用批量入口")
    public Result<Map<String, Object>> sync(@RequestBody Map<String, String> body) {
        String sellerName = body.get("sellerName");
        String marketplace = body.get("marketplace");
        if (sellerName == null || sellerName.isBlank()) {
            return Result.error("sellerName 不能为空");
        }
        if (marketplace == null || marketplace.isBlank()) {
            return Result.error("marketplace 不能为空");
        }
        String normalizedMarketplace = marketplace.trim().toUpperCase(java.util.Locale.ROOT);
        String normalizedSellerName = sellerName.trim();
        List<DengZongShopSeller> registered = dengZongShopService.sellerSelectList(
                new LambdaQueryWrapper<DengZongShopSeller>()
                        .eq(DengZongShopSeller::getMarketplace, normalizedMarketplace)
                        .eq(DengZongShopSeller::getSellerName, normalizedSellerName));
        if (registered.isEmpty()) {
            return Result.error("该店铺未登记在非标店铺名单，请先到店铺请求中心登记");
        }
        return Result.success(requestCenterService.createDengZongShopTask(
                List.of(registered.get(0).getId()), "DENG_ZONG_COMPAT_API"));
    }

    @PostMapping("/sync/batch")
    @Operation(summary = "批量创建非标店铺上新任务",
            description = "只读取 deng_zong_shop_seller 登记名单，固定创建 DENG_ZONG_SHOP_SYNC，结果只写 deng_zong_shop")
    public Result<Map<String, Object>> syncBatch(@Valid @RequestBody DengZongShopSyncBatchRequest request) {
        return Result.success(requestCenterService.createDengZongShopTask(
                request.getSellerIds(), "DENG_ZONG_REQUEST_CENTER"));
    }

    private Map<String, Object> toResponse(DengZongShop d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.getId());
        m.put("marketplace", d.getMarketplace());
        m.put("asin", d.getAsin());
        m.put("month", d.getMonth());
        m.put("title", d.getTitle());
        m.put("brand", d.getBrand());
        m.put("brandUrl", d.getBrandUrl());
        m.put("imageUrl", d.getImageUrl());
        m.put("parentAsin", d.getParentAsin());
        m.put("sku", d.getSku());
        m.put("nodeId", d.getNodeId());
        m.put("nodeIdPath", d.getNodeIdPath());
        m.put("nodeLabelPath", d.getNodeLabelPath());
        m.put("symbol", d.getSymbol());
        m.put("units", d.getUnits());
        m.put("unitsGr", d.getUnitsGr());
        m.put("amzUnit", d.getAmzUnit());
        m.put("amzSales", d.getAmzSales());
        m.put("revenue", d.getRevenue());
        m.put("bsrId", d.getBsrId());
        m.put("bsr", d.getBsr());
        m.put("bsrCr", d.getBsrCr());
        m.put("bsrCv", d.getBsrCv());
        m.put("ratings", d.getRatings());
        m.put("rating", d.getRating());
        m.put("ratingsRate", d.getRatingsRate());
        m.put("ratingsCv", d.getRatingsCv());
        m.put("ratingDelta", d.getRatingDelta());
        m.put("price", d.getPrice());
        m.put("primePrice", d.getPrimePrice());
        m.put("profit", d.getProfit());
        m.put("fba", d.getFba());
        m.put("deliveryPrice", d.getDeliveryPrice());
        m.put("sellerName", d.getSellerName());
        m.put("sellerId", d.getSellerId());
        m.put("sellerNation", d.getSellerNation());
        m.put("sellers", d.getSellers());
        m.put("fulfillment", d.getFulfillment());
        m.put("variations", d.getVariations());
        m.put("weight", d.getWeight());
        m.put("dimension", d.getDimension());
        m.put("dimensionsType", d.getDimensionsType());
        m.put("pkgDimensions", d.getPkgDimensions());
        m.put("pkgDimensionType", d.getPkgDimensionType());
        m.put("pkgWeight", d.getPkgWeight());
        m.put("lqs", d.getLqs());
        m.put("bestSeller", d.getBestSeller());
        m.put("amazonChoice", d.getAmazonChoice());
        m.put("newRelease", d.getNewRelease());
        m.put("ebc", d.getEbc());
        m.put("video", d.getVideo());
        m.put("productUrl", d.getProductUrl());
        m.put("similarUrl", d.getSimilarUrl());
        m.put("source", d.getSource());
        m.put("batchDate", d.getBatchDate());
        m.put("variantCount", d.getVariantCount());
        m.put("availableDate", d.getAvailableDate());
        m.put("createdAt", d.getCreatedAt());
        m.put("updatedAt", d.getUpdatedAt());
        return m;
    }
}
