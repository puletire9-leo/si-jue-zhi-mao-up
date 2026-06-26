<script setup lang="ts">
/**
 * 灵活合格规则筛选器
 * @description 最多 5 条规则，规则之间 OR（满足任一即合格）；规则内多条件 AND。
 *   每个条件 = 字段(上架天数/重量/销量/BRS排名) + 运算符(≤ < = ≥ >) + 阈值，
 *   并可单独勾选启用/停用。取代写死的 MODE1/MODE2 硬分类，查询期自由配置。
 */
import { ref, watch, computed } from "vue";
import { Plus, Delete, Close } from "@element-plus/icons-vue";
import type { QualifyRule } from "@/api/competitor";

type FieldKey = "listingDays" | "weightG" | "units" | "bsr";
type OpKey = "lt" | "le" | "eq" | "ge" | "gt";

interface ConditionRow {
  field: FieldKey;
  op: OpKey;
  value: number | null;
  enabled: boolean;
}
interface RuleRow {
  conditions: ConditionRow[];
}

const FIELDS: {
  value: FieldKey;
  label: string;
  unit?: string;
  defaultOp: OpKey;
}[] = [
  { value: "listingDays", label: "上架天数", unit: "天", defaultOp: "le" },
  { value: "units", label: "销量", defaultOp: "gt" },
  { value: "bsr", label: "BRS排名", defaultOp: "le" },
  { value: "weightG", label: "重量", unit: "g", defaultOp: "le" },
];
const OPS: { value: OpKey; label: string }[] = [
  { value: "le", label: "≤" },
  { value: "lt", label: "<" },
  { value: "eq", label: "=" },
  { value: "ge", label: "≥" },
  { value: "gt", label: ">" },
];

const MAX_RULES = 5;
const MAX_CONDITIONS = 4;

const props = withDefaults(defineProps<{ modelValue?: QualifyRule[] }>(), {
  modelValue: () => [],
});
const emit = defineEmits<{
  (e: "update:modelValue", rules: QualifyRule[]): void;
  (e: "apply", rules: QualifyRule[]): void;
}>();

function fieldMeta(field: FieldKey) {
  return FIELDS.find((f) => f.value === field) ?? FIELDS[1];
}
function newCondition(field: FieldKey = "units"): ConditionRow {
  return { field, op: fieldMeta(field).defaultOp, value: null, enabled: true };
}
function newRule(): RuleRow {
  return { conditions: [newCondition()] };
}

function toRows(rules: QualifyRule[]): RuleRow[] {
  if (!rules || rules.length === 0) return [newRule()];
  return rules.map((r) => ({
    conditions:
      r.conditions && r.conditions.length
        ? r.conditions.map((c) => ({
            field: (c.field as FieldKey) ?? "units",
            op: (c.op as OpKey) ?? "gt",
            value: c.value ?? null,
            enabled: true,
          }))
        : [newCondition()],
  }));
}

/** 清洗：仅保留启用且有值的条件、非空规则 */
function clean(rs: RuleRow[]): QualifyRule[] {
  return rs
    .map((r) => ({
      conditions: r.conditions
        .filter((c) => c.enabled && c.value != null)
        .map((c) => ({ field: c.field, op: c.op, value: c.value as number })),
    }))
    .filter((r) => r.conditions.length > 0);
}

const rules = ref<RuleRow[]>(toRows(props.modelValue));

watch(
  () => props.modelValue,
  (v) => {
    if (JSON.stringify(clean(rules.value)) !== JSON.stringify(v ?? [])) {
      rules.value = toRows(v ?? []);
    }
  },
);

const activeCount = computed(() => clean(rules.value).length);

