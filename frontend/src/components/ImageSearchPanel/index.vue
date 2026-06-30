<script setup lang="ts">
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { Picture } from "@element-plus/icons-vue";
import { bazhuayuApi, type ImageSearchResult } from "@/api/bazhuayu";

const props = withDefaults(
  defineProps<{
    /** 源 ASIN */
    asin: string;
    /** 源图 URL（可选，用于展示对比） */
    sourceImage?: string;
  }>(),
  { sourceImage: "" },
);

const loading = ref(false);
const results = ref<ImageSearchResult[]>([]);
const searched = ref(false);

/** 先查缓存，无则提示用户主动识图 */
async function loadCache() {
  if (!props.asin) return;
  loading.value = true;
  try {
    results.value = await bazhuayuApi.getImageSearch(props.asin);
    searched.value = results.value.length > 0;
  } catch (e: any) {
    ElMessage.error(e?.message || "查询以图识图结果失败");
  } finally {
    loading.value = false;
  }
}

/** 发起识图（forceRefresh 时强制重新跑八爪鱼） */
async function runSearch(forceRefresh = false) {
  if (!props.asin) {
    ElMessage.warning("缺少 ASIN");
    return;
  }
  loading.value = true;
  try {
    results.value = await bazhuayuApi.imageSearch(props.asin, forceRefresh);
    searched.value = true;
    if (results.value.length === 0) {
      ElMessage.info("未识别到相似商品");
    }
  } catch (e: any) {
    ElMessage.error(e?.message || "以图识图失败");
  } finally {
    loading.value = false;
  }
}

function buildAmazonLink(asin: string | null): string {
  if (!asin) return "";
  return `https://www.amazon.co.uk/dp/${asin}`;
}

defineExpose({ loadCache, runSearch });
</script>

<template>
  <div class="image-search-panel" v-loading="loading">
    <div class="isp-header">
      <div class="isp-source">
        <el-image
          v-if="sourceImage"
          :src="sourceImage"
          fit="contain"
          class="isp-source-img"
        >
          <template #error>
            <div class="isp-img-slot"><el-icon><Picture /></el-icon></div>
          </template>
        </el-image>
        <div class="isp-source-info">
          <div class="isp-asin">源 ASIN：{{ asin }}</div>
          <div class="isp-tip">英国 stylesnap 以图识图</div>
        </div>
      </div>
      <div class="isp-actions">
        <el-button type="primary" :loading="loading" @click="runSearch(false)">
          识图
        </el-button>
        <el-button :loading="loading" @click="runSearch(true)">
          重新识图
        </el-button>
      </div>
    </div>

    <div v-if="loading" class="isp-loading-tip">
      云端识图中，约数分钟，请耐心等待…
    </div>

    <div v-else-if="results.length > 0" class="isp-grid">
      <div v-for="r in results" :key="r.id" class="isp-card">
        <el-image :src="r.resultImage || ''" fit="contain" class="isp-card-img">
          <template #error>
            <div class="isp-img-slot"><el-icon><Picture /></el-icon></div>
          </template>
        </el-image>
        <div class="isp-card-body">
          <div class="isp-card-title" :title="r.resultTitle || ''">
            {{ r.resultTitle || "（无标题）" }}
          </div>
          <div class="isp-card-meta">
            <span v-if="r.resultPrice" class="isp-price">{{ r.resultPrice }}</span>
            <a
              v-if="r.resultAsin"
              :href="buildAmazonLink(r.resultAsin)"
              target="_blank"
              class="isp-asin-link"
            >
              {{ r.resultAsin }}
            </a>
          </div>
        </div>
      </div>
    </div>

    <el-empty
      v-else-if="searched"
      description="未识别到相似商品"
    />
    <el-empty
      v-else
      description="点击「识图」发起英国以图识图"
    />
  </div>
</template>

<style scoped lang="scss">
.image-search-panel {
  min-height: 200px;
}

.isp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 16px;
}

.isp-source {
  display: flex;
  align-items: center;
  gap: 12px;
}

.isp-source-img {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  background: #f8fafc;
  flex-shrink: 0;
}

.isp-asin {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.isp-tip {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

.isp-loading-tip {
  text-align: center;
  color: #64748b;
  padding: 40px 0;
}

.isp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.isp-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.1);
  }
}

.isp-card-img {
  width: 100%;
  height: 160px;
  background: #f8fafc;
}

.isp-img-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 32px;
  color: #cbd5e1;
}

.isp-card-body {
  padding: 8px 10px;
}

.isp-card-title {
  font-size: 13px;
  color: #1e293b;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
}

.isp-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.isp-price {
  font-size: 13px;
  font-weight: 600;
  color: #f5576c;
}

.isp-asin-link {
  font-size: 12px;
  color: #4facfe;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
