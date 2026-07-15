package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.dto.SelectionUsersRequest;
import com.sjzm.product.service.ClickLogRequest;
import com.sjzm.product.service.ProductClickLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/click-logs")
@RequiredArgsConstructor
@Tag(name = "用户点击行为", description = "记录用户浏览/选择产品行为，供AI分析")
public class ProductClickLogController {

    private final ProductClickLogService clickLogService;

    @PostMapping
    @Operation(summary = "记录一次产品点击/选择/取消选择行为")
    public Result<Map<String, String>> logClick(
            @RequestHeader("X-User-Id") Long headerUserId,
            @Valid @RequestBody ClickLogRequest request) {

        Long userId = request.getUserId() != null ? request.getUserId() : headerUserId;

        clickLogService.log(
                userId,
                request.getAsin(),
                request.getMarketplace(),
                request.getSource(),
                request.getAction(),
                request.getProductTitle(),
                request.getUserName()
        );

        return Result.success(Map.of("status", "ok"));
    }

    @GetMapping("/my-selections")
    @Operation(summary = "获取当前用户已选中的ASIN列表")
    public Result<Set<String>> mySelections(
            @RequestHeader("X-User-Id") Long headerUserId,
            @RequestParam(required = false) Long userId,
            @RequestParam(defaultValue = "UK") String marketplace) {
        Long uid = userId != null ? userId : headerUserId;
        return Result.success(clickLogService.getUserSelections(uid, marketplace));
    }

    @GetMapping("/selection-users")
    @Operation(summary = "获取指定ASIN的选中用户列表（按站点过滤）")
    public Result<Map<String, List<Map<String, Object>>>> selectionUsers(
            @RequestParam List<String> asins,
            @RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(clickLogService.getSelectionUsers(asins, marketplace));
    }

    @PostMapping("/selection-users")
    @Operation(summary = "批量获取指定 ASIN 的选中用户列表")
    public Result<Map<String, List<Map<String, Object>>>> selectionUsersByBody(
            @Valid @RequestBody SelectionUsersRequest request) {
        return Result.success(
                clickLogService.getSelectionUsers(request.getAsins(), request.getMarketplace())
        );
    }
}
