import { BaseEntity } from "@cool-midway/core";
import { Column, Entity, Index } from "typeorm";

@Entity("app_amz_lingxing_profit_report_msku")
@Index("uk_profit_report_msku", ["storeId", "platformCode", "msku", "localSku", "countryName", "requestStartDate", "requestEndDate", "currencyCode"], { unique: true })
export class AppAmzLingxingProfitReportMskuEntity extends BaseEntity {
  @Column({ comment: "查询开始日期", length: 20 })
  requestStartDate: string;

  @Column({ comment: "查询结束日期", length: 20 })
  requestEndDate: string;

  @Column({ comment: "店铺id", length: 64, nullable: true })
  storeId: string;

  @Column({ comment: "店铺", length: 1000, nullable: true })
  storeName: string;

  @Column({ comment: "平台编码", length: 50, nullable: true })
  platformCode: string;

  @Column({ comment: "平台", length: 1000, nullable: true })
  platformName: string;

  @Column({ comment: "MSKU", length: 100, nullable: true })
  msku: string;

  @Column({ comment: "品名", length: 1000, nullable: true })
  productName: string;

  @Column({ comment: "SKU", length: 100, nullable: true })
  localSku: string;

  @Column({ comment: "下单时间（废弃字段，仅订单维度返回）", length: 255, nullable: true })
  deliveryDate: string;

  @Column({ comment: "国家", length: 100, nullable: true })
  countryName: string;

  @Column({ comment: "分类", length: 1000, nullable: true })
  bname: string;

  @Column({ comment: "品牌", length: 1000, nullable: true })
  cname: string;

  @Column({ comment: "开发人", length: 1000, nullable: true })
  developer: string;

  @Column({ comment: "币种", length: 10, nullable: true })
  currencyCode: string;

  @Column({ comment: "货币图标", length: 255, nullable: true })
  currencyIcon: string;

  @Column({ comment: "销量", type: "double", nullable: true })
  salesNum: number;

  @Column({ comment: "补货量", type: "double", nullable: true })
  replacementNum: number;

  @Column({ comment: "销售额", type: "double", nullable: true })
  salesAmount: number;

  @Column({ comment: "促销折扣", type: "double", nullable: true })
  promotionDiscountAmount: number;

  @Column({ comment: "买家运费", type: "double", nullable: true })
  buyerFreightAmount: number;

  @Column({ comment: "其他收入", type: "double", nullable: true })
  platformOtherIncomeAmount: number;

  @Column({ comment: "收入退款额", type: "double", nullable: true })
  incomeRefundAmount: number;

  @Column({ comment: "费用退款额", type: "double", nullable: true })
  feeRefundAmount: number;

  @Column({ comment: "退款金额", type: "double", nullable: true })
  refundAmount: number;

  @Column({ comment: "退款量", length: 255, nullable: true })
  refundNum: string;

  @Column({ comment: "退款率", type: "double", nullable: true })
  refundRate: number;

  @Column({ comment: "退货量", type: "double", nullable: true })
  returnedGoodsNum: number;

  @Column({ comment: "退货率", type: "double", nullable: true })
  returnedGoodsRate: number;

  @Column({ comment: "平台费", type: "double", nullable: true })
  promotionAmount: number;

  @Column({ comment: "平台物流费", type: "double", nullable: true })
  platformLogisticsAmount: number;

  @Column({ comment: "推广费", type: "double", nullable: true })
  promotionExtendAmount: number;

  @Column({ comment: "广告费", type: "double", nullable: true })
  advertisementAmount: number;

  @Column({ comment: "调整费", type: "double", nullable: true })
  adjustmentCostAmount: number;

  @Column({ comment: "平台仓储费", type: "double", nullable: true })
  platformStorageAmount: number;

  @Column({ comment: "平台罚款", type: "double", nullable: true })
  platformFineAmount: number;

  @Column({ comment: "平台其他费", type: "double", nullable: true })
  platformOtherAmount: number;

  @Column({ comment: "销售税", type: "double", nullable: true })
  taxAmount: number;

  @Column({ comment: "市场税", type: "double", nullable: true })
  marketTaxAmount: number;

