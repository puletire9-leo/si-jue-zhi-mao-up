package com.sjzm.service;

import com.sjzm.dto.*;
import java.util.List;
import java.util.Map;

public interface ProductSalesService {

    SearchResponse searchProducts(String keyword, List<String> shops, String startDate, String endDate, int limit, int offset);

    WeeklySalesResponse getWeeklySales(List<String> asins, String startDate, String endDate, List<String> shops);

    List<ShopInfo> getShops();

    DateRangeResponse getDateRange();

    PeriodComparisonResponse getPeriodComparison(List<String> asins, PeriodComparisonRequest.PeriodRange periodA, PeriodComparisonRequest.PeriodRange periodB, List<String> shops);

    PeriodTrendComparisonResponse getPeriodTrend(List<String> asins, PeriodComparisonRequest.PeriodRange periodA, PeriodComparisonRequest.PeriodRange periodB, List<String> shops);

    Map<String, Object> healthCheck();
}
