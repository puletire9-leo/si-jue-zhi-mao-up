package com.sjzm.product.modules.shoprating.dto;

import lombok.Data;

import java.util.List;

@Data
public class ShopRatingResult {

    private String sellerName;
    private String marketplace;
    private int productCount;

    /** 第一层：总体得分 (0-100) */
    private Double overallScore;
    /** 第二层：最佳匹配得分 (0-100) */
    private Double matchScore;
    /** 最终得分 = max(overall, match) */
    private Double finalScore;
    /** 等级: A/B/C/D/F */
    private String grade;

    /** 最佳匹配的郑总店铺 */
    private String bestMatchSeller;
    private Double bestMatchScore;

    /** 得分明细 */
    private ScoreDetail detail;

    @Data
    public static class ScoreDetail {
        private Double bsrCoverage;
        private Double nodeCoverage;
        private Double priceOverlap;
        private Double cosineSimilarity;
    }

    /** 候选店铺信息 */
    @Data
    public static class CandidateShop {
        private String sellerName;
        private String marketplace;
        private int newProductCount;
        private boolean dataFetched;
    }

    /** 任务状态 */
    @Data
    public static class TaskStatus {
        private String taskId;
        private String status; // PENDING, RUNNING, COMPLETED, FAILED
        private int currentStep;
        private int totalSteps;
        private List<ShopRatingResult> results;
        private String error;
    }
}
