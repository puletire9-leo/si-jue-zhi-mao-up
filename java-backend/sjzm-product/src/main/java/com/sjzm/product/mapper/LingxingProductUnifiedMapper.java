package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingProductUnified;

/**
 * 领星产品统一表 Mapper。
 * <p>沿用老约定放在 com.sjzm.product.mapper，已被 ProductApplication.@MapperScan 第一行覆盖，无需改 @MapperScan。
 */
public interface LingxingProductUnifiedMapper extends BaseMapper<LingxingProductUnified> {

    /**
     * 全量重算统一表：DB 层 JOIN + 聚合 + INSERT...ON DUPLICATE KEY UPDATE。
     * 数据源：lingxing_asin_monthly_performance（经营指标聚合）
     *        + lingxing_asin_baseline（身份/起算月/FBA首现）
     *        + lingxing_listing（真实上架日 open_date）。
     * 见 resources/mapper/LingxingProductUnifiedMapper.xml。
     *
     * @param cutoffMonth     数据覆盖截止月（写入元数据列）
     * @param unifiedVersion  统一表算法版本（写入元数据列）
     * @return 影响行数（INSERT+UPDATE 累计，MySQL 语义仅供参考）
     */
    int rebuildAll(String cutoffMonth, String unifiedVersion);

    /** 清空统一表（重算前可选调用；rebuildAll 已是幂等 upsert，通常不需要）。 */
    int truncateAll();
}