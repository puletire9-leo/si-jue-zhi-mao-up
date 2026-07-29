package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuWeeklyRaw;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 八爪鱼每周原始采集数据 Mapper。
 * 放 com.sjzm.product.mapper（@MapperScan 只扫这个包）。
 */
@Mapper
public interface BazhuayuWeeklyRawMapper extends BaseMapper<BazhuayuWeeklyRaw> {
    /** Batch INSERT IGNORE: the same ASIN can appear under multiple Amazon ranking categories. */
    int insertBatchIgnoreDup(@Param("list") List<BazhuayuWeeklyRaw> list);

    /** 按站点统计本周原始采集行数，替代 Java 全量加载后 groupBy，节省大量内存。 */
    @Select("SELECT marketplace, COUNT(*) AS cnt FROM bazhuayu_weekly_raw WHERE week_tag = #{weekTag} GROUP BY marketplace")
    List<Map<String, Object>> countByMarketplace(@Param("weekTag") String weekTag);
}
