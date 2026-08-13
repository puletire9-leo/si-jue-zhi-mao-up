<template>
	<div class="ready-chain">
		<div class="chain-head">
			<el-tag size="small" :type="overallType">{{ overallText }}</el-tag>
		</div>
		<div class="chain-list">
			<div v-for="(step, idx) in steps" :key="step.key" class="chain-step" :class="`is-${step.state}`">
				<div class="chain-step-left">
					<span class="chain-index">{{ idx + 1 }}</span>
					<div class="chain-main">
						<div class="chain-title">{{ step.label }}</div>
						<div class="chain-reason">{{ step.reason }}</div>
					</div>
				</div>
				<div class="chain-step-right">
					<el-tag size="small" :type="stepTagType(step.state)">{{ stepStateText(step.state) }}</el-tag>
					<el-button
						v-if="step.actionLabel"
						text
						type="primary"
						@click="$emit('resolve', step.key)"
					>
						{{ step.actionLabel }}
					</el-button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
export type ReadyChainState = "done" | "blocked" | "todo";

export interface ReadyChainStep {
	key: string;
	label: string;
	state: ReadyChainState;
	reason: string;
	actionLabel?: string;
}

defineProps<{
	steps: ReadyChainStep[];
	overallText: string;
	overallType: "success" | "danger" | "warning";
}>();

defineEmits<{
	resolve: [key: string];
}>();

function stepStateText(s: ReadyChainState): string {
	if (s === "done") return "通过";
	if (s === "blocked") return "阻塞";
	return "待执行";
}

function stepTagType(s: ReadyChainState): "success" | "danger" | "info" {
	if (s === "done") return "success";
	if (s === "blocked") return "danger";
	return "info";
}
</script>

<style scoped lang="scss">
.ready-chain {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.chain-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.chain-step {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 10px;
	padding: 10px 12px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	background: var(--el-fill-color-lighter);
}

.chain-step.is-done {
	background: var(--el-color-success-light-9);
	border-color: var(--el-color-success-light-5);
}

.chain-step.is-blocked {
	background: var(--el-color-danger-light-9);
	border-color: var(--el-color-danger-light-5);
}

.chain-step-left {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	min-width: 0;
}

.chain-index {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: var(--el-fill-color-dark);
	color: #fff;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	flex-shrink: 0;
}

.chain-main {
	min-width: 0;
}

.chain-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--el-text-color-regular);
}

.chain-reason {
	margin-top: 2px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
	word-break: break-word;
}

.chain-step-right {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}
</style>
