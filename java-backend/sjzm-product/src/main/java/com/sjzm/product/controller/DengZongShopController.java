package com.sjzm.product.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.common.Result;
import com.sjzm.product.entity.DengZongShop;
import com.sjzm.product.entity.DengZongShopSeller;
import com.sjzm.product.mapper.DengZongShopMapper;
import com.sjzm.product.mapper.DengZongShopSellerMapper;
import com.sjzm.product.service.DengZongShopService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
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

    private final DengZongShopMapper mapper;
    private final DengZongShopSellerMapper sellerMapper;
    private final DengZongShopService dengZongShopService;

    @GetMapping("/products")
    @Operation(summary = "查询邓总店铺产品（按父ASIN去重）")
    public Result<Map<String, Object>> list(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) String sellerName,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "60") Integer size) {

        int offset = (page - 1) * size;
        // 验证 sortOrder 防止 SQL 注入
        String safeSortOrder = "asc".equalsIgnoreCase(sortOrder) ? "ASC" : "DESC";
        long total = mapper.countGroupedByParent(marketplace, month, brand, sellerName, title, category);
        List<DengZongShop> list = mapper.selectGroupedByParent(
                marketplace, month, brand, sellerName, title, category, sortBy, safeSortOrder, offset, size);

        List<Map<String, Object>> items = list.stream().map(this::toResponse).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", items);
        result.put("total", total);
        result.put("page", page);
        result.put("size", size);
        return Result.success(result);
    }

    @GetMapping("/stats")
    @Operation(summary = "邓总店铺统计")
    public Result<Map<String, Object>> stats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", mapper.selectCount(null));
        return Result.success(stats);
    }

    // ========== 卖家 CRUD ==========

    @GetMapping("/seller-summary")
    @Operation(summary = "按卖家分组汇总（商品数/营收/评分）")
    public Result<List<Map<String, Object>>> sellerSummary(
            @RequestParam(required = false) String marketplace) {
        List<Map<String, Object>> summary = mapper.selectSellerSummary(marketplace);
        // 合并 seller 表的 storeUrl 和 notes
        LambdaQueryWrapper<DengZongShopSeller> qw = new LambdaQueryWrapper<>();
        if (marketplace != null && !marketplace.isEmpty()) {
            qw.eq(DengZongShopSeller::getMarketplace, marketplace);
        }
        List<DengZongShopSeller> sellers = sellerMapper.selectList(qw);
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
        return Result.success(sellerMapper.selectList(qw));
    }

    @PostMapping("/sellers")
    @Operation(summary = "新增卖家")
    public Result<DengZongShopSeller> createSeller(@RequestBody DengZongShopSeller seller) {
        sellerMapper.insert(seller);
        return Result.success(seller);
    }

    @PutMapping("/sellers/{id}")
    @Operation(summary = "更新卖家")
    public Result<DengZongShopSeller> updateSeller(@PathVariable Long id, @RequestBody DengZongShopSeller seller) {
        seller.setId(id);
        sellerMapper.updateById(seller);
        return Result.success(seller);
    }

    @DeleteMapping("/sellers/{id}")
    @Operation(summary = "删除卖家")
    public Result<Void> deleteSeller(@PathVariable Long id) {
        sellerMapper.deleteById(id);
        return Result.success(null);
    }

    // ========== 同步 ==========

    @PostMapping("/sync")
    @Operation(summary = "按店铺名同步卖家精灵数据到 deng_zong_shop 表")
    public Result<Map<String, Object>> sync(@RequestBody Map<String, String> body) {
        String sellerName = body.get("sellerName");
        String marketplace = body.get("marketplace");
        if (sellerName == null || sellerName.isBlank()) {
            return Result.error("sellerName 不能为空");
        }
        if (marketplace == null || marketplace.isBlank()) {
            return Result.error("marketplace 不能为空");
        }
        Map<String, Object> result = dengZongShopService.syncBySellerName(sellerName.trim(), marketplace.trim());
        return Result.success("同步完成", result);
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
        m.put("bestSeller", d.getBestSeller());
        m.put("amazonChoice", d.getAmazonChoice());
        m.put("newRelease", d.getNewRelease());
        m.put("ebc", d.getEbc());
        m.put("video", d.getVideo());
        m.put("productUrl", d.getProductUrl());
        m.put("similarUrl", d.getSimilarUrl());
        m.put("source", d.getSource());
        m.put("availableDate", d.getAvailableDate());
        m.put("createdAt", d.getCreatedAt());
        m.put("updatedAt", d.getUpdatedAt());
        return m;
    }
}
