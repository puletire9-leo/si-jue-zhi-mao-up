package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.Result;
import com.sjzm.service.SystemConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 系统配置控制器
 */
@Slf4j
@Tag(name = "系统配置", description = "系统配置CRUD（开发人列表、载体列表、图片设置等）")
@RestController
@RequestMapping("/api/v1/system-config")
@RequiredArgsConstructor
public class SystemConfigController {

    private final SystemConfigService systemConfigService;

    // ==================== 开发人列表 ====================

    @Operation(summary = "获取开发人列表", description = "获取系统配置的开发人列表")
    @GetMapping("/developer-list")
    public Result<Map<String, Object>> getDeveloperList() {
        try {
            Map<String, Object> result = systemConfigService.getDeveloperList();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取开发人列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新开发人列表", description = "更新系统配置的开发人列表")
    @PutMapping("/developer-list")
    public Result<Map<String, Object>> updateDeveloperList(@RequestBody List<String> developerList) {
        try {
            String updatedBy = "admin";
            Map<String, Object> result = systemConfigService.updateDeveloperList(developerList, updatedBy);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("更新开发人列表失败: " + e.getMessage());
        }
    }

    // ==================== 载体列表 ====================

    @Operation(summary = "获取载体列表", description = "获取系统配置的载体列表")
    @GetMapping("/carrier-list")
    public Result<Map<String, Object>> getCarrierList() {
        try {
            Map<String, Object> result = systemConfigService.getCarrierList();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取载体列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新载体列表", description = "更新系统配置的载体列表")
    @PutMapping("/carrier-list")
    public Result<Map<String, Object>> updateCarrierList(@RequestBody List<String> carrierList) {
        try {
            String updatedBy = "admin";
            Map<String, Object> result = systemConfigService.updateCarrierList(carrierList, updatedBy);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("更新载体列表失败: " + e.getMessage());
        }
    }

    // ==================== 图片设置 ====================

    @Operation(summary = "获取图片设置", description = "获取图片相关配置（最大图片大小、产品卡片尺寸等）")
    @GetMapping("/image-settings")
    public Result<Map<String, Object>> getImageSettings() {
        try {
            Map<String, Object> result = systemConfigService.getImageSettings();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取图片设置失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新图片设置", description = "更新图片相关配置")
    @PutMapping("/image-settings")
    public Result<Map<String, Object>> updateImageSettings(@RequestBody Map<String, Object> settings) {
        try {
            int maxImageSize = ((Number) settings.get("maxImageSize")).intValue();
            int productCardWidth = ((Number) settings.get("productCardWidth")).intValue();
            int productCardHeight = ((Number) settings.get("productCardHeight")).intValue();
            String updatedBy = "admin";

            Map<String, Object> result = systemConfigService.updateImageSettings(
                    maxImageSize, productCardWidth, productCardHeight, updatedBy);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("更新图片设置失败: " + e.getMessage());
        }
    }

    // ==================== 通用配置 ====================

    @Operation(summary = "获取配置", description = "根据配置键获取配置值")
    @GetMapping("/config/{configKey}")
    public Result<Map<String, Object>> getConfig(
            @Parameter(description = "配置键") @PathVariable String configKey) {
        try {
            Map<String, Object> result = systemConfigService.getConfig(configKey);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取配置失败: " + e.getMessage());
        }
    }

    @Operation(summary = "设置配置", description = "设置配置值")
    @PutMapping("/config/{configKey}")
    public Result<Map<String, Object>> setConfig(
            @Parameter(description = "配置键") @PathVariable String configKey,
            @RequestBody Map<String, Object> config) {
        try {
            String configValue = (String) config.get("configValue");
            String description = (String) config.getOrDefault("description", "");
            String updatedBy = "admin";

            Map<String, Object> result = systemConfigService.setConfig(configKey, configValue, description, updatedBy);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("设置配置失败: " + e.getMessage());
        }
    }

    @Operation(summary = "列出配置", description = "列出所有配置或指定分类的配置")
    @GetMapping("/configs")
    public Result<List<Map<String, Object>>> listConfigs(
            @Parameter(description = "配置分类（前缀）") @RequestParam(required = false) String category) {
        try {
            List<Map<String, Object>> result = systemConfigService.listConfigs(category);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("列出配置失败: " + e.getMessage());
        }
    }
}
