package com.sjzm.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

/**
 * CORS 跨域配置
 * 支持动态端口检测和开发/生产环境差异化配置
 */
@Slf4j
@Configuration
public class CorsConfig {

    @Value("${app.cors.allowed-origins:http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000}")
    private String allowedOrigins;

    @Value("${app.cors.allowed-methods:GET,POST,PUT,DELETE,OPTIONS,PATCH}")
    private String allowedMethods;

    @Value("${app.cors.allowed-headers:*}")
    private String allowedHeaders;

    @Value("${app.cors.allow-credentials:true}")
    private boolean allowCredentials;

    @Value("${app.cors.max-age:3600}")
    private long maxAge;

    @Value("${app.cors.allow-localhost-all-ports:true}")
    private boolean allowLocalhostAllPorts;

    private static final Pattern LOCALHOST_PATTERN = Pattern.compile("^http://localhost:\\d+$");
    private static final Pattern LOCALHOST_HTTPS_PATTERN = Pattern.compile("^https://localhost:\\d+$");

    @Bean
    public CorsFilter corsFilter() {
        return new CorsFilter(corsConfigurationSource());
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        
        // 注册动态CORS配置
        source.registerCorsConfiguration("/api/**", getDynamicCorsConfiguration());
        source.registerCorsConfiguration("/actuator/**", getDynamicCorsConfiguration());
        
        return source;
    }

    /**
     * 获取动态CORS配置
     * 支持开发环境下允许所有localhost端口
     */
    private CorsConfiguration getDynamicCorsConfiguration() {
        CorsConfiguration config = new CorsConfiguration();
        
        // 设置允许的HTTP方法
        config.setAllowedMethods(Arrays.asList(allowedMethods.split(",")));
        
        // 设置允许的请求头
        config.setAllowedHeaders(Arrays.asList(allowedHeaders.split(",")));
        
        // 是否允许携带凭证
        config.setAllowCredentials(allowCredentials);
        
        // 预检请求缓存时间（秒）
        config.setMaxAge(maxAge);
        
        // 暴露额外的响应头
        config.setExposedHeaders(Arrays.asList("Authorization", "Content-Disposition"));
        
        // 如果启用了localhost任意端口模式
        if (allowLocalhostAllPorts) {
            // 设置为允许所有来源（开发环境）
            config.addAllowedOriginPattern("http://localhost:*");
            config.addAllowedOriginPattern("https://localhost:*");
            log.info("CORS配置: 允许所有localhost端口 (开发模式)");
        } else {
            // 生产环境：严格限制来源
            List<String> origins = Arrays.asList(allowedOrigins.split(","));
            config.setAllowedOrigins(origins);
            log.info("CORS配置: 允许的来源列表: {}", origins);
        }
        
        return config;
    }
}
