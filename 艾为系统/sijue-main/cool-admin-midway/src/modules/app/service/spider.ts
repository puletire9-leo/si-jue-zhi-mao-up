import {BaseService} from "@cool-midway/core";
import {InjectEntityModel} from "@midwayjs/typeorm";
import {Brackets, IsNull, LessThan, Repository} from "typeorm";
import {AppAmzListingEntity} from "../entity/listing";
import {AppAmzListingKeywordEntity} from "../entity/keyword";
import {AppAmzListingCompetitorEntity} from "../entity/competitor";
import {appConfig} from "../../../appConfig";
import * as dayjs from "dayjs";
import {AppAmzBsrTaskEntity} from "../entity/bsr_task";
import {AppAmzBsrCandidateEntity} from "../entity/bsr_candidate";
import {AppAmzBsrCandidateCompetitorEntity} from "../entity/bsr_candidate_competitor";
import {Dayjs} from "dayjs";
import {AppAmzDepartmentRankFilterService} from "../service/bsr_department_rank_filter";
import {Inject, Provide} from "@midwayjs/decorator";

@Provide()
export class SpiderService extends BaseService {

  
  @InjectEntityModel(AppAmzListingEntity)
  listingRepo: Repository<AppAmzListingEntity>;

  @InjectEntityModel(AppAmzListingKeywordEntity)
  keywordRepo: Repository<AppAmzListingKeywordEntity>;

  @InjectEntityModel(AppAmzListingCompetitorEntity)
  competitorRepo: Repository<AppAmzListingCompetitorEntity>;

  @InjectEntityModel(AppAmzBsrTaskEntity)
  bsrTaskRepo: Repository<AppAmzBsrTaskEntity>;

  @InjectEntityModel(AppAmzBsrCandidateEntity)
  bsrCandidateRepo: Repository<AppAmzBsrCandidateEntity>;

