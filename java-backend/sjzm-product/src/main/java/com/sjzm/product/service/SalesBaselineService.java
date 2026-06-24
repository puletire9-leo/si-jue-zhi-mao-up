package com.sjzm.product.service;

import java.util.Map;

public interface SalesBaselineService {

    Map<String, Object> computeBsrBaseline(String month, String marketplace);

    Map<String, Object> getBsrHealth(String marketplace, String bsrId, Integer bsr, String month);

    Map<String, Object> computeSubcategoryBaseline(String month, String marketplace);

    Map<String, Object> getSubcategoryHealth(String marketplace, String subCategory, String month);
}
