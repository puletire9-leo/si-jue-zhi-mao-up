package com.sjzm.product.modules.lingxing.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.common.Result;
import com.sjzm.product.mapper.LingxingListingMapper;
import com.sjzm.product.mapper.LingxingLocalProductMapper;
import com.sjzm.product.mapper.LingxingProductPerformanceMapper;
import com.sjzm.product.mapper.LingxingProductUnifiedMapper;
import com.sjzm.product.mapper.LingxingProfitAsinMapper;
import com.sjzm.product.mapper.LingxingSellerMapper;
import com.sjzm.product.mapper.LingxingSkuDataLayerMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingListing;
import com.sjzm.product.modules.lingxing.entity.LingxingFbaFeeCompare;
import com.sjzm.product.mapper.LingxingFbaFeeCompareMapper;
import com.sjzm.product.modules.lingxing.service.LingxingFbaFeeCompareService;
import com.sjzm.product.modules.lingxing.entity.LingxingLocalProduct;
import com.sjzm.product.modules.lingxing.entity.LingxingProductPerformance;
import com.sjzm.product.modules.lingxing.entity.LingxingProductUnified;
import com.sjzm.product.modules.lingxing.entity.LingxingProfitAsin;
import com.sjzm.product.modules.lingxing.entity.LingxingSeller;
import com.sjzm.product.modules.lingxing.dto.LingxingCredentialsRequest;
import com.sjzm.product.modules.lingxing.service.LingxingClient;
import com.sjzm.product.modules.lingxing.service.LingxingConfigService;
import com.sjzm.product.modules.lingxing.service.LingxingListingSyncService;
import com.sjzm.product.modules.lingxing.service.LingxingLocalProductSyncService;
import com.sjzm.product.modules.lingxing.service.LingxingProductPerformanceSyncService;
import com.sjzm.product.modules.lingxing.service.LingxingProductUnifiedService;
import com.sjzm.product.modules.lingxing.service.LingxingScheduledSyncService;
import com.sjzm.product.modules.lingxing.service.LingxingSkuDataLayerService;
import com.sjzm.product.modules.lingxing.service.LingxingOverviewService;
import com.sjzm.product.modules.lingxing.service.LingxingProfitAsinSyncService;
import com.sjzm.product.modules.lingxing.service.LingxingPurchaseDataLayerService;
import com.sjzm.product.modules.lingxing.service.LingxingSellerSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 领星数据对接模块。
 * 前缀 /api/v1/modules/lingxing。
 *
 * <p>2026-07 清理后的端点集合：只保留和当前 10 张 lingxing_* 表匹配的端点，
 * 废弃的 product-performance/sku-pool/sampling-model 端点已全部删除。</p>
 */
@RestController
@RequestMapping("/api/v1/modules/lingxing")
@RequiredArgsConstructor
@Tag(name = "领星数据对接", description = "领星开放平台 API 调用（token/签名/业务接口）")
public class LingxingController {

    private final LingxingClient client;
    private final LingxingConfigService configService;
    private final LingxingLocalProductSyncService localProductSyncService;
    private final LingxingLocalProductMapper localProductMapper;
    private final LingxingSellerSyncService sellerSyncService;
    private final LingxingSellerMapper sellerMapper;
    private final LingxingProfitAsinSyncService profitSyncService;
    private final LingxingProfitAsinMapper profitMapper;
    private final LingxingPurchaseDataLayerService purchaseDataLayerService;
    private final LingxingSkuDataLayerMapper syncRunMapper;
    private final LingxingOverviewService overviewService;
    private final LingxingListingSyncService listingSyncService;
    private final LingxingListingMapper listingMapper;
    private final LingxingFbaFeeCompareService fbaFeeCompareService;
    private final LingxingFbaFeeCompareMapper fbaFeeCompareMapper;
    private final LingxingProductPerformanceSyncService performanceSyncService;
    private final LingxingProductPerformanceMapper performanceMapper;
    private final LingxingProductUnifiedService unifiedService;
    private final LingxingProductUnifiedMapper unifiedMapper;
    private final LingxingScheduledSyncService scheduledSyncService;
    private final LingxingSkuDataLayerService skuDataLayerService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostMapping("/ping")
    @Operation(summary = "链路验证：换 token 并调一个轻量业务接口（关键词列表 1 条）")
    public Result<Map<String, Object>> ping() {
        Map<String, Object> out = new HashMap<>();
        client.getAccessToken();
        out.put("token", "OK");

        ObjectNode body = objectMapper.createObjectNode();
        body.put("offset", 0);
        body.put("length", 1);
        JsonNode resp = client.post("/erp/sc/routing/tool/toolKeywordRank/getKeywordList", body);
        out.put("code", resp.path("code").asText());
        out.put("message", resp.path("message").asText(resp.path("msg").asText("")));
        out.put("dataSize", resp.path("data").isArray() ? resp.path("data").size() : 0);
        return Result.success(out);
    }

