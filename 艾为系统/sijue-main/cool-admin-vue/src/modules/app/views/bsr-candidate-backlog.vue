<template>
	<cl-crud ref="Crud">
		<cl-row>
			<el-alert type="info" show-icon>
				<ol style="margin-left: 20px">
					<li>对 BSR 选品进行【入库】操作时，列表不会自动刷新。</li>
					<li>请按需刷新列表。刷新后，只会显示状态为【待入库】的 BSR 选品。</li>
				</ol>
			</el-alert>
		</cl-row>

		<cl-row>
			<cl-refresh-btn />
			<cl-multi-delete-btn />

			<batch-update-bsr-candidate-status :Crud="Crud" />

			<batch-open-dp-link :Crud="Crud" />

			<!-- 导出模板按钮 -->
			<!-- <cl-export-btn 
        :columns="exportColumns" 
        filename="BSR初筛导入模板" 
        :data="[]" 
        >下载导入模板</cl-export-btn> -->

			<!-- 导入按钮，附带导入扩展表单和提交回调 -->
			<cl-import-btn tips="" :on-submit="onSubmit" />

			<el-select
				v-model="selectedBsrCategory"
				placeholder="BSR 类目"
				clearable
				filterable
				:loading="categoryLoading"
				style="width: 280px"
				@change="onBsrCategoryChange"
			>
				<el-option
					v-for="item in bsrCategoryOptions"
					:key="item.value"
					:label="formatCategoryOptionLabel(item)"
					:value="item.value"
				/>
			</el-select>

			<el-tag
				v-if="selectedBsrNode"
				class="bsr-node-filter-tag"
				:title="selectedBsrNode"
				closable
				@close="clearBsrNodeRank"
			>
				{{ selectedBsrNode }}
			</el-tag>

			<cl-flex1 />
			<cl-search-key placeholder="模糊搜索" />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-asin="{ scope }">
					<div class="date-cell">
						<div class="asin-value">
							<el-link type="primary" :underline="false" @click.prevent="openProductLinks2(scope.row)">
								{{ scope.row.asin }}
							</el-link>
						</div>
						<!-- 状态标签 -->
						<br />
						<div v-if="scope.row.source === 1" class="status-tag status-tag--close">
							数
						</div>
						<div
							v-else-if="scope.row.source === 2"
							class="status-tag status-tag--compete"
						>
							1688
						</div>
						<div
							v-else-if="scope.row.source === 3"
							class="status-tag status-tag--success"
						>
							变
						</div>
						<div
							v-else-if="scope.row.source === 4"
							class="status-tag status-tag--success"
						>
							季
						</div>
						<br />
						<el-link target="_blank" :underline="false" @click.prevent="openProductLinks(scope.row)">
							<el-button size="small">批量打开</el-button>
						</el-link>
					</div>
				</template>

				<template #column-bsr_link="{ scope }">
					<cl-table-column-bsr-link :bsr_link="scope.row.bsr_link" />
				</template>

				<template #column-bullet_points="{ scope }">
					<cl-table-column-bullet-points :bullet_points="scope.row.bullet_points" />
				</template>

				<template #column-bsr_category="{ scope }">
					<el-link
						v-if="scope.row.bsr_category"
						type="primary"
						:underline="false"
						@click.prevent="rankByBsrCategory(scope.row.bsr_category)"
					>
						{{ scope.row.bsr_category }}
					</el-link>
					<span v-else>-</span>
				</template>

				<template #column-bsr_node="{ scope }">
					<el-link
						v-if="scope.row.bsr_node"
						type="primary"
						:underline="false"
						@click.prevent="rankByBsrNode(scope.row.bsr_node)"
					>
						{{ scope.row.bsr_node }}
					</el-link>
					<span v-else>-</span>
				</template>

				<template #slot-management-buttons="{ scope }">
					<el-button
						size="default"
						type="success"
						text
						bg
						@click="
							updateStatus(scope.row, appConfig.BSR_CANDIDATE_STATUS.LIBRARY.value)
						"
					>
						入库
					</el-button>

					<el-dropdown>
						<el-button size="default" type="info" text bg> 归档 </el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item
									v-for="month in 12"
									:key="month"
									@click="ignoreArchiveLater(scope.row, month)"
								>
									{{ month }}个月后显示
								</el-dropdown-item>
								<el-dropdown-item
									@click="
										updateStatus(
											scope.row,
											appConfig.BSR_CANDIDATE_STATUS.ARCHIVED.value
										)
									"
								>
									永久归档
								</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</template>
				<template #column-image_url_display="{ scope }">
					<el-popover
						placement="right"
						trigger="hover"
						:width="1300"
						@show="boostProductImages(scope.row)"
					>
						<template #reference>
							<resilient-product-image
								:src="scope.row.image_url_display"
								style="width: 50px; height: 50px; cursor: pointer"
								fit="contain"
								priority="visible"
								@mouseenter="boostProductImages(scope.row)"
							/>
						</template>
						<template #default>
							<div
								style="display: flex; overflow-x: auto; gap: 10px; padding: 10px 0"
							>
								<template v-for="i in 6" :key="i">
									<resilient-product-image
										v-if="scope.row[`image_url${i === 1 ? '' : i}`]"
										:src="
											convert_image_url(
												scope.row[`image_url${i === 1 ? '' : i}`]
											)
										"
										style="
											width: 200px;
											height: 200px;
											flex-shrink: 0;
											cursor: pointer;
										"
										fit="contain"
										priority="hover"
										@click="
											swapMainImage(scope.row, `image_url${i === 1 ? '' : i}`)
										"
									/>
								</template>
							</div>
						</template>
					</el-popover>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" name="app-bsr-candidate-backlog" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { ref } from "vue";
