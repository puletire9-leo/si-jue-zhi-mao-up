package com.sjzm.product.service;

import com.sjzm.common.PageResult;
import com.sjzm.product.dto.MethodCardProductResponse;
import com.sjzm.product.dto.MethodCardQueryRequest;

import java.util.List;
import java.util.Map;

public interface MethodCardService {

    PageResult<MethodCardProductResponse> queryM01Products(MethodCardQueryRequest request);

    /** 与 M01 商品列表完全同口径的一级榜单分类统计（忽略当前 category 自身）。 */
    List<Map<String, Object>> queryM01Categories(MethodCardQueryRequest request);

    PageResult<MethodCardProductResponse> queryM02Products(MethodCardQueryRequest request);

    /**
     * M03「FBM 自发货简单道」候选查询。
     * 与 M01/M02 严格独立: 独立 Rule、独立 SQL、独立命中原因、独立 ruleSnapshot。
     */
    PageResult<MethodCardProductResponse> queryM03Products(MethodCardQueryRequest request);
}