  @Column({ comment: "商品其他费", type: "double", nullable: true })
  customOtherProductAmount: number;

  @Column({ comment: "店铺其他费", type: "double", nullable: true })
  customOtherSellerAmount: number;

  @Column({ comment: "订单其他费", type: "double", nullable: true })
  customOtherSalesOrderAmount: number;

  @Column({ comment: "采购成本", type: "double", nullable: true })
  purchaseAmount: number;

  @Column({ comment: "头程成本", type: "double", nullable: true })
  transportationAmount: number;

  @Column({ comment: "尾程成本", type: "double", nullable: true })
  tailAmount: number;

  @Column({ comment: "其他成本", type: "double", nullable: true })
  otherAmount: number;

  @Column({ comment: "毛利润", type: "double", nullable: true })
  grossProfit: number;

  @Column({ comment: "毛利率", type: "double", nullable: true })
  grossProfitRate: number;

  @Column({ comment: "其他税费", type: "double", nullable: true })
  otherTaxesFees: number;

  @Column({ comment: "补贴金额", type: "double", nullable: true })
  subsidyAmount: number;

  @Column({ comment: "WFS仓储费", type: "double", nullable: true })
  platformWfsStorageAmount: number;

  @Column({ comment: "WFS移除费", type: "double", nullable: true })
  platformWfsRemoveAmount: number;

  @Column({ comment: "WFS入仓费", type: "double", nullable: true })
  wfsWarehousFee: number;

  @Column({ comment: "WFS上架前处理费", type: "double", nullable: true })
  wfsPrepServiceFee: number;

  @Column({ comment: "WFS存货转仓费", type: "double", nullable: true })
  wfsInventoryTransferFee: number;

  @Column({ comment: "WFS RTV费", type: "double", nullable: true })
  wfsInventoryRTVFee: number;

  @Column({ comment: "商品佣金", type: "double", nullable: true })
  productCommission: number;

  @Column({ comment: "运费佣金", type: "double", nullable: true })
  shippingCommission: number;

  @Column({ comment: "WFS调整费", type: "double", nullable: true })
  wfsAdjustmentCostAmount: number;

  @Column({ comment: "信用额度调整费", type: "double", nullable: true })
  creditAdjustmentFee: number;

  @Column({ comment: "退货调整费", type: "double", nullable: true })
  returnAdjustmentFee: number;

  @Column({ comment: "其他费", type: "double", nullable: true })
  platformDetailOtherAmount: number;

  @Column({ comment: "评论加速器费", type: "double", nullable: true })
  commentAcceleratorFee: number;

  @Column({ comment: "沃尔玛资助节省", type: "double", nullable: true })
  walmartSavingsBenefit: number;

  @Column({ comment: "WFS库存丢失费", type: "double", nullable: true })
  wfsLostInventoryFee: number;

  @Column({ comment: "WFS库存找回费", type: "double", nullable: true })
  wfsFoundInventoryFee: number;

  @Column({ comment: "WFS库存损坏费", type: "double", nullable: true })
  wfsDamageInWarehouseFee: number;

  @Column({ comment: "WFS接收错误收费", type: "double", nullable: true })
  wfsReceivingErrorChargeBackFee: number;

  @Column({ comment: "WFS调整收费", type: "double", nullable: true })
  wfsChargeFee: number;

  @Column({ comment: "WFS发货费", type: "double", nullable: true })
  wfsShipmentFee: number;

  @Column({ comment: "沃尔玛退货服务费", type: "double", nullable: true })
  walmartReturnServiceFee: number;

  @Column({ comment: "WFS退货费", type: "double", nullable: true })
  wfsReturnFee: number;

  @Column({ comment: "平台广告费", type: "double", nullable: true })
  platformAdvertisingFee: number;

  @Column({ comment: "自助搜索引擎营销费", type: "double", nullable: true })
  semMarketingFee: number;

  @Column({ comment: "释放储备金", type: "double", nullable: true })
  reserveCreditedBackAmount: number;

  @Column({ comment: "超额退款调整", type: "double", nullable: true })
  excessRefundAdjustmentAmount: number;

