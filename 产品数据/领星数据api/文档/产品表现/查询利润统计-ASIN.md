# 查询利润统计-ASIN

支持查询新版利润统计的 ASIN 维度。

---

## 接口信息

| 项目 | 内容 |
|------|------|
| **API Path** | `/bd/profit/statistics/open/asin/list` |
| **请求协议** | HTTPS |
| **请求方式** | POST |
| **令牌桶容量** | 10 |

---

## 请求参数

| 参数名 | 说明 | 必填 | 类型 | 示例 |
|--------|------|:----:|:----:|------|
| `offset` | 分页偏移量 | 否 | int | 0 |
| `length` | 分页长度，上限 10000 | 否 | int | 1000 |
| `mids` | 站点 ID | 否 | array | [2] |
| `sids` | 店铺 ID，对应查询亚马逊店铺列表接口的 `sid` | 否 | array | [17] |
| `startDate` | 开始时间，双闭区间（开始结束时间间隔最长不能跨度 7 天） | **是** | string | 2022-09-21 |
| `endDate` | 结束时间，双闭区间（开始结束时间间隔最长不能跨度 7 天） | **是** | string | 2022-09-25 |
| `searchField` | 搜索值类型：`asin` | 否 | string | asin |
| `searchValue` | 搜索值 | 否 | array | B07DFKF00SG |
| `currencyCode` | 币种 code | 否 | string | CNY |

### 请求示例

```json
{
    "offset": 0,
    "length": 1,
    "sids": [104],
    "startDate": "2023-07-16",
    "endDate": "2023-07-21",
    "searchField": "asin",
    "searchValue": ["B07DFKF00SG"],
    "currencyCode": "CNY"
}
```

---

## 返回结果

返回格式：Json Object

### 响应参数

| 参数名 | 说明 | 类型 | 示例 |
|--------|------|:----:|------|
| `code` | 状态码，0 成功 | int | |
| `msg` | 消息提示 | string | |
| `data` | 响应数据 | array | |
| `data>>total` | 总数 | int | |
| `data>>records` | 查询数据列表 | array | |
| `data>>records>>totalFbaAndFbmQuantity` | FBA 和 FBM 销量加总，用于计算占比 | int | |
| `data>>records>>totalFbaAndFbmAmount` | FBA 和 FBM 销售额加总，用于计算占比 | number | |
| `data>>records>>id` | 记录 ID（非业务唯一键） | string | |
| `data>>records>>dataDate` | 日期 | string | |
| `data>>records>>isDisplayDetail` | 是否展示明细 | boolean | |
| `data>>records>>detailType` | 明细类型 | object | |
| `data>>records>>smallImageUrl` | 图片 | string | |
| `data>>records>>asin` | ASIN | string | |
| `data>>records>>parentAsin` | 父 ASIN | string | |
| `data>>records>>sid` | 店铺 ID | string | |
| `data>>records>>storeName` | 店铺名 | string | |
| `data>>records>>sids` | 店铺 ID，多个以逗号分隔 | string | |
| `data>>records>>asins` | 列表行对应的所有 ASIN，多个以逗号分隔 | string | |
| `data>>records>>country` | 国家 | string | |
| `data>>records>>countryCode` | 国家简码 | string | |
| `data>>records>>localName` | 品名 | string | |
| `data>>records>>localSku` | SKU | string | |
| `data>>records>>itemName` | 标题 | string | |
| `data>>records>>principalRealname` | 负责人 | string | |
| `data>>records>>listingTagIds` | Listing 标签 ID | string | |
| `data>>records>>categoryName` | 分类 | string | |
| `data>>records>>brandName` | 品牌 | string | |
| `data>>records>>currencyCode` | 币种 | string | |
| `data>>records>>currencyIcon` | 币种符号 | string | |

#### 销量指标

| 参数名 | 说明 | 类型 |
|--------|------|:----:|
| `totalSalesQuantity` | 销量 | int |
| `fbaSalesQuantity` | FBA 销量 | int |
| `fbmSalesQuantity` | FBM 销量 | int |
| `totalReshipQuantity` | 补换货量 | int |
| `reshipFbmProductSalesQuantity` | FBM 补（换）货量 | int |
| `reshipFbmProductSaleRefundsQuantity` | FBM 补（换）货退回量 | int |
| `reshipFbaProductSalesQuantity` | FBA 补（换）货量 | int |
| `reshipFbaProductSaleRefundsQuantity` | FBA 补（换）货退回量 | int |
| `mcFbaFulfillmentFeesQuantity` | 多渠道销量 | int |

