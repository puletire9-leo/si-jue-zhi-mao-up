package com.sjzm.product.rds.center;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JdbcUrlInspectorTest {

    @Test
    void parsesDockerMysqlAsLocal() {
        JdbcUrlInspector.Endpoint endpoint = JdbcUrlInspector.parse(
                "jdbc:mysql://mysql:3306/sijuelishi?useSSL=false");
        assertEquals("mysql", endpoint.host());
        assertEquals(3306, endpoint.port());
        assertEquals("sijuelishi", endpoint.database());
        assertFalse(endpoint.remote());
    }

    @Test
    void parsesPublicIpAsRemote() {
        JdbcUrlInspector.Endpoint endpoint = JdbcUrlInspector.parse(
                "jdbc:mysql://101.37.51.239:3306/sijuelishi?characterEncoding=UTF-8");
        assertEquals("101.37.51.239", endpoint.host());
        assertTrue(endpoint.remote());
    }

    @Test
    void parsesAliyunHostnameAsRemote() {
        JdbcUrlInspector.Endpoint endpoint = JdbcUrlInspector.parse(
                "jdbc:mysql://rm-example.mysql.rds.aliyuncs.com:3306/ai_platform");
        assertEquals("ai_platform", endpoint.database());
        assertTrue(endpoint.remote());
    }
}
