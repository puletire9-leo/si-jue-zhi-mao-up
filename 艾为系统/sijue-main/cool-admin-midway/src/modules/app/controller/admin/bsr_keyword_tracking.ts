import { CoolController, BaseController } from '@cool-midway/core';
import { Body, Inject, Post, Get } from '@midwayjs/decorator';
import { Context } from '@midwayjs/koa';
import { AppAmzBsrKeywordTrackingEntity } from '../../entity/bsr_keyword_tracking';
import { AppAmzBsrKeywordTrackingService } from '../../service/bsr_keyword_tracking';

/**
 * 关键词跟踪管理
 * - CRUD 自动接口：add/delete/update/info/list/page
 * - 自定义接口：startTracking/stopTracking/manualSnapshot/scheduledSnapshotAll
 */
@CoolController({
    api: ['add', 'delete', 'update', 'info', 'list', 'page'],
    entity: AppAmzBsrKeywordTrackingEntity,
    pageQueryOp: {
        keyWordLikeFields: [
            'keyword_value',
            'marketplace',
            'product_code',
            'asin_self',
        ],
        fieldEq: [
            'user_id',
            'marketplace',
            'product_code',
            'asin_self',
            'msku',
            'store_id',
            'listing_id',
            'status',
        ],
        where: async (ctx: Context) => {
            const { userId } = ctx.admin;
            return [
                ['a.user_id = :userId', { userId }],
            ];
        },
    },
})
export class AdminBsrKeywordTrackingController extends BaseController {

    @Inject()
    appAmzBsrKeywordTrackingService: AppAmzBsrKeywordTrackingService;

    /**
     * 开启跟踪
     */
    @Post('/startTracking')
    async startTracking(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.startTracking(body));
    }

    /**
     * 批量开启跟踪（异步采集）
     */
    @Post('/batchStartTracking')
    async batchStartTracking(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.batchStartTracking(body));
    }

    /**
     * 关闭跟踪
     */
    @Post('/stopTracking')
    async stopTracking(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.stopTracking(body));
    }

    /**
     * 批量关闭跟踪
     */
    @Post('/batchStopTracking')
    async batchStopTracking(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.batchStopTracking(body));
    }

    /**
     * 批量关闭当前用户自己的跟踪
     */
    @Post('/batchStopMyTracking')
    async batchStopMyTracking(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.batchStopMyTracking(body));
    }

    /**
     * 手动触发采集（调试用）
     */
    @Post('/manualSnapshot')
    async manualSnapshot(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.manualSnapshot(body));
    }

    /**
     * 定时任务入口：采集所有跟踪中的关键词
     * 可在后台定时任务UI中配置调用
     */
    @Post('/scheduledSnapshotAll')
    async scheduledSnapshotAll(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.scheduledSnapshotAll(body));
    }

    /**
     * 跟踪关键词的 Listing 分页查询
     * 只返回有开启跟踪的 Listing，其余逻辑与原 Listing page 完全一致
     */
    @Post('/trackingListingPage')
    async trackingListingPage(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.trackingListingPage(body));
    }

    /**
     * 跟踪关键词详情分页查询
     * 按店铺权限返回指定 Listing 下的启用跟踪关键词，并按关键词身份去重
     */
    @Post('/trackingKeywordPage')
    async trackingKeywordPage(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.trackingKeywordPage(body));
    }

    /**
     * 根据 keyword_id 列表批量查询关键词信息
     * 返回中文翻译、流量得分、月搜索量等
     */
    @Post('/getKeywordInfoByIds')
    async getKeywordInfoByIds(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.getKeywordInfoByIds(body));
    }

    /**
     * 回填历史快照数据
     * 后台异步执行，前端立即返回
     */
    @Post('/fetchHistoricalSnapshots')
    async fetchHistoricalSnapshots(@Body() body: any) {
        // 异步执行，不等待结果
        this.appAmzBsrKeywordTrackingService.fetchHistoricalSnapshots(body).catch(err => {
            console.error('[历史回填] 异步执行失败:', err?.message || err);
        });
        return this.ok('历史数据回填任务已开始，将在后台执行');
    }

    /**
     * 批量获取多个关键词的快照数据（聚合接口）
     * 一次查出所有快照，替代前端逐个请求
     */
    @Post('/batchSnapshots')
    async batchSnapshots(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.batchSnapshots(body));
    }
    /**
     * 实时查询竞品父体月销量
     * 直接查 app_amz_bsr_candidate_competitor 表的 Main_monthly_sales
     */
    @Post('/competitorMonthlySales')
    async competitorMonthlySales(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.getCompetitorMonthlySales(body));
    }

    /**
     * 查询自己/公司ASIN的30天销量
     * 从 listing 表按 ASIN 聚合 SUM(thirty_volume)
     */
    @Post('/selfCompanyMonthlySales')
    async selfCompanyMonthlySales(@Body() body: any) {
        return this.ok(await this.appAmzBsrKeywordTrackingService.getSelfCompanyMonthlySales(body));
    }
}
