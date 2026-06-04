import type { ModuleManifest } from './types'

// 只扫描一级目录，禁止嵌套模块
const moduleManifests = import.meta.glob('./*/manifest.ts', { eager: true })

let cached: ModuleManifest[] | null = null

export function getAllModules(): ModuleManifest[] {
  if (cached) return cached
  const manifests: ModuleManifest[] = []
  for (const path in moduleManifests) {
    try {
      const mod = (moduleManifests[path] as any).default
      if (mod && mod.id) manifests.push(mod)
    } catch (e) {
      console.error(`[Modules] 加载失败: ${path}`, e)
    }
  }
  cached = manifests.sort((a, b) => (a.menuOrder ?? 99) - (b.menuOrder ?? 99))
  return cached
}

export type { ModuleManifest }
