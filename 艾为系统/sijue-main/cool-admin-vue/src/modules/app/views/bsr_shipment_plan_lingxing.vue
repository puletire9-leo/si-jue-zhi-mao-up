<template>
	<cl-crud ref="Crud">
		<cl-row>
			<!-- 左侧操作 -->
			<cl-refresh-btn />

			<cl-flex1 />

			<!-- 筛选区域 -->
			<div class="filter-wrapper">
				<el-select
					v-model="filterStatus"
					placeholder="状态"
					clearable
					style="width: 120px"
					@change="handleFilter"
				>
					<el-option label="待审核" :value="0" />
					<el-option label="待处理" :value="5" />
					<el-option label="已处理" :value="10" />
					<el-option label="已驳回" :value="-5" />
				</el-select>

				<el-select
					v-model="filterMethod"
					placeholder="运输方式"
					clearable
					style="width: 120px"
					@change="handleFilter"
				>
					<el-option label="✈️ 空运" value="air" />
					<el-option label="🚢 海运" value="sea" />
					<el-option label="🚀 快递" value="express" />
					<el-option label="🚂 铁路" value="rail" />
				</el-select>

				<cl-search-key placeholder="搜索单号/MSKU/产品名" />
			</div>
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<!-- 产品信息 -->
				<template #column-product_name="{ scope }">
					<div class="product-info-cell">
						<div class="product-pic" v-viewer>
							<cl-image
								v-if="scope.row.small_image_url"
								:src="scope.row.small_image_url"
								:preview-src-list="[scope.row.pic_url || scope.row.small_image_url]"
								:size="44"
							/>
							<div v-else class="no-pic">
								<el-icon><PictureFilled /></el-icon>
							</div>
						</div>
						<div class="product-details">
							<div class="product-name" :title="scope.row.product_name || '-'">
								{{ scope.row.product_name || "-" }}
							</div>
							<div class="product-sku">
								SKU: <span>{{ scope.row.sku || "-" }}</span>
							</div>
							<div class="product-sku" style="color: #409eff">
								MSKU: <span>{{ scope.row.msku || "-" }}</span>
							</div>
						</div>
					</div>
				</template>

				<!-- 发货量 -->
				<template #column-shipment_plan_quantity="{ scope }">
					<span class="highlight-qty">{{ scope.row.shipment_plan_quantity || 0 }}</span>
				</template>

				<!-- 实际发货 -->
				<template #column-actual_qty="{ scope }">
					<div v-if="scope.row._actual && scope.row._actual.totalActualQty > 0">
						<el-popover placement="left" :width="340" trigger="hover">
							<template #reference>
								<div class="actual-qty-cell">
									<span class="actual-qty-number">{{
										scope.row._actual.totalActualQty
									}}</span>
									<el-tag
										:type="
											scope.row._actual.details[0]?.shipment_status === 2
												? 'success'
												: scope.row._actual.details[0]?.shipment_status ===
													  1
													? 'primary'
													: 'warning'
										"
										size="small"
										effect="light"
									>
										{{
											scope.row._actual.details[0]?.shipment_status_name ||
											"进行中"
										}}
									</el-tag>
								</div>
							</template>

							<!-- Popover 明细内容 -->
							<div style="padding-top: 4px">
								<!-- 1. 顶部：宏观掌握进度 -->
								<div style="margin-bottom: 12px">
									<div
										style="
											display: flex;
											justify-content: space-between;
											align-items: flex-end;
											margin-bottom: 4px;
										"
									>
										<div>
											<span
												style="
													font-size: 12px;
													color: #909399;
													margin-right: 4px;
												"
												>已发货</span
											>
											<span
												style="
													font-size: 18px;
													font-weight: bold;
													color: #67c23a;
													font-family: Tahoma, sans-serif;
												"
												>{{ scope.row._actual.totalActualQty || 0 }}</span
											>
										</div>
										<div style="font-size: 12px; color: #606266">
											计划发货量
											<span
												style="
													font-family: Tahoma, sans-serif;
													font-weight: bold;
												"
												>{{ scope.row.shipment_plan_quantity || 0 }}</span
											>
										</div>
									</div>
									<el-progress
										:percentage="
											Math.min(
												((scope.row._actual.totalActualQty || 0) /
													(scope.row.shipment_plan_quantity || 1)) *
													100,
												100
											)
										"
										:show-text="false"
										color="#67C23A"
										:stroke-width="6"
									/>
								</div>

								<!-- 2. 底部：追踪履约轨迹 (发货单列) -->
								<div
									style="max-height: 200px; overflow-y: auto; padding-right: 4px"
								>
									<div
										v-for="(detail, idx) in scope.row._actual.details"
										:key="idx"
										style="
											margin-bottom: 8px;
											padding: 10px;
											background: #fcfcfd;
											border: 1px solid #e4e7ed;
											border-radius: 6px;
										"
									>
										<div
											style="
												display: flex;
												justify-content: space-between;
												align-items: flex-start;
												margin-bottom: 8px;
											"
										>
											<div>
												<div
													style="
														display: flex;
														align-items: center;
														gap: 6px;
														margin-bottom: 2px;
													"
												>
													<span style="font-size: 14px">🚚</span>
													<span
														style="
															font-family:
																&quot;Consolas&quot;,
																&quot;Courier New&quot;, monospace;
															font-size: 14px;
															font-weight: bold;
															color: #303133;
														"
														>{{ detail.shipment_sn || "-" }}</span
													>
												</div>
												<div
													v-if="detail.shipment_id"
													style="
														font-size: 11px;
														color: #909399;
														margin-left: 20px;
													"
												>
													{{ detail.shipment_id }}
												</div>
											</div>
											<el-tag
												:type="
													detail.shipment_status === 2
														? 'success'
														: detail.shipment_status === 1
															? 'primary'
															: detail.shipment_status === 3
																? 'danger'
																: 'warning'
												"
												size="small"
												effect="light"
												style="border: none"
											>
												{{ detail.shipment_status_name || "-" }}
											</el-tag>
										</div>
										<div
											style="
												display: flex;
												justify-content: space-between;
												align-items: center;
												font-size: 12px;
												margin-left: 20px;
											"
										>
											<div style="color: #606266">
												<span style="color: #909399">数量:</span>
												<span
													style="
														color: #303133;
														font-weight: bold;
														font-family: Tahoma, sans-serif;
													"
													>{{ detail.shipment_list_quantity || 0 }}</span
												>
											</div>
											<div style="color: #606266">
												<span style="color: #909399">物流:</span>
												{{ detail.method_name || "-" }}
											</div>
											<div
												v-if="detail.shipment_time"
												style="color: #909399; font-size: 11px"
											>
												{{ detail.shipment_time.substring(5, 16) }}
											</div>
										</div>
									</div>
								</div>
							</div>
						</el-popover>
					</div>
					<span v-else class="no-actual">未发货</span>
				</template>

				<!-- 单据信息 -->
				<template #column-order_sn="{ scope }">
					<div class="parent-order-cell">
						<div class="parent-sn">批次: {{ scope.row.seq || "-" }}</div>
						<div class="parent-supplier">计划: {{ scope.row.order_sn || "-" }}</div>
						<div class="parent-supplier">
							FBA:
							<span
								:style="{
									color: scope.row.shipment_mws_sn ? '#E6A23C' : '#C0C4CC',
									fontFamily: 'monospace'
								}"
								>{{ scope.row.shipment_mws_sn || "未分配" }}</span
							>
						</div>
					</div>
				</template>

				<!-- 业务关联 -->
				<template #column-purchase_order_sn="{ scope }">
					<div class="parent-order-cell">
						<div class="parent-sn">
							采购单: {{ scope.row.purchase_order_sn || "-" }}
						</div>
						<div class="parent-supplier">
							子项号: {{ scope.row.purchase_plan_sn || "-" }}
						</div>
					</div>
				</template>

				<!-- 运输方式 -->
				<template #column-shipping_method="{ scope }">
					<div style="display: flex; align-items: center; gap: 4px">
						<span>{{ getMethodIcon(scope.row.shipping_method) }}</span>
						<span
							style="
								font-size: 13px;
								font-weight: 500;
								color: var(--el-text-color-primary);
							"
							>{{ getMethodLabel(scope.row.shipping_method) }}</span
						>
					</div>
				</template>

				<!-- 店铺/仓库 -->
				<template #column-sname="{ scope }">
					<div class="parent-order-cell">
						<div style="display: flex; align-items: center; gap: 4px; font-size: 12px">
							<span style="color: #67c23a">●</span>
							<span style="color: var(--el-text-color-primary)">{{
								scope.row.sname || "-"
							}}</span>
						</div>
						<div style="display: flex; align-items: center; gap: 4px; font-size: 12px">
							<span style="color: #e6a23c">◎</span>
							<span style="color: var(--el-text-color-regular)">{{
								scope.row.wname || "-"
							}}</span>
						</div>
					</div>
				</template>

				<!-- FBA绑定状态 -->
				<template #column-is_relate_mws="{ scope }">
					<el-tag :type="scope.row.is_relate_mws === 1 ? 'success' : 'info'" size="small">
						{{ scope.row.is_relate_mws === 1 ? "已绑定" : "未绑定" }}
					</el-tag>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>
	</cl-crud>
