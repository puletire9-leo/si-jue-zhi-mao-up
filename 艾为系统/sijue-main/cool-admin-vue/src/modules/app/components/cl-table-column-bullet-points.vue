<template>
	<el-popover
		v-if="bullet_points"
		placement="right"
		title="五点描述"
		:width="500"
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
			<div v-html="bullet_points.replace(/\n/g, '<br><br>')"></div>
		</template>
	</el-popover>
	<div v-else>无</div>
</template>

<script setup lang="ts" name="cl-table-column-bullet-points">
import { List } from "@element-plus/icons-vue";

const props = defineProps({
	bullet_points: {
		required: true,
		type: [String, null],
		default: ""
	}
});
</script>

<style scoped lang="scss"></style>
