<template>
  <div class="config-panel">
    <el-card class="config-card" :body-style="{ padding: '15px' }">
      <template #header>
        <div class="config-header" @click="isExpanded = !isExpanded">
          <div class="header-left">
            <el-icon class="expand-icon" :class="{ 'is-expanded': isExpanded }">
              <ArrowDown />
            </el-icon>
            <span class="header-title">固定值配置</span>
            <el-tag size="small" type="info" class="config-count"
              >{{ filledCount }}/{{ totalCount }}</el-tag
            >
          </div>
          <el-button
            v-if="isExpanded"
            type="primary"
            size="small"
            @click.stop="saveConfig"
            :loading="saving"
          >
            保存配置
          </el-button>
        </div>
      </template>

      <el-collapse-transition>
        <div v-show="isExpanded" class="config-content">
          <el-row :gutter="20">
            <!-- 开发人:从 users 表选 -->
            <el-col :span="8">
              <el-form-item :label="configLabels.developer" class="config-item">
                <el-select
                  v-model="config.developer"
                  placeholder="选择开发人"
                  clearable
                  filterable
                  size="small"
                  style="width: 100%"
                >
                  <el-option
                    v-for="name in memberOptions.developers"
                    :key="name"
                    :label="name"
                    :value="name"
                  />
                </el-select>
              </el-form-item>
            </el-col>

            <!-- 产品负责人:多选,逗号拼 -->
            <el-col :span="8">
              <el-form-item
                :label="configLabels.productManager"
                class="config-item"
              >
                <el-select
                  v-model="productManagerList"
                  placeholder="选择产品负责人 (多选)"
                  clearable
                  filterable
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  size="small"
                  style="width: 100%"
                >
                  <el-option
                    v-for="name in memberOptions.operators"
                    :key="name"
                    :label="name"
                    :value="name"
                  />
                </el-select>
              </el-form-item>
            </el-col>

            <!-- 采购员:单选 -->
            <el-col :span="8">
              <el-form-item :label="configLabels.purchaser" class="config-item">
                <el-select
                  v-model="config.purchaser"
                  placeholder="选择采购员"
                  clearable
                  filterable
                  size="small"
                  style="width: 100%"
                >
                  <el-option
                    v-for="name in memberOptions.purchasers"
                    :key="name"
                    :label="name"
                    :value="name"
                  />
                </el-select>
              </el-form-item>
            </el-col>

            <!-- 非人名字段:仍用文本 -->
            <el-col :span="8" v-for="key in nonRosterKeys" :key="key">
              <el-form-item :label="configLabels[key]" class="config-item">
                <el-input
                  v-model="config[key]"
                  :placeholder="`请输入${configLabels[key]}`"
                  size="small"
                  clearable
                />
              </el-form-item>
            </el-col>
          </el-row>

          <el-divider />

          <div class="config-actions">
            <el-button type="danger" size="small" @click="resetConfig"
              >重置默认</el-button
            >
            <el-button type="info" size="small" @click="clearConfig"
              >清空配置</el-button
            >
          </div>
        </div>
      </el-collapse-transition>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { ArrowDown } from "@element-plus/icons-vue";
import { fetchMembers } from "@/api/members";
import { systemConfigApi } from "@/api/systemConfig";

// 配置项标签
const configLabels: Record<string, string> = {
  developer: "开发人",
  productManager: "产品负责人",
  purchaser: "采购员",
  purchaseLeadTime: "采购交期",
  auxiliarySku: "辅料SKU",
  auxiliaryRatioMain: "辅料比例(主料)",
  auxiliaryRatioAux: "辅料比例(辅料)",
};

// 非人名字段(仍用 el-input 编辑)
const nonRosterKeys = [
  "purchaseLeadTime",
  "auxiliarySku",
  "auxiliaryRatioMain",
  "auxiliaryRatioAux",
] as const;

// 默认配置(3 个人名字段优先来自设置页 lingxing-defaults,兜底 users 表)
const defaultConfig = {
  developer: "",
  productManager: "",
  purchaser: "",
  purchaseLeadTime: "7",
  auxiliarySku: "2270356",
  auxiliaryRatioMain: "1",
  auxiliaryRatioAux: "1",
};

// 本地存储键名
const STORAGE_KEY = "lingxing_import_config";

// 响应式数据
const isExpanded = ref(false);
const saving = ref(false);
const config = reactive<Record<string, string>>({ ...defaultConfig });

// 候选人员列表(用于下拉)
const memberOptions = reactive<{
  developers: string[];
  operators: string[];
  purchasers: string[];
}>({
  developers: [],
  operators: [],
  purchasers: [],
});

