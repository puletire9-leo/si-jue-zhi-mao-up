
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agg_ad_performance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `store` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `developer` varchar(100) DEFAULT NULL,
  `ad_spend` decimal(15,2) DEFAULT '0.00',
  `ad_sales` decimal(15,2) DEFAULT '0.00',
  `acoas` decimal(5,2) DEFAULT '0.00',
  `roas` decimal(5,2) DEFAULT '0.00',
  `impressions` int DEFAULT '0',
  `clicks` int DEFAULT '0',
  `ctr` decimal(5,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date_category` (`date`,`category`,`store`,`country`,`developer`),
  KEY `idx_date` (`date`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='广告表现汇总表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agg_category_rank` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `category` varchar(255) NOT NULL,
  `rank_type` enum('sales','amount','growth') NOT NULL,
  `asin` varchar(50) NOT NULL,
  `product_name` varchar(500) DEFAULT NULL,
  `sales_volume` int DEFAULT '0',
  `sales_amount` decimal(15,2) DEFAULT '0.00',
  `rank_num` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date_category_rank` (`date`,`category`,`rank_type`,`asin`),
  KEY `idx_date` (`date`),
  KEY `idx_category` (`category`),
  KEY `idx_rank_type` (`rank_type`),
  KEY `idx_rank_num` (`rank_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='分类排名汇总表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agg_daily_stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `store` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `developer` varchar(100) DEFAULT NULL,
  `product_count` int DEFAULT '0',
  `total_sales_volume` int DEFAULT '0',
  `total_sales_amount` decimal(15,2) DEFAULT '0.00',
  `total_order_quantity` int DEFAULT '0',
  `total_ad_spend` decimal(15,2) DEFAULT '0.00',
  `total_ad_sales` decimal(15,2) DEFAULT '0.00',
  `avg_acoas` decimal(5,2) DEFAULT '0.00',
  `avg_roas` decimal(5,2) DEFAULT '0.00',
  `avg_cvr` decimal(5,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date_category` (`date`,`category`,`store`,`country`,`developer`),
  KEY `idx_date` (`date`),
  KEY `idx_category` (`category`),
  KEY `idx_store` (`store`),
  KEY `idx_country` (`country`),
  KEY `idx_developer` (`developer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='每日统计数据汇总表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agg_monthly_stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `month_code` varchar(6) NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `store` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `developer` varchar(100) DEFAULT NULL,
  `product_count` int DEFAULT '0',
  `total_sales_volume` int DEFAULT '0',
  `total_sales_amount` decimal(15,2) DEFAULT '0.00',
  `total_order_quantity` int DEFAULT '0',
  `total_ad_spend` decimal(15,2) DEFAULT '0.00',
  `total_ad_sales` decimal(15,2) DEFAULT '0.00',
  `avg_acoas` decimal(5,2) DEFAULT '0.00',
  `avg_roas` decimal(5,2) DEFAULT '0.00',
  `avg_cvr` decimal(5,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_month_category` (`month_code`,`category`,`store`,`country`,`developer`),
  KEY `idx_month_code` (`month_code`),
  KEY `idx_category` (`category`),
  KEY `idx_store` (`store`),
  KEY `idx_country` (`country`),
  KEY `idx_developer` (`developer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='每月统计数据汇总表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `analysis_batches` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(64) NOT NULL COMMENT '批次ID（如 UK_202605_zheng_model_20260610-120000）',
  `batch_type` varchar(32) NOT NULL COMMENT '批次类型: zheng_model/product_line/category_scan/seller_scan/new_products',
  `marketplace` varchar(8) NOT NULL COMMENT '站点 UK/DE/US',
  `month` varchar(8) NOT NULL COMMENT '数据月份 202605',
  `source_table` varchar(64) DEFAULT NULL COMMENT '数据源表（deng_zong_shop/competitor_products）',
  `total_products` int DEFAULT '0' COMMENT '原始数据总量',
  `total_items` int DEFAULT '0' COMMENT '聚合后的条目数（如小类数）',
  `data_json` mediumtext NOT NULL COMMENT '结构化分析数据 JSON',
  `status` varchar(16) DEFAULT 'ready' COMMENT 'ready/analyzing/done/error',
  `error_message` text COMMENT '错误信息',
  `analyzed_at` datetime DEFAULT NULL COMMENT 'Agent 分析完成时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_batch` (`batch_id`),
  KEY `idx_type_marketplace_month` (`batch_type`,`marketplace`,`month`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='分析批次表 — 基准数据包 + Agent 分析结果';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `config_key` varchar(100) NOT NULL,
  `config_value` varchar(500) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_key` (`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asin_import_results` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `task_id` bigint DEFAULT NULL,
  `asin` varchar(100) DEFAULT NULL COMMENT 'ASINæˆ–å–å®¶å',
  `seller_name` varchar(200) DEFAULT NULL COMMENT 'å–å®¶åï¼ˆå–å®¶å¯¼å…¥æ—¶ä½¿ç”¨ï¼‰',
  `title` varchar(1000) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `review_count` int DEFAULT NULL,
  `status` varchar(20) DEFAULT 'PASS',
  `detail` text,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  CONSTRAINT `asin_import_results_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `asin_import_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3351235 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asin_import_tasks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `marketplace` varchar(10) DEFAULT NULL,
  `import_type` varchar(20) DEFAULT 'ASIN' COMMENT 'å¯¼å…¥ç±»åž‹: ASIN æˆ– SELLER',
  `task_status` varchar(20) DEFAULT 'UPLOADED',
  `total_count` int DEFAULT '0',
  `pass_count` int DEFAULT '0',
  `price_fail_count` int DEFAULT '0',
  `review_fail_count` int DEFAULT '0',
  `duplicate_count` int DEFAULT '0',
  `skip_count` int DEFAULT '0',
  `batch_total` int DEFAULT '0',
  `batch_current` int DEFAULT '0',
  `api_success` int DEFAULT '0',
  `api_fail` int DEFAULT '0',
  `error_message` varchar(1000) DEFAULT NULL,
  `progress_log` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `api_requests_used` int DEFAULT '0' COMMENT 'å®žé™…APIè¯·æ±‚æ¬¡æ•°(å«ç¿»é¡µ)',
  `parent_asin_count` int DEFAULT '0' COMMENT 'çˆ¶ASINæ•°',
  `variant_asin_count` int DEFAULT '0' COMMENT 'å˜ä½“ASINæ•°',
  `data_month` varchar(6) DEFAULT NULL COMMENT 'æ•°æ®æœˆä»½ YYYYMM',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=131 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backup_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'full',
  `size` decimal(10,2) NOT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'success',
  `storage_location` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local',
  `cos_object_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cos_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_storage_location` (`storage_location`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据库备份记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blue_ocean_scan_results` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `marketplace` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UK' COMMENT '站点（UK/DE）',
  `month` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '数据月份（如 202605）',
  `category` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品类名称',
  `opportunity_type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '机会类型',
  `blue_ocean_score` decimal(8,2) DEFAULT NULL COMMENT '蓝海机会评分',
  `radar_json` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '雷达图JSON',
  `recommendations_json` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '推荐策略JSON',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_marketplace_month` (`marketplace`,`month`),
  KEY `idx_category` (`category`(64)),
  KEY `idx_opportunity_type` (`opportunity_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='蓝海机会扫描结果表 — 跨品类蓝海发现';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `carrier_library` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '产品SKU',
  `batch` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '批次',
  `developer` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '开发人',
  `carrier` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '载体',
  `element` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '元素',
  `images` json NOT NULL COMMENT '图片列表（JSON格式）',
  `reference_images` json NOT NULL COMMENT '参考图列表（JSON格式）',
  `status` enum('finalized','optimizing','concept') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'concept' COMMENT '状态',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `modification_requirement` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '修改要求',
  `product_size` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '产品尺寸',
  `carrier_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '载体名称',
  `material` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '材质',
  `process` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '工艺',
  `weight` int DEFAULT NULL COMMENT '克重',
  `packaging_method` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '打包方式',
  `packaging_size` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '包装尺寸',
  `price` decimal(10,2) DEFAULT NULL COMMENT '价格',
  `min_order_quantity` int DEFAULT NULL COMMENT '起订量',
  `supplier` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '供应商',
  `supplier_link` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '供应商下单链接',
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `idx_batch` (`batch`),
  KEY `idx_developer` (`developer`),
  KEY `idx_carrier` (`carrier`),
  KEY `idx_status` (`status`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='载体库表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `carrier_library_recycle_bin` (
  `id` int NOT NULL AUTO_INCREMENT,
  `carrier_id` int NOT NULL COMMENT '载体ID',
  `sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '产品SKU',
  `batch` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '批次',
  `developer` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '开发人',
  `carrier` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '载体',
  `images` json NOT NULL COMMENT '图片列表（JSON格式）',
  `reference_images` json NOT NULL COMMENT '参考图列表（JSON格式）',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
  `modification_requirement` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '修改要求',
  `delete_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '删除时间',
  `deleted_by` int NOT NULL COMMENT '删除人ID',
  `deleted_by_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '删除人姓名',
  `element` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '元素',
  `product_size` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '产品尺寸',
  `carrier_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '载体名称',
  `material` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '材质',
  `process` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '工艺',
  `weight` int DEFAULT NULL COMMENT '克重',
  `packaging_method` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '打包方式',
  `packaging_size` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '包装尺寸',
  `price` decimal(10,2) DEFAULT NULL COMMENT '价格',
  `min_order_quantity` int DEFAULT NULL COMMENT '起订量',
  `supplier` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '供应商',
  `supplier_link` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '供应商下单链接',
  PRIMARY KEY (`id`),
  KEY `idx_carrier_id` (`carrier_id`),
  KEY `idx_sku` (`sku`),
  KEY `idx_delete_time` (`delete_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='载体库回收站表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '分类描述',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品分类表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_age_tier_baseline` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `marketplace` varchar(10) NOT NULL,
  `bsr_id` varchar(100) NOT NULL,
  `age_bucket` varchar(8) NOT NULL COMMENT '0_30 / 30_60 / 60_90',
  `baseline_month` varchar(6) NOT NULL,
  `sample_size` int NOT NULL DEFAULT '0',
  `units_p25` int DEFAULT NULL,
  `units_p50` int DEFAULT NULL,
  `units_p75` int DEFAULT NULL,
  `units_p90` int DEFAULT NULL,
  `bsr_p10` int DEFAULT NULL COMMENT 'å‰ 10% BSR é˜ˆå€¼ï¼ˆæœ€é å‰æœ€å¥½ï¼‰',
  `bsr_p25` int DEFAULT NULL,
  `bsr_p50` int DEFAULT NULL,
  `bsr_p75` int DEFAULT NULL,
  `price_p50` decimal(10,2) DEFAULT NULL,
  `confidence` varchar(8) DEFAULT NULL COMMENT 'high (â‰¥100 ä¸”åˆ†ä½ä¸å¡Œç¼©) / mid (â‰¥50) / low',
  `computed_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slice` (`marketplace`,`bsr_id`,`age_bucket`,`baseline_month`),
  KEY `idx_lookup` (`marketplace`,`bsr_id`,`baseline_month`)
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='M04 æ–°å“å¤§ç±»Ã—è´¦é¾„Ã—é”€é‡åˆ†çº§åŸºçº¿';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_baselines` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `marketplace` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UK' COMMENT '站点',
  `category_label` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品类标签',
  `archetype` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品类原型（DA/FH/FP/TN/PE/PS）',
  `sample_size` int DEFAULT '0' COMMENT '样本量',
  `baseline_month` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '基线月份',
  `p25_size` decimal(10,2) DEFAULT NULL COMMENT 'size维度 P25',
  `p50_size` decimal(10,2) DEFAULT NULL COMMENT 'size维度 P50',
  `p75_size` decimal(10,2) DEFAULT NULL COMMENT 'size维度 P75',
  `p25_volume` decimal(10,2) DEFAULT NULL COMMENT 'volume维度 P25',
  `p50_volume` decimal(10,2) DEFAULT NULL COMMENT 'volume维度 P50',
  `p75_volume` decimal(10,2) DEFAULT NULL COMMENT 'volume维度 P75',
  `p25_profit` decimal(10,2) DEFAULT NULL COMMENT 'profit维度 P25',
  `p50_profit` decimal(10,2) DEFAULT NULL COMMENT 'profit维度 P50',
  `p75_profit` decimal(10,2) DEFAULT NULL COMMENT 'profit维度 P75',
  `p25_emotion` decimal(10,2) DEFAULT NULL COMMENT 'emotion维度 P25',
  `p50_emotion` decimal(10,2) DEFAULT NULL COMMENT 'emotion维度 P50',
  `p75_emotion` decimal(10,2) DEFAULT NULL COMMENT 'emotion维度 P75',
  `p25_decor` decimal(10,2) DEFAULT NULL COMMENT 'decor维度 P25',
  `p50_decor` decimal(10,2) DEFAULT NULL COMMENT 'decor维度 P50',
  `p75_decor` decimal(10,2) DEFAULT NULL COMMENT 'decor维度 P75',
  `p25_fission` decimal(10,2) DEFAULT NULL COMMENT 'fission维度 P25',
  `p50_fission` decimal(10,2) DEFAULT NULL COMMENT 'fission维度 P50',
  `p75_fission` decimal(10,2) DEFAULT NULL COMMENT 'fission维度 P75',
  `p25_culture` decimal(10,2) DEFAULT NULL COMMENT 'culture维度 P25',
  `p50_culture` decimal(10,2) DEFAULT NULL COMMENT 'culture维度 P50',
  `p75_culture` decimal(10,2) DEFAULT NULL COMMENT 'culture维度 P75',
  `p25_market` decimal(10,2) DEFAULT NULL COMMENT 'market维度 P25',
  `p50_market` decimal(10,2) DEFAULT NULL COMMENT 'market维度 P50',
  `p75_market` decimal(10,2) DEFAULT NULL COMMENT 'market维度 P75',
  `avg_growth_rate` decimal(8,4) DEFAULT NULL COMMENT '平均增速',
  `avg_cr3` decimal(6,4) DEFAULT NULL COMMENT '平均CR3集中度',
  `avg_margin` decimal(8,2) DEFAULT NULL COMMENT '平均利润率(%)',
  `avg_rating` decimal(4,2) DEFAULT NULL COMMENT '平均评分',
  `total_products` int DEFAULT '0' COMMENT '产品总数',
  `computed_at` datetime DEFAULT NULL COMMENT '计算时间',
  `data_source` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '数据来源',
  `confidence` decimal(6,4) DEFAULT NULL COMMENT '置信度',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_marketplace_category` (`marketplace`,`category_label`(64)),
  KEY `idx_archetype` (`archetype`),
  KEY `idx_baseline_month` (`baseline_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='品类百分位基线表 — 8维P25/P50/P75百分位评分基准';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_bsr_baseline` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `marketplace` varchar(10) NOT NULL COMMENT 'Marketplace UK/DE/US',
  `bsr_id` varchar(100) NOT NULL COMMENT 'Top-level category slug',
  `bsr_bucket` varchar(16) NOT NULL COMMENT 'BSR bucket lt5k/5k20k/20k50k/50k150k/gt150k',
  `baseline_month` varchar(6) NOT NULL COMMENT 'Baseline month yyyyMM',
  `sample_size` int NOT NULL DEFAULT '0' COMMENT 'Sample size',
  `units_p25` int DEFAULT NULL COMMENT 'Units P25',
  `units_p50` int DEFAULT NULL COMMENT 'Units P50',
  `units_p75` int DEFAULT NULL COMMENT 'Units P75',
  `price_avg` decimal(10,2) DEFAULT NULL COMMENT 'Average price',
  `confidence` varchar(8) DEFAULT NULL COMMENT 'Confidence high/mid/low',
  `computed_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Computed at',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slice` (`marketplace`,`bsr_id`,`bsr_bucket`,`baseline_month`),
  KEY `idx_lookup` (`marketplace`,`bsr_id`,`baseline_month`)
) ENGINE=InnoDB AUTO_INCREMENT=438 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Line1 category BSR baseline';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_dislocation` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `marketplace` varchar(10) NOT NULL,
  `bsr_id` varchar(100) DEFAULT NULL,
  `canonical_key` varchar(100) NOT NULL,
  `sub_category` varchar(200) NOT NULL,
  `baseline_month` varchar(6) NOT NULL,
  `dengzong_count` int DEFAULT '0',
  `other_cn_count` int DEFAULT '0',
  `non_cn_count` int DEFAULT '0',
  `total_sellers` int DEFAULT '0',
  `product_count` int DEFAULT '0',
  `avg_units` decimal(10,2) DEFAULT NULL,
  `dz_share` decimal(8,4) DEFAULT NULL,
  `non_cn_share` decimal(8,4) DEFAULT NULL,
  `dislocation_score` decimal(8,4) DEFAULT NULL,
  `heat_signal` varchar(8) DEFAULT NULL,
  `computed_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slice` (`marketplace`,`canonical_key`,`baseline_month`),
  KEY `idx_signal` (`marketplace`,`heat_signal`,`baseline_month`),
  KEY `idx_lookup` (`marketplace`,`canonical_key`,`baseline_month`)
) ENGINE=InnoDB AUTO_INCREMENT=103 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Line2 subcategory dislocation signal';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_heat_matrix` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `marketplace` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UK' COMMENT '站点',
  `month` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '数据月份',
  `category` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品类名称',
  `dengzong_count` int DEFAULT '0' COMMENT '郑总系卖家数',
  `external_s_count` int DEFAULT '0' COMMENT '外部优质卖家数',
  `external_a_count` int DEFAULT '0' COMMENT '外部普通卖家数',
  `total_seller_count` int DEFAULT '0' COMMENT '总卖家数',
  `dengzong_ratio` decimal(6,4) DEFAULT NULL COMMENT '郑总系占比',
  `smart_density` decimal(6,4) DEFAULT NULL COMMENT '聪明密度',
  `heat_signal` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '热度信号',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_marketplace_month` (`marketplace`,`month`),
  KEY `idx_category` (`category`(64)),
  KEY `idx_heat_signal` (`heat_signal`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='品类热度矩阵表 — 跨品类卖家活跃度和竞争温度';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `competitor_lookup_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `marketplace` varchar(10) DEFAULT NULL,
  `month` varchar(6) DEFAULT NULL,
  `asins_count` int DEFAULT '0',
  `took_ms` bigint DEFAULT '0',
  `api_status` varchar(10) DEFAULT NULL,
  `error_message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4717 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `competitor_products` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `marketplace` varchar(10) NOT NULL,
  `asin` varchar(20) NOT NULL,
  `month` varchar(6) NOT NULL DEFAULT '202605',
  `title` varchar(1000) DEFAULT NULL,
  `brand` varchar(200) DEFAULT NULL,
  `brand_url` varchar(512) DEFAULT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `parent_asin` varchar(20) DEFAULT NULL,
  `sku` varchar(500) DEFAULT NULL,
  `node_id` bigint DEFAULT NULL,
  `node_id_path` varchar(500) DEFAULT NULL,
  `node_label_path` varchar(500) DEFAULT NULL,
  `symbol` varchar(10) DEFAULT NULL,
  `units` int DEFAULT NULL,
  `units_gr` decimal(10,2) DEFAULT NULL,
  `amz_unit` int DEFAULT NULL,
  `amz_sales` decimal(15,2) DEFAULT NULL,
  `amz_unit_date` bigint DEFAULT NULL,
  `revenue` decimal(15,2) DEFAULT NULL,
  `bsr_id` varchar(100) DEFAULT NULL,
  `bsr` int DEFAULT NULL,
  `bsr_cr` decimal(10,2) DEFAULT NULL,
  `bsr_cv` int DEFAULT NULL,
  `ratings` int DEFAULT NULL,
  `rating` decimal(3,1) DEFAULT NULL,
  `ratings_rate` decimal(5,2) DEFAULT NULL,
  `ratings_cv` int DEFAULT NULL,
  `rating_delta` int DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `prime_price` decimal(10,2) DEFAULT NULL,
  `profit` decimal(5,2) DEFAULT NULL,
  `fba` decimal(10,2) DEFAULT NULL,
  `delivery_price` decimal(10,2) DEFAULT NULL,
  `seller_name` varchar(300) DEFAULT NULL,
  `seller_id` varchar(50) DEFAULT NULL,
  `seller_nation` varchar(10) DEFAULT NULL,
  `sellers` int DEFAULT NULL,
  `fulfillment` varchar(10) DEFAULT NULL,
  `variations` int DEFAULT NULL,
  `weight` varchar(50) DEFAULT NULL,
  `dimension` varchar(100) DEFAULT NULL,
  `dimensions_type` varchar(20) DEFAULT NULL,
  `pkg_dimensions` varchar(100) DEFAULT NULL,
  `pkg_dimension_type` varchar(20) DEFAULT NULL,
  `pkg_weight` varchar(50) DEFAULT NULL,
  `lqs` decimal(5,2) DEFAULT NULL,
  `available_date` bigint DEFAULT NULL,
  `best_seller` varchar(200) DEFAULT NULL,
  `amazon_choice` varchar(200) DEFAULT NULL,
  `new_release` varchar(200) DEFAULT NULL,
  `ebc` varchar(200) DEFAULT NULL,
  `video` varchar(200) DEFAULT NULL,
  `filter_mode` varchar(10) DEFAULT NULL,
  `filter_reasons` text,
  `listing_days` int DEFAULT NULL,
  `weight_g` decimal(10,2) DEFAULT NULL,
  `product_url` varchar(512) DEFAULT NULL,
  `similar_url` varchar(512) DEFAULT NULL,
  `source` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `score` int DEFAULT NULL COMMENT 'è¯„åˆ†',
  `grade` varchar(2) DEFAULT NULL COMMENT 'ç­‰çº§',
  `week_tag` varchar(10) DEFAULT NULL COMMENT 'ISOå‘¨æ ‡è®°',
  `is_current` int DEFAULT '0' COMMENT 'æ˜¯å¦æœ¬å‘¨',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asin_month` (`marketplace`,`asin`,`month`),
  KEY `idx_filter_mode` (`filter_mode`),
  KEY `idx_listing_days` (`listing_days`)
) ENGINE=InnoDB AUTO_INCREMENT=392552 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `competitor_products_clean` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `marketplace` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `asin` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `month` varchar(6) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '202605',
  `title` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand_url` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_url` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_asin` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sku` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `node_id` bigint DEFAULT NULL,
  `node_id_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `node_label_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `symbol` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `units` int DEFAULT NULL,
  `units_gr` decimal(10,2) DEFAULT NULL,
  `amz_unit` int DEFAULT NULL,
  `amz_sales` decimal(15,2) DEFAULT NULL,
  `amz_unit_date` bigint DEFAULT NULL,
  `revenue` decimal(15,2) DEFAULT NULL,
  `bsr_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bsr` int DEFAULT NULL,
  `bsr_cr` decimal(10,2) DEFAULT NULL,
  `bsr_cv` int DEFAULT NULL,
  `ratings` int DEFAULT NULL,
  `rating` decimal(3,1) DEFAULT NULL,
  `ratings_rate` decimal(5,2) DEFAULT NULL,
  `ratings_cv` int DEFAULT NULL,
  `rating_delta` int DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `prime_price` decimal(10,2) DEFAULT NULL,
  `profit` decimal(5,2) DEFAULT NULL,
  `fba` decimal(10,2) DEFAULT NULL,
  `delivery_price` decimal(10,2) DEFAULT NULL,
  `seller_name` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `seller_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `seller_nation` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sellers` int DEFAULT NULL,
  `fulfillment` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `variations` int DEFAULT NULL,
  `weight` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dimension` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dimensions_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pkg_dimensions` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pkg_dimension_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pkg_weight` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lqs` decimal(5,2) DEFAULT NULL,
  `available_date` bigint DEFAULT NULL,
  `best_seller` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amazon_choice` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_release` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ebc` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `video` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filter_mode` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filter_reasons` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `listing_days` int DEFAULT NULL,
  `weight_g` decimal(10,2) DEFAULT NULL,
  `product_url` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `similar_url` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `score` int DEFAULT NULL COMMENT 'è¯„åˆ†',
  `grade` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ç­‰çº§',
  `week_tag` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ISOå‘¨æ ‡è®°',
  `is_current` int DEFAULT '0' COMMENT 'æ˜¯å¦æœ¬å‘¨',
  `dedup_key` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'COALESCE(parent_asin, asin)',
  `effective_week_tag` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'æ¸…æ´—ç”¨ week_tagï¼›è€æ•°æ®ç”¨ month-W00 å ä½',
  `cleaned_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `m04_age_bucket` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `m04_tier` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `m04_units_pct` decimal(4,3) DEFAULT NULL,
  `m04_bsr_pct` decimal(4,3) DEFAULT NULL,
  `m04_computed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_batch_dedup` (`marketplace`,`effective_week_tag`,`dedup_key`),
  KEY `idx_filter_mode` (`filter_mode`),
  KEY `idx_listing_days` (`listing_days`),
  KEY `idx_marketplace_month_clean` (`marketplace`,`month`),
  KEY `idx_bsr_id_month_clean` (`marketplace`,`bsr_id`,`month`),
  KEY `idx_parent_asin_clean` (`parent_asin`),
  KEY `idx_effective_week` (`effective_week_tag`),
  KEY `idx_m04_filter_clean` (`marketplace`,`bsr_id`,`m04_age_bucket`,`m04_tier`)
) ENGINE=InnoDB AUTO_INCREMENT=392552 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `competitor_subcategories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `rank_value` int DEFAULT NULL,
  `label` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `competitor_subcategories_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `competitor_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=221668 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deng_zong_shop` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `marketplace` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `asin` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `month` varchar(6) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand_url` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_url` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_asin` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sku` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `node_id` bigint DEFAULT NULL,
  `node_id_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `node_label_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `symbol` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `units` int DEFAULT NULL,
  `units_gr` decimal(10,2) DEFAULT NULL,
  `amz_unit` int DEFAULT NULL,
  `amz_sales` decimal(15,2) DEFAULT NULL,
  `amz_unit_date` bigint DEFAULT NULL,
  `revenue` decimal(15,2) DEFAULT NULL,
  `bsr_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bsr` int DEFAULT NULL,
  `bsr_cr` decimal(10,2) DEFAULT NULL,
  `bsr_cv` int DEFAULT NULL,
  `ratings` int DEFAULT NULL,
  `rating` decimal(3,1) DEFAULT NULL,
  `ratings_rate` decimal(5,2) DEFAULT NULL,
  `ratings_cv` int DEFAULT NULL,
  `rating_delta` int DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `prime_price` decimal(10,2) DEFAULT NULL,
  `profit` decimal(5,2) DEFAULT NULL,
  `fba` decimal(10,2) DEFAULT NULL,
  `delivery_price` decimal(10,2) DEFAULT NULL,
  `seller_name` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `seller_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `seller_nation` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sellers` int DEFAULT NULL,
  `fulfillment` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `variations` int DEFAULT NULL,
  `weight` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dimension` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dimensions_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pkg_dimensions` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pkg_dimension_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pkg_weight` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lqs` decimal(5,2) DEFAULT NULL,
  `available_date` bigint DEFAULT NULL,
  `best_seller` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amazon_choice` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_release` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ebc` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `video` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_url` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `similar_url` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_date` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asin_month` (`asin`,`month`),
  KEY `idx_marketplace` (`marketplace`),
  KEY `idx_seller_name` (`seller_name`(100)),
  KEY `idx_brand` (`brand`(100))
) ENGINE=InnoDB AUTO_INCREMENT=6992 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deng_zong_shop_seller` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `marketplace` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `seller_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `store_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_synced_at` datetime DEFAULT NULL COMMENT 'ä¸Šæ¬¡åŒæ­¥æ—¶é—´',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_marketplace_seller` (`marketplace`,`seller_name`)
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `directories` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '目录ID',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '目录名称',
  `parent_id` bigint DEFAULT NULL COMMENT '父目录ID，NULL表示根目录',
  `path` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '完整路径',
  `type` enum('material','carrier','prompt','resource') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '目录类型：material(素材), carrier(载体), prompt(提示词), resource(资源)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_type` (`type`),
  KEY `idx_path` (`path`(255)),
  CONSTRAINT `directories_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `directories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件目录表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `download_task_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` bigint DEFAULT '0',
  `status` enum('pending','success','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_task_id` (`task_id`),
  CONSTRAINT `download_task_files_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `download_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `download_tasks` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','processing','completed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `progress` int DEFAULT '0',
  `total_files` int DEFAULT '0',
  `completed_files` int DEFAULT '0',
  `failed_files` int DEFAULT '0',
  `total_size` bigint DEFAULT '0',
  `local_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `request_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'JSON serialized file list for retry',
  `created_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `file_links` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '文件链接ID',
  `title` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '链接地址',
  `link_type` enum('feishu_xlsx','standard_url') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '链接类型：feishu_xlsx(飞书xlsx)/standard_url(标准链接)',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '链接描述',
  `tags` json DEFAULT NULL COMMENT '标签列表',
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '分类',
  `library_type` enum('prompt-library','resource-library') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '所属库类型',
  `status` enum('active','inactive','error') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '链接状态',
  `last_checked` datetime DEFAULT NULL COMMENT '最后检查时间',
  `check_result` json DEFAULT NULL COMMENT '检查结果',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_library_type` (`library_type`),
  KEY `idx_link_type` (`link_type`),
  KEY `idx_status` (`status`),
  KEY `idx_category` (`category`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_title` (`title`(100)),
  FULLTEXT KEY `idx_title_desc` (`title`,`description`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件链接表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `file_uploads` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '文件上传ID',
  `filename` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件名',
  `file_path` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件存储路径',
  `file_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件访问URL',
  `file_size` int NOT NULL COMMENT '文件大小(字节)',
  `file_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件类型',
  `library_type` enum('prompt-library','resource-library') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '所属库类型',
  `upload_user_id` int DEFAULT NULL COMMENT '上传用户ID',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '文件描述',
  `tags` json DEFAULT NULL COMMENT '标签列表',
  `status` enum('active','deleted') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '文件状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_library_type` (`library_type`),
  KEY `idx_file_type` (`file_type`),
  KEY `idx_upload_user_id` (`upload_user_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_filename` (`filename`(100)),
  FULLTEXT KEY `idx_filename_desc` (`filename`,`description`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件上传表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `files` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '文件ID',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件名',
  `directory_id` bigint NOT NULL COMMENT '所属目录ID',
  `file_path` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件路径',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小（字节）',
  `mime_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文件MIME类型',
  `metadata` json DEFAULT NULL COMMENT '文件元数据（JSON格式）',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_directory_id` (`directory_id`),
  KEY `idx_name` (`name`),
  KEY `idx_file_path` (`file_path`(255)),
  CONSTRAINT `files_ibfk_1` FOREIGN KEY (`directory_id`) REFERENCES `directories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `final_draft_recycle_bin` (
  `id` int NOT NULL AUTO_INCREMENT,
  `draft_id` int NOT NULL COMMENT '原定稿ID',
  `sku` varchar(255) NOT NULL COMMENT 'SKU编号',
  `batch` varchar(255) DEFAULT NULL COMMENT '批次',
  `developer` varchar(255) DEFAULT NULL COMMENT '开发人',
  `carrier` varchar(255) DEFAULT NULL COMMENT '载体',
  `images` text COMMENT '图片URL列表，JSON格式',
  `status` varchar(50) DEFAULT NULL COMMENT '删除前状态',
  `deleted_by` int NOT NULL COMMENT '删除人ID',
  `deleted_by_name` varchar(255) NOT NULL COMMENT '删除人姓名',
  `delete_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '删除时间',
  `reference_images` text COMMENT '参考图片URL列表，JSON格式',
  `modification_requirement` text COMMENT '修改要求',
  `local_thumbnail_path` varchar(255) DEFAULT NULL COMMENT '本地缩略图路径',
  `infringement_label` varchar(500) DEFAULT NULL COMMENT '侵权标注',
  PRIMARY KEY (`id`),
  KEY `idx_draft_id` (`draft_id`),
  KEY `idx_sku` (`sku`),
  KEY `idx_delete_time` (`delete_time`)
) ENGINE=InnoDB AUTO_INCREMENT=120 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='定稿回收站表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `final_drafts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sku` varchar(255) NOT NULL COMMENT 'SKU编号',
  `batch` varchar(100) NOT NULL,
  `developer` varchar(100) NOT NULL,
  `carrier` varchar(100) NOT NULL,
  `element` varchar(100) DEFAULT '',
  `images` text COMMENT '图片URL列表，JSON格式',
  `status` varchar(20) NOT NULL DEFAULT 'concept',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `reference_images` text COMMENT '参考图片URL列表，JSON格式',
  `modification_requirement` text COMMENT '修改要求',
  `local_thumbnail_path` varchar(255) DEFAULT NULL COMMENT '本地缩略图文件路径',
  `local_thumbnail_status` enum('pending','downloading','completed','failed') DEFAULT 'pending' COMMENT '本地缩略图下载状态',
  `local_thumbnail_updated_at` datetime DEFAULT NULL COMMENT '本地缩略图更新时间',
  `local_thumbnail_size` bigint DEFAULT NULL COMMENT '本地缩略图文件大小（字节）',
  `local_thumbnail_md5` varchar(32) DEFAULT NULL COMMENT '本地缩略图MD5校验值',
  `infringement_label` varchar(500) DEFAULT NULL COMMENT '侵权标注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `idx_sku` (`sku`),
  KEY `idx_batch` (`batch`),
  KEY `idx_developer` (`developer`),
  KEY `idx_carrier` (`carrier`),
  KEY `idx_status` (`status`),
  KEY `idx_create_time` (`create_time`),
  KEY `idx_local_thumbnail_status` (`local_thumbnail_status`),
  KEY `idx_local_thumbnail_updated_at` (`local_thumbnail_updated_at`)
) ENGINE=InnoDB AUTO_INCREMENT=1976 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='定稿信息表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `follow_signals` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `marketplace` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UK' COMMENT '站点',
  `month` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '数据月份',
  `category` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品类名称',
  `first_seller` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '首发卖家',
  `first_asin` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '首发ASIN',
  `first_listing_days` int DEFAULT '0' COMMENT '首发上架天数',
  `follower_count` int DEFAULT '0' COMMENT '跟品卖家数',
  `smart_follower_count` int DEFAULT '0' COMMENT '优质跟品卖家数',
  `signal_strength` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '信号强度',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_marketplace_month` (`marketplace`,`month`),
  KEY `idx_category` (`category`(64)),
  KEY `idx_signal_strength` (`signal_strength`),
  KEY `idx_first_asin` (`first_asin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='跟品信号表 — ASIN级跟品信号和趋势追踪';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grade_thresholds` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `grade` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '等级（S/A/B/C/D）',
  `min_score` int NOT NULL COMMENT '最低分',
  `max_score` int NOT NULL COMMENT '最高分',
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '前端显示颜色',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `grade` (`grade`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='等级阈值配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `image_access_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `image_id` int NOT NULL COMMENT '图片ID',
  `status` varchar(20) NOT NULL COMMENT '访问状态：success/failed',
  `error_message` text COMMENT '错误信息',
  `access_time` datetime NOT NULL COMMENT '访问时间',
  `ip` varchar(50) DEFAULT NULL,
  `user_agent` text COMMENT '用户代理',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_image_id` (`image_id`),
  KEY `idx_status` (`status`),
  KEY `idx_access_time` (`access_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='图片访问日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `image_encoding_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `pure_sku` varchar(50) NOT NULL COMMENT '提取的纯SKU（如2570001）',
  `image_path` varchar(500) NOT NULL COMMENT '图片完整路径',
  `image_md5` varchar(32) NOT NULL COMMENT '图片内容MD5（唯一标识内容）',
  `vector_hash` varchar(64) DEFAULT NULL COMMENT '向量特征哈希（可选）',
  `encode_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '编码时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_valid` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否有效（1=有效，0=失效）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sku_md5` (`pure_sku`,`image_md5`) COMMENT '联合唯一索引，避免重复记录'
) ENGINE=InnoDB AUTO_INCREMENT=490 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='图片编码结果档案表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `image_operation_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `image_id` int NOT NULL COMMENT '??ID',
  `operation_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '????',
  `operation_details` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '????',
  `operator_id` int NOT NULL COMMENT '???ID',
  `operator_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '?????',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '????',
  PRIMARY KEY (`id`),
  KEY `idx_image_id` (`image_id`),
  KEY `idx_operation_type` (`operation_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `image_operation_logs_ibfk_1` FOREIGN KEY (`image_id`) REFERENCES `images` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='???????';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `image_stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stat_date` date NOT NULL,
  `total_images` int DEFAULT '0',
  `uploaded_count` int DEFAULT '0',
  `deleted_count` int DEFAULT '0',
  `avg_quality_score` decimal(5,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stat_date` (`stat_date`),
  KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `image_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `image_id` int NOT NULL COMMENT '??ID',
  `tag_id` int NOT NULL COMMENT '??ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '????',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_image_tag` (`image_id`,`tag_id`),
  KEY `idx_image_id` (`image_id`),
  KEY `idx_tag_id` (`tag_id`),
  CONSTRAINT `image_tags_ibfk_1` FOREIGN KEY (`image_id`) REFERENCES `images` (`id`) ON DELETE CASCADE,
  CONSTRAINT `image_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='???????';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `images` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件名',
  `filepath` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件路径',
  `file_size` bigint NOT NULL COMMENT '文件大小（字节）',
  `width` int NOT NULL COMMENT '图片宽度',
  `height` int NOT NULL COMMENT '图片高度',
  `format` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '图片格式',
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '图片分类',
  `tags` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '图片标签（逗号分隔）',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '图片描述',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `storage_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'local' COMMENT '存储类型: local(本地), cos(腾讯云COS)',
  `cos_object_key` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '腾讯云COS对象键',
  `cos_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '腾讯云COS访问URL',
  `cos_thumbnail_key` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '腾讯云COS缩略图对象键',
  `cos_thumbnail_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '腾讯云COS缩略图访问URL',
  `original_zip_filepath` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '原始图片zip包路径',
  `original_zip_cos_key` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '原始图片zip包COS对象键',
  `sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '' COMMENT '关联的SKU',
  `original_file_size` bigint DEFAULT '0',
  `original_format` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `original_height` int DEFAULT '0',
  `original_filename` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `original_quality` int DEFAULT '0',
  `original_width` int DEFAULT '0',
  `thumbnail_cos_key` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '' COMMENT '缩略图COS对象键',
  `thumbnail_cos_url` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '' COMMENT '缩略图COS访问URL',
  `thumbnail_local_path` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '' COMMENT '缩略图本地存储路径',
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_tags` (`tags`(100)),
  KEY `idx_storage_type` (`storage_type`),
  KEY `idx_cos_object_key` (`cos_object_key`),
  KEY `idx_original_zip_filepath` (`original_zip_filepath`),
  KEY `idx_original_zip_cos_key` (`original_zip_cos_key`),
  KEY `idx_sku` (`sku`),
  KEY `idx_images_cos_object_key` (`cos_object_key`),
  KEY `idx_images_cos_url` (`cos_url`(255))
) ENGINE=InnoDB AUTO_INCREMENT=3689 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `level` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `ip_address` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_level` (`level`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_library` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '产品SKU',
  `batch` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '批次',
  `developer` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '开发人',
  `carrier` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '载体',
  `element` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '元素',
  `images` json NOT NULL COMMENT '图片列表（JSON格式）',
  `reference_images` json NOT NULL COMMENT '参考图列表（JSON格式）',
  `status` enum('finalized','optimizing','concept') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'concept' COMMENT '状态',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `modification_requirement` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '修改要求',
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `idx_batch` (`batch`),
  KEY `idx_developer` (`developer`),
  KEY `idx_carrier` (`carrier`),
  KEY `idx_status` (`status`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB AUTO_INCREMENT=166 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='素材库表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_library_recycle_bin` (
  `id` int NOT NULL AUTO_INCREMENT,
  `material_id` int NOT NULL COMMENT '素材ID',
  `sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '产品SKU',
  `batch` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '批次',
  `developer` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '开发人',
  `carrier` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '载体',
  `images` json NOT NULL COMMENT '图片列表（JSON格式）',
  `reference_images` json NOT NULL COMMENT '参考图列表（JSON格式）',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
  `modification_requirement` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '修改要求',
  `delete_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '删除时间',
  `deleted_by` int NOT NULL COMMENT '删除人ID',
  `deleted_by_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '删除人姓名',
  `element` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '元素',
  PRIMARY KEY (`id`),
  KEY `idx_material_id` (`material_id`),
  KEY `idx_sku` (`sku`),
  KEY `idx_delete_time` (`delete_time`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='素材库回收站表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `operation_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '????ID',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '?????',
  `operation_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '????',
  `table_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '????',
  `record_id` int DEFAULT NULL COMMENT '????ID',
  `old_data` json DEFAULT NULL COMMENT '??????JSON???',
  `new_data` json DEFAULT NULL COMMENT '??????JSON???',
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '??IP??',
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '????',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '????',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_operation_type` (`operation_type`),
  KEY `idx_table_name` (`table_name`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='?????';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_30day_new` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `asin` varchar(20) NOT NULL,
  `title` varchar(1000) DEFAULT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `product_url` varchar(512) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `bsr` int DEFAULT NULL,
  `monthly_sales` int DEFAULT NULL,
  `listing_days` int DEFAULT NULL,
  `shop_name` varchar(255) DEFAULT NULL,
  `filter_status` varchar(20) DEFAULT NULL,
  `filter_reasons` text,
  `marketplace` varchar(10) DEFAULT NULL,
  `data_month` varchar(6) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_asin` (`asin`),
  KEY `idx_listing_days` (`listing_days`)
) ENGINE=InnoDB AUTO_INCREMENT=66870 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_bundles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parent_sku` varchar(50) DEFAULT NULL,
  `child_sku` varchar(50) DEFAULT NULL,
  `quantity` int DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_bundles_parent` (`parent_sku`),
  CONSTRAINT `product_bundles_ibfk_1` FOREIGN KEY (`parent_sku`) REFERENCES `products` (`sku`)
) ENGINE=InnoDB AUTO_INCREMENT=115 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_click_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `user_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'username',
  `asin` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '产品ASIN',
  `marketplace` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '站点 UK/DE',
  `source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '新品榜' COMMENT '来源: 新品榜/竞品店铺/总选品',
  `action` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '行为类型: click=浏览卡片/跳链接, select=选中',
  `product_title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '产品标题(冗余，分析时免JOIN)',
  `clicked_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '点击时间',
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_asin` (`asin`),
  KEY `idx_source_action` (`source`,`action`,`clicked_at`),
  KEY `idx_user_time` (`user_id`,`clicked_at`)
) ENGINE=InnoDB AUTO_INCREMENT=315 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品点击行为记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_images` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL COMMENT '??ID',
  `image_id` int NOT NULL COMMENT '??ID',
  `is_primary` tinyint(1) NOT NULL DEFAULT '0' COMMENT '????',
  `sort_order` int DEFAULT '0' COMMENT '????',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '????',
  PRIMARY KEY (`id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_image_id` (`image_id`),
  KEY `idx_is_primary` (`is_primary`),
  CONSTRAINT `product_images_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_images_ibfk_2` FOREIGN KEY (`image_id`) REFERENCES `images` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='???????';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_line_elements` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `marketplace` varchar(8) NOT NULL,
  `month` varchar(8) NOT NULL,
  `bsr_id` varchar(64) DEFAULT NULL,
  `node_id` bigint DEFAULT NULL,
  `node_name` varchar(128) DEFAULT NULL,
  `asin` varchar(20) DEFAULT NULL,
  `title` varchar(512) DEFAULT NULL,
  `listing_days` int DEFAULT NULL,
  `units` int DEFAULT NULL,
  `bsr` int DEFAULT NULL,
  `price` decimal(8,2) DEFAULT NULL,
  `variations` int DEFAULT NULL,
  `signal_tags` json DEFAULT NULL COMMENT '信号标签 ["STABLE","VARIANT","SWEET_SPOT"]',
  `elements` json DEFAULT NULL COMMENT '元素 ["heart","thank-you"] (原标题语言)',
  `carriers` json DEFAULT NULL COMMENT '载体 ["ceramic-plaque"]',
  `scenes` json DEFAULT NULL COMMENT '场景 ["women","friend"]',
  `is_winner` tinyint DEFAULT '0',
  `ai_keywords` json DEFAULT NULL COMMENT 'AI生成的中文关键词 ["爱心陶瓷牌"]',
  `analysis_batch_id` varchar(64) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_batch_asin` (`analysis_batch_id`,`asin`),
  KEY `idx_bsr_node` (`bsr_id`,`node_id`),
  KEY `idx_batch` (`analysis_batch_id`),
  KEY `idx_asin` (`asin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='品线元素表 — AI判定的好品关联';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_line_guidance` (
  `id` bigint NOT NULL COMMENT 'ä¸»é”®ID',
  `batch_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'æ‰¹æ¬¡ID',
  `marketplace` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UK' COMMENT 'ç«™ç‚¹',
  `bsr_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'BSRå“ç±»èŠ‚ç‚¹ID',
  `node_name` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'å“ç±»åç§°',
  `node_full_path` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'å“ç±»å®Œæ•´è·¯å¾„',
  `archetype` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'UNKNOWN' COMMENT 'å“ç±»åŽŸåž‹',
  `archetype_method` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'åŽŸåž‹åŒ¹é…æ–¹å¼',
  `lifecycle_stage` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ç”Ÿå‘½å‘¨æœŸé˜¶æ®µ',
  `lifecycle_window` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'åˆ‡å…¥çª—å£',
  `cr3` decimal(6,4) DEFAULT NULL COMMENT 'CR3ç«žäº‰é›†ä¸­åº¦',
  `competition_pattern` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ç«žäº‰æ ¼å±€',
  `entry_barrier` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'è¿›å…¥å£åž’',
  `profit_margin` decimal(8,2) DEFAULT NULL COMMENT 'å…¸åž‹åˆ©æ¶¦çŽ‡(%)',
  `profit_verdict` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'åˆ©æ¶¦åˆ¤å®š',
  `opportunity_score` int DEFAULT '0' COMMENT 'æœºä¼šè¯„åˆ†',
  `recommend_level` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'WATCH' COMMENT 'æŽ¨èç­‰çº§',
  `go_no_go` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'WAIT_AND_SEE' COMMENT 'Go/NoGoåˆ¤å®š',
  `price_band_json` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'ä»·æ ¼å¸¦åˆ†æžJSON',
  `score_breakdown_json` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'è¯„åˆ†åˆ†é¡¹æ˜Žç»†JSON',
  `risk_rules_json` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'é£Žé™©ç¡¬è§„åˆ™JSON',
  `full_analysis_json` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'å®Œæ•´åˆ†æžç»“æžœJSON',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`id`),
  KEY `idx_batch_id` (`batch_id`),
  KEY `idx_bsr_id` (`bsr_id`),
  KEY `idx_recommend_level` (`recommend_level`),
  KEY `idx_opportunity_score` (`opportunity_score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='å“çº¿é€‰å“æŒ‡å¯¼æ„è§è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_operation_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sku` varchar(50) NOT NULL COMMENT '产品SKU',
  `action` varchar(20) NOT NULL COMMENT '操作类型：delete-删除，restore-恢复，permanent_delete-永久删除，auto_delete-自动删除',
  `operator` varchar(50) NOT NULL DEFAULT 'system' COMMENT '操作人',
  `operation_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  `ip_address` varchar(50) DEFAULT NULL COMMENT '操作IP地址',
  `remarks` text COMMENT '备注信息',
  PRIMARY KEY (`id`),
  KEY `idx_sku` (`sku`),
  KEY `idx_action` (`action`),
  KEY `idx_operation_time` (`operation_time`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='产品操作日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_performance_actual` (
  `id` bigint NOT NULL COMMENT '雪花ID',
  `asin` varchar(20) NOT NULL COMMENT 'ASIN',
  `parent_asin` varchar(20) DEFAULT NULL COMMENT '父ASIN',
  `sku` varchar(100) DEFAULT NULL COMMENT 'SKU',
  `marketplace` varchar(10) NOT NULL COMMENT '站点: UK/DE/IT/US',
  `price` decimal(10,2) DEFAULT NULL COMMENT '售价(清洗货币符号)',
  `sales_volume` int DEFAULT NULL COMMENT '销量',
  `category_rank_main` varchar(200) DEFAULT NULL COMMENT '大类排名原文',
  `category_main` varchar(100) DEFAULT NULL COMMENT '大类名',
  `category_rank_sub` varchar(200) DEFAULT NULL COMMENT '小类排名原文',
  `category_sub` varchar(150) DEFAULT NULL COMMENT '小类名',
  `acoas` decimal(8,4) DEFAULT NULL COMMENT '广告销售成本占比',
  `natural_clicks` int DEFAULT NULL COMMENT '自然点击量',
  `ctr` decimal(6,4) DEFAULT NULL COMMENT 'CTR 百分比转小数',
  `ad_cvr` decimal(6,4) DEFAULT NULL COMMENT '广告 CVR 百分比转小数',
  `natural_orders` int DEFAULT NULL COMMENT '自然订单量',
  `fba_available` int DEFAULT NULL COMMENT 'FBA 可售',
  `refund_rate` decimal(6,4) DEFAULT NULL COMMENT '退款率 百分比转小数',
  `product_name` varchar(500) DEFAULT NULL COMMENT '中文品名',
  `title` varchar(1000) DEFAULT NULL COMMENT '英文标题',
  `archetype` varchar(8) DEFAULT NULL COMMENT '原型: STD/CUSTOM',
  `element` varchar(100) DEFAULT NULL COMMENT '元素',
  `carrier` varchar(100) DEFAULT NULL COMMENT '载体',
  `listing_tags` varchar(200) DEFAULT NULL COMMENT '原始标签',
  `is_eliminated` tinyint DEFAULT '0' COMMENT '标签含淘汰',
  `is_green` tinyint DEFAULT '0' COMMENT '标签含绿标',
  `bsr_id` varchar(100) DEFAULT NULL COMMENT '大类 slug',
  `source_batch` varchar(50) DEFAULT NULL COMMENT '导入批次',
  `imported_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '导入时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asin_marketplace` (`asin`,`marketplace`),
  KEY `idx_archetype` (`archetype`),
  KEY `idx_category_sub` (`category_sub`(64)),
  KEY `idx_is_eliminated` (`is_eliminated`),
  KEY `idx_is_green` (`is_green`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='自有真实战绩(tier1真值,591赢家)';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stat_date` date NOT NULL,
  `total_products` int DEFAULT '0',
  `new_products` int DEFAULT '0',
  `updated_products` int DEFAULT '0',
  `deleted_products` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stat_date` (`stat_date`),
  KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tag_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_tag` (`product_sku`,`tag_id`),
  KEY `idx_product_sku` (`product_sku`),
  KEY `idx_tag_id` (`tag_id`),
  CONSTRAINT `product_tags_ibfk_1` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sku` varchar(100) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `description` text,
  `category` varchar(100) DEFAULT NULL,
  `tags` text,
  `price` decimal(10,2) DEFAULT NULL,
  `stock` int DEFAULT '0',
  `status` varchar(20) DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `image_url` varchar(512) DEFAULT NULL,
  `local_path` varchar(512) DEFAULT NULL,
  `thumb_path` varchar(512) DEFAULT NULL,
  `product_type` varchar(50) DEFAULT NULL,
  `developer` varchar(100) DEFAULT NULL,
  `delete_time` datetime DEFAULT NULL,
  `parent_sku` varchar(50) DEFAULT NULL,
  `image` text,
  `included_items` text,
  `type` varchar(50) DEFAULT 'æ™®é€šäº§å“',
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recycle_bin` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `deleted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_product_sku` (`product_sku`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reference_data_versions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source_table` varchar(64) NOT NULL COMMENT '数据源表 deng_zong_shop',
  `marketplace` varchar(8) NOT NULL COMMENT '站点 UK/DE',
  `data_version` int NOT NULL DEFAULT '1' COMMENT '数据版本号 v1/v2/...',
  `data_month` varchar(8) DEFAULT NULL COMMENT '当前数据月份',
  `record_count` int DEFAULT NULL COMMENT '导入记录数',
  `imported_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `notes` varchar(256) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_source_market` (`source_table`,`marketplace`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='基准数据版本 — 数据变了版本才变，模型版本对齐此表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `requirements` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `priority` enum('high','medium','low') NOT NULL,
  `status` enum('pending','in_progress','completed') NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scoring_config` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `dimension_key` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '维度标识',
  `display_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '显示名称',
  `weight` decimal(5,2) NOT NULL COMMENT '权重百分比',
  `thresholds` json NOT NULL COMMENT '阈值配置',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `dimension_key` (`dimension_key`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评分维度配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `selection_decisions` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `marketplace` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UK' COMMENT '站点',
  `asin` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ASIN',
  `decision_month` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '决策月份',
  `category_label` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品类标签',
  `category_prototype` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品类原型',
  `selection_score` int DEFAULT '0' COMMENT '选品综合评分（0-100）',
  `selection_grade` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '选品等级（S/A/B/C/D）',
  `sel_size_score` tinyint DEFAULT NULL COMMENT 'size维度分（0-100）',
  `sel_volume_score` tinyint DEFAULT NULL COMMENT 'volume维度分',
  `sel_profit_score` tinyint DEFAULT NULL COMMENT 'profit维度分',
  `sel_emotion_score` tinyint DEFAULT NULL COMMENT 'emotion维度分',
  `sel_decor_score` tinyint DEFAULT NULL COMMENT 'decor维度分',
  `sel_fission_score` tinyint DEFAULT NULL COMMENT 'fission维度分',
  `sel_culture_score` tinyint DEFAULT NULL COMMENT 'culture维度分',
  `sel_market_score` tinyint DEFAULT NULL COMMENT 'market维度分',
  `decision_score` decimal(8,2) DEFAULT NULL COMMENT '最终决策分',
  `decision_status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '决策状态（SELECT/PASS/PENDING）',
  `signal_boosts` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '信号加成JSON',
  `baseline_bsr` int DEFAULT '0' COMMENT '决策时BSR',
  `baseline_units` int DEFAULT '0' COMMENT '决策时月销',
  `baseline_price` decimal(10,2) DEFAULT NULL COMMENT '决策时价格',
  `baseline_ratings` int DEFAULT '0' COMMENT '决策时评论数',
  `verify_month` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '验证月份',
  `verify_bsr` int DEFAULT NULL COMMENT '验证时BSR',
  `verify_units` int DEFAULT NULL COMMENT '验证时月销',
  `verify_price` decimal(10,2) DEFAULT NULL COMMENT '验证时价格',
  `verify_ratings` int DEFAULT NULL COMMENT '验证时评论数',
  `outcome` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '验证结果（SUCCESS/NEUTRAL/FAIL/PENDING）',
  `outcome_detail` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '验证详情JSON',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `verified_at` datetime DEFAULT NULL COMMENT '验证时间',
  `verified_by` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '验证人',
  PRIMARY KEY (`id`),
  KEY `idx_asin_marketplace` (`asin`,`marketplace`),
  KEY `idx_decision_month` (`decision_month`),
  KEY `idx_decision_status` (`decision_status`),
  KEY `idx_outcome` (`outcome`),
  KEY `idx_selection_score` (`selection_score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选品决策记录表 — 反馈闭环核心，记录ASIN级选品决策快照和3月验证';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `selection_new_products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` varchar(50) NOT NULL COMMENT '产品ID（SKU）',
  `name` varchar(255) NOT NULL COMMENT '产品名称',
  `description` text COMMENT '产品描述',
  `category` varchar(100) DEFAULT NULL COMMENT '产品分类',
  `price` decimal(10,2) DEFAULT NULL COMMENT '产品价格',
  `image_path` varchar(500) DEFAULT NULL COMMENT '图片路径',
  `thumbnail_path` varchar(500) DEFAULT NULL COMMENT '缩略图路径',
  `status` varchar(20) DEFAULT 'active' COMMENT '状态（active/inactive）',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_id` (`product_id`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='选品新品表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `selection_operation_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` varchar(50) NOT NULL COMMENT '产品ID',
  `product_type` varchar(20) NOT NULL COMMENT '产品类型（new/reference）',
  `action` varchar(20) NOT NULL COMMENT '操作类型（delete/restore/permanent_delete）',
  `operator` varchar(50) NOT NULL DEFAULT 'system' COMMENT '操作人',
  `operation_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  `ip_address` varchar(50) DEFAULT NULL COMMENT '操作IP地址',
  `remarks` text COMMENT '备注信息',
  PRIMARY KEY (`id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_action` (`action`),
  KEY `idx_operation_time` (`operation_time`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='选品操作日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `selection_recycle_bin` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '回收记录ID',
  `product_id` int NOT NULL COMMENT '原产品ID',
  `asin` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '产品ASIN',
  `product_title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '商品标题',
  `price` decimal(10,2) DEFAULT NULL COMMENT '商品价格',
  `image_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '商品图片URL',
  `local_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '本地图片路径',
  `thumb_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '缩略图路径',
  `store_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '店铺名称',
  `store_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '店铺URL',
  `shop_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '店铺ID',
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '产品分类',
  `tags` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '产品标签列表（逗号分隔）',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '备注信息',
  `product_type` enum('new','reference','zheng') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new' COMMENT '产品类型：new(新品榜)/reference(竞品店铺)/zheng(郑总店铺)',
  `product_link` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '商品链接',
  `sales_volume` int DEFAULT NULL COMMENT '销量',
  `listing_date` date DEFAULT NULL COMMENT '上架时间',
  `listing_days` int DEFAULT NULL COMMENT '上架时间(天)',
  `delivery_method` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配送方式',
  `similar_products` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '相似商品',
  `source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源',
  `main_category_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '大类榜单名',
  `main_category_rank` int DEFAULT NULL COMMENT '榜单排名',
  `main_category_bsr_growth` decimal(10,2) DEFAULT NULL COMMENT '大类BSR增长数',
  `main_category_bsr_growth_rate` decimal(10,2) DEFAULT NULL COMMENT '大类BSR增长率',
  `deleted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '删除时间',
  `deleted_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '删除操作人',
  `restore_count` int DEFAULT '0' COMMENT '恢复次数',
  `country` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '国家（英国/德国）',
  `data_filter_mode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '数据筛选模式（模式一/模式二）',
  PRIMARY KEY (`id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_asin` (`asin`),
  KEY `idx_product_type` (`product_type`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `idx_recycle_country` (`country`),
  KEY `idx_recycle_data_filter_mode` (`data_filter_mode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选品回收站表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `selection_reference_products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` varchar(50) NOT NULL COMMENT '产品ID（SKU）',
  `name` varchar(255) NOT NULL COMMENT '产品名称',
  `description` text COMMENT '产品描述',
  `category` varchar(100) DEFAULT NULL COMMENT '产品分类',
  `price` decimal(10,2) DEFAULT NULL COMMENT '产品价格',
  `image_path` varchar(500) DEFAULT NULL COMMENT '图片路径',
  `thumbnail_path` varchar(500) DEFAULT NULL COMMENT '缩略图路径',
  `source` varchar(100) DEFAULT NULL COMMENT '来源（如：淘宝/京东/1688等）',
  `source_url` varchar(500) DEFAULT NULL COMMENT '来源链接',
  `status` varchar(20) DEFAULT 'active' COMMENT '状态（active/inactive）',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_id` (`product_id`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`),
  KEY `idx_source` (`source`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='选品参考商品表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `selection_stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stat_date` date NOT NULL,
  `total_products` int DEFAULT '0',
  `new_products` int DEFAULT '0',
  `reference_products` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stat_date` (`stat_date`),
  KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `selections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '????',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '????',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '????',
  `created_by` int NOT NULL COMMENT '???ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '????',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '????',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='???';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `seller_profiles` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `marketplace` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UK' COMMENT '站点',
  `month` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '数据月份',
  `seller_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '卖家名称',
  `is_dengzong` tinyint DEFAULT '0' COMMENT '是否郑总系（0/1）',
  `smart_score` decimal(8,2) DEFAULT NULL COMMENT '聪明分',
  `vision_score` decimal(8,2) DEFAULT NULL COMMENT '视野分',
  `new_success_rate` decimal(6,4) DEFAULT NULL COMMENT '新品成功率',
  `profit_percentile` decimal(6,4) DEFAULT NULL COMMENT '利润率百分位',
  `grade` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '评级别（S/A/B/C/D）',
  `archetype` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '擅长品类原型',
  `product_count` int DEFAULT '0' COMMENT '产品数',
  `new_product_count` int DEFAULT '0' COMMENT '新品数',
  `avg_units` decimal(10,2) DEFAULT NULL COMMENT '平均月销',
  `avg_bsr` int DEFAULT '0' COMMENT '平均BSR',
  `category_focus` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '主营品类',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_marketplace_month` (`marketplace`,`month`),
  KEY `idx_seller_name` (`seller_name`(64)),
  KEY `idx_grade` (`grade`),
  KEY `idx_archetype` (`archetype`),
  KEY `idx_smart_score` (`smart_score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='卖家画像表 — 跨品类卖家能力建模';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shops` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `shop_id` varchar(50) NOT NULL,
  `shop_name` varchar(255) DEFAULT NULL,
  `shop_link` varchar(512) DEFAULT NULL,
  `marketplace` varchar(10) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shop_id_marketplace` (`shop_id`,`marketplace`)
) ENGINE=InnoDB AUTO_INCREMENT=142833 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skip_asins` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `asin` varchar(20) NOT NULL,
  `title` varchar(1000) DEFAULT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `bsr` int DEFAULT NULL,
  `monthly_sales` int DEFAULT NULL,
  `listing_days` int DEFAULT NULL,
  `weight_g` decimal(10,2) DEFAULT NULL,
  `fulfillment` varchar(10) DEFAULT NULL,
  `seller_nation` varchar(10) DEFAULT NULL,
  `filter_reasons` text COMMENT 'è·³è¿‡åŽŸå› ',
  `marketplace` varchar(10) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asin_marketplace` (`asin`,`marketplace`)
) ENGINE=InnoDB AUTO_INCREMENT=2439184 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `store_ratings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `seller_name` varchar(200) NOT NULL,
  `marketplace` varchar(20) NOT NULL DEFAULT '',
  `rating_score` double DEFAULT NULL,
  `rating_grade` varchar(10) DEFAULT NULL,
  `best_match_seller` varchar(200) DEFAULT NULL,
  `best_match_score` double DEFAULT NULL,
  `product_count` int DEFAULT '0',
  `overall_score` double DEFAULT NULL,
  `match_score` double DEFAULT NULL,
  `rated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_seller_mp` (`seller_name`,`marketplace`)
) ENGINE=InnoDB AUTO_INCREMENT=436 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_platform` (`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subcategory_alias_map` (
  `id` bigint NOT NULL COMMENT 'Snowflake id',
  `source_type` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'WINNER or COMPETITOR',
  `marketplace` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ALL/UK/DE/US',
  `raw_subcategory` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Raw subcategory text',
  `normalized_subcategory` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Normalized subcategory text',
  `canonical_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Canonical key',
  `canonical_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Canonical display name',
  `carrier_hint` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Carrier hint from ??line',
  `sample_count` int NOT NULL DEFAULT '0' COMMENT 'Observed sample count',
  `latest_month` varchar(6) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Latest baseline month',
  `match_method` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING' COMMENT 'RAW/CATEGORY/CARRIER/MANUAL etc',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING' COMMENT 'APPROVED/PENDING/REJECTED',
  `notes` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Notes',
  `deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Logical delete flag',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Created at',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated at',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_alias` (`source_type`,`marketplace`,`raw_subcategory`,`deleted`),
  KEY `idx_status` (`source_type`,`status`,`marketplace`,`sample_count`),
  KEY `idx_canonical` (`canonical_key`,`marketplace`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Subcategory canonical alias map';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subcategory_baseline` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `marketplace` varchar(10) NOT NULL COMMENT 'Marketplace UK/DE/US',
  `bsr_id` varchar(100) NOT NULL COMMENT 'Top-level category slug, partitions the leaf so the same name in two big categories stays separate',
  `canonical_key` varchar(100) DEFAULT NULL COMMENT 'Canonical subcategory key',
  `sub_category` varchar(200) NOT NULL COMMENT 'Leaf subcategory label',
  `baseline_month` varchar(6) NOT NULL COMMENT 'Baseline month yyyyMM',
  `sample_size` int NOT NULL DEFAULT '0' COMMENT 'Sample size',
  `units_p50` int DEFAULT NULL COMMENT 'Units P50',
  `units_p75` int DEFAULT NULL COMMENT 'Units P75',
  `units_p90` int DEFAULT NULL COMMENT 'Units P90',
  `price_p50` decimal(10,2) DEFAULT NULL COMMENT 'Price P50',
  `confidence` varchar(8) DEFAULT NULL COMMENT 'Confidence high/mid/low',
  `computed_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Computed at',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slice` (`marketplace`,`bsr_id`,`sub_category`,`baseline_month`),
  KEY `idx_lookup` (`marketplace`,`bsr_id`,`baseline_month`),
  KEY `idx_sub_lookup` (`marketplace`,`sub_category`,`baseline_month`),
  KEY `idx_canonical_lookup` (`marketplace`,`canonical_key`,`baseline_month`)
) ENGINE=InnoDB AUTO_INCREMENT=258 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Line1 winner subcategory baseline';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_config` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `config_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '配置键',
  `config_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '配置值',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配置描述',
  `is_system` tinyint(1) DEFAULT '0' COMMENT '是否为系统配置',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system' COMMENT '更新人',
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_key` (`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=131 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_docs` (
  `id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `category` varchar(100) NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'product',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `update_records` (
  `id` varchar(36) NOT NULL,
  `date` date NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `implementation` text NOT NULL,
  `updateType` enum('success','info','warning','error') NOT NULL,
  `icon` varchar(100) DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_activity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `action` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `resource_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resource_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_filter_presets` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `preset_name` varchar(50) NOT NULL,
  `preset_index` tinyint NOT NULL,
  `is_default` tinyint DEFAULT '0',
  `filter_config` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_index` (`user_id`,`preset_index`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` varchar(50) NOT NULL COMMENT '用户名',
  `password` varchar(255) NOT NULL COMMENT '密码（加密）',
  `email` varchar(100) DEFAULT NULL COMMENT '邮箱',
  `full_name` varchar(100) DEFAULT NULL COMMENT '全名',
  `role` varchar(20) DEFAULT 'user' COMMENT '角色（admin:管理员, editor:编辑, user:普通用户）',
  `developer` varchar(100) DEFAULT NULL COMMENT '关联开发人',
  `status` tinyint(1) DEFAULT '1' COMMENT '状态（0:禁用, 1:启用）',
  `last_login_time` datetime DEFAULT NULL COMMENT '最后登录时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_username` (`username`),
  KEY `idx_email` (`email`),
  KEY `idx_role` (`role`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

