import { Readable } from 'stream';
import { Provide } from '@midwayjs/decorator';
import axios from 'axios';
import * as oss from '@alicloud/oss-util';
import { RateLimit } from 'async-sema';
import { BaseSysParamEntity } from '../../base/entity/sys/param'; 
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';

const imagesearch = require('@alicloud/imagesearch20201214');

const UNRECOVERABLE_ERRORS = {
  IMAGE: [
    '图片不存在(404)',
    '非图片类型',
    'URL指向的内容不是图片类型',
    '操作超时',
    '图片获取失败'
  ],
  API: [
    '无效的API响应结构',
    'API认证失败',
    '资源不存在',
    '参数错误'
  ]
};

@Provide()
export class ImageSimilarityTool {
  private aliImageClient: any;
  private aliCloudAPILimiter: any;
  private downloadRateLimiter: any;

  private accessKeyId: string;
  private accessKeySecret: string;
  private instanceName: string;
  private readonly endpoint = "imagesearch.cn-shenzhen.aliyuncs.com";
  private readonly regionId = "cn-shenzhen";

  private isInitialized = false;
  private initLock = false;

  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamRepo: Repository<BaseSysParamEntity>;

  /**
   * 延迟初始化：确保TypeORM准备好后再执行
   */
  private async lazyInit() {
    if (this.isInitialized) return;
    if (this.initLock) {
      let waitCount = 0;
      while (this.initLock && waitCount < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        waitCount++;
      }
      if (this.isInitialized) return;
      throw new Error('初始化超时：等待TypeORM就绪失败');
    }

    try {
      this.initLock = true;
      console.log(`[${this.getNowTime()}] [lazyInit] 开始延迟初始化...`);
;
      const accessKeyIdParam = await this.baseSysParamRepo.findOne({ where: { keyName: 'aliyun_imagesearch_accessKeyId' } });
      const accessKeySecretParam = await this.baseSysParamRepo.findOne({ where: { keyName: 'aliyun_imagesearch_accessKeySecret' } });
      const instanceNameParam = await this.baseSysParamRepo.findOne({ where: { keyName: 'aliyun_imagesearch_instanceName' } });

      // 验证配置完整性
      if (!accessKeyIdParam?.data || !accessKeySecretParam?.data) {
        const err = new Error('阿里云图像搜索配置不完整（accessKeyId/accessKeySecret缺失）');
        console.error(`[${this.getNowTime()}] [lazyInit] 初始化失败: ${err.message}, 堆栈: ${err.stack}`);
        throw err;
      }

      this.accessKeyId = accessKeyIdParam.data.trim();
      this.accessKeySecret = accessKeySecretParam.data.trim();
      this.instanceName = (instanceNameParam?.data || '').trim();

      // 初始化阿里云客户端
      this.aliImageClient = new imagesearch.default({
        accessKeyId: this.accessKeyId,
        accessKeySecret: this.accessKeySecret,
        type: "access_key",
        endpoint: this.endpoint,
        regionId: this.regionId,
        protocol: 'https'
      });

      // 初始化限流器
      this.aliCloudAPILimiter = RateLimit(10, {
        timeUnit: 1000,
        uniformDistribution: true
      });

      this.downloadRateLimiter = RateLimit(10, {
        timeUnit: 1000
      });

      this.isInitialized = true;
      console.log(`[${this.getNowTime()}] [lazyInit] 延迟初始化完成`);
    } catch (error) {
      const err = error as Error;
      console.error(`[${this.getNowTime()}] [lazyInit] 初始化失败: ${err.message}, 堆栈: ${err.stack}`);
      throw err;
    } finally {
      this.initLock = false;
    }
  }

