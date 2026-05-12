import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const themeMode = ref<'light' | 'dark' | 'system'>('light')
  const themeColor = ref('#7C61D4')
  const menuLayout = ref<'vertical' | 'horizontal' | 'mix'>('vertical')
  const stretchType = ref<'fixed' | 'custom'>('fixed')
  const customWidth = ref(1440)
  const tagsStyle = ref<'smart' | 'card' | 'chrome'>('chrome')
  
  const watermarkConfigs = reactive({
    enable: false,
    text: '思觉智贸'
  })
  
  const interfaceSettings = reactive({
    hideTabs: false,
    hideFooter: false,
    multiTagsCache: true,
    showLogo: true,
    greyMode: false,
    weakMode: false
  })

  const setThemeMode = (mode: 'light' | 'dark' | 'system') => {
    themeMode.value = mode
    updateThemeMode(mode)
  }

  const setThemeColor = (color: string) => {
    themeColor.value = color
    updateThemeColor(color)
  }

  const setMenuLayout = (layout: 'vertical' | 'horizontal' | 'mix') => {
    menuLayout.value = layout
    updateMenuLayout(layout)
  }

  const setStretchType = (type: 'fixed' | 'custom') => {
    stretchType.value = type
  }

  const setCustomWidth = (width: number) => {
    customWidth.value = width
    updatePageWidth(width)
  }

  const setTagsStyle = (style: 'smart' | 'card' | 'chrome') => {
    tagsStyle.value = style
  }

  const setWatermarkEnable = (enable: boolean) => {
    watermarkConfigs.enable = enable
    updateWatermark(enable, watermarkConfigs.text)
  }

  const setWatermarkText = (text: string) => {
    watermarkConfigs.text = text
    updateWatermark(watermarkConfigs.enable, text)
  }

  const setHideTabs = (hide: boolean) => {
    interfaceSettings.hideTabs = hide
  }

  const setHideFooter = (hide: boolean) => {
    interfaceSettings.hideFooter = hide
  }

  const setMultiTagsCache = (enable: boolean) => {
    interfaceSettings.multiTagsCache = enable
  }

  const setShowLogo = (show: boolean) => {
    interfaceSettings.showLogo = show
  }

  const setGreyMode = (enable: boolean) => {
    interfaceSettings.greyMode = enable
    updateGreyMode(enable)
  }

  const setWeakMode = (enable: boolean) => {
    interfaceSettings.weakMode = enable
    updateWeakMode(enable)
  }

  const updateThemeMode = (mode: string) => {
    const html = document.documentElement
    if (mode === 'dark') {
      html.setAttribute('data-theme', 'dark')
      html.classList.add('dark')
    } else if (mode === 'light') {
      html.setAttribute('data-theme', 'light')
      html.classList.remove('dark')
    } else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (isDark) {
        html.setAttribute('data-theme', 'dark')
        html.classList.add('dark')
      } else {
        html.setAttribute('data-theme', 'light')
        html.classList.remove('dark')
      }
    }
  }

  const updateThemeColor = (color: string) => {
    document.documentElement.style.setProperty('--primary-color', color)
    document.documentElement.style.setProperty('--el-color-primary', color)
  }

  const updateMenuLayout = (layout: string) => {
    document.body.setAttribute('layout', layout)
  }

  const updatePageWidth = (width: number) => {
    document.documentElement.style.setProperty('--page-width', `${width}px`)
  }

  const updateWatermark = (enable: boolean, text: string) => {
    if (enable) {
      addWatermark(text)
    } else {
      removeWatermark()
    }
  }

  const updateGreyMode = (enable: boolean) => {
    const html = document.documentElement
    if (enable) {
      html.classList.add('grey-mode')
    } else {
      html.classList.remove('grey-mode')
    }
  }

  const updateWeakMode = (enable: boolean) => {
    const html = document.documentElement
    if (enable) {
      html.classList.add('weak-mode')
    } else {
      html.classList.remove('weak-mode')
    }
  }

  const addWatermark = (text: string) => {
    removeWatermark()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    canvas.width = 200
    canvas.height = 200
    ctx.font = '14px sans-serif'
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
    ctx.rotate(-Math.PI / 12)
    ctx.fillText(text, 50, 100)
    
    const watermark = document.createElement('div')
    watermark.id = 'watermark'
    watermark.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url(${canvas.toDataURL()});
      pointer-events: none;
      z-index: 9999;
    `
    document.body.appendChild(watermark)
  }

  const removeWatermark = () => {
    const watermark = document.getElementById('watermark')
    if (watermark) {
      watermark.remove()
    }
  }

  const clearCache = () => {
    localStorage.clear()
    sessionStorage.clear()
    window.location.reload()
  }

  return {
    themeMode,
    themeColor,
    menuLayout,
    stretchType,
    customWidth,
    tagsStyle,
    watermarkConfigs,
    interfaceSettings,
    setThemeMode,
    setThemeColor,
    setMenuLayout,
    setStretchType,
    setCustomWidth,
    setTagsStyle,
    setWatermarkEnable,
    setWatermarkText,
    setHideTabs,
    setHideFooter,
    setMultiTagsCache,
    setShowLogo,
    setGreyMode,
    setWeakMode,
    clearCache
  }
})
