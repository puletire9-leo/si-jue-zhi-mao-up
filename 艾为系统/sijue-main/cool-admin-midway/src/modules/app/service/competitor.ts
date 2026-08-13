import {Provide} from '@midwayjs/decorator';
import {Logger} from "@midwayjs/core";
import {InjectEntityModel} from '@midwayjs/typeorm';
import {ILogger} from "@midwayjs/logger";
import {BaseService} from '@cool-midway/core';
import {IsNull, Repository} from 'typeorm';
import {AppAmzListingCompetitorEntity} from '../entity/competitor';
import {appConfig} from "../../../appConfig";
import {AppAmzListingEntity} from "../entity/listing";

@Provide()
export class AppAmzListingCompetitorService extends BaseService {
  @InjectEntityModel(AppAmzListingCompetitorEntity)
  amzListingCompetitorRepo: Repository<AppAmzListingCompetitorEntity>;

  @InjectEntityModel(AppAmzListingEntity)
  amzListingRepo: Repository<AppAmzListingEntity>;

  @Logger()
  logger: ILogger;

  async getCoreCompetitors(sid: number, asin: string, seller_sku: string): Promise<AppAmzListingCompetitorEntity[]> {
    return await this.amzListingCompetitorRepo.find({
      where: {
        sid,
        asin_mine: asin,
        seller_sku,
        is_core: true,
        status: appConfig.COMPETITOR_STATUS.LIBRARY.value,
      }
    });
  }

  async getCompetitorTodoTotalCount(additional_where_options: object = {}) {
    let whereOptions = additional_where_options;
    Object.assign(whereOptions, {status: appConfig.COMPETITOR_STATUS.PENDING.value});
    return await this.amzListingCompetitorRepo.count({where: whereOptions});
  }

  async getCompetitorLibraryCount(additional_where_options: object = {}) {
    let whereOptions = additional_where_options;
    Object.assign(whereOptions, {status: appConfig.COMPETITOR_STATUS.LIBRARY.value});
    return await this.amzListingCompetitorRepo.count({where: whereOptions});
  }

  async batchDuplicateToListings(
    competitors: AppAmzListingCompetitorEntity[],
    listings: AppAmzListingEntity[],
  ) {

    for (const listing of listings) {
      try {
        let associated_competitors = await this.amzListingCompetitorRepo.find({
          where: {
            sid: listing.sid,
            asin_mine: listing.asin,
            seller_sku: listing.seller_sku,
          }
        });

        for (const competitorToBeDuplicated of competitors) {
          let is_exist = false;
          for (const competitorAssociated of associated_competitors) {

            if (competitorAssociated.asin_competitor === competitorToBeDuplicated.asin_competitor) {
              let origin_props = {
                id: competitorAssociated.id,
                sid: competitorAssociated.sid,
                asin_mine: competitorAssociated.asin_mine,
                seller_sku: competitorAssociated.seller_sku,
              }
              Object.assign(competitorAssociated, competitorToBeDuplicated);
              Object.assign(competitorAssociated, origin_props);
              await this.amzListingCompetitorRepo.save(competitorAssociated);
              is_exist = true;
              break;
            }
          }

          if (!is_exist) {
            Object.assign(competitorToBeDuplicated, {
              sid: listing.sid,
              asin_mine: listing.asin,
              seller_sku: listing.seller_sku,
            });
            delete competitorToBeDuplicated.id;
            await this.amzListingCompetitorRepo.insert(competitorToBeDuplicated);
          }
        }
      } catch (err) {
        console.log(err);
      }
    }
  }


  async batchUpdateStatusLibrary(competitors: AppAmzListingCompetitorEntity[]) {
    for (const competitor of competitors) {

      try {
        competitor.status = appConfig.COMPETITOR_STATUS.LIBRARY.value;
        await this.amzListingCompetitorRepo.save(competitor);

        let custom_listing: AppAmzListingEntity = await this.amzListingRepo.findOne({
          where: {
            sid: competitor.sid,
            asin: competitor.asin_mine,
            seller_sku: competitor.seller_sku,
            is_custom_listing: 1,
          },
        });

        if (custom_listing) {

          if (custom_listing.local_sku === null || String(custom_listing.local_sku).trim() === '') {
            break;
          }

          let equivalent_listings: AppAmzListingEntity[] = await this.amzListingRepo.find({
            where: {
              local_sku: custom_listing.local_sku,
              is_custom_listing: 0,
              status: 1,
              is_delete: 0,
            },
          });

          await this.batchDuplicateToListings([competitor], equivalent_listings);
        }
      } catch (err) {
        console.log(err);
      }
    }
  }

  async batchAnalyseCompetitorBsrRanking(amount: number = 50) {
    try {
      let competitors = await this.amzListingCompetitorRepo.find({
        where: [
          {bsr_rank: IsNull()},
          {bsr_rank: 0},
        ],
        take: amount || 50,
      });

      for (const competitor of competitors) {
        competitor.bsr_rank = appConfig.extract_ranking_from_bsr_info(competitor?.bsr_html);
      }
      await this.amzListingCompetitorRepo.save(competitors);
      return `${competitors.length} competitors' bsr ranking updated successfully.`;
    } catch (err) {
      console.log(err);
      return err;
    }
  }
}