function onFieldChange(cond: ConditionRow) {
  cond.op = fieldMeta(cond.field).defaultOp;
}
function addCondition(rule: RuleRow) {
  if (rule.conditions.length >= MAX_CONDITIONS) return;
  const used = new Set(rule.conditions.map((c) => c.field));
  const next = FIELDS.find((f) => !used.has(f.value))?.value ?? "units";
  rule.conditions.push(newCondition(next));
}
function removeCondition(rule: RuleRow, i: number) {
  rule.conditions.splice(i, 1);
  if (rule.conditions.length === 0) rule.conditions.push(newCondition());
}
function addRule() {
  if (rules.value.length >= MAX_RULES) return;
  rules.value.push(newRule());
}
function removeRule(i: number) {
  rules.value.splice(i, 1);
  if (rules.value.length === 0) rules.value.push(newRule());
}
function apply() {
  const cleaned = clean(rules.value);
  emit("update:modelValue", cleaned);
  emit("apply", cleaned);
}
function reset() {
  rules.value = [newRule()];
  emit("update:modelValue", []);
  emit("apply", []);
}
</script>

<template>
  <div class="qrf">
    <div class="qrf__head">
      <span class="qrf__title">合格规则</span>
      <span class="qrf__sub">满足任一规则即合格</span>
      <span v-if="activeCount" class="qrf__count"
        >{{ activeCount }} 条生效</span
      >
    </div>

    <div class="qrf__rules">
      <template v-for="(rule, ri) in rules" :key="ri">
        <div v-if="ri > 0" class="qrf__or"><span>或</span></div>

        <div class="qrf__rule">
          <div class="qrf__rule-bar">
            <span class="qrf__rule-no">规则 {{ ri + 1 }}</span>
            <button
              v-if="rules.length > 1"
              class="qrf__icon-btn qrf__rule-del"
              title="删除规则"
              @click="removeRule(ri)"
            >
              <el-icon><Close /></el-icon>
            </button>
          </div>

          <div class="qrf__conds">
            <div
              v-for="(cond, ci) in rule.conditions"
              :key="ci"
              class="qrf__cond"
              :class="{ 'is-off': !cond.enabled }"
            >
              <span v-if="ci > 0" class="qrf__and">且</span>
              <el-checkbox
                v-model="cond.enabled"
                class="qrf__chk"
                title="启用 / 停用此条件"
              />
              <el-select
                v-model="cond.field"
                class="qrf__field"
                size="small"
                @change="onFieldChange(cond)"
              >
                <el-option
                  v-for="f in FIELDS"
                  :key="f.value"
                  :label="f.label"
                  :value="f.value"
                />
              </el-select>
              <el-select v-model="cond.op" class="qrf__op" size="small">
                <el-option
                  v-for="o in OPS"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
              <el-input-number
                v-model="cond.value"
                :min="0"
                :controls="false"
                :value-on-clear="null"
                placeholder="数值"
                class="qrf__val"
                size="small"
              />
              <span v-if="fieldMeta(cond.field).unit" class="qrf__unit">{{
                fieldMeta(cond.field).unit
              }}</span>
              <button
                v-if="rule.conditions.length > 1"
                class="qrf__icon-btn qrf__cond-del"
                title="删除条件"
                @click="removeCondition(rule, ci)"
              >
                <el-icon><Delete /></el-icon>
              </button>
            </div>

            <button
              v-if="rule.conditions.length < MAX_CONDITIONS"
              class="qrf__add qrf__add-cond"
              @click="addCondition(rule)"
            >
              <el-icon><Plus /></el-icon> 添加条件（且）
            </button>
          </div>
        </div>
      </template>
    </div>

    <div class="qrf__foot">
      <button
        class="qrf__add qrf__add-rule"
        :disabled="rules.length >= MAX_RULES"
        @click="addRule"
      >
        <el-icon><Plus /></el-icon> 添加规则（或）<span
          v-if="rules.length >= MAX_RULES"
          class="qrf__limit"
          >· 上限 {{ MAX_RULES }}</span
        >
      </button>
      <div class="qrf__foot-actions">
        <el-button size="small" text @click="reset">重置</el-button>
        <el-button size="small" type="primary" @click="apply"
          >应用筛选</el-button
        >
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables.scss" as *;

.qrf {
  background: $bg-body;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  padding: $space-md $space-lg $space-lg;
}