  @Column({ comment: "沃尔玛产品广告积分", type: "double", nullable: true })
  walmartProductAdvertisingCreditsFee: number;

  @Column({ comment: "沃尔玛促销编码", type: "double", nullable: true })
  walmartPromoCode: number;

  @Column({ comment: "沃尔玛额外折扣", type: "double", nullable: true })
  walmartExtraDiscount: number;

  @Column({ comment: "多渠道配送费", type: "double", nullable: true })
  platformMultiChannelFulfillmentFee: number;

  @Column({ comment: "预留储备金", type: "double", nullable: true })
  platformReserveFund: number;

  @Column({ comment: "卖家折扣", type: "double", nullable: true })
  sellerDiscount: number;

  @Column({ comment: "Shopee平台折扣", type: "double", nullable: true })
  shopeeDiscount: number;

  @Column({ comment: "Shopee币折扣", type: "double", nullable: true })
  discountFromCoin: number;

  @Column({ comment: "Shopee优惠券折扣", type: "double", nullable: true })
  discountFromVoucherShopee: number;

  @Column({ comment: "卖家优惠券折扣", type: "double", nullable: true })
  discountFromVoucherSeller: number;

  @Column({ comment: "支付折扣", type: "double", nullable: true })
  paymentPromotion: number;

  @Column({ comment: "卖家Shopee币回扣", type: "double", nullable: true })
  sellerCoinCashBack: number;

  @Column({ comment: "三方运费折扣", type: "double", nullable: true })
  shippingFeeDiscountFrom3pl: number;

  @Column({ comment: "卖家运费折扣", type: "double", nullable: true })
  sellerShippingDiscount: number;

  @Column({ comment: "信用卡折扣", type: "double", nullable: true })
  creditCardPromotion: number;

  @Column({ comment: "损失补偿", type: "double", nullable: true })
  sellerLostCompensation: number;

  @Column({ comment: "运费补偿", type: "double", nullable: true })
  shopeeShippingRebate: number;

  @Column({ comment: "SIP补贴", type: "double", nullable: true })
  sipSubsidy: number;

  @Column({ comment: "退款金额", type: "double", nullable: true })
  sellerReturnRefund: number;

  @Column({ comment: "争议退款", type: "double", nullable: true })
  drcAdjustableRefund: number;

  @Column({ comment: "Shopee币抵消退款", type: "double", nullable: true })
  proratedCoinsValueOffsetReturnItems: number;

  @Column({ comment: "Shopee优惠券抵消退款", type: "double", nullable: true })
  proratedShopeeVoucherOffsetReturnItems: number;

  @Column({ comment: "卖家优惠券抵消退款", type: "double", nullable: true })
  proratedSellerVoucherOffsetReturnItems: number;

  @Column({ comment: "银行支付促销抵消退款", type: "double", nullable: true })
  proratedPaymentChannelPromoBankOffsetReturnItems: number;

  @Column({ comment: "Shopee支付促销抵消退款", type: "double", nullable: true })
  proratedPaymentChannelPromoShopeeOffsetReturnItems: number;

  @Column({ comment: "退货运费平台退款", type: "double", nullable: true })
  sellerProtectionFeeClaimAmount: number;

  @Column({ comment: "平台佣金", type: "double", nullable: true })
  commissionFee: number;

  @Column({ comment: "联盟营销佣金", type: "double", nullable: true })
  amsCommissionFee: number;

  @Column({ comment: "实际运费", type: "double", nullable: true })
  actualShippingFee: number;

  @Column({ comment: "退货运费", type: "double", nullable: true })
  reverseShippingFee: number;

  @Column({ comment: "配送失败运费", type: "double", nullable: true })
  finalReturnToSellerShippingFee: number;

  @Column({ comment: "服务费", type: "double", nullable: true })
  serviceFee: number;

  @Column({ comment: "买家交易手续费", type: "double", nullable: true })
  buyerTransactionFee: number;

  @Column({ comment: "卖家交易手续费", type: "double", nullable: true })
  sellerTransactionFee: number;

  @Column({ comment: "信用卡交易手续费", type: "double", nullable: true })
  creditCardTransactionFee: number;