#### 广告指标

| 参数名 | 说明 | 类型 |
|--------|------|:----:|
| `totalAdsSales` | 广告销售额 | number |
| `adsSdSales` | SD 广告销售额 | number |
| `adsSpSales` | SP 广告销售额 | number |
| `totalAdsSalesQuantity` | 广告销量 | number |
| `adsSdSalesQuantity` | SD 广告销量 | number |
| `adsSpSalesQuantity` | SP 广告销量 | number |

#### 销售额指标

| 参数名 | 说明 | 类型 |
|--------|------|:----:|
| `totalSalesAmount` | 销售额 | number |
| `fbaSaleAmount` | FBA 销售额 | number |
| `fbmSaleAmount` | FBM 销售额 | number |
| `totalSalesAmountWithTax` | 含税销售额 | number |
| `shippingCredits` | 买家运费 | number |
| `promotionalRebates` | 促销折扣 | number |
| `fbaInventoryCredit` | FBA 库存赔偿 | number |
| `cashOnDelivery` | COD | number |
| `otherInAmount` | 其他收入 | number |
| `giftWrapCredits` | 包装收入 | number |
| `guaranteeClaims` | 买家交易保障索赔额 | number |
| `costOfPoIntegersGranted` | 积分抵减收入 | number |
| `fbaLiquidationProceeds` | 清算收入 | number |
| `fbaLiquidationProceedsAdjustments` | 清算调整 | number |
| `amazonShippingReimbursement` | 亚马逊运费赔偿 | number |
| `safeTReimbursement` | Safe-T 索赔 | number |
| `netcoTransaction` | Netco 交易 | number |
| `reimbursements` | 赔偿收入 | number |
| `clawbacks` | 追索收入 | number |
| `sharedComminglingVatIncome` | 混合 VAT 收入 | number |
| `others` | 其他 | number |

#### 退款指标

| 参数名 | 说明 | 类型 |
|--------|------|:----:|
| `totalSalesRefunds` | 收入退款额 | number |
| `fbaSalesRefunds` | FBA 销售退款额 | number |
| `fbmSalesRefunds` | FBM 销售退款额 | number |
| `shippingCreditRefunds` | 买家运费退款额 | number |
| `giftWrapCreditRefunds` | 买家包装退款额 | number |
| `chargebacks` | 买家拒付 | number |
| `costOfPoIntegersReturned` | 积分抵减退回 | number |
| `promotionalRebateRefunds` | 促销折扣退款额 | number |
| `totalFeeRefunds` | 费用退款额 | number |
| `sellingFeeRefunds` | 平台费退款额 | number |
| `fbaTransactionFeeRefunds` | 发货费退款额 | number |
| `refundAdministrationFees` | 交易费用退款额 | number |
| `otherTransactionFeeRefunds` | 其他订单费退款额 | number |
| `refundForAdvertiser` | 广告退款额 | number |
| `pointsAdjusted` | 积分费用 | number |
| `shippingLabelRefunds` | 运输标签费退款 | number |
| `refundsQuantity` | 退款量 | int |
| `refundsRate` | 退款率 | number |
| `fbaReturnsQuantity` | 退货量 | int |
| `fbaReturnsSaleableQuantity` | 退货量（可售） | int |
| `fbaReturnsUnsaleableQuantity` | 退货量（不可售） | int |

#### 费用指标

