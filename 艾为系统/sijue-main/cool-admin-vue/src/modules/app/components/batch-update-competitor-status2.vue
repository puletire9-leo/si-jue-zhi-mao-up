<template>
	<el-dropdown trigger="click">
		<el-button :disabled="isTableSelectionEmpty">
			修改状态
			<el-icon class="el-icon--right">
				<arrow-down />
			</el-icon>
		</el-button>
		<template #dropdown>
			<el-dropdown-menu>
				<el-dropdown-item @click="updateStatus(1)"> 入库关键词 </el-dropdown-item>
				<el-dropdown-item @click="updateStatus(2)"> 入库竞品 </el-dropdown-item>
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

async function updateStatus(status: number) {
	ElMessageBox.confirm("此操作将批量修改状态，无法撤销，是否继续？", "提示", {
		type: "warning"
	}).then(async () => {
		let rows = "";
		if (status === 1) {
			rows = props.Crud?.selection.map((s: any) => {
				return {
					id: s.id,
					status
					// bsr_rank : 99999999
				};
			});
		} else {
			rows = props.Crud?.selection.map((s: any) => {
				return {
					id: s.id,
					status,
					inventory_status: 1
				};
			});
		}

		await props.Crud.service.update(rows);
		ElMessage({ message: "更新成功", type: "success" });
		props.Crud?.refresh();
	});
}

async function updateStatusLibrary() {
	ElMessageBox.confirm("此操作将批量修改为「已入库」状态，无法撤销，是否继续？", "提示", {
		type: "warning"
	}).then(async () => {
		let rows = props.Crud?.selection;
		await props.Crud.service.batch_update_status_library({ competitors: rows });
		ElMessage({ message: "更新成功", type: "success" });
		props.Crud?.refresh();
	});
}
</script>

<style scoped lang="scss"></style>
