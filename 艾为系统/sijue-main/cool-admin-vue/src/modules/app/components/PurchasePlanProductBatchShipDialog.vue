<template>
	<el-dialog
		v-model="dialogVisible"
		width="1500px"
		top="2px"
		class="purchase-plan-batch-ship-dialog"
		header-class="purchase-plan-batch-ship-dialog-header"
		body-class="purchase-plan-batch-ship-dialog-body"
		footer-class="purchase-plan-batch-ship-dialog-footer"
		:close-on-click-modal="false"
		:before-close="handleBeforeClose"
	>
		<template #header>
			<div class="batch-dialog-header">
				<span class="header-title">批量发货分析</span>
				<el-tag type="info" size="small" effect="plain" round>
					共 {{ targetStockSummary.productCount }} 个产品 /
					{{ targetStockSummary.orderCount }} 单
				</el-tag>
				<el-tag type="success" size="small" effect="light" round>
					总可发 {{ formatNumber(batchSummary.actualShippableQty) }}
				</el-tag>
				<el-tag type="warning" size="small" effect="light" round>
					本次 {{ formatNumber(batchSummary.shipQty) }}
				</el-tag>
				<el-tag v-if="loadingAny" type="warning" size="small" round>
					<el-icon class="is-loading"><loading-icon /></el-icon>
					刷新数据中
				</el-tag>
				<el-tag v-if="batchShipReviewNo" type="primary" size="small" effect="plain" round>
					审核单 {{ batchShipReviewNo }}
				</el-tag>
			</div>
		</template>

		<div class="batch-ship-content">
			<div class="batch-toolbar">
				<purchase-plan-product-ship-date-picker
					:target-days="globalDefaultTargetDays"
					:shipping-buffer="shippingBuffer"
					:shipping-methods="shippingMethods"
					:selected-methods="globalSelectedShippingMethods"
					:shipping-profile="globalShippingProfile"
					:shipping-profiles="shippingProfileOptions"
					:shipping-config-readonly="currentShippingProfile.readonly"
					:target-mode="targetPeriodMode"
					:disabled="calculating || loadingAny"
					@update:target-days="handleGlobalTargetDaysChange"
					@update:shipping-buffer="handleGlobalShippingBufferChange"
					@target-mode-change="handleTargetPeriodModeChange"
					@shipping-change="handleGlobalShippingMethodsChange"
					@shipping-profile-change="onGlobalShippingProfileChange"
					@shipping-method-days-change="handleShippingMethodDaysChange"
				/>

				<div class="global-algo-row">
					<div class="global-algo-head">
						<span class="global-algo-title">计算方式</span>
						<span class="global-algo-hint">目标库存推演</span>
					</div>
					<div class="global-algo-body">
						<el-select
							v-model="globalAlgo"
							size="small"
							class="global-algo-select"
							:disabled="loadingAny"
							@change="applyGlobalAlgo"
						>
							<el-option label="日均销量" value="daily_avg" />
							<el-option label="历史销量" value="history" />
							<el-option label="搜索词趋势" value="trend" />
							<el-option label="综合走势" value="combined" />
							<el-option label="运营意向" value="operator_intent" />
						</el-select>
						<el-button
							type="primary"
							:icon="Refresh"
							:loading="calculating"
							:disabled="loadingAny"
							@click="calculateItems(dialogItems, false)"
						>
							按目标库存推演
						</el-button>
					</div>
				</div>
			</div>

			<div
				v-if="dataSyncNotice"
				class="data-sync-notice"
				:class="`is-${dataSyncNotice.status}`"
			>
				<div class="data-sync-main">
					<el-icon v-if="dataSyncNotice.status === 'syncing'" class="is-loading">
						<loading-icon />
					</el-icon>
					<el-icon v-else-if="dataSyncNotice.status === 'success'"><check /></el-icon>
					<el-icon v-else><warning /></el-icon>
					<div>
						<div class="data-sync-title">{{ dataSyncNotice.message }}</div>
						<div class="data-sync-sub">
							<span v-for="section in dataSyncSections" :key="section.scope">
								{{ section.label }} {{ section.successCount }}/{{ section.total }}
								<em v-if="section.failedCount">失败 {{ section.failedCount }}</em>
							</span>
						</div>
					</div>
				</div>
				<div class="data-sync-actions">
					<el-popover
						v-if="failedDataSyncItems.length"
						placement="bottom-end"
						:width="520"
						trigger="hover"
						popper-class="data-sync-popover"
					>
						<template #reference>
							<el-button size="small" type="warning" plain>查看失败原因</el-button>
						</template>
						<div class="data-sync-fail-panel">
							<div class="data-sync-fail-title">未完成刷新项</div>
							<div class="data-sync-fail-list">
								<div
									v-for="item in failedDataSyncItems"
									:key="`${item.scope}_${item.key}`"
									class="data-sync-fail-row"
								>
									<strong>{{ item.scopeLabel }} · {{ item.label }}</strong>
									<span>{{ item.message }}</span>
								</div>
							</div>
						</div>
					</el-popover>
					<el-button
						v-if="canRetryDataSync"
						size="small"
						type="warning"
						plain
						:icon="Refresh"
						@click="retryFailedDataSync"
					>
						继续刷新未完成项
					</el-button>
					<el-button
						v-if="!dataSyncBlocking"
						size="small"
						text
						@click="dismissDataSyncNotice"
					>
						关闭
					</el-button>
				</div>
			</div>

			<div class="batch-items-scroll">
				<div
					v-for="(item, idx) in dialogItems"
					:key="item._batchId"
					class="batch-item-card"
					:class="{
						'card-warn': item.remainingGap > 0,
						'card-ok': item.calculated && item.remainingGap <= 0
					}"
				>
					<div class="item-product">
						<div class="item-product-main">
							<div class="item-index">{{ idx + 1 }}</div>
							<div class="item-image">
								<el-image
									v-if="item.image_url_display"
									:src="item.image_url_display"
									fit="contain"
									class="item-img"
									:preview-src-list="[item.image_url_display]"
									preview-teleported
								/>
								<div v-else class="img-placeholder">
									<el-icon :size="24"><picture-icon /></el-icon>
								</div>
							</div>
							<div class="item-info">
								<el-tooltip
									:content="item.product_name || '-'"
									placement="top-start"
									:show-after="220"
								>
									<div class="item-name">{{ item.product_name || "-" }}</div>
								</el-tooltip>
								<div class="item-meta">
									<el-tag size="small" type="info" effect="plain">{{
										item.asin || "-"
									}}</el-tag>
									<span>MSKU: {{ item.msku || "-" }}</span>
									<span>{{ item.seller_name || "-" }}</span>
								</div>
								<button
									class="item-trace-entry"
									type="button"
									:disabled="
										item._replenishTraceLoading ||
										!hasItemReplenishTraceIdentity(item)
									"
									@click.stop="openReplenishTraceDrawer(item)"
								>
									<span>
										<el-icon
											v-if="item._replenishTraceLoading"
											class="is-loading"
											><loading-icon
										/></el-icon>
										<el-icon v-else><data-analysis /></el-icon>
										补货依据
									</span>
									<strong>{{ getItemReplenishTraceSummary(item) }}</strong>
								</button>
								<button
									class="item-history-entry"
									type="button"
									:disabled="item._shipHistoryLoading"
									@click.stop="openShipHistoryDrawer(item)"
								>
									<span>
										<el-icon v-if="item._shipHistoryLoading" class="is-loading"
											><loading-icon
										/></el-icon>
										<el-icon v-else><data-analysis /></el-icon>
										发货历史
									</span>
									<strong>{{ getItemShipHistorySummary(item) }}</strong>
									<div
										v-if="getItemShipHistoryMethodChips(item).length"
										class="item-history-methods"
									>
										<em
											v-for="method in getItemShipHistoryMethodChips(item)"
											:key="method.method_key"
										>
											{{ getShippingMethodInfo(method.method_key)?.icon }}
											{{ method.method_label }}
											{{
												formatNumber(
													method.success_qty || method.planned_qty
												)
											}}
										</em>
									</div>
								</button>
							</div>
						</div>

						<div class="item-ship-basis">
							<div class="basis-summary-grid">
								<div class="basis-summary-cell">
									<span>目标库存</span>
									<strong>{{ formatEffectiveTargetStockDays(item) }}</strong>
								</div>
								<div class="basis-summary-cell">
									<span>预计消耗</span>
									<strong>{{ formatNumber(item.totalDemand) }}</strong>
								</div>
								<el-tooltip
									:content="getShipGapFormulaText(item)"
									placement="top"
									:show-after="220"
								>
									<div class="basis-summary-cell is-gap">
										<span>缺口</span>
										<strong>{{ formatNumber(item.pureGap) }}</strong>
									</div>
								</el-tooltip>
								<el-tooltip
									:content="getShipQtyFormulaText(item)"
									placement="top"
									:show-after="220"
								>
									<div class="basis-summary-cell is-actual">
										<span>本次发货</span>
										<strong>{{ formatNumber(item.shipQty) }}</strong>
									</div>
								</el-tooltip>
							</div>
							<div class="basis-control-block">
								<div class="basis-algo-row">
									<el-popover
										trigger="hover"
										:width="390"
										placement="bottom-start"
										:show-after="260"
										:hide-after="120"
										:teleported="true"
										popper-class="batch-ship-trend-popover"
										:fallback-placements="[
											'top-start',
											'right-start',
											'bottom-start'
										]"
									>
										<template #reference>
											<button type="button" class="basis-algo-label">
												计算依据
											</button>
										</template>
										<div class="batch-ship-trend-panel">
											<div class="batch-ship-trend-title">
												{{
													item.product_name ||
													item.msku ||
													item.asin ||
													"-"
												}}
												趋势图
											</div>
											<listing-trend-chart
												:product-code="item.product_code || ''"
												:asin="item.asin || ''"
												:marketplace="item.marketplace || ''"
												:daily-avg-sales="getCalculationDailyAvgSales(item)"
											/>
										</div>
									</el-popover>
									<el-select
										v-model="item.algo"
										size="small"
										class="basis-algo-select"
										:disabled="loadingAny"
										@change="handleItemAlgoChange(item)"
									>
										<el-option label="日均销量" value="daily_avg" />
										<el-option label="历史销量" value="history" />
										<el-option label="搜索词趋势" value="trend" />
										<el-option label="综合走势" value="combined" />
										<el-option label="运营意向" value="operator_intent" />
									</el-select>
								</div>
								<div class="basis-param-editor">
									<div class="basis-param-head">
										<span>推演参数</span>
									</div>
									<div class="basis-param-row">
										<span>日均单量</span>
										<el-input-number
											:model-value="
												getTraceFieldInputValue(item, 'daily_avg_sales')
											"
											:min="getTraceFieldInputMin('daily_avg_sales')"
											:max="getTraceFieldInputMax('daily_avg_sales')"
											:step="getTraceFieldInputStep('daily_avg_sales')"
											:precision="
												getTraceFieldInputPrecision('daily_avg_sales')
											"
											size="small"
											controls-position="right"
											:disabled="loadingAny"
											@change="
												(value: any) =>
													handleTraceFieldManualInputChange(
														item,
														'daily_avg_sales',
														value
													)
											"
										/>
									</div>
									<div class="basis-param-row">
										<span>目标天数</span>
										<el-input-number
											:model-value="
												getTraceFieldInputValue(item, 'target_stock_days')
											"
											:min="getTraceFieldInputMin('target_stock_days')"
											:max="getTraceFieldInputMax('target_stock_days')"
											:step="getTraceFieldInputStep('target_stock_days')"
											:precision="
												getTraceFieldInputPrecision('target_stock_days')
											"
											size="small"
											controls-position="right"
											:disabled="loadingAny"
											@change="
												(value: any) =>
													handleTraceFieldManualInputChange(
														item,
														'target_stock_days',
														value
													)
											"
										/>
									</div>
									<div class="basis-param-row">
										<span>波动系数</span>
										<el-input-number
											:model-value="
												getTraceFieldInputValue(
													item,
													'volatility_coefficient'
												)
											"
											:min="getTraceFieldInputMin('volatility_coefficient')"
											:max="getTraceFieldInputMax('volatility_coefficient')"
											:step="getTraceFieldInputStep('volatility_coefficient')"
											:precision="
												getTraceFieldInputPrecision(
													'volatility_coefficient'
												)
											"
											size="small"
											controls-position="right"
											:disabled="loadingAny"
											@change="
												(value: any) =>
													handleTraceFieldManualInputChange(
														item,
														'volatility_coefficient',
														value
													)
											"
										/>
									</div>
								</div>
								<div class="basis-pill-grid">
									<div class="basis-period-picker-row">
										<span>周期</span>
										<replenish-date-picker
											:model-value="getCalculationDateRange(item)"
											:daily-avg-sales="getCalculationDailyAvgSales(item)"
											:fba-valid="getFbaInventoryQuantityForGap(item)"
											:fba-shipping-list="item.fbaShippingList || []"
											:product-code="item.product_code || ''"
											:asin="item.asin || ''"
											:marketplace="item.marketplace || ''"
											:algorithm="item.algo || globalAlgo"
											:alpha="undefined"
											:listing-id="item.listing_id || undefined"
											:msku="item.msku || ''"
											:store-id="item.store_id || undefined"
											:shipping-markers="computedShippingMarkers"
											variant="detail"
											class="basis-period-picker"
											@change="
												(range) => handleItemPeriodRangeChange(item, range)
											"
										/>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div class="item-analysis">
						<div class="analysis-data-grid">
							<div class="grid-item">
								<div class="grid-label">日均销量</div>
								<el-popover
									v-if="hasTraceFieldHistory(item)"
									placement="top"
									:width="620"
									trigger="hover"
									:hide-after="220"
									:teleported="true"
									:fallback-placements="TRACE_FIELD_FALLBACK_PLACEMENTS"
									popper-class="trace-field-popover trace-field-popover--daily"
								>
									<template #reference>
										<div class="summary-daily-sales trace-field-trigger">
											<div class="daily-sales-trigger">
												{{ formatNullableNumber(item.daily_avg_sales) }}
											</div>
											<div class="daily-sales-sub">
												{{ item.sales_avg_info || "-" }}
											</div>
										</div>
									</template>
									<div class="trace-field-mini">
										<template
											v-for="dailyTooltip in [getDailySalesTooltipData(item)]"
											:key="`${item._batchId}-daily-sales-with-trace-${dailyTooltip.dailyAvg}`"
										>
											<div class="daily-sales-tooltip-panel is-trace-merged">
												<div class="daily-sales-tooltip-head">
													<div>
														<div class="daily-sales-tooltip-title">
															当前日均销量
														</div>
														<strong>{{ dailyTooltip.dailyAvg }}</strong>
													</div>
												</div>
												<div class="daily-sales-metric-grid">
													<div
														v-for="metric in dailyTooltip.metrics"
														:key="metric.label"
														class="daily-sales-metric"
													>
														<span>{{ metric.label }}</span>
														<strong>{{ metric.value }}</strong>
													</div>
												</div>
												<div class="daily-sales-history-section">
													<div class="daily-sales-history-title">
														近期每日销量
													</div>
													<div
														v-if="dailyTooltip.history.length"
														class="daily-sales-history-grid"
													>
														<div
															v-for="trend in dailyTooltip.history"
															:key="trend.date"
															class="daily-sales-history-item"
														>
															<span>{{
																formatRecentSalesDate(trend.date)
															}}</span>
															<strong>{{ trend.volumeText }}</strong>
														</div>
													</div>
													<div v-else class="daily-sales-history-empty">
														暂无近期销量数据
													</div>
												</div>
											</div>
										</template>
										<div class="trace-field-divider"></div>
										<div class="trace-field-mini-head">
											<strong>{{
												getTraceFieldTitle("daily_avg_sales")
											}}</strong>
											<el-tag size="small" type="success" effect="plain">
												完整记录
												{{ getItemFullReplenishTraces(item).length }} 条
											</el-tag>
										</div>
										<div class="trace-field-source">
											{{ getTraceFieldSourceText(item) }}
										</div>
										<table class="trace-field-record-table">
											<thead>
												<tr>
													<th>计划号（点击查看）</th>
													<th>记录值</th>
													<th>周期</th>
													<th>关联/实采</th>
													<th>创建</th>
												</tr>
											</thead>
											<tbody>
												<tr
													v-for="row in getTraceFieldTraceRows(
														item,
														'daily_avg_sales'
													)"
													:key="row.key"
													:class="{
														'is-current-source':
															row.sourceType === 'current'
													}"
												>
													<td class="trace-field-plan-cell">
														<button
															v-if="row.sourceType === 'trace'"
															type="button"
															@click.stop="
																openFullTraceDrawer(
																	item,
																	row.traceKey
																)
															"
														>
															{{ row.planText }}
														</button>
														<span
															v-else
															class="trace-field-static-plan"
														>
															{{ row.planText }}
														</span>
														<em>{{ row.analysisText }}</em>
													</td>
													<td class="trace-field-value-cell">
														<strong>{{ row.valueText }}</strong>
													</td>
													<td class="trace-field-period-cell">
														<span>{{ row.periodRangeText }}</span>
														<em>{{ row.periodDaysText }}</em>
													</td>
													<td class="trace-field-order-cell">
														<span>{{ row.orderText }}</span>
														<em>{{ row.actualPurchaseText }}</em>
													</td>
													<td class="trace-field-creator-cell">
														<span>{{ row.creatorNameText }}</span>
														<em>{{ row.creatorTimeText }}</em>
													</td>
												</tr>
											</tbody>
										</table>
										<div class="trace-field-footer">
											<span>点击计划号可定位到对应完整记录</span>
											<el-button
												size="small"
												link
												type="primary"
												@click.stop="openFullTraceDrawer(item)"
											>
												打开完整补货依据
											</el-button>
										</div>
									</div>
								</el-popover>
								<el-tooltip v-else placement="top" effect="light" :show-after="200">
									<template #content>
										<template
											v-for="dailyTooltip in [getDailySalesTooltipData(item)]"
											:key="`${item._batchId}-daily-sales-${dailyTooltip.dailyAvg}`"
										>
											<div class="daily-sales-tooltip-panel">
												<div class="daily-sales-tooltip-head">
													<div>
														<div class="daily-sales-tooltip-title">
															日均销量
														</div>
														<strong>{{ dailyTooltip.dailyAvg }}</strong>
													</div>
												</div>
												<div class="daily-sales-metric-grid">
													<div
														v-for="metric in dailyTooltip.metrics"
														:key="metric.label"
														class="daily-sales-metric"
													>
														<span>{{ metric.label }}</span>
														<strong>{{ metric.value }}</strong>
													</div>
												</div>
												<div class="daily-sales-history-section">
													<div class="daily-sales-history-title">
														近期每日销量
													</div>
													<div
														v-if="dailyTooltip.history.length"
														class="daily-sales-history-grid"
													>
														<div
															v-for="trend in dailyTooltip.history"
															:key="trend.date"
															class="daily-sales-history-item"
														>
															<span>{{
																formatRecentSalesDate(trend.date)
															}}</span>
															<strong>{{ trend.volumeText }}</strong>
														</div>
													</div>
													<div v-else class="daily-sales-history-empty">
														暂无近期销量数据
													</div>
												</div>
											</div>
										</template>
									</template>
									<div class="summary-daily-sales">
										<div class="daily-sales-trigger">
											{{ formatNullableNumber(item.daily_avg_sales) }}
										</div>
										<div class="daily-sales-sub">
											{{ item.sales_avg_info || "-" }}
										</div>
									</div>
								</el-tooltip>
							</div>
							<div class="grid-item">
								<div class="grid-label">可售天数<br />(总/FBA)</div>
								<div class="grid-val">{{ formatSellableDays(item) }}</div>
							</div>
							<div class="grid-item">
								<div class="grid-label">FBA/FBA预留/<br />在途/本地</div>
								<div class="grid-val inventory-combined">
									<el-popover
										placement="top"
										:width="960"
										trigger="hover"
										popper-class="summary-detail-popover"
									>
										<template #reference>
											<span class="summary-link">{{
												formatNumber(item.fba_qty)
											}}</span>
										</template>
										<div class="summary-detail-content">
											<div class="summary-detail-title">
												FBA库存明细（合计：{{
													formatNumber(item.fba_qty)
												}}）
											</div>
											<el-table
												v-if="
													filterByItemMsku(item.fbaValidList, item).length
												"
												:data="filterByItemMsku(item.fbaValidList, item)"
												size="small"
												border
											>
												<el-table-column
													prop="fnsku"
													label="FNSKU"
													min-width="140"
													show-overflow-tooltip
												/>
												<el-table-column
													prop="msku"
													label="MSKU"
													min-width="120"
													show-overflow-tooltip
												/>
												<el-table-column
													prop="quantity"
													label="数量"
													min-width="80"
												/>
												<el-table-column
													prop="afnFulfillableQuantity"
													label="可售"
													min-width="80"
												/>
												<el-table-column
													prop="afnReservedQuantity"
													label="FBA预留"
													min-width="90"
												/>
												<el-table-column
													prop="reservedFcTransfers"
													label="待调仓"
													min-width="80"
												/>
												<el-table-column
													prop="reservedFcProcessing"
													label="调仓中"
													min-width="80"
												/>
												<el-table-column
													prop="afnInboundReceivingQuantity"
													label="入库中"
													min-width="80"
												/>
												<el-table-column
													prop="reservedCustomerorders"
													label="待发货"
													min-width="80"
												/>
												<el-table-column
													prop="amazonSaleDate"
													label="预计可售时间"
													min-width="160"
													show-overflow-tooltip
												/>
											</el-table>
											<div v-else class="summary-empty">暂无FBA库存明细</div>
										</div>
									</el-popover>
									<span>/</span>
									<span class="summary-link" title="FBA预留库存">
										{{ formatNumber(item.fba_reserved_qty) }}
									</span>
									<span>/</span>
									<el-popover
										placement="top"
										:width="960"
										trigger="hover"
										popper-class="summary-detail-popover"
									>
										<template #reference>
											<span class="summary-link">{{
												formatNumber(item.in_transit_qty)
											}}</span>
										</template>
										<div class="summary-detail-content">
											<div class="summary-detail-title">
												在途货件（合计：{{
													formatNumber(item.in_transit_qty)
												}}）
											</div>
											<el-table
												v-if="item.fbaShippingList.length"
												:data="item.fbaShippingList"
												size="small"
												border
											>
												<el-table-column
													prop="orderSn"
													label="货件单号"
													min-width="140"
													show-overflow-tooltip
												/>
												<el-table-column
													prop="shippingOrderSn"
													label="发货单号"
													min-width="140"
													show-overflow-tooltip
												/>
												<el-table-column
													prop="quantity"
													label="数量"
													min-width="80"
												/>
												<el-table-column
													prop="logisticsChannelName"
													label="物流方式"
													min-width="140"
													show-overflow-tooltip
												/>
												<el-table-column
													prop="shippingMethod"
													label="运输方式"
													min-width="120"
												/>
												<el-table-column
													prop="shipmentTime"
													label="发货时间"
													min-width="160"
													show-overflow-tooltip
												/>
												<el-table-column
													prop="amazonSaleDate"
													label="预计可售时间"
													min-width="160"
													show-overflow-tooltip
												/>
											</el-table>
											<div v-else class="summary-empty">暂无在途货件</div>
										</div>
									</el-popover>
									<span>/</span>
									<el-popover
										placement="top"
										:width="960"
										trigger="hover"
										popper-class="summary-detail-popover"
									>
										<template #reference>
											<span class="summary-link">{{
												formatNumber(item.local_qty)
											}}</span>
										</template>
										<div class="summary-detail-content">
											<div class="summary-detail-title">
												本地可用明细（合计：{{
													formatNumber(item.local_qty)
												}}）
											</div>
											<el-table
												v-if="item.localValidList.length"
												:data="item.localValidList"
												size="small"
												border
											>
												<el-table-column
													prop="whName"
													label="仓库"
													min-width="120"
													show-overflow-tooltip
												/>
												<el-table-column
													prop="sku"
													label="SKU"
													min-width="120"
													show-overflow-tooltip
												/>
												<el-table-column
													prop="storeName"
													label="店铺"
													min-width="140"
													show-overflow-tooltip
												/>
												<el-table-column
													prop="quantityValid"
													label="可用数量"
													min-width="100"
												/>
												<el-table-column
													prop="quantityLocked"
													label="锁定数量"
													min-width="100"
												/>
												<el-table-column
													prop="quantityExpectAvailable"
													label="预计可用"
													min-width="100"
												/>
												<el-table-column
													prop="amazonSaleDate"
													label="预计可售时间"
													min-width="160"
													show-overflow-tooltip
												/>
												<el-table-column
													prop="remark"
													label="备注"
													min-width="160"
													show-overflow-tooltip
												/>
											</el-table>
											<div v-else class="summary-empty">暂无本地可用明细</div>
										</div>
									</el-popover>
								</div>
							</div>
							<div class="grid-item">
								<div class="grid-label">装箱数</div>
								<el-popover
									placement="top"
									:width="360"
									trigger="hover"
									popper-class="summary-detail-popover"
								>
									<template #reference>
										<div class="grid-val summary-link box-pcs-value">
											<el-icon v-if="item._cgBoxPcsLoading" class="is-loading"
												><loading-icon
											/></el-icon>
											<span v-else>{{ getBoxPcsDisplay(item) }}</span>
										</div>
									</template>
									<div class="summary-detail-content box-pcs-popover">
										<div class="summary-detail-title">装箱数</div>
										<div class="box-pcs-row">
											<span class="box-pcs-label">请求参数</span>
											<code>{{ formatBoxPcsRequestParams(item) }}</code>
										</div>
										<div class="box-pcs-row">
											<span class="box-pcs-label">状态</span>
											<span :class="{ 'box-pcs-error': item._cgBoxPcsError }">
												{{
													item._cgBoxPcsError ||
													item._cgBoxPcsMessage ||
													"待查询"
												}}
											</span>
										</div>
										<div class="box-pcs-actions">
											<el-button
												size="small"
												:loading="item._cgBoxPcsLoading"
												@click="fetchBoxPcsForItem(item, true)"
											>
												重新获取
											</el-button>
										</div>
									</div>
								</el-popover>
							</div>
							<div class="grid-item">
								<div class="grid-label">预计发<br />货量</div>
								<el-popover
									placement="top"
									:width="960"
									trigger="hover"
									popper-class="summary-detail-popover"
								>
									<template #reference>
										<div class="grid-val highlight summary-link">
											{{
												formatNullableNumber(item.estimated_shipping_qty, 0)
											}}
										</div>
									</template>
									<div class="summary-detail-content">
										<div class="summary-detail-title">预计发货量明细</div>
										<el-table
											v-if="item.estimated_shipping_details.length"
											:data="item.estimated_shipping_details"
											size="small"
											border
										>
											<el-table-column
												prop="shippingPlanSn"
												label="发货计划单号"
												min-width="140"
												show-overflow-tooltip
											/>
											<el-table-column
												prop="shipmentSn"
												label="货件号"
												min-width="140"
												show-overflow-tooltip
											/>
											<el-table-column
												prop="shipmentOrderSn"
												label="发货单号"
												min-width="120"
												show-overflow-tooltip
											/>
											<el-table-column
												prop="whName"
												label="发货仓库"
												min-width="120"
												show-overflow-tooltip
											/>
											<el-table-column
												prop="quantity"
												label="数量"
												min-width="80"
											/>
											<el-table-column
												prop="shippingMethodName"
												label="物流方式"
												min-width="80"
											/>
											<el-table-column
												prop="shipmentDate"
												label="发货时间"
												min-width="80"
											/>
											<el-table-column
												prop="amazonSaleDate"
												label="预计可售时间"
												min-width="160"
												show-overflow-tooltip
											/>
										</el-table>
										<div v-else class="summary-empty">暂无预计发货量明细</div>
									</div>
								</el-popover>
							</div>
							<div class="grid-item">
								<div class="grid-label">断货<br />时间</div>
								<div class="grid-val">{{ item.out_stock_date || "-" }}</div>
							</div>
							<div class="grid-item">
								<div class="grid-label">目标库存<br />天数</div>
								<el-popover
									v-if="hasTraceFieldHistory(item)"
									placement="top"
									:width="600"
									trigger="hover"
									:hide-after="220"
									:teleported="true"
									:fallback-placements="TRACE_FIELD_FALLBACK_PLACEMENTS"
									popper-class="trace-field-popover trace-field-popover--compact"
								>
									<template #reference>
										<div class="grid-val highlight trace-field-trigger">
											{{ formatSystemTargetStockDays(item) }}
										</div>
									</template>
									<div class="trace-field-mini">
										<div class="trace-field-mini-head">
											<strong>{{
												getTraceFieldTitle("target_stock_days")
											}}</strong>
											<el-tag size="small" type="success" effect="plain">
												完整记录
												{{ getItemFullReplenishTraces(item).length }} 条
											</el-tag>
										</div>
										<div class="trace-field-source">
											{{ getTraceFieldSourceText(item) }}
										</div>
										<table class="trace-field-record-table">
											<thead>
												<tr>
													<th>计划号（点击查看）</th>
													<th>记录值</th>
													<th>周期</th>
													<th>关联/实采</th>
													<th>创建</th>
												</tr>
											</thead>
											<tbody>
												<tr
													v-for="row in getTraceFieldTraceRows(
														item,
														'target_stock_days'
													)"
													:key="row.key"
													:class="{
														'is-current-source':
															row.sourceType === 'current'
													}"
												>
													<td class="trace-field-plan-cell">
														<button
															v-if="row.sourceType === 'trace'"
															type="button"
															@click.stop="
																openFullTraceDrawer(
																	item,
																	row.traceKey
																)
															"
														>
															{{ row.planText }}
														</button>
														<span
															v-else
															class="trace-field-static-plan"
														>
															{{ row.planText }}
														</span>
														<em>{{ row.analysisText }}</em>
													</td>
													<td class="trace-field-value-cell">
														<strong>{{ row.valueText }}</strong>
													</td>
													<td class="trace-field-period-cell">
														<span>{{ row.periodRangeText }}</span>
														<em>{{ row.periodDaysText }}</em>
													</td>
													<td class="trace-field-order-cell">
														<span>{{ row.orderText }}</span>
														<em>{{ row.actualPurchaseText }}</em>
													</td>
													<td class="trace-field-creator-cell">
														<span>{{ row.creatorNameText }}</span>
														<em>{{ row.creatorTimeText }}</em>
													</td>
												</tr>
											</tbody>
										</table>
										<div class="trace-field-footer">
											<span>点击计划号可定位到对应完整记录</span>
											<el-button
												size="small"
												link
												type="primary"
												@click.stop="openFullTraceDrawer(item)"
											>
												打开完整补货依据
											</el-button>
										</div>
									</div>
								</el-popover>
								<div v-else class="grid-val highlight">
									{{ formatSystemTargetStockDays(item) }}
								</div>
							</div>
							<div class="grid-item">
								<div class="grid-label">波动<br />系数</div>
								<el-popover
									v-if="hasTraceFieldHistory(item)"
									placement="top"
									:width="600"
									trigger="hover"
									:hide-after="220"
									:teleported="true"
									:fallback-placements="TRACE_FIELD_FALLBACK_PLACEMENTS"
									popper-class="trace-field-popover trace-field-popover--compact"
								>
									<template #reference>
										<div class="grid-val trace-field-trigger">
											{{
												formatCoefficientNumber(item.volatility_coefficient)
											}}
										</div>
									</template>
									<div class="trace-field-mini">
										<div class="trace-field-mini-head">
											<strong>{{
												getTraceFieldTitle("volatility_coefficient")
											}}</strong>
											<el-tag size="small" type="success" effect="plain">
												完整记录
												{{ getItemFullReplenishTraces(item).length }} 条
											</el-tag>
										</div>
										<div class="trace-field-source">
											{{ getTraceFieldSourceText(item) }}
										</div>
										<table class="trace-field-record-table">
											<thead>
												<tr>
													<th>计划号（点击查看）</th>
													<th>记录值</th>
													<th>算法</th>
													<th>关联/实采</th>
													<th>创建</th>
												</tr>
											</thead>
											<tbody>
												<tr
													v-for="row in getTraceFieldTraceRows(
														item,
														'volatility_coefficient'
													)"
													:key="row.key"
													:class="{
														'is-current-source':
															row.sourceType === 'current'
													}"
												>
													<td class="trace-field-plan-cell">
														<button
															v-if="row.sourceType === 'trace'"
															type="button"
															@click.stop="
																openFullTraceDrawer(
																	item,
																	row.traceKey
																)
															"
														>
															{{ row.planText }}
														</button>
														<span
															v-else
															class="trace-field-static-plan"
														>
															{{ row.planText }}
														</span>
														<em>{{ row.analysisText }}</em>
													</td>
													<td class="trace-field-value-cell">
														<strong>{{ row.valueText }}</strong>
													</td>
													<td>{{ row.algoText }}</td>
													<td class="trace-field-order-cell">
														<span>{{ row.orderText }}</span>
														<em>{{ row.actualPurchaseText }}</em>
													</td>
													<td class="trace-field-creator-cell">
														<span>{{ row.creatorNameText }}</span>
														<em>{{ row.creatorTimeText }}</em>
													</td>
												</tr>
											</tbody>
										</table>
										<div class="trace-field-footer">
											<span>点击计划号可定位到对应完整记录</span>
											<el-button
												size="small"
												link
												type="primary"
												@click.stop="openFullTraceDrawer(item)"
											>
												打开完整补货依据
											</el-button>
										</div>
									</div>
								</el-popover>
								<div v-else class="grid-val">
									{{ formatCoefficientNumber(item.volatility_coefficient) }}
								</div>
							</div>
							<div class="grid-item summary-rating-item">
								<div class="grid-label">评分/<br />Rating</div>
								<el-popover placement="top" :width="360" trigger="hover">
									<template #reference>
										<div class="grid-val rating-combined summary-link">
											<table class="rating-mini-table">
												<colgroup>
													<col class="rating-mini-col-label" />
													<col class="rating-mini-col-now" />
													<col class="rating-mini-col-compare" />
													<col class="rating-mini-col-delta" />
												</colgroup>
												<thead>
													<tr>
														<th></th>
														<th title="今天的数据">今</th>
														<th title="10天前的数据">10天前</th>
														<th title="与10天前相比的变化">变</th>
													</tr>
												</thead>
												<tbody>
													<tr
														v-for="row in getRatingMiniRows(item)"
														:key="row.key"
													>
														<th>{{ row.label }}</th>
														<td>{{ row.currentText }}</td>
														<td>{{ row.compareText }}</td>
														<td
															:class="[
																'rating-mini-delta',
																row.trendClass
															]"
														>
															{{ row.trendText }}
														</td>
													</tr>
												</tbody>
											</table>
										</div>
									</template>
									<div class="summary-rating-full">
										<div class="summary-detail-title">评分/Rating</div>
										<div>{{ formatSummaryValue(item.stars) }}</div>
										<div class="summary-detail-title summary-rating-title">
											Rating总数
										</div>
										<div>{{ formatSummaryValue(item.reviews_num) }}</div>
									</div>
								</el-popover>
							</div>
							<el-popover
								placement="bottom-start"
								:width="760"
								trigger="hover"
								popper-class="order-allocation-popover"
							>
								<template #reference>
									<div class="grid-item is-hoverable">
										<div class="grid-label">采购单可发</div>
										<div class="grid-val highlight">
											{{ formatNumber(item.actual_shippable_qty) }} /
											{{ item.shippableOrders.length }}单
										</div>
									</div>
								</template>
								<div class="order-allocation-popover-content">
									<div class="order-allocation-title">
										<span>采购单可发明细</span>
										<el-tag size="small" type="success" effect="light">
											自动分配 {{ formatNumber(item.shipQty) }} 件
										</el-tag>
									</div>
									<div class="order-allocation-list">
										<div
											v-for="order in item.shippableOrders"
											:key="order.id"
											class="order-row"
										>
											<div class="order-main">
												<div class="order-title">
													<strong>{{ order.order_sn || "-" }}</strong>
													<el-tag size="small" effect="plain">{{
														order.status_text || "-"
													}}</el-tag>
												</div>
												<div class="order-meta">
													<span>计划 {{ order.plan_sn || "-" }}</span>
													<span
														>入库
														{{
															formatNumber(order.quantity_entry_sum)
														}}</span
													>
													<span
														>已实发
														{{
															formatNumber(
																order.actual_shipment_qty_sum
															)
														}}</span
													>
													<span
														>异常
														{{
															formatNumber(
																order.defective_qty +
																	order.short_shipped_qty
															)
														}}</span
													>
												</div>
											</div>
											<div class="order-ship-control">
												<span>本次发货</span>
												<el-input-number
													v-model="order.ship_qty"
													:min="0"
													:max="order.actual_shippable_qty"
													size="small"
													controls-position="right"
													:disabled="!item.calculated || loadingAny"
													@change="handleOrderShipQtyChange(item)"
												/>
											</div>
										</div>
									</div>
								</div>
							</el-popover>
						</div>

						<div class="ship-analysis-panel">
							<div class="shipping-layout-scroll">
								<div class="shipping-layout-canvas">
									<div
										v-if="getTraceDistributionRows(item).length"
										class="trace-distribution-panel"
									>
										<div class="trace-distribution-head">
											<div>
												<strong>完整记录运输分布</strong>
												<span
													>一条完整补货记录一行，点击运输方式定位下方卡片</span
												>
											</div>
											<el-tag size="small" type="success" effect="plain">
												{{ getTraceDistributionRows(item).length }}
												条完整记录
											</el-tag>
										</div>
										<div class="trace-distribution-table">
											<div class="trace-distribution-row is-header">
												<div class="trace-method-grid">
													<el-tooltip
														v-for="header in getTraceDistributionMethodHeaders(
															item
														)"
														:key="`trace-header-${header.key}`"
														placement="top"
														effect="light"
														:teleported="true"
														popper-class="trace-method-header-tooltip"
													>
														<template #content>
															<div
																class="trace-method-header-tooltip-panel"
															>
																<div
																	class="trace-method-header-tooltip-title"
																>
																	<strong
																		>{{ header.icon }}
																		{{ header.label }}</strong
																	>
																	<span>完整记录合计</span>
																</div>
																<div
																	class="trace-method-header-tooltip-metrics"
																>
																	<div>
																		<span>本方式</span>
																		<strong>{{
																			header.totalText
																		}}</strong>
																	</div>
																	<div>
																		<span>总计</span>
																		<strong>{{
																			header.allTotalText
																		}}</strong>
																	</div>
																	<div>
																		<span>占比</span>
																		<strong>{{
																			header.percentText
																		}}</strong>
																	</div>
																	<div>
																		<span>来源</span>
																		<strong>{{
																			header.sourceCountText
																		}}</strong>
																	</div>
																</div>
																<div
																	class="trace-method-header-tooltip-source-title"
																>
																	来源明细
																</div>
																<div
																	class="trace-method-header-tooltip-lines"
																>
																	<div
																		v-for="line in header.detailRows"
																		:key="line.key"
																		class="trace-method-header-tooltip-line"
																	>
																		<span>{{
																			line.planText
																		}}</span>
																		<strong>{{
																			line.qtyText
																		}}</strong>
																		<em>{{
																			line.percentText
																		}}</em>
																	</div>
																</div>
																<div
																	class="trace-method-header-tooltip-sub"
																>
																	只统计下方完整记录运输分布，不包含本次发货。
																</div>
															</div>
														</template>
														<div
															class="trace-method-header"
															:class="{
																'is-empty': header.totalQty <= 0
															}"
															:style="{
																'--method-color': header.color
															}"
														>
															<span class="trace-method-header-name"
																>{{ header.icon }}
																{{ header.label }}</span
															>
															<span
																class="trace-method-header-summary"
															>
																{{ header.compactText }}
															</span>
														</div>
													</el-tooltip>
												</div>
												<div class="trace-record-summary-cell is-header">
													记录摘要
												</div>
											</div>
											<div class="trace-distribution-body">
												<div
													v-for="row in getTraceDistributionRows(item)"
													:key="row.key"
													class="trace-distribution-row"
													:class="{
														'is-current': row.isCurrent,
														'is-default': row.isDefault
													}"
												>
													<div class="trace-method-grid">
														<el-tooltip
															v-for="cell in row.methodCells"
															:key="cell.key"
															placement="top"
															effect="light"
															:teleported="true"
															popper-class="trace-method-tooltip"
														>
															<template #content>
																<div
																	class="trace-method-tooltip-panel"
																>
																	<div
																		class="trace-method-tooltip-head"
																	>
																		<strong
																			>{{ row.planText }} ·
																			{{ cell.icon }}
																			{{ cell.label }}</strong
																		>
																		<el-tag
																			size="small"
																			effect="plain"
																			>{{
																				cell.statusText
																			}}</el-tag
																		>
																	</div>
																	<div
																		class="trace-method-tooltip-summary"
																	>
																		<span
																			>数量
																			<strong>{{
																				cell.qtyText
																			}}</strong></span
																		>
																		<span
																			>周期
																			<strong>{{
																				cell.periodText
																			}}</strong></span
																		>
																		<span
																			>系数
																			<strong>{{
																				cell.coefficientText
																			}}</strong></span
																		>
																		<span
																			v-if="
																				row.algoText ===
																				'综合走势'
																			"
																		>
																			α
																			<strong>{{
																				cell.alphaText
																			}}</strong>
																		</span>
																	</div>
																	<div
																		v-if="
																			cell.monthlyRows.length
																		"
																		class="trace-method-month-table"
																	>
																		<div
																			class="trace-method-month-row is-header"
																			:class="{
																				'is-combined':
																					row.algoText ===
																					'综合走势'
																			}"
																		>
																			<span>月</span>
																			<span>天</span>
																			<span
																				v-if="
																					row.algoText ===
																					'综合走势'
																				"
																				>竞</span
																			>
																			<span
																				v-if="
																					row.algoText ===
																					'综合走势'
																				"
																				>搜</span
																			>
																			<span>原始</span>
																			<span
																				v-if="
																					row.algoText ===
																					'综合走势'
																				"
																				>α</span
																			>
																			<span>最终</span>
																		</div>
																		<div
																			v-for="month in cell.monthlyRows"
																			:key="month.key"
																			class="trace-method-month-row"
																			:class="{
																				'is-combined':
																					row.algoText ===
																					'综合走势'
																			}"
																		>
																			<span>{{
																				month.monthText
																			}}</span>
																			<span>{{
																				month.daysText
																			}}</span>
																			<span
																				v-if="
																					row.algoText ===
																					'综合走势'
																				"
																				>{{
																					month.salesText
																				}}</span
																			>
																			<span
																				v-if="
																					row.algoText ===
																					'综合走势'
																				"
																				>{{
																					month.searchText
																				}}</span
																			>
																			<span>{{
																				month.rawText
																			}}</span>
																			<span
																				v-if="
																					row.algoText ===
																					'综合走势'
																				"
																				>{{
																					month.alphaText
																				}}</span
																			>
																			<strong>{{
																				month.finalText
																			}}</strong>
																		</div>
																	</div>
																	<div
																		v-if="
																			cell.monthlyRows.length
																		"
																		class="trace-method-formula-list"
																	>
																		<div
																			v-for="month in cell.monthlyRows"
																			:key="`formula-${month.key}`"
																		>
																			{{
																				month.monthText
																			}}：{{
																				month.formulaText
																			}}
																		</div>
																	</div>
																	<div
																		v-else
																		class="trace-method-empty"
																	>
																		这条完整记录没有
																		{{ cell.label }}
																		段，可能是当时未启用或目标周期外。
																	</div>
																</div>
															</template>
															<button
																type="button"
																class="trace-method-cell"
																:class="[
																	`is-${cell.tone}`,
																	{
																		'is-focused':
																			getTraceDistributionFocusKey(
																				item
																			) === cell.methodKey
																	}
																]"
																:style="{
																	'--method-color': cell.color
																}"
																@click.stop="
																	setTraceDistributionFocus(
																		item,
																		cell.methodKey
																	)
																"
															>
																<span>{{ cell.statusText }}</span>
																<strong>{{ cell.qtyText }}</strong>
																<em>{{ cell.periodText }}</em>
																<small>
																	系 {{ cell.coefficientText }}
																	<template
																		v-if="
																			row.algoText ===
																			'综合走势'
																		"
																	>
																		· α
																		{{
																			cell.alphaText
																		}}</template
																	>
																</small>
															</button>
														</el-tooltip>
													</div>
													<div class="trace-record-summary-cell">
														<div class="trace-record-cell">
															<el-popover
																placement="top"
																trigger="hover"
																:width="360"
																:teleported="true"
																:fallback-placements="[
																	'bottom',
																	'top-start',
																	'bottom-start'
																]"
																popper-class="trace-record-summary-popover"
															>
																<div
																	class="trace-record-summary-popover-panel"
																>
																	<strong>记录摘要</strong>
																	<div
																		class="trace-record-summary-popover-grid"
																	>
																		<span>计划号</span>
																		<button
																			type="button"
																			class="trace-record-summary-link"
																			@click.stop="
																				openFullTraceDrawer(
																					item,
																					row.traceKey
																				)
																			"
																		>
																			{{ row.planText }}
																		</button>
																		<span>分析记录</span
																		><em>{{
																			row.analysisText
																		}}</em>
																		<span>计算依据</span
																		><em>{{ row.algoText }}</em>
																		<span>日均销量</span
																		><em>{{
																			row.dailyText
																		}}</em>
																		<span>目标库存</span
																		><em>{{
																			row.targetText
																		}}</em>
																		<span>波动系数</span
																		><em>{{
																			row.volatilityText
																		}}</em>
																		<span>实际采购</span
																		><em>{{
																			row.actualPurchaseText
																		}}</em>
																		<span>关联采购单</span
																		><em>{{
																			row.orderText
																		}}</em>
																		<span>运输段合计</span
																		><em>{{
																			row.totalText
																		}}</em>
																	</div>
																	<div
																		class="trace-record-summary-popover-actions"
																	>
																		<el-button
																			size="small"
																			type="primary"
																			link
																			@click.stop="
																				openFullTraceDrawer(
																					item,
																					row.traceKey
																				)
																			"
																		>
																			查看完整补货依据
																		</el-button>
																	</div>
																</div>
																<template #reference>
																	<div class="trace-record-main">
																		<button
																			type="button"
																			@click.stop="
																				openFullTraceDrawer(
																					item,
																					row.traceKey
																				)
																			"
																		>
																			{{ row.planText }}
																		</button>
																		<span
																			class="trace-record-algo"
																			>{{
																				row.algoText
																			}}</span
																		>
																		<em>
																			{{ row.dailyText }} /
																			{{ row.targetText }} /
																			波动
																			{{ row.volatilityText }}
																		</em>
																		<small
																			>{{
																				row.actualPurchaseText
																			}}
																			· {{ row.orderText }} ·
																			合计
																			{{
																				row.totalText
																			}}</small
																		>
																	</div>
																</template>
															</el-popover>
															<el-tooltip
																:disabled="!row.hasManualRemark"
																placement="top"
																effect="light"
																:teleported="true"
																:fallback-placements="[
																	'bottom',
																	'top-start',
																	'bottom-start'
																]"
																popper-class="trace-record-remark-tooltip"
															>
																<template #content>
																	<div
																		class="trace-record-remark-tooltip-panel"
																	>
																		<strong>人工备注</strong>
																		<p>
																			{{
																				row.manualRemarkText
																			}}
																		</p>
																	</div>
																</template>
																<div
																	class="trace-record-remark"
																	:class="{
																		'has-content':
																			row.hasManualRemark
																	}"
																>
																	<span>备注</span>
																	<em>{{
																		row.hasManualRemark
																			? row.manualRemarkText
																			: "无"
																	}}</em>
																</div>
															</el-tooltip>
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>
									<div class="analysis-main-row">
										<div class="shipping-workbench-main">
											<div class="panel-bottom">
												<div
													v-for="segment in getShippingWorkbenchSegments(
														item
													)"
													:key="`${item._batchId}-${segment.key}`"
													class="si-col"
													:class="{
														'is-active': segment.active,
														'is-disabled': !segment.enabled,
														'is-global-disabled': !segment.globalEnabled
													}"
													:style="{ '--method-color': segment.color }"
												>
													<el-checkbox
														:model-value="segment.enabled"
														:disabled="
															loadingAny || !segment.globalEnabled
														"
														class="method-toggle-checkbox"
														@change="
															(val: any) =>
																toggleItemShippingMethod(
																	item,
																	segment.key,
																	Boolean(val)
																)
														"
													>
														<div
															class="si-tag"
															:class="{
																'is-inactive': !segment.enabled
															}"
															:style="
																segment.enabled
																	? {
																			background:
																				segment.color +
																				'15',
																			color: segment.color,
																			borderColor:
																				segment.color + '40'
																		}
																	: {
																			background: '#f5f7fa',
																			color: '#c0c4cc',
																			borderColor: '#e4e7ed'
																		}
															"
														>
															{{ segment.icon }} {{ segment.label }}
														</div>
													</el-checkbox>
													<el-tooltip placement="top" :show-after="180">
														<template #content>
															<div class="ship-card-tip">
																<strong
																	>{{ segment.label }}周期</strong
																>
																<span
																	>{{ segment.rangeText }} ·
																	{{ segment.durationText }} ·
																	{{ segment.arrivalText }}</span
																>
															</div>
														</template>
														<span class="alpha-date-range">{{
															segment.rangeCompactText
														}}</span>
													</el-tooltip>
													<div class="alpha-info-compact">
														<el-popover
															placement="top"
															:width="420"
															trigger="click"
															:teleported="true"
															popper-class="segment-coeff-popover"
														>
															<template #reference>
																<span
																	class="alpha-sys-badge"
																	:class="{
																		'is-user':
																			segment.coefficientTone ===
																			'manual'
																	}"
																>
																	<span class="badge-mode">{{
																		segment.coefficientBadgeMode
																	}}</span>
																	{{
																		segment.coefficientBadgeSymbol
																	}}
																	{{
																		segment.coefficientBadgeValue
																	}}
																	<span
																		v-if="segment.canEditAlpha"
																		class="badge-toggle-icon"
																		>⇄</span
																	>
																</span>
															</template>
															<div class="segment-coeff-panel">
																<div class="segment-coeff-head">
																	<div>
																		<strong
																			>{{ segment.label }} ·
																			系数调整</strong
																		>
																		<span
																			>{{
																				getAlgoLabel(
																					item.algo ||
																						globalAlgo
																				)
																			}}
																			·
																			{{
																				segment.rangeText
																			}}</span
																		>
																	</div>
																	<el-tag
																		size="small"
																		effect="plain"
																		:type="
																			segment.coefficientTone ===
																			'manual'
																				? 'warning'
																				: segment.coefficientTone ===
																					  'history'
																					? 'success'
																					: 'info'
																		"
																	>
																		{{
																			segment.coefficientSourceText
																		}}
																	</el-tag>
																</div>
																<div class="segment-coeff-editor">
																	<label>
																		<span>最终系数</span>
																		<el-input-number
																			:model-value="
																				segment.coefficientInputValue
																			"
																			:min="0"
																			:max="20"
																			:step="0.05"
																			:precision="2"
																			size="small"
																			controls-position="right"
																			:disabled="
																				loadingAny ||
																				!segment.active
																			"
																			@change="
																				(val: any) =>
																					setSegmentManualFinalCoefficient(
																						item,
																						segment.key,
																						val
																					)
																			"
																		/>
																	</label>
																	<label
																		v-if="segment.canEditAlpha"
																	>
																		<span>综合α</span>
																		<el-input-number
																			:model-value="
																				segment.alphaInputValue
																			"
																			:min="0"
																			:max="1"
																			:step="0.05"
																			:precision="2"
																			size="small"
																			controls-position="right"
																			:disabled="
																				loadingAny ||
																				!segment.active ||
																				segment.manualFinalCoefficient !==
																					null
																			"
																			@change="
																				(val: any) =>
																					setSegmentManualAlpha(
																						item,
																						segment.key,
																						val
																					)
																			"
																		/>
																	</label>
																	<el-button
																		size="small"
																		text
																		type="primary"
																		:disabled="
																			loadingAny ||
																			(segment.manualFinalCoefficient ===
																				null &&
																				segment.manualAlpha ===
																					null)
																		"
																		@click="
																			resetSegmentCoefficientOverride(
																				item,
																				segment.key
																			)
																		"
																	>
																		还原
																	</el-button>
																</div>
																<div class="segment-coeff-notice">
																	{{ segment.coefficientNotice }}
																</div>
																<div class="segment-coeff-table">
																	<div
																		class="segment-coeff-table-row is-header"
																		:class="{
																			'is-no-alpha':
																				!segment.canEditAlpha
																		}"
																	>
																		<span>月</span>
																		<span>天</span>
																		<span>原始</span>
																		<span
																			v-if="
																				segment.canEditAlpha
																			"
																			>α</span
																		>
																		<span>最终</span>
																		<span>来源</span>
																	</div>
																	<div
																		v-for="row in segment.coefficientRows"
																		:key="`${segment.key}-${row.month}`"
																		class="segment-coeff-table-row"
																		:class="{
																			'is-no-alpha':
																				!segment.canEditAlpha
																		}"
																	>
																		<span>{{
																			row.monthText
																		}}</span>
																		<span>{{ row.days }}</span>
																		<span>{{
																			row.rawText
																		}}</span>
																		<span
																			v-if="
																				segment.canEditAlpha
																			"
																			>{{
																				row.alphaText
																			}}</span
																		>
																		<strong>{{
																			row.finalText
																		}}</strong>
																		<em>{{
																			row.sourceText
																		}}</em>
																	</div>
																</div>
																<div class="segment-coeff-formulas">
																	<div
																		v-for="line in segment.coefficientFormulaRows"
																		:key="line"
																	>
																		{{ line }}
																	</div>
																</div>
															</div>
														</el-popover>
													</div>
													<div class="alpha-manual-row">
														<span class="alpha-manual-label">{{
															segment.manualCoefficientLabel
														}}</span>
														<el-input-number
															v-if="segment.canEditAlpha"
															:model-value="segment.alphaInputValue"
															:min="0"
															:max="1"
															:step="0.05"
															:precision="2"
															size="small"
															controls-position="right"
															:disabled="
																loadingAny ||
																!segment.active ||
																segment.manualFinalCoefficient !==
																	null
															"
															@change="
																(val: any) =>
																	setSegmentManualAlpha(
																		item,
																		segment.key,
																		val
																	)
															"
														/>
														<el-input-number
															v-else
															:model-value="
																segment.coefficientInputValue
															"
															:min="0"
															:max="20"
															:step="0.05"
															:precision="2"
															size="small"
															controls-position="right"
															:disabled="
																loadingAny || !segment.active
															"
															@change="
																(val: any) =>
																	setSegmentManualFinalCoefficient(
																		item,
																		segment.key,
																		val
																	)
															"
														/>
													</div>
													<el-input
														:model-value="String(segment.manualShipQty)"
														inputmode="numeric"
														size="small"
														class="shipping-quantity-input"
														:disabled="
															isSegmentShipQtyInputDisabled(segment)
														"
														@focus="
															captureSegmentManualShipEditSnapshot(
																item,
																segment.key
															)
														"
														@input="
															(val: any) =>
																handleSegmentManualShipQtyInput(
																	item,
																	segment.key,
																	val
																)
														"
														@change="
															(val: any) =>
																handleSegmentManualShipQtyChange(
																	item,
																	segment.key,
																	val
																)
														"
														@keydown.enter.prevent="
															(event: any) =>
																handleSegmentManualShipQtyChange(
																	item,
																	segment.key,
																	event?.target?.value
																)
														"
													/>
													<div
														v-if="segment.transferNoticeText"
														class="si-transfer-notice"
														:class="`is-${segment.transferNoticeTone}`"
													>
														{{ segment.transferNoticeText }}
													</div>
													<div
														v-else-if="segment.manualLockText"
														class="si-transfer-notice is-locked"
													>
														{{ segment.manualLockText }}
													</div>
													<el-tooltip
														placement="top"
														effect="light"
														popper-class="ship-segment-tooltip"
														:show-after="160"
													>
														<template #content>
															<div class="ship-segment-tooltip-panel">
																<div
																	class="ship-segment-tooltip-title"
																>
																	<span
																		>{{ segment.label }} ·
																		{{
																			segment.decisionTitle
																		}}</span
																	>
																	<strong>{{
																		segment.decisionValue
																	}}</strong>
																</div>
																<div
																	class="ship-segment-tooltip-reason"
																>
																	{{ segment.decisionReason }}
																</div>
																<div
																	v-if="segment.decisionFormula"
																	class="ship-segment-tooltip-formula"
																>
																	{{ segment.decisionFormula }}
																</div>
																<div
																	class="ship-segment-tooltip-grid"
																>
																	<div
																		v-for="row in segment.decisionRows"
																		:key="row.label"
																		class="ship-segment-tooltip-row"
																		:class="{
																			'is-important':
																				row.important
																		}"
																	>
																		<span>{{ row.label }}</span>
																		<strong>{{
																			row.value
																		}}</strong>
																	</div>
																</div>
															</div>
														</template>
														<div
															class="alpha-demand-info ship-demand-info"
														>
															<span
																class="suggest-tag suggest-clickable"
																:class="{
																	'has-suggestion':
																		segment.systemSuggestQty > 0
																}"
															>
																{{ segment.decisionLabel }}
																{{ segment.suggestText }}
															</span>
															<span
																class="shortage-tag"
																:class="{
																	'is-covered':
																		segment.decisionCovered
																}"
															>
																{{ segment.decisionSub }}
															</span>
															<span
																class="arrival-tag"
																:class="{
																	'has-arrival':
																		segment.arrivalQtyValue > 0
																}"
															>
																本段到货
																{{ segment.arrivalQtyText }}
															</span>
															<span
																class="transit-tag"
																:class="{
																	'has-transit':
																		segment.inboundUsageValue >
																		0
																}"
															>
																消耗在途
																{{ segment.inboundUsageText }}
															</span>
														</div>
													</el-tooltip>
												</div>
											</div>
											<div class="shipping-plan-diff-row">
												<div
													v-for="segment in getShippingWorkbenchSegments(
														item
													)"
													:key="`${item._batchId}-${segment.key}-plan-diff`"
													class="shipping-plan-diff-cell"
												>
													<el-tooltip
														placement="top"
														effect="light"
														:show-after="120"
														:hide-after="80"
														:offset="8"
														:enterable="true"
														:teleported="true"
														:fallback-placements="[
															'top',
															'bottom',
															'right'
														]"
														popper-class="ship-plan-diff-tooltip"
														:disabled="
															segment.planDiff.tone === 'none' &&
															!segment.planDiff.detailRows.length
														"
													>
														<template #content>
															<div class="ship-plan-diff-panel">
																<div class="ship-plan-diff-head">
																	<strong
																		>{{
																			segment.label
																		}}计划差异</strong
																	>
																	<span
																		>{{
																			segment.planDiff
																				.detailCountText
																		}}
																		· 上方完整记录合计 vs
																		本次填写</span
																	>
																</div>
																<div
																	class="ship-plan-diff-formula"
																	:class="`is-${segment.planDiff.tone}`"
																>
																	<span>计算</span>
																	<strong>{{
																		segment.planDiff.formulaText
																	}}</strong>
																	<em
																		>本次
																		{{
																			segment.planDiff
																				.actualText
																		}}，差异
																		{{
																			segment.planDiff
																				.diffText
																		}}</em
																	>
																</div>
																<div class="ship-plan-diff-summary">
																	<div>
																		<span>计划合计</span>
																		<strong>{{
																			segment.planDiff
																				.plannedText
																		}}</strong>
																	</div>
																	<div>
																		<span>本次填写</span>
																		<strong>{{
																			segment.planDiff
																				.actualText
																		}}</strong>
																	</div>
																	<div
																		:class="`is-${segment.planDiff.tone}`"
																	>
																		<span>差异</span>
																		<strong>{{
																			segment.planDiff
																				.diffText
																		}}</strong>
																	</div>
																</div>
																<div
																	v-if="
																		segment.planDiff.detailRows
																			.length
																	"
																	class="ship-plan-diff-detail"
																>
																	<div
																		class="ship-plan-diff-detail-row is-header"
																	>
																		<span>计划</span>
																		<span>周期</span>
																		<span>状态</span>
																		<span>数量</span>
																	</div>
																	<div
																		v-for="row in segment
																			.planDiff.detailRows"
																		:key="row.key"
																		class="ship-plan-diff-detail-row"
																	>
																		<span>
																			<strong>{{
																				row.planText
																			}}</strong>
																			<em>{{
																				row.analysisText
																			}}</em>
																		</span>
																		<span>{{
																			row.periodText
																		}}</span>
																		<em>{{
																			row.statusText
																		}}</em>
																		<strong>{{
																			row.qtyText
																		}}</strong>
																	</div>
																</div>
																<div
																	v-else
																	class="ship-plan-diff-empty"
																>
																	上方完整记录没有这一运输方式的计划数量。
																</div>
															</div>
														</template>
														<button
															type="button"
															class="ship-plan-diff-line"
															:class="`is-${segment.planDiff.tone}`"
														>
															<span class="ship-plan-diff-main">
																<span>较计划</span>
																<strong>{{
																	segment.planDiff.diffText
																}}</strong>
																<em
																	v-if="
																		segment.planDiff.detailRows
																			.length
																	"
																	>明细</em
																>
															</span>
															<span class="ship-plan-diff-sub">{{
																segment.planDiff.summaryText
															}}</span>
														</button>
													</el-tooltip>
												</div>
											</div>
										</div>

										<div class="ship-coeff-mini-panel">
											<div class="ship-coeff-mini-head">
												<el-tooltip
													placement="top"
													effect="light"
													popper-class="ship-coeff-tooltip"
													:show-after="180"
												>
													<template #content>
														<div class="algo-tooltip">
															<div class="algo-tooltip-title">
																{{
																	getAlgoLabel(
																		item.algo || globalAlgo
																	)
																}}测算说明
															</div>
															<div
																v-if="isShipCombinedAlgo(item)"
																class="algo-tooltip-row"
															>
																综合走势 = α × 竞品销量系数 + (1 -
																α) × 搜索趋势系数
															</div>
															<div class="algo-tooltip-row">
																最终系数 = (原始系数 - 1) × 波动系数
																{{
																	formatCoefficientNumber(
																		getCalculationVolatilityCoefficient(
																			item
																		)
																	)
																}}
																+ 1
															</div>
															<div class="algo-tooltip-row">
																每个月蓝色系数可查看当月完整计算过程。
															</div>
														</div>
													</template>
													<span class="ship-coeff-title"
														>{{
															getAlgoLabel(item.algo || globalAlgo)
														}}测算</span
													>
												</el-tooltip>
												<el-popover
													placement="left-start"
													:width="720"
													trigger="click"
													popper-class="ship-coeff-detail-popover"
												>
													<template #reference>
														<el-button size="small" link
															>明细</el-button
														>
													</template>
													<div class="ship-coeff-detail-panel">
														<div class="ship-coeff-detail-head">
															<div>
																<div
																	class="ship-coeff-detail-title"
																>
																	{{
																		getAlgoLabel(
																			item.algo || globalAlgo
																		)
																	}}测算明细
																</div>
																<div class="ship-coeff-detail-sub">
																	{{
																		item.product_name ||
																		item.msku ||
																		item.asin ||
																		"-"
																	}}
																</div>
															</div>
															<el-tag size="small" effect="plain">
																波动系数
																{{
																	formatCoefficientNumber(
																		getCalculationVolatilityCoefficient(
																			item
																		)
																	)
																}}
															</el-tag>
														</div>
														<div class="ship-coeff-detail-summary">
															<div
																v-for="metric in getShipCoefficientDetailSummary(
																	item
																)"
																:key="metric.label"
															>
																<span>{{ metric.label }}</span>
																<strong>{{ metric.value }}</strong>
															</div>
														</div>
														<div
															class="ship-coeff-detail-table"
															:class="{
																'is-combined':
																	isShipCombinedAlgo(item)
															}"
														>
															<div
																class="ship-coeff-detail-row is-header"
															>
																<span>月</span>
																<span
																	v-if="isShipCombinedAlgo(item)"
																	>竞品</span
																>
																<span
																	v-if="isShipCombinedAlgo(item)"
																	>搜索</span
																>
																<span>原系数</span>
																<span>波动系数</span>
																<span>最终</span>
																<span>日耗</span>
																<span>量</span>
															</div>
															<div
																v-for="row in getShipCoefficientDetailRows(
																	item
																)"
																:key="row.key"
																class="ship-coeff-detail-row"
																:class="{
																	'is-current-month':
																		row.isCurrentMonth,
																	'is-missing': !row.hasData
																}"
															>
																<span>{{ row.label }}</span>
																<span
																	v-if="isShipCombinedAlgo(item)"
																	>{{ row.salesCoeffText }}</span
																>
																<span
																	v-if="isShipCombinedAlgo(item)"
																	>{{ row.searchCoeffText }}</span
																>
																<span>{{ row.rawCoeffText }}</span>
																<span>{{
																	row.volatilityText
																}}</span>
																<strong>{{
																	row.finalCoeffText
																}}</strong>
																<span>{{ row.dailyNeedText }}</span>
																<strong>{{
																	row.subtotalText
																}}</strong>
															</div>
														</div>
														<div class="ship-coeff-detail-note">
															蓝色数字可继续 hover
															查看单月公式；缺失月份会按日均销量降级计算。
														</div>
													</div>
												</el-popover>
											</div>
											<div class="ship-coeff-mini-sub">
												日均
												{{
													formatNumber(getCalculationDailyAvgSales(item))
												}}
											</div>
											<div
												v-if="isShipCombinedAlgo(item)"
												class="ship-coeff-mini-table"
											>
												<div class="ship-coeff-mini-row is-header">
													<span>月</span><span>竞</span><span>搜</span
													><span>综</span><span>α</span><span>量</span>
												</div>
												<div
													v-for="row in getShipFiveMonthCombinedRows(
														item
													)"
													:key="row.key"
													class="ship-coeff-mini-row"
													:class="{
														'is-current-month': row.isCurrentMonth,
														'is-missing': !row.hasData
													}"
												>
													<span>{{ row.label }}</span>
													<span>{{ row.salesCoeffText }}</span>
													<span>{{ row.searchCoeffText }}</span>
													<el-tooltip
														placement="top"
														effect="light"
														popper-class="ship-coeff-tooltip"
														:disabled="!row.tooltipDetail"
														:show-after="180"
													>
														<template #content>
															<div
																v-if="row.tooltipDetail"
																class="coeff-tooltip-panel"
															>
																<div class="coeff-tooltip-title">
																	{{ row.tooltipDetail.title }}
																</div>
																<div class="coeff-tooltip-summary">
																	<div
																		v-for="metric in row
																			.tooltipDetail.summary"
																		:key="metric.label"
																		class="coeff-tooltip-summary-item"
																		:class="
																			metric.tone
																				? `is-${metric.tone}`
																				: ''
																		"
																	>
																		<span>{{
																			metric.label
																		}}</span>
																		<strong>{{
																			metric.value
																		}}</strong>
																	</div>
																</div>
																<div
																	v-if="
																		row.tooltipDetail.metrics
																			?.length
																	"
																	class="coeff-tooltip-section"
																>
																	<div
																		class="coeff-tooltip-section-title"
																	>
																		原始数据
																	</div>
																	<div
																		class="coeff-tooltip-metric-grid"
																	>
																		<div
																			v-for="metric in row
																				.tooltipDetail
																				.metrics"
																			:key="metric.label"
																			class="coeff-tooltip-metric"
																		>
																			<span>{{
																				metric.label
																			}}</span>
																			<strong>{{
																				metric.value
																			}}</strong>
																		</div>
																	</div>
																</div>
																<div
																	v-if="
																		row.tooltipDetail.formulas
																			?.length
																	"
																	class="coeff-tooltip-section"
																>
																	<div
																		class="coeff-tooltip-section-title"
																	>
																		计算过程
																	</div>
																	<div
																		v-for="formula in row
																			.tooltipDetail.formulas"
																		:key="formula.label"
																		class="coeff-tooltip-formula"
																		:class="
																			formula.tone
																				? `is-${formula.tone}`
																				: ''
																		"
																	>
																		<span>{{
																			formula.label
																		}}</span>
																		<strong>{{
																			formula.value
																		}}</strong>
																	</div>
																</div>
																<div
																	v-if="
																		row.tooltipDetail
																			.sourceLines?.length
																	"
																	class="coeff-tooltip-source"
																>
																	<div
																		v-for="line in row
																			.tooltipDetail
																			.sourceLines"
																		:key="line"
																	>
																		{{ line }}
																	</div>
																</div>
															</div>
														</template>
														<span class="combined-coeff">{{
															row.combinedCoeffText
														}}</span>
													</el-tooltip>
													<span class="mini-alpha">{{
														row.alphaText
													}}</span>
													<span class="subtotal">{{
														row.subtotalText
													}}</span>
												</div>
											</div>
											<div v-else class="ship-coeff-mini-table">
												<div
													class="ship-coeff-mini-row ship-coeff-mini-simple is-header"
												>
													<span>月</span><span>天</span><span>系</span
													><span>日耗</span><span>量</span>
												</div>
												<div
													v-for="row in getShipFiveMonthSimpleRows(item)"
													:key="row.key"
													class="ship-coeff-mini-row ship-coeff-mini-simple"
													:class="{
														'is-current-month': row.isCurrentMonth,
														'is-missing': !row.hasData
													}"
												>
													<span>{{ row.label }}</span>
													<span>{{ row.days }}</span>
													<el-tooltip
														placement="top"
														effect="light"
														popper-class="ship-coeff-tooltip"
														:disabled="!row.tooltipDetail"
														:show-after="180"
													>
														<template #content>
															<div
																v-if="row.tooltipDetail"
																class="coeff-tooltip-panel"
															>
																<div class="coeff-tooltip-title">
																	{{ row.tooltipDetail.title }}
																</div>
																<div class="coeff-tooltip-summary">
																	<div
																		v-for="metric in row
																			.tooltipDetail.summary"
																		:key="metric.label"
																		class="coeff-tooltip-summary-item"
																		:class="
																			metric.tone
																				? `is-${metric.tone}`
																				: ''
																		"
																	>
																		<span>{{
																			metric.label
																		}}</span>
																		<strong>{{
																			metric.value
																		}}</strong>
																	</div>
																</div>
																<div
																	v-if="
																		row.tooltipDetail.metrics
																			?.length
																	"
																	class="coeff-tooltip-section"
																>
																	<div
																		class="coeff-tooltip-section-title"
																	>
																		原始数据
																	</div>
																	<div
																		class="coeff-tooltip-metric-grid"
																	>
																		<div
																			v-for="metric in row
																				.tooltipDetail
																				.metrics"
																			:key="metric.label"
																			class="coeff-tooltip-metric"
																		>
																			<span>{{
																				metric.label
																			}}</span>
																			<strong>{{
																				metric.value
																			}}</strong>
																		</div>
																	</div>
																</div>
																<div
																	v-if="
																		row.tooltipDetail.formulas
																			?.length
																	"
																	class="coeff-tooltip-section"
																>
																	<div
																		class="coeff-tooltip-section-title"
																	>
																		计算过程
																	</div>
																	<div
																		v-for="formula in row
																			.tooltipDetail.formulas"
																		:key="formula.label"
																		class="coeff-tooltip-formula"
																		:class="
																			formula.tone
																				? `is-${formula.tone}`
																				: ''
																		"
																	>
																		<span>{{
																			formula.label
																		}}</span>
																		<strong>{{
																			formula.value
																		}}</strong>
																	</div>
																</div>
																<div
																	v-if="
																		row.tooltipDetail
																			.sourceLines?.length
																	"
																	class="coeff-tooltip-source"
																>
																	<div
																		v-for="line in row
																			.tooltipDetail
																			.sourceLines"
																		:key="line"
																	>
																		{{ line }}
																	</div>
																</div>
															</div>
														</template>
														<span class="combined-coeff">{{
															row.coeffText
														}}</span>
													</el-tooltip>
													<span>{{ row.dailyNeedText }}</span>
													<span class="subtotal">{{
														row.subtotalText
													}}</span>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>

							<div class="ship-panel-toolbar">
								<div class="toolbar-summary">
									<span class="toolbar-summary-main">{{
										getAlgoLabel(item.algo || globalAlgo)
									}}</span>
									<span
										>目标
										<strong>{{
											formatEffectiveTargetStockDays(item)
										}}</strong></span
									>
									<span
										>消耗
										<strong>{{ formatNumber(item.totalDemand) }}</strong></span
									>
									<span :class="{ danger: item.pureGap > 0 }">
										缺口 <strong>{{ formatNumber(item.pureGap) }}</strong>
									</span>
								</div>
								<div class="toolbar-result">
									<span
										>系统建议
										<strong>{{
											formatNumber(getItemSuggestedQty(item))
										}}</strong></span
									>
									<span class="is-current"
										>本次
										<strong>{{ getItemManualSummaryText(item) }}</strong></span
									>
									<span class="toolbar-status">{{
										getItemManualPoolSummaryText(item)
									}}</span>
									<span
										class="toolbar-status"
										:class="{
											warning:
												getItemManualDeltaText(item) !== '与系统建议一致'
										}"
									>
										{{ getItemManualDeltaText(item) }}
									</span>
									<span
										class="toolbar-status"
										:class="{ success: getItemSaveCount(item) > 0 }"
									>
										{{ getItemSaveSummaryText(item) }}
									</span>
								</div>
								<div class="toolbar-actions">
									<el-button
										size="small"
										plain
										:icon="Refresh"
										:loading="calculating"
										@click="calculateItems([item], false)"
									>
										重新推演
									</el-button>
									<el-button
										v-if="getItemSaveCount(item) > 0"
										size="small"
										plain
										type="info"
										@click="openTempDrawer(item)"
									>
										查看本品
									</el-button>
									<el-badge
										:value="getItemSaveCount(item)"
										:hidden="getItemSaveCount(item) === 0"
										:max="99"
										type="info"
									>
										<el-button
											size="small"
											type="warning"
											plain
											:disabled="!canSaveTempRecord(item)"
											@click="saveTempRecord(item)"
										>
											暂存本品
										</el-button>
									</el-badge>
								</div>
							</div>
							<div v-if="item.remainingGap > 0" class="toolbar-warning-line">
								<span class="remark-dot"></span>
								<span>{{ item.remark }}</span>
							</div>
						</div>
					</div>
				</div>

				<el-empty v-if="dialogItems.length === 0" description="暂无可发货产品" />
			</div>
		</div>

		<template #footer>
			<div class="dialog-footer">
				<div class="footer-summary">
					<el-tag type="info" effect="plain" round
						>共 {{ dialogItems.length }} 个产品</el-tag
					>
					<el-tag type="primary" effect="plain" round>
						当前填写 {{ manualShipSummary.productCount }} 品 /
						{{ manualShipSummary.segmentCount }} 段 /
						{{ formatNumber(manualShipSummary.totalShipQty) }} 件
					</el-tag>
					<el-tag type="warning" effect="light" round>
						已暂存 {{ tempSaveSummary.productCount }} 品 /
						{{ tempSaveSummary.segmentCount }} 段
					</el-tag>
					<el-tag type="success" effect="light" round>
						暂存发货 {{ formatNumber(tempSaveSummary.totalShipQty) }} 件
					</el-tag>
					<el-button
						size="small"
						type="warning"
						plain
						:disabled="manualShipSummary.segmentCount === 0 && totalTempSaves === 0"
						@click="saveAllTempRecords"
					>
						{{
							manualShipSummary.segmentCount > 0 ? "一键暂存全部填写" : "同步清空暂存"
						}}
					</el-button>
					<el-button
						v-if="totalTempSaves > 0"
						size="small"
						type="info"
						plain
						@click="openTempDrawer()"
					>
						查看暂存
					</el-button>
				</div>
				<div class="footer-actions">
					<span v-if="nextStepHint" class="footer-next-hint">
						<el-icon><warning /></el-icon>
						{{ nextStepHint }}
					</span>
					<el-button
						v-if="shipPlanSubmitResult"
						type="primary"
						plain
						@click="finalConfirmDialog.visible = true"
					>
						查看提交结果
					</el-button>
					<el-button @click="requestCloseDialog">取消</el-button>
					<el-tooltip
						:content="nextStepDisabledReason"
						:disabled="!nextStepDisabledReason"
						placement="top-end"
					>
						<span class="next-step-tooltip-trigger">
							<el-button
								type="primary"
								:disabled="nextStepDisabled"
								@click="handleNextStep"
							>
								下一步：填写发货单据
							</el-button>
						</span>
					</el-tooltip>
				</div>
			</div>
		</template>
	</el-dialog>

	<el-drawer
		v-model="replenishTraceDrawer.visible"
		size="1060px"
		:append-to-body="true"
		class="replenish-trace-drawer"
	>
		<template #header>
			<div class="trace-drawer-header">
				<div>
					<strong>补货依据</strong>
					<span>
						{{ replenishTraceDrawerItem?.product_name || "-" }}
						/ MSKU {{ replenishTraceDrawerItem?.msku || "-" }}
					</span>
				</div>
				<el-tag type="primary" effect="plain" round>
					{{ getDrawerTraceSummary() }}
				</el-tag>
			</div>
		</template>

		<div class="trace-drawer-body">
			<el-empty v-if="!replenishTraceDrawerItem" description="暂无产品" />
			<div v-else-if="replenishTraceDrawerItem._replenishTraceLoading" class="trace-loading">
				<el-icon class="is-loading"><loading-icon /></el-icon>
				<span>正在加载完整补货依据...</span>
			</div>
			<el-empty
				v-else-if="!replenishTraceDrawerTraces.length"
				:description="replenishTraceDrawerItem._replenishTraceError || '暂无补货依据'"
			/>
			<div v-else class="trace-workspace">
				<aside class="trace-plan-list">
					<div class="trace-plan-list-head">
						<strong>补货依据记录</strong>
						<span>按分析记录去重，采购单挂在依据下</span>
					</div>
					<template v-for="group in replenishTraceDrawerGroups" :key="group.key">
						<div v-if="group.traces.length" class="trace-plan-group-title">
							<strong>{{ group.title }}</strong>
							<span>{{ group.traces.length }} 条</span>
						</div>
						<button
							v-for="trace in group.traces"
							:key="trace.key"
							type="button"
							class="trace-plan-card"
							:class="{
								active: selectedReplenishTrace?.key === trace.key,
								error: trace.error,
								history: !trace.error && !isTraceActionable(trace)
							}"
							@click="selectReplenishTrace(trace)"
						>
							<div class="trace-plan-title">
								<strong>{{ getTracePlanTitle(trace) }}</strong>
								<el-tag size="small" :type="getTraceTagType(trace)" effect="plain">
									{{ getTraceSnapshotLabel(trace) }}
								</el-tag>
							</div>
							<div class="trace-plan-meta">
								<span>分析ID {{ trace.analysis_record_id || "-" }}</span>
								<span
									>关联
									{{ trace.linked_order_count || trace.linked_order_sns.length }}
									单</span
								>
							</div>
							<div v-if="!trace.error" class="trace-plan-snapshot">
								<span>{{ getTraceCardPurchaseSummary(trace) }}</span>
								<span>{{ getTraceCardPeriodSummary(trace) }}</span>
								<span>{{ getTraceCardCreatorSummary(trace) }}</span>
							</div>
							<div v-if="trace.linked_order_sns.length" class="trace-plan-orders">
								{{ trace.linked_order_sns.join(" / ") }}
							</div>
							<div v-if="trace.error" class="trace-plan-error">{{ trace.error }}</div>
							<div v-else-if="!isTraceActionable(trace)" class="trace-plan-warning">
								{{ getTraceQualityReason(trace) }}
							</div>
						</button>
					</template>
				</aside>

				<section class="trace-detail-panel">
					<el-empty
						v-if="!selectedReplenishTrace || selectedReplenishTrace.error"
						description="当前计划暂无可展示的补货依据"
					/>
					<template v-else>
						<div class="trace-detail-hero">
							<div>
								<span>当前计划</span>
								<strong>{{ getTracePlanTitle(selectedReplenishTrace) }}</strong>
								<em>
									来源：{{ getTraceSnapshotLabel(selectedReplenishTrace) }} /
									分析ID {{ selectedReplenishTrace.analysis_record_id || "-" }}
								</em>
							</div>
							<el-tag :type="getTraceTagType(selectedReplenishTrace)" effect="light">
								{{ selectedReplenishTrace.linked_order_sns.length }} 个采购单
							</el-tag>
						</div>
						<div
							v-if="!isTraceActionable(selectedReplenishTrace)"
							class="trace-quality-alert"
						>
							<strong>{{ getTraceSnapshotLabel(selectedReplenishTrace) }}</strong>
							<span>{{ getTraceQualityReason(selectedReplenishTrace) }}</span>
						</div>

						<div class="trace-summary-grid">
							<div
								v-for="card in getTraceSummaryCards(selectedReplenishTrace)"
								:key="card.key || card.label"
								class="trace-summary-card"
							>
								<span>{{ card.label }}</span>
								<strong>{{ getTraceSummaryMetricValue(card) }}</strong>
							</div>
							<el-tooltip
								:disabled="!getTraceManualRemark(selectedReplenishTrace)"
								placement="top"
								effect="light"
								:teleported="true"
								:fallback-placements="['bottom', 'top-start', 'bottom-start']"
								popper-class="trace-record-remark-tooltip"
							>
								<template #content>
									<div class="trace-record-remark-tooltip-panel">
										<strong>人工备注</strong>
										<p>{{ getTraceManualRemark(selectedReplenishTrace) }}</p>
									</div>
								</template>
								<div
									class="trace-summary-card trace-summary-remark"
									:class="{
										'has-content': getTraceManualRemark(selectedReplenishTrace)
									}"
								>
									<span>人工备注</span>
									<strong>{{
										getTraceManualRemark(selectedReplenishTrace) || "未填写"
									}}</strong>
								</div>
							</el-tooltip>
						</div>

						<div class="trace-section">
							<div class="trace-section-title">
								<strong>原补货运输段</strong>
								<span>还原当时补货计划分配到各运输方式的数量</span>
							</div>
							<div class="trace-segment-grid">
								<div
									v-for="segment in getTraceShippingSegments(
										selectedReplenishTrace
									)"
									:key="segment.key"
									class="trace-segment-card"
								>
									<div class="trace-segment-head">
										<strong>{{ segment.label }}</strong>
										<el-tag size="small" effect="plain">{{
											segment.status_text || "-"
										}}</el-tag>
									</div>
									<div class="trace-segment-qty">
										{{ formatNumber(segment.quantity) }}
									</div>
									<div class="trace-segment-meta">
										<span
											>系统 {{ formatNumber(segment.system_quantity) }}</span
										>
										<span>{{ segment.period_label || "无覆盖周期" }}</span>
									</div>
									<div
										v-if="segment.coefficient_chain_text"
										class="trace-segment-formula"
									>
										{{ segment.coefficient_chain_text }}
									</div>
								</div>
								<el-empty
									v-if="!getTraceShippingSegments(selectedReplenishTrace).length"
									class="trace-section-empty"
									:description="
										getTraceMissingSectionText(
											selectedReplenishTrace,
											'shipping_json'
										)
									"
									:image-size="42"
								/>
							</div>
						</div>

						<div class="trace-two-col">
							<div class="trace-section">
								<div class="trace-section-title">
									<strong>公式拆解</strong>
									<span
										>{{
											getTraceFormulaSteps(selectedReplenishTrace).length
										}}
										步</span
									>
								</div>
								<div class="trace-step-list">
									<div
										v-for="(step, stepIndex) in getTraceFormulaSteps(
											selectedReplenishTrace
										)"
										:key="`${stepIndex}-${step}`"
										class="trace-step-row"
									>
										<span>{{ stepIndex + 1 }}</span>
										<strong>{{ step }}</strong>
									</div>
									<el-empty
										v-if="!getTraceFormulaSteps(selectedReplenishTrace).length"
										description="暂无公式拆解"
										:image-size="36"
									/>
								</div>
							</div>

							<div class="trace-section">
								<div class="trace-section-title">
									<strong>系数复盘</strong>
									<span>原始、波动、最终系数</span>
								</div>
								<div class="trace-coeff-list">
									<div
										v-for="row in getTraceCoefficientRows(
											selectedReplenishTrace
										)"
										:key="row.key"
										class="trace-coeff-row"
									>
										<strong>{{ row.label }}</strong>
										<span>原始 {{ row.raw_coefficient_text || "-" }}</span>
										<span
											>波动 {{ row.volatility_coefficient_text || "-" }}</span
										>
										<span
											>最终
											{{
												row.adjusted_coefficient_text || row.value || "-"
											}}</span
										>
										<em>{{ row.subtotal_text || "-" }}</em>
									</div>
									<el-empty
										v-if="
											!getTraceCoefficientRows(selectedReplenishTrace).length
										"
										description="暂无系数数据"
										:image-size="36"
									/>
								</div>
							</div>
						</div>

						<div class="trace-three-col">
							<div class="trace-section compact">
								<div class="trace-section-title"><strong>需求口径</strong></div>
								<div class="trace-kv-list">
									<div
										v-for="row in getTraceDemandRows(selectedReplenishTrace)"
										:key="row.key"
										class="trace-kv-row"
									>
										<span>{{ row.label }}</span>
										<strong>{{ formatNumber(row.value) }}</strong>
									</div>
								</div>
							</div>
							<div class="trace-section compact">
								<div class="trace-section-title"><strong>扣减明细</strong></div>
								<div class="trace-kv-list">
									<div
										v-for="row in getTraceDeductionRows(selectedReplenishTrace)"
										:key="row.key"
										class="trace-kv-row"
									>
										<span>{{ row.label }}</span>
										<strong>{{ formatNumber(row.value) }}</strong>
									</div>
								</div>
							</div>
							<div class="trace-section compact">
								<div class="trace-section-title"><strong>库存明细</strong></div>
								<div class="trace-kv-list">
									<div
										v-for="row in getTraceInventoryRows(selectedReplenishTrace)"
										:key="row.key"
										class="trace-kv-row"
									>
										<span>{{ row.label }}</span>
										<strong>{{ formatNumber(row.value) }}</strong>
									</div>
								</div>
							</div>
						</div>

						<div class="trace-section">
							<div class="trace-section-title">
								<strong>关联采购单</strong>
								<span>{{ selectedReplenishTrace.linked_order_sns.length }} 个</span>
							</div>
							<div class="trace-order-list">
								<span
									v-for="orderSn in selectedReplenishTrace.linked_order_sns"
									:key="orderSn"
									>{{ orderSn }}</span
								>
								<span v-if="!selectedReplenishTrace.linked_order_sns.length"
									>暂无关联采购单</span
								>
							</div>
						</div>

						<el-collapse class="trace-raw-collapse">
							<el-collapse-item name="raw">
								<template #title>
									<div class="trace-section-title raw-title">
										<strong>原始快照区块</strong>
										<span>用于排查，默认收起</span>
									</div>
								</template>
								<div class="trace-raw-grid">
									<div
										v-for="section in getTraceRawSnapshotSections(
											selectedReplenishTrace
										)"
										:key="section.key"
										class="trace-raw-card"
									>
										<strong>{{ section.label }}</strong>
										<pre>{{ formatTraceJson(section.value) }}</pre>
									</div>
								</div>
							</el-collapse-item>
						</el-collapse>
					</template>
				</section>
			</div>
		</div>
	</el-drawer>

	<el-drawer
		v-model="shipHistoryDrawer.visible"
		size="980px"
		:append-to-body="true"
		class="ship-history-drawer"
	>
		<template #header>
			<div class="ship-history-drawer-header">
				<div>
					<strong>发货历史</strong>
					<span>
						{{ shipHistoryDrawerItem?.product_name || "-" }}
						/ MSKU {{ shipHistoryDrawerItem?.msku || "-" }}
					</span>
				</div>
			</div>
		</template>

		<div class="ship-history-body">
			<el-empty v-if="!shipHistoryDrawerItem" description="暂无产品" />
			<div v-else-if="shipHistoryDrawerItem._shipHistoryLoading" class="ship-history-loading">
				<el-icon class="is-loading"><loading-icon /></el-icon>
				<span>正在加载发货历史...</span>
			</div>
			<el-empty
				v-else-if="!shipHistoryDrawerData?.batches?.length"
				:description="shipHistoryDrawerItem._shipHistoryError || '暂无发货历史'"
			/>
			<div v-else class="ship-history-list">
				<div class="ship-history-overview">
					<span class="ship-history-overview-title">
						{{ getShipHistoryDrawerSummaryText(shipHistoryDrawerData) }}
					</span>
					<span
						>历史批次
						<strong>{{ shipHistoryDrawerData.summary.batch_count }}</strong></span
					>
					<span class="is-success"
						>成功
						<strong>{{
							formatNumber(shipHistoryDrawerData.summary.success_qty)
						}}</strong>
						件</span
					>
					<span :class="{ 'is-danger': shipHistoryDrawerData.summary.failed_qty > 0 }">
						失败
						<strong>{{
							formatNumber(shipHistoryDrawerData.summary.failed_qty)
						}}</strong>
						件
					</span>
					<span
						>计划
						<strong>{{
							formatNumber(shipHistoryDrawerData.summary.planned_qty)
						}}</strong>
						件</span
					>
				</div>

				<el-collapse v-model="shipHistoryActiveBatches" class="ship-history-collapse">
					<el-collapse-item
						v-for="batch in shipHistoryDrawerData.batches"
						:key="batch.batch_no"
						:name="batch.batch_no"
						class="ship-history-batch"
					>
						<template #title>
							<div class="ship-history-batch-title">
								<div class="ship-history-batch-main">
									<strong>{{ batch.batch_no }}</strong>
									<span>{{ getShipHistoryBatchMetaText(batch) }}</span>
								</div>
								<el-tooltip
									:content="getShipHistoryBatchMethodSummary(batch)"
									placement="top"
									:show-after="180"
								>
									<div class="ship-history-batch-method-chips">
										<span
											v-for="chip in getShipHistoryBatchMethodChips(batch)"
											:key="`${batch.batch_no}-${chip.key}`"
											:class="{ 'is-danger': chip.failedQty > 0 }"
										>
											{{ chip.icon }} {{ chip.label }}
											{{ formatNumber(chip.successQty) }}
											<em v-if="chip.failedQty > 0"
												>失败{{ formatNumber(chip.failedQty) }}</em
											>
										</span>
									</div>
								</el-tooltip>
								<div class="ship-history-batch-actions" @click.stop>
									<el-button
										size="small"
										plain
										:icon="CopyDocument"
										@click.stop="copyShipHistoryBatchInstruction(batch)"
									>
										复制仓库指令
									</el-button>
									<el-tag
										:type="getShipHistoryStatusMeta(batch.status).type"
										effect="light"
									>
										{{ getShipHistoryStatusMeta(batch.status).text }}
									</el-tag>
								</div>
							</div>
						</template>

						<div class="ship-history-expanded-toolbar">
							<span>仓库执行明细</span>
							<el-button
								size="small"
								text
								type="info"
								:icon="CopyDocument"
								@click.stop="copyShipHistoryFullBatchRecord(batch)"
							>
								复制完整记录
							</el-button>
						</div>

						<div class="ship-history-methods">
							<div
								v-for="group in batch.method_groups"
								:key="group.group_key"
								class="ship-history-method-card"
							>
								<div class="ship-history-method-head">
									<div>
										<strong>
											{{ getShippingMethodInfo(group.method_key)?.icon }}
											{{ group.method_label || group.method_key || "-" }}
											<em>{{ formatNumber(group.planned_qty) }}件</em>
										</strong>
										<span>{{ getShipHistoryGroupSubText(group) }}</span>
									</div>
									<div class="ship-history-method-side">
										<div
											class="ship-history-method-qty"
											:class="{
												'is-danger': normalizeNumber(group.failed_qty) > 0
											}"
										>
											<span>{{
												normalizeNumber(group.failed_qty) > 0
													? "失败"
													: "成功"
											}}</span>
											<strong>
												{{
													formatNumber(
														normalizeNumber(group.failed_qty) > 0
															? group.failed_qty
															: group.success_qty
													)
												}}
											</strong>
											<em>/ {{ formatNumber(group.planned_qty) }} 件</em>
										</div>
										<el-button
											size="small"
											text
											type="primary"
											:icon="CopyDocument"
											@click.stop="
												copyShipHistoryMethodInstruction(batch, group)
											"
										>
											复制本方式
										</el-button>
									</div>
								</div>

								<div class="ship-history-group-tags">
									<el-tag size="small" effect="plain">{{
										group.warehouse_name || "未填写仓库"
									}}</el-tag>
									<el-tag size="small" type="info" effect="plain">
										{{ getBatchShipPackingTypeLabel(group.packing_type) }}
									</el-tag>
									<el-tag size="small" effect="plain">{{
										formatShipHistoryDate(group.shipment_time) || "未填写日期"
									}}</el-tag>
									<el-tooltip
										:content="getShipHistorySeqText(group)"
										placement="top"
										:show-after="180"
									>
										<el-tag size="small" type="success" effect="plain">
											领星 {{ group.seqs.length || 0 }} 批
										</el-tag>
									</el-tooltip>
								</div>

								<div class="ship-history-allocation-table">
									<div class="ship-history-allocation-row is-header">
										<span>采购计划</span>
										<span>采购单</span>
										<span>领星批次</span>
										<span>数量</span>
										<span>状态</span>
									</div>
									<div
										v-for="allocation in group.allocations"
										:key="allocation.id"
										class="ship-history-allocation-row"
									>
										<el-tooltip
											:content="allocation.purchase_plan_sn || '-'"
											placement="top-start"
											:show-after="180"
										>
											<span class="mono">{{
												allocation.purchase_plan_sn || "-"
											}}</span>
										</el-tooltip>
										<el-tooltip
											:content="allocation.purchase_order_sn || '-'"
											placement="top-start"
											:show-after="180"
										>
											<span class="mono">{{
												allocation.purchase_order_sn || "-"
											}}</span>
										</el-tooltip>
										<el-tooltip
											:content="allocation.lingxing_seq || '-'"
											placement="top-start"
											:show-after="180"
										>
											<span class="mono">{{
												allocation.lingxing_seq || "-"
											}}</span>
										</el-tooltip>
										<strong>{{ formatNumber(allocation.ship_qty) }}</strong>
										<el-tooltip
											:disabled="
												!allocation.error_message &&
												!allocation.local_sync_error
											"
											:content="
												allocation.error_message ||
												allocation.local_sync_error
											"
											placement="top-end"
											:show-after="180"
										>
											<el-tag
												size="small"
												:type="
													getShipHistoryStatusMeta(allocation.status).type
												"
												effect="plain"
											>
												{{
													getShipHistoryStatusMeta(allocation.status).text
												}}
											</el-tag>
										</el-tooltip>
									</div>
								</div>
							</div>
						</div>
					</el-collapse-item>
				</el-collapse>
			</div>
		</div>
	</el-drawer>

	<el-drawer
		v-model="tempSaveDrawerVisible"
		title="暂存发货记录"
		size="560px"
		:append-to-body="true"
	>
		<div class="temp-drawer">
			<div class="temp-drawer-head">
				<div>
					<div class="temp-drawer-title">
						{{
							tempSaveDrawerFilterKey ? "本品暂存记录" : `已暂存 ${totalTempSaves} 条`
						}}
					</div>
					<div class="temp-drawer-sub">
						当前显示 {{ visibleTempSaveRecords.length }} 段，合计
						{{
							formatNumber(
								visibleTempSaveRecords.reduce(
									(sum, record) => sum + normalizeNumber(record.shipQty),
									0
								)
							)
						}}
						件
					</div>
				</div>
				<el-button
					v-if="tempSaveDrawerFilterKey"
					size="small"
					plain
					@click="openTempDrawer()"
				>
					查看全部
				</el-button>
				<el-button
					v-if="visibleTempSaveRecords.length > 0"
					size="small"
					type="danger"
					plain
					@click="clearCurrentTempRecords"
				>
					清空
				</el-button>
			</div>
			<el-empty v-if="visibleTempSaveRecords.length === 0" description="暂无暂存记录" />
			<div
				v-for="record in visibleTempSaveRecords"
				v-else
				:key="record.id"
				class="temp-record"
			>
				<div class="temp-record-main">
					<div class="temp-record-line">
						<span
							class="temp-method-dot"
							:style="{ background: record.shippingColor || '#909399' }"
						></span>
						<strong>{{ record.shippingIcon }} {{ record.shippingLabel }}</strong>
						<span>{{ record.dateRange[0] }} ~ {{ record.dateRange[1] }}</span>
						<el-tag
							v-if="record.manualAdjusted"
							size="small"
							type="warning"
							effect="plain"
							>人工调整</el-tag
						>
					</div>
					<div class="temp-record-line is-sub">
						<span>MSKU {{ record.msku || "-" }}</span>
						<span>采购单 {{ record.orderDetails.length }} 个</span>
						<span>系统建议 {{ formatNumber(record.systemSuggestQty) }}</span>
						<span>{{ record.algoLabel }}</span>
					</div>
				</div>
				<div class="temp-record-qty">
					<strong>{{ formatNumber(record.shipQty) }}</strong>
					<span>件</span>
				</div>
				<el-button
					type="danger"
					link
					:icon="Delete"
					@click="deleteTempRecord(record.itemKey, record.id)"
				/>
			</div>
		</div>
	</el-drawer>

	<el-dialog
		v-model="shipPlanDialog.visible"
		title="填写发货单据"
		width="1320px"
		top="4vh"
		:append-to-body="true"
		class="ship-plan-form-dialog"
	>
		<div class="ship-plan-form" v-loading="warehouseLoading">
			<el-empty v-if="shipPlanDialog.records.length === 0" description="暂无暂存发货记录" />
			<el-collapse v-else v-model="shipPlanActiveCollapse" class="ship-method-collapse">
				<el-collapse-item
					v-for="(group, methodKey) in groupedPlanRecords"
					:key="String(methodKey)"
					:name="String(methodKey)"
				>
					<template #title>
						<div class="ship-method-title">
							<span
								class="ship-method-dot"
								:style="{ background: group.method?.color || '#909399' }"
							></span>
							<strong
								>{{ group.method?.icon }}
								{{ group.method?.label || methodKey }}</strong
							>
							<el-tag size="small" round type="info"
								>{{ group.records.length }} 个产品</el-tag
							>
							<el-tag size="small" round type="success"
								>共 {{ formatNumber(getGroupShipQty(group.records)) }} 件</el-tag
							>
							<el-tag size="small" round type="warning" effect="plain">
								{{ getGroupOrderCount(group.records) }} 个采购单明细
							</el-tag>
						</div>
					</template>

					<div class="ship-batch-bar">
						<span class="ship-batch-label">批量应用</span>
						<el-select
							v-model="batchValues[methodKey].warehouse"
							size="small"
							placeholder="发货仓库"
							clearable
							@change="
								(value) => batchSetPlanField(String(methodKey), 'warehouse', value)
							"
						>
							<el-option-group v-if="warehouseList.local.length" label="本地仓">
								<el-option
									v-for="item in warehouseList.local"
									:key="item.wid"
									:label="item.name"
									:value="item.wid"
								/>
							</el-option-group>
							<el-option-group v-if="warehouseList.overseas.length" label="海外仓">
								<el-option
									v-for="item in warehouseList.overseas"
									:key="item.wid"
									:label="item.name"
									:value="item.wid"
								/>
							</el-option-group>
							<el-option-group v-if="warehouseList.awd.length" label="AWD仓">
								<el-option
									v-for="item in warehouseList.awd"
									:key="item.wid"
									:label="item.name"
									:value="item.wid"
								/>
							</el-option-group>
						</el-select>
						<el-select
							v-model="batchValues[methodKey].packageType"
							size="small"
							placeholder="包装类型"
							clearable
							@change="
								(value) =>
									batchSetPlanField(String(methodKey), 'packageType', value)
							"
						>
							<el-option
								v-for="option in packageTypeOptions"
								:key="option.value"
								:label="option.label"
								:value="option.value"
							/>
						</el-select>
						<el-date-picker
							v-model="batchValues[methodKey].planShipDate"
							size="small"
							type="date"
							value-format="YYYY-MM-DD"
							placeholder="发货时间"
							:disabled-date="disabledShipDate"
							@change="
								(value) =>
									batchSetPlanField(String(methodKey), 'planShipDate', value)
							"
						/>
					</div>

					<div class="ship-plan-records">
						<div
							v-for="record in group.records"
							:key="record.id"
							class="ship-plan-record"
							:class="{
								'is-collapsed': !isShipPlanRecordExpanded(String(methodKey), record)
							}"
						>
							<div class="ship-record-main">
								<el-image
									v-if="record.productImg"
									:src="record.productImg"
									fit="contain"
									class="ship-record-img"
									:preview-src-list="[record.productImg]"
									preview-teleported
								/>
								<div class="ship-record-info">
									<div class="ship-record-name">
										{{ record.productName || record.msku || "-" }}
									</div>
									<div class="ship-record-meta">
										<span>MSKU {{ record.msku || "-" }}</span>
										<span>FNSKU {{ record.fnsku || "-" }}</span>
										<span>本段发货 {{ formatNumber(record.shipQty) }} 件</span>
										<span>来自 {{ record.orderDetails.length }} 个采购单</span>
									</div>
								</div>
								<div class="ship-record-qty">
									<span>发货数量</span>
									<strong>{{ formatNumber(record.shipQty) }}</strong>
								</div>
								<div class="ship-record-expand">
									<el-tag
										size="small"
										:type="
											isShipPlanRecordConfigured(record)
												? 'success'
												: 'warning'
										"
										effect="plain"
									>
										{{
											isShipPlanRecordConfigured(record) ? "已配置" : "待配置"
										}}
									</el-tag>
									<el-button
										class="ship-record-expand-button"
										size="small"
										text
										@click="
											toggleShipPlanRecordExpanded(String(methodKey), record)
										"
									>
										{{
											isShipPlanRecordExpanded(String(methodKey), record)
												? "收起"
												: "展开"
										}}
										<el-icon
											class="ship-record-expand-icon"
											:class="{
												'is-expanded': isShipPlanRecordExpanded(
													String(methodKey),
													record
												)
											}"
										>
											<arrow-down />
										</el-icon>
									</el-button>
								</div>
							</div>

							<div
								v-show="isShipPlanRecordExpanded(String(methodKey), record)"
								class="ship-record-detail"
							>
								<div class="ship-record-controls">
									<span class="ship-control-label">明细属性</span>
									<el-select
										v-model="record.warehouse"
										size="small"
										placeholder="发货仓库"
										clearable
									>
										<el-option-group
											v-if="warehouseList.local.length"
											label="本地仓"
										>
											<el-option
												v-for="item in warehouseList.local"
												:key="item.wid"
												:label="item.name"
												:value="item.wid"
											/>
										</el-option-group>
										<el-option-group
											v-if="warehouseList.overseas.length"
											label="海外仓"
										>
											<el-option
												v-for="item in warehouseList.overseas"
												:key="item.wid"
												:label="item.name"
												:value="item.wid"
											/>
										</el-option-group>
										<el-option-group
											v-if="warehouseList.awd.length"
											label="AWD仓"
										>
											<el-option
												v-for="item in warehouseList.awd"
												:key="item.wid"
												:label="item.name"
												:value="item.wid"
											/>
										</el-option-group>
									</el-select>
									<el-select
										v-model="record.packageType"
										size="small"
										placeholder="包装类型"
										clearable
									>
										<el-option
											v-for="option in packageTypeOptions"
											:key="option.value"
											:label="option.label"
											:value="option.value"
										/>
									</el-select>
									<el-date-picker
										v-model="record.planShipDate"
										size="small"
										type="date"
										value-format="YYYY-MM-DD"
										placeholder="发货时间"
										:disabled-date="disabledShipDate"
									/>
									<el-input
										v-model="record.remark"
										size="small"
										placeholder="明细备注"
									/>
								</div>

								<div class="ship-order-detail-head">
									<span>采购单发货拆分</span>
									<el-tag size="small" type="info" effect="plain"
										>{{ record.orderDetails.length }} 条</el-tag
									>
								</div>
								<div class="ship-order-detail-table">
									<div class="ship-order-detail-row header">
										<span>采购单</span>
										<span>采购计划</span>
										<span>实际可发</span>
										<span>本次发货</span>
									</div>
									<div
										v-for="order in record.orderDetails"
										:key="`${record.id}-${order.order_sn}-${order.plan_sn}`"
										class="ship-order-detail-row"
									>
										<el-tooltip
											:content="order.order_sn || '-'"
											placement="top-start"
											:show-after="180"
										>
											<span class="mono order-detail-code">{{
												order.order_sn || "-"
											}}</span>
										</el-tooltip>
										<el-tooltip
											:content="order.plan_sn || '-'"
											placement="top-start"
											:show-after="180"
										>
											<span class="mono order-detail-code">{{
												order.plan_sn || "-"
											}}</span>
										</el-tooltip>
										<span>{{ formatNumber(order.actual_shippable_qty) }}</span>
										<strong>{{ formatNumber(order.ship_qty) }}</strong>
									</div>
								</div>

								<div class="ship-record-summary">
									<span>仓库：{{ getWarehouseName(record.warehouse) }}</span>
									<span
										>包装：{{
											packageTypeOptions.find(
												(option) => option.value === record.packageType
											)?.label || "-"
										}}</span
									>
									<span>发货时间：{{ record.planShipDate || "-" }}</span>
								</div>
							</div>
						</div>
					</div>

					<div class="ship-batch-remark">
						<span>批次备注</span>
						<el-input
							v-model="batchValues[methodKey].batchRemark"
							type="textarea"
							:rows="2"
							:placeholder="`可选，填写 ${group.method?.icon || ''} ${group.method?.label || methodKey} 批次备注`"
						/>
					</div>
				</el-collapse-item>
			</el-collapse>
		</div>

		<template #footer>
			<div class="ship-plan-footer">
				<span
					>配置完成后会进入最终确认，确认后按运输方式和采购单拆分创建领星发货计划。</span
				>
				<div>
					<el-button @click="shipPlanDialog.visible = false">返回</el-button>
					<el-button type="primary" @click="finishShipPlanConfig">完成配置</el-button>
				</div>
			</div>
		</template>
	</el-dialog>

	<el-dialog
		v-model="finalConfirmDialog.visible"
		title="发货计划最终确认"
		width="1280px"
		top="5vh"
		:append-to-body="true"
		class="ship-final-confirm-dialog"
	>
		<div class="ship-final-confirm">
			<div v-if="!shipPlanSubmitResult" class="final-method-list">
				<div
					v-for="group in finalConfirmMethodGroups"
					:key="group.methodKey"
					class="final-method-card"
				>
					<div class="final-method-head">
						<div>
							<span
								class="ship-method-dot"
								:style="{ background: group.method?.color || '#909399' }"
							></span>
							<strong
								>{{ group.method?.icon }}
								{{ group.method?.label || group.methodKey }}</strong
							>
							<el-tag size="small" type="info" round
								>{{ group.productCount }} 个产品</el-tag
							>
							<el-tag size="small" type="success" round
								>共 {{ formatNumber(group.totalQty) }} 件</el-tag
							>
						</div>
						<span>{{ group.orderCount }} 条采购单拆分</span>
					</div>
					<el-table
						:data="group.records"
						size="small"
						border
						row-key="id"
						:expand-row-keys="getFinalConfirmExpandedRowKeys(group.methodKey)"
						@expand-change="
							(row, expandedRows) =>
								handleFinalConfirmExpandChange(group.methodKey, row, expandedRows)
						"
					>
						<el-table-column type="expand" width="46">
							<template #default="{ row }">
								<div class="final-order-expand">
									<div class="final-order-expand-head">
										<div>
											<strong>采购单发货拆分</strong>
											<span
												>本产品计划发货
												{{ formatNumber(row.shipQty) }} 件，分配至
												{{ row.orderDetails.length }} 个采购单。</span
											>
										</div>
										<el-tag size="small" type="success" effect="plain">
											合计
											{{
												formatNumber(
													getOrderDetailsShipQty(row.orderDetails)
												)
											}}
											件
										</el-tag>
									</div>
									<div class="final-order-expand-table">
										<div class="final-order-expand-row is-header">
											<span>采购单</span>
											<span>所属采购计划</span>
											<span>实际可发</span>
											<span>本次分配</span>
										</div>
										<div
											v-for="order in row.orderDetails"
											:key="`${row.id}-${order.order_sn}-${order.plan_sn}`"
											class="final-order-expand-row"
										>
											<el-tooltip
												:content="order.order_sn || '-'"
												placement="top-start"
												:show-after="180"
											>
												<span class="mono order-detail-code">{{
													order.order_sn || "-"
												}}</span>
											</el-tooltip>
											<el-tooltip
												:content="order.plan_sn || '-'"
												placement="top-start"
												:show-after="180"
											>
												<span class="mono order-detail-code">{{
													order.plan_sn || "-"
												}}</span>
											</el-tooltip>
											<span>{{
												formatNumber(order.actual_shippable_qty)
											}}</span>
											<strong>{{ formatNumber(order.ship_qty) }}</strong>
										</div>
									</div>
								</div>
							</template>
						</el-table-column>
						<el-table-column label="图片" width="70">
							<template #default="{ row }">
								<el-image
									v-if="row.productImg"
									:src="row.productImg"
									fit="contain"
									class="final-product-img"
								/>
							</template>
						</el-table-column>
						<el-table-column label="产品" min-width="260" show-overflow-tooltip>
							<template #default="{ row }">
								<div class="final-product-name">
									{{ row.productName || row.msku || "-" }}
								</div>
								<div class="final-product-sub">
									MSKU {{ row.msku || "-" }} / FNSKU {{ row.fnsku || "-" }}
								</div>
							</template>
						</el-table-column>
						<el-table-column label="计划发货" width="90" align="center">
							<template #default="{ row }">
								<strong class="success">{{ formatNumber(row.shipQty) }}</strong>
							</template>
						</el-table-column>
						<el-table-column label="发货仓库" width="150">
							<template #default="{ row }">{{
								getWarehouseName(row.warehouse)
							}}</template>
						</el-table-column>
						<el-table-column label="包装类型" width="120">
							<template #default="{ row }">
								{{
									packageTypeOptions.find(
										(option) => option.value === row.packageType
									)?.label || "-"
								}}
							</template>
						</el-table-column>
						<el-table-column prop="planShipDate" label="发货时间" width="120" />
						<el-table-column label="采购单拆分" width="150" align="center">
							<template #default="{ row }">
								<button
									type="button"
									class="final-order-summary"
									:class="{
										'is-expanded': getFinalConfirmRowExpanded(
											group.methodKey,
											row
										)
									}"
									@click.stop="
										toggleFinalConfirmRowExpanded(group.methodKey, row)
									"
								>
									<strong>{{ row.orderDetails.length }} 条采购单</strong>
									<span
										>合计分配
										{{ formatNumber(getOrderDetailsShipQty(row.orderDetails)) }}
										件</span
									>
									<em>
										{{
											getFinalConfirmRowExpanded(group.methodKey, row)
												? "收起明细"
												: "查看拆分"
										}}
										<el-icon><arrow-down /></el-icon>
									</em>
								</button>
							</template>
						</el-table-column>
						<el-table-column
							prop="remark"
							label="备注"
							min-width="120"
							show-overflow-tooltip
						/>
					</el-table>
				</div>
			</div>

			<div v-else class="final-result-panel">
				<div class="final-result-head">
					<div class="final-result-heading">
						<strong>提交结果：{{ shipPlanSubmitResult.batch_no || "-" }}</strong>
						<span>{{
							getBatchShipSubmitStatusMeta(shipPlanSubmitResult.batch?.status)
								.description
						}}</span>
					</div>
					<div class="final-result-actions">
						<el-button
							v-if="getBatchShipSuccessfulExecutionGroupCount() > 0"
							size="small"
							type="primary"
							plain
							:icon="CopyDocument"
							@click="copyBatchShipSubmitSuccessInstruction"
						>
							{{ getBatchShipSubmitSuccessCopyButtonText() }}
						</el-button>
						<el-button
							v-if="shipPlanSubmitResult.failed_items?.length"
							size="small"
							type="warning"
							plain
							:icon="CopyDocument"
							@click="copyBatchShipSubmitFailureList"
						>
							复制失败清单
						</el-button>
						<el-button
							v-if="getBatchShipLocalSyncFailedCount() > 0"
							size="small"
							type="danger"
							plain
							:icon="CopyDocument"
							@click="copyBatchShipSubmitLocalSyncFailureList"
						>
							复制同步异常
						</el-button>
						<el-tag
							:type="
								getBatchShipSubmitStatusMeta(shipPlanSubmitResult.batch?.status)
									.type
							"
							effect="light"
						>
							{{
								getBatchShipSubmitStatusMeta(shipPlanSubmitResult.batch?.status)
									.text
							}}
						</el-tag>
					</div>
				</div>
				<div class="final-result-overview">
					<span
						>计划
						<strong>{{
							formatNumber(getBatchShipSubmitTotalQty("planned_total_qty"))
						}}</strong>
						件</span
					>
					<span class="is-success"
						>成功
						<strong>{{
							formatNumber(getBatchShipSubmitTotalQty("success_total_qty"))
						}}</strong>
						件</span
					>
					<span
						:class="{ 'is-danger': getBatchShipSubmitTotalQty('failed_total_qty') > 0 }"
					>
						失败
						<strong>{{
							formatNumber(getBatchShipSubmitTotalQty("failed_total_qty"))
						}}</strong>
						件
					</span>
					<span
						>领星批次 <strong>{{ getBatchShipSubmitSeqCount() }}</strong> 个</span
					>
					<span v-if="getBatchShipLocalSyncFailedQty() > 0" class="is-danger">
						本地同步异常
						<strong>{{ formatNumber(getBatchShipLocalSyncFailedQty()) }}</strong> 件
					</span>
				</div>
				<div class="final-result-summary">
					<div class="final-result-section-head">
						<div>
							<strong>仓库执行清单</strong>
							<span>仅展示已成功创建的发货计划，仓库可按以下分组直接备货。</span>
						</div>
						<el-tag type="success" effect="plain">
							{{ getBatchShipSuccessfulExecutionGroupCount() }} 个执行组
						</el-tag>
					</div>
					<el-empty
						v-if="getBatchShipSuccessfulExecutionGroupCount() === 0"
						description="暂无创建成功的仓库执行项"
					/>
					<div
						v-for="method in getBatchShipSuccessfulMethods()"
						:key="method.method_key"
						class="final-result-method"
					>
						<div class="final-result-method-head">
							<div>
								<strong>
									{{ getShippingMethodInfo(method.method_key)?.icon }}
									{{ method.method_label }}
								</strong>
								<span>{{ getBatchShipMethodSummaryText(method) }}</span>
							</div>
							<el-button
								size="small"
								plain
								:icon="CopyDocument"
								@click="copyBatchShipSubmitMethodInstruction(method)"
							>
								复制本方式
							</el-button>
						</div>
						<div
							v-for="group in getSuccessfulWarehouseExecutionGroups(method)"
							:key="group.group_key"
							class="warehouse-execution-card"
						>
							<div class="warehouse-execution-head">
								<div class="warehouse-execution-title">
									<strong>{{ group.warehouse_name || "未填写仓库" }}</strong>
									<el-tag size="small" type="info" effect="plain">
										{{ getBatchShipPackingTypeLabel(group.packing_type) }}
									</el-tag>
									<el-tag size="small" effect="plain">{{
										group.shipment_time || "未填写日期"
									}}</el-tag>
									<el-tag size="small" type="success" effect="light">
										成功 {{ formatNumber(group.success_qty) }} 件
									</el-tag>
								</div>
								<div class="warehouse-execution-seqs">
									<span>领星批次</span>
									<el-tooltip
										:content="getBatchShipExecutionSeqText(group)"
										placement="top-end"
										:show-after="180"
									>
										<strong>{{ getBatchShipExecutionSeqText(group) }}</strong>
									</el-tooltip>
								</div>
							</div>
							<div v-if="group.batch_remark" class="warehouse-execution-remark">
								<span>批次备注</span>
								<strong>{{ group.batch_remark }}</strong>
							</div>
							<div class="warehouse-execution-products">
								<div
									v-for="product in getSuccessfulWarehouseProducts(group)"
									:key="product.msku || product.asin || product.product_name"
									class="warehouse-execution-product"
								>
									<div class="warehouse-product-head">
										<div>
											<strong>{{
												product.product_name || product.msku || "-"
											}}</strong>
											<span
												>MSKU {{ product.msku || "-" }} · FNSKU
												{{ product.fnsku || "-" }}</span
											>
										</div>
										<div class="warehouse-product-qty">
											<span>发货数量</span>
											<strong>{{ formatNumber(product.success_qty) }}</strong>
											<em>件</em>
										</div>
									</div>
									<div class="warehouse-allocation-table">
										<div class="warehouse-allocation-row is-header">
											<span>采购计划</span>
											<span>采购单</span>
											<span>领星批次</span>
											<span>本次发货</span>
										</div>
										<div
											v-for="allocation in getSuccessfulWarehouseAllocations(
												product
											)"
											:key="`${allocation.purchase_plan_sn}_${allocation.purchase_order_sn}_${allocation.lingxing_seq}`"
											class="warehouse-allocation-row"
										>
											<el-tooltip
												:content="allocation.purchase_plan_sn || '-'"
												placement="top-start"
												:show-after="180"
											>
												<span class="mono">{{
													allocation.purchase_plan_sn || "-"
												}}</span>
											</el-tooltip>
											<el-tooltip
												:content="allocation.purchase_order_sn || '-'"
												placement="top-start"
												:show-after="180"
											>
												<span class="mono">{{
													allocation.purchase_order_sn || "-"
												}}</span>
											</el-tooltip>
											<el-tooltip
												:content="allocation.lingxing_seq || '-'"
												placement="top-start"
												:show-after="180"
											>
												<span class="mono">{{
													allocation.lingxing_seq || "-"
												}}</span>
											</el-tooltip>
											<strong>{{ formatNumber(allocation.qty) }} 件</strong>
										</div>
									</div>
									<div
										v-if="product.detail_remark"
										class="warehouse-product-remark"
									>
										<span>商品备注</span>
										<strong>{{ product.detail_remark }}</strong>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div v-if="shipPlanSubmitResult.failed_items?.length" class="final-fail-list">
					<div class="final-fail-title">失败项</div>
					<div
						v-for="item in shipPlanSubmitResult.failed_items"
						:key="item.id"
						class="final-fail-row"
					>
						<div class="final-fail-identity">
							<strong>{{ item.method_label }} · {{ item.msku }}</strong>
							<span
								>{{ item.purchase_order_sn || "-" }} /
								{{ item.purchase_plan_sn || "-" }}</span
							>
						</div>
						<div class="final-fail-qty">
							<span>失败</span>
							<strong>{{ formatNumber(item.ship_qty) }}</strong>
							<span>件</span>
						</div>
						<el-popover
							placement="top-end"
							:width="560"
							trigger="click"
							teleported
							popper-class="batch-ship-failure-popover"
						>
							<template #reference>
								<button type="button" class="final-fail-reason">
									<span>{{
										formatBatchShipFailureSummary(item.error_message)
									}}</span>
									<em>查看完整原因</em>
								</button>
							</template>
							<div class="final-fail-popover-content">
								<strong>完整失败原因</strong>
								<p>{{ item.error_message || "创建失败" }}</p>
							</div>
						</el-popover>
					</div>
				</div>
				<div
					v-if="getBatchShipLocalSyncFailedCount() > 0"
					class="final-fail-list is-local-sync"
				>
					<div class="final-fail-title">本地同步异常</div>
					<div
						v-for="item in getBatchShipLocalSyncFailedItems()"
						:key="`local-sync-${item.id}`"
						class="final-fail-row"
					>
						<div class="final-fail-identity">
							<strong>{{ item.method_label }} · {{ item.msku }}</strong>
							<span
								>{{ item.purchase_order_sn || "-" }} /
								{{ item.purchase_plan_sn || "-" }}</span
							>
						</div>
						<div class="final-fail-qty">
							<span>异常</span>
							<strong>{{ formatNumber(item.ship_qty) }}</strong>
							<span>件</span>
						</div>
						<el-popover
							placement="top-end"
							:width="560"
							trigger="click"
							teleported
							popper-class="batch-ship-failure-popover"
						>
							<template #reference>
								<button type="button" class="final-fail-reason">
									<span>{{
										formatBatchShipFailureSummary(
											item.local_sync_error ||
												"领星已创建，本地发货计划同步失败"
										)
									}}</span>
									<em>查看完整原因</em>
								</button>
							</template>
							<div class="final-fail-popover-content">
								<strong>完整同步异常</strong>
								<p>
									{{
										item.local_sync_error ||
										"领星已创建，但本地发货计划同步失败，请到领星或发货计划列表核对。"
									}}
								</p>
							</div>
						</el-popover>
					</div>
				</div>
			</div>
		</div>

		<template #footer>
			<div class="ship-plan-footer">
				<span v-if="!shipPlanSubmitResult">
					确认后会保存为待审核单，不会直接调用领星；审核通过后在审核详情页手动发送。
				</span>
				<span v-else>{{ getBatchShipFinalResultFooterText() }}</span>
				<div>
					<el-button
						v-if="!shipPlanSubmitResult"
						@click="finalConfirmDialog.visible = false"
						>返回修改</el-button
					>
					<el-button v-else @click="closeFinalResultDialog">关闭结果</el-button>
					<el-button
						v-if="!shipPlanSubmitResult"
						plain
						:loading="savingBatchShipReview"
						@click="saveBatchShipReviewDraft"
					>
						保存审核草稿
					</el-button>
					<el-button
						v-if="shipPlanSubmitResult?.failed_items?.length"
						type="warning"
						plain
						:loading="retryingShipPlanFailed"
						@click="retryFailedBatchShipPlan"
					>
						{{ getBatchShipRetryButtonText() }}
					</el-button>
					<el-button
						v-if="
							shipPlanSubmitResult &&
							getBatchShipSubmitTotalQty('failed_total_qty') === 0 &&
							getBatchShipLocalSyncFailedCount() === 0
						"
						type="success"
						@click="finishBatchShipFlow"
					>
						完成并关闭
					</el-button>
					<el-button
						v-if="!shipPlanSubmitResult"
						type="primary"
						:loading="savingBatchShipReview"
						@click="submitBatchShipReviewForReview"
					>
						提交审核
					</el-button>
				</div>
			</div>
		</template>
	</el-dialog>
</template>

<script lang="ts" setup>
import { computed, reactive, ref, watch } from "vue";
import dayjs from "dayjs";
import { ElMessage, ElMessageBox } from "element-plus";
import {
	ArrowDown,
	Check,
	CopyDocument,
	DataAnalysis,
	Delete,
	Loading as LoadingIcon,
	Picture as PictureIcon,
	Refresh,
	Warning
} from "@element-plus/icons-vue";
import { useCool } from "/@/cool";
import PurchasePlanProductShipDatePicker from "./PurchasePlanProductShipDatePicker.vue";
import ListingTrendChart from "./ListingTrendChart.vue";
import ReplenishDatePicker from "./ReplenishDatePicker.vue";

type ShippingMethod = {
	key: string;
	label: string;
	days: number;
	color: string;
	icon: string;
};

type SegmentAllocationTrace = {
	label: string;
	qty: number;
};

type SegmentTempSaveResult = {
	created: number;
	updated: number;
	deleted: number;
	records: TempSaveRecord[];
};

type TempSaveSyncIssue = {
	missing: number;
	changed: number;
	stale: number;
	total: number;
};

type ShippingPlanDiffMethodCell = {
	methodKey: string;
	qtyText?: string | number;
	periodText?: string;
	statusText?: string;
};

type ShippingPlanDiffTraceRow = {
	key?: string;
	traceKey?: string;
	planText?: string;
	analysisText?: string;
	methodCells?: ShippingPlanDiffMethodCell[];
};

type ShippingPlanDiffDetailRow = {
	key: string;
	planText: string;
	analysisText: string;
	qty: number;
	qtyText: string;
	periodText: string;
	statusText: string;
};

type ShippingPlanDiffTone = "none" | "balanced" | "short" | "over";

type ShippingPlanDiffSummary = {
	methodKey: string;
	plannedQty: number;
	actualQty: number;
	diffQty: number;
	plannedText: string;
	actualText: string;
	diffText: string;
	summaryText: string;
	formulaText: string;
	detailCountText: string;
	tone: ShippingPlanDiffTone;
	detailRows: ShippingPlanDiffDetailRow[];
};

type BuildShippingPlanDiffSummaryOptions = {
	methodKey: string;
	actualQty: number;
	traceRows: ShippingPlanDiffTraceRow[];
	formatNumber?: (value: number) => string;
};

type ShippingProfileKey = "default" | "uk" | "de";

type TargetPeriodMode = "product" | "global";

type ShippingProfile = {
	key: ShippingProfileKey;
	label: string;
	readonly: boolean;
	methodDays: Record<string, number>;
	selectedMethods: string[];
};

type ShippableOrderDetail = {
	id: string;
	order_sn: string;
	plan_sn: string;
	analysis_record_id: number | null;
	linked_plan_sns: string[];
	linked_analysis_record_ids: number[];
	status_text: string;
	supplier_name: string;
	order_time: string;
	logistics_status_text: string;
	logistics_status_reason: string;
	quantity_entry_sum: number;
	actual_shipment_qty_sum: number;
	defective_qty: number;
	short_shipped_qty: number;
	estimated_shippable_qty: number;
	actual_shippable_qty: number;
	sync_status: string;
	sync_message: string;
	ship_qty: number;
};

type ShippingSegmentResult = ShippingMethod & {
	startDate: string;
	endDate: string;
	days: number;
	enabled: boolean;
	segmentGap: number;
	preArrivalGap: number;
	systemGap: number;
	expectedDemand: number;
	suggestedQty: number;
	remainingGap: number;
	shortageStartDate: string;
	shortageEndDate: string;
	shortageDays: number;
	shortageDemand: number;
	shortageRanges: any[];
	preArrivalShortage: any;
	inventoryUsage: any;
	monthlyCoefficients: Record<string, any> | null;
	warning: string;
};

type TraceFieldKey = "daily_avg_sales" | "target_stock_days" | "volatility_coefficient";

type TraceInputSourceType = "current" | "manual" | "history";

type TraceInputSource = {
	type: TraceInputSourceType;
	label: string;
	traceKey?: string;
};

type CoefficientRestoreSourceType = "current" | "trace";

type MonthlyCoefficientOverride = Record<string, any>;

type SegmentCoefficientOverride = {
	finalCoefficient: number | null;
	alpha: number | null;
};

type ManualShipTransferNotice = {
	text: string;
	tone: "in" | "out";
};

type CoefficientRestoreSource = {
	type: CoefficientRestoreSourceType;
	label: string;
	traceKey?: string;
	algorithm?: string;
	methodOverrides: Record<string, Record<string, MonthlyCoefficientOverride>>;
	monthOverrides: Record<string, MonthlyCoefficientOverride>;
};

type CalculationInputDefaults = {
	daily_avg_sales: number;
	target_stock_days: number | null;
	volatility_coefficient: number;
};

type CalculationInputValues = CalculationInputDefaults & {
	date_range: string[] | null;
};

type ProductShipHistoryAllocation = {
	id: number;
	purchase_plan_sn: string;
	purchase_order_sn: string;
	ship_qty: number;
	status: string;
	lingxing_seq: string;
	lingxing_order_sns: any[];
	local_sync_status: string;
	local_sync_error: string;
	error_message: string;
	detail_remark: string;
};

type ProductShipHistoryMethodGroup = {
	group_key: string;
	method_key: string;
	method_label: string;
	warehouse_id: number | null;
	warehouse_name: string;
	packing_type: number | null;
	shipment_time: string;
	planned_qty: number;
	success_qty: number;
	failed_qty: number;
	local_sync_failed_qty: number;
	seqs: string[];
	allocations: ProductShipHistoryAllocation[];
};

type ProductShipHistoryBatch = {
	batch_no: string;
	status: string;
	planned_qty: number;
	success_qty: number;
	failed_qty: number;
	local_sync_failed_qty: number;
	created_by_username: string;
	created_by_nickname: string;
	create_time: string | null;
	finished_time: string | null;
	method_groups: ProductShipHistoryMethodGroup[];
};

type ProductShipHistory = {
	summary: {
		batch_count: number;
		planned_qty: number;
		success_qty: number;
		failed_qty: number;
		local_sync_failed_qty: number;
		method_summary: Array<{
			method_key: string;
			method_label: string;
			planned_qty: number;
			success_qty: number;
			failed_qty: number;
		}>;
	};
	batches: ProductShipHistoryBatch[];
};

type BatchShipItem = {
	_batchId: string;
	row_key: string;
	product_name: string;
	image_url_display: string;
	product_id: number | null;
	asin: string;
	marketplace: string;
	msku: string;
	local_sku: string;
	fnsku: string;
	store_id: number | null;
	seller_name: string;
	product_code: string;
	listing_id: number | null;
	current_target_stock_days: number | null;
	effective_target_stock_days: number;
	target_stock_days_is_default: boolean;
	volatility_coefficient: number;
	excluded_shipping_methods: string[];
	inactiveMethods: string[];
	shippingSegments: ShippingSegmentResult[];
	manual_ship_qty_map: Record<string, number>;
	manual_coefficient_map: Record<string, SegmentCoefficientOverride>;
	manual_ship_locked_method_map: Record<string, boolean>;
	manual_ship_transfer_notice_map: Record<string, ManualShipTransferNotice>;
	manual_ship_edit_snapshot_map: Record<string, Record<string, number>>;
	shippableOrders: ShippableOrderDetail[];
	actual_shippable_qty: number;
	daily_avg_sales: number;
	sales_avg_info: string;
	sales_avg_3: number | null;
	sales_avg_7: number | null;
	sales_avg_14: number | null;
	sales_total_3: number | null;
	sales_total_7: number | null;
	sales_total_14: number | null;
	realtime_sales: number | null;
	recent_sales_trend_list: any[];
	sellable_days_total: number | null;
	sellable_days_fba: number | null;
	fba_qty: number;
	fba_reserved_qty: number;
	in_transit_qty: number;
	local_qty: number;
	fbaValidList: any[];
	fbaShippingList: any[];
	localValidList: any[];
	pending_delivery_qty: number;
	pending_delivery_details: any[];
	purchase_plan_qty: number;
	purchase_plan_details: any[];
	estimated_shipping_qty: number | null;
	estimated_shipping_details: any[];
	out_stock_date: string;
	stars: any[];
	reviews_num: any[];
	cg_box_pcs: number | null;
	_cgBoxPcsLoading: boolean;
	_cgBoxPcsLoaded: boolean;
	_cgBoxPcsMessage: string;
	_cgBoxPcsError: string;
	_calendarData: any;
	_calendarDataLoading: boolean;
	algo: string;
	dateRange: string[];
	manual_target_date_range: string[] | null;
	totalDemand: number;
	pureGap: number;
	remainingGap: number;
	shipQty: number;
	monthlyCoefficients: Record<string, any> | null;
	calculated: boolean;
	warning: string;
	remark: string;
	calculationInputDefaults: CalculationInputDefaults;
	calculationInputValues: CalculationInputValues;
	calculationInputSources: Record<TraceFieldKey, TraceInputSource>;
	coefficientRestoreSource: CoefficientRestoreSource;
	replenishTraces: ReplenishTrace[];
	_replenishTraceLoading: boolean;
	_replenishTraceLoaded: boolean;
	_replenishTraceError: string;
	shipHistory: ProductShipHistory | null;
	_shipHistoryLoading: boolean;
	_shipHistoryLoaded: boolean;
	_shipHistoryError: string;
};

type ReplenishTrace = {
	key: string;
	plan_sn: string;
	analysis_record_id: number | null;
	linked_order_sns: string[];
	linked_order_count: number;
	trace_level?: "full_record" | "legacy_snapshot" | "legacy_compatible";
	snapshot_label?: string;
	actionable?: boolean;
	available_sections?: string[];
	missing_sections?: string[];
	missing_section_labels?: string[];
	error?: string;
	flow?: any;
};

type TraceFieldTraceRow = {
	key: string;
	sourceType: "current" | "trace";
	traceKey: string;
	planText: string;
	analysisText: string;
	valueText: string;
	periodRangeText: string;
	periodDaysText: string;
	algoText: string;
	orderText: string;
	actualPurchaseText: string;
	creatorNameText: string;
	creatorTimeText: string;
};

type TraceDistributionMonthRow = {
	key: string;
	monthText: string;
	daysText: string;
	rawText: string;
	finalText: string;
	alphaText: string;
	salesText: string;
	searchText: string;
	formulaText: string;
};

type TraceDistributionMethodCell = {
	key: string;
	methodKey: string;
	label: string;
	icon: string;
	color: string;
	tone: string;
	qtyText: string;
	periodText: string;
	coefficientText: string;
	alphaText: string;
	statusText: string;
	hasSegment: boolean;
	monthlyRows: TraceDistributionMonthRow[];
};

type TraceDistributionRow = {
	key: string;
	traceKey: string;
	isCurrent: boolean;
	isDefault: boolean;
	planText: string;
	analysisText: string;
	algoText: string;
	targetText: string;
	dailyText: string;
	volatilityText: string;
	actualPurchaseText: string;
	orderText: string;
	totalText: string;
	manualRemarkText: string;
	hasManualRemark: boolean;
	methodCells: TraceDistributionMethodCell[];
};

type TraceDistributionMethodSummary = {
	totalQty: number;
	allTotalQty: number;
	totalText: string;
	allTotalText: string;
	percentText: string;
	compactText: string;
	sourceCountText: string;
	detailRows: Array<{
		key: string;
		planText: string;
		qtyText: string;
		percentText: string;
	}>;
};

type TraceDistributionMethodHeader = ShippingMethod & TraceDistributionMethodSummary;

type TempSaveRecord = {
	id: string;
	itemKey: string;
	asin: string;
	marketplace: string;
	msku: string;
	fnsku: string;
	storeId: number | null;
	productCode: string;
	listingId: number | null;
	productName: string;
	productImg: string;
	shippingMethod: string;
	shippingLabel: string;
	shippingIcon: string;
	shippingColor: string;
	dateRange: string[];
	algoLabel: string;
	shipQty: number;
	systemSuggestQty: number;
	manualAdjusted: boolean;
	orderDetails: ShippableOrderDetail[];
};

type ShipPlanRecord = TempSaveRecord & {
	warehouse: number | string | "";
	packageType: number | "";
	planShipDate: string;
	remark: string;
};

type WarehouseOption = {
	wid: number | string;
	name: string;
};

type WarehouseGroups = {
	local: WarehouseOption[];
	overseas: WarehouseOption[];
	awd: WarehouseOption[];
};

const DEFAULT_TARGET_STOCK_DAYS = 75;
const DEFAULT_SHIPPING_BUFFER = 5;
const DEFAULT_GLOBAL_ALGO = "combined";
const DEFAULT_VOLATILITY_COEFFICIENT = 0.75;
const TRACE_FIELD_FALLBACK_PLACEMENTS = ["top", "bottom", "right", "left"];
const TRACE_FIELD_KEYS: TraceFieldKey[] = [
	"daily_avg_sales",
	"target_stock_days",
	"volatility_coefficient"
];

const DEFAULT_SHIPPING_METHOD_CONFIGS: ShippingMethod[] = [
	{ key: "express", label: "快递", days: 5, color: "#FF6B9D", icon: "🚚" },
	{ key: "air", label: "空快", days: 8, color: "#409EFF", icon: "✈️" },
	{ key: "air_slow", label: "空慢", days: 10, color: "#67B8FF", icon: "✈️" },
	{ key: "truck", label: "卡车", days: 30, color: "#67C23A", icon: "🚛" },
	{ key: "rail", label: "铁路", days: 35, color: "#E6A23C", icon: "🚂" },
	{ key: "sea", label: "海运", days: 60, color: "#F56C6C", icon: "🚢" }
];

const DEFAULT_SELECTED_SHIPPING_METHODS = DEFAULT_SHIPPING_METHOD_CONFIGS.map(
	(method) => method.key
);
const DEFAULT_SHIPPING_METHOD_DAYS = DEFAULT_SHIPPING_METHOD_CONFIGS.reduce(
	(acc, method) => {
		acc[method.key] = method.days;
		return acc;
	},
	{} as Record<string, number>
);
const DEFAULT_PROFILE_TARGET_EXTRA_DAYS = Math.max(
	0,
	DEFAULT_TARGET_STOCK_DAYS - (DEFAULT_SHIPPING_METHOD_DAYS.sea || 0) - DEFAULT_SHIPPING_BUFFER
);

const SHIPPING_PROFILES: Record<ShippingProfileKey, ShippingProfile> = {
	default: {
		key: "default",
		label: "默认",
		readonly: false,
		methodDays: { ...DEFAULT_SHIPPING_METHOD_DAYS },
		selectedMethods: [...DEFAULT_SELECTED_SHIPPING_METHODS]
	},
	uk: {
		key: "uk",
		label: "英国",
		readonly: true,
		methodDays: {
			express: 5,
			air: 9,
			air_slow: 14,
			truck: 28,
			sea: 52
		},
		selectedMethods: ["express", "air", "air_slow", "truck", "sea"]
	},
	de: {
		key: "de",
		label: "德国",
		readonly: true,
		methodDays: {
			express: 5,
			air: 16,
			air_slow: 20,
			truck: 30,
			sea: 56
		},
		selectedMethods: ["express", "air", "air_slow", "truck", "sea"]
	}
};

const resolveShippingProfile = (key: any) => {
	return (
		SHIPPING_PROFILES[String(key || "default") as ShippingProfileKey] ||
		SHIPPING_PROFILES.default
	);
};

const buildShippingMethodsForProfile = (key: ShippingProfileKey) => {
	const profile = resolveShippingProfile(key);
	return DEFAULT_SHIPPING_METHOD_CONFIGS.map((method) => ({
		...method,
		days: profile.methodDays[method.key] ?? method.days
	}));
};

const getProfileDefaultTargetDays = (
	key: ShippingProfileKey,
	bufferDays = DEFAULT_SHIPPING_BUFFER
) => {
	const profile = resolveShippingProfile(key);
	const slowestDays = profile.selectedMethods.reduce((max, methodKey) => {
		const days = profile.methodDays[methodKey] ?? DEFAULT_SHIPPING_METHOD_DAYS[methodKey] ?? 0;
		return Math.max(max, days);
	}, 0);

	return Math.max(
		1,
		Math.round(slowestDays + normalizeNumber(bufferDays) + DEFAULT_PROFILE_TARGET_EXTRA_DAYS)
	);
};

const buildShippingProfileOption = (profile: ShippingProfile) => {
	return {
		key: profile.key,
		label: profile.label,
		readonly: profile.readonly,
		methods: DEFAULT_SHIPPING_METHOD_CONFIGS.map((method) => ({
			key: method.key,
			label: method.label,
			icon: method.icon,
			days: profile.methodDays[method.key] ?? method.days,
			enabled: profile.selectedMethods.includes(method.key)
		}))
	};
};

function refreshShippingProfileOptions() {
	shippingProfileOptions.value = Object.values(SHIPPING_PROFILES).map(buildShippingProfileOption);
}

function resetDefaultShippingProfileDays() {
	SHIPPING_PROFILES.default.methodDays = { ...DEFAULT_SHIPPING_METHOD_DAYS };
	refreshShippingProfileOptions();
}

const props = defineProps<{
	visible: boolean;
	items: any[];
	dataSyncState?: any;
	reviewRestorePayload?: any;
	reviewNo?: string;
}>();

const emit = defineEmits(["update:visible", "retry-sync-failed", "saved-review"]);
const { service } = useCool();

const dialogVisible = computed({
	get: () => props.visible,
	set: (value: boolean) => emit("update:visible", value)
});

const dialogItems = ref<BatchShipItem[]>([]);
const targetStockLoading = ref(false);
const volatilityLoading = ref(false);
const restockingLoading = ref(false);
const calendarDataLoading = ref(false);
const calculating = ref(false);
const shippingBuffer = ref(DEFAULT_SHIPPING_BUFFER);
const globalDefaultTargetDays = ref(
	getProfileDefaultTargetDays("default", DEFAULT_SHIPPING_BUFFER)
);
const targetDaysAutoSynced = ref(true);
const targetPeriodMode = ref<TargetPeriodMode>("product");
const globalAlgo = ref(DEFAULT_GLOBAL_ALGO);
const globalShippingProfile = ref<ShippingProfileKey>("default");
const shippingProfileOptions = ref(
	Object.values(SHIPPING_PROFILES).map(buildShippingProfileOption)
);
const currentShippingProfile = computed(() => resolveShippingProfile(globalShippingProfile.value));
const globalSelectedShippingMethods = ref<string[]>([...SHIPPING_PROFILES.default.selectedMethods]);
const shippingMethods = reactive<ShippingMethod[]>(buildShippingMethodsForProfile("default"));
const traceDistributionFocusMap = reactive<Record<string, string>>({});
const tempSaveRecords = reactive<Record<string, TempSaveRecord[]>>({});
const tempSaveDrawerVisible = ref(false);
const tempSaveDrawerFilterKey = ref<string | null>(null);
const replenishTraceDrawer = reactive({
	visible: false,
	itemKey: "",
	selectedTraceKey: ""
});
const shipHistoryDrawer = reactive({
	visible: false,
	itemKey: ""
});
const shipHistoryActiveBatches = ref<string[]>([]);
const packageTypeOptions = [
	{ value: 1, label: "混装商品" },
	{ value: 2, label: "原厂包装商品" }
];
const shipPlanDialog = reactive({
	visible: false,
	records: [] as ShipPlanRecord[]
});
const finalConfirmDialog = reactive({
	visible: false
});
const warehouseList = ref<WarehouseGroups>({ local: [], overseas: [], awd: [] });
const warehouseLoading = ref(false);
const shipPlanActiveCollapse = ref("");
const shipPlanRecordExpandedMap = reactive<Record<string, boolean>>({});
const finalConfirmExpandedMap = reactive<Record<string, boolean>>({});
const batchValues = reactive<Record<string, any>>({});
const submittingShipPlan = ref(false);
const retryingShipPlanFailed = ref(false);
const shipPlanSubmitResult = ref<any | null>(null);
const shipPlanSubmitToken = ref("");
const savingBatchShipReview = ref(false);
const batchShipReviewNo = ref("");
const restoringReviewSnapshot = ref(false);
const dataSyncNoticeDismissed = ref(false);
let dataSyncNoticeAutoDismissTimer: ReturnType<typeof setTimeout> | null = null;

const dataSyncBlocking = computed(() => Boolean(props.dataSyncState?.syncing));

const loadingAny = computed(
	() =>
		targetStockLoading.value ||
		volatilityLoading.value ||
		restockingLoading.value ||
		calendarDataLoading.value ||
		calculating.value ||
		dataSyncBlocking.value ||
		dialogItems.value.some((item) => item._cgBoxPcsLoading)
);

const sortedSelectedMethods = computed(() => {
	return [...globalSelectedShippingMethods.value].sort((a, b) => {
		const da = shippingMethods.find((method) => method.key === a)?.days || 0;
		const db = shippingMethods.find((method) => method.key === b)?.days || 0;
		return da - db;
	});
});

const computedShippingMarkers = computed(() => {
	const today = dayjs().startOf("day");
	return sortedSelectedMethods.value
		.map((key) => {
			const method = shippingMethods.find((item) => item.key === key);
			if (!method) return null;
			return {
				key,
				label: method.label,
				arrivalDate: today
					.add(method.days + shippingBuffer.value, "day")
					.format("YYYY-MM-DD"),
				days: method.days,
				color: method.color,
				icon: method.icon
			};
		})
		.filter(Boolean) as {
		key: string;
		label: string;
		arrivalDate: string;
		days: number;
		color: string;
		icon: string;
	}[];
});

const batchSummary = computed(() => {
	return dialogItems.value.reduce(
		(summary, item) => {
			summary.actualShippableQty += normalizeNumber(item.actual_shippable_qty);
			summary.shipQty += normalizeNumber(item.shipQty);
			summary.gap += normalizeNumber(item.pureGap);
			summary.remainingGap += normalizeNumber(item.remainingGap);
			return summary;
		},
		{ actualShippableQty: 0, shipQty: 0, gap: 0, remainingGap: 0 }
	);
});

const targetStockSummary = computed(() => ({
	productCount: dialogItems.value.length,
	orderCount: dialogItems.value.reduce((sum, item) => sum + item.shippableOrders.length, 0)
}));

const dataSyncSections = computed(() => {
	const sections = props.dataSyncState?.sections || {};
	return ["purchase_plan", "pending_delivery", "purchase_order"]
		.map((scope) => sections[scope])
		.filter((section: any) => section && Number(section.total) > 0);
});

const dataSyncNotice = computed(() => {
	const state = props.dataSyncState;
	if (!state || state.status === "idle") return null;
	if (dataSyncNoticeDismissed.value && !state.syncing) return null;
	return {
		status: state.status,
		message: state.message || "数据刷新中"
	};
});

const failedDataSyncItems = computed(() => {
	return dataSyncSections.value.flatMap((section: any) => {
		return (section.items || [])
			.filter((item: any) => item.status === "failed")
			.map((item: any) => ({
				...item,
				scope: section.scope,
				scopeLabel: section.label
			}));
	});
});

const canRetryDataSync = computed(
	() => !dataSyncBlocking.value && failedDataSyncItems.value.length > 0
);

function clearDataSyncNoticeAutoDismissTimer() {
	if (!dataSyncNoticeAutoDismissTimer) return;
	clearTimeout(dataSyncNoticeAutoDismissTimer);
	dataSyncNoticeAutoDismissTimer = null;
}

function retryFailedDataSync() {
	if (!canRetryDataSync.value) return;
	dataSyncNoticeDismissed.value = false;
	emit("retry-sync-failed");
}

function dismissDataSyncNotice() {
	if (dataSyncBlocking.value) return;
	clearDataSyncNoticeAutoDismissTimer();
	dataSyncNoticeDismissed.value = true;
}

const totalTempSaves = computed(() =>
	Object.values(tempSaveRecords).reduce((sum, records) => sum + records.length, 0)
);

const flatTempSaveRecords = computed(() => Object.values(tempSaveRecords).flat());

const visibleTempSaveRecords = computed(() => {
	if (!tempSaveDrawerFilterKey.value) return flatTempSaveRecords.value;
	return tempSaveRecords[tempSaveDrawerFilterKey.value] || [];
});

const tempSaveSummary = computed(() => {
	const records = flatTempSaveRecords.value;
	return {
		totalShipQty: records.reduce((sum, record) => sum + normalizeNumber(record.shipQty), 0),
		productCount: new Set(records.map((record) => record.itemKey)).size,
		segmentCount: records.length
	};
});

const allWarehouseOptions = computed(() => [
	...warehouseList.value.local,
	...warehouseList.value.overseas,
	...warehouseList.value.awd
]);

const groupedPlanRecords = computed(() => {
	const groups: Record<string, { method: ShippingMethod | null; records: ShipPlanRecord[] }> = {};
	shipPlanDialog.records.forEach((record) => {
		const key = record.shippingMethod || "unknown";
		if (!groups[key]) {
			groups[key] = {
				method: shippingMethods.find((method) => method.key === key) || null,
				records: []
			};
		}
		groups[key].records.push(record);
	});
	return groups;
});

const finalConfirmMethodGroups = computed(() => {
	return Object.entries(groupedPlanRecords.value).map(([methodKey, group]) => ({
		methodKey,
		method: group.method,
		records: group.records,
		totalQty: group.records.reduce((sum, record) => sum + normalizeNumber(record.shipQty), 0),
		productCount: group.records.length,
		orderCount: group.records.reduce((sum, record) => sum + record.orderDetails.length, 0)
	}));
});

const manualShipSummary = computed(() => {
	const rows = dialogItems.value.flatMap((item) =>
		getManualShipSegments(item).map((segment) => ({
			itemKey: getItemKey(item),
			qty: normalizeNumber(segment.manualShipQty)
		}))
	);
	return {
		totalShipQty: rows.reduce((sum, row) => sum + row.qty, 0),
		productCount: new Set(rows.map((row) => row.itemKey)).size,
		segmentCount: rows.length
	};
});

const nextStepDisabledReason = computed(() => {
	if (hasCreatedShipPlanResult()) {
		return "本批已有创建成功项，请在提交结果中复制仓库指令、重试失败项，避免重复提交";
	}

	if (totalTempSaves.value === 0) {
		if (manualShipSummary.value.segmentCount > 0) {
			return `已填写 ${manualShipSummary.value.segmentCount} 段，请先点击“一键暂存全部填写”`;
		}
		return "请先填写至少一个运输段的发货数量，再点击“一键暂存全部填写”";
	}

	const syncIssue = getTempSaveSyncIssueSummary();
	if (syncIssue.total > 0) {
		return `存在 ${syncIssue.productCount} 个产品 ${syncIssue.total} 段未同步修改，请重新暂存`;
	}

	return "";
});

const nextStepHint = computed(() => nextStepDisabledReason.value);
const nextStepDisabled = computed(() => Boolean(nextStepDisabledReason.value));

const replenishTraceDrawerItem = computed(() => {
	return (
		dialogItems.value.find((item) => getItemKey(item) === replenishTraceDrawer.itemKey) || null
	);
});

const shipHistoryDrawerItem = computed(() => {
	return dialogItems.value.find((item) => getItemKey(item) === shipHistoryDrawer.itemKey) || null;
});

const shipHistoryDrawerData = computed(() => shipHistoryDrawerItem.value?.shipHistory || null);
const shipHistoryBatchNos = computed(() => {
	return (shipHistoryDrawerData.value?.batches || [])
		.map((batch) => batch.batch_no)
		.filter(Boolean);
});

function syncShipHistoryDefaultExpanded() {
	if (!shipHistoryDrawer.visible) return;
	const batchNos = shipHistoryBatchNos.value;
	if (!batchNos.length) {
		shipHistoryActiveBatches.value = [];
		return;
	}
	const active = shipHistoryActiveBatches.value.filter((batchNo) => batchNos.includes(batchNo));
	shipHistoryActiveBatches.value = active.length ? active : [batchNos[0]];
}

watch(
	() => [
		shipHistoryDrawer.visible,
		shipHistoryDrawer.itemKey,
		shipHistoryBatchNos.value.join("|")
	],
	() => syncShipHistoryDefaultExpanded()
);

const replenishTraceDrawerTraces = computed(
	() => replenishTraceDrawerItem.value?.replenishTraces || []
);
const replenishTraceDrawerGroups = computed(() => {
	const traces = replenishTraceDrawerTraces.value;
	return [
		{
			key: "full",
			title: "可追溯完整记录",
			traces: traces.filter((trace) => !trace.error && isTraceActionable(trace))
		},
		{
			key: "history",
			title: "历史展示记录",
			traces: traces.filter((trace) => !trace.error && !isTraceActionable(trace))
		},
		{
			key: "error",
			title: "加载失败",
			traces: traces.filter((trace) => trace.error)
		}
	];
});

const selectedReplenishTrace = computed(() => {
	const traces = replenishTraceDrawerTraces.value;
	return (
		traces.find((trace) => trace.key === replenishTraceDrawer.selectedTraceKey) ||
		traces.find((trace) => !trace.error && isTraceActionable(trace)) ||
		traces.find((trace) => !trace.error) ||
		traces[0] ||
		null
	);
});

watch(
	() => props.visible,
	(visible) => {
		if (visible) {
			void initializeDialogData();
		} else {
			clearDataSyncNoticeAutoDismissTimer();
			dataSyncNoticeDismissed.value = false;
			resetDialogSession();
		}
	}
);

watch(
	() => props.items,
	() => {
		if (props.visible) void initializeDialogData();
	},
	{ deep: true }
);

watch(
	() => props.reviewRestorePayload,
	() => {
		if (props.visible) void initializeDialogData();
	},
	{ deep: true }
);

watch([globalDefaultTargetDays, shippingBuffer, targetPeriodMode], () => {
	if (props.visible && dialogItems.value.length && !restoringReviewSnapshot.value) {
		void calculateItems(dialogItems.value, true);
	}
});

watch(
	() => props.dataSyncState?.status,
	(status) => {
		clearDataSyncNoticeAutoDismissTimer();
		if (!status || status === "idle") {
			dataSyncNoticeDismissed.value = false;
			return;
		}
		if (status === "syncing") {
			dataSyncNoticeDismissed.value = false;
			return;
		}
		if (status === "success") {
			dataSyncNoticeDismissed.value = false;
			dataSyncNoticeAutoDismissTimer = setTimeout(() => {
				dataSyncNoticeDismissed.value = true;
				dataSyncNoticeAutoDismissTimer = null;
			}, 5000);
			return;
		}
		dataSyncNoticeDismissed.value = false;
	}
);

async function initializeDialogData() {
	resetDialogSession();
	if (hasReviewRestorePayload()) {
		await initializeDialogDataFromReview();
		return;
	}
	initializeItems();
	await Promise.all([
		loadCurrentTargetStockDays(),
		loadVolatilityCoefficients(),
		hydrateRestockingData(),
		loadCalendarDataForItems(),
		loadBoxPcsForItems(),
		loadReplenishTracesForItems(dialogItems.value),
		loadProductShipHistoriesForItems(dialogItems.value)
	]);
	captureCalculationInputDefaults(dialogItems.value);
	await calculateItems(dialogItems.value, true);
}

function resetDialogSession() {
	dialogItems.value = [];
	batchShipReviewNo.value = props.reviewNo || props.reviewRestorePayload?.review_no || "";
	resetDefaultShippingProfileDays();
	shippingBuffer.value = DEFAULT_SHIPPING_BUFFER;
	globalDefaultTargetDays.value = getProfileDefaultTargetDays("default", DEFAULT_SHIPPING_BUFFER);
	targetDaysAutoSynced.value = true;
	targetPeriodMode.value = "product";
	globalAlgo.value = DEFAULT_GLOBAL_ALGO;
	globalShippingProfile.value = "default";
	shippingMethods.splice(0, shippingMethods.length, ...buildShippingMethodsForProfile("default"));
	globalSelectedShippingMethods.value = [...SHIPPING_PROFILES.default.selectedMethods];
	Object.keys(tempSaveRecords).forEach((key) => delete tempSaveRecords[key]);
	tempSaveDrawerVisible.value = false;
	tempSaveDrawerFilterKey.value = null;
	replenishTraceDrawer.visible = false;
	replenishTraceDrawer.itemKey = "";
	replenishTraceDrawer.selectedTraceKey = "";
	shipHistoryDrawer.visible = false;
	shipHistoryDrawer.itemKey = "";
	shipHistoryActiveBatches.value = [];
	Object.keys(finalConfirmExpandedMap).forEach((key) => delete finalConfirmExpandedMap[key]);
	shipPlanDialog.visible = false;
	shipPlanDialog.records = [];
	finalConfirmDialog.visible = false;
	shipPlanSubmitResult.value = null;
	shipPlanSubmitToken.value = "";
	savingBatchShipReview.value = false;
}

function hasReviewRestorePayload() {
	const payload = props.reviewRestorePayload || {};
	return Boolean(
		payload.review_no ||
			payload.workbench_snapshot ||
			payload.input_snapshot ||
			payload.submit_payload
	);
}

async function initializeDialogDataFromReview() {
	const payload = props.reviewRestorePayload || {};
	const workbench = payload.workbench_snapshot || {};
	restoringReviewSnapshot.value = true;
	batchShipReviewNo.value = payload.review_no || props.reviewNo || "";

	try {
		const restoredItems = clonePlain(workbench.dialogItems || workbench.items || []);
		if (Array.isArray(restoredItems) && restoredItems.length) {
			dialogItems.value = restoredItems;
		} else {
			initializeItems();
		}

		restoreRefValue(shippingBuffer, workbench.shippingBuffer, DEFAULT_SHIPPING_BUFFER);
		restoreRefValue(
			globalDefaultTargetDays,
			workbench.globalDefaultTargetDays,
			globalDefaultTargetDays.value
		);
		restoreRefValue(targetDaysAutoSynced, workbench.targetDaysAutoSynced, true);
		restoreRefValue(targetPeriodMode, workbench.targetPeriodMode, "product");
		restoreRefValue(globalAlgo, workbench.globalAlgo, DEFAULT_GLOBAL_ALGO);
		restoreRefValue(globalShippingProfile, workbench.globalShippingProfile, "default");

		const restoredShippingMethods = Array.isArray(workbench.shippingMethods)
			? workbench.shippingMethods
			: buildShippingMethodsForProfile(globalShippingProfile.value);
		shippingMethods.splice(0, shippingMethods.length, ...clonePlain(restoredShippingMethods));
		globalSelectedShippingMethods.value = Array.isArray(workbench.globalSelectedShippingMethods)
			? [...workbench.globalSelectedShippingMethods]
			: [...resolveShippingProfile(globalShippingProfile.value).selectedMethods];

		replaceReactiveMap(tempSaveRecords, workbench.tempSaveRecords || {});
		replaceReactiveMap(batchValues, workbench.batchValues || {});
		replaceReactiveMap(shipPlanRecordExpandedMap, workbench.shipPlanRecordExpandedMap || {});
		replaceReactiveMap(finalConfirmExpandedMap, workbench.finalConfirmExpandedMap || {});

		warehouseList.value = clonePlain(
			workbench.warehouseList || { local: [], overseas: [], awd: [] }
		);
		shipPlanDialog.records = clonePlain(
			workbench.shipPlanDialog?.records || workbench.shipPlanRecords || []
		);
		shipPlanDialog.visible = false;
		finalConfirmDialog.visible = false;
		shipPlanActiveCollapse.value =
			workbench.shipPlanActiveCollapse || Object.keys(groupedPlanRecords.value)[0] || "";
		shipPlanSubmitToken.value =
			payload.submit_payload?.client_submit_token || workbench.shipPlanSubmitToken || "";

		if (shipPlanDialog.records.length) {
			await loadWarehouseList();
		}
		ElMessage.success(`已还原审核单 ${batchShipReviewNo.value}，可继续修改后重新提交审核`);
	} finally {
		restoringReviewSnapshot.value = false;
	}
}

function clonePlain<T>(value: T): T {
	if (value === null || value === undefined) return value;
	return JSON.parse(JSON.stringify(value));
}

function replaceReactiveMap(target: Record<string, any>, source: Record<string, any>) {
	Object.keys(target).forEach((key) => delete target[key]);
	Object.entries(source || {}).forEach(([key, value]) => {
		target[key] = clonePlain(value);
	});
}

function restoreRefValue(target: any, value: any, fallback: any) {
	target.value = value === undefined || value === null ? fallback : clonePlain(value);
}

function initializeItems() {
	dialogItems.value = (props.items || []).map((raw, index) => {
		const shippableOrders = normalizeShippableOrders(raw);
		const actualShippableQty = shippableOrders.reduce(
			(sum, order) => sum + normalizeNumber(order.actual_shippable_qty),
			0
		);
		const item: BatchShipItem = {
			_batchId:
				raw._batchId ||
				`${raw.row_key || "row"}_${raw.asin || "asin"}_${index}_${Date.now()}`,
			row_key: raw.row_key || "",
			product_name: raw.product_name || raw.item_name || "",
			image_url_display: raw.image_url_display || "",
			product_id: normalizeNullableNumber(raw.product_id),
			asin: raw.asin || "",
			marketplace: raw.marketplace || "",
			msku: raw.msku || "",
			local_sku: raw.local_sku || "",
			fnsku: raw.fnsku || "",
			store_id: raw.store_id ?? null,
			seller_name: raw.seller_name || raw.shop || "",
			product_code: raw.product_code || "",
			listing_id: raw.listing_id ?? null,
			current_target_stock_days: normalizeNullableNumber(raw.current_target_stock_days),
			effective_target_stock_days: DEFAULT_TARGET_STOCK_DAYS,
			target_stock_days_is_default: true,
			volatility_coefficient: DEFAULT_VOLATILITY_COEFFICIENT,
			excluded_shipping_methods: Array.isArray(raw.excluded_shipping_methods)
				? [...raw.excluded_shipping_methods]
				: [],
			inactiveMethods: Array.isArray(raw.inactiveMethods)
				? [...raw.inactiveMethods]
				: Array.isArray(raw.excluded_shipping_methods)
					? [...raw.excluded_shipping_methods]
					: [],
			shippingSegments: [],
			manual_ship_qty_map: {},
			manual_coefficient_map: {},
			manual_ship_locked_method_map: {},
			manual_ship_transfer_notice_map: {},
			manual_ship_edit_snapshot_map: {},
			shippableOrders,
			actual_shippable_qty: actualShippableQty,
			daily_avg_sales: normalizeNumber(raw.daily_avg_sales),
			sales_avg_info: raw.sales_avg_info || "-",
			sales_avg_3: normalizeNullableNumber(raw.sales_avg_3),
			sales_avg_7: normalizeNullableNumber(raw.sales_avg_7),
			sales_avg_14: normalizeNullableNumber(raw.sales_avg_14),
			sales_total_3: normalizeNullableNumber(raw.sales_total_3),
			sales_total_7: normalizeNullableNumber(raw.sales_total_7),
			sales_total_14: normalizeNullableNumber(raw.sales_total_14),
			realtime_sales: normalizeNullableNumber(raw.realtime_sales),
			recent_sales_trend_list: Array.isArray(raw.recent_sales_trend_list)
				? raw.recent_sales_trend_list
				: [],
			sellable_days_total: normalizeNullableNumber(raw.sellable_days_total),
			sellable_days_fba: normalizeNullableNumber(raw.sellable_days_fba),
			fba_qty: normalizeNumber(raw.fba_qty),
			fba_reserved_qty: normalizeNumber(raw.fba_reserved_qty),
			in_transit_qty: normalizeNumber(raw.in_transit_qty),
			local_qty: normalizeNumber(raw.local_qty),
			fbaValidList: Array.isArray(raw.fbaValidList) ? raw.fbaValidList : [],
			fbaShippingList: Array.isArray(raw.fbaShippingList) ? raw.fbaShippingList : [],
			localValidList: Array.isArray(raw.localValidList) ? raw.localValidList : [],
			pending_delivery_qty: normalizeNumber(raw.pending_delivery_qty),
			pending_delivery_details: Array.isArray(raw.pending_delivery_details)
				? raw.pending_delivery_details
				: [],
			purchase_plan_qty: normalizeNumber(raw.purchase_plan_qty),
			purchase_plan_details: Array.isArray(raw.purchase_plan_details)
				? raw.purchase_plan_details
				: [],
			estimated_shipping_qty: normalizeNullableNumber(raw.estimated_shipping_qty),
			estimated_shipping_details: Array.isArray(raw.estimated_shipping_details)
				? raw.estimated_shipping_details
				: [],
			out_stock_date: raw.out_stock_date || "",
			stars: normalizeArray(raw.stars),
			reviews_num: normalizeArray(raw.reviews_num),
			cg_box_pcs: normalizeNullableNumber(raw.cg_box_pcs),
			_cgBoxPcsLoading: false,
			_cgBoxPcsLoaded: normalizeNullableNumber(raw.cg_box_pcs) !== null,
			_cgBoxPcsMessage: "",
			_cgBoxPcsError: "",
			_calendarData: null,
			_calendarDataLoading: false,
			algo: globalAlgo.value,
			dateRange: [],
			manual_target_date_range: null,
			totalDemand: 0,
			pureGap: 0,
			remainingGap: 0,
			shipQty: 0,
			monthlyCoefficients: null,
			calculated: false,
			warning: "",
			remark: "等待目标库存推演",
			calculationInputDefaults: {
				daily_avg_sales: normalizeNumber(raw.daily_avg_sales),
				target_stock_days: normalizeNullableNumber(raw.current_target_stock_days),
				volatility_coefficient: DEFAULT_VOLATILITY_COEFFICIENT
			},
			calculationInputValues: {
				daily_avg_sales: normalizeNumber(raw.daily_avg_sales),
				target_stock_days: normalizeNullableNumber(raw.current_target_stock_days),
				volatility_coefficient: DEFAULT_VOLATILITY_COEFFICIENT,
				date_range: null
			},
			calculationInputSources: createDefaultCalculationInputSources(),
			coefficientRestoreSource: createDefaultCoefficientRestoreSource(),
			replenishTraces: [],
			_replenishTraceLoading: false,
			_replenishTraceLoaded: false,
			_replenishTraceError: "",
			shipHistory: null,
			_shipHistoryLoading: false,
			_shipHistoryLoaded: false,
			_shipHistoryError: ""
		};
		applyEffectiveTargetStockDays(item);
		return item;
	});
}

function createDefaultCalculationInputSources(): Record<TraceFieldKey, TraceInputSource> {
	return {
		daily_avg_sales: { type: "current", label: "系统当前值" },
		target_stock_days: { type: "current", label: "系统当前值" },
		volatility_coefficient: { type: "current", label: "系统当前值" }
	};
}

function createDefaultCoefficientRestoreSource(): CoefficientRestoreSource {
	return {
		type: "current",
		label: "系统当前系数",
		methodOverrides: {},
		monthOverrides: {}
	};
}

function createCurrentCalculationInputValues(item: BatchShipItem): CalculationInputValues {
	return {
		daily_avg_sales: normalizeNumber(item.daily_avg_sales),
		target_stock_days: normalizeNullableNumber(item.current_target_stock_days),
		volatility_coefficient:
			normalizeNullableNumber(item.volatility_coefficient) || DEFAULT_VOLATILITY_COEFFICIENT,
		date_range: null
	};
}

function captureCalculationInputDefaults(items: BatchShipItem[]) {
	items.forEach((item) => {
		const currentValues = createCurrentCalculationInputValues(item);
		item.calculationInputDefaults = {
			daily_avg_sales: currentValues.daily_avg_sales,
			target_stock_days: currentValues.target_stock_days,
			volatility_coefficient: currentValues.volatility_coefficient
		};
		item.calculationInputValues = currentValues;
		item.calculationInputSources = createDefaultCalculationInputSources();
		item.coefficientRestoreSource = createDefaultCoefficientRestoreSource();
		item.manual_coefficient_map = {};
		applyEffectiveTargetStockDays(item);
	});
}

function uniqueStringList(values: any[]) {
	return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function getItemPlanSns(item: BatchShipItem) {
	return uniqueStringList(
		item.shippableOrders.flatMap((order) => [
			order.plan_sn,
			...(Array.isArray(order.linked_plan_sns) ? order.linked_plan_sns : [])
		])
	);
}

function getItemAnalysisRecordIds(item: BatchShipItem) {
	return Array.from(
		new Set(
			item.shippableOrders
				.flatMap((order) => [
					order.analysis_record_id,
					...(Array.isArray(order.linked_analysis_record_ids)
						? order.linked_analysis_record_ids
						: [])
				])
				.map((value) => normalizeNullableNumber(value))
				.filter((value: number | null): value is number => value !== null)
		)
	);
}

function getItemOrderSns(item: BatchShipItem) {
	return uniqueStringList(item.shippableOrders.map((order) => order.order_sn));
}

function hasItemReplenishTraceIdentity(item: BatchShipItem) {
	return Boolean(
		getItemPlanSns(item).length ||
			getItemAnalysisRecordIds(item).length ||
			getItemOrderSns(item).length
	);
}

function buildReplenishTraceRequestItem(item: BatchShipItem) {
	const planSns = getItemPlanSns(item);
	const analysisRecordIds = getItemAnalysisRecordIds(item);
	const orders = item.shippableOrders.map((order) => ({
		purchase_order_sn: order.order_sn,
		plan_sn: order.plan_sn,
		linked_plan_sns: order.linked_plan_sns,
		analysis_record_id:
			order.linked_plan_sns.length <= 1
				? order.analysis_record_id || order.linked_analysis_record_ids[0] || undefined
				: undefined
	}));
	const hasOrderTraceIdentity = orders.some(
		(order) =>
			order.purchase_order_sn ||
			order.plan_sn ||
			order.linked_plan_sns.length ||
			order.analysis_record_id
	);
	return {
		clientKey: getItemKey(item),
		row_key: item.row_key,
		store_id: item.store_id,
		marketplace: item.marketplace,
		asin: item.asin,
		msku: item.msku,
		product_code: item.product_code,
		plan_sns: hasOrderTraceIdentity ? [] : planSns,
		analysis_record_ids: hasOrderTraceIdentity ? [] : analysisRecordIds,
		order_sns: hasOrderTraceIdentity ? [] : getItemOrderSns(item),
		orders
	};
}

async function loadReplenishTracesForItems(items: BatchShipItem[]) {
	const targets = items.filter(
		(item) =>
			!item._replenishTraceLoaded &&
			!item._replenishTraceLoading &&
			(Boolean(getItemPlanSns(item).length) ||
				Boolean(getItemAnalysisRecordIds(item).length) ||
				Boolean(getItemOrderSns(item).length))
	);
	if (!targets.length) return;

	targets.forEach((item) => {
		item._replenishTraceLoading = true;
		item._replenishTraceError = "";
	});

	try {
		const res = await service.request({
			url: "/admin/app/bsr_purchase_plan_product_view/purchaseOrderFlowBatch",
			method: "POST",
			data: {
				items: targets.map((item) => buildReplenishTraceRequestItem(item))
			}
		});
		const resultMap = new Map((res?.list || []).map((row: any) => [row.clientKey, row]));
		targets.forEach((item) => {
			const result = resultMap.get(getItemKey(item));
			item.replenishTraces = Array.isArray(result?.traces) ? result.traces : [];
			item._replenishTraceLoaded = true;
			item._replenishTraceError = item.replenishTraces.length ? "" : "暂无补货依据";
		});
	} catch (error: any) {
		targets.forEach((item) => {
			item.replenishTraces = [];
			item._replenishTraceLoaded = false;
			item._replenishTraceError = error?.message || "补货依据加载失败";
		});
	} finally {
		targets.forEach((item) => {
			item._replenishTraceLoading = false;
		});
	}
}

function buildShipHistoryRequestItem(item: BatchShipItem) {
	return {
		store_id: item.store_id,
		listing_id: item.listing_id,
		asin: item.asin,
		msku: item.msku,
		fnsku: item.fnsku,
		product_code: item.product_code
	};
}

async function loadProductShipHistoriesForItems(items: BatchShipItem[], force = false) {
	const targets = items.filter(
		(item) =>
			(force || !item._shipHistoryLoaded) &&
			!item._shipHistoryLoading &&
			Boolean(item.msku || item.asin || item.fnsku || item.listing_id)
	);
	if (!targets.length) return;

	await Promise.all(
		targets.map(async (item) => {
			item._shipHistoryLoading = true;
			item._shipHistoryError = "";
			try {
				const res = await service.request({
					url: "/admin/app/bsr_batch_ship/productHistory",
					method: "POST",
					data: buildShipHistoryRequestItem(item)
				});
				item.shipHistory = {
					summary: res?.summary || {
						batch_count: 0,
						planned_qty: 0,
						success_qty: 0,
						failed_qty: 0,
						local_sync_failed_qty: 0,
						method_summary: []
					},
					batches: Array.isArray(res?.batches) ? res.batches : []
				};
				item._shipHistoryLoaded = true;
				item._shipHistoryError = item.shipHistory.batches.length ? "" : "暂无发货历史";
			} catch (error: any) {
				item.shipHistory = null;
				item._shipHistoryLoaded = false;
				item._shipHistoryError = error?.message || "发货历史加载失败";
			} finally {
				item._shipHistoryLoading = false;
			}
		})
	);
}

async function openShipHistoryDrawer(item: BatchShipItem) {
	shipHistoryDrawer.itemKey = getItemKey(item);
	shipHistoryDrawer.visible = true;
	shipHistoryActiveBatches.value = [];
	if (!item._shipHistoryLoaded && !item._shipHistoryLoading) {
		await loadProductShipHistoriesForItems([item]);
	}
	syncShipHistoryDefaultExpanded();
}

function getItemShipHistorySummary(item: BatchShipItem) {
	if (item._shipHistoryLoading) return "加载中";
	if (item._shipHistoryError && !item.shipHistory?.batches?.length) return item._shipHistoryError;
	const summary = item.shipHistory?.summary;
	if (!summary?.batch_count) return "暂无发货历史";
	return `近${summary.batch_count}批 成功${formatNumber(summary.success_qty)} 失败${formatNumber(summary.failed_qty)}`;
}

function getItemShipHistoryMethodChips(item: BatchShipItem) {
	return (item.shipHistory?.summary?.method_summary || [])
		.filter((method) => normalizeNumber(method.planned_qty) > 0)
		.slice(0, 3);
}

function getShipHistoryStatusMeta(status: any) {
	const value = String(status || "").trim();
	if (value === "success") {
		return { type: "success" as const, text: "成功" };
	}
	if (value === "partial_failed") {
		return { type: "warning" as const, text: "部分成功" };
	}
	if (value === "failed") {
		return { type: "danger" as const, text: "失败" };
	}
	if (value === "submitting" || value === "pending") {
		return { type: "info" as const, text: "处理中" };
	}
	return { type: "info" as const, text: value || "-" };
}

function formatShipHistoryDate(value: any, pattern = "YYYY-MM-DD") {
	if (!value) return "";
	const parsed = dayjs(value);
	return parsed.isValid() ? parsed.format(pattern) : String(value);
}

function getShipHistoryBatchMetaText(batch: ProductShipHistoryBatch) {
	const creator = batch.created_by_nickname || batch.created_by_username || "-";
	const finishedTime = formatShipHistoryDate(
		batch.finished_time || batch.create_time,
		"MM-DD HH:mm"
	);
	return `${creator} · ${finishedTime || "-"} · 成功 ${formatNumber(batch.success_qty)} / 失败 ${formatNumber(batch.failed_qty)}`;
}

function getShipHistoryDrawerSummaryText(data: ProductShipHistory | null) {
	const summary = data?.summary;
	if (!summary?.batch_count) return "暂无发货历史";
	return `历史 ${summary.batch_count} 批 · 成功 ${formatNumber(summary.success_qty)} 件 · 失败 ${formatNumber(summary.failed_qty)} 件 · 计划 ${formatNumber(summary.planned_qty)} 件`;
}

function getShipHistoryBatchMethodSummary(batch: ProductShipHistoryBatch) {
	const groups = batch.method_groups || [];
	if (!groups.length) return "暂无运输方式明细";
	return groups
		.map((group) => {
			const method = group.method_label || group.method_key || "未知方式";
			const successQty = normalizeNumber(group.success_qty);
			const failedQty = normalizeNumber(group.failed_qty);
			const failedText = failedQty > 0 ? `，失败${formatNumber(failedQty)}` : "";
			return `${method} 成功${formatNumber(successQty)}${failedText}`;
		})
		.join(" / ");
}

function getShipHistoryBatchMethodChips(batch: ProductShipHistoryBatch) {
	return (batch.method_groups || []).map((group) => {
		const info = getShippingMethodInfo(group.method_key);
		return {
			key: group.group_key || group.method_key,
			icon: info?.icon || "",
			label: group.method_label || group.method_key || "未知方式",
			successQty: normalizeNumber(group.success_qty),
			failedQty: normalizeNumber(group.failed_qty)
		};
	});
}

function getShipHistoryGroupSubText(group: ProductShipHistoryMethodGroup) {
	const warehouse = group.warehouse_name || "未填写仓库";
	const dateText = formatShipHistoryDate(group.shipment_time) || "未填写日期";
	return `${warehouse} · ${getBatchShipPackingTypeLabel(group.packing_type)} · ${dateText}`;
}

function getShipHistorySeqText(group: ProductShipHistoryMethodGroup) {
	return group.seqs?.length ? group.seqs.join(" / ") : "暂无领星批次";
}

function formatShipHistoryTextValue(value: any, fallback = "-") {
	const text = String(value ?? "").trim();
	return text || fallback;
}

function getShipHistoryProductCopyLine() {
	const item = shipHistoryDrawerItem.value;
	return `商品：${formatShipHistoryTextValue(item?.msku)} / ${formatShipHistoryTextValue(item?.fnsku)} / ${formatShipHistoryTextValue(item?.asin)}`;
}

function buildShipHistorySeqLines(group: ProductShipHistoryMethodGroup) {
	const seqs = Array.isArray(group.seqs) ? group.seqs.filter(Boolean) : [];
	if (!seqs.length) return ["暂无领星批次"];
	return seqs.map((seq) => String(seq));
}

function buildShipHistoryAllocationLines(group: ProductShipHistoryMethodGroup, verbose = false) {
	const allocations = group.allocations || [];
	if (!allocations.length) return ["暂无采购单拆分"];

	const lines: string[] = [];
	allocations.forEach((allocation, index) => {
		const orderText = formatShipHistoryTextValue(allocation.purchase_order_sn);
		const planText = formatShipHistoryTextValue(allocation.purchase_plan_sn);
		const seqText = formatShipHistoryTextValue(allocation.lingxing_seq);
		const qtyText = formatNumber(allocation.ship_qty);
		const errorText = allocation.error_message || allocation.local_sync_error;
		if (index > 0) lines.push("");

		if (verbose) {
			const statusText = getShipHistoryStatusMeta(allocation.status).text;
			lines.push(
				`- 采购计划 ${planText} / 采购单 ${orderText} / 领星批次 ${seqText} / 数量 ${qtyText} / 状态 ${statusText}${errorText ? ` / 原因 ${errorText}` : ""}`
			);
			return;
		}

		lines.push(
			`${index + 1}. ${orderText}`,
			`   数量：${qtyText}件`,
			`   计划：${planText}`,
			`   批次：${seqText}`
		);
		if (errorText) lines.push(`   失败原因：${errorText}`);
	});

	return lines;
}

function buildShipHistoryMethodInstruction(
	batch: ProductShipHistoryBatch,
	group: ProductShipHistoryMethodGroup,
	options: { includeProduct?: boolean; verbose?: boolean } = {}
) {
	const methodName =
		`${getShippingMethodInfo(group.method_key)?.icon || ""} ${group.method_label || group.method_key || "-"}`.trim();
	const lines: string[] = [];
	const successQty = normalizeNumber(group.success_qty);
	const failedQty = normalizeNumber(group.failed_qty);

	lines.push(`【${methodName}】${formatNumber(successQty || group.planned_qty)}件`);
	if (options.includeProduct !== false) {
		lines.push(getShipHistoryProductCopyLine());
	}
	lines.push(`仓库：${formatShipHistoryTextValue(group.warehouse_name, "未填写仓库")}`);
	lines.push(`包装：${getBatchShipPackingTypeLabel(group.packing_type)}`);
	lines.push(`发货日：${formatShipHistoryDate(group.shipment_time) || "未填写日期"}`);
	if (failedQty > 0 || options.verbose) {
		lines.push(
			`状态：成功 ${formatNumber(successQty)} 件 / 失败 ${formatNumber(failedQty)} 件 / 计划 ${formatNumber(group.planned_qty)} 件`
		);
	}
	lines.push("");
	lines.push("领星批次：");
	lines.push(...buildShipHistorySeqLines(group));
	lines.push("");
	lines.push("采购单拆分：");
	lines.push(...buildShipHistoryAllocationLines(group, Boolean(options.verbose)));

	return lines.join("\n");
}

function buildShipHistoryBatchInstruction(batch: ProductShipHistoryBatch) {
	const lines: string[] = [
		"【仓库发货指令】",
		`批次：${formatShipHistoryTextValue(batch.batch_no)}`,
		getShipHistoryProductCopyLine(),
		`合计：${formatNumber(batch.success_qty || batch.planned_qty)}件${normalizeNumber(batch.failed_qty) > 0 ? `（失败${formatNumber(batch.failed_qty)}件，请勿发失败项）` : ""}`
	];

	for (const group of batch.method_groups || []) {
		lines.push("");
		lines.push(buildShipHistoryMethodInstruction(batch, group, { includeProduct: false }));
	}

	return lines.join("\n");
}

function buildShipHistoryFullBatchRecord(batch: ProductShipHistoryBatch) {
	const item = shipHistoryDrawerItem.value;
	const statusText = getShipHistoryStatusMeta(batch.status).text;
	const createdBy = batch.created_by_nickname || batch.created_by_username || "-";
	const createdTime = formatShipHistoryDate(
		batch.finished_time || batch.create_time,
		"YYYY-MM-DD HH:mm"
	);
	const lines: string[] = [
		"【批量发货完整记录】",
		`产品：${formatShipHistoryTextValue(item?.product_name)}`,
		`MSKU：${formatShipHistoryTextValue(item?.msku)} / FNSKU：${formatShipHistoryTextValue(item?.fnsku)} / ASIN：${formatShipHistoryTextValue(item?.asin)}`,
		`批次：${formatShipHistoryTextValue(batch.batch_no)}`,
		`状态：${statusText}`,
		`创建：${createdBy} / ${createdTime || "-"}`,
		`合计：计划 ${formatNumber(batch.planned_qty)} 件，成功 ${formatNumber(batch.success_qty)} 件，失败 ${formatNumber(batch.failed_qty)} 件`
	];

	for (const group of batch.method_groups || []) {
		lines.push("");
		lines.push(
			buildShipHistoryMethodInstruction(batch, group, {
				includeProduct: false,
				verbose: true
			})
		);
	}

	return lines.join("\n");
}

async function copyTextToClipboard(text: string, successMessage: string) {
	try {
		if (navigator?.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
		} else {
			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.setAttribute("readonly", "readonly");
			textarea.style.position = "fixed";
			textarea.style.left = "-9999px";
			document.body.appendChild(textarea);
			textarea.select();
			const copied = document.execCommand("copy");
			document.body.removeChild(textarea);
			if (!copied) throw new Error("copy failed");
		}
		ElMessage.success(successMessage);
	} catch {
		ElMessage.error("复制失败，请展开明细后手动复制");
	}
}

function copyShipHistoryBatchInstruction(batch: ProductShipHistoryBatch) {
	void copyTextToClipboard(buildShipHistoryBatchInstruction(batch), "已复制仓库发货指令");
}

function copyShipHistoryFullBatchRecord(batch: ProductShipHistoryBatch) {
	void copyTextToClipboard(buildShipHistoryFullBatchRecord(batch), "已复制完整发货记录");
}

function copyShipHistoryMethodInstruction(
	batch: ProductShipHistoryBatch,
	group: ProductShipHistoryMethodGroup
) {
	void copyTextToClipboard(
		[
			"【发货运输方式指令】",
			`批次：${formatShipHistoryTextValue(batch.batch_no)}`,
			buildShipHistoryMethodInstruction(batch, group)
		].join("\n"),
		`已复制${group.method_label || "本运输方式"}指令`
	);
}

async function openReplenishTraceDrawer(item: BatchShipItem) {
	replenishTraceDrawer.itemKey = getItemKey(item);
	replenishTraceDrawer.visible = true;
	if (!item._replenishTraceLoaded && !item._replenishTraceLoading) {
		await loadReplenishTracesForItems([item]);
	}
	const firstTrace =
		item.replenishTraces.find((trace) => !trace.error && isTraceActionable(trace)) ||
		item.replenishTraces.find((trace) => !trace.error) ||
		item.replenishTraces[0];
	replenishTraceDrawer.selectedTraceKey = firstTrace?.key || "";
}

function selectReplenishTrace(trace: ReplenishTrace) {
	replenishTraceDrawer.selectedTraceKey = trace.key;
}

function getItemReplenishTraceSummary(item: BatchShipItem) {
	const orderCount = getItemOrderSns(item).length;
	if (item._replenishTraceLoading) return "加载中";
	if (!item._replenishTraceLoaded) {
		const planCount = getItemPlanSns(item).length || getItemAnalysisRecordIds(item).length;
		if (item._replenishTraceError && !planCount) return "暂无依据";
		return `${planCount || "-"}依据 / ${orderCount}单`;
	}
	const validTraces = item.replenishTraces.filter((trace) => !trace.error);
	const fullCount = validTraces.filter((trace) => isTraceActionable(trace)).length;
	const historyCount = validTraces.length - fullCount;
	if (!validTraces.length) return "暂无依据";
	return `完整${fullCount} 历史${historyCount} ${orderCount}单`;
}

function getTraceAnalysis(trace: ReplenishTrace | null) {
	return trace?.flow?.details?.replenishment_analysis || {};
}

function getTraceSnapshotMeta(trace: ReplenishTrace | null) {
	return getTraceAnalysis(trace).snapshot_meta || {};
}

function getTraceManualRemark(trace: ReplenishTrace | null) {
	return String(getTraceAnalysis(trace).manual_remark || "").trim();
}

function getItemFullReplenishTraces(item: BatchShipItem) {
	return [...(item.replenishTraces || [])]
		.filter((trace) => !trace.error && isTraceActionable(trace))
		.sort((a, b) => {
			const purchaseDiff = getTraceActualPurchaseQty(b) - getTraceActualPurchaseQty(a);
			if (purchaseDiff !== 0) return purchaseDiff;
			return getTraceSnapshotSortTime(b) - getTraceSnapshotSortTime(a);
		});
}

function getItemFullReplenishTrace(item: BatchShipItem) {
	return getItemFullReplenishTraces(item)[0] || null;
}

function getTraceActualPurchaseQty(trace: ReplenishTrace | null) {
	const finalQty = normalizeNullableNumber(
		getTraceSummaryCardRawValue(trace, "final_purchase_qty")
	);
	if (finalQty !== null && finalQty > 0) return finalQty;
	const beforeBoxQty = normalizeNullableNumber(
		getTraceSummaryCardRawValue(trace, "actual_before_box")
	);
	if (beforeBoxQty !== null && beforeBoxQty > 0) return beforeBoxQty;
	return finalQty ?? beforeBoxQty ?? 0;
}

function getTraceActualPurchaseText(trace: ReplenishTrace | null) {
	const qty = getTraceActualPurchaseQty(trace);
	return qty > 0 ? `实采 ${formatNumber(qty)}` : "实采 -";
}

function hasTraceAllInputFields(trace: ReplenishTrace | null) {
	return TRACE_FIELD_KEYS.every((field) => getTraceFieldRawValue(trace, field) !== null);
}

function getTraceSnapshotSortTime(trace: ReplenishTrace | null) {
	const meta = getTraceSnapshotMeta(trace);
	const parsed = dayjs(meta.created_at || meta.updated_at);
	if (parsed.isValid()) return parsed.valueOf();
	return Number(trace?.analysis_record_id || meta.analysis_record_id || 0);
}

function hasTraceFieldHistory(item: BatchShipItem) {
	return getItemFullReplenishTraces(item).length > 0;
}

async function openFullTraceDrawer(item: BatchShipItem, traceKey?: string) {
	await openReplenishTraceDrawer(item);
	const trace =
		item.replenishTraces.find((trace) => trace.key === traceKey) ||
		getItemFullReplenishTrace(item);
	if (trace) {
		replenishTraceDrawer.selectedTraceKey = trace.key;
	}
}

function getTraceFieldTitle(field: TraceFieldKey) {
	const map: Record<TraceFieldKey, string> = {
		daily_avg_sales: "日均销量来源",
		target_stock_days: "目标库存来源",
		volatility_coefficient: "波动系数来源"
	};
	return map[field];
}

function getTraceFieldSourceText(item: BatchShipItem) {
	const traces = getItemFullReplenishTraces(item);
	const orderCount = new Set(traces.flatMap((trace) => trace.linked_order_sns || [])).size;
	return `可追溯完整记录 ${traces.length} 条 · 关联采购单 ${orderCount} 个`;
}

function getTraceFieldUnit(field: TraceFieldKey) {
	if (field === "target_stock_days") return "天";
	return "";
}

function getTraceFieldInputValue(item: BatchShipItem, field: TraceFieldKey) {
	const values = item.calculationInputValues || createCurrentCalculationInputValues(item);
	if (field === "daily_avg_sales") return normalizeNumber(values.daily_avg_sales);
	if (field === "target_stock_days") return getEffectiveTargetStockDays(item);
	return normalizeNumber(values.volatility_coefficient) || DEFAULT_VOLATILITY_COEFFICIENT;
}

function getCalculationDailyAvgSales(item: BatchShipItem) {
	return normalizeNumber(getTraceFieldInputValue(item, "daily_avg_sales"));
}

function getCalculationVolatilityCoefficient(item: BatchShipItem) {
	return (
		normalizeNumber(getTraceFieldInputValue(item, "volatility_coefficient")) ||
		DEFAULT_VOLATILITY_COEFFICIENT
	);
}

function getCalculationDateRange(item: BatchShipItem) {
	const range = normalizeItemDateRange(item.calculationInputValues?.date_range);
	return range || normalizeItemDateRange(item.dateRange) || [];
}

function getTraceFieldInputMin(field: TraceFieldKey) {
	if (field === "target_stock_days") return 1;
	if (field === "volatility_coefficient") return 0.01;
	return 0;
}

function getTraceFieldInputMax(field: TraceFieldKey) {
	if (field === "target_stock_days") return 365;
	if (field === "volatility_coefficient") return 10;
	return 999999;
}

function getTraceFieldInputStep(field: TraceFieldKey) {
	if (field === "target_stock_days") return 1;
	if (field === "volatility_coefficient") return 0.01;
	return 0.1;
}

function getTraceFieldInputPrecision(field: TraceFieldKey) {
	if (field === "target_stock_days") return 0;
	if (field === "volatility_coefficient") return 2;
	return 2;
}

function getTraceFieldDefaultValueText(item: BatchShipItem, field: TraceFieldKey) {
	if (field === "daily_avg_sales") {
		return formatNullableNumber(item.calculationInputDefaults.daily_avg_sales);
	}
	if (field === "target_stock_days") {
		const targetDays =
			normalizePositiveInteger(item.calculationInputDefaults.target_stock_days) ||
			normalizePositiveInteger(globalDefaultTargetDays.value) ||
			DEFAULT_TARGET_STOCK_DAYS;
		const suffix = normalizePositiveInteger(item.calculationInputDefaults.target_stock_days)
			? ""
			: "默认";
		return `${formatNumber(targetDays)}天${suffix}`;
	}
	return formatCoefficientNumber(item.calculationInputDefaults.volatility_coefficient);
}

function getTraceFieldRawValue(trace: ReplenishTrace | null, field: TraceFieldKey) {
	const meta = getTraceSnapshotMeta(trace);
	const rawValue = meta[field] ?? getTraceSummaryCardRawValue(trace, field);
	return normalizeNullableNumber(rawValue);
}

function normalizeTraceFieldInputValue(field: TraceFieldKey, value: any) {
	const num = normalizeNullableNumber(value);
	if (num === null) return null;
	if (field === "target_stock_days") return Math.max(1, Math.min(365, Math.round(num)));
	if (field === "volatility_coefficient") {
		return Math.max(0.01, Math.min(10, Number(num.toFixed(2))));
	}
	return Math.max(0, Number(num.toFixed(2)));
}

function setTraceFieldInputValue(
	item: BatchShipItem,
	field: TraceFieldKey,
	value: any,
	source: TraceInputSource,
	recalculate = true
) {
	const normalized = normalizeTraceFieldInputValue(field, value);
	if (normalized === null) {
		ElMessage.warning(`${getTraceFieldTitle(field).replace("来源", "")}缺少可用数值`);
		return false;
	}

	const switchedTargetMode = field === "target_stock_days" && targetPeriodMode.value === "global";
	if (switchedTargetMode) {
		targetPeriodMode.value = "product";
		ElMessage.info("已切换为产品目标模式，单品目标库存开始生效");
	}

	if (!item.calculationInputValues) {
		item.calculationInputValues = createCurrentCalculationInputValues(item);
	}
	if (field === "daily_avg_sales") {
		item.calculationInputValues.daily_avg_sales = normalized;
	} else if (field === "target_stock_days") {
		item.manual_target_date_range = null;
		item.calculationInputValues.target_stock_days = normalized;
		item.calculationInputValues.date_range = null;
		applyEffectiveTargetStockDays(item);
	} else {
		item.calculationInputValues.volatility_coefficient = normalized;
	}

	item.calculationInputSources[field] = source;
	if (recalculate && !switchedTargetMode) void calculateItems([item], true);
	return true;
}

function handleTraceFieldManualInputChange(item: BatchShipItem, field: TraceFieldKey, value: any) {
	setTraceFieldInputValue(item, field, value, { type: "manual", label: "手动输入" });
}

function setCurrentTraceFieldInputValue(
	item: BatchShipItem,
	field: TraceFieldKey,
	recalculate = true
) {
	const source = createDefaultCalculationInputSources()[field];
	if (!item.calculationInputValues) {
		item.calculationInputValues = createCurrentCalculationInputValues(item);
	}
	if (field === "daily_avg_sales") {
		item.calculationInputValues.daily_avg_sales = normalizeNumber(
			item.calculationInputDefaults.daily_avg_sales
		);
	} else if (field === "target_stock_days") {
		item.manual_target_date_range = null;
		item.calculationInputValues.target_stock_days = normalizeNullableNumber(
			item.calculationInputDefaults.target_stock_days
		);
		item.calculationInputValues.date_range = null;
		applyEffectiveTargetStockDays(item);
	} else {
		item.calculationInputValues.volatility_coefficient =
			normalizeNullableNumber(item.calculationInputDefaults.volatility_coefficient) ||
			DEFAULT_VOLATILITY_COEFFICIENT;
	}
	item.calculationInputSources[field] = source;
	if (recalculate) void calculateItems([item], true);
	return true;
}

function handleItemAlgoChange(item: BatchShipItem) {
	item.coefficientRestoreSource = createDefaultCoefficientRestoreSource();
	item.manual_coefficient_map = {};
	void calculateItems([item], false);
}

function getSystemCurrentTraceRow(item: BatchShipItem, field: TraceFieldKey): TraceFieldTraceRow {
	return {
		key: `system-current-${field}`,
		sourceType: "current",
		traceKey: "",
		planText: "系统当前值",
		analysisText: "接口当前加载",
		valueText: getTraceFieldDefaultValueText(item, field),
		periodRangeText: "系统当前",
		periodDaysText: "非历史记录",
		algoText: "系统当前值",
		orderText: "接口值",
		actualPurchaseText: "不关联采购单",
		creatorNameText: "系统接口",
		creatorTimeText: "-"
	};
}

function getTraceFieldTraceRows(item: BatchShipItem, field: TraceFieldKey): TraceFieldTraceRow[] {
	const currentRow = getSystemCurrentTraceRow(item, field);
	const traceRows = getItemFullReplenishTraces(item).map((trace) => {
		const meta = getTraceSnapshotMeta(trace);
		const planSn = meta.plan_sn || trace.plan_sn || "未关联计划";
		const analysisId = meta.analysis_record_id || trace.analysis_record_id || "-";
		const creator = meta.created_by_name || "-";
		const createdAt = formatTraceMetaDate(meta.created_at || meta.updated_at);
		return {
			key: `${trace.key}-${field}`,
			sourceType: "trace" as const,
			traceKey: trace.key,
			planText: planSn,
			analysisText: `分析ID ${analysisId}`,
			valueText: getHistoryTraceFieldValue(trace, field),
			periodRangeText: formatTracePeriodRangeText(meta),
			periodDaysText: formatTracePeriodDaysText(meta),
			algoText: meta.algorithm_name || getAlgoLabel(item.algo || globalAlgo.value),
			orderText: `${trace.linked_order_count || trace.linked_order_sns?.length || 0}单`,
			actualPurchaseText: getTraceActualPurchaseText(trace),
			creatorNameText: creator,
			creatorTimeText: createdAt
		};
	});
	return [currentRow, ...traceRows];
}

function getTraceCardPurchaseSummary(trace: ReplenishTrace | null) {
	const actual = getTraceSummaryCardRawValue(trace, "final_purchase_qty");
	const suggested = getTraceSummaryCardRawValue(trace, "system_suggested_qty");
	return `实际 ${formatSummaryValue(actual)} / 建议 ${formatSummaryValue(suggested)}`;
}

function getTraceCardPeriodSummary(trace: ReplenishTrace | null) {
	return `周期 ${formatTracePeriodText(getTraceSnapshotMeta(trace))}`;
}

function getTraceCardCreatorSummary(trace: ReplenishTrace | null) {
	const meta = getTraceSnapshotMeta(trace);
	return `${meta.created_by_name || "-"} · ${formatTraceMetaDate(meta.created_at || meta.updated_at)}`;
}

function getHistoryTraceFieldValue(trace: ReplenishTrace | null, field: TraceFieldKey) {
	const meta = getTraceSnapshotMeta(trace);
	const rawValue = meta[field] ?? getTraceSummaryCardRawValue(trace, field);
	if (field === "target_stock_days") {
		const num = normalizeNullableNumber(rawValue);
		return num === null ? "-" : `${formatNumber(num)}天`;
	}
	if (field === "volatility_coefficient") {
		const num = normalizeNullableNumber(rawValue);
		return num === null ? "-" : formatCoefficientNumber(num);
	}
	return formatNullableNumber(rawValue);
}

function getTraceSummaryCardRawValue(trace: ReplenishTrace | null, key: string) {
	const card = getTraceSummaryCards(trace).find((item: any) => item?.key === key);
	return card?.value;
}

function formatTracePeriodText(meta: any) {
	const start = formatTraceMetaShortDate(meta.cycle_start_date);
	const end = formatTraceMetaShortDate(meta.cycle_end_date);
	const days = normalizeNullableNumber(meta.cycle_days);
	if (start !== "-" && end !== "-") {
		return `${start} ~ ${end}${days !== null ? ` / ${formatNumber(days)}天` : ""}`;
	}
	return days !== null ? `${formatNumber(days)}天` : "-";
}

function formatTracePeriodRangeText(meta: any) {
	const start = formatTraceMetaShortDate(meta.cycle_start_date);
	const end = formatTraceMetaShortDate(meta.cycle_end_date);
	if (start !== "-" && end !== "-") return `${start} ~ ${end}`;
	return "-";
}

function formatTracePeriodDaysText(meta: any) {
	const days = normalizeNullableNumber(meta.cycle_days);
	return days !== null ? `${formatNumber(days)}天` : "-";
}

function formatTraceMetaDate(value: any) {
	if (!value) return "-";
	const parsed = dayjs(value);
	return parsed.isValid() ? parsed.format("MM-DD HH:mm") : String(value);
}

function formatTraceMetaShortDate(value: any) {
	if (!value) return "-";
	const parsed = dayjs(value);
	return parsed.isValid() ? parsed.format("MM-DD") : String(value);
}

function getTraceLevel(trace: ReplenishTrace | null) {
	const analysis = getTraceAnalysis(trace);
	return (
		trace?.trace_level ||
		analysis.trace_level ||
		(analysis.source === "full_snapshot"
			? "full_record"
			: analysis.source === "legacy_snapshot"
				? "legacy_snapshot"
				: "legacy_compatible")
	);
}

function isTraceActionable(trace: ReplenishTrace | null) {
	if (!trace || trace.error) return false;
	const analysis = getTraceAnalysis(trace);
	if (trace.actionable !== undefined) return Boolean(trace.actionable);
	if (analysis.actionable !== undefined) return Boolean(analysis.actionable);
	return getTraceLevel(trace) === "full_record";
}

function normalizeTraceAlgorithmKey(value: any) {
	const text = String(value || "")
		.trim()
		.toLowerCase();
	if (!text) return "";
	if (["1", "daily", "daily_avg", "dailyavg"].includes(text) || text.includes("日均"))
		return "daily_avg";
	if (["2", "history", "sales", "historical"].includes(text) || text.includes("历史"))
		return "history";
	if (
		["3", "trend", "keyword", "keywords", "search", "search_trend"].includes(text) ||
		text.includes("搜索")
	)
		return "trend";
	if (["4", "combined", "combine"].includes(text) || text.includes("综合")) return "combined";
	if (
		["operator_intent", "operator-intent", "operation_intent"].includes(text) ||
		text.includes("运营意")
	)
		return "operator_intent";
	return text;
}

function getTraceRestoreCapability(trace: ReplenishTrace | null) {
	return getTraceAnalysis(trace).restore_capability || null;
}

function getTraceAlgorithmKey(trace: ReplenishTrace | null) {
	const meta = getTraceSnapshotMeta(trace);
	const capability = getTraceRestoreCapability(trace);
	return normalizeTraceAlgorithmKey(
		meta.algorithm_name ||
			meta.algorithm_key ||
			meta.algorithm_id ||
			capability?.algorithm_key ||
			getTraceAnalysis(trace).algorithm_key
	);
}

function isTraceRestorable(trace: ReplenishTrace | null) {
	if (!isTraceActionable(trace)) return false;
	const capability = getTraceRestoreCapability(trace);
	if (capability && capability.restorable !== undefined) return Boolean(capability.restorable);
	return hasTraceAllInputFields(trace) && getTraceShippingSegments(trace).length > 0;
}

function getItemRestorableReplenishTraces(item: BatchShipItem) {
	return getItemFullReplenishTraces(item).filter((trace) => isTraceRestorable(trace));
}

function getTraceSnapshotLabel(trace: ReplenishTrace | null) {
	if (trace?.error) return "失败";
	const analysis = getTraceAnalysis(trace);
	return (
		trace?.snapshot_label ||
		analysis.snapshot_label ||
		analysis.source_label ||
		(getTraceLevel(trace) === "full_record"
			? "完整记录"
			: getTraceLevel(trace) === "legacy_snapshot"
				? "旧版快照"
				: "历史记录")
	);
}

function getTraceTagType(trace: ReplenishTrace | null) {
	if (trace?.error) return "danger";
	if (isTraceActionable(trace)) return "success";
	return getTraceLevel(trace) === "legacy_snapshot" ? "warning" : "info";
}

function getTraceMissingLabels(trace: ReplenishTrace | null) {
	const analysis = getTraceAnalysis(trace);
	return (
		trace?.missing_section_labels ||
		analysis.missing_section_labels ||
		trace?.missing_sections ||
		analysis.missing_sections ||
		[]
	);
}

function getTraceQualityReason(trace: ReplenishTrace | null) {
	if (!trace) return "暂无补货依据";
	if (trace.error) return trace.error;
	if (isTraceActionable(trace)) return "完整记录，可用于后续运输段追溯";
	const missingLabels = getTraceMissingLabels(trace);
	if (getTraceLevel(trace) === "legacy_snapshot") {
		return `仅展示：缺少 ${missingLabels.length ? missingLabels.join("、") : "关键快照区块"}，不能用于后续运输段追溯`;
	}
	return "仅展示：无完整快照，只能查看基础历史数据，不能用于后续运输段追溯";
}

function getTraceMissingSectionText(trace: ReplenishTrace | null, sectionKey: string) {
	const missing = [
		...(trace?.missing_sections || []),
		...(getTraceAnalysis(trace).missing_sections || [])
	];
	if (missing.includes(sectionKey)) {
		return "旧版快照未记录该区块，仅可查看基础补货依据";
	}
	return "暂无该区块数据";
}

function getDrawerTraceSummary() {
	const traces = replenishTraceDrawerTraces.value.filter((trace) => !trace.error);
	const fullCount = traces.filter((trace) => isTraceActionable(trace)).length;
	const historyCount = traces.length - fullCount;
	const orderCount = new Set(traces.flatMap((trace) => trace.linked_order_sns || [])).size;
	return `完整 ${fullCount} / 历史 ${historyCount} / ${orderCount}单`;
}

function getTraceSummaryCards(trace: ReplenishTrace | null) {
	return Array.isArray(getTraceAnalysis(trace).summary_cards)
		? getTraceAnalysis(trace).summary_cards
		: [];
}

function getTraceDemandRows(trace: ReplenishTrace | null) {
	return Array.isArray(getTraceAnalysis(trace).demand_basis_rows)
		? getTraceAnalysis(trace).demand_basis_rows
		: [];
}

function getTraceShippingSegments(trace: ReplenishTrace | null) {
	return Array.isArray(getTraceAnalysis(trace).shipping_segments)
		? getTraceAnalysis(trace).shipping_segments
		: [];
}

function normalizeSegmentMethodIdentity(value: any) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[\s_\-/.·]+/g, "");
}

function getSegmentMethodAliases(method: ShippingMethod) {
	return [
		method.key,
		method.label,
		`${method.icon}${method.label}`,
		`${method.icon} ${method.label}`
	]
		.map(normalizeSegmentMethodIdentity)
		.filter(Boolean);
}

function getTraceSegmentAliases(segment: any) {
	return [
		segment?.key,
		segment?.method_key,
		segment?.shipping_method,
		segment?.label,
		segment?.method_label,
		segment?.shipping_label
	]
		.map(normalizeSegmentMethodIdentity)
		.filter(Boolean);
}

function getTraceSegmentForMethod(trace: ReplenishTrace | null, method: ShippingMethod) {
	const methodAliases = getSegmentMethodAliases(method);
	return (
		getTraceShippingSegments(trace).find((segment: any) => {
			const segmentAliases = getTraceSegmentAliases(segment);
			return segmentAliases.some((alias: string) => methodAliases.includes(alias));
		}) || null
	);
}

function normalizeCoefficientOverrideNumber(value: any) {
	const num = normalizeNullableNumber(value);
	return num === null ? undefined : num;
}

function normalizeMonthlyCoefficientOverrideRow(row: any): MonthlyCoefficientOverride | null {
	if (!row || typeof row !== "object") return null;
	const alpha = normalizeCoefficientOverrideNumber(
		row.alpha ?? row.manual_alpha ?? row.system_alpha
	);
	const salesCoeff = normalizeCoefficientOverrideNumber(
		row.filled_sales_coefficient ?? row.sales_coefficient ?? row.salesCoeff
	);
	const searchCoeff = normalizeCoefficientOverrideNumber(
		row.keyword_coefficient ?? row.search_coefficient ?? row.searchCoeff
	);
	const rawCoefficient = normalizeCoefficientOverrideNumber(
		row.raw_coefficient ??
			row.rawCoefficient ??
			row.raw_combined_coefficient ??
			row.rawCombinedCoefficient
	);
	const adjustedCoefficient = normalizeCoefficientOverrideNumber(
		row.adjusted_coefficient ??
			row.adjustedCoefficient ??
			row.final_coefficient ??
			row.finalCoefficient
	);
	const coefficient = normalizeCoefficientOverrideNumber(row.coefficient);
	if (
		rawCoefficient === undefined &&
		adjustedCoefficient === undefined &&
		coefficient === undefined &&
		alpha === undefined &&
		salesCoeff === undefined &&
		searchCoeff === undefined
	) {
		return null;
	}
	return {
		...row,
		...(rawCoefficient !== undefined ? { raw_coefficient: rawCoefficient } : {}),
		...(adjustedCoefficient !== undefined ? { adjusted_coefficient: adjustedCoefficient } : {}),
		...(coefficient !== undefined ? { coefficient } : {}),
		...(alpha !== undefined ? { alpha } : {}),
		...(salesCoeff !== undefined ? { filled_sales_coefficient: salesCoeff } : {}),
		...(searchCoeff !== undefined ? { keyword_coefficient: searchCoeff } : {})
	};
}

function normalizeTraceMonthKey(value: any) {
	const text = String(value || "").trim();
	const matched = text.match(/\d{4}-\d{2}/);
	return matched ? matched[0] : "";
}

function getTraceSegmentMonthlyOverrides(segment: any) {
	const overrides: Record<string, MonthlyCoefficientOverride> = {};
	const monthMap = segment?.monthly_coefficients || segment?.monthlyCoefficients || {};
	if (monthMap && typeof monthMap === "object" && !Array.isArray(monthMap)) {
		Object.entries(monthMap).forEach(([month, row]) => {
			const monthKey = normalizeTraceMonthKey(month);
			const normalized = normalizeMonthlyCoefficientOverrideRow(row);
			if (monthKey && normalized) overrides[monthKey] = normalized;
		});
	}
	const demandRows = Array.isArray(segment?.demand_breakdown) ? segment.demand_breakdown : [];
	demandRows.forEach((row: any) => {
		const monthKey = normalizeTraceMonthKey(row?.month || row?.monthKey || row?.date);
		if (!monthKey || overrides[monthKey]) return;
		const normalized = normalizeMonthlyCoefficientOverrideRow(row);
		if (normalized) overrides[monthKey] = normalized;
	});
	return overrides;
}

function buildTraceCoefficientRestoreSource(
	item: BatchShipItem,
	trace: ReplenishTrace
): CoefficientRestoreSource {
	const methodOverrides: Record<string, Record<string, MonthlyCoefficientOverride>> = {};
	const monthOverrides: Record<string, MonthlyCoefficientOverride> = {};
	const traceAlgo = getTraceAlgorithmKey(trace) || item.algo || globalAlgo.value;
	const meta = getTraceSnapshotMeta(trace);
	const planText = meta.plan_sn || trace.plan_sn || "完整记录";
	const analysisText =
		meta.analysis_record_id || trace.analysis_record_id
			? `/${meta.analysis_record_id || trace.analysis_record_id}`
			: "";

	shippingMethods.forEach((method) => {
		const segment = getTraceSegmentForMethod(trace, method);
		if (!segment) return;
		const overrides = getTraceSegmentMonthlyOverrides(segment);
		if (!Object.keys(overrides).length) return;
		methodOverrides[method.key] = overrides;
		Object.entries(overrides).forEach(([month, row]) => {
			if (!monthOverrides[month]) monthOverrides[month] = row;
		});
	});

	return {
		type: "trace",
		label: `${planText}${analysisText} · ${getAlgoLabel(traceAlgo)}`,
		traceKey: trace.key,
		algorithm: traceAlgo,
		methodOverrides,
		monthOverrides
	};
}

function getMethodRestoredMonthCoefficientOverride(
	item: BatchShipItem,
	methodKey: string,
	month: string
) {
	const source = item.coefficientRestoreSource;
	if (!source || source.type !== "trace") return null;
	return source.methodOverrides?.[methodKey]?.[month] || source.monthOverrides?.[month] || null;
}

function getSegmentMonthParts(segment: ShippingSegmentResult | null | undefined) {
	if (!segment?.startDate || !segment?.endDate) return [];
	const parts: Array<{ month: string; days: number }> = [];
	let cursor = dayjs(segment.startDate).startOf("day");
	const end = dayjs(segment.endDate).startOf("day");
	if (!cursor.isValid() || !end.isValid() || end.isBefore(cursor, "day")) return parts;

	while (cursor.isBefore(end, "day") || cursor.isSame(end, "day")) {
		const monthEnd = cursor.endOf("month").startOf("day");
		const partEnd = monthEnd.isBefore(end, "day") ? monthEnd : end;
		parts.push({
			month: cursor.format("YYYY-MM"),
			days: partEnd.diff(cursor, "day") + 1
		});
		cursor = partEnd.add(1, "day");
	}

	return parts;
}

function getCurrentCombinedCoefficientSource(item: BatchShipItem, month: string) {
	return item._calendarData?.calendar?.[month]?.combined || null;
}

function getManualSegmentCoefficientOverride(item: BatchShipItem, methodKey: string) {
	return item.manual_coefficient_map?.[methodKey] || { finalCoefficient: null, alpha: null };
}

function normalizeManualFinalCoefficient(value: any) {
	const num = normalizeNullableNumber(value);
	return num === null ? null : Math.max(0, Math.min(20, Number(num.toFixed(2))));
}

function normalizeManualAlpha(value: any) {
	const num = normalizeNullableNumber(value);
	return num === null ? null : Math.max(0, Math.min(1, Number(num.toFixed(2))));
}

function buildManualAlphaOverrideRow(
	item: BatchShipItem,
	methodKey: string,
	month: string,
	alpha: number
) {
	const restored = getMethodRestoredMonthCoefficientOverride(item, methodKey, month);
	const current = getCurrentCombinedCoefficientSource(item, month);
	const salesCoeff =
		normalizeNullableNumber(
			restored?.filled_sales_coefficient ??
				restored?.sales_coefficient ??
				restored?.salesCoeff
		) ??
		normalizeNullableNumber(
			current?.filled_sales_coefficient ?? current?.sales_coefficient ?? current?.salesCoeff
		) ??
		1;
	const searchCoeff =
		normalizeNullableNumber(
			restored?.keyword_coefficient ?? restored?.search_coefficient ?? restored?.searchCoeff
		) ??
		normalizeNullableNumber(
			current?.keyword_coefficient ?? current?.search_coefficient ?? current?.searchCoeff
		) ??
		1;

	return {
		alpha,
		manual_alpha: alpha,
		filled_sales_coefficient: salesCoeff,
		keyword_coefficient: searchCoeff,
		source: "manual_alpha"
	};
}

function getCoefficientOverrideRequestFields(
	item: BatchShipItem,
	methodKey: string,
	segment?: ShippingSegmentResult | null
) {
	const source = item.coefficientRestoreSource;
	const sourceOverrides =
		source && source.type === "trace" && methodKey
			? source.methodOverrides?.[methodKey] || {}
			: {};
	const manualOverride = getManualSegmentCoefficientOverride(item, methodKey);
	const manualFinalCoefficient = normalizeManualFinalCoefficient(manualOverride.finalCoefficient);
	const manualAlpha = normalizeManualAlpha(manualOverride.alpha);
	const hasManualOverride = manualFinalCoefficient !== null || manualAlpha !== null;
	if (!Object.keys(sourceOverrides).length && !hasManualOverride) return {};

	const overrides: Record<string, MonthlyCoefficientOverride> = { ...sourceOverrides };
	const segmentMonths = getSegmentMonthParts(segment).map((part) => part.month);
	const targetMonths = Array.from(new Set([...Object.keys(overrides), ...segmentMonths]));
	const algo = item.algo || globalAlgo.value;

	if (manualFinalCoefficient !== null) {
		targetMonths.forEach((month) => {
			overrides[month] = {
				...(overrides[month] || {}),
				adjusted_coefficient: manualFinalCoefficient,
				final_coefficient: manualFinalCoefficient,
				source: "manual_final_coefficient"
			};
		});
	} else if (manualAlpha !== null && isCombinedAlgoKey(algo)) {
		targetMonths.forEach((month) => {
			overrides[month] = buildManualAlphaOverrideRow(item, methodKey, month, manualAlpha);
		});
	}

	if (!Object.keys(overrides).length) return {};
	const monthlyAlphas = Object.entries(overrides).reduce(
		(acc, [month, row]) => {
			const alpha = normalizeNullableNumber(row.alpha ?? row.manual_alpha);
			if (alpha !== null) acc[month] = alpha;
			return acc;
		},
		{} as Record<string, number>
	);
	return {
		useSnapshotCoefficientOverrides: true,
		monthlyCoefficientOverrides: overrides,
		...(Object.keys(monthlyAlphas).length ? { monthlyAlphas } : {})
	};
}

function getRestoredMonthCoefficientOverride(item: BatchShipItem, month: string) {
	const source = item.coefficientRestoreSource;
	if (!source || source.type !== "trace") return null;
	return source.monthOverrides?.[month] || null;
}

function getCoefficientRestoreSourceText(item: BatchShipItem) {
	const source = item.coefficientRestoreSource;
	if (!source || source.type === "current") return "系统当前系数";
	return source.label || "完整记录系数";
}

function getCoefficientRestoreSourceTone(item: BatchShipItem) {
	return item.coefficientRestoreSource?.type === "trace" ? "success" : "default";
}

function getCurrentAppliedTraceKey(item: BatchShipItem) {
	const historyKeys = TRACE_FIELD_KEYS.map((field) => {
		const source = item.calculationInputSources[field];
		return source?.type === "history" ? source.traceKey || "" : "";
	});
	const firstKey = historyKeys[0];
	return firstKey && historyKeys.every((key) => key === firstKey) ? firstKey : "";
}

function getShippingMethodOrder(methodKey: string) {
	const index = DEFAULT_SHIPPING_METHOD_CONFIGS.findIndex((method) => method.key === methodKey);
	return index >= 0 ? index : DEFAULT_SHIPPING_METHOD_CONFIGS.length;
}

function getTraceDistributionMethods() {
	return shippingMethods
		.slice()
		.sort((a, b) => getShippingMethodOrder(a.key) - getShippingMethodOrder(b.key));
}

function getTraceDistributionFocusKey(item: BatchShipItem) {
	return traceDistributionFocusMap[getItemKey(item)] || "";
}

function setTraceDistributionFocus(item: BatchShipItem, methodKey: string) {
	traceDistributionFocusMap[getItemKey(item)] = methodKey;
}

function getTraceSegmentDateValue(segment: any, keys: string[]) {
	for (const key of keys) {
		if (segment?.[key]) return segment[key];
	}
	return "";
}

function getTraceSegmentPeriodParts(
	segment: any,
	overrides: Record<string, MonthlyCoefficientOverride>
) {
	const startDate = getTraceSegmentDateValue(segment, [
		"start_date",
		"startDate",
		"cycle_start_date"
	]);
	const endDate = getTraceSegmentDateValue(segment, ["end_date", "endDate", "cycle_end_date"]);
	const parts: Array<{ month: string; days: number }> = [];
	let cursor = dayjs(startDate).startOf("day");
	const end = dayjs(endDate).startOf("day");

	if (cursor.isValid() && end.isValid() && !end.isBefore(cursor, "day")) {
		while (cursor.isBefore(end, "day") || cursor.isSame(end, "day")) {
			const monthEnd = cursor.endOf("month").startOf("day");
			const partEnd = monthEnd.isBefore(end, "day") ? monthEnd : end;
			parts.push({
				month: cursor.format("YYYY-MM"),
				days: partEnd.diff(cursor, "day") + 1
			});
			cursor = partEnd.add(1, "day");
		}
		return parts;
	}

	return Object.entries(overrides).map(([month, row]) => ({
		month,
		days:
			normalizePositiveInteger((row as any).days) ||
			normalizePositiveInteger(segment?.days) ||
			0
	}));
}

function formatTraceSegmentPeriodText(segment: any) {
	if (segment?.period_label) return String(segment.period_label);
	const startDate = getTraceSegmentDateValue(segment, [
		"start_date",
		"startDate",
		"cycle_start_date"
	]);
	const endDate = getTraceSegmentDateValue(segment, ["end_date", "endDate", "cycle_end_date"]);
	const start = formatTraceMetaShortDate(startDate);
	const end = formatTraceMetaShortDate(endDate);
	const days = normalizeNullableNumber(segment?.days ?? segment?.cycle_days);
	if (start !== "-" && end !== "-")
		return `${start}~${end}${days !== null ? `/${formatNumber(days)}天` : ""}`;
	return days !== null ? `${formatNumber(days)}天` : "-";
}

function getTraceDistributionWeightedText(values: number[]) {
	const valid = values.filter((value) => Number.isFinite(value));
	if (!valid.length) return "-";
	const unique = [...new Set(valid.map((value) => formatCoefficientNumber(value)))];
	return unique.length === 1 ? unique[0] : `${unique[0]}~${unique[unique.length - 1]}`;
}

function formatTraceTargetStockDays(value: any) {
	const num = normalizeNullableNumber(value);
	return num === null ? "-" : `${formatNumber(num)}天`;
}

function buildTraceDistributionCoefficient(trace: ReplenishTrace, segment: any) {
	const algo = getTraceAlgorithmKey(trace) || DEFAULT_GLOBAL_ALGO;
	const volatility =
		getTraceFieldRawValue(trace, "volatility_coefficient") || DEFAULT_VOLATILITY_COEFFICIENT;
	const overrides = getTraceSegmentMonthlyOverrides(segment);
	const parts = getTraceSegmentPeriodParts(segment, overrides);
	const months = Array.from(
		new Set([...parts.map((part) => part.month), ...Object.keys(overrides)])
	);
	const monthRows = months.map((month) => {
		const override = overrides[month] || {};
		const part = parts.find((row) => row.month === month);
		const raw =
			normalizeNullableNumber(
				override.raw_coefficient ??
					(override as any).rawCoefficient ??
					(override as any).raw_combined_coefficient ??
					(override as any).rawCombinedCoefficient ??
					override.coefficient
			) ?? 1;
		const final =
			normalizeNullableNumber(
				override.adjusted_coefficient ??
					(override as any).adjustedCoefficient ??
					(override as any).final_coefficient ??
					(override as any).finalCoefficient
			) ?? (algo === "daily_avg" ? 1 : applyVolatilityToCoefficient(raw, volatility));
		const alpha = normalizeNullableNumber(
			override.alpha ?? (override as any).manual_alpha ?? (override as any).system_alpha
		);
		const salesCoeff = normalizeNullableNumber(
			override.filled_sales_coefficient ??
				(override as any).sales_coefficient ??
				(override as any).salesCoeff
		);
		const searchCoeff = normalizeNullableNumber(
			override.keyword_coefficient ??
				(override as any).search_coefficient ??
				(override as any).searchCoeff
		);
		const days = normalizePositiveInteger((override as any).days) || part?.days || 0;
		const formulaText =
			isCombinedAlgoKey(algo)
				? `综合 ${formatCoefficientNumber(alpha ?? 0.7)} × ${formatCoefficientNumber(salesCoeff ?? 1)} + ${formatCoefficientNumber(1 - (alpha ?? 0.7))} × ${formatCoefficientNumber(searchCoeff ?? 1)}，波动修正后 ${formatCoefficientNumber(final)}`
				: `原始 ${formatCoefficientNumber(raw)}，波动 ${formatCoefficientNumber(volatility)}，最终 ${formatCoefficientNumber(final)}`;
		return {
			key: month,
			monthText: `${Number(month.slice(5))}月`,
			daysText: days > 0 ? `${days}天` : "-",
			rawText: formatCoefficientNumber(raw),
			finalText: formatCoefficientNumber(final),
			alphaText: alpha === null ? "-" : formatCoefficientNumber(alpha),
			salesText: salesCoeff === null ? "-" : formatCoefficientNumber(salesCoeff),
			searchText: searchCoeff === null ? "-" : formatCoefficientNumber(searchCoeff),
			formulaText,
			final,
			alpha
		};
	});
	const finalValues = monthRows.map((row) => row.final);
	const alphaValues = monthRows
		.map((row) => row.alpha)
		.filter((value): value is number => value !== null && value !== undefined);

	return {
		coefficientText: getTraceDistributionWeightedText(finalValues),
		alphaText: alphaValues.length ? getTraceDistributionWeightedText(alphaValues) : "-",
		monthlyRows: monthRows
	};
}

function buildTraceDistributionMethodCell(
	trace: ReplenishTrace,
	method: ShippingMethod
): TraceDistributionMethodCell {
	const segment = getTraceSegmentForMethod(trace, method);
	if (!segment) {
		return {
			key: `${trace.key}_${method.key}`,
			methodKey: method.key,
			label: method.label,
			icon: method.icon,
			color: method.color,
			tone: "inactive",
			qtyText: "取消",
			periodText: "未参与",
			coefficientText: "-",
			alphaText: "-",
			statusText: "取消/未参与",
			hasSegment: false,
			monthlyRows: []
		};
	}

	const quantity = normalizeNumber(segment.quantity ?? segment.system_quantity);
	const coefficient = buildTraceDistributionCoefficient(trace, segment);
	const statusText = segment.status_text || (quantity > 0 ? "有建议" : "无建议");
	const tone = statusText.includes("目标") ? "outside" : quantity > 0 ? "ship" : "zero";

	return {
		key: `${trace.key}_${method.key}`,
		methodKey: method.key,
		label: method.label,
		icon: method.icon,
		color: method.color,
		tone,
		qtyText: quantity > 0 ? formatNumber(quantity) : "0",
		periodText: formatTraceSegmentPeriodText(segment),
		coefficientText: coefficient.coefficientText,
		alphaText: coefficient.alphaText,
		statusText,
		hasSegment: true,
		monthlyRows: coefficient.monthlyRows
	};
}

function getTraceDistributionRows(item: BatchShipItem): TraceDistributionRow[] {
	const currentTraceKey = getCurrentAppliedTraceKey(item);
	return getItemFullReplenishTraces(item).map((trace) => {
		const meta = getTraceSnapshotMeta(trace);
		const manualRemarkText = getTraceManualRemark(trace);
		const methodCells = getTraceDistributionMethods().map((method) =>
			buildTraceDistributionMethodCell(trace, method)
		);
		const total = methodCells.reduce((sum, cell) => sum + normalizeNumber(cell.qtyText), 0);
		return {
			key: trace.key,
			traceKey: trace.key,
			isCurrent: Boolean(currentTraceKey && trace.key === currentTraceKey),
			isDefault: false,
			planText: meta.plan_sn || trace.plan_sn || "未关联计划",
			analysisText: `分析 ${meta.analysis_record_id || trace.analysis_record_id || "-"}`,
			algoText: getAlgoLabel(getTraceAlgorithmKey(trace) || item.algo || globalAlgo.value),
			targetText: formatTraceTargetStockDays(
				getTraceFieldRawValue(trace, "target_stock_days")
			),
			dailyText: formatNullableNumber(getTraceFieldRawValue(trace, "daily_avg_sales"), 2),
			volatilityText: formatCoefficientNumber(
				getTraceFieldRawValue(trace, "volatility_coefficient") ||
					DEFAULT_VOLATILITY_COEFFICIENT
			),
			actualPurchaseText: getTraceActualPurchaseText(trace),
			orderText: `关联 ${trace.linked_order_count || trace.linked_order_sns?.length || 0}单`,
			totalText: formatNumber(total),
			manualRemarkText,
			hasManualRemark: Boolean(manualRemarkText),
			methodCells
		};
	});
}

function formatTraceDistributionPercent(value: number) {
	const percent = Number.isFinite(value) ? value : 0;
	if (Math.abs(percent) < 0.05) return "0%";
	if (Math.abs(percent - 100) < 0.05) return "100%";
	return `${Number(percent.toFixed(1))}%`;
}

function getTraceDistributionMethodQty(row: TraceDistributionRow, methodKey: string) {
	const cell = row.methodCells.find((item) => item.methodKey === methodKey);
	return normalizeNumber(cell?.qtyText);
}

function getTraceDistributionMethodHeaders(item: BatchShipItem): TraceDistributionMethodHeader[] {
	const rows = getTraceDistributionRows(item);
	const methods = getTraceDistributionMethods();
	const methodTotalMap = methods.reduce(
		(map, method) => {
			map[method.key] = rows.reduce(
				(sum, row) => sum + getTraceDistributionMethodQty(row, method.key),
				0
			);
			return map;
		},
		{} as Record<string, number>
	);
	const allTotalQty = Object.values(methodTotalMap).reduce((sum, qty) => sum + qty, 0);

	return methods.map((method) => {
		const totalQty = methodTotalMap[method.key] || 0;
		const percentText = formatTraceDistributionPercent(
			allTotalQty > 0 ? (totalQty / allTotalQty) * 100 : 0
		);
		const totalText = formatNumber(totalQty);
		const allTotalText = formatNumber(allTotalQty);
		const detailRows = rows
			.map((row, index) => {
				const qty = getTraceDistributionMethodQty(row, method.key);
				return qty > 0
					? {
							key: `${method.key}-${row.traceKey || row.key || index}`,
							planText: row.planText,
							qtyText: formatNumber(qty),
							percentText: formatTraceDistributionPercent(
								allTotalQty > 0 ? (qty / allTotalQty) * 100 : 0
							)
						}
					: null;
			})
			.filter(Boolean) as TraceDistributionMethodSummary["detailRows"];

		return {
			...method,
			totalQty,
			allTotalQty,
			totalText,
			allTotalText,
			percentText,
			compactText: `${totalText} / ${percentText}`,
			sourceCountText: `${detailRows.length}条`,
			detailRows: detailRows.length
				? detailRows
				: [
						{
							key: `${method.key}-empty`,
							planText: "暂无来源",
							qtyText: "0",
							percentText: "0%"
						}
					]
		};
	});
}

function buildSegmentMonthCoefficientRow(
	item: BatchShipItem,
	methodKey: string,
	month: string,
	algo: string,
	manualAlpha: number | null = null
) {
	const volatility = getCalculationVolatilityCoefficient(item);
	const restored = getMethodRestoredMonthCoefficientOverride(item, methodKey, month);
	const calendar = item._calendarData?.calendar?.[month];
	const isHistorySource = Boolean(restored);
	const baseSource = restored || {};
	const getRawFrom = (source: any) =>
		normalizeNullableNumber(
			source?.raw_coefficient ??
				source?.rawCoefficient ??
				source?.raw_combined_coefficient ??
				source?.rawCombinedCoefficient ??
				source?.coefficient
		);

	if (algo === "daily_avg") {
		return {
			month,
			rawCoefficient: 1,
			finalCoefficient: 1,
			alpha: null,
			salesCoeff: null,
			searchCoeff: null,
			hasData: true,
			sourceText: "日均固定",
			sourceTone: "daily",
			formulaText: "日均销量算法固定系数 1.00"
		};
	}

	if (isCombinedAlgoKey(algo)) {
		const current = calendar?.combined || {};
		const alpha =
			manualAlpha ??
			normalizeNullableNumber(
				baseSource?.alpha ?? baseSource?.manual_alpha ?? baseSource?.system_alpha
			) ??
			normalizeNullableNumber(current?.system_alpha ?? current?.alpha) ??
			0.7;
		const salesCoeff =
			normalizeNullableNumber(
				baseSource?.filled_sales_coefficient ??
					baseSource?.sales_coefficient ??
					baseSource?.salesCoeff
			) ??
			normalizeNullableNumber(
				current?.filled_sales_coefficient ??
					current?.sales_coefficient ??
					current?.salesCoeff
			) ??
			1;
		const searchCoeff =
			normalizeNullableNumber(
				baseSource?.keyword_coefficient ??
					baseSource?.search_coefficient ??
					baseSource?.searchCoeff
			) ??
			normalizeNullableNumber(
				current?.keyword_coefficient ?? current?.search_coefficient ?? current?.searchCoeff
			) ??
			1;
		const rawCoefficient =
			manualAlpha !== null
				? Math.round((alpha * salesCoeff + (1 - alpha) * searchCoeff) * 100) / 100
				: (getRawFrom(baseSource) ?? normalizeNullableNumber(current?.coefficient) ?? 1);
		const finalCoefficient =
			normalizeNullableNumber(
				baseSource?.adjusted_coefficient ?? baseSource?.final_coefficient
			) ?? applyVolatilityToCoefficient(rawCoefficient, volatility);

		return {
			month,
			rawCoefficient,
			finalCoefficient,
			alpha,
			salesCoeff,
			searchCoeff,
			hasData: isHistorySource || Boolean(calendar?.combined),
			sourceText: isHistorySource ? "历史完整记录" : "系统日历",
			sourceTone: isHistorySource ? "history" : "current",
			formulaText: `${formatCoefficientNumber(alpha)} × ${formatCoefficientNumber(salesCoeff)} + ${formatCoefficientNumber(1 - alpha)} × ${formatCoefficientNumber(searchCoeff)} = ${formatCoefficientNumber(rawCoefficient)}`
		};
	}

	const current =
		algo === "history"
			? calendar?.sales
			: algo === "trend"
				? calendar?.keywords
				: calendar?.combined;
	const rawCoefficient =
		getRawFrom(baseSource) ??
		normalizeNullableNumber(current?.raw_coefficient ?? current?.coefficient) ??
		1;
	const finalCoefficient =
		normalizeNullableNumber(
			baseSource?.adjusted_coefficient ?? baseSource?.final_coefficient
		) ?? applyVolatilityToCoefficient(rawCoefficient, volatility);

	return {
		month,
		rawCoefficient,
		finalCoefficient,
		alpha: null,
		salesCoeff: null,
		searchCoeff: null,
		hasData: isHistorySource || Boolean(current),
		sourceText: isHistorySource ? "历史完整记录" : current ? "系统日历" : "缺失按1",
		sourceTone: isHistorySource ? "history" : current ? "current" : "empty",
		formulaText: `(${formatCoefficientNumber(rawCoefficient)} - 1) × ${formatCoefficientNumber(volatility)} + 1 = ${formatCoefficientNumber(finalCoefficient)}`
	};
}

function getWeightedAverageByDays(rows: Array<{ value: number; days: number }>, fallback = 1) {
	const totalDays = rows.reduce((sum, row) => sum + normalizeNumber(row.days), 0);
	if (totalDays <= 0) return fallback;
	return (
		rows.reduce((sum, row) => sum + normalizeNumber(row.value) * normalizeNumber(row.days), 0) /
		totalDays
	);
}

function buildSegmentCoefficientPanel(
	item: BatchShipItem,
	method: ShippingMethod,
	segment: ShippingSegmentResult | null
) {
	const algo = item.algo || globalAlgo.value;
	const override = getManualSegmentCoefficientOverride(item, method.key);
	const manualFinalCoefficient = normalizeManualFinalCoefficient(override.finalCoefficient);
	const manualAlpha = normalizeManualAlpha(override.alpha);
	const parts = getSegmentMonthParts(segment);
	const rows = parts.map((part) => {
		const row = buildSegmentMonthCoefficientRow(
			item,
			method.key,
			part.month,
			algo,
			manualAlpha
		);
		return {
			...row,
			days: part.days,
			monthText: `${Number(part.month.slice(5))}月`,
			rawText: formatCoefficientNumber(row.rawCoefficient),
			finalText: formatCoefficientNumber(row.finalCoefficient),
			alphaText: row.alpha === null ? "-" : formatCoefficientNumber(row.alpha),
			salesText: row.salesCoeff === null ? "-" : formatCoefficientNumber(row.salesCoeff),
			searchText: row.searchCoeff === null ? "-" : formatCoefficientNumber(row.searchCoeff)
		};
	});
	const weightedFinal = getWeightedAverageByDays(
		rows.map((row) => ({ value: row.finalCoefficient, days: row.days })),
		1
	);
	const weightedAlpha = getWeightedAverageByDays(
		rows
			.filter((row) => row.alpha !== null)
			.map((row) => ({ value: normalizeNumber(row.alpha), days: row.days })),
		0.7
	);
	const finalCoefficient = manualFinalCoefficient ?? Math.round(weightedFinal * 100) / 100;
	const sourceTone =
		manualFinalCoefficient !== null
			? "manual"
			: manualAlpha !== null
				? "manual"
				: rows.some((row) => row.sourceTone === "history")
					? "history"
					: algo === "daily_avg"
						? "daily"
						: "current";
	const sourceText =
		manualFinalCoefficient !== null
			? "人工系数"
			: manualAlpha !== null
				? "人工α"
				: rows.some((row) => row.sourceTone === "history")
					? "历史"
					: algo === "daily_avg"
						? "日均"
						: "系统";

	return {
		coefficientValue: finalCoefficient,
		coefficientText: formatCoefficientNumber(finalCoefficient),
		coefficientSourceText: sourceText,
		coefficientTone: sourceTone,
		coefficientRows: rows,
		coefficientFormulaRows: rows.length
			? rows.map((row) => `${row.monthText} ${row.days}天 · ${row.formulaText}`)
			: ["本运输方式未覆盖目标周期。"],
		coefficientInputValue: manualFinalCoefficient ?? finalCoefficient,
		alphaInputValue: manualAlpha ?? Math.round(weightedAlpha * 100) / 100,
		manualFinalCoefficient: manualFinalCoefficient,
		manualAlpha,
		canEditAlpha: isCombinedAlgoKey(algo),
		coefficientNotice:
			manualFinalCoefficient !== null
				? "已手动指定最终系数，本段不会再随α变化。"
				: manualAlpha !== null
					? "已手动指定α，本段按新的综合系数重新推演。"
					: rows.some((row) => row.sourceTone === "history")
						? "当前使用完整补货记录中的历史逐月系数。"
						: "当前使用系统日历系数。"
	};
}

function setSegmentManualFinalCoefficient(item: BatchShipItem, methodKey: string, value: any) {
	const next = normalizeManualFinalCoefficient(value);
	if (next === null) {
		ElMessage.warning("请输入有效的最终系数");
		return;
	}
	item.manual_coefficient_map[methodKey] = {
		...getManualSegmentCoefficientOverride(item, methodKey),
		finalCoefficient: next
	};
	void calculateItems([item], true);
}

function setSegmentManualAlpha(item: BatchShipItem, methodKey: string, value: any) {
	const next = normalizeManualAlpha(value);
	if (next === null) {
		ElMessage.warning("请输入 0 到 1 之间的α");
		return;
	}
	item.manual_coefficient_map[methodKey] = {
		...getManualSegmentCoefficientOverride(item, methodKey),
		alpha: next,
		finalCoefficient: null
	};
	void calculateItems([item], true);
}

function resetSegmentCoefficientOverride(item: BatchShipItem, methodKey: string) {
	delete item.manual_coefficient_map[methodKey];
	void calculateItems([item], true);
}

function getTraceCoefficientRows(trace: ReplenishTrace | null) {
	return Array.isArray(getTraceAnalysis(trace).coefficient_rows)
		? getTraceAnalysis(trace).coefficient_rows
		: [];
}

function getTraceDeductionRows(trace: ReplenishTrace | null) {
	return Array.isArray(getTraceAnalysis(trace).deduction_rows)
		? getTraceAnalysis(trace).deduction_rows
		: [];
}

function getTraceInventoryRows(trace: ReplenishTrace | null) {
	return Array.isArray(getTraceAnalysis(trace).inventory_rows)
		? getTraceAnalysis(trace).inventory_rows
		: [];
}

function getTraceFormulaSteps(trace: ReplenishTrace | null) {
	return Array.isArray(getTraceAnalysis(trace).formula_steps)
		? getTraceAnalysis(trace).formula_steps
		: [];
}

function getTraceRawSnapshotSections(trace: ReplenishTrace | null) {
	const sections = getTraceAnalysis(trace).raw_snapshot_sections || {};
	return Object.entries(sections)
		.filter(([, value]) => value !== undefined && value !== null && value !== "")
		.map(([key, value]) => ({
			key,
			label: getRawSnapshotSectionLabel(key),
			value
		}));
}

function getRawSnapshotSectionLabel(key: string) {
	const map: Record<string, string> = {
		quick_fields: "快速字段",
		summary_json: "汇总",
		input_json: "输入参数",
		calculation_json: "计算过程",
		shipping_json: "运输段",
		adjustment_json: "调整记录",
		coefficient_json: "系数",
		inventory_json: "库存",
		remark_json: "备注",
		ui_snapshot_json: "界面快照",
		full_snapshot_json: "完整原始快照"
	};
	return map[key] || key;
}

function formatTraceJson(value: any) {
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value || "-");
	}
}

function getTracePlanTitle(trace: ReplenishTrace | null) {
	return trace?.plan_sn || trace?.flow?.summary?.plan_sn || "未关联计划";
}

function getTraceSummaryMetricValue(card: any) {
	if (card?.value === undefined || card?.value === null || card?.value === "") return "-";
	return typeof card.value === "number" ? formatNumber(card.value) : String(card.value);
}

async function loadCurrentTargetStockDays() {
	const targets = dialogItems.value.filter((item) => item.asin && item.marketplace);
	if (!targets.length) return;

	targetStockLoading.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/analysis/getTargetStockDaysBatch",
			method: "POST",
			data: {
				items: targets.map((item) => ({
					clientKey: getTargetStockClientKey(item),
					listing_id: item.listing_id,
					product_code: item.product_code,
					marketplace: item.marketplace,
					asin: item.asin,
					msku: item.msku,
					store_id: item.store_id
				}))
			}
		});
		const resultMap = new Map((res?.list || []).map((item: any) => [item.clientKey, item]));
		dialogItems.value.forEach((item) => {
			const result = resultMap.get(getTargetStockClientKey(item));
			item.current_target_stock_days = normalizeNullableNumber((result as any)?.target_days);
			applyEffectiveTargetStockDays(item);
		});
	} catch (error: any) {
		ElMessage.warning(error?.message || "目标库存天数加载失败，已使用默认值");
		dialogItems.value.forEach(applyEffectiveTargetStockDays);
	} finally {
		targetStockLoading.value = false;
	}
}

async function loadVolatilityCoefficients() {
	const targets = dialogItems.value.filter((item) => item.asin && item.marketplace);
	if (!targets.length) return;

	volatilityLoading.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/analysis/getVolatilityCoefficientBatch",
			method: "POST",
			data: {
				items: targets.map((item) => ({
					clientKey: getVolatilityCoefficientClientKey(item),
					listing_id: item.listing_id,
					product_code: item.product_code,
					marketplace: item.marketplace,
					asin: item.asin,
					msku: item.msku,
					store_id: item.store_id
				}))
			}
		});
		const resultMap = new Map((res?.list || []).map((item: any) => [item.clientKey, item]));
		dialogItems.value.forEach((item) => {
			const result = resultMap.get(getVolatilityCoefficientClientKey(item));
			const coefficient = normalizeNullableNumber((result as any)?.volatility_coefficient);
			item.volatility_coefficient =
				coefficient !== null && coefficient > 0
					? coefficient
					: DEFAULT_VOLATILITY_COEFFICIENT;
		});
	} catch (error: any) {
		ElMessage.warning(error?.message || "波动系数加载失败，已按 0.75 计算");
	} finally {
		volatilityLoading.value = false;
	}
}

async function hydrateRestockingData() {
	const targets = dialogItems.value.filter((item) => item.asin && item.marketplace);
	if (!targets.length) return;

	restockingLoading.value = true;
	try {
		const res = await (
			service.app as any
		).bsr_restocking_center_lingxing.getByAsinAndMarketplaceBatch({
			items: targets.map((item) => ({
				asin: item.asin,
				marketplace: item.marketplace,
				sellerName: item.seller_name,
				msku: item.msku
			}))
		});
		const list = Array.isArray(res) ? res : res?.list || [];
		dialogItems.value.forEach((item) => {
			const matched = findRestockingForItem(list, item);
			if (!matched) return;
			const fbaValidList = pickArray(matched, [
				"fbaValidList",
				"fba_valid_list",
				"fbaValidDetailList"
			]);
			const fbaShippingList = pickArray(matched, [
				"fbaShippingList",
				"fba_shipping_list",
				"fbaShippingDetailList"
			]);
			const extInfo = parseMaybeJson(matched.extInfo) || {};
			const amazonQuantityInfo = parseMaybeJson(matched.amazonQuantityInfo) || {};
			const localValidList =
				pickArray(matched, ["localValidList", "local_valid_list"]) ||
				pickArray(extInfo, ["localValidDetailList", "localValidList"]);
			const estimatedShippingDetails =
				pickArray(matched, ["estimated_shipping_details", "fbaShippingPlanDetailList"]) ||
				pickArray(extInfo, ["fbaShippingPlanDetailList", "estimatedShippingDetails"]);

			item.fbaValidList = fbaValidList || item.fbaValidList;
			item.fbaShippingList = fbaShippingList || item.fbaShippingList;
			item.localValidList = localValidList || item.localValidList;
			item.estimated_shipping_details =
				estimatedShippingDetails || item.estimated_shipping_details;
			item.estimated_shipping_qty = normalizeNullableNumber(
				matched.estimated_shipping_qty ??
					matched.restocking_estimated_sale_quantity ??
					amazonQuantityInfo.amazonQuantityShippingPlan ??
					item.estimated_shipping_qty
			);
			item.fba_qty = normalizeNumber(matched.fba_qty ?? matched.fbaValid ?? item.fba_qty);
			item.fba_reserved_qty = normalizeNumber(
				matched.fba_reserved_qty ??
					matched.afnReservedQuantity ??
					matched.afn_reserved_quantity ??
					item.fba_reserved_qty
			);
			item.in_transit_qty = normalizeNumber(
				matched.in_transit_qty ?? matched.fbaShippingQty ?? item.in_transit_qty
			);
			item.local_qty = normalizeNumber(
				matched.local_qty ?? matched.localValidQty ?? item.local_qty
			);
			item.out_stock_date =
				matched.out_stock_date || matched.outStockDate || item.out_stock_date;
			item.fba_qty = getFbaInventoryQuantityForGap(item);
			item.fba_reserved_qty = getFbaReservedQuantity(item);
		});
	} catch (error: any) {
		console.error("批量发货补货数据加载失败:", error);
		ElMessage.warning(error?.message || "补货库存明细加载失败，已使用当前页数据");
	} finally {
		restockingLoading.value = false;
	}
}

async function loadBoxPcsForItems(force = false, sourceItems: BatchShipItem[] = dialogItems.value) {
	const targets = sourceItems.filter((item) => {
		if (!resolveBoxPcsRequestParams(item)) return false;
		if (force) return true;
		return !item._cgBoxPcsLoaded && !item._cgBoxPcsLoading;
	});
	if (!targets.length) return;

	targets.forEach((item) => {
		item._cgBoxPcsLoading = true;
		item._cgBoxPcsError = "";
		if (!item._cgBoxPcsMessage) item._cgBoxPcsMessage = "查询中";
	});

	try {
		const res = await service.request({
			url: "/admin/app/analysis/getLocalProductBoxPcsBatch",
			method: "POST",
			data: {
				items: targets.map(buildBoxPcsPayloadItem)
			}
		});
		const resultMap = new Map(
			(res?.list || []).map((result: any) => [result.clientKey, result])
		);
		targets.forEach((item) => {
			const result = resultMap.get(getBoxPcsClientKey(item));
			applyBoxPcsResult(
				item,
				result || { success: false, message: "接口未返回该产品装箱数" }
			);
		});
	} catch (error: any) {
		targets.forEach((item) => {
			item._cgBoxPcsLoaded = true;
			item._cgBoxPcsError = error?.message || "装箱数查询失败";
			item._cgBoxPcsMessage = "";
		});
		ElMessage.warning(error?.message || "装箱数加载失败");
	} finally {
		targets.forEach((item) => {
			item._cgBoxPcsLoading = false;
		});
	}
}

async function loadCalendarDataForItems(sourceItems: BatchShipItem[] = dialogItems.value) {
	const targets = sourceItems.filter(
		(item) => item.asin && item.marketplace && !item._calendarData && !item._calendarDataLoading
	);
	if (!targets.length) return;

	calendarDataLoading.value = true;
	const { startMonth, endMonth } = getCalendarMonthRange();
	await Promise.all(
		targets.map(async (item) => {
			item._calendarDataLoading = true;
			try {
				const res = await service.request({
					url: "/admin/app/analysis/getCalendarData",
					method: "POST",
					data: {
						product_code: item.product_code || "",
						asin: item.asin,
						marketplace: item.marketplace,
						startMonth,
						endMonth,
						listing_id: item.listing_id,
						msku: item.msku,
						store_id: item.store_id
					}
				});
				item._calendarData = {
					base_month: res?.base_month || "",
					base_sales_value: res?.base_sales_value || 0,
					base_keyword_value: res?.base_keyword_value || 0,
					calendar: res?.calendar_data || {}
				};
				item.monthlyCoefficients = buildCalendarMonthlyCoefficients(item);
			} catch (error) {
				console.warn(`[批量发货日历系数] ${item.asin} 加载失败:`, error);
				item._calendarData = { calendar: {} };
				item.monthlyCoefficients = null;
			} finally {
				item._calendarDataLoading = false;
			}
		})
	);
	calendarDataLoading.value = false;
}

async function fetchBoxPcsForItem(item: BatchShipItem, force = false) {
	if (!force && item._cgBoxPcsLoading) return;
	await loadBoxPcsForItems(force, [item]);
}

function getBoxPcsClientKey(item: BatchShipItem) {
	return (
		item._batchId ||
		`${item.listing_id || "listing"}_${item.product_id || item.local_sku || item.msku || item.asin}`
	);
}

function resolveBoxPcsRequestParams(item: BatchShipItem) {
	if (item.product_id && Number(item.product_id) > 0) return { id: Number(item.product_id) };
	const localSku = String(item.local_sku || "").trim();
	if (localSku) return { sku: localSku };
	const msku = String(item.msku || "").trim();
	if (msku) return { sku: msku };
	return null;
}

function buildBoxPcsPayloadItem(item: BatchShipItem) {
	return {
		clientKey: getBoxPcsClientKey(item),
		listing_id: item.listing_id,
		product_id: item.product_id,
		local_sku: item.local_sku,
		msku: item.msku,
		asin: item.asin,
		marketplace: item.marketplace,
		store_id: item.store_id
	};
}

function applyBoxPcsResult(item: BatchShipItem, result: any) {
	item._cgBoxPcsLoaded = true;
	item._cgBoxPcsMessage = result?.message || "";
	item._cgBoxPcsError = result?.success === false ? result?.message || "装箱数查询失败" : "";
	const boxPcs = normalizeNullableNumber(result?.cg_box_pcs);
	if (boxPcs !== null) {
		item.cg_box_pcs = boxPcs;
		item._cgBoxPcsError = "";
	}
}

function getBoxPcsDisplay(item: BatchShipItem) {
	return item.cg_box_pcs === null || item.cg_box_pcs === undefined
		? "-"
		: formatNumber(item.cg_box_pcs);
}

function formatBoxPcsRequestParams(item: BatchShipItem) {
	const params = resolveBoxPcsRequestParams(item);
	return params ? JSON.stringify(params) : "缺少 product_id/local_sku/msku";
}

async function calculateItems(items: BatchShipItem[], silent = false) {
	if (!items.length) return;
	calculating.value = true;
	try {
		await Promise.all(items.map((item) => calculateItem(item)));
		if (!silent) ElMessage.success("已按目标库存完成推演");
	} finally {
		calculating.value = false;
	}
}

async function calculateItem(item: BatchShipItem) {
	applyEffectiveTargetStockDays(item);
	const segments = await calculateShippingSegmentsByBackend(item);
	applySegmentAllocation(item, segments);
}

function buildShippingDateSegments(item: BatchShipItem) {
	const methods = getActiveShippingMethods(item);
	const targetStart = dayjs(item.dateRange[0]).startOf("day");
	const targetEnd = dayjs(item.dateRange[1]).startOf("day");
	return methods
		.map((method, index) => {
			const arrival = dayjs()
				.startOf("day")
				.add(method.days + shippingBuffer.value, "day");
			const nextMethod = methods[index + 1];
			const nextArrival = nextMethod
				? dayjs()
						.startOf("day")
						.add(nextMethod.days + shippingBuffer.value, "day")
				: null;
			const start = arrival.isAfter(targetStart, "day") ? arrival : targetStart;
			const rawEnd = nextArrival ? nextArrival.subtract(1, "day") : targetEnd;
			const end = rawEnd.isBefore(targetEnd, "day") ? rawEnd : targetEnd;
			if (end.isBefore(start, "day")) return null;
			return {
				...method,
				startDate: start.format("YYYY-MM-DD"),
				endDate: end.format("YYYY-MM-DD"),
				days: end.diff(start, "day") + 1,
				enabled: true,
				segmentGap: 0,
				preArrivalGap: 0,
				systemGap: 0,
				expectedDemand: 0,
				suggestedQty: 0,
				remainingGap: 0,
				shortageStartDate: "",
				shortageEndDate: "",
				shortageDays: 0,
				shortageDemand: 0,
				shortageRanges: [],
				preArrivalShortage: null,
				inventoryUsage: null,
				monthlyCoefficients: null,
				warning: ""
			};
		})
		.filter(Boolean) as ShippingSegmentResult[];
}

async function calculateShippingSegmentsByBackend(item: BatchShipItem) {
	const segments = buildShippingDateSegments(item);
	item.monthlyCoefficients = null;

	if (!segments.length) {
		item.warning = "当前目标周期内没有可到达的运输方式";
		return [];
	}

	const algorithm = mapAlgoToInt(item.algo || globalAlgo.value);
	const coefficientRange = getCalendarMonthRange();

	const results = await Promise.all(
		segments.map(async (segment, index) => {
			try {
				const payloadItem = buildGapPayloadItem(item, segment.key, segment);
				const res = await (
					service.app as any
				).bsr_purchase_order_sync_lingxing.batchCalculateGap({
					algorithm,
					startDate: segment.startDate,
					endDate: segment.endDate,
					alpha: undefined,
					coefficientStartMonth: coefficientRange.startMonth,
					coefficientEndMonth: coefficientRange.endMonth,
					includeInventoryUsage: true,
					adjustPastInboundToFirstArrival: true,
					...buildPreArrivalShortageParams(index, item),
					items: [payloadItem]
				});
				const match = (Array.isArray(res) ? res : []).find(
					(row: any) => String(row?.id) === String(item._batchId)
				);
				return applyGapResultToSegment(segment, match);
			} catch (error: any) {
				return {
					...segment,
					warning: error?.message || "后端推演失败"
				};
			}
		})
	);

	const firstMonthly = results.find(
		(segment) => segment.monthlyCoefficients
	)?.monthlyCoefficients;
	item.monthlyCoefficients = firstMonthly || buildCalendarMonthlyCoefficients(item);
	item.warning = results.some((segment) => segment.warning)
		? "部分运输段推演失败，请查看运输方式卡片"
		: "";
	return results;
}

function buildGapPayloadItem(
	item: BatchShipItem,
	methodKey = "",
	segment?: ShippingSegmentResult | null
) {
	return {
		id: item._batchId,
		product_code: item.product_code || "",
		asin: item.asin || "",
		marketplace: item.marketplace || "",
		dailyAvgSales: getCalculationDailyAvgSales(item),
		volatility_coefficient: getCalculationVolatilityCoefficient(item),
		fbaValid: getFbaInventoryQuantityForGap(item),
		fbaShippingList: getFbaShippingListForGap(item),
		alpha: undefined,
		listing_id: item.listing_id,
		msku: item.msku || "",
		store_id: item.store_id,
		...getCoefficientOverrideRequestFields(item, methodKey, segment),
		...getItemPreArrivalRequestFields(item)
	};
}

function applyGapResultToSegment(
	segment: ShippingSegmentResult,
	match: any
): ShippingSegmentResult {
	if (!match) {
		return {
			...segment,
			warning: "后端未返回该产品推演结果"
		};
	}

	if (match.warning) {
		return {
			...segment,
			monthlyCoefficients: match.monthlyCoefficients || null,
			warning: String(match.warning)
		};
	}

	const preArrivalShortage = match.preArrivalShortage || null;
	const preArrivalGap = Math.max(0, Math.round(normalizeNumber(preArrivalShortage?.total)));
	const segmentGap = Math.max(0, Math.round(normalizeNumber(match.gap)));
	return {
		...segment,
		segmentGap,
		preArrivalGap,
		systemGap: segmentGap + preArrivalGap,
		expectedDemand: normalizeNumber(match.expectedDemand),
		shortageStartDate: match.shortageStartDate || "",
		shortageEndDate: match.shortageEndDate || "",
		shortageDays: normalizeNumber(match.shortageDays),
		shortageDemand: normalizeNumber(match.shortageDemand ?? match.gap),
		shortageRanges: Array.isArray(match.shortageRanges) ? match.shortageRanges : [],
		preArrivalShortage,
		inventoryUsage: match.inventoryUsage || null,
		monthlyCoefficients: match.monthlyCoefficients || null,
		warning: ""
	};
}

function applySegmentAllocation(item: BatchShipItem, segments: ShippingSegmentResult[]) {
	if (!segments.length) {
		item.totalDemand = 0;
		item.pureGap = 0;
		item.shipQty = 0;
		item.remainingGap = 0;
		item.shippingSegments = [];
		allocateItemOrderShipQty(item, 0);
		item.calculated = false;
		item.remark = item.warning || "当前目标周期内没有可到达的运输方式";
		return;
	}

	let remainingCanShip = Math.min(
		segments.reduce((sum, segment) => sum + normalizeNumber(segment.systemGap), 0),
		normalizeNumber(item.actual_shippable_qty)
	);
	segments.forEach((segment) => {
		const qty = Math.min(remainingCanShip, normalizeNumber(segment.systemGap));
		segment.suggestedQty = qty;
		segment.remainingGap = Math.max(0, normalizeNumber(segment.systemGap) - qty);
		remainingCanShip -= qty;
	});
	const nextManualShipQtyMap = buildNextManualShipQtyMap(item, segments);
	segments.forEach((segment) => {
		if (nextManualShipQtyMap[segment.key] === undefined) {
			nextManualShipQtyMap[segment.key] = normalizeNumber(segment.suggestedQty);
		}
	});
	item.manual_ship_qty_map = clampManualShipQtyMap(item, nextManualShipQtyMap);
	item.manual_ship_transfer_notice_map = {};
	item.manual_ship_edit_snapshot_map = {};
	item.totalDemand = segments.reduce(
		(sum, segment) => sum + normalizeNumber(segment.expectedDemand),
		0
	);
	item.pureGap = Math.max(
		0,
		segments.reduce((sum, segment) => sum + normalizeNumber(segment.systemGap), 0)
	);
	item.shipQty = getItemManualShipQty(item);
	item.remainingGap = Math.max(0, item.pureGap - item.shipQty);
	item.shippingSegments = segments;
	allocateItemOrderShipQty(item, item.shipQty);
	item.calculated = true;
	updateItemShipRemark(item);
}

function buildNextManualShipQtyMap(item: BatchShipItem, segments: ShippingSegmentResult[]) {
	const previousMap = { ...(item.manual_ship_qty_map || {}) };
	const lockedMap = item.manual_ship_locked_method_map || {};
	const previousSuggestionMap = new Map(
		(item.shippingSegments || []).map((segment) => [
			segment.key,
			normalizeNumber(segment.suggestedQty)
		])
	);
	const nextMap: Record<string, number> = {};

	segments.forEach((segment) => {
		const hadPrevious = Object.prototype.hasOwnProperty.call(previousMap, segment.key);
		const previousQty = normalizeNumber(previousMap[segment.key]);
		const previousSuggestion = normalizeNumber(previousSuggestionMap.get(segment.key));
		const wasManualAdjusted = hadPrevious && previousQty > 0 && previousQty !== previousSuggestion;
		nextMap[segment.key] =
			lockedMap[segment.key] || wasManualAdjusted
				? previousQty
				: normalizeNumber(segment.suggestedQty);
	});

	const segmentKeys = new Set(segments.map((segment) => segment.key));
	getActiveShippingMethods(item).forEach((method) => {
		if (segmentKeys.has(method.key)) return;
		const previousQty = normalizeNumber(previousMap[method.key]);
		if (lockedMap[method.key] || previousQty > 0) nextMap[method.key] = previousQty;
	});

	return nextMap;
}

function clampManualShipQtyMap(item: BatchShipItem, sourceMap: Record<string, number>) {
	const result: Record<string, number> = {};
	let remaining = normalizeNumber(item.actual_shippable_qty);
	const activeMethods = getActiveShippingMethods(item);
	const sortedMethods = [
		...activeMethods.filter((method) => isManualShipMethodLocked(item, method.key)),
		...activeMethods.filter((method) => !isManualShipMethodLocked(item, method.key))
	];
	sortedMethods.forEach((method) => {
		const qty = Math.max(0, Math.round(normalizeNumber(sourceMap[method.key])));
		const nextQty = Math.min(qty, remaining);
		if (nextQty > 0 || Object.prototype.hasOwnProperty.call(sourceMap, method.key)) {
			result[method.key] = nextQty;
		}
		remaining -= nextQty;
	});
	return result;
}

function updateItemShipRemark(item: BatchShipItem) {
	const failedSegments = item.shippingSegments.filter((segment) => segment.warning);
	item.remark =
		failedSegments.length > 0
			? `${failedSegments.length} 个运输段推演失败，请查看卡片原因`
			: item.remainingGap > 0
				? `本次发 ${formatNumber(item.shipQty)}，发完仍缺 ${formatNumber(item.remainingGap)}`
				: item.pureGap > 0
					? `本次发 ${formatNumber(item.shipQty)}，当前采购单可覆盖`
					: "库存覆盖目标周期，本次无需发货";
}

function getItemManualShipQty(item: BatchShipItem) {
	const activeKeys = new Set(getActiveShippingMethods(item).map((method) => method.key));
	return Object.entries(item.manual_ship_qty_map || {}).reduce((sum, [key, value]) => {
		return activeKeys.has(key) ? sum + normalizeNumber(value) : sum;
	}, 0);
}

function getSegmentManualShipQty(item: BatchShipItem, methodKey: string) {
	return normalizeNumber(item.manual_ship_qty_map?.[methodKey]);
}

function getActiveManualShipQtySnapshot(item: BatchShipItem) {
	const snapshot: Record<string, number> = {};
	getActiveShippingMethods(item).forEach((method) => {
		snapshot[method.key] = getSegmentManualShipQty(item, method.key);
	});
	return snapshot;
}

function captureSegmentManualShipEditSnapshot(item: BatchShipItem, methodKey: string) {
	item.manual_ship_edit_snapshot_map = {
		...(item.manual_ship_edit_snapshot_map || {}),
		[methodKey]: getActiveManualShipQtySnapshot(item)
	};
}

function isManualShipMethodLocked(item: BatchShipItem, methodKey: string) {
	return Boolean(item.manual_ship_locked_method_map?.[methodKey]);
}

function lockManualShipMethod(item: BatchShipItem, methodKey: string) {
	item.manual_ship_locked_method_map = {
		...(item.manual_ship_locked_method_map || {}),
		[methodKey]: true
	};
}

function unlockManualShipMethod(item: BatchShipItem, methodKey: string) {
	const nextMap = { ...(item.manual_ship_locked_method_map || {}) };
	delete nextMap[methodKey];
	item.manual_ship_locked_method_map = nextMap;
}

function getManualShipTransferCandidateMethods(
	item: BatchShipItem,
	currentMethodKey: string,
	qtyMap: Record<string, number>
) {
	return getActiveShippingMethods(item)
		.filter(
			(method) =>
				method.key !== currentMethodKey &&
				normalizeNumber(qtyMap[method.key]) > 0
		)
		.sort((a, b) => {
			const aLocked = isManualShipMethodLocked(item, a.key) ? 1 : 0;
			const bLocked = isManualShipMethodLocked(item, b.key) ? 1 : 0;
			if (aLocked !== bLocked) return aLocked - bLocked;
			const qtyDiff = normalizeNumber(qtyMap[b.key]) - normalizeNumber(qtyMap[a.key]);
			if (qtyDiff !== 0) return qtyDiff;
			return b.days - a.days;
		});
}

function getMethodLabel(methodKey: string) {
	return shippingMethods.find((method) => method.key === methodKey)?.label || methodKey;
}

function getShippingMethodInfo(methodKey: string) {
	return shippingMethods.find((method) => method.key === methodKey) || null;
}

function setManualShipTransferNotices(
	item: BatchShipItem,
	methodKey: string,
	baselineMap: Record<string, number>,
	nextMap: Record<string, number>
) {
	const notices: Record<string, ManualShipTransferNotice> = {};
	const deductions = getActiveShippingMethods(item)
		.filter((method) => method.key !== methodKey)
		.map((method) => ({
			key: method.key,
			label: method.label,
			qty: Math.max(
				0,
				normalizeNumber(baselineMap[method.key]) - normalizeNumber(nextMap[method.key])
			)
		}))
		.filter((row) => row.qty > 0);

	const totalDeducted = deductions.reduce((sum, row) => sum + row.qty, 0);
	if (totalDeducted <= 0) {
		item.manual_ship_transfer_notice_map = {};
		return { totalDeducted: 0, sourceText: "" };
	}

	const sourceText = deductions.map((row) => `${row.label}${formatNumber(row.qty)}件`).join("、");
	notices[methodKey] = {
		tone: "in",
		text: `手工锁定 · 已转入 ${formatNumber(totalDeducted)}`
	};
	deductions.forEach((row) => {
		notices[row.key] = {
			tone: "out",
			text: `自动扣减 ${formatNumber(row.qty)} → ${getMethodLabel(methodKey)}`
		};
	});
	item.manual_ship_transfer_notice_map = notices;
	return { totalDeducted, sourceText };
}

function getManualShipSegments(item: BatchShipItem) {
	const segmentMap = new Map(
		(item.shippingSegments || []).map((segment) => [segment.key, segment])
	);
	return getActiveShippingMethods(item)
		.map((method) => {
			const segment = segmentMap.get(method.key);
			return {
				...method,
				manualShipQty: getSegmentManualShipQty(item, method.key),
				systemSuggestQty: normalizeNumber(segment?.suggestedQty)
			};
		})
		.filter((segment) => segment.manualShipQty > 0);
}

function isSegmentShipQtyInputDisabled(segment: { shipQtyEditable: boolean }) {
	return calculating.value || dataSyncBlocking.value || !segment.shipQtyEditable;
}

function updateItemManualShipTotals(item: BatchShipItem) {
	item.shipQty = getItemManualShipQty(item);
	item.remainingGap = Math.max(0, normalizeNumber(item.pureGap) - normalizeNumber(item.shipQty));
	allocateItemOrderShipQty(item, item.shipQty);
	updateItemShipRemark(item);
}

function setSegmentManualShipQty(
	item: BatchShipItem,
	methodKey: string,
	value: any,
	showWarning = false
) {
	if (!getActiveShippingMethods(item).some((method) => method.key === methodKey)) {
		if (showWarning) ElMessage.warning("当前运输方式未启用，不能填写发货数量");
		return { totalDeducted: 0, sourceText: "", cappedQty: 0, requestedQty: 0 };
	}
	const baselineMap =
		item.manual_ship_edit_snapshot_map?.[methodKey] || getActiveManualShipQtySnapshot(item);
	const requested = Math.max(0, Math.round(normalizeNumber(value)));
	const actualCanShip = Math.max(0, normalizeNumber(item.actual_shippable_qty));
	const nextQtyMap = { ...baselineMap };
	if (requested <= 0) {
		delete nextQtyMap[methodKey];
		unlockManualShipMethod(item, methodKey);
		item.manual_ship_qty_map = clampManualShipQtyMap(item, nextQtyMap);
		item.manual_ship_transfer_notice_map = {};
		updateItemManualShipTotals(item);
		return { totalDeducted: 0, sourceText: "", cappedQty: 0, requestedQty: 0 };
	}
	nextQtyMap[methodKey] = Math.min(requested, actualCanShip);
	lockManualShipMethod(item, methodKey);

	let overflowQty =
		Object.values(nextQtyMap).reduce((sum, qty) => sum + normalizeNumber(qty), 0) -
		actualCanShip;
	for (const method of getManualShipTransferCandidateMethods(item, methodKey, nextQtyMap)) {
		if (overflowQty <= 0) break;
		const currentQty = normalizeNumber(nextQtyMap[method.key]);
		const deductedQty = Math.min(currentQty, overflowQty);
		nextQtyMap[method.key] = currentQty - deductedQty;
		overflowQty -= deductedQty;
	}

	if (overflowQty > 0) {
		nextQtyMap[methodKey] = Math.max(0, normalizeNumber(nextQtyMap[methodKey]) - overflowQty);
	}

	item.manual_ship_qty_map = nextQtyMap;
	const transferResult = setManualShipTransferNotices(item, methodKey, baselineMap, nextQtyMap);
	updateItemManualShipTotals(item);
	return {
		...transferResult,
		cappedQty: normalizeNumber(nextQtyMap[methodKey]),
		requestedQty: requested
	};
}

function handleSegmentManualShipQtyInput(item: BatchShipItem, methodKey: string, value: any) {
	setSegmentManualShipQty(item, methodKey, value, false);
}

function handleSegmentManualShipQtyChange(item: BatchShipItem, methodKey: string, value: any) {
	const result = setSegmentManualShipQty(item, methodKey, value, true);
	if (result.totalDeducted > 0) {
		ElMessage.info(
			`已从 ${result.sourceText} 自动扣减，转到 ${getMethodLabel(methodKey)}，总发货 ${formatNumber(item.shipQty)}/${formatNumber(item.actual_shippable_qty)}`
		);
	}
	if (result.requestedQty > result.cappedQty) {
		ElMessage.warning(
			`手工段已锁定，${getMethodLabel(methodKey)} 已按剩余可发 ${formatNumber(result.cappedQty)} 件保留`
		);
	}
	if (item.manual_ship_edit_snapshot_map?.[methodKey]) {
		const nextSnapshotMap = { ...item.manual_ship_edit_snapshot_map };
		delete nextSnapshotMap[methodKey];
		item.manual_ship_edit_snapshot_map = nextSnapshotMap;
	}
}

function allocateItemOrderShipQty(item: BatchShipItem, targetQty = item.shipQty) {
	let remaining = Math.max(
		0,
		Math.min(normalizeNumber(targetQty), normalizeNumber(item.actual_shippable_qty))
	);
	item.shipQty = remaining;
	item.shippableOrders.forEach((order) => {
		const qty = Math.min(remaining, normalizeNumber(order.actual_shippable_qty));
		order.ship_qty = qty;
		remaining -= qty;
	});
}

function handleOrderShipQtyChange(item: BatchShipItem) {
	item.shippableOrders.forEach((order) => {
		order.ship_qty = Math.max(
			0,
			Math.min(normalizeNumber(order.ship_qty), normalizeNumber(order.actual_shippable_qty))
		);
	});
	item.shipQty = item.shippableOrders.reduce(
		(sum, order) => sum + normalizeNumber(order.ship_qty),
		0
	);
	item.remainingGap = Math.max(0, normalizeNumber(item.pureGap) - normalizeNumber(item.shipQty));
}

function buildMethodOrderAllocationMap(item: BatchShipItem) {
	const allocationMap = new Map<string, ShippableOrderDetail[]>();
	const orderPool = item.shippableOrders.map((order) => ({
		order,
		remaining: normalizeNumber(order.actual_shippable_qty)
	}));

	getManualShipSegments(item).forEach((segment) => {
		let remaining = normalizeNumber(segment.manualShipQty);
		const details: ShippableOrderDetail[] = [];
		for (const poolItem of orderPool) {
			if (remaining <= 0) break;
			if (poolItem.remaining <= 0) continue;
			const qty = Math.min(remaining, poolItem.remaining);
			details.push({
				...poolItem.order,
				linked_plan_sns: [...poolItem.order.linked_plan_sns],
				linked_analysis_record_ids: [...poolItem.order.linked_analysis_record_ids],
				ship_qty: qty
			});
			poolItem.remaining -= qty;
			remaining -= qty;
		}
		allocationMap.set(segment.key, details);
	});

	return allocationMap;
}

function getShippingSegmentInventoryMetric(segment: any, keys: string[]) {
	const sources = [
		segment,
		segment?.inventoryUsage,
		segment?.inventory_usage,
		segment?.inventoryUsage?.summary,
		segment?.inventory_usage?.summary
	];
	for (const source of sources) {
		if (!source || typeof source !== "object") continue;
		for (const key of keys) {
			const value = normalizeNullableNumber(source[key]);
			if (value !== null) return value;
		}
	}
	return 0;
}

function buildTempRecordForSegment(
	item: BatchShipItem,
	segment: ReturnType<typeof getManualShipSegments>[number],
	orderDetails: ShippableOrderDetail[]
): TempSaveRecord {
	const itemKey = getItemKey(item);
	const calculatedSegment = item.shippingSegments.find(
		(itemSegment) => itemSegment.key === segment.key
	);
	const dateRange = calculatedSegment
		? [calculatedSegment.startDate, calculatedSegment.endDate]
		: item.dateRange;
	const shipQty = normalizeNumber(segment.manualShipQty);
	const systemSuggestQty = normalizeNumber(segment.systemSuggestQty);
	const record: TempSaveRecord = {
		id: `${itemKey}_${segment.key}`,
		itemKey,
		asin: item.asin,
		marketplace: item.marketplace,
		msku: item.msku,
		fnsku: item.fnsku,
		storeId: item.store_id,
		productCode: item.product_code,
		listingId: item.listing_id,
		productName: item.product_name,
		productImg: item.image_url_display,
		shippingMethod: segment.key,
		shippingLabel: segment.label,
		shippingIcon: segment.icon,
		shippingColor: segment.color || "#909399",
		dateRange,
		algoLabel: getAlgoLabel(item.algo || globalAlgo.value),
		shipQty,
		systemSuggestQty,
		manualAdjusted: shipQty !== systemSuggestQty,
		orderDetails: cloneOrderDetails(orderDetails)
	};
	return record;
}

function upsertTempSaveRecord(record: TempSaveRecord) {
	if (!tempSaveRecords[record.itemKey]) tempSaveRecords[record.itemKey] = [];
	const records = tempSaveRecords[record.itemKey];
	const index = records.findIndex((item) => item.shippingMethod === record.shippingMethod);
	if (index >= 0) {
		records.splice(index, 1, record);
		return true;
	}
	records.push(record);
	return false;
}

function replaceItemTempSaveRecords(item: BatchShipItem, records: TempSaveRecord[]) {
	const itemKey = getItemKey(item);
	const previousRecords = tempSaveRecords[itemKey] || [];
	const previousMethodKeys = new Set(previousRecords.map((record) => record.shippingMethod));
	const nextMethodKeys = new Set(records.map((record) => record.shippingMethod));
	const updated = records.filter((record) =>
		previousMethodKeys.has(record.shippingMethod)
	).length;
	const created = records.length - updated;
	const deleted = previousRecords.filter(
		(record) => !nextMethodKeys.has(record.shippingMethod)
	).length;

	if (records.length > 0) {
		tempSaveRecords[itemKey] = records;
	} else if (previousRecords.length > 0) {
		delete tempSaveRecords[itemKey];
	}

	return { created, updated, deleted };
}

function deleteSegmentTempSaveRecord(item: BatchShipItem, methodKey: string) {
	const itemKey = getItemKey(item);
	const records = tempSaveRecords[itemKey] || [];
	const nextRecords = records.filter((record) => record.shippingMethod !== methodKey);
	const deleted = records.length - nextRecords.length;
	if (deleted <= 0) return 0;
	if (nextRecords.length > 0) tempSaveRecords[itemKey] = nextRecords;
	else delete tempSaveRecords[itemKey];
	return deleted;
}

function saveTempRecord(item: BatchShipItem, methodKey?: string, silent = false) {
	const segments = getManualShipSegments(item).filter(
		(segment) => !methodKey || segment.key === methodKey
	);
	if (!segments.length) {
		const deleted = methodKey
			? deleteSegmentTempSaveRecord(item, methodKey)
			: replaceItemTempSaveRecords(item, []).deleted;
		if (!silent) {
			if (deleted > 0) {
				ElMessage.success(
					methodKey
						? "本段发货数量为 0，已删除旧暂存"
						: `当前产品无发货数量，已删除 ${deleted} 条旧暂存`
				);
			} else {
				ElMessage.warning(
					methodKey ? "当前运输方式没有填写发货数量" : "当前产品没有填写发货数量"
				);
			}
		}
		return { created: 0, updated: 0, deleted, records: [] } as SegmentTempSaveResult;
	}

	const allocationMap = buildMethodOrderAllocationMap(item);
	const records = segments.map((segment) =>
		buildTempRecordForSegment(item, segment, allocationMap.get(segment.key) || [])
	);
	const result: SegmentTempSaveResult = { created: 0, updated: 0, deleted: 0, records };

	if (methodKey) {
		records.forEach((record) => {
			const updated = upsertTempSaveRecord(record);
			if (updated) result.updated += 1;
			else result.created += 1;
		});
	} else {
		const replaceResult = replaceItemTempSaveRecords(item, records);
		result.created = replaceResult.created;
		result.updated = replaceResult.updated;
		result.deleted = replaceResult.deleted;
	}

	const totalQty = result.records.reduce(
		(sum, record) => sum + normalizeNumber(record.shipQty),
		0
	);
	const actionText = methodKey ? "本段" : "本品";
	const overwriteText = result.updated > 0 ? `，覆盖 ${result.updated} 条旧暂存` : "";
	const deletedText = result.deleted > 0 ? `，删除 ${result.deleted} 条旧暂存` : "";
	if (!silent) {
		ElMessage.success(
			`${actionText}已暂存 ${result.records.length} 个运输方式，共 ${formatNumber(totalQty)} 件${overwriteText}${deletedText}`
		);
	}
	return result;
}

function saveAllTempRecords() {
	const targets = dialogItems.value.filter(
		(item) => canSaveTempRecord(item) || (tempSaveRecords[getItemKey(item)] || []).length > 0
	);
	if (!targets.length) {
		ElMessage.warning("当前没有可暂存的发货数量");
		return;
	}
	const total = targets.reduce(
		(summary, item) => {
			const result = saveTempRecord(item, undefined, true);
			summary.created += result.created;
			summary.updated += result.updated;
			summary.deleted += result.deleted;
			summary.records += result.records.length;
			summary.qty += result.records.reduce(
				(sum, record) => sum + normalizeNumber(record.shipQty),
				0
			);
			return summary;
		},
		{ created: 0, updated: 0, deleted: 0, records: 0, qty: 0 }
	);
	const syncText =
		total.records > 0
			? `已暂存 ${total.records} 个运输方式，共 ${formatNumber(total.qty)} 件`
			: "已同步清空当前产品暂存";
	ElMessage.success(
		`${syncText}${total.updated > 0 ? `，覆盖 ${total.updated} 条旧暂存` : ""}${total.deleted > 0 ? `，删除 ${total.deleted} 条旧暂存` : ""}`
	);
}

function openTempDrawer(item?: BatchShipItem) {
	tempSaveDrawerFilterKey.value = item ? getItemKey(item) : null;
	tempSaveDrawerVisible.value = true;
}

function clearCurrentTempRecords() {
	if (tempSaveDrawerFilterKey.value) {
		delete tempSaveRecords[tempSaveDrawerFilterKey.value];
		return;
	}
	clearTempRecords();
}

function getItemTempSaveQty(item: BatchShipItem) {
	return (tempSaveRecords[getItemKey(item)] || []).reduce(
		(sum, record) => sum + normalizeNumber(record.shipQty),
		0
	);
}

function getItemTempSaveSyncIssue(item: BatchShipItem): TempSaveSyncIssue {
	const currentSegments = getManualShipSegments(item);
	const currentMethodKeys = new Set(currentSegments.map((segment) => segment.key));
	const records = tempSaveRecords[getItemKey(item)] || [];
	const recordMap = new Map(records.map((record) => [record.shippingMethod, record]));
	let missing = 0;
	let changed = 0;

	currentSegments.forEach((segment) => {
		const record = recordMap.get(segment.key);
		if (!record) {
			missing += 1;
			return;
		}
		if (normalizeNumber(record.shipQty) !== normalizeNumber(segment.manualShipQty)) {
			changed += 1;
		}
	});

	const stale = records.filter(
		(record) =>
			!currentMethodKeys.has(record.shippingMethod) || normalizeNumber(record.shipQty) <= 0
	).length;
	return {
		missing,
		changed,
		stale,
		total: missing + changed + stale
	};
}

function getTempSaveSyncIssueSummary() {
	return dialogItems.value.reduce(
		(summary, item) => {
			const issue = getItemTempSaveSyncIssue(item);
			if (issue.total <= 0) return summary;
			summary.productCount += 1;
			summary.missing += issue.missing;
			summary.changed += issue.changed;
			summary.stale += issue.stale;
			summary.total += issue.total;
			return summary;
		},
		{ productCount: 0, missing: 0, changed: 0, stale: 0, total: 0 }
	);
}

function getSegmentTempRecord(item: BatchShipItem, methodKey: string) {
	return (
		(tempSaveRecords[getItemKey(item)] || []).find(
			(record) => record.shippingMethod === methodKey
		) || null
	);
}

function canSaveSegmentTempRecord(item: BatchShipItem, methodKey: string) {
	return (
		item.calculated &&
		getActiveShippingMethods(item).some((method) => method.key === methodKey) &&
		getSegmentManualShipQty(item, methodKey) > 0
	);
}

function canSaveTempRecord(item: BatchShipItem) {
	return item.calculated && getManualShipSegments(item).length > 0;
}

function getCanSaveItemCount() {
	return dialogItems.value.filter((item) => canSaveTempRecord(item)).length;
}

function getCanSaveSegmentCount() {
	return dialogItems.value.reduce((sum, item) => sum + getManualShipSegments(item).length, 0);
}

function getItemSaveSummaryText(item: BatchShipItem) {
	const issue = getItemTempSaveSyncIssue(item);
	if (issue.total > 0) return `暂存未同步 ${issue.total} 段`;
	const count = getItemSaveCount(item);
	const qty = getItemTempSaveQty(item);
	return count > 0 ? `已暂存 ${count} 段 / ${formatNumber(qty)} 件` : "暂无暂存";
}

function getItemManualSummaryText(item: BatchShipItem) {
	return `本次填写 ${formatNumber(getItemManualShipQty(item))} / 实际可发 ${formatNumber(item.actual_shippable_qty)}`;
}

function getItemManualPoolSummaryText(item: BatchShipItem) {
	const methods = getActiveShippingMethods(item);
	const manualQty = methods.reduce((sum, method) => {
		return isManualShipMethodLocked(item, method.key)
			? sum + getSegmentManualShipQty(item, method.key)
			: sum;
	}, 0);
	const systemQty = Math.max(0, getItemManualShipQty(item) - manualQty);
	if (manualQty <= 0) return `系统分配 ${formatNumber(systemQty)}`;
	return `手工 ${formatNumber(manualQty)} · 系统 ${formatNumber(systemQty)}`;
}

function getItemSuggestedQty(item: BatchShipItem) {
	return item.shippingSegments.reduce(
		(sum, segment) => sum + normalizeNumber(segment.suggestedQty),
		0
	);
}

function getItemManualDeltaText(item: BatchShipItem) {
	const delta = getItemManualShipQty(item) - getItemSuggestedQty(item);
	if (delta > 0) return `高于系统建议 ${formatNumber(delta)}`;
	if (delta < 0) return `低于系统建议 ${formatNumber(Math.abs(delta))}`;
	return "与系统建议一致";
}

function deleteTempRecord(itemKey: string, recordId: string) {
	const records = tempSaveRecords[itemKey] || [];
	tempSaveRecords[itemKey] = records.filter((record) => record.id !== recordId);
	if (!tempSaveRecords[itemKey].length) delete tempSaveRecords[itemKey];
}

function clearTempRecords() {
	Object.keys(tempSaveRecords).forEach((key) => delete tempSaveRecords[key]);
}

function ensureBatchValues(methodKey: string) {
	if (!batchValues[methodKey]) {
		batchValues[methodKey] = {
			warehouse: "",
			packageType: "",
			planShipDate: "",
			batchRemark: ""
		};
	}
	return batchValues[methodKey];
}

function initializeShipPlanBatchValues() {
	Object.keys(batchValues).forEach((key) => delete batchValues[key]);
	Object.keys(groupedPlanRecords.value).forEach((methodKey) => ensureBatchValues(methodKey));
}

function getShipPlanRecordExpandedKey(methodKey: string, record: ShipPlanRecord) {
	return `${methodKey}:${record.id}`;
}

function initializeShipPlanRecordExpandedState() {
	Object.keys(shipPlanRecordExpandedMap).forEach((key) => delete shipPlanRecordExpandedMap[key]);
	Object.entries(groupedPlanRecords.value).forEach(([methodKey, group]) => {
		group.records.forEach((record, index) => {
			shipPlanRecordExpandedMap[getShipPlanRecordExpandedKey(methodKey, record)] =
				index === 0;
		});
	});
}

function isShipPlanRecordExpanded(methodKey: string, record: ShipPlanRecord) {
	return shipPlanRecordExpandedMap[getShipPlanRecordExpandedKey(methodKey, record)] ?? false;
}

function toggleShipPlanRecordExpanded(methodKey: string, record: ShipPlanRecord) {
	const key = getShipPlanRecordExpandedKey(methodKey, record);
	shipPlanRecordExpandedMap[key] = !isShipPlanRecordExpanded(methodKey, record);
}

function isShipPlanRecordConfigured(record: ShipPlanRecord) {
	return Boolean(record.warehouse && record.packageType && record.planShipDate);
}

function batchSetPlanField(methodKey: string, field: string, value: any) {
	ensureBatchValues(methodKey)[field] = value;
	const records = groupedPlanRecords.value[methodKey]?.records || [];
	records.forEach((record) => {
		(record as any)[field] = value ?? "";
	});
}

function getGroupShipQty(records: ShipPlanRecord[]) {
	return records.reduce((sum, record) => sum + normalizeNumber(record.shipQty), 0);
}

function getGroupOrderCount(records: ShipPlanRecord[]) {
	return records.reduce((sum, record) => sum + record.orderDetails.length, 0);
}

function getOrderDetailsShipQty(orderDetails: ShippableOrderDetail[]) {
	return orderDetails.reduce((sum, order) => sum + normalizeNumber(order.ship_qty), 0);
}

function getFinalConfirmExpandedKey(methodKey: string, record: ShipPlanRecord) {
	return `${methodKey}:${record.id}`;
}

function initializeFinalConfirmExpandedState() {
	Object.keys(finalConfirmExpandedMap).forEach((key) => delete finalConfirmExpandedMap[key]);
	finalConfirmMethodGroups.value.forEach((group) => {
		if (group.records.length !== 1) return;
		const record = group.records[0];
		finalConfirmExpandedMap[getFinalConfirmExpandedKey(group.methodKey, record)] = true;
	});
}

function getFinalConfirmRowExpanded(methodKey: string, record: ShipPlanRecord) {
	return finalConfirmExpandedMap[getFinalConfirmExpandedKey(methodKey, record)] ?? false;
}

function getFinalConfirmExpandedRowKeys(methodKey: string) {
	const records = groupedPlanRecords.value[methodKey]?.records || [];
	return records
		.filter((record) => getFinalConfirmRowExpanded(methodKey, record))
		.map((record) => record.id);
}

function toggleFinalConfirmRowExpanded(methodKey: string, record: ShipPlanRecord) {
	const key = getFinalConfirmExpandedKey(methodKey, record);
	finalConfirmExpandedMap[key] = !getFinalConfirmRowExpanded(methodKey, record);
}

function handleFinalConfirmExpandChange(
	methodKey: string,
	record: ShipPlanRecord,
	expandedRows: ShipPlanRecord[]
) {
	const expandedIds = new Set(expandedRows.map((row) => row.id));
	const records = groupedPlanRecords.value[methodKey]?.records || [];
	records.forEach((row) => {
		finalConfirmExpandedMap[getFinalConfirmExpandedKey(methodKey, row)] = expandedIds.has(
			row.id
		);
	});
}

function getWarehouseName(value: any) {
	if (value === "" || value === null || value === undefined) return "-";
	return (
		allWarehouseOptions.value.find((item) => String(item.wid) === String(value))?.name ||
		String(value)
	);
}

function disabledShipDate(date: Date) {
	return dayjs(date).isBefore(dayjs().startOf("day"));
}

async function loadWarehouseList() {
	if (allWarehouseOptions.value.length || warehouseLoading.value) return;
	warehouseLoading.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/bsr_purchase_order_sync_lingxing/getWarehouseList",
			method: "POST",
			data: {}
		});
		warehouseList.value = {
			local: Array.isArray(res?.local) ? res.local : [],
			overseas: Array.isArray(res?.overseas) ? res.overseas : [],
			awd: Array.isArray(res?.awd) ? res.awd : []
		};
	} catch (error: any) {
		ElMessage.error(error?.message || "发货仓库加载失败");
	} finally {
		warehouseLoading.value = false;
	}
}

function validateShipPlanConfig() {
	const missing = shipPlanDialog.records.find(
		(record) => !record.warehouse || !record.packageType || !record.planShipDate
	);
	if (missing) {
		ElMessage.warning("请补全发货仓库、包装类型和发货时间");
		return false;
	}
	const emptyOrderRecord = shipPlanDialog.records.find(
		(record) => !record.orderDetails.some((order) => normalizeNumber(order.ship_qty) > 0)
	);
	if (emptyOrderRecord) {
		ElMessage.warning(
			`${emptyOrderRecord.productName || emptyOrderRecord.msku || "产品"} 缺少采购单发货明细`
		);
		return false;
	}
	return true;
}

function buildShipPlanSubmitPayloadFromRecords(records: ShipPlanRecord[]) {
	return {
		client_submit_token: ensureShipPlanSubmitToken(),
		planned_snapshot: {
			tempSaveSummary: tempSaveSummary.value,
			createdAt: dayjs().format("YYYY-MM-DD HH:mm:ss")
		},
		records: records.map((record) => ({
			itemKey: record.itemKey,
			row_key: (record as any).row_key || (record as any).rowKey || "",
			asin: record.asin,
			marketplace: record.marketplace,
			msku: record.msku,
			fnsku: record.fnsku,
			storeId: record.storeId,
			productName: record.productName,
			productImg: record.productImg,
			productCode: record.productCode,
			listingId: record.listingId,
			shippingMethod: record.shippingMethod,
			shippingLabel: record.shippingLabel,
			shipQty: record.shipQty,
			systemSuggestQty: record.systemSuggestQty,
			manualAdjusted: record.manualAdjusted,
			warehouse: record.warehouse,
			warehouseName: getWarehouseName(record.warehouse),
			packageType: record.packageType,
			planShipDate: record.planShipDate,
			remark: record.remark,
			batchRemark: ensureBatchValues(record.shippingMethod).batchRemark,
			algoLabel: record.algoLabel,
			dateRange: record.dateRange,
			orderDetails: record.orderDetails.filter((order) => normalizeNumber(order.ship_qty) > 0)
		}))
	};
}

function buildShipPlanSubmitPayload() {
	return buildShipPlanSubmitPayloadFromRecords(shipPlanDialog.records);
}

function buildReviewShipPlanRecords(requireConfigured: boolean) {
	const sourceRecords =
		shipPlanDialog.records.length > 0
			? shipPlanDialog.records
			: flatTempSaveRecords.value.map((record) => ({
					...record,
					warehouse: "",
					packageType: "",
					planShipDate: "",
					remark: ""
				}));

	if (!requireConfigured) return sourceRecords;
	return sourceRecords.filter(
		(record) => record.warehouse && record.packageType && record.planShipDate
	);
}

function buildBatchShipReviewRequest(requireConfigured: boolean) {
	const records = buildReviewShipPlanRecords(requireConfigured);
	const submitPayload = buildShipPlanSubmitPayloadFromRecords(records);
	return {
		review_no: batchShipReviewNo.value || undefined,
		source_page: {
			page: "bsr_purchase_plan_product_view",
			component: "PurchasePlanProductBatchShipDialog",
			path: window.location.hash || window.location.pathname,
			selectedCount: props.items?.length || 0,
			capturedAt: dayjs().format("YYYY-MM-DD HH:mm:ss")
		},
		input_snapshot: {
			items: clonePlain(props.items || []),
			dataSyncState: clonePlain(props.dataSyncState || null),
			capturedAt: dayjs().format("YYYY-MM-DD HH:mm:ss")
		},
		workbench_snapshot: buildBatchShipWorkbenchSnapshot(records),
		submit_payload: submitPayload,
		ui_state: buildBatchShipReviewUiState(),
		remark: batchShipReviewNo.value ? `修改审核单 ${batchShipReviewNo.value}` : ""
	};
}

function buildBatchShipWorkbenchSnapshot(records: ShipPlanRecord[]) {
	return {
		reviewNo: batchShipReviewNo.value,
		capturedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
		dialogItems: clonePlain(dialogItems.value),
		shippingBuffer: shippingBuffer.value,
		globalDefaultTargetDays: globalDefaultTargetDays.value,
		targetDaysAutoSynced: targetDaysAutoSynced.value,
		targetPeriodMode: targetPeriodMode.value,
		globalAlgo: globalAlgo.value,
		globalShippingProfile: globalShippingProfile.value,
		globalSelectedShippingMethods: clonePlain(globalSelectedShippingMethods.value),
		shippingMethods: clonePlain(shippingMethods),
		tempSaveRecords: clonePlain(tempSaveRecords),
		tempSaveSummary: clonePlain(tempSaveSummary.value),
		manualShipSummary: clonePlain(manualShipSummary.value),
		shipPlanDialog: {
			visible: shipPlanDialog.visible,
			records: clonePlain(records)
		},
		batchValues: clonePlain(batchValues),
		warehouseList: clonePlain(warehouseList.value),
		shipPlanActiveCollapse: shipPlanActiveCollapse.value,
		shipPlanRecordExpandedMap: clonePlain(shipPlanRecordExpandedMap),
		finalConfirmExpandedMap: clonePlain(finalConfirmExpandedMap),
		finalConfirmDialog: clonePlain(finalConfirmDialog),
		shipPlanSubmitToken: shipPlanSubmitToken.value
	};
}

function buildBatchShipReviewUiState() {
	return {
		activeStep: finalConfirmDialog.visible
			? "final_confirm"
			: shipPlanDialog.visible
				? "ship_plan_form"
				: "analysis",
		tempSaveDrawerVisible: tempSaveDrawerVisible.value,
		tempSaveDrawerFilterKey: tempSaveDrawerFilterKey.value,
		replenishTraceDrawer: clonePlain(replenishTraceDrawer),
		shipHistoryDrawer: clonePlain(shipHistoryDrawer),
		shipHistoryActiveBatches: clonePlain(shipHistoryActiveBatches.value),
		shipPlanActiveCollapse: shipPlanActiveCollapse.value,
		shipPlanRecordExpandedMap: clonePlain(shipPlanRecordExpandedMap),
		finalConfirmExpandedMap: clonePlain(finalConfirmExpandedMap)
	};
}

function ensureShipPlanSubmitToken() {
	if (!shipPlanSubmitToken.value) {
		shipPlanSubmitToken.value = `batch_ship_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
	}
	return shipPlanSubmitToken.value;
}

async function handleNextStep() {
	if (hasCreatedShipPlanResult()) {
		finalConfirmDialog.visible = true;
		ElMessage.warning("本批已有创建成功项，请在提交结果中处理，避免重复提交");
		return;
	}

	const syncIssue = getTempSaveSyncIssueSummary();
	if (syncIssue.total > 0) {
		ElMessage.warning(
			`当前填写和暂存不一致：${syncIssue.productCount} 个产品 ${syncIssue.total} 段未同步，请先点击“一键暂存全部填写”`
		);
		return;
	}
	shipPlanDialog.records = flatTempSaveRecords.value.map((record) => ({
		...record,
		orderDetails: cloneOrderDetails(record.orderDetails),
		warehouse: "",
		packageType: "",
		planShipDate: "",
		remark: ""
	}));
	initializeShipPlanBatchValues();
	initializeShipPlanRecordExpandedState();
	shipPlanActiveCollapse.value = Object.keys(groupedPlanRecords.value)[0] || "";
	shipPlanSubmitResult.value = null;
	shipPlanSubmitToken.value = "";
	finalConfirmDialog.visible = false;
	shipPlanDialog.visible = true;
	await loadWarehouseList();
}

function finishShipPlanConfig() {
	if (!validateShipPlanConfig()) return;
	shipPlanSubmitResult.value = null;
	initializeFinalConfirmExpandedState();
	finalConfirmDialog.visible = true;
}

async function reviewRequest(action: string, data: any) {
	return service.request({
		url: `/admin/app/bsr_batch_ship_review/${action}`,
		method: "POST",
		data
	});
}

async function saveBatchShipReviewDraft() {
	if (!shipPlanDialog.records.length) {
		ElMessage.warning("请先进入下一步并完成发货单据配置");
		return;
	}
	if (!validateShipPlanConfig()) return;
	savingBatchShipReview.value = true;
	try {
		const res = await reviewRequest("saveDraft", buildBatchShipReviewRequest(true));
		batchShipReviewNo.value =
			res?.review_no || res?.review?.review_no || batchShipReviewNo.value;
		emit("saved-review", res);
		ElMessage.success(
			`批量发货审核草稿已保存${batchShipReviewNo.value ? `：${batchShipReviewNo.value}` : ""}`
		);
	} catch (error: any) {
		ElMessage.error(error?.message || "保存审核草稿失败");
	} finally {
		savingBatchShipReview.value = false;
	}
}

async function submitBatchShipReviewForReview() {
	if (!shipPlanDialog.records.length) {
		ElMessage.warning("请先进入下一步并完成发货单据配置");
		return;
	}
	if (!validateShipPlanConfig()) return;
	savingBatchShipReview.value = true;
	try {
		const res = await reviewRequest("submitForReview", buildBatchShipReviewRequest(true));
		batchShipReviewNo.value =
			res?.review_no || res?.review?.review_no || batchShipReviewNo.value;
		emit("saved-review", res);
		ElMessage.success(
			`已提交批量发货审核${batchShipReviewNo.value ? `：${batchShipReviewNo.value}` : ""}`
		);
		finalConfirmDialog.visible = false;
		shipPlanDialog.visible = false;
		dialogVisible.value = false;
	} catch (error: any) {
		ElMessage.error(error?.message || "提交批量发货审核失败");
	} finally {
		savingBatchShipReview.value = false;
	}
}

async function submitBatchShipPlan() {
	if (!validateShipPlanConfig()) return;
	submittingShipPlan.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/bsr_batch_ship/submit",
			method: "POST",
			data: buildShipPlanSubmitPayload()
		});
		shipPlanSubmitResult.value = res;
		void loadProductShipHistoriesForItems(dialogItems.value, true);
		if (res?.batch?.status === "success") {
			ElMessage.success("批量发货计划已全部创建成功");
		} else if (res?.batch?.status === "partial_failed") {
			ElMessage.warning("批量发货计划部分创建成功，请查看失败项");
		} else {
			ElMessage.error("批量发货计划创建失败");
		}
	} catch (error: any) {
		ElMessage.error(error?.message || "批量发货计划提交失败");
	} finally {
		submittingShipPlan.value = false;
	}
}

async function retryFailedBatchShipPlan() {
	const batchNo = shipPlanSubmitResult.value?.batch_no;
	if (!batchNo) {
		ElMessage.warning("缺少批量发货批次号，无法重试");
		return;
	}
	retryingShipPlanFailed.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/bsr_batch_ship/retryFailed",
			method: "POST",
			data: {
				batch_no: batchNo
			}
		});
		shipPlanSubmitResult.value = res;
		void loadProductShipHistoriesForItems(dialogItems.value, true);
		if (res?.failed_items?.length) {
			ElMessage.warning("失败项已重试，仍有未完成项");
		} else {
			ElMessage.success("失败项已重试成功");
		}
	} catch (error: any) {
		ElMessage.error(error?.message || "失败项重试失败");
	} finally {
		retryingShipPlanFailed.value = false;
	}
}

function getBatchShipSubmitStatusMeta(status: any) {
	const normalizedStatus = String(status || "");
	const localSyncFailedQty = getBatchShipLocalSyncFailedQty();
	const map: Record<
		string,
		{ text: string; type: "success" | "warning" | "danger" | "info"; description: string }
	> = {
		submitting: {
			text: "提交中",
			type: "info",
			description: "正在创建领星发货计划，请稍候。"
		},
		success: {
			text: "全部创建成功",
			type: "success",
			description: "本批次发货计划均已成功创建。"
		},
		partial_failed: {
			text: "部分创建成功",
			type: "warning",
			description: "成功项已保存，失败项可以单独重试。"
		},
		failed: {
			text: "创建失败",
			type: "danger",
			description: "本批次尚未创建成功，请检查失败原因后重试。"
		}
	};

	if (localSyncFailedQty > 0) {
		if (normalizedStatus === "success") {
			return {
				text: "同步异常",
				type: "warning" as const,
				description: "领星发货计划已创建，但本地发货计划同步存在异常，请核对后再结束流程。"
			};
		}
		if (normalizedStatus === "partial_failed") {
			return {
				text: "部分成功/同步异常",
				type: "warning" as const,
				description:
					"成功项已保存，失败项可重试；本地同步异常项需要核对领星批次和本地发货计划。"
			};
		}
	}

	return (
		map[normalizedStatus] || {
			text: normalizedStatus || "状态未知",
			type: "info" as const,
			description: "批次结果已保存，请核对提交明细。"
		}
	);
}

function getBatchShipSubmitTotalQty(
	field: "planned_total_qty" | "success_total_qty" | "failed_total_qty"
) {
	const batchValue = normalizeNullableNumber(shipPlanSubmitResult.value?.batch?.[field]);
	if (batchValue !== null) return batchValue;
	const summaryField = field.replace("_total_qty", "_qty");
	return (shipPlanSubmitResult.value?.warehouse_summary || []).reduce(
		(sum: number, method: any) => sum + normalizeNumber(method?.[summaryField]),
		0
	);
}

function hasCreatedShipPlanResult() {
	return Boolean(
		shipPlanSubmitResult.value?.batch_no && getBatchShipSubmitTotalQty("success_total_qty") > 0
	);
}

function getBatchShipSubmitSeqCount() {
	const seqs = new Set<string>();
	(shipPlanSubmitResult.value?.warehouse_summary || []).forEach((method: any) => {
		(method?.seqs || []).forEach((seq: any) => {
			const text = String(seq || "").trim();
			if (text) seqs.add(text);
		});
	});
	return seqs.size;
}

function getBatchShipLocalSyncFailedItems() {
	return Array.isArray(shipPlanSubmitResult.value?.local_sync_failed_items)
		? shipPlanSubmitResult.value.local_sync_failed_items
		: [];
}

function getBatchShipLocalSyncFailedCount() {
	return getBatchShipLocalSyncFailedItems().length;
}

function getBatchShipLocalSyncFailedQty() {
	return getBatchShipLocalSyncFailedItems().reduce(
		(sum: number, item: any) => sum + normalizeNumber(item?.ship_qty),
		0
	);
}

function getBatchShipSuccessfulMethods() {
	return (shipPlanSubmitResult.value?.warehouse_summary || []).filter(
		(method: any) => normalizeNumber(method?.success_qty) > 0
	);
}

function getSuccessfulWarehouseExecutionGroups(method: any) {
	return (method?.execution_groups || []).filter(
		(group: any) => normalizeNumber(group?.success_qty) > 0
	);
}

function getBatchShipSuccessfulExecutionGroupCount() {
	return getBatchShipSuccessfulMethods().reduce(
		(sum: number, method: any) => sum + getSuccessfulWarehouseExecutionGroups(method).length,
		0
	);
}

function getSuccessfulWarehouseProducts(group: any) {
	return (group?.products || []).filter(
		(product: any) => normalizeNumber(product?.success_qty) > 0
	);
}

function getSuccessfulWarehouseAllocations(product: any) {
	return (product?.allocations || []).filter(
		(allocation: any) =>
			allocation?.status === "success" && normalizeNumber(allocation?.qty) > 0
	);
}

function getBatchShipPackingTypeLabel(value: any) {
	return (
		packageTypeOptions.find((option) => option.value === Number(value))?.label || "包装未填写"
	);
}

function getBatchShipExecutionSeqText(group: any) {
	const seqs = (group?.seqs || []).filter(Boolean);
	return seqs.length ? seqs.join(" / ") : "-";
}

function getBatchShipMethodSummaryText(method: any) {
	return `计划 ${formatNumber(method?.planned_qty)} 件 · 成功 ${formatNumber(method?.success_qty)} 件 · 失败 ${formatNumber(method?.failed_qty)} 件`;
}

function getBatchShipSubmitSuccessCopyButtonText() {
	return getBatchShipSubmitTotalQty("failed_total_qty") > 0 ? "复制成功指令" : "复制仓库指令";
}

function buildBatchShipSubmitSeqLines(seqs: any[]) {
	const list = (Array.isArray(seqs) ? seqs : [])
		.map((seq) => String(seq || "").trim())
		.filter(Boolean);
	return list.length ? list : ["暂无领星批次"];
}

function buildBatchShipSubmitProductLine(product: any) {
	return `商品：${formatShipHistoryTextValue(product?.msku)} / ${formatShipHistoryTextValue(product?.fnsku)} / ${formatShipHistoryTextValue(product?.asin)}`;
}

function buildBatchShipSubmitAllocationLines(allocations: any[]) {
	const successAllocations = (Array.isArray(allocations) ? allocations : []).filter(
		(allocation) => allocation?.status === "success" && normalizeNumber(allocation?.qty) > 0
	);
	if (!successAllocations.length) return ["暂无成功采购单拆分"];

	const lines: string[] = [];
	successAllocations.forEach((allocation, index) => {
		if (index > 0) lines.push("");
		lines.push(
			`${index + 1}. ${formatShipHistoryTextValue(allocation.purchase_order_sn)}`,
			`   数量：${formatNumber(allocation.qty)}件`,
			`   计划：${formatShipHistoryTextValue(allocation.purchase_plan_sn)}`,
			`   批次：${formatShipHistoryTextValue(allocation.lingxing_seq)}`
		);
	});
	return lines;
}

function buildBatchShipSubmitExecutionGroupInstruction(method: any, group: any) {
	const methodLabel = formatShipHistoryTextValue(method?.method_label || method?.method_key);
	const lines: string[] = [
		`【${methodLabel} ${formatNumber(group?.success_qty)}件】`,
		`仓库：${formatShipHistoryTextValue(group?.warehouse_name, "未填写仓库")}`,
		`包装：${getBatchShipPackingTypeLabel(group?.packing_type)}`,
		`发货日：${group?.shipment_time || "未填写日期"}`
	];

	if (group?.batch_remark) {
		lines.push(`批次备注：${group.batch_remark}`);
	}

	lines.push("");
	lines.push("领星批次：");
	lines.push(...buildBatchShipSubmitSeqLines(group?.seqs));

	getSuccessfulWarehouseProducts(group).forEach((product: any) => {
		lines.push("");
		lines.push(buildBatchShipSubmitProductLine(product));
		lines.push(`数量：${formatNumber(product?.success_qty)}件`);
		if (product?.detail_remark) lines.push(`商品备注：${product.detail_remark}`);
		lines.push("采购单拆分：");
		lines.push(...buildBatchShipSubmitAllocationLines(product?.allocations));
	});

	return lines.join("\n");
}

function buildBatchShipSubmitMethodInstruction(method: any) {
	const groups = getSuccessfulWarehouseExecutionGroups(method);
	if (!groups.length) return "";
	return groups
		.map((group: any) => buildBatchShipSubmitExecutionGroupInstruction(method, group))
		.filter(Boolean)
		.join("\n\n");
}

function buildBatchShipSubmitSuccessInstruction() {
	const lines: string[] = [
		"【仓库发货指令】",
		`批次：${formatShipHistoryTextValue(shipPlanSubmitResult.value?.batch_no)}`,
		`合计：成功 ${formatNumber(getBatchShipSubmitTotalQty("success_total_qty"))}件${
			getBatchShipSubmitTotalQty("failed_total_qty") > 0
				? `，失败 ${formatNumber(getBatchShipSubmitTotalQty("failed_total_qty"))}件未包含`
				: ""
		}`
	];

	const methodLines = getBatchShipSuccessfulMethods()
		.map((method: any) => buildBatchShipSubmitMethodInstruction(method))
		.filter(Boolean);
	if (!methodLines.length) {
		lines.push("");
		lines.push("暂无成功创建的仓库执行项");
		return lines.join("\n");
	}

	methodLines.forEach((methodText: string) => {
		lines.push("");
		lines.push(methodText);
	});
	return lines.join("\n");
}

function buildBatchShipSubmitFailureList() {
	const failedItems = shipPlanSubmitResult.value?.failed_items || [];
	const failedQty = failedItems.reduce(
		(sum: number, item: any) => sum + normalizeNumber(item?.ship_qty),
		0
	);
	const lines: string[] = [
		"【批量发货失败清单】",
		`批次：${formatShipHistoryTextValue(shipPlanSubmitResult.value?.batch_no)}`,
		`失败：${failedItems.length}项 / ${formatNumber(failedQty)}件`
	];

	if (!failedItems.length) {
		lines.push("");
		lines.push("暂无失败项");
		return lines.join("\n");
	}

	failedItems.forEach((item: any, index: number) => {
		if (index > 0) lines.push("");
		lines.push(
			`${index + 1}. ${formatShipHistoryTextValue(item.method_label)} · ${formatShipHistoryTextValue(item.msku)}`,
			`   数量：${formatNumber(item.ship_qty)}件`,
			`   采购单：${formatShipHistoryTextValue(item.purchase_order_sn)}`,
			`   采购计划：${formatShipHistoryTextValue(item.purchase_plan_sn)}`,
			`   原因：${formatShipHistoryTextValue(item.error_message, "创建失败")}`
		);
	});

	return lines.join("\n");
}

function buildBatchShipSubmitLocalSyncFailureList() {
	const failedItems = getBatchShipLocalSyncFailedItems();
	const failedQty = getBatchShipLocalSyncFailedQty();
	const lines: string[] = [
		"【批量发货本地同步异常】",
		`批次：${formatShipHistoryTextValue(shipPlanSubmitResult.value?.batch_no)}`,
		`异常：${failedItems.length}项 / ${formatNumber(failedQty)}件`,
		"说明：领星发货计划已创建，但本地发货计划同步失败，请核对领星批次和本地发货计划列表。"
	];

	if (!failedItems.length) {
		lines.push("");
		lines.push("暂无本地同步异常");
		return lines.join("\n");
	}

	failedItems.forEach((item: any, index: number) => {
		if (index > 0) lines.push("");
		lines.push(
			`${index + 1}. ${formatShipHistoryTextValue(item.method_label)} · ${formatShipHistoryTextValue(item.msku)}`,
			`   数量：${formatNumber(item.ship_qty)}件`,
			`   采购单：${formatShipHistoryTextValue(item.purchase_order_sn)}`,
			`   采购计划：${formatShipHistoryTextValue(item.purchase_plan_sn)}`,
			`   领星批次：${formatShipHistoryTextValue(item.lingxing_seq)}`,
			`   异常：${formatShipHistoryTextValue(item.local_sync_error, "本地同步失败")}`
		);
	});

	return lines.join("\n");
}

function copyBatchShipSubmitSuccessInstruction() {
	void copyTextToClipboard(buildBatchShipSubmitSuccessInstruction(), "已复制仓库发货指令");
}

function copyBatchShipSubmitFailureList() {
	void copyTextToClipboard(buildBatchShipSubmitFailureList(), "已复制失败清单");
}

function copyBatchShipSubmitLocalSyncFailureList() {
	void copyTextToClipboard(buildBatchShipSubmitLocalSyncFailureList(), "已复制本地同步异常清单");
}

function copyBatchShipSubmitMethodInstruction(method: any) {
	const text = [
		"【发货运输方式指令】",
		`批次：${formatShipHistoryTextValue(shipPlanSubmitResult.value?.batch_no)}`,
		buildBatchShipSubmitMethodInstruction(method)
	]
		.filter(Boolean)
		.join("\n\n");
	void copyTextToClipboard(text, `已复制${method?.method_label || "本运输方式"}指令`);
}

function getBatchShipFinalResultFooterText() {
	const failedQty = getBatchShipSubmitTotalQty("failed_total_qty");
	const localSyncFailedQty = getBatchShipLocalSyncFailedQty();
	if (failedQty > 0 && localSyncFailedQty > 0) {
		return "结果已保存，失败项可重试；本地同步异常项请核对领星批次和本地发货计划。";
	}
	if (failedQty > 0) {
		return "结果已保存到本地批量发货批次，失败项可按结果重新处理。";
	}
	if (localSyncFailedQty > 0) {
		return "领星发货计划已创建，但存在本地同步异常，请核对后再结束流程。";
	}
	return "本批次已全部创建并同步，可复制仓库指令后完成并关闭。";
}

function closeFinalResultDialog() {
	finalConfirmDialog.visible = false;
}

function finishBatchShipFlow() {
	finalConfirmDialog.visible = false;
	shipPlanDialog.visible = false;
	dialogVisible.value = false;
}

function formatBatchShipFailureSummary(message: any) {
	const text = String(message || "创建失败").trim();
	const code = text.match(/\[code:(\d+)\]/i)?.[1];
	if (/店铺ID.*不匹配/.test(text)) {
		return `领星校验失败：采购计划店铺与发货计划店铺不匹配${code ? `（code:${code}）` : ""}`;
	}
	return text.length > 76 ? `${text.slice(0, 76)}...` : text;
}

function getBatchShipRetryButtonText() {
	const failedItems = shipPlanSubmitResult.value?.failed_items || [];
	const failedQty = failedItems.reduce(
		(sum: number, item: any) => sum + normalizeNumber(item?.ship_qty),
		0
	);
	return `重试 ${failedItems.length} 个失败项 · ${formatNumber(failedQty)} 件`;
}

function handleGlobalShippingMethodsChange(methods: string[]) {
	if (!methods.length) {
		ElMessage.warning("至少保留一种运输方式参与推演");
		return;
	}
	globalSelectedShippingMethods.value = methods;
	if (targetDaysAutoSynced.value) {
		globalDefaultTargetDays.value = getSelectedMethodsDefaultTargetDays(
			methods,
			shippingBuffer.value
		);
	}
	void calculateItems(dialogItems.value, true);
}

function onGlobalShippingProfileChange(profileKey: string) {
	const profile = resolveShippingProfile(profileKey);
	globalShippingProfile.value = profile.key;
	shippingMethods.splice(
		0,
		shippingMethods.length,
		...buildShippingMethodsForProfile(profile.key)
	);
	globalSelectedShippingMethods.value = [...profile.selectedMethods];
	globalDefaultTargetDays.value = getProfileDefaultTargetDays(profile.key, shippingBuffer.value);
	targetDaysAutoSynced.value = true;

	const validKeys = new Set(DEFAULT_SHIPPING_METHOD_CONFIGS.map((method) => method.key));
	dialogItems.value.forEach((item) => {
		item.inactiveMethods = (item.inactiveMethods || []).filter((key) => validKeys.has(key));
		item.excluded_shipping_methods = [...item.inactiveMethods];
	});
	void calculateItems(dialogItems.value, true);
}

function handleShippingMethodDaysChange(payload: { key: string; days: number }) {
	if (globalShippingProfile.value !== "default" || currentShippingProfile.value.readonly) return;
	const methodKey = String(payload?.key || "");
	const methodConfig = DEFAULT_SHIPPING_METHOD_CONFIGS.find((method) => method.key === methodKey);
	if (!methodConfig) return;

	const days = Math.min(
		180,
		Math.max(1, Math.round(normalizeNumber(payload?.days) || methodConfig.days))
	);
	SHIPPING_PROFILES.default.methodDays[methodKey] = days;
	const method = shippingMethods.find((item) => item.key === methodKey);
	if (method) {
		method.days = days;
	}
	refreshShippingProfileOptions();

	if (targetDaysAutoSynced.value) {
		globalDefaultTargetDays.value = getSelectedMethodsDefaultTargetDays(
			globalSelectedShippingMethods.value,
			shippingBuffer.value
		);
	}
	void calculateItems(dialogItems.value, true);
}

function getSelectedMethodsDefaultTargetDays(
	methodKeys: string[],
	bufferDays = shippingBuffer.value
) {
	const slowestDays = methodKeys.reduce((max, methodKey) => {
		const days = shippingMethods.find((method) => method.key === methodKey)?.days || 0;
		return Math.max(max, days);
	}, 0);
	return Math.max(
		1,
		Math.round(slowestDays + normalizeNumber(bufferDays) + DEFAULT_PROFILE_TARGET_EXTRA_DAYS)
	);
}

function handleGlobalTargetDaysChange(value: number) {
	globalDefaultTargetDays.value =
		normalizePositiveInteger(value) ||
		getProfileDefaultTargetDays(globalShippingProfile.value, shippingBuffer.value);
	targetDaysAutoSynced.value = false;
}

function handleGlobalShippingBufferChange(value: number) {
	shippingBuffer.value = Math.max(0, Math.round(normalizeNumber(value)));
	if (targetDaysAutoSynced.value) {
		globalDefaultTargetDays.value = getSelectedMethodsDefaultTargetDays(
			globalSelectedShippingMethods.value,
			shippingBuffer.value
		);
	}
}

function handleTargetPeriodModeChange(mode: TargetPeriodMode) {
	if (targetPeriodMode.value === mode) return;
	targetPeriodMode.value = mode;
	if (mode === "global") {
		dialogItems.value.forEach((item) => {
			item.manual_target_date_range = null;
			if (!item.calculationInputValues) {
				item.calculationInputValues = createCurrentCalculationInputValues(item);
			}
			item.calculationInputValues.date_range = null;
		});
	}
}

function normalizeItemDateRange(range: any): string[] | null {
	if (!Array.isArray(range) || range.length < 2) return null;
	const start = dayjs(range[0]).startOf("day");
	const end = dayjs(range[1]).startOf("day");
	if (!start.isValid() || !end.isValid() || end.isBefore(start, "day")) return null;
	return [start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD")];
}

function handleItemPeriodRangeChange(item: BatchShipItem, range: string[] | null) {
	const normalized = normalizeItemDateRange(range);
	if (!normalized) {
		item.manual_target_date_range = null;
		if (!item.calculationInputValues) {
			item.calculationInputValues = createCurrentCalculationInputValues(item);
		}
		item.calculationInputValues.date_range = null;
		setCurrentTraceFieldInputValue(item, "target_stock_days", true);
		return;
	}

	const days = getDateRangeDays(normalized);
	if (!days) {
		ElMessage.warning("请选择有效的销售周期");
		return;
	}

	const switchedTargetMode = targetPeriodMode.value === "global";
	if (switchedTargetMode) {
		targetPeriodMode.value = "product";
		ElMessage.info("已切换为产品目标模式，当前行周期单独生效");
	}

	item.manual_target_date_range = normalized;
	if (!item.calculationInputValues) {
		item.calculationInputValues = createCurrentCalculationInputValues(item);
	}
	item.calculationInputValues.target_stock_days = days;
	item.calculationInputValues.date_range = [...normalized];
	item.effective_target_stock_days = days;
	item.target_stock_days_is_default = false;
	item.dateRange = [...normalized];
	item.calculationInputSources.target_stock_days = {
		type: "manual",
		label: `手动周期 ${formatDateRangeWithDays(normalized)}`
	};

	if (!switchedTargetMode) void calculateItems([item], true);
}

function applyGlobalAlgo() {
	dialogItems.value.forEach((item) => {
		item.algo = globalAlgo.value;
	});
	void calculateItems(dialogItems.value, false);
}

function toggleItemShippingMethod(item: BatchShipItem, methodKey: string, active: boolean) {
	const inactive = new Set(item.inactiveMethods || []);
	if (active) {
		inactive.delete(methodKey);
	} else {
		inactive.add(methodKey);
	}
	const activeCount = sortedSelectedMethods.value.filter((key) => !inactive.has(key)).length;
	if (activeCount <= 0) {
		ElMessage.warning("至少保留一种运输方式参与推演");
		return;
	}
	item.inactiveMethods = Array.from(inactive);
	item.excluded_shipping_methods = [...item.inactiveMethods];
	void calculateItems([item], true);
}

function buildSegmentDecisionRows(
	segment: ShippingSegmentResult | null,
	allocatedBefore: number,
	remainingBefore: number
) {
	const segmentGap = segment
		? Math.max(0, normalizeNumber(segment.segmentGap ?? segment.systemGap))
		: 0;
	const preArrivalGap = segment ? Math.max(0, normalizeNumber(segment.preArrivalGap)) : 0;
	const preArrivalRange = formatPreArrivalShortageRange(segment);
	const rows = [
		{
			label: "覆盖周期",
			value: segment
				? `${formatShortMonthDay(segment.startDate)} ~ ${formatShortMonthDay(segment.endDate)}`
				: "-"
		},
		{
			label: "本段缺口",
			value: segment ? formatNumber(segmentGap) : "-",
			important: true
		},
		{ label: "前段占用", value: formatNumber(allocatedBefore) },
		{ label: "本段可分", value: formatNumber(remainingBefore), important: true },
		{
			label: "建议发",
			value: segment ? formatNumber(segment.suggestedQty) : "0",
			important: true
		},
		{ label: "发后仍缺", value: segment ? formatNumber(segment.remainingGap) : "-" }
	];

	if (preArrivalGap > 0) {
		rows.splice(4, 0, {
			label: "到达前检查",
			value: preArrivalRange || "-",
			important: true
		});
		rows.splice(5, 0, {
			label: "到达前缺口",
			value: formatNumber(preArrivalGap),
			important: true
		});
	}

	return rows;
}

function formatPreArrivalShortageRange(segment: ShippingSegmentResult | null) {
	const preArrival = segment?.preArrivalShortage || null;
	const startDate =
		preArrival?.startDate ||
		preArrival?.shortageStartDate ||
		(Array.isArray(preArrival?.details) ? preArrival.details[0]?.date : "");
	const endDate =
		preArrival?.endDate ||
		preArrival?.shortageEndDate ||
		(Array.isArray(preArrival?.details)
			? preArrival.details[preArrival.details.length - 1]?.date
			: "");
	if (!startDate || !endDate) return "";
	return `${formatShortMonthDay(startDate)}~${formatShortMonthDay(endDate)}`;
}

function formatSegmentAllocationTrace(allocations: SegmentAllocationTrace[]) {
	const validList = allocations.filter((item) => normalizeNumber(item.qty) > 0);
	if (!validList.length) return "无";
	return validList.map((item) => `${item.label} ${formatNumber(item.qty)}`).join("、");
}

function buildDisabledSegmentReason(
	method: ShippingMethod,
	baseReason: string,
	fastestEnabledMethod: ShippingMethod | null
) {
	if (!fastestEnabledMethod || fastestEnabledMethod.key === method.key) return baseReason;
	return `${baseReason} 当前最快启用方式：${fastestEnabledMethod.label}，如果存在到达前缺口，会由${fastestEnabledMethod.label}承接。`;
}

function buildSegmentDecision(
	item: BatchShipItem,
	method: ShippingMethod,
	segment: ShippingSegmentResult | null,
	globalEnabled: boolean,
	itemEnabled: boolean,
	allocatedBefore: number,
	allocationsBefore: SegmentAllocationTrace[],
	fastestEnabledMethod: ShippingMethod | null
) {
	const totalCanShip = normalizeNumber(item.actual_shippable_qty);
	const remainingBefore = Math.max(0, totalCanShip - allocatedBefore);
	const rows = buildSegmentDecisionRows(segment, allocatedBefore, remainingBefore);
	const allocationText = formatSegmentAllocationTrace(allocationsBefore);
	const arrivalDate = dayjs()
		.startOf("day")
		.add(method.days + shippingBuffer.value, "day")
		.format("YYYY-MM-DD");
	const targetEnd = item.dateRange?.[1] || "";
	const baseDisabled = {
		decisionValue: "0件",
		decisionRows: rows,
		decisionFormula: ""
	};

	if (!globalEnabled) {
		return {
			...baseDisabled,
			decisionTone: "disabled",
			decisionLabel: "已关闭",
			decisionTitle: "已关闭",
			decisionSub: "不参与推演",
			decisionReason: buildDisabledSegmentReason(
				method,
				`${method.label} 在当前运输配置中未启用，所以不参与本次目标周期推演。`,
				fastestEnabledMethod
			),
			decisionFormula: ""
		};
	}

	if (!itemEnabled) {
		return {
			...baseDisabled,
			decisionTone: "disabled",
			decisionLabel: "已关闭",
			decisionTitle: "本品已关闭",
			decisionSub: "不参与推演",
			decisionReason: buildDisabledSegmentReason(
				method,
				`${method.label} 已在这个产品上关闭，所以不分配本次发货量。`,
				fastestEnabledMethod
			),
			decisionFormula: ""
		};
	}

	if (!segment) {
		return {
			...baseDisabled,
			decisionTone: "outside",
			decisionLabel: "目标期外",
			decisionTitle: "不参与本周期",
			decisionSub: "无覆盖天数",
			decisionReason: `${method.label} 预计 ${formatShortMonthDay(arrivalDate)} 到达，目标周期截至 ${formatShortMonthDay(targetEnd)}。本目标周期内没有可覆盖天数，所以本段不建议发货。`,
			decisionFormula: ""
		};
	}

	if (segment.warning) {
		return {
			...baseDisabled,
			decisionTone: "error",
			decisionLabel: "推演失败",
			decisionTitle: "后端推演失败",
			decisionSub: "查看原因",
			decisionReason: `${method.label} 段推演没有完成：${segment.warning}`,
			decisionFormula: ""
		};
	}

	const gap = normalizeNumber(segment.systemGap);
	const segmentGap = Math.max(0, normalizeNumber(segment.segmentGap ?? segment.systemGap));
	const preArrivalGap = Math.max(0, normalizeNumber(segment.preArrivalGap));
	const preArrivalRange = formatPreArrivalShortageRange(segment);
	const suggestedQty = normalizeNumber(segment.suggestedQty);
	const remainingGap = normalizeNumber(segment.remainingGap);
	const rangeText = `${formatShortMonthDay(segment.startDate)} ~ ${formatShortMonthDay(segment.endDate)}`;

	if (gap <= 0) {
		return {
			decisionTone: "covered",
			decisionLabel: "不用发",
			decisionValue: "0件",
			decisionTitle: "库存覆盖",
			decisionSub: "无需占用采购单",
			decisionReason: `${method.label} 不用发：${rangeText} 这段库存和在途可以覆盖，本段缺口为 0。`,
			decisionFormula: "本段缺口 0，所以建议发 0",
			decisionRows: rows
		};
	}

	if (suggestedQty > 0) {
		const hasPreArrivalGap = preArrivalGap > 0;
		const gapExplanation = hasPreArrivalGap
			? `覆盖周期 ${rangeText} 本段缺口 ${formatNumber(segmentGap)}，到达前检查 ${preArrivalRange || "-"} 缺口 ${formatNumber(preArrivalGap)}。`
			: `覆盖周期 ${rangeText} 本段缺口 ${formatNumber(segmentGap)}。`;
		const shortageHint = hasPreArrivalGap
			? `这 ${formatNumber(suggestedQty)} 件主要是补 ${preArrivalRange || "到达前检查区间"} 这段到达前缺口。`
			: `这 ${formatNumber(suggestedQty)} 件主要是覆盖 ${rangeText} 这段本段缺口。`;
		const reason =
			suggestedQty < gap
				? `${method.label} 建议发 ${formatNumber(suggestedQty)} 件：${shortageHint}${gapExplanation}但采购单扣掉前段占用后只剩 ${formatNumber(remainingBefore)} 件可分。`
				: `${method.label} 建议发 ${formatNumber(suggestedQty)} 件：${shortageHint}${gapExplanation}发完后该段缺口已覆盖。`;
		const formula = hasPreArrivalGap
			? `本段缺口 ${formatNumber(segmentGap)} + 到达前缺口 ${formatNumber(preArrivalGap)} = 总缺口 ${formatNumber(gap)}；min(总缺口 ${formatNumber(gap)}，本段可分 ${formatNumber(remainingBefore)}) = 建议发 ${formatNumber(suggestedQty)}`
			: `min(本段缺口 ${formatNumber(gap)}，本段可分 ${formatNumber(remainingBefore)}) = 建议发 ${formatNumber(suggestedQty)}`;
		const coveredSubText = hasPreArrivalGap
			? `到达前缺口 ${formatNumber(preArrivalGap)}｜${preArrivalRange || "日期待确认"}`
			: "发后可覆盖";
		return {
			decisionTone: "ship",
			decisionLabel: "建议发",
			decisionValue: `${formatNumber(suggestedQty)}件`,
			decisionTitle: "建议发货",
			decisionSub: remainingGap > 0 ? `发后仍缺 ${formatNumber(remainingGap)}` : coveredSubText,
			decisionReason: reason,
			decisionFormula: formula,
			decisionRows: rows
		};
	}

	if (remainingBefore <= 0) {
		return {
			decisionTone: "blocked",
			decisionLabel: "发不了",
			decisionValue: "0件",
			decisionTitle: "可发已分完",
			decisionSub: `缺口 ${formatNumber(gap)}`,
			decisionReason: `${method.label} 发不了：本段缺 ${formatNumber(gap)} 件，但采购单可发已经被 ${allocationText} 占用完，所以这里发 0。`,
			decisionFormula: `采购单总可发 ${formatNumber(totalCanShip)} - 前段占用 ${formatNumber(allocatedBefore)} = 本段可分 ${formatNumber(remainingBefore)}`,
			decisionRows: rows
		};
	}

	return {
		decisionTone: "blocked",
		decisionLabel: "未分配",
		decisionValue: "0件",
		decisionTitle: "有缺口但未分配",
		decisionSub: `缺口 ${formatNumber(gap)}`,
		decisionReason: `${method.label} 有缺口但没有分配到发货量。建议重新推演或检查采购单可发数量。`,
		decisionFormula: `min(本段缺口 ${formatNumber(gap)}，本段可分 ${formatNumber(remainingBefore)}) = 0`,
		decisionRows: rows
	};
}

function getShippingWorkbenchSegments(item: BatchShipItem) {
	const segmentMap = new Map(
		(item.shippingSegments || []).map((segment) => [segment.key, segment])
	);
	const excluded = new Set(item.inactiveMethods || item.excluded_shipping_methods || []);
	const globalEnabledSet = new Set(globalSelectedShippingMethods.value);
	const traceDistributionRows = getTraceDistributionRows(item);
	const fastestEnabledMethod =
		shippingMethods
			.slice()
			.sort((a, b) => a.days - b.days)
			.find((method) => globalEnabledSet.has(method.key) && !excluded.has(method.key)) || null;
	let allocatedBefore = 0;
	const allocationsBefore: SegmentAllocationTrace[] = [];
	return shippingMethods
		.slice()
		.sort((a, b) => a.days - b.days)
		.map((method) => {
			const globalEnabled = globalEnabledSet.has(method.key);
			const itemEnabled = !excluded.has(method.key);
			const enabled = globalEnabled && itemEnabled;
			const segment = enabled ? segmentMap.get(method.key) : null;
			const allocatedBeforeCurrent = allocatedBefore;
			const decision = buildSegmentDecision(
				item,
				method,
				segment || null,
				globalEnabled,
				itemEnabled,
				allocatedBeforeCurrent,
				[...allocationsBefore],
				fastestEnabledMethod
			);
			if (segment) {
				const suggestedQty = normalizeNumber(segment.suggestedQty);
				if (suggestedQty > 0) {
					allocationsBefore.push({ label: method.label, qty: suggestedQty });
				}
				allocatedBefore += suggestedQty;
			}
			const shipQtyEditable = enabled && normalizeNumber(item.actual_shippable_qty) > 0;
			const manualShipQty = shipQtyEditable ? getSegmentManualShipQty(item, method.key) : 0;
			const systemSuggestQty = segment ? normalizeNumber(segment.suggestedQty) : 0;
			const manualDelta = manualShipQty - systemSuggestQty;
			const planDiff = buildShippingPlanDiffSummary({
				methodKey: method.key,
				actualQty: manualShipQty,
				traceRows: traceDistributionRows,
				formatNumber
			});
			const manualLocked = isManualShipMethodLocked(item, method.key);
			const transferNotice = item.manual_ship_transfer_notice_map?.[method.key] || null;
			const tempRecord = getSegmentTempRecord(item, method.key);
			const tempSavedQty = normalizeNumber(tempRecord?.shipQty);
			const tempDirty = Boolean(tempRecord) && tempSavedQty !== manualShipQty;
			const coefficientPanel = buildSegmentCoefficientPanel(item, method, segment || null);
			const coefficientBadgeMode =
				coefficientPanel.coefficientTone === "manual"
					? "人工"
					: coefficientPanel.coefficientTone === "history"
						? "历史"
						: "系统";
			const coefficientBadgeSymbol = coefficientPanel.canEditAlpha ? "α" : "系数";
			const coefficientBadgeValue = coefficientPanel.canEditAlpha
				? formatCoefficientNumber(coefficientPanel.alphaInputValue)
				: coefficientPanel.coefficientText;
			const manualCoefficientLabel = coefficientPanel.canEditAlpha ? "人工α" : "人工系";
			const rangeCompactText = segment
				? `${formatCardMonthDay(segment.startDate)}~${formatCardMonthDay(segment.endDate)}`
				: "";
			const segmentCanShip = Math.max(
				0,
				normalizeNumber(item.actual_shippable_qty) - allocatedBeforeCurrent
			);
			const arrivalQty = segment
				? getShippingSegmentInventoryMetric(segment, [
						"arrivalsInSegment",
						"arrivals_in_segment",
						"arrivalQty",
						"arrival_qty",
						"segmentArrivalQty",
						"segment_arrival_qty",
						"inboundArrivalQty",
						"inbound_arrival_qty"
					])
				: 0;
			const inboundUsage = segment
				? getShippingSegmentInventoryMetric(segment, [
						"usedFromInbound",
						"used_from_inbound",
						"inboundUsageQty",
						"inbound_usage_qty",
						"consumeInboundQty",
						"consume_inbound_qty"
					])
				: 0;
			return {
				...method,
				...decision,
				...coefficientPanel,
				active: Boolean(segment && enabled),
				enabled,
				globalEnabled,
				rangeText: !globalEnabled
					? "全局关闭"
					: !itemEnabled
						? "本品关闭"
						: segment
							? `${formatShortMonthDay(segment.startDate)} ~ ${formatShortMonthDay(segment.endDate)}`
							: "目标期外",
				rangeCompactText,
				durationText: segment ? `覆盖 ${segment.days}天` : "未覆盖",
				arrivalText: `到货${method.days}天`,
				coefficientBadgeMode,
				coefficientBadgeSymbol,
				coefficientBadgeValue,
				manualCoefficientLabel,
				suggestText: segment ? formatNumber(segment.suggestedQty) : "0",
				shipQtyEditable,
				manualShipQty,
				systemSuggestQty,
				decisionCovered:
					decision.decisionTone === "covered" ||
					Boolean(
						segment &&
							normalizeNumber(segment.remainingGap) <= 0 &&
							(decision.decisionTone === "ship" ||
								decision.decisionSub.includes("覆盖") ||
								decision.decisionSub.includes("到达前缺口"))
					),
				planDiff,
				allocatedBeforeQty: allocatedBeforeCurrent,
				segmentCanShipQty: segmentCanShip,
				allocatedBeforeText: formatNumber(allocatedBeforeCurrent),
				segmentCanShipText: formatNumber(segmentCanShip),
				arrivalQtyValue: arrivalQty,
				arrivalQtyText: formatNumber(arrivalQty),
				inboundUsageValue: inboundUsage,
				inboundUsageText: formatNumber(inboundUsage),
				manualMaxQty: Math.max(
					0,
					shipQtyEditable
						? normalizeNumber(item.actual_shippable_qty) -
								(getItemManualShipQty(item) - manualShipQty)
						: 0
				),
				manualDeltaText:
					manualDelta > 0
						? `人工增加 ${formatNumber(manualDelta)}`
						: manualDelta < 0
							? `低于建议 ${formatNumber(Math.abs(manualDelta))}`
							: "",
				manualDeltaTone: manualDelta > 0 ? "warning" : manualDelta < 0 ? "info" : "",
				transferNoticeText: transferNotice?.text || "",
				transferNoticeTone: transferNotice?.tone || "",
				manualLocked,
				manualLockText: manualLocked && manualShipQty > 0 ? "手工锁定" : "",
				tempSaved: Boolean(tempRecord),
				tempDirty,
				tempStatusText: tempRecord
					? tempDirty
						? `已暂存 ${formatNumber(tempSavedQty)}件，当前未保存`
						: `已暂存 ${formatNumber(tempSavedQty)}件`
					: "",
				tempStatusTone: tempDirty ? "warning" : tempRecord ? "success" : "",
				tempButtonText: tempRecord ? (tempDirty ? "更新暂存" : "已暂存") : "暂存本段",
				gapText: segment ? formatNumber(segment.systemGap) : "-",
				remainingText: segment ? formatNumber(segment.remainingGap) : "-",
				preArrivalText:
					segment?.preArrivalGap > 0
						? `到达前 ${formatNumber(segment.preArrivalGap)}`
						: "",
				preArrivalShortage: segment?.preArrivalShortage || null,
				warning: !globalEnabled
					? "未参与推演"
					: !itemEnabled
						? "本品未参与"
						: segment?.warning || ""
			};
		}) as Array<
		ShippingMethod & {
			active: boolean;
			enabled: boolean;
			globalEnabled: boolean;
			rangeText: string;
			rangeCompactText: string;
			durationText: string;
			arrivalText: string;
			coefficientBadgeMode: string;
			coefficientBadgeSymbol: string;
			coefficientBadgeValue: string;
			manualCoefficientLabel: string;
			suggestText: string;
			shipQtyEditable: boolean;
			manualShipQty: number;
			systemSuggestQty: number;
			decisionCovered: boolean;
			planDiff: ShippingPlanDiffSummary;
			allocatedBeforeQty: number;
			segmentCanShipQty: number;
			allocatedBeforeText: string;
			segmentCanShipText: string;
			arrivalQtyValue: number;
			arrivalQtyText: string;
			inboundUsageValue: number;
			inboundUsageText: string;
			manualMaxQty: number;
			manualDeltaText: string;
			manualDeltaTone: string;
			transferNoticeText: string;
			transferNoticeTone: string;
			manualLocked: boolean;
			manualLockText: string;
			tempSaved: boolean;
			tempDirty: boolean;
			tempStatusText: string;
			tempStatusTone: string;
			tempButtonText: string;
			gapText: string;
			remainingText: string;
			preArrivalText: string;
			preArrivalShortage: any;
			coefficientValue: number;
			coefficientText: string;
			coefficientSourceText: string;
			coefficientTone: string;
			coefficientRows: any[];
			coefficientFormulaRows: string[];
			coefficientInputValue: number;
			alphaInputValue: number;
			manualFinalCoefficient: number | null;
			manualAlpha: number | null;
			canEditAlpha: boolean;
			coefficientNotice: string;
			warning: string;
			decisionTone: string;
			decisionLabel: string;
			decisionValue: string;
			decisionTitle: string;
			decisionSub: string;
			decisionReason: string;
			decisionFormula: string;
			decisionRows: Array<{ label: string; value: string; important?: boolean }>;
		}
	>;
}

function getActiveShippingMethods(item: BatchShipItem) {
	const excluded = new Set(item.inactiveMethods || item.excluded_shipping_methods || []);
	return shippingMethods
		.filter(
			(method) =>
				sortedSelectedMethods.value.includes(method.key) && !excluded.has(method.key)
		)
		.slice()
		.sort((a, b) => a.days - b.days);
}

function getPreArrivalShortageRows(preArrivalShortage: any) {
	return (Array.isArray(preArrivalShortage?.details) ? preArrivalShortage.details : []).slice(
		0,
		8
	);
}

function getAlgoEngineKey(algo: string) {
	return algo === "operator_intent" ? "combined" : algo;
}

function isCombinedAlgoKey(algo: string) {
	return getAlgoEngineKey(algo) === "combined";
}

function mapAlgoToInt(algo: string) {
	const engineKey = getAlgoEngineKey(algo);
	if (engineKey === "daily_avg") return 1;
	if (engineKey === "history") return 2;
	if (engineKey === "trend") return 3;
	if (engineKey === "combined") return 4;
	return 1;
}

function getFbaInventoryQuantityForGap(item: BatchShipItem) {
	const matchedList = filterByItemMsku(item.fbaValidList, item);
	if (matchedList.length > 0) {
		const qty = matchedList.reduce((sum, row: any) => sum + normalizeNumber(row.quantity), 0);
		return Math.max(0, Math.round(qty));
	}
	return Math.max(0, Math.round(normalizeNumber(item.fba_qty)));
}

function getFbaReservedQuantity(item: BatchShipItem) {
	const matchedList = filterByItemMsku(item.fbaValidList, item);
	if (matchedList.length > 0) {
		const qty = matchedList.reduce(
			(sum, row: any) => sum + normalizeNumber(row.afnReservedQuantity),
			0
		);
		return Math.max(0, Math.round(qty));
	}
	return Math.max(0, Math.round(normalizeNumber(item.fba_reserved_qty)));
}

function getFbaShippingListForGap(item: BatchShipItem) {
	return filterByItemMsku(item.fbaShippingList, item);
}

function getItemFirstActiveArrivalInfo(item: BatchShipItem) {
	const method = getActiveShippingMethods(item)[0];
	if (!method) return null;
	return {
		key: method.key,
		label: method.label,
		arrivalDate: dayjs()
			.startOf("day")
			.add(method.days + shippingBuffer.value, "day")
			.format("YYYY-MM-DD")
	};
}

function getItemPreArrivalRequestFields(item: BatchShipItem): Record<string, any> {
	const arrival = getItemFirstActiveArrivalInfo(item);
	if (!arrival) return {};
	const cycleEnd = item.dateRange?.[1] || "";
	const arrivalEnd = dayjs(arrival.arrivalDate).subtract(1, "day").startOf("day");
	const cycleEndD = cycleEnd ? dayjs(cycleEnd).startOf("day") : null;
	const preArrivalEndDate =
		cycleEndD?.isValid() && cycleEndD.isBefore(arrivalEnd, "day")
			? cycleEndD.format("YYYY-MM-DD")
			: arrivalEnd.format("YYYY-MM-DD");

	return {
		preArrivalDate: arrival.arrivalDate,
		preArrivalEndDate,
		preArrivalMethodKey: arrival.key,
		preArrivalMethodLabel: arrival.label,
		pastInboundEffectiveDate: arrival.arrivalDate,
		pastInboundMethodKey: arrival.key,
		pastInboundMethodLabel: arrival.label
	};
}

function buildPreArrivalShortageParams(segmentIndex: number, item: BatchShipItem) {
	const preArrivalEndDate = getItemPreArrivalRequestFields(item).preArrivalEndDate;
	return segmentIndex === 0
		? {
				includePreArrivalShortage: true,
				cycleStartDate: dayjs().startOf("day").format("YYYY-MM-DD"),
				...(preArrivalEndDate ? { preArrivalEndDate } : {})
			}
		: {};
}

function normalizeShippableOrders(item: any): ShippableOrderDetail[] {
	const source = Array.isArray(item?.shippableOrders)
		? item.shippableOrders
		: Array.isArray(item?.shippable_orders)
			? item.shippable_orders
			: [];
	return source
		.map((order: any, index: number) => ({
			id: String(order?.id || `${order?.order_sn || "order"}_${order?.plan_sn || index}`),
			order_sn: String(order?.order_sn || ""),
			plan_sn: String(order?.plan_sn || ""),
			analysis_record_id: normalizeNullableNumber(order?.analysis_record_id),
			linked_plan_sns: Array.isArray(order?.linked_plan_sns)
				? order.linked_plan_sns.filter(Boolean)
				: [],
			linked_analysis_record_ids: Array.isArray(order?.linked_analysis_record_ids)
				? order.linked_analysis_record_ids
						.map((value: any) => normalizeNullableNumber(value))
						.filter((value: number | null): value is number => value !== null)
				: [],
			status_text: String(order?.status_text || ""),
			supplier_name: String(order?.supplier_name || ""),
			order_time: String(order?.order_time || ""),
			logistics_status_text: String(order?.logistics_status_text || ""),
			logistics_status_reason: String(order?.logistics_status_reason || ""),
			quantity_entry_sum: normalizeNumber(order?.quantity_entry_sum),
			actual_shipment_qty_sum: normalizeNumber(order?.actual_shipment_qty_sum),
			defective_qty: normalizeNumber(order?.defective_qty),
			short_shipped_qty: normalizeNumber(order?.short_shipped_qty),
			estimated_shippable_qty: normalizeNumber(order?.estimated_shippable_qty),
			actual_shippable_qty: normalizeNumber(order?.actual_shippable_qty),
			sync_status: String(order?.sync_status || ""),
			sync_message: String(order?.sync_message || ""),
			ship_qty: 0
		}))
		.filter((order: ShippableOrderDetail) => order.actual_shippable_qty > 0);
}

function cloneOrderDetails(orders: ShippableOrderDetail[]) {
	return orders.map((order) => ({
		...order,
		linked_plan_sns: [...order.linked_plan_sns],
		linked_analysis_record_ids: [...order.linked_analysis_record_ids]
	}));
}

function getShipFiveMonthCombinedRows(item: BatchShipItem) {
	const dailyAvg = getCalculationDailyAvgSales(item);
	const volatility = getCalculationVolatilityCoefficient(item);
	return getFiveMonthDescriptors(item).map((desc) => {
		const source = getCalendarCombinedSource(item, desc.month);
		const coeffInfo = getItemMonthCoefficient(item, desc.month, "combined");
		const salesCoeff = normalizeNumber(source?.filled_sales_coefficient ?? 1);
		const searchCoeff = normalizeNumber(source?.keyword_coefficient ?? 1);
		const alpha = normalizeNumber(source?.system_alpha ?? source?.alpha ?? 0.7);
		const rawCombined = normalizeNumber(source?.coefficient ?? coeffInfo.rawCoefficient);
		const combined = Math.round(coeffInfo.coefficient * 100) / 100;
		const dailyNeed = Math.round(dailyAvg * combined * 100) / 100;
		const subtotal = Math.round(dailyNeed * desc.days);
		const alphaRest = Math.round((1 - alpha) * 100) / 100;
		const tooltipDetail = coeffInfo.hasData
			? {
					title: `${desc.label} 综合走势测算`,
					summary: [
						{
							label: "最终系数",
							value: formatCoefficientNumber(combined),
							tone: "primary"
						},
						{ label: "预计消耗", value: formatNumber(subtotal), tone: "success" }
					],
					metrics: [
						{ label: "竞品销量系数", value: formatCoefficientNumber(salesCoeff) },
						{ label: "搜索趋势系数", value: formatCoefficientNumber(searchCoeff) },
						{
							label: "α / 搜索权重",
							value: `${formatCoefficientNumber(alpha)} / ${formatCoefficientNumber(alphaRest)}`
						}
					],
					formulas: [
						{
							label: "原始综合",
							value: `${formatCoefficientNumber(alpha)} × ${formatCoefficientNumber(salesCoeff)} + ${formatCoefficientNumber(alphaRest)} × ${formatCoefficientNumber(searchCoeff)} = ${formatCoefficientNumber(rawCombined)}`
						},
						{
							label: "波动系数修正",
							value: `(${formatCoefficientNumber(rawCombined)} - 1) × ${formatCoefficientNumber(volatility)} + 1 = ${formatCoefficientNumber(combined)}`,
							tone: "warning"
						},
						{
							label: "预计消耗",
							value: `${formatNumber(dailyAvg)} × ${formatCoefficientNumber(combined)} × ${desc.days}天 = ${formatNumber(subtotal)}`
						}
					],
					sourceLines: source?.alpha_reason_text ? [source.alpha_reason_text] : []
				}
			: {
					title: `${desc.label} 综合走势测算`,
					summary: [
						{
							label: "最终系数",
							value: formatCoefficientNumber(combined),
							tone: "primary"
						},
						{ label: "预计消耗", value: formatNumber(subtotal), tone: "success" }
					],
					metrics: [],
					formulas: [
						{
							label: "缺失处理",
							value: coeffInfo.fallbackReason || `${desc.month} 综合走势缺失，按日均`
						},
						{
							label: "预计消耗",
							value: `${formatNumber(dailyAvg)} × ${formatCoefficientNumber(combined)} × ${desc.days}天 = ${formatNumber(subtotal)}`
						}
					],
					sourceLines: []
				};
		return {
			...desc,
			salesCoeffText: formatCoefficientNumber(salesCoeff),
			searchCoeffText: formatCoefficientNumber(searchCoeff),
			combinedCoeffText: formatCoefficientNumber(combined),
			alphaText: formatCoefficientNumber(alpha),
			subtotalText: formatNumber(subtotal),
			tooltipDetail,
			hasData: coeffInfo.hasData,
			reasonText: coeffInfo.fallbackReason || source?.alpha_reason_text || ""
		};
	});
}

function getShipFiveMonthSimpleRows(item: BatchShipItem) {
	const dailyAvg = getCalculationDailyAvgSales(item);
	const algo = item.algo || globalAlgo.value;
	const volatility = getCalculationVolatilityCoefficient(item);
	return getFiveMonthDescriptors(item).map((desc) => {
		const coeffInfo = getItemMonthCoefficient(item, desc.month, algo);
		const coefficient = Math.round(coeffInfo.coefficient * 100) / 100;
		const dailyNeed = Math.round(dailyAvg * coefficient * 100) / 100;
		const subtotal = Math.round(dailyNeed * desc.days);
		const tooltipDetail =
			algo === "daily_avg"
				? {
						title: `${desc.label} 日均销量测算`,
						summary: [
							{
								label: "最终系数",
								value: formatCoefficientNumber(1),
								tone: "primary"
							},
							{ label: "预计消耗", value: formatNumber(subtotal), tone: "success" }
						],
						metrics: [
							{ label: "日均销量", value: formatNumber(dailyAvg) },
							{ label: "周期天数", value: `${desc.days}天` }
						],
						formulas: [
							{
								label: "预计消耗",
								value: `${formatNumber(dailyAvg)} × ${desc.days}天 = ${formatNumber(subtotal)}`
							}
						],
						sourceLines: ["日均销量算法固定系数为 1.00。"]
					}
				: coeffInfo.hasData
					? {
							title: `${desc.label} ${getAlgoLabel(algo)}测算`,
							summary: [
								{
									label: "最终系数",
									value: formatCoefficientNumber(coefficient),
									tone: "primary"
								},
								{
									label: "预计消耗",
									value: formatNumber(subtotal),
									tone: "success"
								}
							],
							metrics: [
								{
									label: "原始系数",
									value: formatCoefficientNumber(coeffInfo.rawCoefficient)
								},
								{ label: "波动系数", value: formatCoefficientNumber(volatility) },
								{ label: "日均销量", value: formatNumber(dailyAvg) }
							],
							formulas: [
								{
									label: "波动系数修正",
									value: `(${formatCoefficientNumber(coeffInfo.rawCoefficient)} - 1) × ${formatCoefficientNumber(volatility)} + 1 = ${formatCoefficientNumber(coefficient)}`,
									tone: "warning"
								},
								{
									label: "预计消耗",
									value: `${formatNumber(dailyAvg)} × ${formatCoefficientNumber(coefficient)} × ${desc.days}天 = ${formatNumber(subtotal)}`
								}
							],
							sourceLines: []
						}
					: {
							title: `${desc.label} ${getAlgoLabel(algo)}测算`,
							summary: [
								{
									label: "最终系数",
									value: formatCoefficientNumber(coefficient),
									tone: "primary"
								},
								{
									label: "预计消耗",
									value: formatNumber(subtotal),
									tone: "success"
								}
							],
							metrics: [],
							formulas: [
								{
									label: "缺失处理",
									value:
										coeffInfo.fallbackReason ||
										`${desc.month} ${getAlgoLabel(algo)}缺失，按日均`
								},
								{
									label: "预计消耗",
									value: `${formatNumber(dailyAvg)} × ${formatCoefficientNumber(coefficient)} × ${desc.days}天 = ${formatNumber(subtotal)}`
								}
							],
							sourceLines: []
						};
		return {
			...desc,
			coeffText: formatCoefficientNumber(coefficient),
			dailyNeedText: formatCoefficientNumber(dailyNeed),
			subtotalText: formatNumber(subtotal),
			tooltipDetail,
			hasData: coeffInfo.hasData,
			reasonText: coeffInfo.fallbackReason || ""
		};
	});
}

function getShipCoefficientDetailSummary(item: BatchShipItem) {
	return [
		{ label: "计算依据", value: getAlgoLabel(item.algo || globalAlgo.value) },
		{ label: "日均销量", value: formatNumber(getCalculationDailyAvgSales(item)) },
		{ label: "目标库存", value: formatEffectiveTargetStockDays(item) },
		{ label: "预计消耗", value: formatNumber(item.totalDemand) },
		{
			label: "波动系数",
			value: formatCoefficientNumber(getCalculationVolatilityCoefficient(item))
		},
		{ label: "目标周期", value: formatDateRangeWithDays(getCalculationDateRange(item)) }
	];
}

function getShipCoefficientDetailRows(item: BatchShipItem) {
	const algo = item.algo || globalAlgo.value;
	const dailyAvg = getCalculationDailyAvgSales(item);
	const volatility = getCalculationVolatilityCoefficient(item);

	return getFiveMonthDescriptors(item).map((desc) => {
		const coeffInfo = getItemMonthCoefficient(item, desc.month, algo);
		const finalCoeff = Math.round(coeffInfo.coefficient * 100) / 100;
		const dailyNeed = Math.round(dailyAvg * finalCoeff * 100) / 100;
		const subtotal = Math.round(dailyNeed * desc.days);
		const source = getCalendarCombinedSource(item, desc.month);
		const rawCoeff =
			isCombinedAlgoKey(algo)
				? normalizeNumber(source?.coefficient ?? coeffInfo.rawCoefficient)
				: coeffInfo.rawCoefficient;

		return {
			...desc,
			salesCoeffText: formatCoefficientNumber(source?.filled_sales_coefficient ?? 1),
			searchCoeffText: formatCoefficientNumber(source?.keyword_coefficient ?? 1),
			rawCoeffText: formatCoefficientNumber(rawCoeff),
			volatilityText: formatCoefficientNumber(volatility),
			finalCoeffText: formatCoefficientNumber(finalCoeff),
			dailyNeedText: formatCoefficientNumber(dailyNeed),
			subtotalText: formatNumber(subtotal),
			hasData: coeffInfo.hasData
		};
	});
}

function buildCalendarMonthlyCoefficients(item: BatchShipItem) {
	const calendar = item._calendarData?.calendar || {};
	const result: Record<string, any> = {};
	Object.keys(calendar).forEach((month) => {
		const combined = calendar[month]?.combined;
		if (combined) result[month] = combined;
	});
	return Object.keys(result).length ? result : null;
}

function getCalendarMonthRange() {
	return {
		startMonth: dayjs().subtract(1, "month").format("YYYY-MM"),
		endMonth: dayjs().add(6, "month").format("YYYY-MM")
	};
}

function getCalendarCombinedSource(item: BatchShipItem, month: string) {
	const restored = getRestoredMonthCoefficientOverride(item, month);
	if (restored) {
		const alpha = normalizeNullableNumber(restored.alpha);
		const salesCoeff = normalizeNullableNumber(restored.filled_sales_coefficient);
		const searchCoeff = normalizeNullableNumber(restored.keyword_coefficient);
		const rawCoeff = normalizeNullableNumber(restored.raw_coefficient ?? restored.coefficient);
		return {
			...restored,
			alpha: alpha ?? 0.7,
			system_alpha: alpha ?? 0.7,
			filled_sales_coefficient: salesCoeff ?? 1,
			keyword_coefficient: searchCoeff ?? 1,
			coefficient: rawCoeff ?? 1,
			alpha_reason_text: `${getCoefficientRestoreSourceText(item)} · 历史完整记录逐月系数`
		};
	}
	return item._calendarData?.calendar?.[month]?.combined || null;
}

function getItemMonthCoefficient(item: BatchShipItem, month: string, algo: string) {
	const engineAlgo = getAlgoEngineKey(algo);
	const calendar = item._calendarData?.calendar?.[month];
	const volatility = getCalculationVolatilityCoefficient(item);
	const buildResult = (rawCoefficient: number, hasData: boolean, fallbackReason = "") => {
		const raw = Number.isFinite(rawCoefficient) && rawCoefficient > 0 ? rawCoefficient : 1;
		const coefficient =
			engineAlgo === "daily_avg" ? 1 : applyVolatilityToCoefficient(raw, volatility);
		return { rawCoefficient: raw, coefficient, hasData, fallbackReason };
	};

	if (engineAlgo === "daily_avg") return buildResult(1, true, "");
	const restored = getRestoredMonthCoefficientOverride(item, month);
	if (restored) {
		const raw =
			normalizeNullableNumber(restored.raw_coefficient) ??
			normalizeNullableNumber(restored.rawCoefficient) ??
			normalizeNullableNumber(restored.raw_combined_coefficient) ??
			normalizeNullableNumber(restored.rawCombinedCoefficient) ??
			normalizeNullableNumber(restored.coefficient);
		if (raw !== null) return buildResult(raw, true, `${month} 使用完整记录系数`);
	}
	if (!calendar) return buildResult(1, false, `${month} 无日历数据，按日均`);

	if (engineAlgo === "history") {
		const source = calendar.sales;
		if (source?.status === "ok" && source.coefficient !== undefined) {
			return buildResult(
				normalizeNumber(source.raw_coefficient ?? source.coefficient),
				true,
				""
			);
		}
		return buildResult(1, false, `${month} 历史销量缺失，按日均`);
	}

	if (engineAlgo === "trend") {
		const source = calendar.keywords;
		if (source?.status === "ok" && source.coefficient !== undefined) {
			return buildResult(
				normalizeNumber(source.raw_coefficient ?? source.coefficient),
				true,
				""
			);
		}
		return buildResult(1, false, `${month} 搜索趋势缺失，按日均`);
	}

	const combined = calendar.combined;
	if (combined?.coefficient !== undefined) {
		return buildResult(normalizeNumber(combined.coefficient), true, "");
	}
	return buildResult(1, false, `${month} 综合走势缺失，按日均`);
}

function applyVolatilityToCoefficient(rawCoefficient: number, volatility: number) {
	return Math.round(((rawCoefficient - 1) * volatility + 1) * 100) / 100;
}

function getFiveMonthDescriptors(item: BatchShipItem) {
	const calcRange = getCalculationDateRange(item);
	const start = dayjs(calcRange?.[0] || dayjs())
		.startOf("month")
		.subtract(1, "month");
	return Array.from({ length: 5 }).map((_, index) => {
		const month = start.add(index, "month");
		return {
			key: month.format("YYYY-MM"),
			month: month.format("YYYY-MM"),
			label: `${month.month() + 1}月`,
			days: month.daysInMonth(),
			isCurrentMonth: month.isSame(dayjs(), "month")
		};
	});
}

function getEffectiveTargetStockDays(item: BatchShipItem) {
	const values = item.calculationInputValues || createCurrentCalculationInputValues(item);
	const manualDays = getDateRangeDays(values.date_range);
	if (manualDays) return manualDays;
	const globalDays =
		normalizePositiveInteger(globalDefaultTargetDays.value) || DEFAULT_TARGET_STOCK_DAYS;
	if (targetPeriodMode.value === "global") return globalDays;
	return normalizePositiveInteger(values.target_stock_days) || globalDays;
}

function applyEffectiveTargetStockDays(item: BatchShipItem) {
	if (!item.calculationInputValues) {
		item.calculationInputValues = createCurrentCalculationInputValues(item);
	}
	const manualRange = normalizeItemDateRange(item.calculationInputValues.date_range);
	if (manualRange) {
		const manualDays = getDateRangeDays(manualRange) || DEFAULT_TARGET_STOCK_DAYS;
		item.effective_target_stock_days = manualDays;
		item.target_stock_days_is_default = false;
		item.dateRange = [...manualRange];
		return manualDays;
	}
	const effective = getEffectiveTargetStockDays(item);
	item.effective_target_stock_days = effective;
	item.target_stock_days_is_default =
		targetPeriodMode.value === "product" &&
		normalizePositiveInteger(item.calculationInputValues.target_stock_days) === null;
	const start = dayjs().startOf("day");
	item.dateRange = [
		start.format("YYYY-MM-DD"),
		start.add(effective - 1, "day").format("YYYY-MM-DD")
	];
	return effective;
}

function getSystemTargetStockDays(item: BatchShipItem) {
	return (
		normalizePositiveInteger(item.current_target_stock_days) ||
		normalizePositiveInteger(globalDefaultTargetDays.value) ||
		DEFAULT_TARGET_STOCK_DAYS
	);
}

function formatSystemTargetStockDays(item: BatchShipItem) {
	const value = getSystemTargetStockDays(item);
	const suffix = normalizePositiveInteger(item.current_target_stock_days) ? "" : " 默认";
	return `${formatNumber(value)}天${suffix}`;
}

function getTargetStockClientKey(item: BatchShipItem) {
	return item._batchId || `${item.store_id || ""}_${item.asin}_${item.msku}`;
}

function getVolatilityCoefficientClientKey(item: BatchShipItem) {
	return `${item._batchId || "volatility"}_${item.listing_id || item.product_code || item.msku || item.asin}`;
}

function getItemKey(item: BatchShipItem) {
	return `${item.row_key || "row"}_${item.asin || "asin"}_${item.msku || item.fnsku || item._batchId}`;
}

function getItemSaveCount(item: BatchShipItem) {
	return (tempSaveRecords[getItemKey(item)] || []).length;
}

function findRestockingForItem(restockingList: any[], item: BatchShipItem) {
	const candidates = restockingList.filter(
		(entry: any) =>
			String(entry?.asin || "") === item.asin &&
			restockingIncludes(entry?.marketplaceList || entry?.marketplace, item.marketplace)
	);
	if (!candidates.length) return null;

	const sellerName = String(item.seller_name || "").trim();
	if (!sellerName) return candidates[0];

	return (
		candidates.find((entry: any) => {
			const stores = entry?.storeList || entry?.store_list || entry?.seller_name;
			return restockingIncludes(stores, sellerName);
		}) || candidates[0]
	);
}

function restockingIncludes(value: any, target: string) {
	if (Array.isArray(value)) return value.map(String).includes(target);
	return String(value || "").includes(target);
}

function pickArray(source: any, keys: string[]) {
	for (const key of keys) {
		if (Array.isArray(source?.[key])) return source[key];
	}
	return null;
}

function parseMaybeJson(value: any) {
	if (!value) return value;
	if (Array.isArray(value) || typeof value === "object") return value;
	if (typeof value !== "string") return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function filterByItemMsku(list: any[], item: BatchShipItem, skuField = "msku") {
	if (!Array.isArray(list)) return [];
	const targetMsku = String(item?.msku || "").trim();
	if (!targetMsku) return list;
	const matched = list.filter((row: any) => {
		const sku = String(
			row?.[skuField] || row?.msku || row?.sellerSku || row?.seller_sku || ""
		).trim();
		return sku ? sku === targetMsku : true;
	});
	return matched;
}

function getShipGapFormulaText(item: BatchShipItem) {
	return `后端逐日推演：FBA ${formatNumber(getFbaInventoryQuantityForGap(item))} + 按预计可售日入库的在途，目标周期缺口 ${formatNumber(item.pureGap)}`;
}

function getShipQtyFormulaText(item: BatchShipItem) {
	return `系统建议 ${formatNumber(getItemSuggestedQty(item))}，本次填写 ${formatNumber(item.shipQty)}，不超过实际可发 ${formatNumber(item.actual_shippable_qty)}`;
}

function getAlgoLabel(algo: string) {
	if (algo === "daily_avg") return "日均销量";
	if (algo === "history") return "历史销量";
	if (algo === "trend") return "搜索词趋势";
	if (algo === "operator_intent") return "运营意向";
	return "综合走势";
}

function isShipCombinedAlgo(item: BatchShipItem) {
	return isCombinedAlgoKey(item.algo || globalAlgo.value);
}

function formatEffectiveTargetStockDays(item: BatchShipItem) {
	const text = `${formatNumber(getEffectiveTargetStockDays(item))}天`;
	if (targetPeriodMode.value === "global") return `${text} 统一`;
	return item.target_stock_days_is_default ? `${text} 默认` : text;
}

function formatSellableDays(item: BatchShipItem) {
	return `${formatNullableNumber(item.sellable_days_total, 0)}/${formatNullableNumber(item.sellable_days_fba, 0)}`;
}

function getDailySalesTooltipData(item: BatchShipItem) {
	return {
		dailyAvg: formatNullableNumber(item.daily_avg_sales, 2),
		metrics: [
			{ label: "3日均", value: formatNullableNumber(item.sales_avg_3, 2) },
			{ label: "7日均", value: formatNullableNumber(item.sales_avg_7, 2) },
			{ label: "14日均", value: formatNullableNumber(item.sales_avg_14, 2) },
			{ label: "3日销量", value: formatNullableNumber(item.sales_total_3, 0) },
			{ label: "7日销量", value: formatNullableNumber(item.sales_total_7, 0) },
			{ label: "14日销量", value: formatNullableNumber(item.sales_total_14, 0) },
			{ label: "实时销量", value: formatNullableNumber(item.realtime_sales, 0) }
		],
		history: item.recent_sales_trend_list
			.filter((trend: any) => trend?.date)
			.map((trend: any) => ({
				date: String(trend.date),
				volumeText: formatNullableNumber(trend.volume, 0)
			}))
	};
}

function formatRecentSalesDate(date: any) {
	const parsed = dayjs(date);
	return parsed.isValid() ? parsed.format("MM-DD") : String(date || "-");
}

function getHistoryTrendSummary(value: any, compareIndex = 10) {
	const history = normalizeArray(value);
	const current = normalizeNullableNumber(history[0]);
	const compare = normalizeNullableNumber(history[compareIndex]);
	const currentText = current === null ? "-" : formatNumber(current);
	const compareText = compare === null ? "-" : formatNumber(compare);

	if (current === null || compare === null) {
		return { currentText, compareText, trendText: "-", trendClass: "is-flat" };
	}

	const diff = current - compare;
	if (diff > 0) {
		return {
			currentText,
			compareText,
			trendText: `↑${formatNumber(Math.abs(diff))}`,
			trendClass: "is-up"
		};
	}
	if (diff < 0) {
		return {
			currentText,
			compareText,
			trendText: `↓${formatNumber(Math.abs(diff))}`,
			trendClass: "is-down"
		};
	}
	return { currentText, compareText, trendText: "→0", trendClass: "is-flat" };
}

function getRatingMiniRows(item: BatchShipItem) {
	return [
		{ key: "stars", label: "评分", ...getHistoryTrendSummary(item.stars) },
		{ key: "reviews_num", label: "总数", ...getHistoryTrendSummary(item.reviews_num) }
	];
}

function formatSummaryValue(value: any) {
	if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
	const num = normalizeNullableNumber(value);
	return num === null ? "-" : formatNumber(num);
}

function formatDateRange(range: string[] | null | undefined) {
	return range && range.length >= 2
		? `${formatShortMonthDay(range[0])} ~ ${formatShortMonthDay(range[1])}`
		: "-";
}

function getDateRangeDays(range: string[] | null | undefined) {
	if (!range || range.length < 2) return 0;
	const start = dayjs(range[0]).startOf("day");
	const end = dayjs(range[1]).startOf("day");
	if (!start.isValid() || !end.isValid() || end.isBefore(start)) return 0;
	return end.diff(start, "day") + 1;
}

function formatDateRangeWithDays(range: string[] | null | undefined) {
	const text = formatDateRange(range);
	const days = getDateRangeDays(range);
	return text === "-" || days <= 0 ? text : `${text} · ${days}天`;
}

function formatShortMonthDay(date: any) {
	const parsed = dayjs(date);
	return parsed.isValid() ? parsed.format("M/D") : "-";
}

function formatCardMonthDay(date: any) {
	const parsed = dayjs(date);
	return parsed.isValid() ? parsed.format("M/D") : "-";
}

function formatNumber(value: any) {
	const num = normalizeNumber(value);
	return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
}

function formatCoefficientNumber(value: any) {
	return normalizeNumber(value).toFixed(2);
}

function formatNullableNumber(value: any, digits = 2) {
	const num = normalizeNullableNumber(value);
	if (num === null) return "-";
	return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(digits)));
}

function normalizeNumber(value: any) {
	const num = Number(value);
	return Number.isFinite(num) ? num : 0;
}

function formatPlanDiffSignedNumber(value: number, formatter: (value: number) => string) {
	if (value > 0) return `+${formatter(value)}`;
	return formatter(value);
}

function buildShippingPlanDiffSummary({
	methodKey,
	actualQty,
	traceRows,
	formatNumber: formatter = formatNumber
}: BuildShippingPlanDiffSummaryOptions): ShippingPlanDiffSummary {
	const detailRows = traceRows
		.map((row, index) => {
			const cell = row.methodCells?.find((item) => item.methodKey === methodKey);
			const qty = normalizeNumber(cell?.qtyText);

			if (qty <= 0) return null;

			return {
				key: `${row.traceKey || row.key || index}-${methodKey}`,
				planText: row.planText || "未关联计划",
				analysisText: row.analysisText || "-",
				qty,
				qtyText: formatter(qty),
				periodText: cell?.periodText || "-",
				statusText: cell?.statusText || "-"
			};
		})
		.filter(Boolean) as ShippingPlanDiffDetailRow[];

	const plannedQty = detailRows.reduce((sum, row) => sum + row.qty, 0);
	const normalizedActualQty = normalizeNumber(actualQty);
	const diffQty = normalizedActualQty - plannedQty;
	const plannedText = formatter(plannedQty);
	const actualText = formatter(normalizedActualQty);
	const formulaText = detailRows.length
		? `计划 ${plannedText} = ${detailRows.map((row) => row.qtyText).join(" + ")}`
		: "上方计划 0";
	const tone: ShippingPlanDiffTone =
		plannedQty <= 0 && normalizedActualQty <= 0
			? "none"
			: diffQty === 0
				? "balanced"
				: diffQty < 0
					? "short"
					: "over";

	return {
		methodKey,
		plannedQty,
		actualQty: normalizedActualQty,
		diffQty,
		plannedText,
		actualText,
		diffText: formatPlanDiffSignedNumber(diffQty, formatter),
		summaryText: `计划 ${plannedText} / 本次 ${actualText}`,
		formulaText,
		detailCountText: `${detailRows.length} 条计划明细`,
		tone,
		detailRows
	};
}

function normalizeNullableNumber(value: any) {
	if (value === null || value === undefined || value === "") return null;
	const num = Number(value);
	return Number.isFinite(num) ? num : null;
}

function normalizeArray(value: any) {
	if (Array.isArray(value)) return value;
	if (typeof value !== "string" || !value.trim()) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function normalizePositiveInteger(value: any) {
	const num = Number(value);
	return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
}

function getCloseDialogWarningText() {
	if (totalTempSaves.value === 0 && manualShipSummary.value.segmentCount > 0) {
		return "存在尚未暂存的发货数量，关闭后将丢失本次填写，确认关闭？";
	}
	const syncIssue = getTempSaveSyncIssueSummary();
	if (syncIssue.total > 0) {
		return `存在 ${syncIssue.productCount} 个产品 ${syncIssue.total} 段尚未同步暂存，关闭后将清空本次填写和暂存记录，确认关闭？`;
	}
	if (totalTempSaves.value > 0) {
		return "关闭后将清空本次填写和暂存记录，确认关闭？";
	}
	return "";
}

function confirmCloseDialog(onConfirm: () => void) {
	const warningText = getCloseDialogWarningText();
	if (!warningText) {
		onConfirm();
		return;
	}
	ElMessageBox.confirm(warningText, "关闭批量发货", {
		type: "warning",
		confirmButtonText: "确认关闭",
		cancelButtonText: "继续编辑"
	})
		.then(() => onConfirm())
		.catch(() => undefined);
}

function requestCloseDialog() {
	confirmCloseDialog(() => {
		dialogVisible.value = false;
	});
}

function handleBeforeClose(done: () => void) {
	confirmCloseDialog(done);
}
</script>

<style lang="scss" scoped>
.purchase-plan-batch-ship-dialog {
	display: flex;
	flex-direction: column;
	height: calc(100vh - 4px);
	max-height: calc(100vh - 4px);
	max-width: calc(100vw - 24px);
	margin-bottom: 0;
	overflow: hidden;

	:deep(.el-dialog__header) {
		flex: 0 0 auto;
		padding: 9px 14px 5px;
	}

	:deep(.el-dialog__body) {
		display: flex;
		flex: 1 1 0;
		flex-direction: column;
		min-height: 0;
		padding: 4px 12px 0;
		max-height: none;
		overflow-x: hidden;
		overflow-y: hidden;
	}

	:deep(.el-dialog__footer) {
		flex: 0 0 auto;
		padding: 4px 12px 5px;
	}
}

.batch-dialog-header,
.footer-summary,
.footer-actions,
.dialog-footer,
.order-title,
.order-meta,
.order-ship-control,
.toolbar-left,
.toolbar-right {
	display: flex;
	align-items: center;
}

.batch-dialog-header {
	gap: 10px;
}

.header-title {
	color: var(--el-text-color-primary);
	font-size: 17px;
	font-weight: 700;
}

.batch-ship-content {
	display: flex;
	flex: 1 1 0;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	height: auto;
	min-height: 0;
	overflow-x: hidden;
	overflow-y: hidden;
}

.batch-ship-content,
.batch-ship-content * {
	box-sizing: border-box;
}

.batch-toolbar {
	display: grid;
	grid-template-columns: minmax(720px, 1fr) minmax(280px, 330px);
	align-items: stretch;
	flex: 0 0 auto;
	gap: 0;
	width: 100%;
	min-width: 0;
	min-height: 82px;
	padding: 0;
	overflow: visible;
	border: 1px solid #d9ecff;
	border-radius: 10px;
	background: #f4f9ff;
}

.global-algo-row {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 3px;
	min-width: 0;
	min-height: 82px;
	padding: 4px 8px;
	overflow: visible;
	border: 0;
	border-radius: 0;
	background: transparent;
}

.global-algo-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	min-width: 0;
}

.global-algo-title {
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 800;
	white-space: nowrap;
}

.global-algo-hint {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	white-space: nowrap;
}

.global-algo-body {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.global-algo-select {
	flex: 1 1 128px;
	min-width: 116px;
}

.global-algo-body > .el-button {
	flex: 0 0 auto;
	min-width: 132px;
}

.data-sync-notice {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 4px 8px;
	border: 1px solid #d9ecff;
	border-radius: 8px;
	background: #ecf5ff;
}

.data-sync-notice.is-success {
	border-color: #b3e19d;
	background: #f0f9eb;
}

.data-sync-notice.is-partial_failed {
	border-color: #f3d19e;
	background: #fdf6ec;
}

.data-sync-notice.is-failed {
	border-color: #fab6b6;
	background: #fef0f0;
}

.data-sync-main {
	display: flex;
	align-items: center;
	gap: 9px;
	min-width: 0;
}

.data-sync-title {
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 700;
}

.data-sync-sub {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	margin-top: 3px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.data-sync-sub em {
	margin-left: 4px;
	color: #e6a23c;
	font-style: normal;
}

.data-sync-actions {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	gap: 8px;
}

.batch-items-scroll {
	display: flex;
	flex: 1 1 auto;
	flex-direction: column;
	gap: 6px;
	height: auto;
	min-height: 0;
	max-height: none;
	padding: 4px 6px 5px;
	overflow-x: hidden;
	overflow-y: auto;
	overscroll-behavior: contain;
	border: 1px solid #e4e7ed;
	border-radius: 10px;
	background: #f5f7fb;
}

.batch-item-card {
	position: relative;
	display: grid;
	grid-template-columns: 264px minmax(0, 1fr);
	align-items: stretch;
	gap: 6px;
	width: 100%;
	min-width: 0;
	padding: 7px 8px 7px 12px;
	overflow: visible;
	border: 1px solid #e4e7ed;
	border-radius: 12px;
	background: #fff;
	box-shadow: 0 2px 8px rgba(31, 45, 61, 0.04);
}

.batch-item-card::before {
	position: absolute;
	top: 16px;
	bottom: 16px;
	left: 0;
	width: 4px;
	border-radius: 0 4px 4px 0;
	background: #dcdfe6;
	content: "";
}

.batch-item-card.card-ok::before {
	background: #67c23a;
}

.batch-item-card.card-warn::before {
	background: #e6a23c;
}

.item-product {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	justify-content: center;
	gap: 8px;
	min-width: 0;
	padding: 8px 8px 8px 7px;
	border-right: 1px solid #edf1f7;
	background: linear-gradient(90deg, #fbfdff 0%, #fff 100%);
}

.item-product-main {
	display: grid;
	grid-template-columns: 18px 50px minmax(0, 1fr);
	align-items: center;
	gap: 7px;
	min-width: 0;
}

.item-index {
	flex: 0 0 18px;
	color: #409eff;
	font-size: 14px;
	font-weight: 700;
	text-align: center;
}

.item-image,
.item-img,
.img-placeholder {
	flex: 0 0 50px;
	width: 50px;
	height: 50px;
	border-radius: 8px;
	background: #f5f7fa;
}

.img-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	color: #c0c4cc;
}

.item-info {
	flex: 1 1 auto;
	min-width: 0;
}

.item-name {
	margin-bottom: 4px;
	overflow: hidden;
	color: #303133;
	font-size: 12px;
	font-weight: 700;
	line-height: 1.35;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.item-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 5px 6px;
	color: #909399;
	font-size: 11px;
	line-height: 1.25;
}

.item-meta > span {
	max-width: 150px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.item-trace-entry {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	align-items: stretch;
	gap: 3px;
	width: 100%;
	margin-top: 6px;
	padding: 5px 7px;
	border: 1px solid #d9ecff;
	border-radius: 6px;
	background: #f4f9ff;
	color: #1677ff;
	font-size: 11px;
	line-height: 1.2;
	cursor: pointer;
}

.item-trace-entry:hover {
	border-color: #79bbff;
	background: #ecf5ff;
}

.item-trace-entry:disabled {
	cursor: not-allowed;
	opacity: 0.56;
}

.item-trace-entry span,
.item-trace-entry strong {
	display: flex;
	align-items: center;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.item-trace-entry span {
	gap: 4px;
	font-weight: 700;
}

.item-trace-entry strong {
	width: 100%;
	color: #2454d6;
	font-size: 10.5px;
	font-weight: 700;
}

.item-history-entry {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	gap: 4px;
	width: 100%;
	margin-top: 5px;
	padding: 6px 7px;
	border: 1px solid #c8e6c9;
	border-radius: 6px;
	background: #f6fff4;
	color: #529b2e;
	font-size: 11px;
	line-height: 1.2;
	text-align: left;
	cursor: pointer;
}

.item-history-entry:hover {
	border-color: #95d475;
	background: #f0f9eb;
}

.item-history-entry:disabled {
	cursor: wait;
	opacity: 0.62;
}

.item-history-entry span,
.item-history-entry strong {
	display: flex;
	align-items: center;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.item-history-entry span {
	gap: 4px;
	font-weight: 800;
}

.item-history-entry strong {
	color: #3d8b23;
	font-size: 10.5px;
	font-weight: 800;
}

.item-history-methods {
	display: flex;
	flex-wrap: wrap;
	gap: 3px;
	min-width: 0;
}

.item-history-methods em {
	max-width: 100%;
	padding: 1px 5px;
	overflow: hidden;
	border-radius: 999px;
	background: #e9f7e5;
	color: #529b2e;
	font-size: 10px;
	font-style: normal;
	font-weight: 700;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.item-ship-basis {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	padding: 6px;
	border: 1px solid #d9ecff;
	border-radius: 8px;
	background: #f8fbff;
}

.basis-summary-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 4px;
}

.basis-summary-cell {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-width: 0;
	min-height: 32px;
	border: 1px solid #edf1f7;
	border-radius: 6px;
	background: #fff;
	cursor: default;
}

.basis-summary-cell.is-gap {
	border-color: #ffd8d8;
	background: #fff7f7;
}

.basis-summary-cell.is-actual {
	border-color: #ffd8b6;
	background: #fff8ef;
}

.basis-summary-cell span {
	color: #909399;
	font-size: 10px;
	line-height: 1.15;
}

.basis-summary-cell strong {
	max-width: 100%;
	margin-top: 2px;
	overflow: hidden;
	color: #303133;
	font-size: 12px;
	line-height: 1.15;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.basis-summary-cell.is-gap strong {
	color: #1677ff;
}

.basis-summary-cell.is-actual strong {
	color: #e6a23c;
}

.basis-control-block {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding-top: 2px;
}

.basis-param-editor {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 6px;
	border: 1px solid #e4eaf3;
	border-radius: 7px;
	background: #fff;
}

.basis-param-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-width: 0;
	height: 20px;
}

.basis-param-head span {
	color: #303133;
	font-size: 11px;
	font-weight: 800;
}

.basis-param-row {
	display: grid;
	grid-template-columns: 52px minmax(0, 1fr);
	align-items: center;
	gap: 4px;
	min-width: 0;
	min-height: 26px;
	padding: 2px 4px;
	border: 1px solid #edf1f7;
	border-radius: 5px;
	background: #fbfcfe;
}

.basis-param-row > span {
	min-width: 0;
	overflow: hidden;
	color: #606266;
	font-size: 10.5px;
	font-weight: 700;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.basis-param-row :deep(.el-input-number) {
	width: 100%;
}

.basis-param-row :deep(.el-input__wrapper) {
	min-height: 22px;
	padding-right: 20px;
	padding-left: 5px;
	box-shadow: 0 0 0 1px #dcdfe6 inset;
}

.basis-param-row :deep(.el-input__inner) {
	color: #1677ff;
	font-size: 11px;
	font-weight: 800;
	text-align: center;
}

.basis-param-row :deep(.el-input-number__decrease),
.basis-param-row :deep(.el-input-number__increase) {
	width: 17px;
}

.basis-algo-row {
	display: grid;
	grid-template-columns: 52px minmax(0, 1fr);
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.basis-algo-label {
	display: inline-flex;
	align-items: center;
	justify-content: flex-start;
	width: 100%;
	min-width: 0;
	padding: 0;
	border: 0;
	background: transparent;
	color: #409eff;
	font-size: 11px;
	font-weight: 800;
	line-height: 1.2;
	white-space: nowrap;
	cursor: help;
}

.basis-algo-label:hover {
	color: #1677ff;
	text-decoration: underline;
	text-underline-offset: 2px;
}

.basis-algo-select {
	width: 100%;
}

.basis-pill-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 5px;
}

.basis-info-pill {
	display: inline-flex;
	align-items: center;
	justify-content: space-between;
	gap: 5px;
	min-width: 0;
	min-height: 22px;
	padding: 0 6px;
	border: 1px solid #e4e7ed;
	border-radius: 5px;
	background: #fff;
	color: #606266;
	font-size: 10.5px;
	line-height: 1;
	white-space: nowrap;
}

.basis-info-pill strong {
	min-width: 0;
	overflow: hidden;
	color: #1677ff;
	font-weight: 800;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.basis-info-pill.is-period {
	grid-column: 1 / -1;
}

.basis-period-picker-row {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr);
	align-items: center;
	gap: 5px;
	grid-column: 1 / -1;
	min-width: 0;
	min-height: 22px;
	padding: 0 6px;
	border: 1px solid #e4e7ed;
	border-radius: 5px;
	background: #fff;
	color: #606266;
	font-size: 10.5px;
	line-height: 1;
}

.basis-period-picker-row > span {
	flex: 0 0 auto;
	font-size: 11px;
	font-weight: 800;
	white-space: nowrap;
}

.basis-period-picker {
	min-width: 0;
	width: 100%;
}

.basis-period-picker :deep(.picker-trigger) {
	justify-content: flex-end;
	gap: 3px;
	width: 100%;
	min-width: 0;
	max-width: none;
	height: 20px;
	padding: 0;
	border: 0;
	background: transparent;
	color: #1677ff;
	font-size: 11px;
}

.basis-period-picker :deep(.picker-trigger:hover) {
	border-color: transparent;
}

.basis-period-picker :deep(.trigger-icon) {
	display: none;
}

.basis-period-picker :deep(.trigger-text) {
	justify-content: flex-end;
	gap: 3px;
	color: #1677ff;
	font-size: 11px;
	font-weight: 800;
}

.basis-period-picker :deep(.trigger-days) {
	height: 15px;
	padding: 0 4px;
	font-size: 10px;
	line-height: 15px;
}

.basis-period-picker :deep(.trigger-clear) {
	display: none;
}

.item-analysis {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	overflow: visible;
}

.analysis-data-grid {
	display: grid;
	grid-template-columns:
		minmax(70px, 0.72fr)
		minmax(82px, 0.78fr)
		minmax(118px, 1.05fr)
		minmax(66px, 0.62fr)
		minmax(88px, 0.82fr)
		minmax(92px, 0.86fr)
		minmax(90px, 0.86fr)
		minmax(76px, 0.72fr)
		minmax(112px, 1fr)
		minmax(112px, 1fr);
	min-width: 0;
	padding: 3px 8px;
	overflow: hidden;
	border: 1px solid #ebeef5;
	border-radius: 8px;
	background: #fafbfc;
}

.grid-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-width: 0;
	min-height: 46px;
	padding: 0 7px;
	border-right: 1px solid #ebeef5;
	text-align: center;
}

.grid-item:last-child {
	border-right: 0;
}

.grid-item:nth-child(10n) {
	border-right: 0;
}

.grid-label {
	margin-bottom: 2px;
	color: #909399;
	font-size: 11px;
	line-height: 1.15;
}

.grid-val {
	max-width: 100%;
	min-height: 18px;
	overflow: hidden;
	color: #303133;
	font-size: 12px;
	font-weight: 700;
	line-height: 1.25;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.grid-val.highlight,
.summary-link {
	color: #1677ff;
}

.grid-sub,
.daily-sales-sub {
	margin-top: 2px;
	color: #909399;
	font-size: 10px;
}

.summary-daily-sales {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-width: 0;
	cursor: help;
}

.daily-sales-trigger {
	color: #1677ff;
	font-size: 12px;
	font-weight: 700;
	line-height: 1.25;
}

.inventory-combined {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
}

.summary-link {
	border-bottom: 1px dashed currentColor;
	cursor: help;
}

.trace-field-trigger {
	width: fit-content;
	max-width: 100%;
	margin: 0 auto;
	border-bottom: 1px dashed #1677ff;
	cursor: help;
}

.trace-field-mini {
	min-width: 0;
	max-height: inherit;
	overflow-y: auto;
	overscroll-behavior: contain;
	color: #303133;
	font-size: 12px;
	scrollbar-width: thin;
}

.trace-field-mini .daily-sales-tooltip-panel.is-trace-merged {
	width: 100%;
	padding: 0;
	border: 0;
	box-shadow: none;
}

.trace-field-divider {
	height: 1px;
	margin: 10px 0 8px;
	background: #ebeef5;
}

.trace-field-mini-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 6px;
}

.trace-field-mini-head strong {
	font-size: 13px;
}

.trace-field-source {
	margin-bottom: 8px;
	padding: 5px 7px;
	overflow: hidden;
	border-radius: 5px;
	background: #f5f7fa;
	color: #606266;
	font-size: 11px;
	line-height: 1.25;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-field-mini-rows {
	display: grid;
	gap: 5px;
	margin-bottom: 6px;
}

.trace-field-mini-row {
	display: grid;
	grid-template-columns: 54px minmax(0, 1fr);
	align-items: center;
	gap: 8px;
	min-height: 26px;
	padding: 4px 7px;
	border: 1px solid #edf1f7;
	border-radius: 5px;
	background: #fff;
}

.trace-field-mini-row span {
	color: #909399;
}

.trace-field-mini-row strong {
	min-width: 0;
	overflow: hidden;
	color: #303133;
	font-weight: 700;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-field-record-table {
	width: 100%;
	border-collapse: separate;
	border-spacing: 0 5px;
	table-layout: fixed;
	font-size: 11px;
}

.trace-field-record-table th {
	padding: 0 6px 2px;
	color: #909399;
	font-weight: 600;
	text-align: left;
}

.trace-field-record-table th:nth-child(1),
.trace-field-record-table td:nth-child(1) {
	width: 30%;
}

.trace-field-record-table th:nth-child(2),
.trace-field-record-table td:nth-child(2) {
	width: 17%;
}

.trace-field-record-table th:nth-child(3),
.trace-field-record-table td:nth-child(3) {
	width: 20%;
}

.trace-field-record-table th:nth-child(4),
.trace-field-record-table td:nth-child(4) {
	width: 13%;
}

.trace-field-record-table th:nth-child(5),
.trace-field-record-table td:nth-child(5) {
	width: 20%;
}

.trace-field-record-table td {
	padding: 6px 7px;
	overflow: hidden;
	background: #f8fafc;
	color: #303133;
	line-height: 1.25;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-field-record-table td:first-child {
	border-radius: 5px 0 0 5px;
}

.trace-field-record-table td:last-child {
	border-radius: 0 5px 5px 0;
}

.trace-field-record-table tr.is-current-source td {
	background: #f3f9ff;
}

.trace-field-record-table button {
	max-width: 100%;
	padding: 0;
	overflow: hidden;
	border: 0;
	background: transparent;
	color: #1677ff;
	font: inherit;
	font-weight: 700;
	text-align: left;
	text-overflow: ellipsis;
	white-space: nowrap;
	cursor: pointer;
}

.trace-field-record-table button:disabled {
	color: #c0c4cc;
	cursor: not-allowed;
}

.trace-field-plan-cell,
.trace-field-period-cell,
.trace-field-creator-cell,
.trace-field-value-cell,
.trace-field-order-cell {
	line-height: 1.25;
}

.trace-field-plan-cell button,
.trace-field-static-plan,
.trace-field-plan-cell em,
.trace-field-period-cell span,
.trace-field-period-cell em,
.trace-field-creator-cell span,
.trace-field-creator-cell em,
.trace-field-value-cell strong,
.trace-field-value-cell button,
.trace-field-order-cell span,
.trace-field-order-cell em {
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-field-static-plan {
	color: #1677ff;
	font-weight: 800;
}

.trace-field-plan-cell em,
.trace-field-period-cell em,
.trace-field-creator-cell em,
.trace-field-order-cell em {
	margin-top: 2px;
	color: #909399;
	font-style: normal;
	font-size: 10.5px;
}

.trace-field-order-cell span {
	color: #303133;
	font-weight: 700;
}

.trace-field-value-cell strong {
	color: #303133;
	font-weight: 700;
}

.trace-field-footer {
	position: sticky;
	bottom: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-top: 7px;
	padding-top: 7px;
	border-top: 1px solid #ebeef5;
	background: #fff;
	color: #909399;
	font-size: 11px;
	line-height: 1.25;
}

.trace-field-footer span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.rating-combined {
	display: block;
	width: 100%;
	min-height: 36px;
	padding-top: 0;
	border-bottom: 0;
}

.rating-mini-table {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
	color: #606266;
	font-size: 9.5px;
	line-height: 1.15;
}

.rating-mini-table th,
.rating-mini-table td {
	padding: 1px 2px;
	overflow: hidden;
	text-align: center;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.rating-mini-table th {
	color: #909399;
	font-weight: 600;
}

.rating-mini-delta.is-up {
	color: #f56c6c;
}

.rating-mini-delta.is-down {
	color: #67c23a;
}

.box-pcs-value {
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.ship-analysis-panel {
	--ship-layout-gap: 7px;
	--ship-method-gap: 8px;
	--ship-method-min-width: 112px;
	--ship-method-padding-x: 10px;
	--ship-side-width: 236px;
	--ship-layout-min-width: 975px;
	min-width: 0;
	padding: 5px;
	overflow: visible;
	border: 1px solid #ebeef5;
	border-radius: 8px;
	background: #fafbfc;
}

.shipping-layout-scroll {
	min-width: 0;
	overflow-x: auto;
	overflow-y: hidden;
	scrollbar-gutter: stable;
	scrollbar-width: thin;
}

.shipping-layout-canvas {
	min-width: var(--ship-layout-min-width);
}

.panel-top {
	display: flex;
	align-items: stretch;
	gap: 7px;
	min-width: 0;
	margin-bottom: 6px;
	padding-bottom: 6px;
	border-bottom: 1px dashed #e4e7ed;
}

.combined-formula-panel {
	display: grid;
	grid-template-columns: 82px minmax(0, 1fr);
	flex: 1 1 auto;
	gap: 6px;
	min-width: 0;
}

.cf-mini-metrics {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 5px;
	border: 1px dashed #d9ecff;
	border-radius: 6px;
	background: #f8fbff;
}

.cf-mini-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 30px;
	border: 1px solid #edf1f7;
	border-radius: 5px;
	background: #fff;
}

.cf-mini-item span {
	color: #909399;
	font-size: 10px;
}

.cf-mini-item strong {
	margin-top: 2px;
	color: #303133;
	font-size: 12px;
}

.cf-formula-box {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 4px;
	min-width: 0;
	padding: 5px;
	border: 1px solid #d9ecff;
	border-radius: 6px;
	background: #f8fbff;
}

.cf-line {
	display: flex;
	align-items: center;
	gap: 8px;
	min-height: 23px;
	padding: 3px 8px;
	overflow: hidden;
	border: 1px solid #d9ecff;
	border-radius: 5px;
	background: #fff;
	color: #606266;
	font-size: 11px;
}

.cf-line.is-actual {
	border-color: #ffd8b6;
	background: #fff8ef;
}

.cf-main {
	flex: 0 0 auto;
	white-space: nowrap;
}

.cf-main strong {
	color: #409eff;
	font-size: 13px;
}

.cf-line.is-actual .cf-main strong {
	color: #e6a23c;
}

.cf-expression {
	flex: 1 1 auto;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.panel-actions {
	display: flex;
	flex: 0 0 286px;
	flex-direction: column;
	justify-content: center;
	gap: 6px;
	padding: 7px 10px;
	border: 1px solid #dcdfe6;
	border-radius: 6px;
	background: #fff;
}

.pa-row {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.pa-row-tags {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 5px;
}

.pa-info-pill {
	display: inline-flex;
	align-items: center;
	justify-content: space-between;
	gap: 5px;
	min-width: 0;
	min-height: 24px;
	padding: 0 7px;
	border: 1px solid #e4e7ed;
	border-radius: 5px;
	background: #fbfcfe;
	color: #606266;
	font-size: 11px;
	line-height: 1;
	white-space: nowrap;
}

.pa-info-pill strong {
	min-width: 0;
	overflow: hidden;
	color: #1677ff;
	font-weight: 800;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pa-source-trigger {
	display: inline-flex;
	grid-column: 1 / -1;
	align-items: center;
	justify-content: space-between;
	gap: 5px;
	width: 100%;
	min-height: 24px;
	padding: 0 7px;
	border: 1px solid #d9ecff;
	border-radius: 5px;
	background: #f8fbff;
	color: #409eff;
	font: inherit;
	line-height: 1.2;
	cursor: help;
}

.pa-source-trigger:hover {
	border-color: #79bbff;
	background: #ecf5ff;
}

.pa-source-trigger.is-success {
	border-color: #b3e19d;
	background: #f6ffef;
	color: #529b2e;
}

.pa-source-trigger.is-warning {
	border-color: #f3d19e;
	background: #fffaf0;
	color: #b88230;
}

.pa-source-trigger span {
	flex: 0 0 auto;
	font-size: 11px;
	font-weight: 700;
	white-space: nowrap;
}

.pa-source-trigger strong {
	flex: 1 1 auto;
	min-width: 0;
	overflow: hidden;
	font-size: 11px;
	font-weight: 800;
	text-align: right;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pa-label {
	color: #409eff;
	font-weight: 700;
	white-space: nowrap;
}

.pa-algo-select {
	width: 132px;
}

.trace-distribution-panel {
	margin-bottom: 5px;
	padding: 5px 0 0;
	overflow: hidden;
	border: 0;
	border-radius: 8px;
	background: #f8fbff;
	box-shadow: inset 0 0 0 1px #d9ecff;
}

.trace-distribution-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 4px;
	padding: 0 7px;
}

.trace-distribution-head > div {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.trace-distribution-head strong {
	color: #303133;
	font-size: 12px;
	font-weight: 800;
}

.trace-distribution-head span {
	color: #909399;
	font-size: 11px;
}

.trace-distribution-table {
	width: 100%;
	min-width: 0;
}

.trace-distribution-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) var(--ship-side-width);
	gap: var(--ship-layout-gap);
	min-width: 0;
	padding: 2px 0;
	border-radius: 7px;
}

.trace-distribution-row.is-header {
	position: sticky;
	top: 0;
	z-index: 1;
	overflow: hidden;
	padding-top: 2px;
	padding-bottom: 2px;
	background: #edf5ff;
	color: #606266;
	font-size: 11px;
	font-weight: 700;
	scrollbar-gutter: stable;
	scrollbar-width: thin;
}

.trace-distribution-body {
	display: flex;
	flex-direction: column;
	gap: 3px;
	max-height: 146px;
	overflow-y: auto;
	scrollbar-gutter: stable;
	scrollbar-width: thin;
}

.trace-distribution-body .trace-distribution-row {
	border-top: 1px solid #e4eaf3;
	background: #fff;
}

.trace-distribution-body .trace-distribution-row.is-current {
	border-color: #67c23a;
	background: #f3ffef;
}

.trace-distribution-body .trace-distribution-row.is-default {
	border-color: #f3d19e;
	background: #fffaf2;
}

.trace-method-grid {
	display: grid;
	grid-template-columns: repeat(6, minmax(var(--ship-method-min-width), 1fr));
	gap: var(--ship-method-gap);
	min-width: 0;
	padding-right: var(--ship-method-padding-x);
	padding-left: var(--ship-method-padding-x);
}

.trace-record-summary-cell {
	display: flex;
	min-width: 0;
	padding: 2px 6px;
	border-left: 1px solid #e4eaf3;
	background: rgb(255 255 255 / 58%);
}

.trace-record-summary-cell.is-header {
	align-items: center;
	justify-content: center;
	background: transparent;
	color: #606266;
	font-size: 11px;
	font-weight: 700;
}

.trace-record-cell {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 66px;
	align-items: stretch;
	gap: 4px;
	width: 100%;
	min-width: 0;
}

.trace-record-main {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 1px;
	min-width: 0;
	padding: 1px 3px;
	border-radius: 4px;
	cursor: help;
	transition:
		background 0.16s ease,
		box-shadow 0.16s ease;
}

.trace-record-main:hover {
	background: #f5f9ff;
	box-shadow: 0 0 0 1px #d9ecff inset;
}

.trace-record-cell button {
	width: fit-content;
	max-width: 100%;
	padding: 0;
	overflow: hidden;
	border: 0;
	background: transparent;
	color: #1677ff;
	font-size: 12px;
	font-weight: 800;
	text-overflow: ellipsis;
	white-space: nowrap;
	cursor: pointer;
}

.trace-record-cell span,
.trace-record-cell em,
.trace-record-cell small {
	min-width: 0;
	overflow: hidden;
	color: #606266;
	font-size: 10.5px;
	font-style: normal;
	line-height: 1.25;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-record-cell .trace-record-algo {
	color: #303133;
	font-weight: 700;
}

.trace-record-cell em {
	color: #1677ff;
	font-weight: 700;
}

.trace-record-remark {
	display: flex;
	align-self: stretch;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 2px;
	min-width: 0;
	max-width: 100%;
	min-height: 42px;
	padding: 3px;
	border: 1px solid #ebeef5;
	border-radius: 5px;
	background: #f5f7fa;
	color: #909399;
	text-align: center;
	cursor: default;
}

.trace-record-remark.has-content {
	border-color: #f3d19e;
	background: #fff8eb;
	color: #b26a00;
	cursor: help;
}

.trace-record-cell .trace-record-remark span {
	flex: 0 0 auto;
	overflow: visible;
	color: inherit;
	font-size: 10px;
	font-weight: 700;
	line-height: 1;
}

.trace-record-cell .trace-record-remark em {
	display: -webkit-box;
	min-width: 0;
	max-width: 100%;
	overflow: hidden;
	color: inherit;
	font-size: 10px;
	font-weight: 500;
	line-height: 1.25;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	white-space: normal;
	word-break: break-word;
}

:global(.trace-record-summary-popover) {
	max-width: min(420px, calc(100vw - 32px));
}

.trace-record-summary-popover-panel {
	max-height: 320px;
	overflow-y: auto;
	color: #303133;
	font-size: 12px;
	line-height: 1.45;
	scrollbar-gutter: stable;
	scrollbar-width: thin;
}

.trace-record-summary-popover-panel > strong {
	display: block;
	margin-bottom: 7px;
	color: #303133;
	font-size: 13px;
}

.trace-record-summary-popover-grid {
	display: grid;
	grid-template-columns: 72px minmax(0, 1fr);
	gap: 1px 8px;
	min-width: 300px;
}

.trace-record-summary-popover-grid span,
.trace-record-summary-popover-grid em,
.trace-record-summary-popover-grid .trace-record-summary-link {
	padding: 3px 0;
	border-bottom: 1px solid #f0f2f5;
	font-style: normal;
	word-break: break-word;
}

.trace-record-summary-popover-grid span {
	color: #909399;
}

.trace-record-summary-popover-grid em {
	color: #303133;
	font-weight: 700;
}

.trace-record-summary-link {
	width: fit-content;
	max-width: 100%;
	border: 0;
	background: transparent;
	color: #1677ff;
	font-size: 12px;
	font-weight: 800;
	text-align: left;
	cursor: pointer;
}

.trace-record-summary-link:hover {
	color: #409eff;
	text-decoration: underline;
}

.trace-record-summary-popover-actions {
	display: flex;
	justify-content: flex-end;
	margin-top: 7px;
}

:global(.trace-record-remark-tooltip) {
	max-width: min(420px, calc(100vw - 32px));
}

.trace-record-remark-tooltip-panel {
	max-height: 220px;
	overflow-y: auto;
	color: #303133;
	font-size: 12px;
	line-height: 1.55;
	scrollbar-gutter: stable;
	scrollbar-width: thin;
}

.trace-record-remark-tooltip-panel strong {
	display: block;
	margin-bottom: 5px;
	color: #b26a00;
	font-size: 12px;
}

.trace-record-remark-tooltip-panel p {
	margin: 0;
	white-space: pre-wrap;
	word-break: break-word;
}

.trace-method-header {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	min-width: 0;
	font-size: 11px;
	text-align: center;
	white-space: nowrap;
}

.trace-method-header-name {
	flex: 0 1 auto;
	min-width: 0;
	overflow: hidden;
	color: #303133;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-method-header-summary {
	flex: 0 0 auto;
	color: var(--method-color, #409eff);
	font-size: 10px;
	font-weight: 800;
	line-height: 1;
	white-space: nowrap;
}

.trace-method-header.is-empty .trace-method-header-summary {
	color: #a8abb2;
	font-weight: 600;
}

.trace-method-header-tooltip-panel {
	min-width: 260px;
	max-width: 320px;
	color: #303133;
	font-size: 12px;
}

.trace-method-header-tooltip-title {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 8px;
}

.trace-method-header-tooltip-title strong {
	min-width: 0;
	overflow: hidden;
	font-size: 13px;
	font-weight: 800;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-method-header-tooltip-title span {
	flex: 0 0 auto;
	color: #909399;
	font-size: 11px;
}

.trace-method-header-tooltip-metrics {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 6px;
}

.trace-method-header-tooltip-metrics div {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-width: 0;
	min-height: 28px;
	padding: 0 8px;
	border-radius: 5px;
	background: #f5f8fc;
}

.trace-method-header-tooltip-metrics span,
.trace-method-header-tooltip-line span {
	min-width: 0;
	overflow: hidden;
	color: #909399;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-method-header-tooltip-metrics strong {
	color: #1677ff;
	font-size: 13px;
	font-weight: 800;
	white-space: nowrap;
}

.trace-method-header-tooltip-sub {
	margin-top: 7px;
	color: #909399;
	font-size: 11px;
	line-height: 1.35;
}

.trace-method-header-tooltip-source-title {
	margin-top: 9px;
	margin-bottom: 4px;
	color: #606266;
	font-size: 11px;
	font-weight: 800;
}

.trace-method-header-tooltip-lines {
	display: flex;
	flex-direction: column;
	gap: 4px;
	max-height: 132px;
	overflow-y: auto;
	color: #606266;
	line-height: 1.35;
	scrollbar-gutter: stable;
	scrollbar-width: thin;
}

.trace-method-header-tooltip-line {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto auto;
	align-items: center;
	gap: 8px;
	min-height: 24px;
	padding: 0 7px;
	border-radius: 4px;
	background: #fafcff;
}

.trace-method-header-tooltip-line strong {
	color: #303133;
	font-weight: 800;
	white-space: nowrap;
}

.trace-method-header-tooltip-line em {
	color: #1677ff;
	font-size: 11px;
	font-style: normal;
	font-weight: 700;
	white-space: nowrap;
}

.trace-method-cell {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 1px;
	width: 100%;
	min-height: 46px;
	padding: 2px 4px;
	border: 1px solid #dcdfe6;
	border-radius: 6px;
	background: #fff;
	color: #606266;
	text-align: center;
	cursor: pointer;
}

.trace-method-cell.is-ship {
	border-color: color-mix(in srgb, var(--method-color, #409eff) 52%, #dcdfe6);
	background: color-mix(in srgb, var(--method-color, #409eff) 8%, #fff);
	color: var(--method-color, #409eff);
}

.trace-method-cell.is-zero {
	border-color: #dfe6f2;
	background: #f8fafc;
}

.trace-method-cell.is-inactive,
.trace-method-cell.is-outside {
	border-style: dashed;
	background: #f7f8fa;
	color: #909399;
}

.trace-method-cell.is-focused {
	box-shadow: 0 0 0 2px rgb(64 158 255 / 20%);
}

.trace-method-cell span,
.trace-method-cell em,
.trace-method-cell small {
	max-width: 100%;
	overflow: hidden;
	font-size: 10px;
	font-style: normal;
	line-height: 1.15;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-method-cell strong {
	color: #303133;
	font-size: 15px;
	font-weight: 900;
	line-height: 1.1;
}

.trace-method-tooltip-panel {
	max-width: 620px;
	max-height: 430px;
	overflow-y: auto;
	color: #303133;
	font-size: 12px;
}

.trace-method-tooltip-head,
.trace-method-tooltip-summary {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 8px;
}

.trace-method-tooltip-summary {
	flex-wrap: wrap;
	justify-content: flex-start;
	padding: 6px;
	border-radius: 6px;
	background: #f8fafc;
}

.trace-method-tooltip-summary span {
	color: #606266;
}

.trace-method-tooltip-summary strong {
	color: #1677ff;
}

.trace-method-month-table,
.trace-method-formula-list {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.trace-method-month-row {
	display: grid;
	grid-template-columns: 42px 34px 52px 44px 52px;
	align-items: center;
	gap: 5px;
	min-height: 24px;
	padding: 0 6px;
	border-radius: 5px;
	background: #fbfdff;
	text-align: center;
}

.trace-method-month-row.is-combined {
	grid-template-columns: 42px 34px 44px 44px 52px 44px 52px;
}

.trace-method-month-row.is-header {
	background: #edf2f8;
	color: #909399;
	font-weight: 700;
}

.trace-method-month-row strong {
	color: #1677ff;
}

.trace-method-formula-list {
	margin-top: 7px;
}

.trace-method-formula-list div,
.trace-method-empty {
	padding: 5px 7px;
	border-radius: 5px;
	background: #f8fafc;
	color: #606266;
	font-size: 11px;
	line-height: 1.35;
}

.analysis-main-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) var(--ship-side-width);
	align-items: stretch;
	gap: var(--ship-layout-gap);
	width: 100%;
	min-width: 0;
	overflow-y: auto;
	scrollbar-gutter: stable;
	scrollbar-width: thin;
}

.shipping-workbench-main {
	display: flex;
	flex-direction: column;
	min-width: 0;
	overflow: hidden;
	border-radius: 7px;
	background: #fff;
	box-shadow: inset 0 0 0 1px #e4e7ed;
}

.panel-bottom {
	display: grid;
	grid-template-columns: repeat(6, minmax(var(--ship-method-min-width), 1fr));
	align-items: stretch;
	gap: var(--ship-method-gap);
	min-height: 0;
	min-width: 0;
	padding: 6px var(--ship-method-padding-x) 4px;
	overflow: hidden;
	border: 0;
	border-radius: 7px 7px 0 0;
	background: transparent;
	box-shadow: none;
}

.shipping-plan-diff-row {
	display: grid;
	grid-template-columns: repeat(6, minmax(var(--ship-method-min-width), 1fr));
	align-items: center;
	gap: var(--ship-method-gap);
	min-width: 0;
	padding: 3px var(--ship-method-padding-x) 5px;
	border-top: 1px dashed #edf0f5;
	background: #fff;
}

.shipping-plan-diff-cell {
	min-width: 0;
}

.si-col {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	gap: 3px;
	min-width: 0;
	min-height: 0;
	padding: 5px 6px 4px;
	overflow: hidden;
	border: 1px solid #edf0f5;
	border-radius: 6px;
	background: #fafbfc;
	box-shadow: none;
}

.si-col.is-disabled {
	opacity: 0.82;
}

.si-col.is-active {
	border-color: #edf0f5;
	box-shadow: none;
}

.si-col.is-global-disabled {
	border-style: dashed;
	background: #f7f8fa;
	box-shadow: none;
}

.si-col.is-trace-focused {
	outline: none;
}

.method-toggle-checkbox {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	min-width: 0;
	height: 18px;
	margin: 0;
}

.method-toggle-checkbox :deep(.el-checkbox__label) {
	display: flex;
	justify-content: center;
	flex: 1 1 auto;
	min-width: 0;
	padding-left: 5px;
}

.si-tag {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	max-width: 100%;
	min-height: 20px;
	padding: 1px 9px;
	overflow: hidden;
	border: 1px solid transparent;
	border-radius: 10px;
	font-size: 12px;
	font-weight: 700;
	line-height: 1.15;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.alpha-date-range {
	min-height: 14px;
	color: #303133;
	font-size: 11px;
	line-height: 1.2;
	text-align: center;
	cursor: help;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.alpha-info-compact {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	width: 100%;
	white-space: nowrap;
	line-height: 1;
}

.alpha-sys-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 3px;
	max-width: 100%;
	padding: 1px 5px;
	overflow: hidden;
	border: 1px solid #d9ecff;
	border-radius: 3px;
	background: #ecf5ff;
	color: #409eff;
	font-size: 10px;
	font-weight: 600;
	line-height: 1.2;
	text-overflow: ellipsis;
	white-space: nowrap;
	cursor: pointer;
	user-select: none;
	transition: all 0.2s;
}

.alpha-sys-badge:hover {
	background: #d9ecff;
}

.alpha-sys-badge.is-user {
	border-color: #f5dab1;
	background: #fdf6ec;
	color: #e6a23c;
}

.alpha-sys-badge.is-user:hover {
	background: #faecd8;
}

.alpha-sys-badge .badge-mode,
.alpha-sys-badge .badge-toggle-icon {
	font-size: 9px;
	opacity: 0.8;
}

.alpha-manual-row {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 3px;
	width: 100%;
	cursor: help;
}

.alpha-manual-label {
	flex: 0 0 auto;
	color: #e6a23c;
	font-size: 10px;
	font-weight: 600;
	white-space: nowrap;
}

.alpha-manual-row :deep(.el-input-number) {
	width: 80px !important;
	min-width: 0;
}

.alpha-manual-row :deep(.el-input__wrapper) {
	min-height: 20px;
	padding-left: 4px;
	padding-right: 18px;
}

.alpha-manual-row :deep(.el-input__inner) {
	color: #e6a23c;
	font-size: 11px;
	font-weight: 600;
	text-align: center;
}

.alpha-manual-row :deep(.el-input-number__decrease),
.alpha-manual-row :deep(.el-input-number__increase) {
	width: 16px;
}

.si-decision {
	display: flex;
	flex: 0 0 58px;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 2px;
	height: 58px;
	min-height: 58px;
	padding: 4px 6px;
	border: 1px solid #dcdfe6;
	border-radius: 7px;
	background: #fff;
	text-align: center;
	cursor: help;
}

.si-decision span {
	color: #606266;
	font-size: 11px;
	font-weight: 800;
	line-height: 1.15;
}

.si-decision strong {
	color: #303133;
	font-size: 20px;
	font-weight: 900;
	line-height: 1.1;
}

.si-decision em {
	max-width: 100%;
	overflow: visible;
	color: #909399;
	font-size: 10px;
	font-style: normal;
	line-height: 1.2;
	white-space: normal;
}

.si-decision.is-ship {
	border-color: #ffcf9f;
	background: linear-gradient(180deg, #fff7ed 0%, #fff 100%);
}

.si-decision.is-ship span,
.si-decision.is-ship strong {
	color: #e67e22;
}

.si-decision.is-covered {
	border-color: #c8ebbe;
	background: linear-gradient(180deg, #f6ffef 0%, #fff 100%);
}

.si-decision.is-covered span,
.si-decision.is-covered strong {
	color: #3f9d21;
}

.si-decision.is-blocked {
	border-color: #ffd8d8;
	background: linear-gradient(180deg, #fff5f5 0%, #fff 100%);
}

.si-decision.is-blocked span,
.si-decision.is-blocked strong {
	color: #f56c6c;
}

.si-decision.is-outside,
.si-decision.is-disabled {
	border-color: #e4e7ed;
	background: #f8fafc;
}

.si-decision.is-error {
	border-color: #fab6b6;
	background: #fef0f0;
}

.si-decision.is-error span,
.si-decision.is-error strong {
	color: #f56c6c;
}

.si-manual-row {
	display: flex;
	align-items: center;
	gap: 4px;
	min-width: 0;
}

.si-manual-row > span {
	flex: 0 0 auto;
	color: #606266;
	font-size: 10.5px;
	font-weight: 700;
	white-space: nowrap;
}

.method-manual-input {
	flex: 1 1 auto;
	min-width: 0;
}

.shipping-quantity-input {
	width: 100%;
}

.shipping-quantity-input :deep(.el-input__wrapper) {
	min-height: 22px;
	background: #fff;
}

.method-manual-input :deep(.el-input__wrapper) {
	min-height: 22px;
	background: #fff;
}

.shipping-quantity-input :deep(.el-input__inner) {
	font-weight: 800;
	text-align: center;
}

.ship-plan-diff-line {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 2px;
	width: 100%;
	min-height: 30px;
	padding: 2px 5px;
	overflow: hidden;
	border: 1px solid #e4e7ed;
	border-radius: 5px;
	background: #fff;
	color: #909399;
	font-size: 10.5px;
	font-family: inherit;
	line-height: 1.2;
	cursor: help;
	transition:
		border-color 0.16s ease,
		box-shadow 0.16s ease,
		background-color 0.16s ease;
}

.ship-plan-diff-line:hover {
	box-shadow: 0 2px 7px rgb(64 158 255 / 12%);
}

.ship-plan-diff-main,
.ship-plan-diff-sub {
	min-width: 0;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-plan-diff-main {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	width: 100%;
}

.ship-plan-diff-main span {
	font-weight: 700;
}

.ship-plan-diff-main strong {
	font-size: 11px;
	font-weight: 900;
}

.ship-plan-diff-main em {
	flex: 0 0 auto;
	padding: 1px 4px;
	border-radius: 4px;
	background: rgb(255 255 255 / 72%);
	font-size: 9px;
	font-style: normal;
	font-weight: 800;
}

.ship-plan-diff-sub {
	display: block;
	width: 100%;
	font-size: 9.5px;
	font-weight: 700;
	opacity: 0.78;
}

.ship-plan-diff-line.is-short {
	border-color: #f5dab1;
	background: #fff8ed;
	color: #b88230;
}

.ship-plan-diff-line.is-over {
	border-color: #c6e2ff;
	background: #f5faff;
	color: #1677ff;
}

.ship-plan-diff-line.is-balanced {
	border-color: #d9f2cc;
	background: #f7fff2;
	color: #529b2e;
}

.ship-plan-diff-line.is-none {
	color: #a8abb2;
	cursor: default;
}

:global(.ship-plan-diff-tooltip) {
	max-width: min(430px, calc(100vw - 32px));
	padding: 10px 12px !important;
}

.ship-plan-diff-panel {
	width: min(390px, calc(100vw - 56px));
	color: #303133;
	font-size: 12px;
	line-height: 1.35;
}

.ship-plan-diff-head {
	display: flex;
	flex-direction: column;
	gap: 2px;
	margin-bottom: 8px;
}

.ship-plan-diff-head strong {
	font-size: 13px;
	font-weight: 800;
}

.ship-plan-diff-head span {
	color: #909399;
}

.ship-plan-diff-formula {
	display: grid;
	grid-template-columns: 38px minmax(0, 1fr);
	gap: 2px 8px;
	margin-bottom: 8px;
	padding: 7px 8px;
	border: 1px solid #edf0f5;
	border-radius: 6px;
	background: #f8fafc;
}

.ship-plan-diff-formula span {
	color: #909399;
	font-weight: 800;
}

.ship-plan-diff-formula strong,
.ship-plan-diff-formula em {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-plan-diff-formula strong {
	color: #303133;
	font-size: 12px;
}

.ship-plan-diff-formula em {
	grid-column: 2;
	color: #909399;
	font-size: 11px;
	font-style: normal;
}

.ship-plan-diff-formula.is-short strong,
.ship-plan-diff-formula.is-short em {
	color: #b88230;
}

.ship-plan-diff-formula.is-over strong,
.ship-plan-diff-formula.is-over em {
	color: #1677ff;
}

.ship-plan-diff-formula.is-balanced strong,
.ship-plan-diff-formula.is-balanced em {
	color: #529b2e;
}

.ship-plan-diff-summary {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 5px;
	margin-bottom: 8px;
}

.ship-plan-diff-summary div {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-width: 0;
	min-height: 42px;
	padding: 4px;
	border: 1px solid #edf0f5;
	border-radius: 6px;
	background: #fbfdff;
}

.ship-plan-diff-summary span {
	color: #909399;
	font-size: 11px;
}

.ship-plan-diff-summary strong {
	color: #303133;
	font-size: 14px;
	font-weight: 900;
}

.ship-plan-diff-summary .is-short strong {
	color: #b88230;
}

.ship-plan-diff-summary .is-over strong {
	color: #1677ff;
}

.ship-plan-diff-summary .is-balanced strong {
	color: #529b2e;
}

.ship-plan-diff-detail {
	display: flex;
	flex-direction: column;
	gap: 2px;
	max-height: 190px;
	overflow-y: auto;
	scrollbar-gutter: stable;
	scrollbar-width: thin;
}

.ship-plan-diff-detail-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 78px 60px 46px;
	align-items: center;
	gap: 6px;
	min-height: 28px;
	padding: 3px 6px;
	border-radius: 5px;
	background: #fbfdff;
}

.ship-plan-diff-detail-row.is-header {
	min-height: 22px;
	background: #edf2f8;
	color: #909399;
	font-size: 11px;
	font-weight: 800;
}

.ship-plan-diff-detail-row span,
.ship-plan-diff-detail-row strong,
.ship-plan-diff-detail-row em {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-plan-diff-detail-row > span:first-child {
	display: flex;
	flex-direction: column;
	gap: 1px;
}

.ship-plan-diff-detail-row span strong {
	color: #1677ff;
	font-size: 11px;
}

.ship-plan-diff-detail-row em {
	color: #909399;
	font-size: 10px;
	font-style: normal;
}

.ship-plan-diff-detail-row > strong {
	color: #303133;
	text-align: right;
}

.ship-plan-diff-empty {
	padding: 8px;
	border-radius: 6px;
	background: #f8fafc;
	color: #909399;
	text-align: center;
}

.si-transfer-notice {
	overflow: hidden;
	padding: 2px 5px;
	border-radius: 5px;
	background: #f0f9eb;
	color: #67c23a;
	font-size: 10px;
	font-weight: 700;
	line-height: 1.2;
	text-align: center;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.si-transfer-notice.is-out {
	background: #fff7ed;
	color: #e6a23c;
}

.si-transfer-notice.is-locked {
	background: #f4f8ff;
	color: #409eff;
}

.method-manual-input :deep(.el-input-number__decrease),
.method-manual-input :deep(.el-input-number__increase) {
	width: 17px;
}

.si-manual-delta {
	padding: 2px 5px;
	border-radius: 5px;
	background: #f4f8ff;
	color: #409eff;
	font-size: 10px;
	font-weight: 700;
	line-height: 1.2;
	text-align: center;
}

.si-manual-delta.is-warning {
	background: #fff7ed;
	color: #e6a23c;
}

.si-business-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 4px;
}

.si-business-grid span {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-width: 0;
	min-height: 32px;
	padding: 3px 4px;
	border-radius: 5px;
	background: #f8fafc;
	line-height: 1.12;
	text-align: center;
}

.si-business-grid em {
	color: #909399;
	font-size: 9.5px;
	font-style: normal;
	white-space: nowrap;
}

.si-business-grid strong {
	max-width: 100%;
	overflow: hidden;
	color: #303133;
	font-size: 11.5px;
	font-weight: 900;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.segment-coeff-chip {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	width: 100%;
	min-height: 20px;
	padding: 1px 5px;
	border: 1px solid #d9ecff;
	border-radius: 5px;
	background: #f8fbff;
	color: #1677ff;
	cursor: pointer;
}

.segment-coeff-chip span {
	font-size: 10px;
	font-weight: 700;
}

.segment-coeff-chip strong {
	font-size: 11px;
	font-weight: 800;
	line-height: 1;
}

.segment-coeff-chip em {
	font-size: 10px;
	font-style: normal;
	font-weight: 700;
	opacity: 0.82;
}

.segment-coeff-chip.is-manual {
	border-color: #f3d19e;
	background: #fff7ed;
	color: #e6a23c;
}

.segment-coeff-chip.is-history {
	border-color: #b3e19d;
	background: #f0f9eb;
	color: #3f9d21;
}

.segment-coeff-chip.is-daily {
	color: #606266;
}

.segment-coeff-manual-row {
	display: flex;
	align-items: center;
	gap: 3px;
	min-width: 0;
}

.segment-coeff-manual-row > span {
	flex: 0 0 auto;
	color: #e6a23c;
	font-size: 10px;
	font-weight: 700;
	white-space: nowrap;
}

.segment-coeff-manual-row :deep(.el-input-number) {
	flex: 1 1 auto;
	width: auto;
	min-width: 0;
}

.segment-coeff-manual-row :deep(.el-input__wrapper) {
	min-height: 22px;
	padding-left: 4px;
	padding-right: 18px;
}

.segment-coeff-manual-row :deep(.el-input__inner) {
	color: #e6a23c;
	font-size: 11px;
	font-weight: 800;
	text-align: center;
}

.segment-coeff-manual-row :deep(.el-input-number__decrease),
.segment-coeff-manual-row :deep(.el-input-number__increase) {
	width: 16px;
}

.ship-demand-info {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 1px;
	width: 100%;
	min-height: 38px;
	color: #606266;
	font-size: 10px;
	line-height: 1.2;
	text-align: center;
}

.ship-demand-info .suggest-tag,
.ship-demand-info .shortage-tag,
.ship-demand-info .arrival-tag,
.ship-demand-info .transit-tag {
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-demand-info .suggest-clickable {
	cursor: help;
	border-bottom: 1px dashed #909399;
}

.ship-demand-info .suggest-tag.has-suggestion {
	color: #e6a23c;
	font-weight: 800;
	border-color: #e6a23c;
}

.ship-demand-info .shortage-tag {
	color: #f56c6c;
	font-weight: 700;
}

.ship-demand-info .shortage-tag.is-covered {
	color: #67c23a;
	font-weight: 600;
}

.ship-demand-info .inventory-usage-tags {
	display: inline-flex;
	flex-direction: column;
	align-items: center;
	gap: 1px;
	max-width: 100%;
}

.ship-demand-info .arrival-tag.has-arrival,
.ship-demand-info .transit-tag.has-transit {
	color: #e6a23c;
	font-weight: 700;
}

.segment-coeff-popover {
	padding: 10px !important;
}

.segment-coeff-panel {
	max-height: 430px;
	overflow-y: auto;
	color: #303133;
}

.segment-coeff-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 8px;
}

.segment-coeff-head > div {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.segment-coeff-head strong {
	font-size: 13px;
	font-weight: 800;
}

.segment-coeff-head span,
.segment-coeff-notice {
	color: #909399;
	font-size: 11px;
	line-height: 1.35;
}

.segment-coeff-editor {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
	gap: 8px;
	align-items: end;
	margin-bottom: 8px;
	padding: 8px;
	border-radius: 7px;
	background: #f8fafc;
}

.segment-coeff-editor label {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	color: #606266;
	font-size: 11px;
	font-weight: 700;
}

.segment-coeff-editor .el-input-number {
	width: 100%;
}

.segment-coeff-notice {
	margin-bottom: 8px;
	padding: 6px 8px;
	border-radius: 6px;
	background: #f5f7fa;
}

.segment-coeff-table {
	display: flex;
	flex-direction: column;
	gap: 2px;
	margin-bottom: 8px;
}

.segment-coeff-table-row {
	display: grid;
	grid-template-columns: 42px 34px 54px 44px 54px minmax(74px, 1fr);
	align-items: center;
	gap: 6px;
	min-height: 24px;
	padding: 0 6px;
	border-radius: 5px;
	background: #fbfdff;
	font-size: 11px;
	text-align: center;
}

.segment-coeff-table-row.is-no-alpha {
	grid-template-columns: 42px 34px 64px 64px minmax(90px, 1fr);
}

.segment-coeff-table-row.is-header {
	background: #f0f4fa;
	color: #909399;
	font-weight: 700;
}

.segment-coeff-table-row strong {
	color: #1677ff;
}

.segment-coeff-table-row em {
	min-width: 0;
	overflow: hidden;
	color: #606266;
	font-style: normal;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.segment-coeff-formulas {
	display: flex;
	flex-direction: column;
	gap: 4px;
	color: #606266;
	font-size: 11px;
	line-height: 1.35;
}

.segment-coeff-formulas div {
	padding: 5px 7px;
	border-radius: 5px;
	background: #f8fafc;
}

.si-temp-status {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	min-height: 18px;
	padding: 1px 5px;
	border: 1px solid transparent;
	border-radius: 6px;
	font-size: 10px;
	font-weight: 700;
	line-height: 1.2;
	text-align: center;
}

.si-temp-status :deep(.el-icon) {
	flex: 0 0 auto;
	font-size: 12px;
}

.si-temp-status.is-success {
	border-color: #d9f2cc;
	background: #f0f9eb;
	color: #3f9d21;
}

.si-temp-status.is-warning {
	border-color: #f3d19e;
	background: #fff7ed;
	color: #b88230;
}

.segment-save-btn {
	justify-content: center;
	min-height: 18px;
	padding: 0;
	font-weight: 700;
}

.segment-save-btn.is-saved {
	color: #3f9d21;
}

.segment-save-btn.is-dirty {
	color: #b88230;
}

.si-segment-meta {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 3px;
	color: #606266;
	font-size: 10.5px;
	line-height: 1.2;
	text-align: center;
}

.si-segment-meta span {
	display: flex;
	flex-direction: column;
	gap: 1px;
	min-width: 0;
	padding: 3px 3px;
	overflow: hidden;
	border-radius: 5px;
	background: #f5f7fa;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.si-segment-meta em {
	color: #909399;
	font-size: 9.5px;
	font-style: normal;
	line-height: 1;
}

.si-segment-meta strong {
	min-width: 0;
	overflow: hidden;
	color: #303133;
	font-size: 12px;
	font-weight: 800;
	line-height: 1.1;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.si-pre-arrival {
	padding: 4px 5px;
	border: 1px solid #ffd8a8;
	border-radius: 5px;
	background: #fff7ed;
	color: #e6a23c;
	font-size: 10px;
	font-weight: 700;
	line-height: 1.2;
	text-align: center;
	cursor: help;
	white-space: nowrap;
}

.method-warning {
	margin-top: auto;
	padding: 3px 5px;
	border-radius: 5px;
	background: #fff1f0;
	color: #f56c6c;
	font-size: 10px;
	line-height: 1.2;
	text-align: center;
}

:global(.pre-arrival-tooltip) {
	max-width: 420px !important;
	padding: 10px 12px !important;
	border: 1px solid #ffd8a8 !important;
	box-shadow: 0 8px 24px rgba(31, 45, 61, 0.14) !important;
}

:global(.ship-segment-tooltip) {
	max-width: 480px !important;
	padding: 10px 12px !important;
	border: 1px solid #cfe3ff !important;
	box-shadow: 0 10px 28px rgba(31, 45, 61, 0.16) !important;
}

.ship-segment-tooltip-panel {
	width: 420px;
	max-width: 78vw;
	color: #303133;
}

.ship-segment-tooltip-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 8px;
	font-size: 13px;
	font-weight: 800;
}

.ship-segment-tooltip-title strong {
	color: #e67e22;
	font-size: 18px;
}

.ship-segment-tooltip-reason {
	padding: 8px 9px;
	border: 1px solid #d9ecff;
	border-radius: 6px;
	background: #f7fbff;
	color: #303133;
	font-size: 12px;
	line-height: 1.55;
}

.ship-segment-tooltip-formula {
	margin-top: 7px;
	padding: 6px 8px;
	border-radius: 6px;
	background: #fff7ed;
	color: #b88230;
	font-size: 12px;
	font-weight: 700;
	line-height: 1.4;
}

.ship-segment-tooltip-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 5px;
	margin-top: 7px;
}

.ship-segment-tooltip-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-height: 26px;
	padding: 4px 7px;
	border-radius: 6px;
	background: #f8fafc;
	font-size: 12px;
}

.ship-segment-tooltip-row span {
	flex: 0 0 auto;
	color: #909399;
}

.ship-segment-tooltip-row strong {
	min-width: 0;
	overflow: hidden;
	color: #303133;
	font-weight: 800;
	text-align: right;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-segment-tooltip-row.is-important {
	background: #fff7ed;
}

.ship-segment-tooltip-row.is-important strong {
	color: #e67e22;
}

.pre-arrival-panel {
	min-width: 320px;
	color: #303133;
}

.pre-arrival-title {
	margin-bottom: 8px;
	font-size: 13px;
	font-weight: 800;
}

.pre-arrival-summary {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 7px 9px;
	border-radius: 6px;
	background: #fff7ed;
	color: #b88230;
}

.pre-arrival-summary strong {
	color: #e6a23c;
}

.pre-arrival-sub {
	margin-top: 8px;
	color: #606266;
	font-size: 12px;
	line-height: 1.45;
}

.pre-arrival-detail-list {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin-top: 8px;
}

.pre-arrival-detail-row {
	display: grid;
	grid-template-columns: 52px repeat(3, minmax(0, 1fr));
	gap: 7px;
	align-items: center;
	min-height: 24px;
	padding: 0 7px;
	border-radius: 5px;
	background: #f8fafc;
	font-size: 12px;
}

.pre-arrival-detail-row strong {
	color: #f56c6c;
}

.ship-coeff-mini-panel {
	width: 100%;
	min-width: 0;
	max-width: none;
	padding: 6px;
	border: 1px solid #d9e2ef;
	border-radius: 6px;
	background: #fff;
	box-shadow: 0 1px 2px rgb(31 45 61 / 3%);
}

.ship-coeff-mini-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 6px;
	margin-bottom: 2px;
	color: #303133;
	font-size: 12px;
	font-weight: 700;
}

.ship-coeff-mini-head > span,
.ship-coeff-title {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-coeff-title {
	display: inline-flex;
	border-bottom: 1px dashed #909399;
	cursor: help;
}

.ship-coeff-mini-sub {
	margin-bottom: 3px;
	color: #606266;
	font-size: 10.5px;
}

.ship-coeff-mini-table {
	display: flex;
	flex-direction: column;
	gap: 1px;
	padding: 3px;
	border: 1px solid #edf1f7;
	border-radius: 6px;
	background: #fff;
}

.ship-coeff-mini-row {
	display: grid;
	grid-template-columns: 34px repeat(5, minmax(0, 1fr));
	align-items: center;
	min-height: 18px;
	padding: 0 4px;
	border-radius: 4px;
	color: #303133;
	font-size: 10.5px;
	line-height: 1.15;
	text-align: center;
}

.ship-coeff-mini-simple {
	grid-template-columns: 34px 32px 42px 46px minmax(0, 1fr);
}

.ship-coeff-mini-row.is-header {
	min-height: 20px;
	background: #f5f7fa;
	color: #909399;
	font-weight: 600;
}

.ship-coeff-mini-row.is-current-month {
	background: #ecf5ff;
}

.ship-coeff-mini-row:not(.is-header):not(.is-current-month):nth-child(odd) {
	background: #fafcff;
}

.ship-coeff-mini-row.is-missing {
	color: #a8abb2;
}

.ship-coeff-mini-row span {
	justify-self: center;
	min-width: 0;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.combined-coeff,
.mini-alpha,
.subtotal {
	font-weight: 700;
}

.combined-coeff {
	display: inline-flex;
	justify-self: center;
	width: fit-content;
	max-width: 100%;
	padding: 0 1px;
	color: #409eff;
	border-bottom: 1px dashed currentColor;
	cursor: help;
	line-height: 1.12;
}

.mini-alpha {
	display: inline-flex;
	justify-self: center;
	width: fit-content;
	padding: 0 1px;
	color: #e6a23c;
	line-height: 1.12;
}

.algo-tooltip {
	max-width: 380px;
	padding: 2px 0;
	font-size: 12px;
	line-height: 1.45;
}

.algo-tooltip-title {
	margin-bottom: 5px;
	color: #303133;
	font-weight: 700;
}

.algo-tooltip-row {
	color: #606266;
	white-space: normal;
}

.ship-panel-toolbar {
	display: grid;
	grid-template-columns: minmax(260px, 1fr) minmax(330px, 1.15fr) auto;
	align-items: center;
	gap: 8px;
	margin-top: 4px;
	padding: 5px 7px;
	border: 1px solid #d9ecff;
	border-radius: 6px;
	background: #eef5ff;
}

.toolbar-summary,
.toolbar-result,
.toolbar-actions {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.toolbar-summary,
.toolbar-result {
	flex-wrap: wrap;
}

.toolbar-actions {
	justify-content: flex-end;
}

.toolbar-summary span,
.toolbar-result > span {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	min-height: 22px;
	padding: 0 8px;
	border: 1px solid #dcdfe6;
	border-radius: 4px;
	background: #fff;
	color: #606266;
	font-size: 11px;
	line-height: 1;
	white-space: nowrap;
}

.toolbar-summary-main {
	border-color: #c6e2ff !important;
	background: #f5fbff !important;
	color: #1677ff !important;
	font-weight: 800;
}

.toolbar-summary strong,
.toolbar-result strong {
	color: #303133;
}

.toolbar-summary .danger {
	border-color: #fab6b6;
	background: #fef0f0;
	color: #f56c6c;
}

.toolbar-summary .danger strong {
	color: #f56c6c;
}

.toolbar-result .is-current {
	border-color: #c6e2ff;
	background: #f8fbff;
}

.toolbar-status.warning {
	border-color: #f3d19e;
	background: #fdf6ec;
	color: #b88230;
}

.toolbar-status.success {
	border-color: #b3e19d;
	background: #f0f9eb;
	color: #529b2e;
}

.toolbar-warning-line {
	display: flex;
	align-items: center;
	gap: 7px;
	margin-top: 3px;
	padding: 4px 7px;
	border-radius: 5px;
	background: #fff2f2;
	color: #f56c6c;
	font-size: 11px;
	line-height: 1.3;
}

.toolbar-warning-line span:last-child {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.item-remark {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 10px;
	border-radius: 6px;
	background: #f8fafc;
	color: #606266;
	font-size: 11px;
	line-height: 1.35;
}

.item-remark.danger {
	background: #fef0f0;
	color: #f56c6c;
}

.remark-dot {
	flex: 0 0 6px;
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: currentColor;
}

.order-allocation-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 8px;
	font-size: 13px;
	font-weight: 700;
}

.order-allocation-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	max-height: 260px;
	overflow-y: auto;
}

.order-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 9px;
	border: 1px solid #edf1f7;
	border-radius: 7px;
	background: #fbfdff;
}

.order-main {
	min-width: 0;
}

.order-title {
	gap: 8px;
	color: #303133;
	font-size: 13px;
}

.order-meta {
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 5px;
	color: #909399;
	font-size: 12px;
}

.order-ship-control {
	flex: 0 0 auto;
	gap: 6px;
	color: #606266;
	font-size: 12px;
}

.dialog-footer {
	justify-content: space-between;
	gap: 8px;
	min-height: 30px;
	padding-top: 4px;
	border-top: 1px solid #ebeef5;
	background: #fff;
}

.footer-summary,
.footer-actions {
	gap: 6px;
	flex-wrap: wrap;
}

.footer-actions {
	justify-content: flex-end;
}

.footer-next-hint {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	max-width: 360px;
	color: #b88230;
	font-size: 11px;
	line-height: 1.25;
	text-align: right;
}

.next-step-tooltip-trigger {
	display: inline-flex;
}

.temp-drawer {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.temp-drawer-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 12px;
	border: 1px solid #e4e7ed;
	border-radius: 8px;
	background: #f5f7fa;
}

.temp-drawer-title {
	color: #303133;
	font-size: 15px;
	font-weight: 700;
}

.temp-drawer-sub {
	margin-top: 4px;
	color: #909399;
	font-size: 12px;
}

.temp-record {
	display: grid;
	grid-template-columns: 1fr auto auto;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
	border: 1px solid #ebeef5;
	border-radius: 8px;
}

.temp-record-line {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	font-size: 13px;
}

.temp-record-line.is-sub {
	margin-top: 4px;
	color: #909399;
	font-size: 12px;
}

.temp-method-dot {
	flex: 0 0 8px;
	width: 8px;
	height: 8px;
	border-radius: 50%;
}

.temp-record-qty {
	display: flex;
	align-items: baseline;
	gap: 3px;
	color: #e6a23c;
}

.temp-record-qty strong {
	font-size: 18px;
}

.trace-drawer-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	width: 100%;
}

.trace-drawer-header > div {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.trace-drawer-header strong {
	color: #303133;
	font-size: 16px;
	font-weight: 800;
}

.trace-drawer-header span {
	overflow: hidden;
	color: #606266;
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-drawer-body {
	min-height: 0;
}

.ship-history-drawer-header {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	gap: 12px;
	width: 100%;
}

.ship-history-drawer-header > div {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.ship-history-drawer-header strong {
	color: #303133;
	font-size: 16px;
	font-weight: 800;
}

.ship-history-drawer-header span {
	overflow: hidden;
	color: #606266;
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-history-body {
	min-height: 0;
}

.ship-history-loading {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	min-height: 260px;
	color: #67c23a;
}

.ship-history-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
	height: calc(100vh - 112px);
	min-height: 520px;
	overflow-y: auto;
	padding-right: 4px;
}

.ship-history-overview {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	padding: 11px 12px;
	border: 1px solid #d9ecff;
	border-radius: 8px;
	background: linear-gradient(180deg, #f7fbff 0%, #fff 100%);
	color: #606266;
	font-size: 12px;
}

.ship-history-overview-title {
	flex: 1 0 100%;
	color: #303133;
	font-weight: 800;
}

.ship-history-overview span {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	min-height: 24px;
	padding: 0 8px;
	border: 1px solid #edf1f7;
	border-radius: 6px;
	background: #fff;
}

.ship-history-overview strong {
	color: #303133;
}

.ship-history-overview .is-success,
.ship-history-method-qty strong {
	color: #67c23a;
}

.ship-history-overview .is-danger,
.ship-history-method-qty.is-danger strong {
	color: #f56c6c;
}

.ship-history-batch {
	overflow: hidden;
	border: 1px solid #dfe7f2;
	border-radius: 10px;
	background: #fff;
	box-shadow: 0 2px 8px rgba(31, 45, 61, 0.04);
}

.ship-history-collapse {
	display: flex;
	flex-direction: column;
	gap: 10px;
	border: 0;
}

.ship-history-collapse :deep(.el-collapse-item__header) {
	height: auto;
	min-height: 68px;
	padding: 10px 12px;
	border-bottom: 1px solid #edf1f7;
	background: #fbfdff;
}

.ship-history-collapse :deep(.el-collapse-item__wrap) {
	border-bottom: 0;
	background: #fff;
}

.ship-history-collapse :deep(.el-collapse-item__content) {
	padding: 0 12px 12px;
}

.ship-history-collapse :deep(.el-collapse-item__arrow) {
	flex: 0 0 auto;
	margin-left: 10px;
}

.ship-history-batch-title {
	display: grid;
	grid-template-columns: minmax(210px, 0.72fr) minmax(0, 1fr) auto;
	align-items: center;
	gap: 12px;
	width: 100%;
	min-width: 0;
}

.ship-history-batch-main {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
}

.ship-history-batch-main strong {
	min-width: 0;
	overflow: hidden;
	color: #303133;
	font-size: 14px;
	font-weight: 800;
	line-height: 1.2;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-history-batch-main span,
.ship-history-batch-method-summary {
	min-width: 0;
	overflow: hidden;
	color: #606266;
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-history-batch-method-summary {
	padding: 5px 8px;
	border-radius: 6px;
	background: #eef6ff;
	color: #409eff;
	font-weight: 700;
}

.ship-history-batch-method-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	min-width: 0;
	max-height: 50px;
	overflow: hidden;
}

.ship-history-batch-method-chips span {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	min-height: 23px;
	max-width: 160px;
	padding: 0 8px;
	overflow: hidden;
	border: 1px solid #d9ecff;
	border-radius: 999px;
	background: #eef6ff;
	color: #1677ff;
	font-size: 12px;
	font-weight: 800;
	line-height: 1;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-history-batch-method-chips span.is-danger {
	border-color: #fde2e2;
	background: #fef0f0;
	color: #f56c6c;
}

.ship-history-batch-method-chips em {
	color: inherit;
	font-style: normal;
	font-weight: 700;
}

.ship-history-batch-actions {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
	min-width: 0;
}

.ship-history-batch-actions :deep(.el-button) {
	margin-left: 0;
}

.ship-history-expanded-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin: 10px 0 8px;
	padding: 8px 10px;
	border: 1px solid #edf1f7;
	border-radius: 7px;
	background: #fafcff;
}

.ship-history-expanded-toolbar span {
	color: #303133;
	font-size: 12px;
	font-weight: 800;
}

.ship-history-methods {
	display: flex;
	flex-direction: column;
	gap: 10px;
	margin-top: 10px;
}

.ship-history-method-card {
	padding: 10px;
	border: 1px solid #edf1f7;
	border-radius: 8px;
	background: #fff;
}

.ship-history-method-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	min-width: 0;
}

.ship-history-method-head > div:first-child {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
}

.ship-history-method-head strong {
	display: flex;
	align-items: center;
	gap: 5px;
	min-width: 0;
	overflow: hidden;
	color: #303133;
	font-size: 13px;
	font-weight: 800;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-history-method-head strong em {
	padding: 1px 6px;
	border-radius: 999px;
	background: #f0f9eb;
	color: #67c23a;
	font-size: 12px;
	font-style: normal;
	font-weight: 800;
}

.ship-history-method-head span,
.ship-history-method-qty span,
.ship-history-method-qty em {
	color: #909399;
	font-size: 12px;
	font-style: normal;
}

.ship-history-method-side {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	gap: 8px;
}

.ship-history-method-qty {
	display: flex;
	flex: 0 0 auto;
	align-items: baseline;
	gap: 4px;
	padding: 4px 8px;
	border-radius: 6px;
	border: 1px solid #e1f3d8;
	background: #f0f9eb;
}

.ship-history-method-qty.is-danger {
	border-color: #fde2e2;
	background: #fef0f0;
}

.ship-history-method-qty strong {
	font-size: 18px;
	font-weight: 800;
}

.ship-history-group-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin: 8px 0;
}

.ship-history-allocation-table {
	overflow: hidden;
	border: 1px solid #ebeef5;
	border-radius: 7px;
	background: #fff;
}

.ship-history-allocation-row {
	display: grid;
	grid-template-columns:
		minmax(130px, 1.15fr) minmax(150px, 1.25fr) minmax(110px, 0.9fr)
		74px 82px;
	align-items: center;
	gap: 8px;
	min-height: 34px;
	padding: 0 10px;
	border-top: 1px solid #f0f2f5;
	color: #606266;
	font-size: 12px;
}

.ship-history-allocation-row:first-child {
	border-top: 0;
}

.ship-history-allocation-row.is-header {
	min-height: 30px;
	background: #f5f7fa;
	color: #909399;
	font-weight: 700;
}

.ship-history-allocation-row > span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-history-allocation-row strong {
	color: #303133;
	font-size: 13px;
}

.trace-loading {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	min-height: 260px;
	color: #409eff;
}

.trace-workspace {
	display: grid;
	grid-template-columns: 260px minmax(0, 1fr);
	gap: 14px;
	height: calc(100vh - 112px);
	min-height: 560px;
}

.trace-plan-list,
.trace-detail-panel {
	min-height: 0;
	overflow-y: auto;
}

.trace-plan-list {
	display: flex;
	flex-direction: column;
	gap: 9px;
	padding-right: 2px;
}

.trace-plan-list-head,
.trace-detail-hero,
.trace-section {
	border: 1px solid #e4e7ed;
	border-radius: 8px;
	background: #fff;
}

.trace-plan-list-head {
	padding: 10px 12px;
	background: #f7fbff;
}

.trace-plan-list-head strong,
.trace-section-title strong {
	display: block;
	color: #303133;
	font-size: 13px;
	font-weight: 800;
}

.trace-plan-list-head span,
.trace-section-title span,
.trace-plan-group-title span {
	display: block;
	margin-top: 2px;
	color: #909399;
	font-size: 12px;
}

.trace-plan-group-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 2px 2px 0;
	color: #606266;
}

.trace-plan-group-title strong {
	font-size: 12px;
	font-weight: 800;
}

.trace-plan-card {
	width: 100%;
	padding: 10px 11px;
	border: 1px solid #e4e7ed;
	border-radius: 8px;
	background: #fff;
	color: #303133;
	text-align: left;
	cursor: pointer;
}

.trace-plan-card.active {
	border-color: #409eff;
	background: #ecf5ff;
	box-shadow: inset 0 0 0 1px rgba(64, 158, 255, 0.14);
}

.trace-plan-card.error {
	border-color: #fab6b6;
	background: #fef0f0;
}

.trace-plan-card.history {
	border-color: #f3d19e;
	background: #fffaf2;
}

.trace-plan-title,
.trace-plan-meta,
.trace-detail-hero,
.trace-section-title,
.trace-segment-head,
.trace-order-list {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-width: 0;
}

.trace-plan-title strong {
	min-width: 0;
	overflow: hidden;
	font-size: 13px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-plan-meta {
	margin-top: 7px;
	color: #606266;
	font-size: 12px;
}

.trace-plan-snapshot {
	display: grid;
	grid-template-columns: 1fr;
	gap: 4px;
	margin-top: 7px;
	padding: 6px 7px;
	border-radius: 6px;
	background: #f7faff;
	color: #606266;
	font-size: 11px;
	line-height: 1.25;
}

.trace-plan-snapshot span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-plan-orders,
.trace-plan-error,
.trace-plan-warning {
	margin-top: 7px;
	overflow: hidden;
	color: #909399;
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trace-plan-error {
	color: #f56c6c;
}

.trace-plan-warning {
	color: #b88230;
}

.trace-detail-panel {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding-right: 4px;
}

.trace-detail-hero {
	padding: 14px 16px;
	background: linear-gradient(135deg, #f7fbff 0%, #fff 100%);
}

.trace-detail-hero > div {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.trace-detail-hero span,
.trace-detail-hero em {
	color: #909399;
	font-size: 12px;
	font-style: normal;
}

.trace-detail-hero strong {
	color: #303133;
	font-size: 18px;
	font-weight: 800;
}

.trace-quality-alert {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 9px 12px;
	border: 1px solid #fde2c4;
	border-radius: 8px;
	background: #fff7ed;
	color: #b88230;
	font-size: 12px;
	line-height: 1.4;
}

.trace-quality-alert strong {
	flex: 0 0 auto;
	color: #e6a23c;
	font-weight: 800;
}

.trace-summary-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 8px;
}

.trace-summary-card {
	min-height: 68px;
	padding: 10px 12px;
	border: 1px solid #e4e7ed;
	border-radius: 8px;
	background: #fff;
}

.trace-summary-card span,
.trace-kv-row span,
.trace-coeff-row span,
.trace-segment-meta span {
	color: #909399;
	font-size: 12px;
}

.trace-summary-card strong {
	display: block;
	margin-top: 8px;
	color: #1677ff;
	font-size: 18px;
	font-weight: 800;
}

.trace-summary-remark {
	cursor: default;
}

.trace-summary-remark.has-content {
	border-color: #f3d19e;
	background: #fffaf2;
	cursor: help;
}

.trace-summary-remark strong {
	display: -webkit-box;
	margin-top: 7px;
	overflow: hidden;
	color: #909399;
	font-size: 13px;
	font-weight: 600;
	line-height: 1.4;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	word-break: break-word;
}

.trace-summary-remark.has-content strong {
	color: #b26a00;
}

.trace-section {
	padding: 12px;
}

.trace-section-title {
	margin-bottom: 10px;
}

.trace-segment-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
}

.trace-section-empty {
	grid-column: 1 / -1;
	min-height: 120px;
}

.trace-segment-card {
	min-width: 0;
	padding: 10px;
	border: 1px solid #edf1f7;
	border-radius: 8px;
	background: #fbfdff;
}

.trace-segment-qty {
	margin-top: 8px;
	color: #e67e22;
	font-size: 24px;
	font-weight: 900;
	line-height: 1;
}

.trace-segment-meta {
	display: flex;
	justify-content: space-between;
	gap: 8px;
	margin-top: 8px;
	font-size: 12px;
}

.trace-segment-formula {
	margin-top: 8px;
	padding: 6px 7px;
	border-radius: 6px;
	background: #fff7ed;
	color: #b88230;
	font-size: 12px;
	line-height: 1.4;
}

.trace-two-col,
.trace-three-col {
	display: grid;
	gap: 12px;
}

.trace-two-col {
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.trace-three-col {
	grid-template-columns: repeat(3, minmax(0, 1fr));
}

.trace-section.compact {
	min-height: 180px;
}

.trace-step-list,
.trace-coeff-list,
.trace-kv-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.trace-step-row,
.trace-coeff-row,
.trace-kv-row {
	display: grid;
	align-items: center;
	gap: 8px;
	padding: 7px 8px;
	border-radius: 6px;
	background: #f8fafc;
	font-size: 12px;
}

.trace-step-row {
	grid-template-columns: 24px minmax(0, 1fr);
}

.trace-step-row span {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: #ecf5ff;
	color: #409eff;
	font-weight: 800;
}

.trace-step-row strong {
	color: #303133;
	font-weight: 600;
	line-height: 1.45;
}

.trace-coeff-row {
	grid-template-columns: 44px repeat(3, minmax(0, 1fr)) 64px;
}

.trace-coeff-row strong,
.trace-kv-row strong {
	color: #303133;
	font-weight: 800;
}

.trace-coeff-row em {
	color: #e67e22;
	font-style: normal;
	font-weight: 800;
	text-align: right;
}

.trace-kv-row {
	grid-template-columns: minmax(0, 1fr) auto;
}

.trace-order-list {
	justify-content: flex-start;
	flex-wrap: wrap;
}

.trace-order-list span {
	padding: 4px 7px;
	border-radius: 6px;
	background: #f5f7fa;
	color: #606266;
	font-size: 12px;
}

.trace-raw-collapse {
	border: 1px solid #e4e7ed;
	border-radius: 8px;
	background: #fff;
}

.trace-raw-collapse :deep(.el-collapse-item__header) {
	padding: 0 12px;
	border-bottom: 0;
}

.raw-title {
	width: 100%;
	margin-bottom: 0;
}

.trace-raw-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 10px;
	padding: 12px;
}

.trace-raw-card {
	min-width: 0;
	border: 1px solid #edf1f7;
	border-radius: 8px;
	background: #fbfdff;
}

.trace-raw-card strong {
	display: block;
	padding: 8px 10px;
	border-bottom: 1px solid #edf1f7;
	color: #303133;
	font-size: 12px;
}

.trace-raw-card pre {
	max-height: 240px;
	margin: 0;
	padding: 10px;
	overflow: auto;
	color: #303133;
	font-size: 11px;
	line-height: 1.45;
	white-space: pre-wrap;
	word-break: break-word;
}

.ship-plan-form {
	max-height: 70vh;
	overflow-y: auto;
}

.ship-method-collapse {
	border-top: 0;
}

.ship-method-title {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	min-width: 0;
}

.ship-method-dot,
.temp-method-dot {
	flex: 0 0 8px;
	width: 8px;
	height: 8px;
	border-radius: 50%;
}

.ship-batch-bar {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-bottom: 12px;
	padding: 10px 14px;
	border: 1px solid #e8edf5;
	border-radius: 8px;
	background: #f7f9fc;
}

.ship-batch-bar .el-select,
.ship-batch-bar .el-date-editor {
	width: 180px;
}

.ship-batch-label,
.ship-control-label {
	flex: 0 0 auto;
	color: #606266;
	font-size: 12px;
	font-weight: 700;
}

.ship-plan-records {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.ship-plan-record {
	padding: 12px 14px;
	border: 1px solid #e4e7ed;
	border-radius: 8px;
	background: #fff;
}

.ship-plan-record.is-collapsed {
	padding-top: 10px;
	padding-bottom: 10px;
}

.ship-record-main {
	display: flex;
	align-items: center;
	gap: 12px;
	min-width: 0;
}

.ship-record-img,
.final-product-img {
	flex: 0 0 54px;
	width: 54px;
	height: 54px;
	border: 1px solid #edf1f7;
	border-radius: 6px;
	background: #fff;
}

.ship-record-info {
	flex: 1 1 auto;
	min-width: 0;
}

.ship-record-name {
	overflow: hidden;
	color: #303133;
	font-size: 13px;
	font-weight: 800;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-record-qty {
	display: flex;
	flex: 0 0 88px;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 48px;
	border-left: 1px solid #edf1f7;
	color: #909399;
	font-size: 12px;
}

.ship-record-qty strong {
	color: #67c23a;
	font-size: 20px;
	line-height: 1.2;
}

.ship-record-expand {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	gap: 6px;
}

.ship-record-expand-button {
	padding-right: 2px;
	color: #409eff;
	font-size: 12px;
}

.ship-record-expand-icon {
	margin-left: 3px;
	transition: transform 0.18s ease;
}

.ship-record-expand-icon.is-expanded {
	transform: rotate(180deg);
}

.ship-record-detail {
	margin-top: 12px;
	padding-top: 1px;
	border-top: 1px dashed #e4e7ed;
}

.ship-record-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 5px;
	color: #909399;
	font-size: 12px;
}

.ship-record-controls {
	display: grid;
	grid-template-columns: 64px 180px 160px 180px minmax(180px, 1fr);
	align-items: center;
	gap: 10px;
	margin-top: 10px;
	padding: 10px;
	border-radius: 8px;
	background: #fbfdff;
}

.ship-order-detail-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-top: 10px;
	color: #303133;
	font-size: 12px;
	font-weight: 700;
}

.ship-order-detail-table {
	max-height: 188px;
	margin-top: 7px;
	overflow-y: auto;
	border: 1px solid #edf1f7;
	border-radius: 7px;
}

.ship-order-detail-row {
	display: grid;
	grid-template-columns: minmax(160px, 1.2fr) minmax(140px, 1fr) 90px 90px;
	align-items: center;
	gap: 8px;
	min-height: 30px;
	padding: 0 10px;
	background: #f5f7fa;
	color: #606266;
	font-size: 12px;
}

.ship-order-detail-row:not(.header) {
	background: #fff;
	border-top: 1px solid #edf1f7;
}

.ship-order-detail-row.header {
	position: sticky;
	top: 0;
	z-index: 1;
	color: #909399;
	font-weight: 700;
}

.order-detail-code {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	cursor: help;
}

.ship-order-detail-row strong,
.success {
	color: #67c23a;
}

.ship-record-summary {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 10px;
	color: #909399;
	font-size: 12px;
}

.ship-record-summary span {
	padding: 3px 7px;
	border-radius: 5px;
	background: #f7fbff;
}

.ship-batch-remark {
	display: grid;
	grid-template-columns: 64px minmax(0, 1fr);
	align-items: flex-start;
	gap: 10px;
	margin-top: 12px;
	padding: 10px 12px;
	border-top: 1px dashed #e4e7ed;
	color: #606266;
	font-size: 12px;
}

.ship-final-confirm {
	max-height: 68vh;
	overflow-y: auto;
}

.final-method-list {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

.final-method-card,
.final-result-method,
.final-fail-list {
	padding: 12px;
	border: 1px solid #e4e7ed;
	border-radius: 8px;
	background: #fff;
}

.final-method-head,
.final-result-head,
.final-result-product,
.final-fail-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	min-width: 0;
}

.final-method-head {
	margin-bottom: 10px;
	color: #909399;
	font-size: 12px;
}

.final-method-head > div {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.final-method-card :deep(.el-table__expanded-cell) {
	padding: 0 !important;
	background: #fbfdff;
}

.final-product-name,
.final-product-sub,
.final-result-method span,
.final-result-product span,
.final-fail-row span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.final-product-name {
	color: #303133;
	font-weight: 700;
}

.final-product-sub {
	margin-top: 3px;
	color: #909399;
	font-size: 12px;
}

.final-order-summary {
	display: inline-flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
	min-width: 112px;
	padding: 4px 7px;
	border: 1px solid #d9ecff;
	border-radius: 6px;
	background: #f7fbff;
	color: #606266;
	font: inherit;
	line-height: 1.2;
	cursor: pointer;
	transition:
		border-color 0.18s ease,
		background 0.18s ease;
}

.final-order-summary:hover,
.final-order-summary.is-expanded {
	border-color: #a0cfff;
	background: #ecf5ff;
}

.final-order-summary strong {
	color: #303133;
	font-size: 12px;
}

.final-order-summary span {
	color: #909399;
	font-size: 11px;
}

.final-order-summary em {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	color: #409eff;
	font-size: 11px;
	font-style: normal;
	font-weight: 700;
}

.final-order-summary em :deep(.el-icon) {
	font-size: 12px;
	transition: transform 0.18s ease;
}

.final-order-summary.is-expanded em :deep(.el-icon) {
	transform: rotate(180deg);
}

.final-order-expand {
	padding: 10px 14px 12px 58px;
	background: #fbfdff;
}

.final-order-expand-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 7px;
	color: #606266;
	font-size: 12px;
}

.final-order-expand-head > div {
	display: flex;
	align-items: baseline;
	gap: 8px;
	min-width: 0;
}

.final-order-expand-head strong {
	flex: 0 0 auto;
	color: #303133;
}

.final-order-expand-head span {
	min-width: 0;
	overflow: hidden;
	color: #909399;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.final-order-expand-table {
	max-height: 210px;
	overflow-y: auto;
	border: 1px solid #e4eaf3;
	border-radius: 6px;
	background: #fff;
}

.final-order-expand-row {
	display: grid;
	grid-template-columns: minmax(190px, 1.35fr) minmax(160px, 1fr) 92px 92px;
	align-items: center;
	gap: 8px;
	min-height: 31px;
	padding: 0 10px;
	border-top: 1px solid #edf1f7;
	color: #606266;
	font-size: 12px;
}

.final-order-expand-row.is-header {
	position: sticky;
	top: 0;
	z-index: 1;
	border-top: 0;
	background: #f5f7fa;
	color: #909399;
	font-weight: 700;
}

.final-order-expand-row strong {
	color: #67c23a;
}

.final-result-panel,
.final-result-summary {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.final-result-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 12px;
	border: 1px solid #d9ecff;
	border-radius: 8px;
	background: #f7fbff;
}

.final-result-heading {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.final-result-heading strong {
	overflow: hidden;
	color: #303133;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.final-result-heading span {
	color: #909399;
	font-size: 12px;
}

.final-result-actions {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	gap: 8px;
}

.final-result-overview {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	padding: 0 2px;
}

.final-result-overview span {
	display: inline-flex;
	align-items: baseline;
	gap: 3px;
	padding: 5px 9px;
	border: 1px solid #e4e7ed;
	border-radius: 6px;
	background: #fff;
	color: #606266;
	font-size: 12px;
}

.final-result-overview strong {
	color: #303133;
	font-size: 14px;
}

.final-result-overview .is-success,
.final-result-overview .is-success strong {
	color: #67c23a;
}

.final-result-overview .is-danger,
.final-result-overview .is-danger strong {
	color: #f56c6c;
}

.final-result-section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 2px 2px 0;
}

.final-result-section-head > div {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.final-result-section-head strong {
	color: #303133;
	font-size: 14px;
}

.final-result-section-head span {
	color: #909399;
	font-size: 12px;
}

.final-result-method-head,
.final-result-seqs {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.final-result-method-head {
	justify-content: space-between;
	margin-bottom: 10px;
}

.final-result-method-head > div {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.final-result-method-head > div strong {
	color: #303133;
	font-size: 14px;
}

.final-result-method-head span,
.final-result-seqs span {
	color: #909399;
	font-size: 12px;
}

.warehouse-execution-card {
	margin-top: 9px;
	padding: 10px;
	border: 1px solid #e4eaf3;
	border-radius: 7px;
	background: #fbfdff;
}

.warehouse-execution-head,
.warehouse-execution-title,
.warehouse-execution-seqs,
.warehouse-product-head,
.warehouse-product-qty {
	display: flex;
	align-items: center;
	gap: 7px;
	min-width: 0;
}

.warehouse-execution-head,
.warehouse-product-head {
	justify-content: space-between;
}

.warehouse-execution-title {
	flex-wrap: wrap;
}

.warehouse-execution-title > strong {
	color: #303133;
}

.warehouse-execution-seqs {
	flex: 0 1 auto;
	justify-content: flex-end;
	max-width: 48%;
	color: #909399;
	font-size: 12px;
}

.warehouse-execution-seqs strong {
	min-width: 0;
	overflow: hidden;
	color: #606266;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.warehouse-execution-remark,
.warehouse-product-remark {
	display: flex;
	gap: 7px;
	margin-top: 7px;
	padding: 5px 7px;
	border-radius: 5px;
	background: #fff7ed;
	color: #b88230;
	font-size: 12px;
}

.warehouse-execution-remark span,
.warehouse-product-remark span {
	flex: 0 0 auto;
	color: #e6a23c;
	font-weight: 700;
}

.warehouse-execution-products {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-top: 8px;
}

.warehouse-execution-product {
	padding: 8px;
	border: 1px solid #edf1f7;
	border-radius: 6px;
	background: #fff;
}

.warehouse-product-head > div:first-child {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.warehouse-product-head > div:first-child strong,
.warehouse-product-head > div:first-child span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.warehouse-product-head > div:first-child span {
	color: #909399;
	font-size: 12px;
}

.warehouse-product-qty {
	flex: 0 0 auto;
	align-items: baseline;
	color: #909399;
	font-size: 12px;
}

.warehouse-product-qty strong {
	color: #67c23a;
	font-size: 18px;
}

.warehouse-product-qty em {
	color: #67c23a;
	font-size: 12px;
	font-style: normal;
}

.warehouse-allocation-table {
	margin-top: 7px;
	overflow: hidden;
	border: 1px solid #edf1f7;
	border-radius: 5px;
}

.warehouse-allocation-row {
	display: grid;
	grid-template-columns: minmax(130px, 0.9fr) minmax(170px, 1.2fr) minmax(130px, 0.9fr) 88px;
	align-items: center;
	gap: 8px;
	min-height: 29px;
	padding: 0 8px;
	border-top: 1px solid #edf1f7;
	color: #606266;
	font-size: 12px;
}

.warehouse-allocation-row.is-header {
	border-top: 0;
	background: #f5f7fa;
	color: #909399;
	font-weight: 700;
}

.warehouse-allocation-row:not(.is-header) span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.warehouse-allocation-row strong {
	color: #67c23a;
	text-align: right;
}

.final-result-seqs {
	margin-top: 5px;
}

.final-result-seqs strong {
	min-width: 0;
	overflow: hidden;
	color: #606266;
	font-size: 12px;
	font-weight: 500;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.final-result-products {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
	margin-top: 10px;
}

.final-result-product {
	padding: 7px 9px;
	border-radius: 6px;
	background: #f7f9fc;
	color: #606266;
	font-size: 12px;
}

.final-fail-title {
	margin-bottom: 8px;
	color: #f56c6c;
	font-weight: 800;
}

.final-fail-list.is-local-sync .final-fail-title {
	color: #e6a23c;
}

.final-fail-list.is-local-sync .final-fail-reason {
	border-color: #fde2c4;
	background: #fff7ed;
	color: #b88230;
}

.final-fail-list.is-local-sync .final-fail-reason em {
	color: #b88230;
}

.final-fail-row {
	display: grid;
	grid-template-columns: minmax(210px, 0.8fr) 76px minmax(280px, 1.4fr);
	align-items: center;
	padding: 8px 0;
	border-top: 1px solid #f3f4f7;
	color: #606266;
	font-size: 12px;
}

.final-fail-identity {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
}

.final-fail-identity strong,
.final-fail-identity span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.final-fail-identity span {
	color: #909399;
}

.final-fail-qty {
	display: flex;
	align-items: baseline;
	justify-content: center;
	gap: 3px;
	color: #909399;
}

.final-fail-qty strong {
	color: #f56c6c;
	font-size: 15px;
}

.final-fail-reason {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-width: 0;
	padding: 5px 7px;
	border: 1px solid #fde2e2;
	border-radius: 5px;
	background: #fef0f0;
	color: #f56c6c;
	font: inherit;
	text-align: left;
	cursor: pointer;
}

.final-fail-reason span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.final-fail-reason em {
	flex: 0 0 auto;
	color: #f56c6c;
	font-style: normal;
	font-weight: 700;
}

.ship-plan-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	color: #909399;
	font-size: 13px;
}

.ship-plan-footer > div {
	display: flex;
	align-items: center;
	gap: 10px;
}

:global(.batch-ship-failure-popover .final-fail-popover-content strong) {
	color: #303133;
	font-size: 13px;
}

:global(.batch-ship-failure-popover .final-fail-popover-content p) {
	margin: 8px 0 0;
	color: #606266;
	font-size: 12px;
	line-height: 1.65;
	overflow-wrap: anywhere;
}

@media (max-width: 1360px) {
	.batch-toolbar {
		grid-template-columns: minmax(0, 1fr);
	}

	.batch-item-card {
		grid-template-columns: 252px minmax(0, 1fr);
	}

	.analysis-data-grid {
		grid-template-columns: repeat(5, minmax(0, 1fr));
	}

	.grid-item:nth-child(5n) {
		border-right: 0;
	}

	.panel-top {
		flex-wrap: wrap;
	}

	.panel-actions {
		flex: 1 1 100%;
	}

	.final-fail-row {
		grid-template-columns: minmax(180px, 0.8fr) 68px minmax(240px, 1.2fr);
	}

	.ship-panel-toolbar {
		grid-template-columns: minmax(0, 1fr);
		align-items: stretch;
	}

	.toolbar-actions {
		justify-content: flex-start;
	}

	.global-algo-row {
		min-height: 88px;
		border-top: 1px solid #dce8f6;
	}

	.global-algo-body {
		grid-template-columns: minmax(160px, 1fr) auto;
	}
}
</style>

<style lang="scss">
.purchase-plan-batch-ship-dialog {
	display: flex !important;
	flex-direction: column !important;
	height: calc(100vh - 4px) !important;
	max-height: calc(100vh - 4px) !important;
	max-width: calc(100vw - 24px) !important;
	margin-bottom: 0 !important;
	overflow: hidden !important;
}

.purchase-plan-batch-ship-dialog-header {
	flex: 0 0 auto !important;
	padding: 7px 14px 4px !important;
}

.purchase-plan-batch-ship-dialog-body {
	display: flex !important;
	flex: 1 1 auto !important;
	flex-direction: column !important;
	min-height: 0 !important;
	padding: 4px 12px 0 !important;
	overflow: hidden !important;
}

.purchase-plan-batch-ship-dialog-footer {
	flex: 0 0 auto !important;
	padding: 3px 12px 4px !important;
	background: #fff !important;
}

.summary-detail-popover,
.order-allocation-popover {
	padding: 10px !important;
}

.trace-field-popover {
	padding: 10px !important;
	overflow: hidden !important;
}

.trace-field-popover--daily {
	max-height: min(520px, calc(100vh - 48px)) !important;
}

.trace-field-popover--compact {
	max-height: min(360px, calc(100vh - 48px)) !important;
}

.trace-field-popover--daily .trace-field-mini {
	max-height: min(500px, calc(100vh - 72px));
	overflow-y: auto;
	padding-right: 2px;
}

.trace-field-popover--compact .trace-field-mini {
	max-height: min(340px, calc(100vh - 72px));
	overflow-y: auto;
	padding-right: 2px;
}

.summary-detail-title {
	margin-bottom: 8px;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 700;
}

.summary-detail-content {
	min-width: 0;
}

.daily-sales-tooltip-panel {
	width: 360px;
	max-width: 72vw;
}

.daily-sales-tooltip-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 8px;
}

.daily-sales-tooltip-title {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.daily-sales-tooltip-head strong {
	color: var(--el-color-primary);
	font-size: 18px;
}

.daily-sales-metric-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 6px;
}

.daily-sales-metric {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 6px 8px;
	border-radius: 5px;
	background: #f5f7fa;
	font-size: 12px;
}

.daily-sales-metric span,
.daily-sales-history-title {
	color: var(--el-text-color-secondary);
}

.daily-sales-history-section {
	margin-top: 10px;
}

.daily-sales-history-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 5px;
	margin-top: 6px;
}

.daily-sales-history-item {
	padding: 5px 6px;
	border-radius: 4px;
	background: #ecf5ff;
	font-size: 12px;
	text-align: center;
}

.daily-sales-history-item span,
.daily-sales-history-item strong {
	display: block;
}

.daily-sales-history-empty {
	margin-top: 6px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.box-pcs-popover {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.box-pcs-row {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	font-size: 12px;
}

.box-pcs-label {
	flex: 0 0 62px;
	color: var(--el-text-color-secondary);
}

.box-pcs-row code {
	overflow-wrap: anywhere;
	color: var(--el-text-color-primary);
}

.box-pcs-error {
	color: var(--el-color-danger);
}

.box-pcs-actions {
	display: flex;
	justify-content: flex-end;
}

.summary-rating-full {
	min-width: 160px;
	font-size: 13px;
}

.summary-rating-title {
	margin-top: 10px;
}

.summary-json-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
	max-height: 300px;
	overflow-y: auto;
}

.summary-json-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 6px 8px;
	border-radius: 5px;
	background: #f5f7fa;
	font-size: 12px;
}

.summary-json-row strong {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.summary-empty {
	padding: 12px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	text-align: center;
}

.data-sync-popover {
	padding: 10px !important;
}

.data-sync-fail-title {
	margin-bottom: 8px;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 700;
}

.data-sync-fail-list {
	display: flex;
	flex-direction: column;
	gap: 7px;
	max-height: 300px;
	overflow-y: auto;
}

.data-sync-fail-row {
	display: flex;
	flex-direction: column;
	gap: 3px;
	padding: 7px 8px;
	border-radius: 5px;
	background: #fdf6ec;
	font-size: 12px;
}

.data-sync-fail-row strong {
	color: var(--el-text-color-primary);
}

.data-sync-fail-row span {
	color: var(--el-text-color-secondary);
}

.ship-coeff-tooltip {
	max-width: 470px !important;
	padding: 10px 12px !important;
	border: 1px solid #d9e2ef !important;
	box-shadow: 0 8px 24px rgb(31 45 61 / 14%) !important;
	color: #303133 !important;
}

.ship-coeff-tooltip .coeff-tooltip-panel {
	width: 430px;
	max-width: 72vw;
}

.ship-coeff-tooltip .coeff-tooltip-title {
	margin-bottom: 9px;
	color: #303133;
	font-size: 13px;
	font-weight: 700;
	line-height: 1.25;
}

.ship-coeff-tooltip .coeff-tooltip-summary {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
	margin-bottom: 10px;
}

.ship-coeff-tooltip .coeff-tooltip-summary-item {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
	padding: 8px 9px;
	border: 1px solid #e4e7ed;
	border-radius: 6px;
	background: #f8fafc;
}

.ship-coeff-tooltip .coeff-tooltip-summary-item span,
.ship-coeff-tooltip .coeff-tooltip-metric span,
.ship-coeff-tooltip .coeff-tooltip-formula span {
	color: #909399;
	font-size: 11px;
	line-height: 1.2;
}

.ship-coeff-tooltip .coeff-tooltip-summary-item strong {
	color: #303133;
	font-size: 16px;
	line-height: 1.2;
}

.ship-coeff-tooltip .coeff-tooltip-summary-item.is-primary strong {
	color: #1677ff;
}

.ship-coeff-tooltip .coeff-tooltip-summary-item.is-success strong {
	color: #67c23a;
}

.ship-coeff-tooltip .coeff-tooltip-section {
	margin-top: 8px;
}

.ship-coeff-tooltip .coeff-tooltip-section-title {
	margin-bottom: 6px;
	color: #303133;
	font-size: 12px;
	font-weight: 700;
	line-height: 1.2;
}

.ship-coeff-tooltip .coeff-tooltip-metric-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 6px;
}

.ship-coeff-tooltip .coeff-tooltip-metric,
.ship-coeff-tooltip .coeff-tooltip-formula {
	min-width: 0;
	padding: 7px 8px;
	border: 1px solid #edf1f7;
	border-radius: 5px;
	background: #fff;
}

.ship-coeff-tooltip .coeff-tooltip-metric {
	display: flex;
	flex-direction: column;
	gap: 3px;
}

.ship-coeff-tooltip .coeff-tooltip-metric strong {
	color: #303133;
	font-size: 12px;
	line-height: 1.2;
}

.ship-coeff-tooltip .coeff-tooltip-formula {
	display: grid;
	grid-template-columns: 76px minmax(0, 1fr);
	align-items: start;
	gap: 8px;
	margin-top: 5px;
}

.ship-coeff-tooltip .coeff-tooltip-formula strong {
	color: #303133;
	font-size: 12px;
	font-weight: 600;
	line-height: 1.35;
	white-space: normal;
	word-break: break-word;
}

.ship-coeff-tooltip .coeff-tooltip-formula.is-warning {
	border-color: #ffd8a8;
	background: #fff7ed;
}

.ship-coeff-tooltip .coeff-tooltip-formula.is-warning strong {
	color: #b88230;
}

.ship-coeff-tooltip .coeff-tooltip-source {
	margin-top: 9px;
	padding: 8px 9px;
	border-radius: 5px;
	background: #f5f7fa;
	color: #606266;
	font-size: 12px;
	line-height: 1.45;
	white-space: normal;
}

.ship-coeff-tooltip .algo-tooltip {
	max-width: 400px;
	font-size: 12px;
	line-height: 1.55;
}

.ship-coeff-tooltip .algo-tooltip-title {
	margin-bottom: 7px;
	color: #303133;
	font-weight: 700;
}

.ship-coeff-tooltip .algo-tooltip-row {
	color: #606266;
	white-space: normal;
}

.ship-coeff-detail-popover {
	padding: 12px !important;
	border: 1px solid #d9e2ef !important;
	box-shadow: 0 10px 28px rgb(31 45 61 / 14%) !important;
}

.ship-coeff-detail-panel {
	width: 696px;
	max-width: 76vw;
}

.ship-coeff-detail-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 10px;
}

.ship-coeff-detail-title {
	color: #303133;
	font-size: 14px;
	font-weight: 700;
	line-height: 1.25;
}

.ship-coeff-detail-sub {
	max-width: 520px;
	margin-top: 3px;
	overflow: hidden;
	color: #909399;
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-coeff-detail-summary {
	display: grid;
	grid-template-columns: repeat(6, minmax(0, 1fr));
	gap: 7px;
	margin-bottom: 10px;
}

.ship-coeff-detail-summary div {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
	padding: 7px 8px;
	border: 1px solid #edf1f7;
	border-radius: 6px;
	background: #f8fafc;
}

.ship-coeff-detail-summary span {
	color: #909399;
	font-size: 11px;
	line-height: 1.2;
}

.ship-coeff-detail-summary strong {
	min-width: 0;
	overflow: hidden;
	color: #303133;
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-coeff-detail-table {
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding: 6px;
	border: 1px solid #edf1f7;
	border-radius: 7px;
	background: #fff;
}

.ship-coeff-detail-row {
	display: grid;
	grid-template-columns: 42px repeat(5, minmax(0, 1fr));
	align-items: center;
	min-height: 30px;
	padding: 0 7px;
	border-radius: 5px;
	color: #303133;
	font-size: 12px;
	text-align: center;
}

.ship-coeff-detail-table.is-combined .ship-coeff-detail-row {
	grid-template-columns: 42px repeat(7, minmax(0, 1fr));
}

.ship-coeff-detail-row.is-header {
	min-height: 28px;
	background: #f5f7fa;
	color: #909399;
	font-weight: 700;
}

.ship-coeff-detail-row.is-current-month {
	background: #ecf5ff;
}

.ship-coeff-detail-row.is-missing {
	color: #a8abb2;
}

.ship-coeff-detail-row span,
.ship-coeff-detail-row strong {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ship-coeff-detail-row strong {
	color: #1677ff;
}

.ship-coeff-detail-note {
	margin-top: 9px;
	padding: 7px 9px;
	border-radius: 6px;
	background: #f8fafc;
	color: #606266;
	font-size: 12px;
	line-height: 1.4;
}

:global(.batch-ship-trend-popover) {
	padding: 10px !important;
}

:global(.batch-ship-trend-panel) {
	width: 100%;
	min-width: 0;
}

:global(.batch-ship-trend-title) {
	margin-bottom: 8px;
	overflow: hidden;
	color: #303133;
	font-size: 13px;
	font-weight: 800;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
