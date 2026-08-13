import {Singleton} from "@midwayjs/core";
import {Inject, Provide} from "@midwayjs/decorator";
import {PriceTactic} from "../interface/enum-price-tactic";
import {AdminListingController} from "../controller/admin/listing";
import {AppAmzListingService} from "../service/listing";
import {AppAmzListingCompetitorService} from "../service/competitor";
import {AppUtils} from "../utils/appUtils";
import {LingXingUtils} from "../utils/lingxing/lingxingUtils";
import * as dayjs from "dayjs";
import {ILogger} from "@midwayjs/logger";
import {appConfig} from "../../../appConfig";
import {AppAmzListingEntity} from "../entity/listing";

@Provide()
@Singleton()
export class TacticRunner {
  @Inject()
  listingController: AdminListingController;

  @Inject()
  listingService: AppAmzListingService;

  @Inject()
  competitorService: AppAmzListingCompetitorService;

  @Inject()
  appUtils: AppUtils;

  @Inject()
  lingXingUtils: LingXingUtils;

  @Inject()
  logger: ILogger;

  async executeTacticPriceP1(listing: AppAmzListingEntity = null) {
    if (!listing) {
      listing = await this.listingService.getListingOfPriceTactic(PriceTactic.p1);
    }
    if (!listing) return;

    if (await this._executeTacticP3InNeed(listing)) return;

    this.logger.info('准备执行【新品】调价策略 p1');
    console.group(`正在执行【新品】调价策略 p1：来自 listing：${JSON.stringify({
      id: listing.id,
      sid: listing.sid,
      asin: listing.asin,
      sku: listing.seller_sku,
    })}`);

    try {
      listing.tactic_price_ignore_until = dayjs().add(7, 'days').toDate();

      let expected_volume = listing.tactic_new_product_expected_daily_order_quantity;
      let previous_volume = await this.listingService.fetchListingVolume(listing, 'last_week');
      if (null === previous_volume) {
        await this.listingService.saveListingEntity(listing);
        return;
      }
      console.log(`expected: ${expected_volume} | last week: ${previous_volume}`);

      let price_down = previous_volume < expected_volume * (1 - listing.tactic_new_product_price_alert_threshold / 100);
      if (price_down) {
        let suggest_price = this.appUtils.normalizeNumber(listing.landed_price);
        if (listing.tactic_new_price_modify_range) {
          suggest_price = this.appUtils.normalizeNumber(listing.landed_price) * (1 - listing.tactic_new_price_modify_range / 100);
        }
        if (listing.tactic_new_price_modify_value) {
          suggest_price = this.appUtils.normalizeNumber(listing.landed_price) - listing.tactic_new_price_modify_value;
        }
        suggest_price = this.appUtils.toFixed2Number(suggest_price);
        listing.tactic_price_suggested_new_price = suggest_price;
        listing.tactic_hint_price = `建议降价至 ${suggest_price}｜新品：过去 7 天日均单量 ${previous_volume} 小于预期 ${expected_volume}`;
      }

      let price_up = previous_volume > expected_volume * (1 + listing.tactic_new_product_price_alert_threshold / 100);
      if (price_up) {
        let suggest_price = this.appUtils.normalizeNumber(listing.landed_price);
        if (listing.tactic_new_price_modify_range) {
          suggest_price = this.appUtils.normalizeNumber(listing.landed_price) * (1 + listing.tactic_new_price_modify_range / 100);
        }
        if (listing.tactic_new_price_modify_value) {
          suggest_price = this.appUtils.normalizeNumber(listing.landed_price) + listing.tactic_new_price_modify_value;
        }
        suggest_price = this.appUtils.toFixed2Number(suggest_price);
        listing.tactic_price_suggested_new_price = suggest_price;
        listing.tactic_hint_price = `建议升价至 ${suggest_price}｜新品：过去 7 天单量 ${previous_volume} 大于预期 ${expected_volume}`;
      }

      if (price_up || price_down) {
        console.log(listing.tactic_hint_price);
      } else {
        console.log('新品实际日均单量在预期单量的波动阈值内，无需建议调价。');
      }

      await this.listingService.saveListingEntity(listing);
    } catch (err) {
      console.log(err);
    } finally {
      console.log('分析完成');
      console.groupEnd();
    }
  }

