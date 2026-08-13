package com.sjzm.product.dto;

import lombok.Data;

import java.util.List;

/**
 * 单载体检索词规格——用于「一次扫表、全载体分流」的合并捞取。
 * 每个载体的关键词已在 Service 侧 splitCsv 成列表。
 */
@Data
public class CarrierHarvestSpec {

    /** 载体键，如 tiepihua */
    private String carrierKey;

    /** 标题主词 */
    private List<String> titleKeywords;

    /** 类目路径词 */
    private List<String> categoryPaths;

    /** 硬排除词 */
    private List<String> excludeKeywords;

    /** 条件排除词 */
    private List<String> conditionalExcludeKeywords;

    /** 成品保护词（仅救回条件排除） */
    private List<String> includeKeywords;

    /** 该载体是否有任何召回词（title 或 category 非空）——无则不应参与合并扫描。 */
    public boolean hasRecall() {
        return (titleKeywords != null && !titleKeywords.isEmpty())
                || (categoryPaths != null && !categoryPaths.isEmpty());
    }
}