  @Column({ comment: "活动费", type: "double", nullable: true })
  campaignFee: number;

  @Column({ comment: "卖家保护费", type: "double", nullable: true })
  shippingSellerProtectionFeeAmount: number;

  @Column({ comment: "特别活动服务费", type: "double", nullable: true })
  deliverySellerProtectionFeePremiumAmount: number;

  @Column({ comment: "海外退货服务费", type: "double", nullable: true })
  overseasReturnServiceFee: number;

  @Column({ comment: "跨境税", type: "double", nullable: true })
  crossBorderTax: number;

  @Column({ comment: "第三方托管税", type: "double", nullable: true })
  escrowTax: number;

  @Column({ comment: "运费税", type: "double", nullable: true })
  shippingFeeSst: number;

  @Column({ comment: "退货运费税", type: "double", nullable: true })
  reverseShippingFeeSst: number;

  @Column({ comment: "低值销售税", type: "double", nullable: true })
  salesTaxOnLvg: number;

  @Column({ comment: "商品增值税", type: "double", nullable: true })
  finalProductVatTax: number;

  @Column({ comment: "运费增值税", type: "double", nullable: true })
  finalShippingVatTax: number;

  @Column({ comment: "GST商品增值税", type: "double", nullable: true })
  finalEscrowProductGst: number;

  @Column({ comment: "GST运费增值税", type: "double", nullable: true })
  finalEscrowShippingGst: number;

  @Column({ comment: "进口增值税", type: "double", nullable: true })
  vatOnImportedGoods: number;

  @Column({ comment: "平台基础建设费", type: "double", nullable: true })
  selleroOrderProcessingFee: number;

  @Column({ comment: "买家支付包装费", type: "double", nullable: true })
  buyerPaidPackagingFee: number;

  @Column({ comment: "预扣个人所得税", type: "double", nullable: true })
  withholdingPitTax: number;

  @Column({ comment: "预扣增值税", type: "double", nullable: true })
  withholdingVatTax: number;

  @Column({ comment: "菲律宾市场税", type: "double", nullable: true })
  withholdingTax: number;

  @Column({ comment: "售后问题扣款", type: "double", nullable: true })
  afterSalesDeduction: number;

  @Column({ comment: "备货违规费", type: "double", nullable: true })
  stockingViolation: number;

  @Column({ comment: "质量事故违规费", type: "double", nullable: true })
  qualityBreach: number;

  @Column({ comment: "商品环保费", type: "double", nullable: true })
  ecoFeeForGood: number;

  @Column({ comment: "物流包装环保费（已扣费）", type: "double", nullable: true })
  logisticsEcoPackagingFee: number;

  @Column({ comment: "代扣服务费", type: "double", nullable: true })
  withholdingServiceFee: number;

  @Column({ comment: "eBay订阅费", type: "double", nullable: true })
  ebaySubscriptionFee: number;

  @Column({ comment: "eBay刊登费", type: "double", nullable: true })
  ebayPublicationFee: number;

  @Column({ comment: "监管运营费", type: "double", nullable: true })
  regulatoryOperatingFee: number;

  @Column({ comment: "SVC平台佣金", type: "double", nullable: true })
  fundedCommissionFromSellerVirtualCredit: number;

  @Column({ comment: "优惠券促销费用退款", type: "double", nullable: true })
  reversalPromotionalChargesVouchers: number;

  @Column({ comment: "SVC联合出资优惠券退款", type: "double", nullable: true })
  reverseSellerVirtualCreditCoFundVoucher: number;

  @Column({ comment: "SVC联合出资优惠券", type: "double", nullable: true })
  sellerVirtualCreditCoFundVoucher: number;

  @Column({ comment: "卖家运费补贴", type: "double", nullable: true })
  shippingFeeSubsidyBySeller: number;

  @Column({ comment: "卖家折扣", type: "double", nullable: true })
  sellerDiscountAmount: number;

  @Column({ comment: "运费折扣", type: "double", nullable: true })
  shippingFeeDiscountAmount: number;

  @Column({ comment: "COD费", type: "double", nullable: true })
  codServiceFeeAmount: number;

