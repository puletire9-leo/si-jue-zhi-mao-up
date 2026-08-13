import {Inject, Provide, App} from "@midwayjs/decorator";
import {Logger, Scope, ScopeEnum, Singleton, IMidwayApplication} from "@midwayjs/core";
import {ILogger} from "@midwayjs/logger";
import {InjectEntityModel} from "@midwayjs/typeorm";
import {Repository} from "typeorm";
import {AppUtils} from "../utils/appUtils";
import {AppAmzListingEntity} from "../entity/listing";
import {AppAmzListingKeywordEntity} from "../entity/keyword";
import {AppAmzListingCompetitorEntity} from "../entity/competitor";
import {AppAmzListingService} from "../service/listing";
import {AppAmzListingKeywordService} from "../service/keyword";
import {SpiderService} from "../service/spider";
import {DataAnalyser} from "./DataAnalyser";
import {TacticRunner} from "./TacticRunner";
import {AppAmzBsrCandidateService} from "../service/bsr_candidate";

@Provide()
@Singleton()
export class CycleTaskRunner {

  @App()
  app: IMidwayApplication;

  @Inject()
  appUtils: AppUtils;

  @InjectEntityModel(AppAmzListingEntity)
  listingRepo: Repository<AppAmzListingEntity>;

  @InjectEntityModel(AppAmzListingKeywordEntity)
  keywordRepo: Repository<AppAmzListingKeywordEntity>;

  @InjectEntityModel(AppAmzListingCompetitorEntity)
  competitorRepo: Repository<AppAmzListingCompetitorEntity>;

  @Inject()
  dataAnalyser: DataAnalyser;

  @Inject()
  tacticRunner: TacticRunner;

  @Logger()
  logger: ILogger;

  cycleTasksTest() {
    setInterval(function () {
      console.log(Date.now());
    }, 1000);
  }


  createCycleTask = (
    func: Function,
    timeout = 1000,
    execute_once = false
  ) => {
    let cycleTask = async () => {
      await func();
      if (!execute_once) {
        setTimeout(cycleTask, timeout);
      }
    }
    return cycleTask;
  };

  async start() {
    // this.logger.info('CycleTaskRunner starting...');

    // await this.createCycleTask(async () => {
    //   const listingService = await this.app.createAnonymousContext().requestContext.getAsync(AppAmzListingService);
    //   await listingService.syncListingsOnDemand();
    // }, 1000 * 60 * 60)();
    // await this.createCycleTask(async () => {
    //   const listingService = await this.app.createAnonymousContext().requestContext.getAsync(AppAmzListingService);
    //   await listingService.syncListingsVolumeOnDemand();
    // }, 1000 * 60 * 60)();
    // await this.createCycleTask(async () => {
    //   await this.dataAnalyser.updateDailyOrderQuantity();
    // }, 1000 * 60*60)();

    // await this.createCycleTask(async () => {
    //   await this.dataAnalyser.analyseKeywordSpiderResult();
    // }, 1000*60*60)();
    // await this.createCycleTask(async () => {
    //   await this.dataAnalyser.analyseCompetitorSpiderResult();
    // }, 1000*60*60)();

    // await this.createCycleTask(async () => {
    //     const keywordService = await this.app.createAnonymousContext().requestContext.getAsync(AppAmzListingKeywordService);
    //     await keywordService.fetchKeywordSearchVolumes();
    //   },
    //   1000 *60*60,
    // )();
    // await this.createCycleTask(async () => {
    //   const keywordService = await this.app.createAnonymousContext().requestContext.getAsync(AppAmzListingKeywordService);
    //   await keywordService.fetchKeywordsMonthlySearchVolume();
    // },
    //   1000*60*60)();

    // await this.createCycleTask(async () => {
    //   await this.dataAnalyser.analyseListingKeywordSearchVolume();
    // }, 1000*60*60)();

    // await this.createCycleTask(async () => {
    //   await this.dataAnalyser.updateCompetitorCountHistory();
    // }, 1000*60*60)();

    // await this.createCycleTask(async () => {
    //   await this.tacticRunner.executeTacticPriceP1();
    //   await this.tacticRunner.executeTacticPriceP2();
    //   await this.tacticRunner.executeTacticPriceP3();
    //   await this.tacticRunner.executeTacticPriceP4();
    //   await this.tacticRunner.executeTacticInventory();
    // }, 1000*60*60)();


    // await this.createCycleTask(async () => {
    //   await this.dataAnalyser.analyseBsrTaskSpiderResult();
    // }, 1000)();
    // await this.createCycleTask(async () => {
    //   await this.dataAnalyser.analyseBsrCandidateCompetitorSpiderResult();
    // }, 1000)();
    // await this.createCycleTask(async () => {
    //   const spiderService = await this.app.createAnonymousContext().requestContext.getAsync(SpiderService);
    //   await spiderService.resetStaleCrawlingBsrTask();
    // }, 1000)();
    // await this.createCycleTask(async () => {
    //   const appAmzBsrCandidateService = await this.app.createAnonymousContext().requestContext.getAsync(AppAmzBsrCandidateService);
    //   await appAmzBsrCandidateService.syncAllAsins();
    // }, 1000*60*60*12)();


    // await this.createCycleTask(async () => {
    //   const appAmzBsrCandidateService = await this.app.createAnonymousContext().requestContext.getAsync(AppAmzBsrCandidateService);
    //   await appAmzBsrCandidateService.getforeign_exchange();
    // }, 1000*60*60*24)();
    // await this.createCycleTask(async () => {
    //   const appAmzBsrCandidateService = await this.app.createAnonymousContext().requestContext.getAsync(AppAmzBsrCandidateService);
    //   await appAmzBsrCandidateService.set_foreign_exchange();
    // }, 1000*60*60*24)();
  }
}