import { useCool } from "/@/cool";
import { convert_image_url, is_admin } from "/$/app/utils";
import { boostProductImages, preloadProductImages } from "/$/app/utils/product-image-loading";
import ResilientProductImage from "/$/app/components/resilient-product-image.vue";
import { appConfig } from "../../../../../appConfig";
import ClTableColumnBulletPoints from "/$/app/components/cl-table-column-bullet-points.vue";
import ClCrud from "/~/crud/src/components/crud";
import ClRow from "/~/crud/src/components/row";
import { ElMessage } from "element-plus";
import BatchUpdateBsrCandidateStatus from "/$/app/components/batch-update-bsr-candidate-status.vue";
import ClTableColumnBsrLink from "/$/app/components/cl-table-column-bsr-link.vue";
import BatchOpenDpLink from "/$/app/components/batch-open-dp-link.vue";
import { useUserStore } from "/$/base/store/user";

const { service } = useCool();
const userStore = useUserStore();

interface BsrCategoryOption {
	label: string;
	value: string;
	count?: number;
}

const selectedBsrCategory = ref("");
const selectedBsrNode = ref("");
const bsrCategoryOptions = ref<BsrCategoryOption[]>([]);
const categoryLoading = ref(false);

const Crud = useCrud(
	{
		service: service.app.bsr_candidate,
		async onRefresh(params, { next, done, render }) {
			const baseParams: any = {
				...params,
				status: appConfig.BSR_CANDIDATE_STATUS.PENDING.value,
				archiveFilter: new Date()
			};

			if (selectedBsrCategory.value) {
				baseParams.bsr_category = selectedBsrCategory.value;
			} else {
				delete baseParams.bsr_category;
			}

			if (selectedBsrNode.value) {
				baseParams.bsr_node = selectedBsrNode.value;
			} else {
				delete baseParams.bsr_node;
			}

			const distinguishName = userStore.info?.name;
			let renderList: any[] = [];

			if (distinguishName) {
				const { list } = await next({
					...baseParams,
					distinguish: distinguishName
				});
				if (list?.length) {
					renderList = list;
				}
			}

			if (!renderList.length) {
				const { list } = await next(baseParams);
				renderList = list || [];
			}

			renderList.forEach((item) => {
				item.image_url_display = convert_image_url(item.image_url);
			});
			render(renderList);
			preloadProductImages(renderList, { reason: "bsr-candidate-backlog" });
		}
	},
	(app) => {
		loadBsrCategoryOptions();
		app.refresh();
	}
);

