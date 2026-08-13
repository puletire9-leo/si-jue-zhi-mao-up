import { Provide, Inject } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { AppAmzPricingProductTagEntity } from '../entity/pricing_product_tag';
import { AppAmzPricingRealtimeRuleEntity } from '../entity/pricing_realtime_rule';

@Provide()
export class AppAmzPricingRealtimeService extends BaseService {
  @InjectEntityModel(AppAmzPricingProductTagEntity)
  productTagRepo: Repository<AppAmzPricingProductTagEntity>;

  @InjectEntityModel(AppAmzPricingRealtimeRuleEntity)
  realtimeRuleRepo: Repository<AppAmzPricingRealtimeRuleEntity>;

  @Inject()
  ctx;

  /**
   * 中午检查 (由 cron 定时调用)
   * 条件: real_time_sales / daily_avg_3day > threshold
   */
  async checkNoon() {
    return this.runCheck('NOON');
  }

  /**
   * 傍晚检查 (由 cron 定时调用)
   * 条件: (real_time_sales - last_real_time_sales) / daily_avg_3day > threshold
   */
  async checkEvening() {
    return this.runCheck('EVENING');
  }

  private async runCheck(
    mode: 'NOON' | 'EVENING'
  ): Promise<{
    rules: number;
    total: number;
    triggered: number;
    details: Array<{
      asin: string;
      marketplace: string;
      sales_value: number;
      daily_avg: number;
      ratio: number;
      action: string;
      price_value: number;
    }>;
  }> {
    // 查找所有启用的规则
    const rules = await this.realtimeRuleRepo.find({
      where: { is_active: 1 }
    });

    if (!rules.length) {
      return { rules: 0, total: 0, triggered: 0, details: [] };
    }

    // 收集规则涉及的国家
    const marketplaces = [...new Set(rules.map(r => r.marketplace).filter(Boolean))];

    const details: Array<{
      asin: string;
      marketplace: string;
      sales_value: number;
      daily_avg: number;
      ratio: number;
      action: string;
      price_value: number;
    }> = [];

    let allProducts: AppAmzPricingProductTagEntity[] = [];
    let triggered = 0;

    for (const marketplace of marketplaces) {
      const qb = this.productTagRepo.createQueryBuilder('t')
        .where('t.marketplace = :marketplace', { marketplace })
        .andWhere('t.real_time_sales IS NOT NULL')
        .andWhere('t.real_time_sales > 0')
        .andWhere('t.daily_avg_3day IS NOT NULL')
        .andWhere('t.daily_avg_3day > 0');

      if (mode === 'EVENING') {
        qb.andWhere('t.last_real_time_sales IS NOT NULL')
          .andWhere('t.last_real_time_sales > 0');
      }

      allProducts = allProducts.concat(await qb.getMany());
    }

    for (const product of allProducts) {
      const matchRule = rules.find(r => r.marketplace === product.marketplace);
      if (!matchRule) continue;

      const threshold = matchRule.threshold_value || 2;

      let dailyAvg = product.daily_avg_3day;
      if (dailyAvg < 3) {
        dailyAvg = 3;
      }

      let salesToCheck: number;
      if (mode === 'NOON') {
        salesToCheck = product.real_time_sales || 0;
      } else {
        salesToCheck = (product.real_time_sales || 0) - (product.last_real_time_sales || 0);
      }

      if (salesToCheck <= 0) continue;

      const ratio = salesToCheck / dailyAvg;

      if (ratio > threshold) {
        triggered++;

        product.last_real_time_sales = product.real_time_sales || 0;
        await this.productTagRepo.update(
          { asin: product.asin, marketplace: product.marketplace },
          { last_real_time_sales: product.real_time_sales || 0 }
        );

        // TODO: 调价接口就位后替换此日志
        console.log(
          `[${mode}] ${product.asin}/${product.marketplace} 触发: ` +
          `sales=${salesToCheck} avg=${dailyAvg} ratio=${ratio.toFixed(2)} > ${threshold}, ` +
          `${matchRule.price_action}=${matchRule.price_value}`
        );

        details.push({
          asin: product.asin,
          marketplace: product.marketplace,
          sales_value: salesToCheck,
          daily_avg: dailyAvg,
          ratio: Number(ratio.toFixed(2)),
          action: matchRule.price_action,
          price_value: matchRule.price_value
        });
      }
    }

    console.log(`[${mode}] 规则${rules.length}个, 产品${allProducts.length}个, 触发${triggered}个`);

    return { rules: rules.length, total: allProducts.length, triggered, details };
  }
}
