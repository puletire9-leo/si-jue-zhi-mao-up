<template>
  <div class="product-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>产品管理</span>
          <div class="header-actions">
            <el-button type="primary" :icon="Plus" @click="handleAdd">
              添加产品
            </el-button>
            <el-button
              type="success"
              :icon="Upload"
              @click="handleImport"
            >
              导入Excel
            </el-button>
            <el-button
              type="info"
              :icon="Download"
              @click="handleDownloadTemplate"
            >
              下载模板
            </el-button>
            <el-button
              type="warning"
              :icon="Refresh"
              @click="handleRecycleBin"
            >
              回收站
            </el-button>
            <el-button
              type="danger"
              :icon="Delete"
              :disabled="selectedSkus.length === 0"
              @click="handleBatchDelete"
            >
              批量删除 ({{ selectedSkus.length }})
            </el-button>
            <el-dropdown @command="handleSelectAll">
              <el-button type="primary" :icon="Select">
                全选
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="current">选择当前页</el-dropdown-item>
                  <el-dropdown-item command="all">选择全部</el-dropdown-item>
                  <el-dropdown-item command="clear" :icon="Close">清空选择</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="SKU">
          <el-input
            v-model="searchForm.sku"
            placeholder="请输入SKU"
            clearable
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="产品名称">
          <el-input
            v-model="searchForm.name"
            placeholder="请输入产品名称"
            clearable
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item label="产品类型">
          <el-select
            v-model="searchForm.type"
            placeholder="请选择"
            clearable
            @change="handleSearch"
          >
            <el-option label="全部" value="" />
            <el-option label="普通产品" value="普通产品" />
            <el-option label="组合产品" value="组合产品" />
            <el-option label="定制产品" value="定制产品" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">
            搜索
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">
            重置
          </el-button>
          <el-button type="info" :icon="Picture" @click="handleSearchByImage">
            以图搜图
          </el-button>
        </el-form-item>
      </el-form>

      <div v-loading="loading" class="product-cards-grid">
        <UniversalCard
          v-for="product in productList"
          :key="product.sku"
          :product="product"
          :selected="selectedSkus.includes(product.sku)"
          mode="product"
          @click="handleCardClick"
          @select="handleSelect"
          @delete="handleDeleteProduct"
        />
        
        <el-empty
          v-if="!loading && productList.length === 0"
          description="暂无产品数据"
          :image-size="200"
        />
      </div>

      <div class="pagination-container">
        <div class="page-size-selector">
          <label>每页显示：</label>
          <el-select v-model="pagination.size" @change="handleSizeChange">
            <el-option label="60" :value="60" />
            <el-option label="100" :value="100" />
            <el-option label="200" :value="200" />
            <el-option label="500" :value="500" />
          </el-select>
        </div>
        <el-pagination
          v-model:current-page="pagination.page"
          :page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[60, 100, 200, 500]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="importDialogVisible"
      title="Excel导入"
      width="500px"
    >
      <el-alert
        title="提示"
        type="info"
        :closable="false"
        style="margin-bottom: 20px"
      >
        <template #default>
          <div>
            <p>请确保Excel文件包含以下列：</p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>*SKU（必填）</li>
              <li>品名（必填）</li>
              <li>创建时间</li>
              <li>产品类型</li>
              <li>包含单品</li>
              <li>开发人</li>
              <li>图片链接</li>
            </ul>
            <p style="margin-top: 10px; color: #409eff;">💡 点击页面顶部的"下载模板"按钮可获取标准模板</p>
          </div>
        </template>
      </el-alert>
      
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls"
        :on-change="handleFileChange"
        :on-exceed="handleExceed"
        drag
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            只支持 .xlsx/.xls 格式的Excel文件
          </div>
        </template>
      </el-upload>
      
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="handleImportSubmit">
          开始导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="searchByImageDialogVisible"
      title="以图搜图"
      width="500px"
    >
      <el-upload
        ref="imageUploadRef"
        :auto-upload="false"
        :limit="1"
        accept="image/jpeg,image/png,image/webp,image/bmp"
        :on-change="handleImageChange"
        :on-exceed="handleExceed"
        drag
      >
        <el-icon class="el-icon--upload"><PictureFilled /></el-icon>
        <div class="el-upload__text">
          拖拽图片到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 JPG、PNG、WebP、BMP 格式，最大 5MB
          </div>
        </template>
      </el-upload>
      
      <div v-if="searchImagePreview" class="image-preview">
        <el-image :src="searchImagePreview" fit="contain" />
      </div>
      
      <template #footer>
        <el-button @click="searchByImageDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="searching" @click="handleSearchByImageSubmit">
          开始搜索
        </el-button>
      </template>
    </el-dialog>

    <ProductDetailDialog
      v-model:visible="detailDialogVisible"
      :product="selectedProduct"
      mode="product"
      :show-edit-button="true"
      :show-delete-button="true"
      @edit="handleEditProduct"
      @delete="handleDeleteProduct"
    />

    <el-dialog
      v-model="addDialogVisible"
      title="添加产品"
      width="800px"
      :before-close="handleAddDialogClose"
    >
      <el-form
        ref="addFormRef"
        :model="addForm"
        :rules="addFormRules"
        label-width="120px"
        label-position="left"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="SKU" prop="sku">
              <el-input
                v-model="addForm.sku"
                placeholder="请输入产品SKU"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品名称" prop="name">
              <el-input
                v-model="addForm.name"
                placeholder="请输入产品名称"
                maxlength="255"
                show-word-limit
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="产品类型" prop="type">
              <el-select
                v-model="addForm.type"
                placeholder="请选择产品类型"
                style="width: 100%"
              >
                <el-option label="普通产品" value="普通产品" />
                <el-option label="组合产品" value="组合产品" />
                <el-option label="定制产品" value="定制产品" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品分类" prop="category">
              <el-input
                v-model="addForm.category"
                placeholder="请输入产品分类"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="产品描述" prop="description">
          <el-input
            v-model="addForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入产品描述"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="产品标签" prop="tags">
          <el-select
            v-model="addForm.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="请选择或输入产品标签"
            style="width: 100%"
          >
            <el-option label="热销" value="热销" />
            <el-option label="新品" value="新品" />
            <el-option label="促销" value="促销" />
            <el-option label="精品" value="精品" />
            <el-option label="推荐" value="推荐" />
          </el-select>
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="产品价格" prop="price">
              <el-input-number
                v-model="addForm.price"
                :min="0"
                :precision="2"
                placeholder="请输入产品价格"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="库存数量" prop="stock">
              <el-input-number
                v-model="addForm.stock"
                :min="0"
                placeholder="请输入库存数量"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="产品图片URL" prop="image">
          <el-input
            v-model="addForm.image"
            placeholder="请输入产品图片URL"
          />
        </el-form-item>

        <el-form-item label="包含单品" prop="includedItems">
          <el-input
            v-model="addForm.includedItems"
            type="textarea"
            :rows="2"
            placeholder="请输入包含的单品信息（仅组合产品需要）"
          />
        </el-form-item>

        <el-form-item label="开发负责人" prop="developer">
          <el-input
            v-model="addForm.developer"
            placeholder="请输入开发负责人"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="handleAddDialogClose">取消</el-button>
        <el-button type="primary" :loading="adding" @click="handleAddSubmit">
          确定添加
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'Products' })
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Delete, Search, Refresh, Download, Upload, Picture, UploadFilled, PictureFilled, Select, Close } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import UniversalCard from '@/components/UniversalCard/index.vue'
import ProductDetailDialog from '@/components/ProductDetailDialog/index.vue'
import { productApi, productRecycleApi } from '@/api/product'
import type { Product } from '@/types/api'
import type { UploadInstance, UploadFile } from 'element-plus'

