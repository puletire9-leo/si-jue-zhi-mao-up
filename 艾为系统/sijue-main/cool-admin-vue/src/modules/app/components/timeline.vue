<template>
	<div
		v-if="items && items.length > 0"
		class="custom-timeline"
		:class="{ 'custom-timeline--relaxed': relaxed, 'custom-timeline--compact': compact }"
	>
		<div v-for="(item, index) in reversedItems" :key="index" class="timeline-item">
			<span class="timeline-content">
				{{ item.content }}
				<span v-if="item.operator" class="timeline-operator"> · {{ item.operator }}</span>
			</span>
			<div class="timeline-dot"></div>
			<span class="timeline-time">{{ item.time }}</span>
		</div>
	</div>
	<span v-else class="no-timeline">暂无时间线</span>
</template>

<script setup lang="ts">
import { computed } from "vue";

export interface TimelineItem {
	time: string;
	content: string;
	operator?: string;
}

interface Props {
	items?: TimelineItem[];
	relaxed?: boolean;
	/** 表格行内等窄区域：限制高度并内部滚动 */
	compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	items: () => [],
	relaxed: false,
	compact: false
});

const reversedItems = computed(() => {
	if (!props.items || props.items.length === 0) return [];
	return [...props.items].reverse();
});
</script>

<style scoped lang="scss">
.custom-timeline {
	padding: 8px 0;
}

.custom-timeline--compact {
	max-height: 110px;
	overflow-y: auto;
}

.timeline-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12px;
	position: relative;
	padding: 0 8px;
}

.timeline-item:last-child {
	margin-bottom: 0;
}

.timeline-content {
	font-size: 13px;
	color: #606266;
	flex: 1;
	text-align: right;
	padding-right: 12px;
	line-height: 1.5;
}

.timeline-operator {
	margin-left: 4px;
	font-size: 12px;
	color: #909399;
	white-space: nowrap;
}

.timeline-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background-color: #c0c4cc;
	flex-shrink: 0;
	position: relative;
	z-index: 1;
}

.timeline-item:not(:last-child)::after {
	content: "";
	position: absolute;
	left: 50%;
	top: 8px;
	transform: translateX(-50%);
	width: 1px;
	height: calc(100% + 4px);
	background-color: #e4e7ed;
	z-index: 0;
}

.timeline-time {
	font-size: 12px;
	color: #909399;
	flex: 1;
	text-align: left;
	padding-left: 12px;
	white-space: nowrap;
}

.no-timeline {
	color: #c0c4cc;
	font-size: 13px;
}

.custom-timeline--relaxed {
	padding: 12px 8px 20px;
}

.custom-timeline--relaxed .timeline-item {
	margin-bottom: 18px;
	min-height: 28px;
}

.custom-timeline--relaxed .timeline-content {
	font-size: 14px;
	line-height: 1.55;
	max-width: 58%;
}

.custom-timeline--relaxed .timeline-time {
	font-size: 13px;
	padding-left: 16px;
	white-space: normal;
	line-height: 1.45;
	min-width: 148px;
}

.custom-timeline--relaxed .timeline-dot {
	width: 10px;
	height: 10px;
}
</style>
