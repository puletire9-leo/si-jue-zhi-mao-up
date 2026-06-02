package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.dto.ScoringConfigUpdateRequest;
import com.sjzm.product.entity.GradeThreshold;
import com.sjzm.product.entity.ScoringConfig;
import com.sjzm.product.service.ScoringService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/scoring")
@RequiredArgsConstructor
@Tag(name = "评分管理", description = "选品评分引擎")
public class ScoringController {

    private final ScoringService scoringService;

    @GetMapping("/config")
    @Operation(summary = "获取评分配置")
    public Result<Map<String, Object>> getConfig() {
        return Result.success(scoringService.getConfig());
    }

    @PutMapping("/config")
    @Operation(summary = "更新评分配置")
    public Result<Void> updateConfig(@RequestBody ScoringConfigUpdateRequest request) {
        List<ScoringConfig> dims = new ArrayList<>();
        if (request.getDimensions() != null) {
            for (var d : request.getDimensions()) {
                ScoringConfig c = new ScoringConfig();
                c.setDimensionKey(d.getDimensionKey());
                c.setDisplayName(d.getDisplayName());
                c.setWeight(d.getWeight());
                c.setIsActive(d.getIsActive() != null ? d.getIsActive() : true);
                if (d.getThresholds() != null) {
                    try {
                        c.setThresholds(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(d.getThresholds()));
                    } catch (Exception ignored) {}
                }
                dims.add(c);
            }
        }

        List<GradeThreshold> grades = new ArrayList<>();
        if (request.getGradeThresholds() != null) {
            for (var g : request.getGradeThresholds()) {
                GradeThreshold gt = new GradeThreshold();
                gt.setGrade((String) g.get("grade"));
                gt.setMinScore(g.get("minScore") != null ? ((Number) g.get("minScore")).intValue() : null);
                gt.setMaxScore(g.get("maxScore") != null ? ((Number) g.get("maxScore")).intValue() : null);
                gt.setColor((String) g.get("color"));
                grades.add(gt);
            }
        }

        scoringService.updateConfig(dims, grades);
        return Result.success();
    }

    @PostMapping("/score-current-week")
    @Operation(summary = "一键计算本周评级")
    public Result<Map<String, Object>> scoreCurrentWeek() {
        Map<String, Object> result = scoringService.scoreCurrentWeek();
        return Result.success("评分完成", result);
    }

    @PostMapping("/recalculate")
    @Operation(summary = "重新评分")
    public Result<Map<String, Object>> recalculate(@RequestBody(required = false) Map<String, String> body) {
        String scope = body != null ? body.getOrDefault("scope", "all") : "all";
        Map<String, Object> result = scoringService.recalculateScores(scope);
        return Result.success("重新评分完成", result);
    }

    @GetMapping("/grade-stats")
    @Operation(summary = "等级统计")
    public Result<Map<String, Object>> gradeStats(@RequestParam(defaultValue = "all") String scope) {
        List<Map<String, Object>> stats = scoringService.getGradeStats(scope);
        return Result.success(Map.of("gradeStats", stats));
    }
}