interface SearchForm {
  sku: string
  name: string
  type: string
}

interface Pagination {
  page: number
  size: number
  total: number
}

const router = useRouter()

const searchForm = reactive<SearchForm>({
  sku: '',
  name: '',
  type: ''
})

const productList = ref<Product[]>([])
const selectedSkus = ref<string[]>([])
const selectedProduct = ref<Product | null>(null)
const detailDialogVisible = ref<boolean>(false)
const loading = ref<boolean>(false)
const importDialogVisible = ref<boolean>(false)
const searchByImageDialogVisible = ref<boolean>(false)
const importing = ref<boolean>(false)
const searching = ref<boolean>(false)
const uploadRef = ref<UploadInstance>()
const imageUploadRef = ref<UploadInstance>()
const importFile = ref<File | null>(null)
const searchImageFile = ref<File | null>(null)
const searchImagePreview = ref<string>('')

const pagination = reactive<Pagination>({
  page: 1,
  size: 60,
  total: 0
})

const addDialogVisible = ref<boolean>(false)
const adding = ref<boolean>(false)
const addFormRef = ref<FormInstance>()

const addForm = reactive({
  sku: '',
  name: '',
  type: '普通产品',
  category: '',
  description: '',
  tags: [] as string[],
  price: undefined as number | undefined,
  stock: undefined as number | undefined,
  image: '',
  includedItems: '',
  developer: ''
})

