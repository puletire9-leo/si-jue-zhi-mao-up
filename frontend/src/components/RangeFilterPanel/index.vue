<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { QuestionFilled } from "@element-plus/icons-vue";

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

const props = withDefaults(
  defineProps<{
    modelValue?: RangeFilterValue;
    country?: string;
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

const GRADE_OPTIONS = ["S", "A", "B", "C", "D"];

const TOOLTIPS = {
  price: "设置价格区间筛选商品",
  units: "设置月销量区间筛选商品",
  listingDays: "设置上架天数区间筛选商品",
  variantCount: "仅显示变体数量不超过该值的商品",
  bsr: "仅显示BSR排名不超过该值的商品",
  weight: "仅显示重量不超过该值（克）的商品",
  fulfillment: "按配送方式筛选商品，AMZ=亚马逊自营，FBA=亚马逊物流，FBM=自发货",
  grade: "按评分等级筛选商品",
} as const;

const currencySymbol = computed(() => CURRENCY_MAP[props.country] ?? "$");

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
</script>

<template>
  <div class="rfp">
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
          <span class="rfp__preset-label">已选：{{ local.listingPreset }}天内</span>
          <el-tooltip :content="TOOLTIPS.listingDays" placement="top" trigger="hover">
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
          <el-tooltip :content="TOOLTIPS.variantCount" placement="top" trigger="hover">
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
          <el-tooltip :content="TOOLTIPS.weight" placement="top" trigger="hover">
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
          <el-tooltip :content="TOOLTIPS.fulfillment" placement="top" trigger="hover">
            <el-icon class="rfp__tip"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </div>
      <div class="rfp__field">
        <label class="rfp__label">评分等级</label>
        <div class="rfp__single">
          <el-checkbox-group v-model="local.grade" class="rfp__chk-group">
            <el-checkbox
              v-for="g in GRADE_OPTIONS"
              :key="g"
              :label="g"
              :value="g"
            >
              {{ g }}
            </el-checkbox>
          </el-checkbox-group>
          <el-tooltip :content="TOOLTIPS.grade" placement="top" trigger="hover">
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
