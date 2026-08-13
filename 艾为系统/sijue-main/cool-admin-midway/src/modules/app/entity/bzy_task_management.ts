import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 任务管理表
 * 用于监控各类任务的执行状态、时间节点及关联信息
 */
@Entity('app_task_management')
export class AppTaskManagementEntity extends BaseEntity {
  /**
   * 任务名称（直观描述任务用途）
   */
  @Column({ comment: '任务名称', nullable: false })
  taskName: string;
  
  /**
   * 任务ID（直观描述任务用途）
   */
  @Column({ comment: '任务ID', nullable: false })
  taskCode: string;

  
  /**
   * 任务当前状态（核心监控字段，反映任务生命周期）
   */
  @Index()
  @Column({ comment: '任务状态：Unexecuted - 未执行，Waiting - 等待分配，Extracting - 采集中，Stopped - 已停止，Finished - 已完成', nullable: false, default: 'PENDING' })
  taskStatus: string;

  /**
   * 任务调用时间（任务触发执行的时间，如定时任务的触发时间、手动触发时间）
   */
  @Column({ comment: '任务调用时间', type: 'datetime', nullable: true })
  invokeTime: Date;

  /**
   * 任务开始执行时间（任务实际开始处理的时间，区别于调用时间，应对任务排队场景）
   */
  @Column({ comment: '任务开始执行时间', type: 'datetime', nullable: true })
  executeStartTime: Date;

  /**
   * 任务结束时间（任务执行完成/失败的时间，用于计算执行耗时）
   */
  @Column({ comment: '任务结束时间', type: 'datetime', nullable: true })
  executeEndTime: Date;
  /**
   * 重试次数（任务失败后自动重试的次数，用于监控重试机制是否正常）
   */
  @Column({ comment: '重试次数', nullable: false, default: 0 })
  retryCount: number;

  /**
   * 最大重试次数（任务允许的最大重试上限，超过则标记为最终失败）
   */
  @Column({ comment: '最大重试次数', nullable: false, default: 3 })
  maxRetryCount: number;

  /**
   * 任务执行结果（存储任务成功/失败的关键信息，如成功时的返回数据ID、失败时的错误摘要）
   */
  @Column({ comment: '任务执行结果（成功数据ID/失败错误摘要）', nullable: true, length: 500 })
  executeResult: string;
  /**
   * 备注（补充任务特殊说明，如手动干预原因、临时配置调整等；
   * 也可用于记录接口调用说明，如 Oxylabs API 调用的功能说明）
   */
  @Column({ comment: '备注（任务说明或接口调用说明，例如 Oxylabs 调用用途）', nullable: true, length: 500 })
  remark: string;

  
  @Column({ comment: '国家', nullable: true, length: 20 })
  countryCode: string;

  
  @Column({ type: 'int', default: 0, comment: '总待处理数量' })
  totalCount: number;

  @Column({ type: 'int', default: 0, comment: '已完成数量' })
  completedCount: number;

  @Column({ type: 'text', nullable: true, comment: '任务参数（JSON格式）' })
  taskParams: string;
}