const addFormRules: FormRules = {
  sku: [
    { required: true, message: '请输入产品SKU', trigger: 'blur' },
    { min: 1, max: 100, message: 'SKU长度应在1-100个字符之间', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入产品名称', trigger: 'blur' },
    { min: 1, max: 255, message: '产品名称长度应在1-255个字符之间', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择产品类型', trigger: 'change' }
  ]
}

const loadProducts = async (): Promise<void> => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      page_size: pagination.size,
      ...searchForm
    }
    
    // 使用搜索端点，传递所有搜索参数
    const response = await productApi.search(searchForm.name || '', params)
    productList.value = response.data?.list || []
    pagination.total = response.data?.total || 0
  } catch (error) {
    ElMessage.error('加载产品列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = (): void => {
  pagination.page = 1
  loadProducts()
}

const handleReset = (): void => {
  searchForm.sku = ''
  searchForm.name = ''
  searchForm.type = ''
  pagination.page = 1
  loadProducts()
}

const handleCardClick = (product: Product): void => {
  selectedProduct.value = product
  detailDialogVisible.value = true
}

const handleEditProduct = (product: Product): void => {
  ElMessage.info('编辑产品功能开发中...')
}

const handleDeleteProduct = async (product: Product): Promise<void> => {
  try {
    await ElMessageBox.confirm(
      `确定要删除产品 ${product.sku} 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await productApi.delete(product.sku)
    ElMessage.success('产品已移入回收站')
    loadProducts()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleSelect = (sku: string, selected: boolean): void => {
  if (selected) {
    selectedSkus.value.push(sku)
  } else {
    const index = selectedSkus.value.indexOf(sku)
    if (index > -1) {
      selectedSkus.value.splice(index, 1)
    }
  }
}

const handleAdd = (): void => {
  addDialogVisible.value = true
}

const handleAddDialogClose = (): void => {
  addDialogVisible.value = false
  resetAddForm()
}

const resetAddForm = (): void => {
  if (addFormRef.value) {
    addFormRef.value.clearValidate()
  }
  Object.assign(addForm, {
    sku: '',
    name: '',
    type: '普通产品',
    category: '',
    description: '',
    tags: [],
    price: undefined,
    stock: undefined,
    image: '',
    includedItems: '',
    developer: ''
  })
}

const handleAddSubmit = async (): Promise<void> => {
  if (!addFormRef.value) return
  
  try {
    await addFormRef.value.validate()
    
    adding.value = true
    try {
      const productData = {
        sku: addForm.sku.trim(),
        name: addForm.name.trim(),
        type: addForm.type,
        category: addForm.category.trim() || null,
        description: addForm.description.trim() || null,
        tags: addForm.tags.length > 0 ? addForm.tags : null,
        price: addForm.price || null,
        stock: addForm.stock || null,
        image: addForm.image.trim() || null,
        includedItems: addForm.includedItems.trim() || null,
        developer: addForm.developer.trim() || null
      }

      await productApi.create(productData)
      ElMessage.success('添加产品成功')
      addDialogVisible.value = false
      resetAddForm()
      loadProducts()
    } catch (error) {
      console.error('添加产品失败:', error)
      ElMessage.error('添加产品失败')
    } finally {
      adding.value = false
    }
  } catch (error) {
    ElMessage.error('请检查表单填写是否正确')
  }
}

const handleDelete = async (sku: string): Promise<void> => {
  try {
    await ElMessageBox.confirm(
      '确定要删除该产品吗？删除后可从回收站恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await productApi.delete(sku)
    ElMessage.success('产品已移入回收站')
    loadProducts()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleBatchDelete = async (): Promise<void> => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedSkus.value.length} 个产品吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await productApi.batchDelete(selectedSkus.value)
    ElMessage.success('批量删除成功')
    selectedSkus.value = []
    loadProducts()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败')
    }
  }
}

const handleSelectAll = async (command: string): Promise<void> => {
  if (command === 'current') {
    const currentSkus = productList.value.map(p => p.sku)
    selectedSkus.value = [...new Set([...selectedSkus.value, ...currentSkus])]
    ElMessage.success(`已选择当前页 ${currentSkus.length} 个产品`)
  } else if (command === 'all') {
    try {
      const response = await productRecycleApi.getAllSkus(searchForm.type)
      selectedSkus.value = response.data.skus
      ElMessage.success(`已选择全部 ${response.data.total} 个产品`)
    } catch (error) {
      ElMessage.error('获取全部产品失败')
    }
  } else if (command === 'clear') {
    selectedSkus.value = []
    ElMessage.info('已清空选择')
  }
}

const handleDownloadTemplate = async (): Promise<void> => {
  console.log('=== 开始下载产品模板 ===')
  try {
    console.log('调用 productApi.downloadTemplate()')
    const blob = await productApi.downloadTemplate()
    console.log('收到blob响应:', blob)
    downloadFile(blob, 'product_import_template.xlsx')
    ElMessage.success('模板下载成功')
  } catch (error) {
    console.error('下载模板失败:', error)
    ElMessage.error('模板下载失败')
  }
}

const downloadFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const handleImport = (): void => {
  importDialogVisible.value = true
}

const handleFileChange = (file: UploadFile): void => {
  importFile.value = file.raw as File
}

const handleImageChange = (file: UploadFile): void => {
  searchImageFile.value = file.raw as File
  const reader = new FileReader()
  reader.onload = (e: ProgressEvent<FileReader>) => {
    searchImagePreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file.raw as File)
}

const handleExceed = (): void => {
  ElMessage.warning('只能上传一个文件')
}

const handleImportSubmit = async (): Promise<void> => {
  if (!importFile.value) {
    ElMessage.warning('请选择要导入的Excel文件')
    return
  }
  
  importing.value = true
  try {
    await productApi.import(importFile.value)
    ElMessage.success('导入成功')
    importDialogVisible.value = false
    importFile.value = null
    loadProducts()
  } catch (error) {
    ElMessage.error('导入失败')
  } finally {
    importing.value = false
  }
}

const handleSearchByImage = (): void => {
  searchByImageDialogVisible.value = true
}

const handleSearchByImageSubmit = async (): Promise<void> => {
  if (!searchImageFile.value) {
    ElMessage.warning('请选择要搜索的图片')
    return
  }
  
  searching.value = true
  try {
    ElMessage.info('以图搜图功能开发中...')
  } catch (error) {
    ElMessage.error('搜索失败')
  } finally {
    searching.value = false
  }
}

const handleRecycleBin = (): void => {
          router.push('/product-recycle-bin')
        }

const handleSizeChange = (size: number): void => {
  pagination.size = size
  loadProducts()
}

const handlePageChange = (page: number): void => {
  pagination.page = page
  loadProducts()
}

onBeforeMount(() => {
  loadProducts()
})
</script>

<style scoped lang="scss">
.product-management {
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

.product-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
  min-height: 400px;
}

.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  
  .page-size-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    
    label {
      color: #606266;
      font-size: 14px;
    }
  }
}

.image-preview {
  margin-top: 20px;
  text-align: center;
  
  .el-image {
    max-width: 100%;
    max-height: 300px;
  }
}
</style>
