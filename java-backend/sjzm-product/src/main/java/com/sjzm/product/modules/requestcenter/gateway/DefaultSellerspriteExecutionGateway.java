package com.sjzm.product.modules.requestcenter.gateway;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.sjzm.product.config.SellerspriteConfig;
import com.sjzm.product.entity.CompetitorLookupLog;
import com.sjzm.product.mapper.CompetitorLookupLogMapper;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionContext;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionException;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionRequest;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionResult;
import com.sjzm.product.modules.requestcenter.model.SellerspriteExecutionErrorCode;
import com.sjzm.product.modules.requestcenter.model.SellerspriteSellerNamePolicy;
import com.sjzm.product.service.SellerspriteConfigService;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.ConnectException;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/** 卖家精灵 HTTP 的唯一基础执行实现。 */
@Slf4j
@Service
public class DefaultSellerspriteExecutionGateway implements SellerspriteExecutionGateway {

    private static final int ERROR_SUMMARY_MAX_LENGTH = 512;

    /** 卖家精灵全局单进程互斥锁 key：全系统任意时刻只允许一个在途卖家精灵请求（铁律，跨实例）。 */
    private static final String GLOBAL_EXECUTION_LOCK = "sellersprite:execution:global-lock";
    /** 等待获取全局锁的最长时间：worker 串行排队，给足等待避免误判失败。 */
    private static final long LOCK_WAIT_SECONDS = 180L;
    /** 持锁租约：略大于 connect+read 超时，持锁线程崩溃时自动释放，避免死锁。 */
    private static final long LOCK_LEASE_SECONDS = 90L;

    private final SellerspriteConfig config;
    private final SellerspriteConfigService configService;
    private final CompetitorLookupLogMapper lookupLogMapper;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper;
    private final SellerspriteExecutionGate executionGate;
    private final RedissonClient redissonClient;
    private final java.net.http.HttpClient httpClient;
    private final CircuitBreaker circuitBreaker;

    public DefaultSellerspriteExecutionGateway(SellerspriteConfig config,
                                               SellerspriteConfigService configService,
                                               CompetitorLookupLogMapper lookupLogMapper,
                                               TransactionTemplate transactionTemplate,
                                               SellerspriteExecutionGate executionGate,
                                               RedissonClient redissonClient,
                                               CircuitBreakerRegistry circuitBreakerRegistry) {
        this.config = config;
        this.configService = configService;
        this.lookupLogMapper = lookupLogMapper;
        this.transactionTemplate = transactionTemplate;
        this.objectMapper = new ObjectMapper();
        this.executionGate = executionGate;
        this.redissonClient = redissonClient;
        this.httpClient = java.net.http.HttpClient.newBuilder()
                .connectTimeout(config.getConnectTimeout())
                .build();
        this.circuitBreaker = circuitBreakerRegistry.circuitBreaker("sellerspriteGateway");
        this.circuitBreaker.getEventPublisher().onStateTransition(event -> {
            CircuitBreaker.State target = event.getStateTransition().getToState();
            if (target == CircuitBreaker.State.OPEN || target == CircuitBreaker.State.FORCED_OPEN) {
                executionGate.openCircuit("本地熔断状态=" + target);
            } else if (target == CircuitBreaker.State.CLOSED) {
                executionGate.clearCircuit();
            }
        });
    }