</template>

<script lang="ts" name="app-bsr_shipment_plan_lingxing" setup>
import { ref, nextTick, watch } from "vue";
import { useCrud, useTable } from "@cool-vue/crud";
import { useCool } from "/@/cool";

const { service } = useCool();

const filterStatus = ref<number | null>(null);
const filterMethod = ref<string>("");

// 存储实际发货数据的映射
const actualDataMap = ref<Record<string, any>>({});

// 状态标签样式
const getStatusType = (status: number) => {
	const map: Record<number, string> = {
		10: "success",
		5: "primary",
		0: "warning",
		"-5": "danger"
	};
	return map[status] || "info";
};

// 运输方式图标
const getMethodIcon = (method: string) => {
	const map: Record<string, string> = {
		air: "✈️",
		sea: "🚢",
		express: "🚀",
		rail: "🚂"
	};
	return map[method] || "📦";
};

// 运输方式中文名
const getMethodLabel = (method: string) => {
	const map: Record<string, string> = {
		air: "空运",
		sea: "海运",
		express: "快递",
		rail: "铁路"
	};
	return map[method] || method || "-";
};

/**
 * 页面数据加载完成后，批量查询实际发货数据并合并到每一行
 */
async function loadActualData(list: any[]) {
	if (!list || list.length === 0) return;

	// 收集当前页所有有效的 isp_id
	const ispIds = list
		.map((row: any) => row.isp_id)
		.filter((id: any) => id && id !== "0" && id !== "");

	if (ispIds.length === 0) return;

	try {
		const res = await service.app.bsr_shipment_actual_lingxing.getActualMetrics({
			ispIds
		});
		// res 的结构: { [isp_id]: { totalActualQty, details[] } }
		if (res) {
			actualDataMap.value = res;
			// 把实际发货数据挂到每一行上
			for (const row of list) {
				if (row.isp_id && res[row.isp_id]) {
					row._actual = res[row.isp_id];
				} else {
					row._actual = null;
				}
			}
		}
	} catch (e) {
		console.error("加载实际发货数据失败:", e);
	}
}

