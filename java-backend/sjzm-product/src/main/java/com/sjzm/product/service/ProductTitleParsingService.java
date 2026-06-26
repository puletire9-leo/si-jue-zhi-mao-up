package com.sjzm.product.service;

import com.sjzm.product.dto.ProductTitleParseResult;

import java.util.List;

public interface ProductTitleParsingService {

    ProductTitleParseResult parse(String title);

    List<String> listSupportedCarriers();
}
