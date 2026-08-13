import { Provide, Inject } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { EntityManager, Repository, In } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';
import { AppAmzListingKeywordEntity } from '../entity/keyword';
import { AppUserKeywordConfigEntity } from '../entity/userKeywordConfig';
import { BaseSysParamEntity } from '../../base/entity/sys/param';
import { BaseSysUserEntity } from '../../base/entity/sys/user';
import { AppAmzBsrCandidateEntity } from '../entity/bsr_candidate';
import { AppAmzBsrCandidateCompetitorEntity } from '../entity/bsr_candidate_competitor';
import { SifUtils } from '../utils/sif/sifUtils';
import { AppBaiduTranslateApiLogEntity } from '../entity/baidu_translate_api_log';
import * as dayjs from 'dayjs';
import { AppAmzBsrProductListingLingxingEntity } from '../entity/bsr_product_Listing_Lingxing';

interface DeleteKeywordTrackingScope {
    user_id?: number;
    marketplace?: string;
    marketplaces?: string;
    product_code?: string;
    asin?: string;
    asin_self?: string;
    store_id?: number | string | null;
    msku?: string | null;
    seller_sku?: string | null;
}

interface DeleteKeywordsOptions {
    tracking_scope?: DeleteKeywordTrackingScope;
}

/**
 * SIF 关键词服务
 * - 通过竞品 ASIN 批量查询关键词（调 SIF 接口）
 * - 批量入库关键词（upsert 逻辑）
 */
@Provide()
export class SifKeywordService extends BaseService {
    @InjectEntityModel(AppAmzListingKeywordEntity)
    keywordRepo: Repository<AppAmzListingKeywordEntity>;

    @InjectEntityModel(AppUserKeywordConfigEntity)
    userKeywordConfigRepo: Repository<AppUserKeywordConfigEntity>;

    
    @InjectEntityModel(AppBaiduTranslateApiLogEntity)
    baiduTranslateApiLogRepo: Repository<AppBaiduTranslateApiLogEntity>;
    
    @InjectEntityModel(BaseSysParamEntity)
    baseSysParamRepo: Repository<BaseSysParamEntity>;

    @InjectEntityModel(BaseSysUserEntity)
    userRepo: Repository<BaseSysUserEntity>;

    @InjectEntityModel(AppAmzBsrCandidateEntity)
    candidateRepo: Repository<AppAmzBsrCandidateEntity>;

    @InjectEntityModel(AppAmzBsrCandidateCompetitorEntity)
    competitorRepo: Repository<AppAmzBsrCandidateCompetitorEntity>;
	
	@InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
    listingRepo: Repository<AppAmzBsrProductListingLingxingEntity>;

    @Inject()
    sifUtils: SifUtils;

    @Inject()
    ctx;

    private readonly DEFAULT_KEYWORD_LIMIT = 3;

    private toDefaultKeywordNumber(value: number | string | null | undefined): number {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    }

    private selectTopDefaultKeywords<T extends Pick<AppAmzListingKeywordEntity, 'id'> & {
        sif_score?: number | string | null;
        sif_search_volume_monthly?: number | string | null;
    }>(keywords: T[], limit = this.DEFAULT_KEYWORD_LIMIT): T[] {
        return [...keywords]
            .sort((a, b) => {
                const scoreDiff = this.toDefaultKeywordNumber(b.sif_score) - this.toDefaultKeywordNumber(a.sif_score);
                if (scoreDiff !== 0) return scoreDiff;

                const volumeDiff = this.toDefaultKeywordNumber(b.sif_search_volume_monthly) - this.toDefaultKeywordNumber(a.sif_search_volume_monthly);
                if (volumeDiff !== 0) return volumeDiff;

                return Number(a.id) - Number(b.id);
            })
            .slice(0, limit);
    }

    private ensureDefaultKeywordLimit(ids: number[]): number[] {
        const uniqueIds = [...new Set(ids)];
        if (uniqueIds.length > this.DEFAULT_KEYWORD_LIMIT) {
            throw new Error(`默认关键词最多设置${this.DEFAULT_KEYWORD_LIMIT}个`);
        }
        return uniqueIds;
    }

    private toRequiredScopeString(value: unknown): string | null {
        if (value === undefined || value === null) return null;
        const text = String(value);
        return text.trim() ? text : null;
    }

    private toNullableScopeString(value: unknown): string | null {
        if (value === undefined || value === null) return null;
        return String(value);
    }

