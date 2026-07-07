package com.sjzm.product.modules.analysisbaseline.shopprofile.controller;

import com.sjzm.common.Result;
import com.sjzm.product.modules.analysisbaseline.shopprofile.entity.ShopProfileBaseline;
import com.sjzm.product.modules.analysisbaseline.shopprofile.entity.ShopProfileBaselineMember;
import com.sjzm.product.modules.analysisbaseline.shopprofile.service.ShopProfileBaselineService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/shop-profile/baselines")
@RequiredArgsConstructor
@Tag(name = "店铺画像基线", description = "郑总/自有优质店/方法卡高命中店基线管理")
public class ShopProfileBaselineController {

    private final ShopProfileBaselineService baselineService;

    @GetMapping
    @Operation(summary = "查询店铺基线列表")
    public Result<List<ShopProfileBaseline>> listBaselines(
            @RequestParam(required = false) String baselineType,
            @RequestParam(required = false) String status) {
        return Result.success(baselineService.listBaselines(baselineType, status));
    }

    @PostMapping
    @Operation(summary = "创建店铺基线", description = "执行 SQL 建表后可用")
    public Result<ShopProfileBaseline> createBaseline(@RequestBody ShopProfileBaseline baseline) {
        return Result.success(baselineService.saveBaseline(baseline));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新店铺基线")
    public Result<ShopProfileBaseline> updateBaseline(
            @PathVariable Long id,
            @RequestBody ShopProfileBaseline baseline) {
        return Result.success(baselineService.updateBaseline(id, baseline));
    }

    @GetMapping("/{baselineCode}/members")
    @Operation(summary = "查询基线成员")
    public Result<List<ShopProfileBaselineMember>> listMembers(
            @PathVariable String baselineCode,
            @RequestParam(required = false) String marketplace) {
        return Result.success(baselineService.listMembers(baselineCode, marketplace));
    }

    @PostMapping("/{baselineCode}/members")
    @Operation(summary = "新增基线成员")
    public Result<ShopProfileBaselineMember> addMember(
            @PathVariable String baselineCode,
            @RequestBody ShopProfileBaselineMember member) {
        return Result.success(baselineService.addMember(baselineCode, member));
    }

    @DeleteMapping("/members/{id}")
    @Operation(summary = "删除基线成员")
    public Result<Void> deleteMember(@PathVariable Long id) {
        baselineService.deleteMember(id);
        return Result.success(null);
    }
}
