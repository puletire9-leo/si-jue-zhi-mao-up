import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppAmzBsrKeywordTrackingEntity } from '../entity/bsr_keyword_tracking';
import { AppAmzBsrKeywordTrackingSnapshotEntity } from '../entity/bsr_keyword_tracking_snapshot';
import { AppAmzBsrKeywordTrackingSummaryEntity } from '../entity/bsr_keyword_tracking_summary';
import { SifKeywordService } from './sifKeyword';
import { BaseSysUserEntity } from '../../base/entity/sys/user';
import * as dayjs from 'dayjs';
import * as crypto from 'crypto';

/**
 * 关键词跟踪服务
 * - 开启/关闭跟踪
 * - 手动/定时采集快照
 * - ASIN排名分析
 */
@Provide()
export class AppAmzBsrKeywordTrackingService extends BaseService {

    @InjectEntityModel(AppAmzBsrKeywordTrackingEntity)
    keywordTrackingRepo: Repository<AppAmzBsrKeywordTrackingEntity>;

    @InjectEntityModel(AppAmzBsrKeywordTrackingSnapshotEntity)
    keywordTrackingSnapshotRepo: Repository<AppAmzBsrKeywordTrackingSnapshotEntity>;

    @InjectEntityModel(AppAmzBsrKeywordTrackingSummaryEntity)
    keywordTrackingSummaryRepo: Repository<AppAmzBsrKeywordTrackingSummaryEntity>;

    @InjectEntityModel(BaseSysUserEntity)
    userEntity: Repository<BaseSysUserEntity>;

    @Inject()
    sifKeywordService: SifKeywordService;

    @Inject()
    ctx;

    private readonly PRODUCT_TRACKING_KEYWORD_LIMIT = 30;
    private readonly SUMMARY_HISTORY_RETENTION_DAYS = 180;

    private async getAuthorizedSidList(): Promise<number[] | null> {
        const userId = this.ctx?.admin?.userId;
        const username = this.ctx?.admin?.username;

        if (username === 'admin') return null;
        if (!userId) return [];

        const user = await this.userEntity.findOne({ where: { id: userId } });
        if (!Array.isArray(user?.sidList)) return [];

        return user.sidList
            .map((sid: any) => Number(sid))
            .filter((sid: number) => Number.isFinite(sid) && sid > 0);
    }

    private emptyPage(query: any) {
        const page = Math.max(Number(query?.page) || 1, 1);
        const size = Math.max(Number(query?.size) || 20, 1);

        return {
            list: [],
            pagination: {
                page,
                size,
                total: 0,
            },
        };
    }

    private isStoreAuthorized(sidList: number[] | null, storeId: number | string | null | undefined) {
        if (sidList === null) return true;

        const sid = Number(storeId);
        return Number.isFinite(sid) && sid > 0 && sidList.includes(sid);
    }

    private async assertStoreAuthorized(storeId: number | string | null | undefined) {
        const sidList = await this.getAuthorizedSidList();
        if (!this.isStoreAuthorized(sidList, storeId)) {
            throw new CoolCommException('没有该店铺权限');
        }
    }

    private async findUserTrackingByIdentity(userId: number, identity: {
        keyword_value: string;
        marketplace: string;
        product_code: string;
        asin_self: string;
        msku?: string | null;
        store_id?: number | string | null;
    }) {
        const storeId = identity.store_id === undefined || identity.store_id === null || identity.store_id === ''
            ? null
            : Number(identity.store_id);
        const msku = identity.msku === undefined || identity.msku === null ? null : String(identity.msku);

        const qb = this.keywordTrackingRepo
            .createQueryBuilder('t')
            .where('t.user_id = :userId', { userId })
            .andWhere('t.keyword_value = :keyword_value', { keyword_value: identity.keyword_value })
            .andWhere('t.marketplace = :marketplace', { marketplace: identity.marketplace })
            .andWhere('t.product_code = :product_code', { product_code: identity.product_code })
            .andWhere('t.asin_self = :asin_self', { asin_self: identity.asin_self })
            .orderBy('t.id', 'DESC');

        if (Number.isFinite(storeId)) {
            qb.andWhere('t.store_id = :store_id', { store_id: storeId });
        } else {
            qb.andWhere('t.store_id IS NULL');
        }

        if (msku !== null) {
            qb.andWhere('t.msku = :msku', { msku });
        } else {
            qb.andWhere('t.msku IS NULL');
        }

        return qb.getOne();
    }

    private getKeywordTrackingIdentityKey(row: any) {
        return [
            row?.store_id,
            row?.marketplace,
            row?.product_code,
            row?.asin_self,
            row?.msku,
            row?.keyword_value,
        ].map(value => value === undefined || value === null ? '' : String(value).trim()).join('\u0001');
    }

    private getTrackingLatestTime(row: any) {
        const value = row?.last_snapshot_time || row?.updateTime || row?.createTime;
        if (!value) return 0;

        const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
        return Number.isFinite(time) ? time : 0;
    }

    private dedupeKeywordTrackingsByLatest<T extends { id?: number; user_id?: number }>(rows: T[], preferredUserId?: number): T[] {
        const map = new Map<string, T>();

        for (const row of rows) {
            const key = this.getKeywordTrackingIdentityKey(row);
            const current = map.get(key);

            if (!current) {
                map.set(key, row);
                continue;
            }

            const rowIsPreferredUser = !!preferredUserId && Number(row.user_id) === Number(preferredUserId);
            const currentIsPreferredUser = !!preferredUserId && Number(current.user_id) === Number(preferredUserId);
            if (rowIsPreferredUser !== currentIsPreferredUser) {
                if (rowIsPreferredUser) {
                    map.set(key, row);
                }
                continue;
            }

            const rowTime = this.getTrackingLatestTime(row);
            const currentTime = this.getTrackingLatestTime(current);
            if (rowTime > currentTime || (rowTime === currentTime && Number(row.id || 0) > Number(current.id || 0))) {
                map.set(key, row);
            }
        }

        return Array.from(map.values());
    }

    private normalizeTrackingKeyword(value: string) {
        return String(value || '').trim().toLowerCase();
    }

    private getProductTrackingIdentity(identity: {
        store_id?: number | string | null;
        marketplace: string;
        product_code: string;
        asin_self: string;
        msku?: string | null;
    }) {
        const storeId = identity.store_id === undefined || identity.store_id === null || identity.store_id === ''
            ? ''
            : String(identity.store_id).trim();
        const msku = identity.msku === undefined || identity.msku === null ? '' : String(identity.msku).trim();

        return [
            storeId,
            String(identity.marketplace || '').trim(),
            String(identity.product_code || '').trim(),
            String(identity.asin_self || '').trim(),
            msku,
        ].join('|');
    }

    private getProductTrackingLockKey(identity: {
        store_id?: number | string | null;
        marketplace: string;
        product_code: string;
        asin_self: string;
        msku?: string | null;
    }) {
        const hash = crypto
            .createHash('sha1')
            .update(this.getProductTrackingIdentity(identity))
            .digest('hex');
        return `bsr_kw_limit:${hash}`;
    }

    private async withProductTrackingKeywordLock<T>(identity: {
        store_id?: number | string | null;
        marketplace: string;
        product_code: string;
        asin_self: string;
        msku?: string | null;
    }, task: () => Promise<T>): Promise<T> {
        const queryRunner = this.keywordTrackingRepo.manager.connection.createQueryRunner();
        const lockKey = this.getProductTrackingLockKey(identity);
        let locked = false;

        await queryRunner.connect();
        try {
            const rows = await queryRunner.query('SELECT GET_LOCK(?, 5) AS lock_status', [lockKey]);
            locked = Number(rows?.[0]?.lock_status || 0) === 1;
            if (!locked) {
                throw new CoolCommException('关键词跟踪操作繁忙，请稍后重试');
            }

            return await task();
        } finally {
            if (locked) {
                try {
                    await queryRunner.query('SELECT RELEASE_LOCK(?) AS lock_status', [lockKey]);
                } catch (e) {
                    console.warn(`[关键词跟踪] 释放产品关键词上限锁失败: ${e?.message || e}`);
                }
            }
            await queryRunner.release();
        }
    }

    private async assertProductTrackingKeywordLimit(identity: {
        store_id?: number | string | null;
        marketplace: string;
        product_code: string;
        asin_self: string;
        msku?: string | null;
    }, keywordValue: string) {
        const keywordNorm = this.normalizeTrackingKeyword(keywordValue);
        if (!keywordNorm) {
            throw new CoolCommException('关键词(keyword_value)为必填参数');
        }

        const storeId = identity.store_id === undefined || identity.store_id === null || identity.store_id === ''
            ? null
            : Number(identity.store_id);
        const msku = identity.msku === undefined || identity.msku === null ? null : String(identity.msku);

        const rows = await this.nativeQuery(`
            SELECT
                COUNT(DISTINCT LOWER(TRIM(t.keyword_value))) AS active_keyword_count,
                MAX(CASE WHEN LOWER(TRIM(t.keyword_value)) = ? THEN 1 ELSE 0 END) AS keyword_exists
            FROM app_amz_bsr_keyword_tracking t
            WHERE t.status = 1
              AND t.store_id <=> ?
              AND t.marketplace = ?
              AND t.product_code = ?
              AND t.asin_self = ?
              AND t.msku <=> ?
        `, [
            keywordNorm,
            Number.isFinite(storeId) ? storeId : null,
            identity.marketplace,
            identity.product_code,
            identity.asin_self,
            msku,
        ]);

        const row = rows?.[0] || {};
        const activeKeywordCount = Number(row.active_keyword_count || 0);
        const keywordExists = Number(row.keyword_exists || 0) > 0;

        if (!keywordExists && activeKeywordCount >= this.PRODUCT_TRACKING_KEYWORD_LIMIT) {
            throw new CoolCommException(`该产品已达到${this.PRODUCT_TRACKING_KEYWORD_LIMIT}个跟踪关键词上限，不能新增关键词`);
        }
    }

    /**
     * 开启跟踪
     */
    async startTracking(params: {
        keyword_id: number;
        keyword_value: string;
        marketplace: string;
        product_code: string;
        asin_self: string;
        listing_id?: number;
        msku?: string;
        store_id?: number;
        pages_to_track?: number;
    }) {
        const { keyword_id, keyword_value, marketplace, product_code, asin_self, listing_id, msku, store_id, pages_to_track } = params;

        if (!keyword_value) throw new CoolCommException('关键词(keyword_value)为必填参数');
        if (!marketplace) throw new CoolCommException('站点(marketplace)为必填参数');
        if (!product_code) throw new CoolCommException('产品代码(product_code)为必填参数');
        if (!asin_self) throw new CoolCommException('ASIN(asin_self)为必填参数');

        const userId = this.ctx?.admin?.userId;
        if (!userId) throw new CoolCommException('无法获取当前用户ID');
        await this.assertStoreAuthorized(store_id);

        const productIdentity = {
            store_id,
            marketplace,
            product_code,
            asin_self,
            msku,
        };

        return await this.withProductTrackingKeywordLock(productIdentity, async () => {
            // 检查是否已存在：当前用户 + 同一店铺/站点/产品/ASIN/MSKU/关键词
            const existing = await this.findUserTrackingByIdentity(userId, {
                keyword_value,
                marketplace,
                product_code,
                asin_self,
                msku,
                store_id,
            });

            if (existing) {
                if (existing.status === 1) {
                    throw new CoolCommException('该关键词已在跟踪中');
                }
                await this.assertProductTrackingKeywordLimit(productIdentity, keyword_value);
                // 重新激活
                existing.status = 1;
                existing.user_id = userId;
                existing.asin_self = asin_self;
                existing.listing_id = listing_id || null;
                existing.msku = msku || null;
                existing.store_id = store_id || null;
                existing.pages_to_track = pages_to_track || 3;
                if (keyword_id) existing.keyword_id = keyword_id;
                await this.keywordTrackingRepo.save(existing);
                // 自动采集第一次数据
                try {
                    await this.executeSnapshot(existing);
                } catch (e) {
                    console.warn(`[关键词跟踪] 自动采集失败: ${e?.message || e}`);
                }
                return { id: existing.id, action: 'reactivated' };
            }

            await this.assertProductTrackingKeywordLimit(productIdentity, keyword_value);

            // 新建
            const entity = this.keywordTrackingRepo.create({
                user_id: userId,
                keyword_id: keyword_id || null,
                keyword_value,
                marketplace,
                product_code,
                asin_self,
                listing_id: listing_id || null,
                msku: msku || null,
                store_id: store_id || null,
                pages_to_track: pages_to_track || 3,
                status: 1,
            });
            await this.keywordTrackingRepo.save(entity);
            // 自动采集第一次数据
            try {
                await this.executeSnapshot(entity);
            } catch (e) {
                console.warn(`[关键词跟踪] 自动采集失败: ${e?.message || e}`);
            }
            return { id: entity.id, action: 'created' };
        });
    }