  async executeTacticPriceP2(listing: AppAmzListingEntity = null) {
    if (!listing) {
      listing = await this.listingService.getListingOfPriceTactic(PriceTactic.p2);
    }
    if (!listing) return;

    if (await this._executeTacticP3InNeed(listing)) return;

    this.logger.info('准备执行【竞品】调价策略 p2');
    console.group(`正在执行【竞品】调价策略 p2：来自 listing：${JSON.stringify({
      id: listing.id,
      sid: listing.sid,
      asin: listing.asin,
      sku: listing.seller_sku,
    })}`);

    try {
      listing.tactic_price_ignore_until = dayjs().add(24, 'hours').toDate();

      let competitors = await this.competitorService.getCoreCompetitors(listing.sid, listing.asin, listing.seller_sku);

      if (!competitors || competitors?.length === 0) {
        await this.listingService.saveListingEntity(listing);
        return;
      }

      let listing_price: number = this.appUtils.normalizeNumber(listing?.landed_price);

      if (competitors?.length === 1) {
        let price_down = competitors[0]?.price < listing_price;
        listing.tactic_price_suggested_new_price = competitors[0]?.price;
        listing.tactic_hint_price = `建议${price_down ? '降价' : '升价'}｜单一核心竞品售价 ${competitors[0]?.price}`;
        console.log(listing.tactic_hint_price);
      } else {
        let avg_price = competitors.reduce((sum, c) => {
          return sum + c.price;
        }, 0) / competitors.length;


        avg_price = this.appUtils.toFixed2Number(avg_price);

        let price_down = listing_price > avg_price * (1 - listing.tactic_competitor_price_down_threshold / 100);
        if (price_down) {
          listing.tactic_price_suggested_new_price = avg_price;
          listing.tactic_hint_price = `建议降价｜多竞品均价 ${avg_price}`;
        }

        let price_up = listing_price < avg_price * (1 + listing.tactic_competitor_price_up_threshold / 100);
        if (price_up) {
          listing.tactic_price_suggested_new_price = avg_price;
          listing.tactic_hint_price = `建议升价｜多竞品均价 ${avg_price}`;
        }

        if (price_up || price_down) {
          console.log(listing.tactic_hint_price);
        } else {
          console.log('竞品价格波动在阈值内，无需调价。');
        }

      }

      await this.listingService.saveListingEntity(listing);
    } catch (err) {
      console.log(err);
    } finally {
      console.log('分析完成');
      console.groupEnd();
    }
  }