  /**
   * 带超时控制的异步操作包装器
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    errorMessage?: string
  ): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        const err = new Error(errorMessage || `操作超时 (${ms}ms)`);
        reject(err);
      }, ms);
    });
    return Promise.race<T>([promise, timeout]);
  }

  /**
   * 生成唯一请求ID
   */
  private generateRequestId(prefix: string = 'req'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 获取当前时间（日志格式化）
   */
  private getNowTime(): string {
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }


  /**
   * 图片URL转换为流
   */
  private async urlToStream(url: string, maxRetries = 3): Promise<Readable> {
    await this.lazyInit();
    
    const reqId = this.generateRequestId('stream');
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      let axiosResponse: any = null;
      try {
        await this.withTimeout(
          this.downloadRateLimiter(),
          5000,
          `下载限流等待超时 [URL: ${url}]`
        );

        axiosResponse = await this.withTimeout(
          axios.get(url, {
            responseType: 'stream',
            timeout: 8000,
            headers: {
              'User-Agent': this.getRandomUserAgent(),
              'Accept': 'image/webp,image/*,*/*;q=0.8',
              'Referer': 'https://www.amazon.com/'
            }
          }),
          10000,
          `图片下载超时 (URL: ${url})`
        );

        const status = axiosResponse.status;
        const contentType = axiosResponse.headers['content-type'] || '';

        if (status === 404) throw new Error(`图片不存在(404) [URL: ${url}]`);
        if (status >= 500) throw new Error(`服务器错误(${status}) [URL: ${url}]`);
        if (!contentType.startsWith('image/')) {
          throw new Error(`非图片类型: ${contentType} [URL: ${url}]`);
        }

        const stream = axiosResponse.data;
        stream.on('error', (err: Error) => {
          console.warn(`[${this.getNowTime()}] [urlToStream] [${reqId}] 流处理错误: ${err.message}, URL: ${url}`);
          stream.destroy(err);
        });
        stream.on('end', () => {
          console.log(`[${this.getNowTime()}] [urlToStream] [${reqId}] 流消费完成, URL: ${url}`);
        });

        return stream;

      } catch (error) {
        lastError = error as Error;
        if (axiosResponse?.data?.destroy) {
          axiosResponse.data.destroy(lastError);
          console.warn(`[${this.getNowTime()}] [urlToStream] [${reqId}] 下载失败，销毁流: ${url}`);
        }

        const isUnrecoverable = UNRECOVERABLE_ERRORS.IMAGE.some(msg => 
          lastError.message.includes(msg)
        );
        if (isUnrecoverable) {
          console.error(`[${this.getNowTime()}] [urlToStream] [${reqId}] 不可恢复错误: ${lastError.message}, URL: ${url}, 堆栈: ${lastError.stack}`);
          throw lastError;
        }

        retryCount++;
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 3000);
          console.warn(`[${this.getNowTime()}] [urlToStream] [${reqId}] 下载失败，准备重试 (${retryCount}/${maxRetries}), 延迟${delay}ms, URL: ${url}, 错误: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const finalErr = new Error(`图片获取失败（达到最大重试次数）[URL: ${url}]`);
    console.error(`[${this.getNowTime()}] [urlToStream] [${reqId}] 下载失败: ${finalErr.message}, 最后错误: ${lastError?.message}, 堆栈: ${finalErr.stack}`);
    throw finalErr;
  }

  /**
   * 生成随机User-Agent
   */
  private getRandomUserAgent(): string {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:95.0) Gecko/20100101 Firefox/95.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15'
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  /**
   * 获取图片相似度分数
   */
  public async getSimilarityScore(
    imageUrl: string, 
    asin_candidate: string, 
    asin_competitor: string
  ): Promise<number | null> {
    await this.lazyInit();
    
    return this.withTimeout<number | null>(
      this._doGetSimilarityScore(imageUrl, asin_candidate, asin_competitor),
      30000,
      `相似度查询总超时 [ASIN候选: ${asin_candidate}, URL: ${imageUrl}]`
    );
  }

  private async _doGetSimilarityScore(
    imageUrl: string, 
    asin_candidate: string, 
    asin_competitor: string
  ): Promise<number | null> {
    const reqId = this.generateRequestId('similarity');
    console.log(`[${this.getNowTime()}] [getSimilarityScore] [${reqId}] 开始处理: 候选ASIN=${asin_candidate}, 竞品ASIN=${asin_competitor}, URL=${imageUrl}`);

    const MAX_RETRIES = 2;
    let retryCount = 0;
    let imageStream: Readable | null = null;

    try {
      while (retryCount < MAX_RETRIES) {
        try {
          await this.withTimeout(
            this.aliCloudAPILimiter(),
            5000,
            `API限流等待超时 [请求ID: ${reqId}, 候选ASIN: ${asin_candidate}]`
          );

          imageStream = await this.urlToStream(imageUrl);

          const safeAsin = asin_candidate.replace(/'/g, "\\'");
          const filter = `strAttr='${safeAsin}'`;
          const request = new imagesearch.SearchImageByPicAdvanceRequest({
            instanceName: this.instanceName,
            picContentObject: imageStream,
            crop: false,
            categoryId: 88888888,
            num: 100,
            filter: filter
          });

          const apiResponse = await this.withTimeout(
            this.aliImageClient.searchImageByPicAdvance(request, new oss.RuntimeOptions({})),
            10000,
            `API请求超时 [请求ID: ${reqId}, 候选ASIN: ${asin_candidate}]`
          );

          const responseBody = (apiResponse as any)?.body ?? {};
          if (typeof responseBody !== 'object') {
            throw new Error(`无效的API响应结构 [请求ID: ${reqId}]`);
          }

          if (responseBody.code !== 0) {
            const errMsg = `API业务错误 [状态码: ${responseBody.code}, 消息: ${responseBody.message}, 请求ID: ${reqId}]`;
            if ([400, 403, 404].includes(responseBody.code)) {
              throw new Error(`不可恢复${errMsg}`);
            }
            throw new Error(errMsg);
          }

          const auctions = Array.isArray(responseBody.auctions) ? responseBody.auctions : [];
          const matchedItem = auctions.find((auction: any) => 
            auction?.productId?.toString() === asin_candidate
          );
          let score = Number(matchedItem?.score ?? 0);
          score = isNaN(score) ? 0 : Math.min(Math.max(score, 0), 1);

          // 2026-04-10: 日志简化 - 仅0分打印
          if (score === 0) {
            console.log(`[${this.getNowTime()}] [getSimilarityScore] [${reqId}] 处理成功(0分): 候选ASIN=${asin_candidate}, 相似度=${score}, 匹配结果数=${auctions.length}`);
          }
          return score;

        } catch (error) {
          const err = error as Error;
          if (imageStream?.destroy) {
            imageStream.destroy(err);
            imageStream = null;
          }

          const isUnrecoverable = [
            ...UNRECOVERABLE_ERRORS.IMAGE,
            ...UNRECOVERABLE_ERRORS.API
          ].some(msg => err.message.includes(msg));

          if (isUnrecoverable) {
            console.error(`[${this.getNowTime()}] [getSimilarityScore] [${reqId}] 不可恢复错误，终止重试: 候选ASIN=${asin_candidate}, 错误=${err.message}, 堆栈=${err.stack}`);
            throw err;
          }

          retryCount++;
          if (retryCount < MAX_RETRIES) {
            const delay = 1000;
            console.warn(`[${this.getNowTime()}] [getSimilarityScore] [${reqId}] 请求失败，准备重试 (${retryCount}/${MAX_RETRIES}): 候选ASIN=${asin_candidate}, 延迟${delay}ms, 错误=${err.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      const retryErr = new Error(`达到最大重试次数 [请求ID: ${reqId}, 候选ASIN: ${asin_candidate}]`);
      console.error(`[${this.getNowTime()}] [getSimilarityScore] [${reqId}] 处理失败: ${retryErr.message}, 堆栈=${retryErr.stack}`);
      return null;

    } catch (error) {
      const err = error as Error;
      console.error(`[${this.getNowTime()}] [getSimilarityScore] [${reqId}] 异常终止: 候选ASIN=${asin_candidate}, URL=${imageUrl}, 错误=${err.message}, 堆栈=${err.stack}`);
      throw err;
    }
  }

  /**
   * 相似度查询2
   */
  public async getSimilarityScore2(imageUrl: string, targetAsin: string): Promise<number> {
    await this.lazyInit();
    
    const reqId = this.generateRequestId('similarity2');
    // 2026-04-10: 日志简化 - 取消打印每次开始识图
    // console.log(`[${this.getNowTime()}] [getSimilarityScore2] [${reqId}] 开始处理: 目标ASIN=${targetAsin}, URL=${imageUrl}`);

    const MAX_ERROR_RETRIES = 3;
    const MAX_ZERO_RETRIES = 5;
    let errorRetryCount = 0;
    let zeroRetryCount = 0;
    let imageStream: Readable | null = null;

    try {
      return await this.withTimeout(
        (async () => {
          while (zeroRetryCount < MAX_ZERO_RETRIES) {
            errorRetryCount = 0;
            imageStream = null;

            while (errorRetryCount <= MAX_ERROR_RETRIES) {
              try {
                await this.withTimeout(
                  this.aliCloudAPILimiter(),
                  5000,
                  `API限流等待超时 [请求ID: ${reqId}, 目标ASIN: ${targetAsin}]`
                );
                
                imageStream = await this.urlToStream(imageUrl);

                const request = new imagesearch.SearchImageByPicAdvanceRequest({
                  instanceName: this.instanceName,
                  picContentObject: imageStream,
                  crop: false,
                  categoryId: 88888888
                });

                const apiResponse = await this.withTimeout(
                  this.aliImageClient.searchImageByPicAdvance(request, new oss.RuntimeOptions({})),
                  10000,
                  `API请求超时 [请求ID: ${reqId}, 目标ASIN: ${targetAsin}]`
                );

                const responseBody = (apiResponse as any)?.body ?? {};
                if (responseBody.code !== 0) {
                  const errMsg = `业务错误 [状态码: ${responseBody.code}, 消息: ${responseBody.msg || responseBody.message}]`;
                  console.error(`[${this.getNowTime()}] [getSimilarityScore2] [${reqId}] ${errMsg}: 目标ASIN=${targetAsin}`);
                  throw new Error(errMsg);
                }

                const targetMatch = responseBody.auctions?.find((item: any) => item.strAttr === '2');
                const score = targetMatch?.score ?? 0;

                if (score === 0) {
                  zeroRetryCount++;
                  if (zeroRetryCount >= MAX_ZERO_RETRIES) {
                    console.warn(`[${this.getNowTime()}] [getSimilarityScore2] [${reqId}] 达到最大0分重试次数: 目标ASIN=${targetAsin}, 返回0分`);
                    return 0;
                  }
                  console.log(`[${this.getNowTime()}] [getSimilarityScore2] [${reqId}] 0分重试 (${zeroRetryCount}/${MAX_ZERO_RETRIES}): 目标ASIN=${targetAsin}, 1秒后重试`);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  break;
                }

                // 2026-04-10: 日志简化 - 仅0分打印
                if (score === 0) {
                  console.log(`[${this.getNowTime()}] [getSimilarityScore2] [${reqId}] 处理成功(0分): 目标ASIN=${targetAsin}, 分数=${score}`);
                }
                return score;

              } catch (error) {
                const err = error as Error;
                if (imageStream?.destroy) {
                  imageStream.destroy(err);
                  imageStream = null;
                }

                // 如果是UnsupportedPicPixels错误，直接抛出，不重试
                if (err.message && err.message.includes('UnsupportedPicPixels')) {
                  throw err;
                }

                errorRetryCount++;
                if (errorRetryCount > MAX_ERROR_RETRIES) {
                  console.error(`[${this.getNowTime()}] [getSimilarityScore2] [${reqId}] 错误重试达到上限: 目标ASIN=${targetAsin}, 错误=${err.message}, 堆栈=${err.stack}`);
                  break;
                }

                const delay = Math.min(1000 * Math.pow(2, errorRetryCount), 4000);
                console.warn(`[${this.getNowTime()}] [getSimilarityScore2] [${reqId}] 错误重试 (${errorRetryCount}/${MAX_ERROR_RETRIES}): 目标ASIN=${targetAsin}, 延迟${delay}ms, 错误=${err.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }

          console.warn(`[${this.getNowTime()}] [getSimilarityScore2] [${reqId}] 所有重试耗尽: 目标ASIN=${targetAsin}, 返回0分`);
          return 0;
        })(),
        30000,
        `相似度查询2总超时 [请求ID: ${reqId}, 目标ASIN: ${targetAsin}]`
      );

    } catch (error) {
      const err = error as Error;
      if (imageStream?.destroy) {
        imageStream.destroy(err);
      }

      // 如果是UnsupportedPicPixels错误，继续向上抛出，以便上层业务处理（如删除数据）
      if (err.message && err.message.includes('UnsupportedPicPixels')) {
        throw err;
      }

      console.error(`[${this.getNowTime()}] [getSimilarityScore2] [${reqId}] 异常终止: 目标ASIN=${targetAsin}, URL=${imageUrl}, 错误=${err.message}, 堆栈=${err.stack}`);
      return 0;
    }
  }

  /**
   * 新增图片到阿里云
   */
  public async addImageAdvance(
    imageUrl: string, 
    asin: string, 
    isArchive: boolean = false
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    await this.lazyInit();
    
    const reqId = this.generateRequestId('addImage');
    console.log(`[${this.getNowTime()}] [addImageAdvance] [${reqId}] 开始添加: ASIN=${asin}, 归档=${isArchive}, URL=${imageUrl}`);

    let imageStream: Readable | null = null;
    let lastError: Error = new Error('未知错误');

    try {
      return await this.withTimeout(
        (async () => {
          await this.withTimeout(
            this.aliCloudAPILimiter(),
            5000,
            `API限流等待超时 [请求ID: ${reqId}, ASIN: ${asin}]`
          );
          
          imageStream = await this.urlToStream(imageUrl);

          const requestParams = {
            instanceName: this.instanceName,
            productId: asin,
            picName: imageUrl,
            picContentObject: imageStream,
            crop: false,
            strAttr: isArchive ? "2" : asin,
            categoryId: 88888888
          };
          const request = new imagesearch.AddImageAdvanceRequest(requestParams);

          const apiResponse = await this.withTimeout(
            this.aliImageClient.addImageAdvance(request, new oss.RuntimeOptions({})),
            10000,
            `API请求超时 [请求ID: ${reqId}, ASIN: ${asin}]`
          );

          const responseBody = (apiResponse as any).body;
          if (responseBody.code === 0) {
            console.log(`[${this.getNowTime()}] [addImageAdvance] [${reqId}] 添加成功: ASIN=${asin}, 阿里云请求ID=${responseBody.requestId}`);
            return { success: true, requestId: responseBody.requestId };
          } else {
            lastError = new Error(`业务错误 [状态码: ${responseBody.code}, 消息: ${responseBody.message}]`);
            throw lastError;
          }
        })(),
        30000,
        `添加图片总超时 [请求ID: ${reqId}, ASIN: ${asin}]`
      );

    } catch (error) {
      lastError = error as Error;
      if (imageStream?.destroy) {
        imageStream.destroy(lastError);
      }
      console.error(`[${this.getNowTime()}] [addImageAdvance] [${reqId}] 添加失败: ASIN=${asin}, URL=${imageUrl}, 错误=${lastError.message}, 堆栈=${lastError.stack}`);
      return { success: false, error: lastError.message };
    }
  }

  
  public async addImageAdvance2(
    imageUrl: string, 
    asin: string, 
    asin2: string, 
    isArchive: boolean = false
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    await this.lazyInit();
    
    const reqId = this.generateRequestId('addImage');
    console.log(`[${this.getNowTime()}] [addImageAdvance] [${reqId}] 开始添加: ASIN=${asin}, 归档=${isArchive}, URL=${imageUrl}`);

    let imageStream: Readable | null = null;
    let lastError: Error = new Error('未知错误');

    try {
      return await this.withTimeout(
        (async () => {
          await this.withTimeout(
            this.aliCloudAPILimiter(),
            5000,
            `API限流等待超时 [请求ID: ${reqId}, ASIN: ${asin}]`
          );
          
          imageStream = await this.urlToStream(imageUrl);

          const requestParams = {
            instanceName: this.instanceName,
            productId: asin,
            picName: imageUrl,
            picContentObject: imageStream,
            crop: false,
            strAttr: isArchive ? "2" : asin,
            strAttr2: isArchive ? "2" : asin2,
            categoryId: 88888888
          };
          const request = new imagesearch.AddImageAdvanceRequest(requestParams);

          const apiResponse = await this.withTimeout(
            this.aliImageClient.addImageAdvance(request, new oss.RuntimeOptions({})),
            10000,
            `API请求超时 [请求ID: ${reqId}, ASIN: ${asin}]`
          );

          const responseBody = (apiResponse as any).body;
          if (responseBody.code === 0) {
            console.log(`[${this.getNowTime()}] [addImageAdvance] [${reqId}] 添加成功: ASIN=${asin}, 阿里云请求ID=${responseBody.requestId}`);
            return { success: true, requestId: responseBody.requestId };
          } else {
            lastError = new Error(`业务错误 [状态码: ${responseBody.code}, 消息: ${responseBody.message}]`);
            throw lastError;
          }
        })(),
        30000,
        `添加图片总超时 [请求ID: ${reqId}, ASIN: ${asin}]`
      );

    } catch (error) {
      lastError = error as Error;
      if (imageStream?.destroy) {
        imageStream.destroy(lastError);
      }
      console.error(`[${this.getNowTime()}] [addImageAdvance] [${reqId}] 添加失败: ASIN=${asin}, URL=${imageUrl}, 错误=${lastError.message}, 堆栈=${lastError.stack}`);
      return { success: false, error: lastError.message };
    }
  }
}
    