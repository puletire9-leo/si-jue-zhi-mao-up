<template>
  <div class="settings" v-loading="refreshing">
    <SkeletonWrapper :loading="loading && !hasLoaded" variant="table">
      <el-card>
        <template #header>
          <span>系统设置</span>
        </template>

        <el-tabs v-model="activeTab">
          <el-tab-pane label="图片设置" name="image">
            <el-form
              :model="imageSettings"
              label-width="120px"
              style="max-width: 600px"
            >
              <el-form-item label="最大图片大小">
                <el-input-number
                  v-model="imageSettings.maxImageSize"
                  :min="1"
                  :max="200"
                />
                <span style="margin-left: 8px">MB</span>
                <div class="image-size-hint">
                  <el-icon><InfoFilled /></el-icon>
                  当前图片大小限制：{{
                    imageSettings.maxImageSize
                  }}MB，允许上传不超过此大小的图片
                </div>
              </el-form-item>

              <el-form-item label="产品卡片大小">
                <div class="card-size-settings">
                  <div class="card-size-control">
                    <el-radio-group
                      v-model="cardSizePreset"
                      class="card-size-presets"
                    >
                      <el-radio-button label="150x150"
                        >小 (150×150px)</el-radio-button
                      >
                      <el-radio-button label="200x200"
                        >中 (200×200px)</el-radio-button
                      >
                      <el-radio-button label="250x250"
                        >大 (250×250px)</el-radio-button
                      >
                      <el-radio-button label="300x300"
                        >特大 (300×300px)</el-radio-button
                      >
                      <el-radio-button label="custom">自定义</el-radio-button>
                    </el-radio-group>
                    <div class="page-selection">
                      <span>应用页面：</span>
                      <el-checkbox-group v-model="selectedPages">
                        <el-checkbox label="material-library"
                          >素材库</el-checkbox
                        >
                        <el-checkbox label="carrier-library"
                          >载体库</el-checkbox
                        >
                      </el-checkbox-group>
                    </div>
                  </div>
                  <div
                    v-if="cardSizePreset === 'custom'"
                    class="custom-size-input"
                  >
                    <div class="size-inputs">
                      <div class="size-input-item">
                        <span>宽度：</span>
                        <el-input-number
                          v-model="customCardWidth"
                          :min="100"
                          :max="500"
                          @change="updateCustomCardSize"
                          step="10"
                        />
                        <span style="margin-left: 8px">px</span>
                      </div>
                      <div class="size-input-item">
                        <span>高度：</span>
                        <el-input-number
                          v-model="customCardHeight"
                          :min="100"
                          :max="500"
                          @change="updateCustomCardSize"
                          step="10"
                        />
                        <span style="margin-left: 8px">px</span>
                      </div>
                    </div>
                  </div>
                  <div class="card-size-preview">
                    <div class="preview-label">预览效果：</div>
                    <div
                      class="preview-card"
                      :style="{
                        width: `${currentCardWidth}px`,
                        height: `${currentCardHeight}px`,
                      }"
                    >
                      <div class="preview-content">产品卡片</div>
                      <div class="preview-size">
                        {{ currentCardWidth }}px × {{ currentCardHeight }}px
                      </div>
                    </div>
                  </div>
                  <div class="card-size-hint">
                    <el-icon><InfoFilled /></el-icon>
                    选择合适的卡片大小，影响素材库和定稿页面的产品卡片显示效果
                  </div>
                </div>
              </el-form-item>

              <el-form-item>
                <el-button
                  v-if="userStore.isAdmin"
                  type="primary"
                  @click="saveImageSettings"
                >
                  保存
                </el-button>
                <span v-else class="no-permission">无权限</span>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="通用配置" name="general">
            <el-form label-width="120px" style="max-width: 1200px">
              <div class="settings-row">
                <el-form-item label="载体列表" class="settings-col">
                  <div class="carrier-list-container">
                    <!-- 载体列表 -->
                    <div class="carrier-tags">
                      <el-tag
                        v-for="(carrier, index) in generalSettings.carriers"
                        :key="index"
                        closable
                        @close="removeCarrier(index)"
                        effect="light"
                        type="success"
                      >
                        {{ carrier }}
                      </el-tag>
                    </div>
                    <!-- 添加载体输入框 -->
                    <div class="add-carrier">
                      <el-input
                        v-model="newCarrier"
                        placeholder="输入载体名称"
                        clearable
                        @keyup.enter="addCarrier"
                      >
                        <template #append>
                          <el-button type="success" @click="addCarrier">
                            添加
                          </el-button>
                        </template>
                      </el-input>
                    </div>
                  </div>
                  <div style="margin-top: 8px; color: #909399; font-size: 12px">
                    说明：载体名称将用于筛选条件和选择载体
                  </div>
                </el-form-item>
              </div>
              <el-form-item>
                <el-button
                  v-if="userStore.isAdmin"
                  type="primary"
                  @click="saveGeneralSettings"
                >
                  保存
                </el-button>
                <span v-else class="no-permission">无权限</span>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="卖家精灵配置" name="sellersprite">
            <el-form
              :model="sellerspriteForm"
              label-width="120px"
              style="max-width: 600px"
            >
              <el-form-item label="API 地址">
                <el-input v-model="sellerspriteForm.apiUrl" disabled />
              </el-form-item>
              <el-form-item label="当前密钥">
                <el-input v-model="sellerspriteForm.secretKeyMasked" disabled />
              </el-form-item>
              <el-form-item label="新密钥">
                <el-input
                  v-model="sellerspriteForm.newSecretKey"
                  type="password"
                  show-password
                  placeholder="输入新的 API Key"
                />
              </el-form-item>
              <el-form-item label="每分钟限制">
                <el-input-number
                  v-model="sellerspriteForm.maxPerMinute"
                  :min="1"
                  :max="9999"
                  controls-position="right"
                  style="width: 200px"
                />
                <span style="margin-left: 8px; color: #909399">次</span>
              </el-form-item>
              <el-form-item label="每月限制">
                <el-input-number
                  v-model="sellerspriteForm.maxPerMonth"
                  :min="1"
                  :max="999999"
                  controls-position="right"
                  style="width: 200px"
                />
                <span style="margin-left: 8px; color: #909399">次</span>
              </el-form-item>
              <el-form-item label="单次 ASIN 上限">
                <el-input-number
                  v-model="sellerspriteForm.maxAsinsPerRequest"
                  :min="1"
                  :max="9999"
                  controls-position="right"
                  style="width: 200px"
                />
                <span style="margin-left: 8px; color: #909399">个</span>
              </el-form-item>
              <el-form-item>
                <el-button
                  v-if="userStore.isAdmin"
                  type="primary"
                  @click="saveSellerspriteConfig"
                  :loading="savingSellersprite"
                >
                  保存
                </el-button>
                <span v-else class="no-permission">无权限</span>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="领星导入" name="lingxing">
            <el-form
              :model="lingxingDefaults"
              label-width="140px"
              style="max-width: 720px"
            >
              <div class="lingxing-hint">
                <el-icon><InfoFilled /></el-icon>
                <span
                  >导入领星时"产品负责人"和"采购员"预填这里的默认值,现场仍可临时修改。开发人自动填当前登录用户,在导入页可另选。留空则回退到按角色
                  (运营/采购员) 自动兜底。</span
                >
              </div>

              <el-form-item label="产品负责人">
                <el-select
                  v-model="lingxingDefaults.operators"
                  placeholder="选择产品负责人 (可多选)"
                  clearable
                  filterable
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  style="width: 100%"
                >
                  <el-option
                    v-for="name in memberOptions.operators"
                    :key="name"
                    :label="name"
                    :value="name"
                  />
                </el-select>
                <div class="lingxing-sub-hint">
                  多选,导入时用逗号拼接写入 Excel;来源:角色含"运营"
                </div>
              </el-form-item>

              <el-form-item label="采购员">
                <el-select
                  v-model="lingxingDefaults.purchaser"
                  placeholder="选择采购员"
                  clearable
                  filterable
                  style="width: 100%"
                >
                  <el-option
                    v-for="name in memberOptions.purchasers"
                    :key="name"
                    :label="name"
                    :value="name"
                  />
                </el-select>
                <div class="lingxing-sub-hint">
                  单选,来源:角色含"采购员"且未禁用
                </div>
              </el-form-item>

              <el-form-item>
                <el-button
                  v-if="userStore.isAdmin"
                  type="primary"
                  :loading="savingLingxing"
                  @click="saveLingxingDefaults"
                >
                  保存
                </el-button>
                <el-button @click="loadLingxingDefaults">重新加载</el-button>
                <span v-if="!userStore.isAdmin" class="no-permission"
                  >无权限</span
                >
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="备份设置" name="backup">
            <el-form label-width="120px" style="max-width: 800px">
              <!-- 一键备份区域 -->
              <el-form-item>
                <div class="backup-section">
                  <h3>一键备份</h3>

                  <!-- 备份方式选择 -->
                  <div class="backup-method-selection">
                    <el-radio-group v-model="selectedBackupMethod" size="large">
                      <el-radio-button label="local">本地备份</el-radio-button>
                      <el-radio-button label="cos">腾讯云备份</el-radio-button>
                    </el-radio-group>
                  </div>

                  <div class="backup-action">
                    <el-button
                      v-if="userStore.isAdmin"
                      type="primary"
                      size="large"
                      @click="startBackup"
                      :disabled="isBackupRunning"
                    >
                      <el-icon v-if="isBackupRunning"><Loading /></el-icon>
                      {{ isBackupRunning ? "备份中..." : "立即备份" }}
                    </el-button>
                    <span v-else class="no-permission">无权限</span>
                    <span class="backup-tip"
                      >点击按钮开始全量备份，备份过程可能需要几分钟</span
                    >
                  </div>

                  <!-- 备份进度显示 -->
                  <div class="backup-progress" v-if="isBackupRunning">
                    <el-progress
                      :percentage="backupProgress"
                      :status="backupStatus"
                      :stroke-width="20"
                      style="margin: 20px 0"
                    >
                      <template #default>
                        <span>{{ backupProgress }}%</span>
                      </template>
                    </el-progress>
                    <div class="backup-progress-text">
                      {{ backupProgressText }}
                    </div>
                  </div>

                  <!-- 备份结果显示 -->
                  <el-alert
                    v-if="backupResult"
                    :title="backupResult.title"
                    :message="backupResult.message"
                    :type="backupResult.type"
                    show-icon
                    style="margin: 20px 0"
                  />
                </div>
              </el-form-item>

              <!-- 备份配置区域 -->
              <el-form-item>
                <div class="backup-section">
                  <h3>备份配置</h3>
                  <div class="backup-config">
                    <el-descriptions :column="2" border>
                      <el-descriptions-item label="备份类型"
                        >全量备份</el-descriptions-item
                      >
                      <el-descriptions-item label="备份数据库">{{
                        currentDatabase
                      }}</el-descriptions-item>
                      <el-descriptions-item label="当前环境">{{
                        currentEnvironment === "production"
                          ? "生产环境"
                          : "开发环境"
                      }}</el-descriptions-item>
                      <el-descriptions-item label="备份保留"
                        >3天</el-descriptions-item
                      >
                      <el-descriptions-item label="本地备份路径">{{
                        localBackupPath
                      }}</el-descriptions-item>
                      <el-descriptions-item label="腾讯云备份路径">{{
                        cosBackupPath
                      }}</el-descriptions-item>
                      <el-descriptions-item label="自动备份"
                        >每天凌晨2:30</el-descriptions-item
                      >
                      <el-descriptions-item label="当前选择">
                        <el-tag
                          :type="
                            selectedBackupMethod === 'local'
                              ? 'primary'
                              : 'success'
                          "
                        >
                          {{
                            selectedBackupMethod === "local"
                              ? "本地备份"
                              : "腾讯云备份"
                          }}
                        </el-tag>
                      </el-descriptions-item>
                    </el-descriptions>
                  </div>
                </div>
              </el-form-item>

              <!-- 最近备份记录 -->
              <el-form-item>
                <div class="backup-section">
                  <h3>最近备份记录</h3>
                  <el-table :data="recentBackups" style="width: 100%" border>
                    <el-table-column prop="id" label="ID" width="80" />
                    <el-table-column prop="name" label="备份名称" width="200" />
                    <el-table-column prop="type" label="备份类型" width="100" />
                    <el-table-column prop="size" label="文件大小" width="100" />
                    <el-table-column prop="status" label="状态" width="100">
                      <template #default="scope">
                        <el-tag
                          :type="
                            scope.row.status === 'success'
                              ? 'success'
                              : 'danger'
                          "
                          size="small"
                        >
                          {{ scope.row.status }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column
                      prop="storageLocation"
                      label="存储位置"
                      width="120"
                    >
                      <template #default="scope">
                        <el-tag
                          :type="
                            scope.row.storageLocation === 'local'
                              ? 'primary'
                              : 'success'
                          "
                          size="small"
                        >
                          {{
                            scope.row.storageLocation === "local"
                              ? "本地"
                              : "腾讯云COS"
                          }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column
                      prop="createdAt"
                      label="创建时间"
                      width="180"
                    />
                    <el-table-column label="操作" width="120">
                      <template #default="scope">
                        <el-button
                          v-if="userStore.isAdmin"
                          type="primary"
                          size="small"
                          text
                          @click="handleDownload(scope.row)"
                        >
                          下载
                        </el-button>
                        <el-button
                          v-if="userStore.isAdmin"
                          type="danger"
                          size="small"
                          text
                          @click="handleDelete(scope.row.id)"
                        >
                          删除
                        </el-button>
                        <span v-else class="no-permission">无权限</span>
                      </template>
                    </el-table-column>
                  </el-table>

                  <div v-if="recentBackups.length === 0" class="no-backups">
                    <el-empty description="暂无备份记录" />
                  </div>
                </div>
              </el-form-item>

              <!-- 过期备份记录 -->
              <el-form-item>
                <div class="backup-section">
                  <h3>过期备份</h3>
                  <div class="expired-backup-header">
                    <span class="expired-backup-tip"
                      >显示超过3天的备份记录，可手动删除以释放存储空间</span
                    >
                    <el-button
                      v-if="userStore.isAdmin"
                      type="primary"
                      size="small"
                      @click="fetchExpiredBackups"
                    >
                      <el-icon><Refresh /></el-icon>
                      刷新
                    </el-button>
                  </div>
                  <el-table
                    v-loading="isLoadingExpiredBackups"
                    :data="expiredBackups"
                    style="width: 100%"
                    border
                  >
                    <el-table-column prop="id" label="ID" width="80" />
                    <el-table-column prop="name" label="备份名称" width="200" />
                    <el-table-column prop="type" label="备份类型" width="100" />
                    <el-table-column prop="size" label="文件大小" width="100" />
                    <el-table-column prop="status" label="状态" width="100">
                      <template #default="scope">
                        <el-tag
                          :type="
                            scope.row.status === 'success'
                              ? 'success'
                              : 'danger'
                          "
                          size="small"
                        >
                          {{ scope.row.status }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column
                      prop="storageLocation"
                      label="存储位置"
                      width="120"
                    >
                      <template #default="scope">
                        <el-tag
                          :type="
                            scope.row.storageLocation === 'local'
                              ? 'primary'
                              : 'success'
                          "
                          size="small"
                        >
                          {{
                            scope.row.storageLocation === "local"
                              ? "本地"
                              : "腾讯云COS"
                          }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column
                      prop="createdAt"
                      label="创建时间"
                      width="180"
                    />
                    <el-table-column label="操作" width="80">
                      <template #default="scope">
                        <el-button
                          v-if="userStore.isAdmin"
                          type="danger"
                          size="small"
                          text
                          @click="handleDelete(scope.row.id)"
                        >
                          删除
                        </el-button>
                        <span v-else class="no-permission">无权限</span>
                      </template>
                    </el-table-column>
                  </el-table>

                  <div
                    v-if="
                      !isLoadingExpiredBackups && expiredBackups.length === 0
                    "
                    class="no-backups"
                  >
                    <el-empty description="暂无过期备份记录" />
                  </div>
                </div>
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </SkeletonWrapper>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "Settings" });
import { ref, reactive, computed, onMounted, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { InfoFilled, Refresh, Loading } from "@element-plus/icons-vue";
import { systemConfigApi } from "@/api/systemConfig";
import type { LingxingDefaultsResponse } from "@/api/systemConfig";
import { fetchMembers } from "@/api/members";
import { useUserStore } from "@/stores/user";

interface ImageSettings {
  maxImageSize: number;
  productCardWidth: number | string;
  productCardHeight: number | string;
}

interface GeneralSettings {
  carriers: string[];
}

interface BackupRecord {
  id: number;
  name: string;
  type: string;
  size: number;
  status: "success" | "failed" | "running";
  createdAt: string;
  storageLocation: "local" | "cos";
}

interface BackupResult {
  title: string;
  message: string;
  type: "success" | "warning" | "error" | "info";
}

const activeTab = ref<string>("image");

// 用户状态管理
const userStore = useUserStore();

// 备份方式选择
const selectedBackupMethod = ref<"local" | "cos">("local");

// 备份路径
const currentEnvironment = import.meta.env.VITE_ENVIRONMENT;
const currentDatabase =
  currentEnvironment === "production" ? "生产数据库" : "开发数据库";
const localBackupPath = computed(() => {
  return `${currentEnvironment}/database/database_backup/backup`;
});
const cosBackupPath = computed(() => {
  const bucketName =
    currentEnvironment === "production" ? "sijuelishi" : "sijuelishi_dev";
  return `cos://${bucketName}/database_backups/`;
});

const imageSettings = reactive<ImageSettings>({
  maxImageSize: 10,
  productCardWidth: 200,
  productCardHeight: 200,
});

const generalSettings = reactive<GeneralSettings>({
  carriers: [],
});

const sellerspriteForm = reactive({
  apiUrl: "",
  secretKeyMasked: "",
  newSecretKey: "",
  maxPerMinute: 0,
  maxPerMonth: 0,
  maxAsinsPerRequest: 0,
});
const savingSellersprite = ref(false);

// 领星导入默认人选
const lingxingDefaults = reactive<LingxingDefaultsResponse>({
  developer: "",
  operators: [],
  purchaser: "",
});
const memberOptions = reactive<{
  developers: string[];
  operators: string[];
  purchasers: string[];
}>({
  developers: [],
  operators: [],
  purchasers: [],
});
const savingLingxing = ref(false);

// 骨架屏加载状态
const loading = ref(true);
const hasLoaded = ref(false);
const refreshing = ref(false);

// 新载体输入框
const newCarrier = ref<string>("");

// 产品卡片大小设置相关变量
const cardSizePreset = ref<string>("200x200");
const customCardWidth = ref<number>(200);
const customCardHeight = ref<number>(200);

const currentCardWidth = computed(() => {
  if (cardSizePreset.value === "custom") {
    return customCardWidth.value;
  }
  const [width] = cardSizePreset.value.split("x").map(Number);
  return width;
});

const currentCardHeight = computed(() => {
  if (cardSizePreset.value === "custom") {
    return customCardHeight.value;
  }
  const [, height] = cardSizePreset.value.split("x").map(Number);
  return height;
});

// 页面选择
const selectedPages = ref<string[]>(["material-library"]);

// 更新自定义卡片大小
const updateCustomCardSize = () => {
  // placeholder for future validation
};

// 监听预设值变化
watch(
  cardSizePreset,
  (newPreset) => {
    if (newPreset !== "custom") {
      const [width, height] = newPreset.split("x").map(Number);
      imageSettings.productCardWidth = width;
      imageSettings.productCardHeight = height;
    }
  },
  { immediate: true },
);

// 备份相关状态
const isBackupRunning = ref<boolean>(false);
const backupProgress = ref<number>(0);
const backupStatus = ref<"success" | "exception" | "warning" | "">("");
const backupProgressText = ref<string>("");
const backupResult = ref<BackupResult | null>(null);

// 最近备份记录
const recentBackups = ref<BackupRecord[]>([]);

// 过期备份记录
const expiredBackups = ref<BackupRecord[]>([]);
const isLoadingExpiredBackups = ref<boolean>(false);

const saveImageSettings = async (): Promise<void> => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以修改系统设置");
    return;
  }
  try {
    const settingsToSave = {
      ...imageSettings,
    };
    if (cardSizePreset.value === "custom") {
      settingsToSave.productCardWidth = customCardWidth.value;
      settingsToSave.productCardHeight = customCardHeight.value;
    }
    await systemConfigApi.updateImageSettings(settingsToSave);
    ElMessage.success("图片设置保存成功");
  } catch (error) {
    console.error("保存图片设置失败:", error);
    ElMessage.error("保存图片设置失败");
  }
};

// 添加载体
const addCarrier = (): void => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以修改系统设置");
    return;
  }
  if (newCarrier.value.trim()) {
    const carrier = newCarrier.value.trim();
    if (!generalSettings.carriers.includes(carrier)) {
      generalSettings.carriers.push(carrier);
    }
    newCarrier.value = "";
  }
};