    @PostMapping("/credentials")
    @Operation(summary = "更新领星凭证（写 api_config，覆盖环境变量）")
    public Result<Void> updateCredentials(@Valid @RequestBody LingxingCredentialsRequest request) {
        configService.updateCredentials(request.appId().trim(), request.appSecret());
        return Result.success();
    }

    @PostMapping("/call")
    @Operation(summary = "通用业务接口透传（调试用：传 path + body）")
    public Result<Object> call(@RequestParam String path, @RequestBody(required = false) Map<String, Object> body) {
        JsonNode node = body == null ? objectMapper.createObjectNode() : objectMapper.valueToTree(body);
        JsonNode resp = client.post(path, node);
        // 转成 Map/List 结构避免 Jackson 序列化 JsonNode 的 bean introspection
        Object result = objectMapper.convertValue(resp, Object.class);
        return Result.success(result);
    }

    @PostMapping("/local-products/sync")
    @Operation(summary = "手动触发：全量同步领星本地产品到库（双写 + 按 lingxing_id 幂等 upsert）")
    public Result<Map<String, Object>> syncLocalProducts() {
        return Result.success(localProductSyncService.syncAll());
    }

    @PostMapping("/local-products/sync-prune")
    @Operation(summary = "全量同步本地产品 + 只保留统一表目标开发人的 SKU（删非目标，覆盖更新）")
    public Result<Map<String, Object>> syncAndPruneLocalProducts() {
        return Result.success(localProductSyncService.syncAndPruneToTargetDevelopers());
    }

    // ============================================================
    // FBA 配送费对比（开发人预测 vs 亚马逊实际/预估 getPrices）
    // ============================================================

    @PostMapping("/fba-fee-compare/rebuild")
    @Operation(summary = "重算FBA配送费对比：合格ASIN(近3月销量>30+正利润)→getPrices拉亚马逊费→对比开发人预测")
    public Result<Map<String, Object>> rebuildFbaFeeCompare() {
        return Result.success(fbaFeeCompareService.rebuild());
    }

    @PostMapping("/fba-fee-compare/sync-fees-by-month")
    @Operation(summary = "按月+销量补拉亚马逊FBA预估费(getPrices)：如 month=2026-07 minVolume=10")
    public Result<Map<String, Object>> syncFeesByMonth(
            @RequestParam String month,
            @RequestParam(defaultValue = "10") int minVolume) {
        return Result.success(fbaFeeCompareService.syncFeesByMonth(month, minVolume));
    }

