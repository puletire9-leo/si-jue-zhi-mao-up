import { CoolController, BaseController } from '@cool-midway/core';
import { Provide, Inject, Post, Body, Get, Query } from '@midwayjs/decorator';
import { AppAmzBsrPurchaseOrderSyncLingxingEntity } from '../../entity/bsr_purchase_order_sync_lingxing';
import { AppAmzBsrPurchaseOrderLogisticsService } from '../../service/bsr_purchase_order_logistics';
import { AppAmzBsrPurchaseOrderSyncLingxingService } from '../../service/bsr_purchase_order_sync_lingxing';

/**
 * 采购单同步控制器
 */
@Provide()
@CoolController({
    api: ['info', 'list', 'page'],
    entity: AppAmzBsrPurchaseOrderSyncLingxingEntity,
    pageQueryOp: {
        fieldEq: ['status', 'is_deleted_remote'],
        keyWordLikeFields: ['order_sn', 'supplier_name'],
        addOrderBy: { create_time_remote: 'DESC' }
    }
})
export class AdminAppBsrPurchaseOrderSyncLingxingController extends BaseController {
    @Inject()
    purchaseOrderService: AppAmzBsrPurchaseOrderSyncLingxingService;

    @Inject()
    purchaseOrderLogisticsService: AppAmzBsrPurchaseOrderLogisticsService;

    /**
     * 更新采购单 (按游标增量)
     */
    @Post('/sync', { summary: '更新采购单' })
    async sync() {
        const result = await this.purchaseOrderService.smartSync(false);
        return this.ok(result);
    }

    /**
     * 全量重拉采购单 (慎用)
     */
    @Post('/syncForce', { summary: '全量重拉采购单(慎用)' })
    async syncForce() {
        const result = await this.purchaseOrderService.smartSync(true);
        return this.ok(result);
    }

    /**
     * 刷新采购计划备注自动补全候选。
     * 用于后续定时任务或人工补跑，不同步全量采购单。
     */
    @Post('/refreshAutoCompleteCandidates', { summary: '刷新自动补全候选计划' })
    async refreshAutoCompleteCandidates(@Body() body: any) {
        const result = await this.purchaseOrderService.refreshAutoCompleteCandidates(body || {});
        return this.ok(result);
    }

    /**
     * 单条同步
     */
    @Post('/syncSingle', { summary: '同步单个采购单' })
    async syncSingle(@Body() body: any) {
        const result = await this.purchaseOrderService.syncSingle(body.order_sn);
        return this.ok(result);
    }

    /**
     * 按采购单号批量安全同步
     */
    @Post('/syncByOrderSns', { summary: '按采购单号批量同步采购单' })
    async syncByOrderSns(@Body() body: any) {
        const orderSns = Array.isArray(body?.order_sns) ? body.order_sns : [];
        if (orderSns.length === 0) {
            return this.fail('请提供采购单号');
        }
        const result = await this.purchaseOrderService.syncByOrderSns({
            order_sns: orderSns,
            keepLocalOnMissing: body?.keepLocalOnMissing !== false,
        });
        return this.ok(result);
    }

    /**
     * 自定义分页查询
     */
    @Post('/customPage', { summary: '自定义分页查询' })
    async customPage(@Body() body: any) {
        const result = await this.purchaseOrderService.customPage(body);
        return this.ok(result);
    }

    /**
     * 获取采购单详情（含子项）
     */
    @Post('/detail', { summary: '获取采购单详情' })
    async detail(@Body() body: any) {
        const result = await this.purchaseOrderService.getOrderDetail(body.order_sn);
        if (!result) {
            return this.fail('采购单不存在');
        }
        return this.ok(result);
    }

    /**
     * 获取店铺选项列表
     */
    @Post('/getShopList', { summary: '获取店铺选项列表(用于产品视图)' })
    async getShopList() {
        const result = await this.purchaseOrderService.getShopList();
        return this.ok(result);
    }

    /**
     * 获取领星真实发货仓库列表
     */
    @Post('/getWarehouseList', { summary: '获取真实仓库列表(用于发货确认)' })
    async getWarehouseList() {
        const result = await this.purchaseOrderService.getWarehouseList();
        return this.ok(result);
    }

    /**
     * 产品视图 - 分页查询
     */
    @Post('/productViewPage', { summary: '产品视图分页查询' })
    async productViewPage(@Body() body: any) {
        const result = await this.purchaseOrderService.getProductViewPage(body);
        return this.ok(result);
    }

    /**
     * 获取采购单子项列表
     */
    @Post('/items', { summary: '获取采购单子项' })
    async items(@Body() body: any) {
        const result = await this.purchaseOrderService.getOrderItems(body.order_sn);
        return this.ok(result);
    }

    /**
     * 获取采购单子项 - 分页
     */
    @Post('/itemsPage', { summary: '获取采购单子项 - 分页' })
    async itemsPage(@Body() body: any) {
        const { order_sn, page = 1, size = 20, keyWord } = body || {};
        const result = await this.purchaseOrderService.getOrderItemsPage(order_sn, page, size, keyWord);
        return this.ok(result);
    }

