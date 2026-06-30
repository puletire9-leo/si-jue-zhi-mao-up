<script setup lang="ts">
import { ref, nextTick } from "vue";
import { ElMessage } from "element-plus";
import ImageSearchPanel from "@/components/ImageSearchPanel/index.vue";

const asinInput = ref("");
const activeAsin = ref("");
const panelRef = ref<InstanceType<typeof ImageSearchPanel> | null>(null);

function submit() {
  const asin = asinInput.value.trim().toUpperCase();
  if (!asin) {
    ElMessage.warning("请输入 ASIN");
    return;
  }
  activeAsin.value = asin;
  // 等面板按新 asin 重建后，先查缓存，无缓存再由用户点「识图」
  nextTick(() => panelRef.value?.loadCache());
}
</script>

<template>
  <div class="image-search-page">
    <el-card>
      <template #header>
        <div class="page-header">
          <span class="title">以图识图（英国）</span>
          <span class="subtitle">
            输入 ASIN，取其图片生成英国 stylesnap 视觉搜索，爬取亚马逊相似在售品
          </span>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="asinInput"
          placeholder="输入 ASIN，如 B0XXXXXXXX"
          clearable
          style="max-width: 360px"
          @keyup.enter="submit"
        />
        <el-button type="primary" @click="submit">查询</el-button>
      </div>

      <ImageSearchPanel
        v-if="activeAsin"
        ref="panelRef"
        :key="activeAsin"
        :asin="activeAsin"
        class="panel"
      />
      <el-empty v-else description="输入 ASIN 开始以图识图" />
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.image-search-page {
  padding: 16px;
}

.page-header {
  display: flex;
  align-items: baseline;
  gap: 12px;

  .title {
    font-size: 16px;
    font-weight: 600;
  }

  .subtitle {
    font-size: 12px;
    color: #94a3b8;
  }
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.panel {
  margin-top: 8px;
}
</style>
