package com.sjzm.product.modules.lingxing.requestcenter.service;

import com.sjzm.product.modules.automation.job.FinanceDailyReportJob;
import com.sjzm.product.modules.lingxing.requestcenter.scheduler.LingxingWeeklyProductSyncTaskHandler;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;

/**
 * 统一表完整回补：先入队财务日（GBP 重拉），再入队周窗口。
 * 日任务走领星串行队列，周任务同样走该队列，禁止并行打同一账号。
 */
public final class UnifiedPeriodBackfillPlanner {

    public static final LocalDate DEFAULT_WEEKLY_FROM = LocalDate.of(2025, 4, 7);
    public static final LocalDate DEFAULT_DAILY_FROM = LocalDate.of(2026, 8, 12);
    public static final LocalDate DEFAULT_DAILY_TO = LocalDate.of(2026, 8, 21);

    private UnifiedPeriodBackfillPlanner() {
    }

    public record Spec(String taskType, String payloadJson) {
    }

    public static List<Spec> plan(LocalDate weeklyFrom,
                                  LocalDate weeklyTo,
                                  LocalDate dailyFrom,
                                  LocalDate dailyTo,
                                  Boolean publishToFeishu,
                                  Boolean allowRepull) {
        return plan(weeklyFrom, weeklyTo, dailyFrom, dailyTo, publishToFeishu, allowRepull, LocalDate.now());
    }

    public static List<Spec> plan(LocalDate weeklyFrom,
                                  LocalDate weeklyTo,
                                  LocalDate dailyFrom,
                                  LocalDate dailyTo,
                                  Boolean publishToFeishu,
                                  Boolean allowRepull,
                                  LocalDate today) {
        LocalDate fromWeek = weeklyFrom == null ? DEFAULT_WEEKLY_FROM : weeklyFrom;
        LocalDate toWeek = weeklyTo == null ? lastCompleteSunday(today) : weeklyTo;
        LocalDate fromDay = dailyFrom == null ? DEFAULT_DAILY_FROM : dailyFrom;
        LocalDate toDay = dailyTo == null ? DEFAULT_DAILY_TO : dailyTo;
        boolean feishu = publishToFeishu == null || publishToFeishu;
        boolean repull = allowRepull == null || allowRepull;

        List<Spec> specs = new ArrayList<>();
        boolean firstDaily = true;
        for (LocalDate day = fromDay; !day.isAfter(toDay); day = day.plusDays(1)) {
            boolean refreshListing = firstDaily;
            firstDaily = false;
            specs.add(new Spec(FinanceDailyReportJob.CODE, dailyPayload(day, feishu, repull, refreshListing)));
        }
        LocalDate monday = fromWeek.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        while (!monday.plusDays(6).isAfter(toWeek)) {
            LocalDate sunday = monday.plusDays(6);
            specs.add(new Spec(
                    LingxingWeeklyProductSyncTaskHandler.TYPE,
                    "{\"startDate\":\"" + monday + "\",\"endDate\":\"" + sunday + "\"}"));
            monday = monday.plusWeeks(1);
        }
        return specs;
    }

    static LocalDate lastCompleteSunday(LocalDate today) {
        if (today.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return today;
        }
        return today.with(TemporalAdjusters.previous(DayOfWeek.SUNDAY));
    }

    private static String dailyPayload(LocalDate day,
                                       boolean publishToFeishu,
                                       boolean allowRepull,
                                       boolean refreshListing) {
        return "{\"reportDate\":\"" + day
                + "\",\"pullFromLingxing\":true,\"persistFacts\":true"
                + ",\"allowRepull\":" + allowRepull
                + ",\"publishToFeishu\":" + publishToFeishu
                + ",\"refreshListing\":" + refreshListing
                + "}";
    }
}
