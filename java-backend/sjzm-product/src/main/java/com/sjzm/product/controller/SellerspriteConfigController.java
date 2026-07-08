package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.service.ApiRateLimitService;
import com.sjzm.product.service.SellerspriteConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/sellersprite-config")
@RequiredArgsConstructor
@Tag(name = "卖家精灵配置", description = "查询和更新卖家精灵 API 密钥与使用次数上限")
public class SellerspriteConfigController {

    private final SellerspriteConfigService service;
    private final ApiRateLimitService apiRateLimitService;

    @GetMapping
    @Operation(summary = "获取卖家精灵配置（密钥已脱敏）")
    public Result<Map<String, Object>> getConfig() {
        return Result.success(service.getConfigInfo());
    }

    @PutMapping
    @Operation(summary = "更新卖家精灵 API 密钥及使用次数上限")
    public Result<Map<String, Object>> updateConfig(@RequestBody Map<String, Object> body) {
        // 更新密钥（可选）
        if (body.containsKey("secretKey")) {
            String newKey = (String) body.get("secretKey");
            if (newKey != null && !newKey.isBlank()) {
                service.updateSecretKey(newKey);
            }
        }
        // 更新卖家精灵使用次数上限（可选整数）
        Object maxPerMinObj = body.get("maxPerMinute");
        if (maxPerMinObj != null) {
            apiRateLimitService.updateMaxPerMinute(toInt(maxPerMinObj));
        }
        Object maxPerMonthObj = body.get("maxPerMonth");
        if (maxPerMonthObj != null) {
            apiRateLimitService.updateMaxPerMonth(toInt(maxPerMonthObj));
        }
        Object maxAsinsObj = body.get("maxAsinsPerRequest");
        if (maxAsinsObj != null) {
            apiRateLimitService.updateMaxAsinsPerRequest(toInt(maxAsinsObj));
        }
        return Result.success(service.getConfigInfo());
    }

    private int toInt(Object obj) {
        if (obj instanceof Number n) return n.intValue();
        return Integer.parseInt(obj.toString());
    }
}
