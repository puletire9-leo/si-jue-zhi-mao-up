import {Inject, Provide} from '@midwayjs/decorator';
import {InjectEntityModel} from '@midwayjs/typeorm';
import {BaseService, CoolCommException} from '@cool-midway/core';
import {Context} from "@midwayjs/koa";
import {IsNull, LessThan, Repository} from 'typeorm';
import {AppAmzSellerEntity} from '../entity/seller';
import {LingXingUtils} from "../utils/lingxing/lingxingUtils";
import * as dayjs from "dayjs";

@Provide()
export class AppAmzSellerService extends BaseService {
  @InjectEntityModel(AppAmzSellerEntity)
  amzSellerRepo: Repository<AppAmzSellerEntity>;

  @Inject()
  ctx: Context;

  @Inject()
  lingXingUtils: LingXingUtils;

  async fetchSellers() {
    let data = await this.lingXingUtils.httpGet('/erp/sc/data/seller/lists', {});
    if (!Array.isArray(data)) {
      throw new CoolCommException('获取店铺列表失败');
    }

    console.log(`店铺列表长度为 ${data.length}`);
    for (const _data of data) {
      let currentSeller = await this.amzSellerRepo.findOne({
        where: {sid: _data.sid}
      });
      if (currentSeller) {
        Object.assign(currentSeller, _data);
        await this.amzSellerRepo.save(currentSeller);
      } else {
        let newSeller = new AppAmzSellerEntity();
        Object.assign(newSeller, _data);
        await this.amzSellerRepo.insert(newSeller);
      }
    }

    return 'ok';
  }

  async getOneSellerToFetchListings() {
    return await this.amzSellerRepo.findOne({
        where: [
          {listing_last_fetch_date: IsNull()},

          {listing_last_fetch_date: LessThan(dayjs().subtract(2, 'hour').toDate())},
        ]
      }
    );
  }

  async getOneSellerToFetchListingsVolume() {
    return await this.amzSellerRepo.findOne({
        where: [
          {daily_order_quantity_history_updateTime: IsNull()},
          {
            daily_order_quantity_history_updateTime: LessThan(
              dayjs()
                .subtract(1, 'day')
                .add(10, 'minutes')
                .toDate()
            )
          },
        ]
      }
    );
  }

  async updateListingLastFetchDate(sid: number) {
    await this.amzSellerRepo.update(
      {sid},
      {listing_last_fetch_date: new Date()}
    );
  }

  async updateListingVolumeLastFetchDate(sid: number) {
    await this.amzSellerRepo.update(
      {sid},
      {daily_order_quantity_history_updateTime: new Date()}
    );
  }

  async getSellerTotalCount() {
    return await this.amzSellerRepo.count();
  }

  /**
   * 按店铺账号去重，返回账号列表（供采购人、选图挂载等下拉用）
   */
  async listAccounts(): Promise<Array<{ seller_account_id: string; account_name: string }>> {
    const rows = await this.amzSellerRepo
      .createQueryBuilder('s')
      .select('s.seller_account_id', 'seller_account_id')
      .addSelect('s.account_name', 'account_name')
      .where('s.seller_account_id IS NOT NULL AND s.seller_account_id != :empty', { empty: '' })
      .groupBy('s.seller_account_id')
      .addGroupBy('s.account_name')
      .orderBy('s.account_name', 'ASC')
      .getRawMany();
    return rows.map((r) => ({
      seller_account_id: String(r.seller_account_id ?? ''),
      account_name: String(r.account_name ?? ''),
    }));
  }
}

let mock = [
  {
    "sid": 4984,
    "mid": 1,
    "name": "泽纯贸易-US",
    "seller_id": "APWII13HMFX51",
    "account_name": "泽纯贸易",
    "seller_account_id": 4322,
    "region": "NA",
    "country": "美国",
    "marketplace_id": "ATVPDKIKX0DER",
    "status": 1,
    "has_ads_setting": 1
  },
  {
    "sid": 4981,
    "mid": 4,
    "name": "何锦-UK",
    "seller_id": "A3MD452K9XOTDN",
    "account_name": "何锦",
    "seller_account_id": 4319,
    "region": "EU",
    "country": "英国",
    "marketplace_id": "A1F83G8C2ARO7P",
    "status": 1,
    "has_ads_setting": 1
  },
  {
    "sid": 4982,
    "mid": 1,
    "name": "盟喜Woeau-US",
    "seller_id": "A3KDFZ67UAYDBD",
    "account_name": "盟喜Woeau",
    "seller_account_id": 4320,
    "region": "NA",
    "country": "美国",
    "marketplace_id": "ATVPDKIKX0DER",
    "status": 1,
    "has_ads_setting": 1
  },
  {
    "sid": 4979,
    "mid": 4,
    "name": "唐林军-UK",
    "seller_id": "A2ZID8O1XC27A8",
    "account_name": "唐林军",
    "seller_account_id": 4317,
    "region": "EU",
    "country": "英国",
    "marketplace_id": "A1F83G8C2ARO7P",
    "status": 1,
    "has_ads_setting": 1
  },
  {
    "sid": 4983,
    "mid": 1,
    "name": "二审号-US",
    "seller_id": "A1BQCKOM350QTD",
    "account_name": "二审号",
    "seller_account_id": 4321,
    "region": "NA",
    "country": "美国",
    "marketplace_id": "ATVPDKIKX0DER",
    "status": 1,
    "has_ads_setting": 1
  },
  {
    "sid": 4980,
    "mid": 4,
    "name": "胡涛-UK",
    "seller_id": "A10PY5E0LM0PAD",
    "account_name": "胡涛",
    "seller_account_id": 4318,
    "region": "EU",
    "country": "英国",
    "marketplace_id": "A1F83G8C2ARO7P",
    "status": 1,
    "has_ads_setting": 1
  }
]
