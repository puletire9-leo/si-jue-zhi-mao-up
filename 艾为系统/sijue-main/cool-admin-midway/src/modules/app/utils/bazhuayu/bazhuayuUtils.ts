import { App, Provide } from "@midwayjs/decorator";
import { Init, Singleton } from "@midwayjs/core";
import { InjectEntityModel } from "@midwayjs/typeorm";
import { BaseSysParamEntity } from "../../../base/entity/sys/param";
import { Repository } from "typeorm";
import { Application } from "@midwayjs/koa";
import axios, { AxiosRequestConfig } from "axios";

interface TokenResponse {
  data?: {
    access_token: string;
    expires_in: string;
    token_type: string;
    refresh_token: string;
  };
  requestId: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface TaskStatus {
  taskId: string;
  taskName: string;
  status: "Unexecuted" | "Waiting" | "Extracting" | "Stopped" | "Finished";
}

export interface TaskStatusResponse {
  data: TaskStatus[];
  requestId: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface UpdateLoopItemsResponse {
  data: {
    message: string;
  };
  requestId: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface StopTaskResponse {
  data: null;
  requestId: string;
  error?: {
    code: string;
    message: string;
  };
}

// 修正：price改为string类型，保留原始字符串
export interface AmzTargetData {
  ASIN: string;
  imgurl1: string;
  任务源网址: string;
  国家: string;
  price: string; // 原始价格字符串（可能含货币符号、逗号等）
}

interface MarkExportedResponse {
  data: null;
  requestId: string;
  error?: {
    code: string;
    message: string;
  };
}

interface AmzRawNotExportedItem {
  [key: string]: any;
}

interface AmzRawNotExportedResponse {
  data: {
    total: number;
    current: number;
    data: AmzRawNotExportedItem[];
  };
  requestId: string;
  error?: {
    code: string;
    message: string;
  };
}

@Provide()
@Singleton()
export class BazhuayuUtils {
  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamRepo: Repository<BaseSysParamEntity>;

  @App()
  app: Application;

  bzy_api_host: string = 'https://openapi.bazhuayu.com';
  bzy_username: string = '';
  bzy_password: string = '';
  bzy_access_token: string = null;
  bzy_refresh_token: string = null;
  bzy_token_type: string = 'Bearer';
  bzy_token_expiration: number = 0;

  async init() {
    if (this.bzy_access_token) {
      return;
    }

    const param_host = await this.baseSysParamRepo.findOne({ where: { keyName: 'bzyHost' } });
    const param_username = await this.baseSysParamRepo.findOne({ where: { keyName: 'bzyUsername' } });
    const param_password = await this.baseSysParamRepo.findOne({ where: { keyName: 'bzyPassword' } });
    const param_access_token = await this.baseSysParamRepo.findOne({ where: { keyName: 'bzyAccessToken' } });
    const param_refresh_token = await this.baseSysParamRepo.findOne({ where: { keyName: 'bzyRefreshToken' } });
    const param_token_expiration = await this.baseSysParamRepo.findOne({ where: { keyName: 'bzyTokenExpiration' } });

    if (param_host?.data) this.bzy_api_host = param_host.data.trim();
    if (param_username?.data) this.bzy_username = param_username.data.trim();
    if (param_password?.data) this.bzy_password = param_password.data.trim();
    if (param_access_token?.data) this.bzy_access_token = param_access_token.data.trim();
    if (param_refresh_token?.data) this.bzy_refresh_token = param_refresh_token.data.trim();
    if (param_token_expiration?.data) this.bzy_token_expiration = parseInt(param_token_expiration.data);
  }

  async getAccessToken(forceRefresh: boolean = false) {
    const needRefresh = forceRefresh
      || !this.bzy_access_token
      || this.bzy_token_expiration - Date.now() < 1000 * 60 * 10;

    if (!needRefresh) {
      return;
    }

    let response: TokenResponse;

    try {
      if (this.bzy_refresh_token && !forceRefresh) {
        response = await this.refreshToken();
      }

      if (!response?.data?.access_token) {
        response = await this.fetchNewToken();
      }

      if (response?.data?.access_token) {
        this.bzy_access_token = response.data.access_token;
        this.bzy_refresh_token = response.data.refresh_token;
        this.bzy_token_type = response.data.token_type;
        this.bzy_token_expiration = Date.now() + parseInt(response.data.expires_in) * 1000;
        await this.saveTokenToDB();
      } else {
        throw new Error(`获取Token失败: ${response?.error?.message || '未知错误'}`);
      }
    } catch (error) {
      throw error;
    }
  }

  private async fetchNewToken(): Promise<TokenResponse> {
    if (!this.bzy_username || !this.bzy_password) {
      throw new Error('八爪鱼平台用户名或密码未配置');
    }

    const url = `${this.bzy_api_host}/token`;
    const config: AxiosRequestConfig = {
      method: 'POST',
      url,
      headers: { 'Content-Type': 'application/json' },
      data: { username: this.bzy_username, password: this.bzy_password, grant_type: 'password' }
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  private async refreshToken(): Promise<TokenResponse> {
    const url = `${this.bzy_api_host}/token`;
    const config: AxiosRequestConfig = {
      method: 'POST',
      url,
      headers: { 'Content-Type': 'application/json' },
      data: { refresh_token: this.bzy_refresh_token, grant_type: 'refresh_token' }
    };

    const response = await axios(config);
    return response.data;
  }

  private async saveTokenToDB() {
    let paramAccessToken = await this.baseSysParamRepo.findOne({ where: { keyName: 'bzyAccessToken' } });
    if (paramAccessToken) {
      paramAccessToken.data = this.bzy_access_token;
      await this.baseSysParamRepo.save(paramAccessToken);
    } else {
      await this.baseSysParamRepo.insert({ keyName: 'bzyAccessToken', data: this.bzy_access_token, dataType: 0 });
    }

    let paramRefreshToken = await this.baseSysParamRepo.findOne({ where: { keyName: 'bzyRefreshToken' } });
    if (paramRefreshToken) {
      paramRefreshToken.data = this.bzy_refresh_token;
      await this.baseSysParamRepo.save(paramRefreshToken);
    } else {
      await this.baseSysParamRepo.insert({ keyName: 'bzyRefreshToken', data: this.bzy_refresh_token, dataType: 0 });
    }

    let paramExpiration = await this.baseSysParamRepo.findOne({ where: { keyName: 'bzyTokenExpiration' } });
    if (paramExpiration) {
      paramExpiration.data = String(this.bzy_token_expiration);
      await this.baseSysParamRepo.save(paramExpiration);
    } else {
      await this.baseSysParamRepo.insert({ keyName: 'bzyTokenExpiration', data: String(this.bzy_token_expiration), dataType: 0 });
    }
  }

  checkIfTokenInvalid(resData: any): boolean {
    if (resData?.error) {
      const invalidCodes = ['Invalid.Grant', 'Invalid.Token'];
      return invalidCodes.includes(resData.error.code);
    }
    return false;
  }

  async httpDo(
    method: string = 'get',
    apiPath: string,
    params: any = {},
    returnRawResponse: boolean = false
  ) {
    console.log(`准备执行HTTP请求: ${method} ${apiPath}`);

    await this.init();
    await this.getAccessToken();
    console.log(`发送${method}请求到: ${this.bzy_api_host}${apiPath}`);

    const url = `${this.bzy_api_host}${apiPath}`;
    const config: AxiosRequestConfig = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${this.bzy_token_type} ${this.bzy_access_token}`
      }
    };

    if (method.toLowerCase() === 'get') {
      config.params = params;
    } else {
      config.data = params;
    }

    try {
      const response = await axios(config);
      const result = returnRawResponse ? response : response.data;

      if (this.checkIfTokenInvalid(result)) {
        await this.getAccessToken(true);
        return this.httpDo(method, apiPath, params, returnRawResponse);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  async httpGet(apiPath: string, params?: any, returnRawResponse: boolean = false) {
    return this.httpDo('get', apiPath, params, returnRawResponse);
  }

  async httpPost(apiPath: string, params?: any, returnRawResponse: boolean = false) {
    return this.httpDo('post', apiPath, params, returnRawResponse);
  }

  async stopTask(taskId: string): Promise<StopTaskResponse> {
    return this.httpPost('/cloudextraction/stop', { taskId }) as Promise<StopTaskResponse>;
  }

  async getTaskStatuses(taskIds: string[]): Promise<TaskStatusResponse> {
    return this.httpPost('/cloudextraction/statuses', { taskIds }) as Promise<TaskStatusResponse>;
  }

  async updateLoopItems(params: {
    taskId: string;
    actionId: string;
    loopType: "UrlList";
    loopItems: string[];
    isAppend?: boolean;
  }): Promise<UpdateLoopItemsResponse> {
    return this.httpPost('/task/updateLoopItems', params) as Promise<UpdateLoopItemsResponse>;
  }

  async markDataAsExported(taskId: string): Promise<MarkExportedResponse> {
    if (!taskId) throw new Error('标记已导出失败：taskId不能为空');

    console.log(`开始标记数据为已导出：taskId=${taskId}`);
    return this.httpPost('/data/markexported', { taskId }) as Promise<MarkExportedResponse>;
  }

  /**
   * 格式化价格字符串为数字（去除货币符号、千位分隔符等）
   * @param priceStr 原始价格字符串（如 "€19.99"、"1,299.99"、"29"）
   * @returns 格式化后的数字，失败则返回 null
   */
  formatPrice(priceStr: string): number | null {
    if (!priceStr || typeof priceStr !== 'string') return null;

    // 1. 处理常见货币代码和符号
    // 将 "CNY 76.72", "US 76.72", "€19.99", "£20.50" 等统一处理
    // 移除所有非数字、非小数点、非负号的字符
    // 注意：某些国家使用逗号作为小数点（如德语区），需要特殊处理
    
    // 预处理：移除常见的货币代码（不区分大小写）
    let cleaned = priceStr.replace(/(CNY|USD|EUR|GBP|US|RMB|€|£|\$|¥)/gi, '').trim();

    // 2. 处理千位分隔符和小数点
    // 策略：
    // - 如果包含多个点或逗号，通常最后一个是小数点，前面的都是千位符
    // - 比如 "1,234.56" -> 1234.56
    // - 比如 "1.234,56" (德语) -> 1234.56

    // 替换所有逗号为点（统一化，方便后续判断）
    // 注意：这只是为了判断结构，不能直接替换
    
    // 简单粗暴法：只保留数字、点、逗号、负号
    cleaned = cleaned.replace(/[^\d.,-]/g, '');

    if (!cleaned) return null;

    // 判断小数点位置
    const lastDotIndex = cleaned.lastIndexOf('.');
    const lastCommaIndex = cleaned.lastIndexOf(',');

    let finalStr = cleaned;

    if (lastDotIndex > lastCommaIndex) {
        // 格式如 1,234.56 或 1234.56
        // 去除所有逗号
        finalStr = cleaned.replace(/,/g, '');
    } else if (lastCommaIndex > lastDotIndex) {
        // 格式如 1.234,56 或 1234,56 (欧洲常用)
        // 去除所有点，将逗号换成点
        finalStr = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        // 没有点和逗号，或者是纯整数
        // 不做额外处理
    }

    // 再次清理可能残留的非数字字符（除了点和负号）
    finalStr = finalStr.replace(/[^\d.-]/g, '');

    // 3. 解析数字
    const num = parseFloat(finalStr);
    
    // 检查是否为有效数字
    if (isNaN(num)) return null;

    return num;
  }

  async getAmzStructuredData(
    taskId: string,
    country: string = 'UK',
    size: number = 100,
    fieldMap: {
      asinKey: string;
      imgUrlKey: string;
      sourceUrlKey: string;
      priceKey: string;
    } = {
      asinKey: 'ASIN',
      imgUrlKey: 'imgurl1',
      sourceUrlKey: '任务源网址',
      priceKey: '价格'  
    }
  ): Promise<{
    total: number;
    current: number;
    structuredData: AmzTargetData[];
    requestId: string;
  }> {
    if (!taskId) throw new Error('获取亚马逊数据失败：taskId不能为空');
    if (size < 1 || size > 1000) throw new Error('获取亚马逊数据失败：size必须在1-1000之间');

    console.log(`开始获取亚马逊结构化数据：taskId=${taskId}，国家=${country}，size=${size}`);
    const rawResponse = await this.httpGet('/data/notexported', { taskId, size }) as AmzRawNotExportedResponse;

    if (rawResponse.error) {
      throw new Error(`八爪鱼接口返回错误：${rawResponse.error.code} - ${rawResponse.error.message}，requestId=${rawResponse.requestId}`);
    }

    const dataList = rawResponse?.data?.data || [];
    
    // 保留原始价格字符串，不做转换
    const structuredData: AmzTargetData[] = dataList.map((rawItem) => ({
      ASIN: rawItem[fieldMap.asinKey] || '',
      imgurl1: rawItem[fieldMap.imgUrlKey] || '',
      任务源网址: rawItem[fieldMap.sourceUrlKey] || '',
      price: rawItem[fieldMap.priceKey]?.toString() || '', // 转为字符串保存
      国家: country
    })).filter(item => item.ASIN); // 过滤无ASIN的数据

    return {
      total: rawResponse.data.total,
      current: structuredData.length,
      structuredData,
      requestId: rawResponse.requestId
    };
  }
}