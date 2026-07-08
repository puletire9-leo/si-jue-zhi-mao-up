package com.sjzm.product.modules.analysisbaseline.shopprofile.mapper;

import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileCategory;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileProduct;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 店铺画像 SQL 全部走 ShopProfileMapper.xml（CTE 在 rankedFromDengZong 片段统一维护）。
 * sales_tier 阈值 / 父体去重 / 末级类目拆分 的唯一事实来源在 XML 的 <sql id="rankedFromDengZong"/>。
 */
@Mapper
public interface ShopProfileMapper {

    List<ShopProfileSummary> selectSummary(
            @Param("marketplace") String marketplace,
            @Param("batchDate") String batchDate,
            @Param("sellerNameKeyword") String sellerNameKeyword,
            @Param("minProductCount") Integer minProductCount,
            @Param("limit") Integer limit);

    long countProducts(
            @Param("marketplace") String marketplace,
            @Param("sellerName") String sellerName,
            @Param("batchDate") String batchDate,
            @Param("salesTier") String salesTier,
            @Param("category") String category);

    List<ShopProfileProduct> selectProducts(
            @Param("marketplace") String marketplace,
            @Param("sellerName") String sellerName,
            @Param("batchDate") String batchDate,
            @Param("salesTier") String salesTier,
            @Param("category") String category,
            @Param("offset") int offset,
            @Param("size") int size);

    List<ShopProfileCategory> selectCategories(
            @Param("marketplace") String marketplace,
            @Param("sellerName") String sellerName,
            @Param("batchDate") String batchDate,
            @Param("salesTier") String salesTier);

    int deleteSnapshots(@Param("marketplace") String marketplace, @Param("batchDate") String batchDate);

    int deleteCategories(@Param("marketplace") String marketplace, @Param("batchDate") String batchDate);

    int insertSnapshotsFromDengZong(@Param("marketplace") String marketplace, @Param("batchDate") String batchDate);

    int insertCategoriesFromDengZong(@Param("marketplace") String marketplace, @Param("batchDate") String batchDate);

    // ========================================================================
    // 店铺全集数据源（shop_products，固定 variation=Y）。逻辑同 deng_zong 路径，
    // 独立片段 rankedFromShopProducts，服务观察池抓来的店铺画像/单店详情。
    // ========================================================================

    List<ShopProfileSummary> selectSummaryFromShopProducts(
            @Param("marketplace") String marketplace,
            @Param("batchDate") String batchDate,
            @Param("sourceRunId") String sourceRunId,
            @Param("sellerNameKeyword") String sellerNameKeyword,
            @Param("minProductCount") Integer minProductCount,
            @Param("limit") Integer limit);

    long countProductsFromShopProducts(
            @Param("marketplace") String marketplace,
            @Param("sellerName") String sellerName,
            @Param("batchDate") String batchDate,
            @Param("sourceRunId") String sourceRunId,
            @Param("salesTier") String salesTier,
            @Param("category") String category);

    List<ShopProfileProduct> selectProductsFromShopProducts(
            @Param("marketplace") String marketplace,
            @Param("sellerName") String sellerName,
            @Param("batchDate") String batchDate,
            @Param("sourceRunId") String sourceRunId,
            @Param("salesTier") String salesTier,
            @Param("category") String category,
            @Param("offset") int offset,
            @Param("size") int size);

    List<ShopProfileCategory> selectCategoriesFromShopProducts(
            @Param("marketplace") String marketplace,
            @Param("sellerName") String sellerName,
            @Param("batchDate") String batchDate,
            @Param("sourceRunId") String sourceRunId,
            @Param("salesTier") String salesTier);

    long countCompareProducts(
            @Param("marketplace") String marketplace,
            @Param("sellerName") String sellerName,
            @Param("baselineRunId") String baselineRunId,
            @Param("compareRunId") String compareRunId,
            @Param("changeType") String changeType);

    List<ShopProfileProduct> selectCompareProducts(
            @Param("marketplace") String marketplace,
            @Param("sellerName") String sellerName,
            @Param("baselineRunId") String baselineRunId,
            @Param("compareRunId") String compareRunId,
            @Param("changeType") String changeType,
            @Param("offset") int offset,
            @Param("size") int size);
}
