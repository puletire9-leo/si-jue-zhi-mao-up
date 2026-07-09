package com.sjzm.product.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

/**
 * Lingxing normalized SKU data layer mapper.
 *
 * Source-of-truth during migration:
 * - lingxing_product_performance: real fetched product performance rows + raw_json
 * - sku_pool: legacy target pool kept only as compatibility data
 */
@Mapper
public interface LingxingSkuDataLayerMapper {

    @Insert("""
            INSERT INTO lingxing_data_sync_run (
              run_id, run_type, marketplace, start_date, end_date, snapshot_week, `year_month`,
              status, request_json, started_at
            ) VALUES (
              #{runId}, #{runType}, #{marketplace}, #{startDate}, #{endDate}, #{snapshotWeek}, #{yearMonth},
              'RUNNING', #{requestJson}, NOW()
            )
            ON DUPLICATE KEY UPDATE
              run_type = VALUES(run_type),
              marketplace = VALUES(marketplace),
              start_date = VALUES(start_date),
              end_date = VALUES(end_date),
              snapshot_week = VALUES(snapshot_week),
              `year_month` = VALUES(`year_month`),
              status = 'RUNNING',
              request_json = VALUES(request_json),
              started_at = NOW(),
              finished_at = NULL,
              error_message = NULL,
              updated_at = NOW()
            """)
    int beginRun(@Param("runId") String runId,
                 @Param("runType") String runType,
                 @Param("marketplace") String marketplace,
                 @Param("startDate") String startDate,
                 @Param("endDate") String endDate,
                 @Param("snapshotWeek") String snapshotWeek,
                 @Param("yearMonth") String yearMonth,
                 @Param("requestJson") String requestJson);

    @Update("""
            UPDATE lingxing_data_sync_run
            SET status = #{status},
                upserted_count = #{upsertedCount},
                error_message = #{errorMessage},
                finished_at = NOW(),
                updated_at = NOW()
            WHERE run_id = #{runId}
            """)
    int finishRun(@Param("runId") String runId,
                  @Param("status") String status,
                  @Param("upsertedCount") int upsertedCount,
                  @Param("errorMessage") String errorMessage);

