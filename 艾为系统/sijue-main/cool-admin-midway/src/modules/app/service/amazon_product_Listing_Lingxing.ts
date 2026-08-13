import { BaseService } from '@cool-midway/core';
import { Repository, In } from 'typeorm';
import { AmazonProductListingLingxingEntity } from "../entity/amazon_product_Listing_Lingxing";
import { AppAmzBsrCandidateCompetitorEntity } from "../entity/bsr_candidate_competitor";
import { BazhuayuUtils, AmzTargetData } from "../utils/bazhuayu/bazhuayuUtils";
import { Inject, Provide, sleep } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { AppTaskManagementEntity } from '../entity/bzy_task_management';
import { OxylabsService } from './OxylabsService';
import { ImageSimilarityTool } from './ImageSearchUtil';
import {IsNull, LessThan} from 'typeorm';
import { AppAmzDepartmentRankFilterEntity } from "../entity/bsr_department_rank_filter";

import {KeywordSearchVolumeData} from "../interface/keyword-search-volume-data";
import { BaseSysParamEntity } from '../../base/entity/sys/param'; 
import axios from 'axios'; 
import { SellerspriteTool } from "../utils/maijiajingling/SellerspriteUtil";
import { AppAmzBsrProductListingLingxingProcessEntity } from "../entity/bsr_product_Listing_Lingxing_process";
import { AppAmzBsrProductListingLingxingService } from "./bsr_product_Listing_Lingxing";



//**
// 1、领星进来的 竞品初始状态status=5，0.78分以上为6，0.72分以上为7，8为待删除数据
// 2、image_state 为图片状态，1为待获取，2为获取完成英国，3完成德国，4完成法国，5完成西班牙，6完成意大利
// 3、搜索页数据获取图片，获取图片的规则为 image_state 为 123456的全部获取
// 4、搜索页筛选规则，1、价格筛选,0.5x~2x之间。2、标题筛选，匹配标题中六个单词，中2则进入数据库
//  */
 
const COUNTRIES = [
  { name: '英国', domain: 'amazon.co.uk', state: 2, prevState: 1 }, // 英国处理状态1的数据，完成后变为2
  { name: '德国', domain: 'amazon.de', state: 3, prevState: 2 },     // 德国处理状态2的数据，完成后变为3
];

// 八爪鱼任务配置
const BAZHUAYU_PROCESSES = [
  { taskId: "7523d0d3-7073-4812-9fc6-afc03186b11d", actionId: "qjm68xg53uo" },
  { taskId: "e9988e23-9b3c-4d97-b78d-aac979566871", actionId: "qjm68xg53uo" },
  { taskId: "82f3698e-7252-4924-a528-4e7caa178c26", actionId: "qjm68xg53uo" },
  
  { taskId: "7a1c397a-a2a7-49a1-8046-e1ef9bccf27c", actionId: "qjm68xg53uo" },
  { taskId: "f343c80e-53cb-466d-8f8c-a8449f9b676c", actionId: "qjm68xg53uo" },
  { taskId: "d21d04a5-1d07-4982-885a-684f55c163c1", actionId: "qjm68xg53uo" }
];
const BAZHUAYU_PROCESSES_BY_COUNTRY: Record<string, { taskId: string; actionId: string }[]> = {
  英国: BAZHUAYU_PROCESSES.slice(0, 3),
  德国: BAZHUAYU_PROCESSES.slice(3, 6)
};

// 任务状态常量
const TASK_STATUSES = {
  UNEXECUTED: 'Unexecuted',  // 未执行
  RUNNING: 'Running',        // 执行中
  FINISHED: 'Finished',      // 执行完成
  FAILED: 'Failed',          // 执行失败
  STOPPED: 'Stopped'         // 已停止
};


// 数据状态常量（更新后）
const DATA_STATES = {
  PENDING: 1,         // 待处理
  UK_COMPLETED: 2,    // 英国处理完成
  DE_COMPLETED: 3,    // 德国处理完成
  FR_COMPLETED: 4,    // 法国处理完成
  ES_COMPLETED: 5,    // 西班牙处理完成
  IT_COMPLETED: 6,    // 意大利处理完成
  ALL_COMPLETED: 7,   // 所有国家完成
  INVALID: 8,         // 无效数据 
  TIMEOUT: 9          // 处理超时 
};

// 分隔线（50个横杠）
const SEPARATOR = '-'.repeat(50);

@Provide()
export class AppAmzProductListingLingxingService extends BaseService {
  @InjectEntityModel(AmazonProductListingLingxingEntity)
  bsrProductListingLingxingRepo: Repository<AmazonProductListingLingxingEntity>;
  
  @InjectEntityModel(AppAmzBsrProductListingLingxingProcessEntity)
  processListingRepo: Repository<AppAmzBsrProductListingLingxingProcessEntity>;

  @InjectEntityModel(AppAmzBsrCandidateCompetitorEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzBsrCandidateCompetitorEntity>;

  @InjectEntityModel(AppTaskManagementEntity)
  taskManagementRepo: Repository<AppTaskManagementEntity>;
  
  @InjectEntityModel(AppAmzDepartmentRankFilterEntity)
  departmentFilterRepo: Repository<AppAmzDepartmentRankFilterEntity>;

  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamRepo: Repository<BaseSysParamEntity>;

  @Inject()
  sellerspriteTool: SellerspriteTool;

  @Inject()
  bazhuayuUtils: BazhuayuUtils;

  @Inject()
  appAmzBsrProductListingLingxingService: AppAmzBsrProductListingLingxingService;

  @Inject()
  oxylabsService: OxylabsService;
  
  @Inject()
  imageSimilarityTool: ImageSimilarityTool;

  /**
   * 根据Marketplace获取国家配置
   */
  private getCountryByMarketplace(marketplace: string) {
    if (!marketplace) return null;
    // marketplace中直接存储的是中文名称
    if (marketplace === '英国') return COUNTRIES.find(c => c.name === '英国');
    if (marketplace === '德国') return COUNTRIES.find(c => c.name === '德国');
    return null;
  }

  /**
   * 手动处理单条数据：根据数据所属国家执行八爪鱼数据获取
   * @param id 数据ID
   */
  async manualProcessSingleItem(id: number) {
    // 1. 获取目标数据
    const item = await this.processListingRepo.findOne({ where: { id } });
    if (!item) {
      throw new Error(`未找到ID=${id}的数据`);
    }

    const country = this.getCountryByMarketplace(item.marketplace);
    if (!country) {
      throw new Error(`数据ID=${id}的Marketplace(${item.marketplace})无法匹配到支持的国家`);
    }

    console.log(`开始手动处理数据ID=${id}，所属国家=${country.name}，重置状态...`);

    // 2. 创建手动任务记录
    const manualTask = new AppTaskManagementEntity();
    manualTask.taskCode = `manual-${id}-${Date.now()}`;
    manualTask.taskName = `手动处理单条数据-${id}-${country.name}`;
    manualTask.taskStatus = TASK_STATUSES.RUNNING;
    manualTask.invokeTime = new Date();
    manualTask.totalCount = 1;
    manualTask.completedCount = 0;
    await this.taskManagementRepo.save(manualTask);

    try {
      // 3. 重置状态为初始状态 (image_state = 1)
      item.image_state = DATA_STATES.PENDING;
      await this.processListingRepo.save(item);

      // 初始化映射
      const itemCountryMap: Map<number, Set<string>> = new Map();
      itemCountryMap.set(item.id, new Set());

      // 4. 执行对应国家任务
      await this.processCountryTasks(
        country,
        itemCountryMap,
        [item], 
        manualTask.id,
        0
      );

      console.log(`八爪鱼识图完成，开始执行后续处理流程...`);

      // 5. 搜索页获取
      console.log('开始搜索页数据获取任务...');
      await this.processSearchByItemName(item.id);

      // 6. 竞品去重
      console.log('开始去重任务...');
      await this.deduplicateCompetitorData(item.asin, item.marketplace);

      // 7. 阿里云图片上传
      console.log('开始阿里云图片上传任务...');
      await this.processAliyunImageUpload(item.asin);

      // 8. 图片对比
      console.log('开始阿里云图片对比任务...');
      await this.processAliyunImageSimilarity(item.asin);

      // 9. 完成任务
      manualTask.completedCount = 1;
      manualTask.taskStatus = TASK_STATUSES.FINISHED;
      manualTask.executeEndTime = new Date();
      await this.taskManagementRepo.save(manualTask);

      return { success: true, message: `手动处理完成 (${country.name})` };

    } catch (error) {
      console.error(`手动处理数据ID=${id}失败:`, error);
      manualTask.taskStatus = TASK_STATUSES.FAILED;
      manualTask.executeResult = error.message;
      manualTask.executeEndTime = new Date();
      await this.taskManagementRepo.save(manualTask);
      throw error;
    }
  }

  /**
   * 主入口：处理所有待处理状态的数据（根据数据所属国家并行或分组处理）
   */
  async processAllCountriesInOrder() {
    // 创建总体任务记录
    const overallTask = new AppTaskManagementEntity();
    overallTask.taskCode = `overall-${Date.now()}`;
    overallTask.taskName = '处理所有待处理数据(按国家)';
    overallTask.taskStatus = TASK_STATUSES.UNEXECUTED;
    overallTask.invokeTime = new Date();
    await this.taskManagementRepo.save(overallTask);
  
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0); 
  
    try {
      // 重置3天前image_state逻辑
      await this.resetImageStateForThreeDaysAgo(threeDaysAgo);
  
      // 1. 查询所有待处理数据 (image_state = 1)
      const allPendingItems = await this.processListingRepo.find({
        where: { image_state: DATA_STATES.PENDING },
        order: { id: 'ASC' } // 也可以按marketplace排序
      });

      if (allPendingItems.length === 0) {
        console.log('没有待处理的数据');
        overallTask.taskStatus = TASK_STATUSES.FINISHED;
        overallTask.executeResult = '无待处理数据';
        overallTask.executeEndTime = new Date();
        await this.taskManagementRepo.save(overallTask);
        return;
      }

      console.log(`总待处理数据量: ${allPendingItems.length}条`);
  
      overallTask.taskStatus = TASK_STATUSES.RUNNING;
      overallTask.totalCount = allPendingItems.length;
      overallTask.completedCount = 0;
      await this.taskManagementRepo.save(overallTask);
  
      // 2. 按国家分组
      const countryGroups = new Map<string, typeof allPendingItems>();
      for (const item of allPendingItems) {
        const country = this.getCountryByMarketplace(item.marketplace);
        if (country) {
          if (!countryGroups.has(country.name)) {
            countryGroups.set(country.name, []);
          }
          countryGroups.get(country.name)!.push(item);
        } else {
          console.warn(`数据ID=${item.id} Marketplace=${item.marketplace} 未匹配到已知国家，跳过`);
          // 也可以标记为无效?
        }
      }

      console.log(`数据将按以下国家分组处理: ${Array.from(countryGroups.keys()).join(', ')}`);
      console.log(SEPARATOR);
  
      let globalCompletedCount = 0;
  
      // 3. 遍历每个国家分组处理
      for (const [countryName, items] of countryGroups) {
        const countryConfig = COUNTRIES.find(c => c.name === countryName);
        if (!countryConfig) continue;

        console.log(`开始处理${countryName}任务，共${items.length}条数据`);
  
        // 初始化映射
        const itemCountryMap: Map<number, Set<string>> = new Map();
        items.forEach(item => {
          if (!itemCountryMap.has(item.id)) {
            itemCountryMap.set(item.id, new Set());
          }
        });
  
        // 处理当前国家任务
        const countryCompletedCount = await this.processCountryTasks(
          countryConfig,
          itemCountryMap,
          items,
          overallTask.id,
          globalCompletedCount
        );
  
        globalCompletedCount += countryCompletedCount;
        overallTask.completedCount = Math.min(globalCompletedCount, overallTask.totalCount);
        await this.taskManagementRepo.save(overallTask);
  
        console.log(`${countryName}任务处理完成，当前累计完成: ${globalCompletedCount}/${overallTask.totalCount}`);
        console.log(SEPARATOR);
  
        // 国家之间间隔
        await sleep(5000);
      }
  
      // 所有完成
      console.log('所有分组任务处理完成，开始执行全局去重...');
      await this.deduplicateCompetitorData();

      overallTask.taskStatus = TASK_STATUSES.FINISHED;
      overallTask.executeEndTime = new Date();
      overallTask.completedCount = globalCompletedCount; 
      await this.taskManagementRepo.save(overallTask);
  
    } catch (error) {
      console.error(`处理任务时发生错误: ${error.message}`, error.stack);
      overallTask.taskStatus = TASK_STATUSES.FAILED;
      overallTask.executeEndTime = new Date();
      overallTask.executeResult = error.message;
      await this.taskManagementRepo.save(overallTask);
    }
  }

