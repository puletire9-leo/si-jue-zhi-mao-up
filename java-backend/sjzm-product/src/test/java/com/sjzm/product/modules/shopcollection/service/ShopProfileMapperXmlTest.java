package com.sjzm.product.modules.shopcollection.service;

import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class ShopProfileMapperXmlTest {

    @Test
    void shopProductsSnapshotQueriesFilterBySourceRunId() throws Exception {
        String xml = readMapperXml();

        assertSelectContainsSourceRunId(xml, "selectSummaryFromShopProducts");
        assertSelectContainsSourceRunId(xml, "selectTierAgeCategoryCellsBatchFromShopProducts");
        assertSelectContainsSourceRunId(xml, "countProductsFromShopProducts");
        assertSelectContainsSourceRunId(xml, "selectProductsFromShopProducts");
        assertSelectContainsSourceRunId(xml, "selectCategoriesFromShopProducts");
    }

    @Test
    void sellerSummaryLimitIsOptionalForFullSnapshotRefresh() throws Exception {
        String select = selectById(readMapperXml(), "selectSummaryFromShopProducts");

        assertThat(select).contains("<if test=\"limit != null and limit > 0\">LIMIT #{limit}</if>");
    }

    private void assertSelectContainsSourceRunId(String xml, String selectId) {
        String select = selectById(xml, selectId);
        assertThat(select).as(selectId + " filters source_run_id")
                .contains("ds.source_run_id = #{sourceRunId}");
    }

    private String selectById(String xml, String selectId) {
        String start = "<select id=\"" + selectId + "\"";
        int startIndex = xml.indexOf(start);
        assertThat(startIndex).as(selectId + " exists").isGreaterThanOrEqualTo(0);
        int endIndex = xml.indexOf("</select>", startIndex);
        assertThat(endIndex).as(selectId + " has closing tag").isGreaterThan(startIndex);
        return xml.substring(startIndex, endIndex);
    }

    private String readMapperXml() throws Exception {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream("mapper/ShopProfileMapper.xml")) {
            assertThat(in).as("mapper/ShopProfileMapper.xml is on classpath").isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
