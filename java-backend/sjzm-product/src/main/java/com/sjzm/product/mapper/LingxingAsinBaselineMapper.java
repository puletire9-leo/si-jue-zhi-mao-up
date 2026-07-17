package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingAsinBaseline;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * ASIN 基准主表 Mapper（lingxing_asin_baseline）。
 *
 * <p>提供分页/筛选/编辑的标准 BaseMapper 能力，
 * 额外提供总览统计和分组聚合供工作台用。</p>
 */
@Mapper
public interface LingxingAsinBaselineMapper extends BaseMapper<LingxingAsinBaseline> {

    /** 按开发人分组统计 ASIN 数量（工作台图表用） */
    @Select("SELECT developer, COUNT(*) AS cnt " +
            "FROM lingxing_asin_baseline " +
            "WHERE developer IS NOT NULL AND developer <> '' " +
            "GROUP BY developer ORDER BY cnt DESC")
    List<Map<String, Object>> countByDeveloper();

    /** 按币种（GBP/EUR）分组统计。available_first_country 中文，用 CASE 归一化 */
    @Select("SELECT " +
            "  CASE " +
            "    WHEN available_first_country IN ('英国','UK') THEN 'GBP' " +
            "    WHEN available_first_country IN ('德国','法国','意大利','西班牙','荷兰','DE','FR','IT','ES','NL') THEN 'EUR' " +
            "    ELSE '其他' " +
            "  END AS currency, " +
            "  COUNT(*) AS cnt " +
            "FROM lingxing_asin_baseline " +
            "GROUP BY currency ORDER BY cnt DESC")
    List<Map<String, Object>> countByCurrency();

    /** 按起算月份分组统计（近 24 个月） */
    @Select("SELECT model_start_month AS month, COUNT(*) AS cnt " +
            "FROM lingxing_asin_baseline " +
            "WHERE model_start_month IS NOT NULL AND model_start_month <> '' " +
            "GROUP BY model_start_month " +
            "ORDER BY model_start_month DESC LIMIT 24")
    List<Map<String, Object>> countByStartMonth();

    /** 按分析状态分组（识别本周新增 ASIN） */
    @Select("SELECT COALESCE(NULLIF(TRIM(analysis_status), ''), '未标注') AS status, COUNT(*) AS cnt " +
            "FROM lingxing_asin_baseline " +
            "GROUP BY status ORDER BY cnt DESC")
    List<Map<String, Object>> countByStatus();
}