const Table = useTable({
	columns: [
		{ type: "selection" },

		{
			label: "BSR 链接",
			prop: "bsr_link",
			minWidth: 50,
			showOverflowTooltip: true,
			fixed: "left"
		},
		{ label: "ASIN", prop: "asin", minWidth: 100, fixed: "left" },
		{
			label: "图片",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 50, fit: "contain", referrerpolicy: "no-referrer" } },
			fixed: "left"
		},
		{
			label: "产品标题",
			prop: "item_name",
			showOverflowTooltip: true,
			minWidth: 100,
			fixed: "left"
		},
		{
			label: "状态",
			prop: "status",
			dict: [
				{
					label: "待入库",
					value: appConfig.BSR_CANDIDATE_STATUS.PENDING.value,
					type: "primary"
				},
				{
					label: "待精选",
					value: appConfig.BSR_CANDIDATE_STATUS.LIBRARY.value,
					type: "primary"
				},
				{
					label: "已精选",
					value: appConfig.BSR_CANDIDATE_STATUS.LIBRARY2.value,
					type: "success"
				},
				{
					label: "已归档",
					value: appConfig.BSR_CANDIDATE_STATUS.ARCHIVED.value,
					type: "info"
				}
			],
			width: 80,
			sortable: "custom",

			fixed: "left"
		},

		{ prop: "aliyun_score", label: "评分", width: 60, hidden: !is_admin.value },
		{ label: "价格", prop: "price", minWidth: 70, sortable: "custom" },
		{ label: "评论数量", prop: "review_num", minWidth: 50, sortable: "custom" },
		{
			label: "星级",
			prop: "last_star",
			minWidth: 50,
			// component: {name: "el-rate", props: {disabled: true, 'show-score': true}},
			sortable: "custom"
		},
		{
			label: "配送方*",
			prop: "dispatches_from",
			showOverflowTooltip: true,
			minWidth: 50,
			sortable: "custom",
			hidden: !is_admin.value
		},
		{
			label: "售卖方*",
			prop: "sold_by",
			minWidth: 50,
			sortable: "custom",
			hidden: !is_admin.value,
			showOverflowTooltip: true
		},
		{
			label: "配送类型",
			prop: "_distribution_type",
			minWidth: 60,
			formatter(row, column, value, index) {
				return appConfig.estimate_distribution_type(row.dispatches_from, row.sold_by);
			}
		},
		{ label: "卖点", prop: "bullet_points", minWidth: 50 },
		{ label: "BSR类目", prop: "bsr_category", minWidth: 140, showOverflowTooltip: true },
		{ label: "类目排名", prop: "bsr_rank", width: 100, sortable: "custom" },
		{ label: "BSR节点", prop: "bsr_node", minWidth: 140, showOverflowTooltip: true },
		{ label: "节点排名", prop: "bsr_node_rank", width: 100, sortable: "custom" },

		{ label: "尺寸", prop: "dimensions", width: 100, sortable: "custom" },
		{ label: "重量", prop: "weight", minWidth: 50, sortable: "custom" },
		{
			label: "上架时间",
			prop: "date_first_available",
			sortable: "custom",
			minWidth: 60,
			component: { name: "cl-date-text", props: { format: "YYYY-MM-DD" } }
		},
		{ label: "卖家国家", prop: "seller_country", minWidth: 90 },
		{ label: "开发人员", prop: "distinguish", minWidth: 90 },

		{
			label: "收录时间",
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
			sortable: "desc"
		},

		{
			type: "op",
			buttons: ["slot-management-buttons", "delete"],
			width: 230
		}
	],
	contextMenu: []
});

const Upsert = useUpsert({
	dialog: {
		width: "800",
		top: "8vh"
	},
	items: []
});

function formatCategoryOptionLabel(item: BsrCategoryOption) {
	return item.count ? `${item.label} (${item.count})` : item.label;
}

async function loadBsrCategoryOptions() {
	categoryLoading.value = true;
	try {
		const list = await (service.app.bsr_candidate as any).request({
			url: "/backlogCategories",
			method: "POST",
			data: {
				status: appConfig.BSR_CANDIDATE_STATUS.PENDING.value,
				archiveFilter: new Date(),
				distinguish: userStore.info?.name
			}
		});

		bsrCategoryOptions.value = Array.isArray(list) ? list : [];
	} catch (err) {
		ElMessage.error("类目加载失败");
		console.error(err);
	} finally {
		categoryLoading.value = false;
	}
}

function onBsrCategoryChange(value: string) {
	selectedBsrNode.value = "";
	Crud.value?.refresh({
		page: 1,
		bsr_category: value || undefined,
		bsr_node: undefined,
		prop: value ? "bsr_rank" : undefined,
		order: value ? "desc" : undefined
	});
}

