import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('content_work_item_task_link')
@Index('idx_content_work_item_task_link_work_item', ['work_item_id'])
@Index('idx_content_work_item_task_link_domain_task', ['task_domain', 'task_id'])
@Index('idx_content_work_item_task_link_current', [
  'work_item_id',
  'task_domain',
  'is_current',
])
export class ContentWorkItemTaskLinkEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: false,
    comment: 'content_work_item.id',
  })
  work_item_id: number;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: false,
    comment: '任务域：design/ai',
  })
  task_domain: 'design' | 'ai';

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: false,
    comment: '关联任务ID',
  })
  task_id: number;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: false,
    default: 'primary',
    comment: '关系类型：primary/delta/retry/merged',
  })
  relation_type: 'primary' | 'delta' | 'retry' | 'merged';

  @Column({
    type: 'tinyint',
    width: 1,
    nullable: false,
    default: 1,
    comment: '是否当前生效关系',
  })
  is_current: 0 | 1;

  @Column({
    type: 'datetime',
    nullable: true,
    default: null,
    comment: '关联开始时间',
  })
  started_at: Date | null;

  @Column({
    type: 'datetime',
    nullable: true,
    default: null,
    comment: '关联结束时间',
  })
  ended_at: Date | null;

  @CreateDateColumn({ precision: 6 })
  createTime: Date;
}
