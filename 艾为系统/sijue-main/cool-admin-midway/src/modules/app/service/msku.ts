import { Provide } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Like } from 'typeorm';
import { AppAmzMskuEntity } from '../entity/msku';
import * as dayjs from 'dayjs';
import pinyin from 'pinyin';

/** 业务规则：MSKU 总长不超过 40（含碰撞后缀如 -01） */
export const MSKU_MAX_LENGTH = 40;
const MSKU_PRODUCT_ABBR_LEN = 5;
const MSKU_VARIANT_ABBR_LEN = 5;

/** 店铺拼音首字母段上限（业务约定 12，base+后缀仍远小于 40） */
export const MSKU_SELLER_ABBR_MAX_LEN = 12;

/** 仅保留中文、英文字母、数字（去掉括号、标点、空格等） */
export function mskuSanitizeNameInput(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, '');
}

/**
 * 拼音首字母缩写，输出为 A-Z 与 0-9。
 * 中文逐字取拼音首字母；英文、数字逐字原样保留（数字大写无关）。
 */
export function mskuPinyinAbbr(text: string, maxLen: number): string {
  const cleaned = mskuSanitizeNameInput(text);
  if (!cleaned) return '';
  const letters: string[] = [];
  for (const char of cleaned) {
    if (/^[A-Za-z]$/.test(char)) {
      letters.push(char.toUpperCase());
      continue;
    }
    if (/^[0-9]$/.test(char)) {
      letters.push(char);
      continue;
    }
    if (/^[\u4e00-\u9fff]$/.test(char)) {
      const py = (pinyin(char, { style: pinyin.STYLE_FIRST_LETTER })[0]?.[0] || '').toUpperCase();
      if (/^[A-Z]$/.test(py)) letters.push(py);
    }
  }
  const joined = letters.join('');
  return maxLen > 0 ? joined.substring(0, maxLen) : joined;
}

/**
 * MSKU 编号规则：店铺缩写-入库日期-产品5位-变体5位（总长≤40，店铺段≤12）
 */
@Provide()
export class AppAmzMskuService {
  @InjectEntityModel(AppAmzMskuEntity)
  mskuRepo: Repository<AppAmzMskuEntity>;

  /**
   * 生成 MSKU 字符串
   */
  generateMskuCode(sellerName: string, candidateName: string, selectedVariant: string): string {
    const sellerAbbr = mskuPinyinAbbr(sellerName, MSKU_SELLER_ABBR_MAX_LEN);
    const dateStr = dayjs().format('YYYYMMDD');
    const productAbbr = mskuPinyinAbbr(candidateName, MSKU_PRODUCT_ABBR_LEN);
    const variantAbbr = mskuPinyinAbbr(selectedVariant || '', MSKU_VARIANT_ABBR_LEN);
    return `${sellerAbbr}-${dateStr}-${productAbbr}-${variantAbbr}`;
  }

  /**
   * 查或建 MSKU，返回 MSKU 业务编号。同一 商品+店铺账号+变体 共用一个 MSKU。
   * 新建时写入 selected_variant_id 与第一次入库的提交人（submitter_user_id、submitter_name）。
   */
  async getOrCreateMsku(params: {
    candidate_id: string;
    candidate_name: string;
    seller_account_id: string;
    account_name: string;
    selected_variant: string;
    selected_variant_id?: string | null;
    submitter_user_id?: string | null;
    submitter_name?: string | null;
  }): Promise<string> {
    const variantKey = params.selected_variant ?? '';
    const variantId = params.selected_variant_id ?? null;

    // 1) 先按 candidate + account + variant_id 查重
    if (variantId) {
      const existingById = await this.mskuRepo.findOne({
        where: {
          candidate_id: params.candidate_id,
          seller_account_id: params.seller_account_id,
          selected_variant_id: variantId,
        },
        select: ['msku'],
      });
      if (existingById) return existingById.msku;
    }

    // 2) 按 candidate + account + variant_name 查
    const existingByName = await this.mskuRepo.findOne({
      where: {
        candidate_id: params.candidate_id,
        seller_account_id: params.seller_account_id,
        selected_variant: variantKey,
      },
      select: ['msku'],
    });
    if (existingByName) return existingByName.msku;

    // 3) 生成基础 MSKU，并按已有后缀自增
    const base = this.generateMskuCode(
      params.account_name,
      params.candidate_name,
      params.selected_variant
    );

    const pickNextMsku = async (): Promise<string> => {
      const rows = await this.mskuRepo.find({
        where: { msku: Like(`${base}%`) },
        select: ['msku'],
      });
      let maxSuffix = 0;
      rows.forEach(r => {
        const code = r.msku;
        if (code === base) {
          maxSuffix = Math.max(maxSuffix, 0);
          return;
        }
        const match = code.match(new RegExp(`^${base}-(\\d+)$`));
        if (match) {
          const n = Number(match[1]) || 0;
          if (n > maxSuffix) maxSuffix = n;
        }
      });
      if (maxSuffix === 0 && !rows.some(r => r.msku === base)) {
        return base;
      }
      const next = maxSuffix + 1;
      const suffix = String(next).padStart(2, '0');
      return `${base}-${suffix}`;
    };

    // 4) 并发保护：若重复主键则重试
    for (let i = 0; i < 3; i++) {
      const mskuCode = await pickNextMsku();
      const row = this.mskuRepo.create({
        msku: mskuCode,
        candidate_id: params.candidate_id,
        candidate_name: params.candidate_name,
        seller_account_id: params.seller_account_id,
        account_name: params.account_name,
        selected_variant: variantKey,
        selected_variant_id: variantId,
        submitter_user_id: params.submitter_user_id ?? null,
        submitter_name: params.submitter_name ?? null,
      });
      try {
        await this.mskuRepo.save(row);
        return mskuCode;
      } catch (e: any) {
        if (e?.code !== 'ER_DUP_ENTRY' && e?.errno !== 1062) {
          throw e;
        }
      }
    }

    const fallback = await this.mskuRepo.findOne({
      where: {
        candidate_id: params.candidate_id,
        seller_account_id: params.seller_account_id,
        selected_variant_id: variantId ?? undefined,
      },
      select: ['msku'],
    });
    if (fallback) return fallback.msku;
    throw new Error('生成 MSKU 失败，请重试');
  }
}
