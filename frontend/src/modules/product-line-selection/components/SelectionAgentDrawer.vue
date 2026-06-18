<template>
  <el-drawer
    v-model="visibleProxy"
    :title="`AI 选品助手 — ${nodeName || ''}`"
    direction="rtl"
    size="480px"
    :before-close="handleClose"
  >
    <div class="agent-drawer">
      <div class="agent-header">
        <p class="agent-desc">
          AI 正在分析 <strong>{{ nodeName }}</strong> 的选品模型。
          点击下方按钮开始，或直接提问。
        </p>
        <el-button
          type="primary"
          :loading="loading"
          :disabled="!nodeId || loading"
          @click="startAnalysis"
        >
          {{ loading ? "分析中…" : "分析这个品线" }}
        </el-button>
      </div>

      <div class="agent-messages" ref="msgContainer">
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

      <div class="agent-input">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="2"
          placeholder="追问选品细节…"
          :disabled="loading"
          @keyup.ctrl.enter="sendMessage"
        />
        <el-button
          type="primary"
          :disabled="!inputText.trim() || loading"
          @click="sendMessage"
        >
          发送
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from "vue";
import { chatStream } from "@/api/selectionAgent";
import type { AgentMessage, AgentChatResponse } from "@/api/selectionAgent";
import type { QualifyRule } from "@/api/competitor";
import { useProductLineSelectionStore } from "../store";

const props = defineProps<{
  visible: boolean;
  nodeId: number | null;
  nodeName: string;
  marketplace: string;
}>();

const emit = defineEmits<{
  (e: "update:visible", val: boolean): void;
  (e: "apply-filter-rules", rules: QualifyRule[]): void;
}>();

const store = useProductLineSelectionStore();

// el-drawer の v-model 用プロキシ（prop は writable でないため computed 経由で emit）
const visibleProxy = computed({
  get: () => props.visible,
  set: (val: boolean) => emit("update:visible", val),
});

const loading = ref(false);
const inputText = ref("");
const messages = ref<AgentMessage[]>([]);
const msgContainer = ref<HTMLElement | null>(null);

function handleClose() {
  emit("update:visible", false);
}

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

async function startAnalysis() {
  if (!props.nodeId) return;
  loading.value = true;

  messages.value = [];
  scrollToBottom();

  let fullContent = "";

  await chatStream(
    {
      nodeId: props.nodeId,
      marketplace: props.marketplace,
      messages: [
        {
          role: "user",
          content: `分析品线 ${props.nodeName}（node_id: ${props.nodeId}）的选品模型，产出模型报告和自动筛选规则。`,
        },
      ],
    },
    (delta: string) => {
      fullContent += delta;
      if (
        messages.value.length === 0 ||
        messages.value[messages.value.length - 1].role !== "assistant"
      ) {
        messages.value.push({ role: "assistant", content: "" });
      }
      messages.value[messages.value.length - 1].content = fullContent;
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

function sendMessage() {
  const text = inputText.value.trim();
  if (!text || loading.value) return;

  messages.value.push({ role: "user", content: text });
  inputText.value = "";
  scrollToBottom();

  loading.value = true;
  let fullContent = "";

  void chatStream(
    {
      nodeId: props.nodeId!,
      marketplace: props.marketplace,
      messages: messages.value.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    },
    (delta: string) => {
      fullContent += delta;
      if (
        messages.value.length === 0 ||
        messages.value[messages.value.length - 1].role !== "assistant"
      ) {
        messages.value.push({ role: "assistant", content: "" });
      }
      messages.value[messages.value.length - 1].content = fullContent;
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

function applyRules(rules: QualifyRule[]) {
  emit("apply-filter-rules", rules);
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      messages.value = [];
      inputText.value = "";
      scrollToBottom();
    }
  },
);
</script>

<style scoped>
.agent-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.agent-header {
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 12px;
}

.agent-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 12px;
  line-height: 1.5;
}

.agent-messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.msg {
  display: flex;
  gap: 8px;
  max-width: 90%;
}

.msg.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.msg.assistant {
  align-self: flex-start;
}

.msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.msg-bubble {
  background: #f3f4f6;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #1f2937;
}

.msg.user .msg-bubble {
  background: #b45309;
  color: white;
}

.msg-content code {
  background: rgba(0, 0, 0, 0.08);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}

.msg.user .msg-content code {
  background: rgba(255, 255, 255, 0.2);
}

.msg-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.typing .dot {
  animation: blink 1.4s infinite both;
  font-size: 24px;
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

.agent-input {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
  align-items: flex-end;
}

.agent-input .el-input {
  flex: 1;
}
</style>
