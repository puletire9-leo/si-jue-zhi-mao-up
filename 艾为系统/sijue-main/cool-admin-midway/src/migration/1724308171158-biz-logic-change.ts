import {MigrationInterface, QueryRunner} from "typeorm";
import {Provide} from "@midwayjs/decorator";

/**
 * 新增 BSR 榜单选品功能模块
 */
@Provide()
export class BizLogicChange1724308171158 implements MigrationInterface {
  name = 'BizLogicChange1724308171158'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE \`app_amz_bsr_candidate_competitor\` (
                \`id\` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
                \`createTime\` datetime(6) NOT NULL COMMENT '创建时间' DEFAULT CURRENT_TIMESTAMP(6),
                \`updateTime\` datetime(6) NOT NULL COMMENT '更新时间' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`candidate_id\` int NOT NULL COMMENT 'BSR 选品的 ID',
                \`asin_competitor\` varchar(255) NOT NULL COMMENT '竞品 ASIN',
                \`item_name\` varchar(255) NULL COMMENT '竞品标题',
                \`image_url\` varchar(255) NULL COMMENT '竞品主图地址',
                \`price\` double NULL COMMENT '价格',
                \`review_num\` int NULL COMMENT '评论数量',
                \`last_star\` float(2, 1) NULL COMMENT '星级评分',
                \`bsr_html\` varchar(10000) NULL COMMENT 'BSR 信息（直接从商品详情页面摘取的文字）',
                \`bsr_category\` varchar(255) NULL COMMENT 'BSR 类目',
                \`bsr_rank\` int NULL COMMENT 'BSR 排名' DEFAULT '0',
                \`dispatches_from\` varchar(255) NULL COMMENT '配送方',
                \`sold_by\` varchar(255) NULL COMMENT '售卖方',
                \`bullet_points\` text NULL COMMENT '五点描述',
                \`status\` tinyint NOT NULL COMMENT '状态 2-待入库 3-已入库 4-已归档' DEFAULT '2',
                \`spider_time\` datetime NULL COMMENT '产品信息爬虫的最近一次执行时间',
                \`daily_order_items\` int NULL COMMENT '日均单量',
                \`expected_volume\` int NULL COMMENT '预估销量',
                INDEX \`IDX_83b20d3f7a566091545ba93576\` (\`createTime\`),
                INDEX \`IDX_7c0a5a6ab607d955c634b6a6ab\` (\`updateTime\`),
                INDEX \`IDX_3753fcac41eab4c6d4b9f56f57\` (\`candidate_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
    await queryRunner.query(`
            CREATE TABLE \`app_amz_bsr_candidate\` (
                \`id\` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
                \`createTime\` datetime(6) NOT NULL COMMENT '创建时间' DEFAULT CURRENT_TIMESTAMP(6),
                \`updateTime\` datetime(6) NOT NULL COMMENT '更新时间' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`bsr_task_id\` int NOT NULL COMMENT 'BSR 爬虫任务的 id',
                \`asin\` varchar(255) NULL COMMENT 'ASIN',
                \`item_name\` varchar(255) NULL COMMENT '产品标题',
                \`image_url\` varchar(255) NULL COMMENT '主图链接',
                \`price\` double NULL COMMENT '价格',
                \`review_num\` int NULL COMMENT '评论数量',
                \`last_star\` float(2, 1) NULL COMMENT '星级评分',
                \`bsr_html\` varchar(10000) NULL COMMENT 'BSR 信息（直接从商品详情页面摘取的文字）',
                \`bsr_category\` varchar(255) NULL COMMENT 'BSR 类目',
                \`bsr_rank\` int NULL COMMENT 'BSR 排名' DEFAULT '0',
                \`dispatches_from\` varchar(255) NULL COMMENT '配送方',
                \`sold_by\` varchar(255) NULL COMMENT '售卖方',
                \`bullet_points\` text NULL COMMENT '五点描述',
                \`dimensions\` varchar(255) NULL COMMENT '尺寸',
                \`weight\` varchar(255) NULL COMMENT '重量',
                \`date_first_available\` datetime NULL COMMENT '上架时间',
                \`seller_country\` varchar(255) NULL COMMENT '卖家所属国家',
                \`selling_price\` double(10, 2) NULL COMMENT '售价',
                \`dimensional_weight\` double(5, 2) NULL COMMENT '抛重',
                \`actual_weight\` double(5, 2) NULL COMMENT '实重',
                \`first_leg_freight\` double(5, 2) NULL COMMENT '头程运费',
                \`is_fba\` tinyint NOT NULL COMMENT 'FBA 配送 0-否 1-是' DEFAULT '0',
                \`tax_rate\` double(5, 2) NULL COMMENT '税率',
                \`gross_profit_rate\` double(5, 2) NULL COMMENT '毛利率',
                \`gross_profit\` double(10, 2) NULL COMMENT '毛利润',
                \`patent_memo\` text NULL COMMENT '专利情况',
                \`opinion_dev\` text NULL COMMENT '开发意见',
                \`opinion_operator\` text NULL COMMENT '运营意见',
                \`opinion_procurement\` text NULL COMMENT '采购意见',
                \`status\` tinyint NOT NULL COMMENT '状态 2-待入库 3-已入库 4-已归档' DEFAULT '2',
                \`competitor_spider_status\` tinyint NOT NULL COMMENT '竞品调研状态 0-待调研 1-调研中 2-已调研' DEFAULT '0',
                \`competitor_spider_res\` json NULL COMMENT '竞品爬虫结果',
                \`competitor_spider_time\` datetime NULL COMMENT '竞品爬虫的最近一次执行时间',
                INDEX \`IDX_a61893baccd60f9545a73cc0fb\` (\`createTime\`),
                INDEX \`IDX_a9820f90b8311b25e14f359c08\` (\`updateTime\`),
                INDEX \`IDX_59279584fc7146daf9166c07b8\` (\`bsr_task_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
    await queryRunner.query(`
            CREATE TABLE \`app_amz_bsr_task\` (
                \`id\` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
                \`createTime\` datetime(6) NOT NULL COMMENT '创建时间' DEFAULT CURRENT_TIMESTAMP(6),
                \`updateTime\` datetime(6) NOT NULL COMMENT '更新时间' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`bsr_link\` varchar(255) NOT NULL COMMENT 'BSR 的 URL 链接',
                \`marketplace\` varchar(20) NOT NULL COMMENT '国家',
                \`category\` text NULL COMMENT '榜单所属类目',
                \`remark\` text NULL COMMENT '备注',
                \`price_min\` decimal(10, 2) NULL COMMENT '价格最小值',
                \`price_max\` double(10, 2) NULL COMMENT '价格最大值',
                \`review_min\` int NULL COMMENT '评论数最小值',
                \`review_max\` int NULL COMMENT '评论数最大值',
                \`last_star_min\` double(10, 2) NULL COMMENT '评价星级最小值',
                \`weight_min\` decimal(10, 2) NULL COMMENT '重量最小值',
                \`weight_max\` decimal(10, 2) NULL COMMENT '重量最大值',
                \`bsr_rank_max\` int NULL COMMENT '类目排名（不低于）',
                \`delivery_type\` tinyint NULL COMMENT '配送方式 0-⾃营 1-FBA 2-FBM' DEFAULT '0',
                \`date_first_available\` datetime NULL COMMENT '上架时间',
                \`seller_countries\` json NULL COMMENT '卖家所属国家',
                \`status\` tinyint NOT NULL COMMENT '任务状态 0-待执⾏ 1-调研中 2-已完成 102-爬虫中' DEFAULT '0',
                \`spider_res\` json NULL COMMENT '爬虫结果',
                INDEX \`IDX_179c6a957028d2118f9b568827\` (\`createTime\`),
                INDEX \`IDX_465e8b29d72de4ec31991fa948\` (\`updateTime\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX \`IDX_465e8b29d72de4ec31991fa948\` ON \`app_amz_bsr_task\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_179c6a957028d2118f9b568827\` ON \`app_amz_bsr_task\`
        `);
    await queryRunner.query(`
            DROP TABLE \`app_amz_bsr_task\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_59279584fc7146daf9166c07b8\` ON \`app_amz_bsr_candidate\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_a9820f90b8311b25e14f359c08\` ON \`app_amz_bsr_candidate\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_a61893baccd60f9545a73cc0fb\` ON \`app_amz_bsr_candidate\`
        `);
    await queryRunner.query(`
            DROP TABLE \`app_amz_bsr_candidate\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_3753fcac41eab4c6d4b9f56f57\` ON \`app_amz_bsr_candidate_competitor\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_7c0a5a6ab607d955c634b6a6ab\` ON \`app_amz_bsr_candidate_competitor\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_83b20d3f7a566091545ba93576\` ON \`app_amz_bsr_candidate_competitor\`
        `);
    await queryRunner.query(`
            DROP TABLE \`app_amz_bsr_candidate_competitor\`
        `);
  }

}
