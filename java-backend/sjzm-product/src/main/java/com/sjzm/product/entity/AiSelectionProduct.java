package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * AI 选品实体。
 * 表结构镜像 competitor_products_clean，追加 batch_id / batch_label / source_ref / pushed_by / pushed_at。
 * AI Agent 投递或手动导入时，从 shop_products / competitor_products_clean 复制 ASIN 信息写入此表。
 *
 * <p>整套能力受 {@code features.ai-selection.enabled} 开关控制，默认关闭。必须显式覆盖
 * {@code @TableName}——否则会继承父类 {@code CompetitorProduct} 的 "competitor_products"，
 * 导致 {@code selectPage} 查到竞品原表而非 ai_selection。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ai_selection")
public class AiSelectionProduct extends CompetitorProduct {

    /**
     * ai_selection 表由 {@code CREATE TABLE ... LIKE competitor_products_clean} 建成，
     * 主键保留 {@code AUTO_INCREMENT}。此处覆盖父类的 {@code ASSIGN_ID}，与 DDL 保持一致，
     * 让 INSERT 不写 id 列、由数据库自增。
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 投递/导入批次 UUID（格式：batch_<uuid>） */
    private String batchId;

    /** 批次名称，由调用方传入 */
    private String batchLabel;

    /** 来源表：shop_products / competitor_products_clean */
    private String sourceRef;

    /** 非标载体键（对应 nonstandard_carrier.carrier_key） */
    private String carrier;

    /** 投递人用户 ID */
    private String pushedBy;

    /** 投递时间 */
    private LocalDateTime pushedAt;
}