// 产品负责人 UI 是多选,底层存储仍是逗号字符串,做一次双向映射
const productManagerList = computed<string[]>({
  get() {
    if (!config.productManager) return [];
    return config.productManager
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
  set(list: string[]) {
    config.productManager = (list || [])
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
  },
});

// 计算属性
const totalCount = computed(() => Object.keys(configLabels).length);
const filledCount = computed(() => {
  return Object.entries(config).filter(
    ([_, value]) => value && value.trim() !== "",
  ).length;
});

// 方法
const loadConfig = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(config, parsed);
    }
  } catch (error) {
    console.error("加载配置失败:", error);
  }
};

/**
 * 加载 3 个人名字段的默认值,两级来源:
 *   1. 系统设置 → 领星导入 tab 里配置的默认人选
 *   2. 兜底:users 表按角色 LIKE 匹配 (developers[0] / operators.join / purchasers[0])
 * 只在 config 里对应字段为空时才填,不覆盖用户已在本次会话改过的值。
 */
const loadRosterDefaults = async () => {
  // step 1: 读设置页默认值
  let cfgDeveloper = "";
  let cfgOperators: string[] = [];
  let cfgPurchaser = "";
  try {
    const resp = await systemConfigApi.getLingxingDefaults();
    if (resp.code === 200 && resp.data) {
      cfgDeveloper = resp.data.developer || "";
      cfgOperators = resp.data.operators || [];
      cfgPurchaser = resp.data.purchaser || "";
    }
  } catch (error) {
    console.warn("读取领星导入默认配置失败,回退到 users 表兜底:", error);
  }

  // step 2: users 表兜底(顺便也拉候选下拉)
  try {
    const members = await fetchMembers();
    memberOptions.developers = members.developers || [];
    memberOptions.operators = members.operators || [];
    memberOptions.purchasers = members.purchasers || [];

    defaultConfig.developer =
      cfgDeveloper ||
      (memberOptions.developers.length ? memberOptions.developers[0] : "");
    defaultConfig.productManager =
      cfgOperators.length > 0
        ? cfgOperators.join(",")
        : memberOptions.operators.join(",");
    defaultConfig.purchaser =
      cfgPurchaser ||
      (memberOptions.purchasers.length ? memberOptions.purchasers[0] : "");
  } catch (error) {
    console.error("加载人员名单默认值失败:", error);
    // 仅设置页有值也要用上
    defaultConfig.developer = cfgDeveloper;
    defaultConfig.productManager = cfgOperators.join(",");
    defaultConfig.purchaser = cfgPurchaser;
  }

  // 仅填充用户尚未设置的项
  if (!config.developer) config.developer = defaultConfig.developer;
  if (!config.productManager)
    config.productManager = defaultConfig.productManager;
  if (!config.purchaser) config.purchaser = defaultConfig.purchaser;
};

const saveConfig = () => {
  saving.value = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    ElMessage.success("配置保存成功");
    isExpanded.value = false;
  } catch (error) {
    ElMessage.error("配置保存失败");
    console.error(error);
  } finally {
    saving.value = false;
  }
};

const resetConfig = () => {
  Object.assign(config, defaultConfig);
  ElMessage.success("已重置为默认配置");
};

const clearConfig = () => {
  Object.keys(config).forEach((key) => {
    config[key] = "";
  });
  ElMessage.success("已清空配置");
};

// 获取配置（供父组件使用）
const getConfig = () => {
  return {
    developer: config.developer,
    productManager: config.productManager,
    purchaser: config.purchaser,
    purchaseLeadTime: parseInt(config.purchaseLeadTime) || 7,
    auxiliarySku: config.auxiliarySku,
    auxiliaryRatioMain: parseInt(config.auxiliaryRatioMain) || 1,
    auxiliaryRatioAux: parseInt(config.auxiliaryRatioAux) || 1,
  };
};

// 暴露方法给父组件
defineExpose({
  getConfig,
});

// 生命周期
onMounted(() => {
  loadConfig();
  loadRosterDefaults();
});
</script>

<style scoped lang="scss">
.config-panel {
  margin-bottom: 20px;
}

.config-card {
  .config-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;

      .expand-icon {
        transition: transform 0.3s;

        &.is-expanded {
          transform: rotate(180deg);
        }
      }

      .header-title {
        font-weight: 600;
        font-size: 14px;
      }

      .config-count {
        margin-left: 5px;
      }
    }
  }

  .config-content {
    padding-top: 15px;

    .config-item {
      margin-bottom: 15px;

      :deep(.el-form-item__label) {
        font-size: 12px;
        padding-bottom: 4px;
      }
    }

    .config-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  }
}
</style>
