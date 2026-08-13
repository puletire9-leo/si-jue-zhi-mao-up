import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('app_amz_bsr_deduplicate')
export class AppAmzBsrDeduplicateEntity {
  @PrimaryColumn({ 
    comment: 'ASIN唯一标识',
    length: 50
  })
  asin: string;

  @Column({ 
    comment: '数据来源',
    type: 'enum',
    enum: ['candidate', 'competitor', 'lingxing'], // 第三个来源待确认
    default: 'candidate'
  })
  source: string;

  @CreateDateColumn({ comment: '创建时间' })
  create_time: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  update_time: Date;
}