    @Insert("""
            INSERT INTO lingxing_sku_store_snapshot (
              biz_key, snapshot_week, snapshot_date, marketplace, mid, sid, store_name, country,
              sku, seller_sku, asin, parent_asin, product_name, local_name, price,
              listing_status, is_delete, tag_ids, tags, pic_url, source_run_id, raw_json, synced_at
            )
            SELECT
              SHA2(CONCAT_WS('|', #{snapshotWeek}, pl.mid, pl.sid, pl.local_sku), 256) AS biz_key,
              #{snapshotWeek} AS snapshot_week,
              #{snapshotDate} AS snapshot_date,
              CASE CAST(pl.mid AS UNSIGNED) WHEN 4 THEN 'UK' WHEN 5 THEN 'DE' END AS marketplace,
              CAST(pl.mid AS UNSIGNED) AS mid,
              CAST(pl.sid AS UNSIGNED) AS sid,
              MAX(pl.seller_name) AS store_name,
              MAX(pl.country) AS country,
              pl.local_sku AS sku,
              MAX(pl.seller_sku) AS seller_sku,
              MAX(a.asin) AS asin,
              MAX(pa.parent_asin) AS parent_asin,
              COALESCE(MAX(p.item_name), MAX(JSON_UNQUOTE(JSON_EXTRACT(p.raw_json, '$.item_name')))) AS product_name,
              MAX(pl.local_name) AS local_name,
              MAX(CAST(NULLIF(pl.price, '') AS DECIMAL(18,4))) AS price,
              MAX(CAST(NULLIF(pl.status, '') AS SIGNED)) AS listing_status,
              MAX(CAST(NULLIF(pl.is_delete, '') AS SIGNED)) AS is_delete,
              GROUP_CONCAT(DISTINCT jt.global_tag_id ORDER BY jt.global_tag_id SEPARATOR ',') AS tag_ids,
              GROUP_CONCAT(DISTINCT jt.tag_name ORDER BY jt.tag_name SEPARATOR ',') AS tags,
              COALESCE(MAX(pl.product_pic_url), MAX(pl.small_image_url)) AS pic_url,
              #{sourceRunId} AS source_run_id,
              MAX(CAST(p.raw_json AS CHAR)) AS raw_json,
              NOW() AS synced_at
            FROM lingxing_product_performance p
            JOIN JSON_TABLE(
              p.raw_json, '$.price_list[*]'
              COLUMNS (
                mid VARCHAR(16) PATH '$.mid',
                sid VARCHAR(32) PATH '$.sid',
                local_sku VARCHAR(128) COLLATE utf8mb4_unicode_ci PATH '$.local_sku',
                local_name VARCHAR(512) COLLATE utf8mb4_unicode_ci PATH '$.local_name',
                seller_sku VARCHAR(255) COLLATE utf8mb4_unicode_ci PATH '$.seller_sku',
                seller_name VARCHAR(255) COLLATE utf8mb4_unicode_ci PATH '$.seller_name',
                country VARCHAR(32) COLLATE utf8mb4_unicode_ci PATH '$.country',
                price VARCHAR(64) PATH '$.price',
                status VARCHAR(32) PATH '$.status',
                is_delete VARCHAR(32) PATH '$.is_delete',
                product_pic_url VARCHAR(1000) COLLATE utf8mb4_unicode_ci PATH '$.product_pic_url',
                small_image_url VARCHAR(1000) COLLATE utf8mb4_unicode_ci PATH '$.small_image_url'
              )
            ) pl
            LEFT JOIN JSON_TABLE(
              p.raw_json, '$.tag_set[*]'
              COLUMNS (
                global_tag_id VARCHAR(64) PATH '$.global_tag_id',
                tag_name VARCHAR(255) COLLATE utf8mb4_unicode_ci PATH '$.tag_name'
              )
            ) jt ON TRUE
            LEFT JOIN JSON_TABLE(
              p.raw_json, '$.asins[*]'
              COLUMNS (
                sid VARCHAR(32) PATH '$.sid',
                asin VARCHAR(32) PATH '$.asin'
              )
            ) a ON a.sid = pl.sid
            LEFT JOIN JSON_TABLE(
              p.raw_json, '$.parent_asins[*]'
              COLUMNS (
                sid VARCHAR(32) PATH '$.sid',
                parent_asin VARCHAR(32) PATH '$.parent_asin'
              )
            ) pa ON pa.sid = pl.sid
            WHERE p.summary_field = 'sku'
              AND pl.mid IN ('4', '5')
              AND pl.sid IS NOT NULL AND pl.sid <> ''
              AND pl.local_sku IS NOT NULL AND pl.local_sku <> ''
            GROUP BY pl.mid, pl.sid, pl.local_sku
            ON DUPLICATE KEY UPDATE
              snapshot_date = VALUES(snapshot_date),
              marketplace = VALUES(marketplace),
              store_name = VALUES(store_name),
              country = VALUES(country),
              seller_sku = VALUES(seller_sku),
              asin = VALUES(asin),
              parent_asin = VALUES(parent_asin),
              product_name = VALUES(product_name),
              local_name = VALUES(local_name),
              price = VALUES(price),
              listing_status = VALUES(listing_status),
              is_delete = VALUES(is_delete),
              tag_ids = VALUES(tag_ids),
              tags = VALUES(tags),
              pic_url = VALUES(pic_url),
              source_run_id = VALUES(source_run_id),
              raw_json = VALUES(raw_json),
              synced_at = NOW(),
              updated_at = NOW()
            """)
    int upsertStoreSnapshotFromPerformance(@Param("snapshotWeek") String snapshotWeek,
                                           @Param("snapshotDate") String snapshotDate,
                                           @Param("sourceRunId") String sourceRunId);

    @Update("""
            UPDATE lingxing_target_sku_pool
            SET is_active = 0, updated_at = NOW()
            WHERE snapshot_week = #{snapshotWeek}
            """)
    int deactivateTargetPoolSnapshot(@Param("snapshotWeek") String snapshotWeek);