// 删除载体
const removeCarrier = (index: number): void => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以修改系统设置");
    return;
  }
  generalSettings.carriers.splice(index, 1);
};

// 保存通用设置（开发人列表已统一到用户管理，这里只保存载体）
const saveGeneralSettings = async (): Promise<void> => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以修改系统设置");
    return;
  }
  try {
    const carriers = generalSettings.carriers.filter((carrier) =>
      carrier.trim(),
    );
    await systemConfigApi.updateCarrierList(carriers);
    generalSettings.carriers = carriers;
    ElMessage.success("通用设置保存成功");
  } catch (error) {
    console.error("保存通用设置失败:", error);
    ElMessage.error("保存失败，请重试");
  }
};

// 开始备份
const startBackup = async (): Promise<void> => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以执行备份操作");
    return;
  }
  try {
    isBackupRunning.value = true;
    backupProgress.value = 0;
    backupStatus.value = "";
    backupProgressText.value = "准备备份...";
    backupResult.value = null;
    const response = await systemConfigApi.startBackup(
      selectedBackupMethod.value,
    );
    backupProgress.value = 100;
    backupStatus.value = "success";
    backupProgressText.value = "备份完成！";
    const backupLocation =
      response.data.storageLocation === "local" ? "本地" : "腾讯云COS";
    backupResult.value = {
      title: "备份成功",
      message: `数据库全量备份已完成，备份文件已保存到${backupLocation}`,
      type: "success",
    };
    await fetchRecentBackups();
    ElMessage.success("备份成功");
  } catch (error: any) {
    console.error("备份失败:", error);
    backupProgress.value = 100;
    backupStatus.value = "exception";
    backupProgressText.value = "备份失败！";
    let errorMessage = "数据库备份过程中发生错误，请查看日志或重试";
    if (error.response) {
      if (error.response.status === 403) {
        errorMessage = "您没有权限执行备份操作";
      } else {
        errorMessage = error.response.data?.message || errorMessage;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    backupResult.value = {
      title: "备份失败",
      message: errorMessage,
      type: "error",
    };
    ElMessage.error(`备份失败: ${errorMessage}`);
  } finally {
    isBackupRunning.value = false;
  }
};

// 获取最近备份记录
const fetchRecentBackups = async (): Promise<void> => {
  try {
    const response = await systemConfigApi.getBackupRecords();
    if (response.code === 200 && response.data) {
      recentBackups.value = response.data.records;
    }
  } catch (error: any) {
    console.error("获取最近备份记录失败:", error);
    let errorMessage = "获取备份记录失败";
    if (error.response) {
      if (error.response.status === 403) {
        errorMessage = "您没有权限访问备份记录";
      } else {
        errorMessage = error.response.data?.message || errorMessage;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    ElMessage.error(errorMessage);
  }
};

// 处理下载备份文件
const handleDownload = async (backup: BackupRecord): Promise<void> => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以下载备份文件");
    return;
  }
  try {
    const response = await systemConfigApi.downloadBackup(backup.id);
    if (response.code === 200 && response.data?.url) {
      window.open(response.data.url, "_blank");
      ElMessage.success(`正在下载备份文件 ${backup.name}`);
    } else {
      throw new Error("获取下载URL失败");
    }
  } catch (error: any) {
    console.error("下载备份文件失败:", error);
    let errorMessage = "下载失败，请重试";
    if (error.response) {
      if (error.response.status === 403) {
        errorMessage = "您没有权限下载备份文件";
      } else {
        errorMessage = error.response.data?.message || errorMessage;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    ElMessage.error(errorMessage);
  }
};

// 处理删除备份记录
const handleDelete = async (backupId: number): Promise<void> => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以删除备份记录");
    return;
  }
  try {
    ElMessageBox.confirm("确定要删除这条备份记录吗？", "删除确认", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    })
      .then(async () => {
        try {
          await systemConfigApi.deleteBackup(backupId);
          await Promise.all([fetchRecentBackups(), fetchExpiredBackups()]);
          ElMessage.success("备份记录删除成功");
        } catch (error: any) {
          console.error("删除备份记录失败:", error);
          let errorMessage = "删除失败，请重试";
          if (error.response) {
            if (error.response.status === 403) {
              errorMessage = "您没有权限删除备份记录";
            } else {
              errorMessage = error.response.data?.message || errorMessage;
            }
          } else if (error.message) {
            errorMessage = error.message;
          }
          ElMessage.error(errorMessage);
        }
      })
      .catch(() => {
        // 取消删除
      });
  } catch (error) {
    console.error("删除备份记录失败:", error);
    ElMessage.error("删除失败，请重试");
  }
};

