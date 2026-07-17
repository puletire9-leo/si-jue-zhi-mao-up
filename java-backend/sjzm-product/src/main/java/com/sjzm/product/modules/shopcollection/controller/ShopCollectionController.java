package com.sjzm.product.modules.shopcollection.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileProduct;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;
import com.sjzm.product.modules.shopcollection.dto.ShopCollectionDetail;
import com.sjzm.product.modules.shopcollection.dto.ShopCollectionInsight;
import com.sjzm.product.modules.shopcollection.dto.ShopProductSelectionQuery;
import com.sjzm.product.modules.shopcollection.dto.ShopSnapshot;
import com.sjzm.product.modules.shopcollection.dto.ShopScreeningQuery;
import com.sjzm.product.modules.shopcollection.dto.ShopScreeningRow;
import com.sjzm.product.modules.shopcollection.entity.ShopProduct;
import com.sjzm.product.modules.shopcollection.entity.ShopWatchlist;
import com.sjzm.product.modules.shopcollection.mapper.ShopProductMapper;
import com.sjzm.product.modules.shopcollection.service.ShopCollectionService;
import com.sjzm.product.modules.shopcollection.service.ShopWatchlistService;
import com.sjzm.product.modules.shopcollection.service.ShopScreeningService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 店铺分析第二/三条数据线统一入口：店铺观察池 + 店铺商品全集 + 快照 + 商品墙 + 历史对比。
 * 主线：方法卡命中 → 观察池（记录为什么盯）→ 抓店铺全集 → 画像解释。
 * 前缀 /api/v1/modules/shop-collection（网关 + nginx 已覆盖 /modules/**）。
 */
@RestController
@RequestMapping("/api/v1/modules/shop-collection")
@RequiredArgsConstructor
@Tag(name = "店铺全集与观察池", description = "方法卡命中→观察池→店铺全集抓取→画像解释→快照选择→商品墙→历史对比")
public class ShopCollectionController {

    private final ShopWatchlistService watchlistService;
    private final ShopCollectionService collectionService;
    private final ShopScreeningService screeningService;
    private final ShopProductMapper shopProductMapper;

    @PostMapping("/shop-screening")
    @Operation(summary = "统一店铺筛选工作台", description = "以 shop_products 周批次为口径，商品筛选后按店铺聚合并服务端分页")
    public Result<PageResult<ShopScreeningRow>> screenShops(@RequestBody ShopScreeningQuery query) {
        return Result.success(screeningService.screen(query));
    }

    @GetMapping("/screening-batches")
    @Operation(summary = "统一店铺筛选周批次")
    public Result<List<Map<String, Object>>> screeningBatches(@RequestParam String marketplace) {
        return Result.success(screeningService.batchOptions(marketplace));
    }

    // ============================================================
    // 观察池
    // ============================================================

