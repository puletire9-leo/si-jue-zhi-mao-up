<template>
	<el-dialog v-model="visible" title="提示" width="520px" align-center @closed="emit('closed')">
		<div style="padding: 8px 0; line-height: 1.6; font-size: 14px; color: #606266">
			这个图需任务生成时间不足 3 天，建议等待 3 天所有运营决策「做 /
			不做」完成后再生成图需。<br />
			如需提前生成，请确认风险后继续。
		</div>
		<template #footer>
			<el-button @click="onConfirm">确定生成图需</el-button>
			<el-button type="primary" @click="visible = false">返回</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
	modelValue: boolean;
}>();

const emit = defineEmits<{
	(e: "update:modelValue", value: boolean): void;
	(e: "confirm"): void;
	(e: "closed"): void;
}>();

const visible = computed({
	get: () => props.modelValue,
	set: (value: boolean) => emit("update:modelValue", value)
});

function onConfirm() {
	emit("confirm");
	visible.value = false;
}
</script>