    @Insert({
            "<script>",
            "INSERT INTO lingxing_target_sku_pool (",
            "  biz_key, snapshot_week, marketplace, mid, sid, store_name, country,",
            "  sku, seller_sku, asin, parent_asin, product_name, tag_ids, tags,",
            "  is_target, filter_reason, first_seen_week, last_seen_week, is_active, source_run_id, raw_json",
            ")",
            "SELECT",
            "  SHA2(CONCAT_WS('|', s.snapshot_week, s.mid, s.sid, s.sku), 256) AS biz_key,",
            "  s.snapshot_week, s.marketplace, s.mid, s.sid, s.store_name, s.country,",
            "  s.sku, s.seller_sku, s.asin, s.parent_asin, s.product_name, s.tag_ids, s.tags,",
            "  1 AS is_target, 'LINGXING_TARGET_TAG_SET' AS filter_reason,",
            "  COALESCE(MIN(old_pool.first_seen_week), s.snapshot_week) AS first_seen_week,",
            "  s.snapshot_week AS last_seen_week,",
            "  1 AS is_active, #{sourceRunId} AS source_run_id, MAX(s.raw_json) AS raw_json",
            "FROM lingxing_sku_store_snapshot s",
            "LEFT JOIN lingxing_target_sku_pool old_pool",
            "  ON old_pool.sku = s.sku AND old_pool.mid = s.mid AND old_pool.sid = s.sid",
            "WHERE s.snapshot_week = #{snapshotWeek}",
            "  AND (",
            "    <foreach collection='tagIds' item='tagId' separator=' OR '>",
            "      FIND_IN_SET(#{tagId}, s.tag_ids) > 0",
            "    </foreach>",
            "  )",
            "GROUP BY s.snapshot_week, s.marketplace, s.mid, s.sid, s.store_name, s.country,",
            "         s.sku, s.seller_sku, s.asin, s.parent_asin, s.product_name, s.tag_ids, s.tags",
            "ON DUPLICATE KEY UPDATE",
            "  marketplace = VALUES(marketplace),",
            "  store_name = VALUES(store_name),",
            "  country = VALUES(country),",
            "  seller_sku = VALUES(seller_sku),",
            "  asin = VALUES(asin),",
            "  parent_asin = VALUES(parent_asin),",
            "  product_name = VALUES(product_name),",
            "  tag_ids = VALUES(tag_ids),",
            "  tags = VALUES(tags),",
            "  is_target = 1,",
            "  filter_reason = VALUES(filter_reason),",
            "  first_seen_week = COALESCE(lingxing_target_sku_pool.first_seen_week, VALUES(first_seen_week)),",
            "  last_seen_week = VALUES(last_seen_week),",
            "  is_active = 1,",
            "  source_run_id = VALUES(source_run_id),",
            "  raw_json = VALUES(raw_json),",
            "  updated_at = NOW()",
            "</script>"
    })
    int upsertTargetPoolFromSnapshot(@Param("snapshotWeek") String snapshotWeek,
                                     @Param("sourceRunId") String sourceRunId,
                                     @Param("tagIds") List<String> tagIds);

