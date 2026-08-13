<template>
	<div class="review-float-toolbar-root">
		<ai-chat-float
			v-show="!sidePanelOpen"
			ref="aiChatRef"
			hide-trigger
			:task-key="taskKey"
			:task-id="taskId"
			:reference-library="referenceLibrary"
			@open-change="onAiOpenChange"
		/>
		<listing-common-suffix-panel
			v-model:open="suffixPanelOpen"
			:applied-row-keys="appliedSuffixRowKeys"
			@saved="emit('commonSuffixSaved', $event)"
			@apply-to-title="emit('applySuffixToTitle', $event)"
			@revert-from-title="emit('revertSuffixFromTitle', $event)"
		/>
		<listing-banned-words-panel
			v-model:open="bannedPanelOpen"
			@saved="emit('bannedWordsSaved')"
		/>
		<div class="review-float-toolbar">
			<el-button
				size="small"
				:type="aiPanelOpen && !sidePanelOpen ? 'primary' : 'default'"
				class="review-float-tool-btn"
				@click="toggleAi"
				>AI助手</el-button
			>
			<el-button
				size="small"
				:type="suffixPanelOpen ? 'primary' : 'default'"
				class="review-float-tool-btn"
				@click="toggleSuffixPanel"
				>常用后缀</el-button
			>
			<el-button
				size="small"
				:type="bannedPanelOpen ? 'primary' : 'default'"
				class="review-float-tool-btn"
				@click="toggleBannedPanel"
				>违禁词库</el-button
			>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
// @ts-ignore
import AiChatFloat from "/$/app/components/ai-chat-float.vue";
// @ts-ignore
import ListingBannedWordsPanel from "/$/app/components/listing-banned-words-panel.vue";
// @ts-ignore
import ListingCommonSuffixPanel from "/$/app/components/listing-common-suffix-panel.vue";
import type {
	CommonSuffixApplyPayload,
	CommonSuffixRecord,
	CommonSuffixRevertPayload
} from "../utils/listing-common-suffix-api";

defineProps<{
	taskKey: string;
	taskId?: number;
	referenceLibrary?: Record<string, string>;
	appliedSuffixRowKeys?: string[];
}>();

const emit = defineEmits<{
	bannedWordsSaved: [];
	commonSuffixSaved: [list: CommonSuffixRecord[]];
	applySuffixToTitle: [payload: CommonSuffixApplyPayload];
	revertSuffixFromTitle: [payload: CommonSuffixRevertPayload];
}>();

const aiChatRef = ref<InstanceType<typeof AiChatFloat> | null>(null);
const aiPanelOpen = ref(false);
const suffixPanelOpen = ref(false);
const bannedPanelOpen = ref(false);

const sidePanelOpen = computed(
	() => suffixPanelOpen.value || bannedPanelOpen.value
);

function closeSidePanels() {
	suffixPanelOpen.value = false;
	bannedPanelOpen.value = false;
}

function onAiOpenChange(open: boolean) {
	aiPanelOpen.value = open;
}

function toggleAi() {
	closeSidePanels();
	const next = !aiPanelOpen.value;
	aiChatRef.value?.toggle(next);
}

function toggleSuffixPanel() {
	const next = !suffixPanelOpen.value;
	closeSidePanels();
	suffixPanelOpen.value = next;
	if (next) {
		aiChatRef.value?.toggle(false);
		aiPanelOpen.value = false;
	}
}

function toggleBannedPanel() {
	const next = !bannedPanelOpen.value;
	closeSidePanels();
	bannedPanelOpen.value = next;
	if (next) {
		aiChatRef.value?.toggle(false);
		aiPanelOpen.value = false;
	}
}
</script>

<style scoped lang="scss">
.review-float-toolbar-root {
	position: fixed;
	right: 18px;
	bottom: 86px;
	z-index: 2200;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 10px;
}

.review-float-toolbar {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 8px;
	border-radius: 12px;
	border: 1px solid var(--el-border-color-lighter);
	background: var(--el-bg-color);
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.review-float-tool-btn {
	margin: 0;
	width: 72px;
	padding: 8px 4px;
	font-size: 12px;
	font-weight: 500;
	letter-spacing: 0;
}
</style>