    private toNullableScopeNumber(value: unknown): number | null {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    private getAffectedRows(result: any): number {
        if (Array.isArray(result)) {
            return Number(result[0]?.affectedRows || result[0]?.changedRows || 0);
        }
        return Number(result?.affectedRows || result?.changedRows || 0);
    }

    private async stopCurrentUserTrackingForDeletedKeywords(
        manager: EntityManager,
        deletedIds: number[],
        options?: DeleteKeywordsOptions
    ): Promise<number> {
        const scope = options?.tracking_scope;
        if (!scope || deletedIds.length === 0) return 0;

        const userId = this.ctx?.admin?.userId;
        const marketplace = this.toRequiredScopeString(scope.marketplace ?? scope.marketplaces);
        const productCode = this.toRequiredScopeString(scope.product_code);
        const asinSelf = this.toRequiredScopeString(scope.asin_self ?? scope.asin);
        const storeId = this.toNullableScopeNumber(scope.store_id);
        const msku = this.toNullableScopeString(scope.msku ?? scope.seller_sku);

        if (!userId || !marketplace || !productCode || !asinSelf) {
            return 0;
        }

        const idPlaceholders = deletedIds.map(() => '?').join(',');
        const result = await manager.query(
            `
            UPDATE app_amz_bsr_keyword_tracking t
            JOIN app_amz_listing_keyword k
              ON k.id IN (${idPlaceholders})
             AND k.product_code = t.product_code
             AND k.marketplaces = t.marketplace
             AND (
                t.keyword_id = k.id
                OR LOWER(TRIM(t.keyword_value)) = LOWER(TRIM(k.value))
             )
            SET t.status = 0,
                t.updateTime = NOW()
            WHERE t.status = 1
              AND t.user_id = ?
              AND t.store_id <=> ?
              AND t.marketplace = ?
              AND t.product_code = ?
              AND t.asin_self = ?
              AND t.msku <=> ?
            `,
            [
                ...deletedIds,
                userId,
                storeId,
                marketplace,
                productCode,
                asinSelf,
                msku,
            ]
        );

        return this.getAffectedRows(result);
    }

    private async getTopDefaultKeywordCandidates(
        product_code: string,
        marketplaces: string,
        excludeIds: number[] = [],
        limit = this.DEFAULT_KEYWORD_LIMIT
    ) {
        const query = this.keywordRepo
            .createQueryBuilder('a')
            .where('a.product_code = :product_code', { product_code })
            .andWhere('a.marketplaces = :marketplaces', { marketplaces })
            .andWhere('a.status = 3');

        if (excludeIds.length > 0) {
            query.andWhere('a.id NOT IN (:...excludeIds)', { excludeIds });
        }

        return query
            .orderBy('a.sif_score IS NULL', 'ASC')
            .addOrderBy('a.sif_score', 'DESC')
            .addOrderBy('a.sif_search_volume_monthly', 'DESC')
            .addOrderBy('a.id', 'ASC')
            .limit(limit)
            .getMany();
    }

    private async getEffectiveDefaultKeywords(
        config: AppUserKeywordConfigEntity,
        product_code: string,
        marketplaces: string
    ) {
        if (!config?.default_keyword_ids?.length) return [];

        const keywords = await this.keywordRepo.find({
            where: {
                id: In(config.default_keyword_ids),
                product_code,
                marketplaces,
            },
        });

        return this.selectTopDefaultKeywords(keywords);
    }

    private async initializeDefaultKeywordsIfMissing(
        userId: number | undefined,
        product_code: string,
        marketplaces: string
    ) {
        if (!userId) return;

        let config = await this.userKeywordConfigRepo.findOne({
            where: { user_id: userId, product_code, marketplaces },
        });

        if (config?.default_keyword_ids?.length > 0) {
            return;
        }

        const topKeywords = await this.getTopDefaultKeywordCandidates(product_code, marketplaces);
        const defaultKeywordIds = topKeywords.map(item => item.id);
        if (defaultKeywordIds.length === 0) {
            return;
        }

        if (config) {
            config.default_keyword_ids = defaultKeywordIds;
        } else {
            config = this.userKeywordConfigRepo.create({
                user_id: userId,
                product_code,
                marketplaces,
                default_keyword_ids: defaultKeywordIds,
            });
        }

        await this.userKeywordConfigRepo.save(config);
        console.log(`[SIF] 自动初始化默认关键词: user=${userId}, product_code=${product_code}, marketplaces=${marketplaces}, ids=${defaultKeywordIds.join(',')}`);
    }

    // ========== 国家映射 ==========

    /**
     * 中文国家名 → SIF country 代码
     * 找不到直接报错，不做默认值
     */
    private mapMarketplaceToSifCountry(marketplace: string): string {
        const map: Record<string, string> = {
            '美国': 'US',
            '英国': 'UK',
            '德国': 'DE',
            '日本': 'JP',
            '加拿大': 'CA',
            '法国': 'FR',
            '西班牙': 'ES',
            '意大利': 'IT',
        };
        const code = map[marketplace];
        if (!code) {
            throw new Error(`不支持的国家: "${marketplace}"，SIF仅支持: ${Object.keys(map).join('、')}`);
        }
        return code;
    }

    /**
     * 国家/站点 → 百度翻译源语言代码
     */
    private mapMarketplaceToBaiduLanguage(marketplace?: string): string | undefined {
        const normalized = marketplace?.trim();
        if (!normalized) return undefined;

        const upper = normalized.toUpperCase();
        const map: Record<string, string> = {
            '美国': 'en',
            'US': 'en',
            '英国': 'en',
            'UK': 'en',
            'GB': 'en',
            '加拿大': 'en',
            'CA': 'en',
            '澳大利亚': 'en',
            'AU': 'en',
            '德国': 'de',
            'DE': 'de',
            '法国': 'fra',
            'FR': 'fra',
            '西班牙': 'spa',
            'ES': 'spa',
            '意大利': 'it',
            'IT': 'it',
            '日本': 'jp',
            'JP': 'jp',
        };

        return map[normalized] || map[upper];
    }

    private resolveBaiduTranslateFromLanguage(marketplaces?: string, from?: string): string {
        return from || this.mapMarketplaceToBaiduLanguage(marketplaces) || 'en';
    }

    // ========== 接口 1：批量获取候选产品关键词 ==========

    /**
     * 批量为选品获取关键词
     * @param ids 选品ID列表
     */
    async fetchKeywordsForCandidates(ids: number[]) {
        // 1. 获取候选产品信息
        const candidates = await this.candidateRepo.find({
            where: { id: In(ids) }
        });

        if (!candidates || candidates.length === 0) {
            throw new Error('未找到对应的候选产品');
        }

        // 异步后台执行任务，避免阻塞前端请求
        this.executeFetchKeywordsForCandidates(candidates).catch(err => {
            console.error('后台获取候选产品关键词失败:', err);
        });

        return { message: '关键词获取任务已提交' };
    }

    /**
     * 异步处理获取关键词的具体逻辑
     */
    private async executeFetchKeywordsForCandidates(candidates: AppAmzBsrCandidateEntity[]) {
        for (const candidate of candidates) {
            try {
                // 2. 查询该候选产品的竞品 (取前20个，原逻辑取 status in (1,2) 或其它状态，这里取有销量的竞品)
                const competitors = await this.competitorRepo
                    .createQueryBuilder('comp')
                    .where('comp.candidate_id = :candidateId', { candidateId: candidate.id })
                    .andWhere('comp.status IN (:...statusList)', { statusList: [1, 2, 6, 7] }) // 包含各类有效竞品
                    .orderBy('comp.Main_monthly_sales', 'DESC')
                    .addOrderBy('comp.bsr_rank', 'ASC')
                    .limit(20)
                    .getMany();

                if (!competitors || competitors.length === 0) {
                    console.log(`候选产品 ${candidate.asin} 没有找到竞品数据，跳过`);
                    continue;
                }

                const competitorAsins = competitors.map(c => c.asin_competitor).filter(Boolean);
                if (competitorAsins.length === 0) continue;

                // 3. 调用 SIF 接口获取关键词
                console.log(`开始为候选产品 ${candidate.asin} 获取关键词，竞品数量: ${competitorAsins.length}`);
                const result = await this.fetchByCompetitorAsins({
                    asin: candidate.asin,
                    product_code: candidate.asin,
                    marketplaces: candidate.marketplace,
                    competitor_asins: competitorAsins
                });

                // 4. 将获取到的关键词自动入库
                if (result && result.keywords && result.keywords.length > 0) {
                    const saveResult = await this.batchSaveKeywordsOnly({
                        asin: candidate.asin,
                        product_code: candidate.asin,
                        marketplaces: candidate.marketplace,
                        total_competitor_count: competitorAsins.length,
                        keywords: result.keywords
                    });
                    console.log(`候选产品 ${candidate.asin} 关键词获取完成: 新增 ${saveResult.inserted} 条，更新 ${saveResult.updated} 条`);
                } else {
                    console.log(`候选产品 ${candidate.asin} 未获取到关键词数据`);
                }
            } catch (err) {
                console.error(`候选产品 ${candidate.asin} 获取关键词时发生异常:`, err);
            }
            // 处理完该候选产品后，更新状态为 19
            // try {
            //     await this.candidateRepo.update(
            //         { id: candidate.id },
            //         { competitor_status: 19 }
            //     );
            //     console.log(`候选产品 ${candidate.asin} 关键词获取流程结束，状态已更新为 19`);
            // } catch (updateErr) {
            //     console.error(`候选产品 ${candidate.asin} 更新状态 19 失败:`, updateErr);
            // }
        }
    }

    // ========== 接口 1.1：分别按国家（英国、德国）去获取竞品并查词 ==========

    /**
     * 批量为选品获取关键词 (区分英国、德国分别查词)
     * @param ids 选品ID列表
     */
    async fetchKeywordsForCandidatesUKDE(ids: number[]) {
        // 1. 获取候选产品信息
        const candidates = await this.candidateRepo.find({
            where: { id: In(ids) }
        });

        if (!candidates || candidates.length === 0) {
            throw new Error('未找到对应的候选产品');
        }

        // 异步后台执行任务，避免阻塞前端请求
        this.executeFetchKeywordsForCandidatesUKDE(candidates).catch(err => {
            console.error('后台获取候选产品关键词失败:', err);
        });

        return { message: '关键词获取任务(区分英国德国)已提交' };
    }

    /**
     * 异步处理获取关键词的具体逻辑 (区分英国、德国分别查词)
     */
    private async executeFetchKeywordsForCandidatesUKDE(candidates: AppAmzBsrCandidateEntity[]) {
        const targetMarketplaces = ['英国', '德国'];

        for (const candidate of candidates) {
            for (const marketplace of targetMarketplaces) {
                try {
                    // 2. 查询该候选产品的竞品 (包含各类有效竞品，按销量降序)，区分国家
                    const competitors = await this.competitorRepo
                        .createQueryBuilder('comp')
                        .where('comp.candidate_id = :candidateId', { candidateId: candidate.id })
                        .andWhere('comp.marketplace = :marketplace', { marketplace })
                        .andWhere('comp.status IN (:...statusList)', { statusList: [1, 2, 6, 7] }) // 包含各类有效竞品
                        .orderBy('comp.Main_monthly_sales', 'DESC')
                        .addOrderBy('comp.bsr_rank', 'ASC')
                        .getMany();

                    if (!competitors || competitors.length === 0) {
                        console.log(`候选产品 ${candidate.asin} 没有找到 ${marketplace} 的竞品数据，跳过该国家`);
                        continue;
                    }

                    // 提取父体销量最大的竞品 (按 parent_asin 去重)
                    const uniqueCompetitors = [];
                    const seenParents = new Set<string>();
                    for (const comp of competitors) {
                        const parentKey = comp.parent_asin ? comp.parent_asin.trim() : comp.asin_competitor;
                        if (!seenParents.has(parentKey)) {
                            seenParents.add(parentKey);
                            uniqueCompetitors.push(comp);
                        }
                    }

                    const competitorAsins = uniqueCompetitors.map(c => c.asin_competitor).filter(Boolean);
                    if (competitorAsins.length === 0) continue;

                    console.log(`开始为候选产品 ${candidate.asin} 获取 ${marketplace} 关键词，去重后父体竞品数量: ${competitorAsins.length}`);

                    const accumulatedKeywordsMap = new Map<string, any>();

                    // 每次取 5 个竞品，直到获取到至少 50 个关键词为止
                    for (let i = 0; i < competitorAsins.length; i += 5) {
                        const chunk = competitorAsins.slice(i, i + 5);
                        console.log(`候选产品 ${candidate.asin} (${marketplace}) 正在获取竞品关键词，当前批次: ${chunk.join(', ')}`);

                        const result = await this.fetchByCompetitorAsins({
                            asin: candidate.asin,
                            product_code: candidate.asin,
                            marketplaces: marketplace, // 使用当前循环的国家
                            competitor_asins: chunk
                        });

                        if (result && result.keywords && result.keywords.length > 0) {
                            for (const kw of result.keywords) {
                                if (!accumulatedKeywordsMap.has(kw.keyword)) {
                                    accumulatedKeywordsMap.set(kw.keyword, kw);
                                } else {
                                    // 合并已有关键词数据 (累加流量得分, 合并来源 ASIN)
                                    const existingKw = accumulatedKeywordsMap.get(kw.keyword);
                                    existingKw.sif_score = (existingKw.sif_score || 0) + (kw.sif_score || 0);
                                    existingKw.source_asins = Array.from(new Set([...(existingKw.source_asins || []), ...(kw.source_asins || [])]));
                                    // 重点：计算累加过后的新加权分
                                    const coverageRatio = existingKw.source_asins.length / chunk.length;
                                    existingKw.weighted_score = parseFloat((existingKw.sif_score * coverageRatio).toFixed(2));
                                }
                            }
                        }

                        // 如果取的关键词已经达到或超过 50 个，就不再继续查下一批
                        if (accumulatedKeywordsMap.size >= 50) {
                            break;
                        }
                    }

                    const allKeywords = Array.from(accumulatedKeywordsMap.values());

                    // 按流量占比（SIF得分）降序排序
                    allKeywords.sort((a, b) => (b.weighted_score || b.sif_score || 0) - (a.weighted_score || a.sif_score || 0));

                    // 只取前 50 个关键词
                    const top50Keywords = allKeywords.slice(0, 50);

                    // 4. 将获取到的关键词自动入库
                    if (top50Keywords.length > 0) {
                        const saveResult = await this.batchSaveKeywordsOnly({
                            asin: candidate.asin,
                            product_code: candidate.asin,
                            marketplaces: marketplace,
                            total_competitor_count: 5,
                            keywords: top50Keywords
                        });
                        console.log(`候选产品 ${candidate.asin} (${marketplace}) 关键词获取完成: 最终入库 ${top50Keywords.length} 个，新增 ${saveResult.inserted} 条，更新 ${saveResult.updated} 条`);
                    } else {
                        console.log(`候选产品 ${candidate.asin} (${marketplace}) 未获取到关键词数据`);
                    }
                } catch (err) {
                    console.error(`候选产品 ${candidate.asin} (${marketplace}) 获取关键词时发生异常:`, err);
                }
            }
            // 处理完该候选产品的所有国家后，更新状态为 19
            try {
                await this.candidateRepo.update(
                    { id: candidate.id },
                    { competitor_status: 19 }
                );
                console.log(`候选产品 ${candidate.asin} 关键词获取流程结束，状态已更新为 19`);
            } catch (updateErr) {
                console.error(`候选产品 ${candidate.asin} 更新状态 19 失败:`, updateErr);
            }
        }
    }

    // ========== 接口 1：批量获取关键词 ==========

    /**
     * 通过竞品 ASIN 列表批量调 SIF 接口获取关键词
     * 返回去重后的关键词列表 + 数据库是否已存在标记
     */
    async fetchByCompetitorAsins(params: {
        asin?: string;
        product_code: string;
        marketplaces: string;
        competitor_asins: string[];
    }) {
        const { asin, product_code, marketplaces, competitor_asins } = params;

        // 参数校验
        if (!product_code) throw new Error('产品编码(product_code)为必填参数');
        if (!marketplaces) throw new Error('国家(marketplaces)为必填参数');
        if (!competitor_asins || competitor_asins.length === 0) {
            throw new Error('请至少选择一个竞品ASIN');
        }

        // 中文国家 → SIF代码
        const sifCountry = this.mapMarketplaceToSifCountry(marketplaces);

        // 汇总所有关键词: keyword文本 → 关键词数据
        const keywordMap = new Map<string, {
            keyword: string;
            sif_search_volume: number | null;
            sif_search_rank: number | null;
            sif_natural_rank: number | null;
            sif_sp_rank: number | null;
            sif_update_time_origin: string | null;
            sif_score: number;  // 累加后的总 score
            score_by_source: Record<string, number>;  // 每个竞品的单独 score
            search_volume_by_source: Record<string, number | null>;  // 每个竞品的单独搜索量
            sif_monthly_data: any[];
            source_asins: string[];
        }>();

        // 逐个竞品 ASIN 调 SIF 接口（串行 + 间隔，防频率限制）
        for (const competitorAsin of competitor_asins) {
            try {
                const result = await this.sifUtils.httpPost(
                    `/api/search/external/v2/asinKeywordsSimpleGroupByMonthly?country=${sifCountry}`,
                    { asin: competitorAsin, last30d: true }
                );

                if (result?.code === 1 && result?.data?.list) {
                    this.processKeywordList(result.data.list, competitorAsin, keywordMap);
                }
            } catch (err) {
                // 单个竞品查询失败不中断整体流程，记录日志继续
                console.error(`SIF查询竞品 ${competitorAsin} 关键词失败:`, err?.message || err);
            }

            // 间隔 200ms，避免触发 SIF 频率限制
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // 汇总结果
        const allKeywords = Array.from(keywordMap.values());
        const totalCompetitorCount = competitor_asins.length;

        if (allKeywords.length === 0) {
            return {
                keywords: [],
                summary: { total: 0, new_count: 0, existing_count: 0 },
                total_competitor_count: totalCompetitorCount,
            };
        }

        // 获取当前用户ID
        const currentUserId = this.ctx?.admin?.userId;

        // 计算加权得分：weighted_score = 累加总分 × (出现ASIN数 / 总ASIN数)
        for (const kw of allKeywords) {
            const coverageRatio = kw.source_asins.length / totalCompetitorCount;
            (kw as any).weighted_score = parseFloat((kw.sif_score * coverageRatio).toFixed(2));
        }

        // 查数据库标记哪些已存在 + 历史数据（按 product_code + marketplaces 关联，不再依赖 asin）
        const keywordTexts = allKeywords.map(k => k.keyword);
        const existingRecords = await this.keywordRepo.find({
            where: {
                marketplaces,
                product_code,
                value: In(keywordTexts),
                status: 3,
            },
            select: ['value', 'bound_user_ids', 'sif_score', 'sif_source_asins', 'sif_update_time', 'createTime', 'sif_total_competitor_count'],
        });

        // 收集所有 bound_user_ids 去查用户名
        const allUserIds = new Set<number>();
        for (const r of existingRecords) {
            if (Array.isArray(r.bound_user_ids)) {
                r.bound_user_ids.forEach(id => allUserIds.add(id));
            }
        }
        // 批量查用户名
        let userNameMap = new Map<number, string>();
        if (allUserIds.size > 0) {
            try {
                const users = await this.userRepo.find({
                    where: { id: In(Array.from(allUserIds)) },
                    select: ['id', 'name', 'nickName'],
                });
                for (const u of users) {
                    userNameMap.set(u.id, u.name || u.nickName || `用户${u.id}`);
                }
            } catch (err) {
                console.error('[SIF] 查询用户名失败:', err?.message || err);
            }
        }

        const existingMap = new Map<string, {
            bound_user_ids: number[] | null;
            history_score: number | null;
            history_source_count: number | null;
            history_update_time: Date | null;
            history_create_time: Date | null;
            history_bound_users: string[];
            history_total_competitor_count: number | null;
        }>();
        for (const r of existingRecords) {
            const boundUserNames = (r.bound_user_ids || []).map(id => userNameMap.get(id) || `用户${id}`);
            existingMap.set(r.value, {
                bound_user_ids: r.bound_user_ids,
                history_score: r.sif_score,
                history_source_count: Array.isArray(r.sif_source_asins) ? r.sif_source_asins.length : null,
                history_update_time: r.sif_update_time,
                history_create_time: (r as any).createTime || null,
                history_bound_users: boundUserNames,
                history_total_competitor_count: r.sif_total_competitor_count || null,
            });
        }

        // 组装返回数据
        const keywords = allKeywords.map(k => {
            const existing = existingMap.get(k.keyword);
            const exists_in_db = !!existing;
            const bound_by_me = exists_in_db && Array.isArray(existing.bound_user_ids)
                ? existing.bound_user_ids.includes(currentUserId)
                : false;
            return {
                ...k,
                weighted_score: (k as any).weighted_score,
                total_competitor_count: totalCompetitorCount,
                exists_in_db,
                bound_by_me,
                // 历史数据（仅已存在的关键词有值）
                history_score: existing?.history_score ?? null,
                history_source_count: existing?.history_source_count ?? null,
                history_update_time: existing?.history_update_time ?? null,
                history_create_time: existing?.history_create_time ?? null,
                history_bound_users: existing?.history_bound_users ?? [],
                history_total_competitor_count: existing?.history_total_competitor_count ?? null,
            };
        });

        const existing_count = keywords.filter(k => k.exists_in_db).length;

        return {
            keywords,
            summary: {
                total: keywords.length,
                new_count: keywords.length - existing_count,
                existing_count,
            },
            total_competitor_count: totalCompetitorCount,
        };
    }

    /**
     * 处理 SIF 接口返回的关键词列表
     * 按 keyword 文本去重并聚合月度数据
     */
    private processKeywordList(
        list: any[],
        sourceAsin: string,
        keywordMap: Map<string, any>
    ) {
        // SIF 返回的 list 里同一个 keyword 会有多条（每月一条）
        // 先按 keyword 分组
        const groupedByKeyword = new Map<string, any[]>();

        for (const item of list) {
            const kw = (item.keyword || '').trim();
            if (!kw) continue;

            if (!groupedByKeyword.has(kw)) {
                groupedByKeyword.set(kw, []);
            }
            groupedByKeyword.get(kw).push(item);
        }

        // 对每个关键词汇总数据
        for (const [keyword, items] of groupedByKeyword) {
            // 按 startDate 排序，最新的在前
            items.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

            const latest = items[0];

            // 构建月度数据数组
            const monthlyData = items.map(item => ({
                startDate: item.startDate || null,
                searchVolume: item.searchVolume ?? null,
                searchRank: item.searchRank ?? null,
                naturalRank: item.naturalPositionSeq?.[0]?.allPageRank ?? null,
                spRank: item.spPositionSeq?.[0]?.allPageRank ?? null,
                updateTime: item.updateTime || null,
                totalScore: item.totalScore ?? null,
            }));

            // 该竞品下这个关键词的 score（取最新一期）
            const latestScore = latest.totalScore ?? 0;

            if (keywordMap.has(keyword)) {
                // 这个关键词已经被其他竞品查出来过 → 追加来源 ASIN + 累加 score
                const existing = keywordMap.get(keyword);
                if (!existing.source_asins.includes(sourceAsin)) {
                    existing.source_asins.push(sourceAsin);
                }
                // 累加 score
                existing.sif_score += latestScore;
                // 记录该竞品的单独 score
                existing.score_by_source[sourceAsin] = latestScore;
                // 记录该竞品的搜索量（不累加，取最大值）
                const latestSearchVolume = latest.searchVolume ?? null;
                existing.search_volume_by_source[sourceAsin] = latestSearchVolume;
                if (latestSearchVolume != null) {
                    existing.sif_search_volume = Math.max(existing.sif_search_volume ?? 0, latestSearchVolume);
                }
            } else {
                // 新关键词
                keywordMap.set(keyword, {
                    keyword,
                    sif_search_volume: latest.searchVolume ?? null,
                    sif_search_rank: latest.searchRank ?? null,
                    sif_natural_rank: latest.naturalPositionSeq?.[0]?.allPageRank ?? null,
                    sif_sp_rank: latest.spPositionSeq?.[0]?.allPageRank ?? null,
                    sif_update_time_origin: latest.updateTime || null,
                    sif_score: latestScore,
                    score_by_source: { [sourceAsin]: latestScore },
                    search_volume_by_source: { [sourceAsin]: latest.searchVolume ?? null },
                    sif_monthly_data: monthlyData,
                    source_asins: [sourceAsin],
                });
            }
        }
    }

    // ========== 接口 2：批量入库 ==========

    /**
     * 将用户勾选的关键词批量入库（upsert 逻辑）
     * - 新词 → INSERT
     * - 已有词 → UPDATE sif_* 字段 + 追加 sif_source_asins
     */
    async batchSave(params: {
        asin?: string;
        product_code: string;
        marketplaces: string;
        total_competitor_count: number;
        keywords: Array<{
            keyword: string;
            value_cn?: string;
            sif_search_volume: number | null;
            sif_search_rank: number | null;
            sif_natural_rank: number | null;
            sif_sp_rank: number | null;
            sif_update_time_origin: string | null;
            sif_score: number;
            weighted_score: number;
            sif_monthly_data: any[];
            source_asins: string[];
        }>;
    }) {
        const { asin, product_code, marketplaces, total_competitor_count, keywords } = params;

        // 参数校验
        if (!product_code) throw new Error('产品编码(product_code)为必填参数');
        if (!marketplaces) throw new Error('国家(marketplaces)为必填参数');
        if (!keywords || keywords.length === 0) {
            throw new Error('请至少选择一个关键词入库');
        }

        // ===== 后台兜底翻译逻辑 =====
        const missingTranslationKeywords = keywords.filter(kw => !kw.value_cn).map(kw => kw.keyword);
        let backendTranslationMap: Record<string, string> = {};
        if (missingTranslationKeywords.length > 0) {
            try {
                backendTranslationMap = await this.translateKeywords({
                    keywords: missingTranslationKeywords,
                    marketplaces,
                    to: 'zh'
                });
            } catch (err) {
                console.error('[SIF] 后台兜底翻译失败:', err?.message || err);
            }
        }
        // ===========================

        // 查询已存在的关键词（按 product_code + marketplaces 关联，不再依赖 asin）
        const keywordTexts = keywords.map(k => k.keyword);
        const existingRecords = await this.keywordRepo.find({
            where: {
                marketplaces,
                product_code,
                value: In(keywordTexts),
            },
        });
        const existingMap = new Map<string, AppAmzListingKeywordEntity>();
        for (const record of existingRecords) {
            existingMap.set(record.value, record);
        }

        let inserted = 0;
        let updated = 0;
        const now = new Date();

        // 获取当前用户ID
        const currentUserId = this.ctx?.admin?.userId;

        for (const kw of keywords) {
            // 合并翻译（优先前端，兜底后端）
            const finalValueCn = kw.value_cn || backendTranslationMap[kw.keyword];

            const existing = existingMap.get(kw.keyword);

            if (existing) {
                // UPDATE：覆盖 sif_* 数据 + 追加来源 ASIN + 追加用户绑定
                const mergedSourceAsins = Array.from(new Set([
                    ...(existing.sif_source_asins || []),
                    ...(kw.source_asins || []),
                ]));

                // 追加用户ID（不重复）
                const existingUserIds = Array.isArray(existing.bound_user_ids) ? existing.bound_user_ids : [];
                const mergedUserIds = currentUserId && !existingUserIds.includes(currentUserId)
                    ? [...existingUserIds, currentUserId]
                    : existingUserIds;

                const updateData: any = {
                    sif_search_volume: kw.sif_search_volume,
                    sif_search_rank: kw.sif_search_rank,
                    sif_natural_rank: kw.sif_natural_rank,
                    sif_sp_rank: kw.sif_sp_rank,
                    sif_update_time_origin: kw.sif_update_time_origin ? new Date(kw.sif_update_time_origin) : null,
                    sif_score: kw.weighted_score ?? kw.sif_score,
                    sif_total_competitor_count: total_competitor_count || null,
                    sif_monthly_data: kw.sif_monthly_data,
                    sif_source_asins: mergedSourceAsins,
                    sif_update_time: now,
                    bound_user_ids: mergedUserIds,
                };

                // 如果本次提供了有效翻译，才更新 value_cn
                if (finalValueCn) {
                    updateData.value_cn = finalValueCn;
                }

                await this.keywordRepo.update(existing.id, updateData);
                updated++;
            } else {
                // INSERT：新建关键词记录
                const entity = new AppAmzListingKeywordEntity();
                entity.asin = asin || null; // asin 保留为记录字段，但不作为关联键
                entity.product_code = product_code;
                entity.marketplaces = marketplaces;
                entity.value = kw.keyword;
                entity.value_cn = finalValueCn; // 赋值翻译
                entity.status = 3; // 已入库
                entity.sif_search_volume = kw.sif_search_volume;
                entity.sif_search_rank = kw.sif_search_rank;
                entity.sif_natural_rank = kw.sif_natural_rank;
                entity.sif_sp_rank = kw.sif_sp_rank;
                entity.sif_update_time_origin = kw.sif_update_time_origin ? new Date(kw.sif_update_time_origin) : null;
                entity.sif_score = kw.weighted_score ?? kw.sif_score;
                entity.sif_total_competitor_count = total_competitor_count || null;
                entity.sif_monthly_data = kw.sif_monthly_data;
                entity.sif_source_asins = kw.source_asins || [];
                entity.sif_update_time = now;
                entity.bound_user_ids = currentUserId ? [currentUserId] : [];

                await this.keywordRepo.save(entity);
                inserted++;
            }
        }

        try {
            await this.initializeDefaultKeywordsIfMissing(currentUserId, product_code, marketplaces);
        } catch (err) {
            console.error('[SIF] 自动初始化默认关键词失败:', err?.message || err);
        }

        // 【核心后台异步外挂】：立刻后台触发 SIF 批量查词，不阻塞前台的 response，不被 await 阻塞
        if (keywordTexts.length > 0) {
            this.fetchSearchHistory({
                keywords: keywordTexts,
                marketplaces,
                product_code,
            }).catch(err => {
                console.error(`[SIF Async] 批量入库后后台静默拉取 SIF 失败: `, err?.message || err);
            });
        }

        return {
            inserted,
            updated,
            total: inserted + updated,
        };
    }

    /**
     * 批量入库关键词（仅关键词表，不涉及 app_user_keyword_config）
     * 用于 UKDE 等后台自动抓取场景
     */
    async batchSaveKeywordsOnly(params: {
        asin?: string;
        product_code: string;
        marketplaces: string;
        total_competitor_count: number;
        keywords: Array<{
            keyword: string;
            value_cn?: string;
            sif_search_volume: number | null;
            sif_search_rank: number | null;
            sif_natural_rank: number | null;
            sif_sp_rank: number | null;
            sif_update_time_origin: string | null;
            sif_score: number;
            weighted_score: number;
            sif_monthly_data: any[];
            source_asins: string[];
        }>;
    }) {
        const { asin, product_code, marketplaces, total_competitor_count, keywords } = params;

        if (!product_code) throw new Error('产品编码(product_code)为必填参数');
        if (!marketplaces) throw new Error('国家(marketplaces)为必填参数');
        if (!keywords || keywords.length === 0) {
            throw new Error('请至少选择一个关键词入库');
        }

        // 后台兜底翻译
        const missingTranslationKeywords = keywords.filter(kw => !kw.value_cn).map(kw => kw.keyword);
        let backendTranslationMap: Record<string, string> = {};
        if (missingTranslationKeywords.length > 0) {
            try {
                backendTranslationMap = await this.translateKeywords({
                    keywords: missingTranslationKeywords,
                    marketplaces,
                    to: 'zh'
                });
            } catch (err) {
                console.error('[SIF] 后台兜底翻译失败:', err?.message || err);
            }
        }

        const keywordTexts = keywords.map(k => k.keyword);
        const existingRecords = await this.keywordRepo.find({
            where: {
                marketplaces,
                product_code,
                value: In(keywordTexts),
            },
        });
        const existingMap = new Map<string, AppAmzListingKeywordEntity>();
        for (const record of existingRecords) {
            existingMap.set(record.value, record);
        }

        let inserted = 0;
        let updated = 0;
        const now = new Date();
        const currentUserId = this.ctx?.admin?.userId;

        for (const kw of keywords) {
            const finalValueCn = kw.value_cn || backendTranslationMap[kw.keyword];
            const existing = existingMap.get(kw.keyword);

            if (existing) {
                const mergedSourceAsins = Array.from(new Set([
                    ...(existing.sif_source_asins || []),
                    ...(kw.source_asins || []),
                ]));

                const existingUserIds = Array.isArray(existing.bound_user_ids) ? existing.bound_user_ids : [];
                const mergedUserIds = currentUserId && !existingUserIds.includes(currentUserId)
                    ? [...existingUserIds, currentUserId]
                    : existingUserIds;

                const updateData: any = {
                    sif_search_volume: kw.sif_search_volume,
                    sif_search_rank: kw.sif_search_rank,
                    sif_natural_rank: kw.sif_natural_rank,
                    sif_sp_rank: kw.sif_sp_rank,
                    sif_update_time_origin: kw.sif_update_time_origin ? new Date(kw.sif_update_time_origin) : null,
                    sif_score: kw.weighted_score ?? kw.sif_score,
                    sif_total_competitor_count: total_competitor_count || null,
                    sif_monthly_data: kw.sif_monthly_data,
                    sif_source_asins: mergedSourceAsins,
                    sif_update_time: now,
                    bound_user_ids: mergedUserIds,
                };

                if (finalValueCn) {
                    updateData.value_cn = finalValueCn;
                }

                await this.keywordRepo.update(existing.id, updateData);
                updated++;
            } else {
                const entity = new AppAmzListingKeywordEntity();
                entity.asin = asin || null;
                entity.product_code = product_code;
                entity.marketplaces = marketplaces;
                entity.value = kw.keyword;
                entity.value_cn = finalValueCn;
                entity.status = 3;
                entity.sif_search_volume = kw.sif_search_volume;
                entity.sif_search_rank = kw.sif_search_rank;
                entity.sif_natural_rank = kw.sif_natural_rank;
                entity.sif_sp_rank = kw.sif_sp_rank;
                entity.sif_update_time_origin = kw.sif_update_time_origin ? new Date(kw.sif_update_time_origin) : null;
                entity.sif_score = kw.weighted_score ?? kw.sif_score;
                entity.sif_total_competitor_count = total_competitor_count || null;
                entity.sif_monthly_data = kw.sif_monthly_data;
                entity.sif_source_asins = kw.source_asins || [];
                entity.sif_update_time = now;
                entity.bound_user_ids = currentUserId ? [currentUserId] : [];

                await this.keywordRepo.save(entity);
                inserted++;
            }
        }

        // 后台异步拉取搜索历史
        if (keywordTexts.length > 0) {
            this.fetchSearchHistory({
                keywords: keywordTexts,
                marketplaces,
                product_code,
            }).catch(err => {
                console.error(`[SIF Async] 批量入库后后台静默拉取 SIF 失败: `, err?.message || err);
            });
        }

        return {
            inserted,
            updated,
            total: inserted + updated,
        };
    }

    // ========== 关键词管理列表（分页查询） ==========

    /**
     * 按 product_code + marketplaces 分页查询关键词
     * 供前端 listing-keyword-lingxing.vue 关键词管理面板使用
     * 注意：不再依赖 asin 做关联，同一 product_code + marketplaces 下所有ASIN共享关键词
     */
    async keywordPage(params: {
        asin?: string;
        product_code?: string;
        marketplaces?: string;
        store_id?: number | string | null;
        msku?: string | null;
        page?: number;
        size?: number;
        sort?: string;       // 排序字段
        order?: string;      // 'ASC' | 'DESC'
        keyWord?: string;    // 关键词文本搜索
        status?: number;     // 按状态筛选
        filter_type?: string; // 筛选类型: 'all' | 'mine' | 'others' | 'default' | 'tracked'
    }) {
        const {
            asin,
            product_code,
            marketplaces,
            store_id,
            msku,
            page = 1,
            size = 50,
            sort,
            order,
            keyWord,
            status,
            filter_type = 'all',
        } = params;

        if (!product_code) throw new Error('product_code 为必填参数');
        if (!marketplaces) throw new Error('marketplaces 为必填参数');

        const userId = this.ctx?.admin?.userId;

        const qb = this.keywordRepo.createQueryBuilder('a')
            .where('1 = 1');

        // 可选的精确过滤条件
        if (product_code) {
            qb.andWhere('a.product_code = :product_code', { product_code });
        }
        if (marketplaces) {
            qb.andWhere('a.marketplaces = :marketplaces', { marketplaces });
        }
        if (status !== undefined && status !== null) {
            qb.andWhere('a.status = :status', { status });
        }

        // 关键词文本模糊搜索
        if (keyWord) {
            qb.andWhere('(a.value LIKE :kw OR a.asin LIKE :kw)', { kw: `%${keyWord}%` });
        }

        // 排序 (CoolAdmin 约定: order=字段名, sort=方向)
        if (order && sort) {
            const safeDir = sort.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
            // NULL 值始终排最后
            qb.orderBy(`a.${order} IS NULL`, 'ASC');
            qb.addOrderBy(`a.${order}`, safeDir as 'ASC' | 'DESC');
        } else {
            // 默认按总体流量得分降序，NULL排最后
            qb.orderBy('a.sif_score IS NULL', 'ASC');
            qb.addOrderBy('a.sif_score', 'DESC');
        }

        // 4. 处理 filter_type (mine / others / default / tracked)
        let defaultKeywordIds: number[] = [];

        // 预查当前用户的默认关键词配置，很多地方要用（不再依赖 asin）
        if (userId && product_code && marketplaces) {
            const config = await this.userKeywordConfigRepo.findOne({
                where: { user_id: userId, product_code, marketplaces },
            });
            if (config?.default_keyword_ids?.length > 0) {
                const defaultKeywords = await this.getEffectiveDefaultKeywords(config, product_code, marketplaces);
                defaultKeywordIds = defaultKeywords.map(item => item.id);
            }
        }

        if (filter_type === 'mine') {
            // 我的入库：bound_user_ids 包含 userId
            qb.andWhere(`JSON_CONTAINS(a.bound_user_ids, :userIdStr)`, { userIdStr: String(userId) });
        } else if (filter_type === 'others') {
            // 他人入库：bound_user_ids 不包含 userId，但也必须是已入库的状态(或按现有条件)
            qb.andWhere(`(a.bound_user_ids IS NULL OR NOT JSON_CONTAINS(a.bound_user_ids, :userIdStr))`, { userIdStr: String(userId) });
        } else if (filter_type === 'default') {
            // ⭐ 我的默认设置：必须存在于 default_keyword_ids 中
            if (defaultKeywordIds.length > 0) {
                qb.andWhere('a.id IN (:...defaultIds)', { defaultIds: defaultKeywordIds });
            } else {
                // 如果用户没有设过默认，那么这个筛选下应该返回空（这里做成精确匹配：没手动设就是空）
                qb.andWhere('1 = 0');
            }
        } else if (filter_type === 'tracked') {
            // 我跟踪的：只看当前用户在当前产品明细下开启跟踪的关键词。
            if (userId && product_code && marketplaces && asin) {
                const storeIdNumber = store_id === undefined || store_id === null || store_id === ''
                    ? null
                    : Number(store_id);
                qb.andWhere(`
                    EXISTS (
                        SELECT 1
                        FROM app_amz_bsr_keyword_tracking t
                        WHERE t.status = 1
                          AND t.user_id = :trackedUserId
                          AND t.store_id <=> :trackedStoreId
                          AND t.marketplace = a.marketplaces
                          AND t.product_code = a.product_code
                          AND t.asin_self = :trackedAsin
                          AND t.msku <=> :trackedMsku
                          AND (
                            t.keyword_id = a.id
                            OR LOWER(TRIM(t.keyword_value)) = LOWER(TRIM(a.value))
                          )
                    )
                `, {
                    trackedUserId: userId,
                    trackedStoreId: Number.isFinite(storeIdNumber) ? storeIdNumber : null,
                    trackedAsin: asin,
                    trackedMsku: msku === undefined || msku === null ? null : String(msku),
                });
            } else {
                qb.andWhere('1 = 0');
            }
        }

        // 分页
        const total = await qb.getCount();
        let list = [];

        // 如果是 'default' 筛选，直接不用分页拿这几个（本来也就最多 3 个），并保持筛选后的默认关键词顺序
        if (filter_type === 'default' && defaultKeywordIds.length > 0) {
            list = await qb.getMany();
            // 按照 default_keyword_ids 的顺序重排
            const idOrder = new Map(defaultKeywordIds.map((id, idx) => [id, idx]));
            list.sort((a, b) => (idOrder.get(a.id) ?? 99) - (idOrder.get(b.id) ?? 99));
        } else {
            list = await qb
                .skip((page - 1) * size)
                .take(size)
                .getMany();
        }

        // 5. 数据包装：给每一条记录动态打上 is_mine 和 is_default 标记
        const resultList = list.map(item => {
            const boundIds = item.bound_user_ids || [];
            return {
                ...item,
                is_mine: boundIds.includes(userId),
                is_default: defaultKeywordIds.includes(item.id),
            };
        });

        return {
            list: resultList,
            pagination: {
                page,
                size,
                total,
            },
            defaultCount: defaultKeywordIds.length,
        };
    }

    // ========== 接口 3：批量获取搜索趋势历史 ==========

    /**
     * 调用 SIF estSearchesHistory 接口获取关键词的搜索量 + ABA排名 历史数据
     * 按 月 维度查询，合并两个 Map 后存入 sif_search_history
     * 回写时按 value + marketplaces 匹配（跨 product_code 更新）
     *
     * @param params.keywords - 要查询的关键词列表（前端勾选的）
     * @param params.marketplaces - 国家（中文，如"英国"）
     * @param params.product_code - 产品编码（仅作为上下文记录，不参与查询逻辑）
     */
    async fetchSearchHistory(params: {
        keywords: string[];
        marketplaces: string;
        product_code?: string;
    }) {
        const { keywords, marketplaces, product_code } = params;

        // 参数校验
        if (!keywords || keywords.length === 0) {
            throw new Error('请至少选择一个关键词');
        }
        if (!marketplaces) {
            throw new Error('国家(marketplaces)为必填参数');
        }
        if (keywords.length > 1000) {
            throw new Error('单次最多查询1000个关键词');
        }

        // 中文国家 → SIF 代码
        const sifCountry = this.mapMarketplaceToSifCountry(marketplaces);

        console.log(`[SIF] 查询搜索趋势: ${keywords.length} 个关键词, 国家=${marketplaces}(${sifCountry}), product_code=${product_code || '-'}`);

        // ===== Step 1: 调用 SIF 月维度接口 =====
        const result = await this.sifUtils.httpPost(
            `/api/search/external/v2/estSearchesHistory?country=${sifCountry}`,
            {
                keywords,
                granularity: 'month',
            }
        );

        if (result?.code !== 1 || !result?.data?.list) {
            throw new Error(`SIF 搜索趋势接口返回异常: ${result?.message || JSON.stringify(result)}`);
        }

        const sifList: Array<{
            keyword: string;
            estSearchesNumHistoryMap: Record<string, number>;
            searchesRankHistoryMap: Record<string, number>;
        }> = result.data.list;

        // 当前月份 YYYY-MM（用于判断是否需要周数据补充）
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // ===== Step 2: 逐关键词处理月数据 → 构建 historyMap（按关键词暂存） =====
        const keywordHistoryMap = new Map<string, {
            history: Array<{ date: string; searches: number | null; searchRank: number | null; isWeekly?: boolean }>;
            latestSearches: number | null;
            hasCurrentMonth: boolean;
        }>();

        let successCount = 0;
        let failCount = 0;
        const results: Array<{ keyword: string; status: string; historyCount?: number; latestSearches?: number; weeklySupplemented?: boolean }> = [];

        for (const item of sifList) {
            try {
                const { keyword, estSearchesNumHistoryMap, searchesRankHistoryMap } = item;
                if (!keyword) continue;

                // 合并两个 Map
                const searchMap = estSearchesNumHistoryMap || {};
                const rankMap = searchesRankHistoryMap || {};
                const allDates = new Set([...Object.keys(searchMap), ...Object.keys(rankMap)]);

                // 按日期排序，组装成统一格式
                const history = Array.from(allDates)
                    .sort()
                    .map(date => ({
                        date,
                        searches: searchMap[date] ?? null,
                        searchRank: rankMap[date] ?? null,
                    }));

                // 检查当前月是否已有数据
                const hasCurrentMonth = history.some(h => h.date === currentMonth);

                // 取最新一期的搜索量
                let latestSearches: number | null = null;
                for (let i = history.length - 1; i >= 0; i--) {
                    if (history[i].searches != null) {
                        latestSearches = history[i].searches;
                        break;
                    }
                }

                keywordHistoryMap.set(keyword, { history, latestSearches, hasCurrentMonth });
            } catch (err) {
                failCount++;
                results.push({
                    keyword: item.keyword,
                    status: `月数据处理失败: ${err?.message || err}`,
                });
                console.error(`[SIF] 处理关键词 "${item.keyword}" 月数据失败:`, err?.message || err);
            }
        }

        // ===== Step 3: 检查是否有关键词需要周数据补充 =====
        const keywordsNeedingWeekly = Array.from(keywordHistoryMap.entries())
            .filter(([_, data]) => !data.hasCurrentMonth)
            .map(([keyword]) => keyword);

        if (keywordsNeedingWeekly.length > 0) {
            console.log(`[SIF] ${keywordsNeedingWeekly.length}/${keywordHistoryMap.size} 个关键词缺少当前月(${currentMonth})数据，尝试用周数据补充...`);

            try {
                // 调用 SIF 周维度接口（只查缺失当月的关键词）
                const weekResult = await this.sifUtils.httpPost(
                    `/api/search/external/v2/estSearchesHistory?country=${sifCountry}`,
                    {
                        keywords: keywordsNeedingWeekly,
                        granularity: 'week',
                    }
                );

                if (weekResult?.code === 1 && weekResult?.data?.list) {
                    const weekList: Array<{
                        keyword: string;
                        estSearchesNumHistoryMap: Record<string, number>;
                        searchesRankHistoryMap: Record<string, number>;
                    }> = weekResult.data.list;

                    for (const weekItem of weekList) {
                        const { keyword, estSearchesNumHistoryMap, searchesRankHistoryMap } = weekItem;
                        if (!keyword) continue;

                        const existing = keywordHistoryMap.get(keyword);
                        if (!existing) continue;

                        // 从周数据里找属于当前月份的周条目
                        const weekSearchMap = estSearchesNumHistoryMap || {};
                        const weekRankMap = searchesRankHistoryMap || {};

                        // 筛选当前月的周日期（日期以 currentMonth 开头，如 "2026-03-08"）
                        const currentMonthWeekDates = Object.keys(weekSearchMap)
                            .filter(date => date.startsWith(currentMonth))
                            .sort();

                        if (currentMonthWeekDates.length > 0) {
                            // 取最新一周
                            const latestWeekDate = currentMonthWeekDates[currentMonthWeekDates.length - 1];
                            const weeklySearches = weekSearchMap[latestWeekDate] ?? null;
                            const weeklyRank = weekRankMap[latestWeekDate] ?? null;

                            // 追加到 history 末尾，用月份格式作为 date
                            existing.history.push({
                                date: currentMonth,
                                searches: weeklySearches,
                                searchRank: weeklyRank,
                                isWeekly: true,
                            });

                            // 更新最新搜索量
                            if (weeklySearches != null) {
                                existing.latestSearches = weeklySearches;
                            }

                            console.log(`[SIF-周补充] "${keyword}" 用周数据(${latestWeekDate})补充${currentMonth}: searches=${weeklySearches}, rank=${weeklyRank}`);
                        }
                    }
                } else {
                    console.warn(`[SIF] 周维度接口返回异常，跳过补充: ${weekResult?.message || '未知错误'}`);
                }
            } catch (weekErr) {
                // 周数据补充失败不影响月数据保存
                console.error(`[SIF] 周数据补充失败（不影响月数据）:`, weekErr?.message || weekErr);
            }
        }

        // ===== Step 4: 统一回写数据库 =====
        for (const [keyword, data] of keywordHistoryMap.entries()) {
            try {
                const updateResult = await this.keywordRepo
                    .createQueryBuilder()
                    .update()
                    .set({
                        sif_search_history: data.history as any,
                        sif_search_volume_monthly: data.latestSearches,
                        sif_search_history_update_time: new Date(),
                    })
                    .where('value = :keyword AND marketplaces = :marketplaces', {
                        keyword,
                        marketplaces,
                    })
                    .execute();

                const affected = updateResult.affected || 0;
                const wasSupplemented = data.history.some((h: any) => h.isWeekly === true);
                successCount++;
                results.push({
                    keyword,
                    status: `已更新 ${affected} 条记录${wasSupplemented ? '（含周数据补充）' : ''}`,
                    historyCount: data.history.length,
                    latestSearches: data.latestSearches,
                    weeklySupplemented: wasSupplemented,
                });
            } catch (err) {
                failCount++;
                results.push({
                    keyword,
                    status: `写入数据库失败: ${err?.message || err}`,
                });
                console.error(`[SIF] 写入关键词 "${keyword}" 搜索趋势失败:`, err?.message || err);
            }
        }

        console.log(`[SIF] 搜索趋势更新完成: 成功=${successCount}, 失败=${failCount}, 周补充=${keywordsNeedingWeekly.length}个`);

        return {
            summary: {
                total: sifList.length,
                success: successCount,
                fail: failCount,
                weeklySupplemented: keywordsNeedingWeekly.length,
            },
            results,
        };
    }

    // ========== 接口 4：用户默认关键词配置 ==========

    /**
     * 获取用户的默认关键词列表
     * 1. 如果用户已手动配置 → 按流量得分返回最多3个
     * 2. 如果用户未配置 → 自动按流量得分取前3条（兜底）
     *
     * @returns { keywords: 关键词记录数组, isCustom: 是否为用户手动配置 }
     */
    async getUserDefaultKeywords(params: {
        asin?: string;
        product_code: string;
        marketplaces: string;
    }) {
        const { product_code, marketplaces } = params;
        const userId = this.ctx?.admin?.userId;

        if (!product_code) throw new Error('product_code 为必填参数');
        if (!marketplaces) throw new Error('marketplaces 为必填参数');
        if (!userId) throw new Error('无法获取当前用户ID');

        // 1. 查用户是否有手动配置（不再依赖 asin）
        const config = await this.userKeywordConfigRepo.findOne({
            where: { user_id: userId, product_code, marketplaces },
        });

        if (config?.default_keyword_ids?.length > 0) {
            const keywords = await this.getEffectiveDefaultKeywords(config, product_code, marketplaces);

            return {
                keywords,
                isCustom: true,
                config_id: config.id,
            };
        }

        // 2. 无配置 → 兜底：按流量得分取前3条已入库关键词（不再依赖 asin）
        const fallbackKeywords = await this.getTopDefaultKeywordCandidates(product_code, marketplaces);

        return {
            keywords: fallbackKeywords,
            isCustom: false,
            config_id: null,
        };
    }

    /**
     * 设置用户的默认关键词（最多3个）
     * - 存在则更新，不存在则新建（upsert 逻辑）
     *
     * @param params.keyword_ids - 关键词ID数组，最多3个，传空数组则清除配置
     */
    async setUserDefaultKeywords(params: {
        asin?: string;
        product_code: string;
        marketplaces: string;
        keyword_ids: number[];
    }) {
        const { product_code, marketplaces, keyword_ids } = params;
        const userId = this.ctx?.admin?.userId;

        if (!product_code) throw new Error('product_code 为必填参数');
        if (!marketplaces) throw new Error('marketplaces 为必填参数');
        if (!userId) throw new Error('无法获取当前用户ID');
        if (!Array.isArray(keyword_ids)) throw new Error('keyword_ids 必须是数组');

        const uniqueIds = this.ensureDefaultKeywordLimit(keyword_ids);

        // 校验关键词是否都存在且属于该产品（不再依赖 asin）
        if (uniqueIds.length > 0) {
            const existCount = await this.keywordRepo
                .createQueryBuilder('a')
                .where('a.id IN (:...ids)', { ids: uniqueIds })
                .andWhere('a.product_code = :product_code', { product_code })
                .andWhere('a.marketplaces = :marketplaces', { marketplaces })
                .getCount();

            if (existCount !== uniqueIds.length) {
                throw new Error(`部分关键词ID不存在或不属于该产品（期望 ${uniqueIds.length} 个，找到 ${existCount} 个）`);
            }
        }

        // 查是否已有配置（不再依赖 asin）
        let config = await this.userKeywordConfigRepo.findOne({
            where: { user_id: userId, product_code, marketplaces },
        });

        if (config) {
            // 更新
            config.default_keyword_ids = uniqueIds;
            await this.userKeywordConfigRepo.save(config);
        } else {
            // 新建（asin 不再作为关联键，不存入配置表）
            config = this.userKeywordConfigRepo.create({
                user_id: userId,
                product_code,
                marketplaces,
                default_keyword_ids: uniqueIds,
            });
            await this.userKeywordConfigRepo.save(config);
        }

        return {
            config_id: config.id,
            keyword_count: uniqueIds.length,
        };
    }

    // ========== 删除关键词（物理删除 + 级联清理所有用户默认配置） ==========

    /**
     * 删除关键词（事务）
     * 1. 关闭当前用户在当前 Listing 下的关键词跟踪
     * 2. 级联清理所有用户的 default_keyword_ids，移除被删除的 ID
     * 3. 物理删除关键词记录
     *
     * @param ids 要删除的关键词 ID 数组
     */
    async deleteKeywords(ids: number[], options?: DeleteKeywordsOptions) {
        if (!ids || ids.length === 0) {
            throw new Error('请至少选择一个关键词');
        }

        // 先查出这些关键词的信息（用于定位关联的配置）
        const keywords = await this.keywordRepo.find({
            where: { id: In(ids) },
            select: ['id', 'asin', 'product_code', 'marketplaces'],
        });

        if (keywords.length === 0) {
            throw new Error('未找到指定的关键词记录');
        }

        // 收集涉及的 product_code + marketplace 组合（默认配置不再依赖 asin）
        const configScopeMap = new Map<string, { product_code: string; marketplaces: string }>();
        for (const kw of keywords) {
            if (kw.product_code && kw.marketplaces) {
                configScopeMap.set(`${kw.product_code}\u0001${kw.marketplaces}`, {
                    product_code: kw.product_code,
                    marketplaces: kw.marketplaces,
                });
            }
        }

        const deletedIds = keywords.map(kw => kw.id);
        let configsCleaned = 0;
        let configsDeleted = 0;
        let trackingStopped = 0;

        // 使用事务：保证清理配置 + 删除关键词是原子操作
        await this.keywordRepo.manager.transaction(async (manager) => {
            // Step 1: 先关闭当前用户当前 Listing 的跟踪（必须在删除关键词之前）
            trackingStopped = await this.stopCurrentUserTrackingForDeletedKeywords(
                manager,
                deletedIds,
                options
            );

            // Step 2: 先级联清理所有用户的默认关键词配置（必须在删除关键词之前）
            for (const { product_code, marketplaces } of configScopeMap.values()) {

                // 查出该产品下所有用户的配置
                const configs = await manager.find(AppUserKeywordConfigEntity, {
                    where: { product_code, marketplaces },
                });

                for (const config of configs) {
                    if (!config.default_keyword_ids || config.default_keyword_ids.length === 0) {
                        continue;
                    }

                    // 过滤掉被删除的 ID
                    const cleaned = config.default_keyword_ids.filter(
                        (kid: number) => !deletedIds.includes(kid)
                    );

                    if (cleaned.length === 0) {
                        // 全被清空了，直接删除配置记录
                        await manager.remove(config);
                        configsDeleted++;
                    } else if (cleaned.length < config.default_keyword_ids.length) {
                        // 部分移除，更新
                        config.default_keyword_ids = cleaned;
                        await manager.save(config);
                        configsCleaned++;
                    }
                }
            }

            // Step 3: 物理删除关键词记录
            await manager.delete(AppAmzListingKeywordEntity, deletedIds);
        });

        return {
            deleted_count: deletedIds.length,
            configs_cleaned: configsCleaned,
            configs_deleted: configsDeleted,
            tracking_stopped_count: trackingStopped,
        };
    }

    // ========== 定时任务：全量更新搜索趋势 ==========

    /**
     * 辅助方法：延时等待
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 定时更新搜索趋势的关键词来源：
     * 1. 以所有在售产品 product_code + marketplace 为基础；
     * 2. 有用户默认配置的产品：默认词优先，不足 3 个按 sif_score 补齐；
     * 3. 无用户默认配置的产品：直接按 sif_score 选前 3 个；
     * 4. 只处理纯数字 product_code，避免混入候选品 ASIN 口径数据；
     * 5. 请求 SIF 前按 marketplaces + value 去重，避免同国家同关键词重复计费。
     */
    private async getScheduledSearchHistoryKeywords(): Promise<Array<{ value: string; marketplaces: string }>> {
        return this.keywordRepo.query(`
WITH sale_products AS (
  SELECT
    l.product_code,
    l.marketplace AS marketplaces
  FROM app_amz_bsr_product_listing_lingxing l
  WHERE l.status = 1
    AND l.product_code IS NOT NULL
    AND l.product_code != ''
    AND l.product_code REGEXP '^[0-9]+$'
    AND l.marketplace IS NOT NULL
    AND l.marketplace != ''
  GROUP BY l.product_code, l.marketplace
),
configs AS (
  SELECT
    c.id AS config_id,
    c.user_id,
    c.product_code,
    c.marketplaces,
    c.default_keyword_ids
  FROM app_user_keyword_config c
  WHERE c.product_code IS NOT NULL
    AND c.product_code != ''
    AND c.product_code REGEXP '^[0-9]+$'
    AND c.marketplaces IS NOT NULL
    AND c.marketplaces != ''
),
eligible_keywords AS (
  SELECT
    k.id,
    k.value,
    k.product_code,
    k.marketplaces,
    k.sif_score,
    k.sif_search_volume_monthly
  FROM app_amz_listing_keyword k
  WHERE k.status = 3
    AND k.value IS NOT NULL
    AND k.value != ''
    AND k.product_code IS NOT NULL
    AND k.product_code != ''
    AND k.product_code REGEXP '^[0-9]+$'
    AND k.marketplaces IS NOT NULL
    AND k.marketplaces != ''
),
user_products AS (
  SELECT
    c.config_id,
    c.user_id,
    c.product_code,
    c.marketplaces,
    c.default_keyword_ids
  FROM configs c
  JOIN sale_products sp
    ON sp.product_code = c.product_code
   AND sp.marketplaces = c.marketplaces
),
manual_ranked AS (
  SELECT
    up.config_id,
    up.user_id,
    k.id,
    k.value,
    k.product_code,
    k.marketplaces,
    k.sif_score,
    k.sif_search_volume_monthly,
    ROW_NUMBER() OVER (
      PARTITION BY up.user_id, up.product_code, up.marketplaces
      ORDER BY
        k.sif_score IS NULL ASC,
        k.sif_score DESC,
        k.sif_search_volume_monthly DESC,
        k.id ASC
    ) AS rn
  FROM user_products up
  JOIN JSON_TABLE(
    CASE
      WHEN JSON_VALID(up.default_keyword_ids) THEN up.default_keyword_ids
      ELSE '[]'
    END,
    '$[*]' COLUMNS(keyword_id BIGINT PATH '$')
  ) jt ON 1 = 1
  JOIN eligible_keywords k
    ON k.id = jt.keyword_id
   AND k.product_code = up.product_code
   AND k.marketplaces = up.marketplaces
),
manual_defaults AS (
  SELECT
    config_id,
    user_id,
    id,
    value,
    product_code,
    marketplaces,
    sif_score,
    sif_search_volume_monthly
  FROM manual_ranked
  WHERE rn <= ${this.DEFAULT_KEYWORD_LIMIT}
),
manual_count AS (
  SELECT
    user_id,
    product_code,
    marketplaces,
    COUNT(DISTINCT id) AS manual_count
  FROM manual_defaults
  GROUP BY user_id, product_code, marketplaces
),
fill_ranked AS (
  SELECT
    up.config_id,
    up.user_id,
    k.id,
    k.value,
    k.product_code,
    k.marketplaces,
    k.sif_score,
    k.sif_search_volume_monthly,
    COALESCE(mc.manual_count, 0) AS manual_count,
    ROW_NUMBER() OVER (
      PARTITION BY up.user_id, up.product_code, up.marketplaces
      ORDER BY
        k.sif_score IS NULL ASC,
        k.sif_score DESC,
        k.sif_search_volume_monthly DESC,
        k.id ASC
    ) AS rn
  FROM user_products up
  JOIN eligible_keywords k
    ON k.product_code = up.product_code
   AND k.marketplaces = up.marketplaces
  LEFT JOIN manual_defaults md
    ON md.user_id = up.user_id
   AND md.product_code = up.product_code
   AND md.marketplaces = up.marketplaces
   AND md.id = k.id
  LEFT JOIN manual_count mc
    ON mc.user_id = up.user_id
   AND mc.product_code = up.product_code
   AND mc.marketplaces = up.marketplaces
  WHERE md.id IS NULL
),
configured_selected AS (
  SELECT
    config_id,
    user_id,
    id,
    value,
    product_code,
    marketplaces,
    sif_score,
    sif_search_volume_monthly
  FROM manual_defaults
  UNION ALL
  SELECT
    config_id,
    user_id,
    id,
    value,
    product_code,
    marketplaces,
    sif_score,
    sif_search_volume_monthly
  FROM fill_ranked
  WHERE rn <= GREATEST(${this.DEFAULT_KEYWORD_LIMIT} - manual_count, 0)
),
no_config_products AS (
  SELECT
    sp.product_code,
    sp.marketplaces
  FROM sale_products sp
  LEFT JOIN configs c
    ON c.product_code = sp.product_code
   AND c.marketplaces = sp.marketplaces
  WHERE c.config_id IS NULL
),
no_config_ranked AS (
  SELECT
    k.id,
    k.value,
    k.product_code,
    k.marketplaces,
    k.sif_score,
    k.sif_search_volume_monthly,
    ROW_NUMBER() OVER (
      PARTITION BY sp.product_code, sp.marketplaces
      ORDER BY
        k.sif_score IS NULL ASC,
        k.sif_score DESC,
        k.sif_search_volume_monthly DESC,
        k.id ASC
    ) AS rn
  FROM no_config_products sp
  JOIN eligible_keywords k
    ON k.product_code = sp.product_code
   AND k.marketplaces = sp.marketplaces
),
fallback_selected AS (
  SELECT
    NULL AS config_id,
    NULL AS user_id,
    id,
    value,
    product_code,
    marketplaces,
    sif_score,
    sif_search_volume_monthly
  FROM no_config_ranked
  WHERE rn <= ${this.DEFAULT_KEYWORD_LIMIT}
),
selected_keywords AS (
  SELECT
    id,
    value,
    product_code,
    marketplaces,
    sif_score,
    sif_search_volume_monthly
  FROM configured_selected
  UNION ALL
  SELECT
    id,
    value,
    product_code,
    marketplaces,
    sif_score,
    sif_search_volume_monthly
  FROM fallback_selected
)
SELECT
  marketplaces,
  value
FROM selected_keywords
GROUP BY marketplaces, value
ORDER BY marketplaces, value
        `);
    }

    // ========== 接口：关键词前三页ASIN ==========

    /**
     * 调用 SIF getAsinPageListByKeyword 接口
     * 获取指定关键词在亚马逊搜索结果前三页的 ASIN 列表（自然排名、广告位等）
     *
     * @param params.keyword - 关键词文本（必填）
     * @param params.marketplaces - 国家（中文，如"美国"）（必填）
     * @param params.date - 日期 yyyy-MM-dd，为空则取最近一天数据（可选）
     * @returns SIF 原始返回的 data 对象
     */
    async fetchAsinPageListByKeyword(params: {
        keyword: string;
        marketplaces: string;
        date?: string;
    }) {
        const { keyword, marketplaces, date } = params;

        if (!keyword) throw new Error('关键词(keyword)为必填参数');
        if (!marketplaces) throw new Error('国家(marketplaces)为必填参数');

        // 中文国家 → SIF 代码
        const sifCountry = this.mapMarketplaceToSifCountry(marketplaces);

        // 构建请求体
        const body: any = { keyword };
        if (date) {
            body.date = date;
        }

        console.log(`[SIF] 查询关键词前三页ASIN: keyword="${keyword}", country=${sifCountry}, date=${date || '最近一天'}`);
        // const result = null
        const result = await this.sifUtils.httpPost(
            `/api/search/external/v2/getAsinPageListByKeyword?country=${sifCountry}`,
            body
        );

        if (result?.code !== 1) {
            throw new Error(`SIF getAsinPageListByKeyword 返回异常: ${result?.message || JSON.stringify(result)}`);
        }

        // 打印原始返回数据结构（前500字符），方便定位解析问题
        const dataStr = JSON.stringify(result.data);
        console.log(`[SIF-ASIN前三页] keyword="${keyword}" 返回数据长度=${dataStr.length}, 前500字符: ${dataStr.substring(0, 500)}`);

        return result.data;
    }

    /**
     * 定时任务入口：更新用户默认关键词相关的搜索趋势数据
     *
     * 流程：
     * 1. 查出有用户配置、产品在售、默认不足 3 个已按流量得分补齐的关键词，按 marketplaces + value 去重
     * 2. 每组按 batchSize 拆批，串行调用 fetchSearchHistory
     * 3. 失败自动重试 maxRetry 次，重试间隔 retryDelayMs
     * 4. 每批之间延时 delayMs，避免 SIF 限流
     *
     * fetchSearchHistory 内部已包含"周数据补充"逻辑，无需额外处理
     *
     * 在后台定时任务面板中配置调用即可，建议凌晨执行
     */
    async scheduledUpdateAllSearchHistory(options?: {
        batchSize?: number;       // 每批关键词数，默认 200
        delayMs?: number;         // 批次间延时(ms)，默认 3000
        maxRetry?: number;        // 失败重试次数，默认 1
        retryDelayMs?: number;    // 重试间隔(ms)，默认 5000
    }) {
        const batchSize = options?.batchSize ?? 200;
        const delayMs = options?.delayMs ?? 3000;
        const maxRetry = options?.maxRetry ?? 1;
        const retryDelayMs = options?.retryDelayMs ?? 5000;

        const startTime = Date.now();
        console.log(`[SIF-定时任务] 开始更新默认关键词搜索趋势，batchSize=${batchSize}, delayMs=${delayMs}, maxRetry=${maxRetry}`);

        // 1. 查出所有需要更新的关键词（用户默认 + 流量得分补齐 + 在售产品过滤 + 国家关键词去重）
        const allKeywords = await this.getScheduledSearchHistoryKeywords();

        if (allKeywords.length === 0) {
            console.log('[SIF-定时任务] 没有找到需要更新的默认关键词，跳过');
            return {
                totalKeywords: 0,
                totalBatches: 0,
                byMarketplace: {},
                duration: '0s',
            };
        }

        // 2. 按 marketplaces 分组
        const grouped = new Map<string, Set<string>>();
        for (const row of allKeywords) {
            if (!grouped.has(row.marketplaces)) {
                grouped.set(row.marketplaces, new Set());
            }
            grouped.get(row.marketplaces)!.add(row.value);
        }

        console.log(`[SIF-定时任务] 共 ${allKeywords.length} 个默认关键词相关词（按国家+关键词去重后），分布在 ${grouped.size} 个国家`);
        for (const [mp, kwSet] of grouped.entries()) {
            console.log(`  - ${mp}: ${kwSet.size} 个关键词`);
        }

        // 3. 逐国家 → 逐批次 串行调用
        let totalBatches = 0;
        const byMarketplace: Record<string, {
            keywords: number;
            batches: number;
            success: number;
            fail: number;
            weeklySupplemented: number;
        }> = {};

        for (const [marketplace, kwSet] of grouped.entries()) {
            const uniqueKeywords = Array.from(kwSet);
            const batchCount = Math.ceil(uniqueKeywords.length / batchSize);

            console.log(`\n[SIF-定时任务] 开始处理: ${marketplace}（${uniqueKeywords.length}个关键词，${batchCount}批）`);

            const mpStats = {
                keywords: uniqueKeywords.length,
                batches: batchCount,
                success: 0,
                fail: 0,
                weeklySupplemented: 0,
            };

            for (let i = 0; i < uniqueKeywords.length; i += batchSize) {
                const batchIndex = Math.floor(i / batchSize) + 1;
                const batch = uniqueKeywords.slice(i, i + batchSize);

                console.log(`[SIF-定时任务] ${marketplace} 第${batchIndex}/${batchCount}批（${batch.length}个关键词）...`);

                let success = false;
                let lastError: any = null;

                // 尝试执行（含重试）
                for (let attempt = 0; attempt <= maxRetry; attempt++) {
                    try {
                        if (attempt > 0) {
                            console.log(`[SIF-定时任务] 第${attempt}次重试...`);
                            await this.sleep(retryDelayMs);
                        }

                        const result = await this.fetchSearchHistory({
                            keywords: batch,
                            marketplaces: marketplace,
                        });

                        mpStats.success++;
                        mpStats.weeklySupplemented += result.summary.weeklySupplemented || 0;
                        success = true;

                        console.log(`[SIF-定时任务] ${marketplace} 第${batchIndex}/${batchCount}批完成: 成功=${result.summary.success}, 失败=${result.summary.fail}, 周补充=${result.summary.weeklySupplemented}`);
                        break;

                    } catch (err) {
                        lastError = err;
                        console.error(`[SIF-定时任务] ${marketplace} 第${batchIndex}/${batchCount}批失败（attempt=${attempt}）:`, err?.message || err);
                    }
                }

                if (!success) {
                    mpStats.fail++;
                    console.error(`[SIF-定时任务] ${marketplace} 第${batchIndex}/${batchCount}批最终失败（已重试${maxRetry}次）: ${lastError?.message || lastError}`);
                }

                totalBatches++;

                // 批次间延时（最后一批不需要延时）
                const isLastBatchOverall = (
                    marketplace === Array.from(grouped.keys()).pop() &&
                    i + batchSize >= uniqueKeywords.length
                );
                if (!isLastBatchOverall) {
                    await this.sleep(delayMs);
                }
            }

            byMarketplace[marketplace] = mpStats;
        }

        const durationMs = Date.now() - startTime;
        const durationStr = durationMs < 60000
            ? `${(durationMs / 1000).toFixed(1)}s`
            : `${Math.floor(durationMs / 60000)}m${Math.round((durationMs % 60000) / 1000)}s`;

        console.log(`\\n[SIF-定时任务] ====== 默认关键词搜索趋势更新完成 ======`);
        console.log(`总关键词: ${allKeywords.length}（去重后）`);
        console.log(`总批次: ${totalBatches}`);
        console.log(`总耗时: ${durationStr}`);

        // ========== SIF 计费统计 ==========
        let totalMonthlyCredits = 0;
        let totalWeeklyCredits = 0;
        let totalSuccessBatches = 0;
        let totalFailBatches = 0;

        for (const [, stats] of Object.entries(byMarketplace)) {
            totalMonthlyCredits += stats.keywords;
            totalWeeklyCredits += stats.weeklySupplemented;
            totalSuccessBatches += stats.success;
            totalFailBatches += stats.fail;
        }

        const totalSifCredits = totalMonthlyCredits + totalWeeklyCredits;

        console.log(`\n${'='.repeat(70)}`);
        console.log(`[SIF-定时任务] ★ 搜索趋势更新总结 ★`);
        console.log(`${'='.repeat(70)}`);
        console.log(`  关键词总数(国家+关键词去重): ${allKeywords.length} 个`);
        console.log(`  涉及站点:         ${grouped.size} 个`);
        console.log(`  总批次:           ${totalBatches} 批 (成功${totalSuccessBatches}/失败${totalFailBatches})`);
        console.log(`  总耗时:           ${durationStr}`);
        console.log(`  ─── 各站点明细 ───`);
        for (const [mp, stats] of Object.entries(byMarketplace)) {
            console.log(`  ${mp}: ${stats.keywords}个关键词, ${stats.success}/${stats.batches}批成功, 周补充${stats.weeklySupplemented}个`);
        }
        console.log(`  ─── SIF 计费统计（1个关键词 = 1次计费） ───`);
        console.log(`  月接口(estSearchesHistory/month): ${totalMonthlyCredits} 次`);
        console.log(`  周接口(estSearchesHistory/week):  ${totalWeeklyCredits} 次`);
        console.log(`  本次 SIF 总计费:                  ${totalSifCredits} 次`);
        console.log(`  涉及数据库表:                     app_amz_listing_keyword`);
        console.log(`  更新字段:                         sif_search_history, sif_search_volume_monthly`);
        console.log(`${'='.repeat(70)}\n`);

        return {
            totalKeywords: allKeywords.length,
            totalBatches,
            byMarketplace,
            sifBilling: {
                monthlyCredits: totalMonthlyCredits,
                weeklyCredits: totalWeeklyCredits,
                totalCredits: totalSifCredits,
            },
            duration: durationStr,
        };
    }

    // ========== 接口：百度翻译 ==========

    /**
     * 记录百度翻译API调用日志
     */
    private async recordBaiduTranslateApiLog(
        apiPath: string,
        httpMethod: string,
        keywordCount: number,
        keywordsSample: string,
        fromLang: string,
        toLang: string,
        textLength: number,
        callStartTime: number,
        responseCode: number | null,
        isSuccess: number,
        errorMessage: string | null,
        callLocation: string
    ) {
        try {
            const durationMs = Date.now() - callStartTime;
            const log = this.baiduTranslateApiLogRepo.create({
                call_date: dayjs().format('YYYY-MM-DD'),
                api_path: apiPath,
                http_method: httpMethod,
                keyword_count: keywordCount,
                keywords_sample: keywordsSample,
                from_lang: fromLang,
                to_lang: toLang,
                text_length: textLength,
                credit_count: Math.ceil(textLength / 1000), // 百度翻译按千字符计费
                response_code: responseCode,
                duration_ms: durationMs,
                is_success: isSuccess,
                error_message: errorMessage,
                caller: 'SifKeywordService',
                call_location: callLocation
            });
            await this.baiduTranslateApiLogRepo.save(log);
        } catch (logErr) {
            console.warn(`[百度翻译] API日志记录失败: ${logErr?.message || logErr}`);
        }
    }

    /**
     * 批量翻译关键词（调百度通用翻译API）
     * - 将多个关键词用 \n 拼接，一次请求翻译一页
     * - appid 和 key 从 base_sys_param 表读取
     * @param params.keywords - 要翻译的关键词数组
     * @param params.from - 源语言（默认 'en'）
     * @param params.to - 目标语言（默认 'zh'）
     * @returns Record<string, string> - { keyword: translation } 的映射
     */
    async translateKeywords(params: {
        keywords: string[];
        from?: string;
        to?: string;
        marketplaces?: string;
    }): Promise<Record<string, string>> {
        const { keywords, to = 'zh', marketplaces } = params;
        const from = this.resolveBaiduTranslateFromLanguage(marketplaces, params.from);

        if (!keywords || keywords.length === 0) {
            return {};
        }

        // 1. 从 base_sys_param 表读取百度翻译配置
        const [paramAppId, paramKey] = await Promise.all([
            this.baseSysParamRepo.findOne({ where: { keyName: 'baiduTranslateAppId' } }),
            this.baseSysParamRepo.findOne({ where: { keyName: 'baiduTranslateKey' } }),
        ]);

        const appid = paramAppId?.data?.trim();
        const appkey = paramKey?.data?.trim();

        if (!appid || !appkey) {
            throw new Error('百度翻译API未配置，请在 base_sys_param 表中添加 baiduTranslateAppId 和 baiduTranslateKey');
        }

        // 2. 用 \n 拼接所有关键词（百度API支持换行分隔多段翻译）
        const q = keywords.join('\n');

        // 检查长度限制（6000字符）
        if (q.length > 6000) {
            console.warn(`[百度翻译] 文本长度 ${q.length} 超过6000字符限制，将分批翻译`);
            // 分批处理
            return this.translateKeywordsBatch(keywords, appid, appkey, from, to);
        }

        // 3. 生成签名
        const salt = String(Date.now());
        const signStr = appid + q + salt + appkey;
        const sign = crypto.createHash('md5').update(signStr, 'utf8').digest('hex');

        // 4. 调用百度翻译API
        const callStartTime = Date.now();
        let responseCode: number | null = null;
        let isSuccess = 1;
        let errorMessage: string | null = null;
        const keywordsSample = keywords.slice(0, 5).join(', ');

        try {
            const response = await axios.post(
                'https://fanyi-api.baidu.com/api/trans/vip/translate',
                new URLSearchParams({
                    q,
                    from,
                    to,
                    appid,
                    salt,
                    sign,
                }).toString(),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 15000,
                }
            );

            responseCode = response.status;
            const data = response.data;

            if (data.error_code) {
                isSuccess = 0;
                errorMessage = `code=${data.error_code}, msg=${data.error_msg}`;
                console.error(`[百度翻译] 错误: ${errorMessage}`);
                throw new Error(`百度翻译失败: ${data.error_msg} (${data.error_code})`);
            }

            // 5. 构建 keyword → translation 映射
            const result: Record<string, string> = {};
            const transResult = data.trans_result || [];

            for (const item of transResult) {
                if (item.src && item.dst) {
                    result[item.src] = item.dst;
                }
            }

            console.log(`[百度翻译] 成功翻译 ${Object.keys(result).length}/${keywords.length} 个关键词`);

            // 记录API调用日志
            this.recordBaiduTranslateApiLog(
                '/api/trans/vip/translate',
                'POST',
                keywords.length,
                keywordsSample,
                from,
                to,
                q.length,
                callStartTime,
                responseCode,
                isSuccess,
                errorMessage,
                '批量翻译关键词'
            ).catch(err => console.warn('记录百度翻译日志失败:', err));

            return result;
        } catch (error: any) {
            if (error.response) {
                responseCode = error.response.status;
                console.error(`[百度翻译] HTTP错误: ${error.response.status}`, error.response.data);
            }
            isSuccess = 0;
            errorMessage = error?.message || String(error);

            // 记录API调用日志
            this.recordBaiduTranslateApiLog(
                '/api/trans/vip/translate',
                'POST',
                keywords.length,
                keywordsSample,
                from,
                to,
                q.length,
                callStartTime,
                responseCode,
                isSuccess,
                errorMessage,
                '批量翻译关键词'
            ).catch(err => console.warn('记录百度翻译日志失败:', err));

            throw error;
        }
    }

    /**
     * 分批翻译（当总文本超过6000字符时）
     */
    private async translateKeywordsBatch(
        keywords: string[],
        appid: string,
        appkey: string,
        from: string,
        to: string
    ): Promise<Record<string, string>> {
        const result: Record<string, string> = {};
        let batch: string[] = [];
        let batchLen = 0;

        for (const kw of keywords) {
            // +1 for \n separator
            if (batchLen + kw.length + 1 > 5500 && batch.length > 0) {
                // 翻译当前批次
                const batchResult = await this.translateSingleBatch(batch, appid, appkey, from, to);
                Object.assign(result, batchResult);
                batch = [];
                batchLen = 0;
                // 间隔1.1秒（QPS=1）
                await new Promise(resolve => setTimeout(resolve, 1100));
            }
            batch.push(kw);
            batchLen += kw.length + 1;
        }

        // 翻译最后一批
        if (batch.length > 0) {
            const batchResult = await this.translateSingleBatch(batch, appid, appkey, from, to);
            Object.assign(result, batchResult);
        }

        return result;
    }

    /**
     * 单批次翻译
     */
    private async translateSingleBatch(
        keywords: string[],
        appid: string,
        appkey: string,
        from: string,
        to: string
    ): Promise<Record<string, string>> {
        const q = keywords.join('\n');
        const salt = String(Date.now());
        const signStr = appid + q + salt + appkey;
        const sign = crypto.createHash('md5').update(signStr, 'utf8').digest('hex');

        const response = await axios.post(
            'https://fanyi-api.baidu.com/api/trans/vip/translate',
            new URLSearchParams({ q, from, to, appid, salt, sign }).toString(),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000,
            }
        );

        const data = response.data;
        if (data.error_code) {
            console.error(`[百度翻译-批次] 错误: code=${data.error_code}, msg=${data.error_msg}`);
            return {};
        }

        const result: Record<string, string> = {};
        for (const item of (data.trans_result || [])) {
            if (item.src && item.dst) {
                result[item.src] = item.dst;
            }
        }
        return result;
    }

