import { Provide, Inject } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In } from 'typeorm';
import { AppAmzBsrShipmentActualLingxingEntity } from '../entity/bsr_shipment_actual_lingxing';
import { AppAmzBsrShipmentPlanLingxingEntity } from '../entity/bsr_shipment_plan_lingxing';
import { LingXingUtils } from '../utils/lingxing/lingxingUtils';
import * as dayjs from 'dayjs';

/**
 * FBA发货单实际数据服务
 * 从领星 getInboundShipmentList 接口拉取发货单数据
 * 通过 isp_id 与发货计划表一对一关联
 */
@Provide()
export class AppAmzBsrShipmentActualLingxingService extends BaseService {
    @InjectEntityModel(AppAmzBsrShipmentActualLingxingEntity)
    shipmentActualRepo: Repository<AppAmzBsrShipmentActualLingxingEntity>;

    @InjectEntityModel(AppAmzBsrShipmentPlanLingxingEntity)
    shipmentPlanRepo: Repository<AppAmzBsrShipmentPlanLingxingEntity>;

    @Inject()
    private lingxingUtils: LingXingUtils;

    // 终态状态（第1层 status 字段，有文档明确说明）
    // 2=已完成, 3=已作废 → 不再需要更新
    private readonly FINAL_SHIPMENT_STATUSES = [2, 3];

    // 发货单状态映射（第1层 status → 中文名）
    private readonly SHIPMENT_STATUS_MAP: Record<number, string> = {
        '-1': '待配货',
        '0': '待发货',
        '1': '已发货',
        '2': '已完成',
        '3': '已作废'
    };

    // ============================================================
    // ==================== 模式A：全量同步 ========================
    // ============================================================

    /**
     * 按时间范围全量拉取发货单数据
     * 自动翻页，全部数据存入本地
     * @param startDate 开始日期，不传则取表里最大同步时间 或 2020-01-01
     * @param endDate 结束日期，不传则为今天
     */
    async syncByTimeRange(startDate?: string, endDate?: string): Promise<{
        totalFetched: number;
        totalUpserted: number;
        pages: number;
    }> {
        // 确定起止时间
        if (!endDate) {
            endDate = dayjs().format('YYYY-MM-DD') + ' 23:59:59';
        }
        if (!startDate) {
            // 从表里取最大同步时间
            const maxSyncRow = await this.shipmentActualRepo
                .createQueryBuilder('t')
                .select('MAX(t.last_sync_time)', 'maxTime')
                .getRawOne();
            if (maxSyncRow?.maxTime) {
                startDate = dayjs(maxSyncRow.maxTime).format('YYYY-MM-DD') + ' 00:00:00';
            } else {
                startDate = '2020-01-01 00:00:00';
            }
        }

        console.log(`[syncByTimeRange] 开始全量同步: ${startDate} ~ ${endDate}`);

        const PAGE_SIZE = 200;
        let offset = 0;
        let totalFetched = 0;
        let totalUpserted = 0;
        let pages = 0;

        // 翻页循环
        while (true) {
            const body = {
                time_type: 4,       // 4=更新时间(精确到时分秒)，用于增量同步
                start_date: startDate,
                end_date: endDate,
                offset,
                length: PAGE_SIZE
            };

            console.log(`[syncByTimeRange] 正在拉取第${pages + 1}页 (offset=${offset})...`);

            let res: any;
            try {
                res = await this.lingxingUtils.httpPost(
                    '/erp/sc/routing/storage/shipment/getInboundShipmentList',
                    body,
                    true
                );
            } catch (err) {
                console.error(`[syncByTimeRange] 接口请求失败:`, err.message);
                break;
            }

            if (!res || Number(res.code) !== 0 || !res.data) {
                console.warn(`[syncByTimeRange] 接口返回异常:`, JSON.stringify(res));
                break;
            }

            const list = res.data.list || [];
            const total = res.data.total || 0;

            if (list.length === 0) {
                console.log(`[syncByTimeRange] 本页无数据，拉取结束`);
                break;
            }

            // 解析并落库
            const upserted = await this.upsertFromApiData(list);
            totalFetched += list.length;
            totalUpserted += upserted;
            pages++;

            console.log(`[syncByTimeRange] 第${pages}页: 拉取${list.length}条发货单, 落库${upserted}条明细, 总计${total}条`);

            // 判断是否还有下一页
            offset += PAGE_SIZE;
            if (offset >= total) {
                console.log(`[syncByTimeRange] 已拉完全部${total}条`);
                break;
            }

            // 防限流，间隔1秒
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`[syncByTimeRange] 全量同步完成: 拉取${totalFetched}条发货单, 落库${totalUpserted}条明细, 共${pages}页`);
        return { totalFetched, totalUpserted, pages };
    }

