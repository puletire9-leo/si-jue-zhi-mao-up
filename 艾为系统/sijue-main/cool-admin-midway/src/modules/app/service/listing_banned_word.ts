import { Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseSysUserEntity } from '../../base/entity/sys/user';
import { AppUserListingBannedWordEntity } from '../entity/user_listing_banned_word';

export type ListingBannedWordInput = {
  word?: string;
  reason?: string;
};

export type ListingBannedWordItem = {
  word: string;
  reason?: string;
};

export type ListingBannedWordListRow = {
  id: number;
  user_id: number;
  word: string;
  reason: string;
  submitter: string;
};

@Provide()
export class ListingBannedWordService {
  @InjectEntityModel(AppUserListingBannedWordEntity)
  bannedWordRepo: Repository<AppUserListingBannedWordEntity>;

  @InjectEntityModel(BaseSysUserEntity)
  userRepo: Repository<BaseSysUserEntity>;

  normalizeItems(
    items: ListingBannedWordInput[] | null | undefined
  ): ListingBannedWordItem[] {
    const seen = new Set<string>();
    const out: ListingBannedWordItem[] = [];
    for (const raw of Array.isArray(items) ? items : []) {
      const word = String(raw?.word || '').trim();
      if (!word) continue;
      const key = word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const reason = String(raw?.reason || '').trim();
      out.push({ word, reason: reason || undefined });
    }
    return out;
  }

  private resolveSubmitterName(user?: BaseSysUserEntity | null): string {
    if (!user) return '';
    return String(user.name || user.nickName || user.username || '').trim();
  }

  async listByUserId(userId: number) {
    const rows = await this.bannedWordRepo.find({
      where: { user_id: userId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return rows.map(r => ({
      id: Number(r.id),
      user_id: Number(r.user_id),
      word: String(r.word || '').trim(),
      reason: String(r.reason || '').trim(),
      submitter: '',
    }));
  }

  /** 全员违禁词（检测与词库面板展示用，不按提交人过滤） */
  async listAllWithSubmitter(): Promise<ListingBannedWordListRow[]> {
    const rows = await this.bannedWordRepo.find({
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
        word: String(r.word || '').trim(),
        reason: String(r.reason || '').trim(),
        submitter,
      };
    });
  }

  private async nextSortOrder(userId: number) {
    const row = await this.bannedWordRepo.findOne({
      where: { user_id: userId },
      order: { sort_order: 'DESC', id: 'DESC' },
    });
    return row ? Number(row.sort_order || 0) + 1 : 0;
  }

  private async findOwnedOrThrow(userId: number, id: number) {
    const row = await this.bannedWordRepo.findOne({
      where: { user_id: userId, id: Number(id) },
    });
    if (!row) throw new Error('违禁词不存在或无权操作');
    return row;
  }

  private async assertWordUnique(
    userId: number,
    word: string,
    excludeId?: number
  ) {
    const qb = this.bannedWordRepo
      .createQueryBuilder('b')
      .where('b.user_id = :userId', { userId })
      .andWhere('LOWER(b.word) = LOWER(:word)', { word });
    if (excludeId) {
      qb.andWhere('b.id != :excludeId', { excludeId: Number(excludeId) });
    }
    const exists = await qb.getOne();
    if (exists) throw new Error(`违禁词「${word}」已存在`);
  }

  async addOne(userId: number, item: ListingBannedWordInput) {
    const word = String(item?.word || '').trim();
    if (!word) throw new Error('违禁词不能为空');
    await this.assertWordUnique(userId, word);
    const reason = String(item?.reason || '').trim();
    const sort_order = await this.nextSortOrder(userId);
    const saved = await this.bannedWordRepo.save(
      this.bannedWordRepo.create({
        user_id: userId,
        word,
        reason: reason || null,
        sort_order,
      })
    );
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return {
      id: Number(saved.id),
      user_id: userId,
      word,
      reason,
      submitter: this.resolveSubmitterName(user),
    };
  }

  async updateOne(
    userId: number,
    id: number,
    item: ListingBannedWordInput
  ) {
    const row = await this.findOwnedOrThrow(userId, id);
    const word = String(item?.word || '').trim();
    if (!word) throw new Error('违禁词不能为空');
    await this.assertWordUnique(userId, word, id);
    const reason = String(item?.reason || '').trim();
    row.word = word;
    row.reason = reason || null;
    await this.bannedWordRepo.save(row);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return {
      id: Number(row.id),
      user_id: userId,
      word,
      reason,
      submitter: this.resolveSubmitterName(user),
    };
  }

  async deleteOne(userId: number, id: number) {
    const row = await this.findOwnedOrThrow(userId, id);
    await this.bannedWordRepo.delete(row.id);
    return { id: Number(row.id) };
  }

  async replaceAllForUser(userId: number, items: ListingBannedWordInput[]) {
    const normalized = this.normalizeItems(items);
    await this.bannedWordRepo.manager.transaction(async manager => {
      await manager.delete(AppUserListingBannedWordEntity, { user_id: userId });
      if (!normalized.length) return;
      const entities = normalized.map((item, index) =>
        manager.create(AppUserListingBannedWordEntity, {
          user_id: userId,
          word: item.word,
          reason: item.reason || null,
          sort_order: index,
        })
      );
      await manager.save(AppUserListingBannedWordEntity, entities);
    });
    return normalized;
  }
}