function rankByBsrCategory(value: string) {
	const category = String(value || "").trim();
	if (!category) return;

	selectedBsrCategory.value = category;
	selectedBsrNode.value = "";
	Crud.value?.refresh({
		page: 1,
		bsr_category: category,
		bsr_node: undefined,
		prop: "bsr_rank",
		order: "desc"
	});
}

function rankByBsrNode(value: string) {
	const node = String(value || "").trim();
	if (!node) return;

	selectedBsrCategory.value = "";
	selectedBsrNode.value = node;
	Crud.value?.refresh({
		page: 1,
		bsr_category: undefined,
		bsr_node: node,
		prop: "bsr_node_rank",
		order: "desc"
	});
}

function clearBsrNodeRank() {
	selectedBsrNode.value = "";
	Crud.value?.refresh({
		page: 1,
		bsr_node: undefined,
		prop: undefined,
		order: undefined
	});
}

async function updateStatus(candidate, status: number) {
	let oldStatus = candidate?.status;
	let first_leg_freight = 20;

	// //税率
	let tax_rate = 0;
	if (candidate.marketplace === "英国") {
		tax_rate = 16.66;
	} else if (candidate.marketplace === "德国") {
		tax_rate = 15.96;
	} else if (candidate.marketplace === "法国") {
		tax_rate = 16.66;
	} else if (candidate.marketplace === "西班牙") {
		tax_rate = 17.35;
	} else if (candidate.marketplace === "意大利") {
		tax_rate = 18.03;
	}

	try {
		candidate.status = status;
		//
		if (status === 5) {
			await service.app.bsr_candidate.archiveWithImage({
				id: candidate.id,
				status,
				archive_hide_until: null // 永久归档
			});
		} else {
			await Crud.value?.service.update({
				id: candidate.id,
				status,
				first_leg_freight,
				tax_rate,
				source: 1
			});
		}
		ElMessage({ message: "更新状态成功", type: "success" });
		// await service.app.bsr_candidate.sync_from_FX();
	} catch (err) {
		candidate.status = oldStatus;
		ElMessage({ message: "更新状态失败，请刷新/重试。", type: "error" });
		console.log(err);
	}
}