    @GetMapping("/fba-fee-compare")
    @Operation(summary = "分页查询FBA配送费对比结果（可按ASIN/开发人/国家筛选，按差异绝对值倒序）")
    public Result<Page<LingxingFbaFeeCompare>> listFbaFeeCompare(
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) String asin,
            @RequestParam(required = false) String developer,
            @RequestParam(required = false) String country) {
        LambdaQueryWrapper<LingxingFbaFeeCompare> qw = new LambdaQueryWrapper<LingxingFbaFeeCompare>()
                .like(StringUtils.hasText(asin), LingxingFbaFeeCompare::getAsin, asin)
                .eq(StringUtils.hasText(developer), LingxingFbaFeeCompare::getDeveloper, developer)
                .eq(StringUtils.hasText(country), LingxingFbaFeeCompare::getCountry, country)
                .orderByDesc(LingxingFbaFeeCompare::getDiff);
        return Result.success(fbaFeeCompareMapper.selectPage(new Page<>(current, size), qw));
    }

    @GetMapping("/local-products")
    @Operation(summary = "分页查询已落库的领星本地产品（按更新时间倒序，可按 SKU 模糊）")
    public Result<Page<LingxingLocalProduct>> listLocalProducts(
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) String sku) {
        LambdaQueryWrapper<LingxingLocalProduct> qw = new LambdaQueryWrapper<LingxingLocalProduct>()
                .like(StringUtils.hasText(sku), LingxingLocalProduct::getSku, sku)
                .orderByDesc(LingxingLocalProduct::getLxUpdateTime);
        return Result.success(localProductMapper.selectPage(new Page<>(current, size), qw));
    }

    @PostMapping("/local-products/set")
    @Operation(summary = "添加/编辑本地产品（写回领星，忠实透传领星 body；成功后回拉刷新本地）")
    public Result<Map<String, Object>> setLocalProduct(@RequestBody Map<String, Object> body) {
        JsonNode node = objectMapper.valueToTree(body);
        return Result.success(localProductSyncService.setProduct(node));
    }

    @PostMapping("/local-products/upload-pictures")
    @Operation(summary = "上传本地产品图片（写回领星；body: {sku, picture_list:[{pic_url,is_primary}]}）")
    public Result<JsonNode> uploadLocalProductPictures(@RequestBody Map<String, Object> body) {
        String sku = body.get("sku") == null ? "" : String.valueOf(body.get("sku"));
        JsonNode pictureList = objectMapper.valueToTree(body.getOrDefault("picture_list", new ArrayList<>()));
        return Result.success(localProductSyncService.uploadPictures(sku, pictureList));
    }

    @PostMapping("/sellers/sync")
    @Operation(summary = "手动触发：同步领星亚马逊店铺列表到库（sid 来源，双写 + 按 sid 幂等 upsert）")
    public Result<Map<String, Object>> syncSellers() {
        return Result.success(sellerSyncService.syncAll());
    }

    @GetMapping("/sellers")
    @Operation(summary = "查询已落库的领星店铺（sid/店铺名/国家等，供产品表现、利润统计选店铺）")
    public Result<List<LingxingSeller>> listSellers(
            @RequestParam(required = false) Integer status) {
        LambdaQueryWrapper<LingxingSeller> qw = new LambdaQueryWrapper<LingxingSeller>()
                .eq(status != null, LingxingSeller::getStatus, status)
                .orderByAsc(LingxingSeller::getSid);
        return Result.success(sellerMapper.selectList(qw));
    }

    // ============================================================
    // 采购事实层（Q1/Q2 精确备货量来源）
    // ============================================================

    @PostMapping("/purchase/plans/sync")
    @Operation(summary = "同步领星采购计划列表到采购事实层（计划量 quantity_plan）")
    public Result<Map<String, Object>> syncPurchasePlans(@RequestBody Map<String, Object> req) {
        return Result.success(purchaseDataLayerService.syncPurchasePlans(
                readStr(req, "startDate"),
                readStr(req, "endDate"),
                readStr(req, "searchFieldTime"),
                readStrList(req, "planSns"),
                readIntList(req, "statuses"),
                readLongList(req, "sids")));
    }

    @PostMapping("/purchase/orders/sync")
    @Operation(summary = "同步领星采购单列表到采购事实层（实际采购量 quantity_real / 入库量 quantity_entry）")
    public Result<Map<String, Object>> syncPurchaseOrders(@RequestBody Map<String, Object> req) {
        return Result.success(purchaseDataLayerService.syncPurchaseOrders(
                readStr(req, "startDate"),
                readStr(req, "endDate"),
                readStr(req, "searchFieldTime"),
                readStrList(req, "orderSns"),
                readStrList(req, "customOrderSns"),
                readInt(req, "purchaseType")));
    }

    @GetMapping("/purchase/stats")
    @Operation(summary = "查看领星采购事实层统计")
    public Result<Map<String, Object>> purchaseStats() {
        return Result.success(purchaseDataLayerService.stats());
    }

    // ============================================================
    // 利润统计-ASIN
    // ============================================================

    @PostMapping("/profit-asin/sync")
    @Operation(summary = "手动触发：按店铺+时间窗(≤7天)同步利润统计-ASIN（逐日双写 + 幂等）")
    public Result<Map<String, Object>> syncProfitAsin(@RequestBody Map<String, Object> req) {
        List<Long> sids = readLongList(req, "sids");
        String startDate = readStr(req, "startDate");
        String endDate = readStr(req, "endDate");
        String currencyCode = readStr(req, "currencyCode");
        return Result.success(profitSyncService.sync(sids, startDate, endDate, currencyCode));
    }

    @GetMapping("/profit-asin")
    @Operation(summary = "分页查询已落库的利润统计-ASIN（可按 ASIN 模糊）")
    public Result<Page<LingxingProfitAsin>> listProfitAsin(
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) String asin) {
        LambdaQueryWrapper<LingxingProfitAsin> qw = new LambdaQueryWrapper<LingxingProfitAsin>()
                .like(StringUtils.hasText(asin), LingxingProfitAsin::getAsin, asin)
                .orderByDesc(LingxingProfitAsin::getDataDate);
        return Result.success(profitMapper.selectPage(new Page<>(current, size), qw));
    }

    // ============================================================
    // 亚马逊 Listing（销售板块 Listing 数据，/erp/sc/data/mws/listing）
    // 令牌桶=1，必须串行；唯一键 sid + seller_sku
    // ============================================================

    @PostMapping("/listings/sync")
    @Operation(summary = "手动触发：按店铺 sid 同步领星亚马逊 Listing（令牌桶=1 严格串行；双写+幂等）")
    public Result<Map<String, Object>> syncListings(@RequestBody Map<String, Object> req) {
        return Result.success(listingSyncService.sync(
                readIntList(req, "sids"),
                readInt(req, "isPair"),
                readInt(req, "isDelete"),
                readStr(req, "listingUpdateStart"),
                readStr(req, "listingUpdateEnd"),
                readStr(req, "searchField"),
                readStrList(req, "searchValues"),
                readInt(req, "exactSearch")));
    }

    @PostMapping("/listings/sync-target")
    @Operation(summary = "覆盖同步统一表目标 ASIN 的最新 Listing（truncate 整表 → 按目标店铺 sid 全量拉 → 回填统一表 open_date）")
    public Result<Map<String, Object>> syncTargetListings() {
        return Result.success(listingSyncService.syncTargetListings());
    }

    @GetMapping("/listings")
    @Operation(summary = "分页查询已落库的领星 Listing（可按 ASIN/SKU/店铺/在售状态筛选）")
    public Result<Page<LingxingListing>> listListings(
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) Integer sid,
            @RequestParam(required = false) String asin,
            @RequestParam(required = false) String sellerSku,
            @RequestParam(required = false) Integer status) {
        LambdaQueryWrapper<LingxingListing> qw = new LambdaQueryWrapper<LingxingListing>()
                .eq(sid != null, LingxingListing::getSid, sid)
                .like(StringUtils.hasText(asin), LingxingListing::getAsin, asin)
                .like(StringUtils.hasText(sellerSku), LingxingListing::getSellerSku, sellerSku)
                .eq(status != null, LingxingListing::getStatus, status)
                .orderByDesc(LingxingListing::getListingUpdateDate);
        return Result.success(listingMapper.selectPage(new Page<>(current, size), qw));
    }

    // ============================================================
    // 产品表现（2026-07-30 按 git d4d9650 蓝本恢复，供每周自动同步）
    // 时间窗 ≤92天；sid 必填 ≤200；令牌桶=1 串行
    // ============================================================

    @PostMapping("/product-performance/sync")
    @Operation(summary = "手动触发：按店铺+时间窗(≤92天)同步产品表现（双写+幂等）")
    public Result<Map<String, Object>> syncProductPerformance(@RequestBody Map<String, Object> req) {
        return Result.success(performanceSyncService.sync(
                readLongList(req, "sids"),
                readStr(req, "startDate"),
                readStr(req, "endDate"),
                readStr(req, "summaryField"),
                readStr(req, "currencyCode")));
    }

    @GetMapping("/product-performance")
    @Operation(summary = "分页查询已落库的产品表现（可按 ASIN 模糊）")
    public Result<Page<LingxingProductPerformance>> listProductPerformance(
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) String asin) {
        LambdaQueryWrapper<LingxingProductPerformance> qw = new LambdaQueryWrapper<LingxingProductPerformance>()
                .like(StringUtils.hasText(asin), LingxingProductPerformance::getAsin, asin)
                .orderByDesc(LingxingProductPerformance::getEndDate);
        return Result.success(performanceMapper.selectPage(new Page<>(current, size), qw));
    }

    @PostMapping("/sku-weekly/rebuild")
    @Operation(summary = "从已落库产品表现(msku)加工进周表（可传 startDate/endDate 限窗口，空则全量）")
    public Result<Map<String, Object>> rebuildSkuWeekly(@RequestBody(required = false) Map<String, Object> req) {
        String start = req == null ? null : readStr(req, "startDate");
        String end = req == null ? null : readStr(req, "endDate");
        String snapshotWeek = req == null ? null : readStr(req, "snapshotWeek");
        return Result.success(skuDataLayerService.upsertWeeklyFromExistingPerformance(start, end, snapshotWeek, null));
    }

    // ============================================================
    // 产品统一表（ASIN 维度宽表，每周同步后重算）
    // ============================================================

    @PostMapping("/product-unified/rebuild")
    @Operation(summary = "全量重算产品统一表（月表聚合+listing真实上架日+baseline起算月）")
    public Result<Map<String, Object>> rebuildProductUnified(@RequestBody(required = false) Map<String, Object> req) {
        String cutoffMonth = req == null ? null : readStr(req, "cutoffMonth");
        return Result.success(unifiedService.rebuild(cutoffMonth));
    }

    @GetMapping("/product-unified")
    @Operation(summary = "分页查询产品统一表（可按 ASIN/开发人筛选，按最近销量倒序）")
    public Result<Page<LingxingProductUnified>> listProductUnified(
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) String asin,
            @RequestParam(required = false) String developer) {
        LambdaQueryWrapper<LingxingProductUnified> qw = new LambdaQueryWrapper<LingxingProductUnified>()
                .like(StringUtils.hasText(asin), LingxingProductUnified::getAsin, asin)
                .eq(StringUtils.hasText(developer), LingxingProductUnified::getDeveloper, developer)
                .orderByDesc(LingxingProductUnified::getTotalVolume);
        return Result.success(unifiedMapper.selectPage(new Page<>(current, size), qw));
    }

    // ============================================================
    // 每周自动同步（@Scheduled + 手动触发同一入口）
    // ============================================================

    @PostMapping("/scheduled/run-now")
    @Operation(summary = "手动触发一次完整的每周同步（产品表现全店铺 + 统一表重算），可传 startDate/endDate")
    public Result<Map<String, Object>> runScheduledNow(@RequestBody(required = false) Map<String, Object> req) {
        String start = req == null ? null : readStr(req, "startDate");
        String end = req == null ? null : readStr(req, "endDate");
        if (!StringUtils.hasText(start) || !StringUtils.hasText(end)) {
            throw new IllegalArgumentException("startDate/endDate 必填（yyyy-MM-dd，跨度 ≤92 天）");
        }
        return Result.success(scheduledSyncService.run(start, end));
    }

    // ============================================================
    // 工作台总览
    // ============================================================

    @GetMapping("/overview")
    @Operation(summary = "领星工作台总览：10 张表行数 + baseline 团队分布 + 覆盖窗口 + 最近同步记录")
    public Result<Map<String, Object>> overview() {
        return Result.success(overviewService.workspaceOverview());
    }

    @GetMapping("/sync-runs")
    @Operation(summary = "最近 N 条同步运行记录（工作台同步中心 Tab 用）")
    public Result<List<Map<String, Object>>> recentSyncRuns(
            @RequestParam(defaultValue = "50") int limit) {
        int safe = Math.max(1, Math.min(limit, 500));
        return Result.success(syncRunMapper.listRecentRuns(safe));
    }

    // ─── helpers ────────────────────────────────────────────────

    private List<Long> readLongList(Map<String, Object> req, String field) {
        List<Long> out = new ArrayList<>();
        Object v = req.get(field);
        if (v instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Number n) {
                    out.add(n.longValue());
                } else if (item != null) {
                    String s = String.valueOf(item).trim();
                    if (!s.isEmpty()) {
                        try {
                            out.add(Long.parseLong(s));
                        } catch (NumberFormatException ignored) {
                        }
                    }
                }
            }
        }
        return out;
    }

    private String readStr(Map<String, Object> req, String field) {
        Object v = req.get(field);
        return v == null ? null : String.valueOf(v);
    }

    private List<String> readStrList(Map<String, Object> req, String field) {
        List<String> out = new ArrayList<>();
        Object v = req.get(field);
        if (v instanceof List<?> list) {
            for (Object item : list) {
                if (item != null) out.add(String.valueOf(item));
            }
        }
        return out;
    }

    private List<Integer> readIntList(Map<String, Object> req, String field) {
        List<Integer> out = new ArrayList<>();
        Object v = req.get(field);
        if (v instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Number n) {
                    out.add(n.intValue());
                } else if (item != null) {
                    String s = String.valueOf(item).trim();
                    if (!s.isEmpty()) {
                        try {
                            out.add(Integer.parseInt(s));
                        } catch (NumberFormatException ignored) {
                        }
                    }
                }
            }
        }
        return out;
    }

    private Integer readInt(Map<String, Object> req, String field) {
        Object v = req.get(field);
        if (v instanceof Number n) return n.intValue();
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        if (s.isEmpty()) return null;
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
