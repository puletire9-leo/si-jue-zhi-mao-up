import { App, Provide } from "@midwayjs/decorator";
import { Init, Singleton } from "@midwayjs/core";
import { InjectEntityModel } from "@midwayjs/typeorm";
import { BaseSysParamEntity } from "../../../base/entity/sys/param";
import { Repository, In, QueryRunner, IsNull } from "typeorm";
import { Application } from "@midwayjs/koa";
import { generateAccessToken, httpRequest } from "./openapi-node-sdk/openapi";
import * as crypto from "crypto";
import axios from "axios";
import * as dayjs from "dayjs";
import { AppAmzBsrProductListingLingxingEntity } from "../../entity/bsr_product_Listing_Lingxing";
import { AppAmzBsrProductListingLingxingProcessEntity } from "../../entity/bsr_product_Listing_Lingxing_process";
import { Inject } from "@midwayjs/decorator";
import { AppAmzBsrProductListingLingxingService } from "../../service/bsr_product_Listing_Lingxing";
import { AppAmzBsrRestockingCenterLingxingService } from "../../service/bsr_restocking_center_lingxing";
import { ExtInfo, SuggestInfo } from "../../entity/bsr_restocking_center_lingxing";
import { AppAmzBsrRestockingCenterLingxingEntity } from "../../entity/bsr_restocking_center_lingxing";
import { AppAmzLingxingFbaShipmentReportEntity } from "../../entity/lingxing_fba_shipment_report";
import { AppAmzSellerEntity } from "../../entity/seller";
import { AppAmzLingxingProfitReportMskuEntity } from "../../entity/lingxing_profit_report_msku";
import { AppAmzLingxingProductPerformanceAsinEntity } from "../../entity/lingxing_product_performance_asin";
import {
  buildLingxingSellerMap,
  LingxingSellerMap,
  normalizeLingxingListingOpenApiItem,
  normalizeLingxingSourceListItem,
} from "./lingxingOpenApiMapper";
import { shouldPersistLingxingListing } from "../../service/bsr_product_listing_lingxing_sync_policy";

// 缓存常量（内存缓存key）
const CacheConstants = {
  LING_XING_CRAWLER_HEADERS: "LING_XING_CRAWLER_HEADERS",
};

// 状态枚举（对齐Java的ListingStatus）
export enum ListingStatus {
  STOP_SALE = 0, // 停售
  ON_SALE = 1, // 在售
  DELETED = 2, // 已删除
  ABNORMAL_OFFLINE = 3, // 异常下架
}
enum OutOfStockStatus {
  NORMAL = 0, // 正常
  OUT_OF_STOCK = 1, // 断货
}

// 过滤类型枚举
enum ListingFilterType {
  QUANTITY_SUM_NOT_ZERO = 1, // 库存非零
  OTHER = 2, // 其他
}

// 产品状态枚举
enum ProductState {
  OPEN_SALE_LESS_THAN_90_DAYS = 1, // 上架少于90天
  NORMAL = 0, // 正常
}

// 异常下架状态枚举
enum AbnormalOfflineStatus {
  NORMAL = 0, // 正常
  ABNORMAL_OFFLINE = 1, // 异常下架
}

// ========== FBA相关类型定义 ==========
export interface FbaValidItem {
  orderType: number;
  orderSn: string;
  quantity: number;
  expectArriveDate: string;
  amazonSaleDate: string;
  fnsku: string;
  msku: string;
  afnFulfillableQuantity: number; // 可售
  reservedFcTransfers: number;    // 待调仓
  reservedFcProcessing: number;   // 调仓中
  afnInboundReceivingQuantity: number; // 入库中
  reservedCustomerorders: number; // 待发货
}

export enum NewProductStatus {
  NONE = 0, // 无新品相关状态
  IN_TRANSIT = 1, // 新品在途
  ARRIVED_NO_SALES = 2, // 新品到货无销量
  ARRIVED_OVER_7_DAYS_NO_SALES = 3, // 到货超过7天无销量
  ARRIVED_OVER_14_DAYS_NO_SALES = 4, // 到货超过14天无销量
  ARRIVED_OVER_30_DAYS_NO_SALES = 5, // 到货超过30天无销量
}
/**
 * 类目流量状态枚举
 */
export enum CategoryTrafficStatus {
  NONE = 0, // 无变化
  DOWN = 1, // 类目流量降低
  UP = 2, // 类目流量增长
}

/**
 * 产品流量状态枚举
 */
export enum ProductTrafficStatus {
  NONE = 0, // 无变化
  DOWN = 1, // 产品流量降低
  UP = 2, // 产品流量增长
}


export interface FbaShippingItem {
  orderType: number;
  orderSn: string;
  quantity: number;
  expectArriveDate: string;
  amazonSaleDate: string;
  shippingOrderSn: string;
  logisticsChannelName: string;
  shipmentTime: string;
  shippingMethod: string;
  shipment_status: string | null; // 新增字段，默认null
}

@Provide()
@Singleton()
export class LingXingUtils {
  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamRepo: Repository<BaseSysParamEntity>;

  // 注入Listing实体的Repository
  @InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
  listingRepo: Repository<AppAmzBsrProductListingLingxingEntity>;
  
  @InjectEntityModel(AppAmzBsrRestockingCenterLingxingEntity)
  restockingEntity: Repository<AppAmzBsrRestockingCenterLingxingEntity>;

  @InjectEntityModel(AppAmzSellerEntity)
  sellerRepo: Repository<AppAmzSellerEntity>;

  @InjectEntityModel(AppAmzLingxingProfitReportMskuEntity)
  profitReportMskuRepo: Repository<AppAmzLingxingProfitReportMskuEntity>;

  @InjectEntityModel(AppAmzLingxingProductPerformanceAsinEntity)
  productPerformanceAsinRepo: Repository<AppAmzLingxingProductPerformanceAsinEntity>;

  private readonly LINGXING_DATA_FETCH_MODE_KEY = "lingxing_data_fetch_mode";
  private readonly OPEN_API_LISTING_PAGE_SIZE = 1000;

  
  @App()
  app: Application;

  // ========== 保留你所有原有配置 ==========
  // OpenAPI 相关配置
  lx_api_host: string = "https://openapi.lingxing.com";
  lx_app_id: string = "ak_xn2kRvp3xNxz8";
  lx_app_secret: string = "3/4Pn5Cfm7E//BVCF/D86w==";
  lx_access_token: string = null;
  lx_token_expiration: number = 0;

  // 领星爬虫相关配置
  lx_crawler_host: string = "https://gw.lingxingerp.com";
  lx_erp_host: string = "https://erp.lingxing.com";
  lx_account: string = ""; // 账号（从配置表加载）
  lx_password: string = ""; // 密码（从配置表加载）

  // 内存缓存（替代Redis）
  private memoryCache: Record<string, { data: any; expireTime: number }> = {};

  // 并发配置
  private readonly CONCURRENT_LIMIT = 20; // 每批次最大并发数
  private readonly PAGE_SIZE = 200; // 每页条数
  private readonly HEADER_EXPIRE_TIME = 7200 * 1000; // headers有效期2小时
  private readonly REQUEST_INTERVAL = 500; // 请求间隔（毫秒）

  // ========== 注入Service（仅用于同步逻辑，不影响原有代码） ==========
  @Inject()
  private listingService: AppAmzBsrProductListingLingxingService;

  @Inject()
  private restockingService: AppAmzBsrRestockingCenterLingxingService;

  // ========== 保留你所有原有init方法 ==========
  async init() {
    if (this.lx_access_token) {
      return;
    }

    // 加载基础配置
    const [
      param_lxHost,
      param_appId,
      param_appSecret,
      param_access_token,
      param_token_expiration,
      param_lxAccount,
      param_lxPassword,
    ] = await Promise.all([
      this.baseSysParamRepo.findOne({ where: { keyName: "lxHost" } }),
      this.baseSysParamRepo.findOne({ where: { keyName: "appId" } }),
      this.baseSysParamRepo.findOne({ where: { keyName: "appSecret" } }),
      this.baseSysParamRepo.findOne({ where: { keyName: "access_token" } }),
      this.baseSysParamRepo.findOne({ where: { keyName: "token_expiration" } }),
      this.baseSysParamRepo.findOne({ where: { keyName: "lingxing_account" } }),
      this.baseSysParamRepo.findOne({ where: { keyName: "lingxing_password" } }),
    ]);

    // 赋值OpenAPI配置
    if (param_lxHost?.data) this.lx_api_host = param_lxHost.data.trim();
    if (param_appId?.data) this.lx_app_id = param_appId.data.trim();
    if (param_appSecret?.data) this.lx_app_secret = param_appSecret.data.trim();
    if (param_access_token?.data) this.lx_access_token = param_access_token.data.trim();
    if (param_token_expiration?.data) this.lx_token_expiration = parseInt(param_token_expiration.data);

    // 赋值爬虫账号密码
    if (param_lxAccount?.data) this.lx_account = param_lxAccount.data.trim();
    if (param_lxPassword?.data) this.lx_password = param_lxPassword.data.trim();

    // 初始化AccessToken
    await this.getAccessToken();
  }

  // ========== 保留你所有原有内存缓存方法 ==========
  /**
   * 内存缓存设置
   */
  async getLingxingDataFetchMode(): Promise<1 | 2> {
    const param = await this.baseSysParamRepo.findOne({
      where: { keyName: this.LINGXING_DATA_FETCH_MODE_KEY },
    });
    const mode = Number(String(param?.data ?? "1").trim());
    return mode === 2 ? 2 : 1;
  }

  async getOpenApiSellerContext(): Promise<{
    sellers: AppAmzSellerEntity[];
    sidList: number[];
    sellerMap: LingxingSellerMap;
  }> {
    const sellers = await this.sellerRepo.find();
    const sellerBySid = new Map<string, AppAmzSellerEntity>();

    for (const seller of sellers) {
      const sid = Number(seller.sid);
      if (!Number.isFinite(sid) || sid <= 0) continue;
      const key = String(sid);
      if (!sellerBySid.has(key)) {
        sellerBySid.set(key, seller);
      }
    }

    const uniqueSellers = Array.from(sellerBySid.values());
    const sidList = uniqueSellers.map(seller => Number(seller.sid));

    return {
      sellers: uniqueSellers,
      sidList,
      sellerMap: buildLingxingSellerMap(uniqueSellers as any[]),
    };
  }

  private isOpenApiSuccess(result: any): boolean {
    if (Array.isArray(result)) return true;
    if (!result || result.code === undefined || result.code === null) return true;
    return Number(result.code) === 0 || Number(result.code) === 200;
  }