  @InjectEntityModel(AppAmzBsrCandidateCompetitorEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzBsrCandidateCompetitorEntity>;

  @Inject()
  deptRankFilterService: AppAmzDepartmentRankFilterService;


  async getOneKeywordEntity(
    status = appConfig.KEYWORD_STATUS.CREATED.value,
  ): Promise<AppAmzListingKeywordEntity> {

    const sql = this.keywordRepo.createQueryBuilder('keyword')
      .leftJoin(
        AppAmzListingEntity,
        'listing',
        'keyword.sid = listing.sid AND keyword.asin = listing.asin AND keyword.seller_sku = listing.seller_sku'
      )
      .where(`keyword.status = ${status}`)
      .andWhere(new Brackets(qb => {
        qb
          .where(`listing.is_custom_listing = 0 AND listing.status = 1 AND listing.is_delete = 0`)
          .orWhere('listing.is_custom_listing = 1 AND listing.is_suspended = 0')
      }))
      .select([
        'keyword.*',
        'listing.small_image_url as small_image_url',
        'listing.marketplace as marketplace',
      ])
      .orderBy('RAND()')
      .limit(1)
      .getSql();


    let queryResult = await this.keywordRepo.query(sql);

    let keyword: AppAmzListingKeywordEntity = queryResult.length > 0 ? queryResult[0] : null;

    if (status === appConfig.KEYWORD_STATUS.CREATED.value) {
      if (keyword?.spider_res) delete keyword.spider_res;
    }

    return keyword;
  }

  async getSiblingKeywords(
    sid: number,
    asin: string,
    seller_sku: string,
    status: number = null,
  ) {
    let whereOptions = Object.assign({
      sid,
      asin,
      seller_sku,
    }, (() => {
      return status === null ? {} : {status};
    })());
    return await this.keywordRepo.find({where: whereOptions});
  }

  async saveKeywordSpiderResult(keyword: AppAmzListingKeywordEntity) {
    await this.keywordRepo.save({
      id: keyword.id,
      spider_res: keyword.spider_res,
      status: appConfig.KEYWORD_STATUS.RESEARCHING.value,
    });
  }

  async saveKeywordScore(keyword: AppAmzListingKeywordEntity) {
    await this.keywordRepo.save({
      id: keyword.id,
      score1: keyword.score1, score2: keyword.score2, status: appConfig.KEYWORD_STATUS.PENDING.value,
      score_time: new Date(),
    });
  }


  async getOneListingToCrawlCompetitors(): Promise<AppAmzListingEntity> {
    let queryResult = await this.listingRepo.createQueryBuilder('listing')
      .select('listing.*')
      .andWhere(`listing.small_image_url <> ''`).andWhere(new Brackets(qb => {
        qb
          .where(`listing.is_custom_listing = 0 AND listing.status = 1 AND listing.is_delete = 0`)
          .orWhere('listing.is_custom_listing = 1 AND listing.is_suspended = 0')
      }))
      .andWhere(new Brackets(qb => {
        qb.where('listing.competitor_spider_status = :status',
          {status: appConfig.LISTING_COMPETITOR_SPIDER_STATUS.CREATED.value}
        ).orWhere('listing.competitor_spider_time < :weekAgo',
          {weekAgo: dayjs().subtract(7, "days").format('YYYY-MM-DD')}
        )
      }))
      .orderBy('RAND()')
      .limit(1)
      .execute();

    let listing = queryResult?.length ? queryResult[0] : null;

    if (listing?.is_custom_listing === 0) {
      let custom_listing_equivalent = await this.listingRepo.findOne({
        where: {
          is_custom_listing: 1,
          is_suspended: 0, local_sku: listing.local_sku,
        },
      });
      if (custom_listing_equivalent) {
        listing.competitor_spider_time = new Date();
        await this.listingRepo.save(listing);
        return null;
      }
    }

    if (listing) {
      delete listing.competitor_spider_res;
      delete listing.kw_search_volume_anal_res;
    }

    return listing;
  }

  async getOneListingToAnalyseCompetitorSpiderRes(): Promise<AppAmzListingEntity> {
    try {
      let queryResult = await this.keywordRepo.createQueryBuilder('keyword')
        .leftJoin(AppAmzListingEntity, 'listing', 'keyword.sid = listing.sid AND keyword.asin = listing.asin AND keyword.seller_sku = listing.seller_sku')
        .andWhere(`listing.competitor_spider_res IS NOT NULL`).andWhere(`listing.competitor_spider_status = :status`,
          {status: appConfig.LISTING_COMPETITOR_SPIDER_STATUS.RESEARCHING.value}
        )
        .andWhere(new Brackets(qb => {
          qb
            .where(`listing.is_custom_listing = 0 AND listing.status = 1 AND listing.is_delete = 0`)
            .orWhere('listing.is_custom_listing = 1')
        }))
        .groupBy('keyword.sid, keyword.asin, keyword.seller_sku')
        .select([
          'listing.sid AS sid', 'listing.asin AS asin',
          'listing.seller_sku AS seller_sku',
        ])
        .orderBy('RAND()')
        .limit(1)
        .execute();

      if (!queryResult.length) {
        return null;
      }

      return await this.listingRepo.findOne({
        where: {
          sid: queryResult[0].sid,
          asin: queryResult[0].asin,
          seller_sku: queryResult[0].seller_sku,
        }
      });
    } catch (err) {
      console.log(err);
    }
  }

  async updateListingCompetitorSpiderStatus(listing: AppAmzListingEntity) {
    await this.listingRepo.save({
      id: listing.id,
      competitor_spider_status: listing.competitor_spider_status,
    });
  }

  async saveCompetitorSpiderResult(listing: AppAmzListingEntity) {
    await this.listingRepo.save({
      id: listing.id,
      competitor_spider_res: listing.competitor_spider_res,
      competitor_spider_status: appConfig.LISTING_COMPETITOR_SPIDER_STATUS.RESEARCHING.value,
      competitor_spider_time: new Date(),
    });
  }

  async saveCompetitors(competitors: AppAmzListingCompetitorEntity[], sid: number) {
    for (let c of competitors) {
      let currentCompetitor = await this.competitorRepo.findOne({
        where: {
          sid,
          asin_mine: c.asin_mine,
          asin_competitor: c.asin_competitor,
          seller_sku: c.seller_sku,
        },
      });
      if (currentCompetitor) {
        Object.assign(currentCompetitor, c);
        await this.competitorRepo.save(currentCompetitor);
      } else {
        await this.competitorRepo.insert(c);
      }
    }
  }


  async getOneCompetitorToBeUpdated() {
    let queryResult = await this.competitorRepo.createQueryBuilder('competitor')
      .leftJoin(
        AppAmzListingEntity,
        'listing',
        'competitor.sid = listing.sid AND competitor.asin_mine = listing.asin AND competitor.seller_sku = listing.seller_sku'
      )
      .select([
        'competitor.*',
        'listing.marketplace as marketplace',
      ])
      .where(new Brackets(qb => {
        qb
          .where(`listing.is_custom_listing = 0 AND listing.status = 1 AND listing.is_delete = 0`)
          .orWhere('listing.is_custom_listing = 1 AND listing.is_suspended = 0')
      }))
      .andWhere(new Brackets(qb => {
        qb
          .where({'spider_time': IsNull()})
          .orWhere(new Brackets(qb => {
            qb.where({status: appConfig.COMPETITOR_STATUS.LIBRARY.value})
              .andWhere(
                'competitor.spider_time < :halfWeekAgo',
                {halfWeekAgo: dayjs().subtract(24 * 3.5, "hours").format('YYYY-MM-DD HH:mm:ss')}
              )
          }))
      }))
      .orderBy('RAND()')
      .limit(1)
      .execute();


    return queryResult.length > 0 ? queryResult[0] : null;
  }


  async getOneBsrTaskEntity(
    status = appConfig.BSR_TASK_STATUS.CREATED.value
  ): Promise<AppAmzBsrTaskEntity> {

    const sql = this.bsrTaskRepo.createQueryBuilder('bsr_task')
      .where(`bsr_task.status = ${status}`)
      .select([
        'bsr_task.*',
      ])
      .orderBy('RAND()')
      .limit(1)
      .getSql();

    let queryResult = await this.bsrTaskRepo.query(sql);

    let bsrTask: AppAmzBsrTaskEntity = queryResult.length > 0 ? queryResult[0] : null;

    if (bsrTask && status === appConfig.BSR_TASK_STATUS.CREATED.value) {
      delete bsrTask.spider_res;
      await this.bsrTaskRepo.update(
        {id: bsrTask.id},
        {status: appConfig.BSR_TASK_STATUS.CRAWLING.value}
      );
    }

    return bsrTask;
  }

  async saveBsrTaskSpiderResult(bsrTask: AppAmzBsrTaskEntity) {
    await this.bsrTaskRepo.save({
      id: bsrTask.id,
      spider_res: bsrTask.spider_res,
      status: appConfig.BSR_TASK_STATUS.RESEARCHING.value,
    });
  }

  async saveBsrCandidates(candidates: AppAmzBsrCandidateEntity[]) {
    for (let can of candidates) {
      let currentCandidate = await this.bsrCandidateRepo.findOne({
        where: {
          asin: can.asin,
        },
      });
      if (!currentCandidate) {
        await this.bsrCandidateRepo.insert(can);
      } else {
        await this.bsrCandidateRepo.update(
          {id: currentCandidate.id},
          {
            item_name: can.item_name,
            image_url: can.image_url,
            price: can.price,
            review_num: can.review_num,
            last_star: can.last_star,
            bsr_html: can.bsr_html || currentCandidate.bsr_html,
            bsr_category: can.bsr_category || currentCandidate.bsr_category,
            bsr_rank: can.bsr_rank,
            dispatches_from: can.dispatches_from,
            sold_by: can.sold_by,
            bullet_points: can.bullet_points || currentCandidate.bullet_points,
            dimensions: can.dimensions || currentCandidate.dimensions,
            weight: can.weight || currentCandidate.dimensions,
            date_first_available: can.date_first_available || currentCandidate.date_first_available,
            seller_country: can.seller_country,
          }
        );
      }
    }
  }

  async saveBsrCompetitorSpiderResult(candidate: AppAmzBsrCandidateEntity) {
    console.log(candidate);
    await this.bsrCandidateRepo.save({
      id: candidate.id,
      competitor_spider_res: candidate.competitor_spider_res,
      competitor_spider_status: appConfig.BSR_CANDIDATE_COMPETITOR_SPIDER_STATUS.RESEARCHING.value,
      competitor_spider_time: new Date(),
    });
  }

  async getOneBsrCandidateToCrawlCompetitors(): Promise<AppAmzBsrCandidateEntity> {
    let queryResult = await this.bsrCandidateRepo.createQueryBuilder('candidate')
      .select([
        'candidate.*',
      ])

      .andWhere(`candidate.image_url <> ''`)

      .andWhere(
        `candidate.status = :candidate_status`,
        {candidate_status: appConfig.BSR_CANDIDATE_STATUS.LIBRARY.value}
      )

      .andWhere(new Brackets(qb => {
        qb.where('candidate.competitor_spider_status = :competitor_spider_status',
          {competitor_spider_status: appConfig.BSR_CANDIDATE_COMPETITOR_SPIDER_STATUS.CREATED.value}
        )
      }))

      .orderBy('RAND()')
      .limit(1)
      .execute();

    let candidate = queryResult?.length ? queryResult[0] : null;

    if (candidate) {
      delete candidate.bsr_html;
      delete candidate.bullet_points;
      delete candidate.competitor_spider_res;

      candidate.image_url = candidate?.image_url.replace(/\._.*_/g, '');
    }

    return candidate;
  }

  async getOneBsrCandidateToAnalyseCompetitorSpiderRes(): Promise<AppAmzBsrCandidateEntity> {
    try {
      let queryResult = await this.bsrCandidateRepo.createQueryBuilder('candidate')
        .select('candidate.*')
        .andWhere(new Brackets(qb => {
          qb.where(
            'candidate.competitor_spider_status = :status',
            {status: appConfig.BSR_CANDIDATE_COMPETITOR_SPIDER_STATUS.RESEARCHING.value}
          )
        }))
        .orderBy('RAND()')
        .limit(1)
        .execute();

      return queryResult?.length ? queryResult[0] : null;
    } catch (err) {
      console.log(err);
    }
  }

  async saveBsrCandidateCompetitors(competitors: AppAmzBsrCandidateCompetitorEntity[]) {
    // 2026-04-10: 增加去重和防并发锁，避免重复入库
    for (let c of competitors) {
      // 过滤掉包含 .gif 的图片
      if (c.image_url && /\.gif($|\?)/i.test(c.image_url.toLowerCase())) {
        continue;
      }
      
      // 使用事务和悲观锁防并发
      await this.bsrCandidateCompetitorRepo.manager.transaction(async transactionalEntityManager => {
        let currentCompetitor = await transactionalEntityManager.findOne(AppAmzBsrCandidateCompetitorEntity, {
          where: {
            asin_candidate: c.asin_candidate,
            asin_competitor: c.asin_competitor,
            marketplace: c.marketplace,
            candidate_id: c.candidate_id, // 增加 candidate_id 条件
          },
          lock: { mode: "pessimistic_write" } // 添加悲观锁
        });
        
        if (currentCompetitor) {
          Object.assign(currentCompetitor, c);
          await transactionalEntityManager.save(AppAmzBsrCandidateCompetitorEntity, currentCompetitor);
        } else {
          await transactionalEntityManager.insert(AppAmzBsrCandidateCompetitorEntity, c);
        }
      });
    }
  }

  async resetStaleCrawlingBsrTask() {
    let bsrTasks = await this.bsrTaskRepo.find({
      where: {
        status: appConfig.BSR_TASK_STATUS.CRAWLING.value,
        updateTime: LessThan(dayjs().subtract(15, 'minutes').toDate()),
      }
    });
    if (bsrTasks.length > 0) {
      console.group(`共有 ${bsrTasks.length} 个 BSR 任务需要重置为待调研状态`);
      bsrTasks.forEach((t) => {
        console.log(JSON.stringify({
          id: t.id,
          bsr_link: t.bsr_link,
          remark: t.remark,
        }));
        t.status = appConfig.BSR_TASK_STATUS.CREATED.value;
      });
      await this.bsrTaskRepo.save(bsrTasks);
      console.groupEnd();
    }
  }


  async getOneBsrCompetitorToBeUpdated() {
    let queryResult = await this.bsrCandidateCompetitorRepo.createQueryBuilder('competitor')
      .leftJoin(
        AppAmzBsrCandidateEntity,
        'candidate',
        'competitor.asin_candidate = candidate.asin'
      )
      .select([
        'competitor.*',
        'candidate.marketplace as marketplace',
      ])
      .orderBy('RAND()')
      .limit(1)
      .execute();


    return queryResult.length > 0 ? queryResult[0] : null;
  }

  async funcTemplate() {

  }

  async getNullBsrCandidate(): Promise<AppAmzBsrCandidateEntity> {
    let sql = await this.bsrCandidateRepo.createQueryBuilder('candidate')
      .select([
        'candidate.*',
      ])
      .where('candidate.bsr_html ="" or candidate.bsr_html is null') 
      .orderBy('RAND()')
      .limit(1)
      .getSql();

    let queryResult = await this.bsrCandidateRepo.query(sql);
    let candidate: AppAmzBsrCandidateEntity = queryResult;
    return candidate;
  }

  async saveNullBsrResult(candidate: AppAmzBsrCandidateEntity) {
      let queryResult = await this.bsrTaskRepo.createQueryBuilder('task')
        .select([
          'task.*',
        ])
        .where('task.id = :bsr_task_id', {bsr_task_id: candidate.bsr_task_id})
        .orderBy('RAND()')
        .limit(1)
        .execute();
      let date_first_available = queryResult[0].date_first_available;
      let dateFirstAvailable = null;
      if (candidate.date_first_available) {
        let dateStr = candidate.date_first_available;
          // 使用 dayjs 解析日期字符串
          let date = dayjs(dateStr, 'D. MMMM YYYY');
          if (!date.isValid()) {
            // 如果解析失败，设置为默认日期 1990-01-01
            dateFirstAvailable = dayjs('1990-01-01').toDate();
          } else {
            dateFirstAvailable = date.toDate();
          }
        }
      if (dateFirstAvailable && dayjs(dateFirstAvailable).isBefore(date_first_available)) {
        console.log("产品上架日期"+dayjs(dateFirstAvailable).toDate()+"早于指定日期"+date_first_available+"已归档");
        await this.bsrCandidateRepo.update(
          {id: candidate.id},
          { status: appConfig.BSR_CANDIDATE_STATUS.ARCHIVED.value,
            bsr_html: candidate.bsr_html,
            date_first_available:candidate.date_first_available} 
        );
        return
      }

    let rankFilters = await this.deptRankFilterService.getDepartmentRankFilters(queryResult[0].marketplace);
    console.log("rankFilters:",rankFilters);
    if (candidate.bsr_html && rankFilters.some(filter => candidate.bsr_html.includes(filter.department))) {
      let bsrContentPieces = candidate.bsr_html.split("\n");
      let bsrInfoArr = bsrContentPieces.map(info => {
        console.log('1info:',info,'2content:',info)
        return {
          rank: appConfig.extract_ranking_from_bsr_info(info),
          content: info,
        }
      });
      for (const bsrInfo of bsrInfoArr) {
        for (const filter of rankFilters) {
          if(bsrInfo.content.includes(filter.department)){
            console.log('类目:'+filter.department,'----排名:'+bsrInfo.rank,'----设置的排名'+filter.rank_limit);
          }
          if (bsrInfo.content.includes(filter.department)
            && bsrInfo.rank > filter.rank_limit) {
              console.log(`BSR 信息（${bsrInfo.content}）中的排名超出指定限制：`
                + `类目 ${filter.department} 排名不低于 ${filter.rank_limit}，已归档`);
                await this.bsrCandidateRepo.update(
                  {id: candidate.id},
                  { status: appConfig.BSR_CANDIDATE_STATUS.ARCHIVED.value,
                    bsr_html: candidate.bsr_html,
                    date_first_available:candidate.date_first_available} 
                );
                return
          }
        }
      } 
    }

    await this.bsrCandidateRepo.update(
      {id: candidate.id},
      {bsr_html: candidate.bsr_html,
        date_first_available:candidate.date_first_available
      }
    );
  }

  async getCompetitorDdetails(): Promise<AppAmzBsrCandidateCompetitorEntity> {
    let queryResult = await this.bsrCandidateCompetitorRepo.createQueryBuilder('Competitor')
      .select([
        'Competitor.*',
      ])
      .andWhere(
        `Competitor.status = :candidate_status`,
        {candidate_status: 1}
      )
      .orderBy('RAND()')
      .limit(1)
      .execute();
    let candidate = queryResult?.length ? queryResult[0] : null;
    return candidate;
  }

  async saveCompetitorDdetails(competitor: AppAmzBsrCandidateCompetitorEntity) {

    let distribution_type_code = appConfig.estimate_distribution_type(
      competitor.dispatches_from,
      competitor.sold_by,
      true,
    );
    await this.bsrCandidateCompetitorRepo.update(
      {id: competitor.id},
      {
        bsr_html: competitor.bsr_html,
        bullet_points: competitor.bullet_points,
        date_first_available: competitor.date_first_available,
        dispatches_from:competitor.dispatches_from,
        sold_by:competitor.sold_by,
        dispatches_type:distribution_type_code as string,
        // seller_country:competitor.seller_country,
        // weight:competitor.weight,
        // dimensions:competitor.dimensions,
        bsr_rank:competitor.bsr_rank,
        status:competitor.status,
        item_name:competitor.item_name,
        image_url:competitor.image_url,
        price:competitor.price,
        last_star:competitor.last_star,
        review_num:competitor.review_num,
      }
    );
  }

  async getBsrInfo(): Promise<AppAmzBsrCandidateEntity> {
    let queryResult = await this.bsrCandidateRepo.createQueryBuilder('candidate')
      .select([
        'candidate.*',
      ])
      .andWhere('candidate.status = :candidate_status', { candidate_status: 3 })
      .andWhere('candidate.asin IS NOT NULL AND candidate.asin != ""')
      .andWhere('candidate.marketplace IS NOT NULL AND candidate.marketplace != ""')
      .andWhere('candidate.item_name IS NULL OR candidate.item_name = ""')
      .orderBy('RAND()')
      .limit(1)
      .execute();
    let candidate = queryResult?.length ? queryResult[0] : null;
    return candidate;
  }

  async saveBsrInfo(competitor: AppAmzBsrCandidateEntity) {
    await this.bsrCandidateRepo.update(
      {id: competitor.id},
      {
        bsr_html: competitor.bsr_html,
        bullet_points: competitor.bullet_points,
        date_first_available: competitor.date_first_available,
        dispatches_from:competitor.dispatches_from,
        sold_by:competitor.sold_by,
        seller_country:competitor.seller_country,
        weight:competitor.weight,
        dimensions:competitor.dimensions,
        bsr_rank:competitor.bsr_rank,
        // status:competitor.status,
        image_url:competitor.image_url,
        price:competitor.price,
        last_star:competitor.last_star,
        item_name:competitor.item_name,
        review_num:competitor.review_num
      }
    );
  }

}