| 参数名 | 说明 | 类型 |
|--------|------|:----:|
| `platformFee` | 平台费 | number |
| `fbaDeliveryFee` | FBA 发货费 | number |
| `otherTransactionFees` | 其他订单费用 | number |
| `totalAdsCost` | 广告费 | number |
| `adsSpCost` | SP 广告费 | number |
| `adsSbCost` | SB 广告费 | number |
| `adsSbvCost` | SBV 广告费 | number |
| `adsSdCost` | SD 广告费 | number |
| `sharedCostOfAdvertising` | 差异分摊 | number |
| `sharedAdsAlCost` | Live 广告 | number |
| `sharedAdsCcCost` | 创作者计划 | number |
| `sharedAdsSspaotCost` | TV 广告 | number |
| `sharedAdsSarCost` | 零售商赞助广告 | number |
| `promotionFee` | 推广费 | number |
| `sharedSubscriptionFee` | 订阅费 | number |
| `sharedLdFee` | 秒杀费 | number |
| `sharedCouponFee` | 优惠券 | number |
| `sharedEarlyReviewerProgramFee` | 早期评论人计划 | number |
| `sharedVineFee` | Vine | number |

#### 仓储费指标

| 参数名 | 说明 | 类型 |
|--------|------|:----:|
| `totalStorageFee` | FBA 仓储费 | number |
| `fbaStorageFee` | 月度仓库费 | number |
| `sharedFbaStorageFee` | 月度仓储费差异 | number |
| `longTermStorageFee` | 长期仓储费 | number |
| `sharedLongTermStorageFee` | 长期仓储费差异 | number |
| `sharedStorageRenewalBilling` | 库存续订费用 | number |
| `sharedFbaDisposalFee` | FBA 销毁费 | number |
| `sharedFbaRemovalFee` | FBA 移除费 | number |
| `sharedFbaInboundTransportationProgramFee` | 入仓手续费 | number |
| `sharedLabelingFee` | 标签费 | number |
| `sharedPolybaggingFee` | 塑料包装费 | number |
| `sharedBubblewrapFee` | 泡沫包装费 | number |
| `sharedTapingFee` | 胶带费 | number |
| `sharedFbaCustomerReturnFee` | FBA 卖家退回费 | number |
| `sharedFbaInboundDefectFee` | FBA 仓储费入库缺陷费 | number |
| `sharedFbaOverageFee` | 超量仓储费 | number |
| `sharedAmazonPartneredCarrierShipmentFee` | 合作承运费 | number |
| `sharedFbaInboundConvenienceFee` | 入库配置费 | number |
| `sharedItemFeeAdjustment` | 库存调整费用 | number |
| `sharedOtherFbaInventoryFees` | 其他仓储费 | number |
| `sharedFbaIntegerernationalInboundFee` | FBA 国际物流货运费 | number |

#### 其他费用指标

| 参数名 | 说明 | 类型 |
|--------|------|:----:|
| `adjustments` | 调整费用 | number |
| `totalPlatformOtherFee` | 平台其他费 | number |
| `shippingLabelPurchases` | 运输标签费 | number |
| `sharedChargesToCreditCard` | 信用卡扣款 | number |
| `sharedCarrierShippingLabelAdjustments` | 承运人装运标签调整费 | number |
| `sharedLiquidationsFees` | 清算费 | number |
| `sharedManualProcessingFee` | 人工处理费用 | number |
| `sharedOtherServiceFees` | 其他服务费 | number |

#### 销售税指标

| 参数名 | 说明 | 类型 |
|--------|------|:----:|
| `totalSalesTax` | 销售税 | number |
| `taxCollected` | VAT/GST | number |
| `tcsIgstCollected` | TCS-IGST | number |
| `tcsSgstCollected` | TCS-SGST | number |
| `tcsCgstCollected` | TCS-CGST | number |
| `sharedComminglingVatExpenses` | 混合 VAT | number |
| `sharedTaxAdjustment` | 销售税调整 | number |
| `salesTaxRefund` | 销售税退款额 | number |
| `taxRefunded` | VAT/GST | number |
| `tcsIgstRefunded` | TCS-IGST | number |
| `tcsSgstRefunded` | TCS-SGST | number |
| `tcsCgstRefunded` | TCS-CGST | number |
| `salesTaxWithheld` | 市场税 | number |
| `refundTaxWithheld` | 市场税退款额 | number |
| `tdsSection194ONet` | 混合网路费用 | number |
| `taxCollectedGiftWrap` | 销售税-礼品包装税 | number |
| `taxCollectedShipping` | 销售税-买家运费税 | number |
| `taxCollectedDiscount` | 销售税-促销折扣税 | number |
| `taxCollectedProduct` | 销售税-商品价格税 | number |
| `taxRefundedGiftWrap` | 销售税退款-礼品包装税 | number |
| `taxRefundedShipping` | 销售税退款-买家运费税 | number |
| `taxRefundedDiscount` | 销售税退款-促销折扣税 | number |
| `taxRefundedProduct` | 销售税退款-商品价格税 | number |