.qrf__head {
  display: flex;
  align-items: baseline;
  gap: $space-sm;
  margin-bottom: $space-md;

  .qrf__title {
    font-weight: $font-weight-semibold;
    font-size: $font-size-sm;
    color: $text-primary;
    letter-spacing: 0.01em;
  }
  .qrf__sub {
    font-size: $font-size-xs;
    color: $text-tertiary;
  }
  .qrf__count {
    margin-left: auto;
    font-size: $font-size-xs;
    font-family: $font-family-mono;
    color: $primary-color;
    background: rgba($primary-color, 0.08);
    border: 1px solid rgba($primary-color, 0.18);
    border-radius: $radius-full;
    padding: 1px $space-sm;
  }
}

.qrf__rules {
  display: flex;
  flex-direction: column;
}

/* OR 连接器：规则之间的关系，签名元素 */
.qrf__or {
  display: flex;
  align-items: center;
  gap: $space-md;
  padding: $space-xs 0;

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(
      to right,
      transparent,
      rgba($primary-color, 0.35),
      transparent
    );
  }
  span {
    flex: 0 0 auto;
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;
    letter-spacing: 0.14em;
    color: $primary-color;
    background: $bg-color;
    border: 1px solid rgba($primary-color, 0.3);
    border-radius: $radius-full;
    padding: 2px $space-md;
  }
}

.qrf__rule {
  background: $bg-color;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  padding: $space-sm $space-md $space-md;
  transition:
    border-color $transition-fast,
    box-shadow $transition-fast;

  &:hover {
    border-color: $border-hover;
    box-shadow: $shadow-sm;
  }
}

.qrf__rule-bar {
  display: flex;
  align-items: center;
  margin-bottom: $space-sm;

  .qrf__rule-no {
    font-size: 11px;
    font-weight: $font-weight-bold;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $primary-color;
  }
  .qrf__rule-del {
    margin-left: auto;
  }
}

.qrf__conds {
  display: flex;
  flex-direction: column;
  gap: $space-sm;
}

.qrf__cond {
  display: flex;
  align-items: center;
  gap: $space-sm;
  transition: opacity $transition-fast;

  &.is-off {
    opacity: 0.42;
  }

  .qrf__and {
    flex: 0 0 auto;
    font-size: 11px;
    color: $text-tertiary;
    margin-right: -2px;
  }
  .qrf__field {
    width: 104px;
  }
  .qrf__op {
    width: 60px;
  }
  .qrf__val {
    width: 86px;
  }
  .qrf__unit {
    font-size: $font-size-xs;
    color: $text-secondary;
    margin-left: -2px;
  }
  .qrf__cond-del {
    margin-left: auto;
  }
}

/* 等宽字体让阈值与运算符更有“数据”质感 */
:deep(.qrf__val .el-input__inner) {
  text-align: left;
  font-family: $font-family-mono;
}
:deep(.qrf__op .el-select__placeholder),
:deep(.qrf__op .el-select__selected-item) {
  font-family: $font-family-mono;
  font-weight: $font-weight-semibold;
}

.qrf__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: $text-tertiary;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    color: $danger-color;
    background: rgba($danger-color, 0.08);
  }
}

.qrf__add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  margin-top: $space-xs;
  padding: 3px $space-sm;
  font-size: $font-size-xs;
  color: $primary-color;
  background: transparent;
  border: 1px dashed rgba($primary-color, 0.35);
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover:not(:disabled) {
    background: rgba($primary-color, 0.06);
    border-color: $primary-color;
  }
  &:disabled {
    color: $text-disabled;
    border-color: $border-color;
    cursor: not-allowed;
  }
  .qrf__limit {
    color: $text-tertiary;
  }
}

.qrf__foot {
  display: flex;
  align-items: center;
  gap: $space-md;
  margin-top: $space-md;
  padding-top: $space-md;
  border-top: 1px solid $border-color;

  .qrf__add-rule {
    margin-top: 0;
  }
  .qrf__foot-actions {
    margin-left: auto;
    display: flex;
    gap: $space-xs;
  }
}
</style>
