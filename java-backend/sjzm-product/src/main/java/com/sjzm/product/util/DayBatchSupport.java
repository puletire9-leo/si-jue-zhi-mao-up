package com.sjzm.product.util;

import com.sjzm.product.dto.common.DayBatchOption;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * 「按天分组」批次下拉的统一工具——全系统各批次下拉共用的值归一化与过滤逻辑。
 *
 * <p>历史上各批次下拉按 ISO 周（{@code 2026-W30}）聚合，导致同一周多次导入被合并。
 * 本工具把批次统一收口到「单天导入日期」粒度，并负责：</p>
 * <ul>
 *   <li>值归一化：把 {@code 2026-W30} / {@code 20260720} / {@code 2026-07-20} 统一到 {@code yyyy-MM-dd}；</li>
 *   <li>粒度判断：区分 ISO 周值与日期值，供查询过滤分流；</li>
 *   <li>主批次过滤：滤掉同段内条数极少的零星历史日期（变体行/补数据）。</li>
 * </ul>
 *
 * <p>禁止各模块另写一套批次分组/格式化逻辑（铁律8）——新增下拉一律复用此工具 +
 * {@link DayBatchOption}。</p>
 */
public final class DayBatchSupport {

    private DayBatchSupport() {
    }

    /** ISO 周值形态，如 2026-W30 / 2026-W3。 */
    private static final Pattern WEEK_PATTERN = Pattern.compile("\\d{4}-W\\d{1,2}");

    /** 纯日期值形态：yyyyMMdd。 */
    private static final Pattern COMPACT_DATE_PATTERN = Pattern.compile("\\d{8}");

    /** 日期值形态：yyyy-MM-dd。 */
    private static final Pattern DASH_DATE_PATTERN = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");

    private static final DateTimeFormatter COMPACT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter DASH = DateTimeFormatter.ISO_LOCAL_DATE;

    /** 主批次最小条数阈值：低于此值的零星历史日期不进下拉。 */
    public static final long DEFAULT_MAIN_BATCH_MIN_COUNT = 100L;

    /** 是否为 ISO 周值（如 2026-W30）。 */
    public static boolean isWeekValue(String value) {
        return value != null && WEEK_PATTERN.matcher(value.trim()).matches();
    }

    /** 是否为日期值（yyyy-MM-dd 或 yyyyMMdd）。 */
    public static boolean isDateValue(String value) {
        if (value == null) return false;
        String v = value.trim();
        return DASH_DATE_PATTERN.matcher(v).matches() || COMPACT_DATE_PATTERN.matcher(v).matches();
    }

    /**
     * 把任意批次值归一到 {@code yyyy-MM-dd}。
     * ISO 周值归一到该周的周一；日期值原样标准化；无法识别返回 null。
     */
    public static String normalizeToDate(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        if (DASH_DATE_PATTERN.matcher(v).matches()) {
            return LocalDate.parse(v, DASH).format(DASH);
        }
        if (COMPACT_DATE_PATTERN.matcher(v).matches()) {
            return LocalDate.parse(v, COMPACT).format(DASH);
        }
        if (WEEK_PATTERN.matcher(v).matches()) {
            return weekMondayToDate(v);
        }
        return null;
    }

    /** 把日期值归一到 {@code yyyyMMdd}（供 shop_products.batch_date 这类紧凑列过滤）。 */
    public static String normalizeToCompactDate(String value) {
        String dashed = normalizeToDate(value);
        if (dashed == null) return null;
        return LocalDate.parse(dashed, DASH).format(COMPACT);
    }

    /** ISO 周值（yyyy-Www）→ 该周周一日期 yyyy-MM-dd。 */
    private static String weekMondayToDate(String weekValue) {
        String[] parts = weekValue.split("-W");
        int year = Integer.parseInt(parts[0]);
        int week = Integer.parseInt(parts[1]);
        LocalDate monday = LocalDate.of(year, 1, 4)
                .with(java.time.temporal.IsoFields.WEEK_OF_WEEK_BASED_YEAR, week)
                .with(java.time.DayOfWeek.MONDAY);
        return monday.format(DASH);
    }

    /**
     * 只留主批次：滤掉条数低于阈值的零星历史日期（变体行/补数据），
     * 但列表首项（最新批次）无条件保留，避免全被滤空。
     */
    public static List<DayBatchOption> filterMainBatches(List<DayBatchOption> options, long minCount) {
        if (options == null || options.isEmpty()) return options;
        List<DayBatchOption> kept = new ArrayList<>(options.size());
        for (int i = 0; i < options.size(); i++) {
            DayBatchOption o = options.get(i);
            long c = o.getCount() == null ? 0L : o.getCount();
            if (i == 0 || c >= minCount) {
                kept.add(o);
            }
        }
        return kept;
    }

    /** 用默认阈值过滤主批次。 */
    public static List<DayBatchOption> filterMainBatches(List<DayBatchOption> options) {
        return filterMainBatches(options, DEFAULT_MAIN_BATCH_MIN_COUNT);
    }
}
