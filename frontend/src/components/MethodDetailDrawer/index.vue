<template>
  <el-drawer
    v-model="visible"
    :title="detail?.title || '方法卡详情'"
    direction="rtl"
    size="560px"
    append-to-body
    :with-header="true"
  >
    <div v-if="detail" class="method-detail">
      <!-- 一句话概述 -->
      <div class="method-detail__hero">
        <div class="method-detail__hero-icon">
          <el-icon><MagicStick /></el-icon>
        </div>
        <p class="method-detail__hero-text">{{ detail.tagline }}</p>
      </div>

      <!-- 核心区:筛选规则 -->
      <section class="method-detail__block method-detail__block--rules">
        <h4 class="method-detail__block-title">
          <el-icon><Aim /></el-icon>
          筛选规则
          <span class="method-detail__block-subtitle">
            该方法怎么把商品从池子里挑出来
          </span>
        </h4>

        <!-- 硬门槛 (一票否决) -->
        <div class="rule-card rule-card--hard">
          <div class="rule-card__header">
            <el-icon><Warning /></el-icon>
            硬门槛
            <el-tag size="small" type="danger" effect="light" round>
              一票否决
            </el-tag>
          </div>
          <ul class="rule-card__criteria">
            <li v-for="c in detail.hardCriteria" :key="c.label">
              <span class="criterion-label">{{ c.label }}</span>
              <span class="criterion-value">{{ c.value }}</span>
              <span v-if="c.note" class="criterion-note">{{ c.note }}</span>
            </li>
          </ul>
        </div>

        <!-- 达标逻辑 -->
        <div class="rule-card rule-card--pass">
          <div class="rule-card__header">
            <el-icon><Select /></el-icon>
            达标逻辑
            <el-tag size="small" type="success" effect="light" round>
              过一个即算
            </el-tag>
          </div>
          <ol class="rule-card__steps">
            <li v-for="(item, i) in detail.passLogic" :key="i">
              <span class="step-index">{{ i + 1 }}</span>
              <span class="step-text">{{ item }}</span>
            </li>
          </ol>
        </div>

        <!-- 参数覆盖: 强制固定 vs 不支持 -->
        <div class="rule-card rule-card--params">
          <div class="rule-card__header">
            <el-icon><Setting /></el-icon>
            方法卡对参数的接管
          </div>
          <div class="params-grid">
            <div class="params-col">
              <div class="params-col__label">
                <el-icon><Lock /></el-icon>
                强制固定 (用户改不动)
              </div>
              <div class="params-col__tags">
                <el-tag
                  v-for="f in detail.forcedFilters"
                  :key="f"
                  size="small"
                  type="info"
                  effect="plain"
                >
                  {{ f }}
                </el-tag>
              </div>
            </div>
            <div class="params-col">
              <div class="params-col__label">
                <el-icon><CircleClose /></el-icon>
                不支持 (选了也会被丢)
              </div>
              <ul class="params-col__list">
                <li v-for="f in detail.unsupportedFilters" :key="f">
                  {{ f }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- 次要区:适用场景 -->
      <section class="method-detail__block">
        <h4 class="method-detail__block-title">
          <el-icon><Notebook /></el-icon>
          适用场景
        </h4>
        <div class="scene-grid">
          <div class="scene-col scene-col--do">
            <div class="scene-col__label">
              <el-icon><CircleCheck /></el-icon>
              适合用它
            </div>
            <ul>
              <li v-for="item in detail.whenToUse" :key="item">{{ item }}</li>
            </ul>
          </div>
          <div class="scene-col scene-col--dont">
            <div class="scene-col__label">
              <el-icon><Close /></el-icon>
              不该用它
            </div>
            <ul>
              <li v-for="item in detail.whenNotToUse" :key="item">
                {{ item }}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 背景区:数据 & 依据 -->
      <section class="method-detail__block">
        <h4 class="method-detail__block-title">
          <el-icon><DataBoard /></el-icon>
          数据 &amp; 依据
        </h4>

        <div class="fact-row">
          <div class="fact-row__label">数据源</div>
          <div class="fact-row__value">
            <code>{{ detail.dataSource }}</code>
          </div>
        </div>
        <div class="fact-row">
          <div class="fact-row__label">产出</div>
          <div class="fact-row__value">{{ detail.output }}</div>
        </div>

        <div class="method-detail__rationale">
          <div class="method-detail__rationale-title">
            <el-icon><InfoFilled /></el-icon>
            为什么这样筛
          </div>
          <ul>
            <li v-for="item in detail.rationale" :key="item">{{ item }}</li>
          </ul>
        </div>
      </section>

      <!-- 底部脚注 -->
      <div v-if="detail.fullDocPath" class="method-detail__footer">
        <el-icon><Files /></el-icon>
        完整方法卡文档:
        <code>{{ detail.fullDocPath }}</code>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  MagicStick,
  Aim,
  Warning,
  Select,
  Setting,
  Lock,
  CircleClose,
  Notebook,
  CircleCheck,
  Close,
  DataBoard,
  InfoFilled,
  Files,
} from "@element-plus/icons-vue";
import {
  METHOD_CARD_INFO,
  type MethodCardInfo,
} from "@/views/AllSelection/composables/methodCardInfo";

