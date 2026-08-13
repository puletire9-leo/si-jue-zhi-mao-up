import { Inject, Provide, Scope, ScopeEnum } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { ILogger } from '@midwayjs/logger';
import { In, Repository } from 'typeorm';
import { BaseSysUserEntity } from '../../base/entity/sys/user';
import { BaseSysUserRoleEntity } from '../../base/entity/sys/user_role';
import { BaseSysRoleEntity } from '../../base/entity/sys/role';
import { AppAmzBsrCandidatePurchaserEntity } from '../entity/bsr_candidate_purchaser';
import { DingTalkNotifyService } from './dingtalk_notify';

export type StaffProfileForDingTalk = {
  userId: number;
  name: string;
  phone?: string | null;
};

/** 采购决策「做」：is_generate = 2 */
const PURCHASER_DECISION_DO = 2;

export function isOperatorRole(role: Pick<BaseSysRoleEntity, 'name' | 'label'>): boolean {
  const text = `${role.name || ''}|${role.label || ''}`.toLowerCase();
  return text.includes('运营') || text.includes('operator');
}

@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class ListingNotifyTargetsService {
  @InjectEntityModel(BaseSysUserEntity)
  userRepo: Repository<BaseSysUserEntity>;

  @InjectEntityModel(BaseSysUserRoleEntity)
  userRoleRepo: Repository<BaseSysUserRoleEntity>;

  @InjectEntityModel(BaseSysRoleEntity)
  roleRepo: Repository<BaseSysRoleEntity>;

  @InjectEntityModel(AppAmzBsrCandidatePurchaserEntity)
  purchaserRepo: Repository<AppAmzBsrCandidatePurchaserEntity>;

  @Inject()
  dingTalkNotifyService: DingTalkNotifyService;

  @Inject()
  logger: ILogger;

  /** 角色 name/label 含「助理」或 assistant（与 design_task 列表过滤一致） */
  isAssistantRole(role: Pick<BaseSysRoleEntity, 'name' | 'label'>): boolean {
    const text = `${role.name || ''}|${role.label || ''}`.toLowerCase();
    return text.includes('助理') || text.includes('assistant');
  }

  isOperatorRole(role: Pick<BaseSysRoleEntity, 'name' | 'label'>): boolean {
    return isOperatorRole(role);
  }

  /** 系统中拥有助理类角色的启用用户（姓名 + 手机） */
  async listAssistantStaffProfiles(): Promise<StaffProfileForDingTalk[]> {
    const roles = await this.roleRepo.find({ select: ['id', 'name', 'label'] });
    const assistantRoleIds = roles.filter(r => this.isAssistantRole(r)).map(r => Number(r.id));
    if (!assistantRoleIds.length) {
      this.logger.warn('[ListingNotifyTargets] 未找到含「助理」的角色');
      return [];
    }

    const userRoles = await this.userRoleRepo.find({
      where: { roleId: In(assistantRoleIds) },
      select: ['userId'],
    });
    const userIds = Array.from(
      new Set(userRoles.map(x => Number(x.userId)).filter(id => id > 0))
    );
    if (!userIds.length) return [];

    const users = await this.userRepo.find({
      where: { id: In(userIds), status: 1 },
      select: ['id', 'name', 'phone'],
    });

    return this.usersToProfiles(users);
  }

  async listOperatorStaffProfiles(): Promise<StaffProfileForDingTalk[]> {
    const roles = await this.roleRepo.find({ select: ['id', 'name', 'label'] });
    const operatorRoleIds = roles.filter(r => this.isOperatorRole(r)).map(r => Number(r.id));
    if (!operatorRoleIds.length) {
      this.logger.warn('[ListingNotifyTargets] 未找到含「运营」或 operator 的角色');
      return [];
    }

    const userRoles = await this.userRoleRepo.find({
      where: { roleId: In(operatorRoleIds) },
      select: ['userId'],
    });
    const userIds = Array.from(
      new Set(userRoles.map(x => Number(x.userId)).filter(id => id > 0))
    );
    if (!userIds.length) return [];

    const users = await this.userRepo.find({
      where: { id: In(userIds), status: 1 },
      select: ['id', 'name', 'phone'],
    });

    return this.usersToProfiles(users);
  }

  /**
   * 该选品下所有点了「做」(is_generate=2) 的提交人。
   * 优先 base_sys_user（purchaser.userId，含手机号）；无 userId 仅 purchaser 姓名时无手机号，钉钉通知会跳过。
   */
  async listCandidateDoSubmitterProfiles(
    candidateId: number
  ): Promise<StaffProfileForDingTalk[]> {
    const cid = Number(candidateId);
    if (!cid) return [];

    const rows = await this.purchaserRepo.find({
      where: {
        candidate_id: String(cid),
        is_generate: PURCHASER_DECISION_DO,
      },
      select: ['userId', 'purchaser'],
    });
    if (!rows.length) return [];

    const sysUserIds = Array.from(
      new Set(
        rows
          .map(r => Number(String(r.userId || '').trim()))
          .filter(id => id > 0)
      )
    );

    const profiles: StaffProfileForDingTalk[] = [];
    const seenKeys = new Set<string>();

    if (sysUserIds.length) {
      const users = await this.userRepo.find({
        where: { id: In(sysUserIds), status: 1 },
        select: ['id', 'name', 'phone'],
      });
      for (const p of this.usersToProfiles(users)) {
        const key = `id:${p.userId}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        profiles.push(p);
      }
    }

    for (const row of rows) {
      const uid = Number(String(row.userId || '').trim());
      if (uid > 0 && seenKeys.has(`id:${uid}`)) continue;
      const name = String(row.purchaser || '').trim();
      if (!name) continue;
      const key = `name:${name}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      profiles.push({ userId: uid > 0 ? uid : 0, name, phone: null });
    }

    return profiles;
  }

  private usersToProfiles(
    users: Array<Pick<BaseSysUserEntity, 'id' | 'name' | 'phone'>>
  ): StaffProfileForDingTalk[] {
    const out: StaffProfileForDingTalk[] = [];
    const seen = new Set<number>();
    for (const u of users) {
      const id = Number(u.id);
      if (!id || seen.has(id)) continue;
      const name = String(u.name || '').trim();
      if (!name) continue;
      seen.add(id);
      out.push({
        userId: id,
        name,
        phone: u.phone || null,
      });
    }
    return out;
  }

  private mergeStaffProfiles(
    ...groups: StaffProfileForDingTalk[][]
  ): StaffProfileForDingTalk[] {
    const map = new Map<string, StaffProfileForDingTalk>();
    for (const group of groups) {
      for (const p of group) {
        const name = String(p.name || '').trim();
        if (!name) continue;
        const key =
          Number(p.userId) > 0 ? `id:${p.userId}` : `name:${name}`;
        if (!map.has(key)) map.set(key, { ...p, name });
      }
    }
    return Array.from(map.values());
  }

  /**
   * AI 图需 / AI 文案通知：助理角色 + 该选品「做」决策提交人 → 钉钉 userid。
   */
  async resolveListingTaskNotifyUserIds(candidateId: number): Promise<string[]> {
    const cid = Number(candidateId);
    const [assistants, submitters] = await Promise.all([
      this.listAssistantStaffProfiles(),
      cid ? this.listCandidateDoSubmitterProfiles(cid) : Promise.resolve([]),
    ]);

    const profiles = this.mergeStaffProfiles(assistants, submitters);
    if (!profiles.length) {
      this.logger.warn('[ListingNotifyTargets] 无通知对象（助理+选品提交人）', {
        candidateId: cid,
      });
      return this.resolveTestFallbackUserIds();
    }

    const dingUserIds = await this.dingTalkNotifyService.resolveUserIdsByStaffProfiles(
      profiles
    );
    if (!dingUserIds.length) {
      this.logger.warn('[ListingNotifyTargets] 未能解析到钉钉 userid（请确认用户表已填手机号）', {
        candidateId: cid,
        names: profiles.map(p => p.name),
      });
      return this.resolveTestFallbackUserIds();
    }

    this.logger.info('[ListingNotifyTargets] listing task notify targets', {
      candidateId: cid,
      assistantCount: assistants.length,
      submitterCount: submitters.length,
      profileCount: profiles.length,
      dingUserCount: dingUserIds.length,
      names: profiles.map(p => p.name),
    });
    return dingUserIds;
  }

  /** @deprecated 使用 resolveListingTaskNotifyUserIds */
  async resolveDesignRequirementNotifyUserIds(
    candidateId?: number
  ): Promise<string[]> {
    return this.resolveListingTaskNotifyUserIds(Number(candidateId || 0));
  }

  private async resolveTestFallbackUserIds(): Promise<string[]> {
    const fromUserId = String(process.env.DINGTALK_TEST_USERID || '')
      .split(/[,，\s]+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (fromUserId.length) return fromUserId;

    const mobile = String(process.env.DINGTALK_TEST_MOBILE || '').trim();
    if (mobile) {
      const uid = await this.dingTalkNotifyService.getUserIdByMobile(mobile);
      if (uid) return [uid];
    }
    return [];
  }
}
