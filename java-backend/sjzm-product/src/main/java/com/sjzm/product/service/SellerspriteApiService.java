package com.sjzm.product.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.product.dto.CompetitorLookupRequest;
import com.sjzm.product.entity.CompetitorLookupLog;
import com.sjzm.product.mapper.CompetitorLookupLogMapper;
import com.sjzm.product.modules.requestcenter.gateway.SellerspriteExecutionGateway;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionContext;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Slf4j
@Service
@RequiredArgsConstructor
public class SellerspriteApiService {

    private final SellerspriteExecutionGateway executionGateway;
    private final CompetitorLookupLogMapper logMapper;
    private final TransactionTemplate transactionTemplate;

    @Deprecated(forRemoval = true)
    public JsonNode competitorLookup(CompetitorLookupRequest request) {
        rejectLegacyDirectExecution();
        int asinCount = request.getAsins() == null ? 0 : request.getAsins().size();
        String scope = "marketplace=" + request.getMarketplace() + ", asins=" + asinCount;
        return executionGateway.execute(new SellerspriteExecutionRequest(request,
                SellerspriteExecutionContext.legacy("LEGACY_COMPETITOR_LOOKUP", scope))).data();
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
                logEntry.setRequestDispatched(true);
                logEntry.setUsageConfirmed("OK".equals(status));
                logEntry.setCreatedAt(java.time.LocalDateTime.now());
                logMapper.insert(logEntry);
            } catch (Exception e) {
                log.warn("记录 API 调用日志失败: {}", e.getMessage());
            }
        });
    }

    /** 仅供旧调用链保留的入口已下线；新代码必须注入执行网关。 */
    private void rejectLegacyDirectExecution() {
        throw new UnsupportedOperationException("旧卖家精灵同步调用已下线，请通过卖家精灵请求中心执行");
    }
}
