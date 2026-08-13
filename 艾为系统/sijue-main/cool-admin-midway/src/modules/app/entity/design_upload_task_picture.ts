import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

/**
 * 上传任务-图片上传标记（该 MSKU 下哪些图已标记已传，仅用于记录未传列表）
 */
@Entity('design_upload_task_picture')
@Unique('uk_upload_task_picture', ['upload_task_id', 'picture_id'])
export class DesignUploadTaskPictureEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_upload_task_id')
  @Column({ type: 'bigint', unsigned: true, nullable: false, comment: 'design_upload_task.id' })
  upload_task_id: number;

  @Column({ type: 'bigint', unsigned: true, nullable: false, comment: 'design_task_picture.id' })
  picture_id: number;

  @Column({ type: 'tinyint', nullable: false, default: 0, comment: '用户标记是否已传' })
  uploaded: number;

  @CreateDateColumn({ precision: 6 })
  createTime: Date;

  @UpdateDateColumn({ precision: 6 })
  updateTime: Date;
}
