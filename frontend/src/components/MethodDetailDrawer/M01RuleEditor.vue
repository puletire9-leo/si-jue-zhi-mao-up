<template>
  <el-dialog
    v-model="visible"
    title="编辑 M01 达标阈值"
    width="520px"
    append-to-body
    destroy-on-close
    @open="onOpen"
  >
    <div class="m01-editor">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="改动立即影响方法卡列表查询口径；已落库的店铺命中标记(m01_active)不重算。"
        style="margin-bottom: 14px"
      />

      <el-radio-group v-model="marketplace" size="small" @change="loadRule">
        <el-radio-button label="UK">🇬🇧 UK</el-radio-button>
        <el-radio-button label="DE">🇩🇪 DE</el-radio-button>
        <el-radio-button label="US">🇺🇸 US</el-radio-button>
      </el-radio-group>

      <el-form v-loading="loading" :model="form" label-width="130px" class="m01-editor__form">
        <el-form-item label="价格区间">
          <div class="range-row">
            <el-input-number v-model="form.priceMin" :min="0" :precision="2" :step="1" controls-position="right" />
            <span class="dash">—</span>
            <el-input-number v-model="form.priceMax" :min="0" :precision="2" :step="1" controls-position="right" />
          </div>
        </el-form-item>
        <el-form-item label="重量上限(克)">
          <el-input-number v-model="form.weightMax" :min="0" :precision="0" :step="10" controls-position="right" />
        </el-form-item>
        <el-form-item label="上架天数上限">
          <el-input-number v-model="form.listingDaysMax" :min="1" :precision="0" :step="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="30天销量门槛">
          <el-input-number v-model="form.sales30" :min="0" :precision="0" :step="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="60天销量门槛">
          <el-input-number v-model="form.sales60" :min="0" :precision="0" :step="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="90天销量门槛">
          <el-input-number v-model="form.sales90" :min="0" :precision="0" :step="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="销量上限">
          <el-input-number v-model="form.salesMax" :min="0" :precision="0" :step="10" controls-position="right" />
        </el-form-item>
        <el-form-item label="BSR 上限">
          <div class="bsr-row">
            <el-switch v-model="bsrEnabled" active-text="启用" inactive-text="不判定" inline-prompt />
            <el-input-number
              v-if="bsrEnabled"
              v-model="form.bsrMax"
              :min="1"
              :precision="0"
              :step="1000"
              controls-position="right"
            />
            <span v-else class="muted">该站点不使用 BSR 判定（销量门槛决定）</span>
          </div>
        </el-form-item>
      </el-form>

      <p class="m01-editor__logic">
        达标逻辑：价格在区间内 + 重量低于上限 + 上架 &lt; {{ form.listingDaysMax }} 天，
        且已知销量 ≤ {{ form.salesMax }}，并且（分档销量满足任一：≤30天≥{{ form.sales30 }} / ≤60天≥{{ form.sales60 }} / ≤90天≥{{ form.sales90 }}<template v-if="bsrEnabled">，或 BSR &lt; {{ form.bsrMax }}</template>）。
      </p>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { ElMessage } from "element-plus";
import { methodCardsApi, type M01Rule, type M01RuleEditable } from "@/api/methodCards";

interface Props {
  modelValue: boolean;
  /** 初始站点，默认 UK */
  initialMarketplace?: "UK" | "DE" | "US";
}
const props = withDefaults(defineProps<Props>(), { initialMarketplace: "UK" });
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  /** 保存成功后通知父组件（可据此刷新列表） */
  saved: [marketplace: "UK" | "DE" | "US"];
}>();

const visible = ref(props.modelValue);
// 与父组件 v-model 双向同步
import { watch } from "vue";
watch(() => props.modelValue, (v) => (visible.value = v));
watch(visible, (v) => emit("update:modelValue", v));

const marketplace = ref<"UK" | "DE" | "US">(props.initialMarketplace);
const loading = ref(false);
const saving = ref(false);
const bsrEnabled = ref(true);

const form = reactive<M01RuleEditable>({
  priceMin: 0,
  priceMax: 0,
  weightMax: 0,
  listingDaysMax: 90,
  sales30: 0,
  sales60: 0,
  sales90: 0,
  salesMax: 0,
  bsrMax: null,
});

function applyRule(rule: M01Rule) {
  form.priceMin = Number(rule.priceMin);
  form.priceMax = Number(rule.priceMax);
  form.weightMax = Number(rule.weightMax);
  form.listingDaysMax = rule.listingDaysMax;
  form.sales30 = rule.sales30;
  form.sales60 = rule.sales60;
  form.sales90 = rule.sales90;
  form.salesMax = rule.salesMax;
  bsrEnabled.value = rule.bsrMax != null;
  form.bsrMax = rule.bsrMax;
}

async function loadRule() {
  loading.value = true;
  try {
    const res = await methodCardsApi.getM01Rule(marketplace.value);
    if (res.data) applyRule(res.data);
  } catch (e: unknown) {
    ElMessage.error(e instanceof Error ? e.message : "加载 M01 阈值失败");
  } finally {
    loading.value = false;
  }
}

function onOpen() {
  marketplace.value = props.initialMarketplace;
  loadRule();
}

async function save() {
  if (form.priceMin > form.priceMax) {
    ElMessage.warning("价格下限不能大于上限");
    return;
  }
  if (form.salesMax < Math.max(form.sales30, form.sales60, form.sales90)) {
    ElMessage.warning("销量上限不能低于 30/60/90 天销量门槛");
    return;
  }
  saving.value = true;
  try {
    const body: Partial<M01RuleEditable> = {
      priceMin: form.priceMin,
      priceMax: form.priceMax,
      weightMax: form.weightMax,
      listingDaysMax: form.listingDaysMax,
      sales30: form.sales30,
      sales60: form.sales60,
      sales90: form.sales90,
      salesMax: form.salesMax,
      bsrMax: bsrEnabled.value ? form.bsrMax : null,
    };
    await methodCardsApi.updateM01Rule(marketplace.value, body);
    ElMessage.success(`${marketplace.value} 站 M01 阈值已保存`);
    emit("saved", marketplace.value);
    visible.value = false;
  } catch (e: unknown) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped lang="scss">
.m01-editor {
  &__form {
    margin-top: 16px;
  }
  .range-row,
  .bsr-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dash {
    color: var(--el-text-color-secondary);
  }
  .muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
  &__logic {
    margin: 12px 0 0;
    padding: 10px 12px;
    background: var(--el-color-success-light-9);
    border-left: 3px solid var(--el-color-success);
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }
}
</style>
