package com.sjzm.product.service;

import com.baomidou.mybatisplus.extension.toolkit.Db;
import com.sjzm.product.mapper.AsinImportResultMapper;
import com.sjzm.product.mapper.AsinImportTaskMapper;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.SkipAsinMapper;
import com.sjzm.product.entity.AsinImportTask;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 流式初筛的跨页去重 + 计数累加契约测试。
 * 重点：同一 ASIN 跨页出现时，第二次应计 DUPLICATE，PASS 不重复累加。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AsinImportStreamingTest {

    @Mock AsinImportTaskMapper taskMapper;
    @Mock AsinImportResultMapper resultMapper;
    @Mock CompetitorProductMapper competitorProductMapper;
    @Mock SkipAsinMapper skipAsinMapper;
    @Mock InitialFilterConfigService initialFilterConfig;

    @InjectMocks AsinImportService service;

    private Map<String, String> row(String title, String asin, String price, String reviews) {
        // 列序对齐 filterRows: [0]标题 [1]ASIN [2]占位 [3]价格 [4]评论数
        Map<String, String> m = new LinkedHashMap<>();
        m.put("标题", title);
        m.put("ASIN", asin);
        m.put("_c2", "");
        m.put("价格", price);
        m.put("review数量", reviews);
        return m;
    }

    @Test
    void streamingDedupsAcrossPagesAndAccumulatesCounts() {
        // 价格区间 4.99~19.99，评论上限 5（与默认一致）
        when(initialFilterConfig.getPriceMin(anyString())).thenReturn(new BigDecimal("4.99"));
        when(initialFilterConfig.getPriceMax(anyString())).thenReturn(new BigDecimal("19.99"));
        when(initialFilterConfig.getReviewMax(anyString())).thenReturn(5);
        // 无历史命中
        when(skipAsinMapper.selectExistingAsinsInList(anyString(), anyList())).thenReturn(List.of());
        when(competitorProductMapper.selectExistingAsinsInList(anyString(), anyList())).thenReturn(List.of());
        when(competitorProductMapper.selectYoungAsinsInList(anyString(), anyList(), anyInt())).thenReturn(List.of());
        when(skipAsinMapper.insertBatchIgnoreDup(anyList())).thenReturn(0);
        // task 落库：insert 赋 id，selectById 回读
        AtomicTask store = new AtomicTask();
        doAnswer(inv -> { AsinImportTask t = inv.getArgument(0); t.setId(1L); store.task = t; return 1; })
                .when(taskMapper).insert(any(AsinImportTask.class));
        when(taskMapper.selectById(eq(1L))).thenAnswer(inv -> store.task);
        when(taskMapper.updateById(any(AsinImportTask.class))).thenReturn(1);

        try (MockedStatic<Db> db = mockStatic(Db.class)) {
            db.when(() -> Db.saveBatch(anyList(), anyInt())).thenReturn(true);

            var ctx = service.createStreamingTask("UK", "BAZHUAYU_AUTO");

            // 第一页：B01、B02 都 PASS（价格/评论筛选已取消，999 不再淘汰）
            service.filterPageAndAppend(ctx, List.of(
                    row("a", "B01AAAAAAA", "10.00", "1"),
                    row("b", "B02BBBBBBB", "999.00", "1")
            ));
            // 第二页：B01 再次出现(跨页重复→DUPLICATE), B03 PASS
            service.filterPageAndAppend(ctx, List.of(
                    row("a", "B01AAAAAAA", "10.00", "1"),
                    row("c", "B03CCCCCCC", "12.00", "2")
            ));

            Map<String, Object> preview = service.finishStreamingTask(ctx);

            assertThat(preview.get("totalCount")).isEqualTo(4);
            assertThat(preview.get("passCount")).isEqualTo(3);          // B01 + B02 + B03，B01 不重复
            assertThat(preview.get("priceFailCount")).isEqualTo(0);     // 价格筛选已取消
            assertThat(preview.get("duplicateCount")).isEqualTo(1);     // 第二页的 B01
        }
    }

    @Test
    void youngSkipAsinIsReleasedToPassForRefetch() {
        // 价格区间 4.99~19.99，评论上限 5
        when(initialFilterConfig.getPriceMin(anyString())).thenReturn(new BigDecimal("4.99"));
        when(initialFilterConfig.getPriceMax(anyString())).thenReturn(new BigDecimal("19.99"));
        when(initialFilterConfig.getReviewMax(anyString())).thenReturn(5);
        // B01 已采过（在 skip_asins），主表当前上架<60天 → 放行重取（不看销量）
        when(skipAsinMapper.selectExistingAsinsInList(eq("UK"), anyList())).thenReturn(List.of("B01AAAAAAA"));
        when(competitorProductMapper.selectYoungAsinsInList(eq("UK"), anyList(), anyInt()))
                .thenReturn(List.of("B01AAAAAAA"));
        when(competitorProductMapper.selectExistingAsinsInList(eq("UK"), anyList())).thenReturn(List.of("B01AAAAAAA"));
        when(skipAsinMapper.insertBatchIgnoreDup(anyList())).thenReturn(0);
        AtomicTask store = new AtomicTask();
        doAnswer(inv -> { AsinImportTask t = inv.getArgument(0); t.setId(1L); store.task = t; return 1; })
                .when(taskMapper).insert(any(AsinImportTask.class));
        when(taskMapper.selectById(eq(1L))).thenAnswer(inv -> store.task);
        when(taskMapper.updateById(any(AsinImportTask.class))).thenReturn(1);

        try (MockedStatic<Db> db = mockStatic(Db.class)) {
            db.when(() -> Db.saveBatch(anyList(), anyInt())).thenReturn(true);

            var ctx = service.createStreamingTask("UK", "BAZHUAYU_AUTO");
            service.filterPageAndAppend(ctx, List.of(row("a", "B01AAAAAAA", "10.00", "1")));

            Map<String, Object> preview = service.finishStreamingTask(ctx);

            assertThat(preview.get("passCount")).isEqualTo(1);
            assertThat(preview.get("skipBlacklistCount")).isEqualTo(0);
            assertThat(preview.get("skipMainCount")).isEqualTo(0);
        }
    }

    @Test
    void skipAsinNotYoungIsBlocked() {
        // B01 在 skip_asins，但主表上架≥60天（不在新品重取候选）→ 拦截
        when(initialFilterConfig.getPriceMin(anyString())).thenReturn(new BigDecimal("4.99"));
        when(initialFilterConfig.getPriceMax(anyString())).thenReturn(new BigDecimal("19.99"));
        when(initialFilterConfig.getReviewMax(anyString())).thenReturn(5);
        when(skipAsinMapper.selectExistingAsinsInList(eq("UK"), anyList())).thenReturn(List.of("B01AAAAAAA"));
        when(competitorProductMapper.selectYoungAsinsInList(eq("UK"), anyList(), anyInt()))
                .thenReturn(List.of());   // 不是新品重取候选（上架≥60天）
        when(competitorProductMapper.selectExistingAsinsInList(eq("UK"), anyList())).thenReturn(List.of("B01AAAAAAA"));
        when(skipAsinMapper.insertBatchIgnoreDup(anyList())).thenReturn(0);
        AtomicTask store = new AtomicTask();
        doAnswer(inv -> { AsinImportTask t = inv.getArgument(0); t.setId(1L); store.task = t; return 1; })
                .when(taskMapper).insert(any(AsinImportTask.class));
        when(taskMapper.selectById(eq(1L))).thenAnswer(inv -> store.task);
        when(taskMapper.updateById(any(AsinImportTask.class))).thenReturn(1);

        try (MockedStatic<Db> db = mockStatic(Db.class)) {
            db.when(() -> Db.saveBatch(anyList(), anyInt())).thenReturn(true);

            var ctx = service.createStreamingTask("UK", "BAZHUAYU_AUTO");
            service.filterPageAndAppend(ctx, List.of(row("a", "B01AAAAAAA", "10.00", "1")));

            Map<String, Object> preview = service.finishStreamingTask(ctx);

            assertThat(preview.get("passCount")).isEqualTo(0);
            assertThat(preview.get("skipBlacklistCount")).isEqualTo(1);
            assertThat(preview.get("skipMainCount")).isEqualTo(0);
        }
    }

    @Test
    void priceAndReviewFilteringDisabledAllPassThrough() {
        // 价格/评论筛选已取消：即使价格超区间、评论超上限，也不再淘汰，全新 ASIN 直接 PASS
        when(initialFilterConfig.getPriceMin(anyString())).thenReturn(new BigDecimal("4.99"));
        when(initialFilterConfig.getPriceMax(anyString())).thenReturn(new BigDecimal("19.99"));
        when(initialFilterConfig.getReviewMax(anyString())).thenReturn(5);
        when(skipAsinMapper.selectExistingAsinsInList(eq("UK"), anyList())).thenReturn(List.of());
        when(competitorProductMapper.selectYoungAsinsInList(eq("UK"), anyList(), anyInt())).thenReturn(List.of());
        when(competitorProductMapper.selectExistingAsinsInList(eq("UK"), anyList())).thenReturn(List.of());
        when(skipAsinMapper.insertBatchIgnoreDup(anyList())).thenReturn(0);
        AtomicTask store = new AtomicTask();
        doAnswer(inv -> { AsinImportTask t = inv.getArgument(0); t.setId(1L); store.task = t; return 1; })
                .when(taskMapper).insert(any(AsinImportTask.class));
        when(taskMapper.selectById(eq(1L))).thenAnswer(inv -> store.task);
        when(taskMapper.updateById(any(AsinImportTask.class))).thenReturn(1);

        try (MockedStatic<Db> db = mockStatic(Db.class)) {
            db.when(() -> Db.saveBatch(anyList(), anyInt())).thenReturn(true);

            var ctx = service.createStreamingTask("UK", "BAZHUAYU_AUTO");
            // B01 价格超区间(999)、B02 评论超上限(99)——都应 PASS，不再淘汰
            service.filterPageAndAppend(ctx, List.of(
                    row("a", "B01AAAAAAA", "999.00", "1"),
                    row("b", "B02BBBBBBB", "10.00", "99")
            ));

            Map<String, Object> preview = service.finishStreamingTask(ctx);

            assertThat(preview.get("passCount")).isEqualTo(2);
            assertThat(preview.get("priceFailCount")).isEqualTo(0);
            assertThat(preview.get("reviewFailCount")).isEqualTo(0);
        }
    }

    /** 简单可变持有，绕过 lambda 捕获 final 限制 */
    static class AtomicTask { AsinImportTask task; }
}
