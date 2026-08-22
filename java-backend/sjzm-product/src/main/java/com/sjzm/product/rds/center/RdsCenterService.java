package com.sjzm.product.rds.center;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class RdsCenterService {

    private final DataSource primaryDataSource;
    private final DataSource rdsDataSource;
    private final String primaryJdbcUrl;
    private final String rdsJdbcUrl;
    private final String primaryUsername;
    private final String rdsUsername;

    public RdsCenterService(
            @Qualifier("primaryDataSource") DataSource primaryDataSource,
            @Qualifier("rdsDataSource") DataSource rdsDataSource,
            @Value("${spring.datasource.url}") String primaryJdbcUrl,
            @Value("${rds.datasource.url}") String rdsJdbcUrl,
            @Value("${spring.datasource.username}") String primaryUsername,
            @Value("${rds.datasource.username}") String rdsUsername) {
        this.primaryDataSource = primaryDataSource;
        this.rdsDataSource = rdsDataSource;
        this.primaryJdbcUrl = primaryJdbcUrl;
        this.rdsJdbcUrl = rdsJdbcUrl;
        this.primaryUsername = primaryUsername;
        this.rdsUsername = rdsUsername;
    }

    public Map<String, Object> overview() {
        JdbcUrlInspector.Endpoint primary = JdbcUrlInspector.parse(primaryJdbcUrl);
        JdbcUrlInspector.Endpoint rds = JdbcUrlInspector.parse(rdsJdbcUrl);

        List<Map<String, Object>> livePools = new ArrayList<>();
        livePools.add(livePool("sjzm-product-primary", primary, primaryUsername, ping(primaryDataSource)));
        livePools.add(livePool("sjzm-product-rds", rds, rdsUsername, ping(rdsDataSource)));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("connectionRegistry", "config/public/prod.env + config/secrets/prod.env；用户库另见 user-prod.env");
        data.put("sameInstanceHint", "生产 USER_MYSQL 与 RDS_* 指向同一阿里云实例的不同库：ai_platform / sijuelishi");
        data.put("livePools", livePools);
        data.put("declaredPools", RdsCenterCatalog.pools());
        data.put("apiBindings", RdsCenterCatalog.apiBindings());
        data.put("primaryOnRemote", primary.remote());
        data.put("rdsPoolOnRemote", rds.remote());
        return data;
    }

    private Map<String, Object> livePool(String id, JdbcUrlInspector.Endpoint endpoint,
                                         String username, Map<String, Object> ping) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", id);
        row.put("host", endpoint.host());
        row.put("port", endpoint.port());
        row.put("database", endpoint.database());
        row.put("username", username);
        row.put("remote", endpoint.remote());
        row.put("ping", ping);
        return row;
    }

    private Map<String, Object> ping(DataSource dataSource) {
        Map<String, Object> result = new LinkedHashMap<>();
        long started = System.nanoTime();
        try (Connection connection = dataSource.getConnection()) {
            boolean ok = connection.isValid(3);
            result.put("ok", ok);
            result.put("message", ok ? "连接有效" : "isValid=false");
        } catch (Exception ex) {
            log.warn("[rds-center] ping failed: {}", ex.getMessage());
            result.put("ok", false);
            result.put("message", ex.getMessage());
        }
        result.put("elapsedMs", (System.nanoTime() - started) / 1_000_000);
        return result;
    }
}
