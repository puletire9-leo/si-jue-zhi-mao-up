import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ai_chat_message')
export class AiChatMessageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_session_id_createTime')
  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: false,
    comment: '会话ID ai_chat_session.id',
  })
  session_id: number;

  @Index('idx_task_id_createTime')
  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: true,
    default: null,
    comment: '设计任务ID（若有）',
  })
  task_id: number | null;

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
    length: 16,
    nullable: false,
    default: 'user',
    comment: '角色: system/user/assistant/tool',
  })
  role: string;

  @Column({ type: 'longtext', nullable: false, comment: '消息内容' })
  content: string;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: false,
    default: 'done',
    comment: '消息状态: streaming/done/error',
  })
  status: string;

  @Column({ type: 'json', nullable: true, comment: 'token 用量快照' })
  token_usage: Record<string, any> | null;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: true,
    default: null,
    comment: '回复消息ID',
  })
  reply_to: number | null;

  @Column({ type: 'json', nullable: true, comment: '扩展信息（如@引用解析）' })
  extra_json: Record<string, any> | null;

  @CreateDateColumn({ precision: 6 })
  createTime: Date;
}
