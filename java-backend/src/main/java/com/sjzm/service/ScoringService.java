package com.sjzm.service;

import java.util.List;
import java.util.Map;

/**
 * 评分服务接口
 */
public interface ScoringService {

    /**
     * 获取评分配置
     */
    Map<String, Object> getScoringConfig();

    /**
     * 更新评分配置
     */
    Map<String, Object> updateScoringConfig(Map<String, Object> config);

    /**
     * 重新计算评分
     */
    Map<String, Object> recalculateScores();

    /**
     * 评分本周数据
     */
    Map<String, Object> scoreCurrentWeek();

    /**
     * 获取等级统计
     */
    List<Map<String, Object>> getGradeStats();
}
