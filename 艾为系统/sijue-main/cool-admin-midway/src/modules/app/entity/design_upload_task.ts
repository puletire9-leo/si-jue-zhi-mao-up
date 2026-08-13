import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

/**
 * 上传任务（按 MSKU），美工点击完成时按主图 MSKU 列表落表
 */
@Entity('design_upload_task')
@Unique('uk_design_task_msku', ['design_task_id', 'msku'])
export class DesignUploadTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_design_task_id')
  @Column({ type: 'bigint', unsigned: true, nullable: false, comment: 'design_task.id' })
  design_task_id: number;

  @Column({ type: 'varchar', length: 128, nullable: false, comment: 'MSKU 业务编号' })
  msku: string;

  @Index('idx_status')
  @Column({ type: 'int', nullable: false, default: 401, comment: '401-待上传 500-已完成' })
  status: number;

  @Column({ type: 'varchar', length: 512, nullable: false, default: '', comment: '列表展示：该 MSKU 主图对应的竞品参考图 URL' })
  list_image: string;

  @Column({ type: 'varchar', length: 64, nullable: false, default: '', comment: '最终上传店铺账号 id（seller_account_id）' })
  final_account: string;

  @Column({ type: 'json', nullable: true, comment: '时间线' })
  timeline: any | null;

  @CreateDateColumn({ precision: 6 })
  createTime: Date;

  @UpdateDateColumn({ precision: 6 })
  updateTime: Date;
}
