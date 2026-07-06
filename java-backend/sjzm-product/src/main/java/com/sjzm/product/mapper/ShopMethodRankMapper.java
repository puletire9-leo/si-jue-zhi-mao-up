package com.sjzm.product.mapper;

import com.sjzm.product.modules.shoprating.dto.ShopMethodRankItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;

/**
 * 店铺方法卡命中数排名 + m01_active 每日摘标（shoprating 模块）。
 *
 * <p>放 com.sjzm.product.mapper（@MapperScan 只扫这个包）。
 * 与相似度评级（ShopRatingServiceImpl）并存，各自独立。
 */
@Mapper
public interface ShopMethodRankMapper {

    /**
     * 按 M01 命中数给店铺排名（走 clean 表，已去变体污染，只读 m01_active=1）。
     * @param marketplace 站点
     * @param minCount    命中数下限（HAVING 过滤，默认 1）
     * @param limit       返回条数上限
     */
    List<ShopMethodRankItem> selectM01ShopRanking(@Param("marketplace") String marketplace,
                                                  @Param("minCount") int minCount,
                                                  @Param("limit") int limit);

    int backfillM01Active(@Param("marketplace") String marketplace,
                          @Param("priceMin") BigDecimal priceMin,
                          @Param("priceMax") BigDecimal priceMax,
                          @Param("weightMax") BigDecimal weightMax,
                          @Param("listingDaysMax") int listingDaysMax,
                          @Param("sales30") int sales30,
                          @Param("sales60") int sales60,
                          @Param("sales90") int sales90,
                          @Param("bsrMax") Integer bsrMax);

    int syncCleanM01Active(@Param("marketplace") String marketplace);

    /**
     * 每日摘标：把上架已满 listingDaysMax 天的过期品 m01_active 置 0。
     * 增量小操作，只动 m01_active=1 且已超期的行。
     * @return 受影响行数
     */
    int expireM01Active(@Param("marketplace") String marketplace,
                        @Param("listingDaysMax") int listingDaysMax);

    /** 清洗表同步摘标（代表行）。 */
    int expireM01ActiveClean(@Param("marketplace") String marketplace,
                             @Param("listingDaysMax") int listingDaysMax);
}
