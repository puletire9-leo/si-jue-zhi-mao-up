import { vi } from 'vitest'
import { config } from '@vue/test-utils'

// 全局配置
config.global.stubs = {
  'el-icon': true,
  'el-image': true,
  'el-checkbox': true,
  'el-button': true,
  'el-tag': true,
  'el-card': true,
  'el-form': true,
  'el-form-item': true,
  'el-input': true,
  'el-select': true,
  'el-option': true,
  'el-pagination': true,
  'el-dialog': true,
  'el-upload': true,
  'el-alert': true,
  'el-empty': true
}

// Mock Element Plus
vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  },
  ElMessageBox: {
    confirm: vi.fn()
  }
}))

// Mock Vue Router
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  })),
  useRoute: vi.fn(() => ({
    path: '/',
    params: {},
    query: {},
    meta: {}
  }))
}))

// Mock API
vi.mock('@/api/product', () => ({
  productApi: {
    getList: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    batchDelete: vi.fn(),
    import: vi.fn(),
    downloadTemplate: vi.fn()
  }
}))

vi.mock('@/api/selection', () => ({
  selectionApi: {
    getNewProductsList: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    batchDelete: vi.fn(),
    import: vi.fn(),
    downloadTemplate: vi.fn()
  }
}))
