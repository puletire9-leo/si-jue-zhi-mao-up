package com.sjzm.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.entity.RecycleBin;

import java.util.Map;

public interface RecycleBinService {

    Map<String, Object> getStats();

    Page<RecycleBin> listRecycleBinItems(int page, int size, String keyword, String startDate, String endDate);

    Map<String, Object> restoreProduct(String sku);

    Map<String, Object> batchRestoreProducts(String[] skus);

    Map<String, Object> deletePermanently(String sku);

    Map<String, Object> batchDeletePermanently(String[] skus);

    Map<String, Object> cleanExpiredProducts();
}