    @Insert("""
            INSERT INTO lingxing_sku_weekly_performance (
              biz_key, week_start, week_end, `year_month`, month_week_no, iso_year, iso_week,
              marketplace, mid, sid_scope, sid, store_name, sku, seller_sku, asin, parent_asin,
              product_name, local_name, tag_ids, tags, is_target_sku,
              volume, order_items, amount, net_amount, avg_volume, avg_custom_price,
              promotion_volume, promotion_amount, gross_profit, predict_gross_profit, gross_margin, roi,
              spend, tacos, acos, acoas, ad_order_quantity, ad_sales_amount,
              sessions_total, page_views_total, clicks, impressions, ctr, cvr,
              afn_fulfillable_quantity, fbm_quantity, available_days, fbm_available_days, stock_up_num,
              reserved_fc_transfers, reserved_customerorders, reserved_fc_processing,
              reviews_count, avg_star, return_count, return_rate, return_goods_count, return_goods_rate,
              currency_code, source_run_id, raw_json, synced_at
            )
            SELECT
              SHA2(CONCAT_WS('|', p.start_date, p.end_date, p.summary_field, COALESCE(p.sid_scope, ''), COALESCE(p.sku, p.summary_value), COALESCE(meta.seller_sku, ''), COALESCE(p.asin, ''), COALESCE(p.currency_code, '')), 256) AS biz_key,
              p.start_date AS week_start,
              p.end_date AS week_end,
              DATE_FORMAT(p.start_date, '%Y-%m') AS `year_month`,
              CASE
                WHEN DAY(p.start_date) <= 7 THEN 1
                WHEN DAY(p.start_date) <= 14 THEN 2
                WHEN DAY(p.start_date) <= 21 THEN 3
                ELSE 4
              END AS month_week_no,
              FLOOR(YEARWEEK(p.start_date, 3) / 100) AS iso_year,
              MOD(YEARWEEK(p.start_date, 3), 100) AS iso_week,
              meta.marketplace,
              meta.mid,
              p.sid_scope,
              meta.sid,
              meta.store_name,
              COALESCE(p.sku, p.summary_value) AS sku,
              meta.seller_sku,
              p.asin,
              p.parent_asin,
              COALESCE(p.item_name, JSON_UNQUOTE(JSON_EXTRACT(p.raw_json, '$.item_name'))) AS product_name,
              meta.local_name,
              meta.tag_ids,
              meta.tags,
              CASE WHEN tp.id IS NULL THEN 0 ELSE 1 END AS is_target_sku,
              p.volume,
              p.order_items,
              p.amount,
              JSON_VALUE(p.raw_json, '$.net_amount' RETURNING DECIMAL(18,4) NULL ON EMPTY NULL ON ERROR) AS net_amount,
              JSON_VALUE(p.raw_json, '$.avg_volume' RETURNING DECIMAL(18,4) NULL ON EMPTY NULL ON ERROR) AS avg_volume,
              JSON_VALUE(p.raw_json, '$.avg_custom_price' RETURNING DECIMAL(18,4) NULL ON EMPTY NULL ON ERROR) AS avg_custom_price,
              JSON_VALUE(p.raw_json, '$.promotion_volume' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS promotion_volume,
              JSON_VALUE(p.raw_json, '$.promotion_amount' RETURNING DECIMAL(18,4) NULL ON EMPTY NULL ON ERROR) AS promotion_amount,
              p.gross_profit,
              JSON_VALUE(p.raw_json, '$.predict_gross_profit' RETURNING DECIMAL(18,4) NULL ON EMPTY NULL ON ERROR) AS predict_gross_profit,
              p.gross_margin,
              JSON_VALUE(p.raw_json, '$.roi' RETURNING DECIMAL(18,6) NULL ON EMPTY NULL ON ERROR) AS roi,
              p.spend,
              p.tacos,
              JSON_VALUE(p.raw_json, '$.acos' RETURNING DECIMAL(18,6) NULL ON EMPTY NULL ON ERROR) AS acos,
              JSON_VALUE(p.raw_json, '$.acoas' RETURNING DECIMAL(18,6) NULL ON EMPTY NULL ON ERROR) AS acoas,
              JSON_VALUE(p.raw_json, '$.ad_order_quantity' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS ad_order_quantity,
              JSON_VALUE(p.raw_json, '$.ad_sales_amount' RETURNING DECIMAL(18,4) NULL ON EMPTY NULL ON ERROR) AS ad_sales_amount,
              p.sessions_total,
              JSON_VALUE(p.raw_json, '$.page_views_total' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS page_views_total,
              JSON_VALUE(p.raw_json, '$.clicks' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS clicks,
              JSON_VALUE(p.raw_json, '$.impressions' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS impressions,
              JSON_VALUE(p.raw_json, '$.ctr' RETURNING DECIMAL(18,6) NULL ON EMPTY NULL ON ERROR) AS ctr,
              JSON_VALUE(p.raw_json, '$.cvr' RETURNING DECIMAL(18,6) NULL ON EMPTY NULL ON ERROR) AS cvr,
              JSON_VALUE(p.raw_json, '$.afn_fulfillable_quantity' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS afn_fulfillable_quantity,
              JSON_VALUE(p.raw_json, '$.fbm_quantity' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS fbm_quantity,
              JSON_VALUE(p.raw_json, '$.available_days' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS available_days,
              JSON_VALUE(p.raw_json, '$.fbm_available_days' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS fbm_available_days,
              JSON_VALUE(p.raw_json, '$.stock_up_num' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS stock_up_num,
              JSON_VALUE(p.raw_json, '$.reserved_fc_transfers' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS reserved_fc_transfers,
              JSON_VALUE(p.raw_json, '$.reserved_customerorders' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS reserved_customerorders,
              JSON_VALUE(p.raw_json, '$.reserved_fc_processing' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS reserved_fc_processing,
              JSON_VALUE(p.raw_json, '$.reviews_count' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS reviews_count,
              JSON_VALUE(p.raw_json, '$.avg_star' RETURNING DECIMAL(18,4) NULL ON EMPTY NULL ON ERROR) AS avg_star,
              JSON_VALUE(p.raw_json, '$.return_count' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS return_count,
              JSON_VALUE(p.raw_json, '$.return_rate' RETURNING DECIMAL(18,6) NULL ON EMPTY NULL ON ERROR) AS return_rate,
              JSON_VALUE(p.raw_json, '$.return_goods_count' RETURNING SIGNED NULL ON EMPTY NULL ON ERROR) AS return_goods_count,
              JSON_VALUE(p.raw_json, '$.return_goods_rate' RETURNING DECIMAL(18,6) NULL ON EMPTY NULL ON ERROR) AS return_goods_rate,
              p.currency_code,
              #{sourceRunId} AS source_run_id,
              CAST(p.raw_json AS CHAR) AS raw_json,
              NOW() AS synced_at
            FROM lingxing_product_performance p
            JOIN (
              SELECT
                p2.id,
                MIN(CAST(pl.mid AS UNSIGNED)) AS mid,
                CASE MIN(CAST(pl.mid AS UNSIGNED)) WHEN 4 THEN 'UK' WHEN 5 THEN 'DE' END AS marketplace,
                CASE WHEN COUNT(DISTINCT pl.sid) = 1 THEN MAX(CAST(pl.sid AS UNSIGNED)) ELSE NULL END AS sid,
                MAX(pl.seller_name) AS store_name,
                MAX(pl.seller_sku) AS seller_sku,
                MAX(pl.local_name) AS local_name,
                GROUP_CONCAT(DISTINCT jt.global_tag_id ORDER BY jt.global_tag_id SEPARATOR ',') AS tag_ids,
                GROUP_CONCAT(DISTINCT jt.tag_name ORDER BY jt.tag_name SEPARATOR ',') AS tags
              FROM lingxing_product_performance p2
              JOIN JSON_TABLE(
                p2.raw_json, '$.price_list[*]'
                COLUMNS (
                  mid VARCHAR(16) PATH '$.mid',
                  sid VARCHAR(32) PATH '$.sid',
                  local_name VARCHAR(512) COLLATE utf8mb4_unicode_ci PATH '$.local_name',
                  seller_sku VARCHAR(255) COLLATE utf8mb4_unicode_ci PATH '$.seller_sku',
                  seller_name VARCHAR(255) COLLATE utf8mb4_unicode_ci PATH '$.seller_name'
                )
              ) pl
              LEFT JOIN JSON_TABLE(
                p2.raw_json, '$.tag_set[*]'
                COLUMNS (
                  global_tag_id VARCHAR(64) PATH '$.global_tag_id',
                  tag_name VARCHAR(255) COLLATE utf8mb4_unicode_ci PATH '$.tag_name'
                )
              ) jt ON TRUE
              WHERE p2.summary_field = 'msku'
                AND (#{startDate} IS NULL OR p2.start_date = #{startDate})
                AND (#{endDate} IS NULL OR p2.end_date = #{endDate})
                AND pl.mid IN ('4', '5')
              GROUP BY p2.id
            ) meta ON meta.id = p.id
            LEFT JOIN lingxing_target_sku_pool tp
              ON tp.snapshot_week = #{snapshotWeek}
             AND tp.marketplace = meta.marketplace
             AND tp.sid = meta.sid
             AND tp.sku = COALESCE(p.sku, p.summary_value)
             AND tp.is_active = 1
            WHERE p.summary_field = 'msku'
              AND (#{startDate} IS NULL OR p.start_date = #{startDate})
              AND (#{endDate} IS NULL OR p.end_date = #{endDate})
            ON DUPLICATE KEY UPDATE
              `year_month` = VALUES(`year_month`),
              month_week_no = VALUES(month_week_no),
              iso_year = VALUES(iso_year),
              iso_week = VALUES(iso_week),
              marketplace = VALUES(marketplace),
              mid = VALUES(mid),
              sid_scope = VALUES(sid_scope),
              sid = VALUES(sid),
              store_name = VALUES(store_name),
              seller_sku = VALUES(seller_sku),
              asin = VALUES(asin),
              parent_asin = VALUES(parent_asin),
              product_name = VALUES(product_name),
              local_name = VALUES(local_name),
              tag_ids = VALUES(tag_ids),
              tags = VALUES(tags),
              is_target_sku = VALUES(is_target_sku),
              volume = VALUES(volume),
              order_items = VALUES(order_items),
              amount = VALUES(amount),
              net_amount = VALUES(net_amount),
              avg_volume = VALUES(avg_volume),
              avg_custom_price = VALUES(avg_custom_price),
              promotion_volume = VALUES(promotion_volume),
              promotion_amount = VALUES(promotion_amount),
              gross_profit = VALUES(gross_profit),
              predict_gross_profit = VALUES(predict_gross_profit),
              gross_margin = VALUES(gross_margin),
              roi = VALUES(roi),
              spend = VALUES(spend),
              tacos = VALUES(tacos),
              acos = VALUES(acos),
              acoas = VALUES(acoas),
              ad_order_quantity = VALUES(ad_order_quantity),
              ad_sales_amount = VALUES(ad_sales_amount),
              sessions_total = VALUES(sessions_total),
              page_views_total = VALUES(page_views_total),
              clicks = VALUES(clicks),
              impressions = VALUES(impressions),
              ctr = VALUES(ctr),
              cvr = VALUES(cvr),
              afn_fulfillable_quantity = VALUES(afn_fulfillable_quantity),
              fbm_quantity = VALUES(fbm_quantity),
              available_days = VALUES(available_days),
              fbm_available_days = VALUES(fbm_available_days),
              stock_up_num = VALUES(stock_up_num),
              reserved_fc_transfers = VALUES(reserved_fc_transfers),
              reserved_customerorders = VALUES(reserved_customerorders),
              reserved_fc_processing = VALUES(reserved_fc_processing),
              reviews_count = VALUES(reviews_count),
              avg_star = VALUES(avg_star),
              return_count = VALUES(return_count),
              return_rate = VALUES(return_rate),
              return_goods_count = VALUES(return_goods_count),
              return_goods_rate = VALUES(return_goods_rate),
              currency_code = VALUES(currency_code),
              source_run_id = VALUES(source_run_id),
              raw_json = VALUES(raw_json),
              synced_at = NOW(),
              updated_at = NOW()
            """)
    int upsertWeeklyFromPerformance(@Param("startDate") String startDate,
                                    @Param("endDate") String endDate,
                                    @Param("snapshotWeek") String snapshotWeek,
                                    @Param("sourceRunId") String sourceRunId);

