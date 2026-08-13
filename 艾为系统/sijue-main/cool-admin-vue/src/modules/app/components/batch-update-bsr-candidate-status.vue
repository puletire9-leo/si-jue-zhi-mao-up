<template>
	<el-dropdown trigger="click">
		<el-button :disabled="isTableSelectionEmpty">
			修改 BSR 选品状态为
			<el-icon class="el-icon--right">
				<arrow-down />
			</el-icon>
		</el-button>
		<template #dropdown>
			<el-dropdown-menu>
				<el-dropdown-item
					v-if="!props.hidePendingOption"
					@click="updateBsrCandidateStatus(appConfig.BSR_CANDIDATE_STATUS.PENDING.value)"
				>
					待入库
				</el-dropdown-item>
				<el-dropdown-item
					@click="updateBsrCandidateStatus(appConfig.BSR_CANDIDATE_STATUS.LIBRARY.value)"
				>
					待精选
				</el-dropdown-item>
				<el-dropdown-item @click="updateBsrCandidateStatus(6)">
					待处理数据
				</el-dropdown-item>
				<el-dropdown-item
					@click="updateBsrCandidateStatus(appConfig.BSR_CANDIDATE_STATUS.ARCHIVED.value)"
				>
					已归档
				</el-dropdown-item>
			</el-dropdown-menu>
		</template>
	</el-dropdown>
</template>

<script setup lang="ts" name="batch-update-bsr-candidate-status">
import { computed } from "vue";
import { ElMessage, ElMessageBox, ElLoading } from "element-plus";
import { ArrowDown } from "@element-plus/icons-vue";
import { appConfig } from "../../../../../appConfig";
import { useCool } from "/@/cool";

const { service } = useCool();

const props = defineProps({
	Crud: {
		required: true
	},
	hidePendingOption: {
		type: Boolean,
		default: false
	}
});

const isTableSelectionEmpty = computed(() => {
	return props.Crud?.selection.length === 0;
});

/**
 * 处理一批ID
 */
async function processBatch(ids: number[]) {
	try {
		// 调用批量处理接口
		const response = await service.app.bsr_candidate.archiveWithImage2({ ids });

		if (response.success) {
			return {
				success: true,
				results: response.results
			};
		} else {
			ElMessage.error("处理失败: " + (response.message || "未知错误"));
			return {
				success: false,
				results: []
			};
		}
	} catch (error) {
		ElMessage.error("处理出错: " + (error.message || error));
		return {
			success: false,
			results: []
		};
	}
}

/**
 * 分批次处理所有ID，每次处理5条
 */
async function batchProcessInBatches(allIds: number[], loading: any) {
	const batchSize = 5; // 每批处理5条
	const totalBatches = Math.ceil(allIds.length / batchSize);
	let currentBatch = 0;
	let allResults = [];
	let allSuccess = true;

	// 分批次处理
	while (currentBatch < totalBatches) {
		// 计算当前批次的ID范围
		const startIndex = currentBatch * batchSize;
		const endIndex = Math.min(startIndex + batchSize, allIds.length);
		const batchIds = allIds.slice(startIndex, endIndex);

		// 更新加载状态文本
		loading.setText(`正在处理数据 ${startIndex + 1}-${endIndex} 条，共 ${allIds.length} 条...`);

		// 处理当前批次
		const batchResult = await processBatch(batchIds);

		// 收集结果
		allResults = [...allResults, ...batchResult.results];
		if (!batchResult.success) {
			allSuccess = false;
		}

		currentBatch++;
	}

	return {
		success: allSuccess,
		results: allResults
	};
}

/**
 * 分批次执行update操作，每次处理5条
 */
async function updateInBatches(rows: any[], loading: any) {
	const batchSize = 5; // 每批处理5条
	const totalBatches = Math.ceil(rows.length / batchSize);
	let currentBatch = 0;
	let allSuccess = true;

	while (currentBatch < totalBatches) {
		// 计算当前批次的范围
		const startIndex = currentBatch * batchSize;
		const endIndex = Math.min(startIndex + batchSize, rows.length);
		const batchRows = rows.slice(startIndex, endIndex);

		// 更新加载状态文本
		loading.setText(`正在更新状态 ${startIndex + 1}-${endIndex} 条，共 ${rows.length} 条...`);

		try {
			// 执行当前批次的update
			await props.Crud?.service.update(batchRows);
		} catch (error) {
			ElMessage.error(
				`更新第 ${startIndex + 1}-${endIndex} 条失败: ${error.message || error}`
			);
			allSuccess = false;
			// 可以选择是否继续处理后续批次
			// 如果需要失败即停止，可添加: break;
		}

		currentBatch++;
	}

	return allSuccess;
}

async function updateBsrCandidateStatus(status: number) {
	ElMessageBox.confirm("此操作将批量修改状态，无法撤销，是否继续？", "提示", {
		type: "warning"
	})
		.then(async () => {
			const selection = props.Crud?.selection || [];
			const ids = selection.map((s) => s.id);

			if (ids.length === 0) {
				ElMessage.warning("请先选择需要操作的数据");
				return;
			}

			// 显示加载状态
			const loading = ElLoading.service({
				lock: true,
				text: `准备处理 ${ids.length} 条数据...`,
				background: "rgba(0, 0, 0, 0.7)"
			});

			try {
				if (status === 3 || status === 6) {
					// 分批次处理数据
					const processResult = await batchProcessInBatches(ids, loading);

					if (!processResult.success) {
						// 如果处理失败，不继续执行后续更新
						return;
					}

					const failedArchives = processResult.results.filter(
						(result) => !result.success
					);
					if (failedArchives.length > 0) {
						console.error("部分处理失败:", failedArchives);
					}

					// 执行状态更新（也分批次）
					const rows = selection.map((s) => ({ id: s.id, status }));
					const updateSuccess = await updateInBatches(rows, loading);

					if (!updateSuccess) {
						ElMessage.warning("部分数据状态更新失败");
					}
				} else if (status === 5) {
					// 状态5的处理逻辑，同样可以考虑分批处理
					await service.app.bsr_candidate.archiveWithImage({ ids });
				}

				ElMessage.success("更新完成");
				props.Crud?.refresh();
			} catch (error) {
				ElMessage.error("操作失败: " + (error.message || error));
			} finally {
				// 无论成功失败，都关闭加载状态
				loading.close();
			}
		})
		.catch(() => {
			// 用户取消操作
		});
}
</script>

<style scoped lang="scss"></style>
