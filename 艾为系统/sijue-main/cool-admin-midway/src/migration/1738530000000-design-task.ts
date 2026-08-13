import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';

/**
 * 美工任务相关表：仅关联 BSR 选品（candidate_id），变体与工厂链接从 app_amz_bsr_candidate 的 JSON 字段读取
 */
@Provide()
export class DesignTask1738520000000 implements MigrationInterface {
  name = 'DesignTask1738520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 美工任务主表（关联 BSR 选品）
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`design_task\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`candidate_id\` int NOT NULL COMMENT 'BSR 选品 id，关联 app_amz_bsr_candidate.id',
        \`status\` int NOT NULL DEFAULT 101 COMMENT '任务状态：101-待选参考图/102-AI生成图需中/103-待审核/201-待摄影领取/202-拍摄中/301-待美工领取/302-美工做图中/401-待上传/500-已完成',
        \`designer_upload_path\` varchar(512) NOT NULL DEFAULT '' COMMENT '美工上传路径',
        \`photographer_upload_path\` varchar(512) NOT NULL DEFAULT '' COMMENT '摄影上传路径',
        \`shooter_id\` varchar(64) DEFAULT NULL COMMENT '摄影领取人ID',
        \`shooter_name\` varchar(64) DEFAULT NULL COMMENT '摄影领取人',
        \`designer_id\` varchar(64) DEFAULT NULL COMMENT '美工领取人ID',
        \`designer_name\` varchar(64) DEFAULT NULL COMMENT '美工领取人',
        \`ai_task_id\` bigint unsigned DEFAULT NULL COMMENT 'AI图需任务ID(task_info.id)',
        \`main_image\` varchar(512) NOT NULL DEFAULT '' COMMENT '主图 URL',
        \`timeline\` json DEFAULT NULL COMMENT '时间线/进度记录，结构预留',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`idx_candidate_id\` (\`candidate_id\`),
        KEY \`idx_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='美工任务主表'
    `);

    // 2. 图需表（任务下的图片位/图需；可选关联 MSKU／店铺(seller_id)／变体 等不同层级）
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`design_task_picture\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`task_id\` bigint unsigned NOT NULL COMMENT 'design_task.id',
        \`label\` varchar(32) NOT NULL COMMENT '编号，如 1-1、1-2，任务内唯一',
        \`type\` varchar(32) NOT NULL DEFAULT '' COMMENT '类型：主图、场景图、多场景图、尺寸图、对比图、模特图、配件图、细节图、多细节图',
        \`msku\` varchar(128) DEFAULT NULL COMMENT '关联的 MSKU 业务编号，空表示不关联；关联时通过 app_amz_msku 可查变体、提交人、店铺等',
        \`seller_id\` varchar(64) DEFAULT NULL COMMENT '店铺层级关联时使用（不绑定具体 MSKU），对应 seller_id',
        \`variant_id\` varchar(36) DEFAULT NULL COMMENT '变体 id（app_amz_bsr_candidate_variant.id，变体层级关联时使用）',
        \`variant_desc\` text DEFAULT NULL COMMENT '变体描述冗余字段',
        \`submitter\` varchar(64) DEFAULT NULL COMMENT '提交人冗余字段（第一次生成图片位时填充，后续不改）',
        \`reference_image\` varchar(512) NOT NULL DEFAULT '' COMMENT '参考图 URL',
        \`requirements\` text DEFAULT NULL COMMENT '图需描述文字',
        \`reviewed\` tinyint(1) NOT NULL DEFAULT 0 COMMENT '已审核',
        \`photographed\` tinyint(1) NOT NULL DEFAULT 0 COMMENT '已拍摄',
        \`design_done\` tinyint(1) NOT NULL DEFAULT 0 COMMENT '已做图',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_task_label\` (\`task_id\`, \`label\`),
        KEY \`idx_task_id\` (\`task_id\`),
        KEY \`idx_msku\` (\`msku\`),
        KEY \`idx_seller_id\` (\`seller_id\`),
        KEY \`idx_variant_id\` (\`variant_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='美工任务-图需'
    `);

    // 3. 图需图注/文案（多语言）
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`design_task_picture_caption\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`picture_id\` bigint unsigned NOT NULL COMMENT 'design_task_picture.id',
        \`raw_text\` text COMMENT '原图文案（第一步从参考图抽取的原文，换说法前）',
        \`raw_after_rephrase\` text COMMENT '换说法后的原文；仅当该条被换说法时有值，否则为空',
        \`role\` varchar(32) DEFAULT NULL COMMENT '文案类型：title/subtitle/bullet/detail_desc/product_spec/section_title/section_desc/step/label_badge/other',
        \`zh\` text COMMENT '中文案',
        \`uk\` text COMMENT 'UK 文案',
        \`de\` text COMMENT 'DE 文案',
        \`fr\` text COMMENT 'FR 文案',
        \`it\` text COMMENT 'IT 文案',
        \`es\` text COMMENT 'ES 文案',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`idx_picture_id\` (\`picture_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图需-多语言图注/文案'
    `);

    // 4. 上传任务表（按 MSKU 拆分，美工点击完成时落表）
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`design_upload_task\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`design_task_id\` bigint unsigned NOT NULL COMMENT 'design_task.id',
        \`msku\` varchar(128) NOT NULL COMMENT 'MSKU 业务编号',
        \`status\` int NOT NULL DEFAULT 401 COMMENT '401-待上传 500-已完成',
        \`list_image\` varchar(512) NOT NULL DEFAULT '' COMMENT '列表展示用：该 MSKU 主图对应的竞品参考图 URL',
        \`final_shop\` varchar(255) NOT NULL DEFAULT '' COMMENT '最终上传店铺记录',
        \`timeline\` json DEFAULT NULL COMMENT '时间线',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_design_task_msku\` (\`design_task_id\`, \`msku\`),
        KEY \`idx_design_task_id\` (\`design_task_id\`),
        KEY \`idx_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='上传任务（按 MSKU）'
    `);

    // 5. 上传任务-图片标记（该 MSKU 下哪些图已标记上传，仅用于记录未传列表）
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`design_upload_task_picture\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`upload_task_id\` bigint unsigned NOT NULL COMMENT 'design_upload_task.id',
        \`picture_id\` bigint unsigned NOT NULL COMMENT 'design_task_picture.id',
        \`uploaded\` tinyint(1) NOT NULL DEFAULT 0 COMMENT '用户标记是否已传',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_upload_task_picture\` (\`upload_task_id\`, \`picture_id\`),
        KEY \`idx_upload_task_id\` (\`upload_task_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='上传任务-图片上传标记'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`design_upload_task_picture\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`design_upload_task\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`design_task_picture_caption\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`design_task_picture\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`design_task\``);
  }
}
