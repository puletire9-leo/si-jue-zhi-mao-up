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

            // 第一页：B01 PASS, B02 价格超标(PRICE_FAIL)
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
            assertThat(preview.get("passCount")).isEqualTo(2);          // B01 + B03，B01 不重复
            assertThat(preview.get("priceFailCount")).isEqualTo(1);     // B02
            assertThat(preview.get("duplicateCount")).isEqualTo(1);     // 第二页的 B01
        }
    }

    /** 简单可变持有，绕过 lambda 捕获 final 限制 */
    static class AtomicTask { AsinImportTask task; }
}