  /**
 * 重置3天前数据的image_state：按product_code分组，每组仅一条设为1（其余设为0）
 * @param threeDaysAgo 3天前的时间节点
 */
async resetImageStateForThreeDaysAgo(threeDaysAgo: Date) {
  console.log(`开始重置3天前（${threeDaysAgo.toLocaleString()}）数据的image_state...`);

  // 1. 查询3天前需要重置的记录（updateTime < 三天前 且 status=0）
  const targetItems = await this.processListingRepo.find({
    where: {
      updateTime: LessThan(threeDaysAgo),
      // status: 0
    },
    select: ['id', 'product_code', 'total_volume', 'image_state', 'marketplace'] // 2026-04-27 增加 marketplace 字段
  });

  if (targetItems.length === 0) {
    console.log(`未找到3天前需要重置image_state的记录`);
    return;
  }

  console.log(`共查询到${targetItems.length}条3天前需要重置的记录`);

  // 2. 按 product_code + marketplace 分组
  const productCodeGroups = new Map<string, typeof targetItems>();
  for (const item of targetItems) {
    const key = `${item.product_code || 'UNKNOWN'}_${item.marketplace || 'UNKNOWN'}`; // 增加 marketplace 区分
    if (!productCodeGroups.has(key)) {
      productCodeGroups.set(key, []);
    }
    productCodeGroups.get(key)!.push(item);
  }

  console.log(`共分为${productCodeGroups.size}个 product_code+marketplace 分组`);

  // 3. 批量更新数组（减少数据库操作）
  const updateItems: AppAmzBsrProductListingLingxingProcessEntity[] = [];

  // 4. 遍历每个分组处理
  for (const [productCode, groupItems] of productCodeGroups) {
    // 处理total_volume无效值（转为-1，确保排序有效）
    const sortedItems = groupItems.map(item => ({
      ...item,  
      // 转换total_volume为数字，无效值设为-1
      normalizedTotalVolume: typeof item.total_volume === 'number' && !isNaN(item.total_volume)
        ? item.total_volume
        : -1
    }))
    // 排序规则：先按total_volume降序，再按id升序（确保唯一）
    .sort((a, b) => {
      if (b.normalizedTotalVolume !== a.normalizedTotalVolume) {
        return b.normalizedTotalVolume - a.normalizedTotalVolume; // 数值大的在前
      }
      return a.id - b.id; // 体积相同时，id小的在前
    });

    // 2026-02-09 修改：不再限制每组只更新一条，而是更新组内所有数据
    // const targetId = sortedItems[0].id;
    for (const item of groupItems) {
      // item.image_state = item.id === targetId ? 1 : 0;
      item.image_state = 1; // 全部设为待处理状态
      updateItems.push(item);
    }

    // console.log(`分组[${productCode}]：共${groupItems.length}条记录，设为image_state=1的记录ID=${targetId}`);
    console.log(`分组[${productCode}]：共${groupItems.length}条记录，全部设为image_state=1`);
  }

  // 5. 批量保存更新（提高性能）
  if (updateItems.length > 0) {
    await this.processListingRepo.save(updateItems);
    console.log(`成功重置${updateItems.length}条记录的image_state`);
  }

  console.log(`3天前数据image_state重置完成`);
}

  async getLatestTaskStatus() {
    // 查询最近的总体任务状态（八爪鱼国家处理）
    const latestTask = await this.taskManagementRepo.findOne({
      where: { taskName: '按顺序处理所有国家任务' },
      order: { invokeTime: 'DESC' }
    });
    
    // 查询八爪鱼识图任务的状态
    const bzyTasks = await this.taskManagementRepo.find({
      where: { taskName: '八爪鱼识图任务'},
      order: { invokeTime: 'DESC' },
      take: 1
    });
    
    // 查询搜索任务的状态
    const searchTasks = await this.taskManagementRepo.find({
      where: { taskName: 'item_name搜索任务' },
      order: { invokeTime: 'DESC' },
      take: 1
    });
    
    // 查询阿里云识图任务状态
    const aliyunTasks = await this.taskManagementRepo.find({
      where: { taskName: '阿里云以图识图任务' },
      order: { invokeTime: 'DESC' },
      take: 1
    });

    const competitorTasks = await this.taskManagementRepo.find({
      where: { taskName: '竞品详情获取任务' }, 
      order: { invokeTime: 'DESC' },
      take: 1
    });
    
    // 返回包含所有任务统计的结果
    return {
      overallTask: latestTask || null,  // 总任务（含总待处理/已完成）
      bzyTask: bzyTasks[0] || null,     // 八爪鱼识图任务
      searchTask: searchTasks[0] || null, // 搜索任务（含统计）
      aliyunTask: aliyunTasks[0] || null,  // 阿里云任务（含统计）
      competitorTask: competitorTasks[0] || null, // 新增竞品任务状态
    };
  }
  
  /**
   * 处理单个国家的任务
   * 确保当前国家处理所有需要处理的数据
   */
  /**
 * 处理单个国家的任务
 * 确保当前国家处理所有需要处理的数据
 */
  async processCountryTasks(
    country: { name: string; domain: string; state: number; prevState: number },
    itemCountryMap: Map<number, Set<string>>,
    allItems: AppAmzBsrProductListingLingxingProcessEntity[],
    overallTaskId: number,
    currentGlobalCompleted: number
  ): Promise<number> { 
    // 1. 筛选待处理数据
    const itemsToProcess = allItems.filter(item => {
      const processedCountries = itemCountryMap.get(item.id) || new Set();
      if (processedCountries.has(country.name)) return false;

      // 校验Marketplace是否匹配当前国家
      const itemCountry = this.getCountryByMarketplace(item.marketplace);
      if (itemCountry?.name !== country.name) return false;

      // 只要是待处理状态即可
      return item.image_state === DATA_STATES.PENDING;
    });

    console.log(`${country.name}需要处理${itemsToProcess.length}条数据`);

    if (itemsToProcess.length === 0) {
      console.log(`${country.name}没有需要处理的数据，继续下一个国家`);
      return 0;
    }

    const countryProcesses = BAZHUAYU_PROCESSES_BY_COUNTRY[country.name] || [];
    if (countryProcesses.length === 0) {
      console.warn(`${country.name}未配置八爪鱼任务，已跳过`);
      return 0;
    }

    const slots = countryProcesses.map(proc => ({
      ...proc,
      status: 'IDLE' as 'IDLE' | 'STARTING' | 'RUNNING' | 'SAVING',
      item: null as AppAmzBsrProductListingLingxingProcessEntity | null,
      startTime: 0
    }));

    let countryCompletedCount = 0;
    let pendingIndex = 0; // 指向下一个待处理的item索引
    
    console.log(`${country.name}开始并行处理，任务池大小=${slots.length}`);

    // 定义内部辅助函数：启动单个任务
    const startSingleTask = async (slot: typeof slots[0], loopUrl: string) => {
      try {
        // 1. 停止旧任务 (忽略错误)
        await this.stopBzyTask(slot.taskId).catch(() => {});
        
        // 2. 更新参数 (已有重试机制)
        await this.updateTaskLoopItems({
            taskId: slot.taskId,
            actionId: slot.actionId,
            loopType: "UrlList",
            loopItems: [loopUrl]
        });

        // 3. 启动任务
        const res = await this.bzyShiTuByCountry(slot.taskId, slot.item!.id, country.name);
        return res.success;
      } catch (e) {
        console.error(`启动任务${slot.taskId}异常:`, e);
        return false;
      }
    };

    // 定义内部辅助函数：处理完成的任务
    const processCompletedSlot = async (slot: typeof slots[0]) => {
      if (!slot.item) return;
      const item = slot.item;
      
      // 获取数据
      const dataResult = await this.bazhuayuUtils.getAmzStructuredData(
        slot.taskId,
        country.name,
        100,
        { asinKey: 'ASIN', imgUrlKey: 'imgurl1', sourceUrlKey: '任务源网址', priceKey: '价格' }
      );
      
      // 保存竞争数据
      await this.processAndSaveCompetitorData(item, dataResult.structuredData, country.name);
      
      // 标记八爪鱼数据为已导出
      await this.bazhuayuUtils.markDataAsExported(slot.taskId);
      
      // 更新Map和数据库状态
      if (!itemCountryMap.has(item.id)) {
        itemCountryMap.set(item.id, new Set());
      }
      itemCountryMap.get(item.id)!.add(country.name);
      
      await this.processListingRepo.update(
        { id: item.id },
        { image_state: DATA_STATES.IT_COMPLETED }
      );
      
      console.log(`${country.name}数据ID=${item.id}完成，获取${dataResult.structuredData?.length || 0}条数据`);
    };

    // 3. 主循环：只要还有待处理项，或者还有任务在运行，就继续
    while (pendingIndex < itemsToProcess.length || slots.some(s => s.status !== 'IDLE')) {
      
      // --- A. 填充空闲槽位 ---
      const idleSlots = slots.filter(s => s.status === 'IDLE');
      for (const slot of idleSlots) {
        if (pendingIndex >= itemsToProcess.length) break; 

        const item = itemsToProcess[pendingIndex];
        pendingIndex++; 

        // 构造并校验URL
        const loopUrl = item.image_url ? `https://www.${country.domain}/stylesnap?q=${item.image_url}` : '';
        if (!loopUrl) {
          console.error(`${country.name}数据ID=${item.id}无效：缺少image_url`);
          await this.processListingRepo.update({ id: item.id }, { image_state: DATA_STATES.INVALID });
          itemCountryMap.delete(item.id);
          continue; // 继续下一个item，Slot保持IDLE
        }

        // 分配任务并异步启动
        slot.status = 'STARTING';
        slot.item = item;
        slot.startTime = Date.now();
        console.log(`${country.name}分配数据ID=${item.id}到任务${slot.taskId}`);

        // 不await，允许并行启动
        startSingleTask(slot, loopUrl).then(success => {
          if (success) {
            slot.status = 'RUNNING';
          } else {
            console.error(`${country.name}数据ID=${item.id}启动失败，重置Slot`);
            slot.status = 'IDLE';
            slot.item = null;
          }
        });
      }

      // --- B. 检查运行中任务的状态 ---
      const runningSlots = slots.filter(s => s.status === 'RUNNING');
      if (runningSlots.length > 0) {
        const taskIds = runningSlots.map(s => s.taskId);
        try {
          // 批量查询状态
          const statusResult = await this.getBzyTaskStatusesWithRetry(taskIds);
          const statusMap = statusResult.data.reduce((map, info) => {
            map[info.taskId] = info.status;
            return map;
          }, {} as Record<string, string>);

          // 标记完成的任务
          for (const slot of runningSlots) {
            const status = statusMap[slot.taskId];
            if (status === TASK_STATUSES.FINISHED || status === TASK_STATUSES.STOPPED) {
              console.log(`${country.name}任务${slot.taskId}已${status}，准备保存数据`);
              slot.status = 'SAVING';
            }
          }
        } catch (error) {
          console.warn(`${country.name}状态查询失败，稍后重试: ${error.message}`);
        }
      }

      // --- C. 处理待保存的任务 ---
      const savingSlots = slots.filter(s => s.status === 'SAVING');
      await Promise.all(savingSlots.map(async (slot) => {
        try {
           await processCompletedSlot(slot);
           countryCompletedCount++;
           
           // 更新总进度
           const currentOverallTask = await this.taskManagementRepo.findOne({ where: { id: overallTaskId } });
           if (currentOverallTask) {
             const newGlobalCompleted = currentGlobalCompleted + countryCompletedCount;
             currentOverallTask.completedCount = Math.min(newGlobalCompleted, currentOverallTask.totalCount);
             const progressPercent = Math.floor((currentOverallTask.completedCount / currentOverallTask.totalCount) * 100);
             currentOverallTask.executeResult = `处理中：${currentOverallTask.completedCount}/${currentOverallTask.totalCount}（${progressPercent}%）`;
             await this.taskManagementRepo.save(currentOverallTask);
           }
        } catch (error) {
           console.error(`${country.name}数据ID=${slot.item?.id}保存结果失败`, error);
        } finally {
           // 无论成功失败，释放Slot
           slot.status = 'IDLE';
           slot.item = null;
        }
      }));

      // --- D. 等待 ---
      // 如果有空闲槽位且有待处理数据，快速进入下一轮；否则等待轮询
      const hasIdleAndPending = slots.some(s => s.status === 'IDLE') && pendingIndex < itemsToProcess.length;
      if (!hasIdleAndPending) {
         await sleep(5000); // 5秒轮询一次
      } else {
         await sleep(200); // 稍微缓冲
      }
    }

    return countryCompletedCount;
  }

