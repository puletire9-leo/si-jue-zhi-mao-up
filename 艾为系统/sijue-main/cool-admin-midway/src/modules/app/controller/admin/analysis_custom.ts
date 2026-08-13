import { CoolController, BaseController } from '@cool-midway/core';
import { Inject, Post, Body } from '@midwayjs/core';
import { AppAnalysisCustomService } from '../../service/analysis_custom';
import { LingXingUtils } from '../../utils/lingxing/lingxingUtils';

/**
 * 分析模态框自定义接口
 * 专门用于处理 2026 vs 2025 销售对比、库销比计算
 */
@CoolController('/admin/app/analysis')
export class AdminAppAnalysisCustomController extends BaseController {
    @Inject()
    analysisService: AppAnalysisCustomService;

    @Inject()
    lingxingUtils: LingXingUtils;

    /**
     * 获取分析图表所需的所有聚合数据
     * 包含：柱状图汇总数据、库销比、当前库存状态
     * 
     * @param product_code 产品编码（汇总该编码下所有选品的竞品数据）
     * @param marketplace 国家/站点
     * @param asin 当前选品的ASIN（用于查询库存数据，可选）
     * @param shop 当前选品的店铺名称（用于精确匹配 restocking 表）
     */
    @Post('/getData')
    async getData(
        @Body('product_code') product_code: string,
        @Body('marketplace') marketplace: string,
        @Body('asin') asin?: string,
        @Body('shop') shop?: string
    ) {
        if (!product_code || !marketplace) {
            return this.fail('缺少必要参数: product_code 或 marketplace');
        }

        try {
            const data = await this.analysisService.getAnalysisData(product_code, marketplace, asin, shop);
            return this.ok(data);
        } catch (error) {
            console.error('获取分析数据失败:', error);
            return this.fail('获取分析数据失败: ' + error.message);
        }
    }

    /**
     * 获取关键词搜索趋势
     * 注意：不再依赖 asin 做关联，同一 product_code + marketplace 下共享关键词
     */
    @Post('/getKeywords')
    async getKeywords(
        @Body('asin') asin: string,
        @Body('marketplace') marketplace: string,
        @Body('product_code') product_code: string
    ) {
        if (!marketplace || !product_code) {
            return this.fail('缺少必要参数: marketplace 或 product_code');
        }

        try {
            const data = await this.analysisService.getKeywordTrendData(marketplace, product_code);
            return this.ok(data);
        } catch (error) {
            console.error('获取关键词数据失败:', error);
            return this.fail('获取关键词数据失败: ' + error.message);
        }
    }

    /**
     * 领星销量统计接口测试
     * 可自由传参测试，分析返回数据格式
     * 
     * @param start_date 开始日期，格式 Y-m-d，如 "2025-12-01"
     * @param end_date 结束日期，格式 Y-m-d，如 "2025-12-31"
     * @param date_unit 统计时间指标：1=年, 2=月, 3=周, 4=日
     * @param result_type 汇总类型：1=销量, 2=订单量, 3=销售额
     * @param data_type 数据维度：1=ASIN, 2=父体, 3=MSKU, 4=SKU, 5=SPU, 6=店铺
     * @param page 分页页码，默认1
     * @param length 分页大小，默认20
     * @param sids 店铺ID数组 (可选)
     */
    @Post('/testSalesStat')
    async testSalesStat(
        @Body('start_date') start_date: string = '2025-12-01',
        @Body('end_date') end_date: string = '2025-12-31',
        @Body('date_unit') date_unit: string = '2',
        @Body('result_type') result_type: string = '1',
        @Body('data_type') data_type: string = '3',
        @Body('page') page: number = 1,
        @Body('length') length: number = 20,
        @Body('sids') sids?: string[]
    ) {
        try {
            await this.lingxingUtils.init();

            const params: Record<string, any> = {
                start_date,
                end_date,
                date_unit,
                result_type,
                data_type,
                page,
                length
            };

            if (sids && sids.length > 0) {
                params.sids = sids;
            }

            console.log('调用领星销量统计接口，参数:', JSON.stringify(params, null, 2));

            const result = await this.lingxingUtils.httpPost(
                '/basicOpen/platformStatisticsV2/saleStat/pageList',
                params,
                true // return_raw_response
            );

            return this.ok({
                requestParams: params,
                response: result
            });
        } catch (error) {
            console.error('领星销量统计接口调用失败:', error);
            return this.fail('接口调用失败: ' + error.message);
        }
    }

