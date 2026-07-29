package com.sjzm.product.mapper;

import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class DengZongShopMapperBatchFilterTest {

    @Test
    void explicitBatchFiltersDoNotIncludeLegacyNullBatchRows() {
        Set<String> batchScopedMethods = Set.of(
                "selectGroupedByParent",
                "countGroupedByParent",
                "selectSellerSummary",
                "selectFetchedSellerNames",
                "selectRatingData");

        for (String methodName : batchScopedMethods) {
            Method method = Arrays.stream(DengZongShopMapper.class.getDeclaredMethods())
                    .filter(candidate -> candidate.getName().equals(methodName))
                    .findFirst()
                    .orElseThrow();
            Select select = method.getAnnotation(Select.class);
            String sql = String.join("", select.value());

            assertThat(sql)
                    .as(methodName)
                    .contains("batchDate != null")
                    .doesNotContain("batch_date IS NULL");
        }
    }

    @Test
    void batchOptionCountUsesTheSameParentGroupingAsTheProductList() {
        Method method = Arrays.stream(DengZongShopMapper.class.getDeclaredMethods())
                .filter(candidate -> candidate.getName().equals("selectBatchDatesWithCount"))
                .findFirst()
                .orElseThrow();
        String sql = String.join("", method.getAnnotation(Select.class).value());

        assertThat(sql).contains("COUNT(DISTINCT COALESCE(NULLIF(parent_asin,''), asin)) AS count");
    }
}
