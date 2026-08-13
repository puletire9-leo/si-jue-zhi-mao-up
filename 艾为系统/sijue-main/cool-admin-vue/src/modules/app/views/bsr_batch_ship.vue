<template>
	<div class="batch-ship-history-page">
		<div class="page-head">
			<div>
				<div class="page-title">批量发货历史</div>
				<div class="page-subtitle">
					按批次追踪发货计划，查看运输方式、产品、采购计划和采购单拆分。
				</div>
			</div>
			<div class="page-head-actions">
				<el-button :icon="Refresh" :loading="loading" @click="refreshList">刷新</el-button>
			</div>
		</div>

		<div class="filter-panel">
			<el-input
				v-model="filters.keyword"
				clearable
				placeholder="搜索批次号 / MSKU / ASIN / 产品 / 采购单 / 采购计划 / 领星批次"
				class="keyword-input"
				@keyup.enter="searchList"
			>
				<template #prefix>
					<el-icon><Search /></el-icon>
				</template>
			</el-input>
			<el-select v-model="filters.status" clearable placeholder="状态" class="filter-select">
				<el-option
					v-for="item in statusOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
			<el-select
				v-model="filters.method_key"
				clearable
				placeholder="运输方式"
				class="filter-select"
			>
				<el-option
					v-for="item in methodOptions"
					:key="item.key"
					:label="`${item.icon} ${item.label}`"
					:value="item.key"
				/>
			</el-select>
			<el-date-picker
				v-model="filters.date_range"
				type="daterange"
				value-format="YYYY-MM-DD"
				start-placeholder="开始日期"
				end-placeholder="结束日期"
				class="date-range"
			/>
			<el-switch
				v-model="filters.only_mine"
				active-text="只看我提交的"
				class="mine-switch"
			/>
			<div class="filter-actions">
				<el-button type="primary" :icon="Search" :loading="loading" @click="searchList">
					查询
				</el-button>
				<el-button @click="resetFilters">重置</el-button>
			</div>
		</div>

		<div v-loading="loading" class="batch-list">
			<el-empty v-if="!loading && batches.length === 0" description="暂无批量发货历史" />

			<div
				v-for="batch in batches"
				:key="batch.batch_no"
				class="batch-card"
				:class="{ 'has-failed': Number(batch.failed_total_qty) > 0 }"
			>
				<div class="batch-identity">
					<div class="batch-no-line">
						<span class="batch-no">{{ batch.batch_no }}</span>
						<el-tag :type="getStatusTagType(batch.status)" effect="light" round>
							{{ getStatusText(batch.status) }}
						</el-tag>
						<el-popover
							v-if="getBatchProductCount(batch) > 1"
							:width="620"
							placement="bottom-start"
							trigger="hover"
							popper-class="batch-product-popover"
						>
							<template #reference>
								<span class="product-count-badge is-hoverable">
									{{ formatNumber(getBatchProductCount(batch)) }} 个产品
								</span>
							</template>
							<div class="product-popover-content">
								<div class="product-popover-head">
									<strong>本批次产品</strong>
									<span>
										共 {{ formatNumber(getBatchProductCount(batch)) }} 个，当前预览
										{{ formatNumber(getBatchProductRows(batch).length) }} 个
									</span>
								</div>
								<el-table
									:data="getBatchProductRows(batch)"
									size="small"
									border
									max-height="280"
									class="product-popover-table"
								>
									<el-table-column label="产品" min-width="260">
										<template #default="{ row }">
											<div class="product-popover-product">
												<el-image
													v-if="row.product_img"
													:src="row.product_img"
													fit="contain"
													class="product-popover-img"
												/>
												<div>
													<strong>{{ row.product_name || "-" }}</strong>
													<span>MSKU {{ row.msku || "-" }}</span>
												</div>
											</div>
										</template>
									</el-table-column>
									<el-table-column label="成功" width="82" align="right">
										<template #default="{ row }">
											<strong class="success-text">{{ formatNumber(row.success_qty) }}</strong>
										</template>
									</el-table-column>
									<el-table-column label="失败" width="82" align="right">
										<template #default="{ row }">
											<strong :class="{ 'danger-text': Number(row.failed_qty) > 0 }">
												{{ formatNumber(row.failed_qty) }}
											</strong>
										</template>
									</el-table-column>
									<el-table-column label="方式" width="76" align="right">
										<template #default="{ row }">
											{{ formatNumber(row.method_count) }}
										</template>
									</el-table-column>
								</el-table>
								<div
									v-if="getBatchProductCount(batch) > getBatchProductRows(batch).length"
									class="product-popover-tip"
								>
									还有
									{{ formatNumber(getBatchProductCount(batch) - getBatchProductRows(batch).length) }}
									个产品未在预览中展示，可进入详情查看完整列表。
								</div>
							</div>
						</el-popover>
						<span v-else class="product-count-badge">
							{{ formatNumber(getBatchProductCount(batch)) }} 个产品
						</span>
					</div>
					<div class="batch-meta">
						<span>{{ getCreatorText(batch) }}</span>
						<span>提交 {{ formatDateTime(batch.create_time) }}</span>
						<span v-if="batch.finished_time">完成 {{ formatDateTime(batch.finished_time) }}</span>
					</div>
					<div class="product-preview">
						<template v-if="getBatchProductRows(batch).length">
							<div
								class="product-carousel-main"
								:class="{ 'is-scrollable': getBatchProductRows(batch).length > 1 }"
							>
								<button
									v-if="getBatchProductRows(batch).length > 1"
									type="button"
									class="product-nav-button"
									aria-label="向左查看产品"
									@click.stop="scrollProductTrack($event, -1)"
								>
									<el-icon><arrow-left /></el-icon>
								</button>

								<div class="product-carousel-window">
									<div class="product-carousel-track">
										<el-popover
											v-for="product in getBatchProductRows(batch)"
											:key="`${batch.batch_no}-${product.msku}-${product.asin}-${product.product_name}`"
											:width="380"
											placement="bottom-start"
											trigger="hover"
											:show-after="160"
											:hide-after="60"
											popper-class="batch-product-detail-popover"
										>
											<template #reference>
												<div
													class="product-mini-card"
													:class="{ 'has-failed': Number(product.failed_qty) > 0 }"
												>
													<el-image
														v-if="product.product_img"
														:src="product.product_img"
														fit="contain"
														class="product-mini-img"
													>
														<template #error>
															<div class="product-img-fallback">
																<el-icon><picture /></el-icon>
															</div>
														</template>
													</el-image>
													<div v-else class="product-img-fallback">
														<el-icon><picture /></el-icon>
													</div>

													<div class="product-mini-info">
														<div class="product-mini-name">
															{{ product.product_name || "-" }}
														</div>
														<div class="product-mini-meta">MSKU {{ product.msku || "-" }}</div>
														<div class="product-mini-stats">
															<span class="is-success">
																成功 {{ formatNumber(product.success_qty) }}
															</span>
															<span v-if="Number(product.failed_qty) > 0" class="is-danger">
																失败 {{ formatNumber(product.failed_qty) }}
															</span>
															<span>方式 {{ formatNumber(product.method_count) }}</span>
														</div>
													</div>
												</div>
											</template>

											<div class="product-detail-popover">
												<div class="product-detail-head">
													<el-image
														v-if="product.product_img"
														:src="product.product_img"
														fit="contain"
														class="product-detail-img"
													>
														<template #error>
															<div class="product-detail-img-fallback">
																<el-icon><picture /></el-icon>
															</div>
														</template>
													</el-image>
													<div v-else class="product-detail-img-fallback">
														<el-icon><picture /></el-icon>
													</div>
													<div>
														<strong>{{ product.product_name || "-" }}</strong>
														<span>产品信息</span>
													</div>
												</div>

												<div class="product-detail-grid">
													<span>MSKU</span>
													<strong>{{ product.msku || "-" }}</strong>
													<span>FNSKU</span>
													<strong>{{ product.fnsku || "-" }}</strong>
													<span>ASIN</span>
													<strong>{{ product.asin || "-" }}</strong>
												</div>

												<div class="product-detail-stats">
													<div>
														<span>成功</span>
														<strong class="is-success">{{ formatNumber(product.success_qty) }}</strong>
													</div>
													<div>
														<span>失败</span>
														<strong :class="{ 'is-danger': Number(product.failed_qty) > 0 }">
															{{ formatNumber(product.failed_qty) }}
														</strong>
													</div>
													<div>
														<span>运输方式</span>
														<strong>{{ formatNumber(product.method_count) }}</strong>
													</div>
												</div>
											</div>
										</el-popover>
									</div>
								</div>

								<button
									v-if="getBatchProductRows(batch).length > 1"
									type="button"
									class="product-nav-button"
									aria-label="向右查看产品"
									@click.stop="scrollProductTrack($event, 1)"
								>
									<el-icon><arrow-right /></el-icon>
								</button>
							</div>

							<div class="product-carousel-summary">
								<span>
									预览 {{ formatNumber(getBatchProductRows(batch).length) }} /
									{{ formatNumber(getBatchProductCount(batch)) }}
								</span>
								<em v-if="getUndisplayedProductCount(batch) > 0">
									另 {{ formatNumber(getUndisplayedProductCount(batch)) }} 个在详情
								</em>
								<em v-else>本批次产品</em>
							</div>
						</template>
						<div v-else class="product-preview-empty">暂无产品预览</div>
					</div>
				</div>

				<div class="batch-operation">
					<div class="batch-metrics">
						<div>
							<span>计划</span>
							<strong>{{ formatNumber(batch.planned_total_qty) }}</strong>
						</div>
						<div class="success">
							<span>成功</span>
							<strong>{{ formatNumber(batch.success_total_qty) }}</strong>
						</div>
						<div :class="{ danger: Number(batch.failed_total_qty) > 0 }">
							<span>失败</span>
							<strong>{{ formatNumber(batch.failed_total_qty) }}</strong>
						</div>
						<div>
							<span>产品</span>
							<strong>{{ formatNumber(batch.product_count) }}</strong>
						</div>
						<div>
							<span>方式</span>
							<strong>{{ formatNumber(batch.method_count) }}</strong>
						</div>
						<div>
							<span>采购计划</span>
							<strong>{{ formatNumber(batch.purchase_plan_count) }}</strong>
						</div>
						<div>
							<span>采购单</span>
							<strong>{{ formatNumber(batch.purchase_order_count) }}</strong>
						</div>
						<el-popover
							v-if="getLingxingSeqRows(batch).length"
							:width="560"
							placement="bottom-end"
							trigger="hover"
							popper-class="lingxing-seq-popover"
						>
							<template #reference>
								<div class="batch-seq-metric is-hoverable">
									<span>领星批次</span>
									<strong>{{ formatNumber(batch.lingxing_seq_count) }} 个</strong>
									<em>{{ getLingxingSeqPreview(batch) }}</em>
								</div>
							</template>
							<div class="seq-popover-content">
								<div class="seq-popover-head">
									<strong>领星发货批次</strong>
									<span>领星创建发货计划后返回的 RP 批次号数量。</span>
								</div>
								<el-table
									:data="getLingxingSeqRows(batch)"
									size="small"
									border
									max-height="280"
									class="seq-table"
								>
									<el-table-column prop="seq" label="领星批次" min-width="140" show-overflow-tooltip />
									<el-table-column label="运输方式" min-width="92">
										<template #default="{ row }">
											{{ getMethodIcon(row.method_key) }}
											{{ row.method_label || getMethodLabel(row.method_key) }}
										</template>
									</el-table-column>
									<el-table-column label="成功" width="82" align="right">
										<template #default="{ row }">
											<strong class="success-text">{{ formatNumber(row.success_qty) }}</strong>
										</template>
									</el-table-column>
									<el-table-column label="失败" width="82" align="right">
										<template #default="{ row }">
											<strong :class="{ 'danger-text': Number(row.failed_qty) > 0 }">
												{{ formatNumber(row.failed_qty) }}
											</strong>
										</template>
									</el-table-column>
									<el-table-column label="采购单" width="82" align="right">
										<template #default="{ row }">
											{{ formatNumber(row.purchase_order_count) }} 单
										</template>
									</el-table-column>
								</el-table>
							</div>
						</el-popover>
						<div v-else>
							<span>领星批次</span>
							<strong>{{ formatNumber(batch.lingxing_seq_count) }}</strong>
						</div>
					</div>

					<div class="method-summary-line">
						<span
							v-for="method in batch.method_summary || []"
							:key="`${batch.batch_no}-${method.method_key}`"
							class="method-pill"
							:class="{ failed: Number(method.failed_qty) > 0 }"
						>
							{{ getMethodIcon(method.method_key) }}
							{{ method.method_label || getMethodLabel(method.method_key) }}
							<strong>{{ formatNumber(method.success_qty || method.planned_qty) }}</strong>
							<em v-if="Number(method.failed_qty) > 0">失败 {{ formatNumber(method.failed_qty) }}</em>
						</span>
					</div>
				</div>

				<div class="batch-actions">
					<el-button
						type="primary"
						plain
						:icon="View"
						:loading="detailLoading && activeBatchNo === batch.batch_no"
						@click="openDetail(batch)"
					>
						查看详情
					</el-button>
					<el-button
						:icon="DocumentCopy"
						:loading="copyingBatchNo === batch.batch_no"
						@click="copyBatchInstruction(batch)"
					>
						复制仓库指令
					</el-button>
				</div>
			</div>
		</div>

		<div class="page-pagination">
			<el-pagination
				v-model:current-page="pagination.page"
				v-model:page-size="pagination.size"
				:total="pagination.total"
				:page-sizes="[10, 20, 50, 100]"
				layout="total, sizes, prev, pager, next, jumper"
				@size-change="fetchList"
				@current-change="fetchList"
			/>
		</div>

		<el-drawer
			v-model="detailVisible"
			:title="detailTitle"
			size="1080px"
			:append-to-body="true"
			class="batch-detail-drawer"
		>
			<div v-loading="detailLoading" class="detail-drawer-content">
				<el-empty v-if="!detailLoading && !currentDetail" description="暂无批次详情" />

				<template v-if="currentDetail">
					<div class="detail-overview">
						<div>
							<div class="detail-batch-no">{{ currentDetail.batch?.batch_no }}</div>
							<div class="detail-meta">
								<span>{{ getCreatorText(currentDetail.batch) }}</span>
								<span>提交 {{ formatDateTime(currentDetail.batch?.createTime || currentDetail.batch?.create_time) }}</span>
								<span v-if="currentDetail.batch?.finished_time">
									完成 {{ formatDateTime(currentDetail.batch.finished_time) }}
								</span>
							</div>
						</div>
						<el-tag :type="getStatusTagType(currentDetail.batch?.status)" effect="light" round>
							{{ getStatusText(currentDetail.batch?.status) }}
						</el-tag>
					</div>

					<div class="detail-stat-grid">
						<div>
							<span>计划</span>
							<strong>{{ formatNumber(currentDetail.summary?.planned_qty) }}</strong>
						</div>
						<div class="success">
							<span>成功</span>
							<strong>{{ formatNumber(currentDetail.summary?.success_qty) }}</strong>
						</div>
						<div :class="{ danger: Number(currentDetail.summary?.failed_qty) > 0 }">
							<span>失败</span>
							<strong>{{ formatNumber(currentDetail.summary?.failed_qty) }}</strong>
						</div>
						<div>
							<span>产品</span>
							<strong>{{ formatNumber(currentDetail.summary?.product_count) }}</strong>
						</div>
						<div>
							<span>运输方式</span>
							<strong>{{ formatNumber(currentDetail.summary?.method_count) }}</strong>
						</div>
						<div>
							<span>采购单</span>
							<strong>{{ formatNumber(currentDetail.summary?.purchase_order_count) }}</strong>
						</div>
					</div>

					<div class="detail-toolbar">
						<el-button type="primary" :icon="DocumentCopy" @click="copyCurrentDetailInstruction">
							复制整批指令
						</el-button>
						<el-button
							v-if="currentDetail.summary?.retryable_count"
							type="warning"
							plain
							@click="copyFailureList"
						>
							复制失败清单
						</el-button>
					</div>

					<div
						v-if="currentDetail.failed_items?.length || currentDetail.local_sync_failed_items?.length"
						class="failure-panel"
					>
						<div class="failure-title">需要关注的异常</div>
						<div
							v-for="item in currentDetail.failed_items || []"
							:key="`failed-${item.id}`"
							class="failure-row"
						>
							<span>{{ item.method_label || getMethodLabel(item.method_key) }} · {{ item.msku || item.asin || "-" }}</span>
							<strong>{{ item.purchase_order_sn || "-" }} / {{ formatNumber(item.ship_qty) }} 件</strong>
							<em>{{ item.error_message || "提交失败" }}</em>
						</div>
						<div
							v-for="item in currentDetail.local_sync_failed_items || []"
							:key="`sync-${item.id}`"
							class="failure-row"
						>
							<span>{{ item.method_label || getMethodLabel(item.method_key) }} · {{ item.msku || item.asin || "-" }}</span>
							<strong>{{ item.purchase_order_sn || "-" }} / {{ formatNumber(item.ship_qty) }} 件</strong>
							<em>{{ item.local_sync_error || "本地同步失败" }}</em>
						</div>
					</div>

					<el-collapse v-model="activeMethodNames" class="method-collapse">
						<el-collapse-item
							v-for="method in currentDetail.method_groups || []"
							:key="method.method_key"
							:name="method.method_key"
						>
							<template #title>
								<div class="method-collapse-title">
									<span class="method-title-main">
										{{ getMethodIcon(method.method_key) }}
										{{ method.method_label || getMethodLabel(method.method_key) }}
									</span>
									<el-tag size="small" type="info" effect="plain">
										计划 {{ formatNumber(method.planned_qty) }}
									</el-tag>
									<el-tag size="small" type="success" effect="light">
										成功 {{ formatNumber(method.success_qty) }}
									</el-tag>
									<el-tag
										v-if="Number(method.failed_qty) > 0"
										size="small"
										type="danger"
										effect="light"
									>
										失败 {{ formatNumber(method.failed_qty) }}
									</el-tag>
								</div>
							</template>

							<div class="method-detail-section">
								<div class="method-section-head">
									<div>
										<div class="section-title">
											{{ method.method_label || getMethodLabel(method.method_key) }} 仓库发货方案
										</div>
										<div class="section-sub">
											领星批次 {{ formatSeqs(method.seqs) || "-" }}
										</div>
									</div>
									<el-button
										size="small"
										:icon="DocumentCopy"
										@click.stop="copyMethodInstruction(method)"
									>
										复制本方式
									</el-button>
								</div>

								<div
									v-for="group in method.execution_groups || []"
									:key="group.group_key"
									class="execution-card"
								>
									<div class="execution-head">
										<div>
											<strong>
												{{ group.warehouse_name || "未填仓库" }}
												· {{ getPackingTypeText(group.packing_type) }}
												· {{ group.shipment_time || "未填发货日" }}
											</strong>
											<div v-if="group.batch_remark" class="batch-remark-line">
												<span>批次备注</span>
												<el-tooltip
													:content="group.batch_remark"
													placement="top-start"
													:show-after="240"
												>
													<strong>{{ group.batch_remark }}</strong>
												</el-tooltip>
											</div>
										</div>
										<div class="execution-total">
											成功 {{ formatNumber(group.success_qty) }} /
											计划 {{ formatNumber(group.planned_qty) }}
										</div>
									</div>

									<div class="product-ship-list">
										<div
											v-for="product in group.products || []"
											:key="`${group.group_key}-${product.msku}-${product.asin}`"
											class="ship-product-card"
										>
											<div class="ship-product-main">
												<el-image
													v-if="product.product_img"
													:src="product.product_img"
													fit="contain"
													class="ship-product-img"
												/>
												<div class="ship-product-info">
													<div class="ship-product-name" :title="product.product_name || '-'">
														{{ product.product_name || "-" }}
													</div>
													<div class="ship-product-sub">
														MSKU {{ product.msku || "-" }} / FNSKU {{ product.fnsku || "-" }} /
														ASIN {{ product.asin || "-" }}
													</div>
													<el-tooltip
														v-if="product.detail_remark"
														:content="product.detail_remark"
														placement="top-start"
														:show-after="240"
													>
														<div class="detail-remark">
															<span>明细备注</span>
															<strong>{{ product.detail_remark }}</strong>
														</div>
													</el-tooltip>
												</div>
												<div class="ship-product-qty">
													<strong>{{ formatNumber(product.success_qty || product.planned_qty) }}</strong>
													<span>件</span>
												</div>
											</div>

											<el-table
												:data="product.allocations || []"
												size="small"
												border
												class="allocation-table"
											>
												<el-table-column
													prop="purchase_plan_sn"
													label="采购计划"
													min-width="140"
													show-overflow-tooltip
												/>
												<el-table-column
													prop="purchase_order_sn"
													label="采购单"
													min-width="180"
													show-overflow-tooltip
												/>
												<el-table-column prop="lingxing_seq" label="领星批次" min-width="130" />
												<el-table-column prop="qty" label="数量" width="90">
													<template #default="{ row }">
														<strong>{{ formatNumber(row.qty) }}</strong>
													</template>
												</el-table-column>
												<el-table-column prop="status" label="状态" width="100">
													<template #default="{ row }">
														<el-tag :type="getStatusTagType(row.status)" size="small" effect="light">
															{{ getStatusText(row.status) }}
														</el-tag>
													</template>
												</el-table-column>
												<el-table-column label="异常" min-width="180" show-overflow-tooltip>
													<template #default="{ row }">
														{{ row.error_message || row.local_sync_error || "-" }}
													</template>
												</el-table-column>
											</el-table>
										</div>
									</div>
								</div>
							</div>
						</el-collapse-item>
					</el-collapse>
				</template>
			</div>
		</el-drawer>
	</div>
