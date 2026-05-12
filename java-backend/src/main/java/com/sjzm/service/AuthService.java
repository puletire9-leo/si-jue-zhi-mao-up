package com.sjzm.service;

import com.sjzm.common.Result;

import java.util.Map;

/**
 * 认证服务接口
 */
public interface AuthService {

    /**
     * 用户登录
     */
    Result<Map<String, Object>> login(String username, String password);

    /**
     * 用户登出
     */
    Result<Void> logout(String token);

    /**
     * 刷新令牌
     */
    Result<Map<String, Object>> refreshToken(String refreshToken);

    /**
     * 获取当前用户信息
     */
    Result<Map<String, Object>> getCurrentUser(String token);
}
