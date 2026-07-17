package com.sjzm.product.modules.shopcollection.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.shopcollection.dto.ShopScreeningQuery;
import com.sjzm.product.modules.shopcollection.dto.ShopScreeningRow;
import com.sjzm.product.modules.shopcollection.entity.ShopProduct;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Mapper
public interface ShopScreeningMapper extends BaseMapper<ShopProduct> {

    List<ShopScreeningRow> screen(
            @Param("q") ShopScreeningQuery query,
            @Param("priceMin") BigDecimal m01PriceMin,
            @Param("priceMax") BigDecimal m01PriceMax,
            @Param("weightMax") BigDecimal m01WeightMax,
            @Param("listingDaysMax") Integer m01ListingDaysMax,
            @Param("sales30") Integer sales30,
            @Param("sales60") Integer sales60,
            @Param("sales90") Integer sales90,
            @Param("bsrMax") Integer m01BsrMax);

    List<Map<String, Object>> selectBatchOptions(@Param("marketplace") String marketplace);
}
