<template>
	<div class="state-chain-lite">
		<el-tag
			v-for="(tag, idx) in tags"
			:key="`${tag.text}-${idx}`"
			size="small"
			:type="tag.type"
			effect="light"
		>
			{{ tag.text }}
		</el-tag>
		<span v-if="!tags || !tags.length" class="empty-text">-</span>
	</div>
</template>

<script setup lang="ts">
export interface StateChainLiteTag {
	text: string;
	type: "success" | "warning" | "danger" | "info";
}

defineProps<{
	tags: StateChainLiteTag[];
}>();
</script>

<style scoped lang="scss">
.state-chain-lite {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	align-items: center;
	min-height: 24px;
}

.empty-text {
	font-size: 12px;
	color: var(--el-text-color-secondary);
}
</style>