</template>

<script lang="ts" name="app-bsr_batch_ship" setup>
import { computed, onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import { ElMessage } from "element-plus";
import {
	ArrowLeft,
	ArrowRight,
	DocumentCopy,
	Picture,
	Refresh,
	Search,
	View
} from "@element-plus/icons-vue";
import { useCool } from "/@/cool";

type MethodSummary = {
	method_key: string;
	method_label: string;
	planned_qty: number;
	success_qty: number;
	failed_qty: number;
	product_count?: number;
};

type LingxingSeqSummary = {
	seq: string;
	method_key: string;
	method_label: string;
	planned_qty: number;
	success_qty: number;
	failed_qty: number;
	purchase_order_count: number;
};

type BatchHistoryRow = {
	id: number;
	batch_no: string;
	status: string;
	planned_total_qty: number;
	success_total_qty: number;
	failed_total_qty: number;
	local_sync_failed_qty: number;
	product_count: number;
	method_count: number;
	purchase_plan_count: number;
	purchase_order_count: number;
	lingxing_seq_count: number;
	retryable_count: number;
	retryable_qty: number;
	created_by_username: string;
	created_by_nickname: string;
	create_time: string;
	finished_time: string;
	method_summary: MethodSummary[];
	lingxing_seq_summary?: LingxingSeqSummary[];
	product_preview: {
		total: number;
		list: any[];
	};
};

type BatchHistoryDetail = {
	batch: any;
	summary: any;
	method_groups: any[];
	products: any[];
	failed_items: any[];
	local_sync_failed_items: any[];
};

const { service } = useCool();

const methodOptions = [
	{ key: "express", label: "快递", icon: "🚚" },
	{ key: "air", label: "空快", icon: "✈️" },
	{ key: "air_slow", label: "空慢", icon: "✈️" },
	{ key: "truck", label: "卡车", icon: "🚛" },
	{ key: "rail", label: "铁路", icon: "🚂" },
	{ key: "sea", label: "海运", icon: "🚢" }
];

const statusOptions = [
	{ label: "成功", value: "success" },
	{ label: "部分成功", value: "partial_failed" },
	{ label: "失败", value: "failed" },
	{ label: "提交中", value: "submitting" }
];

const filters = reactive({
	keyword: "",
	status: "",
	method_key: "",
	date_range: [] as string[],
	only_mine: false
});

const pagination = reactive({
	page: 1,
	size: 20,
	total: 0
});

const loading = ref(false);
const detailLoading = ref(false);
const batches = ref<BatchHistoryRow[]>([]);
const detailVisible = ref(false);
const currentDetail = ref<BatchHistoryDetail | null>(null);
const activeMethodNames = ref<string[]>([]);
const activeBatchNo = ref("");
const copyingBatchNo = ref("");

const detailTitle = computed(() => {
	return currentDetail.value?.batch?.batch_no
		? `发货批次 ${currentDetail.value.batch.batch_no}`
		: "批量发货详情";
});

onMounted(() => {
	void fetchList();
});

async function fetchList() {
	loading.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/bsr_batch_ship/batchHistoryPage",
			method: "POST",
			data: {
				page: pagination.page,
				size: pagination.size,
				keyword: filters.keyword,
				status: filters.status,
				method_key: filters.method_key,
				date_range: filters.date_range,
				only_mine: filters.only_mine
			}
		});
		batches.value = Array.isArray(res?.list) ? res.list : [];
		pagination.total = Number(res?.pagination?.total) || 0;
		pagination.page = Number(res?.pagination?.page) || pagination.page;
		pagination.size = Number(res?.pagination?.size) || pagination.size;
	} catch (error: any) {
		ElMessage.error(error?.message || "加载批量发货历史失败");
	} finally {
		loading.value = false;
	}
}

