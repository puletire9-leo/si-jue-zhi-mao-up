<template>
	<cl-crud ref="Crud">
		<template v-if="listing">
			<cl-row>
				<listing-description :listing="listing"></listing-description>
			</cl-row>
		</template>

		<el-divider>关键词列表</el-divider>
		<cl-row>
			<cl-refresh-btn />

			<el-button type="success" v-if="listing" @click="batchImportDialogVisible = true">
				批量添加
			</el-button>

			<cl-multi-delete-btn />

			<batch-update-keyword-status :Crud="Crud" />
			<duplicator-for-keyword-or-competitor :Crud="Crud" />

			<el-select
				v-model="selectedCountry"
				placeholder="选择国家"
				style="width: 120px; margin-right: 10px"
				@change="handleCountryChange"
			>
				<el-option label="全部国家" value="" />
				<el-option
					v-for="country in countryOptions"
					:key="country.value"
					:label="country.label"
					:value="country.value"
				/>
			</el-select>
			<!-- <el-button type="primary" @click="handleFetchKeywordsForListing()">
				获取关键词数据
			</el-button> -->
			<el-button type="success" @click="setKeywordTypesByAsin()">
				自动设置关键词类型
			</el-button>

			<el-button type="success" @click="handleExport()"> 导出关键词 </el-button>

			<el-tooltip content="输入竞品ASIN，批量获取关键词并导入" placement="top">
				<el-button type="primary" plain @click="manualAsinDialogVisible = true">
					asin反查
				</el-button>
			</el-tooltip>

			<el-select
				v-model="batchAction"
				placeholder="批量操作"
				@change="handleBatchAction"
				style="width: 180px; margin-right: 10px"
				clearable
			>
				<!-- <el-option label="设置勾选为核心大词" value="core_major" /> -->
				<el-option label="设置勾选为核心词" value="core" />
				<el-option label="设置勾选为长尾词" value="long_tail" />
				<el-option label="" value="" />
			</el-select>

			<cl-flex1 />
			<el-space direction="horizontal">
				<el-text>仅展示已入库</el-text>
				<el-switch
					v-model="showOnlyStatusLibrary"
					active-text="是"
					inactive-text="否"
					inline-prompt
				></el-switch>
				<el-divider direction="vertical"></el-divider>
			</el-space>
			<keyword-filter-status />
			<cl-search-key />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-value="{ scope }">
					<div style="display: flex; flex-direction: column; gap: 4px">
						<el-link
							target="_blank"
							:underline="false"
							:href="
								appConfig.get_amazon_url_keyword_search(
									scope.row.value,
									scope.row.marketplaces
								)
							"
							style="justify-content: flex-start; font-weight: bold; font-size: 14px"
						>
							{{ scope.row.value }}
						</el-link>
						<span style="font-size: 12px; color: #909399" v-if="scope.row.value_cn">{{
							scope.row.value_cn
						}}</span>
					</div>
				</template>

				<template #column-ppc_bid="{ scope }">
					<div style="font-size: 12px">
						{{ scope.row.ppc_bid || "-" }} / {{ scope.row.ppc_bid_min || "-" }} ~
						{{ scope.row.ppc_bid_max || "-" }}
					</div>
				</template>

				<template #column-keyword_type="{ scope }">
					<!-- <template v-if="['core_major', 'core', 'long_tail'].includes(scope.row.keyword_type)">
            {{ KEY_TYPE_MAP[scope.row.keyword_type] }}
          </template> -->

					<el-select
						v-model="scope.row.keyword_type"
						placeholder="请选择"
						style="width: 100%"
						@change="handleDispatchTypeChange(scope.row)"
						@blur="handleDispatchTypeBlur(scope.row)"
					>
						<el-option label="核心大词" value="core_major" />
						<el-option label="核心词" value="core" />
						<el-option label="长尾词" value="long_tail" />
						<el-option label=" " value="" />
					</el-select>
				</template>

				<template #column-spider_res="{ scope }">
					<el-button
						size="small"
						v-if="!!scope.row.spider_res"
						@click="
							jsonViewerContent = JSON.stringify(scope.row.spider_res, null, 2);
							jsonViewerDialogVisible = true;
						"
					>
						查看 {{ scope.row.spider_res?.length }}
					</el-button>
					<template v-else>暂无</template>
				</template>

				<template #column-score1="{ scope }">
					<el-popover
						placement="right"
						title="关键词搜索结果图片"
						:width="560"
						trigger="hover"
						:persistent="false"
						:disabled="
							!(scope.row.result_details && scope.row.result_details.length > 0)
						"
					>
						<template #reference>
							<div
								style="
									cursor: pointer;
									display: flex;
									flex-direction: column;
									align-items: flex-start;
									gap: 2px;
								"
							>
								<div>
									<span style="color: #909399; margin-right: 4px; font-size: 12px"
										>图:</span
									>{{ scope.row.score1 || "-" }}
								</div>
								<div>
									<span style="color: #909399; margin-right: 4px; font-size: 12px"
										>词:</span
									>{{ scope.row.score2 || "-" }}
								</div>
							</div>
						</template>
						<template #default>
							<el-space direction="horizontal" wrap size="large">
								<template
									v-for="(res, index) in scope.row.result_details"
									:key="index"
								>
									<el-link
										:href="
											appConfig.get_amazon_url_dp(
												res.asin,
												scope.row.marketplace
											)
										"
										target="_blank"
										:disabled="!res.asin"
									>
										<el-image
											:src="convert_image_url(res.url_image)"
											style="
												padding: 5px;
												width: 50px;
												height: 50px;
												border: 1px solid #eee;
												object-fit: contain;
											"
											:preview-src-list="
												scope.row.result_details.map((item) =>
													convert_image_url(item.url_image)
												)
											"
											:initial-index="index"
											preview-teleported
											hide-on-click-modal
										></el-image>
									</el-link>
								</template>
							</el-space>
						</template>
					</el-popover>
				</template>

				<template #column-search_volume_data="{ scope }">
					<el-button
						size="small"
						v-if="!!scope.row.search_volume_data"
						@click="
							jsonViewerContent = JSON.stringify(
								scope.row.search_volume_data,
								null,
								2
							);
							jsonViewerDialogVisible = true;
						"
					>
						查看 {{ scope.row.search_volume_data?.length }}
					</el-button>
					<template v-else>暂无</template>
				</template>

				<template #column-search_volume_chart="{ scope }">
					<template v-if="scope.row.sif_search_history">
						<el-popover
							placement="right"
							title="关键词搜索量走势"
							:width="400"
							trigger="hover"
						>
							<template #reference>
								<el-button plain circle size="default">
									<el-icon>
										<data-line />
									</el-icon>
								</el-button>
							</template>
							<template #default>
								<v-chart
									:option="
										generateKeywordSearchVolumeChartOption(
											scope.row.sif_search_history
										)
									"
									style="height: 200px"
									autoresize
								></v-chart>
							</template>
						</el-popover>
					</template>
					<template v-else>暂无</template>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert" />

		<el-dialog v-model="batchImportDialogVisible" align-center draggable width="500">
			<template #header>批量添加</template>
			<template #default>
				<el-space fill style="width: 100%">
					<!-- 新增的国家选择器 -->
					<el-select
						v-model="importMarketplace"
						placeholder="选择国家"
						clearable
						style="margin-bottom: 15px; width: 100%"
					>
						<el-option
							v-for="country in countryOptions"
							:key="country.value"
							:label="country.label"
							:value="country.value"
						/>
					</el-select>

					<el-alert type="info" show-icon :closable="false">
						请输入若干个关键词条，一行一个。<br />
						完全一致的关键词条不会被重复添加到系统中。
					</el-alert>
					<el-input
						type="textarea"
						rows="10"
						resize="vertical"
						:autosize="{ minRows: 10, maxRows: 30 }"
						v-model="importingKeywordsInput"
					></el-input>
				</el-space>
			</template>
			<template #footer>
				<el-button @click="batchImportDialogVisible = false">取消</el-button>
				<el-button type="primary" @click="importKeywords()">确认导入</el-button>
			</template>
		</el-dialog>

		<cl-dialog v-model="jsonViewerDialogVisible" align-center>
			<cl-editor-monaco
				v-model="jsonViewerContent"
				language="json"
				:height="800"
				disabled
			></cl-editor-monaco>
			<template #footer>
				<el-button size="large" @click="jsonViewerDialogVisible = false">OK</el-button>
			</template>
		</cl-dialog>

		<!-- 手动输入竞品ASIN弹窗 -->
		<el-dialog v-model="manualAsinDialogVisible" title="手动输入竞品ASIN" width="600" align-center draggable :close-on-click-modal="false">
			<el-alert type="info" show-icon :closable="false" style="margin-bottom: 16px">
				ASIN格式：10位字母数字组成（如 B0DM1SXB7G）。<br/>
				支持两种输入方式：① 逐个输入按回车 ② 批量粘贴后点击识别
			</el-alert>
			<div style="margin-bottom: 12px">
				<div style="font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 6px">逐个输入</div>
				<el-input
					v-model="manualAsinInputText"
					placeholder="输入ASIN后按回车添加，例如 B0DM1SXB7G"
					@keydown.enter.prevent="addManualAsin"
					clearable
				/>
			</div>
			<div style="margin-bottom: 12px">
				<div style="font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 6px">批量粘贴</div>
				<el-input
					type="textarea"
					v-model="manualAsinBulkText"
					:rows="4"
					resize="vertical"
					placeholder="粘贴多个ASIN，支持换行、逗号、空格分隔"
				/>
				<el-button size="small" type="primary" plain style="margin-top: 8px" @click="parseBulkAsins" :disabled="!manualAsinBulkText?.trim()">
					识别并添加
				</el-button>
			</div>
			<el-divider style="margin: 12px 0" />
			<div v-if="manualAsinTags.length > 0">
				<div style="font-size: 13px; color: #909399; margin-bottom: 8px">
					已添加 <span style="color: #409EFF; font-weight: 600">{{ manualAsinTags.length }}</span> 个ASIN
				</div>
				<div style="display: flex; flex-wrap: wrap; gap: 8px">
					<el-tag
						v-for="asin in manualAsinTags"
						:key="asin"
						closable
						type="primary"
						effect="light"
						round
						@close="removeManualAsin(asin)"
						style="font-family: monospace; font-size: 13px"
					>
						{{ asin }}
					</el-tag>
				</div>
			</div>
			<div v-else style="text-align: center; padding: 20px 0; color: #C0C4CC; font-size: 13px">
				暂无ASIN，请在上方输入或粘贴
			</div>
			<template #footer>
				<el-button @click="manualAsinDialogVisible = false">取消</el-button>
				<el-button type="primary" :disabled="manualAsinTags.length === 0" @click="handleManualAsinConfirm">
					确认查询 ({{ manualAsinTags.length }})
				</el-button>
			</template>
		</el-dialog>

		<!-- 关键词查询结果面板 -->
		<batch-keyword-result
			v-model:visible="manualKeywordResultVisible"
			:asin="props.listing?.asin || ''"
			:product-code="props.listing?.asin || ''"
			:marketplaces="props.listing?.marketplace || props.listing?.marketplaces || ''"
			:competitor-asins="manualCompetitorAsins"
			@saved="() => Crud?.refresh()"
		/>
	</cl-crud>