  /**
   * 监控任务状态：完成后处理数据、存储并更新商品-国家跟踪地图
   */
  async monitorAllTasksStatus(
    taskIds: string[],
    itemTaskMap: { item: AppAmzBsrProductListingLingxingProcessEntity; task: { taskId: string; actionId: string }; loopUrl: string }[],
    country: { name: string; domain: string; state: number },
    itemCountryMap: Map<number, Set<string>>,
    maxChecks: number,
    checkInterval: number
  ) {
    const taskCompletionStatus: Record<number, string> = {};
    let checkCount = 1;

    while (checkCount <= maxChecks) {
      if (checkCount > 1) await sleep(checkInterval);

      let allTaskStatus: Record<string, string> = {};
      try {
        const statusResult = await this.getBzyTaskStatusesWithRetry(taskIds);
        allTaskStatus = statusResult.data.reduce((map, info) => {
          map[info.taskId] = info.status;
          return map;
        }, {} as Record<string, string>);

        itemTaskMap.forEach(({ item, task }) => {
          const status = allTaskStatus[task.taskId] || '未知';
          taskCompletionStatus[item.id] = status;
        });

      } catch (error) {
        if (error.message.includes('statusCode=429')) {
          console.warn(`任务状态查询限流，将延长等待时间，当前检查次数：${checkCount}`);
          checkCount++;
          continue;
        }
        console.error(`状态查询失败：${error.message}`);
        throw error;
      }

      // 判断所有任务是否完成
      const allCompleted = itemTaskMap.every(({ task }) => {
        const status = allTaskStatus[task.taskId] || '未知';
        return [TASK_STATUSES.FINISHED, TASK_STATUSES.STOPPED].includes(status);
      });

      if (allCompleted) {
        console.log(`${country.name}所有任务已完成，开始处理结果数据`);
        // 处理已完成任务的数据
        for (const { item, task } of itemTaskMap) {
          const taskStatus = allTaskStatus[task.taskId];

          if (taskStatus === TASK_STATUSES.FINISHED) {
            try {
              // 获取八爪鱼原始数据
              const dataResult = await this.bazhuayuUtils.getAmzStructuredData(
                task.taskId,
                country.name,
                100,
                { asinKey: 'ASIN', imgUrlKey: 'imgurl1', sourceUrlKey: '任务源网址', priceKey: '价格' }
              );
              const dataCount = dataResult.structuredData?.length || 0;

              // 存储竞争数据到本地数据库
              await this.processAndSaveCompetitorData(item, dataResult.structuredData, country.name);

              // 标记八爪鱼数据为已导出
              await this.bazhuayuUtils.markDataAsExported(task.taskId);

              // 更新商品-国家跟踪地图
              if (!itemCountryMap.has(item.id)) {
                itemCountryMap.set(item.id, new Set());
              }
              itemCountryMap.get(item.id)!.add(country.name);

              // 更新当前国家对应的状态
              await this.processListingRepo.update(
                { id: item.id },
                { image_state: country.state }
              );

              console.log(`${country.name}数据ID=${item.id}获取成功，共${dataCount}条，状态已更新为${country.state}`);

            } catch (error) {
              if (error.message.includes('标记已导出失败')) {
                console.error(`${country.name}数据ID=${item.id}：数据存储成功，但标记导出失败：${error.message}`);
                // 即使标记导出失败，仍视为当前国家处理完成
                if (!itemCountryMap.has(item.id)) {
                  itemCountryMap.set(item.id, new Set());
                }
                itemCountryMap.get(item.id)!.add(country.name);
                await this.processListingRepo.update(
                  { id: item.id },
                  { image_state: country.state }
                );
              } else {
                console.error(`${country.name}数据ID=${item.id}获取失败：${error.message}`);
              }
            }
          } else if (taskStatus === TASK_STATUSES.STOPPED) {
            console.warn(`${country.name}数据ID=${item.id}任务已停止，未获取数据`);
          }
        }
        return taskCompletionStatus;
      }

      checkCount++;
    }

    // 超时处理，标记为9
    const timeoutItemIds = itemTaskMap.map(m => m.item.id);

    const timeoutError = new Error(`${country.name}任务处理超时（超过${maxChecks * checkInterval / 60000}分钟），已标记${timeoutItemIds.length}条数据为超时状态`);
    console.error(timeoutError.message);
    throw timeoutError;
  }

  /**
   * 手动去重逻辑：根据asin_competitor + marketplace + asin_candidate + status=6
   * 保留最新的一条（按ID降序）
   */
  async deduplicateCompetitorData(targetAsinCandidate?: string, targetMarketplace?: string) {
    console.log('开始执行竞品数据去重（status in 6,7,8）...');
    
    // 构建SQL查询条件
    let sqlCondition = 'status IN (6, 7, 8)';
    const params: any[] = [];
    
    if (targetAsinCandidate) {
        sqlCondition += ' AND asin_candidate = ?';
        params.push(targetAsinCandidate);
    }
    
    if (targetMarketplace) {
        sqlCondition += ' AND marketplace = ?';
        params.push(targetMarketplace);
    }

    // 1. 查找所有重复的组
    const duplicates = await this.bsrCandidateCompetitorRepo.query(`
      SELECT asin_candidate, asin_competitor, marketplace
      FROM app_amz_bsr_candidate_competitor
      WHERE ${sqlCondition}
      GROUP BY asin_candidate, asin_competitor, marketplace
      HAVING COUNT(*) > 1
    `, params);

    if (duplicates.length === 0) {
      console.log('未发现重复数据');
      return { success: true, message: '未发现重复数据' };
    }

    console.log(`发现${duplicates.length}组重复数据，开始清理...`);
    let deletedCount = 0;

    // 2. 遍历每组，保留最新的一条
    for (const dup of duplicates) {
      // 注意：这里需要处理 asin_candidate 为 null 的情况
      const whereCondition: any = {
        asin_competitor: dup.asin_competitor,
        marketplace: dup.marketplace,
        status: In([6, 7, 8])
      };
      
      if (dup.asin_candidate) {
        whereCondition.asin_candidate = dup.asin_candidate;
      } else {
        whereCondition.asin_candidate = IsNull();
      }

      const records = await this.bsrCandidateCompetitorRepo.find({
        where: whereCondition,
        order: { id: 'DESC' } // ID越大越新
      });

      if (records.length > 1) {
        // 保留第一个（最新的），删除其余的
        const toDelete = records.slice(1);
        const deleteIds = toDelete.map(r => r.id);
        if (deleteIds.length > 0) {
            await this.bsrCandidateCompetitorRepo.delete(deleteIds);
            deletedCount += deleteIds.length;
        }
      }
    }

    console.log(`去重完成，共删除${deletedCount}条重复数据`);
    return { success: true, message: `去重完成，共删除${deletedCount}条重复数据` };
  }

  /**
   * 处理获取到的竞争数据并存储到数据库（仅保留价格合适的数据）
   */
  async processAndSaveCompetitorData(
    sourceItem: AppAmzBsrProductListingLingxingProcessEntity,
    structuredData: AmzTargetData[],
    countryName: string
  ) {
    if (!structuredData || structuredData.length === 0) {
      console.log(`没有需要处理的竞争数据（数据ID=${sourceItem.id}，国家=${countryName}）`);
      return;
    }

    // 打印调试信息：国家、数据量、以及详细的前5条数据预览
    console.log(`[ManualDebug] 国家: ${countryName}, 获取数据量: ${structuredData.length}条`);
    console.log(`[ManualDebug] 数据预览 (前5条):`);
    structuredData.slice(0, 5).forEach((d, i) => {
        console.log(`  [${i+1}] ASIN: ${d.ASIN}, Price: ${d.price}, Country: ${countryName}`);
    });

    // 获取原商品的价格（转换为数字）
    let sourcePrice = Number(sourceItem.price);
    let isSourcePriceValid = true;
    if (isNaN(sourcePrice) || sourcePrice <= 0) {
      console.warn(`原商品数据ID=${sourceItem.id}的价格无效（price=${sourceItem.price}），将跳过价格筛选逻辑，默认全部入库`);
      isSourcePriceValid = false;
      // return; // 原价格无效时，不再直接返回，而是允许入库但跳过价格筛选
    }
  
    // 步骤1：收集待检查的asin+国家组合（八爪鱼数据中的竞品ASIN和当前国家）
    const checkItems = structuredData.map(data => ({
      asin: data.ASIN,
      marketplace: countryName
    }));
  
    // 步骤2：批量查询自有产品表，获取已存在的（asin+国家）组合
    const existingOwnProducts = await this.getExistingOwnProducts(checkItems);

    // 步骤2.5：查询已存在的status=6的竞品数据（用于实时去重/更新）
    const existingStatus6Items = await this.bsrCandidateCompetitorRepo.find({
      where: {
        asin_competitor: In(checkItems.map(i => i.asin)),
        marketplace: countryName,
        status: 6
      }
    });

    const competitorEntities: AppAmzBsrCandidateCompetitorEntity[] = [];

    for (const data of structuredData) {
      // 添加过滤逻辑：image_url包含.gif的一律不入库
      if (data.imgurl1 && /\.gif($|\?)/i.test(data.imgurl1.toLowerCase())) {
        continue;
      }

      // 价格为空或空白字符串时，跳过当前数据不保存
      if (!data.price || data.price.trim() === '') {
        console.log(`竞争ASIN=${data.ASIN}的price为空，跳过不保存（国家=${countryName}）`);
        continue;
      }

      // 预先计算 asin_candidate
      let asinCandidate = null;
      if (data.任务源网址 && sourceItem.image_url &&
        data.任务源网址.includes(sourceItem.image_url)) {
        asinCandidate = sourceItem.asin;
      } else {
        asinCandidate = sourceItem.asin; // 降级处理
        console.log(`任务源网址不包含原image_url，ASIN关联失败（竞争ASIN=${data.ASIN}），默认使用当前asin: ${asinCandidate}`);
      }

      // 检查是否存在记录
      const existingStatus6 = existingStatus6Items.find(e => 
        e.asin_competitor === data.ASIN && 
        e.marketplace === countryName && 
        e.asin_candidate === asinCandidate
      );

      const rawPrice = data.price.trim(); // 保留原始价格字符串

      if (existingStatus6) {
        // 如果存在记录，则更新该记录（保留最新数据）
        existingStatus6.price = rawPrice;
        existingStatus6.image_url = data.imgurl1;
        existingStatus6.updateTime = new Date();
        // 修正国家字段（根据URL自动识别）- 虽然通常不会变，但保持逻辑一致
        if (data.任务源网址.includes("amazon.uk")) {
            existingStatus6.marketplace = "英国";
        } else if (data.任务源网址.includes("amazon.de")) {
            existingStatus6.marketplace = "德国";
        }
        
        await this.bsrCandidateCompetitorRepo.save(existingStatus6);
        console.log(`竞争ASIN=${data.ASIN} 已存在，更新最新数据`);
        continue; // 跳过后续的新增逻辑
      }

      const competitor = new AppAmzBsrCandidateCompetitorEntity();

      // 基础字段映射
      competitor.asin_competitor = data.ASIN;
      competitor.image_url = data.imgurl1;
      competitor.marketplace = countryName;
      
      const competitorPrice = this.bazhuayuUtils.formatPrice(rawPrice); // 格式化价格为数字

      // 价格格式错误时，跳过不入库
      if (competitorPrice === null) {
        console.warn(`竞争ASIN=${data.ASIN}的价格格式无效（price=${rawPrice}），不入库`);
        continue;
      }

      // 保存价格到数据库（存储原始价格字符串）
      competitor.price = rawPrice;

      // 步骤3：去重校验（核心逻辑）
      const checkKey = `${data.ASIN}|${countryName}`;
      if (existingOwnProducts.has(checkKey)) {
        console.log(`竞争ASIN=${data.ASIN}（国家=${countryName}）与自有产品重复，不入库`);
        continue; // 重复数据，跳过
      }

      // 价格对比逻辑（仅处理价格有效的数据）
      let isPriceSuitable = true;
      let minPrice = 0;
      let maxPrice = 0;

      if (isSourcePriceValid) {
        minPrice = sourcePrice * 0.5;
        maxPrice = sourcePrice * 2;
        isPriceSuitable = competitorPrice >= minPrice && competitorPrice <= maxPrice;
      } else {
        // 原价格无效时，默认全部合适
        isPriceSuitable = true;
      }
      
      competitor.status = isPriceSuitable ? 5 : 6;
      
      if (!isPriceSuitable) {
        console.log(`[ManualDebug] ASIN=${data.ASIN} 价格不合适: 原价=${sourcePrice}, 竞品=${competitorPrice} (范围:${minPrice}-${maxPrice})`);
      }

      // 关联原数据的ASIN和ID
      competitor.asin_candidate = asinCandidate;
      competitor.candidate_id = sourceItem.id;

      // 修正国家字段（根据URL自动识别）
      if (data.任务源网址.includes("amazon.uk")) {
        competitor.marketplace = "英国";
      } else if (data.任务源网址.includes("amazon.de")) {
        competitor.marketplace = "德国";
      } else if (data.任务源网址.includes("amazon.fr")) {
        competitor.marketplace = "法国";
      } else if (data.任务源网址.includes("amazon.it")) {
        competitor.marketplace = "意大利";
      } else if (data.任务源网址.includes("amazon.es")) {
        competitor.marketplace = "西班牙";
      }

      competitor.createTime = new Date();

      // 只保留价格合适的竞争数据（status=5）
      if (isPriceSuitable) {
        competitorEntities.push(competitor);
      } else {
        console.warn(`竞争ASIN=${data.ASIN} 价格不合适（${competitorPrice}），不入库`);

      }
    }
  
    // 批量保存到数据库（仅包含价格合适且非重复的数据）
    if (competitorEntities.length > 0) {
      await this.bsrCandidateCompetitorRepo.save(competitorEntities);
      console.log(`已入库${competitorEntities.length}条价格合适且非重复的竞争数据`);
    } else {
      console.log(`当前批次没有价格合适且非重复的竞争数据（已全部过滤）`);
    }
  }

