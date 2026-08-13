import {Inject, Provide} from '@midwayjs/decorator';
import {InjectEntityModel} from '@midwayjs/typeorm';
import {BaseService, CoolCommException} from '@cool-midway/core';
import {Context} from "@midwayjs/koa";
import {IsNull, LessThan, Repository} from 'typeorm';
import {AppAmzFXEntity} from '../entity/foreign_exchange';
import {LingXingUtils} from "../utils/lingxing/lingxingUtils";
import * as dayjs from "dayjs";

@Provide()
export class AppAmzFXService extends BaseService {
  @InjectEntityModel(AppAmzFXEntity)
  AppAmzFXEntity: Repository<AppAmzFXEntity>;

  @Inject()
  ctx: Context;

  @Inject()
  lingXingUtils: LingXingUtils;

  async getforeign_exchange() {
    let data = await this.lingXingUtils.httpGet('/erp/sc/routing/finance/currency/currencyMonth', {});
    if (!Array.isArray(data)) {
      throw new CoolCommException('获取汇率失败');
    }

    // 解析数据并存储到数据库
    for (let item of data) {
      let existingRecord = await this.AppAmzFXEntity.findOne({ where: { date: item.date, currencyName: item.code } });
      if (existingRecord) {
        // 如果记录已存在，更新数据
        existingRecord.icon = item.icon;
        existingRecord.currencyName = item.name;
        existingRecord.rate_org = item.rate_org;
        existingRecord.update_time = dayjs(item.update_time).toDate();
        await this.AppAmzFXEntity.save(existingRecord);
      } else {
        // 如果记录不存在，创建新记录
        let newRecord = new AppAmzFXEntity();
        newRecord.date = item.date;
        newRecord.icon = item.icon;
        newRecord.currencyName = item.name;
        newRecord.rate_org = item.rate_org;
        if (item.update_time) {
          newRecord.update_time = dayjs(item.update_time).toDate();
        }
        await this.AppAmzFXEntity.save(newRecord);
      }
    }
  }

  // 正确实现示例
async getExchangeRate() {
    // 使用QueryBuilder更安全的方式
    const queryResult = await this.AppAmzFXEntity
      .createQueryBuilder('fx')
      .select([
        'fx.rate_org as rate',
        'fx.icon as icon',
        'fx.currencyName as name'
      ])
      .getRawMany();

    if (!queryResult.length) {
      return []; // 返回空数组比返回null更合适
    }

    // 转换数据结构为前端友好格式
    return queryResult.map(item => ({
      currency: item.icon,
      rate: Number(item.rate),
      symbol: item.icon, // 假设icon字段存储的是货币符号
      name: item.name
    }));
  
}
}