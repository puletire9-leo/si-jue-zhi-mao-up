// src/entity/bsr_restocking_center_lingxing.ts
import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

// 嵌套类型定义（用于JSON字段）
export interface RelationListing {
  storeId: number;
  marketplaceId: number;
  asin: string;
  parentAsin: string;
  msku: string;
  fnsku: string;
  relationProductId: number;
  listingOpenTime: string;
}

export interface HashVersion {
  hashId: string;
  versionId: number;
}

export interface BasicInfo {
  uniKey: string;
  hashId: string;
  versionId: number;
  dataType: number;
  nodeType: number;
  relationListing: RelationListing[];
  syncTime: string;
  syncStatus: number;
  hashVersionList: HashVersion[];
}

export interface Product {
  id: number;
  sku: string;
  productName: string;
  isCombo: number;
}

 export interface FbaAgedInfo {
  invAge0To90Days: number;
  invAge91To180Days: number;
  invAge181To270Days: number;
  invAge271To365Days: number;
  invAge365PlusDays: number;
}

 export interface ListingPrice {
  listingPrice: number;
  listingPriceUnit: string;
}

 export interface LocalAgedInfo {
  section1: number;
  section2: number;
  section3: number;
  section4: number;
}

 export interface DaysOfSupplyInfo {  
  historicalDaysOfSupply: number;
  longTermHistoricalDaysOfSupply: number;
  shortTermHistoricalDaysOfSupply: number;
}

  export interface ReturnsReport {
  returnsTotal3: number;
  returnsTotal7: number;
  returnsTotal14: number;
  returnsTotal30: number;
  returnsTotal60: number;
  returnsTotal90: number;
  returnsAvg3: number;
  returnsAvg7: number;
  returnsAvg14: number;
  returnsAvg30: number;
  returnsAvg60: number;
  returnsAvg90: number;
}

  export interface DisplayInfo {
  asin: string;
  asinUrl: string;
  itemName: string;
  smallImageUrl: string;
  asinList: string[];
  parentAsinList: string[];
  productList: Product[];
  brandList: any[];
  categoryList: any[];
  cgOptUserDTOList: any[];
  productDeveloperDTOList: any[];
  cgOptUserList: any[];
  productDeveloperList: any[];
  storeList: string[];
  marketplaceList: string[];
  listingOpenTimeList: string[];
  listingPrincipal: any[];
  tagList: any[];
  daysPurchase: number;
  fbaAgedInfo: FbaAgedInfo;
  listingPriceList: ListingPrice[];
  listingPriceDownload: string;
  localAgedInfo: LocalAgedInfo;
  daysOfSupplyInfo: DaysOfSupplyInfo;
  returnsReport: ReturnsReport;
}

 export interface AmazonQuantityInfo {
  amazonQuantityValid: number;
  amazonQuantityShipping: number;
  amazonQuantityShippingPlan: number;
  afnFulfillableQuantity: number;
  reservedFcTransfers: number;
  reservedFcProcessing: number;
  afnInboundReceivingQuantity: number;
  fbaQuantityShippingPlan: number;
  overseaQuantityShippingPlan: number;
  reservedCustomerorders: number;
}

 export interface ScmQuantityInfo {
  scQuantityLocalValid: number;
  scQuantityOverseaValid: number;
  scQuantityOverseaShipping: number;
  scQuantityLocalQc: number;
  scQuantityPurchasePlan: number;
  scQuantityPurchaseShipping: number;
  scQuantityLocalShipping: number;
}

 export interface StockQuantityInfo {
  stockTotal: number;
}

 export interface RecentSalesTrend {
  date: string;
  volume: number;
}

 export interface SalesInfo {     
  salesAvg3: number;
  salesAvg7: number;
  salesAvg14: number;
  salesAvg30: number;
  salesAvg60: number;
  salesAvg90: number;
  salesTotal3: number;
  salesTotal7: number;
  salesTotal14: number;
  salesTotal30: number;
  salesTotal60: number;
  salesTotal90: number;
  recentSalesTrendList: RecentSalesTrend[];
}

 export interface SuggestSm {
  smId: string;
  name: string;
  quantitySugPurchase: number;
  quantitySugLocalToFba: number;
  quantitySugLocalToOversea: number;
}

 export interface SuggestInfo {
  outStockFlag: number;
  outStockDate: string;
  stockingDays: number;
  estimatedSaleQuantity: number;
  estimatedSaleAvgQuantity: number;
  availableSaleDays: number;
  fbaAvailableSaleDays: number;
  availableSaleDaysFba: number;
  availableSaleDaysFbaAndShipping: number;
  quantitySugPurchase: number;
  quantitySugLocalToOversea: number;
  quantitySugLocalToFba: number;
  quantitySugOverseaToFba: number;
  outStockDatePurchase: string;
  outStockDateLocal: string;
  outStockDateOversea: string;
  sugDatePurchase: string;
  sugDateSendLocal: string;
  sugDateSendOversea: string;
  suggestSmList: SuggestSm[];
}

 export interface ExtInfo {
  restockStatus: number;
  remark: string;
  customPurchaseQuantity: number | null;
  customSendQuantity: number | null;
  star: number;
  needFlagPurchase: number;
  needFlagLocalSend: number;
  needFlagOverseaSend: number;
  needFlag: number | null;
  localValidDetailList?: any[];
  purchaseShippingDetailList?: any[];
  purchasePlanDetailList?: any[];
  fbaShippingPlanDetailList?: any[];
}

