<template>
	<div class="lazy-timeline-root">
		<div class="lazy-timeline-cell">
			<span class="lazy-timeline-cell__time">{{ updatedAt || "—" }}</span>
			<el-button link type="primary" size="small" @click="open">时间线</el-button>
		</div>
		<el-dialog
			v-model="visible"
			:title="dialogTitle"
			width="960px"
			top="6vh"
			align-center
			append-to-body
			class="activity-timeline-dialog"
			destroy-on-close
		>
			<div v-loading="loading" class="activity-timeline-dialog__body">
				<timeline :items="items" relaxed />
			</div>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage } from "element-plus";
import Timeline, { type TimelineItem } from "./timeline.vue";

const props = withDefaults(
	defineProps<{
		updatedAt?: string;
		dialogTitle?: string;
		load: () => Promise<TimelineItem[]>;
	}>(),
	{
		updatedAt: "",
		dialogTitle: "任务时间线"
	}
);

const visible = ref(false);
const loading = ref(false);
const items = ref<TimelineItem[]>([]);

async function open() {
	items.value = [];
	visible.value = true;
	loading.value = true;
	try {
		items.value = await props.load();
	} catch (err: any) {
		ElMessage.error(err?.message || "加载时间线失败");
	} finally {
		loading.value = false;
	}
}
</script>

<style scoped lang="scss">
.lazy-timeline-cell {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 2px;
	line-height: 1.35;
}

.lazy-timeline-cell__time {
	font-size: 13px;
	color: var(--el-text-color-regular);
}

.activity-timeline-dialog__body {
	min-height: 240px;
	max-height: 75vh;
	overflow-y: auto;
	padding: 12px 20px 24px;
}
</style>
