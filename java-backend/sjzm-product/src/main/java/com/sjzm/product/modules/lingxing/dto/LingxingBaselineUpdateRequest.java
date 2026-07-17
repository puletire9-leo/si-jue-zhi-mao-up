package com.sjzm.product.modules.lingxing.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * ASIN 基准表人工可编辑字段。
 *
 * <p>请求只暴露页面约定的五个字段，防止覆盖同步脚本维护的事实字段。</p>
 */
public record LingxingBaselineUpdateRequest(
        @Pattern(
                regexp = "^(蒋舒|陈杨|宋凤莉|刘淼|龙梦临|周沁仪|张子轩|黄雨珊)$",
                message = "开发人不在团队名单中")
        String developer,

        @Size(max = 500, message = "领星标签长度不能超过 500 个字符")
        String listingTags,

        @Pattern(
                regexp = "^\\d{4}-(0[1-9]|1[0-2])$",
                message = "起算月格式必须为 YYYY-MM")
        String modelStartMonth,

        @Size(max = 128, message = "起算依据长度不能超过 128 个字符")
        String modelStartBasis,

        @Pattern(
                regexp = "^(周同步自动新增|可纳入截至截止月的批次分析|正常|未标注|待淘汰|淘汰|季节性断货)$",
                message = "分析状态不合法")
        String analysisStatus) {

    @AssertTrue(message = "至少提供一个可编辑字段")
    public boolean isAnyFieldPresent() {
        return developer != null
                || listingTags != null
                || modelStartMonth != null
                || modelStartBasis != null
                || analysisStatus != null;
    }
}
