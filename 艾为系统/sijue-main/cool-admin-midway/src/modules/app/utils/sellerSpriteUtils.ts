import {Provide} from "@midwayjs/decorator";
import {Singleton} from "@midwayjs/core";
import {InjectEntityModel} from "@midwayjs/typeorm";
import {BaseSysParamEntity} from "../../base/entity/sys/param";
import {Repository} from "typeorm";
import axios, {AxiosInstance} from "axios";
import { AppTaskManagementEntity } from "../entity/bzy_task_management";

@Provide()
@Singleton()
export class SellerSpriteUtils {
  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamRepo: Repository<BaseSysParamEntity>;

  @InjectEntityModel(AppTaskManagementEntity)
  taskManagementRepo: Repository<AppTaskManagementEntity>;

  api_host: string = 'https://api.sellersprite.com';
  secret_key: string = 'f1da3c1671aa4c539e3c0d00e96f475c';
  // secret_key: string = 'adab7cbc08fb400e93e5112bc8e72848'; //测试地址
  myAxios: AxiosInstance = null;
  
  // 频率控制：每分钟最多35次
  private requestTimestamps: number[] = [];
  private readonly MAX_REQUESTS_PER_MINUTE = 35;

  async init() {
    if (this.myAxios) {
      return;
    }

    const param_api_host = await this.baseSysParamRepo.findOne({where: {keyName: 'seller_sprite_api_host'}});

    const param_secret_key = await this.baseSysParamRepo.findOne({where: {keyName: 'seller_sprite_secret_key2'}});

    if (param_api_host?.data) this.api_host = param_api_host.data.trim();
    if (param_secret_key?.data) this.secret_key = param_secret_key.data.trim();
    console.log(this.secret_key)
    this.myAxios = axios.create({
      headers: {
        'secret-key': this.secret_key,
        'content-type': 'application/json;charset=UTF-8',
      },
    });
  }

  async logUsage(apiPath: string, method: string, params: any, status: string, startTime: number, errorMsg: string = null) {
    const costTime = Date.now() - startTime;
    const now = new Date();
    try {
      await this.taskManagementRepo.save({
        taskName: `SellerSprite:${apiPath}`, // 任务名称：SellerSprite:[API路径]
        taskCode: this.secret_key, // 任务ID：存SecretKey
        taskStatus: status === 'SUCCESS' ? 'FINISHED' : 'FAILED', // 状态映射
        invokeTime: new Date(startTime), // 调用时间
        executeStartTime: new Date(startTime), // 开始时间
        executeEndTime: now, // 结束时间
        executeResult: errorMsg ? `Error: ${errorMsg}` : `Success (Cost: ${costTime}ms)`, // 执行结果
        taskParams: JSON.stringify({
          method: method,
          params: params
        }), // 详细参数存入新字段
        remark: `SellerSprite API Call (${method})` // 备注
      });
    } catch (e) {
      console.error('保存SellerSprite日志到任务表失败', e);
    }
  }

  async checkRateLimit() {
    while (true) {
      // 1. 清理超过1分钟的历史记录
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);

      // 2. 如果当前窗口未满，允许通过
      if (this.requestTimestamps.length < this.MAX_REQUESTS_PER_MINUTE) {
        this.requestTimestamps.push(now);
        break;
      }

      // 3. 如果已满，计算等待时间
      const earliestTimestamp = this.requestTimestamps[0];
      const waitTime = earliestTimestamp + 60000 - now;
      
      if (waitTime > 0) {
        console.log(`[SellerSpriteUtils] Rate limit reached (${this.requestTimestamps.length}/${this.MAX_REQUESTS_PER_MINUTE}). Waiting ${waitTime}ms...`);
        // 多等待100ms缓冲，确保过期
        await new Promise(resolve => setTimeout(resolve, waitTime + 100));
      } else {
        // 理论上不会进这里，但为了防止死循环，稍微等待
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  async httpGet(apiPath: string, params: object) {
    await this.checkRateLimit();
    const startTime = Date.now();
    await this.init();
    try {
      let {data} = await this.myAxios.get(
        this.api_host + apiPath,
        {params: params}
      );
      this.logUsage(apiPath, 'GET', params, 'SUCCESS', startTime);
      return data;
    } catch (error) {
      this.logUsage(apiPath, 'GET', params, 'ERROR', startTime, error.message);
      throw error;
    }
  }

  async httpPost(apiPath: string, params: object) {
    await this.checkRateLimit();
    const startTime = Date.now();
    await this.init();
    try {
      let {data} = await this.myAxios.post(
        this.api_host + apiPath,
        params
      );
      this.logUsage(apiPath, 'POST', params, 'SUCCESS', startTime);
      return data;
    } catch (error) {
      this.logUsage(apiPath, 'POST', params, 'ERROR', startTime, error.message);
      throw error;
    }
  }
}