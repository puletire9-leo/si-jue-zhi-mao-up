package com.sjzm.product.mapper;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class AiSelectionMapperXmlTest {

    @Test
    void carrierRecallUsesHardExcludesConditionalExcludesAndFinishedProductProtection() throws IOException {
        String xml;
        try (var input = getClass().getResourceAsStream("/mapper/AiSelectionMapper.xml")) {
            assertThat(input).isNotNull();
            xml = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertThat(xml)
                .contains("collection=\"excludeKeywords\"")
                .contains("collection=\"conditionalExcludeKeywords\"")
                .contains("collection=\"includeKeywords\"")
                .contains("AND s.title NOT LIKE CONCAT('%', #{ex}, '%')")
                .contains("AND s.title NOT LIKE CONCAT('%', #{conditionalEx}, '%')")
                .contains("OR s.title LIKE CONCAT('%', #{includeKw}, '%')");
    }

    @Test
    void bothSourceHarvestsUseTheSameRecallAndIncrementalFilters() throws IOException {
        String xml;
        try (var input = getClass().getResourceAsStream("/mapper/AiSelectionMapper.xml")) {
            assertThat(input).isNotNull();
            xml = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertThat(count(xml, "<include refid=\"dualChannelWhere\"/>")) .isEqualTo(2);
        assertThat(count(xml, "<include refid=\"incrementalNotExists\"/>")) .isEqualTo(2);
    }

    private int count(String text, String token) {
        return (text.length() - text.replace(token, "").length()) / token.length();
    }
}