function searchList() {
	pagination.page = 1;
	void fetchList();
}

function refreshList() {
	void fetchList();
}

function resetFilters() {
	filters.keyword = "";
	filters.status = "";
	filters.method_key = "";
	filters.date_range = [];
	filters.only_mine = false;
	searchList();
}

function scrollProductTrack(event: MouseEvent, direction: -1 | 1) {
	const button = event.currentTarget as HTMLElement | null;
	const track = button
		?.closest(".product-carousel-main")
		?.querySelector<HTMLElement>(".product-carousel-track");
	if (!track) return;
	const scrollDistance = Math.max(172, Math.floor(track.clientWidth * 0.82));
	track.scrollBy({
		left: scrollDistance * direction,
		behavior: "smooth"
	});
}

async function openDetail(batch: BatchHistoryRow) {
	activeBatchNo.value = batch.batch_no;
	detailVisible.value = true;
	await loadDetail(batch.batch_no);
}

async function loadDetail(batchNo: string) {
	if (!batchNo) return null;
	detailLoading.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/bsr_batch_ship/batchHistoryDetail",
			method: "POST",
			data: { batch_no: batchNo }
		});
		currentDetail.value = res || null;
		activeMethodNames.value = (currentDetail.value?.method_groups || [])
			.slice(0, 1)
			.map((method: any) => method.method_key);
		return currentDetail.value;
	} catch (error: any) {
		ElMessage.error(error?.message || "加载批次详情失败");
		return null;
	} finally {
		detailLoading.value = false;
	}
}

