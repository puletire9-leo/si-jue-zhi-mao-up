import { CoolController, BaseController } from '@cool-midway/core';
import { Inject, Post, Body } from '@midwayjs/decorator';
import { SifKeywordService } from '../../service/sifKeyword';

/**
 * SIF 关键词接口
 * - fetchByCompetitorAsins：通过竞品ASIN批量获取关键词
 * - batchSave：批量入库用户选中的关键词
 */
@CoolController()
export class AdminSifKeywordController extends BaseController {
    @Inject()
    sifKeywordService: SifKeywordService;

    /**
     * 通过竞品ASIN批量获取关键词
     * 调SIF接口 + 数据库查重标记
     */
    @Post('/fetchByCompetitorAsins')
    async fetchByCompetitorAsins(
        @Body() body: {
            asin: string;
            product_code: string;
            marketplaces: string;
            competitor_asins: string[];
        }
    ) {
        try {
            const { asin, product_code, marketplaces, competitor_asins } = body;

            // 参数校验
            if (!asin) return this.fail('主ASIN为必填参数');
            if (!product_code) return this.fail('产品编码(product_code)为必填参数');
            if (!marketplaces) return this.fail('国家(marketplaces)为必填参数');
            if (!competitor_asins || !Array.isArray(competitor_asins) || competitor_asins.length === 0) {
                return this.fail('请至少选择一个竞品ASIN');
            }
            if (competitor_asins.length > 20) {
                return this.fail('单次最多支持20个竞品ASIN');
            }

            const result = await this.sifKeywordService.fetchByCompetitorAsins({
                asin,
                product_code,
                marketplaces,
                competitor_asins,
            });

            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '获取关键词失败';
            console.error('SIF获取关键词异常:', error);
            return this.fail(errMsg);
        }
    }

