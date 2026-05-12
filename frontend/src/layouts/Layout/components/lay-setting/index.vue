<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useDataThemeChange } from '../../hooks/useDataThemeChange';
import { storageConfigure, storageConfigureChange } from '@/utils/storage';
import { emitter } from '@/utils/emitter';

const {
  dataTheme,
  themeMode,
  themeColors,
  toggleClass,
  dataThemeChange,
  setLayoutThemeColor,
  setMenuLayout,
  onReset
} = useDataThemeChange();

const watermarkConfigs = reactive({
  enable: storageConfigure.watermark,
  text: storageConfigure.watermarkText
});

const settings = reactive({
  greyVal: storageConfigure.grey,
  weakVal: storageConfigure.weak,
  tabsVal: storageConfigure.hideTabs,
  showLogo: storageConfigure.showLogo,
  tagsStyle: storageConfigure.tagsStyle,
  hideFooter: storageConfigure.hideFooter,
  multiTagsCache: storageConfigure.multiTagsCache,
  stretch: storageConfigure.stretchType === 'custom' ? storageConfigure.customWidth : false
});

const handleThemeModeChange = (mode: 'dark' | 'light' | 'system') => {
  dataThemeChange(mode);
};

const handleThemeColorChange = (theme: string) => {
  setLayoutThemeColor(theme);
};

const handleMenuLayoutChange = (layout: 'horizontal' | 'vertical' | 'mix') => {
  setMenuLayout(layout);
};

const handleStretchTypeChange = (type: 'fixed' | 'custom') => {
  storageConfigureChange('stretchType', type);
  if (type === 'custom') {
    settings.stretch = storageConfigure.customWidth;
  } else {
    settings.stretch = false;
  }
};

const handleCustomWidthChange = (width: number) => {
  storageConfigureChange('customWidth', width);
  settings.stretch = width;
};

const handleTagsStyleChange = (style: 'smart' | 'card' | 'chrome') => {
  storageConfigureChange('tagsStyle', style);
  settings.tagsStyle = style;
  emitter.emit('tagViewsTagsStyle', style);
};

const handleWatermarkEnableChange = (enable: boolean) => {
  storageConfigureChange('watermark', enable);
  watermarkConfigs.enable = enable;
  updateWatermark(enable, watermarkConfigs.text);
};

const handleWatermarkTextChange = () => {
  storageConfigureChange('watermarkText', watermarkConfigs.text);
  updateWatermark(watermarkConfigs.enable, watermarkConfigs.text);
};

const handleHideTabsChange = (hide: boolean) => {
  storageConfigureChange('hideTabs', hide);
  settings.tabsVal = hide;
  emitter.emit('tagViewsChange', hide);
};

const handleHideFooterChange = (hide: boolean) => {
  storageConfigureChange('hideFooter', hide);
  settings.hideFooter = hide;
};

const handleMultiTagsCacheChange = (enable: boolean) => {
  storageConfigureChange('multiTagsCache', enable);
  settings.multiTagsCache = enable;
};

const handleShowLogoChange = (show: boolean) => {
  storageConfigureChange('showLogo', show);
  settings.showLogo = show;
  emitter.emit('logoChange', show);
};

const handleGreyModeChange = (enable: boolean) => {
  storageConfigureChange('grey', enable);
  settings.greyVal = enable;
  toggleClass(enable, 'html-grey', document.querySelector('html'));
};

const handleWeakModeChange = (enable: boolean) => {
  storageConfigureChange('weak', enable);
  settings.weakVal = enable;
  toggleClass(enable, 'html-weakness', document.querySelector('html'));
};

const updateWatermark = (enable: boolean, text: string) => {
  if (enable) {
    addWatermark(text);
  } else {
    removeWatermark();
  }
};

