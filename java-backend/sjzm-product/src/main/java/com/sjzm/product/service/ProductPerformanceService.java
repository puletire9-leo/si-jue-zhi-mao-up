package com.sjzm.product.service;

import com.sjzm.product.entity.ProductPerformanceActual;

import java.util.List;

public interface ProductPerformanceService {

    int importFromMarkdown(String filePath);

    List<ProductPerformanceActual> listWinners(String marketplace);

    List<ProductPerformanceActual> listByArchetype(String archetype);

    long count();
}
