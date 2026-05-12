package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.entity.ScoringConfig;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 评分配置 Mapper
 */
@Mapper
public interface ScoringConfigMapper extends BaseMapper<ScoringConfig> {

    /**
     * 获取所有启用的配置
     */
    @Select("SELECT * FROM scoring_config WHERE is_active = 1")
    List<ScoringConfig> selectActiveConfigs();

    /**
     * 根据维度标识获取配置
     */
    @Select("SELECT * FROM scoring_config WHERE dimension_key = #{dimensionKey}")
    ScoringConfig selectByDimensionKey(String dimensionKey);

    /**
     * 插入或更新配置（对齐 Python ON DUPLICATE KEY UPDATE）
     */
    @Insert("""
        INSERT INTO scoring_config (dimension_key, display_name, weight, thresholds, is_active)
        VALUES (#{dimensionKey}, #{displayName}, #{weight}, #{thresholds}, #{isActive})
        ON DUPLICATE KEY UPDATE
            display_name = VALUES(display_name),
            weight = VALUES(weight),
            thresholds = VALUES(thresholds),
            is_active = VALUES(is_active)
        """)
    int insertOrUpdate(ScoringConfig config);
}
