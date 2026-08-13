<template>
	<div class="purchase-product-view">
		<div class="page-toolbar">
			<div class="toolbar-title">
				<div class="title">采购计划产品视图</div>
				<el-tag type="info" effect="plain">已生成采购计划</el-tag>
			</div>

			<div class="toolbar-actions">
				<el-tooltip
					v-if="!isShelvedWorkbench"
					:disabled="canOpenBatchShipDialog"
					content="请先选择至少一个已关联采购单的产品"
					placement="bottom"
				>
					<span>
						<el-button
							type="success"
							:loading="batchShipPreflightLoading"
							:disabled="!canOpenBatchShipDialog || batchShipPreflightLoading"
							@click="openBatchShipDialog"
						>
							批量发货 ({{ selectedRows.length }})
						</el-button>
					</span>
				</el-tooltip>
				<el-button
					v-if="!isShelvedWorkbench"
					type="warning"
					plain
					:disabled="!selectedRows.some(canBatchConfirmReceiptRow)"
					@click="batchConfirmReceipt(1)"
				>
					批量人工确认收货
				</el-button>
				<el-button
					v-if="!isShelvedWorkbench"
					plain
					:disabled="!selectedRows.some(canBatchCancelReceiptRow)"
					@click="batchConfirmReceipt(0)"
				>
					批量撤销人工确认
				</el-button>
				<el-tooltip
					v-if="!isShelvedWorkbench"
					:content="shelfTargetTooltip"
					placement="bottom"
				>
					<span>
						<el-button
							type="warning"
							plain
							:loading="shelvingLoading"
							:disabled="!selectedShelfTargetCount || shelvingLoading"
							@click="batchShelveSelectedRows"
						>
							搁置采购单产品 ({{ selectedShelfTargetCount }})
						</el-button>
					</span>
				</el-tooltip>
				<el-tooltip v-else :content="shelfTargetTooltip" placement="bottom">
					<span>
						<el-button
							type="success"
							plain
							:loading="unshelvingLoading"
							:disabled="!selectedShelfTargetCount || unshelvingLoading"
							@click="batchUnshelveSelectedRows"
						>
							恢复采购单产品 ({{ selectedShelfTargetCount }})
						</el-button>
					</span>
				</el-tooltip>
				<el-button
					type="primary"
					plain
					:icon="RefreshRight"
					:loading="syncLatestRefreshing"
					:disabled="loading || refreshing || syncLatestRefreshing || !tableData.length"
					@click="handleSyncLatestRelatedData"
				>
					同步最新数据
				</el-button>
				<el-button
					:icon="Refresh"
					:loading="refreshing"
					:disabled="loading && !refreshing"
					@click="handleRefresh"
				>
					刷新
				</el-button>
			</div>
		</div>

		<div class="filter-bar">
			<el-radio-group
				v-model="filters.work_status"
				class="work-status-tabs"
				@change="handleWorkStatusChange"
			>
				<el-radio-button label="current">当前</el-radio-button>
				<el-radio-button label="shelved">已搁置</el-radio-button>
			</el-radio-group>

			<el-input
				v-model="filters.keyWord"
				clearable
				placeholder="ASIN / MSKU / SKU / 计划编号 / 店铺"
				class="filter-keyword"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			>
				<template #prefix>
					<el-icon><search /></el-icon>
				</template>
			</el-input>

			<el-input
				v-model="filters.marketplace"
				clearable
				placeholder="国家"
				class="filter-small"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			/>

			<el-input
				v-model="filters.seller_name"
				clearable
				placeholder="店铺"
				class="filter-store"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			/>

			<el-input
				v-model="filters.product_code"
				clearable
				placeholder="四位数编码"
				class="filter-small"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			/>

			<el-select
				v-model="filters.fulfillment_status"
				clearable
				placeholder="艾为状态"
				class="filter-status filter-status-aiwei"
				@change="handleSearch"
				@clear="handleSearch"
			>
				<el-option
					v-for="item in fulfillmentStatusOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				>
					<div class="fulfillment-status-option">
						<div class="fulfillment-status-main">
							<div class="fulfillment-status-title-row">
								<el-popover
									placement="right"
									trigger="hover"
									:show-after="220"
									:width="340"
									popper-class="status-help-popover fulfillment-help-popover"
								>
									<template #reference>
										<span class="fulfillment-status-label">{{
											item.label
										}}</span>
									</template>
									<div class="status-help-card fulfillment-help-card">
										<div class="status-help-title">{{ item.label }}</div>
										<div class="status-help-section">
											<div class="status-help-section-title">判断条件</div>
											<ul v-if="item.rules?.length" class="status-help-list">
												<li v-for="rule in item.rules" :key="rule">
													{{ rule }}
												</li>
											</ul>
											<p v-else>{{ item.rule }}</p>
										</div>
										<div class="status-help-section">
											<div class="status-help-section-title">数量公式</div>
											<p>{{ item.formula }}</p>
										</div>
										<div class="status-help-section">
											<div class="status-help-section-title">典型例子</div>
											<p>{{ item.example }}</p>
										</div>
									</div>
								</el-popover>
								<span class="fulfillment-status-count">
									{{ getFulfillmentStatusCountText(item.value) }}
								</span>
							</div>
							<span class="fulfillment-status-desc">{{ item.short }}</span>
						</div>
					</div>
				</el-option>
			</el-select>

			<el-tooltip
				content="领星采购单原始状态，支持多选；只筛采购单本身状态，不判断本地履约和物流。"
				placement="top"
				:show-after="220"
			>
				<el-select
					v-model="filters.purchase_order_statuses"
					multiple
					collapse-tags
					collapse-tags-tooltip
					:max-collapse-tags="1"
					clearable
					placeholder="领星状态"
					class="filter-status filter-status-lingxing"
					popper-class="status-filter-popper"
					@change="handleSearch"
					@clear="handleSearch"
				>
					<el-option-group
						v-for="group in purchaseOrderStatusGroups"
						:key="group.label"
						:label="group.label"
					>
						<el-option
							v-for="item in group.options"
							:key="item.value"
							:label="item.label"
							:value="item.value"
						>
							<div class="status-filter-option">
								<div class="status-filter-left">
									<span class="status-filter-label">{{ item.label }}</span>
									<el-popover
										trigger="hover"
										placement="right-start"
										:width="286"
										:show-after="140"
										popper-class="status-help-popover"
									>
										<template #reference>
											<el-icon class="status-help-icon"
												><InfoFilled
											/></el-icon>
										</template>
										<div class="status-help-card">
											<div class="status-help-title">{{ item.label }}</div>
											<div>字段值：{{ item.field }}</div>
											<div>含义：{{ item.rule }}</div>
											<div>统计：{{ getPurchaseOrderStatusCountHelp() }}</div>
										</div>
									</el-popover>
								</div>
								<span
									class="status-filter-count"
									:class="{
										loading: statusCounts.loading,
										error: Boolean(statusCounts.error)
									}"
								>
									{{ getPurchaseOrderStatusCountText(item.value) }}
								</span>
							</div>
						</el-option>
					</el-option-group>
				</el-select>
			</el-tooltip>

			<el-select
				v-model="filters.logistics_status"
				clearable
				placeholder="物流状态"
				class="filter-select filter-select-logistics"
				popper-class="status-filter-popper"
				@change="handleSearch"
				@clear="handleSearch"
			>
				<el-option-group
					v-for="group in logisticsStatusGroups"
					:key="group.label"
					:label="group.label"
				>
					<el-option
						v-for="item in group.options"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					>
						<div class="status-filter-option">
							<div class="status-filter-left">
								<span class="status-filter-label">{{ item.label }}</span>
								<el-popover
									trigger="hover"
									placement="right-start"
									:width="286"
									:show-after="140"
									popper-class="status-help-popover"
								>
									<template #reference>
										<el-icon class="status-help-icon"><InfoFilled /></el-icon>
									</template>
									<div class="status-help-card">
										<div class="status-help-title">{{ item.label }}</div>
										<div>字段值：{{ item.field }}</div>
										<div>含义：{{ item.rule }}</div>
										<div>统计：{{ getLogisticsStatusCountHelp() }}</div>
									</div>
								</el-popover>
							</div>
							<span
								class="status-filter-count"
								:class="{
									loading: statusCounts.loading,
									error: Boolean(statusCounts.error)
								}"
							>
								{{ getLogisticsStatusCountText(item.value) }}
							</span>
						</div>
					</el-option>
				</el-option-group>
			</el-select>

			<el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
			<el-button :icon="RefreshRight" @click="resetFilters">重置</el-button>
		</div>

		<div class="table-wrap">
			<el-table
				v-loading="loading"
				:data="tableData"
				border
				stripe
				:height="tableHeight"
				row-key="row_key"
				style="width: 100%"
				@selection-change="handleSelectionChange"
			>
				<el-table-column
					type="selection"
					width="46"
					fixed="left"
					:selectable="canSelectProductRow"
				/>
				<el-table-column width="70" align="center" fixed="left">
					<template #header>
						<el-tooltip :content="sourceTips.productImage" placement="top">
							<span class="source-header">产品图片</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<el-popover
							v-if="getProductImageUrl(row)"
							trigger="hover"
							placement="right"
							:width="260"
							:show-after="120"
							popper-class="product-image-popover"
						>
							<template #reference>
								<div class="product-image-trigger">
									<el-image
										:src="getProductImageUrl(row)"
										fit="contain"
										class="product-image"
										:preview-src-list="[getProductImageUrl(row)]"
										preview-teleported
										@error="handleProductImageError(row)"
									/>
								</div>
							</template>

							<div class="product-image-preview-wrap">
								<el-image
									:src="getProductImageUrl(row)"
									fit="contain"
									class="product-image-preview"
									:preview-src-list="[getProductImageUrl(row)]"
									preview-teleported
									@error="handleProductImageError(row)"
								/>
							</div>
						</el-popover>
						<span v-else class="muted">-</span>
					</template>
				</el-table-column>

				<el-table-column min-width="520" fixed="left">
					<template #header>
						<el-tooltip :content="sourceTips.productInfo" placement="top">
							<span class="source-header">产品信息</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<div class="product-info-cell">
							<el-tooltip
								:content="getProduct(row).item_name || '-'"
								placement="top-start"
								:show-after="260"
							>
								<div class="product-info-title">
									{{ getProduct(row).item_name || "-" }}
								</div>
							</el-tooltip>
							<div class="product-info-store">
								<span>{{
									getProduct(row).seller_name || getProduct(row).shop || "-"
								}}</span>
								<span>{{ getProduct(row).marketplace || "-" }}</span>
							</div>
							<div class="product-info-identities">
								<span><b>ASIN</b>{{ getProduct(row).asin || "-" }}</span>
								<span><b>MSKU</b>{{ getProduct(row).msku || "-" }}</span>
								<span><b>本地SKU</b>{{ getProduct(row).local_sku || "-" }}</span>
								<span><b>FNSKU</b>{{ getProduct(row).fnsku || "-" }}</span>
							</div>
							<el-tooltip
								v-if="getShelfInfoText(row)"
								:content="getShelfInfoTooltip(row)"
								placement="top-start"
							>
								<el-tag class="shelf-info-tag" type="warning" effect="plain">
									{{ getShelfInfoText(row) }}
								</el-tag>
							</el-tooltip>
							<div class="product-info-metrics">
								<div class="product-info-metric">
									<span>结算毛利率</span>
									<el-tooltip
										:content="
											formatMetricPercent(getProductMetrics(row).profit_rate)
										"
										placement="top"
									>
										<b>{{
											formatMetricPercent(getProductMetrics(row).profit_rate)
										}}</b>
									</el-tooltip>
								</div>
								<div class="product-info-metric">
									<span>日均销量(3/7/14)</span>
									<el-tooltip
										:content="
											formatMetricTriple(getProductMetrics(row), 'sales_avg')
										"
										placement="top"
									>
										<b>{{
											formatMetricTriple(getProductMetrics(row), "sales_avg")
										}}</b>
									</el-tooltip>
								</div>
								<div class="product-info-metric">
									<span>可售天数</span>
									<el-tooltip
										:content="formatSellableDays(getProductMetrics(row))"
										placement="top"
									>
										<b>{{ formatSellableDays(getProductMetrics(row)) }}</b>
									</el-tooltip>
								</div>
								<div class="product-info-metric">
									<span>日均销量</span>
									<el-tooltip
										:content="
											formatMetricNumber(
												getProductMetrics(row).daily_avg_sales
											)
										"
										placement="top"
									>
										<b>{{
											formatMetricNumber(
												getProductMetrics(row).daily_avg_sales
											)
										}}</b>
									</el-tooltip>
								</div>
								<div class="product-info-metric">
									<span>FBA/FBA预留/在途/本地</span>
									<el-tooltip
										:content="formatInventoryTriple(getProductMetrics(row))"
										placement="top"
									>
										<b>{{ formatInventoryTriple(getProductMetrics(row)) }}</b>
									</el-tooltip>
								</div>
								<div class="product-info-metric">
									<span>总库存</span>
									<el-tooltip
										:content="
											formatMetricNumber(getProductMetrics(row).stock_total)
										"
										placement="top"
									>
										<b>{{
											formatMetricNumber(getProductMetrics(row).stock_total)
										}}</b>
									</el-tooltip>
								</div>
								<div class="product-info-metric">
									<span>建议采购量</span>
									<el-tooltip
										:content="
											formatMetricNumber(
												getProductMetrics(row).suggested_purchase_qty
											)
										"
										placement="top"
									>
										<b>{{
											formatMetricNumber(
												getProductMetrics(row).suggested_purchase_qty
											)
										}}</b>
									</el-tooltip>
								</div>
								<div class="product-info-metric">
									<span>待交付/采购计划</span>
									<el-tooltip
										:content="formatPendingAndPlan(getProductMetrics(row))"
										placement="top"
									>
										<b>{{ formatPendingAndPlan(getProductMetrics(row)) }}</b>
									</el-tooltip>
								</div>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column min-width="640">
					<template #header>
						<el-tooltip :content="sourceTips.purchaseFlow" placement="top">
							<span class="source-header">采购流程</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<div v-if="hasPurchaseFlowCard(row)" class="purchase-flow-card">
							<div class="purchase-flow-card-head">
								<div>
									<span>当前流程</span>
									<strong>{{
										getPurchaseFlowCardTitle(row, getSelectedPurchaseOrder(row))
									}}</strong>
								</div>
								<el-tag
									size="small"
									effect="plain"
									:type="
										getPurchaseFlowCardTagType(
											row,
											getSelectedPurchaseOrder(row)
										)
									"
								>
									{{
										getPurchaseFlowCardTagText(
											row,
											getSelectedPurchaseOrder(row)
										)
									}}
								</el-tag>
							</div>
							<div class="purchase-flow-mini-map">
								<svg
									class="purchase-flow-mini-lines"
									viewBox="0 0 660 178"
									preserveAspectRatio="none"
									aria-hidden="true"
								>
									<defs>
										<marker
											id="purchase-flow-mini-arrow"
											markerWidth="8"
											markerHeight="8"
											refX="7"
											refY="4"
											orient="auto"
											markerUnits="strokeWidth"
										>
											<path d="M0,0 L8,4 L0,8 Z" />
										</marker>
									</defs>
									<path class="purchase-flow-mini-line" d="M178 42 L238 42" />
									<path class="purchase-flow-mini-line" d="M418 42 L478 42" />
									<path
										class="purchase-flow-mini-line"
										d="M570 72 C570 92 570 99 570 108"
									/>
									<path class="purchase-flow-mini-line" d="M482 136 L418 136" />
									<path class="purchase-flow-mini-line" d="M242 136 L178 136" />
									<rect
										class="purchase-flow-mini-line-label-bg"
										x="177"
										y="14"
										width="62"
										height="20"
										rx="10"
									/>
									<rect
										class="purchase-flow-mini-line-label-bg"
										x="415"
										y="14"
										width="66"
										height="20"
										rx="10"
									/>
									<rect
										class="purchase-flow-mini-line-label-bg"
										x="574"
										y="82"
										width="58"
										height="20"
										rx="10"
									/>
									<rect
										class="purchase-flow-mini-line-label-bg"
										x="418"
										y="112"
										width="64"
										height="20"
										rx="10"
									/>
									<rect
										class="purchase-flow-mini-line-label-bg"
										x="180"
										y="112"
										width="58"
										height="20"
										rx="10"
									/>
									<text class="purchase-flow-mini-line-label" x="208" y="28">
										生成计划
									</text>
									<text class="purchase-flow-mini-line-label" x="448" y="28">
										同步采购单
									</text>
									<text class="purchase-flow-mini-line-label" x="603" y="96">
										创建发货
									</text>
									<text class="purchase-flow-mini-line-label" x="450" y="126">
										同步实发
									</text>
									<text class="purchase-flow-mini-line-label" x="209" y="126">
										计算履约
									</text>
								</svg>
								<div class="purchase-flow-mini-grid">
									<div
										v-for="node in getPurchaseOrderFlowCardNodes(
											row,
											getSelectedPurchaseOrder(row)
										)"
										:key="node.key"
										class="purchase-flow-mini-step"
										:class="[
											node.status,
											`node-${node.key}`,
											{ 'operator-missing': node.operator_missing }
										]"
										:title="getPurchaseOrderFlowNodeTitle(node)"
									>
										<div class="purchase-flow-mini-step-top">
											<span>{{ node.label }}</span>
											<em>{{ node.time }}</em>
										</div>
										<strong>{{ node.main_text }}</strong>
										<span class="purchase-flow-mini-step-meta">
											{{ node.operator_name }} / {{ node.meta_text }}
										</span>
									</div>
								</div>
							</div>
							<div class="purchase-flow-card-footer">
								<span>{{
									getPurchaseFlowCardFooterText(
										row,
										getSelectedPurchaseOrder(row)
									)
								}}</span>
								<button
									v-if="getSelectedPlan(row)"
									type="button"
									class="purchase-flow-card-action"
									@click.stop="
										openPurchaseOrderFlow(row, getSelectedPurchaseOrder(row))
									"
								>
									查看流程
								</button>
								<button
									v-else
									type="button"
									class="purchase-flow-card-action disabled"
									disabled
								>
									等待采购单
								</button>
							</div>
						</div>
						<div v-else class="purchase-flow-card empty">
							<div class="purchase-order-empty-title">暂无流程</div>
							<div class="purchase-order-empty-sub">当前产品还没有采购单</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column min-width="270">
					<template #header>
						<el-tooltip :content="sourceTips.purchaseLogistics" placement="top">
							<span class="source-header">当前采购单物流</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<div
							v-if="getSelectedPurchaseOrder(row)"
							class="purchase-order-summary-cell active logistics"
						>
							<div class="purchase-order-summary-head">
								<div class="purchase-order-summary-main">物流状态</div>
							</div>
							<div class="purchase-order-logistics-main">
								<el-tag
									v-if="getSelectedPurchaseOrder(row)?.logistics_status_text"
									size="small"
									effect="plain"
									:type="
										getLogisticsTagType(
											getSelectedPurchaseOrder(row)?.logistics_status
										)
									"
								>
									{{ getSelectedPurchaseOrder(row)?.logistics_status_text }}
								</el-tag>
								<span class="purchase-order-logistics-count">
									{{
										getPurchaseOrderLogisticsCardTextForOrder(
											getSelectedPurchaseOrder(row)
										)
									}}
								</span>
							</div>
							<div class="purchase-order-logistics-actions">
								<el-button
									v-if="canConfirmReceiptOrder(getSelectedPurchaseOrder(row))"
									type="warning"
									link
									size="small"
									@click.stop="
										confirmReceiptForOrder(
											row,
											getSelectedPurchaseOrder(row),
											1
										)
									"
								>
									人工确认收货
								</el-button>
								<el-button
									v-if="canCancelReceiptOrder(getSelectedPurchaseOrder(row))"
									type="info"
									link
									size="small"
									@click.stop="
										confirmReceiptForOrder(
											row,
											getSelectedPurchaseOrder(row),
											0
										)
									"
								>
									撤销人工确认
								</el-button>
							</div>
							<div
								v-if="
									getPurchaseOrderLogisticsPreviewPackages(
										getSelectedPurchaseOrder(row)
									).length
								"
								class="purchase-order-logistics-preview"
							>
								<div class="purchase-order-logistics-preview-head">
									<span>物流单号</span>
									<span>状态</span>
									<span>物流商</span>
								</div>
								<div class="purchase-order-logistics-preview-body">
									<div
										v-for="pkg in getPurchaseOrderLogisticsPreviewPackages(
											getSelectedPurchaseOrder(row)
										)"
										:key="pkg.pol_id || pkg.logistics_order_no || pkg.id"
										class="purchase-order-logistics-preview-row"
									>
										<el-tooltip
											:content="pkg.logistics_order_no || '-'"
											placement="top"
											:show-after="250"
										>
											<span class="logistics-preview-sn">
												{{ pkg.logistics_order_no || "-" }}
											</span>
										</el-tooltip>
										<el-tooltip
											:content="getPackageLogisticsStatusReason(pkg)"
											placement="top"
											:show-after="250"
										>
											<el-tag
												size="small"
												effect="plain"
												:type="getPackageLogisticsTagType(pkg)"
											>
												{{ getPackageLogisticsStatusText(pkg) }}
											</el-tag>
										</el-tooltip>
										<LogisticsSourcePopover
											v-if="getPackageSourceCount(pkg) > 1"
											:sources="getPackageSourceItems(pkg)"
											:count="getPackageSourceCount(pkg)"
										>
											<template #reference>
												<span
													class="logistics-preview-company logistics-source-reference"
													@click.stop
												>
													{{ pkg.logistics_company || "-" }}
													<el-tag size="small" type="info">
														{{ getPackageSourceCount(pkg) }} 条来源
													</el-tag>
												</span>
											</template>
										</LogisticsSourcePopover>
										<span v-else class="logistics-preview-company">
											{{ pkg.logistics_company || "-" }}
										</span>
									</div>
								</div>
							</div>
							<div v-else class="purchase-order-logistics-empty">暂无包裹明细</div>
							<div class="purchase-order-hover-actions">
								<el-popover
									trigger="hover"
									placement="left"
									:width="780"
									:show-after="160"
									popper-class="purchase-order-logistics-popover"
									@show="loadLogisticsPopover(getSelectedPurchaseOrder(row))"
								>
									<template #reference>
										<span class="purchase-order-hover-trigger">
											<span class="purchase-order-hover-mark" />
											<span>物流明细</span>
										</span>
									</template>

									<div class="purchase-order-detail">
										<div class="purchase-order-detail-title">
											采购单
											{{ getSelectedPurchaseOrder(row)?.order_sn || "-" }}
											物流明细
										</div>
										<div class="purchase-order-detail-summary">
											<span>
												{{
													getPurchaseOrderLogisticsDetailTitleForOrder(
														getSelectedPurchaseOrder(row)
													)
												}}
											</span>
										</div>
										<div v-loading="logisticsPopoverState.loading">
											<el-table
												:data="
													getLogisticsPopoverData(
														getSelectedPurchaseOrder(row)
													)
												"
												class="logistics-popover-table"
												border
												size="small"
												max-height="360"
											>
												<el-table-column
													prop="logistics_order_no"
													label="物流单号"
													min-width="132"
													show-overflow-tooltip
												/>
												<el-table-column label="物流商" width="130">
													<template #default="{ row: pkg }">
														<LogisticsSourcePopover
															v-if="getPackageSourceCount(pkg) > 1"
															:sources="getPackageSourceItems(pkg)"
															:count="getPackageSourceCount(pkg)"
														>
															<template #reference>
																<div
																	class="logistics-popover-company logistics-source-reference"
																	@click.stop
																>
																	<span>{{
																		pkg.logistics_company || "-"
																	}}</span>
																	<el-tag
																		size="small"
																		type="info"
																	>
																		{{
																			getPackageSourceCount(
																				pkg
																			)
																		}}
																		条来源
																	</el-tag>
																</div>
															</template>
														</LogisticsSourcePopover>
														<div
															v-else
															class="logistics-popover-company"
														>
															<span>{{
																pkg.logistics_company || "-"
															}}</span>
														</div>
													</template>
												</el-table-column>
												<el-table-column
													label="状态"
													width="86"
													align="center"
												>
													<template #default="{ row: pkg }">
														<el-tooltip
															:content="
																getPackageLogisticsStatusReason(pkg)
															"
															placement="top"
															:show-after="300"
														>
															<el-tag
																size="small"
																effect="plain"
																:type="
																	getPackageLogisticsTagType(pkg)
																"
															>
																{{
																	getPackageLogisticsStatusText(
																		pkg
																	)
																}}
															</el-tag>
														</el-tooltip>
													</template>
												</el-table-column>
												<el-table-column label="最近轨迹" min-width="310">
													<template #default="{ row: pkg }">
														<el-tooltip
															:content="getLatestTraceText(pkg)"
															placement="top"
															:show-after="300"
														>
															<div class="logistics-popover-trace">
																{{ getLatestTraceText(pkg) }}
															</div>
														</el-tooltip>
													</template>
												</el-table-column>
												<el-table-column
													label="轨迹"
													width="62"
													align="center"
												>
													<template #default="{ row: pkg }">
														<el-button
															type="primary"
															link
															@click="openLogisticsPackageTrace(pkg)"
														>
															轨迹
														</el-button>
													</template>
												</el-table-column>
											</el-table>
											<el-empty
												v-if="
													!logisticsPopoverState.loading &&
													!getLogisticsPopoverData(
														getSelectedPurchaseOrder(row)
													).length
												"
												description="暂无任何包裹物流信息"
												:image-size="48"
											/>
										</div>
									</div>
								</el-popover>
							</div>
						</div>

						<div v-else class="purchase-order-summary-cell empty logistics">
							<div class="purchase-order-empty-title">无采购单物流</div>
							<div class="purchase-order-empty-sub">当前产品还没有采购单可选</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column min-width="350">
					<template #header>
						<el-tooltip :content="sourceTips.purchaseOrder" placement="top">
							<span class="source-header">当前采购单 / 发货</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<div
							v-if="getSelectedPurchaseOrder(row)"
							class="purchase-order-summary-cell active order-fulfillment"
						>
							<div class="purchase-order-summary-head">
								<div class="purchase-order-summary-main">
									{{ getSelectedPurchaseOrder(row)?.order_sn || "-" }}
								</div>
								<div class="purchase-order-summary-meta">
									<span class="status-prefix">领星</span>
									<el-tag
										size="small"
										effect="plain"
										:type="
											getPurchaseOrderStatusType(
												getSelectedPurchaseOrder(row)?.purchase_order_status
											)
										"
									>
										{{
											getSelectedPurchaseOrder(row)
												?.purchase_order_status_text || "-"
										}}
									</el-tag>
									<span class="status-prefix">
										{{
											isManualCompletedPurchaseOrder(
												getSelectedPurchaseOrder(row)
											)
												? "本地"
												: "艾为"
										}}
									</span>
									<el-tooltip
										:content="
											getFulfillmentStatusDescription(
												getPurchaseOrderFulfillmentSummary(
													getSelectedPurchaseOrder(row)
												).fulfillment_group_status ||
													getPurchaseOrderFulfillmentSummary(
														getSelectedPurchaseOrder(row)
													).fulfillment_status
											)
										"
										placement="top"
										:show-after="180"
									>
										<el-tag
											size="small"
											effect="plain"
											:type="
												getFulfillmentStatusTagType(
													getFulfillmentGroupStatus(
														getPurchaseOrderFulfillmentSummary(
															getSelectedPurchaseOrder(row)
														)
													)
												)
											"
										>
											{{
												getFulfillmentDisplayText(
													getPurchaseOrderFulfillmentSummary(
														getSelectedPurchaseOrder(row)
													)
												) ||
												getPurchaseOrderFulfillmentSummary(
													getSelectedPurchaseOrder(row)
												).fulfillment_status_text
											}}
										</el-tag>
									</el-tooltip>
									<el-tag
										v-if="
											isManualCompletedPurchaseOrder(
												getSelectedPurchaseOrder(row)
											)
										"
										size="small"
										type="warning"
										effect="plain"
									>
										不会进入批量发货
									</el-tag>
									<span
										v-if="!getSelectedPurchaseOrder(row)?.is_calculated_order"
									>
										未计入
									</span>
								</div>
							</div>
							<div class="purchase-order-context-line">
								<span>
									关联采购计划
									{{ getSelectedPurchaseOrder(row)?.linked_plan_count || 0 }}
									条
								</span>
								<span
									>明细
									{{ getSelectedPurchaseOrder(row)?.item_count || 0 }} 条</span
								>
							</div>
							<template
								v-for="queueInfo in [getPurchaseOrderQueueInfo(row)]"
								:key="queueInfo.cacheKey"
							>
								<el-tooltip
									v-if="queueInfo.total > 0"
									:content="getPurchaseOrderQueueTooltip(queueInfo)"
									placement="top"
									:show-after="180"
								>
									<div class="purchase-order-queue-line">
										<div class="purchase-order-queue-main">
											<el-tag
												size="small"
												effect="plain"
												:type="queueInfo.tagType"
											>
												{{ queueInfo.label }}
											</el-tag>
											<strong>{{ queueInfo.positionText }}</strong>
											<span v-if="queueInfo.remainingText">
												{{ queueInfo.remainingText }}
											</span>
										</div>
										<div
											v-if="queueInfo.detailText"
											class="purchase-order-queue-detail"
										>
											{{ queueInfo.detailText }}
										</div>
									</div>
								</el-tooltip>
							</template>
							<div class="purchase-order-summary-metrics fulfillment">
								<div
									v-for="metric in getPurchaseOrderOptionMetrics(
										getSelectedPurchaseOrder(row)
									)"
									:key="metric.key"
									class="purchase-order-metric"
									:class="{
										emphasized: metric.emphasized,
										abnormal: metric.abnormal
									}"
								>
									<el-popover
										trigger="hover"
										placement="top"
										:width="300"
										:show-after="160"
										popper-class="metric-source-popover"
									>
										<template #reference>
											<span class="metric-label-wrap">
												<span class="metric-help">{{ metric.label }}</span>
												<span
													v-if="metric.statusText"
													class="metric-status-pill"
													:class="`is-${metric.statusTagType || 'info'}`"
												>
													{{ metric.statusText }}
												</span>
											</span>
										</template>
										<div class="metric-source-card">
											<div class="metric-source-title">
												{{ metric.help.title }}
											</div>
											<div
												v-for="line in metric.help.lines"
												:key="line"
												class="metric-source-line"
											>
												{{ line }}
											</div>
											<div v-if="metric.help.note" class="metric-source-note">
												{{ metric.help.note }}
											</div>
										</div>
									</el-popover>
									<span class="metric-value-wrap">
										<strong :class="metric.className">
											{{ metric.value }}
										</strong>
									</span>
								</div>
							</div>
							<div class="purchase-order-summary-foot">
								最近下单
								{{
									formatShortDateTime(
										getSelectedPurchaseOrder(row)?.purchase_order_time
									)
								}}
							</div>
							<div class="purchase-order-hover-actions">
								<el-popover
									v-model:visible="
										purchaseOrderPopoverVisibleMap[
											getPurchaseOrderSelectionKey(row)
										]
									"
									trigger="click"
									placement="left"
									:width="620"
									popper-class="purchase-order-detail-popover"
								>
									<template #reference>
										<span class="purchase-order-hover-trigger">
											<span class="purchase-order-hover-mark" />
											<span>切换采购单</span>
										</span>
									</template>

									<div class="purchase-order-detail">
										<div class="purchase-order-detail-title">选择采购单</div>
										<div class="purchase-order-option-list">
											<button
												v-for="order in getProductPurchaseOrderOptions(row)"
												:key="order.order_sn"
												type="button"
												class="purchase-order-option"
												:class="{
													active:
														order.order_sn ===
														getSelectedPurchaseOrder(row)?.order_sn,
													excluded: !order.is_calculated_order,
													'manual-completed':
														isManualCompletedPurchaseOrder(order),
													disabled: !canSelectPurchaseOrder(order)
												}"
												:disabled="!canSelectPurchaseOrder(order)"
												@click="selectPurchaseOrder(row, order)"
											>
												<div class="purchase-order-option-top">
													<span class="purchase-order-option-sn">
														{{ order.order_sn || "-" }}
													</span>
													<div class="purchase-order-option-statuses">
														<span class="status-prefix">领星</span>
														<el-tag
															size="small"
															effect="plain"
															:type="
																getPurchaseOrderStatusType(
																	order.purchase_order_status
																)
															"
														>
															{{
																order.purchase_order_status_text ||
																"-"
															}}
														</el-tag>
														<span class="status-prefix">
															{{
																isManualCompletedPurchaseOrder(
																	order
																)
																	? "本地"
																	: "艾为"
															}}
														</span>
														<el-tooltip
															:content="
																getFulfillmentStatusDescription(
																	getPurchaseOrderFulfillmentSummary(
																		order
																	).fulfillment_group_status ||
																		getPurchaseOrderFulfillmentSummary(
																			order
																		).fulfillment_status
																)
															"
															placement="top"
															:show-after="180"
														>
															<el-tag
																size="small"
																effect="plain"
																:type="
																	getFulfillmentStatusTagType(
																		getFulfillmentGroupStatus(
																			getPurchaseOrderFulfillmentSummary(
																				order
																			)
																		)
																	)
																"
															>
																{{
																	getFulfillmentDisplayText(
																		getPurchaseOrderFulfillmentSummary(
																			order
																		)
																	) ||
																	getPurchaseOrderFulfillmentSummary(
																		order
																	).fulfillment_status_text
																}}
															</el-tag>
														</el-tooltip>
														<el-tag
															v-if="!order.is_calculated_order"
															size="small"
															type="info"
															effect="plain"
														>
															未计入
														</el-tag>
														<el-tag
															v-if="
																isManualCompletedPurchaseOrder(
																	order
																)
															"
															size="small"
															type="warning"
															effect="plain"
														>
															不会进入批量发货
														</el-tag>
													</div>
												</div>
												<div class="purchase-order-option-context">
													<span>
														关联采购计划
														{{ order.linked_plan_count || 0 }} 条
													</span>
													<span>明细 {{ order.item_count || 0 }} 条</span>
													<span>
														最近下单
														{{
															formatShortDateTime(
																order.purchase_order_time
															)
														}}
													</span>
												</div>
												<div class="purchase-order-option-plan-meta">
													{{ getPurchaseOrderOptionPlanMeta(order) }}
												</div>
												<div class="purchase-order-option-metrics">
													<div
														v-for="metric in getPurchaseOrderOptionMetrics(
															order
														)"
														:key="metric.key"
														class="purchase-order-option-metric"
													>
														<el-tooltip
															:content="metric.tooltip"
															placement="top"
															:show-after="180"
															popper-class="metric-source-tooltip"
														>
															<span class="metric-label-wrap">
																<span class="metric-help">{{
																	metric.label
																}}</span>
																<span
																	v-if="metric.statusText"
																	class="metric-status-pill"
																	:class="`is-${metric.statusTagType || 'info'}`"
																>
																	{{ metric.statusText }}
																</span>
															</span>
														</el-tooltip>
														<span class="metric-value-wrap">
															<strong :class="metric.className">
																{{ metric.value }}
															</strong>
														</span>
													</div>
												</div>
											</button>
										</div>
									</div>
								</el-popover>

								<span
									class="purchase-order-hover-trigger"
									@click="
										openFulfillmentDialog(row, getSelectedPurchaseOrder(row))
									"
								>
									<span class="purchase-order-hover-mark" />
									<span>履约调整</span>
								</span>

								<el-popover
									trigger="hover"
									placement="left"
									:width="960"
									:show-after="160"
									popper-class="purchase-order-detail-popover"
								>
									<template #reference>
										<span class="purchase-order-hover-trigger">
											<span class="purchase-order-hover-mark" />
											<span>发货明细</span>
										</span>
									</template>

									<div class="purchase-order-detail">
										<div class="purchase-order-detail-title">
											采购单
											{{ getSelectedPurchaseOrder(row)?.order_sn || "-" }}
											发货明细
										</div>
										<div class="purchase-order-detail-summary">
											<span>{{
												getCurrentPurchaseOrderDetailTitle(
													getSelectedPurchaseOrder(row)
												)
											}}</span>
										</div>
										<el-table
											v-if="
												hasPurchaseOrderShipmentPlans(
													getSelectedPurchaseOrder(row)
												)
											"
											:data="
												getPurchaseOrderShipmentTableRows(
													getSelectedPurchaseOrder(row)
												)
											"
											class="shipment-detail-table"
											border
											size="small"
											max-height="360"
											:row-key="getShipmentTableRowKey"
										>
											<el-table-column label="商品" min-width="280">
												<template #default="{ row: item }">
													<div class="shipment-table-product">
														<el-popover
															v-if="getShipmentRowImageUrl(item)"
															trigger="hover"
															placement="right"
															:width="244"
															:show-after="140"
															popper-class="shipment-image-popover"
														>
															<template #reference>
																<el-image
																	:src="
																		getShipmentRowImageUrl(item)
																	"
																	class="shipment-table-image"
																	fit="cover"
																	:preview-src-list="
																		getShipmentRowPreviewList(
																			item
																		)
																	"
																	:initial-index="0"
																	preview-teleported
																/>
															</template>
															<div
																class="shipment-image-preview-wrap"
															>
																<el-image
																	:src="
																		getShipmentRowImageUrl(item)
																	"
																	class="shipment-image-preview"
																	fit="contain"
																	:preview-src-list="
																		getShipmentRowPreviewList(
																			item
																		)
																	"
																	:initial-index="0"
																	preview-teleported
																/>
															</div>
														</el-popover>
														<span
															v-else
															class="shipment-table-image empty"
															>无图</span
														>
														<div class="shipment-table-product-info">
															<el-tooltip
																:content="
																	getShipmentRowProductName(item)
																"
																placement="top-start"
																:show-after="260"
																popper-class="shipment-product-name-tooltip"
															>
																<div
																	class="shipment-table-product-name"
																>
																	{{
																		getShipmentRowProductName(
																			item
																		)
																	}}
																</div>
															</el-tooltip>
															<div
																class="shipment-table-product-meta"
															>
																<div class="shipment-field-row">
																	<span
																		class="shipment-field-label"
																		>ASIN</span
																	>
																	<span
																		class="shipment-field-value"
																		>{{
																			item.asin || "-"
																		}}</span
																	>
																</div>
																<div class="shipment-field-row">
																	<span
																		class="shipment-field-label"
																		>MSKU</span
																	>
																	<span
																		class="shipment-field-value"
																		>{{
																			item.msku || "-"
																		}}</span
																	>
																</div>
																<div class="shipment-field-row">
																	<span
																		class="shipment-field-label"
																		>FNSKU</span
																	>
																	<span
																		class="shipment-field-value"
																		>{{
																			item.fnsku || "-"
																		}}</span
																	>
																</div>
															</div>
														</div>
													</div>
												</template>
											</el-table-column>
											<el-table-column label="发货计划" min-width="180">
												<template #default="{ row: item }">
													<div class="shipment-table-stack strong">
														<div class="shipment-field-row">
															<span class="shipment-field-label"
																>计划批次</span
															>
															<span class="shipment-field-value">{{
																item.seq || "-"
															}}</span>
														</div>
														<div class="shipment-field-row">
															<span class="shipment-field-label"
																>采购计划</span
															>
															<span class="shipment-field-value">{{
																item.purchase_plan_sn || "-"
															}}</span>
														</div>
														<div class="shipment-field-row">
															<span class="shipment-field-label"
																>发货计划</span
															>
															<span class="shipment-field-value">{{
																item.shipment_plan_sn || "-"
															}}</span>
														</div>
													</div>
												</template>
											</el-table-column>
											<el-table-column label="数量" width="142">
												<template #default="{ row: item }">
													<div class="shipment-table-qty">
														<div>
															<span>计划发货量</span
															><strong>{{
																item.shipment_plan_quantity || 0
															}}</strong>
														</div>
														<div>
															<span>本行实发量</span
															><strong>{{
																item.actual_qty || 0
															}}</strong>
														</div>
														<div>
															<span>批次差异量</span>
															<strong
																:class="[
																	'shipment-diff',
																	getDiffClass(item.plan_diff_qty)
																]"
															>
																{{
																	formatSignedNumber(
																		item.plan_diff_qty
																	)
																}}
															</strong>
														</div>
													</div>
												</template>
											</el-table-column>
											<el-table-column label="实际发货单" min-width="180">
												<template #default="{ row: item }">
													<div class="shipment-table-stack">
														<div class="shipment-field-row">
															<span class="shipment-field-label"
																>实际单号</span
															>
															<span
																class="shipment-field-value shipment-table-sn"
															>
																{{ item.shipment_sn || "-" }}
															</span>
														</div>
														<div class="shipment-field-row">
															<span class="shipment-field-label"
																>发货状态</span
															>
															<span class="shipment-field-value">
																<el-tag
																	v-if="item.has_actual"
																	size="small"
																	effect="plain"
																	:type="
																		getActualShipmentStatusType(
																			item.shipment_status
																		)
																	"
																>
																	{{
																		item.shipment_status_name ||
																		"实际发货单"
																	}}
																</el-tag>
																<span v-else class="muted"
																	>未生成</span
																>
															</span>
														</div>
														<div class="shipment-field-row">
															<span class="shipment-field-label"
																>发货时间</span
															>
															<span class="shipment-field-value">
																{{
																	formatShortDateTime(
																		item.shipment_time
																	)
																}}
															</span>
														</div>
													</div>
												</template>
											</el-table-column>
											<el-table-column label="渠道/仓库" min-width="140">
												<template #default="{ row: item }">
													<div class="shipment-table-stack">
														<div class="shipment-field-row">
															<span class="shipment-field-label"
																>运输方式</span
															>
															<span class="shipment-field-value">
																{{
																	item.method_name ||
																	getShippingMethodLabel(
																		item.shipping_method
																	)
																}}
															</span>
														</div>
														<div class="shipment-field-row">
															<span class="shipment-field-label"
																>物流渠道</span
															>
															<span class="shipment-field-value">{{
																item.logistics_channel_name || "-"
															}}</span>
														</div>
														<div class="shipment-field-row">
															<span class="shipment-field-label"
																>发货仓库</span
															>
															<span class="shipment-field-value">{{
																item.wname || "-"
															}}</span>
														</div>
													</div>
												</template>
											</el-table-column>
										</el-table>
										<el-empty
											v-if="
												!hasPurchaseOrderShipmentPlans(
													getSelectedPurchaseOrder(row)
												)
											"
											description="当前采购单未安排发货计划"
											:image-size="48"
										/>
									</div>
								</el-popover>
							</div>
						</div>

						<div v-else class="purchase-order-summary-cell empty">
							<div class="purchase-order-empty-title">当前产品未生成采购单</div>
							<div class="purchase-order-empty-sub">
								采购计划关系仍可查看，暂无采购单可切换
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column min-width="390">
					<template #header>
						<el-tooltip :content="sourceTips.lingxingPlan" placement="top">
							<span class="source-header">领星采购计划</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<div class="plan-cell">
							<div v-if="getPlanRelationRows(row).length" class="plan-relation-cell">
								<div class="plan-relation-head">
									<span>{{ getPlanRelationHeadText(row) }}</span>
									<span v-if="getSelectedPurchaseOrder(row)"> 当前采购单 </span>
								</div>
								<div class="plan-relation-list">
									<div
										v-for="plan in getVisiblePlanRelationRows(row)"
										:key="plan.plan_sn"
										class="plan-relation-item"
										:class="{
											active: isSelectedPlan(row, plan),
											linked: isPlanLinkedToSelectedPurchaseOrder(row, plan),
											empty: !hasPurchaseOrders(plan)
										}"
										@click.stop="selectPurchasePlan(row, plan)"
									>
										<div class="plan-relation-top">
											<span class="plan-relation-sn">{{
												plan.plan_sn || "-"
											}}</span>
											<el-tag
												size="small"
												effect="plain"
												:type="getPlanRelationStatusType(row, plan)"
											>
												{{ getPlanRelationStatusText(row, plan) }}
											</el-tag>
										</div>
										<div class="plan-relation-meta">
											<span
												>领星
												{{ getLingxingPlan(plan).quantity_plan || 0 }}</span
											>
											<span
												>本地
												{{ getLocalRecord(plan).quantity_plan || 0 }}</span
											>
											<span>{{
												formatShortDateTime(getPlanTime(plan))
											}}</span>
										</div>
										<div class="plan-relation-text">
											{{ getPlanRelationText(row, plan) }}
										</div>
									</div>
								</div>
								<el-popover
									v-if="getHiddenPlanRelationCount(row) > 0"
									trigger="click"
									placement="bottom-start"
									:width="460"
									popper-class="purchase-plan-popover"
								>
									<template #reference>
										<button type="button" class="plan-relation-more">
											查看全部采购计划
											{{ getPlanRelationRows(row).length }} 条
										</button>
									</template>

									<div class="plan-relation-popover">
										<div class="plan-popover-head">
											<span>全部采购计划关系</span>
											<span class="muted"
												>共 {{ getPlanRelationRows(row).length }} 条</span
											>
										</div>
										<div class="plan-relation-list all">
											<div
												v-for="plan in getPlanRelationRows(row)"
												:key="plan.plan_sn"
												class="plan-relation-item"
												:class="{
													active: isSelectedPlan(row, plan),
													linked: isPlanLinkedToSelectedPurchaseOrder(
														row,
														plan
													),
													empty: !hasPurchaseOrders(plan)
												}"
												@click.stop="selectPurchasePlan(row, plan)"
											>
												<div class="plan-relation-top">
													<span class="plan-relation-sn">{{
														plan.plan_sn || "-"
													}}</span>
													<el-tag
														size="small"
														effect="plain"
														:type="getPlanRelationStatusType(row, plan)"
													>
														{{ getPlanRelationStatusText(row, plan) }}
													</el-tag>
												</div>
												<div class="plan-relation-meta">
													<span
														>领星
														{{
															getLingxingPlan(plan).quantity_plan || 0
														}}</span
													>
													<span
														>本地
														{{
															getLocalRecord(plan).quantity_plan || 0
														}}</span
													>
													<span>{{
														formatShortDateTime(getPlanTime(plan))
													}}</span>
												</div>
												<div class="plan-relation-text">
													{{ getPlanRelationText(row, plan) }}
												</div>
											</div>
										</div>
									</div>
								</el-popover>
							</div>

							<span v-else class="muted">暂无采购计划</span>
						</div>
					</template>
				</el-table-column>

				<el-table-column width="140" align="center">
					<template #header>
						<el-tooltip :content="sourceTips.localQuantity" placement="top">
							<span class="source-header">本地创建时数量</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<div class="qty-main small">
							{{ getLocalRecord(getSelectedPlan(row)).quantity_plan || 0 }}
						</div>
						<div class="muted">
							共 {{ getSummary(row).purchase_plan_count || 0 }} 条
						</div>
					</template>
				</el-table-column>

				<el-table-column width="135" align="center">
					<template #header>
						<el-tooltip :content="sourceTips.lingxingQuantity" placement="top">
							<span class="source-header">领星计划数量</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<div class="qty-main">
							{{ getLingxingPlan(getSelectedPlan(row)).quantity_plan || 0 }}
						</div>
						<div class="muted">
							本地 {{ getLocalRecord(getSelectedPlan(row)).quantity_plan || 0 }}
						</div>
					</template>
				</el-table-column>

				<el-table-column width="145" align="center">
					<template #header>
						<el-tooltip :content="sourceTips.lingxingStatus" placement="top">
							<span class="source-header">领星采购计划状态</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<el-tag :type="getPlanStatusType(getSelectedPlan(row))" size="small">
							{{ getPlanStatusText(getSelectedPlan(row)) }}
						</el-tag>
					</template>
				</el-table-column>

				<el-table-column width="150" show-overflow-tooltip>
					<template #header>
						<el-tooltip :content="sourceTips.lingxingUser" placement="top">
							<span class="source-header">领星创建人/采购员</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<div class="stack-cell">
							<span>{{
								getLingxingPlan(getSelectedPlan(row)).creator_real_name || "-"
							}}</span>
							<span class="muted">{{ getPlanBuyer(getSelectedPlan(row)) }}</span>
						</div>
					</template>
				</el-table-column>

				<el-table-column width="185" show-overflow-tooltip>
					<template #header>
						<el-tooltip :content="sourceTips.lingxingSupplierWarehouse" placement="top">
							<span class="source-header">领星供应商/仓库</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<div class="stack-cell">
							<span>{{
								getLingxingPlan(getSelectedPlan(row)).supplier_name || "-"
							}}</span>
							<span class="muted">{{
								getLingxingPlan(getSelectedPlan(row)).warehouse_name || "-"
							}}</span>
						</div>
					</template>
				</el-table-column>

				<el-table-column width="125" align="center">
					<template #header>
						<el-tooltip :content="sourceTips.lingxingArrival" placement="top">
							<span class="source-header">领星期望到货</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						{{
							formatShortDate(
								getLingxingPlan(getSelectedPlan(row)).expect_arrive_time
							)
						}}
					</template>
				</el-table-column>

				<el-table-column min-width="230" show-overflow-tooltip>
					<template #header>
						<el-tooltip :content="sourceTips.localSummary" placement="top">
							<span class="source-header">本地测算摘要</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<span>{{ getLocalSummary(getSelectedPlan(row)) }}</span>
					</template>
				</el-table-column>

				<el-table-column min-width="190" show-overflow-tooltip>
					<template #header>
						<el-tooltip :content="sourceTips.localManualRemark" placement="top">
							<span class="source-header">本地人工备注</span>
						</el-tooltip>
					</template>
					<template #default="{ row }">
						<span>{{ getLocalRecord(getSelectedPlan(row)).manual_remark || "-" }}</span>
					</template>
				</el-table-column>

				<el-table-column label="操作" width="90" align="center" fixed="right">
					<template #default="{ row }">
						<el-button type="primary" link :icon="View" @click="openDetail(row)"
							>详情</el-button
						>
					</template>
				</el-table-column>
			</el-table>
		</div>

		<div class="pagination-wrap">
			<el-pagination
				v-model:current-page="pagination.page"
				v-model:page-size="pagination.size"
				:page-sizes="[20, 50, 100]"
				:total="pagination.total"
				background
				layout="total, sizes, prev, pager, next, jumper"
				@size-change="handlePageSizeChange"
				@current-change="loadData"
			/>
		</div>

		<el-drawer v-model="detailVisible" title="采购计划详情" size="720px">
			<div v-if="detailProduct && detailPlan" class="detail-body">
				<div class="detail-section">
					<div class="section-title">产品信息</div>
					<el-descriptions :column="2" border>
						<el-descriptions-item label="产品ASIN">{{
							getProduct(detailProduct).asin || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="产品MSKU">{{
							getProduct(detailProduct).msku || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="产品店铺">{{
							getProduct(detailProduct).seller_name || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="产品国家">{{
							getProduct(detailProduct).marketplace || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="产品本地SKU">{{
							getProduct(detailProduct).local_sku || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="产品FNSKU">{{
							getProduct(detailProduct).fnsku || "-"
						}}</el-descriptions-item>
					</el-descriptions>
				</div>

				<div class="detail-section">
					<div class="section-title">领星采购计划</div>
					<el-descriptions :column="2" border>
						<el-descriptions-item label="领星采购计划编号">{{
							detailPlan.plan_sn || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="领星采购批次">{{
							getLingxingPlan(detailPlan).ppg_sn || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="领星计划数量">{{
							getLingxingPlan(detailPlan).quantity_plan || 0
						}}</el-descriptions-item>
						<el-descriptions-item label="领星采购计划状态">{{
							getPlanStatusText(detailPlan)
						}}</el-descriptions-item>
						<el-descriptions-item label="领星创建时间">{{
							formatDate(getPlanTime(detailPlan))
						}}</el-descriptions-item>
						<el-descriptions-item label="领星创建人">{{
							getLingxingPlan(detailPlan).creator_real_name || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="领星采购员">{{
							getPlanBuyer(detailPlan)
						}}</el-descriptions-item>
						<el-descriptions-item label="领星采购方">{{
							getLingxingPlan(detailPlan).purchaser_name || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="领星供应商">{{
							getLingxingPlan(detailPlan).supplier_name || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="领星仓库">{{
							getLingxingPlan(detailPlan).warehouse_name || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="领星期望到货">{{
							formatShortDate(getLingxingPlan(detailPlan).expect_arrive_time)
						}}</el-descriptions-item>
						<el-descriptions-item label="领星备注">{{
							getLingxingRemark(detailPlan) || "-"
						}}</el-descriptions-item>
					</el-descriptions>
				</div>

				<div class="detail-section">
					<div class="section-title">本地创建记录</div>
					<el-descriptions :column="2" border>
						<el-descriptions-item label="本地创建时数量">{{
							getLocalRecord(detailPlan).quantity_plan || 0
						}}</el-descriptions-item>
						<el-descriptions-item label="本地创建时间">{{
							formatDate(getLocalRecord(detailPlan).create_time)
						}}</el-descriptions-item>
						<el-descriptions-item label="本地测算周期">
							{{ formatPlanPeriod(detailPlan) }} /
							{{ getLocalRecord(detailPlan).total_days || 0 }} 天
						</el-descriptions-item>
						<el-descriptions-item label="本地人工备注">{{
							getLocalRecord(detailPlan).manual_remark || "-"
						}}</el-descriptions-item>
					</el-descriptions>
				</div>

				<div class="detail-section">
					<div class="section-title">采购计划关联采购单与物流</div>

					<div
						v-if="
							getPurchaseOrderSummary(detailPlan).all_order_count ||
							getPurchaseOrderSummary(detailPlan).order_count
						"
						class="detail-order-summary"
					>
						<span>
							采购单 {{ getPurchaseOrderSummary(detailPlan).order_count }} 单 / 子项
							{{ getPurchaseOrderSummary(detailPlan).linked_item_count }} 条
						</span>
						<span>
							{{ getPurchaseOrderQuantityText(detailPlan) }}
						</span>
						<span v-if="getPurchaseOrderExcludedText(detailPlan)">
							{{ getPurchaseOrderExcludedText(detailPlan) }}
						</span>
						<span v-if="getPurchaseOrderSummary(detailPlan).order_count">
							{{ getPurchaseOrderLogisticsSummaryText(detailPlan) }}
						</span>
					</div>

					<el-table
						v-if="getPurchaseOrders(detailPlan).length"
						:data="getPurchaseOrders(detailPlan)"
						border
						size="small"
						:row-class-name="getPurchaseOrderRowClassName"
					>
						<el-table-column prop="order_sn" label="采购单号" min-width="140" />
						<el-table-column label="采购状态" width="110" align="center">
							<template #default="{ row }">
								<el-tag
									size="small"
									effect="plain"
									:type="getPurchaseOrderStatusType(row.purchase_order_status)"
								>
									{{ row.purchase_order_status_text || "-" }}
								</el-tag>
							</template>
						</el-table-column>
						<el-table-column
							prop="purchase_order_supplier_name"
							label="供应商"
							min-width="160"
							show-overflow-tooltip
						/>
						<el-table-column label="下单时间" min-width="140">
							<template #default="{ row }">
								{{ formatDate(row.purchase_order_time) }}
							</template>
						</el-table-column>
						<el-table-column
							prop="item_count"
							label="子项数"
							width="78"
							align="center"
						/>
						<el-table-column
							prop="quantity_plan_sum"
							label="计划"
							width="70"
							align="center"
						/>
						<el-table-column
							prop="quantity_real_sum"
							label="实际"
							width="70"
							align="center"
						/>
						<el-table-column
							prop="quantity_entry_sum"
							label="入库"
							width="70"
							align="center"
						/>
						<el-table-column
							prop="quantity_receive_sum"
							label="待到货"
							width="80"
							align="center"
						/>
						<el-table-column label="物流状态" min-width="138" align="center">
							<template #default="{ row }">
								<el-tooltip
									:content="
										row.logistics_status_reason ||
										row.logistics_status_text ||
										'-'
									"
									placement="top"
								>
									<el-tag
										size="small"
										effect="plain"
										:type="getLogisticsTagType(row.logistics_status)"
									>
										{{ row.logistics_status_text || "-" }}
									</el-tag>
								</el-tooltip>
							</template>
						</el-table-column>
						<el-table-column label="汇总" width="70" align="center">
							<template #default="{ row }">
								<el-tooltip
									:content="
										row.is_calculated_order
											? '参与该采购计划采购单汇总'
											: row.calculation_excluded_reason || '未计入汇总'
									"
									placement="top"
								>
									<span
										class="purchase-order-count-state"
										:class="{ excluded: !row.is_calculated_order }"
									>
										{{ row.is_calculated_order ? "计入" : "未计入" }}
									</span>
								</el-tooltip>
							</template>
						</el-table-column>
						<el-table-column label="操作" width="90" align="center">
							<template #default="{ row }">
								<el-button type="primary" link @click="openLogistics(row)">
									物流
								</el-button>
							</template>
						</el-table-column>
					</el-table>
					<el-empty v-else description="该采购计划未关联采购单" :image-size="54" />
				</div>

				<div class="detail-section">
					<div class="section-title">当前采购单发货履约</div>

					<div
						v-if="getSelectedPurchaseOrder(detailProduct, detailPlan)"
						class="detail-order-summary"
					>
						<span>
							采购单
							{{
								getSelectedPurchaseOrder(detailProduct, detailPlan)?.order_sn || "-"
							}}
						</span>
						<span>
							{{
								getCurrentPurchaseOrderDetailTitle(
									getSelectedPurchaseOrder(detailProduct, detailPlan)
								)
							}}
						</span>
						<span>
							实际可发
							{{
								getPurchaseOrderFulfillmentSummary(
									getSelectedPurchaseOrder(detailProduct, detailPlan)
								).actual_shippable_qty
							}}
						</span>
					</div>

					<el-table
						v-if="
							hasPurchaseOrderShipmentPlans(
								getSelectedPurchaseOrder(detailProduct, detailPlan)
							)
						"
						:data="
							getPurchaseOrderShipmentPlans(
								getSelectedPurchaseOrder(detailProduct, detailPlan)
							)
						"
						border
						size="small"
					>
						<el-table-column prop="seq" label="发货计划批次" min-width="130" />
						<el-table-column
							prop="shipment_plan_sn"
							label="发货计划单号"
							min-width="140"
						/>
						<el-table-column label="运输方式" width="90" align="center">
							<template #default="{ row }">
								{{ getShippingMethodLabel(row.shipping_method) }}
							</template>
						</el-table-column>
						<el-table-column
							prop="shipment_plan_quantity"
							label="计划发货"
							width="90"
							align="center"
						/>
						<el-table-column label="实际发货" width="90" align="center">
							<template #default="{ row }">
								{{ row.actual_qty_sum || 0 }}
							</template>
						</el-table-column>
						<el-table-column label="差异" width="80" align="center">
							<template #default="{ row }">
								<span :class="['shipment-diff', getDiffClass(row.diff_qty)]">
									{{ formatSignedNumber(row.diff_qty) }}
								</span>
							</template>
						</el-table-column>
						<el-table-column label="状态" width="100" align="center">
							<template #default="{ row }">
								<el-tag
									size="small"
									effect="plain"
									:type="getShipmentPlanStatusType(row.status)"
								>
									{{ row.status_name || row.status_text || "-" }}
								</el-tag>
							</template>
						</el-table-column>
						<el-table-column label="创建时间" min-width="140">
							<template #default="{ row }">
								{{ formatDate(row.create_time) }}
							</template>
						</el-table-column>
					</el-table>

					<el-table
						v-if="
							getPurchaseOrderActualDetails(
								getSelectedPurchaseOrder(detailProduct, detailPlan)
							).length
						"
						:data="
							getPurchaseOrderActualDetails(
								getSelectedPurchaseOrder(detailProduct, detailPlan)
							)
						"
						border
						size="small"
					>
						<el-table-column prop="shipment_sn" label="实际发货单号" min-width="140" />
						<el-table-column prop="seq" label="发货计划批次" min-width="130" />
						<el-table-column
							prop="shipment_list_quantity"
							label="实发"
							width="80"
							align="center"
						/>
						<el-table-column label="状态" width="100" align="center">
							<template #default="{ row }">
								<el-tag
									size="small"
									effect="plain"
									:type="getActualShipmentStatusType(row.shipment_status)"
								>
									{{ row.shipment_status_name || "-" }}
								</el-tag>
							</template>
						</el-table-column>
						<el-table-column label="发货时间" min-width="130">
							<template #default="{ row }">
								{{ formatDate(row.shipment_time) }}
							</template>
						</el-table-column>
						<el-table-column
							prop="method_name"
							label="方式"
							min-width="100"
							show-overflow-tooltip
						/>
						<el-table-column
							prop="logistics_channel_name"
							label="物流渠道"
							min-width="150"
							show-overflow-tooltip
						/>
					</el-table>

					<el-empty
						v-if="
							!hasPurchaseOrderShipmentPlans(
								getSelectedPurchaseOrder(detailProduct, detailPlan)
							)
						"
						description="当前采购单未安排发货计划"
						:image-size="54"
					/>
				</div>

				<div class="detail-section">
					<div class="section-title">本地测算分段</div>
					<el-table
						:data="getLocalRecord(detailPlan).breakdown || []"
						border
						size="small"
					>
						<el-table-column prop="shipping_label" label="方式" width="90">
							<template #default="{ row }">
								{{ row.shipping_label || row.shipping_method || "-" }}
							</template>
						</el-table-column>
						<el-table-column label="日期" min-width="170">
							<template #default="{ row }">
								{{ row.startDate || "-" }} 至 {{ row.endDate || "-" }}
							</template>
						</el-table-column>
						<el-table-column prop="days" label="天数" width="70" align="center" />
						<el-table-column prop="dailyNeed" label="日需" width="80" align="center" />
						<el-table-column prop="subtotal" label="数量" width="90" align="center" />
					</el-table>
				</div>

				<div class="detail-section">
					<div class="section-title">本地测算说明</div>
					<div class="detail-text">{{ getPlanDetailText(detailPlan) }}</div>
				</div>
			</div>
		</el-drawer>

		<el-dialog
			v-model="fulfillmentDialog.visible"
			title="采购单履约调整"
			width="min(1080px, 92vw)"
			destroy-on-close
		>
			<div v-if="fulfillmentDialog.order" class="fulfillment-dialog">
				<div class="fulfillment-dialog-summary">
					<div>
						<span>采购单</span>
						<strong>{{ fulfillmentDialog.order.order_sn || "-" }}</strong>
					</div>
					<div>
						<span>入库</span>
						<strong>{{ fulfillmentDialogBase.quantity_entry_sum }}</strong>
					</div>
					<div>
						<span>实际发货</span>
						<strong>{{ fulfillmentDialogBase.actual_shipment_qty_sum }}</strong>
					</div>
					<div>
						<span>预计可发</span>
						<strong>{{ fulfillmentDialogEstimatedQty }}</strong>
					</div>
					<div>
						<span>实际可发</span>
						<strong :class="getDiffClass(fulfillmentDialogActualQty)">
							{{ fulfillmentDialogActualQty }}
						</strong>
					</div>
					<div>
						<span>本地状态</span>
						<strong
							:class="{
								warning: isFulfillmentDialogManualCompleted
							}"
						>
							{{ isFulfillmentDialogManualCompleted ? "人工完成" : "正常计算" }}
						</strong>
					</div>
					<div>
						<span>单据状态</span>
						<strong>
							<el-tag
								size="small"
								effect="plain"
								:type="
									getFulfillmentDocumentStatusTagType(
										fulfillmentDialog.form.document_status
									)
								"
							>
								{{
									getFulfillmentDocumentStatusText(
										fulfillmentDialog.form.document_status
									)
								}}
							</el-tag>
						</strong>
					</div>
				</div>

				<el-alert
					v-if="fulfillmentDialogError"
					:title="fulfillmentDialogError"
					type="warning"
					:closable="false"
					show-icon
				/>
				<el-alert
					v-if="isFulfillmentDialogLocked"
					title="该履约异常单据已确认锁定，原采购页面只能查看，不能修改。"
					type="success"
					:closable="false"
					show-icon
				/>
				<el-alert
					v-else-if="isFulfillmentDialogInWorkflow"
					title="该履约异常单据已进入处理流程，最终确认前仍可调整源异常说明。"
					type="info"
					:closable="false"
					show-icon
				/>

				<div class="fulfillment-adjustment-grid">
					<div class="fulfillment-adjustment-panel">
						<div class="fulfillment-adjustment-title">
							<span>残次品</span>
							<el-tag
								size="small"
								effect="plain"
								:type="
									getAdjustmentStatusTagType(
										fulfillmentDialog.form.defective_status
									)
								"
							>
								{{
									getAdjustmentStatusText(fulfillmentDialog.form.defective_status)
								}}
							</el-tag>
						</div>
						<el-form label-width="70px" size="small">
							<el-form-item label="数量">
								<el-input-number
									v-model="fulfillmentDialog.form.defective_qty"
									:min="0"
									:precision="0"
									controls-position="right"
									style="width: 160px"
									:disabled="isFulfillmentDialogReadonly"
								/>
							</el-form-item>
							<el-form-item label="异常说明">
								<el-input
									v-model="fulfillmentDialog.form.defective_remark"
									type="textarea"
									:rows="3"
									placeholder="填写残次品原因或异常说明"
									:disabled="isFulfillmentDialogReadonly"
								/>
							</el-form-item>
							<div
								v-if="fulfillmentDialog.form.defective_process_remark"
								class="fulfillment-process-remark"
							>
								<span>处理备注</span>
								<strong>{{
									fulfillmentDialog.form.defective_process_remark
								}}</strong>
							</div>
							<div
								v-if="!canProcessFulfillmentField('defective')"
								class="fulfillment-process-hint"
							>
								{{ getProcessFulfillmentDisabledTip("defective") }}
							</div>
							<el-tooltip
								:disabled="canProcessFulfillmentField('defective')"
								:content="getProcessFulfillmentDisabledTip('defective')"
								placement="top"
							>
								<span
									class="fulfillment-action-wrap"
									:class="{
										'is-disabled': !canProcessFulfillmentField('defective')
									}"
								>
									<el-button
										size="small"
										type="success"
										plain
										class="fulfillment-action-button"
										:disabled="
											!canProcessFulfillmentField('defective') ||
											isFulfillmentDialogReadonly
										"
										@click="processFulfillmentAdjustment('defective')"
									>
										{{
											canProcessFulfillmentField("defective")
												? "标记残次品已处理"
												: "填写数量和备注后可处理"
										}}
									</el-button>
								</span>
							</el-tooltip>
						</el-form>
					</div>

					<div class="fulfillment-adjustment-panel">
						<div class="fulfillment-adjustment-title">
							<span>商家少发</span>
							<el-tag
								size="small"
								effect="plain"
								:type="
									getAdjustmentStatusTagType(
										fulfillmentDialog.form.short_shipped_status
									)
								"
							>
								{{
									getAdjustmentStatusText(
										fulfillmentDialog.form.short_shipped_status
									)
								}}
							</el-tag>
						</div>
						<el-form label-width="70px" size="small">
							<el-form-item label="数量">
								<el-input-number
									v-model="fulfillmentDialog.form.short_shipped_qty"
									:min="0"
									:precision="0"
									controls-position="right"
									style="width: 160px"
									:disabled="isFulfillmentDialogReadonly"
								/>
							</el-form-item>
							<el-form-item label="异常说明">
								<el-input
									v-model="fulfillmentDialog.form.short_shipped_remark"
									type="textarea"
									:rows="3"
									placeholder="填写商家少发原因或异常说明"
									:disabled="isFulfillmentDialogReadonly"
								/>
							</el-form-item>
							<div
								v-if="fulfillmentDialog.form.short_shipped_process_remark"
								class="fulfillment-process-remark"
							>
								<span>处理备注</span>
								<strong>{{
									fulfillmentDialog.form.short_shipped_process_remark
								}}</strong>
							</div>
							<div
								v-if="!canProcessFulfillmentField('short_shipped')"
								class="fulfillment-process-hint"
							>
								{{ getProcessFulfillmentDisabledTip("short_shipped") }}
							</div>
							<el-tooltip
								:disabled="canProcessFulfillmentField('short_shipped')"
								:content="getProcessFulfillmentDisabledTip('short_shipped')"
								placement="top"
							>
								<span
									class="fulfillment-action-wrap"
									:class="{
										'is-disabled': !canProcessFulfillmentField('short_shipped')
									}"
								>
									<el-button
										size="small"
										type="success"
										plain
										class="fulfillment-action-button"
										:disabled="
											!canProcessFulfillmentField('short_shipped') ||
											isFulfillmentDialogReadonly
										"
										@click="processFulfillmentAdjustment('short_shipped')"
									>
										{{
											canProcessFulfillmentField("short_shipped")
												? "标记少发已处理"
												: "填写数量和备注后可处理"
										}}
									</el-button>
								</span>
							</el-tooltip>
						</el-form>
					</div>

					<div
						class="fulfillment-adjustment-panel manual-complete"
						:class="{ completed: isFulfillmentDialogManualCompleted }"
					>
						<div class="fulfillment-adjustment-title">
							<span>人工完成</span>
							<el-tag
								size="small"
								effect="plain"
								:type="isFulfillmentDialogManualCompleted ? 'warning' : 'info'"
							>
								{{ isFulfillmentDialogManualCompleted ? "已完成" : "未标记" }}
							</el-tag>
						</div>
						<template v-if="!isFulfillmentDialogManualCompleted">
							<div class="manual-complete-tip">
								<el-icon><warning /></el-icon>
								<span>
									仅本地生效：实际可发归零，不进入批量发货；领星状态不变。
								</span>
							</div>
							<div class="manual-complete-form">
								<div class="manual-complete-field-head">
									<span>人工完成原因 <em>*</em></span>
								</div>
								<el-input
									v-model="fulfillmentDialog.form.manual_completed_remark"
									type="textarea"
									:rows="3"
									:maxlength="200"
									show-word-limit
									placeholder="例如：尾数不再发货、供应商已结清"
									:disabled="isFulfillmentDialogReadonly"
								/>
								<div
									v-if="!canManualCompleteFulfillment"
									class="manual-complete-empty-hint"
								>
									填写原因后才能标记人工完成
								</div>
							</div>
							<el-tooltip
								:disabled="canManualCompleteFulfillment"
								content="填写人工完成原因后才能标记"
								placement="top"
							>
								<span
									class="manual-complete-action-wrap"
									:class="{ 'is-disabled': !canManualCompleteFulfillment }"
								>
									<el-button
										size="small"
										type="warning"
										:plain="!canManualCompleteFulfillment"
										class="manual-complete-action"
										:loading="fulfillmentDialog.processing"
										:disabled="!canManualCompleteFulfillment"
										@click="manualCompleteFulfillment"
									>
										{{
											canManualCompleteFulfillment
												? "标记人工完成"
												: "填写原因后可标记"
										}}
									</el-button>
								</span>
							</el-tooltip>
						</template>
						<template v-else>
							<div class="manual-complete-card">
								<div class="manual-complete-reason">
									<span>完成原因</span>
									<strong>{{
										fulfillmentDialog.form.manual_completed_remark || "-"
									}}</strong>
								</div>
								<div class="manual-complete-meta">
									<span>操作人</span>
									<strong>{{
										fulfillmentDialog.form.manual_completed_by_username || "-"
									}}</strong>
								</div>
								<div class="manual-complete-meta">
									<span>时间</span>
									<strong>{{
										formatDate(fulfillmentDialog.form.manual_completed_time)
									}}</strong>
								</div>
							</div>
							<el-button
								size="small"
								type="primary"
								plain
								:loading="fulfillmentDialog.processing"
								:disabled="isFulfillmentDialogReadonly"
								@click="manualReopenFulfillment"
							>
								恢复可发
							</el-button>
						</template>
					</div>
				</div>

				<div class="fulfillment-log-section">
					<div class="section-title">操作日志</div>
					<el-table
						v-loading="fulfillmentDialog.logsLoading"
						:data="fulfillmentDialog.logs"
						border
						size="small"
						max-height="260"
						class="fulfillment-log-table"
					>
						<el-table-column label="时间" width="138">
							<template #default="{ row }">{{ formatDate(row.createTime) }}</template>
						</el-table-column>
						<el-table-column label="操作" width="104">
							<template #default="{ row }">
								{{ getFulfillmentLogActionText(row.action_type, row.field_group) }}
							</template>
						</el-table-column>
						<el-table-column prop="operator_username" label="操作人" width="78" />
						<el-table-column label="变更摘要" width="360">
							<template #default="{ row }">
								<div
									v-if="getFulfillmentLogChanges(row).length"
									class="fulfillment-log-summary"
								>
									<span>{{ getFulfillmentLogSummary(row) }}</span>
									<el-popover
										trigger="click"
										placement="left"
										:width="420"
										popper-class="fulfillment-log-change-popover"
									>
										<template #reference>
											<button
												class="fulfillment-log-detail-chip"
												type="button"
											>
												{{ getFulfillmentLogDetailText(row) }}
											</button>
										</template>
										<div class="fulfillment-log-popover">
											<div class="fulfillment-log-popover-title">
												完整变更
											</div>
											<div class="fulfillment-log-change-list">
												<div
													v-for="change in getFulfillmentLogChanges(row)"
													:key="change.key"
													class="fulfillment-log-change-item"
												>
													<span class="change-label">{{
														change.label
													}}</span>
													<span class="change-before">{{
														change.beforeText
													}}</span>
													<span class="change-arrow">→</span>
													<span class="change-after">{{
														change.afterText
													}}</span>
												</div>
											</div>
										</div>
									</el-popover>
								</div>
								<span v-else class="fulfillment-log-empty">无字段变化</span>
							</template>
						</el-table-column>
						<el-table-column
							prop="remark"
							label="备注"
							min-width="180"
							show-overflow-tooltip
						/>
					</el-table>
				</div>
			</div>

			<template #footer>
				<el-button @click="fulfillmentDialog.visible = false">取消</el-button>
				<el-button
					type="primary"
					:loading="fulfillmentDialog.loading"
					:disabled="Boolean(fulfillmentDialogError) || isFulfillmentDialogReadonly"
					@click="saveFulfillmentAdjustment"
				>
					保存
				</el-button>
			</template>
		</el-dialog>

		<el-drawer
			v-model="purchaseOrderFlowDrawer.visible"
			size="min(1360px, 96vw)"
			destroy-on-close
			class="purchase-flow-drawer-wrap"
		>
			<template #header>
				<div class="purchase-flow-drawer-header">
					<div>
						<div class="purchase-flow-drawer-title">采购计划流程</div>
						<div class="purchase-flow-drawer-subtitle">
							{{ getSelectedPlan(purchaseOrderFlowDrawer.row)?.plan_sn || "-" }}
							<span v-if="purchaseOrderFlowDrawer.order?.order_sn">
								/ {{ purchaseOrderFlowDrawer.order.order_sn }}
							</span>
							<span v-if="purchaseOrderFlowDrawer.data?.summary">
								/
								{{
									getFulfillmentDisplayText(
										purchaseOrderFlowDrawer.data.summary
									) || "-"
								}}
							</span>
						</div>
					</div>
					<el-button
						size="small"
						:icon="Refresh"
						:loading="purchaseOrderFlowDrawer.loading"
						@click="loadPurchaseOrderFlow"
					>
						刷新流程
					</el-button>
				</div>
			</template>

			<div class="purchase-flow-drawer" v-loading="purchaseOrderFlowDrawer.loading">
				<el-empty
					v-if="!purchaseOrderFlowDrawer.loading && !purchaseOrderFlowDrawer.data"
					description="暂无流程数据"
				/>

				<template v-else-if="purchaseOrderFlowDrawer.data">
					<div class="purchase-flow-overview">
						<div
							v-for="item in getPurchaseOrderFlowSummaryMetrics()"
							:key="item.label"
							class="purchase-flow-overview-item"
						>
							<span>{{ item.label }}</span>
							<strong :class="item.className">{{ item.value }}</strong>
						</div>
					</div>

					<div class="purchase-flow-workspace">
						<div class="purchase-flow-board">
							<div class="purchase-flow-graph-toolbar">
								<div class="purchase-flow-graph-title">
									<strong>流程图</strong>
									<span>点击节点看详情，拖动画布或节点，滚轮缩放</span>
								</div>
								<div class="purchase-flow-graph-actions">
									<el-button size="small" @click="zoomPurchaseFlowGraph(0.12)"
										>放大</el-button
									>
									<el-button size="small" @click="zoomPurchaseFlowGraph(-0.12)"
										>缩小</el-button
									>
									<el-button size="small" @click="resetPurchaseFlowGraphView"
										>重置</el-button
									>
								</div>
							</div>

							<div
								class="purchase-flow-graph-shell"
								@wheel.prevent="handlePurchaseFlowGraphWheel"
								@pointerdown="startPurchaseFlowGraphPan"
								@pointermove="movePurchaseFlowGraphPan"
								@pointerup="endPurchaseFlowGraphPan"
								@pointerleave="endPurchaseFlowGraphPan"
							>
								<svg
									class="purchase-flow-graph"
									viewBox="0 0 1280 500"
									role="img"
									aria-label="采购单履约流程图"
								>
									<defs>
										<marker
											id="purchase-flow-arrow-primary"
											markerWidth="12"
											markerHeight="12"
											refX="10"
											refY="6"
											orient="auto"
											markerUnits="strokeWidth"
										>
											<path d="M2,2 L10,6 L2,10 Z" fill="#409eff" />
										</marker>
										<marker
											id="purchase-flow-arrow-success"
											markerWidth="12"
											markerHeight="12"
											refX="10"
											refY="6"
											orient="auto"
											markerUnits="strokeWidth"
										>
											<path d="M2,2 L10,6 L2,10 Z" fill="#67c23a" />
										</marker>
										<marker
											id="purchase-flow-arrow-danger"
											markerWidth="12"
											markerHeight="12"
											refX="10"
											refY="6"
											orient="auto"
											markerUnits="strokeWidth"
										>
											<path d="M2,2 L10,6 L2,10 Z" fill="#f56c6c" />
										</marker>
										<marker
											id="purchase-flow-arrow-muted"
											markerWidth="12"
											markerHeight="12"
											refX="10"
											refY="6"
											orient="auto"
											markerUnits="strokeWidth"
										>
											<path d="M2,2 L10,6 L2,10 Z" fill="#c0c4cc" />
										</marker>
									</defs>
									<g :transform="getPurchaseFlowGraphTransform()">
										<g
											v-for="edge in getPurchaseOrderFlowGraphEdges()"
											:key="edge.key"
											class="purchase-flow-edge-group"
											:class="edge.status"
										>
											<title>{{ edge.fullLabel || edge.label }}</title>
											<path
												:id="`flow-edge-${edge.key}`"
												class="purchase-flow-edge"
												:d="edge.path"
												:marker-end="getPurchaseFlowEdgeMarker(edge)"
											/>
											<rect
												class="purchase-flow-edge-label-bg"
												:x="edge.labelX - edge.labelWidth / 2"
												:y="edge.labelY - 13"
												:width="edge.labelWidth"
												height="24"
												rx="12"
											/>
											<text
												class="purchase-flow-edge-label"
												:x="edge.labelX"
												:y="edge.labelY + 4"
												text-anchor="middle"
											>
												{{ edge.label }}
											</text>
										</g>

										<g
											v-for="node in getPurchaseOrderFlowGraphNodes()"
											:key="node.key"
											class="purchase-flow-svg-node"
											:class="[
												node.status,
												{
													active:
														purchaseOrderFlowDrawer.selectedNodeKey ===
														node.key,
													'operator-missing': node.operator_missing
												}
											]"
											:transform="`translate(${node.x}, ${node.y})`"
											@click.stop="selectPurchaseFlowNode(node.key)"
											@pointerdown.stop="
												startPurchaseFlowNodeDrag($event, node)
											"
											@pointermove.stop="movePurchaseFlowNodeDrag"
											@pointerup.stop="endPurchaseFlowNodeDrag"
											@pointerleave.stop="endPurchaseFlowNodeDrag"
										>
											<rect
												class="purchase-flow-svg-node-box"
												:width="node.width"
												:height="node.height"
												rx="10"
											/>
											<circle
												class="purchase-flow-svg-node-dot"
												cx="18"
												cy="20"
												r="5"
											/>
											<text
												class="purchase-flow-svg-node-title"
												x="32"
												y="25"
											>
												{{ node.label }}
											</text>
											<text
												class="purchase-flow-svg-node-status"
												x="16"
												y="50"
											>
												{{
													truncateFlowSvgText(
														getFlowNodeSvgLine1(node),
														22
													)
												}}
											</text>
											<text class="purchase-flow-svg-node-meta" x="16" y="70">
												{{
													truncateFlowSvgText(
														getFlowNodeSvgLine2(node),
														24
													)
												}}
											</text>
											<text class="purchase-flow-svg-node-user" x="16" y="90">
												{{
													truncateFlowSvgText(
														getFlowNodeSvgLine3(node),
														28
													)
												}}
											</text>
										</g>
									</g>
								</svg>
							</div>
						</div>

						<aside class="purchase-flow-node-panel">
							<div class="purchase-flow-node-main">
								<div class="purchase-flow-node-panel-head">
									<div>
										<span>当前节点</span>
										<strong>{{ getSelectedFlowNodeTitle() }}</strong>
									</div>
									<el-tag
										size="small"
										effect="plain"
										:type="getSelectedFlowNodeTagType()"
									>
										{{ getSelectedFlowNodeStatusText() }}
									</el-tag>
									<el-tag
										v-if="getSelectedFlowAnalysisSourceLabel()"
										size="small"
										effect="plain"
										:type="getSelectedFlowAnalysisSourceTagType()"
										class="purchase-flow-analysis-source-tag"
									>
										{{ getSelectedFlowAnalysisSourceLabel() }}
									</el-tag>
								</div>
								<div class="purchase-flow-node-desc">
									{{ getSelectedFlowNodeDescription() }}
								</div>
							</div>

							<div class="purchase-flow-node-section">
								<div class="purchase-flow-node-section-title">关键数据</div>
								<div class="purchase-flow-node-grid">
									<div
										v-for="item in getSelectedFlowNodePrimaryDetails()"
										:key="item.key"
										class="purchase-flow-node-kv"
									>
										<span>{{ item.label }}</span>
										<el-tooltip
											:content="getFlowDetailTooltip(item)"
											effect="light"
											placement="top"
											:show-after="250"
											popper-class="purchase-flow-detail-tooltip"
										>
											<strong>{{ item.value }}</strong>
										</el-tooltip>
										<em v-if="item.extra">{{ item.extra }}</em>
									</div>
								</div>
							</div>

							<el-collapse
								v-model="purchaseOrderFlowDrawer.eventCollapseNames"
								class="purchase-flow-node-collapse"
							>
								<el-collapse-item name="details">
									<template #title>
										<div class="purchase-flow-collapse-title">
											<strong>详细信息</strong>
											<span>展开查看全部字段和拆分</span>
										</div>
									</template>
									<div class="purchase-flow-node-grid detail">
										<div
											v-for="item in getSelectedFlowNodeDetailRest()"
											:key="item.key"
											class="purchase-flow-node-kv"
										>
											<span>{{ item.label }}</span>
											<el-tooltip
												:content="getFlowDetailTooltip(item)"
												effect="light"
												placement="top"
												:show-after="250"
												popper-class="purchase-flow-detail-tooltip"
											>
												<strong>{{ item.value }}</strong>
											</el-tooltip>
											<em v-if="item.extra">{{ item.extra }}</em>
										</div>
									</div>
									<div
										v-if="getSelectedFlowDemandBasisRows().length"
										class="purchase-flow-demand-basis"
									>
										<div class="purchase-flow-demand-basis-head">
											<strong>需求口径</strong>
											<span>先看周期需求、库存和在途，再理解系统建议</span>
										</div>
										<div class="purchase-flow-demand-basis-grid">
											<div
												v-for="item in getSelectedFlowDemandBasisRows()"
												:key="item.key"
												class="purchase-flow-demand-basis-item"
											>
												<span>{{ item.label }}</span>
												<strong>{{ flowNumber(item.value) }}</strong>
											</div>
										</div>
									</div>
									<div
										v-if="getSelectedFlowFormulaSteps().length"
										class="purchase-flow-formula-panel"
									>
										<div class="purchase-flow-formula-panel-head">
											<div class="purchase-flow-formula-summary">
												<strong>公式拆解</strong>
												<span>{{
													getSelectedFlowFormulaSummaryText()
												}}</span>
											</div>
											<div class="purchase-flow-formula-actions">
												<el-tag
													size="small"
													effect="plain"
													:type="getSelectedFlowFormulaVolatilityType()"
												>
													{{ getSelectedFlowFormulaVolatilityText() }}
												</el-tag>
												<el-tag
													size="small"
													effect="plain"
													:type="getSelectedFlowFormulaCoefficientType()"
												>
													{{ getSelectedFlowFormulaCoefficientText() }}
												</el-tag>
												<el-tag size="small" effect="plain">
													{{ getSelectedFlowFormulaSteps().length }} 步
												</el-tag>
												<el-button
													size="small"
													text
													bg
													@click.stop="toggleSelectedFlowFormula"
												>
													{{
														purchaseOrderFlowDrawer.formulaExpanded
															? "收起公式"
															: "展开公式"
													}}
												</el-button>
											</div>
										</div>
										<div
											v-if="purchaseOrderFlowDrawer.formulaExpanded"
											class="purchase-flow-formula-steps"
										>
											<div
												v-for="row in getSelectedFlowFormulaStepRows()"
												:key="row.key"
												class="purchase-flow-formula-row"
											>
												<span class="purchase-flow-formula-index">{{
													row.index
												}}</span>
												<div class="purchase-flow-formula-content">
													<div class="purchase-flow-formula-expression">
														{{ row.expression }}
													</div>
													<div
														v-if="row.result"
														class="purchase-flow-formula-result"
													>
														结果：<strong>{{ row.result }}</strong>
													</div>
												</div>
											</div>
										</div>
									</div>
									<div
										v-if="getSelectedFlowCoefficientRows().length"
										class="purchase-flow-coefficient-panel"
									>
										<div class="purchase-flow-coefficient-head">
											<strong>系数复盘</strong>
											<span>按当时快照还原原始系数、波动系数和最终系数</span>
										</div>
										<div class="purchase-flow-coefficient-list">
											<div
												v-for="row in getSelectedFlowCoefficientRows()"
												:key="row.key"
												class="purchase-flow-coefficient-row"
											>
												<div class="purchase-flow-coefficient-main">
													<strong>{{ row.label }}</strong>
													<el-tooltip
														v-if="row.tooltipLines.length"
														effect="light"
														placement="top"
														:show-after="250"
														popper-class="purchase-flow-detail-tooltip"
													>
														<template #content>
															<div
																class="purchase-flow-coefficient-tooltip"
															>
																<div
																	v-for="(
																		line, lineIndex
																	) in row.tooltipLines"
																	:key="lineIndex"
																>
																	{{ line }}
																</div>
															</div>
														</template>
														<span
															class="purchase-flow-coefficient-formula"
															>{{ row.formula }}</span
														>
													</el-tooltip>
													<span
														v-else
														class="purchase-flow-coefficient-formula"
														>{{ row.formula }}</span
													>
												</div>
												<div class="purchase-flow-coefficient-metrics">
													<span
														>原始
														<strong>{{
															row.rawCoefficient
														}}</strong></span
													>
													<span
														>波动
														<strong>{{
															row.volatilityCoefficient
														}}</strong></span
													>
													<span
														>最终
														<strong>{{
															row.adjustedCoefficient
														}}</strong></span
													>
													<span v-if="row.subtotal !== '-'">
														数量 <strong>{{ row.subtotal }}</strong>
													</span>
												</div>
											</div>
										</div>
									</div>
									<div
										v-if="getSelectedFlowNodeBreakdown().length"
										class="purchase-flow-collapse-block"
									>
										<div class="purchase-flow-collapse-subtitle">全部拆分</div>
										<div class="purchase-flow-breakdown-list">
											<div
												v-for="item in getSelectedFlowNodeBreakdown()"
												:key="item.key"
												class="purchase-flow-breakdown-item"
											>
												<span>{{ item.label }}</span>
												<strong>{{ item.value }}</strong>
												<em>{{ item.extra }}</em>
											</div>
										</div>
									</div>
								</el-collapse-item>

								<el-collapse-item name="records">
									<template #title>
										<div class="purchase-flow-collapse-title">
											<strong>相关记录</strong>
											<span
												>{{ getSelectedFlowNodeRecords().length }} 条</span
											>
										</div>
									</template>
									<div
										v-if="getSelectedFlowNodeRecords().length"
										class="purchase-flow-record-list"
									>
										<div
											v-for="item in getSelectedFlowNodeRecords()"
											:key="item.key"
											class="purchase-flow-record-item"
										>
											<div>
												<strong>{{ item.title }}</strong>
												<span>{{ item.meta }}</span>
											</div>
											<em>{{ item.value }}</em>
										</div>
									</div>
									<el-empty v-else description="暂无相关记录" :image-size="40" />
								</el-collapse-item>

								<el-collapse-item name="events">
									<template #title>
										<div class="purchase-flow-collapse-title">
											<strong>操作记录</strong>
											<span
												>{{
													getPurchaseFlowVisibleEvents().length
												}}
												条</span
											>
										</div>
									</template>
									<div
										v-if="getPurchaseFlowVisibleEvents().length"
										class="purchase-flow-event-list"
									>
										<div
											v-for="event in getPurchaseFlowVisibleEvents()"
											:key="`${event.type}-${event.ref_sn}-${event.time}`"
											class="purchase-flow-event"
										>
											<div class="purchase-flow-event-time">
												{{ formatDate(event.time) }}
											</div>
											<div class="purchase-flow-event-body">
												<div class="purchase-flow-event-title">
													<el-tag
														size="small"
														effect="plain"
														:type="getFlowEventTagType(event)"
													>
														{{ event.source || "-" }}
													</el-tag>
													<strong>{{ event.title || "-" }}</strong>
													<span>{{ event.ref_sn || "" }}</span>
												</div>
												<div class="purchase-flow-event-desc">
													{{ event.description || "-" }}
												</div>
												<div class="purchase-flow-event-user">
													操作人：{{ event.operator_name || "-" }}
												</div>
											</div>
										</div>
									</div>
									<el-empty
										v-else
										description="当前节点暂无操作记录"
										:image-size="40"
									/>
								</el-collapse-item>
							</el-collapse>
						</aside>
					</div>
				</template>
			</div>
		</el-drawer>

		<el-drawer v-model="logisticsDrawer.visible" title="采购单物流明细" size="720px">
			<template #header>
				<div class="logistics-drawer-header">
					<span>物流明细 - {{ logisticsDrawer.orderSn }}</span>
					<el-tooltip
						content="先刷新采购单本地包裹，再按规则尝试查询快递100；45分钟内、已签收、忽略、需人工判断的包裹会跳过。"
						placement="bottom"
					>
						<el-button
							type="primary"
							size="small"
							plain
							:icon="Refresh"
							@click="forceSyncLogistics(logisticsDrawer.orderSn)"
							:loading="logisticsDrawer.syncing"
						>
							刷新/查询物流
						</el-button>
					</el-tooltip>
				</div>
			</template>

			<div class="logistics-content" v-loading="logisticsDrawer.loading">
				<el-empty v-if="!logisticsDrawer.data.length" description="暂无任何包裹物流信息" />
				<el-collapse
					v-else
					v-model="logisticsDrawer.expandedPkgs"
					class="logistics-collapse"
				>
					<el-collapse-item
						v-for="(pkg, pkgIndex) in logisticsDrawer.data"
						:key="pkg.pol_id || pkgIndex"
						:name="String(pkgIndex)"
					>
						<template #title>
							<div class="logistics-collapse-title">
								<div class="logistics-collapse-main">
									<span class="logistics-company">{{
										pkg.logistics_company || "未知物流"
									}}</span>
									<LogisticsSourcePopover
										v-if="getPackageSourceCount(pkg) > 1"
										:sources="getPackageSourceItems(pkg)"
										:count="getPackageSourceCount(pkg)"
									>
										<template #reference>
											<button
												type="button"
												class="logistics-source-trigger"
												@click.stop
											>
												查看 {{ getPackageSourceCount(pkg) }} 条来源
											</button>
										</template>
									</LogisticsSourcePopover>
									<span class="logistics-order-no">{{
										pkg.logistics_order_no || "-"
									}}</span>
								</div>
								<el-tag
									size="small"
									effect="dark"
									:type="getPackageLogisticsTagType(pkg)"
								>
									{{ getPackageLogisticsStatusText(pkg) }}
								</el-tag>
							</div>
						</template>

						<div class="logistics-meta-row">
							最后同步：{{ formatDate(pkg.last_sync_time) }}
						</div>
						<div class="logistics-query-row">
							<span>查询状态</span>
							<el-tooltip :content="getQueryBlockText(pkg)" placement="top">
								<el-tag size="small" :type="getQueryStatusTagType(pkg)">
									{{ getQueryBlockText(pkg) }}
								</el-tag>
							</el-tooltip>
							<span v-if="pkg.next_query_after" class="logistics-query-next">
								下次可查：{{ formatDate(pkg.next_query_after) }}
							</span>
						</div>
						<div v-if="getPackageSourceItems(pkg).length" class="logistics-source-list">
							<div class="logistics-source-title">
								<span>来源明细（{{ getPackageSourceCount(pkg) }} 条）</span>
								<small
									>同一采购单同一运单只生成一个包裹；这里保留领星返回的全部来源。</small
								>
							</div>
							<div
								v-for="(source, sourceIndex) in getPackageSourceItems(pkg)"
								:key="`${pkg.id || pkg.logistics_order_no}-${sourceIndex}`"
								class="logistics-source-item"
							>
								<span class="source-index">{{ sourceIndex + 1 }}</span>
								<div class="source-main">
									<div class="source-company-line">
										<span class="source-company">{{
											getSourceCompany(source) || "-"
										}}</span>
										<el-tag
											size="small"
											:type="source.is_exception_source ? 'info' : 'success'"
											effect="plain"
										>
											{{
												source.is_exception_source
													? "例外来源"
													: "快递查询来源"
											}}
										</el-tag>
									</div>
									<div class="source-fields">
										<span>pol_id：{{ getSourcePolId(source) || "-" }}</span>
										<span
											>运单号：{{ getSourceTrackingNo(source) || "-" }}</span
										>
									</div>
								</div>
							</div>
						</div>
						<div class="logistics-action-row">
							<el-tooltip
								:disabled="pkg.can_query"
								:content="getQueryBlockText(pkg)"
								placement="top"
							>
								<span>
									<el-button
										type="primary"
										size="small"
										plain
										:icon="Refresh"
										:disabled="!pkg.can_query"
										:loading="logisticsDrawer.queryingPackageId === pkg.id"
										@click.stop="queryLogisticsPackage(pkg)"
									>
										查询快递100
									</el-button>
								</span>
							</el-tooltip>
						</div>
						<el-timeline v-if="getTraceList(pkg).length" class="logistics-timeline">
							<el-timeline-item
								v-for="(trace, traceIndex) in getTraceList(pkg)"
								:key="traceIndex"
								:timestamp="trace.accept_time || '-'"
								:type="traceIndex === 0 ? 'primary' : 'info'"
								:hollow="traceIndex !== 0"
							>
								<div class="trace-remark">{{ trace.remark || "-" }}</div>
							</el-timeline-item>
						</el-timeline>
						<el-empty v-else description="暂无轨迹信息" :image-size="48" />
					</el-collapse-item>
				</el-collapse>
			</div>
		</el-drawer>

		<purchase-plan-product-batch-ship-preflight-dialog
			v-model:visible="batchShipPreflightVisible"
			:loading="batchShipPreflightLoading"
			:result="batchShipPreflightResult"
			:rows="batchShipPreflightRows"
			@recheck="rerunBatchShipPreflight"
			@continue="continueBatchShipAfterPreflight"
		/>

		<purchase-plan-product-batch-ship-dialog
			v-model:visible="batchShipDialogVisible"
			:items="batchShipItems"
			:data-sync-state="batchShipDataSyncState"
			:review-restore-payload="batchShipReviewRestorePayload"
			:review-no="batchShipReviewNo"
			@retry-sync-failed="retryBatchShipFailedDataSync"
			@saved-review="handleBatchShipReviewSaved"
		/>

		<el-dialog
			v-model="shelfSelectionVisible"
			:title="shelfSelectionDialogTitle"
			width="min(1080px, 96vw)"
			class="shelf-selection-dialog"
			destroy-on-close
		>
			<div class="shelf-selection">
				<div class="shelf-selection-header">
					<div class="shelf-selection-summary">
						<div class="shelf-selection-summary-main">
							<span>已选 <b>{{ shelfSelectionSelectedItems.length }}</b> 个采购单产品</span>
							<span>涉及 <b>{{ shelfSelectionSelectedProductCount }}</b> 个产品</span>
							<span>当前筛选 <b>{{ shelfSelectionCurrentMatchedCount }}</b> 个</span>
							<el-tooltip
								v-if="shelfSelectionSelectedOutsideCurrentCount"
								:content="shelfSelectionManualAddedTooltip"
								placement="top"
							>
								<el-tag size="small" type="warning" effect="plain">
									手动加入 {{ shelfSelectionSelectedOutsideCurrentCount }} 个
								</el-tag>
							</el-tooltip>
						</div>
					</div>

					<div class="shelf-selection-control-panel">
						<div class="shelf-selection-control-row">
							<div class="shelf-selection-control-copy">
								<div class="shelf-selection-control-title">查看范围</div>
								<div class="shelf-selection-control-desc">
									推荐处理看当前这批，全部采购单用于手动多选。
								</div>
							</div>
							<el-radio-group
								v-model="shelfSelectionViewMode"
								size="small"
								class="shelf-selection-view-mode"
							>
								<el-radio-button label="recommended">推荐处理</el-radio-button>
								<el-radio-button label="all">全部采购单</el-radio-button>
							</el-radio-group>
						</div>

						<div class="shelf-selection-control-row">
							<div class="shelf-selection-control-copy">
								<div class="shelf-selection-control-title">批量勾选</div>
								<div class="shelf-selection-control-desc">
									这里只改勾选，不会直接提交。
								</div>
							</div>
							<div class="shelf-selection-batch-buttons">
								<el-button size="small" @click="selectShelfSelectionCurrentMatched">
									选中推荐
								</el-button>
								<el-tooltip :content="shelfSelectionSelectAllTooltip" placement="top">
									<el-button size="small" @click="selectShelfSelectionActionable">
										选中全部
									</el-button>
								</el-tooltip>
								<el-button size="small" @click="clearShelfSelection">清空选择</el-button>
							</div>
						</div>
					</div>
				</div>

				<div class="shelf-selection-products">
					<div
						v-for="group in visibleShelfSelectionGroups"
						:key="group.productKey"
						class="shelf-selection-product"
					>
						<div class="shelf-selection-product-header">
							<el-checkbox
								:model-value="isShelfSelectionProductChecked(group)"
								:indeterminate="isShelfSelectionProductIndeterminate(group)"
								@change="toggleShelfSelectionProduct(group, $event)"
							/>
							<div class="shelf-selection-product-image">
								<el-image
									v-if="getProductImageUrl(group.row)"
									:src="getProductImageUrl(group.row)"
									fit="contain"
									@error="handleProductImageError(group.row)"
								/>
								<span v-else>无图</span>
							</div>
							<div class="shelf-selection-product-main">
								<div class="shelf-selection-product-title">
									{{ getShelfSelectionProductTitle(group) }}
								</div>
								<div class="shelf-selection-product-meta">
									<span>{{ group.product?.seller_name || group.product?.shop || "-" }}</span>
									<span>{{ group.product?.marketplace || "-" }}</span>
									<span>ASIN {{ group.product?.asin || "-" }}</span>
									<span>MSKU {{ group.product?.msku || "-" }}</span>
									<span>本地SKU {{ group.product?.local_sku || group.product?.product_code || "-" }}</span>
								</div>
							</div>
							<div class="shelf-selection-product-counts">
								<span>当前命中 {{ group.currentMatchedCount }}</span>
								<span>可处理 {{ group.actionableCount }}</span>
								<span>已选 {{ getShelfSelectionGroupSelectedCount(group) }}</span>
							</div>
							<el-button text type="primary" @click="toggleShelfSelectionProductExpand(group)">
								{{ isShelfSelectionProductExpanded(group) ? "收起" : "展开" }}
							</el-button>
						</div>

						<div
							v-show="isShelfSelectionProductExpanded(group)"
							class="shelf-selection-order-list"
						>
							<div
								v-for="selectionOrder in group.visibleOrders"
								:key="selectionOrder.key"
								class="shelf-selection-order"
								:class="{
									'is-current-matched': selectionOrder.currentMatched,
									'is-disabled': !selectionOrder.actionable
								}"
							>
								<el-checkbox
									:model-value="selectionOrder.selected"
									:disabled="!selectionOrder.actionable"
									@change="toggleShelfSelectionOrder(selectionOrder, $event)"
								/>
								<div class="shelf-selection-order-main">
									<div class="shelf-selection-order-top">
										<span class="shelf-selection-order-sn">
											{{ selectionOrder.orderSn }}
										</span>
										<el-tag
											size="small"
											effect="plain"
											:type="
												getPurchaseOrderStatusType(
													selectionOrder.order?.purchase_order_status
												)
											"
										>
											{{
												selectionOrder.order?.purchase_order_status_text ||
												"领星状态-"
											}}
										</el-tag>
										<el-tag
											size="small"
											effect="plain"
											:type="
												getFulfillmentStatusTagType(
													getPurchaseOrderFulfillmentSummary(
														selectionOrder.order
													).fulfillment_status
												)
											"
										>
											{{
												getPurchaseOrderFulfillmentSummary(selectionOrder.order)
													.fulfillment_status_text || "艾为状态-"
											}}
										</el-tag>
										<el-tag
											v-if="selectionOrder.order?.logistics_status_text"
											size="small"
											effect="plain"
											:type="
												getLogisticsTagType(
													selectionOrder.order?.logistics_status
												)
											"
										>
											{{ selectionOrder.order?.logistics_status_text }}
										</el-tag>
										<el-tag
											v-if="selectionOrder.currentMatched"
											size="small"
											type="success"
											effect="plain"
										>
											当前命中
										</el-tag>
										<el-tag v-else size="small" type="info" effect="plain">
											不在当前筛选
										</el-tag>
									</div>
									<div class="shelf-selection-order-metrics">
										<span>采购实际 {{ formatMetricNumber(selectionOrder.order?.quantity_real_sum) }}</span>
										<span>实际发货 {{ formatMetricNumber(selectionOrder.order?.shipment_summary?.actual_shipment_qty_sum) }}</span>
										<span>预计可发 {{ formatMetricNumber(getPurchaseOrderFulfillmentSummary(selectionOrder.order).estimated_shippable_qty) }}</span>
										<span>实际可发 {{ formatMetricNumber(getPurchaseOrderFulfillmentSummary(selectionOrder.order).actual_shippable_qty) }}</span>
										<span>入库 {{ formatMetricNumber(selectionOrder.order?.quantity_entry_sum) }}</span>
										<span>采购时间 {{ formatShortDateTime(selectionOrder.order?.purchase_order_time) || "-" }}</span>
									</div>
									<div class="shelf-selection-order-plans">
										<span class="shelf-selection-order-plans-label">关联采购计划</span>
										<template v-if="getShelfSelectionOrderPlanSns(selectionOrder).length">
											<el-tag
												v-for="planSn in getShelfSelectionOrderPlanSns(selectionOrder).slice(0, 4)"
												:key="planSn"
												size="small"
												effect="plain"
											>
												{{ planSn }}
											</el-tag>
											<span
												v-if="getShelfSelectionOrderPlanSns(selectionOrder).length > 4"
												class="shelf-selection-order-plan-more"
											>
												等 {{ getShelfSelectionOrderPlanSns(selectionOrder).length }} 个
											</span>
										</template>
										<span v-else>-</span>
									</div>
									<div
										v-if="!selectionOrder.actionable && selectionOrder.disabledReason"
										class="shelf-selection-order-reason"
									>
										{{ selectionOrder.disabledReason }}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<el-input
					v-if="shelfSelectionAction === 'shelve'"
					v-model="shelfSelectionRemark"
					type="textarea"
					:rows="2"
					class="shelf-selection-remark"
					placeholder="搁置原因，可不填"
				/>
			</div>

			<template #footer>
				<div class="shelf-selection-footer">
					<div class="shelf-selection-footer-tip">
						{{ shelfSelectionResultTip }}
					</div>
					<div>
						<el-button @click="shelfSelectionVisible = false">取消</el-button>
						<el-button
							type="primary"
							:loading="shelvingLoading || unshelvingLoading"
							:disabled="!shelfSelectionSelectedItems.length"
							@click="confirmShelfSelection"
						>
							确认{{ shelfSelectionActionText }}
							{{ shelfSelectionSelectedItems.length }} 个
						</el-button>
					</div>
				</div>
			</template>
		</el-dialog>
	</div>
</template>

<script lang="ts" name="app-bsr_purchase_plan_product_view" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox } from "element-plus";
import { InfoFilled, Refresh, RefreshRight, Search, View, Warning } from "@element-plus/icons-vue";
import { convert_image_url } from "/$/app/utils";
import LogisticsSourcePopover from "../components/LogisticsSourcePopover.vue";
import PurchasePlanProductBatchShipDialog from "../components/PurchasePlanProductBatchShipDialog.vue";
import PurchasePlanProductBatchShipPreflightDialog from "../components/PurchasePlanProductBatchShipPreflightDialog.vue";
import {
	buildLogisticsQuerySummary,
	buildPackageSnapshot,
	formatLogisticsQuerySummaryMessage,
	getQueryBlockReasonText
} from "/@/modules/app/utils/logistics-query-summary";
import {
	getLogisticsStatusLabel as getSharedLogisticsStatusLabel,
	logisticsStatusGroups
} from "/@/modules/app/utils/logistics-status-options";
import {
	buildShelfSelectionGroups,
	getSelectedShelfSelectionItems,
	getShelfSelectionGroupSelectedCount,
	getShelfSelectionStats,
	isShelfSelectionOrderVisible,
	type ShelfSelectionAction,
	type ShelfSelectionGroup,
	type ShelfSelectionOrder
} from "/@/modules/app/utils/purchase-plan-product-shelf-selection";

const { service } = useCool();
const route = useRoute();

const DEFAULT_FULFILLMENT_STATUS = "shippable";
const DEFAULT_WORK_STATUS = "current";

const loading = ref(false);
const refreshing = ref(false);
const syncLatestRefreshing = ref(false);
const shelvingLoading = ref(false);
const unshelvingLoading = ref(false);
const tableData = ref<any[]>([]);
const tableHeight = "100%";
const selectedRows = ref<any[]>([]);
const statusCounts = reactive({
	loading: false,
	error: "",
	fulfillment: {} as Record<string, number>,
	purchaseOrder: {} as Record<string, number>,
	logistics: {} as Record<string, number>
});
const batchShipDialogVisible = ref(false);
const batchShipItems = ref<any[]>([]);
const batchShipReviewNo = ref("");
const batchShipReviewRestorePayload = ref<any | null>(null);
const batchShipPreflightVisible = ref(false);
const batchShipPreflightLoading = ref(false);
const batchShipPreflightRows = ref<any[]>([]);
const batchShipPreflightResult = ref<any | null>(null);
const batchShipDataSyncState = ref<any>({
	status: "idle",
	syncing: false,
	message: "",
	sections: {}
});
const batchShipCurrentRowKeys = ref<string[]>([]);
const selectedPlanSnMap = reactive<Record<string, string>>({});
const selectedPurchaseOrderSnMap = reactive<Record<string, string>>({});
const purchaseOrderPopoverVisibleMap = reactive<Record<string, boolean>>({});
const imageFallbackMap = reactive<Record<string, number>>({});
const shelfSelectionVisible = ref(false);
const shelfSelectionAction = ref<ShelfSelectionAction>("shelve");
const shelfSelectionGroups = ref<ShelfSelectionGroup[]>([]);
const shelfSelectionExpandedMap = reactive<Record<string, boolean>>({});
const shelfSelectionShowAll = ref(false);
const shelfSelectionRemark = ref("历史数据，暂不处理");

const canOpenBatchShipDialog = computed(() => {
	return !isShelvedWorkbench.value && selectedRows.value.some(hasBatchShipRelatedPurchaseOrder);
});
const isShelvedWorkbench = computed(() => filters.work_status === "shelved");
const selectedShelfTargetCount = computed(() => getShelfTargetItems(selectedRows.value).length);
const shelfWorkbenchActionText = computed(() => (isShelvedWorkbench.value ? "恢复" : "搁置"));
const shelfTargetTooltip = computed(() => {
	if (!selectedShelfTargetCount.value) {
		return `请先选择至少一个可${shelfWorkbenchActionText.value}的采购单产品`;
	}
	return `${selectedShelfTargetCount.value} 表示选中产品下当前命中的采购单产品数量，不是产品数，也不是整张采购单数。`;
});
const shelfSelectionSelectedItems = computed(() =>
	getSelectedShelfSelectionItems(shelfSelectionGroups.value)
);
const shelfSelectionStats = computed(() => getShelfSelectionStats(shelfSelectionGroups.value));
const shelfSelectionSelectedProductCount = computed(
	() => shelfSelectionStats.value.selectedProductCount
);
const shelfSelectionCurrentMatchedCount = computed(
	() => shelfSelectionStats.value.currentMatchedCount
);
const shelfSelectionSelectedOutsideCurrentCount = computed(
	() => shelfSelectionStats.value.selectedOutsideCurrentCount
);
const shelfSelectionActionText = computed(() =>
	shelfSelectionAction.value === "shelve" ? "搁置" : "恢复"
);
const shelfSelectionDialogTitle = computed(
	() => `选择要${shelfSelectionActionText.value}的采购单产品`
);
const shelfSelectionSelectAllTooltip = computed(
	() => `选择当前产品下全部可${shelfSelectionActionText.value}的采购单产品`
);
const shelfSelectionManualAddedTooltip = computed(
	() =>
		`这 ${shelfSelectionSelectedOutsideCurrentCount.value} 个不在当前筛选里，是你从全部采购单里手动勾进来的，也会一起提交。`
);
const shelfSelectionViewMode = computed({
	get: () => (shelfSelectionShowAll.value ? "all" : "recommended"),
	set: (value: string) => {
		shelfSelectionShowAll.value = value === "all";
	}
});
const shelfSelectionCurrentListName = computed(() =>
	shelfSelectionAction.value === "shelve" ? "当前列表" : "已搁置列表"
);
const shelfSelectionResultTip = computed(() => {
	const stats = shelfSelectionStats.value;
	const actionText = shelfSelectionActionText.value;
	const listName = shelfSelectionCurrentListName.value;

	if (!stats.selectedCount) {
		return `请选择需要${actionText}的采购单产品。`;
	}
	if (stats.currentMatchedUnselectedCount > 0) {
		return `当前命中 ${stats.currentMatchedCount} 个，已选 ${stats.currentMatchedSelectedCount} 个；确认${actionText}后仍有 ${stats.currentMatchedUnselectedCount} 个当前命中的采购单产品会留在${listName}。`;
	}
	if (stats.currentMatchedCount > 0 && stats.currentMatchedSelectedCount === stats.currentMatchedCount) {
		return `已选中全部当前命中的 ${stats.currentMatchedCount} 个采购单产品；确认${actionText}后这些采购单产品会从${listName}移除。`;
	}
	return `确认后只${actionText}已勾选的采购单产品；未勾选的采购单不受影响。`;
});
const visibleShelfSelectionGroups = computed(() => {
	return shelfSelectionGroups.value
		.map((group) => ({
			...group,
			visibleOrders: getVisibleShelfSelectionOrders(group)
		}))
		.filter((group) => group.visibleOrders.length > 0);
});

const filters = reactive({
	work_status: DEFAULT_WORK_STATUS,
	keyWord: "",
	marketplace: "",
	seller_name: "",
	product_code: "",
	fulfillment_status: DEFAULT_FULFILLMENT_STATUS,
	purchase_order_statuses: [] as number[],
	logistics_status: ""
});

const fulfillmentStatusOptions = [
	{
		label: "全部",
		value: "",
		short: "不按艾为状态筛选",
		rules: ["展示当前其它筛选条件下的全部产品。"],
		formula: "数量 = 可发货 + 完成 + 异常完成 + 异常。",
		example: "适合先看全量，再按领星状态或物流状态继续缩小范围。"
	},
	{
		label: "可发货",
		value: "shippable",
		short: "可进入发货",
		rules: [
			"领星状态：待到货 / 已完成。",
			"物流状态：在途 / 部分签收 / 全部签收 / 已确认收货。",
			"异常状态：无未处理残次品 / 商家少发。",
			"数量条件：实际可发 > 0。"
		],
		formula: "实际可发 = 采购实际 - 实际发货 - 残次品 - 商家少发。",
		example: "采购实际 100，实际发货 0，无异常，则实际可发 100。"
	},
	{
		label: "完成",
		value: "completed",
		short: "无需继续发货",
		rules: ["实际可发 <= 0。", "没有未处理残次品 / 商家少发。", "人工完成也归入完成。"],
		formula: "实际可发 = 采购实际 - 实际发货 - 残次品 - 商家少发。",
		example: "采购实际 100，实际发货 100，无未处理异常，则完成。"
	},
	{
		label: "异常完成",
		value: "exception_completed",
		short: "异常已处理完",
		rules: ["存在残次品或商家少发。", "对应异常都已标记处理。", "最终实际可发 <= 0。"],
		formula: "实际可发 = 采购实际 - 实际发货 - 已处理残次品 - 已处理商家少发。",
		example: "采购实际 100，实际发货 95，残次 3 已处理，少发 2 已处理，则异常完成。"
	},
	{
		label: "异常",
		value: "abnormal",
		short: "需要人工判断",
		rules: [
			"未处理残次品 / 商家少发。",
			"物流阻断：缺手机号、待自动识别、超时、轨迹异常。",
			"采购链路未就绪：无采购单或状态不满足发货条件。"
		],
		formula: "异常状态不进入批量发货；需要先处理异常或补全物流信息。",
		example: "采购单缺手机号、物流超时未签收、残次品未处理，都会归入异常。"
	}
];

const purchaseOrderStatusGroups = [
	{
		label: "常用",
		options: [
			{
				label: "待到货",
				value: 2,
				field: "purchase_order.status = 2",
				rule: "领星采购单原始状态为待到货。"
			},
			{
				label: "已完成",
				value: 9,
				field: "purchase_order.status = 9",
				rule: "领星采购单原始状态为已完成。"
			}
		]
	},
	{
		label: "采购流程",
		options: [
			{
				label: "待下单",
				value: 1,
				field: "purchase_order.status = 1",
				rule: "领星采购单原始状态为待下单。"
			},
			{
				label: "待提交",
				value: 3,
				field: "purchase_order.status = 3",
				rule: "领星采购单原始状态为待提交。"
			},
			{
				label: "审批待审",
				value: 121,
				field: "purchase_order.status = 121",
				rule: "领星审批流状态为待审核。"
			},
			{
				label: "审批驳回",
				value: 122,
				field: "purchase_order.status = 122",
				rule: "领星审批流状态为驳回。"
			}
		]
	},
	{
		label: "无效单据",
		options: [
			{
				label: "作废",
				value: -1,
				field: "purchase_order.status = -1",
				rule: "领星采购单原始状态为作废，通常不参与实际履约。"
			},
			{
				label: "审批作废",
				value: 124,
				field: "purchase_order.status = 124",
				rule: "领星审批流状态为作废。"
			}
		]
	}
];

const purchaseOrderStatusOptions = purchaseOrderStatusGroups.flatMap((group) => group.options);

const pagination = reactive({
	page: 1,
	size: 20,
	total: 0
});

const detailVisible = ref(false);
const detailProduct = ref<any>(null);
const detailPlan = ref<any>(null);
const logisticsDrawer = reactive({
	visible: false,
	loading: false,
	syncing: false,
	queryingPackageId: null as number | null,
	orderSn: "",
	data: [] as any[],
	expandedPkgs: ["0"] as string[]
});

const logisticsPopoverState = reactive({
	orderSn: "",
	loading: false,
	data: [] as any[]
});

const fulfillmentDialog = reactive({
	visible: false,
	loading: false,
	processing: false,
	logsLoading: false,
	row: null as any,
	order: null as any,
	form: {
		defective_qty: 0,
		defective_status: 0,
		defective_remark: "",
		defective_process_remark: "",
		short_shipped_qty: 0,
		short_shipped_status: 0,
		short_shipped_remark: "",
		short_shipped_process_remark: "",
		document_status: 0,
		assigned_to_username: "",
		assigned_to_nickname: "",
		assigned_time: null as any,
		confirmed_by_username: "",
		confirmed_by_nickname: "",
		confirmed_time: null as any,
		confirm_remark: "",
		manual_completed: 0,
		manual_completed_remark: "",
		manual_completed_by_username: "",
		manual_completed_time: null as any
	},
	logs: [] as any[]
});

const purchaseOrderFlowDrawer = reactive({
	visible: false,
	loading: false,
	row: null as any,
	order: null as any,
	data: null as any,
	selectedNodeKey: "analysis",
	eventCollapseNames: [] as string[],
	formulaExpanded: false,
	scale: 1,
	translateX: 0,
	translateY: 0,
	dragging: false,
	dragStartX: 0,
	dragStartY: 0,
	dragOriginX: 0,
	dragOriginY: 0,
	nodeDragging: false,
	nodeDragKey: "",
	nodeDragStartX: 0,
	nodeDragStartY: 0,
	nodeDragOriginX: 0,
	nodeDragOriginY: 0,
	nodePositions: {} as Record<string, { x: number; y: number }>
});

const fulfillmentDialogBase = computed(() => {
	const order = fulfillmentDialog.order;
	const shipment = getPurchaseOrderShipmentSummary(order);
	return {
		quantity_entry_sum: getPurchaseOrderEntryQuantity(order),
		actual_shipment_qty_sum: Number(shipment.actual_shipment_qty_sum) || 0
	};
});

const fulfillmentDialogEstimatedQty = computed(() => {
	return (
		fulfillmentDialogBase.value.quantity_entry_sum -
		fulfillmentDialogBase.value.actual_shipment_qty_sum
	);
});

const fulfillmentDialogActualQty = computed(() => {
	if (isFulfillmentDialogManualCompleted.value) return 0;
	return (
		fulfillmentDialogEstimatedQty.value -
		(Number(fulfillmentDialog.form.defective_qty) || 0) -
		(Number(fulfillmentDialog.form.short_shipped_qty) || 0)
	);
});

const isFulfillmentDialogManualCompleted = computed(() => {
	return Number(fulfillmentDialog.form.manual_completed) === 1;
});

const isFulfillmentDialogLocked = computed(() => {
	return Number(fulfillmentDialog.form.document_status) === 3;
});

const isFulfillmentDialogInWorkflow = computed(() => {
	const status = Number(fulfillmentDialog.form.document_status) || 0;
	return status > 0 && status < 3;
});

const isFulfillmentDialogReadonly = computed(() => {
	return isFulfillmentDialogLocked.value;
});

const canManualCompleteFulfillment = computed(() => {
	return (
		!isFulfillmentDialogReadonly.value &&
		Boolean(String(fulfillmentDialog.form.manual_completed_remark || "").trim())
	);
});

const fulfillmentDialogError = computed(() => {
	const defectiveQty = Number(fulfillmentDialog.form.defective_qty) || 0;
	const shortShippedQty = Number(fulfillmentDialog.form.short_shipped_qty) || 0;
	if (defectiveQty < 0 || shortShippedQty < 0) return "数量不能小于 0";
	if (!Number.isInteger(defectiveQty) || !Number.isInteger(shortShippedQty)) {
		return "数量必须是整数";
	}
	if (defectiveQty + shortShippedQty > fulfillmentDialogEstimatedQty.value) {
		return `残次品和商家少发合计不能超过预计可发 ${fulfillmentDialogEstimatedQty.value}`;
	}
	return "";
});

const sourceTips = {
	productImage:
		"优先来源：产品表 app_amz_bsr_product_listing_lingxing.image_url；失败后兜底使用 SKU 匹配的领星采购计划表 app_amz_bsr_purchase_plan_lingxing.pic_url",
	productInfo: "来源：产品表 + 补货中心；待交付/采购计划复用产品列表页接口",
	productStore: "来源：产品表 app_amz_bsr_product_listing_lingxing.seller_name / marketplace",
	productIdentity:
		"来源：产品表 app_amz_bsr_product_listing_lingxing.asin / msku / local_sku / fnsku",
	productName: "来源：产品表 app_amz_bsr_product_listing_lingxing.item_name",
	lingxingPlan: "来源：领星采购计划表 app_amz_bsr_purchase_plan_lingxing.plan_sn",
	lingxingQuantity: "来源：领星采购计划表 app_amz_bsr_purchase_plan_lingxing.quantity_plan",
	lingxingStatus: "来源：领星采购计划表 app_amz_bsr_purchase_plan_lingxing.status_text",
	lingxingUser:
		"来源：领星采购计划表 app_amz_bsr_purchase_plan_lingxing.creator_real_name / cg_opt_username",
	lingxingSupplierWarehouse:
		"来源：领星采购计划表 app_amz_bsr_purchase_plan_lingxing.supplier_name / warehouse_name",
	lingxingArrival: "来源：领星采购计划表 app_amz_bsr_purchase_plan_lingxing.expect_arrive_time",
	localQuantity: "来源：本地创建记录表 app_amz_bsr_analysis_record_lingxing.quantity_plan",
	localSummary:
		"来源：本地创建记录表 app_amz_bsr_analysis_record_lingxing.expected_sales / remark",
	localManualRemark: "来源：本地创建记录表 app_amz_bsr_analysis_record_lingxing.manual_remark",
	purchaseLogistics:
		"来源：采购单物流包裹表 app_amz_bsr_purchase_order_logistics_package；人工确认会写入 app_amz_bsr_purchase_order_logistics_confirm_log",
	purchaseOrder:
		"来源：采购单子项表 + 采购单主表 + 履约调整表；可发货需要采购单完成且物流已签收或人工确认",
	purchaseFlow:
		"来源：当前产品采购单维度流程接口，串联补货分析、采购计划、采购单、发货计划、实际发货单和履约异常日志",
	shipmentPlan:
		"来源：发货计划表 app_amz_bsr_shipment_plan_lingxing.purchase_plan_sn / purchase_order_sn 绑定当前采购计划，再通过 isp_id 关联 app_amz_bsr_shipment_actual_lingxing 实际发货单"
};

const requestParams = computed(() => {
	const params: any = {
		page: pagination.page,
		size: pagination.size
	};

	Object.entries(filters).forEach(([key, value]) => {
		if (Array.isArray(value)) {
			if (value.length) {
				params[key] = value;
			}
			return;
		}

		const text = String(value || "").trim();
		if (text) {
			params[key] = text;
		}
	});

	return params;
});

type PurchaseOrderRefreshContext = {
	rowKey: string;
	orderSn: string;
	filterStatus: string;
	filterLabel: string;
	filterPurchaseOrderStatuses: number[];
	filterPurchaseOrderStatusLabel: string;
	filterLogisticsStatus: string;
	filterLogisticsLabel: string;
};

type PurchaseOrderRefreshResult = PurchaseOrderRefreshContext & {
	requested: boolean;
	rowFound: boolean;
	orderFound: boolean;
	filterMatched: boolean;
	preserved: boolean;
};

function getFulfillmentStatusLabel(status = filters.fulfillment_status) {
	if (!status) return "全部";
	return fulfillmentStatusOptions.find((item) => item.value === status)?.label || status;
}

function getLogisticsStatusLabel(status = filters.logistics_status) {
	if (!status) return "全部物流";
	return getSharedLogisticsStatusLabel(status) || status;
}

function getActivePurchaseOrderStatusValues(value = filters.purchase_order_statuses) {
	return (Array.isArray(value) ? value : [value])
		.map((item) => String(item ?? "").trim())
		.filter(Boolean)
		.map((item) => Number(item))
		.filter((item) => Number.isFinite(item));
}

function getPurchaseOrderStatusLabel(status: number | string) {
	const num = Number(status);
	return purchaseOrderStatusOptions.find((item) => item.value === num)?.label || String(status);
}

function getPurchaseOrderStatusFilterLabel(value = filters.purchase_order_statuses) {
	const values = getActivePurchaseOrderStatusValues(value);
	if (!values.length) return "全部领星状态";
	return values.map(getPurchaseOrderStatusLabel).join(" / ");
}

function normalizeStatusCountMap(value: any) {
	const result: Record<string, number> = {};
	if (!value || typeof value !== "object") return result;

	Object.entries(value).forEach(([key, count]) => {
		const number = Number(count);
		result[String(key)] = Number.isFinite(number) ? number : 0;
	});
	return result;
}

function getStatusCountText(map: Record<string, number>, key: string | number) {
	if (statusCounts.loading) return "--";
	if (statusCounts.error) return "--";
	const value = map[String(key)];
	return Number.isFinite(Number(value)) ? String(Number(value)) : "0";
}

function getFulfillmentStatusCountText(status: string) {
	if (statusCounts.loading) return "--";
	if (statusCounts.error) return "--";
	if (!status) {
		return String(
			["shippable", "completed", "exception_completed", "abnormal"].reduce(
				(total, key) => total + (Number(statusCounts.fulfillment[key]) || 0),
				0
			)
		);
	}
	return getStatusCountText(statusCounts.fulfillment, status);
}

function getPurchaseOrderStatusCountText(status: number | string) {
	return getStatusCountText(statusCounts.purchaseOrder, status);
}

function getLogisticsStatusCountText(status: string) {
	return getStatusCountText(statusCounts.logistics, status);
}

function getPurchaseOrderStatusCountHelp() {
	if (statusCounts.error) return "状态数量加载失败：" + statusCounts.error;
	return "当前其它筛选条件下的产品数量；不受当前领星状态选择影响。";
}

function getLogisticsStatusCountHelp() {
	if (statusCounts.error) return "状态数量加载失败：" + statusCounts.error;
	return "当前其它筛选条件下的产品数量；不受当前物流状态选择影响。";
}

function getFulfillmentGroupStatus(summaryOrStatus: any) {
	const status =
		typeof summaryOrStatus === "string"
			? summaryOrStatus
			: String(
					summaryOrStatus?.fulfillment_group_status ||
						summaryOrStatus?.fulfillment_status ||
						""
				);

	if (!status) return "";
	if (["shippable", "completed", "exception_completed", "abnormal"].includes(status)) {
		return status;
	}
	if (status === "normal_completed" || status === "manual_completed") return "completed";
	if (status === "exception_completed") return "exception_completed";
	if (status === "shippable") return "shippable";
	return "abnormal";
}

function getFulfillmentDisplayText(summary: any) {
	const status = getFulfillmentGroupStatus(summary);
	if (!status) return "全部";
	return fulfillmentStatusOptions.find((item) => item.value === status)?.label || "异常";
}

function getFulfillmentStatusShortLabel(status: string) {
	return (
		(
			{
				shippable: "可发",
				completed: "完成",
				exception_completed: "异常完成",
				abnormal: "异常",
				normal_completed: "完成",
				manual_completed: "完成",
				pending_purchase: "异常",
				logistics_exception: "异常",
				exception_pending: "异常",
				unready: "异常"
			} as Record<string, string>
		)[status] || getFulfillmentStatusLabel(status)
	);
}

function buildPurchaseOrderRefreshContext(
	row = fulfillmentDialog.row,
	order = fulfillmentDialog.order
): PurchaseOrderRefreshContext | null {
	if (!row?.row_key || !order?.order_sn) return null;

	return {
		rowKey: row.row_key,
		orderSn: order.order_sn,
		filterStatus: String(filters.fulfillment_status || ""),
		filterLabel: getFulfillmentStatusLabel(),
		filterPurchaseOrderStatuses: getActivePurchaseOrderStatusValues(),
		filterPurchaseOrderStatusLabel: getPurchaseOrderStatusFilterLabel(),
		filterLogisticsStatus: String(filters.logistics_status || ""),
		filterLogisticsLabel: getLogisticsStatusLabel()
	};
}

function doesPurchaseOrderMatchFulfillmentStatus(order: any, status: string) {
	if (!status) return true;
	return getFulfillmentGroupStatus(getPurchaseOrderFulfillmentSummary(order)) === status;
}

function doesPurchaseOrderMatchLogisticsStatus(order: any, status: string) {
	if (!status) return true;
	return String(order?.logistics_status || "") === status;
}

function doesPurchaseOrderMatchPurchaseOrderStatuses(order: any, statuses: number[]) {
	if (!statuses.length) return true;
	return statuses.includes(Number(order?.purchase_order_status));
}

function doesPurchaseOrderMatchActiveFilters(order: any) {
	return (
		doesPurchaseOrderMatchFulfillmentStatus(order, String(filters.fulfillment_status || "")) &&
		doesPurchaseOrderMatchPurchaseOrderStatuses(order, getActivePurchaseOrderStatusValues()) &&
		doesPurchaseOrderMatchLogisticsStatus(order, String(filters.logistics_status || ""))
	);
}

function createEmptyPurchaseOrderQueueInfo(row?: any) {
	return {
		cacheKey: `${row?.row_key || ""}|empty`,
		label: getFulfillmentStatusLabel(),
		total: 0,
		index: 0,
		positionText: "0 / 0 单",
		remainingText: "",
		detailText: "",
		tagType: "info"
	};
}

function getPurchaseOrderQueueInfo(row: any) {
	try {
		const activeStatus = String(filters.fulfillment_status || "");
		const activePurchaseOrderStatuses = getActivePurchaseOrderStatusValues();
		const selectedOrder = getSelectedPurchaseOrder(row);
		const orders = getProductPurchaseOrderOptions(row).filter(canSelectPurchaseOrder);
		const queueOrders = orders.filter(doesPurchaseOrderMatchActiveFilters);
		const selectedIndex = selectedOrder
			? queueOrders.findIndex((order: any) => order.order_sn === selectedOrder.order_sn)
			: -1;
		const index = selectedIndex >= 0 ? selectedIndex + 1 : 0;
		const total = queueOrders.length;
		const remaining = index > 0 ? Math.max(total - index, 0) : total;
		const distribution = formatPurchaseOrderQueueDistribution(orders);
		const label = [
			activeStatus ? getFulfillmentStatusLabel(activeStatus) : "全部",
			activePurchaseOrderStatuses.length ? getPurchaseOrderStatusFilterLabel() : "",
			filters.logistics_status ? getLogisticsStatusLabel() : ""
		]
			.filter(Boolean)
			.join(" / ");

		return {
			cacheKey: `${row?.row_key || ""}|${selectedOrder?.order_sn || ""}|${activeStatus}|${activePurchaseOrderStatuses.join(",")}|${filters.logistics_status || ""}|${total}`,
			label,
			total,
			index,
			positionText: index > 0 ? `${index} / ${total} 单` : `0 / ${total} 单`,
			remainingText:
				(activeStatus || activePurchaseOrderStatuses.length || filters.logistics_status) &&
				index > 0
					? `还有 ${remaining} 单`
					: "",
			detailText:
				activeStatus || activePurchaseOrderStatuses.length || filters.logistics_status
					? ""
					: distribution,
			tagType: activeStatus ? getFulfillmentStatusTagType(activeStatus) : "info"
		};
	} catch (e) {
		console.error("采购单队列统计失败:", e);
		return createEmptyPurchaseOrderQueueInfo(row);
	}
}

function formatPurchaseOrderQueueDistribution(orders: any[]) {
	const statusOrder = ["shippable", "completed", "exception_completed", "abnormal"];
	const counts = new Map<string, number>();

	orders.forEach((order: any) => {
		const status = getFulfillmentGroupStatus(getPurchaseOrderFulfillmentSummary(order));
		counts.set(status, (counts.get(status) || 0) + 1);
	});

	return statusOrder
		.map((status) => {
			const count = counts.get(status) || 0;
			return count > 0 ? `${getFulfillmentStatusShortLabel(status)} ${count}` : "";
		})
		.filter(Boolean)
		.join(" / ");
}

function getPurchaseOrderQueueTooltip(info: any) {
	if (!info.total) return "当前产品没有可切换采购单。";

	if (
		filters.fulfillment_status ||
		getActivePurchaseOrderStatusValues().length ||
		filters.logistics_status
	) {
		return `按当前筛选“${info.label}”统计，仅统计当前产品下可切换采购单。`;
	}

	return `按当前产品下可切换采购单统计。${info.detailText || ""}`;
}

function createPurchaseOrderRefreshResult(
	context?: PurchaseOrderRefreshContext | null
): PurchaseOrderRefreshResult {
	return {
		rowKey: context?.rowKey || "",
		orderSn: context?.orderSn || "",
		filterStatus: context?.filterStatus || "",
		filterLabel: context?.filterLabel || getFulfillmentStatusLabel(context?.filterStatus || ""),
		filterPurchaseOrderStatuses: context?.filterPurchaseOrderStatuses || [],
		filterPurchaseOrderStatusLabel:
			context?.filterPurchaseOrderStatusLabel ||
			getPurchaseOrderStatusFilterLabel(context?.filterPurchaseOrderStatuses || []),
		filterLogisticsStatus: context?.filterLogisticsStatus || "",
		filterLogisticsLabel:
			context?.filterLogisticsLabel ||
			getLogisticsStatusLabel(context?.filterLogisticsStatus || ""),
		requested: Boolean(context?.rowKey && context?.orderSn),
		rowFound: false,
		orderFound: false,
		filterMatched: false,
		preserved: false
	};
}

function syncSelectedPlans(
	rows: any[],
	preservePurchaseOrder?: PurchaseOrderRefreshContext | null
) {
	const preserveResult = createPurchaseOrderRefreshResult(preservePurchaseOrder);
	const rowKeys = new Set(rows.map((row) => row.row_key).filter(Boolean));

	Object.keys(selectedPlanSnMap).forEach((key) => {
		if (!rowKeys.has(key)) {
			delete selectedPlanSnMap[key];
		}
	});

	Object.keys(selectedPurchaseOrderSnMap).forEach((key) => {
		if (!rowKeys.has(key)) {
			delete selectedPurchaseOrderSnMap[key];
		}
	});

	Object.keys(purchaseOrderPopoverVisibleMap).forEach((key) => {
		if (!rowKeys.has(key)) {
			delete purchaseOrderPopoverVisibleMap[key];
		}
	});

	Object.keys(imageFallbackMap).forEach((key) => {
		if (!rowKeys.has(key)) {
			delete imageFallbackMap[key];
		}
	});

	rows.forEach((row) => {
		const plans = Array.isArray(row.plans) ? row.plans : [];
		const current = selectedPlanSnMap[row.row_key];
		const exists = plans.some((plan: any) => plan.plan_sn === current);

		if (!exists) {
			selectedPlanSnMap[row.row_key] = getDefaultSelectedPlanSn(plans, row.selected_plan_sn);
		}

		const recommendedOrderSn = getRecommendedPurchaseOrderSn(row);
		const shouldTryPreserve = preserveResult.requested && preserveResult.rowKey === row.row_key;

		const preservedOrder = shouldTryPreserve
			? findProductPurchaseOrderBySn(row, preserveResult.orderSn)
			: null;
		const recommendedOrder = recommendedOrderSn
			? findProductPurchaseOrderBySn(row, recommendedOrderSn)
			: null;
		const targetOrder = preservedOrder || recommendedOrder;
		if (
			(shouldTryPreserve ||
				filters.fulfillment_status ||
				getActivePurchaseOrderStatusValues().length ||
				filters.logistics_status) &&
			targetOrder
		) {
			const targetPlan = getPrimaryPlanForPurchaseOrder(row, targetOrder);
			if (targetPlan?.plan_sn) {
				selectedPlanSnMap[row.row_key] = targetPlan.plan_sn;
			}
		}

		const selectedPlan = getSelectedPlan(row);
		const orderOptions = getPlanPurchaseOrderOptions(row, selectedPlan);
		const currentOrderSn = selectedPurchaseOrderSnMap[row.row_key];
		const orderExists = orderOptions.some((order: any) => order.order_sn === currentOrderSn);

		if (shouldTryPreserve) {
			preserveResult.rowFound = true;
			const preservedOrder = orderOptions.find(
				(order: any) => order.order_sn === preserveResult.orderSn
			);

			if (preservedOrder) {
				preserveResult.orderFound = true;
				preserveResult.filterMatched =
					doesPurchaseOrderMatchFulfillmentStatus(
						preservedOrder,
						preserveResult.filterStatus
					) &&
					doesPurchaseOrderMatchPurchaseOrderStatuses(
						preservedOrder,
						preserveResult.filterPurchaseOrderStatuses
					) &&
					doesPurchaseOrderMatchLogisticsStatus(
						preservedOrder,
						preserveResult.filterLogisticsStatus
					);

				if (preserveResult.filterMatched) {
					selectedPurchaseOrderSnMap[row.row_key] = preserveResult.orderSn;
					preserveResult.preserved = true;
				}
			}
		}

		if (shouldTryPreserve && preserveResult.preserved) {
			// Keep the PO the user just edited when it still belongs to the current result set.
		} else if (
			(filters.fulfillment_status ||
				getActivePurchaseOrderStatusValues().length ||
				filters.logistics_status) &&
			recommendedOrderSn &&
			orderOptions.some((order: any) => order.order_sn === recommendedOrderSn)
		) {
			selectedPurchaseOrderSnMap[row.row_key] = recommendedOrderSn;
		} else if (!orderExists) {
			selectedPurchaseOrderSnMap[row.row_key] = getDefaultSelectedPlanPurchaseOrderSn(
				row,
				selectedPlan
			);
		}
	});

	return preserveResult;
}

function syncDetailState() {
	if (!detailVisible.value || !detailProduct.value || !detailPlan.value) return;

	const currentRow = tableData.value.find(
		(item) => item.row_key === detailProduct.value?.row_key
	);

	if (!currentRow) return;

	detailProduct.value = currentRow;
	detailPlan.value =
		currentRow.plans?.find((plan: any) => plan.plan_sn === detailPlan.value?.plan_sn) ||
		getSelectedPlan(currentRow);
}

type LoadDataOptions = {
	preservePurchaseOrder?: PurchaseOrderRefreshContext | null;
	keepSelectedRowKeys?: string[];
};

function notifyPurchaseOrderRefreshResult(result: PurchaseOrderRefreshResult) {
	if (
		!result.requested ||
		result.preserved ||
		(!result.filterStatus &&
			!result.filterPurchaseOrderStatuses.length &&
			!result.filterLogisticsStatus)
	) {
		return;
	}

	const filtersText = [
		result.filterStatus ? `艾为状态“${result.filterLabel}”` : "",
		result.filterPurchaseOrderStatuses.length
			? `领星状态“${result.filterPurchaseOrderStatusLabel}”`
			: "",
		result.filterLogisticsStatus ? `物流状态“${result.filterLogisticsLabel}”` : ""
	]
		.filter(Boolean)
		.join("、");

	ElMessage({
		type: "warning",
		message: `${result.orderSn} 已不符合${filtersText}筛选，已切换到下一条。`,
		duration: 6000,
		showClose: true
	});
}

async function loadStatusCounts() {
	statusCounts.loading = true;
	statusCounts.error = "";
	try {
		const res = await service.app.bsr_purchase_plan_product_view.statusCounts(
			requestParams.value
		);
		statusCounts.fulfillment = normalizeStatusCountMap(res?.fulfillment_status_counts);
		statusCounts.purchaseOrder = normalizeStatusCountMap(res?.purchase_order_status_counts);
		statusCounts.logistics = normalizeStatusCountMap(res?.logistics_status_counts);
		return true;
	} catch (e: any) {
		statusCounts.error = e?.message || "状态数量加载失败";
		return false;
	} finally {
		statusCounts.loading = false;
	}
}

async function loadData(options: LoadDataOptions = {}) {
	loading.value = true;

	try {
		const [res] = await Promise.all([
			service.app.bsr_purchase_plan_product_view.page(requestParams.value),
			loadStatusCounts()
		]);
		const list = Array.isArray(res?.list) ? res.list : [];

		tableData.value = list;
		if (options.keepSelectedRowKeys?.length) {
			const selectedKeySet = new Set(options.keepSelectedRowKeys);
			selectedRows.value = list.filter((row: any) => selectedKeySet.has(row?.row_key));
		} else {
			selectedRows.value = [];
		}
		pagination.total = Number(res?.pagination?.total) || 0;
		const refreshResult = syncSelectedPlans(list, options.preservePurchaseOrder);
		syncDetailState();
		notifyPurchaseOrderRefreshResult(refreshResult);
		return true;
	} catch (e: any) {
		ElMessage.error(e?.message || "加载采购计划产品失败");
		return false;
	} finally {
		loading.value = false;
	}
}

async function handleRefresh() {
	if (loading.value) return;

	refreshing.value = true;
	try {
		const ok = await loadData();
		if (ok) {
			ElMessage.success("刷新成功");
		}
	} finally {
		refreshing.value = false;
	}
}

function getSyncLatestRows() {
	return selectedRows.value.length ? selectedRows.value : tableData.value;
}

function buildSyncLatestItems(rows: any[]) {
	return rows.map((row) => {
		const product = getBatchShipSyncProduct(row);
		const plans = Array.isArray(row?.plans) ? row.plans : [];

		return {
			row_key: row?.row_key || "",
			product,
			plans: plans.map((plan: any) => ({
				plan_sn: plan?.plan_sn || "",
				purchase_orders: getPurchaseOrders(plan)
					.map((order: any) => ({
						order_sn: String(order?.order_sn || "").trim()
					}))
					.filter((order: any) => order.order_sn),
				shipment_plans: getShipmentPlans(plan)
					.map((shipmentPlan: any) => ({
						seq: String(shipmentPlan?.seq || "").trim(),
						sku: String(shipmentPlan?.sku || "").trim(),
						purchase_order_sn: String(shipmentPlan?.purchase_order_sn || "").trim(),
						purchase_plan_sn: String(shipmentPlan?.purchase_plan_sn || "").trim()
					}))
					.filter(
						(shipmentPlan: any) =>
							shipmentPlan.seq ||
							shipmentPlan.sku ||
							shipmentPlan.purchase_order_sn ||
							shipmentPlan.purchase_plan_sn
					)
			}))
		};
	});
}

function getSyncLatestSectionSummary(section: any) {
	if (!section) return "";
	const label = section.label || section.key || "数据";
	const total = Number(section.total) || 0;
	const success = Number(section.success_count) || 0;
	const failed = Number(section.failed_count) || 0;
	const skipped = Number(section.skipped_count) || 0;
	const parts = total ? [`${label} ${success}/${total}`] : [`${label} 跳过`];

	if (failed) parts.push(`失败 ${failed}`);
	if (skipped) parts.push(`跳过 ${skipped}`);
	if (section.key === "logistics") {
		parts.push(`真实查询 ${Number(section.queried_count) || 0}`);
	}
	if (section.key === "shipment_actual") {
		parts.push(`落库 ${Number(section.total_upserted) || 0}`);
	}

	return parts.join("，");
}

function buildSyncLatestResultMessage(result: any) {
	const sections = result?.sections || {};
	const orderedKeys = [
		"purchase_plan",
		"pending_delivery",
		"purchase_order",
		"logistics",
		"shipment_plan",
		"shipment_actual"
	];
	const summaries = orderedKeys
		.map((key) => getSyncLatestSectionSummary(sections[key]))
		.filter(Boolean);
	const warnings = Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : [];

	return [...summaries, warnings.length ? `提示：${warnings.slice(0, 3).join("；")}` : ""]
		.filter(Boolean)
		.join("\n");
}

function hasSyncLatestFailures(result: any) {
	const sections = result?.sections || {};
	return Object.values(sections).some((section: any) => Number(section?.failed_count) > 0);
}

async function handleSyncLatestRelatedData() {
	if (loading.value || syncLatestRefreshing.value) return;

	const rows = getSyncLatestRows();
	if (!rows.length) {
		ElMessage.warning("当前页面没有可同步的数据");
		return;
	}

	const keepSelected = selectedRows.value.length > 0;
	const rowKeys = keepSelected
		? rows.map((row) => String(row?.row_key || "")).filter(Boolean)
		: [];
	const scopeText = keepSelected ? `已选 ${rows.length} 个产品` : `当前页 ${rows.length} 个产品`;

	try {
		await ElMessageBox.confirm(
			`将同步${scopeText}关联的采购计划、采购单、快递100物流、发货计划和发货单。同步只处理当前页面数据，不会全量刷新。是否继续？`,
			"同步最新数据",
			{
				type: "warning",
				confirmButtonText: "开始同步",
				cancelButtonText: "取消"
			}
		);
	} catch {
		return;
	}

	syncLatestRefreshing.value = true;
	try {
		const result = await service.app.bsr_purchase_plan_product_view.syncLatestRelatedData({
			items: buildSyncLatestItems(rows)
		});
		await loadData({ keepSelectedRowKeys: rowKeys });
		const message = buildSyncLatestResultMessage(result);
		const hasFailures = hasSyncLatestFailures(result);

		await ElMessageBox.alert(message || "同步完成", "同步最新数据完成", {
			type: hasFailures ? "warning" : "success",
			confirmButtonText: "知道了"
		});
	} catch (e: any) {
		ElMessage.error(e?.message || "同步最新数据失败");
	} finally {
		syncLatestRefreshing.value = false;
	}
}

function handleSearch() {
	pagination.page = 1;
	loadData();
}

function handleWorkStatusChange() {
	selectedRows.value = [];
	pagination.page = 1;
	loadData();
}

function resetFilters() {
	filters.keyWord = "";
	filters.marketplace = "";
	filters.seller_name = "";
	filters.product_code = "";
	filters.fulfillment_status = DEFAULT_FULFILLMENT_STATUS;
	filters.purchase_order_statuses = [];
	filters.logistics_status = "";
	pagination.page = 1;
	loadData();
}

function handlePageSizeChange() {
	pagination.page = 1;
	loadData();
}

function getProduct(row: any) {
	return row?.product || {};
}

function getProductMetrics(row: any) {
	return getProduct(row).product_metrics || {};
}

function hasMetricValue(value: any) {
	return value !== undefined && value !== null && value !== "";
}

function formatMetricNumber(value: any) {
	if (!hasMetricValue(value)) return "-";

	const num = Number(value);
	if (!Number.isFinite(num)) return "-";

	return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
}

function formatMetricPercent(value: any) {
	if (!hasMetricValue(value)) return "-";

	const num = Number(value);
	if (!Number.isFinite(num)) return "-";

	return `${(num * 100).toFixed(2)}%`;
}

function formatMetricTriple(metrics: any, prefix: string) {
	const values = [metrics?.[`${prefix}_3`], metrics?.[`${prefix}_7`], metrics?.[`${prefix}_14`]];

	if (values.every((value) => !hasMetricValue(value))) return "-";

	return values.map(formatMetricNumber).join(" / ");
}

function formatSellableDays(metrics: any) {
	return `总 ${formatMetricNumber(metrics?.sellable_days_total)} / FBA ${formatMetricNumber(
		metrics?.sellable_days_fba
	)}`;
}

function formatInventoryTriple(metrics: any) {
	return [
		formatMetricNumber(metrics?.fba_qty),
		formatMetricNumber(metrics?.fba_reserved_qty),
		formatMetricNumber(metrics?.in_transit_qty),
		formatMetricNumber(metrics?.local_qty)
	].join(" / ");
}

function canSelectProductRow(row: any) {
	return Boolean(getSelectedPurchaseOrder(row)?.order_sn);
}

function handleSelectionChange(rows: any[]) {
	selectedRows.value = rows;
}

function hasBatchShipRelatedPurchaseOrder(row: any) {
	return getProductPurchaseOrderOptions(row).some((order: any) => Boolean(order?.order_sn));
}

function getBatchShipShippableOrders(row: any) {
	return getProductPurchaseOrderOptions(row).filter((order: any) => {
		const fulfillment = getPurchaseOrderFulfillmentSummary(order);
		return (
			canSelectPurchaseOrder(order) &&
			getFulfillmentGroupStatus(fulfillment) === "shippable" &&
			Number(fulfillment.actual_shippable_qty) > 0
		);
	});
}

function buildBatchShipItemsFromRows(rows: any[]) {
	return rows
		.map((row, index) => buildBatchShipItem(row, index))
		.filter((item) => item.shippableOrders.length > 0);
}

function getBatchShipRowsByKeys(rowKeys: string[]) {
	const keySet = new Set(rowKeys.filter(Boolean));
	return tableData.value.filter((row) => keySet.has(row?.row_key));
}

function getBatchShipSyncProduct(row: any) {
	const product = getProduct(row);
	const storeId = product?.store_id ?? product?.sid;
	return {
		asin: product?.asin || row?.asin || "",
		marketplace: product?.marketplace || row?.marketplace || "",
		store_id: Number(storeId) || storeId,
		msku: product?.msku || row?.msku || "",
		seller_name: product?.seller_name || product?.shop || "",
		product_code: product?.product_code || row?.product_code || "",
		local_sku: product?.local_sku || ""
	};
}

function getBatchShipSyncProductKey(product: any) {
	return `${product.asin}|${product.marketplace}|${product.store_id}|${product.msku || ""}`;
}

function getBatchShipSyncProductTargets(rows: any[]) {
	const targetMap = new Map<string, any>();
	rows.forEach((row) => {
		const product = getBatchShipSyncProduct(row);
		if (!product.asin || !product.marketplace || product.store_id === undefined) return;
		const key = getBatchShipSyncProductKey(product);
		if (targetMap.has(key)) return;
		targetMap.set(key, {
			key,
			row,
			product,
			label:
				getProduct(row)?.item_name ||
				getProduct(row)?.msku ||
				product.msku ||
				product.asin ||
				key
		});
	});
	return Array.from(targetMap.values());
}

function getBatchShipOrderTargets(rows: any[], orderSnsOverride?: string[]) {
	const targetMap = new Map<string, any>();
	if (orderSnsOverride?.length) {
		orderSnsOverride.forEach((orderSn) => {
			const key = String(orderSn || "").trim();
			if (key) targetMap.set(key, { key, orderSn: key, label: key });
		});
		return Array.from(targetMap.values());
	}

	rows.forEach((row) => {
		getProductPurchaseOrderOptions(row).forEach((order: any) => {
			const orderSn = String(order?.order_sn || "").trim();
			if (!orderSn || targetMap.has(orderSn)) return;
			targetMap.set(orderSn, {
				key: orderSn,
				orderSn,
				label: orderSn,
				row
			});
		});
	});
	return Array.from(targetMap.values());
}

function createBatchShipSyncSection(scope: string, label: string, targets: any[]) {
	return {
		scope,
		label,
		total: targets.length,
		successCount: 0,
		failedCount: 0,
		items: targets.map((target) => ({
			scope,
			key: target.key,
			label: target.label,
			status: "pending",
			message: "等待刷新",
			row: target.row || null,
			product: target.product || null,
			orderSn: target.orderSn || ""
		}))
	};
}

function publishBatchShipDataSyncState(
	status: string,
	message: string,
	sections: Record<string, any>
) {
	batchShipDataSyncState.value = {
		status,
		syncing: status === "syncing",
		message,
		sections
	};
}

function finishBatchShipDataSyncState(sections: Record<string, any>, retry = false) {
	const sectionList = Object.values(sections).filter((section: any) => Number(section.total) > 0);
	const total = sectionList.reduce(
		(sum: number, section: any) => sum + Number(section.total || 0),
		0
	);
	const failedCount = sectionList.reduce(
		(sum: number, section: any) => sum + Number(section.failedCount || 0),
		0
	);
	const successCount = Math.max(0, total - failedCount);
	let status = "success";
	let message = retry
		? `失败项已刷新完成：成功 ${successCount}/${total}`
		: `批量发货数据已刷新：成功 ${successCount}/${total}`;

	if (failedCount > 0) {
		status = failedCount >= total ? "failed" : "partial_failed";
		message = retry
			? `继续刷新后仍有 ${failedCount}/${total} 项失败，其余已使用最新数据。`
			: `部分数据刷新失败：${failedCount}/${total} 项使用本地缓存，其余已使用最新数据。`;
	}

	publishBatchShipDataSyncState(status, message, sections);
	if (status === "success") {
		ElMessage.success(message);
	} else {
		ElMessage.warning(message);
	}
}

function applyBatchShipPurchasePlanResult(row: any, data: any) {
	const metrics = getProductMetrics(row);
	metrics.purchase_plan_qty = data?.plan_qty ?? 0;
	metrics.purchase_plan_count = data?.plan_count ?? 0;
	metrics.purchase_plan_details = data?.details ?? [];
}

function applyBatchShipPendingDeliveryResult(row: any, data: any) {
	const metrics = getProductMetrics(row);
	metrics.pending_delivery_qty = data?.pending_qty ?? 0;
	metrics.pending_delivery_count = data?.pending_count ?? 0;
	metrics.pending_delivery_details = data?.details ?? [];
	metrics.lingxing_pending_delivery_qty = data?.lingxing_pending_qty ?? 0;
	metrics.lingxing_pending_delivery_details = data?.lingxing_details ?? [];
}

async function syncBatchShipPurchasePlans(targets: any[]) {
	const section = createBatchShipSyncSection("purchase_plan", "采购计划", targets);
	if (!targets.length) return section;

	try {
		const res = await (
			service.app as any
		).bsr_purchase_order_sync_lingxing.getPendingPurchasePlansByProducts({
			products: targets.map((target) => target.product),
			syncLinkedPlans: true
		});
		section.items = targets.map((target) => {
			const data = res?.[target.key];
			applyBatchShipPurchasePlanResult(target.row, data);
			const failed = Boolean(data?.sync_attempted && data?.sync_success === false);
			return {
				scope: section.scope,
				key: target.key,
				label: target.label,
				status: failed ? "failed" : "success",
				message: failed ? "采购计划刷新失败，已使用本地缓存" : "采购计划已刷新",
				row: target.row,
				product: target.product
			};
		});
	} catch (error: any) {
		section.items = targets.map((target) => ({
			scope: section.scope,
			key: target.key,
			label: target.label,
			status: "failed",
			message: error?.message || "采购计划刷新失败，已使用本地缓存",
			row: target.row,
			product: target.product
		}));
	}

	section.successCount = section.items.filter((item: any) => item.status === "success").length;
	section.failedCount = section.total - section.successCount;
	return section;
}

async function syncBatchShipPendingDelivery(targets: any[]) {
	const section = createBatchShipSyncSection("pending_delivery", "待交付", targets);
	if (!targets.length) return section;

	try {
		const res = await (
			service.app as any
		).bsr_purchase_order_sync_lingxing.getPendingDeliveryByProducts({
			products: targets.map((target) => target.product),
			syncLinkedOrders: true,
			keepLocalOnMissing: true
		});
		section.items = targets.map((target) => {
			const data = res?.[target.key];
			applyBatchShipPendingDeliveryResult(target.row, data);
			const failed = Boolean(data?.sync_attempted && data?.sync_success === false);
			return {
				scope: section.scope,
				key: target.key,
				label: target.label,
				status: failed ? "failed" : "success",
				message: failed ? "待交付刷新失败，已使用本地缓存" : "待交付已刷新",
				row: target.row,
				product: target.product
			};
		});
	} catch (error: any) {
		section.items = targets.map((target) => ({
			scope: section.scope,
			key: target.key,
			label: target.label,
			status: "failed",
			message: error?.message || "待交付刷新失败，已使用本地缓存",
			row: target.row,
			product: target.product
		}));
	}

	section.successCount = section.items.filter((item: any) => item.status === "success").length;
	section.failedCount = section.total - section.successCount;
	return section;
}

async function syncBatchShipPurchaseOrders(targets: any[]) {
	const section = createBatchShipSyncSection("purchase_order", "采购单", targets);
	if (!targets.length) return section;

	try {
		const res = await (service.app as any).bsr_purchase_order_sync_lingxing.syncByOrderSns({
			order_sns: targets.map((target) => target.orderSn),
			keepLocalOnMissing: true
		});
		const itemMap = new Map(
			(res?.items || []).map((item: any) => [String(item.order_sn || ""), item])
		);
		section.items = targets.map((target) => {
			const result = itemMap.get(target.orderSn);
			const status = String(result?.status || (res?.success ? "synced" : "request_failed"));
			const success = status === "synced";
			return {
				scope: section.scope,
				key: target.key,
				label: target.label,
				status: success ? "success" : "failed",
				message:
					result?.message ||
					(success ? "采购单已刷新" : "采购单刷新失败，已使用本地缓存"),
				orderSn: target.orderSn,
				row: target.row || null
			};
		});
	} catch (error: any) {
		section.items = targets.map((target) => ({
			scope: section.scope,
			key: target.key,
			label: target.label,
			status: "failed",
			message: error?.message || "采购单刷新失败，已使用本地缓存",
			orderSn: target.orderSn,
			row: target.row || null
		}));
	}

	section.successCount = section.items.filter((item: any) => item.status === "success").length;
	section.failedCount = section.total - section.successCount;
	return section;
}

async function refreshBatchShipItemsFromLatestRows(rowKeys: string[]) {
	await loadData({ keepSelectedRowKeys: rowKeys });
	const refreshedRows = getBatchShipRowsByKeys(rowKeys);
	selectedRows.value = refreshedRows;
	batchShipItems.value = buildBatchShipItemsFromRows(refreshedRows);
	if (!batchShipItems.value.length) {
		ElMessage.warning("刷新后没有实际可发数量大于 0 的可发货采购单");
	}
}

async function runBatchShipDataSync(
	rows: any[],
	options: { retry?: boolean; scopes?: string[]; orderSns?: string[]; rowKeys?: string[] } = {}
) {
	const scopes = options.scopes || ["purchase_plan", "pending_delivery", "purchase_order"];
	const rowKeys = options.rowKeys?.length
		? options.rowKeys
		: rows.map((row) => String(row?.row_key || "")).filter(Boolean);
	const productTargets = getBatchShipSyncProductTargets(rows);
	const orderTargets = getBatchShipOrderTargets(rows, options.orderSns);
	const sections: Record<string, any> = {};

	if (scopes.includes("purchase_plan")) {
		sections.purchase_plan = createBatchShipSyncSection(
			"purchase_plan",
			"采购计划",
			productTargets
		);
	}
	if (scopes.includes("pending_delivery")) {
		sections.pending_delivery = createBatchShipSyncSection(
			"pending_delivery",
			"待交付",
			productTargets
		);
	}
	if (scopes.includes("purchase_order")) {
		sections.purchase_order = createBatchShipSyncSection(
			"purchase_order",
			"采购单",
			orderTargets
		);
	}

	publishBatchShipDataSyncState("syncing", "正在刷新批量发货数据，请稍候。", sections);

	if (sections.purchase_plan) {
		sections.purchase_plan = await syncBatchShipPurchasePlans(productTargets);
		publishBatchShipDataSyncState(
			"syncing",
			"采购计划已刷新，继续刷新待交付/采购单数据。",
			sections
		);
	}
	if (sections.pending_delivery) {
		sections.pending_delivery = await syncBatchShipPendingDelivery(productTargets);
		publishBatchShipDataSyncState("syncing", "待交付已刷新，继续刷新采购单数据。", sections);
	}
	if (sections.purchase_order) {
		sections.purchase_order = await syncBatchShipPurchaseOrders(orderTargets);
		publishBatchShipDataSyncState("syncing", "采购单已刷新，正在重新加载页面数据。", sections);
	}

	await refreshBatchShipItemsFromLatestRows(rowKeys);
	finishBatchShipDataSyncState(sections, Boolean(options.retry));
}

function getBatchShipPreflightContinuableOrders() {
	return (Array.isArray(batchShipPreflightResult.value?.orders)
		? batchShipPreflightResult.value.orders
		: []
	).filter((row: any) => row.preflight_status !== "blocked" && row.order_sn);
}

function filterRowsByPreflightOrders(rows: any[], orderSns: Set<string>) {
	return rows
		.map((row) => {
			const plans = (Array.isArray(row?.plans) ? row.plans : [])
				.map((plan: any) => ({
					...plan,
					purchase_orders: getPurchaseOrders(plan).filter((order: any) =>
						orderSns.has(String(order?.order_sn || "").trim())
					)
				}))
				.filter((plan: any) => getPurchaseOrders(plan).length > 0);

			return {
				...row,
				plans
			};
		})
		.filter((row) => (Array.isArray(row?.plans) ? row.plans : []).length > 0);
}

function buildBatchShipDataSyncStateFromPreflight(result: any) {
	const sections = result?.sync_result?.sections || {};
	const hasFailures = Object.values(sections).some(
		(section: any) => Number(section?.failed_count) > 0
	);
	const summary = result?.summary || {};

	return {
		status: hasFailures ? "partial_failed" : "success",
		syncing: false,
		message: `发货前检查完成：可继续 ${Number(summary.continuable_count) || 0} 单，不可发货 ${Number(summary.blocked_count) || 0} 单。`,
		sections
	};
}

async function runBatchShipPreflight(rows: any[]) {
	if (!rows.length || batchShipPreflightLoading.value) return;

	const rowKeys = rows.map((row) => String(row?.row_key || "")).filter(Boolean);
	batchShipPreflightLoading.value = true;
	try {
		const result = await service.app.bsr_purchase_plan_product_view.preflightBatchShip({
			items: buildSyncLatestItems(rows)
		});
		batchShipPreflightResult.value = result;
		await loadData({ keepSelectedRowKeys: rowKeys });
	} catch (error: any) {
		ElMessage.error(error?.message || "发货前检查失败");
	} finally {
		batchShipPreflightLoading.value = false;
	}
}

async function openBatchShipDialog() {
	const rows = selectedRows.value.filter(hasBatchShipRelatedPurchaseOrder);
	if (!rows.length) {
		ElMessage.warning("请先选择至少一个已关联采购单的产品");
		return;
	}

	batchShipPreflightRows.value = rows;
	batchShipPreflightResult.value = null;
	batchShipPreflightVisible.value = true;
	await runBatchShipPreflight(rows);
}

async function rerunBatchShipPreflight() {
	const rows = batchShipPreflightRows.value.length
		? batchShipPreflightRows.value
		: selectedRows.value.filter(hasBatchShipRelatedPurchaseOrder);
	if (!rows.length) {
		ElMessage.warning("没有可检查的采购单");
		return;
	}
	await runBatchShipPreflight(rows);
}

function continueBatchShipAfterPreflight() {
	const continuableOrders = getBatchShipPreflightContinuableOrders();
	if (!continuableOrders.length) {
		ElMessage.warning("没有可进入批量发货的采购单");
		return;
	}

	const orderSnSet = new Set(
		continuableOrders.map((row: any) => String(row.order_sn || "").trim()).filter(Boolean)
	);
	const rowKeys = Array.from(
		new Set(continuableOrders.map((row: any) => String(row.row_key || "")).filter(Boolean))
	);
	const latestRows = getBatchShipRowsByKeys(rowKeys);
	const sourceRows = latestRows.length ? latestRows : batchShipPreflightRows.value;
	const filteredRows = filterRowsByPreflightOrders(sourceRows, orderSnSet);

	batchShipReviewNo.value = "";
	batchShipReviewRestorePayload.value = null;
	batchShipCurrentRowKeys.value = filteredRows
		.map((row) => String(row?.row_key || ""))
		.filter(Boolean);
	batchShipItems.value = buildBatchShipItemsFromRows(filteredRows);
	if (!batchShipItems.value.length) {
		ElMessage.warning("前置检查通过的采购单在当前筛选下未找到，请刷新后重试");
		return;
	}

	batchShipDataSyncState.value = buildBatchShipDataSyncStateFromPreflight(
		batchShipPreflightResult.value
	);
	batchShipPreflightVisible.value = false;
	batchShipDialogVisible.value = true;
}

async function openBatchShipReviewRestoreFromRoute() {
	const reviewNo = String(route.query.batch_ship_review_no || "").trim();
	if (!reviewNo) return;
	try {
		const payload = await service.request({
			url: "/admin/app/bsr_batch_ship_review/restorePayload",
			method: "POST",
			data: { review_no: reviewNo }
		});
		batchShipReviewNo.value = payload?.review_no || reviewNo;
		batchShipReviewRestorePayload.value = payload;
		batchShipItems.value = Array.isArray(payload?.input_snapshot?.items)
			? payload.input_snapshot.items
			: [];
		batchShipCurrentRowKeys.value = batchShipItems.value
			.map((row: any) => String(row?.row_key || row?.rowKey || ""))
			.filter(Boolean);
		batchShipDialogVisible.value = true;
		ElMessage.success(`已载入批量发货审核单 ${batchShipReviewNo.value}`);
	} catch (error: any) {
		ElMessage.error(error?.message || "还原批量发货审核单失败");
	}
}

function handleBatchShipReviewSaved(result: any) {
	const reviewNo = result?.review_no || result?.review?.review_no;
	if (reviewNo) {
		batchShipReviewNo.value = reviewNo;
	}
}

async function retryBatchShipFailedDataSync() {
	const state = batchShipDataSyncState.value || {};
	const sections = state.sections || {};
	const failedPlanRows = (sections.purchase_plan?.items || [])
		.filter((item: any) => item.status !== "success" && item.row)
		.map((item: any) => item.row);
	const failedDeliveryRows = (sections.pending_delivery?.items || [])
		.filter((item: any) => item.status !== "success" && item.row)
		.map((item: any) => item.row);
	const failedOrderSns = (sections.purchase_order?.items || [])
		.filter((item: any) => item.status !== "success" && item.orderSn)
		.map((item: any) => item.orderSn);
	const scopes: string[] = [];
	const rowMap = new Map<string, any>();

	if (failedPlanRows.length) {
		scopes.push("purchase_plan");
		failedPlanRows.forEach((row: any) =>
			rowMap.set(row.row_key || JSON.stringify(getBatchShipSyncProduct(row)), row)
		);
	}
	if (failedDeliveryRows.length) {
		scopes.push("pending_delivery");
		failedDeliveryRows.forEach((row: any) =>
			rowMap.set(row.row_key || JSON.stringify(getBatchShipSyncProduct(row)), row)
		);
	}
	if (failedOrderSns.length) {
		scopes.push("purchase_order");
	}
	if (!scopes.length) {
		ElMessage.info("暂无失败项需要继续刷新");
		return;
	}

	const rows = Array.from(rowMap.values());
	await runBatchShipDataSync(rows, {
		retry: true,
		scopes,
		orderSns: failedOrderSns,
		rowKeys: batchShipCurrentRowKeys.value
	});
}

function buildBatchShipItem(row: any, index: number) {
	const product = getProduct(row);
	const metrics = getProductMetrics(row);
	const shippableOrders = getBatchShipShippableOrders(row).map(
		(order: any, orderIndex: number) => {
			const fulfillment = getPurchaseOrderFulfillmentSummary(order);
			const adjustment = order?.fulfillment_adjustment || {};
			const linkedPlanSns = Array.isArray(order?.linked_plan_sns)
				? order.linked_plan_sns.filter(Boolean)
				: [];
			const linkedAnalysisRecordIds = Array.isArray(order?.linked_plans)
				? order.linked_plans
						.map((plan: any) => Number(getLocalRecord(plan)?.analysis_record_id) || 0)
						.filter(Boolean)
				: [];

			return {
				id: String(order?.id || `${order?.order_sn || "order"}_${orderIndex}`),
				order_sn: String(order?.order_sn || ""),
				plan_sn: String(
					linkedPlanSns[0] || order?.plan_sn || order?.purchase_plan_sn || ""
				),
				linked_plan_sns: linkedPlanSns,
				analysis_record_id:
					linkedAnalysisRecordIds[0] || Number(order?.analysis_record_id) || null,
				linked_analysis_record_ids: linkedAnalysisRecordIds,
				status_text: String(
					getFulfillmentDisplayText(fulfillment) ||
						order?.purchase_order_status_text ||
						order?.status_text ||
						"可发货"
				),
				supplier_name: String(
					order?.purchase_order_supplier_name || order?.supplier_name || ""
				),
				order_time: String(order?.purchase_order_time || order?.order_time || ""),
				logistics_status_text: String(
					order?.logistics_status_text || order?.logistics_status || ""
				),
				logistics_status_reason: String(order?.logistics_status_reason || ""),
				quantity_entry_sum: Number(fulfillment.quantity_entry_sum) || 0,
				actual_shipment_qty_sum: Number(fulfillment.actual_shipment_qty_sum) || 0,
				defective_qty: Number(fulfillment.defective_qty ?? adjustment.defective_qty) || 0,
				short_shipped_qty:
					Number(fulfillment.short_shipped_qty ?? adjustment.short_shipped_qty) || 0,
				estimated_shippable_qty: Number(fulfillment.estimated_shippable_qty) || 0,
				actual_shippable_qty: Number(fulfillment.actual_shippable_qty) || 0,
				sync_status: String(order?.sync_status || ""),
				sync_message: String(order?.sync_message || ""),
				ship_qty: 0
			};
		}
	);

	return {
		_batchId: `${row?.row_key || "row"}_${product?.asin || "asin"}_${index}_${Date.now()}`,
		row_key: row?.row_key || "",
		product_name: product?.item_name || product?.product_name || product?.name || "",
		image_url_display: getProductImageUrl(row),
		product_id: product?.product_id ?? null,
		asin: product?.asin || "",
		marketplace: product?.marketplace || "",
		msku: product?.msku || "",
		local_sku: product?.local_sku || "",
		fnsku: product?.fnsku || "",
		store_id: product?.store_id ?? product?.sid ?? null,
		seller_name: product?.seller_name || product?.shop || "",
		product_code: product?.product_code || "",
		listing_id: product?.listing_id ?? null,
		current_target_stock_days:
			metrics?.current_target_stock_days ?? product?.current_target_stock_days ?? null,
		volatility_coefficient: metrics?.volatility_coefficient,
		daily_avg_sales: metrics?.daily_avg_sales,
		sales_avg_info: metrics?.sales_avg_info || "-",
		sales_avg_3: metrics?.sales_avg_3,
		sales_avg_7: metrics?.sales_avg_7,
		sales_avg_14: metrics?.sales_avg_14,
		sales_total_3: metrics?.sales_total_3,
		sales_total_7: metrics?.sales_total_7,
		sales_total_14: metrics?.sales_total_14,
		realtime_sales: metrics?.realtime_sales,
		recent_sales_trend_list: metrics?.recent_sales_trend_list,
		sellable_days_total: metrics?.sellable_days_total,
		sellable_days_fba: metrics?.sellable_days_fba,
		fba_qty: metrics?.fba_qty,
		fba_reserved_qty: metrics?.fba_reserved_qty,
		in_transit_qty: metrics?.in_transit_qty,
		local_qty: metrics?.local_qty,
		pending_delivery_qty: metrics?.pending_delivery_qty,
		pending_delivery_details: metrics?.pending_delivery_details,
		purchase_plan_qty: metrics?.purchase_plan_qty,
		purchase_plan_details: metrics?.purchase_plan_details,
		estimated_shipping_qty: metrics?.estimated_shipping_qty,
		estimated_shipping_details: metrics?.estimated_shipping_details,
		out_stock_date: metrics?.out_stock_date || product?.out_stock_date || "",
		stars: product?.stars || metrics?.stars || [],
		reviews_num: product?.reviews_num || metrics?.reviews_num || [],
		excluded_shipping_methods:
			product?.excluded_shipping_methods || metrics?.excluded_shipping_methods || [],
		shippableOrders
	};
}

function canConfirmReceiptOrder(order: any) {
	const status = String(order?.logistics_status || "");
	return Boolean(order?.order_sn) && !["confirmed", "signed"].includes(status);
}

function canCancelReceiptOrder(order: any) {
	return Boolean(order?.order_sn) && String(order?.logistics_status || "") === "confirmed";
}

function canBatchConfirmReceiptRow(row: any) {
	return canConfirmReceiptOrder(getSelectedPurchaseOrder(row));
}

function canBatchCancelReceiptRow(row: any) {
	return canCancelReceiptOrder(getSelectedPurchaseOrder(row));
}

function getReceiptActionText(confirmed: number) {
	return Number(confirmed) === 1 ? "人工确认收货" : "撤销人工确认";
}

async function promptReceiptRemark(confirmed: number, count: number) {
	const actionText = getReceiptActionText(confirmed);
	const { value } = await ElMessageBox.prompt(
		count > 1
			? `将对 ${count} 个采购单执行“${actionText}”，请填写原因`
			: `请填写${actionText}原因`,
		actionText,
		{
			confirmButtonText: "确定",
			cancelButtonText: "取消",
			inputType: "textarea",
			inputPlaceholder: "请输入人工处理原因，便于后续追溯",
			inputValidator: (value) => {
				return String(value || "").trim() ? true : "请填写原因";
			}
		}
	);

	return String(value || "").trim();
}

async function submitReceiptConfirm(orderSns: string[], confirmed: number, remark: string) {
	return await (service.app as any).bsr_purchase_order_sync_lingxing.confirmReceipt({
		order_sns: orderSns,
		confirmed: Number(confirmed) === 1 ? 1 : 0,
		remark,
		source: "purchase_plan_product_view"
	});
}

async function confirmReceiptForOrder(row: any, order: any, confirmed: number) {
	const orderSn = String(order?.order_sn || "").trim();
	if (!orderSn) {
		ElMessage.warning("未能获取到采购单号");
		return;
	}

	let remark = "";
	try {
		remark = await promptReceiptRemark(confirmed, 1);
	} catch {
		return;
	}

	const refreshContext = buildPurchaseOrderRefreshContext(row, order);
	try {
		const res = await submitReceiptConfirm([orderSn], confirmed, remark);
		const updated = Number(res?.updated) || 0;
		const skippedReasons = res?.skipped_reasons || {};
		const skippedOrderSns = Array.isArray(res?.skipped_order_sns) ? res.skipped_order_sns : [];
		if (updated > 0) {
			ElMessage.success(`${orderSn} 已${getReceiptActionText(confirmed)}`);
		} else if (skippedOrderSns.includes(orderSn)) {
			ElMessage.warning(
				`${orderSn} 未执行${getReceiptActionText(confirmed)}：${
					skippedReasons[orderSn] || "后端已跳过"
				}`
			);
		} else {
			ElMessage.warning(`${orderSn} 未执行${getReceiptActionText(confirmed)}`);
		}
		await loadData({ preservePurchaseOrder: refreshContext });
	} catch (e: any) {
		ElMessage.error(e?.message || `${getReceiptActionText(confirmed)}失败`);
	}
}

function getBatchReceiptOrderSns(confirmed: number) {
	const predicate = Number(confirmed) === 1 ? canConfirmReceiptOrder : canCancelReceiptOrder;
	const orderSns = selectedRows.value
		.map((row) => getSelectedPurchaseOrder(row))
		.filter(predicate)
		.map((order) => String(order?.order_sn || "").trim())
		.filter(Boolean);

	return Array.from(new Set(orderSns));
}

async function batchConfirmReceipt(confirmed: number) {
	const orderSns = getBatchReceiptOrderSns(confirmed);
	const actionText = getReceiptActionText(confirmed);

	if (!orderSns.length) {
		ElMessage.warning(`勾选记录没有可${actionText}的采购单`);
		return;
	}

	let remark = "";
	try {
		remark = await promptReceiptRemark(confirmed, orderSns.length);
	} catch {
		return;
	}

	try {
		const res = await submitReceiptConfirm(orderSns, confirmed, remark);
		const updated = Number(res?.updated) || 0;
		const notFoundCount = Array.isArray(res?.not_found_order_sns)
			? res.not_found_order_sns.length
			: 0;
		const skippedCount = Array.isArray(res?.skipped_order_sns)
			? res.skipped_order_sns.length
			: 0;
		const parts = [
			updated ? `${actionText} ${updated} 单` : "",
			skippedCount ? `跳过 ${skippedCount} 单` : "",
			notFoundCount ? `${notFoundCount} 单未找到` : ""
		].filter(Boolean);
		const message = parts.join("，") || `${actionText} 0 单`;
		if (updated > 0) {
			ElMessage.success(message);
		} else {
			ElMessage.warning(message);
		}
		selectedRows.value = [];
		await loadData();
	} catch (e: any) {
		ElMessage.error(e?.message || `${actionText}失败`);
	}
}

function getShelfTargetOrder(row: any) {
	const recommendedSn = getRecommendedPurchaseOrderSn(row);
	if (recommendedSn) {
		const recommendedOrder = findProductPurchaseOrderBySn(row, recommendedSn);
		if (recommendedOrder?.order_sn) return recommendedOrder;
	}

	const selectedOrder = getSelectedPurchaseOrder(row);
	if (selectedOrder?.order_sn) return selectedOrder;

	return getProductPurchaseOrderOptions(row).find((order: any) => order?.order_sn) || null;
}

function doesPurchaseOrderMatchShelfWorkbench(order: any) {
	const shelved = Number(order?.fulfillment_adjustment?.shelved) === 1;
	return isShelvedWorkbench.value ? shelved : !shelved;
}

function doesPurchaseOrderMatchShelfAction(order: any, action: ShelfSelectionAction) {
	const shelved = Number(order?.fulfillment_adjustment?.shelved) === 1;
	return action === "unshelve" ? shelved : !shelved;
}

function doesPurchaseOrderMatchProductViewBase(order: any) {
	if (!order?.order_sn) return false;
	if (getActivePurchaseOrderStatusValues().length) return true;
	return Boolean(order?.is_calculated_order) && !order?.is_void_order;
}

function getShelfTargetOrders(row: any) {
	return getProductPurchaseOrderOptions(row).filter((order: any) => {
		return (
			doesPurchaseOrderMatchProductViewBase(order) &&
			doesPurchaseOrderMatchShelfWorkbench(order) &&
			doesPurchaseOrderMatchActiveFilters(order)
		);
	});
}

function getShelfTargetItems(rows: any[]) {
	const itemMap = new Map<string, any>();

	rows.forEach((row) => {
		getShelfTargetOrders(row).forEach((order: any) => {
			const identity = buildFulfillmentIdentity(row, order);
			const key = [
				identity.store_id,
				identity.marketplace,
				identity.asin,
				identity.msku,
				identity.product_code,
				identity.purchase_order_sn
			].join("|");
			itemMap.set(key, identity);
		});
	});

	return Array.from(itemMap.values());
}

function getShelfSelectionDisabledReason(order: any, action: ShelfSelectionAction) {
	if (!order?.order_sn) return "缺少采购单号";
	if (!doesPurchaseOrderMatchShelfAction(order, action)) {
		return action === "shelve" ? "该采购单已搁置" : "该采购单未搁置";
	}
	if (!doesPurchaseOrderMatchProductViewBase(order)) {
		return order?.is_void_order ? "采购单已作废" : "未参与当前产品视图计算";
	}
	return "";
}

function buildShelfSelectionDialogGroups(action: ShelfSelectionAction) {
	return buildShelfSelectionGroups(selectedRows.value, {
		getRowKey: (row) => String(row?.row_key || ""),
		getProduct,
		getOrders: getProductPurchaseOrderOptions,
		buildIdentity: buildFulfillmentIdentity,
		isOrderActionable: (_row, order) => {
			return (
				doesPurchaseOrderMatchShelfAction(order, action) &&
				doesPurchaseOrderMatchProductViewBase(order)
			);
		},
		isOrderCurrentMatched: (_row, order) => {
			return (
				doesPurchaseOrderMatchShelfAction(order, action) &&
				doesPurchaseOrderMatchProductViewBase(order) &&
				doesPurchaseOrderMatchActiveFilters(order)
			);
		},
		getDisabledReason: (_row, order) => getShelfSelectionDisabledReason(order, action)
	});
}

function openShelfSelectionDialog(action: ShelfSelectionAction) {
	const groups = buildShelfSelectionDialogGroups(action);
	const defaultSelectedCount = getSelectedShelfSelectionItems(groups).length;
	if (!defaultSelectedCount) {
		ElMessage.warning(
			action === "shelve"
				? "勾选记录没有可搁置的采购单产品"
				: "勾选记录没有可恢复的采购单产品"
		);
		return;
	}

	Object.keys(shelfSelectionExpandedMap).forEach((key) => {
		delete shelfSelectionExpandedMap[key];
	});
	groups.forEach((group) => {
		shelfSelectionExpandedMap[group.productKey] = true;
	});

	shelfSelectionAction.value = action;
	shelfSelectionGroups.value = groups;
	shelfSelectionShowAll.value = false;
	shelfSelectionRemark.value = action === "shelve" ? "历史数据，暂不处理" : "恢复到当前工作台";
	shelfSelectionVisible.value = true;
}

function getVisibleShelfSelectionOrders(group: ShelfSelectionGroup) {
	return (group?.orders || []).filter((order) =>
		isShelfSelectionOrderVisible(order, shelfSelectionShowAll.value)
	);
}

function getShelfSelectionVisibleActionableOrders(group: ShelfSelectionGroup) {
	return getVisibleShelfSelectionOrders(group).filter((order) => order.actionable);
}

function isShelfSelectionProductExpanded(group: ShelfSelectionGroup) {
	return shelfSelectionExpandedMap[group.productKey] !== false;
}

function toggleShelfSelectionProductExpand(group: ShelfSelectionGroup) {
	shelfSelectionExpandedMap[group.productKey] = !isShelfSelectionProductExpanded(group);
}

function isShelfSelectionProductChecked(group: ShelfSelectionGroup) {
	const orders = getShelfSelectionVisibleActionableOrders(group);
	return orders.length > 0 && orders.every((order) => order.selected);
}

function isShelfSelectionProductIndeterminate(group: ShelfSelectionGroup) {
	const orders = getShelfSelectionVisibleActionableOrders(group);
	const selectedCount = orders.filter((order) => order.selected).length;
	return selectedCount > 0 && selectedCount < orders.length;
}

function toggleShelfSelectionProduct(group: ShelfSelectionGroup, checked: any) {
	getShelfSelectionVisibleActionableOrders(group).forEach((order) => {
		order.selected = Boolean(checked);
	});
}

function toggleShelfSelectionOrder(order: ShelfSelectionOrder, checked: any) {
	if (!order.actionable) return;
	order.selected = Boolean(checked);
}

function selectShelfSelectionCurrentMatched() {
	shelfSelectionGroups.value.forEach((group) => {
		group.orders.forEach((order) => {
			order.selected = order.actionable && order.currentMatched;
		});
	});
	ElMessage.success(
		`已选择当前命中的 ${shelfSelectionStats.value.currentMatchedSelectedCount} 个采购单产品`
	);
}

function selectShelfSelectionActionable() {
	shelfSelectionShowAll.value = true;
	shelfSelectionGroups.value.forEach((group) => {
		group.orders.forEach((order) => {
			if (order.actionable) order.selected = true;
		});
	});
	ElMessage.success(`已选择全部 ${shelfSelectionStats.value.selectedCount} 个可处理采购单产品`);
}

function clearShelfSelection() {
	shelfSelectionGroups.value.forEach((group) => {
		group.orders.forEach((order) => {
			order.selected = false;
		});
	});
	ElMessage.info("已清空选择");
}

function getShelfSelectionProductTitle(group: ShelfSelectionGroup) {
	const product = group.product || {};
	return product.item_name || product.product_name || product.local_sku || product.product_code || "-";
}

function getShelfSelectionOrderPlanSns(selectionOrder: ShelfSelectionOrder) {
	const values = [
		...(Array.isArray(selectionOrder.order?.linked_plan_sns)
			? selectionOrder.order.linked_plan_sns
			: []),
		selectionOrder.order?.plan_sn,
		selectionOrder.order?.purchase_plan_sn,
		selectionOrder.identity?.primary_plan_sn,
		...(Array.isArray(selectionOrder.identity?.linked_plan_sns)
			? selectionOrder.identity.linked_plan_sns
			: [])
	];
	const seen = new Set<string>();

	return values
		.map((value) => String(value || "").trim())
		.filter((value) => {
			if (!value || seen.has(value)) return false;
			seen.add(value);
			return true;
		});
}

async function submitShelfState(shelved: boolean, items: any[], remark?: string) {
	const payload = {
		items,
		remark: remark || (shelved ? "历史数据，暂不处理" : "恢复到当前工作台")
	};

	return shelved
		? await service.app.bsr_purchase_plan_product_view.shelveFulfillment(payload)
		: await service.app.bsr_purchase_plan_product_view.unshelveFulfillment(payload);
}

function showShelfResult(result: any, actionText: string) {
	const successCount = Number(result?.success_count) || 0;
	const failedCount = Number(result?.failed_count) || 0;
	const message = failedCount
		? `${actionText} ${successCount} 条，失败 ${failedCount} 条`
		: `${actionText} ${successCount} 条`;

	if (successCount > 0 && failedCount === 0) {
		ElMessage.success(message);
	} else if (successCount > 0) {
		ElMessage.warning(message);
	} else {
		ElMessage.error(message);
	}
}

async function batchShelveSelectedRows() {
	openShelfSelectionDialog("shelve");
}

async function batchUnshelveSelectedRows() {
	openShelfSelectionDialog("unshelve");
}

async function confirmShelfSelection() {
	const isShelveAction = shelfSelectionAction.value === "shelve";
	const items = shelfSelectionSelectedItems.value;
	if (!items.length) {
		ElMessage.warning(`请选择需要${shelfSelectionActionText.value}的采购单产品`);
		return;
	}

	if (isShelveAction) {
		shelvingLoading.value = true;
	} else {
		unshelvingLoading.value = true;
	}
	try {
		const result = await submitShelfState(
			isShelveAction,
			items,
			isShelveAction ? shelfSelectionRemark.value : "恢复到当前工作台"
		);
		showShelfResult(result, shelfSelectionActionText.value);
		shelfSelectionVisible.value = false;
		selectedRows.value = [];
		await loadData();
	} catch (e: any) {
		ElMessage.error(e?.message || `${shelfSelectionActionText.value}失败`);
	} finally {
		shelvingLoading.value = false;
		unshelvingLoading.value = false;
	}
}

function formatPendingAndPlan(metrics: any) {
	return `${formatMetricNumber(metrics?.pending_delivery_qty)} / ${formatMetricNumber(
		metrics?.purchase_plan_qty
	)}`;
}

function getImageFallbackKey(row: any) {
	return (
		row?.row_key ||
		`${getProduct(row).store_id || ""}-${getProduct(row).asin || ""}-${getProduct(row).msku || ""}`
	);
}

function normalizeImageSku(value: any) {
	return String(value || "")
		.trim()
		.toLowerCase();
}

function toImageSkuList(value: any) {
	const rawList = Array.isArray(value) ? value : [value];

	return rawList.map(normalizeImageSku).filter(Boolean);
}

function addImageCandidate(candidates: string[], seen: Set<string>, value: any) {
	const url = String(value || "").trim();
	if (!url || seen.has(url)) return;

	seen.add(url);
	candidates.push(url);
}

function getProductImageSkuSet(row: any) {
	return new Set([
		...toImageSkuList(getProduct(row).local_sku),
		...toImageSkuList(getProduct(row).msku)
	]);
}

function hasMatchedLingxingImageSku(productSkus: Set<string>, lingxing: any) {
	if (productSkus.size === 0) return false;

	const planSkus = [...toImageSkuList(lingxing?.sku), ...toImageSkuList(lingxing?.msku)];
	return planSkus.some((sku) => productSkus.has(sku));
}

function getProductImageCandidates(row: any) {
	const candidates: string[] = [];
	const seen = new Set<string>();

	addImageCandidate(candidates, seen, getProduct(row).image_url);

	const productSkus = getProductImageSkuSet(row);
	const plans = Array.isArray(row?.plans) ? row.plans : [];

	plans.forEach((plan: any) => {
		const lingxing = plan?.lingxing || {};
		if (!hasMatchedLingxingImageSku(productSkus, lingxing)) return;

		addImageCandidate(candidates, seen, lingxing.pic_url);
	});

	return candidates;
}

function getProductImageUrl(row: any) {
	const candidates = getProductImageCandidates(row);
	if (!candidates.length) return "";

	const fallbackLevel = imageFallbackMap[getImageFallbackKey(row)] || 0;
	const candidateIndex = Math.floor(fallbackLevel / 2);
	const imageUrl = candidates[candidateIndex] || "";
	if (!imageUrl) return "";

	return fallbackLevel % 2 === 0 ? convert_image_url(imageUrl) : imageUrl;
}

function handleProductImageError(row: any) {
	const key = getImageFallbackKey(row);
	const current = imageFallbackMap[key] || 0;
	const candidates = getProductImageCandidates(row);
	const exhaustedFallbackLevel = candidates.length * 2;

	if (current < exhaustedFallbackLevel) {
		imageFallbackMap[key] = current + 1;
	}
}

function getSummary(row: any) {
	return row?.summary || {};
}

function getLingxingPlan(plan: any) {
	return plan?.lingxing || {};
}

function getLocalRecord(plan: any) {
	return plan?.local_record || {};
}

function getPurchaseOrderSummary(plan: any) {
	return (
		plan?.purchase_orders_summary || {
			order_count: 0,
			all_order_count: 0,
			linked_item_count: 0,
			all_linked_item_count: 0,
			quantity_plan_sum: 0,
			quantity_real_sum: 0,
			quantity_entry_sum: 0,
			quantity_receive_sum: 0,
			excluded_order_count: 0,
			completed_order_count: 0,
			void_order_count: 0,
			other_order_count: 0,
			latest_order_time: null,
			confirmed_count: 0,
			signed_count: 0,
			in_transit_count: 0,
			overtime_unsigned_count: 0,
			logistics_abnormal_count: 0,
			no_logistics_count: 0,
			logistics_tracked_order_count: 0,
			worst_logistics_status: "",
			worst_logistics_status_text: ""
		}
	);
}

function getPurchaseOrders(plan: any) {
	return Array.isArray(plan?.purchase_orders) ? plan.purchase_orders : [];
}

function hasPurchaseOrders(plan: any) {
	const summary = getPurchaseOrderSummary(plan);
	return (summary.all_order_count || summary.order_count || 0) > 0;
}

function getPurchaseOrderEntryQuantity(order: any) {
	return Number(order?.quantity_entry_sum ?? order?.quantity_entry ?? 0) || 0;
}

function getPurchaseOrderRealQuantity(order: any) {
	return Number(order?.quantity_real_sum ?? order?.quantity_real ?? 0) || 0;
}

function createEmptyProductPurchaseOrderShipmentSummary(quantityEntry = 0) {
	return {
		shipment_plan_qty_sum: 0,
		actual_shipment_qty_sum: 0,
		shippable_remaining_qty: Number(quantityEntry) || 0,
		estimated_shippable_qty: Number(quantityEntry) || 0,
		actual_shippable_qty: Number(quantityEntry) || 0,
		fulfillment_diff_qty: 0,
		shipment_plan_count: 0,
		actual_shipment_order_count: 0,
		actual_shipment_item_count: 0,
		latest_plan_time: null,
		latest_actual_time: null
	};
}

function createEmptyFulfillmentAdjustment() {
	return {
		id: null,
		defective_qty: 0,
		defective_status: 0,
		defective_remark: "",
		defective_process_remark: "",
		short_shipped_qty: 0,
		short_shipped_status: 0,
		short_shipped_remark: "",
		short_shipped_process_remark: "",
		document_status: 0,
		assigned_to_user_id: null,
		assigned_to_username: "",
		assigned_to_nickname: "",
		assigned_time: null,
		confirmed_by_user_id: null,
		confirmed_by_username: "",
		confirmed_by_nickname: "",
		confirmed_time: null,
		confirm_remark: "",
		manual_completed: 0,
		manual_completed_remark: "",
		manual_completed_by_user_id: null,
		manual_completed_by_username: "",
		manual_completed_time: null,
		shelved: 0,
		shelved_remark: "",
		shelved_by_user_id: null,
		shelved_by_username: "",
		shelved_by_nickname: "",
		shelved_time: null
	};
}

function getPurchaseOrderFulfillmentAdjustment(order: any) {
	return order?.fulfillment_adjustment || createEmptyFulfillmentAdjustment();
}

function isShelvedPurchaseOrder(order: any) {
	return Number(getPurchaseOrderFulfillmentAdjustment(order).shelved) === 1;
}

function getShelfInfoText(row: any) {
	const order = getShelfTargetOrder(row);
	if (!isShelvedPurchaseOrder(order)) return "";
	const adjustment = getPurchaseOrderFulfillmentAdjustment(order);
	const operator = adjustment.shelved_by_nickname || adjustment.shelved_by_username || "";
	return operator ? `已搁置 / ${operator}` : "已搁置";
}

function getShelfInfoTooltip(row: any) {
	const order = getShelfTargetOrder(row);
	const adjustment = getPurchaseOrderFulfillmentAdjustment(order);
	return [
		`采购单：${order?.order_sn || "-"}`,
		`搁置人：${adjustment.shelved_by_nickname || adjustment.shelved_by_username || "-"}`,
		`搁置时间：${formatDate(adjustment.shelved_time)}`,
		`原因：${adjustment.shelved_remark || "-"}`
	].join("\n");
}

function isManualCompletedPurchaseOrder(order: any) {
	const summary = order?.fulfillment_summary || {};
	const adjustment = getPurchaseOrderFulfillmentAdjustment(order);
	return (
		summary.fulfillment_status === "manual_completed" ||
		Number(adjustment.manual_completed) === 1
	);
}

function buildFrontendFulfillmentSummary(order: any) {
	const shipment = order?.shipment_summary || {};
	const adjustment = getPurchaseOrderFulfillmentAdjustment(order);
	const quantityReal = getPurchaseOrderRealQuantity(order);
	const quantityEntry = getPurchaseOrderEntryQuantity(order);
	const actualShipmentQty = Number(shipment.actual_shipment_qty_sum) || 0;
	const estimated = quantityReal - actualShipmentQty;
	const defectiveQty = Number(adjustment.defective_qty) || 0;
	const shortShippedQty = Number(adjustment.short_shipped_qty) || 0;
	const actual = estimated - defectiveQty - shortShippedQty;
	const defectivePending = defectiveQty > 0 && Number(adjustment.defective_status) !== 2;
	const shortShippedPending =
		shortShippedQty > 0 && Number(adjustment.short_shipped_status) !== 2;
	const isAllowedPurchaseOrderStatus = [2, 9].includes(Number(order?.purchase_order_status));
	const logisticsStatus = String(order?.logistics_status || "").trim();
	const manualCompleted = Number(adjustment.manual_completed) === 1;
	const isLogisticsReady =
		logisticsStatus === "signed" ||
		logisticsStatus === "confirmed" ||
		logisticsStatus === "in_transit" ||
		logisticsStatus === "partial_signed";
	const isLogisticsException = [
		"logistics_abnormal",
		"logistics_exception",
		"overtime_unsigned",
		"partial_overtime_unsigned",
		"pending_mapping",
		"phone_required",
		"manual_required"
	].includes(logisticsStatus);
	let fulfillment_status = "unready";
	let fulfillment_status_text = "未就绪";

	if (manualCompleted) {
		fulfillment_status = "manual_completed";
		fulfillment_status_text = "人工完成";
	} else if (defectivePending || shortShippedPending) {
		fulfillment_status = "exception_pending";
		fulfillment_status_text = "异常待处理";
	} else if (isAllowedPurchaseOrderStatus && defectiveQty + shortShippedQty > 0 && actual <= 0) {
		fulfillment_status = "exception_completed";
		fulfillment_status_text = "异常完成";
	} else if (isAllowedPurchaseOrderStatus && actual <= 0) {
		fulfillment_status = "normal_completed";
		fulfillment_status_text = "正常完成";
	} else if (isAllowedPurchaseOrderStatus && isLogisticsReady && actual > 0) {
		fulfillment_status = "shippable";
		fulfillment_status_text = "可发货";
	} else if (isAllowedPurchaseOrderStatus && isLogisticsException && actual > 0) {
		fulfillment_status = "logistics_exception";
		fulfillment_status_text = "物流异常";
	}
	const fulfillment_group_status = getFulfillmentGroupStatus(fulfillment_status);
	const fulfillment_group_status_text = getFulfillmentStatusLabel(fulfillment_group_status);

	return {
		quantity_real_sum: quantityReal,
		quantity_entry_sum: quantityEntry,
		actual_shipment_qty_sum: actualShipmentQty,
		estimated_shippable_qty: estimated,
		defective_qty: defectiveQty,
		defective_status: Number(adjustment.defective_status) || 0,
		short_shipped_qty: shortShippedQty,
		short_shipped_status: Number(adjustment.short_shipped_status) || 0,
		logistics_status: logisticsStatus,
		exception_qty: defectiveQty + shortShippedQty,
		actual_shippable_qty: manualCompleted ? 0 : actual,
		fulfillment_status,
		fulfillment_status_text,
		fulfillment_group_status,
		fulfillment_group_status_text
	};
}

function getPurchaseOrderFulfillmentSummary(order: any) {
	return order?.fulfillment_summary || buildFrontendFulfillmentSummary(order);
}

function getPurchaseOrderSelectionKey(row: any) {
	return row?.row_key || "";
}

function getPlanOrderRelationKey(plan: any, order: any) {
	return `${plan?.plan_sn || ""}|${order?.order_sn || ""}`;
}

function getProductPurchaseOrderOptions(row: any) {
	const orderMap = new Map<string, any>();
	const plans = getSortedPlans(row);

	plans.forEach((plan: any) => {
		getPurchaseOrders(plan).forEach((order: any) => {
			const orderSn = String(order?.order_sn || "").trim();
			if (!orderSn) return;

			if (!orderMap.has(orderSn)) {
				orderMap.set(orderSn, {
					...order,
					order_sn: orderSn,
					item_count: 0,
					calculated_item_count: 0,
					quantity_plan_sum: 0,
					quantity_real_sum: 0,
					quantity_entry_sum: 0,
					quantity_receive_sum: 0,
					is_calculated_order: false,
					is_void_order: false,
					linked_plans: [],
					linked_plan_sns: [],
					order_entries: [],
					shipment_summary: createEmptyProductPurchaseOrderShipmentSummary(),
					shipment_plans: [],
					fulfillment_adjustment: createEmptyFulfillmentAdjustment(),
					fulfillment_summary: null,
					purchase_flow_summary: null,
					_shipment_plan_keys: new Set<string>(),
					_actual_order_keys: new Set<string>()
				});
			}

			const target = orderMap.get(orderSn);
			target.order_entries.push({ plan, order });
			target.linked_plans.push(plan);
			target.linked_plan_sns.push(plan.plan_sn || "");
			target.item_count += Number(order.item_count) || 0;
			target.calculated_item_count += Number(order.calculated_item_count) || 0;
			target.quantity_plan_sum += Number(order.quantity_plan_sum) || 0;
			target.quantity_real_sum += Number(order.quantity_real_sum) || 0;
			target.quantity_entry_sum += Number(order.quantity_entry_sum) || 0;
			target.quantity_receive_sum += Number(order.quantity_receive_sum) || 0;
			target.is_calculated_order =
				target.is_calculated_order || Boolean(order.is_calculated_order);
			target.is_void_order = target.is_void_order || Boolean(order.is_void_order);
			if (order.fulfillment_adjustment?.id || !target.fulfillment_adjustment?.id) {
				target.fulfillment_adjustment =
					order.fulfillment_adjustment || target.fulfillment_adjustment;
			}
			if (order.purchase_flow_summary && !target.purchase_flow_summary) {
				target.purchase_flow_summary = order.purchase_flow_summary;
			}

			mergePurchaseOrderShipmentData(target, order, plan);

			if (
				getTimeValue(order.purchase_order_time) > getTimeValue(target.purchase_order_time)
			) {
				target.purchase_order_time = order.purchase_order_time;
				target.purchase_order_status = order.purchase_order_status;
				target.purchase_order_status_text = order.purchase_order_status_text;
				target.purchase_order_supplier_name = order.purchase_order_supplier_name;
				target.calculation_excluded_reason = order.calculation_excluded_reason;
				target.opt_realname = order.opt_realname;
				target.auditor_realname = order.auditor_realname;
				target.last_realname = order.last_realname;
			}
		});
	});

	return Array.from(orderMap.values())
		.map((order: any) => {
			const summary = order.shipment_summary;
			summary.shippable_remaining_qty =
				getPurchaseOrderEntryQuantity(order) -
				(Number(summary.actual_shipment_qty_sum) || 0);
			summary.estimated_shippable_qty = summary.shippable_remaining_qty;
			summary.fulfillment_diff_qty =
				(Number(summary.actual_shipment_qty_sum) || 0) -
				(Number(summary.shipment_plan_qty_sum) || 0);
			order.fulfillment_summary = buildFrontendFulfillmentSummary(order);
			summary.actual_shippable_qty = order.fulfillment_summary.actual_shippable_qty;
			order.linked_plans = dedupePlans(order.linked_plans);
			order.linked_plan_sns = order.linked_plans
				.map((plan: any) => plan.plan_sn)
				.filter(Boolean);
			order.linked_plan_count = order.linked_plan_sns.length;
			delete order._shipment_plan_keys;
			delete order._actual_order_keys;
			return order;
		})
		.sort((a: any, b: any) => {
			const selectableDiff =
				Number(canSelectPurchaseOrder(b)) - Number(canSelectPurchaseOrder(a));
			if (selectableDiff) return selectableDiff;

			const calculatedDiff =
				Number(Boolean(b.is_calculated_order)) - Number(Boolean(a.is_calculated_order));
			if (calculatedDiff) return calculatedDiff;

			const timeDiff =
				getTimeValue(b.purchase_order_time) - getTimeValue(a.purchase_order_time);
			if (timeDiff) return timeDiff;

			return String(b.order_sn || "").localeCompare(String(a.order_sn || ""));
		});
}

function findProductPurchaseOrderBySn(row: any, orderSn: string) {
	const targetSn = String(orderSn || "").trim();
	if (!targetSn) return null;

	return (
		getProductPurchaseOrderOptions(row).find(
			(order: any) => String(order?.order_sn || "").trim() === targetSn
		) || null
	);
}

function mergePurchaseOrderShipmentData(target: any, order: any, plan: any) {
	const summary = target.shipment_summary;

	getPurchaseOrderShipmentPlans(order).forEach((shipmentPlan: any) => {
		const planSn = shipmentPlan.purchase_plan_sn || plan?.plan_sn || "";
		const planKey = [
			planSn,
			shipmentPlan.id,
			shipmentPlan.isp_id,
			shipmentPlan.seq,
			shipmentPlan.shipment_plan_sn
		].join("|");
		if (target._shipment_plan_keys.has(planKey)) return;

		target._shipment_plan_keys.add(planKey);
		target.shipment_plans.push({
			...shipmentPlan,
			purchase_plan_sn: planSn
		});
		summary.shipment_plan_count += 1;
		summary.shipment_plan_qty_sum += Number(shipmentPlan.shipment_plan_quantity) || 0;
		summary.actual_shipment_qty_sum += Number(shipmentPlan.actual_qty_sum) || 0;
		summary.actual_shipment_item_count += Array.isArray(shipmentPlan.actual_details)
			? shipmentPlan.actual_details.length
			: 0;
		summary.latest_plan_time = pickLatestTimeValue(
			summary.latest_plan_time,
			shipmentPlan.create_time
		);

		(Array.isArray(shipmentPlan.actual_details) ? shipmentPlan.actual_details : []).forEach(
			(detail: any) => {
				if (detail?.shipment_sn) {
					target._actual_order_keys.add(detail.shipment_sn);
				}
				summary.latest_actual_time = pickLatestTimeValue(
					summary.latest_actual_time,
					detail?.shipment_time
				);
			}
		);
	});

	summary.actual_shipment_order_count = target._actual_order_keys.size;
}

function dedupePlans(plans: any[]) {
	const seen = new Set<string>();
	const result: any[] = [];

	plans.forEach((plan: any) => {
		const planSn = String(plan?.plan_sn || "").trim();
		if (!planSn || seen.has(planSn)) return;
		seen.add(planSn);
		result.push(plan);
	});

	return result;
}

function pickLatestTimeValue(current: any, next: any) {
	if (!next) return current || null;
	if (!current) return next;

	return getTimeValue(next) > getTimeValue(current) ? next : current;
}

function getDefaultSelectedProductPurchaseOrderSn(row: any) {
	const recommended = getRecommendedPurchaseOrderSn(row);
	if (recommended) return recommended;

	const orders = getProductPurchaseOrderOptions(row);
	return (orders.find(canSelectPurchaseOrder) || orders[0])?.order_sn || "";
}

function getPlanPurchaseOrderOptions(row: any, plan: any) {
	const orders = getPurchaseOrders(plan);
	if (orders.length) return orders;

	if (!plan?.plan_sn) return getProductPurchaseOrderOptions(row);
	return [];
}

function getDefaultSelectedPlanPurchaseOrderSn(row: any, plan: any) {
	const orders = getPlanPurchaseOrderOptions(row, plan);
	return (orders.find(canSelectPurchaseOrder) || orders[0])?.order_sn || "";
}

function getRecommendedPurchaseOrderSn(row: any) {
	const byStatus = row?.recommended_purchase_order_sn_by_status || {};
	if (row?.recommended_purchase_order_sn) {
		return row.recommended_purchase_order_sn;
	}
	if (filters.logistics_status || getActivePurchaseOrderStatusValues().length) {
		return row?.recommended_purchase_order_sn || "";
	}
	if (filters.fulfillment_status && byStatus[filters.fulfillment_status]) {
		return byStatus[filters.fulfillment_status];
	}
	return row?.recommended_purchase_order_sn || "";
}

function getSelectedPurchaseOrder(row: any, plan?: any) {
	const selectedPlan = plan === undefined ? getSelectedPlan(row) : plan;
	const orders = getPlanPurchaseOrderOptions(row, selectedPlan);
	if (!orders.length) return null;

	const key = getPurchaseOrderSelectionKey(row);
	const selectedSn = selectedPurchaseOrderSnMap[key];
	const selectedOrder = orders.find((order: any) => order.order_sn === selectedSn);

	if (selectedOrder && canSelectPurchaseOrder(selectedOrder)) return selectedOrder;
	return orders.find(canSelectPurchaseOrder) || orders[0];
}

function selectPurchaseOrder(row: any, order: any) {
	if (!row?.row_key || !order?.order_sn) return;
	if (!canSelectPurchaseOrder(order)) return;

	const key = getPurchaseOrderSelectionKey(row);
	selectedPurchaseOrderSnMap[key] = order.order_sn;
	purchaseOrderPopoverVisibleMap[key] = false;
	const primaryPlan = getPrimaryPlanForPurchaseOrder(row, order);
	if (primaryPlan?.plan_sn) {
		selectedPlanSnMap[row.row_key] = primaryPlan.plan_sn;
	}
	syncDetailState();
	if (purchaseOrderFlowDrawer.visible && purchaseOrderFlowDrawer.row?.row_key === row.row_key) {
		purchaseOrderFlowDrawer.order = order;
		purchaseOrderFlowDrawer.selectedNodeKey = "analysis";
		purchaseOrderFlowDrawer.formulaExpanded = false;
		resetPurchaseFlowGraphView();
		loadPurchaseOrderFlow();
	}
}

function selectPurchasePlan(row: any, plan: any) {
	if (!row?.row_key || !plan?.plan_sn) return;

	selectedPlanSnMap[row.row_key] = plan.plan_sn;
	selectedPurchaseOrderSnMap[row.row_key] = getDefaultSelectedPlanPurchaseOrderSn(row, plan);
	syncDetailState();

	if (purchaseOrderFlowDrawer.visible && purchaseOrderFlowDrawer.row?.row_key === row.row_key) {
		purchaseOrderFlowDrawer.order = getSelectedPurchaseOrder(row, plan);
		purchaseOrderFlowDrawer.selectedNodeKey = "analysis";
		purchaseOrderFlowDrawer.formulaExpanded = false;
		resetPurchaseFlowGraphView();
		loadPurchaseOrderFlow();
	}
}

function canSelectPurchaseOrder(order: any) {
	return (
		Boolean(order?.is_calculated_order) &&
		!order?.is_void_order &&
		!isManualCompletedPurchaseOrder(order)
	);
}

function resetSelectedPurchaseOrder(row: any, plan: any) {
	const key = getPurchaseOrderSelectionKey(row);
	selectedPurchaseOrderSnMap[key] = getDefaultSelectedPlanPurchaseOrderSn(row, plan);
	purchaseOrderPopoverVisibleMap[key] = false;
}

function getPurchaseOrderShipmentSummary(order: any) {
	return (
		order?.shipment_summary || {
			shipment_plan_qty_sum: 0,
			actual_shipment_qty_sum: 0,
			shippable_remaining_qty: getPurchaseOrderEntryQuantity(order),
			estimated_shippable_qty: getPurchaseOrderEntryQuantity(order),
			actual_shippable_qty: getPurchaseOrderEntryQuantity(order),
			fulfillment_diff_qty: 0,
			shipment_plan_count: 0,
			actual_shipment_order_count: 0,
			actual_shipment_item_count: 0,
			latest_plan_time: null,
			latest_actual_time: null
		}
	);
}

function getPurchaseOrderShipmentPlans(order: any) {
	return Array.isArray(order?.shipment_plans) ? order.shipment_plans : [];
}

function hasPurchaseOrderShipmentPlans(order: any) {
	return getPurchaseOrderShipmentPlans(order).length > 0;
}

function getPurchaseOrderActualDetails(order: any) {
	return getPurchaseOrderShipmentPlans(order).flatMap((shipmentPlan: any) => {
		const details = Array.isArray(shipmentPlan?.actual_details)
			? shipmentPlan.actual_details
			: [];

		return details.map((detail: any) => ({
			...detail,
			seq: detail.seq || shipmentPlan.seq || "",
			shipment_plan_sn: detail.shipment_plan_sn || shipmentPlan.shipment_plan_sn || "",
			purchase_order_sn: shipmentPlan.purchase_order_sn || "",
			shipping_method: shipmentPlan.shipping_method || ""
		}));
	});
}

function formatSignedNumber(value: any) {
	const num = Number(value) || 0;
	return num > 0 ? `+${num}` : String(num);
}

function getDiffClass(value: any) {
	const num = Number(value) || 0;
	if (num > 0) return "positive";
	if (num < 0) return "negative";
	return "";
}

function hasFulfillmentPlan(summary: any) {
	return (
		(Number(summary?.shipment_plan_count) || 0) > 0 ||
		(Number(summary?.shipment_plan_qty_sum) || 0) > 0
	);
}

function formatFulfillmentDiff(summary: any) {
	if (!hasFulfillmentPlan(summary)) return "未安排";
	return formatSignedNumber(summary?.fulfillment_diff_qty);
}

function getFulfillmentDiffClass(summary: any) {
	if (!hasFulfillmentPlan(summary)) return "muted";
	return getDiffClass(summary?.fulfillment_diff_qty);
}

function getPurchaseOrderDisplayFulfillment(order: any) {
	const shipment = getPurchaseOrderShipmentSummary(order);
	const adjustment = getPurchaseOrderFulfillmentAdjustment(order);
	const quantityReal = Number(order?.quantity_real_sum) || 0;
	const quantityEntry = getPurchaseOrderEntryQuantity(order);
	const shipmentPlanQty = Number(shipment.shipment_plan_qty_sum) || 0;
	const actualShipmentQty = Number(shipment.actual_shipment_qty_sum) || 0;
	const defectiveQty = Number(adjustment.defective_qty) || 0;
	const shortShippedQty = Number(adjustment.short_shipped_qty) || 0;
	const estimatedQty = quantityReal - actualShipmentQty;
	const actualShippableQty = isManualCompletedPurchaseOrder(order)
		? 0
		: estimatedQty - defectiveQty - shortShippedQty;

	return {
		quantityReal,
		quantityEntry,
		shipmentPlanQty,
		actualShipmentQty,
		estimatedQty,
		defectiveQty,
		shortShippedQty,
		actualShippableQty
	};
}

function createMetricHelp(title: string, lines: string[], note = "") {
	return { title, lines, note };
}

function getPurchaseOrderMetricHelp(order: any, key: string) {
	const adjustment = getPurchaseOrderFulfillmentAdjustment(order);
	const display = getPurchaseOrderDisplayFulfillment(order);
	const {
		quantityReal,
		quantityEntry,
		shipmentPlanQty,
		actualShipmentQty,
		estimatedQty,
		defectiveQty,
		shortShippedQty,
		actualShippableQty
	} = display;

	const helps: Record<string, any> = {
		quantity_real: createMetricHelp("采购实际", [
			"来源：领星采购单明细表 quantity_real",
			"口径：当前产品 + 当前采购单 PO 的实际采购数量汇总",
			`当前值：${quantityReal}`
		]),
		quantity_entry: createMetricHelp(
			"入库",
			[
				"来源：领星采购单明细表 quantity_entry",
				"口径：当前产品 + 当前采购单 PO 的入库数量汇总",
				`当前值：${quantityEntry}`
			],
			"当前只作为参考字段，不参与可发货和完成状态计算。"
		),
		shipment_plan: createMetricHelp(
			"已计划发货",
			[
				"来源：发货计划明细",
				"口径：当前产品 + 当前采购单 PO 已创建的发货计划数量",
				`当前值：${shipmentPlanQty}`
			],
			"这是发货计划数量，不代表已经实际发货。实际扣减以实际发货为准。"
		),
		actual_shipment: createMetricHelp("实际发货", [
			"来源：实际发货单表 shipment_list_quantity",
			"关联：发货计划 isp_id 与实际发货单 isp_id",
			`当前值：${actualShipmentQty}`,
			`已计划发货参考：${shipmentPlanQty}`
		]),
		estimated_shippable: createMetricHelp(
			"预计可发",
			[
				"公式：采购实际 - 实际发货",
				`当前：${quantityReal} - ${actualShipmentQty} = ${estimatedQty}`,
				`入库参考：${quantityEntry}`
			],
			"当前暂不使用入库数量参与可发计算，因为仓库入库数据更新不及时。"
		),
		actual_shippable: createMetricHelp(
			"实际可发",
			isManualCompletedPurchaseOrder(order)
				? [
						"本地已标记人工完成，实际可发按 0 计算。",
						`人工完成原因：${adjustment.manual_completed_remark || "-"}`
					]
				: [
						"公式：预计可发 - 残次品 - 商家少发",
						`当前：${estimatedQty} - ${defectiveQty} - ${shortShippedQty} = ${actualShippableQty}`,
						"用途：批量发货按这个数量判断。"
					]
		),
		defective: createMetricHelp(
			"残次品",
			[
				"来源：履约调整表 defective_qty",
				"口径：当前产品 + 当前采购单 PO 的残次品数量",
				`当前值：${defectiveQty}`,
				defectiveQty > 0
					? `处理状态：${getAdjustmentStatusText(adjustment.defective_status)}`
					: ""
			].filter(Boolean)
		),
		short_shipped: createMetricHelp(
			"商家少发",
			[
				"来源：履约调整表 short_shipped_qty",
				"口径：当前产品 + 当前采购单 PO 的商家少发数量",
				`当前值：${shortShippedQty}`,
				shortShippedQty > 0
					? `处理状态：${getAdjustmentStatusText(adjustment.short_shipped_status)}`
					: ""
			].filter(Boolean)
		)
	};

	return helps[key] || createMetricHelp(key, []);
}

function getFulfillmentStatusTagType(status: string): any {
	return (
		(
			{
				shippable: "success",
				completed: "info",
				exception_completed: "warning",
				abnormal: "danger",
				normal_completed: "info",
				manual_completed: "info",
				pending_purchase: "danger",
				logistics_exception: "danger",
				exception_pending: "danger",
				unready: "danger"
			} as Record<string, any>
		)[status] || "info"
	);
}

function getFulfillmentStatusDescription(status: string) {
	const groupStatus = getFulfillmentGroupStatus(status);
	if (!groupStatus) {
		return "不按艾为履约状态过滤，展示所有符合其它条件的采购单产品。";
	}
	const option = fulfillmentStatusOptions.find((item) => item.value === groupStatus);
	return option?.rule || "不按艾为履约状态过滤，展示所有符合其它条件的采购单产品。";
}

function getAdjustmentStatusText(status: any) {
	const value = Number(status) || 0;
	if (value === 2) return "已处理";
	if (value === 1) return "待处理";
	return "无异常";
}

function getAdjustmentStatusTagType(status: any): any {
	const value = Number(status) || 0;
	if (value === 2) return "success";
	if (value === 1) return "danger";
	return "info";
}

function getFulfillmentDocumentStatusText(status: any) {
	return (
		(
			{
				0: "待处理",
				1: "处理中",
				2: "待确认",
				3: "已确认锁定"
			} as Record<number, string>
		)[Number(status) || 0] || "待处理"
	);
}

function getFulfillmentDocumentStatusTagType(status: any): any {
	return (
		(
			{
				0: "info",
				1: "warning",
				2: "primary",
				3: "success"
			} as Record<number, string>
		)[Number(status) || 0] || "info"
	);
}

function getCurrentPurchaseOrderDetailTitle(order: any) {
	if (!order) return "当前产品未关联采购单";
	const display = getPurchaseOrderDisplayFulfillment(order);

	return [
		`采购实际 ${display.quantityReal}`,
		`实际发货 ${display.actualShipmentQty}`,
		`预计可发 ${display.estimatedQty}`,
		`实际可发 ${display.actualShippableQty}`,
		`入库参考 ${display.quantityEntry}`
	].join(" / ");
}

function getPurchaseOrderOptionText(order: any) {
	const display = getPurchaseOrderDisplayFulfillment(order);

	return [
		order?.linked_plan_count ? `关联计划${order.linked_plan_count}` : "",
		`采购实际${display.quantityReal}`,
		`实际发货${display.actualShipmentQty}`,
		`预计可发${display.estimatedQty}`,
		`实际可发${display.actualShippableQty}`,
		`入库参考${display.quantityEntry}`
	]
		.filter(Boolean)
		.join(" / ");
}

function getPurchaseOrderOptionMetrics(order: any) {
	const adjustment = getPurchaseOrderFulfillmentAdjustment(order);
	const display = getPurchaseOrderDisplayFulfillment(order);
	const defectiveStatusText =
		display.defectiveQty > 0 ? getAdjustmentStatusText(adjustment.defective_status) : "";
	const shortShippedStatusText =
		display.shortShippedQty > 0 ? getAdjustmentStatusText(adjustment.short_shipped_status) : "";

	return [
		{
			key: "quantity_real",
			label: "采购实际",
			value: display.quantityReal,
			help: getPurchaseOrderMetricHelp(order, "quantity_real")
		},
		{
			key: "quantity_entry",
			label: "入库",
			value: display.quantityEntry,
			help: getPurchaseOrderMetricHelp(order, "quantity_entry")
		},
		{
			key: "shipment_plan",
			label: "已计划发货",
			value: display.shipmentPlanQty,
			help: getPurchaseOrderMetricHelp(order, "shipment_plan")
		},
		{
			key: "actual_shipment",
			label: "实际发货",
			value: display.actualShipmentQty,
			help: getPurchaseOrderMetricHelp(order, "actual_shipment")
		},
		{
			key: "estimated_shippable",
			label: "预计可发",
			value: display.estimatedQty,
			className: getDiffClass(display.estimatedQty),
			help: getPurchaseOrderMetricHelp(order, "estimated_shippable")
		},
		{
			key: "actual_shippable",
			label: "实际可发",
			value: display.actualShippableQty,
			className: getDiffClass(display.actualShippableQty),
			emphasized: true,
			statusText: isManualCompletedPurchaseOrder(order) ? "人工完成" : "",
			statusTagType: "warning",
			help: getPurchaseOrderMetricHelp(order, "actual_shippable")
		},
		{
			key: "defective",
			label: "残次品",
			value: display.defectiveQty,
			className: display.defectiveQty > 0 ? "negative" : "",
			abnormal: display.defectiveQty > 0,
			statusText: defectiveStatusText,
			statusTagType: getAdjustmentStatusTagType(adjustment.defective_status),
			help: getPurchaseOrderMetricHelp(order, "defective")
		},
		{
			key: "short_shipped",
			label: "商家少发",
			value: display.shortShippedQty,
			className: display.shortShippedQty > 0 ? "negative" : "",
			abnormal: display.shortShippedQty > 0,
			statusText: shortShippedStatusText,
			statusTagType: getAdjustmentStatusTagType(adjustment.short_shipped_status),
			help: getPurchaseOrderMetricHelp(order, "short_shipped")
		}
	].map((metric: any) => ({
		...metric,
		tooltip: formatMetricHelpTooltip(metric.help)
	}));
}

function formatMetricHelpTooltip(help: any) {
	return [help?.title, ...(help?.lines || []), help?.note].filter(Boolean).join("\n");
}

function getPurchaseOrderOptionPlanMeta(order: any) {
	const plans = Array.isArray(order?.linked_plans) ? order.linked_plans : [];
	if (!plans.length) return "采购计划信息 -";

	const primaryPlan = plans[0];
	const lingxing = getLingxingPlan(primaryPlan);
	const local = getLocalRecord(primaryPlan);
	const creator = lingxing.creator_real_name || "-";
	const buyer = getPlanBuyer(primaryPlan);

	return [
		plans.length > 1 ? `${plans.length}个采购计划` : primaryPlan?.plan_sn || "",
		`领星${lingxing.quantity_plan || 0}`,
		`本地${local.quantity_plan || 0}`,
		`创建${formatShortDateTime(getPlanTime(primaryPlan))}`,
		`创建人${creator}`,
		`采购${buyer}`
	]
		.filter(Boolean)
		.join(" / ");
}

function formatLinkedPlanSns(order: any) {
	const sns = Array.isArray(order?.linked_plan_sns) ? order.linked_plan_sns.filter(Boolean) : [];
	if (!sns.length) return "-";

	return sns.length > 2 ? `${sns.slice(0, 2).join(" / ")} 等${sns.length}条` : sns.join(" / ");
}

const PURCHASE_FLOW_NODE_LAYOUT = [
	{ key: "analysis", x: 50, y: 78, width: 240, height: 112 },
	{ key: "purchase_plan", x: 360, y: 78, width: 240, height: 112 },
	{ key: "purchase_order", x: 670, y: 78, width: 240, height: 112 },
	{ key: "shipment_plan", x: 980, y: 78, width: 240, height: 112 },
	{ key: "fulfillment", x: 670, y: 322, width: 240, height: 112 },
	{ key: "shipment_actual", x: 980, y: 322, width: 240, height: 112 }
];

const PURCHASE_FLOW_EDGE_LAYOUT = [
	{
		key: "analysis-plan",
		from: "analysis",
		to: "purchase_plan",
		label: "生成计划",
		fullLabel: "生成采购计划"
	},
	{
		key: "plan-order",
		from: "purchase_plan",
		to: "purchase_order",
		label: "同步采购单",
		fullLabel: "同步采购单"
	},
	{
		key: "order-shipment-plan",
		from: "purchase_order",
		to: "shipment_plan",
		label: "创建发货",
		fullLabel: "创建发货计划"
	},
	{
		key: "shipment-plan-actual",
		from: "shipment_plan",
		to: "shipment_actual",
		label: "同步实发",
		fullLabel: "同步实际发货"
	},
	{
		key: "order-fulfillment",
		from: "purchase_order",
		to: "fulfillment",
		label: "计算履约",
		fullLabel: "计算履约"
	},
	{
		key: "actual-fulfillment",
		from: "shipment_actual",
		to: "fulfillment",
		label: "扣减实发",
		fullLabel: "扣减实发"
	}
];

function getPurchaseOrderFlowCardNodes(row: any, order: any) {
	const summary = getPurchaseOrderFlowCardSummary(row, order);
	const nodes = Array.isArray(summary?.nodes) ? summary.nodes : [];

	return nodes.map((node: any) => ({
		key: node.key,
		label: node.label || getPurchaseFlowNodeDefaultLabel(node.key),
		status: node.status || "empty",
		time: formatShortDateTime(node.time),
		operator_name: node.operator_name || (node.operator_missing ? "缺少操作人" : "-"),
		operator_missing: Boolean(node.operator_missing),
		main_text: node.main_text || "-",
		meta_text: node.meta_text || "-"
	}));
}

function getPurchaseOrderFlowNodeTitle(node: any) {
	return [
		node?.label || "-",
		node?.time ? `时间：${node.time}` : "",
		node?.main_text ? `事项：${node.main_text}` : "",
		node?.operator_name ? `操作人：${node.operator_name}` : "",
		node?.meta_text ? `说明：${node.meta_text}` : ""
	]
		.filter(Boolean)
		.join("\n");
}

function getPurchaseOrderFlowCardSummary(row: any, order: any) {
	if (order?.purchase_flow_summary) return order.purchase_flow_summary;

	const entrySummary = order?.order_entries?.[0]?.order?.purchase_flow_summary;
	if (entrySummary) return entrySummary;

	return buildFallbackPurchaseOrderFlowSummary(row, order);
}

function buildFallbackPurchaseOrderFlowSummary(row: any, order: any) {
	const primaryPlan = getPrimaryPlanForPurchaseOrder(row, order) || getSelectedPlan(row);
	const local = getLocalRecord(primaryPlan);
	const lingxing = getLingxingPlan(primaryPlan);
	const shipment = getPurchaseOrderShipmentSummary(order);
	const fulfillment = getPurchaseOrderFulfillmentSummary(order);
	const planQty =
		Number(local.quantity_plan) ||
		Number(lingxing.quantity_plan) ||
		Number(order?.quantity_plan_sum) ||
		0;
	const planOperatorName =
		local.purchase_plan_created_by_nickname ||
		local.purchase_plan_created_by_username ||
		lingxing.creator_real_name ||
		lingxing.cg_opt_username ||
		"缺少操作人";
	const planOperatorMissing = planOperatorName === "缺少操作人";
	const hasOrder = Boolean(order?.order_sn);

	return {
		nodes: [
			{
				key: "analysis",
				label: "补货分析",
				status: planQty ? "done" : "empty",
				time: local.purchase_plan_created_time || local.create_time,
				operator_name: planOperatorName,
				operator_missing: planOperatorMissing,
				main_text: `建议 ${flowNumber(planQty)}`,
				meta_text:
					local.raw_remark?.user_selected_algo_name ||
					local.expected_sales?.user_selected_algo_name ||
					"补货测算"
			},
			{
				key: "purchase_plan",
				label: "采购计划",
				status: primaryPlan ? "done" : "empty",
				time:
					local.purchase_plan_created_time ||
					lingxing.create_time_remote ||
					local.create_time,
				operator_name: planOperatorName,
				operator_missing: planOperatorMissing,
				main_text: `计划 ${flowNumber(planQty)}`,
				meta_text: primaryPlan?.plan_sn || getPlanStatusText(primaryPlan)
			},
			{
				key: "purchase_order",
				label: "采购单",
				status: hasOrder ? "done" : "empty",
				time: order?.purchase_order_time,
				operator_name: hasOrder ? "缺少操作人" : "-",
				operator_missing: hasOrder,
				main_text: hasOrder
					? `采购 ${flowNumber(order?.quantity_real_sum)} / 入库 ${flowNumber(order?.quantity_entry_sum)}`
					: "暂无采购单",
				meta_text: order?.purchase_order_status_text || "待采购"
			},
			{
				key: "shipment_plan",
				label: "发货计划",
				status: Number(shipment.shipment_plan_count) > 0 ? "done" : "empty",
				time: shipment.latest_plan_time,
				operator_name: Number(shipment.shipment_plan_count) > 0 ? "缺少操作人" : "-",
				operator_missing: Number(shipment.shipment_plan_count) > 0,
				main_text:
					Number(shipment.shipment_plan_count) > 0
						? `计划发货 ${flowNumber(shipment.shipment_plan_qty_sum)}`
						: "未安排",
				meta_text:
					Number(shipment.shipment_plan_count) > 0
						? `${shipment.shipment_plan_count}批`
						: "-"
			},
			{
				key: "shipment_actual",
				label: "实际发货",
				status: Number(shipment.actual_shipment_qty_sum) > 0 ? "done" : "empty",
				time: shipment.latest_actual_time,
				operator_name: Number(shipment.actual_shipment_qty_sum) > 0 ? "缺少操作人" : "-",
				operator_missing: Number(shipment.actual_shipment_qty_sum) > 0,
				main_text:
					Number(shipment.actual_shipment_qty_sum) > 0
						? `实发 ${flowNumber(shipment.actual_shipment_qty_sum)}`
						: "暂无实发",
				meta_text:
					Number(shipment.actual_shipment_order_count) > 0
						? `${shipment.actual_shipment_order_count}单`
						: "-"
			},
			{
				key: "fulfillment",
				label: "履约状态",
				status: hasOrder
					? getFulfillmentGroupStatus(fulfillment) === "abnormal"
						? "warning"
						: ["completed", "exception_completed"].includes(
									getFulfillmentGroupStatus(fulfillment)
							  )
							? "done"
							: getFulfillmentGroupStatus(fulfillment) === "shippable"
								? "pending"
								: "empty"
					: "empty",
				time:
					shipment.latest_actual_time ||
					shipment.latest_plan_time ||
					order?.purchase_order_time,
				operator_name: "系统计算",
				operator_missing: false,
				main_text: hasOrder
					? `实际可发 ${flowNumber(fulfillment.actual_shippable_qty)}`
					: "等待采购单",
				meta_text: hasOrder ? getFulfillmentDisplayText(fulfillment) || "-" : "未开始"
			}
		],
		edges: [
			{ from: "analysis", to: "purchase_plan", label: "生成采购计划" },
			{ from: "purchase_plan", to: "purchase_order", label: "同步采购单" },
			{ from: "purchase_order", to: "shipment_plan", label: "创建发货计划" },
			{ from: "shipment_plan", to: "shipment_actual", label: "同步实际发货" },
			{ from: "shipment_actual", to: "fulfillment", label: "计算履约" }
		]
	};
}

function getPurchaseOrderFlowCardLane(row: any, order: any, lane: "top" | "bottom") {
	const nodes = getPurchaseOrderFlowCardNodes(row, order);
	return lane === "top" ? nodes.slice(0, 3) : nodes.slice(3, 6);
}

function getPurchaseOrderFlowEdgeLabel(row: any, order: any, from: string) {
	const edges = getPurchaseOrderFlowCardSummary(row, order)?.edges || [];
	const matched = edges.find((edge: any) => edge.from === from);
	return matched?.label || "";
}

function getPurchaseOrderFlowCardText(order: any) {
	const shipment = getPurchaseOrderShipmentSummary(order);
	const fulfillment = getPurchaseOrderFulfillmentSummary(order);
	return [
		`计划${order?.linked_plan_count || 0}`,
		`入库${order?.quantity_entry_sum || 0}`,
		`发货计划${shipment.shipment_plan_qty_sum || 0}`,
		`实发${shipment.actual_shipment_qty_sum || 0}`,
		`实际可发${fulfillment.actual_shippable_qty || 0}`
	].join(" / ");
}

function hasPurchaseFlowCard(row: any) {
	return Boolean(getSelectedPurchaseOrder(row) || getSelectedPlan(row));
}

function getPurchaseFlowCardTitle(row: any, order: any) {
	if (order?.order_sn) return order.order_sn;
	return getSelectedPlan(row)?.plan_sn || "-";
}

function getPurchaseFlowCardTagType(row: any, order: any) {
	if (order?.order_sn) {
		return getFulfillmentStatusTagType(
			getFulfillmentGroupStatus(getPurchaseOrderFulfillmentSummary(order))
		);
	}

	return getPlanStatusType(getSelectedPlan(row));
}

function getPurchaseFlowCardTagText(row: any, order: any) {
	if (order?.order_sn) {
		return getFulfillmentDisplayText(getPurchaseOrderFulfillmentSummary(order)) || "-";
	}

	return getPlanStatusText(getSelectedPlan(row)) || "已生成计划";
}

function getPurchaseFlowCardFooterText(row: any, order: any) {
	if (order?.order_sn) return getPurchaseOrderFlowCardText(order);

	const plan = getSelectedPlan(row);
	const local = getLocalRecord(plan);
	const lingxing = getLingxingPlan(plan);
	const planQty = Number(local.quantity_plan) || Number(lingxing.quantity_plan) || 0;
	const statusText = getPlanStatusText(plan);

	return [
		plan?.plan_sn || "",
		planQty ? `计划${planQty}` : "",
		statusText && statusText !== "-" ? statusText : ""
	]
		.filter(Boolean)
		.join(" / ");
}

function getPurchaseFlowBackendNodeMap() {
	const nodes = Array.isArray(purchaseOrderFlowDrawer.data?.nodes)
		? purchaseOrderFlowDrawer.data.nodes
		: [];
	return new Map(nodes.map((node: any) => [node.key, node]));
}

function getPurchaseFlowNodeDefaultLabel(key: string) {
	return (
		(
			{
				analysis: "补货分析",
				purchase_plan: "采购计划",
				purchase_order: "采购单",
				shipment_plan: "发货计划",
				shipment_actual: "实际发货",
				fulfillment: "履约状态"
			} as Record<string, string>
		)[key] || key
	);
}

function getPurchaseOrderFlowGraphNodes() {
	const nodeMap = getPurchaseFlowBackendNodeMap();
	return PURCHASE_FLOW_NODE_LAYOUT.map((layout) => {
		const node: any = nodeMap.get(layout.key) || {};
		const position = purchaseOrderFlowDrawer.nodePositions[layout.key];
		return {
			...layout,
			...node,
			x: position?.x ?? layout.x,
			y: position?.y ?? layout.y,
			label: node.label || getPurchaseFlowNodeDefaultLabel(layout.key),
			status: node.status || "empty",
			time: node.time || null,
			operator_name:
				node.operator_name ||
				(node.operator_missing
					? "缺少操作人"
					: layout.key === "fulfillment"
						? "系统计算"
						: "-"),
			operator_missing: Boolean(node.operator_missing)
		};
	});
}

function getPurchaseFlowGraphNodeByKey(key: string) {
	return getPurchaseOrderFlowGraphNodes().find((node: any) => node.key === key) || null;
}

function sumFlowRows(rows: any, field: string) {
	return (Array.isArray(rows) ? rows : []).reduce(
		(sum: number, row: any) => sum + (Number(row?.[field]) || 0),
		0
	);
}

function getFlowAnalysisCreator(row: any) {
	return (
		row?.purchase_plan_created_by_nickname ||
		row?.purchase_plan_created_by_username ||
		row?.plan_creator_name ||
		row?.staged_by_nickname ||
		row?.staged_by_username ||
		"-"
	);
}

function getFlowAnalysisTime(row: any) {
	return (
		row?.purchase_plan_created_time ||
		row?.plan_create_time ||
		row?.staged_time ||
		row?.create_time ||
		null
	);
}

function getFlowPlanCreator(analysis: any, plan: any) {
	return (
		analysis?.purchase_plan_created_by_nickname ||
		analysis?.purchase_plan_created_by_username ||
		plan?.creator_real_name ||
		analysis?.plan_creator_name ||
		plan?.cg_opt_username ||
		"-"
	);
}

function getFlowPlanTime(analysis: any, plan: any) {
	return (
		analysis?.purchase_plan_created_time ||
		analysis?.plan_create_time ||
		plan?.create_time_remote ||
		null
	);
}

function getPurchaseFlowEdgePoint(node: any, side: "left" | "right" | "top" | "bottom") {
	const centerX = node.x + node.width / 2;
	const centerY = node.y + node.height / 2;
	if (side === "left") return { x: node.x, y: centerY };
	if (side === "right") return { x: node.x + node.width, y: centerY };
	if (side === "top") return { x: centerX, y: node.y };
	return { x: centerX, y: node.y + node.height };
}

function getPurchaseOrderFlowGraphEdges() {
	const nodes = new Map(getPurchaseOrderFlowGraphNodes().map((node: any) => [node.key, node]));

	return PURCHASE_FLOW_EDGE_LAYOUT.map((edge) => {
		const from: any = nodes.get(edge.from);
		const to: any = nodes.get(edge.to);
		if (!from || !to) return null;

		let start = getPurchaseFlowEdgePoint(from, "right");
		let end = getPurchaseFlowEdgePoint(to, "left");
		let path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
		let labelX = (start.x + end.x) / 2;
		let labelY = (start.y + end.y) / 2 - 15;

		if (edge.key === "shipment-plan-actual") {
			start = getPurchaseFlowEdgePoint(from, "bottom");
			end = getPurchaseFlowEdgePoint(to, "top");
			const midY = (start.y + end.y) / 2;
			path = `M ${start.x} ${start.y} C ${start.x + 60} ${midY}, ${end.x + 60} ${midY}, ${end.x} ${end.y}`;
			labelX = start.x + 78;
			labelY = midY;
		}

		if (edge.key === "order-fulfillment") {
			start = getPurchaseFlowEdgePoint(from, "bottom");
			end = getPurchaseFlowEdgePoint(to, "top");
			path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
			labelX = start.x - 78;
			labelY = (start.y + end.y) / 2;
		}

		if (edge.key === "actual-fulfillment") {
			start = getPurchaseFlowEdgePoint(from, "left");
			end = getPurchaseFlowEdgePoint(to, "right");
			path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
			labelX = (start.x + end.x) / 2;
			labelY = start.y - 15;
		}

		return {
			...edge,
			path,
			labelX,
			labelY,
			labelWidth: Math.max(78, edge.label.length * 13 + 28),
			status: to.status || "empty"
		};
	}).filter(Boolean);
}

function getPurchaseFlowEdgeMarker(edge: any) {
	if (edge?.status === "done") return "url(#purchase-flow-arrow-success)";
	if (edge?.status === "warning") return "url(#purchase-flow-arrow-danger)";
	if (edge?.status === "empty") return "url(#purchase-flow-arrow-muted)";
	return "url(#purchase-flow-arrow-primary)";
}

function truncateFlowSvgText(value: any, max = 12) {
	const text = String(value || "");
	return text.length > max ? `${text.slice(0, max)}...` : text;
}

function getPurchaseFlowGraphTransform() {
	return `translate(${purchaseOrderFlowDrawer.translateX} ${purchaseOrderFlowDrawer.translateY}) scale(${purchaseOrderFlowDrawer.scale})`;
}

function resetPurchaseFlowGraphView() {
	purchaseOrderFlowDrawer.scale = 1;
	purchaseOrderFlowDrawer.translateX = 0;
	purchaseOrderFlowDrawer.translateY = 0;
	purchaseOrderFlowDrawer.nodePositions = {};
}

function zoomPurchaseFlowGraph(delta: number) {
	const next = Math.min(1.9, Math.max(0.62, purchaseOrderFlowDrawer.scale + delta));
	purchaseOrderFlowDrawer.scale = Number(next.toFixed(2));
}

function handlePurchaseFlowGraphWheel(event: WheelEvent) {
	zoomPurchaseFlowGraph(event.deltaY > 0 ? -0.08 : 0.08);
}

function startPurchaseFlowGraphPan(event: PointerEvent) {
	if (purchaseOrderFlowDrawer.nodeDragging) return;
	purchaseOrderFlowDrawer.dragging = true;
	purchaseOrderFlowDrawer.dragStartX = event.clientX;
	purchaseOrderFlowDrawer.dragStartY = event.clientY;
	purchaseOrderFlowDrawer.dragOriginX = purchaseOrderFlowDrawer.translateX;
	purchaseOrderFlowDrawer.dragOriginY = purchaseOrderFlowDrawer.translateY;
	(event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId);
}

function movePurchaseFlowGraphPan(event: PointerEvent) {
	if (purchaseOrderFlowDrawer.nodeDragging) {
		movePurchaseFlowNodeDrag(event);
		return;
	}
	if (!purchaseOrderFlowDrawer.dragging) return;
	const dx = (event.clientX - purchaseOrderFlowDrawer.dragStartX) / purchaseOrderFlowDrawer.scale;
	const dy = (event.clientY - purchaseOrderFlowDrawer.dragStartY) / purchaseOrderFlowDrawer.scale;
	purchaseOrderFlowDrawer.translateX = Math.round(purchaseOrderFlowDrawer.dragOriginX + dx);
	purchaseOrderFlowDrawer.translateY = Math.round(purchaseOrderFlowDrawer.dragOriginY + dy);
}

function endPurchaseFlowGraphPan(event?: PointerEvent) {
	if (event) {
		(event.currentTarget as HTMLElement)?.releasePointerCapture?.(event.pointerId);
	}
	purchaseOrderFlowDrawer.dragging = false;
	endPurchaseFlowNodeDrag(event);
}

function startPurchaseFlowNodeDrag(event: PointerEvent, node: any) {
	selectPurchaseFlowNode(node.key);
	purchaseOrderFlowDrawer.nodeDragging = true;
	purchaseOrderFlowDrawer.dragging = false;
	purchaseOrderFlowDrawer.nodeDragKey = node.key;
	purchaseOrderFlowDrawer.nodeDragStartX = event.clientX;
	purchaseOrderFlowDrawer.nodeDragStartY = event.clientY;
	purchaseOrderFlowDrawer.nodeDragOriginX = Number(node.x) || 0;
	purchaseOrderFlowDrawer.nodeDragOriginY = Number(node.y) || 0;
	(event.currentTarget as SVGElement)?.setPointerCapture?.(event.pointerId);
}

function movePurchaseFlowNodeDrag(event: PointerEvent) {
	if (!purchaseOrderFlowDrawer.nodeDragging) return;
	const key = purchaseOrderFlowDrawer.nodeDragKey;
	if (!key) return;

	const dx =
		(event.clientX - purchaseOrderFlowDrawer.nodeDragStartX) / purchaseOrderFlowDrawer.scale;
	const dy =
		(event.clientY - purchaseOrderFlowDrawer.nodeDragStartY) / purchaseOrderFlowDrawer.scale;
	purchaseOrderFlowDrawer.nodePositions = {
		...purchaseOrderFlowDrawer.nodePositions,
		[key]: {
			x: Math.round(purchaseOrderFlowDrawer.nodeDragOriginX + dx),
			y: Math.round(purchaseOrderFlowDrawer.nodeDragOriginY + dy)
		}
	};
}

function endPurchaseFlowNodeDrag(event?: PointerEvent) {
	if (event) {
		(event.currentTarget as SVGElement)?.releasePointerCapture?.(event.pointerId);
	}
	purchaseOrderFlowDrawer.nodeDragging = false;
	purchaseOrderFlowDrawer.nodeDragKey = "";
}

function selectPurchaseFlowNode(key: string) {
	purchaseOrderFlowDrawer.selectedNodeKey = key;
	if (key !== "analysis") {
		purchaseOrderFlowDrawer.formulaExpanded = false;
	}
}

function getSelectedFlowNode() {
	if (!purchaseOrderFlowDrawer.selectedNodeKey) return null;
	return getPurchaseFlowGraphNodeByKey(purchaseOrderFlowDrawer.selectedNodeKey);
}

function getSelectedFlowNodeTitle() {
	return getSelectedFlowNode()?.label || "全部流程事件";
}

function getSelectedFlowNodeStatusText() {
	const node = getSelectedFlowNode();
	if (!node) return "全部";
	return getFlowNodeStatusText(node);
}

function getSelectedFlowNodeTagType(): any {
	const node = getSelectedFlowNode();
	if (!node) return "info";
	if (node.status === "done") return "success";
	if (node.status === "warning") return "danger";
	if (node.status === "pending") return "primary";
	return "info";
}

function getSelectedFlowAnalysisSource() {
	if (purchaseOrderFlowDrawer.selectedNodeKey !== "analysis") return "";
	return purchaseOrderFlowDrawer.data?.details?.replenishment_analysis?.source || "";
}

function getSelectedFlowAnalysisSourceLabel() {
	if (purchaseOrderFlowDrawer.selectedNodeKey !== "analysis") return "";
	return purchaseOrderFlowDrawer.data?.details?.replenishment_analysis?.source_label || "";
}

function getSelectedFlowAnalysisSourceTagType(): any {
	const source = getSelectedFlowAnalysisSource();
	const analysis = purchaseOrderFlowDrawer.data?.details?.replenishment_analysis || {};
	if (analysis.auto_complete_status === "needs_attention") return "danger";
	if (analysis.auto_complete_warnings?.length) return "warning";
	if (source === "full_snapshot") return "success";
	if (source === "legacy_compatible") return "warning";
	return "info";
}

function getSelectedFlowNodeDetails() {
	const data = purchaseOrderFlowDrawer.data || {};
	const details = data.details || {};
	const summary = data.summary || {};
	const key = purchaseOrderFlowDrawer.selectedNodeKey;

	if (key === "analysis") {
		const analysis = details.replenishment_analysis || {};
		if (analysis.source && analysis.source !== "none") {
			const cards = Array.isArray(analysis.summary_cards) ? analysis.summary_cards : [];
			return [
				{
					key: "source",
					label: "数据来源",
					value: analysis.source_label || "-"
				},
				analysis.auto_complete_status_label
					? {
							key: "auto_complete_status",
							label: "自动补全状态",
							value: analysis.auto_complete_status_label
						}
					: null,
				analysis.warehouse_confirmation_required
					? {
							key: "warehouse_confirmation",
							label: "仓库状态",
							value: "仓库未匹配，可继续发货"
						}
					: null,
				analysis.auto_complete_warnings?.length
					? {
							key: "auto_complete_warnings",
							label: "校验提示",
							value: analysis.auto_complete_warnings.join("；")
						}
					: null,
				...cards.map((item: any, index: number) => ({
					key: item.key || `card_${index}`,
					label: item.label || "-",
					value: item.value ?? "-"
				})),
				{
					key: "summary",
					label: "摘要",
					value: analysis.summary_text || "-"
				},
				{
					key: "formula",
					label: "公式",
					value: getFlowFormulaSummaryText(analysis),
					tooltip_steps: getFlowFormulaSteps(analysis)
				},
				{
					key: "remark",
					label: "人工备注",
					value: analysis.manual_remark || "-"
				}
			].filter(Boolean);
		}

		const row = getFirstFlowDetailRow(details.analysis_records);
		if (!row) return [{ key: "empty", label: "补货分析", value: "暂无数据" }];
		return [
			{ key: "creator", label: "创建人", value: getFlowAnalysisCreator(row) },
			{ key: "qty", label: "建议采购", value: flowNumber(row.quantity_plan) },
			{ key: "algo", label: "使用算法", value: row.user_selected_algo_name || "-" },
			{ key: "coefficient", label: "人工系数", value: row.artificial_coefficient || "-" },
			{ key: "plan", label: "对应计划", value: row.plan_sn || "-" },
			{ key: "daily", label: "基础日均", value: flowNumber(row.base_daily_avg_sales) },
			{ key: "range", label: "销售区间", value: formatFlowDateRange(row) },
			{ key: "remark", label: "人工备注", value: row.manual_remark || "-" }
		];
	}

	if (key === "purchase_plan") {
		const row = getFirstFlowDetailRow(details.purchase_plans);
		const analysis = getFirstFlowDetailRow(details.analysis_records);
		if (!row && !analysis) return [{ key: "empty", label: "采购计划", value: "暂无数据" }];
		return [
			{ key: "creator", label: "创建人", value: getFlowPlanCreator(analysis, row) },
			{
				key: "qty",
				label: "计划数量",
				value: flowNumber(row?.quantity_plan || analysis?.quantity_plan)
			},
			{ key: "sn", label: "计划号", value: row?.plan_sn || analysis?.plan_sn || "-" },
			{ key: "status", label: "领星状态", value: row?.status_text || "-" },
			{ key: "buyer", label: "采购员", value: row?.purchaser_name || "-" },
			{ key: "supplier", label: "供应商", value: row?.supplier_name || "-" }
		];
	}

	if (key === "purchase_order") {
		const order = details.purchase_order || {};
		return [
			{
				key: "sn",
				label: "采购单号",
				value: order.order_sn || data.identity?.purchase_order_sn || "-"
			},
			{ key: "status", label: "领星状态", value: order.status_text || "-" },
			{ key: "real", label: "采购实际", value: summary.quantity_real_sum || 0 },
			{ key: "entry", label: "入库", value: summary.quantity_entry_sum || 0 },
			{
				key: "user",
				label: "操作人",
				value: order.opt_realname || order.last_realname || "-"
			}
		];
	}

	if (key === "shipment_plan") {
		const rows = details.shipment_plans || [];
		const qty = rows.reduce(
			(sum: number, row: any) => sum + (Number(row.shipment_plan_quantity) || 0),
			0
		);
		const actual = rows.reduce(
			(sum: number, row: any) => sum + (Number(row.actual_qty_sum) || 0),
			0
		);
		return rows.length
			? [
					{ key: "count", label: "计划批次", value: `${rows.length} 个` },
					{ key: "qty", label: "计划发货", value: flowNumber(qty) },
					{ key: "actual", label: "已实发", value: flowNumber(actual) },
					{
						key: "creator",
						label: "最近创建人",
						value:
							rows[0].local_created_by_nickname ||
							rows[0].local_created_by_username ||
							rows[0].shipment_plan_create_user ||
							"-"
					},
					{
						key: "time",
						label: "最近创建",
						value: formatShortDateTime(
							rows[0].local_created_time || rows[0].shipment_plan_create_time
						)
					}
				]
			: [{ key: "empty", label: "发货计划", value: "暂无数据" }];
	}

	if (key === "shipment_actual") {
		const rows = details.shipment_actuals || [];
		const qty = rows.reduce(
			(sum: number, row: any) => sum + (Number(row.shipment_list_quantity) || 0),
			0
		);
		return rows.length
			? [
					{ key: "count", label: "发货单", value: `${rows.length} 张` },
					{ key: "qty", label: "实际发货", value: flowNumber(qty) },
					{
						key: "status",
						label: "最新状态",
						value: rows[0].shipment_status_name || "-"
					},
					{
						key: "channel",
						label: "渠道",
						value: rows[0].logistics_channel_name || rows[0].method_name || "-"
					},
					{
						key: "time",
						label: "最近发货",
						value: formatShortDateTime(
							rows[0].shipment_time || rows[0].create_time_remote
						)
					}
				]
			: [{ key: "empty", label: "实际发货单", value: "暂无数据" }];
	}

	const adjustment = details.fulfillment_adjustment || {};
	return [
		{ key: "estimated", label: "预计可发", value: summary.estimated_shippable_qty || 0 },
		{
			key: "defective",
			label: "残次品",
			value: adjustment.defective_qty || 0,
			extra: getAdjustmentStatusText(adjustment.defective_status)
		},
		{
			key: "short",
			label: "商家少发",
			value: adjustment.short_shipped_qty || 0,
			extra: getAdjustmentStatusText(adjustment.short_shipped_status)
		},
		{ key: "actual", label: "实际可发", value: summary.actual_shippable_qty || 0 },
		{ key: "logs", label: "调整日志", value: `${(details.adjustment_logs || []).length} 条` }
	];
}

function getSelectedFlowNodePrimaryDetails() {
	return getSelectedFlowNodeDetails().slice(0, 4);
}

function getSelectedFlowNodeDetailRest() {
	return getSelectedFlowNodeDetails().slice(4);
}

function getFlowDetailTooltip(item: any) {
	const label = item?.label || "";
	const value = item?.value ?? "-";
	const extra = item?.extra ? `（${item.extra}）` : "";
	return label ? `${label}：${value}${extra}` : `${value}${extra}`;
}

function getFlowFormulaSteps(analysis: any) {
	if (Array.isArray(analysis?.formula_steps) && analysis.formula_steps.length) {
		return analysis.formula_steps.map((item: any) => String(item || "").trim()).filter(Boolean);
	}

	const text = String(analysis?.formula_text || "").trim();
	if (!text) return [];

	return text
		.split(/[；;]\s*/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function getFlowFormulaSummaryText(analysis: any) {
	const steps = getFlowFormulaSteps(analysis);
	const formulaText = String(analysis?.formula_text || "").trim();
	if (!formulaText) return "-";

	const actualQtyMatches = [...formulaText.matchAll(/实际采购量\s*[（(](\d+(?:\.\d+)?)[）)]/g)];
	const finalQty =
		actualQtyMatches[actualQtyMatches.length - 1]?.[1] ||
		formulaText.match(/最终(?:生成数量|生成|)\D*(\d+(?:\.\d+)?)/)?.[1] ||
		"";
	const stepText = steps.length ? `${steps.length}步` : "明细";

	return finalQty ? `扣减/装箱，最终${finalQty}（${stepText}）` : `扣减/装箱明细（${stepText}）`;
}

function getSelectedFlowReplenishmentAnalysis() {
	if (purchaseOrderFlowDrawer.selectedNodeKey !== "analysis") return {};
	return purchaseOrderFlowDrawer.data?.details?.replenishment_analysis || {};
}

function getSelectedFlowFormulaSteps() {
	return getFlowFormulaSteps(getSelectedFlowReplenishmentAnalysis());
}

function getSelectedFlowDemandBasisRows() {
	const analysis = getSelectedFlowReplenishmentAnalysis() as any;
	const rows = Array.isArray(analysis?.demand_basis_rows) ? analysis.demand_basis_rows : [];

	return rows.filter((item: any) => item && item.value !== undefined && item.value !== null);
}

function getSelectedFlowFormulaSummaryText() {
	const analysis = getSelectedFlowReplenishmentAnalysis();
	const summary = getFlowFormulaSummaryText(analysis);
	const coefficient = getSelectedFlowFormulaCoefficientText();
	const summaryText = summary === "-" ? "按当时快照口径逐步计算" : summary;

	return `${summaryText}，${coefficient}`;
}

function getSelectedFlowFormulaStepRows() {
	return getSelectedFlowFormulaSteps().map((step: string, index: number) => {
		const text = String(step || "").trim();
		const eqIndex = text.lastIndexOf("=");
		const hasResult = eqIndex > 0 && eqIndex < text.length - 1;

		return {
			key: `formula_step_${index}`,
			index: index + 1,
			expression: hasResult ? text.slice(0, eqIndex).trim() : text,
			result: hasResult ? text.slice(eqIndex + 1).trim() : ""
		};
	});
}

function getSelectedFlowFormulaCoefficientValue() {
	const analysis = getSelectedFlowReplenishmentAnalysis() as any;
	const formulaText = String(analysis?.formula_text || "");
	const formulaMatch =
		formulaText.match(/人工系数\s*[（(]\s*(\d+(?:\.\d+)?)/) ||
		formulaText.match(/人工系数\s*(\d+(?:\.\d+)?)/);
	if (formulaMatch?.[1]) return formulaMatch[1];

	const cards = Array.isArray(analysis?.summary_cards) ? analysis.summary_cards : [];
	const card = cards.find(
		(item: any) => item?.key === "manual_coefficient" || item?.label === "人工系数"
	);
	return card?.value ?? "";
}

function getSelectedFlowSummaryCardValue(key: string, label: string) {
	const analysis = getSelectedFlowReplenishmentAnalysis() as any;
	const cards = Array.isArray(analysis?.summary_cards) ? analysis.summary_cards : [];
	const card = cards.find((item: any) => item?.key === key || item?.label === label);
	return card?.value ?? "";
}

function getSelectedFlowFormulaVolatilityValue() {
	const analysis = getSelectedFlowReplenishmentAnalysis() as any;
	const cardValue = getSelectedFlowSummaryCardValue("volatility_coefficient", "波动系数");
	if (cardValue !== "" && cardValue !== undefined && cardValue !== null) return cardValue;
	if (
		analysis?.volatility_coefficient !== "" &&
		analysis?.volatility_coefficient !== undefined &&
		analysis?.volatility_coefficient !== null
	) {
		return analysis.volatility_coefficient;
	}
	return "";
}

function getSelectedFlowFormulaVolatilityText() {
	const value = getSelectedFlowFormulaVolatilityValue();
	if (value === "" || value === undefined || value === null) return "波动系数 -";

	const num = Number(value);
	const valueText = Number.isFinite(num) ? formatFlowCoefficientText(num) : String(value);
	const statusText = Number.isFinite(num) && Math.abs(num - 1) > 0.0001 ? "已参与" : "默认";

	return `波动系数 ${valueText}（${statusText}）`;
}

function getSelectedFlowFormulaVolatilityType(): any {
	const num = Number(getSelectedFlowFormulaVolatilityValue());
	return Number.isFinite(num) && Math.abs(num - 1) > 0.0001 ? "warning" : "info";
}

function getSelectedFlowFormulaCoefficientText() {
	const value = getSelectedFlowFormulaCoefficientValue();
	if (value === "" || value === undefined || value === null) return "人工系数 -";

	const num = Number(value);
	const valueText = Number.isFinite(num) ? flowNumber(num) : String(value);
	const statusText = Number.isFinite(num) && Math.abs(num - 1) > 0.0001 ? "人工调整" : "未调整";

	return `人工系数 ${valueText}（${statusText}）`;
}

function getSelectedFlowFormulaCoefficientType(): any {
	const num = Number(getSelectedFlowFormulaCoefficientValue());
	return Number.isFinite(num) && Math.abs(num - 1) > 0.0001 ? "warning" : "info";
}

function formatFlowCoefficientText(value: any) {
	if (value === undefined || value === null || value === "") return "-";
	const num = Number(value);
	if (!Number.isFinite(num)) return String(value);
	return num.toFixed(2);
}

function normalizeFlowTooltipLines(value: any) {
	if (Array.isArray(value)) {
		return value.map((item) => String(item || "").trim()).filter(Boolean);
	}

	if (typeof value === "string") {
		return value
			.split(/\r?\n/)
			.map((item) => item.trim())
			.filter(Boolean);
	}

	return [];
}

function hasRecordedFlowValue(value: any) {
	return value !== undefined && value !== null && value !== "";
}

function getSelectedFlowCoefficientRows() {
	const analysis = getSelectedFlowReplenishmentAnalysis() as any;
	const rows = Array.isArray(analysis?.coefficient_rows) ? analysis.coefficient_rows : [];

	return rows
		.map((row: any, index: number) => {
			const rawValue =
				row.raw_coefficient_text ??
				row.rawCoefficientText ??
				row.rawCoefficient ??
				row.raw_coefficient;
			const volatilityValue =
				row.volatility_coefficient_text ??
				row.volatilityCoefficientText ??
				row.volatilityCoefficient ??
				row.volatility_coefficient;
			const adjustedValue =
				row.adjusted_coefficient_text ??
				row.adjustedCoefficientText ??
				row.combinedCoeffText ??
				row.coeffText ??
				row.adjustedCoefficient ??
				row.adjusted_coefficient ??
				row.value;
			const rawCoefficient = formatFlowCoefficientText(rawValue);
			const hasVolatility = hasRecordedFlowValue(volatilityValue);
			const volatilityCoefficient = hasVolatility
				? formatFlowCoefficientText(volatilityValue)
				: "未记录";
			const adjustedCoefficient = formatFlowCoefficientText(adjustedValue);
			const subtotal =
				row.subtotal_text ?? row.subtotalText ?? row.subtotalValue ?? row.subtotal ?? "-";
			const snapshotFormula =
				row.formula_text || row.formulaText || row.coefficient_chain_text || row.extra;
			let formula = snapshotFormula
				? String(snapshotFormula)
				: hasVolatility
					? `原始 ${rawCoefficient} → 波动 ${volatilityCoefficient} → 最终 ${adjustedCoefficient}`
					: `原始 ${rawCoefficient} → 最终 ${adjustedCoefficient}（旧快照未记录波动系数）`;
			if (!hasVolatility && !formula.includes("旧快照未记录")) {
				formula = `${formula}（旧快照未记录波动系数）`;
			}
			const tooltipLines = normalizeFlowTooltipLines(row.tooltip_lines || row.tooltipLines);
			if (!hasVolatility) {
				tooltipLines.push("旧快照未记录波动系数，当前仅按当时保存的最终系数复盘。");
			}

			return {
				key: row.key || row.month || row.label || `coefficient_${index}`,
				label: row.label || row.month || `系数 ${index + 1}`,
				rawCoefficient,
				volatilityCoefficient,
				adjustedCoefficient,
				hasCoefficientValue:
					rawCoefficient !== "-" || hasVolatility || adjustedCoefficient !== "-",
				subtotal:
					subtotal === undefined || subtotal === null || subtotal === ""
						? "-"
						: String(subtotal),
				formula,
				tooltipLines
			};
		})
		.filter((row: any) => row.hasCoefficientValue);
}

function toggleSelectedFlowFormula() {
	purchaseOrderFlowDrawer.formulaExpanded = !purchaseOrderFlowDrawer.formulaExpanded;
}

function getSelectedFlowNodeDescription() {
	const key = purchaseOrderFlowDrawer.selectedNodeKey;
	const descriptions: Record<string, string> = {
		analysis:
			"这里看最初补货测算：人工备注、人工系数、算法，以及快递/空运/卡车/铁路/海运分别计划多少。",
		purchase_plan: "这里看本系统生成并同步到领星的采购计划，重点是计划量、创建人和采购信息。",
		purchase_order: "这里看领星采购单结果，重点是采购实际、入库数量和采购单状态。",
		shipment_plan: "这里看我们系统绑定到当前采购单的发货计划，按采购计划号和采购单号过滤。",
		shipment_actual: "这里看通过 isp_id 同步回来的实际发货单，重点是实发数量、渠道和发货状态。",
		fulfillment: "这里看最终履约口径：入库减实际发货，再扣残次品和商家少发，得到实际可发。"
	};
	return descriptions[key] || "点击流程节点后，这里展示该节点的关键业务信息。";
}

function getFirstFlowDetailRow(rows: any) {
	return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function flowNumber(value: any) {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
}

function formatFlowDateRange(row: any) {
	const start = row?.start_date || row?.startDate;
	const end = row?.end_date || row?.endDate;
	const days = Number(row?.total_days || row?.days) || 0;
	if (!start && !end) return "-";
	return `${start || "-"} 至 ${end || "-"}${days ? ` (${days}天)` : ""}`;
}

function getSelectedFlowNodeBreakdown() {
	const details = purchaseOrderFlowDrawer.data?.details || {};
	const key = purchaseOrderFlowDrawer.selectedNodeKey;

	if (key === "analysis") {
		const analysis = details.replenishment_analysis || {};
		const row = getFirstFlowDetailRow(details.analysis_records);
		const items = Array.isArray(analysis.shipping_segments)
			? analysis.shipping_segments
			: Array.isArray(row?.shipping_breakdown_summary)
				? row.shipping_breakdown_summary
				: [];
		return items.map((item: any, index: number) => ({
			key: `${item.key || item.shipping_method || "shipping"}-${index}`,
			label: item.label || item.shipping_label || item.shipping_method || "发运",
			value: `${flowNumber(item.quantity)} 件`,
			extra: formatFlowAnalysisSegmentExtra(item)
		}));
	}

	if (key === "shipment_plan") {
		return (details.shipment_plans || []).slice(0, 6).map((row: any) => ({
			key: row.id || row.isp_id || row.seq,
			label: row.seq || row.shipment_plan_sn || "发货计划",
			value: `${flowNumber(row.shipment_plan_quantity)} 件`,
			extra: row.purchase_plan_sn || "-"
		}));
	}

	if (key === "fulfillment") {
		const summary = purchaseOrderFlowDrawer.data?.summary || {};
		return [
			{
				key: "estimated",
				label: "预计可发",
				value: `${flowNumber(summary.quantity_entry_sum)} - ${flowNumber(summary.actual_shipment_qty_sum)}`,
				extra: `= ${flowNumber(summary.estimated_shippable_qty)}`
			},
			{
				key: "actual",
				label: "实际可发",
				value: `${flowNumber(summary.estimated_shippable_qty)} - ${flowNumber(summary.defective_qty)} - ${flowNumber(summary.short_shipped_qty)}`,
				extra: `= ${flowNumber(summary.actual_shippable_qty)}`
			}
		];
	}

	return [];
}

function formatFlowAnalysisSegmentExtra(item: any) {
	if (item.has_segment === false) {
		return item.status_text || "未参与本次测算";
	}

	const coefficientText = formatFlowAnalysisSegmentCoefficientText(item);
	const parts = [
		item.period_label || item.extra || "",
		item.days ? `${flowNumber(item.days)}天` : "",
		item.system_quantity ? `系统${flowNumber(item.system_quantity)}` : "",
		item.daily_need ? `日耗${flowNumber(item.daily_need)}` : "",
		coefficientText,
		item.alpha !== undefined && item.alpha !== null ? `α ${item.alpha}` : "",
		item.status_text || (item.shortage_label ? `缺口 ${item.shortage_label}` : "")
	].filter(Boolean);

	if (parts.length) return parts.join(" / ");

	if (item.segment_count) return `${flowNumber(item.days)} 天 / ${item.segment_count} 段`;

	return item.status_text || "未参与本次测算";
}

function formatFlowAnalysisSegmentCoefficientText(item: any) {
	const raw = item.raw_coefficient ?? item.rawCoefficient;
	const volatility = item.volatility_coefficient ?? item.volatilityCoefficient;
	const adjusted = item.adjusted_coefficient ?? item.adjustedCoefficient ?? item.coefficient;

	if (raw !== undefined && raw !== null && volatility !== undefined && volatility !== null) {
		return `系数 ${formatFlowCoefficientText(raw)}→${formatFlowCoefficientText(volatility)}→${formatFlowCoefficientText(adjusted)}`;
	}

	return item.coefficient ? `系数${flowNumber(item.coefficient)}` : "";
}

function getSelectedFlowNodeRecords() {
	const details = purchaseOrderFlowDrawer.data?.details || {};
	const key = purchaseOrderFlowDrawer.selectedNodeKey;

	if (key === "analysis") {
		const analysis = details.replenishment_analysis || {};
		if (analysis.source === "full_snapshot") {
			const inventoryRows = Array.isArray(analysis.inventory_rows)
				? analysis.inventory_rows
				: [];
			const coefficientRows = Array.isArray(analysis.coefficient_rows)
				? analysis.coefficient_rows
				: [];
			const deductionRows = Array.isArray(analysis.deduction_rows)
				? analysis.deduction_rows
				: [];
			return [...inventoryRows, ...deductionRows, ...coefficientRows].map(
				(row: any, index: number) => ({
					key: row.key || `snapshot_${index}`,
					title: row.label || "快照字段",
					meta: analysis.source_label || "完整快照",
					value: row.extra ? `${row.value ?? "-"} / ${row.extra}` : (row.value ?? "-")
				})
			);
		}

		return (details.analysis_records || []).map((row: any) => ({
			key: row.id,
			title: row.plan_sn || `测算记录 ${row.id}`,
			meta: `${formatShortDateTime(getFlowAnalysisTime(row))} / ${getFlowAnalysisCreator(row)}`,
			value: row.summary || row.formula || `建议 ${flowNumber(row.quantity_plan)}`
		}));
	}

	if (key === "purchase_plan") {
		const analysisRows = details.analysis_records || [];
		const planRows = details.purchase_plans?.length ? details.purchase_plans : analysisRows;
		return planRows.map((row: any) => {
			const analysis =
				analysisRows.find((item: any) => item.plan_sn && item.plan_sn === row.plan_sn) ||
				row;
			return {
				key: row.plan_sn || row.id,
				title: row.plan_sn || "采购计划",
				meta: `${row.status_text || "-"} / ${formatShortDateTime(getFlowPlanTime(analysis, row))}`,
				value: `计划 ${flowNumber(row.quantity_plan || analysis.quantity_plan)} / ${getFlowPlanCreator(analysis, row)}`
			};
		});
	}

	if (key === "shipment_plan") {
		return (details.shipment_plans || []).map((row: any) => ({
			key: row.id || row.seq,
			title: row.seq || row.shipment_plan_sn || "发货计划",
			meta: `${row.purchase_plan_sn || "-"} / ${formatShortDateTime(row.local_created_time || row.shipment_plan_create_time)}`,
			value: `计划 ${flowNumber(row.shipment_plan_quantity)} / 实发 ${flowNumber(row.actual_qty_sum)}`
		}));
	}

	if (key === "shipment_actual") {
		return (details.shipment_actuals || []).map((row: any) => ({
			key: row.id || row.shipment_sn,
			title: row.shipment_sn || "实际发货单",
			meta: `${row.shipment_status_name || "-"} / ${formatShortDateTime(row.shipment_time || row.create_time_remote)}`,
			value: `实发 ${flowNumber(row.shipment_list_quantity)} / ${row.logistics_channel_name || row.method_name || "-"}`
		}));
	}

	if (key === "fulfillment") {
		return (details.adjustment_logs || []).map((row: any) => ({
			key: row.id,
			title: getFulfillmentLogActionText(row.action_type, row.field_group),
			meta: `${formatShortDateTime(row.createTime)} / ${row.operator_nickname || row.operator_username || "-"}`,
			value: row.remark || "-"
		}));
	}

	return [];
}

function getPurchaseFlowVisibleEvents() {
	const events = Array.isArray(purchaseOrderFlowDrawer.data?.events)
		? purchaseOrderFlowDrawer.data.events
		: [];
	const selectedKey = purchaseOrderFlowDrawer.selectedNodeKey;
	if (!selectedKey) return events;

	const typeMap: Record<string, string[]> = {
		analysis: ["analysis"],
		purchase_plan: ["purchase_plan_create", "purchase_plan_sync"],
		purchase_order: ["purchase_order"],
		shipment_plan: ["shipment_plan"],
		shipment_actual: ["shipment_actual"],
		fulfillment: ["adjustment"]
	};
	const types = typeMap[selectedKey] || [];
	return events.filter((event: any) => types.includes(event.type));
}

function buildPurchaseOrderFlowIdentity(row: any, order: any) {
	const product = getProduct(row);
	const plan = getSelectedPlan(row);
	const local = getLocalRecord(plan);
	return {
		store_id: product.store_id,
		marketplace: product.marketplace,
		asin: product.asin,
		msku: product.msku || "",
		product_code: product.product_code || "",
		plan_sn: plan?.plan_sn || "",
		analysis_record_id: local.analysis_record_id || undefined,
		purchase_order_sn: order?.order_sn || ""
	};
}

async function openPurchaseOrderFlow(row: any, order: any) {
	if (!row || !getSelectedPlan(row)?.plan_sn) return;
	purchaseOrderFlowDrawer.row = row;
	purchaseOrderFlowDrawer.order = order;
	purchaseOrderFlowDrawer.selectedNodeKey = "analysis";
	purchaseOrderFlowDrawer.eventCollapseNames = [];
	purchaseOrderFlowDrawer.formulaExpanded = false;
	resetPurchaseFlowGraphView();
	purchaseOrderFlowDrawer.visible = true;
	await loadPurchaseOrderFlow();
}

async function loadPurchaseOrderFlow() {
	if (!purchaseOrderFlowDrawer.row || !getSelectedPlan(purchaseOrderFlowDrawer.row)?.plan_sn) {
		return;
	}
	purchaseOrderFlowDrawer.loading = true;
	try {
		const res = await service.app.bsr_purchase_plan_product_view.purchaseOrderFlow(
			buildPurchaseOrderFlowIdentity(
				purchaseOrderFlowDrawer.row,
				purchaseOrderFlowDrawer.order
			)
		);
		purchaseOrderFlowDrawer.data = res || null;
		purchaseOrderFlowDrawer.formulaExpanded = false;
	} catch (e: any) {
		purchaseOrderFlowDrawer.data = null;
		ElMessage.error(e?.message || "加载采购单流程失败");
	} finally {
		purchaseOrderFlowDrawer.loading = false;
	}
}

function getPurchaseOrderFlowSummaryMetrics() {
	const summary = purchaseOrderFlowDrawer.data?.summary || {};
	const details = purchaseOrderFlowDrawer.data?.details || {};
	const analysis = details.replenishment_analysis || {};
	return [
		{
			label: "补货分析",
			value: analysis.source_label || "-",
			className: ""
		},
		{
			label: "当前计划",
			value: summary.plan_sn || purchaseOrderFlowDrawer.data?.identity?.plan_sn || "-",
			className: ""
		},
		{
			label: "采购单",
			value: summary.has_purchase_order ? summary.purchase_order_status_text || "-" : "暂无",
			className: ""
		},
		{
			label: "发货计划",
			value: summary.shipment_plan_qty_sum || 0,
			className: ""
		},
		{
			label: "实际发货",
			value: summary.actual_shipment_qty_sum || 0,
			className: ""
		},
		{
			label: "实际可发",
			value: summary.has_purchase_order ? summary.actual_shippable_qty || 0 : "-",
			className: getDiffClass(summary.actual_shippable_qty)
		}
	];
}

function getFlowNodeStatusText(node: any) {
	const statusMap: Record<string, string> = {
		done: "已完成",
		pending: "进行中",
		warning: "需处理",
		empty: "暂无"
	};
	const base = statusMap[node?.status] || "-";
	if (node?.key === "fulfillment") {
		return `实际可发 ${Number(node?.count) || 0}`;
	}
	return node?.count ? `${base} ${node.count}` : base;
}

function getFlowNodeSvgContext() {
	const data = purchaseOrderFlowDrawer.data || {};
	return {
		details: data.details || {},
		summary: data.summary || {}
	};
}

function getFlowNodeSvgLine1(node: any) {
	const { details, summary } = getFlowNodeSvgContext();
	const analysisRows = details.analysis_records || [];
	const planRows = details.purchase_plans || [];
	const shipmentRows = details.shipment_plans || [];
	const actualRows = details.shipment_actuals || [];
	const firstAnalysis = getFirstFlowDetailRow(analysisRows);

	if (node?.key === "analysis") {
		if (!firstAnalysis) return getFlowNodeStatusText(node);
		const qty = sumFlowRows(analysisRows, "quantity_plan") || firstAnalysis.quantity_plan || 0;
		const algo = firstAnalysis.user_selected_algo_name || "补货测算";
		return `${algo} / 建议${flowNumber(qty)}`;
	}
	if (node?.key === "purchase_plan") {
		const qty =
			sumFlowRows(planRows, "quantity_plan") ||
			sumFlowRows(analysisRows, "quantity_plan") ||
			0;
		const count = planRows.length || analysisRows.length || 0;
		return qty ? `计划${flowNumber(qty)} / ${count}条` : getFlowNodeStatusText(node);
	}
	if (node?.key === "purchase_order") {
		return `采购${summary.quantity_real_sum || 0} / 入库${summary.quantity_entry_sum || 0}`;
	}
	if (node?.key === "shipment_plan") {
		return shipmentRows.length
			? `计划发货${summary.shipment_plan_qty_sum || 0}`
			: "未安排发货计划";
	}
	if (node?.key === "shipment_actual") {
		return actualRows.length
			? `实际发货${summary.actual_shipment_qty_sum || 0}`
			: "暂无实际发货";
	}
	if (node?.key === "fulfillment") {
		return `实际可发${summary.actual_shippable_qty || 0}`;
	}
	return getFlowNodeStatusText(node);
}

function getFlowNodeSvgLine2(node: any) {
	return `操作人 ${node?.operator_name || (node?.operator_missing ? "缺少操作人" : "-")}`;
}

function getFlowNodeSvgLine3(node: any) {
	const { details, summary } = getFlowNodeSvgContext();
	const analysisRows = details.analysis_records || [];
	const planRows = details.purchase_plans || [];
	const shipmentRows = details.shipment_plans || [];
	const actualRows = details.shipment_actuals || [];
	const adjustment = details.fulfillment_adjustment || {};
	const firstAnalysis = getFirstFlowDetailRow(analysisRows);
	const firstPlan = getFirstFlowDetailRow(planRows);
	const firstShipmentPlan = getFirstFlowDetailRow(shipmentRows);
	const firstActual = getFirstFlowDetailRow(actualRows);

	if (node?.key === "analysis") {
		if (!firstAnalysis) return "-";
		const coefficient = firstAnalysis.artificial_coefficient || "-";
		const time = formatShortDateTime(getFlowAnalysisTime(firstAnalysis));
		return `系数${coefficient} / ${time}`;
	}
	if (node?.key === "purchase_plan") {
		const time = formatShortDateTime(getFlowPlanTime(firstAnalysis, firstPlan));
		const planSn = firstPlan?.plan_sn || firstAnalysis?.plan_sn || "";
		return planSn ? `${planSn} / ${time || "-"}` : time || "-";
	}
	if (node?.key === "purchase_order") {
		const linkedItemCount = summary.linked_item_count || summary.item_count || node?.count || 0;
		const time = formatShortDateTime(node?.time);
		return `${summary.purchase_order_status_text || getFlowNodeStatusText(node)} / 明细${linkedItemCount}条 / ${time || "-"}`;
	}
	if (node?.key === "shipment_plan") {
		const time = formatShortDateTime(
			firstShipmentPlan?.local_created_time || firstShipmentPlan?.shipment_plan_create_time
		);
		return shipmentRows.length ? `${shipmentRows.length}批 / 最近${time || "-"}` : "-";
	}
	if (node?.key === "shipment_actual") {
		const time = formatShortDateTime(
			firstActual?.shipment_time || firstActual?.create_time_remote
		);
		return actualRows.length
			? `${actualRows.length}单 / ${firstActual?.shipment_status_name || "-"} / ${time || "-"}`
			: "-";
	}
	if (node?.key === "fulfillment") {
		if (summary.fulfillment_status === "manual_completed") {
			return "人工完成 / 实际可发0";
		}
		const abnormal =
			(Number(adjustment.defective_qty) || 0) + (Number(adjustment.short_shipped_qty) || 0);
		return `预计${summary.estimated_shippable_qty || 0} / 异常${abnormal}`;
	}
	return formatShortDateTime(node?.time) || "-";
}

function getFlowEventTagType(event: any): any {
	if (event?.source === "本系统") return "success";
	if (event?.type === "adjustment") return "warning";
	return "info";
}

function buildFulfillmentIdentity(row = fulfillmentDialog.row, order = fulfillmentDialog.order) {
	const product = getProduct(row);
	return {
		store_id: product.store_id,
		marketplace: product.marketplace,
		asin: product.asin,
		msku: product.msku || "",
		product_code: product.product_code || "",
		purchase_order_sn: order?.order_sn || "",
		primary_plan_sn: getPrimaryPlanForPurchaseOrder(row, order)?.plan_sn || "",
		linked_plan_sns: Array.isArray(order?.linked_plan_sns)
			? order.linked_plan_sns.filter(Boolean)
			: []
	};
}

function openFulfillmentDialog(row: any, order: any) {
	if (!row || !order) return;
	const adjustment = getPurchaseOrderFulfillmentAdjustment(order);
	fulfillmentDialog.row = row;
	fulfillmentDialog.order = order;
	fulfillmentDialog.form.defective_qty = Number(adjustment.defective_qty) || 0;
	fulfillmentDialog.form.defective_status = Number(adjustment.defective_status) || 0;
	fulfillmentDialog.form.defective_remark = adjustment.defective_remark || "";
	fulfillmentDialog.form.defective_process_remark = adjustment.defective_process_remark || "";
	fulfillmentDialog.form.short_shipped_qty = Number(adjustment.short_shipped_qty) || 0;
	fulfillmentDialog.form.short_shipped_status = Number(adjustment.short_shipped_status) || 0;
	fulfillmentDialog.form.short_shipped_remark = adjustment.short_shipped_remark || "";
	fulfillmentDialog.form.short_shipped_process_remark =
		adjustment.short_shipped_process_remark || "";
	fulfillmentDialog.form.document_status = Number(adjustment.document_status) || 0;
	fulfillmentDialog.form.assigned_to_username = adjustment.assigned_to_username || "";
	fulfillmentDialog.form.assigned_to_nickname = adjustment.assigned_to_nickname || "";
	fulfillmentDialog.form.assigned_time = adjustment.assigned_time || null;
	fulfillmentDialog.form.confirmed_by_username = adjustment.confirmed_by_username || "";
	fulfillmentDialog.form.confirmed_by_nickname = adjustment.confirmed_by_nickname || "";
	fulfillmentDialog.form.confirmed_time = adjustment.confirmed_time || null;
	fulfillmentDialog.form.confirm_remark = adjustment.confirm_remark || "";
	fulfillmentDialog.form.manual_completed = Number(adjustment.manual_completed) || 0;
	fulfillmentDialog.form.manual_completed_remark = adjustment.manual_completed_remark || "";
	fulfillmentDialog.form.manual_completed_by_username =
		adjustment.manual_completed_by_username || "";
	fulfillmentDialog.form.manual_completed_time = adjustment.manual_completed_time || null;
	fulfillmentDialog.logs = [];
	fulfillmentDialog.visible = true;
	loadFulfillmentAdjustmentLogs();
}

async function loadFulfillmentAdjustmentLogs() {
	if (!fulfillmentDialog.order) return;
	fulfillmentDialog.logsLoading = true;
	try {
		const res = await service.app.bsr_purchase_plan_product_view.fulfillmentAdjustmentLogs(
			buildFulfillmentIdentity()
		);
		fulfillmentDialog.logs = Array.isArray(res) ? res : [];
	} catch (e) {
		fulfillmentDialog.logs = [];
	} finally {
		fulfillmentDialog.logsLoading = false;
	}
}

async function saveFulfillmentAdjustment() {
	if (isFulfillmentDialogReadonly.value) {
		ElMessage.warning(getFulfillmentDocumentReadonlyTip());
		return;
	}
	if (fulfillmentDialogError.value) {
		ElMessage.warning(fulfillmentDialogError.value);
		return;
	}
	const refreshContext = buildPurchaseOrderRefreshContext();
	fulfillmentDialog.loading = true;
	try {
		await service.app.bsr_purchase_plan_product_view.saveFulfillmentAdjustment({
			...buildFulfillmentIdentity(),
			defective_qty: fulfillmentDialog.form.defective_qty,
			defective_remark: fulfillmentDialog.form.defective_remark,
			short_shipped_qty: fulfillmentDialog.form.short_shipped_qty,
			short_shipped_remark: fulfillmentDialog.form.short_shipped_remark
		});
		ElMessage.success("履约调整已保存");
		fulfillmentDialog.visible = false;
		await loadData({ preservePurchaseOrder: refreshContext });
	} catch (e: any) {
		ElMessage.error(e?.message || "保存履约调整失败");
	} finally {
		fulfillmentDialog.loading = false;
	}
}

function getFulfillmentDocumentReadonlyTip() {
	return "该履约异常单据已确认锁定，不能在原采购页面修改";
}

function canProcessFulfillmentField(fieldGroup: "defective" | "short_shipped") {
	if (isFulfillmentDialogReadonly.value) return false;
	const qty =
		fieldGroup === "defective"
			? Number(fulfillmentDialog.form.defective_qty) || 0
			: Number(fulfillmentDialog.form.short_shipped_qty) || 0;
	const remark =
		fieldGroup === "defective"
			? fulfillmentDialog.form.defective_remark
			: fulfillmentDialog.form.short_shipped_remark;
	return qty > 0 && Boolean(String(remark || "").trim());
}

function getProcessFulfillmentDisabledTip(fieldGroup: "defective" | "short_shipped") {
	if (isFulfillmentDialogReadonly.value) return getFulfillmentDocumentReadonlyTip();
	const label = fieldGroup === "defective" ? "残次品" : "商家少发";
	const qty =
		fieldGroup === "defective"
			? Number(fulfillmentDialog.form.defective_qty) || 0
			: Number(fulfillmentDialog.form.short_shipped_qty) || 0;
	const remark =
		fieldGroup === "defective"
			? fulfillmentDialog.form.defective_remark
			: fulfillmentDialog.form.short_shipped_remark;
	const hasRemark = Boolean(String(remark || "").trim());

	if (qty <= 0 && !hasRemark) return `请先填写${label}数量和处理备注`;
	if (qty <= 0) return `请先填写${label}数量`;
	return `请填写${label}处理备注`;
}

async function processFulfillmentAdjustment(fieldGroup: "defective" | "short_shipped") {
	if (isFulfillmentDialogReadonly.value) {
		ElMessage.warning(getFulfillmentDocumentReadonlyTip());
		return;
	}
	if (!canProcessFulfillmentField(fieldGroup)) {
		ElMessage.warning(getProcessFulfillmentDisabledTip(fieldGroup));
		return;
	}
	const refreshContext = buildPurchaseOrderRefreshContext();
	fulfillmentDialog.processing = true;
	try {
		await service.app.bsr_purchase_plan_product_view.processFulfillmentAdjustment({
			...buildFulfillmentIdentity(),
			field_group: fieldGroup,
			defective_qty: fulfillmentDialog.form.defective_qty,
			defective_remark: fulfillmentDialog.form.defective_remark,
			short_shipped_qty: fulfillmentDialog.form.short_shipped_qty,
			short_shipped_remark: fulfillmentDialog.form.short_shipped_remark,
			remark:
				fieldGroup === "defective"
					? fulfillmentDialog.form.defective_remark
					: fulfillmentDialog.form.short_shipped_remark
		});
		ElMessage.success("异常已标记处理");
		fulfillmentDialog.visible = false;
		await loadData({ preservePurchaseOrder: refreshContext });
	} catch (e: any) {
		ElMessage.error(e?.message || "处理履约异常失败");
	} finally {
		fulfillmentDialog.processing = false;
	}
}

async function manualCompleteFulfillment() {
	if (isFulfillmentDialogReadonly.value) {
		ElMessage.warning(getFulfillmentDocumentReadonlyTip());
		return;
	}
	if (!canManualCompleteFulfillment.value) {
		ElMessage.warning("请先填写人工完成原因");
		return;
	}
	try {
		await ElMessageBox.confirm(
			"标记后该采购单产品实际可发将变为 0，并且不会进入批量发货；后续可以恢复可发。",
			"标记人工完成确认",
			{
				type: "warning",
				confirmButtonText: "确认标记",
				cancelButtonText: "取消"
			}
		);
	} catch (e) {
		return;
	}

	const refreshContext = buildPurchaseOrderRefreshContext();
	fulfillmentDialog.processing = true;
	try {
		await service.app.bsr_purchase_plan_product_view.manualCompleteFulfillment({
			...buildFulfillmentIdentity(),
			remark: fulfillmentDialog.form.manual_completed_remark
		});
		ElMessage.success("已标记人工完成");
		fulfillmentDialog.visible = false;
		await loadData({ preservePurchaseOrder: refreshContext });
	} catch (e: any) {
		ElMessage.error(e?.message || "标记人工完成失败");
	} finally {
		fulfillmentDialog.processing = false;
	}
}

async function manualReopenFulfillment() {
	if (isFulfillmentDialogReadonly.value) {
		ElMessage.warning(getFulfillmentDocumentReadonlyTip());
		return;
	}
	try {
		await ElMessageBox.confirm(
			"恢复后会重新按入库、已发、残次品和商家少发计算实际可发；若仍满足条件，会重新进入批量发货。",
			"恢复可发确认",
			{
				type: "warning",
				confirmButtonText: "恢复可发",
				cancelButtonText: "取消"
			}
		);
	} catch (e) {
		return;
	}

	const refreshContext = buildPurchaseOrderRefreshContext();
	fulfillmentDialog.processing = true;
	try {
		await service.app.bsr_purchase_plan_product_view.manualReopenFulfillment({
			...buildFulfillmentIdentity(),
			remark: "恢复可发"
		});
		ElMessage.success("已恢复可发");
		fulfillmentDialog.visible = false;
		await loadData({ preservePurchaseOrder: refreshContext });
	} catch (e: any) {
		ElMessage.error(e?.message || "恢复可发失败");
	} finally {
		fulfillmentDialog.processing = false;
	}
}

function getFulfillmentLogActionText(actionType: string, fieldGroup: string) {
	const fieldText =
		fieldGroup === "defective"
			? "残次品"
			: fieldGroup === "short_shipped"
				? "商家少发"
				: fieldGroup === "manual_completed"
					? "人工完成"
					: fieldGroup === "shelved"
						? "搁置"
						: "履约调整";
	const actionText =
		(
			{
				manual_complete: "标记",
				manual_reopen: "恢复",
				create: "创建",
				process: "处理",
				reopen: "重新打开",
				shelf: "标记",
				unshelf: "恢复"
			} as Record<string, string>
		)[actionType] || "修改";
	return `${actionText}${fieldText}`;
}

const fulfillmentLogFields = [
	{ key: "defective_qty", label: "残次品数量", type: "qty" },
	{ key: "defective_status", label: "残次品状态", type: "status" },
	{ key: "defective_remark", label: "残次品异常说明", type: "text" },
	{ key: "defective_process_remark", label: "残次品处理备注", type: "text" },
	{ key: "short_shipped_qty", label: "商家少发数量", type: "qty" },
	{ key: "short_shipped_status", label: "商家少发状态", type: "status" },
	{ key: "short_shipped_remark", label: "商家少发异常说明", type: "text" },
	{ key: "short_shipped_process_remark", label: "商家少发处理备注", type: "text" },
	{ key: "document_status", label: "单据状态", type: "document_status" },
	{ key: "assigned_to_username", label: "指派处理人", type: "text" },
	{ key: "assigned_time", label: "指派时间", type: "datetime" },
	{ key: "confirmed_by_username", label: "确认人", type: "text" },
	{ key: "confirmed_time", label: "确认时间", type: "datetime" },
	{ key: "confirm_remark", label: "确认备注", type: "text" },
	{ key: "manual_completed", label: "人工完成", type: "bool" },
	{ key: "manual_completed_remark", label: "人工完成原因", type: "text" },
	{ key: "manual_completed_by_username", label: "人工完成人", type: "text" },
	{ key: "manual_completed_time", label: "人工完成时间", type: "datetime" },
	{ key: "shelved", label: "搁置", type: "bool" },
	{ key: "shelved_remark", label: "搁置原因", type: "text" },
	{ key: "shelved_by_username", label: "搁置人", type: "text" },
	{ key: "shelved_time", label: "搁置时间", type: "datetime" }
];

function parseFulfillmentLogJson(value: any) {
	if (!value) return null;
	if (typeof value === "object") return value;
	if (typeof value !== "string") return null;
	try {
		return JSON.parse(value);
	} catch (e) {
		return null;
	}
}

function getDefaultFulfillmentLogSnapshot() {
	return {
		defective_qty: 0,
		defective_status: 0,
		defective_remark: "",
		defective_process_remark: "",
		short_shipped_qty: 0,
		short_shipped_status: 0,
		short_shipped_remark: "",
		short_shipped_process_remark: "",
		document_status: 0,
		assigned_to_username: "",
		assigned_time: null,
		confirmed_by_username: "",
		confirmed_time: null,
		confirm_remark: "",
		manual_completed: 0,
		manual_completed_remark: "",
		manual_completed_by_username: "",
		manual_completed_time: null,
		shelved: 0,
		shelved_remark: "",
		shelved_by_username: "",
		shelved_time: null
	};
}

function getFulfillmentLogComparableValue(field: any, snapshot: any) {
	const value = snapshot?.[field.key];
	if (field.type === "qty" || field.type === "status" || field.type === "document_status") {
		return Number(value) || 0;
	}
	if (field.type === "bool") {
		return Number(value) === 1 ? 1 : 0;
	}
	return String(value ?? "").trim();
}

function formatFulfillmentLogValue(field: any, value: any) {
	if (field.type === "qty") {
		return String(Number(value) || 0);
	}
	if (field.type === "status") {
		return getAdjustmentStatusText(Number(value) || 0);
	}
	if (field.type === "document_status") {
		return getFulfillmentDocumentStatusText(Number(value) || 0);
	}
	if (field.type === "bool") {
		return Number(value) === 1 ? "是" : "否";
	}
	if (field.type === "datetime") {
		return value ? formatDate(value) : "空";
	}
	const text = String(value ?? "").trim();
	return text || "空";
}

function getFulfillmentLogChanges(log: any) {
	const beforeRaw = parseFulfillmentLogJson(log?.before_json);
	const afterRaw = parseFulfillmentLogJson(log?.after_json);
	const before = {
		...getDefaultFulfillmentLogSnapshot(),
		...(beforeRaw || {})
	};
	const after = {
		...getDefaultFulfillmentLogSnapshot(),
		...(afterRaw || {})
	};

	return fulfillmentLogFields
		.filter((field) => {
			return (
				getFulfillmentLogComparableValue(field, before) !==
				getFulfillmentLogComparableValue(field, after)
			);
		})
		.map((field) => ({
			key: field.key,
			label: field.label,
			beforeText: formatFulfillmentLogValue(field, before[field.key]),
			afterText: formatFulfillmentLogValue(field, after[field.key])
		}));
}

function formatFulfillmentLogChangeSummary(change: any) {
	return `${change.label}：${change.beforeText} → ${change.afterText}`;
}

function getFulfillmentLogSummary(log: any) {
	const changes = getFulfillmentLogChanges(log);
	if (!changes.length) return "无字段变化";

	const visibleChanges = changes.slice(0, 1).map(formatFulfillmentLogChangeSummary);
	const suffix = changes.length > visibleChanges.length ? ` 等 ${changes.length} 项` : "";
	return `${visibleChanges.join("；")}${suffix}`;
}

function getFulfillmentLogDetailText(log: any) {
	const count = getFulfillmentLogChanges(log).length;
	return count > 1 ? `${count}项` : "详情";
}

function getShipmentPlanActualDetails(shipmentPlan: any) {
	return Array.isArray(shipmentPlan?.actual_details) ? shipmentPlan.actual_details : [];
}

function getPurchaseOrderShipmentTableRows(order: any) {
	return getPurchaseOrderShipmentPlans(order).flatMap((shipmentPlan: any) => {
		const actualDetails = getShipmentPlanActualDetails(shipmentPlan);
		if (!actualDetails.length) {
			return [buildShipmentTableRow(shipmentPlan, null)];
		}

		return actualDetails.map((actual: any) => buildShipmentTableRow(shipmentPlan, actual));
	});
}

function getShipmentTableRowKey(item: any) {
	return item?.key || "";
}

function buildShipmentTableRow(shipmentPlan: any, actual: any) {
	return {
		key: [
			shipmentPlan?.purchase_plan_sn,
			shipmentPlan?.id,
			shipmentPlan?.isp_id,
			shipmentPlan?.seq,
			shipmentPlan?.shipment_plan_sn,
			actual?.id,
			actual?.ispr_id,
			actual?.shipment_sn
		]
			.filter(Boolean)
			.join("|"),
		has_actual: Boolean(actual),
		purchase_plan_sn: shipmentPlan?.purchase_plan_sn || "",
		purchase_order_sn: shipmentPlan?.purchase_order_sn || "",
		seq: actual?.seq || shipmentPlan?.seq || "",
		shipment_plan_sn: actual?.shipment_plan_sn || shipmentPlan?.shipment_plan_sn || "",
		shipment_plan_quantity: Number(shipmentPlan?.shipment_plan_quantity) || 0,
		actual_qty: Number(actual?.shipment_list_quantity) || 0,
		plan_diff_qty: Number(shipmentPlan?.diff_qty) || 0,
		shipping_method: shipmentPlan?.shipping_method || "",
		method_name: actual?.method_name || "",
		logistics_channel_name: actual?.logistics_channel_name || "",
		wname: actual?.wname || shipmentPlan?.wname || "",
		shipment_sn: actual?.shipment_sn || "",
		shipment_status: actual?.shipment_status ?? null,
		shipment_status_name: actual?.shipment_status_name || "",
		shipment_time: actual?.shipment_time || null,
		image_url: actual?.pic_url || shipmentPlan?.small_image_url || "",
		product_name: actual?.product_name || shipmentPlan?.product_name || "",
		asin: actual?.asin || "",
		msku: actual?.msku || shipmentPlan?.msku || "",
		fnsku: actual?.fnsku || shipmentPlan?.fnsku || "",
		sku: actual?.sku || shipmentPlan?.sku || "",
		sname: actual?.sname || shipmentPlan?.sname || "",
		nation: actual?.nation || ""
	};
}

function getShipmentRowImageUrl(item: any) {
	const imageUrl = String(item?.image_url || "").trim();
	return imageUrl ? convert_image_url(imageUrl) : "";
}

function getShipmentRowPreviewList(item: any) {
	const imageUrl = getShipmentRowImageUrl(item);
	return imageUrl ? [imageUrl] : [];
}

function getShipmentRowProductName(item: any) {
	return item?.product_name || item?.sku || item?.msku || "-";
}

function formatShipmentActualSnList(shipmentPlan: any) {
	const details = Array.isArray(shipmentPlan?.actual_details) ? shipmentPlan.actual_details : [];
	const sns = details.map((detail: any) => detail.shipment_sn).filter(Boolean);

	return sns.length ? sns.join(" / ") : "-";
}

function getShipmentPlanSummary(plan: any) {
	return (
		plan?.shipment_plans_summary || {
			plan_count: 0,
			batch_count: 0,
			shipment_plan_qty_sum: 0,
			actual_order_count: 0,
			actual_item_count: 0,
			actual_qty_sum: 0,
			latest_plan_time: null,
			latest_actual_time: null
		}
	);
}

function getShipmentPlans(plan: any) {
	return Array.isArray(plan?.shipment_plans) ? plan.shipment_plans : [];
}

function hasShipmentPlans(plan: any) {
	const summary = getShipmentPlanSummary(plan);
	return (summary.plan_count || summary.batch_count || 0) > 0;
}

function getShipmentActualDetails(plan: any) {
	return getShipmentPlans(plan).flatMap((shipmentPlan: any) => {
		const details = Array.isArray(shipmentPlan?.actual?.details)
			? shipmentPlan.actual.details
			: [];

		return details.map((detail: any) => ({
			...detail,
			seq: detail.seq || shipmentPlan.seq || "",
			shipment_plan_sn: detail.shipment_plan_sn || shipmentPlan.shipment_plan_sn || "",
			purchase_order_sn: shipmentPlan.purchase_order_sn || "",
			shipping_method: shipmentPlan.shipping_method || ""
		}));
	});
}

function getShipmentPlanDetailTitle(plan: any) {
	const summary = getShipmentPlanSummary(plan);
	if (!summary.plan_count && !summary.batch_count) return "-";

	return [
		`发货计划 ${summary.batch_count || 0} 批`,
		`明细 ${summary.plan_count || 0} 条`,
		`计划 ${summary.shipment_plan_qty_sum || 0}`,
		`实发 ${summary.actual_qty_sum || 0}`,
		summary.actual_order_count ? `发货单 ${summary.actual_order_count} 单` : "未生成发货单"
	].join(" / ");
}

function getShipmentActualDetailTitle(plan: any) {
	const summary = getShipmentPlanSummary(plan);
	if (!summary.actual_order_count) return "该采购计划还没有实际发货单";

	return [
		`发货单 ${summary.actual_order_count || 0} 单`,
		`发货明细 ${summary.actual_item_count || 0} 条`,
		`实发 ${summary.actual_qty_sum || 0}`
	].join(" / ");
}

function getSelectedPlan(row: any) {
	const plans = Array.isArray(row?.plans) ? row.plans : [];
	const selectedSn = selectedPlanSnMap[row?.row_key];
	return plans.find((plan: any) => plan.plan_sn === selectedSn) || plans[0] || null;
}

function getPrimaryPlanForPurchaseOrder(row: any, order: any) {
	const plans = Array.isArray(row?.plans) ? row.plans : [];
	const linkedPlanSn = order?.linked_plan_sns?.[0] || order?.linked_plans?.[0]?.plan_sn || "";

	if (linkedPlanSn) {
		const matched = plans.find((plan: any) => plan.plan_sn === linkedPlanSn);
		if (matched) return matched;
	}

	return null;
}

function isPlanLinkedToSelectedPurchaseOrder(row: any, plan: any) {
	const selectedOrder = getSelectedPurchaseOrder(row);
	if (!selectedOrder?.order_sn || !plan?.plan_sn) return false;

	return selectedOrder.linked_plan_sns?.includes(plan.plan_sn);
}

function isSelectedPlan(row: any, plan: any) {
	return Boolean(plan?.plan_sn && getSelectedPlan(row)?.plan_sn === plan.plan_sn);
}

function getPlanRelationRows(row: any) {
	return getSortedPlans(row);
}

function getVisiblePlanRelationRows(row: any) {
	const selectedPlan = getSelectedPlan(row);
	if (selectedPlan) return [selectedPlan];

	return getPlanRelationRows(row).slice(0, 1);
}

function getHiddenPlanRelationCount(row: any) {
	return Math.max(getPlanRelationRows(row).length - getVisiblePlanRelationRows(row).length, 0);
}

function getPlanRelationHeadText(row: any) {
	const visibleCount = getVisiblePlanRelationRows(row).length;
	const totalCount = getPlanRelationRows(row).length;
	return `采购计划 ${visibleCount}/${totalCount} 条`;
}

function getPlanRelationStatusText(row: any, plan: any) {
	if (isSelectedPlan(row, plan)) return "当前采购计划";
	if (isPlanLinkedToSelectedPurchaseOrder(row, plan)) return "当前采购单";
	if (hasPurchaseOrders(plan)) return "有采购单";
	return "无采购单";
}

function getPlanRelationStatusType(row: any, plan: any) {
	if (isSelectedPlan(row, plan)) return "primary";
	if (isPlanLinkedToSelectedPurchaseOrder(row, plan)) return "primary";
	if (hasPurchaseOrders(plan)) return "success";
	return "info";
}

function getPlanRelationText(row: any, plan: any) {
	const selectedOrder = getSelectedPurchaseOrder(row);
	if (isSelectedPlan(row, plan) && selectedOrder?.order_sn) {
		const planOrder = getPurchaseOrders(plan).find(
			(order: any) => order.order_sn === selectedOrder?.order_sn
		);
		return planOrder ? getPurchaseOrderOptionText(planOrder) : "当前计划已关联采购单";
	}

	if (isSelectedPlan(row, plan)) {
		return "当前采购计划暂无采购单，可直接查看补货分析和流程";
	}

	if (isPlanLinkedToSelectedPurchaseOrder(row, plan)) {
		return "已关联当前采购单";
	}

	if (hasPurchaseOrders(plan)) {
		const summary = getPurchaseOrderSummary(plan);
		return `关联采购单 ${summary.all_order_count || summary.order_count || 0} 单，不属于当前采购单`;
	}

	return "这个采购计划还没有生成采购单";
}

function getDefaultSelectedPlanSn(plans: any[], preferredPlanSn?: string) {
	const matchedPreferred = plans.find((plan: any) => plan.plan_sn === preferredPlanSn);
	if (matchedPreferred) {
		return matchedPreferred.plan_sn || "";
	}

	return plans[0]?.plan_sn || "";
}

function getSortedPlans(row: any) {
	const plans = Array.isArray(row?.plans) ? [...row.plans] : [];

	return plans.sort(
		(a: any, b: any) => getTimeValue(getPlanTime(b)) - getTimeValue(getPlanTime(a))
	);
}

function getSelectedPlanPosition(row: any) {
	const plans = Array.isArray(row?.plans) ? row.plans : [];
	const selectedSn = selectedPlanSnMap[row?.row_key];
	const index = plans.findIndex((plan: any) => plan.plan_sn === selectedSn);

	if (index >= 0) return index;
	return plans.length > 0 ? 0 : -1;
}

function getSelectedPlanIndex(row: any) {
	const position = getSelectedPlanPosition(row);
	return position >= 0 ? position + 1 : 0;
}

function formatDate(value: any) {
	if (!value) return "-";
	return String(value).replace("T", " ").slice(0, 19);
}

function formatShortDateTime(value: any) {
	if (!value) return "-";
	const text = formatDate(value);
	if (text === "-") return "-";
	return text.slice(5, 16);
}

function getPlanTime(plan: any) {
	return getLingxingPlan(plan).create_time_remote || getLocalRecord(plan).create_time || null;
}

function formatShortDate(value: any) {
	if (!value) return "-";
	return String(value).slice(5, 10);
}

function formatPlanPeriod(plan: any) {
	if (!plan) return "-";
	const local = getLocalRecord(plan);
	return `${local.start_date || "-"} 至 ${local.end_date || "-"}`;
}

function getPlanBuyer(plan: any) {
	const lingxing = getLingxingPlan(plan);
	return lingxing.cg_opt_username || lingxing.purchaser_name || "-";
}

function getLingxingRemark(plan: any) {
	const lingxing = getLingxingPlan(plan);
	return lingxing.plan_remark || lingxing.remark || "";
}

function getLocalSummary(plan: any) {
	const local = getLocalRecord(plan);
	if (!local) return "-";

	const period =
		local.start_date || local.end_date
			? `${local.start_date || "-"} 至 ${local.end_date || "-"}`
			: "";
	const days = local.total_days ? `${local.total_days}天` : "";
	const summary = local.summary || "";

	return [period, days, summary].filter(Boolean).join(" / ") || "-";
}

function getPurchaseOrderLogisticsSummaryText(plan: any) {
	const summary = getPurchaseOrderSummary(plan);
	if (!summary.order_count) return "-";

	const parts = [
		summary.logistics_abnormal_count ? `异常 ${summary.logistics_abnormal_count}` : "",
		summary.overtime_unsigned_count ? `超时 ${summary.overtime_unsigned_count}` : "",
		summary.in_transit_count ? `在途 ${summary.in_transit_count}` : "",
		summary.no_logistics_count ? `暂无物流 ${summary.no_logistics_count}` : "",
		summary.signed_count ? `已签收 ${summary.signed_count}` : "",
		summary.confirmed_count ? `已确认 ${summary.confirmed_count}` : ""
	].filter(Boolean);

	return parts.join(" / ") || "未同步物流";
}

function getPurchaseOrderLogisticsCardText(plan: any) {
	const summary = getPurchaseOrderSummary(plan);
	if (!summary.order_count) return "-";

	const countMap: Record<string, number> = {
		logistics_abnormal: Number(summary.logistics_abnormal_count) || 0,
		overtime_unsigned: Number(summary.overtime_unsigned_count) || 0,
		in_transit: Number(summary.in_transit_count) || 0,
		no_logistics: Number(summary.no_logistics_count) || 0,
		signed: Number(summary.signed_count) || 0,
		confirmed: Number(summary.confirmed_count) || 0
	};
	const count = countMap[String(summary.worst_logistics_status || "")] || 0;

	return count ? `${count}单` : getPurchaseOrderLogisticsSummaryText(plan);
}

function getPurchaseOrderLogisticsCardTextForOrder(order: any) {
	if (!order) return "-";

	const pkgCount = Number(order.logistics_pkg_count) || 0;
	const signedCount = Number(order.logistics_signed_count) || 0;
	if (pkgCount) return `${signedCount}/${pkgCount} 包裹签收`;

	return order.logistics_status_text || "未同步物流";
}

function getPurchaseOrderLogisticsPreviewPackages(order: any) {
	return Array.isArray(order?.logistics_packages) ? order.logistics_packages : [];
}

function getPackageSourceItems(pkg: any) {
	const value = pkg?.source_items_json;
	if (Array.isArray(value)) return value;
	if (typeof value === "string" && value.trim()) {
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return [];
}

function getPackageSourceCount(pkg: any) {
	return Number(pkg?.source_count) || getPackageSourceItems(pkg).length || 1;
}

function getSourceCompany(source: any) {
	return String(source?.logistics_company || source?.raw_company_name || "").trim();
}

function getSourcePolId(source: any) {
	return String(source?.pol_id || source?.source_pol_id || "").trim();
}

function getSourceTrackingNo(source: any) {
	return String(source?.logistics_order_no || source?.tracking_no || "").trim();
}

function getQueryBlockText(pkg: any) {
	if (pkg?.can_query === true) return "可查询快递100";
	return getQueryBlockReasonText(pkg);
}

function getQueryStatusTagType(pkg: any) {
	if (pkg?.can_query === true) return "success";
	const reason = String(pkg?.query_block_reason || pkg?.query_mode || pkg?.status || "").trim();
	if (
		[
			"cooldown",
			"phone_required",
			"phone_invalid",
			"pending_mapping",
			"identify_failed"
		].includes(reason)
	) {
		return "warning";
	}
	if (reason === "signed") return "success";
	if (["ignored", "manual_required", "disabled"].includes(reason)) return "info";
	if (["logistics_exception", "no_result"].includes(reason)) return "danger";
	return "info";
}

function getPurchaseOrderLogisticsDetailTitleForOrder(order: any) {
	if (!order) return "当前产品还没有采购单";

	return [
		`采购单 ${order.order_sn || "-"}`,
		order.logistics_status_text || "未同步物流",
		getOrderLogisticsPackageText(order),
		order.logistics_last_sync_time
			? `最近同步 ${formatShortDateTime(order.logistics_last_sync_time)}`
			: ""
	]
		.filter(Boolean)
		.join(" / ");
}

function getPurchaseOrderExcludedText(plan: any) {
	const summary = getPurchaseOrderSummary(plan);
	const excludedCount = Number(summary.excluded_order_count) || 0;
	if (!excludedCount) return "";

	return `未计入 ${excludedCount} 单`;
}

function getPurchaseOrderLogisticsDetailTitle(plan: any) {
	const summary = getPurchaseOrderSummary(plan);
	if (!summary.all_order_count && !summary.order_count) return "-";

	const activeText = `计入 ${summary.order_count || 0} 单`;
	const excludedText = getPurchaseOrderExcludedText(plan);
	const logisticsText = summary.order_count ? getPurchaseOrderLogisticsSummaryText(plan) : "";

	return [activeText, excludedText, logisticsText].filter(Boolean).join(" / ");
}

function getOrderLogisticsPackageText(order: any) {
	const pkgCount = Number(order?.logistics_pkg_count) || 0;
	const signedCount = Number(order?.logistics_signed_count) || 0;

	if (!pkgCount) return "无包裹";
	return `${signedCount}/${pkgCount}`;
}

function getPurchaseOrderStatusSummaryText(plan: any) {
	const summary = getPurchaseOrderSummary(plan);
	if (!summary.all_order_count && !summary.order_count) return "该采购计划未关联采购单";

	const parts = [
		summary.completed_order_count ? `已完成 ${summary.completed_order_count}` : "",
		summary.void_order_count ? `作废 ${summary.void_order_count}` : "",
		summary.other_order_count ? `处理中 ${summary.other_order_count}` : ""
	].filter(Boolean);

	return parts.join(" / ") || `采购单 ${summary.order_count} 单`;
}

function getPurchaseOrderQuantityText(plan: any) {
	const summary = getPurchaseOrderSummary(plan);
	if (!summary.order_count) return "计入 0";

	return [
		`计划 ${summary.quantity_plan_sum || 0}`,
		`实际 ${summary.quantity_real_sum || 0}`,
		`入库 ${summary.quantity_entry_sum || 0}`,
		`待到货 ${summary.quantity_receive_sum || 0}`
	].join(" / ");
}

function getPlanPurchaseOrderHeadline(plan: any) {
	const summary = getPurchaseOrderSummary(plan);
	if (!summary.all_order_count && !summary.order_count) return "该采购计划未关联采购单";

	return `采购单 ${summary.order_count} 单 / 子项 ${summary.linked_item_count} 条`;
}

function getPlanPurchaseOrderExtra(plan: any) {
	const summary = getPurchaseOrderSummary(plan);
	if (!summary.all_order_count && !summary.order_count) return "还没有采购单与物流数据";

	return [
		getPurchaseOrderQuantityText(plan),
		getPurchaseOrderExcludedText(plan),
		summary.order_count ? getPurchaseOrderLogisticsSummaryText(plan) : ""
	]
		.filter(Boolean)
		.join(" / ");
}

function getPlanPurchaseOrderBrief(plan: any) {
	if (!plan) return "-";
	return hasPurchaseOrders(plan)
		? `${getPlanPurchaseOrderHeadline(plan)} / ${getPurchaseOrderLogisticsSummaryText(plan)}`
		: "该采购计划未关联采购单";
}

function getLocalCalculationText(plan: any) {
	const calculation = getLocalRecord(plan).calculation || {};

	return [
		`系统建议量：${calculation.system_suggested_qty || 0}`,
		`待交付扣减：${calculation.pending_delivery_qty || 0}`,
		`已有采购计划扣减：${calculation.purchase_plan_qty || 0}`,
		`实际采购量：${calculation.actual_purchase_qty || 0}`,
		`基础日均：${calculation.base_daily_avg_sales || 0}`,
		`人工系数：${calculation.artificial_coefficient || 0}`
	].join(" / ");
}

function getTimeValue(value: any) {
	const text = formatDate(value);
	if (text === "-") return 0;
	const time = new Date(text.replace(/-/g, "/")).getTime();
	return Number.isFinite(time) ? time : 0;
}

function getPlanDetailText(plan: any) {
	const local = getLocalRecord(plan);
	const breakdown = Array.isArray(local.breakdown)
		? local.breakdown.map((item: any) => formatBreakdown(item)).join("；")
		: "";

	return (
		[
			local.manual_remark ? `本地人工备注：${local.manual_remark}` : "",
			local.summary ? `测算摘要：${local.summary}` : "",
			getLocalCalculationText(plan),
			local.formula ? `测算公式：${local.formula}` : "",
			local.remark_text ? `测算说明：${local.remark_text}` : "",
			breakdown ? `分段：${breakdown}` : ""
		]
			.filter(Boolean)
			.join("\n") || "-"
	);
}

function formatBreakdown(item: any) {
	const label = item?.shipping_label || item?.shipping_method || "分段";
	const start = formatShortDate(item?.startDate);
	const end = formatShortDate(item?.endDate);
	const qty = Number(item?.subtotal) || 0;
	return `${label} ${start}-${end} ${qty}`;
}

function getVisibleBreakdown(plan: any) {
	const breakdown = Array.isArray(getLocalRecord(plan).breakdown)
		? getLocalRecord(plan).breakdown
		: [];
	return breakdown.slice(0, 3);
}

function getBreakdownRestCount(plan: any) {
	const breakdown = Array.isArray(getLocalRecord(plan).breakdown)
		? getLocalRecord(plan).breakdown
		: [];
	return Math.max(breakdown.length - 3, 0);
}

function getPlanStatusText(plan: any) {
	if (!plan) return "-";
	const lingxing = getLingxingPlan(plan);
	return lingxing.status_text || statusTextMap[String(lingxing.status)] || "-";
}

function getPlanStatusType(plan: any) {
	const status = String(getLingxingPlan(plan).status ?? "");
	if (status === "-2") return "success";
	if (status === "2") return "warning";
	if (status === "121") return "primary";
	if (status === "122" || status === "-3" || status === "124") return "danger";
	return "info";
}

function getPurchaseOrderStatusType(status: any) {
	const map: Record<string, "primary" | "success" | "warning" | "info" | "danger"> = {
		"9": "success",
		"1": "primary",
		"2": "warning",
		"3": "info",
		"-1": "danger",
		"121": "warning",
		"122": "danger",
		"124": "danger"
	};

	return map[String(status ?? "")] || "info";
}

function getShipmentPlanStatusType(status: any) {
	const map: Record<string, "primary" | "success" | "warning" | "info" | "danger"> = {
		"-5": "danger",
		"0": "warning",
		"5": "primary",
		"10": "success"
	};

	return map[String(status ?? "")] || "info";
}

function getActualShipmentStatusType(status: any) {
	const map: Record<string, "primary" | "success" | "warning" | "info" | "danger"> = {
		"-1": "info",
		"0": "warning",
		"1": "primary",
		"2": "success",
		"3": "danger"
	};

	return map[String(status ?? "")] || "info";
}

function getShippingMethodLabel(method: any) {
	const map: Record<string, string> = {
		express: "快递",
		air: "空运",
		truck: "卡车",
		rail: "铁路",
		sea: "海运"
	};
	const key = String(method || "");

	return map[key] || key || "-";
}

function getPurchaseOrderRowClassName({ row }: { row: any }) {
	return row?.is_calculated_order ? "" : "purchase-order-row-excluded";
}

function getLogisticsTagType(status: any) {
	switch (String(status || "")) {
		case "confirmed":
			return "success";
		case "signed":
			return "success";
		case "partial_signed":
			return "success";
		case "partial_overtime_unsigned":
			return "warning";
		case "in_transit":
			return "primary";
		case "overtime_unsigned":
			return "warning";
		case "logistics_exception":
			return "danger";
		case "logistics_abnormal":
			return "danger";
		case "pending_mapping":
			return "warning";
		case "phone_required":
			return "warning";
		case "manual_required":
			return "info";
		case "no_logistics":
			return "info";
		default:
			return "info";
	}
}

function openPlanDetail(row: any, plan: any) {
	if (!plan) return;
	detailProduct.value = row;
	detailPlan.value = plan;
	detailVisible.value = true;
}

function openDetail(row: any) {
	openPlanDetail(row, getSelectedPlan(row));
}

function getTraceList(pkg: any) {
	if (Array.isArray(pkg?.trace_info_json)) {
		return pkg.trace_info_json;
	}

	if (typeof pkg?.trace_info_json === "string") {
		try {
			const parsed = JSON.parse(pkg.trace_info_json);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	return [];
}

function getLatestTraceText(pkg: any) {
	const traces = getTraceList(pkg);
	if (!traces.length) return "暂无轨迹信息";

	const latest = traces[0] || {};
	return [latest.accept_time, latest.remark].filter(Boolean).join(" / ") || "暂无轨迹信息";
}

function getPackageLogisticsStatusText(pkg: any) {
	const statusText = String(pkg?.status_text || "").trim();
	if (statusText) return statusText;

	const status = String(pkg?.status || "").trim();
	if (status) return status;

	return "未返回";
}

function getPackageLogisticsStatusReason(pkg: any) {
	const statusText = String(pkg?.status_text || "").trim();
	const status = String(pkg?.status || "").trim();
	if (statusText || status) {
		return [`状态：${statusText || "-"}`, `代码：${status || "-"}`].join(" / ");
	}

	return "领星没有返回该包裹的状态字段；这里不再显示空白，统一标记为“未返回”。";
}

function getPackageLogisticsTagType(pkg: any) {
	const status = String(pkg?.status || "").trim();
	const statusText = String(pkg?.status_text || "").trim();

	if (status === "SIGN" || statusText.includes("签收")) return "success";
	if (!status && !statusText) return "info";
	return "primary";
}

function getLogisticsPopoverData(order: any) {
	if (!order?.order_sn || logisticsPopoverState.orderSn !== order.order_sn) return [];
	return logisticsPopoverState.data;
}

async function loadLogisticsPopover(order: any) {
	const orderSn = order?.order_sn || "";
	if (!orderSn) return;
	if (logisticsPopoverState.orderSn === orderSn && logisticsPopoverState.data.length) return;

	logisticsPopoverState.orderSn = orderSn;
	logisticsPopoverState.loading = true;
	logisticsPopoverState.data = [];

	try {
		const res = await (service.app as any).bsr_purchase_order_sync_lingxing.getLogistics({
			order_sn: orderSn
		});
		logisticsPopoverState.data = Array.isArray(res) ? res : [];
	} catch (e: any) {
		console.error("获取物流明细失败:", e);
		ElMessage.error(e?.message || "获取物流信息失败");
	} finally {
		logisticsPopoverState.loading = false;
	}
}

function openLogisticsPackageTrace(pkg: any) {
	const orderSn = pkg?.order_sn || logisticsPopoverState.orderSn || "";
	if (!orderSn) return;

	logisticsDrawer.orderSn = orderSn;
	logisticsDrawer.visible = true;
	logisticsDrawer.loading = false;
	logisticsDrawer.data = logisticsPopoverState.data.length
		? logisticsPopoverState.data
		: pkg
			? [pkg]
			: [];
	const index = Math.max(
		logisticsDrawer.data.findIndex((item: any) => item.pol_id === pkg?.pol_id),
		0
	);
	logisticsDrawer.expandedPkgs = [String(index)];
}

async function openLogistics(row: any) {
	const orderSn = row?.order_sn || "";
	if (!orderSn) {
		ElMessage.warning("未能获取到采购单号");
		return;
	}

	logisticsDrawer.orderSn = orderSn;
	logisticsDrawer.visible = true;
	logisticsDrawer.loading = true;
	logisticsDrawer.expandedPkgs = [];
	logisticsDrawer.data = [];

	try {
		const res = await (service.app as any).bsr_purchase_order_sync_lingxing.getLogistics({
			order_sn: orderSn
		});
		logisticsDrawer.data = Array.isArray(res) ? res : [];
		logisticsDrawer.expandedPkgs = logisticsDrawer.data.map((_: any, index: number) =>
			String(index)
		);
	} catch (e: any) {
		console.error("获取物流明细失败:", e);
		ElMessage.error(e?.message || "获取物流信息失败");
	} finally {
		logisticsDrawer.loading = false;
	}
}

async function forceSyncLogistics(orderSn: string) {
	if (!orderSn) return;

	logisticsDrawer.syncing = true;
	try {
		const before = buildPackageSnapshot(logisticsDrawer.data);
		const res = await (service.app as any).bsr_purchase_order_sync_lingxing.forceSyncLogistics({
			order_sn: orderSn
		});
		logisticsDrawer.data = Array.isArray(res) ? res : [];
		if (logisticsPopoverState.orderSn === orderSn) {
			logisticsPopoverState.data = logisticsDrawer.data;
		}
		logisticsDrawer.expandedPkgs = logisticsDrawer.data.map((_: any, index: number) =>
			String(index)
		);
		await loadData();
		showLogisticsQuerySummary(logisticsDrawer.data, before);
	} catch (e: any) {
		console.error("同步物流失败:", e);
		ElMessage.error(e?.message || "同步物流失败");
	} finally {
		logisticsDrawer.syncing = false;
	}
}

async function queryLogisticsPackage(pkg: any) {
	if (!pkg?.id) return;
	logisticsDrawer.queryingPackageId = pkg.id;
	try {
		const before = buildPackageSnapshot([pkg]);
		const updated = await (
			service.app as any
		).bsr_purchase_order_sync_lingxing.queryLogisticsPackage({
			package_id: pkg.id
		});
		const idx = logisticsDrawer.data.findIndex((item: any) => item.id === pkg.id);
		if (idx >= 0 && updated) {
			logisticsDrawer.data.splice(idx, 1, updated);
		}
		if (logisticsPopoverState.orderSn === logisticsDrawer.orderSn) {
			logisticsPopoverState.data = logisticsDrawer.data;
		}
		showLogisticsQuerySummary(updated ? [updated] : [], before);
		await loadData();
	} catch (e: any) {
		ElMessage.error(e?.message || "包裹查询失败");
	} finally {
		logisticsDrawer.queryingPackageId = null;
	}
}

function showLogisticsQuerySummary(rows: any[], before: ReturnType<typeof buildPackageSnapshot>) {
	const summary = buildLogisticsQuerySummary(rows || [], before);
	const message = formatLogisticsQuerySummaryMessage(summary);
	if (summary.realQueryCount > 0) {
		ElMessage.success(message);
	} else {
		ElMessage.warning(message);
	}
}

const statusTextMap: Record<string, string> = {
	"2": "待采购",
	"-2": "已完成",
	"121": "待审批",
	"122": "已驳回",
	"-3": "已作废",
	"124": "已作废"
};

onMounted(() => {
	loadData();
	void openBatchShipReviewRestoreFromRoute();
});
</script>

<style lang="scss" scoped>
.purchase-product-view {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
	overflow: hidden;
	padding: 12px;
	box-sizing: border-box;
	background: var(--el-bg-color-page);
}

.page-toolbar,
.filter-bar,
.table-wrap,
.pagination-wrap {
	background: var(--el-bg-color);
}

.page-toolbar {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	justify-content: space-between;
	padding: 12px 14px;
	border: 1px solid var(--el-border-color-light);
	border-bottom: 0;
}

.toolbar-title {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.title {
	font-size: 17px;
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.source-header {
	cursor: help;
}

.toolbar-actions {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
}

.filter-bar {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	gap: 8px;
	padding: 10px 14px;
	border: 1px solid var(--el-border-color-light);
	border-bottom: 0;
	overflow-x: auto;
}

.work-status-tabs {
	flex: 0 0 auto;
	white-space: nowrap;
}

.filter-keyword {
	width: 310px;
	flex: 0 0 310px;
}

.filter-store {
	width: 180px;
	flex: 0 0 180px;
}

.filter-small {
	width: 130px;
	flex: 0 0 130px;
}

.filter-status {
	width: 140px;
	flex: 0 0 140px;
}

.filter-status-aiwei {
	width: 150px;
	flex-basis: 150px;
}

.filter-select-logistics {
	width: 140px;
	flex: 0 0 140px;

	:deep(.el-input__wrapper) {
		background: #fff;
	}
}

.filter-status-lingxing {
	width: 178px;
	flex-basis: 178px;
}

.fulfillment-status-option {
	display: block;
	min-width: 232px;
	padding: 3px 0;
}

.fulfillment-status-main {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.fulfillment-status-title-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	min-width: 0;
}

.fulfillment-status-label {
	color: var(--el-text-color-primary);
	font-weight: 600;
	text-decoration: underline dotted var(--el-border-color-darker);
	text-underline-offset: 4px;
	cursor: help;
	white-space: nowrap;
}

.fulfillment-status-label:hover {
	color: var(--el-color-primary);
	text-decoration-color: var(--el-color-primary);
}

.fulfillment-status-desc {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-placeholder);
	font-size: 12px;
	line-height: 16px;
}

.fulfillment-status-count {
	flex: 0 0 auto;
	min-width: 34px;
	padding: 1px 8px;
	border-radius: 999px;
	background: var(--el-fill-color-lighter);
	color: var(--el-text-color-secondary);
	font-variant-numeric: tabular-nums;
	font-size: 12px;
	line-height: 18px;
	text-align: center;
}

.status-filter-option {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 18px;
	min-width: 192px;
}

.status-filter-left {
	display: flex;
	align-items: center;
	gap: 5px;
	min-width: 0;
}

.status-filter-label {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-primary);
}

.status-help-icon {
	flex: 0 0 auto;
	font-size: 13px;
	color: var(--el-text-color-placeholder);
	cursor: help;
	transition: color 0.15s ease;
}

.status-help-icon:hover {
	color: var(--el-color-primary);
}

.status-filter-count {
	flex: 0 0 auto;
	min-width: 32px;
	padding: 1px 8px;
	border-radius: 999px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-secondary);
	font-family: var(--el-font-family);
	font-variant-numeric: tabular-nums;
	font-size: 12px;
	line-height: 18px;
	text-align: center;
}

.status-filter-count.loading {
	color: var(--el-text-color-placeholder);
}

.status-filter-count.error {
	background: var(--el-color-warning-light-9);
	color: var(--el-color-warning);
}

:global(.status-filter-popper) {
	min-width: 236px !important;
}

:global(.status-help-popper.el-popover),
:global(.status-help-popover.el-popover) {
	padding: 10px 12px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 10px;
	background: var(--el-bg-color);
	box-shadow: var(--el-box-shadow-light);
}

:global(.status-help-popper .el-popper__arrow::before),
:global(.status-help-popover .el-popper__arrow::before) {
	background: var(--el-bg-color);
	border-color: var(--el-border-color-light);
}

:global(.status-help-card) {
	display: grid;
	gap: 8px;
	line-height: 1.5;
	color: var(--el-text-color-regular);
}

:global(.status-help-title) {
	font-weight: 600;
	color: var(--el-text-color-primary);
}

:global(.status-help-line span) {
	display: block;
	margin-bottom: 2px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

:global(.status-help-line p) {
	margin: 0;
	color: var(--el-text-color-primary);
}

:global(.fulfillment-help-popover.el-popover) {
	padding: 12px 14px;
	border-radius: 8px;
}

:global(.fulfillment-help-card) {
	gap: 10px;
}

:global(.status-help-section) {
	display: grid;
	gap: 4px;
}

:global(.status-help-section-title) {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	font-weight: 600;
}

:global(.status-help-list) {
	display: grid;
	gap: 3px;
	margin: 0;
	padding-left: 16px;
	color: var(--el-text-color-primary);
}

:global(.status-help-list li) {
	padding-left: 1px;
}

.table-wrap {
	flex: 1;
	min-height: 0;
	overflow: hidden;
	border: 1px solid var(--el-border-color-light);
}

.table-wrap :deep(.el-table),
.table-wrap :deep(.el-table__inner-wrapper) {
	height: 100%;
}

.table-wrap :deep(.el-table__cell) {
	padding: 7px 0;
}

.table-wrap :deep(.el-table__body .el-table__cell) {
	vertical-align: middle;
}

.pagination-wrap {
	display: flex;
	flex: 0 0 auto;
	justify-content: flex-end;
	padding: 10px 14px;
	border: 1px solid var(--el-border-color-light);
	border-top: 0;
}

.product-image {
	width: 44px;
	height: 44px;
	cursor: zoom-in;
}

.product-image-trigger {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 48px;
	height: 48px;
}

.product-image-preview-wrap {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 228px;
	height: 228px;
	padding: 8px;
	background: #fff;
	box-sizing: border-box;
}

.product-image-preview {
	width: 100%;
	height: 100%;
	cursor: zoom-in;
}

.product-info-cell {
	display: flex;
	flex-direction: column;
	gap: 7px;
	min-width: 0;
	padding: 2px 0;
}

.product-info-title {
	color: var(--el-text-color-primary);
	font-weight: 700;
	line-height: 1.35;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	white-space: normal;
}

.product-info-store,
.product-info-identities {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px 12px;
	min-width: 0;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
}

.product-info-identities span {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	max-width: 230px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.product-info-identities b {
	color: var(--el-text-color-secondary);
	font-weight: 500;
}

.shelf-info-tag {
	align-self: flex-start;
	margin-top: 2px;
}

.product-info-metrics {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 6px;
	min-width: 0;
}

.product-info-metric {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	justify-content: center;
	gap: 3px;
	min-width: 0;
	min-height: 42px;
	padding: 5px 7px;
	background: var(--el-fill-color-extra-light);
	border: 1px solid var(--el-border-color-lighter);
	box-sizing: border-box;
	font-size: 12px;
	line-height: 1.2;
}

.product-info-metric span {
	max-width: 100%;
	color: var(--el-text-color-secondary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.product-info-metric b {
	min-width: 0;
	max-width: 100%;
	color: var(--el-text-color-primary);
	font-weight: 700;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	text-align: left;
}

.product-cell,
.stack-cell,
.plan-cell {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
}

.product-identity-cell {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
	font-size: 12px;
	line-height: 1.35;
}

.identity-line {
	display: grid;
	grid-template-columns: 48px minmax(0, 1fr);
	align-items: baseline;
	gap: 6px;
	min-width: 0;
}

.identity-main {
	font-size: 13px;
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.identity-label {
	color: var(--el-text-color-secondary);
	white-space: nowrap;
}

.identity-value {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.product-name {
	font-weight: 600;
	color: var(--el-text-color-primary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.current-plan-button {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto auto;
	align-items: center;
	gap: 8px;
	width: 100%;
	min-height: 38px;
	padding: 6px 8px;
	border: 1px solid var(--el-border-color);
	background: #fff;
	color: var(--el-text-color-regular);
	cursor: pointer;
	box-sizing: border-box;
	text-align: left;
}

.current-plan-button:hover {
	border-color: var(--el-color-primary);
	background: var(--el-color-primary-light-9);
}

.plan-index-pill {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 20px;
	padding: 0 6px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.current-plan-content {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.current-plan-sn {
	font-weight: 700;
	color: var(--el-color-primary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.current-plan-meta {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.current-plan-status-row {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.current-plan-status-text {
	flex: 1;
	min-width: 0;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.current-plan-status-tip {
	color: var(--el-color-warning);
	font-size: 12px;
	white-space: nowrap;
}

.current-plan-arrow {
	color: var(--el-text-color-secondary);
}

.plan-relation-cell {
	display: flex;
	flex-direction: column;
	gap: 7px;
	min-width: 0;
}

.plan-relation-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
}

.plan-relation-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
	max-height: 112px;
	overflow-y: auto;
	padding-right: 3px;
}

.plan-relation-list.all {
	max-height: 360px;
}

.plan-relation-popover {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.plan-relation-item {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	padding: 7px 8px;
	border: 1px solid var(--el-border-color-lighter);
	border-left: 3px solid var(--el-border-color);
	background: #fff;
	box-sizing: border-box;
	cursor: pointer;
	transition:
		border-color 0.18s ease,
		background 0.18s ease;
}

.plan-relation-item.active {
	border-left-color: var(--el-color-primary);
	background: var(--el-color-primary-light-9);
}

.plan-relation-item.linked:not(.active) {
	border-left-color: var(--el-color-primary-light-5);
}

.plan-relation-item.empty {
	background: var(--el-fill-color-extra-light);
}

.plan-relation-top,
.plan-relation-meta {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.plan-relation-sn {
	flex: 1 1 auto;
	min-width: 0;
	color: var(--el-color-primary);
	font-weight: 700;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.plan-relation-meta,
.plan-relation-text {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
}

.plan-relation-meta {
	flex-wrap: wrap;
}

.plan-relation-text {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.plan-relation-more {
	align-self: flex-start;
	height: 24px;
	padding: 0 8px;
	border: 1px solid var(--el-border-color);
	background: #fff;
	color: var(--el-color-primary);
	font-size: 12px;
	line-height: 22px;
	cursor: pointer;
}

.plan-relation-more:hover {
	border-color: var(--el-color-primary);
	background: var(--el-color-primary-light-9);
}

.plan-popover-panel {
	display: flex;
	flex-direction: column;
	gap: 8px;
	max-height: 480px;
	overflow: hidden;
}

.plan-popover-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 2px 6px;
	font-weight: 600;
	color: var(--el-text-color-primary);
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.plan-current-card {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 8px 10px;
	border: 1px solid var(--el-color-primary-light-6);
	border-left: 3px solid var(--el-color-primary);
	background: var(--el-color-primary-light-9);
	color: var(--el-text-color-regular);
	box-sizing: border-box;
}

.plan-search {
	margin-top: 2px;
}

.plan-list-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 4px 2px 2px;
	font-size: 12px;
	font-weight: 600;
	color: var(--el-text-color-secondary);
}

.plan-option-list {
	display: flex;
	flex-direction: column;
	max-height: 340px;
	overflow-y: auto;
	border: 1px solid var(--el-border-color-lighter);
	background: #fff;
}

.plan-option {
	width: 100%;
	padding: 7px 8px;
	border: 0;
	border-bottom: 1px solid var(--el-border-color-lighter);
	background: #fff;
	color: var(--el-text-color-regular);
	cursor: default;
	text-align: left;
	box-sizing: border-box;
}

.plan-option:last-child {
	border-bottom: 0;
}

.plan-option:hover {
	background: var(--el-fill-color-light);
}

.plan-option-head {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 58px;
	align-items: start;
	gap: 8px;
	width: 100%;
}

.plan-option.active {
	border-color: var(--el-color-primary);
	background: var(--el-color-primary-light-9);
	color: var(--el-color-primary);
}

.plan-option-main {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	cursor: pointer;
}

.plan-current-card .plan-option-main {
	cursor: default;
}

.plan-option-sn {
	flex: 1 1 auto;
	min-width: 0;
	font-weight: 700;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.plan-option-top {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.plan-option-meta-line {
	display: flex;
	flex-wrap: wrap;
	gap: 4px 10px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
}

.plan-option-meta-line span {
	white-space: nowrap;
}

.plan-option-summary-line {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.plan-option-actions {
	display: flex;
	flex-direction: column;
	gap: 5px;
	align-items: flex-end;
	min-width: 58px;
}

.plan-detail-action,
.plan-select-action {
	width: 54px;
	height: 24px;
	border-radius: 3px;
	font-size: 12px;
	line-height: 22px;
	cursor: pointer;
	box-sizing: border-box;
}

.plan-detail-action {
	border: 0;
	background: transparent;
	color: var(--el-color-primary);
}

.plan-select-action {
	border: 1px solid var(--el-color-primary);
	background: #fff;
	color: var(--el-color-primary);
}

.plan-select-action:hover {
	background: var(--el-color-primary-light-9);
}

.plan-empty {
	padding: 18px 8px;
	text-align: center;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	background: var(--el-fill-color-lighter);
}

.qty-main {
	font-size: 18px;
	font-weight: 700;
	color: var(--el-color-primary);
	line-height: 1.2;
}

.qty-main.small {
	font-size: 16px;
}

.breakdown-list {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	align-items: center;
}

.muted {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.detail-body {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.detail-section {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.section-title {
	font-size: 14px;
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.detail-text {
	padding: 8px 10px;
	line-height: 1.6;
	background: var(--el-fill-color-lighter);
	border: 1px solid var(--el-border-color-lighter);
	color: var(--el-text-color-regular);
	white-space: pre-wrap;
	word-break: break-word;
}

.fulfillment-dialog {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.fulfillment-dialog-summary {
	display: grid;
	grid-template-columns: repeat(5, minmax(0, 1fr));
	gap: 8px;
	padding: 10px;
	background: var(--el-fill-color-lighter);
	border: 1px solid var(--el-border-color-lighter);
}

.fulfillment-dialog-summary div {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
}

.fulfillment-dialog-summary span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.fulfillment-dialog-summary strong {
	color: var(--el-text-color-primary);
	font-size: 15px;
	font-variant-numeric: tabular-nums;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.fulfillment-dialog-summary strong.positive {
	color: var(--el-color-success);
}

.fulfillment-dialog-summary strong.negative {
	color: var(--el-color-danger);
}

.fulfillment-adjustment-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 12px;
}

.fulfillment-adjustment-panel {
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-height: 250px;
	padding: 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: #fff;
}

.fulfillment-adjustment-panel :deep(.el-form) {
	display: flex;
	flex: 1;
	flex-direction: column;
}

.fulfillment-adjustment-panel :deep(.el-form > .el-button) {
	margin-top: auto;
}

.fulfillment-process-hint {
	min-height: 18px;
	margin-top: auto;
	color: var(--el-color-success-dark-2);
	font-size: 12px;
	line-height: 18px;
}

.fulfillment-process-remark {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 8px 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 4px;
	background: var(--el-fill-color-lighter);
	font-size: 12px;
	line-height: 1.5;
}

.fulfillment-process-remark span {
	color: var(--el-text-color-secondary);
}

.fulfillment-process-remark strong {
	color: var(--el-text-color-primary);
	font-weight: 500;
	white-space: pre-wrap;
	word-break: break-word;
}

.fulfillment-action-wrap {
	display: block;
}

.fulfillment-action-wrap.is-disabled {
	cursor: not-allowed;
}

.fulfillment-action-wrap.is-disabled .fulfillment-action-button {
	pointer-events: none;
}

.fulfillment-action-button {
	width: 100%;
}

.fulfillment-adjustment-panel.manual-complete {
	border-color: var(--el-color-warning-light-7);
	background: #fff;
}

.fulfillment-adjustment-panel.manual-complete.completed {
	border-color: var(--el-color-warning-light-5);
	background: #fff;
}

.fulfillment-adjustment-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-weight: 700;
}

.manual-complete-tip {
	display: flex;
	align-items: center;
	gap: 7px;
	min-height: 34px;
	padding: 7px 9px;
	border-left: 3px solid var(--el-color-warning);
	border-radius: 4px;
	background: var(--el-color-warning-light-9);
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
}

.manual-complete-tip :deep(.el-icon) {
	flex: 0 0 auto;
	color: var(--el-color-warning);
	font-size: 15px;
}

.manual-complete-form {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 6px;
}

.manual-complete-field-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	color: var(--el-text-color-regular);
	font-size: 12px;
	font-weight: 600;
}

.manual-complete-field-head em {
	color: var(--el-color-danger);
	font-style: normal;
}

.manual-complete-empty-hint {
	min-height: 18px;
	color: var(--el-color-warning-dark-2);
	font-size: 12px;
	line-height: 18px;
}

.manual-complete-action-wrap {
	display: block;
	margin-top: auto;
}

.manual-complete-action-wrap.is-disabled {
	cursor: not-allowed;
}

.manual-complete-action-wrap.is-disabled .manual-complete-action {
	pointer-events: none;
}

.manual-complete-action {
	width: 100%;
}

.manual-complete-card {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
	padding: 8px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 5px;
	background: #fff;
}

.manual-complete-card > div {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.manual-complete-card .manual-complete-reason {
	grid-column: 1 / -1;
	padding-bottom: 8px;
	border-bottom: 1px dashed var(--el-border-color-lighter);
}

.manual-complete-card .manual-complete-reason strong {
	overflow: visible;
	line-height: 1.45;
	text-overflow: clip;
	white-space: normal;
}

.manual-complete-card .manual-complete-meta strong {
	color: var(--el-text-color-regular);
	font-weight: 500;
}

.manual-complete-card span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.manual-complete-card strong {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-primary);
	font-size: 12px;
}

.fulfillment-dialog-summary strong.warning {
	color: var(--el-color-warning);
}

@media (max-width: 980px) {
	.fulfillment-dialog-summary {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.fulfillment-adjustment-grid {
		grid-template-columns: 1fr;
	}

	.fulfillment-adjustment-panel {
		min-height: 0;
	}
}

.fulfillment-log-section {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.fulfillment-log-table :deep(.el-table__cell) {
	padding: 7px 0;
}

.fulfillment-log-table :deep(.cell) {
	overflow: hidden;
}

.fulfillment-log-summary {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	max-width: 100%;
	height: 24px;
	line-height: 24px;
}

.fulfillment-log-summary > span:first-child {
	flex: 0 1 auto;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-primary);
}

.fulfillment-log-detail-chip {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 auto;
	min-width: 34px;
	height: 20px;
	padding: 0 7px;
	border: 1px solid var(--el-color-primary-light-5);
	border-radius: 10px;
	font-size: 12px;
	line-height: 18px;
	color: var(--el-color-primary);
	background: var(--el-color-primary-light-9);
	cursor: pointer;
}

.fulfillment-log-detail-chip:hover {
	border-color: var(--el-color-primary);
	background: var(--el-color-primary-light-8);
}

.fulfillment-log-popover {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.fulfillment-log-popover-title {
	font-size: 13px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.fulfillment-log-change-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.fulfillment-log-change-item {
	display: grid;
	grid-template-columns: 92px minmax(80px, 1fr) 18px minmax(80px, 1fr);
	align-items: start;
	gap: 6px;
	line-height: 18px;
	color: var(--el-text-color-regular);
}

.fulfillment-log-change-item .change-label {
	color: var(--el-text-color-secondary);
	white-space: nowrap;
}

.fulfillment-log-change-item .change-before {
	color: var(--el-text-color-placeholder);
	word-break: break-all;
}

.fulfillment-log-change-item .change-arrow {
	color: var(--el-text-color-placeholder);
	text-align: center;
}

.fulfillment-log-change-item .change-after {
	color: var(--el-text-color-primary);
	font-weight: 500;
	word-break: break-all;
}

.fulfillment-log-empty {
	color: var(--el-text-color-placeholder);
}

.purchase-flow-card {
	display: flex;
	flex-direction: column;
	gap: 11px;
	width: 100%;
	min-height: 248px;
	padding: 12px 14px;
	border: 1px solid var(--el-border-color-lighter);
	border-left: 3px solid var(--el-color-primary);
	background: #fff;
	box-sizing: border-box;
	color: inherit;
	text-align: left;
	cursor: default;
	transition:
		border-color 0.16s,
		background 0.16s,
		box-shadow 0.16s;
}

.purchase-flow-card:hover {
	border-color: var(--el-color-primary-light-5);
	box-shadow: inset 0 0 0 1px var(--el-color-primary-light-7);
}

.purchase-flow-card.empty {
	justify-content: center;
	border-left-color: var(--el-border-color);
	background: var(--el-fill-color-extra-light);
	cursor: default;
}

.purchase-flow-card-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-width: 0;
	padding-bottom: 2px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.purchase-flow-card-head > div {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.purchase-flow-card-head strong {
	min-width: 0;
	color: var(--el-text-color-primary);
	font-size: 14px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-flow-mini-map {
	position: relative;
	min-height: 178px;
	margin-top: 2px;
}

.purchase-flow-mini-lines {
	position: absolute;
	inset: 0;
	z-index: 0;
	width: 100%;
	height: 100%;
	overflow: visible;
	pointer-events: none;
}

.purchase-flow-mini-line {
	fill: none;
	stroke: var(--el-color-success);
	stroke-width: 1.6;
	marker-end: url("#purchase-flow-mini-arrow");
}

.purchase-flow-mini-lines marker path {
	fill: var(--el-color-success);
}

.purchase-flow-mini-line-label-bg {
	fill: rgba(255, 255, 255, 0.96);
	stroke: var(--el-border-color-extra-light);
	stroke-width: 1;
}

.purchase-flow-mini-line-label {
	fill: var(--el-text-color-secondary);
	font-size: 10px;
	text-anchor: middle;
}

.purchase-flow-mini-grid {
	position: relative;
	z-index: 1;
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	grid-template-rows: repeat(2, 76px);
	column-gap: 56px;
	row-gap: 26px;
	align-items: stretch;
}

.purchase-flow-mini-step {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	min-height: 76px;
	padding: 8px 9px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 4px;
	background: var(--el-fill-color-blank);
	box-sizing: border-box;
	box-shadow: 0 1px 2px rgb(31 45 61 / 5%);
}

.purchase-flow-mini-step::before {
	position: absolute;
	top: 12px;
	left: -5px;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--el-border-color);
	content: "";
}

.purchase-flow-mini-step.node-analysis {
	grid-column: 1;
	grid-row: 1;
}

.purchase-flow-mini-step.node-purchase_plan {
	grid-column: 2;
	grid-row: 1;
}

.purchase-flow-mini-step.node-purchase_order {
	grid-column: 3;
	grid-row: 1;
}

.purchase-flow-mini-step.node-shipment_plan {
	grid-column: 3;
	grid-row: 2;
}

.purchase-flow-mini-step.node-shipment_actual {
	grid-column: 2;
	grid-row: 2;
}

.purchase-flow-mini-step.node-fulfillment {
	grid-column: 1;
	grid-row: 2;
}

.purchase-flow-mini-step.done {
	border-color: var(--el-color-success-light-5);
	background: var(--el-color-success-light-9);
}

.purchase-flow-mini-step.done::before {
	background: var(--el-color-success);
}

.purchase-flow-mini-step.pending {
	border-color: var(--el-color-primary-light-5);
	background: var(--el-color-primary-light-9);
}

.purchase-flow-mini-step.pending::before {
	background: var(--el-color-primary);
}

.purchase-flow-mini-step.warning {
	border-color: var(--el-color-danger-light-5);
	background: var(--el-color-danger-light-9);
}

.purchase-flow-mini-step.warning::before {
	background: var(--el-color-danger);
}

.purchase-flow-mini-step.operator-missing {
	border-color: var(--el-color-warning-light-5);
	background: var(--el-color-warning-light-9);
}

.purchase-flow-mini-step.operator-missing::before {
	background: var(--el-color-warning);
}

.purchase-flow-mini-step.empty {
	color: var(--el-text-color-placeholder);
	background: var(--el-fill-color-extra-light);
}

.purchase-flow-mini-step-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-width: 0;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 1.2;
}

.purchase-flow-mini-step-top em,
.purchase-flow-mini-step-meta {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-flow-mini-step-top span {
	flex: none;
	color: var(--el-text-color-regular);
	font-weight: 600;
	white-space: nowrap;
}

.purchase-flow-mini-step-top em {
	flex: none;
	color: var(--el-text-color-placeholder);
	font-style: normal;
}

.purchase-flow-mini-step strong {
	color: var(--el-text-color-primary);
	font-size: 14px;
	line-height: 1.25;
	overflow: visible;
	text-overflow: initial;
	white-space: normal;
	word-break: keep-all;
}

.purchase-flow-mini-step-meta {
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 1.25;
}

.purchase-flow-card-text {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
}

.purchase-flow-card-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-top: auto;
	padding-top: 6px;
	border-top: 1px solid var(--el-border-color-extra-light);
	font-size: 12px;
	line-height: 1.3;
}

.purchase-flow-card-footer span {
	min-width: 0;
	color: var(--el-text-color-secondary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-flow-card-footer strong {
	flex: none;
	color: var(--el-color-primary);
	font-weight: 500;
}

.purchase-flow-card-action {
	flex: none;
	padding: 0;
	border: 0;
	background: transparent;
	color: var(--el-color-primary);
	font-size: 12px;
	font-weight: 600;
	line-height: 1.3;
	cursor: pointer;
}

.purchase-flow-card-action:hover {
	text-decoration: underline;
}

.purchase-flow-card-action.disabled,
.purchase-flow-card-action:disabled {
	color: var(--el-text-color-placeholder);
	cursor: not-allowed;
}

.purchase-flow-card-action.disabled:hover,
.purchase-flow-card-action:disabled:hover {
	text-decoration: none;
}

.purchase-flow-drawer-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	width: 100%;
}

.purchase-flow-drawer-title {
	color: var(--el-text-color-primary);
	font-size: 16px;
	font-weight: 700;
	line-height: 1.4;
}

.purchase-flow-drawer-subtitle {
	margin-top: 2px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.purchase-flow-drawer {
	display: flex;
	flex-direction: column;
	gap: 10px;
	height: calc(100vh - 86px);
	min-height: 520px;
	overflow: hidden;
}

.purchase-flow-drawer-wrap :deep(.el-drawer__body) {
	padding: 0 18px 16px;
	overflow: hidden;
}

.purchase-flow-overview {
	display: grid;
	grid-template-columns: repeat(6, minmax(0, 1fr));
	gap: 0;
	border: 1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-extra-light);
}

.purchase-flow-overview-item {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	padding: 8px 10px;
	border-right: 1px solid var(--el-border-color-lighter);
}

.purchase-flow-overview-item:last-child {
	border-right: 0;
}

.purchase-flow-overview-item span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.purchase-flow-overview-item strong {
	min-width: 0;
	color: var(--el-text-color-primary);
	font-size: 15px;
	font-variant-numeric: tabular-nums;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-flow-overview-item strong.positive {
	color: var(--el-color-success);
}

.purchase-flow-overview-item strong.negative {
	color: var(--el-color-danger);
}

.purchase-flow-workspace {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 380px;
	gap: 12px;
	align-items: stretch;
	min-height: 0;
	flex: 1;
}

.purchase-flow-board {
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
}

.purchase-flow-graph-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 8px 10px;
	border: 1px solid var(--el-border-color-lighter);
	background: #fff;
}

.purchase-flow-graph-title {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.purchase-flow-graph-title strong {
	color: var(--el-text-color-primary);
	font-size: 14px;
}

.purchase-flow-graph-title span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.purchase-flow-graph-actions {
	display: flex;
	flex: 0 0 auto;
	gap: 6px;
}

.purchase-flow-graph-shell {
	flex: 1;
	min-height: 560px;
	border: 1px solid var(--el-border-color-lighter);
	background:
		linear-gradient(var(--el-border-color-extra-light) 1px, transparent 1px),
		linear-gradient(90deg, var(--el-border-color-extra-light) 1px, transparent 1px), #fbfdff;
	background-size: 28px 28px;
	overflow: hidden;
	cursor: grab;
	user-select: none;
}

.purchase-flow-graph-shell:active {
	cursor: grabbing;
}

.purchase-flow-graph {
	width: 100%;
	height: 100%;
	color: var(--el-color-primary);
}

.purchase-flow-edge {
	fill: none;
	stroke: var(--el-color-primary);
	stroke-width: 2.4;
	stroke-linecap: round;
	stroke-linejoin: round;
}

.purchase-flow-edge-group.done .purchase-flow-edge {
	stroke: var(--el-color-success);
}

.purchase-flow-edge-group.warning .purchase-flow-edge {
	stroke: var(--el-color-danger);
}

.purchase-flow-edge-group.empty .purchase-flow-edge {
	stroke: var(--el-border-color);
	stroke-dasharray: 7 5;
}

.purchase-flow-edge-label-bg {
	fill: rgba(255, 255, 255, 0.94);
	stroke: var(--el-border-color-extra-light);
	stroke-width: 1;
}

.purchase-flow-edge-label {
	fill: var(--el-text-color-secondary);
	font-size: 12px;
	font-weight: 600;
	pointer-events: none;
}

.purchase-flow-svg-node {
	cursor: grab;
}

.purchase-flow-svg-node:active {
	cursor: grabbing;
}

.purchase-flow-svg-node-box {
	fill: #fff;
	stroke: var(--el-border-color);
	stroke-width: 1.4;
	filter: drop-shadow(0 5px 12px rgba(31, 45, 61, 0.08));
}

.purchase-flow-svg-node.active .purchase-flow-svg-node-box {
	stroke: var(--el-color-primary);
	stroke-width: 2.4;
}

.purchase-flow-svg-node.done .purchase-flow-svg-node-box {
	stroke: var(--el-color-success-light-5);
}

.purchase-flow-svg-node.warning .purchase-flow-svg-node-box {
	stroke: var(--el-color-danger-light-5);
}

.purchase-flow-svg-node.operator-missing .purchase-flow-svg-node-box {
	stroke: var(--el-color-warning-light-5);
}

.purchase-flow-svg-node-dot {
	fill: var(--el-border-color);
}

.purchase-flow-svg-node.done .purchase-flow-svg-node-dot {
	fill: var(--el-color-success);
}

.purchase-flow-svg-node.pending .purchase-flow-svg-node-dot {
	fill: var(--el-color-primary);
}

.purchase-flow-svg-node.warning .purchase-flow-svg-node-dot {
	fill: var(--el-color-danger);
}

.purchase-flow-svg-node.operator-missing .purchase-flow-svg-node-dot {
	fill: var(--el-color-warning);
}

.purchase-flow-svg-node-title {
	fill: var(--el-text-color-primary);
	font-size: 16px;
	font-weight: 700;
}

.purchase-flow-svg-node-status {
	fill: var(--el-text-color-regular);
	font-size: 14px;
	font-weight: 700;
}

.purchase-flow-svg-node-meta,
.purchase-flow-svg-node-user {
	fill: var(--el-text-color-secondary);
	font-size: 13px;
}

.purchase-flow-svg-node.operator-missing .purchase-flow-svg-node-meta {
	fill: var(--el-color-warning-dark-2);
	font-weight: 700;
}

.purchase-flow-node-panel {
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-width: 0;
	min-height: 0;
	max-height: 100%;
	padding: 12px;
	border: 1px solid var(--el-border-color-lighter);
	background: #fff;
	overflow-y: auto;
	overscroll-behavior: contain;
}

.purchase-flow-node-main {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding-bottom: 10px;
	border-bottom: 1px solid var(--el-border-color-extra-light);
}

.purchase-flow-node-panel-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 10px;
	flex-wrap: wrap;
}

.purchase-flow-node-panel-head div {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
}

.purchase-flow-node-panel-head span,
.purchase-flow-node-desc {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.5;
}

.purchase-flow-node-panel-head strong {
	color: var(--el-text-color-primary);
	font-size: 16px;
}

.purchase-flow-analysis-source-tag {
	margin-left: auto;
}

.purchase-flow-node-section {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.purchase-flow-node-section-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 700;
}

.purchase-flow-node-section-title em {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	font-style: normal;
	font-weight: 400;
}

.purchase-flow-node-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
}

.purchase-flow-node-kv {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
	padding: 8px;
	background: var(--el-fill-color-lighter);
	border: 1px solid var(--el-border-color-extra-light);
}

.purchase-flow-node-grid.detail {
	margin-bottom: 10px;
}

.purchase-flow-node-kv span,
.purchase-flow-node-kv em,
.purchase-flow-breakdown-item em,
.purchase-flow-record-item span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	font-style: normal;
	line-height: 1.35;
}

.purchase-flow-node-kv strong,
.purchase-flow-breakdown-item strong {
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-variant-numeric: tabular-nums;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-flow-breakdown-list,
.purchase-flow-record-list {
	display: flex;
	flex-direction: column;
	gap: 7px;
}

.purchase-flow-breakdown-item {
	display: grid;
	grid-template-columns: minmax(56px, 0.8fr) minmax(70px, 0.8fr) minmax(0, 1fr);
	gap: 6px;
	align-items: center;
	padding: 7px 8px;
	border: 1px solid var(--el-border-color-extra-light);
	background: var(--el-fill-color-lighter);
}

.purchase-flow-breakdown-item span {
	color: var(--el-text-color-regular);
	font-size: 12px;
	font-weight: 600;
}

.purchase-flow-record-item {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	gap: 6px;
	padding: 8px;
	border: 1px solid var(--el-border-color-extra-light);
	background: var(--el-fill-color-lighter);
}

.purchase-flow-record-item div {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.purchase-flow-record-item strong {
	color: var(--el-color-primary);
	font-size: 13px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-flow-record-item em {
	color: var(--el-text-color-primary);
	font-size: 12px;
	font-style: normal;
	line-height: 1.45;
}

.purchase-flow-node-collapse,
.purchase-flow-events-collapse {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 0;
}

.purchase-flow-node-collapse {
	margin-top: 2px;
}

.purchase-flow-node-collapse :deep(.el-collapse-item__header),
.purchase-flow-events-collapse :deep(.el-collapse-item__header) {
	padding: 0 12px;
	background: #fff;
	border-bottom-color: var(--el-border-color-extra-light);
}

.purchase-flow-node-collapse :deep(.el-collapse-item__content),
.purchase-flow-events-collapse :deep(.el-collapse-item__content) {
	padding: 12px;
}

.purchase-flow-collapse-title,
.purchase-flow-events-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	width: 100%;
	min-width: 0;
}

.purchase-flow-collapse-title strong,
.purchase-flow-events-title strong {
	color: var(--el-text-color-primary);
	font-size: 13px;
}

.purchase-flow-collapse-title span,
.purchase-flow-events-title span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.purchase-flow-collapse-block {
	margin-top: 10px;
}

.purchase-flow-demand-basis {
	margin: 10px 0;
	padding: 10px;
	border: 1px solid var(--el-border-color-light);
	background: #fff;
}

.purchase-flow-demand-basis-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 8px;
}

.purchase-flow-demand-basis-head strong {
	color: var(--el-text-color-primary);
	font-size: 14px;
	line-height: 1.35;
}

.purchase-flow-demand-basis-head span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.4;
	text-align: right;
}

.purchase-flow-demand-basis-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 7px;
}

.purchase-flow-demand-basis-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-width: 0;
	padding: 7px 8px;
	border: 1px solid var(--el-border-color-extra-light);
	background: var(--el-fill-color-lighter);
}

.purchase-flow-demand-basis-item span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
}

.purchase-flow-demand-basis-item strong {
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 700;
	font-variant-numeric: tabular-nums;
}

.purchase-flow-formula-panel {
	margin: 10px 0;
	padding: 12px;
	border: 1px solid var(--el-border-color-light);
	background: #fff;
}

.purchase-flow-formula-panel-head {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 8px;
}

.purchase-flow-formula-summary {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.purchase-flow-formula-summary strong {
	color: var(--el-text-color-primary);
	font-size: 14px;
	line-height: 1.35;
}

.purchase-flow-formula-summary span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.45;
	white-space: normal;
	word-break: normal;
	overflow-wrap: anywhere;
}

.purchase-flow-formula-actions {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: flex-start;
	gap: 6px;
	min-width: 0;
}

.purchase-flow-formula-steps {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-top: 10px;
}

.purchase-flow-formula-row {
	display: grid;
	grid-template-columns: 26px minmax(0, 1fr);
	gap: 9px;
	align-items: flex-start;
	padding: 9px 10px;
	border: 1px solid var(--el-border-color-extra-light);
	background: var(--el-fill-color-lighter);
}

.purchase-flow-formula-index {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	margin-top: 1px;
	border-radius: 50%;
	background: var(--el-color-primary-light-9);
	color: var(--el-color-primary);
	font-size: 12px;
	font-weight: 700;
	font-variant-numeric: tabular-nums;
}

.purchase-flow-formula-content {
	display: flex;
	flex-direction: column;
	gap: 5px;
	min-width: 0;
}

.purchase-flow-formula-expression {
	color: var(--el-text-color-regular);
	font-size: 13px;
	line-height: 1.55;
	word-break: break-word;
}

.purchase-flow-formula-result {
	align-self: flex-start;
	padding: 3px 7px;
	background: #fff;
	border: 1px solid var(--el-border-color-extra-light);
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.45;
}

.purchase-flow-formula-result strong {
	color: var(--el-color-primary);
	font-size: 13px;
	font-weight: 700;
}

.purchase-flow-coefficient-panel {
	margin: 10px 0;
	padding: 10px;
	border: 1px solid var(--el-border-color-light);
	background: #fff;
}

.purchase-flow-coefficient-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 8px;
}

.purchase-flow-coefficient-head strong {
	color: var(--el-text-color-primary);
	font-size: 14px;
	line-height: 1.35;
}

.purchase-flow-coefficient-head span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.4;
	text-align: right;
}

.purchase-flow-coefficient-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.purchase-flow-coefficient-row {
	display: flex;
	flex-direction: column;
	gap: 8px;
	align-items: stretch;
	padding: 8px;
	border: 1px solid var(--el-border-color-extra-light);
	border-radius: 6px;
	background: var(--el-fill-color-lighter);
}

.purchase-flow-coefficient-main {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	min-width: 0;
}

.purchase-flow-coefficient-main strong {
	flex: 0 0 34px;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 700;
	line-height: 1.35;
	text-align: center;
}

.purchase-flow-coefficient-formula {
	flex: 1;
	min-width: 0;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 1.4;
	word-break: break-word;
	overflow: hidden;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
}

.purchase-flow-coefficient-metrics {
	display: grid;
	grid-template-columns: repeat(4, minmax(50px, 1fr));
	gap: 5px;
	min-width: 0;
}

.purchase-flow-coefficient-metrics span {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
	padding: 5px 4px;
	border: 1px solid var(--el-border-color-extra-light);
	border-radius: 4px;
	background: #fff;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 1.25;
	text-align: center;
}

.purchase-flow-coefficient-metrics strong {
	color: var(--el-color-primary);
	font-size: 12px;
	font-variant-numeric: tabular-nums;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-flow-coefficient-tooltip {
	display: flex;
	flex-direction: column;
	gap: 4px;
	max-width: 420px;
	line-height: 1.5;
}

.purchase-flow-collapse-subtitle {
	margin-bottom: 8px;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 700;
}

.purchase-flow-selected-panel {
	display: grid;
	grid-template-columns: 190px minmax(0, 1fr);
	gap: 10px;
	padding: 10px;
	border: 1px solid var(--el-border-color-lighter);
	background: #fff;
}

.purchase-flow-selected-head {
	display: flex;
	flex-direction: column;
	gap: 6px;
	min-width: 0;
}

.purchase-flow-selected-head span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.purchase-flow-selected-head strong {
	color: var(--el-text-color-primary);
	font-size: 16px;
}

.purchase-flow-selected-list {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
}

.purchase-flow-selected-item {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
	padding: 7px 8px;
	background: var(--el-fill-color-lighter);
	border: 1px solid var(--el-border-color-extra-light);
}

.purchase-flow-selected-item span,
.purchase-flow-selected-item em {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	font-style: normal;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-flow-selected-item strong {
	color: var(--el-text-color-primary);
	font-size: 13px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-flow-content-grid {
	display: grid;
	grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
	gap: 14px;
	align-items: start;
}

.purchase-flow-panel {
	min-width: 0;
	padding: 12px;
	border: 1px solid var(--el-border-color-lighter);
	background: #fff;
}

.purchase-flow-panel.events {
	max-height: calc(100vh - 320px);
	overflow-y: auto;
}

.purchase-flow-event-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.purchase-flow-event {
	display: grid;
	grid-template-columns: 86px minmax(0, 1fr);
	gap: 8px;
	padding-bottom: 10px;
	border-bottom: 1px solid var(--el-border-color-extra-light);
}

.purchase-flow-event:last-child {
	padding-bottom: 0;
	border-bottom: 0;
}

.purchase-flow-event-time {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.45;
}

.purchase-flow-event-body {
	min-width: 0;
}

.purchase-flow-event-title {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.purchase-flow-event-title strong {
	color: var(--el-text-color-primary);
	font-size: 13px;
}

.purchase-flow-event-title span:last-child {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.purchase-flow-event-desc,
.purchase-flow-event-user {
	margin-top: 4px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.4;
}

.purchase-flow-detail-block {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-top: 12px;
}

.purchase-flow-detail-block:first-of-type {
	margin-top: 0;
}

.purchase-flow-detail-title {
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 700;
}

.purchase-flow-plan-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.purchase-flow-plan-item {
	display: grid;
	grid-template-columns: minmax(110px, 1fr) auto auto auto;
	gap: 8px;
	align-items: center;
	padding: 7px 8px;
	border: 1px solid var(--el-border-color-extra-light);
	background: var(--el-fill-color-lighter);
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.purchase-flow-plan-item strong {
	color: var(--el-color-primary);
	font-size: 13px;
}

.purchase-flow-table {
	width: 100%;
}

.purchase-order-summary-cell {
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	gap: 7px;
	min-width: 0;
	min-height: 118px;
	padding: 8px 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-left: 3px solid var(--el-color-success);
	background: #fff;
	box-sizing: border-box;
}

.purchase-order-summary-cell.active {
	border-color: var(--el-border-color-lighter);
	border-left-color: var(--el-color-success);
	background: #fff;
}

.purchase-order-summary-cell.logistics.active {
	border-color: var(--el-border-color-lighter);
	border-left-color: var(--el-color-primary);
	background: #fff;
}

.purchase-order-summary-cell.shipment.active {
	border-color: var(--el-border-color-lighter);
	border-left-color: var(--el-color-warning);
	background: #fff;
}

.purchase-order-summary-cell.order-fulfillment.active {
	border-color: var(--el-border-color-light);
	border-left-color: var(--el-color-success);
	background: linear-gradient(90deg, var(--el-color-success-light-9), #fff 42%);
}

.purchase-order-summary-cell.empty {
	border-color: var(--el-border-color-lighter);
	border-left-color: var(--el-border-color);
	background: var(--el-fill-color-extra-light);
}

.purchase-order-summary-cell.logistics.empty {
	border-color: var(--el-border-color-lighter);
	border-left-color: var(--el-border-color);
	background: var(--el-fill-color-extra-light);
}

.purchase-order-summary-cell.shipment.empty {
	border-color: var(--el-border-color-lighter);
	border-left-color: var(--el-border-color);
	background: var(--el-fill-color-extra-light);
}

.purchase-order-summary-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: nowrap;
	gap: 4px 6px;
	min-height: 20px;
}

.purchase-order-summary-main {
	flex: 0 0 auto;
	font-size: 13px;
	font-weight: 700;
	color: var(--el-text-color-primary);
	line-height: 1.4;
	white-space: nowrap;
}

.purchase-order-summary-head .el-tag {
	flex: 0 0 auto;
}

.purchase-order-summary-meta {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: flex-end;
	flex: 1 1 0;
	gap: 4px 6px;
	min-width: 0;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
}

.purchase-order-summary-meta span {
	white-space: nowrap;
}

.purchase-order-summary-meta .status-prefix {
	color: var(--el-text-color-placeholder);
	font-size: 11px;
}

.purchase-order-context-line {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
	white-space: nowrap;
}

.purchase-order-context-line span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
}

.purchase-order-queue-line {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 5px 7px;
	border: 1px solid var(--el-border-color-extra-light);
	background: rgba(255, 255, 255, 0.78);
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
	cursor: help;
}

.purchase-order-queue-main {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	white-space: nowrap;
}

.purchase-order-queue-main strong {
	color: var(--el-text-color-primary);
	font-weight: 700;
	font-variant-numeric: tabular-nums;
}

.purchase-order-queue-main > span:last-child {
	color: var(--el-text-color-secondary);
}

.purchase-order-queue-detail {
	min-width: 0;
	overflow: hidden;
	color: var(--el-text-color-secondary);
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-order-summary-metrics {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 4px 12px;
	padding: 6px 8px;
	background: var(--el-fill-color-lighter);
	border: 1px solid var(--el-border-color-extra-light);
}

.purchase-order-summary-metrics.compact {
	grid-template-columns: repeat(2, minmax(0, 1fr));
}

.purchase-order-summary-metrics.fulfillment {
	display: grid;
	grid-template-columns: repeat(2, minmax(104px, 1fr));
	gap: 4px 14px;
	background: rgba(255, 255, 255, 0.72);
}

.purchase-order-metric {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr);
	align-items: center;
	gap: 6px;
	min-width: 0;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.4;
}

.purchase-order-metric.emphasized {
	color: var(--el-text-color-secondary);
}

.purchase-order-metric.abnormal {
	color: var(--el-text-color-regular);
}

.purchase-order-metric strong {
	min-width: 0;
	color: var(--el-text-color-primary);
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	overflow: hidden;
	text-overflow: ellipsis;
	text-align: right;
	white-space: nowrap;
}

.purchase-order-metric strong.positive,
.shipment-diff.positive {
	color: var(--el-color-success);
}

.purchase-order-metric strong.negative,
.shipment-diff.negative {
	color: var(--el-color-danger);
}

.purchase-order-metric strong.muted {
	color: var(--el-text-color-placeholder);
	font-weight: 500;
}

.metric-label-wrap,
.metric-value-wrap {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	min-width: 0;
	overflow: hidden;
}

.metric-label-wrap {
	justify-content: flex-start;
}

.metric-label-wrap .metric-help {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.metric-value-wrap {
	justify-content: flex-end;
}

.metric-value-wrap strong {
	flex: 0 1 auto;
}

.metric-status-pill {
	flex: 0 0 auto;
	padding: 0 3px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 3px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-secondary);
	font-size: 10px;
	font-weight: 500;
	line-height: 14px;
	white-space: nowrap;
}

.metric-status-pill.is-success {
	border-color: var(--el-color-success-light-5);
	background: var(--el-color-success-light-9);
	color: var(--el-color-success);
}

.metric-status-pill.is-danger {
	border-color: var(--el-color-danger-light-5);
	background: var(--el-color-danger-light-9);
	color: var(--el-color-danger);
}

.metric-status-pill.is-warning {
	border-color: var(--el-color-warning-light-5);
	background: var(--el-color-warning-light-9);
	color: var(--el-color-warning);
}

.metric-help {
	cursor: help;
	text-decoration: underline dotted var(--el-border-color);
	text-underline-offset: 3px;
}

.purchase-order-logistics-main {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	min-height: 30px;
	padding: 6px 0;
}

.purchase-order-logistics-actions {
	display: flex;
	align-items: center;
	gap: 8px;
	min-height: 22px;
	margin-top: -4px;
}

.purchase-order-logistics-count {
	color: var(--el-text-color-primary);
	font-size: 12px;
	font-weight: 600;
	white-space: nowrap;
}

.purchase-order-logistics-preview {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	margin: 2px 0 6px;
	border: 1px solid var(--el-border-color-extra-light);
	background: rgba(255, 255, 255, 0.72);
}

.purchase-order-logistics-preview-head,
.purchase-order-logistics-preview-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 62px minmax(0, 0.76fr);
	gap: 6px;
	align-items: center;
	min-width: 0;
}

.purchase-order-logistics-preview-head {
	padding: 5px 7px 3px;
	color: var(--el-text-color-placeholder);
	font-size: 11px;
	line-height: 1.2;
	border-bottom: 1px solid var(--el-border-color-extra-light);
}

.purchase-order-logistics-preview-body {
	display: flex;
	flex-direction: column;
	gap: 2px;
	max-height: 94px;
	padding: 3px 5px 5px;
	overflow-x: hidden;
	overflow-y: auto;
	overscroll-behavior: contain;
	scrollbar-color: var(--el-border-color) transparent;
	scrollbar-width: thin;
}

.purchase-order-logistics-preview-body::-webkit-scrollbar {
	width: 5px;
	height: 5px;
}

.purchase-order-logistics-preview-body::-webkit-scrollbar-track {
	background: transparent;
}

.purchase-order-logistics-preview-body::-webkit-scrollbar-thumb {
	border-radius: 999px;
	background: transparent;
}

.purchase-order-logistics-preview:hover
	.purchase-order-logistics-preview-body::-webkit-scrollbar-thumb {
	background: var(--el-border-color);
}

.purchase-order-logistics-preview-row {
	min-height: 24px;
	padding: 2px 2px;
	color: var(--el-text-color-regular);
	font-size: 12px;
	line-height: 1.25;
	overflow: hidden;
}

.purchase-order-logistics-preview-row + .purchase-order-logistics-preview-row {
	border-top: 1px dashed var(--el-border-color-extra-light);
}

.logistics-preview-sn,
.logistics-preview-company {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.logistics-preview-company {
	display: inline-flex;
	align-items: center;
	gap: 4px;
}

.logistics-source-reference {
	cursor: pointer;

	:deep(.el-tag) {
		transition:
			border-color 0.16s,
			background 0.16s,
			color 0.16s;
	}

	&:hover :deep(.el-tag) {
		border-color: var(--el-color-primary);
		background: var(--el-color-primary-light-9);
		color: var(--el-color-primary);
	}
}

.purchase-order-logistics-preview-row :deep(.el-tag) {
	max-width: 100%;
	padding: 0 6px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-order-logistics-empty {
	margin: 2px 0 6px;
	padding: 8px;
	border: 1px dashed var(--el-border-color-extra-light);
	background: var(--el-fill-color-extra-light);
	color: var(--el-text-color-placeholder);
	font-size: 12px;
	line-height: 1.35;
}

.purchase-order-hover-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: auto;
	padding-top: 4px;
	border-top: 1px solid var(--el-border-color-extra-light);
}

.purchase-order-hover-trigger {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	height: 22px;
	padding: 0 7px;
	border: 1px solid var(--el-border-color);
	background: #fff;
	color: var(--el-color-primary);
	font-family: inherit;
	font-size: 12px;
	line-height: 20px;
	cursor: pointer;
	user-select: none;
	transition:
		border-color 0.16s,
		background 0.16s,
		color 0.16s;
}

.purchase-order-hover-trigger:hover {
	border-color: var(--el-color-primary);
	background: var(--el-color-primary-light-9);
}

.purchase-order-hover-mark {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: currentColor;
}

.purchase-order-summary-foot,
.purchase-order-empty-sub {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.4;
}

.purchase-order-summary-foot {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-order-empty-title {
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.purchase-order-detail {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.purchase-order-detail-title {
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.purchase-order-detail-summary {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	padding: 8px 10px;
	background: var(--el-fill-color-lighter);
	border: 1px solid var(--el-border-color-lighter);
	color: var(--el-text-color-regular);
	font-size: 12px;
}

.purchase-order-option-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	max-height: 420px;
	overflow-y: auto;
}

.purchase-order-option {
	width: 100%;
	padding: 9px 10px;
	border: 1px solid var(--el-border-color-lighter);
	background: #fff;
	text-align: left;
	cursor: pointer;
	transition:
		border-color 0.16s,
		background 0.16s,
		box-shadow 0.16s;
}

.purchase-order-option:hover {
	border-color: var(--el-color-primary-light-5);
	background: var(--el-color-primary-light-9);
}

.purchase-order-option.active {
	border-color: var(--el-color-primary);
	background: var(--el-color-primary-light-9);
	box-shadow: inset 3px 0 0 var(--el-color-primary);
}

.purchase-order-option.excluded {
	color: var(--el-text-color-secondary);
	background: var(--el-fill-color-lighter);
}

.purchase-order-option.manual-completed {
	border-color: var(--el-color-warning-light-6);
	background: #fffaf2;
}

.purchase-order-option.manual-completed .purchase-order-option-sn {
	color: var(--el-color-warning-dark-2);
}

.purchase-order-option.disabled {
	cursor: not-allowed;
	opacity: 0.68;
}

.purchase-order-option.disabled:hover {
	border-color: var(--el-border-color-lighter);
	background: var(--el-fill-color-lighter);
}

.purchase-order-option-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 6px;
	min-width: 0;
}

.purchase-order-option-sn {
	flex: 1 1 auto;
	min-width: 0;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 700;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-order-option-statuses {
	display: inline-flex;
	flex: 0 0 auto;
	flex-wrap: wrap;
	align-items: center;
	justify-content: flex-end;
	gap: 4px 6px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
}

.purchase-order-option-statuses .status-prefix {
	color: var(--el-text-color-placeholder);
	font-size: 11px;
}

.purchase-order-option-context,
.purchase-order-option-plan-meta {
	margin-top: 5px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
}

.purchase-order-option-context {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 6px;
}

.purchase-order-option-context span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-order-option-plan-meta {
	display: -webkit-box;
	overflow: hidden;
	color: var(--el-text-color-regular);
	-webkit-line-clamp: 1;
	-webkit-box-orient: vertical;
}

.purchase-order-option-metrics {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 4px 10px;
	margin-top: 7px;
	padding: 6px 8px;
	border: 1px solid var(--el-border-color-extra-light);
	background: rgba(255, 255, 255, 0.72);
}

.purchase-order-option-metric {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr);
	align-items: center;
	gap: 6px;
	min-width: 0;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
}

.purchase-order-option-metric strong {
	min-width: 0;
	color: var(--el-text-color-primary);
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	overflow: hidden;
	text-align: right;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.purchase-order-option-metric strong.positive {
	color: var(--el-color-success);
}

.purchase-order-option-metric strong.negative {
	color: var(--el-color-danger);
}

.shipment-detail-table {
	width: 100%;
}

.shipment-table-product {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.shipment-table-image {
	flex: 0 0 auto;
	width: 42px;
	height: 42px;
	border: 1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-extra-light);
	box-sizing: border-box;
	cursor: zoom-in;
}

.shipment-table-image.empty {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: var(--el-text-color-placeholder);
	font-size: 12px;
	cursor: default;
}

.shipment-image-preview-wrap {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 220px;
	height: 220px;
	background: #fff;
}

.shipment-image-preview {
	width: 220px;
	height: 220px;
	cursor: zoom-in;
}

.shipment-table-product-info,
.shipment-table-stack {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.35;
}

.shipment-table-stack.strong {
	color: var(--el-text-color-regular);
	font-weight: 600;
}

.shipment-table-product-name,
.shipment-table-sn {
	color: var(--el-text-color-primary);
	font-weight: 700;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.shipment-table-product-meta {
	color: var(--el-text-color-secondary);
}

.shipment-field-row {
	display: grid;
	grid-template-columns: 62px minmax(0, 1fr);
	align-items: start;
	gap: 6px;
	min-width: 0;
}

.shipment-field-label {
	color: var(--el-text-color-placeholder);
	font-weight: 400;
	white-space: nowrap;
}

.shipment-field-value {
	min-width: 0;
	color: var(--el-text-color-regular);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.shipment-table-qty {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.shipment-table-qty div {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 4px;
	padding: 4px 6px;
	background: var(--el-fill-color-lighter);
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.2;
}

.shipment-table-qty strong {
	color: var(--el-text-color-primary);
	font-variant-numeric: tabular-nums;
}

.shipment-diff {
	font-weight: 600;
	font-variant-numeric: tabular-nums;
}

.purchase-order-status-cell {
	display: inline-flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 4px;
}

.purchase-order-count-state {
	color: var(--el-color-success);
	font-size: 12px;
	white-space: nowrap;
}

.purchase-order-count-state.excluded {
	color: var(--el-text-color-secondary);
}

.purchase-order-detail :deep(.purchase-order-row-excluded) {
	color: var(--el-text-color-secondary);
	background: var(--el-fill-color-lighter);
}

.purchase-order-detail :deep(.purchase-order-row-excluded td) {
	background: var(--el-fill-color-lighter) !important;
}

.detail-order-summary {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	padding: 10px 12px;
	background: var(--el-fill-color-lighter);
	border: 1px solid var(--el-border-color-lighter);
	color: var(--el-text-color-regular);
	font-size: 12px;
}

.logistics-drawer-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	padding-right: 20px;
	font-size: 16px;
	font-weight: 600;
	color: var(--el-text-color-primary);
	box-sizing: border-box;
}

.logistics-content {
	padding-right: 6px;
}

.logistics-collapse {
	border-top: 0;
	border-bottom: 0;
}

.logistics-content :deep(.el-collapse-item__header) {
	height: auto;
	line-height: 1.4;
	padding: 12px 0;
	align-items: flex-start;
}

.logistics-collapse-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	width: 100%;
	padding-right: 12px;
	box-sizing: border-box;
}

.logistics-collapse-main {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.logistics-company {
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.logistics-source-trigger {
	width: fit-content;
	height: 22px;
	padding: 0 8px;
	border: 1px solid var(--el-border-color);
	border-radius: 4px;
	background: #fff;
	color: var(--el-color-primary);
	font-size: 12px;
	line-height: 20px;
	cursor: pointer;
	transition:
		border-color 0.16s,
		background 0.16s,
		color 0.16s;

	&:hover {
		border-color: var(--el-color-primary);
		background: var(--el-color-primary-light-9);
	}
}

.logistics-order-no,
.logistics-meta-row {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.logistics-query-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	margin: 8px 0;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.logistics-query-next {
	color: var(--el-text-color-secondary);
}

.logistics-action-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	margin: 8px 0 10px;
}

.logistics-source-list {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin: 6px 0 8px;
	padding: 8px;
	border: 1px solid var(--el-border-color-extra-light);
	background: var(--el-fill-color-extra-light);
}

.logistics-source-title {
	display: flex;
	align-items: baseline;
	flex-wrap: wrap;
	gap: 8px;
	margin-bottom: 4px;

	span {
		color: var(--el-text-color-primary);
		font-weight: 600;
	}

	small {
		color: var(--el-text-color-secondary);
	}
}

.logistics-source-item {
	display: grid;
	grid-template-columns: 24px minmax(0, 1fr);
	gap: 8px;
	font-size: 12px;
	line-height: 1.45;

	.source-index {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #fff;
		color: var(--el-color-primary);
		font-weight: 650;
	}

	.source-main {
		min-width: 0;
	}

	.source-company-line {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}

	.source-company {
		color: var(--el-text-color-primary);
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.source-fields {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 4px;
		color: var(--el-text-color-secondary);
		font-family: Monaco, Consolas, monospace;
	}
}

.logistics-timeline {
	padding-top: 8px;
}

.shelf-selection {
	display: flex;
	flex-direction: column;
	gap: 12px;
	max-height: 68vh;
	overflow: hidden;
}

.shelf-selection-header {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 12px;
	background: var(--el-fill-color-extra-light);
	border: 1px solid var(--el-border-color-lighter);
}

.shelf-selection-summary {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
}

.shelf-selection-summary-main {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px 12px;
	color: var(--el-text-color-primary);
	font-weight: 700;
	line-height: 1.5;
}

.shelf-selection-summary-main b {
	color: var(--el-color-primary);
	font-weight: 700;
}

.shelf-selection-summary-sub {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.45;
}

.shelf-selection-summary-warning {
	color: var(--el-color-warning-dark-2);
	font-size: 12px;
	line-height: 1.45;
}

.shelf-selection-control-panel {
	display: flex;
	flex-direction: column;
	gap: 0;
	overflow: hidden;
	background: #fff;
	border: 1px solid var(--el-border-color-light);
	border-radius: 6px;
}

.shelf-selection-control-row {
	display: grid;
	grid-template-columns: minmax(190px, 1fr) auto;
	align-items: center;
	gap: 16px;
	padding: 10px 12px;
}

.shelf-selection-control-row + .shelf-selection-control-row {
	border-top: 1px solid var(--el-border-color-extra-light);
}

.shelf-selection-control-copy {
	min-width: 0;
}

.shelf-selection-control-title {
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 700;
	line-height: 1.4;
}

.shelf-selection-control-desc {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.45;
}

.shelf-selection-batch-buttons {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 8px;
}

.shelf-selection-batch-buttons .el-button + .el-button {
	margin-left: 0;
}

@media (max-width: 760px) {
	.shelf-selection-control-row {
		grid-template-columns: 1fr;
		align-items: flex-start;
		gap: 8px;
	}

	.shelf-selection-batch-buttons {
		justify-content: flex-start;
	}
}

.shelf-selection-products {
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-height: 220px;
	overflow: auto;
	padding-right: 4px;
}

.shelf-selection-product {
	border: 1px solid var(--el-border-color-light);
	background: #fff;
}

.shelf-selection-product-header {
	display: grid;
	grid-template-columns: auto 52px minmax(0, 1fr) auto auto;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
	background: var(--el-fill-color-blank);
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.shelf-selection-product-image {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 52px;
	height: 52px;
	overflow: hidden;
	color: var(--el-text-color-placeholder);
	font-size: 12px;
	background: var(--el-fill-color-light);
	border: 1px solid var(--el-border-color-lighter);
}

.shelf-selection-product-image .el-image {
	width: 100%;
	height: 100%;
}

.shelf-selection-product-main {
	display: flex;
	flex-direction: column;
	gap: 5px;
	min-width: 0;
}

.shelf-selection-product-title {
	color: var(--el-text-color-primary);
	font-weight: 700;
	line-height: 1.35;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.shelf-selection-product-meta,
.shelf-selection-product-counts,
.shelf-selection-order-metrics {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px 12px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.4;
}

.shelf-selection-product-counts {
	justify-content: flex-end;
	min-width: 220px;
}

.shelf-selection-order-list {
	display: flex;
	flex-direction: column;
}

.shelf-selection-order {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr);
	gap: 10px;
	padding: 10px 12px;
	border-top: 1px solid var(--el-border-color-extra-light);
}

.shelf-selection-order:first-child {
	border-top: 0;
}

.shelf-selection-order.is-current-matched {
	background: #f6ffed;
}

.shelf-selection-order.is-disabled {
	background: var(--el-fill-color-extra-light);
}

.shelf-selection-order-main {
	display: flex;
	flex-direction: column;
	gap: 7px;
	min-width: 0;
}

.shelf-selection-order-top {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
}

.shelf-selection-order-sn {
	color: var(--el-color-primary);
	font-weight: 700;
}

.shelf-selection-order-reason {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.shelf-selection-order-plans {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.4;
}

.shelf-selection-order-plans-label {
	color: var(--el-text-color-regular);
	font-weight: 600;
}

.shelf-selection-order-plan-more {
	color: var(--el-text-color-secondary);
}

.shelf-selection-remark {
	flex: 0 0 auto;
}

.shelf-selection-footer {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.shelf-selection-footer-tip {
	flex: 1 1 360px;
	min-width: 0;
	line-height: 1.45;
}

.trace-remark {
	line-height: 1.5;
	color: var(--el-text-color-regular);
	white-space: pre-wrap;
	word-break: break-word;
}

.logistics-popover-trace {
	max-width: 100%;
	overflow: hidden;
	color: var(--el-text-color-regular);
	text-overflow: ellipsis;
	white-space: nowrap;
}

.logistics-popover-company {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;

	span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}
</style>

<style lang="scss">
.purchase-plan-popover {
	padding: 8px !important;
}

.purchase-order-logistics-popover {
	padding: 10px !important;
}

.shipment-image-popover {
	padding: 10px !important;
}

.shipment-product-name-tooltip {
	max-width: 520px;
	line-height: 1.5;
	word-break: break-word;
}

.metric-source-tooltip {
	max-width: 360px;
	line-height: 1.55;
	white-space: pre-line;
	word-break: break-word;
}

.metric-source-popover.el-popover {
	padding: 0 !important;
	border-color: var(--el-border-color-light);
	box-shadow: 0 10px 24px rgba(31, 45, 61, 0.12);
}

.metric-source-card {
	padding: 10px 12px;
	color: var(--el-text-color-regular);
	font-size: 12px;
	line-height: 1.55;
}

.metric-source-title {
	margin-bottom: 5px;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 700;
}

.metric-source-line {
	margin-top: 2px;
	white-space: normal;
	word-break: break-word;
}

.metric-source-note {
	margin-top: 7px;
	padding-top: 7px;
	border-top: 1px solid var(--el-border-color-extra-light);
	color: var(--el-color-warning-dark-2);
}

.purchase-flow-detail-tooltip {
	max-width: 420px;
	line-height: 1.55;
	word-break: break-word;
}

.purchase-order-logistics-popover .purchase-order-detail {
	gap: 8px;
}

.purchase-order-logistics-popover .purchase-order-detail-summary {
	padding: 7px 9px;
}

.purchase-order-logistics-popover .logistics-popover-table {
	width: 100%;
}

.purchase-order-logistics-popover .el-table__cell {
	padding: 6px 0;
}
</style>