    /**
     * 获取我的销量数据
     * @param product_code 产品编码
     * @param marketplace 站点
     */
    @Post('/getMySales')
    async getMySales(
        @Body('product_code') product_code: string,
        @Body('marketplace') marketplace: string
    ) {
        if (!product_code || !marketplace) {
            return this.fail('缺少必要参数: product_code 或 marketplace');
        }

        try {
            const data = await this.analysisService.getMySalesData(product_code, marketplace, false);
            return this.ok(data);
        } catch (error) {
            console.error('获取我的销量数据失败:', error);
            return this.fail('获取我的销量数据失败: ' + error.message);
        }
    }

    /**
     * 强制刷新我的销量数据
     * 忽略缓存，重新请求领星 API
     * @param product_code 产品编码
     * @param marketplace 站点
     */
    @Post('/refreshMySales')
    async refreshMySales(
        @Body('product_code') product_code: string,
        @Body('marketplace') marketplace: string
    ) {
        if (!product_code || !marketplace) {
            return this.fail('缺少必要参数: product_code 或 marketplace');
        }

        try {
            const data = await this.analysisService.forceRefreshMySales(product_code, marketplace);
            return this.ok(data);
        } catch (error) {
            console.error('刷新我的销量数据失败:', error);
            return this.fail('刷新我的销量数据失败: ' + error.message);
        }
    }

    /**
     * 获取促销活动数据（独立接口，不阻塞主数据加载）
     * @param product_code 产品编码
     * @param marketplace 站点
     * @param asin 当前分析的 ASIN（只查这一个的促销）
     * @param forceRefresh 是否强制刷新（忽略今天已同步）
     */
    @Post('/getPromotions')
    async getPromotions(
        @Body('product_code') product_code: string,
        @Body('marketplace') marketplace: string,
        @Body('asin') asin: string,
        @Body('forceRefresh') forceRefresh: boolean = false
    ) {
        if (!asin || !marketplace) {
            return this.fail('缺少必要参数: asin 或 marketplace');
        }

        try {
            const data = await this.analysisService.getPromotionData(asin, marketplace, forceRefresh);
            return this.ok(data);
        } catch (error) {
            console.error('获取促销数据失败:', error);
            return this.fail('获取促销数据失败: ' + error.message);
        }
    }

