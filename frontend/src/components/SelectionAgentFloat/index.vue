<template>
  <!-- 悬浮球：右下角常驻，可拖拽垂直位置 -->
  <div
    class="agent-ball"
    :style="{ top: ballTop + 'px' }"
    :class="{ active: store.cardVisible }"
    @mousedown="startDrag"
    @click="onBallClick"
    title="AI 选品助手"
  >
    🤖
  </div>

  <!-- 对话卡片 -->
  <transition name="agent-pop">
    <div
      v-if="store.cardVisible"
      class="agent-card"
      :style="{ top: cardTop + 'px' }"
    >
      <div class="card-head">
        <span class="card-title">AI 选品助手</span>
        <span class="card-close" @click="store.closeCard()">✕</span>
      </div>

      <!-- 品线选择器 -->
      <div class="card-picker">
        <el-select
          v-model="marketplace"
          size="small"
          style="width: 88px"
          @change="onMarketChange"
        >
          <el-option v-for="m in MARKETS" :key="m" :label="m" :value="m" />
        </el-select>
        <el-select
          v-model="selectedNodeId"
          size="small"
          filterable
          placeholder="选择品线…"
          :loading="treeLoading"
          style="flex: 1"
        >
          <el-option-group
            v-for="grp in lineOptions"
            :key="grp.bsrId"
            :label="grp.name"
          >
            <el-option
              v-for="sc in grp.children"
              :key="sc.nodeId"
              :label="sc.name + ' (' + sc.productCount + ')'"
              :value="sc.nodeId"
            />
          </el-option-group>
        </el-select>
      </div>

      <!-- 消息区 -->
      <div class="card-messages" ref="msgContainer">
        <div v-if="messages.length === 0 && !loading" class="card-empty">
          选一个品线，点「分析这个品线」开始，或直接提问。
        </div>
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="msg"
          :class="msg.role"
        >
          <div class="msg-avatar">{{ msg.role === "user" ? "🧑" : "🤖" }}</div>
          <div class="msg-bubble">
            <div class="msg-content" v-html="renderContent(msg.content)" />
            <div
              v-if="msg.filterRules && msg.filterRules.length > 0"
              class="msg-actions"
            >
              <el-button
                size="small"
                type="primary"
                @click="applyRules(msg.filterRules!)"
              >
                套用 AI 推荐筛选
              </el-button>
            </div>
          </div>
        </div>
        <div v-if="loading" class="msg assistant">
          <div class="msg-avatar">🤖</div>
          <div class="msg-bubble">
            <div class="msg-content typing">
              <span class="dot">.</span><span class="dot">.</span
              ><span class="dot">.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作区 -->
      <div class="card-foot">
        <el-button
          type="primary"
          size="small"
          :loading="loading"
          :disabled="!selectedNodeId || loading"
          @click="startAnalysis"
        >
          {{ loading ? "分析中…" : "分析这个品线" }}
        </el-button>
        <el-input
          v-model="inputText"
          size="small"
          placeholder="追问…"
          :disabled="loading || !selectedNodeId"
          @keyup.enter="sendMessage"
        />
        <el-button
          size="small"
          :disabled="!inputText.trim() || loading"
          @click="sendMessage"
        >
          发送
        </el-button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { chatStream } from "@/api/selectionAgent";
import type { AgentMessage, AgentChatResponse } from "@/api/selectionAgent";
import type { QualifyRule } from "@/api/competitor";
import { getTree } from "@/api/product-line";
import { useSelectionAgentStore } from "@/stores/selectionAgent";
import { useProductLineSelectionStore } from "@/modules/product-line-selection/store";

const MARKETS = ["UK", "US", "DE", "FR", "IT", "ES"];
const PRODUCT_LINE_ROUTE = "module-product-line-selection-ProductLineSelection";

const store = useSelectionAgentStore();
const route = useRoute();
const router = useRouter();

const marketplace = ref("UK");
const selectedNodeId = ref<number | null>(null);
const lineOptions = ref<
  {
    bsrId: string;
    name: string;
    children: { nodeId: number; name: string; productCount: number }[];
  }[]
>([]);
const treeLoading = ref(false);

const loading = ref(false);
const inputText = ref("");
const messages = ref<AgentMessage[]>([]);
const msgContainer = ref<HTMLElement | null>(null);

const selectedNodeName = computed(() => {
  for (const g of lineOptions.value) {
    const hit = g.children.find((c) => c.nodeId === selectedNodeId.value);
    if (hit) return hit.name;
  }
  return "";
});

// ---- 品线树加载（卡片内选品线，自动取最新批次） ----
async function loadTree() {
  treeLoading.value = true;
  try {
    // 品线树跟随批次:不传 batchDates,后端自动取最新批次。
    const res: any = await getTree(marketplace.value);
    const raw = res?.data?.productLines as any[] | undefined;
    lineOptions.value = (raw || []).map((g) => ({
      bsrId: g.bsrId,
      name:
        g.bsrName ||
        g.subCategories?.[0]?.nodeFullPath?.split(":")[0] ||
        g.bsrId,
      children: (g.subCategories || []).map((sc: any) => ({
        nodeId: Number(sc.nodeId),
        name: sc.nodeName,
        productCount: sc.productCount ?? 0,
      })),
    }));
  } catch {
    ElMessage.error("品线列表加载失败");
  } finally {
    treeLoading.value = false;
  }
}

function onMarketChange() {
  selectedNodeId.value = null;
  loadTree();
}