</template>

<script lang="ts" name="app-listing-keyword" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { computed, ref, watch } from "vue";
import { ElLoading, ElMessage } from "element-plus";
import ListingDescription from "/$/app/components/listing-description.vue";
import BatchUpdateKeywordStatus from "/$/app/components/batch-update-keyword-status.vue";
import { useUserStore } from "/$/base/store/user";
import ClDialog from "/~/crud/src/components/dialog";
import { DataLine, Picture } from "@element-plus/icons-vue";
import { generateKeywordSearchVolumeChartOption } from "/$/app/utils";
import KeywordFilterStatus from "/$/app/components/keyword-filter-status.vue";
import DuplicatorForKeywordOrCompetitor from "/$/app/components/duplicator-for-keyword-or-competitor.vue";
import BatchKeywordResult from "/$/app/components/BatchKeywordResult.vue";
import { appConfig } from "../../../../../appConfig";
import { convert_image_url } from "/$/app/utils";
import dayjs from "dayjs";

const { service } = useCool();

const props = defineProps(["listing"]);

const userStore = useUserStore();
const is_admin = computed(() => {
	return "admin" === userStore.info?.username;
});

const Crud = useCrud(
	{
		service: service.app.keyword,

		async onRefresh(params, { next, done, render }) {
			if (showOnlyStatusLibrary.value)
				Object.assign(params, { status: appConfig.KEYWORD_STATUS.LIBRARY.value });

			const { list } = await next({
				...params,

				sid: props.listing?.sid,
				asin: props.listing?.asin,
				seller_sku: props.listing?.seller_sku
			});

			const processedList = (list || []).map((item) => ({
				...item,
				keyword_type: item.keyword_type != null ? item.keyword_type : null
			}));

			// 只在这里渲染一次
			render(processedList);

			render(list);
		}
	},
	(app) => {
		app.refresh({
			size: 50
		});
	}
);