    /**
     * 获取日历模式所需的系数数据
     * 专门为日历模式服务，支持灵活的时间范围，自动回溯查询所需的历史数据
     * @param product_code 产品编码
     * @param marketplace 站点
     * @param asin 当前分析的 ASIN
     * @param startMonth 起始月份 (YYYY-MM 格式)
     * @param endMonth 结束月份 (YYYY-MM 格式)
     */
    @Post('/getCalendarData')
    async getCalendarData(
        @Body('product_code') product_code: string,
        @Body('marketplace') marketplace: string,
        @Body('asin') asin: string,
        @Body('startMonth') startMonth: string,
        @Body('endMonth') endMonth: string,
        @Body('alpha') alpha?: number,
        @Body('monthlyAlphas') monthlyAlphas?: Record<string, number>,
        @Body('listing_id') listing_id?: number,
        @Body('msku') msku?: string,
        @Body('store_id') store_id?: number
    ) {
        if (!product_code || !marketplace) {
            return this.fail('缺少必要参数: product_code 或 marketplace');
        }

        if (!startMonth || !endMonth) {
            return this.fail('缺少必要参数: startMonth 或 endMonth');
        }

        // α 范围校验
        if (alpha !== undefined && alpha !== null) {
            const num = Number(alpha);
            if (!Number.isFinite(num) || num < 0 || num > 1) {
                return this.fail(`alpha 必须在 0~1 之间，当前值: ${alpha}`);
            }
        }
        if (monthlyAlphas) {
            for (const [month, val] of Object.entries(monthlyAlphas)) {
                const num = Number(val);
                if (!Number.isFinite(num) || num < 0 || num > 1) {
                    return this.fail(`monthlyAlphas["${month}"] 必须在 0~1 之间，当前值: ${val}`);
                }
            }
        }

        try {
            // listing 反查覆盖：确保 listing_id 和 product_code/asin 等字段一致
            let resolvedProductCode = product_code;
            let resolvedMarketplace = marketplace;
            let resolvedAsin = asin;
            let resolvedListingId = listing_id;
            let resolvedMsku = msku;
            let resolvedStoreId = store_id;

            // 定位规则：listing_id 优先 → 5自然键兜底 → 都失败就报错
            const listingRepo = (this.analysisService as any).listingRepo;
            let resolvedListing: any = null;

            if (listing_id && listingRepo) {
                // 方式1：listing_id 主键直接匹配
                resolvedListing = await listingRepo.findOne({
                    where: { id: listing_id },
                    select: ['id', 'product_code', 'asin', 'marketplace', 'store_id', 'msku']
                });
                if (!resolvedListing) {
                    return this.fail(`listing_id=${listing_id} 在产品表中不存在，请检查数据一致性`);
                }
            }

            if (!resolvedListing && listingRepo && product_code && marketplace && asin && msku && store_id) {
                // 方式2：5个自然键匹配
                resolvedListing = await listingRepo.findOne({
                    where: { product_code, marketplace, asin, msku, store_id },
                    select: ['id', 'product_code', 'asin', 'marketplace', 'store_id', 'msku']
                });
            }

            // 必须成功定位到 listing 记录才允许继续计算
            if (!resolvedListing) {
                return this.fail('无法通过 listing_id 或 5 自然键定位到产品记录');
            }

            // 以 listing 表为准覆盖前端字段
            resolvedProductCode = resolvedListing.product_code || resolvedProductCode;
            resolvedMarketplace = resolvedListing.marketplace || resolvedMarketplace;
            resolvedAsin = resolvedListing.asin || resolvedAsin;
            resolvedMsku = resolvedListing.msku || resolvedMsku;
            resolvedStoreId = resolvedListing.store_id || resolvedStoreId;
            resolvedListingId = resolvedListing.id;

            const data = await this.analysisService.getCalendarCoefficients(
                resolvedProductCode,
                resolvedMarketplace,
                startMonth,
                endMonth,
                alpha,
                monthlyAlphas,
                resolvedAsin,
                resolvedListingId,
                resolvedMsku,
                resolvedStoreId
            );
            return this.ok(data);
        } catch (error) {
            console.error('获取日历系数数据失败:', error);
            return this.fail('获取日历系数数据失败: ' + error.message);
        }
    }

    /**
     * 批量获取本地产品装箱数（cg_box_pcs）
     * 供批量补货分析弹窗使用，不依赖外部 Listing 模块。
     */
    @Post('/getLocalProductBoxPcsBatch')
    async getLocalProductBoxPcsBatch(@Body('items') items: any[] = []) {
        try {
            const data = await this.analysisService.getLocalProductBoxPcsBatch(items);
            return this.ok(data);
        } catch (error) {
            console.error('批量获取本地产品装箱数失败:', error);
            return this.fail('批量获取本地产品装箱数失败: ' + error.message);
        }
    }

    /**
     * 调试本地产品详情接口，返回领星原始响应。
     */
    @Post('/debugLocalProductInfo')
    async debugLocalProductInfo(@Body() param: any) {
        try {
            const data = await this.analysisService.debugLocalProductInfo(param);
            return this.ok(data);
        } catch (error) {
            console.error('调试本地产品详情接口失败:', error);
            return this.fail('调试本地产品详情接口失败: ' + error.message);
        }
    }