    /**
     * 针对部分关键词，批量调用百度翻译并写入数据库 value_cn 字段
     * @param ids 关键词对应的系统ID数组
     */
    async translateAndSaveByIds(ids: number[], from?: string) {
        if (!ids || ids.length === 0) return { success: 0, fail: 0 };
        // 查询数据库
        const records = await this.keywordRepo.find({
            where: { id: In(ids) },
            select: ['id', 'value', 'value_cn', 'marketplaces']
        });
        if (records.length === 0) return { success: 0, fail: 0 };

        const translatedById = new Map<number, string>();
        try {
            if (from) {
                const keywordsToTranslate = Array.from(new Set(records.map(r => r.value).filter(Boolean)));
                const result = await this.translateKeywords({
                    keywords: keywordsToTranslate,
                    from,
                    to: 'zh'
                });

                for (const record of records) {
                    const translated = result[record.value];
                    if (translated) {
                        translatedById.set(record.id, translated);
                    }
                }
            } else {
                const grouped = new Map<string, typeof records>();
                for (const record of records) {
                    const marketplace = record.marketplaces || '';
                    if (!grouped.has(marketplace)) {
                        grouped.set(marketplace, []);
                    }
                    grouped.get(marketplace)!.push(record);
                }

                for (const [marketplaces, groupRecords] of grouped.entries()) {
                    const keywordsToTranslate = Array.from(new Set(groupRecords.map(r => r.value).filter(Boolean)));
                    const groupResult = await this.translateKeywords({
                        keywords: keywordsToTranslate,
                        marketplaces: marketplaces || undefined,
                        to: 'zh'
                    });

                    for (const record of groupRecords) {
                        const translated = groupResult[record.value];
                        if (translated) {
                            translatedById.set(record.id, translated);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[SIF] translateAndSaveByIds 翻译失败', err);
            const msg = err?.message || String(err);
            if (msg.includes('recharge') || msg.includes('54004')) {
                throw new Error('百度翻译余额不足，请充值后重试');
            }
            throw new Error('翻译失败: ' + msg);
        }

        let updatedCount = 0;
        // 把结果回写到对应ID
        for (const record of records) {
            const translated = translatedById.get(record.id);
            if (translated && translated !== record.value_cn) {
                await this.keywordRepo.update(record.id, { value_cn: translated });
                updatedCount++;
            }
        }

        return { success: updatedCount, total: records.length };
    }

    async updateTranslation(id: number, value_cn: string) {
        if (!id) {
            throw new Error('关键词ID为必填参数');
        }
        if (typeof value_cn !== 'string') {
            throw new Error('中文翻译(value_cn)必须是字符串');
        }

        const result = await this.keywordRepo.update(id, { value_cn: value_cn.trim() });
        if (result?.affected === 0) {
            throw new Error('关键词不存在或已被删除');
        }

        return { success: true };
    }
	
	 // ========== 定时任务：自动为无关键词选品补齐关键词 ==========

    /**
     * 定时任务入口：自动为所有满足条件的选品补齐关键词
     * - product_code 不为空
     * - 有英国/德国竞品（status=2或6，Main_monthly_sales>0）
     * - 没有对应国家的关键词
     *
     * 每个选品按父体销量从大到小依次用竞品ASIN调SIF获取关键词，
     * 每个国家最多保留30个关键词，最多查5个竞品
     */
    async autoBatchFetchKeywordsForNoKeywordListings() {
        const competitorStatuses = [2, 6];
        const targetMarketplaces = ['英国', 'UK', '德国', 'DE'];

        const listings = await this.listingRepo
            .createQueryBuilder('a')
            .where('a.product_code IS NOT NULL AND a.product_code != :empty', { empty: '' })
            .andWhere(`EXISTS (
                SELECT 1 FROM app_amz_bsr_candidate_competitor c
                WHERE c.asin_candidate = a.asin
                AND c.status IN (:...competitorStatuses)
                AND c.Main_monthly_sales > 0
                AND c.marketplace IN (:...targetMarketplaces)
            )`, { competitorStatuses, targetMarketplaces })
            .getMany();

        // 按 product_code 去重（同一个 product_code 可能有多条 listing）
        const seen = new Set<string>();
        const uniqueListings: typeof listings = [];
        for (const l of listings) {
            if (!seen.has(l.product_code)) {
                seen.add(l.product_code);
                uniqueListings.push(l);
            }
        }

        console.log(`[SIF AutoBatch] 找到 ${uniqueListings.length} 个需要补齐关键词的选品`);

        let successCount = 0;
        let skipCount = 0;
        let failCount = 0;

        for (const listing of uniqueListings) {
            try {
                const result = await this.fillKeywordsForListing(listing);
                const filled = [result.uk, result.de].filter(Boolean).length;
                if (filled > 0) {
                    successCount++;
                    console.log(`[SIF AutoBatch] ${listing.product_code} 完成，补齐了 ${filled} 个国家的关键词`);
                } else {
                    skipCount++;
                }
            } catch (err) {
                console.error(`[SIF AutoBatch] ${listing.product_code} 处理失败:`, err?.message || err);
                failCount++;
            }
            // 选品之间间隔，避免频率限制
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(`[SIF AutoBatch] 完成：成功 ${successCount}，跳过 ${skipCount}，失败 ${failCount}`);
        return { successCount, skipCount, failCount, total: uniqueListings.length };
    }

    // ========== 竞品关键词自然广告得分 ==========

    /**
     * 竞品关键词自然广告得分
     * 流程：
     * 1. 按国家分组，每组取父体销量前5的竞品（按 parent_asin 去重）
     * 2. 取该选品对应国家流量得分(sif_score)前30的关键词
     * 3. 用这30个关键词逐个调用 getAsinPageListByKeyword 获取前三页的 nfAsin(自然)/spAsin(广告)
     * 4. nfAsin 命中该国 top5 ASIN → 自然+1，spAsin 命中 → 广告+1
     * 5. 写入 keyword_organic_score / keyword_ad_score
     */
    async scoreCompetitorKeywordOrganicAd(candidate_id: number) {
        // 0. 获取选品的 ASIN（用于查关键词表，关键词按 ASIN+国家 关联）
        const candidate = await this.candidateRepo.findOne({
            where: { id: candidate_id },
            select: ['asin'],
        });
        const candidateAsin = candidate?.asin;
        if (!candidateAsin) {
            return { success: false, message: '选品缺少ASIN，无法关联关键词' };
        }

        // 1. 获取该选品下所有有销量的竞品
        const allCompetitors = await this.competitorRepo
            .createQueryBuilder('c')
            .where('c.candidate_id = :candidate_id', { candidate_id })
            .andWhere('c.status IN (:...statuses)', { statuses: [1, 2, 6, 7] })
            .andWhere('c.Main_monthly_sales > 0')
            .orderBy('c.Main_monthly_sales', 'DESC')
            .getMany();

        if (allCompetitors.length === 0) {
            return { success: false, message: '该选品没有有销量的竞品' };
        }

        // 2. 按国家分组
        const byCountry = new Map<string, typeof allCompetitors>();
        for (const comp of allCompetitors) {
            const mp = comp.marketplace;
            if (!mp) continue;
            if (!byCountry.has(mp)) byCountry.set(mp, []);
            byCountry.get(mp)!.push(comp);
        }

        console.log(`[竞品得分] 选品ID=${candidate_id}, asin=${candidateAsin}, 国家: ${Array.from(byCountry.keys()).join(', ')}`);

        const scoreMap = new Map<string, { organic: number; ad: number }>();
        const allScoreResults: any[] = [];

        // 3. 逐国家处理
        for (const [marketplace, competitors] of byCountry.entries()) {
            // 按 parent_asin 去重，取前5
            const seenParents = new Set<string>();
            const uniqueList: typeof competitors = [];
            for (const comp of competitors) {
                const parentKey = (comp.parent_asin?.trim() || comp.asin_competitor);
                if (!seenParents.has(parentKey)) {
                    seenParents.add(parentKey);
                    uniqueList.push(comp);
                }
            }

            const top5 = uniqueList.slice(0, 5);
            const top5Asins = top5.map(c => c.asin_competitor).filter(Boolean);

            if (top5Asins.length === 0) {
                console.log(`[竞品得分] ${marketplace}: 无有效竞品，跳过`);
                continue;
            }

            for (const asin of top5Asins) {
                if (!scoreMap.has(asin)) {
                    scoreMap.set(asin, { organic: 0, ad: 0 });
                }
            }

            console.log(`[竞品得分] === ${marketplace} Top5: ${top5Asins.join(', ')} ===`);

            // 4. 取该国流量得分前30的关键词
            const topKeywords = await this.keywordRepo
                .createQueryBuilder('k')
                .where('k.asin = :asin', { asin: candidateAsin })
                .andWhere('k.marketplaces = :marketplaces', { marketplaces: marketplace })
                .andWhere('k.status = 3')
                .orderBy('k.sif_score', 'DESC')
                .limit(30)
                .getMany();

            if (topKeywords.length === 0) {
                console.log(`[竞品得分] ${marketplace}: 无关键词数据，跳过`);
                continue;
            }

            console.log(`[竞品得分] ${marketplace} 取到 ${topKeywords.length} 个关键词`);

            // 5. 用关键词逐个调 SIF 获取前三页ASIN
            for (const kw of topKeywords) {
                try {
                    const pageData = await this.fetchAsinPageListByKeyword({
                        keyword: kw.value,
                        marketplaces: marketplace,
                    });

                    if (!pageData) continue;

                    const pages: any[] = pageData?.pages || pageData?.pageList || [];
                    if (pages.length === 0) continue;

                    let hitCount = 0;
                    for (const page of pages) {
                        const pageNum = page.pageNum || page.page || 0;
                        if (pageNum < 1 || pageNum > 3) continue;

                        const nfAsins: string[] = page.nfAsin || [];
                        const spAsins: string[] = page.spAsin || [];

                        for (const asin of nfAsins) {
                            const upper = asin.toUpperCase();
                            if (scoreMap.has(upper)) {
                                scoreMap.get(upper)!.organic += 1;
                                hitCount++;
                            }
                        }
                        for (const asin of spAsins) {
                            const upper = asin.toUpperCase();
                            if (scoreMap.has(upper)) {
                                scoreMap.get(upper)!.ad += 1;
                                hitCount++;
                            }
                        }
                    }

                    if (hitCount > 0) {
                        console.log(`[竞品得分] ${marketplace} 关键词"${kw.value}" 命中 ${hitCount} 次`);
                    }

                } catch (err) {
                    console.error(`[竞品得分] 关键词"${kw.value}" 失败:`, err?.message || err);
                }

                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // 6. 收集结果并写入DB
            for (const comp of top5) {
                const score = scoreMap.get(comp.asin_competitor) || { organic: 0, ad: 0 };
                await this.competitorRepo.update(
                    { id: comp.id },
                    { keyword_organic_score: score.organic, keyword_ad_score: score.ad }
                );
                allScoreResults.push({
                    id: comp.id,
                    asin: comp.asin_competitor,
                    marketplace,
                    item_name: comp.item_name,
                    Main_monthly_sales: comp.Main_monthly_sales,
                    keyword_organic_score: score.organic,
                    keyword_ad_score: score.ad,
                });
            }
        }

        console.log(`[竞品得分] ===== 结果 =====`);
        for (const r of allScoreResults) {
            console.log(`[竞品得分] ${r.marketplace} ${r.asin} 自然=${r.keyword_organic_score} 广告=${r.keyword_ad_score}`);
        }

        return {
            success: true,
            message: `完成：共 ${allScoreResults.length} 个竞品`,
            data: { competitors: allScoreResults },
        };
    }

    /**
     * 为单个选品补齐英国和/或德国的关键词
     */
    private async fillKeywordsForListing(listing: AppAmzBsrProductListingLingxingEntity) {
        const productCode = listing.product_code;

        // 获取该 product_code 下所有 listing 的 ASIN
        const relatedListings = await this.listingRepo.find({
            where: { product_code: productCode },
            select: ['asin'],
        });
        const allAsins = [...new Set(relatedListings.map(l => l.asin).filter(Boolean))];

        if (allAsins.length === 0) return { uk: false, de: false };

        const results = { uk: false, de: false };
        results.uk = await this.fetchAndSaveKeywordsForCountry(allAsins, listing, '英国');
        results.de = await this.fetchAndSaveKeywordsForCountry(allAsins, listing, '德国');
        return results;
    }

    /**
     * 为指定国家获取并保存关键词
     * @param allAsins 该选品所有关联的 ASIN
     * @param listing 选品数据
     * @param marketplace 国家（'英国' 或 '德国'）
     * @returns 是否成功保存了关键词
     */
    private async fetchAndSaveKeywordsForCountry(
        allAsins: string[],
        listing: AppAmzBsrProductListingLingxingEntity,
        marketplace: string,
    ): Promise<boolean> {
        const productCode = listing.product_code;
        const marketplaceNames = marketplace === '英国' ? ['英国', 'UK'] : ['德国', 'DE'];

        // 1. 检查是否已有该国关键词
        const keywordCount = await this.keywordRepo.count({
            where: { product_code: productCode, marketplaces: marketplace, status: 3 },
        });
        if (keywordCount > 0) {
            console.log(`[SIF AutoBatch] ${productCode} ${marketplace}: 已有 ${keywordCount} 个关键词，跳过`);
            return false;
        }

        // 2. 查询竞品（按父体销量降序，只取销量 > 0）
        const competitors = await this.competitorRepo
            .createQueryBuilder('c')
            .where('c.asin_candidate IN (:...asins)', { asins: allAsins })
            .andWhere('c.status IN (:...statuses)', { statuses: [2, 6] })
            .andWhere('c.Main_monthly_sales > 0')
            .andWhere('c.marketplace IN (:...mps)', { mps: marketplaceNames })
            .orderBy('c.Main_monthly_sales', 'DESC')
            .getMany();

        if (competitors.length === 0) {
            console.log(`[SIF AutoBatch] ${productCode} ${marketplace}: 无竞品，跳过`);
            return false;
        }

        // 3. 按 parent_asin 去重（无 parent_asin 的用 asin_competitor 自身）
        const uniqueCompetitors: typeof competitors = [];
        const seenParents = new Set<string>();
        for (const comp of competitors) {
            const parentKey = (comp.parent_asin?.trim() || comp.asin_competitor);
            if (!seenParents.has(parentKey)) {
                seenParents.add(parentKey);
                uniqueCompetitors.push(comp);
            }
        }

        console.log(`[SIF AutoBatch] ${productCode} ${marketplace}: 去重后 ${uniqueCompetitors.length} 个父体竞品`);

        // 4. 逐个竞品获取关键词，累加直到满30个或查完5个
        const accumulated = new Map<string, any>();
        const maxCompetitors = Math.min(5, uniqueCompetitors.length);
        let actualQueried = 0;

        for (let i = 0; i < maxCompetitors; i++) {
            const comp = uniqueCompetitors[i];

            try {
                const result = await this.fetchByCompetitorAsins({
                    asin: listing.asin,
                    product_code: productCode,
                    marketplaces: marketplace,
                    competitor_asins: [comp.asin_competitor],
                });

                actualQueried = i + 1;

                if (result?.keywords?.length) {
                    for (const kw of result.keywords) {
                        if (accumulated.has(kw.keyword)) {
                            const existing = accumulated.get(kw.keyword);
                            existing.sif_score = (existing.sif_score || 0) + (kw.sif_score || 0);
                            existing.source_asins = Array.from(new Set([
                                ...(existing.source_asins || []),
                                ...(kw.source_asins || []),
                            ]));
                            existing.score_by_source = { ...(existing.score_by_source || {}), ...(kw.score_by_source || {}) };
                            existing.search_volume_by_source = { ...(existing.search_volume_by_source || {}), ...(kw.search_volume_by_source || {}) };
                            if (kw.sif_search_volume != null) {
                                existing.sif_search_volume = Math.max(existing.sif_search_volume ?? 0, kw.sif_search_volume);
                            }
                            // 重算加权分
                            const coverageRatio = existing.source_asins.length / actualQueried;
                            existing.weighted_score = parseFloat((existing.sif_score * coverageRatio).toFixed(2));
                        } else {
                            // 用当前实际查询数重新计算 weighted_score
                            const coverageRatio = 1 / actualQueried;
                            accumulated.set(kw.keyword, {
                                ...kw,
                                weighted_score: parseFloat((kw.sif_score * coverageRatio).toFixed(2)),
                            });
                        }
                    }
                }

                console.log(`[SIF AutoBatch] ${productCode} ${marketplace}: 第${i + 1}个竞品 ${comp.asin_competitor} (父体销量${comp.Main_monthly_sales}) → 累计 ${accumulated.size} 个关键词`);
            } catch (err) {
                console.error(`[SIF AutoBatch] ${productCode} ${marketplace}: 竞品 ${comp.asin_competitor} SIF查询失败:`, err?.message || err);
            }

            if (accumulated.size >= 30) break;

            // 竞品之间间隔200ms
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // 5. 排序，取前30个
        const allKeywords = Array.from(accumulated.values());
        allKeywords.sort((a, b) => (b.weighted_score || b.sif_score || 0) - (a.weighted_score || a.sif_score || 0));
        const top30 = allKeywords.slice(0, 30);

        if (top30.length === 0) {
            console.log(`[SIF AutoBatch] ${productCode} ${marketplace}: 未获取到关键词`);
            return false;
        }

        // 6. 入库
        const saveResult = await this.batchSave({
            asin: listing.asin,
            product_code: productCode,
            marketplaces: marketplace,
            total_competitor_count: actualQueried,
            keywords: top30,
        });

        console.log(`[SIF AutoBatch] ${productCode} ${marketplace}: 入库 ${saveResult.total} 个（新增${saveResult.inserted} 更新${saveResult.updated}）`);
        return true;
    }
}