  private extractOpenApiRows(result: any): Array<Record<string, any>> {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.list)) return result.list;
    if (Array.isArray(result?.rows)) return result.rows;
    if (Array.isArray(result?.source_list)) return result.source_list;
    if (Array.isArray(result?.sourceList)) return result.sourceList;
    if (Array.isArray(result?.data?.list)) return result.data.list;
    if (Array.isArray(result?.data?.rows)) return result.data.rows;
    if (Array.isArray(result?.data?.source_list)) return result.data.source_list;
    if (Array.isArray(result?.data?.sourceList)) return result.data.sourceList;
    return [];
  }

  private extractOpenApiTotal(result: any, fallback: number): number {
    const total = Number(
      result?.total ??
      result?.data?.total ??
      result?.count ??
      result?.data?.count ??
      fallback
    );
    return Number.isFinite(total) ? total : fallback;
  }

  private sleep(milliseconds: number) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  private normalizeAsin(asin: string) {
    return String(asin || "").trim().toUpperCase();
  }

  private filterListingRowsByAsin(rows: Array<Record<string, any>>, asin: string) {
    const normalizedAsin = this.normalizeAsin(asin);
    return rows
      .filter(item => shouldPersistLingxingListing(item))
      .filter(item => this.normalizeAsin(item?.asin) === normalizedAsin);
  }

  private setMemoryCache(key: string, data: any, expireTime: number) {
    this.memoryCache[key] = {
      data,
      expireTime: Date.now() + expireTime,
    };
  }

  /**
   * 内存缓存获取
   */
  private getMemoryCache(key: string): any {
    const cacheItem = this.memoryCache[key];
    if (!cacheItem) return null;
    if (Date.now() > cacheItem.expireTime) {
      delete this.memoryCache[key];
      return null;
    }
    return cacheItem.data;
  }

  // ========== 保留你所有原有加密方法 ==========
  /**
   * AES ECB PKCS7Padding 加密
   */
  private aesEncrypt(text: string, key: string): string {
    // 确保密钥长度为16字节（AES-128-ECB要求）
    key = key.padEnd(16, "0").slice(0, 16);
    const cipher = crypto.createCipheriv("aes-128-ecb", Buffer.from(key, "utf8"), null);
    cipher.setAutoPadding(true); // PKCS7Padding兼容PKCS5
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  }

  // ========== 保留你所有原有登录方法 ==========
  /**
   * 领星登录获取headers
   */
  async login(): Promise<Record<string, string>> {
    try {
      await this.init();
      // 1. 获取加密密钥
      const secretRes = await axios.post(
        `${this.lx_crawler_host}/newadmin/api/passport/getLoginSecretKey`,
        {},
        { headers: this.getBaseHeaders() }
      );
      // console.log("密钥接口返回数据：", JSON.stringify(secretRes.data, null, 2));

      const secretData = secretRes.data;
      const secretKey = secretData?.data?.secretKey || "";
      const secretId = secretData?.data?.secretId || "";

      if (!secretKey || !secretId) {
        throw new Error("获取加密密钥失败");
      }

      // 2. 加密密码
      const encryptPwd = this.aesEncrypt(this.lx_password, secretKey);

      // 3. 登录请求
      const loginBody = {
        account: this.lx_account,
        pwd: encryptPwd,
        verify_code: "",
        uuid: "3163d8ae-865a-45d9-9e5d-24b7e7fd4bcc",
        auto_login: 1,
        sensorsAnonymousId: "18de9d1274fa38-09c3440e53dbc28-26001b51-2073600-18de9d12750fcb",
        secretId: secretId,
      };

      const loginRes = await axios.post(
        `${this.lx_crawler_host}/newadmin/api/passport/login`,
        loginBody,
        { headers: this.getBaseHeaders() }
      );
      console.log("登录接口返回数据：", JSON.stringify(loginRes.data, null, 2));
      const loginData = loginRes.data;
      const token = loginData?.token || "";
      const uid = loginData?.uid || "";
      const zid = loginData?.zid || "";
      const companyId = loginData?.companyId || "";
      const envKey = loginData?.envKey || "SAAS-41";

      if (!token) {
        throw new Error("登录失败，未获取到token");
      }

      // 4. 组装headers
      const headerMap: Record<string, string> = {
        "ak-client-type": "web",
        "sec-ch-ua": " \"Not)A;Brand\";v=\"99\", \"Google Chrome\";v=\"127\", \"Chromium\";v=\"127\"",
        "x-ak-platform": "1",
        "x-ak-zid": zid,
        "x-ak-uid": uid,
        "x-ak-company-id": companyId,
        "sec-ch-ua-platform": " \"Windows\"",
        "x-ak-request-id": "ec3e44c8-97a2-40c1-abd1-9524207f471c",
        "x-ak-request-source": "erp",
        "x-ak-version": "3.4.7.3.0.030",
        "x-ak-env-key": envKey,
        "sec-ch-ua-mobile": "?0",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "content-type": "application/json;charset=UTF-8",
        accept: "application/json, text/plain, */*",
        "auth-token": token,
        "ak-origin": "https://erp.lingxing.com",
        origin: "https://erp.lingxing.com",
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        referer: "https://erp.lingxing.com/",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "zh-CN,zh;q=0.9",
        priority: "u=1, i",
      };

      // 缓存到内存
      this.setMemoryCache(CacheConstants.LING_XING_CRAWLER_HEADERS, headerMap, this.HEADER_EXPIRE_TIME);
      return headerMap;
    } catch (error) {
      console.error("领星登录失败：", error);
      throw error;
    }
  }

  // ========== 保留你所有原有基础请求头方法 ==========
  /**
   * 获取基础请求头
   */
  private getBaseHeaders(): Record<string, string> {
    return {
      "sec-ch-ua": " \"Not)A;Brand\";v=\"99\", \"Google Chrome\";v=\"127\", \"Chromium\";v=\"127\"",
      "x-ak-request-id": "caa32594-4d81-4a82-9e33-52a1604b62e0",
      "x-ak-request-source": "erp",
      "sec-ch-ua-platform": " \"Windows\"",
      "x-ak-version": "AKVERSIONNUM",
      "sec-ch-ua-mobile": "?0",
      "x-ak-zid": " ",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      accept: "application/json, text/plain, */*",
      "auth-token": " ",
      "ak-origin": "https://erp.lingxing.com",
      origin: "https://erp.lingxing.com",
      "sec-fetch-site": "cross-site",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
      referer: "https://erp.lingxing.com/",
      "accept-encoding": "gzip, deflate, br, zstd",
      "accept-language": "zh-CN,zh;q=0.9",
      priority: "u=1, i",
    };
  }

  // ========== 保留你所有原有获取缓存headers方法 ==========
  /**
   * 获取缓存的headers
   */
  async getCrawlerHeaders(forceRefresh: boolean = false): Promise<Record<string, string>> {
    if (!forceRefresh) {
      const cachedHeaders = this.getMemoryCache(CacheConstants.LING_XING_CRAWLER_HEADERS);
      if (cachedHeaders) {
        return cachedHeaders;
      }
    }

    // 增加重试机制，防止首次启动时因网络波动等原因导致登录失败
    let lastError: any;
    for (let i = 0; i < 3; i++) {
      try {
        return await this.login();
      } catch (error) {
        console.warn(`[getCrawlerHeaders] 登录失败，第 ${i + 1} 次重试...`, error);
        lastError = error;
        // 等待 1s, 2s, ...
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
      }
    }
    throw lastError || new Error("领星登录连续失败3次");
  }

  /**
   * 爬虫GET请求封装（自动处理token失效）
   */
  async crawlerHttpGet(url: string, params: any = {}, timeout: number = 60000): Promise<any> {
    let headers = await this.getCrawlerHeaders();
    try {
      console.log(`[crawlerHttpGet] Requesting: ${url}`);
      const res = await axios.get(url, { params, headers, timeout });
      
      // 检查code: -2 (通常是未登录或token失效)
      if (res.data && (res.data.code === -2 || res.data.code === "-2")) {
        console.warn(`[crawlerHttpGet] Got code -2, refreshing headers and retrying... URL: ${url}`);
        headers = await this.getCrawlerHeaders(true);
        const retryRes = await axios.get(url, { params, headers, timeout });
        return retryRes;
      }
      return res;
    } catch (error) {
      console.error(`[crawlerHttpGet] Request failed: ${url}`, error);
      throw error;
    }
  }

  /**
   * 爬虫POST请求封装（自动处理token失效）
   */
  async crawlerHttpPost(url: string, data: any, timeout: number = 60000): Promise<any> {
    let headers = await this.getCrawlerHeaders();
    try {
      console.log(`[crawlerHttpPost] Requesting: ${url}`);
      const res = await axios.post(url, data, { headers, timeout });
      
      // 检查code: -2 (通常是未登录或token失效)
      if (res.data && (res.data.code === -2 || res.data.code === "-2")) {
        console.warn(`[crawlerHttpPost] Got code -2, refreshing headers and retrying... URL: ${url}`);
        headers = await this.getCrawlerHeaders(true);
        const retryRes = await axios.post(url, data, { headers, timeout });
        return retryRes;
      }
      return res;
    } catch (error) {
      console.error(`[crawlerHttpPost] Request failed: ${url}`, error);
      throw error;
    }
  }

  // ========== 保留你所有原有获取单页Listing方法 ==========
  /**
   * 获取单页Listing数据
   */
  async getListing(
    requestBody: Record<string, any>
  ): Promise<string> {
    try {
      // 使用 crawlerHttpPost 自动处理 token 失效
      const res = await this.crawlerHttpPost(
        `${this.lx_crawler_host}/listing-api/api/product/showOnline`,
        requestBody
      );
      return JSON.stringify(res.data);
    } catch (error) {
      console.error("获取Listing单页失败：", error);
      throw error;
    }
  }

  // ========== 保留你所有原有批量获取Listing方法 ==========
  /**
   * 分批并发获取Listing数据（原生实现，无asyncPool）
   */
  async requestLingXingListing(): Promise<Array<Record<string, any>>> {
    if (await this.getLingxingDataFetchMode() === 2) {
      return this.requestLingXingListingByOpenApi();
    }

    try {
      // 1. (已移除显式获取headers，由getListing内部自动处理)

      // 2. 首次请求获取总页数
      const firstBody = {
        offset: 0,
        length: this.PAGE_SIZE,
        search_field: "local_name",
        exact_search: 1,
        sids: "",
        status: "",
        is_delete: 0,
        is_pair: "",
        fulfillment_channel_type: "",
        global_tag_ids: "",
        pvi_ids:"",
        req_time_sequence: "/listing-api/api/product/showOnline$$1",
      };

      const firstResult = await this.getListing(firstBody);
      const firstData = JSON.parse(firstResult);

      if (firstData.code !== 1) {
        throw new Error(`首次请求失败：${JSON.stringify(firstData)}`);
      }

      const total = firstData.data?.total || 0;
      const pageMax = Math.ceil(total / this.PAGE_SIZE);
      console.log(`领星Listing总数：${total}，总页数：${pageMax}`);

      if (pageMax === 0) {
        return [];
      }

      // 3. 构建所有分页请求体
      const requestBodies = Array.from({ length: pageMax }, (_, i) => ({
        offset: i * this.PAGE_SIZE,
        length: this.PAGE_SIZE,
        search_field: "local_name",
        exact_search: 1,
        sids: "",
        status: "",
        is_delete: 0,
        is_pair: "",
        fulfillment_channel_type: "",
        global_tag_ids: "",
        req_time_sequence: "/listing-api/api/product/showOnline$$1",
        pageIndex: i + 1, // 记录页码，方便日志
      }));

      // 4. 原生分批并发请求（替代asyncPool）
      const allResults: Array<Record<string, any>> = [];
      // 分批次处理，每批次最多CONCURRENT_LIMIT个请求
      for (let i = 0; i < requestBodies.length; i += this.CONCURRENT_LIMIT) {
        // 截取当前批次的请求体
        const batch = requestBodies.slice(i, i + this.CONCURRENT_LIMIT);
        // 构建当前批次的请求Promise
        const batchPromises = batch.map(async (body) => {
          // 间隔500ms，避免请求过快
          await new Promise(resolve => setTimeout(resolve, this.REQUEST_INTERVAL));
          console.log(`正在请求第${body.pageIndex}/${pageMax}页`);
          const result = await this.getListing(body);
          const parseResult = JSON.parse(result);
          return parseResult.data?.list || [];
        });
        // 执行当前批次
        const batchResults = await Promise.all(batchPromises);
        // 收集数据
        batchResults.forEach(res => {
          allResults.push(...res);
        });
      }

      const activeResults = allResults.filter(item => shouldPersistLingxingListing(item));
      console.log(`[LingXing Listing] fetched=${activeResults.length}`);
      return activeResults;
    } catch (error) {
      console.error("批量获取Listing失败：", error);
      throw error;
    }
  }

  async requestLingXingListingByAsin(asin: string): Promise<Array<Record<string, any>>> {
    const normalizedAsin = this.normalizeAsin(asin);
    if (!normalizedAsin) {
      throw new Error("ASIN不能为空");
    }
    if (await this.getLingxingDataFetchMode() === 2) {
      return this.requestLingXingListingByAsinOpenApi(normalizedAsin);
    }

    const buildBody = (offset: number) => ({
      offset,
      length: this.PAGE_SIZE,
      search_field: "asin",
      search_value: normalizedAsin,
      exact_search: 1,
      sids: "",
      status: "",
      is_delete: 0,
      is_pair: "",
      fulfillment_channel_type: "",
      global_tag_ids: "",
      pvi_ids: "",
      req_time_sequence: "/listing-api/api/product/showOnline$$1",
    });

    const firstResult = await this.getListing(buildBody(0));
    const firstData = JSON.parse(firstResult);
    if (firstData.code !== 1) {
      throw new Error(`[LingXing Listing] ASIN request failed: ${JSON.stringify(firstData)}`);
    }

    const firstRows = firstData.data?.list || [];
    const total = Number(firstData.data?.total ?? firstRows.length ?? 0);
    const pageMax = Math.ceil((Number.isFinite(total) ? total : firstRows.length) / this.PAGE_SIZE);
    const allResults = this.filterListingRowsByAsin(firstRows, normalizedAsin);

    for (let pageIndex = 2; pageIndex <= pageMax; pageIndex++) {
      await this.sleep(this.REQUEST_INTERVAL);
      const result = await this.getListing(buildBody((pageIndex - 1) * this.PAGE_SIZE));
      const parsed = JSON.parse(result);
      if (parsed.code !== 1) {
        throw new Error(`[LingXing Listing] ASIN page request failed page=${pageIndex}: ${JSON.stringify(parsed)}`);
      }
      allResults.push(...this.filterListingRowsByAsin(parsed.data?.list || [], normalizedAsin));
    }

    return allResults;
  }

  // ========== 保留你所有原有解析Listing方法 ==========
  /**
   * 解析领星数据到实体
   * @param rawData 领星原始数据
   */
  private async requestLingXingListingByOpenApi(): Promise<Array<Record<string, any>>> {
    try {
      const { sidList, sellerMap } = await this.getOpenApiSellerContext();
      if (sidList.length === 0) {
        console.warn("[LingXing OpenAPI Listing] No seller sid found.");
        return [];
      }

      const allResults: Array<Record<string, any>> = [];

      for (const sid of sidList) {
        const firstBody = {
          sid,
          offset: 0,
          length: this.OPEN_API_LISTING_PAGE_SIZE,
        };
        const firstResult: any = await this.httpPost("/erp/sc/data/mws/listing", firstBody, true);
        if (!this.isOpenApiSuccess(firstResult)) {
          throw new Error(`[LingXing OpenAPI Listing] First request failed sid=${sid}: ${JSON.stringify(firstResult)}`);
        }

        const firstRows = this.extractOpenApiRows(firstResult);
        const total = this.extractOpenApiTotal(firstResult, firstRows.length);
        const pageMax = Math.ceil(total / this.OPEN_API_LISTING_PAGE_SIZE);
        allResults.push(...firstRows);

        console.log(`[LingXing OpenAPI Listing] sid=${sid}, total=${total}, pages=${pageMax}`);
        for (let pageIndex = 2; pageIndex <= pageMax; pageIndex++) {
          await this.sleep(this.REQUEST_INTERVAL);
          const body = {
            sid,
            offset: (pageIndex - 1) * this.OPEN_API_LISTING_PAGE_SIZE,
            length: this.OPEN_API_LISTING_PAGE_SIZE,
          };
          console.log(`[LingXing OpenAPI Listing] sid=${sid}, requesting page ${pageIndex}/${pageMax}`);
          const result: any = await this.httpPost("/erp/sc/data/mws/listing", body, true);
          if (!this.isOpenApiSuccess(result)) {
            throw new Error(`[LingXing OpenAPI Listing] Page ${pageIndex} failed sid=${sid}: ${JSON.stringify(result)}`);
          }
          allResults.push(...this.extractOpenApiRows(result));
        }
        await this.sleep(this.REQUEST_INTERVAL);
      }

      const normalized = allResults
        .filter(item => shouldPersistLingxingListing(item))
        .map(item => normalizeLingxingListingOpenApiItem(item, sellerMap));
      console.log(`[LingXing OpenAPI Listing] fetched=${normalized.length}`);
      return normalized;
    } catch (error) {
      console.error("[LingXing OpenAPI Listing] Failed.", error);
      throw error;
    }
  }

  private async requestLingXingListingByAsinOpenApi(asin: string): Promise<Array<Record<string, any>>> {
    const normalizedAsin = this.normalizeAsin(asin);
    const { sidList, sellerMap } = await this.getOpenApiSellerContext();
    const allResults: Array<Record<string, any>> = [];

    const buildBody = (sid: number, offset: number) => ({
      sid,
      offset,
      length: this.OPEN_API_LISTING_PAGE_SIZE,
      asin: normalizedAsin,
      search_field: "asin",
      search_value: normalizedAsin,
    });

    for (const sid of sidList) {
      const firstResult: any = await this.httpPost("/erp/sc/data/mws/listing", buildBody(sid, 0), true);
      if (!this.isOpenApiSuccess(firstResult)) {
        throw new Error(`[LingXing OpenAPI Listing] ASIN request failed sid=${sid}: ${JSON.stringify(firstResult)}`);
      }

      const firstRows = this.extractOpenApiRows(firstResult);
      const total = this.extractOpenApiTotal(firstResult, firstRows.length);
      const pageMax = Math.ceil(total / this.OPEN_API_LISTING_PAGE_SIZE);
      allResults.push(...firstRows);

      for (let pageIndex = 2; pageIndex <= pageMax; pageIndex++) {
        await this.sleep(this.REQUEST_INTERVAL);
        const result: any = await this.httpPost(
          "/erp/sc/data/mws/listing",
          buildBody(sid, (pageIndex - 1) * this.OPEN_API_LISTING_PAGE_SIZE),
          true
        );
        if (!this.isOpenApiSuccess(result)) {
          throw new Error(`[LingXing OpenAPI Listing] ASIN page request failed sid=${sid}, page=${pageIndex}: ${JSON.stringify(result)}`);
        }
        allResults.push(...this.extractOpenApiRows(result));
      }
      await this.sleep(this.REQUEST_INTERVAL);
    }

    return this.filterListingRowsByAsin(
      allResults.map(item => normalizeLingxingListingOpenApiItem(item, sellerMap)),
      normalizedAsin
    );
  }

  parseListingData(rawData: Record<string, any>): AppAmzBsrProductListingLingxingEntity {
    const entity = new AppAmzBsrProductListingLingxingEntity();
    const today = dayjs().toDate();
    
    // 1. 基础字段映射（字符串转数字/日期）
    entity.lingxing_id = rawData.id ? Number(rawData.id) : null;
    entity.store_id = rawData.store_id ? Number(rawData.store_id) : 0;
    entity.msku = (rawData.msku || "").trim();
    entity.asin = (rawData.asin || "").trim();
    entity.item_name = rawData.item_name || "";
    entity.status = rawData.status ? Number(rawData.status) : 0;
    entity.open_date = rawData.open_date || "";
    entity.remark = rawData.remark || "";
    entity.price = rawData.price ? Number(rawData.price) : 0;
    entity.fulfillment_channel_type = rawData.fulfillment_channel_type || "";
    entity.quantity = rawData.quantity ? Number(rawData.quantity) : 0;
    entity.on_sale_time = rawData.on_sale_time ? rawData.on_sale_time : dayjs(today).format('YYYY-MM-DD HH:mm:ss');
    entity.item_condition = rawData.item_condition ? Number(rawData.item_condition) : 0;
    entity.is_delete = rawData.is_delete || "";
    entity.marketplace_id = rawData.marketplace_id || "";
    entity.id_hash = rawData.id_hash || "";
    entity.amz_product_id_type = rawData.amz_product_id_type || "";
    entity.amz_product_type = rawData.amz_product_type || "";
    entity.store_type = rawData.store_type || "";
    entity.product_relation_id = rawData.product_relation_id || "";
    entity.product_id = rawData.product_id ? Number(rawData.product_id) : 0;
    entity.local_sku = rawData.local_sku || "";
    entity.local_name = rawData.local_name || "";
    entity.category_id = rawData.category_id ? Number(rawData.category_id) : 0;
    entity.brand_id = rawData.brand_id ? Number(rawData.brand_id) : 0;
    entity.rule_unique_id = rawData.rule_unique_id || "";
    entity.parent_asin = rawData.parent_asin || "";
    entity.seller_rank = rawData.seller_rank ? Number(rawData.seller_rank) : 0;
    // 数组转JSON字符串
    entity.seller_category = rawData.seller_category || [];
    entity.seller_brand = rawData.seller_brand || "";
    // 字符串JSON转对象再转JSON（确保格式正确）
    entity.variant = rawData.variant || "";
    entity.total_volume = rawData.total_volume ? Number(rawData.total_volume) : 0;
    entity.yesterday_volume = rawData.yesterday_volume ? Number(rawData.yesterday_volume) : 0;
    entity.fourteen_volume = rawData.fourteen_volume ? Number(rawData.fourteen_volume) : 0;
    entity.thirty_volume = rawData.thirty_volume ? Number(rawData.thirty_volume) : 0;
    entity.yesterday_amount = rawData.yesterday_amount ? Number(rawData.yesterday_amount) : 0;
    entity.seven_amount = rawData.seven_amount ? Number(rawData.seven_amount) : 0;
    entity.fourteen_amount = rawData.fourteen_amount ? Number(rawData.fourteen_amount) : 0;
    entity.thirty_amount = rawData.thirty_amount ? Number(rawData.thirty_amount) : 0;
    entity.average_seven_volume = rawData.average_seven_volume ? Number(rawData.average_seven_volume) : null;
    entity.average_fourteen_volume = rawData.average_fourteen_volume ? Number(rawData.average_fourteen_volume) : null;
    entity.average_thirty_volume = rawData.average_thirty_volume ? Number(rawData.average_thirty_volume) : null;
    entity.fba_fee = rawData.fba_fee ? Number(rawData.fba_fee) : null;
    entity.referral_fee = rawData.referral_fee ? Number(rawData.referral_fee) : null;
    entity.landed_price = rawData.landed_price ? Number(rawData.landed_price) : null;
    entity.listing_price = rawData.listing_price ? Number(rawData.listing_price) : null;
    entity.regular_price = rawData.regular_price ? Number(rawData.regular_price) : null;
    entity.points = rawData.points || "";
    entity.shipping = rawData.shipping ? Number(rawData.shipping) : null;
    entity.fba_fee_currency_code = rawData.fba_fee_currency_code || "";
    entity.referral_fee_currency_code = rawData.referral_fee_currency_code || "";
    entity.landed_price_currency_code = rawData.landed_price_currency_code || "";
    entity.listing_price_currency_code = rawData.listing_price_currency_code || "";
    entity.regular_price_currency_code = rawData.regular_price_currency_code || "";
    entity.shipping_currency_code = rawData.shipping_currency_code || "";
    entity.yesterday_spend = rawData.yesterday_spend ? Number(rawData.yesterday_spend) : null;
    entity.seven_spend = rawData.seven_spend ? Number(rawData.seven_spend) : null;
    entity.fourteen_spend = rawData.fourteen_spend ? Number(rawData.fourteen_spend) : null;
    entity.thirty_spend = rawData.thirty_spend ? Number(rawData.thirty_spend) : null;
    entity.amz_product_id = rawData.amz_product_id || "";
    entity.afn_fulfillable_quantity = rawData.afn_fulfillable_quantity ? Number(rawData.afn_fulfillable_quantity) : 0;
    entity.reserved_fc_transfers = rawData.reserved_fc_transfers ? Number(rawData.reserved_fc_transfers) : 0;
    entity.reserved_fc_processing = rawData.reserved_fc_processing ? Number(rawData.reserved_fc_processing) : 0;
    entity.reserved_customerorders = rawData.reserved_customerorders ? Number(rawData.reserved_customerorders) : 0;
    entity.afn_inbound_shipped_quantity = rawData.afn_inbound_shipped_quantity ? Number(rawData.afn_inbound_shipped_quantity) : 0;
    entity.afn_unsellable_quantity = rawData.afn_unsellable_quantity ? Number(rawData.afn_unsellable_quantity) : 0;
    entity.afn_inbound_working_quantity = rawData.afn_inbound_working_quantity ? Number(rawData.afn_inbound_working_quantity) : 0;
    entity.fnsku = rawData.fnsku || "";
    entity.afn_inbound_receiving_quantity = rawData.afn_inbound_receiving_quantity ? Number(rawData.afn_inbound_receiving_quantity) : 0;
    // 2026-03-17 评分和Rating总数也保存15天的数据
    // (解析逻辑已移至底部与rank保持一致)
    entity.is_pair = rawData.is_pair ? Number(rawData.is_pair) : 0;
    entity.is_es = rawData.is_es ? Number(rawData.is_es) : 0; 
    entity.pair_type = rawData.pair_type || "";
    entity.shop = rawData.shop || "";
    entity.currency_symbol = rawData.currency_symbol || "";
    entity.mid = rawData.mid ? Number(rawData.mid) : 0;
    entity.category_text = rawData.category_text || "";
    entity.product_brand_text = rawData.product_brand_text || "";
    entity.status_text = rawData.status_text || "";
    entity.marketplace = (rawData.marketplace || "").trim();
    entity.seller_name = (rawData.seller_name || "").trim();
    entity.asin_url = rawData.asin_url || "";
    entity.icon = rawData.icon || "";
    entity.principal_realname = rawData.principal_realname || "";
    entity.principal_list = rawData.principal_list || [];
    entity.principal_uids = rawData.principal_uids || [];
    entity.fba_fee_currency_icon = rawData.fba_fee_currency_icon || "";
    entity.referral_fee_currency_icon = rawData.referral_fee_currency_icon || "";
    entity.listing_price_currency_icon = rawData.listing_price_currency_icon || "";
    
    // 获取数据时，默认设置近30天销量为往期规则
    entity.rule_nearly_30_days = 'nearly';

    entity.landed_price_currency_icon = rawData.landed_price_currency_icon || "";
    entity.shipping_currency_icon = rawData.shipping_currency_icon || "";
    entity.regular_price_currency_icon = rawData.regular_price_currency_icon || "";
    entity.variant_text = rawData.variant_text || [];
    entity.product_type = rawData.product_type ? Number(rawData.product_type) : 0;
    entity.first_order_time = rawData.first_order_time ? dayjs(rawData.first_order_time).toDate() : null;
    entity.amz_product_id_type_text = rawData.amz_product_id_type_text || "";
    entity.b2b_price = rawData.b2b_price || "";
    entity.list_price = rawData.list_price ? Number(rawData.list_price) : 0;

    let image_url = "";
    if(rawData.small_image_url){
      image_url = rawData.small_image_url.replaceAll("_SL(\\d+)_","_SL"+"1000"+"_");
    }

    entity.image_url = image_url;
    if (entity.local_name) {
      // 分割localName，取第一个下划线前的部分并去空格
      const productCode = entity.local_name.split("_")[0]?.trim() || "";
      // 正则匹配是否为纯数字（对齐Java的ReUtil.isMatch("(\\d+)", productCode)）
      const isDigital = /^\d+$/.test(productCode);
      // 非空且纯数字时赋值productCode
      if (productCode && isDigital) {
        entity.product_code = productCode;
        // mergeId默认等于productCode，后续可单独修改
        entity.mergeId = productCode;
      } else {
        entity.product_code = null;
        entity.mergeId = null;
      }
    } else {
      entity.product_code = null;
      entity.mergeId = null;
    }
    // 2. 解析open_date_time（处理时区）
    if (rawData.open_date_time) { 
      try {
        // 处理带时区的日期字符串：2024-11-07 08:22:05 +00:00
        entity.open_date_time = dayjs(rawData.open_date_time).toDate();
      } catch (e) {
        console.warn(`解析open_date_time失败: ${rawData.open_date_time}`, e);
        entity.open_date_time = null;
      }
    }

    // 3. 业务逻辑：上架时间小于90天标记产品状态
    if (entity.open_date_time) {
      const daysDiff = dayjs().diff(dayjs(entity.open_date_time), 'day');
      if (daysDiff < 90) {
        entity.product_state = ProductState.OPEN_SALE_LESS_THAN_90_DAYS;
      }
    }

    // 4. 计算总库存
    // 计算总库存
    const quantitySum = 
    entity.afn_fulfillable_quantity +
    entity.reserved_fc_transfers +
    entity.reserved_fc_processing +
    entity.reserved_customerorders +
    entity.afn_inbound_shipped_quantity +
    entity.afn_unsellable_quantity +
    entity.afn_inbound_working_quantity +
    entity.afn_inbound_receiving_quantity;

    // Modified logic based on user request:
    // Abnormal Offline: 1. FBA sellable inventory > 0 AND 2. Status is STOP_SALE
    if (entity.afn_fulfillable_quantity > 0 && entity.status === ListingStatus.STOP_SALE) {
       entity.abnormalOfflineStatus = AbnormalOfflineStatus.ABNORMAL_OFFLINE;
       // If it was not abnormal offline before, set start time
       if (rawData.abnormalOfflineStatus !== AbnormalOfflineStatus.ABNORMAL_OFFLINE) {
          entity.abnormalOfflineStartTime = new Date();
       } else {
          // Keep original start time
          entity.abnormalOfflineStartTime = rawData.abnormalOfflineStartTime || new Date();
       }
       entity.abnormalOfflineRecoveryTime = null;
    } else {
       // If it was abnormal offline before, record recovery
       if (rawData.abnormalOfflineStatus === AbnormalOfflineStatus.ABNORMAL_OFFLINE) {
          entity.abnormalOfflineStatus = AbnormalOfflineStatus.NORMAL;
          entity.abnormalOfflineRecoveryTime = new Date();
       } else {
          entity.abnormalOfflineStatus = AbnormalOfflineStatus.NORMAL;
          entity.abnormalOfflineRecoveryTime = null;
       }
       entity.abnormalOfflineStartTime = null;
    }

    // 获取上一次的库存数据（需要在服务层传递）
    const lastQuantitySum = rawData.lastQuantitySum || 0;
    const lastOutOfStockStatus = rawData.lastOutOfStockStatus || 0;
    const lastOutOfStockStartTime = rawData.lastOutOfStockStartTime ? new Date(rawData.lastOutOfStockStartTime) : null;

    // 断货状态判断逻辑
    // 2025-01-21 修改：逻辑已迁移至 updateInventoryStatus 方法中计算
    // 因为这里拿不到准确的 salesAvg30 (需要从 restocking 接口获取)
    entity.outOfStockStatus = OutOfStockStatus.NORMAL;
    entity.outOfStockStartTime = null;

    // 5. 设置过滤类型
    if (entity.afn_fulfillable_quantity > 0) {
      entity.filter_type = ListingFilterType.QUANTITY_SUM_NOT_ZERO;
    } else {
      entity.filter_type = ListingFilterType.OTHER;
    }

    // 6. 计算priceTarget（取listingPrice和price中较低的非0值）
    const priceList = [entity.listing_price, entity.price].filter(p => p > 0);
    if (priceList.length > 0) {
      // 需给实体新增price_target字段
      entity.price_target = Math.min(...priceList);
    } else {
      entity.price_target = 0;
    }
    // 8. 计算在售天数
    if (quantitySum > 0 && entity.status === ListingStatus.ON_SALE) {
      // 计算最近恢复时间（取异常下架恢复时间和断货结束时间中较近的一个）
      let recoveryDate = null;
      
      // 如果有异常下架恢复时间
      if (entity.abnormalOfflineRecoveryTime) {
        recoveryDate = dayjs(entity.abnormalOfflineRecoveryTime);
      }
      
      // 如果有断货结束时间（即outOfStockStatus从1变为0）
      if (lastOutOfStockStatus === OutOfStockStatus.OUT_OF_STOCK && 
          entity.outOfStockStatus === OutOfStockStatus.NORMAL) {
        const stockRecoveryDate = dayjs(entity.updateTime);
        if (!recoveryDate || stockRecoveryDate.isAfter(recoveryDate)) {
          recoveryDate = stockRecoveryDate;
        }
      }
      
      // 计算在售天数
      if (recoveryDate) {
        entity.onSaleDays = dayjs().diff(recoveryDate, 'day');
      } else if (entity.open_date_time) {
        // 如果没有恢复时间，则从上架时间开始计算
        entity.onSaleDays = dayjs().diff(dayjs(entity.open_date_time), 'day');
      } else {
        entity.onSaleDays = 0;
      }
    } else {
      entity.onSaleDays = 0;
    }
     // 9. 更新排名数组（大类排名）
     const newRankValue = rawData.rank ? Number(rawData.rank) : 0;
     // 新值插入第一位，截断超过15位的数据
     const existingRankArray = (Array.isArray(rawData.lastRank) ? rawData.lastRank : null) || [];
     entity.rank = [newRankValue, ...existingRankArray].slice(0, 15);

     // 10. 更新小排名数组
     const newSmallRankValue = this.extractSmallRankValue(rawData.small_rank);
     const existingSmallRankArray = (Array.isArray(rawData.lastSmallRank) ? rawData.lastSmallRank : null) || [];
     entity.small_rank = [newSmallRankValue, ...existingSmallRankArray].slice(0, 15);

     // 11. 更新评分和评论数数组
     const newStarsValue = rawData.stars ? Number(rawData.stars) : 0;
     const existingStarsArray = (Array.isArray(rawData.lastStars) ? rawData.lastStars : null) || [];
     entity.stars = [newStarsValue, ...existingStarsArray].slice(0, 15);

     const newReviewsNumValue = rawData.reviews_num ? Number(rawData.reviews_num) : 0;
     const existingReviewsNumArray = (Array.isArray(rawData.lastReviewsNum) ? rawData.lastReviewsNum : null) || [];
     entity.reviews_num = [newReviewsNumValue, ...existingReviewsNumArray].slice(0, 15);
 
    // 9. 设置创建/更新时间
    entity.createTime = today;
    entity.updateTime = today;
    

    return entity;
  }
  
  private extractSmallRankValue(smallRank: any): number {
    if (!smallRank) return 0;
    
    try {
      // 处理JSON字符串或对象
      const rankObj = typeof smallRank === 'string' ? JSON.parse(smallRank) : smallRank;
      // 提取第一个排名数值
      if (Array.isArray(rankObj) && rankObj.length > 0) {
        return Number(rankObj[0]?.rank || 0);
      }
      return Number(rankObj?.rank || 0);
    } catch (e) {
      console.warn('解析小排名失败:', smallRank, e);
      return 0;
    }
  }

  // ========== 保留你所有原有OpenAPI相关方法 ==========
  async getAccessToken(forceRefresh: boolean = false) {
    if (
      forceRefresh ||
      !this.lx_access_token ||
      this.lx_token_expiration - Date.now() < 1000 * 60 * 10
    ) {
      let response_data = await generateAccessToken(
        this.lx_app_id,
        this.lx_app_secret,
        this.lx_api_host
      );

      if (response_data.access_token) {
        this.lx_access_token = response_data.access_token;
        this.lx_token_expiration = Date.now() + response_data.expires_in * 1000;

        const param_access_token = await this.baseSysParamRepo.findOne({ where: { keyName: "access_token" } });
        const param_token_expiration = await this.baseSysParamRepo.findOne({ where: { keyName: "token_expiration" } });

        if (param_access_token) {
          param_access_token.data = response_data.access_token;
          await this.baseSysParamRepo.save(param_access_token);
        } else {
          await this.baseSysParamRepo.insert({
            keyName: "access_token",
            data: response_data.access_token,
            dataType: 0,
          });
        }

        if (param_token_expiration) {
          param_token_expiration.data = String(this.lx_token_expiration);
          await this.baseSysParamRepo.save(param_token_expiration);
        } else {
          await this.baseSysParamRepo.insert({
            keyName: "token_expiration",
            data: String(this.lx_token_expiration),
            dataType: 0,
          });
        }
      } else {
        // console.log("Fail to get Access Token from LingXing!");
      }
    } else {
      // 2026-04-01: 注释调试日志，避免控制台刷屏
      // console.log("access_token still available.");
    }
  }

  checkIfTokenNotMatch(resData: Object | any) {
    if (resData && "throwable" in resData) {
      if (typeof resData.throwable === "string") {
        if (resData.throwable.indexOf("access token not match") >= 0) {
          console.log("access_token NOT match, should try to refresh..");
          return true;
        }
      }
    }
    return false;
  }

  async httpDo(
    method: string = "get",
    apiPath: string,
    params: Object,
    return_raw_response: boolean = false
  ) {
    await this.init();
    await this.getAccessToken();

    let result = await httpRequest(
      apiPath,
      method,
      this.lx_app_id,
      this.lx_access_token,
      params,
      this.lx_api_host,
      return_raw_response
    );

    if (this.checkIfTokenNotMatch(return_raw_response ? result.data : result)) {
      await this.getAccessToken(true);
      result = await httpRequest(
        apiPath,
        method,
        this.lx_app_id,
        this.lx_access_token,
        params,
        this.lx_api_host,
        return_raw_response
      );
    }

    return result;
  }

  async httpGet(apiPath: string, params: Object, return_raw_response: boolean = false) {
    return await this.httpDo("get", apiPath, params, return_raw_response);
  }

  async httpPost(apiPath: string, params: Object, return_raw_response: boolean = false) {
    return await this.httpDo("post", apiPath, params, return_raw_response);
  }

  // ========== FBA库存详情请求方法 ==========
  async getFbaValidList(hashId: string): Promise<FbaValidItem[]> {
    try {
      const res = await this.crawlerHttpPost(`${this.lx_crawler_host}/sc/restocking-center/amazon/source/fbaValidList`, {
        analysisMode: 1,
        dataType: 1,
        hashId: hashId,
        req_time_sequence: "/sc/restocking-center/amazon/source/fbaValidList$$1"
      });

      const result = res.data;
      if (result.code !== 1) {
        console.error(`获取FBA库存详情失败(hashId: ${hashId})：${JSON.stringify(result)}`);
        return [];
      }
      console.log(`[getFbaValidList] hashId: ${hashId}, count: ${result.data?.length}`);
      return result.data || [];
    } catch (error) {
      console.error(`获取FBA库存详情异常(hashId: ${hashId})：`, error);
      return [];
    }
  }

  // ========== FBA在途详情请求方法 ==========
  async getFbaShippingList(hashId: string): Promise<FbaShippingItem[]> {
    try {
      const res = await this.crawlerHttpPost(`${this.lx_crawler_host}/sc/restocking-center/amazon/source/fbaShippingList`, {
        analysisMode: 1,
        dataType: 1,
        hashId: hashId,
        req_time_sequence: "/sc/restocking-center/amazon/source/fbaShippingList$$1"
      });

      const result = res.data;
      if (result.code !== 1) {
        console.error(`获取FBA在途详情失败(hashId: ${hashId})：${JSON.stringify(result)}`);
        return [];
      }
      console.log(`[getFbaShippingList] hashId: ${hashId}, count: ${result.data?.length}`);

      // 新增shipment_status字段，默认null
      return (result.data || []).map(item => ({ ...item, shipment_status: null }));
    } catch (error) {
      console.error(`获取FBA在途详情异常(hashId: ${hashId})：`, error);
      return [];
    }
  }
  
  // ========== 本地可用请求方法 ==========
  async getLocalValidList(hashId: string): Promise<FbaValidItem[]> {
    try {
      const res = await this.crawlerHttpPost(`${this.lx_crawler_host}/sc/restocking-center/amazon/source/localValidList`, {
        analysisMode: 1,
        dataType: 1,
        hashId: hashId,
        req_time_sequence: "/sc/restocking-center/amazon/source/localValidList$$1"
      });

      const result = res.data;
      if (result.code !== 1) {
        console.error(`获取本地可用失败(hashId: ${hashId})：${JSON.stringify(result)}`);
        return [];
      }
      console.log(`[getLocalValidList] hashId: ${hashId}, count: ${result.data?.length}`);
      return result.data || [];
    } catch (error) {
      console.error(`获取本地可用异常(hashId: ${hashId})：`, error);
      return [];
    }
  }
  
  // ========== 待交付请求方法 ==========
  async getPurchaseShippingList(hashId: string): Promise<FbaValidItem[]> {
    try {
      const res = await this.crawlerHttpPost(`${this.lx_crawler_host}/sc/restocking-center/amazon/source/purchaseShippingList`, {
        analysisMode: 1,
        dataType: 1,
        hashId: hashId,
        req_time_sequence: "/sc/restocking-center/amazon/source/purchaseShippingList$$1"
      });

      const result = res.data;
      if (result.code !== 1) {
        console.error(`获取待交付失败(hashId: ${hashId})：${JSON.stringify(result)}`);
        return [];
      }
      console.log(`[getPurchaseShippingList] hashId: ${hashId}, count: ${result.data?.length}`);
      return result.data || [];
    } catch (error) {
      console.error(`获取待交付异常(hashId: ${hashId})：`, error);
      return [];
    }
  }

  
  // ========== 采购计划请求方法 ==========
  async getPurchasePlanList(hashId: string): Promise<FbaValidItem[]> {
    try {
      const res = await this.crawlerHttpPost(`${this.lx_crawler_host}/sc/restocking-center/amazon/source/purchasePlanList`, {
        analysisMode: 1,
        dataType: 1,
        hashId: hashId,
        req_time_sequence: "/sc/restocking-center/amazon/source/purchasePlanList$$1"
      });

      const result = res.data;
      if (result.code !== 1) {
        console.error(`获取采购计划失败(hashId: ${hashId})：${JSON.stringify(result)}`);
        return [];
      }
      console.log(`[getPurchasePlanList] hashId: ${hashId}, count: ${result.data?.length}`);
      return result.data || [];
    } catch (error) {
      console.error(`获取采购计划异常(hashId: ${hashId})：`, error);
      return [];
    }
  }
  
  // ========== 预计发货量请求方法 ==========
  async getFbaShippingPlanList(hashId: string): Promise<FbaValidItem[]> {
    try {
      const res = await this.crawlerHttpPost(`${this.lx_crawler_host}/sc/restocking-center/amazon/source/fbaShippingPlanList`, {
        analysisMode: 1,
        dataType: 1,
        hashId: hashId,
        req_time_sequence: "/sc/restocking-center/amazon/source/fbaShippingPlanList$$1"
      });

      const result = res.data;
      if (result.code !== 1) {
        console.error(`获取预计发货量失败(hashId: ${hashId})：${JSON.stringify(result)}`);
        return [];
      }
      console.log(`[getFbaShippingPlanList] hashId: ${hashId}, count: ${result.data?.length}`);
      return result.data || [];
    } catch (error) {
      console.error(`获取采购计划异常(hashId: ${hashId})：`, error);
      return [];
    }
  }

  // ========== 批量获取FBA详情 ==========
  async batchGetFbaDetails(restockingList: Array<Record<string, any>>): Promise<Array<Record<string, any>>> {
    // 强制转为数组，非数组则返回空数组
    const safeList = Array.isArray(restockingList) ? [...restockingList] : [];
    
    if (safeList.length === 0) {
      console.warn("补货数据为空，跳过FBA详情获取");
      return [];
    }

    // ========== 1. 统计需要处理的FBA库存/在途详情总数 ==========
    if (await this.getLingxingDataFetchMode() === 2) {
      return this.batchGetFbaDetailsByOpenApi(safeList);
    }

    const needValidCount = safeList.filter(item => {
      const hashId = item?.basicInfo?.hashId || "";
      const amazonQuantityValid = item?.amazonQuantityInfo?.amazonQuantityValid || 0;
      return !!hashId && amazonQuantityValid !== 0;
    }).length;

    const needShippingCount = safeList.filter(item => {
      const hashId = item?.basicInfo?.hashId || "";
      const amazonQuantityShipping = item?.amazonQuantityInfo?.amazonQuantityShipping || 0;
      return !!hashId && amazonQuantityShipping !== 0;
    }).length;

    const needLocalValidCount = safeList.filter(item => {
      const hashId = item?.basicInfo?.hashId || "";
      const scm = item?.scmQuantityInfo || {};
      const localValid = scm.scQuantityLocalValid || 0;
      return !!hashId && localValid !== 0;
    }).length;

    const needPurchaseShippingCount = safeList.filter(item => {
      const hashId = item?.basicInfo?.hashId || "";
      const scm = item?.scmQuantityInfo || {};
      const n = scm.scQuantityPurchaseShipping || 0;
      return !!hashId && n !== 0;
    }).length;

    const needPurchasePlanCount = safeList.filter(item => {
      const hashId = item?.basicInfo?.hashId || "";
      const scm = item?.scmQuantityInfo || {};
      const n = scm.scQuantityPurchasePlan || 0;
      return !!hashId && n !== 0;
    }).length;

    const needFbaShippingPlanCount = safeList.filter(item => {
      const hashId = item?.basicInfo?.hashId || "";
      const amazonQty = item?.amazonQuantityInfo || {};
      const n = amazonQty.fbaQuantityShippingPlan || amazonQty.amazonQuantityShippingPlan || 0;
      return !!hashId && n !== 0;
    }).length;

    // 仅打印待处理总数
    console.log(`【FBA详情处理】待处理库存详情：${needValidCount}条 | 待处理在途详情：${needShippingCount}条 | 本地可用明细：${needLocalValidCount}条 | 待交付明细：${needPurchaseShippingCount}条 | 采购计划明细：${needPurchasePlanCount}条 | 预计发货量明细：${needFbaShippingPlanCount}条`);

    // 初始化进度计数器
    let validProcessed = 0; 
    let shippingProcessed = 0;
    let localValidProcessed = 0;
    let purchaseShippingProcessed = 0;
    let purchasePlanProcessed = 0;
    let fbaShippingPlanProcessed = 0;

    // 遍历处理每条数据（跳过的完全不打印）
    for (let i = 0; i < safeList.length; i++) {
      const item = safeList[i];
      const hashId = item?.basicInfo?.hashId || "";
      const amazonQuantityValid = item?.amazonQuantityInfo?.amazonQuantityValid || 0;
      const amazonQuantityShipping = item?.amazonQuantityInfo?.amazonQuantityShipping || 0;
      const scmQty = item?.scmQuantityInfo || {};
      const amazonQty = item?.amazonQuantityInfo || {};

      // 获取FBA库存详情（仅处理时打印进度，跳过不输出）
      if (hashId && amazonQuantityValid !== 0) {
        validProcessed++;
        console.log(`FBA库存详情处理进度：${validProcessed}/${needValidCount}条`);
        item.fbaValidList = await this.getFbaValidList(hashId);
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        item.fbaValidList = []; // 跳过不打印任何内容
      }

      // 获取FBA在途详情（仅处理时打印进度，跳过不输出）
      if (hashId && amazonQuantityShipping !== 0) {
        shippingProcessed++;
        console.log(`FBA在途详情处理进度：${shippingProcessed}/${needShippingCount}条`);
        item.fbaShippingList = await this.getFbaShippingList(hashId);
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        item.fbaShippingList = []; // 跳过不打印任何内容
      }

      if (hashId && scmQty.scQuantityLocalValid !== 0) {
        localValidProcessed++;
        console.log(`本地可用明细处理进度：${localValidProcessed}/${needLocalValidCount}条`);
        const list = await this.getLocalValidList(hashId);
        item.extInfo = item.extInfo || {};
        item.extInfo.localValidDetailList = list || [];
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        if (item.extInfo) {
          item.extInfo.localValidDetailList = [];
        }
      }

      if (hashId && scmQty.scQuantityPurchaseShipping !== 0) {
        purchaseShippingProcessed++;
        console.log(`待交付明细处理进度：${purchaseShippingProcessed}/${needPurchaseShippingCount}条`);
        const list = await this.getPurchaseShippingList(hashId);
        item.extInfo = item.extInfo || {};
        item.extInfo.purchaseShippingDetailList = list || [];
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        if (item.extInfo) {
          item.extInfo.purchaseShippingDetailList = [];
        }
      }

      if (hashId && scmQty.scQuantityPurchasePlan !== 0) {
        purchasePlanProcessed++;
        console.log(`采购计划明细处理进度：${purchasePlanProcessed}/${needPurchasePlanCount}条`);
        const list = await this.getPurchasePlanList(hashId);
        item.extInfo = item.extInfo || {};
        item.extInfo.purchasePlanDetailList = list || [];
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        if (item.extInfo) {
          item.extInfo.purchasePlanDetailList = [];
        }
      }

      const fbaPlan = amazonQty.fbaQuantityShippingPlan || amazonQty.amazonQuantityShippingPlan || 0;
      if (hashId && fbaPlan !== 0) {
        fbaShippingPlanProcessed++;
        console.log(`预计发货量明细处理进度：${fbaShippingPlanProcessed}/${needFbaShippingPlanCount}条`);
        const list = await this.getFbaShippingPlanList(hashId);
        item.extInfo = item.extInfo || {};
        item.extInfo.fbaShippingPlanDetailList = list || [];
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        if (item.extInfo) {
          item.extInfo.fbaShippingPlanDetailList = [];
        }
      }
    }

    // 最终打印完成统计
    console.log(`【FBA详情处理完成】库存详情：${validProcessed}/${needValidCount}条 | 在途详情：${shippingProcessed}/${needShippingCount}条 | 本地可用明细：${localValidProcessed}/${needLocalValidCount}条 | 待交付明细：${purchaseShippingProcessed}/${needPurchaseShippingCount}条 | 采购计划明细：${purchasePlanProcessed}/${needPurchasePlanCount}条 | 预计发货量明细：${fbaShippingPlanProcessed}/${needFbaShippingPlanCount}条`);
    return safeList;
  }

  /**
   * 生成商品名关键词（用于标题对比）
   */
  private getOpenApiSourceIdentity(item: Record<string, any>) {
    const basicInfo = item?.basicInfo || {};
    const displayInfo = item?.displayInfo || {};
    const relationListing = Array.isArray(basicInfo.relationListing) ? basicInfo.relationListing : [];
    const sid = Number(basicInfo.sid ?? item.sid ?? 0);
    const dataType = Number(basicInfo.dataType ?? item.dataType ?? 1);
    const msku =
      basicInfo.msku ??
      displayInfo.msku ??
      relationListing.find((relation: any) => relation?.msku)?.msku ??
      "";
    const asin =
      basicInfo.asin ??
      displayInfo.asin ??
      (Array.isArray(displayInfo.asinList) ? displayInfo.asinList[0] : "") ??
      "";

    return { sid, dataType, asin: String(asin || "").trim(), msku: String(msku || "").trim() };
  }

  private async getOpenApiSourceList(item: Record<string, any>, type: number): Promise<Array<Record<string, any>>> {
    const identity = this.getOpenApiSourceIdentity(item);
    if (!Number.isFinite(identity.sid) || identity.sid <= 0) {
      return [];
    }

    const useMskuApi = identity.dataType === 2 && !!identity.msku;
    const apiPath = useMskuApi
      ? "/erp/sc/routing/fbaSug/msku/getSourceList"
      : "/erp/sc/routing/fbaSug/asin/getSourceList";
    const body = useMskuApi
      ? { sid: identity.sid, msku: identity.msku, type, mode: 1 }
      : { sid: identity.sid, asin: identity.asin, type, mode: 1 };

    if ((!useMskuApi && !identity.asin) || (useMskuApi && !identity.msku)) {
      return [];
    }

    try {
      const result: any = await this.httpPost(apiPath, body, true);
      if (!this.isOpenApiSuccess(result)) {
        console.warn(`[LingXing OpenAPI SourceList] failed type=${type}: ${JSON.stringify(result)}`);
        return [];
      }
      return this.extractOpenApiRows(result).map(row => normalizeLingxingSourceListItem(row));
    } catch (error) {
      console.error(`[LingXing OpenAPI SourceList] error type=${type}`, error);
      return [];
    }
  }

  private async batchGetFbaDetailsByOpenApi(
    restockingList: Array<Record<string, any>>
  ): Promise<Array<Record<string, any>>> {
    const canRequestSource = (item: Record<string, any>) => {
      const identity = this.getOpenApiSourceIdentity(item);
      return Number.isFinite(identity.sid) && identity.sid > 0 && (!!identity.asin || !!identity.msku);
    };
    const needValidCount = restockingList.filter(item =>
      canRequestSource(item) && (item?.amazonQuantityInfo?.amazonQuantityValid || 0) !== 0
    ).length;
    const needShippingCount = restockingList.filter(item =>
      canRequestSource(item) && (item?.amazonQuantityInfo?.amazonQuantityShipping || 0) !== 0
    ).length;
    const needLocalValidCount = restockingList.filter(item =>
      canRequestSource(item) && (item?.scmQuantityInfo?.scQuantityLocalValid || 0) !== 0
    ).length;
    const needPurchaseShippingCount = restockingList.filter(item =>
      canRequestSource(item) && (item?.scmQuantityInfo?.scQuantityPurchaseShipping || 0) !== 0
    ).length;
    const needPurchasePlanCount = restockingList.filter(item =>
      canRequestSource(item) && (item?.scmQuantityInfo?.scQuantityPurchasePlan || 0) !== 0
    ).length;
    const needFbaShippingPlanCount = restockingList.filter(item => {
      const amazonQty = item?.amazonQuantityInfo || {};
      const n = amazonQty.fbaQuantityShippingPlan || amazonQty.amazonQuantityShippingPlan || 0;
      return canRequestSource(item) && n !== 0;
    }).length;

    console.log(`[LingXing OpenAPI SourceList] pending fbaValid=${needValidCount}, fbaShipping=${needShippingCount}, localValid=${needLocalValidCount}, purchaseShipping=${needPurchaseShippingCount}, purchasePlan=${needPurchasePlanCount}, fbaShippingPlan=${needFbaShippingPlanCount}`);

    let validProcessed = 0;
    let shippingProcessed = 0;
    let localValidProcessed = 0;
    let purchaseShippingProcessed = 0;
    let purchasePlanProcessed = 0;
    let fbaShippingPlanProcessed = 0;

    for (const item of restockingList) {
      const amazonQty = item?.amazonQuantityInfo || {};
      const scmQty = item?.scmQuantityInfo || {};
      item.extInfo = item.extInfo || {};

      if (canRequestSource(item) && (amazonQty.amazonQuantityValid || 0) !== 0) {
        validProcessed++;
        console.log(`[LingXing OpenAPI SourceList] FBA valid ${validProcessed}/${needValidCount}`);
        item.fbaValidList = await this.getOpenApiSourceList(item, 1);
        await this.sleep(300);
      } else {
        item.fbaValidList = [];
      }

      if (canRequestSource(item) && (amazonQty.amazonQuantityShipping || 0) !== 0) {
        shippingProcessed++;
        console.log(`[LingXing OpenAPI SourceList] FBA shipping ${shippingProcessed}/${needShippingCount}`);
        item.fbaShippingList = await this.getOpenApiSourceList(item, 2);
        await this.sleep(300);
      } else {
        item.fbaShippingList = [];
      }

      if (canRequestSource(item) && (scmQty.scQuantityLocalValid || 0) !== 0) {
        localValidProcessed++;
        console.log(`[LingXing OpenAPI SourceList] local valid ${localValidProcessed}/${needLocalValidCount}`);
        item.extInfo.localValidDetailList = await this.getOpenApiSourceList(item, 3);
        await this.sleep(300);
      } else {
        item.extInfo.localValidDetailList = [];
      }

      if (canRequestSource(item) && (scmQty.scQuantityPurchaseShipping || 0) !== 0) {
        purchaseShippingProcessed++;
        console.log(`[LingXing OpenAPI SourceList] purchase shipping ${purchaseShippingProcessed}/${needPurchaseShippingCount}`);
        item.extInfo.purchaseShippingDetailList = await this.getOpenApiSourceList(item, 5);
        await this.sleep(300);
      } else {
        item.extInfo.purchaseShippingDetailList = [];
      }

      if (canRequestSource(item) && (scmQty.scQuantityPurchasePlan || 0) !== 0) {
        purchasePlanProcessed++;
        console.log(`[LingXing OpenAPI SourceList] purchase plan ${purchasePlanProcessed}/${needPurchasePlanCount}`);
        item.extInfo.purchasePlanDetailList = await this.getOpenApiSourceList(item, 6);
        await this.sleep(300);
      } else {
        item.extInfo.purchasePlanDetailList = [];
      }

      const fbaPlan = amazonQty.fbaQuantityShippingPlan || amazonQty.amazonQuantityShippingPlan || 0;
      if (canRequestSource(item) && fbaPlan !== 0) {
        fbaShippingPlanProcessed++;
        console.log(`[LingXing OpenAPI SourceList] fba shipping plan ${fbaShippingPlanProcessed}/${needFbaShippingPlanCount}`);
      }
      item.extInfo.fbaShippingPlanDetailList = [];
    }

    console.log(`[LingXing OpenAPI SourceList] done fbaValid=${validProcessed}/${needValidCount}, fbaShipping=${shippingProcessed}/${needShippingCount}, localValid=${localValidProcessed}/${needLocalValidCount}, purchaseShipping=${purchaseShippingProcessed}/${needPurchaseShippingCount}, purchasePlan=${purchasePlanProcessed}/${needPurchasePlanCount}, fbaShippingPlan=${fbaShippingPlanProcessed}/${needFbaShippingPlanCount}`);
    return restockingList;
  }

  private generateItemNameKey(itemName: string): string {
    if (!itemName || typeof itemName !== 'string') {
      return '';
    }
    let cleanedName = itemName
      .replace(/,/g, '')
      .replace(/&/g, '')
      .replace(/\./g, '')
      .replace(/"/g, '')
      .replace(/\|/g, '');
    cleanedName = cleanedName.trim();
    while (cleanedName.includes('  ')) {
      cleanedName = cleanedName.replace(/  /g, ' ');
    }
    const words = cleanedName.split(' ');
    const first6Words = words.slice(0, 6);
    return first6Words.join(' ');
  }

  // ========== 调整：原有同步方法（调用Service，保留原有返回格式） ==========
  async syncLingXingListingToDB(): Promise<{ success: boolean; count: number; message: string }> {
    const queryRunner = this.listingRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 同步Listing数据（调用Service）
      const listingCount = await this.listingService.syncListingData(queryRunner);
      const listingList = await queryRunner.manager.find(AppAmzBsrProductListingLingxingEntity, {
        where: { status: ListingStatus.ON_SALE, restock_setting_type: 0 },
      });
      await this.updateOpenDateTimeByProductCreateTime(queryRunner, listingList);
      await this.updateListingGrossProfit(queryRunner, listingList);

      // 同步多平台利润报表(MSKU)
      await this.syncProfitReportMsku(queryRunner).catch(err =>
        console.error("[syncLingXingListingToDB] syncProfitReportMsku failed:", err)
      );

      // 同步产品表现(ASIN维度)
      const sellerSids = Array.from(new Set(listingList.map(l => l.store_id).filter(sid => sid > 0)));
      await this.syncProductPerformanceAsin(queryRunner, sellerSids).catch(err =>
        console.error("[syncLingXingListingToDB] syncProductPerformanceAsin failed:", err)
      );

      // 2. 同步补货数据（调用Service）
      const traceId = dayjs().format('YYYYMMDDHHmmss') + Math.random().toString(36).substring(2, 8);
      const restockingCount = await this.restockingService.syncRestockingData(queryRunner, traceId);
      
      // 修改：使用 ASIN -> Entity[] 的映射，因为一个ASIN可能对应多个不同站点/店铺的补货记录
      const restockingMap = new Map<string, AppAmzBsrRestockingCenterLingxingEntity[]>();
      (await queryRunner.manager.find(AppAmzBsrRestockingCenterLingxingEntity, { where: { traceId } }))
        .forEach(item => {
            if (item.asin) {
                if (!restockingMap.has(item.asin)) {
                    restockingMap.set(item.asin, []);
                }
                restockingMap.get(item.asin).push(item);
            }
        });

        const updatePromises = listingList.map(async listing => {
          const candidates = restockingMap.get(listing.asin);
          let restocking: AppAmzBsrRestockingCenterLingxingEntity | null = null;

          if (candidates && candidates.length > 0) {
              // 匹配优先级：
              // 1. 站点 + 店铺 + MSKU
              // 2. 站点 + 店铺
              // 3. 站点 + MSKU
              // 4. 仅站点
              
              const marketplaceMatches = candidates.filter(r => 
                  Array.isArray(r.marketplaceList) && 
                  r.marketplaceList.includes(listing.marketplace)
              );

              if (marketplaceMatches.length > 0) {
                  const sellerName = (listing.seller_name || '').trim();
                  const msku = (listing.msku || '').trim();

                  if (sellerName && msku) {
                      restocking = marketplaceMatches.find(r => 
                          Array.isArray(r.storeList)
                          && r.storeList.some(s => s === sellerName || s.trim() === sellerName)
                          && Array.isArray(r.relationListing)
                          && r.relationListing.some(item => (item?.msku || '').trim() === msku)
                      );
                  }

                  if (!restocking && sellerName) {
                      restocking = marketplaceMatches.find(r => 
                          Array.isArray(r.storeList) && 
                          r.storeList.some(s => s === sellerName || s.trim() === sellerName)
                      );
                  }

                  if (!restocking && msku) {
                      restocking = marketplaceMatches.find(r =>
                          Array.isArray(r.relationListing)
                          && r.relationListing.some(item => (item?.msku || '').trim() === msku)
                      );
                  }
                  
                  // 如果没有匹配到更精确的条件，使用第一个站点匹配项
                  if (!restocking) {
                      restocking = marketplaceMatches[0];
                  }
              }
          }

          if (restocking) {
            // 更新 Listing 状态逻辑 (断货/异常下架)
            if (listing.status !== ListingStatus.ON_SALE) {
                const afnFulfillable = restocking.amazonQuantityInfo?.afnFulfillableQuantity || 0;
                // const salesAvg30 = restocking.salesInfo?.salesAvg30 || 0;

                if (afnFulfillable > 0) {
                    // FBA可售库存 > 0 且非在售 -> 异常下架
                    listing.abnormalOfflineStatus = 1;
                    listing.status = ListingStatus.ABNORMAL_OFFLINE;
                } else {
                    listing.abnormalOfflineStatus = 0;
                }
            } else {
                 listing.abnormalOfflineStatus = 0;
            }

            // 调用拆分后的判断方法，获取5个字段值
            const statusResult = this.judgeProductStatusSplit(listing, restocking);
            // 逐个赋值
            listing.newProductStatus = statusResult.newProductStatus;
            listing.in_transit_type = statusResult.in_transit_type;
            listing.needUpdateOperationPlan = statusResult.needUpdateOperationPlan;
            listing.categoryTrafficStatus = statusResult.categoryTrafficStatus;
            listing.productTrafficStatus = statusResult.productTrafficStatus;
            listing.stockOver90Days = statusResult.stockOver90Days;
            listing.salesChangeStatus = statusResult.salesChangeStatus;

            // 2025-01-20: 同步时也更新库存状态（日均销量、可售天数、断货标签等）
            this.updateInventoryStatus(listing, restocking);

            // 额外保存库存天数
            // listing.stockDays = this.calculateStockDays(
            //   listing.afn_fulfillable_quantity + listing.reserved_fc_transfers + listing.reserved_fc_processing +
            //   listing.reserved_customerorders + listing.afn_inbound_shipped_quantity + listing.afn_unsellable_quantity +
            //   listing.afn_inbound_working_quantity + listing.afn_inbound_receiving_quantity,
            //   restocking.extInfo || {},
            //   restocking.suggestInfo?.estimatedSaleAvgQuantity || 0
            // );
            return queryRunner.manager.save(listing);
          }
          return listing;
      });
      await Promise.all(updatePromises);

      // 筛选并插入 app_amz_bsr_product_listing_lingxing_process 表
      // 1. 分组 product_code + marketplace，保留多国家的数据
      const productCodeMarketplaceMap = new Map<string, AppAmzBsrProductListingLingxingEntity[]>();
      listingList.forEach(listing => {
        if (listing.product_code && listing.marketplace) {
          const key = `${listing.product_code}_${listing.marketplace}`;
          if (!productCodeMarketplaceMap.has(key)) {
            productCodeMarketplaceMap.set(key, []);
          }
          productCodeMarketplaceMap.get(key).push(listing);
        }
      });

      for (const [key, listings] of productCodeMarketplaceMap) {
        const [productCode, marketplace] = key.split('_');
        
        // 2026-02-11: 该组合中最少有一条是在售的（status=1）才会入库
        const hasOnSale = listings.some(l => l.status === ListingStatus.ON_SALE);
        if (!hasOnSale) continue;
        
        // 2026-04-27 修改：按 product_code + marketplace 分组，每个国家保留一条数据
        // 取 dailyAvgSales 最高的一条代表该 product_code 的该国家入库
        const bestListing = listings.reduce((prev, current) => {
            return (prev.dailyAvgSales || 0) > (current.dailyAvgSales || 0) ? prev : current;
        });

        // 3. 插入前判断是否有相同 product_code 和 marketplace 的数据
        const existing = await queryRunner.manager.findOne(AppAmzBsrProductListingLingxingProcessEntity, {
            where: {
                product_code: productCode,
                marketplace: marketplace
            }
        });

        if (!existing) {
            const processEntity = new AppAmzBsrProductListingLingxingProcessEntity();
            processEntity.product_code = productCode;
            processEntity.marketplace = bestListing.marketplace;
            processEntity.seller_name = bestListing.seller_name;
            processEntity.asin_url = bestListing.asin_url;
            processEntity.image_url = bestListing.image_url;
            processEntity.price = bestListing.price;
            processEntity.item_name = bestListing.item_name;
            processEntity.image_state = 1;
            processEntity.asin = bestListing.asin;
            processEntity.rank = bestListing.rank || [];
            processEntity.small_rank = bestListing.small_rank || [];
            processEntity.msku = bestListing.msku;
            
            await queryRunner.manager.save(processEntity);
        }
      }

      // 4. 提交事务
      await queryRunner.commitTransaction();
      const totalCount = listingCount + restockingCount;
      return {
        success: true,
        count: totalCount, 
        message: `成功同步${listingCount}条Listing数据 + ${restockingCount}条补货数据（含FBA详情）`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error("同步领星数据失败：", error);
      return {
        success: false,
        count: 0,
        message: `同步失败：${error.message}`,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 批量同步 FBA Shipment List 到本地数据库
   * @param items 货件号和店铺ID集合
   */
  async syncFbaShipmentList(items: {shipment_id: string, sid: string}[]) {
    if (!items || items.length === 0) return;
    
    const endDate = dayjs().format('YYYY-MM-DD');
    // 修改时间：2026-04-23
    // 这里原本是 `dayjs().subtract(2, 'month')`，导致2个月前的海运等长周期货件无法查出
    // 所以即使调用了接口也没有数据返回，导致没有入库，现修改为 12 个月
    // const startDate = dayjs().subtract(2, 'month').format('YYYY-MM-DD');
    const startDate = dayjs().subtract(12, 'month').format('YYYY-MM-DD');
    
    console.log(`[syncFbaShipmentList] 准备调用 shipmentList 接口，共 ${items.length} 个货件编号`);
    
    const batchSize = 10;
    const allReportList = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
       const batch = items.slice(i, i + batchSize);
       await Promise.all(batch.map(async ({shipment_id, sid}) => {
          try {
            // 修改时间：2026-04-23
            // 按照用户要求，将 fba_report/shipmentList 替换为 /api/fba_shipment/showShipment_v2
            const requestPayload = {
               search_field_time: "create_date",
               is_sta: "",
               is_awd: "",
               ship_mode: "",
               step: [],
               is_closed: "",
               application_diff: "",
               received_diff: "",
               application_received_diff: "",
               is_relate_packing_task_sn: "",
               is_add_tracking: "",
               delivery_order_status: [],
               box_type: "",
               is_uploaded_box: "",
               sta_transportation_mode: "",
               delivery_mode: "",
               carrier_type: "",
               create_uids: [],
               is_store_diff: "",
               search_field: "shipment_id",
               search_value: shipment_id,
               shipment_status: [],
               is_relate_shipment: "",
               start_date: startDate,
               end_date: endDate,
               seniorSearchList: [],
               shipment_type: [],
               offset: 0,
               length: 100,
               req_time_sequence: "/api/fba_shipment/showShipment_v2$$2"
            };
            // console.log(`[syncFbaShipmentList] 发起请求 payload: `, JSON.stringify(requestPayload));

            // 使用 crawlerHttpPost 调用 ERP 的 API
            const res = await this.crawlerHttpPost('https://erp.lingxing.com/api/fba_shipment/showShipment_v2', requestPayload);

            // console.log(`[syncFbaShipmentList] 接口返回 res (简略): `, JSON.stringify({ code: res?.data?.code, msg: res?.data?.msg, listLength: res?.data?.data?.list?.length || 0 }));
            // 如果需要看完整返回可以打印 res，但通常比较大，这里打印完整返回：
            // console.log(`[syncFbaShipmentList] 接口完整返回 res: `, JSON.stringify(res?.data));

            // 修改时间：2026-04-23
            // crawlerHttpPost 返回的是 axios response (res.data 才是接口数据)
            const responseData = res?.data;
            if (responseData && responseData.data && Array.isArray(responseData.data.list)) {
               allReportList.push(...responseData.data.list);
            } else if (responseData && Array.isArray(responseData.list)) {
               allReportList.push(...responseData.list);
            }
          } catch (e) {
            console.error(`调用 shipmentList 接口失败 (shipment_id=${shipment_id}): `, e);
          }
       }));
       // 并发控制
       await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (allReportList.length > 0) {
       const entitiesToSave = allReportList.map(item => {
           // 修改时间：2026-04-23
           // 打印货件单号和状态日志，方便调试
           console.log(`[syncFbaShipmentList] 解析到货件数据: 货件单号=${item.shipment_id}, 状态=${item.shipment_status}, 是否关闭=${item.is_closed}`);
           
           const entity = new AppAmzLingxingFbaShipmentReportEntity();
           entity.record_id = item.id;
           entity.sid = item.sid;
           entity.seller = item.seller;
           entity.uid = item.uid;
           entity.username = item.username;
           entity.shipment_id = item.shipment_id;
           entity.shipment_name = item.shipment_name;
           
           // 新增字段映射 (2026-04-23适配 showShipment_v2)
           entity.remark = item.remark;
           entity.send_type = item.send_type;
           entity.status = item.status;
           entity.sync_time = item.sync_time;
           entity.nation = item.nation;
           entity.sta_nation = item.sta_nation;
           entity.inbound_shipment_lists = item.inbound_shipment_lists;
           entity.delivery_order = item.delivery_order;
           entity.create_by_erp = item.create_by_erp;
           entity.packing_type = item.packing_type;
           entity.box_total_weight = item.box_total_weight;
           entity.box_total_volume = item.box_total_volume;
           entity.product_total_weight = item.product_total_weight;
           entity.date_info = item.date_info;
           entity.packing_task_sn = item.packing_task_sn;
           entity.is_add_tracking = item.is_add_tracking;
           entity.ship_mode = item.ship_mode;
           entity.packaging_type = item.packaging_type;
           entity.local_sta_name = item.local_sta_name;
           entity.is_awd = item.is_awd;
           entity.metric_british_system = item.metric_british_system;
           entity.step = item.step;
           entity.sta_transportation_mode = item.sta_transportation_mode;
           entity.local_ship_to_address = item.local_ship_to_address;
           entity.orig_ship_to_address = item.orig_ship_to_address;
           entity.box_type = item.box_type;
           entity.box_commit = item.box_commit;
           entity.box_commit_result = item.box_commit_result;

           // 解析时间字段兼容旧逻辑 (从 date_info 提取)
           if (Array.isArray(item.date_info)) {
               const working = item.date_info.find((d: any) => d.status_name === 'WORKING');
               const shipped = item.date_info.find((d: any) => d.status_name === 'SHIPPED');
               const receiving = item.date_info.find((d: any) => d.status_name === 'RECEIVING');
               const closed = item.date_info.find((d: any) => d.status_name === 'CLOSED');
               
               entity.working_time = working ? working.status_time : '';
               entity.shipped_time = shipped ? shipped.status_time : '';
               entity.receiving_time = receiving ? receiving.status_time : '';
               entity.closed_time = closed ? closed.status_time : '';
           }

           entity.sta_inbound_plan_id = item.sta_inbound_plan_id;
           entity.is_closed = item.is_closed;
           entity.shipment_status = item.shipment_status;
           entity.gmt_modified = item.gmt_modified;
           entity.gmt_create = item.gmt_create;
           entity.destination_fulfillment_center_id = item.destination_fulfillment_center_id;
           entity.is_synchronous = item.is_synchronous;
           entity.is_uploaded_box = item.is_uploaded_box;
           entity.is_sta = item.is_sta;
           entity.sta_delivery_start_date = item.sta_delivery_start_date;
           entity.sta_delivery_end_date = item.sta_delivery_end_date;
           entity.reference_id = item.reference_id;
           // 新增字段映射 (2026-04-23补充)
           entity.reference_update_num = item.reference_update_num;
           entity.reference_sync_status = item.reference_sync_status;
           entity.reference_error_msg = item.reference_error_msg;
           entity.is_print_transparency = item.is_print_transparency;
           entity.local_sta_id = item.local_sta_id;
           entity.awd_error_msg_info = item.awd_error_msg_info;
           entity.is_store_diff = item.is_store_diff; 
           entity.last_success_box_count = item.last_success_box_count;
           entity.last_success_card_count = item.last_success_card_count;
           
           entity.tracking_number_list = item.tracking_number_list;
           entity.item_list = item.item_list;

           return entity;
       });

       for (let i = 0; i < entitiesToSave.length; i += 100) {
           const batchEntities = entitiesToSave.slice(i, i + 100);
           
           const recordIds = batchEntities.map(e => e.record_id).filter(id => id);
           if (recordIds.length > 0) {
               const existing = await this.listingRepo.manager.find(AppAmzLingxingFbaShipmentReportEntity, {
                   where: { record_id: In(recordIds) }
               });
               
               for (const entity of batchEntities) {
                   const existItem = existing.find(e => e.record_id === entity.record_id);
                   if (existItem) {
                       entity.id = existItem.id;
                   }
               }
           }
           await this.listingRepo.manager.save(batchEntities);
       }
       console.log(`[syncFbaShipmentList] 成功保存 ${entitiesToSave.length} 条 FBA Shipment Report 数据`);
    }
  }

  /**
   * 计算ASIN创建时长（天）
   */
  private async fetchCreateTimeMapByLocalNames(localNames: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (!Array.isArray(localNames) || localNames.length === 0) {
      return result;
    }
    const uniqueNames = Array.from(new Set(localNames.filter(v => typeof v === "string" && v.trim().length > 0)));
    if (uniqueNames.length === 0) {
      return result;
    }
    // const headers = await this.getCrawlerHeaders(); // 移到 crawlerHttpPost 内部获取
    const MAX_NAMES_PER_BATCH = 2000;
    for (let i = 0; i < uniqueNames.length; i += MAX_NAMES_PER_BATCH) {
      const batchNames = uniqueNames.slice(i, i + MAX_NAMES_PER_BATCH);
      const seniorSearchList = [
        {
          name: "品名",
          search_field: "product_name",
          search_value: batchNames,
        },
      ];
      const length = 500;
      let offset = 0;
      let total = 0;
      let pageIndex = 1;
      do {
        const body = {
          search_field_time: "create_time",
          product_creator_uid: [],
          product_developer_uid: [],
          permission_uid: [],
          cg_opt_uid: [],
          supplier_id: [],
          sort_field: "create_time",
          sort_type: "desc",
          search_field: "product_name",
          attribute: [],
          status: [],
          open_status: "",
          gtag_ids: "",
          senior_search_list: JSON.stringify(seniorSearchList),
          single_product_id: [],
          is_matched_listing: "",
          is_matched_alibaba: "",
          relation_aux: "",
          is_have_pic: "",
          cg_package: "",
          cg_product_gross_weight: {
            left: "",
            right: "",
            symbol: "gt",
          },
          cg_price: {
            left: "",
            right: "",
            symbol: "gt",
          },
          cg_transport_costs: {
            left: "",
            right: "",
            symbol: "gt",
            country_code: "US",
          },
          offset,
          is_combo: "",
          length,
          is_aux: 0,
          product_type: [1, 2],
          selected_product_ids: "",
          req_time_sequence: "/api/product/lists$$3",
        };
        const res = await this.crawlerHttpPost(
          `${this.lx_erp_host}/api/product/lists`,
          body,
          60000
        );
        const raw = res.data || {};
        const dataObj = raw || {};
        const list = Array.isArray(dataObj.list) ? dataObj.list : [];
        total = typeof dataObj.total === "number" ? dataObj.total : list.length;
        for (const item of list as any[]) {
          const productName = (item as any).product_name || "";
          const createTime = (item as any).create_time || "";
          if (!productName || !createTime) {
            continue;
          }
          if (!result.has(productName) && batchNames.includes(productName)) {
            result.set(productName, createTime);
          }
        }
        offset += length;
        pageIndex += 1;
      } while (offset < total);
    }
    return result;
  }

  public async updateOpenDateTimeByProductCreateTime(
    queryRunner: QueryRunner,
    listingList: AppAmzBsrProductListingLingxingEntity[]
  ): Promise<void> {
    if (!Array.isArray(listingList) || listingList.length === 0) {
      return;
    }
    const localNames: string[] = [];
    for (const listing of listingList) {
      if (listing && typeof listing.local_name === "string" && listing.local_name.trim().length > 0) {
        localNames.push(listing.local_name);
      }
    }
    if (localNames.length === 0) {
      return;
    }
    const createTimeMap = await this.fetchCreateTimeMapByLocalNames(localNames);
    if (!createTimeMap || createTimeMap.size === 0) {
      return;
    }
    const needUpdate: AppAmzBsrProductListingLingxingEntity[] = [];
    for (const listing of listingList) {
      const localName = listing.local_name;
      if (!localName) {
        continue;
      }
      const createTimeStr = createTimeMap.get(localName);
      if (!createTimeStr) {
        continue;
      }
      try {
        console.log(`[updateOpenDateTimeByProductCreateTime] localName: ${localName}, createTime: ${createTimeStr}`);
        // 2026-04-15 修改：将领星获取的时间保存到 open_date_time2 中，不覆盖本身的 open_date_time
        // listing.open_date_time = dayjs(createTimeStr).toDate();
        listing.open_date_time2 = dayjs(createTimeStr).toDate();
        needUpdate.push(listing);
      } catch {
        continue;
      }
    }
    if (needUpdate.length > 0) {
      await queryRunner.manager.save(needUpdate);
    }
  }

  /**
   * 单个 Listing 实时拉取长宽高和价格数据
   */
  public async fetchSingleListingPricingAndDimensions(
    sid: number,
    msku: string,
    country: string
  ): Promise<{ 
    tactic_length?: number; 
    tactic_width?: number; 
    tactic_height?: number; 
    tactic_cost_rmb?: number;
    tactic_first_leg_rmb?: number;
    tactic_exchange_rate?: string;
  }> {
    const result: any = {};
    if (!msku) return result;

    // 1. 获取利润与成本等数据
    try {
      const endDate = dayjs().subtract(1, "day").format("YYYY-MM-DD");
      const startDate = dayjs(endDate).subtract(6, "day").format("YYYY-MM-DD");
      const body = {
        offset: 0,
        length: 10,
        startDate,
        endDate,
        searchField: "msku",
        searchValue: [msku],
      };
      
      const res: any = await this.httpPost("/bd/profit/statistics/open/msku/list", body);
      const records = Array.isArray(res?.records) ? res.records : [];
      
      // 匹配当前国家
      const marketplaceMap = {
        'UK': '英国', 'GB': '英国', 'DE': '德国', 'FR': '法国', 'IT': '意大利',
        'ES': '西班牙', 'US': '美国', 'CA': '加拿大', 'JP': '日本', 'MX': '墨西哥',
        'AU': '澳大利亚', 'NL': '荷兰', 'SE': '瑞典', 'PL': '波兰', 'BE': '比利时',
        'TR': '土耳其', 'BR': '巴西', 'IN': '印度', 'AE': '阿联酋', 'SA': '沙特'
      };
      const countryZh = marketplaceMap[country] || country;

      let targetRecord = records.find(r => r.country === country || r.country === countryZh);
      if (!targetRecord && records.length > 0) {
        targetRecord = records.find(r => !r.country) || records[0];
      }

      if (targetRecord) {
        result.tactic_cost_rmb = typeof targetRecord.cgUnitPrice === "number" ? targetRecord.cgUnitPrice : Number(targetRecord.cgUnitPrice || 0);
        result.tactic_first_leg_rmb = typeof targetRecord.firstTripUnitPrice === "number" ? targetRecord.firstTripUnitPrice : Number(targetRecord.firstTripUnitPrice || 0);
        result.tactic_exchange_rate = targetRecord.currencyCode || "";
      }
    } catch (error) {
      console.error(`实时获取单个Listing毛利数据失败 (msku: ${msku})：`, error);
    }

    // 2. 获取长宽高
    if (sid) {
      try {
        const url = `${this.lx_erp_host}/api/tool_pricing/products`;
        const params = {
          offset: 0,
          length: 50,
          sid,
          seller_sku: msku,
          fulfillment_channel_type: 1,
          req_time_sequence: "/api/tool_pricing/products$$1"
        };
        
        const res = await this.crawlerHttpGet(url, params);
        
        // 修改这里的解析逻辑：
        // 根据之前的测试数据，爬虫返回的 res 可能是包含 data 的 axios response，
        // 也可能是直接包含数据的对象。
        let list = [];
        if (res?.data?.data?.list) {
            list = res.data.data.list;
        } else if (res?.data?.list) {
            list = res.data.list;
        } else if (res?.list) {
            list = res.list;
        } else if (Array.isArray(res?.data)) {
            list = res.data;
        }
        
        if (Array.isArray(list) && list.length > 0) {
          // 一般来说只返回一个或者匹配的第一条
          const targetItem = list.find(item => item.seller_sku === msku) || list[0];
          if (targetItem && targetItem.back_size) {
            result.tactic_length = Number(targetItem.back_size.length || 0);
            result.tactic_width = Number(targetItem.back_size.width || 0);
            result.tactic_height = Number(targetItem.back_size.height || 0);
          }
        }
      } catch (error) {
        console.error(`实时获取单个Listing长宽高失败 (sid: ${sid}, msku: ${msku})：`, error);
      }
    }

    return result;
  }

  public async updateListingGrossProfit(
    queryRunner: QueryRunner,
    listingList: AppAmzBsrProductListingLingxingEntity[]
  ): Promise<void> {
    if (!Array.isArray(listingList) || listingList.length === 0) {
      return;
    }

    const mskuList = Array.from(
      new Set(
        listingList
          .map(item => (item.msku || "").trim())
          .filter(msku => msku.length > 0)
      )
    );

    if (mskuList.length === 0) {
      return;
    }

    const endDate = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    const startDate = dayjs(endDate).subtract(6, "day").format("YYYY-MM-DD");

    const batchSize = 100;
    const grossMap = new Map<string, Map<string, { 
      grossProfit: number; 
      grossRate: number;
      firstTripUnitPrice: number;
      currencyCode: string;
      cgUnitPrice: number;
    }>>();

    for (let i = 0; i < mskuList.length; i += batchSize) {
      // 限制请求频率：最多一秒钟请求一次
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
      const batch = mskuList.slice(i, i + batchSize);
      const body = {
        offset: 0,
        length: 1000,
        startDate,
        endDate,
        searchField: "msku",
        searchValue: batch,
      };

      try {
        const res: any = await this.httpPost("/bd/profit/statistics/open/msku/list", body);
        const records = Array.isArray(res?.records) ? res.records : [];
        for (const record of records) {
          const msku = (record.msku || "").trim();
          if (!msku) {
            continue;
          }
          
          // 获取国家信息，用于多站点区分
          const country = (record.country || "").trim();

          let mskuMap = grossMap.get(msku);
          if (!mskuMap) {
            mskuMap = new Map();
            grossMap.set(msku, mskuMap);
          }
          
          // 如果该MSKU在该国家已有数据，则跳过（或覆盖，取决于API返回顺序，这里保留第一条）
          if (mskuMap.has(country)) {
            continue;
          }

          const grossProfitRaw = record.grossProfit;
          const grossRateRaw = record.grossRate;
          const grossProfit =
            typeof grossProfitRaw === "number" ? grossProfitRaw : Number(grossProfitRaw || 0);
          const grossRate =
            typeof grossRateRaw === "number" ? grossRateRaw : Number(grossRateRaw || 0);
          
          const firstTripUnitPriceRaw = record.firstTripUnitPrice;
          const firstTripUnitPrice = typeof firstTripUnitPriceRaw === "number" ? firstTripUnitPriceRaw : Number(firstTripUnitPriceRaw || 0);

          const cgUnitPriceRaw = record.cgUnitPrice;
          const cgUnitPrice = typeof cgUnitPriceRaw === "number" ? cgUnitPriceRaw : Number(cgUnitPriceRaw || 0);

          const currencyCode = record.currencyCode || "";
          
          mskuMap.set(country, { 
            grossProfit, 
            grossRate,
            firstTripUnitPrice,
            currencyCode,
            cgUnitPrice
          });
        }
      } catch (error) {
        console.error("获取订单毛利率/毛利润数据失败：", error);
      }
    }

    if (grossMap.size === 0) {
      // 即使没有利润数据，也继续获取长宽高
    }

    // 新增：获取长宽高（通过 sid 批量获取，减少请求次数）
    // 收集所有的 sid
    const sidList = Array.from(new Set(listingList.map(item => item.store_id).filter(sid => sid > 0)));
    const dimensionsMap = new Map<string, { length: number; width: number; height: number }>();

    for (const sid of sidList) {
      let offset = 0;
      const length = 500; // 每页 500 条
      let hasMore = true;

      while (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 防止请求过快
        try {
          const url = `${this.lx_erp_host}/api/tool_pricing/products`;
          const params = {
            offset,
            length,
            sid,
            fulfillment_channel_type: 1,
            req_time_sequence: "/api/tool_pricing/products$$1"
          };
          
          const res = await this.crawlerHttpGet(url, params);
          const list = res?.data?.data?.list || res?.data?.list || [];
          
          if (!Array.isArray(list) || list.length === 0) {
            hasMore = false;
            break;
          }

          for (const item of list) {
            const msku = (item.seller_sku || "").trim();
            if (!msku) continue;
            
            // back_size 包含长宽高
            if (item.back_size) {
              const pLength = Number(item.back_size.length || 0);
              const pWidth = Number(item.back_size.width || 0);
              const pHeight = Number(item.back_size.height || 0);
              
              dimensionsMap.set(`${sid}_${msku}`, {
                length: pLength,
                width: pWidth,
                height: pHeight
              });
            }
          }
          
          if (list.length < length) {
            hasMore = false;
          } else {
            offset += length;
          }
        } catch (error) {
          console.error(`获取店铺 ${sid} 的长宽高数据失败：`, error);
          hasMore = false; // 出错则跳过该店铺剩余数据
        }
      }
    }

    if (grossMap.size === 0 && dimensionsMap.size === 0) {
      return;
    }

    const needUpdate: AppAmzBsrProductListingLingxingEntity[] = [];

    // 站点代码映射到中文名称 (如果Listing存的是代码，API返回的是中文)
    const marketplaceMap = {
        'UK': '英国',
        'GB': '英国',
        'DE': '德国',
        'FR': '法国',
        'IT': '意大利',
        'ES': '西班牙',
        'US': '美国',
        'CA': '加拿大',
        'JP': '日本',
        'MX': '墨西哥',
        'AU': '澳大利亚',
        'NL': '荷兰',
        'SE': '瑞典',
        'PL': '波兰',
        'BE': '比利时',
        'TR': '土耳其',
        'BR': '巴西',
        'IN': '印度',
        'AE': '阿联酋',
        'SA': '沙特'
    };

    for (const listing of listingList) {
      const msku = (listing.msku || "").trim();
      if (!msku) {
        continue;
      }
      
      const mskuMap = grossMap.get(msku);
      const dimensionInfo = dimensionsMap.get(`${listing.store_id}_${msku}`);

      if (!mskuMap && !dimensionInfo) {
        continue;
      }

      let info: any = null;
      if (mskuMap) {
        const marketplace = (listing.marketplace || "").trim();
        
        // 1. 尝试直接匹配
        info = mskuMap.get(marketplace);

        // 2. 如果直接匹配失败，尝试代码转中文匹配
        if (!info && marketplaceMap[marketplace]) {
            info = mskuMap.get(marketplaceMap[marketplace]);
        }

        // 3. 如果还是没有，且Map中只有一条数据且Key为空字符串（API未返回country），则使用该数据
        if (!info && mskuMap.has("")) {
            info = mskuMap.get("");
        }
      }

      if (!info && !dimensionInfo) {
        continue;
      }
      
      let isUpdated = false;

      if (info) {
        listing.profit = info.grossProfit;
        listing.profit_rate = info.grossRate;
        listing.tactic_cost_rmb = info.cgUnitPrice;
        listing.tactic_first_leg_rmb = info.firstTripUnitPrice;
        listing.tactic_exchange_rate = info.currencyCode;
        isUpdated = true;
      }

      if (dimensionInfo) {
        listing.tactic_length = dimensionInfo.length;
        listing.tactic_width = dimensionInfo.width;
        listing.tactic_height = dimensionInfo.height;
        isUpdated = true;
      }
      
      if (isUpdated) {
        needUpdate.push(listing);
      }
    }

    if (needUpdate.length > 0) {
      await queryRunner.manager.save(needUpdate);
    }
  }

  /**
   * 计算ASIN创建时长（天）
   */
  private calculateAsinCreateDays(openDateTime: Date): number {
    if (!openDateTime) return 0;
    return dayjs().diff(dayjs(openDateTime), 'day');
  }

  /**
   * 判断是否有FBA在途货件
   */
  private hasFbaInboundShipments(fbaShippingList: FbaShippingItem[]): boolean {
    if (!fbaShippingList || fbaShippingList.length === 0) return false;
    return fbaShippingList.some(item => item.quantity > 0);
  }

  /**
   * 计算排名变化率（%）：正值=下滑，负值=增长
   */
  private calculateRankChangeRate(current: number, compare: number): number {
    if (compare === 0 || current === 0) return 0;
    return ((current - compare) / compare) * 100;
  }

  /**
   * 计算销量变化状态
   * @param salesAvg3 3天平均销量
   * @param salesAvg7 7天平均销量
   * @param salesAvg14 14天平均销量
   */
  private calculateSalesChangeStatus(salesAvg3: number, salesAvg7: number, salesAvg14: number): string {
    const f = (salesAvg3 === 0 || salesAvg3 === null) ? 0.01 : salesAvg3;
    const g = (salesAvg7 === 0 || salesAvg7 === null) ? 0.01 : salesAvg7;
    const h = (salesAvg14 === 0 || salesAvg14 === null) ? 0.01 : salesAvg14;
    
    const shortR = (f - g) / g;
    const longR = (g - h) / h;
    
    if (shortR > 3) return "短期突增";
    if (shortR < -0.75) return "短期突降";
    if (longR > 0.66) return "明显增长";
    if (longR < -0.4) return "明显下滑";
    if (longR > 0.3) return "持续增长";
    if (longR < -0.25) return "持续下滑";
    
    return "销量稳定";
  }

  /**
   * 计算库存天数（按运营计划规则）
   */
  private calculateStockDays(
    totalStock: number,
    extInfo: ExtInfo,
    estimatedSaleAvgQuantity: number
  ): number {
    if (totalStock <= 0) return 0;

    // 1. 无运营计划：总库存/日均销量
    if (!extInfo || extInfo.needFlagPurchase === 0 && extInfo.needFlagLocalSend === 0) {
      return estimatedSaleAvgQuantity <= 0 ? 999 : Math.ceil(totalStock / estimatedSaleAvgQuantity);
    }

    // 2. 有运营计划（需补充extInfo中当月/次月销量字段，此处为占位）
    const now = dayjs();
    const currentMonthDays = now.daysInMonth();
    const currentMonthRemainingDays = currentMonthDays - now.date();
    
    // 当月计划日均销量（需替换为extInfo实际字段）
    const currentMonthDaily = estimatedSaleAvgQuantity;
    const currentMonthRemainingSales = currentMonthDaily * currentMonthRemainingDays;

    // 次月计划（需替换为extInfo实际字段）
    const nextMonth = now.add(1, 'month');
    const nextMonthDays = nextMonth.daysInMonth();
    const nextMonthDaily = estimatedSaleAvgQuantity;
    const nextMonthTotalSales = nextMonthDaily * nextMonthDays;

    // 库存天数计算逻辑
    if (nextMonthTotalSales > totalStock) {
      // 次次月逻辑（需补充extInfo.afterNextMonthTotalSales）
      const afterNextMonth = now.add(2, 'month');
      const afterNextMonthDaily = estimatedSaleAvgQuantity;
      const remaining = totalStock - currentMonthRemainingSales - nextMonthTotalSales;
      return currentMonthRemainingDays + nextMonthDays + Math.ceil(remaining / afterNextMonthDaily);
    } else {
      const remaining = totalStock - currentMonthRemainingSales;
      return currentMonthRemainingDays + Math.ceil(remaining / nextMonthDaily);
    }
  }


  public judgeProductStatusSplit(
    listingEntity: AppAmzBsrProductListingLingxingEntity,
    restockingEntity: AppAmzBsrRestockingCenterLingxingEntity
  ): {
    newProductStatus: NewProductStatus;
    in_transit_type: number;
    needUpdateOperationPlan: number;
    categoryTrafficStatus: CategoryTrafficStatus;
    productTrafficStatus: ProductTrafficStatus;
    stockOver90Days: number;
    salesChangeStatus: string;
  } {
    // ========== 1. 基础数据准备 ==========
    const asinCreateDays = this.calculateAsinCreateDays(listingEntity.open_date_time);
    const asinCreateDays2 = this.calculateAsinCreateDays(listingEntity.open_date_time2);
    const hasFbaInbound = this.hasFbaInboundShipments(restockingEntity?.fbaShippingList || []);
    const totalStock = listingEntity.afn_fulfillable_quantity +
      listingEntity.reserved_fc_transfers +
      listingEntity.reserved_fc_processing +
      listingEntity.reserved_customerorders +
      listingEntity.afn_inbound_shipped_quantity +
      listingEntity.afn_unsellable_quantity +
      listingEntity.afn_inbound_working_quantity +
      listingEntity.afn_inbound_receiving_quantity;
  
    // ========== 2. 新品状态（互斥，按优先级判断） ==========
    let newProductStatus = NewProductStatus.NONE;
    let in_transit_type = 0;
    
    // 2026-04-15 新增：新品在途判断逻辑更新：两个时间只要有一个<=45天就算新品在途
    const isNewProduct1 = asinCreateDays > 0 && asinCreateDays <= 45;
    const isNewProduct2 = asinCreateDays2 > 0 && asinCreateDays2 <= 45;
    const isNewProduct = isNewProduct1 || isNewProduct2;

    // 优先级1：新品在途
    if (
      // 2026-04-15 修改：使用新的 isNewProduct 综合判断
      // asinCreateDays > 0 &&
      // asinCreateDays <= 45 && // Modified by Trae: based on user request to restrict new product within 45 days
      isNewProduct &&
      listingEntity.afn_fulfillable_quantity === 0 &&
      listingEntity.status === ListingStatus.ON_SALE &&
      hasFbaInbound
    ) {
      newProductStatus = NewProductStatus.IN_TRANSIT;
      if (isNewProduct1 && isNewProduct2) {
        in_transit_type = 3;
      } else if (isNewProduct2) {
        in_transit_type = 2;
      } else if (isNewProduct1) {
        in_transit_type = 1;
      }
    }
    // 优先级2：新品到货无销量
    else if (
      isNewProduct &&
      listingEntity.afn_fulfillable_quantity > 0 &&
      listingEntity.total_volume === 0 &&
      hasFbaInbound
    ) {
      newProductStatus = NewProductStatus.ARRIVED_NO_SALES;
    }
    // 优先级3：到货超7天无销量
    else if (
      isNewProduct &&
      asinCreateDays > 7 && // Note: using primary create days for over X days checks
      listingEntity.total_volume === 0 &&
      listingEntity.afn_fulfillable_quantity > 0
    ) {
      newProductStatus = NewProductStatus.ARRIVED_OVER_7_DAYS_NO_SALES;
    }
    // 优先级4：到货超14天无销量
    else if (
      isNewProduct &&
      asinCreateDays > 14 &&
      listingEntity.fourteen_volume === 0 &&
      listingEntity.afn_fulfillable_quantity > 0
    ) {
      newProductStatus = NewProductStatus.ARRIVED_OVER_14_DAYS_NO_SALES;
    }
    // 优先级5：到货超30天无销量
    else if (
      isNewProduct &&
      asinCreateDays > 30 &&
      listingEntity.thirty_volume === 0 &&
      listingEntity.afn_fulfillable_quantity > 0
    ) {
      newProductStatus = NewProductStatus.ARRIVED_OVER_30_DAYS_NO_SALES;
    }
  
    let needUpdateOperationPlan = 0;
    // ========== 3. 是否需要更新运营计划 ==========
    if(restockingEntity?.extInfo.needFlagPurchase === 0 || restockingEntity?.extInfo.needFlagLocalSend){
      needUpdateOperationPlan = 1;
    } 
    // ========== 4. 类目流量状态 ==========
    let categoryTrafficStatus = CategoryTrafficStatus.NONE;
    const currentRank = listingEntity.rank[0] || 0;
    const lastWeekRank = listingEntity.rank[6] || 0; // 第7位=上周同期（同比）
    const yesterdayRank = listingEntity.rank[1] || 0; // 第2位=昨日（环比）
    const nodeRankCurrent = listingEntity.small_rank[0] || 0;
    const nodeRankLastWeek = listingEntity.small_rank[6] || 0;
  
    const rankYoY = this.calculateRankChangeRate(currentRank, lastWeekRank); // 同比变化率（+下滑/-增长）
    const rankMoM = this.calculateRankChangeRate(currentRank, yesterdayRank); // 环比变化率
    const nodeRankYoY = this.calculateRankChangeRate(nodeRankCurrent, nodeRankLastWeek); // 节点排名同比浮动
  
    // 类目流量降低：同比+环比都下滑 + 节点排名同比浮动≤40%
    if (rankYoY > 0 && rankMoM > 0 && Math.abs(nodeRankYoY) <= 40) {
      categoryTrafficStatus = CategoryTrafficStatus.DOWN;
    }
    // 类目流量增长：同比+环比都增长 + 节点排名同比浮动≤40%
    else if (rankYoY < 0 && rankMoM < 0 && Math.abs(nodeRankYoY) <= 40) {
      categoryTrafficStatus = CategoryTrafficStatus.UP;
    }
  
    // ========== 5. 产品流量状态 ==========
    let productTrafficStatus = ProductTrafficStatus.NONE;
    const nodeRankMoM = this.calculateRankChangeRate(nodeRankCurrent, listingEntity.small_rank[1] || 0); // 节点排名环比
  
    // 产品流量降低：节点排名同比下滑超30% + 环比下滑
    if (nodeRankYoY > 30 && nodeRankMoM > 0) {
      productTrafficStatus = ProductTrafficStatus.DOWN;
    }
    // 产品流量增长：节点排名同比增长超30% + 环比增长（修正原需求描述错误）
    else if (nodeRankYoY < -30 && nodeRankMoM < 0) {
      productTrafficStatus = ProductTrafficStatus.UP;
    }
  
    // ========== 6. 库存是否超90天（布尔） ==========
    const stockDays = this.calculateStockDays(
      totalStock,
      restockingEntity?.extInfo,
      restockingEntity?.suggestInfo?.estimatedSaleAvgQuantity || 0
    );
    const stockOver90Days = stockDays > 90 ? 1 : 0;

    // ========== 7. 销量变化状态 ==========
    const salesChangeStatus = this.calculateSalesChangeStatus(
      restockingEntity?.salesInfo?.salesAvg3 || 0,
      restockingEntity?.salesInfo?.salesAvg7 || 0,
      restockingEntity?.salesInfo?.salesAvg14 || 0
    );
  
    // ========== 返回拆分后的6个字段 ==========
    return {
      newProductStatus,
      in_transit_type,
      needUpdateOperationPlan,
      categoryTrafficStatus,
      productTrafficStatus,
      // 2025-01-16 弃用 stockOver90Days
      stockOver90Days: 0, // stockOver90Days,
      salesChangeStatus,
    };
  }

  /**
   * 计算并更新库存状态（含日均销量、可售天数、断货标签等）
   * 2025-01-16: 新增逻辑
   */
  public updateInventoryStatus(listing: AppAmzBsrProductListingLingxingEntity, restocking: AppAmzBsrRestockingCenterLingxingEntity) {
      if (!restocking || !restocking.salesInfo || !restocking.amazonQuantityInfo) {
          return;
      }

      const salesInfo = restocking.salesInfo;
      const amazonInfo = restocking.amazonQuantityInfo;

      const A1 = salesInfo.salesAvg3 || 0;
      const A2 = salesInfo.salesAvg7 || 0;
      const A3 = salesInfo.salesAvg14 || 0;
      const A30 = salesInfo.salesAvg30 || 0;

      let status = "销量平稳";
      let dailyAvgSales = 0;

      // 2026-04-01: 按最新规则调整日均销量取值
      // 优先级判断逻辑
      // 优先级 100-80: 无单判断
      if (A3 === 0) {
          status = "14天无单";
          dailyAvgSales = 0;
      } else if (A2 === 0) {
          status = "7天无单";
          dailyAvgSales = 0;
      } else if (A1 === 0) {
          status = "3天无单";
          dailyAvgSales = A2;
      } else {
          // 2026-04-01: A2/A3 已在上方过滤为 0 的情况，这里直接按规则计算变化率
          const rate1_2 = A2 > 0 ? (A1 - A2) / A2 : 0;
          const rate1_3 = A3 > 0 ? (A1 - A3) / A3 : 0;

          // 优先级 70: 短期突变
          // 2026-04-01: “短期突降”按业务语义使用 < -0.66 判断
          if (rate1_2 < -0.66) {
              status = "短期突降";
              dailyAvgSales = (A1 * 2 + A2 * 0.8 + A3 * 0.2) / 3;
          } 
          // 短期突增: (A1-A2)/A2 > 2
          else if (rate1_2 > 2) {
              status = "短期突增";
              dailyAvgSales = (A1 * 2 + A2 * 0.8 + A3 * 0.2) / 3;
          }
          // 优先级 60: 明显变化
          // 明显增长: (A1-A3)/A3 > 1
          else if (rate1_3 > 1) {
              status = "明显增长";
              dailyAvgSales = (A1 * 1.8 + A2 * 0.8 + A3 * 0.4) / 3;
          }
          // 明显下滑: (A1-A3)/A3 < -0.5
          else if (rate1_3 < -0.5) {
              status = "明显下滑";
              dailyAvgSales = (A1 * 1.8 + A2 * 0.8 + A3 * 0.4) / 3;
          }
          // 优先级 50: 小幅变化
          // 小幅增长: (A1-A3)/A3 > 0.5
          else if (rate1_3 > 0.5) {
              status = "小幅增长";
              dailyAvgSales = (A1 * 1.4 + A2 * 1 + A3 * 0.6) / 3;
          }
          // 小幅下滑: (A1-A3)/A3 < -0.33
          else if (rate1_3 < -0.33) {
              status = "小幅下滑";
              dailyAvgSales = (A1 * 1.4 + A2 * 1 + A3 * 0.6) / 3;
          }
          // 优先级 40: 销量平稳 (其他情况)
          else {
              status = "销量平稳";
              dailyAvgSales = (A1 * 1.1 + A2 * 1.1 + A3 * 0.8) / 3;
          }
      }

      // 2025-01-16: 保存销量变化状态
      listing.salesChangeStatus = status;
      
      // 防止除以0或负数（虽然逻辑上不太可能出现负数）
      dailyAvgSales = dailyAvgSales > 0 ? dailyAvgSales : 0;
      // 2025-01-26: 保留两位小数
      listing.dailyAvgSales = Number(dailyAvgSales.toFixed(2));

      // 2. 计算可售天数
      // FBA可售 / 日均销量
      const afnFulfillable = amazonInfo.afnFulfillableQuantity || 0;
      
      // 2026-04-16: 用补货中心精确到MSKU的库存数据覆盖 Listing 原始接口的聚合数据
      listing.afn_fulfillable_quantity = afnFulfillable;
      listing.afn_inbound_receiving_quantity = amazonInfo.afnInboundReceivingQuantity || 0;
      
      listing.afn_inbound_shipped_quantity = amazonInfo.amazonQuantityShipping || 0; 
      listing.afn_inbound_working_quantity = amazonInfo.amazonQuantityShippingPlan || 0; 
      
      listing.reserved_customerorders = amazonInfo.reservedCustomerorders || 0;
      listing.reserved_fc_processing = amazonInfo.reservedFcProcessing || 0;
      listing.reserved_fc_transfers = amazonInfo.reservedFcTransfers || 0;

      let sellableDays = 0;
      if (dailyAvgSales > 0) {
          sellableDays = afnFulfillable / dailyAvgSales;
      } else {
          // 如果销量为0，设为9999表示不动销
          sellableDays = afnFulfillable > 0 ? 9999 : 0;
      }
      listing.sellableDays = sellableDays;

      // 3. 库存状态文本
      // FBA可售/日均销量>90天→库存>90天；<65天→库存<60天；<45天→库存<45天；<30天→库存<30天；<20天→库存<20天；<10天→库存<10天
      let statusText = "";
      if (sellableDays > 90) statusText = "库存>90天";
      else if (sellableDays < 10) statusText = "库存<10天";
      else if (sellableDays < 20) statusText = "库存<20天";
      else if (sellableDays < 30) statusText = "库存<30天";
      else if (sellableDays < 45) statusText = "库存<45天";
      else if (sellableDays < 65) statusText = "库存<60天";
      
      listing.inventoryStatusText = statusText;

      // 4. FBA在途断层判断
      // 需要更新 restocking.fbaShippingList
      if (restocking.fbaShippingList && restocking.fbaShippingList.length > 0) {
          // 浅拷贝并排序，用于计算
          const sortedShipping = [...restocking.fbaShippingList].sort((a, b) => {
              const dateA = dayjs(a.amazonSaleDate || '2099-12-31').valueOf();
              const dateB = dayjs(b.amazonSaleDate || '2099-12-31').valueOf();
              return dateA - dateB;
          });

          let cumulativeStock = afnFulfillable;
          const today = dayjs();

          for (const item of sortedShipping) {
              // 重置状态
              if (item.shipment_status === '断') {
                  item.shipment_status = null; 
              }

              if (!item.amazonSaleDate) continue;

              const arrivalDate = dayjs(item.amazonSaleDate);
              const daysToArrival = arrivalDate.diff(today, 'day');
              
              // 过去日期的忽略
              if (daysToArrival < 0) {
                  cumulativeStock += (item.quantity || 0);
                  continue;
              }

              const demand = daysToArrival * dailyAvgSales;

              if (cumulativeStock < demand) {
                  // 断层检测
                  item.shipment_status = '断';
              }

              cumulativeStock += (item.quantity || 0);
          }
      }
      // 5. 断货状态判断逻辑 
      // 条件：FBA可售库存为0 且 近30天销量日均不为0
      const salesAvg30 = salesInfo.salesAvg30 || 0;
      const lastOutOfStockStatus = listing.outOfStockStatus || 0;
      const lastOutOfStockStartTime = listing.outOfStockStartTime;
      const afnFulfillableQuantity = amazonInfo.afnFulfillableQuantity || 0;

      if (afnFulfillableQuantity === 0 && salesAvg30 > 0) {
        // 满足断货条件
        if (lastOutOfStockStatus !== OutOfStockStatus.OUT_OF_STOCK) {
          // 刚进入断货状态
          listing.outOfStockStatus = OutOfStockStatus.OUT_OF_STOCK;
          listing.outOfStockStartTime = new Date();
        } else {
          // 维持断货状态
          // 检查是否超过30天
          if (lastOutOfStockStartTime) {
             const daysDiff = dayjs().diff(dayjs(lastOutOfStockStartTime), 'day');
             if (daysDiff >= 30) {
               // 超过30天，重置为正常
               listing.outOfStockStatus = OutOfStockStatus.NORMAL;
               listing.outOfStockStartTime = null;
             } else {
               // 保持断货状态
               listing.outOfStockStatus = lastOutOfStockStatus;
               listing.outOfStockStartTime = lastOutOfStockStartTime;
             }
          } else {
             // 异常数据补救
             listing.outOfStockStatus = OutOfStockStatus.OUT_OF_STOCK;
             listing.outOfStockStartTime = new Date();
          }
        }
      } else {
        // 不满足断货条件（有库存 或 销量为0）
        listing.outOfStockStatus = OutOfStockStatus.NORMAL;
        listing.outOfStockStartTime = null;
      }

  }

  /**
   * 同步品名到领星 ERP
   */
  async syncProductNameToLingXing(sku: string, product_name: string): Promise<boolean> {
    try {
      const res = await this.httpPost('/erp/sc/routing/storage/product/set', {
        sku,
        product_name
      });
      console.log(`[syncProductNameToLingXing] 同步品名成功 sku=${sku} product_name=${product_name}`, res);
      return true;
    } catch (error) {
      console.error(`[syncProductNameToLingXing] 同步品名失败 sku=${sku} product_name=${product_name}`, error);
      throw error;
    }
  }
  
  /**
   * ???????????(MSKU??)
   * API: /basicOpen/multiplatform/profit/report/msku
   */
  async syncProfitReportMsku(
    queryRunner: QueryRunner,
    startDate?: string,
    endDate?: string
  ): Promise<number> {
    if (!startDate) {
      endDate = dayjs().subtract(1, "day").format("YYYY-MM-DD");
      startDate = dayjs(endDate).subtract(6, "day").format("YYYY-MM-DD");
    }
    if (!endDate) {
      endDate = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    }

    console.log(`[syncProfitReportMsku] start, startDate=${startDate}, endDate=${endDate}`);

    const profitFields = [
      "storeId", "storeName", "platformCode", "platformName", "msku", "productName",
      "localSku", "deliveryDate", "countryName", "bname", "cname", "developer",
      "currencyCode", "currencyIcon", "salesNum", "replacementNum", "salesAmount", "promotionDiscountAmount",
      "buyerFreightAmount", "platformOtherIncomeAmount", "incomeRefundAmount", "feeRefundAmount", "refundAmount", "refundNum",
      "refundRate", "returnedGoodsNum", "returnedGoodsRate", "promotionAmount", "platformLogisticsAmount", "promotionExtendAmount",
      "advertisementAmount", "adjustmentCostAmount", "platformStorageAmount", "platformFineAmount", "platformOtherAmount", "taxAmount",
      "marketTaxAmount", "customOtherProductAmount", "customOtherSellerAmount", "customOtherSalesOrderAmount", "purchaseAmount", "transportationAmount",
      "tailAmount", "otherAmount", "grossProfit", "grossProfitRate", "otherTaxesFees", "subsidyAmount",
      "platformWfsStorageAmount", "platformWfsRemoveAmount", "wfsWarehousFee", "wfsPrepServiceFee", "wfsInventoryTransferFee", "wfsInventoryRTVFee",
      "productCommission", "shippingCommission", "wfsAdjustmentCostAmount", "creditAdjustmentFee", "returnAdjustmentFee", "platformDetailOtherAmount",
      "commentAcceleratorFee", "walmartSavingsBenefit", "wfsLostInventoryFee", "wfsFoundInventoryFee", "wfsDamageInWarehouseFee", "wfsReceivingErrorChargeBackFee",
      "wfsChargeFee", "wfsShipmentFee", "walmartReturnServiceFee", "wfsReturnFee", "platformAdvertisingFee", "semMarketingFee",
      "reserveCreditedBackAmount", "excessRefundAdjustmentAmount", "walmartProductAdvertisingCreditsFee", "walmartPromoCode", "walmartExtraDiscount", "platformMultiChannelFulfillmentFee",
      "platformReserveFund", "sellerDiscount", "shopeeDiscount", "discountFromCoin", "discountFromVoucherShopee", "discountFromVoucherSeller",
      "paymentPromotion", "sellerCoinCashBack", "shippingFeeDiscountFrom3pl", "sellerShippingDiscount", "creditCardPromotion", "sellerLostCompensation",
      "shopeeShippingRebate", "sipSubsidy", "sellerReturnRefund", "drcAdjustableRefund", "proratedCoinsValueOffsetReturnItems", "proratedShopeeVoucherOffsetReturnItems",
      "proratedSellerVoucherOffsetReturnItems", "proratedPaymentChannelPromoBankOffsetReturnItems", "proratedPaymentChannelPromoShopeeOffsetReturnItems", "sellerProtectionFeeClaimAmount", "commissionFee", "amsCommissionFee",
      "actualShippingFee", "reverseShippingFee", "finalReturnToSellerShippingFee", "serviceFee", "buyerTransactionFee", "sellerTransactionFee",
      "creditCardTransactionFee", "campaignFee", "shippingSellerProtectionFeeAmount", "deliverySellerProtectionFeePremiumAmount", "overseasReturnServiceFee", "crossBorderTax",
      "escrowTax", "shippingFeeSst", "reverseShippingFeeSst", "salesTaxOnLvg", "finalProductVatTax", "finalShippingVatTax",
      "finalEscrowProductGst", "finalEscrowShippingGst", "vatOnImportedGoods", "selleroOrderProcessingFee", "buyerPaidPackagingFee", "withholdingPitTax",
      "withholdingVatTax", "withholdingTax", "afterSalesDeduction", "stockingViolation", "qualityBreach", "ecoFeeForGood",
      "logisticsEcoPackagingFee", "withholdingServiceFee", "ebaySubscriptionFee", "ebayPublicationFee", "regulatoryOperatingFee", "fundedCommissionFromSellerVirtualCredit",
      "reversalPromotionalChargesVouchers", "reverseSellerVirtualCreditCoFundVoucher", "sellerVirtualCreditCoFundVoucher", "shippingFeeSubsidyBySeller", "sellerDiscountAmount", "shippingFeeDiscountAmount",
      "codServiceFeeAmount", "refundSubtotalBeforeDiscountAmount", "sellerDiscountRefundAmount", "refundCodServiceFeeAmount", "affiliateCommissionAmount", "affiliatePartnerCommissionAmount",
      "tspCommissionAmount", "actualShippingFeeAmount", "returnShippingFeeAmount", "replacementShippingFeeAmount", "exchangeShippingFeeAmount", "signatureConfirmationFeeAmount",
      "shippingInsuranceFeeAmount", "transactionFeeAmount", "creditCardHandlingFeeAmount", "sfpServiceFeeAmount", "liveSpecialsFeeAmount", "bonusCashbackServiceFeeAmount",
      "mallServiceFeeAmount", "voucherXtraServiceFeeAmount", "flashSalesServiceFeeAmount", "cofundedPromotionServiceFeeAmount", "preOrderServiceFeeAmount", "sstAmount",
      "gstAmount", "salesTaxRefundAmount", "standardVatAmount", "importVatAmount", "ivaAmount", "isrAmount",
      "antiDumpingDutyAmount", "customsDutyAmount", "customsClearanceAmount", "chargeBack", "customerServiceCompensation", "deductionsIncurredBySeller",
      "gmvPaymentForAds", "platformCommissionAdjustment", "platformCommissionCompensation", "promotionAdjustment", "rebate", "platformCompensation",
      "platformReimbursement", "cofundedCreatorRewards", "logisticsReimbursement", "shippingFeeAdjustment", "shippingFeeCompensation", "shippingFeeRebate",
      "sampleShippingFee", "otherAdjustment", "fbtWarehouseServiceFee", "platformPenalty", "sellerPaylaterHandlingFeeAmount", "dtHandlingFeeAmount",
      "affiliateCommissionDeposit", "affiliateCommissionRelease", "tapShopAdsCommission", "shippingFeeGuaranteeServiceFee", "eprPobServiceFeeAmount", "feePerItemSoldAmount",
      "installationServiceFee", "cofundedCreatorBonusAmount", "failedDeliverySubsidyAmount", "fbtFreeShippingFeeAmount", "freeReturnSubsidyAmount", "returnShippingFeePaidBuyerAmount",
      "returnShippingLabelFeeAmount", "shippingFeeGuaranteeReimbursement", "promoShippingIncentiveAmount", "returnRefundSubsidyAmount", "fbtFulfillmentFeeReimbursementAmount"
    ];

    let offset = 0;
    const length = 200;
    let totalCount = 0;
    let hasMore = true;

    while (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const body = { offset, length, startDate, endDate };

      try {
        const result: any = await this.httpPost("/basicOpen/multiplatform/profit/report/msku", body, true);
        const records = Array.isArray(result?.data?.list) ? result.data.list : [];
        const totalSum = result?.data?.totalSum || null;
        if (!records.length) {
          hasMore = false;
          break;
        }

        const entitiesToSave: AppAmzLingxingProfitReportMskuEntity[] = [];
        for (const record of records) {
          const msku = String(record.msku || "").trim();
          const storeId = String(record.storeId || "").trim();
          if (!msku || !storeId) continue;

          const entity = new AppAmzLingxingProfitReportMskuEntity();
          entity.requestStartDate = startDate;
          entity.requestEndDate = endDate;
          for (const field of profitFields) {
            (entity as any)[field] = record[field] ?? null;
          }
          entity.storeId = storeId;
          entity.platformCode = entity.platformCode || "";
          entity.msku = msku;
          entity.localSku = entity.localSku || "";
          entity.countryName = entity.countryName || "";
          entity.currencyCode = entity.currencyCode || "";
          entity.totalSum = totalSum;
          entity.raw_data = record;
          entitiesToSave.push(entity);
        }

        if (entitiesToSave.length > 0) {
          for (let i = 0; i < entitiesToSave.length; i += 500) {
            const batch = entitiesToSave.slice(i, i + 500);
            for (const entity of batch) {
              const existing = await queryRunner.manager.findOne(AppAmzLingxingProfitReportMskuEntity, {
                where: {
                  storeId: entity.storeId,
                  platformCode: entity.platformCode,
                  msku: entity.msku,
                  localSku: entity.localSku,
                  countryName: entity.countryName,
                  requestStartDate: entity.requestStartDate,
                  requestEndDate: entity.requestEndDate,
                  currencyCode: entity.currencyCode,
                },
              });
              if (existing) entity.id = existing.id;
            }
            await queryRunner.manager.save(batch);
          }
          totalCount += entitiesToSave.length;
        }

        if (records.length < length) hasMore = false; else offset += length;
      } catch (error) {
        console.error("[syncProfitReportMsku] error:", error);
        hasMore = false;
      }
    }

    console.log(`[syncProfitReportMsku] done, saved ${totalCount} records`);
    return totalCount;
  }

  /**
   * ????????
   * API: /bd/productPerformance/openApi/asinList
   */
  async syncProductPerformanceAsin(
    queryRunner: QueryRunner,
    sidList: number[],
    startDate?: string,
    endDate?: string,
    summaryField: "asin" | "parent_asin" | "msku" | "sku" = "asin"
  ): Promise<number> {
    if (!startDate) {
      endDate = dayjs().subtract(1, "day").format("YYYY-MM-DD");
      startDate = dayjs(endDate).subtract(14, "day").format("YYYY-MM-DD");
    }
    if (!endDate) {
      endDate = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    }
    if (!sidList || sidList.length === 0) {
      console.log("[syncProductPerformanceAsin] sidList empty, skip");
      return 0;
    }

    console.log(`[syncProductPerformanceAsin] start, sidList=${sidList}, startDate=${startDate}, endDate=${endDate}`);

    const performanceFields = [
      "parent_asins", "asins", "price_list", "prev_cate_rank", "item_name", "cate_rank",
      "small_cate_rank", "currency_icon", "seller_store_countries", "categories", "brands", "principal_names",
      "developer_names", "month_stock_sales_ratio", "volume", "order_items", "order_items_chain", "amount",
      "volume_chain_ratio", "volume_chain", "amount_chain_ratio", "amount_chain", "order_chain_ratio", "b2b_volume",
      "b2b_amount", "b2b_order_items", "gross_profit", "predict_gross_profit", "gross_margin", "predict_gross_margin",
      "roi", "promotion_volume", "promotion_amount", "promotion_order_items", "promotion_discount", "reviews_count",
      "return_count", "return_rate", "afn_fulfillable_quantity", "afn_inbound_receiving_quantity", "afn_inbound_shipped_quantity", "afn_inbound_working_quantity",
      "afn_unsellable_quantity", "afn_total_inbound", "reserved_fc_processing", "reserved_fc_transfers", "fbm_quantity", "reserved_customerorders",
      "stock_up_num", "clicks", "available_days", "fbm_available_days", "avg_star", "prev_star",
      "comment_rate", "sessions", "sessions_mobile", "sessions_total", "buy_box_percentage", "page_views",
      "page_views_mobile", "page_views_total", "adv_rate", "ad_cvr", "volume_cvr", "cvr",
      "ctr", "acoas", "acos", "tacos", "has_oprator_log", "return_goods_count",
      "fba_return_goods_count", "fbm_return_goods_count", "return_goods_rate", "fba_return_goods_rate", "fbm_return_goods_rate", "cpc",
      "spend", "shared_cost_of_advertising", "shared_ads_sb_cost", "shared_ads_sbv_cost", "ads_sd_cost", "ads_sp_cost",
      "shared_ads_al_cost", "shared_ads_cc_cost", "shared_ads_sspaot_cost", "shared_ads_sar_cost", "roas", "asoas",
      "cpo", "cpm", "ad_sales_amount", "ads_sp_sales", "ads_sd_sales", "shared_ads_sb_sales",
      "shared_ads_sbv_sales", "ad_order_quantity", "impressions", "sids", "net_amount", "small_image_url",
      "currency_code", "ranking_update_time", "avg_volume", "avg_custom_price", "icon_num", "sku",
      "local_name", "spu_spu_names", "attributes", "cg_price", "whs_value", "cg_price_currency_icon",
      "local_quantity", "oversea_quantity", "inventory_sales_ratio", "avg_landed_price", "suppliers", "model",
      "return_amount", "fbm_buyer_expenses", "points_number", "product_create_time", "ad_direct_sales_amount", "ad_direct_order_quantity",
      "rank_category", "available_inventory", "tag_set"
    ];
    const firstArrayItem = (value: any) => Array.isArray(value) && value.length > 0 ? value[0] : null;
    const getPrimaryValue = (item: any) => {
      if (summaryField === "asin") return firstArrayItem(item.asins)?.asin || item.asin || "";
      if (summaryField === "parent_asin") return firstArrayItem(item.parent_asins)?.parent_asin || item.parent_asin || "";
      if (summaryField === "msku") return firstArrayItem(item.price_list)?.seller_sku || item.msku || "";
      return item.sku || "";
    };
    const getSid = (item: any) => {
      const sids = Array.isArray(item.sids) ? item.sids : [];
      const asinSid = firstArrayItem(item.asins)?.sid;
      const priceSid = firstArrayItem(item.price_list)?.sid;
      return Number((sids.length === 1 ? sids[0] : null) ?? asinSid ?? priceSid ?? 0);
    };

    let offset = 0;
    const length = 1000;
    let totalCount = 0;
    let hasMore = true;

    while (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const body = {
        sid: sidList,
        offset,
        length,
        sort_field: "volume",
        sort_type: "desc",
        summary_field: summaryField,
        start_date: startDate,
        end_date: endDate,
        currency_code: "CNY",
        is_recently_enum: true,
        purchase_status: 0,
      };

      try {
        const result: any = await this.httpPost("/bd/productPerformance/openApi/asinList", body);
        const list = Array.isArray(result?.data?.list)
          ? result.data.list
          : Array.isArray(result?.list)
          ? result.list
          : [];
        if (!list.length) {
          hasMore = false;
          break;
        }

        const entitiesToSave: AppAmzLingxingProductPerformanceAsinEntity[] = [];
        for (const item of list) {
          const primaryValue = String(getPrimaryValue(item)).trim();
          if (!primaryValue) continue;

          const entity = new AppAmzLingxingProductPerformanceAsinEntity();
          entity.summary_field = summaryField;
          entity.primary_value = primaryValue;
          entity.sid = getSid(item);
          entity.start_date = startDate;
          entity.end_date = endDate;
          for (const field of performanceFields) {
            (entity as any)[field] = item[field] ?? null;
          }
          entity.currency_code = entity.currency_code || "";
          entity.raw_data = item;
          entitiesToSave.push(entity);
        }

        if (entitiesToSave.length > 0) {
          for (let i = 0; i < entitiesToSave.length; i += 500) {
            const batch = entitiesToSave.slice(i, i + 500);
            for (const entity of batch) {
              const existing = await queryRunner.manager.findOne(
                AppAmzLingxingProductPerformanceAsinEntity,
                {
                  where: {
                    summary_field: entity.summary_field,
                    primary_value: entity.primary_value,
                    sid: entity.sid,
                    start_date: entity.start_date,
                    end_date: entity.end_date,
                    currency_code: entity.currency_code,
                  },
                }
              );
              if (existing) entity.id = existing.id;
            }
            await queryRunner.manager.save(batch);
          }
          totalCount += entitiesToSave.length;
        }

        if (list.length < length) hasMore = false; else offset += length;
      } catch (error) {
        console.error("[syncProductPerformanceAsin] error:", error);
        hasMore = false;
      }
    }

    console.log(`[syncProductPerformanceAsin] done, saved ${totalCount} records`);
    return totalCount;
  }

}
