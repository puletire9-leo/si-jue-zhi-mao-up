<template>
	<div :class="['ai-float-root', { 'is-embedded': hideTrigger }]">
		<transition name="ai-float-pop">
			<div v-if="open" class="ai-panel">
				<div class="ai-panel-head">
					<div>
						<div class="ai-title">AI 对话助手</div>
						<div class="ai-sub">任务级会话，多模型，支持 @ 引用</div>
					</div>
					<el-button link class="ai-close" @click="toggle(false)">收起</el-button>
				</div>

				<div ref="listRef" class="ai-list">
					<div v-for="m in messages" :key="m.id" :class="['ai-msg', `role-${m.role}`]">
						<div class="ai-msg-role">{{ m.role === "user" ? "你" : "AI" }}</div>
						<div v-if="m.role === 'assistant' && m.pending" class="ai-pending">
							思考中...
						</div>
						<div v-if="m.role === 'assistant' && m.thinking" class="ai-thinking">
							<div class="ai-thinking-title">思考中</div>
							<div class="ai-thinking-text">{{ m.thinking }}</div>
						</div>
						<div class="ai-msg-text">{{ m.content }}</div>
					</div>
					<div v-if="!messages.length" class="ai-empty">输入需求开始对话</div>
				</div>

				<div class="ai-input-wrap">
					<div class="ai-toolbar">
						<el-select
							v-model="selectedProvider"
							size="small"
							style="width: 110px"
							:disabled="streaming"
						>
							<el-option label="OpenAI" value="openai" />
							<el-option label="Qwen" value="qwen" />
							<el-option label="Doubao" value="doubao" />
						</el-select>
						<el-input
							v-model="selectedModel"
							size="small"
							:disabled="streaming"
							placeholder="模型名"
						/>
					</div>
					<el-input
						ref="inputRef"
						v-model="input"
						type="textarea"
						:rows="6"
						resize="none"
						class="ai-prompt-input"
						:disabled="streaming"
						placeholder="例如：@bullet3_de 改得更简洁；或 @keywords_en 检查用词"
						@input="onInputChange"
						@keydown.ctrl.enter.prevent="send"
					/>
					<div v-if="mentionVisible" class="mention-menu">
						<div
							v-for="item in mentionCandidates"
							:key="item.key"
							class="mention-item"
							@click="applyMention(item.key)"
						>
							<span class="mention-key">@{{ item.key }}</span>
							<span class="mention-desc">{{ item.desc }}</span>
						</div>
					</div>
					<div class="ai-actions">
						<span class="ai-tip">Ctrl + Enter 发送</span>
						<div>
							<el-button size="small" :disabled="streaming" @click="clearAll"
								>清空</el-button
							>
							<el-button size="small" :disabled="!streaming" @click="stopStream"
								>停止</el-button
							>
							<el-button
								size="small"
								type="primary"
								:loading="streaming"
								@click="send"
								>发送</el-button
							>
						</div>
					</div>
				</div>
			</div>
		</transition>

		<el-button
			v-if="!hideTrigger && !open"
			type="primary"
			class="ai-float-btn"
			round
			@click="toggle(true)"
			>AI</el-button
		>
	</div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { service } from "/@/cool";
import { config } from "/@/config";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useBase } from "/$/base";

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	thinking?: string;
	pending?: boolean;
}

const props = defineProps<{
	taskKey: string;
	taskId?: number;
	referenceLibrary?: Record<string, string>;
	/** 由外部悬浮工具栏控制开关，隐藏默认 AI 按钮 */
	hideTrigger?: boolean;
}>();

const emit = defineEmits<{
	openChange: [open: boolean];
}>();

const open = ref(false);
const input = ref("");
const inputRef = ref<any>(null);
const messages = ref<ChatMessage[]>([]);
const streaming = ref(false);
const listRef = ref<HTMLElement | null>(null);
const sessionId = ref<number>(0);
const selectedProvider = ref<"openai" | "qwen" | "doubao">("openai");
const selectedModel = ref("gpt-5-mini");
const abortRef = ref<AbortController | null>(null);
const mentionVisible = ref(false);
const mentionStart = ref(-1);
const mentionEnd = ref(-1);
const mentionCandidates = ref<
	Array<{
		key: string;
		desc: string;
	}>
