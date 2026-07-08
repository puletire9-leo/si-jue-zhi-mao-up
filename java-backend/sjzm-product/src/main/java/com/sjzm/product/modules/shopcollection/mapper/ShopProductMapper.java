package com.sjzm.product.modules.shopcollection.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.shopcollection.entity.ShopProduct;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ShopProductMapper extends BaseMapper<ShopProduct> {

    @Select("SELECT MAX(batch_date) FROM shop_products WHERE marketplace = #{marketplace}")
    String selectMaxBatchDate(String marketplace);

    /** 该店铺是否有成功快照（任意 batch_date 有商品入库）。精品池入池前置校验用。 */
    @Select("SELECT COUNT(1) FROM shop_products WHERE marketplace = #{marketplace} AND seller_name = #{sellerName} LIMIT 1")
    int countByMarketplaceAndSeller(@org.apache.ibatis.annotations.Param("marketplace") String marketplace,
                                    @org.apache.ibatis.annotations.Param("sellerName") String sellerName);

    /**
     * 插入或更新（唯一键 marketplace + seller_name + asin + batch_date）。
     * first_seen_at 仅首次插入写入并保留（VALUES 不覆盖），last_seen_at 每次刷新。
     */
    @Insert({"<script>",
        "INSERT INTO shop_products (marketplace, asin, `month`, title, brand, brand_url, image_url, parent_asin, sku, ",
        "node_id, node_id_path, node_label_path, symbol, units, sales_tier, units_gr, amz_unit, amz_sales, amz_unit_date, ",
        "revenue, bsr_id, bsr, bsr_cr, bsr_cv, ratings, rating, ratings_rate, ratings_cv, rating_delta, ",
        "price, prime_price, profit, fba, delivery_price, seller_name, seller_id, seller_nation, sellers, ",
        "fulfillment, variations, weight, dimension, dimensions_type, pkg_dimensions, pkg_dimension_type, ",
        "pkg_weight, lqs, available_date, best_seller, amazon_choice, new_release, ebc, video, ",
        "filter_mode, filter_reasons, listing_days, weight_g, product_url, similar_url, source, ",
        "batch_date, batch_code, source_run_id, fetch_source, fetch_reason, watchlist_id, variation_mode, raw_json, ",
        "first_seen_at, last_seen_at, created_at, updated_at) VALUES (",
        "#{marketplace}, #{asin}, #{month}, #{title}, #{brand}, #{brandUrl}, #{imageUrl}, #{parentAsin}, #{sku}, ",
        "#{nodeId}, #{nodeIdPath}, #{nodeLabelPath}, #{symbol}, #{units}, #{salesTier}, #{unitsGr}, #{amzUnit}, #{amzSales}, #{amzUnitDate}, ",
        "#{revenue}, #{bsrId}, #{bsr}, #{bsrCr}, #{bsrCv}, #{ratings}, #{rating}, #{ratingsRate}, #{ratingsCv}, #{ratingDelta}, ",
        "#{price}, #{primePrice}, #{profit}, #{fba}, #{deliveryPrice}, #{sellerName}, #{sellerId}, #{sellerNation}, #{sellers}, ",
        "#{fulfillment}, #{variations}, #{weight}, #{dimension}, #{dimensionsType}, #{pkgDimensions}, #{pkgDimensionType}, ",
        "#{pkgWeight}, #{lqs}, #{availableDate}, #{bestSeller}, #{amazonChoice}, #{newRelease}, #{ebc}, #{video}, ",
        "#{filterMode}, #{filterReasons}, #{listingDays}, #{weightG}, #{productUrl}, #{similarUrl}, #{source}, ",
        "#{batchDate}, #{batchCode}, #{sourceRunId}, #{fetchSource}, #{fetchReason}, #{watchlistId}, #{variationMode}, #{rawJson}, ",
        "NOW(), NOW(), NOW(), NOW())",
        "ON DUPLICATE KEY UPDATE",
        "title=VALUES(title), brand=VALUES(brand), brand_url=VALUES(brand_url), image_url=VALUES(image_url),",
        "parent_asin=VALUES(parent_asin), sku=VALUES(sku),",
        "node_id=VALUES(node_id), node_id_path=VALUES(node_id_path), node_label_path=VALUES(node_label_path), symbol=VALUES(symbol),",
        "units=VALUES(units), sales_tier=VALUES(sales_tier), units_gr=VALUES(units_gr), amz_unit=VALUES(amz_unit), amz_sales=VALUES(amz_sales),",
        "revenue=VALUES(revenue), bsr_id=VALUES(bsr_id), bsr=VALUES(bsr), bsr_cr=VALUES(bsr_cr), bsr_cv=VALUES(bsr_cv),",
        "ratings=VALUES(ratings), rating=VALUES(rating), ratings_rate=VALUES(ratings_rate), ratings_cv=VALUES(ratings_cv), rating_delta=VALUES(rating_delta),",
        "price=VALUES(price), prime_price=VALUES(prime_price), profit=VALUES(profit), fba=VALUES(fba), delivery_price=VALUES(delivery_price),",
        "seller_id=VALUES(seller_id), seller_nation=VALUES(seller_nation), sellers=VALUES(sellers),",
        "fulfillment=VALUES(fulfillment), variations=VALUES(variations), weight=VALUES(weight), dimension=VALUES(dimension),",
        "dimensions_type=VALUES(dimensions_type), pkg_dimensions=VALUES(pkg_dimensions), pkg_dimension_type=VALUES(pkg_dimension_type),",
        "pkg_weight=VALUES(pkg_weight), lqs=VALUES(lqs), available_date=VALUES(available_date),",
        "best_seller=VALUES(best_seller), amazon_choice=VALUES(amazon_choice), new_release=VALUES(new_release),",
        "ebc=VALUES(ebc), video=VALUES(video), listing_days=VALUES(listing_days), weight_g=VALUES(weight_g),",
        "product_url=VALUES(product_url), similar_url=VALUES(similar_url), source=VALUES(source),",
        "batch_code=VALUES(batch_code), source_run_id=VALUES(source_run_id), fetch_source=VALUES(fetch_source), fetch_reason=VALUES(fetch_reason),",
        "watchlist_id=VALUES(watchlist_id), variation_mode=VALUES(variation_mode), raw_json=VALUES(raw_json),",
        "last_seen_at=NOW(), updated_at=NOW()",
        "</script>"})
    int upsert(ShopProduct entity);
}