    @PostMapping("/watchlist/sync-from-method-rank")
    @Deprecated(since = "店铺候选池链路落地", forRemoval = false)
    @Operation(summary = "已下线：方法卡不再直写观察池",
            description = "方法卡命中必须先写 shop_candidate_pool；前端请调用 /api/v1/modules/shop-candidates/sync-from-method-rank")
    public Result<Map<String, Object>> syncWatchlistFromMethodRank(
            @RequestParam(defaultValue = "M01") String methodId,
            @RequestParam(required = false) String marketplace,
            @RequestParam(defaultValue = "1") Integer minCount) {
        return Result.error("旧入口已下线：方法卡命中只允许进入「方法卡找店/候选池」，请调用 /api/v1/modules/shop-candidates/sync-from-method-rank");
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
    public Result<ShopWatchlist> addManualWatchlist(@RequestBody Map<String, Object> body) {
        String marketplace = (String) body.get("marketplace");
        String sellerName = (String) body.get("sellerName");
        String reason = (String) body.get("reason");
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
    @Deprecated(since = "卖家精灵请求中心落地", forRemoval = false)
    @Operation(summary = "已下线：禁止直连抓取店铺全集",
            description = "店铺全集抓取必须进入请求中心，候选池抓取请创建 CANDIDATE_BATCH 任务，人工抓取请创建 SHOP_FULL_LOOKUP 任务")
    public Result<Map<String, Object>> syncShopProducts(@RequestBody Map<String, Object> body) {
        return Result.error("旧入口已下线：卖家精灵店铺全集抓取必须进入「请求中心」，以便暂停/停止/重试和统计使用次数");
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

    @PostMapping("/selection-products")
    @Operation(summary = "统一选品页的店铺商品分页", description = "与新品榜共用选品页筛选口径，数据源固定 shop_products")
    public Result<PageResult<ShopProduct>> selectionProducts(@RequestBody ShopProductSelectionQuery query) {
        return Result.success(collectionService.selectionProducts(query));
    }

    @GetMapping("/selection-categories")
    @Operation(summary = "统一选品页的店铺商品类目")
    public Result<List<Map<String, Object>>> selectionCategories(@RequestParam String marketplace) {
        return Result.success(collectionService.selectionCategories(marketplace));
    }

    @PostMapping("/selection-categories/query")
    @Operation(summary = "统一选品页的店铺商品类目（同口径）", description = "复用当前店铺商品方法卡、批次和筛选条件，忽略当前类目自身")
    public Result<List<Map<String, Object>>> querySelectionCategories(
            @RequestBody ShopProductSelectionQuery query) {
        return Result.success(collectionService.selectionCategories(query));
    }

    @GetMapping("/selection-batches")
    @Operation(summary = "统一选品页的店铺抓取批次")
    public Result<List<Map<String, Object>>> selectionBatches(@RequestParam String marketplace) {
        return Result.success(collectionService.selectionBatches(marketplace));
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
            @RequestParam(defaultValue = "100") Integer limit,
            @RequestParam(required = false) String sourceRunId) {
        return Result.success(collectionService.summary(marketplace, batchDate, sellerName, minProductCount, limit, sourceRunId));
    }

    @GetMapping("/selection-shops")
    @Operation(summary = "选品中心竞品店铺列表", description = "读取 shop_products 店铺全集画像，带 M01 命中数和新品时间维度，供前端跳转到单店选品页面")
    public Result<List<ShopProfileSummary>> selectionShops(
            @RequestParam String marketplace,
            @RequestParam(required = false) String batchDate,
            @RequestParam(required = false) String sellerName,
            @RequestParam(required = false) Integer minProductCount,
            @RequestParam(required = false) Integer minM01HitCount,
            @RequestParam(required = false) Integer minNew90Count,
            @RequestParam(required = false) Integer minGoodTendencyCount,
            @RequestParam(required = false) Integer maxAttentionStrongCount,
            @RequestParam(defaultValue = "100") Integer limit,
            @RequestParam(required = false) String sourceRunId) {
        return Result.success(collectionService.selectionShops(
                marketplace, batchDate, sellerName, minProductCount, minM01HitCount, minNew90Count,
                minGoodTendencyCount, maxAttentionStrongCount, limit, sourceRunId));
    }

    @GetMapping("/{marketplace}/{sellerName}")
    @Operation(summary = "单店全景详情", description = "为什么进观察池 + 全集 A/B/C/D 画像 + 类目结构")
    public Result<ShopCollectionDetail> detail(
            @PathVariable String marketplace,
            @PathVariable String sellerName,
            @RequestParam(required = false) String batchDate,
            @RequestParam(required = false) String sourceRunId) {
        return Result.success(collectionService.detail(marketplace, sellerName, batchDate, sourceRunId));
    }

    @GetMapping("/{marketplace}/{sellerName}/insight")
    @Operation(summary = "单店全集画像分析", description = "M01 命中、上架时间、销量等级、类目结构和注意/好品倾向标签")
    public Result<ShopCollectionInsight> insight(
            @PathVariable String marketplace,
            @PathVariable String sellerName,
            @RequestParam(required = false) String sourceRunId,
            @RequestParam(required = false) String batchCode) {
        return Result.success(collectionService.insight(marketplace, sellerName, sourceRunId, batchCode));
    }

    @GetMapping("/{marketplace}/{sellerName}/products")
    @Operation(summary = "单店全集商品明细", description = "三维筛选：销量层 salesTier / 时间层 ageBucket / 注意层 attentionLevel / M01 命中 / 关键词 / 类目")
    public Result<PageResult<ShopProfileProduct>> shopProducts(
            @PathVariable String marketplace,
            @PathVariable String sellerName,
            @RequestParam(required = false) String batchDate,
            @RequestParam(required = false) String sourceRunId,
            @RequestParam(required = false) String salesTier,
            @RequestParam(required = false) String ageBucket,
            @RequestParam(required = false) String attentionLevel,
            @RequestParam(required = false) Boolean m01Only,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "60") Integer size) {
        return Result.success(collectionService.products(marketplace, sellerName, batchDate, sourceRunId,
                salesTier, ageBucket, attentionLevel, m01Only, keyword, category, page, size));
    }

    // ============================================================
    // 快照选择器 + 商品墙
    // ============================================================

    @GetMapping("/{marketplace}/{sellerName}/snapshots")
    @Operation(summary = "店铺快照历史列表", description = "该店铺所有成功抓取快照，按 batchCode 降序")
    public Result<List<ShopSnapshot>> snapshots(
            @PathVariable String marketplace,
            @PathVariable String sellerName) {
        return Result.success(collectionService.snapshots(marketplace, sellerName));
    }

    @GetMapping("/{marketplace}/{sellerName}/product-wall")
    @Operation(summary = "商品墙（图片主导，按销量等级分区）", description = "解析快照后按 A/B/C/D/UNKNOWN 分区返回商品；可选 salesTier 只查指定等级")
    public Result<Map<String, Object>> productWall(
            @PathVariable String marketplace,
            @PathVariable String sellerName,
            @RequestParam(required = false) String sourceRunId,
            @RequestParam(required = false) String batchCode,
            @RequestParam(required = false) String salesTier,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "24") Integer size) {
        return Result.success(collectionService.productWall(marketplace, sellerName, sourceRunId, batchCode, salesTier, page, size));
    }

    // ============================================================
    // 历史对比
    // ============================================================

    @GetMapping("/{marketplace}/{sellerName}/compare")
    @Operation(summary = "单店历史对比", description = "两个快照的新增/消失/保留/等级变化")
    public Result<Map<String, Object>> compare(
            @PathVariable String marketplace,
            @PathVariable String sellerName,
            @RequestParam String baselineRunId,
            @RequestParam String compareRunId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "60") Integer size) {
        return Result.success(collectionService.compare(marketplace, sellerName, baselineRunId, compareRunId, page, size));
    }
}
