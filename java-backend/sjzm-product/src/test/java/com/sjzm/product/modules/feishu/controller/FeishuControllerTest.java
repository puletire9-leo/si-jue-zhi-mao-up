package com.sjzm.product.modules.feishu.controller;

import com.sjzm.product.modules.automation.config.FinanceDailyReportConfig;
import com.sjzm.product.modules.automation.config.OperationsLogisticsAutomationConfig;
import com.sjzm.product.modules.feishu.service.FeishuClient;
import com.sjzm.product.modules.feishu.service.FeishuConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class FeishuControllerTest {

    @Mock private FeishuClient feishuClient;
    @Mock private FeishuConfigService configService;
    @Mock private FinanceDailyReportConfig financeConfig;
    @Mock private OperationsLogisticsAutomationConfig operationsConfig;
    @InjectMocks private FeishuController controller;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void configStatusNeverReturnsSecret() throws Exception {
        when(configService.getAppId()).thenReturn("cli_1234567890");
        when(configService.getAppSecret()).thenReturn("top-secret-value");

        mockMvc.perform(get("/api/v1/modules/feishu/config/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configured").value(true))
                .andExpect(jsonPath("$.data.appSecretConfigured").value(true))
                .andExpect(content().string(not(containsString("top-secret-value"))));
    }

    @Test
    void updatesCredentialsOnlyFromJsonBody() throws Exception {
        mockMvc.perform(put("/api/v1/modules/feishu/credentials")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"appId\":\"cli_new\",\"appSecret\":\"new-secret\"}"))
                .andExpect(status().isOk());

        verify(configService).updateCredentials("cli_new", "new-secret");
    }
}

