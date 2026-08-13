<template>
	<div class="strategy-test-btn">
		<el-button type="primary" size="mini" @click="testStrategy" :loading="loading">
			测试{{ strategyName }}
		</el-button>
		<div v-if="result" class="result-box">
			<div v-if="result.tactic_hint_price" class="hint">
				<span class="label">调价提示：</span>
				<span class="content">{{ result.tactic_hint_price }}</span>
			</div>
			<div v-else class="no-hint">未触发调价建议</div>
			<div v-if="result.tactic_price_suggested_new_price" class="new-price">
				<span class="label">建议新价格：</span>
				<span class="content">{{ result.tactic_price_suggested_new_price }}</span>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref, PropType } from "vue";
import { useCool } from "/@/cool";
import { ElMessage } from "element-plus";

export default defineComponent({
	name: "strategy-test-btn",
	props: {
		scope: {
			type: Object,
			default: () => ({})
		},
		strategyType: {
			type: String as PropType<"p1" | "p2" | "p3" | "p4">,
			required: true
		},
		strategyName: {
			type: String,
			default: "策略"
		}
	},
	setup(props) {
		const { service } = useCool();
		const loading = ref(false);
		const result = ref<any>(null);

		const testStrategy = async () => {
			if (!props.scope.id) {
				ElMessage.warning("请先保存 Listing 再测试策略");
				return;
			}

			loading.value = true;
			result.value = null;

			try {
				const res = await service.app.admin.listing.testStrategy({
					id: props.scope.id,
					type: props.strategyType
				});
				result.value = res;
				if (res.tactic_hint_price) {
					ElMessage.success("策略测试完成，已生成建议");
				} else {
					ElMessage.info("策略测试完成，未触发调价");
				}
			} catch (err: any) {
				ElMessage.error(err.message || "测试失败");
			} finally {
				loading.value = false;
			}
		};

		return {
			loading,
			result,
			testStrategy
		};
	}
});
</script>

<style scoped>
.strategy-test-btn {
	margin-bottom: 10px;
}
.result-box {
	margin-top: 10px;
	padding: 10px;
	background-color: #f5f7fa;
	border-radius: 4px;
	border: 1px solid #e4e7ed;
	font-size: 13px;
}
.hint,
.new-price {
	margin-bottom: 5px;
	display: flex;
}
.label {
	font-weight: bold;
	color: #606266;
	width: 90px;
	flex-shrink: 0;
}
.content {
	color: #303133;
}
.no-hint {
	color: #909399;
}
</style>
