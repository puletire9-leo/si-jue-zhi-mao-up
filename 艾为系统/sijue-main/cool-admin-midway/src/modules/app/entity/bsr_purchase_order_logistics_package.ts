import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 采购单物流包裹，新物流模块核心表
 */
@Index('idx_bsr_po_logistics_pkg_order_tracking', ['order_sn', 'tracking_no'], {
  unique: true,
})
@Entity('app_amz_bsr_purchase_order_logistics_package')
export class AppAmzBsrPurchaseOrderLogisticsPackageEntity extends BaseEntity {
  @Index()
  @Column({ comment: '采购单号', length: 80 })
  order_sn: string;

  @Column({ comment: '来源包裹ID/领星pol_id', length: 80, nullable: true })
  source_pol_id: string;

  @Index()
  @Column({ comment: '运单号', length: 100 })
  tracking_no: string;

  @Column({ comment: '原始物流公司名', length: 120, nullable: true })
  raw_company_name: string;

  @Column({ comment: '领星物流来源明细JSON', type: 'json', nullable: true })
  source_items_json: any;

  @Index()
  @Column({ comment: '采购仓库ID/领星wid', type: 'int', nullable: true })
  warehouse_wid: number;

  @Column({ comment: '采购仓库名称快照', length: 120, nullable: true })
  warehouse_name: string;

  @Index()
  @Column({ comment: '快递100公司编码', length: 80, nullable: true })
  company_code: string;

  @Column({ comment: '标准快递公司名称', length: 120, nullable: true })
  company_name: string;

  @Column({ comment: '快递公司编码来源: autonumber/manual/imported', length: 40, nullable: true })
  company_code_source: string;

  @Index()
  @Column({ comment: '智能识别状态: pending/success/failed', length: 40, default: 'pending' })
  identify_status: string;

  @Column({ comment: '智能识别时间', type: 'datetime', nullable: true })
  identify_time: Date;

  @Column({ comment: '智能识别错误码', length: 80, nullable: true })
  identify_error_code: string;

  @Column({ comment: '智能识别错误信息', length: 500, nullable: true })
  identify_error_message: string;

  @Column({ comment: '智能识别候选JSON', type: 'json', nullable: true })
  identify_candidates_json: any;

  @Index()
  @Column({
    comment: '查询方式: kuaidi100/manual_required/ignored/disabled',
    length: 40,
    default: 'kuaidi100',
  })
  query_mode: string;

  @Index()
  @Column({ comment: '本地包裹状态', length: 40, default: 'pending_mapping' })
  status: string;

  @Column({ comment: '物流服务商', length: 40, default: 'kuaidi100' })
  provider: string;

  @Column({ comment: '服务商物流状态state', length: 40, nullable: true })
  provider_state: string;

  @Column({ comment: '服务商通讯状态status', length: 40, nullable: true })
  provider_status: string;

  @Column({ comment: '服务商消息', length: 500, nullable: true })
  provider_message: string;

  @Column({ comment: '是否签收: 0否,1是', type: 'tinyint', default: 0 })
  is_signed: number;

  @Column({ comment: '签收时间', type: 'datetime', nullable: true })
  sign_time: Date;

  @Column({ comment: '首条轨迹时间', type: 'datetime', nullable: true })
  first_trace_time: Date;

  @Column({ comment: '最新轨迹时间', type: 'datetime', nullable: true })
  latest_trace_time: Date;

  @Column({ comment: '轨迹JSON', type: 'json', nullable: true })
  trace_json: any;

  @Column({ comment: '服务商原始响应JSON', type: 'json', nullable: true })
  raw_response_json: any;

  @Column({ comment: '是否需要手机号: 0否,1是', type: 'tinyint', default: 0 })
  phone_required: number;

  @Column({ comment: '联系人手机号/校验手机号', length: 50, nullable: true })
  contact_phone: string;

  @Column({ comment: '手机号来源: manual/warehouse_contact', length: 40, nullable: true })
  phone_source: string;

  @Index()
  @Column({ comment: '成功匹配的仓库联系人绑定ID', type: 'int', nullable: true })
  warehouse_contact_binding_id: number;

  @Column({
    comment: '手机号状态: ok/missing/invalid/not_required',
    length: 40,
    default: 'not_required',
  })
  phone_status: string;

  @Column({ comment: '手机号填写人ID', type: 'int', nullable: true })
  contact_phone_created_by_user_id: number;

  @Column({ comment: '手机号填写人用户名', length: 100, nullable: true })
  contact_phone_created_by_username: string;

  @Column({ comment: '手机号填写时间', type: 'datetime', nullable: true })
  contact_phone_created_time: Date;

  @Column({ comment: '包裹人工确认: 0否,1是', type: 'tinyint', default: 0 })
  manual_confirmed: number;

  @Column({ comment: '包裹人工确认时间', type: 'datetime', nullable: true })
  manual_confirmed_time: Date;

  @Column({ comment: '包裹人工确认人ID', type: 'int', nullable: true })
  manual_confirmed_by_user_id: number;

  @Column({ comment: '包裹人工确认用户名', length: 100, nullable: true })
  manual_confirmed_by_username: string;

  @Column({ comment: '上次查询时间', type: 'datetime', nullable: true })
  last_query_time: Date;

  @Index()
  @Column({ comment: '下次允许查询时间', type: 'datetime', nullable: true })
  next_query_after: Date;

  @Column({ comment: '查询次数', type: 'int', default: 0 })
  query_count: number;

  @Column({ comment: '失败次数', type: 'int', default: 0 })
  error_count: number;

  @Column({ comment: '最后错误码', length: 80, nullable: true })
  last_error_code: string;

  @Column({ comment: '最后错误信息', length: 500, nullable: true })
  last_error_message: string;

  @Column({ comment: '备注', type: 'text', nullable: true })
  remark: string;
}