  async executeTacticPriceP3(listing: AppAmzListingEntity = null) {
    if (!listing) {
      listing = await this.listingService.getListingOfPriceTactic(PriceTactic.p3);
    }

    if (!listing) return;

    // this.logger.info('准备执行【清仓】调价策略 p3');
    // console.group(`正在执行【清仓】调价策略 p3：来自 listing：${JSON.stringify({
    //   id: listing.id,
    //   sid: listing.sid,
    //   asin: listing.asin,
    //   sku: listing.seller_sku,
    // })}`);

    try {

      let today_volume = await this.listingService.fetchListingVolume(listing, 'today');
      if (null === today_volume) {
        listing.tactic_price_ignore_until = dayjs().add(5, 'minutes').toDate();
        await this.listingService.saveListingEntity(listing);
        return;
      }

      let expected_order_max: number, expected_order_min: number;
      let uk_hour = this.appUtils.getDateHourOfUk(new Date());
      if (uk_hour <= 9) {
        expected_order_max = listing.tactic_clearance_expected_order_max_before_9;
        expected_order_min = listing.tactic_clearance_expected_order_min_before_9;
      } else if (uk_hour <= 12) {
        expected_order_max = listing.tactic_clearance_expected_order_max_before_12;
        expected_order_min = listing.tactic_clearance_expected_order_min_before_12;
      } else if (uk_hour <= 15) {
        expected_order_max = listing.tactic_clearance_expected_order_max_before_15;
        expected_order_min = listing.tactic_clearance_expected_order_min_before_15;
      } else if (uk_hour <= 18) {
        expected_order_max = listing.tactic_clearance_expected_order_max_before_18;
        expected_order_min = listing.tactic_clearance_expected_order_min_before_18;
      } else if (uk_hour <= 21) {
        expected_order_max = listing.tactic_clearance_expected_order_max_before_21;
        expected_order_min = listing.tactic_clearance_expected_order_min_before_21;
      } else {
        expected_order_max = listing.tactic_clearance_expected_order_max_before_24;
        expected_order_min = listing.tactic_clearance_expected_order_min_before_24;
      }
      console.log(`今日以来单量 ${today_volume}｜触发单量上限 ${expected_order_max}｜触发单量下限 ${expected_order_min}`);

      let price_down = today_volume < expected_order_min;
      if (price_down) {
        let suggest_price = this.appUtils.normalizeNumber(listing.landed_price);
        if (listing.tactic_clearance_price_modify_range) {
          suggest_price = this.appUtils.normalizeNumber(listing.landed_price) * (1 - listing.tactic_clearance_price_modify_range / 100);
        }
        if (listing.tactic_clearance_price_modify_value) {
          suggest_price = this.appUtils.normalizeNumber(listing.landed_price) - listing.tactic_clearance_price_modify_value;
        }
        if (suggest_price < listing.tactic_clearance_price_modify_lower_limit) {
          suggest_price = listing.tactic_clearance_price_modify_lower_limit;
        }
        if (suggest_price !== listing.tactic_clearance_price_modify_lower_limit) {
          suggest_price = this.appUtils.toFixed2Number(suggest_price);
          listing.tactic_price_suggested_new_price = suggest_price;
          listing.tactic_hint_price = `建议降价至 ${suggest_price}｜今日以来单量 ${today_volume} < 该时段设定的下限 ${expected_order_min}`;
        }
      }

      let price_up = today_volume > expected_order_max;
      if (price_up) {
        let suggest_price = this.appUtils.normalizeNumber(listing.landed_price);
        if (listing.tactic_clearance_price_modify_range) {
          suggest_price = this.appUtils.normalizeNumber(listing.landed_price) * (1 + listing.tactic_clearance_price_modify_range / 100);
        }
        if (listing.tactic_clearance_price_modify_value) {
          suggest_price = this.appUtils.normalizeNumber(listing.landed_price) + listing.tactic_clearance_price_modify_value;
        }
        if (suggest_price > listing.tactic_clearance_price_modify_upper_limit) {
          suggest_price = listing.tactic_clearance_price_modify_upper_limit;
        }
        if (suggest_price !== listing.tactic_clearance_price_modify_lower_limit) {
          suggest_price = this.appUtils.toFixed2Number(suggest_price);
          listing.tactic_price_suggested_new_price = suggest_price;
          listing.tactic_hint_price = `建议升价至 ${suggest_price}｜今日以来单量 ${today_volume} > 该时段设定的上限 ${expected_order_max}`;
        }
      }

      if (listing.tactic_hint_price) {
        console.log(listing.tactic_hint_price);


        let res = await this.listingController.modifyPrice([listing]);
        if (res.code === 1000) {
          listing.tactic_hint_price = '';
        }
      }

      listing.tactic_price_ignore_until = this.appUtils.getNextClearanceCheckTime();
      await this.listingService.saveListingEntity(listing);
    } catch (err) {
      console.log(err);
    } finally {
      console.log('分析完成');
      console.groupEnd();
    }
  }

