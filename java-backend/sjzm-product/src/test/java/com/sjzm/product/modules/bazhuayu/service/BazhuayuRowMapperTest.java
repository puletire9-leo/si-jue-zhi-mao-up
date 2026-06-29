package com.sjzm.product.modules.bazhuayu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 八爪鱼行整形单测。
 * 核心契约：整形结果的列序必须与 AsinImportService.filterRows 的位置索引对齐
 * （[1]=ASIN / [3]=价格 / [4]=评论数），否则初筛会取错值。
 */
class BazhuayuRowMapperTest {

    private final ObjectMapper om = new ObjectMapper();

    private com.fasterxml.jackson.databind.JsonNode json(String s) {
        try {
            return om.readTree(s);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void shapeRow_putsValuesAtFilterExpectedIndices() {
        Map<String, String> row = BazhuayuRowMapper.shapeRow("B012345678", "12.99", "3", "Cool Widget");

        // filterRows 用 getByIndex：[1]=ASIN, [3]=price, [4]=reviews（[0]=标题, [2]=占位）
        List<String> values = new ArrayList<>(row.values());
        assertThat(values.get(0)).isEqualTo("Cool Widget");
        assertThat(values.get(1)).isEqualTo("B012345678");
        assertThat(values.get(2)).isEmpty();
        assertThat(values.get(3)).isEqualTo("12.99");
        assertThat(values.get(4)).isEqualTo("3");
    }

    @Test
    void shapeRow_nullsBecomeEmptyStrings() {
        Map<String, String> row = BazhuayuRowMapper.shapeRow("B0AAAAAAAA", null, null, null);
        List<String> values = new ArrayList<>(row.values());
        assertThat(values.get(1)).isEqualTo("B0AAAAAAAA");
        assertThat(values.get(3)).isEmpty();
        assertThat(values.get(4)).isEmpty();
    }

    @Test
    void extractAsin_validatesAndNormalizes() {
        // 小写规范化为大写
        assertThat(BazhuayuRowMapper.extractAsin(json("{\"ASIN\":\"b01abcdefg\"}")))
                .isEqualTo("B01ABCDEFG");
        // 字段名回退
        assertThat(BazhuayuRowMapper.extractAsin(json("{\"产品ASIN\":\"B09ZZZZZZZ\"}")))
                .isEqualTo("B09ZZZZZZZ");
    }

    @Test
    void extractAsin_rejectsInvalid() {
        assertThat(BazhuayuRowMapper.extractAsin(json("{\"ASIN\":\"NOT-AN-ASIN\"}"))).isNull();
        assertThat(BazhuayuRowMapper.extractAsin(json("{\"other\":\"x\"}"))).isNull();
        assertThat(BazhuayuRowMapper.extractAsin(json("{\"ASIN\":\"\"}"))).isNull();
    }

    @Test
    void pick_returnsFirstNonEmptyByFallbackOrder() {
        // 首选名空，回退到下一个候选
        assertThat(BazhuayuRowMapper.pick(json("{\"价格\":\"\",\"售价\":\"9.99\"}"),
                BazhuayuRowMapper.PRICE_KEYS)).isEqualTo("9.99");
        // 全空返回 null
        assertThat(BazhuayuRowMapper.pick(json("{\"foo\":\"bar\"}"),
                BazhuayuRowMapper.REVIEW_KEYS)).isNull();
    }
}
