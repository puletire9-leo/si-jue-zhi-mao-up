export interface BsrBacklogCategoryOption {
  label: string;
  value: string;
  count: number;
}

export interface BsrBacklogCategoryParams {
  status?: number;
  archiveFilter?: Date | string;
  distinguish?: string;
}

interface BsrBacklogCategoryRepo {
  createQueryBuilder(alias: string): any;
}

function toSafeDate(value?: Date | string): Date {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeDistinguish(value?: string): string | undefined {
  const text = String(value || '').trim();
  return text || undefined;
}

export function normalizeBsrBacklogCategoryRows(rows: any[]): BsrBacklogCategoryOption[] {
  const counts = new Map<string, number>();

  for (const row of rows || []) {
    const value = String(row?.category ?? row?.bsr_category ?? '').trim();
    if (!value) continue;

    const count = Number(row?.count ?? row?.total ?? 0);
    counts.set(value, (counts.get(value) || 0) + (Number.isFinite(count) ? count : 0));
  }

  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
    .map(([value, count]) => ({
      label: value,
      value,
      count,
    }));
}

async function queryBsrBacklogCategoryRows(
  repo: BsrBacklogCategoryRepo,
  params: BsrBacklogCategoryParams,
  distinguish?: string
): Promise<any[]> {
  const status = params.status ?? 2;
  const archiveFilter = toSafeDate(params.archiveFilter);
  const qb = repo
    .createQueryBuilder('a')
    .select('a.bsr_category', 'category')
    .addSelect('COUNT(1)', 'count')
    .where('a.status = :status', { status })
    .andWhere('a.bsr_category IS NOT NULL')
    .andWhere('a.bsr_category != :emptyCategory', { emptyCategory: '' })
    .andWhere('(a.archive_hide_until IS NULL OR a.archive_hide_until <= :archiveFilter)', {
      archiveFilter,
    });

  if (distinguish) {
    qb.andWhere('a.distinguish = :distinguish', { distinguish });
  }

  return qb.groupBy('a.bsr_category').orderBy('a.bsr_category', 'ASC').getRawMany();
}

export async function getVisibleBsrBacklogCategoryOptions(
  repo: BsrBacklogCategoryRepo,
  params: BsrBacklogCategoryParams
): Promise<BsrBacklogCategoryOption[]> {
  const distinguish = normalizeDistinguish(params.distinguish);

  if (distinguish) {
    const scopedOptions = normalizeBsrBacklogCategoryRows(
      await queryBsrBacklogCategoryRows(repo, params, distinguish)
    );

    if (scopedOptions.length) {
      return scopedOptions;
    }
  }

  return normalizeBsrBacklogCategoryRows(await queryBsrBacklogCategoryRows(repo, params));
}
