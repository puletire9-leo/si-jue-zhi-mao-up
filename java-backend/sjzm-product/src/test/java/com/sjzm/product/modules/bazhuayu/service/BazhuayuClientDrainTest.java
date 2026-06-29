package com.sjzm.product.modules.bazhuayu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.product.modules.bazhuayu.config.BazhuayuConfig;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * drainNotExported 循环逻辑测试（spy 掉 HTTP 方法，只验证循环/停止/标记契约）。
 */
class BazhuayuClientDrainTest {

    private final ObjectMapper om = new ObjectMapper();

    private List<JsonNode> fakePage(int n) {
        List<JsonNode> page = new ArrayList<>();
        for (int i = 0; i < n; i++) page.add(om.createObjectNode().put("ASIN", "B0" + i));
        return page;
    }

    private BazhuayuClient spyClient(int pageSize) {
        BazhuayuConfig cfg = new BazhuayuConfig();
        cfg.setDataPageSize(pageSize);
        // ConfigService 不会被 drain 用到，传 null 占位（spy 后不触发真实方法）
        return spy(new BazhuayuClient(cfg, null));
    }

    @Test
    void drainStopsOnEmptyPage_andMarksEachFullPage() {
        BazhuayuClient client = spyClient(1000);
        // 第1页满(1000)，第2页满(1000)，第3页空 → 停
        doReturn(fakePage(1000), fakePage(1000), List.of())
                .when(client).getNotExportedPage(anyString(), anyInt());
        doNothing().when(client).markExported(anyString());
        doNothing().when(client).sleep2s();   // 跳过真实 2s sleep

        AtomicInteger handled = new AtomicInteger();
        int processed = client.drainNotExported("t1", page -> handled.addAndGet(page.size()), 0);

        assertThat(processed).isEqualTo(2000);
        assertThat(handled.get()).isEqualTo(2000);
        verify(client, times(2)).markExported("t1");          // 两满页各标记一次
        verify(client, times(3)).getNotExportedPage("t1", 1000); // 第3页空才停
    }

    @Test
    void drainStopsOnPartialPage() {
        BazhuayuClient client = spyClient(1000);
        // 第1页不足整页(500) → 末页，标记后停
        doReturn(fakePage(500)).when(client).getNotExportedPage(anyString(), anyInt());
        doNothing().when(client).markExported(anyString());

        int processed = client.drainNotExported("t1", page -> {}, 0);

        assertThat(processed).isEqualTo(500);
        verify(client, times(1)).markExported("t1");
        verify(client, times(1)).getNotExportedPage("t1", 1000);
    }

    @Test
    void drainRespectsMaxRows() {
        BazhuayuClient client = spyClient(1000);
        // 每页满，maxRows=1500 → 处理 2 页(2000)就停（达上限）
        doReturn(fakePage(1000)).when(client).getNotExportedPage(anyString(), anyInt());
        doNothing().when(client).markExported(anyString());
        doNothing().when(client).sleep2s();

        int processed = client.drainNotExported("t1", page -> {}, 1500);

        // 处理完第2页时 processed=2000 >= 1500 退出
        assertThat(processed).isEqualTo(2000);
        verify(client, times(2)).getNotExportedPage("t1", 1000);
    }
}