function flexibleMapping(item: any) {
	// 定义中文字段与英文字段的映射关系
	const mapping: Record<string, string> = {
		ASIN: "asin",
		标题: "item_name",
		img_url_1: "image_url",
		img_url_2: "image_url2",
		img_url_3: "image_url3",
		img_url_4: "image_url4",
		img_url_5: "image_url5",
		img_url_6: "image_url6",
		价格: "price",
		评论数: "review_num",
		评分: "last_star",
		所属类目: "bsr_category",
		大类排名: "bsr_rank",
		所属节点: "bsr_node",
		节点排名: "bsr_node_rank",
		配送方: "dispatches_from",
		售卖方: "sold_by",
		长宽高: "dimensions",
		重量: "weight",
		首次上架时间: "date_first_available",
		国家: "marketplace",
		变体数: "variants",
		任务源网址: "task_url",
		卖家所属国: "seller_country",
		所属国: "seller_country",
		开发人区分: "distinguish"
		// "卖家ID":"seller_id"
	};

	const newItem: any = {};
	// 遍历映射关系，若上传数据中包含中文字段，则赋值到对应的英文字段
	Object.keys(mapping).forEach((chineseKey) => {
		if (item.hasOwnProperty(chineseKey)) {
			newItem[mapping[chineseKey]] = item[chineseKey];
		}
	});

	if (newItem.review_num) {
		// 只保留数字，删除其他非数字字符
		newItem.review_num = newItem.review_num.toString().replace(/\D/g, "");

		// 如果处理后的值为空，则设为0
		if (newItem.review_num === "") {
			newItem.review_num = 0;
		}
	}
	if (newItem.last_star) {
		// 只保留数字，删除其他非数字字符
		newItem.last_star = newItem.last_star.toString().replace(/\D/g, "");

		// 如果是两位数，则在中间加小数点
		if (newItem.last_star.length === 2) {
			newItem.last_star = newItem.last_star[0] + "." + newItem.last_star[1];
		}

		// 如果处理后的值为空，则设为0
		if (newItem.last_star === "") {
			newItem.last_star = 0;
		}
	}

	if (!newItem.review_num) {
		newItem.review_num = 0;
	}

	if (!newItem.last_star) {
		newItem.last_star = 0;
	}

	if (!newItem.bsr_category) {
		delete newItem.bsr_category;
	}
	if (!newItem.bsr_rank) {
		delete newItem.bsr_rank;
	}
	if (!newItem.bsr_node) {
		delete newItem.bsr_node;
	}
	if (!newItem.bsr_node_rank) {
		delete newItem.bsr_node_rank;
	}

	if (newItem.price) {
		// 1. 删除所有的换行符和转义字符 (包括 \\n 和 \n)
		newItem.price = newItem.price
			.toString()
			.replace(/\\n|\n/g, "")
			.trim();

		// 2. 保留小数点后两位的数字，超过两位的小数将被舍弃
		newItem.price = newItem.price.replace(/[^0-9.]/g, "").trim(); // 只保留数字和小数点

		// 3. 如果价格包含小数点，保留小数点后两位
		if (newItem.price.includes(".")) {
			newItem.price = newItem.price.substring(0, newItem.price.indexOf(".") + 3); // 保留两位小数
		}

		// 4. 如果价格无效或为空，设置为 0
		if (isNaN(newItem.price) || newItem.price === "") {
			newItem.price = 0;
		}
	}

	if (!newItem.price) {
		newItem.price = 0;
	}

	if (newItem.image_url) {
		// 使用正则表达式匹配 _AC_US 后接数字的部分，统一替换为 _AC_US500
		newItem.image_url = newItem.image_url.replace(/_AC_US\d+/g, "_AC_US1000");
		newItem.image_url = newItem.image_url.replace(/SS40+/g, "SS1000");
		newItem.image_url = newItem.image_url.replace(/_AC_SR\d+,?\d*/g, "_AC_SR1000,1000");
		newItem.image_url = newItem.image_url.replace(
			/_SX\d+_SY\d+_CR[^_]*_/,
			"_SX1000_SY1000_CR,0,0,1000,1000_"
		);
		newItem.image_url = newItem.image_url.replace(",", ".");
		newItem.aliyun_img = newItem.image_url;
	}

	if (newItem.image_url2) {
		// 使用正则表达式匹配 _AC_US 后接数字的部分，统一替换为 _AC_US500
		newItem.image_url2 = newItem.image_url2.replace(/_AC_US\d+/g, "_AC_US1000");
		newItem.image_url2 = newItem.image_url2.replace(/SS40+/g, "SS1000");
		newItem.image_url2 = newItem.image_url2.replace(/_AC_SR\d+,?\d*/g, "_AC_SR1000,1000");
		newItem.image_url2 = newItem.image_url2.replace(
			/_SX\d+_SY\d+_CR[^_]*_/,
			"_SX1000_SY1000_CR,0,0,1000,1000_"
		);
		newItem.image_url2 = newItem.image_url2.replace(",", ".");
	}

	if (newItem.image_url3) {
		// 使用正则表达式匹配 _AC_US 后接数字的部分，统一替换为 _AC_US500
		newItem.image_url3 = newItem.image_url3.replace(/_AC_US\d+/g, "_AC_US1000");
		newItem.image_url3 = newItem.image_url3.replace(/SS40+/g, "SS1000");
		newItem.image_url3 = newItem.image_url3.replace(/_AC_SR\d+,?\d*/g, "_AC_SR1000,1000");
		newItem.image_url3 = newItem.image_url3.replace(
			/_SX\d+_SY\d+_CR[^_]*_/,
			"_SX1000_SY1000_CR,0,0,1000,1000_"
		);
		newItem.image_url3 = newItem.image_url3.replace(",", ".");
	}

	if (newItem.image_url4) {
		// 使用正则表达式匹配 _AC_US 后接数字的部分，统一替换为 _AC_US500
		newItem.image_url4 = newItem.image_url4.replace(/_AC_US\d+/g, "_AC_US1000");
		newItem.image_url4 = newItem.image_url4.replace(/SS40+/g, "SS1000");
		newItem.image_url4 = newItem.image_url4.replace(/_AC_SR\d+,?\d*/g, "_AC_SR1000,1000");
		newItem.image_url4 = newItem.image_url4.replace(
			/_SX\d+_SY\d+_CR[^_]*_/,
			"_SX1000_SY1000_CR,0,0,1000,1000_"
		);
		newItem.image_url4 = newItem.image_url4.replace(",", ".");
	}

	if (newItem.image_url5) {
		// 使用正则表达式匹配 _AC_US 后接数字的部分，统一替换为 _AC_US500
		newItem.image_url5 = newItem.image_url5.replace(/_AC_US\d+/g, "_AC_US1000");
		newItem.image_url5 = newItem.image_url5.replace(/SS40+/g, "SS1000");
		newItem.image_url5 = newItem.image_url5.replace(/_AC_SR\d+,?\d*/g, "_AC_SR1000,1000");
		newItem.image_url5 = newItem.image_url5.replace(
			/_SX\d+_SY\d+_CR[^_]*_/,
			"_SX1000_SY1000_CR,0,0,1000,1000_"
		);
		newItem.image_url5 = newItem.image_url5.replace(",", ".");
	}

	if (newItem.image_url6) {
		// 使用正则表达式匹配 _AC_US 后接数字的部分，统一替换为 _AC_US500
		newItem.image_url6 = newItem.image_url6.replace(/_AC_US\d+/g, "_AC_US1000");
		newItem.image_url6 = newItem.image_url6.replace(/SS40+/g, "SS1000");
		newItem.image_url6 = newItem.image_url6.replace(/_AC_SR\d+,?\d*/g, "_AC_SR1000,1000");
		newItem.image_url6 = newItem.image_url6.replace(
			/_SX\d+_SY\d+_CR[^_]*_/,
			"_SX1000_SY1000_CR,0,0,1000,1000_"
		);
		newItem.image_url6 = newItem.image_url6.replace(",", ".");
	}
	// 另外，如果数据中本身已经存在英文字段，也一并保留
	Object.values(mapping).forEach((key) => {
		if (!newItem[key] && item.hasOwnProperty(key)) {
			newItem[key] = item[key];
		}
	});

	// 处理 dimensions (替换逗号, 并加上 cm)
	if (newItem.dimensions) {
		newItem.dimensions = newItem.dimensions.replace(/,/g, ".").replace(/\s*x\s*/g, "x") + " cm";
	}

	// 处理 weight (替换逗号, 并加上重量单位)
	if (newItem.weight) {
		newItem.weight = newItem.weight.toString().replace(/,/g, ".");
		if (item["重量单位"]) {
			const unitMap: Record<string, string> = { Kilogramm: "kg", Gramm: "g" };
			newItem.weight += unitMap[item["重量单位"]] || item["重量单位"];
		}
	}

	// 颜色变体数量和尺寸变体数量默认值设为1
	const colorVariants = newItem.color_variants ? Number(newItem.color_variants) : 1;
	const sizeVariants = newItem.size_variants ? Number(newItem.size_variants) : 1;
	newItem.variants = colorVariants * sizeVariants;

	// 组合 bsr_html
	if (newItem.bsr_category && newItem.bsr_rank && newItem.bsr_node && newItem.bsr_node_rank) {
		newItem.bsr_html = `所属类目：${newItem.bsr_category}\n类目排名：${newItem.bsr_rank}\n所属节点：${newItem.bsr_node}\n节点排名：${newItem.bsr_node_rank}`;
	}

	if (newItem.date_first_available && typeof newItem.date_first_available === "number") {
		// 将 Excel 序列号转换为标准日期字符串（YYYY-MM-DD）
		newItem.date_first_available = new Date(
			(newItem.date_first_available - 25569) * 86400 * 1000
		)
			.toISOString()
			.slice(0, 10);
	}

	// 处理 bullet_points，将“卖点1~卖点5”换行组合
	const bulletPoints: string[] = [];
	for (let i = 1; i <= 5; i++) {
		const key = `卖点${i}`;
		if (item.hasOwnProperty(key) && item[key]) {
			bulletPoints.push(item[key]);
		}
	}
	if (bulletPoints.length > 0) {
		newItem.bullet_points = bulletPoints.join("\n");
	}

	// 解析任务源网址，自动设置 marketplace
	if (newItem.task_url) {
		if (newItem.task_url.includes(".de")) {
			newItem.marketplace = "德国";
		} else if (newItem.task_url.includes(".uk") || newItem.task_url.includes("co.uk")) {
			newItem.marketplace = "英国";
		} else if (newItem.task_url.includes(".fr")) {
			newItem.marketplace = "法国";
		} else if (newItem.task_url.includes(".es")) {
			newItem.marketplace = "西班牙";
		} else if (newItem.task_url.includes(".it")) {
			newItem.marketplace = "意大利";
		}
	}

	return newItem;
}