const addWatermark = (text: string) => {
  removeWatermark();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  canvas.width = 200;
  canvas.height = 200;
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.rotate(-Math.PI / 12);
  ctx.fillText(text, 50, 100);
  
  const watermark = document.createElement('div');
  watermark.id = 'watermark';
  watermark.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: url(${canvas.toDataURL()});
    pointer-events: none;
    z-index: 9999;
  `;
  document.body.appendChild(watermark);
};

const removeWatermark = () => {
  const watermark = document.getElementById('watermark');
  if (watermark) {
    watermark.remove();
  }
};

const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

const handleMediaChange = () => {
  if (storageConfigure.themeMode !== 'system') return;
  if (mediaQueryList.matches) {
    dataThemeChange('dark');
  } else {
    dataThemeChange('light');
  }
};

onMounted(() => {
  if (storageConfigure.watermark) {
    addWatermark(storageConfigure.watermarkText);
  }
  if (storageConfigure.grey) {
    toggleClass(true, 'html-grey', document.querySelector('html'));
  }
  if (storageConfigure.weak) {
    toggleClass(true, 'html-weakness', document.querySelector('html'));
  }
  mediaQueryList.addEventListener('change', handleMediaChange);
});

onUnmounted(() => {
  mediaQueryList.removeEventListener('change', handleMediaChange);
});
</script>

<template>
  <div class="setting-content">
    <div class="section">
      <h4 class="section-title">主题模式</h4>
      <div class="theme-mode">
        <button 
          v-for="mode in ['light', 'dark', 'system']" 
          :key="mode"
          class="mode-btn"
          :class="{ active: storageConfigure.themeMode === mode }"
          @click="handleThemeModeChange(mode as 'light' | 'dark' | 'system')"
        >
          <span class="mode-icon">{{ mode === 'light' ? '☀' : mode === 'dark' ? '☽' : '⚙' }}</span>
          <span class="mode-label">{{ mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '自动' }}</span>
        </button>
      </div>
    </div>

    <div class="section">
      <h4 class="section-title">主题色</h4>
      <div class="theme-colors">
        <button
          v-for="item in themeColors"
          :key="item.themeColor"
          class="color-btn"
          :style="{ background: item.color }"
          :class="{ active: storageConfigure.themeColor === item.themeColor }"
          @click="handleThemeColorChange(item.themeColor)"
        >
          <span v-if="storageConfigure.themeColor === item.themeColor" class="check-icon">✓</span>
        </button>
      </div>
    </div>

    <div class="section">
      <h4 class="section-title">菜单布局</h4>
      <div class="menu-layout">
        <button
          class="layout-btn"
          :class="{ active: storageConfigure.menuLayout === 'vertical' }"
          @click="handleMenuLayoutChange('vertical')"
        >
          <div class="layout-icon vertical">
            <div class="sidebar"></div>
            <div class="content"></div>
          </div>
        </button>
        <button
          class="layout-btn"
          :class="{ active: storageConfigure.menuLayout === 'horizontal' }"
          @click="handleMenuLayoutChange('horizontal')"
        >
          <div class="layout-icon horizontal">
            <div class="header"></div>
            <div class="content"></div>
          </div>
        </button>
        <button
          class="layout-btn"
          :class="{ active: storageConfigure.menuLayout === 'mix' }"
          @click="handleMenuLayoutChange('mix')"
        >
          <div class="layout-icon mix">
            <div class="header"></div>
            <div class="sidebar"></div>
            <div class="content"></div>
          </div>
        </button>
      </div>
    </div>

    <div class="section">
      <h4 class="section-title">页宽</h4>
      <div class="stretch-options">
        <button
          class="stretch-btn"
          :class="{ active: storageConfigure.stretchType === 'fixed' }"
          @click="handleStretchTypeChange('fixed')"
        >
          固定
        </button>
        <button
          class="stretch-btn"
          :class="{ active: storageConfigure.stretchType === 'custom' }"
          @click="handleStretchTypeChange('custom')"
        >
          自定义
        </button>
      </div>
      <el-input-number
        v-if="storageConfigure.stretchType === 'custom'"
        v-model="storageConfigure.customWidth"
        :min="1280"
        :max="1600"
        class="custom-width-input"
        @change="handleCustomWidthChange"
      />
    </div>

    <div class="section">
      <h4 class="section-title">页签风格</h4>
      <div class="tags-style">
        <button
          class="style-btn"
          :class="{ active: settings.tagsStyle === 'smart' }"
          @click="handleTagsStyleChange('smart')"
        >
          灵动
        </button>
        <button
          class="style-btn"
          :class="{ active: settings.tagsStyle === 'card' }"
          @click="handleTagsStyleChange('card')"
        >
          卡片
        </button>
        <button
          class="style-btn"
          :class="{ active: settings.tagsStyle === 'chrome' }"
          @click="handleTagsStyleChange('chrome')"
        >
          谷歌
        </button>
      </div>
    </div>

    <div class="section">
      <h4 class="section-title">全屏水印</h4>
      <div class="setting-row">
        <span>水印</span>
        <el-switch
          v-model="watermarkConfigs.enable"
          inline-prompt
          active-text="开"
          inactive-text="关"
          @change="handleWatermarkEnableChange"
        />
      </div>
      <div v-if="watermarkConfigs.enable" class="setting-row">
        <span>文本</span>
        <el-input
          v-model="watermarkConfigs.text"
          class="text-input"
          placeholder="请输入水印文本"
          @input="handleWatermarkTextChange"
        />
      </div>
    </div>

    <div class="section">
      <h4 class="section-title">界面显示</h4>
      <div class="setting-row">
        <span>隐藏标签页</span>
        <el-switch
          v-model="settings.tabsVal"
          inline-prompt
          active-text="是"
          inactive-text="否"
          @change="handleHideTabsChange"
        />
      </div>
      <div class="setting-row">
        <span>隐藏页脚</span>
        <el-switch
          v-model="settings.hideFooter"
          inline-prompt
          active-text="是"
          inactive-text="否"
          @change="handleHideFooterChange"
        />
      </div>
      <div class="setting-row">
        <span>页签持久化</span>
        <el-switch
          v-model="settings.multiTagsCache"
          inline-prompt
          active-text="是"
          inactive-text="否"
          @change="handleMultiTagsCacheChange"
        />
      </div>
      <div class="setting-row">
        <span>Logo</span>
        <el-switch
          v-model="settings.showLogo"
          inline-prompt
          active-text="是"
          inactive-text="否"
          @change="handleShowLogoChange"
        />
      </div>
      <div class="setting-row">
        <span>灰色模式</span>
        <el-switch
          v-model="settings.greyVal"
          inline-prompt
          active-text="是"
          inactive-text="否"
          @change="handleGreyModeChange"
        />
      </div>
      <div class="setting-row">
        <span>色弱模式</span>
        <el-switch
          v-model="settings.weakVal"
          inline-prompt
          active-text="是"
          inactive-text="否"
          @change="handleWeakModeChange"
        />
      </div>
    </div>

    <div class="section">
      <button class="clear-cache-btn" @click="onReset">
        清空缓存
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.setting-content {
  padding: 16px;
  position: relative;
  z-index: 1;
}

.section {
  margin-bottom: 24px;

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #2F281D;
    margin-bottom: 12px;
  }
}

.theme-mode {
  display: flex;
  gap: 8px;

  .mode-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 8px;
    background: #F8F4FF;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: #EDE6FF;
    }

    &.active {
      border-color: #7C61D4;
      background: #F8F4FF;
    }

    .mode-icon {
      font-size: 20px;
    }

    .mode-label {
      font-size: 12px;
      color: #6B5E52;
    }
  }
}

.theme-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  .color-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 2px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    position: relative;

    &:hover {
      transform: scale(1.1);
    }

    &.active {
      border-color: #7C61D4;
    }

    .check-icon {
      color: white;
      font-size: 14px;
      font-weight: bold;
    }
  }
}

.menu-layout {
  display: flex;
  gap: 10px;

  .layout-btn {
    flex: 1;
    height: 44px;
    background: #F8F4FF;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: #EDE6FF;
    }

    &.active {
      border-color: #7C61D4;
    }

    .layout-icon {
      width: 32px;
      height: 24px;
      position: relative;

      &.vertical {
        .sidebar {
          position: absolute;
          left: 0;
          top: 0;
          width: 35%;
          height: 100%;
          background: #7C61D4;
          border-radius: 2px;
        }
        .content {
          position: absolute;
          right: 0;
          top: 0;
          width: 60%;
          height: 30%;
          background: #EDE6FF;
          border-radius: 2px;
        }
      }

      &.horizontal {
        .header {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 35%;
          background: #7C61D4;
          border-radius: 2px;
        }
        .content {
          position: absolute;
          left: 0;
          bottom: 0;
          width: 100%;
          height: 60%;
          background: #EDE6FF;
          border-radius: 2px;
        }
      }

      &.mix {
        .header {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 35%;
          background: #7C61D4;
          border-radius: 2px;
        }
        .sidebar {
          position: absolute;
          left: 0;
          bottom: 0;
          width: 35%;
          height: 60%;
          background: #9F85E0;
          border-radius: 2px;
        }
        .content {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 60%;
          height: 60%;
          background: #EDE6FF;
          border-radius: 2px;
        }
      }
    }
  }
}

.stretch-options {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;

  .stretch-btn {
    flex: 1;
    padding: 10px;
    background: #F8F4FF;
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: #6B5E52;
    transition: all 0.2s;

    &:hover {
      background: #EDE6FF;
    }

    &.active {
      border-color: #7C61D4;
      color: #7C61D4;
    }
  }
}

.custom-width-input {
  width: 100%;
}

.tags-style {
  display: flex;
  gap: 8px;

  .style-btn {
    flex: 1;
    padding: 10px;
    background: #F8F4FF;
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: #6B5E52;
    transition: all 0.2s;

    &:hover {
      background: #EDE6FF;
    }

    &.active {
      border-color: #7C61D4;
      color: #7C61D4;
    }
  }
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 13px;
  color: #6B5E52;

  .text-input {
    width: 150px;
  }
}

.clear-cache-btn {
  width: 100%;
  padding: 12px;
  background: #FEE2E2;
  border: none;
  border-radius: 8px;
  color: #DC2626;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #FECACA;
  }
}

// 深色主题
:deep(html.dark) {
  .setting-content {
    background: #1A1A2E;
  }

  .section {
    .section-title {
      color: #E4E4E7;
    }
  }

  .theme-mode {
    .mode-btn {
      background: #252540;
      border-color: transparent;

      &:hover {
        background: #3D3D5C;
      }

      &.active {
        border-color: #9F85E0;
        background: rgba(124, 97, 212, 0.2);
      }

      .mode-icon {
        color: #E4E4E7;
      }

      .mode-label {
        color: #A1A1AA;
      }
    }
  }

  .menu-layout {
    .layout-btn {
      background: #252540;

      &:hover {
        background: #3D3D5C;
      }

      &.active {
        border-color: #9F85E0;
      }

      .layout-icon {
        &.vertical,
        &.horizontal,
        &.mix {
          .sidebar,
          .header {
            background: #9F85E0;
          }
          .content {
            background: #3D3D5C;
          }
        }
      }
    }
  }

  .stretch-options {
    .stretch-btn {
      background: #252540;
      color: #A1A1AA;

      &:hover {
        background: #3D3D5C;
      }

      &.active {
        border-color: #9F85E0;
        color: #9F85E0;
      }
    }
  }

  .tags-style {
    .style-btn {
      background: #252540;
      color: #A1A1AA;

      &:hover {
        background: #3D3D5C;
      }

      &.active {
        border-color: #9F85E0;
        color: #9F85E0;
      }
    }
  }

  .setting-row {
    color: #A1A1AA;
  }

  .clear-cache-btn {
    background: rgba(220, 38, 38, 0.2);
    color: #FCA5A5;

    &:hover {
      background: rgba(220, 38, 38, 0.3);
    }
  }
}
</style>