watch(props, () => {
	Crud.value?.refresh();
});

const showOnlyStatusLibrary = ref(true);
watch([showOnlyStatusLibrary], () => void setTimeout(Crud?.value?.refresh, 200));

const Table = useTable({
	columns: [
		{ type: "selection", fixed: "left" },

		{
			label: "关键词",
			prop: "value",
			minWidth: 200,
			fixed: "left",
			sortable: "custom"
		},
		{
			label: "状态",
			prop: "status",
			dict: [
				{ label: "待调研", value: 0, type: "warning" },
				{ label: "调研中", value: 1, color: "purple" },
				{ label: "待入库", value: 2, type: "primary" },
				{ label: "已入库", value: 3, type: "success" },
				{ label: "已归档", value: 4, type: "info" }
			],

			width: 100,
			sortable: "custom"
		},
		// {
		//   label: "核心关键词", prop: "is_core",
		//   minWidth: 120,
		//   component: {
		//     name: "cl-switch",
		//     props: {
		//       'active-text': '是',
		//       'inactive-text': '否',
		//       'inline-prompt': true,
		//     },
		//   },
		//   sortable: "custom",
		// },

		// { label: "流量占比", prop: "trafficPercentage", width: 110, sortable: "desc" },
		{ label: "流量得分", prop: "sif_score", width: 110, sortable: "desc" },

		{
			label: "关键词类型",
			prop: "keyword_type",
			width: 140,
			align: "center"
		},
		{ label: "国家", prop: "marketplaces", width: 60, sortable: "custom" },
		// { label: "广告竞品数", prop: "ad_competitor_count", width: 100, sortable: "custom" },
		// { label: "PPC竞价", prop: "ppc_bid", width: 140, sortable: "custom" },
		// { label: "PPC竞价最小值", prop: "ppc_bid_min", width: 60, sortable: "custom" },
		// { label: "PPC竞价最大值", prop: "ppc_bid_max", width: 60, sortable: "custom" },
		{ label: "ABA排名", prop: "sif_search_rank", width: 60, sortable: "custom" },
		{ label: "自然排名", prop: "sif_natural_rank", width: 60, sortable: "custom" },
		{ label: "SP广告排名", prop: "sif_sp_rank", width: 60, sortable: "custom" },
		// { label: "月搜索量", prop: "search_volume_monthly", width: 110, sortable: "custom" },
		{ label: "月搜索量", prop: "sif_search_volume_monthly", width: 110, sortable: "custom" },
		// { label: "综合评分", prop: "weight", width: 110, sortable: "custom" },
		// { label: "评分", prop: "score1", width: 80, sortable: "custom" },
		// {
		// 	label: "评分日期",
		// 	prop: "score_time",
		// 	sortable: "custom",
		// 	minWidth: 160,
		// 	component: { name: "cl-date-text" }
		// },
		// { label: "搜索量数据 *", prop: "search_volume_data", width: 110, hidden: !is_admin.value },
		{ label: "搜索量走势", prop: "search_volume_chart", width: 70 },
		{
			label: "月搜索量查询时间 *",
			prop: "sif_update_time",
			width: 180,
			component: { name: "cl-date-text" },
			sortable: "custom",
			hidden: !is_admin.value
		},
		{
			label: "创建时间",
			prop: "createTime",
			minWidth: 160,
			component: { name: "cl-date-text" },
			sortable: "custom"
		},
		{
			label: "更新时间",
			prop: "updateTime",
			minWidth: 160,
			component: { name: "cl-date-text" },
			sortable: "custom"
		},

		{ type: "op", buttons: ["edit", "delete"] }
	]
});

