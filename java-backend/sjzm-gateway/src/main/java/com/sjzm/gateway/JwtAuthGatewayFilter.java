package com.sjzm.gateway;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthGatewayFilter implements GlobalFilter, Ordered {

    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh",
            "/health",
            "/actuator"
    );

    // 开发环境：跳过所有 /api/ 的 JWT 验证
    @Value("${gateway.auth.enabled:true}")
    private boolean authEnabled;

    @Value("${jwt.secret}")
    private String secret;

    private final PermissionService permissionService;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        // 尝试从 JWT 提取用户信息（无论 auth 是否开启，有 token 就解析）
        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                Claims claims = Jwts.parser()
                        .verifyWith(getSigningKey())
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();

                String userId = claims.getSubject();
                String username = claims.get("username", String.class);
                String role = claims.get("role", String.class);

                // 始终注入 X-User-Id 等头（java-product 依赖这些头）
                ServerHttpRequest request = exchange.getRequest().mutate()
                        .header("X-User-Id", userId)
                        .header("X-Username", username)
                        .header("X-User-Role", role)
                        .build();
                exchange = exchange.mutate().request(request).build();

                // 如果 auth 开启，做权限检查
                if (authEnabled && !isPublicPath(path)) {
                    String requiredPermission = permissionService.getRequiredPermission(path);
                    if (requiredPermission != null) {
                        if (!permissionService.hasPermission(role, requiredPermission)) {
                            log.warn("权限不足: user={}, role={}, path={}, required={}",
                                    username, role, path, requiredPermission);
                            return forbidden(exchange, "权限不足，无法访问");
                        }
                    }
                }
            } catch (ExpiredJwtException e) {
                // FIXED: HIGH-6 — 过期 JWT 不注入请求头
                if (authEnabled) {
                    log.warn("JWT 已过期: path={}", path);
                    return unauthorized(exchange, "认证令牌已过期");
                }
            } catch (Exception e) {
                if (authEnabled) {
                    log.warn("JWT 验证失败: {} path={}", e.getMessage(), path);
                    return unauthorized(exchange, "认证令牌无效或已过期");
                }
                // auth 关闭时，JWT 解析失败也放行（但不注入头）
            }
        } else if (authEnabled && !isPublicPath(path)) {
            return unauthorized(exchange, "缺少认证令牌");
        }

        return chain.filter(exchange);
    }

    private boolean isPublicPath(String path) {
        return PUBLIC_PATHS.stream().anyMatch(path::startsWith);
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().set("Content-Type", "application/json;charset=UTF-8");
        String body = String.format("{\"code\":401,\"message\":\"%s\",\"data\":null,\"timestamp\":%d}",
                message, System.currentTimeMillis());
        return response.writeWith(Mono.just(response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8))));
    }

    private Mono<Void> forbidden(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.FORBIDDEN);
        response.getHeaders().set("Content-Type", "application/json;charset=UTF-8");
        String body = String.format("{\"code\":403,\"message\":\"%s\",\"data\":null,\"timestamp\":%d}",
                message, System.currentTimeMillis());
        return response.writeWith(Mono.just(response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8))));
    }

    @Override
    public int getOrder() {
        return -100;
    }
}
