<template>
	<div class="picture-mount-lang-indicators" aria-label="挂载语言需求">
		<span class="picture-mount-lang-item" title="英语">
			<span class="picture-mount-lang-label">英</span>
			<el-icon :size="16" :class="status.en ? 'is-yes' : 'is-no'">
				<CircleCheckFilled v-if="status.en" />
				<CircleCloseFilled v-else />
			</el-icon>
		</span>
		<span class="picture-mount-lang-item" title="德语">
			<span class="picture-mount-lang-label">德</span>
			<el-icon :size="16" :class="status.de ? 'is-yes' : 'is-no'">
				<CircleCheckFilled v-if="status.de" />
				<CircleCloseFilled v-else />
			</el-icon>
		</span>
	</div>
</template>

<script setup lang="ts">
import { CircleCheckFilled, CircleCloseFilled } from "@element-plus/icons-vue";
import type { PictureMountLangStatus } from "/$/app/utils/listing-ai-required-languages";

defineProps<{
	status: PictureMountLangStatus;
}>();
</script>

<style scoped lang="scss">
.picture-mount-lang-indicators {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-top: 8px;
	padding-top: 6px;
	border-top: 1px dashed var(--el-border-color-lighter);
}

.picture-mount-lang-item {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.picture-mount-lang-label {
	font-weight: 600;
	min-width: 14px;
}

.is-yes {
	color: var(--el-color-success);
}

.is-no {
	color: var(--el-color-danger);
}
</style>
