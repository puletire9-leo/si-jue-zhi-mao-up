package com.sjzm.product.config;

import com.sjzm.product.rds.lingxing.LingxingRdsMapper;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

/** 将原有领星 Mapper 接口无侵入地切换到远程 RDS SqlSessionFactory。 */
@Configuration
@MapperScan(basePackages = "com.sjzm.product.mapper",
        markerInterface = LingxingRdsMapper.class,
        sqlSessionFactoryRef = "rdsSqlSessionFactory")
public class LingxingRdsMapperScanConfig {
}
