<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import { QuestionFilled } from "@element-plus/icons-vue";
import { getCreatedWeeks, getDengZongBatchDates } from "@/api/competitor";
import shopCollectionApi from "@/api/shopCollection";

export interface RangeFilterValue {
  priceMin: number | null;
  priceMax: number | null;
  unitsMin: number | null;
  unitsMax: number | null;
  listingDaysMin: number | null;
  listingDaysMax: number | null;
  bsrMax: number | null;
  weightMax: number | null;
  variantCountMax: number | null;
  fulfillment: string[];
  createdWeeks: string[];
  category: string[];
  grade: string[];
  listingPreset: number | null;
}

export interface RangeSnapshotOption {
  value: string;
  label: string;
  count: number;
  startDate?: string;
  endDate?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue?: RangeFilterValue;
    country?: string;
    /** 来源（如 '新品榜' / '竞品店铺'，与数据库 source 一致），用于把入库批次下拉对齐到查询口径 */
    source?: string;
    snapshotKind?: "competitor_created_week" | "deng_zong_batch" | "shop_batch";
    /** 外部页面提供自己的周期选项时复用本组件，不再请求选品源批次接口。 */
    snapshotOptions?: RangeSnapshotOption[];
    snapshotLabelText?: string;
    snapshotPlaceholderText?: string;
    /** 是否在加载批次列表后自动默认选中最新一项（首次进入时）。默认 true */
    autoSelectLatestWeek?: boolean;
    /** 嵌入抽屉/卡片时为 true：去掉自身灰底边框，与外层风格统一 */
    embedded?: boolean;
  }>(),
  {
    modelValue: () => ({
      priceMin: null,
      priceMax: null,
      unitsMin: null,
      unitsMax: null,
      listingDaysMin: null,
      listingDaysMax: null,
      bsrMax: null,
      weightMax: null,
      variantCountMax: null,
      fulfillment: [],
      createdWeeks: [],
      category: [],
      grade: [],
      listingPreset: null,
    }),
    country: "US",
    source: "",
    snapshotKind: "competitor_created_week",
    embedded: false,
    autoSelectLatestWeek: true,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", val: RangeFilterValue): void;
}>();

const CURRENCY_MAP: Record<string, string> = {
  UK: "£",
  US: "$",
  DE: "€",
};

const FULFILLMENT_OPTIONS: { label: string; value: string }[] = [
  { label: "AMZ", value: "AMZ" },
  { label: "FBA", value: "FBA" },
  { label: "FBM", value: "FBM" },
];

const LISTING_PRESETS = [
  { label: "30天内", value: 30 },
  { label: "60天内", value: 60 },
  { label: "90天内", value: 90 },
  { label: "180天内", value: 180 },
  { label: "360天内", value: 360 },
];

const TOOLTIPS = {
  price: "设置价格区间筛选商品",
  units: "设置月销量区间筛选商品",
  listingDays: "设置上架天数区间筛选商品",
  variantCount: "仅显示变体数量不超过该值的商品",
  bsr: "仅显示 BSR 排名不超过该值的商品",
  weight: "仅显示重量不超过该值（克）的商品",
  fulfillment:
    "按配送方式筛选商品，AMZ=亚马逊自营，FBA=亚马逊物流，FBM=自发货",
} as const;

const currencySymbol = computed(() => CURRENCY_MAP[props.country] ?? "$");
const snapshotLabel = computed(() =>
  props.snapshotLabelText ||
  (props.snapshotKind === "competitor_created_week" ? "入库批次（周）" : "入库批次（批次日）"),
);
const snapshotPlaceholder = computed(() =>
  props.snapshotPlaceholderText ||
  (props.snapshotKind === "competitor_created_week"
    ? "选择周批次（默认最新）"
    : "选择批次日期"),
);

function clone(v: RangeFilterValue): RangeFilterValue {
  return {
    priceMin: v.priceMin ?? null,
    priceMax: v.priceMax ?? null,
    unitsMin: v.unitsMin ?? null,
    unitsMax: v.unitsMax ?? null,
    listingDaysMin: v.listingDaysMin ?? null,
    listingDaysMax: v.listingDaysMax ?? null,
    bsrMax: v.bsrMax ?? null,
    weightMax: v.weightMax ?? null,
    variantCountMax: v.variantCountMax ?? null,
    fulfillment: [...(v.fulfillment ?? [])],
    createdWeeks: [...(v.createdWeeks ?? [])],
    category: [...(v.category ?? [])],
    grade: [...(v.grade ?? [])],
    listingPreset: v.listingPreset ?? null,
  };
}