>([]);

const mentionDefinitions = [
	{ key: "title_en", desc: "标题（英语）" },
	{ key: "title_de", desc: "标题（德语）" },
	{ key: "bullet1_en", desc: "卖点 1（英语）" },
	{ key: "bullet1_de", desc: "卖点 1（德语）" },
	{ key: "bullet2_en", desc: "卖点 2（英语）" },
	{ key: "bullet2_de", desc: "卖点 2（德语）" },
	{ key: "bullet3_en", desc: "卖点 3（英语）" },
	{ key: "bullet3_de", desc: "卖点 3（德语）" },
	{ key: "bullet4_en", desc: "卖点 4（英语）" },
	{ key: "bullet4_de", desc: "卖点 4（德语）" },
	{ key: "bullet5_en", desc: "卖点 5（英语）" },
	{ key: "bullet5_de", desc: "卖点 5（德语）" },
	{ key: "description_en", desc: "描述（英语）" },
	{ key: "description_de", desc: "描述（德语）" },
	{ key: "keywords_en", desc: "关键词（英语，全量）" },
	{ key: "keywords_de", desc: "关键词（德语，全量）" }
];

const { user } = useBase();
const currentTraceId = ref("");

async function toggle(v: boolean) {
	open.value = v;
	emit("openChange", v);
	if (v) {
		await ensureSession();
		await loadHistory();
	}
	await scrollToBottom();
}

defineExpose({ toggle, open });

async function clearAll() {
	if (!sessionId.value) return;
	await service.request({
		url: "/admin/app/designTask/chat/session/clear",
		method: "POST",
		data: { sessionId: sessionId.value }
	});
	messages.value = [];
}

function stopStream() {
	if (abortRef.value) {
		abortRef.value.abort();
		abortRef.value = null;
	}
	streaming.value = false;
}

function getTextareaEl(): HTMLTextAreaElement | null {
	return (inputRef.value as any)?.textarea || null;
}

function onInputChange() {
	const textarea = getTextareaEl();
	const cursor = textarea?.selectionStart ?? input.value.length;
	const before = input.value.slice(0, cursor);
	const m = before.match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/);
	if (!m) {
		mentionVisible.value = false;
		return;
	}
	const keyword = String(m[1] || "").toLowerCase();
	const matched = mentionDefinitions.filter((x) => x.key.toLowerCase().startsWith(keyword));
	if (!matched.length) {
		mentionVisible.value = false;
		return;
	}
	mentionCandidates.value = matched;
	mentionVisible.value = true;
	mentionStart.value = cursor - keyword.length - 1;
	mentionEnd.value = cursor;
}

function applyMention(key: string) {
	if (mentionStart.value < 0 || mentionEnd.value < 0) return;
	const text = input.value;
	const insert = `@${key} `;
	input.value = text.slice(0, mentionStart.value) + insert + text.slice(mentionEnd.value);
	mentionVisible.value = false;
	void nextTick(() => {
		const textarea = getTextareaEl();
		if (!textarea) return;
		const pos = mentionStart.value + insert.length;
		textarea.focus();
		textarea.setSelectionRange(pos, pos);
	});
}

async function ensureSession() {
	if (sessionId.value) return;
	const res = await service.request({
		url: "/admin/app/designTask/chat/session/getOrCreate",
		method: "POST",
		data: {
			taskId: props.taskId,
			taskKey: props.taskKey,
			module: "listing_ai_copy",
			modelProvider: selectedProvider.value,
			modelName: selectedModel.value
		}
	});
	sessionId.value = Number(res?.session?.id || 0);
	selectedProvider.value = (res?.session?.model_provider || "openai") as
		| "openai"
		| "qwen"
		| "doubao";
	selectedModel.value = String(res?.session?.model_name || selectedModel.value);
}

