// FIXED: MED-1 — 共享品线模型展示逻辑，在 ProductLineModel.vue 和 ModelSummaryBar.vue 间复用
export const healthScoreMap: Record<string, number> = {
  healthy: 85,
  stable: 65,
  declining: 40,
  risky: 20,
}

export const healthColorMap: Record<string, string> = {
  healthy: '#059669',
  stable: '#0891b2',
  declining: '#ca8a04',
  risky: '#dc2626',
}

/**
 * 根据健康度等级获取分数
 */
export function getScoreLevel(health: string): number {
  return healthScoreMap[health] ?? 50
}

/**
 * 根据健康度等级获取颜色
 */
export function getScoreColor(health: string): string {
  return healthColorMap[health] ?? '#059669'
}

/**
 * 饱和度标签中文映射
 */
export function saturationLabel(s: string): string {
  const map: Record<string, string> = { high: '高饱和', medium: '中饱和', low: '低饱和' }
  return map[s] || s
}
