package com.sjzm.product.modules.lingxing.controller;

import com.sjzm.product.modules.lingxing.service.LingxingClient;
import com.sjzm.product.modules.lingxing.service.LingxingConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 领星凭证端点安全测试：凭证只能走 JSON body，不能从 query string 泄露。
 * （baseline 相关测试已随 lingxing_asin_baseline 表下线一并移除。）
 */
@ExtendWith(MockitoExtension.class)
class LingxingControllerTest {

    @Mock private LingxingClient client;
    @Mock private LingxingConfigService configService;

    @InjectMocks private LingxingController controller;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
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
}