// cl-table
const Table = useTable({
	columns: [
		{ label: "#", type: "index", width: 50 },
		{
			label: "产品信息",
			prop: "product_name",
			minWidth: 280
		},
		{
			label: "计划发货量",
			prop: "shipment_plan_quantity",
			minWidth: 100,
			sortable: "custom"
		},
		{
			label: "实际发货",
			prop: "actual_qty",
			minWidth: 120
		},
		{
			label: "单据信息",
			prop: "order_sn",
			minWidth: 220
		},
		{
			label: "业务关联",
			prop: "purchase_order_sn",
			minWidth: 220
		},
		{
			label: "状态",
			prop: "status",
			minWidth: 100,
			dict: [
				{ label: "待审核", value: 0, type: "warning" },
				{ label: "待处理", value: 5, type: "primary" },
				{ label: "已处理", value: 10, type: "success" },
				{ label: "已驳回", value: -5, type: "danger" }
			],
			dictColor: true
		},
		{
			label: "运输",
			prop: "shipping_method",
			minWidth: 100
		},
		{
			label: "发货时间",
			prop: "shipment_time",
			minWidth: 110,
			sortable: "custom"
		},
		{
			label: "店铺/仓库",
			prop: "sname",
			minWidth: 150
		},
		{
			label: "FBA绑定",
			prop: "is_relate_mws",
			minWidth: 90
		},
		{
			label: "创建人",
			prop: "create_user",
			minWidth: 100
		},
		{
			label: "更新时间",
			prop: "last_sync_time",
			minWidth: 160,
			sortable: "custom",
			component: { name: "cl-date-text" }
		}
	]
});