    /**
     * 批量开启跟踪
     * 同步创建/激活所有跟踪记录（秒回给前端），
     * 采集数据在后台异步执行，不阻塞前端交互。
     */
    async batchStartTracking(params: {
        items: Array<{
            keyword_id: number;
            keyword_value: string;
            marketplace: string;
            product_code: string;
            asin_self: string;
            listing_id?: number;
            msku?: string;
            store_id?: number;
            pages_to_track?: number;
        }>;
    }) {
        const { items } = params;
        if (!items || items.length === 0) {
            throw new CoolCommException('批量跟踪列表不能为空');
        }

        const userId = this.ctx?.admin?.userId;
        if (!userId) throw new CoolCommException('无法获取当前用户ID');
        const sidList = await this.getAuthorizedSidList();

        const results: { success: number; skipped: number; failed: number; details: any[] } = {
            success: 0, skipped: 0, failed: 0, details: []
        };

        // 需要异步采集的记录
        const toSnapshot: AppAmzBsrKeywordTrackingEntity[] = [];

        // 第一阶段：同步创建/激活所有记录（不执行采集）
        for (const item of items) {
            try {
                if (!item.keyword_value || !item.marketplace || !item.product_code || !item.asin_self) {
                    results.failed++;
                    results.details.push({ keyword: item.keyword_value || '(空)', status: 'failed', error: '缺少必填参数' });
                    continue;
                }
                if (!this.isStoreAuthorized(sidList, item.store_id)) {
                    results.failed++;
                    results.details.push({ keyword: item.keyword_value, status: 'failed', error: '没有该店铺权限' });
                    continue;
                }

                await this.withProductTrackingKeywordLock({
                    store_id: item.store_id,
                    marketplace: item.marketplace,
                    product_code: item.product_code,
                    asin_self: item.asin_self,
                    msku: item.msku,
                }, async () => {
                    const existing = await this.findUserTrackingByIdentity(userId, {
                        keyword_value: item.keyword_value,
                        marketplace: item.marketplace,
                        product_code: item.product_code,
                        asin_self: item.asin_self,
                        msku: item.msku,
                        store_id: item.store_id,
                    });

                    if (existing) {
                        if (existing.status === 1) {
                            results.skipped++;
                            results.details.push({ keyword: item.keyword_value, status: 'skipped', reason: '已在跟踪中' });
                            return;
                        }
                        await this.assertProductTrackingKeywordLimit({
                            store_id: item.store_id,
                            marketplace: item.marketplace,
                            product_code: item.product_code,
                            asin_self: item.asin_self,
                            msku: item.msku,
                        }, item.keyword_value);
                        // 重新激活
                        existing.status = 1;
                        existing.user_id = userId;
                        existing.asin_self = item.asin_self;
                        existing.listing_id = item.listing_id || null;
                        existing.msku = item.msku || null;
                        existing.store_id = item.store_id || null;
                        existing.pages_to_track = item.pages_to_track || 3;
                        if (item.keyword_id) existing.keyword_id = item.keyword_id;
                        await this.keywordTrackingRepo.save(existing);
                        toSnapshot.push(existing);
                        results.success++;
                        results.details.push({ keyword: item.keyword_value, status: 'ok', action: 'reactivated' });
                        return;
                    }

                    await this.assertProductTrackingKeywordLimit({
                        store_id: item.store_id,
                        marketplace: item.marketplace,
                        product_code: item.product_code,
                        asin_self: item.asin_self,
                        msku: item.msku,
                    }, item.keyword_value);
                    // 新建
                    const entity = this.keywordTrackingRepo.create({
                        user_id: userId,
                        keyword_id: item.keyword_id || null,
                        keyword_value: item.keyword_value,
                        marketplace: item.marketplace,
                        product_code: item.product_code,
                        asin_self: item.asin_self,
                        listing_id: item.listing_id || null,
                        msku: item.msku || null,
                        store_id: item.store_id || null,
                        pages_to_track: item.pages_to_track || 3,
                        status: 1,
                    });
                    await this.keywordTrackingRepo.save(entity);
                    toSnapshot.push(entity);
                    results.success++;
                    results.details.push({ keyword: item.keyword_value, status: 'ok', action: 'created' });
                });
            } catch (err: any) {
                results.failed++;
                results.details.push({ keyword: item.keyword_value || '(空)', status: 'failed', error: err?.message || String(err) });
            }
        }

        // 第二阶段：异步后台采集数据（不阻塞返回）
        if (toSnapshot.length > 0) {
            const snapshotList = [...toSnapshot]; // 拷贝一份，防止引用问题
            // 使用 setImmediate / setTimeout 脱离请求上下文异步执行
            setTimeout(async () => {
                console.log(`[关键词跟踪-批量] 开始异步采集 ${snapshotList.length} 条`);

                // 预加载缓存（与定时任务一样按 product_code+marketplace 分组）
                const cacheMap = new Map<string, any>();
                for (const t of snapshotList) {
                    const cacheKey = `${t.product_code}|${t.marketplace}`;
                    if (!cacheMap.has(cacheKey)) {
                        try {
                            const companyAsins = await this.getCompanyAsins(t.product_code, t.marketplace);
                            const competitorAsins = await this.getCompetitorAsins(companyAsins, t.marketplace);
                            const companyInfoMap = await this.getCompanyAsinInfo(t.product_code, t.marketplace);
                            const competitorInfoMap = await this.getCompetitorAsinInfo(competitorAsins, t.marketplace);
                            cacheMap.set(cacheKey, { companyAsins, competitorAsins, companyInfoMap, competitorInfoMap });
                        } catch (e: any) {
                            console.warn(`[关键词跟踪-批量] 缓存预加载失败 ${cacheKey}: ${e?.message || e}`);
                        }
                    }
                }

                // 逐条采集（串行避免 SIF 限流）
                let ok = 0, fail = 0;
                for (const tracking of snapshotList) {
                    try {
                        const cacheKey = `${tracking.product_code}|${tracking.marketplace}`;
                        const cache = cacheMap.get(cacheKey);
                        await this.executeSnapshot(tracking, cache);
                        ok++;
                    } catch (e: any) {
                        fail++;
                        console.warn(`[关键词跟踪-批量] 采集失败 keyword="${tracking.keyword_value}": ${e?.message || e}`);
                    }
                }
                console.log(`[关键词跟踪-批量] 异步采集完成: 成功${ok}, 失败${fail}`);
            }, 100);
        }

        return results;
    }

    /**
     * 关闭跟踪（历史数据保留）
     */
    async stopTracking(params: { id: number }) {
        const { id } = params;
        if (!id) throw new CoolCommException('id 为必填参数');

        const userId = this.ctx?.admin?.userId;
        const username = this.ctx?.admin?.username;
        if (!userId) throw new CoolCommException('无法获取当前用户ID');

        const where: any = { id };
        if (username !== 'admin') {
            where.user_id = userId;
        }

        const tracking = await this.keywordTrackingRepo.findOne({ where });
        if (!tracking) throw new CoolCommException('跟踪记录不存在');

        tracking.status = 0;
        await this.keywordTrackingRepo.save(tracking);
        return { id, status: 0 };
    }

    /**
     * 批量关闭跟踪（历史数据保留）
     */
    async batchStopTracking(params: { ids: number[] }) {
        const ids = Array.from(new Set((params?.ids || []).map(id => Number(id)).filter(id => id > 0)));
        if (ids.length === 0) throw new CoolCommException('ids 不能为空');

        const userId = this.ctx?.admin?.userId;
        const username = this.ctx?.admin?.username;
        if (!userId) throw new CoolCommException('无法获取当前用户ID');

        const where: any = { id: In(ids), status: 1 };
        if (username !== 'admin') {
            where.user_id = userId;
        }

        const trackingList = await this.keywordTrackingRepo.find({ where });
        if (trackingList.length > 0) {
            for (const tracking of trackingList) {
                tracking.status = 0;
            }
            await this.keywordTrackingRepo.save(trackingList);
        }

        return {
            total: ids.length,
            success: trackingList.length,
            skipped: ids.length - trackingList.length,
        };
    }

    /**
     * 批量关闭当前用户自己的跟踪（历史数据保留）
     * - ids：用于关键词明细页按跟踪记录取消
     * - listings：用于产品列表页按 Listing 批量取消当前用户在这些产品下的跟踪
     */
    async batchStopMyTracking(params: {
        ids?: number[];
        listings?: Array<{
            listing_id?: number | string | null;
            store_id?: number | string | null;
            marketplace?: string;
            product_code?: string;
            asin_self?: string;
            msku?: string | null;
        }>;
    }) {
        const userId = this.ctx?.admin?.userId;
        if (!userId) throw new CoolCommException('无法获取当前用户ID');

        const ids = Array.from(new Set((params?.ids || []).map(id => Number(id)).filter(id => id > 0)));
        const listings = Array.isArray(params?.listings) ? params.listings : [];

        if (ids.length === 0 && listings.length === 0) {
            throw new CoolCommException('ids 或 listings 不能为空');
        }

        const trackingMap = new Map<number, AppAmzBsrKeywordTrackingEntity>();

        if (ids.length > 0) {
            const rows = await this.keywordTrackingRepo.find({
                where: {
                    id: In(ids),
                    user_id: userId,
                    status: 1,
                },
            });
            for (const row of rows) {
                trackingMap.set(Number(row.id), row);
            }
        }

        if (listings.length > 0) {
            const sidList = await this.getAuthorizedSidList();
            const normalizedListings = listings
                .map(item => ({
                    listing_id: item?.listing_id === undefined || item?.listing_id === null || item?.listing_id === ''
                        ? null
                        : Number(item.listing_id),
                    store_id: item?.store_id === undefined || item?.store_id === null || item?.store_id === ''
                        ? null
                        : Number(item.store_id),
                    marketplace: String(item?.marketplace || '').trim(),
                    product_code: String(item?.product_code || '').trim(),
                    asin_self: String(item?.asin_self || '').trim(),
                    msku: item?.msku === undefined || item?.msku === null ? null : String(item.msku),
                }))
                .filter(item =>
                    Number.isFinite(item.store_id)
                    && item.marketplace
                    && item.product_code
                    && item.asin_self
                    && this.isStoreAuthorized(sidList, item.store_id)
                );

            if (normalizedListings.length > 0) {
                const clauses: string[] = [];
                const queryParams: any[] = [userId];

                for (const item of normalizedListings) {
                    if (Number.isFinite(item.listing_id)) {
                        clauses.push(`(
                            t.listing_id = ?
                            OR (
                                t.store_id = ?
                                AND t.marketplace = ?
                                AND t.product_code = ?
                                AND t.asin_self = ?
                                AND t.msku <=> ?
                            )
                        )`);
                        queryParams.push(
                            item.listing_id,
                            item.store_id,
                            item.marketplace,
                            item.product_code,
                            item.asin_self,
                            item.msku
                        );
                    } else {
                        clauses.push(`(
                            t.store_id = ?
                            AND t.marketplace = ?
                            AND t.product_code = ?
                            AND t.asin_self = ?
                            AND t.msku <=> ?
                        )`);
                        queryParams.push(
                            item.store_id,
                            item.marketplace,
                            item.product_code,
                            item.asin_self,
                            item.msku
                        );
                    }
                }

                const rows = await this.nativeQuery(`
                    SELECT DISTINCT t.*
                    FROM app_amz_bsr_keyword_tracking t
                    WHERE t.user_id = ?
                      AND t.status = 1
                      AND (${clauses.join(' OR ')})
                `, queryParams);

                for (const row of rows || []) {
                    trackingMap.set(Number(row.id), row as AppAmzBsrKeywordTrackingEntity);
                }
            }
        }

        const trackingList = Array.from(trackingMap.values());
        if (trackingList.length > 0) {
            for (const tracking of trackingList) {
                tracking.status = 0;
            }
            await this.keywordTrackingRepo.save(trackingList);
        }

        const total = ids.length + listings.length;
        return {
            total,
            success: trackingList.length,
            skipped: Math.max(total - trackingList.length, 0),
        };
    }

