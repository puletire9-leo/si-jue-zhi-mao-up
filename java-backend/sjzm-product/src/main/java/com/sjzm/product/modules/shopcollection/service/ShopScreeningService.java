package com.sjzm.product.modules.shopcollection.service;

import com.sjzm.common.PageResult;
import com.sjzm.product.config.DatabaseWorkloadGate;
import com.sjzm.product.methodrule.M01Rule;
import com.sjzm.product.modules.shopcollection.dto.ShopScreeningQuery;
import com.sjzm.product.modules.shopcollection.dto.ShopScreeningRow;
import com.sjzm.product.modules.shopcollection.mapper.ShopScreeningMapper;
import com.sjzm.product.modules.analysisbaseline.common.MarketplaceSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ShopScreeningService {

    private final ShopScreeningMapper mapper;
    private final DatabaseWorkloadGate workloadGate;

    public PageResult<ShopScreeningRow> screen(ShopScreeningQuery query) {
        if (query == null) {
            query = new ShopScreeningQuery();
        }
        String marketplace = MarketplaceSupport.require(query.getMarketplace());
        query.setMarketplace(marketplace);
        query.setScope("WATCHLIST".equalsIgnoreCase(query.getScope()) ? "WATCHLIST" : "ALL");
        query.setSellerNames(normalizeValues(query.getSellerNames()));
        query.setBatchCodes(normalizeValues(query.getBatchCodes()));
        query.setFulfillment(normalizeUpperValues(query.getFulfillment()));
        query.setCategories(normalizeValues(query.getCategories()));
        if (query.getBatchCodes().isEmpty()) {
            List<Map<String, Object>> options = mapper.selectBatchOptions(marketplace);
            if (!options.isEmpty() && options.get(0).get("batchCode") != null) {
                query.setBatchCodes(List.of(String.valueOf(options.get(0).get("batchCode"))));
            }
        }
        query.setWatchlistStatus(normalizeUpper(query.getWatchlistStatus()));
        query.setSourceType(normalizeUpper(query.getSourceType()));
        query.setProductFilterActive(hasProductFilters(query));
        query.setSortBy(normalizeSort(query.getSortBy()));
        query.setSortOrder("asc".equalsIgnoreCase(query.getSortOrder()) ? "ASC" : "DESC");
        query.setPage(query.safePage());
        query.setSize(query.safeSize());

        M01Rule rule = M01Rule.forMarketplace(marketplace);
        ShopScreeningQuery effectiveQuery = query;
        List<ShopScreeningRow> rows = workloadGate.runHeavyQuery(() -> mapper.screen(
                effectiveQuery, rule.priceMin(), rule.priceMax(), rule.weightMax(),
                rule.listingDaysMax(), rule.sales30(), rule.sales60(), rule.sales90(), rule.bsrMax()));
        long total = rows.isEmpty() ? 0L : rows.get(0).getTotalRows();
        return PageResult.of(rows, total, (long) query.safePage(), (long) query.safeSize());
    }

    public List<Map<String, Object>> batchOptions(String marketplace) {
        return mapper.selectBatchOptions(MarketplaceSupport.require(marketplace));
    }

    private List<String> normalizeValues(List<String> values) {
        if (values == null) return new ArrayList<>();
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String value : values) {
            if (!StringUtils.hasText(value)) continue;
            for (String part : value.split("[,\\r\\n]+")) {
                if (StringUtils.hasText(part)) result.add(part.trim());
            }
        }
        return new ArrayList<>(result);
    }

    private List<String> normalizeUpperValues(List<String> values) {
        return normalizeValues(values).stream().map(v -> v.toUpperCase(Locale.ROOT)).toList();
    }

    private String normalizeUpper(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : null;
    }

    private String normalizeSort(String value) {
        if (!StringUtils.hasText(value)) return "passedProductCount";
        return switch (value.trim()) {
            case "productCount", "passedProductCount", "m01HitCount", "avgListingDays", "new90Count" -> value.trim();
            default -> "passedProductCount";
        };
    }

    private boolean hasProductFilters(ShopScreeningQuery q) {
        return q.getPriceMin() != null || q.getPriceMax() != null
                || q.getUnitsMin() != null || q.getUnitsMax() != null
                || q.getListingDaysMin() != null || q.getListingDaysMax() != null
                || q.getBsrMax() != null || q.getWeightMax() != null
                || q.getMaxVariantCount() != null || !q.getFulfillment().isEmpty()
                || !q.getCategories().isEmpty() || Boolean.TRUE.equals(q.getM01Only());
    }
}
