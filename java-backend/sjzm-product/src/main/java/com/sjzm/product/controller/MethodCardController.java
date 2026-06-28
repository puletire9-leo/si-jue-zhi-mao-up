package com.sjzm.product.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.dto.MethodCardProductResponse;
import com.sjzm.product.dto.MethodCardQueryRequest;
import com.sjzm.product.service.MethodCardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/method-cards")
@RequiredArgsConstructor
@Tag(name = "方法卡片", description = "前端方法卡片对应的候选商品接口")
public class MethodCardController {

    private final MethodCardService methodCardService;

    @GetMapping("/M01/products")
    @Operation(summary = "M01 新品榜加速法候选", description = "从 competitor_products_clean 查询去变体污染后的 M01 候选商品")
    public Result<PageResult<MethodCardProductResponse>> getM01Products(@Valid MethodCardQueryRequest request) {
        return Result.success(methodCardService.queryM01Products(request));
    }

    @GetMapping("/M02/products")
    @Operation(summary = "M02 郑总同行品线跟随法候选", description = "从 deng_zong_shop 最新批次查询郑总同行品线候选商品")
    public Result<PageResult<MethodCardProductResponse>> getM02Products(@Valid MethodCardQueryRequest request) {
        return Result.success(methodCardService.queryM02Products(request));
    }
}