async function copyBatchInstruction(batch: BatchHistoryRow) {
	copyingBatchNo.value = batch.batch_no;
	try {
		const detail = await loadDetail(batch.batch_no);
		if (!detail) return;
		await copyTextToClipboard(buildBatchInstruction(detail), "已复制整批仓库指令");
	} finally {
		copyingBatchNo.value = "";
	}
}

function copyCurrentDetailInstruction() {
	if (!currentDetail.value) return;
	void copyTextToClipboard(buildBatchInstruction(currentDetail.value), "已复制整批仓库指令");
}

function copyMethodInstruction(method: any) {
	if (!currentDetail.value) return;
	const instruction = buildMethodInstruction(method);
	if (!instruction) {
		ElMessage.warning("该运输方式没有成功创建的发货项，已排除失败项");
		return;
	}
	void copyTextToClipboard(
		instruction,
		`已复制${method?.method_label || getMethodLabel(method?.method_key)}仓库指令`
	);
}

function copyFailureList() {
	if (!currentDetail.value) return;
	const rows = [
		...(currentDetail.value.failed_items || []),
		...(currentDetail.value.local_sync_failed_items || [])
	];
	const text = [
		"【批量发货失败清单】",
		`批次：${currentDetail.value.batch?.batch_no || "-"}`,
		`创建：${getCreatorText(currentDetail.value.batch)} / ${formatDateTime(currentDetail.value.batch?.createTime)}`,
		"",
		...rows.map((item, index) => {
			return `${index + 1}. ${item.method_label || getMethodLabel(item.method_key)} / ${item.msku || item.asin || "-"} / ${item.purchase_order_sn || "-"} / ${formatNumber(item.ship_qty)}件 / ${item.error_message || item.local_sync_error || "失败"}`;
		})
	].join("\n");
	void copyTextToClipboard(text, "已复制失败清单");
}

