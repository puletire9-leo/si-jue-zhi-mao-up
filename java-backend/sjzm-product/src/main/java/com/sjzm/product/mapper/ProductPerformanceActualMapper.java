package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.ProductPerformanceActual;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ProductPerformanceActualMapper extends BaseMapper<ProductPerformanceActual> {

    @Insert({
            "<script>",
            "INSERT INTO product_performance_actual (",
            "id, asin, parent_asin, sku, marketplace, price, sales_volume,",
            "category_rank_main, category_main, category_rank_sub, category_sub,",
            "acoas, natural_clicks, ctr, ad_cvr, natural_orders, fba_available, refund_rate,",
            "product_name, title, archetype, element, carrier, listing_tags,",
            "is_eliminated, is_green, bsr_id, source_batch, imported_at",
            ") VALUES (",
            "#{id}, #{asin}, #{parentAsin}, #{sku}, #{marketplace}, #{price}, #{salesVolume},",
            "#{categoryRankMain}, #{categoryMain}, #{categoryRankSub}, #{categorySub},",
            "#{acoas}, #{naturalClicks}, #{ctr}, #{adCvr}, #{naturalOrders}, #{fbaAvailable}, #{refundRate},",
            "#{productName}, #{title}, #{archetype}, #{element}, #{carrier}, #{listingTags},",
            "#{isEliminated}, #{isGreen}, #{bsrId}, #{sourceBatch}, #{importedAt}",
            ") ON DUPLICATE KEY UPDATE",
            "parent_asin = VALUES(parent_asin),",
            "sku = VALUES(sku),",
            "price = VALUES(price),",
            "sales_volume = VALUES(sales_volume),",
            "category_rank_main = VALUES(category_rank_main),",
            "category_main = VALUES(category_main),",
            "category_rank_sub = VALUES(category_rank_sub),",
            "category_sub = VALUES(category_sub),",
            "acoas = VALUES(acoas),",
            "natural_clicks = VALUES(natural_clicks),",
            "ctr = VALUES(ctr),",
            "ad_cvr = VALUES(ad_cvr),",
            "natural_orders = VALUES(natural_orders),",
            "fba_available = VALUES(fba_available),",
            "refund_rate = VALUES(refund_rate),",
            "product_name = VALUES(product_name),",
            "title = VALUES(title),",
            "archetype = VALUES(archetype),",
            "element = VALUES(element),",
            "carrier = VALUES(carrier),",
            "listing_tags = VALUES(listing_tags),",
            "is_eliminated = VALUES(is_eliminated),",
            "is_green = VALUES(is_green),",
            "bsr_id = VALUES(bsr_id),",
            "source_batch = VALUES(source_batch),",
            "imported_at = VALUES(imported_at)",
            "</script>"
    })
    int upsert(ProductPerformanceActual entity);
}
