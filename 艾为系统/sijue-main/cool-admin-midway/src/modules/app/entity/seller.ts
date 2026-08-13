import {BaseEntity} from '@cool-midway/core';
import {Entity, Column} from 'typeorm';

@Entity('app_amz_seller')
export class AppAmzSellerEntity extends BaseEntity {
  @Column({comment: '店铺名'})
  name: string;

  @Column({comment: '领星 ERP 对已授权企业的唯一标识', type: "int"})
  sid: number;

  @Column({comment: '卖家ID'})
  seller_id: string;

  @Column({comment: '店铺账户名称'})
  account_name: string;

  @Column({comment: '店铺账号 id'})
  seller_account_id: string;

  @Column({comment: '站点简称'})
  region: string;

  @Column({comment: '商城所在国家名称'})
  country: string;

  @Column({comment: '否授权广告 0-否 1-是'})
  has_ads_setting: number;

  @Column({comment: '市场ID'})
  marketplace_id: string;

  @Column({comment: '状态 0-停止同步 1-正常 2-授权异常 3-欠费停服'})
  status: number;

  @Column({comment: '最近一次拉取 listing 信息的时间', type: 'datetime', nullable: true, default: null})
  listing_last_fetch_date: Date;

  @Column({comment: '最近一次拉取 listing 销量数据的时间', type: 'datetime', nullable: true})
  daily_order_quantity_history_updateTime: Date;
}