// FBA库存详情类型
export interface FbaValidItem {
  orderType: number;
  orderSn: string;
  quantity: number;
  expectArriveDate: string;
  amazonSaleDate: string;
  fnsku: string;
  msku: string;
  afnReservedQuantity?: number; // FBA预留
  afnFulfillableQuantity: number; // 可售
  reservedFcTransfers: number;    // 待调仓
  reservedFcProcessing: number;   // 调仓中
  afnInboundReceivingQuantity: number; // 入库中
  reservedCustomerorders: number; // 待发货
}

// FBA在途详情类型
export interface FbaShippingItem {
  orderType: number;
  orderSn: string;
  quantity: number;
  expectArriveDate: string;
  amazonSaleDate: string;
  shippingOrderSn: string;
  logisticsChannelName: string;
  shipmentTime: string;
  shippingMethod: string;
  shipment_status: string | null; // 新增字段，默认null
}

@Entity('app_amz_bsr_restocking_center_lingxing')
export class AppAmzBsrRestockingCenterLingxingEntity extends BaseEntity {
  // 基础信息
  @Index()
  @Column({ comment: '唯一标识', nullable: true })
  uniKey: string;

  @Index()
  @Column({ comment: '哈希ID', nullable: true })
  hashId: string;

  @Column({ type: 'bigint', comment: '版本ID', nullable: true })
  versionId: number;

  @Column({ comment: '数据类型', nullable: true })
  dataType: number;

  @Column({ comment: '节点类型', nullable: true })
  nodeType: number;

  @Column({ type: 'json', comment: '关联Listing信息', nullable: true })
  relationListing: RelationListing[];

  @Column({ comment: '同步时间', nullable: true })
  syncTime: string;

  @Column({ comment: '同步状态', nullable: true })
  syncStatus: number;

  @Column({ type: 'json', comment: '哈希版本列表', nullable: true })
  hashVersionList: HashVersion[];

  // 展示信息
  @Index()
  @Column({ comment: 'ASIN', nullable: true })
  asin: string;

  @Column({ comment: 'ASIN链接', nullable: true })
  asinUrl: string;

  @Column({ comment: '商品名称', nullable: true, length: 2000 })
  itemName: string;

  @Column({ comment: '小图URL', nullable: true })
  smallImageUrl: string;