function buildBatchInstruction(detail: BatchHistoryDetail) {
	const batch = detail.batch || {};
	const lines = [
		"【批量发货仓库指令】",
		`批次：${batch.batch_no || "-"}`,
		`创建：${getCreatorText(batch)} / ${formatDateTime(batch.createTime || batch.create_time)}`,
		`合计：计划 ${formatNumber(detail.summary?.planned_qty)} 件｜成功 ${formatNumber(detail.summary?.success_qty)} 件｜失败 ${formatNumber(detail.summary?.failed_qty)} 件`,
		Number(detail.summary?.failed_qty) > 0
			? "说明：本仓库指令仅包含成功创建的发货项，失败项请勿发货。"
			: ""
	];
	const methodTexts: string[] = [];
	for (const method of detail.method_groups || []) {
		const methodText = buildMethodInstruction(method);
		if (methodText) methodTexts.push(methodText);
	}
	if (!methodTexts.length) {
		lines.push("", "暂无成功创建的仓库执行项。");
		return lines.filter((line) => line !== "").join("\n");
	}
	methodTexts.forEach((methodText) => {
		lines.push("", methodText);
	});
	return lines.join("\n");
}

function buildMethodInstruction(method: any) {
	const methodTitle = `${getMethodIcon(method.method_key)} ${method.method_label || getMethodLabel(method.method_key)}`;
	const executionGroups = getSuccessfulExecutionGroups(method);
	if (!executionGroups.length) return "";
	const lines = [
		`【${methodTitle}】${formatNumber(getInstructionGroupTotal(executionGroups, "success_qty"))} 件`,
		`状态：成功 ${formatNumber(method.success_qty)} 件｜失败 ${formatNumber(method.failed_qty)} 件${Number(method.failed_qty) > 0 ? "（失败项未包含）" : ""}`,
		`领星批次：${formatSeqs(getSuccessfulSeqs(executionGroups)) || "-"}`
	];

	for (const group of executionGroups) {
		lines.push("");
		lines.push(`仓库：${group.warehouse_name || "-"}`);
		lines.push(`包装：${getPackingTypeText(group.packing_type)}`);
		lines.push(`发货日：${group.shipment_time || "-"}`);
		if (group.batch_remark) lines.push(`批次备注：${group.batch_remark}`);
		for (const product of getSuccessfulProducts(group)) {
			const successAllocations = getSuccessfulAllocations(product.allocations);
			lines.push("");
			lines.push("商品：");
			lines.push(`MSKU：${product.msku || "-"}`);
			lines.push(`FNSKU：${product.fnsku || "-"}`);
			lines.push(`ASIN：${product.asin || "-"}`);
			lines.push(`数量：${formatNumber(getInstructionAllocationTotal(successAllocations))} 件`);
			if (product.detail_remark) lines.push(`商品备注：${product.detail_remark}`);
			lines.push("采购单拆分：");
			successAllocations.forEach((allocation: any, index: number) => {
				if (index > 0) lines.push("");
				lines.push(
					`${index + 1}. ${allocation.purchase_order_sn || "-"}`
				);
				lines.push(`   计划：${allocation.purchase_plan_sn || "-"}`);
				lines.push(`   数量：${formatNumber(allocation.qty)} 件`);
				lines.push(`   领星批次：${allocation.lingxing_seq || "-"}`);
				lines.push(`   状态：${getStatusText(allocation.status)}`);
			});
		}
	}
	return lines.join("\n");
}

function getSuccessfulAllocations(allocations: any[]) {
	return (Array.isArray(allocations) ? allocations : []).filter(
		(allocation) => allocation?.status === "success" && Number(allocation?.qty) > 0
	);
}

function getSuccessfulProducts(group: any) {
	return (Array.isArray(group?.products) ? group.products : []).filter(
		(product) => getSuccessfulAllocations(product?.allocations).length > 0
	);
}

function getSuccessfulExecutionGroups(method: any) {
	return (Array.isArray(method?.execution_groups) ? method.execution_groups : []).filter(
		(group) => getSuccessfulProducts(group).length > 0
	);
}

function getSuccessfulSeqs(groups: any[]) {
	const seqs = new Set<string>();
	for (const group of groups || []) {
		for (const product of getSuccessfulProducts(group)) {
			for (const allocation of getSuccessfulAllocations(product.allocations)) {
				const seq = String(allocation?.lingxing_seq || "").trim();
				if (seq) seqs.add(seq);
			}
		}
	}
	return Array.from(seqs);
}

function getInstructionAllocationTotal(allocations: any[]) {
	return getSuccessfulAllocations(allocations).reduce(
		(sum, allocation) => sum + (Number(allocation?.qty) || 0),
		0
	);
}

function getInstructionGroupTotal(groups: any[], key: string) {
	return (groups || []).reduce((sum, group) => sum + (Number(group?.[key]) || 0), 0);
}

async function copyTextToClipboard(text: string, successMessage = "已复制") {
	try {
		if (navigator?.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
		} else {
			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			document.body.appendChild(textarea);
			textarea.select();
			const copied = document.execCommand("copy");
			document.body.removeChild(textarea);
			if (!copied) throw new Error("copy failed");
		}
		ElMessage.success(successMessage);
	} catch (error) {
		ElMessage.error("复制失败，请手动复制");
	}
}

function getMethodInfo(key: string) {
	return methodOptions.find((method) => method.key === key) || null;
}

function getMethodIcon(key: string) {
	return getMethodInfo(key)?.icon || "📦";
}

function getMethodLabel(key: string) {
	return getMethodInfo(key)?.label || key || "未知方式";
}

function getStatusText(status: any) {
	const key = String(status || "");
	const map: Record<string, string> = {
		success: "成功",
		partial_failed: "部分成功",
		failed: "失败",
		submitting: "提交中",
		pending: "待提交",
		skipped: "跳过"
	};
	return map[key] || key || "-";
}

function getStatusTagType(status: any) {
	const key = String(status || "");
	if (key === "success") return "success";
	if (key === "partial_failed" || key === "submitting" || key === "pending") return "warning";
	if (key === "failed") return "danger";
	return "info";
}

function getCreatorText(row: any) {
	return row?.created_by_nickname || row?.created_by_username || "未知人员";
}

function getPackingTypeText(value: any) {
	const num = Number(value);
	if (num === 1) return "混装商品";
	if (num === 2) return "原厂包装商品";
	return "-";
}