    @Insert("""
            INSERT INTO lingxing_sku_monthly_performance (
              biz_key, `year_month`, month_start, month_end, weeks_count, source_weeks,
              marketplace, mid, sid_scope, sid, store_name, sku, seller_sku, asin, parent_asin,
              product_name, local_name, tag_ids, tags, is_target_sku,
              volume, order_items, amount, net_amount, promotion_volume, promotion_amount,
              gross_profit, predict_gross_profit, spend, ad_order_quantity, ad_sales_amount,
              sessions_total, page_views_total, clicks, impressions, return_count, return_goods_count,
              avg_weekly_volume, avg_price, gross_margin, tacos, acos, ctr, cvr, return_rate, roi,
              currency_code, source_run_id, aggregate_json, generated_at
            )
            SELECT
              SHA2(CONCAT_WS('|', w.`year_month`, w.marketplace, COALESCE(w.sid_scope, ''), COALESCE(w.sid, ''), w.sku, COALESCE(w.currency_code, '')), 256) AS biz_key,
              w.`year_month`,
              MIN(w.week_start) AS month_start,
              MAX(w.week_end) AS month_end,
              COUNT(DISTINCT CONCAT(w.week_start, '~', w.week_end)) AS weeks_count,
              GROUP_CONCAT(DISTINCT CONCAT(w.week_start, '~', w.week_end) ORDER BY w.week_start SEPARATOR ',') AS source_weeks,
              w.marketplace,
              w.mid,
              w.sid_scope,
              w.sid,
              MAX(w.store_name) AS store_name,
              w.sku,
              MAX(w.seller_sku) AS seller_sku,
              MAX(w.asin) AS asin,
              MAX(w.parent_asin) AS parent_asin,
              MAX(w.product_name) AS product_name,
              MAX(w.local_name) AS local_name,
              MAX(w.tag_ids) AS tag_ids,
              MAX(w.tags) AS tags,
              MAX(w.is_target_sku) AS is_target_sku,
              SUM(COALESCE(w.volume, 0)) AS volume,
              SUM(COALESCE(w.order_items, 0)) AS order_items,
              SUM(COALESCE(w.amount, 0)) AS amount,
              SUM(COALESCE(w.net_amount, 0)) AS net_amount,
              SUM(COALESCE(w.promotion_volume, 0)) AS promotion_volume,
              SUM(COALESCE(w.promotion_amount, 0)) AS promotion_amount,
              SUM(COALESCE(w.gross_profit, 0)) AS gross_profit,
              SUM(COALESCE(w.predict_gross_profit, 0)) AS predict_gross_profit,
              SUM(COALESCE(w.spend, 0)) AS spend,
              SUM(COALESCE(w.ad_order_quantity, 0)) AS ad_order_quantity,
              SUM(COALESCE(w.ad_sales_amount, 0)) AS ad_sales_amount,
              SUM(COALESCE(w.sessions_total, 0)) AS sessions_total,
              SUM(COALESCE(w.page_views_total, 0)) AS page_views_total,
              SUM(COALESCE(w.clicks, 0)) AS clicks,
              SUM(COALESCE(w.impressions, 0)) AS impressions,
              SUM(COALESCE(w.return_count, 0)) AS return_count,
              SUM(COALESCE(w.return_goods_count, 0)) AS return_goods_count,
              SUM(COALESCE(w.volume, 0)) / NULLIF(COUNT(DISTINCT CONCAT(w.week_start, '~', w.week_end)), 0) AS avg_weekly_volume,
              SUM(COALESCE(w.amount, 0)) / NULLIF(SUM(COALESCE(w.volume, 0)), 0) AS avg_price,
              SUM(COALESCE(w.gross_profit, 0)) / NULLIF(SUM(COALESCE(w.amount, 0)), 0) AS gross_margin,
              SUM(COALESCE(w.spend, 0)) / NULLIF(SUM(COALESCE(w.amount, 0)), 0) AS tacos,
              SUM(COALESCE(w.spend, 0)) / NULLIF(SUM(COALESCE(w.ad_sales_amount, 0)), 0) AS acos,
              SUM(COALESCE(w.clicks, 0)) / NULLIF(SUM(COALESCE(w.impressions, 0)), 0) AS ctr,
              SUM(COALESCE(w.order_items, 0)) / NULLIF(SUM(COALESCE(w.sessions_total, 0)), 0) AS cvr,
              SUM(COALESCE(w.return_count, 0)) / NULLIF(SUM(COALESCE(w.order_items, 0)), 0) AS return_rate,
              SUM(COALESCE(w.gross_profit, 0)) / NULLIF(SUM(COALESCE(w.spend, 0)), 0) AS roi,
              MAX(w.currency_code) AS currency_code,
              #{sourceRunId} AS source_run_id,
              JSON_OBJECT(
                'source', 'lingxing_sku_weekly_performance',
                'yearMonth', w.`year_month`,
                'sourceWeeks', GROUP_CONCAT(DISTINCT CONCAT(w.week_start, '~', w.week_end) ORDER BY w.week_start SEPARATOR ',')
              ) AS aggregate_json,
              NOW() AS generated_at
            FROM lingxing_sku_weekly_performance w
            WHERE w.`year_month` = #{yearMonth}
            GROUP BY w.`year_month`, w.marketplace, w.mid, w.sid_scope, w.sid, w.sku, w.currency_code
            ON DUPLICATE KEY UPDATE
              month_start = VALUES(month_start),
              month_end = VALUES(month_end),
              weeks_count = VALUES(weeks_count),
              source_weeks = VALUES(source_weeks),
              marketplace = VALUES(marketplace),
              mid = VALUES(mid),
              sid_scope = VALUES(sid_scope),
              sid = VALUES(sid),
              store_name = VALUES(store_name),
              seller_sku = VALUES(seller_sku),
              asin = VALUES(asin),
              parent_asin = VALUES(parent_asin),
              product_name = VALUES(product_name),
              local_name = VALUES(local_name),
              tag_ids = VALUES(tag_ids),
              tags = VALUES(tags),
              is_target_sku = VALUES(is_target_sku),
              volume = VALUES(volume),
              order_items = VALUES(order_items),
              amount = VALUES(amount),
              net_amount = VALUES(net_amount),
              promotion_volume = VALUES(promotion_volume),
              promotion_amount = VALUES(promotion_amount),
              gross_profit = VALUES(gross_profit),
              predict_gross_profit = VALUES(predict_gross_profit),
              spend = VALUES(spend),
              ad_order_quantity = VALUES(ad_order_quantity),
              ad_sales_amount = VALUES(ad_sales_amount),
              sessions_total = VALUES(sessions_total),
              page_views_total = VALUES(page_views_total),
              clicks = VALUES(clicks),
              impressions = VALUES(impressions),
              return_count = VALUES(return_count),
              return_goods_count = VALUES(return_goods_count),
              avg_weekly_volume = VALUES(avg_weekly_volume),
              avg_price = VALUES(avg_price),
              gross_margin = VALUES(gross_margin),
              tacos = VALUES(tacos),
              acos = VALUES(acos),
              ctr = VALUES(ctr),
              cvr = VALUES(cvr),
              return_rate = VALUES(return_rate),
              roi = VALUES(roi),
              currency_code = VALUES(currency_code),
              source_run_id = VALUES(source_run_id),
              aggregate_json = VALUES(aggregate_json),
              generated_at = NOW(),
              updated_at = NOW()
            """)
    int rebuildMonthly(@Param("yearMonth") String yearMonth,
                       @Param("sourceRunId") String sourceRunId);

