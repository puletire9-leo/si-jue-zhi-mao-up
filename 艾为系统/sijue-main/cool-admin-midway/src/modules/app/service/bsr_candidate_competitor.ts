import { BaseService } from '@cool-midway/core';
import { Inject, Provide, sleep } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { AppAmzBsrCandidateCompetitorEntity } from "../entity/bsr_candidate_competitor";
import { AppAmzBsrCandidateEntity } from "../entity/bsr_candidate";
import { DataSource, In, Repository, LessThan } from 'typeorm';
import { SellerspriteTool } from "../utils/maijiajingling/SellerspriteUtil";
import { retryWith } from '@midwayjs/core';

@Provide()
export class AppAmzBsrCandidateCompetitorService extends BaseService {
  @InjectEntityModel(AppAmzBsrCandidateCompetitorEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzBsrCandidateCompetitorEntity>;


  @InjectEntityModel(AppAmzBsrCandidateEntity)
  bsrCandidateRepo: Repository<AppAmzBsrCandidateEntity>;

  @Inject()
  sellerspriteTool: SellerspriteTool;

  /**
   * 2026-04-10: 重写 add 方法，增加前端批量添加时的去重逻辑
   */
  async add(param: any | any[]) {
    const isArray = Array.isArray(param);
    const params = isArray ? param : [param];
    
    const validParams = [];
    for (const p of params) {
      if (!p.candidate_id || !p.asin_competitor || !p.asin_candidate || !p.marketplace) {
        validParams.push(p);
        continue;
      }
      
      const existing = await this.bsrCandidateCompetitorRepo.findOne({
        where: {
          candidate_id: p.candidate_id,
          asin_competitor: p.asin_competitor,
          asin_candidate: p.asin_candidate,
          marketplace: p.marketplace
        }
      });
      
      if (!existing) {
        validParams.push(p);
      } else {
        console.log(`[去重拦截] 竞品已存在: candidate_id=${p.candidate_id}, asin_competitor=${p.asin_competitor}, marketplace=${p.marketplace}`);
      }
    }
    
    if (validParams.length === 0) return null;
    return super.add(isArray ? validParams : validParams[0]);
  }

  /**
   * 清理超过 15 天的回收站数据（status=8）
   * 采用分批删除，避免 Lock wait timeout exceeded
   */
  async cleanExpiredRecycleData() {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    
    let totalDeleted = 0;
    const batchSize = 1000; // 每次删除 1000 条
    
    while (true) {
      // 查找符合条件的 ID 列表
      const rows = await this.bsrCandidateCompetitorRepo
        .createQueryBuilder()
        .select("id")
        .where("status = :status", { status: 8 })
        .andWhere("updateTime < :date", { date: fifteenDaysAgo })
        .limit(batchSize)
        .getRawMany();
        
      if (rows.length === 0) {
        break; // 没有更多数据，退出循环
      }
      
      const ids = rows.map(r => r.id);
      
      // 根据 ID 删除
      const result = await this.bsrCandidateCompetitorRepo
        .createQueryBuilder()
        .delete()
        .whereInIds(ids)
        .execute();
        
      const deletedCount = result.affected || 0;
      totalDeleted += deletedCount;
      
      // 如果删除的数量少于 batchSize，说明已经删完了（或者部分失败），退出循环
      // 但为了保险起见，如果查到了数据但没删掉（比如并发被改了），也应该继续循环，
      // 所以主要依赖 rows.length === 0 来退出。
      // 这里可以简单休眠一下，减轻数据库压力
      await new Promise(resolve => setTimeout(resolve, 100)); 
    }

    return {
      deletedCount: totalDeleted,
      message: `成功清理 ${totalDeleted} 条超过15天的回收站数据`
    };
  }

  async updateStatus(asin_candidate, status) {
    await this.bsrCandidateCompetitorRepo.update(
      { asin_candidate: asin_candidate },
      { status: status }
    );
  }

  /**
   * 恢复因API配额错误被误标记为往期(7)的竞品
   * 直接执行SQL UPDATE，速度快，无需加载全部数据到内存
   *
   * 恢复条件：status=7 且 Main_monthly_sales IS NULL（API错误时被清空）
   * 恢复操作：status改回6，inventory_status设为'1'（待爬取）
   *
   * 为什么 runIntegratedTask 不能自动恢复：
   *   batchUpdateCompetitorDetails 只处理 status=6 的竞品，status=7 只在
   *   设置了 rule_history_month 时才会被"往期回捞"尝试恢复。
   */
  async recoverCompetitorsAffectedByApiError(startTime?: string, endTime?: string) {
    const end = endTime || new Date().toISOString().replace('T', ' ').slice(0, 19);
    const start = startTime || new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString().replace('T', ' ').slice(0, 19);

    console.log(`[恢复误标记竞品] 时间范围: ${start} ~ ${end}`);

    // 直接用SQL更新，避免加载数据到内存
    const updateResult = await this.bsrCandidateCompetitorRepo.query(
      `UPDATE app_amz_bsr_candidate_competitor
       SET status = 6, inventory_status = '1', updateTime = NOW()
       WHERE status = 7
         AND Main_monthly_sales IS NULL
         AND updateTime >= ?
         AND updateTime <= ?`,
      [start, end]
    );

    const recoveredCount = updateResult?.affectedRows || updateResult?.changedRows || 0;
    console.log(`[恢复误标记竞品] 已恢复 ${recoveredCount} 条竞品为在售状态`);

    return {
      success: true,
      recoveredCount,
      message: `成功恢复 ${recoveredCount} 条竞品数据为在售状态（status: 7→6）。下次执行 batchUpdateCompetitorDetails 时将自动重新拉取这些竞品的数据。`
    };
  }

  async moveToLibrary(ids: number[], status: number) {
    await this.bsrCandidateCompetitorRepo.manager.transaction(async transactionalEntityManager => {
      // 1. 获取所有需要操作的竞品数据
      const competitors = await transactionalEntityManager.find(AppAmzBsrCandidateCompetitorEntity, {
        where: { id: In(ids) }
      });
      if (competitors.length === 0) return;

      // 2. 更新竞品状态
      await transactionalEntityManager.update(AppAmzBsrCandidateCompetitorEntity, { id: In(ids) }, {
        status: status
      });

      // 3. 提取所有的选品 candidate_id
      const candidateIds = Array.from(new Set(competitors.map(c => c.candidate_id).filter(id => id)));
      if (candidateIds.length > 0) {
        // 4. 将对应的选品状态更新为 20 (得分计算完成)，跳过库存抓取流程
        await transactionalEntityManager.update(AppAmzBsrCandidateEntity, { id: In(candidateIds) }, {
          competitor_status: 20
        });
      }
    });
  }

  // 竞品去重
  async removeDuplicateCompetitors() {
    try {
      // 获取所有状态为6的候选产品
      const candidates = await this.bsrCandidateRepo.find({
        where: { status: 6 },
        select: ['id', 'asin']
      });

      if (!candidates || candidates.length === 0) {
        return { success: true, message: '没有找到状态为6的候选产品' };
      }

      // 定义目标国家列表
      const TARGET_COUNTRIES = ['英国', '德国', '法国', '西班牙', '意大利'];
      let totalDeleted = 0;
      const candidateReports = [];

      // 处理每个候选产品
      for (const candidate of candidates) {
        const candidateId = candidate.id;
        const candidateAsin = candidate.asin;
        const countryReports = [];
        let candidateDeleted = 0;

        // 处理每个目标国家
        for (const country of TARGET_COUNTRIES) {
          // 获取该候选在该国家的竞品数据
          const competitors = await this.bsrCandidateCompetitorRepo.find({
            where: {
              candidate_id: candidateId,
              marketplace: country,
              status: In([1, 2]) // 只处理状态为1或2的竞品
            }
          });

          if (competitors.length === 0) {
            countryReports.push({
              country,
              status: '无竞品数据',
              deletedCount: 0
            });
            continue;
          }

          // 分组逻辑
          const groups: Record<string, AppAmzBsrCandidateCompetitorEntity[]> = {};
          competitors.forEach(competitor => {
            // 确保有有效的售卖方和变体数量
            const hasValidSoldBy = competitor.sold_by && competitor.sold_by.trim() !== '';
            const hasValidVariants = competitor.variants != null && competitor.variants !== -1;

            if (hasValidSoldBy && hasValidVariants) {
              const key = `${competitor.sold_by}_${competitor.variants}_${competitor.Main_monthly_sales || 0}`;

              if (!groups[key]) {
                groups[key] = [];
              }

              groups[key].push(competitor);
            }
          });

          // 收集需要删除的ID
          const idsToDelete: number[] = [];
          let countryDeleted = 0;

          // 处理每个分组
          Object.values(groups).forEach(group => {
            // 只有组内记录大于1时才处理
            if (group.length <= 1) return;

            // 1. 优先保留候选产品本身的记录（如果存在）
            let keepItem = group.find(item =>
              item.asin_competitor === candidateAsin
            );

            // 2. 如果没有找到候选产品本身，则保留相似度最高的记录
            if (!keepItem) {
              keepItem = group.reduce((maxItem, current) =>
                (current.similarity_score || 0) > (maxItem.similarity_score || 0) ? current : maxItem
              );

              // 3. 如果相似度相同，则保留最近更新的记录
              const sameScoreItems = group.filter(
                item => item.similarity_score === keepItem.similarity_score
              );

              if (sameScoreItems.length > 1) {
                keepItem = sameScoreItems.reduce((recent, current) =>
                  new Date(current.updateTime) > new Date(recent.updateTime) ? current : recent
                );
              }
            }

            // 将组内其他记录标记为删除
            group.forEach(item => {
              if (item.id !== keepItem.id) {
                idsToDelete.push(item.id);
              }
            });
          });

          // 执行删除操作
          if (idsToDelete.length > 0) {
            await this.bsrCandidateCompetitorRepo.delete(idsToDelete);
            countryDeleted = idsToDelete.length;
            candidateDeleted += countryDeleted;
            totalDeleted += countryDeleted;
          }

          countryReports.push({
            country,
            status: countryDeleted > 0 ? '已去重' : '无需去重',
            deletedCount: countryDeleted
          });
        }

        candidateReports.push({
          candidateId,
          asin: candidateAsin,
          deletedCount: candidateDeleted,
          countries: countryReports
        });
      }

      return {
        success: true,
        totalDeleted,
        message: `成功删除 ${totalDeleted} 条重复数据`,
        details: candidateReports
      };

    } catch (error) {
      return {
        success: false,
        message: `去重操作失败: ${error.message}`
      };
    }
  }

  async updateCompetitor(param: any | any[]): Promise<Object> {
    const items = Array.isArray(param) ? param : [param];
    const results = [];
  
    // 批量处理ID和状态（优化：提前统一处理，减少循环内重复操作）
    const processedItems = items.map(item => {
      let id = item.id !== undefined ? Number(item.id) : undefined;
      if (id !== undefined && isNaN(id)) {
        return { ...item, id: undefined, invalid: true, error: `Invalid id: ${item.id}` };
      }
      return { ...item, id, invalid: false };
    });
  
    // 分离无效数据和有效数据
    const invalidItems = processedItems.filter(item => item.invalid);
    const validItems = processedItems.filter(item => !item.invalid);
  
    // 处理无效数据结果
    invalidItems.forEach(item => {
      results.push({ success: false, id: item.id, error: item.error });
    });
  
    // 批量处理有效数据（优化：一次upsert操作）
    if (validItems.length > 0) {
      try {
        const upsertResults = await this.bsrCandidateCompetitorRepo.upsert(
          validItems.map(item => ({ ...item, id: item.id })),
          ['id']
        );
  
        validItems.forEach((item, index) => {
          results.push({ success: true, id: item.id, data: upsertResults[index] });
        });
      } catch (error: any) {
        validItems.forEach(item => {
          results.push({ success: false, id: item.id, error: error.message });
        });
      }
    }
  
    // 注意：去重方法已移至onSubmit2成功回调，此处不再调用
    console.log('处理结果:', results);
    return results;
  }


  // async updateCompetitor(param: any | any[]): Promise<Object> {
  //   const items = Array.isArray(param) ? param : [param];
  //   const results = [];

  //   for (const item of items) {
  //       let competitor_updated_info = {
  //               id: item.id,
  //               item_name: item.item_name,
  //               image_url: item.image_url,
  //               price: item.price,
  //               review_num: item.review_num,
  //               last_star: item.last_star,
  //               bsr_html: item.bsr_html,
  //               bsr_rank: item.bsr_rank,
  //               dispatches_from: item.dispatches_from,
  //               sold_by: item.sold_by,
  //               bullet_points: item.bullet_points,
  //               Main_monthly_sales:item.Main_monthly_sales,
  //               Main_monthly_sales_sub:item.Main_monthly_sales_sub,
  //               stock_quantity:item.stock_quantity,
  //               FBA_price:item.FBA_price,
  //               bsr_category:item.bsr_category,
  //               bsr_node:item.bsr_node,
  //               bsr_node_rank:item.bsr_node_rank,
  //               variants:item.variants,
  //               date_first_available:item.date_first_available,
  //               dimensions:item.dimensions,
  //               weight:item.weight,
  //               img1:item.img1,
  //               img2:item.img2,
  //               img3:item.img3,
  //               img4:item.img4,
  //               img5:item.img5,
  //               img6:item.img6,
  //               sales_volume_data:item.sales_volume_data,
  //               sold_byID:item.sold_byID,
  //               bsr_node_id:item.bsr_node_id,
  //             };
  //       const results = await this.bsrCandidateCompetitorRepo.save(competitor_updated_info);
  //   }
  //   console.log('处理结果:', results);
  //   return results;
  // }

    /**
   * 工具方法：根据marketplace获取站点域名（对应Java的getSiteDomainByMarketplaceId）
   * @param marketplace 站点标识（如"美国"、"英国"等）
   * @returns 站点域名（如"https://www.amazon.com"）
   */
    private getSiteDomainByMarketplace(marketplace: string): string {
      const domainMap = {
        '美国': 'https://www.amazon.com',
        '英国': 'https://www.amazon.co.uk',
        '德国': 'https://www.amazon.de',
        '法国': 'https://www.amazon.fr',
        '意大利': 'https://www.amazon.it',
        '西班牙': 'https://www.amazon.es'
        // 可根据需要补充其他站点
      };
      return domainMap[marketplace] || '';
    }

    generateAsinUrl(marketplace: string, asinCompetitor: string): string {
      const domain = this.getSiteDomainByMarketplace(marketplace);
      return domain ? `${domain}/dp/${asinCompetitor}` : '';
    }

    
  /**
   * 1. 提供任务列表（供Python爬虫获取待爬取的商品）
   * @param limit 每次返回的任务数量
   * @returns 待爬取的商品任务列表（包含asinUrl、id等核心信息）
   */
  async getTaskList(limit: number = 100): Promise<any[]> {
    // 库存抓取已弃用，直接返回空列表
    return [];
  }

  /**
   * 2. 更新商品库存数据（接收Python爬虫返回的库存信息）
 * @param params 库存数据参数（支持单条或多条）
 * @returns 更新结果
 */
async updateInventory(params: any | any[]): Promise<Object> {
  const items = Array.isArray(params) ? params : [params];
  const results = [];

  // 使用事务管理器执行所有更新操作
  await this.bsrCandidateCompetitorRepo.manager.transaction(
    async (transactionalEntityManager) => {
      for (const item of items) {
        try {
          console.log('更新库存数据:', item.id, item.inventory, item.inventoryType, item.dispatches_type); 
          let inventoryType =  item.inventoryType
          // 定义要更新的库存值
          let stockQuantity: string;

          // 判断是否为特殊情况（inventory = -1）
          if (item.inventory === "-1" || Number(item.inventory) === -1) {
            // 根据id查询实体
            const competitorEntity = await transactionalEntityManager.findOne(
              AppAmzBsrCandidateCompetitorEntity,
              { where: { id: item.id } }
            );

            if (!competitorEntity) {
              throw new Error(`未找到ID为${item.id}的AppAmzBsrCandidateCompetitorEntity`);
            }

            // 获取Main_monthly_sales并转为字符串（兼容原逻辑）
            stockQuantity = (competitorEntity.Main_monthly_sales || 0).toString();
            console.log(`ID为${item.id}的实体使用Main_monthly_sales更新库存: ${stockQuantity}`);
          } else if (item.inventoryType === "999+" || item.inventoryType === "1000+") {
            stockQuantity = "1000";
            inventoryType = "NORMAL"; // 既然给了具体数字，可以把它恢复成 NORMAL
            console.log(`ID为${item.id}的实体 inventoryType 为 ${item.inventoryType}，自动转为库存1000`);
          } else {
            // 常规情况：直接使用传入的inventory
            stockQuantity = item.inventory + "";
          }
          let dispatches_type = item.dispatches_type+"";
          if (
            inventoryType === "NORMAL" &&
            (stockQuantity === "" || stockQuantity === "null" || stockQuantity === "undefined")
          ) {
            inventoryType = "1";
          }

          if (dispatches_type === "null") {
            dispatches_type = "1"; // 如果配送类型为断货自动设置为fba
            inventoryType = "DUANHUO";
          }

          if (inventoryType === "DUANHUO") {
            results.push({ success: false, id: item.id, message: '跳过更新，等待接口重新获取' });
            continue;
          }

          // 执行更新操作
          const updateResult = await transactionalEntityManager.update(
            AppAmzBsrCandidateCompetitorEntity, 
            { id: item.id },  
            {
              stock_quantity: stockQuantity,  // 使用处理后的库存值
              inventory_type: inventoryType,
              inventory_status: "3",
              dispatches_type: dispatches_type,
              stock_date: new Date(),
              updateTime: new Date() // 修复死循环：必须更新 updateTime，否则会被 6 天前的兜底逻辑无限次重复抓取
            }
          );
          
          results.push({ success: true, id: item.id, message: '库存更新成功' });
        } catch (error) {
          results.push({ 
            success: false, 
            id: item.id, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      // 检查所有更新的记录关联的候选产品，是否库存已经全部抓取完成
      if (items.length > 0) {
        // 先获取这批 item 对应的 candidate_id
        const competitorEntities = await transactionalEntityManager.find(
          AppAmzBsrCandidateCompetitorEntity,
          { where: { id: In(items.map(item => item.id)) } }
        );
        const candidateIds = [...new Set(competitorEntities.map(c => c.candidate_id).filter(Boolean))];

        for (const candidateId of candidateIds) {
          // 检查该候选产品下是否还有未抓取完库存的竞品（状态为2,6,9的竞品中，inventory_status为1,2,5的）
          const pendingCount = await transactionalEntityManager.count(
            AppAmzBsrCandidateCompetitorEntity,
            {
              where: {
                candidate_id: candidateId,
                status: In(["2", "6", "9"]),
                inventory_status: In(["1", "2", "5"])
              }
            }
          );

          if (pendingCount === 0) {
            // 如果没有待抓取的竞品库存了，将主表状态更新为20
            await transactionalEntityManager.update(
              AppAmzBsrCandidateEntity,
              { id: candidateId },
              { competitor_status: 20 }
            );
            console.log(`候选产品 ${candidateId} 所有竞品库存抓取完成，状态更新为 20`);
          }
        }
      }
    }
  );
  return { total: items.length, results };
}


/**
   * 3. 标记商品失效（修改为通过asin_competitor+marketplace定位）
   * @param params 参数包含asin_competitor和marketplace
   */
async markAsInvalid(params: { asin_competitor: string, marketplace: string,str1:string }): Promise<Object> {
  try {
    const { asin_competitor, marketplace,str1 } = params;
    
    // 验证参数
    if (!asin_competitor || !marketplace) {
      return { success: false, message: '缺少参数：asin_competitor或marketplace' };
    }
    let inventory_type = "SHANCHU";
    if(str1 == "2"){
      inventory_type = "BODONG";
    }
    // 根据asin_competitor和marketplace定位记录
    const result = await this.bsrCandidateCompetitorRepo.update(
      { asin_competitor, marketplace }, // 联合条件定位
      { 
        inventory_status: "4", //4=失效
        inventory_type:inventory_type,
        stock_date: new Date()
      }
    );

    if (result.affected === 0) {
      return { 
        success: false, 
        message: `未找到商品：${marketplace}-${asin_competitor}` 
      };
    }

    return { 
      success: true, 
      message: `商品已标记为失效：${marketplace}-${asin_competitor}`,
      asinUrl: this.generateAsinUrl(marketplace, asin_competitor) // 返回生成的url
    };
  } catch (error) {
    return { success: false, message: `标记失效失败：${error.message}` };
  }
}

/**
 * 更新竞品库存数量
 * 规则：
 * 1. 只处理状态为6的候选产品对应的竞品
 * 2. 若存在 inventory_type = "BODONG" 的竞品，返回更新失败
 * 3. 无BODONG数据时，按规则更新：
 *    - inventory_type = "XIAN" → stock_quantity = Main_monthly_sales
 *    - inventory_type = "999+" → Main_monthly_sales>999则取实际值，否则取999
 */
async updateStockQuantity(): Promise<{
  success: boolean;
  message?: string;
  updatedCount?: number;
}> {
  try {
    // 步骤1：查询状态为6的候选产品
    const candidates = await this.bsrCandidateRepo.find({
      where: { status: 6 },
      select: ['id']  
    });

    if (candidates.length === 0) {
      return {
        success: false,
        message: '未找到状态为6的候选产品，无需更新库存'
      };
    }
 
    const candidateIds = candidates.map(candidate => candidate.id);
 
    let competitors = await this.bsrCandidateCompetitorRepo.find({
      where: { candidate_id: In(candidateIds) }
    });

    if (competitors.length === 0) {
      return {
        success: false,
        message: '未找到状态为6的候选产品对应的竞品数据'
      };
    }

    // ===================== 新增：去重逻辑 =====================
    // 步骤2：按asin_competitor + marketplace分组，保留一条，删除重复数据
    const competitorMap = new Map<string, AppAmzBsrCandidateCompetitorEntity>();
    const duplicateIds: number[] = [];

    // 遍历竞品数据，生成唯一标识（asin_competitor + marketplace）
    for (const competitor of competitors) {
      // 处理空值情况，避免key为undefined_undefined
      const asin_competitor = competitor.asin_competitor || '';
      const marketplace = competitor.marketplace || '';
      const asin_candidate = competitor.asin_candidate || '';
      const uniqueKey = `${asin_competitor}_${marketplace}_${asin_candidate}`;

      if (competitorMap.has(uniqueKey)) {
        // 已存在该组合，收集重复ID待删除
        duplicateIds.push(competitor.id);
      } else {
        // 不存在，保留该条数据
        competitorMap.set(uniqueKey, competitor);
      }
    }

    // 批量删除重复数据（如果有）
    if (duplicateIds.length > 0) {
      try {
        await this.bsrCandidateCompetitorRepo.delete(duplicateIds);
        console.log(`[去重] 成功删除 ${duplicateIds.length} 条重复竞品数据，重复ID：${duplicateIds.join(', ')}`);
      } catch (deleteError) {
        console.error('[去重] 删除重复竞品数据失败:', deleteError);
        return {
          success: false,
          message: `删除重复竞品数据失败：${deleteError instanceof Error ? deleteError.message : String(deleteError)}`
        };
      }
    }

    // 更新competitors为去重后的列表（后续逻辑基于去重后的数据处理）
    competitors = Array.from(competitorMap.values());
    // ===================== 去重逻辑结束 =====================
 
    const hasBodongData = competitors.some(
      competitor => competitor.inventory_type === 'BODONG'
    );

    if (hasBodongData) {
      return {
        success: false,
        message: '更新失败，存在因网络波动获取失败的数据'
      };
    }
 
    const updateData = competitors.map(competitor => {
      let stockQuantity: string | number = competitor.stock_quantity || 0;
      const mainMonthlySales = Number(competitor.Main_monthly_sales) || 0;

      switch (competitor.inventory_type) {
        case 'XIAN': 
          stockQuantity = mainMonthlySales;
          break;
        case '999+': 
          stockQuantity = mainMonthlySales > 999 ? mainMonthlySales : 999;
          break; 
        default:
          break;
      }

      return {
        id: competitor.id,
        stock_quantity: stockQuantity.toString(), // 确保与数据库字段类型一致
        updateTime: new Date() // 更新时间戳
      };
    }).filter(item => {
      // 过滤掉无需更新的记录（库存值未变化）
      const original = competitors.find(c => c.id === item.id);
      return original?.stock_quantity !== item.stock_quantity;
    });

    if (updateData.length === 0) {
      return {
        success: true,
        message: '没有需要更新的库存数据（所有数据已符合规则）',
        updatedCount: 0
      };
    }
 
    await this.bsrCandidateCompetitorRepo.manager.transaction(
      async (transactionalEntityManager) => {
        for (const data of updateData) {
          await transactionalEntityManager.update(
            AppAmzBsrCandidateCompetitorEntity,
            { id: data.id },
            {
              stock_quantity: data.stock_quantity,
              updateTime: data.updateTime
            }
          );
        }
      }
    );

    // 优化返回信息：补充去重相关统计
    const duplicateCount = duplicateIds.length;
    let returnMessage = `库存更新成功，共更新 ${updateData.length} 条竞品数据`;
    if (duplicateCount > 0) {
      returnMessage += `；已提前删除 ${duplicateCount} 条重复的竞品数据`;
    }

    return {
      success: true,
      message: returnMessage,
      updatedCount: updateData.length
    };
  } catch (error) {
    console.error('库存更新失败:', error);
    return {
      success: false,
      message: `库存更新失败：${error instanceof Error ? error.message : String(error)}`
    };
  }
}
async getCompetitor(ids: number[]) {
  // 1. 边界校验
  if (!ids || ids.length === 0) {
    return {
      success: false,
      message: "获取竞品失败：请传入有效的ID数组"
    };
  }

  // 2. 生成合法的SQL字符串（修复IN子句占位符）
  const placeholders = ids.map(() => '?').join(',');
  const querySQL = `
    SELECT
      comp.id as competitor_id,
      comp.asin_candidate,
      comp.marketplace,
      comp.asin_competitor,
      comp.candidate_id,
      '1' as inventory_status
    FROM app_amz_bsr_candidate_competitor comp
    WHERE comp.id in (${placeholders})
    ORDER BY comp.asin_candidate, comp.marketplace;
  `;

  try {
    // 3. 关键修复：传入SQL字符串（而非查询结果），并拼接参数到SQL中（适配fetchAndSave内部逻辑）
    // 注意：由于fetchAndSave内部不支持参数绑定，需将ids直接拼入SQL（仅适用于可信内部调用）
    const finalQuerySQL = querySQL.replace(`(${placeholders})`, `(${ids.join(',')})`);
    
    // 4. 调用fetchAndSaveByOpenApi（传入正确的SQL字符串）
    return await this.sellerspriteTool.fetchAndSaveByOpenApi(finalQuerySQL, undefined, '选品-任务列表获取竞品 | getTaskList');
  } catch (error) {
    return {
      success: false,
      message: `获取竞品失败：${error instanceof Error ? error.message : String(error)}`
    };
  }
}

  /**
   * 往期检测：检测所有往期(status=7)竞品中当前月份有销量的，移入在售(status=6)
   * 用于定时任务调用：appAmzBsrCandidateCompetitorService.checkPastPeriodAndMove()
   */
  async checkPastPeriodAndMove() {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 查询所有往期(status=7)竞品
    const historyList = await this.bsrCandidateCompetitorRepo.find({
      where: { status: 7 as any },
    });

    if (!historyList.length) {
      return { success: true, message: '没有往期竞品数据', count: 0 };
    }

    // 筛选：月销量走势中当前月份有销量数据的竞品
    const toMove: number[] = [];
    historyList.forEach((item) => {
      const salesData = item.sales_volume_data;
      if (salesData && Array.isArray(salesData)) {
        const currentMonthData = salesData.find((d: any) => {
          const dateStr = String(d.date || '');
          return dateStr.startsWith(currentMonth);
        });
        if (currentMonthData && Number(currentMonthData.searches) > 0) {
          toMove.push(item.id);
        }
      }
    });

    if (!toMove.length) {
      return { success: true, message: `往期竞品中，当前月份（${currentMonth}）均无销量数据`, count: 0 };
    }

    // 批量更新为在售(status=6)
    await this.bsrCandidateCompetitorRepo.update(
      { id: In(toMove) },
      { status: 6 as any }
    );

    return {
      success: true,
      message: `成功将 ${toMove.length} 个竞品从往期移入在售`,
      count: toMove.length,
      ids: toMove
    };
  }

  /**
   * 获取选品各国家销量前5竞品的关键词自然/广告得分汇总
   * 用于编辑页"各国销量信息及分析图表"中展示
   */
  async getTop5CompetitorScores(candidate_id: number) {
    const allCompetitors = await this.bsrCandidateCompetitorRepo
      .createQueryBuilder('c')
      .where('c.candidate_id = :candidate_id', { candidate_id })
      .andWhere('c.status IN (:...statuses)', { statuses: [1, 2, 6, 7] })
      .andWhere('c.Main_monthly_sales > 0')
      .orderBy('c.Main_monthly_sales', 'DESC')
      .getMany();

    if (allCompetitors.length === 0) {
      return {};
    }

    const byCountry = new Map<string, typeof allCompetitors>();
    for (const comp of allCompetitors) {
      const mp = comp.marketplace;
      if (!mp) continue;
      if (!byCountry.has(mp)) byCountry.set(mp, []);
      byCountry.get(mp)!.push(comp);
    }

    const result: Record<string, any> = {};

    for (const [marketplace, competitors] of byCountry.entries()) {
      const seenParents = new Set<string>();
      const uniqueList: typeof competitors = [];
      for (const comp of competitors) {
        const parentKey = (comp.parent_asin?.trim() || comp.asin_competitor);
        if (!seenParents.has(parentKey)) {
          seenParents.add(parentKey);
          uniqueList.push(comp);
        }
      }

      const top5 = uniqueList.slice(0, 5);
      const competitors_data = top5.map(c => ({
        asin: c.asin_competitor,
        item_name: c.item_name,
        Main_monthly_sales: c.Main_monthly_sales,
        keyword_organic_score: c.keyword_organic_score || 0,
        keyword_ad_score: c.keyword_ad_score || 0,
      }));

      const totalOrganic = competitors_data.reduce((sum, c) => sum + c.keyword_organic_score, 0);
      const totalAd = competitors_data.reduce((sum, c) => sum + c.keyword_ad_score, 0);

      result[marketplace] = { totalOrganic, totalAd, competitors: competitors_data };
    }

    return result;
  }

  async page(query, option, connectionName) {
    const { status } = query;
    // 检查是否包含状态8（回收站）
    const statusList = Array.isArray(status) ? status : [status];
    const isRecycleBin = statusList.some(s => String(s) === '8');

    if (isRecycleBin) {
      // 如果查询包含回收站数据，强制过滤 candidate_id 为 NULL
      // query.candidate_id = IsNull();
    }

    return super.page(query, option, connectionName);
  }
}
