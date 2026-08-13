import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

/** 运营补充说明（与主图需 requirements 分离）：文字 + 示意图 URL 列表 */
export interface DesignTaskPictureRemarkDoc {
  text?: string;
  images?: string[];
}

/** 图需-多语言文案；数组顺序即展示/保存顺序 */
export interface DesignTaskPictureCopy {
  raw_text?: string;
  raw_after_rephrase?: string;
  role?: string;
  zh?: string;
  uk?: string;
  de?: string;
  fr?: string;
  it?: string;
  es?: string;
}

const REMARK_TEXT_MAX = 20000;
const REMARK_IMAGES_MAX = 24;
const REMARK_IMAGE_URL_MAX = 2048;
const COPY_TEXT_MAX = 20000;

function normalizeCopyText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, COPY_TEXT_MAX) : '';
}

/** 归一化入参；无效或全空则返回 null（存库用 NULL） */
export function normalizeDesignTaskPictureRemarkDoc(raw: unknown): DesignTaskPictureRemarkDoc | null {
  if (raw == null || raw === '') return null;
  let obj: any = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const textRaw = obj.text;
  const text =
    typeof textRaw === 'string' ? textRaw.trim().slice(0, REMARK_TEXT_MAX) : '';
  let images: string[] = [];
  if (Array.isArray(obj.images)) {
    const seen = new Set<string>();
    for (const x of obj.images) {
      if (typeof x !== 'string') continue;
      const u = x.trim().slice(0, REMARK_IMAGE_URL_MAX);
      if (!u || seen.has(u)) continue;
      seen.add(u);
      images.push(u);
      if (images.length >= REMARK_IMAGES_MAX) break;
    }
  }
  if (!text && images.length === 0) return null;
  const out: DesignTaskPictureRemarkDoc = {};
  if (text) out.text = text;
  if (images.length > 0) out.images = images;
  return out;
}

/** 归一化图需文案数组；允许保留空行，避免用户新增空文案行后保存/重开丢行 */
export function normalizeDesignTaskPictureCopies(raw: unknown): DesignTaskPictureCopy[] | null {
  if (raw == null || raw === '') return null;
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(list)) return null;
  return list.map((item) => {
    const obj = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
    return {
      raw_text: normalizeCopyText(obj.raw_text),
      raw_after_rephrase: normalizeCopyText(obj.raw_after_rephrase),
      role: normalizeCopyText(obj.role),
      zh: normalizeCopyText(obj.zh),
      uk: normalizeCopyText(obj.uk),
      de: normalizeCopyText(obj.de),
      fr: normalizeCopyText(obj.fr),
      it: normalizeCopyText(obj.it),
      es: normalizeCopyText(obj.es),
    };
  });
}

/**
 * 美工任务-图需表，对应 design_task_picture
 */
@Entity('design_task_picture')
@Unique('uk_task_label', ['task_id', 'label'])
export class DesignTaskPictureEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_task_id')
  @Column({ type: 'bigint', unsigned: true, nullable: false, comment: 'design_task.id' })
  task_id: number;

  @Column({ type: 'varchar', length: 32, nullable: false, comment: '编号，如 1-1、1-2，任务内唯一' })
  label: string;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: false,
    default: '',
    comment: '类型：主图、场景图、多场景图、尺寸图、对比图、模特图、配件图、细节图、多细节图',
  })
  type: string;

  @Index('idx_msku')
  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    default: null,
    comment: '关联的 MSKU 业务编号，空表示不关联；关联时通过 app_amz_msku 可查变体、提交人、店铺等',
  })
  msku: string | null;

  @Index('idx_seller_account_id')
  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    default: null,
    comment: '店铺账号层级关联（场景图等挂载），对应 seller_account_id',
  })
  seller_account_id: string | null;

  @Index('idx_variant_id')
  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    default: null,
    comment: '变体 id（app_amz_bsr_candidate_variant.id，变体层级关联时使用）',
  })
  variant_id: string | null;

  @Column({ type: 'text', nullable: true, comment: '变体描述冗余字段' })
  variant_desc: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    default: null,
    comment: '提交人冗余字段（第一次生成图片位时填充，后续不改）',
  })
  submitter: string | null;

  @Column({ type: 'varchar', length: 512, nullable: false, default: '', comment: '参考图 URL' })
  reference_image: string;

  @Column({ type: 'text', nullable: true, comment: '图需描述文字' })
  requirements: string | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '运营补充说明 JSON：{ text?, images? }，示意参考与主图需分离',
  })
  remark_doc: DesignTaskPictureRemarkDoc | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '图需多语言文案数组，数组顺序即展示顺序',
  })
  copies: DesignTaskPictureCopy[] | null;

  @Column({ type: 'tinyint', nullable: false, default: 0, comment: '已审核' })
  reviewed: number;

  @Column({ type: 'tinyint', nullable: false, default: 0, comment: '已拍摄' })
  photographed: number;

  @Column({ type: 'tinyint', nullable: false, default: 0, comment: '已做图' })
  design_done: number;

  @CreateDateColumn({ precision: 6 })
  createTime: Date;

  @UpdateDateColumn({ precision: 6 })
  updateTime: Date;
}

