package com.sjzm.product.config;

import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.spring.MybatisSqlSessionFactoryBean;
import com.zaxxer.hikari.HikariDataSource;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;

/**
 * 运营物流专用远程 RDS 数据源配置。
 *
 * <p>只绑定 {@code com.sjzm.product.rds.mapper} 包下的 Mapper（领星采购/库存/SP 事实表、
 * 运营进度结果表、同步游标表），其余 Mapper 走 {@link PrimaryDataSourceConfig} 的本地库。
 *
 * <p>未配置 {@code RDS_*} 时回退 {@code MYSQL_*}。生产通过 config/secrets/prod.env 注入真实 RDS 连接。
 */
@Configuration
@MapperScan(basePackages = {"com.sjzm.product.rds.mapper", "com.sjzm.product.rds.finance.mapper"},
        sqlSessionFactoryRef = "rdsSqlSessionFactory")
public class RdsDataSourceConfig {

    @Bean
    public DataSource rdsDataSource(
            @Value("${rds.datasource.url}") String url,
            @Value("${rds.datasource.username}") String username,
            @Value("${rds.datasource.password}") String password,
            @Value("${rds.datasource.driver-class-name}") String driver,
            @Value("${rds.datasource.hikari.minimum-idle:2}") int minIdle,
            @Value("${rds.datasource.hikari.maximum-pool-size:8}") int maxPoolSize,
            @Value("${rds.datasource.hikari.connection-timeout:5000}") long connTimeout) {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(url);
        ds.setUsername(username);
        ds.setPassword(password);
        ds.setDriverClassName(driver);
        ds.setMinimumIdle(minIdle);
        ds.setMaximumPoolSize(maxPoolSize);
        ds.setConnectionTimeout(connTimeout);
        ds.setPoolName("rds-operations-pool");
        return ds;
    }

    @Bean
    public SqlSessionFactory rdsSqlSessionFactory(@Qualifier("rdsDataSource") DataSource rdsDataSource,
                                                  MybatisPlusInterceptor mybatisPlusInterceptor) throws Exception {
        MybatisSqlSessionFactoryBean factoryBean = new MybatisSqlSessionFactoryBean();
        factoryBean.setDataSource(rdsDataSource);
        factoryBean.setPlugins(mybatisPlusInterceptor);
        factoryBean.setMapperLocations(new PathMatchingResourcePatternResolver()
                .getResources("classpath*:/mapper/Lingxing*.xml"));
        com.baomidou.mybatisplus.core.MybatisConfiguration configuration =
                new com.baomidou.mybatisplus.core.MybatisConfiguration();
        configuration.setMapUnderscoreToCamelCase(true);
        factoryBean.setConfiguration(configuration);
        return factoryBean.getObject();
    }

    @Bean
    public SqlSessionTemplate rdsSqlSessionTemplate(SqlSessionFactory rdsSqlSessionFactory) {
        return new SqlSessionTemplate(rdsSqlSessionFactory);
    }

    @Bean("rdsTransactionManager")
    public PlatformTransactionManager rdsTransactionManager(
            @Qualifier("rdsDataSource") DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }
}