// 获取过期备份记录
const fetchExpiredBackups = async (): Promise<void> => {
  if (!userStore.isAdmin) {
    return;
  }
  try {
    isLoadingExpiredBackups.value = true;
    const response = await systemConfigApi.getExpiredBackups();
    if (response.code === 200 && response.data) {
      expiredBackups.value = response.data.records;
    }
  } catch (error: any) {
    console.error("获取过期备份记录失败:", error);
    let errorMessage = "获取过期备份记录失败";
    if (error.response) {
      if (error.response.status === 403) {
        errorMessage = "您没有权限访问过期备份记录";
      } else {
        errorMessage = error.response.data?.message || errorMessage;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    ElMessage.error(errorMessage);
  } finally {
    isLoadingExpiredBackups.value = false;
  }
};

// 从后端加载载体列表
const loadCarrierList = async (): Promise<void> => {
  try {
    const response = await systemConfigApi.getCarrierList();
    if (response.code === 200 && response.data) {
      generalSettings.carriers = response.data.carrierList;
    }
  } catch (error) {
    console.error("加载载体列表失败:", error);
    ElMessage.error("加载载体列表失败");
  }
};

// 加载图片设置
const loadImageSettings = async (): Promise<void> => {
  try {
    const response = await systemConfigApi.getImageSettings();
    if (response.data) {
      imageSettings.maxImageSize = response.data.maxImageSize;
      imageSettings.productCardWidth = response.data.productCardWidth || 200;
      imageSettings.productCardHeight = response.data.productCardHeight || 200;
      const width = imageSettings.productCardWidth as number;
      const height = imageSettings.productCardHeight as number;
      const presetValue = `${width}x${height}`;
      const presets = ["150x150", "200x200", "250x250", "300x300"];
      if (presets.includes(presetValue)) {
        cardSizePreset.value = presetValue;
      } else {
        cardSizePreset.value = "custom";
        customCardWidth.value = width;
        customCardHeight.value = height;
      }
    }
  } catch (error) {
    console.error("加载图片设置失败:", error);
  }
};

const loadSellerspriteConfig = async (): Promise<void> => {
  try {
    const response = await systemConfigApi.getSellerspriteConfig();
    if (response.code === 200 && response.data) {
      sellerspriteForm.apiUrl = response.data.apiUrl;
      sellerspriteForm.secretKeyMasked = response.data.secretKeyMasked;
      sellerspriteForm.maxPerMinute = response.data.maxPerMinute;
      sellerspriteForm.maxPerMonth = response.data.maxPerMonth;
      sellerspriteForm.maxAsinsPerRequest = response.data.maxAsinsPerRequest;
    }
  } catch (error) {
    console.error("加载卖家精灵配置失败:", error);
  }
};

const saveSellerspriteConfig = async (): Promise<void> => {
  savingSellersprite.value = true;
  try {
    const data: any = {
      maxPerMinute: sellerspriteForm.maxPerMinute,
      maxPerMonth: sellerspriteForm.maxPerMonth,
      maxAsinsPerRequest: sellerspriteForm.maxAsinsPerRequest,
    };
    const newKey = sellerspriteForm.newSecretKey.trim();
    if (newKey) {
      data.secretKey = newKey;
    }
    const response = await systemConfigApi.updateSellerspriteConfig(data);
    if (response.code === 200 && response.data) {
      sellerspriteForm.secretKeyMasked = response.data.secretKeyMasked;
      sellerspriteForm.maxPerMinute = response.data.maxPerMinute;
      sellerspriteForm.maxPerMonth = response.data.maxPerMonth;
      sellerspriteForm.maxAsinsPerRequest = response.data.maxAsinsPerRequest;
      sellerspriteForm.newSecretKey = "";
      ElMessage.success("卖家精灵配置已更新");
    } else {
      ElMessage.error(response.message || "更新失败");
    }
  } catch (error) {
    console.error("更新卖家精灵配置失败:", error);
    ElMessage.error("更新失败，请检查网络连接");
  } finally {
    savingSellersprite.value = false;
  }
};

// 加载 users 表按角色分组的候选人员,供 3 个下拉使用
const loadMemberOptions = async (): Promise<void> => {
  try {
    console.log('[Settings] 开始加载人员名单...');
    const members = await fetchMembers();
    console.log('[Settings] 人员名单响应:', members);
    memberOptions.developers = members.developers || [];
    memberOptions.operators = members.operators || [];
    memberOptions.purchasers = members.purchasers || [];
    console.log('[Settings] 运营人员数量:', memberOptions.operators.length);
    console.log('[Settings] 运营人员列表:', memberOptions.operators);
  } catch (error) {
    console.error("加载人员名单失败:", error);
  }
};

// 加载已保存的领星导入默认人选
const loadLingxingDefaults = async (): Promise<void> => {
  try {
    const response = await systemConfigApi.getLingxingDefaults();
    if (response.code === 200 && response.data) {
      lingxingDefaults.developer = response.data.developer || "";
      lingxingDefaults.operators = response.data.operators || [];
      lingxingDefaults.purchaser = response.data.purchaser || "";
    }
  } catch (error) {
    console.error("加载领星导入默认人选失败:", error);
  }
};

const saveLingxingDefaults = async (): Promise<void> => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以修改系统设置");
    return;
  }
  savingLingxing.value = true;
  try {
    const response = await systemConfigApi.updateLingxingDefaults({
      developer: lingxingDefaults.developer || "",
      operators: lingxingDefaults.operators || [],
      purchaser: lingxingDefaults.purchaser || "",
    });
    if (response.code === 200 && response.data) {
      lingxingDefaults.developer = response.data.developer || "";
      lingxingDefaults.operators = response.data.operators || [];
      lingxingDefaults.purchaser = response.data.purchaser || "";
      ElMessage.success("领星导入默认人选已更新");
    } else {
      ElMessage.error(response.message || "更新失败");
    }
  } catch (error) {
    console.error("更新领星导入默认人选失败:", error);
    ElMessage.error("更新失败,请检查网络连接");
  } finally {
    savingLingxing.value = false;
  }
};

