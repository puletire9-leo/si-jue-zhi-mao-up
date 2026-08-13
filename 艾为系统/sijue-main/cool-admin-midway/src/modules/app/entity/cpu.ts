import {BaseEntity} from '@cool-midway/core';
import {Entity, Column} from 'typeorm';

@Entity('app_cpu')
export class AppCpuEntity extends BaseEntity {
  @Column({comment: '名称', length: 255})
  name: string;

  @Column({comment: '品牌', length: 255, nullable: true})
  brand: string;

  @Column({comment: '制程', length: 50, nullable: true})
  process: string;

  @Column({comment: '核心数', type: 'int', nullable: true})
  cores: number;

  @Column({comment: '线程数', type: 'int', nullable: true})
  threads: number;

  @Column({comment: '基础频率', type: 'decimal', precision: 5, scale: 2, nullable: true})
  base_frequency: number;

  @Column({comment: '睿频频率', type: 'decimal', precision: 5, scale: 2, nullable: true})
  turbo_frequency: number;

  @Column({comment: '一级缓存', length: 50, nullable: true})
  cache_l1: string;

  @Column({comment: '二级缓存', length: 50, nullable: true})
  cache_l2: string;

  @Column({comment: '三级缓存', length: 50, nullable: true})
  cache_l3: string;

  @Column({comment: '上市日期', type: 'date', nullable: true})
  launch_date: Date;

  @Column({comment: '上市价格', type: 'decimal', precision: 10, scale: 2, nullable: true})
  launch_price: number;

  @Column({comment: '图片链接', length: 255, nullable: true})
  image_url: string;

  @Column({comment: '规格链接', length: 255, nullable: true})
  spec_url: string;

  @Column({comment: '标签', type: 'json', nullable: true})
  labels: string[];
}