    @Post('/fetchKeywordsForCandidates')
    async fetchKeywordsForCandidates(
        @Body() body: { ids: number[] }
    ) {
        try {
            const { ids } = body;
            if (!ids || ids.length === 0) {
                return this.fail('请先选择需要获取关键词的候选产品');
            }

            const result = await this.sifKeywordService.fetchKeywordsForCandidates(ids);
            return this.ok(result.message);
        } catch (error) {
            const errMsg = (error as Error).message || '获取关键词失败';
            console.error('SIF批量获取候选产品关键词异常:', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 批量入库关键词（仅关键词表，不写 app_user_keyword_config）
     */
    @Post('/batchSaveKeywordsOnly')
    async batchSaveKeywordsOnly(
        @Body() body: {
            asin: string;
            product_code: string;
            marketplaces: string;
            total_competitor_count: number;
            keywords: Array<{
                keyword: string;
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
        }
    ) {
        try {
            const { asin, product_code, marketplaces, total_competitor_count, keywords } = body;

            if (!product_code) return this.fail('产品编码(product_code)为必填参数');
            if (!marketplaces) return this.fail('国家(marketplaces)为必填参数');
            if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
                return this.fail('请至少选择一个关键词入库');
            }

            const result = await this.sifKeywordService.batchSaveKeywordsOnly({
                asin,
                product_code,
                marketplaces,
                total_competitor_count,
                keywords,
            });

            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '入库关键词失败';
            console.error('SIF入库关键词异常(batchSaveKeywordsOnly):', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 批量入库用户选中的关键词
     * 新词INSERT，已有词UPDATE覆盖sif_*数据
     */
    @Post('/batchSave')
    async batchSave(
        @Body() body: {
            asin: string;
            product_code: string;
            marketplaces: string;
            total_competitor_count: number;
            keywords: Array<{
                keyword: string;
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
        }
    ) {
        try {
            const { asin, product_code, marketplaces, total_competitor_count, keywords } = body;

            // 参数校验
            if (!asin) return this.fail('主ASIN为必填参数');
            if (!product_code) return this.fail('产品编码(product_code)为必填参数');
            if (!marketplaces) return this.fail('国家(marketplaces)为必填参数');
            if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
                return this.fail('请至少选择一个关键词入库');
            }

            const result = await this.sifKeywordService.batchSave({
                asin,
                product_code,
                marketplaces,
                total_competitor_count,
                keywords,
            });

            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '入库关键词失败';
            console.error('SIF入库关键词异常:', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 关键词管理 — 分页列表
     * 按 asin + product_code + marketplaces 查询
     */
    @Post('/keywordPage')
    async keywordPage(
        @Body() body: {
            asin: string;
            product_code?: string;
            marketplaces?: string;
            page?: number;
            size?: number;
            sort?: string;
            order?: string;
            keyWord?: string;
            status?: number;
        }
    ) {
        try {
            if (!body.asin) return this.fail('asin 为必填参数');
            if (!body.product_code) return this.fail('product_code 为必填参数');
            if (!body.marketplaces) return this.fail('marketplaces 为必填参数');

            const result = await this.sifKeywordService.keywordPage(body);
            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '查询关键词列表失败';
            console.error('keywordPage 异常:', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 批量获取搜索趋势历史
     * 调 SIF estSearchesHistory 接口，按月维度获取搜索量+ABA排名
     * 回写时按 value + marketplaces 匹配（跨 product_code 更新）
     */
    @Post('/fetchSearchHistory')
    async fetchSearchHistory(
        @Body() body: {
            keywords: string[];
            marketplaces: string;
            product_code?: string;
        }
    ) {
        try {
            if (!body.keywords || body.keywords.length === 0) {
                return this.fail('请至少选择一个关键词');
            }
            if (!body.marketplaces) {
                return this.fail('国家(marketplaces)为必填参数');
            }

            const result = await this.sifKeywordService.fetchSearchHistory(body);
            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '获取搜索趋势失败';
            console.error('fetchSearchHistory 异常:', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 获取用户默认关键词
     * 有手动配置返回配置，无配置按流量得分取前3
     */
    @Post('/getUserDefaultKeywords')
    async getUserDefaultKeywords(
        @Body() body: {
            asin: string;
            product_code: string;
            marketplaces: string;
        }
    ) {
        try {
            if (!body.asin) return this.fail('asin 为必填参数');
            if (!body.product_code) return this.fail('product_code 为必填参数');
            if (!body.marketplaces) return this.fail('marketplaces 为必填参数');

            const result = await this.sifKeywordService.getUserDefaultKeywords(body);
            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '获取默认关键词失败';
            console.error('getUserDefaultKeywords 异常:', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 设置用户默认关键词（最多3个）
     * 传空数组 keyword_ids=[] 则清除配置
     */
    @Post('/setUserDefaultKeywords')
    async setUserDefaultKeywords(
        @Body() body: {
            asin: string;
            product_code: string;
            marketplaces: string;
            keyword_ids: number[];
        }
    ) {
        try {
            if (!body.asin) return this.fail('asin 为必填参数');
            if (!body.product_code) return this.fail('product_code 为必填参数');
            if (!body.marketplaces) return this.fail('marketplaces 为必填参数');
            if (!Array.isArray(body.keyword_ids)) return this.fail('keyword_ids 必须是数组');

            const result = await this.sifKeywordService.setUserDefaultKeywords(body);
            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '设置默认关键词失败';
            console.error('setUserDefaultKeywords 异常:', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 删除关键词（物理删除）
     * 从数据库中永久删除关键词记录，并级联清理所有用户的默认关键词配置
     */
    @Post('/deleteKeywords')
    async deleteKeywords(
        @Body() body: {
            ids: number[];
            tracking_scope?: {
                marketplace?: string;
                marketplaces?: string;
                product_code?: string;
                asin?: string;
                asin_self?: string;
                store_id?: number | string | null;
                msku?: string | null;
                seller_sku?: string | null;
            };
        }
    ) {
        try {
            const ids = body?.ids;
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return this.fail('请至少选择一个关键词');
            }

            const result = await this.sifKeywordService.deleteKeywords(ids, {
                tracking_scope: body?.tracking_scope,
            });
            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '删除关键词失败';
            console.error('deleteKeywords 异常:', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 定时任务：全量更新所有已入库关键词的搜索趋势
     * 后台面板配置定时调用此接口即可
     * 可选参数：batchSize(默认200) / delayMs(默认3000) / maxRetry(默认1) / retryDelayMs(默认5000)
     */
    @Post('/scheduledUpdateAllSearchHistory')
    async scheduledUpdateAllSearchHistory(
        @Body() body?: {
            batchSize?: number;
            delayMs?: number;
            maxRetry?: number;
            retryDelayMs?: number;
        }
    ) {
        try {
            const result = await this.sifKeywordService.scheduledUpdateAllSearchHistory(body);
            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '定时更新搜索趋势失败';
            console.error('scheduledUpdateAllSearchHistory 异常:', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 批量翻译关键词（百度通用翻译API）
     * 将关键词从源语言翻译为目标语言
     */
    @Post('/translateKeywords')
    async translateKeywords(
        @Body() body: {
            keywords: string[];
            from?: string;
            to?: string;
            marketplaces?: string;
        }
    ) {
        try {
            if (!body.keywords || !Array.isArray(body.keywords) || body.keywords.length === 0) {
                return this.fail('请提供要翻译的关键词');
            }

            const result = await this.sifKeywordService.translateKeywords(body);
            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '翻译关键词失败';
            console.error('translateKeywords 异常:', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 批量强制翻译并在库里保存
     */
    @Post('/translateAndSave')
    async translateAndSave(
        @Body() body: {
            ids: number[];
            from?: string;
        }
    ) {
        try {
            const { ids, from } = body;
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return this.fail('请至少选择一个关键词');
            }

            const result = await this.sifKeywordService.translateAndSaveByIds(ids, from);
            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '批量翻译失败';
            console.error('translateAndSave 异常:', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 手动更新单个关键词中文翻译
     */
    @Post('/updateTranslation')
    async updateTranslation(
        @Body() body: {
            id: number;
            value_cn: string;
        }
    ) {
        try {
            if (!body.id) return this.fail('关键词ID为必填参数');
            if (typeof body.value_cn !== 'string') return this.fail('中文翻译(value_cn)必须是字符串');

            const result = await this.sifKeywordService.updateTranslation(body.id, body.value_cn);
            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '更新中文翻译失败';
            console.error('updateTranslation 异常:', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 2026-04-02 新增接口：分别按英国、德国获取竞品并查词
     */
    @Post('/fetchKeywordsForCandidatesUKDE')
    async fetchKeywordsForCandidatesUKDE(
        @Body() body: { ids: number[] }
    ) {
        try {
            const { ids } = body;
            if (!ids || ids.length === 0) {
                return this.fail('请先选择需要获取关键词的候选产品');
            }

            const result = await this.sifKeywordService.fetchKeywordsForCandidatesUKDE(ids);
            return this.ok(result.message);
        } catch (error) {
            const errMsg = (error as Error).message || '获取关键词失败';
            console.error('SIF批量获取候选产品关键词异常(UK/DE):', error);
            return this.fail(errMsg);
        }
    }

    /**
     * 查询关键词前三页ASIN（自然排名、广告位等）
     * 调 SIF getAsinPageListByKeyword 接口
     */
    @Post('/fetchAsinPageListByKeyword')
    async fetchAsinPageListByKeyword(
        @Body() body: {
            keyword: string;
            marketplaces: string;
            date?: string;
        }
    ) {
        try {
            if (!body.keyword) return this.fail('关键词(keyword)为必填参数');
            if (!body.marketplaces) return this.fail('国家(marketplaces)为必填参数');

            const result = await this.sifKeywordService.fetchAsinPageListByKeyword(body);
            return this.ok(result);
        } catch (error) {
            const errMsg = (error as Error).message || '查询关键词ASIN排名失败';
            console.error('fetchAsinPageListByKeyword 异常:', error);
            return this.fail(errMsg);
        }
    }
}
