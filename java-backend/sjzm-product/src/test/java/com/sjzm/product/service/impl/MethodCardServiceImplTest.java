package com.sjzm.product.service.impl;

import com.sjzm.product.dto.MethodCardQueryRequest;
import com.sjzm.product.mapper.MethodCardMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class MethodCardServiceImplTest {

    @Test
    void normalizesLegacyDateValuesToIsoWeeks() {
        assertEquals("2026-W29", MethodCardServiceImpl.normalizeCreatedWeekValue("20260714"));
        assertEquals("2026-W28", MethodCardServiceImpl.normalizeCreatedWeekValue("2026-07-06"));
        assertEquals("2026-W29", MethodCardServiceImpl.normalizeCreatedWeekValue("2026-W29"));
    }

    @Test
    void keepsAllSelectedWeeksAndRemovesDuplicates() {
        MethodCardMapper mapper = mock(MethodCardMapper.class);
        MethodCardServiceImpl service = new MethodCardServiceImpl(mapper);
        MethodCardQueryRequest request = new MethodCardQueryRequest();
        request.setCreatedWeeks(List.of("20260714", "2026-W28", "20260714"));

        assertEquals(
                List.of("2026-W29", "2026-W28"),
                service.resolveEffectiveWeekTags(request, "UK")
        );
        verifyNoInteractions(mapper);
    }

    @Test
    void fallsBackToLatestWeekOnlyWhenNoWeekWasSelected() {
        MethodCardMapper mapper = mock(MethodCardMapper.class);
        when(mapper.selectLatestM01EffectiveWeek("UK")).thenReturn("2026-W29");
        MethodCardServiceImpl service = new MethodCardServiceImpl(mapper);

        assertEquals(
                List.of("2026-W29"),
                service.resolveEffectiveWeekTags(new MethodCardQueryRequest(), "UK")
        );
    }
}
