import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseSysUserEntity } from '../../base/entity/sys/user';
import { AppUserListingCommonSuffixEntity } from '../entity/user_listing_common_suffix';
import { BaiduTranslateService } from './baidu_translate';

export type ListingCommonSuffixItem = {
  use_scene: string;
  suffix_en?: string;
  suffix_de?: string;
};

export type ListingCommonSuffixListRow = {
  id: number;
  user_id: number;
  use_scene: string;
  suffix_en: string;
  suffix_de: string;
  submitter: string;
};

@Provide()
export class ListingCommonSuffixService {
  @InjectEntityModel(AppUserListingCommonSuffixEntity)
  suffixRepo: Repository<AppUserListingCommonSuffixEntity>;

  @InjectEntityModel(BaseSysUserEntity)
  userRepo: Repository<BaseSysUserEntity>;

  @Inject()
  baiduTranslateService: BaiduTranslateService;

  private resolveSubmitterName(user?: BaseSysUserEntity | null): string {
    if (!user) return '';
    return String(user.name || user.nickName || user.username || '').trim();
  }

  async translateEnToDe(text: string) {
    return this.baiduTranslateService.translateToDe(text);
  }

  private normalizeItem(raw: ListingCommonSuffixItem): ListingCommonSuffixItem {
    const use_scene = String(raw?.use_scene || '').trim();
    const suffix_en = String(raw?.suffix_en || '').trim();
    const suffix_de = String(raw?.suffix_de || '').trim();
    if (!use_scene) throw new Error('使用场景不能为空');
    if (!suffix_en && !suffix_de) {
      throw new Error('英文后缀与德文后缀至少填写一项');
    }
    return {
      use_scene,
      suffix_en: suffix_en || undefined,
      suffix_de: suffix_de || undefined,
    };
  }

  async listByUserId(userId: number) {
    const rows = await this.suffixRepo.find({
      where: { user_id: userId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return rows.map(r => ({
      id: Number(r.id),
      user_id: Number(r.user_id),
      use_scene: String(r.use_scene || '').trim(),
      suffix_en: String(r.suffix_en || '').trim(),
      suffix_de: String(r.suffix_de || '').trim(),
      submitter: '',
    }));
  }

  /** 全员常用后缀（列表展示与一键带入用，不按提交人过滤） */
  async listAllWithSubmitter(): Promise<ListingCommonSuffixListRow[]> {
    const rows = await this.suffixRepo.find({
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    if (!rows.length) return [];
    const userIds = Array.from(
      new Set(rows.map(r => Number(r.user_id)).filter(id => id > 0))
    );
    const users = userIds.length
      ? await this.userRepo.find({ where: { id: In(userIds) } })
      : [];
    const nameMap = new Map(
      users.map(u => [Number(u.id), this.resolveSubmitterName(u)])
    );
    return rows.map(r => {
      const user_id = Number(r.user_id);
      const submitter = nameMap.get(user_id) || (user_id ? String(user_id) : '');
      return {
        id: Number(r.id),
        user_id,
        use_scene: String(r.use_scene || '').trim(),
        suffix_en: String(r.suffix_en || '').trim(),
        suffix_de: String(r.suffix_de || '').trim(),
        submitter,
      };
    });
  }

  private async nextSortOrder(userId: number) {
    const row = await this.suffixRepo.findOne({
      where: { user_id: userId },
      order: { sort_order: 'DESC', id: 'DESC' },
    });
    return row ? Number(row.sort_order || 0) + 1 : 0;
  }

  private async findOwnedOrThrow(userId: number, id: number) {
    const row = await this.suffixRepo.findOne({
      where: { user_id: userId, id: Number(id) },
    });
    if (!row) throw new Error('常用后缀不存在或无权操作');
    return row;
  }

  private async assertSceneUnique(
    userId: number,
    use_scene: string,
    excludeId?: number
  ) {
    const qb = this.suffixRepo
      .createQueryBuilder('s')
      .where('s.user_id = :userId', { userId })
      .andWhere('LOWER(s.use_scene) = LOWER(:use_scene)', { use_scene });
    if (excludeId) {
      qb.andWhere('s.id != :excludeId', { excludeId: Number(excludeId) });
    }
    const exists = await qb.getOne();
    if (exists) throw new Error(`使用场景「${use_scene}」已存在`);
  }

  async addOne(userId: number, item: ListingCommonSuffixItem) {
    const normalized = this.normalizeItem(item);
    await this.assertSceneUnique(userId, normalized.use_scene);
    const sort_order = await this.nextSortOrder(userId);
    const saved = await this.suffixRepo.save(
      this.suffixRepo.create({
        user_id: userId,
        use_scene: normalized.use_scene,
        suffix_en: normalized.suffix_en || null,
        suffix_de: normalized.suffix_de || null,
        sort_order,
      })
    );
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return {
      id: Number(saved.id),
      user_id: userId,
      use_scene: normalized.use_scene,
      suffix_en: String(saved.suffix_en || '').trim(),
      suffix_de: String(saved.suffix_de || '').trim(),
      submitter: this.resolveSubmitterName(user),
    };
  }

  async updateOne(
    userId: number,
    id: number,
    item: ListingCommonSuffixItem
  ) {
    const row = await this.findOwnedOrThrow(userId, id);
    const normalized = this.normalizeItem(item);
    await this.assertSceneUnique(userId, normalized.use_scene, id);
    row.use_scene = normalized.use_scene;
    row.suffix_en = normalized.suffix_en || null;
    row.suffix_de = normalized.suffix_de || null;
    await this.suffixRepo.save(row);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return {
      id: Number(row.id),
      user_id: userId,
      use_scene: normalized.use_scene,
      suffix_en: String(row.suffix_en || '').trim(),
      suffix_de: String(row.suffix_de || '').trim(),
      submitter: this.resolveSubmitterName(user),
    };
  }

  async deleteOne(userId: number, id: number) {
    const row = await this.findOwnedOrThrow(userId, id);
    await this.suffixRepo.delete(row.id);
    return { id: Number(row.id) };
  }
}
