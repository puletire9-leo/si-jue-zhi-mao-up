package com.sjzm.product.modules.analysisbaseline.productfamily.controller;

import com.sjzm.common.Result;
import com.sjzm.product.modules.analysisbaseline.productfamily.entity.ProductFamilyGroup;
import com.sjzm.product.modules.analysisbaseline.productfamily.entity.ProductFamilyMember;
import com.sjzm.product.modules.analysisbaseline.productfamily.service.ProductFamilyEvidenceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/analysis-baseline/product-families")
@RequiredArgsConstructor
@Tag(name = "商品族证据", description = "M06 爆款多店验证法的底层商品族证据")
public class ProductFamilyEvidenceController {

    private final ProductFamilyEvidenceService service;

    @GetMapping
    @Operation(summary = "查询商品族列表")
    public Result<List<ProductFamilyGroup>> listGroups(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String categoryKey,
            @RequestParam(required = false, defaultValue = "ACTIVE") String status) {
        return Result.success(service.listGroups(marketplace, categoryKey, status));
    }

    @PostMapping
    @Operation(summary = "创建商品族", description = "当前为证据存储骨架，后续接自动相似聚类")
    public Result<ProductFamilyGroup> saveGroup(@RequestBody ProductFamilyGroup group) {
        return Result.success(service.saveGroup(group));
    }

    @GetMapping("/{familyCode}/members")
    @Operation(summary = "查询商品族成员")
    public Result<List<ProductFamilyMember>> listMembers(
            @PathVariable String familyCode,
            @RequestParam(required = false) String marketplace) {
        return Result.success(service.listMembers(familyCode, marketplace));
    }

    @PostMapping("/{familyCode}/members")
    @Operation(summary = "新增商品族成员")
    public Result<ProductFamilyMember> addMember(
            @PathVariable String familyCode,
            @RequestBody ProductFamilyMember member) {
        return Result.success(service.addMember(familyCode, member));
    }
}
