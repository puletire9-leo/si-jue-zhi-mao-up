import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzBsrCandidateCompetitorEntity } from "../../entity/bsr_candidate_competitor";
import { AppAmzBsrCandidateEntity } from "../../entity/bsr_candidate";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
// import { AppAmzBsrCandidatePurchaserEntity } from "../../entity/bsr_candidate_purchaser";
import { Inject, Post, Body, Get, Query, HttpCode } from '@midwayjs/core';
import { AppAmzBsrCandidateCompetitorService } from "../../service/bsr_candidate_competitor";
import { SifKeywordService } from "../../service/sifKeyword";
import { Context } from "@midwayjs/koa";
import { InjectEntityModel } from "@midwayjs/typeorm";
import { In, Repository } from "typeorm";

/**
 * 保留原有CoolController配置，自动生成CRUD接口（add/delete/update/info/list/page）
 * 新增/python/* 路径接口供Python爬虫调用，与原有接口隔离
 */
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrCandidateCompetitorEntity,
  pageQueryOp: {
    keyWordLikeFields: [
      'a.asin_candidate',
      'a.asin_competitor',
      'a.item_name',
      'a.bsr_html',
      'a.marketplace',
      'a.status',
      'a.stock_quantity',
      'a.dispatches_type'
    ],
    fieldEq: [
      'a.candidate_id',
      'a.marketplace',
      'a.asin_candidate',
      'a.dispatches_type','a.status'
    ],
    select: [
      'a.*',
      'b.aliyun_img as candidate_image_url',
      'b.item_name as candidate_item_name',
      'b.bullet_points as candidate_bullet_points',
    ],
    join: [
      {
        entity: AppAmzBsrCandidateEntity,
        alias: 'b',
        condition: 'a.candidate_id = b.id',
        type: 'leftJoin',
      },
    ],

  },
})
@updateWithoutAmendingCreateTime // 保留原有更新不修改创建时间的业务规则
export class AdminBsrCandidateCompetitorController extends BaseController {
  @Inject()
  AppAmzBsrCandidateCompetitorService: AppAmzBsrCandidateCompetitorService;

  @Inject()
  sifKeywordService: SifKeywordService;

  @Inject()
  ctx: Context;


