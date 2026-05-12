package com.sjzm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.entity.GradeThreshold;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 等级阈值 Mapper
 */
@Mapper
public interface GradeThresholdMapper extends BaseMapper<GradeThreshold> {

    /**
     * 获取所有等级配置（按最低分降序）
     */
    @Select("SELECT * FROM grade_thresholds ORDER BY min_score DESC")
    List<GradeThreshold> selectAllOrdered();

    /**
     * 根据等级获取配置
     */
    @Select("SELECT * FROM grade_thresholds WHERE grade = #{grade}")
    GradeThreshold selectByGrade(String grade);

    /**
     * 插入或更新等级阈值（对齐 Python ON DUPLICATE KEY UPDATE）
     */
    @Insert("""
        INSERT INTO grade_thresholds (grade, min_score, max_score, color)
        VALUES (#{grade}, #{minScore}, #{maxScore}, #{color})
        ON DUPLICATE KEY UPDATE
            min_score = VALUES(min_score),
            max_score = VALUES(max_score),
            color = VALUES(color)
        """)
    int insertOrUpdate(GradeThreshold threshold);
}