    @Override
    public SellerspriteExecutionResult execute(SellerspriteExecutionRequest executionRequest) {
        // 铁律：卖家精灵全系统绝对单进程串行。所有调用收口于此，用 Redisson 全局互斥锁
        // 保证任意时刻只有一个在途请求——无论 ASIN/店铺、无论线程、无论实例。
        RLock lock = redissonClient.getLock(GLOBAL_EXECUTION_LOCK);
        boolean locked;
        try {
            locked = lock.tryLock(LOCK_WAIT_SECONDS, LOCK_LEASE_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw failure(SellerspriteExecutionErrorCode.INTERNAL_ERROR,
                    "等待卖家精灵全局执行锁被中断", false, false, LocalDateTime.now().plusSeconds(30), e);
        }
        if (!locked) {
            throw failure(SellerspriteExecutionErrorCode.INTERNAL_ERROR,
                    "获取卖家精灵全局执行锁超时（另一请求执行中）", false, false,
                    LocalDateTime.now().plusSeconds(30), null);
        }
        try {
            return executeLocked(executionRequest);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    private SellerspriteExecutionResult executeLocked(SellerspriteExecutionRequest executionRequest) {
        var request = executionRequest.competitorLookupRequest();
        SellerspriteExecutionContext context = executionRequest.context();
        long startedAt = System.nanoTime();
        boolean requestDispatched = false;
        boolean usageConfirmed = false;
        String apiStatus = "ERROR";
        SellerspriteExecutionErrorCode errorCode = null;
        String errorSummary = null;
        boolean circuitPermissionAcquired = false;

        try {
            if (SellerspriteSellerNamePolicy.isBlocked(request.getSellerName())) {
                throw failure(SellerspriteExecutionErrorCode.INVALID_REQUEST,
                        SellerspriteSellerNamePolicy.BLOCKED_AMAZON_REASON,
                        false, false, null, null);
            }
            executionGate.acquire(request.getAsins() == null ? 0 : request.getAsins().size());
            String requestBody = objectMapper.writeValueAsString(request);
            log.info("卖家精灵请求: runId={}, itemId={}, type={}, scope={}",
                    context.runId(), context.itemId(), context.requestType(), safeScope(context.requestScope()));

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(config.getApiUrl() + "/product/competitor-lookup"))
                    .header("secret-key", configService.getSecretKey())
                    .header("Content-Type", "application/json")
                    .timeout(config.getReadTimeout())
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            if (!circuitBreaker.tryAcquirePermission()) {
                executionGate.openCircuit("本地熔断器拒绝新请求");
                throw failure(SellerspriteExecutionErrorCode.CIRCUIT_OPEN, "卖家精灵熔断门禁开启",
                        false, false, LocalDateTime.now().plusSeconds(30), null);
            }
            circuitPermissionAcquired = true;
            requestDispatched = true;
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                errorCode = classifyHttpStatus(response.statusCode());
                errorSummary = "HTTP " + response.statusCode() + ": " + truncateAndRedact(response.body());
                throw failure(errorCode, errorSummary, true, false, null, null);
            }

            JsonNode result = objectMapper.readTree(response.body());
            if (!"OK".equals(result.path("code").asText())) {
                errorCode = classifyBusinessError(result);
                errorSummary = truncateAndRedact(result.path("message").asText("卖家精灵返回非成功业务码"));
                throw failure(errorCode, errorSummary, true, false, null, null);
            }

            usageConfirmed = true;
            apiStatus = "OK";
            circuitBreaker.onSuccess(System.nanoTime() - startedAt, TimeUnit.NANOSECONDS);
            return new SellerspriteExecutionResult(result.path("data"), true, true, 1);
        } catch (SellerspriteExecutionException e) {
            recordCircuitFailure(circuitPermissionAcquired, startedAt, e);
            requestDispatched = e.isRequestDispatched();
            usageConfirmed = e.isUsageConfirmed();
            errorCode = e.getErrorCode();
            errorSummary = truncateAndRedact(e.getMessage());
            throw e;
        } catch (HttpConnectTimeoutException e) {
            recordCircuitFailure(circuitPermissionAcquired, startedAt, e);
            requestDispatched = false;
            errorCode = SellerspriteExecutionErrorCode.CONNECT_TIMEOUT;
            errorSummary = "HTTP connect timed out";
            throw failure(errorCode, errorSummary, false, false, null, e);
        } catch (HttpTimeoutException e) {
            recordCircuitFailure(circuitPermissionAcquired, startedAt, e);
            errorCode = SellerspriteExecutionErrorCode.READ_TIMEOUT;
            errorSummary = "HTTP read timed out";
            throw failure(errorCode, errorSummary, requestDispatched, false, null, e);
        } catch (JsonProcessingException e) {
            recordCircuitFailure(circuitPermissionAcquired, startedAt, e);
            errorCode = SellerspriteExecutionErrorCode.PARSE_ERROR;
            errorSummary = truncateAndRedact(e.getOriginalMessage());
            throw failure(errorCode, errorSummary, requestDispatched, false, null, e);
        } catch (Exception e) {
            recordCircuitFailure(circuitPermissionAcquired, startedAt, e);
            Throwable root = rootCause(e);
            boolean beforeDispatch = root instanceof UnknownHostException || root instanceof ConnectException;
            requestDispatched = requestDispatched && !beforeDispatch;
            errorCode = SellerspriteExecutionErrorCode.NETWORK;
            errorSummary = truncateAndRedact(root.getMessage() == null
                    ? root.getClass().getSimpleName() : root.getMessage());
            throw failure(errorCode, errorSummary, requestDispatched, false, null, e);
        } finally {
            int tookMs = (int) Math.min(Integer.MAX_VALUE, (System.nanoTime() - startedAt) / 1_000_000L);
            recordAudit(executionRequest, tookMs, apiStatus, requestDispatched, usageConfirmed, errorCode, errorSummary);
        }
    }

    private SellerspriteExecutionException failure(SellerspriteExecutionErrorCode code, String message,
                                                   boolean requestDispatched, boolean usageConfirmed,
                                                   LocalDateTime retryAt, Throwable cause) {
        return new SellerspriteExecutionException(code, message, requestDispatched, usageConfirmed, retryAt, cause);
    }

    private void recordCircuitFailure(boolean circuitPermissionAcquired, long startedAt, Throwable error) {
        if (circuitPermissionAcquired) {
            circuitBreaker.onError(System.nanoTime() - startedAt, TimeUnit.NANOSECONDS, error);
        }
    }

    private SellerspriteExecutionErrorCode classifyHttpStatus(int status) {
        if (status == 401 || status == 403) return SellerspriteExecutionErrorCode.AUTH;
        if (status == 400 || status == 404 || status == 422) return SellerspriteExecutionErrorCode.INVALID_REQUEST;
        if (status == 429) return SellerspriteExecutionErrorCode.RATE_LIMIT;
        return SellerspriteExecutionErrorCode.UPSTREAM_ERROR;
    }

    private SellerspriteExecutionErrorCode classifyBusinessError(JsonNode result) {
        String message = result.path("message").asText("").toLowerCase(Locale.ROOT);
        if (message.contains("auth") || message.contains("secret") || message.contains("key")) {
            return SellerspriteExecutionErrorCode.AUTH;
        }
        if (message.contains("rate") || message.contains("limit") || message.contains("频率")) {
            return SellerspriteExecutionErrorCode.RATE_LIMIT;
        }
        if (message.contains("param") || message.contains("asin") || message.contains("参数")) {
            return SellerspriteExecutionErrorCode.INVALID_REQUEST;
        }
        return SellerspriteExecutionErrorCode.UPSTREAM_ERROR;
    }

    private void recordAudit(SellerspriteExecutionRequest executionRequest, int tookMs, String apiStatus,
                             boolean requestDispatched, boolean usageConfirmed,
                             SellerspriteExecutionErrorCode errorCode, String errorSummary) {
        var request = executionRequest.competitorLookupRequest();
        SellerspriteExecutionContext context = executionRequest.context();
        transactionTemplate.executeWithoutResult(status -> {
            try {
                CompetitorLookupLog audit = new CompetitorLookupLog();
                audit.setMarketplace(request.getMarketplace());
                audit.setMonth(request.getMonth());
                audit.setAsinsCount(request.getAsins() == null ? 0 : request.getAsins().size());
                audit.setTookMs(tookMs);
                audit.setApiStatus(apiStatus);
                audit.setRunId(context.runId());
                audit.setItemId(context.itemId());
                audit.setRequestType(context.requestType());
                audit.setRequestScope(safeScope(context.requestScope()));
                audit.setAttemptNo(context.attemptNo());
                audit.setRequestDispatched(requestDispatched);
                audit.setUsageConfirmed(usageConfirmed);
                audit.setErrorCode(errorCode == null ? null : errorCode.name());
                audit.setErrorSummary(errorSummary);
                audit.setErrorMessage(errorSummary);
                audit.setCreatedAt(LocalDateTime.now());
                lookupLogMapper.insert(audit);
            } catch (Exception e) {
                log.warn("记录卖家精灵调用审计失败: {}", e.getMessage());
            }
        });
    }

    private String safeScope(String requestScope) {
        return truncateAndRedact(requestScope == null ? "" : requestScope);
    }

    private String truncateAndRedact(String value) {
        if (value == null) return null;
        String redacted = value
                .replaceAll("(?i)(secret[-_ ]?key\\s*[:=]\\s*)[^,\\s]+", "$1***")
                .replaceAll("(?i)(authorization\\s*[:=]\\s*)[^,\\s]+", "$1***");
        return redacted.length() <= ERROR_SUMMARY_MAX_LENGTH
                ? redacted : redacted.substring(0, ERROR_SUMMARY_MAX_LENGTH);
    }

    private Throwable rootCause(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current;
    }
}
