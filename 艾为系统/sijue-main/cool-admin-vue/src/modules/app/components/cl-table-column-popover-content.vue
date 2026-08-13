<template>
	<el-popover
		v-if="content"
		placement="right"
		:title="props.title"
		:width="props.width"
		trigger="hover"
	>
		<template #reference>
			<el-button plain circle size="default">
				<el-icon>
					<list />
				</el-icon>
			</el-button>
		</template>
		<template #default>
			<template v-if="props.replaceReturnToBr">
				<div
					v-html="content.replace(/\n/g, '<br>'.repeat(props.replacingBrQuantity))"
				></div>
			</template>
			<template v-else> {{ content }}</template>
		</template>
	</el-popover>
	<div v-else>无</div>
</template>

<script setup lang="ts" name="cl-table-column-popover-content">
import { List } from "@element-plus/icons-vue";

const props = defineProps({
	content: {
		required: true,
		type: [String, null],
		default: ""
	},

	title: {
		type: String,
		default: ""
	},

	width: {
		type: Number,
		default: 500
	},

	replaceReturnToBr: {
		type: Boolean,
		default: false
	},

	replacingBrQuantity: {
		type: Number,
		default: 2
	}
});
</script>

<style scoped lang="scss"></style>