    /**
     * 获取未同步计划列表
     */
    @Post('/unsyncedPlans', { summary: '获取未同步计划' })
    async unsyncedPlans(@Body() body: any) {
        const result = await this.purchaseOrderService.getUnsyncedPlans(body);
        return this.ok(result);
    }

    /**
     * 批量计算缺口预测
     */
    @Post('/batchCalculateGap', { summary: '批量计算缺口预测' })
    async batchCalculateGap(@Body() body: any) {
        const result = await this.purchaseOrderService.batchCalculateGap(body);
        return this.ok(result);
    }

    /**
     * 获取物流信息 (懒加载)
     */
    @Post('/getLogistics', { summary: '获取物流信息' })
    async getLogistics(@Body() body: any) {
        const result = await this.purchaseOrderService.getLogisticsWithLazySync(body.order_sn);
        return this.ok(result);
    }

    /**
     * 强制刷新物流信息
     */
    @Post('/forceSyncLogistics', { summary: '强制刷新物流信息' })
    async forceSyncLogistics(@Body() body: any) {
        const result = await this.purchaseOrderService.forceSyncLogistics(body.order_sn);
        return this.ok(result);
    }

    /**
     * 人工确认收货（单个/批量）
     */
    @Post('/confirmReceipt', { summary: '人工确认收货' })
    async confirmReceipt(@Body() body: any) {
        const { order_sns, confirmed = 1, remark = '', source = '' } = body;
        if (!order_sns || !Array.isArray(order_sns) || order_sns.length === 0) {
            return this.fail('请提供采购单号');
        }
        const result = await this.purchaseOrderService.confirmReceipt(order_sns, confirmed, {
            remark,
            source,
        });
        return this.ok(result);
    }

    @Post('/queryLogisticsPackage', { summary: '查询单个物流包裹' })
    async queryLogisticsPackage(@Body() body: any) {
        const result = await this.purchaseOrderLogisticsService.queryPackage(body.package_id || body.id);
        return this.ok(result);
    }

    @Post('/updateLogisticsPhone', { summary: '填写/修改物流手机号' })
    async updateLogisticsPhone(@Body() body: any) {
        const result = await this.purchaseOrderLogisticsService.updatePackagePhone(body);
        return this.ok(result);
    }

    @Post('/markLogisticsPackageMode', { summary: '标记物流包裹查询方式' })
    async markLogisticsPackageMode(@Body() body: any) {
        const result = await this.purchaseOrderLogisticsService.markPackageMode(body);
        return this.ok(result);
    }

    @Post('/logisticsQueryStats', { summary: '快递100调用统计' })
    async logisticsQueryStats(@Body() body: any) {
        const result = await this.purchaseOrderLogisticsService.getQueryStats(body);
        return this.ok(result);
    }

    /**
     * 创建FBA发货计划（按运输方式分组提交到领星）
     */
    @Post('/createShipmentPlan', { summary: '创建FBA发货计划' })
    async createShipmentPlan(@Body() body: any) {
        if (!body.groups || !Array.isArray(body.groups) || body.groups.length === 0) {
            return this.fail('请提供发货计划分组数据');
        }
        const result = await this.purchaseOrderService.createShipmentPlan(body);
        return this.ok(result);
    }

    /**
     * 查询本地发货计划
     */
    @Post('/queryShipmentPlans', { summary: '查询本地发货计划' })
    async queryShipmentPlans(@Body() body: any) {
        const result = await this.purchaseOrderService.queryShipmentPlans(body);
        return this.ok(result);
    }

    /**
     * 刷新发货计划（懒刷新，带4小时冷却）
     */
    @Post('/refreshShipmentPlan', { summary: '刷新发货计划' })
    async refreshShipmentPlan(@Body() body: any) {
        if (!body.seq) {
            return this.fail('请提供批次号');
        }
        const result = await this.purchaseOrderService.refreshShipmentPlan(body.seq, body.force || false);
        return this.ok(result);
    }

    /**
     * 批量查询 Listing 产品的待交付数据
     */
    @Post('/getPendingDeliveryByProducts', { summary: '批量查询Listing产品待交付数据' })
    async getPendingDeliveryByProducts(@Body() body: any) {
        if (!body.products || !Array.isArray(body.products) || body.products.length === 0) {
            return this.fail('请提供产品列表');
        }
        const result = await this.purchaseOrderService.getPendingDeliveryByProducts(body);
        return this.ok(result);
    }

    /**
     * 批量查询 Listing 产品的采购计划数据
     */
    @Post('/getPendingPurchasePlansByProducts', { summary: '批量查询Listing产品采购计划数据' })
    async getPendingPurchasePlansByProducts(@Body() body: any) {
        if (!body.products || !Array.isArray(body.products) || body.products.length === 0) {
            return this.fail('请提供产品列表');
        }
        const result = await this.purchaseOrderService.getPendingPurchasePlansByProducts(body);
        return this.ok(result);
    }
}
