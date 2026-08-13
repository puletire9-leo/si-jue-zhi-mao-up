import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * Listing 文案违禁词库（按 user_id 记录提交人，列表与检测对全员可见）
 */
@Entity('app_user_listing_banned_word')
@Index('uk_user_listing_banned_word', ['user_id', 'word'], { unique: true })
export class AppUserListingBannedWordEntity extends BaseEntity {
  @Index()
  @Column({ comment: '用户ID', type: 'int' })
  user_id: number;

  @Column({ comment: '违禁词', length: 255 })
  word: string;

  @Column({ comment: '原因说明', length: 500, nullable: true })
  reason: string | null;

  @Column({ comment: '排序（越小越靠前）', type: 'int', default: 0 })
  sort_order: number;
}
