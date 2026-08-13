import { App, Provide } from "@midwayjs/decorator";
import { Singleton } from "@midwayjs/core";
import { InjectEntityModel } from "@midwayjs/typeorm";
import { BaseSysParamEntity } from "../../../base/entity/sys/param";
import { AppSifApiLogEntity } from "../../entity/sif_api_log";
import { Repository } from "typeorm";
import { Application } from "@midwayjs/koa";
import axios, { AxiosRequestConfig } from "axios";
import * as dayjs from 'dayjs';

/**
 * SIF 平台工具类
 * - 认证方式：secretId 获取 JWT Token，有效期24小时
 * - 每次 API 响应 header 中会返回新 Token（自动续期）
 * - 访问频率上限：1000次/分钟
 */
@Provide()
@Singleton()
export class SifUtils {
    @InjectEntityModel(BaseSysParamEntity)
    baseSysParamRepo: Repository<BaseSysParamEntity>;

    @InjectEntityModel(AppSifApiLogEntity)
    sifApiLogRepo: Repository<AppSifApiLogEntity>;

    @App()
    app: Application;

    // ========== 调试开关 ==========
    /**
     * 设为 true 打印每次 SIF 请求的完整 URL、参数、响应
     * 手动改这一行就行，不需要重启（Singleton 首次加载后生效）
     */
    static DEBUG_LOG = false;

    // ========== 配置字段 ==========
    sif_api_host: string = "https://www.sif.com";
    sif_secret_id: string = "";
    sif_access_token: string = null;
    sif_token_expiration: number = 0;

    /**
     * 初始化 —— 从 base_sys_param 表加载配置
     */
    async init() {
        if (this.sif_access_token) {
            return;
        }

        const [param_host, param_secret_id, param_access_token, param_token_expiration] =
            await Promise.all([
                this.baseSysParamRepo.findOne({ where: { keyName: "sifHost" } }),
                this.baseSysParamRepo.findOne({ where: { keyName: "sifSecretId" } }),
                this.baseSysParamRepo.findOne({ where: { keyName: "sifAccessToken" } }),
                this.baseSysParamRepo.findOne({ where: { keyName: "sifTokenExpiration" } }),
            ]);

        if (param_host?.data) this.sif_api_host = param_host.data.trim();
        if (param_secret_id?.data) this.sif_secret_id = param_secret_id.data.trim();
        if (param_access_token?.data) this.sif_access_token = param_access_token.data.trim();
        if (param_token_expiration?.data)
            this.sif_token_expiration = parseInt(param_token_expiration.data);
    }

    // ========== Token 获取 ==========

    /**
     * 获取 / 刷新 Access Token
     * - Token 有效期 24 小时
     * - 提前 1 小时刷新，避免在业务请求中过期
     */
    async getAccessToken(forceRefresh: boolean = false) {
        const needRefresh =
            forceRefresh ||
            !this.sif_access_token ||
            this.sif_token_expiration - Date.now() < 1000 * 60 * 60; // 提前1小时刷新

        if (!needRefresh) {
            return;
        }

        if (!this.sif_secret_id) {
            throw new Error("SIF平台 SecretId 未配置（key：sifSecretId）");
        }

        try {
            const url = `${this.sif_api_host}/api/user/token`;
            const response = await axios.get(url, {
                params: { secretid: this.sif_secret_id },
                timeout: 15000,
            });

            const resData = response.data;

            if (resData?.code === 1 && resData?.data) {
                this.sif_access_token = resData.data;
                // Token 有效期 24 小时
                this.sif_token_expiration = Date.now() + 24 * 60 * 60 * 1000;
                await this.saveTokenToDB();
                console.log("[SIF] Token 获取成功");
            } else {
                throw new Error(
                    `SIF获取Token失败: code=${resData?.code}, data=${JSON.stringify(resData)}`
                );
            }
        } catch (error) {
            console.error("[SIF] 获取Token异常:", error);
            throw error;
        }
    }

    // ========== Token 持久化 ==========