const Upsert = useUpsert({
	dialog: {
		draggable: true,
		"align-center": true,
		width: "650"
	},
	props: {
		labelWidth: 150
	},
	items: [
		{
			label: "关键词条",
			prop: "value",
			component: { name: "el-input", props: { clearable: true } },
			required: true
		},
		{
			label: "关键词中文意思",
			prop: "value_cn",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "国家",
			prop: "marketplaces",
			component: { name: "el-input", props: { clearable: true } },
			required: true
		},

		{
			label: "状态",
			prop: "status",
			component: {
				name: "el-radio-group",
				options: [
					{ label: "待调研", value: 0 },
					{ label: "调研中", value: 1 },
					{ label: "待入库", value: 2 },
					{ label: "已入库", value: 3 },
					{ label: "已归档", value: 4 }
				]
			},
			value: 0,
			required: true
		}
	]
});

const batchImportDialogVisible = ref(false);
const importingKeywordsInput = ref("");
const importAsCoreKeyword = ref(false);
const importMarketplace = ref("");

async function importKeywords() {
	let input = importingKeywordsInput.value
		.trim()
		.split("\n")
		.map((row) => row.trim())
		.filter((row) => row);

	if (input.length === 0) {
		ElMessage.info("请填写内容。");
		return false;
	}

	if (!importMarketplace.value) {
		ElMessage.warning("请选择国家");
		return;
	}

	const loading = ElLoading.service({
		lock: true,
		text: "请稍后"
	});
	try {
		const result = await service.app.keyword.batch_import({
			sid: props.listing?.sid,
			asin: props.listing?.asin,
			seller_sku: props.listing?.seller_sku,
			keywords: input,
			is_core: importAsCoreKeyword.value,
			weight: 10,
			marketplaces: importMarketplace.value
		});
		if ("ok" === result) {
			ElMessage.success("导入成功");
			importingKeywordsInput.value = "";
			Crud.value?.refresh();
		} else {
			ElMessage.error("导入失败，请重试。");
		}
	} catch (err: any) {
		ElMessage.error(err);
	} finally {
		importMarketplace.value = "";
		batchImportDialogVisible.value = false;
		loading.close();
	}
}