// 筛选
const handleFilter = () => {
	const params: any = {};
	if (filterStatus.value !== null) params.status = filterStatus.value;
	if (filterMethod.value) params.shipping_method = filterMethod.value;
	Crud.value?.refresh(params);
};

// cl-crud
const Crud = useCrud(
	{
		service: service.app.bsr_shipment_plan_lingxing
	},
	(app) => {
		app.refresh();
	}
);

// 监听表格数据变化，自动加载实际发货数据
watch(
	() => Table.value?.data,
	(newData) => {
		if (newData && newData.length > 0) {
			loadActualData(newData);
		}
	},
	{ deep: false }
);
</script>

<style lang="scss" scoped>
.filter-wrapper {
	display: flex;
	align-items: center;
	gap: 10px;
}

// 产品视图样式
.product-info-cell {
	display: flex;
	gap: 10px;
	align-items: center;

	.product-pic {
		width: 44px;
		height: 44px;
		background-color: #f5f7fa;
		border-radius: 4px;
		border: 1px solid #ebeef5;
		flex-shrink: 0;
		cursor: zoom-in;
		overflow: hidden;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		.no-pic {
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			color: #c0c4cc;
			font-size: 18px;
		}
	}

	.product-details {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;

		.product-name {
			font-size: 13px;
			color: #303133;
			line-height: 1.4;
			overflow: hidden;
			text-overflow: ellipsis;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			line-clamp: 2;
		}

		.product-sku {
			font-size: 12px;
			color: #909399;

			span {
				font-family: monospace;
			}
		}
	}
}

.parent-order-cell {
	display: flex;
	flex-direction: column;
	gap: 4px;

	.parent-sn {
		font-size: 12px;
		font-family: monospace;
		font-weight: 500;
		color: #303133;
	}

	.parent-supplier {
		font-size: 12px;
		color: #909399;
	}
}

.highlight-qty {
	font-size: 15px;
	font-weight: bold;
	color: #409eff;
}

// 实际发货列样式
.actual-qty-cell {
	display: flex;
	align-items: center;
	gap: 6px;
	cursor: pointer;

	.actual-qty-number {
		font-size: 15px;
		font-weight: bold;
		color: #67c23a;
	}
}

.no-actual {
	font-size: 12px;
	color: #c0c4cc;
	font-style: italic;
}

// Popover 明细样式
.actual-popover {
	.actual-popover-title {
		font-size: 14px;
		font-weight: 600;
		color: #303133;
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid #ebeef5;

		.actual-popover-count {
			font-size: 12px;
			font-weight: 400;
			color: #909399;
			margin-left: 4px;
		}
	}

	.actual-detail-item {
		.detail-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 3px 0;
			font-size: 12px;

			.detail-label {
				color: #909399;
				flex-shrink: 0;
				width: 60px;
			}

			.detail-value {
				color: #303133;
				text-align: right;

				&.mono {
					font-family: monospace;
					font-size: 11px;
				}
			}
		}
	}
}
</style>
