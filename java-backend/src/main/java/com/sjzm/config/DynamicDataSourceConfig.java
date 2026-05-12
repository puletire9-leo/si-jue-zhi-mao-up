package com.sjzm.config;

import com.baomidou.dynamic.datasource.spring.boot.autoconfigure.DynamicDataSourceProperties;
import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.util.StringUtils;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Configuration
public class DynamicDataSourceConfig {

    @Value("${spring.datasource.master.url:jdbc:mysql://localhost:3306/sijuelishi}")
    private String masterUrl;

    @Value("${spring.datasource.master.username:root}")
    private String masterUsername;

    @Value("${spring.datasource.master.password:root}")
    private String masterPassword;

    @Value("${spring.datasource.slave.url:#{null}}")
    private String slaveUrl;

    @Value("${spring.datasource.slave.username:#{null}}")
    private String slaveUsername;

    @Value("${spring.datasource.slave.password:#{null}}")
    private String slavePassword;

    @Value("${spring.datasource.hikari.maximum-pool-size:30}")
    private int maximumPoolSize;

    @Value("${spring.datasource.hikari.minimum-idle:10}")
    private int minimumIdle;

    @Bean
    @Primary
    public DataSource dynamicDataSource() {
        Map<String, DataSource> dataSourceMap = new HashMap<>();

        HikariDataSource masterDataSource = createDataSource(masterUrl, masterUsername, masterPassword, "master");
        dataSourceMap.put("master", masterDataSource);
        log.info("[DynamicDataSource] 主库初始化: {}", masterUrl);

        if (StringUtils.hasText(slaveUrl)) {
            HikariDataSource slaveDataSource = createDataSource(slaveUrl, 
                    slaveUsername != null ? slaveUsername : masterUsername,
                    slavePassword != null ? slavePassword : masterPassword, "slave");
            dataSourceMap.put("slave", slaveDataSource);
            log.info("[DynamicDataSource] 从库初始化: {}", slaveUrl);
        } else {
            dataSourceMap.put("slave", masterDataSource);
            log.warn("[DynamicDataSource] 未配置从库，使用主库作为从库（读写未分离）");
        }

        DynamicRoutingDataSource routingDataSource = new DynamicRoutingDataSource();
        routingDataSource.setDefaultTargetDataSource(masterDataSource);
        routingDataSource.setTargetDataSources((Map) dataSourceMap);

        return routingDataSource;
    }

    private HikariDataSource createDataSource(String url, String username, String password, String poolName) {
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
        dataSource.setMaximumPoolSize(maximumPoolSize);
        dataSource.setMinimumIdle(minimumIdle);
        dataSource.setPoolName("HikariCP-" + poolName + "-" + System.currentTimeMillis());
        dataSource.setConnectionTimeout(30000);
        dataSource.setIdleTimeout(600000);
        dataSource.setMaxLifetime(1800000);
        dataSource.setLeakDetectionThreshold(60000);
        return dataSource;
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dynamicDataSource) {
        return new JdbcTemplate(dynamicDataSource);
    }
}