#### 成本与利润指标

| 参数名 | 说明 | 类型 |
|--------|------|:----:|
| `customOrderFee` | 订单其他费 | number |
| `customOrderFeePrincipal` | 站外推广费-本金 | number |
| `customOrderFeeCommission` | 站外推广费-佣金 | number |
| `estimateFeeStr` | 预估费用 | array |
| `estimateFeeStr>>id` | 费用 ID | string |
| `estimateFeeStr>>name` | 费用名称 | string |
| `estimateFeeStr>>amount` | 费用金额 | number |
| `cgPrice` | 采购成本 | number |
| `hasCgPriceDetail` | 是否有采购成本明细 | int |
| `hasCgTransportCostsDetail` | 是否有物流（头程）成本明细 | int |
| `cgUnitPrice` | 采购单价 | number |
| `proportionOfCg` | 采购占比 | number |
| `cgTransportCosts` | 头程运费 | number |
| `firstTripUnitPrice` | 头程单价 | number |
| `proportionOfCgTransport` | 头程占比 | number |
| `cgOtherCostsTotal` | 其他成本 | number |
| `cgOtherUnitCosts` | 其他单价 | number |
| `hasCgOtherCostsDetail` | 是否有其他成本明细 | int |
| `proportionOfCgOtherCosts` | 其他成本占比 | number |
| `totalCost` | 合计成本 | number |
| `proportionOfTotalCost` | 合计成本占比 | number |
| `grossProfit` | 毛利润 | number |
| `grossProfitWithTax` | 含税毛利润 | number |
| `grossRate` | 毛利率 | number |
| `grossRateWithTax` | 含税毛利率 | number |

#### 监控信息

| 参数名 | 说明 | 类型 |
|--------|------|:----:|
| `alarmInfo` | 监控信息 | object |
| `alarmInfo>>profitMetric` | 监控指标：amount-销售额，gross-毛利润，gross_percent-毛利率，ads_sped-广告费，ads_sped_percent-广告费占比，warehouse_sped-仓储费，warehouse_sped_percent-仓储费占比 | string |
| `alarmInfo>>valueType` | 数值类型：absolute-绝对值、percent-百分比 | string |
| `alarmInfo>>compareType` | 比较类型：great_than、less_than | string |
| `alarmInfo>>compareValue` | 比较值 | string |

### 成功响应示例

```json
{
    "code": 0,
    "msg": null,
    "data": {
        "records": [
            {
                "totalFbaAndFbmQuantity": 0,
                "totalFbaAndFbmAmount": 0.00,
                "id": "52536",
                "dataDate": "2023-07-18",
                "isDisplayDetail": false,
                "detailType": null,
                "smallImageUrl": "https://xxx/xxx.jpg",
                "asin": "B07DFKF9SG",
                "parentAsin": "B07DFKF9SG",
                "sid": "104",
                "storeName": "A1MQMW3JWPNCBX-US",
                "sids": null,
                "asins": null,
                "country": "美国",
                "countryCode": "US",
                "localName": "123测试",
                "localSku": "23",
                "itemName": "Xenstar Swim Goggles",
                "principalRealname": "xxx",
                "listingTagIds": "907224269891252258,907215400818094343",
                "categoryName": null,
                "brandName": null,
                "currencyCode": "USD  ",
                "currencyIcon": "$     ",
                "totalSalesQuantity": 0,
                "fbaSalesQuantity": 0,
                "fbmSalesQuantity": 0,
                "totalReshipQuantity": 1,
                "totalSalesAmount": 0.00,
                "totalSalesRefunds": -0.01,
                "refundsQuantity": 1,
                "refundsRate": 0.0000,
                "totalCost": 0.00,
                "grossProfit": -0.01,
                "grossProfitWithTax": -0.01,
                "grossRate": 0.0000,
                "grossRateWithTax": 0.0909,
                "alarmInfo": null
            }
        ],
        "total": 1
    }
}
```
