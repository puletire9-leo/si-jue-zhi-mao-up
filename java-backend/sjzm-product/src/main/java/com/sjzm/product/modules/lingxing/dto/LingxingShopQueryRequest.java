package com.sjzm.product.modules.lingxing.dto;

import lombok.Data;

/**
 * 领星店铺数据选品分页查询请求。
 * 对齐 CompetitorQueryRequest 风格（POST + RequestBody），供 AllSelection 选品页复用。
 */
@Data
public class LingxingShopQueryRequest {

    private Integer page = 1;
    private Integer size = 20;

    /** 排序字段（白名单映射到列，默认 latest_volume） */
    private String sortBy;
    /** desc / asc，默认 desc */
    private String sortOrder = "desc";

    // ── 筛选 ──
    /** 站点 UK/DE（空=全部） */
    private String country;
    /** 按领星店铺分类（base_store，空=全部） */
    private String baseStore;
    private String developer;
    /** ASIN 模糊 */
    private String asin;
    /** 标题模糊 */
    private String title;

    // ── 可选区间（最近月销量）──
    private Long latestVolumeMin;
    private Long latestVolumeMax;
}
