package com.sjzm.product.config;

import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.spring.MybatisSqlSessionFactoryBean;
import com.sjzm.product.rds.lingxing.LingxingRdsMapper;
import com.zaxxer.hikari.HikariDataSource;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;

/**
 * 主数据源配置。生产有 {@code RDS_*} 时连远程 sijuelishi；否则连 {@code MYSQL_*}。
 *
 * <p>双数据源改造后，MyBatis-Plus 自动配置因检测到自定义 SqlSessionFactory 而退避，
 * 因此主库的 DataSource / SqlSessionFactory / SqlSessionTemplate 必须在此显式声明并标 @Primary。
 *
 * <p>本配置的 @MapperScan 覆盖除 {@code com.sjzm.product.rds.mapper}（运营物流走 RDS）外的所有 Mapper 包，
 * 与 {@link RdsDataSourceConfig} 的扫描包互斥，避免同一 Mapper 被两个 SqlSessionTemplate 绑定。
 */
@Configuration
@MapperScan(basePackages = {
        "com.sjzm.product.mapper",
        "com.sjzm.product.modules.analysisbaseline.shopprofile.mapper",
        "com.sjzm.product.modules.analysisbaseline.productfamily.mapper",
        "com.sjzm.product.modules.analysisbaseline.methodevidence.mapper",
        "com.sjzm.product.modules.shopcollection.mapper",
        "com.sjzm.product.modules.shopcandidate.mapper",
        "com.sjzm.product.modules.bazhuayu.mapper",
        "com.sjzm.product.modules.requestcenter.mapper",
        "com.sjzm.product.modules.shoppremium.mapper",
        "com.sjzm.product.modules.developerselection.mapper",
        "com.sjzm.product.modules.automation.mapper",
        "com.sjzm.product.modules.lingxing.mapper",
        "com.sjzm.product.modules.lingxing.requestcenter.mapper",
        "com.sjzm.product.modules.dataprocessing.logistics.mapper"
}, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = LingxingRdsMapper.class),
        sqlSessionFactoryRef = "primarySqlSessionFactory")
public class PrimaryDataSourceConfig {

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource.hikari")
    public DataSource primaryDataSource(
            @org.springframework.beans.factory.annotation.Value("${spring.datasource.url}") String url,
            @org.springframework.beans.factory.annotation.Value("${spring.datasource.username}") String username,
            @org.springframework.beans.factory.annotation.Value("${spring.datasource.password}") String password,
            @org.springframework.beans.factory.annotation.Value("${spring.datasource.driver-class-name}") String driver) {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(url);
        ds.setUsername(username);
        ds.setPassword(password);
        ds.setDriverClassName(driver);
        return ds;
    }

    @Bean
    @Primary
    public SqlSessionFactory primarySqlSessionFactory(@org.springframework.beans.factory.annotation.Qualifier("primaryDataSource") DataSource primaryDataSource,
                                                      MybatisPlusInterceptor mybatisPlusInterceptor) throws Exception {
        MybatisSqlSessionFactoryBean factoryBean = new MybatisSqlSessionFactoryBean();
        factoryBean.setDataSource(primaryDataSource);
        factoryBean.setPlugins(mybatisPlusInterceptor);
        factoryBean.setMapperLocations(new PathMatchingResourcePatternResolver()
                .getResources("classpath*:/mapper/**/*.xml"));
        com.baomidou.mybatisplus.core.MybatisConfiguration configuration =
                new com.baomidou.mybatisplus.core.MybatisConfiguration();
        configuration.setMapUnderscoreToCamelCase(true);
        factoryBean.setConfiguration(configuration);
        return factoryBean.getObject();
    }

    @Bean
    @Primary
    public SqlSessionTemplate primarySqlSessionTemplate(SqlSessionFactory primarySqlSessionFactory) {
        return new SqlSessionTemplate(primarySqlSessionFactory);
    }

    @Bean
    @Primary
    public PlatformTransactionManager transactionManager(
            @org.springframework.beans.factory.annotation.Qualifier("primaryDataSource") DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }
}