    /**
     * 将 Token 和过期时间保存到 base_sys_param 表
     */
    private async saveTokenToDB() {
        // 保存 access_token
        let paramAccessToken = await this.baseSysParamRepo.findOne({
            where: { keyName: "sifAccessToken" },
        });
        if (paramAccessToken) {
            paramAccessToken.data = this.sif_access_token;
            await this.baseSysParamRepo.save(paramAccessToken);
        } else {
            await this.baseSysParamRepo.insert({
                keyName: "sifAccessToken",
                name: "SIF Token",
                data: this.sif_access_token,
                dataType: 0,
            });
        }

        // 保存过期时间
        let paramExpiration = await this.baseSysParamRepo.findOne({
            where: { keyName: "sifTokenExpiration" },
        });
        if (paramExpiration) {
            paramExpiration.data = String(this.sif_token_expiration);
            await this.baseSysParamRepo.save(paramExpiration);
        } else {
            await this.baseSysParamRepo.insert({
                keyName: "sifTokenExpiration",
                name: "SIF Token过期时间",
                data: String(this.sif_token_expiration),
                dataType: 0,
            });
        }
    }

    // ========== 从响应 Header 更新 Token ==========

    /**
     * 每次 API 响应的 header 中可能返回新 Token
     * 检测并更新本地 Token（自动续期机制）
     */
    private async updateTokenFromResponseHeader(responseHeaders: any) {
        const newToken =
            responseHeaders?.["authorization"] ||
            responseHeaders?.["Authorization"] ||
            responseHeaders?.["token"] ||
            responseHeaders?.["Token"];

        if (newToken && newToken !== this.sif_access_token) {
            console.log("[SIF] 从响应Header获取到新Token，自动续期");
            this.sif_access_token = newToken;
            this.sif_token_expiration = Date.now() + 24 * 60 * 60 * 1000;
            await this.saveTokenToDB();
        }
    }

    // ========== 统一 HTTP 请求 ==========

