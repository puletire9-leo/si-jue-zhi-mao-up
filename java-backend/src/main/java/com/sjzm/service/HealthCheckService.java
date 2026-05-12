package com.sjzm.service;

import java.util.Map;

/**
 * 健康检查服务接口
 */
public interface HealthCheckService {

    /**
     * 基础健康检查
     */
    Map<String, Object> basicHealthCheck();

    /**
     * 详细健康检查
     */
    Map<String, Object> detailedHealthCheck();
}
