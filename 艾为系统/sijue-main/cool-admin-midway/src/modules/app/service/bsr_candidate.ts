import { Inject, Provide, sleep } from '@midwayjs/decorator';
import { Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import pinyin from 'pinyin';
import { AppAmzBsrCandidateEntity } from "../entity/bsr_candidate";
import { AppAmzBsrCandidatePurchaserEntity } from "../entity/bsr_candidate_purchaser";
import { AppAmzBsrCandidateFactoryLinkEntity } from "../entity/bsr_candidate_factory_link";
import { AppAmzBsrCandidateVariantEntity } from "../entity/bsr_candidate_variant";
import { AppAmzFXEntity } from '../entity/foreign_exchange';
import { LingXingUtils } from "../utils/lingxing/lingxingUtils";
import { AppAmzListingService } from "./listing";
import * as dayjs from "dayjs";
import { BaseService, CoolCommException } from '@cool-midway/core';
import { AppTaskManagementEntity } from '../entity/bzy_task_management';
import { appConfig } from "../../../appConfig";
import { AppAmzBsrDeduplicateEntity } from "../entity/bsr_deduplicate";
import { AppAmzBsrCandidateCompetitorEntity } from "../entity/bsr_candidate_competitor";
import { AppAmzBsrCandidateCompetitorCustomizeEntity } from "../entity/bsr_candidate_competitor_customize";
import { AppAmzBsrCandidatePurchasePlanEntity } from "../entity/bsr_candidate_purchase_plan";
import { AppAmzBsrPurchasePlanLingxingService } from "./bsr_purchase_plan_lingxing";
import { AppAmzBsrPurchaseOrderSyncLingxingEntity } from "../entity/bsr_purchase_order_sync_lingxing";
import { AppAmzBsrPurchaseOrderItemSyncLingxingEntity } from "../entity/bsr_purchase_order_item_sync_lingxing";
import { AppAmzBsrPurchaseOrderLogisticsLingxingEntity } from "../entity/bsr_purchase_order_logistics_lingxing";
import { AppAmzDepartmentRankFilterEntity } from "../entity/bsr_department_rank_filter";
import { AppAmzListingKeywordEntity } from "../entity/keyword";
import { AppAmzSellerEntity } from "../entity/seller";
import { AppAmzMskuEntity } from "../entity/msku";
import { DesignTaskEntity } from '../entity/design_task';
import { AppAmzMskuService } from "./msku";
import { DesignTaskService } from './design_task';
import { AiListingTaskService } from './ai_listing_task';
import { resolveDispatchRequestedLanguagesFromPurchaserItems } from './ai_listing_task_policy';
import { ContentWorkbenchService } from './content_workbench';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AppAmzBsrProfitCommon } from '../entity/bsr_profit_common';
import { AppAmzBsrProfitMarket } from '../entity/bsr_profit_market';
import { RateLimit, Sema } from 'async-sema'; // 需安装 async-sema
import { ImageSimilarityTool } from './ImageSearchUtil';
import { BaseSysParamEntity } from '../../base/entity/sys/param';
import {BaseSysUserEntity} from "../../base/entity/sys/user";
import { SifKeywordService } from "./sifKeyword";
import { SellerspriteTool } from "../utils/maijiajingling/SellerspriteUtil";
import { OxylabsService } from './OxylabsService';
import { AppAmzProductListingLingxingService } from "./amazon_product_Listing_Lingxing";
import { BazhuayuUtils, AmzTargetData } from "../utils/bazhuayu/bazhuayuUtils";
import { DingTalkNotifyService } from './dingtalk_notify';
import {
  ListingNotifyTargetsService,
  StaffProfileForDingTalk,
} from './listing_notify_targets_service';
// 在文件顶部添加以下导入
import { Readable } from 'stream';
// 在AppAmzBsrCandidateService类中添加以下内容
import axios from 'axios';
import * as qs from 'qs';
import { buildProductSetSupplierQuotes } from './bsr_candidate_lingxing_quotes';
import {
  buildCandidateProductSetSizeFields,
  buildCandidatePurchasePlanApiItem,
  extractCandidateErpSupplierId,
  buildCandidateRegularPurchasePlanSources,
  buildCandidateSamplePurchasePlanSources,
  buildFactoryLinkSkuMetadataUpdates,
  buildCandidatePlanSupplierQuotes,
  CandidateFactoryLinkInfo,
  CandidateFactoryLinkLookupValue,
  hasExistingCandidatePurchasePlan,
  parseCandidateCreatePurchasePlanResponse,
} from './bsr_candidate_purchase_plan_helpers';
import { normalizePurchaserDecisionUpdate } from './bsr_candidate_purchaser_decision_helpers';
import {
  buildPendingPurchaserReleaseUpdate,
  buildTimedOutPurchaserRejectUpdate,
  shouldExpirePendingPurchaser,
  shouldRemindPendingPurchaser,
} from './bsr_candidate_purchaser_timeout_helpers';
import { normalizePurchasersCountryEnabled } from './bsr_candidate_purchaser_country_scope_helpers';
import {
  BsrBacklogCategoryParams,
  getVisibleBsrBacklogCategoryOptions,
} from './bsr_candidate_backlog_helpers';
import {
  BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY,
  BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY_EXHAUSTED,
  buildExistingCompetitorRefreshPatch,
  resolveImageRetryAfterLowCompetitors,
} from './bsr_candidate_workflow_helpers';
import {
  BSR_CANDIDATE_STATUS_PENDING_PROCESS,
  BSR_CANDIDATE_STATUS_RESERVED,
  BSR_CANDIDATE_STATUS_SELECTED,
  buildReserveNotifyMessage,
  collectReserveImageUrls,
} from './bsr_candidate_reserve_helpers';
import {
  candidateIdentityKey,
  normalizeCandidateAsin,
  normalizeCandidateMarketplace,
  shouldRestoreArchivedCandidate,
  stripArchivedCandidateRestoreFlags,
} from './bsr_candidate_archived_restore_helpers';
const AK = "JZQjn2fE6OYgRZvqIAaQcmuV"
const SK = "20N9xXazdnepuwoCgD2DwmDTGnbXFMCl"

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