    /**
     * 批量查询目标库存天数。
     */
    @Post('/getTargetStockDaysBatch')
    async getTargetStockDaysBatch(@Body('items') items: any[] = []) {
        try {
            const data = await this.analysisService.getTargetStockDaysBatch(items);
            return this.ok(data);
        } catch (error) {
            console.error('批量查询目标库存天数失败:', error);
            return this.fail('批量查询目标库存天数失败: ' + error.message);
        }
    }

    /**
     * 保存目标库存天数。
     */
    @Post('/saveTargetStockDays')
    async saveTargetStockDays(@Body() param: any) {
        try {
            const data = await this.analysisService.saveTargetStockDays(param);
            return this.ok(data);
        } catch (error) {
            console.error('保存目标库存天数失败:', error);
            return this.fail('保存目标库存天数失败: ' + error.message);
        }
    }

    /**
     * 批量查询波动系数。
     */
    @Post('/getVolatilityCoefficientBatch')
    async getVolatilityCoefficientBatch(@Body('items') items: any[] = []) {
        try {
            const data = await this.analysisService.getVolatilityCoefficientBatch(items);
            return this.ok(data);
        } catch (error) {
            console.error('批量查询波动系数失败:', error);
            return this.fail('批量查询波动系数失败: ' + error.message);
        }
    }

    /**
     * 保存波动系数。
     */
    @Post('/saveVolatilityCoefficient')
    async saveVolatilityCoefficient(@Body() param: any) {
        try {
            const data = await this.analysisService.saveVolatilityCoefficient(param);
            return this.ok(data);
        } catch (error) {
            console.error('保存波动系数失败:', error);
            return this.fail('保存波动系数失败: ' + error.message);
        }
    }

    /**
     * 批量查询单品运输方式偏好。
     */
    @Post('/getShippingMethodPrefsBatch')
    async getShippingMethodPrefsBatch(@Body('items') items: any[] = []) {
        try {
            const data = await this.analysisService.getShippingMethodPrefsBatch(items);
            return this.ok(data);
        } catch (error) {
            console.error('批量查询运输方式偏好失败:', error);
            return this.fail('批量查询运输方式偏好失败: ' + error.message);
        }
    }

    /**
     * 保存单品运输方式偏好。
     */
    @Post('/saveShippingMethodPrefs')
    async saveShippingMethodPrefs(@Body() param: any) {
        try {
            const data = await this.analysisService.saveShippingMethodPrefs(param);
            return this.ok(data);
        } catch (error) {
            console.error('保存运输方式偏好失败:', error);
            return this.fail('保存运输方式偏好失败: ' + error.message);
        }
    }

    /**
     * 批量计算目标库存天数对应的总量补货建议。
     * 只做实时计算，不保存计算结果。
     */
    @Post('/calculateTargetReplenishmentBatch')
    async calculateTargetReplenishmentBatch(
        @Body('items') items: any[] = [],
        @Body('defaultTargetDays') defaultTargetDays?: number
    ) {
        try {
            const data = await this.analysisService.calculateTargetReplenishmentBatch(items, defaultTargetDays);
            return this.ok(data);
        } catch (error) {
            console.error('批量计算目标补货建议失败:', error);
            return this.fail('批量计算目标补货建议失败: ' + error.message);
        }
    }

    /**
     * 批量同步所有促销数据（供定时任务管理系统调用）
     * 无需参数，自动查找所有需要更新的记录并逐组同步
     * 建议配置为每天凌晨执行
     */
    @Post('/batchSyncPromotions')
    async batchSyncPromotions() {
        try {
            const result = await this.analysisService.batchSyncAllPromotions();
            return this.ok(result);
        } catch (error) {
            console.error('批量同步促销数据失败:', error);
            return this.fail('批量同步促销数据失败: ' + error.message);
        }
    }
}

