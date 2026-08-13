import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 图需-多语言图注/文案，对应 design_task_picture_caption
 */
@Entity('design_task_picture_caption')
export class DesignTaskPictureCaptionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_picture_id')
  @Column({ type: 'bigint', unsigned: true, nullable: false, comment: 'design_task_picture.id' })
  picture_id: number;

  @Column({ type: 'text', nullable: true, comment: '原图文案（第一步从参考图抽取的原文，换说法前）' })
  raw_text: string | null;

  @Column({ type: 'text', nullable: true, comment: '换说法后的原文；仅当该条被换说法时有值，否则为空' })
  raw_after_rephrase: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, comment: '文案类型：title/subtitle/bullet/detail_desc/product_spec/section_title/section_desc/step/label_badge/other' })
  role: string | null;

  @Column({ type: 'text', nullable: true, comment: '中文案' })
  zh: string | null;

  @Column({ type: 'text', nullable: true, comment: 'UK 文案' })
  uk: string | null;

  @Column({ type: 'text', nullable: true, comment: 'DE 文案' })
  de: string | null;

  @Column({ type: 'text', nullable: true, comment: 'FR 文案' })
  fr: string | null;

  @Column({ type: 'text', nullable: true, comment: 'IT 文案' })
  it: string | null;

  @Column({ type: 'text', nullable: true, comment: 'ES 文案' })
  es: string | null;

  @CreateDateColumn({ precision: 6 })
  createTime: Date;

  @UpdateDateColumn({ precision: 6 })
  updateTime: Date;
}

