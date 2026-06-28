package com.sjzm.product.service;

import com.sjzm.common.PageResult;
import com.sjzm.product.dto.MethodCardProductResponse;
import com.sjzm.product.dto.MethodCardQueryRequest;

public interface MethodCardService {

    PageResult<MethodCardProductResponse> queryM01Products(MethodCardQueryRequest request);

    PageResult<MethodCardProductResponse> queryM02Products(MethodCardQueryRequest request);
}
