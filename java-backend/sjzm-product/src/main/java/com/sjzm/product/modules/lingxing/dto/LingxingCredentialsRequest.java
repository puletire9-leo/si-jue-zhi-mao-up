package com.sjzm.product.modules.lingxing.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 领星开放平台凭证更新请求。
 *
 * <p>凭证只能通过 JSON 请求体传输，避免出现在 URL、代理日志或监控记录中。</p>
 */
public record LingxingCredentialsRequest(
        @NotBlank(message = "appId 不能为空") String appId,
        @NotBlank(message = "appSecret 不能为空") String appSecret) {
}
