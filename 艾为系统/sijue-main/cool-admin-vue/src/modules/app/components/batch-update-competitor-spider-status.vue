<template>
	<el-dropdown trigger="click">
		<el-button :disabled="isTableSelectionEmpty">
			修改竞品调研状态为
			<el-icon class="el-icon--right">
				<arrow-down />
			</el-icon>
		</el-button>
		<template #dropdown>
			<el-dropdown-menu>
				<el-dropdown-item
					@click="
						updateCompetitorSpiderStatus(
							appConfig.LISTING_COMPETITOR_SPIDER_STATUS.CREATED.value
						)
					"
				>
					待调研
				</el-dropdown-item>
				<el-dropdown-item
					@click="
						updateCompetitorSpiderStatus(
							appConfig.LISTING_COMPETITOR_SPIDER_STATUS.RESEARCHING.value
						)
					"
				>
					调研中
				</el-dropdown-item>
				<el-dropdown-item
					@click="
						updateCompetitorSpiderStatus(
							appConfig.LISTING_COMPETITOR_SPIDER_STATUS.RESEARCHED.value
						)
					"
				>
					已调研
				</el-dropdown-item>
			</el-dropdown-menu>
		</template>
	</el-dropdown>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowDown } from "@element-plus/icons-vue";
import { appConfig } from "../../../../../appConfig";

const props = defineProps({
	Crud: {
		required: true
	}
});

const isTableSelectionEmpty = computed(() => {
	return props.Crud?.selection.length === 0;
});

async function updateCompetitorSpiderStatus(competitor_spider_status: number) {
	ElMessageBox.confirm("此操作将批量修改状态，无法撤销，是否继续？", "提示", {
		type: "warning"
	}).then(async () => {
		let rows = props.Crud?.selection.map((s) => {
			return {
				id: s.id,
				competitor_spider_status
			};
		});
		await props.Crud.service.update(rows);
		ElMessage({ message: "更新成功", type: "success" });
		props.Crud?.refresh();
	});
}
</script>

<style scoped lang="scss"></style>