    /**
     * 手动触发采集（调试用）
     */
    async manualSnapshot(params: { id: number }) {
        const { id } = params;
        if (!id) throw new CoolCommException('id 为必填参数');

        const tracking = await this.keywordTrackingRepo.findOne({ where: { id } });
        if (!tracking) throw new CoolCommException('跟踪记录不存在');

        const result = await this.executeSnapshot(tracking);

        // 查找同 keyword+marketplace 的其他 tracking，共享 SIF 数据一起更新
        const siblingTrackings = await this.keywordTrackingRepo.find({
            where: {
                keyword_value: tracking.keyword_value,
                marketplace: tracking.marketplace,
                status: 1,
            },
        });
        const siblings = siblingTrackings.filter(t => t.id !== tracking.id);

        if (siblings.length > 0) {
            console.log(`[关键词跟踪] 发现 ${siblings.length} 条相同关键词跟踪，共享SIF数据更新`);
            // 从刚存的快照里取 SIF 原始数据
            const today = dayjs().format('YYYY-MM-DD');
            const mainSnapshot = await this.keywordTrackingSnapshotRepo.findOne({
                where: { tracking_id: tracking.id, snapshot_date: today },
            });
            const sifData = mainSnapshot?.raw_data ? JSON.parse(mainSnapshot.raw_data) : null;

            if (sifData) {
                for (const sibling of siblings) {
                    try {
                        await this.executeSnapshot(sibling, undefined, sifData);
                        await this.recalcSummary(sibling);
                        console.log(`[关键词跟踪] 共享更新 tracking_id=${sibling.id} 成功`);
                    } catch (e) {
                        console.warn(`[关键词跟踪] 共享更新 tracking_id=${sibling.id} 失败: ${e?.message || e}`);
                    }
                }
            }
        }

        // 采集完成后重算汇总
        await this.recalcSummary(tracking);

        return result;
    }

    /**
     * 执行单条跟踪的采集 + 分析 + 存储
     * @param tracking 跟踪记录
     * @param cache 可选缓存（定时任务批量调用时传入，避免同 product_code+marketplace 重复查库）
     * @param prefetchedSifData 可选预取SIF数据（相同keyword+marketplace共享，避免重复调SIF API）
     */
    async executeSnapshot(tracking: AppAmzBsrKeywordTrackingEntity, cache?: {
        companyAsins: string[];
        competitorAsins: string[];
        companyInfoMap: Map<string, { image_url: string | null; seller: string | null; title: string | null }>;
        competitorInfoMap: Map<string, { image_url: string | null; seller: string | null; title: string | null }>;
    }, prefetchedSifData?: any) {
        const startTime = Date.now();
        console.log(`[关键词跟踪] 开始采集: keyword="${tracking.keyword_value}", marketplace=${tracking.marketplace}`);

        // 1. 调 SIF API 获取数据（优先使用外部预取的缓存数据）
        let sifData: any = prefetchedSifData;
        if (!sifData) {
            try {
                sifData = await this.sifKeywordService.fetchAsinPageListByKeyword({
                    keyword: tracking.keyword_value,
                    marketplaces: tracking.marketplace,
                });
            } catch (err) {
                console.error(`[关键词跟踪] SIF API 调用失败: ${err?.message || err}`);
                throw new CoolCommException(`SIF API 调用失败: ${err?.message || err}`);
            }
        }

        // 2. 获取公司ASIN池（优先使用缓存）
        const companyAsins = cache?.companyAsins ?? await this.getCompanyAsins(tracking.product_code, tracking.marketplace);

        // 3. 获取竞品ASIN池（优先使用缓存），并去除与公司ASIN重复的部分
        const rawCompetitorAsins = cache?.competitorAsins ?? await this.getCompetitorAsins(companyAsins, tracking.marketplace);
        const companyAsinSet = new Set(companyAsins);
        const competitorAsins = rawCompetitorAsins.filter(a => !companyAsinSet.has(a));

        // 4. 分析排名
        const analysis = this.analyzeRanking(sifData, tracking.asin_self, companyAsins, competitorAsins);

        // 4.5 查询 ASIN 的图片、卖家、标题信息并附加到 analysis（优先使用缓存）
        try {
            const companyInfoMap = cache?.companyInfoMap ?? await this.getCompanyAsinInfo(tracking.product_code, tracking.marketplace);
            const competitorInfoMap = cache?.competitorInfoMap ?? await this.getCompetitorAsinInfo(competitorAsins, tracking.marketplace);
            // 合并（公司优先，竞品补充）
            const allInfoMap = new Map([...competitorInfoMap, ...companyInfoMap]);
            const attachInfo = (item: any) => {
                if (!item || !item.asin) return;
                const info = allInfoMap.get(item.asin);
                if (info) {
                    item.image_url = info.image_url;
                    item.seller = info.seller?.trim() || null;
                    item.title = info.title?.trim() || null;
                }
            };
            attachInfo(analysis.self);
            if (analysis.company) analysis.company.forEach(attachInfo);
            if (analysis.competitor) analysis.competitor.forEach(attachInfo);
        } catch (e) {
            console.warn(`[关键词跟踪] 查询ASIN图片信息失败（不影响快照）: ${e?.message || e}`);
        }

        // 5. 存快照（同一天只保留一条，重复采集则更新）
        const today = dayjs().format('YYYY-MM-DD');
        let snapshot = await this.keywordTrackingSnapshotRepo.findOne({
            where: { tracking_id: tracking.id, snapshot_date: today },
        });
        if (snapshot) {
            // 更新已有记录
            snapshot.total_result_count = sifData?.totalResultCount ?? sifData?.totalProducts ?? null;
            snapshot.raw_data = JSON.stringify(sifData);
            snapshot.analysis_data = JSON.stringify(analysis);
        } else {
            snapshot = this.keywordTrackingSnapshotRepo.create({
                tracking_id: tracking.id,
                snapshot_date: today,
                total_result_count: sifData?.totalResultCount ?? sifData?.totalProducts ?? null,
                raw_data: JSON.stringify(sifData),
                analysis_data: JSON.stringify(analysis),
            });
        }
        await this.keywordTrackingSnapshotRepo.save(snapshot);

        // 6. 更新最后采集时间
        tracking.last_snapshot_time = new Date();
        await this.keywordTrackingRepo.save(tracking);

        const durationMs = Date.now() - startTime;
        console.log(`[关键词跟踪] 采集完成: keyword="${tracking.keyword_value}", 耗时${durationMs}ms`);

        return {
            snapshot_id: snapshot.id,
            snapshot_date: today,
            analysis,
            duration_ms: durationMs,
        };
    }

    /**
     * 获取公司ASIN池
     */
    async getCompanyAsins(productCode: string, marketplace: string): Promise<string[]> {
        const rows: any[] = await this.keywordTrackingRepo.query(
            `SELECT DISTINCT asin FROM app_amz_bsr_product_listing_lingxing
             WHERE product_code = ? AND marketplace = ? AND asin IS NOT NULL AND asin != ''`,
            [productCode, marketplace]
        );
        return rows.map(r => r.asin);
    }

    /**
     * 获取竞品ASIN池
     */
    async getCompetitorAsins(companyAsins: string[], marketplace: string): Promise<string[]> {
        if (!companyAsins || companyAsins.length === 0) return [];

        const placeholders = companyAsins.map(() => '?').join(',');
        const rows: any[] = await this.keywordTrackingRepo.query(
            `SELECT DISTINCT asin_competitor FROM app_amz_bsr_candidate_competitor
             WHERE asin_candidate IN (${placeholders})
               AND marketplace = ?
               AND status IN (6, 2)
               AND asin_competitor IS NOT NULL AND asin_competitor != ''`,
            [...companyAsins, marketplace]
        );
        return rows.map(r => r.asin_competitor);
    }

    /**
     * 获取公司产品（自己+公司）的图片、卖家、标题信息
     * 数据来源: app_amz_bsr_product_listing_lingxing
     */
    async getCompanyAsinInfo(productCode: string, marketplace: string): Promise<Map<string, { image_url: string | null; seller: string | null; title: string | null }>> {
        const rows: any[] = await this.keywordTrackingRepo.query(
            `SELECT asin, image_url, seller_name, shop, item_name
             FROM app_amz_bsr_product_listing_lingxing
             WHERE product_code = ? AND marketplace = ?
               AND asin IS NOT NULL AND asin != ''`,
            [productCode, marketplace]
        );
        const map = new Map<string, { image_url: string | null; seller: string | null; title: string | null }>();
        for (const r of rows) {
            map.set(r.asin, {
                image_url: r.image_url || null,
                seller: r.seller_name || r.shop || null,
                title: r.item_name || null,
            });
        }
        return map;
    }

    /**
     * 获取竞品的图片、卖家、标题信息
     * 数据来源: app_amz_bsr_candidate_competitor
     */
    async getCompetitorAsinInfo(asins: string[], marketplace: string): Promise<Map<string, { image_url: string | null; seller: string | null; title: string | null }>> {
        const map = new Map<string, { image_url: string | null; seller: string | null; title: string | null }>();
        if (!asins || asins.length === 0) return map;

        const placeholders = asins.map(() => '?').join(',');
        const rows: any[] = await this.keywordTrackingRepo.query(
            `SELECT asin_competitor AS asin, image_url, sold_by AS seller, item_name
             FROM app_amz_bsr_candidate_competitor
             WHERE asin_competitor IN (${placeholders})
               AND marketplace = ?`,
            [...asins, marketplace]
        );
        for (const r of rows) {
            if (!map.has(r.asin)) {
                map.set(r.asin, {
                    image_url: r.image_url || null,
                    seller: r.seller || null,
                    title: r.item_name || null,
                });
            }
        }
        return map;
    }

    /**
     * 实时查询竞品父体月销量 + 月销量走势数据 + 价格
     * 前端总分表需要实时数据，不走快照缓存
     * 返回结构: { [asin]: { Main_monthly_sales, sales_volume_data, price } }
     */
    async getCompetitorMonthlySales(params: { asins: string[]; marketplace: string }): Promise<Record<string, { Main_monthly_sales: number | null; sales_volume_data: any; price: string | null }>> {
        const { asins, marketplace } = params;
        if (!asins || asins.length === 0) return {};

        const placeholders = asins.map(() => '?').join(',');
        const rows: any[] = await this.keywordTrackingRepo.query(
            `SELECT asin_competitor AS asin, Main_monthly_sales, sales_volume_data, price
             FROM app_amz_bsr_candidate_competitor
             WHERE asin_competitor IN (${placeholders})
               AND marketplace = ?
             ORDER BY Main_monthly_sales DESC`,
            [...asins, marketplace]
        );

        const result: Record<string, { Main_monthly_sales: number | null; sales_volume_data: any; price: string | null }> = {};
        for (const r of rows) {
            // 同一个ASIN可能关联多个候选品，取销量最大的那条
            if (!(r.asin in result)) {
                // sales_volume_data 可能是 JSON 字符串或已解析的对象
                let parsedSalesData = null;
                if (r.sales_volume_data) {
                    try {
                        parsedSalesData = typeof r.sales_volume_data === 'string'
                            ? JSON.parse(r.sales_volume_data)
                            : r.sales_volume_data;
                    } catch (e) {
                        parsedSalesData = null;
                    }
                }
                result[r.asin] = {
                    Main_monthly_sales: r.Main_monthly_sales != null ? Number(r.Main_monthly_sales) : null,
                    sales_volume_data: parsedSalesData,
                    price: r.price != null ? String(r.price) : null,
                };
            }
        }
        return result;
    }

    /**
     * 查询自己/公司 ASIN 的30天销量
     * 从 listing 表按 ASIN 聚合（SUM），处理同一 ASIN 多 MSKU 的情况
     */
    async getSelfCompanyMonthlySales(params: { asins: string[]; marketplace: string }): Promise<Record<string, number | null>> {
        const { asins, marketplace } = params;
        if (!asins || asins.length === 0) return {};

        const placeholders = asins.map(() => '?').join(',');
        const rows: any[] = await this.keywordTrackingRepo.query(
            `SELECT asin, SUM(thirty_volume) AS thirty_volume
             FROM app_amz_bsr_product_listing_lingxing
             WHERE asin IN (${placeholders})
               AND marketplace = ?
             GROUP BY asin`,
            [...asins, marketplace]
        );

        const result: Record<string, number | null> = {};
        for (const r of rows) {
            result[r.asin] = r.thirty_volume != null ? Number(r.thirty_volume) : null;
        }
        return result;
    }

