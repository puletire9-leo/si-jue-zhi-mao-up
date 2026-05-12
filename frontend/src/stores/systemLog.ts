import { defineStore } from 'pinia'
import { logsApi } from '@/api/logs'
import type {
  SystemDoc,
  UpdateRecord,
  Requirement,
  RequirementCreate,
  RequirementUpdate
} from '@/types/api'

interface SystemLogState {
  // 系统文档状态
  systemDocs: SystemDoc[]
  systemDocsLoading: boolean
  systemDocsError: string | null
  
  // 更新记录状态
  updateRecords: UpdateRecord[]
  updateRecordsLoading: boolean
  updateRecordsError: string | null
  
  // 需求清单状态
  requirements: Requirement[]
  requirementsLoading: boolean
  requirementsError: string | null
  
  // 当前激活的子模块
  activeTab: string
}

export const useSystemLogStore = defineStore('systemLog', {
  state: (): SystemLogState => ({
    // 系统文档状态
    systemDocs: [],
    systemDocsLoading: false,
    systemDocsError: null,
    
    // 更新记录状态
    updateRecords: [],
    updateRecordsLoading: false,
    updateRecordsError: null,
    
    // 需求清单状态
    requirements: [],
    requirementsLoading: false,
    requirementsError: null,
    
    // 当前激活的子模块
    activeTab: 'system-doc'
  }),
  
  getters: {
    // 获取系统文档列表
    getSystemDocs: (state) => state.systemDocs,
    
    // 获取更新记录列表
    getUpdateRecords: (state) => state.updateRecords,
    
    // 获取需求清单列表
    getRequirements: (state) => state.requirements,
    
    // 获取当前激活的子模块
    getActiveTab: (state) => state.activeTab,
    
    // 按优先级排序的需求列表
    getRequirementsByPriority: (state) => {
      return [...state.requirements].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
    },
    
    // 按状态分组的需求列表
    getRequirementsByStatus: (state) => {
      const grouped: Record<string, Requirement[]> = {
        pending: [],
        in_progress: [],
        completed: []
      }
      
      state.requirements.forEach(requirement => {
        grouped[requirement.status].push(requirement)
      })
      
      return grouped
    }
  },
  
  actions: {
    // 设置当前激活的子模块
    setActiveTab(tab: string) {
      this.activeTab = tab
    },
    
    // 获取系统文档列表
    async fetchSystemDocs() {
      this.systemDocsLoading = true
      this.systemDocsError = null
      
      try {
        const response = await logsApi.getSystemDocs()
        if (response.code === 200 && response.data) {
          this.systemDocs = response.data.list
        }
      } catch (error: any) {
        this.systemDocsError = error.message || '获取系统文档失败'
        console.error('获取系统文档失败:', error)
      } finally {
        this.systemDocsLoading = false
      }
    },
    
    // 获取更新记录列表
    async fetchUpdateRecords() {
      this.updateRecordsLoading = true
      this.updateRecordsError = null
      
      try {
        const response = await logsApi.getUpdateRecords()
        if (response.code === 200 && response.data) {
          this.updateRecords = response.data.list
        }
      } catch (error: any) {
        this.updateRecordsError = error.message || '获取更新记录失败'
        console.error('获取更新记录失败:', error)
      } finally {
        this.updateRecordsLoading = false
      }
    },
    
    // 获取需求清单列表
    async fetchRequirements() {
      this.requirementsLoading = true
      this.requirementsError = null
      
      try {
        const response = await logsApi.getRequirements()
        if (response.code === 200 && response.data) {
          this.requirements = response.data.list
        }
      } catch (error: any) {
        this.requirementsError = error.message || '获取需求清单失败'
        console.error('获取需求清单失败:', error)
      } finally {
        this.requirementsLoading = false
      }
    },
    
    // 添加新需求
    async addRequirement(data: RequirementCreate) {
      try {
        const response = await logsApi.createRequirement(data)
        if (response.code === 200 && response.data) {
          this.requirements.unshift(response.data)
          return response.data
        }
      } catch (error: any) {
        console.error('添加需求失败:', error)
        throw error
      }
    },
    
    // 更新需求
    async updateRequirement(id: string, data: RequirementUpdate) {
      try {
        const response = await logsApi.updateRequirement(id, data)
        if (response.code === 200 && response.data) {
          const index = this.requirements.findIndex(req => req.id === id)
          if (index !== -1) {
            this.requirements[index] = response.data
          }
          return response.data
        }
      } catch (error: any) {
        console.error('更新需求失败:', error)
        throw error
      }
    },
    
    // 删除需求
    async deleteRequirement(id: string) {
      try {
        await logsApi.deleteRequirement(id)
        this.requirements = this.requirements.filter(req => req.id !== id)
      } catch (error: any) {
        console.error('删除需求失败:', error)
        throw error
      }
    },
    
    // 批量获取所有系统日志数据
    async fetchAllSystemLogData() {
      await Promise.all([
        this.fetchSystemDocs(),
        this.fetchUpdateRecords(),
        this.fetchRequirements()
      ])
    }
  }
})