const shouldClearLingxingGroupList = (groupProportions: unknown) => {
  let parsed = groupProportions;
  for (let index = 0; index < 2 && typeof parsed === 'string'; index++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
      break;
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return true;
  return Object.keys(parsed).length <= 1;
};


const TASK_STATUSES = {
  UNEXECUTED: 'Unexecuted',  // 未执行
  RUNNING: 'Running',        // 执行中
  FINISHED: 'Finished',      // 执行完成
  FAILED: 'Failed',          // 执行失败
  STOPPED: 'Stopped'         // 已停止
};


const oss = require('@alicloud/oss-util');
const fs = require('fs');
const imagesearch = require('@alicloud/imagesearch20201214')

interface BaiduSuccessResponse {
  cont_sign: string;
  log_id: number;
  error_code?: never;  // 明确排除错误代码
}

interface BaiduErrorResponse {
  error_code: number;
  error_msg: string;
  cont_sign?: never;   // 明确排除成功字段
}

type ApiResponse = BaiduSuccessResponse | BaiduErrorResponse;


function isErrorResponse(
  response: ApiResponse
): response is BaiduErrorResponse {
  return 'error_code' in response;
}

interface BatchUpdateParams {
  field: 'competitor_import_status' | 'competitor_full_ownership_status' | 'keyword_import_status';
  value: number;
  updateList: Array<{ asin: string; marketplace: string }>;
}
let isAutoProcessCandidateWorkflowRunning = false;
let isFetchExportDataRunning = false;

@Provide()
export class AppAmzBsrCandidateService extends BaseService {

  @Inject()
  oxylabsService: OxylabsService;

  @InjectEntityModel(AppTaskManagementEntity)
  taskManagementRepo: Repository<AppTaskManagementEntity>;

  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamRepo: Repository<BaseSysParamEntity>;

  @Inject()
  imageSimilarityTool: ImageSimilarityTool;
  
  @Inject()
  sellerspriteTool: SellerspriteTool;

  @Inject()
  sifKeywordService: SifKeywordService;


  @InjectEntityModel(AppAmzBsrCandidateEntity)
  bsrCandidateRepo: Repository<AppAmzBsrCandidateEntity>;

  @InjectEntityModel(AppAmzBsrCandidatePurchaserEntity)
  appAmzBsrCandidatePurchaserEntity: Repository<AppAmzBsrCandidatePurchaserEntity>;

  @InjectEntityModel(AppAmzBsrCandidateFactoryLinkEntity)
  factoryLinkRepo: Repository<AppAmzBsrCandidateFactoryLinkEntity>;

  @InjectEntityModel(AppAmzBsrCandidateVariantEntity)
  variantRepo: Repository<AppAmzBsrCandidateVariantEntity>;

  @InjectEntityModel(AppAmzBsrDeduplicateEntity)
  deduplicateRepo: Repository<AppAmzBsrDeduplicateEntity>;

  @InjectEntityModel(AppAmzDepartmentRankFilterEntity)
  departmentFilterRepo: Repository<AppAmzDepartmentRankFilterEntity>;

  @InjectEntityModel(AppAmzBsrCandidateCompetitorEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzBsrCandidateCompetitorEntity>;


  @InjectEntityModel(AppAmzBsrCandidateCompetitorCustomizeEntity)
  bsrCandidateCompetitorCustomizeRepo: Repository<AppAmzBsrCandidateCompetitorCustomizeEntity>;

  @InjectEntityModel(AppAmzBsrCandidatePurchasePlanEntity)
  candidatePurchasePlanRepo: Repository<AppAmzBsrCandidatePurchasePlanEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderItemSyncLingxingEntity)
  orderItemRepo: Repository<AppAmzBsrPurchaseOrderItemSyncLingxingEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderSyncLingxingEntity)
  orderRepo: Repository<AppAmzBsrPurchaseOrderSyncLingxingEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderLogisticsLingxingEntity)
  orderLogisticsRepo: Repository<AppAmzBsrPurchaseOrderLogisticsLingxingEntity>;

  @Inject()
  purchasePlanLingxingService: AppAmzBsrPurchasePlanLingxingService;

  @InjectEntityModel(AppAmzSellerEntity)
  appAmzSellerRepo: Repository<AppAmzSellerEntity>;

  @Inject()
  mskuService: AppAmzMskuService;

  @Inject()
  designTaskService: DesignTaskService;

  @Inject()
  aiListingTaskService: AiListingTaskService;

  @Inject()
  contentWorkbenchService: ContentWorkbenchService;

  @Inject()
  dingTalkNotifyService: DingTalkNotifyService;

  @Inject()
  listingNotifyTargetsService: ListingNotifyTargetsService;

  @InjectEntityModel(AppAmzFXEntity)
  appAmzFXEntity: Repository<AppAmzFXEntity>;

  @InjectEntityModel(AppAmzListingKeywordEntity)  // 请替换为实际的关键词实体
  keywordRepo: Repository<AppAmzListingKeywordEntity>;

  @InjectEntityModel(DesignTaskEntity)
  designTaskRepo: Repository<DesignTaskEntity>;


  @InjectEntityModel(BaseSysUserEntity)
  baseSysUserRepo: Repository<BaseSysUserEntity>;

  @Inject()
  lingXingUtils: LingXingUtils;

  @Config('lingxing.openApiEnabled')
  lingxingOpenApiEnabled: boolean;

  @Inject()
  amzListingService: AppAmzListingService;

  @Inject()
  appAmzProductListingLingxingService: AppAmzProductListingLingxingService;

  @Config('dingtalk')
  dingtalkConfig: any;

  @Inject()
  bazhuayuUtils: BazhuayuUtils;

  private parseJsonObject(value: unknown): Record<string, any> {
    let parsed = value;
    for (let index = 0; index < 2 && typeof parsed === 'string'; index++) {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return {};
      }
    }
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, any>)
      : {};
  }

  private parseLegacyJsonArray(value: unknown): any[] {
    let parsed = value;
    for (let index = 0; index < 2 && typeof parsed === 'string'; index++) {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return [];
      }
    }
    return Array.isArray(parsed) ? parsed : [];
  }

  private getCurrentAdminUser(): { userId: number | null; userName: string } {
    const admin = (this as any).baseCtx?.admin || {};
    const userId = Number(admin.userId || admin.id || 0);
    return {
      userId: Number.isFinite(userId) && userId > 0 ? userId : null,
      userName: String(admin.name || admin.username || admin.nickName || '').trim(),
    };
  }

  private buildAdminLink(path: string): string {
    const base = String(this.dingtalkConfig?.adminBaseUrl || '').replace(/\/$/, '');
    return base ? `${base}/#${path}` : '';
  }

  private async resolveReserveOperatorUserIds(
    profiles: StaffProfileForDingTalk[]
  ): Promise<string[]> {
    return this.dingTalkNotifyService.resolveUserIdsByStaffProfiles(profiles);
  }

  private buildReserveOperatorMarkdown(
    candidate: AppAmzBsrCandidateEntity,
    imageUrls: string[]
  ): string {
    const link = this.buildAdminLink('/app/bsr-candidate-reserve');
    const imageBlock = imageUrls.length
      ? imageUrls.map((url, index) => `![变体图片${index + 1}](${url})`).join('\n\n')
      : '未找到可直接展示的公网变体图片，请进入预留页查看。';
    return [
      '### BSR 选品预留待确认',
      '',
      `- 选品ID：${candidate.id}`,
      `- 产品名称：${candidate.produce_name || '-'}`,
      `- ASIN：${candidate.asin || '-'}`,
      `- SKU：${candidate.sku || '-'}`,
      link ? `- 预留页：[点击进入](${link})` : '- 预留页：请进入系统 BSR 选品预留菜单',
      '',
      imageBlock,
    ].join('\n');
  }

  private buildReserveRejectedMarkdown(
    candidate: AppAmzBsrCandidateEntity,
    reason: string
  ): string {
    const link = this.buildAdminLink('/app/bsr-candidate4');
    return [
      '### BSR 选品预留已打回',
      '',
      `- 选品ID：${candidate.id}`,
      `- 产品名称：${candidate.produce_name || '-'}`,
      `- ASIN：${candidate.asin || '-'}`,
      `- 打回原因：${reason || '未填写'}`,
      link ? `- 待处理数据页：[点击进入](${link})` : '- 待处理数据页：请进入系统 BSR 选品待处理数据菜单',
    ].join('\n');
  }

  async reserveCandidate(input: {
    id: number;
    max_purchase: number;
    purchasers: Array<Partial<AppAmzBsrCandidatePurchaserEntity>>;
  }): Promise<{ success: boolean; notified: boolean; message: string }> {
    const candidateId = Number(input?.id);
    if (!Number.isFinite(candidateId) || candidateId <= 0) {
      throw new CoolCommException('缺少选品ID');
    }
    const maxPurchase = Number(input?.max_purchase || 0);
    if (!Number.isFinite(maxPurchase) || maxPurchase <= 0) {
      throw new CoolCommException('最大采购量必须大于0');
    }
    const purchasers = Array.isArray(input.purchasers) ? input.purchasers : [];
    let scopedPurchasers = purchasers;
    if (purchasers.length > 0) {
      const purchaserUserIds = Array.from(
        new Set(
          purchasers
            .map(item => Number(String((item as any)?.userId || '').trim()))
            .filter(userId => Number.isFinite(userId) && userId > 0)
        )
      );
      const purchaserNames = Array.from(
        new Set(
          purchasers
            .map(item => String((item as any)?.purchaser || '').trim())
            .filter(Boolean)
        )
      );
      const userWhere: any[] = [];
      if (purchaserUserIds.length > 0) {
        userWhere.push({ id: In(purchaserUserIds) });
      }
      if (purchaserNames.length > 0) {
        userWhere.push(
          { name: In(purchaserNames) },
          { username: In(purchaserNames) },
          { nickName: In(purchaserNames) }
        );
      }
      const purchaserUsers =
        userWhere.length > 0
          ? await this.baseSysUserRepo.find({
              where: userWhere,
              select: ['id', 'name', 'username', 'nickName', 'operation_country_scope'] as any,
            })
          : [];
      scopedPurchasers = normalizePurchasersCountryEnabled(purchasers, purchaserUsers);
    }
    const admin = this.getCurrentAdminUser();
    const now = new Date();
    let reservedCandidate: AppAmzBsrCandidateEntity | null = null;

    await this.bsrCandidateRepo.manager.transaction(async transactionalEntityManager => {
      const candidate = await transactionalEntityManager.findOne(AppAmzBsrCandidateEntity, {
        where: { id: candidateId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!candidate) throw new CoolCommException('选品不存在');
      if (Number(candidate.status) !== BSR_CANDIDATE_STATUS_PENDING_PROCESS) {
        throw new CoolCommException('只有待处理数据可以进入预留');
      }

      await transactionalEntityManager.update(
        AppAmzBsrCandidateEntity,
        { id: candidateId, status: BSR_CANDIDATE_STATUS_PENDING_PROCESS },
        {
          status: BSR_CANDIDATE_STATUS_RESERVED,
          max_purchase: maxPurchase,
          reserved_at: now,
          reserved_by_user_id: admin.userId,
          reserved_by_user_name: admin.userName,
          reserve_rejected_at: null,
          reserve_rejected_by_user_id: null,
          reserve_rejected_by_user_name: null,
          reserve_reject_reason: null,
        } as any
      );

      if (scopedPurchasers.length > 0) {
        await transactionalEntityManager.insert(
          AppAmzBsrCandidatePurchaserEntity,
          scopedPurchasers.map(item => ({
            ...item,
            candidate_id: String(candidateId),
          }))
        );
      }

      reservedCandidate = {
        ...candidate,
        status: BSR_CANDIDATE_STATUS_RESERVED,
        max_purchase: maxPurchase,
        reserved_at: now,
        reserved_by_user_id: admin.userId,
        reserved_by_user_name: admin.userName,
      } as AppAmzBsrCandidateEntity;
    });

    if (!reservedCandidate) throw new CoolCommException('进入预留失败');

    const variants = await this.variantRepo.find({
      where: { candidate_id: candidateId, deleted_at: IsNull() },
      select: ['image_url'],
      order: { sort_order: 'ASC' as any },
    });
    const imageUrls = collectReserveImageUrls(reservedCandidate, variants);
    const operatorProfiles =
      await this.listingNotifyTargetsService.listOperatorStaffProfiles();
    const operatorPhoneCount = operatorProfiles.filter(profile =>
      String(profile.phone || '').replace(/\D/g, '')
    ).length;
    const dingtalkEnabled = this.dingTalkNotifyService.isEnabled();
    const operatorUserIds =
      operatorProfiles.length && operatorPhoneCount && dingtalkEnabled
        ? await this.resolveReserveOperatorUserIds(operatorProfiles)
        : [];
    let notified = false;
    let sendErrorMessage = '';

    if (!operatorProfiles.length) {
      ((this as any).logger?.warn || console.warn)(
        '[预留通知] 未找到运营角色用户'
      );
    } else if (!dingtalkEnabled) {
      ((this as any).logger?.warn || console.warn)(
        '[预留通知] 钉钉应用未配置或已禁用',
        {
          hasAppKey: !!this.dingtalkConfig?.appKey,
          hasAppSecret: !!this.dingtalkConfig?.appSecret,
          hasAgentId: !!this.dingtalkConfig?.agentId,
          enabled: this.dingtalkConfig?.enabled,
        }
      );
    } else if (!operatorPhoneCount) {
      ((this as any).logger?.warn || console.warn)(
        '[预留通知] 运营用户未填写手机号',
        { operators: operatorProfiles.map(profile => profile.name) }
      );
    } else if (!operatorUserIds.length) {
      ((this as any).logger?.warn || console.warn)(
        '[预留通知] 运营用户手机号未匹配到钉钉用户',
        { operators: operatorProfiles.map(profile => profile.name) }
      );
    } else {
      try {
        const taskId = await this.dingTalkNotifyService.sendWorkNotice({
          userIds: operatorUserIds,
          title: 'BSR 选品预留待确认',
          markdownText: this.buildReserveOperatorMarkdown(reservedCandidate, imageUrls),
        });
        this.dingTalkNotifyService.scheduleDebugSendResult(taskId);
        notified = !!taskId;
      } catch (err) {
        ((this as any).logger?.error || console.error)(
          '[预留通知] 发送运营钉钉失败',
          err?.message || err
        );
        sendErrorMessage = String(err?.message || err || '发送失败');
      }
    }

    return {
      success: true,
      notified,
      message: buildReserveNotifyMessage({
        notified,
        operatorProfileCount: operatorProfiles.length,
        operatorPhoneCount,
        operatorUserIds,
        dingtalkEnabled,
        sendErrorMessage,
      }),
    };
  }

  async rejectReservedCandidate(input: {
    id: number;
    reason?: string;
  }): Promise<{ success: boolean; notified: boolean }> {
    const candidateId = Number(input?.id);
    if (!Number.isFinite(candidateId) || candidateId <= 0) {
      throw new CoolCommException('缺少选品ID');
    }
    const admin = this.getCurrentAdminUser();
    const reason = String(input?.reason || '').trim();
    const now = new Date();
    let rejectedCandidate: AppAmzBsrCandidateEntity | null = null;

    await this.bsrCandidateRepo.manager.transaction(async transactionalEntityManager => {
      const candidate = await transactionalEntityManager.findOne(AppAmzBsrCandidateEntity, {
        where: { id: candidateId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!candidate) throw new CoolCommException('选品不存在');
      if (Number(candidate.status) !== BSR_CANDIDATE_STATUS_RESERVED) {
        throw new CoolCommException('只有预留数据可以打回');
      }
      await transactionalEntityManager.update(
        AppAmzBsrCandidateEntity,
        { id: candidateId, status: BSR_CANDIDATE_STATUS_RESERVED },
        {
          status: BSR_CANDIDATE_STATUS_PENDING_PROCESS,
          reserve_rejected_at: now,
          reserve_rejected_by_user_id: admin.userId,
          reserve_rejected_by_user_name: admin.userName,
          reserve_reject_reason: reason,
        } as any
      );
      rejectedCandidate = {
        ...candidate,
        status: BSR_CANDIDATE_STATUS_PENDING_PROCESS,
        reserve_rejected_at: now,
        reserve_rejected_by_user_id: admin.userId,
        reserve_rejected_by_user_name: admin.userName,
        reserve_reject_reason: reason,
      } as AppAmzBsrCandidateEntity;
    });

    if (!rejectedCandidate) throw new CoolCommException('打回预留失败');

    let notified = false;
    const developerId = Number((rejectedCandidate as any).reserved_by_user_id || 0);
    if (developerId > 0) {
      const developer = await this.baseSysUserRepo.findOne({
        where: { id: developerId, status: 1 } as any,
        select: ['id', 'name', 'phone'],
      });
      const userIds = await this.dingTalkNotifyService.resolveUserIdsByStaffProfiles(
        developer ? [{ name: developer.name, phone: developer.phone }] : []
      );
      if (userIds.length) {
        try {
          const taskId = await this.dingTalkNotifyService.sendWorkNotice({
            userIds,
            title: 'BSR 选品预留已打回',
            markdownText: this.buildReserveRejectedMarkdown(rejectedCandidate, reason),
          });
          this.dingTalkNotifyService.scheduleDebugSendResult(taskId);
          notified = !!taskId;
        } catch (err) {
          ((this as any).logger?.error || console.error)(
            '[预留打回] 通知开发失败',
            err?.message || err
          );
        }
      }
    }

    return { success: true, notified };
  }

  async autoReleaseReservedCandidates(
    now = new Date()
  ): Promise<{ releasedCount: number }> {
    const cutoff = dayjs(now).subtract(24, 'hour').toDate();
    const result = await this.bsrCandidateRepo
      .createQueryBuilder()
      .update(AppAmzBsrCandidateEntity)
      .set({ status: BSR_CANDIDATE_STATUS_SELECTED } as any)
      .where('status = :status', { status: BSR_CANDIDATE_STATUS_RESERVED })
      .andWhere('reserved_at IS NOT NULL')
      .andWhere('reserved_at <= :cutoff', { cutoff })
      .execute();
    return { releasedCount: Number(result.affected || 0) };
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async findArchivedCandidates(params: { asin?: string; marketplace?: string; items?: any[] }) {
    const rawItems = Array.isArray(params?.items) ? params.items : [params];
    const whereMap = new Map<string, any>();

    for (const item of rawItems) {
      const asin = normalizeCandidateAsin(item?.asin);
      const marketplace = normalizeCandidateMarketplace(item?.marketplace);
      if (!asin) continue;

      const key = `${marketplace}|${asin}`;
      whereMap.set(key, marketplace ? { asin, marketplace, status: 5 } : { asin, status: 5 });
    }

    const where = Array.from(whereMap.values());
    if (where.length === 0) return [];

    return this.bsrCandidateRepo.find({
      where,
      select: ['id', 'asin', 'marketplace', 'produce_name', 'item_name', 'status'],
    });
  }


  async add(param: any | any[]): Promise<Object> {
    const items = Array.isArray(param) ? param : [param];
    console.log(`===== 开始执行add方法 =====`);
    console.log(`入参总条数：${items.length}`);
  
    // 1. 查询数据库中已存在的记录
    const existingWhere = items
      .map(item => ({
        asin: normalizeCandidateAsin(item.asin),
        marketplace: normalizeCandidateMarketplace(item.marketplace)
      }))
      .filter(item => item.asin);
    const existingRecords = existingWhere.length > 0
      ? await this.bsrCandidateRepo.find({ where: existingWhere })
      : [];
    console.log(`查询到已存在记录数：${existingRecords.length}`);
  
    // 2. 构建映射：key为asin+marketplace，value为记录的id
    const existingMap = new Map<string, AppAmzBsrCandidateEntity>();
    existingRecords.forEach(record => {
      existingMap.set(candidateIdentityKey(record), record);
    });
  
    // 3. 为每个item设置id（如果已存在）+ 初始化aliyun_img
    items.forEach(item => {
      const key = candidateIdentityKey(item);
      const existingRecord = existingMap.get(key);
      if (existingRecord) {
        item.id = existingRecord.id;
        item.asin = existingRecord.asin;
        item.marketplace = existingRecord.marketplace;
        item.status = shouldRestoreArchivedCandidate(item, existingRecord)
          ? BSR_CANDIDATE_STATUS_PENDING_PROCESS
          : existingRecord.status;
        if (item.status === BSR_CANDIDATE_STATUS_PENDING_PROCESS) {
          item.archive_hide_until = null;
          item.competitor_spider_status = item.competitor_spider_status ?? 0;
        }
        console.log(`[${item.asin}] 已存在，ID=${item.id}（更新模式）`);
      } else {
        console.log(`[${item.asin}] 新增模式`);
      }
      // 初始化aliyun_img = image_url（兜底空字符串）
      item.aliyun_img = item.image_url || '';
      if(!existingRecord && item.status != 2){
        item.status = 6;
      }
    });
  
    // 4. 保存数据（更新或插入）
    const savedData = await this.bsrCandidateRepo.save(items.map(item => stripArchivedCandidateRestoreFlags(item)));
    console.log(`保存成功的记录数：${savedData.length}`);
  
    // 5. 立即启动后台处理（不阻塞主流程，异常仅日志）
    this.processInBackground(savedData).catch(error => {
      console.error('后台处理发生错误:', error);
    });
  
    // 6. 立即返回已入库的数据（前端无需等待校验和上传）
    return savedData;
  }
  
  /**
   * 后台异步处理：补全产品信息 + 阿里云上传
   * @param savedData 保存后的记录列表
   */
  private async processInBackground(savedData: any[]): Promise<void> {
    if (!savedData || savedData.length === 0) {
        console.log('无数据需要后台处理');
        return;
    }
  
    // 只处理本次传入的数据，避免全量扫描导致死循环和API浪费
    const ids = savedData.map(item => item.id);
    const savedDataToProcess = await this.bsrCandidateRepo.find({
      where: {
        id: In(ids),
        status: In([2]) 
      }
    });
    console.log(`===== 开始后台处理 ${savedDataToProcess.length} 条记录（仅处理本次新增/更新） =====`);
    // 并行处理（限制并发数）
    const sema = new Sema(5); // 限制并发数为5，避免接口限流
    
    await Promise.all(savedDataToProcess.map(async (record, i) => {
      await sema.acquire();
      try {
        const { id, asin, marketplace, aliyun_img: initialAliyunImg } = record;
        console.log(`===== 后台处理第${i+1}条：ASIN=${asin}，ID=${id} =====`);
    
        // 单条记录独立异常捕获
        try {
          // 直接用数据源自带的图片做相似度比对，不再调Oxylabs
          const finalAliyunImg = initialAliyunImg;
          const similarityScore = await this.imageSimilarityTool.getSimilarityScore2(finalAliyunImg, asin);
  
          // 2. 判断是否满足过滤条件  
          if (similarityScore > 0.88) {
            // 删除不符合条件的数据
            await this.bsrCandidateRepo.delete(id);
            await this.bsrCandidateRepo.update(
              { id: id },
              {
                status: 5,  // 标记为归档状态
                aliyun_score: similarityScore+"" 
              }
            );
            console.log(`[${asin}] 数据已删除，相似度过高：${similarityScore}`);
            return;
          }
          await this.bsrCandidateRepo.update(id, { aliyun_score: similarityScore+"" });
          // console.log(`[${asin}] 通过校验，相似度评分：${similarityScore}`);
  
    
        } catch (error: any) {
          // 如果是图片像素不支持错误，直接删除该条数据
          if (error.message && error.message.includes('UnsupportedPicPixels')) {
            console.warn(`第${i+1}条[${asin}] 图片像素不支持，删除数据：${error.message}`);
            await this.bsrCandidateRepo.delete(id);
            return;
          }
  
          // 单条记录异常仅日志，不中断后续处理
          console.error(`第${i+1}条[${asin}]后台处理失败：`, error.message);
          // 标记为处理失败，并更新状态防止无限重试
          await this.bsrCandidateRepo.update(id, {
            cont_sign: 'ERROR',
            isUpload: '0',
            status: 3 // 显式更新状态为3（或其他非2状态），防止下次被重复扫描
          }).catch(e => {
            console.error(`第${i+1}条[${asin}]状态更新失败：`, e.message);
          });
        }
        console.log(`===== 结束后台处理第${i+1}条：ASIN=${asin} =====`);
      } finally {
        sema.release();
      }
    }));
  
    console.log(`===== 所有记录后台处理完成 =====`);
  }

  
  @Inject()
  ctx;

  async getVisibleBacklogCategories(params: BsrBacklogCategoryParams = {}) {
    return getVisibleBsrBacklogCategoryOptions(this.bsrCandidateRepo, params);
  }

  /**
   * 按 name 分组推导 groupId / isFirst（纯展示用，不落库）
   */
  private deriveGroupIdAndIsFirst(links: any[]): void {
    const seenGroupKey = new Set<string>();
    for (const link of links) {
      const key = link.name || link.id || '';
      link.groupId = key;
      link.isFirst = !seenGroupKey.has(key);
      seenGroupKey.add(key);
    }
  }

  /**
   * 从独立表加载工厂链接与变体，组装成与原有 JSON 相同结构（供 info/listing 使用）
   * groupId / isFirst 由 name 分组推导，不读库
   */
  async loadFactoryLinksAndVariants(candidateId: number): Promise<{ factory_links: any[]; variant_Combination: any[] }> {
    const links = await this.factoryLinkRepo.find({
      where: { candidate_id: candidateId, deleted_at: IsNull() },
      order: { sort_order: 'ASC' },
    });
    const variants = await this.variantRepo.find({
      where: { candidate_id: candidateId, deleted_at: IsNull() },
      order: { sort_order: 'ASC' },
    });
    const linkIdToName: Record<string, string> = {};
    links.forEach(l => { linkIdToName[l.id] = l.name; });
    const factory_links = links.map(l => ({
      id: l.id,
      name: l.name,
      type: l.type,
      price: Number(l.price),
      user_input: l.user_input,
      user_input_description: l.user_input_description,
      productSKU: l.product_sku ?? undefined,
      supplierSKU: l.supplier_sku ?? undefined,
      product_name: l.product_name ?? undefined,
    }));
    this.deriveGroupIdAndIsFirst(factory_links);
    const variant_Combination = variants.map(v => {
      const gp = v.group_proportions || {};
      const selectedGroups = Object.keys(gp).map(linkId => linkIdToName[linkId]).filter(Boolean);
      const groupProportions: Record<string, number> = {};
      Object.entries(gp).forEach(([linkId, proportion]) => {
        const name = linkIdToName[linkId];
        if (name) groupProportions[name] = proportion;
      });
      return {
        id: v.id,
        name: v.name,
        description: v.description ?? '',
        quantity: v.quantity ?? 0,
        sku: v.sku ?? '',
        uk_title: v.uk_title ?? '',
        de_title: v.de_title ?? '',
        image_url: v.image_url ?? null,
        selectedGroups,
        groupProportions,
      };
    });
    return { factory_links, variant_Combination };
  }

  /**
   * 将前端传入的 factory_links / variant_Combination 写入独立表（增/改/软删），并返回组装后的 JSON（写回 candidate 供 list 展示）
   */
  async saveFactoryLinksAndVariants(
    candidateId: number,
    factory_links: any[],
    variant_Combination: any[],
    transactionalEntityManager?: any
  ): Promise<{ factory_links: any[]; variant_Combination: any[] }> {
    const em = transactionalEntityManager || this.bsrCandidateRepo.manager;
    const linkRepo = em.getRepository(AppAmzBsrCandidateFactoryLinkEntity);
    const variantRepoEm = em.getRepository(AppAmzBsrCandidateVariantEntity);
    const now = new Date();

    const paramLinkIds = new Set<string>();
    const linksToSave = (factory_links || []).filter(l => l && typeof l === 'object');
    for (let i = 0; i < linksToSave.length; i++) {
      const l = linksToSave[i];
      const id = l.id || uuid();
      paramLinkIds.add(id);
      const row = {
        id,
        candidate_id: candidateId,
        name: l.name ?? '',
        type: l.type ?? 'main',
        price: l.price ?? 0,
        user_input: l.user_input ?? '',
        user_input_description: l.user_input_description ?? '',
        product_sku: l.productSKU ?? null,
        supplier_sku: l.supplierSKU ?? null,
        product_name: l.product_name ?? null,
        sort_order: i,
        deleted_at: null,
      };
      await linkRepo.save(linkRepo.create(row));
    }
    const existingLinks = await linkRepo.find({ where: { candidate_id: candidateId } });
    for (const l of existingLinks) {
      if (l.deleted_at) continue;
      if (!paramLinkIds.has(l.id)) await linkRepo.update(l.id, { deleted_at: now });
    }

    const nameToLinkId: Record<string, string> = {};
    linksToSave.forEach(l => { if (l.name) nameToLinkId[l.name] = l.id || ''; });
    const paramVariantIds = new Set<string>();
    const variantsToSave = (variant_Combination || []).filter(v => v && typeof v === 'object');
    for (let i = 0; i < variantsToSave.length; i++) {
      const v = variantsToSave[i];
      const id = v.id || uuid();
      paramVariantIds.add(id);
      const rawGroupProportions = v.groupProportions || {};
      const selectedGroups = v.selectedGroups || [];
      const groupProportionsById = Object.entries(rawGroupProportions).reduce(
        (acc: Record<string, number>, [name, value]) => {
          const linkId = nameToLinkId[name];
          if (linkId) acc[linkId] = typeof value === 'number' && value > 0 ? value : Number(value) || 1;
          return acc;
        },
        {},
      );
      // 选了品名但没填比例的，默认 1，避免只选不填导致存成空
      selectedGroups.forEach((name: string) => {
        const linkId = nameToLinkId[name];
        if (linkId && groupProportionsById[linkId] == null) groupProportionsById[linkId] = 1;
      });
      await variantRepoEm.save(variantRepoEm.create({
        id,
        candidate_id: candidateId,
        name: v.name ?? '',
        description: v.description ?? '',
        quantity: Number(v.quantity) || 0,
        group_proportions: groupProportionsById,
        uk_title: v.uk_title ?? null, // 英国标题
        de_title: v.de_title ?? null, // 德国标题
        image_url: v.image_url ?? null, // 变体图片
        sort_order: i,
        deleted_at: null,
      }));
    }
    const existingVariants = await variantRepoEm.find({ where: { candidate_id: candidateId } });
    for (const v of existingVariants) {
      if (v.deleted_at) continue;
      if (!paramVariantIds.has(v.id)) await variantRepoEm.update(v.id, { deleted_at: now });
    }

    const assembledLinks = linksToSave.map(l => ({
      id: l.id || nameToLinkId[l.name],
      name: l.name,
      type: l.type,
      price: l.price,
      user_input: l.user_input,
      user_input_description: l.user_input_description,
      productSKU: l.productSKU,
      supplierSKU: l.supplierSKU,
      product_name: l.product_name,
    }));
    this.deriveGroupIdAndIsFirst(assembledLinks);
    const assembledVariants = variantsToSave.map(v => {
      const selectedGroups = v.selectedGroups || [];
      const raw = v.groupProportions || {};
      const groupProportions: Record<string, number> = { ...raw };
      selectedGroups.forEach((name: string) => {
        if (groupProportions[name] == null || groupProportions[name] <= 0) groupProportions[name] = 1;
      });
      return {
        id: v.id,
        name: v.name,
        description: v.description ?? '',
        quantity: Number(v.quantity) || 0,
        sku: v.sku ?? '',
        uk_title: v.uk_title ?? '',
        de_title: v.de_title ?? '',
        image_url: v.image_url ?? null,
        selectedGroups,
        groupProportions,
      };
    });
    return { factory_links: assembledLinks, variant_Combination: assembledVariants };
  }

  async update(param: any): Promise<void> {
    await this.bsrCandidateRepo.manager.transaction(async transactionalEntityManager => {

      const { id, variant_version, new_variant_version, skipVersionUpdate } = param;
  
      const current = await this.bsrCandidateRepo.findOne({ where: { id } });
      if (variant_version && current.variant_version !== variant_version) {
        throw new Error('当前页面数据已更新，请重新加载页面');
      }
      if (!skipVersionUpdate) {
        param.variant_version = new_variant_version || (current.variant_version || 0) + 1;
      }

      if (param.factory_links != null || param.variant_Combination != null) {
        const { factory_links: fl, variant_Combination: vc } = await this.saveFactoryLinksAndVariants(
          id,
          param.factory_links || [],
          param.variant_Combination || [],
          transactionalEntityManager
        );
        param.factory_links = fl;
        param.variant_Combination = vc;
      }

      await transactionalEntityManager.save(
        this.bsrCandidateRepo.create(param)
      );

      const candidate = await transactionalEntityManager.findOne(AppAmzBsrCandidateEntity, {
        where: { id: param.id },
        select: ['max_purchase']
      });

      if (!candidate) throw new Error(`主记录 ${param.id} 不存在`);

      // 2. 仅当存在采购人数据时处理
      if (param.purchasers) {
        const candidateName = (current && (current as any).produce_name) ? (current as any).produce_name : '';
        // 并行处理每个采购人更新
        await Promise.all(
          param.purchasers.map(async (purchaserItem: any) => {
            // 构造唯一查询条件 (保证数据定位精确)
            const whereCondition = {
              candidate_id: param.id,
              purchaser: purchaserItem.purchaser,
              id: purchaserItem.id,
            };
            console.log(`正在处理采购人数据...`, whereCondition);

            let variantNameForMsku: string | null = null;
            if (purchaserItem.selectedVariantId) {
              const variant = await this.variantRepo.findOne({ where: { id: purchaserItem.selectedVariantId }, select: ['name'] });
              variantNameForMsku = variant?.name ?? purchaserItem.selectedVariant ?? null;
            } else {
              variantNameForMsku = purchaserItem.selectedVariant ?? null;
            }
            let msku: string | undefined;
            if (purchaserItem.is_generate === 2 && purchaserItem.seller_account_id && variantNameForMsku) {
              const admin = (this as any).baseCtx?.admin;
              msku = await this.mskuService.getOrCreateMsku({
                candidate_id: String(param.id),
                candidate_name: candidateName,
                seller_account_id: purchaserItem.seller_account_id,
                account_name: purchaserItem.account_name || '',
                selected_variant: variantNameForMsku,
                selected_variant_id: purchaserItem.selectedVariantId ?? null,
                submitter_user_id: admin?.userId ?? null,
                submitter_name: admin?.username ?? null,
              });
            }

            if ([0, 2, 3].includes(purchaserItem.is_generate)) {
              const updateData: any = {
                purchaserNum: JSON.stringify(purchaserItem.purchaserNum || {}),
                is_generate: purchaserItem.is_generate,
                procurement: purchaserItem.procurement,
                seller_account_id: purchaserItem.seller_account_id,
                account_name: purchaserItem.account_name,
              };
              if (purchaserItem.country_enabled !== undefined) {
                updateData.country_enabled =
                  purchaserItem.country_enabled == null ||
                  typeof purchaserItem.country_enabled === 'string'
                    ? purchaserItem.country_enabled
                    : JSON.stringify(purchaserItem.country_enabled);
              }
              if (purchaserItem.selectedVariantId != null) {
                updateData.selected_variant_id = purchaserItem.selectedVariantId;
                updateData.selectedVariant = variantNameForMsku ?? ''; // 始终用变体 name 回写冗余字段
              } else if (purchaserItem.selectedVariant !== undefined) {
                updateData.selectedVariant = purchaserItem.selectedVariant;
              }
              if (msku != null) updateData.msku = msku;
              const updateResult = await transactionalEntityManager.update(
                AppAmzBsrCandidatePurchaserEntity,
                whereCondition,
                updateData
              );
              console.log(`[${purchaserItem.purchaser}] 局部更新成功，更新数量：`, updateResult.affected);
            }
          })
        );
      }
      const purchaserRecords = await transactionalEntityManager.find(
        AppAmzBsrCandidatePurchaserEntity,
        {
          where: {
            candidate_id: param.id,
            is_generate: 2  // 仅查询待处理的记录
          },
          select: ['purchaserNum']  // 只选择需要的字段
        }
      );

      // 计算所有采购人数值总和
      let totalPurchase = 0;
      purchaserRecords.forEach(record => {
        try {
          // 解析JSON并累加数值
          const nums = record.purchaserNum || {};
          totalPurchase += Object.values(nums)
            .filter((v): v is number => typeof v === 'number')
            .reduce((sum, val) => sum + val, 0);
        } catch (e) {
          console.error('解析purchaserNum失败:', record.purchaserNum);
        }
      });

      // 图需同步不再在此处触发，改为由前端在“做/不做/删除”显式调用
      if (totalPurchase >= candidate.max_purchase) {
        // 批量更新状态为不可做（使用IN条件+索引优化）
        await transactionalEntityManager.update(
          AppAmzBsrCandidatePurchaserEntity,
          {
            candidate_id: param.id,
            is_generate: 1  // 待决策状态
          },
          { is_generate: 3 } // 不可做状态
        );
      } else {
        await transactionalEntityManager.update(
          AppAmzBsrCandidatePurchaserEntity,
          {
            candidate_id: param.id,
            is_generate: 3 // 不可做状态
          },
          { is_generate: 1 }  // 待决策状态
        );
      }

    });
  }

  /**
   * 批量更新采购记录（串行），生成 MSKU，并同步图需
   * @returns designTaskSyncSkipped: true 表示图需任务状态非 101，未做差量同步
   */
  async updatePurchasersAndSync(param: { id: number; purchasers: any[] }): Promise<{
    designTaskSyncSkipped: boolean;
    opportunityReleased: boolean;
    releasedPurchaser?: string;
    releasedCountries?: string[];
  }> {
    const candidateId = param?.id;
    if (!candidateId) {
      return { designTaskSyncSkipped: false, opportunityReleased: false };
    }
    const purchasers = Array.isArray(param.purchasers) ? param.purchasers : [];
    const aiDispatchGroup = new Map<string, Set<string>>();
    const variantToWorkItems = new Map<string, Set<number>>();
    const accountWorkItems = new Map<string, Set<number>>();
    let opportunityReleased = false;
    let releasedPurchaser: string | undefined;
    let releasedCountries: string[] | undefined;
    const decisionAssignedAt = new Date();

    await this.bsrCandidateRepo.manager.transaction(async transactionalEntityManager => {
      const candidate = await transactionalEntityManager.findOne(AppAmzBsrCandidateEntity, {
        where: { id: candidateId },
        select: ['id', 'produce_name'],
      });
      if (!candidate) throw new Error(`主记录 ${candidateId} 不存在`);
      const candidateName = candidate.produce_name ?? '';
      const missingCountries = new Set<string>();

      for (const purchaserItem of purchasers) {
        const whereCondition = {
          candidate_id: candidateId,
          purchaser: purchaserItem.purchaser,
          id: purchaserItem.id,
        };

        let variantNameForMsku: string | null = null;
        if (purchaserItem.selectedVariantId) {
          const variant = await transactionalEntityManager.findOne(AppAmzBsrCandidateVariantEntity, {
            where: { id: purchaserItem.selectedVariantId },
            select: ['name'],
          });
          variantNameForMsku = variant?.name ?? purchaserItem.selectedVariant ?? null;
        } else {
          variantNameForMsku = purchaserItem.selectedVariant ?? null;
        }

        let msku: string | undefined;
        if (purchaserItem.is_generate === 2 && purchaserItem.seller_account_id && variantNameForMsku) {
          const admin = (this as any).baseCtx?.admin;
          msku = await this.mskuService.getOrCreateMsku({
            candidate_id: String(candidateId),
            candidate_name: candidateName,
            seller_account_id: purchaserItem.seller_account_id,
            account_name: purchaserItem.account_name || '',
            selected_variant: variantNameForMsku,
            selected_variant_id: purchaserItem.selectedVariantId ?? null,
            submitter_user_id: admin?.userId ?? null,
            submitter_name: admin?.username ?? null,
          });
          if (msku) purchaserItem.msku = msku;
        }

        const normalizedAccountId = String(purchaserItem.seller_account_id || '').trim();
        const normalizedVariantId = String(purchaserItem.selectedVariantId || '').trim();
        if (Number(purchaserItem.is_generate) === 2) {
          const countryEnabled = this.parseJsonObject(purchaserItem.country_enabled);
          const purchaserNum = this.parseJsonObject(purchaserItem.purchaserNum);
          ['uk', 'de'].forEach(country => {
            if (countryEnabled[country] && !(Number(purchaserNum[country]) > 0)) {
              missingCountries.add(country);
            }
          });
        }
        const decisionStatus = Number(purchaserItem.is_generate);
        if (
          decisionStatus === 2 &&
          normalizedAccountId &&
          normalizedVariantId
        ) {
          if (!aiDispatchGroup.has(normalizedAccountId)) {
            aiDispatchGroup.set(normalizedAccountId, new Set<string>());
          }
          aiDispatchGroup.get(normalizedAccountId)!.add(normalizedVariantId);
        }

        if ([0, 1, 2, 3, 4].includes(decisionStatus)) {
          const updateData: any = {
            ...normalizePurchaserDecisionUpdate(purchaserItem),
            seller_account_id: purchaserItem.seller_account_id,
            account_name: purchaserItem.account_name,
          };
          if (decisionStatus === 1) {
            updateData.decision_assigned_at = decisionAssignedAt;
            updateData.decision_reminded_at = null;
          }
          if (purchaserItem.country_enabled !== undefined) {
            updateData.country_enabled =
              purchaserItem.country_enabled == null ||
              typeof purchaserItem.country_enabled === 'string'
                ? purchaserItem.country_enabled
                : JSON.stringify(purchaserItem.country_enabled);
          }
          if (purchaserItem.selectedVariantId != null) {
            updateData.selected_variant_id = purchaserItem.selectedVariantId;
            updateData.selectedVariant = variantNameForMsku ?? '';
          } else if (purchaserItem.selectedVariant !== undefined) {
            updateData.selectedVariant = purchaserItem.selectedVariant;
          }
          if (msku != null) updateData.msku = msku;

          await transactionalEntityManager.update(
            AppAmzBsrCandidatePurchaserEntity,
            whereCondition,
            updateData
          );
        }
      }

      if (missingCountries.size > 0) {
        const unavailablePurchasers = await transactionalEntityManager
          .getRepository(AppAmzBsrCandidatePurchaserEntity)
          .createQueryBuilder('purchaser')
          .select(['purchaser.id', 'purchaser.purchaser'])
          .where('purchaser.candidate_id = :candidateId', {
            candidateId: String(candidateId),
          })
          .andWhere('purchaser.is_generate = :isGenerate', { isGenerate: 4 })
          .setLock('pessimistic_write')
          .getMany();
        if (unavailablePurchasers.length > 0) {
          const randomIndex = Math.floor(Math.random() * unavailablePurchasers.length);
          const randomPurchaser = unavailablePurchasers[randomIndex];
          releasedCountries = Array.from(missingCountries);
          const releaseResult = await transactionalEntityManager.update(
            AppAmzBsrCandidatePurchaserEntity,
            {
              id: randomPurchaser.id,
              candidate_id: String(candidateId),
              is_generate: 4,
            },
            {
              is_generate: 1,
              reject_reason: '',
              decision_assigned_at: decisionAssignedAt,
              country_enabled: JSON.stringify({
                uk: missingCountries.has('uk'),
                de: missingCountries.has('de'),
              }),
            }
          );
          if (releaseResult.affected) {
            opportunityReleased = true;
            releasedPurchaser = randomPurchaser.purchaser;
          } else {
            releasedCountries = undefined;
          }
        }
      }
    });

    const operatorId = (this as any).baseCtx?.admin?.userId
      ? String((this as any).baseCtx.admin.userId)
      : undefined;
    for (const purchaserItem of purchasers) {
      if (Number(purchaserItem?.is_generate) !== 2) continue;
      const accountId = String(purchaserItem?.seller_account_id || '').trim();
      const variantId = String(purchaserItem?.selectedVariantId || '').trim();
      const msku = String(purchaserItem?.msku || '').trim();
      if (!accountId || !msku) continue;
      const workItem = await this.contentWorkbenchService.upsertFromPurchaserDecision({
        candidate_id: Number(candidateId),
        msku,
        seller_account_id: accountId,
        country_code: 'uk',
        created_by: operatorId,
      });
      if (!workItem) continue;
      if (!accountWorkItems.has(accountId)) accountWorkItems.set(accountId, new Set<number>());
      accountWorkItems.get(accountId)!.add(Number(workItem.id));
      if (variantId) {
        const key = `${accountId}::${variantId}`;
        if (!variantToWorkItems.has(key)) variantToWorkItems.set(key, new Set<number>());
        variantToWorkItems.get(key)!.add(Number(workItem.id));
      }
    }

    for (const [amazonAccountId, variantSet] of aiDispatchGroup.entries()) {
      const variantIds = Array.from(variantSet);
      if (!variantIds.length) continue;
      const effectedWorkItemIds = new Set<number>();
      for (const variantId of variantIds) {
        const key = `${amazonAccountId}::${variantId}`;
        (variantToWorkItems.get(key) || new Set<number>()).forEach(id =>
          effectedWorkItemIds.add(Number(id))
        );
      }
      if (!effectedWorkItemIds.size) {
        (accountWorkItems.get(amazonAccountId) || new Set<number>()).forEach(id =>
          effectedWorkItemIds.add(Number(id))
        );
      }
      const requestedLanguages = resolveDispatchRequestedLanguagesFromPurchaserItems(
        purchasers,
        amazonAccountId,
        variantIds
      );
      const dispatchResult = await this.aiListingTaskService.dispatchByPurchaserDecision({
        candidate_id: Number(candidateId),
        amazon_account_id: amazonAccountId,
        variant_ids: variantIds,
        country_code: 'uk',
        requested_languages: requestedLanguages,
        operator_id: operatorId,
      });
      const dispatchMode = String((dispatchResult as any)?.mode || 'full');
      const taskId = Number((dispatchResult as any)?.taskId || 0);
      const rootTaskId = Number((dispatchResult as any)?.rootTaskId || 0);
      if (taskId) {
        // Delta 仅存链接留痕；工作台 current_ai_task_id 永远指向主任务，避免只看到子集 variant_titles
        const isDelta = dispatchMode === 'delta';
        for (const workItemId of effectedWorkItemIds) {
          if (isDelta && rootTaskId) {
            await this.contentWorkbenchService.bindTaskLink({
              work_item_id: Number(workItemId),
              task_domain: 'ai',
              task_id: taskId,
              relation_type: 'delta',
              set_current: false,
            });
            await this.contentWorkbenchService.bindTaskLink({
              work_item_id: Number(workItemId),
              task_domain: 'ai',
              task_id: rootTaskId,
              relation_type: 'primary',
              set_current: true,
            });
          } else {
            await this.contentWorkbenchService.bindTaskLink({
              work_item_id: Number(workItemId),
              task_domain: 'ai',
              task_id: taskId,
              relation_type: 'primary',
              set_current: true,
            });
          }
        }
      }
    }

    const { skipped } = await this.designTaskService.syncForCandidate(candidateId);

    const submittedConfirmedPurchaserIds = purchasers
      .filter(purchaserItem => Number(purchaserItem?.is_generate) === 2)
      .map(purchaserItem => Number(purchaserItem?.id))
      .filter(id => Number.isFinite(id) && id > 0);

    // 异步创建采购计划（不阻塞主流程），只处理本次点击“做”的采购分配记录
    if (submittedConfirmedPurchaserIds.length > 0) {
      this.createPurchasePlansForCandidate(candidateId, {
        purchaserRecordIds: submittedConfirmedPurchaserIds,
      }).catch(err => {
        console.error('[updatePurchasersAndSync] 采购计划创建失败:', err?.message || err);
      });
    }

    return {
      designTaskSyncSkipped: skipped,
      opportunityReleased,
      releasedPurchaser,
      releasedCountries,
    };
  }

  async autoExpirePendingPurchaserDecisions(now = new Date()): Promise<{
    expiredCount: number;
    releasedCount: number;
    releasedPurchasers: string[];
  }> {
    const releasedPurchasers: string[] = [];
    let expiredCount = 0;
    let releasedCount = 0;

    await this.bsrCandidateRepo.manager.transaction(async transactionalEntityManager => {
      const pendingPurchasers = await transactionalEntityManager.find(
        AppAmzBsrCandidatePurchaserEntity,
        {
          where: { is_generate: 1 as any },
          select: [
            'id',
            'candidate_id',
            'purchaser',
            'country_enabled',
            'decision_assigned_at',
            'createTime',
            'updateTime',
          ] as any,
          order: { decision_assigned_at: 'ASC' as any },
          take: 200,
        }
      );

      for (const pendingPurchaser of pendingPurchasers) {
        const assignedAt =
          (pendingPurchaser as any).decision_assigned_at ||
          (pendingPurchaser as any).updateTime ||
          (pendingPurchaser as any).createTime;

        if (!shouldExpirePendingPurchaser(assignedAt, now)) continue;

        const rejectResult = await transactionalEntityManager.update(
          AppAmzBsrCandidatePurchaserEntity,
          { id: pendingPurchaser.id, is_generate: 1 },
          buildTimedOutPurchaserRejectUpdate()
        );
        if (!rejectResult.affected) continue;

        expiredCount += 1;
        const releaseCandidates = await transactionalEntityManager.find(
          AppAmzBsrCandidatePurchaserEntity,
          {
            where: {
              candidate_id: String(pendingPurchaser.candidate_id),
              is_generate: 4 as any,
            },
            select: ['id', 'candidate_id', 'purchaser'] as any,
            order: { updateTime: 'ASC' as any },
            take: 1,
          }
        );
        const nextPurchaser = releaseCandidates[0];
        if (!nextPurchaser) continue;

        const releaseResult = await transactionalEntityManager.update(
          AppAmzBsrCandidatePurchaserEntity,
          {
            id: nextPurchaser.id,
            candidate_id: String(pendingPurchaser.candidate_id),
            is_generate: 4,
          },
          buildPendingPurchaserReleaseUpdate(pendingPurchaser.country_enabled, now)
        );
        if (!releaseResult.affected) continue;

        releasedCount += 1;
        releasedPurchasers.push(nextPurchaser.purchaser);
      }
    });

    return {
      expiredCount,
      releasedCount,
      releasedPurchasers,
    };
  }

  async runPurchaserDecisionTimeoutWorkflow(now = new Date()): Promise<{
    remindedCount: number;
    skippedReminderCount: number;
    expiredCount: number;
    releasedCount: number;
    releasedPurchasers: string[];
  }> {
    const reminderResult = await this.autoRemindPendingPurchaserDecisions(now);
    const timeoutResult = await this.autoExpirePendingPurchaserDecisions(now);
    return {
      remindedCount: reminderResult.remindedCount,
      skippedReminderCount: reminderResult.skippedCount,
      expiredCount: timeoutResult.expiredCount,
      releasedCount: timeoutResult.releasedCount,
      releasedPurchasers: timeoutResult.releasedPurchasers,
    };
  }

  private getPurchaserAssignedAt(purchaser: any): Date | string | null | undefined {
    return purchaser?.decision_assigned_at || purchaser?.updateTime || purchaser?.createTime;
  }

  private async loadPendingPurchaserReminderUsers(rows: any[]) {
    const userIds = Array.from(
      new Set(
        rows
          .map(row => Number(String(row?.userId || '').trim()))
          .filter(id => id > 0)
      )
    );
    const names = Array.from(
      new Set(
        rows
          .map(row => String(row?.purchaser || '').trim())
          .filter(Boolean)
      )
    );
    const usersById = new Map<number, Pick<BaseSysUserEntity, 'id' | 'name' | 'phone'>>();
    const usersByName = new Map<string, Pick<BaseSysUserEntity, 'id' | 'name' | 'phone'>>();

    if (userIds.length) {
      const users = await this.baseSysUserRepo.find({
        where: { id: In(userIds), status: 1 } as any,
        select: ['id', 'name', 'phone'],
      });
      users.forEach(user => usersById.set(Number(user.id), user));
    }

    if (names.length) {
      const users = await this.baseSysUserRepo.find({
        where: { name: In(names), status: 1 } as any,
        select: ['id', 'name', 'phone'],
      });
      users.forEach(user => {
        const name = String(user.name || '').trim();
        if (name && !usersByName.has(name)) usersByName.set(name, user);
      });
    }

    return { usersById, usersByName };
  }

  private buildPendingPurchaserReminderMessage(row: any) {
    const purchaser = String(row?.purchaser || '采购同事').trim() || '采购同事';
    const candidateId = String(row?.candidate_id || '').trim();
    return {
      title: '选品待决策提醒',
      markdownText:
        `### 选品待决策提醒\n\n` +
        `${purchaser}，你有一条采购分配仍处于待决策状态，已进入自动流转前最后一个工作日。\n\n` +
        `- 选品ID：${candidateId || '-'}\n` +
        `- 处理要求：请尽快在 candidate3 页面选择“做”或“不做”\n` +
        `- 逾期结果：超过2个工作日未处理，系统会自动改为“不做”并流转给其他人`,
    };
  }

  async autoRemindPendingPurchaserDecisions(now = new Date()): Promise<{
    remindedCount: number;
    skippedCount: number;
  }> {
    const pendingPurchasers = await this.appAmzBsrCandidatePurchaserEntity.find({
      where: {
        is_generate: 1 as any,
        decision_reminded_at: IsNull() as any,
      },
      select: [
        'id',
        'candidate_id',
        'purchaser',
        'userId',
        'decision_assigned_at',
        'decision_reminded_at',
        'createTime',
        'updateTime',
      ] as any,
      order: { decision_assigned_at: 'ASC' as any },
      take: 200,
    });

    const rowsToRemind = pendingPurchasers.filter(row =>
      shouldRemindPendingPurchaser({
        assignedAt: this.getPurchaserAssignedAt(row),
        remindedAt: (row as any).decision_reminded_at,
        now,
      })
    );
    if (!rowsToRemind.length) {
      return { remindedCount: 0, skippedCount: 0 };
    }

    const { usersById, usersByName } = await this.loadPendingPurchaserReminderUsers(rowsToRemind);
    let remindedCount = 0;
    let skippedCount = 0;

    for (const row of rowsToRemind) {
      const purchaserName = String(row?.purchaser || '').trim();
      const userId = Number(String(row?.userId || '').trim());
      const user =
        (userId > 0 ? usersById.get(userId) : undefined) ||
        (purchaserName ? usersByName.get(purchaserName) : undefined);
      const phone = String(user?.phone || '').trim();
      if (!phone) {
        skippedCount += 1;
        ((this as any).logger?.warn || console.warn)('[采购待决策提醒] 用户未填写手机号，跳过钉钉提醒', {
          purchaser: purchaserName,
          userId: row?.userId,
          candidateId: row?.candidate_id,
        });
        continue;
      }

      let dingUserId: string | null = null;
      try {
        dingUserId = await this.dingTalkNotifyService.getUserIdByMobile(phone);
      } catch (err) {
        skippedCount += 1;
        ((this as any).logger?.warn || console.warn)('[采购待决策提醒] 手机号解析钉钉 userid 失败', {
          purchaser: purchaserName,
          phone,
          message: err?.message || err,
        });
        continue;
      }

      if (!dingUserId) {
        skippedCount += 1;
        ((this as any).logger?.warn || console.warn)('[采购待决策提醒] 手机号未匹配到钉钉 userid', {
          purchaser: purchaserName,
          phone,
        });
        continue;
      }

      try {
        const message = this.buildPendingPurchaserReminderMessage(row);
        const taskId = await this.dingTalkNotifyService.sendWorkNotice({
          userIds: [dingUserId],
          title: message.title,
          markdownText: message.markdownText,
        });
        if (!taskId) {
          skippedCount += 1;
          continue;
        }

        await this.appAmzBsrCandidatePurchaserEntity.update(
          { id: row.id, is_generate: 1 },
          { decision_reminded_at: now } as any
        );
        remindedCount += 1;
      } catch (err) {
        skippedCount += 1;
        ((this as any).logger?.error || console.error)('[采购待决策提醒] 发送钉钉提醒失败', {
          purchaser: purchaserName,
          candidateId: row?.candidate_id,
          message: err?.message || err,
        });
      }
    }

    return { remindedCount, skippedCount };
  }


  async synLingxingID(users: { id: string, name: string }[]): Promise<void> {
    // 获取接口数据，返回领星中的用户数据
    const response = await this.lingXingUtils.httpPost('/erp/sc/data/account/lists', {});
  
    // 打印接口返回数据
    console.log('接口返回数据:', response);
  
    // 将接口返回的数据映射为 realname -> uid 的映射
    const userMap = response.reduce((map: Record<string, string>, user: any) => {
      map[user.realname] = user.uid; 
      return map;
    }, {});
  
    // 对比传入的用户列表，查找匹配的用户并获取其对应的 uid
    const matchedUids = users
      .map(user => {
        const uid = userMap[user.name]; // 根据用户的 name 匹配 uid
        return uid ? { userId: user.id, lingxingUID: uid } : null;
      })
      .filter(item => item !== null); // 筛选出匹配成功的项
  
    // 如果找到了匹配的用户ID，则执行更新操作
    if (matchedUids.length > 0) {
      await this.updateUserLingxingID(matchedUids);
      console.log('用户更新成功');
    } else {
      console.log('没有匹配的用户数据');
    }
  }
  
  async updateUserLingxingID(matchedUids: { userId: string, lingxingUID: string }[]): Promise<void> {
    // 开启事务处理
    await this.baseSysUserRepo.manager.transaction(async transactionalEntityManager => {
      // 1. 批量查询现有用户记录
      const existingUsers = await transactionalEntityManager.find(BaseSysUserEntity, {
        where: { id: In(matchedUids.map(item => item.userId)) } // 查找需要更新的用户
      });
  
      // 2. 构建存在性检查Map
      const existingMap = new Map<string, BaseSysUserEntity>();
      existingUsers.forEach(user => {
        existingMap.set(user.id + "", user); // 确保 id 是 string 类型
      });
  
      // 3. 更新用户的 lingxingID 字段
      const updatePromises = matchedUids.map(({ userId, lingxingUID }) => {
        const user = existingMap.get(userId+"");
        if (user) {
          user.lingxingID = lingxingUID; // 更新 lingxingID 为领星中的 uid
          return transactionalEntityManager.save(BaseSysUserEntity, user); // 更新实体
        }
        return null;
      });
  
      // 批量执行所有的更新操作
      await Promise.all(updatePromises);
    });
  }
  
  
  
  

  
  
  async getforeign_exchange() {
    const date = dayjs().format('YYYY-MM');
    if (!date) {
      throw new Error('Date is undefined');
    }
    let data = await this.lingXingUtils.httpPost('/erp/sc/routing/finance/currency/currencyMonth', { date: date });
    if (!Array.isArray(data)) {
      throw new CoolCommException('获取汇率失败');
    }

    // 解析数据并存储到数据库
    for (let item of data) {
      let existingRecord = await this.appAmzFXEntity.findOne({ where: { currencyName: item.name } });
      if (existingRecord) {
        // 如果记录已存在，更新数据
        existingRecord.icon = item.icon || '';
        existingRecord.currencyName = item.name || '';
        existingRecord.rate_org = item.rate_org || 0;
        await this.appAmzFXEntity.save(existingRecord);
      } else {
        // 如果记录不存在，创建新记录
        let newRecord = new AppAmzFXEntity();
        newRecord.date = item.date || '';
        newRecord.icon = item.icon || '';
        newRecord.currencyName = item.name || '';
        newRecord.rate_org = item.rate_org || 0;
        await this.appAmzFXEntity.save(newRecord);
      }
    }
    return 'ok';
  }
  async set_foreign_exchange() {
    const candidates = await this.bsrCandidateRepo.find({
      where: [
        { status: 3 },
        { status: 4 },
        { status: 6 }
      ],
      select: ['id', 'marketplace']
    });
    for (const candidate of candidates) {
      // 根据 marketplace 获取对应的汇率
      let currencyName = appConfig.CURRENCY_CODE[candidate.marketplace]?.code || ''; 
      let rate_org = await this.getExchangeRateByCountry(currencyName);
      // 更新 candidate 的汇率
      await this.bsrCandidateRepo.update(candidate.id, { exchange_rate: rate_org });
    }
  }


  async getExchangeRateByCountry(currencyName: string): Promise<number | undefined> {
    const fxEntity = await this.appAmzFXEntity.findOne({ where: { currencyName } });
    return fxEntity ? fxEntity.rate_org : undefined;
  }



  /**
   * 根据 plan_sn 列表查询关联的采购单状态
   */
  async getOrderStatusByPlanSns(planSns: string[]): Promise<Record<string, any[]>> {
    if (!planSns.length) return {};

    // 查采购单子项，获取关联的 order_sn
    const items = await this.orderItemRepo.find({
      where: { plan_sn: In(planSns) },
      select: ['plan_sn', 'order_sn'],
    });

    const orderSnSet = new Set(items.map(i => i.order_sn).filter(Boolean));
    if (!orderSnSet.size) return {};

    // 查采购单主表，获取状态信息
    const orders = await this.orderRepo.find({
      where: { order_sn: In(Array.from(orderSnSet)) },
      select: ['order_sn', 'status', 'status_text', 'status_shipped', 'status_shipped_text'],
    });
    const orderMap = new Map(orders.map(o => [o.order_sn, o]));

    // 查物流动态表
    const logisticsRecords = await this.orderLogisticsRepo.find({
      where: { order_sn: In(Array.from(orderSnSet)) },
      select: ['order_sn', 'logistics_order_no', 'logistics_company', 'status', 'status_text', 'sign_time'],
    });
    const logisticsMap = new Map<string, any[]>();
    for (const l of logisticsRecords) {
      if (!logisticsMap.has(l.order_sn)) logisticsMap.set(l.order_sn, []);
      logisticsMap.get(l.order_sn)!.push({
        logistics_order_no: l.logistics_order_no,
        logistics_company: l.logistics_company,
        logistics_status: l.status,
        logistics_status_text: l.status_text,
        sign_time: l.sign_time,
      });
    }

    // 按 plan_sn 分组
    const result: Record<string, any[]> = {};
    for (const item of items) {
      const order = orderMap.get(item.order_sn);
      if (!order) continue;
      if (!result[item.plan_sn]) result[item.plan_sn] = [];
      result[item.plan_sn].push({
        order_sn: order.order_sn,
        status: order.status,
        status_text: order.status_text,
        status_shipped: order.status_shipped,
        status_shipped_text: order.status_shipped_text,
        logistics: logisticsMap.get(order.order_sn) || [],
      });
    }
    return result;
  }

  /**
   * 为选品创建采购计划（常规 + 样品），写入中间表
   */
  async createPurchasePlansForCandidate(
    candidateId: number,
    options: { purchaserRecordIds?: Array<number | string> } = {}
  ): Promise<{ plans: any[] }> {
    const admin = (this.baseCtx as any)?.admin || {};
    const operatorId = Number(admin.userId) || 0;
    const operatorName = admin.username || '';
    let operatorLingxingId = '';
    try {
      const user = await this.baseSysUserRepo.findOne({ where: { id: operatorId }, select: ['lingxingID'] });
      operatorLingxingId = user?.lingxingID || '';
    } catch {}

    const candidate = await this.bsrCandidateRepo.findOne({ where: { id: candidateId } });
    if (!candidate) throw new Error("选品 " + candidateId + " 不存在");

    const existingPlans = await this.candidatePurchasePlanRepo.find({
      where: { candidate_id: candidateId },
      select: ['type', 'lingxing_sku', 'store_id', 'purchaser_record_id', 'plan_sn'],
    });

    // 读取 is_generate=2 的采购记录
    const hasPurchaserRecordIdFilter = Array.isArray(options.purchaserRecordIds);
    const purchaserRecordIds = (options.purchaserRecordIds || [])
      .map(id => Number(id))
      .filter(id => Number.isFinite(id) && id > 0);
    if (hasPurchaserRecordIdFilter && purchaserRecordIds.length === 0) {
      return { plans: [] };
    }
    const purchaserWhere: any = { candidate_id: String(candidateId), is_generate: 2 as any };
    if (purchaserRecordIds.length > 0) {
      purchaserWhere.id = In(purchaserRecordIds);
    }
    const purchasers = await this.appAmzBsrCandidatePurchaserEntity.find({
      where: purchaserWhere,
    });

    // 从变体表获取变体名称 + SKU
    const variantIds = purchasers.map(p => p.selected_variant_id).filter(Boolean);
    let variantRows = variantIds.length > 0
      ? await this.variantRepo.find({ where: { id: In(variantIds) } })
      : [];
    let variantMap = new Map(variantRows.map(v => [String(v.id), v]));

    // 加载工厂链接数据，用于确保领星产品有正确的品名和供应商
    let factoryLinkMap = new Map<string, CandidateFactoryLinkLookupValue>(); // linkId/name → supplier link info
    let produceNameIdValue = 2000;
    const loadFactoryLinkContext = async () => {
      const { factory_links: allFactoryLinks } = await this.loadFactoryLinksAndVariants(candidateId);
      factoryLinkMap = new Map<string, CandidateFactoryLinkLookupValue>();
      for (const link of allFactoryLinks) {
        if (link.supplierSKU) {
          const linkInfo: CandidateFactoryLinkInfo = {
            id: link.id,
            name: link.name,
            supplierSKU: link.supplierSKU,
            user_input: link.user_input,
            price: link.price,
            isFirst: link.isFirst,
          };
          factoryLinkMap.set(link.id, linkInfo);
          const nameKey = String(link.name || '').trim();
          if (nameKey) {
            const lookupKey = `name:${nameKey}`;
            const existing = factoryLinkMap.get(lookupKey);
            const existingLinks = Array.isArray(existing)
              ? existing
              : existing
                ? [existing]
                : [];
            factoryLinkMap.set(lookupKey, [...existingLinks, linkInfo]);
          }
        }
      }
      return allFactoryLinks;
    };

    try {
      let allFactoryLinks = await loadFactoryLinkContext();
      const produceNameIdParam = await this.baseSysParamRepo.findOne({ where: { keyName: 'produce_name_id' } });
      if (produceNameIdParam?.data) produceNameIdValue = parseInt(produceNameIdParam.data, 10) || 2000;
      const selectedVariantIdSet = new Set(variantIds.map(id => String(id)));
      const missingVariantSku = variantRows.some(v => !v.sku);
      const { variant_Combination } = await this.loadFactoryLinksAndVariants(candidateId);
      const selectedVariantIndexes: number[] = [];
      const selectedFactoryLinkNames = new Set<string>();
      (variant_Combination || []).forEach((variant: any, index: number) => {
        if (!selectedVariantIdSet.has(String(variant.id))) return;
        selectedVariantIndexes.push(index);
        (variant.selectedGroups || []).forEach((name: string) => {
          if (name) selectedFactoryLinkNames.add(String(name));
        });
      });
      const relevantFactoryLinks = selectedFactoryLinkNames.size > 0
        ? allFactoryLinks.filter(link => selectedFactoryLinkNames.has(String(link.name || '')))
        : allFactoryLinks;
      const missingSupplierSku = relevantFactoryLinks.some(link => !link.supplierSKU);
      if (operatorLingxingId && selectedVariantIdSet.size > 0 && (missingVariantSku || missingSupplierSku)) {
        if (selectedVariantIndexes.length > 0) {
          console.log('[createPurchasePlansForCandidate] 创建采购计划前补齐SKU/供应商:', JSON.stringify({
            selectedVariantIndexes,
            missingVariantSku,
            missingSupplierSku,
            selectedFactoryLinkNames: Array.from(selectedFactoryLinkNames),
          }));
          await this.createLocalSKU({
            id: candidateId,
            selectedVariantIndexes,
            lingxingID: operatorLingxingId,
          });
          variantRows = variantIds.length > 0
            ? await this.variantRepo.find({ where: { id: In(variantIds) } })
            : [];
          variantMap = new Map(variantRows.map(v => [String(v.id), v]));
          await loadFactoryLinkContext();
        }
      }
    } catch (e) {
      console.warn('[createPurchasePlansForCandidate] 加载工厂链接失败:', e?.message || e);
    }

    const candidateSize = await this.commonRepo.findOne({ where: { candidate_id: candidateId } });
    const productSetSizeFields = buildCandidateProductSetSizeFields(candidateSize);

    // 同步产品信息到领星（确保品名和供应商正确）
    const syncProductToLingxing = async (sku: string, variantName: string, groupProportions: unknown) => {
      if (!sku) throw new Error('缺少领星SKU，无法同步产品供应商');
      const productName = `${produceNameIdValue}_${candidate.produce_name}_${variantName}`;
      const supplierQuotes = buildCandidatePlanSupplierQuotes(groupProportions, factoryLinkMap);
      if (supplierQuotes.length === 0) {
        let groupKeys: string[] = [];
        let parsedGroupProportions = groupProportions;
        for (let index = 0; index < 2 && typeof parsedGroupProportions === 'string'; index++) {
          try {
            parsedGroupProportions = JSON.parse(parsedGroupProportions);
          } catch {
            parsedGroupProportions = null;
            break;
          }
        }
        if (
          parsedGroupProportions &&
          typeof parsedGroupProportions === 'object' &&
          !Array.isArray(parsedGroupProportions)
        ) {
          groupKeys = Object.keys(parsedGroupProportions);
        }
        console.warn('[createPurchasePlansForCandidate] 供应商报价为空:', JSON.stringify({
          sku,
          variantName,
          groupKeys,
          factoryLinkKeys: Array.from(factoryLinkMap.keys()).slice(0, 50),
        }));
      }
      // 同步供应商名称（与品名一致）
      for (const sq of supplierQuotes) {
        try {
          const supplierEditRes = await this.lingXingUtils.httpPost('/erp/sc/routing/storage/supplier/edit', {
            supplier_id: sq.supplier_id,
            supplier_name: productName,
            contact_person: '',
            contact_number: '',
            settlement_method: 7,
          });
          const erpSupplierId = extractCandidateErpSupplierId(supplierEditRes);
          if (erpSupplierId) sq.erp_supplier_id = erpSupplierId;
        } catch (e: any) {
          console.warn('[createPurchasePlansForCandidate] 供应商同步失败，继续创建采购计划:', JSON.stringify({
            sku,
            supplier_id: sq.supplier_id,
            error: e?.message || String(e),
          }));
        }
      }
      const clearGroupList = shouldClearLingxingGroupList(groupProportions);
      try {
        const productSetRes = await this.lingXingUtils.httpPost('/erp/sc/routing/storage/product/set', {
            sku,
            product_name: productName,
            ...productSetSizeFields,
            ...(clearGroupList ? { group_list: [] } : {}),
            ...(supplierQuotes.length > 0 ? { supplier_quote: supplierQuotes } : {}),
          },
          true
        );
        const productSetOk = productSetRes?.code === 0 || productSetRes?.code === '0' || productSetRes?.message === 'success';
        if (!productSetOk) {
          const detail = Array.isArray(productSetRes?.error_details)
            ? productSetRes.error_details.join('; ')
            : productSetRes?.error_details;
          console.warn('[createPurchasePlansForCandidate] 产品供应商同步失败，继续创建采购计划:', JSON.stringify({
            sku,
            message: productSetRes?.message || detail || '',
          }));
        }
      } catch (e: any) {
        console.warn('[createPurchasePlansForCandidate] 产品供应商同步失败，继续创建采购计划:', JSON.stringify({
          sku,
          message: e?.message || String(e),
        }));
      }
      console.log(`[createPurchasePlansForCandidate] 同步产品到领星: sku=${sku}, name=${productName}, suppliers=${supplierQuotes.length}, clearGroupList=${clearGroupList}`);
      return supplierQuotes;
    };

    const plans: any[] = [];
    const errors: any[] = [];

    const regularSources = buildCandidateRegularPurchasePlanSources(
      purchasers,
      variantMap,
      candidate.sku
    );

    // 逐个采购分配记录创建常规采购计划
    for (const source of regularSources) {
      const {
        purchaserRecordId,
        storeId,
        accountName,
        lingxingSku,
        variantName,
        ukNum,
        deNum,
        totalQty,
        groupProportions,
      } = source;

      if (!lingxingSku || totalQty <= 0) {
        console.log('[createPurchasePlansForCandidate] 跳过: sku=' + lingxingSku + ', qty=' + totalQty + ', purchaserRecordId=' + purchaserRecordId);
        continue;
      }

      if (hasExistingCandidatePurchasePlan(existingPlans, {
        type: 1,
        lingxing_sku: lingxingSku,
        store_id: storeId,
        purchaser_record_id: purchaserRecordId,
      })) {
        console.log(`[createPurchasePlansForCandidate] 常规采购计划已存在，跳过: sku=${lingxingSku}, store=${storeId}, purchaserRecordId=${purchaserRecordId}`);
        continue;
      }

      const remark = candidate.produce_name + '_' + variantName + '_' + accountName + '_英国:' + ukNum + '_德国:' + deNum;

      try {
        // 确保领星产品有正确的品名和供应商；失败则不创建采购计划
        const supplierQuotes = await syncProductToLingxing(lingxingSku, variantName, groupProportions);
        const purchasePlanItem = buildCandidatePurchasePlanApiItem({
          sku: lingxingSku,
          quantity_plan: totalQty,
          cg_uid: operatorLingxingId,
          remark,
          supplierQuotes,
        });
        console.log('[createPurchasePlansForCandidate] 常规采购计划请求:', JSON.stringify(purchasePlanItem));

        // 直接调领星创建采购计划
        const rawRes = await this.lingXingUtils.httpPost(
          '/erp/sc/routing/data/local_inventory/createPurchasePlan',
          {
            data: [purchasePlanItem]
          },
          true
        );
        console.log('[createPurchasePlansForCandidate] 采购计划原始响应:', JSON.stringify(rawRes));

        const { ppg_sn: ppgSn, plan_sn: planSn } = parseCandidateCreatePurchasePlanResponse(rawRes);

        await this.candidatePurchasePlanRepo.save({
          candidate_id: candidateId,
          asin: candidate.asin,
          marketplace: candidate.marketplace,
          sku: candidate.sku,
          lingxing_sku: lingxingSku,
          store_id: storeId,
          purchaser_record_id: Number(purchaserRecordId) || null,
          account_name: accountName,
          ppg_sn: ppgSn,
          plan_sn: planSn,
          type: 1,
          quantity_plan: totalQty,
          remark,
          operator_id: operatorId,
          operator_name: operatorName,
          operator_lingxing_id: operatorLingxingId,
        });

        existingPlans.push({
          type: 1,
          lingxing_sku: lingxingSku,
          store_id: storeId,
          purchaser_record_id: purchaserRecordId,
          plan_sn: planSn,
        } as any);
        plans.push({ type: 1, sku: candidate.sku, lingxing_sku: lingxingSku, quantity_plan: totalQty, ppg_sn: ppgSn, plan_sn: planSn, purchaser_record_id: purchaserRecordId });
        console.log('[createPurchasePlansForCandidate] 常规采购计划已写入中间表');
      } catch (e: any) {
        console.error('[createPurchasePlansForCandidate] 常规采购计划失败:', e?.message || e);
        errors.push({ type: 1, sku: lingxingSku, store_id: storeId, purchaser_record_id: purchaserRecordId, error: e?.message || String(e) });
      }
    }

    const regularErrors = errors.filter(error => Number(error.type) === 1);
    if (regularErrors.length > 0) {
      console.warn('[createPurchasePlansForCandidate] 常规采购计划存在失败项，继续创建样品计划:', regularErrors.map(e => e.error).join('; '));
    }

    // 样品采购计划（每个唯一领星SKU一个样品，quantity_plan=1）
    const sampleSources = buildCandidateSamplePurchasePlanSources(
      purchasers,
      variantMap,
      candidate.sku
    );

    const sampleAccountName = purchasers[0]?.account_name || '';
    for (const variantInfo of sampleSources) {
      if (hasExistingCandidatePurchasePlan(existingPlans, {
        type: 2,
        lingxing_sku: variantInfo.lingxingSku,
        store_id: '',
      })) {
        console.log(`[createPurchasePlansForCandidate] 样品采购计划已存在，跳过: sku=${variantInfo.lingxingSku}`);
        continue;
      }

      try {
        // 确保领星产品有正确的品名和供应商；失败则不创建采购计划
        const sampleVariantRow = variantMap.get(variantInfo.variantId);
        const supplierQuotes = await syncProductToLingxing(variantInfo.lingxingSku, variantInfo.variantName, sampleVariantRow?.group_proportions || null);
        const purchasePlanItem = buildCandidatePurchasePlanApiItem({
          sku: variantInfo.lingxingSku,
          quantity_plan: 1,
          cg_uid: operatorLingxingId,
          remark: '长沙样品',
          supplierQuotes,
        });
        console.log('[createPurchasePlansForCandidate] 样品采购计划请求:', JSON.stringify(purchasePlanItem));

        const rawRes = await this.lingXingUtils.httpPost(
          '/erp/sc/routing/data/local_inventory/createPurchasePlan',
          {
            data: [purchasePlanItem]
          },
          true
        );
        console.log('[createPurchasePlansForCandidate] 样品采购原始响应:', JSON.stringify(rawRes));

        const { ppg_sn: ppgSn, plan_sn: planSn } = parseCandidateCreatePurchasePlanResponse(rawRes);

        await this.candidatePurchasePlanRepo.save({
          candidate_id: candidateId,
          asin: candidate.asin,
          marketplace: candidate.marketplace,
          sku: candidate.sku,
          lingxing_sku: variantInfo.lingxingSku,
          store_id: '',
          account_name: sampleAccountName,
          ppg_sn: ppgSn,
          plan_sn: planSn,
          type: 2,
          quantity_plan: 1,
          remark: '长沙样品',
          operator_id: operatorId,
          operator_name: operatorName,
          operator_lingxing_id: operatorLingxingId,
        });

        existingPlans.push({
          type: 2,
          lingxing_sku: variantInfo.lingxingSku,
          store_id: '',
          plan_sn: planSn,
        } as any);
        plans.push({ type: 2, sku: candidate.sku, lingxing_sku: variantInfo.lingxingSku, quantity_plan: 1, ppg_sn: ppgSn, plan_sn: planSn });
        console.log('[createPurchasePlansForCandidate] 样品采购计划已写入中间表, 变体: ' + variantInfo.variantName + ', id: ' + variantInfo.variantId);
      } catch (e: any) {
        console.error('[createPurchasePlansForCandidate] 样品采购计划失败:', e?.message || e);
        errors.push({ type: 2, sku: variantInfo.lingxingSku, error: e?.message || String(e) });
      }
    }

    if (errors.length > 0 && plans.length === 0) {
      throw new Error('所有采购计划创建失败: ' + errors.map(e => e.error).join('; '));
    }

    return { plans };
  }

  async addproduct(id: number) {
    try {
      // 获取商品信息
      const product = await this.bsrCandidateRepo.findOne({ where: { id } });
      if (!product) throw new Error(`未找到ID为${id}的商品`);
  
      // 获取采购者信息
      const purchasers = await this.appAmzBsrCandidatePurchaserEntity.find({
        where: { candidate_id: product.id + "" }
      });
  
      // 按项目组分组采购者
      const groupMap = new Map<string, any[]>();
      
      for (const purchaser of purchasers) {
        // 获取采购人对应的用户信息（包含accountName）
        const user = await this.baseSysUserRepo.findOne({ 
          where: { name: purchaser.purchaser },
          select: ['projectTeam', 'accountName'] // 添加accountName字段
        });
        
        const projectTeam = user?.projectTeam || '未知';
        let groupKey;
        if (projectTeam === '思觉' || projectTeam === '润芸') {
          groupKey = projectTeam;
        } else {
          groupKey = '自有,花烛';
        }
        
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, []);
        }
        groupMap.get(groupKey)!.push({
          ...purchaser,
          accountName: user?.accountName || '未知店铺' // 添加店铺名称
        });
      }
  
      // 处理每组并调用接口
      const results = [];
      
      for (const [groupName, groupPurchasers] of groupMap) {
        // 按变体SKU分组计算采购量
        const variantMap = new Map<string, {
          total: number;
          uk: number;
          de: number;
          variantName: string;
          accountName: string;
        }>();
        
        for (const p of groupPurchasers) {
          try {
            // 解析采购数量
            let nums = {};
            if (typeof p.purchaserNum === 'string') {
              try {
                nums = JSON.parse(p.purchaserNum);
              } catch (parseError) {
                const fixedStr = p.purchaserNum
                  .replace(/(\w+):/g, '"$1":') 
                  .replace(/'/g, '"');
                nums = JSON.parse(fixedStr);
              }
            } else if (typeof p.purchaserNum === 'object') {
              nums = p.purchaserNum;
            }
            
            // 提取英国和德国数量
            const ukNum = Number(nums['uk']) || 0;
            const deNum = Number(nums['de']) || 0;
            const purchaserTotal = ukNum + deNum;
            
            // 确定使用的SKU（优先变体SKU）；优先用 selected_variant_id 匹配，其次 selectedVariant(name)
            let targetSku = product.sku;
            let variantName = p.selectedVariant || '默认';
            let variantCombinations: any[] = [];
            try {
              variantCombinations = typeof product.variant_Combination === 'string'
                ? JSON.parse(product.variant_Combination)
                : product.variant_Combination || [];
            } catch (e) {
              console.error('解析变体组合失败', e);
            }
            const matchedVariant = variantCombinations.find(
              (v: any) => (p.selected_variant_id && v.id === p.selected_variant_id) || v.name === p.selectedVariant
            );
            if (matchedVariant) {
              variantName = matchedVariant.name || variantName;
              if (matchedVariant.sku) targetSku = matchedVariant.sku;
            }
            
            // 初始化或更新变体数据
            if (!variantMap.has(targetSku)) {
              variantMap.set(targetSku, {
                total: 0,
                uk: 0,
                de: 0,
                variantName,
                accountName: p.accountName // 使用采购人的店铺名称
              });
            }
            
            const variantData = variantMap.get(targetSku)!;
            variantData.total += purchaserTotal;
            variantData.uk += ukNum;
            variantData.de += deNum;
            
          } catch (e) {
            console.error('处理采购者失败:', p.id, e);
          }
        }
  
        // 为每个变体SKU创建采购计划
        for (const [sku, variantData] of variantMap) {
          if (variantData.total > 0) {
            // 组装remark字段
            const remark = `${product.produce_name}_${variantData.variantName}_${variantData.accountName}_英国:${variantData.uk}_德国:${variantData.de}`;
            
            const payload = {
              data: [{
                sku,
                quantity_plan: variantData.total,
                remark: remark // 使用新组装的remark
              }]
            };
            
            console.log('采购计划:', payload);
            const result = await this.lingXingUtils.httpPost(
              '/erp/sc/routing/data/local_inventory/createPurchasePlan',
              payload,
              true
            );
            console.log('[addproduct] 采购计划响应:', JSON.stringify(result));
            
            results.push({
              group: groupName,
              sku,
              quantity: variantData.total,
              uk: variantData.uk,
              de: variantData.de,
              remark
            });
          }
        }
      }
      
      // 生成样品采购单（数量固定为1，备注"长沙样品"）
      if (product.sku) {
        const samplePayload = {
          data: [{
            sku: product.sku,
            quantity_plan: 1,
            remark: '长沙样品'
          }]
        };
        console.log('样品采购计划:', samplePayload);
        const sampleRes = await this.lingXingUtils.httpPost(
          '/erp/sc/routing/data/local_inventory/createPurchasePlan',
          samplePayload,
          true
        );
        console.log('[addproduct] 样品采购计划响应:', JSON.stringify(sampleRes));
        results.push({
          group: '样品',
          sku: product.sku,
          quantity: 1,
          remark: '长沙样品'
        });
      }

      return results;
    } catch (error) {
      throw new Error(`添加商品失败: ${error.message}`);
    }
  }

  async createLocalSKU(params: { 
    id: number; 
    selectedVariantIndexes?: number[] ;
    lingxingID:string
  }): Promise<{
    ok: true;
    lingxingSynced: boolean;
    lingxingErrors: string[];
    lingxingSkipped: boolean;
  }> {


    try {
      console.log('开始添加商品', params);
      const lingxingErrors: string[] = [];
      const lxApiEnabled = this.lingxingOpenApiEnabled !== false;
      if (!lxApiEnabled) {
        console.log('[createLocalSKU] lingxing.openApiEnabled=false，跳过领星 HTTP，仅生成本地 SKU');
      }
      const syncLx = async (label: string, fn: () => Promise<any>) => {
        if (!lxApiEnabled) {
          console.log(`[createLocalSKU] ${label} 跳过(lingxing.openApiEnabled=false)`);
          return null;
        }
        try {
          const res = await fn();
          const failed =
            Array.isArray(res)
              ? res.length === 0
              : res &&
                typeof res === 'object' &&
                res.code != null &&
                !(res.code === 0 || res.code === '0' || res.message === 'success');
          if (failed) {
            const detail = Array.isArray(res.error_details)
              ? res.error_details.join('; ')
              : res.error_details;
            const msg = res.message || detail || JSON.stringify(res);
            lingxingErrors.push(`${label}: ${msg}`);
            console.warn(`[createLocalSKU] ${label} 失败(领星)，继续:`, msg);
            return res;
          }
          console.log(`[createLocalSKU] ${label} OK`, JSON.stringify(res));
          return res;
        } catch (e: any) {
          const msg =
            e?.response?.data?.message ||
            e?.response?.data?.throwable ||
            e?.message ||
            String(e);
          lingxingErrors.push(`${label}: ${msg}`);
          console.warn(`[createLocalSKU] ${label} 跳过(领星):`, msg);
          return null;
        }
      };

      const isSupplierEditSuccess = (res: any, supplierSKU: string) => {
        if (!res) return false;
        if (Array.isArray(res)) return false;
        if (res.code != null && !(res.code === 0 || res.code === '0' || res.message === 'success')) {
          return false;
        }
        return (
          String(res.customer_supplier_id || '') === String(supplierSKU) ||
          String(res.supplier_id || '') === String(supplierSKU) ||
          Boolean(res.erp_supplier_id) ||
          res.code === 0 ||
          res.code === '0' ||
          res.message === 'success'
        );
      };
      
      const { id, selectedVariantIndexes = [],lingxingID } = params;
      const product = await this.bsrCandidateRepo.findOne({ where: { id } });
      if (!product) throw new Error('商品不存在');

      let factoryLinks: any[] = [];
      let variantCombination: any[] = [];
      const fromTable = await this.loadFactoryLinksAndVariants(id);
      if (fromTable.factory_links?.length > 0 || fromTable.variant_Combination?.length > 0) {
        factoryLinks = fromTable.factory_links;
        variantCombination = fromTable.variant_Combination;
        const legacyFactoryLinks = this.parseLegacyJsonArray(product.factory_links);
        const legacyById = new Map(legacyFactoryLinks.map((link: any) => [String(link.id || ''), link]));
        const legacyByName = new Map(legacyFactoryLinks.map((link: any) => [String(link.name || ''), link]));
        factoryLinks.forEach((link: any) => {
          const legacy = legacyById.get(String(link.id || '')) || legacyByName.get(String(link.name || ''));
          if (!legacy) return;
          if (!link.productSKU && legacy.productSKU) link.productSKU = legacy.productSKU;
          if (!link.supplierSKU && legacy.supplierSKU) link.supplierSKU = legacy.supplierSKU;
          if (!link.product_name && legacy.product_name) link.product_name = legacy.product_name;
        });
        const legacyVariants = this.parseLegacyJsonArray(product.variant_Combination);
        const legacyVariantById = new Map(legacyVariants.map((variant: any) => [String(variant.id || ''), variant]));
        const legacyVariantByName = new Map(legacyVariants.map((variant: any) => [String(variant.name || ''), variant]));
        variantCombination.forEach((variant: any) => {
          const legacy = legacyVariantById.get(String(variant.id || '')) || legacyVariantByName.get(String(variant.name || ''));
          if (!legacy) return;
          if (!variant.sku && legacy.sku) variant.sku = legacy.sku;
          if (!variant.product_name && legacy.product_name) variant.product_name = legacy.product_name;
        });
      } else {
        try {
          factoryLinks = typeof product.factory_links === 'string'
            ? JSON.parse(product.factory_links || '[]')
            : product.factory_links || [];
        } catch (e) {
          factoryLinks = [];
        }
        try {
          variantCombination = typeof product.variant_Combination === 'string'
            ? JSON.parse(product.variant_Combination || '[]')
            : product.variant_Combination || [];
        } catch (e) {
          variantCombination = [];
        }
      }
  
      const variantsToProcess = selectedVariantIndexes.length > 0
        ? selectedVariantIndexes.map(i => variantCombination[i]).filter(Boolean)
        : [];

      console.log('[createLocalSKU] factoryLinks:', factoryLinks.length, '个');
      console.log('[createLocalSKU] variantCombination:', variantCombination.length, '个');
      console.log('[createLocalSKU] selectedVariantIndexes:', selectedVariantIndexes);
      console.log('[createLocalSKU] variantsToProcess:', variantsToProcess.length, '个', variantsToProcess.map((v: any) => v.name));
  
      const referencedLinks = new Set<string>();
      variantsToProcess.forEach(variant => {
        (variant.selectedGroups || []).forEach(name => referencedLinks.add(name));
      });
  
      const accessKeySkuParam = await this.baseSysParamRepo.findOne({ where: { keyName: 'sku' }});
      let currentSkuValue = parseInt(accessKeySkuParam?.data, 10) || 20000;
  
      const accessKeyproduceNameidParam = await this.baseSysParamRepo.findOne({ where: { keyName: 'produce_name_id' } });
      let currentProduceNameIdValue = parseInt(accessKeyproduceNameidParam?.data, 10) || 2000;
  
      // 3. SKU生成规则
      const generateNextSKU = (componentType: string) => {
        const prefixMap = { main: 'A', accessory: 'B', packing: 'C', variant: 'D' };
        return (prefixMap[componentType] || 'A') + currentSkuValue++;
      };

      // 变体SKU：选品SKU-缩写（中文取拼音首字母，英文保留并大写，其余字符跳过）
      const generateVariantSKU = (variantName: string) => {
        let result = '';
        for (const char of variantName) {
          if (/[a-zA-Z]/.test(char)) {
            result += char.toUpperCase();
          } else if (/[一-鿿]/.test(char)) {
            const py = pinyin(char, { style: pinyin.STYLE_FIRST_LETTER })[0]?.[0] || '';
            result += py.toUpperCase();
          }
        }
        return `${product.sku}-${result}`;
      };
  
      const groupMap = new Map<string, any[]>();
      for (const link of factoryLinks) {
        // 只处理被变体引用的链接
        if (!referencedLinks.has(link.name)) continue;
        
        const groupId = link.groupId;
        if (!groupMap.has(groupId)) groupMap.set(groupId, []);
        groupMap.get(groupId)!.push(link);
      }
  
      const linkProductMap = new Map<string, string>(); // link.name → 产品SKU
      const productSkuToSupplierQuotes = new Map<string, any[]>(); // productSKU → supplier_quote
      const commonRepo = await this.commonRepo.findOne({ where: { candidate_id: id } });
      const productSetSizeFields = buildCandidateProductSetSizeFields(commonRepo);
  
      // 4. 处理每个分组（每组一个产品，多供应商报价）
      for (const [groupId, links] of groupMap) {
        const supplierQuotes = [];
        
        // 4.1 检查是否已有组产品SKU（优先复用）
        let productSKU = links[0].productSKU;
        const primaryLink = links.find(l => l.isFirst) || links[0];
        
        // 若无则生成新SKU并更新组内所有链接
        if (!productSKU) {
          productSKU = generateNextSKU(primaryLink.type);
          links.forEach(link => link.productSKU = productSKU);
        }
  
        // 4.2 处理组内每个链接（独立供应商）
        for (const link of links) {
          // 生成或复用供应商SKU
          const existedSupplierSKU = Boolean(link.supplierSKU);
          const supplierSKU = link.supplierSKU || generateNextSKU(link.type);
          if (!existedSupplierSKU) {
            link.supplierSKU = supplierSKU;
            link.product_name = `${currentProduceNameIdValue}_${product.produce_name}_${link.name}`;
          }
          linkProductMap.set(link.name, productSKU); // 记录名称→产品SKU
  
          // 创建供应商（每个链接独立）
          console.log(`[createLocalSKU] 创建供应商: supplierSKU=${supplierSKU}, name=${currentProduceNameIdValue}_${product.produce_name}_${link.name}`);
          let supplierEditRes = await syncLx(`供应商 ${supplierSKU}`, () =>
            this.lingXingUtils.httpPost('/erp/sc/routing/storage/supplier/edit', {
              supplier_id: supplierSKU,
              supplier_name: `${currentProduceNameIdValue}_${product.produce_name}_${link.name}`,
              contact_person: "",
              contact_number: "",
              settlement_method: 7,
              url: link.user_input,
            })
          );
          if (lxApiEnabled && !isSupplierEditSuccess(supplierEditRes, supplierSKU)) {
            await sleep(500);
            supplierEditRes = await syncLx(`供应商 ${supplierSKU} 重试`, () =>
              this.lingXingUtils.httpPost('/erp/sc/routing/storage/supplier/edit', {
                supplier_id: supplierSKU,
                supplier_name: `${currentProduceNameIdValue}_${product.produce_name}_${link.name}`,
                contact_person: "",
                contact_number: "",
                settlement_method: 7,
                url: link.user_input,
              })
            );
          }

          const supplierUsable =
            !lxApiEnabled ||
            isSupplierEditSuccess(supplierEditRes, supplierSKU);
          if (!supplierUsable) {
            if (!existedSupplierSKU) {
              link.supplierSKU = '';
              link.product_name = undefined;
            }
            console.warn(`[createLocalSKU] 供应商 ${supplierSKU} 未确认创建成功，跳过写入 supplier_quote`);
            continue;
          }
  
          // 收集供应商报价
          supplierQuotes.push({
            supplier_id: supplierSKU,
            supplier_product_url: [link.user_input],
            is_primary: link.isFirst ? 1 : 0, // 标记首选供应商
            quotes: [{
              currency: "CNY",
              is_tax: 0,
              tax_rate: "0",
              step_prices: [{ moq: 1, price_with_tax: link.price }]
            }]
          });
        }
  
        // 4.3 创建组产品（同组共享一个产品SKU）
        const productName = links.length > 1 
          ? `${currentProduceNameIdValue}_${product.produce_name}_组合产品`
          : `${currentProduceNameIdValue}_${product.produce_name}_${primaryLink.name}`;
        
        console.log(`[createLocalSKU] 创建组产品: sku=${productSKU}, name=${productName}`);
        // supplier_quote 必填，quotes不能为空
        const simpleQuotes = buildProductSetSupplierQuotes(supplierQuotes);
        productSkuToSupplierQuotes.set(productSKU, simpleQuotes);
        await syncLx(`组产品 ${productSKU}`, () =>
          this.lingXingUtils.httpPost(
            '/erp/sc/routing/storage/product/set',
            {
              sku: productSKU,
              product_name: productName,
              ...productSetSizeFields,
              group_list: [],
              ...(simpleQuotes.length > 0 ? { supplier_quote: simpleQuotes } : {}),
              ...(product.HS_code ? { bg_export_hs_code: product.HS_code } : {}),
              product_developer_uid: parseInt(lingxingID),
              product_creator_uid: parseInt(lingxingID),
            },
            true
          )
        );
      }
  
      const firstProductSKU = groupMap.size > 0 ? Array.from(groupMap.values())[0]?.[0]?.productSKU || '' : '';

      for (const variant of variantsToProcess) {
        // 构建组合清单（使用产品SKU）
        const groupList: { sku: string; quantity: number }[] = [];
        for (const linkName of variant.selectedGroups || []) {
          const refProductSKU = linkProductMap.get(linkName);
          const quantity = variant.groupProportions?.[linkName] || 1;
          if (refProductSKU) groupList.push({ sku: refProductSKU, quantity });
        }

        // 生成/修正变体SKU（每次都会计算正确SKU，防止旧脏数据）
        const oldSku = variant.sku;
        if (groupList.length > 1) {
          // 组合产品：生成变体SKU并上传到领星
          if (!variant.sku) {
            variant.sku = generateVariantSKU(variant.name);
            variant.product_name = `${currentProduceNameIdValue}_${product.produce_name}_${variant.name}`;
          }
          if (variant.id && variant.sku !== oldSku) {
            try { await this.variantRepo.update(variant.id, { sku: variant.sku } as any); } catch {}
          }

          // 汇总所有组件的供应商报价
          const variantSupplierQuotes: any[] = [];
          const seenSupplierIds = new Set<string>();
          for (const groupItem of groupList) {
            const quotes = productSkuToSupplierQuotes.get(groupItem.sku);
            if (quotes) {
              for (const q of quotes) {
                if (!seenSupplierIds.has(q.supplier_id)) {
                  seenSupplierIds.add(q.supplier_id);
                  variantSupplierQuotes.push(q);
                }
              }
            }
          }

          console.log(`[createLocalSKU] 上传变体组合: sku=${variant.sku}, name=${variant.product_name}, groupList=${JSON.stringify(groupList)}`);
          const normalizedVariantSupplierQuotes = buildProductSetSupplierQuotes(variantSupplierQuotes);
          await syncLx(`变体 ${variant.sku}`, () =>
            this.lingXingUtils.httpPost(
              '/erp/sc/routing/storage/product/set',
              {
                sku: variant.sku,
                product_name: variant.product_name,
                ...productSetSizeFields,
                group_list: groupList,
                ...(normalizedVariantSupplierQuotes.length > 0 ? { supplier_quote: normalizedVariantSupplierQuotes } : {}),
                ...(product.HS_code ? { bg_export_hs_code: product.HS_code } : {}),
                product_developer_uid: parseInt(lingxingID),
                product_creator_uid: parseInt(lingxingID),
              },
              true
            )
          );
        } else if (groupList.length === 1) {
          // 单组件变体：复用组件供应商报价，避免重复创建 D 系列供应商后领星尚未生效或返回空结果。
          if (!variant.sku) {
            variant.sku = generateVariantSKU(variant.name);
            variant.product_name = `${currentProduceNameIdValue}_${product.produce_name}_${variant.name}`;
          }
          if (variant.id && variant.sku !== oldSku) {
            try { await this.variantRepo.update(variant.id, { sku: variant.sku } as any); } catch {}
          }

          // 获取组件的供应商报价作为模板
          const componentQuotes = productSkuToSupplierQuotes.get(groupList[0].sku) || [];

          console.log(`[createLocalSKU] 上传单组件变体: sku=${variant.sku}, name=${variant.product_name}, groupList=${JSON.stringify(groupList)}, clearGroupList=true`);
          const normalizedVariantSupplierQuotes = buildProductSetSupplierQuotes(componentQuotes);
          await syncLx(`变体 ${variant.sku}`, () =>
            this.lingXingUtils.httpPost('/erp/sc/routing/storage/product/set', {
              sku: variant.sku,
              product_name: variant.product_name,
              ...productSetSizeFields,
              group_list: [],
              ...(normalizedVariantSupplierQuotes.length > 0 ? { supplier_quote: normalizedVariantSupplierQuotes } : {}),
              ...(product.HS_code ? { bg_export_hs_code: product.HS_code } : {}),
              product_developer_uid: parseInt(lingxingID),
              product_creator_uid: parseInt(lingxingID),
            }, true)
          );
        } else {
          // 无组件引用：用首个产品SKU或选品自身SKU，不上传到领星
          const correctSku = firstProductSKU || product.sku;
          if (correctSku && (variant.sku !== correctSku || !variant.sku)) {
            variant.sku = correctSku;
            if (variant.id) {
              try { await this.variantRepo.update(variant.id, { sku: variant.sku } as any); } catch {}
            }
          }
          console.log(`变体未引用组件 (${variant.name}), 使用SKU: ${variant.sku}, 跳过lingxing上传`);
        }
      }

      // 5. 保存更新后的SKU数据
      console.log('[createLocalSKU] 保存SKU数据到数据库, currentSkuValue=', currentSkuValue, 'currentProduceNameIdValue=', currentProduceNameIdValue);
      for (const linkUpdate of buildFactoryLinkSkuMetadataUpdates(factoryLinks)) {
        const { id: linkId, ...metadata } = linkUpdate;
        await this.factoryLinkRepo.update(linkId, metadata);
      }
      product.factory_links = factoryLinks;
      product.variant_Combination = variantCombination;
      await this.bsrCandidateRepo.save(product);

      // 6. 更新全局计数器
      currentProduceNameIdValue++;
      if (accessKeySkuParam) {
        accessKeySkuParam.data = currentSkuValue.toString();
        await this.baseSysParamRepo.save(accessKeySkuParam);
      }
      if (accessKeyproduceNameidParam) {
        accessKeyproduceNameidParam.data = currentProduceNameIdValue.toString();
        await this.baseSysParamRepo.save(accessKeyproduceNameidParam);
      }

      const lingxingSynced = lxApiEnabled && lingxingErrors.length === 0;
      if (lxApiEnabled && !lingxingSynced) {
        console.warn('[createLocalSKU] 本地SKU已保存，领星同步部分失败:', lingxingErrors);
      }
      return { ok: true, lingxingSynced, lingxingErrors, lingxingSkipped: !lxApiEnabled };
    } catch (error) {
      throw new Error(`生成本地SKU失败: ${error.message}`);
    }
    
  }
  
  async generateProductInitials(variantName){
    return pinyin(variantName, {
			style: pinyin.STYLE_FIRST_LETTER
		})
			.map(arr => arr[0].toUpperCase())
			.join('')
			.substring(0, 5);
  }
  // 同步asin数据，用来去重
  async syncAllAsins() {
    await this.syncCandidateAsins();
    await this.syncCompetitorAsins();
    await this.syncThirdSourceAsins();
  }

  private async syncCandidateAsins() {
    const candidates = await this.bsrCandidateRepo.find({
      select: ['asin']
    });

    for (const candidate of candidates) {
      await this.deduplicateRepo.upsert({
        asin: candidate.asin,
        source: 'candidate'
      }, ['asin']); // 使用ASIN作为唯一标识
    }
  }

  private async syncCompetitorAsins() {
    const competitors = await this.bsrCandidateCompetitorRepo.find({
      select: ['asin_competitor']
    });

    for (const competitor of competitors) {
      await this.deduplicateRepo.upsert({
        asin: competitor.asin_competitor,
        source: 'competitor'
      }, ['asin']);
    }
  }
  private async syncThirdSourceAsins() {
    // console.log('syncThirdSourceAsins');
    const sellers = await this.appAmzSellerRepo.find({ select: ['sid'] });
    const sellerAccountIds = sellers.map(seller => seller.sid);

    if (!sellerAccountIds || sellerAccountIds.length === 0) {
      throw new Error('No seller_account_id found');
    }

    // 遍历每个 sid，逐个请求数据
    for (const sid of sellerAccountIds) {
      try {

        // 构建接口请求参数
        const url = '/erp/sc/data/mws/listing';
        const data = await this.lingXingUtils.httpPost(url, { sid: sid });

        // 逐个处理数据
        for (const item of data) {
          const asin = item.asin;
          if (asin) {
            // 保存数据
            // console.log(`正在处理 ASIN: ${asin}`);
            await this.deduplicateRepo.upsert(
              { asin, source: 'lingxing' },
              ['asin']
            );
          }
        }

        // console.log(`SID: ${sid} 数据同步完成`);
      } catch (error) {
        // console.error(`请求 SID: ${sid} 时发生错误:y ${error.message}`);
      }
    }

    return '同步完成';
  }



  @InjectEntityModel(AppAmzBsrProfitCommon)
  commonRepo: Repository<AppAmzBsrProfitCommon>;

  @InjectEntityModel(AppAmzBsrProfitMarket)
  marketRepo: Repository<AppAmzBsrProfitMarket>;
  async saveProfit(outerPayload: any) {
    try {
      const payload = outerPayload.payload;
      console.log('saveProfit获取到的payload:', payload);

      // 关键校验（防止误删全表）
      if (!payload.candidate_id) throw new Error('candidate_id 不能为空');
      if (!Array.isArray(payload.markets)) throw new Error('markets 数据格式不正确');

      // 查询现有数据
      const existingCommons = (await this.commonRepo.find({
        where: { candidate_id: payload.candidate_id },
      })).map(item => item.id);

      // 删除旧数据
      if (existingCommons.length > 0) {
        await this.marketRepo.delete({ common_id: In(existingCommons) });
        await this.commonRepo.delete({ id: In(existingCommons) });
      }

      // 保存新公共数据
      const common = new AppAmzBsrProfitCommon();
      common.candidate_id = payload.candidate_id;
      Object.assign(common, payload.common);
      const savedCommon = await this.commonRepo.save(common);

      // 保存关联市场数据
      const markets = payload.markets.map(market => {
        const m = new AppAmzBsrProfitMarket();
        m.common_id = savedCommon.id;
        Object.assign(m, market);
        return m;
      });
      await this.marketRepo.save(markets);

      return true;
    } catch (err) {
      console.error('saveProfit发生错误:', err);
      throw err;
    }
  }


  async getProfitData(candidateId: number): Promise<{
    common: {
      cost: number;
      length: number;
      width: number;
      height: number;
      actual_weight: number;
    };
    markets: {
      country_code: string;
      local_price: number;
      shipping: number;
      delivery_fee: number;
      tax_rate: number;
      exchange_rate: number;
      profit: number;
      profit_rate: number;
    }[];
  }> {
    // 默认返回值
    const defaultResponse = {
      common: {
        cost: 0,
        length: 0,
        width: 0,
        height: 0,
        actual_weight: 0
      },
      markets: []
    };

    try {
      // 1. 查询公共参数
      const commonData = await this.commonRepo.findOne({
        where: { candidate_id: candidateId }
      });
      if (!commonData) {
        return defaultResponse;
      }

      // 2. 查询关联的市场数据
      const marketData = await this.marketRepo.find({
        where: { common_id: commonData.id }
      });

      // 3. 转换数据结构
      return {
        common: {
          cost: commonData.cost || 0,
          length: commonData.length || 0,
          width: commonData.width || 0,
          height: commonData.height || 0,
          actual_weight: commonData.actual_weight || 0
        },
        markets: marketData.map(m => ({
          country_code: m.country_code || '',
          local_price: m.local_price || 0,
          shipping: m.shipping || 0,
          delivery_fee: m.delivery_fee || 0,
          tax_rate: m.tax_rate || 0,
          exchange_rate: m.exchange_rate || 0,
          profit: m.profit || 0,
          profit_rate: m.profit_rate || 0
        }))
      };
    } catch (e) {
      console.error('获取利润数据失败:', e);
      return defaultResponse;
    }
  }

  /**
   • 导出符合条件的数据
   • 筛选条件：
   •  - candidate.asin 不为空且不为 ''
   •  - candidate.image_url 不为空且不为 ''
   •  - candidate.status = 3
   •  - 在关联表中不存在记录（关联条件：candidate.asin = competitor.asin_candidate）
   • 仅导出 asin 和 image_url 字段，并生成 CSV 字符串
   */async exportData(): Promise<{ candidateCsv: string; departmentCsv: string }> {
    const TARGET_COUNTRIES = ['英国', '德国'];

    // 修改查询语句：添加竞品ASIN检查
    const qb = this.bsrCandidateRepo.createQueryBuilder('candidate');
    qb.where("candidate.asin IS NOT NULL AND candidate.asin <> ''")
      .andWhere("candidate.image_url IS NOT NULL AND candidate.image_url <> ''")
      // .andWhere("candidate.image_url LIKE :pattern", { pattern: '%amazon%' })
      .andWhere("candidate.status = :status", { status: 6 })
      .andWhere("candidate.marketplace IN ('英国', '德国')")
      .select([
        "candidate.id AS id",
        "candidate.asin AS asin",
        "candidate.image_url AS image_url",
        ...TARGET_COUNTRIES.map(country =>
          `(SELECT 
          CASE 
            WHEN COUNT(*) = 1 AND MIN(asin_competitor) = candidate.asin THEN 0
            ELSE COUNT(*) 
          END
          FROM app_amz_bsr_candidate_competitor 
          WHERE candidate_id = candidate.id 
          AND marketplace = '${country}'
          and status in (1,2)
        ) AS ${country.toLowerCase()}_count`
        )
      ]);

    const candidateData = await qb.getRawMany();

    // 生成CSV时替换image_url中的逗号
    let candidateCsv = 'id,asin,image_url,UK,DE\n'
    candidateData.forEach(item => {
      // 替换image_url中的逗号
      const cleanImageUrl = item.image_url.replace(/,/g, '.');

      const countryStatus = TARGET_COUNTRIES.map(country => {
        const count = item[`${country.toLowerCase()}_count`];
        return count > 0 ? '已完成' : '空';
      }).join(',');

      candidateCsv += `${item.id},${item.asin},${cleanImageUrl},${countryStatus}\n`;
    });

    // 部门数据保持不变
    const departmentData = await this.departmentFilterRepo.find();
    let departmentCsv = 'marketplace,department,rank_limit\n';
    departmentData.forEach(item => {
      departmentCsv += `${[
        item.marketplace,
        item.department,
        item.rank_limit ?? ''
      ].join(',')}\n`;
    });

    return { candidateCsv, departmentCsv };
  }

  /**
   * 启动 BSR 选品的八爪鱼识图任务
   */
  async startBzyShiTu() {
    const TARGET_COUNTRIES = ['英国', '德国'];
    const COUNTRIES = [
      { name: '英国', domain: 'amazon.co.uk', state: 2, prevState: 1 },
      { name: '德国', domain: 'amazon.de', state: 3, prevState: 2 },
    ];

    // 获取总体任务
    const overallTask = new AppTaskManagementEntity();
    overallTask.taskCode = `bsr-candidate-bzy-${Date.now()}`;
    overallTask.taskName = 'BSR选品-八爪鱼识图任务';
    overallTask.taskStatus = TASK_STATUSES.UNEXECUTED;
    overallTask.invokeTime = new Date();
    await this.taskManagementRepo.save(overallTask);

    try {
      // 1. 查询需要处理的候选数据 (status = 6)
      const qb = this.bsrCandidateRepo.createQueryBuilder('candidate');
      qb.where("candidate.asin IS NOT NULL AND candidate.asin <> ''")
        .andWhere("candidate.image_url IS NOT NULL AND candidate.image_url <> ''")
        .andWhere("candidate.status = :status", { status: 6 })
        .andWhere("(candidate.competitor_status IS NULL OR candidate.competitor_status = 0)")
        .andWhere("candidate.marketplace IN ('英国', '德国')")
        .select([
          "candidate.id AS id",
          "candidate.asin AS asin",
          "candidate.image_url AS image_url",
          "candidate.aliyun_img AS aliyun_img",
          "candidate.price AS price",
          "candidate.aliyun_score AS aliyun_score",
          "candidate.cont_sign AS cont_sign",
          "candidate.marketplace AS marketplace",
          ...TARGET_COUNTRIES.map(country =>
            `(SELECT COUNT(*) FROM app_amz_bsr_candidate_competitor 
            WHERE candidate_id = candidate.id 
            AND marketplace = '${country}'
            AND status IN (1,2,5,6)
            ) AS ${country.toLowerCase()}_count`
          )
        ]);

      let candidateData = await qb.getRawMany();
      if (!candidateData || candidateData.length === 0) {
        overallTask.taskStatus = TASK_STATUSES.FINISHED;
        overallTask.executeResult = '无待处理数据';
        overallTask.executeEndTime = new Date();
        await this.taskManagementRepo.save(overallTask);
        return { success: true, message: '无待处理数据' };
      }

      // 1.1 检查 aliyun_score，如果为空或为0，则调用 archiveWithImage3 逻辑
      for (let i = 0; i < candidateData.length; i++) {
        let item = candidateData[i];
        if (item.aliyun_score == null || Number(item.aliyun_score) <= 0) {
          console.log(`[BSR八爪鱼识图] 候选数据ID=${item.id} aliyun_score为空或0，开始上传阿里云...`);
          try {
            // 调用 getSimilarityScore2
            let imgUrl = item.aliyun_img || item.image_url;
            const similarityScore = await this.imageSimilarityTool.getSimilarityScore2(imgUrl, item.asin);
            
            if (similarityScore > 0) {
              await this.bsrCandidateRepo.update(
                { id: item.id },
                { aliyun_score: similarityScore+"" }
              );
              // 更新阿里云图片库
              await this.processEntitiesInBackground2(
                [{
                  id: item.id,
                  image_url: imgUrl,
                  asin: item.asin
                } as AppAmzBsrCandidateEntity],
                false
              );
              item.aliyun_score = similarityScore;
              // 2026-04-10: 日志简化 - 取消打印大于0的相似度
              // console.log(`[BSR八爪鱼识图] 候选数据ID=${item.id} 阿里云处理完成，相似度=${similarityScore}`);
            } else {
              console.log(`[BSR八爪鱼识图] 候选数据ID=${item.id} 阿里云处理返回相似度为0，跳过此条数据。`);
            }
          } catch (err) {
            console.error(`[BSR八爪鱼识图] 候选数据ID=${item.id} 阿里云处理失败:`, err.message);
          }
        }
      }

      // 过滤出 aliyun_score > 0 的数据
      candidateData = candidateData.filter(item => item.aliyun_score != null && Number(item.aliyun_score) > 0);

      // 2. 检查每个候选数据是否有至少一个英国和一个德国竞品 (恢复限制)
      const validCandidateData = [];
      const invalidCandidateIds = [];
      for (const item of candidateData) {
        const hasUK = Number(item.英国_count) > 0;
        const hasDE = Number(item.德国_count) > 0;
        const isImageRetry = item.cont_sign === 'IMAGE_RETRY';
        if (!isImageRetry && (!hasUK || !hasDE)) {
          console.warn(`[BSR八爪鱼识图] 候选数据ID=${item.id} (ASIN: ${item.asin}) 被跳过，原因: 缺少竞品 (英国: ${item.英国_count}, 德国: ${item.德国_count})`);
          invalidCandidateIds.push(item.id);
        } else {
          validCandidateData.push(item);
        }
      }
      
      // 对于不符合条件的，更新状态以避免无限重试 (设置为状态11或其他以退出0状态循环，这里暂设回null或其他异常状态，但由于代码逻辑，设为-1表示废弃)
      if (invalidCandidateIds.length > 0) {
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = -1 WHERE id IN (?)`,
          [invalidCandidateIds]
        );
      }

      if (validCandidateData.length === 0) {
        overallTask.taskStatus = TASK_STATUSES.FINISHED;
        overallTask.executeResult = '无符合条件的候选数据（缺少英国或德国竞品，或阿里云相似度未大于0）';
        overallTask.executeEndTime = new Date();
        await this.taskManagementRepo.save(overallTask);
        return { success: true, message: '无符合条件的候选数据（缺少英国或德国竞品，或阿里云相似度未大于0）' };
      }

      overallTask.taskStatus = TASK_STATUSES.RUNNING;
      await this.taskManagementRepo.save(overallTask);

      // 3. 按国家分组需要处理的数据，并根据 asin 去重，避免重复调用八爪鱼
      const uniqueCandidates = [];
      const seenAsins = new Set();
      
      // 记录每个 asin 对应的所有 candidate id，以便后续批量更新状态
      const asinToIds = new Map<string, number[]>();

      for (const item of validCandidateData) {
        if (!asinToIds.has(item.asin)) {
          asinToIds.set(item.asin, []);
        }
        asinToIds.get(item.asin).push(item.id);

        if (!seenAsins.has(item.asin)) {
          seenAsins.add(item.asin);
          // 将相同 asin 的 id 数组附加到 item 上，以便在任务完成时一起更新
          uniqueCandidates.push({ ...item, all_ids: asinToIds.get(item.asin) });
        }
      }

      // 确保 uniqueCandidates 中的 all_ids 引用了完整的数组
      for (const item of uniqueCandidates) {
        item.all_ids = asinToIds.get(item.asin);
      }

      const itemsToProcessUK = uniqueCandidates;
      const itemsToProcessDE = uniqueCandidates;

      overallTask.totalCount = itemsToProcessUK.length + itemsToProcessDE.length;
      overallTask.completedCount = 0;
      await this.taskManagementRepo.save(overallTask);

      let globalCompletedCount = 0;

      // 3. 处理英国任务
      if (itemsToProcessUK.length > 0) {
        console.log(`开始处理BSR英国八爪鱼任务，共${itemsToProcessUK.length}条`);
        const completed = await this.processCountryTasksForCandidate(
          COUNTRIES[0], itemsToProcessUK, overallTask.id, globalCompletedCount
        );
        globalCompletedCount += completed;
        overallTask.completedCount = globalCompletedCount;
        await this.taskManagementRepo.save(overallTask);
      }

      // 4. 处理德国任务
      if (itemsToProcessDE.length > 0) {
        console.log(`开始处理BSR德国八爪鱼任务，共${itemsToProcessDE.length}条`);
        const completed = await this.processCountryTasksForCandidate(
          COUNTRIES[1], itemsToProcessDE, overallTask.id, globalCompletedCount
        );
        globalCompletedCount += completed;
        overallTask.completedCount = globalCompletedCount;
        await this.taskManagementRepo.save(overallTask);
      }

      overallTask.taskStatus = TASK_STATUSES.FINISHED;
      overallTask.executeEndTime = new Date();
      await this.taskManagementRepo.save(overallTask);

      return { success: true, message: '八爪鱼任务处理完成' };
    } catch (error) {
      console.error(`处理BSR八爪鱼任务时发生错误: ${error.message}`, error.stack);
      overallTask.taskStatus = TASK_STATUSES.FAILED;
      overallTask.executeEndTime = new Date();
      overallTask.executeResult = error.message;
      await this.taskManagementRepo.save(overallTask);
      throw error;
    }
  }

  async getBzyTaskStatusesWithRetry(taskIds: string[], maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.bazhuayuUtils.getTaskStatuses(taskIds);
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await sleep(2000);
      }
    }
  }

  async stopBzyTask(taskId: string) {
    return await this.bazhuayuUtils.stopTask(taskId);
  }

  async updateTaskLoopItems(params: { taskId: string; actionId: string; loopType: "UrlList"; loopItems: string[] }) {
    for (let i = 0; i < 3; i++) {
      try {
        return await this.bazhuayuUtils.updateLoopItems(params);
      } catch (error) {
        if (i === 2) throw error;
        await sleep(2000);
      }
    }
  }

  async bzyShiTuByCountry(taskId: string, id: number, country: string) {
    try {
      const startRes = await this.bazhuayuUtils.httpPost('/cloudextraction/start', { taskId });
      console.log(`[BSR八爪鱼识图] 数据ID=${id} 国家=${country} 启动成功:`, startRes);
      return { success: true };
    } catch (error) {
      console.error(`[BSR八爪鱼识图] 数据ID=${id} 国家=${country} 启动失败:`, error.message);
      return { success: false, message: error.message };
    }
  }

  async processCountryTasksForCandidate(
    country: { name: string; domain: string },
    itemsToProcess: any[],
    overallTaskId: number,
    currentGlobalCompleted: number
  ): Promise<number> {
    if (itemsToProcess.length === 0) return 0;

    const countryProcesses = BAZHUAYU_PROCESSES_BY_COUNTRY[country.name] || [];
    if (countryProcesses.length === 0) {
      console.warn(`${country.name}未配置八爪鱼任务`);
      return 0;
    }

    const slots = countryProcesses.map(proc => ({
      ...proc,
      status: 'IDLE' as 'IDLE' | 'STARTING' | 'RUNNING' | 'SAVING',
      item: null as any | null,
      startTime: 0
    }));

    let countryCompletedCount = 0;
    let pendingIndex = 0;
    let hasCompletedSlot = false;

    const startSingleTask = async (slot: typeof slots[0], loopUrl: string) => {
      try {
        await this.stopBzyTask(slot.taskId).catch(() => {});
        await this.updateTaskLoopItems({
            taskId: slot.taskId,
            actionId: slot.actionId,
            loopType: "UrlList",
            loopItems: [loopUrl]
        });
        const res = await this.bzyShiTuByCountry(slot.taskId, slot.item!.id, country.name);
        if (res.success) {
          // 状态0：抓取中
          if (slot.item.all_ids && slot.item.all_ids.length > 0) {
            await this.bsrCandidateRepo.update(slot.item.all_ids, { competitor_status: 0 });
          } else {
            await this.bsrCandidateRepo.update(slot.item!.id, { competitor_status: 0 });
          }
        }
        return res.success;
      } catch (e) {
        console.error(`启动任务${slot.taskId}异常:`, e);
        return false;
      }
    };

    const processCompletedSlot = async (slot: typeof slots[0]) => {
      if (!slot.item) return;
      const item = slot.item;
      
      const dataResult = await this.bazhuayuUtils.getAmzStructuredData(
        slot.taskId,
        country.name,
        100,
        { asinKey: 'ASIN', imgUrlKey: 'imgurl1', sourceUrlKey: '任务源网址', priceKey: '价格' }
      );
      
      await this.processAndSaveCandidateCompetitorData(item, dataResult.structuredData, country.name);
      await this.bazhuayuUtils.markDataAsExported(slot.taskId);
      
      // 状态1：八爪鱼数据抓完了 (2026-04-03)
      if (item.all_ids && item.all_ids.length > 0) {
        await this.bsrCandidateRepo.update(item.all_ids, { competitor_status: 1 });
      } else {
        await this.bsrCandidateRepo.update(item.id, { competitor_status: 1 });
      }
      
      console.log(`[BSR] ${country.name}数据ID=${item.id}完成，获取${dataResult.structuredData?.length || 0}条数据，状态已更新为1(抓取完成)`);

      // 标记有竞品数据完成，待循环结束后统一触发识图
      hasCompletedSlot = true;
    };

    while (pendingIndex < itemsToProcess.length || slots.some(s => s.status !== 'IDLE')) {
      const idleSlots = slots.filter(s => s.status === 'IDLE');
      for (const slot of idleSlots) {
        if (pendingIndex >= itemsToProcess.length) break; 
        const item = itemsToProcess[pendingIndex];
        pendingIndex++; 

        const sourceImageUrl = item.aliyun_img || item.image_url;
        const cleanImageUrl = sourceImageUrl ? sourceImageUrl.replace(/,/g, '.') : '';
        const loopUrl = cleanImageUrl ? `https://www.${country.domain}/stylesnap?q=${cleanImageUrl}` : '';
        
        if (!loopUrl) {
          console.error(`[BSR] ${country.name}数据ID=${item.id}无效：缺少image_url`);
          continue;
        }

        slot.status = 'STARTING';
        slot.item = item;
        slot.startTime = Date.now();
        console.log(`[BSR] ${country.name}分配数据ID=${item.id}到任务${slot.taskId}`);

        startSingleTask(slot, loopUrl).then(success => {
          if (success) {
            slot.status = 'RUNNING';
          } else {
            slot.status = 'IDLE';
            slot.item = null;
          }
        });
      }

      const runningSlots = slots.filter(s => s.status === 'RUNNING');
      if (runningSlots.length > 0) {
        const taskIds = runningSlots.map(s => s.taskId);
        try {
          const statusResult = await this.getBzyTaskStatusesWithRetry(taskIds);
          const statusMap = statusResult.data.reduce((map, info) => {
            map[info.taskId] = info.status;
            return map;
          }, {} as Record<string, string>);

          for (const slot of runningSlots) {
            const status = statusMap[slot.taskId];
            if (status === TASK_STATUSES.FINISHED || status === TASK_STATUSES.STOPPED) {
              slot.status = 'SAVING';
            }
          }
        } catch (error) {
          console.warn(`[BSR] ${country.name}状态查询失败稍后重试: ${error.message}`);
        }
      }

      const savingSlots = slots.filter(s => s.status === 'SAVING');
      await Promise.all(savingSlots.map(async (slot) => {
        try {
           await processCompletedSlot(slot);
           countryCompletedCount++;
           
           const currentOverallTask = await this.taskManagementRepo.findOne({ where: { id: overallTaskId } });
           if (currentOverallTask) {
             const newGlobalCompleted = currentGlobalCompleted + countryCompletedCount;
             currentOverallTask.completedCount = Math.min(newGlobalCompleted, currentOverallTask.totalCount);
             await this.taskManagementRepo.save(currentOverallTask);
           }
        } catch (error) {
           console.error(`[BSR] ${country.name}数据ID=${slot.item?.id}保存结果失败`, error);
        } finally {
           slot.status = 'IDLE';
           slot.item = null;
        }
      }));

      const hasIdleAndPending = slots.some(s => s.status === 'IDLE') && pendingIndex < itemsToProcess.length;
      if (!hasIdleAndPending) {
         await sleep(5000);
      } else {
         await sleep(200);
      }
    }

    if (hasCompletedSlot) {
      this.triggerSimilarityProcessing().catch(err => {
        console.error(`[BSR] ${country.name} 统一触发阿里云图片对比失败:`, err);
      });
    }

    return countryCompletedCount;
  }

  async processAndSaveCandidateCompetitorData(
    sourceItem: any,
    structuredData: AmzTargetData[],
    countryName: string
  ) {
    if (!structuredData || structuredData.length === 0) return;

    let sourcePrice = Number(sourceItem.price);
    let isSourcePriceValid = !isNaN(sourcePrice) && sourcePrice > 0;

    const existingStatus6Items = await this.bsrCandidateCompetitorRepo.find({
      where: {
        asin_competitor: In(structuredData.map(d => d.ASIN)),
        marketplace: countryName
        // 移除 status 过滤，查找所有状态的竞品，避免重复插入
      }
    });

    // 使用 Set 记录本批次已处理的竞品 ASIN，防止同一批次内出现重复导致重复插入
    const processedAsinsInBatch = new Set<string>();

    // 2026-04-10: 使用事务处理每个竞品数据，以防止并发导致的重复入库
    for (const data of structuredData) {
      if (!data.price || data.price.trim() === '') continue;

      // 添加过滤逻辑：image_url包含.gif的一律不入库
      if (data.imgurl1 && /\.gif($|\?)/i.test(data.imgurl1.toLowerCase())) {
        continue;
      }
      
      let asinCandidate = null;
      const sourceImageUrl = sourceItem.aliyun_img || sourceItem.image_url;
      if (data.任务源网址 && sourceImageUrl && data.任务源网址.includes(sourceImageUrl.replace(/,/g, '.'))) {
        asinCandidate = sourceItem.asin;
      }

      const currentAsinCandidate = asinCandidate || sourceItem.asin;

      // 同一批次内的重复数据去重
      const batchKey = `${data.ASIN}_${countryName}_${currentAsinCandidate}`;
      if (processedAsinsInBatch.has(batchKey)) {
        continue;
      }
      processedAsinsInBatch.add(batchKey);

      const rawPrice = data.price.trim();
      // 只需要一个有效的candidate_id即可，取第一个
      const cid = (sourceItem.all_ids && sourceItem.all_ids.length > 0) ? sourceItem.all_ids[0] : sourceItem.id;

      // 使用事务和悲观锁确保不会出现重复记录
      await this.bsrCandidateCompetitorRepo.manager.transaction(async transactionalEntityManager => {
        let existing = await transactionalEntityManager.findOne(AppAmzBsrCandidateCompetitorEntity, {
          where: {
            asin_competitor: data.ASIN,
            marketplace: countryName,
            asin_candidate: currentAsinCandidate,
            candidate_id: cid
          },
          lock: { mode: "pessimistic_write" }
        });

        if (existing) {
          Object.assign(existing, buildExistingCompetitorRefreshPatch({
            rawPrice,
            imageUrl: data.imgurl1,
            resetScores: sourceItem.cont_sign === 'IMAGE_RETRY'
          }));
          await transactionalEntityManager.save(AppAmzBsrCandidateCompetitorEntity, existing);
          return; // 相当于 continue，但因为在回调里，用 return
        }

        const competitorPrice = this.bazhuayuUtils.formatPrice(rawPrice);
        if (competitorPrice === null) return;

        let isPriceSuitable = true;
        if (isSourcePriceValid) {
          isPriceSuitable = competitorPrice >= sourcePrice * 0.5 && competitorPrice <= sourcePrice * 2;
        }

        const competitor = new AppAmzBsrCandidateCompetitorEntity();
        competitor.candidate_id = cid;
        competitor.asin_candidate = currentAsinCandidate;
        competitor.asin_competitor = data.ASIN;
        competitor.image_url = data.imgurl1;
        competitor.marketplace = countryName;
        competitor.price = rawPrice;
        competitor.status = 3;
        competitor.source = 1;

        await transactionalEntityManager.insert(AppAmzBsrCandidateCompetitorEntity, competitor);
      });
    }
  }

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
  async exportData2(): Promise<{ csvData: string; departmentCsv: string }> {
    // 首先删除重复数据
    await this.removeDuplicateCompetitors();

    // 然后执行原来的查询
    const query = ` 
    SELECT
      cand.source,  
      comp.asin_candidate,
      comp.marketplace,
      comp.asin_competitor,
      comp.id
    FROM app_amz_bsr_candidate_competitor comp
    INNER JOIN app_amz_bsr_candidate cand  
      ON comp.candidate_id = cand.id  and cand.status = 6
    WHERE 
      comp.status = 2
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


  async getCompetitorData() {
    const requiredCountries = ['英国', '德国', '法国', '西班牙', '意大利'];

    // 处理标题的辅助函数
    const processTitle = (title: string): string => {
      if (!title) return '';

      // 替换特殊字符
      let cleanedTitle = title
        .replace(/,/g, '')   // 移除逗号
        .replace(/&/g, '')   // 移除&符号
        .replace(/–/g, '')   // 移除&符号
        .replace(/-/g, '')   // 移除&符号
        .replace(/\./g, '')  // 移除句点
        .replace(/"/g, '')   // 移除双引号
        .replace(/\|/g, '')  // 移除竖线
        .replace(/\s+/g, ' '); // 压缩多个空格为一个

      // 取前7个单词，然后删除第一个单词，保留6个
      const words = cleanedTitle.split(' ').filter(word => word.length > 0);
      if (words.length > 7) {
        words.splice(0, 1); // 删除第一个单词
        return words.slice(0, 6).join(' ');
      } else if (words.length > 1) {
        words.splice(0, 1); // 删除第一个单词
        return words.join(' ');
      } else {
        return cleanedTitle;
      }
    };

    // 获取状态为6的候选产品（添加item_name和marketplace字段）
    const candidates = await this.bsrCandidateRepo.query(`
      SELECT id, asin, sku, item_name, marketplace 
      FROM app_amz_bsr_candidate
      WHERE status = 6
    `);

    // 处理候选产品的标题
    const processedTitles = new Map<number, string>();
    for (const candidate of candidates) {
      processedTitles.set(candidate.id, processTitle(candidate.item_name));
    }

    // 获取竞品数据（包含标题和销量）
    const queryResult = await this.bsrCandidateCompetitorRepo.query(`
      WITH ranked_competitors AS (
          SELECT 
              c.id AS candidate_id,
              c.asin AS asin_candidate,
              c.sku,
              c.marketplace AS candidate_marketplace,
              comp.marketplace,  
              comp.asin_competitor,
              comp.item_name,
              comp.Main_monthly_sales,
              ROW_NUMBER() OVER (
                  PARTITION BY c.id, c.asin, comp.marketplace 
                  ORDER BY 
                      CASE 
                          WHEN CAST(IF(comp.Main_monthly_sales = '', '0', comp.Main_monthly_sales) AS UNSIGNED) > 0 
                              THEN 0  
                          ELSE 1
                      END,
                      CAST(IF(comp.Main_monthly_sales = '', '0', comp.Main_monthly_sales) AS UNSIGNED) DESC,
                      CASE 
                          WHEN comp.bsr_rank = '' OR comp.bsr_rank = '0' THEN 999999999  
                          ELSE CAST(REPLACE(comp.bsr_rank, ',', '') AS UNSIGNED)
                      END,
                      CASE comp.dispatches_type
                          WHEN '1' THEN 1  
                          WHEN '0' THEN 2  
                          WHEN '2' THEN 3  
                          ELSE 4          
                      END
              ) AS row_num
          FROM app_amz_bsr_candidate c
          LEFT JOIN app_amz_bsr_candidate_competitor comp 
              ON comp.candidate_id = c.id 
              AND comp.asin_candidate = c.asin
              AND comp.status IN (1,2)
          WHERE c.status = 6
      )
      SELECT 
          candidate_id,
          asin_candidate,
          sku,
          candidate_marketplace,
          marketplace,  
          asin_competitor,
          item_name,
          Main_monthly_sales
      FROM ranked_competitors
      WHERE row_num <= 20
    `);

    // 初始化候选数据
    const resultMap = new Map<number, {
      asinCandidate: string;
      sku: string;
      candidateMarketplace: string;
      competitors: Array<{
        country: string;
        asins: string[];
        bestTitle: string; // 存储格式: "销量|原始标题"
        processedTitle?: string; // 存储处理后的标题
      }>;
    }>();

    // 初始化结构
    for (const candidate of candidates) {
      resultMap.set(candidate.id, {
        asinCandidate: candidate.asin,
        sku: candidate.sku,
        candidateMarketplace: candidate.marketplace,
        competitors: requiredCountries.map(country => ({
          country,
          asins: [],
          bestTitle: '0|' // 初始化为0销量，空标题
        }))
      });
    }

    // 填充竞品数据并记录最佳标题
    for (const row of queryResult) {
      const entry = resultMap.get(row.candidate_id);
      if (!entry) continue;

      // 找到对应的国家数据
      const countryData = entry.competitors.find(c => c.country === row.marketplace);
      if (!countryData) continue;

      // 添加ASIN
      if (countryData.asins.length < 20 && row.asin_competitor) {
        countryData.asins.push(row.asin_competitor);
      }

      // 更新最佳标题（销量最高的）
      if (row.Main_monthly_sales && row.item_name) {
        const currentSales = parseFloat(row.Main_monthly_sales.replace(/,/g, '')) || 0;
        const bestSales = parseFloat(countryData.bestTitle.split('|')[0] || '0') || 0;

        // 如果当前竞品销量更高，更新最佳标题
        if (currentSales > bestSales) {
          countryData.bestTitle = `${currentSales}|${row.item_name}`;

          // 同时处理标题并存储
          countryData.processedTitle = processTitle(row.item_name);
        }
      }
    }

    // 按固定顺序输出国家，英德强制保留，其他仅保留有竞品的国家
    return Array.from(resultMap.entries()).map(([candidateId, data]) => {
      // 获取候选产品处理后的标题
      const candidateTitle = processedTitles.get(candidateId) || '';

      // 过滤：保留英德或者有竞品的国家
      const filteredCompetitors = data.competitors.filter(({ country, asins }) =>
        country === '英国' || country === '德国' || asins.length > 0
      );

      return {
        candidate_id: candidateId,
        asin_candidate: data.asinCandidate,
        sku: data.sku,
        competitors: filteredCompetitors.map(countryInfo => {
          // 确定使用的标题：
          // 1. 如果国家是候选产品原始国家，使用候选产品标题
          // 2. 否则使用该国销量最高的竞品标题（已经处理过的）
          let title = candidateTitle;
          if (countryInfo.country !== data.candidateMarketplace) {
            // 使用处理后的竞品标题（如果有）
            if (countryInfo.processedTitle) {
              title = countryInfo.processedTitle;
            } else {
              // 提取最佳标题（去掉销量前缀）
              const bestTitleParts = countryInfo.bestTitle.split('|');
              if (bestTitleParts.length > 1) {
                title = processTitle(bestTitleParts.slice(1).join('|'));
              }
            }
          }

          return {
            country: countryInfo.country,
            asins: countryInfo.asins,
            title: title
          };
        })
      };
    });
  }


  async exportCompetitorData() {
    const data = await this.getCompetitorData();

    // CSV 头新增 asin_candidate 列
    let csv = '\ufeff源ASIN,竞品ASIN列表,国家,SKU,日期（YYYY-MM）,标题\n';  // 修改表头

    data.forEach(candidate => {
      candidate.competitors.forEach(countryInfo => {
        // 每行新增 asin_candidate 字段
        csv += `"${candidate.asin_candidate}","${countryInfo.asins.join(' ')}",${countryInfo.country},${candidate.sku},,${countryInfo.title}\n`;
      });
    });

    return { csvData: csv };
  }
  async batchUpdateCompetitorStatus(updateParams: BatchUpdateParams): Promise<{ success: boolean; message?: string }> {
    // 字段白名单校验
    const allowedFields = ['competitor_import_status', 'competitor_full_ownership_status', 'keyword_import_status'];
    if (!allowedFields.includes(updateParams.field)) {
      throw new Error(`非法字段: ${updateParams.field}`);
    }

    try {
      const validList = updateParams.updateList.filter(item =>
        item.asin && typeof item.asin === 'string' &&
        item.marketplace && typeof item.marketplace === 'string'
      );

      if (validList.length === 0) {
        return { success: true, message: '无有效数据需要更新' };
      }

      // 构造参数化 SQL（动态字段名）
      const placeholders = validList.map(() => '(?, ?)').join(', ');
      const flatValues = validList.flatMap(item => [item.asin, item.marketplace]);

      // 注意：字段名通过白名单校验后安全使用
      const query = `
        UPDATE app_amz_bsr_candidate
        SET ${updateParams.field} = ?, updateTime = CURRENT_TIMESTAMP
        WHERE (asin, marketplace) IN (${placeholders})
      `;
      const parameters = [updateParams.value, ...flatValues];

      await this.bsrCandidateRepo.manager.transaction(async transactionalEntityManager => {
        await transactionalEntityManager.query(query, parameters);
      });

      return { success: true };
    } catch (err) {
      console.error('批量更新失败:', err);
      return {
        success: false,
        message: `更新失败: ${err.message}`
      };
    }
  }

  async batchUpdateProfitStatus(candidate_id: number, profit_calculation_status: string) {
    try {
      await AppAmzBsrCandidateEntity.update(
        { id: candidate_id },
        { profit_calculation_status: profit_calculation_status }
      );

      return { success: true };
    } catch (err) {
      console.error('利润状态更新失败:', err);
      return { success: false };
    }
  }





  // Credentials must be injected at runtime and never committed to source control.
  private aliImageClient = new imagesearch.default({
    accessKeyId: process.env.ALIYUN_IMAGESEARCH_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_IMAGESEARCH_ACCESS_KEY_SECRET || '',
    type: "access_key",
    endpoint: "imagesearch.cn-shenzhen.aliyuncs.com",
    regionId: "cn-shenzhen",
    protocol: 'https'
  });




  private aliCloudAPILimiter = RateLimit(20, {
    timeUnit: 1000, // 精确控制每秒时间窗口
    uniformDistribution: true // 确保均匀分布4个请求
  });



  // 在类顶部添加全局限流器（控制1次/秒）
  private downloadRateLimiter = RateLimit(10, {
    timeUnit: 1000, // 每秒
  });


 
  async add2(params: any | any[]) {
    // 统一转为数组处理
    const inputList = Array.isArray(params) ? params : [params];

    // 提取唯一asin_candidate集合（过滤空值）
    const uniqueAsins = [...new Set(
      inputList
        .map(p => p?.asin_candidate)
        .filter(asin => asin)
    )];

    // 新增：提取inputList中有效的candidate_id（用于后续过滤）
    const inputCandidateIds = inputList
      .map(p => p?.candidate_id)
      .filter(id => id );

    // 批量查询主表数据：同时过滤asin和id（双重条件）
    const candidateRecords = await this.bsrCandidateRepo.find({
      where: [
        // 条件1：匹配输入的asin_candidate
        { asin: In(uniqueAsins) },
        // 条件2：匹配输入的candidate_id（如果有）
        ...(inputCandidateIds.length > 0 ? [{ id: In(inputCandidateIds) }] : [])
      ],
      select: ['id', 'asin', 'image_url', 'marketplace', 'price', 'last_star', 'review_num', 'bsr_rank', 'dispatches_from', 'bsr_html', 'item_name',
        'sold_by', 'bsr_category', 'dimensions', 'weight', 'variants', 'date_first_available']
    });
    // console.log('candidateRecords:', candidateRecords);
    // 创建快速查找Map（使用 asin + marketplace 作为键）
    const candidateMap = new Map<string, any>();
      candidateRecords.forEach(record => {
      const soldBy = record.sold_by?.toLowerCase() || '';
      const dispatchesFrom = record.dispatches_from?.toLowerCase() || '';

      let dispatches_type = 2;
      if (soldBy === 'amazon') {
        dispatches_type = 0;
      } else if (dispatchesFrom === 'amazon') {
        dispatches_type = 1;
      }

      // 关键：用 asin + marketplace 作为唯一键
      const mapKey = `${record.asin}|${record.marketplace}`;
      candidateMap.set(mapKey, {
        candidate_id: record.id, // 保留原始记录的id
        asin_competitor: record.asin,
        asin_candidate: record.asin,
        image_url: record.image_url,
        marketplace: record.marketplace,
        price: record.price,
        last_star: record.last_star,
        review_num: record.review_num,
        bsr_rank: record.bsr_rank,
        bsr_html: record.bsr_html,
        item_name: record.item_name,
        dispatches_from: record.dispatches_from,
        sold_by: record.sold_by,
        bsr_category: record.bsr_category,
        dimensions: record.dimensions,
        weight: record.weight,
        variants: record.variants,
        date_first_available: record.date_first_available,
        status: 2,
        dispatches_type,
      });
    });

    // 源数据入竞品库
    await this.processCandidateMap(candidateMap)
      .then(() => {
        console.log('竞品数据入库完成，等待3秒...');
        return new Promise(resolve => setTimeout(resolve, 3000));
      });

    // 获取唯一标识键
    const uniqueKeys = inputList.map(p => ({
      candidate_id: p.candidate_id
    }));

    // 查询已存在数据
    const existingRecords = await this.bsrCandidateCompetitorRepo.find({
      where: uniqueKeys,
      select: ['id', 'asin_competitor', 'marketplace', 'candidate_id']
    });

    // 构建快速查找Map
    const existingMap = new Map<string, number>();
    existingRecords.forEach(record => {
      const key = `${record.asin_competitor}|${record.marketplace}|${record.candidate_id ?? 'null'}`;
      existingMap.set(key, record.id);
    });

    // 分离需要插入和更新的数据
    const toInsert = [];
    const toUpdate = [];

    for (const item of inputList) {
      // 用 asin_candidate + marketplace 作为键查询map
      const mapKey = `${item.asin_candidate}|${item.marketplace}`;
      // 优先使用map中匹配的candidate_id，否则使用input中的值
      const effectiveCandidateId = candidateMap.get(mapKey)?.candidate_id ?? item.candidate_id;

      if (!effectiveCandidateId) {
        console.warn(`[add2] 跳过无关联选品的竞品数据: asin_competitor=${item.asin_competitor}, asin_candidate=${item.asin_candidate}`);
        continue;
      }

      if (!item.asin_candidate) {
        item.asin_candidate = candidateMap.get(mapKey)?.asin_candidate;
      }

      const key = `${item.asin_competitor}|${item.marketplace}|${effectiveCandidateId ?? 'null'}`;

      if (existingMap.has(key)) {
        toUpdate.push({
          ...item,
          id: existingMap.get(key),
          candidate_id: effectiveCandidateId
        });
      } else {
        toInsert.push({
          ...item,
          candidate_id: effectiveCandidateId,
          status: typeof item.status === 'number' ? item.status : 3
        });
      }
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const item of toInsert) {
      try {
        await this.bsrCandidateCompetitorRepo.insert(item);
        insertedCount++;
      } catch (error) {
        console.error('单条竞品插入失败:', error);
      }
    }

    for (const item of toUpdate) {
      try {
        await this.bsrCandidateCompetitorRepo.save(item);
        updatedCount++;
      } catch (error) {
        console.error('单条竞品更新失败:', error);
      }
    }

    await this.batchUpdateAllStatus();
    // this.triggerSimilarityProcessing()
    return {
      inserted: insertedCount,
      updated: updatedCount
    };
  }

  async add3(params: any | any[]): Promise<void> {
    const inputList = Array.isArray(params) ? params : [params];
    console.log(`入参总条数：${inputList.length}`); // 确认入参数量
  
    let newlyAddedRecords: Array<{ id: number; aliyun_img: string; asin: string; marketplace: string }> = [];
  
    await this.bsrCandidateRepo.manager.transaction(async transactionalEntityManager => {
      const existingWhere = inputList
        .map(item => ({
          marketplace: normalizeCandidateMarketplace(item.marketplace),
          asin: normalizeCandidateAsin(item.asin)
        }))
        .filter(item => item.asin);
      const existingRecords = existingWhere.length > 0
        ? await transactionalEntityManager.find(AppAmzBsrCandidateEntity, { where: existingWhere })
        : [];
      const existingMap = new Map(existingRecords.map(record => [candidateIdentityKey(record), record]));
      const itemsToRestore = inputList.filter(item =>
        shouldRestoreArchivedCandidate(item, existingMap.get(candidateIdentityKey(item)))
      );
  
      const itemsToInsert = inputList.filter(item => 
        !existingMap.has(candidateIdentityKey(item))
      );

      if (itemsToRestore.length > 0) {
        const restoreEntities = itemsToRestore.map(item => {
          const existing = existingMap.get(candidateIdentityKey(item))!;
          return transactionalEntityManager.create(AppAmzBsrCandidateEntity, stripArchivedCandidateRestoreFlags({
            id: existing.id,
            asin: existing.asin,
            item_name: item.item_name || item.title || existing.item_name || '',
            image_url: item.image_url || existing.image_url || '',
            aliyun_img: item.image_url || item.aliyun_img || existing.aliyun_img || '',
            marketplace: existing.marketplace,
            produce_name: item.produce_name || existing.produce_name,
            source: item.source ?? existing.source,
            sku: item.sku || existing.sku,
            status: BSR_CANDIDATE_STATUS_PENDING_PROCESS,
            distinguish: item.distinguish || existing.distinguish,
            cont_sign: 'PENDING',
            isUpload: '0',
            archive_hide_until: null,
            competitor_spider_status: item.competitor_spider_status ?? 0,
          }));
        });

        const restoredCandidates = await transactionalEntityManager.save(AppAmzBsrCandidateEntity, restoreEntities);
        newlyAddedRecords.push(...restoredCandidates.map(item => ({
          id: item.id,
          aliyun_img: item.aliyun_img,
          asin: item.asin,
          marketplace: item.marketplace
        })));
      }
  
      if (itemsToInsert.length > 0) {
        const candidateEntities = itemsToInsert.map(item =>
          transactionalEntityManager.create(
            AppAmzBsrCandidateEntity,
            stripArchivedCandidateRestoreFlags({
              asin: item.asin,
              item_name: item.title || '',
              image_url: item.image_url || '',
              aliyun_img: item.image_url || '',
              marketplace: item.marketplace,
              produce_name: item.produce_name,
              source: item.source,
              sku: item.sku,
              status: item.status,
              distinguish: item.distinguish,
              cont_sign: 'PENDING',
              isUpload: '0'
            })
          )
        );
  
        const savedCandidates = await transactionalEntityManager.save(AppAmzBsrCandidateEntity, candidateEntities);
        newlyAddedRecords.push(...savedCandidates.map(item => ({
          id: item.id,
          aliyun_img: item.aliyun_img,
          asin: item.asin,
          marketplace: item.marketplace
        })));
      }
    });
  
    if (newlyAddedRecords.length > 0) {
      // 遍历前打印所有待处理记录
      console.log(`待处理记录列表：`, newlyAddedRecords.map((item, idx) => `第${idx+1}条：ASIN=${item.asin}, ID=${item.id}`));
      
      // 并行处理（限制并发数）
    const sema = new Sema(5); // 限制并发数为5，避免接口限流
    await Promise.all(newlyAddedRecords.map(async (record, i) => {
      await sema.acquire();
      try {
        const { id, aliyun_img, asin, marketplace } = record;
        console.log(`===== 开始处理第${i+1}条记录：ASIN=${asin} =====`);
  
        // 单条记录独立try-catch，避免循环中断
        try {
          // 记录已自带image_url，直接用初始值，不再调Oxylabs
        } catch (error: any) {
          // 单条记录异常仅日志，不中断循环
          console.error(`第${i+1}条[${asin}]处理失败：`, error.message);
          await this.bsrCandidateRepo.update(id, { cont_sign: 'ERROR', isUpload: '0', status: 3 }).catch(e => 
            console.error(`第${i+1}条[${asin}]状态更新失败：`, e.message)
          );
        }
        console.log(`===== 结束处理第${i+1}条记录：ASIN=${asin} =====`);
      } finally {
        sema.release();
      }
    }));
    }
    console.log(`===== 所有记录处理完成 =====`);
  }
  async getProductInfo(
    marketplace: string,
    asin: string,
    id: number
  ) {
    // 增加参数校验
    if (!marketplace || !asin || !id) {
      console.error(`[${asin}] 补全产品信息失败：参数不全（marketplace: ${marketplace}, id: ${id}）`);
      return { success: false, error: '参数不全' };
    }
  
    try {
      // 1. 设置超时控制（避免接口挂起）
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Oxylabs接口请求超时')), 30000) // 30秒超时
      );
      // 2. 竞争执行：超时/接口返回取先到的
      const productInfo = await Promise.race([
        this.oxylabsService.getProductInfo(
          marketplace,
          asin,
          'bsrCandidate.getProductInfo.getProductInfo',
        ),
        timeoutPromise,
      ]);
  
  
      // 3. 过滤空值更新（避免覆盖已有有效数据）
      const updateData: Record<string, any> = {};
      Object.entries({
        bullet_points: productInfo.bullet_points,
        item_name: productInfo.title,
        last_star: productInfo.stars,
        review_num: productInfo.reviews,
        price: productInfo.price,
        image_url: productInfo.image_url,
        aliyun_img: productInfo.image_url,
        dispatches_from: productInfo.dispatches_from,
        sold_by: productInfo.sold_by,
        marketplace: productInfo.marketplace,
        weight: productInfo.weight,
        dimensions: productInfo.dimensions,
        bsr_html: productInfo.bsr_html,
        date_first_available: productInfo.date_first_available
      }).forEach(([key, value]) => {
        // 仅当值不为空/undefined/null时才更新
        if (value !== undefined && value !== null && value !== '') {
          updateData[key] = value;
        }
      });
  
      // 4. 执行更新（有数据才更）
      if (Object.keys(updateData).length > 0) {
        await this.bsrCandidateRepo.update(id, updateData);
      } else {
        console.warn(`[${asin}] Oxylabs返回数据为空，无需更新（ID: ${id}）`);
      }
  
      return { success: true, productInfo, error: null };
    } catch (error: any) {
      console.error(`[${asin}] 补全产品信息失败（ID: ${id}）：`, error.message);
      // 可选：记录失败原因到数据库
      // await this.bsrCandidateRepo.update(id, { product_info_error: error.message });
      return { success: false, productInfo: null, error: error.message };
    }
  }

  async processCandidateMap(candidateMap: Map<string, any>) {
    const candidateList = Array.from(candidateMap.values());
    return this.bsrCandidateCompetitorRepo.manager.transaction(
      async (transactionalEntityManager) => {
        let inserted = 0;
        let updated = 0;

        await Promise.all(candidateList.map(async (item) => {
          // 过滤掉包含 .gif 的图片
          if (item.image_url && /\.gif($|\?)/i.test(item.image_url.toLowerCase())) {
            return;
          }

          const existing = await transactionalEntityManager.findOne(
            AppAmzBsrCandidateCompetitorEntity,
            {
              where: {
                asin_competitor: item.asin_competitor,
                marketplace: item.marketplace
              }
            }
          );

          if (existing) {
            const mergedEntity = transactionalEntityManager.merge(
              AppAmzBsrCandidateCompetitorEntity,
              existing,
              item
            );
            await transactionalEntityManager.save(mergedEntity);
            updated++;
          } else {
            const newEntity = transactionalEntityManager.create(
              AppAmzBsrCandidateCompetitorEntity,
              item
            );
            await transactionalEntityManager.insert(AppAmzBsrCandidateCompetitorEntity, newEntity);
            inserted++;
          }
        }));

        return { inserted, updated };
      }
    );
  }
  async delete(ids: number[]) {
    return this.bsrCandidateRepo.manager.transaction(async manager => {
      // 删除关联竞品
      await manager.delete(AppAmzBsrCandidateCompetitorEntity, {
        candidate_id: In(ids)
      });

      // 删除主记录
      await manager.delete(AppAmzBsrCandidateEntity, {
        id: In(ids)
      });
    });
  }


  async triggerSimilarityProcessing() {
    return new Promise((resolve, reject) => {
      // 将任务加入队列
      this.processingQueue.push(async () => {
        try {
          console.log('开始处理待处理的相似度分数');
          await this.processPendingSimilarityScores();
          console.log('相似度分数处理完成，自动触发获取卖家精灵竞品详情(3->4)');
          // 异步触发获取竞品详情，不阻塞当前流程
          this.fetchExportDataFromSellersSprite().catch(e => {
            console.error('自动触发获取竞品详情失败:', e);
          });
          resolve({ success: true });
        } catch (err) {
          console.error('处理失败', err);
          reject({ success: false, error: err.message });
        }
      });

      // 如果当前没有任务在执行，启动处理
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }
  
  private processingQueue: (() => Promise<void>)[] = [];
  private isProcessing = false;
  private async processQueue() {
    if (this.processingQueue.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    try {
      // 取出队列中的第一个任务
      const task = this.processingQueue.shift();
      if (task) {
        await task();
      }
    } catch (error) {
      console.error('队列任务执行失败:', error);
    } finally {
      this.isProcessing = false;
      
      // 检查是否有更多任务需要处理
      if (this.processingQueue.length > 0) {
        // 使用 setTimeout 避免栈溢出
        setTimeout(() => this.processQueue(), 0);
      }
    }
  }

  
  private async processPendingSimilarityScores() {
    // 最大重试次数
    const MAX_RETRIES = 5;
    // 重试间隔（毫秒）
    const RETRY_DELAY = 5000;

    let retryCount = 0;
    let hasPendingItems = true;

    while (hasPendingItems && retryCount <= MAX_RETRIES) {
      try {
        console.log(`第 ${retryCount + 1} 次尝试处理待处理项`);

        // 查询所有未处理且包含有效图片的竞品数据
        const pendingItems = await this.bsrCandidateCompetitorRepo.createQueryBuilder('c')
          .where('c.similarity_score IS NULL')
          .andWhere('c.image_url IS NOT NULL')
          .andWhere('c.status in (1,2,3)')
          .orderBy('c.id', 'ASC')
          .getMany();

        // 如果没有待处理项，退出循环
        if (pendingItems.length === 0) {
          console.log('所有待处理项已完成');
          hasPendingItems = false;
          break;
        }

        console.log(`发现 ${pendingItems.length} 个待处理项`);

        // 在开始处理前，将相关的 candidate 的状态更新为 2（识图中）或 12（再次识图中）
        const candidateIdsToProcess = [...new Set(pendingItems.map(item => item.candidate_id).filter(id => id))];
        if (candidateIdsToProcess.length > 0) {
          // 状态 1 -> 2
          await this.bsrCandidateRepo.query(
            `UPDATE app_amz_bsr_candidate SET competitor_status = 2 WHERE id IN (?) AND competitor_status = 1`,
            [candidateIdsToProcess]
          );
          // 状态 11 -> 12
          await this.bsrCandidateRepo.query(
            `UPDATE app_amz_bsr_candidate SET competitor_status = 12 WHERE id IN (?) AND competitor_status = 11`,
            [candidateIdsToProcess]
          );
        }

        // 添加分块处理防止内存溢出
        const CHUNK_SIZE = 500;
        for (let i = 0; i < pendingItems.length; i += CHUNK_SIZE) {
          const chunk = pendingItems.slice(i, i + CHUNK_SIZE);
          await this.processBatchWithRetry(chunk);
        }

        // 处理完成后检查是否还有未处理项
        const remainingItems = await this.bsrCandidateCompetitorRepo.count({
          where: { similarity_score: null }
        });

        if (remainingItems === 0) {
          console.log('所有项处理成功');
          hasPendingItems = false;
        } else {
          console.log(`仍有 ${remainingItems} 项待处理，准备重试`);
          retryCount++;

          // 指数退避策略
          const delay = RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`等待 ${delay} 毫秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`第 ${retryCount + 1} 次尝试失败:`, error);
        retryCount++;

        if (retryCount <= MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`等待 ${delay} 毫秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('达到最大重试次数，终止处理');
          hasPendingItems = false;
        }
      }
    }

    if (retryCount > MAX_RETRIES) {
      console.error('处理因达到最大重试次数而终止');
    }
  }

  // 带重试的批次处理（新增方法）
  private async processBatchWithRetry(items: AppAmzBsrCandidateCompetitorEntity[], retries = 3) {
    try {
      await this.processEntitiesInBackground(items);
    } catch (error) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 3000 * (4 - retries))); // 指数退避
        return this.processBatchWithRetry(items, retries - 1);
      }
      console.error('批次处理最终失败:', error);
      // 标记失败记录
      await this.markFailedItems(items);
    }
  }


  // 标记失败项（新增方法）
  private async markFailedItems(items: AppAmzBsrCandidateCompetitorEntity[]) {
    const ids = items.map(item => item.id);
    await this.bsrCandidateCompetitorRepo.update(
      { id: In(ids) },
      { similarity_score: -1 } // 特殊值表示处理失败
    );

    // 检查对应的 candidate 是否已经处理完所有有效竞品
    const candidateIdsToProcess = [...new Set(items.map(item => item.candidate_id).filter(id => id))];
    if (candidateIdsToProcess.length > 0) {
      await this.bsrCandidateRepo.manager.transaction(async transactionalEntityManager => {
        const pendingCounts = await transactionalEntityManager.query(
          `SELECT candidate_id, COUNT(*) as count 
           FROM app_amz_bsr_candidate_competitor 
           WHERE candidate_id IN (?) 
             AND similarity_score IS NULL 
             AND image_url IS NOT NULL 
             AND status IN (1, 2, 3)
           GROUP BY candidate_id`,
          [candidateIdsToProcess]
        );
        
        const pendingMap = new Map();
        pendingCounts.forEach(row => pendingMap.set(row.candidate_id, Number(row.count)));
        
        const completedCandidateIds = candidateIdsToProcess.filter(id => !pendingMap.get(id));

        if (completedCandidateIds.length > 0) {
          await transactionalEntityManager.query(
            `UPDATE app_amz_bsr_candidate SET competitor_status = 
              CASE 
                WHEN competitor_status IN (1, 2) THEN 3
                WHEN competitor_status IN (11, 12) THEN 13
                ELSE competitor_status
              END
             WHERE id IN (?)`,
            [completedCandidateIds]
          );
        }
      });
    }
  }

  private updateBuffer: Array<{
    id: number;
    similarityScore: number;
    status: number; 
    inventory_status: string;
    candidate_id?: number;
  }> = [];

  private async flushUpdateBuffer(transactionalEntityManager) {
    if (this.updateBuffer.length === 0) return;

    // 按ID排序避免死锁
    const sortedUpdates = [...this.updateBuffer].sort((a, b) => a.id - b.id);
    const candidateIdsToUpdate = new Set<number>();

    for (const updateItem of sortedUpdates) {
      try {
        await transactionalEntityManager.update(
          AppAmzBsrCandidateCompetitorEntity,
          { id: updateItem.id },
          {
            similarity_score: updateItem.similarityScore,
            status: updateItem.status,
            inventory_status: updateItem.inventory_status
          }
        );
        if (updateItem.candidate_id) {
          candidateIdsToUpdate.add(updateItem.candidate_id);
        }
      } catch (error) {
        console.error(`更新ID ${updateItem.id} 失败:`, error);
        // 标记为失败但不中断其他更新
        await transactionalEntityManager.update(
          AppAmzBsrCandidateCompetitorEntity,
          { id: updateItem.id },
          { similarity_score: -1, status: 0, inventory_status: "0" }
        );
      }
    }

    if (candidateIdsToUpdate.size > 0) {
      try {
        const candidateIds = [...candidateIdsToUpdate];
        // 检查这些 candidate 是否还有未处理完的有效竞品 (similarity_score 为 null)
        const pendingCounts = await transactionalEntityManager.query(
          `SELECT candidate_id, COUNT(*) as count 
           FROM app_amz_bsr_candidate_competitor 
           WHERE candidate_id IN (?) 
             AND similarity_score IS NULL 
             AND image_url IS NOT NULL 
             AND status IN (1, 2, 3)
           GROUP BY candidate_id`,
          [candidateIds]
        );
        
        const pendingMap = new Map();
        pendingCounts.forEach(row => pendingMap.set(row.candidate_id, Number(row.count)));
        
        const completedCandidateIds = candidateIds.filter(id => !pendingMap.get(id));

        if (completedCandidateIds.length > 0) {
          // 只有当该 candidate 的所有竞品都处理完后，才更新状态为 3 或 13
          await transactionalEntityManager.query(
            `UPDATE app_amz_bsr_candidate SET competitor_status = 
              CASE 
                WHEN competitor_status IN (1, 2) THEN 3
                WHEN competitor_status IN (11, 12) THEN 13
                ELSE competitor_status
              END
             WHERE id IN (?)`,
            [completedCandidateIds]
          );
        }
      } catch (error) {
        console.error('更新候选产品竞品状态为识图完成(3/13)失败:', error);
      }
    }

    this.updateBuffer = [];
  }

  // 修改处理实体的方法
  private async processEntitiesInBackground(entities: AppAmzBsrCandidateCompetitorEntity[]) {
    try {
      // 创建处理队列
      const processingQueue = entities.map(entity => async () => {
        await this.aliCloudAPILimiter();

        // 使用独立事务处理每个条目
        await this.bsrCandidateCompetitorRepo.manager.transaction(async transactionalEntityManager => {
          try {
            // 获取当前最新数据防止脏写
            const freshEntity = await transactionalEntityManager.findOne(AppAmzBsrCandidateCompetitorEntity, {
              where: { id: entity.id },
              lock: { mode: "pessimistic_write" }
            });

            if (!freshEntity) {
              console.warn(`[${entity.id}] 条目已不存在，跳过处理`);
              return;
            }

            // 添加调试日志
            console.log(`[${freshEntity.id}] 开始处理 ASIN:${freshEntity.asin_competitor}`);

            let similarityScore = await this.imageSimilarityTool.getSimilarityScore(
              freshEntity.image_url,
              freshEntity.asin_candidate,
              freshEntity.asin_competitor
            );
            if (similarityScore === 0) {
              const whereConditions: any[] = [];
              if (freshEntity.candidate_id) {
                whereConditions.push({ id: freshEntity.candidate_id });
              }
              if (freshEntity.asin_candidate) {
                whereConditions.push({ asin: freshEntity.asin_candidate });
              }

              const candidate = whereConditions.length > 0
                ? await this.bsrCandidateRepo.findOne({
                    where: whereConditions,
                    select: ['id', 'asin', 'aliyun_img', 'image_url']
                  })
                : null;

              if (!candidate) {
                console.warn(`[${freshEntity.id}] 相似度为0，且在app_amz_bsr_candidate未找到数据，跳过重传: 候选ASIN=${freshEntity.asin_candidate}`);
                await transactionalEntityManager.update(
                  AppAmzBsrCandidateCompetitorEntity,
                  { id: freshEntity.id },
                  {
                    similarity_score: 0,
                    status: 0,
                    inventory_status: "0"
                  }
                );
                
                // 早退前也需要检查并更新候选产品状态
                if (freshEntity.candidate_id) {
                  const pendingCount = await transactionalEntityManager.count(AppAmzBsrCandidateCompetitorEntity, {
                    where: { 
                      candidate_id: freshEntity.candidate_id, 
                      similarity_score: IsNull(),
                      image_url: Not(IsNull()),
                      status: In([1,2,3])
                    }
                  });
                  if (pendingCount === 0) {
                    await transactionalEntityManager.query(
                      `UPDATE app_amz_bsr_candidate SET competitor_status = 
                        CASE 
                          WHEN competitor_status IN (1, 2) THEN 3
                          WHEN competitor_status IN (11, 12) THEN 13
                          ELSE competitor_status
                        END
                       WHERE id = ?`,
                      [freshEntity.candidate_id]
                    );
                  }
                }
                return;
              }

              const aliyunImg = candidate.aliyun_img || candidate.image_url;
              if (aliyunImg) {
                const uploadSuccess = await this.archiveWithImage3({
                  id: candidate.id,
                  aliyun_img: aliyunImg,
                  asin: candidate.asin || freshEntity.asin_candidate
                });

                if (uploadSuccess) {
                  similarityScore = await this.imageSimilarityTool.getSimilarityScore(
                    freshEntity.image_url,
                    freshEntity.asin_candidate,
                    freshEntity.asin_competitor
                  );
                }
              } else {
                console.warn(`[${freshEntity.id}] 相似度为0，但候选数据缺少图片，跳过重传: 候选ASIN=${freshEntity.asin_candidate}`);
              }
            }
            const titleHitScore = Number(freshEntity.title_hit_score) || 0;
            const hasTitleHitScore = freshEntity.title_hit_score !== null && freshEntity.title_hit_score !== undefined;
            const bsrCompetitorStatus = appConfig.BSR_CANDIDATE_COMPETITOR_STATUS;
            
            let status = bsrCompetitorStatus.LIBRARY.value; // 默认 3
            if (similarityScore >= 0.78) {
              status = bsrCompetitorStatus.PENDING.value; // 2
            } else if (similarityScore < 0.68 && titleHitScore >= 6) {
              status = bsrCompetitorStatus.NON_SAME.value; // 9
            } else if (hasTitleHitScore) {
              if (similarityScore >= 0.72 && titleHitScore >= 2) {
                status = bsrCompetitorStatus.PENDING.value; // 2
              } else if (similarityScore >= 0.68 && similarityScore < 0.72 && titleHitScore >= 4) {
                status = bsrCompetitorStatus.PENDING.value; // 2
              }
            }
            // 添加到更新缓冲区
            let inventory_status = "0";
            if (status === bsrCompetitorStatus.PENDING.value || status === bsrCompetitorStatus.NON_SAME.value) {
              inventory_status = "1";
            }
            
            // 直接在当前事务中更新竞品记录
            await transactionalEntityManager.update(
              AppAmzBsrCandidateCompetitorEntity,
              { id: freshEntity.id },
              {
                similarity_score: similarityScore,
                status: status,
                inventory_status: inventory_status
              }
            );

            // 检查该候选产品的所有有效竞品是否处理完毕
            if (freshEntity.candidate_id) {
              const pendingCount = await transactionalEntityManager.count(AppAmzBsrCandidateCompetitorEntity, {
                where: { 
                  candidate_id: freshEntity.candidate_id, 
                  similarity_score: IsNull(),
                  image_url: Not(IsNull()),
                  status: In([1,2,3])
                }
              });
              
              if (pendingCount === 0) {
                // 只有当该 candidate 的所有竞品都处理完后，才更新状态为 3 或 13
                await transactionalEntityManager.query(
                  `UPDATE app_amz_bsr_candidate SET competitor_status = 
                    CASE 
                      WHEN competitor_status IN (1, 2) THEN 3
                      WHEN competitor_status IN (11, 12) THEN 13
                      ELSE competitor_status
                    END
                   WHERE id = ?`,
                  [freshEntity.candidate_id]
                );
              }
            }

            console.log(`[${freshEntity.id}] 分数:${similarityScore} 状态:${status}`);
          } catch (error) {
            console.error(`[${entity.id}] 处理失败`, error);
            // 标记为错误状态
            await transactionalEntityManager.update(
              AppAmzBsrCandidateCompetitorEntity,
              { id: entity.id },
              {
                similarity_score: -1,
                status: 0,
                inventory_status: "0"
              }
            );
            throw error; // 抛出错误触发重试
          }
        });
      });

      // 控制并发为10（避免阿里云API限制）
      const CONCURRENCY = 10;
      const chunks = this.chunk(processingQueue, CONCURRENCY);

      for (const chunk of chunks) {
        await Promise.all(chunk.map(task => task().catch(e => console.error('块处理错误:', e))));
        await new Promise(resolve => setTimeout(resolve, 1000)); // 块之间间隔1秒
      }

      // 处理完成后刷新剩余的缓冲区
      await this.bsrCandidateCompetitorRepo.manager.transaction(async transactionalEntityManager => {
        await this.flushUpdateBuffer(transactionalEntityManager);
      });
    } catch (error) {
      console.error('后台处理整体失败:', error);
    }
  }

  private aliCloudRateLimiter = RateLimit(4, {
    timeUnit: 1000, // 每秒时间窗口
    uniformDistribution: true // 均匀分布请求
  });
  
  private async processEntitiesInBackground2(
    entities: AppAmzBsrCandidateEntity[],
    isArchive: boolean = false
  ) {
    try {
      const BATCH_SIZE = 1;
      const chunks = this.chunk(entities, BATCH_SIZE);
      const MAX_RETRIES = 3; // 最大重试次数
  
      // 带重试机制的单个实体处理函数
      const processEntityWithRetry = async (entity: AppAmzBsrCandidateEntity, retriesLeft: number) => {
        try {
          // 调用图片处理工具
          const cont_sign = await this.imageSimilarityTool.addImageAdvance(
            entity.image_url,
            entity.asin,
            isArchive
          );
  
          // 检查cont_sign是否有效
          if (!cont_sign) {
            throw new Error('cont_sign为空或无效');
          }
  
          // 处理成功，更新数据库
          await this.bsrCandidateRepo.update(
            { id: entity.id },
            { cont_sign: cont_sign + "", isUpload: "1" }
          );
          return true; // 处理成功
        } catch (error) {
          console.error(`处理实体 ${entity.asin} 失败（剩余重试次数: ${retriesLeft - 1}）`, error);
          
          // 如果还有重试次数，递归重试
          if (retriesLeft > 1) {
            return processEntityWithRetry(entity, retriesLeft - 1);
          }
  
          // 重试次数耗尽，标记为错误
          await this.bsrCandidateRepo.update(
            { id: entity.id },
            { cont_sign: 'ERROR', isUpload: "2" } // 同时更新isUpload为0更合理
          );
          return false; // 最终失败
        }
      };
  
      // 批量处理
      for (const batch of chunks) {
        await Promise.all(
          batch.map(entity => processEntityWithRetry(entity, MAX_RETRIES))
        );
      }
    } catch (error) {
      console.error('后台处理整体失败:', error);
    }
  }
  

  async recalculateCompetitorStatus() {
    console.log('===== 开始重新计算竞品状态 =====');
    const bsrCompetitorStatus = appConfig.BSR_CANDIDATE_COMPETITOR_STATUS;
    const competitors = await this.bsrCandidateCompetitorRepo.find({
      where: {
        status: In([2, 3, 9]),
        similarity_score: Not(IsNull())
      }
    });

    let updatedCount = 0;
    for (const comp of competitors) {
      const similarityScore = comp.similarity_score || 0;
      const titleHitScore = Number(comp.title_hit_score) || 0;
      const hasTitleHitScore = comp.title_hit_score !== null && comp.title_hit_score !== undefined;
      
      let newStatus = bsrCompetitorStatus.LIBRARY.value; // 默认 3
      if (similarityScore >= 0.78) {
        newStatus = bsrCompetitorStatus.PENDING.value; // 2
      } else if (similarityScore < 0.68 && titleHitScore >= 6) {
        newStatus = bsrCompetitorStatus.NON_SAME.value; // 9
      } else if (hasTitleHitScore) {
        if (similarityScore >= 0.72 && titleHitScore >= 2) {
          newStatus = bsrCompetitorStatus.PENDING.value; // 2
        } else if (similarityScore >= 0.68 && similarityScore < 0.72 && titleHitScore >= 4) {
          newStatus = bsrCompetitorStatus.PENDING.value; // 2
        }
      }

      if (comp.status !== newStatus) {
        await this.bsrCandidateCompetitorRepo.update(comp.id, { status: newStatus });
        updatedCount++;
      }
    }
    console.log(`===== 重新计算竞品状态完成，共更新 ${updatedCount} 条记录 =====`);
    return { success: true, updatedCount };
  }

  async batchUpdateAllStatus() {
    // 开始事务
    await this.bsrCandidateRepo.manager.transaction(async transactionalEntityManager => {
      // 1. 更新竞品已导入状态
      await transactionalEntityManager.query(`
      UPDATE app_amz_bsr_candidate a
      SET competitor_import_status = (
        SELECT IF(COUNT(b.id) > 0, 1, 0)
        FROM app_amz_bsr_candidate_competitor b
        WHERE 
          b.status in (1,2) AND
          a.asin = b.asin_candidate AND
          a.marketplace = (
            CASE b.marketplace
              WHEN 'UK' THEN '英国'
              WHEN 'DE' THEN '德国'
              WHEN 'FR' THEN '法国'
              WHEN 'ES' THEN '西班牙'
              WHEN 'IT' THEN '意大利'
              ELSE b.marketplace
            END
          )
        LIMIT 1
      )
    `);

      await transactionalEntityManager.query(`
      UPDATE app_amz_bsr_candidate a
SET competitor_full_ownership_status = (
  SELECT 
    IF(COUNT(DISTINCT 
      CASE 
        WHEN b.marketplace IN ('英国','德国','法国','西班牙','意大利') 
        THEN b.marketplace
      END
    ) = 5, 1, 0)
  FROM app_amz_bsr_candidate_competitor b
  WHERE a.asin = b.asin_candidate 
    AND b.status IN (1,2)
    AND a.id = b.candidate_id
    AND b.marketplace IN ('英国','德国','法国','西班牙','意大利')
)
    `);

      // 4. 更新关键词导入状态
      await transactionalEntityManager.query(`
      UPDATE app_amz_bsr_candidate a
      LEFT JOIN app_amz_listing_keyword k ON a.asin = k.asin
      SET a.keyword_import_status = IF(k.id IS NOT NULL, 1, 0)
    `);

      await transactionalEntityManager.query(`
      UPDATE app_amz_bsr_candidate a
      SET UKDEStatus = (
        SELECT 
          IF(
            SUM(CASE WHEN b.marketplace = '英国' THEN 1 ELSE 0 END) >= 1 AND
            SUM(CASE WHEN b.marketplace = '德国' THEN 1 ELSE 0 END) >= 1,
            1, 0
          )
        FROM app_amz_bsr_candidate_competitor b
        WHERE 
          a.id = b.candidate_id
          AND b.status = 2 
          AND b.marketplace IN ('英国', '德国')
      )
    `);
    });
  }

  // 获取每个候选的竞品国家数量
  private async getCompetitorCounts(candidates) {
    const candidateIds = candidates.map(c => c.id);
    const result = await this.bsrCandidateCompetitorRepo
      .createQueryBuilder('c')
      .select('c.candidate_id AS candidate_id')
      .addSelect('COUNT(DISTINCT c.marketplace) AS country_count')
      .where('c.candidate_id IN (:...ids)', { ids: candidateIds })
      .andWhere('c.marketplace IN (:...countries)', {
        countries: ['英国', '德国', '法国', '西班牙', '意大利']
      })
      .groupBy('c.candidate_id')
      .getRawMany();

    return new Map(result.map(r => [r.candidate_id, parseInt(r.country_count)]));
  }

  // 获取每个候选的关键词数量
  private async getKeywordCounts(candidates) {
    const asins = [...new Set(candidates.map(c => c.asin))];
    const result = await this.keywordRepo
      .createQueryBuilder('k')
      .select('k.asin AS asin')
      .addSelect('COUNT(k.id) AS keyword_count')
      .where('k.asin IN (:...asins)', { asins })
      .groupBy('k.asin')
      .getRawMany();

    return new Map(result.map(r => [r.asin, parseInt(r.keyword_count)]));
  }

  // 计算状态更新字段
  private calculateStatusUpdates(candidate, compCounts, keywordCounts) {
    return {
      competitor_import_status: compCounts.get(candidate.id) > '0' ? '1' : '0',
      profit_calculation_status: candidate.gross_profit !== null ? '1' : '0',
      competitor_full_ownership_status: compCounts.get(candidate.id) === '0' ? '1' : '0',
      keyword_import_status: keywordCounts.get(candidate.asin) > '0 ' ? '1' : '0'
    };
  }



  async archiveWithImage(params: { id: number; aliyun_img: string; asin: string }) {
    // 更新状态到已归档
    await this.bsrCandidateRepo.update(params.id, {
      status: 5,
      archive_hide_until: null
    });
    console.log('归档更新阿里云图片状态：', params.id, params.aliyun_img, params.asin)
    return this.processEntitiesInBackground2(
      [{
        id: params.id,
        image_url: params.aliyun_img,
        asin: params.asin
      } as AppAmzBsrCandidateEntity],
      true // 归档标记
    );
  }
// 服务方法修改
async batchArchiveWithImage2(candidates: { id: number; aliyun_img: string; asin: string }[]) {
  const MAX_RETRIES = 1;
  const BATCH_SIZE = 5; // 内部批量处理大小
  const results = [];

  // 分批次处理，避免一次性处理过多
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(candidate => this.processSingleCandidate(candidate, MAX_RETRIES))
    );

    // 整理结果
    batchResults.forEach((result, index) => {
      const candidate = batch[index];
      if (result.status === 'fulfilled') {
        results.push({
          id: candidate.id,
          asin: candidate.asin,
          success: true,
          message: result.value ? '处理成功' : '因相似度过高已标记为归档'
        });
      } else {
        results.push({
          id: candidate.id,
          asin: candidate.asin,
          success: false,
          message: result.reason?.message || '处理失败'
        });
      }
    });

    // 每批处理完后短暂延迟，避免服务器压力过大
    if (i + BATCH_SIZE < candidates.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

// 提取单个处理逻辑为独立方法
private async processSingleCandidate(
  candidate: { id: number; aliyun_img: string; asin: string }, 
  maxRetries: number
) {
  let retryCount = 0;
  let success = false;

  while (retryCount < maxRetries && !success) {
    try {
      console.log(`处理 ${candidate.asin} (尝试 #${retryCount + 1})`);

      // 1. 获取相似度评分
      // const similarityScore = await this.imageSimilarityTool.getSimilarityScore2(
      //   candidate.aliyun_img, 
      //   candidate.asin
      // );

      // 2. 判断是否满足过滤条件
      // if (similarityScore > 0.88) {
      //   // 更新为归档状态
      //   await this.bsrCandidateRepo.update(
      //     { id: candidate.id },
      //     { status: 5 }
      //   );
      //   console.log(`[${candidate.asin}] 相似度过高：${similarityScore}，已标记为归档`);
      //   return false;
      // }

      // console.log(`[${candidate.asin}] 通过校验，相似度评分：${similarityScore}`);

      // 3. 上传到阿里云
      await this.processEntitiesInBackground2(
        [{
          id: candidate.id,
          image_url: candidate.aliyun_img,
          asin: candidate.asin
        } as AppAmzBsrCandidateEntity],
        false  // 归档标记
      );

      success = true;
      return true;
    } catch (error) {
      console.error(`[${candidate.asin}] 尝试 #${retryCount + 1} 失败:`, error.message);
      retryCount++;

      if (retryCount < maxRetries) {
        const delay = 2000 * Math.pow(2, retryCount);
        console.log(`等待 ${delay} 毫秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // 达到最大重试次数
  console.error(`[${candidate.asin}] 处理失败，达到最大重试次数`);
  await this.bsrCandidateRepo.update(
    { id: candidate.id },
    {
      cont_sign: 'ERROR',
      isUpload: '2',
      status: 3  // 标记为处理失败状态
    }
  );
  throw new Error('达到最大重试次数');
}


  async archiveWithImage3(params: { id: number; aliyun_img: string; asin: string }) {
    const MAX_RETRIES = 1;
    let retryCount = 0;
    let success = false;

    while (retryCount < MAX_RETRIES && !success) {
      try {
        console.log(`调用archiveWithImage2方法 (尝试 #${retryCount + 1}):`, params.id, params.aliyun_img, params.asin);

        // 1. 获取相似度评分（带重试）
        const similarityScore = await this.imageSimilarityTool.getSimilarityScore2(params.aliyun_img, params.asin);


        console.log(`[${params.asin}] 通过校验，相似度评分：${similarityScore}`);

        // 4. 上传到阿里云
        await this.processEntitiesInBackground2(
          [{
            id: params.id,
            image_url: params.aliyun_img,
            asin: params.asin
          } as AppAmzBsrCandidateEntity],
          false  // 归档标记
        );

        success = true;
        return true;
      } catch (error) {
        console.error(`尝试 #${retryCount + 1} 失败:`, error.message);
        retryCount++;

        // 指数退避策略
        const delay = 2000 * Math.pow(2, retryCount);
        console.log(`等待 ${delay} 毫秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // 5次重试均失败
    console.error(`[${params.asin}] 处理失败，达到最大重试次数`);
    await this.bsrCandidateRepo.update(
      { id: params.id },
      {
        cont_sign: 'ERROR',
        isUpload: '2',
        status: 3  // 标记为处理失败状态
      }
    );
    return false;
  }

  async exportRecommendationData(candidateIds?: number[]): Promise<any> {
    try {
      // 如果传入了 candidateIds，刚进入方法时更新为 8（获取推荐位中）
      if (candidateIds && candidateIds.length > 0) {
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = 8 WHERE id IN (?) AND competitor_status = 7`,
          [candidateIds]
        );
      } else {
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = 8 WHERE competitor_status = 7`
        );
      }

      // 2026-04-03: 修改推荐位竞品获取逻辑，使用图片得分>0.72且父体销量最大的竞品(status=2)
      // 如果传入了 candidateIds，则只针对这些选品处理，否则处理所有 competitor_status=8 的选品
      let candidateCondition = `cand.competitor_status = 8 AND cand.status = 6`;
      if (candidateIds && candidateIds.length > 0) {
        candidateCondition = `cand.id IN (${candidateIds.join(',')}) AND cand.competitor_status = 8 AND cand.status = 6`;
      }

      const query = `
    WITH ranked_competitors AS (
      SELECT 
        comp.*,
        cand.marketplace AS candidate_marketplace,
        cand.item_name AS candidate_item_name,
        ROW_NUMBER() OVER (
          PARTITION BY comp.asin_candidate, comp.marketplace  
          ORDER BY CAST(IFNULL(comp.Main_monthly_sales, 0) AS UNSIGNED) DESC
        ) AS rank_order
      FROM app_amz_bsr_candidate_competitor comp
      INNER JOIN app_amz_bsr_candidate cand 
        ON comp.candidate_id = cand.id 
        AND ${candidateCondition} 
      WHERE 
        comp.marketplace IN ('英国', '德国')
        AND comp.status = 2
        AND comp.similarity_score > 0.72
    )
    SELECT 
      asin_candidate,
      candidate_id,
      candidate_marketplace,
      candidate_item_name,
      marketplace,
      asin_competitor,
      item_name AS source_item_name
    FROM ranked_competitors
    WHERE rank_order = 1
    `;

    const recommendationData = await this.bsrCandidateCompetitorRepo.query(query);
    if (!recommendationData || recommendationData.length === 0) {
      // 即使没有找到推荐竞品，也应该将状态更新为 9（推荐位获取完成）
      if (candidateIds && candidateIds.length > 0) {
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = 9 WHERE id IN (?) AND competitor_status = 8`,
          [candidateIds]
        );
      } else {
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = 9 WHERE competitor_status = 8`
        );
      }
      return { success: true, message: '无推荐位竞品数据' };
    }
    // 2. 获取产品广告数据
    const productAdsData = await Promise.all(
      recommendationData.map(async item => {
        const { ads, title } = await this.oxylabsService.getProductAds(
          item.marketplace,
          item.asin_competitor
        );
        if (ads.length === 0) {
          console.warn(`No ads found for ASIN: ${item.asin_competitor}`);
        }

        if (title) {
          await this.bsrCandidateCompetitorRepo.update(
            {
              candidate_id: item.candidate_id,
              asin_competitor: item.asin_competitor,
              marketplace: item.marketplace
            },
            {
              item_name: title
            }
          );
        }

        const scoreSourceTitle = this.getRecommendationScoreSourceTitle(item, title);
        const titleKeywords = this.extractTitleKeywords(scoreSourceTitle);
        return ads.map(ad => ({
          candidate_id: item.candidate_id,
          asin_competitor: ad.asin,
          marketplace: item.marketplace,
          asin_candidate: item.asin_candidate,
          ad_data: JSON.stringify(ad),
          source: 'recommendation',
          price: ad.price,
          title: ad.title,
          image_url: ad.images.find(img => img.includes('amazon.')),
          rating: ad.rating,
          reviews_count: ad.reviews_count,
          title_keywords: this.formatTitleKeywords(titleKeywords),
          title_hit_score: this.calculateTitleHitScore(titleKeywords, ad.title),
        }));
      })
    ).then(results => results.flat());
    // 3. 准备保存到竞品库的数据
    const entitiesToSave = productAdsData
      .filter(ad => !(ad.image_url && /\.gif($|\?)/i.test(ad.image_url.toLowerCase())))
      .map(ad => {
      const entity = new AppAmzBsrCandidateCompetitorEntity();
      entity.candidate_id = ad.candidate_id;
      entity.asin_competitor = ad.asin_competitor;
      entity.asin_candidate = ad.asin_candidate;
      entity.marketplace = ad.marketplace;
      entity.status = 2;
      entity.price = ad.price;
      entity.item_name = ad.title;
      entity.image_url = ad.image_url;
      entity.last_star = ad.rating;
      entity.review_num = ad.reviews_count;
      entity.source = 2;
      entity.title_keywords = ad.title_keywords;
      entity.title_hit_score = ad.title_hit_score;
      return entity;
    });
    // 4. 批量保存到竞品库（使用upsert避免重复）
    await this.bsrCandidateCompetitorRepo.upsert(entitiesToSave,
      ['candidate_id', 'asin_competitor', 'marketplace']
    );
    this.triggerSimilarityProcessing()
    
    // 更新这批 candidate_id 的状态为 9（推荐位获取完成）
    if (candidateIds && candidateIds.length > 0) {
      await this.bsrCandidateRepo.query(
        `UPDATE app_amz_bsr_candidate SET competitor_status = 9 WHERE id IN (?) AND competitor_status = 8`,
        [candidateIds]
      );
    } else {
      // 如果没有传 candidateIds，把所有的 8 状态更新为 9
      await this.bsrCandidateRepo.query(
        `UPDATE app_amz_bsr_candidate SET competitor_status = 9 WHERE competitor_status = 8`
      );
    }
    
    // 注释掉自动触发搜索页数据的逻辑，改为由用户手动点击按钮触发
    // this.exportSearchResultData(candidateIds).catch(err => {
    //   console.error('触发搜索页数据获取失败:', err);
    // });

    return { success: true };
  } catch(error) {
    console.error('保存广告数据失败:', error);
    // 如果处理出现异常，为了不卡死流程，将状态回退到 7 以允许重试
    if (candidateIds && candidateIds.length > 0) {
      await this.bsrCandidateRepo.query(
        `UPDATE app_amz_bsr_candidate SET competitor_status = 7 WHERE id IN (?) AND competitor_status = 8`,
        [candidateIds]
      );
    } else {
      await this.bsrCandidateRepo.query(
        `UPDATE app_amz_bsr_candidate SET competitor_status = 7 WHERE competitor_status = 8`
      );
    }
    return { success: false, message: `保存失败: ${error.message}` };
  }
}

  private async ensureUkDeCompetitorTitles(): Promise<void> {
    const groups = await this.bsrCandidateCompetitorRepo.query(`
      SELECT 
        comp.candidate_id,
        comp.marketplace
      FROM app_amz_bsr_candidate_competitor comp
      INNER JOIN app_amz_bsr_candidate cand
        ON cand.id = comp.candidate_id
        AND cand.status = 6
      WHERE 
        comp.marketplace IN ('英国', '德国')
        AND comp.status IN (1, 2)
      GROUP BY comp.candidate_id, comp.marketplace
      HAVING SUM(
        CASE 
          WHEN comp.item_name IS NOT NULL AND comp.item_name <> '' THEN 1
          ELSE 0
        END
      ) = 0
    `);

    for (const group of groups) {
      const topList = await this.bsrCandidateCompetitorRepo.query(
        `
        SELECT 
          id,
          asin_competitor,
          Main_monthly_sales
        FROM app_amz_bsr_candidate_competitor
        WHERE 
          candidate_id = ?
          AND marketplace = ?
          AND status IN (1, 2)
        ORDER BY CAST(IF(Main_monthly_sales IS NULL OR Main_monthly_sales = '', '0', Main_monthly_sales) AS UNSIGNED) DESC
        LIMIT 1
        `,
        [group.candidate_id, group.marketplace]
      );

      if (!topList || topList.length === 0) {
        continue;
      }

      const competitor = topList[0];

      try {
        const productInfo = await this.oxylabsService.getProductInfo(group.marketplace, competitor.asin_competitor);
        if (productInfo && productInfo.title) {
          await this.bsrCandidateCompetitorRepo.update(
            { id: competitor.id },
            { item_name: productInfo.title }
          );
        }
      } catch (error) {
        console.error('ensureUkDeCompetitorTitles error', error);
      }
    }
  }

  private normalizeTitleWords(title: string): string[] {
    if (!title) return [];
    const unitWords = new Set([
      'g', 'kg', 'mg', 'ug', 'lb', 'lbs', 'oz', 'ml', 'l', 'cl', 'dl',
      'mm', 'cm', 'm', 'km', 'in', 'inch', 'inches', 'ft', 'feet', 'yd',
      'mah', 'ah', 'wh', 'v', 'w', 'kw', 'a', 'ma', 'hz', 'khz', 'mhz', 'ghz',
      'db', 'kpa', 'mpa', 'pa', 'psi', 'bar', 'n', 'nm', 'rpm',
      'gb', 'mb', 'tb', 'mp', 'dpi', 'ppi', 'mah', 'c', 'f'
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

  private formatTitleKeywords(keywords: string[]): string {
    return keywords.join(' ');
  }

  private getRecommendationScoreSourceTitle(
    item: {
      marketplace: string;
      candidate_marketplace?: string;
      candidate_item_name?: string;
      source_item_name?: string;
    },
    refreshedSourceTitle?: string
  ): string {
    if (item.marketplace === item.candidate_marketplace) {
      return item.candidate_item_name || refreshedSourceTitle || item.source_item_name || '';
    }
    return refreshedSourceTitle || item.source_item_name || item.candidate_item_name || '';
  }

  private calculateTitleHitScore(titleKeywords: string[], competitorTitle: string): number {
    if (!titleKeywords?.length || !competitorTitle) return 0;
    const competitorWords = this.normalizeTitleWords(competitorTitle);
    if (!competitorWords.length) return 0;
    const competitorText = ` ${competitorWords.join(' ')} `;
    const uniqueKeywords = Array.from(new Set(titleKeywords.filter(Boolean)));
    let hitCount = 0;
    for (const keyword of uniqueKeywords) {
      if (competitorText.includes(` ${keyword} `)) {
        hitCount++;
      }
    }
    if (hitCount <= 0) return 0;
    if (hitCount >= 10) return 10;
    return hitCount
  }

  async exportSearchResultData(candidateIds?: number[]): Promise<{ success: boolean; message: string }> {
    try {
      // 刚进入方法时更新状态为 10（获取搜索页中）
      if (candidateIds && candidateIds.length > 0) {
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = 10 WHERE id IN (?) AND competitor_status = 9`,
          [candidateIds]
        );
      } else {
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = 10 WHERE competitor_status = 9`
        );
      }

      await this.ensureUkDeCompetitorTitles();

      let candidateCondition = `cand.competitor_status = 10 AND cand.status = 6`;
      if (candidateIds && candidateIds.length > 0) {
        candidateCondition = `cand.id IN (${candidateIds.join(',')}) AND cand.competitor_status = 10 AND cand.status = 6`;
      }

      // 1. 执行原始查询获取需要处理的数据
      // 2026-04-03: 修改搜索页数据竞品获取逻辑，使用图片得分>0.72且父体销量最大的竞品(status=2)
      const query = `
      WITH processed_titles AS (
        SELECT 
          c.*,
          CASE
            WHEN c.item_name IS NULL OR c.item_name = '' THEN '' 
            ELSE 
              REPLACE(
                IF( 
                  LOCATE(' ', tmp_str) > 0, 
                  SUBSTRING(tmp_str, LOCATE(' ', tmp_str) + 1),
                  ''
                ),
                ' ', 
                '+' 
              )
          END AS processed_title
        FROM (
          SELECT 
            comp.*,
            SUBSTRING_INDEX(
              TRIM(
                REPLACE(
                  REPLACE(
                    REPLACE(
                      REPLACE(
                        REPLACE(
                          REPLACE(
                            REPLACE(
                              REPLACE(
                                REPLACE(
                                  REPLACE(
                                    REPLACE(
                                    REPLACE(
                                      REPLACE(comp.item_name, ',', ''),  
                                      '–', ''), 
                                      '&', ''), 
                                    '.', ''),                        
                                  '"', ''),                         
                                '|', ''),                            
                              '  ', ' '),                         
                            '  ', ' '),                            
                          '  ', ' '),                           
                        '  ', ' '),                           
                      '  ', ' '),                                  
                    '  ', ' '),                                   
                  '  ', ' ')                                     
              ),
              ' ',  
              7     
            ) AS tmp_str
          FROM app_amz_bsr_candidate_competitor comp
          INNER JOIN app_amz_bsr_candidate cand 
            ON cand.id = comp.candidate_id 
            AND ${candidateCondition}
          WHERE 
            comp.marketplace IN ('英国', '德国')
            AND comp.status = 2
            AND comp.similarity_score > 0.72
            AND comp.item_name IS NOT NULL
        ) c
      ),
      ranked_data AS (
        SELECT 
          *,
          ROW_NUMBER() OVER (
            PARTITION BY asin_candidate, marketplace  
            ORDER BY CAST(IFNULL(Main_monthly_sales, 0) AS UNSIGNED) DESC 
          ) AS candidate_rank
        FROM processed_titles
      )
      SELECT 
        asin_candidate,
        candidate_id,
        marketplace,
        asin_competitor,
        id,
        item_name AS source_item_name,
        processed_title AS item_name  
      FROM ranked_data
      WHERE candidate_rank = 1;`;

      const data = await this.bsrCandidateCompetitorRepo.query(query);
      // console.log("data", data);

      if (!data || data.length === 0) {
        if (candidateIds && candidateIds.length > 0) {
          await this.bsrCandidateRepo.query(
            `UPDATE app_amz_bsr_candidate SET competitor_status = 11 WHERE id IN (?) AND competitor_status = 10`,
            [candidateIds]
          );
        } else {
          await this.bsrCandidateRepo.query(
            `UPDATE app_amz_bsr_candidate SET competitor_status = 11 WHERE competitor_status = 10`
          );
        }
        return { success: true, message: '无搜索页数据可获取' };
      }

      // 2. 处理每条数据，获取搜索结果
      for (const item of data) {
        try {
          let results = [];
          let retryCount = 0;
          let searchResults = [];
          const titleKeywords = this.extractTitleKeywords(item.source_item_name);
          const searchKeyword = titleKeywords.join('+');
          if (!searchKeyword) {
            console.warn(`搜索关键词为空，跳过 [${item.asin_candidate}, ${item.marketplace}]`);
            continue;
          }
          while (searchResults.length < 50 && retryCount < 10) {
            searchResults = await this.oxylabsService.searchAmazon(
              searchKeyword,
              item.marketplace,
              1,
              'bsrCandidate.exportSearchResults.searchAmazon',
            );

            if (searchResults.length < 50) {
              retryCount++;
              console.log(`第${retryCount}次重试，因为只获取到${searchResults.length}条结果`);
            } else {
              break;
            }
          }
          // 4. 保存搜索结果到竞品库
          if (searchResults) {
            await this.saveSearchResults(
              item.asin_candidate,
              item.candidate_id,
              item.marketplace,
              searchResults,
              titleKeywords
            );
          }


        } catch (error) {
          console.error(`处理失败 [${item.asin_candidate}, ${item.marketplace}]:`, error);
        }

        // 添加延迟避免请求过载
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      // 所有的处理完成后，将这批 candidate_id 的状态更新为 11（获取搜索页完成）
      if (candidateIds && candidateIds.length > 0) {
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = 11 WHERE id IN (?) AND competitor_status = 10`,
          [candidateIds]
        );
      } else {
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = 11 WHERE competitor_status = 10`
        );
      }

      this.triggerSimilarityProcessing()

      return {
        success: true,
        message: '搜索结果已成功保存到竞品库'
      };
    } catch (error) {
      console.error('导出搜索数据失败:', error);
      // 处理失败时回退到 9（推荐位获取完成），以便重试
      if (candidateIds && candidateIds.length > 0) {
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = 9 WHERE id IN (?) AND competitor_status = 10`,
          [candidateIds]
        );
      } else {
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = 9 WHERE competitor_status = 10`
        );
      }
      return {
        success: false,
        message: `处理失败: ${error.message}`
      };
    }
  }

  private async saveSearchResults(
    asinCandidate: string,
    candidateId: number,
    marketplace: string,
    results: any[],
    titleKeywords: string[]
  ): Promise<void> {
    // 过滤有效结果：确保image_url包含'm.media-amazon.com'
    const validResults = results.filter(item =>
      item.asin &&
      item.title &&
      item.price &&
      item.url_image &&
      item.url_image.includes('m.media-amazon.com') &&
      !item.title.includes('Video Widget Card') &&
      !/\.gif($|\?)/i.test(item.url_image.toLowerCase())
    );

    // 准备批量插入的数据
    const entities = validResults.map(result => {
      let imageUrl = result.url_image || '';
      if (imageUrl) {
        imageUrl = imageUrl
          .replace(/_AC_US\d+/g, '_AC_US1000')
          .replace(/_AC_UL\d+/g, '_AC_UL1000')
          .replace(/_SL\d+/g, '_SL1000')
          .replace(/SS40+/g, 'SS500')
          .replace(/_AC_SR\d+,?\d*/g, '_AC_SR1000,1000')
          .replace(/_SX\d+_SY\d+_CR[^_]*_/, '_SX1000_SY1000_CR,0,0,1000,1000_');
      }

      return {
        asin_candidate: asinCandidate,
        candidate_id: candidateId,
        marketplace: marketplace,
        asin_competitor: result.asin,
        item_name: result.title,
        price: result.price,
        image_url: imageUrl,
        last_star: result.rating || 0,
        review_num: result.reviews_count || 0,
        status: 2, // 设置状态
        source:3,
        title_keywords: this.formatTitleKeywords(titleKeywords),
        title_hit_score: this.calculateTitleHitScore(titleKeywords, result.title),
      };
    });
    const uniqueEntities = entities.filter(
      (v, i, a) => a.findIndex(t => (
        t.candidate_id === v.candidate_id &&
        t.asin_competitor === v.asin_competitor &&
        t.marketplace === v.marketplace
      )) === i
    );

    // 批量upsert插入
    if (uniqueEntities.length > 0) {
      await this.bsrCandidateCompetitorRepo.upsert(
        uniqueEntities,
        ['candidate_id', 'asin_competitor', 'marketplace'] // 冲突键
      );
    } else {
      console.warn(`未找到有效的搜索结果 [${asinCandidate}, ${marketplace}]`);
    }
  }

  async exportSelectedPurchases(ids: number[], currentUserName: string): Promise<string> {
    // 国家映射关系（中文 -> 采购数量JSON中的键）
    const COUNTRY_MAPPING: Record<string, string> = {
        '英国': 'uk',
        '德国': 'de',
    };

    // 1. 获取候选产品基本信息
    const candidates = await this.bsrCandidateRepo.find({
        where: { id: In(ids) },
        select: ['id', 'produce_name']
    });

    if (candidates.length === 0) {
        return '';
    }

    const candidateIds = candidates.map(c => c.id);

    // 2. 获取利润公共数据（成本、长宽高、实际计费重）
    const profitCommons = await this.commonRepo.find({
        where: { candidate_id: In(candidateIds) }
    });

    // 3. 获取五个国家的利润市场数据（竞品售价、配送费）
    const TARGET_COUNTRIES = Object.keys(COUNTRY_MAPPING);
    const profitMarkets = await this.marketRepo.find({
        where: {
            common_id: In(profitCommons.map(pc => pc.id)),
            country_code: In(['UK','DE'])
        }
    });
    // 4. 获取采购人数据（选择的变体和数量）- 只获取当前登录用户的数据
    const purchasers = await this.appAmzBsrCandidatePurchaserEntity.find({
        where: { 
            candidate_id: In(candidateIds.map(String)),
            purchaser: currentUserName // 只查询当前用户的数据
        },
        select: ['candidate_id', 'purchaser', 'selectedVariant', 'selected_variant_id', 'purchaserNum']
    });

    // 5. 构建CSV内容
    let csv = '\ufeff品名,国家,实际计费重(kg),成本,长(cm),宽(cm),高(cm),采购人,选择变体,采购数量,竞品售价,头程运费,配送费,汇率,税率（%）,利润,利润率\n';
    let excelRowIndex = 2;
    for (const candidate of candidates) {
        const candidateProfitCommon = profitCommons.find(pc => pc.candidate_id === candidate.id);
        const candidateProfitMarkets = profitMarkets.filter(pm => 
            profitCommons.some(pc => pc.id === pm.common_id && pc.candidate_id === candidate.id)
        );
        // 只获取当前用户在该候选产品上的采购数据
        const candidatePurchasers = purchasers.filter(p => p.candidate_id === candidate.id.toString());
        // 如果没有当前用户的采购数据，导出每个国家的行（采购数量为0）
        if (candidatePurchasers.length === 0) {
            for (const country of TARGET_COUNTRIES) {
                const market = candidateProfitMarkets.find(pm => pm.country_code === COUNTRY_MAPPING[country].toUpperCase());
                csv += this.buildCSVRow(
                    candidate,
                    country,
                    market,
                    candidateProfitCommon,
                    currentUserName, // 显示当前用户
                    null,
                    0 ,// 采购数量为0
                    excelRowIndex
                );
                excelRowIndex++;
            }
            continue;
        }

        // 处理每个采购人（这里应该是当前用户，所以只有一个）
        for (const purchaser of candidatePurchasers) {
            // 解析采购数量
            let purchaseNumObj: Record<string, number> = {};
            try {
                purchaseNumObj = typeof purchaser.purchaserNum === 'string' 
                    ? JSON.parse(purchaser.purchaserNum) 
                    : purchaser.purchaserNum || {};
            } catch (e) {
                // 解析失败时留空
            }

            // 处理每个国家
            for (const country of TARGET_COUNTRIES) {
                const market = candidateProfitMarkets.find(pm => pm.country_code === COUNTRY_MAPPING[country].toUpperCase());
                console.log("country", country);
                const countryKey = COUNTRY_MAPPING[country];
                const countryPurchaseNum = purchaseNumObj[countryKey] || 0;
                
                csv += this.buildCSVRow(
                    candidate,
                    country,
                    market,
                    candidateProfitCommon,
                    purchaser.purchaser,
                    purchaser.selectedVariant,
                    countryPurchaseNum,
                    excelRowIndex
                );
                excelRowIndex++;
            }
        }
    }

    return csv;
}

// 辅助方法：构建CSV行 - 修复数字处理问题
private buildCSVRow(
    candidate: AppAmzBsrCandidateEntity,
    country: string,
    market: AppAmzBsrProfitMarket | undefined,
    common: AppAmzBsrProfitCommon | undefined,
    purchaser: string | null,
    variant: string | null,
    purchaseNum: number | null,
    excelRowIndex: number
): string {
    // 安全转换数值为字符串（处理可能的非数字类型）
    const safeNumberToString = (value: any, fractionDigits: number, defaultValue: string = 'N/A'): string => {
        if (value === null || value === undefined) return defaultValue;
        
        try {
            const num = typeof value === 'number' ? value : parseFloat(value);
            return isNaN(num) ? defaultValue : num.toFixed(fractionDigits);
        } catch {
            return defaultValue;
        }
    };
    const profitFormula = `=(K${excelRowIndex}*0.84 - M${excelRowIndex} - (K${excelRowIndex}*(O${excelRowIndex}/100))) * N${excelRowIndex} - (D${excelRowIndex} + C${excelRowIndex}*O${excelRowIndex})`;
    const profitRateFormula = `=IF((K${excelRowIndex}*N${excelRowIndex})>0, (P${excelRowIndex}/(K${excelRowIndex}*N${excelRowIndex}))*100, 0)`;

    const fields = [
        // 品名
        `"${candidate.produce_name.replace(/"/g, '""')}"`,
        // 国家
        country,

        // 实际计费重
        safeNumberToString(common?.actual_weight, 3),
        // 成本
        safeNumberToString(common?.cost, 2),
        // 长
        safeNumberToString(common?.length, 1),
        // 宽
        safeNumberToString(common?.width, 1),
        // 高
        safeNumberToString(common?.height, 1),

        // 采购人
        purchaser ? `"${purchaser}"` : 'N/A',
        // 选择变体
        variant ? `"${variant}"` : 'N/A',
        // 采购数量（当前国家的数量）
        purchaseNum !== null ? purchaseNum.toString() : '0',

        // 竞品售价
        safeNumberToString(market?.local_price, 2),
        // 头程运费
        safeNumberToString(market?.shipping, 2),
        // 配送费
        safeNumberToString(market?.delivery_fee, 2),
        // 汇率
        safeNumberToString(market?.exchange_rate, 2),
        // 税率（%）
        safeNumberToString(market?.tax_rate, 2),
        // 利润（公式）
        `"${profitFormula}"`,
        // 利润率（公式）
        `"${profitRateFormula}"`
    ];

    return fields.join(',') + '\n';
}



  async exportSelectedCompetitors(ids: number[]): Promise<string> {
    const requiredCountries = ['英国', '德国', '法国', '西班牙', '意大利'];

    // 处理标题的辅助函数
    const processTitle = (title: string): string => {
      if (!title) return '';

      // 替换特殊字符
      let cleanedTitle = title
        .replace(/,/g, '')   // 移除逗号
        .replace(/&/g, '')   // 移除&符号
        .replace(/–/g, '')   // 移除&符号
        .replace(/-/g, '')   // 移除&符号
        .replace(/\./g, '')  // 移除句点
        .replace(/"/g, '')   // 移除双引号
        .replace(/\|/g, '')  // 移除竖线
        .replace(/\s+/g, ' '); // 压缩多个空格为一个

      // 取前7个单词，然后删除第一个单词，保留6个
      const words = cleanedTitle.split(' ').filter(word => word.length > 0);
      if (words.length > 7) {
        words.splice(0, 1); // 删除第一个单词
        return words.slice(0, 6).join(' ');
      } else if (words.length > 1) {
        words.splice(0, 1); // 删除第一个单词
        return words.join(' ');
      } else {
        return cleanedTitle;
      }
    };

    // 获取候选产品基本信息（包含原始标题和所属国家）
    const candidates = await this.bsrCandidateRepo.find({
      where: { id: In(ids) },
      select: ['id', 'asin', 'sku', 'item_name', 'marketplace']
    });

    if (candidates.length === 0) {
      return '';
    }

    // 处理候选产品的标题
    const processedTitles = new Map<number, string>();
    for (const candidate of candidates) {
      processedTitles.set(candidate.id, processTitle(candidate.item_name));
    }

    // 获取竞品数据（包含标题和销量）
    const queryResult = await this.bsrCandidateCompetitorRepo.query(`
      WITH ranked_competitors AS (
          SELECT 
              c.id AS candidate_id,
              c.asin AS asin_candidate,
              c.sku,
              c.marketplace AS candidate_marketplace,
              comp.marketplace,  
              comp.asin_competitor,
              comp.item_name,
              comp.Main_monthly_sales,
              ROW_NUMBER() OVER (
                  PARTITION BY c.id, c.asin, comp.marketplace 
                  ORDER BY 
                      CASE 
                          WHEN CAST(IF(comp.Main_monthly_sales = '', '0', comp.Main_monthly_sales) AS UNSIGNED) > 0 
                              THEN 0  
                          ELSE 1
                      END,
                      CAST(IF(comp.Main_monthly_sales = '', '0', comp.Main_monthly_sales) AS UNSIGNED) DESC,
                      CASE 
                          WHEN comp.bsr_rank = '' OR comp.bsr_rank = '0' THEN 999999999  
                          ELSE CAST(REPLACE(comp.bsr_rank, ',', '') AS UNSIGNED)
                      END,
                      CASE comp.dispatches_type
                          WHEN '1' THEN 1  
                          WHEN '0' THEN 2  
                          WHEN '2' THEN 3  
                          ELSE 4          
                      END
              ) AS row_num
          FROM app_amz_bsr_candidate c
          LEFT JOIN app_amz_bsr_candidate_competitor comp 
              ON comp.candidate_id = c.id 
              AND comp.asin_candidate = c.asin
              AND comp.status IN (1,2)
          WHERE c.id IN (${ids.map(() => '?').join(',')})
      )
      SELECT 
          candidate_id,
          asin_candidate,
          sku,
          candidate_marketplace,
          marketplace,  
          asin_competitor,
          item_name,
          Main_monthly_sales
      FROM ranked_competitors
      WHERE row_num <= 20
    `, ids);

    // 初始化候选数据
    const resultMap = new Map<number, {
      asinCandidate: string;
      sku: string;
      candidateMarketplace: string;
      competitors: Array<{
        country: string;
        asins: string[];
        bestTitle: string; // 存储格式: "销量|原始标题"
        processedTitle?: string; // 存储处理后的标题
      }>;
    }>();

    // 初始化结构
    for (const candidate of candidates) {
      resultMap.set(candidate.id, {
        asinCandidate: candidate.asin,
        sku: candidate.sku,
        candidateMarketplace: candidate.marketplace,
        competitors: requiredCountries.map(country => ({
          country,
          asins: [],
          bestTitle: '0|' // 初始化为0销量，空标题
        }))
      });
    }

    // 填充竞品数据并记录最佳标题
    for (const row of queryResult) {
      const entry = resultMap.get(row.candidate_id);
      if (!entry) continue;

      // 找到对应的国家数据
      const countryData = entry.competitors.find(c => c.country === row.marketplace);
      if (!countryData) continue;

      // 添加ASIN
      if (countryData.asins.length < 20 && row.asin_competitor) {
        countryData.asins.push(row.asin_competitor);
      }

      // 更新最佳标题（销量最高的）
      if (row.Main_monthly_sales && row.item_name) {
        const currentSales = parseFloat(row.Main_monthly_sales.replace(/,/g, '')) || 0;
        const bestSales = parseFloat(countryData.bestTitle.split('|')[0] || '0') || 0;

        // 如果当前竞品销量更高，更新最佳标题
        if (currentSales > bestSales) {
          countryData.bestTitle = `${currentSales}|${row.item_name}`;

          // 同时处理标题并存储
          countryData.processedTitle = processTitle(row.item_name);
        }
      }
    }

    // 构建CSV内容
    let csv = '\ufeff源ASIN,竞品ASIN列表,国家,SKU,日期（YYYY-MM）,标题\n';

    Array.from(resultMap.entries()).forEach(([candidateId, data]) => {
      // 获取候选产品处理后的标题
      const candidateTitle = processedTitles.get(candidateId) || '';

      // 过滤：保留英德或者有竞品的国家
      const filteredCompetitors = data.competitors.filter(({ country, asins }) =>
        country === '英国' || country === '德国' || asins.length > 0
      );

      filteredCompetitors.forEach(countryInfo => {
        // 确定使用的标题：
        // 1. 如果国家是候选产品原始国家，使用候选产品标题
        // 2. 否则使用该国销量最高的竞品标题（已经处理过的）
        let title = candidateTitle;
        if (countryInfo.country !== data.candidateMarketplace) {
          // 使用处理后的竞品标题（如果有）
          if (countryInfo.processedTitle) {
            title = countryInfo.processedTitle;
          } else {
            // 提取最佳标题（去掉销量前缀）
            const bestTitleParts = countryInfo.bestTitle.split('|');
            if (bestTitleParts.length > 1) {
              title = processTitle(bestTitleParts.slice(1).join('|'));
            }
          }
        }

        // 在每行末尾添加标题
        csv += `"${data.asinCandidate}","${countryInfo.asins.join(' ')}",${countryInfo.country},${data.sku},,"${title}"\n`;
      });
    });

    return csv;
  }


  async fetchAndSaveProductInfo(
    marketplace: string,
    asin: string,
    id: number
  ) {
    try {
      // 1. 获取产品信息
      const productInfo = await this.oxylabsService.getProductInfo(
        marketplace,
        asin,
        'bsrCandidate.fetchAndSaveProductInfo.getProductInfo',
      );
      console.log("productInfo",productInfo)
      // 2. 更新竞品记录
      await this.bsrCandidateCompetitorCustomizeRepo.update(id, {
        bullet_points: productInfo.bullet_points,
        item_name: productInfo.title,
        description: productInfo.description,
        // last_star: productInfo.stars,
        // review_num: productInfo.reviews,
        // price: productInfo.price,
        // image_url: productInfo.image_url,
        // dispatches_from: productInfo.dispatches_from,
        // sold_by: productInfo.sold_by,
        // marketplace: productInfo.marketplace,
        // weight: productInfo.weight,
        // dimensions: productInfo.dimensions,
        // bsr_html: productInfo.bsr_html,
        // date_first_available: productInfo.date_first_available
      });

      return { success: true };
    } catch (error) {
      return { success: false };
    }

  }

  
  async exportCandidate2() {

    const qb = this.bsrCandidateRepo.createQueryBuilder('candidate');
    
    qb.where("candidate.status='4'")
      .select([
        'candidate.asin AS asin',
        'candidate.produce_name AS produce_name',
        'candidate.sku AS sku',
      ])

    const data = await qb.getRawMany();
    const headers = [
      'ASIN', '产品名称', 'SKU'
    ];

    let csv = headers.join(',') + '\n';

    data.forEach(item => {
      const row = [
        item.asin,
        item.produce_name,
        item.sku
      ];
      csv += row.join(',') + '\n';
    });

    return { csv };
  }


  async addbrandNames(param: any | any[]): Promise<Object> {
    const items = Array.isArray(param) ? param : [param];
    const results = [];
  
    for (const item of items) {
      try {
        // 查找现有记录
        const existing = await this.bsrCandidateRepo.findOne({
          where: { 
            asin: item.asin, 
            marketplace: item.marketplace 
          }
        });
  
        let brandNames = [...(existing?.brand_names2 || [])];
        
        // 合并新品牌
        if (item.brand_names2 && item.brand_names2.length > 0) {
          // 去重逻辑：基于brand_name
          const existingBrands = new Set(brandNames.map(b => b.brand_name));
          
          for (const newBrand of item.brand_names2) {
            if (!existingBrands.has(newBrand.brand_name)) {
              brandNames.push(newBrand);
              existingBrands.add(newBrand.brand_name);
            }
          }
        }
  
        // 更新记录
        const result = await this.bsrCandidateRepo.upsert(
          { 
            ...item, 
            brand_names2: brandNames,
            id: existing?.id // 保持相同ID
          }, 
          ['asin', 'marketplace']
        );
  
      } catch (error) {
        results.push({ success: false, id: item.id, error: error.message });
      }
    }
    return results;
  }


  async fetchExportDataFromSellersSprite(): Promise<any> {
    if (isFetchExportDataRunning) {
      console.log('===== [竞品详情获取] 上一次任务仍在执行中，跳过本次调用 =====');
      return '上一次任务仍在执行中，跳过本次调用';
    }
    isFetchExportDataRunning = true;
    console.log('开始执行竞品详情获取任务');

    // 1. 新增：创建任务记录（核心改动）
    const competitorTask = new AppTaskManagementEntity();
    competitorTask.taskCode = `competitor-${Date.now()}`;
    competitorTask.taskName = '竞品详情获取任务'; // 关键：和前端查询条件一致
    competitorTask.taskStatus = TASK_STATUSES.RUNNING;
    competitorTask.invokeTime = new Date();
    await this.taskManagementRepo.save(competitorTask);

    try {
      // 2. 查询待处理数据总数（原有逻辑保留，新增统计）
      const countSQL = `
        SELECT COUNT(*) as total FROM (
          ${this.getCompetitorQuerySQL()}
        ) AS temp_table
      `;
      // 核心修改：用 bsrCandidateCompetitorRepo.query 替代 queryRunner.query
      const [countResult] = await this.bsrCandidateCompetitorRepo.query(countSQL);
      const totalCount = Number(countResult?.total) || 0;

      // 新增：更新任务基础信息
      competitorTask.totalCount = totalCount;
      competitorTask.completedCount = 0;
      competitorTask.executeResult = `发现${totalCount}条待处理竞品数据，开始执行`;
      await this.taskManagementRepo.save(competitorTask);

      let candidateIds: number[] = [];

      // 查找所有状态为 3, 4, 13, 14 的 candidate，即使它们没有待获取详情的竞品，也要向下流转
      const allPendingCandidatesSQL = `
        SELECT id, competitor_status FROM app_amz_bsr_candidate WHERE competitor_status IN (3, 4, 13, 14) AND status = 6
      `;
      const allPendingCandidates = await this.bsrCandidateRepo.query(allPendingCandidatesSQL);
      candidateIds = allPendingCandidates.map(c => c.id);

      if (candidateIds.length > 0) {
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = 
            CASE 
              WHEN competitor_status IN (13, 14) THEN 14
              ELSE 4 
            END
           WHERE id IN (?) AND competitor_status IN (3, 4, 13, 14)`,
          [candidateIds]
        );
      }

      // 无数据直接完成
      if (totalCount === 0) {
        competitorTask.taskStatus = TASK_STATUSES.FINISHED;
        competitorTask.executeEndTime = new Date();
        competitorTask.executeResult = '无待处理的竞品数据';
        await this.taskManagementRepo.save(competitorTask);

        if (candidateIds.length > 0) {
          // 直接更新为 6（部分标题评分比对中）或 16（再次标题评分比对中）
          await this.bsrCandidateRepo.query(
            `UPDATE app_amz_bsr_candidate SET competitor_status = 
              CASE 
                WHEN competitor_status = 14 THEN 16
                ELSE 6 
              END
             WHERE id IN (?) AND competitor_status IN (4, 14)`,
            [candidateIds]
          );

          // 区分出第一轮和第二轮的候选产品
          const firstRoundIds = allPendingCandidates.filter(c => [3, 4].includes(c.competitor_status)).map(c => c.id);
          const secondRoundIds = allPendingCandidates.filter(c => [13, 14].includes(c.competitor_status)).map(c => c.id);

          if (firstRoundIds.length > 0) {
            this.triggerTitleHitScoreProcessing(firstRoundIds, false).catch(err => {
              console.error('自动触发标题评分失败(第一轮):', err);
            });
          }
          if (secondRoundIds.length > 0) {
            this.triggerTitleHitScoreProcessing(secondRoundIds, true).catch(err => {
              console.error('自动触发标题评分失败(第二轮):', err);
            });
          }
        }
        isFetchExportDataRunning = false;
        return { success: true, message: '无数据处理', taskId: competitorTask.id };
      }

      // 3. 执行核心逻辑（传入任务ID用于进度更新）
      // 注意：这里由于上面已经将状态改为了 4/14，而 getCompetitorQuerySQL 已经支持了 3,4,13,14，所以仍然能查出数据
      // 修改：将原来的网页抓取 (fetchAndSave) 替换为基于 API 的获取方式 (fetchAndSaveByOpenApi)
      const fetchResult = await this.sellerspriteTool.fetchAndSaveByOpenApi(this.getCompetitorQuerySQL(), competitorTask.id, '选品-自动获取竞品详情 | fetchExportDataFromSellersSprite');

      // 根据执行结果更新候选产品状态 - 2026-04-10
      if (candidateIds.length > 0) {
        // 直接将候选产品状态更新为 6（部分标题评分比对中）或 16（再次标题评分比对中）
        await this.bsrCandidateRepo.query(
          `UPDATE app_amz_bsr_candidate SET competitor_status = 
            CASE 
              WHEN competitor_status = 14 THEN 16
              ELSE 6 
            END
           WHERE id IN (?) AND competitor_status IN (4, 14)`,
          [candidateIds]
        );
        
        // 异步触发标题评分对比逻辑
        const candidatesToTriggerScore = await this.bsrCandidateRepo.find({
          where: { id: In(candidateIds), competitor_status: In([6, 16]) },
          select: ['id', 'competitor_status']
        });
        
        // 区分出第一轮和第二轮的候选产品
        const firstRoundIds = candidatesToTriggerScore.filter(c => c.competitor_status === 6).map(c => c.id);
        const secondRoundIds = candidatesToTriggerScore.filter(c => c.competitor_status === 16).map(c => c.id);
        
        if (firstRoundIds.length > 0) {
          this.triggerTitleHitScoreProcessing(firstRoundIds, false).catch(err => {
            console.error('第一轮触发标题评分对比失败:', err);
          });
        }
        
        if (secondRoundIds.length > 0) {
          this.triggerTitleHitScoreProcessing(secondRoundIds, true).catch(err => {
            console.error('第二轮触发标题评分对比失败:', err);
          });
        }
      }

      // 4. 任务完成更新状态
      competitorTask.taskStatus = TASK_STATUSES.FINISHED;
      competitorTask.executeEndTime = new Date();
      competitorTask.completedCount = totalCount;
      competitorTask.executeResult = `任务完成：共处理${totalCount}条竞品数据`;
      await this.taskManagementRepo.save(competitorTask);

      isFetchExportDataRunning = false;
      return { success: true, processedCount: totalCount, taskId: competitorTask.id };
    } catch (error: any) {
      console.error('竞品详情获取任务失败:', error);
      // 失败状态更新
      competitorTask.taskStatus = TASK_STATUSES.FAILED;
      competitorTask.executeEndTime = new Date();
      competitorTask.executeResult = `任务失败：${error.message}`;
      await this.taskManagementRepo.save(competitorTask);

      // 如果失败，将状态回滚为 3（识图完成）或 13（再次识图完成）以允许重试 - 2026-04-03
      try {
        const candidatesSQL = `
          SELECT DISTINCT temp_table.candidate_id FROM (
            ${this.getCompetitorQuerySQL()}
          ) AS temp_table WHERE temp_table.candidate_id IS NOT NULL
        `;
        const candidateList = await this.bsrCandidateCompetitorRepo.query(candidatesSQL);
        const failCandidateIds = candidateList.map(c => c.candidate_id);

        if (failCandidateIds.length > 0) {
          await this.bsrCandidateRepo.query(
            `UPDATE app_amz_bsr_candidate SET competitor_status =
              CASE
                WHEN competitor_status = 14 THEN 13
                ELSE 3
              END
             WHERE id IN (?) AND competitor_status IN (4, 14)`,
            [failCandidateIds]
          );
        }
      } catch (rollbackErr) {
        console.error('状态回滚失败:', rollbackErr);
      }

      isFetchExportDataRunning = false;
      throw error;
    }
  }

  // 原有方法：提取查询SQL（修改为只获取在售状态的竞品）
  private getCompetitorQuerySQL(): string {
    return ` 
      SELECT
        comp.id as competitor_id,
        comp.asin_candidate,
        comp.marketplace,
        comp.asin_competitor,
        comp.candidate_id,
        '1' as inventory_status
      FROM app_amz_bsr_candidate_competitor comp
      INNER JOIN app_amz_bsr_candidate cand  
        ON comp.candidate_id = cand.id  and cand.status = 6
      WHERE 
        cand.competitor_status IN (3, 4, 13, 14)
        AND comp.status IN (2,9)
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
      ORDER BY comp.asin_candidate, comp.marketplace
    `;
  }

  // 触发标题评分比对并更新状态 - 2026-04-03
  private async triggerTitleHitScoreProcessing(candidateIds: number[], isSecondRound: boolean = false) {
    if (!candidateIds || candidateIds.length === 0) return;
    
    try {
      // 查找这些 candidate_id 下的所有待处理竞品数据
      // 如果是第二轮(状态16)，只查没有 title_hit_score 的记录
      let queryBuilder = this.bsrCandidateCompetitorRepo.createQueryBuilder('comp')
        .where('comp.candidate_id IN (:...candidateIds)', { candidateIds });
        
      if (isSecondRound) {
        queryBuilder = queryBuilder.andWhere('comp.title_hit_score IS NULL');
      }
      
      const competitors = await queryBuilder.getMany();
      
      if (competitors.length > 0) {
        // 执行类似于 processEntitiesInBackground 的批量处理逻辑，但重点是更新 title_hit_score 和 status
        await this.processTitleHitScoreInBackground(competitors);
      }
      
      // 所有的竞品处理完成后，更新 candidate 的状态
      const targetStatus = isSecondRound ? 17 : 7;
      const prevStatus = isSecondRound ? 16 : 6;
      await this.bsrCandidateRepo.query(
        `UPDATE app_amz_bsr_candidate SET competitor_status = ? WHERE id IN (?) AND competitor_status = ?`,
        [targetStatus, candidateIds, prevStatus]
      );

      // 恢复自动触发推荐位数据和关键词获取的逻辑，以解决流程卡在状态7或17的问题
      if (!isSecondRound) {
        this.exportRecommendationData(candidateIds).catch(err => {
          console.error('触发推荐位数据获取失败:', err);
        });
      } else {
        await this.bsrCandidateRepo.update({ id: In(candidateIds) }, { competitor_status: 18 });
        this.sifKeywordService.fetchKeywordsForCandidatesUKDE(candidateIds).catch(err => {
          console.error('第二轮(状态17)触发 SIF 获取关键词失败:', err);
        });
      }
      
    } catch (error) {
      console.error('批量处理标题评分异常:', error);
      // 如果处理出现异常，为了不卡死流程，这里可以选择将状态回退到前一状态以允许重试
      const fallbackStatus = isSecondRound ? 15 : 5;
      const prevStatus = isSecondRound ? 16 : 6;
      await this.bsrCandidateRepo.query(
        `UPDATE app_amz_bsr_candidate SET competitor_status = ? WHERE id IN (?) AND competitor_status = ?`,
        [fallbackStatus, candidateIds, prevStatus]
      );
    }
  }

  private async processTitleHitScoreInBackground(entities: AppAmzBsrCandidateCompetitorEntity[]) {
    try {
      // 1. 预先计算并缓存每个 candidate_id + marketplace 的最高销量竞品标题
      const bestTitleCache: Record<string, string[]> = {};
      const uniqueCombos = Array.from(new Set(entities.map(e => `${e.candidate_id}_${e.marketplace}`)));
      
      for (const combo of uniqueCombos) {
        const [candidateIdStr, marketplace] = combo.split('_');
        const candidateId = parseInt(candidateIdStr, 10);
        
        // 查找当前 candidate 和 marketplace 下，Main_monthly_sales 最高的竞品
        const bestCompetitor = await this.bsrCandidateCompetitorRepo.createQueryBuilder('comp')
          .where('comp.candidate_id = :candidateId', { candidateId })
          .andWhere('comp.marketplace = :marketplace', { marketplace })
          .andWhere('comp.item_name IS NOT NULL')
          .andWhere('comp.item_name != ""')
          .orderBy('CAST(IFNULL(comp.Main_monthly_sales, "0") AS UNSIGNED)', 'DESC')
          .getOne();
          
        if (bestCompetitor && bestCompetitor.item_name) {
          bestTitleCache[combo] = this.extractTitleKeywords(bestCompetitor.item_name);
        } else {
          // Fallback：如果没有找到任何竞品的标题，退回到使用候选产品本身的标题
          const candidate = await this.bsrCandidateRepo.findOne({
            where: { id: candidateId },
            select: ['id', 'item_name', 'produce_name']
          });
          if (candidate) {
            const candidateTitle = candidate.item_name || candidate.produce_name || '';
            bestTitleCache[combo] = this.extractTitleKeywords(candidateTitle);
          } else {
            bestTitleCache[combo] = [];
          }
        }
      }

      // 创建处理队列
      const processingQueue = entities.map(entity => async () => {
        await this.bsrCandidateCompetitorRepo.manager.transaction(async transactionalEntityManager => {
          try {
            // 重新获取最新数据
            const freshEntity = await transactionalEntityManager.findOne(AppAmzBsrCandidateCompetitorEntity, {
              where: { id: entity.id },
              lock: { mode: "pessimistic_write" }
            });

            if (!freshEntity) return;

            // 1. 计算新的 title_hit_score
            // 从缓存获取该国家下销量最高的竞品标题核心词
            const cacheKey = `${freshEntity.candidate_id}_${freshEntity.marketplace}`;
            const titleKeywords = bestTitleCache[cacheKey] || [];

            const titleHitScore = this.calculateTitleHitScore(titleKeywords, freshEntity.item_name);
            const similarityScore = freshEntity.similarity_score || 0; // 依赖之前的图片识图分数
            
            // 2. 复用判断逻辑计算 status
            const bsrCompetitorStatus = appConfig.BSR_CANDIDATE_COMPETITOR_STATUS;
            
            let status = bsrCompetitorStatus.LIBRARY.value; // 默认 3
            if (similarityScore >= 0.78) {
              status = bsrCompetitorStatus.PENDING.value; // 2
            } else if (similarityScore < 0.68 && titleHitScore >= 6) {
              status = bsrCompetitorStatus.NON_SAME.value; // 9
            } else {
              if (similarityScore >= 0.72 && titleHitScore >= 2) {
                status = bsrCompetitorStatus.PENDING.value; // 2
              } else if (similarityScore >= 0.68 && similarityScore < 0.72 && titleHitScore >= 4) {
                status = bsrCompetitorStatus.PENDING.value; // 2
              }
            }

            // 3. 确定库存状态
            let inventory_status = "0";
            if (status === bsrCompetitorStatus.PENDING.value || status === bsrCompetitorStatus.NON_SAME.value) {
              inventory_status = "1";
            }

            // 4. 更新当前记录
            await transactionalEntityManager.update(
              AppAmzBsrCandidateCompetitorEntity,
              { id: freshEntity.id },
              {
                title_keywords: this.formatTitleKeywords(titleKeywords),
                title_hit_score: titleHitScore,
                status: status,
                inventory_status: inventory_status
              }
            );

            // console.log(`[${freshEntity.id}] 标题评分已更新 标题分:${titleHitScore} 状态:${status}`);
          } catch (error) {
            console.error(`[${entity.id}] 标题评分处理失败`, error);
          }
        });
      });

      // 控制并发为10
      const CONCURRENCY = 10;
      const chunks = this.chunk(processingQueue, CONCURRENCY);

      for (const chunk of chunks) {
        await Promise.all(chunk.map(task => task().catch(e => console.error('块处理错误:', e))));
        await new Promise(resolve => setTimeout(resolve, 500)); // 适当间隔
      }
    } catch (error) {
      console.error('后台标题评分处理整体失败:', error);
      throw error;
    }
  }

  /**
   * 按顺序执行：获取搜索页数据 -> 获取推荐位数据 -> 获取竞品详情
   * 2025-01-28 Integrated Service Method
   */
  async executeSequentialExportTask() {
    console.log('===== 开始执行整合定时任务 =====');
    const startTime = Date.now();

    try {
      // 1. 获取搜索页数据
      console.log('Step 1: 开始获取搜索页数据 (exportSearchResultData)...');
      await this.exportSearchResultData();
      console.log('Step 1: 获取搜索页数据完成');

      // 2. 获取推荐位数据
      console.log('Step 2: 开始获取推荐位数据 (exportRecommendationData)...');
      await this.exportRecommendationData();
      console.log('Step 2: 获取推荐位数据完成');

      // 3. 获取竞品详情
      console.log('Step 3: 开始获取竞品详情 (fetchExportDataFromSellersSprite)...');
      await this.fetchExportDataFromSellersSprite();
      console.log('Step 3: 获取竞品详情完成');

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`===== 整合定时任务全部完成，耗时 ${duration} 秒 =====`);
      return { success: true, message: '整合任务执行完成' };
    } catch (error) {
      console.error('整合定时任务执行失败:', error);
      throw error;
    }
  }

  /**
   * 自动化流水线轮询任务
   * 供定时任务 (cron job) 调用，按照状态机的状态，自动推进到下一个环节。
   * 每次调用只推进一个状态（以防超时和并发问题）
   */
  private async handleFirstRoundImageRetryAfterDone() {
    const candidates = await this.bsrCandidateRepo.find({
      where: { competitor_status: 3, status: 6 },
      select: [
        'id',
        'asin',
        'image_url',
        'image_url2',
        'image_url3',
        'image_url4',
        'image_url5',
        'image_url6',
        'aliyun_img',
      ],
    });

    if (candidates.length === 0) {
      return { retriedCount: 0, exhaustedCount: 0, normalCount: 0 };
    }

    const candidateIds = candidates.map(candidate => candidate.id);
    const countRows = await this.bsrCandidateCompetitorRepo.query(
      `SELECT candidate_id, marketplace, COUNT(*) AS count
       FROM app_amz_bsr_candidate_competitor
       WHERE candidate_id IN (?)
         AND marketplace IN ('英国', '德国')
         AND status IN (1, 2, 9)
       GROUP BY candidate_id, marketplace`,
      [candidateIds]
    );
    const countsByCandidateId = new Map<number, Record<string, number>>();

    for (const row of countRows) {
      const candidateId = Number(row.candidate_id);
      const countryCounts = countsByCandidateId.get(candidateId) || {};
      countryCounts[row.marketplace] = Number(row.count) || 0;
      countsByCandidateId.set(candidateId, countryCounts);
    }

    let retriedCount = 0;
    let exhaustedCount = 0;
    let normalCount = 0;

    for (const candidate of candidates) {
      const countryCounts = countsByCandidateId.get(candidate.id) || {};
      const decision = resolveImageRetryAfterLowCompetitors({
        candidate,
        countryCounts: {
          英国: countryCounts.英国 || 0,
          德国: countryCounts.德国 || 0,
        },
      });

      if (decision.status === 3) {
        normalCount++;
        continue;
      }

      if (decision.shouldRetry && decision.nextImageUrl) {
        await this.bsrCandidateRepo.update(
          { id: candidate.id },
          {
            competitor_status: BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY,
            aliyun_img: decision.nextImageUrl,
            aliyun_score: null,
            cont_sign: 'IMAGE_RETRY',
            isUpload: '0',
          } as any
        );
        retriedCount++;
        console.log(
          `[自动流转] 选品 ${candidate.id} 识图完成后缺少竞品(${decision.missingCountries.join(',')}), 切换下一张图并进入 3-1`
        );
      } else {
        await this.bsrCandidateRepo.update(
          { id: candidate.id },
          { competitor_status: BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY_EXHAUSTED }
        );
        exhaustedCount++;
        console.log(
          `[自动流转] 选品 ${candidate.id} 识图完成后缺少竞品(${decision.missingCountries.join(',')}), 图片已用完并停留在 3-2`
        );
      }
    }

    return { retriedCount, exhaustedCount, normalCount };
  }

  async autoProcessCandidateWorkflow() {
    if (isAutoProcessCandidateWorkflowRunning) {
      console.log('===== [自动流转] 上一次任务仍在执行中，跳过本次扫描 =====');
      return '上一次任务仍在执行中，跳过本次扫描';
    }
    isAutoProcessCandidateWorkflowRunning = true;
    console.log('===== [自动流转] 开始扫描待处理数据 =====');

    let triggeredActions = [];

    try {
      // 0. 在处理前，先进行一次去重操作，防止重复数据干扰后续流程
      try {
        console.log('[自动流转] 开始执行全局去重...');
        await this.removeDuplicateCompetitors();
        console.log('[自动流转] 全局去重完成');
      } catch (dedupErr) {
        console.error('[自动流转] 去重失败:', dedupErr);
      }

      // 0. 清理孤儿竞品数据：删除 candidate_id 或 asin_candidate 为空的异常数据，防止它们一直停留在中间状态被定时任务获取
      try {
        const deleteResult = await this.bsrCandidateCompetitorRepo.query(
          `DELETE FROM app_amz_bsr_candidate_competitor WHERE candidate_id IS NULL AND asin_candidate IS NULL`
        );
        if (deleteResult && deleteResult.affectedRows > 0) {
          console.log(`[清理未绑定竞品数据] 删除了 ${deleteResult.affectedRows} 条缺失 candidate_id 和 asin_candidate 的竞品记录`);
        }
      } catch (cleanErr) {
        console.error('清理未绑定孤儿竞品数据失败:', cleanErr);
      }

      try {
        const reminderResult = await this.autoRemindPendingPurchaserDecisions();
        if (reminderResult.remindedCount > 0 || reminderResult.skippedCount > 0) {
          triggeredActions.push(
            `采购待决策钉钉提醒 ${reminderResult.remindedCount} 条，跳过 ${reminderResult.skippedCount} 条`
          );
          console.log(
            `[采购待决策提醒] 已提醒 ${reminderResult.remindedCount} 条，跳过 ${reminderResult.skippedCount} 条`
          );
        }

        const timeoutResult = await this.autoExpirePendingPurchaserDecisions();
        if (timeoutResult.expiredCount > 0) {
          triggeredActions.push(
            `采购待决策超时自动不做 ${timeoutResult.expiredCount} 条，释放 ${timeoutResult.releasedCount} 条`
          );
          console.log(
            `[采购待决策超时] 自动不做 ${timeoutResult.expiredCount} 条，释放 ${timeoutResult.releasedCount} 条`
          );
        }
      } catch (timeoutErr) {
        console.error('[采购待决策超时] 自动流转失败:', timeoutErr);
      }

      try {
        const reserveReleaseResult = await this.autoReleaseReservedCandidates();
        if (reserveReleaseResult.releasedCount > 0) {
          triggeredActions.push(`预留超时自动进入选品管理 ${reserveReleaseResult.releasedCount} 条`);
          console.log(`[预留超时] 自动进入选品管理 ${reserveReleaseResult.releasedCount} 条`);
        }
      } catch (reserveErr) {
        console.error('[预留超时] 自动流转失败:', reserveErr);
      }

      const queuedImageRetryCount = await this.bsrCandidateRepo.count({
        where: {
          competitor_status: BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY,
          status: 6,
        },
      });
      if (queuedImageRetryCount > 0) {
        await this.bsrCandidateRepo.update(
          {
            competitor_status: BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY,
            status: 6,
          },
          { competitor_status: 0, cont_sign: 'IMAGE_RETRY' }
        );
        triggeredActions.push(`识图回跳重新进入八爪鱼抓取 (${queuedImageRetryCount} 条)`);
        console.log(`[自动流转] 发现 ${queuedImageRetryCount} 条 3-1 识图回跳数据，已回到 0 等待重新抓取`);
      }

      // 0. 待处理数据进入 (0或null) -> 触发八爪鱼获取竞品 (0 -> 1)
      const qb0 = this.bsrCandidateRepo.createQueryBuilder('candidate');
      const count0 = await qb0.where('candidate.status = :status', { status: 6 })
                              .andWhere('(candidate.competitor_status = 0 OR candidate.competitor_status IS NULL)')
                              .getCount();
      if (count0 > 0) {
        console.log(`[自动流转] 发现 ${count0} 条状态为 0或null (等待八爪鱼抓取) 的数据，自动触发获取竞品`);
        // 先把 null 更新为 0，防止重复触发
        await this.bsrCandidateRepo.createQueryBuilder()
          .update()
          .set({ competitor_status: 0 })
          .where('status = :status', { status: 6 })
          .andWhere('competitor_status IS NULL')
          .execute();
          
        await this.startBzyShiTu();
        triggeredActions.push(`已触发八爪鱼获取竞品 (${count0} 条)`);
      }

      // 1. 第一轮比对完成 (7) -> 触发获取推荐位 (8 -> 9)
      const count7 = await this.bsrCandidateRepo.count({ where: { competitor_status: In([7, 8]), status: 6 } });
      if (count7 > 0) {
        console.log(`[自动流转] 发现 ${count7} 条状态为 7或8 的数据，自动触发获取推荐位`);
        await this.exportRecommendationData();
        triggeredActions.push(`已触发获取推荐位 (${count7} 条)`);
      }

      // 2. 推荐位获取完成 (9) -> 触发获取搜索页 (10 -> 11)
      const count9 = await this.bsrCandidateRepo.count({ where: { competitor_status: In([9, 10]), status: 6 } });
      if (count9 > 0) {
        console.log(`[自动流转] 发现 ${count9} 条状态为 9或10 的数据，自动触发获取搜索页`);
        await this.exportSearchResultData();
        triggeredActions.push(`已触发获取搜索页 (${count9} 条)`);
      }

      // 3. 第二轮比对完成 (17) -> 触发获取关键词 (18 -> 19)
      const count17 = await this.bsrCandidateRepo.count({ where: { competitor_status: 17, status: 6 } });
      if (count17 > 0) {
        const candidates17 = await this.bsrCandidateRepo.find({ 
          where: { competitor_status: 17, status: 6 },
          select: ['id']
        });
        const ids17 = candidates17.map(c => c.id);
        console.log(`[自动流转] 发现 ${ids17.length} 条状态为 17 (第二轮比对完成) 的数据，自动触发获取关键词`);
        
        // 关键：先将状态更新为 18，防止定时任务重复抓取
        await this.bsrCandidateRepo.update({ id: In(ids17) }, { competitor_status: 18 });
        
        await this.sifKeywordService.fetchKeywordsForCandidatesUKDE(ids17);
        triggeredActions.push(`已触发获取关键词 (${ids17.length} 条)`);
      }

      const imageRetryResult = await this.handleFirstRoundImageRetryAfterDone();
      if (imageRetryResult.retriedCount > 0 || imageRetryResult.exhaustedCount > 0) {
        triggeredActions.push(
          `识图完成后回跳检查: 回跳 ${imageRetryResult.retriedCount} 条, 图片用完 ${imageRetryResult.exhaustedCount} 条`
        );
      }

      // 4. 容错检查：是否有数据因为网络问题卡在了获取详情（3, 4, 13, 14）
      // 这些状态本应该由识图完成后自动触发，但如果失败了，定时任务会重新拉起
      const countPendingApi = await this.bsrCandidateRepo.count({ 
        where: { competitor_status: In([3, 4, 13, 14]), status: 6 } 
      });
      if (countPendingApi > 0) {
        console.log(`[自动流转] 发现 ${countPendingApi} 条等待获取详情的数据，自动重新触发卖家精灵 API`);
        
        // 兜底检测：对于卡在 4 和 14（拉取中）的数据，检查是否实际上已经拉取完成
        const stuckApiCandidates = await this.bsrCandidateRepo.find({
          where: { competitor_status: In([4, 14]), status: 6 },
          select: ['id', 'competitor_status']
        });
        
        for (const candidate of stuckApiCandidates) {
          const pendingCount = await this.bsrCandidateCompetitorRepo.createQueryBuilder('comp')
            .where('comp.candidate_id = :candidateId', { candidateId: candidate.id })
            .andWhere('comp.status IN (:...status)', { status: [2, 6, 9] })
            .andWhere('(comp.Main_monthly_sales IS NULL OR comp.last_star IS NULL)')
            .getCount();
            
          if (pendingCount === 0) {
            const nextStatus = candidate.competitor_status === 4 ? 6 : 16; // 6:部分比对中, 16:再次比对中
            console.log(`[自动流转兜底] 选品 ${candidate.id} 实际详情已拉取完成，强制从 ${candidate.competitor_status} 推进到 ${nextStatus}`);
            await this.bsrCandidateRepo.update({ id: candidate.id }, { competitor_status: nextStatus });
          }
        }

        await this.fetchExportDataFromSellersSprite();
        triggeredActions.push(`已重试触发获取竞品详情 (${countPendingApi} 条)`);
      }

      // 5. 容错检查：是否有数据卡在了识图中 (1, 2, 11, 12)
      // 如果识图一直不完成，可能是阿里云API断了，重新把1放入处理队列
      const countPendingSimilarity = await this.bsrCandidateRepo.count({
        where: { competitor_status: In([1, 2, 11, 12]), status: 6 }
      });
      if (countPendingSimilarity > 0) {
        console.log(`[自动流转] 发现 ${countPendingSimilarity} 条等待识图的数据，自动重新触发识图流程`);
        
        // 兜底检测：对于卡在 2 和 12（识图中/再次识图中）的数据，检查是否实际上已经识图完成
        const stuckSimilarityCandidates = await this.bsrCandidateRepo.find({
          where: { competitor_status: In([2, 12]), status: 6 },
          select: ['id', 'competitor_status']
        });
        
        for (const candidate of stuckSimilarityCandidates) {
          const pendingCount = await this.bsrCandidateCompetitorRepo.createQueryBuilder('comp')
            .where('comp.candidate_id = :candidateId', { candidateId: candidate.id })
            .andWhere('comp.similarity_score IS NULL')
            .andWhere('comp.image_url IS NOT NULL')
            .andWhere('comp.status IN (:...status)', { status: [1, 2, 3] })
            .getCount();
            
          if (pendingCount === 0) {
            const nextStatus = candidate.competitor_status === 2 ? 3 : 13;
            console.log(`[自动流转兜底] 选品 ${candidate.id} 实际已识图完成，强制从 ${candidate.competitor_status} 推进到 ${nextStatus}`);
            await this.bsrCandidateRepo.update({ id: candidate.id }, { competitor_status: nextStatus });
          }
        }

        // 这里调用的 triggerSimilarityProcessing 内部会自动处理 1 和 11 的数据
        await this.triggerSimilarityProcessing();
        triggeredActions.push(`已重试触发识图 (${countPendingSimilarity} 条)`);
      }

      // 6. 容错检查：是否有数据卡在了标题评分中 (6, 16)
      const countPendingTitleScore = await this.bsrCandidateRepo.count({
        where: { competitor_status: In([6, 16]), status: 6 }
      });
      if (countPendingTitleScore > 0) {
        console.log(`[自动流转] 发现 ${countPendingTitleScore} 条等待标题评分的数据，自动重新触发标题评分流程`);
        
        // 兜底检测：对于卡在 6 和 16（比对中）的数据，检查是否实际上已经比对完成
        const stuckTitleScoreCandidates = await this.bsrCandidateRepo.find({
          where: { competitor_status: In([6, 16]), status: 6 },
          select: ['id', 'competitor_status']
        });
        
        for (const candidate of stuckTitleScoreCandidates) {
          const pendingCount = await this.bsrCandidateCompetitorRepo.createQueryBuilder('comp')
            .where('comp.candidate_id = :candidateId', { candidateId: candidate.id })
            .andWhere('comp.status IN (:...status)', { status: [2, 6, 9] })
            .andWhere('comp.title_hit_score IS NULL')
            .getCount();
            
          if (pendingCount === 0) {
            const nextStatus = candidate.competitor_status === 6 ? 7 : 17; 
            console.log(`[自动流转兜底] 选品 ${candidate.id} 实际标题比对已完成，强制从 ${candidate.competitor_status} 推进到 ${nextStatus}`);
            await this.bsrCandidateRepo.update({ id: candidate.id }, { competitor_status: nextStatus });
          }
        }

        const candidates6 = await this.bsrCandidateRepo.find({ where: { competitor_status: 6, status: 6 }, select: ['id'] });
        if (candidates6.length > 0) {
          await this.triggerTitleHitScoreProcessing(candidates6.map(c => c.id), false);
        }
        
        const candidates16 = await this.bsrCandidateRepo.find({ where: { competitor_status: 16, status: 6 }, select: ['id'] });
        if (candidates16.length > 0) {
          await this.triggerTitleHitScoreProcessing(candidates16.map(c => c.id), true);
        }
        
        triggeredActions.push(`已重试触发标题评分 (${countPendingTitleScore} 条)`);
      }

      // 7. 容错检查：是否有数据卡在了推荐位获取中 (8) 和 搜索页获取中 (10)
      const countPendingExport = await this.bsrCandidateRepo.count({
        where: { competitor_status: In([8, 10]), status: 6 }
      });
      if (countPendingExport > 0) {
        console.log(`[自动流转] 发现 ${countPendingExport} 条等待获取推荐位或搜索页的数据，自动重新触发`);
        
        const stuckExportCandidates = await this.bsrCandidateRepo.find({
          where: { competitor_status: In([8, 10]), status: 6 },
          select: ['id', 'competitor_status']
        });

        for (const candidate of stuckExportCandidates) {
          const nextStatus = candidate.competitor_status === 8 ? 9 : 11;
          
          // 因为推荐位和搜索页目前是直接基于 candidate 主体进行的爬虫调度，如果卡住时间过长（比如15分钟没动静）
          // 我们这里做一个简易的强制放行（或者是通过检查具体下挂的爬虫任务表状态，这里按超时强制放行处理）
          // 由于这两个状态容易死锁，我们在自动重试的同时，如果发现已经卡在 8/10，并且有相关的新数据回来，就强制推进
          const pendingCount = await this.bsrCandidateCompetitorRepo.createQueryBuilder('comp')
            .where('comp.candidate_id = :candidateId', { candidateId: candidate.id })
            .andWhere('comp.status = :status', { status: candidate.competitor_status === 8 ? 8 : 10 }) // 假设通过某种标记判断，这里用一种宽松策略
            .getCount();
            
          if (pendingCount > 0) {
            console.log(`[自动流转兜底] 选品 ${candidate.id} 尝试强制从 ${candidate.competitor_status} 推进到 ${nextStatus}`);
            await this.bsrCandidateRepo.update({ id: candidate.id }, { competitor_status: nextStatus });
          }
        }
        
        // 分别重新触发
        if (stuckExportCandidates.some(c => c.competitor_status === 8)) await this.exportRecommendationData();
        if (stuckExportCandidates.some(c => c.competitor_status === 10)) await this.exportSearchResultData();
        
        triggeredActions.push(`已重试触发推荐位/搜索页获取 (${countPendingExport} 条)`);
      }
      
      // 8. 容错检查：是否有数据卡在了关键词获取中 (18)
      const countPendingKeyword = await this.bsrCandidateRepo.count({
        where: { competitor_status: 18, status: 6 }
      });
      if (countPendingKeyword > 0) {
        console.log(`[自动流转] 发现 ${countPendingKeyword} 条等待获取关键词的数据，自动重新触发 SIF 接口`);
        
        const stuckKeywordCandidates = await this.bsrCandidateRepo.find({
          where: { competitor_status: 18, status: 6 },
          select: ['id', 'asin']
        });
        
        const idsToRetry = [];
        for (const candidate of stuckKeywordCandidates) {
          // 如果选品下已经成功获取到了关键词数据（哪怕只有1条），并且状态仍是18，就视为完成
          // 注意：app_amz_listing_keyword 中没有 candidate_id 字段，只有 asin
          const hasKeywords = await this.bsrCandidateCompetitorRepo.manager.query(
            `SELECT 1 FROM app_amz_listing_keyword WHERE asin = ? LIMIT 1`, 
            [candidate.asin]
          );
          if (hasKeywords.length > 0) {
            console.log(`[自动流转兜底] 选品 ${candidate.id} 实际已有关键词数据，强制从 18 推进到 19`);
            await this.bsrCandidateRepo.update({ id: candidate.id }, { competitor_status: 19 });
          } else {
            idsToRetry.push(candidate.id);
          }
        }
        
        if (idsToRetry.length > 0) {
          await this.sifKeywordService.fetchKeywordsForCandidatesUKDE(idsToRetry);
          triggeredActions.push(`已重试触发获取关键词 (${idsToRetry.length} 条)`);
        }
      }

      // 9. 状态 19 自动触发竞品关键词自然广告得分
      const candidates19 = await this.bsrCandidateRepo.find({
        where: { competitor_status: 19, status: 6 },
        select: ['id', 'asin']
      });
      if (candidates19.length > 0) {
        console.log(`[自动流转] 发现 ${candidates19.length} 条状态为 19 的数据，自动触发竞品关键词自然广告得分`);
        for (const c of candidates19) {
          await this.bsrCandidateRepo.update({ id: c.id }, { competitor_status: 20 });
          this.sifKeywordService.scoreCompetitorKeywordOrganicAd(c.id).catch(err => {
            console.error(`[自动流转] 选品 ${c.id} 得分计算失败:`, err?.message || err);
          });
        }
        triggeredActions.push(`已触发竞品关键词自然广告得分 (${candidates19.length} 条)`);
      }

      console.log('===== [自动流转] 扫描结束 =====');
      return triggeredActions.length > 0 ? triggeredActions.join('; ') : '暂无需要自动流转的数据';
    } catch (error) {
      console.error('[自动流转] 定时任务执行失败:', error);
      throw error;
    } finally {
      isAutoProcessCandidateWorkflowRunning = false;
    }
  }
  
}
