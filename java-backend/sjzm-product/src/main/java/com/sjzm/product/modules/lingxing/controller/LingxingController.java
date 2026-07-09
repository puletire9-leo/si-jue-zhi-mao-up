package com.sjzm.product.modules.lingxing.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.common.Result;
import com.sjzm.product.mapper.LingxingLocalProductMapper;
import com.sjzm.product.mapper.LingxingProductPerformanceMapper;
import com.sjzm.product.mapper.LingxingProfitAsinMapper;
import com.sjzm.product.mapper.LingxingSellerMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingLocalProduct;
import com.sjzm.product.modules.lingxing.entity.LingxingProductPerformance;
import com.sjzm.product.modules.lingxing.entity.LingxingProfitAsin;
import com.sjzm.product.modules.lingxing.entity.LingxingSeller;
import com.sjzm.product.modules.lingxing.service.LingxingClient;
import com.sjzm.product.modules.lingxing.service.LingxingConfigService;
import com.sjzm.product.modules.lingxing.service.LingxingLocalProductSyncService;
import com.sjzm.product.modules.lingxing.service.LingxingProductPerformanceSyncService;
import com.sjzm.product.modules.lingxing.service.LingxingProfitAsinSyncService;
import com.sjzm.product.modules.lingxing.service.LingxingSamplingModelService;
import com.sjzm.product.modules.lingxing.service.LingxingSellerSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 领星数据对接模块。
 * 前缀 /api/v1/modules/lingxing（网关 + nginx 已覆盖 /modules/**）。
 * 本期仅打通调用能力（token + 签名 + 业务接口验证），具体数据对接待方案确定后扩展。
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
    private final LingxingProductPerformanceSyncService performanceSyncService;
    private final LingxingProductPerformanceMapper performanceMapper;
    private final LingxingProfitAsinSyncService profitSyncService;
    private final LingxingProfitAsinMapper profitMapper;
    private final LingxingSamplingModelService samplingModelService;
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
    public Result<Void> updateCredentials(@RequestParam String appId,
                                          @RequestParam String appSecret) {
        configService.updateCredentials(appId, appSecret);
        return Result.success();
    }

    /**
     * 通用业务接口透传：调试期用，定方案后由具体 Service 取代。
     * @param path 领星 API 路径（如 /bd/productPerformance/openApi/asinList）
     * @param body 业务请求体
     */
    @PostMapping("/call")
    @Operation(summary = "通用业务接口透传（调试用：传 path + body）")
    public Result<JsonNode> call(@RequestParam String path, @RequestBody(required = false) Map<String, Object> body) {
        JsonNode node = body == null ? objectMapper.createObjectNode() : objectMapper.valueToTree(body);
        return Result.success(client.post(path, node));
    }

    @PostMapping("/local-products/sync")
    @Operation(summary = "手动触发：全量同步领星本地产品到库（双写 + 按 lingxing_id 幂等 upsert）")
    public Result<Map<String, Object>> syncLocalProducts() {
        return Result.success(localProductSyncService.syncAll());
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
    // 产品表现
    // ============================================================

    @PostMapping("/product-performance/sync")
    @Operation(summary = "手动触发：按店铺+时间窗(≤92天)同步产品表现（双写 + 维度组合键幂等）")
    public Result<Map<String, Object>> syncProductPerformance(@RequestBody Map<String, Object> req) {
        List<Long> sids = readLongList(req, "sids");
        String startDate = readStr(req, "startDate");
        String endDate = readStr(req, "endDate");
        String summaryField = readStr(req, "summaryField");
        String currencyCode = readStr(req, "currencyCode");
        return Result.success(performanceSyncService.sync(sids, startDate, endDate, summaryField, currencyCode));
    }

    @GetMapping("/product-performance")
    @Operation(summary = "分页查询已落库的产品表现（可按 ASIN 模糊）")
    public Result<Page<LingxingProductPerformance>> listProductPerformance(
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) String asin) {
        LambdaQueryWrapper<LingxingProductPerformance> qw = new LambdaQueryWrapper<LingxingProductPerformance>()
                .like(StringUtils.hasText(asin), LingxingProductPerformance::getAsin, asin)
                .orderByDesc(LingxingProductPerformance::getSyncedAt);
        return Result.success(performanceMapper.selectPage(new Page<>(current, size), qw));
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
    // 精铺测品模型
    // ============================================================

    @PostMapping("/sampling-model/analyze")
    @Operation(summary = "精铺测品模型分析：基于已落库领星数据计算 cohort R1/R2 和盈亏平衡试算")
    public Result<Map<String, Object>> analyzeSamplingModel(@RequestBody(required = false) Map<String, Object> req) {
        return Result.success(samplingModelService.analyze(req));
    }

    /** 从请求体解析 Long 数组（如 sids）。缺失/非数组返回空列表。 */
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
                            // 跳过非法值
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
}
