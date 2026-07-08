package com.sjzm.product.modules.shopcollection.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.shopcollection.entity.ShopWatchlist;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ShopWatchlistMapper extends BaseMapper<ShopWatchlist> {

    /**
     * 插入或更新（唯一键 marketplace + seller_name + source_type + source_code）。
     * 同一店铺因同一方法卡反复进池只刷新命中数/原因，不堆积。
     * status 不覆盖：人工改成 IGNORED/CONFIRMED 后，再次同步不回退为 WATCHING。
     */
    @Insert({"<script>",
        "INSERT INTO shop_watchlist (marketplace, seller_name, seller_id, source_type, source_code, ",
        "reason, hit_count, top_category, status, last_fetch_run_id, created_at, updated_at) VALUES (",
        "#{marketplace}, #{sellerName}, #{sellerId}, #{sourceType}, #{sourceCode}, ",
        "#{reason}, #{hitCount}, #{topCategory}, #{status}, #{lastFetchRunId}, NOW(), NOW())",
        "ON DUPLICATE KEY UPDATE",
        "seller_id=VALUES(seller_id), reason=VALUES(reason), hit_count=VALUES(hit_count),",
        "top_category=VALUES(top_category), updated_at=NOW()",
        "</script>"})
    int upsert(ShopWatchlist entity);
}
