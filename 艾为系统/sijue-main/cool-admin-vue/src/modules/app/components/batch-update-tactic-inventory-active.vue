<template>
	<el-dropdown trigger="click">
		<el-button :disabled="isTableSelectionEmpty">
			修改补货策略
			<el-icon class="el-icon--right">
				<arrow-down />
			</el-icon>
		</el-button>
		<template #dropdown>
			<el-dropdown-menu>
				<el-dropdown-item @click="updateTacticInventoryActive(1)"> 启用 </el-dropdown-item>
				<el-dropdown-item @click="updateTacticInventoryActive(0)"> 关闭 </el-dropdown-item>
			</el-dropdown-menu>
		</template>
	</el-dropdown>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowDown } from "@element-plus/icons-vue";

const props = defineProps({
	Crud: {
		required: true
	}
});

const isTableSelectionEmpty = computed(() => {
	return props.Crud?.selection.length === 0;
});

async function updateTacticInventoryActive(tactic_inventory_active: number) {
	ElMessageBox.confirm("此操作将批量修改补货策略，无法撤销，是否继续？", "提示", {
		type: "warning"
	}).then(async () => {
		let rows = props.Crud?.selection.map((s) => {
			return {
				id: s.id,
				tactic_inventory_active
			};
		});
		await props.Crud.service.update(rows);
		ElMessage({ message: "更新成功", type: "success" });
		props.Crud?.refresh();
	});
}
</script>

<style scoped lang="scss"></style>
