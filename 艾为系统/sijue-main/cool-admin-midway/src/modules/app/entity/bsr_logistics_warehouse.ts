import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 采购物流仓库快照，来源于领星仓库接口。
 */
@Index('idx_bsr_logistics_warehouse_wid', ['wid'], { unique: true })
@Entity('app_amz_bsr_logistics_warehouse')
export class AppAmzBsrLogisticsWarehouseEntity extends BaseEntity {
  @Column({ comment: '领星仓库ID', type: 'int' })
  wid: number;

  @Index()
  @Column({ comment: '仓库名称', length: 120 })
  warehouse_name: string;

  @Index()
  @Column({ comment: '仓库类型: local/overseas/awd', length: 40, nullable: true })
  warehouse_type: string;

  @Index()
  @Column({ comment: '领星仓库类型: 1本地仓,3海外仓,6AWD仓', type: 'int', nullable: true })
  lingxing_type: number;

  @Index()
  @Column({ comment: '云端状态: active/removed', length: 40, default: 'active' })
  cloud_status: string;

  @Column({ comment: '最近一次云端出现时间', type: 'datetime', nullable: true })
  last_seen_time: Date;

  @Column({ comment: '云端移除标记时间', type: 'datetime', nullable: true })
  removed_time: Date;

  @Column({ comment: '领星原始仓库数据', type: 'json', nullable: true })
  raw_data: any;
}