// 新增国家选项配置
const countryOptions = ref([
	{ label: "英国", value: "英国" },
	{ label: "德国", value: "德国" },
	{ label: "法国", value: "法国" },
	{ label: "西班牙", value: "西班牙" },
	{ label: "意大利", value: "意大利" }
]);
const handleCountryChange = () => {
	Crud.value?.refresh({
		marketplaces: selectedCountry.value
	});
};

const handleDispatchTypeBlur = (row) => {
	// saveDispatchType(row);
};
const handleDispatchTypeChange = async (row: any) => {
	await saveDispatchType(row);
};

const saveDispatchType = async (row: any) => {
	try {
		await service.app.keyword.update({
			id: row.id,
			keyword_type: row.keyword_type
		});

		ElMessage.success("关键词类型已更新");
		// 刷新数据保持一致性
		Crud.value?.refresh();
	} catch (error) {
		console.error("保存失败:", error);
		ElMessage.error("保存失败");
		// 恢复原始数据
		Crud.value?.refresh();
	}
};

const KEY_TYPE_MAP: Record<string, string> = {
	core_major: "核心大词",
	core: "核心词",
	long_tail: "长尾词"
} as const;

const selectedCountry = ref<string>("");
const jsonViewerDialogVisible = ref(false);
const jsonViewerContent = ref();

async function setKeywordTypesByAsin() {
	try {
		const result = await service.app.keyword.setKeywordTypesByAsin({
			asin: props.listing?.asin
		});
		if ("ok" === result) {
			ElMessage.success("设置成功");
			Crud.value?.refresh();
		} else {
			ElMessage.error("设置失败，请重试。");
		}
	} catch (error) {
		console.error("设置失败:", error);
		ElMessage.error("设置失败");
	}
}

async function handleExport() {
	try {
		// 发起请求
		const response = await service.app.keyword.exportKeyword({
			asin: props.listing?.asin
		});

		// 检查响应数据
		if (!response) {
			ElMessage.error("导出失败，服务器未返回数据");
			return;
		}

		// 创建Blob
		const blob = new Blob([response], {
			type: "text/csv;charset=utf-8;"
		});

		// 创建下载链接
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `competitors_${dayjs().format("YYYY-MM")}.csv`;

		// 触发下载
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		// 释放资源
		URL.revokeObjectURL(link.href);
	} catch (error) {
		console.error("导出失败:", error);
	}
}