function getLingxingSeqRows(batch: any): LingxingSeqSummary[] {
	return Array.isArray(batch?.lingxing_seq_summary)
		? batch.lingxing_seq_summary.filter((row: any) => row?.seq)
		: [];
}

function getLingxingSeqPreview(batch: any) {
	const rows = getLingxingSeqRows(batch);
	if (!rows.length) return "-";
	if (rows.length === 1) return rows[0].seq;
	return `${rows[0].seq} 等`;
}

function getBatchProductRows(batch: any) {
	return Array.isArray(batch?.product_preview?.list) ? batch.product_preview.list : [];
}

function getBatchProductCount(batch: any) {
	return Number(batch?.product_preview?.total) || Number(batch?.product_count) || 0;
}

function getUndisplayedProductCount(batch: any) {
	return Math.max(getBatchProductCount(batch) - getBatchProductRows(batch).length, 0);
}

function formatNumber(value: any) {
	const num = Number(value);
	return Number.isFinite(num) ? Math.round(num).toLocaleString() : "0";
}

function formatDateTime(value: any) {
	if (!value) return "-";
	const date = dayjs(value);
	return date.isValid() ? date.format("YYYY-MM-DD HH:mm") : String(value);
}

function formatSeqs(values: any[]) {
	const list = Array.isArray(values) ? values.filter(Boolean) : [];
	return list.join(" / ");
}
</script>

<style lang="scss" scoped>
.batch-ship-history-page {
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-height: 100%;
	padding: 14px;
	background: #f5f7fb;
	color: #303133;
}

.page-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	padding: 2px 2px 0;
}

.page-title {
	color: #1f2d3d;
	font-size: 20px;
	font-weight: 700;
	line-height: 1.3;
}

.page-subtitle {
	margin-top: 4px;
	color: #909399;
	font-size: 12px;
}

.filter-panel,
.batch-card {
	border: 1px solid #dfe7f2;
	border-radius: 8px;
	background: #fff;
}

.filter-panel {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
}

.keyword-input {
	flex: 1 1 420px;
	min-width: 320px;
}

.filter-select {
	flex: 0 0 130px;
}

.date-range {
	flex: 0 0 300px;
}

.mine-switch {
	flex: 0 0 auto;
	margin-left: auto;
	white-space: nowrap;
}

.filter-actions {
	display: flex;
	flex: 0 0 auto;
	justify-content: flex-end;
	gap: 8px;
}

.batch-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-height: 260px;
}

.batch-card {
	display: grid;
	grid-template-columns: minmax(290px, 0.58fr) minmax(520px, 1.2fr) 146px;
	align-items: stretch;
	gap: 12px;
	padding: 12px 14px;
	box-shadow: 0 1px 4px rgba(31, 45, 61, 0.035);
	transition:
		border-color 0.18s,
		box-shadow 0.18s,
		transform 0.18s;
}

.batch-card:hover {
	border-color: #c6d8f2;
	box-shadow: 0 4px 14px rgba(31, 45, 61, 0.08);
	transform: translateY(-1px);
}