    /**
     * 重新计算并保存某个 Listing 的汇总得分
     * 复制前端 calcScoreSummary 的核心算法
     *
     * @param tracking 任意一条该 Listing 的跟踪记录（用于获取 listing_id, asin_self, marketplace 等）
     */
    async recalcSummary(tracking: AppAmzBsrKeywordTrackingEntity) {
        const MIN_QUALIFIED_DAYS = 3;

        try {
            // 1. 找到该 Listing 下所有活跃的关键词跟踪记录
            const allTrackings = await this.keywordTrackingRepo.find({
                where: {
                    user_id: tracking.user_id,
                    product_code: tracking.product_code,
                    marketplace: tracking.marketplace,
                    asin_self: tracking.asin_self,
                    status: 1,
                },
            });
            if (allTrackings.length === 0) return;

            const totalKeywords = allTrackings.length;
            const trackingIds = allTrackings.map(t => t.id);

            // 2. 读取每个关键词最近15天快照（与前端 calcScoreSummary 一致: size=15）
            const SNAPSHOT_LIMIT = 15;
            let allSnapshots: AppAmzBsrKeywordTrackingSnapshotEntity[] = [];
            for (const tid of trackingIds) {
                const snaps = await this.keywordTrackingSnapshotRepo
                    .createQueryBuilder('s')
                    .where('s.tracking_id = :tid', { tid })
                    .andWhere('s.analysis_data IS NOT NULL')
                    .andWhere('s.analysis_data != :emptyMarker', { emptyMarker: '{"empty":true}' })
                    .orderBy('s.snapshot_date', 'DESC')
                    .take(SNAPSHOT_LIMIT)
                    .getMany();
                allSnapshots = allSnapshots.concat(snaps);
            }
            const snapshots = allSnapshots;

            // 3. 按 tracking_id 分组
            const snapshotsByTracking = new Map<number, typeof snapshots>();
            for (const snap of snapshots) {
                const arr = snapshotsByTracking.get(snap.tracking_id) || [];
                arr.push(snap);
                snapshotsByTracking.set(snap.tracking_id, arr);
            }

            // 建立 tracking_id → keyword_value 映射
            const kwMap = new Map<number, string>();
            for (const t of allTrackings) {
                kwMap.set(t.id, t.keyword_value);
            }

            // 4. 收集原始数据: rawData[asin][keyword][date] = { nf, sp }
            const rawData = new Map<string, Map<string, Map<string, { nf: number; sp: number }>>>();
            const asinTypes = new Map<string, string>();

            const collectRaw = (asin: string, type: string, keyword: string, date: string, nf: number, sp: number) => {
                const priority: Record<string, number> = { '自己': 0, '公司': 1, '竞品': 2 };
                const existing = asinTypes.get(asin);
                if (!existing || priority[type] < priority[existing]) {
                    asinTypes.set(asin, type);
                }
                if (!rawData.has(asin)) rawData.set(asin, new Map());
                const asinMap = rawData.get(asin)!;
                if (!asinMap.has(keyword)) asinMap.set(keyword, new Map());
                asinMap.get(keyword)!.set(date, { nf, sp });
            };

            for (const [tid, snaps] of snapshotsByTracking) {
                const kw = kwMap.get(tid) || '';
                for (const snap of snaps) {
                    try {
                        const analysis = JSON.parse(snap.analysis_data);
                        const date = snap.snapshot_date;

                        if (analysis.self?.asin) {
                            collectRaw(String(analysis.self.asin), '自己', kw, date, analysis.self.score_nf || 0, analysis.self.score_sp || 0);
                        }
                        for (const c of (analysis.company || [])) {
                            if (c.asin) collectRaw(String(c.asin), '公司', kw, date, c.score_nf || 0, c.score_sp || 0);
                        }
                        for (const c of (analysis.competitor || [])) {
                            if (c.asin) collectRaw(String(c.asin), '竞品', kw, date, c.score_nf || 0, c.score_sp || 0);
                        }
                    } catch (e) {
                        // JSON解析失败，跳过
                    }
                }
            }

            // 5. 第二轮：判断合格性 & 计算得分
            const asinScores: Array<{ asin: string; type: string; avgNf: number; avgSp: number }> = [];

            for (const [asin, kwDataMap] of rawData) {
                const type = asinTypes.get(asin) || '竞品';
                const qualifiedNfKws = new Set<string>();
                const qualifiedSpKws = new Set<string>();

                for (const [kw, dateMap] of kwDataMap) {
                    let nfDays = 0, spDays = 0;
                    for (const [, scores] of dateMap) {
                        if (scores.nf > 0) nfDays++;
                        if (scores.sp > 0) spDays++;
                    }
                    if (nfDays >= MIN_QUALIFIED_DAYS) qualifiedNfKws.add(kw);
                    if (spDays >= MIN_QUALIFIED_DAYS) qualifiedSpKws.add(kw);
                }

                if (qualifiedNfKws.size === 0 && qualifiedSpKws.size === 0) continue;

                // 每个关键词独立算均分，再加总
                let sumNf = 0, sumSp = 0, maxDays = 0;

                for (const [kw, dateMap] of kwDataMap) {
                    const nfOk = qualifiedNfKws.has(kw);
                    const spOk = qualifiedSpKws.has(kw);
                    if (!nfOk && !spOk) continue;

                    let kwNfTotal = 0, kwSpTotal = 0;
                    const kwDays = dateMap.size;

                    for (const [, scores] of dateMap) {
                        if (nfOk) kwNfTotal += scores.nf;
                        if (spOk) kwSpTotal += scores.sp;
                    }

                    if (nfOk) sumNf += kwNfTotal / kwDays;
                    if (spOk) sumSp += kwSpTotal / kwDays;
                    if (kwDays > maxDays) maxDays = kwDays;
                }

                if (maxDays < MIN_QUALIFIED_DAYS) continue;

                asinScores.push({ asin, type, avgNf: sumNf, avgSp: sumSp });
            }

            // 6. 计算自己的得分和落后率
            const selfRow = asinScores.find(r => r.type === '自己');
            const competitors = asinScores.filter(r => r.type === '竞品');

            const scoreNf = selfRow?.avgNf ?? null;
            const scoreSp = selfRow?.avgSp ?? null;
            const competitorCount = competitors.length;

            // 自己没有合格数据时，落后率为 null（不计算）
            let behindCountNf = 0;
            let behindCountSp = 0;
            let behindRateNf: number | null = null;
            let behindRateSp: number | null = null;

            if (selfRow && competitorCount > 0) {
                for (const c of competitors) {
                    if (c.avgNf > selfRow.avgNf) behindCountNf++;
                    if (c.avgSp > selfRow.avgSp) behindCountSp++;
                }
                behindRateNf = behindCountNf / competitorCount;
                behindRateSp = behindCountSp / competitorCount;
            }

            // 7. 构建计算明细（供验证）
            const calcDetail = {
                calc_time: new Date().toISOString(),
                total_keywords: totalKeywords,
                snapshot_count: snapshots.length,
                self: selfRow ? { asin: selfRow.asin, avgNf: Math.round(selfRow.avgNf * 100) / 100, avgSp: Math.round(selfRow.avgSp * 100) / 100 } : null,
                competitors: competitors.map(c => ({
                    asin: c.asin,
                    avgNf: Math.round(c.avgNf * 100) / 100,
                    avgSp: Math.round(c.avgSp * 100) / 100,
                    nf_higher: selfRow ? c.avgNf > selfRow.avgNf : false,
                    sp_higher: selfRow ? c.avgSp > selfRow.avgSp : false,
                })),
            };

            // 8. 保存/更新汇总表（INSERT ... ON DUPLICATE KEY UPDATE）
            const listingId = tracking.listing_id || allTrackings.find(t => t.listing_id)?.listing_id || null;
            const summaryDate = dayjs().format('YYYY-MM-DD');

            await this.keywordTrackingSummaryRepo.query(
                `INSERT INTO app_amz_bsr_keyword_tracking_summary
                    (user_id, listing_id, asin_self, marketplace, product_code, msku, store_id, summary_date,
                     score_nf, score_sp, competitor_count, behind_count_nf, behind_count_sp,
                     behind_rate_nf, behind_rate_sp, calc_detail, last_calc_time, createTime, updateTime)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
                 ON DUPLICATE KEY UPDATE
                    listing_id = VALUES(listing_id),
                    summary_date = VALUES(summary_date),
                    score_nf = VALUES(score_nf),
                    score_sp = VALUES(score_sp),
                    competitor_count = VALUES(competitor_count),
                    behind_count_nf = VALUES(behind_count_nf),
                    behind_count_sp = VALUES(behind_count_sp),
                    behind_rate_nf = VALUES(behind_rate_nf),
                    behind_rate_sp = VALUES(behind_rate_sp),
                    calc_detail = VALUES(calc_detail),
                    last_calc_time = NOW(),
                    updateTime = NOW()`,
                [
                    tracking.user_id, listingId, tracking.asin_self, tracking.marketplace,
                    tracking.product_code, tracking.msku || null, tracking.store_id || null, summaryDate,
                    scoreNf != null ? Math.round(scoreNf * 100) / 100 : null,
                    scoreSp != null ? Math.round(scoreSp * 100) / 100 : null,
                    competitorCount, behindCountNf, behindCountSp,
                    behindRateNf != null ? Math.round(behindRateNf * 10000) / 10000 : null,
                    behindRateSp != null ? Math.round(behindRateSp * 10000) / 10000 : null,
                    JSON.stringify(calcDetail),
                ]
            );

            console.log(`[关键词跟踪] 汇总计算完成: asin=${tracking.asin_self}, marketplace=${tracking.marketplace}, ` +
                `scoreNf=${scoreNf?.toFixed(1) ?? 'null'}, scoreSp=${scoreSp?.toFixed(1) ?? 'null'}, ` +
                `落后率NF=${behindRateNf != null ? (behindRateNf * 100).toFixed(1) + '%' : 'null'}, ` +
                `SP=${behindRateSp != null ? (behindRateSp * 100).toFixed(1) + '%' : 'null'}`);
        } catch (e) {
            console.error(`[关键词跟踪] 汇总计算失败: ${e?.message || e}`);
        }
    }

    /**
     * 清理汇总历史，仅保留最近 180 天真实汇总记录。
     * 只在定时任务结束时调用，避免每个 Listing 重算时重复清理。
     */
    async cleanupOldSummaryHistory() {
        const retentionDays = this.SUMMARY_HISTORY_RETENTION_DAYS || 180;
        const res = await this.keywordTrackingSummaryRepo.query(
            `DELETE FROM app_amz_bsr_keyword_tracking_summary
             WHERE summary_date < DATE_SUB(CURDATE(), INTERVAL ${retentionDays} DAY)`
        );
        console.log(`[关键词跟踪] 汇总历史清理完成: retentionDays=${retentionDays}`);
        return res;
    }

    /**
     * 评分公式：指数衰减
     * Score = 20 + 80 × e^(-0.08 × (Rank - 1))
     * Rank 1 → 100分, 底分 20, 未出现 → 0分
     */
    private calcScore(rank: number | null | undefined): number {
        if (!rank || rank <= 0) return 0;
        return Math.round((20 + 80 * Math.exp(-0.08 * (rank - 1))) * 100) / 100;
    }

    /**
     * 分析排名：在 SIF 返回数据中查找 self/company/competitor 的位置
     * 并计算每个 ASIN 的自然排名得分(score_nf)和SP广告得分(score_sp)
     *
     * SIF data 结构：
     * {
     *   pageList: [
     *     { pageNum: 1, nfAsin: [...], spAsin: [...], acAsin: [...], topAdAsin: [...], videoAdAsins: [...] },
     *     { pageNum: 2, ... },
     *     ...
     *   ],
     *   totalProducts: 1450,
     *   ...
     * }
     */
    analyzeRanking(
        sifData: any,
        asinSelf: string,
        companyAsins: string[],
        competitorAsins: string[]
    ) {
        const pageList: any[] = sifData?.pages || sifData?.pageList || [];
        const allTargetAsins = new Set<string>();

        // 收集所有需要追踪的 ASIN
        if (asinSelf) allTargetAsins.add(asinSelf);
        companyAsins.forEach(a => allTargetAsins.add(a));
        competitorAsins.forEach(a => allTargetAsins.add(a));

        // 初始化每个目标 ASIN 的分析结果
        const asinResultMap = new Map<string, {
            natural: { page: number; position: number; rank: number } | null;
            sp: { page: number; position: number; rank: number } | null;
            ac: boolean;
            topAd: boolean;
            brandAd: boolean;
            videoAd: boolean;
        }>();

        for (const asin of allTargetAsins) {
            asinResultMap.set(asin, {
                natural: null,
                sp: null,
                ac: false,
                topAd: false,
                brandAd: false,
                videoAd: false,
            });
        }

        // 遍历每页分析
        for (const page of pageList) {
            const pageNum = page.pageNum || 1;
            const nfAsins: string[] = page.nfAsin || [];
            const spAsins: string[] = page.spAsin || [];
            const acAsins: string[] = page.acAsin || [];
            const topAdAsins: string[] = Array.isArray(page.topAdAsin)
                ? page.topAdAsin
                : page.topAdAsin ? [page.topAdAsin] : [];

            const videoAdAsins: string[] = page.videoAdAsins || [];
            // 品牌广告：可能是 sbAsin 或 brandAsin 字段
            const brandAdAsins: string[] = page.sbAsin || page.brandAsin || [];

            // 固定每页位置数，不受实际返回数量影响
            const NF_PER_PAGE = 48;
            const SP_PER_PAGE = 12;

            // 自然排名
            for (let i = 0; i < nfAsins.length; i++) {
                const asin = nfAsins[i];
                const result = asinResultMap.get(asin);
                if (result && !result.natural) {
                    result.natural = {
                        page: pageNum,
                        position: i + 1,
                        rank: (pageNum - 1) * NF_PER_PAGE + i + 1,
                    };
                }
            }

            // SP广告
            for (let i = 0; i < spAsins.length; i++) {
                const asin = spAsins[i];
                const result = asinResultMap.get(asin);
                if (result && !result.sp) {
                    result.sp = {
                        page: pageNum,
                        position: i + 1,
                        rank: (pageNum - 1) * SP_PER_PAGE + i + 1,
                    };
                }
            }

            // AC
            for (const asin of acAsins) {
                const result = asinResultMap.get(asin);
                if (result) result.ac = true;
            }

            // 顶部广告
            for (const asin of topAdAsins) {
                const result = asinResultMap.get(asin);
                if (result) result.topAd = true;
            }

            // 品牌广告
            for (const asin of brandAdAsins) {
                const result = asinResultMap.get(asin);
                if (result) result.brandAd = true;
            }

            // 视频广告
            for (const asin of videoAdAsins) {
                const result = asinResultMap.get(asin);
                if (result) result.videoAd = true;
            }

        }

        // 给单个 ASIN 结果附加评分
        const attachScores = (result: any) => {
            return {
                ...result,
                score_nf: this.calcScore(result?.natural?.rank),
                score_sp: this.calcScore(result?.sp?.rank),
            };
        };

        const defaultResult = { natural: null, sp: null, ac: false, topAd: false, brandAd: false, videoAd: false };

        // 构建最终结构
        const selfResult = asinResultMap.get(asinSelf);

        const companyResults = companyAsins
            .filter(a => a !== asinSelf)
            .map(asin => attachScores({
                asin,
                ...(asinResultMap.get(asin) || defaultResult),
            }));

        const competitorResults = competitorAsins.map(asin => attachScores({
            asin,
            ...(asinResultMap.get(asin) || defaultResult),
        }));

        return {
            self: attachScores({
                asin: asinSelf,
                ...(selfResult || defaultResult),
            }),
            company: companyResults,
            competitor: competitorResults,
            companyAsins,
            competitorAsins,
        };
    }