const local = ref<RangeFilterValue>(clone(props.modelValue));

watch(
  () => props.modelValue,
  (v) => {
    if (JSON.stringify(v) !== JSON.stringify(local.value)) {
      local.value = clone(v);
    }
  },
  { deep: true },
);

watch(
  local,
  (v) => {
    emit("update:modelValue", {
      ...v,
      fulfillment: [...v.fulfillment],
      createdWeeks: [...v.createdWeeks],
      category: [...v.category],
      grade: [...v.grade],
    });
  },
  { deep: true },
);

function handlePresetClick(value: number) {
  if (local.value.listingPreset === value) {
    local.value.listingPreset = null;
    local.value.listingDaysMax = null;
  } else {
    local.value.listingPreset = value;
    local.value.listingDaysMax = value;
    local.value.listingDaysMin = null;
  }
}

function handleFreeClick() {
  local.value.listingPreset = null;
}

function clearListingPreset() {
  local.value.listingPreset = null;
  local.value.listingDaysMax = null;
}

const availableSnapshots = ref<RangeSnapshotOption[]>([]);
// 记录已自动填充过默认最新项的 (country|source|snapshotKind) 组合，
// 避免用户主动清空后又被填回。
const autoFilledKeys = new Set<string>();

/** 把某个日期(YYYY-MM-DD 等)转成 M/D */
function toMd(d?: string): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 批次下拉 label：周批次显示日期范围（如 7/6-7/12），比 ISO 周号（2026-W28）直观；
 * 非标批次日等无起止范围的，退回原 label。统一带条数。
 */
function formatSnapshotLabel(item: {
  label: string;
  count: number;
  startDate?: string;
  endDate?: string;
}): string {
  const start = toMd(item.startDate);
  const end = toMd(item.endDate);
  const range = start && end ? `${start}-${end}` : item.label;
  return `${range}（${item.count}）`;
}

/** 最新一项摘要：日期范围 + 条数，让用户一眼看到最新导入了多少数据 */
const latestWeekSummary = computed(() => {
  const w = availableSnapshots.value[0];
  if (!w) return "";
  return formatSnapshotLabel(w);
});

async function loadAvailableWeeks() {
  if (props.snapshotOptions !== undefined) {
    availableSnapshots.value = props.snapshotOptions.map((item) => ({ ...item }));
  } else if (props.snapshotKind === "deng_zong_batch") {
    const res = await getDengZongBatchDates(props.country);
    availableSnapshots.value = (res?.data ?? []).map((item) => ({
      value: item.batchDate,
      label: item.batchDate,
      count: item.count,
    }));
  } else if (props.snapshotKind === "shop_batch") {
    const rows = await shopCollectionApi.selectionBatches(props.country);
    availableSnapshots.value = rows.map((item) => ({
      value: item.batchDate,
      label: item.batchDate,
      count: item.count,
    }));
  } else {
    const res = await getCreatedWeeks(props.country, props.source || undefined);
    availableSnapshots.value = (res?.data ?? []).map((item) => ({
      value: item.week,
      label: item.week,
      count: item.count,
      startDate: item.startDate,
      endDate: item.endDate,
    }));
  }

  // 默认选中最新一项（列表第一项即最新批次）：仅在开启、当前无已选、
  // 且该 country+source+snapshotKind 组合尚未自动填充过时执行，尊重用户的手动清空。
  if (
    props.autoSelectLatestWeek &&
    availableSnapshots.value.length > 0 &&
    local.value.createdWeeks.length === 0
  ) {
    const key = `${props.country}|${props.source}|${props.snapshotKind}`;
    if (!autoFilledKeys.has(key)) {
      autoFilledKeys.add(key);
      local.value.createdWeeks = [availableSnapshots.value[0].value];
    }
  }
}

onMounted(loadAvailableWeeks);

watch(
  () => [props.country, props.source, props.snapshotKind],
  loadAvailableWeeks,
);

watch(
  () => props.snapshotOptions,
  loadAvailableWeeks,
  { deep: true },
);
</script>

