package com.sjzm.product.service;

import java.util.Map;

public interface CategoryDislocationService {

    Map<String, Object> computeDislocation(String month, String marketplace);

    Map<String, Object> getSignalHealth(String marketplace, String subCategory, String month);

    Map<String, Object> listOpportunities(String marketplace, String month, String heatSignal, int limit);

    Map<String, Object> listActionableOpportunities(String marketplace, String month, String heatSignal, int limit);
}
