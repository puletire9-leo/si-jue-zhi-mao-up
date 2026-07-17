package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.sjzm.product.entity.ApiConfig;
import com.sjzm.product.mapper.ApiConfigMapper;
import com.sjzm.product.modules.lingxing.config.LingxingConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LingxingConfigServiceTest {

    @Mock private LingxingConfig config;
    @Mock private ApiConfigMapper apiConfigMapper;

    @InjectMocks private LingxingConfigService service;

    @Test
    void propagatesCredentialPersistenceException() {
        when(apiConfigMapper.selectOne(any(Wrapper.class)))
                .thenThrow(new IllegalStateException("database unavailable"));

        assertThatThrownBy(() -> service.updateCredentials("app-id", "app-secret"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("database unavailable");
    }

    @Test
    void rejectsZeroRowCredentialUpdate() {
        ApiConfig existing = new ApiConfig();
        existing.setId(1L);
        existing.setConfigKey("lingxing_app_id");
        when(apiConfigMapper.selectOne(any(Wrapper.class))).thenReturn(existing);
        when(apiConfigMapper.updateById(existing)).thenReturn(0);

        assertThatThrownBy(() -> service.updateCredentials("app-id", "app-secret"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("lingxing_app_id");
    }
}