  async executeTacticPriceP4(listing: AppAmzListingEntity = null) {
    if (!listing) {
      listing = await this.listingService.getListingOfPriceTactic(PriceTactic.p4);
    }
    if (!listing) return;

    if (await this._executeTacticP3InNeed(listing)) return;

    this.logger.info('准备执行【日常】调价策略 p4');
    console.group(`正在执行【日常】调价策略 p4：来自 listing：${JSON.stringify({
      id: listing.id,
      sid: listing.sid,
      asin: listing.asin,
      sku: listing.seller_sku,
    })}`);

    try {
      listing.tactic_price_ignore_until = dayjs().add(24, 'hours').toDate();

      let triggered = false;

      if (
        !triggered &&
        typeof listing?.afn_fulfillable_quantity === 'number' &&
        typeof listing?.daily_order_quantity === 'number' &&
        typeof listing?.tactic_normal_target_inventory_days_min === 'number' &&
        typeof listing?.tactic_normal_target_inventory_days_max === 'number'
      ) {
        let days_to_sale_up = Math.round(appConfig.cal_listing_logical_inventory(listing) / listing.daily_order_quantity);

        let price_down = days_to_sale_up > listing.tactic_normal_target_inventory_days_max;
        if (price_down) {
          let suggest_price = this.appUtils.normalizeNumber(listing.landed_price);
          if (listing.tactic_normal_price_modify_range) {
            suggest_price = this.appUtils.normalizeNumber(listing.landed_price) * (1 - listing.tactic_normal_price_modify_range / 100);
          }
          if (listing.tactic_normal_price_modify_value) {
            suggest_price = this.appUtils.normalizeNumber(listing.landed_price) - listing.tactic_normal_price_modify_value;
          }
          suggest_price = this.appUtils.toFixed2Number(suggest_price);
          listing.tactic_price_suggested_new_price = suggest_price;

          if (listing.daily_order_quantity === 0) {
            listing.tactic_hint_price = `建议降价｜近期无销量，大于目标最大库存 ${listing.tactic_normal_target_inventory_days_max} 天`;
          } else {
            listing.tactic_hint_price = `建议降价至 ${suggest_price}｜预计可售 ${days_to_sale_up} 天 > 目标最大库存 ${listing.tactic_normal_target_inventory_days_max} 天`;
          }
        }

        let price_up = days_to_sale_up < listing.tactic_normal_target_inventory_days_min;
        if (price_up) {
          let suggest_price = this.appUtils.normalizeNumber(listing.landed_price);
          if (listing.tactic_normal_price_modify_range) {
            suggest_price = this.appUtils.normalizeNumber(listing.landed_price) * (1 + listing.tactic_normal_price_modify_range / 100);
          }
          if (listing.tactic_normal_price_modify_value) {
            suggest_price = this.appUtils.normalizeNumber(listing.landed_price) + listing.tactic_normal_price_modify_value;
          }
          suggest_price = this.appUtils.toFixed2Number(suggest_price);
          listing.tactic_price_suggested_new_price = suggest_price;
          listing.tactic_hint_price = `建议升价至 ${suggest_price}｜预计可售 ${days_to_sale_up} 天 < 目标最小库存 ${listing.tactic_normal_target_inventory_days_min} 天`;
        }

        if (price_up || price_down) {
          triggered = true;
        }
      }

      if (
        !triggered &&
        typeof listing?.daily_order_quantity === 'number' &&
        typeof listing?.tactic_normal_target_daily_order_quantity === 'number' &&
        typeof listing?.tactic_normal_target_daily_order_quantity_alert_threshold === 'number'
      ) {
        let price_down = listing.daily_order_quantity < listing.tactic_normal_target_daily_order_quantity * (1 - listing.tactic_normal_target_daily_order_quantity_alert_threshold / 100);
        if (price_down) {
          let suggest_price = this.appUtils.normalizeNumber(listing.landed_price) * (1 - listing.tactic_normal_price_modify_range / 100);
          suggest_price = this.appUtils.toFixed2Number(suggest_price);
          listing.tactic_price_suggested_new_price = suggest_price;
          listing.tactic_hint_price = `建议降价至 ${suggest_price}｜实际日均单量 ${listing.daily_order_quantity} < 目标日单量 ${listing.tactic_normal_target_daily_order_quantity}`;
        }

        let price_up = listing.daily_order_quantity > listing.tactic_normal_target_daily_order_quantity * (1 + listing.tactic_normal_target_daily_order_quantity_alert_threshold / 100);
        if (price_up) {
          let suggest_price = this.appUtils.normalizeNumber(listing.landed_price) * (1 + listing.tactic_normal_price_modify_range / 100);
          suggest_price = this.appUtils.toFixed2Number(suggest_price);
          listing.tactic_price_suggested_new_price = suggest_price;
          listing.tactic_hint_price = `建议升价至 ${suggest_price}｜实际日均单量 ${listing.daily_order_quantity} > 目标日单量 ${listing.tactic_normal_target_daily_order_quantity}`;
        }

        if (price_up || price_down) {
          triggered = true;
        }
      }

      if (
        !triggered &&
        typeof listing?.tactic_normal_sharp_change_alert_threshold === 'number'
        && Array.isArray(listing?.kw_search_volume_anal_res)
        && listing?.kw_search_volume_anal_res.length > 0
      ) {
        let searchesArr = listing.kw_search_volume_anal_res.map(data => data.searches);

        let former = searchesArr[0];
        let latter = searchesArr[searchesArr.length - 1];
        let min = Math.min(former, latter);
        let max = Math.max(former, latter);

        let margin = Math.round((max / min - 1) * 100);
        if (margin > listing.tactic_normal_sharp_change_alert_threshold) {
          let price_down = searchesArr.indexOf(min) > searchesArr.indexOf(max);
          if (price_down) {
            let suggest_price = this.appUtils.normalizeNumber(listing.landed_price) * (1 - listing.tactic_normal_price_modify_range / 100);
            suggest_price = this.appUtils.toFixed2Number(suggest_price);
            listing.tactic_price_suggested_new_price = suggest_price;
            listing.tactic_hint_price = `建议降价至 ${suggest_price}｜关键词搜索量递减幅度 ${margin}%`;
          } else {
            let suggest_price = this.appUtils.normalizeNumber(listing.landed_price) * (1 + listing.tactic_normal_price_modify_range / 100);
            suggest_price = this.appUtils.toFixed2Number(suggest_price);
            listing.tactic_price_suggested_new_price = suggest_price;
            listing.tactic_hint_price = `建议升价至 ${suggest_price}｜关键词搜索量递增幅度 ${margin}%`;
          }
          triggered = true;
        }
      }

      if (!triggered) {
        console.log('日常调价：没有触发任何符合条件的策略。');
        listing.tactic_hint_price = '';
      }

      if (listing.tactic_hint_price) {
        console.log(listing.tactic_hint_price);
        listing.tactic_price_ignore_until = dayjs().add(6, 'days').toDate();
      }

      await this.listingService.saveListingEntity(listing);
    } catch (err) {
      console.log(err);
    } finally {
      console.log('分析完成');
      console.groupEnd();
    }
  }