  @Column({ comment: "销售额退款", type: "double", nullable: true })
  refundSubtotalBeforeDiscountAmount: number;

  @Column({ comment: "商家折扣退款", type: "double", nullable: true })
  sellerDiscountRefundAmount: number;

  @Column({ comment: "COD费退款", type: "double", nullable: true })
  refundCodServiceFeeAmount: number;

  @Column({ comment: "达人佣金", type: "double", nullable: true })
  affiliateCommissionAmount: number;

  @Column({ comment: "达人伙伴佣金", type: "double", nullable: true })
  affiliatePartnerCommissionAmount: number;

  @Column({ comment: "TSP佣金", type: "double", nullable: true })
  tspCommissionAmount: number;

  @Column({ comment: "实际运费", type: "double", nullable: true })
  actualShippingFeeAmount: number;

  @Column({ comment: "退货运费", type: "double", nullable: true })
  returnShippingFeeAmount: number;

  @Column({ comment: "替换运费", type: "double", nullable: true })
  replacementShippingFeeAmount: number;

  @Column({ comment: "换货运费", type: "double", nullable: true })
  exchangeShippingFeeAmount: number;

  @Column({ comment: "签名确认费", type: "double", nullable: true })
  signatureConfirmationFeeAmount: number;

  @Column({ comment: "物流保险费", type: "double", nullable: true })
  shippingInsuranceFeeAmount: number;

  @Column({ comment: "交易费", type: "double", nullable: true })
  transactionFeeAmount: number;

  @Column({ comment: "信用卡处理费", type: "double", nullable: true })
  creditCardHandlingFeeAmount: number;

  @Column({ comment: "SFP服务费", type: "double", nullable: true })
  sfpServiceFeeAmount: number;

  @Column({ comment: "直播特别项目费", type: "double", nullable: true })
  liveSpecialsFeeAmount: number;

  @Column({ comment: "奖金返现服务费", type: "double", nullable: true })
  bonusCashbackServiceFeeAmount: number;

  @Column({ comment: "TK商城服务费", type: "double", nullable: true })
  mallServiceFeeAmount: number;

  @Column({ comment: "Voucher Xtra服务费", type: "double", nullable: true })
  voucherXtraServiceFeeAmount: number;

  @Column({ comment: "限时促销服务费", type: "double", nullable: true })
  flashSalesServiceFeeAmount: number;

  @Column({ comment: "共同出资促销服务费", type: "double", nullable: true })
  cofundedPromotionServiceFeeAmount: number;

  @Column({ comment: "预售服务费", type: "double", nullable: true })
  preOrderServiceFeeAmount: number;

  @Column({ comment: "马来西亚销售服务税", type: "double", nullable: true })
  sstAmount: number;

  @Column({ comment: "新加坡商品服务税", type: "double", nullable: true })
  gstAmount: number;

  @Column({ comment: "销售税退款额", type: "double", nullable: true })
  salesTaxRefundAmount: number;

  @Column({ comment: "普通增值税", type: "double", nullable: true })
  standardVatAmount: number;

  @Column({ comment: "进口增值税", type: "double", nullable: true })
  importVatAmount: number;

  @Column({ comment: "墨西哥增值税", type: "double", nullable: true })
  ivaAmount: number;

  @Column({ comment: "墨西哥联邦所得税", type: "double", nullable: true })
  isrAmount: number;

  @Column({ comment: "反倾销税", type: "double", nullable: true })
  antiDumpingDutyAmount: number;

  @Column({ comment: "关税", type: "double", nullable: true })
  customsDutyAmount: number;

  @Column({ comment: "清关费", type: "double", nullable: true })
  customsClearanceAmount: number;

  @Column({ comment: "争议退回", type: "double", nullable: true })
  chargeBack: number;

  @Column({ comment: "客户服务补偿", type: "double", nullable: true })
  customerServiceCompensation: number;

  @Column({ comment: "卖家责任扣款", type: "double", nullable: true })
  deductionsIncurredBySeller: number;

  @Column({ comment: "GMV广告扣费", type: "double", nullable: true })
  gmvPaymentForAds: number;