// 分批提交数据
async function batchSubmit(dataList: any[], batchSize = 100) {
	// 按 batchSize 拆分数据
	const batches: any[][] = [];
	for (let i = 0; i < dataList.length; i += batchSize) {
		batches.push(dataList.slice(i, i + batchSize));
	}

	console.log(`共分成 ${batches.length} 批次提交`);

	for (let index = 0; index < batches.length; index++) {
		const batch = batches[index];

		try {
			console.log(`正在提交第 ${index + 1} 批数据，共 ${batch.length} 条`);
			await service.app.bsr_candidate.add(batch);
			console.log(`第 ${index + 1} 批数据提交成功`);
		} catch (err: any) {
			console.error(`第 ${index + 1} 批提交失败:`, err);
			ElMessage.error(`第 ${index + 1} 批提交失败: ${err.message || "未知错误"}`);
			return Promise.reject(err);
		}
	}

	return Promise.resolve();
}

// 在 onSubmit 中调用 batchSubmit
function onSubmit(data: any, { close }: any) {
	data.list = data.list.map((item: any, index: number) => {
		let newItem = flexibleMapping(item);
		// 注入默认值
		newItem.status = 2;
		newItem.competitor_spider_status = 0;
		return newItem;
	});

	// 分批提交
	batchSubmit(data.list, 100)
		.then(() => {
			ElMessage.success("所有数据已成功导入");
			loadBsrCategoryOptions();
			close();
		})
		.catch(() => {
			ElMessage.error("部分数据导入失败");
		});
}