async function loadHistory() {
	if (!sessionId.value) return;
	const res = await service.request({
		url: "/admin/app/designTask/chat/session/messages",
		method: "GET",
		params: {
			sessionId: sessionId.value,
			limit: 200
		}
	});
	const list = Array.isArray(res?.list) ? res.list : [];
	messages.value = list
		.filter((x: any) => x.role === "user" || x.role === "assistant")
		.map((x: any) => ({
			id: String(x.id),
			role: x.role,
			content: x.content || ""
		}));
}

async function send() {
	const text = input.value.trim();
	if (!text || streaming.value) return;
	await ensureSession();
	messages.value.push({ id: `u-${Date.now()}`, role: "user", content: text });
	input.value = "";
	await scrollToBottom();

	messages.value.push({ id: `a-${Date.now()}`, role: "assistant", content: "", pending: true });
	const aiMsg = messages.value[messages.value.length - 1];
	streaming.value = true;
	abortRef.value = new AbortController();

	try {
		const applyEvent = (evt: string, payload: any) => {
			if (evt === "thinking_delta") {
				aiMsg.pending = false;
				aiMsg.thinking = (aiMsg.thinking || "") + String(payload?.content || "");
			} else if (evt === "delta") {
				aiMsg.pending = false;
				aiMsg.content += String(payload?.content || "");
			} else if (evt === "error") {
				aiMsg.pending = false;
				throw new Error(String(payload?.message || "AI 返回错误"));
			}
		};

		await fetchEventSource(`${config.baseUrl}/admin/app/designTask/chat/stream`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: user.token || "",
				Accept: "text/event-stream"
			},
			body: JSON.stringify({
				sessionId: sessionId.value,
				taskId: props.taskId,
				taskKey: props.taskKey,
				module: "listing_ai_copy",
				input: text,
				modelProvider: selectedProvider.value,
				modelName: selectedModel.value,
				referenceLibrary: props.referenceLibrary || {}
			}),
			signal: abortRef.value.signal,
			openWhenHidden: true,
			async onopen(res) {
				if (!res.ok) {
					throw new Error(`stream 请求失败: ${res.status}`);
				}
				console.log(
					"[AI_CHAT_SSE_OPEN]",
					JSON.stringify({
						ts: new Date().toISOString(),
						perf: performance.now(),
						status: res.status
					})
				);
			},
			onmessage(msg) {
				if (!msg.data) return;
				try {
					const payload = JSON.parse(msg.data);
					if (msg.event === "start" && payload?.traceId) {
						currentTraceId.value = String(payload.traceId);
					}
					console.log(
						"[AI_CHAT_SSE_IN]",
						JSON.stringify({
							ts: new Date().toISOString(),
							perf: performance.now(),
							traceId: currentTraceId.value || payload?.traceId || "",
							event: msg.event,
							dataLen: String(msg.data || "").length,
							contentLen: String(payload?.content || "").length
						})
					);
					applyEvent(msg.event, payload);
				} catch (e) {
					console.error("sse parse error", e);
				}
				void scrollToBottom();
			},
			onclose() {
				console.log(
					"[AI_CHAT_SSE_CLOSE]",
					JSON.stringify({
						ts: new Date().toISOString(),
						perf: performance.now(),
						traceId: currentTraceId.value || ""
					})
				);
			},
			onerror(err) {
				console.error(
					"[AI_CHAT_SSE_ERR]",
					JSON.stringify({
						ts: new Date().toISOString(),
						perf: performance.now(),
						traceId: currentTraceId.value || "",
						err: String((err as any)?.message || err || "")
					})
				);
				throw err;
			}
		});
	} catch (err: any) {
		aiMsg.pending = false;
		if (!String(err?.message || "").includes("aborted")) {
			aiMsg.content = aiMsg.content || `生成失败：${err?.message || "未知错误"}`;
			ElMessage.error(aiMsg.content);
		}
	} finally {
		streaming.value = false;
		abortRef.value = null;
	}
}

