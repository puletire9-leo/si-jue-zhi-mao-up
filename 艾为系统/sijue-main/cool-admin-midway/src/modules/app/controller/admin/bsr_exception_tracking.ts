import { Provide, Inject } from '@midwayjs/decorator';
import { BaseController, CoolController } from '@cool-midway/core';
import { Post, Body } from '@midwayjs/core';
import { AppAmzBsrExceptionTrackingEntity } from '../../entity/bsr_exception_tracking';
import { AppAmzBsrExceptionTrackingService } from '../../service/bsr_exception_tracking';

@Provide()
@CoolController({
    api: ['add', 'delete', 'update', 'info', 'list', 'page'],
    entity: AppAmzBsrExceptionTrackingEntity,
    service: AppAmzBsrExceptionTrackingService,
    pageQueryOp: {
        // 精确匹配字段
        fieldEq: ['exception_type', 'status', 'sid', 'order_sn', 'msku', 'asin', 'plan_sn', 'sku'],
        // 仅保留少量模糊搜索（产品名、原因备注）
        keyWordLikeFields: ['product_name', 'reason', 'store_name', 'msku'],
    },
})
export class AppAmzBsrExceptionTrackingController extends BaseController {
    @Inject()
    exceptionTrackingService: AppAmzBsrExceptionTrackingService;

    /**
     * 提交异常记录（支持批量）
     */
    @Post('/submit', { summary: '提交异常记录' })
    async submit(@Body() params: any) {
        const result = await this.exceptionTrackingService.submit(params);
        return this.ok(result);
    }

    /**
     * 更新异常状态（处理中/已解决/已关闭）
     */
    @Post('/updateStatus', { summary: '更新异常状态' })
    async updateStatus(@Body() params: any) {
        const result = await this.exceptionTrackingService.updateStatus(params);
        return this.ok(result);
    }

    /**
     * 获取异常统计数据（各状态数量，用于角标等）
     */
    @Post('/stats', { summary: '获取异常统计' })
    async stats() {
        const result = await this.exceptionTrackingService.getStats();
        return this.ok(result);
    }

    /**
     * 获取异常详情：包括关联的采购单信息 + 采购单子项列表
     */
    @Post('/detail', { summary: '获取异常详情(含关联数据)' })
    async detail(@Body('id') id: number) {
        const result = await this.exceptionTrackingService.getDetail(id);
        return this.ok(result);
    }

    /**
     * 获取当前表中已有的店铺列表（去重），用于前端筛选下拉
     */
    @Post('/storeOptions', { summary: '获取店铺筛选选项' })
    async storeOptions() {
        const result = await this.exceptionTrackingService.getStoreOptions();
        return this.ok(result);
    }
}
