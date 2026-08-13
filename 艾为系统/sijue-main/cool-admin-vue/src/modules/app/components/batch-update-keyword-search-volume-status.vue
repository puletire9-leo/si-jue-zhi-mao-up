<template>
	<el-dropdown trigger="click">
		<el-button :disabled="isTableSelectionEmpty">
			修改关键词搜索量分析状态为
			<el-icon class="el-icon--right">
				<arrow-down />
			</el-icon>
		</el-button>
		<template #dropdown>
			<el-dropdown-menu>
				<el-dropdown-item
					@click="
						updateKeywordSearchVolumeAnalysisStatus(
							appConfig.LISTING_KEYWORD_ANAL_STATUS.CREATED.value
						)
					"
				>
					未查询
				</el-dropdown-item>
				<el-dropdown-item
					@click="
						updateKeywordSearchVolumeAnalysisStatus(
							appConfig.LISTING_KEYWORD_ANAL_STATUS.PENDING.value
						)
					"
				>
					待分析
				</el-dropdown-item>
				<el-dropdown-item
					@click="
						updateKeywordSearchVolumeAnalysisStatus(
							appConfig.LISTING_KEYWORD_ANAL_STATUS.ANALYSED.value
						)
					"
				>
					已分析
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

async function updateKeywordSearchVolumeAnalysisStatus(analysis_status: number) {
	ElMessageBox.confirm("此操作将批量修改状态，无法撤销，是否继续？", "提示", {
		type: "warning"
	}).then(async () => {
		let rows = props.Crud?.selection.map((s) => {
			return {
				id: s.id,
				kw_search_volume_status: analysis_status
			};
		});
		await props.Crud.service.update(rows);
		ElMessage({ message: "更新成功", type: "success" });
		props.Crud?.refresh();
	});
}
</script>

<style scoped lang="scss"></style>
