/**
 * 选品查询表单组件类型定义
 * @module SelectionQueryForm/types
 */

/**
 * 查询参数接口
 */
export interface SelectionQueryParams {
  /** ASIN搜索 */
  asin: string
  /** 商品标题搜索 */
  productTitle: string
  /** 组合搜索关键词 */
  keyword: string
  /** 搜索类型 */
  searchType: 'asin' | 'productTitle'
  /** 产品类型 */
  productType: '' | 'new' | 'reference' | 'zheng'
  /** 店铺名称 */
  storeName: string
  /** 大类榜单 */
  category: string
  /** 国家 */
  country: string
  /** 数据筛选模式 */
  dataFilterMode: string
  /** 上架时间开始日期 */
  listingDateStart: string
  /** 上架时间结束日期 */
  listingDateEnd: string
  /** 等级筛选（多个用逗号分隔） */
  grade: string
  /** 周标记筛选 */
  weekTag: string
  /** 本周/往期筛选（1=本周, 0=往期, 空=全部） */
  isCurrent: '' | '1' | '0'
  /** 排序字段 */
  sortField: '' | 'salesVolume' | 'price' | 'listingDate' | 'createdAt' | 'score'
  /** 排序方式 */
  sortOrder: '' | 'desc' | 'asc'
  /** 开始日期 */
  startDate: string
  /** 结束日期 */
  endDate: string
}

/**
 * 分类项接口
 */
export interface CategoryItem {
  /** 分类名称 */
  category: string
  /** 分类数量 */
  count: number
}

/**
 * 搜索类型选项
 */
export interface SearchTypeOption {
  label: string
  value: string
}

/**
 * 组件Props接口
 */
export interface SelectionQueryFormProps {
  /** 页面类型 */
  pageType: 'all' | 'new' | 'reference' | 'recycle'
  /** 是否显示来源筛选 */
  showSource?: boolean
  /** 是否显示组合搜索 */
  showCombinedSearch?: boolean
  /** 是否显示单行紧凑模式 */
  showCompactMode?: boolean
  /** 是否显示多项精确搜索按钮 */
  showAdvancedSearch?: boolean
  /** 是否显示筛选按钮 */
  showFilter?: boolean
  /** 搜索类型选项（用于紧凑模式） */
  searchTypeOptions?: SearchTypeOption[]
  /** 是否显示排序 */
  showSort?: boolean
  /** 是否显示日期范围 */
  showDateRange?: boolean
  /** 是否显示以图搜图按钮 */
  showImageSearch?: boolean
  /** 是否显示标题 */
  showTitle?: boolean
  /** 是否显示总数统计 */
  showTotal?: boolean
  /** 大类榜单列表 */
  categories?: CategoryItem[]
  /** 初始查询参数 */
  initialParams?: Partial<SelectionQueryParams>
  /** 总数量（用于显示统计） */
  total?: number
  /** 自定义标题 */
  title?: string
}

/**
 * 组件Emits类型定义
 */
export interface SelectionQueryFormEmits {
  /** 搜索事件 */
  (e: 'search', params: SelectionQueryParams): void
  /** 重置事件 */
  (e: 'reset'): void
  /** 以图搜图事件 */
  (e: 'imageSearch'): void
  /** 参数变化事件 */
  (e: 'change', params: SelectionQueryParams): void
}

/**
 * 默认查询参数
 */
export const defaultQueryParams: SelectionQueryParams = {
  asin: '',
  productTitle: '',
  keyword: '',
  searchType: 'asin',
  productType: '',
  storeName: '',
  category: '',
  country: '', // 默认不筛选国家，显示所有国家数据
  dataFilterMode: '', // 默认不筛选数据模式，显示所有模式
  listingDateStart: '',
  listingDateEnd: '',
  grade: '',
  weekTag: '',
  isCurrent: '',
  sortField: 'score', // 默认排序字段：评分
  sortOrder: 'desc', // 默认排序方式：降序
  startDate: '',
  endDate: ''
}

/**
 * 默认搜索类型选项
 */
export const defaultSearchTypeOptions: SearchTypeOption[] = [
  { label: 'ASIN', value: 'asin' },
  { label: '商品标题', value: 'productTitle' },
  { label: '店铺名称', value: 'storeName' },
  { label: '大类榜单', value: 'category' }
]

/**
 * 页面类型配置
 */
export const pageTypeConfig: Record<string, Partial<SelectionQueryFormProps>> = {
  all: {
    showCompactMode: true,
    showImageSearch: true,
    showTitle: true,
    showTotal: true
  },
  new: {
    showCombinedSearch: true,
    showSort: true,
    showImageSearch: true,
    showTitle: false,
    showTotal: false
  },
  reference: {
    showSort: true,
    showImageSearch: false,
    showTitle: false,
    showTotal: false
  },
  recycle: {
    showDateRange: true,
    showImageSearch: false,
    showTitle: false,
    showTotal: false
  }
}