interface Props {
  /** v-model 控制显示 */
  modelValue: boolean;
  /** 要展示的方法卡 id */
  methodId: "M01" | "M02" | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const detail = computed<MethodCardInfo | null>(() =>
  props.methodId ? METHOD_CARD_INFO[props.methodId] : null,
);
</script>

<style scoped lang="scss">
.method-detail {
  padding: 4px 4px 24px;
  color: var(--el-text-color-primary);

  // ==================== 一句话概述 ====================
  &__hero {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 24px;
    padding: 14px 16px;
    background: linear-gradient(
      135deg,
      var(--el-color-primary-light-9),
      var(--el-color-primary-light-8)
    );
    border-radius: 8px;
    border-left: 4px solid var(--el-color-primary);
  }

  &__hero-icon {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--el-color-primary);
    color: #fff;
    border-radius: 6px;
    font-size: 16px;
  }

  &__hero-text {
    margin: 0;
    padding-top: 3px;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.6;
    color: var(--el-text-color-primary);
  }

  // ==================== 分区通用 ====================
  &__block {
    margin-bottom: 24px;
  }

  &__block-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--el-border-color-lighter);

    .el-icon {
      color: var(--el-color-primary);
      font-size: 17px;
    }
  }

  &__block-subtitle {
    margin-left: auto;
    font-size: 12px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }

  &__block--rules {
    .rule-card + .rule-card {
      margin-top: 12px;
    }
  }

  // ==================== 规则卡 ====================
  .rule-card {
    padding: 12px 14px;
    border-radius: 6px;
    background: var(--el-fill-color-lighter);

    &__header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);

      .el-icon {
        font-size: 15px;
      }

      .el-tag {
        margin-left: 4px;
        font-size: 11px;
      }
    }

    &__criteria {
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 0;
        font-size: 13px;
        border-bottom: 1px dashed var(--el-border-color-lighter);

        &:last-child {
          border-bottom: none;
        }
      }

      .criterion-label {
        min-width: 68px;
        color: var(--el-text-color-secondary);
      }

      .criterion-value {
        font-weight: 600;
        color: var(--el-color-danger);
        font-family: "SFMono-Regular", Consolas, monospace;
      }

      .criterion-note {
        margin-left: auto;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__steps {
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 6px 0;
        font-size: 13px;
        line-height: 1.6;
      }

      .step-index {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--el-color-success-light-8);
        color: var(--el-color-success);
        border-radius: 50%;
        font-size: 11px;
        font-weight: 600;
      }

      .step-text {
        flex: 1;
        color: var(--el-text-color-regular);
      }
    }

    // 硬门槛卡: 红色警示
    &--hard {
      background: var(--el-color-danger-light-9);
      border-left: 3px solid var(--el-color-danger);

      .rule-card__header .el-icon {
        color: var(--el-color-danger);
      }
    }

    // 达标卡: 绿色
    &--pass {
      background: var(--el-color-success-light-9);
      border-left: 3px solid var(--el-color-success);

      .rule-card__header .el-icon {
        color: var(--el-color-success);
      }
    }

    // 参数覆盖卡: 蓝色
    &--params {
      background: var(--el-color-info-light-9);
      border-left: 3px solid var(--el-color-info);

      .rule-card__header .el-icon {
        color: var(--el-color-info);
      }
    }
  }

  // ==================== 参数覆盖 grid ====================
  .params-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;

    @media (max-width: 500px) {
      grid-template-columns: 1fr;
    }
  }

  .params-col {
    &__label {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-secondary);

      .el-icon {
        font-size: 13px;
      }
    }

    &__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    &__list {
      margin: 0;
      padding-left: 18px;

      li {
        font-size: 12px;
        line-height: 1.6;
        color: var(--el-text-color-secondary);
        text-decoration: line-through;
      }
    }
  }

  // ==================== 场景 grid ====================
  .scene-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;

    @media (max-width: 500px) {
      grid-template-columns: 1fr;
    }
  }

  .scene-col {
    padding: 10px 12px;
    border-radius: 6px;

    &__label {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 600;

      .el-icon {
        font-size: 14px;
      }
    }

    ul {
      margin: 0;
      padding-left: 20px;
    }

    li {
      font-size: 12px;
      line-height: 1.7;
      color: var(--el-text-color-regular);
    }

    &--do {
      background: var(--el-color-success-light-9);

      .scene-col__label {
        color: var(--el-color-success);
      }
    }

    &--dont {
      background: var(--el-fill-color-lighter);

      .scene-col__label {
        color: var(--el-text-color-secondary);
      }

      li {
        color: var(--el-text-color-secondary);
      }
    }
  }

  // ==================== 事实行 (数据源/输出) ====================
  .fact-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 8px 0;
    font-size: 13px;
    line-height: 1.6;
    border-bottom: 1px dashed var(--el-border-color-lighter);

    &:last-of-type {
      border-bottom: none;
    }

    &__label {
      flex-shrink: 0;
      width: 60px;
      color: var(--el-text-color-secondary);
      font-weight: 600;
    }

    &__value {
      flex: 1;
      color: var(--el-text-color-regular);

      code {
        padding: 2px 6px;
        background: var(--el-fill-color);
        border-radius: 3px;
        font-family: "SFMono-Regular", Consolas, monospace;
        font-size: 12px;
        color: var(--el-color-primary);
      }
    }
  }

  &__rationale {
    margin-top: 12px;
    padding: 12px 14px;
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
    border-left: 3px solid var(--el-color-warning);

    &-title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);

      .el-icon {
        color: var(--el-color-warning);
        font-size: 15px;
      }
    }

    ul {
      margin: 0;
      padding-left: 20px;
    }

    li {
      font-size: 12px;
      line-height: 1.7;
      color: var(--el-text-color-regular);
      margin-bottom: 4px;
    }
  }

  // ==================== 底部脚注 ====================
  &__footer {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 20px;
    padding: 10px 12px;
    background: var(--el-fill-color-lighter);
    border-radius: 4px;
    font-size: 11px;
    color: var(--el-text-color-secondary);

    .el-icon {
      color: var(--el-text-color-secondary);
    }

    code {
      padding: 2px 6px;
      background: var(--el-fill-color);
      border-radius: 3px;
      font-family: "SFMono-Regular", Consolas, monospace;
      color: var(--el-text-color-regular);
    }
  }
}
</style>