  /**
   * 获取单个任务当前状态
   */
  async getTaskCurrentStatus(taskId: string) {
    try {
      const statusResult = await this.getBzyTaskStatusesWithRetry([taskId]);
      return statusResult.data[0]?.status || '未知';
    } catch (error) {
      console.error(`获取任务状态失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 获取任务状态（带重试机制，处理429限流）
   */
  async getBzyTaskStatusesWithRetry(taskIds: string[], maxRetries = 3) {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        return await this.getBzyTaskStatuses(taskIds);
      } catch (error) {
        retries++;
        if (error.message.includes('statusCode=429') && retries < maxRetries) {
          const waitTime = 10000 * retries;
          console.warn(`遇到限流，将等待${waitTime/1000}秒后重试（第${retries}次）`);
          await sleep(waitTime);
        } else {
          console.error(`状态查询重试失败（${retries}次）：${error.message}`);
          throw error;
        }
      }
    }
    throw new Error(`超过最大重试次数（${maxRetries}次）`);
  }

  /**
   * 更新任务循环项（URL列表）
   */
  async updateTaskLoopItems(params: {
    taskId: string;
    actionId: string;
    loopType: "TextList" | "UrlList";
    loopItems: string[];
  }) {
    const requestUrl = '/cloudextraction/updateLoopItems';
    let lastError: any;

    // 增加重试机制：最多重试3次
    for (let i = 0; i < 3; i++) {
      try {
        return await this.bazhuayuUtils.updateLoopItems({
          taskId: params.taskId,
          actionId: params.actionId,
          loopType: "UrlList",
          loopItems: params.loopItems,
          isAppend: false
        });
      } catch (error) {
        lastError = error;
        console.warn(`更新任务${params.taskId}循环项失败（第${i + 1}/3次尝试）: ${error.message}`);
        // 如果是最后一次尝试，不需要等待
        if (i < 2) {
          await sleep(3000); // 失败后等待3秒再重试
        }
      }
    }

    // 重试3次后仍失败，抛出异常
    const statusCode = lastError.response?.status || '未知';
    const responseBody = lastError.response?.data ? JSON.stringify(lastError.response.data) : '无响应体';
    throw new Error(
      `POST ${requestUrl} 失败（已重试3次）：statusCode=${statusCode}, taskId=${params.taskId}, responseBody=${responseBody}, error=${lastError.message}`
    );
  }

  /**
   * 启动八爪鱼识图任务并记录任务日志
   */
  async bzyShiTuByCountry(taskId: string, itemId: number, countryName: string) {
    const requestUrl = '/cloudextraction/start';
    
    // 关键修改：先查询是否已有该任务记录，避免重复创建
    let taskRecord = await this.taskManagementRepo.findOne({ 
      where: { taskCode: taskId } 
    });

    // 如果没有记录则创建，有则更新
    if (!taskRecord) {
      taskRecord = new AppTaskManagementEntity();
      taskRecord.taskCode = taskId;
      taskRecord.taskName = `八爪鱼识图任务`;
      taskRecord.invokeTime = new Date();
      // 初始化总条数（单任务默认为1，后续可根据实际情况调整）
      taskRecord.totalCount = 1;
    }
    
    // 更新任务状态和相关信息
    taskRecord.taskStatus = TASK_STATUSES.RUNNING;
    taskRecord.countryCode = countryName;
    taskRecord.invokeTime = new Date(); // 更新调用时间
    taskRecord.completedCount = 0; // 重置当前批次完成数
    await this.taskManagementRepo.save(taskRecord);

    try {
      const response = await this.bazhuayuUtils.httpPost(requestUrl, { taskId });
      return { success: true, data: response, taskId, itemId };
    } catch (error) {
      const statusCode = error.response?.status || '未知';
      const responseBody = error.response?.data ? JSON.stringify(error.response.data) : '无响应体';
      taskRecord.taskStatus = TASK_STATUSES.FAILED;
      taskRecord.executeEndTime = new Date();
      taskRecord.executeResult = `启动失败：statusCode=${statusCode}, responseBody=${responseBody}`;
      await this.taskManagementRepo.save(taskRecord);
      return { success: false, error: error.message, taskId, itemId };
    }
  }

  /**
   * 获取任务状态并更新本地任务日志
   */
  async getBzyTaskStatuses(taskIds: string[]) {
    if (!taskIds || taskIds.length === 0) {
      throw new Error('taskIds不能为空');
    }

    const requestUrl = '/cloudextraction/getTaskStatuses';
    try {
      const response = await this.bazhuayuUtils.getTaskStatuses(taskIds);

      if (response.data && response.data.length > 0) {
        for (const statusInfo of response.data) {
          const taskRecord = await this.taskManagementRepo.findOne({ where: { taskCode: statusInfo.taskId } });
          if (taskRecord) {
            // 保存旧状态用于判断
            const oldStatus = taskRecord.taskStatus;
            taskRecord.taskStatus = statusInfo.status;
            taskRecord.executeResult = `状态：${statusInfo.status}`;
            
            // 状态变更时更新进度
            if (statusInfo.status === TASK_STATUSES.FINISHED && oldStatus !== TASK_STATUSES.FINISHED) {
              taskRecord.completedCount = taskRecord.totalCount || 1; // 完成时更新为总条数
              taskRecord.executeEndTime = new Date();
            } else if (statusInfo.status === TASK_STATUSES.STOPPED && oldStatus !== TASK_STATUSES.STOPPED) {
              taskRecord.executeEndTime = new Date();
            }
            
            await this.taskManagementRepo.save(taskRecord);
          }
        }
      }

      return { success: true, data: response.data };
    } catch (error) {
      const statusCode = error.response?.status || '未知';
      const responseBody = error.response?.data ? JSON.stringify(error.response.data) : '无响应体';
      throw new Error(
        `POST ${requestUrl} 失败：statusCode=${statusCode}, taskIds=[${taskIds.join(',')}], responseBody=${responseBody}, error=${error.message}`
      );
    }
  }

  /**
   * 停止八爪鱼任务并更新本地日志
   */
  async stopBzyTask(taskId: string) {
    if (!taskId) throw new Error('taskId不能为空');
    const requestUrl = '/cloudextraction/stopTask';
    const taskRecord = await this.taskManagementRepo.findOne({ where: { taskCode: taskId } });

    try {
      const response = await this.bazhuayuUtils.stopTask(taskId);
      if (taskRecord) {
        taskRecord.taskStatus = 'STOPPED';
        taskRecord.executeEndTime = new Date();
        await this.taskManagementRepo.save(taskRecord);
      }
      return { success: true, data: response, taskId };
    } catch (error) {
      const statusCode = error.response?.status || '未知';
      const responseBody = error.response?.data ? JSON.stringify(error.response.data) : '无响应体';
      
      // 容错处理：如果是因为任务本身已经停止导致的500错误，视为成功
      // 八爪鱼API在停止已停止或未运行的任务时可能会返回500
      if (statusCode === 500) {
        console.warn(`停止任务${taskId}返回500错误，可能任务已处于停止状态，视为操作成功。详情: ${error.message}`);
        if (taskRecord) {
            taskRecord.taskStatus = TASK_STATUSES.STOPPED;
            taskRecord.executeResult = `停止时返回500(视为成功)：${error.message}`;
            await this.taskManagementRepo.save(taskRecord);
        }
        return { success: true, message: '任务可能已停止，忽略500错误', taskId };
      }

      if (taskRecord) {
        taskRecord.taskStatus = TASK_STATUSES.STOPPED;
        taskRecord.executeResult = `停止失败：statusCode=${statusCode}, responseBody=${responseBody}`;
        await this.taskManagementRepo.save(taskRecord);
      }
      throw new Error(
        `POST ${requestUrl} 失败：statusCode=${statusCode}, taskId=${taskId}, responseBody=${responseBody}, error=${error.message}`
      );
    }
  }

  /**
   * 前端轮询任务状态（带重试）
   */
  async pollTaskStatus(taskId: string) {
    try {
      return this.getBzyTaskStatusesWithRetry([taskId]);
    } catch (error) {
      console.error(`前端轮询失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 处理item_name生成搜索关键词（复现SQL逻辑）
   */
  private processItemName(itemName: string): string {
    if (!itemName || itemName.trim() === '') return '';
    const keywords = this.extractTitleKeywords(itemName);
    return keywords.join('+');
  }

  private normalizeTitleWords(title: string): string[] {
    if (!title) return [];
    const unitWords = new Set([
      'g', 'kg', 'mg', 'ug', 'lb', 'lbs', 'oz', 'ml', 'l', 'cl', 'dl',
      'mm', 'cm', 'm', 'km', 'in', 'inch', 'inches', 'ft', 'feet', 'yd',
      'mah', 'ah', 'wh', 'v', 'w', 'kw', 'a', 'ma', 'hz', 'khz', 'mhz', 'ghz',
      'db', 'kpa', 'mpa', 'pa', 'psi', 'bar', 'n', 'nm', 'rpm',
      'gb', 'mb', 'tb', 'mp', 'dpi', 'ppi', 'c', 'f'
    ]);
    const singularizeWord = (word: string): string => {
      const irregularPluralMap: Record<string, string> = {
        men: 'man',
        women: 'woman',
        people: 'person',
        children: 'child',
        teeth: 'tooth',
        feet: 'foot',
        geese: 'goose',
        mice: 'mouse',
        lice: 'louse',
        oxen: 'ox',
        dice: 'die',
        indices: 'index',
        appendices: 'appendix',
        vertices: 'vertex',
        matrices: 'matrix',
        analyses: 'analysis',
        bases: 'basis',
        crises: 'crisis',
        theses: 'thesis',
        diagnoses: 'diagnosis',
        hypotheses: 'hypothesis',
        parentheses: 'parenthesis',
        synopses: 'synopsis',
        phenomena: 'phenomenon',
        criteria: 'criterion',
        media: 'medium',
        data: 'datum',
        knives: 'knife',
        wives: 'wife',
        lives: 'life',
        leaves: 'leaf',
        loaves: 'loaf',
        wolves: 'wolf',
        calves: 'calf',
        halves: 'half',
        shelves: 'shelf',
        scarves: 'scarf',
        elves: 'elf',
        selves: 'self',
        dwarves: 'dwarf',
        potatoes: 'potato',
        tomatoes: 'tomato',
        heroes: 'hero',
        echoes: 'echo',
        mosquitoes: 'mosquito',
        cargoes: 'cargo',
      };
      const irregular = irregularPluralMap[word];
      if (irregular) return irregular;
      if (word.endsWith('ies') && word.length > 3) return `${word.slice(0, -3)}y`;
      if ((word.endsWith('ches') || word.endsWith('shes') || word.endsWith('xes') || word.endsWith('zes') || word.endsWith('ses')) && word.length > 4) {
        return word.slice(0, -2);
      }
      if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
      return word;
    };
    const cleanedTitle = title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanedTitle) return [];
    return cleanedTitle
      .split(' ')
      .map(word => word.replace(/\d+/g, '').trim())
      .filter(word => word.length > 0)
      .map(word => singularizeWord(word))
      .filter(word => word.length > 0 && !unitWords.has(word));
  }

  private extractTitleKeywords(title: string): string[] {
    const words = this.normalizeTitleWords(title);
    if (words.length === 0) return [];
    const uniqueWords = Array.from(new Set(words));
    const firstElevenWords = uniqueWords.slice(0, 11);
    return firstElevenWords.slice(1, 11);
  }

  /**
   * 基于item_name处理结果执行搜索并入库（仅保留价格合适的数据）
   * 仅处理image_state=6（意大利处理完成）的数据
   */
  /**
 * 基于item_name处理结果执行搜索并入库（仅保留价格合适的数据）
 * 按product_code+asin分组，优先自身国家数据，不足则同组补充，最多5条/组
 */
async processSearchByItemName(targetId?: number) {
    // 创建搜索任务记录（带统计）
    const searchTask = new AppTaskManagementEntity();
    searchTask.taskCode = `search-${Date.now()}`;
    searchTask.taskName = 'item_name搜索任务';
    searchTask.taskStatus = TASK_STATUSES.RUNNING;
    searchTask.invokeTime = new Date();
    await this.taskManagementRepo.save(searchTask);

    try {
      console.log(`开始执行item_name搜索流程（按product_code+asin分组处理）${targetId ? ` [单条处理ID=${targetId}]` : ''}`);

      // 阶段1：获取初始有效数据
      let initialValidItems: AppAmzBsrProductListingLingxingProcessEntity[] = [];
      
      if (targetId) {
        // 单条处理：直接查询指定ID（忽略image_state限制，或者允许6/7）
        const item = await this.processListingRepo.findOne({ where: { id: targetId } });
        if (item) initialValidItems = [item];
      } else {
        // 批量处理：查询符合状态的数据
        initialValidItems = await this.processListingRepo.find({
          where: { image_state: In([1, 2, 3, 4, 5, 6]) },
          select: ['id', 'item_name', 'asin', 'price', 'marketplace', 'product_code']
        });
      }

      // 目标国家列表（默认为全部）
      let targetCountries = ['英国', '德国'];
      
      // 如果是单条处理，仅处理该条数据对应的国家
      if (targetId && initialValidItems.length > 0) {
          const item = initialValidItems[0];
          const country = this.getCountryByMarketplace(item.marketplace);
          if (country) {
              targetCountries = [country.name];
              console.log(`单条处理模式：仅处理国家=${country.name}`);
          }
      }

    if (initialValidItems.length === 0) {
      console.log(`没有初始有效数据，退出流程`);
      searchTask.taskStatus = TASK_STATUSES.FINISHED;
      searchTask.executeEndTime = new Date();
      searchTask.executeResult = '任务完成：无初始有效数据';
      await this.taskManagementRepo.save(searchTask);
      return;
    }

    // 阶段2：按"product_code + asin"分组
    const groupMap = new Map<string, {
      baseItems: typeof initialValidItems;
      productCode: string;
      asin: string;
      countryData: Record<string, typeof initialValidItems[0]>; // 国家->数据映射
    }>();

    // 初始化分组
    for (const item of initialValidItems) {
      const groupKey = `${item.product_code}-${item.asin}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          baseItems: [],
          productCode: item.product_code,
          asin: item.asin,
          countryData: {}
        });
      }
      const group = groupMap.get(groupKey)!;
      group.baseItems.push(item);
      
      // 记录该组已有的国家数据（只保留第一个出现的）
      if (!group.countryData[item.marketplace] && targetCountries.includes(item.marketplace)) {
        group.countryData[item.marketplace] = item;
      }
    }

    // 阶段3：获取同product_code下的所有数据（用于补充，无image_state限制）
    const allProductCodes = Array.from(new Set(initialValidItems.map(item => item.product_code)));
    const allItemsInProductCodes = await this.processListingRepo.find({
      where: { product_code: In(allProductCodes) },
      select: ['id', 'item_name', 'asin', 'price', 'marketplace', 'product_code']
    });

    // 按product_code整理所有数据（便于补充时快速查询）
    const productCodeToItemsMap = new Map<string, typeof allItemsInProductCodes>();
    for (const item of allItemsInProductCodes) {
      if (!productCodeToItemsMap.has(item.product_code)) {
        productCodeToItemsMap.set(item.product_code, []);
      }
      productCodeToItemsMap.get(item.product_code)!.push(item);
    }

    // 阶段4：为每个组补充缺失的国家数据
    const finalSearchItems: typeof initialValidItems = [];
    const groups = Array.from(groupMap.values());

    for (const group of groups) {
      console.log(`处理组：product_code=${group.productCode}, asin=${group.asin}`);
      
      // 1. 确定当前组已有的国家和缺失的国家
      const existingCountries = Object.keys(group.countryData);
      const missingCountries = targetCountries.filter(cty => !existingCountries.includes(cty));
      console.log(`已有国家：${existingCountries.join(',')}，缺失国家：${missingCountries.join(',')}`);

      // 2. 从同product_ode下的其他asin中补充缺失国家
      const addData = productCodeToItemsMap.get(group.productCode) || [];
      for (const missingCty of missingCountries) {
        // 查找同product_code、不同asin、目标国家的数据（任选一条）
        const supplementItem = addData.find(item => 
          item.marketplace === missingCty && 
          item.asin !== group.asin && // 排除当前组的asin
          targetCountries.includes(item.marketplace)
        );

        if (supplementItem) {
          group.countryData[missingCty] = supplementItem as any;
          console.log(`补充国家${missingCty}：使用asin=${supplementItem.asin}的数据`);
        } else {
          console.log(`国家${missingCty}无补充数据，放弃`);
        }
      }

      // 3. 提取最终数据（按目标国家顺序，最多5条）
      const groupFinalItems = targetCountries
        .map(cty => group.countryData[cty])
        .filter(Boolean); // 过滤空值（未补充到的国家）

      console.log(`组最终数据：${groupFinalItems.length}条（${groupFinalItems.map(i => i.marketplace).join(',')}）`);
      finalSearchItems.push(...groupFinalItems);
    }

    // 去重：同一id的数据只保留一次（避免重复处理）
    const uniqueFinalItems = Array.from(
      new Map(finalSearchItems.map(item => [item.id, item])).values()
    );

    // 初始化统计信息
    const totalCount = uniqueFinalItems.length;
    searchTask.totalCount = totalCount;
    searchTask.completedCount = 0;
    searchTask.executeResult = `已获取${totalCount}条待处理数据，开始逐条处理`;
    await this.taskManagementRepo.save(searchTask);

    console.log(`所有组处理完成，最终待搜索数据：${totalCount}条`);
    console.log(SEPARATOR);

    // 阶段5：执行搜索（复用原有逻辑，增加核心关键词提取）
    let successCount = 0;
    let failCount = 0;
    const failRecords: string[] = [];

    for (const item of uniqueFinalItems) {
      try {
        const country = item.marketplace || '英国';
        const originalKeyword = item.item_name;
        const processedTitle = this.processItemName(originalKeyword);
        const coreKeywords = this.extractTitleKeywords(originalKeyword);

        if (!processedTitle) {
          console.warn(`${country} ASIN=${item.asin}：原始关键词为空或处理后为空，跳过搜索`);
          failCount++;
          failRecords.push(`${country} ASIN=${item.asin}：关键词无效`);
          // console.log(SEPARATOR);
          continue;
        }

        // 2026-04-10: 日志简化 - 合并并精简搜索打印
        console.log(`开始执行${country}搜索 ASIN:${item.asin}（${successCount + failCount + 1}/${totalCount}）`);
        // console.log(`原始关键词：${originalKeyword}`);
        // console.log(`对比搜索关键词：${processedTitle}`);
        // console.log(`核心匹配关键词：${coreKeywords.join(',')}`);

        // 调用搜索接口（限制60秒超时）
        const searchResults = await Promise.race([
          this.oxylabsService.searchAmazon(
            processedTitle,
            country,
            1,
            'lingxing.processCountryTasks.searchAmazon',
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('搜索超时')), 60000),
          ),
        ]);
        const resultCount = (searchResults as any[])?.length || 0;

        // console.log(`获取到${resultCount}条数据，开始过滤和入库`);
        
        // 保存搜索结果（传入核心关键词用于匹配校验）
        await this.saveSearchResults(
          item.asin,
          item.id,
          country,
          searchResults as any[],
          item.price,
          coreKeywords // 新增：传递核心关键词用于title匹配
        );
        
        // 更新状态为"所有国家完成"（避免重复处理）
        await this.processListingRepo.update(
          { id: item.id },
          { image_state: DATA_STATES.ALL_COMPLETED } // 设为7
        );
        
        successCount++;
        // console.log(`${country} ASIN=${item.asin} 搜索及入库完成`);
      } catch (error) {
        console.error(`${item.marketplace || '未知国家'} ASIN=${item.asin} 搜索失败：${error.message}`);
        failCount++;
        failRecords.push(`${item.marketplace || '未知国家'} ASIN=${item.asin}：${error.message}`);
      }
      // console.log(SEPARATOR);

      // 实时更新进度
      searchTask.completedCount = successCount + failCount;
      const progress = Math.floor(((successCount + failCount) / totalCount) * 100);
      searchTask.executeResult = `处理中：成功${successCount}条，失败${failCount}条（共${totalCount}条，${progress}%）`;
      await this.taskManagementRepo.save(searchTask);
    }

    // 所有数据处理完成，更新任务状态
    console.log('搜索任务处理完成，开始执行全局去重（status=6）...');
    await this.deduplicateCompetitorData();

    searchTask.taskStatus = TASK_STATUSES.FINISHED;
    searchTask.executeEndTime = new Date();
    searchTask.completedCount = totalCount;
    searchTask.executeResult = `任务完成：成功${successCount}条，失败${failCount}条（共${totalCount}条）。失败详情：${failRecords.join('; ')}`;
    await this.taskManagementRepo.save(searchTask);

    console.log(`所有item_name搜索处理完成，总处理${totalCount}条，成功${successCount}条，失败${failCount}条`);
    console.log(SEPARATOR);

  } catch (error) {
    console.error(`搜索任务整体失败：${error.message}`, error.stack);
    searchTask.taskStatus = TASK_STATUSES.FAILED;
    searchTask.executeEndTime = new Date();
    searchTask.executeResult = `任务失败：${error.message}`;
    await this.taskManagementRepo.save(searchTask);
    throw error;
  }
}
  

  /**
   * 保存搜索结果到数据库（添加价格检查，仅保留合适价格）
   */
  /**
 * 保存搜索结果到数据库（添加价格检查，仅保留合适价格）
 */
  private async saveSearchResults(
    asinCandidate: string,
    candidateId: number,
    marketplace: string,
    results: any[],
    sourcePriceStr: string | number, // 原商品价格字符串（支持数字类型）
    coreKeywords: string[] // 6个核心关键词数组
  ): Promise<void> {
    const normalizedKeywords = Array.from(
      new Set(
        (coreKeywords || [])
          .flatMap(keyword => this.normalizeTitleWords(keyword || ''))
          .filter(Boolean)
      )
    );
    const keywordText = normalizedKeywords.join(' ');
    const calcTitleHitScore = (title: string): number => {
      if (!title || normalizedKeywords.length === 0) return 0;
      const normalizedTitleWords = this.normalizeTitleWords(title);
      if (normalizedTitleWords.length === 0) return 0;
      const normalizedTitle = ` ${normalizedTitleWords.join(' ')} `;
      let hitCount = 0;
      for (const keyword of normalizedKeywords) {
        if (normalizedTitle.includes(` ${keyword} `)) {
          hitCount++;
        }
      }
      if (hitCount <= 0) return 0;
      if (hitCount >= 10) return 10;
      return hitCount;
    };
    /**
     * 本地价格格式化工具（兼容数字/字符串输入）
     */
    const localFormatPrice = (priceInput: string | number): number | null => {
      let priceStr: string;
      if (typeof priceInput === 'number') {
        priceStr = priceInput.toString(); // 数字转字符串
      } else if (typeof priceInput === 'string') {
        priceStr = priceInput; // 本身是字符串，直接使用
      } else {
        return null; // 既不是字符串也不是数字，无效
      }
  
      if (!priceStr || priceStr.trim() === '') return null;
  
      // 移除所有货币符号和非数字/非分隔符字符（保留 , 和 .）
      const cleaned = priceStr.replace(/[^\d.,]/g, '').trim();
      if (!cleaned) return null;
  
      // 区分千分位分隔符和小数点
      const commaCount = (cleaned.match(/,/g) || []).length;
      const dotCount = (cleaned.match(/\./g) || []).length;
      let numericStr = cleaned;
  
      if (commaCount > 0 || dotCount > 0) {
        // 最后出现的 , 或 . 视为小数点
        const lastCommaIndex = cleaned.lastIndexOf(',');
        const lastDotIndex = cleaned.lastIndexOf('.');
        const lastSeparatorIndex = Math.max(lastCommaIndex, lastDotIndex);
  
        if (lastSeparatorIndex !== -1) {
          // 替换非小数点的分隔符（千分位）为空白
          numericStr = cleaned.substring(0, lastSeparatorIndex)
            .replace(/[,.]/g, '') // 移除千分位分隔符
            + '.' // 补充小数点
            + cleaned.substring(lastSeparatorIndex + 1); // 保留小数部分
        }
      }
  
      // 验证格式并转换为数字
      if (!/^\d+(\.\d+)?$/.test(numericStr)) {
        return null;
      }
      const price = Number(numericStr);
      return isNaN(price) || price <= 0 ? null : price;
    };
  
    // 校验原商品价格有效性
    const sourcePrice = localFormatPrice(sourcePriceStr);
    if (sourcePrice === null) {
      console.warn(`原商品价格无效（${sourcePriceStr}），所有搜索结果不入库`);
      return;
    }
  
    const minPrice = sourcePrice * 0.5;
    const maxPrice = sourcePrice * 2;
    console.log(`价格合理范围：${minPrice} - ${maxPrice}（原价格：${sourcePrice}）`);
  
    // 关键词数量校验
    if (normalizedKeywords.length < 2) {
      console.warn(`核心关键词不足2个（共${normalizedKeywords.length}个），所有结果不入库`);
      return;
    }
  
    // 步骤1：过滤出价格和关键词都符合条件的有效数据
    const validResults = results.filter(item => {
      // 基础字段校验
      if (!item.asin || !item.title || !item.price || !item.url_image || !item.url_image.includes('m.media-amazon.com')) {
        return false;
      }
      // 排除特殊类型商品
      if (item.title.includes('Video Widget Card')) {
        return false;
      }
      // 价格有效性校验
      const competitorPrice = localFormatPrice(item.price);
      if (competitorPrice === null) {
        console.warn(`竞争ASIN=${item.asin} 价格格式无效（${item.price}），不入库`);
        return false;
      }
      // 价格范围校验
      const isPriceSuitable = competitorPrice >= minPrice && competitorPrice <= maxPrice;
      if (!isPriceSuitable) {
        console.warn(`竞争ASIN=${item.asin} 价格不合适（${competitorPrice}），不入库,id=${candidateId}`);
        return false;
      }
      // 关键词匹配校验（至少匹配2个）
      const titleWords = this.normalizeTitleWords(item.title || '');
      if (titleWords.length === 0) {
        return false;
      }
      const titleWordSet = new Set(titleWords);
      let matchCount = 0;
      for (const keyword of normalizedKeywords) {
        if (titleWordSet.has(keyword)) {
          matchCount++;
          if (matchCount >= 2) break;
        }
      }
      const isKeywordMatch = matchCount >= 2;
      if (!isKeywordMatch) {
        console.warn(`竞争ASIN=${item.asin} 标题关键词匹配不足（仅匹配${matchCount}个），不入库`);
        return false;
      }
  
      return true;
    });
  
    // 步骤2：收集待检查的asin+国家组合（搜索结果中的竞品ASIN和当前国家）
    const checkItems = validResults.map(result => ({
      asin: result.asin,
      marketplace: marketplace
    }));
  
    // 步骤3：批量查询自有产品表，获取已存在的（asin+国家）组合
    const existingOwnProducts = await this.getExistingOwnProducts(checkItems);
  
    // 步骤4：过滤掉与自有产品重复的数据
    const uniqueValidResults = validResults.filter(result => {
      // 过滤掉包含 .gif 的图片
      if (result.url_image && /\.gif($|\?)/i.test(result.url_image.toLowerCase())) {
        return false;
      }
      const checkKey = `${result.asin}|${marketplace}`;
      if (existingOwnProducts.has(checkKey)) {
        console.log(`搜索结果ASIN=${result.asin}（国家=${marketplace}）与自有产品重复，不入库`);
        return false;
      }
      return true;
    });

    // 步骤4.5：查询已存在的status=6的竞品数据（用于实时去重/更新）
    const existingStatus6Items = await this.bsrCandidateCompetitorRepo.find({
      where: {
        asin_competitor: In(uniqueValidResults.map(r => r.asin)),
        marketplace: marketplace,
        asin_candidate: asinCandidate,
        status: 6
      }
    });

    // 组装入库实体
    const entities = [];
    
    for (const result of uniqueValidResults) {
      let imageUrl = result.url_image || '';
      // 标准化图片URL（放大尺寸）
      if (imageUrl) {
        imageUrl = imageUrl
          .replace(/_AC_US\d+/g, '_AC_US1000')
          .replace(/_AC_UL\d+/g, '_AC_UL1000')
          .replace(/_SL\d+/g, '_SL1000')
          .replace(/SS40+/g, 'SS500')
          .replace(/_AC_SR\d+,?\d*/g, '_AC_SR1000,1000')
          .replace(/_SX\d+_SY\d+_CR[^_]*_/, '_SX1000_SY1000_CR,0,0,1000,1000_');
      }

      // 检查是否存在status=6的记录
      const existingStatus6 = existingStatus6Items.find(e => e.asin_competitor === result.asin);

      if (existingStatus6) {
        // 如果存在status=6的记录，则更新该记录（保留最新数据）
        existingStatus6.price = result.price;
        existingStatus6.item_name = result.title;
        existingStatus6.image_url = imageUrl;
        existingStatus6.last_star = result.rating || 0;
        existingStatus6.review_num = result.reviews_count || 0;
        existingStatus6.title_keywords = keywordText;
        existingStatus6.title_hit_score = calcTitleHitScore(result.title);
        existingStatus6.updateTime = new Date();
        
        await this.bsrCandidateCompetitorRepo.save(existingStatus6);
        console.log(`搜索结果ASIN=${result.asin} 已存在(status=6)，更新最新数据`);
        continue; // 跳过后续的新增逻辑
      }

      entities.push({
        asin_candidate: asinCandidate,
        candidate_id: candidateId,
        marketplace: marketplace,
        asin_competitor: result.asin,
        item_name: result.title,
        price: result.price, // 保留原始价格字符串
        image_url: imageUrl,
        last_star: result.rating || 0,
        review_num: result.reviews_count || 0,
        status: 5, // 价格合适（与八爪鱼一致的状态标识）
        source: 5,
        title_keywords: keywordText,
        title_hit_score: calcTitleHitScore(result.title),
      });
    }

    // 去重后批量入库（按 candidate_id + asin_competitor + marketplace 唯一键）
    const uniqueEntities = entities.filter(
      (v, i, a) => a.findIndex(t => (
        t.candidate_id === v.candidate_id &&
        t.asin_competitor === v.asin_competitor &&
        t.marketplace === v.marketplace
      )) === i
    );
  
    if (uniqueEntities.length > 0) {
      await this.bsrCandidateCompetitorRepo.upsert(
        uniqueEntities,
        ['asin_candidate', 'asin_competitor', 'marketplace']
      );
      console.log(`搜索结果已入库${uniqueEntities.length}条价格合适且非重复的数据`);
    } else {
      console.warn(`搜索结果中没有价格合适且非重复的数据 [${asinCandidate}, ${marketplace}]`);
    }
  }

  /**
   * 处理阿里云以图识图相似度计算
   * @param ids 可选：指定处理的竞争商品ID列表，为空则处理全部
   */
  async processAliyunImageSimilarity(targetAsinCandidate?: string) {
    console.log(`开始阿里云以图识图处理${targetAsinCandidate ? ` [单ASIN模式:${targetAsinCandidate}]` : ''}`);

    // 创建阿里云任务记录（带统计字段）
    const aliyunTask = new AppTaskManagementEntity();
    aliyunTask.taskCode = `aliyun-${Date.now()}`;
    aliyunTask.taskName = '阿里云以图识图任务';
    aliyunTask.taskStatus = TASK_STATUSES.RUNNING;
    aliyunTask.invokeTime = new Date();
    await this.taskManagementRepo.save(aliyunTask);

    try {
      // 查询需要处理的竞争商品数据（状态为5的领星竞品）
      const whereCondition: any = { status: 5 ,similarity_score:IsNull()};
      if (targetAsinCandidate) {
          whereCondition.asin_candidate = targetAsinCandidate;
      }
      
      const entities = await this.bsrCandidateCompetitorRepo.find({
        where: whereCondition,
        order: { id: 'ASC' }
      });
  
      // 初始化统计信息
      const totalCount = entities.length;
      aliyunTask.totalCount = totalCount;
      aliyunTask.completedCount = 0;
      aliyunTask.executeResult = `发现${totalCount}条待处理数据，开始处理`;
      await this.taskManagementRepo.save(aliyunTask);
  
      console.log(`共发现${totalCount}条需要处理的竞争商品数据`);
      if (totalCount === 0) {
        aliyunTask.taskStatus = TASK_STATUSES.FINISHED;
        aliyunTask.executeEndTime = new Date();
        aliyunTask.executeResult = '无数据需要处理';
        await this.taskManagementRepo.save(aliyunTask);
        return { success: true, message: '无数据需要处理' };
      }
  
      // 调用后台处理方法（传入任务ID用于更新进度）
      await this.processEntitiesInBackground(entities, aliyunTask.id);
  
      // 所有数据处理完成，更新任务状态
      aliyunTask.taskStatus = TASK_STATUSES.FINISHED;
      aliyunTask.executeEndTime = new Date();
      aliyunTask.completedCount = totalCount;
      aliyunTask.executeResult = `任务完成：共处理${totalCount}条数据`;
      await this.taskManagementRepo.save(aliyunTask);
  
      return { success: true, processedCount: totalCount };
    } catch (error) {
      console.error('阿里云以图识图整体处理失败:', error);
      // 失败时保留当前进度
      aliyunTask.taskStatus = TASK_STATUSES.FAILED;
      aliyunTask.executeEndTime = new Date();
      aliyunTask.executeResult = `任务失败：${error.message}`;
      await this.taskManagementRepo.save(aliyunTask);
      throw error;
    }
  }

  /**
   * 后台批量处理实体（并发控制 + 事务处理）
   */
  private async processEntitiesInBackground(entities: AppAmzBsrCandidateCompetitorEntity[], taskId: number) {
    try {
      const total = entities.length;
      let processedCount = 0;  // 已处理计数
  
      // 创建处理队列（带并发控制）
      const processingQueue = entities.map(entity => async () => {
        // 阿里云API限流控制（每秒最多10次请求）
        await this.aliCloudAPILimiter();
  
        // 使用独立事务处理每个条目（确保原子性）
        await this.bsrCandidateCompetitorRepo.manager.transaction(async transactionalEntityManager => {
          try {
            // 获取最新数据并加锁，防止脏写
            const freshEntity = await transactionalEntityManager.findOne(AppAmzBsrCandidateCompetitorEntity, {
              where: { id: entity.id },
              lock: { mode: "pessimistic_write" }
            });
  
            if (!freshEntity) {
              console.warn(`[ID:${entity.id}] 数据已不存在，跳过处理`);
              return;
            }
            const freshEntity2 = await transactionalEntityManager.findOne(AppAmzBsrProductListingLingxingProcessEntity, {
              where: { asin: freshEntity.asin_candidate },
              lock: { mode: "pessimistic_write" }
            });

            if (!freshEntity2) {
               console.warn(`[ID:${freshEntity.id}] 关联的 candidate ASIN (${freshEntity.asin_candidate}) 不存在，跳过处理`);
               return;
            }
            
            console.log(`[ID:${freshEntity.id}] 开始处理 ASIN:${freshEntity.asin_competitor}（${processedCount + 1}/${total}）`);
  
            // 调用阿里云API获取相似度分数
            const similarityScore = await this.imageSimilarityTool.getSimilarityScore(
              freshEntity.image_url,
              freshEntity2.product_code,
              freshEntity.asin_competitor
            );
  
            // 根据分数更新状态或标记删除
            if (similarityScore > 0.72) {
              await transactionalEntityManager.update(AppAmzBsrCandidateCompetitorEntity, freshEntity.id, {
                similarity_score: similarityScore,
                status: 6
              });
              // 2026-04-10: 日志简化 - 取消打印分数
              // console.log(`[ID:${freshEntity.id}] 分数:${similarityScore} → 状态更新为6`);
            }else {
              await transactionalEntityManager.update(AppAmzBsrCandidateCompetitorEntity, freshEntity.id, {
                similarity_score: similarityScore,
                status: 8
              });
              // console.log(`[ID:${freshEntity.id}] 分数:${similarityScore} → 标记为无效（状态8）`);
            }
  
          } catch (error) {
            console.error(`[ID:${entity.id}] 处理失败`, error);
            await transactionalEntityManager.update(AppAmzBsrCandidateCompetitorEntity, entity.id, {
              similarity_score: -1,
              status: -1
            });
            throw error; // 触发事务回滚
          }
        });
        // 每处理1条更新进度
        
        processedCount++;
        const task = await this.taskManagementRepo.findOne({ where: { id: taskId } });
        if (task) {
          task.completedCount = processedCount;
          // 每10条记录一次详细进度
          if (processedCount % 10 === 0) {
            const progress = Math.floor((processedCount / total) * 100);
            task.executeResult = `处理中：${processedCount}/${total}（${progress}%）`;
          }
          await this.taskManagementRepo.save(task);
        }
      });
  
      // 控制并发数（避免阿里云API限流）
      const CONCURRENCY = 10;
      const chunks = this.chunk(processingQueue, CONCURRENCY);
  
      // 分批处理
      for (const chunk of chunks) {
        await Promise.all(chunk.map(task => 
          task().catch(e => console.error(`并发处理错误: ${e.message}`))
        ));
        await sleep(1000); // 批次间隔1秒，降低API压力
      }
  
      // 处理剩余缓冲区数据
    // 移除 this.updateBuffer 相关代码，改为直接更新

    console.log(`所有数据处理完成，共处理${total}条`);
  
    } catch (error) {
      console.error('阿里云以图识图整体处理失败:', error);
      throw error;
    }
  }

  /**
   * 阿里云API限流控制（简单实现，可根据实际限流策略调整）
   */
  private async aliCloudAPILimiter() {
    // 示例：限制每秒最多10次请求（根据阿里云API配额调整）
    await sleep(100);
  }

  /**
   * 数组分块工具（用于并发控制）
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }


  
  async processAliyunImageUpload(targetAsin?: string) {
    console.log(`开始阿里云图片上传（全量上传：相同ASIN仅上传一条）${targetAsin ? ` [单ASIN模式:${targetAsin}]` : ''}`);

    // 创建阿里云任务记录（带统计字段）
    const aliyunTask = new AppTaskManagementEntity();
    aliyunTask.taskCode = `aliyun-${Date.now()}`;
    aliyunTask.taskName = '阿里云图片上传任务';
    aliyunTask.taskStatus = TASK_STATUSES.RUNNING;
    aliyunTask.invokeTime = new Date();
    await this.taskManagementRepo.save(aliyunTask);

    try {
      // 步骤1：查询所有记录（无任何过滤条件，全量）
      const findOptions: any = {
        order: { id: 'ASC' }
      };
      if (targetAsin) {
          findOptions.where = { asin: targetAsin };
      }
      const allItems = await this.processListingRepo.find(findOptions);
  
      // 步骤2：按ASIN分组去重（核心修改：相同ASIN仅保留一条）
      const asinGroupMap = new Map<string, AppAmzBsrProductListingLingxingProcessEntity[]>();
      // 1. 按ASIN分组（空ASIN按"UNKNOWN_ASIN"分组）
      for (const item of allItems) {
        const asinKey = item.asin || 'UNKNOWN_ASIN';
        if (!asinGroupMap.has(asinKey)) {
          asinGroupMap.set(asinKey, []);
        }
        asinGroupMap.get(asinKey)!.push(item);
      }
  
      // 2. 每组仅保留一条最优数据（优先规则：有image_url > updateTime最新）
      const uniqueItems: AppAmzBsrProductListingLingxingProcessEntity[] = [];
      for (const [asin, groupItems] of asinGroupMap) {
        // 排序规则：1. 有image_url的在前 2. updateTime最新的在前
        const sortedGroup = groupItems.sort((a, b) => {
          // 优先判断是否有image_url
          const aHasImage = !!a.image_url;
          const bHasImage = !!b.image_url;
          if (aHasImage !== bHasImage) {
            return aHasImage ? -1 : 1; // 有image_url的排前面
          }
          // 相同ASIN下有image_url的多条数据，取updateTime最新的
          const aUpdateTime = a.updateTime ? new Date(a.updateTime).getTime() : 0;
          const bUpdateTime = b.updateTime ? new Date(b.updateTime).getTime() : 0;
          return bUpdateTime - aUpdateTime; // 时间最新的排前面
        });
  
        // 取排序后的第一条（最优数据）
        const bestItem = sortedGroup[0];
        uniqueItems.push(bestItem);
        console.log(`ASIN[${asin}]：共${groupItems.length}条，选中ID=${bestItem.id}（${bestItem.image_url ? '有image_url' : '无image_url'}，更新时间=${bestItem.updateTime || '无'}）`);
      }
  
      // 步骤3：初始化统计信息（基于去重后的数据量）
      const totalCount = uniqueItems.length;
      const originalCount = allItems.length;
      aliyunTask.totalCount = totalCount;
      aliyunTask.completedCount = 0;
      aliyunTask.executeResult = `原始数据${originalCount}条 → 去重后${totalCount}条（相同ASIN仅保留一条），开始上传`;
      await this.taskManagementRepo.save(aliyunTask);
  
      console.log(`共发现${originalCount}条产品数据，去重后剩余${totalCount}条（相同ASIN仅上传一条），开始执行上传`);
      if (totalCount === 0) {
        aliyunTask.taskStatus = TASK_STATUSES.FINISHED;
        aliyunTask.executeEndTime = new Date();
        aliyunTask.executeResult = '无任何产品数据需要上传（去重后为空）';
        await this.taskManagementRepo.save(aliyunTask);
        return { success: true, message: '无数据需要处理' };
      }
  
      // 步骤4：执行去重后的上传（传递taskCode和totalCount参数）
      await this.uploadToAliyun(uniqueItems, aliyunTask.taskCode, totalCount);
  
      // 步骤5：更新任务状态为完成
      aliyunTask.taskStatus = TASK_STATUSES.FINISHED;
      aliyunTask.executeEndTime = new Date();
      aliyunTask.completedCount = totalCount;
      aliyunTask.executeResult = `任务完成：原始${originalCount}条 → 去重后上传${totalCount}条产品数据（相同ASIN仅上传一条）`;
      await this.taskManagementRepo.save(aliyunTask);
  
      return { success: true, originalCount, uniqueCount: totalCount, processedCount: totalCount };
    } catch (error) {
      console.error('阿里云图片全量上传失败:', error);
      // 失败时保留当前进度
      aliyunTask.taskStatus = TASK_STATUSES.FAILED;
      aliyunTask.executeEndTime = new Date();
      aliyunTask.executeResult = `任务失败：${error.message}`;
      await this.taskManagementRepo.save(aliyunTask);
      throw error;
    }
  }


  private async uploadToAliyun(
    entities: AppAmzBsrProductListingLingxingProcessEntity[],
    taskCode: string, // 新增：接收任务编码
    totalCount: number // 新增：接收总记录数
  ) {
    if (!entities || entities.length === 0) {
      console.log("没有需要上传到阿里云的实体数据");
      return;
    }
  
    try {
      const BATCH_SIZE = 5; // 可根据阿里云API限流调整（建议5-10条/批）
      const chunks = this.chunk(entities, BATCH_SIZE);
      const MAX_RETRIES = 3; // 最大重试次数
      let processed = 0; // 已处理计数
  
      /**
       * 单个实体上传处理（带重试，支持覆盖上传）
       * @param entity 待上传实体
       * @param retriesLeft 剩余重试次数
       * @returns 是否上传成功
       */
      const uploadEntityWithRetry = async (entity: AppAmzBsrProductListingLingxingProcessEntity, retriesLeft: number) => {
        try {
          // 跳过没有图片URL的实体
          if (!entity.image_url) {
            console.warn(`[全量上传] 实体ID=${entity.id}（product_code=${entity.product_code}）缺少image_url，跳过`);
            await this.processListingRepo.update(
              { id: entity.id },
              { cont_sign: 'NO_IMAGE_URL', isUpload: "0", updateTime: new Date() }
            );
            return false;
          }
  
          // 调用阿里云上传工具（支持覆盖上传）
          const cont_sign = await this.imageSimilarityTool.addImageAdvance2(
            entity.image_url,
            entity.product_code || `UNKNOWN_${entity.id}`, // 兼容空product_code
            entity.asin || `UNKNOWN_${entity.id}`, // 兼容空asin
            false // false=非归档模式，支持覆盖
          );
  
          // 检查上传结果有效性
          if (!cont_sign) {
            throw new Error('上传返回的cont_sign为空或无效');
          }
  
          // 上传成功，更新实体状态（覆盖原有值）
          await this.processListingRepo.update(
            { id: entity.id },
            { 
              cont_sign: String(cont_sign), 
              isUpload: "1",
              updateTime: new Date() // 更新最后处理时间
            }
          );
          console.log(`[全量上传] 成功：ID=${entity.id}（product_code=${entity.product_code}），cont_sign=${cont_sign}`);
          return true;
  
        } catch (error) {
          console.error(`[全量上传] 失败：ID=${entity.id}（剩余重试${retriesLeft - 1}）`, error.message);
           
          if (retriesLeft > 1) {
            await sleep((4 - retriesLeft) * 1000);
            return uploadEntityWithRetry(entity, retriesLeft - 1);
          }
  
          // 重试耗尽，标记为上传失败
          await this.processListingRepo.update(
            { id: entity.id },
            { 
              cont_sign: 'UPLOAD_ERROR', 
              isUpload: "0",
              updateTime: new Date() 
            }
          );
          return false;
        }
      };
  
      // 按批次处理所有实体（全量）
      for (const batch of chunks) {
        const batchNum = Math.floor(processed/BATCH_SIZE) + 1;
        console.log(`[全量上传] 处理批次 ${batchNum}/${chunks.length}，本批${batch.length}条`);
        
        // 并行处理当前批次
        const batchResults = await Promise.all(
          batch.map(entity => uploadEntityWithRetry(entity, MAX_RETRIES))
        );
        
        // 统计当前批次结果
        const batchSuccess = batchResults.filter(Boolean).length;
        processed += batch.length;
        
        // 实时更新任务进度（使用传入的taskCode）
        const progressTask = await this.taskManagementRepo.findOne({ 
          where: { taskCode: taskCode } // 改用传入的taskCode
        });
        if (progressTask) {
          progressTask.completedCount = processed;
          const progressPercent = Math.floor((processed / totalCount) * 100); // 改用传入的totalCount
          progressTask.executeResult = `全量上传中：${processed}/${totalCount}（${progressPercent}%），本批次成功${batchSuccess}条`;
          await this.taskManagementRepo.save(progressTask);
        }
  
        console.log(`[全量上传] 批次 ${batchNum} 完成：成功${batchSuccess}条，失败${batch.length - batchSuccess}条`);
        // 批次间隔（避免阿里云API限流）
        await sleep(1000);
      }
  
      console.log(`[全量上传] 完成：总计${entities.length}条，已处理${processed}条`);
  
    } catch (error) {
      console.error('阿里云全量上传流程失败:', error);
      throw error;
    }
  }
  async exportData2(): Promise<{ csvData: string; departmentCsv: string }> { 
    const query = ` 
    SELECT
      'source' as source,  
      comp.asin_candidate,
      comp.marketplace,
      comp.asin_competitor,
      comp.id
    FROM app_amz_bsr_candidate_competitor comp
    WHERE 
      comp.status in ('6','7')
      AND (
        comp.dispatches_type = 1 
        OR 
        (
          comp.dispatches_type = 2 
          AND (
            comp.Main_monthly_sales IS NOT NULL  
            OR comp.bsr_rank IS NOT NULL       
          )
        )
        OR 
        comp.dispatches_type IS NULL  
      )
    ORDER BY comp.asin_candidate, comp.marketplace;
  `;

    const data = await this.bsrCandidateCompetitorRepo.query(query);

    // 生成竞品数据CSV
    const csvHeader = ['ASIN', '竞品ID', '任务源类型', '任务源ASIN', '国家'].join(',');
    const csvRows = data.map(row => [
      row.asin_competitor,
      row.id,
      row.source || '',
      row.asin_candidate,
      row.marketplace,
    ].join(','));
    const csvData = [csvHeader, ...csvRows].join('\n');

    const departmentData = await this.departmentFilterRepo.find();
    let departmentCsv = 'marketplace,department,rank_limit\n';
    departmentData.forEach(item => {
      departmentCsv += `${[
        item.marketplace,
        item.department.replace(/,/g, '.'),
        item.rank_limit !== null ? item.rank_limit * 2.5 : ''
      ].join(',')}\n`;
    });

    return { csvData, departmentCsv };
  }

  /**
 * 批量检查自有产品表中是否存在指定的asin+国家组合
 * @param checkItems 待检查的数组，格式: { asin: string; marketplace: string }[]
 * @returns 存在的组合集合（格式: `${asin}|${marketplace}`）
 */
private async getExistingOwnProducts(
  checkItems: { asin: string; marketplace: string }[]
): Promise<Set<string>> {
  if (checkItems.length === 0) return new Set();

  // 提取所有待检查的asin和国家
  const asins = [...new Set(checkItems.map(item => item.asin))];
  const marketplaces = [...new Set(checkItems.map(item => item.marketplace))];

  // 2026-03-02 修改：同时过滤 app_amz_bsr_product_listing_lingxing 与 app_amz_bsr_product_listing_lingxing_process
  const [existingProductsProcess, existingProductsBsr] = await Promise.all([
    this.processListingRepo.find({
      where: {
        asin: In(asins),
        marketplace: In(marketplaces)
      },
      select: ['asin', 'marketplace']
    }),
    this.bsrProductListingLingxingRepo.find({
      where: {
        asin: In(asins),
        marketplace: In(marketplaces)
      },
      select: ['asin', 'marketplace']
    })
  ]);

  const existingProducts = [...existingProductsProcess, ...existingProductsBsr];

  // 转换为 Set 便于快速查找（格式: "asin|marketplace"）
  return new Set(
    existingProducts.map(p => `${p.asin}|${p.marketplace}`)
  );
}

/**
 * 批量更新mergeId字段
 * @param ids 实体ID数组
 * @param mergeId 目标mergeId值
 */
async updateMergeId(ids: number[], mergeId: string) {
    if (!ids || ids.length === 0 || !mergeId) {
      throw new Error('实体ID数组和目标mergeId不能为空');
    }

    // 检查是否有实体存在
    const existingCount = await this.bsrProductListingLingxingRepo.count({
      where: { id: In(ids) }
    });

    if (existingCount === 0) {
      throw new Error('选中的实体均不存在');
    }

    // 执行批量更新操作
    const result = await this.bsrProductListingLingxingRepo.update(
      { id: In(ids) }, // 批量匹配ID
      { mergeId } // 更新为目标mergeId
    );

    const originalItems = await this.bsrProductListingLingxingRepo.find({ where: { id: In(ids) } });
    originalItems.map(item => 
      this.processListingRepo.update(
        { asin: item.asin, marketplace: item.marketplace },
        { mergeId }
      )
    );

    // 验证更新结果
    if (result.affected === 0) {
      throw new Error('更新失败，未影响任何数据');
    }

    return { success: true, message: `成功更新${result.affected}条数据的mergeId` };
  }

  private convertSalesTrend(apiTrends: Array<{ dk: string; sales: number }>): Array<{ date: number; searches: number }> {
    const trendMap = new Map<string, number>();
    apiTrends.forEach(item => {
      if (item.dk && /^\d{6}$/.test(item.dk)) {
        trendMap.set(item.dk, item.sales || 0);
      }
    });
  
    const getRecent13Months = (): string[] => {
      const months: string[] = [];
      const now = new Date();
      for (let i = 0; i < 13; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.unshift(monthStr);
      }
      return months;
    };
  
    const months = getRecent13Months();
    return months.map(month => {
      const year = parseInt(month.substring(0, 4));
      const mon = parseInt(month.substring(4, 6));
      // 构造该月1号的时间戳（秒）
      const dateTs = new Date(year, mon - 1, 1).getTime() / 1000;
      return {
        date: dateTs,
        searches: trendMap.get(month) || 0
      };
    });
  }

  /**
   * 综合任务：八爪鱼识图 -> 搜索页 -> 去重 -> 阿里云上传 -> 图片对比
   */
  async runIntegratedTask() {
    const integratedTask = new AppTaskManagementEntity();
    integratedTask.taskCode = `integrated-${Date.now()}`;
    integratedTask.taskName = '综合连续任务';
    integratedTask.taskStatus = TASK_STATUSES.RUNNING;
    integratedTask.invokeTime = new Date();
    await this.taskManagementRepo.save(integratedTask);

    try {
      console.log('开始执行综合连续任务...');

      // 1. 八爪鱼识图
      console.log('步骤1/5: 开始八爪鱼识图任务...');
      await this.processAllCountriesInOrder();
      console.log('步骤1/5: 八爪鱼识图任务完成');

      // 2. 搜索页获取
      console.log('步骤2/5: 开始搜索页数据获取任务...');
      await this.processSearchByItemName();
      console.log('步骤2/5: 搜索页数据获取任务完成');

      // 3. 去重
      console.log('步骤3/5: 开始去重任务...');
      await this.deduplicateCompetitorData();
      console.log('步骤3/5: 去重任务完成');

      // 4. 阿里云图片上传
      console.log('步骤4/6: 开始阿里云图片上传任务...');
      await this.processAliyunImageUpload();
      console.log('步骤4/6: 阿里云图片上传任务完成');

      // 5. 图片对比
      console.log('步骤5/6: 开始阿里云图片对比任务...');
      await this.processAliyunImageSimilarity();
      console.log('步骤5/6: 阿里云图片对比任务完成');

      // 6. 获取竞品详情
      console.log('步骤6/6: 开始获取竞品详情任务...');
      await this.appAmzBsrProductListingLingxingService.batchUpdateCompetitorDetails();
      console.log('步骤6/6: 获取竞品详情任务完成');

      integratedTask.taskStatus = TASK_STATUSES.FINISHED;
      integratedTask.executeEndTime = new Date();
      integratedTask.executeResult = '所有子任务执行完成';
      await this.taskManagementRepo.save(integratedTask);

      console.log('综合连续任务全部完成');
      return { success: true, message: '综合连续任务执行完成' };

    } catch (error) {
      console.error('综合连续任务执行失败:', error);
      integratedTask.taskStatus = TASK_STATUSES.FAILED;
      integratedTask.executeEndTime = new Date();
      integratedTask.executeResult = `任务失败: ${error.message}`;
      await this.taskManagementRepo.save(integratedTask);
      throw error;
    }
  }
  async fetchDataFromSellersSpriteAndSave(): Promise<any> {
    // 原查询SQL
    const querySQL = `
      SELECT
        comp.id as competitor_id,
        comp.asin_candidate,
        comp.marketplace,
        comp.asin_competitor,
        comp.candidate_id,
        '5' as inventory_status
      FROM app_amz_bsr_candidate_competitor comp
      WHERE 
        comp.status in ('6','7')
        and comp.item_name is null
      ORDER BY comp.marketplace, comp.asin_competitor;
    `;

    // 调用工具类通用方法，使用 API 获取
    return this.sellerspriteTool.fetchAndSaveByOpenApi(querySQL, undefined, '领星-自动获取竞品详情 | fetchDataFromSellersSpriteAndSave');
  }

  async sellerspriteCompetitorLookup(params: { marketplace: string; asins: string[] }): Promise<any> {
    return this.sellerspriteTool.competitorLookupOpenApi({
      marketplace: params?.marketplace,
      asins: params?.asins || [],
      page: 1,
      size: 100,
      caller: '领星-竞品查询 | sellerspriteCompetitorLookup'
    });
  }
   


  
}