async function scrollToBottom() {
	await nextTick();
	if (!listRef.value) return;
	listRef.value.scrollTop = listRef.value.scrollHeight;
}

onBeforeUnmount(() => {
	stopStream();
});

watch(
	() => [props.taskKey, props.taskId],
	() => {
		sessionId.value = 0;
		messages.value = [];
		mentionVisible.value = false;
	},
	{ deep: true }
);
</script>

<style scoped lang="scss">
.ai-float-root {
	position: fixed;
	right: 18px;
	bottom: 86px;
	z-index: 2200;
}

.ai-float-root.is-embedded {
	position: static;
	right: auto;
	bottom: auto;
	z-index: auto;
}

.ai-panel {
	width: min(680px, calc(100vw - 20px));
	max-height: min(90vh, 880px);
	display: flex;
	flex-direction: column;
	border: 1px solid var(--el-border-color);
	border-radius: 12px;
	background: var(--el-bg-color);
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
	overflow: hidden;
}

.ai-panel-head {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 12px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.ai-title {
	font-size: 14px;
	font-weight: 600;
}

.ai-sub {
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.ai-close {
	font-size: 12px;
}

.ai-list {
	flex: 1;
	min-height: 400px;
	padding: 14px;
	max-height: min(72vh, 680px);
	overflow-y: auto;
	background: var(--el-fill-color-blank);
}

.ai-msg {
	margin-bottom: 8px;
	padding: 8px 10px;
	border-radius: 8px;
}

.ai-msg.role-user {
	background: var(--el-color-primary-light-9);
}

.ai-msg.role-assistant {
	background: var(--el-fill-color-light);
}

.ai-msg-role {
	font-size: 11px;
	font-weight: 600;
	margin-bottom: 4px;
	color: var(--el-text-color-secondary);
}

.ai-msg-text {
	font-size: 13px;
	line-height: 1.5;
	white-space: pre-wrap;
	word-break: break-word;
}

.ai-thinking {
	margin-bottom: 6px;
	padding: 6px 8px;
	border-radius: 6px;
	background: color-mix(in srgb, var(--el-fill-color-light) 80%, #ffffff 20%);
}

.ai-thinking-title {
	font-size: 11px;
	font-weight: 600;
	color: var(--el-text-color-secondary);
	margin-bottom: 2px;
}

.ai-thinking-text {
	font-size: 12px;
	line-height: 1.45;
	color: var(--el-text-color-regular);
	white-space: pre-wrap;
	word-break: break-word;
}

.ai-pending {
	margin-bottom: 6px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.ai-empty {
	font-size: 13px;
	color: var(--el-text-color-secondary);
	padding: 32px 8px;
	min-height: 280px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.ai-input-wrap {
	flex-shrink: 0;
	padding: 12px;
	border-top: 1px solid var(--el-border-color-lighter);
	background: var(--el-bg-color);
}

.ai-prompt-input :deep(textarea) {
	min-height: 160px;
}

.ai-toolbar {
	margin-bottom: 8px;
	display: grid;
	grid-template-columns: 110px 1fr;
	gap: 8px;
}

.ai-actions {
	margin-top: 8px;
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.mention-menu {
	margin-top: 6px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: var(--el-bg-color);
	max-height: 180px;
	overflow-y: auto;
}

.mention-item {
	padding: 6px 10px;
	display: flex;
	align-items: center;
	gap: 8px;
	cursor: pointer;
}

.mention-item:hover {
	background: var(--el-fill-color-light);
}

.mention-key {
	font-size: 12px;
	font-weight: 600;
	color: var(--el-color-primary);
}

.mention-desc {
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.ai-tip {
	font-size: 11px;
	color: var(--el-text-color-secondary);
}

.ai-float-btn {
	box-shadow: 0 8px 20px rgba(64, 158, 255, 0.28);
}

.ai-float-pop-enter-active,
.ai-float-pop-leave-active {
	transition: all 0.2s ease;
}

.ai-float-pop-enter-from,
.ai-float-pop-leave-to {
	opacity: 0;
	transform: translateY(8px);
}
</style>
