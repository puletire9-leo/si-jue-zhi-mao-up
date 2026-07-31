package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 领星 Listing FBA 预估费中间表（getPrices 接口落库）。
 * 唯一键 sid+msku。对比表 rebuild 时 JOIN 取亚马逊实际/预估 FBA 配送费。
 */
@Data
@TableName("lingxing_listing_fba_fee")
public class LingxingListingFbaFee {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long sid;
    private String msku;
    /** FBA预估费-API */
    private BigDecimal fbaFee;
    /** FBA预估费-报表 */
    private BigDecimal fbaFeeReport;
    private String feeCurrency;
    private LocalDateTime syncedAt;
}
