import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('content_work_item')
@Index('uk_content_work_item_scope', [
  'candidate_id',
  'msku',
  'seller_account_id',
  'country_code',
], { unique: true })
@Index('idx_content_work_item_group_key', ['group_key'])
@Index('idx_content_work_item_status_stage', ['status', 'stage'])
@Index('idx_content_work_item_candidate', ['candidate_id'])
export class ContentWorkItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({
    type: 'int',
    nullable: false,
    comment: '选品ID(app_amz_bsr_candidate.id)',
  })
  candidate_id: number;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: false,
    default: '',
    comment: '选品SKU',
  })
  sku: string;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: false,
    default: '',
    comment: 'MSKU',
  })
  msku: string;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: false,
    default: '',
    comment: '亚马逊账号ID',
  })
  seller_account_id: string;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: false,
    default: 'uk',
    comment: '国家代码',
  })
  country_code: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    default: '',
    comment: '任务分组键（候选+账号+国家）',
  })
  group_key: string;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: false,
    default: 'running',
    comment: '聚合状态：pending/running/done/failed/cancelled/blocked',
  })
  status: string;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: false,
    default: 'queued',
    comment: '聚合阶段',
  })
  stage: string;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: false,
    default: 'todo',
    comment: '刊登节点状态：todo/done',
  })
  listing_status: 'todo' | 'done';

  @Column({
    type: 'datetime',
    nullable: true,
    default: null,
    comment: '刊登完成时间',
  })
  listing_finished_at: Date | null;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: false,
    default: 'todo',
    comment: '图片上传节点状态：todo/done',
  })
  upload_status: 'todo' | 'done';

  @Column({
    type: 'datetime',
    nullable: true,
    default: null,
    comment: '图片上传完成时间',
  })
  upload_finished_at: Date | null;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: true,
    default: null,
    comment: '当前生效图需任务ID',
  })
  current_design_task_id: number | null;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: true,
    default: null,
    comment: '当前生效文案任务ID',
  })
  current_ai_task_id: number | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    default: null,
    comment: '创建人ID',
  })
  created_by: string | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '补充信息快照',
  })
  meta: Record<string, any> | null;

  @CreateDateColumn({ precision: 6 })
  createTime: Date;

  @UpdateDateColumn({ precision: 6 })
  updateTime: Date;
}