    /**
     * 定时任务入口：采集所有跟踪中的关键词
     * 并发批次处理，每批 concurrency 个并行，批间间隔 batchDelayMs
     * SIF 限频 1000次/分钟，默认 5并发 + 700ms间隔 ≈ 430次/分钟（安全余量）
     *
     * 第一阶段：采集当天最新数据（首要）
     * 第二阶段：补齐最近 backfillDays 天缺失数据（次要）
     */
    async scheduledSnapshotAll(options?: {
        concurrency?: number;
        batchDelayMs?: number;
        backfillDays?: number;
    }) {
        const concurrency = options?.concurrency ?? 3;
        const batchDelayMs = options?.batchDelayMs ?? 700;
        const backfillDays = options?.backfillDays ?? 15;
        const startTime = Date.now();

        const trackingList = await this.keywordTrackingRepo.find({
            where: { status: 1 },
        });

        if (trackingList.length === 0) {
            console.log('[关键词跟踪-定时] 没有跟踪中的记录，跳过');
            return { total: 0, success: 0, fail: 0, backfilled: 0, backfillSkipped: 0, duration: '0s' };
        }

        const rateDesc = `${concurrency}并发, ${batchDelayMs}ms批间隔, ≈${Math.round(concurrency / (batchDelayMs / 1000) * 60)}次/分`;
        console.log(`[关键词跟踪-定时] 开始采集 ${trackingList.length} 条, ${rateDesc}`);

        // 按 product_code+marketplace 分组，预加载ASIN池缓存
        const cacheMap = new Map<string, {
            companyAsins: string[];
            competitorAsins: string[];
            companyInfoMap: Map<string, { image_url: string | null; seller: string | null; title: string | null }>;
            competitorInfoMap: Map<string, { image_url: string | null; seller: string | null; title: string | null }>;
        }>();

        for (const tracking of trackingList) {
            const cacheKey = `${tracking.product_code}|${tracking.marketplace}`;
            if (!cacheMap.has(cacheKey)) {
                try {
                    const companyAsins = await this.getCompanyAsins(tracking.product_code, tracking.marketplace);
                    const competitorAsins = await this.getCompetitorAsins(companyAsins, tracking.marketplace);
                    const companyInfoMap = await this.getCompanyAsinInfo(tracking.product_code, tracking.marketplace);
                    const competitorInfoMap = await this.getCompetitorAsinInfo(competitorAsins, tracking.marketplace);
                    cacheMap.set(cacheKey, { companyAsins, competitorAsins, companyInfoMap, competitorInfoMap });
                    console.log(`[关键词跟踪-定时] 缓存 ${cacheKey}: 公司${companyAsins.length}个, 竞品${competitorAsins.length}个`);
                } catch (e) {
                    console.warn(`[关键词跟踪-定时] 预加载缓存失败 ${cacheKey}: ${e?.message || e}`);
                }
            }
        }

        // ========== 第一阶段：并发采集当天最新数据（已有快照则跳过） ==========
        let success = 0;
        let fail = 0;
        let skippedToday = 0;
        const errors: Array<{ id: number; keyword: string; error: string }> = [];
        const today = dayjs().format('YYYY-MM-DD');

        // 预查询所有跟踪关键词今天是否已有快照，批量去重
        const todayExistingIds = new Set<number>();
        if (trackingList.length > 0) {
            const trackingIds = trackingList.map(t => t.id);
            const existingSnapshots = await this.keywordTrackingSnapshotRepo
                .createQueryBuilder('s')
                .select('s.tracking_id')
                .where('s.tracking_id IN (:...ids)', { ids: trackingIds })
                .andWhere('s.snapshot_date = :today', { today })
                .getMany();
            existingSnapshots.forEach(s => todayExistingIds.add(s.tracking_id));
        }

        // 过滤出今天还没采集的
        const needSnapshotList = trackingList.filter(t => !todayExistingIds.has(t.id));
        skippedToday = trackingList.length - needSnapshotList.length;

        console.log(`[关键词跟踪-定时] === 第一阶段：采集当天数据（需采集${needSnapshotList.length}条，跳过已采集${skippedToday}条） ===`);

        // 预取 SIF 数据：同一 keyword+marketplace 只调一次 SIF API
        const sifDataCache = new Map<string, any>();
        const uniqueSifKeys = new Map<string, { keyword: string; marketplace: string }>();
        for (const t of needSnapshotList) {
            const sifKey = `${t.keyword_value}|${t.marketplace}`;
            if (!uniqueSifKeys.has(sifKey)) {
                uniqueSifKeys.set(sifKey, { keyword: t.keyword_value, marketplace: t.marketplace });
            }
        }

        const sifKeysArray = Array.from(uniqueSifKeys.entries());
        const sifDedupSaved = needSnapshotList.length - sifKeysArray.length;
        console.log(`[关键词跟踪-定时] SIF 去重: ${needSnapshotList.length}条跟踪 → ${sifKeysArray.length}个唯一关键词 (节省${sifDedupSaved}次SIF调用)`);

        let sifFetchSuccess = 0;
        let sifFetchFail = 0;
        for (let i = 0; i < sifKeysArray.length; i += concurrency) {
            const batch = sifKeysArray.slice(i, i + concurrency);
            const results = await Promise.allSettled(
                batch.map(async ([sifKey, { keyword, marketplace }]) => {
                    const data = await this.sifKeywordService.fetchAsinPageListByKeyword({
                        keyword,
                        marketplaces: marketplace,
                    });
                    return { sifKey, data };
                })
            );
            for (const r of results) {
                if (r.status === 'fulfilled') {
                    sifDataCache.set(r.value.sifKey, r.value.data);
                    sifFetchSuccess++;
                } else {
                    sifFetchFail++;
                    console.warn(`[关键词跟踪-定时] SIF预取失败: ${(r as PromiseRejectedResult).reason?.message || r}`);
                }
            }
            if (i + concurrency < sifKeysArray.length) {
                await new Promise(resolve => setTimeout(resolve, batchDelayMs));
            }
        }
        console.log(`[关键词跟踪-定时] SIF 预取完成: 成功${sifFetchSuccess}/${sifKeysArray.length}, 失败${sifFetchFail}`);

        // 用预取的 SIF 数据执行快照（不再重复调 SIF）
        for (let batchStart = 0; batchStart < needSnapshotList.length; batchStart += concurrency) {
            const batch = needSnapshotList.slice(batchStart, batchStart + concurrency);
            const batchNum = Math.floor(batchStart / concurrency) + 1;
            const totalBatches = Math.ceil(needSnapshotList.length / concurrency);

            const results = await Promise.allSettled(
                batch.map(tracking => {
                    const cacheKey = `${tracking.product_code}|${tracking.marketplace}`;
                    const cache = cacheMap.get(cacheKey);
                    const sifKey = `${tracking.keyword_value}|${tracking.marketplace}`;
                    const sifData = sifDataCache.get(sifKey);
                    return this.executeSnapshot(tracking, cache, sifData);
                })
            );

            for (let j = 0; j < results.length; j++) {
                const tracking = batch[j];
                if (results[j].status === 'fulfilled') {
                    success++;
                } else {
                    fail++;
                    const errMsg = (results[j] as PromiseRejectedResult).reason?.message || String((results[j] as PromiseRejectedResult).reason);
                    errors.push({ id: tracking.id, keyword: tracking.keyword_value, error: errMsg });
                }
            }

            console.log(`[关键词跟踪-定时] 批次 ${batchNum}/${totalBatches} 完成 (累计: 成功${success}/失败${fail})`);

            // 批间间隔（最后一批不等待）
            if (batchStart + concurrency < needSnapshotList.length) {
                await new Promise(resolve => setTimeout(resolve, batchDelayMs));
            }
        }

        const phase1Duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[关键词跟踪-定时] 第一阶段完成: 成功${success}, 失败${fail}, SIF调用${sifKeysArray.length}次(节省${sifDedupSaved}次), 耗时${phase1Duration}s`);

        // ========== 第二阶段：并发补齐最近N天缺失的历史快照 ==========
        console.log(`[关键词跟踪-定时] === 第二阶段：补齐最近${backfillDays}天缺失数据 ===`);

        const dateList: string[] = [];
        for (let i = 1; i <= backfillDays; i++) {
            dateList.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'));
        }

        // 收集所有需要补齐的任务 { tracking, date, cache }
        const backfillTasks: Array<{ tracking: any; date: string; cache: any }> = [];

        for (const tracking of trackingList) {
            const cacheKey = `${tracking.product_code}|${tracking.marketplace}`;
            const cache = cacheMap.get(cacheKey);

            const existingSnapshots = await this.keywordTrackingSnapshotRepo.find({
                where: { tracking_id: tracking.id },
                select: ['snapshot_date'],
            });
            const existingDates = new Set(existingSnapshots.map(s => s.snapshot_date));

            const missingDates = dateList.filter(d => !existingDates.has(d));
            for (const date of missingDates) {
                backfillTasks.push({ tracking, date, cache });
            }
        }

        let backfilled = 0;
        let backfillEmpty = 0;
        let backfillFailed = 0;
        const backfillErrors: Array<{ keyword: string; date: string; error: string }> = [];
        let backfillSifKeysArray: Array<[string, any]> = [];
        let backfillSifSaved = 0;

        if (backfillTasks.length === 0) {
            console.log(`[关键词跟踪-补齐] 所有关键词近${backfillDays}天数据齐全，无需补齐`);
        } else {
            // 预取 SIF 数据去重：同一 keyword+marketplace+date 只调一次
            const backfillSifCache = new Map<string, any>();
            const uniqueBackfillSifKeys = new Map<string, { keyword: string; marketplace: string; date: string }>();
            for (const task of backfillTasks) {
                const sifKey = `${task.tracking.keyword_value}|${task.tracking.marketplace}|${task.date}`;
                if (!uniqueBackfillSifKeys.has(sifKey)) {
                    uniqueBackfillSifKeys.set(sifKey, {
                        keyword: task.tracking.keyword_value,
                        marketplace: task.tracking.marketplace,
                        date: task.date,
                    });
                }
            }

            backfillSifKeysArray = Array.from(uniqueBackfillSifKeys.entries());
            backfillSifSaved = backfillTasks.length - backfillSifKeysArray.length;
            console.log(`[关键词跟踪-补齐] 共 ${backfillTasks.length} 个缺失快照, SIF去重: ${backfillSifKeysArray.length}个唯一查询 (节省${backfillSifSaved}次SIF调用)`);

            // 批量预取 SIF 数据
            for (let i = 0; i < backfillSifKeysArray.length; i += concurrency) {
                const batch = backfillSifKeysArray.slice(i, i + concurrency);
                const results = await Promise.allSettled(
                    batch.map(async ([sifKey, { keyword, marketplace, date }]) => {
                        const data = await this.sifKeywordService.fetchAsinPageListByKeyword({
                            keyword,
                            marketplaces: marketplace,
                            date,
                        });
                        return { sifKey, data };
                    })
                );
                for (const r of results) {
                    if (r.status === 'fulfilled') {
                        backfillSifCache.set(r.value.sifKey, r.value.data);
                    }
                }
                if (i + concurrency < backfillSifKeysArray.length) {
                    await new Promise(resolve => setTimeout(resolve, batchDelayMs));
                }
            }
            console.log(`[关键词跟踪-补齐] SIF 预取完成: ${backfillSifCache.size}/${backfillSifKeysArray.length} 成功`);

            // 用预取的数据逐条处理
            for (let batchStart = 0; batchStart < backfillTasks.length; batchStart += concurrency) {
                const batch = backfillTasks.slice(batchStart, batchStart + concurrency);

                const results = await Promise.allSettled(
                    batch.map(async (task) => {
                        const { tracking, date, cache } = task;
                        const sifKey = `${tracking.keyword_value}|${tracking.marketplace}|${date}`;
                        const sifData = backfillSifCache.get(sifKey);

                        if (!sifData) {
                            // SIF 预取失败的，存空标记
                            const emptySnapshot = this.keywordTrackingSnapshotRepo.create({
                                tracking_id: tracking.id,
                                snapshot_date: date,
                                total_result_count: 0,
                                raw_data: null,
                                analysis_data: JSON.stringify({ empty: true }),
                            });
                            await this.keywordTrackingSnapshotRepo.save(emptySnapshot);
                            return { status: 'empty' as const, keyword: tracking.keyword_value, date };
                        }

                        // 检测空数据
                        const hasData = sifData?.preciseUpdateTime != null
                            || (sifData?.pages && sifData.pages.some((p: any) => p.nfAsin?.length > 0 || p.spAsin?.length > 0));

                        if (!hasData) {
                            const emptySnapshot = this.keywordTrackingSnapshotRepo.create({
                                tracking_id: tracking.id,
                                snapshot_date: date,
                                total_result_count: 0,
                                raw_data: null,
                                analysis_data: JSON.stringify({ empty: true }),
                            });
                            await this.keywordTrackingSnapshotRepo.save(emptySnapshot);
                            return { status: 'empty' as const, keyword: tracking.keyword_value, date };
                        }

                        // 分析排名
                        const companyAsins = cache?.companyAsins ?? await this.getCompanyAsins(tracking.product_code, tracking.marketplace);
                        const companyAsinSet = new Set(companyAsins);
                        const rawCompetitorAsins = cache?.competitorAsins ?? await this.getCompetitorAsins(companyAsins, tracking.marketplace);
                        const competitorAsins = rawCompetitorAsins.filter(a => !companyAsinSet.has(a));

                        const analysis = this.analyzeRanking(sifData, tracking.asin_self, companyAsins, competitorAsins);

                        // 附加图片信息
                        try {
                            const companyInfoMap = cache?.companyInfoMap ?? await this.getCompanyAsinInfo(tracking.product_code, tracking.marketplace);
                            const competitorInfoMap = cache?.competitorInfoMap ?? await this.getCompetitorAsinInfo(competitorAsins, tracking.marketplace);
                            const allInfoMap = new Map([...competitorInfoMap, ...companyInfoMap]);
                            const attachInfo = (item: any) => {
                                if (!item || !item.asin) return;
                                const info = allInfoMap.get(item.asin) as any;
                                if (info) {
                                    item.image_url = info.image_url;
                                    item.seller = info.seller?.trim() || null;
                                    item.title = info.title?.trim() || null;
                                }
                            };
                            attachInfo(analysis.self);
                            if (analysis.company) analysis.company.forEach(attachInfo);
                            if (analysis.competitor) analysis.competitor.forEach(attachInfo);
                        } catch { /* 不影响快照 */ }

                        // 存快照
                        const snapshot = this.keywordTrackingSnapshotRepo.create({
                            tracking_id: tracking.id,
                            snapshot_date: date,
                            total_result_count: sifData?.totalResultCount ?? sifData?.totalProducts ?? null,
                            raw_data: JSON.stringify(sifData),
                            analysis_data: JSON.stringify(analysis),
                        });
                        await this.keywordTrackingSnapshotRepo.save(snapshot);

                        return { status: 'filled' as const, keyword: tracking.keyword_value, date };
                    })
                );

                for (let j = 0; j < results.length; j++) {
                    const task = batch[j];
                    const result = results[j];
                    if (result.status === 'fulfilled') {
                        if (result.value.status === 'empty') {
                            backfillEmpty++;
                        } else {
                            backfilled++;
                        }
                    } else {
                        backfillFailed++;
                        const errMsg = result.reason?.message || String(result.reason);
                        backfillErrors.push({ keyword: task.tracking.keyword_value, date: task.date, error: errMsg });
                    }
                }

                // 每 50 批打印一次进度
                const batchNum = Math.floor(batchStart / concurrency) + 1;
                const totalBatches = Math.ceil(backfillTasks.length / concurrency);
                if (batchNum % 50 === 0 || batchNum === totalBatches) {
                    console.log(`[关键词跟踪-补齐] 进度 ${batchNum}/${totalBatches} (补齐${backfilled}, 无数据${backfillEmpty}, 失败${backfillFailed})`);
                }

                // 批间间隔
                if (batchStart + concurrency < backfillTasks.length) {
                    await new Promise(resolve => setTimeout(resolve, batchDelayMs));
                }
            }
        }

        console.log(`[关键词跟踪-补齐] 第二阶段完成: 补齐${backfilled}, 无数据跳过${backfillEmpty}, 失败${backfillFailed}`);

        const durationMs = Date.now() - startTime;
        const durationStr = durationMs < 60000
            ? `${(durationMs / 1000).toFixed(1)}s`
            : `${Math.floor(durationMs / 60000)}m${Math.round((durationMs % 60000) / 1000)}s`;

        // ========== 打印完整总结 ==========
        const phase1SifCalls = sifKeysArray.length;
        const phase2SifCalls = backfillTasks.length > 0 ? (backfillSifKeysArray?.length ?? 0) : 0;
        const totalSifCalls = phase1SifCalls + phase2SifCalls;
        const totalSkipped = skippedToday + (trackingList.length * backfillDays - backfillTasks.length);
        const backfillSkippedByExisting = trackingList.length * backfillDays - backfillTasks.length;
        const totalDedupSaved = sifDedupSaved + (backfillTasks.length > 0 ? (backfillSifSaved ?? 0) : 0);

        console.log(`\n${'='.repeat(70)}`);
        console.log(`[关键词跟踪-定时] ★ 任务执行总结 ★`);
        console.log(`${'='.repeat(70)}`);
        console.log(`  跟踪关键词总数:   ${trackingList.length} 个`);
        console.log(`  总耗时:           ${durationStr}`);
        console.log(`  ─── 第一阶段（采集当天数据） ───`);
        console.log(`  跟踪记录:         ${needSnapshotList.length} 条`);
        console.log(`  SIF 去重后:       ${sifKeysArray.length} 个唯一关键词`);
        console.log(`  SIF API 调用:     ${phase1SifCalls} 次 (去重节省 ${sifDedupSaved} 次)`);
        console.log(`  成功:             ${success} 次`);
        console.log(`  失败:             ${fail} 次`);
        console.log(`  跳过(今日已采集): ${skippedToday} 次`);
        console.log(`  ─── 第二阶段（补齐历史 ${backfillDays} 天） ───`);
        console.log(`  总任务:           ${trackingList.length} × ${backfillDays} = ${trackingList.length * backfillDays} 个日期`);
        console.log(`  跳过(已有快照):   ${backfillSkippedByExisting} 个`);
        console.log(`  需要补齐:         ${backfillTasks.length} 个`);
        if (backfillTasks.length > 0) {
            console.log(`  SIF 去重后:       ${phase2SifCalls} 个唯一查询 (去重节省 ${backfillSifSaved ?? 0} 次)`);
        }
        console.log(`  SIF API 调用:     ${phase2SifCalls} 次`);
        console.log(`  补齐成功:         ${backfilled} 次`);
        console.log(`  空数据(已标记):   ${backfillEmpty} 次`);
        console.log(`  补齐失败:         ${backfillFailed} 次`);
        console.log(`  ─── SIF API 汇总 ───`);
        console.log(`  本次实际调用 SIF:  ${totalSifCalls} 次`);
        console.log(`  去重节省调用:      ${totalDedupSaved} 次`);
        console.log(`  跳过节省调用:      ${totalSkipped} 次`);
        console.log(`  总计节省:          ${totalDedupSaved + totalSkipped} 次`);
        console.log(`${'='.repeat(70)}\n`);

        // 按 Listing 分组重算汇总
        const recalcDone = new Set<string>();
        for (const tracking of trackingList) {
            const key = `${tracking.user_id}|${tracking.asin_self}|${tracking.marketplace}|${tracking.product_code}`;
            if (recalcDone.has(key)) continue;
            recalcDone.add(key);
            try {
                await this.recalcSummary(tracking);
            } catch (e) {
                console.warn(`[关键词跟踪-定时] 汇总计算失败 ${key}: ${e?.message || e}`);
            }
        }
        console.log(`[关键词跟踪-定时] 汇总重算完成: ${recalcDone.size} 个 Listing`);
        await this.cleanupOldSummaryHistory();

        return {
            total: trackingList.length,
            phase1: {
                trackingRecords: needSnapshotList.length,
                uniqueSifQueries: sifKeysArray.length,
                sifCalls: phase1SifCalls,
                dedupSaved: sifDedupSaved,
                success,
                fail,
                skippedToday,
            },
            phase2: {
                totalDateSlots: trackingList.length * backfillDays,
                skippedByExisting: backfillSkippedByExisting,
                uniqueSifQueries: phase2SifCalls,
                sifCalls: phase2SifCalls,
                dedupSaved: backfillTasks.length > 0 ? (backfillSifSaved ?? 0) : 0,
                backfilled,
                backfillEmpty,
                backfillFailed,
            },
            summary: {
                totalSifCalls,
                totalDedupSaved,
                totalSkipSaved: totalSkipped,
            },
            errors: errors.length > 10 ? errors.slice(0, 10) : errors,
            backfillErrors: backfillErrors.length > 10 ? backfillErrors.slice(0, 10) : backfillErrors,
            duration: durationStr,
        };
    }

    /**
     * 根据 keyword_id 列表批量查询关键词信息（中文翻译、得分、搜索量）
     * 通过 keyword_id 精准关联 app_amz_listing_keyword 表，替代原来的分页模糊匹配
     */
    async getKeywordInfoByIds(params: { keyword_ids: number[] }) {
        const { keyword_ids } = params;
        if (!keyword_ids || keyword_ids.length === 0) return [];

        // 过滤掉无效ID
        const validIds = keyword_ids.filter(id => id && id > 0);
        if (validIds.length === 0) return [];

        const placeholders = validIds.map(() => '?').join(',');
        const rows: any[] = await this.keywordTrackingRepo.query(
            `SELECT id, value, value_cn, sif_score, sif_search_volume_monthly
             FROM app_amz_listing_keyword
             WHERE id IN (${placeholders})`,
            validIds
        );
        return rows;
    }

    /**
     * 批量获取多个关键词的快照数据（聚合接口）
     * 前端一次传入所有 tracking_ids，后端一次查出所有快照并按 tracking_id 分组返回
     * 替代前端逐个调 snapshot.page 的串行请求
     *
     * @param tracking_ids - 跟踪记录ID列表
     * @param size - 每个关键词取最近几天的快照，默认15
     * @returns { [tracking_id]: snapshot[] } 按 tracking_id 分组
     */
    async batchSnapshots(params: {
        tracking_ids: number[];
        size?: number;
    }) {
        const { tracking_ids, size = 15 } = params;
        if (!tracking_ids || tracking_ids.length === 0) return {};

        const validIds = tracking_ids.filter(id => id && id > 0);
        if (validIds.length === 0) return {};

        // 使用窗口函数为每个 tracking_id 按日期降序编号，只取前 size 条
        const placeholders = validIds.map(() => '?').join(',');
        const rows: any[] = await this.keywordTrackingSnapshotRepo.query(
            `SELECT tracking_id, snapshot_date, total_result_count, analysis_data
             FROM (
                 SELECT tracking_id, snapshot_date, total_result_count, analysis_data,
                        ROW_NUMBER() OVER (PARTITION BY tracking_id ORDER BY snapshot_date DESC) AS rn
                 FROM app_amz_bsr_keyword_tracking_snapshot
                 WHERE tracking_id IN (${placeholders})
                   AND analysis_data IS NOT NULL
                   AND analysis_data != '{"empty":true}'
             ) ranked
             WHERE rn <= ?`,
            [...validIds, size]
        );

        // 按 tracking_id 分组
        const result: Record<number, any[]> = {};
        for (const id of validIds) {
            result[id] = [];
        }
        for (const row of rows) {
            const tid = Number(row.tracking_id);
            if (result[tid]) {
                result[tid].push(row);
            }
        }

        return result;
    }

    async trackingKeywordPage(query: any) {
        const page = Math.max(Number(query?.page) || 1, 1);
        const size = Math.max(Number(query?.size) || 200, 1);
        const status = query?.status === undefined || query?.status === '' ? 1 : query.status;
        const { listing_id, store_id, marketplace, product_code, asin_self, msku } = query || {};

        const hasListingId = listing_id !== undefined && listing_id !== null && listing_id !== '';
        const hasTuple = store_id !== undefined && store_id !== null && store_id !== ''
            && marketplace
            && product_code
            && asin_self
            && msku !== undefined
            && msku !== null;

        if (!hasListingId && !hasTuple) {
            throw new CoolCommException('缺少 Listing 定位参数');
        }

        const sidList = await this.getAuthorizedSidList();
        if (sidList !== null && sidList.length === 0) {
            return this.emptyPage({ page, size });
        }

        const params: any[] = [];
        let sql = `
            SELECT t.*
            FROM app_amz_bsr_keyword_tracking t
            WHERE 1 = 1
        `;

        if (status !== undefined && status !== '') {
            sql += ` AND t.status = ?`;
            params.push(status);
        }

        if (sidList !== null) {
            sql += ` AND t.store_id IN (${sidList.map(() => '?').join(',')})`;
            params.push(...sidList);
        }

        if (hasListingId) {
            sql += ` AND (`;

            if (hasTuple) {
                sql += `(
                    t.listing_id = ?
                    AND t.store_id = ?
                    AND t.marketplace = ?
                    AND t.product_code = ?
                    AND t.asin_self = ?
                    AND t.msku = ?
                ) OR (
                    t.store_id = ?
                    AND t.marketplace = ?
                    AND t.product_code = ?
                    AND t.asin_self = ?
                    AND t.msku = ?
                )`;
                params.push(
                    Number(listing_id), Number(store_id), marketplace, product_code, asin_self, msku,
                    Number(store_id), marketplace, product_code, asin_self, msku
                );
            } else {
                sql += `t.listing_id = ?`;
                params.push(Number(listing_id));
            }

            sql += `)`;
        } else {
            sql += ` AND (
                t.store_id = ?
                AND t.marketplace = ?
                AND t.product_code = ?
                AND t.asin_self = ?
                AND t.msku = ?
            )`;
            params.push(Number(store_id), marketplace, product_code, asin_self, msku);
        }

        sql += ` ORDER BY COALESCE(t.last_snapshot_time, t.updateTime, t.createTime) DESC, t.id DESC`;

        const rows = await this.nativeQuery(sql, params);
        const currentUserId = Number(this.ctx?.admin?.userId || 0);
        const list = this.dedupeKeywordTrackingsByLatest(rows || [], currentUserId)
            .map((row: any) => ({
                ...row,
                is_mine: currentUserId > 0 && Number(row.user_id) === currentUserId ? 1 : 0,
            }));
        const start = (page - 1) * size;

        return {
            list: list.slice(start, start + size),
            pagination: {
                page,
                size,
                total: list.length,
            },
        };
    }

    /**
     * 回填历史快照：为选中的跟踪关键词获取过去N天的历史数据
     * 后台异步执行，前端不等待结果
     * 
     * 流程：
     * 1. 查出选中的 tracking 记录
     * 2. 生成过去 days 天的日期列表
     * 3. 对每个 tracking × 每个日期，检查是否已有快照
     * 4. 对缺失的日期，调 SIF API（传 date 参数）获取数据
     * 5. 分析排名并存入 snapshot 表
     * 6. 每次调用间隔 2 秒，避免限流
     */
    async fetchHistoricalSnapshots(params: {
        tracking_ids: number[];
        days?: number;
    }) {
        const { tracking_ids, days = 15 } = params;
        if (!tracking_ids || tracking_ids.length === 0) {
            throw new CoolCommException('请至少选择一个关键词');
        }

        // 查出选中的 tracking 记录
        const trackingList = await this.keywordTrackingRepo.findByIds(tracking_ids);
        if (trackingList.length === 0) {
            throw new CoolCommException('未找到有效的跟踪记录');
        }

        // 生成过去 days 天的日期列表（不含今天，因为今天的数据由当日采集负责）
        const dateList: string[] = [];
        for (let i = 1; i <= days; i++) {
            dateList.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'));
        }

        // 统计总任务量
        let totalTasks = 0;
        let skipped = 0;
        let filled = 0;
        let failed = 0;
        const errors: Array<{ keyword: string; date: string; error: string }> = [];

        console.log(`[关键词跟踪-历史回填] 开始: ${trackingList.length}个关键词 × ${days}天`);

        // 按 product_code+marketplace 预加载缓存
        const cacheMap = new Map<string, {
            companyAsins: string[];
            competitorAsins: string[];
            companyInfoMap: Map<string, { image_url: string | null; seller: string | null; title: string | null }>;
            competitorInfoMap: Map<string, { image_url: string | null; seller: string | null; title: string | null }>;
        }>();

        for (const tracking of trackingList) {
            const cacheKey = `${tracking.product_code}|${tracking.marketplace}`;
            if (!cacheMap.has(cacheKey)) {
                try {
                    const companyAsins = await this.getCompanyAsins(tracking.product_code, tracking.marketplace);
                    const competitorAsins = await this.getCompetitorAsins(companyAsins, tracking.marketplace);
                    const companyInfoMap = await this.getCompanyAsinInfo(tracking.product_code, tracking.marketplace);
                    const competitorInfoMap = await this.getCompetitorAsinInfo(competitorAsins, tracking.marketplace);
                    cacheMap.set(cacheKey, { companyAsins, competitorAsins, companyInfoMap, competitorInfoMap });
                } catch (e) {
                    console.warn(`[关键词跟踪-历史回填] 预加载缓存失败 ${cacheKey}: ${e?.message || e}`);
                }
            }
        }

        // 收集所有需要回填的任务
        const backfillTasks: Array<{ tracking: any; date: string; cache: any }> = [];

        for (const tracking of trackingList) {
            const cacheKey = `${tracking.product_code}|${tracking.marketplace}`;
            const cache = cacheMap.get(cacheKey);

            // 查出该 tracking 已有的快照日期
            const existingSnapshots = await this.keywordTrackingSnapshotRepo.find({
                where: { tracking_id: tracking.id },
                select: ['snapshot_date'],
            });
            const existingDates = new Set(existingSnapshots.map(s => s.snapshot_date));

            for (const date of dateList) {
                totalTasks++;
                if (existingDates.has(date)) {
                    skipped++;
                } else {
                    backfillTasks.push({ tracking, date, cache });
                }
            }
        }

        console.log(`[关键词跟踪-历史回填] 总${totalTasks}, 已有${skipped}, 需回填${backfillTasks.length}`);

        if (backfillTasks.length === 0) {
            console.log(`[关键词跟踪-历史回填] 所有数据齐全，无需回填`);
        } else {
            // SIF 去重：同一 keyword+marketplace+date 只调一次
            const sifCache = new Map<string, any>();
            const uniqueSifKeys = new Map<string, { keyword: string; marketplace: string; date: string }>();
            for (const task of backfillTasks) {
                const sifKey = `${task.tracking.keyword_value}|${task.tracking.marketplace}|${task.date}`;
                if (!uniqueSifKeys.has(sifKey)) {
                    uniqueSifKeys.set(sifKey, {
                        keyword: task.tracking.keyword_value,
                        marketplace: task.tracking.marketplace,
                        date: task.date,
                    });
                }
            }

            const sifKeysArray = Array.from(uniqueSifKeys.entries());
            const sifDedupSaved = backfillTasks.length - sifKeysArray.length;
            console.log(`[关键词跟踪-历史回填] SIF去重: ${backfillTasks.length}个任务 → ${sifKeysArray.length}个唯一查询 (节省${sifDedupSaved}次)`);

            // 批量预取 SIF 数据（3并发）
            const concurrency = 3;
            for (let i = 0; i < sifKeysArray.length; i += concurrency) {
                const batch = sifKeysArray.slice(i, i + concurrency);
                const results = await Promise.allSettled(
                    batch.map(async ([sifKey, { keyword, marketplace, date }]) => {
                        const data = await this.sifKeywordService.fetchAsinPageListByKeyword({
                            keyword,
                            marketplaces: marketplace,
                            date,
                        });
                        return { sifKey, data };
                    })
                );
                for (const r of results) {
                    if (r.status === 'fulfilled') {
                        sifCache.set(r.value.sifKey, r.value.data);
                    }
                }
                if (i + concurrency < sifKeysArray.length) {
                    await new Promise(resolve => setTimeout(resolve, 700));
                }
            }
            console.log(`[关键词跟踪-历史回填] SIF预取完成: ${sifCache.size}/${sifKeysArray.length} 成功`);

            // 用预取的数据逐条处理
            for (const task of backfillTasks) {
                const { tracking, date, cache } = task;
                const sifKey = `${tracking.keyword_value}|${tracking.marketplace}|${date}`;
                const sifData = sifCache.get(sifKey);

                try {
                    if (!sifData) {
                        // SIF 预取失败，存空标记
                        const emptySnapshot = this.keywordTrackingSnapshotRepo.create({
                            tracking_id: tracking.id,
                            snapshot_date: date,
                            total_result_count: 0,
                            raw_data: null,
                            analysis_data: JSON.stringify({ empty: true }),
                        });
                        await this.keywordTrackingSnapshotRepo.save(emptySnapshot);
                        skipped++;
                        continue;
                    }

                    // 检测空数据
                    const hasData = sifData?.preciseUpdateTime != null
                        || (sifData?.pages && sifData.pages.some((p: any) => p.nfAsin?.length > 0 || p.spAsin?.length > 0));

                    if (!hasData) {
                        const emptySnapshot = this.keywordTrackingSnapshotRepo.create({
                            tracking_id: tracking.id,
                            snapshot_date: date,
                            total_result_count: 0,
                            raw_data: null,
                            analysis_data: JSON.stringify({ empty: true }),
                        });
                        await this.keywordTrackingSnapshotRepo.save(emptySnapshot);
                        skipped++;
                        console.log(`[关键词跟踪-历史回填] "${tracking.keyword_value}" ${date} 无数据，已存空标记`);
                        continue;
                    }

                    // 获取 ASIN 池
                    const companyAsins = cache?.companyAsins ?? await this.getCompanyAsins(tracking.product_code, tracking.marketplace);
                    const companyAsinSet = new Set(companyAsins);
                    const rawCompetitorAsins = cache?.competitorAsins ?? await this.getCompetitorAsins(companyAsins, tracking.marketplace);
                    const competitorAsins = rawCompetitorAsins.filter(a => !companyAsinSet.has(a));

                    // 分析排名
                    const analysis = this.analyzeRanking(sifData, tracking.asin_self, companyAsins, competitorAsins);

                    // 附加图片信息
                    try {
                        const companyInfoMap = cache?.companyInfoMap ?? await this.getCompanyAsinInfo(tracking.product_code, tracking.marketplace);
                        const competitorInfoMap = cache?.competitorInfoMap ?? await this.getCompetitorAsinInfo(competitorAsins, tracking.marketplace);
                        const allInfoMap = new Map([...competitorInfoMap, ...companyInfoMap]);
                        const attachInfo = (item: any) => {
                            if (!item || !item.asin) return;
                            const info = allInfoMap.get(item.asin) as { image_url: string | null; seller: string | null; title: string | null } | undefined;
                            if (info) {
                                item.image_url = info.image_url;
                                item.seller = info.seller?.trim() || null;
                                item.title = info.title?.trim() || null;
                            }
                        };
                        attachInfo(analysis.self);
                        if (analysis.company) analysis.company.forEach(attachInfo);
                        if (analysis.competitor) analysis.competitor.forEach(attachInfo);
                    } catch { /* 不影响快照 */ }

                    // 存入 snapshot 表
                    const snapshot = this.keywordTrackingSnapshotRepo.create({
                        tracking_id: tracking.id,
                        snapshot_date: date,
                        total_result_count: sifData?.totalResultCount ?? sifData?.totalProducts ?? null,
                        raw_data: JSON.stringify(sifData),
                        analysis_data: JSON.stringify(analysis),
                    });
                    await this.keywordTrackingSnapshotRepo.save(snapshot);

                    filled++;
                    console.log(`[关键词跟踪-历史回填] "${tracking.keyword_value}" ${date} 成功`);

                } catch (err) {
                    failed++;
                    const errMsg = err?.message || String(err);
                    errors.push({ keyword: tracking.keyword_value, date, error: errMsg });
                    console.warn(`[关键词跟踪-历史回填] "${tracking.keyword_value}" ${date} 失败: ${errMsg}`);
                }
            }
        }

        const sifDedupInfo = backfillTasks.length > 0
            ? (() => {
                const uniqueKeys = new Set(backfillTasks.map(t => `${t.tracking.keyword_value}|${t.tracking.marketplace}|${t.date}`));
                return { uniqueQueries: uniqueKeys.size, dedupSaved: backfillTasks.length - uniqueKeys.size };
            })()
            : { uniqueQueries: 0, dedupSaved: 0 };

        const summary = {
            total: totalTasks,
            filled,
            skipped,
            failed,
            sifDedupSaved: sifDedupInfo.dedupSaved,
            errors: errors.length > 20 ? errors.slice(0, 20) : errors,
        };
        console.log(`[关键词跟踪-历史回填] 完成: 总${totalTasks}, 回填${filled}, 跳过${skipped}, 失败${failed}, SIF去重节省${sifDedupInfo.dedupSaved}次`);

        // 回填完成后按 Listing 分组重算汇总
        const recalcDone = new Set<string>();
        for (const tracking of trackingList) {
            const key = `${tracking.user_id}|${tracking.asin_self}|${tracking.marketplace}|${tracking.product_code}`;
            if (recalcDone.has(key)) continue;
            recalcDone.add(key);
            try {
                await this.recalcSummary(tracking);
            } catch (e) {
                console.warn(`[关键词跟踪-历史回填] 汇总计算失败 ${key}: ${e?.message || e}`);
            }
        }
        console.log(`[关键词跟踪-历史回填] 汇总重算完成: ${recalcDone.size} 个 Listing`);
        return summary;
    }

    private getSummaryHistoryKey(row: any) {
        return [
            row?.store_id ?? 0,
            row?.marketplace ?? '',
            row?.product_code ?? '',
            row?.asin_self ?? row?.asin ?? '',
            row?.msku ?? '',
        ].join('|');
    }

    private normalizeSummaryHistoryRow(row: any) {
        const toNumber = (val: any) => val === null || val === undefined || val === '' ? null : Number(val);
        const formatDate = (val: any) => {
            if (!val) return '';
            if (val instanceof Date) return dayjs(val).format('YYYY-MM-DD');
            return String(val).slice(0, 10);
        };

        return {
            summary_date: formatDate(row.summary_date),
            score_nf: toNumber(row.score_nf),
            score_sp: toNumber(row.score_sp),
            behind_rate_nf: toNumber(row.behind_rate_nf),
            behind_rate_sp: toNumber(row.behind_rate_sp),
        };
    }

    private async attachSummaryHistories(list: any[]) {
        if (!Array.isArray(list) || list.length === 0) return;

        const filters: string[] = [];
        const params: any[] = [];
        for (const row of list) {
            if (!row?.marketplace || !row?.product_code || !row?.asin) {
                row.summary_history = [];
                continue;
            }
            filters.push(`(
                s0.store_id <=> ?
                AND s0.marketplace = ?
                AND s0.product_code = ?
                AND s0.asin_self = ?
                AND s0.msku <=> ?
            )`);
            params.push(row.store_id ?? null, row.marketplace, row.product_code, row.asin, row.msku ?? null);
        }

        if (filters.length === 0) return;

        const rows: any[] = await this.keywordTrackingSummaryRepo.query(
            `SELECT *
             FROM (
                 SELECT day_summary.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY
                                COALESCE(day_summary.store_id, 0),
                                day_summary.marketplace,
                                day_summary.product_code,
                                day_summary.asin_self,
                                COALESCE(day_summary.msku, '')
                            ORDER BY day_summary.summary_date DESC,
                                     COALESCE(day_summary.last_calc_time, day_summary.updateTime, day_summary.createTime) DESC,
                                     day_summary.id DESC
                        ) AS history_rn
                 FROM (
                     SELECT s0.*,
                            ROW_NUMBER() OVER (
                                PARTITION BY
                                    COALESCE(s0.store_id, 0),
                                    s0.marketplace,
                                    s0.product_code,
                                    s0.asin_self,
                                    COALESCE(s0.msku, ''),
                                    s0.summary_date
                                ORDER BY COALESCE(s0.last_calc_time, s0.updateTime, s0.createTime) DESC, s0.id DESC
                            ) AS day_rn
                     FROM app_amz_bsr_keyword_tracking_summary s0
                     WHERE ${filters.join(' OR ')}
                 ) day_summary
                 WHERE day_summary.day_rn = 1
             ) history_summary
             WHERE history_summary.history_rn <= 15
             ORDER BY history_summary.summary_date DESC,
                      COALESCE(history_summary.last_calc_time, history_summary.updateTime, history_summary.createTime) DESC,
                      history_summary.id DESC`,
            params
        );

        const historyMap = new Map<string, any[]>();
        for (const row of rows) {
            const key = this.getSummaryHistoryKey(row);
            const arr = historyMap.get(key) || [];
            arr.push(this.normalizeSummaryHistoryRow(row));
            historyMap.set(key, arr);
        }

        for (const row of list) {
            row.summary_history = historyMap.get(this.getSummaryHistoryKey(row)) || [];
        }
    }

    /**
     * 跟踪关键词的 Listing 分页查询
     * 与原 bsr_product_Listing_Lingxing.page 完全一致，
     * 唯一区别：WHERE 增加 EXISTS 只显示有开启跟踪的 Listing
     */
    async trackingListingPage(query: any) {
        const { keyWord, sellableDaysType, sellableDaysOperator, sellableDaysValue, ...others } = query;

        const fieldEq = ['mergeId', 'msku', 'asin', 'shop', 'item_name', 'status', 'marketplace', 'product_code',
            'outOfStockStatus',
            'abnormalOfflineStatus',
            'newProductStatus',
            'needUpdateOperationPlan',
            'categoryTrafficStatus',
            'productTrafficStatus',
            'stockOver90Days',
            'seller_name', 'inventoryStatusText'];

        const sidList = await this.getAuthorizedSidList();
        const storePermissionSql = sidList === null
            ? ''
            : sidList.length > 0
                ? this.setSql(true, ` AND a.store_id IN (?)`, [sidList])
                : ' AND 1 = 0';

        let sql = `
            SELECT
                a.*,
                ANY_VALUE(b.id) as restocking_id,
                ANY_VALUE(b.salesInfo) as restocking_salesInfo,
                ANY_VALUE(b.fbaValidList) as restocking_fbaValidList,
                ANY_VALUE(b.fbaShippingList) as restocking_fbaShippingList,
                ANY_VALUE(b.suggestInfo) as restocking_suggestInfo,
                ANY_VALUE(s.score_nf) as score_nf,
                ANY_VALUE(s.score_sp) as score_sp,
                ANY_VALUE(s.behind_rate_nf) as behind_rate_nf,
                ANY_VALUE(s.behind_rate_sp) as behind_rate_sp,
                ANY_VALUE(s.competitor_count) as competitor_count,
                ANY_VALUE(s.behind_count_nf) as behind_count_nf,
                ANY_VALUE(s.behind_count_sp) as behind_count_sp,
                ANY_VALUE(s.summary_date) as summary_date
            FROM
                app_amz_bsr_product_listing_lingxing a
                LEFT JOIN app_amz_bsr_restocking_center_lingxing b ON a.asin = b.asin 
                AND (
                  JSON_CONTAINS(b.marketplaceList, JSON_QUOTE(a.marketplace)) 
                  OR 
                  JSON_CONTAINS(b.marketplaceList, JSON_QUOTE(
                      CASE a.marketplace
                          WHEN '英国' THEN 'UK'
                          WHEN '德国' THEN 'DE'
                          WHEN '法国' THEN 'FR'
                          WHEN '意大利' THEN 'IT'
                          WHEN '西班牙' THEN 'ES'
                          WHEN '美国' THEN 'US'
                          WHEN '加拿大' THEN 'CA'
                          WHEN '日本' THEN 'JP'
                          ELSE a.marketplace
                      END
                  ))
                )
                AND JSON_CONTAINS(b.storeList, JSON_QUOTE(a.seller_name))
                LEFT JOIN (
                    SELECT *
                    FROM (
                        SELECT
                            s0.*,
                            ROW_NUMBER() OVER (
                                PARTITION BY
                                    COALESCE(s0.store_id, 0),
                                    s0.marketplace,
                                    s0.product_code,
                                    s0.asin_self,
                                    COALESCE(s0.msku, '')
                                ORDER BY COALESCE(s0.last_calc_time, s0.updateTime, s0.createTime) DESC, s0.id DESC
                            ) AS rn
                        FROM app_amz_bsr_keyword_tracking_summary s0
                        WHERE s0.summary_date = CURDATE()
                    ) ranked_summary
                    WHERE ranked_summary.rn = 1
                ) s ON s.store_id = a.store_id
                    AND s.marketplace = a.marketplace
                    AND s.product_code = a.product_code
                    AND s.asin_self = a.asin
                    AND s.msku <=> a.msku
            WHERE 1 = 1
              ${storePermissionSql}
              AND EXISTS (
                SELECT 1 FROM app_amz_bsr_keyword_tracking t
                WHERE t.status = 1
                  AND t.store_id = a.store_id
                  AND t.marketplace = a.marketplace
                  AND t.product_code = a.product_code
                  AND t.asin_self = a.asin
                  AND t.msku <=> a.msku
        `;

        sql += `
              )
        `;

        // 处理 fieldEq
        for (const field of fieldEq) {
            const val = others[field];
            if (val !== undefined && val !== '') {
                if (Array.isArray(val)) {
                    sql += this.setSql(true, ` AND a.${field} IN(?)`, [val]);
                } else {
                    sql += this.setSql(true, ` AND a.${field} = ?`, [val]);
                }
            }
        }

        // 处理 keyWord
        if (keyWord) {
            const likeFields = ['mergeId', 'msku', 'asin', 'shop', 'item_name', 'product_code'];
            const conditions = likeFields.map(f => `a.${f} LIKE ? `).join(' OR ');
            const params = likeFields.map(() => `% ${keyWord}% `);
            sql += this.setSql(true, ` AND(${conditions})`, params);
        }

        // 处理可售天数筛选
        if (sellableDaysType && sellableDaysOperator && sellableDaysValue !== undefined && sellableDaysValue !== '') {
            const val = Number(sellableDaysValue);
            let field = '';

            if (sellableDaysType === 'fba') {
                field = 'a.sellableDays';
            } else if (sellableDaysType === 'total') {
                field = "JSON_UNQUOTE(JSON_EXTRACT(b.suggestInfo, '$.availableSaleDays'))";
            }

            if (field) {
                const allowedOps = ['gt', 'gte', 'lt', 'lte', 'eq'];
                if (allowedOps.includes(sellableDaysOperator)) {
                    const opMap: Record<string, string> = { gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=' };
                    const castField = sellableDaysType === 'total' ? `CAST(${field} AS DECIMAL(10, 2))` : field;
                    sql += this.setSql(true, ` AND ${castField} ${opMap[sellableDaysOperator]} ?`, [val]);

                    if (['gt', 'gte'].includes(sellableDaysOperator) && val < 999) {
                        sql += ` AND ${castField} <999`;
                    }
                }
            }
        }

        sql += ` GROUP BY a.id`;

        const result = await this.sqlRenderPage(sql, query);

        // 处理结果：与原代码完全一致
        if (result.list) {
            const safeJsonParse = (val: any) => {
                if (typeof val === 'string' && val) {
                    try { return JSON.parse(val); } catch (e) { return val; }
                }
                return val;
            };

            result.list.forEach((row: any) => {
                row.restocking = {
                    id: row.restocking_id,
                    salesInfo: safeJsonParse(row.restocking_salesInfo),
                    fbaValidList: safeJsonParse(row.restocking_fbaValidList),
                    fbaShippingList: safeJsonParse(row.restocking_fbaShippingList),
                    suggestInfo: safeJsonParse(row.restocking_suggestInfo),
                };

                if (row.restocking?.suggestInfo?.availableSaleDays !== undefined) {
                    row.stockDays = row.restocking.suggestInfo.availableSaleDays;
                }

                delete row.restocking_id;
                delete row.restocking_salesInfo;
                delete row.restocking_fbaValidList;
                delete row.restocking_fbaShippingList;
                delete row.restocking_suggestInfo;

                ['rank', 'small_rank', 'seller_category', 'variant_text', 'tags'].forEach(key => {
                    row[key] = safeJsonParse(row[key]);
                });
            });

            await this.attachSummaryHistories(result.list);
        }

        return result;
    }
}