.batch-card.has-failed {
	border-color: #f8c7c7;
	background: linear-gradient(90deg, #fff7f7 0, #fff 78px);
}

.batch-identity,
.batch-operation {
	min-width: 0;
}

.batch-identity {
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	gap: 8px;
	padding-right: 12px;
	border-right: 1px solid #edf1f7;
}

.batch-no-line,
.detail-overview,
.method-section-head,
.execution-head,
.ship-product-main {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}

.batch-no-line {
	justify-content: flex-start;
	gap: 8px;
	min-width: 0;
}

.product-count-badge {
	display: inline-flex;
	flex: 0 0 auto;
	align-items: center;
	min-height: 22px;
	padding: 0 8px;
	border: 1px solid #d9ecff;
	border-radius: 999px;
	background: #f4f9ff;
	color: #1677ff;
	font-size: 12px;
	font-weight: 700;
	white-space: nowrap;
}

.product-count-badge.is-hoverable {
	cursor: help;
}

.batch-no,
.detail-batch-no {
	min-width: 0;
	overflow: hidden;
	color: #1f2d3d;
	font-size: 16px;
	font-weight: 800;
	letter-spacing: 0;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.batch-meta,
.detail-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 6px 10px;
	color: #909399;
	font-size: 12px;
	line-height: 1.25;
}

.batch-operation {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 8px;
}

.batch-metrics,
.detail-stat-grid {
	display: grid;
	grid-template-columns: repeat(8, minmax(70px, 1fr));
	gap: 4px;
}

.batch-metrics > div,
.detail-stat-grid > div {
	min-width: 0;
	padding: 5px 6px;
	border: 1px solid #eef2f7;
	border-radius: 5px;
	background: #f7f9fc;
	text-align: center;
}

.batch-metrics span,
.detail-stat-grid span {
	display: block;
	color: #909399;
	font-size: 11px;
}

.batch-metrics strong,
.detail-stat-grid strong {
	display: block;
	margin-top: 1px;
	color: #303133;
	font-size: 14px;
	line-height: 1.1;
}

.batch-seq-metric {
	cursor: help;
}

.batch-seq-metric em {
	display: block;
	max-width: 100%;
	margin-top: 2px;
	overflow: hidden;
	color: #1677ff;
	font-size: 10px;
	font-style: normal;
	line-height: 1.15;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.batch-seq-metric.is-hoverable {
	border-color: #d9ecff;
	background: #f5faff;
}

.batch-metrics .success strong,
.detail-stat-grid .success strong {
	color: #67c23a;
}

.batch-metrics .danger strong,
.detail-stat-grid .danger strong {
	color: #f56c6c;
}

.method-summary-line {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	min-height: 28px;
}

.method-pill {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	min-height: 24px;
	padding: 0 7px;
	border: 1px solid #d9ecff;
	border-radius: 5px;
	background: #f5faff;
	color: #1677ff;
	font-size: 12px;
}

.method-pill strong {
	color: #1677ff;
}

.method-pill em {
	color: #f56c6c;
	font-style: normal;
}

.method-pill.failed {
	border-color: #fde2e2;
	background: #fef0f0;
}

.product-preview {
	display: flex;
	flex-direction: column;
	gap: 5px;
	min-width: 0;
}

.product-carousel-main {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	align-items: center;
	min-width: 0;
	gap: 6px;
}

.product-carousel-main.is-scrollable {
	grid-template-columns: 24px minmax(0, 1fr) 24px;
}

.product-nav-button {
	display: inline-flex;
	flex: 0 0 auto;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 52px;
	padding: 0;
	border: 1px solid #dfe7f2;
	border-radius: 6px;
	background: #fff;
	color: #7a8798;
	cursor: pointer;
	transition:
		border-color 0.16s,
		background 0.16s,
		color 0.16s,
		box-shadow 0.16s;
}

.product-nav-button:hover {
	border-color: #b9d8ff;
	background: #f4f9ff;
	color: #1677ff;
	box-shadow: 0 2px 8px rgba(22, 119, 255, 0.1);
}

.product-carousel-window {
	position: relative;
	min-width: 0;
	overflow: hidden;
}

.product-carousel-window::before,
.product-carousel-window::after {
	position: absolute;
	top: 0;
	z-index: 2;
	width: 16px;
	height: 100%;
	pointer-events: none;
	content: "";
}

.product-carousel-window::before {
	left: 0;
	background: linear-gradient(90deg, #fff 0%, rgba(255, 255, 255, 0) 100%);
}

.product-carousel-window::after {
	right: 0;
	background: linear-gradient(270deg, #fff 0%, rgba(255, 255, 255, 0) 100%);
}

.product-carousel-track {
	display: flex;
	gap: 7px;
	min-width: 0;
	padding: 1px 2px 2px;
	overflow: hidden;
	overflow-x: auto;
	scroll-behavior: smooth;
	scroll-snap-type: x proximity;
	scrollbar-width: none;
}

.product-carousel-track::-webkit-scrollbar {
	display: none;
}

.product-mini-card {
	display: grid;
	flex: 0 0 178px;
	grid-template-columns: 42px minmax(0, 1fr);
	align-items: center;
	gap: 8px;
	min-height: 58px;
	padding: 7px;
	border: 1px solid #e6edf7;
	border-radius: 7px;
	background: linear-gradient(180deg, #fff 0%, #f9fbff 100%);
	cursor: help;
	scroll-snap-align: start;
	transition:
		border-color 0.16s,
		background 0.16s,
		box-shadow 0.16s,
		transform 0.16s;
}

.product-mini-card:hover {
	border-color: #b9d8ff;
	background: #fff;
	box-shadow: 0 4px 12px rgba(31, 45, 61, 0.1);
	transform: translateY(-1px);
}

.product-mini-card.has-failed {
	border-color: #f8d6d6;
	background: linear-gradient(180deg, #fffafa 0%, #fff 100%);
}

.product-mini-img,
.product-img-fallback,
.ship-product-img {
	flex: 0 0 auto;
	width: 42px;
	height: 42px;
	border: 1px solid #ebeef5;
	border-radius: 6px;
	background: #fff;
}

.product-img-fallback {
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f7f9fc;
	color: #b5bfcc;
	font-size: 18px;
}

.product-mini-info,
.ship-product-info {
	min-width: 0;
}

.product-mini-name,
.ship-product-name {
	overflow: hidden;
	color: #303133;
	font-size: 12px;
	font-weight: 700;
	line-height: 1.25;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.product-mini-meta,
.product-sub,
.ship-product-sub,
.section-sub {
	margin-top: 3px;
	overflow: hidden;
	color: #909399;
	font-size: 11px;
	line-height: 1.2;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.product-mini-stats {
	display: flex;
	align-items: center;
	gap: 5px;
	min-width: 0;
	margin-top: 5px;
	overflow: hidden;
	font-size: 11px;
	line-height: 1;
	white-space: nowrap;
}

.product-mini-stats span {
	color: #909399;
}

.product-mini-stats .is-success {
	color: #529b2e;
	font-weight: 700;
}

.product-mini-stats .is-danger {
	color: #f56c6c;
	font-weight: 700;
}

.product-carousel-summary {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-height: 16px;
	padding: 0 30px;
	color: #606266;
	font-size: 11px;
	line-height: 1.2;
	white-space: nowrap;
}

.product-carousel-summary em {
	color: #1677ff;
	font-style: normal;
	font-weight: 600;
}

.product-preview-empty {
	display: flex;
	align-items: center;
	min-height: 52px;
	padding: 0 10px;
	border: 1px dashed #dfe7f2;
	border-radius: 7px;
	background: #fbfcff;
	color: #a8abb2;
	font-size: 12px;
}

.batch-actions {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 8px;
	min-width: 0;
	padding-left: 12px;
	border-left: 1px solid #edf1f7;
}

.batch-actions :deep(.el-button) {
	width: 100%;
	margin-left: 0;
}

.page-pagination {
	display: flex;
	justify-content: flex-end;
	padding: 4px 2px 0;
}

:deep(.batch-detail-drawer .el-drawer__body) {
	padding: 0;
	background: #f5f7fb;
}

.detail-drawer-content {
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-height: 100%;
	padding: 16px;
}

.detail-overview,
.detail-stat-grid,
.detail-toolbar,
.failure-panel,
.method-collapse {
	border: 1px solid #dfe7f2;
	border-radius: 8px;
	background: #fff;
}

.detail-overview {
	padding: 14px 16px;
}

.detail-stat-grid {
	grid-template-columns: repeat(6, minmax(0, 1fr));
	margin-top: 0;
	padding: 10px;
}

.detail-toolbar {
	display: flex;
	gap: 8px;
	padding: 10px 12px;
}

.failure-panel {
	padding: 12px;
}

.failure-title {
	margin-bottom: 8px;
	color: #f56c6c;
	font-weight: 700;
}

.failure-row {
	display: grid;
	grid-template-columns: 220px 220px minmax(0, 1fr);
	gap: 8px;
	padding: 8px 0;
	border-top: 1px solid #ebeef5;
	color: #606266;
	font-size: 12px;
}

.failure-row em {
	overflow: hidden;
	color: #f56c6c;
	font-style: normal;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.method-collapse {
	overflow: hidden;
}

:deep(.method-collapse .el-collapse-item__header) {
	min-height: 50px;
	padding: 0 14px;
	background: #fbfdff;
}

:deep(.method-collapse .el-collapse-item__content) {
	padding: 0;
}

.method-collapse-title {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
}

.method-title-main {
	min-width: 110px;
	color: #303133;
	font-weight: 800;
}

.method-detail-section {
	padding: 12px;
}

.method-section-head {
	padding: 10px 12px;
	border: 1px solid #e4e7ed;
	border-radius: 7px;
	background: #fff;
}

.section-title {
	color: #303133;
	font-size: 14px;
	font-weight: 700;
}

.execution-card {
	margin-top: 10px;
	padding: 12px;
	border: 1px solid #e4e7ed;
	border-radius: 7px;
	background: #fff;
}

.execution-head {
	align-items: flex-start;
	padding-bottom: 10px;
	border-bottom: 1px dashed #e4e7ed;
}

.execution-head strong,
.execution-head span {
	display: block;
}

.execution-total {
	color: #67c23a;
	font-weight: 800;
	white-space: nowrap;
}

.batch-remark-line {
	display: inline-grid;
	grid-template-columns: auto minmax(0, 1fr);
	align-items: center;
	gap: 6px;
	max-width: min(520px, 100%);
	margin-top: 6px;
	padding: 4px 8px;
	border: 1px solid #fde2c4;
	border-radius: 5px;
	background: #fff8ef;
	color: #b36b00;
	font-size: 12px;
	line-height: 1.2;
}

.batch-remark-line span {
	display: inline-flex;
	align-items: center;
	min-height: 18px;
	padding: 0 5px;
	border-radius: 4px;
	background: #fff;
	color: #e6a23c;
	font-weight: 700;
	white-space: nowrap;
}

.batch-remark-line strong {
	min-width: 0;
	overflow: hidden;
	color: #7a4b00;
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.product-ship-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
	margin-top: 10px;
}

.ship-product-card {
	border: 1px solid #edf0f5;
	border-radius: 7px;
	background: #fbfcff;
}

.ship-product-main {
	padding: 10px 12px;
}

.ship-product-info {
	flex: 1 1 auto;
}

.ship-product-qty {
	min-width: 76px;
	text-align: right;
}

.ship-product-qty strong {
	display: block;
	color: #67c23a;
	font-size: 22px;
	line-height: 1;
}

.ship-product-qty span {
	color: #909399;
	font-size: 12px;
}

.detail-remark {
	display: inline-grid;
	grid-template-columns: auto minmax(0, 1fr);
	align-items: center;
	gap: 5px;
	max-width: min(360px, 100%);
	margin-top: 6px;
	padding: 3px 7px;
	border: 1px solid #fde2c4;
	border-radius: 5px;
	background: #fff8ef;
	color: #b36b00;
	font-size: 12px;
	line-height: 1.2;
	cursor: default;
}

.detail-remark span {
	padding: 0 5px;
	border-radius: 4px;
	background: #fff;
	color: #e6a23c;
	font-weight: 700;
	white-space: nowrap;
}

.detail-remark strong {
	min-width: 0;
	overflow: hidden;
	color: #7a4b00;
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.allocation-table {
	border-top: 1px solid #edf0f5;
}

:global(.lingxing-seq-popover) {
	padding: 10px !important;
}

:global(.batch-product-popover) {
	padding: 10px !important;
}

:global(.batch-product-popover .product-popover-content) {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

:global(.batch-product-popover .product-popover-head) {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	padding-bottom: 8px;
	border-bottom: 1px solid #edf1f7;
}

:global(.batch-product-popover .product-popover-head strong) {
	flex: 0 0 auto;
	color: #303133;
	font-size: 13px;
}

:global(.batch-product-popover .product-popover-head span) {
	color: #909399;
	font-size: 12px;
	line-height: 1.35;
}

:global(.batch-product-popover .product-popover-product) {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

:global(.batch-product-popover .product-popover-img) {
	flex: 0 0 auto;
	width: 34px;
	height: 34px;
	border: 1px solid #ebeef5;
	border-radius: 5px;
	background: #fff;
}

:global(.batch-product-popover .product-popover-product > div) {
	min-width: 0;
}

:global(.batch-product-popover .product-popover-product strong),
:global(.batch-product-popover .product-popover-product span) {
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

:global(.batch-product-popover .product-popover-product strong) {
	color: #303133;
	font-size: 12px;
}

:global(.batch-product-popover .product-popover-product span) {
	margin-top: 2px;
	color: #909399;
	font-size: 11px;
}

:global(.batch-product-popover .product-popover-tip) {
	padding: 6px 8px;
	border-radius: 5px;
	background: #f7f9fc;
	color: #909399;
	font-size: 12px;
	line-height: 1.35;
}

:global(.batch-product-detail-popover) {
	padding: 10px !important;
}

:global(.batch-product-detail-popover .product-detail-popover) {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

:global(.batch-product-detail-popover .product-detail-head) {
	display: grid;
	grid-template-columns: 54px minmax(0, 1fr);
	align-items: center;
	gap: 10px;
	padding-bottom: 10px;
	border-bottom: 1px solid #edf1f7;
}

:global(.batch-product-detail-popover .product-detail-img),
:global(.batch-product-detail-popover .product-detail-img-fallback) {
	width: 54px;
	height: 54px;
	border: 1px solid #ebeef5;
	border-radius: 7px;
	background: #fff;
}

:global(.batch-product-detail-popover .product-detail-img-fallback) {
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f7f9fc;
	color: #b5bfcc;
	font-size: 20px;
}

:global(.batch-product-detail-popover .product-detail-head strong) {
	display: block;
	color: #303133;
	font-size: 13px;
	font-weight: 800;
	line-height: 1.45;
	overflow-wrap: anywhere;
}

:global(.batch-product-detail-popover .product-detail-head span) {
	display: block;
	margin-top: 3px;
	color: #909399;
	font-size: 12px;
}

:global(.batch-product-detail-popover .product-detail-grid) {
	display: grid;
	grid-template-columns: 52px minmax(0, 1fr);
	gap: 7px 10px;
	padding: 0 1px;
	font-size: 12px;
	line-height: 1.35;
}

:global(.batch-product-detail-popover .product-detail-grid span) {
	color: #909399;
}

:global(.batch-product-detail-popover .product-detail-grid strong) {
	min-width: 0;
	overflow-wrap: anywhere;
	color: #303133;
	font-weight: 700;
}

:global(.batch-product-detail-popover .product-detail-stats) {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 6px;
}

:global(.batch-product-detail-popover .product-detail-stats > div) {
	padding: 7px 8px;
	border: 1px solid #eef2f7;
	border-radius: 6px;
	background: #f7f9fc;
	text-align: center;
}

:global(.batch-product-detail-popover .product-detail-stats span) {
	display: block;
	color: #909399;
	font-size: 11px;
}

:global(.batch-product-detail-popover .product-detail-stats strong) {
	display: block;
	margin-top: 3px;
	color: #303133;
	font-size: 15px;
	line-height: 1;
}

:global(.batch-product-detail-popover .product-detail-stats .is-success) {
	color: #529b2e;
}

:global(.batch-product-detail-popover .product-detail-stats .is-danger) {
	color: #f56c6c;
}

:global(.lingxing-seq-popover .seq-popover-content) {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

:global(.lingxing-seq-popover .seq-popover-head) {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	padding-bottom: 8px;
	border-bottom: 1px solid #edf1f7;
}

:global(.lingxing-seq-popover .seq-popover-head strong) {
	flex: 0 0 auto;
	color: #303133;
	font-size: 13px;
}

:global(.lingxing-seq-popover .seq-popover-head span) {
	color: #909399;
	font-size: 12px;
	line-height: 1.35;
	text-align: right;
}

:global(.lingxing-seq-popover .seq-table) {
	width: 100%;
}

:global(.lingxing-seq-popover .success-text) {
	color: #67c23a;
}

:global(.lingxing-seq-popover .danger-text) {
	color: #f56c6c;
}

@media (max-width: 1440px) {
	.batch-card {
		grid-template-columns: minmax(260px, 0.52fr) minmax(460px, 1fr) 132px;
	}

	.batch-metrics {
		grid-template-columns: repeat(4, minmax(70px, 1fr));
	}
}

@media (max-width: 1280px) {
	.keyword-input {
		flex-basis: 100%;
	}

	.date-range {
		flex: 1 1 260px;
	}

	.mine-switch {
		margin-left: 0;
	}

	.batch-card {
		grid-template-columns: 1fr;
	}

	.batch-identity {
		padding-right: 0;
		border-right: 0;
	}

	.batch-operation {
		padding-top: 10px;
		border-top: 1px dashed #edf1f7;
	}

	.batch-actions {
		flex-direction: row;
		justify-content: flex-end;
		padding-top: 10px;
		padding-left: 0;
		border-top: 1px dashed #edf1f7;
		border-left: 0;
	}

	.batch-actions :deep(.el-button) {
		width: auto;
	}
}
</style>
