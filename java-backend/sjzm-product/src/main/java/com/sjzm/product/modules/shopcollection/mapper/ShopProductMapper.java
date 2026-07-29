package com.sjzm.product.modules.shopcollection.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.toolkit.Constants;
import com.sjzm.product.modules.shopcollection.entity.ShopProduct;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

@Mapper
public interface ShopProductMapper extends BaseMapper<ShopProduct> {

    @Select("SELECT MAX(batch_date) FROM shop_products WHERE marketplace = #{marketplace}")
    String selectMaxBatchDate(String marketplace);

    /**
     * 取「最新的正经批次日期」——店铺数 >= minShops 的最近 batch_date。
     * 业务语义：批次 = 一次往店铺池批量请求新店铺（几百上千家）；单店补抓（如「店铺请求」
     * 手动抓 1 家）虽写了当天 batch_date，但不是可选品的批次，会污染 MAX(batch_date)。
     * 店铺选品无搜索浏览的兜底默认批次走此方法，避免打开只显示单店测试数据。
     */
    @Select("SELECT batch_date FROM shop_products " +
            "WHERE marketplace = #{marketplace} AND batch_date REGEXP '^[0-9]{8}$' " +
            "GROUP BY batch_date HAVING COUNT(DISTINCT seller_name) >= #{minShops} " +
            "ORDER BY batch_date DESC LIMIT 1")
    String selectLatestMeaningfulBatchDate(@Param("marketplace") String marketplace,
                                           @Param("minShops") int minShops);

    /** 与统一店铺商品分页共用筛选 wrapper 的类目聚合。
     *  只聚合「顶级大类」（node_label_path 第一段，如 Toys & Games），全站仅几十个；
     *  过去 GROUP BY 完整路径会产生成百上千组，6万+数据下聚合慢 + 前端下拉 option 爆炸卡死。
     *  与筛选口径（buildSelectionProductFilter 的 SUBSTRING_INDEX 第一段匹配）保持一致。 */
    @Select("SELECT TRIM(SUBSTRING_INDEX(node_label_path, ':', 1)) AS category, COUNT(1) AS count " +
            "FROM shop_products ${ew.customSqlSegment} " +
            "AND node_label_path IS NOT NULL AND TRIM(node_label_path) != '' " +
            "AND LOWER(TRIM(node_label_path)) != 'null' " +
            "GROUP BY TRIM(SUBSTRING_INDEX(node_label_path, ':', 1)) ORDER BY count DESC, category ASC")
    List<Map<String, Object>> selectSelectionCategories(
            @Param(Constants.WRAPPER) Wrapper<ShopProduct> wrapper);

    /**
     * 统一选品按已入库的「单天导入日期」展示店铺抓取批次。
     * value/week 统一返回 yyyy-MM-dd（由 batch_date yyyyMMdd 格式化），与全站批次模型 DayBatchOption 对齐。
     * 选中后过滤见 ShopCollectionService.applySelectionBatchFilter（已兼容日期值）。
     */
    @Select("SELECT DATE_FORMAT(STR_TO_DATE(batch_date, '%Y%m%d'), '%Y-%m-%d') AS week, " +
            "COUNT(1) AS count, " +
            "DATE_FORMAT(STR_TO_DATE(batch_date, '%Y%m%d'), '%Y-%m-%d') AS startDate, " +
            "DATE_FORMAT(STR_TO_DATE(batch_date, '%Y%m%d'), '%Y-%m-%d') AS endDate " +
            "FROM shop_products " +
            "WHERE marketplace = #{marketplace} AND batch_date REGEXP '^[0-9]{8}$' " +
            "GROUP BY batch_date ORDER BY batch_date DESC")
    List<Map<String, Object>> selectSelectionWeeks(@Param("marketplace") String marketplace);

    /**
     * 品线树跟随批次(店铺源)：按 batch_date IN (compactDates) 分组 bsr_id/node_id 统计。
     * 输出列与 CompetitorProductMapper.countByNodeIdByBatch 完全对齐(bsrId/nodeId/nodeFullPath/nodeName/productCount)，
     * 供 ProductLineTreeService.buildTree 复用。batchDates 为空时不加日期过滤(全量)。
     * 注意：店铺表批次列是 batch_date(yyyyMMdd)，传入需先经 DayBatchSupport.normalizeToCompactDate 归一。
     */
    @Select("<script>" +
            "SELECT bsr_id AS bsrId, node_id AS nodeId," +
            " MAX(node_label_path) AS nodeFullPath," +
            " SUBSTRING_INDEX(MAX(node_label_path), ':', -1) AS nodeName," +
            " COUNT(*) AS productCount" +
            " FROM shop_products" +
            " WHERE marketplace = #{marketplace}" +
            " AND bsr_id IS NOT NULL AND bsr_id != ''" +
            "<if test='batchDates != null and batchDates.size() > 0'>" +
            " AND batch_date IN " +
            "<foreach collection='batchDates' item='d' open='(' separator=',' close=')'>#{d}</foreach>" +
            "</if>" +
            " GROUP BY bsr_id, node_id" +
            " ORDER BY bsr_id, productCount DESC" +
            "</script>")
    List<Map<String, Object>> countByNodeIdByBatch(@Param("marketplace") String marketplace,
                                                   @Param("batchDates") List<String> batchDates);

