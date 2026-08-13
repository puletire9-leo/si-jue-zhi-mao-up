import { MigrationInterface, QueryRunner } from 'typeorm';
import { Provide } from '@midwayjs/decorator';

/**
 * 合并迁移（从未在线上执行过）：
 * - ai_chat_session / ai_chat_message
 * - ai_listing_task（含 group_key、task_mode、hotfix 索引）
 * - content_work_item / content_work_item_task_link（含 listing/upload 状态）
 */
@Provide()
export class AiChatListingContentWorkbench1767000000000
  implements MigrationInterface
{
  name = 'AiChatListingContentWorkbench1767000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ai_chat_session\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`task_id\` bigint unsigned DEFAULT NULL COMMENT '设计任务ID（若有）',
        \`task_key\` varchar(64) NOT NULL DEFAULT '' COMMENT '任务键（如 lac-001）',
        \`module\` varchar(32) NOT NULL DEFAULT 'listing_ai_copy' COMMENT '业务模块',
        \`title\` varchar(255) NOT NULL DEFAULT '' COMMENT '会话标题',
        \`model_provider\` varchar(32) NOT NULL DEFAULT 'openai' COMMENT '模型提供商',
        \`model_name\` varchar(128) NOT NULL DEFAULT '' COMMENT '模型名',
        \`created_by\` varchar(64) NOT NULL DEFAULT '' COMMENT '创建者（admin.userId）',
        \`last_message_at\` datetime DEFAULT NULL COMMENT '最后消息时间',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_task_module_user\` (\`task_key\`, \`module\`, \`created_by\`),
        KEY \`idx_task_id\` (\`task_id\`),
        KEY \`idx_task_key\` (\`task_key\`),
        KEY \`idx_created_by\` (\`created_by\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 对话会话'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ai_chat_message\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`session_id\` bigint unsigned NOT NULL COMMENT '会话ID ai_chat_session.id',
        \`task_id\` bigint unsigned DEFAULT NULL COMMENT '设计任务ID（若有）',
        \`task_key\` varchar(64) NOT NULL DEFAULT '' COMMENT '任务键（如 lac-001）',
        \`role\` varchar(16) NOT NULL DEFAULT 'user' COMMENT '角色: system/user/assistant/tool',
        \`content\` longtext NOT NULL COMMENT '消息内容',
        \`status\` varchar(16) NOT NULL DEFAULT 'done' COMMENT '消息状态: streaming/done/error',
        \`token_usage\` json DEFAULT NULL COMMENT 'token 用量快照',
        \`reply_to\` bigint unsigned DEFAULT NULL COMMENT '回复消息ID',
        \`extra_json\` json DEFAULT NULL COMMENT '扩展信息（如@引用解析）',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`idx_session_id_createTime\` (\`session_id\`, \`createTime\`),
        KEY \`idx_task_id_createTime\` (\`task_id\`, \`createTime\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 对话消息'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ai_listing_task\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`task_type\` varchar(32) NOT NULL COMMENT '任务类型：simple_variant/complex_variant',
        \`target_candidate_id\` int NOT NULL COMMENT '选品主键（app_amz_bsr_candidate.id）',
        \`target_amazon_account_id\` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '亚马逊账号ID(simple_variant必填)',
        \`target_variant_id\` varchar(36) DEFAULT NULL COMMENT '变体ID(simple_variant调试器字段)',
        \`target_variant_name\` varchar(200) DEFAULT NULL COMMENT '变体名称(simple_variant调试器字段)',
        \`target_variant_ids\` json DEFAULT NULL COMMENT '变体ID集合(simple_variant)',
        \`target_msku\` varchar(128) DEFAULT NULL COMMENT 'MSKU(complex_variant预留)',
        \`target_key\` varchar(255) NOT NULL COMMENT '标准化业务目标键',
        \`group_key\` varchar(255) DEFAULT NULL COMMENT '任务分组键：同候选+同账号+同国家',
        \`task_mode\` varchar(16) NOT NULL DEFAULT 'full' COMMENT '任务模式：full/delta',
        \`root_task_id\` bigint unsigned DEFAULT NULL COMMENT '根任务ID（full任务自身，delta指向full）',
        \`merge_into_task_id\` bigint unsigned DEFAULT NULL COMMENT '增量结果并入目标任务ID',
        \`triggered_by\` varchar(64) NOT NULL DEFAULT '' COMMENT '触发人ID',
        \`idempotency_key\` varchar(255) NOT NULL COMMENT '幂等键',
        \`status\` int NOT NULL DEFAULT 100 COMMENT '任务状态：100/110/120/190/200/210/290/300/390/900/990',
        \`stage\` varchar(64) NOT NULL DEFAULT 'queued' COMMENT '阶段标识',
        \`progress_percent\` int NOT NULL DEFAULT 0 COMMENT '进度百分比 0-100',
        \`timeline\` json DEFAULT NULL COMMENT 'AI任务时间线（独立于design_task）',
        \`go_task_id\` varchar(64) DEFAULT NULL COMMENT 'Go评分服务任务ID',
        \`langgraph_run_id\` varchar(128) DEFAULT NULL COMMENT 'LangGraph运行ID',
        \`score_attempt\` int NOT NULL DEFAULT 0 COMMENT '关键词阶段已尝试次数',
        \`score_max_attempts\` int NOT NULL DEFAULT 3 COMMENT '关键词阶段最大重试次数',
        \`lang_attempt\` int NOT NULL DEFAULT 0 COMMENT 'LangGraph阶段已尝试次数',
        \`lang_max_attempts\` int NOT NULL DEFAULT 3 COMMENT 'LangGraph阶段最大重试次数',
        \`next_retry_at\` datetime DEFAULT NULL COMMENT '下一次可重试时间',
        \`last_error_code\` varchar(64) DEFAULT NULL COMMENT '错误码',
        \`last_error_message\` text COMMENT '错误详情',
        \`failed_stage\` varchar(64) DEFAULT NULL COMMENT '失败阶段',
        \`started_at\` datetime DEFAULT NULL COMMENT '开始时间',
        \`finished_at\` datetime DEFAULT NULL COMMENT '结束时间',
        \`keyword_result\` json DEFAULT NULL COMMENT '关键词调研结果快照',
        \`langgraph_result\` json DEFAULT NULL COMMENT 'LangGraph结果快照',
        \`flow_context\` json DEFAULT NULL COMMENT '任务流程中间态上下文',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`idx_ai_listing_task_idempotency_key\` (\`idempotency_key\`),
        KEY \`idx_ai_listing_task_target_key_created_at\` (\`target_key\`, \`createTime\`),
        KEY \`idx_ai_listing_task_status_next_retry_at\` (\`status\`, \`next_retry_at\`),
        KEY \`idx_ai_listing_task_type_candidate_account_created_at\` (\`task_type\`, \`target_candidate_id\`, \`target_amazon_account_id\`, \`createTime\`),
        KEY \`idx_ai_listing_task_group_key_created_at\` (\`group_key\`, \`createTime\`),
        KEY \`idx_ai_listing_task_root_task_id\` (\`root_task_id\`),
        KEY \`idx_ai_listing_task_type_group_mode_id\` (\`task_type\`, \`group_key\`, \`task_mode\`, \`id\`),
        KEY \`idx_ai_listing_task_root_mode_id\` (\`root_task_id\`, \`task_mode\`, \`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI Listing任务主表'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`content_work_item\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`candidate_id\` int NOT NULL COMMENT '选品ID(app_amz_bsr_candidate.id)',
        \`sku\` varchar(128) NOT NULL DEFAULT '' COMMENT '选品SKU',
        \`msku\` varchar(128) NOT NULL DEFAULT '' COMMENT 'MSKU',
        \`seller_account_id\` varchar(64) NOT NULL DEFAULT '' COMMENT '亚马逊账号ID',
        \`country_code\` varchar(16) NOT NULL DEFAULT 'uk' COMMENT '国家代码',
        \`group_key\` varchar(255) NOT NULL DEFAULT '' COMMENT '任务分组键（候选+账号+国家）',
        \`status\` varchar(32) NOT NULL DEFAULT 'running' COMMENT '聚合状态：pending/running/done/failed/cancelled/blocked',
        \`stage\` varchar(64) NOT NULL DEFAULT 'queued' COMMENT '聚合阶段',
        \`listing_status\` varchar(16) NOT NULL DEFAULT 'todo' COMMENT '刊登节点状态：todo/done',
        \`listing_finished_at\` datetime DEFAULT NULL COMMENT '刊登完成时间',
        \`upload_status\` varchar(16) NOT NULL DEFAULT 'todo' COMMENT '图片上传节点状态：todo/done',
        \`upload_finished_at\` datetime DEFAULT NULL COMMENT '图片上传完成时间',
        \`current_design_task_id\` bigint unsigned DEFAULT NULL COMMENT '当前生效图需任务ID',
        \`current_ai_task_id\` bigint unsigned DEFAULT NULL COMMENT '当前生效文案任务ID',
        \`created_by\` varchar(64) DEFAULT NULL COMMENT '创建人ID',
        \`meta\` json DEFAULT NULL COMMENT '补充信息快照',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_content_work_item_scope\` (\`candidate_id\`,\`msku\`,\`seller_account_id\`,\`country_code\`),
        KEY \`idx_content_work_item_group_key\` (\`group_key\`),
        KEY \`idx_content_work_item_status_stage\` (\`status\`,\`stage\`),
        KEY \`idx_content_work_item_candidate\` (\`candidate_id\`),
        KEY \`idx_content_work_item_listing_upload\` (\`listing_status\`, \`upload_status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`content_work_item_task_link\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`work_item_id\` bigint unsigned NOT NULL COMMENT 'content_work_item.id',
        \`task_domain\` varchar(16) NOT NULL COMMENT '任务域：design/ai',
        \`task_id\` bigint unsigned NOT NULL COMMENT '关联任务ID',
        \`relation_type\` varchar(16) NOT NULL DEFAULT 'primary' COMMENT '关系类型：primary/delta/retry/merged',
        \`is_current\` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否当前生效关系',
        \`started_at\` datetime DEFAULT NULL COMMENT '关联开始时间',
        \`ended_at\` datetime DEFAULT NULL COMMENT '关联结束时间',
        \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`idx_content_work_item_task_link_work_item\` (\`work_item_id\`),
        KEY \`idx_content_work_item_task_link_domain_task\` (\`task_domain\`,\`task_id\`),
        KEY \`idx_content_work_item_task_link_current\` (\`work_item_id\`,\`task_domain\`,\`is_current\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE IF EXISTS `content_work_item_task_link`'
    );
    await queryRunner.query('DROP TABLE IF EXISTS `content_work_item`');
    await queryRunner.query('DROP TABLE IF EXISTS `ai_listing_task`');
    await queryRunner.query('DROP TABLE IF EXISTS `ai_chat_message`');
    await queryRunner.query('DROP TABLE IF EXISTS `ai_chat_session`');
  }
}
