package com.sjzm.product.service;

import java.util.Map;

public interface ElementDiscoveryService {

    Map<String, Object> previewPath2(String marketplace,
                                     String month,
                                     int scanLimit,
                                     int topN,
                                     int minProducts,
                                     int minTotalUnits);

    Map<String, Object> previewCarrierMatch(String marketplace,
                                            String month,
                                            int scanLimit,
                                            int topN,
                                            int samplePerCarrier,
                                            String carrier);

    Map<String, Object> listManualCandidates(String marketplace,
                                             String month,
                                             int scanLimit,
                                             int limit,
                                             String carrier);
}
