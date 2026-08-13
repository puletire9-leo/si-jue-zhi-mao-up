import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('app_amz_bsr_candidate_variant')
export class AppAmzBsrCandidateVariantEntity {
  @PrimaryColumn({ comment: 'UUID', length: 36 })
  id: string;

  @Index()
  @Column({ comment: '选品 id', type: 'int' })
  candidate_id: number;

  @Column({ comment: '变体名称', length: 200, default: '' })
  name: string;

  @Column({ comment: '变体描述', type: 'text', nullable: true })
  description: string | null;

  @Column({ comment: '采购数量', type: 'int', default: 0 })
  quantity: number;

  @Column({ comment: '工厂链接配比 {factory_link_id: proportion}', type: 'json', nullable: true })
  group_proportions: Record<string, number> | null;

  @Column({ comment: '英国标题', length: 500, nullable: true })
  uk_title: string | null;

  @Column({ comment: '德国标题', length: 500, nullable: true })
  de_title: string | null;

  @Column({ comment: '变体图片', type: 'longtext', nullable: true })
  image_url: string | null;

  @Column({ comment: '领星SKU', length: 64, nullable: true })
  sku: string | null;

  @Column({ comment: '排序', type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ precision: 6 })
  createTime: Date;

  @UpdateDateColumn({ precision: 6 })
  updateTime: Date;

  @Index()
  @Column({ comment: '软删除时间', type: 'datetime', precision: 6, nullable: true })
  deleted_at: Date | null;
}