  @Column({ type: 'json', comment: 'ASIN列表', nullable: true })
  asinList: string[];

  @Column({ type: 'json', comment: '父ASIN列表', nullable: true })
  parentAsinList: string[];

  @Column({ type: 'json', comment: '产品列表', nullable: true })
  productList: Product[];

  @Column({ type: 'json', comment: '品牌列表', nullable: true })
  brandList: any[];

  @Column({ type: 'json', comment: '分类列表', nullable: true })
  categoryList: any[];

  @Column({ type: 'json', comment: 'CG优化用户列表', nullable: true })
  cgOptUserDTOList: any[];

  @Column({ type: 'json', comment: '产品开发人员列表', nullable: true })
  productDeveloperDTOList: any[];

  @Column({ type: 'json', comment: 'CG优化用户列表', nullable: true })
  cgOptUserList: any[];

  @Column({ type: 'json', comment: '产品开发人员列表', nullable: true })
  productDeveloperList: any[];

  @Column({ type: 'json', comment: '店铺列表', nullable: true })
  storeList: string[];

  @Column({ type: 'json', comment: '市场列表', nullable: true })
  marketplaceList: string[];

  @Column({ type: 'json', comment: 'Listing上架时间列表', nullable: true })
  listingOpenTimeList: string[];

  @Column({ type: 'json', comment: 'Listing负责人', nullable: true })
  listingPrincipal: any[];

  @Column({ type: 'json', comment: '标签列表', nullable: true })
  tagList: any[];

  @Column({ comment: '采购天数', nullable: true })
  daysPurchase: number;

  @Column({ type: 'json', comment: 'FBA库龄', nullable: true })
  fbaAgedInfo: FbaAgedInfo;

  @Column({ type: 'json', comment: 'Listing价格列表', nullable: true })
  listingPriceList: ListingPrice[];

  @Column({ comment: 'Listing价格（下载用）', nullable: true })
  listingPriceDownload: string;

  @Column({ type: 'json', comment: '本地仓库龄', nullable: true })
  localAgedInfo: LocalAgedInfo;

  @Column({ type: 'json', comment: '供应天数信息', nullable: true })
  daysOfSupplyInfo: DaysOfSupplyInfo;

  @Column({ type: 'json', comment: '退货报告', nullable: true })
  returnsReport: ReturnsReport;

  // 亚马逊库存信息
  @Column({ type: 'json', comment: '亚马逊库存信息', nullable: true })
  amazonQuantityInfo: AmazonQuantityInfo;

  // SCM库存信息
  @Column({ type: 'json', comment: 'SCM库存信息', nullable: true })
  scmQuantityInfo: ScmQuantityInfo;

  // 总库存信息
  @Column({ type: 'json', comment: '总库存信息', nullable: true })
  stockQuantityInfo: StockQuantityInfo;

  // 销售信息
  @Column({ type: 'json', comment: '销售信息', nullable: true })
  salesInfo: SalesInfo;

  @Column({ comment: '实时销量', type: 'double', nullable: true })
  realtimeSales: number;

  // 建议信息
  @Column({ type: 'json', comment: '补货建议信息', nullable: true })
  suggestInfo: SuggestInfo;

  // 扩展信息
  @Column({ type: 'json', comment: '扩展信息', nullable: true })
  extInfo: ExtInfo;

  // 商品列表
  @Column({ type: 'json', comment: '商品列表', nullable: true })
  itemList: any[];

  // 追踪ID
  @Column({ comment: '请求追踪ID', nullable: true })
  traceId: string;
  
  // FBA库存详情
  @Column({ type: 'json', comment: 'FBA库存详情', nullable: true })
  fbaValidList: FbaValidItem[];

  // FBA在途详情
  @Column({ type: 'json', comment: 'FBA在途详情', nullable: true })
  fbaShippingList: FbaShippingItem[];
}
