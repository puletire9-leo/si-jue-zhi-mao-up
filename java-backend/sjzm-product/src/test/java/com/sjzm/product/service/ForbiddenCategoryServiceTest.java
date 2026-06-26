package com.sjzm.product.service;

import com.sjzm.product.entity.ApiConfig;
import com.sjzm.product.mapper.ApiConfigMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForbiddenCategoryServiceTest {

    @Mock
    ApiConfigMapper apiConfigMapper;

    @InjectMocks
    ForbiddenCategoryService service;

    @Test
    void fallsBackToHardcodedWhenConfigMissing() {
        when(apiConfigMapper.selectOne(any())).thenReturn(null);
        assertThat(service.isForbidden("Electronics & Photo")).isTrue();
        assertThat(service.isForbidden("Home & Kitchen")).isFalse();
    }

    @Test
    void usesConfigJsonWhenPresent() {
        ApiConfig cfg = new ApiConfig();
        cfg.setConfigKey("forbidden_categories");
        cfg.setConfigValue("[\"Toys & Games\"]");
        when(apiConfigMapper.selectOne(any())).thenReturn(cfg);
        assertThat(service.isForbidden("Toys & Games")).isTrue();
        assertThat(service.isForbidden("Electronics & Photo")).isFalse();
    }

    @Test
    void fallsBackWhenJsonInvalid() {
        ApiConfig cfg = new ApiConfig();
        cfg.setConfigValue("not-json");
        when(apiConfigMapper.selectOne(any())).thenReturn(cfg);
        assertThat(service.isForbidden("Books")).isTrue();
    }

    @Test
    void nullCategoryIsNotForbidden() {
        assertThat(service.isForbidden(null)).isFalse();
    }
}
