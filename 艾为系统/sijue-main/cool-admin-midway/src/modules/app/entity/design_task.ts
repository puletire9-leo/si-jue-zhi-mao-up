import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 美工任务主表，对应表 design_task
 */
@Entity('design_task')
export class DesignTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_candidate_id')
  @Column({ type: 'int', nullable: false, comment: 'BSR 选品 id，关联 app_amz_bsr_candidate.id' })
  candidate_id: number;

  @Index('idx_status')
  @Column({
    type: 'int',
    nullable: false,
    default: 101,
    comment:
      '任务状态：101-待选参考图/102-AI生成图需中/103-待审核/201-待摄影领取/202-拍摄中/301-待美工领取/302-美工做图中/401-待上传/500-已完成',
  })
  status: number;

  @Column({ type: 'varchar', length: 512, nullable: false, default: '', comment: '美工上传路径' })
  designer_upload_path: string;

  @Column({ type: 'varchar', length: 512, nullable: false, default: '', comment: '摄影上传路径' })
  photographer_upload_path: string;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null, comment: '摄影领取人ID' })
  shooter_id: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null, comment: '摄影领取人' })
  shooter_name: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null, comment: '美工领取人ID' })
  designer_id: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null, comment: '美工领取人' })
  designer_name: string | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true, default: null, comment: 'AI图需任务ID(task_info.id)' })
  ai_task_id: number | null;

  @Column({ type: 'varchar', length: 512, nullable: false, default: '', comment: '主图 URL' })
  main_image: string;

  @Column({ type: 'json', nullable: true, comment: '时间线/进度记录，结构预留' })
  timeline: any | null;

  @CreateDateColumn({ precision: 6 })
  createTime: Date;

  @UpdateDateColumn({ precision: 6 })
  updateTime: Date;
}

