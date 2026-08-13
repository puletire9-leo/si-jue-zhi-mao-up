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
    void bothSourceHarvestsUseTheSameRecallAndNoCrossBatchDedup() throws IOException {
        String xml;
        try (var input = getClass().getResourceAsStream("/mapper/AiSelectionMapper.xml")) {
            assertThat(input).isNotNull();
            xml = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        // 双通道召回：shop + clean 两处
        assertThat(count(xml, "<include refid=\"dualChannelWhere\"/>")) .isEqualTo(2);
        // 已去掉跨批次增量去重：每次 harvest 全量重灌进新批次，批次内靠 uk_batch_asin_mp 去重
        assertThat(count(xml, "<include refid=\"incrementalNotExists\"/>")) .isEqualTo(0);
        assertThat(xml).doesNotContain("<sql id=\"incrementalNotExists\">");
    }

    private int count(String text, String token) {
        return (text.length() - text.replace(token, "").length()) / token.length();
    }
}