onMounted(async () => {
  try {
    await Promise.all([
      loadCarrierList(),
      loadImageSettings(),
      loadSellerspriteConfig(),
      loadMemberOptions(),
      loadLingxingDefaults(),
      fetchRecentBackups(),
      fetchExpiredBackups(),
    ]);
  } catch (error) {
    console.error("Settings组件初始化失败:", error);
  } finally {
    loading.value = false;
    hasLoaded.value = true;
  }
});
</script>

<style scoped>
.card-size-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-size-control {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.card-size-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.page-selection {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-selection span {
  font-size: 14px;
  color: #606266;
}

.custom-size-input {
  margin-top: 8px;
}

.size-inputs {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.size-input-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-size-preview {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.preview-label {
  font-size: 14px;
  color: #606266;
}

.preview-card {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.preview-content {
  font-size: 12px;
  color: #909399;
  text-align: center;
}

.preview-size {
  font-size: 10px;
  color: #c0c4cc;
  margin-top: 4px;
}

.card-size-hint {
  margin-top: 8px;
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #909399;
  gap: 4px;
}
</style>

<style scoped lang="scss">
.settings {
  padding: 20px;
}

/* 图片大小提示样式 */
.image-size-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  background-color: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 4px;
  font-size: 14px;
  color: #409eff;

  :deep(.el-icon) {
    font-size: 16px;
  }
}

/* 横向排列容器样式 */
.settings-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.settings-col {
  flex: 1;
  min-width: 400px;
}

.carrier-list-container {
  .carrier-tags {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
    margin-bottom: 15px;
    padding: 8px;
    background-color: #f5f7fa;
    border-radius: 8px;
    min-height: 40px;
    align-items: center;
  }

  .add-carrier {
    display: flex;
    gap: 10px;

    :deep(.el-input) {
      flex: 1;
    }
  }
}

/* 备份设置样式 */
.backup-section {
  margin-bottom: 30px;

  h3 {
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 15px;
    color: #303133;
    border-bottom: 1px solid #ebeef5;
    padding-bottom: 8px;
  }
}

.backup-action {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;

  .backup-tip {
    color: #909399;
    font-size: 14px;
  }
}

.backup-progress {
  margin: 20px 0;

  .backup-progress-text {
    text-align: center;
    color: #606266;
    font-size: 14px;
  }
}

.backup-config {
  margin: 15px 0;
}

.no-backups {
  margin: 20px 0;
  text-align: center;
}

/* 美化备份表格 */
:deep(.el-table) {
  margin-top: 15px;

  .el-table__header-wrapper {
    .el-table__header {
      th {
        background-color: #fafafa;
        font-weight: bold;
      }
    }
  }

  .el-table__body-wrapper {
    .el-table__row {
      &:hover {
        background-color: #f5f7fa;
      }
    }
  }
}

/* 美化进度条 */
:deep(.el-progress) {
  .el-progress-bar {
    .el-progress-bar__outer {
      background-color: #f0f2f5;
      border-radius: 10px;
    }

    .el-progress-bar__inner {
      border-radius: 10px;
      background-color: #409eff;
    }
  }
}

/* 美化备份按钮 */
:deep(.el-button--primary) {
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

/* 美化备份结果提示 */
:deep(.el-alert) {
  margin: 20px 0;
  border-radius: 8px;
}

/* 备份方式选择样式 */
.backup-method-selection {
  margin: 15px 0;

  :deep(.el-radio-group) {
    display: flex;
    gap: 10px;

    .el-radio-button {
      margin-right: 0;

      &.is-active {
        .el-radio-button__inner {
          background-color: #409eff;
          border-color: #409eff;
        }
      }
    }
  }
}

/* 过期备份样式 */
.expired-backup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.expired-backup-tip {
  color: #909399;
  font-size: 14px;
}

.expired-backup-header .el-button {
  margin-left: 10px;
}

/* 无权限提示样式 */
.no-permission {
  color: #909399;
  font-size: 14px;
  margin-left: 10px;
}

/* 领星导入 tab */
.lingxing-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 20px;
  background-color: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 4px;
  color: #409eff;
  font-size: 13px;
  line-height: 1.6;

  :deep(.el-icon) {
    flex-shrink: 0;
    font-size: 16px;
  }
}

.lingxing-sub-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

/* ====== 暗黑模式 ====== */
:deep(html.dark) {
  .settings {
    background: var(--el-bg-color);
  }

  .image-size-hint {
    background-color: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-8);
    color: var(--el-color-primary);
  }

  .carrier-tags {
    background-color: var(--el-fill-color-lighter);
  }

  .backup-section h3 {
    color: var(--el-text-color-primary);
    border-bottom-color: var(--el-border-color-light);
  }

  .preview-card {
    border-color: var(--el-border-color);
    background-color: var(--el-fill-color-lighter);
  }

  .preview-content {
    color: var(--el-text-color-secondary);
  }

  .preview-size {
    color: var(--el-text-color-placeholder);
  }

  :deep(.el-table__header-wrapper .el-table__header th) {
    background-color: var(--el-fill-color-lighter);
  }

  :deep(.el-table__body-wrapper .el-table__row:hover) {
    background-color: var(--el-fill-color-light);
  }

  :deep(.el-progress .el-progress-bar .el-progress-bar__outer) {
    background-color: var(--el-fill-color);
  }
}
</style>
