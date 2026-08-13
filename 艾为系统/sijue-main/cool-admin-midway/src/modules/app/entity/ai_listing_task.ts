import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const AI_LISTING_TASK_TYPE = {
  SIMPLE_VARIANT: 'simple_variant',
  COMPLEX_VARIANT: 'complex_variant',
} as const;

export type AiListingTaskType =
  (typeof AI_LISTING_TASK_TYPE)[keyof typeof AI_LISTING_TASK_TYPE];

@Entity('ai_listing_task')
@Index('idx_ai_listing_task_target_key_created_at', [
  'target_key',
  'createTime',
])
@Index('idx_ai_listing_task_type_candidate_account_created_at', [
  'task_type',
  'target_candidate_id',
  'target_amazon_account_id',
  'createTime',
])
@Index('idx_ai_listing_task_status_next_retry_at', ['status', 'next_retry_at'])
@Index('idx_ai_listing_task_type_group_mode_id', [
  'task_type',
  'group_key',
  'task_mode',
  'id',
])
@Index('idx_ai_listing_task_root_mode_id', ['root_task_id', 'task_mode', 'id'])
export class AiListingTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: false,
    comment: '任务类型：simple_variant/complex_variant',
  })
  task_type: AiListingTaskType;

  @Column({
    type: 'int',
    nullable: false,
    comment: '选品主键（app_amz_bsr_candidate.id）',
  })
  target_candidate_id: number;

  @Column({
    type: 'varchar',
    length: 64,
    charset: 'utf8mb4',
    collation: 'utf8mb4_0900_ai_ci',
    nullable: true,
    default: null,
    comment: '亚马逊账号ID(simple_variant必填)',
  })
  target_amazon_account_id: string | null;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    default: null,
    comment: '变体ID(simple_variant调试器字段)',
  })
  target_variant_id: string | null;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    default: null,
    comment: '变体名称(simple_variant调试器字段)',
  })
  target_variant_name: string | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '变体ID集合(simple_variant)',
  })
  target_variant_ids: string[] | null;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    default: null,
    comment: 'MSKU(complex_variant预留)',
  })
  target_msku: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    comment: '标准化业务目标键',
  })
  target_key: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
    comment: '任务分组键：同候选+同账号+同国家',
  })
  group_key: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: false,
    default: 'full',
    comment: '任务模式：full/delta',
  })
  task_mode: 'full' | 'delta';

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: true,
    default: null,
    comment: '根任务ID（full任务自身，delta指向full）',
  })
  root_task_id: number | null;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: true,
    default: null,
    comment: '增量结果并入目标任务ID',
  })
  merge_into_task_id: number | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: false,
    default: '',
    comment: '触发人ID',
  })
  triggered_by: string;

  @Index('idx_ai_listing_task_idempotency_key')
  @Column({ type: 'varchar', length: 255, nullable: false, comment: '幂等键' })
  idempotency_key: string;

  @Column({
    type: 'int',
    nullable: false,
    default: 100,
    comment: '任务状态：100/110/120/190/200/210/290/300/390/900/990',
  })
  status: number;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: false,
    default: 'queued',
    comment: '阶段标识',
  })
  stage: string;

  @Column({
    type: 'int',
    nullable: false,
    default: 0,
    comment: '进度百分比 0-100',
  })
  progress_percent: number;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'AI任务时间线（独立于design_task）',
  })
  timeline: any[] | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    default: null,
    comment: 'Go评分服务任务ID',
  })
  go_task_id: string | null;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    default: null,
    comment: 'LangGraph运行ID',
  })
  langgraph_run_id: string | null;

  @Column({
    type: 'int',
    nullable: false,
    default: 0,
    comment: '关键词阶段已尝试次数',
  })
  score_attempt: number;

  @Column({
    type: 'int',
    nullable: false,
    default: 3,
    comment: '关键词阶段最大重试次数',
  })
  score_max_attempts: number;

  @Column({
    type: 'int',
    nullable: false,
    default: 0,
    comment: 'LangGraph阶段已尝试次数',
  })
  lang_attempt: number;

  @Column({
    type: 'int',
    nullable: false,
    default: 3,
    comment: 'LangGraph阶段最大重试次数',
  })
  lang_max_attempts: number;

  @Column({
    type: 'datetime',
    nullable: true,
    default: null,
    comment: '下一次可重试时间',
  })
  next_retry_at: Date | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    default: null,
    comment: '错误码',
  })
  last_error_code: string | null;

  @Column({ type: 'text', nullable: true, comment: '错误详情' })
  last_error_message: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    default: null,
    comment: '失败阶段',
  })
  failed_stage: string | null;

  @Column({
    type: 'datetime',
    nullable: true,
    default: null,
    comment: '开始时间',
  })
  started_at: Date | null;

  @Column({
    type: 'datetime',
    nullable: true,
    default: null,
    comment: '结束时间',
  })
  finished_at: Date | null;

  @Column({ type: 'json', nullable: true, comment: '关键词调研结果快照' })
  keyword_result: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, comment: 'LangGraph结果快照' })
  langgraph_result: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, comment: '任务流程中间态上下文' })
  flow_context: Record<string, any> | null;

  @CreateDateColumn({ precision: 6 })
  createTime: Date;

  @UpdateDateColumn({ precision: 6 })
  updateTime: Date;
}
