package com.sjzm.product.modules.lingxing.controller;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.product.mapper.LingxingAsinBaselineMapper;
import com.sjzm.product.mapper.LingxingLocalProductMapper;
import com.sjzm.product.mapper.LingxingProfitAsinMapper;
import com.sjzm.product.mapper.LingxingSellerMapper;
import com.sjzm.product.mapper.LingxingSkuDataLayerMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingAsinBaseline;
import com.sjzm.product.modules.lingxing.service.LingxingClient;
import com.sjzm.product.modules.lingxing.service.LingxingConfigService;
import com.sjzm.product.modules.lingxing.service.LingxingLocalProductSyncService;
import com.sjzm.product.modules.lingxing.service.LingxingOverviewService;
import com.sjzm.product.modules.lingxing.service.LingxingProfitAsinSyncService;
import com.sjzm.product.modules.lingxing.service.LingxingPurchaseDataLayerService;
import com.sjzm.product.modules.lingxing.service.LingxingSellerSyncService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class LingxingControllerTest {

    @Mock private LingxingClient client;
    @Mock private LingxingConfigService configService;
    @Mock private LingxingLocalProductSyncService localProductSyncService;
    @Mock private LingxingLocalProductMapper localProductMapper;
    @Mock private LingxingSellerSyncService sellerSyncService;
    @Mock private LingxingSellerMapper sellerMapper;
    @Mock private LingxingProfitAsinSyncService profitSyncService;
    @Mock private LingxingProfitAsinMapper profitMapper;
    @Mock private LingxingPurchaseDataLayerService purchaseDataLayerService;
    @Mock private LingxingAsinBaselineMapper baselineMapper;
    @Mock private LingxingSkuDataLayerMapper syncRunMapper;
    @Mock private LingxingOverviewService overviewService;

    @InjectMocks private LingxingController controller;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), "LingxingControllerTest"),
                LingxingAsinBaseline.class);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void acceptsCredentialsOnlyFromJsonBody() throws Exception {
        mockMvc.perform(post("/api/v1/modules/lingxing/credentials")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"appId\":\"app-id\",\"appSecret\":\"secret-value\"}"))
                .andExpect(status().isOk());

        verify(configService).updateCredentials("app-id", "secret-value");
    }

    @Test
    void rejectsCredentialsFromQueryString() throws Exception {
        mockMvc.perform(post("/api/v1/modules/lingxing/credentials")
                        .param("appId", "app-id")
                        .param("appSecret", "secret-value"))
                .andExpect(status().isBadRequest());

        verify(configService, never()).updateCredentials(any(), any());
    }

    @Test
    void rejectsBlankCredentials() throws Exception {
        mockMvc.perform(post("/api/v1/modules/lingxing/credentials")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"appId\":\"  \",\"appSecret\":\"\"}"))
                .andExpect(status().isBadRequest());

        verify(configService, never()).updateCredentials(any(), any());
    }

    @Test
    void rejectsInvalidBaselineFacts() throws Exception {
        mockMvc.perform(post("/api/v1/modules/lingxing/baseline-maintenance/B000TEST")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"developer\":\"于林\",\"modelStartMonth\":\"2026-99\",\"analysisStatus\":\"随便写\"}"))
                .andExpect(status().isBadRequest());

        verify(baselineMapper, never()).updateById(any(LingxingAsinBaseline.class));
    }

    @Test
    void rejectsEmptyBaselineUpdate() throws Exception {
        mockMvc.perform(post("/api/v1/modules/lingxing/baseline-maintenance/B000TEST")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        verify(baselineMapper, never()).updateById(any(LingxingAsinBaseline.class));
    }

    @Test
    void rejectsNullOrBlankModelStartMonthAsAStandaloneUpdate() throws Exception {
        mockMvc.perform(post("/api/v1/modules/lingxing/baseline-maintenance/B000TEST")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"modelStartMonth\":null}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/modules/lingxing/baseline-maintenance/B000TEST")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"modelStartMonth\":\"\"}"))
                .andExpect(status().isBadRequest());

        verify(baselineMapper, never()).updateById(any(LingxingAsinBaseline.class));
    }

    @Test
    void rejectsBaselineTextLongerThanDatabaseColumns() throws Exception {
        String tags = "标".repeat(501);
        String basis = "据".repeat(129);

        mockMvc.perform(post("/api/v1/modules/lingxing/baseline-maintenance/B000TEST")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"listingTags\":\"" + tags + "\",\"modelStartBasis\":\"" + basis + "\"}"))
                .andExpect(status().isBadRequest());

        verify(baselineMapper, never()).updateById(any(LingxingAsinBaseline.class));
    }

    @Test
    void updatesOnlyFiveEditableBaselineFields() throws Exception {
        LingxingAsinBaseline saved = new LingxingAsinBaseline();
        saved.setAsin("B000TEST");
        when(baselineMapper.selectById("B000TEST")).thenReturn(saved);

        mockMvc.perform(post("/api/v1/modules/lingxing/baseline-maintenance/B000TEST")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "developer":"蒋舒",
                                  "listingTags":"欧洲精铺2025,绿标",
                                  "modelStartMonth":"2026-07",
                                  "modelStartBasis":"人工复核",
                                  "analysisStatus":"正常"
                                }
                                """))
                .andExpect(status().isOk());

        ArgumentCaptor<LingxingAsinBaseline> captor = ArgumentCaptor.forClass(LingxingAsinBaseline.class);
        verify(baselineMapper).updateById(captor.capture());
        LingxingAsinBaseline update = captor.getValue();
        assertThat(update.getAsin()).isEqualTo("B000TEST");
        assertThat(update.getDeveloper()).isEqualTo("蒋舒");
        assertThat(update.getListingTags()).isEqualTo("欧洲精铺2025,绿标");
        assertThat(update.getModelStartMonth()).isEqualTo("2026-07");
        assertThat(update.getModelStartBasis()).isEqualTo("人工复核");
        assertThat(update.getAnalysisStatus()).isEqualTo("正常");
        assertThat(update.getBaseSku()).isNull();
        assertThat(update.getBaseStore()).isNull();
        assertThat(update.getBaselineVersion()).isNull();
    }

    @Test
    void acceptsExistingBatchAnalysisStatus() throws Exception {
        LingxingAsinBaseline saved = new LingxingAsinBaseline();
        saved.setAsin("B000TEST");
        when(baselineMapper.selectById("B000TEST")).thenReturn(saved);

        mockMvc.perform(post("/api/v1/modules/lingxing/baseline-maintenance/B000TEST")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"analysisStatus\":\"可纳入截至截止月的批次分析\"}"))
                .andExpect(status().isOk());

        ArgumentCaptor<LingxingAsinBaseline> captor = ArgumentCaptor.forClass(LingxingAsinBaseline.class);
        verify(baselineMapper).updateById(captor.capture());
        assertThat(captor.getValue().getAnalysisStatus()).isEqualTo("可纳入截至截止月的批次分析");
    }

    @Test
    void keepsBaselineReadPathReadOnly() throws Exception {
        mockMvc.perform(post("/api/v1/modules/lingxing/baseline/B000TEST")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"developer\":\"蒋舒\"}"))
                .andExpect(status().isMethodNotAllowed());

        verify(baselineMapper, never()).updateById(any(LingxingAsinBaseline.class));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void treatsUnlabelledStatusAsNullOrEmpty() {
        when(baselineMapper.selectPage(any(Page.class), any(Wrapper.class)))
                .thenReturn(new Page<>());

        controller.listBaseline(1, 20, null, null, null, null, "未标注", null);

        ArgumentCaptor<Wrapper<LingxingAsinBaseline>> captor = ArgumentCaptor.forClass(Wrapper.class);
        verify(baselineMapper).selectPage(any(Page.class), captor.capture());
        String sql = captor.getValue().getSqlSegment();
        assertThat(sql).contains("analysis_status IS NULL");
        assertThat(sql).contains("analysis_status =");
    }

    @Test
    void normalizesNullAndBlankStatusesInOverviewAggregation() throws Exception {
        Select select = LingxingAsinBaselineMapper.class
                .getMethod("countByStatus")
                .getAnnotation(Select.class);

        assertThat(String.join(" ", select.value()))
                .contains("COALESCE(NULLIF(TRIM(analysis_status), ''), '未标注')");
    }
}