  @InjectEntityModel(AppAmzBsrCandidateCompetitorEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzBsrCandidateCompetitorEntity>;

  // @InjectEntityModel(AppAmzBsrCandidatePurchaserEntity)
  // bsrTaskRepo: Repository<AppAmzBsrCandidatePurchaserEntity>;

  // ======================== 原有自定义接口（完全保留）========================
  /**
   * 原有更新状态接口（后台管理用）
   * @param asin_candidate 候选ASIN
   * @param status 状态值
   */
  @Post('/updateStatus')
  async updateStatus(
    @Body('asin_candidate') asin_candidate: string,
    @Body('status') status: string
  ) {
    await this.AppAmzBsrCandidateCompetitorService.updateStatus(asin_candidate, status);
    console.log("调用updateStatus接口，参数：", asin_candidate, status);
    return this.ok('执行完毕。');
  }

  /**
   * 原有更新竞品信息接口（后台管理用）
   * @param param 竞品数据
   */
  @Post('/updateCompetitor')
  async updateCompetitor(@Body() param: any): Promise<{ success: boolean }> {
    try {
      await this.AppAmzBsrCandidateCompetitorService.updateCompetitor(param);
      return { success: true };
    } catch (err) {
      console.error("updateCompetitor接口错误：", err);
      return { success: false };
    }
  }

  @Post('/removeDuplicateCompetitors')
  async removeDuplicateCompetitors() {
    try {
      // 直接调用服务层已实现的去重方法，无需额外参数
      const result = await this.AppAmzBsrCandidateCompetitorService.removeDuplicateCompetitors();
      // 按服务层返回格式，返回成功响应（包含去重统计信息）
      return { totalDeleted: result.totalDeleted, details: result.details, success: result.success
      }
    } catch (err: any) {
      console.error("去重接口调用失败：", err);
      return { success: false };
    }
  }

  @Post('/moveToLibrary')
  async moveToLibrary(@Body() body: { ids: number[], status: number }) {
    if (!body?.ids || !Array.isArray(body.ids) || body.ids.some(id => typeof id !== 'number')) {
      return this.fail("入参错误：ids 必须是数字数组");
    }
    if (![1, 2, 9].includes(body.status)) {
      return this.fail("入参错误：status 必须是 1, 2, 或 9");
    }

    try {
      await this.AppAmzBsrCandidateCompetitorService.moveToLibrary(body.ids, body.status);
      return this.ok("操作成功");
    } catch (err: any) {
      console.error("入库操作失败：", err);
      return this.fail(`入库操作失败：${err.message}`);
    }
  }

  @Post('/updateStockQuantity')
  async updateStockQuantity() {
    try {
      const result = await this.AppAmzBsrCandidateCompetitorService.updateStockQuantity();
      // 统一响应格式，与前端交互更清晰
      if (result.success) {
        return this.ok(result.message);
      } else {
        return this.fail(result.message);
      }
    } catch (err: any) {
      console.error("更新库存接口调用失败：", err);
      return this.fail(`更新库存接口调用失败：${err.message}`);
    }
  }

  @Post('/getCompetitor')
  async getCompetitor(@Body() body: { ids: number[] }) {
    // 提前校验入参格式
    if (!body?.ids || !Array.isArray(body.ids) || body.ids.some(id => typeof id !== 'number')) {
      return this.fail("入参错误：ids 必须是数字数组");
    }

    try {
      const result = await this.AppAmzBsrCandidateCompetitorService.getCompetitor(body.ids);
      return this.ok(result);
    } catch (err: any) {
      console.error("获取竞品信息接口调用失败：", err.stack); // 打印完整栈信息
      return this.fail(`获取竞品信息接口调用失败：${err.message || '未知错误'}`);
    }
  }
  /**
   * 往期检测：全局检测所有往期(status=7)竞品，当前月份有销量的移入在售(status=6)
   */
  @Post('/checkPastPeriodAndMove')
  async checkPastPeriodAndMove() {
    try {
      const result = await this.AppAmzBsrCandidateCompetitorService.checkPastPeriodAndMove();
      return this.ok(result);
    } catch (err: any) {
      console.error('往期检测失败：', err);
      return this.fail(`往期检测失败：${err.message || '未知错误'}`);
    }
  }

  @Get('/getStockStatistics')
  async getStockStatistics() {
    try {
      // 构建基础查询（应获取数量的SQL）
      const baseQuery = this.bsrCandidateCompetitorRepo
        .createQueryBuilder('t')
        .where('t.inventory_status IS NOT NULL')
        .andWhere('t.asin_candidate IN (SELECT asin FROM app_amz_bsr_candidate WHERE status = :status)', { status: '6' })
        .andWhere('t.status IN (:...statusList)', { statusList: ['2'] });
      // 1. 应获取数量（执行第一个SQL）
      const totalShouldGet = await baseQuery.getCount();

      // 2. 已获取数量（执行第二个SQL，新增inventory_status != '1'条件）
      const totalGot = await baseQuery
        .andWhere('t.inventory_status != :inventoryStatus', { inventoryStatus: '1' })
        .andWhere('t.inventory_status != :inventoryStatus', { inventoryStatus: '0' })
        .getCount();

      return this.ok({
        totalShouldGet, // 应获取数量
        totalGot,       // 已获取数量
        ratio: totalShouldGet > 0 ? `${totalGot}/${totalShouldGet}` : '0/0' // 格式化显示
      });
    } catch (error) {
      console.error('查询库存统计失败:', error);
      return this.fail(`查询库存统计失败：${error.message}`);
    }
  }

  /**
   * 获取选品各国家销量前5竞品的关键词自然/广告得分汇总（只读）
   */
  @Get('/getTop5Scores')
  async getTop5Scores(@Query('candidate_id') candidate_id: number) {
    if (!candidate_id) {
      return this.fail('缺少选品ID(candidate_id)');
    }
    const result = await this.AppAmzBsrCandidateCompetitorService.getTop5CompetitorScores(candidate_id);
    return this.ok(result);
  }

  /**
   * 竞品关键词自然广告得分
   * 取父体销量前5的竞品，通过关键词前三页的ASIN出现情况，计算自然/广告得分
   */
  @Post('/scoreKeywordOrganicAd')
  async scoreKeywordOrganicAd(@Body('candidate_id') candidate_id: number) {
    if (!candidate_id) {
      return this.fail('缺少选品ID(candidate_id)');
    }
    try {
      const result = await this.sifKeywordService.scoreCompetitorKeywordOrganicAd(candidate_id);
      return result.success ? this.ok(result) : this.fail(result.message);
    } catch (err: any) {
      console.error('竞品关键词自然广告得分失败:', err);
      return this.fail(`得分计算失败：${err.message || '未知错误'}`);
    }
  }
}