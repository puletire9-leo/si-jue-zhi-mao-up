import type { ProductType, Product, ProductListParams, ProductListResponse } from './product'
import type { 
  ApiResponse, 
  PaginationParams, 
  PaginationResponse, 
  UploadFile, 
  UploadResponse, 
  ErrorResponse, 
  RequestConfig, 
  HttpMethod 
} from './common'

export type { ApiResponse }
export type { PaginationParams, PaginationResponse }
export type { UploadFile, UploadResponse }
export type { ErrorResponse }
export type { RequestConfig, HttpMethod }

export type { ProductType, Product, ProductListParams, ProductListResponse }

export interface User {
  id: string
  username: string
  name?: string
  nickname?: string
  email?: string
  phone?: string
  avatar?: string
  description?: string
  role: UserRole
  developer?: string
  permissions?: any[]
  createdAt?: string
  updatedAt?: string
}

export type UserRole = '管理员' | '开发' | '美术' | '仓库' | 'admin' | 'developer' | 'artist' | 'warehouse'

export interface UserListParams {
  page: number
  size: number
  username?: string
  email?: string
  role?: UserRole
}

export interface UserListResponse {
  list: User[]
  total: number
  page: number
  size: number
}

export interface LoginData {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  access_token?: string
  refresh_token?: string
  expires_in?: number
  user: User
}

export interface CreateUserData {
  username: string
  password: string
  email?: string
  role: UserRole
}

export interface UpdateUserData {
  username?: string
  email?: string
  role?: UserRole
}

export interface Image {
  id: string
  filename: string
  url: string
  size: number
  mimeType?: string
  width?: number
  height?: number
  productId?: string
  createdAt?: string
  updatedAt?: string
}

export interface ImageListParams {
  page: number
  size: number
  filename?: string
  productId?: string
}

export interface ImageListResponse {
  list: Image[]
  total: number
  page: number
  size: number
}

export interface Category {
  id: string
  name: string
  description?: string
  parentId?: string
  createdAt?: string
  updatedAt?: string
}

export interface CategoryListParams {
  page: number
  size: number
  name?: string
  parentId?: string
}

export interface CategoryListResponse {
  list: Category[]
  total: number
  page: number
  size: number
}

export interface Tag {
  id: string
  name: string
  color?: string
  createdAt?: string
  updatedAt?: string
}

export interface TagListParams {
  page: number
  size: number
  name?: string
}

export interface TagListResponse {
  list: Tag[]
  total: number
  page: number
  size: number
}

export interface SelectionProduct {
  id: number
  asin: string
  productTitle: string
  price?: number
  imageUrl?: string
  localPath?: string
  thumbPath?: string
  storeName?: string
  storeUrl?: string
  category?: string
  tags?: string[]
  notes?: string
  productLink?: string
  salesVolume?: number
  listingDate?: string
  listingDays?: number
  deliveryMethod?: string
  similarProducts?: string
  source?: string
  country?: string
  dataFilterMode?: string
  productType: string
  mainCategoryBsrGrowthRate?: number
  mainCategoryBsrGrowth?: number
  score?: number
  grade?: string
  weekTag?: string
  isCurrent?: number
  createdAt?: string
  updatedAt?: string
}

export interface SelectionProductListParams {
  page: number
  size: number
  asin?: string
  productTitle?: string
  productType?: string
  storeName?: string
  category?: string
  country?: string
  dataFilterMode?: string
  listingDateStart?: string
  listingDateEnd?: string
  grade?: string
  weekTag?: string
  isCurrent?: number
  sortBy?: string
  sortOrder?: string
}

export interface SelectionProductListResponse {
  list: SelectionProduct[]
  total: number
  page: number
  size: number
}

export interface SelectionStats {
  totalProducts: number
  newProducts: number
  referenceProducts: number
  totalStores: number
}

export interface Log {
  id: string
  userId: string
  username: string
  action: string
  resource: string
  details?: string
  ip?: string
  createdAt: string
}

export interface LogListParams {
  page: number
  size: number
  userId?: string
  action?: string
  resource?: string
  startDate?: string
  endDate?: string
}

export interface LogListResponse {
  list: Log[]
  total: number
  page: number
  size: number
}

export interface DashboardStatistics {
  totalProducts: number
  totalImages: number
  totalUsers: number
  totalCategories: number
  totalTags: number
  recentUploads: number
  storageUsed: number
}

export interface ProductTrendData {
  date: string
  count: number
}

export interface ImageTrendData {
  date: string
  count: number
}

export interface TopProduct {
  sku: string
  name: string
  viewCount: number
  imageCount: number
}

export interface StorageStatistics {
  totalSize: number
  usedSize: number
  availableSize: number
  usagePercentage: number
}

export interface UserActivityData {
  date: string
  activeUsers: number
  actions: number
}

export interface ImageQualityStatistics {
  total: number
  highQuality: number
  mediumQuality: number
  lowQuality: number
}

export interface Store {
  id: string
  name: string
  url?: string
  createdAt?: string
}

export interface StoreListResponse {
  list: Store[]
  total: number
}

// 系统日志相关类型
export interface SystemDoc {
  id: string
  title: string
  content: string
  category: string
  createdAt?: string
  updatedAt?: string
}

export interface SystemDocListResponse {
  list: SystemDoc[]
  total: number
}

export interface UpdateRecord {
  id: string
  date: string
  title: string
  content: string
  implementation: string
  updateType: 'success' | 'info' | 'warning' | 'error'
  icon?: string
  createdAt?: string
}

export interface UpdateRecordListResponse {
  list: UpdateRecord[]
  total: number
}

export interface Requirement {
  id: string
  name: string
  description: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'completed'
  createdAt?: string
  updatedAt?: string
}

export interface RequirementCreate {
  name: string
  description: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'completed'
}

export interface RequirementUpdate {
  name?: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  status?: 'pending' | 'in_progress' | 'completed'
}

export interface RequirementListResponse {
  list: Requirement[]
  total: number
}
