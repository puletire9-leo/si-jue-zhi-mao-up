package com.sjzm.product.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.dto.MethodCardProductResponse;
import com.sjzm.product.dto.MethodCardQueryRequest;
import com.sjzm.product.service.M01RuleConfigService;
import com.sjzm.product.service.MethodCardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/v1/method-cards")
@RequiredArgsConstructor
@Tag(name = "方法卡片", description = "前端方法卡片对应的候选商品接口")
public class MethodCardController {

    private final MethodCardService methodCardService;
    private final M01RuleConfigService m01RuleConfigService;

    @GetMapping("/M01/products")
    @Operation(summary = "M01 新品榜加速法候选", description = "从 competitor_products_clean 查询去变体污染后的 M01 候选商品")
    public Result<PageResult<MethodCardProductResponse>> getM01Products(@Valid MethodCardQueryRequest request) {
        return Result.success(methodCardService.queryM01Products(request));
    }

    @PostMapping("/M01/products/query")
    @Operation(summary = "M01 新品榜加速法候选（POST）", description = "数组参数使用 JSON 传输，支持分类名自身包含逗号")
    public Result<PageResult<MethodCardProductResponse>> queryM01Products(
            @Valid @RequestBody MethodCardQueryRequest request) {
        return Result.success(methodCardService.queryM01Products(request));
    }

    @GetMapping("/M01/categories")
    @Operation(summary = "M01 新品榜一级分类统计", description = "与 M01 商品列表使用相同站点、周批次及规则口径")
    public Result<List<Map<String, Object>>> getM01Categories(@Valid MethodCardQueryRequest request) {
        return Result.success(methodCardService.queryM01Categories(request));
    }

    @PostMapping("/M01/categories/query")
    @Operation(summary = "M01 新品榜一级分类统计（POST）", description = "与 M01 商品列表同口径，JSON 数组不会被逗号拆分")
    public Result<List<Map<String, Object>>> queryM01Categories(
            @Valid @RequestBody MethodCardQueryRequest request) {
        return Result.success(methodCardService.queryM01Categories(request));
    }

    @GetMapping("/M02/products")
    @Operation(summary = "M02 郑总同行品线跟随法候选", description = "从 deng_zong_shop 最新批次查询郑总同行品线候选商品")
    public Result<PageResult<MethodCardProductResponse>> getM02Products(@Valid MethodCardQueryRequest request) {
        return Result.success(methodCardService.queryM02Products(request));
    }

    @GetMapping("/M03/products")
    @Operation(summary = "M03 FBM 自发货简单道候选",
            description = "从 competitor_products_clean 查询 fulfillment=FBM 且 90 天销量达标的候选商品 (UK=5/DE=10/US=20)")
    public Result<PageResult<MethodCardProductResponse>> getM03Products(@Valid MethodCardQueryRequest request) {
        return Result.success(methodCardService.queryM03Products(request));
    }

    @GetMapping("/M01/rule")
    @Operation(summary = "获取 M01 达标阈值（按站点）",
            description = "价格区间/重量上限/上架天数上限/30-60-90天销量门槛/销量上限/BSR上限；DB 未配置的字段返回硬编码默认")
    public Result<Map<String, Object>> getM01Rule(@RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(m01RuleConfigService.getConfig(marketplace));
    }

    @PutMapping("/M01/rule")
    @Operation(summary = "更新 M01 达标阈值（按站点，持久化）",
            description = "只更新传入字段；bsrMax 传 null/NONE 表示不使用 BSR 判定。改后立即影响方法卡列表查询口径，" +
                    "已落库的 m01_active 标不重算。")
    public Result<Map<String, Object>> updateM01Rule(@RequestBody Map<String, Object> body,
                                                     @RequestParam(defaultValue = "UK") String marketplace) {
        m01RuleConfigService.updateConfig(body, marketplace);
        return Result.success(m01RuleConfigService.getConfig(marketplace));
    }
}
