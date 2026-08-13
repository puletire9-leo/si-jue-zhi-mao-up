<template>
	<el-popconfirm
		:title="`即将在 ${Crud?.selection?.length} 个新的浏览器页签中打开所选产品的详情页面，确认操作吗？`"
		@confirm="batchOpenLink()"
		:width="250"
	>
		<template #reference>
			<el-button :disabled="isTableSelectionEmpty">打开所选产品页面</el-button>
		</template>
	</el-popconfirm>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { appConfig } from "../../../../../appConfig";

const props = defineProps({
	Crud: {
		required: true
	},

	asin_field_name: {
		type: String,
		default: "asin"
	},
	marketplace_field_name: {
		type: String,
		default: "marketplace"
	}
});

const isTableSelectionEmpty = computed(() => {
	return props.Crud?.selection.length === 0;
});

function batchOpenLink() {
	try {
		let entities = props.Crud?.selection;
		entities.forEach((entity, index) => {
			let link = appConfig.get_amazon_url_dp(
				entity?.[props.asin_field_name],
				entity?.[props.marketplace_field_name]
			);
			setTimeout(() => {
				window.open(link, "_blank");
			}, index * 3000); // 每个窗口延迟200毫秒打开
		});
	} catch (err) {
		console.log(err);
	}
}
</script>

<style scoped lang="scss"></style>