<template>
  <div class="rfp" :class="{ 'rfp--embedded': embedded }">
    <div class="rfp__week-row">
      <div class="rfp__field">
        <label class="rfp__label">
          {{ snapshotLabel }}
          <span v-if="latestWeekSummary" class="rfp__latest-hint">
            最新 {{ latestWeekSummary }}
          </span>
        </label>
        <el-select
          v-model="local.createdWeeks"
          multiple
          collapse-tags
          collapse-tags-tooltip
          :placeholder="snapshotPlaceholder"
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="item in availableSnapshots"
            :key="item.value"
            :label="formatSnapshotLabel(item)"
            :value="item.value"
          />
        </el-select>
      </div>
    </div>

    <div class="rfp__col">
      <div class="rfp__col-title">
        <span class="rfp__dot"></span>
        价格
      </div>
      <div class="rfp__field">
        <label class="rfp__label">价格区间</label>
        <div class="rfp__range">
          <span class="rfp__num-wrap">
            <el-input-number
              v-model="local.priceMin"
              :min="0"
              :value-on-clear="null"
              controls-position="right"
              class="rfp__num"
              placeholder="下限"
            />
            <span class="rfp__suffix">{{ currencySymbol }}</span>
          </span>
          <span class="rfp__sep">~</span>
          <span class="rfp__num-wrap">
            <el-input-number
              v-model="local.priceMax"
              :min="0"
              :value-on-clear="null"
              controls-position="right"
              class="rfp__num"
              placeholder="上限"
            />
            <span class="rfp__suffix">{{ currencySymbol }}</span>
          </span>
          <el-tooltip :content="TOOLTIPS.price" placement="top" trigger="hover">
            <el-icon class="rfp__tip"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </div>
    </div>

    <div class="rfp__col">
      <div class="rfp__col-title">
        <span class="rfp__dot"></span>
        销量与上架
      </div>
      <div class="rfp__field">
        <label class="rfp__label">月销量</label>
        <div class="rfp__range">
          <el-input-number
            v-model="local.unitsMin"
            :min="0"
            :value-on-clear="null"
            controls-position="right"
            class="rfp__num"
            placeholder="下限"
          />
          <span class="rfp__sep">~</span>
          <el-input-number
            v-model="local.unitsMax"
            :min="0"
            :value-on-clear="null"
            controls-position="right"
            class="rfp__num"
            placeholder="上限"
          />
          <el-tooltip :content="TOOLTIPS.units" placement="top" trigger="hover">
            <el-icon class="rfp__tip"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </div>
      <div class="rfp__field">
        <label class="rfp__label">上架天数</label>
        <div class="rfp__presets" v-if="local.listingPreset == null">
          <el-button
            v-for="p in LISTING_PRESETS"
            :key="p.value"
            size="small"
            @click="handlePresetClick(p.value)"
          >
            {{ p.label }}
          </el-button>
          <el-button size="small" type="primary" @click="handleFreeClick">
            自定义
          </el-button>
        </div>
        <div class="rfp__range" v-else>
          <el-button size="small" @click="clearListingPreset">清除</el-button>
          <span class="rfp__preset-label"
            >已选：{{ local.listingPreset }}天内</span
          >
          <el-tooltip
            :content="TOOLTIPS.listingDays"
            placement="top"
            trigger="hover"
          >
            <el-icon class="rfp__tip"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
        <div class="rfp__range" v-if="local.listingPreset == null">
          <el-input-number
            v-model="local.listingDaysMin"
            :min="0"
            :value-on-clear="null"
            controls-position="right"
            class="rfp__num"
            placeholder="下限"
          />
          <span class="rfp__sep">~</span>
          <el-input-number
            v-model="local.listingDaysMax"
            :min="0"
            :value-on-clear="null"
            controls-position="right"
            class="rfp__num"
            placeholder="上限"
          />
        </div>
      </div>
    </div>

    <div class="rfp__col">
      <div class="rfp__col-title">
        <span class="rfp__dot"></span>
        其他筛选
      </div>
      <div class="rfp__field">
        <label class="rfp__label">变体数上限</label>
        <div class="rfp__single">
          <el-input-number
            v-model="local.variantCountMax"
            :min="0"
            :value-on-clear="null"
            controls-position="right"
            class="rfp__num--single"
            placeholder="不限"
          />
          <el-tooltip
            :content="TOOLTIPS.variantCount"
            placement="top"
            trigger="hover"
          >
            <el-icon class="rfp__tip"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </div>
      <div class="rfp__field">
        <label class="rfp__label">BSR 上限</label>
        <div class="rfp__single">
          <el-input-number
            v-model="local.bsrMax"
            :min="0"
            :value-on-clear="null"
            controls-position="right"
            class="rfp__num--single"
            placeholder="不限"
          />
          <el-tooltip :content="TOOLTIPS.bsr" placement="top" trigger="hover">
            <el-icon class="rfp__tip"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </div>
      <div class="rfp__field">
        <label class="rfp__label">重量上限</label>
        <div class="rfp__single">
          <span class="rfp__num-wrap">
            <el-input-number
              v-model="local.weightMax"
              :min="0"
              :value-on-clear="null"
              controls-position="right"
              class="rfp__num--single"
              placeholder="不限"
            />
            <span class="rfp__suffix">g</span>
          </span>
          <el-tooltip
            :content="TOOLTIPS.weight"
            placement="top"
            trigger="hover"
          >
            <el-icon class="rfp__tip"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </div>
      <div class="rfp__field">
        <label class="rfp__label">配送方式</label>
        <div class="rfp__single">
          <el-checkbox-group v-model="local.fulfillment" class="rfp__chk-group">
            <el-checkbox
              v-for="opt in FULFILLMENT_OPTIONS"
              :key="opt.value"
              :label="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </el-checkbox>
          </el-checkbox-group>
          <el-tooltip
            :content="TOOLTIPS.fulfillment"
            placement="top"
            trigger="hover"
          >
            <el-icon class="rfp__tip"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables.scss" as *;

