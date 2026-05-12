import { reactive } from 'vue'

const STORAGE_KEY = 'sijuezhimao_config'

interface StorageConfig {
  themeMode: 'light' | 'dark' | 'system'
  themeColor: string
  menuLayout: 'vertical' | 'horizontal' | 'mix'
  stretchType: 'fixed' | 'custom'
  customWidth: number
  tagsStyle: 'smart' | 'card' | 'chrome'
  watermark: boolean
  watermarkText: string
  grey: boolean
  weak: boolean
  hideTabs: boolean
  hideFooter: boolean
  showLogo: boolean
  multiTagsCache: boolean
  stretch: boolean | number
}

const defaultConfig: StorageConfig = {
  themeMode: 'light',
  themeColor: '#7C61D4',
  menuLayout: 'vertical',
  stretchType: 'fixed',
  customWidth: 1440,
  tagsStyle: 'chrome',
  watermark: false,
  watermarkText: '思觉智贸',
  grey: false,
  weak: false,
  hideTabs: false,
  hideFooter: false,
  showLogo: true,
  multiTagsCache: true,
  stretch: false
}

const loadConfig = (): StorageConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) }
    }
  } catch {
    console.error('Failed to load config from localStorage')
  }
  return { ...defaultConfig }
}

const saveConfig = (config: StorageConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    console.error('Failed to save config to localStorage')
  }
}

export const storageConfigure = reactive<StorageConfig>(loadConfig())

export function storageConfigureChange<T extends keyof StorageConfig>(key: T, val: StorageConfig[T]) {
  storageConfigure[key] = val
  saveConfig({ ...storageConfigure })
}

export function resetStorageConfigure() {
  Object.assign(storageConfigure, defaultConfig)
  saveConfig({ ...storageConfigure })
}
