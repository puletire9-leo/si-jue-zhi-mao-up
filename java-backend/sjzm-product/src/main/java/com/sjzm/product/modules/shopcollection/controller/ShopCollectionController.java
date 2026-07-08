package com.sjzm.product.modules.shopcollection.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileProduct;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;
import com.sjzm.product.modules.shopcollection.dto.ShopCollectionDetail;
import com.sjzm.product.modules.shopcollection.entity.ShopProduct;
import com.sjzm.product.modules.shopcollection.entity.ShopWatchlist;
import com.sjzm.product.modules.shopcollection.mapper.ShopProductMapper;
import com.sjzm.product.modules.shopcollection.service.ShopCollectionService;
import com.sjzm.product.modules.shopcollection.service.ShopProductSyncService;
import com.sjzm.product.modules.shopcollection.service.ShopWatchlistService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 店铺分析第二/三条数据线统一入口：店铺观察池 + 店铺商品全集。
 * 主线：方法卡命中 → 观察池（记录为什么盯）→ 抓店铺全集 → 画像解释。
 * 前缀 /api/v1/modules/shop-collection（网关 + nginx 已覆盖 /modules/**）。
 */
@RestController
@RequestMapping("/api/v1/modules/shop-collection")
@RequiredArgsConstructor
@Tag(name = "店铺全集与观察池", description = "方法卡命中→观察池→店铺全集抓取→画像解释")
public class ShopCollectionController {

    private final ShopWatchlistService watchlistService;
    private final ShopProductSyncService syncService;
    private final ShopCollectionService collectionService;
    private final ShopProductMapper shopProductMapper;

    // ============================================================
    // 观察池
    // ============================================================

    @PostMapping("/watchlist/sync-from-method-rank")
    @Operation(summary = "方法卡排名同步观察池", description = "跑方法卡店铺排名（M01），把命中达标店铺写入 shop_watchlist")
    public Result<Map<String, Object>> syncWatchlistFromMethodRank(
            @RequestParam(defaultValue = "M01") String methodId,
            @RequestParam(required = false) String marketplace,
            @RequestParam(defaultValue = "1") Integer minCount) {
        return Result.success(watchlistService.syncFromMethodRank(methodId, marketplace, minCount));
    }

    @GetMapping("/watchlist")
    @Operation(summary = "查询观察池", description = "按站点/状态/来源类型筛选，按命中数倒序")
    public Result<List<ShopWatchlist>> listWatchlist(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String sourceType) {
        return Result.success(watchlistService.list(marketplace, status, sourceType));
    }

    @PostMapping("/watchlist/manual")
    @Operation(summary = "人工加入观察池")
    public Result<ShopWatchlist> addManualWatchlist(@RequestBody JsonNode body) {
        String marketplace = body.path("marketplace").asText(null);
        String sellerName = body.path("sellerName").asText(null);
        String reason = body.path("reason").asText(null);
        return Result.success(watchlistService.addManual(marketplace, sellerName, reason));
    }

    @PutMapping("/watchlist/{id}/status")
    @Operation(summary = "更新观察池状态", description = "WATCHING/FETCHED/CONFIRMED/IGNORED")
    public Result<Void> updateWatchlistStatus(@PathVariable Long id, @RequestParam String status) {
        watchlistService.updateStatus(id, status);
        return Result.success();
    }

    @DeleteMapping("/watchlist/{id}")
    @Operation(summary = "移除观察池记录")
    public Result<Void> removeWatchlist(@PathVariable Long id) {
        watchlistService.remove(id);
        return Result.success();
    }

    // ============================================================
    // 店铺全集抓取
    // ============================================================

    @PostMapping("/products/sync")
    @Operation(summary = "抓取店铺全集", description = "卖家精灵店铺名查询（variation=Y），写 shop_products；消耗卖家精灵使用次数，勿反复触发")
    public Result<Map<String, Object>> syncShopProducts(@RequestBody JsonNode body) {
        String sellerName = body.path("sellerName").asText(null);
        String marketplace = body.path("marketplace").asText(null);
        String fetchReason = body.path("fetchReason").asText(null);
        Long watchlistId = body.path("watchlistId").isNumber() ? body.path("watchlistId").asLong() : null;
        if (!StringUtils.hasText(sellerName) || !StringUtils.hasText(marketplace)) {
            return Result.error("sellerName 和 marketplace 不能为空");
        }
        Map<String, Object> result = syncService.syncBySellerName(sellerName, marketplace, fetchReason, watchlistId);
        if (watchlistId != null) {
            watchlistService.markFetched(watchlistId, String.valueOf(result.get("runId")));
        }
        return Result.success(result);
    }

    @GetMapping("/products")
    @Operation(summary = "店铺全集原始分页", description = "按店铺/ASIN 直接查 shop_products 原始行（含变体元信息）")
    public Result<Page<ShopProduct>> listShopProducts(
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String sellerName,
            @RequestParam(required = false) String asin) {
        LambdaQueryWrapper<ShopProduct> qw = new LambdaQueryWrapper<ShopProduct>()
                .eq(StringUtils.hasText(marketplace), ShopProduct::getMarketplace, marketplace)
                .eq(StringUtils.hasText(sellerName), ShopProduct::getSellerName, sellerName)
                .like(StringUtils.hasText(asin), ShopProduct::getAsin, asin)
                .orderByDesc(ShopProduct::getUpdatedAt);
        return Result.success(shopProductMapper.selectPage(new Page<>(current, size), qw));
    }

    // ============================================================
    // 店铺全集画像（读侧聚合，逻辑同 shop-profile，数据源 shop_products）
    // ============================================================

    @GetMapping("/summary")
    @Operation(summary = "店铺全集画像列表", description = "按店铺聚合 A/B/C/D、ABC 稳定盘、D 测品池、top 类目")
    public Result<List<ShopProfileSummary>> summary(
            @RequestParam String marketplace,
            @RequestParam(required = false) String batchDate,
            @RequestParam(required = false) String sellerName,
            @RequestParam(required = false) Integer minProductCount,
            @RequestParam(defaultValue = "100") Integer limit) {
        return Result.success(collectionService.summary(marketplace, batchDate, sellerName, minProductCount, limit));
    }

    @GetMapping("/{marketplace}/{sellerName}")
    @Operation(summary = "单店全景详情", description = "为什么进观察池 + 全集 A/B/C/D 画像 + 类目结构")
    public Result<ShopCollectionDetail> detail(
            @PathVariable String marketplace,
            @PathVariable String sellerName,
            @RequestParam(required = false) String batchDate) {
        return Result.success(collectionService.detail(marketplace, sellerName, batchDate));
    }

    @GetMapping("/{marketplace}/{sellerName}/products")
    @Operation(summary = "单店全集商品明细", description = "按销量等级和类目查看父体去重后的商品明细")
    public Result<PageResult<ShopProfileProduct>> shopProducts(
            @PathVariable String marketplace,
            @PathVariable String sellerName,
            @RequestParam(required = false) String batchDate,
            @RequestParam(required = false) String salesTier,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "60") Integer size) {
        return Result.success(collectionService.products(marketplace, sellerName, batchDate, salesTier, category, page, size));
    }
}