.rfp {
  display: flex;
  flex-wrap: wrap;
  gap: $space-xl;
  background: $bg-body;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  padding: $space-lg $space-xl;

  @media (max-width: 991px) {
    flex-direction: column;
    gap: $space-lg;
  }
}

.rfp--embedded {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  flex-direction: column;
  gap: $space-lg;
}

.rfp__week-row {
  width: 100%;
  margin-bottom: $space-md;
}

.rfp__col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: $space-lg;
}

.rfp__col-title {
  display: flex;
  align-items: center;
  gap: $space-sm;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $text-primary;
  padding-bottom: $space-sm;
  border-bottom: 1px solid $border-color;
}

.rfp__dot {
  display: inline-flex;
  align-items: center;

  &::before {
    content: "";
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $primary-color;
    flex-shrink: 0;
  }
}

.rfp__field {
  display: flex;
  flex-direction: column;
  gap: $space-xs;
}

.rfp__label {
  font-size: $font-size-xs;
  color: $text-secondary;
  font-weight: $font-weight-medium;
  letter-spacing: 0.02em;
  user-select: none;
}

.rfp__latest-hint {
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: $font-weight-medium;
  color: #409eff;
  background: rgba(64, 158, 255, 0.1);
}

.rfp__range {
  display: flex;
  align-items: center;
  gap: $space-xs;
  flex-wrap: wrap;
}

.rfp__sep {
  color: $text-tertiary;
  font-size: $font-size-sm;
  flex-shrink: 0;
  user-select: none;
}

.rfp__single {
  display: flex;
  align-items: center;
  gap: $space-xs;
}

.rfp__num-wrap {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.rfp__suffix {
  font-size: $font-size-sm;
  color: $text-secondary;
  font-weight: $font-weight-medium;
  user-select: none;
  flex-shrink: 0;
}

.rfp__num {
  width: 120px;
}

.rfp__num--single {
  width: 150px;
}

.rfp__tip {
  font-size: 14px;
  color: $text-tertiary;
  cursor: help;
  flex-shrink: 0;
  transition: color $transition-fast;

  &:hover {
    color: $primary-color;
  }
}

.rfp__chk-group {
  display: flex;
  gap: $space-sm;

  :deep(.el-checkbox) {
    margin-right: 0;
  }
}

.rfp__presets {
  display: flex;
  gap: $space-xs;
  flex-wrap: wrap;
}

.rfp__preset-label {
  font-size: $font-size-sm;
  color: $primary-color;
  font-weight: $font-weight-medium;
}
</style>
