import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ai_chat_session')
@Unique('uk_task_module_user', ['task_key', 'module', 'created_by'])
export class AiChatSessionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_task_id')
  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: true,
    default: null,
    comment: '设计任务ID（若有）',
  })
  task_id: number | null;

  @Index('idx_task_key')
  @Column({
    type: 'varchar',
    length: 64,
    nullable: false,
    default: '',
    comment: '任务键（如 lac-001）',
  })
  task_key: string;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: false,
    default: 'listing_ai_copy',
    comment: '业务模块',
  })
  module: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    default: '',
    comment: '会话标题',
  })
  title: string;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: false,
    default: 'openai',
    comment: '模型提供商',
  })
  model_provider: string;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: false,
    default: '',
    comment: '模型名',
  })
  model_name: string;

  @Index('idx_created_by')
  @Column({
    type: 'varchar',
    length: 64,
    nullable: false,
    default: '',
    comment: '创建者（admin.userId）',
  })
  created_by: string;

  @Column({
    type: 'datetime',
    nullable: true,
    default: null,
    comment: '最后消息时间',
  })
  last_message_at: Date | null;

  @CreateDateColumn({ precision: 6 })
  createTime: Date;

  @UpdateDateColumn({ precision: 6 })
  updateTime: Date;
}
