import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('app_amz_bsr_candidate_factory_link')
export class AppAmzBsrCandidateFactoryLinkEntity {
  @PrimaryColumn({ comment: 'UUID', length: 36 })
  id: string;

  @Index()
  @Column({ comment: '选品 id', type: 'int' })
  candidate_id: number;

  @Column({ comment: '品名', length: 200, default: '' })
  name: string;

  @Column({ comment: '类型 main/accessory/packing', length: 32, default: 'main' })
  type: string;

  @Column({ comment: '价格', type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ comment: '链接 URL', length: 512, default: '' })
  user_input: string;

  @Column({ comment: '链接描述', length: 512, default: '' })
  user_input_description: string;

  @Column({ comment: '产品 SKU', length: 64, nullable: true })
  product_sku: string | null;

  @Column({ comment: '供应商 SKU', length: 64, nullable: true })
  supplier_sku: string | null;

  @Column({ comment: '产品名称', length: 255, nullable: true })
  product_name: string | null;

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