// 新增归档处理方法
async function ignoreArchiveLater(row, months: number) {
	try {
		const hideUntil = new Date();
		hideUntil.setMonth(hideUntil.getMonth() + months);

		await service.app.bsr_candidate.update({
			id: row.id,
			status: 5,
			archive_hide_until: hideUntil
		});

		ElMessage.success(`已归档，${months}个月后自动显示`);
		Crud.value?.refresh();
	} catch (err) {
		ElMessage.error("操作失败");
		console.error(err);
	}
}

// 新增打开多链接方法
function openProductLinks(row: any) {
	// 原始产品链接
	const cleanAsin = row.asin.replace(/[^A-Z0-9]/g, "");
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, row.marketplace);

	// StyleSnap 链接（处理图片尺寸）
	// const styleSnapUrl = `https://www.amazon.co.uk/stylesnap?q=${row.image_url?.replace(/_AC_US\d+/, '_AC_US500') || ''}`;
	const styleSnapUrl = appConfig.get_amazon_url_picture_search(
		row.image_url?.replace(/_AC_US\d+/, "_AC_US500") || "",
		row.marketplace
	);
	// 搜索链接（处理标题关键词）
	const keywords = row.item_name
		?.split(/[\s,]+/) // 按空格和逗号分割
		?.filter((_: string, i: number) => i > 0) // 跳过第一个单词
		?.slice(0, 5) // 取前5个单词
		?.join("+"); // 用加号连接

	// const searchUrl = `https://www.amazon.co.uk/s?k=${keywords || ''}`;
	const searchUrl = appConfig.get_amazon_url_keyword_search(keywords, row.marketplace);

	// 同时打开三个窗口
	window.open(dpUrl);
	window.open(styleSnapUrl);
	window.open(searchUrl);
}

// 新增打开多链接方法
function openProductLinks2(row: any) {
	const cleanAsin = row.asin.replace(/[^A-Z0-9]/g, "");
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, row.marketplace);
	window.open(dpUrl);
}
function swapMainImage(row: any, clickedField: string) {
	// 保存当前主图URL
	const temp = row.image_url;

	// 将被点击的图片设为新的主图
	row.image_url = row[clickedField];

	// 将原来的主图放到被点击的位置
	row[clickedField] = temp;

	// 更新显示用的主图（如果用到计算属性的话）
	row.image_url_display = convert_image_url(row.image_url);

	// 如果需要自动保存到服务器，可以在这里添加更新请求
	service.app.bsr_candidate.update(row);
}
</script>

<style scoped lang="scss">
.bsr-node-filter-tag {
	max-width: 320px;

	:deep(.el-tag__content) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}
</style>
