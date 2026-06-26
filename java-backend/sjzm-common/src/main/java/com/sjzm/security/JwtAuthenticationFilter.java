package com.sjzm.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.ExpiredJwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh",
            "/health",
            "/actuator"
    );

    private final JwtUtil jwtUtil;

    public JwtAuthenticationFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();

        if (isPublicPath(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Gateway 传递的用户信息优先
        String gatewayUserId = request.getHeader("X-User-Id");
        String gatewayUsername = request.getHeader("X-Username");
        String gatewayRole = request.getHeader("X-User-Role");

        if (StringUtils.hasText(gatewayUserId) && StringUtils.hasText(gatewayRole)) {
            setAuthentication(Long.parseLong(gatewayUserId), gatewayUsername, gatewayRole);
            filterChain.doFilter(request, response);
            return;
        }

        // 自行解析 JWT
        String authHeader = request.getHeader("Authorization");
        if (!StringUtils.hasText(authHeader) || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        try {
            if (jwtUtil.validateToken(token)) {
                Long userId = jwtUtil.getUserId(token);
                String username = jwtUtil.getUsername(token);
                String role = jwtUtil.getRole(token);
                setAuthentication(userId, username, role);
                request = new HeaderAddingRequestWrapper(request, userId, username, role);
            } else {
                // validateToken 返回 false → 过期或签名错误
                String msg;
                if (jwtUtil.isTokenExpired(token)) {
                    msg = "JWT Token 已过期，请重新登录";
                } else {
                    msg = "无效的认证令牌";
                }
                log.warn("JWT 验证失败: {}", msg);
                writeJsonResponse(response, HttpServletResponse.SC_UNAUTHORIZED, msg);
                return;
            }
        } catch (ExpiredJwtException e) {
            log.warn("JWT 已过期: {}", e.getMessage());
            writeJsonResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "JWT Token 已过期，请重新登录");
            return;
        } catch (Exception e) {
            log.warn("JWT 解析失败: {}", e.getMessage());
            writeJsonResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "无效的认证令牌");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void setAuthentication(Long userId, String username, String role) {
        List<SimpleGrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority("ROLE_" + role.toUpperCase())
        );
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(userId, username, authorities);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private boolean isPublicPath(String path) {
        return PUBLIC_PATHS.stream().anyMatch(path::startsWith);
    }

    /**
     * 以 JSON 格式写入错误响应
     */
    private void writeJsonResponse(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", status);
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());
        ObjectMapper mapper = new ObjectMapper();
        mapper.writeValue(response.getOutputStream(), body);
    }
}
