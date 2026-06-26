import { defineStore } from "pinia";
import { ref } from "vue";
import type { QualifyRule } from "@/api/competitor";

/**
 * 全局选品 Agent 状态。
 * 悬浮球常驻所有页面，卡片内自选品线对话。
 * pendingRules 用于跨页「套用筛选」：在非品线页套用时暂存，
 * 跳转品线页后由该页消费并灌入 qualifyRules。
 */
export const useSelectionAgentStore = defineStore("selectionAgent", () => {
  const cardVisible = ref(false);
  const pendingRules = ref<QualifyRule[] | null>(null);

  function toggleCard() {
    cardVisible.value = !cardVisible.value;
  }

  function openCard() {
    cardVisible.value = true;
  }

  function closeCard() {
    cardVisible.value = false;
  }

  function setPendingRules(rules: QualifyRule[]) {
    pendingRules.value = rules;
  }

  function consumePendingRules(): QualifyRule[] | null {
    const r = pendingRules.value;
    pendingRules.value = null;
    return r;
  }

  return {
    cardVisible,
    pendingRules,
    toggleCard,
    openCard,
    closeCard,
    setPendingRules,
    consumePendingRules,
  };
});
