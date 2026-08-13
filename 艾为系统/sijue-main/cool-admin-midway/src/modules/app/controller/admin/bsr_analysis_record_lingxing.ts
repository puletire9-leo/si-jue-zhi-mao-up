import { Provide, Inject, Controller, Post, Body } from '@midwayjs/decorator';
import { BaseController, CoolController } from '@cool-midway/core';
import { AppAmzBsrAnalysisRecordLingxingEntity } from '../../entity/bsr_analysis_record_lingxing';
import { AppAmzBsrAnalysisRecordLingxingService } from '../../service/bsr_analysis_record_lingxing';

@Provide()
@CoolController({
    api: ['add', 'delete', 'update', 'info', 'list', 'page'],
    entity: AppAmzBsrAnalysisRecordLingxingEntity,
    service: AppAmzBsrAnalysisRecordLingxingService,
})
export class AppAmzBsrAnalysisRecordLingxingController extends BaseController {
    @Inject()
    analysisRecordService: AppAmzBsrAnalysisRecordLingxingService;

    /**
     * 保存暂存记录
     */
    @Post('/save', { summary: '保存暂存记录' })
    async save(@Body() param: any) {
        const result = await this.analysisRecordService.saveTemp(param);
        return this.ok(result);
    }

    /**
     * 获取最新暂存信息 (回显用)
     */
    @Post('/latest', { summary: '获取最新暂存信息' })
    async getLatest(@Body() param: any) {
        const result = await this.analysisRecordService.getLatest(param);
        // 这里如果 result 是 null 也可以返回 null，前端拿到 null 就不填充
        return this.ok(result);
    }

    /**
     * 完结记录 (生成补货单成功)
     */
    @Post('/finish', { summary: '完结记录' })
    async finish(@Body() param: any) {
        await this.analysisRecordService.finish(param.id);
        return this.ok();
    }

    /**
     * 获取所有有 plan_sn 的已完结记录
     * 用于同步时补全 purchase_plan 表
     */
    @Post('/getWithPlanSn', { summary: '获取有plan_sn的记录' })
    async getWithPlanSn() {
        const result = await this.analysisRecordService.getWithPlanSn();
        return this.ok(result);
    }

    /**
     * 批量获取暂存历史记录
     * 用于列表页"暂存总数"列批量获取
     */
    @Post('/getHistoryBatch', { summary: '批量获取暂存历史' })
    async getHistoryBatch(@Body() param: any) {
        const result = await this.analysisRecordService.getHistoryBatch(param);
        return this.ok(result);
    }

    /**
     * 获取历史分析记录列表
     * 用于前端「历史记录」Tab 展示
     */
    @Post('/getHistory', { summary: '获取历史记录列表' })
    async getHistory(@Body() param: any) {
        const result = await this.analysisRecordService.getHistory(param);
        return this.ok(result);
    }
}