    @Select("""
            SELECT 'lingxing_sku_store_snapshot' AS tableName,
                   COUNT(*) AS baselineRows,
                   COUNT(DISTINCT CONCAT(snapshot_week, ':', mid, ':', sid, ':', sku)) AS baselineKeyCount
            FROM lingxing_sku_store_snapshot
            WHERE (#{snapshotWeek} IS NULL OR snapshot_week = #{snapshotWeek})
            UNION ALL
            SELECT 'lingxing_target_sku_pool' AS tableName,
                   COUNT(*) AS baselineRows,
                   COUNT(DISTINCT CONCAT(snapshot_week, ':', mid, ':', sid, ':', sku)) AS baselineKeyCount
            FROM lingxing_target_sku_pool
            WHERE (#{snapshotWeek} IS NULL OR snapshot_week = #{snapshotWeek}) AND is_active = 1
            UNION ALL
            SELECT 'lingxing_sku_weekly_performance' AS tableName,
                   COUNT(*) AS baselineRows,
                   COUNT(DISTINCT CONCAT(week_start, ':', week_end, ':', COALESCE(sid_scope, ''), ':', sku)) AS baselineKeyCount
            FROM lingxing_sku_weekly_performance
            WHERE (#{yearMonth} IS NULL OR `year_month` = #{yearMonth})
            UNION ALL
            SELECT 'lingxing_sku_monthly_performance' AS tableName,
                   COUNT(*) AS baselineRows,
                   COUNT(DISTINCT CONCAT(`year_month`, ':', COALESCE(sid_scope, ''), ':', sku)) AS baselineKeyCount
            FROM lingxing_sku_monthly_performance
            WHERE (#{yearMonth} IS NULL OR `year_month` = #{yearMonth})
            """)
    List<Map<String, Object>> stats(@Param("snapshotWeek") String snapshotWeek,
                                    @Param("yearMonth") String yearMonth);

