package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.BrsRankingRaw;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * BRS 榜单原始表 Mapper。
 * 分页查询直接用 BaseMapper.selectPage + LambdaQueryWrapper&lt;BrsRankingRaw&gt;，
 * 因实体 @TableName 已指向 brs_ranking_raw，列名口径与 competitor_products 完全一致。
 */
@Mapper
public interface BrsRankingRawMapper extends BaseMapper<BrsRankingRaw> {

    /** INSERT ON DUPLICATE KEY UPDATE: 用 (marketplace, asin, batch_date) 唯一键判断 */
    int insertOnDuplicateKeyUpdate(BrsRankingRaw product);

    /**
     * 实时按 created_at 计算入库批次（单天粒度），返回每天条数与起止日期，按日期倒序。
     * 与 CompetitorProductMapper.selectCreatedWeeksWithCount 同口径，供 RangeFilterPanel 周批次下拉用。
     */
    @Select("<script>" +
            "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS week, COUNT(*) AS count, " +
            "DATE_FORMAT(created_at, '%Y-%m-%d') AS startDate, DATE_FORMAT(created_at, '%Y-%m-%d') AS endDate " +
            "FROM brs_ranking_raw " +
            "WHERE marketplace = #{marketplace} AND created_at IS NOT NULL " +
            "<if test='source != null and source != \"\"'> AND source LIKE CONCAT('%', #{source}, '%')</if>" +
            "GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d') ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d') DESC" +
            "</script>")
    List<Map<String, Object>> selectCreatedWeeksWithCount(@Param("marketplace") String marketplace,
                                                          @Param("source") String source);
}
