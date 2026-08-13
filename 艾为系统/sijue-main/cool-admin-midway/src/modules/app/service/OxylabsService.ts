
import { Provide, Init } from '@midwayjs/decorator';
import axios from 'axios';
import { ILogger } from '@midwayjs/logger';
import { BaseSysParamEntity } from '../../base/entity/sys/param';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { AppTaskManagementEntity } from '../entity/bzy_task_management';
import { AppOxylabsApiLogEntity } from '../entity/oxylabs_api_log';
import * as dayjs from 'dayjs';
interface ProductAd {
    pos: number;
    asin: string;
    type: string;
    price: number;
    title: string;
    images: string[];
    rating: number;
    location: string;
    price_upper: number;
    reviews_count: number;
    is_prime_eligible: boolean;
  }
@Provide()
export class OxylabsService {
    
    private apiUsername: string;
    private apiPassword: string;
    private readonly apiUrl = 'https://realtime.oxylabs.io/v1/queries';

    @InjectEntityModel(BaseSysParamEntity)
    baseSysParamRepo: Repository<BaseSysParamEntity>;
    @InjectEntityModel(AppTaskManagementEntity)
    taskManagementRepo: Repository<AppTaskManagementEntity>;
    @InjectEntityModel(AppOxylabsApiLogEntity)
    oxylabsApiLogRepo: Repository<AppOxylabsApiLogEntity>;
    // @Init()
    async init() {
        // 从数据库获取配置 艾为思觉数据切换
        const oxyApiName = await this.baseSysParamRepo.findOne({
        where: { keyName: 'oxy_api_name' }
        });
        const oxyApiPwd = await this.baseSysParamRepo.findOne({
        where: { keyName: 'oxy_api_pwd' }
        });

        this.apiUsername = oxyApiName?.data || '';
        this.apiPassword = oxyApiPwd?.data || '';

        if (!this.apiUsername || !this.apiPassword) {
        throw new Error('Oxylabs API 凭证未配置');
        }
    }

    /**
     * 将市场名称映射到亚马逊域名
     * @param marketplace 市场名称（如"美国"）
     * @returns 亚马逊域名（如"com"）
     */
    mapMarketplaceToDomain(marketplace: string): string {
        const map: Record<string, string> = {
            '美国': 'com',
            '英国': 'co.uk',
            '德国': 'de',
            '法国': 'fr',
            '意大利': 'it',
            '西班牙': 'es',
            '荷兰': 'nl',
            '瑞典': 'se',
            '波兰': 'pl',
            '日本': 'co.jp',
            '加拿大': 'ca',
            '墨西哥': 'com.mx',
            '巴西': 'com.br',
            '澳大利亚': 'com.au',
            '阿联酋': 'ae',
            '印度': 'in',
            '新加坡': 'sg',
            '沙特阿拉伯': 'sa',
            '土耳其': 'com.tr',
            'us': 'com',
            'uk': 'co.uk',
            'de': 'de',
            'fr': 'fr',
            'it': 'it',
            'es': 'es',
        };

        return map[marketplace.toLowerCase()] || 'com';
    }

    private getPostcodeByMarketplace(marketplace: string): string {
        const map: Record<string, string> = {
            '美国': '20500',
            '德国': '10115',
            '英国': 'M2 5BQ',
            '法国': '75001',
            '西班牙': '28001',
            '意大利': '48100',
            'us': '20500',
            'de': '10115',
            'uk': 'M2 5BQ',
            'fr': '75001',
            'es': '28001',
            'it': '48100',
        };

        return map[marketplace.toLowerCase()] || '10115';
    }