    /**
     * 统一的 HTTP 请求方法
     * - 自动初始化配置
     * - 自动获取/刷新 Token
     * - 自动从响应 header 更新 Token
     * - Token 失效时自动重试一次
     */
    async httpDo(
        method: string = "get",
        apiPath: string,
        params: any = {},
        returnRawResponse: boolean = false
    ) {
        await this.init();
        await this.getAccessToken();

        const url = `${this.sif_api_host}${apiPath}`;
        const config: AxiosRequestConfig = {
            method,
            url,
            headers: {
                "Content-Type": "application/json",
                authorization: this.sif_access_token,
            },
            timeout: 30000,
        };

        if (method.toLowerCase() === "get") {
            config.params = params;
        } else {
            config.data = params;
        }

        const callStartTime = Date.now();
        let responseCode: number | null = null;
        let isSuccess = 1;
        let errorMessage: string | null = null;

        try {
            if (SifUtils.DEBUG_LOG) {
                console.log(`[SIF:DEBUG] ===== 请求 =====`);
                console.log(`[SIF:DEBUG] ${method.toUpperCase()} ${url}`);
                console.log(`[SIF:DEBUG] 参数:`, JSON.stringify(params, null, 2));
            }

            const response = await axios(config);

            // 从响应 header 更新 Token（SIF 的自动续期机制）
            await this.updateTokenFromResponseHeader(response.headers);

            const result = returnRawResponse ? response : response.data;
            responseCode = returnRawResponse ? response.data?.code : result?.code;

            // 检查 Token 是否失效（code 不为 1 可能表示认证失败）
            if (this.checkIfTokenInvalid(result)) {
                console.warn("[SIF] Token可能已失效，尝试强制刷新后重试");
                await this.getAccessToken(true);

                // 更新请求头中的 Token
                config.headers["authorization"] = this.sif_access_token;
                const retryResponse = await axios(config);
                await this.updateTokenFromResponseHeader(retryResponse.headers);
                const retryResult = returnRawResponse ? retryResponse : retryResponse.data;
                responseCode = returnRawResponse ? retryResponse.data?.code : retryResult?.code;

                // 记录日志（重试成功）
                this.recordApiLog(apiPath, method, params, callStartTime, responseCode, 1, null);
                return retryResult;
            }

            if (SifUtils.DEBUG_LOG) {
                console.log(`[SIF:DEBUG] ===== 响应 =====`);
                console.log(`[SIF:DEBUG]`, JSON.stringify(result, null, 2));
            }

            // 记录日志（成功）
            this.recordApiLog(apiPath, method, params, callStartTime, responseCode, 1, null);
            return result;
        } catch (error: any) {
            // HTTP 401/403 也可能是 Token 失效
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.warn(`[SIF] HTTP ${error.response.status}，尝试强制刷新Token后重试`);
                await this.getAccessToken(true);

                config.headers["authorization"] = this.sif_access_token;
                const retryResponse = await axios(config);
                await this.updateTokenFromResponseHeader(retryResponse.headers);
                const retryResult = returnRawResponse ? retryResponse : retryResponse.data;
                responseCode = returnRawResponse ? retryResponse.data?.code : retryResult?.code;

                // 记录日志（重试成功）
                this.recordApiLog(apiPath, method, params, callStartTime, responseCode, 1, null);
                return retryResult;
            }

            // 记录日志（失败）
            this.recordApiLog(apiPath, method, params, callStartTime, null, 0, error?.message || String(error));
            throw error;
        }
    }

    /**
     * 从 API 路径中提取国家代码
     */
    private extractCountry(apiPath: string): string | null {
        const match = apiPath.match(/country=([A-Z]{2})/i);
        return match ? match[1].toUpperCase() : null;
    }

    /**
     * 从请求参数中提取关键词和ASIN信息
     */
    private extractParamInfo(params: any): {
        keywordCount: number;
        keywordsSample: string | null;
        asinCount: number;
        asinsSample: string | null;
        creditCount: number;
    } {
        let keywordCount = 0;
        let keywordsSample: string | null = null;
        let asinCount = 0;
        let asinsSample: string | null = null;

        // 提取关键词信息
        if (params?.keywords && Array.isArray(params.keywords)) {
            keywordCount = params.keywords.length;
            keywordsSample = params.keywords.slice(0, 5).join(', ');
        } else if (params?.keyword && typeof params.keyword === 'string') {
            keywordCount = 1;
            keywordsSample = params.keyword;
        }

        // 提取 ASIN 信息
        if (params?.asins && Array.isArray(params.asins)) {
            asinCount = params.asins.length;
            asinsSample = params.asins.slice(0, 5).join(', ');
        } else if (params?.asin && typeof params.asin === 'string') {
            asinCount = 1;
            asinsSample = params.asin;
        }

        // 计费次数 = 关键词数 或 ASIN数，最少1次
        const creditCount = Math.max(keywordCount, asinCount, 1);

        return { keywordCount, keywordsSample, asinCount, asinsSample, creditCount };
    }

    /**
     * 异步记录 SIF API 调用日志（不阻塞主流程）
     */
    private recordApiLog(
        apiPath: string,
        method: string,
        params: any,
        callStartTime: number,
        responseCode: number | null,
        isSuccess: number,
        errorMessage: string | null
    ) {
        // 异步执行，不影响主流程
        (async () => {
            try {
                const durationMs = Date.now() - callStartTime;
                const country = this.extractCountry(apiPath);
                const { keywordCount, keywordsSample, asinCount, asinsSample, creditCount } = this.extractParamInfo(params);

                // 提取纯路径（去掉 query string）
                const purePath = apiPath.split('?')[0];

                const log = this.sifApiLogRepo.create({
                    call_date: dayjs().format('YYYY-MM-DD'),
                    api_path: purePath,
                    http_method: method.toUpperCase(),
                    keyword_count: keywordCount,
                    keywords_sample: keywordsSample,
                    asin_count: asinCount,
                    asins_sample: asinsSample,
                    country,
                    credit_count: creditCount,
                    response_code: responseCode,
                    duration_ms: durationMs,
                    is_success: isSuccess,
                    error_message: errorMessage,
                });
                await this.sifApiLogRepo.save(log);
            } catch (logErr) {
                // 日志记录失败不影响主流程
                console.warn(`[SIF] API日志记录失败: ${logErr?.message || logErr}`);
            }
        })();
    }

    /**
     * 检查响应是否表示 Token 无效
     * 根据 SIF 的 API 规范，code !== 1 时可能表示认证失败
     */
    private checkIfTokenInvalid(resData: any): boolean {
        if (resData?.code === -1 || resData?.code === 401) {
            return true;
        }
        // 检查常见的认证失败消息
        if (
            typeof resData?.message === "string" &&
            (resData.message.includes("token") ||
                resData.message.includes("授权") ||
                resData.message.includes("登录"))
        ) {
            return true;
        }
        return false;
    }

    // ========== 便捷请求方法 ==========

    async httpGet(apiPath: string, params?: any, returnRawResponse: boolean = false) {
        return this.httpDo("get", apiPath, params, returnRawResponse);
    }

    async httpPost(apiPath: string, params?: any, returnRawResponse: boolean = false) {
        return this.httpDo("post", apiPath, params, returnRawResponse);
    }
}
