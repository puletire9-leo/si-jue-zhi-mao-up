package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 非标载体配置实体。
 * 承载「一类非标品用哪套市场检索词」——AI 选品页按载体做全量捞取，
 * 从 shop_products / competitor_products_clean 双通道（标题主词 ∪ 类目路径）
 * 捞出该载体的所有 ASIN 写入 ai_selection。
 *
 * <p>整套能力受 {@code features.ai-selection.enabled} 开关控制，默认关闭。</p>
 */
@Data
@TableName("nonstandard_carrier")
public class NonstandardCarrier {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 载体英文键，如 guapai */
    private String carrierKey;

    /** 载体中文名，如 挂牌 */
    private String name;

    /** 标题主词，逗号分隔；支持 SQL LIKE 的 % 表示有序插词（如 stained glass%window hanging） */
    private String titleKeywords;

    /** 类目路径关键词，逗号分隔（Sun Catchers,Sonnenfänger） */
    private String categoryPaths;

    /** 硬排除词，逗号分隔；标题/类目通道均生效，成品保护词也不能覆盖 */
    private String excludeKeywords;

    /** 条件排除词，逗号分隔；命中时默认排除，但可被成品保护词救回 */
    private String conditionalExcludeKeywords;

    /** 成品保护词，逗号分隔；仅覆盖条件排除词，不覆盖硬排除词 */
    private String includeKeywords;

    /** 定锚说明 */
    private String note;

    /** 是否启用：1 启用 / 0 停用 */
    private Integer enabled;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