    private async recordApiUsage(
        sourceLocation: string,
        apiName: string,
        remark: string,
    ): Promise<void> {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const dateKey = `${year}${month}${day}`;

            const taskCode = `${apiName}-${dateKey}`;
            const taskName = sourceLocation || 'unknown';

            let task = await this.taskManagementRepo.findOne({
                where: {
                    taskName,
                    taskCode,
                },
            });

            if (!task) {
                task = new AppTaskManagementEntity();
                task.taskName = taskName;
                task.taskCode = taskCode;
                task.taskStatus = 'Finished';
                task.invokeTime = now;
                task.executeStartTime = now;
                task.executeEndTime = now;
                task.retryCount = 0;
                task.maxRetryCount = 0;
                task.totalCount = 1;
                task.completedCount = 1;
                task.remark = remark;
                await this.taskManagementRepo.save(task);
                return;
            }

            const currentCompleted = typeof task.completedCount === 'number' ? task.completedCount : 0;
            task.completedCount = currentCompleted + 1;
            task.totalCount = task.completedCount;
            task.executeEndTime = now;
            if (!task.remark) {
                task.remark = remark;
            }
            await this.taskManagementRepo.save(task);
        } catch (error) {
            console.error('记录 Oxylabs 调用统计失败:', error);
        }
    }

    /**
     * 记录Oxylabs API调用日志
     */
    private async recordOxylabsApiLog(
        apiPath: string,
        httpMethod: string,
        requestType: string,
        queryContent: string,
        country: string,
        pages: number,
        callStartTime: number,
        responseCode: number | null,
        isSuccess: number,
        errorMessage: string | null,
        callLocation: string
    ) {
        try {
            const durationMs = Date.now() - callStartTime;
            const log = this.oxylabsApiLogRepo.create({
                call_date: dayjs().format('YYYY-MM-DD'),
                api_path: apiPath,
                http_method: httpMethod,
                request_type: requestType,
                query_content: queryContent,
                country,
                pages,
                credit_count: 1, // Oxylabs按请求次数计费，每次1次
                response_code: responseCode,
                duration_ms: durationMs,
                is_success: isSuccess,
                error_message: errorMessage,
                caller: 'OxylabsService',
                call_location: callLocation
            });
            await this.oxylabsApiLogRepo.save(log);
        } catch (logErr) {
            console.warn(`[Oxylabs] API日志记录失败: ${logErr?.message || logErr}`);
        }
    }

    /**
     * 在亚马逊上搜索关键词
     * @param keyword 搜索关键词
     * @param marketplace 市场名称（如"美国"）
     * @param pages 获取的页数（默认3页）
     * @returns 搜索结果数组
     */
    async searchAmazon(
        keyword: string,
        marketplace: string,
        pages: number = 2,
        sourceLocation?: string,
    ): Promise<any[]> {
        const callStartTime = Date.now();
        let responseCode: number | null = null;
        let isSuccess = 1;
        let errorMessage: string | null = null;

        try {
            await this.recordApiUsage(
                sourceLocation || 'unknown.searchAmazon',
                'searchAmazon',
                'Oxylabs searchAmazon 关键词搜索调用',
            );

            await this.init();
            const domain = this.mapMarketplaceToDomain(marketplace);
            const postcode = this.getPostcodeByMarketplace(marketplace);

            const response = await axios.post(
                this.apiUrl,
                {
                    source: "amazon_search",
                    domain,
                    query: keyword,
                    parse: true,
                    geo_location: postcode,
                    pages,
                },
                {
                    auth: {
                        username: this.apiUsername,
                        password: this.apiPassword
                    },
                }
            );

            responseCode = response.status;

            // 处理多页结果
            const allResults = [];
            const results = response.data?.results || [];

            for (const page of results) {
                // 获取自然结果和广告结果
                const organicResults = page?.content?.results?.organic || [];
                const paidResults = page?.content?.results?.paid || [];

                // 添加类型标识
                const organicWithType = organicResults.map(item => ({
                    ...item,
                }));

                const paidWithType = paidResults.map(item => ({
                    ...item,
                }));

                // 合并并按照位置排序
                const combinedResults = [...organicWithType, ...paidWithType];
                combinedResults.sort((a, b) => (a.pos || 0) - (b.pos || 0));

                // 添加到总结果
                allResults.push(...combinedResults);
            }

            // 记录API调用日志
            this.recordOxylabsApiLog(
                '/v1/queries',
                'POST',
                'amazon_search',
                keyword,
                marketplace,
                pages,
                callStartTime,
                responseCode,
                isSuccess,
                errorMessage,
                '关键词搜索'
            ).catch(err => console.warn('记录Oxylabs日志失败:', err));

            return allResults;
        } catch (error) {
            isSuccess = 0;
            errorMessage = error?.message || String(error);
            console.error('搜索亚马逊失败:', error);

            // 记录API调用日志
            this.recordOxylabsApiLog(
                '/v1/queries',
                'POST',
                'amazon_search',
                keyword,
                marketplace,
                pages,
                callStartTime,
                responseCode,
                isSuccess,
                errorMessage,
                '关键词搜索'
            ).catch(err => console.warn('记录Oxylabs日志失败:', err));

            // 实际项目中应该根据需求处理错误
            // throw new Error('搜索亚马逊失败');
            return [];
        }
    }

    async getProductInfo(
        marketplace: string,
        asin: string,
        sourceLocation?: string,
    ): Promise<{
        title: string | null;
        stars: number | null;
        reviews: number | null;
        price: number | null;
        image_url: string | null;
        bullet_points: string | null;
        dispatches_from: string | null;
        sold_by: string | null;
        marketplace: string | null;
        weight: string | null;
        dimensions: string | null;
        bsr_html: string | null;
        date_first_available: string | null;
        description: string | null;
    }> {
        await this.recordApiUsage(
            sourceLocation || 'unknown.getProductInfo',
            'getProductInfo',
            'Oxylabs getProductInfo 产品信息获取调用',
        );

        const callStartTime = Date.now();
        let responseCode: number | null = null;
        let isSuccess = 1;
        let errorMessage: string | null = null;

        await this.init();
        const geo = this.mapMarketplaceToDomain(marketplace);
        const postcode = this.getPostcodeByMarketplace(marketplace);
        const defaultResponse = {
            title: null,
            stars: null,
            reviews: null,
            price: null,
            image_url: null,
            bullet_points: null,
            dispatches_from: null,
            sold_by: null,
            marketplace: null,
            weight: null,
            dimensions: null,
            bsr_html: null,
            date_first_available: null,
            description: null
        };

        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    source: "amazon_product",
                    parse: true,
                    domain: geo,
                    geo_location: postcode,
                    query: asin
                },
                {
                    auth: {
                        username: this.apiUsername,
                        password: this.apiPassword
                    },
                }
            );

            responseCode = response.status;
            const result = response.data?.results?.[0]?.content;
            if (!result) {
                isSuccess = 0;
                errorMessage = 'No result data';
                this.recordOxylabsApiLog(
                    '/v1/queries',
                    'POST',
                    'amazon_product',
                    asin,
                    marketplace,
                    1,
                    callStartTime,
                    responseCode,
                    isSuccess,
                    errorMessage,
                    '产品信息获取'
                ).catch(err => console.warn('记录Oxylabs日志失败:', err));
                return defaultResponse;
            }

            // 处理商家信息
            let seller_id: string | null = null;
            let featured_merchant: any = result.featured_merchant;

            if (Array.isArray(featured_merchant)) {
                featured_merchant = featured_merchant[0];
            }

            if (featured_merchant && typeof featured_merchant === 'object') {
                seller_id = featured_merchant.seller_id;
            }


            // 处理产品详情
            const product_details = result.product_details || {};

            // 处理bullet points（合并为字符串）
            let bullet_points = '';
            if (Array.isArray(result.bullet_points)) {
                bullet_points = result.bullet_points.join(' ');
            } else if (typeof result.bullet_points === 'string') {
                bullet_points = result.bullet_points.replace(/\n/g, ' ');
            }

            // 处理BSR HTML（多语言支持）
            let bsr_html = '';
            const bsr_keys = [
                'best_sellers_rank',
                'classement_des_meilleures_ventes_d_amazon', // 法语
                'clasificación_en_los_más_vendidos_de_amazon' // 西班牙语
            ];

            for (const key of bsr_keys) {
                if (product_details[key]) {
                    bsr_html = product_details[key];
                    break;
                }
            }

            const finalResult = {
                title: result.product_name || null,
                stars: result.rating || null,
                reviews: result.reviews_count || null,
                price: result.price || null,
                image_url: (result.images || [])[0] || null,
                bullet_points,
                dispatches_from: featured_merchant?.shipped_from || null,
                sold_by: featured_merchant?.name || null,
                marketplace,
                weight: product_details.item_weight || null,
                dimensions: product_details.package_dimensions ||
                    product_details.product_dimensions || null,
                bsr_html,
                date_first_available: product_details.date_first_available || null,
                description: result.description || null
            };

            // 记录API调用日志
            this.recordOxylabsApiLog(
                '/v1/queries',
                'POST',
                'amazon_product',
                asin,
                marketplace,
                1,
                callStartTime,
                responseCode,
                isSuccess,
                errorMessage,
                '产品信息获取'
            ).catch(err => console.warn('记录Oxylabs日志失败:', err));

            return finalResult;
        } catch (error) {
            isSuccess = 0;
            errorMessage = error?.message || String(error);
            console.log(error);

            // 记录API调用日志
            this.recordOxylabsApiLog(
                '/v1/queries',
                'POST',
                'amazon_product',
                asin,
                marketplace,
                1,
                callStartTime,
                responseCode,
                isSuccess,
                errorMessage,
                '产品信息获取'
            ).catch(err => console.warn('记录Oxylabs日志失败:', err));

            return defaultResponse;
        }
    }

    /**
     * 获取商品详情页的全部图片 URL 列表
     * 只请求一次，不做重试；有几张给几张
     */
    async getProductImages(
        marketplace: string,
        asin: string,
        sourceLocation?: string,
    ): Promise<string[]> {
        const callStartTime = Date.now();
        let responseCode: number | null = null;
        let isSuccess = 1;
        let errorMessage: string | null = null;

        try {
            await this.recordApiUsage(
                sourceLocation || 'unknown.getProductImages',
                'getProductImages',
                'Oxylabs getProductImages 商品图片获取调用',
            );

            await this.init();
            const domain = this.mapMarketplaceToDomain(marketplace);
            const postcode = this.getPostcodeByMarketplace(marketplace);

            const response = await axios.post(
                this.apiUrl,
                {
                    source: 'amazon_product',
                    parse: true,
                    domain,
                    geo_location: postcode,
                    query: asin,
                },
                {
                    auth: {
                        username: this.apiUsername,
                        password: this.apiPassword,
                    },
                },
            );

            responseCode = response.status;
            const content = response.data?.results?.[0]?.content;
            const images: string[] = Array.isArray(content?.images) ? content.images : [];

            const filteredImages = images.filter(
                (url) =>
                    typeof url === 'string' &&
                    url.length > 0 &&
                    url.includes('m.media-amazon.com'),
            );

            // 记录API调用日志
            this.recordOxylabsApiLog(
                '/v1/queries',
                'POST',
                'amazon_product',
                asin,
                marketplace,
                1,
                callStartTime,
                responseCode,
                isSuccess,
                errorMessage,
                '商品图片获取'
            ).catch(err => console.warn('记录Oxylabs日志失败:', err));

            return filteredImages;
        } catch (error) {
            isSuccess = 0;
            errorMessage = error?.message || String(error);
            console.error('获取商品图片失败:', error);

            // 记录API调用日志
            this.recordOxylabsApiLog(
                '/v1/queries',
                'POST',
                'amazon_product',
                asin,
                marketplace,
                1,
                callStartTime,
                responseCode,
                isSuccess,
                errorMessage,
                '商品图片获取'
            ).catch(err => console.warn('记录Oxylabs日志失败:', err));

            return [];
        }
    }

    async getProductAds(
        marketplace: string,
        asin: string,
        sourceLocation?: string,
    ): Promise<{ ads: ProductAd[]; title: string }> {
        const callStartTime = Date.now();
        let responseCode: number | null = null;
        let isSuccess = 1;
        let errorMessage: string | null = null;

        await this.recordApiUsage(
            sourceLocation || 'unknown.getProductAds',
            'getProductAds',
            'Oxylabs getProductAds 广告数据获取调用',
        );

        await this.init();
        const domain = this.mapMarketplaceToDomain(marketplace);
        const postcode = this.getPostcodeByMarketplace(marketplace);

        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    source: "amazon_product",
                    parse: true,
                    domain,
                    geo_location: postcode,
                    query: asin
                },
                {
                    auth: {
                        username: this.apiUsername,
                        password: this.apiPassword
                    },
                }
            );

            responseCode = response.status;
            // 提取原始广告数据
            const rawAds = response.data?.results?.[0]?.content?.ads || [];
            const title = response.data?.results?.[0]?.content?.title || '';

            const result = {
                ads: rawAds.map((ad: any) => this.parseAdItem(ad)),
                title
            };

            // 记录API调用日志
            this.recordOxylabsApiLog(
                '/v1/queries',
                'POST',
                'amazon_product',
                asin,
                marketplace,
                1,
                callStartTime,
                responseCode,
                isSuccess,
                errorMessage,
                '广告数据获取'
            ).catch(err => console.warn('记录Oxylabs日志失败:', err));

            return result;
        } catch (error) {
            isSuccess = 0;
            errorMessage = error?.message || String(error);
            console.error('获取广告数据失败:', error);

            // 记录API调用日志
            this.recordOxylabsApiLog(
                '/v1/queries',
                'POST',
                'amazon_product',
                asin,
                marketplace,
                1,
                callStartTime,
                responseCode,
                isSuccess,
                errorMessage,
                '广告数据获取'
            ).catch(err => console.warn('记录Oxylabs日志失败:', err));

            return {
                ads: [],
                title: ''
            };
        }
    }

    
    private parseAdItem(rawAd: any): ProductAd {
        return {
            pos: Number(rawAd.pos) || 0,
            asin: rawAd.asin || '',
            type: rawAd.type || '',
            price: Number(rawAd.price) || 0,
            title: rawAd.title || '',
            images: Array.isArray(rawAd.images) ? rawAd.images : [],
            rating: Number(rawAd.rating) || 0,
            location: rawAd.location || '',
            price_upper: Number(rawAd.price_upper) || 0,
            reviews_count: Number(rawAd.reviews_count) || 0,
            is_prime_eligible: Boolean(rawAd.is_prime_eligible)
        };
    }
}
