import { Column, CreateDateColumn, Entity, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('app_amz_msku')
@Unique(['candidate_id', 'seller_account_id', 'selected_variant'])
export class AppAmzMskuEntity {
  @PrimaryColumn({ comment: 'MSKU 业务编号', length: 128 })
  msku: string;

  @Column({
    comment: '上架 SKU（运营填写，空则上架时用系统 MSKU）',
    length: 40,
    nullable: true,
  })
  seller_sku: string | null;

  @Column({ comment: '选品ID', length: 64, nullable: true })
  candidate_id: string;

  @Column({ comment: '选品名称', length: 200, nullable: true })
  candidate_name: string;

  @Column({ comment: '店铺账号 id', length: 64, nullable: true })
  seller_account_id: string;

  @Column({ comment: '店铺账户名称', length: 255, nullable: true })
  account_name: string;

  @Column({ comment: '变体名称', length: 255, nullable: true })
  selected_variant: string;

  @Column({ comment: '变体 id（app_amz_bsr_candidate_variant.id）', length: 36, nullable: true })
  selected_variant_id: string | null;

  @Column({ comment: '第一次入库时的提交人用户ID', length: 64, nullable: true })
  submitter_user_id: string | null;

  @Column({ comment: '第一次入库时的提交人名称', length: 128, nullable: true })
  submitter_name: string | null;

  @CreateDateColumn({ precision: 6 })
  createTime: Date;

  @UpdateDateColumn({ precision: 6 })
  updateTime: Date;
}
