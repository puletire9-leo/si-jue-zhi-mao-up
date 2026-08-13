import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * FBA发货报表数据实体类 (showShipment_v2)
 */
@Entity('app_amz_lingxing_fba_shipment_report')
export class AppAmzLingxingFbaShipmentReportEntity extends BaseEntity {
  @Column({ comment: '唯一记录id', type: 'int', nullable: true })
  @Index({ unique: true })
  record_id: number;

  @Column({ comment: '店铺id', type: 'int', nullable: true })
  sid: number;

  @Column({ comment: '店铺名称', type: 'varchar', length: 255, nullable: true })
  seller: string;

  @Column({ comment: '创建人id', type: 'int', nullable: true })
  uid: number;

  @Column({ comment: '创建人姓名', type: 'varchar', length: 255, nullable: true })
  username: string;

  @Column({ comment: '亚马逊货件编号', type: 'varchar', length: 255, nullable: true })
  @Index()
  shipment_id: string;

  @Column({ comment: '货件名称', type: 'varchar', length: 255, nullable: true })
  shipment_name: string;

  @Column({ comment: '备注', type: 'text', nullable: true })
  remark: string;

  @Column({ comment: '发送类型', type: 'int', nullable: true })
  send_type: number;

  @Column({ comment: '系统内部状态', type: 'int', nullable: true })
  status: number;

  @Column({ comment: '是否是已完成状态：0 进行中，1 已完成', type: 'int', nullable: true })
  is_closed: number;

  @Column({ comment: '货件状态', type: 'varchar', length: 255, nullable: true })
  shipment_status: string;

  @Column({ comment: '数据更新时间', type: 'varchar', length: 255, nullable: true })
  gmt_modified: string;

  @Column({ comment: '数据创建时间', type: 'varchar', length: 255, nullable: true })
  gmt_create: string;

  @Column({ comment: '同步时间', type: 'varchar', length: 255, nullable: true })
  sync_time: string;

  @Column({ comment: '物流中心编码', type: 'varchar', length: 255, nullable: true })
  destination_fulfillment_center_id: string;

  @Column({ comment: '国家', type: 'varchar', length: 255, nullable: true })
  nation: string;

  @Column({ comment: 'STA国家', type: 'varchar', length: 255, nullable: true })
  sta_nation: string;

  @Column({ comment: '发货批次列表', type: 'json', nullable: true })
  inbound_shipment_lists: any;

  @Column({ comment: 'delivery_order', type: 'int', nullable: true })
  delivery_order: number;

  @Column({ comment: '子项数据', type: 'json', nullable: true })
  item_list: any;

  @Column({ comment: '是否erp创建', type: 'int', nullable: true })
  is_synchronous: number;

  @Column({ comment: '创建源(create_by_erp)', type: 'int', nullable: true })
  create_by_erp: number;

  @Column({ comment: '是否已上传装箱信息：0 未上传，1 已上传', type: 'int', nullable: true })
  is_uploaded_box: number;

  @Column({ comment: '最后成功装箱数量', type: 'int', nullable: true })
  last_success_box_count: number;

  @Column({ comment: '最后成功卡板数量', type: 'int', nullable: true })
  last_success_card_count: number;

  @Column({ comment: '装箱类型', type: 'varchar', length: 255, nullable: true })
  packing_type: string;

  @Column({ comment: '箱子总重量', type: 'varchar', length: 255, nullable: true })
  box_total_weight: string;

  @Column({ comment: '箱子总体积', type: 'varchar', length: 255, nullable: true })
  box_total_volume: string;

  @Column({ comment: '产品总重量', type: 'varchar', length: 255, nullable: true })
  product_total_weight: string;

  @Column({ comment: '状态时间信息数组', type: 'json', nullable: true })
  date_info: any;

  // ==== 兼容原有的四个时间字段，从 date_info 解析 ====
  @Column({ comment: 'WORKING时间', type: 'varchar', length: 255, nullable: true })
  working_time: string;

  @Column({ comment: 'SHIPPED时间', type: 'varchar', length: 255, nullable: true })
  shipped_time: string;

  @Column({ comment: 'RECEIVING时间', type: 'varchar', length: 255, nullable: true })
  receiving_time: string;

  @Column({ comment: 'CLOSED时间', type: 'varchar', length: 255, nullable: true })
  closed_time: string;
  // ====================================================

  @Column({ comment: 'Reference ID', type: 'varchar', length: 255, nullable: true })
  reference_id: string;

  @Column({ comment: 'Reference 更新次数', type: 'int', nullable: true })
  reference_update_num: number;

  @Column({ comment: 'Reference 同步状态', type: 'int', nullable: true })
  reference_sync_status: number;

  @Column({ comment: 'Reference 错误信息', type: 'text', nullable: true })
  reference_error_msg: string;

  @Column({ comment: '包装任务编号', type: 'varchar', length: 255, nullable: true })
  packing_task_sn: string;

  @Column({ comment: '是否添加跟踪号', type: 'int', nullable: true })
  is_add_tracking: number;

  @Column({ comment: '是否sta货件：0 否，1 是', type: 'int', nullable: true })
  is_sta: number;

  @Column({ comment: '发货模式(ship_mode)', type: 'int', nullable: true })
  ship_mode: number;

  @Column({ comment: '包装类型(packaging_type)', type: 'int', nullable: true })
  packaging_type: number;

  @Column({ comment: '是否打印透明计划标签', type: 'int', nullable: true })
  is_print_transparency: number;

  @Column({ comment: '本地STA ID', type: 'varchar', length: 255, nullable: true })
  local_sta_id: string;

  @Column({ comment: '本地STA名称', type: 'varchar', length: 255, nullable: true })
  local_sta_name: string;

  @Column({ comment: '亚马逊货件编号（sta货件时返回）', type: 'varchar', length: 255, nullable: true })
  sta_inbound_plan_id: string;

  @Column({ comment: '是否AWD', type: 'int', nullable: true })
  is_awd: number;

  @Column({ comment: 'AWD错误信息', type: 'json', nullable: true })
  awd_error_msg_info: any;

  @Column({ comment: '公英制', type: 'varchar', length: 255, nullable: true })
  metric_british_system: string;

  @Column({ comment: '当前步骤', type: 'int', nullable: true })
  step: number;

  @Column({ comment: '运输方式', type: 'varchar', length: 255, nullable: true })
  sta_transportation_mode: string;

  @Column({ comment: '本地发货地址', type: 'json', nullable: true })
  local_ship_to_address: any;

  @Column({ comment: '原始配送地址', type: 'json', nullable: true })
  orig_ship_to_address: any;

  @Column({ comment: '箱子类型', type: 'int', nullable: true })
  box_type: number;

  @Column({ comment: '是否店铺不同', type: 'int', nullable: true })
  is_store_diff: number;

  @Column({ comment: '送达时段-开始时间', type: 'varchar', length: 255, nullable: true })
  sta_delivery_start_date: string;

  @Column({ comment: '送达时段-结束时间', type: 'varchar', length: 255, nullable: true })
  sta_delivery_end_date: string;

  @Column({ comment: '追踪编号', type: 'json', nullable: true })
  tracking_number_list: any;

  @Column({ comment: '装箱提交状态', type: 'int', nullable: true })
  box_commit: number;

  @Column({ comment: '装箱提交结果', type: 'int', nullable: true })
  box_commit_result: number;
}
