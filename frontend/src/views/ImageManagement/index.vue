<template>
  <div class="image-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ getPageTitle }}</span>
          <div class="header-actions">
            <el-button
              type="primary"
              :icon="Upload"
              @click="handleUpload"
            >
              上传图片
            </el-button>
            <el-button
              type="danger"
              :icon="Delete"
              :disabled="selectedIds.length === 0"
              @click="handleBatchDelete"
            >
              批量删除 ({{ selectedIds.length }})
            </el-button>
          </div>
        </div>
      </template>

      <el-form
        :inline="true"
        :model="searchForm"
        class="search-form"
      >
        <el-form-item label="图片名称">
          <el-input
            v-model="searchForm.name"
            placeholder="请输入图片名称"
            clearable
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="关联SKU">
          <el-input
            v-model="searchForm.sku"
            placeholder="请输入SKU"
            clearable
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :icon="Search"
            @click="handleSearch"
          >
            搜索
          </el-button>
          <el-button
            :icon="Refresh"
            @click="handleReset"
          >
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <div
        v-loading="loading"
        class="image-grid"
      >
        <div
          v-for="image in imageList"
          :key="image.id"
          class="image-item"
          :class="{ selected: selectedIds.includes(image.id) }"
          @click="handlePreview(image)"
        >
          <el-checkbox
            :model-value="selectedIds.includes(image.id)"
            class="image-checkbox"
            @change="handleSelect(image.id, $event)"
            @click.stop
          />
          <div class="image-wrapper">
            <img
              :src="image.url"
              :alt="image.name"
            >
          </div>
          <div class="image-info">
            <div
              class="image-name"
              :title="image.name"
            >
              {{ image.name }}
            </div>
            <div
              v-if="image.sku"
              class="image-sku"
            >
              SKU: {{ image.sku }}
            </div>
          </div>
          <div class="image-actions">
            <el-button
              type="danger"
              :icon="Delete"
              circle
              size="small"
              @click.stop="handleDelete(image)"
            />
          </div>
        </div>

        <el-empty
          v-if="!loading && imageList.length === 0"
          description="暂无图片数据"
          :image-size="200"
        />
      </div>

      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[12, 24, 48, 96]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </el-card>

    <el-dialog
      v-model="previewVisible"
      title="图片预览"
      width="80%"
    >
      <img
        :src="previewUrl"
        style="width: 100%"
      >
    </el-dialog>

    <el-dialog
      v-model="uploadVisible"
      title="上传图片"
      width="600px"
    >
      <ImageUpload
        v-model="uploadImages"
        :max-files="10"
        @upload-success="handleUploadSuccess"
      />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Upload, Search, Refresh, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ImageUpload from '@/components/ImageUpload/index.vue'
import { imageApi } from '@/api/image'

const route = useRoute()

const getPageTitle = computed(() => {
  const routeName = route.name
  switch (routeName) {
    case 'PromptLibrary':
      return '提示词库'
    case 'ResourceLibrary':
      return '资料库'
    default:
      return '资料集'
  }
})

const searchForm = reactive({
  name: '',
  sku: ''
})

const imageList = ref([])
const selectedIds = ref([])
const previewVisible = ref(false)
const previewUrl = ref('')
const uploadVisible = ref(false)
const uploadImages = ref([])
const loading = ref(false)

const pagination = reactive({
  page: 1,
  size: 12,
  total: 0
})

const loadImages = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      size: pagination.size,
      ...searchForm
    }
    const response = await imageApi.getList(params)
    imageList.value = response.data?.list || []
    pagination.total = response.data?.total || 0
  } catch (error) {
    ElMessage.error('加载图片列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  loadImages()
}

const handleReset = () => {
  searchForm.name = ''
  searchForm.sku = ''
  pagination.page = 1
  loadImages()
}

const handlePreview = (image) => {
  previewUrl.value = image.url
  previewVisible.value = true
}

const handleUpload = () => {
  uploadVisible.value = true
}

const handleUploadSuccess = () => {
  uploadVisible.value = false
  loadImages()
}

const handleSelect = (id, selected) => {
  if (selected) {
    selectedIds.value.push(id)
  } else {
    const index = selectedIds.value.indexOf(id)
    if (index > -1) {
      selectedIds.value.splice(index, 1)
    }
  }
}

const handleDelete = async (image) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除该图片吗？',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await imageApi.delete(image.id)
    ElMessage.success('删除成功')
    loadImages()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedIds.value.length} 张图片吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await imageApi.batchDelete(selectedIds.value)
    ElMessage.success('批量删除成功')
    selectedIds.value = []
    loadImages()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败')
    }
  }
}

const handleSizeChange = (size) => {
  pagination.size = size
  loadImages()
}

const handlePageChange = (page) => {
  pagination.page = page
  loadImages()
}

onMounted(() => {
  loadImages()
})
</script>

<style scoped lang="scss">
.image-management {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.search-form {
  margin-bottom: 20px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
  min-height: 400px;
}

.image-item {
  position: relative;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  }

  &.selected {
    border: 2px solid #2563eb;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
  }
}

.image-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
}

.image-wrapper {
  width: 100%;
  padding-top: 100%;
  position: relative;
  background: #f8fafc;

  img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.image-info {
  padding: 12px;
}

.image-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-sku {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.image-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-item:hover .image-actions {
  opacity: 1;
}

.el-pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>
