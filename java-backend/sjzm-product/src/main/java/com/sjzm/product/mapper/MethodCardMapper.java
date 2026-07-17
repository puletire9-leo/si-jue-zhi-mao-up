package com.sjzm.product.mapper;

import com.sjzm.product.dto.MethodCardProductResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Mapper
public interface MethodCardMapper {

    String selectLatestM01EffectiveWeek(@Param("marketplace") String marketplace);

    long countM01Products(@Param("marketplace") String marketplace,
                          @Param("month") String month,
                          @Param("effectiveWeekTags") List<String> effectiveWeekTags,
                          @Param("bsrId") String bsrId,
                          @Param("nodeId") Long nodeId,
                          @Param("categories") List<String> categories,
                          @Param("priceMin") BigDecimal priceMin,
                          @Param("priceMax") BigDecimal priceMax,
                          @Param("weightMax") BigDecimal weightMax,
                          @Param("listingDaysMax") Integer listingDaysMax,
                          @Param("sales30") Integer sales30,
                          @Param("sales60") Integer sales60,
                          @Param("sales90") Integer sales90,
                          @Param("salesMax") Integer salesMax,
                          @Param("bsrMax") Integer bsrMax);

    List<MethodCardProductResponse> selectM01Products(@Param("marketplace") String marketplace,
                                                      @Param("month") String month,
                                                      @Param("effectiveWeekTags") List<String> effectiveWeekTags,
                                                      @Param("bsrId") String bsrId,
                                                      @Param("nodeId") Long nodeId,
                                                      @Param("categories") List<String> categories,
                                                      @Param("priceMin") BigDecimal priceMin,
                                                      @Param("priceMax") BigDecimal priceMax,
                                                      @Param("weightMax") BigDecimal weightMax,
                                                      @Param("listingDaysMax") Integer listingDaysMax,
                                                      @Param("sales30") Integer sales30,
                                                      @Param("sales60") Integer sales60,
                                                      @Param("sales90") Integer sales90,
                                                      @Param("salesMax") Integer salesMax,
                                                      @Param("bsrMax") Integer bsrMax,
                                                      @Param("offset") Integer offset,
                                                      @Param("size") Integer size);

    List<Map<String, Object>> selectM01Categories(@Param("marketplace") String marketplace,
                                                   @Param("month") String month,
                                                   @Param("effectiveWeekTags") List<String> effectiveWeekTags,
                                                   @Param("bsrId") String bsrId,
                                                   @Param("nodeId") Long nodeId,
                                                   @Param("categories") List<String> categories,
                                                   @Param("priceMin") BigDecimal priceMin,
                                                   @Param("priceMax") BigDecimal priceMax,
                                                   @Param("weightMax") BigDecimal weightMax,
                                                   @Param("listingDaysMax") Integer listingDaysMax,
                                                   @Param("sales30") Integer sales30,
                                                   @Param("sales60") Integer sales60,
                                                   @Param("sales90") Integer sales90,
                                                   @Param("salesMax") Integer salesMax,
                                                   @Param("bsrMax") Integer bsrMax);

    String selectLatestM02BatchDate(@Param("marketplace") String marketplace);

    long countM02Products(@Param("marketplace") String marketplace,
                          @Param("month") String month,
                          @Param("batchDate") String batchDate,
                          @Param("bsrId") String bsrId,
                          @Param("nodeId") Long nodeId);

    List<MethodCardProductResponse> selectM02Products(@Param("marketplace") String marketplace,
                                                      @Param("month") String month,
                                                      @Param("batchDate") String batchDate,
                                                      @Param("bsrId") String bsrId,
                                                      @Param("nodeId") Long nodeId,
                                                      @Param("offset") Integer offset,
                                                      @Param("size") Integer size);

    // ─── M03 FBM 自发货简单道 ─────────────────────────────────────
    // 与 M01/M02 严格独立: 不共用参数, 不共用 SQL, 不共用 WHERE 片段
    // 判定极简: fulfillment='FBM' + 上架 < listingDaysMax + 90 天销量 >= sales90

    String selectLatestM03EffectiveWeek(@Param("marketplace") String marketplace);

    long countM03Products(@Param("marketplace") String marketplace,
                          @Param("month") String month,
                          @Param("effectiveWeekTag") String effectiveWeekTag,
                          @Param("listingDaysMax") Integer listingDaysMax,
                          @Param("sales90") Integer sales90);

    List<MethodCardProductResponse> selectM03Products(@Param("marketplace") String marketplace,
                                                      @Param("month") String month,
                                                      @Param("effectiveWeekTag") String effectiveWeekTag,
                                                      @Param("listingDaysMax") Integer listingDaysMax,
                                                      @Param("sales90") Integer sales90,
                                                      @Param("offset") Integer offset,
                                                      @Param("size") Integer size);
}