// script 部分修改
const batchAction = ref("");

// 处理批量操作
async function handleBatchAction(action: string) {
	const selection = Table.value?.selection;

	if (!selection || selection.length === 0) {
		ElMessage.warning("请先勾选要操作的关键词");
		batchAction.value = "";
		return;
	}

	// 立即更新前端显示
	selection.forEach((row) => {
		row.keyword_type = action; // 直接修改选中行的标签
		service.app.keyword.update({
			id: row.id,
			keyword_type: row.keyword_type
		});
	});

	ElMessage.success(`已更新 ${selection.length} 个关键词类型`);
	batchAction.value = "";
}

async function handleFetchKeywordsForListing() {
	try {
		const candidateId = props.listing?.asinid || props.listing?.candidate_id;

		if (!candidateId) {
			ElMessage.warning("缺少候选产品ID，无法获取关键词");
			return;
		}

		const loadingInstance = ElLoading.service({
			lock: true,
			text: "正在获取关键词信息，请稍候...",
			background: "rgba(0, 0, 0, 0.7)"
		});

		const response = await service.app.keyword.fetchKeywords({
			ids: [candidateId]
		});

		loadingInstance.close();

		ElMessage.success(`关键词获取成功：${response}`);
		Crud.value?.refresh();
	} catch (error) {
		console.error("获取关键词失败:", error);
		ElMessage.error("获取关键词失败");
	}
}

	// ========== 手动输入竞品ASIN查询关键词 ==========
	const manualAsinDialogVisible = ref(false);
	const manualAsinInputText = ref('');
	const manualAsinBulkText = ref('');
	const manualAsinTags = ref<string[]>([]);
	const manualKeywordResultVisible = ref(false);
	const manualCompetitorAsins = ref<string[]>([]);
	const parseAsins = (text: string): string[] => {
		return text
			.split(/[\n\r,;\s\t]+/) // 支持换行、逗号、分号、空格、Tab
			.map(s => s.trim().toUpperCase())
			.filter(s => /^[A-Z0-9]{10}$/.test(s)); // 严格10位字母数字
	};

	const addAsinsToTags = (asins: string[]): number => {
		const existing = new Set(manualAsinTags.value);
		let added = 0;
		for (const asin of asins) {
			if (!existing.has(asin)) {
				manualAsinTags.value.push(asin);
				existing.add(asin);
				added++;
			}
		}
		return added;
	};

	const addManualAsin = () => {
		const input = manualAsinInputText.value.trim();
		if (!input) return;
		const parsed = parseAsins(input);
		if (parsed.length === 0) {
			ElMessage.warning(`「${input}」不是有效的ASIN格式（需10位字母数字）`);
			return;
		}
		const added = addAsinsToTags(parsed);
		manualAsinInputText.value = '';
		if (added === 0) {
			ElMessage.info('该ASIN已存在，无需重复添加');
		}
	};

	const parseBulkAsins = () => {
		const text = manualAsinBulkText.value.trim();
		if (!text) return;
		const parsed = parseAsins(text);
		if (parsed.length === 0) {
			ElMessage.warning('未识别到有效ASIN（需10位字母数字，如 B0DM1SXB7G）');
			return;
		}
		const added = addAsinsToTags(parsed);
		const duplicated = parsed.length - added;
		let msg = `成功识别 ${parsed.length} 个ASIN，添加 ${added} 个`;
		if (duplicated > 0) msg += `，${duplicated} 个重复已跳过`;
		ElMessage.success(msg);
		manualAsinBulkText.value = '';
	};

	const removeManualAsin = (asin: string) => {
		manualAsinTags.value = manualAsinTags.value.filter(a => a !== asin);
	};

	const handleManualAsinConfirm = () => {
		if (manualAsinTags.value.length === 0) {
			ElMessage.warning('请至少添加一个ASIN');
			return;
		}
		manualCompetitorAsins.value = [...manualAsinTags.value];
		manualAsinDialogVisible.value = false;
		manualKeywordResultVisible.value = true;
	};

	watch(manualAsinDialogVisible, (val) => {
		if (val) {
			manualAsinInputText.value = '';
			manualAsinBulkText.value = '';
			manualAsinTags.value = [];
		}
	});
</script>