  @Column({ comment: "平台佣金调整", type: "double", nullable: true })
  platformCommissionAdjustment: number;

  @Column({ comment: "平台佣金补偿", type: "double", nullable: true })
  platformCommissionCompensation: number;

  @Column({ comment: "优惠调整", type: "double", nullable: true })
  promotionAdjustment: number;

  @Column({ comment: "推荐费折扣", type: "double", nullable: true })
  rebate: number;

  @Column({ comment: "平台补偿", type: "double", nullable: true })
  platformCompensation: number;

  @Column({ comment: "平台退款报销", type: "double", nullable: true })
  platformReimbursement: number;

  @Column({ comment: "共同出资创作者激励", type: "double", nullable: true })
  cofundedCreatorRewards: number;

  @Column({ comment: "物流赔偿", type: "double", nullable: true })
  logisticsReimbursement: number;

  @Column({ comment: "运费调整", type: "double", nullable: true })
  shippingFeeAdjustment: number;

  @Column({ comment: "运费补偿", type: "double", nullable: true })
  shippingFeeCompensation: number;

  @Column({ comment: "运费回扣", type: "double", nullable: true })
  shippingFeeRebate: number;

  @Column({ comment: "样品运费", type: "double", nullable: true })
  sampleShippingFee: number;

  @Column({ comment: "其他调整费", type: "double", nullable: true })
  otherAdjustment: number;

  @Column({ comment: "FBT仓储服务费", type: "double", nullable: true })
  fbtWarehouseServiceFee: number;

  @Column({ comment: "平台罚款", type: "double", nullable: true })
  platformPenalty: number;

  @Column({ comment: "先买后付手续费", type: "double", nullable: true })
  sellerPaylaterHandlingFeeAmount: number;

  @Column({ comment: "DT配送手续费", type: "double", nullable: true })
  dtHandlingFeeAmount: number;

  @Column({ comment: "联盟营销佣金收入", type: "double", nullable: true })
  affiliateCommissionDeposit: number;

  @Column({ comment: "联盟佣金释放", type: "double", nullable: true })
  affiliateCommissionRelease: number;

  @Column({ comment: "TapShop广告佣金", type: "double", nullable: true })
  tapShopAdsCommission: number;

  @Column({ comment: "物流保障服务费", type: "double", nullable: true })
  shippingFeeGuaranteeServiceFee: number;

  @Column({ comment: "合规服务费", type: "double", nullable: true })
  eprPobServiceFeeAmount: number;

  @Column({ comment: "单件商品销售服务费", type: "double", nullable: true })
  feePerItemSoldAmount: number;

  @Column({ comment: "安装服务费", type: "double", nullable: true })
  installationServiceFee: number;

  @Column({ comment: "共同资助创作者奖金", type: "double", nullable: true })
  cofundedCreatorBonusAmount: number;

  @Column({ comment: "配送失败补贴金额", type: "double", nullable: true })
  failedDeliverySubsidyAmount: number;

  @Column({ comment: "FBT免运费金额", type: "double", nullable: true })
  fbtFreeShippingFeeAmount: number;

  @Column({ comment: "免费退货补贴金额", type: "double", nullable: true })
  freeReturnSubsidyAmount: number;

  @Column({ comment: "卖家运费退回", type: "double", nullable: true })
  returnShippingFeePaidBuyerAmount: number;

  @Column({ comment: "退货标签费用", type: "double", nullable: true })
  returnShippingLabelFeeAmount: number;

  @Column({ comment: "物流保障服务费报销", type: "double", nullable: true })
  shippingFeeGuaranteeReimbursement: number;

  @Column({ comment: "促销运费激励金额", type: "double", nullable: true })
  promoShippingIncentiveAmount: number;

  @Column({ comment: "退货运费补偿款", type: "double", nullable: true })
  returnRefundSubsidyAmount: number;

  @Column({ comment: "FBT发货费补偿款", type: "double", nullable: true })
  fbtFulfillmentFeeReimbursementAmount: number;

  @Column({ comment: "??totalSum??", type: "json", nullable: true })
  totalSum: any;

  @Column({ comment: "??JSON??", type: "json", nullable: true })
  raw_data: any;
}
