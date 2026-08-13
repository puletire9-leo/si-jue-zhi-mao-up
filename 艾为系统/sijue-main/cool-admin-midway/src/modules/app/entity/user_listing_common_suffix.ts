import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * Listing 标题常用后缀（按 user_id 记录提交人，列表与一键带入对全员可见）
 */
@Entity('app_user_listing_common_suffix')
@Index('uk_user_listing_common_suffix', ['user_id', 'use_scene'], {
  unique: true,
})
export class AppUserListingCommonSuffixEntity extends BaseEntity {
  @Index()
  @Column({ comment: '用户ID', type: 'int' })
  user_id: number;

  @Column({ comment: '使用场景（运营辨识用，如变体尺寸/材质）', length: 255 })
  use_scene: string;

  @Column({ comment: '英文后缀', length: 500, nullable: true })
  suffix_en: string | null;

  @Column({ comment: '德文后缀', length: 500, nullable: true })
  suffix_de: string | null;

  @Column({ comment: '排序（越小越靠前）', type: 'int', default: 0 })
  sort_order: number;
}
