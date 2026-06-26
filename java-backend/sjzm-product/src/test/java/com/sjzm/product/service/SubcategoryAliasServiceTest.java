package com.sjzm.product.service;

import com.sjzm.product.dto.SubcategoryAliasBatchReviewRequest;
import com.sjzm.product.entity.SubcategoryAliasMap;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.SubcategoryAliasMapMapper;
import com.sjzm.product.service.impl.SubcategoryAliasServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SubcategoryAliasServiceTest {

    @Mock
    SubcategoryAliasMapMapper subcategoryAliasMapMapper;

    @Mock
    CompetitorProductMapper competitorProductMapper;

    @InjectMocks
    SubcategoryAliasServiceImpl service;

    @Test
    void bootstrap_usesWinnerRawDirectionCanonical() {
        when(subcategoryAliasMapMapper.selectList(any())).thenReturn(List.of());
        when(subcategoryAliasMapMapper.selectWinnerSubcategorySeeds()).thenReturn(List.of(
                row("rawSubcategory", "Reusable Shopping Bags", "carrierHint", "Canvas Tote", "sampleCount", 17),
                row("rawSubcategory", "Unknown Holder", "carrierHint", "Mystery Carrier", "sampleCount", 3)
        ));
        when(subcategoryAliasMapMapper.selectCompetitorLeafSeeds("202606", "UK")).thenReturn(List.of());

        Map<String, Object> result = service.bootstrap("202606", "UK");

        ArgumentCaptor<SubcategoryAliasMap> captor = ArgumentCaptor.forClass(SubcategoryAliasMap.class);
        verify(subcategoryAliasMapMapper, times(2)).upsert(captor.capture());
        List<SubcategoryAliasMap> aliases = captor.getAllValues();

        SubcategoryAliasMap approved = aliases.stream()
                .filter(alias -> "Reusable Shopping Bags".equals(alias.getRawSubcategory()))
                .findFirst()
                .orElseThrow();
        assertThat(approved.getCanonicalKey()).isEqualTo("reusable_shopping_bags");
        assertThat(approved.getCanonicalName()).isEqualTo("Reusable Shopping Bags");
        assertThat(approved.getStatus()).isEqualTo("APPROVED");
        assertThat(approved.getMatchMethod()).isEqualTo("WINNER_RAW");
        assertThat(approved.getCarrierHint()).isEqualTo("Canvas Tote");

        SubcategoryAliasMap secondWinner = aliases.stream()
                .filter(alias -> "Unknown Holder".equals(alias.getRawSubcategory()))
                .findFirst()
                .orElseThrow();
        assertThat(secondWinner.getCanonicalKey()).isEqualTo("unknown_holder");
        assertThat(secondWinner.getStatus()).isEqualTo("APPROVED");

        assertThat(result.get("approvedWinnerAliases")).isEqualTo(2);
        assertThat(result.get("pendingWinnerAliases")).isEqualTo(0);
        assertThat(result.get("winnerCanonicalKeys")).isEqualTo(2);
    }

    @Test
    void bootstrap_mapsCompetitorCategoryToUniqueWinnerDirection() {
        when(subcategoryAliasMapMapper.selectList(any())).thenReturn(List.of());
        when(subcategoryAliasMapMapper.selectWinnerSubcategorySeeds()).thenReturn(List.of(
                row("rawSubcategory", "Garden Sun Catchers", "carrierHint", "Suncatcher", "sampleCount", 21)
        ));
        when(subcategoryAliasMapMapper.selectCompetitorLeafSeeds("202606", "UK")).thenReturn(List.of(
                row("marketplace", "UK", "rawSubcategory", "Glass Art & Suncatchers", "sampleCount", 155)
        ));

        service.bootstrap("202606", "UK");

        ArgumentCaptor<SubcategoryAliasMap> captor = ArgumentCaptor.forClass(SubcategoryAliasMap.class);
        verify(subcategoryAliasMapMapper, times(2)).upsert(captor.capture());

        SubcategoryAliasMap competitorAlias = captor.getAllValues().stream()
                .filter(alias -> "COMPETITOR".equals(alias.getSourceType()))
                .findFirst()
                .orElseThrow();

        assertThat(competitorAlias.getCanonicalKey()).isEqualTo("garden_sun_catchers");
        assertThat(competitorAlias.getCanonicalName()).isEqualTo("Garden Sun Catchers");
        assertThat(competitorAlias.getStatus()).isEqualTo("APPROVED");
        assertThat(competitorAlias.getMatchMethod()).isEqualTo("CATEGORY_RULE");
    }

    @Test
    void batchReview_approvePreservesExistingSampleMetadata() {
        SubcategoryAliasMap existing = new SubcategoryAliasMap();
        existing.setId(101L);
        existing.setSourceType("COMPETITOR");
        existing.setMarketplace("UK");
        existing.setRawSubcategory("Glass Art & Suncatchers");
        existing.setSampleCount(155);
        existing.setLatestMonth("202606");
        existing.setCreatedAt(LocalDateTime.of(2026, 6, 24, 10, 0));
        when(subcategoryAliasMapMapper.selectOne(any())).thenReturn(existing);

        SubcategoryAliasBatchReviewRequest request = new SubcategoryAliasBatchReviewRequest();
        request.setAction("APPROVE");
        request.setMarketplace("UK");
        request.setCanonicalKey("sun_catcher");
        request.setCanonicalName("Sun Catcher");
        request.setRawSubcategories(List.of("Glass Art & Suncatchers"));

        Map<String, Object> result = service.batchReview(request);

        ArgumentCaptor<SubcategoryAliasMap> captor = ArgumentCaptor.forClass(SubcategoryAliasMap.class);
        verify(subcategoryAliasMapMapper).upsert(captor.capture());
        SubcategoryAliasMap saved = captor.getValue();

        assertThat(saved.getStatus()).isEqualTo("APPROVED");
        assertThat(saved.getCanonicalKey()).isEqualTo("sun_catcher");
        assertThat(saved.getSampleCount()).isEqualTo(155);
        assertThat(saved.getLatestMonth()).isEqualTo("202606");
        assertThat(saved.getMatchMethod()).isEqualTo("MANUAL_BATCH");
        assertThat(result.get("approvedCount")).isEqualTo(1);
    }

    @Test
    void bootstrap_preservesRejectedAliasAcrossRebuild() {
        SubcategoryAliasMap rejected = new SubcategoryAliasMap();
        rejected.setId(201L);
        rejected.setSourceType("COMPETITOR");
        rejected.setMarketplace("UK");
        rejected.setRawSubcategory("T-Shirts");
        rejected.setStatus("REJECTED");
        rejected.setMatchMethod("MANUAL_BATCH");
        rejected.setSampleCount(287);
        rejected.setLatestMonth("202606");
        rejected.setNotes("not our carrier");
        rejected.setCreatedAt(LocalDateTime.of(2026, 6, 24, 11, 0));

        when(subcategoryAliasMapMapper.selectList(any())).thenReturn(List.of(rejected));
        when(subcategoryAliasMapMapper.selectWinnerSubcategorySeeds()).thenReturn(List.of(
                row("rawSubcategory", "Kids' Play Action Figures", "carrierHint", "Figure", "sampleCount", 12)
        ));
        when(subcategoryAliasMapMapper.selectCompetitorLeafSeeds("202606", "UK")).thenReturn(List.of(
                row("marketplace", "UK", "rawSubcategory", "T-Shirts", "sampleCount", 287)
        ));

        service.bootstrap("202606", "UK");

        ArgumentCaptor<SubcategoryAliasMap> captor = ArgumentCaptor.forClass(SubcategoryAliasMap.class);
        verify(subcategoryAliasMapMapper, atLeastOnce()).upsert(captor.capture());
        SubcategoryAliasMap preserved = captor.getAllValues().stream()
                .filter(alias -> "T-Shirts".equals(alias.getRawSubcategory()))
                .findFirst()
                .orElseThrow();

        assertThat(preserved.getStatus()).isEqualTo("REJECTED");
        assertThat(preserved.getMatchMethod()).isEqualTo("MANUAL_BATCH");
        assertThat(preserved.getNotes()).isEqualTo("not our carrier");
        assertThat(preserved.getSampleCount()).isEqualTo(287);
    }

    @Test
    void listReviewCandidates_returnsSuggestedWinnerDirections() {
        SubcategoryAliasMap pending = new SubcategoryAliasMap();
        pending.setSourceType("COMPETITOR");
        pending.setMarketplace("UK");
        pending.setRawSubcategory("Sun Catchers");
        pending.setSampleCount(148);
        pending.setLatestMonth("202606");
        pending.setStatus("PENDING");

        SubcategoryAliasMap winnerA = new SubcategoryAliasMap();
        winnerA.setSourceType("WINNER");
        winnerA.setMarketplace("ALL");
        winnerA.setRawSubcategory("Garden Sun Catchers");
        winnerA.setNormalizedSubcategory("garden sun catchers");
        winnerA.setCanonicalKey("garden_sun_catchers");
        winnerA.setCanonicalName("Garden Sun Catchers");
        winnerA.setCarrierHint("Suncatcher");
        winnerA.setSampleCount(35);
        winnerA.setStatus("APPROVED");

        SubcategoryAliasMap winnerB = new SubcategoryAliasMap();
        winnerB.setSourceType("WINNER");
        winnerB.setMarketplace("ALL");
        winnerB.setRawSubcategory("Glass Art & Suncatchers");
        winnerB.setNormalizedSubcategory("glass art suncatchers");
        winnerB.setCanonicalKey("glass_art_suncatchers");
        winnerB.setCanonicalName("Glass Art & Suncatchers");
        winnerB.setCarrierHint("Suncatcher");
        winnerB.setSampleCount(4);
        winnerB.setStatus("APPROVED");

        when(subcategoryAliasMapMapper.selectList(any()))
                .thenReturn(List.of(pending))
                .thenReturn(List.of(winnerA, winnerB));

        List<Map<String, Object>> result = service.listReviewCandidates("COMPETITOR", "UK", 10, 3);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).get("rawSubcategory")).isEqualTo("Sun Catchers");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> suggestions = (List<Map<String, Object>>) result.get(0).get("suggestions");
        assertThat(suggestions).hasSize(2);
        assertThat(suggestions.get(0).get("canonicalKey")).isEqualTo("garden_sun_catchers");
        assertThat(suggestions.get(1).get("canonicalKey")).isEqualTo("glass_art_suncatchers");
    }

    private static Map<String, Object> row(Object... kvs) {
        Map<String, Object> row = new java.util.LinkedHashMap<>();
        for (int i = 0; i < kvs.length; i += 2) {
            row.put(String.valueOf(kvs[i]), kvs[i + 1]);
        }
        return row;
    }
}
