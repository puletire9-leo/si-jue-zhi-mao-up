package com.sjzm.product.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.config.SellerspriteConfig;
import com.sjzm.product.dto.CompetitorLookupRequest;
import com.sjzm.product.entity.CompetitorLookupLog;
import com.sjzm.product.mapper.CompetitorLookupLogMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class SellerspriteApiService {

    private final SellerspriteConfig config;
    private final SellerspriteConfigService sellerspriteConfigService;
    private final CompetitorLookupLogMapper logMapper;
    private final ApiRateLimitService rateLimitService;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @CircuitBreaker(name = "sellerspriteApi", fallbackMethod = "lookupFallback")
    public JsonNode competitorLookup(CompetitorLookupRequest request) {

        // 速率限制检查（卖家模式 asins 为空时按 1 次计算）
        int asinCount = (request.getAsins() != null && !request.getAsins().isEmpty()) ? request.getAsins().size() : 1;
        rateLimitService.checkRateLimit(asinCount);

        long startTime = System.currentTimeMillis();
        String apiStatus = "OK";
        String errorMsg = null;

        try {
            String body = objectMapper.writeValueAsString(request);
            log.info("卖家精灵请求体: {}", body);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(config.getApiUrl() + "/product/competitor-lookup"))
                    .header("secret-key", sellerspriteConfigService.getSecretKey())
                    .header("Content-Type", "application/json")
                    .timeout(config.getReadTimeout())
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            JsonNode result = objectMapper.readTree(response.body());

            if (!"OK".equals(result.path("code").asText())) {
                apiStatus = "ERROR";
                errorMsg = result.path("message").asText("Unknown error");
                log.error("卖家精灵 API 错误: {}", errorMsg);
                throw new RuntimeException("卖家精灵 API 错误: " + errorMsg);
            }

            log.info("卖家精灵 API 调用成功: marketplace={}, asins={}, took={}ms",
                    request.getMarketplace(), asinCount,
                    System.currentTimeMillis() - startTime);

            return result.path("data");

        } catch (RuntimeException e) {
            apiStatus = "ERROR";
            errorMsg = e.getMessage();
            throw e;
        } catch (Exception e) {
            apiStatus = "ERROR";
            errorMsg = e.getMessage();
            throw new RuntimeException("卖家精灵 API 调用失败: " + e.getMessage(), e);
        } finally {
            long took = System.currentTimeMillis() - startTime;
            logApiCall(request.getMarketplace(), request.getMonth(), asinCount, took, apiStatus, errorMsg);
        }
    }

    private JsonNode lookupFallback(CompetitorLookupRequest request, Throwable t) {
        log.warn("卖家精灵 API 熔断降级: {}", t.getMessage());
        throw new RuntimeException("竞品数据服务暂时不可用，请稍后重试");
    }

    public void logApiCall(String marketplace, String month, int asinsCount, long tookMs, String status, String error) {
        // 使用 TransactionTemplate 强制新事务，不受外层回滚影响
        transactionTemplate.executeWithoutResult(ts -> {
            try {
                CompetitorLookupLog logEntry = new CompetitorLookupLog();
                logEntry.setMarketplace(marketplace);
                logEntry.setMonth(month);
                logEntry.setAsinsCount(asinsCount);
                logEntry.setTookMs((int) tookMs);
                logEntry.setApiStatus(status);
                logEntry.setErrorMessage(error);
                logEntry.setCreatedAt(java.time.LocalDateTime.now());
                logMapper.insert(logEntry);
            } catch (Exception e) {
                log.warn("记录 API 调用日志失败: {}", e.getMessage());
            }
        });
    }
}
