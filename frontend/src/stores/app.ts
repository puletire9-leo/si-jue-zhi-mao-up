import { defineStore } from 'pinia'
import { ref } from 'vue'

interface Tag {
  path: string
  title: string
  name?: string
}

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref<boolean>(false)
  const theme = ref<string>(localStorage.getItem('theme') || 'light')
  
  const tags = ref<Tag[]>([])
  const activeTag = ref<string>('')

  const toggleSidebar = (): void => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  const setTheme = (newTheme: string): void => {
    theme.value = newTheme
    localStorage.setItem('theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }
  
  const addTag = (tag: Tag): void => {
    const { path, title, name } = tag
    
    if (!tags.value.some(t => t.path === path)) {
      tags.value.push({ path, title, name })
    }
    
    activeTag.value = path
  }
  
  const removeTag = (path: string): void => {
    const index = tags.value.findIndex(tag => tag.path === path)
    if (index !== -1) {
      tags.value.splice(index, 1)
      
      if (activeTag.value === path) {
        activeTag.value = tags.value[Math.max(0, index - 1)]?.path || ''
      }
    }
  }
  
  const removeOtherTags = (path: string): void => {
    tags.value = tags.value.filter(tag => tag.path === path || tag.path === '/dashboard')
    activeTag.value = path
  }
  
  const clearTags = (): void => {
    tags.value = [{ path: '/dashboard', title: '首页' }]
    activeTag.value = '/dashboard'
  }
  
  const setActiveTag = (path: string): void => {
    activeTag.value = path
  }

  return {
    sidebarCollapsed,
    theme,
    tags,
    activeTag,
    toggleSidebar,
    setTheme,
    addTag,
    removeTag,
    removeOtherTags,
    clearTags,
    setActiveTag
  }
})