    @Select("""
            SELECT COUNT(*)
            FROM lingxing_sku_store_snapshot
            WHERE snapshot_week = #{snapshotWeek}
            """)
    int countStoreSnapshot(@Param("snapshotWeek") String snapshotWeek);

    @Select("""
            SELECT COUNT(*)
            FROM lingxing_target_sku_pool
            WHERE snapshot_week = #{snapshotWeek}
              AND is_active = 1
            """)
    int countTargetPool(@Param("snapshotWeek") String snapshotWeek);

    @Select({
            "<script>",
            "SELECT marketplace, mid, sid, MAX(store_name) AS storeName, sku",
            "FROM lingxing_target_sku_pool",
            "WHERE snapshot_week = #{snapshotWeek}",
            "  AND is_active = 1",
            "  AND (#{marketplace} IS NULL OR #{marketplace} = '' OR marketplace = #{marketplace})",
            "  AND (#{sid} IS NULL OR sid = #{sid})",
            "GROUP BY marketplace, mid, sid, sku",
            "ORDER BY marketplace, sid, sku",
            "<if test='limitRows != null and limitRows &gt; 0'>",
            "LIMIT #{limitRows}",
            "</if>",
            "</script>"
    })
    List<Map<String, Object>> listTargetRowsForWeeklySync(@Param("snapshotWeek") String snapshotWeek,
                                                          @Param("marketplace") String marketplace,
                                                          @Param("sid") Long sid,
                                                          @Param("limitRows") Integer limitRows);

