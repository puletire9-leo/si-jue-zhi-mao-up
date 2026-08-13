<template>
	<el-button @click="listingPaneVisible = true" :disabled="isTableSelectionEmpty">
		{{ { keyword: "关键词", competitor: "竞品" }[props.type] }}复制
	</el-button>

	<el-drawer
		v-model="listingPaneVisible"
		size="95%"
		direction="ltr"
		destroy-on-close
		:title="{ keyword: '关键词', competitor: '竞品' }[props.type] + '复制'"
	>
		<template #default>
			<Listing :editable="false" @selection-change="onListingSelectionChange">
				<template #before-function-bar>
					<cl-row>
						<template v-if="props.type === 'keyword'">
							<el-space wrap style="margin-bottom: 10px">
								当前已选关键词：
								<template v-for="keyword in Crud.selection">
									<el-tag>{{ keyword.value }}</el-tag>
								</template>
							</el-space>
						</template>
						<template v-else>
							<div>当前已选竞品：</div>
							<div>
								<el-scrollbar max-height="300">
									<el-space
										wrap
										direction="vertical"
										alignment="start"
										style="margin-bottom: 10px"
									>
										<template v-for="competitor in Crud.selection">
											<div>
												<el-tag effect="dark" style="width: 120px">
													{{ competitor.asin_competitor }}
												</el-tag>
												<el-divider direction="vertical"></el-divider>
												<el-tag>
													<el-text
														truncated
														line-clamp="1"
														style="max-width: 1000px"
													>
														{{ competitor.item_name }}
													</el-text>
												</el-tag>
											</div>
										</template>
									</el-space>
								</el-scrollbar>
							</div>
						</template>
					</cl-row>

					<cl-row>
						<el-space wrap>
							请在下方表格勾选需要复制到的 Listing，然后点击：
							<el-button
								type="primary"
								:disabled="selectedListings.length === 0"
								@click="
									props.type === 'keyword'
										? duplicateKeywordsToListings()
										: duplicateCompetitorsToListings()
								"
							>
								确认复制
							</el-button>
						</el-space>
					</cl-row>
					<el-divider></el-divider>
				</template>
			</Listing>
		</template>
	</el-drawer>
</template>

<script setup lang="ts" name="duplicator-for-keyword-or-competitor">
import { computed, ref } from "vue";
import Listing from "/$/app/views/listing.vue";
import { useCool } from "/@/cool";
import { ElLoading, ElMessage } from "element-plus";
import { ListingViewModel } from "/$/app/interface/listingViewModel";

const { service } = useCool();

const props = defineProps({
	Crud: {
		required: true
	},

	type: {
		type: String,
		default: "keyword",
		validator(value, props) {
			return ["keyword", "competitor"].includes(<string>value);
		}
	}
});

const isTableSelectionEmpty = computed(() => {
	return props.Crud?.selection.length === 0;
});

const listingPaneVisible = ref(false);

const selectedListings = ref<ListingViewModel[]>([]);

function onListingSelectionChange(selections: ListingViewModel[]) {
	selectedListings.value = selections;
}

async function duplicateKeywordsToListings() {
	const loadingInstance = ElLoading.service({});

	let keywords = props.Crud?.selection;

	let result = await service.app.keyword.batch_duplicate_to_listings({
		keywords,
		listings: selectedListings.value
	});

	if (result === "ok") {
		ElMessage({
			message: "已复制所选关键词到指定的 Listing",
			type: "success",
			duration: 4000,
			showClose: true
		});
	} else {
		ElMessage({ message: result });
	}

	listingPaneVisible.value = false;
	loadingInstance.close();
}

async function duplicateCompetitorsToListings() {
	const loadingInstance = ElLoading.service({});

	let competitors = props.Crud?.selection;
	console.log("competitors", competitors);
	console.log("listings", selectedListings.value);

	let result = await service.app.competitor.batch_duplicate_to_listings({
		competitors: competitors,
		listings: selectedListings.value
	});

	if (result === "ok") {
		ElMessage({
			message: "已复制所选竞品到指定的 Listing",
			type: "success",
			duration: 4000,
			showClose: true
		});
	} else {
		ElMessage({ message: result });
	}

	listingPaneVisible.value = false;
	loadingInstance.close();
}
</script>

<style scoped lang="scss">
.el-card {
	margin-top: -2px;
}
</style>