// ---- 悬浮球拖拽 ----
const ballTop = ref(Math.round(window.innerHeight * 0.6));
const cardTop = computed(() =>
  Math.max(12, Math.min(ballTop.value - 480, window.innerHeight - 580)),
);
let dragging = false;
let moved = false;
let startY = 0;
let startTop = 0;

function startDrag(e: MouseEvent) {
  dragging = true;
  moved = false;
  startY = e.clientY;
  startTop = ballTop.value;
  window.addEventListener("mousemove", onDrag);
  window.addEventListener("mouseup", endDrag);
}

function onDrag(e: MouseEvent) {
  if (!dragging) return;
  const dy = e.clientY - startY;
  if (Math.abs(dy) > 4) moved = true;
  ballTop.value = Math.max(
    12,
    Math.min(startTop + dy, window.innerHeight - 64),
  );
}

function endDrag() {
  dragging = false;
  window.removeEventListener("mousemove", onDrag);
  window.removeEventListener("mouseup", endDrag);
}

function onBallClick() {
  if (moved) return; // 拖拽不触发点击
  store.toggleCard();
}

// ---- 对话 ----
function scrollToBottom() {
  nextTick(() => {
    const el = msgContainer.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function renderContent(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function runChat(payloadMessages: AgentMessage[]) {
  loading.value = true;
  let full = "";
  void chatStream(
    {
      nodeId: selectedNodeId.value!,
      marketplace: marketplace.value,
      messages: payloadMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    },
    (delta: string) => {
      full += delta;
      const last = messages.value[messages.value.length - 1];
      if (!last || last.role !== "assistant") {
        messages.value.push({ role: "assistant", content: "" });
      }
      messages.value[messages.value.length - 1].content = full;
      scrollToBottom();
    },
    (result: AgentChatResponse) => {
      if (result.filterRules && result.filterRules.length > 0) {
        messages.value[messages.value.length - 1].filterRules =
          result.filterRules;
      }
      loading.value = false;
      scrollToBottom();
    },
    (err: string) => {
      messages.value.push({ role: "assistant", content: `❌ 错误: ${err}` });
      loading.value = false;
      scrollToBottom();
    },
  );
}

function startAnalysis() {
  if (!selectedNodeId.value) return;
  messages.value = [];
  const seed: AgentMessage = {
    role: "user",
    content: `分析品线 ${selectedNodeName.value}（node_id: ${selectedNodeId.value}）的选品模型，产出模型报告和自动筛选规则。`,
  };
  runChat([seed]);
}

function sendMessage() {
  const text = inputText.value.trim();
  if (!text || loading.value || !selectedNodeId.value) return;
  messages.value.push({ role: "user", content: text });
  inputText.value = "";
  scrollToBottom();
  runChat(messages.value);
}

// ---- 套用筛选（跨页闭环） ----
function applyRules(rules: QualifyRule[]) {
  if (route.name === PRODUCT_LINE_ROUTE) {
    // 已在品线页：直接灌入并筛排
    const plStore = useProductLineSelectionStore();
    plStore.applyAiFilterRules(rules);
    ElMessage.success("已套用 AI 推荐筛选");
  } else {
    // 其他页：暂存规则 + 跳转品线页，由该页消费
    store.setPendingRules(rules);
    router.push({ name: PRODUCT_LINE_ROUTE });
    ElMessage.success("已跳转品线页并套用筛选");
  }
}

onMounted(() => {
  loadTree();
});

onBeforeUnmount(() => {
  window.removeEventListener("mousemove", onDrag);
  window.removeEventListener("mouseup", endDrag);
});

// 卡片打开时若无品线列表则补载
watch(
  () => store.cardVisible,
  (v) => {
    if (v && lineOptions.value.length === 0) loadTree();
  },
);
</script>

<style scoped>
.agent-ball {
  position: fixed;
  right: 24px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #b45309, #d97706);
  color: #fff;
  font-size: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  box-shadow: 0 4px 16px rgba(180, 83, 9, 0.4);
  z-index: 3000;
  user-select: none;
  transition: transform 0.15s;
}
.agent-ball:hover {
  transform: scale(1.08);
}
.agent-ball.active {
  transform: scale(1.05);
}

.agent-card {
  position: fixed;
  right: 88px;
  width: 400px;
  height: 560px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  z-index: 3000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #b45309, #d97706);
  color: #fff;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
}
.card-close {
  cursor: pointer;
  font-size: 14px;
  opacity: 0.85;
}
.card-close:hover {
  opacity: 1;
}

.card-picker {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
}

.card-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card-empty {
  color: #9ca3af;
  font-size: 13px;
  text-align: center;
  margin-top: 40px;
  line-height: 1.6;
}

.msg {
  display: flex;
  gap: 8px;
  max-width: 92%;
}
.msg.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}
.msg.assistant {
  align-self: flex-start;
}
.msg-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}
.msg-bubble {
  background: #f3f4f6;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #1f2937;
  word-break: break-word;
}
.msg.user .msg-bubble {
  background: #b45309;
  color: #fff;
}
.msg-content code {
  background: rgba(0, 0, 0, 0.08);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
.msg-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.typing .dot {
  animation: blink 1.4s infinite both;
  font-size: 22px;
  line-height: 1;
}
.typing .dot:nth-child(2) {
  animation-delay: 0.2s;
}
.typing .dot:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0;
  }
  40% {
    opacity: 1;
  }
}

.card-foot {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 10px 12px;
  border-top: 1px solid #eee;
}
.card-foot .el-input {
  flex: 1;
}

.agent-pop-enter-active,
.agent-pop-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
  transform-origin: bottom right;
}
.agent-pop-enter-from,
.agent-pop-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
