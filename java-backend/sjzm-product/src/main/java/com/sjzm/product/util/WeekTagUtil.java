package com.sjzm.product.util;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.IsoFields;

/**
 * ISO 周次工具——全系统唯一真相源。
 *
 * <p>格式 {@code yyyy-Www}（如 2026-W28），基于
 * {@link IsoFields#WEEK_BASED_YEAR} + {@link IsoFields#WEEK_OF_WEEK_BASED_YEAR}。
 * 与 {@code competitor_products.week_tag}、M04 基线 {@code tagAsinsByWeek} 完全同源，
 * 候选池/竞品/基线共用这一个口子——禁止各模块另写一套周次算法（铁律8）。
 *
 * <p>用法：
 * <pre>{@code
 * @Autowired
 * private WeekTagUtil weekTagUtil;
 *
 * String batchCode = weekTagUtil.currentWeekTag();
 * }</pre>
 */
@Component
public class WeekTagUtil {

    /** 返回当前 ISO 周次，格式 yyyy-Www（如 2026-W28）。 */
    public String currentWeekTag() {
        LocalDate now = LocalDate.now();
        int year = now.get(IsoFields.WEEK_BASED_YEAR);
        int week = now.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        return String.format("%d-W%02d", year, week);
    }
}