    /**
     * 品线树（店铺源 + M01 方法卡）：SQL 与 ShopCollectionService.applyM01SelectionRule 逐项同口径，
     * 保证「树数量 = M01 列表可见数量」。分档采用互斥区间(≤30 / >30&≤60 / >60&&&lt;max)，与 wrapper 完全一致。
     * bsrMax 为 null(US) 时不加 BSR OR 分支。batchDates 为 yyyyMMdd 列表，为空时不加日期过滤。
     */
    @Select("<script>" +
            "SELECT bsr_id AS bsrId, node_id AS nodeId," +
            " MAX(node_label_path) AS nodeFullPath," +
            " SUBSTRING_INDEX(MAX(node_label_path), ':', -1) AS nodeName," +
            " COUNT(*) AS productCount" +
            " FROM shop_products sp" +
            " WHERE sp.marketplace = #{marketplace}" +
            " AND sp.bsr_id IS NOT NULL AND sp.bsr_id != ''" +
            "<if test='batchDates != null and batchDates.size() > 0'>" +
            " AND sp.batch_date IN " +
            "<foreach collection='batchDates' item='d' open='(' separator=',' close=')'>#{d}</foreach>" +
            "</if>" +
            " AND sp.price &gt;= #{priceMin} AND sp.price &lt;= #{priceMax}" +
            " AND sp.weight_g IS NOT NULL AND sp.weight_g &lt; #{weightMax}" +
            " AND sp.listing_days IS NOT NULL AND sp.listing_days &lt; #{listingDaysMax}" +
            " AND (sp.units IS NULL OR sp.units &lt;= #{salesMax})" +
            " AND (" +
            "  (sp.listing_days &lt;= 30 AND sp.units &gt;= #{sales30})" +
            "  OR (sp.listing_days &gt; 30 AND sp.listing_days &lt;= 60 AND sp.units &gt;= #{sales60})" +
            "  OR (sp.listing_days &gt; 60 AND sp.listing_days &lt; #{listingDaysMax} AND sp.units &gt;= #{sales90})" +
            "  <if test='bsrMax != null'>OR (sp.bsr &gt; 0 AND sp.bsr &lt; #{bsrMax})</if>" +
            " )" +
            " GROUP BY sp.bsr_id, sp.node_id" +
            " ORDER BY sp.bsr_id, productCount DESC" +
            "</script>")
    List<Map<String, Object>> countByNodeIdForM01ByBatch(
            @Param("marketplace") String marketplace,
            @Param("batchDates") List<String> batchDates,
            @Param("priceMin") java.math.BigDecimal priceMin,
            @Param("priceMax") java.math.BigDecimal priceMax,
            @Param("weightMax") java.math.BigDecimal weightMax,
            @Param("listingDaysMax") Integer listingDaysMax,
            @Param("sales30") Integer sales30,
            @Param("sales60") Integer sales60,
            @Param("sales90") Integer sales90,
            @Param("salesMax") Integer salesMax,
            @Param("bsrMax") Integer bsrMax);

    /**
     * 品线树（店铺源 + M03 方法卡）：SQL 与 ShopCollectionService.applyM03SelectionRule 逐项同口径。
     * 三条硬门槛：fulfillment=FBM(大小写不敏感)、listing_days &lt; listingDaysMax、units &gt;= sales90。
     * 不看价格/重量/BSR。batchDates 为 yyyyMMdd 列表，为空时不加日期过滤。
     */
    @Select("<script>" +
            "SELECT bsr_id AS bsrId, node_id AS nodeId," +
            " MAX(node_label_path) AS nodeFullPath," +
            " SUBSTRING_INDEX(MAX(node_label_path), ':', -1) AS nodeName," +
            " COUNT(*) AS productCount" +
            " FROM shop_products sp" +
            " WHERE sp.marketplace = #{marketplace}" +
            " AND sp.bsr_id IS NOT NULL AND sp.bsr_id != ''" +
            "<if test='batchDates != null and batchDates.size() > 0'>" +
            " AND sp.batch_date IN " +
            "<foreach collection='batchDates' item='d' open='(' separator=',' close=')'>#{d}</foreach>" +
            "</if>" +
            " AND UPPER(sp.fulfillment) = 'FBM'" +
            " AND sp.listing_days IS NOT NULL AND sp.listing_days &lt; #{listingDaysMax}" +
            " AND sp.units IS NOT NULL AND sp.units &gt;= #{sales90}" +
            " GROUP BY sp.bsr_id, sp.node_id" +
            " ORDER BY sp.bsr_id, productCount DESC" +
            "</script>")
    List<Map<String, Object>> countByNodeIdForM03ByBatch(
            @Param("marketplace") String marketplace,
            @Param("batchDates") List<String> batchDates,
            @Param("listingDaysMax") Integer listingDaysMax,
            @Param("sales90") Integer sales90);

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