  async _executeTacticP3InNeed(listing: AppAmzListingEntity): Promise<boolean> {
    if (!listing.tags.includes(PriceTactic.p3)) {
      return false;
    }

    await this.executeTacticPriceP3(listing);
    return true;
  }

  async executeTacticInventory() {
    let listing = await this.listingService.getListingOfInventoryTactic();
    if (!listing) return;

    this.logger.info('准备执行补货策略');
    // console.group(`正在执行补货策略：来自 listing：${JSON.stringify({
    //   id: listing.id,
    //   sid: listing.sid,
    //   asin: listing.asin,
    //   sku: listing.seller_sku,
    // })}`);

    try {
      listing.tactic_inventory_ignore_until = dayjs().add(24, 'hours').toDate();

      if (
        typeof listing?.afn_fulfillable_quantity === 'number' && typeof listing?.daily_order_quantity === 'number' && Array.isArray(listing?.kw_search_volume_anal_res) && listing?.kw_search_volume_anal_res.length > 0
      ) {
        let expected_total_daily_order = listing.kw_search_volume_anal_res.reduce((accumulated, nextData, index) => {
          return accumulated + (index < 9 ? nextData.expected_orders || 0 : 0);
        }, 0);
        expected_total_daily_order = Math.round(expected_total_daily_order);
        console.log(`当前可售 ${listing.afn_fulfillable_quantity} 调仓中 ${listing.reserved_fc_processing} 在途 ${listing.afn_inbound_shipped_quantity} 入库中 ${listing.afn_inbound_receiving_quantity}｜9 周预期单量 ${expected_total_daily_order}`);

        let inventory_up = appConfig.cal_listing_logical_inventory(listing) < expected_total_daily_order;
        if (inventory_up) {
          listing.tactic_hint_inventory = `建议补货｜现库存 ${appConfig.cal_listing_logical_inventory(listing)} < 9 周预期单量 ${expected_total_daily_order}`;
          console.log(listing.tactic_hint_inventory);
        }
      }

      if (
        typeof listing?.afn_fulfillable_quantity === 'number' && typeof listing?.daily_order_quantity === 'number') {
        let days_to_sale_up = Math.round(appConfig.cal_listing_logical_inventory(listing) / listing.daily_order_quantity);
        let inventory_up = days_to_sale_up < (listing.tactic_inventory_min_salable_days || 60);
        if (inventory_up) {
          listing.tactic_hint_inventory = `建议补货｜预计可售 ${days_to_sale_up} 天 < 最小可售天数 ${listing.tactic_inventory_min_salable_days} 天`;
          console.log(listing.tactic_hint_inventory);
        }
      }

      if (listing.tactic_hint_inventory === '') {
        console.log('没有足够的数据来执行 或 无需触发 补货策略。');
      }

      await this.listingService.saveListingEntity(listing);
    } catch (err) {
      console.log(err);
    } finally {
      console.log('分析完成');
      console.groupEnd();
    }
  }
}
