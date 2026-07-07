import type { Marketplace, SalesTier } from '@/types/shopProfile'

export const MARKETPLACES: Marketplace[] = ['UK', 'DE', 'US']

/** 各市场货币符号，用于价格展示 */
export const CURRENCY_SYMBOL: Record<Marketplace, string> = {
  UK: '£',
  DE: '€',
  US: '$'
}

/** 销量等级 → 颜色（对齐设计稿暖橙色系 tier 变量） */
export const TIER_COLOR: Record<string, string> = {
  A: '#E8621C',
  B: '#D97706',
  C: '#2563EB',
  D: '#8A837A',
  UNKNOWN: '#B0A99F',
  ABC: '#7C3AED'
}

/** Element Plus el-tag 类型映射，用于等级标签 */
export function tierTagType(tier: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  switch (tier) {
    case 'A':
      return 'danger'
    case 'B':
      return 'warning'
    case 'C':
      return 'primary'
    default:
      return 'info'
  }
}

/** 市场 badge 背景/文字色，对齐设计稿 badge-market */
export function marketColor(m: string): { bg: string; fg: string } {
  switch (m) {
    case 'UK':
      return { bg: '#DBEAFE', fg: '#1E40AF' }
    case 'DE':
      return { bg: '#FEE2E2', fg: '#991B1B' }
    case 'US':
      return { bg: '#D1FAE5', fg: '#065F46' }
    default:
      return { bg: '#F0EDEA', fg: '#5C554D' }
  }
}

/** 相似度颜色分档：>=0.75 高 / >=0.5 中 / 其余 低 */
export function similarityColor(score?: number | null): string {
  if (score == null) return '#8A837A'
  if (score >= 0.75) return '#2E8B57'
  if (score >= 0.5) return '#D97706'
  return '#DC2626'
}

/** 比率（0~1）→ 百分比字符串 */
export function pct(ratio?: number | null, digits = 1): string {
  if (ratio == null || Number.isNaN(ratio)) return '—'
  return `${(ratio * 100).toFixed(digits)}%`
}

/** 千分位数字；空值显示 — */
export function num(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US')
}

/** 价格：带市场货币符号 */
export function money(v?: number | null, marketplace?: Marketplace): string {
  if (v == null || Number.isNaN(v)) return '—'
  const symbol = marketplace ? CURRENCY_SYMBOL[marketplace] : ''
  return `${symbol}${Number(v).toFixed(2)}`
}

/** epoch 毫秒 → yyyy-MM-dd（availableDate 后端返回 Long） */
export function epochToDate(ms?: number | null): string {
  if (ms == null || ms <= 0) return '—'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 生成 Amazon 商品链接兜底（后端已给 productUrl 时优先用后端的） */
export function amazonProductUrl(marketplace: Marketplace, asin: string): string {
  const domain: Record<Marketplace, string> = {
    UK: 'www.amazon.co.uk',
    DE: 'www.amazon.de',
    US: 'www.amazon.com'
  }
  return `https://${domain[marketplace]}/dp/${asin}`
}

export type { SalesTier }
