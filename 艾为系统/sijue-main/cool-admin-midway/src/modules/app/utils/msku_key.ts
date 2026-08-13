import { Repository } from 'typeorm';
import { AppAmzMskuEntity } from '../entity/msku';

/** 业务侧统一用 trim 后的 MSKU 做比较；库内主键可能含历史首尾空格。 */
export function normalizeMskuKey(msku: string | null | undefined): string {
  return String(msku ?? '').trim();
}

export function mskuKeysEquivalent(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const ta = normalizeMskuKey(a);
  const tb = normalizeMskuKey(b);
  return !!ta && ta === tb;
}

export type MskuKeyedRow = { msku: string };

/** 列表内按 MSKU 解析：先精确匹配，再 trim 后匹配（兼容历史脏主键）。 */
export function buildMskuLookup<T extends MskuKeyedRow>(rows: T[]) {
  const byExact = new Map<string, T>();
  const byTrimmed = new Map<string, T>();
  for (const row of rows) {
    const raw = String(row.msku ?? '');
    if (!raw) continue;
    if (!byExact.has(raw)) byExact.set(raw, row);
    const trimmed = normalizeMskuKey(raw);
    if (trimmed && !byTrimmed.has(trimmed)) byTrimmed.set(trimmed, row);
  }
  return {
    resolve(input: string | null | undefined): T | undefined {
      const raw = String(input ?? '');
      if (!raw) return undefined;
      const exact = byExact.get(raw);
      if (exact) return exact;
      const trimmed = normalizeMskuKey(raw);
      if (!trimmed) return undefined;
      return byTrimmed.get(trimmed);
    },
    canonicalMsku(input: string | null | undefined): string | null {
      const row = this.resolve(input);
      return row ? String(row.msku) : null;
    },
  };
}

export function findRowByMskuKey<T extends MskuKeyedRow>(
  rows: T[],
  input: string | null | undefined
): T | undefined {
  return buildMskuLookup(rows).resolve(input);
}

/** 主表 app_amz_msku：精确 → trim 等值 → TRIM(msku) SQL。 */
export async function findMskuEntityByFlexibleKey(
  repo: Repository<AppAmzMskuEntity>,
  msku: string | null | undefined,
  select?: (keyof AppAmzMskuEntity)[]
): Promise<AppAmzMskuEntity | null> {
  const raw = String(msku ?? '');
  const trimmed = normalizeMskuKey(raw);
  if (!trimmed) return null;

  const selectOpt = select?.length ? ({ select } as const) : {};

  let row = await repo.findOne({ where: { msku: raw }, ...selectOpt });
  if (row) return row;
  if (raw !== trimmed) {
    row = await repo.findOne({ where: { msku: trimmed }, ...selectOpt });
    if (row) return row;
  }

  const qb = repo.createQueryBuilder('m').where('TRIM(m.msku) = :trimmed', { trimmed });
  if (select?.length) {
    qb.select(select.map((key) => `m.${String(key)}`));
  }
  return qb.getOne();
}