    @Select("""
            SELECT marketplace,
                   mid,
                   sid,
                   MAX(store_name) AS storeName,
                   COUNT(*) AS targetRows
            FROM (
              SELECT marketplace, mid, sid, sku, MAX(store_name) AS store_name
              FROM lingxing_target_sku_pool
              WHERE snapshot_week = #{snapshotWeek}
                AND is_active = 1
                AND (#{marketplace} IS NULL OR #{marketplace} = '' OR marketplace = #{marketplace})
                AND (#{sid} IS NULL OR sid = #{sid})
              GROUP BY marketplace, mid, sid, sku
            ) x
            GROUP BY marketplace, mid, sid
            ORDER BY marketplace, targetRows DESC, sid
            """)
    List<Map<String, Object>> listTargetStoresForWeeklySync(@Param("snapshotWeek") String snapshotWeek,
                                                            @Param("marketplace") String marketplace,
                                                            @Param("sid") Long sid);

    @Select("""
            SELECT COUNT(*)
            FROM (
              SELECT marketplace, mid, sid, sku
              FROM lingxing_target_sku_pool
              WHERE snapshot_week = #{snapshotWeek}
                AND is_active = 1
                AND (#{marketplace} IS NULL OR #{marketplace} = '' OR marketplace = #{marketplace})
                AND (#{sid} IS NULL OR sid = #{sid})
              GROUP BY marketplace, mid, sid, sku
            ) x
            """)
    int countTargetRowsForWeeklySync(@Param("snapshotWeek") String snapshotWeek,
                                     @Param("marketplace") String marketplace,
                                     @Param("sid") Long sid);

    @Select("""
            SELECT COUNT(*)
            FROM lingxing_sku_weekly_performance
            WHERE (#{startDate} IS NULL OR week_start = #{startDate})
              AND (#{endDate} IS NULL OR week_end = #{endDate})
            """)
    int countWeekly(@Param("startDate") String startDate,
                    @Param("endDate") String endDate);

    @Select("""
            SELECT COUNT(*)
            FROM lingxing_sku_monthly_performance
            WHERE `year_month` = #{yearMonth}
            """)
    int countMonthly(@Param("yearMonth") String yearMonth);
}
