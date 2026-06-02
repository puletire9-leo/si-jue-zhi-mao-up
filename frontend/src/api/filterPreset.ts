import request from '@/utils/request'

export interface FilterPreset {
  id?: number
  userId?: number
  presetName: string
  presetIndex: number
  isDefault?: number
  filterConfig?: Record<string, any>
  createdAt?: string
  updatedAt?: string
}

export const filterPresetApi = {
  list(): Promise<any> {
    return request({ url: '/api/v1/filter-presets', method: 'get' })
  },

  getDefault(): Promise<any> {
    return request({ url: '/api/v1/filter-presets/default', method: 'get' })
  },

  save(name: string, index: number, config: Record<string, any>): Promise<any> {
    return request({ url: '/api/v1/filter-presets', method: 'post', data: { name, index, config } })
  },

  update(id: number, name: string, config: Record<string, any>): Promise<any> {
    return request({ url: `/api/v1/filter-presets/${id}`, method: 'put', data: { name, config } })
  },

  delete(id: number): Promise<any> {
    return request({ url: `/api/v1/filter-presets/${id}`, method: 'delete' })
  },

  setDefault(id: number): Promise<any> {
    return request({ url: `/api/v1/filter-presets/${id}/default`, method: 'put' })
  }
}
