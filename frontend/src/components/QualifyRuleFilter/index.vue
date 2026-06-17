<script setup lang="ts">
/**
 * 灵活合格规则筛选器
 * @description 最多 5 条规则，规则之间 OR（满足任一即合格）。
 *   每条规则三字段各自可选：上架天数上限 / 月销量下限(严格大于) / BSR 排名上限。
 *   例：[{上架≤30, 销量>30}, {上架≤60, 销量>120}] = 上架30天内卖过30，或上架60天内卖过120。
 *   取代写死的 MODE1/MODE2 硬分类，由用户在查询期自由配置。
 */
import { ref, watch } from "vue";
import { Plus, Delete, Filter, RefreshLeft } from "@element-plus/icons-vue";
import type { QualifyRule } from "@/api/competitor";

const props = withDefaults(
  defineProps<{
    modelValue?: QualifyRule[];
    maxRules?: number;
  }>(),
  {
    modelValue: () => [],
    maxRules: 5,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", rules: QualifyRule[]): void;
  (e: "apply", rules: QualifyRule[]): void;
}>();

interface RuleRow {
  listingDaysMax: number | null;
  unitsMin: number | null;
  bsrMax: number | null;
}

function emptyRow(): RuleRow {
  return { listingDaysMax: null, unitsMin: null, bsrMax: null };
}

function toRows(rules: QualifyRule[]): RuleRow[] {
  if (!rules || rules.length === 0) return [emptyRow()];
  return rules.map((r) => ({
    listingDaysMax: r.listingDaysMax ?? null,
    unitsMin: r.unitsMin ?? null,
    bsrMax: r.bsrMax ?? null,
  }));
}

/** 清洗：丢弃全空行，只保留有值的字段 */
function clean(rs: RuleRow[]): QualifyRule[] {
  return rs
    .map((r) => {
      const rule: QualifyRule = {};
      if (r.listingDaysMax != null) rule.listingDaysMax = r.listingDaysMax;
      if (r.unitsMin != null) rule.unitsMin = r.unitsMin;
      if (r.bsrMax != null) rule.bsrMax = r.bsrMax;
      return rule;
    })
    .filter(
      (r) => r.listingDaysMax != null || r.unitsMin != null || r.bsrMax != null,
    );
}

const rows = ref<RuleRow[]>(toRows(props.modelValue));

// 外部回填（如预设套用）时同步；用清洗结果比对避免回环
watch(
  () => props.modelValue,
  (v) => {
    if (JSON.stringify(clean(rows.value)) !== JSON.stringify(v ?? [])) {
      rows.value = toRows(v ?? []);
    }
  },
);

function addRow() {
  if (rows.value.length >= props.maxRules) return;
  rows.value.push(emptyRow());
}

function removeRow(i: number) {
  rows.value.splice(i, 1);
  if (rows.value.length === 0) rows.value.push(emptyRow());
}

function apply() {
  const cleaned = clean(rows.value);
  emit("update:modelValue", cleaned);
  emit("apply", cleaned);
}

function reset() {
  rows.value = [emptyRow()];
  emit("update:modelValue", []);
  emit("apply", []);
}
</script>

<template>
  <div class="qualify-rule-filter">
    <div class="qrf-header">
      <span class="qrf-title">合格规则</span>
      <span class="qrf-hint">满足任一规则即合格（规则之间 OR）</span>
    </div>

    <div class="qrf-rows">
      <div v-for="(row, i) in rows" :key="i" class="qrf-row">
        <span class="qrf-idx">规则{{ i + 1 }}</span>

        <span class="qrf-field">
          <span class="qrf-label">上架 ≤</span>
          <el-input-number
            v-model="row.listingDaysMax"
            :min="0"
            :controls="false"
            :value-on-clear="null"
            placeholder="不限"
            class="qrf-num"
          />
          <span class="qrf-unit">天</span>
        </span>

        <span class="qrf-and">且</span>

        <span class="qrf-field">
          <span class="qrf-label">销量 &gt;</span>
          <el-input-number
            v-model="row.unitsMin"
            :min="0"
            :controls="false"
            :value-on-clear="null"
            placeholder="不限"
            class="qrf-num"
          />
        </span>

        <span class="qrf-and">且</span>

        <span class="qrf-field">
          <span class="qrf-label">BSR ≤</span>
          <el-input-number
            v-model="row.bsrMax"
            :min="1"
            :controls="false"
            :value-on-clear="null"
            placeholder="不限"
            class="qrf-num qrf-num-wide"
          />
        </span>

        <el-button
          link
          type="danger"
          :icon="Delete"
          class="qrf-del"
          @click="removeRow(i)"
        />
      </div>
    </div>

    <div class="qrf-actions">
      <el-button
        size="small"
        :icon="Plus"
        :disabled="rows.length >= maxRules"
        @click="addRow"
      >
        添加规则{{ rows.length >= maxRules ? `（上限${maxRules}）` : "" }}
      </el-button>
      <el-button size="small" :icon="RefreshLeft" @click="reset"
        >重置</el-button
      >
      <el-button size="small" type="primary" :icon="Filter" @click="apply">
        应用筛选
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.qualify-rule-filter {
  padding: 12px 14px;
  background: var(--el-fill-color-light, #f5f7fa);
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 8px;

  .qrf-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 10px;

    .qrf-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--el-text-color-primary, #303133);
    }
    .qrf-hint {
      font-size: 12px;
      color: var(--el-text-color-secondary, #909399);
    }
  }

  .qrf-rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .qrf-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;

    .qrf-idx {
      flex: 0 0 auto;
      font-size: 12px;
      color: var(--el-text-color-secondary, #909399);
      min-width: 42px;
    }

    .qrf-field {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .qrf-label {
      font-size: 13px;
      color: var(--el-text-color-regular, #606266);
      white-space: nowrap;
    }
    .qrf-unit {
      font-size: 13px;
      color: var(--el-text-color-regular, #606266);
    }
    .qrf-and {
      font-size: 12px;
      color: var(--el-text-color-secondary, #c0c4cc);
    }

    .qrf-num {
      width: 78px;
    }
    .qrf-num-wide {
      width: 96px;
    }

    .qrf-del {
      margin-left: auto;
    }
  }

  .qrf-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
}

// 让无 controls 的数字输入框文本左对齐，观感更像普通输入
:deep(.qrf-num .el-input__inner) {
  text-align: left;
}
</style>