    // ============================================================
    // ==================== 模式B：精准同步 ========================
    // ============================================================

    /**
     * 按 SKU 列表精准拉取发货单数据
     * 只拉取和我们发货计划相关的 SKU
     * @param skus 要同步的 SKU 数组，不传则自动从发货计划表中获取
     */
    async syncBySkuList(skus?: string[]): Promise<{
        totalSkus: number;
        totalUpserted: number;
        skippedFinal: number;
    }> {
        // 如果没有传入 SKU，从发货计划表中自动获取（排除已终态的）
        if (!skus || skus.length === 0) {
            const planRows = await this.shipmentPlanRepo
                .createQueryBuilder('p')
                .select('DISTINCT p.sku', 'sku')
                .where('p.sku IS NOT NULL')
                .andWhere("p.sku <> ''")
                .getRawMany();
            skus = planRows.map((r: any) => r.sku).filter(Boolean);
        }

        if (skus.length === 0) {
            console.warn('[syncBySkuList] 无可同步的 SKU');
            return { totalSkus: 0, totalUpserted: 0, skippedFinal: 0 };
        }

        // 查出已终态的 ispr_id（用 ispr_id 而不是 isp_id，因为一个计划可能拆成多张发货单）
        const finalRows = await this.shipmentActualRepo
            .createQueryBuilder('t')
            .select('t.ispr_id', 'ispr_id')
            .where('t.is_final = 1')
            .getRawMany();
        const finalIsprIds = new Set(finalRows.map((r: any) => r.ispr_id));

        console.log(`[syncBySkuList] 开始精准同步: ${skus.length}个SKU, ${finalIsprIds.size}个已终态跳过`);

        let totalUpserted = 0;
        let skippedFinal = 0;

        for (let i = 0; i < skus.length; i++) {
            const sku = skus[i];
            console.log(`[syncBySkuList] 正在同步 SKU: ${sku} (${i + 1}/${skus.length})`);

            try {
                // 翻页拉取该 SKU 的所有发货单
                let offset = 0;
                const PAGE_SIZE = 200;

                while (true) {
                    const body = {
                        search_field: 'sku',
                        search_value: sku,
                        offset,
                        length: PAGE_SIZE
                    };

                    const res: any = await this.lingxingUtils.httpPost(
                        '/erp/sc/routing/storage/shipment/getInboundShipmentList',
                        body,
                        true
                    );

                    if (!res || Number(res.code) !== 0 || !res.data) {
                        console.warn(`[syncBySkuList] SKU=${sku} 接口异常:`, JSON.stringify(res));
                        break;
                    }

                    const list = res.data.list || [];
                    const total = res.data.total || 0;

                    if (list.length === 0) break;

                    const upserted = await this.upsertFromApiData(list, finalIsprIds);
                    totalUpserted += upserted;

                    offset += PAGE_SIZE;
                    if (offset >= total) break;

                    // 防限流
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (err) {
                console.error(`[syncBySkuList] SKU=${sku} 同步失败:`, err.message);
            }

            // SKU 之间也间隔一下，避免限流
            if (i < skus.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log(`[syncBySkuList] 精准同步完成: ${skus.length}个SKU, 落库${totalUpserted}条`);
        return { totalSkus: skus.length, totalUpserted, skippedFinal };
    }

    // ============================================================
    // ==================== 数据解析 & 落库 ========================
    // ============================================================

    /**
     * 解析领星接口返回的发货单数据，拍扁三层结构并 upsert 入库
     * @param shipmentList 领星接口返回的 data.list
     * @param skipIsprIds 可选，已终态的 ispr_id 集合，跳过不更新
     * @returns 落库行数
     */
    async upsertFromApiData(
        shipmentList: any[],
        skipIsprIds?: Set<number>
    ): Promise<number> {
        const now = new Date();
        let count = 0;

        for (const shipment of shipmentList) {
            // 第1层：发货单主信息
            const shipmentSn = shipment.shipment_sn;
            const shipmentStatus = shipment.status;
            const shipmentStatusName = shipment.status_name || this.SHIPMENT_STATUS_MAP[shipment.status] || `状态${shipment.status}`;
            const shipmentTime = shipment.shipment_time_second || shipment.shipment_time || '';
            const methodName = shipment.method_name || '';
            const logisticsChannelName = shipment.logistics_channel_name || '';
            const wname = shipment.wname || '';
            const wid = shipment.wid;
            const expectedArrivalDate = shipment.expected_arrival_date || '';
            const createUser = shipment.create_user || '';
            const createTimeRemote = shipment.gmt_create || shipment.create_time || '';
            const updateTimeRemote = shipment.update_time || '';

            // 第2层：遍历产品明细
            const relateList = shipment.relate_list || [];
            for (const relate of relateList) {
                const relateId = relate.id;
                const shipmentId = relate.shipment_id || '';
                const sku = relate.sku || '';
                const msku = relate.msku || '';
                const fnsku = relate.fnsku || '';
                const productName = relate.product_name || '';
                const num = relate.num || 0;
                const applyNum = relate.apply_num || 0;
                const sname = relate.sname || '';
                const sid = relate.sid;
                const nation = relate.nation || '';
                const shipmentStatusMws = relate.shipment_status || '';
                const picUrl = relate.pic_url || '';
                const asin = relate.asin || '';
                const productId = relate.product_id;

                // 第3层：遍历发货计划关联
                const orderList = relate.shipment_order_list || [];
                for (const order of orderList) {
                    const isprId = order.ispr_id;
                    const ispId = order.isp_id;

                    if (!isprId || !ispId) continue;

                    // 跳过已终态的记录（用 ispr_id 判断，精确到每条记录）
                    if (skipIsprIds && skipIsprIds.has(isprId)) continue;

                    // 判断是否终态（用第1层的 status 判断：2=已完成, 3=已作废）
                    const isFinal = this.FINAL_SHIPMENT_STATUSES.includes(shipmentStatus) ? 1 : 0;

                    // 构建实体
                    const entity = new AppAmzBsrShipmentActualLingxingEntity();

                    // 第3层字段
                    entity.ispr_id = isprId;
                    entity.isp_id = ispId;
                    entity.seq = order.seq || '';
                    entity.shipment_plan_sn = order.shipment_plan_sn || '';
                    entity.shipment_plan_quantity = order.shipment_plan_quantity || 0;
                    entity.shipment_mws_quantity = order.shipment_mws_quantity || 0;
                    entity.shipment_list_quantity = order.shipment_list_quantity || 0;

                    // 第1层字段
                    entity.shipment_sn = shipmentSn;
                    entity.shipment_status = shipmentStatus;
                    entity.shipment_status_name = shipmentStatusName;
                    entity.shipment_time = shipmentTime;
                    entity.method_name = methodName;
                    entity.logistics_channel_name = logisticsChannelName;
                    entity.wname = wname;
                    entity.wid = wid;
                    entity.expected_arrival_date = expectedArrivalDate;
                    entity.create_user = createUser;
                    entity.create_time_remote = createTimeRemote;
                    entity.update_time_remote = updateTimeRemote;

                    // 第2层字段
                    entity.relate_id = relateId;
                    entity.shipment_id = shipmentId;
                    entity.sku = sku;
                    entity.msku = msku;
                    entity.fnsku = fnsku;
                    entity.product_name = productName;
                    entity.num = num;
                    entity.apply_num = applyNum;
                    entity.sname = sname;
                    entity.sid = sid;
                    entity.nation = nation;
                    entity.shipment_status_mws = shipmentStatusMws;
                    entity.pic_url = picUrl;
                    entity.asin = asin;
                    entity.product_id = productId;

                    // 本地字段
                    entity.is_final = isFinal;
                    entity.last_sync_time = now;

                    // Upsert: 通过 ispr_id 判断是更新还是插入
                    try {
                        const existing = await this.shipmentActualRepo.findOneBy({ ispr_id: isprId });
                        if (existing) {
                            // 已终态的不再更新（CLOSED/CANCELLED 不会回退）
                            if (existing.is_final === 1) continue;
                            entity.id = existing.id;
                        }
                        await this.shipmentActualRepo.save(entity);
                        count++;
                    } catch (err) {
                        console.error(`[upsertFromApiData] ispr_id=${isprId} 落库失败:`, err.message);
                    }
                }
            }
        }

        return count;
    }

    // ============================================================
    // ==================== 前端查询接口 ==========================
    // ============================================================

    /**
     * 按 isp_id 数组批量查询实际发货数据
     * 给前端用：传入一组 isp_id，返回按 isp_id 分组的实际发货数据
     * 一个 isp_id 可能对应多条发货单（拆分发货的情况）
     */
    async getActualMetricsByIspIds(ispIds: number[]): Promise<Record<number, any>> {
        if (!ispIds || ispIds.length === 0) return {};

        const records = await this.shipmentActualRepo.find({
            where: { isp_id: In(ispIds) }
        });

        const result: Record<number, { totalActualQty: number; details: any[] }> = {};
        for (const r of records) {
            if (!result[r.isp_id]) {
                result[r.isp_id] = { totalActualQty: 0, details: [] };
            }
            result[r.isp_id].totalActualQty += r.shipment_list_quantity || 0;
            result[r.isp_id].details.push({
                ispr_id: r.ispr_id,
                isp_id: r.isp_id,
                seq: r.seq,
                shipment_sn: r.shipment_sn,
                shipment_id: r.shipment_id,
                shipment_list_quantity: r.shipment_list_quantity,
                shipment_plan_quantity: r.shipment_plan_quantity,
                num: r.num,
                sku: r.sku,
                msku: r.msku,
                product_name: r.product_name,
                shipment_status: r.shipment_status,
                shipment_status_name: r.shipment_status_name,
                shipment_status_mws: r.shipment_status_mws,
                shipment_time: r.shipment_time,
                method_name: r.method_name,
                logistics_channel_name: r.logistics_channel_name,
                wname: r.wname,
                expected_arrival_date: r.expected_arrival_date,
                sname: r.sname,
                nation: r.nation,
                is_final: r.is_final,
                last_sync_time: r.last_sync_time
            });
        }

        return result;
    }

    /**
     * 按 seq 数组批量查询实际发货数据
     * 返回按 seq 分组 -> 再按 isp_id 分组的结构
     */
    async getActualMetricsBySeqs(seqs: string[]): Promise<Record<string, {
        totalQty: number;
        items: any[];
    }>> {
        if (!seqs || seqs.length === 0) return {};

        const records = await this.shipmentActualRepo.find({
            where: { seq: In(seqs) }
        });

        const result: Record<string, { totalQty: number; items: any[] }> = {};

        for (const r of records) {
            const seqKey = r.seq || 'unknown';
            if (!result[seqKey]) {
                result[seqKey] = { totalQty: 0, items: [] };
            }
            result[seqKey].totalQty += r.shipment_list_quantity || 0;
            result[seqKey].items.push({
                ispr_id: r.ispr_id,
                isp_id: r.isp_id,
                shipment_sn: r.shipment_sn,
                shipment_id: r.shipment_id,
                shipment_list_quantity: r.shipment_list_quantity,
                sku: r.sku,
                msku: r.msku,
                product_name: r.product_name,
                shipment_status_name: r.shipment_status_name,
                shipment_status_mws: r.shipment_status_mws,
                shipment_time: r.shipment_time,
                method_name: r.method_name,
                wname: r.wname,
                sname: r.sname,
                nation: r.nation,
                expected_arrival_date: r.expected_arrival_date,
                is_final: r.is_final
            });
        }

        return result;
    }

    /**
     * 自定义分页查询 - 发货单列表页面用
     */
    async customPage(params: {
        page?: number;
        size?: number;
        shipment_sn?: string;
        seq?: string;
        sku?: string;
        msku?: string;
        shipment_status?: number;
        link_status?: number;
        keyWord?: string;
        startDate?: string;
        endDate?: string;
    }) {
        const { page = 1, size = 20 } = params;
        const qb = this.shipmentActualRepo.createQueryBuilder('t');

        // 精确匹配
        if (params.shipment_sn) qb.andWhere('t.shipment_sn = :shipment_sn', { shipment_sn: params.shipment_sn });
        if (params.seq) qb.andWhere('t.seq = :seq', { seq: params.seq });
        if (params.sku) qb.andWhere('t.sku = :sku', { sku: params.sku });
        if (params.msku) qb.andWhere('t.msku = :msku', { msku: params.msku });
        if (params.shipment_status !== undefined && params.shipment_status !== null) {
            qb.andWhere('t.shipment_status = :shipment_status', { shipment_status: params.shipment_status });
        }

        // 关联状态筛选：只显示在发货计划表中存在的 isp_id
        if (params.link_status === 1) {
            qb.andWhere(
                "t.isp_id IN (SELECT DISTINCT p.isp_id FROM app_amz_bsr_shipment_plan_lingxing p WHERE p.isp_id IS NOT NULL AND p.isp_id != '' AND p.isp_id != '0')"
            );
        }

        // 模糊搜索
        if (params.keyWord) {
            qb.andWhere(
                '(t.shipment_sn LIKE :kw OR t.seq LIKE :kw OR t.msku LIKE :kw OR t.product_name LIKE :kw OR t.sku LIKE :kw)',
                { kw: `%${params.keyWord}%` }
            );
        }

        // 日期范围
        if (params.startDate) qb.andWhere('t.create_time_remote >= :startDate', { startDate: params.startDate });
        if (params.endDate) qb.andWhere('t.create_time_remote <= :endDate', { endDate: params.endDate + ' 23:59:59' });

        // 排序和分页
        qb.orderBy('t.id', 'DESC');
        const total = await qb.getCount();
        const list = await qb.skip((page - 1) * size).take(size).getMany();

        return { list, pagination: { page, size, total } };
    }
}
