package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.entity.UserFilterPreset;
import com.sjzm.product.service.UserFilterPresetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/filter-presets")
@RequiredArgsConstructor
@Tag(name = "Filter Presets", description = "User filter presets CRUD")
public class UserFilterPresetController {

    private final UserFilterPresetService presetService;

    @GetMapping
    @Operation(summary = "List user presets")
    public Result<List<UserFilterPreset>> list(@RequestHeader("X-User-Id") Long userId) {
        return Result.success(presetService.getPresets(userId));
    }

    @GetMapping("/default")
    @Operation(summary = "Get default preset config")
    public Result<Map<String, Object>> getDefault(@RequestHeader("X-User-Id") Long userId) {
        return Result.success(presetService.getDefaultConfig(userId));
    }

    @PostMapping
    @Operation(summary = "Save preset")
    public Result<UserFilterPreset> save(@RequestHeader("X-User-Id") Long userId,
                                          @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        int index = ((Number) body.get("index")).intValue();
        @SuppressWarnings("unchecked")
        Map<String, Object> config = (Map<String, Object>) body.get("config");
        return Result.success(presetService.savePreset(userId, name, index, config));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update preset")
    public Result<UserFilterPreset> update(@RequestHeader("X-User-Id") Long userId,
                                            @PathVariable Long id,
                                            @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        @SuppressWarnings("unchecked")
        Map<String, Object> config = (Map<String, Object>) body.get("config");
        return Result.success(presetService.updatePreset(id, userId, name, config));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete preset")
    public Result<Void> delete(@RequestHeader("X-User-Id") Long userId,
                                @PathVariable Long id) {
        presetService.deletePreset(id, userId);
        return Result.success(null);
    }

    @PutMapping("/{id}/default")
    @Operation(summary = "Set as default preset")
    public Result<Void> setDefault(@RequestHeader("X-User-Id") Long userId,
                                    @PathVariable Long id) {
        presetService.setDefault(id, userId);
        return Result.success(null);
    }
}
