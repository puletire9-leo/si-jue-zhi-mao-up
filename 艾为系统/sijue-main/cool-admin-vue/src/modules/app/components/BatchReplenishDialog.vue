<template>
	<el-dialog
		v-model="dialogVisible"
		width="1500px"
		:close-on-click-modal="false"
		class="batch-replenish-dialog"
		top="2vh"
		:show-close="true"
		:before-close="handleClose"
	>
		<template #header>
			<div class="batch-dialog-header">
				<div class="header-left">
					<span class="header-title">批量补货分析</span>
					<el-tag type="info" size="small" round
						>共 {{ items.length }} 个产品</el-tag
					>
					<el-tag
						v-if="syncHeaderTag"
						:type="syncHeaderTag.type"
						size="small"
						round
						class="header-sync-tag"
					>
						<el-icon v-if="props.purchasePlanSyncing" class="is-loading"><Loading /></el-icon>
						{{ syncHeaderTag.text }}
					</el-tag>
				</div>
			</div>
		</template>

		<div class="batch-replenish-content">
			<!-- ========== 步骤 1：计算分析 ========== -->
			<div v-show="currentStep === 1">
			<div class="batch-global-settings">
				<div class="setting-row">
					<div class="setting-item setting-period-item">
						<span class="setting-label">销售周期</span>
						<replenish-date-picker
							v-model="globalDateRange"
							:shipping-methods="shippingMethods"
							:shipping-buffer="shippingBuffer"
							:selected-shipping-methods="globalSelectedShippingMethods"
							:shipping-profile="globalShippingProfile"
							:shipping-profiles="shippingProfileOptions"
							:shipping-config-readonly="isGlobalShippingProfileReadonly"
							:algorithm="globalAlgo"
							:alpha="undefined"
							show-shipping-selector
							commit-on-confirm-only
							@change="onGlobalDateChange"
							@shipping-change="onGlobalShippingChange"
							@shipping-profile-change="onGlobalShippingProfileChange"
						/>
					</div>
					<div class="setting-item setting-algo-item">
						<span class="setting-label">计算依据</span>
						<el-radio-group
							v-model="globalAlgo"
							size="small"
							@change="onAlgoChange"
						>
							<el-radio-button label="daily_avg">日均销量</el-radio-button>
							<el-radio-button label="history">历史销量</el-radio-button>
							<el-radio-button label="trend">搜索词趋势</el-radio-button>
							<el-radio-button label="combined">综合走势</el-radio-button>
						</el-radio-group>
					</div>
					<div class="setting-item setting-bulk-item bulk-actions-panel">
						<span class="setting-label">批量</span>
						<span class="bulk-selected-text">已选 {{ bulkSelectedCount }} 个</span>
						<el-button size="small" plain :disabled="bulkSelectableItems.length === 0" @click="selectAllBulkItems">全选当前</el-button>
						<el-button size="small" plain :disabled="bulkSelectedCount === 0" @click="clearBulkSelection">清空</el-button>
						<el-button size="small" type="primary" plain :disabled="bulkSelectedCount === 0" @click="openBulkSettingsDialog()">批量应用</el-button>
					</div>
					<el-button
						class="setting-calc-button"
						type="primary"
						:icon="Refresh"
						:loading="isCalculating || props.purchasePlanSyncing"
						:disabled="props.purchasePlanSyncing"
						@click="applyToAll"
					>
						{{ props.purchasePlanSyncing ? "等待数据刷新" : "测算全部" }}
					</el-button>
				</div>
			</div>

			<div
				v-if="visibleSyncNotice"
				class="purchase-plan-sync-waiting"
				:class="[`is-${visibleSyncNotice.status}`, { 'is-leaving': syncNoticeLeaving }]"
			>
				<el-icon v-if="props.purchasePlanSyncing" class="is-loading"><Loading /></el-icon>
				<el-icon v-else-if="visibleSyncNotice.status === 'success'"><Check /></el-icon>
				<el-icon v-else><Close /></el-icon>
				<span class="sync-notice-text">{{ visibleSyncNotice.message }}</span>
				<el-button
					v-if="canRetryPurchasePlanSync"
					size="small"
					type="warning"
					plain
					:icon="Refresh"
					class="sync-retry-btn"
					@click.stop="retryFailedPurchasePlanSync"
				>
					继续刷新失败项
				</el-button>
				<button
					v-if="!props.purchasePlanSyncing"
					type="button"
					class="sync-notice-close"
					aria-label="关闭同步提示"
					title="关闭提示"
					@click.stop="dismissSyncNotice"
				>
					<el-icon><Close /></el-icon>
				</button>
			</div>

			<!-- 产品明细卡片列表 -->
			<div class="batch-items-scroll">
				<el-tooltip
					v-for="(item, idx) in items"
					:key="idx"
					:content="getCalcDailyAvgSales(item) <= 0 ? '该产品计算日均为 0，无法参与补货计算' : ''"
					:disabled="getCalcDailyAvgSales(item) > 0"
					placement="top"
					effect="dark"
				>
				<div
					class="batch-item-card"
					:ref="(el: any) => setItemCardRef(item, el)"
					:class="{ 'no-sales': getCalcDailyAvgSales(item) <= 0, 'is-excluded': item._excluded, 'is-missing-warehouse': isItemWarehouseMissing(item) }"
				>
					<!-- 排除/恢复按钮 -->
					<div class="item-exclude-btn" @click="toggleExclude(item)">
						<span v-if="!item._excluded" class="exclude-icon" title="移除">×</span>
						<span v-else class="restore-label">+ 恢复</span>
					</div>
					<!-- 排除遮罩 -->
					<div v-if="item._excluded" class="excluded-overlay">
						<span>已移除</span>
					</div>
					<!-- 左侧：产品信息 -->
					<div class="item-product">
						<el-checkbox
							class="item-select-checkbox"
							:model-value="isItemBulkSelected(item)"
							:disabled="item._excluded"
							@change="(val: any) => setItemBulkSelected(item, Boolean(val))"
						/>
						<div class="item-index">{{ idx + 1 }}</div>
						<div class="item-image">
							<el-image
								v-if="item.image_url_display"
								:src="item.image_url_display"
								fit="contain"
								style="width: 56px; height: 56px; border-radius: 8px"
								:preview-src-list="[item.image_url_display]"
								hide-on-click-modal
							/>
							<div v-else class="img-placeholder">
								<el-icon :size="24" color="#c0c4cc"><picture /></el-icon>
							</div>
						</div>
						<div class="item-info">
							<div class="item-name">{{ item.item_name || item.local_name || "-" }}</div>
							<el-tooltip
								v-if="hasBatchReplenishLocalProductInfo(item)"
								:content="getBatchReplenishLocalProductTooltip(item)"
								placement="top"
								popper-class="batch-local-product-tooltip"
								:show-after="200"
							>
								<div class="item-local-combined">
									<span class="item-local-label">品名/SKU</span>
									<span class="item-local-name">
										{{ getBatchReplenishLocalProductName(item) || "-" }}
									</span>
									<span
										v-if="getBatchReplenishLocalProductSku(item)"
										class="item-local-sku"
									>
										SKU: {{ getBatchReplenishLocalProductSku(item) }}
									</span>
								</div>
							</el-tooltip>
							<div class="item-meta">
								<el-tag size="small" type="info" effect="plain"
									>{{ item.asin || "-" }}</el-tag
								>
								<span class="item-sku" v-if="item.msku">MSKU: {{ item.msku }}</span>
								<span class="item-shop" v-if="item.seller_name">{{ item.seller_name }}</span>
							</div>
							<!-- 跨店补货选择 -->
							<div class="cross-store-row">
								<el-popover placement="bottom-start" :width="560" trigger="click" @show="() => fetchOtherStoreListings(item)">
									<template #reference>
										<el-tag
											:type="item._targetListing ? 'warning' : 'info'"
											effect="plain"
											size="small"
											style="cursor: pointer;"
											:closable="!!item._targetListing"
											@close="clearTargetListing(item)"
										>
											<template v-if="item._targetListing">
												🔄 {{ item._targetListing.seller_name || item._targetListing.shop }} | {{ item._targetListing.local_sku }}
											</template>
											<template v-else>📦 补货到其他店铺</template>
										</el-tag>
									</template>
									<div class="cross-store-popover">
										<div class="cs-title">选择目标店铺 ({{ item.product_code }} · {{ item.marketplace }})</div>
										<div v-if="crossStoreLoading" style="text-align:center;padding:20px"><el-icon class="is-loading" :size="20"><Loading /></el-icon> 加载中...</div>
										<div v-else-if="crossStoreList.length === 0" style="text-align:center;padding:20px;color:#909399">暂无其他店铺数据</div>
										<div v-else class="cs-list">
											<div
												v-for="listing in crossStoreList"
												:key="listing.id"
												class="cs-item"
												:class="{ 'is-current': listing.store_id === item.store_id && listing.asin === item.asin, 'is-selected': item._targetListing?.id === listing.id }"
												@click="selectTargetListing(item, listing)"
											>
												<div class="cs-thumb">
													<el-image
														v-if="listing.image_url"
														:src="convert_image_url(listing.image_url)"
														:preview-src-list="[convert_image_url(listing.image_url)]"
														fit="contain"
														class="cs-img"
														preview-teleported
														@click.stop
													/>
													<div v-else class="cs-img-placeholder">
														<el-icon :size="18" color="#c0c4cc"><Picture /></el-icon>
													</div>
												</div>
												<div class="cs-item-body">
													<div class="cs-item-main">
														<span class="cs-shop">{{ listing.seller_name || listing.shop || "-" }}</span>
														<el-tag size="small" type="info" effect="plain">{{ listing.asin || "-" }}</el-tag>
														<el-tag v-if="listing.store_id === item.store_id && listing.asin === item.asin" size="small" type="success" effect="dark" class="cs-status-tag">📍 当前店铺</el-tag>
														<el-tag v-else-if="item._targetListing?.id === listing.id" size="small" type="warning" effect="dark" class="cs-status-tag">✅ 已选择</el-tag>
													</div>
													<div class="cs-item-sub">
														<span class="cs-field"><span class="cs-field-label">SKU:</span>{{ listing.local_sku || "-" }}</span>
														<span class="cs-field"><span class="cs-field-label">MSKU:</span>{{ listing.msku || "-" }}</span>
														<span class="cs-field"><span class="cs-field-label">FNSKU:</span>{{ listing.fnsku || "-" }}</span>
													</div>
												</div>
											</div>
										</div>
									</div>
								</el-popover>
							</div>
							<div class="profile-summary" :class="{ 'is-preset': isGlobalShippingProfileReadonly }">
								<div class="profile-summary-head">
									<span class="profile-summary-title">当前配置：{{ currentShippingProfile.label }}</span>
									<span class="profile-summary-buffer">缓冲 {{ shippingBuffer }}天</span>
								</div>
								<div class="profile-summary-methods">
									<span
										v-for="method in currentShippingProfileSummaryMethods"
										:key="method.key"
										class="profile-summary-method"
									>
										{{ method.label }}{{ method.days }}
									</span>
								</div>
							</div>
							<div v-if="isItemWarehouseMissing(item)" class="warehouse-missing-tag">
								未选采购仓库
							</div>
						</div>
					</div>

					<!-- 右侧：数据区（预留，后续补充算法和交互） -->
					<div class="item-analysis">
						<div class="analysis-data-grid">
							<div class="grid-item">
								<div class="grid-label">日均销量</div>
								<el-tooltip placement="top" effect="light" :show-after="200">
									<template #content>
										<template v-for="dailyTooltip in [getDailySalesTooltipData(item)]" :key="item._batchId || item.id || item.asin || 'daily-sales'">
											<div class="daily-sales-tooltip-panel">
												<div class="daily-sales-tooltip-head">
													<div>
														<div class="daily-sales-tooltip-title">日均销量</div>
														<strong>{{ dailyTooltip.dailyAvg }}</strong>
													</div>
													<el-tag
														v-if="dailyTooltip.status"
														size="small"
														effect="plain"
														class="daily-sales-tooltip-status"
													>
														{{ dailyTooltip.status }}
													</el-tag>
												</div>
												<div class="daily-sales-metric-grid">
													<div v-for="metric in dailyTooltip.metrics" :key="metric.label" class="daily-sales-metric">
														<span>{{ metric.label }}</span>
														<strong>{{ metric.value }}</strong>
													</div>
												</div>
												<div class="daily-sales-history-section">
													<div class="daily-sales-history-title">近期每日销量</div>
													<div v-if="dailyTooltip.history.length" class="daily-sales-history-grid">
														<div
															v-for="trend in dailyTooltip.history"
															:key="trend.date"
															class="daily-sales-history-item"
														>
															<span>{{ formatRecentSalesDate(trend.date) }}</span>
															<strong>{{ trend.volumeText }}</strong>
														</div>
													</div>
													<div v-else class="daily-sales-history-empty">暂无近期销量数据</div>
												</div>
											</div>
										</template>
									</template>
									<div class="summary-daily-sales">
										<div class="daily-sales-trigger">{{ getDailyAvgSales(item) || "-" }}</div>
										<el-tag
											v-if="getResolvedSalesChangeStatus(item)"
											size="small"
											effect="plain"
											class="summary-sales-tag"
										>
											{{ getSalesStatusShortText(getResolvedSalesChangeStatus(item)) }}
										</el-tag>
									</div>
								</el-tooltip>
							</div>
							<div class="grid-item">
								<div class="grid-label">可售天数<br />(总/FBA)</div>
								<div class="grid-val">
									{{ getAvailableSaleDays(item) }}
								</div>
							</div>
							<div class="grid-item summary-inventory-item">
								<div class="grid-label">FBA/FBA预留/<br />在途/本地</div>
								<div class="grid-val inventory-combined">
									<el-popover placement="top" :width="960" trigger="hover" popper-class="summary-detail-popover">
										<template #reference>
											<span class="summary-link">{{ getFbaInventoryQuantity(item) }}</span>
										</template>
										<div class="summary-detail-content">
											<div class="summary-detail-title">FBA库存明细（合计：{{ getFbaInventoryQuantity(item) }}）</div>
											<el-table
												v-if="filterByRowMsku(item.restocking?.fbaValidList, item).length"
												:data="filterByRowMsku(item.restocking?.fbaValidList, item)"
												size="small"
												border
											>
												<el-table-column prop="fnsku" label="FNSKU" min-width="140" />
												<el-table-column prop="msku" label="msku" min-width="120" />
												<el-table-column prop="quantity" label="数量" min-width="80" />
												<el-table-column prop="afnFulfillableQuantity" label="可售" min-width="80" />
												<el-table-column prop="afnReservedQuantity" label="FBA预留" min-width="90" />
												<el-table-column prop="reservedFcTransfers" label="待调仓" min-width="80" />
												<el-table-column prop="reservedFcProcessing" label="调仓中" min-width="80" />
												<el-table-column prop="afnInboundReceivingQuantity" label="入库中" min-width="80" />
												<el-table-column prop="reservedCustomerorders" label="待发货" min-width="80" />
												<el-table-column prop="amazonSaleDate" label="预计可售时间" min-width="160" />
											</el-table>
											<div v-else class="summary-empty">暂无FBA库存明细</div>
										</div>
									</el-popover>
									<span class="summary-separator">/</span>
									<span class="summary-link" title="FBA预留库存">{{ getFbaReservedQuantity(item) }}</span>
									<span class="summary-separator">/</span>
									<el-popover placement="top" :width="960" trigger="hover" popper-class="summary-detail-popover">
										<template #reference>
											<span class="summary-link">{{ getRestockingFbaShippingQuantity(item) }}</span>
										</template>
										<div class="summary-detail-content">
											<div class="summary-detail-title">在途货件（合计：{{ getRestockingFbaShippingQuantity(item) }}）</div>
											<el-table
												v-if="filterByRowMsku(item.restocking?.fbaShippingList, item).length"
												:data="filterByRowMsku(item.restocking?.fbaShippingList, item)"
												size="small"
												border
											>
												<el-table-column prop="orderSn" label="货件单号" min-width="140" />
												<el-table-column prop="shippingOrderSn" label="发货单号" min-width="140" />
												<el-table-column prop="quantity" label="数量" min-width="80" />
												<el-table-column prop="logisticsChannelName" label="物流方式" min-width="140" />
												<el-table-column prop="shippingMethod" label="运输方式" min-width="120" />
												<el-table-column prop="shipmentTime" label="发货时间" min-width="160" />
												<el-table-column prop="amazonSaleDate" label="预计可售时间" min-width="160" />
											</el-table>
											<div v-else class="summary-empty">暂无在途货件</div>
										</div>
									</el-popover>
									<span class="summary-separator">/</span>
									<el-popover placement="top" :width="960" trigger="hover" popper-class="summary-detail-popover">
										<template #reference>
											<span class="summary-link">{{ item.restocking_local_valid ?? "-" }}</span>
										</template>
										<div class="summary-detail-content">
											<div class="summary-detail-title">本地可用明细（合计：{{ item.restocking_local_valid ?? 0 }}）</div>
											<el-table
												v-if="filterByRowMsku(item.restocking?.extInfo?.localValidDetailList, item, 'sku').length"
												:data="filterByRowMsku(item.restocking?.extInfo?.localValidDetailList, item, 'sku')"
												size="small"
												border
											>
												<el-table-column prop="whName" label="仓库" min-width="120" />
												<el-table-column prop="sku" label="SKU" min-width="120" />
												<el-table-column prop="storeName" label="店铺" min-width="140" />
												<el-table-column prop="quantityValid" label="可用数量" min-width="100" />
												<el-table-column prop="quantityLocked" label="锁定数量" min-width="100" />
												<el-table-column prop="quantityExpectAvailable" label="预计可用" min-width="100" />
												<el-table-column prop="amazonSaleDate" label="预计可售时间" min-width="160" />
												<el-table-column prop="remark" label="备注" min-width="160" />
											</el-table>
											<div v-else class="summary-empty">暂无本地可用明细</div>
										</div>
									</el-popover>
								</div>
							</div>
							<div class="grid-item summary-delivery-item">
								<div class="grid-label">待交付/采购<br />计划</div>
								<div class="grid-val delivery-purchase-matrix">
									<div class="dp-row">
										<span class="dp-source">艾为</span>
										<span class="dp-cell-wrap">
											<el-popover placement="top" :width="820" trigger="hover" popper-class="summary-detail-popover">
												<template #reference>
													<span class="dp-cell summary-link">{{ formatMatrixQty(getItemPendingDeliveryQty(item)) }}</span>
												</template>
												<div class="summary-detail-content">
													<div class="summary-detail-title">艾为待交付明细（合计：{{ getItemPendingDeliveryQty(item) }}）</div>
													<el-table
														v-if="item.pending_delivery_details?.length"
														:data="item.pending_delivery_details"
														size="small"
														border
														:show-summary="item.pending_delivery_details.length > 1"
														:summary-method="getPendingDeliverySummary"
													>
														<el-table-column prop="order_sn" label="采购单号" min-width="130" />
														<el-table-column label="来源" min-width="66">
															<template #default="{ row: detail }">
																<el-tag size="small" :type="getPendingDeliverySourceTagType(detail)" effect="light">{{ getPendingDeliverySourceLabel(detail) }}</el-tag>
															</template>
														</el-table-column>
														<el-table-column prop="status_text" label="状态" min-width="80">
															<template #default="{ row: detail }">
																<el-tag
																	size="small"
																	:type="getPendingDeliveryTagType(detail.status, detail.status_text)"
																	effect="light"
																>
																	{{ detail.status_text }}
																</el-tag>
															</template>
														</el-table-column>
														<el-table-column prop="supplier_name" label="供应商" min-width="100" show-overflow-tooltip />
														<el-table-column prop="quantity" label="数量" min-width="60" />
														<el-table-column prop="order_time" label="下单时间" min-width="100" show-overflow-tooltip />
														<el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
													</el-table>
													<div v-else class="summary-empty">暂无艾为待交付明细</div>
												</div>
											</el-popover>
										</span>
										<span class="dp-separator">/</span>
										<span class="dp-cell-wrap">
											<el-popover placement="top" :width="820" trigger="hover" popper-class="summary-detail-popover">
												<template #reference>
													<span class="dp-cell summary-link">{{ formatMatrixQty(getItemLocalPurchasePlanQty(item)) }}</span>
												</template>
												<div class="summary-detail-content">
													<div class="summary-detail-title">艾为采购计划明细（合计：{{ getItemLocalPurchasePlanQty(item) }}）</div>
													<el-table
														v-if="getLocalPurchasePlanDetails(item).length"
														:data="getLocalPurchasePlanDetails(item)"
														size="small"
														border
														:show-summary="getLocalPurchasePlanDetails(item).length > 1"
														:summary-method="getPurchasePlanSummary"
													>
														<el-table-column prop="plan_sn" label="计划编号" min-width="130" />
														<el-table-column label="来源" min-width="66">
															<template #default="{ row: detail }">
																<el-tag size="small" type="success" effect="light">{{ getPurchasePlanSourceLabel(detail) }}</el-tag>
															</template>
														</el-table-column>
														<el-table-column prop="status_text" label="状态" min-width="70">
															<template #default="{ row: detail }">
																<el-tag
																	size="small"
																	:type="detail.status === 121 ? 'warning' : 'primary'"
																	effect="light"
																>
																	{{ detail.status_text }}
																</el-tag>
															</template>
														</el-table-column>
														<el-table-column prop="quantity_plan" label="计划数量" min-width="70" />
														<el-table-column prop="creator_real_name" label="创建人" min-width="70" show-overflow-tooltip />
														<el-table-column prop="create_time_remote" label="创建时间" min-width="100" show-overflow-tooltip />
														<el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
													</el-table>
													<div v-else class="summary-empty">暂无艾为采购计划明细</div>
												</div>
											</el-popover>
										</span>
									</div>
									<div class="dp-row is-lingxing">
										<span class="dp-source">领星</span>
										<span class="dp-cell-wrap">
											<el-popover placement="top" :width="660" trigger="hover" popper-class="summary-detail-popover">
												<template #reference>
													<span
														class="dp-cell summary-link"
														:class="{ 'is-empty': getItemLingxingPendingDeliveryQty(item) <= 0 }"
													>{{ formatMatrixQty(getItemLingxingPendingDeliveryQty(item)) }}</span>
												</template>
												<div class="summary-detail-content">
													<div class="summary-detail-title">领星待交付明细（合计：{{ getItemLingxingPendingDeliveryQty(item) }}）</div>
													<el-table
														v-if="getLingxingPendingDeliveryDetails(item).length"
														:data="getLingxingPendingDeliveryDetails(item)"
														size="small"
														border
														:show-summary="getLingxingPendingDeliveryDetails(item).length > 1"
														:summary-method="getPendingDeliverySummary"
													>
														<el-table-column prop="order_sn" label="采购单号" min-width="130" />
														<el-table-column label="来源" min-width="66">
															<template #default="{ row: detail }">
																<el-tag size="small" :type="getPendingDeliverySourceTagType(detail)" effect="light">{{ getPendingDeliverySourceLabel(detail) }}</el-tag>
															</template>
														</el-table-column>
														<el-table-column prop="status_text" label="状态" min-width="80">
															<template #default="{ row: detail }">
																<el-tag
																	size="small"
																	:type="getPendingDeliveryTagType(detail.status, detail.status_text)"
																	effect="light"
																>
																	{{ detail.status_text || "-" }}
																</el-tag>
															</template>
														</el-table-column>
														<el-table-column prop="quantity" label="数量" min-width="60" />
														<el-table-column prop="store_name" label="店铺" min-width="110" show-overflow-tooltip />
														<el-table-column prop="warehouse_name" label="仓库" min-width="100" show-overflow-tooltip />
														<el-table-column prop="order_time" label="下单时间" min-width="100" show-overflow-tooltip />
														<el-table-column prop="amazon_sale_date" label="预计可售" min-width="100" show-overflow-tooltip />
													</el-table>
													<div v-else class="summary-empty">暂无领星待交付明细</div>
												</div>
											</el-popover>
										</span>
										<span class="dp-separator">/</span>
										<span class="dp-cell-wrap">
											<el-popover placement="top" :width="820" trigger="hover" popper-class="summary-detail-popover">
												<template #reference>
													<span class="dp-cell summary-link">{{ formatMatrixQty(getItemLingxingPurchasePlanQty(item)) }}</span>
												</template>
												<div class="summary-detail-content">
													<div class="summary-detail-title">领星采购计划明细（合计：{{ getItemLingxingPurchasePlanQty(item) }}）</div>
													<el-table
														v-if="getLingxingPurchasePlanDetails(item).length"
														:data="getLingxingPurchasePlanDetails(item)"
														size="small"
														border
														:show-summary="getLingxingPurchasePlanDetails(item).length > 1"
														:summary-method="getPurchasePlanSummary"
													>
													<el-table-column prop="plan_sn" label="计划编号" min-width="130" />
													<el-table-column label="来源" min-width="66">
														<template #default="{ row: detail }">
															<el-tag size="small" type="warning" effect="light">{{ getPurchasePlanSourceLabel(detail) }}</el-tag>
														</template>
													</el-table-column>
													<el-table-column prop="status_text" label="状态" min-width="70">
														<template #default="{ row: detail }">
															<el-tag
																size="small"
																:type="detail.status === 121 ? 'warning' : 'primary'"
																effect="light"
															>
																{{ detail.status_text }}
															</el-tag>
														</template>
													</el-table-column>
													<el-table-column prop="quantity_plan" label="计划数量" min-width="70" />
													<el-table-column prop="creator_real_name" label="创建人" min-width="70" show-overflow-tooltip />
													<el-table-column prop="create_time_remote" label="创建时间" min-width="100" show-overflow-tooltip />
													<el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
												</el-table>
												<div v-else class="summary-empty">暂无领星采购计划明细</div>
											</div>
											</el-popover>
										</span>
									</div>
								</div>
							</div>
							<div class="grid-item">
								<div class="grid-label">装箱数</div>
								<el-popover placement="top" :width="360" trigger="hover" popper-class="summary-detail-popover">
									<template #reference>
										<div class="grid-val summary-link box-pcs-value">
											<el-icon v-if="item._cgBoxPcsLoading" class="is-loading"><Loading /></el-icon>
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
												{{ item._cgBoxPcsError || item._cgBoxPcsMessage || "待查询" }}
											</span>
										</div>
										<div class="box-pcs-actions">
											<el-button size="small" :loading="item._cgBoxPcsLoading" @click="fetchBoxPcsForItem(item, true)">
												重新获取
											</el-button>
											<el-button size="small" type="primary" @click="openBoxPcsDebug(item)">调试接口</el-button>
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
											{{ item.restocking_estimated_sale_quantity ?? "-" }}
										</div>
									</template>
									<div class="summary-detail-content">
										<div class="summary-detail-section">
											<div class="summary-detail-title">预计发货量明细</div>
											<el-table
												v-if="item.restocking?.extInfo?.fbaShippingPlanDetailList?.length"
												:data="item.restocking.extInfo.fbaShippingPlanDetailList"
												size="small"
												border
											>
												<el-table-column prop="shippingPlanSn" label="发货计划单号" min-width="140" />
												<el-table-column prop="shipmentSn" label="货件号" min-width="140" />
												<el-table-column prop="shipmentOrderSn" label="发货单号" min-width="120" />
												<el-table-column prop="whName" label="发货仓库" min-width="120" />
												<el-table-column prop="quantity" label="数量" min-width="80" />
												<el-table-column prop="shippingMethodName" label="物流方式" min-width="80" />
												<el-table-column prop="shipmentDate" label="发货时间" min-width="80" />
												<el-table-column prop="amazonSaleDate" label="预计可售时间" min-width="160" />
											</el-table>
											<div v-else class="summary-empty">暂无预计发货量明细</div>
										</div>
									</div>
								</el-popover>
							</div>
							<div class="grid-item">
								<div class="grid-label">断货<br />时间</div>
								<div class="grid-val">{{ item.restocking_out_stock_date ?? "-" }}</div>
							</div>
							<div class="grid-item">
								<div class="grid-label">目标库存<br />天数</div>
								<el-tooltip :content="`0-${MAX_TARGET_STOCK_DAYS}天，输入后自动保存`" placement="top">
									<el-input
										v-model="item._targetStockDaysInput"
										type="number"
										size="small"
										class="target-days-input"
										inputmode="numeric"
										:min="0"
										:max="MAX_TARGET_STOCK_DAYS"
										:disabled="item._targetStockDaysSaving"
										:placeholder="item._targetStockDaysLoading ? '加载中' : '-'"
										@focus="item._targetStockDaysBeforeEdit = item._targetStockDaysInput"
										@input="(value) => scheduleTargetStockDaysSave(item, value)"
										@change="(value) => scheduleTargetStockDaysSave(item, value)"
										@blur="saveTargetStockDays(item)"
										@keyup.enter="saveTargetStockDays(item)"
									/>
								</el-tooltip>
							</div>
							<div class="grid-item">
								<div class="grid-label">波动<br />系数</div>
								<el-tooltip
									:content="`默认 0.75；最终系数 = (原始系数 - 1) × 波动系数 + 1，失焦或回车后保存`"
									placement="top"
								>
									<el-input
										v-model="item._volatilityCoefficientInput"
										type="number"
										size="small"
										class="volatility-coefficient-input"
										inputmode="decimal"
										:min="MIN_VOLATILITY_COEFFICIENT"
										:max="MAX_VOLATILITY_COEFFICIENT"
										:step="0.01"
										:disabled="item._volatilityCoefficientSaving"
										:placeholder="item._volatilityCoefficientLoading ? '加载中' : '0.75'"
										@focus="item._volatilityCoefficientBeforeEdit = item._volatilityCoefficientInput"
										@blur="saveVolatilityCoefficient(item)"
										@keyup.enter="saveVolatilityCoefficient(item)"
									/>
								</el-tooltip>
							</div>
							<div class="grid-item summary-rating-item">
								<div class="grid-label">评分/<br />Rating</div>
								<el-popover placement="top" :width="360" trigger="hover">
									<template #reference>
										<div class="grid-val rating-combined summary-help">
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
													<tr v-for="row in getRatingMiniRows(item)" :key="row.key">
														<th>{{ row.label }}</th>
														<td>{{ row.currentText }}</td>
														<td>{{ row.compareText }}</td>
														<td :class="['rating-mini-delta', row.trendClass]">
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
										<div class="summary-detail-title summary-rating-title">Rating总数</div>
										<div>{{ formatSummaryValue(item.reviews_num) }}</div>
									</div>
								</el-popover>
							</div>
						</div>

						<!-- 分析与发货配置操作大盘 -->
						<div class="analysis-panel" :class="{ 'is-locked': !hasGlobalCalcData }" v-if="item.shippingQuantities && item.replenishAlgo">
							<div class="panel-top">
								<div class="combined-formula-panel">
									<div class="cf-mini-metrics">
										<div class="cf-mini-item is-editable-daily">
											<span>日均消耗</span>
											<el-input-number
												v-model="item._calcDailyAvgSales"
												:min="0"
												:step="0.1"
												:precision="2"
												size="small"
												controls-position="right"
												class="calc-daily-input"
												@change="(val) => onCalcDailyAvgChange(item, val)"
											/>
										</div>
										<el-tooltip placement="bottom-start" :show-after="200" popper-class="qty-detail-tooltip">
											<template #content>
												<div class="qty-tooltip-content">
													<div class="qty-tooltip-title">周期总需求计算</div>
													<div v-html="getFormulaCycleDemandDetail(item)"></div>
												</div>
											</template>
											<div class="cf-mini-item is-help">
												<span>周期总需求</span>
												<strong>{{ getFormulaSystemParts(item).demandQty }}</strong>
											</div>
										</el-tooltip>
									</div>
									<div class="cf-formula-box">
										<el-tooltip placement="bottom-start" :show-after="200" popper-class="qty-detail-tooltip">
											<template #content>
												<div class="qty-tooltip-content">
													<div class="qty-tooltip-title">系统建议计算</div>
													<div v-html="getFormulaSystemDetail(item)"></div>
												</div>
											</template>
											<div class="cf-line is-help">
												<span class="cf-main">系统建议 <strong>{{ getItemTotalGap(item) }}</strong></span>
												<span class="cf-expression">{{ getFormulaSystemText(item) }}</span>
											</div>
										</el-tooltip>
										<el-tooltip placement="top" :show-after="200">
											<template #content>
												<div class="qty-tooltip-content">
													<div class="qty-tooltip-title">实际采购量计算</div>
													<div v-html="getItemActualPurchaseFormula(item)"></div>
												</div>
											</template>
											<div class="cf-line is-help is-actual">
												<span class="cf-main">实际采购量 <strong>{{ getItemActualPurchaseQty(item) }}</strong></span>
												<span class="cf-expression">{{ getFormulaActualPurchaseText(item) }}</span>
											</div>
										</el-tooltip>
										<el-tooltip v-if="isItemFullyCovered(item)" placement="top" :show-after="200">
											<template #content>
												<div class="qty-tooltip-content">
													<div class="qty-tooltip-title">已覆盖说明</div>
													<div v-html="getItemCoveredDetailHtml(item)"></div>
												</div>
											</template>
											<div class="covered-summary-line is-help">
												<span class="covered-summary-badge">已覆盖，无需采购</span>
												<span class="covered-summary-text">{{ getItemCoveredSummaryText(item) }}</span>
											</div>
										</el-tooltip>
									</div>
								</div>
								<div class="panel-actions is-two-line">
									<div class="pa-row">
										<el-popover
											trigger="hover"
											:width="380"
											placement="bottom-start"
											popper-class="trend-chart-popover"
											:show-after="300"
											:hide-after="100"
										>
											<template #reference>
												<span class="pa-label pa-label-hoverable">计算依据</span>
											</template>
											<div class="trend-popover-content">
												<div class="trend-popover-title">{{ item.item_name || item.local_name || item.asin }} 趋势图</div>
												<listing-trend-chart
													:product-code="item.product_code"
													:asin="item.asin"
													:marketplace="item.marketplace"
													:daily-avg-sales="getCalcDailyAvgSales(item)"
												/>
											</div>
										</el-popover>
										<el-select v-model="item.replenishAlgo" size="small" class="pa-algo-select" @change="() => onItemAlgoChange(item)">
											<el-option label="日均销量" value="daily_avg" />
											<el-option label="历史销量" value="history" />
											<el-option label="搜索词趋势" value="trend" />
											<el-option label="综合走势" value="combined" />
										</el-select>
									</div>

									<div class="pa-row pa-row-period">
										<span class="pa-label">周期</span>
										<replenish-date-picker
											v-model="item.replenishDateRange"
											:daily-avg-sales="getCalcDailyAvgSales(item)"
											:fba-valid="getFbaInventoryQuantity(item)"
											:fba-shipping-list="item.restocking?.fbaShippingList || []"
											:product-code="item.product_code"
											:asin="item.asin"
											:marketplace="item.marketplace"
											:algorithm="item.replenishAlgo || globalAlgo"
											:alpha="undefined"
											:shipping-markers="computedShippingMarkers"
											variant="detail"
											:global-start-date="getItemDatePickerGlobalStartDate(item)"
											:global-end-date="getItemDatePickerGlobalEndDate(item)"
											@change="(range) => onItemDateChange(item, range)"
										/>
									</div>
								</div>
							</div>
							<div class="analysis-main-row">
								<div class="panel-bottom">
									<div class="si-col" v-for="methodKey in sortedSelectedMethods" :key="methodKey">
									<el-checkbox
										:model-value="!item.inactiveMethods?.includes(methodKey)"
										:disabled="props.purchasePlanSyncing || item._shippingMethodPrefsSaving"
										@change="(val: any) => onItemMethodToggle(item, methodKey, Boolean(val))"
										class="method-toggle-checkbox"
									>
										<div class="si-tag" :class="{ 'is-inactive': item.inactiveMethods?.includes(methodKey) }" :style="!item.inactiveMethods?.includes(methodKey) ? { background: getShippingMethodInfo(methodKey)?.color + '15', color: getShippingMethodInfo(methodKey)?.color, borderColor: getShippingMethodInfo(methodKey)?.color + '40' } : { background: '#f5f7fa', color: '#c0c4cc', borderColor: '#e4e7ed' }">
											{{ getShippingMethodInfo(methodKey)?.icon }} {{ getShippingMethodInfo(methodKey)?.label }}
										</div>
									</el-checkbox>
									<!-- 日期范围（所有算法通用） -->
									<el-tooltip v-if="item._calcResult?.[methodKey]?.startDate" placement="top">
										<template #content>
											<div style="font-size: 12px;">
												<div style="font-weight: 600; margin-bottom: 4px;">{{ getShippingMethodInfo(methodKey)?.label }} 销售周期</div>
												<div>{{ item._calcResult[methodKey].startDate }} 至 {{ item._calcResult[methodKey].endDate }}</div>
												<div style="color: #aaa; margin-top: 2px;">共 {{ getSegmentMonthBreakdown(item._calcResult[methodKey].startDate, item._calcResult[methodKey].endDate).reduce((s, b) => s + b.days, 0) }} 天</div>
											</div>
										</template>
										<span class="alpha-date-range" style="cursor: help;">{{ item._calcResult[methodKey].startDate?.substring(5).replace(/^0/,'').replace('-','/') }}~{{ item._calcResult[methodKey].endDate?.substring(5).replace(/^0/,'').replace('-','/') }}</span>
									</el-tooltip>
									<!-- 综合走势α信息（紧凑布局） -->
									<template v-if="(item.replenishAlgo || globalAlgo) === 'combined' && item._calcResult?.[methodKey]?.monthlyCoefficients">
										<div class="alpha-info-compact">
											<!-- v-for 单元素数组：局部变量 td，整个区域只计算一次 -->
											<template v-for="td in [getAlphaTooltipData(item, methodKey)]" :key="td?.modeLabel || 'alpha-td'">
											<el-tooltip v-if="td" placement="top">
												<template #content>
													<div style="font-size: 12px; line-height: 1.8; min-width: 240px;">
														<div style="font-weight: 600; margin-bottom: 6px;">逐月α详情 (当前: {{ td.modeLabel }}模式)</div>
														<div v-for="detail in td.details" :key="detail.month" style="padding-left: 8px;">
															{{ detail.month.substring(5) }}月 × {{ detail.days }}天:
															<template v-if="detail.isNoData">按日均，综合系数强制=1</template>
															<template v-else>系统α={{ detail.systemAlpha }}<template v-if="detail.userAlpha !== null && detail.userAlpha !== undefined"> / 用户α={{ detail.userAlpha }}</template></template>
															<div v-if="detail.reasonText" style="padding-left: 12px; color: #aaa; font-size: 11px;">{{ detail.reasonText }}</div>
														</div>
														<div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 6px;">
															<div style="font-weight: 600; margin-bottom: 4px;">加权平均公式</div>
															<div style="padding-left: 8px; font-family: monospace;">
																({{ td.formulaText }})
																÷ {{ td.totalDays }}天
															</div>
															<div style="padding-left: 8px; font-weight: 700; color: #67c23a; margin-top: 4px;">
																= {{ td.valueText }}
															</div>
														</div>
														<template v-if="td.mode === 'user' && td.uniqueRemarks.length > 0">
															<div style="margin-top: 6px; padding: 4px 8px; background: rgba(230,162,60,0.1); border-radius: 4px;">
																<div v-for="(remark, remarkIndex) in td.uniqueRemarks" :key="remarkIndex" style="color: #e6a23c; font-size: 11px;">📝 {{ remark }}</div>
															</div>
														</template>
														<div v-if="td.hasUserAlpha" style="margin-top: 6px; color: #aaa; font-size: 11px;">💡 点击α标签切换到{{ td.nextModeLabel }}模式</div>
													</div>
												</template>
												<span class="alpha-sys-badge" :class="{ 'is-user': td.mode === 'user' }" @click="td.hasUserAlpha && onToggleAlphaMode(item, methodKey)">
													<span class="badge-mode">{{ td.modeLabel }}</span>
													α {{ td.displayText }}
													<span class="badge-toggle-icon" v-if="td.hasUserAlpha">⇄</span>
												</span>
											</el-tooltip>
											</template>
										</div>
										<el-tooltip placement="top">
											<template #content>
												<div style="font-size: 12px; line-height: 1.6;">修改后将用新α重算此段发货量<br/>清空则恢复加权平均值</div>
											</template>
											<div class="alpha-manual-row">
												<span class="alpha-manual-label">人工α</span>
												<span v-if="getAlphaTooltipData(item, methodKey)?.allNoData" class="alpha-manual-fixed">按日均</span>
												<el-input-number v-else v-model="item._calcResult[methodKey]._manualAlpha" :min="0" :max="1" :step="0.05" :precision="2" controls-position="right" size="small" :placeholder="String(getAlphaTooltipData(item, methodKey)?.value ?? 0.7)" style="width: 80px" @change="(val) => onManualAlphaChange(item, methodKey, val)" />
											</div>
										</el-tooltip>
									</template>
									<el-input
										:model-value="getShippingQuantityInputValue(item, methodKey)"
										type="text"
										inputmode="numeric"
										size="small"
										class="shipping-quantity-input"
										:disabled="item.inactiveMethods?.includes(methodKey)"
										@focus="beginShippingQuantityEdit(item, methodKey)"
										@update:model-value="(val: any) => setShippingQuantityInputValue(item, methodKey, val)"
										@blur="commitShippingQuantityInput(item, methodKey)"
										@keydown.enter.prevent="commitShippingQuantityInput(item, methodKey)"
									/>
									<div v-if="hasManualShippingQuantity(item, methodKey)" class="manual-qty-row">
										<el-tag size="small" type="warning" effect="plain">手动</el-tag>
										<el-tag v-if="hasShippingRedistributionEffect(item, methodKey)" size="small" type="info" effect="plain">调配</el-tag>
										<el-tooltip :content="getRestoreShippingTooltip(item, methodKey)" placement="top">
											<el-button size="small" type="primary" link @click="restoreSystemShippingQuantity(item, methodKey)">
												{{ getRestoreShippingButtonText(item, methodKey) }}
											</el-button>
										</el-tooltip>
									</div>
									<div v-else-if="hasShippingRedistributionEffect(item, methodKey)" class="manual-qty-row">
										<el-tag size="small" type="info" effect="plain">调配</el-tag>
										<span class="redistribution-effect-text">{{ getShippingRedistributionEffectText(item, methodKey) }}</span>
									</div>
									<!-- 需求/在途信息行（所有算法通用） -->
									<div v-if="item._calcResult?.[methodKey]?.startDate" class="alpha-demand-info">
										<el-tooltip placement="bottom">
										<template #content>
											<div style="font-size: 12px; line-height: 1.8; min-width: 280px;">
												<div style="font-weight: 600; margin-bottom: 4px;">建议发货明细（日均 {{ Number(getCalcDailyAvgSales(item)).toFixed(1) }}）</div>
												<div style="padding: 4px 8px; margin-bottom: 6px; background: rgba(103,194,58,0.12); border-radius: 4px;">
													<div>原始建议：<span style="color: #67c23a; font-weight: 700;">{{ getSegmentSuggestedQty(item, methodKey) }}</span></div>
													<div>艾为采购计划抵扣：<span style="color: #e6a23c; font-weight: 700;">{{ getSegmentPurchasePlanDeductedQty(item, methodKey) }}</span></div>
													<div>采购计划扣后：<span style="color: #409eff; font-weight: 700;">{{ getSegmentAfterPurchasePlanQty(item, methodKey) }}</span></div>
													<div>艾为待交付抵扣：<span style="color: #409eff; font-weight: 700;">{{ getSegmentLocalPendingDeliveryDeductedQty(item, methodKey) }}</span></div>
													<div>艾为扣后最终建议：<span style="color: #409eff; font-weight: 700;">{{ getSegmentAfterLocalDeductionsQty(item, methodKey) }}</span></div>
													<div>缺货区间：{{ getSegmentShortageLabel(item, methodKey) }}</div>
													<div>本段预计消耗：{{ item._calcResult[methodKey].expectedDemand || 0 }}</div>
													<div>已覆盖量：{{ getSegmentCoveredQty(item, methodKey) }}</div>
													<div>本段到货：{{ getSegmentArrivalQty(item, methodKey) }}</div>
													<div>消耗在途：{{ getSegmentInboundUsageQty(item, methodKey) }}</div>
												</div>
												<template v-if="getSegmentShortageRanges(item, methodKey).length">
													<div style="font-weight: 600; margin: 4px 0;">缺货区间计算</div>
													<div v-for="(range, ri) in getSegmentShortageRanges(item, methodKey)" :key="ri" style="padding-left: 8px; color: #f56c6c;">
														<div>{{ formatShortMonthDay(range.startDate) }}~{{ formatShortMonthDay(range.endDate) }} · {{ range.days }}天 · {{ range.quantity }}件</div>
														<div style="padding-left: 8px; color: #f8a7a7; font-size: 11px;">{{ getShortageRangeFormula(range) }}</div>
													</div>
												</template>
												<div v-else style="color: #67c23a; margin-bottom: 4px;">当前段库存/在途已覆盖，无建议发货</div>
												<div style="padding: 3px 8px; margin-bottom: 6px; background: rgba(64,128,255,0.15); border-radius: 4px; font-size: 11px; color: #79bbff;">
													<template v-if="(item.replenishAlgo || globalAlgo) === 'daily_avg'">本段预计消耗 = 日均销量 × 天数</template>
													<template v-else-if="(item.replenishAlgo || globalAlgo) === 'history'">历史系数 = (原始系数 - 1) × 波动系数 + 1；本段预计消耗 = 日均销量 × 最终系数 × 天数</template>
													<template v-else-if="(item.replenishAlgo || globalAlgo) === 'trend'">搜索系数 = (原始系数 - 1) × 波动系数 + 1；本段预计消耗 = 日均销量 × 最终系数 × 天数</template>
													<template v-else>综合系数 = (综合原始系数 - 1) × 波动系数 + 1；本段预计消耗 = 日均销量 × 最终系数 × 天数</template>
												</div>
												<div style="font-weight: 600; margin: 4px 0;">本段预计消耗计算</div>
												<div v-for="d in getSegmentDemandBreakdown(item, methodKey)" :key="d.month" style="padding: 2px 0; border-bottom: 1px dashed rgba(255,255,255,0.12);">
													<div>{{ getSegmentDemandTitle(d) }}</div>
													<div style="padding-left: 8px; color: #aaa; font-size: 11px;">
														{{ getSegmentDemandFormulaLine(d) }}
													</div>
												</div>
												<div style="margin-top: 6px; font-weight: 600; color: #67c23a;">本段预计消耗合计: {{ item._calcResult[methodKey].expectedDemand || 0 }}</div>
											</div>
										</template>
										<span class="suggest-tag suggest-clickable" :class="{ 'has-suggestion': getSegmentSuggestedQty(item, methodKey) > 0 }">
											建议发货 {{ getSegmentSuggestedQty(item, methodKey) }}
										</span>
									</el-tooltip>
										<span
											v-if="getSegmentPurchasePlanDeductedQty(item, methodKey) > 0"
											class="purchase-plan-deduct-tag"
										>
											采购抵扣 {{ getSegmentPurchasePlanDeductedQty(item, methodKey) }}
										</span>
										<span
											v-if="getSegmentLocalPendingDeliveryDeductedQty(item, methodKey) > 0"
											class="pending-delivery-deduct-tag"
										>
											待交付抵扣 {{ getSegmentLocalPendingDeliveryDeductedQty(item, methodKey) }}
										</span>
										<el-tooltip
											v-if="shouldShowSegmentFinalCovered(item, methodKey)"
											placement="bottom"
										>
											<template #content>
												<div style="font-size: 12px; line-height: 1.7; max-width: 320px;">
													<div style="font-weight: 600; margin-bottom: 4px;">最终已覆盖</div>
													<div>{{ getSegmentFinalCoveredText(item, methodKey) }}</div>
												</div>
											</template>
											<span class="final-covered-tag">最终已覆盖</span>
										</el-tooltip>
										<span class="shortage-tag" :class="{ 'is-covered': getSegmentSuggestedQty(item, methodKey) <= 0 }">
											{{ getSegmentShortageLabel(item, methodKey) }}
										</span>
										<el-tooltip
											placement="bottom"
											popper-class="inventory-usage-tooltip"
											:disabled="!hasSegmentInventoryUsage(item, methodKey)"
										>
											<template #content>
												<div class="inventory-usage-panel">
													<div class="inventory-usage-head">
														<span>本段库存推演</span>
														<span class="inventory-usage-head-total">消耗在途 {{ getSegmentInboundUsageQty(item, methodKey) }}</span>
													</div>
													<div class="inventory-usage-period">周期：{{ getSegmentUsagePeriod(item, methodKey) }}</div>
													<div class="inventory-usage-summary-grid">
														<div>本段需求<br /><strong>{{ getSegmentInventoryUsageSummary(item, methodKey).segmentDemand }}</strong></div>
														<div>段前FBA<br /><strong>{{ getSegmentInventoryUsageSummary(item, methodKey).openingFba }}</strong></div>
														<div>段前在途<br /><strong>{{ getSegmentInventoryUsageSummary(item, methodKey).openingInbound }}</strong></div>
														<div>本段到货<br /><strong>{{ getSegmentArrivalQty(item, methodKey) }}</strong></div>
														<div>本段覆盖<br /><strong>{{ getSegmentInventoryUsageSummary(item, methodKey).covered }}</strong></div>
														<div>本段缺口<br /><strong class="inventory-usage-shortage">{{ getSegmentInventoryUsageSummary(item, methodKey).shortage }}</strong></div>
													</div>
													<div class="inventory-usage-formula">
														{{ getSegmentInventoryUsageFormulaText(item, methodKey) }}
													</div>
													<div
														v-if="getSegmentInventoryUsageSummary(item, methodKey).openingInbound > 0 && getSegmentArrivalQty(item, methodKey) === 0"
														class="inventory-usage-note"
													>
														消耗在途来自段前已到货结余，不是本段新到货。
													</div>
													<div class="inventory-usage-table-head">
														<span>来源批次</span>
														<span>到货归属</span>
														<span>测算到库</span>
														<span class="is-num">原始</span>
														<span class="is-num">段前剩余</span>
														<span class="is-num">本段消耗</span>
														<span class="is-num">段后剩余</span>
													</div>
													<div class="inventory-usage-table-body">
														<div v-for="(s, si) in getSegmentUsageSources(item, methodKey)" :key="si" class="inventory-usage-table-row">
															<span class="is-ellipsis">{{ getInventoryUsageSourceName(s) }}</span>
															<span class="is-center">{{ getInventoryUsageRelationText(s) }}</span>
															<span class="is-center">{{ getInventoryUsageDateText(s) }}</span>
															<span class="is-num">{{ s.originalQuantity }}</span>
															<span class="is-num">{{ s.openingQuantity || 0 }}</span>
															<span class="is-num is-used">{{ s.usedQuantity }}</span>
															<span class="is-num">{{ s.remainingAfterSegment }}</span>
														</div>
														<div v-if="!getSegmentUsageSources(item, methodKey).length" class="inventory-usage-empty">暂无来源消耗明细</div>
													</div>
													<div class="inventory-usage-table-total">
														<span>合计</span>
														<span></span>
														<span></span>
														<span></span>
														<span class="is-num">{{ getSegmentInventoryUsageSummary(item, methodKey).openingAvailable }} 件</span>
														<span class="is-num">{{ getSegmentInventoryUsageSummary(item, methodKey).usedFromFba + getSegmentInventoryUsageSummary(item, methodKey).usedFromInbound }} 件</span>
														<span></span>
													</div>
												</div>
											</template>
											<span class="inventory-usage-tags">
												<span class="arrival-tag" :class="{ 'has-arrival': getSegmentArrivalQty(item, methodKey) > 0 }">
													本段到货 {{ getSegmentArrivalQty(item, methodKey) }}
												</span>
												<span class="transit-tag" :class="{ 'has-transit': getSegmentInboundUsageQty(item, methodKey) > 0 }">
													消耗在途 {{ getSegmentInboundUsageQty(item, methodKey) }}
												</span>
											</span>
										</el-tooltip>
									</div>
								</div>
									<div
										v-if="shouldShowAlgoCalcPanel(item)"
										v-loading="item._calendarDataLoading"
										class="coeff-mini-panel"
										@click="openCoeffPanel(item)"
									>
										<div class="coeff-mini-head">
											<span>{{ getAlgoPanelTitle(item) }}</span>
											<el-button size="small" link>明细</el-button>
										</div>
										<div class="coeff-mini-sub">
											日均 {{ formatCompactNumber(getCalcDailyAvgSales(item), 1) }}
										</div>
										<div v-if="isCombinedAlgo(item)" class="coeff-mini-table coeff-mini-combined-table">
											<div class="coeff-mini-row coeff-mini-header">
												<span title="月份">月</span>
												<span title="竞品销量系数">竞</span>
												<span title="搜索趋势系数">搜</span>
												<span title="综合系数">综</span>
												<span title="α值">α</span>
												<span title="月预计消耗">量</span>
											</div>
											<div
												v-for="row in getFiveMonthCombinedRows(item)"
												:key="row.key"
												class="coeff-mini-row"
												:class="{ 'is-current-month': row.isCurrentMonth, 'is-missing': !row.hasData }"
											>
												<span>{{ row.label }}</span>
												<span>{{ row.salesCoeffText }}</span>
												<span>{{ row.searchCoeffText }}</span>
												<el-tooltip placement="top" :disabled="!row.hasData">
													<template #content>
														<div style="font-size: 12px; line-height: 1.7; max-width: 360px;">
															<div style="font-weight: 600; margin-bottom: 4px;">{{ row.label }} 综合系数说明</div>
															<div>权重 α：{{ row.alphaText }}（{{ row.sourceText }}）</div>
															<div>公式：{{ row.formulaText }}</div>
															<div v-if="row.reasonText" style="margin-top: 4px; color: #cfd3dc;">{{ row.reasonText }}</div>
														</div>
													</template>
													<span class="combined-coeff">{{ row.combinedCoeffText }}</span>
												</el-tooltip>
												<el-tooltip placement="top" :disabled="!row.hasData">
													<template #content>
														<div style="font-size: 12px; line-height: 1.7; max-width: 300px;">
															<div style="font-weight: 600; margin-bottom: 4px;">{{ row.label }} α 权重说明</div>
															<div>当前 α：{{ row.alphaText }}（{{ row.sourceText }}）</div>
															<div>α 只决定销量系数和搜索系数的权重，最终发货推演使用“综”列的最终系数。</div>
															<div v-if="row.reasonText" style="margin-top: 4px; color: #cfd3dc;">{{ row.reasonText }}</div>
														</div>
													</template>
													<span class="mini-alpha">{{ row.alphaText }}</span>
												</el-tooltip>
												<span class="subtotal">{{ row.subtotalText }}</span>
											</div>
										</div>
										<div v-else class="coeff-mini-table">
											<div class="coeff-mini-row coeff-mini-simple-row coeff-mini-header">
												<span title="月份">月</span>
												<span title="天数">天</span>
												<span :title="getSimpleAlgoCoeffLabel(item)">系</span>
												<span title="预计日耗">日耗</span>
												<span title="月预计消耗">量</span>
											</div>
											<div
												v-for="row in getFiveMonthSimpleRows(item)"
												:key="row.key"
												class="coeff-mini-row coeff-mini-simple-row"
												:class="{ 'is-current-month': row.isCurrentMonth, 'is-missing': !row.hasData }"
											>
												<span>{{ row.label }}</span>
												<span>{{ row.days }}</span>
												<el-tooltip placement="top" :disabled="!row.tooltipText">
													<template #content>
														<div style="font-size: 12px; line-height: 1.7; max-width: 320px;">
															<div style="font-weight: 600; margin-bottom: 4px;">{{ row.label }} {{ getSimpleAlgoCoeffLabel(item) }}</div>
															<div>{{ row.tooltipText }}</div>
															<div v-if="row.reasonText" style="margin-top: 4px; color: #cfd3dc;">{{ row.reasonText }}</div>
														</div>
													</template>
													<span class="simple-coeff">{{ row.coeffText }}</span>
												</el-tooltip>
												<span>{{ row.dailyNeedText }}</span>
												<span class="subtotal">{{ row.subtotalText }}</span>
											</div>
										</div>
									</div>
									<div class="panel-totals" v-if="!shouldShowAlgoCalcPanel(item)">
										<el-tooltip placement="top" :show-after="200">
											<template #content>
												<div class="qty-tooltip-content">
													<div class="qty-tooltip-title">系统建议计算</div>
													<div>系统建议 = 各运输方式算法建议量合计</div>
													<div>{{ getItemSystemSuggestionFormula(item) }}</div>
												</div>
											</template>
											<div class="pt-row is-help">
												<span class="pt-label">系统建议</span>
												<span class="pt-value">{{ getItemTotalGap(item) }}</span>
											</div>
										</el-tooltip>
										<el-tooltip placement="top" :show-after="200">
											<template #content>
												<div class="qty-tooltip-content">
													<div class="qty-tooltip-title">实际采购量计算</div>
													<div>实际采购量 = max(艾为扣后分段合计 - 领星抵扣, 0) × 人工系数</div>
													<div v-html="getItemActualPurchaseFormula(item)"></div>
												</div>
											</template>
											<div class="pt-row highlight is-help">
												<span class="pt-label">实际采购量</span>
												<span class="pt-value">{{ getItemActualPurchaseQty(item) }}</span>
											</div>
										</el-tooltip>
									</div>
								</div>
							</div>
						</div>
						<!-- 人工调整底部条带 -->
						<div class="manual-adjust-strip" v-if="item.shippingQuantities && item.replenishAlgo">
							<div class="mas-main-row">
								<span class="mas-icon">🔧</span>
								<span class="mas-label">人工系数</span>
								<el-input-number
									v-model="item._manualCoefficient"
									:min="0.1" :max="10" :step="0.1" :precision="1"
									size="small" controls-position="right"
									style="width: 80px"
								/>
								<span class="mas-formula">
									× {{ getItemActualPurchaseBaseQty(item) }} =
								</span>
								<span class="mas-final">{{ getItemActualPurchaseQty(item) }}</span>
								<span class="mas-divider"></span>
								<div class="mas-field mas-adjust-mode-field">
									<span class="mas-field-label">调整方式</span>
									<div class="shipping-adjust-mode-toggle">
										<el-tooltip
											v-for="option in SHIPPING_ADJUST_MODE_OPTIONS"
											:key="option.value"
											:content="option.tooltip"
											placement="top"
											:show-after="200"
										>
											<button
												type="button"
												class="shipping-adjust-mode-btn"
												:class="{ 'is-active': getShippingAdjustMode(item) === option.value }"
												:aria-pressed="getShippingAdjustMode(item) === option.value"
												@click="setShippingAdjustMode(item, option.value)"
											>
												{{ option.label }}
											</button>
										</el-tooltip>
									</div>
								</div>
								<span class="mas-divider"></span>
								<div class="mas-field mas-warehouse-field">
									<span class="mas-field-label">采购仓库</span>
									<el-select
										:model-value="getItemWarehouseWid(item) || ''"
										size="small"
										placeholder="必选"
										filterable
										clearable
										:loading="warehouseLoading"
										:disabled="warehouseLoading || !hasWarehouseOptions"
										class="mas-warehouse-select"
										:class="{ 'is-missing': isItemWarehouseMissing(item) }"
										@change="(val: any) => onItemWarehouseChange(item, val)"
									>
										<el-option-group v-if="warehouseList.local.length > 0" label="── 本地仓 ──">
											<el-option v-for="warehouse in warehouseList.local" :key="warehouse.wid" :label="warehouse.name" :value="warehouse.wid" />
										</el-option-group>
										<el-option-group v-if="warehouseList.overseas.length > 0" label="── 海外仓 ──">
											<el-option v-for="warehouse in warehouseList.overseas" :key="warehouse.wid" :label="warehouse.name" :value="warehouse.wid" />
										</el-option-group>
										<el-option-group v-if="warehouseList.awd.length > 0" label="── AWD仓 ──">
											<el-option v-for="warehouse in warehouseList.awd" :key="warehouse.wid" :label="warehouse.name" :value="warehouse.wid" />
										</el-option-group>
									</el-select>
									<span v-if="isItemWarehouseMissing(item)" class="mas-inline-error">必选</span>
								</div>
							</div>
							<div class="mas-detail-row">
								<div class="mas-remark-group">
									<div class="mas-field">
										<span class="mas-field-label">补货备注</span>
										<el-input
											v-model="item._manualRemark"
											size="small"
											placeholder="补货备注（选填）"
											class="mas-remark"
											clearable
										/>
									</div>
									<div class="mas-field">
										<span class="mas-field-label">采购备注</span>
										<el-input
											:model-value="getProductPurchaseRemark(item)"
											size="small"
											placeholder="采购备注（领星同步，可修改）"
											class="mas-purchase-remark"
											clearable
											@input="(val: string) => onProductPurchaseRemarkInput(item, val)"
										/>
										<el-tag v-if="isProductPurchaseRemarkChanged(item)" size="small" type="warning" effect="plain" class="mas-field-tag">已改</el-tag>
									</div>
								</div>
								<div v-if="shouldShowAlgoCalcPanel(item)" class="mas-summary-totals">
									<el-tooltip placement="top" :show-after="200">
										<template #content>
											<div class="qty-tooltip-content">
												<div class="qty-tooltip-title">系统建议计算</div>
												<div>系统建议 = 各运输方式算法建议量合计</div>
												<div>{{ getItemSystemSuggestionFormula(item) }}</div>
											</div>
										</template>
										<div class="mst-item is-help">
											<span class="mst-label">系统建议</span>
											<span class="mst-value">{{ getItemTotalGap(item) }}</span>
										</div>
									</el-tooltip>
									<el-tooltip placement="top" :show-after="200">
										<template #content>
											<div class="qty-tooltip-content">
												<div class="qty-tooltip-title">实际采购量计算</div>
												<div>实际采购量 = max(艾为扣后分段合计 - 领星抵扣, 0) × 人工系数</div>
												<div v-html="getItemActualPurchaseFormula(item)"></div>
											</div>
										</template>
										<div class="mst-item highlight is-help">
											<span class="mst-label">实际采购量</span>
											<span class="mst-value">{{ getItemActualPurchaseQty(item) }}</span>
										</div>
									</el-tooltip>
								</div>
							</div>
						</div>
					</div>
				</div>
				</el-tooltip>

				<el-empty v-if="items.length === 0" description="暂无产品数据" />
			</div>

			</div> <!-- /step 1 -->

			<!-- ========== 步骤 2：确认 & 人工调整 ========== -->
			<div v-show="currentStep === 2" class="step2-container">
				<div class="step2-header">
					<div class="step2-title">
						<el-icon :size="20" style="color: #409eff"><Check /></el-icon>
						<span>确认补货计划</span>
					</div>
					<span class="step2-subtitle">请核对各产品的补货数量和备注，确认无误后点击生成单据</span>
				</div>

				<div class="step2-scroll">
					<div
						v-for="(item, idx) in step2Items"
						:key="'s2-' + idx"
						class="step2-card"
					>
						<!-- 产品信息行 -->
						<div class="s2-product-row">
							<div class="s2-index">{{ idx + 1 }}</div>
							<div class="s2-image">
								<el-image
									v-if="item.image_url_display"
									:src="item.image_url_display"
									fit="contain"
									style="width: 44px; height: 44px; border-radius: 6px"
								/>
								<div v-else class="img-placeholder-sm">
									<el-icon :size="18" color="#c0c4cc"><Picture /></el-icon>
								</div>
							</div>
							<div class="s2-info">
								<div class="s2-name">{{ item.item_name || item.local_name || '-' }}</div>
								<el-tooltip
									v-if="hasBatchReplenishLocalProductInfo(item)"
									:content="getBatchReplenishLocalProductTooltip(item)"
									placement="top"
									popper-class="batch-local-product-tooltip"
									:show-after="200"
								>
									<div class="s2-local-combined">
										<span class="s2-local-name">
											{{ getBatchReplenishLocalProductName(item) || "-" }}
										</span>
										<span
											v-if="getBatchReplenishLocalProductSku(item)"
											class="s2-local-sku"
										>
											SKU: {{ getBatchReplenishLocalProductSku(item) }}
										</span>
									</div>
								</el-tooltip>
								<div class="s2-meta">
									<el-tag size="small" type="info" effect="plain">{{ item.asin || '-' }}</el-tag>
									<span v-if="item.msku" class="s2-sku">{{ item.msku }}</span>
									<span v-if="item.local_sku" class="s2-sku">SKU: {{ item.local_sku }}</span>
								</div>
								<el-tooltip v-if="item._targetListing" placement="bottom" popper-class="cross-store-tooltip">
									<template #content>
										<div style="line-height:1.8;font-size:13px">
											<div><b>📍 数据来源（当前分析）</b></div>
											<div>店铺：{{ item.seller_name || item.shop }}</div>
											<div>ASIN：{{ item.asin }}</div>
											<div>SKU：{{ item.local_sku }}</div>
											<div>MSKU：{{ item.msku || '-' }}</div>
											<div style="margin:6px 0;border-top:1px dashed rgba(255,255,255,0.3)"></div>
											<div><b>🎯 补货目标店铺</b></div>
											<div>店铺：{{ item._targetListing.seller_name || item._targetListing.shop }}</div>
											<div>ASIN：{{ item._targetListing.asin }}</div>
											<div>SKU：{{ item._targetListing.local_sku }}</div>
											<div>MSKU：{{ item._targetListing.msku || '-' }}</div>
										</div>
									</template>
								<div class="s2-cross-store-banner">
									<div class="cs-banner-flow">
										<span class="cs-banner-source">
											<span class="cs-banner-label">数据来源</span>
											<span class="cs-banner-store">{{ item.seller_name || item.shop }}</span>
											<span class="cs-banner-asin">{{ item.asin }}</span>
										</span>
										<span class="cs-banner-arrow">➡️</span>
										<span class="cs-banner-target">
											<span class="cs-banner-label">补货到</span>
											<span class="cs-banner-store">{{ item._targetListing.seller_name || item._targetListing.shop }}</span>
											<span class="cs-banner-asin">{{ item._targetListing.asin }} · {{ item._targetListing.local_sku }}</span>
										</span>
									</div>
									<div v-if="currentStep !== 2" class="cs-banner-reset" @click.stop="delete item._targetListing" title="重置为当前店铺">
										<el-icon><Close /></el-icon>
									</div>
								</div>
								</el-tooltip>
							</div>
						</div>

						<!-- 运输分段明细 -->
						<div class="s2-shipping-row" v-if="getItemTotalShipping(item) > 0">
							<div
								v-for="methodKey in sortedSelectedMethods"
								:key="methodKey"
								class="s2-ship-chip"
								v-show="(item.shippingQuantities?.[methodKey] || 0) > 0"
							>
								<span class="s2-ship-dot" :style="{ background: getMethodColor(methodKey) }"></span>
								<span class="s2-ship-label">{{ getMethodLabel(methodKey) }}</span>
								<span class="s2-ship-qty">{{ item.shippingQuantities?.[methodKey] || 0 }}</span>
							</div>
						</div>

						<!-- 数量 & 系数 & 备注（只读确认） -->
						<div class="s2-adjust-row">
							<div class="s2-qty-section">
								<el-tooltip placement="top" :show-after="200">
									<template #content>
										<div class="qty-tooltip-content">
											<div class="qty-tooltip-title">系统建议计算</div>
											<div>系统建议 = 各运输方式算法建议量合计</div>
											<div>{{ getItemSystemSuggestionFormula(item) }}</div>
										</div>
									</template>
									<div class="s2-qty-item is-help">
										<span class="s2-qty-label">系统建议</span>
										<span class="s2-qty-value">{{ getItemTotalGap(item) }}</span>
									</div>
								</el-tooltip>
								<el-tooltip placement="top" :show-after="200">
									<template #content>
										<div class="qty-tooltip-content">
											<div class="qty-tooltip-title">实际采购量计算</div>
											<div>实际采购量 = max(艾为扣后分段合计 - 领星抵扣, 0) × 人工系数</div>
											<div v-html="getItemActualPurchaseFormula(item)"></div>
										</div>
									</template>
									<div class="s2-qty-item is-help">
										<span class="s2-qty-label">实际采购量</span>
										<span class="s2-qty-value">{{ getItemActualPurchaseQty(item) }}</span>
									</div>
								</el-tooltip>
							</div>
							<div class="s2-box-adjust-row">
								<div class="s2-box-input-wrap">
									<span class="s2-box-label">装箱数</span>
									<el-input-number
										:model-value="getBoxPcsInputValue(item)"
										:min="0"
										:max="999999"
										:step="1"
										:precision="0"
										size="small"
										controls-position="right"
										class="s2-box-input"
										:placeholder="getBoxPcsInputPlaceholder(item)"
										@change="(val: any) => onManualBoxPcsChange(item, val)"
									/>
								</div>
								<div class="s2-warehouse-wrap is-readonly" :class="{ 'is-missing': !getItemWarehouseWid(item) }">
									<span class="s2-warehouse-label">采购仓库</span>
									<span class="s2-warehouse-value">{{ getWarehouseName(getItemWarehouseWid(item)) || "未选择" }}</span>
								</div>
								<el-tooltip placement="top" :show-after="200">
									<template #content>
										<div class="qty-tooltip-content">
											<div class="qty-tooltip-title">按装箱数调整</div>
											<div v-html="getBoxAdjustmentFormula(item)"></div>
										</div>
									</template>
									<div
										class="s2-qty-item is-help s2-box-final"
										:class="{ 'has-adjustment': getBoxAdjustmentResult(item).delta !== 0 }"
									>
										<span class="s2-qty-label">按箱调整后</span>
										<span class="s2-qty-value">{{ getItemFinalPurchaseQty(item) }}</span>
									</div>
								</el-tooltip>
								<span class="s2-box-adjust-desc" :class="{ 'is-muted': !getBoxAdjustmentResult(item).hasValidBox }">
									{{ getBoxAdjustmentSummary(item) }}
								</span>
							</div>
						</div>
						<!-- 补货备注（创建采购计划备注） -->
						<div class="s2-final-remark-row">
							<span class="s2-final-remark-label">补货备注</span>
							<el-tooltip :content="getItemFinalRemark(item)" placement="top" :show-after="300" :disabled="!getItemFinalRemark(item)" effect="dark" popper-class="final-remark-tooltip">
								<div class="s2-final-remark-text">{{ getItemFinalRemark(item) || '未填写' }}</div>
							</el-tooltip>
							<el-button type="info" link size="small" @click="previewItemRemark(item)" class="s2-debug-btn">调试</el-button>
						</div>
						<!-- 采购备注（来自领星产品详情，本版只随单据保存） -->
						<div class="s2-final-remark-row s2-purchase-remark-row">
							<span class="s2-final-remark-label">采购备注</span>
							<div class="s2-final-remark-text s2-purchase-remark-text">{{ getProductPurchaseRemark(item) || '未填写' }}</div>
							<el-tag v-if="isProductPurchaseRemarkChanged(item)" size="small" type="warning" effect="plain" class="s2-purchase-remark-tag">已改</el-tag>
						</div>
					</div>

					<el-empty v-if="items.length === 0" description="暂无产品数据" />
				</div>

				<!-- 步骤2 汇总栏 -->
				<div class="step2-summary">
					<div class="summary-chip">
						<span class="chip-label">共</span>
						<span class="chip-value">{{ getStep2TotalItems() }}</span>
						<span class="chip-unit">个产品</span>
					</div>
					<el-tooltip placement="top" :show-after="200">
						<template #content>
							<div class="qty-tooltip-content">
								<div class="qty-tooltip-title">系统建议计算</div>
								<div>系统建议 = 当前确认产品的系统建议量合计</div>
							</div>
						</template>
						<div class="summary-chip is-help">
							<span class="chip-label">系统建议</span>
							<span class="chip-value">{{ getStep2SystemTotal() }}</span>
						</div>
					</el-tooltip>
					<el-tooltip placement="top" :show-after="200">
						<template #content>
							<div class="qty-tooltip-content">
								<div class="qty-tooltip-title">实际采购量计算</div>
								<div>实际采购量 = 当前确认产品艾为扣后分段合计，再扣减领星数据并乘人工系数后的合计</div>
								<div v-html="getStep2ActualPurchaseFormula()"></div>
							</div>
						</template>
						<div class="summary-chip is-help">
							<span class="chip-label">原实际采购量</span>
							<span class="chip-value">{{ getStep2ActualPurchaseTotal() }}</span>
						</div>
					</el-tooltip>
					<el-tooltip placement="top" :show-after="200">
						<template #content>
							<div class="qty-tooltip-content">
								<div class="qty-tooltip-title">装箱调整汇总</div>
								<div v-html="getStep2BoxAdjustedPurchaseFormula()"></div>
							</div>
						</template>
						<div class="summary-chip highlight is-help">
							<span class="chip-label">按箱调整后</span>
							<span class="chip-value">{{ getStep2BoxAdjustedPurchaseTotal() }}</span>
						</div>
					</el-tooltip>
					<div class="summary-chip box-delta" :class="{ 'is-zero': getStep2BoxAdjustmentDelta() === 0 }">
						<span class="chip-label">装箱调整</span>
						<span class="chip-value">{{ formatSignedQty(getStep2BoxAdjustmentDelta()) }}</span>
					</div>
					<div v-if="getStep2MissingBoxPcsCount() > 0" class="summary-chip box-warning">
						<span class="chip-value">{{ getStep2MissingBoxPcsCount() }}</span>
						<span class="chip-label">个产品未设置装箱数</span>
					</div>
				</div>
			</div>
		</div>

		<template #footer>
			<div class="batch-footer">
				<template v-if="currentStep === 1">
					<el-button @click="handleClose()" size="large">取消</el-button>
					<el-button
						type="primary"
						size="large"
						:disabled="props.purchasePlanSyncing || !hasAnyCalculation"
						@click="goToStep2"
					>
						{{ props.purchasePlanSyncing ? "等待数据刷新" : "预览确认 →" }}
					</el-button>
				</template>
				<template v-else>
					<el-button @click="currentStep = 1" size="large">
						← 返回
					</el-button>
					<el-button
						type="success"
						size="large"
						:loading="isGenerating"
						:disabled="props.purchasePlanSyncing"
						@click="generateOrders"
					>
						<template v-if="isGenerating">生成中 {{ generateProgress.current }}/{{ generateProgress.total }}</template>
						<template v-else>生成单据</template>
					</el-button>
				</template>
			</div>
		</template>
	</el-dialog>

	<!-- 生成结果弹窗 -->
	<el-dialog v-model="generateResultVisible" title="生成结果" width="1080px" :close-on-click-modal="false" :show-close="false">
		<div style="margin-bottom: 12px; color: #606266; font-size: 14px">
			共 {{ generateProgress.results.length }} 个产品，
			成功 <span style="color: #67C23A; font-weight: bold">{{ generateProgress.results.filter(r => r.success).length }}</span> 个，
			失败 <span style="color: #F56C6C; font-weight: bold">{{ generateProgress.results.filter(r => !r.success).length }}</span> 个
		</div>
		<el-table :data="generateProgress.results" size="small" border max-height="400">
			<el-table-column label="产品" min-width="160" show-overflow-tooltip>
				<template #default="{ row }">
					<div>{{ row.item_name }}</div>
					<div style="font-size: 11px; color: #909399">SKU: {{ row.local_sku }}</div>
				</template>
			</el-table-column>
			<el-table-column prop="quantity" label="数量" width="70" align="center" />
			<el-table-column prop="warehouse_name" label="采购仓库" min-width="110" show-overflow-tooltip />
			<el-table-column label="采购备注处理" min-width="240">
				<template #default="{ row }">
					<div class="remark-sync-cell">
						<el-tag :type="getPurchaseRemarkSyncTagType(row.purchase_remark_sync)" size="small">
							{{ getPurchaseRemarkSyncStatusText(row.purchase_remark_sync) }}
						</el-tag>
						<div class="remark-sync-message">{{ row.purchase_remark_sync?.message || "未取得采购备注处理结果" }}</div>
						<div v-if="row.purchase_remark_sync?.rollback_message" class="remark-sync-rollback">
							{{ row.purchase_remark_sync.rollback_message }}
						</div>
					</div>
				</template>
			</el-table-column>
			<el-table-column label="结果" min-width="240" show-overflow-tooltip>
				<template #default="{ row }">
					<el-tag
						v-if="row.success"
						:type="row.snapshot_save?.saved === false && !row.snapshot_save?.skipped ? 'warning' : 'success'"
						size="small"
					>
						{{ row.message }}
					</el-tag>
					<el-tag v-else type="danger" size="small" style="white-space: normal; height: auto; line-height: 1.4">{{ row.message }}</el-tag>
				</template>
			</el-table-column>
		</el-table>
		<template #footer>
			<!-- 全部成功：直接关闭整个弹窗 -->
			<template v-if="generateProgress.results.every(r => r.success)">
				<el-button type="primary" @click="handleClose()">完成，关闭</el-button>
			</template>
			<!-- 有失败项：两个选项 -->
			<template v-else>
				<el-button @click="handleClose()">关闭</el-button>
				<el-button type="warning" @click="generateResultVisible = false">返回修改</el-button>
			</template>
		</template>
	</el-dialog>

	<el-dialog
		v-model="bulkSettingsVisible"
		title="批量应用"
		width="720px"
		append-to-body
		:close-on-click-modal="!bulkSettingsApplying"
		class="bulk-settings-dialog"
	>
		<div class="bulk-settings-body">
			<el-alert
				:title="`已选择 ${bulkSelectedCount} 个商品`"
				type="info"
				:closable="false"
				show-icon
			/>

			<div class="bulk-settings-section">
				<div class="bulk-settings-title">
					<el-checkbox v-model="bulkSettingsForm.updateWarehouse">批量修改采购仓库</el-checkbox>
				</div>
				<div class="bulk-settings-row">
					<span class="bulk-settings-label">采购仓库</span>
					<el-select
						v-model="bulkSettingsForm.warehouseWid"
						size="small"
						placeholder="选择仓库"
						filterable
						clearable
						:loading="warehouseLoading"
						:disabled="!bulkSettingsForm.updateWarehouse || warehouseLoading || !hasWarehouseOptions"
						class="bulk-warehouse-select"
					>
						<el-option-group v-if="warehouseList.local.length > 0" label="── 本地仓 ──">
							<el-option v-for="warehouse in warehouseList.local" :key="warehouse.wid" :label="warehouse.name" :value="warehouse.wid" />
						</el-option-group>
						<el-option-group v-if="warehouseList.overseas.length > 0" label="── 海外仓 ──">
							<el-option v-for="warehouse in warehouseList.overseas" :key="warehouse.wid" :label="warehouse.name" :value="warehouse.wid" />
						</el-option-group>
						<el-option-group v-if="warehouseList.awd.length > 0" label="── AWD仓 ──">
							<el-option v-for="warehouse in warehouseList.awd" :key="warehouse.wid" :label="warehouse.name" :value="warehouse.wid" />
						</el-option-group>
					</el-select>
				</div>
				<div class="bulk-settings-hint">只修改已勾选商品的采购仓库；未启用本项时不会改仓库。</div>
			</div>

			<div class="bulk-settings-section">
				<div class="bulk-settings-title">
					<el-checkbox v-model="bulkSettingsForm.updateShipping">批量修改运输方式</el-checkbox>
				</div>
				<div class="bulk-settings-row">
					<span class="bulk-settings-label">本次操作</span>
					<el-radio-group
						v-model="bulkSettingsForm.methodAction"
						size="small"
						:disabled="!bulkSettingsForm.updateShipping"
					>
						<el-radio-button label="disable">停用</el-radio-button>
						<el-radio-button label="enable">启用</el-radio-button>
					</el-radio-group>
				</div>
				<div class="bulk-settings-subtitle">选择要处理的运输方式：</div>
				<div class="bulk-method-grid" :class="{ 'is-disabled': !bulkSettingsForm.updateShipping }">
					<div
						v-for="methodKey in sortedSelectedMethods"
						:key="methodKey"
						class="bulk-method-card"
						:class="{ 'is-selected': isBulkMethodSelected(methodKey), 'is-disabled': !bulkSettingsForm.updateShipping }"
						@click="toggleBulkMethodKey(methodKey)"
					>
						<el-checkbox
							:model-value="isBulkMethodSelected(methodKey)"
							:disabled="!bulkSettingsForm.updateShipping"
							@change="(val: any) => setBulkMethodKeySelected(methodKey, Boolean(val))"
							@click.stop
						/>
						<div class="bulk-method-icon">{{ getShippingMethodInfo(methodKey)?.icon || '📦' }}</div>
						<div class="bulk-method-body">
							<div class="bulk-method-name">{{ getShippingMethodInfo(methodKey)?.label || methodKey }}</div>
							<div class="bulk-method-days">到货约 {{ getShippingMethodInfo(methodKey)?.days || 0 }}天</div>
						</div>
					</div>
				</div>
				<div class="bulk-settings-hint">这里只启用/停用运输方式，不修改运输天数；运输方式偏好会保存到数据库。</div>
			</div>

			<div class="bulk-settings-section">
				<div class="bulk-settings-title">
					<el-checkbox v-model="bulkSettingsForm.updateTargetDays">批量修改目标库存天数</el-checkbox>
				</div>
				<div class="bulk-settings-row">
					<span class="bulk-settings-label">目标库存</span>
					<el-radio-group
						v-model="bulkSettingsForm.targetAction"
						size="small"
						:disabled="!bulkSettingsForm.updateTargetDays"
					>
						<el-radio-button label="set">设置</el-radio-button>
						<el-radio-button label="clear">清空</el-radio-button>
					</el-radio-group>
					<el-input-number
						v-model="bulkSettingsForm.targetDays"
						:min="0"
						:max="MAX_TARGET_STOCK_DAYS"
						:precision="0"
						:step="1"
						controls-position="right"
						size="small"
						class="bulk-target-input"
						:disabled="!bulkSettingsForm.updateTargetDays || bulkSettingsForm.targetAction === 'clear'"
					/>
					<span class="bulk-settings-unit">天</span>
				</div>
				<div class="bulk-settings-hint">目标库存天数会保存到数据库；清空后回到全局销售周期口径。</div>
			</div>

			<div class="bulk-settings-section">
				<div class="bulk-settings-title">
					<el-checkbox v-model="bulkSettingsForm.updateVolatility">批量修改波动系数</el-checkbox>
				</div>
				<div class="bulk-settings-row">
					<span class="bulk-settings-label">波动系数</span>
					<el-input-number
						v-model="bulkSettingsForm.volatilityCoefficient"
						:min="MIN_VOLATILITY_COEFFICIENT"
						:max="MAX_VOLATILITY_COEFFICIENT"
						:precision="2"
						:step="0.1"
						controls-position="right"
						size="small"
						class="bulk-volatility-input"
						:disabled="!bulkSettingsForm.updateVolatility"
					/>
				</div>
				<div class="bulk-settings-hint">波动系数会按产品保存；日均算法原始系数为 1，按公式调整后仍为 1。</div>
			</div>
		</div>
		<template #footer>
			<el-button :disabled="bulkSettingsApplying" @click="bulkSettingsVisible = false">取消</el-button>
			<el-button type="primary" :loading="bulkSettingsApplying" @click="applyBulkSettings">应用到已选商品</el-button>
		</template>
	</el-dialog>

	<!-- 备注预览弹窗 -->
	<el-dialog v-model="remarkPreviewVisible" :title="'系统备注预览 - ' + remarkPreviewItemName" width="900px" :close-on-click-modal="false">
		<div v-if="remarkPreviewData" class="remark-preview">
			<!-- 公式卡片 -->
			<div style="background: #f0f5ff; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px">
				<div style="font-size: 13px; color: #606266; margin-bottom: 4px">{{ remarkPreviewData.formula }}</div>
				<div style="font-size: 14px; color: #303133; font-weight: 500">{{ remarkPreviewData.summary }}</div>
				<!-- 综合走势α摘要 -->
				<div v-if="remarkPreviewData.user_selected_algo_id === 4" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #d9e3f0; font-size: 12px; color: #606266;">
					<span style="font-weight: 600; color: #409eff;">算法: 综合走势</span>
					<span style="margin-left: 12px">生效α: {{ remarkPreviewData.custom_alpha }}</span>
					<span style="margin-left: 12px">日均销量: {{ remarkPreviewData.base_daily_avg_sales?.toFixed(1) }}</span>
				</div>
			</div>

			<!-- remark_text -->
			<div style="background: #fafafa; border: 1px solid #ebeef5; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #606266; word-break: break-all">
				<strong>系统测算备注:</strong> {{ remarkPreviewData.remark_text }}
			</div>
			<div style="background: #f5f7fa; border: 1px solid #ebeef5; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #606266; word-break: break-all">
				<strong>采购备注:</strong> {{ remarkPreviewData.product_purchase_remark || '未填写' }}
				<el-tag v-if="remarkPreviewData.product_purchase_remark_changed" size="small" type="warning" effect="plain" style="margin-left: 8px">已改</el-tag>
			</div>

			<!-- 分段明细 -->
			<div v-if="remarkPreviewData.breakdown?.length" style="margin-bottom: 16px">
				<div style="font-weight: 500; margin-bottom: 8px">分段计算明细（按运输方式 + 月拆分）</div>
				<!-- 综合走势公式说明 -->
				<div v-if="remarkPreviewData.user_selected_algo_id === 4" style="background: #fdf6ec; border: 1px solid #f5dab1; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; font-size: 12px; color: #e6a23c;">
					<strong>综合走势公式：</strong>综合原始系数 = α × 销量系数 + (1-α) × 搜索系数；最终系数 = (综合原始系数 - 1) × 波动系数 + 1；最终系数 × 日均销量 = 日均需求 → × 天数 = 建议量
				</div>
				<el-table :data="remarkPreviewData.breakdown" size="small" border>
					<el-table-column prop="shipping_label" label="运输" width="60" />
					<el-table-column prop="startDate" label="开始" width="95" />
					<el-table-column prop="endDate" label="结束" width="95" />
					<el-table-column prop="days" label="天数" width="50" align="center" />
					<!-- 综合走势：显示α和分系数 -->
					<el-table-column v-if="remarkPreviewData.user_selected_algo_id === 4" label="α" width="55" align="center">
						<template #default="{ row }">
							<el-tooltip v-if="row.alpha_reason_text" :content="row.alpha_reason_text" placement="top">
								<span style="color: #409eff; cursor: help">{{ row.alpha ?? '-' }}</span>
							</el-tooltip>
							<span v-else>{{ row.alpha ?? '-' }}</span>
						</template>
					</el-table-column>
					<el-table-column v-if="remarkPreviewData.user_selected_algo_id === 4" label="销量系数" width="70" align="center">
						<template #default="{ row }"><span style="color: #67c23a">{{ row.sales_coeff ?? '-' }}</span></template>
					</el-table-column>
					<el-table-column v-if="remarkPreviewData.user_selected_algo_id === 4" label="搜索系数" width="70" align="center">
						<template #default="{ row }"><span style="color: #909399">{{ row.search_coeff ?? '-' }}</span></template>
					</el-table-column>
					<el-table-column prop="raw_coefficient" label="原始系数" width="70" align="center" />
					<el-table-column prop="volatility_coefficient" label="波动" width="60" align="center" />
					<el-table-column prop="coefficient" label="最终系数" width="70" align="center" />
					<el-table-column prop="dailyNeed" label="日均" width="60" align="center" />
					<el-table-column prop="algo_used_name" label="算法" width="80" />
					<el-table-column label="建议量" width="70" align="center">
						<template #default="{ row }"><strong>{{ row.subtotal }}</strong></template>
					</el-table-column>
				</el-table>
			</div>

			<!-- 5月窗口 -->
			<div v-if="remarkPreviewData.window_calculation?.segments?.length">
				<div style="font-weight: 500; margin-bottom: 8px">
					5月固定窗口补货需求
					<el-tag size="small" type="success" style="margin-left: 8px">{{ remarkPreviewData.window_calculation.total_window_qty }} 件</el-tag>
				</div>
				<el-table :data="remarkPreviewData.window_calculation.segments" size="small" border>
					<el-table-column prop="monthName" label="月份" width="100" />
					<el-table-column prop="days" label="天数" width="55" align="center" />
					<el-table-column prop="raw_coefficient" label="原始" width="55" align="center" />
					<el-table-column prop="volatility_coefficient" label="波动" width="55" align="center" />
					<el-table-column prop="coefficient" label="最终" width="55" align="center" />
					<el-table-column prop="daily_sales" label="日均" width="65" align="center" />
					<el-table-column prop="algo_used_name" label="算法" width="80" />
					<el-table-column label="建议量" width="70" align="center">
						<template #default="{ row }"><strong>{{ row.subtotal }}</strong></template>
					</el-table-column>
					<el-table-column prop="fallback_reason" label="降级" min-width="100" show-overflow-tooltip />
				</el-table>
			</div>
		</div>
		<template #footer>
			<el-button type="primary" @click="remarkPreviewVisible = false">关闭</el-button>
		</template>
	</el-dialog>

	<el-dialog v-model="boxPcsDebugVisible" title="装箱数接口调试" width="780px" append-to-body>
		<div v-if="boxPcsDebugItem" class="box-pcs-debug">
			<el-descriptions :column="2" border size="small">
				<el-descriptions-item label="产品ID">{{ boxPcsDebugItem.product_id || "-" }}</el-descriptions-item>
				<el-descriptions-item label="Listing ID">{{ boxPcsDebugItem.id || "-" }}</el-descriptions-item>
				<el-descriptions-item label="SKU">{{ boxPcsDebugItem.local_sku || "-" }}</el-descriptions-item>
				<el-descriptions-item label="MSKU">{{ boxPcsDebugItem.msku || "-" }}</el-descriptions-item>
				<el-descriptions-item label="装箱数">{{ getBoxPcsDisplay(boxPcsDebugItem) }}</el-descriptions-item>
				<el-descriptions-item label="状态">
					<span :class="{ 'box-pcs-error': boxPcsDebugResult && !boxPcsDebugResult.success }">
						{{ boxPcsDebugResult?.message || boxPcsDebugItem._cgBoxPcsMessage || boxPcsDebugItem._cgBoxPcsError || "待调试" }}
					</span>
				</el-descriptions-item>
			</el-descriptions>

			<div class="debug-block">
				<div class="debug-title">字段解析</div>
				<el-descriptions :column="3" border size="small" class="debug-field-descriptions">
					<el-descriptions-item label="装箱数解析值">
						<span class="debug-field-value">{{ formatDebugRawValue(boxPcsDebugResult?.cg_box_pcs ?? boxPcsDebugItem._cgBoxPcs ?? boxPcsDebugItem.cg_box_pcs) }}</span>
					</el-descriptions-item>
					<el-descriptions-item label="装箱数 product_info">
						<span class="debug-field-value">{{ formatDebugRawValue(getBoxPcsDebugProductInfoField(boxPcsDebugResult, "cg_box_pcs")) }}</span>
					</el-descriptions-item>
					<el-descriptions-item label="装箱数原始值">
						<span class="debug-field-value">{{ formatDebugRawValue(getBoxPcsDebugRawField(boxPcsDebugResult, "cg_box_pcs")) }}</span>
					</el-descriptions-item>
					<el-descriptions-item label="采购备注解析值">
						<span class="debug-field-value">{{ formatDebugRawValue(boxPcsDebugResult?.purchase_remark ?? getProductPurchaseRemark(boxPcsDebugItem)) }}</span>
					</el-descriptions-item>
					<el-descriptions-item label="采购备注 product_info">
						<span class="debug-field-value">{{ formatDebugRawValue(getBoxPcsDebugProductInfoField(boxPcsDebugResult, "purchase_remark")) }}</span>
					</el-descriptions-item>
					<el-descriptions-item label="采购备注原始值">
						<span class="debug-field-value">{{ formatDebugRawValue(getBoxPcsDebugRawField(boxPcsDebugResult, "purchase_remark")) }}</span>
					</el-descriptions-item>
				</el-descriptions>
				<div class="debug-field-hint">
					解析值是后端处理后的字段；product_info 是后端透出的轻量对象；原始值来自领星 rawResponse.data。
				</div>
			</div>

			<div class="debug-block">
				<div class="debug-title">Request</div>
				<el-input
					type="textarea"
					:model-value="formatJson(resolveBoxPcsRequestParams(boxPcsDebugItem) || {})"
					:rows="4"
					readonly
				/>
			</div>
			<div class="debug-block">
				<div class="debug-title">Response</div>
				<el-input
					type="textarea"
					:model-value="formatJson(boxPcsDebugResult || {})"
					:rows="12"
					readonly
				/>
			</div>
		</div>
		<template #footer>
			<el-button @click="boxPcsDebugVisible = false">关闭</el-button>
			<el-button type="primary" :loading="boxPcsDebugLoading" @click="runBoxPcsDebug">重新调用</el-button>
		</template>
	</el-dialog>

	<el-dialog
		v-model="coeffPanelVisible"
		:title="coeffPanelItem ? `${getAlgoPanelTitle(coeffPanelItem)}明细` : '算法测算明细'"
		width="fit-content"
		append-to-body
		class="combined-coeff-dialog"
	>
		<div v-if="coeffPanelItem" v-loading="coeffPanelItem._calendarDataLoading" class="combined-coeff-panel">
			<div class="coeff-panel-head">
				<div class="coeff-title-block">
					<el-tooltip
						:content="coeffPanelItem.item_name || coeffPanelItem.local_name || coeffPanelItem.asin"
						placement="top"
						:show-after="200"
					>
						<div class="coeff-title-text">{{ coeffPanelItem.item_name || coeffPanelItem.local_name || coeffPanelItem.asin }}</div>
					</el-tooltip>
					<div class="coeff-meta-row">
						<span class="coeff-daily">日均销量 <b>{{ formatCompactNumber(getCalcDailyAvgSales(coeffPanelItem), 1) }}</b></span>
					</div>
				</div>
			</div>
			<el-tabs v-model="coeffPanelItem._coeffPanelTab" class="coeff-tabs">
				<el-tab-pane label="5个月" name="five">
					<div v-if="isCombinedAlgo(coeffPanelItem)" class="coeff-table coeff-five-table">
						<div class="coeff-row coeff-head-row">
							<span class="table-cell table-cell-range">月份</span>
							<span class="table-cell">天数</span>
							<span class="table-cell">竞品销量系数</span>
							<span class="table-cell">搜索趋势系数</span>
							<span class="table-cell">最终系数</span>
							<span class="table-cell">α值</span>
							<span class="table-cell">预计日耗</span>
							<span class="table-cell">月预计消耗</span>
						</div>
						<div
							v-for="row in getFiveMonthCombinedRows(coeffPanelItem)"
							:key="row.key"
							class="coeff-row"
							:class="{ 'is-current-month': row.isCurrentMonth, 'is-missing': !row.hasData }"
						>
							<span class="table-cell table-cell-range">{{ row.label }}</span>
							<span class="table-cell">{{ row.days }}</span>
							<span class="table-cell sales-coeff">{{ row.salesCoeffText }}</span>
							<span class="table-cell search-coeff">{{ row.searchCoeffText }}</span>
							<span class="table-cell">
								<el-tooltip placement="top" :disabled="!row.hasData">
									<template #content>
										<div style="font-size: 12px; line-height: 1.7; max-width: 360px;">
											<div style="font-weight: 600; margin-bottom: 4px;">{{ row.label }} 综合系数说明</div>
											<div>权重 α：{{ row.alphaText }}（{{ row.sourceText }}）</div>
											<div>公式：{{ row.formulaText }}</div>
											<div v-if="row.reasonText" style="margin-top: 4px; color: #cfd3dc;">{{ row.reasonText }}</div>
										</div>
									</template>
									<span class="combined-coeff">{{ row.combinedCoeffText }}</span>
								</el-tooltip>
							</span>
							<span class="table-cell alpha-coeff" :title="`权重α：${row.alphaText}（${row.sourceText}）`">{{ row.alphaText }}</span>
							<span class="table-cell">{{ row.dailyNeedText }}</span>
							<span class="table-cell subtotal">{{ row.subtotalText }}</span>
						</div>
					</div>
					<div v-else class="coeff-table coeff-simple-five-table">
						<div class="coeff-row coeff-head-row">
							<span class="table-cell table-cell-range">月份</span>
							<span class="table-cell">天数</span>
							<span class="table-cell">{{ getSimpleAlgoCoeffLabel(coeffPanelItem) }}</span>
							<span class="table-cell">预计日耗</span>
							<span class="table-cell">月预计消耗</span>
						</div>
						<div
							v-for="row in getFiveMonthSimpleRows(coeffPanelItem)"
							:key="row.key"
							class="coeff-row"
							:class="{ 'is-current-month': row.isCurrentMonth, 'is-missing': !row.hasData }"
						>
							<span class="table-cell table-cell-range">{{ row.label }}</span>
							<span class="table-cell">{{ row.days }}</span>
							<span class="table-cell">
								<el-tooltip placement="top" :disabled="!row.tooltipText">
									<template #content>
										<div style="font-size: 12px; line-height: 1.7; max-width: 360px;">
											<div style="font-weight: 600; margin-bottom: 4px;">{{ row.label }} {{ getSimpleAlgoCoeffLabel(coeffPanelItem) }}</div>
											<div>{{ row.tooltipText }}</div>
											<div v-if="row.reasonText" style="margin-top: 4px; color: #cfd3dc;">{{ row.reasonText }}</div>
										</div>
									</template>
									<span class="simple-coeff">{{ row.coeffText }}</span>
								</el-tooltip>
							</span>
							<span class="table-cell">{{ row.dailyNeedText }}</span>
							<span class="table-cell subtotal">{{ row.subtotalText }}</span>
						</div>
					</div>
				</el-tab-pane>
				<el-tab-pane label="当前周期" name="current">
					<div v-if="getCurrentReplenishRows(coeffPanelItem).length" class="coeff-table coeff-replenish-current-table">
						<div class="coeff-row coeff-head-row">
							<span class="table-cell table-cell-range">区间</span>
							<span class="table-cell">天数</span>
							<span class="table-cell">系数</span>
							<span class="table-cell">预计日耗</span>
							<span class="table-cell">区间需求</span>
							<span class="table-cell">期内在途</span>
							<span class="table-cell">系统建议</span>
							<span class="table-cell">当前发货</span>
							<span class="table-cell table-cell-status">覆盖结果</span>
						</div>
						<div
							v-for="row in getCurrentReplenishRows(coeffPanelItem)"
							:key="row.key"
							class="coeff-row coeff-current-row"
							:class="{ 'is-missing': !row.hasData }"
						>
							<span class="table-cell table-cell-range coeff-range">
								<b>{{ row.methodLabel }}</b>
								<em>{{ row.rangeLabel }}</em>
							</span>
							<span class="table-cell">{{ row.days }}</span>
							<span class="table-cell">
								<el-tooltip placement="top" :disabled="!row.coeffTooltip">
									<template #content>
										<div class="qty-tooltip-content" v-html="row.coeffTooltip"></div>
									</template>
									<span class="simple-coeff">{{ row.coeffText }}</span>
								</el-tooltip>
							</span>
							<span class="table-cell">{{ row.dailyNeedText }}</span>
							<span class="table-cell subtotal">{{ row.demandText }}</span>
							<span class="table-cell">{{ row.inboundText }}</span>
							<span class="table-cell system-suggest">{{ row.systemText }}</span>
							<span class="table-cell current-ship">{{ row.currentText }}</span>
							<span class="table-cell table-cell-status">
								<el-tooltip placement="top" :disabled="!row.coverageTooltip">
									<template #content>
										<div class="qty-tooltip-content" v-html="row.coverageTooltip"></div>
									</template>
									<span class="coverage-status" :class="row.statusClass">{{ row.statusText }}</span>
								</el-tooltip>
							</span>
						</div>
						<div class="coeff-row coeff-total-row">
							<span class="table-cell table-cell-range">合计</span>
							<span class="table-cell">{{ getCurrentReplenishTotals(coeffPanelItem).days }}</span>
							<span class="table-cell">-</span>
							<span class="table-cell">-</span>
							<span class="table-cell subtotal">{{ getCurrentReplenishTotals(coeffPanelItem).demandText }}</span>
							<span class="table-cell">{{ getCurrentReplenishTotals(coeffPanelItem).inboundText }}</span>
							<span class="table-cell system-suggest">{{ getCurrentReplenishTotals(coeffPanelItem).systemText }}</span>
							<span class="table-cell current-ship">{{ getCurrentReplenishTotals(coeffPanelItem).currentText }}</span>
							<span class="table-cell table-cell-status">
								<span class="coverage-status" :class="getCurrentReplenishTotals(coeffPanelItem).statusClass">
									{{ getCurrentReplenishTotals(coeffPanelItem).statusText }}
								</span>
							</span>
						</div>
						<div class="current-purchase-summary">
							<div class="cps-line">
								<div class="cps-kpi">
									<span class="cps-label">系统建议</span>
									<strong>{{ getFormulaSystemParts(coeffPanelItem).systemQty }}</strong>
								</div>
								<span class="cps-formula">{{ getFormulaSystemText(coeffPanelItem) }}</span>
							</div>
							<div class="cps-line is-actual">
								<div class="cps-kpi">
									<span class="cps-label">实际采购量</span>
									<strong>{{ getItemActualPurchaseQty(coeffPanelItem) }}</strong>
								</div>
								<span class="cps-formula">{{ getFormulaActualPurchaseText(coeffPanelItem) }}</span>
							</div>
						</div>
					</div>
					<div v-else class="coeff-empty">暂无当前周期系数</div>
				</el-tab-pane>
			</el-tabs>
		</div>
	</el-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch, reactive, nextTick } from "vue";
import { Refresh, Check, Picture, Loading, Close } from "@element-plus/icons-vue";
import { useCool } from "/@/cool";
import { ElLoading, ElMessage, ElMessageBox } from "element-plus";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { convert_image_url } from "../utils";
import {
	getBatchReplenishLocalProductName,
	getBatchReplenishLocalProductSku,
	getBatchReplenishLocalProductTooltip,
	hasBatchReplenishLocalProductInfo
} from "../utils/batch-replenish-product-display";
dayjs.extend(isSameOrBefore);
import ReplenishDatePicker from "./ReplenishDatePicker.vue";
import ListingTrendChart from "./ListingTrendChart.vue";

const { service } = useCool();

type WarehouseItem = {
	wid: number;
	name: string;
};

type WarehouseGroups = {
	local: WarehouseItem[];
	overseas: WarehouseItem[];
	awd: WarehouseItem[];
};

const props = defineProps<{
	visible: boolean;
	items: any[];
	purchasePlanSyncing?: boolean;
	purchasePlanSyncError?: string;
	purchasePlanSyncProgress?: { current: number; total: number };
	purchasePlanSyncResult?: {
		status: "success" | "partial_failed" | "failed";
		total: number;
		successCount: number;
		failedCount: number;
		message: string;
		failedRows?: any[];
	} | null;
}>();

const syncHeaderTag = computed(() => {
	if (props.purchasePlanSyncing) {
		const progress = props.purchasePlanSyncProgress;
		const suffix = progress?.total ? ` ${progress.current}/${progress.total}` : "";
		return {
			type: "warning" as const,
			text: `刷新采购计划/待交付中${suffix}`
		};
	}

	const result = props.purchasePlanSyncResult;
	if (result) {
		if (result.status === "success") {
			return {
				type: "success" as const,
				text: `数据已刷新 ${result.successCount}/${result.total}`
			};
		}
		if (result.status === "partial_failed") {
			return {
				type: "warning" as const,
				text: `部分刷新失败 ${result.successCount}/${result.total}`
			};
		}
		return {
			type: "danger" as const,
			text: `数据刷新失败 ${result.successCount}/${result.total}`
		};
	}

	if (props.purchasePlanSyncError) {
		return {
			type: "danger" as const,
			text: props.purchasePlanSyncError
		};
	}

	return null;
});

const syncNotice = computed(() => {
	if (props.purchasePlanSyncing) {
		return {
			status: "syncing",
			message: "正在刷新采购计划/待交付数据，刷新完成后再计算分段，避免使用缓存旧数据。"
		};
	}
	const result = props.purchasePlanSyncResult;
	if (!result) return null;
	return {
		status: result.status,
		message: result.message
	};
});

const syncNoticeDismissed = ref(false);
const syncNoticeLeaving = ref(false);
let syncNoticeAutoDismissTimer: ReturnType<typeof setTimeout> | null = null;
let syncNoticeHideTimer: ReturnType<typeof setTimeout> | null = null;

const clearSyncNoticeTimers = () => {
	if (syncNoticeAutoDismissTimer) {
		clearTimeout(syncNoticeAutoDismissTimer);
		syncNoticeAutoDismissTimer = null;
	}
	if (syncNoticeHideTimer) {
		clearTimeout(syncNoticeHideTimer);
		syncNoticeHideTimer = null;
	}
};

const hideSyncNoticeWithAnimation = () => {
	if (props.purchasePlanSyncing || syncNoticeDismissed.value || syncNoticeLeaving.value) return;
	syncNoticeLeaving.value = true;
	syncNoticeHideTimer = setTimeout(() => {
		syncNoticeDismissed.value = true;
		syncNoticeLeaving.value = false;
		syncNoticeHideTimer = null;
	}, 280);
};

const visibleSyncNotice = computed(() => {
	const notice = syncNotice.value;
	if (!notice) return null;
	if (!props.purchasePlanSyncing && syncNoticeDismissed.value) return null;
	return notice;
});

const dismissSyncNotice = () => {
	if (props.purchasePlanSyncing) return;
	clearSyncNoticeTimers();
	hideSyncNoticeWithAnimation();
};

const canRetryPurchasePlanSync = computed(() => {
	const result = props.purchasePlanSyncResult;
	return Boolean(!props.purchasePlanSyncing && result && result.status !== "success" && result.failedCount > 0);
});

const retryFailedPurchasePlanSync = () => {
	if (!canRetryPurchasePlanSync.value) return;
	syncNoticeDismissed.value = false;
	syncNoticeLeaving.value = false;
	emit("retry-sync-failed");
};

const deferredCalculateAfterPurchasePlanSync = ref(false);
const shippingQuantityInputDrafts = ref<Record<string, string>>({});
const shippingQuantityEditBeforeDrafts = ref<Record<string, number>>({});

const deferCalculationIfPurchasePlanSyncing = () => {
	if (!props.purchasePlanSyncing) return false;
	deferredCalculateAfterPurchasePlanSync.value = true;
	return true;
};

const DEFAULT_TARGET_STOCK_DAYS = 20;
const MAX_TARGET_STOCK_DAYS = 120;
const TARGET_STOCK_DAYS_AUTO_SAVE_DELAY = 300;
const DEFAULT_VOLATILITY_COEFFICIENT = 0.75;
const MIN_VOLATILITY_COEFFICIENT = 0;
const MAX_VOLATILITY_COEFFICIENT = 10;
const DEFAULT_GLOBAL_ALGO = "combined";
const DEFAULT_LAST_SHIPPING_METHOD = "sea";
const DEFAULT_SHIPPING_BUFFER = 5;
const DEFAULT_SHIPPING_ADJUST_MODE = "independent";

type ShippingProfileKey = "default" | "uk" | "de";
type ShippingAdjustMode = "independent" | "redistribute";

type ShippingMethodConfig = {
	key: string;
	label: string;
	days: number;
	color: string;
	icon: string;
};

type ShippingProfile = {
	key: ShippingProfileKey;
	label: string;
	readonly: boolean;
	methodDays: Record<string, number>;
	selectedMethods: string[];
};

const SHIPPING_ADJUST_MODE_OPTIONS: Array<{ value: ShippingAdjustMode; label: string; tooltip: string }> = [
	{
		value: "independent",
		label: "独立调整",
		tooltip: "只改当前运输段，实际采购总量会跟着增加或减少。"
	},
	{
		value: "redistribute",
		label: "分段调配",
		tooltip: "保持总量不变：当前段增加会从其他启用运输方式扣，当前段减少会补到其他启用运输方式。"
	}
];

const DEFAULT_SHIPPING_METHOD_CONFIGS: ShippingMethodConfig[] = [
	{ key: "express", label: "快递", days: 5, color: "#FF6B9D", icon: "🚚" },
	{ key: "air", label: "空快", days: 8, color: "#409EFF", icon: "✈️" },
	{ key: "air_slow", label: "空慢", days: 10, color: "#67B8FF", icon: "✈️" },
	{ key: "truck", label: "卡车", days: 30, color: "#67C23A", icon: "🚛" },
	{ key: "rail", label: "铁路", days: 35, color: "#E6A23C", icon: "🚂" },
	{ key: "sea", label: "海运", days: 60, color: "#F56C6C", icon: "🚢" }
];

const DEFAULT_SELECTED_SHIPPING_METHODS = DEFAULT_SHIPPING_METHOD_CONFIGS.map(method => method.key);
const DEFAULT_SHIPPING_METHOD_DAYS = DEFAULT_SHIPPING_METHOD_CONFIGS.reduce((acc, method) => {
	acc[method.key] = method.days;
	return acc;
}, {} as Record<string, number>);

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

const roundCoefficient = (value: number, precision = 6) => {
	const factor = Math.pow(10, precision);
	return Math.round(value * factor) / factor;
};

const normalizeLoadedVolatilityCoefficient = (value: any) => {
	const num = Number(value);
	if (!Number.isFinite(num) || num < MIN_VOLATILITY_COEFFICIENT || num > MAX_VOLATILITY_COEFFICIENT) {
		return DEFAULT_VOLATILITY_COEFFICIENT;
	}
	return Math.round(num * 100) / 100;
};

const formatVolatilityCoefficientInput = (value: any) => {
	return normalizeLoadedVolatilityCoefficient(value).toFixed(2);
};

const getItemVolatilityCoefficient = (item: any) => {
	return normalizeLoadedVolatilityCoefficient(
		item?._volatilityCoefficient ?? item?.volatility_coefficient ?? DEFAULT_VOLATILITY_COEFFICIENT
	);
};

const applyVolatilityToCoefficient = (rawCoefficient: any, volatilityCoefficient: any) => {
	const raw = Number(rawCoefficient);
	const volatility = normalizeLoadedVolatilityCoefficient(volatilityCoefficient);
	if (!Number.isFinite(raw)) return 1;
	return roundCoefficient((raw - 1) * volatility + 1);
};

const applyItemVolatilityCoefficient = (item: any, rawCoefficient: any) => {
	return applyVolatilityToCoefficient(rawCoefficient, getItemVolatilityCoefficient(item));
};

const initItemsDefaultProps = () => {
	props.items.forEach((item, idx) => {
		if (!item.shippingQuantities) {
			item.shippingQuantities = {};
		}
		if (!item._manualShippingQuantities) {
			item._manualShippingQuantities = {};
		}
		if (!item._manualShippingGroups || typeof item._manualShippingGroups !== "object") {
			item._manualShippingGroups = {};
		}
		if (!item._shippingRedistributionEffects || typeof item._shippingRedistributionEffects !== "object") {
			item._shippingRedistributionEffects = {};
		}
		if (!item._shippingAdjustmentGroups || typeof item._shippingAdjustmentGroups !== "object") {
			item._shippingAdjustmentGroups = {};
		}
		if (item._shippingAdjustMode !== "redistribute" && item._shippingAdjustMode !== "independent") {
			item._shippingAdjustMode = DEFAULT_SHIPPING_ADJUST_MODE;
		}
		if (item._shippingAdjustModeTouched === undefined) {
			item._shippingAdjustModeTouched = false;
		}
		if (!Array.isArray(item._shippingAdjustmentLog)) {
			item._shippingAdjustmentLog = [];
		}
		if (!item.replenishAlgo) {
			item.replenishAlgo = DEFAULT_GLOBAL_ALGO;
		}
		if (!item._batchId) {
			item._batchId = `batch_${idx}_${Date.now()}`;
		}
		if (!item._calcResult) {
			item._calcResult = {}; // { express: { gap, expectedDemand, days }, air: {...}, ... }
		}
		if (!item.inactiveMethods) {
			item.inactiveMethods = [];
		}
		if (item._shippingMethodPrefsLoading === undefined) {
			item._shippingMethodPrefsLoading = false;
		}
		if (item._shippingMethodPrefsSaving === undefined) {
			item._shippingMethodPrefsSaving = false;
		}
		if (item._shippingMethodPrefsLoaded === undefined) {
			item._shippingMethodPrefsLoaded = false;
		}
		if (item._manualCoefficient === undefined) {
			item._manualCoefficient = 1.0;
		}
		if (item._manualRemark === undefined) {
			item._manualRemark = '';
		}
		if (item._productPurchaseRemarkOriginal === undefined) {
			item._productPurchaseRemarkOriginal = normalizeProductPurchaseRemark(
				item.purchase_remark ?? item.product_purchase_remark
			);
		}
		if (item._productPurchaseRemark === undefined) {
			item._productPurchaseRemark = item._productPurchaseRemarkOriginal;
		}
		if (item._productPurchaseRemarkDirty === undefined) {
			item._productPurchaseRemarkDirty = false;
		}
		if (item._calcDailyAvgSales === undefined || item._calcDailyAvgSales === null) {
			item._calcDailyAvgSales = getDailyAvgSales(item);
		}
		if (item._coeffPanelTab === undefined) {
			item._coeffPanelTab = 'current';
		}
		if (item._excluded === undefined) {
			item._excluded = false;
		}
		if (item._cgBoxPcsLoading === undefined) {
			item._cgBoxPcsLoading = false;
		}
		if (item._cgBoxPcs === undefined && item.cg_box_pcs !== undefined && item.cg_box_pcs !== null) {
			item._cgBoxPcs = item.cg_box_pcs;
		}
		if (item._cgBoxPcsLoaded === undefined) {
			item._cgBoxPcsLoaded = item._cgBoxPcs !== undefined || (item.cg_box_pcs !== undefined && item.cg_box_pcs !== null);
		}
		if (item._cgBoxPcsMessage === undefined) {
			item._cgBoxPcsMessage = "";
		}
		if (item._cgBoxPcsError === undefined) {
			item._cgBoxPcsError = "";
		}
		if (item._manualBoxPcsInput === undefined) {
			item._manualBoxPcsInput = null;
		}
		if (item._targetStockDaysLoading === undefined) {
			item._targetStockDaysLoading = false;
		}
		if (item._targetStockDaysSaving === undefined) {
			item._targetStockDaysSaving = false;
		}
		if (item._targetStockDays === undefined) {
			item._targetStockDays = item.target_days ?? null;
		}
		if (item._targetStockDaysInput === undefined) {
			item._targetStockDaysInput = item._targetStockDays === null || item._targetStockDays === undefined
				? ""
				: String(item._targetStockDays);
		}
		if (item._targetStockDaysLoaded === undefined) {
			item._targetStockDaysLoaded = item._targetStockDays !== null && item._targetStockDays !== undefined;
		}
		if (item._volatilityCoefficientLoading === undefined) {
			item._volatilityCoefficientLoading = false;
		}
		if (item._volatilityCoefficientSaving === undefined) {
			item._volatilityCoefficientSaving = false;
		}
		if (item._volatilityCoefficient === undefined) {
			item._volatilityCoefficient = normalizeLoadedVolatilityCoefficient(item.volatility_coefficient);
		}
		if (item._volatilityCoefficientInput === undefined) {
			item._volatilityCoefficientInput = formatVolatilityCoefficientInput(item._volatilityCoefficient);
		}
		if (item._volatilityCoefficientLoaded === undefined) {
			item._volatilityCoefficientLoaded = false;
		}
	});
};

const buildCalcResultFromMatch = (match: any, segment: { days: number; startDate: string; endDate: string }, extra: Record<string, any> = {}) => ({
	gap: Number(match?.gap) || 0,
	expectedDemand: Number(match?.expectedDemand) || 0,
	days: segment.days,
	startDate: segment.startDate,
	endDate: segment.endDate,
	monthlyCoefficients: match?.monthlyCoefficients || null,
	shortageStartDate: match?.shortageStartDate || null,
	shortageEndDate: match?.shortageEndDate || null,
	shortageDays: Number(match?.shortageDays) || 0,
	shortageDemand: Number(match?.shortageDemand ?? match?.gap) || 0,
	shortageRanges: Array.isArray(match?.shortageRanges) ? match.shortageRanges : [],
	preArrivalShortage: match?.preArrivalShortage || null,
	inventoryUsage: match?.inventoryUsage || null,
	...extra
});

const buildEmptyCalcResult = (segment: { days: number; startDate: string; endDate: string }, warning = "计算失败") => ({
	gap: 0,
	expectedDemand: 0,
	days: segment.days,
	startDate: segment.startDate,
	endDate: segment.endDate,
	monthlyCoefficients: null,
	shortageStartDate: null,
	shortageEndDate: null,
	shortageDays: 0,
	shortageDemand: 0,
	shortageRanges: [],
	preArrivalShortage: null,
	inventoryUsage: null,
	warning
});

const getTransferTargetMethodKey = (methodKeys: string[], inactive: Set<string>, currentIndex: number) => {
	for (let i = currentIndex + 1; i < methodKeys.length; i++) {
		const key = methodKeys[i];
		if (!inactive.has(key)) return key;
	}
	for (let i = currentIndex - 1; i >= 0; i--) {
		const key = methodKeys[i];
		if (!inactive.has(key)) return key;
	}
	return null;
};

// 核心逻辑：获取某个商品在当前勾选状态下的“有效测算结果”
// 规则：取消物流只改变发货方式，不吞掉需求；优先转给后面仍启用的较慢物流，无法后移时再转给前面的较快物流。
const getEffectiveCalcResult = (item: any, inactiveSet?: Set<string>) => {
	const inactive = inactiveSet || new Set(item.inactiveMethods || []);
	const methods = sortedSelectedMethods.value; // 从快到慢排序
	
	const effective = {} as Record<string, { gap: number; expectedDemand: number; days: number }>;
	methods.forEach(k => { effective[k] = { gap: 0, expectedDemand: 0, days: 0 }; });

	for (let index = 0; index < methods.length; index++) {
		const key = methods[index];
		const original = item._calcResult?.[key] || { gap: 0, expectedDemand: 0, days: 0 };
		const isInactive = inactive.has(key);
		const targetKey = isInactive ? getTransferTargetMethodKey(methods, inactive, index) : key;

		if (!targetKey) continue;
		effective[targetKey].gap += Math.max(0, original.gap || 0);
		effective[targetKey].expectedDemand += (original.expectedDemand || 0);
		effective[targetKey].days += (original.days || 0);
	}
	return effective;
};

const recalculateItemAfterMethodToggle = async (item: any) => {
	// 如果明细有自己的日期范围，走分段重算；否则用全局数据做前端重分配
	if (item.replenishDateRange && item.replenishDateRange.length === 2 && item.replenishDateRange[0] && item.replenishDateRange[1]) {
		await recalculateItemByDateRange(item, item.replenishDateRange[0], item.replenishDateRange[1]);
	} else {
		// 回退：从全局原始 API 数据幂等地重算
		const effective = getEffectiveCalcResult(item);
		for (const k of sortedSelectedMethods.value) {
			setShippingQuantityFromSystem(item, k, effective[k].gap);
		}
		applyPurchasePlanDeductionToItem(item);
	}
};

const setItemShippingMethodsActive = async (item: any, keys: string[], active: boolean, options: { silent?: boolean } = {}) => {
	if (item._shippingMethodPrefsSaving) return false;
	if (!item.inactiveMethods) item.inactiveMethods = [];
	if (!item.shippingQuantities) item.shippingQuantities = {};
	const methodKeys = Array.from(new Set(keys.filter(key => sortedSelectedMethods.value.includes(key))));
	if (methodKeys.length === 0) return false;

	const previousInactiveMethods = [...item.inactiveMethods];
	let nextInactiveMethods = [...item.inactiveMethods];
	methodKeys.forEach(key => {
		if (active) {
			nextInactiveMethods = nextInactiveMethods.filter((k: string) => k !== key);
		} else if (!nextInactiveMethods.includes(key)) {
			nextInactiveMethods.push(key);
		}
	});

	const changed = previousInactiveMethods.length !== nextInactiveMethods.length
		|| previousInactiveMethods.some(key => !nextInactiveMethods.includes(key));
	if (!changed) return true;

	const activeCount = sortedSelectedMethods.value.filter(methodKey => !nextInactiveMethods.includes(methodKey)).length;
	if (activeCount <= 0) {
		if (!options.silent) ElMessage.warning("至少保留一种运输方式");
		return false;
	}

	item._shippingMethodPrefsSaving = true;
	try {
		item.inactiveMethods = nextInactiveMethods;
		await recalculateItemAfterMethodToggle(item);
		await saveShippingMethodPrefs(item);
		return true;
	} catch (error: any) {
		item.inactiveMethods = previousInactiveMethods;
		await recalculateItemAfterMethodToggle(item);
		if (!options.silent) ElMessage.error(error?.message || "运输方式偏好保存失败，已回滚");
		return false;
	} finally {
		item._shippingMethodPrefsSaving = false;
	}
};

const setItemShippingMethodActive = async (item: any, key: string, active: boolean, options: { silent?: boolean } = {}) => {
	return setItemShippingMethodsActive(item, [key], active, options);
};

const onItemMethodToggle = async (item: any, key: string, val: boolean) => {
	await setItemShippingMethodActive(item, key, val);
};

// ========== 人工α修改后重算 ==========
const onManualAlphaChange = (item, methodKey, newAlpha) => {
	if (deferCalculationIfPurchasePlanSyncing()) return;
	const calcResult = item._calcResult?.[methodKey];
	if (!calcResult?.monthlyCoefficients || !calcResult.startDate || !calcResult.endDate) return;

	const breakdown = getSegmentMonthBreakdown(calcResult.startDate, calcResult.endDate);
	const dailyAvgSales = getCalcDailyAvgSales(item);
	const weighted = computeWeightedAlpha(breakdown, calcResult.monthlyCoefficients, calcResult._alphaMode || 'system');

	// 首次点击+/-时，el-input-number从undefined(0)开始算，需要修正为加权值±step
	if (calcResult._manualAlphaInited !== true && newAlpha !== null && newAlpha !== undefined) {
		calcResult._manualAlphaInited = true;
		// 首次交互：如果值和加权值偏差过大（说明是从0开始的），修正为加权值±step方向
		if (Math.abs(newAlpha - weighted.value) > 0.04) {
			// 推断用户的操作方向：newAlpha > 0 说明点的是+，否则是-
			const corrected = newAlpha > 0
				? Math.min(1, weighted.value + 0.05)
				: Math.max(0, weighted.value - 0.05);
			calcResult._manualAlpha = Math.round(corrected * 100) / 100;
			newAlpha = calcResult._manualAlpha;
			// 不return，继续走重算逻辑
		}
	}

	// 如果用户清空了人工α，用加权平均值回退
	const effectiveAlpha = (newAlpha !== null && newAlpha !== undefined)
		? Number(newAlpha)
		: weighted.value;

	// 100%复刻后端逐日库存扣减模拟
	const fbaValid = getFbaInventoryQuantity(item);
	const fbaShippingList = filterByRowMsku(item.restocking?.fbaShippingList, item);
	const calc = recalcSegmentGapWithAlpha(
		effectiveAlpha, calcResult.startDate, calcResult.endDate,
		calcResult.monthlyCoefficients, dailyAvgSales, fbaValid, fbaShippingList,
		getItemVolatilityCoefficient(item),
		{ preArrivalShortage: calcResult.preArrivalShortage, ...getPastInboundAdjustmentOptions(item) }
	);
	calcResult.gap = calc.gap;
	calcResult.expectedDemand = calc.expectedDemand;
	calcResult.shortageStartDate = calc.shortageStartDate;
	calcResult.shortageEndDate = calc.shortageEndDate;
	calcResult.shortageDays = calc.shortageDays;
	calcResult.shortageDemand = calc.shortageDemand;
	calcResult.shortageRanges = calc.shortageRanges;
	calcResult.inventoryUsage = calc.inventoryUsage;
	calcResult.preArrivalShortage = calc.preArrivalShortage;
	applyPurchasePlanDeductionToItem(item);
};

// ========== 获取某段日期范围内的在途货件 ==========
const getSegmentInTransit = (item: any, methodKey: string) => {
	const calcResult = item._calcResult?.[methodKey];
	if (!calcResult?.startDate || !calcResult?.endDate) return { total: 0, list: [] };
	const adjustment = getPastInboundAdjustmentOptions(item);
	const list = filterByRowMsku(item.restocking?.fbaShippingList, item)
		.map((shipping: any) => buildEffectiveInboundRow(shipping, adjustment));
	const startD = dayjs(calcResult.startDate);
	const endD = dayjs(calcResult.endDate);
	const matched = list.filter((s: any) => {
		const saleDate = s.effectiveAmazonSaleDate || s.amazonSaleDate;
		if (!saleDate) return false;
		const d = dayjs(saleDate);
		return (d.isAfter(startD) || d.isSame(startD, 'day')) && (d.isBefore(endD) || d.isSame(endD, 'day'));
	});
	const total = matched.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0);
	return { total, list: matched };
};

const getSegmentInventoryUsageSummary = (item: any, methodKey: string) => {
	const calcResult = item._calcResult?.[methodKey];
	const usage = calcResult?.inventoryUsage;
	const fallbackArrival = getSegmentInTransit(item, methodKey).total;
	const openingFba = Math.round(Number(usage?.openingFba) || 0);
	const openingInbound = Math.round(Number(usage?.openingInbound) || 0);
	return {
		segmentDemand: Math.round(Number(usage?.segmentDemand ?? calcResult?.expectedDemand) || 0),
		covered: Math.round(Number(usage?.covered ?? getSegmentCoveredQty(item, methodKey)) || 0),
		shortage: Math.round(Number(usage?.shortage ?? calcResult?.gap) || 0),
		arrivalsInSegment: Math.round(Number(usage?.arrivalsInSegment ?? fallbackArrival) || 0),
		openingFba,
		openingInbound,
		openingAvailable: Math.round(Number(usage?.openingAvailable ?? (openingFba + openingInbound)) || 0),
		usedFromFba: Math.round(Number(usage?.usedFromFba) || 0),
		usedFromInbound: Math.round(Number(usage?.usedFromInbound) || 0)
	};
};

const getSegmentArrivalQty = (item: any, methodKey: string) => {
	return getSegmentInventoryUsageSummary(item, methodKey).arrivalsInSegment;
};

const getSegmentInboundUsageQty = (item: any, methodKey: string) => {
	return getSegmentInventoryUsageSummary(item, methodKey).usedFromInbound;
};

const getSegmentUsageSources = (item: any, methodKey: string) => {
	const sources = item._calcResult?.[methodKey]?.inventoryUsage?.sources;
	return Array.isArray(sources) ? sources : [];
};

const hasSegmentInventoryUsage = (item: any, methodKey: string) => {
	return Boolean(item._calcResult?.[methodKey]?.inventoryUsage) || getSegmentInTransit(item, methodKey).list.length > 0;
};

const getInventoryUsageSourceName = (source: any) => {
	if (source?.sourceType === 'fba') return 'FBA库存';
	return source?.orderSn || source?.shippingOrderSn || source?.sourceName || '在途货件';
};

const getInventoryUsageRelationText = (source: any) => {
	if (source?.arrivalRelationText) return source.arrivalRelationText;
	if (source?.sourceType === 'fba') return '初始库存';
	return source?.arrivedInSegment ? '本段到货' : '段前到货';
};

const getInventoryUsageDateText = (source: any) => {
	const effectiveDate = source?.amazonSaleDate || source?.effectiveAmazonSaleDate || "-";
	if (source?.arrivalAdjusted) {
		return `${effectiveDate}（原${source.originalAmazonSaleDate || "-"}）`;
	}
	return effectiveDate;
};

const formatShortMonthDay = (date: string) => date ? dayjs(date).format('M/D') : '-';

const getSegmentUsagePeriod = (item: any, methodKey: string) => {
	const calcResult = item._calcResult?.[methodKey];
	if (!calcResult?.startDate || !calcResult?.endDate) return '-';
	return `${formatShortMonthDay(calcResult.startDate)}~${formatShortMonthDay(calcResult.endDate)}`;
};

const getSegmentInventoryUsageFormulaText = (item: any, methodKey: string) => {
	const summary = getSegmentInventoryUsageSummary(item, methodKey);
	const formulaResult = Math.max(
		0,
		summary.segmentDemand - summary.openingFba - summary.openingInbound - summary.arrivalsInSegment
	);
	const formula = `本段缺口 = 本段需求 ${summary.segmentDemand} - 段前FBA ${summary.openingFba} - 段前在途 ${summary.openingInbound} - 本段到货 ${summary.arrivalsInSegment} = ${formulaResult}`;
	if (formulaResult === summary.shortage) return formula;
	return `${formula}；逐日推演缺口 ${summary.shortage}`;
};

const getSegmentSuggestedQty = (item: any, methodKey: string) => {
	if (!item?._calcResult || item.inactiveMethods?.includes(methodKey)) return 0;
	const effective = getEffectiveCalcResult(item);
	return Math.max(0, Math.round(Number(effective[methodKey]?.gap) || 0));
};

const allocateIntegerByRatio = (
	targetTotal: number,
	capacities: Array<{ key: string; qty: number }>
) => {
	const result: Record<string, number> = {};
	for (const item of capacities) {
		result[item.key] = 0;
	}

	const valid = capacities
		.map(item => ({ key: item.key, qty: Math.max(0, Math.round(Number(item.qty) || 0)) }))
		.filter(item => item.qty > 0);
	const capacityTotal = valid.reduce((sum, item) => sum + item.qty, 0);
	const target = Math.max(0, Math.min(Math.round(Number(targetTotal) || 0), capacityTotal));
	if (target <= 0 || capacityTotal <= 0) return result;
	if (target >= capacityTotal) {
		valid.forEach(item => {
			result[item.key] = item.qty;
		});
		return result;
	}

	const rows = valid.map((item, index) => {
		const exact = target * item.qty / capacityTotal;
		const base = Math.min(item.qty, Math.floor(exact));
		return {
			...item,
			index,
			base,
			remainder: exact - base
		};
	});

	let assigned = rows.reduce((sum, item) => sum + item.base, 0);
	let left = target - assigned;
	rows
		.slice()
		.sort((a, b) => b.remainder - a.remainder || b.qty - a.qty || a.index - b.index)
		.forEach(item => {
			if (left <= 0) return;
			const add = Math.min(item.qty - item.base, left);
			item.base += add;
			left -= add;
		});

	if (left > 0) {
		rows.forEach(item => {
			if (left <= 0) return;
			const add = Math.min(item.qty - item.base, left);
			item.base += add;
			left -= add;
		});
	}

	rows.forEach(item => {
		result[item.key] = item.base;
	});
	return result;
};

const getPurchasePlanDetails = (item: any) => {
	return Array.isArray(item?.purchase_plan_details) ? item.purchase_plan_details : [];
};

const getPurchasePlanSource = (detail: any) => {
	const source = String(detail?.source || "").trim().toLowerCase();
	return source === "lingxing" ? "lingxing" : "local";
};

const getPurchasePlanSourceLabel = (detail: any) => {
	return getPurchasePlanSource(detail) === "lingxing" ? "领星" : "艾为";
};

const getLocalPurchasePlanDetails = (item: any) => {
	return getPurchasePlanDetails(item).filter(detail => getPurchasePlanSource(detail) === "local");
};

const getLingxingPurchasePlanDetails = (item: any) => {
	return getPurchasePlanDetails(item).filter(detail => getPurchasePlanSource(detail) === "lingxing");
};

const sumPurchasePlanDetailsQty = (details: any[]) => {
	return Math.max(0, Math.round(details.reduce((sum, detail) => {
		const qty = Number(detail?.quantity_plan);
		return Number.isFinite(qty) ? sum + qty : sum;
	}, 0)));
};

const getItemLocalPurchasePlanQty = (item: any) => {
	const details = getPurchasePlanDetails(item);
	if (!details.length) return Math.max(0, Math.round(Number(item?.purchase_plan_qty) || 0));
	return sumPurchasePlanDetailsQty(getLocalPurchasePlanDetails(item));
};

const getItemLingxingPurchasePlanQty = (item: any) => {
	return sumPurchasePlanDetailsQty(getLingxingPurchasePlanDetails(item));
};

const getLingxingPendingDeliveryDetails = (item: any) => {
	return Array.isArray(item?.lingxing_pending_delivery_details) ? item.lingxing_pending_delivery_details : [];
};

const getItemLingxingPendingDeliveryQty = (item: any) => {
	const details = getLingxingPendingDeliveryDetails(item);
	if (details.length) {
		return Math.max(0, Math.round(details.reduce((sum, detail) => {
			const qty = Number(detail?.quantity);
			return Number.isFinite(qty) ? sum + qty : sum;
		}, 0)));
	}
	return Math.max(0, Math.round(Number(item?.lingxing_pending_delivery_qty) || 0));
};

const formatMatrixQty = (value: any) => {
	const qty = Math.max(0, Math.round(Number(value) || 0));
	return qty > 0 ? String(qty) : "-";
};

const buildDeductionLayerSummary = (sourceQty: number, capacities: Array<{ key: string; qty: number }>) => {
	const normalizedCapacities = capacities.map(item => ({
		key: item.key,
		qty: Math.max(0, Math.round(Number(item.qty) || 0))
	}));
	const sourceTotal = Math.max(0, Math.round(Number(sourceQty) || 0));
	const capacityTotal = normalizedCapacities.reduce((sum, item) => sum + item.qty, 0);
	const deductedTotal = Math.min(sourceTotal, capacityTotal);
	const afterTotal = Math.max(0, capacityTotal - deductedTotal);
	const remainingMap = allocateIntegerByRatio(afterTotal, normalizedCapacities);
	const deductedMap: Record<string, number> = {};

	normalizedCapacities.forEach(item => {
		deductedMap[item.key] = Math.max(0, item.qty - (remainingMap[item.key] || 0));
	});

	return {
		sourceTotal,
		capacityTotal,
		deductedTotal,
		afterTotal,
		excessQty: Math.max(0, sourceTotal - deductedTotal),
		remainingMap,
		deductedMap
	};
};

const getItemPurchasePlanDeductionSummary = (item: any) => {
	const capacities = sortedSelectedMethods.value
		.filter(key => !item.inactiveMethods?.includes(key))
		.map(key => ({
			key,
			qty: getSegmentSuggestedQty(item, key)
		}));
	const purchasePlanQty = getItemLocalPurchasePlanQty(item);
	const summary = buildDeductionLayerSummary(purchasePlanQty, capacities);

	return {
		systemTotal: summary.capacityTotal,
		purchasePlanQty,
		deductedTotal: summary.deductedTotal,
		afterPurchasePlanTotal: summary.afterTotal,
		excessQty: summary.excessQty,
		remainingMap: summary.remainingMap,
		deductedMap: summary.deductedMap
	};
};

const getItemLocalPendingDeliveryDeductionSummary = (item: any) => {
	const purchasePlanSummary = getItemPurchasePlanDeductionSummary(item);
	const capacities = sortedSelectedMethods.value
		.filter(key => !item.inactiveMethods?.includes(key))
		.map(key => ({
			key,
			qty: purchasePlanSummary.remainingMap[key] || 0
		}));
	const pendingDeliveryQty = getItemPendingDeliveryQty(item);
	const summary = buildDeductionLayerSummary(pendingDeliveryQty, capacities);

	return {
		pendingDeliveryQty,
		deductedTotal: summary.deductedTotal,
		afterLocalDeductionsTotal: summary.afterTotal,
		excessQty: summary.excessQty,
		remainingMap: summary.remainingMap,
		deductedMap: summary.deductedMap
	};
};

const getSegmentPurchasePlanDeductedQty = (item: any, methodKey: string) => {
	return getItemPurchasePlanDeductionSummary(item).deductedMap[methodKey] || 0;
};

const getSegmentAfterPurchasePlanQty = (item: any, methodKey: string) => {
	return getItemPurchasePlanDeductionSummary(item).remainingMap[methodKey] || 0;
};

const getSegmentLocalPendingDeliveryDeductedQty = (item: any, methodKey: string) => {
	return getItemLocalPendingDeliveryDeductionSummary(item).deductedMap[methodKey] || 0;
};

const getSegmentAfterLocalDeductionsQty = (item: any, methodKey: string) => {
	if (item?.shippingQuantities && Object.prototype.hasOwnProperty.call(item.shippingQuantities, methodKey)) {
		return Math.max(0, Math.round(Number(item.shippingQuantities[methodKey]) || 0));
	}
	return getItemLocalPendingDeliveryDeductionSummary(item).remainingMap[methodKey] || 0;
};

const ensureManualShippingQuantities = (item: any) => {
	if (!item._manualShippingQuantities || typeof item._manualShippingQuantities !== "object") {
		item._manualShippingQuantities = {};
	}
	return item._manualShippingQuantities as Record<string, number>;
};

const ensureManualShippingGroups = (item: any) => {
	if (!item._manualShippingGroups || typeof item._manualShippingGroups !== "object") {
		item._manualShippingGroups = {};
	}
	return item._manualShippingGroups as Record<string, string>;
};

const ensureShippingRedistributionEffects = (item: any) => {
	if (!item._shippingRedistributionEffects || typeof item._shippingRedistributionEffects !== "object") {
		item._shippingRedistributionEffects = {};
	}
	return item._shippingRedistributionEffects as Record<string, any>;
};

const ensureShippingAdjustmentGroups = (item: any) => {
	if (!item._shippingAdjustmentGroups || typeof item._shippingAdjustmentGroups !== "object") {
		item._shippingAdjustmentGroups = {};
	}
	return item._shippingAdjustmentGroups as Record<string, any>;
};

const hasManualShippingQuantity = (item: any, methodKey: string) => {
	return Boolean(
		item?._manualShippingQuantities
		&& Object.prototype.hasOwnProperty.call(item._manualShippingQuantities, methodKey)
	);
};

const getManualShippingQuantity = (item: any, methodKey: string) => {
	if (!hasManualShippingQuantity(item, methodKey)) return null;
	return Math.max(0, Math.round(Number(item._manualShippingQuantities[methodKey]) || 0));
};

const hasShippingRedistributionEffect = (item: any, methodKey: string) => {
	return Boolean(
		item?._shippingRedistributionEffects
		&& Object.prototype.hasOwnProperty.call(item._shippingRedistributionEffects, methodKey)
	);
};

const getShippingRedistributionEffect = (item: any, methodKey: string) => {
	if (!hasShippingRedistributionEffect(item, methodKey)) return null;
	return item._shippingRedistributionEffects[methodKey] || null;
};

const getShippingRedistributionEffectQuantity = (item: any, methodKey: string) => {
	const effect = getShippingRedistributionEffect(item, methodKey);
	if (!effect) return null;
	return Math.max(0, Math.round(Number(effect.quantity) || 0));
};

const normalizeShippingQuantity = (value: any) => Math.max(0, Math.round(Number(value) || 0));

const getShippingAdjustMode = (item: any): ShippingAdjustMode => {
	return item?._shippingAdjustMode === "redistribute" ? "redistribute" : "independent";
};

const setShippingAdjustMode = (item: any, mode: ShippingAdjustMode) => {
	if (!item || (mode !== "independent" && mode !== "redistribute")) return;
	item._shippingAdjustMode = mode;
	item._shippingAdjustModeTouched = true;
};

const getShippingAdjustModeLabel = (mode: ShippingAdjustMode) => {
	return SHIPPING_ADJUST_MODE_OPTIONS.find(option => option.value === mode)?.label || "独立调整";
};

const getActiveShippingMethodKeys = (item: any) => {
	return sortedSelectedMethods.value.filter(key => !item.inactiveMethods?.includes(key));
};

const getSystemShippingQuantity = (item: any, methodKey: string) => {
	if (item.inactiveMethods?.includes(methodKey)) return 0;
	return normalizeShippingQuantity(getItemLocalPendingDeliveryDeductionSummary(item).remainingMap[methodKey] || 0);
};

const syncShippingManualFlag = (item: any) => {
	const manualMap = ensureManualShippingQuantities(item);
	item._shippingQuantityManual = Object.keys(manualMap).length > 0;
};

const clearShippingRedistributionEffect = (item: any, methodKey: string) => {
	const effects = ensureShippingRedistributionEffects(item);
	delete effects[methodKey];
};

const setManualShippingQuantity = (item: any, methodKey: string, qty: number, groupId?: string | null) => {
	const manualMap = ensureManualShippingQuantities(item);
	manualMap[methodKey] = normalizeShippingQuantity(qty);
	const manualGroups = ensureManualShippingGroups(item);
	if (groupId) {
		manualGroups[methodKey] = groupId;
	} else {
		delete manualGroups[methodKey];
	}
	clearShippingRedistributionEffect(item, methodKey);
	syncShippingManualFlag(item);
};

const setShippingRedistributionEffect = (
	item: any,
	methodKey: string,
	qty: number,
	groupId: string,
	triggerMethodKey: string
) => {
	const effects = ensureShippingRedistributionEffects(item);
	effects[methodKey] = {
		group_id: groupId,
		trigger_method: triggerMethodKey,
		quantity: normalizeShippingQuantity(qty)
	};
};

const getCurrentShippingQuantity = (item: any, methodKey: string) => {
	return normalizeShippingQuantity(item?.shippingQuantities?.[methodKey]);
};

const getShippingQuantityDraftKey = (item: any, methodKey: string) => {
	const itemKey = item?._batchId || item?.listing_id || item?.id || item?.asin || item?.msku || "row";
	return `${itemKey}:${methodKey}`;
};

const hasShippingQuantityDraft = (draftKey: string) => Object.prototype.hasOwnProperty.call(shippingQuantityInputDrafts.value, draftKey);

const hasShippingQuantityEditBeforeDraft = (draftKey: string) => Object.prototype.hasOwnProperty.call(shippingQuantityEditBeforeDrafts.value, draftKey);

const normalizeShippingQuantityInputText = (value: any) => String(value ?? "").replace(/[^\d]/g, "");

const rememberShippingQuantityBeforeEdit = (item: any, methodKey: string) => {
	const draftKey = getShippingQuantityDraftKey(item, methodKey);
	if (hasShippingQuantityEditBeforeDraft(draftKey)) return;
	shippingQuantityEditBeforeDrafts.value = {
		...shippingQuantityEditBeforeDrafts.value,
		[draftKey]: getCurrentShippingQuantity(item, methodKey)
	};
};

const clearShippingQuantityEditBefore = (item: any, methodKey: string) => {
	const draftKey = getShippingQuantityDraftKey(item, methodKey);
	if (!hasShippingQuantityEditBeforeDraft(draftKey)) return;
	const { [draftKey]: _removed, ...rest } = shippingQuantityEditBeforeDrafts.value;
	shippingQuantityEditBeforeDrafts.value = rest;
};

const consumeShippingQuantityBeforeEdit = (item: any, methodKey: string) => {
	const draftKey = getShippingQuantityDraftKey(item, methodKey);
	if (!hasShippingQuantityEditBeforeDraft(draftKey)) return undefined;
	const value = shippingQuantityEditBeforeDrafts.value[draftKey];
	clearShippingQuantityEditBefore(item, methodKey);
	return value;
};

const getShippingQuantityInputValue = (item: any, methodKey: string) => {
	const draftKey = getShippingQuantityDraftKey(item, methodKey);
	if (hasShippingQuantityDraft(draftKey)) {
		return shippingQuantityInputDrafts.value[draftKey];
	}
	return String(getCurrentShippingQuantity(item, methodKey));
};

const beginShippingQuantityEdit = (item: any, methodKey: string) => {
	rememberShippingQuantityBeforeEdit(item, methodKey);
	const draftKey = getShippingQuantityDraftKey(item, methodKey);
	if (!hasShippingQuantityDraft(draftKey)) {
		shippingQuantityInputDrafts.value = {
			...shippingQuantityInputDrafts.value,
			[draftKey]: String(getCurrentShippingQuantity(item, methodKey))
		};
	}
};

const setShippingQuantityInputValue = (item: any, methodKey: string, value: any) => {
	const draftKey = getShippingQuantityDraftKey(item, methodKey);
	shippingQuantityInputDrafts.value = {
		...shippingQuantityInputDrafts.value,
		[draftKey]: normalizeShippingQuantityInputText(value)
	};
};

const clearShippingQuantityInputValue = (item: any, methodKey: string) => {
	const draftKey = getShippingQuantityDraftKey(item, methodKey);
	if (!hasShippingQuantityDraft(draftKey)) return;
	const { [draftKey]: _removed, ...rest } = shippingQuantityInputDrafts.value;
	shippingQuantityInputDrafts.value = rest;
};

const commitShippingQuantityInput = (item: any, methodKey: string) => {
	if (item.inactiveMethods?.includes(methodKey)) {
		clearShippingQuantityInputValue(item, methodKey);
		clearShippingQuantityEditBefore(item, methodKey);
		return;
	}
	const draftKey = getShippingQuantityDraftKey(item, methodKey);
	if (!hasShippingQuantityDraft(draftKey)) return;
	const nextValue = normalizeShippingQuantity(shippingQuantityInputDrafts.value[draftKey]);
	const rememberedOldVal = consumeShippingQuantityBeforeEdit(item, methodKey);
	const currentValue = getCurrentShippingQuantity(item, methodKey);
	const oldValue = rememberedOldVal ?? currentValue;

	if (nextValue === currentValue) {
		clearShippingQuantityInputValue(item, methodKey);
		return;
	}

	onShippingQuantityChange(item, methodKey, nextValue, oldValue);
	clearShippingQuantityInputValue(item, methodKey);
};

const getItemTotalShippingWithOverrides = (item: any, overrides: Record<string, number> = {}) => {
	let total = 0;
	for (const key of sortedSelectedMethods.value) {
		if (item.inactiveMethods?.includes(key)) continue;
		const value = Object.prototype.hasOwnProperty.call(overrides, key)
			? overrides[key]
			: item.shippingQuantities?.[key];
		total += normalizeShippingQuantity(value);
	}
	return total;
};

const buildShippingQuantitySnapshot = (item: any) => {
	return getActiveShippingMethodKeys(item).reduce((acc, key) => {
		acc[key] = getCurrentShippingQuantity(item, key);
		return acc;
	}, {} as Record<string, number>);
};

const cloneRedistributionEffects = (effects: Record<string, any>) => {
	return Object.entries(effects).reduce((acc, [key, value]) => {
		acc[key] = value && typeof value === "object" ? { ...value } : value;
		return acc;
	}, {} as Record<string, any>);
};

const pickRecordKeys = (record: Record<string, any>, keys: string[]) => {
	return keys.reduce((acc, key) => {
		if (Object.prototype.hasOwnProperty.call(record, key)) {
			const value = record[key];
			acc[key] = value && typeof value === "object" ? { ...value } : value;
		}
		return acc;
	}, {} as Record<string, any>);
};

const createShippingAdjustmentGroupId = () => {
	return `ship_adj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const getShippingAdjustmentGroupDependencyIds = (group: any) => {
	const ids = Array.isArray(group?.depends_on_group_ids) ? group.depends_on_group_ids : [];
	return ids.map((id: any) => String(id || "").trim()).filter(Boolean);
};

const collectShippingAdjustmentDependencyIds = (
	groupId: string,
	affectedMethods: string[],
	beforeManualGroups: Record<string, string>,
	beforeRedistributionEffects: Record<string, any>
) => {
	const deps = new Set<string>();
	affectedMethods.forEach(key => {
		const manualGroupId = String(beforeManualGroups?.[key] || "").trim();
		if (manualGroupId && manualGroupId !== groupId) deps.add(manualGroupId);

		const effectGroupId = String(beforeRedistributionEffects?.[key]?.group_id || "").trim();
		if (effectGroupId && effectGroupId !== groupId) deps.add(effectGroupId);
	});
	return Array.from(deps);
};

const collectDependentShippingAdjustmentGroupIds = (item: any, groupId: string) => {
	const groups = ensureShippingAdjustmentGroups(item);
	const result: string[] = [];
	const visited = new Set<string>();

	const visit = (currentGroupId: string) => {
		for (const [candidateId, group] of Object.entries(groups) as [string, any][]) {
			if (candidateId === currentGroupId || visited.has(candidateId)) continue;
			if (!getShippingAdjustmentGroupDependencyIds(group).includes(currentGroupId)) continue;
			visited.add(candidateId);
			visit(candidateId);
			result.push(candidateId);
		}
	};

	visit(groupId);
	return result;
};

const resetExistingTriggerRedistributionGroupForUpdate = (item: any, methodKey: string) => {
	const manualGroups = ensureManualShippingGroups(item);
	const groupId = manualGroups[methodKey];
	if (!groupId) return null;

	const group = ensureShippingAdjustmentGroups(item)[groupId];
	if (!group || group.trigger_method !== methodKey) return null;

	const baseQty = normalizeShippingQuantity(group.before_quantities?.[methodKey] ?? getCurrentShippingQuantity(item, methodKey));
	restoreShippingAdjustmentGroup(item, groupId, { silentLog: true });
	return { baseQty };
};

const getRedistributionDonorKeys = (item: any, methodKey: string) => {
	const active = new Set(getActiveShippingMethodKeys(item));
	const methods = sortedSelectedMethods.value;
	const index = methods.indexOf(methodKey);
	if (index < 0) return [];
	const slower = methods.slice(index + 1).filter(key => active.has(key));
	const faster = methods.slice(0, index).reverse().filter(key => active.has(key));
	return [...slower, ...faster];
};

const getRedistributionReceiverKey = (item: any, methodKey: string) => {
	const active = new Set(getActiveShippingMethodKeys(item));
	const methods = sortedSelectedMethods.value;
	const index = methods.indexOf(methodKey);
	if (index < 0) return null;
	return methods.slice(index + 1).find(key => active.has(key))
		|| methods.slice(0, index).reverse().find(key => active.has(key))
		|| null;
};

const recordShippingAdjustment = (item: any, log: Record<string, any>) => {
	if (!Array.isArray(item._shippingAdjustmentLog)) item._shippingAdjustmentLog = [];
	item._shippingAdjustmentLog = [
		...item._shippingAdjustmentLog.slice(-19),
		{
			changed_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
			...log
		}
	];
};

const pruneSystemMatchedManualShippingQuantities = (item: any, methodKeys: string[]) => {
	const manualMap = ensureManualShippingQuantities(item);
	const manualGroups = ensureManualShippingGroups(item);
	for (const key of methodKeys) {
		if (!Object.prototype.hasOwnProperty.call(manualMap, key)) continue;
		if (item.inactiveMethods?.includes(key)) continue;
		if (getCurrentShippingQuantity(item, key) === getSystemShippingQuantity(item, key)) {
			delete manualMap[key];
			delete manualGroups[key];
		}
	}
	syncShippingManualFlag(item);
};

const restoreSingleShippingAdjustmentGroup = (item: any, groupId: string, options: { silentLog?: boolean } = {}) => {
	const groups = ensureShippingAdjustmentGroups(item);
	const group = groups[groupId];
	if (!group) return false;
	if (!item.shippingQuantities) item.shippingQuantities = {};

	const manualMap = ensureManualShippingQuantities(item);
	const manualGroups = ensureManualShippingGroups(item);
	const effects = ensureShippingRedistributionEffects(item);
	const affectedKeys = Array.isArray(group.affected_methods) ? group.affected_methods : [];
	const totalBefore = getItemTotalShipping(item);
	for (const key of affectedKeys) {
		const beforeQty = normalizeShippingQuantity(group.before_quantities?.[key]);
		item.shippingQuantities[key] = item.inactiveMethods?.includes(key) ? 0 : beforeQty;

		if (Object.prototype.hasOwnProperty.call(group.before_manual_quantities || {}, key)) {
			manualMap[key] = normalizeShippingQuantity(group.before_manual_quantities[key]);
		} else {
			delete manualMap[key];
		}

		if (Object.prototype.hasOwnProperty.call(group.before_manual_groups || {}, key)) {
			manualGroups[key] = group.before_manual_groups[key];
		} else {
			delete manualGroups[key];
		}

		if (Object.prototype.hasOwnProperty.call(group.before_redistribution_effects || {}, key)) {
			effects[key] = { ...group.before_redistribution_effects[key] };
		} else {
			delete effects[key];
		}
	}

	for (const key of Object.keys(manualGroups)) {
		if (manualGroups[key] === groupId) delete manualGroups[key];
	}
	for (const key of Object.keys(effects)) {
		if (effects[key]?.group_id === groupId) delete effects[key];
	}
	delete groups[groupId];
	syncShippingManualFlag(item);
	if (!options.silentLog) {
		recordShippingAdjustment(item, {
			mode: "redistribute",
			mode_label: getShippingAdjustModeLabel("redistribute"),
			source: "restore_group",
			group_id: groupId,
			trigger_method: group.trigger_method,
			trigger_label: getMethodLabel(group.trigger_method),
			total_before: totalBefore,
			total_after: getItemTotalShipping(item),
			restored_methods: affectedKeys
		});
	}
	return true;
};

const restoreShippingAdjustmentGroup = (item: any, groupId: string, options: { silentLog?: boolean } = {}) => {
	const groupIds = [...collectDependentShippingAdjustmentGroupIds(item, groupId), groupId];
	let restored = false;
	groupIds.forEach(id => {
		if (restoreSingleShippingAdjustmentGroup(item, id, options)) restored = true;
	});
	return restored;
};

const setShippingQuantityFromSystem = (item: any, methodKey: string, systemQty: any) => {
	if (!item.shippingQuantities) item.shippingQuantities = {};
	if (item.inactiveMethods?.includes(methodKey)) {
		item.shippingQuantities[methodKey] = 0;
		return;
	}
	const effectQty = getShippingRedistributionEffectQuantity(item, methodKey);
	if (effectQty !== null) {
		item.shippingQuantities[methodKey] = effectQty;
		return;
	}
	const manualQty = getManualShippingQuantity(item, methodKey);
	item.shippingQuantities[methodKey] = manualQty !== null
		? manualQty
		: Math.max(0, Math.round(Number(systemQty) || 0));
};

const restoreSystemShippingQuantity = (item: any, methodKey: string) => {
	if (!item.shippingQuantities) item.shippingQuantities = {};
	consumeShippingQuantityBeforeEdit(item, methodKey);
	const manualMap = ensureManualShippingQuantities(item);
	const manualGroups = ensureManualShippingGroups(item);
	if (getShippingAdjustMode(item) === "redistribute") {
		const groupId = manualGroups[methodKey];
		if (groupId && restoreShippingAdjustmentGroup(item, groupId)) {
			return;
		}
	}
	const targetQty = getSystemShippingQuantity(item, methodKey);
	delete manualMap[methodKey];
	delete manualGroups[methodKey];
	clearShippingRedistributionEffect(item, methodKey);
	item.shippingQuantities[methodKey] = item.inactiveMethods?.includes(methodKey) ? 0 : targetQty;
	syncShippingManualFlag(item);
};

const getRestoreShippingButtonText = (item: any, methodKey: string) => {
	const groupId = ensureManualShippingGroups(item)[methodKey];
	return getShippingAdjustMode(item) === "redistribute" && groupId ? "撤销调配" : "恢复建议";
};

const getRestoreShippingTooltip = (item: any, methodKey: string) => {
	const groupId = ensureManualShippingGroups(item)[methodKey];
	if (getShippingAdjustMode(item) === "redistribute" && groupId) {
		return "撤销本次分段调配，当前段和被联动的运输方式一起回到调整前。";
	}
	return "当前段恢复系统建议，其他运输方式不变。";
};

const getShippingRedistributionEffectText = (item: any, methodKey: string) => {
	const effect = getShippingRedistributionEffect(item, methodKey);
	if (!effect) return "";
	const triggerLabel = getMethodLabel(effect.trigger_method);
	return `由${triggerLabel}调配`;
};

const getItemPurchasePlanDeductedTotal = (item: any) => {
	return getItemPurchasePlanDeductionSummary(item).deductedTotal;
};

const getItemPurchasePlanExcessQty = (item: any) => {
	return getItemPurchasePlanDeductionSummary(item).excessQty;
};

const getItemLocalPendingDeliveryDeductedTotal = (item: any) => {
	return getItemLocalPendingDeliveryDeductionSummary(item).deductedTotal;
};

const getItemLocalPendingDeliveryExcessQty = (item: any) => {
	return getItemLocalPendingDeliveryDeductionSummary(item).excessQty;
};

const getItemAfterPurchasePlanTotal = (item: any) => {
	return getItemPurchasePlanDeductionSummary(item).afterPurchasePlanTotal;
};

const getItemAfterLocalDeductionsTotal = (item: any) => {
	if (item?.shippingQuantities) return getItemTotalShipping(item);
	return getItemLocalPendingDeliveryDeductionSummary(item).afterLocalDeductionsTotal;
};

const getItemLingxingFinalDeductionSourceQty = (item: any) => {
	return getItemLingxingPurchasePlanQty(item) + getItemLingxingPendingDeliveryQty(item);
};

const getItemLingxingFinalDeductionSummary = (item: any) => {
	const afterLocalQty = getItemAfterLocalDeductionsTotal(item);
	const lingxingQty = getItemLingxingFinalDeductionSourceQty(item);
	const deductedTotal = Math.min(lingxingQty, afterLocalQty);
	return {
		afterLocalQty,
		lingxingQty,
		deductedTotal,
		afterLingxingTotal: Math.max(0, afterLocalQty - deductedTotal),
		excessQty: Math.max(0, lingxingQty - deductedTotal)
	};
};

const getItemCoverageParts = (item: any) => {
	const systemQty = getItemTotalGap(item);
	const purchasePlanDeductedQty = getItemPurchasePlanDeductedTotal(item);
	const purchasePlanExcessQty = getItemPurchasePlanExcessQty(item);
	const afterPurchasePlanQty = getItemAfterPurchasePlanTotal(item);
	const localPendingDeductedQty = getItemLocalPendingDeliveryDeductedTotal(item);
	const localPendingExcessQty = getItemLocalPendingDeliveryExcessQty(item);
	const afterLocalQty = getItemAfterLocalDeductionsTotal(item);
	const lingxingSummary = getItemLingxingFinalDeductionSummary(item);

	return {
		systemQty,
		purchasePlanDeductedQty,
		purchasePlanExcessQty,
		afterPurchasePlanQty,
		localPendingDeductedQty,
		localPendingExcessQty,
		afterLocalQty,
		lingxingQty: lingxingSummary.lingxingQty,
		lingxingDeductedQty: lingxingSummary.deductedTotal,
		lingxingExcessQty: lingxingSummary.excessQty,
		afterFinalQty: lingxingSummary.afterLingxingTotal
	};
};

const isItemFullyCovered = (item: any) => {
	if (item?._shippingQuantityManual) return false;
	const parts = getItemCoverageParts(item);
	if (parts.systemQty <= 0) return false;
	if (parts.afterFinalQty > 0) return false;
	return parts.purchasePlanDeductedQty > 0 || parts.localPendingDeductedQty > 0 || parts.lingxingDeductedQty > 0;
};

const getItemCoveredSummaryText = (item: any) => {
	const parts = getItemCoverageParts(item);
	if (parts.afterLocalQty > 0 && parts.lingxingDeductedQty > 0) {
		const excessText = parts.lingxingExcessQty > 0 ? `，超额覆盖 ${parts.lingxingExcessQty}` : "";
		return `艾为扣后 ${parts.afterLocalQty}，领星抵扣 ${parts.lingxingDeductedQty}${excessText}`;
	}

	const localParts = [
		parts.purchasePlanDeductedQty > 0 ? `艾为采购计划抵扣 ${parts.purchasePlanDeductedQty}` : "",
		parts.localPendingDeductedQty > 0 ? `艾为待交付抵扣 ${parts.localPendingDeductedQty}` : ""
	].filter(Boolean);
	const localExcessQty = parts.purchasePlanExcessQty + parts.localPendingExcessQty;
	const excessText = localExcessQty > 0 ? `，艾为超额覆盖 ${localExcessQty}` : "";
	return `${localParts.join("，") || "艾为数据已覆盖"}，艾为扣后 0${excessText}`;
};

const getItemCoveredDetailHtml = (item: any) => {
	const parts = getItemCoverageParts(item);
	const localExcessQty = parts.purchasePlanExcessQty + parts.localPendingExcessQty;
	const rows = [
		`<div>系统建议：<strong>${parts.systemQty}</strong></div>`,
		`<div>艾为采购计划抵扣：${parts.purchasePlanDeductedQty}，采购计划扣后：${parts.afterPurchasePlanQty}</div>`,
		`<div>艾为待交付抵扣：${parts.localPendingDeductedQty}，艾为扣后：${parts.afterLocalQty}</div>`
	];

	if (parts.lingxingQty > 0 || parts.lingxingDeductedQty > 0) {
		rows.push(`<div>领星总抵扣（采购计划+待交付）来源：${parts.lingxingQty}，本次抵扣：${parts.lingxingDeductedQty}</div>`);
	}
	if (localExcessQty > 0 || parts.lingxingExcessQty > 0) {
		rows.push(`<div>超额覆盖：艾为 ${localExcessQty}，领星 ${parts.lingxingExcessQty}</div>`);
	}
	rows.push('<div class="qty-tooltip-section">结论</div>');
	rows.push(
		parts.afterLocalQty > 0 && parts.lingxingDeductedQty > 0
			? '<div>分段卡片保留的是艾为扣后需求；最终采购量为 0，是因为领星数据在最后覆盖了剩余需求。</div>'
			: '<div>艾为采购计划/待交付已经覆盖系统建议，最终无需采购。</div>'
	);

	return `<div class="qty-tooltip-block">${rows.join("")}</div>`;
};

const shouldShowSegmentFinalCovered = (item: any, methodKey: string) => {
	if (!isItemFullyCovered(item)) return false;
	if (item.inactiveMethods?.includes(methodKey)) return false;
	if (getItemLingxingFinalDeductionSummary(item).deductedTotal <= 0) return false;
	return getSegmentAfterLocalDeductionsQty(item, methodKey) > 0;
};

const getSegmentFinalCoveredText = (item: any, methodKey: string) => {
	const localQty = getSegmentAfterLocalDeductionsQty(item, methodKey);
	const lingxingSummary = getItemLingxingFinalDeductionSummary(item);
	return `本段艾为扣后仍需 ${localQty} 件；整单最后被领星抵扣 ${lingxingSummary.deductedTotal} 件覆盖，所以实际采购量为 0。`;
};

const applyPurchasePlanDeductionToItem = (item: any) => {
	if (!item) return;
	if (!item.shippingQuantities) item.shippingQuantities = {};

	const summary = getItemLocalPendingDeliveryDeductionSummary(item);
	for (const key of sortedSelectedMethods.value) {
		setShippingQuantityFromSystem(item, key, summary.remainingMap[key] || 0);
	}
	item._purchasePlanDeductionApplied = true;
};

const getSegmentCoveredQty = (item: any, methodKey: string) => {
	const calcResult = item._calcResult?.[methodKey];
	if (!calcResult) return 0;
	const expectedDemand = Math.max(0, Math.round(Number(calcResult.expectedDemand) || 0));
	return Math.max(0, expectedDemand - getSegmentSuggestedQty(item, methodKey));
};

const getSegmentShortageRanges = (item: any, methodKey: string) => {
	const ranges = item._calcResult?.[methodKey]?.shortageRanges;
	return Array.isArray(ranges) ? ranges : [];
};

const roundDisplayQty = (value: any) => Math.round(Number(value) || 0);

const getShortageRangeFormula = (range: any) => {
	const details = Array.isArray(range?.details) ? range.details : [];
	const quantity = roundDisplayQty(range?.quantity);
	if (!details.length) return `逐日缺口合计 ${quantity} 件`;

	const first = details[0];
	const rest = details.slice(1);
	const firstShortage = roundDisplayQty(first.shortage);
	const firstDailyNeed = roundDisplayQty(first.dailyNeed);
	const firstStockBeforeDemand = roundDisplayQty(first.stockBeforeDemand);
	const restShortage = rest.reduce((sum: number, d: any) => sum + roundDisplayQty(d.shortage), 0);
	const restDailyNeed = rest.length ? roundDisplayQty(rest[0].dailyNeed) : 0;
	const restCanFold = rest.length > 0 && rest.every((d: any) =>
		roundDisplayQty(d.shortage) === restDailyNeed
		&& roundDisplayQty(d.dailyNeed) === restDailyNeed
		&& roundDisplayQty(d.inboundQuantity) === 0
	);

	if (firstStockBeforeDemand > 0 && restCanFold) {
		return `首日 ${formatShortMonthDay(first.date)}：日耗 ${firstDailyNeed} - 剩余库存 ${firstStockBeforeDemand} = ${firstShortage}；后续 ${rest.length} 天 × ${restDailyNeed} = ${restShortage}；合计 ${quantity}`;
	}

	if (restCanFold) {
		return `${details.length} 天 × ${restDailyNeed} = ${quantity}`;
	}

	return `逐日缺口合计 ${quantity} 件，已扣除期初库存和期内到货`;
};

const getSegmentShortageLabel = (item: any, methodKey: string) => {
	const calcResult = item._calcResult?.[methodKey];
	const suggestedQty = getSegmentSuggestedQty(item, methodKey);
	if (!calcResult || suggestedQty <= 0) return '已覆盖';

	const ranges = getSegmentShortageRanges(item, methodKey);
	if (ranges.length === 1) {
		const range = ranges[0];
		return `${formatShortMonthDay(range.startDate)}~${formatShortMonthDay(range.endDate)}`;
	}
	if (ranges.length > 1) {
		const first = ranges[0];
		return `${formatShortMonthDay(first.startDate)}起等${ranges.length}段`;
	}
	if (calcResult.shortageStartDate && calcResult.shortageEndDate) {
		return `${formatShortMonthDay(calcResult.shortageStartDate)}~${formatShortMonthDay(calcResult.shortageEndDate)}`;
	}
	return '缺货';
};

// ========== 获取某段需求的逐月计算明细（供tooltip展示，支持所有算法） ==========
const getSegmentDemandBreakdown = (item: any, methodKey: string) => {
	const cr = item._calcResult?.[methodKey];
	if (!cr?.startDate || !cr?.endDate) return [];
	const breakdown = getSegmentMonthBreakdown(cr.startDate, cr.endDate);
	const dailyAvg = getCalcDailyAvgSales(item);
	const algoKey = item.replenishAlgo || globalAlgo.value;
	const algoId = mapAlgoToInt(algoKey);
	const volatilityCoefficient = getItemVolatilityCoefficient(item);

	return breakdown.map(({ month, days }) => {
		const base = { month, days, algoId, dailyAvg, volatilityCoefficient };

		if (algoId === 1) {
			// 日均销量：系数=1
			const dailyNeed = Math.round(dailyAvg * 100) / 100;
			const subtotal = Math.round(days * dailyNeed);
			return {
				...base,
				rawCoefficient: 1,
				adjustedCoefficient: 1,
				coefficient: 1,
				dailyNeed,
				subtotal,
				noData: false,
				type: 'daily'
			};
		}


		if (algoId === 2) {
			// 历史销量：优先从后端返回的monthlyCoefficients取，fallback到_calendarData
			const mc = cr.monthlyCoefficients?.[month];
			const cal = item._calendarData?.calendar?.[month];
			const coeffSrc = mc?.status === 'ok' ? mc : (cal?.sales?.status === 'ok' ? cal.sales : null);
			if (!coeffSrc || coeffSrc.coefficient === undefined) {
				return {
					...base,
					rawCoefficient: 1,
					adjustedCoefficient: 1,
					coefficient: 1,
					dailyNeed: Math.round(dailyAvg * 100) / 100,
					noData: true,
					subtotal: Math.round(days * dailyAvg),
					type: 'history',
					fallbackReason: '历史销量缺失'
				};
			}
			const rawCoefficient = Number(coeffSrc.raw_coefficient ?? coeffSrc.coefficient) || 1;
			const adjustedCoefficient = applyVolatilityToCoefficient(rawCoefficient, volatilityCoefficient);
			const roundedCoeff = Math.round(adjustedCoefficient * 100) / 100;
			const dailyNeed = Math.round(dailyAvg * roundedCoeff * 100) / 100;
			const subtotal = Math.round(days * dailyNeed);
			return { ...base, rawCoefficient, adjustedCoefficient: roundedCoeff, coefficient: roundedCoeff, dailyNeed, subtotal, noData: false, type: 'history' };
		}

		if (algoId === 3) {
			// 搜索词趋势：优先从后端返回的monthlyCoefficients取，fallback到_calendarData
			const mc = cr.monthlyCoefficients?.[month];
			const cal = item._calendarData?.calendar?.[month];
			const coeffSrc = mc?.status === 'ok' ? mc : (cal?.keywords?.status === 'ok' ? cal.keywords : null);
			if (!coeffSrc || coeffSrc.coefficient === undefined) {
				return {
					...base,
					rawCoefficient: 1,
					adjustedCoefficient: 1,
					coefficient: 1,
					dailyNeed: Math.round(dailyAvg * 100) / 100,
					noData: true,
					subtotal: Math.round(days * dailyAvg),
					type: 'trend',
					fallbackReason: '搜索词缺失'
				};
			}
			const rawCoefficient = Number(coeffSrc.raw_coefficient ?? coeffSrc.coefficient) || 1;
			const adjustedCoefficient = applyVolatilityToCoefficient(rawCoefficient, volatilityCoefficient);
			const roundedCoeff = Math.round(adjustedCoefficient * 100) / 100;
			const dailyNeed = Math.round(dailyAvg * roundedCoeff * 100) / 100;
			const subtotal = Math.round(days * dailyNeed);
			return { ...base, rawCoefficient, adjustedCoefficient: roundedCoeff, coefficient: roundedCoeff, dailyNeed, subtotal, noData: false, type: 'trend' };
		}

		// 算法4：综合走势
		if (!cr.monthlyCoefficients) return { ...base, rawCoefficient: 1, adjustedCoefficient: 1, coefficient: 1, dailyNeed: Math.round(dailyAvg * 100) / 100, noData: true, subtotal: Math.round(days * dailyAvg), type: 'combined' };
		const mc = cr.monthlyCoefficients[month];
		if (!mc) return { ...base, rawCoefficient: 1, adjustedCoefficient: 1, coefficient: 1, dailyNeed: Math.round(dailyAvg * 100) / 100, noData: true, subtotal: Math.round(days * dailyAvg), type: 'combined' };

		const mode = cr._alphaMode || 'system';
		const manualAlpha = cr._manualAlpha;
		const sysAlpha = mc.system_alpha ?? 0.7;
		const userAlpha = mc.user_alpha ?? null;
		const alpha = manualAlpha ?? (mode === 'system' ? sysAlpha : (userAlpha ?? sysAlpha));
		const salesCoeff = Number(mc.filled_sales_coefficient) || 0;
		const searchCoeff = Number(mc.keyword_coefficient) || 0;
		const rawCoefficient = getRawCombinedCoefficient(mc, alpha);
		const combined = applyVolatilityToCoefficient(rawCoefficient, volatilityCoefficient);
		const roundedCoeff = Math.round(combined * 100) / 100;
		const dailyNeed = Math.round(dailyAvg * roundedCoeff * 100) / 100;
		const subtotal = Math.round(days * dailyNeed);

		return {
			...base, alpha, salesCoeff, searchCoeff,
			rawCoefficient,
			adjustedCoefficient: roundedCoeff,
			coefficient: roundedCoeff,
			combined: roundedCoeff,
			dailyNeed,
			subtotal,
			noData: false,
			type: 'combined',
			isNoDataAlpha: isCombinedNoData(mc)
		};
	});
};

const formatCompactNumber = (value: any, precision = 0) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	if (precision <= 0 || Number.isInteger(num)) return String(Math.round(num));
	return num.toFixed(precision).replace(/\.?0+$/, "");
};

const formatCoeffNumber = (value: any) => {
	const num = Number(value);
	return Number.isFinite(num) ? num.toFixed(2) : "-";
};

const getSegmentDemandMonthLabel = (detail: any) => {
	const month = String(detail?.month || "");
	const monthText = month.length >= 7 ? month.substring(5) : month || "-";
	return `${monthText}月 · ${Number(detail?.days) || 0}天`;
};

const getSegmentDemandTypeLabel = (type: any) => {
	if (type === "history") return "历史销量";
	if (type === "trend") return "搜索词趋势";
	if (type === "combined") return "综合走势";
	return "日均销量";
};

const getSegmentDemandTitle = (detail: any) => {
	const prefix = getSegmentDemandMonthLabel(detail);
	const volatilityText = formatCoeffNumber(detail?.volatilityCoefficient);
	if (detail?.noData) {
		return `${prefix} · ${detail?.fallbackReason || "无可用系数"}；最终系数 1.00（波动 ${volatilityText}）`;
	}

	const rawText = formatCoeffNumber(detail?.rawCoefficient ?? 1);
	const finalText = formatCoeffNumber(detail?.coefficient ?? detail?.combined ?? detail?.adjustedCoefficient ?? 1);
	if (detail?.type === "combined") {
		return `${prefix} · 综合走势 · α ${formatCoeffNumber(detail?.alpha)} · 原始 ${rawText} → 波动 ${volatilityText} → 最终 ${finalText}`;
	}

	return `${prefix} · ${getSegmentDemandTypeLabel(detail?.type)} · 原始 ${rawText} → 波动 ${volatilityText} → 最终 ${finalText}`;
};

const getSegmentDemandFormulaLine = (detail: any) => {
	const days = Number(detail?.days) || 0;
	const dailyAvgText = formatCompactNumber(detail?.dailyAvg, 1);
	const dailyNeedText = formatCompactNumber(detail?.dailyNeed ?? Number(detail?.dailyAvg || 0) * Number(detail?.coefficient || 1), 1);
	const subtotalText = formatCompactNumber(detail?.subtotal);
	const volatilityText = formatCoeffNumber(detail?.volatilityCoefficient);

	if (detail?.noData) {
		return `缺少可用走势数据，按日均销量推演：${dailyAvgText} × ${days} 天 = ${subtotalText}`;
	}

	if (detail?.type === "daily") {
		return `(1.00 - 1) × ${volatilityText} + 1 = 1.00；日均 ${dailyAvgText} × 1.00 × ${days} 天 = ${subtotalText}`;
	}

	const rawText = formatCoeffNumber(detail?.rawCoefficient ?? 1);
	const finalText = formatCoeffNumber(detail?.coefficient ?? detail?.combined ?? detail?.adjustedCoefficient ?? 1);

	if (detail?.type === "combined") {
		const alpha = Number(detail?.alpha);
		const alphaText = formatCoeffNumber(alpha);
		const inverseAlphaText = Number.isFinite(alpha) ? formatCoeffNumber(1 - alpha) : "-";
		const salesText = formatCoeffNumber(detail?.salesCoeff);
		const searchText = formatCoeffNumber(detail?.searchCoeff);
		return `综合原始：${alphaText} × 销量 ${salesText} + ${inverseAlphaText} × 搜索 ${searchText} = ${rawText}；最终：(${rawText} - 1) × ${volatilityText} + 1 = ${finalText}；日均 ${dailyAvgText} × ${finalText} = 日耗 ${dailyNeedText} × ${days} 天 = ${subtotalText}`;
	}

	return `最终：(${rawText} - 1) × ${volatilityText} + 1 = ${finalText}；日均 ${dailyAvgText} × ${finalText} = 日耗 ${dailyNeedText} × ${days} 天 = ${subtotalText}`;
};

const getSegmentMonthDateChunks = (startDate: string, endDate: string) => {
	const result: { month: string; startDate: string; endDate: string; days: number }[] = [];
	let cur = dayjs(startDate);
	const end = dayjs(endDate);
	while (cur.isBefore(end) || cur.isSame(end, 'day')) {
		const monthEnd = cur.endOf('month').startOf('day');
		const chunkEnd = monthEnd.isBefore(end) ? monthEnd : end;
		const days = chunkEnd.diff(cur, 'day') + 1;
		result.push({
			month: cur.format('YYYY-MM'),
			startDate: cur.format('YYYY-MM-DD'),
			endDate: chunkEnd.format('YYYY-MM-DD'),
			days
		});
		cur = chunkEnd.add(1, 'day');
	}
	return result;
};

const getItemAlgoKey = (item: any) => item?.replenishAlgo || globalAlgo.value || DEFAULT_GLOBAL_ALGO;

const isCombinedAlgo = (item: any) => getItemAlgoKey(item) === "combined";

const shouldShowAlgoCalcPanel = (item: any) => {
	return Boolean(item?.shippingQuantities && item?.replenishAlgo);
};

const getAlgoPanelTitle = (item: any) => {
	const algoKey = getItemAlgoKey(item);
	const name = ({
		daily_avg: "日均销量",
		history: "历史销量",
		trend: "搜索词趋势",
		combined: "综合走势"
	} as Record<string, string>)[algoKey] || "日均销量";
	return `${name}测算`;
};

const getSimpleAlgoCoeffLabel = (item: any) => {
	const algoKey = getItemAlgoKey(item);
	if (algoKey === "history") return "历史系数";
	if (algoKey === "trend") return "搜索系数";
	return "日均系数";
};

const buildSimplePanelRow = (params: {
	key: string;
	label: string;
	days: number;
	dailyAvg: number;
	coefficient: number;
	rawCoefficient?: number;
	volatilityCoefficient?: number;
	subtotal?: number;
	dailyNeed?: number;
	reasonText?: string | null;
	tooltipPrefix?: string;
	extra?: Record<string, any>;
}) => {
	const {
		key,
		label,
		days,
		dailyAvg,
		coefficient,
		rawCoefficient,
		volatilityCoefficient,
		subtotal,
		dailyNeed,
		reasonText,
		tooltipPrefix = "计算",
		extra = {}
	} = params;
	const roundedCoeff = Math.round(Number(coefficient || 0) * 100) / 100;
	const rawCoeff = Number.isFinite(Number(rawCoefficient)) ? Number(rawCoefficient) : roundedCoeff;
	const volatility = normalizeLoadedVolatilityCoefficient(volatilityCoefficient);
	const rowDailyNeed = dailyNeed ?? Math.round(dailyAvg * roundedCoeff * 100) / 100;
	const rowSubtotal = subtotal ?? Math.round(days * rowDailyNeed);
	return {
		key,
		label,
		days,
		hasData: !reasonText,
		isCurrentMonth: false,
		coeffText: formatCoeffNumber(roundedCoeff),
		dailyNeedText: formatCompactNumber(rowDailyNeed, 1),
		subtotalText: formatCompactNumber(rowSubtotal),
		subtotalValue: rowSubtotal,
		rawCoefficient: rawCoeff,
		volatilityCoefficient: volatility,
		adjustedCoefficient: roundedCoeff,
		reasonText: reasonText || "",
		tooltipText: buildCoefficientFormulaText({
			label: tooltipPrefix,
			dailyAvg,
			days,
			rawCoefficient: rawCoeff,
			volatilityCoefficient: volatility,
			adjustedCoefficient: roundedCoeff,
			dailyNeed: rowDailyNeed,
			subtotal: rowSubtotal
		}),
		...extra
	};
};

const getFiveMonthSimpleRows = (item: any) => {
	const dailyAvg = getCalcDailyAvgSales(item);
	const calc = calculate5MonthWindowForItem(item);
	const currentMonth = dayjs().format("YYYY-MM");
	return (calc.segments || []).map((segment: any) => {
		const month = segment.month;
		return buildSimplePanelRow({
			key: `five-simple-${item._batchId || item.id || item.asin}-${month}`,
			label: dayjs(month).isValid() ? dayjs(month).format("M月") : segment.monthName || month,
			days: segment.days,
			dailyAvg,
			coefficient: segment.coefficient,
			rawCoefficient: segment.raw_coefficient,
			volatilityCoefficient: segment.volatility_coefficient,
			dailyNeed: segment.daily_sales,
			subtotal: segment.subtotal,
			reasonText: segment.fallback_reason,
			tooltipPrefix: segment.algo_used_name || getSimpleAlgoCoeffLabel(item),
			extra: {
				isCurrentMonth: month === currentMonth
			}
		});
	});
};

const getCurrentSimpleRows = (item: any) => {
	return splitShippingSegmentsByMonth(item)
		.filter((segment: any) => segment && segment.shipping_method)
		.map((segment: any, index: number) => buildSimplePanelRow({
			key: `current-simple-${item._batchId || item.id || item.asin}-${segment.shipping_method}-${segment.startDate}-${index}`,
			label: segment.startDate?.slice(0, 7) || String(index + 1),
			days: segment.days,
			dailyAvg: getCalcDailyAvgSales(item),
			coefficient: segment.coefficient,
			rawCoefficient: segment.raw_coefficient,
			volatilityCoefficient: segment.volatility_coefficient,
			dailyNeed: segment.dailyNeed,
			subtotal: segment.subtotal,
			reasonText: segment.fallback_reason,
			tooltipPrefix: segment.algo_used_name || getSimpleAlgoCoeffLabel(item),
			extra: {
				methodLabel: segment.shipping_label || segment.shipping_method,
				rangeLabel: `${formatShortMonthDay(segment.startDate)}~${formatShortMonthDay(segment.endDate)}`
			}
		}));
};

const buildMissingCombinedPanelRow = (key: string, label: string, days: number, extra: Record<string, any> = {}) => ({
	key,
	label,
	days,
	hasData: false,
	isCurrentMonth: false,
	salesCoeffText: "-",
	searchCoeffText: "-",
	combinedCoeffText: "-",
	alphaText: "-",
	dailyNeedText: "-",
	subtotalText: "-",
	subtotalValue: 0,
	sourceText: "暂无数据",
	formulaText: "暂无综合走势系数数据",
	reasonText: "",
	...extra
});

const isCombinedNoData = (source: any) => source?.alpha_reason === "no_data";

const getRawCombinedCoefficient = (source: any, alpha?: number | null) => {
	const rawSourceCoeff = Number(source?.raw_coefficient ?? source?.raw_combined_coefficient);
	const sourceCoeff = Number(source?.coefficient);
	if (isCombinedNoData(source)) {
		if (Number.isFinite(rawSourceCoeff)) return rawSourceCoeff;
		return Number.isFinite(sourceCoeff) ? sourceCoeff : 1;
	}

	const salesCoeff = Number(source?.filled_sales_coefficient);
	const searchCoeff = Number(source?.keyword_coefficient);
	const alphaValue = Number(alpha ?? source?.alpha ?? source?.system_alpha ?? 0.7);
	if (Number.isFinite(salesCoeff) && Number.isFinite(searchCoeff) && Number.isFinite(alphaValue)) {
		return alphaValue * salesCoeff + (1 - alphaValue) * searchCoeff;
	}

	if (Number.isFinite(rawSourceCoeff)) return rawSourceCoeff;
	return Number.isFinite(sourceCoeff) ? sourceCoeff : 1;
};

const getCombinedCoefficient = (source: any, alpha?: number | null, volatilityCoefficient = DEFAULT_VOLATILITY_COEFFICIENT) => {
	return applyVolatilityToCoefficient(getRawCombinedCoefficient(source, alpha), volatilityCoefficient);
};

const buildCoefficientFormulaText = (params: {
	label?: string;
	dailyAvg: number;
	days: number;
	rawCoefficient: number;
	volatilityCoefficient: number;
	adjustedCoefficient: number;
	subtotal: number;
	dailyNeed?: number;
}) => {
	const label = params.label || "系数";
	const dailyNeed = params.dailyNeed ?? Math.round(params.dailyAvg * params.adjustedCoefficient * 100) / 100;
	return `${label}：原始系数 ${formatCoeffNumber(params.rawCoefficient)}，波动系数 ${formatCoeffNumber(params.volatilityCoefficient)}，最终系数 ${formatCoeffNumber(params.adjustedCoefficient)}；日均 ${formatCompactNumber(params.dailyAvg, 1)} × 最终系数 ${formatCoeffNumber(params.adjustedCoefficient)} = 日耗 ${formatCompactNumber(dailyNeed, 1)}，${params.days} 天预计消耗 ${formatCompactNumber(params.subtotal)}`;
};

const buildCombinedPanelRow = (params: {
	key: string;
	label: string;
	days: number;
	dailyAvg: number;
	source: any;
	alphaOverride?: number | null;
	rawCoefficientOverride?: number | null;
	coefficientOverride?: number | null;
	subtotalOverride?: number | null;
	dailyNeedOverride?: number | null;
	volatilityCoefficient?: number;
	extra?: Record<string, any>;
}) => {
	const { key, label, days, dailyAvg, source, alphaOverride, rawCoefficientOverride, coefficientOverride, subtotalOverride, dailyNeedOverride, volatilityCoefficient = DEFAULT_VOLATILITY_COEFFICIENT, extra = {} } = params;
	if (!source) return buildMissingCombinedPanelRow(key, label, days, extra);

	const salesCoeff = Number(source.filled_sales_coefficient);
	const searchCoeff = Number(source.keyword_coefficient);
	const alpha = alphaOverride ?? source.alpha ?? source.system_alpha ?? 0.7;
	if (!Number.isFinite(salesCoeff) || !Number.isFinite(searchCoeff)) {
		return buildMissingCombinedPanelRow(key, label, days, extra);
	}

	const rawCombined = rawCoefficientOverride ?? getRawCombinedCoefficient(source, alpha);
	const adjustedCombined = coefficientOverride ?? applyVolatilityToCoefficient(rawCombined, volatilityCoefficient);
	const roundedCoeff = Math.round(Number(adjustedCombined) * 100) / 100;
	const dailyNeed = dailyNeedOverride ?? Math.round(dailyAvg * roundedCoeff * 100) / 100;
	const subtotal = subtotalOverride ?? Math.round(days * dailyNeed);
	const isNoDataAlpha = isCombinedNoData(source);
	const alphaText = isNoDataAlpha ? "日均" : formatCompactNumber(alpha, 2);
	const inverseAlphaText = formatCompactNumber(1 - Number(alpha), 2);
	const formulaText = isNoDataAlpha
		? "销量/搜索均无可用数据，α不参与计算，综合系数强制=1"
		: `${alphaText}×${formatCoeffNumber(salesCoeff)} + ${inverseAlphaText}×${formatCoeffNumber(searchCoeff)} = 原始 ${formatCoeffNumber(rawCombined)} → 波动 ${formatCoeffNumber(volatilityCoefficient)} → 最终 ${formatCoeffNumber(roundedCoeff)}`;

	return {
		key,
		label,
		days,
		hasData: true,
		isCurrentMonth: false,
		salesCoeffText: formatCoeffNumber(salesCoeff),
		searchCoeffText: formatCoeffNumber(searchCoeff),
		combinedCoeffText: formatCoeffNumber(roundedCoeff),
		rawCombinedCoeffText: formatCoeffNumber(rawCombined),
		volatilityCoefficientText: formatCoeffNumber(volatilityCoefficient),
		alphaText,
		dailyNeedText: formatCompactNumber(dailyNeed, 1),
		subtotalText: formatCompactNumber(subtotal),
		subtotalValue: subtotal,
		sourceText: isNoDataAlpha ? "强制按日均" : alphaSourceLabel(source.alpha_source || "system"),
		formulaText,
		reasonText: source.alpha_reason_text || "",
		isNoDataAlpha,
		...extra
	};
};

const getFiveMonthCombinedRows = (item: any) => {
	const today = dayjs().startOf('month');
	const dailyAvg = getCalcDailyAvgSales(item);
	return Array.from({ length: 5 }, (_, index) => {
		const monthDate = today.subtract(1, 'month').add(index, 'month');
		const month = monthDate.format('YYYY-MM');
		const source = item._calendarData?.calendar?.[month]?.combined;
		const row = buildCombinedPanelRow({
			key: `five-${item._batchId || item.id || item.asin}-${month}`,
			label: monthDate.format('M月'),
			days: monthDate.daysInMonth(),
			dailyAvg,
			source,
			volatilityCoefficient: getItemVolatilityCoefficient(item),
			extra: {
				isCurrentMonth: month === today.format('YYYY-MM')
			}
		});
		return row;
	});
};

const getRowsSubtotal = (rows: any[]) => {
	const total = rows.reduce((sum, row) => sum + (Number(row?.subtotalValue) || 0), 0);
	return formatCompactNumber(Math.round(total));
};

const getCurrentCombinedRows = (item: any) => {
	if ((item.replenishAlgo || globalAlgo.value) !== 'combined') return [];
	const dailyAvg = getCalcDailyAvgSales(item);
	const rows: any[] = [];

	for (const methodKey of sortedSelectedMethods.value) {
		if (item.inactiveMethods?.includes(methodKey)) continue;
		const cr = item._calcResult?.[methodKey];
		if (!cr?.startDate || !cr?.endDate) continue;

		const method = getShippingMethodInfo(methodKey);
		const chunks = getSegmentMonthDateChunks(cr.startDate, cr.endDate);
		const demandRows = getSegmentDemandBreakdown(item, methodKey);

		chunks.forEach((chunk, index) => {
			const demand = demandRows[index] as any;
			const source = cr.monthlyCoefficients?.[chunk.month] || item._calendarData?.calendar?.[chunk.month]?.combined;
			if (!source || demand?.noData) {
				rows.push(buildMissingCombinedPanelRow(
					`current-${item._batchId || item.id || item.asin}-${methodKey}-${chunk.month}-${index}`,
					chunk.month,
					chunk.days,
					{
						methodLabel: method?.label || methodKey,
						rangeLabel: `${formatShortMonthDay(chunk.startDate)}~${formatShortMonthDay(chunk.endDate)}`
					}
				));
				return;
			}

			rows.push(buildCombinedPanelRow({
				key: `current-${item._batchId || item.id || item.asin}-${methodKey}-${chunk.month}-${index}`,
				label: chunk.month,
				days: chunk.days,
				dailyAvg,
				source,
				alphaOverride: demand?.alpha ?? source.alpha,
				rawCoefficientOverride: demand?.rawCoefficient ?? source.raw_coefficient,
				coefficientOverride: demand?.combined ?? source.coefficient,
				subtotalOverride: demand?.subtotal,
				dailyNeedOverride: demand?.dailyNeed,
				volatilityCoefficient: demand?.volatilityCoefficient ?? getItemVolatilityCoefficient(item),
				extra: {
					methodLabel: method?.label || methodKey,
					rangeLabel: `${formatShortMonthDay(chunk.startDate)}~${formatShortMonthDay(chunk.endDate)}`,
					sourceText: cr._manualAlpha !== undefined && cr._manualAlpha !== null
						? "人工α"
						: (cr._alphaMode === "user" ? "用户配置" : "系统自动")
				}
			}));
		});
	}

	return rows;
};

const getCurrentSimpleTotal = (item: any) => getRowsSubtotal(getCurrentSimpleRows(item));

const getCurrentCombinedTotal = (item: any) => getRowsSubtotal(getCurrentCombinedRows(item));

const getCurrentReplenishRows = (item: any) => {
	const dailyAvg = getCalcDailyAvgSales(item);
	return sortedSelectedMethods.value
		.filter(methodKey => !item?.inactiveMethods?.includes(methodKey))
		.map(methodKey => {
			const cr = item?._calcResult?.[methodKey];
			if (!cr?.startDate || !cr?.endDate) return null;
			const method = getShippingMethodInfo(methodKey);
			const days = getSegmentMonthBreakdown(cr.startDate, cr.endDate).reduce((sum, segment) => sum + segment.days, 0);
			const demandQty = Math.max(0, Math.round(Number(cr.expectedDemand) || 0));
			const inbound = getSegmentInTransit(item, methodKey);
			const systemQty = getSegmentSuggestedQty(item, methodKey);
			const currentQty = Math.max(0, Math.round(Number(item?.shippingQuantities?.[methodKey]) || 0));
			const coveredQty = getSegmentCoveredQty(item, methodKey);
			const dailyNeed = days > 0 ? demandQty / days : 0;
			const coeff = dailyAvg > 0 && dailyNeed > 0 ? dailyNeed / dailyAvg : 0;
			const rangeLabel = `${formatShortMonthDay(cr.startDate)}~${formatShortMonthDay(cr.endDate)}`;
			const shortageLabel = getSegmentShortageLabel(item, methodKey);
			const statusClass = systemQty > 0 ? "is-shortage" : (demandQty > 0 ? "is-covered" : "is-empty");
			const statusText = systemQty > 0 ? `缺口 ${systemQty}` : (demandQty > 0 ? "已覆盖" : "无需求");
			const shortageRows = getSegmentShortageRanges(item, methodKey)
				.map((range: any) => `<div>${formatShortMonthDay(range.startDate)}~${formatShortMonthDay(range.endDate)}：${range.days}天，缺口 ${roundDisplayQty(range.quantity)} 件</div>`)
				.join("");

			const coeffTooltip = [
				`<div class="qty-tooltip-title">${method?.label || methodKey} ${rangeLabel}</div>`,
				`<div>天数：${days} 天</div>`,
				`<div>区间需求：${demandQty}</div>`,
				`<div>预计日耗：${formatCompactNumber(dailyNeed, 1)}</div>`,
				`<div>折算系数：${formatCoeffNumber(coeff || 0)}</div>`,
				isCombinedAlgo(item)
					? '<div class="qty-tooltip-section">综合走势跨月时，这里显示按整段需求折算后的平均系数；逐月系数看 5个月页签。</div>'
					: `<div class="qty-tooltip-section">${getSimpleAlgoCoeffLabel(item)}按当前区间汇总折算。</div>`
			].join("");

			const coverageTooltip = [
				`<div class="qty-tooltip-title">${method?.label || methodKey} 覆盖结果</div>`,
				`<div>覆盖区间：${rangeLabel}</div>`,
				`<div>区间需求：${demandQty}</div>`,
				`<div>已覆盖量：${coveredQty}（含期初FBA库存和期内到货推演）</div>`,
				`<div>期内在途：${inbound.total}</div>`,
				`<div>系统建议：${systemQty}</div>`,
				`<div>当前发货：${currentQty}</div>`,
				`<div>覆盖结果：${statusText}${shortageLabel && shortageLabel !== "已覆盖" ? `（${shortageLabel}）` : ""}</div>`,
				shortageRows ? `<div class="qty-tooltip-section">缺货区间</div>${shortageRows}` : ""
			].join("");

			return {
				key: `current-replenish-${item?._batchId || item?.id || item?.asin}-${methodKey}`,
				methodKey,
				methodLabel: method?.label || methodKey,
				rangeLabel,
				days,
				hasData: demandQty > 0 || systemQty > 0 || currentQty > 0,
				coeffText: demandQty > 0 ? formatCoeffNumber(coeff) : "-",
				dailyNeedText: demandQty > 0 ? formatCompactNumber(dailyNeed, 1) : "-",
				demandQty,
				demandText: formatCompactNumber(demandQty),
				inboundQty: inbound.total,
				inboundText: formatCompactNumber(inbound.total),
				systemQty,
				systemText: formatCompactNumber(systemQty),
				currentQty,
				currentText: formatCompactNumber(currentQty),
				coveredQty,
				statusText,
				statusClass,
				coeffTooltip,
				coverageTooltip
			};
		})
		.filter(Boolean);
};

const getCurrentReplenishTotals = (item: any) => {
	const rows = getCurrentReplenishRows(item);
	const demandQty = rows.reduce((sum: number, row: any) => sum + row.demandQty, 0);
	const inboundQty = rows.reduce((sum: number, row: any) => sum + row.inboundQty, 0);
	const currentQty = rows.reduce((sum: number, row: any) => sum + row.currentQty, 0);
	const systemQty = getItemTotalGap(item);
	const days = rows.reduce((sum: number, row: any) => sum + row.days, 0);
	return {
		days,
		demandQty,
		demandText: formatCompactNumber(demandQty),
		inboundQty,
		inboundText: formatCompactNumber(inboundQty),
		systemQty,
		systemText: formatCompactNumber(systemQty),
		currentQty,
		currentText: formatCompactNumber(currentQty),
		statusClass: systemQty > 0 ? "is-shortage" : (demandQty > 0 ? "is-covered" : "is-empty"),
		statusText: systemQty > 0 ? `系统建议 ${formatCompactNumber(systemQty)}` : (demandQty > 0 ? "已覆盖" : "无需求")
	};
};

// ========== 判断某段是否有用户α配置 ==========
const segmentHasUserAlpha = (calcResult: any) => {
	if (!calcResult?.monthlyCoefficients || !calcResult.startDate || !calcResult.endDate) return false;
	const breakdown = getSegmentMonthBreakdown(calcResult.startDate, calcResult.endDate);
	return breakdown.some(({ month }) => {
		const mc = calcResult.monthlyCoefficients[month];
		return mc?.user_alpha !== null && mc?.user_alpha !== undefined;
	});
};

// ========== 切换系统/用户α模式 ==========
const onToggleAlphaMode = (item, methodKey) => {
	if (deferCalculationIfPurchasePlanSyncing()) return;
	const calcResult = item._calcResult?.[methodKey];
	if (!calcResult?.monthlyCoefficients || !calcResult.startDate || !calcResult.endDate) return;

	const currentMode = calcResult._alphaMode || 'system';
	const newMode = currentMode === 'system' ? 'user' : 'system';

	// 切换到用户模式时，检查是否有用户配置
	if (newMode === 'user') {
		const breakdown = getSegmentMonthBreakdown(calcResult.startDate, calcResult.endDate);
		const hasUserAlpha = breakdown.some(({ month }) => {
			const mc = calcResult.monthlyCoefficients[month];
			return mc?.user_alpha !== null && mc?.user_alpha !== undefined;
		});
		if (!hasUserAlpha) {
			ElMessage.info('该产品暂无用户α配置，请先在α配置面板中设置');
			return;
		}
	}

	calcResult._alphaMode = newMode;

	// 清空人工α，让它跟随新模式的加权值
	calcResult._manualAlpha = undefined;
	calcResult._manualAlphaInited = false;

	// 用新模式的加权α + 逐日库存模拟重算
	const breakdown = getSegmentMonthBreakdown(calcResult.startDate, calcResult.endDate);
	const weighted = computeWeightedAlpha(breakdown, calcResult.monthlyCoefficients, newMode);
	const dailyAvgSales = getCalcDailyAvgSales(item);
	const fbaValid = getFbaInventoryQuantity(item);
	const fbaShippingList = filterByRowMsku(item.restocking?.fbaShippingList, item);
	const calc = recalcSegmentGapWithAlpha(
		weighted.value, calcResult.startDate, calcResult.endDate,
		calcResult.monthlyCoefficients, dailyAvgSales, fbaValid, fbaShippingList,
		getItemVolatilityCoefficient(item),
		{ preArrivalShortage: calcResult.preArrivalShortage, ...getPastInboundAdjustmentOptions(item) }
	);
	calcResult.gap = calc.gap;
	calcResult.expectedDemand = calc.expectedDemand;
	calcResult.shortageStartDate = calc.shortageStartDate;
	calcResult.shortageEndDate = calc.shortageEndDate;
	calcResult.shortageDays = calc.shortageDays;
	calcResult.shortageDemand = calc.shortageDemand;
	calcResult.shortageRanges = calc.shortageRanges;
	calcResult.preArrivalShortage = calc.preArrivalShortage;
	applyPurchasePlanDeductionToItem(item);
};

// ========== 装箱数：领星本地产品详情 ==========
const boxPcsDebugVisible = ref(false);
const boxPcsDebugLoading = ref(false);
const boxPcsDebugItem = ref<any | null>(null);
const boxPcsDebugResult = ref<any | null>(null);

const getBoxPcsClientKey = (item: any) => {
	if (!item._boxPcsClientKey) {
		item._boxPcsClientKey = item._batchId || `listing_${item.id || "no_id"}_${item.product_id || item.local_sku || item.msku || Date.now()}`;
	}
	return item._boxPcsClientKey;
};

const resolveBoxPcsRequestParams = (item: any) => {
	const productId = item?.product_id;
	if (productId !== undefined && productId !== null && String(productId).trim() !== "" && Number(productId) > 0) {
		return { id: Number(productId) };
	}

	const localSku = String(item?.local_sku || "").trim();
	if (localSku) {
		return { sku: localSku };
	}

	const msku = String(item?.msku || "").trim();
	if (msku) {
		return { sku: msku };
	}

	return null;
};

const buildBoxPcsPayloadItem = (item: any) => {
	return {
		clientKey: getBoxPcsClientKey(item),
		listing_id: item.id,
		product_id: item.product_id,
		local_sku: item.local_sku,
		msku: item.msku,
		asin: item.asin,
		marketplace: item.marketplace,
		store_id: item.store_id
	};
};

const getBoxPcsDisplay = (item: any) => {
	const value = item?._cgBoxPcs ?? item?.cg_box_pcs;
	return value === undefined || value === null || value === "" ? "-" : value;
};

const normalizeProductPurchaseRemark = (value: any) => {
	if (value === undefined || value === null) return "";
	return String(value);
};

const getProductPurchaseRemarkOriginal = (item: any) => {
	return normalizeProductPurchaseRemark(item?._productPurchaseRemarkOriginal);
};

const getProductPurchaseRemark = (item: any) => {
	return normalizeProductPurchaseRemark(item?._productPurchaseRemark);
};

const isProductPurchaseRemarkChanged = (item: any) => {
	return getProductPurchaseRemark(item) !== getProductPurchaseRemarkOriginal(item);
};

const onProductPurchaseRemarkInput = (item: any, value: any) => {
	item._productPurchaseRemark = normalizeProductPurchaseRemark(value);
	item._productPurchaseRemarkDirty = true;
};

const normalizePositiveInteger = (value: any) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return 0;
	const normalized = Math.round(num);
	return normalized > 0 ? normalized : 0;
};

const getRawBoxPcs = (item: any) => {
	return normalizePositiveInteger(item?._cgBoxPcs ?? item?.cg_box_pcs);
};

const getManualBoxPcs = (item: any) => {
	return normalizePositiveInteger(item?._manualBoxPcsInput);
};

const getEffectiveBoxPcs = (item: any) => {
	return getManualBoxPcs(item) || getRawBoxPcs(item);
};

const getBoxPcsInputValue = (item: any) => {
	const manual = getManualBoxPcs(item);
	if (manual > 0) return manual;
	const raw = getRawBoxPcs(item);
	return raw > 0 ? raw : null;
};

const getBoxPcsInputPlaceholder = (item: any) => {
	return getRawBoxPcs(item) > 0 ? "自动装箱数" : "输入装箱数";
};

const onManualBoxPcsChange = (item: any, value: any) => {
	const normalized = normalizePositiveInteger(value);
	item._manualBoxPcsInput = normalized > 0 ? normalized : null;
};

function roundPurchaseQtyByBoxPcs(baseQty, boxPcs) {
	const originalQty = Math.max(0, Math.round(Number(baseQty) || 0));
	const cartonQty = normalizePositiveInteger(boxPcs);

	if (originalQty <= 0 || cartonQty <= 0) {
		return {
			originalQty,
			boxPcs: cartonQty,
			adjustedQty: originalQty,
			boxes: 0,
			delta: 0,
			mode: cartonQty > 0 ? "zero" : "no_box",
			hasValidBox: cartonQty > 0,
			downQty: 0,
			upQty: 0,
			downDiff: 0,
			upDiff: 0
		};
	}

	const lowerBoxes = Math.floor(originalQty / cartonQty);
	const upperBoxes = Math.ceil(originalQty / cartonQty);

	if (lowerBoxes <= 0) {
		const adjustedQty = cartonQty;
		return {
			originalQty,
			boxPcs: cartonQty,
			adjustedQty,
			boxes: 1,
			delta: adjustedQty - originalQty,
			mode: "min_one",
			hasValidBox: true,
			downQty: 0,
			upQty: adjustedQty,
			downDiff: originalQty,
			upDiff: adjustedQty - originalQty
		};
	}

	const downQty = lowerBoxes * cartonQty;
	const upQty = upperBoxes * cartonQty;
	const downDiff = originalQty - downQty;
	const upDiff = upQty - originalQty;
	const useUpper = upDiff <= downDiff;
	const boxes = useUpper ? upperBoxes : lowerBoxes;
	const adjustedQty = boxes * cartonQty;

	return {
		originalQty,
		boxPcs: cartonQty,
		adjustedQty,
		boxes,
		delta: adjustedQty - originalQty,
		mode: upDiff === downDiff ? "tie_up" : (useUpper ? "upper" : "lower"),
		hasValidBox: true,
		downQty,
		upQty,
		downDiff,
		upDiff
	};
}

const getBoxAdjustmentResult = (item: any) => {
	return roundPurchaseQtyByBoxPcs(getItemActualPurchaseQty(item), getEffectiveBoxPcs(item));
};

const formatSignedQty = (value: any) => {
	const qty = Math.round(Number(value) || 0);
	if (qty > 0) return `+${qty}`;
	return String(qty);
};

const getBoxAdjustmentSummary = (item: any) => {
	const result = getBoxAdjustmentResult(item);
	if (!result.hasValidBox) return "未设置有效装箱数，暂按原实际采购量生成";
	if (result.originalQty <= 0) return "原实际采购量为0，不做装箱调整";
	if (result.mode === "min_one") return `低于1箱，最低按1箱，最终${result.adjustedQty}，多${result.delta}件`;
	const directionText = result.delta > 0 ? `多${result.delta}件` : result.delta < 0 ? `少${Math.abs(result.delta)}件` : "无差异";
	if (result.mode === "tie_up") {
		return `${result.originalQty} ÷ ${result.boxPcs} = ${(result.originalQty / result.boxPcs).toFixed(2)}箱，两边相同，向上取${result.boxes}箱，最终${result.adjustedQty}，${directionText}`;
	}
	return `${result.originalQty} ÷ ${result.boxPcs} = ${(result.originalQty / result.boxPcs).toFixed(2)}箱，取${result.boxes}箱，最终${result.adjustedQty}，${directionText}`;
};

const getBoxAdjustmentFormula = (item: any) => {
	const result = getBoxAdjustmentResult(item);
	const lines = [
		'<div class="qty-tooltip-block">',
		`<div>原实际采购量：${result.originalQty}</div>`
	];
	if (!result.hasValidBox) {
		lines.push('<div>装箱数：未设置有效值</div>');
		lines.push(`<div>最终生成数量：<strong>${result.adjustedQty}</strong></div>`);
		lines.push('<div class="qty-tooltip-section">输入有效装箱数后会自动按最近整箱重算。</div>');
		lines.push('</div>');
		return lines.join('');
	}

	lines.push(`<div>装箱数：${result.boxPcs}</div>`);
	if (result.originalQty > 0) {
		lines.push(`<div>下整箱：${result.downQty}（差 ${result.downDiff}）</div>`);
		lines.push(`<div>上整箱：${result.upQty}（差 ${result.upDiff}）</div>`);
	}
	if (result.mode === "min_one") {
		lines.push('<div class="qty-tooltip-section">低于1箱时，最低按1箱。</div>');
	} else if (result.mode === "tie_up") {
		lines.push('<div class="qty-tooltip-section">上下差值相同，按规则向上取。</div>');
	}
	lines.push(`<div>最终生成数量：<strong>${result.adjustedQty}</strong>（装箱调整 ${formatSignedQty(result.delta)}）</div>`);
	lines.push('</div>');
	return lines.join('');
};

const formatJson = (value: any) => {
	try {
		return JSON.stringify(value ?? {}, null, 2);
	} catch {
		return String(value ?? "");
	}
};

const formatDebugRawValue = (value: any) => {
	if (value === undefined) return "未返回";
	if (value === null) return "null";
	if (value === "") return "(空字符串)";
	if (typeof value === "object") return formatJson(value);
	return String(value);
};

const getBoxPcsDebugRawField = (result: any, field: string) => {
	const data = result?.rawResponse?.data;
	if (!data || typeof data !== "object") return undefined;
	return Object.prototype.hasOwnProperty.call(data, field) ? data[field] : undefined;
};

const getBoxPcsDebugProductInfoField = (result: any, field: string) => {
	if (field === "purchase_remark") return result?.product_info?.purchase_remark;
	if (field === "cg_box_pcs") return result?.product_info?.cg_box_pcs;
	return result?.product_info?.[field];
};

const formatBoxPcsRequestParams = (item: any) => {
	const params = item?._cgBoxPcsRequestParams || resolveBoxPcsRequestParams(item);
	return params ? JSON.stringify(params) : "缺少 product_id / SKU";
};

const applyBoxPcsResultToItem = (item: any, result: any) => {
	item._cgBoxPcsLoading = false;
	item._cgBoxPcsLoaded = true;
	item._cgBoxPcsRequestParams = result?.requestParams || resolveBoxPcsRequestParams(item);

	if (result?.success) {
		item._cgBoxPcs = result.cg_box_pcs;
		item.cg_box_pcs = result.cg_box_pcs;
		const purchaseRemark = normalizeProductPurchaseRemark(
			result.purchase_remark ?? result.product_info?.purchase_remark
		);
		item._productPurchaseRemarkOriginal = purchaseRemark;
		item.purchase_remark = purchaseRemark;
		item.product_purchase_remark = purchaseRemark;
		if (!item._productPurchaseRemarkDirty) {
			item._productPurchaseRemark = purchaseRemark;
		}
		item._cgBoxPcsError = "";
		item._cgBoxPcsMessage = result.message || "success";
		return;
	}

	item._cgBoxPcsError = result?.message || "装箱数查询失败";
	item._cgBoxPcsMessage = "";
};

const fetchBoxPcsForItems = async (items: any[], force = false) => {
	const targets = items.filter(item => {
		if (!resolveBoxPcsRequestParams(item)) return false;
		if (force) return true;
		return !item._cgBoxPcsLoaded && !item._cgBoxPcsLoading;
	});

	if (targets.length === 0) return;

	targets.forEach(item => {
		item._cgBoxPcsLoading = true;
		item._cgBoxPcsError = "";
		item._cgBoxPcsMessage = "查询中";
		item._cgBoxPcsRequestParams = resolveBoxPcsRequestParams(item);
	});

	try {
		const res = await service.request({
			url: "/admin/app/analysis/getLocalProductBoxPcsBatch",
			method: "POST",
			data: {
				items: targets.map(buildBoxPcsPayloadItem)
			}
		});
		const resultMap = new Map((res?.list || []).map((result: any) => [result.clientKey, result]));
		targets.forEach(item => {
			const result = resultMap.get(getBoxPcsClientKey(item));
			applyBoxPcsResultToItem(item, result || { success: false, message: "接口未返回该产品结果" });
		});
	} catch (error: any) {
		targets.forEach(item => {
			item._cgBoxPcsLoading = false;
			item._cgBoxPcsLoaded = false;
			item._cgBoxPcsError = error?.message || "装箱数查询失败";
			item._cgBoxPcsMessage = "";
		});
	}
};

const fetchBoxPcsForItem = async (item: any, force = false) => {
	await fetchBoxPcsForItems([item], force);
};

const loadBoxPcsForItems = () => {
	if (!props.visible) return;
	fetchBoxPcsForItems(props.items || []);
};

const openBoxPcsDebug = (item: any) => {
	boxPcsDebugItem.value = item;
	boxPcsDebugResult.value = null;
	boxPcsDebugVisible.value = true;
	runBoxPcsDebug();
};

const runBoxPcsDebug = async () => {
	const item = boxPcsDebugItem.value;
	if (!item) return;

	boxPcsDebugLoading.value = true;
	const payload = buildBoxPcsPayloadItem(item);

	try {
		const res = await service.request({
			url: "/admin/app/analysis/debugLocalProductInfo",
			method: "POST",
			data: payload
		});
		boxPcsDebugResult.value = res;
		applyBoxPcsResultToItem(item, res);
	} catch (error: any) {
		const result = {
			success: false,
			message: error?.message || "调试接口调用失败",
			requestParams: resolveBoxPcsRequestParams(item)
		};
		boxPcsDebugResult.value = result;
		applyBoxPcsResultToItem(item, result);
	} finally {
		boxPcsDebugLoading.value = false;
	}
};

// ========== 单品运输方式偏好 ==========
const getShippingMethodPrefsClientKey = (item: any) => {
	if (!item._shippingMethodPrefsClientKey) {
		item._shippingMethodPrefsClientKey = item._batchId || `shipping_pref_${item.id || "no_id"}_${item.product_code || item.msku || Date.now()}`;
	}
	return item._shippingMethodPrefsClientKey;
};

const buildShippingMethodPrefsPayloadItem = (item: any, inactiveMethods?: string[]) => {
	const payload: any = {
		clientKey: getShippingMethodPrefsClientKey(item),
		listing_id: item.id,
		product_code: item.product_code,
		marketplace: item.marketplace,
		asin: item.asin,
		msku: item.msku,
		store_id: item.store_id
	};

	if (inactiveMethods !== undefined) {
		payload.inactive_methods = inactiveMethods;
	}

	return payload;
};

const normalizeLoadedShippingMethodPrefs = (value: any) => {
	const validKeys = new Set(shippingMethods.map(method => method.key));
	const list = Array.isArray(value) ? value : [];
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const raw of list) {
		const key = String(raw || "").trim();
		if (!validKeys.has(key) || seen.has(key)) continue;
		seen.add(key);
		normalized.push(key);
	}

	return normalized;
};

const canPersistShippingMethodPrefs = (item: any) => {
	return Boolean(
		String(item?.product_code || "").trim() &&
		String(item?.marketplace || "").trim() &&
		String(item?.asin || "").trim() &&
		String(item?.msku || "").trim() &&
		Number(item?.store_id) > 0
	);
};

const applyShippingMethodPrefsResultToItem = (item: any, result: any) => {
	item._shippingMethodPrefsLoading = false;
	item._shippingMethodPrefsLoaded = true;
	item._shippingMethodPrefsRecordId = result?.record_id || null;
	item.inactiveMethods = normalizeLoadedShippingMethodPrefs(result?.inactive_methods);
};

const loadShippingMethodPrefsForItems = async () => {
	if (!props.visible) return;
	const targets = (props.items || []).filter(item => !item._shippingMethodPrefsLoaded && !item._shippingMethodPrefsLoading);
	if (targets.length === 0) return;

	targets.forEach(item => {
		item._shippingMethodPrefsLoading = true;
	});

	try {
		const res = await service.request({
			url: "/admin/app/analysis/getShippingMethodPrefsBatch",
			method: "POST",
			data: {
				items: targets.map(item => buildShippingMethodPrefsPayloadItem(item))
			}
		});
		const resultMap = new Map((res?.list || []).map((result: any) => [result.clientKey, result]));
		targets.forEach(item => {
			const result = resultMap.get(getShippingMethodPrefsClientKey(item));
			applyShippingMethodPrefsResultToItem(item, result || { inactive_methods: [] });
		});
	} catch (error: any) {
		targets.forEach(item => {
			item._shippingMethodPrefsLoading = false;
			item._shippingMethodPrefsLoaded = true;
			item.inactiveMethods = [];
		});
		ElMessage.error(error?.message || "运输方式偏好加载失败，已使用默认全开");
	}
};

const saveShippingMethodPrefs = async (item: any) => {
	if (!canPersistShippingMethodPrefs(item)) {
		ElMessage.warning("缺少产品定位信息，本次运输方式调整不会永久保存");
		return;
	}

	const res = await service.request({
		url: "/admin/app/analysis/saveShippingMethodPrefs",
		method: "POST",
		data: buildShippingMethodPrefsPayloadItem(item, normalizeLoadedShippingMethodPrefs(item.inactiveMethods))
	});
	item._shippingMethodPrefsLoaded = true;
	item._shippingMethodPrefsRecordId = res?.record_id || item._shippingMethodPrefsRecordId || null;
	item.inactiveMethods = normalizeLoadedShippingMethodPrefs(res?.inactive_methods ?? item.inactiveMethods);
};

const hasPendingInitialItemSettings = () => {
	return (props.items || []).some(item =>
		item._targetStockDaysLoading
		|| item._shippingMethodPrefsLoading
		|| item._volatilityCoefficientLoading
	);
};

const loadInitialReplenishItemSettings = async () => {
	await loadShippingMethodPrefsForItems();
	await Promise.all([
		loadTargetStockDaysForItems(false),
		loadVolatilityCoefficientForItems(false)
	]);
	if (hasPendingInitialItemSettings()) return;
	if (deferCalculationIfPurchasePlanSyncing()) return;
	await applyToAll(true);
};

// ========== 目标库存天数 ==========
const getTargetStockDaysClientKey = (item: any) => {
	if (!item._targetStockDaysClientKey) {
		item._targetStockDaysClientKey = item._batchId || `target_${item.id || "no_id"}_${item.product_code || item.msku || Date.now()}`;
	}
	return item._targetStockDaysClientKey;
};

const buildTargetStockDaysPayloadItem = (item: any, targetDays?: number | null) => {
	const payload: any = {
		clientKey: getTargetStockDaysClientKey(item),
		listing_id: item.id,
		product_code: item.product_code,
		marketplace: item.marketplace,
		asin: item.asin,
		msku: item.msku,
		store_id: item.store_id
	};

	if (targetDays !== undefined) {
		payload.target_days = targetDays;
	}

	return payload;
};

const normalizeLoadedTargetStockDays = (value: any) => {
	if (value === undefined || value === null || value === "") return null;
	const num = Number(value);
	return Number.isInteger(num) && num >= 0 && num <= MAX_TARGET_STOCK_DAYS ? num : null;
};

const applyTargetStockDaysResultToItem = (item: any, result: any) => {
	item._targetStockDaysLoading = false;
	item._targetStockDaysLoaded = true;
	item._targetStockDaysRecordId = result?.record_id || null;
	const value = normalizeLoadedTargetStockDays(result?.target_days);
	item._targetStockDays = value;
	item.target_days = value;
	item._targetStockDaysInput = value === null || value === undefined ? "" : String(value);
};

const loadTargetStockDaysForItems = async (autoApply = true) => {
	if (!props.visible) return;
	const targets = (props.items || []).filter(item => !item._targetStockDaysLoaded && !item._targetStockDaysLoading);
	if (targets.length === 0) {
		if (!autoApply) return;
		if (hasPendingInitialItemSettings()) return;
		if (deferCalculationIfPurchasePlanSyncing()) return;
		await applyToAll(true);
		return;
	}

	targets.forEach(item => {
		item._targetStockDaysLoading = true;
	});

	try {
		const res = await service.request({
			url: "/admin/app/analysis/getTargetStockDaysBatch",
			method: "POST",
			data: {
				items: targets.map(item => buildTargetStockDaysPayloadItem(item))
			}
		});
		const resultMap = new Map((res?.list || []).map((result: any) => [result.clientKey, result]));
		targets.forEach(item => {
			const result = resultMap.get(getTargetStockDaysClientKey(item));
			if (result) {
				applyTargetStockDaysResultToItem(item, result);
			} else {
				item._targetStockDaysLoading = false;
				item._targetStockDaysLoaded = true;
			}
		});
		if (!autoApply || hasPendingInitialItemSettings()) return;
		if (deferCalculationIfPurchasePlanSyncing()) return;
		await applyToAll(true);
	} catch (error: any) {
		targets.forEach(item => {
			item._targetStockDaysLoading = false;
			item._targetStockDaysLoaded = false;
		});
		ElMessage.error(error?.message || "目标库存天数加载失败");
		if (!autoApply || hasPendingInitialItemSettings()) return;
		if (deferCalculationIfPurchasePlanSyncing()) return;
		await applyToAll(true);
	}
};

const normalizeTargetStockDaysInput = (value: any) => {
	const text = String(value ?? "").trim();
	if (!text) return null;
	if (!/^\d+$/.test(text)) {
		throw new Error(`目标库存天数必须是 0 到 ${MAX_TARGET_STOCK_DAYS} 之间的整数`);
	}
	const num = Number(text);
	if (!Number.isInteger(num) || num < 0 || num > MAX_TARGET_STOCK_DAYS) {
		throw new Error(`目标库存天数必须是 0 到 ${MAX_TARGET_STOCK_DAYS} 之间的整数`);
	}
	return num;
};

const clearTargetStockDaysAutoSaveTimer = (item: any) => {
	if (item._targetStockDaysAutoSaveTimer) {
		clearTimeout(item._targetStockDaysAutoSaveTimer);
		item._targetStockDaysAutoSaveTimer = null;
	}
};

const previewTargetStockDaysDateRange = (item: any) => {
	try {
		const nextValue = normalizeTargetStockDaysInput(item._targetStockDaysInput);
		applyItemReplenishDateRange(item, nextValue);
	} catch {
		// 输入非法时不刷新日期，保存阶段统一提示并回滚输入。
	}
};

const scheduleTargetStockDaysSave = (item: any, value?: string | number) => {
	if (value !== undefined) {
		item._targetStockDaysInput = String(value);
	}
	previewTargetStockDaysDateRange(item);
	clearTargetStockDaysAutoSaveTimer(item);
	item._targetStockDaysAutoSaveTimer = window.setTimeout(() => {
		item._targetStockDaysAutoSaveTimer = null;
		saveTargetStockDays(item, { silentSuccess: true });
	}, TARGET_STOCK_DAYS_AUTO_SAVE_DELAY);
};

const saveTargetStockDays = async (item: any, options: { silentSuccess?: boolean } = {}) => {
	clearTargetStockDaysAutoSaveTimer(item);
	if (item._targetStockDaysSaving) return false;

	let nextValue: number | null;
	try {
		nextValue = normalizeTargetStockDaysInput(item._targetStockDaysInput);
	} catch (error: any) {
		ElMessage.warning(error?.message || "目标库存天数格式不正确");
		item._targetStockDaysInput = item._targetStockDays === null || item._targetStockDays === undefined
			? ""
			: String(item._targetStockDays);
		return false;
	}

	if ((item._targetStockDays ?? null) === nextValue) {
		item._targetStockDaysInput = nextValue === null ? "" : String(nextValue);
		applyItemReplenishDateRange(item, nextValue);
		return true;
	}

	const oldValue = item._targetStockDays;
	const oldInput = oldValue === null || oldValue === undefined ? "" : String(oldValue);
	item._targetStockDaysSaving = true;

	try {
		const res = await service.request({
			url: "/admin/app/analysis/saveTargetStockDays",
			method: "POST",
			data: buildTargetStockDaysPayloadItem(item, nextValue)
		});
		item._targetStockDaysSaving = false;
		applyTargetStockDaysResultToItem(item, {
			...res,
			target_days: res?.target_days ?? nextValue
		});
		const range = applyItemReplenishDateRange(item);
		if (range) {
			await recalculateItemByDateRange(item, range[0], range[1], true);
		}
		if (!options.silentSuccess) {
			ElMessage.success("目标库存天数已保存");
		}
		return true;
	} catch (error: any) {
		item._targetStockDaysSaving = false;
		item._targetStockDays = oldValue ?? null;
		item._targetStockDaysInput = oldInput;
		applyItemReplenishDateRange(item);
		ElMessage.error(error?.message || "目标库存天数保存失败");
		return false;
	}
};

// ========== 波动系数 ==========
const getVolatilityCoefficientClientKey = (item: any) => {
	if (!item._volatilityCoefficientClientKey) {
		item._volatilityCoefficientClientKey = item._batchId || `volatility_${item.id || "no_id"}_${item.product_code || item.msku || Date.now()}`;
	}
	return item._volatilityCoefficientClientKey;
};

const buildVolatilityCoefficientPayloadItem = (item: any, volatilityCoefficient?: number) => {
	const payload: any = {
		clientKey: getVolatilityCoefficientClientKey(item),
		listing_id: item.listing_id || item.id,
		product_code: item.product_code,
		marketplace: item.marketplace,
		asin: item.asin,
		msku: item.msku,
		store_id: item.store_id
	};

	if (volatilityCoefficient !== undefined) {
		payload.volatility_coefficient = volatilityCoefficient;
	}

	return payload;
};

const applyVolatilityCoefficientResultToItem = (item: any, result: any) => {
	item._volatilityCoefficientLoading = false;
	item._volatilityCoefficientLoaded = true;
	item._volatilityCoefficientRecordId = result?.record_id || null;
	const value = normalizeLoadedVolatilityCoefficient(result?.volatility_coefficient);
	item._volatilityCoefficient = value;
	item.volatility_coefficient = value;
	item._volatilityCoefficientInput = formatVolatilityCoefficientInput(value);
};

const loadVolatilityCoefficientForItems = async (autoApply = true) => {
	if (!props.visible) return;
	const targets = (props.items || []).filter(item => !item._volatilityCoefficientLoaded && !item._volatilityCoefficientLoading);
	if (targets.length === 0) {
		if (!autoApply) return;
		if (hasPendingInitialItemSettings()) return;
		if (deferCalculationIfPurchasePlanSyncing()) return;
		await applyToAll(true);
		return;
	}

	targets.forEach(item => {
		item._volatilityCoefficientLoading = true;
	});

	try {
		const res = await service.request({
			url: "/admin/app/analysis/getVolatilityCoefficientBatch",
			method: "POST",
			data: {
				items: targets.map(item => buildVolatilityCoefficientPayloadItem(item))
			}
		});
		const resultMap = new Map((res?.list || []).map((result: any) => [result.clientKey, result]));
		targets.forEach(item => {
			const result = resultMap.get(getVolatilityCoefficientClientKey(item));
			if (result) {
				applyVolatilityCoefficientResultToItem(item, result);
			} else {
				applyVolatilityCoefficientResultToItem(item, {
					volatility_coefficient: DEFAULT_VOLATILITY_COEFFICIENT
				});
			}
		});
		if (!autoApply || hasPendingInitialItemSettings()) return;
		if (deferCalculationIfPurchasePlanSyncing()) return;
		await applyToAll(true);
	} catch (error: any) {
		targets.forEach(item => {
			item._volatilityCoefficientLoading = false;
			item._volatilityCoefficientLoaded = false;
			item._volatilityCoefficient = DEFAULT_VOLATILITY_COEFFICIENT;
			item._volatilityCoefficientInput = formatVolatilityCoefficientInput(DEFAULT_VOLATILITY_COEFFICIENT);
		});
		ElMessage.error(error?.message || "波动系数加载失败，已按 0.75 计算");
		if (!autoApply || hasPendingInitialItemSettings()) return;
		if (deferCalculationIfPurchasePlanSyncing()) return;
		await applyToAll(true);
	}
};

const normalizeVolatilityCoefficientInput = (value: any) => {
	const text = String(value ?? "").trim();
	if (!text) return DEFAULT_VOLATILITY_COEFFICIENT;
	if (!/^\d+(\.\d{0,2})?$/.test(text)) {
		throw new Error(`波动系数必须是 ${MIN_VOLATILITY_COEFFICIENT} 到 ${MAX_VOLATILITY_COEFFICIENT} 之间的数字，最多 2 位小数`);
	}
	const num = Number(text);
	if (!Number.isFinite(num) || num < MIN_VOLATILITY_COEFFICIENT || num > MAX_VOLATILITY_COEFFICIENT) {
		throw new Error(`波动系数必须是 ${MIN_VOLATILITY_COEFFICIENT} 到 ${MAX_VOLATILITY_COEFFICIENT} 之间的数字`);
	}
	return Math.round(num * 100) / 100;
};

const recalculateItemAfterCoefficientConfigChange = async (item: any) => {
	if (!hasGlobalCalcData.value) return;
	if (item.replenishDateRange && item.replenishDateRange.length === 2 && item.replenishDateRange[0] && item.replenishDateRange[1]) {
		await recalculateItemByDateRange(item, item.replenishDateRange[0], item.replenishDateRange[1], true);
		return;
	}
	await recalculateSingleItem(item, true);
};

const saveVolatilityCoefficient = async (
	item: any,
	options: { silentSuccess?: boolean; skipRecalculate?: boolean } = {}
) => {
	if (item._volatilityCoefficientSaving) return false;

	let nextValue: number;
	try {
		nextValue = normalizeVolatilityCoefficientInput(item._volatilityCoefficientInput);
	} catch (error: any) {
		ElMessage.warning(error?.message || "波动系数格式不正确");
		item._volatilityCoefficientInput = formatVolatilityCoefficientInput(item._volatilityCoefficient);
		return false;
	}

	const currentValue = getItemVolatilityCoefficient(item);
	if (currentValue === nextValue) {
		item._volatilityCoefficientInput = formatVolatilityCoefficientInput(nextValue);
		return true;
	}

	const oldValue = currentValue;
	const oldInput = item._volatilityCoefficientInput;
	item._volatilityCoefficientSaving = true;

	try {
		const res = await service.request({
			url: "/admin/app/analysis/saveVolatilityCoefficient",
			method: "POST",
			data: buildVolatilityCoefficientPayloadItem(item, nextValue)
		});
		item._volatilityCoefficientSaving = false;
		applyVolatilityCoefficientResultToItem(item, {
			...res,
			volatility_coefficient: res?.volatility_coefficient ?? nextValue
		});
		if (!options.skipRecalculate) {
			await recalculateItemAfterCoefficientConfigChange(item);
		}
		if (!options.silentSuccess) {
			ElMessage.success("波动系数已保存");
		}
		return true;
	} catch (error: any) {
		item._volatilityCoefficientSaving = false;
		item._volatilityCoefficient = oldValue;
		item.volatility_coefficient = oldValue;
		item._volatilityCoefficientInput = oldInput;
		ElMessage.error(error?.message || "波动系数保存失败");
		return false;
	}
};

watch(() => props.items, () => {
	initItemsDefaultProps();
}, { immediate: true, deep: true });

watch(() => props.visible, (val) => {
	if (val) {
		clearSyncNoticeTimers();
		syncNoticeDismissed.value = false;
		syncNoticeLeaving.value = false;
		initItemsDefaultProps();
		applyDefaultGlobalSettings();
		if (props.purchasePlanSyncing) {
			clearAllItemCalcData();
			deferredCalculateAfterPurchasePlanSync.value = true;
		}
		loadBoxPcsForItems();
		void fetchWarehouseList();
		void loadInitialReplenishItemSettings();
		void loadCalendarDataForItems(props.items);
	}
});

watch(() => props.purchasePlanSyncing, async (syncing, prevSyncing) => {
	if (syncing) {
		clearSyncNoticeTimers();
		syncNoticeDismissed.value = false;
		syncNoticeLeaving.value = false;
		deferredCalculateAfterPurchasePlanSync.value = true;
		clearAllItemCalcData();
		return;
	}
	if (!props.visible || !prevSyncing || !deferredCalculateAfterPurchasePlanSync.value) return;
	if (hasPendingInitialItemSettings()) return;
	deferredCalculateAfterPurchasePlanSync.value = false;
	await applyToAll(true);
});

watch(() => props.purchasePlanSyncResult, (result) => {
	clearSyncNoticeTimers();
	syncNoticeLeaving.value = false;
	if (!result || result.status !== "success") return;
	syncNoticeDismissed.value = false;
	syncNoticeAutoDismissTimer = setTimeout(() => {
		hideSyncNoticeWithAnimation();
	}, 5000);
});

const emit = defineEmits(["update:visible", "success", "retry-sync-failed"]);

const dialogVisible = computed({
	get: () => props.visible,
	set: (val: boolean) => emit("update:visible", val)
});

const coeffPanelVisible = ref(false);
const coeffPanelItem = ref<any | null>(null);

const openCoeffPanel = (item: any) => {
	coeffPanelItem.value = item;
	item._coeffPanelTab = item._coeffPanelTab || "current";
	coeffPanelVisible.value = true;
	if (!item._calendarData && !item._calendarDataLoading) {
		void loadCalendarDataForItems([item]);
	}
};

// ========== 运输方式配置 ==========
const resolveShippingProfile = (key: any) => {
	return SHIPPING_PROFILES[String(key || "default") as ShippingProfileKey] || SHIPPING_PROFILES.default;
};

const buildShippingMethodsForProfile = (key: ShippingProfileKey) => {
	const profile = resolveShippingProfile(key);
	const selectedKeys = new Set(profile.selectedMethods);

	return DEFAULT_SHIPPING_METHOD_CONFIGS
		.filter(method => selectedKeys.has(method.key))
		.map(method => ({
			...method,
			days: profile.methodDays[method.key] ?? method.days
		}));
};

const shippingMethods = reactive<ShippingMethodConfig[]>(buildShippingMethodsForProfile("default"));
const shippingBuffer = ref(DEFAULT_SHIPPING_BUFFER);
const globalShippingProfile = ref<ShippingProfileKey>("default");
const shippingProfileOptions = Object.values(SHIPPING_PROFILES).map(profile => ({
	key: profile.key,
	label: profile.label
}));
const currentShippingProfile = computed(() => resolveShippingProfile(globalShippingProfile.value));
const isGlobalShippingProfileReadonly = computed(() => currentShippingProfile.value.readonly);
// 默认全选运输方式
const globalSelectedShippingMethods = ref<string[]>([...SHIPPING_PROFILES.default.selectedMethods]);

const currentShippingProfileSummaryMethods = computed(() => {
	return sortedSelectedMethods.value
		.map(key => shippingMethods.find(method => method.key === key))
		.filter(Boolean) as ShippingMethodConfig[];
});

const applyShippingProfile = (key: any) => {
	const profile = resolveShippingProfile(key);
	globalShippingProfile.value = profile.key;
	shippingMethods.splice(0, shippingMethods.length, ...buildShippingMethodsForProfile(profile.key));
	globalSelectedShippingMethods.value = [...profile.selectedMethods];
};

// 按速度排序的选中物流方式（快的在前）
const sortedSelectedMethods = computed(() => {
	return [...globalSelectedShippingMethods.value].sort((a, b) => {
		const da = shippingMethods.find(m => m.key === a)?.days || 0;
		const db = shippingMethods.find(m => m.key === b)?.days || 0;
		return da - db;
	});
});

type BulkMethodAction = "enable" | "disable";
type BulkTargetAction = "set" | "clear";

const bulkSelectedKeys = ref<string[]>([]);
const bulkSettingsVisible = ref(false);
const bulkSettingsApplying = ref(false);
const bulkSettingsForm = reactive({
	updateWarehouse: false,
	warehouseWid: "" as number | "",
	updateShipping: false,
	methodKeys: [] as string[],
	methodAction: "disable" as BulkMethodAction,
	updateTargetDays: false,
	targetAction: "set" as BulkTargetAction,
	targetDays: DEFAULT_TARGET_STOCK_DAYS as number | null,
	updateVolatility: false,
	volatilityCoefficient: DEFAULT_VOLATILITY_COEFFICIENT
});

const getBulkItemKey = (item: any) => {
	if (!item._bulkSelectKey) {
		item._bulkSelectKey = item._batchId || `bulk_${item.id || "no_id"}_${item.product_code || item.msku || Date.now()}`;
	}
	return item._bulkSelectKey;
};

const bulkSelectableItems = computed(() => (props.items || []).filter(item => item && !item._excluded));

const bulkSelectedItems = computed(() => {
	const selected = new Set(bulkSelectedKeys.value);
	return bulkSelectableItems.value.filter(item => selected.has(getBulkItemKey(item)));
});

const bulkSelectedCount = computed(() => bulkSelectedItems.value.length);

const isItemBulkSelected = (item: any) => {
	return bulkSelectedKeys.value.includes(getBulkItemKey(item));
};

const setItemBulkSelected = (item: any, selected: boolean) => {
	const key = getBulkItemKey(item);
	if (selected) {
		if (!bulkSelectedKeys.value.includes(key)) {
			bulkSelectedKeys.value = [...bulkSelectedKeys.value, key];
		}
		return;
	}
	bulkSelectedKeys.value = bulkSelectedKeys.value.filter(itemKey => itemKey !== key);
};

const selectAllBulkItems = () => {
	bulkSelectedKeys.value = bulkSelectableItems.value.map(item => getBulkItemKey(item));
};

const clearBulkSelection = () => {
	bulkSelectedKeys.value = [];
};

const isBulkMethodSelected = (methodKey: string) => {
	return bulkSettingsForm.methodKeys.includes(methodKey);
};

const setBulkMethodKeySelected = (methodKey: string, selected: boolean) => {
	if (!bulkSettingsForm.updateShipping) return;
	if (selected) {
		if (!bulkSettingsForm.methodKeys.includes(methodKey)) {
			bulkSettingsForm.methodKeys = [...bulkSettingsForm.methodKeys, methodKey];
		}
		return;
	}
	bulkSettingsForm.methodKeys = bulkSettingsForm.methodKeys.filter(key => key !== methodKey);
};

const toggleBulkMethodKey = (methodKey: string) => {
	if (!bulkSettingsForm.updateShipping) return;
	setBulkMethodKeySelected(methodKey, !isBulkMethodSelected(methodKey));
};

const openBulkSettingsDialog = (options: { enableWarehouse?: boolean; enableShipping?: boolean; enableTargetDays?: boolean; enableVolatility?: boolean } = {}) => {
	if (bulkSelectedCount.value === 0) {
		ElMessage.warning("请先勾选要批量设置的商品");
		return;
	}
	bulkSettingsForm.updateWarehouse = Boolean(options.enableWarehouse);
	bulkSettingsForm.updateShipping = Boolean(options.enableShipping);
	bulkSettingsForm.updateTargetDays = Boolean(options.enableTargetDays);
	bulkSettingsForm.updateVolatility = Boolean(options.enableVolatility);
	bulkSettingsForm.methodKeys = bulkSettingsForm.methodKeys.filter(key => sortedSelectedMethods.value.includes(key));
	bulkSettingsVisible.value = true;
};

const applyBulkSettings = async () => {
	if (bulkSelectedCount.value === 0) {
		ElMessage.warning("请先勾选要批量设置的商品");
		return;
	}
	if (!bulkSettingsForm.updateWarehouse && !bulkSettingsForm.updateShipping && !bulkSettingsForm.updateTargetDays && !bulkSettingsForm.updateVolatility) {
		ElMessage.warning("请至少选择一项批量设置内容");
		return;
	}
	if (bulkSettingsForm.updateWarehouse && !normalizeWarehouseWid(bulkSettingsForm.warehouseWid)) {
		ElMessage.warning("请选择采购仓库");
		return;
	}
	if (bulkSettingsForm.updateShipping && bulkSettingsForm.methodKeys.length === 0) {
		ElMessage.warning("请选择要处理的运输方式");
		return;
	}

	const targetDays = Number(bulkSettingsForm.targetDays);
	if (
		bulkSettingsForm.updateTargetDays
		&& bulkSettingsForm.targetAction === "set"
		&& (!Number.isInteger(targetDays) || targetDays < 0 || targetDays > MAX_TARGET_STOCK_DAYS)
	) {
		ElMessage.warning(`目标库存天数必须是 0 到 ${MAX_TARGET_STOCK_DAYS} 之间的整数`);
		return;
	}

	let volatilityCoefficient = DEFAULT_VOLATILITY_COEFFICIENT;
	if (bulkSettingsForm.updateVolatility) {
		try {
			volatilityCoefficient = normalizeVolatilityCoefficientInput(bulkSettingsForm.volatilityCoefficient);
		} catch (error: any) {
			ElMessage.warning(error?.message || "波动系数格式不正确");
			return;
		}
	}

	bulkSettingsApplying.value = true;
	let warehouseSuccess = 0;
	let shippingSuccess = 0;
	let targetSuccess = 0;
	let volatilitySuccess = 0;
	let skipped = 0;
	let failed = 0;
	const warehouseWid = normalizeWarehouseWid(bulkSettingsForm.warehouseWid);
	const methodKeys = bulkSettingsForm.methodKeys.filter(key => sortedSelectedMethods.value.includes(key));

	for (const item of bulkSelectedItems.value) {
		try {
			if (bulkSettingsForm.updateWarehouse) {
				item._purchaseWarehouseWid = warehouseWid;
				clearWarehouseValidation(item);
				warehouseSuccess += 1;
			}

			if (bulkSettingsForm.updateShipping) {
				const shouldEnable = bulkSettingsForm.methodAction === "enable";
				const nextInactive = new Set(item.inactiveMethods || []);
				methodKeys.forEach(methodKey => {
					if (shouldEnable) {
						nextInactive.delete(methodKey);
					} else {
						nextInactive.add(methodKey);
					}
				});
				const nextActiveCount = sortedSelectedMethods.value.filter(methodKey => !nextInactive.has(methodKey)).length;
				if (nextActiveCount <= 0) {
					skipped += 1;
				} else {
					const saved = await setItemShippingMethodsActive(item, methodKeys, shouldEnable, { silent: true });
					if (saved) {
						shippingSuccess += methodKeys.length;
					} else {
						failed += 1;
					}
				}
			}

			if (bulkSettingsForm.updateTargetDays) {
				item._targetStockDaysInput = bulkSettingsForm.targetAction === "clear" ? "" : String(targetDays);
				const saved = await saveTargetStockDays(item, { silentSuccess: true });
				if (saved) {
					targetSuccess += 1;
				} else {
					failed += 1;
				}
			}

			if (bulkSettingsForm.updateVolatility) {
				item._volatilityCoefficientInput = formatVolatilityCoefficientInput(volatilityCoefficient);
				const saved = await saveVolatilityCoefficient(item, { silentSuccess: true });
				if (saved) {
					volatilitySuccess += 1;
				} else {
					failed += 1;
				}
			}
		} catch (error) {
			console.warn("[批量设置] 商品设置失败", error);
			failed += 1;
		}
	}

	bulkSettingsApplying.value = false;
	if (failed === 0) {
		bulkSettingsVisible.value = false;
	}

	const parts: string[] = [];
	if (bulkSettingsForm.updateWarehouse) parts.push(`仓库成功 ${warehouseSuccess} 个`);
	if (bulkSettingsForm.updateShipping) parts.push(`运输方式成功 ${shippingSuccess} 项`);
	if (bulkSettingsForm.updateTargetDays) parts.push(`目标库存成功 ${targetSuccess} 个`);
	if (bulkSettingsForm.updateVolatility) parts.push(`波动系数成功 ${volatilitySuccess} 个`);
	if (skipped > 0) parts.push(`跳过 ${skipped} 个`);
	if (failed > 0) parts.push(`失败 ${failed} 个`);
	ElMessage[failed > 0 ? "warning" : "success"](`批量设置完成：${parts.join("，")}`);
};

// 全局设置
const globalDateRange = ref<string[] | null>(null);
const globalAlgo = ref(DEFAULT_GLOBAL_ALGO);
const globalAlpha = ref(0.7); // α 默认 fallback（后端 monthlyCoefficients 优先）
const globalDays = ref(0);

// 全局数据是否已确认（有有效的日期范围）
const hasGlobalCalcData = computed(() => {
	return globalDateRange.value && globalDateRange.value.length === 2 && globalDateRange.value[0] && globalDateRange.value[1];
});

// 各运输方式的到达日（从快到慢排序）
const computedArrivalDates = computed(() => {
	const today = dayjs().startOf('day');
	return sortedSelectedMethods.value.map(key => {
		const method = shippingMethods.find(m => m.key === key);
		if (!method) return null;
		const arrival = today.add(method.days + shippingBuffer.value, 'day').format('YYYY-MM-DD');
		return { key, arrivalDate: arrival, days: method.days };
	}).filter(Boolean) as { key: string; arrivalDate: string; days: number }[];
});

// 给明细日期选择器的运输标记（仅用于日历上显示到达日标识，不触发运输选择模式）
const computedShippingMarkers = computed(() => {
	return computedArrivalDates.value.map(a => {
		const method = shippingMethods.find(m => m.key === a.key);
		return {
			key: a.key,
			label: method?.label || a.key,
			arrivalDate: a.arrivalDate,
			days: a.days,
			color: method?.color || '#999',
			icon: method?.icon || '📦'
		};
	});
});

// 明细级可选日期的最早日（最快运输方式的到达日）
const computedGlobalStartDate = computed(() => {
	if (computedArrivalDates.value.length === 0) return '';
	return computedArrivalDates.value[0].arrivalDate;
});

// 明细级可选日期的最晚日（全局结束日）
const computedGlobalEndDate = computed(() => {
	if (!globalDateRange.value || globalDateRange.value.length < 2) return '';
	return globalDateRange.value[1];
});

const getValidTargetStockDays = (value: any) => {
	const num = Number(value);
	return Number.isInteger(num) && num > 0 && num <= MAX_TARGET_STOCK_DAYS ? num : 0;
};

const getCustomTargetStockDays = (item: any) => {
	return getValidTargetStockDays(item?._targetStockDays ?? item?.target_days);
};

const getPreviewTargetStockDays = (item: any) => {
	try {
		return getValidTargetStockDays(normalizeTargetStockDaysInput(item?._targetStockDaysInput));
	} catch {
		return getCustomTargetStockDays(item);
	}
};

const buildItemReplenishDateRange = (item: any, targetDaysOverride?: number | null): string[] | null => {
	const customDays = targetDaysOverride === undefined
		? getCustomTargetStockDays(item)
		: getValidTargetStockDays(targetDaysOverride);
	if (customDays > 0) {
		const start = dayjs().startOf("day");
		return [
			start.format("YYYY-MM-DD"),
			start.add(customDays - 1, "day").format("YYYY-MM-DD")
		];
	}

	const globalStart = computedGlobalStartDate.value;
	const globalEnd = globalDateRange.value?.[1];
	return globalStart && globalEnd ? [globalStart, globalEnd] : null;
};

const applyItemReplenishDateRange = (item: any, targetDaysOverride?: number | null) => {
	const range = buildItemReplenishDateRange(item, targetDaysOverride);
	if (!range) return null;
	item.replenishDateRange = range;
	item.replenishAlgo = globalAlgo.value;
	return range;
};

const getItemDatePickerGlobalStartDate = (item: any) => {
	return getPreviewTargetStockDays(item) > 0 ? "" : computedGlobalStartDate.value;
};

const getItemDatePickerGlobalEndDate = (item: any) => {
	return getPreviewTargetStockDays(item) > 0 ? "" : computedGlobalEndDate.value;
};

const buildDefaultGlobalDateRange = () => {
	const method = shippingMethods.find(m => m.key === DEFAULT_LAST_SHIPPING_METHOD) || shippingMethods[shippingMethods.length - 1];
	const start = dayjs().startOf("day").add((method?.days || 0) + shippingBuffer.value, "day");
	return [
		start.format("YYYY-MM-DD"),
		start.add(DEFAULT_TARGET_STOCK_DAYS - 1, "day").format("YYYY-MM-DD")
	];
};

const applyDefaultGlobalSettings = () => {
	shippingBuffer.value = DEFAULT_SHIPPING_BUFFER;
	applyShippingProfile("default");
	globalAlgo.value = DEFAULT_GLOBAL_ALGO;
	globalDateRange.value = buildDefaultGlobalDateRange();
	props.items.forEach(item => {
		item.replenishAlgo = DEFAULT_GLOBAL_ALGO;
	});
};

// 清空所有明细的计算数据
const clearAllItemCalcData = () => {
	props.items.forEach(item => {
		item._calcResult = {};
		item.replenishDateRange = null; // 清空明细的日期选择器
		delete item._shippingQuantityManual;
		delete item._manualShippingQuantities;
		delete item._manualShippingGroups;
		delete item._shippingRedistributionEffects;
		delete item._shippingAdjustmentGroups;
		delete item._shippingAdjustMode;
		delete item._shippingAdjustModeTouched;
		delete item._shippingAdjustmentLog;
		delete item._purchasePlanDeductionApplied;
		if (item.shippingQuantities) {
			for (const key of Object.keys(item.shippingQuantities)) {
				item.shippingQuantities[key] = 0;
			}
		}
	});
};

const disablePastDate = (date: Date) => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return date < today;
};

const onGlobalDateChange = (val: any) => {
	console.log("全局日期变动:", val);
	globalDateRange.value = val;
	if (val && val.length === 2 && val[0] && val[1]) {
		applyToAll();
	} else {
		// 全局日期被清空，同步清空所有明细的计算数据
		clearAllItemCalcData();
	}
};

const onGlobalShippingChange = (payload: any) => {
	console.log("全局物流方式变动:", payload);
	globalSelectedShippingMethods.value = [...payload.methods];
	if (Number.isFinite(Number(payload.buffer))) {
		shippingBuffer.value = Number(payload.buffer);
	}
	if (payload.configs) {
		payload.configs.forEach((config: any) => {
			const method = shippingMethods.find(m => m.key === config.key);
			if (method) {
				method.days = config.days;
			}
		});
	}
};

const onGlobalShippingProfileChange = (profileKey: any) => {
	applyShippingProfile(profileKey);
	if (globalDateRange.value && globalDateRange.value.length === 2) {
		globalDateRange.value = buildDefaultGlobalDateRange();
		void applyToAll();
	}
};

const onItemDateChange = (item: any, range: string[] | null) => {
	console.log("单行日期变动:", item.asin, range);
	if (!range || range.length < 2 || !range[0] || !range[1]) {
		// Bug5: 清空日期时清理旧结果，回退到全局周期并重算
		delete item.replenishDateRange;
		item._calcResult = {};
		item.shippingQuantities = {};
		// 如果全局日期已设置，用全局日期重算此行
		if (hasGlobalCalcData.value) {
			recalculateSingleItem(item);
		}
		return;
	}
	item.replenishDateRange = range;
	// 用户在明细选了日期，触发自动分段 + API 计算
	recalculateItemByDateRange(item, range[0], range[1]);
};

const onItemShippingChange = (item: any, payload: any) => {
	console.log("单行物流方式变动:", item.asin, payload);
};

type ShippingDateRangeSegment = { key: string; startDate: string; endDate: string; days: number };

const pushMergedShippingSegment = (segments: ShippingDateRangeSegment[], next: ShippingDateRangeSegment) => {
	const last = segments[segments.length - 1];
	if (last && last.key === next.key && dayjs(last.endDate).add(1, 'day').format('YYYY-MM-DD') === next.startDate) {
		last.endDate = next.endDate;
		last.days = dayjs(last.endDate).diff(dayjs(last.startDate), 'day') + 1;
		return;
	}
	segments.push(next);
};

// ========== 核心：根据到达日将用户选的日期范围切分成多段，每段匹配最慢能到的运输方式 ==========
const computeItemSegments = (userStart: string, userEnd: string, inactiveMethods?: string[]) => {
	const arrivals = computedArrivalDates.value;
	
	if (arrivals.length === 0) return [];

	const inactive = new Set(inactiveMethods || []);
	const methodKeys = arrivals.map(a => a.key);
	const segments: ShippingDateRangeSegment[] = [];

	for (let i = 0; i < arrivals.length; i++) {
		const current = arrivals[i];
		const next = arrivals[i + 1];
		const targetKey = inactive.has(current.key)
			? getTransferTargetMethodKey(methodKeys, inactive, i)
			: current.key;
		if (!targetKey) continue;

		// 当前方式的段的开始日 = max(当前方式到达日, 用户选的开始日)
		const segStart = current.arrivalDate > userStart ? current.arrivalDate : userStart;

		// 当前方式的段的结束日 = min(下一个方式到达日, 用户选的结束日)
		let segEnd: string;
		if (next) {
			// 结束日 = 下一个方式到达日 - 1天（不重叠）
			const nextArrivalMinusOne = dayjs(next.arrivalDate).subtract(1, 'day').format('YYYY-MM-DD');
			segEnd = nextArrivalMinusOne < userEnd ? nextArrivalMinusOne : userEnd;
		} else {
			segEnd = userEnd;
		}

		// 跳过完全在用户范围之外的段
		if (segStart > userEnd || segEnd < userStart) continue;
		// segStart 不能晚于 segEnd
		if (segStart > segEnd) continue;

		const d = dayjs(segEnd).diff(dayjs(segStart), 'day') + 1;
		pushMergedShippingSegment(segments, { key: targetKey, startDate: segStart, endDate: segEnd, days: d });
	}

	return segments;
};

// ========== 单条明细自动分段计算（用户在明细选日期后触发） ==========
const recalculateItemByDateRange = async (item: any, userStart: string, userEnd: string, silent = false) => {
	if (deferCalculationIfPurchasePlanSyncing()) return;
	// 用只有激活方式的段计算，这样取消卡车后空运段会变宽，自然承接卡车的需求
	const segments = computeItemSegments(userStart, userEnd, item.inactiveMethods);
	item._calcResult = {};
	if (!item.shippingQuantities) item.shippingQuantities = {};
	for (const key of sortedSelectedMethods.value) {
		item.shippingQuantities[key] = 0;
	}

	if (segments.length === 0) {
		if (!silent) ElMessage.warning("当前周期内没有可到达的运输方式");
		return;
	}

	if (!item._batchId) item._batchId = `batch_seg_${Date.now()}`;
	const payloadItem = {
		id: item._batchId,
		product_code: item.product_code || '',
		asin: item.asin || '',
		marketplace: item.marketplace || '',
		dailyAvgSales: getCalcDailyAvgSales(item),
		volatility_coefficient: getItemVolatilityCoefficient(item),
		fbaValid: getFbaInventoryQuantity(item),
		fbaShippingList: filterByRowMsku(item.restocking?.fbaShippingList, item),
		listing_id: item.id,
		msku: item.msku || '',
		store_id: item.store_id,
		...getItemPreArrivalRequestFields(item)
	};

	const algorithm = mapAlgoToInt(item.replenishAlgo || globalAlgo.value);

	try {
		const coefficientRange = getDialogCalendarMonthRange();
		const results = await Promise.all(
			segments.map((seg, index) =>
				(service.app as any).bsr_purchase_order_sync_lingxing
					.batchCalculateGap({
						algorithm,
						startDate: seg.startDate,
						endDate: seg.endDate,
						alpha: undefined,
						coefficientStartMonth: coefficientRange.startMonth,
						coefficientEndMonth: coefficientRange.endMonth,
						includeInventoryUsage: true,
						adjustPastInboundToFirstArrival: true,
						...buildPreArrivalShortageParams(index, [item]),
						items: [payloadItem]
					})
					.then((res: any[]) => ({ key: seg.key, days: seg.days, startDate: seg.startDate, endDate: seg.endDate, results: res }))
					.catch((err: any) => {
						console.error(`[recalculateItemByDateRange] ${seg.key} 失败:`, err);
						return { key: seg.key, days: seg.days, startDate: seg.startDate, endDate: seg.endDate, results: [] };
					})
			)
		);

		for (const segment of results) {
			const match = segment.results.find((r: any) => String(r.id) === String(item._batchId));
			if (match && !match.warning) {
				item._calcResult[segment.key] = buildCalcResultFromMatch(match, segment);
				setShippingQuantityFromSystem(item, segment.key, match.gap);
			} else {
				item._calcResult[segment.key] = buildEmptyCalcResult(segment, match?.warning || '计算失败');
			}
		}
		movePreArrivalShortageToFirstActiveMethod(item);
		applyPurchasePlanDeductionToItem(item);

		if (!silent) ElMessage.success(`分段推演完成，共 ${segments.length} 段运输方式`);
	} catch (err) {
		console.error('[recalculateItemByDateRange] 错误:', err);
		ElMessage.error('分段计算失败');
	}
};

// ========== 算法映射工具 ==========
const mapAlgoToInt = (algo: string) => {
	switch (algo) {
		case 'daily_avg': return 1;
		case 'history': return 2;
		case 'trend': return 3;
		case 'combined': return 4;
		default: return 1;
	}
};

// ========== 综合走势α工具函数 ==========

/**
 * 将一个日期段按月拆分，返回每个月覆盖的天数
 * 例: "2026-05-08" ~ "2026-06-07" → [{month:"2026-05",days:24}, {month:"2026-06",days:7}]
 */
const getSegmentMonthBreakdown = (startDate: string, endDate: string) => {
	const result: { month: string; days: number }[] = [];
	let cur = dayjs(startDate);
	const end = dayjs(endDate);
	while (cur.isBefore(end) || cur.isSame(end, 'day')) {
		const monthEnd = cur.endOf('month').startOf('day');
		const segEnd = monthEnd.isBefore(end) ? monthEnd : end;
		const days = segEnd.diff(cur, 'day') + 1;
		result.push({ month: cur.format('YYYY-MM'), days });
		cur = segEnd.add(1, 'day');
	}
	return result;
};

/**
 * 按天数加权计算人工α初始值
 * @param monthBreakdown 月份拆分 [{month, days}]
 * @param monthlyCoefficients 后端返回的逐月系数详情
 * @returns { value: 加权α, details: 每月详情用于tooltip }
 */
const computeWeightedAlpha = (
	monthBreakdown: { month: string; days: number }[],
	monthlyCoefficients: Record<string, any> | null,
	alphaMode: 'system' | 'user' = 'system'
) => {
	if (!monthlyCoefficients || monthBreakdown.length === 0) {
		return { value: 0.7, details: [], totalDays: 0, alphaDays: 0 };
	}
	let totalDays = 0;
	let alphaDays = 0;
	let weightedSum = 0;
	const details: {
		month: string;
		days: number;
		alpha: number;
		displayAlpha: string;
		source: string;
		systemAlpha: number;
		userAlpha: any;
		reasonText: string;
		userRemark: string | null;
		isNoData: boolean;
	}[] = [];

	for (const { month, days } of monthBreakdown) {
		const mc = monthlyCoefficients[month];
		const sysAlpha = mc?.system_alpha ?? 0.7;
		const finalAlpha = mc?.alpha ?? 0.7;
		const userAlpha = mc?.user_alpha ?? null;
		const source = mc?.alpha_source || 'default';
		const useAlpha = alphaMode === 'system' ? sysAlpha : (userAlpha ?? sysAlpha);
		const isNoData = isCombinedNoData(mc);
		if (!isNoData) {
			weightedSum += days * useAlpha;
			alphaDays += days;
		}
		totalDays += days;
		const reasonText = mc?.alpha_reason_text || '';
		const userRemark = mc?.user_remark || null;
		details.push({
			month,
			days,
			alpha: useAlpha,
			displayAlpha: isNoData ? "日均" : formatCompactNumber(useAlpha, 2),
			source,
			systemAlpha: sysAlpha,
			userAlpha,
			reasonText,
			userRemark,
			isNoData
		});
	}

	const value = alphaDays > 0 ? Math.round((weightedSum / alphaDays) * 1000) / 1000 : 0.7;
	return { value, details, totalDays, alphaDays };
};

/**
 * α tooltip 预计算：一次性返回 tooltip 需要的所有数据，避免模板里重复调用
 */
const getAlphaTooltipData = (item: any, methodKey: string) => {
	const cr = item._calcResult?.[methodKey];
	if (!cr) return null;
	const mode = (cr._alphaMode || 'system') as 'system' | 'user';
	const breakdown = getSegmentMonthBreakdown(cr.startDate, cr.endDate);
	const weighted = computeWeightedAlpha(breakdown, cr.monthlyCoefficients, mode);
	const uniqueRemarks = [...new Set(weighted.details.map(d => d.userRemark).filter(Boolean))];
	const allNoData = weighted.details.length > 0 && weighted.details.every(d => d.isNoData);
	return {
		mode,
		modeLabel: mode === 'system' ? '系统' : '用户',
		nextModeLabel: mode === 'system' ? '用户' : '系统',
		details: weighted.details,
		value: weighted.value,
		valueText: allNoData ? "按日均，系数强制1" : formatCompactNumber(weighted.value, 3),
		displayText: allNoData ? "日均" : weighted.details.map(d => d.displayAlpha).join('|'),
		formulaText: allNoData
			? weighted.details.map(d => d.days + '×日均').join(' + ')
			: weighted.details.filter(d => !d.isNoData).map(d => d.days + '×' + d.displayAlpha).join(' + '),
		totalDays: allNoData ? weighted.totalDays : weighted.alphaDays,
		uniqueRemarks,
		hasUserAlpha: segmentHasUserAlpha(cr),
		allNoData,
	};
};

/**
 * 用新的人工α前端本地重算某个运输段的发货量（expectedDemand）
 * 三重round精度与后端完全一致
 * @param manualAlpha 人工α
 * @param monthBreakdown 月份拆分
 * @param monthlyCoefficients 后端返回的逐月系数详情
 * @param dailyAvgSales 日均销量
 * @returns 重算后的 expectedDemand
 */
const recalcSegmentWithAlpha = (
	manualAlpha: number,
	monthBreakdown: { month: string; days: number }[],
	monthlyCoefficients: Record<string, any> | null,
	dailyAvgSales: number,
	volatilityCoefficient = DEFAULT_VOLATILITY_COEFFICIENT
) => {
	if (!monthlyCoefficients || monthBreakdown.length === 0) return 0;
	let demand = 0;
	for (const { month, days } of monthBreakdown) {
		const mc = monthlyCoefficients[month];
		if (!mc) {
			// 无数据月份用系数1
			demand += Math.round(days * Math.round(dailyAvgSales * 100) / 100);
			continue;
		}
		// 用新α重算综合系数
		const coefficient = getCombinedCoefficient(mc, manualAlpha, volatilityCoefficient);
		// 三重round（与后端完全一致）
		const roundedCoeff = Math.round(coefficient * 100) / 100;
		const dailyNeed = Math.round(dailyAvgSales * roundedCoeff * 100) / 100;
		const subtotal = Math.round(days * dailyNeed);
		demand += subtotal;
	}
	return demand;
};

type PastInboundAdjustmentOptions = {
	adjustPastInboundToFirstArrival?: boolean;
	pastInboundEffectiveDate?: string;
	pastInboundMethodKey?: string;
	pastInboundMethodLabel?: string;
};

const getEffectiveInboundAmazonSaleDate = (
	shipping: any,
	options: PastInboundAdjustmentOptions = {}
) => {
	const originalAmazonSaleDate = shipping?.amazonSaleDate || "";
	const originalD = originalAmazonSaleDate ? dayjs(originalAmazonSaleDate).startOf("day") : null;
	const effectiveD = options.pastInboundEffectiveDate ? dayjs(options.pastInboundEffectiveDate).startOf("day") : null;
	const canAdjust = Boolean(
		options.adjustPastInboundToFirstArrival
		&& originalD
		&& originalD.isValid()
		&& originalD.isBefore(dayjs().startOf("day"), "day")
		&& effectiveD
		&& effectiveD.isValid()
	);
	const effectiveAmazonSaleDate = canAdjust
		? effectiveD!.format("YYYY-MM-DD")
		: originalD?.isValid()
			? originalD.format("YYYY-MM-DD")
			: originalAmazonSaleDate;

	return {
		effectiveAmazonSaleDate,
		originalAmazonSaleDate,
		adjustedAmazonSaleDate: canAdjust ? effectiveAmazonSaleDate : "",
		arrivalAdjusted: canAdjust,
		arrivalAdjustReason: canAdjust ? "past_inbound_to_first_arrival" : "",
		arrivalAdjustMethodKey: canAdjust ? (options.pastInboundMethodKey || "") : "",
		arrivalAdjustMethodLabel: canAdjust ? (options.pastInboundMethodLabel || "") : ""
	};
};

const buildEffectiveInboundRow = (shipping: any, options: PastInboundAdjustmentOptions = {}) => {
	const info = getEffectiveInboundAmazonSaleDate(shipping, options);
	return {
		...shipping,
		amazonSaleDate: info.effectiveAmazonSaleDate || shipping?.amazonSaleDate || "",
		effectiveAmazonSaleDate: info.effectiveAmazonSaleDate,
		originalAmazonSaleDate: info.originalAmazonSaleDate,
		adjustedAmazonSaleDate: info.adjustedAmazonSaleDate,
		arrivalAdjusted: info.arrivalAdjusted,
		arrivalAdjustReason: info.arrivalAdjustReason,
		arrivalAdjustMethodKey: info.arrivalAdjustMethodKey,
		arrivalAdjustMethodLabel: info.arrivalAdjustMethodLabel
	};
};

/**
 * 100%复刻后端 batchCalculateGap 的逐日库存扣减模拟
 * 前端改α后用此函数重算gap，精度与后端完全一致
 */
const recalcSegmentGapWithAlpha = (
	alpha: number,
	startDate: string,
	endDate: string,
	monthlyCoefficients: Record<string, any> | null,
	dailyAvgSales: number,
	fbaValid: number,
	fbaShippingList: any[],
	volatilityCoefficient = DEFAULT_VOLATILITY_COEFFICIENT,
	options: { preArrivalShortage?: any } & PastInboundAdjustmentOptions = {}
): {
	gap: number;
	expectedDemand: number;
	shortageStartDate: string | null;
	shortageEndDate: string | null;
	shortageDays: number;
	shortageDemand: number;
	shortageRanges: Array<{
		startDate: string;
		endDate: string;
		days: number;
		quantity: number;
		details: Array<{ date: string; dailyNeed: number; inboundQuantity: number; stockBeforeDemand: number; shortage: number }>;
	}>;
	inventoryUsage: any;
	preArrivalShortage: any;
} => {
	if (!monthlyCoefficients || !startDate || !endDate) {
		return {
			gap: 0,
			expectedDemand: 0,
			shortageStartDate: null,
			shortageEndDate: null,
			shortageDays: 0,
			shortageDemand: 0,
			shortageRanges: [],
			inventoryUsage: null,
			preArrivalShortage: null
		};
	}

	const startD = dayjs(startDate).startOf('day');
	const endD = dayjs(endDate).startOf('day');
	let currentStock = fbaValid;
	let totalGap = 0;
	let shortageStartDate: string | null = null;
	let shortageEndDate: string | null = null;
	let shortageDays = 0;
	const sourcePreArrival = options.preArrivalShortage;
	const preArrivalStartD = sourcePreArrival?.startDate ? dayjs(sourcePreArrival.startDate).startOf('day') : null;
	const preArrivalArrivalD = sourcePreArrival?.fastestArrivalDate ? dayjs(sourcePreArrival.fastestArrivalDate).startOf('day') : null;
	const defaultPreArrivalEndD = preArrivalArrivalD ? preArrivalArrivalD.subtract(1, 'day').startOf('day') : null;
	const sourcePreArrivalEndD = sourcePreArrival?.endDate ? dayjs(sourcePreArrival.endDate).startOf('day') : null;
	const preArrivalEndD = sourcePreArrivalEndD?.isValid()
		&& defaultPreArrivalEndD
		&& sourcePreArrivalEndD.isBefore(defaultPreArrivalEndD, 'day')
		? sourcePreArrivalEndD
		: defaultPreArrivalEndD;
	const shouldTrackPreArrivalShortage = Boolean(
		sourcePreArrival
		&& preArrivalStartD?.isValid()
		&& preArrivalArrivalD?.isValid()
		&& preArrivalStartD.isBefore(preArrivalArrivalD, 'day')
	);
	let preArrivalTotal = 0;
	let preArrivalShortageStartDate: string | null = null;
	let preArrivalShortageEndDate: string | null = null;
	let preArrivalShortageDays = 0;
	let preArrivalLastCoveredDate: string | null = null;
	const preArrivalDetails: Array<{ date: string; dailyNeed: number; inboundQuantity: number; stockBeforeDemand: number; shortage: number }> = [];
	const usageLots: any[] = [];
	const usageSourceMap = new Map<string, any>();
	const segmentOpeningMap = new Map<string, number>();
	let segmentOpeningCaptured = false;
	let segmentOpeningFba = 0;
	let segmentOpeningInbound = 0;
	let arrivalsInSegmentForUsage = 0;
	if (currentStock > 0) {
		usageLots.push({
			sourceKey: 'fba',
			sourceType: 'fba',
			sourceName: 'FBA库存',
			originalQuantity: currentStock,
			remainingQuantity: currentStock
		});
	}
	const pushUsageSource = (lot: any, usedQuantity: number, arrivedInSegment = false) => {
		if (usedQuantity <= 0 && !arrivedInSegment) return;
		const existed = usageSourceMap.get(lot.sourceKey);
		if (existed) {
			existed.usedQuantity += usedQuantity;
			existed.remainingAfterSegment = lot.remainingQuantity;
			existed.arrivedInSegment = existed.arrivedInSegment || arrivedInSegment;
			existed.openingQuantity = segmentOpeningMap.get(lot.sourceKey) || existed.openingQuantity || 0;
			return;
		}
		usageSourceMap.set(lot.sourceKey, {
			sourceKey: lot.sourceKey,
			sourceType: lot.sourceType,
			sourceName: lot.sourceName,
			orderSn: lot.orderSn,
			shippingOrderSn: lot.shippingOrderSn,
			shippingMethod: lot.shippingMethod,
			logisticsChannelName: lot.logisticsChannelName,
			amazonSaleDate: lot.amazonSaleDate,
			originalAmazonSaleDate: lot.originalAmazonSaleDate,
			adjustedAmazonSaleDate: lot.adjustedAmazonSaleDate,
			arrivalAdjusted: lot.arrivalAdjusted,
			arrivalAdjustReason: lot.arrivalAdjustReason,
			arrivalAdjustMethodKey: lot.arrivalAdjustMethodKey,
			arrivalAdjustMethodLabel: lot.arrivalAdjustMethodLabel,
			originalQuantity: lot.originalQuantity,
			usedQuantity,
			remainingAfterSegment: lot.remainingQuantity,
			arrivedInSegment,
			openingQuantity: segmentOpeningMap.get(lot.sourceKey) || 0
		});
	};
	const captureSegmentOpening = () => {
		if (segmentOpeningCaptured) return;
		segmentOpeningCaptured = true;
		for (const lot of usageLots) {
			const remaining = Math.max(0, Math.round(lot.remainingQuantity * 100) / 100);
			if (remaining <= 0) continue;
			segmentOpeningMap.set(lot.sourceKey, remaining);
			if (lot.sourceType === 'fba') {
				segmentOpeningFba += remaining;
			} else {
				segmentOpeningInbound += remaining;
			}
		}
	};
	const consumeUsageLots = (dailyNeed: number, shouldRecord: boolean) => {
		let remainNeed = dailyNeed;
		for (const lot of usageLots) {
			if (remainNeed <= 0) break;
			if (lot.remainingQuantity <= 0) continue;
			const used = Math.min(lot.remainingQuantity, remainNeed);
			lot.remainingQuantity = Math.max(0, Math.round((lot.remainingQuantity - used) * 100) / 100);
			remainNeed = Math.max(0, Math.round((remainNeed - used) * 100) / 100);
			if (shouldRecord) pushUsageSource(lot, used);
		}
	};
	const shortageRanges: Array<{
		startDate: string;
		endDate: string;
		days: number;
		quantity: number;
		details: Array<{ date: string; dailyNeed: number; inboundQuantity: number; stockBeforeDemand: number; shortage: number }>;
	}> = [];

	// expectedDemand 用月段subtotal口径（与后端一致）
	let expectedDemand = 0;
	{
		let segStart = startD;
		while (segStart.isBefore(endD) || segStart.isSame(endD, 'day')) {
			const segMonthEnd = segStart.endOf('month').startOf('day');
			const segEnd = segMonthEnd.isBefore(endD) ? segMonthEnd : endD;
			const segDays = segEnd.diff(segStart, 'day') + 1;
			const segMonthStr = segStart.format('YYYY-MM');
			const mc = monthlyCoefficients[segMonthStr];
			let coefficient = 1;
			if (mc) {
				coefficient = getCombinedCoefficient(mc, alpha, volatilityCoefficient);
			}
			const roundedCoeff = Math.round(coefficient * 100) / 100;
			const dailyNeed = Math.round(dailyAvgSales * roundedCoeff * 100) / 100;
			expectedDemand += Math.round(segDays * dailyNeed);
			segStart = segEnd.add(1, 'day');
		}
	}

	// gap 用逐日模拟（与后端一致）
	let checkDate = dayjs().startOf('day');
	if (startD.isBefore(checkDate)) checkDate = startD;
	if (shouldTrackPreArrivalShortage && preArrivalStartD && preArrivalStartD.isBefore(checkDate, 'day')) {
		checkDate = preArrivalStartD;
	}
	const simulationEndD = shouldTrackPreArrivalShortage && preArrivalEndD && preArrivalEndD.isAfter(endD, 'day')
		? preArrivalEndD
		: endD;

	while (checkDate.isBefore(simulationEndD) || checkDate.isSame(simulationEndD, 'day')) {
		const checkDateStr = checkDate.format('YYYY-MM-DD');
		const checkMonthStr = checkDate.format('YYYY-MM');
		const inRange = (checkDate.isAfter(startD) || checkDate.isSame(startD, 'day'))
			&& (checkDate.isBefore(endD) || checkDate.isSame(endD, 'day'));
		const inPreArrivalRange = Boolean(
			shouldTrackPreArrivalShortage
			&& preArrivalStartD
			&& preArrivalEndD
			&& (checkDate.isAfter(preArrivalStartD) || checkDate.isSame(preArrivalStartD, 'day'))
			&& (checkDate.isBefore(preArrivalEndD) || checkDate.isSame(preArrivalEndD, 'day'))
		);
		if (checkDate.isSame(startD, 'day')) captureSegmentOpening();

		// 1. 货件入库
		let inboundQuantity = 0;
		if (Array.isArray(fbaShippingList)) {
			for (let shippingIndex = 0; shippingIndex < fbaShippingList.length; shippingIndex++) {
				const shipping = fbaShippingList[shippingIndex];
				const inboundDateInfo = getEffectiveInboundAmazonSaleDate(shipping, options);
				if (inboundDateInfo.effectiveAmazonSaleDate === checkDateStr) {
					const qty = Number(shipping.quantity) || 0;
					currentStock += qty;
					inboundQuantity += qty;
					if (qty > 0) {
						if (inRange) arrivalsInSegmentForUsage += qty;
						const usageLot = {
							sourceKey: `inbound:${shipping.orderSn || shipping.shippingOrderSn || checkDateStr}:${shippingIndex}`,
							sourceType: 'inbound',
							sourceName: '在途货件',
							orderSn: shipping.orderSn || '',
							shippingOrderSn: shipping.shippingOrderSn || '',
							shippingMethod: shipping.shippingMethod || '',
							logisticsChannelName: shipping.logisticsChannelName || '',
							amazonSaleDate: inboundDateInfo.effectiveAmazonSaleDate || '',
							originalAmazonSaleDate: inboundDateInfo.originalAmazonSaleDate || '',
							adjustedAmazonSaleDate: inboundDateInfo.adjustedAmazonSaleDate || '',
							arrivalAdjusted: inboundDateInfo.arrivalAdjusted,
							arrivalAdjustReason: inboundDateInfo.arrivalAdjustReason,
							arrivalAdjustMethodKey: inboundDateInfo.arrivalAdjustMethodKey,
							arrivalAdjustMethodLabel: inboundDateInfo.arrivalAdjustMethodLabel,
							originalQuantity: qty,
							remainingQuantity: qty
						};
						usageLots.push(usageLot);
						if (inRange) pushUsageSource(usageLot, 0, true);
					}
				}
			}
		}

		// 2. 用新α算综合系数
		const mc = monthlyCoefficients[checkMonthStr];
		let coefficient = 1;
		if (mc) {
			coefficient = getCombinedCoefficient(mc, alpha, volatilityCoefficient);
		}

		// 3. 三重round（与后端完全一致）
		const roundedCoeff = Math.round(coefficient * 100) / 100;
		const dailyNeed = Math.round(dailyAvgSales * roundedCoeff * 100) / 100;

		// 4. 只有进入选定的时间范围才扣减gap
		const stockBeforeDemand = currentStock;
		consumeUsageLots(dailyNeed, inRange);

		currentStock -= dailyNeed;
		if (currentStock < 0) {
			if (inRange) {
				const dayShortage = Math.abs(currentStock);
				const shortageDetail = {
					date: checkDateStr,
					dailyNeed,
					inboundQuantity,
					stockBeforeDemand,
					shortage: dayShortage
				};
				totalGap += dayShortage;
				shortageDays += 1;
				if (!shortageStartDate) shortageStartDate = checkDateStr;
				shortageEndDate = checkDateStr;

				const lastRange = shortageRanges[shortageRanges.length - 1];
				const isContinuous = lastRange && dayjs(lastRange.endDate).add(1, 'day').format('YYYY-MM-DD') === checkDateStr;
				if (isContinuous) {
					lastRange.endDate = checkDateStr;
					lastRange.days += 1;
					lastRange.quantity += dayShortage;
					lastRange.details.push(shortageDetail);
				} else {
					shortageRanges.push({
						startDate: checkDateStr,
						endDate: checkDateStr,
						days: 1,
						quantity: dayShortage,
						details: [shortageDetail]
					});
				}
			}
			if (!inRange && inPreArrivalRange) {
				const dayShortage = Math.abs(currentStock);
				preArrivalTotal += dayShortage;
				preArrivalShortageDays += 1;
				if (!preArrivalShortageStartDate) preArrivalShortageStartDate = checkDateStr;
				preArrivalShortageEndDate = checkDateStr;
				preArrivalDetails.push({
					date: checkDateStr,
					dailyNeed,
					inboundQuantity,
					stockBeforeDemand,
					shortage: dayShortage
				});
			}
			currentStock = 0;
		} else if (!inRange && inPreArrivalRange && preArrivalShortageDays === 0) {
			preArrivalLastCoveredDate = checkDateStr;
		}

		checkDate = checkDate.add(1, 'day');
	}

	const usageSources = Array.from(usageSourceMap.values())
		.filter(source => source.usedQuantity > 0 || source.arrivedInSegment)
		.map(source => ({
			sourceType: source.sourceType,
			sourceName: source.sourceName,
			orderSn: source.orderSn || '',
			shippingOrderSn: source.shippingOrderSn || '',
			shippingMethod: source.shippingMethod || '',
			logisticsChannelName: source.logisticsChannelName || '',
			amazonSaleDate: source.amazonSaleDate || '',
			originalAmazonSaleDate: source.originalAmazonSaleDate || '',
			adjustedAmazonSaleDate: source.adjustedAmazonSaleDate || '',
			arrivalAdjusted: Boolean(source.arrivalAdjusted),
			arrivalAdjustReason: source.arrivalAdjustReason || '',
			arrivalAdjustMethodKey: source.arrivalAdjustMethodKey || '',
			arrivalAdjustMethodLabel: source.arrivalAdjustMethodLabel || '',
			originalQuantity: Math.round(source.originalQuantity),
			openingQuantity: Math.round(source.openingQuantity || 0),
			usedQuantity: Math.round(source.usedQuantity),
			remainingAfterSegment: Math.max(0, Math.round(source.remainingAfterSegment)),
			arrivedInSegment: Boolean(source.arrivedInSegment),
			arrivalRelation: source.sourceType === 'fba'
				? 'initial'
				: source.arrivedInSegment
					? 'in_segment'
					: 'before_segment',
			arrivalRelationText: source.sourceType === 'fba'
				? '初始库存'
				: source.arrivalAdjusted
					? `过期预计可售并入${source.arrivalAdjustMethodLabel || '首个运输'}段`
					: source.arrivedInSegment
					? '本段到货'
					: '段前到货'
		}));
	const usedFromFba = usageSources
		.filter(source => source.sourceType === 'fba')
		.reduce((sum, source) => sum + source.usedQuantity, 0);
	const usedFromInbound = usageSources
		.filter(source => source.sourceType === 'inbound')
		.reduce((sum, source) => sum + source.usedQuantity, 0);

	return {
		gap: Math.round(totalGap),
		expectedDemand,
		shortageStartDate,
		shortageEndDate,
		shortageDays,
		shortageDemand: Math.round(totalGap),
		shortageRanges: shortageRanges.map(range => ({
			...range,
			quantity: Math.round(range.quantity),
			details: range.details.map(detail => ({
				...detail,
				dailyNeed: Math.round(detail.dailyNeed * 100) / 100,
				inboundQuantity: Math.round(detail.inboundQuantity),
				stockBeforeDemand: Math.round(detail.stockBeforeDemand * 100) / 100,
				shortage: Math.round(detail.shortage)
			}))
		})),
		inventoryUsage: {
			segmentStartDate: startDate,
			segmentEndDate: endDate,
			segmentDemand: expectedDemand,
			openingFba: Math.round(segmentOpeningFba),
			openingInbound: Math.round(segmentOpeningInbound),
			openingAvailable: Math.round(segmentOpeningFba + segmentOpeningInbound),
			covered: Math.round(usedFromFba + usedFromInbound),
			shortage: Math.round(totalGap),
			arrivalsInSegment: Math.round(arrivalsInSegmentForUsage),
			usedFromFba,
			usedFromInbound,
			sources: usageSources
		},
		preArrivalShortage: shouldTrackPreArrivalShortage && preArrivalStartD && preArrivalEndD && preArrivalArrivalD
			? {
				...sourcePreArrival,
				startDate: preArrivalStartD.format('YYYY-MM-DD'),
				endDate: preArrivalEndD.format('YYYY-MM-DD'),
				fastestArrivalDate: preArrivalArrivalD.format('YYYY-MM-DD'),
				total: Math.round(preArrivalTotal),
				shortageStartDate: preArrivalShortageStartDate,
				shortageEndDate: preArrivalShortageEndDate,
				shortageDays: preArrivalShortageDays,
				lastCoveredDate: preArrivalLastCoveredDate,
				details: preArrivalDetails.map(detail => ({
					...detail,
					dailyNeed: Math.round(detail.dailyNeed * 100) / 100,
					inboundQuantity: Math.round(detail.inboundQuantity),
					stockBeforeDemand: Math.round(detail.stockBeforeDemand * 100) / 100,
					shortage: Math.round(detail.shortage * 100) / 100
				}))
			}
			: null
	};
};

/**
 * α来源中文映射
 */
const alphaSourceLabel = (source: string) => {
	const map: Record<string, string> = {
		'user_monthly': '用户逐月配置',
		'user_default': '用户默认配置',
		'frontend_monthly': '前端逐月覆盖',
		'frontend_override': '前端全局覆盖',
		'system': '系统自动',
		'no_data': '无数据',
		'no_sales': '无销量数据',
		'no_search': '无搜索数据',
		'default': '系统默认'
	};
	return map[source] || source;
};

const computeShippingDateRanges = () => {
	const today = dayjs().startOf('day');
	const selected = globalSelectedShippingMethods.value;
	if (selected.length === 0) return [];

	// 获取所有选中的运输方式，按天数动态排序
	const methods = selected
		.map(key => shippingMethods.find(m => m.key === key)!)
		.filter(Boolean)
		.sort((a, b) => a.days - b.days);

	const ranges: { key: string; startDate: string; endDate: string | null; days: number }[] = [];

	for (let i = 0; i < methods.length; i++) {
		const current = methods[i];
		const nextSelected = methods[i + 1];
		const startDate = today.add(current.days + shippingBuffer.value, 'day').format('YYYY-MM-DD');

		if (nextSelected) {
			// 不是最后一个：结束日 = 下一个已选中方式的到达日 - 1天（不重叠）
			const endDate = today.add(nextSelected.days + shippingBuffer.value, 'day').subtract(1, 'day').format('YYYY-MM-DD');
			const d = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
			ranges.push({ key: current.key, startDate, endDate, days: d });
		} else {
			// 最后一个：永远需要用户手动选择结束日期
			ranges.push({ key: current.key, startDate, endDate: null, days: 0 });
		}
	}

	return ranges;
};

const getItemFirstActiveArrivalInfo = (item: any) => {
	const inactive = new Set(item?.inactiveMethods || []);
	const arrival = computedArrivalDates.value.find(a => !inactive.has(a.key));
	if (!arrival) return null;
	const method = shippingMethods.find(m => m.key === arrival.key);
	return {
		key: arrival.key,
		arrivalDate: arrival.arrivalDate,
		label: method?.label || arrival.key
	};
};

const getPastInboundAdjustmentOptions = (item: any): PastInboundAdjustmentOptions => {
	const arrival = getItemFirstActiveArrivalInfo(item);
	if (!arrival) {
		return { adjustPastInboundToFirstArrival: false };
	}
	return {
		adjustPastInboundToFirstArrival: true,
		pastInboundEffectiveDate: arrival.arrivalDate,
		pastInboundMethodKey: arrival.key,
		pastInboundMethodLabel: arrival.label
	};
};

const getItemPreArrivalRequestFields = (item: any): Record<string, any> => {
	const arrival = getItemFirstActiveArrivalInfo(item);
	if (!arrival) return {};
	const cycleEnd = item?.replenishDateRange?.[1] || globalDateRange.value?.[1] || "";
	const arrivalEnd = dayjs(arrival.arrivalDate).subtract(1, 'day').startOf('day');
	const cycleEndD = cycleEnd ? dayjs(cycleEnd).startOf('day') : null;
	const preArrivalEndDate = cycleEndD?.isValid() && cycleEndD.isBefore(arrivalEnd, 'day')
		? cycleEndD.format('YYYY-MM-DD')
		: arrivalEnd.format('YYYY-MM-DD');
	return {
		preArrivalDate: arrival.arrivalDate,
		preArrivalEndDate,
		preArrivalMethodKey: arrival.key,
		preArrivalMethodLabel: arrival.label,
		pastInboundEffectiveDate: arrival.arrivalDate,
		pastInboundMethodKey: arrival.key,
		pastInboundMethodLabel: arrival.label
	};
};

const getMaxPreArrivalEndDate = (items: any[]) => {
	const dates = items
		.map(item => getItemPreArrivalRequestFields(item).preArrivalEndDate)
		.filter(Boolean)
		.sort() as string[];
	if (dates.length === 0) return "";
	return dates[dates.length - 1];
};

const movePreArrivalShortageToFirstActiveMethod = (item: any) => {
	const arrival = getItemFirstActiveArrivalInfo(item);
	if (!arrival || !item?._calcResult) return;
	const sourceKey = Object.keys(item._calcResult).find(key => item._calcResult[key]?.preArrivalShortage);
	if (!sourceKey || !item._calcResult[arrival.key]) return;
	item._calcResult[arrival.key].preArrivalShortage = {
		...item._calcResult[sourceKey].preArrivalShortage,
		fastestArrivalMethodKey: arrival.key,
		fastestArrivalMethodLabel: arrival.label
	};
	if (sourceKey !== arrival.key) {
		item._calcResult[sourceKey].preArrivalShortage = null;
	}
};

const buildPreArrivalShortageParams = (segmentIndex: number, items: any[]) => {
	const preArrivalEndDate = getMaxPreArrivalEndDate(items);
	return segmentIndex === 0
		? {
			includePreArrivalShortage: true,
			cycleStartDate: dayjs().startOf('day').format('YYYY-MM-DD'),
			...(preArrivalEndDate ? { preArrivalEndDate } : {})
		}
		: {};
};

// ========== 核心：批量计算补货缺口 ==========
const isCalculating = ref(false);

const calculateReplenishment = async (itemsToCalc?: any[], silent = false) => {
	if (deferCalculationIfPurchasePlanSyncing()) return;
	const items = itemsToCalc || props.items;
	if (items.length === 0) return;

	const selected = globalSelectedShippingMethods.value;
	if (selected.length === 0) {
		if (!silent) ElMessage.warning('请至少选择1种运输方式');
		return;
	}

	// 推导日期段
	const ranges = computeShippingDateRanges();
	// 找到最后一个（endDate 为 null），用 globalDateRange 填充
	const lastRange = ranges.find(r => r.endDate === null);

	if (lastRange) {
		if (!globalDateRange.value || globalDateRange.value.length < 2) {
			const method = shippingMethods.find(m => m.key === lastRange.key);
			if (!silent) ElMessage.warning(`请先在日历上为 ${method?.icon || ''} ${method?.label || '最后一个运输方式'} 选择结束日期`);
			return;
		}
		// 用用户选择的结束日填充最后一个方式的范围
		lastRange.endDate = globalDateRange.value[1];
		lastRange.days = dayjs(lastRange.endDate).diff(dayjs(lastRange.startDate), 'day') + 1;
	}

	// 现在所有段都应该有 endDate
	const rangesToCalc = ranges.filter(r => r.endDate !== null) as { key: string; startDate: string; endDate: string; days: number }[];
	if (rangesToCalc.length === 0) {
		if (!silent) ElMessage.warning('没有可计算的日期段');
		return;
	}

	const loading = silent
		? null
		: ElLoading.service({
			lock: true,
			text: '正在进行引擎推演...',
			background: 'rgba(0, 0, 0, 0.7)'
		});
	isCalculating.value = true;

	try {
		// 准备请求体
		const payloadItems = items.map((item, index) => {
			if (!item._batchId) item._batchId = `batch_${index}_${Date.now()}`;
			return {
				id: item._batchId,
				product_code: item.product_code || '',
				asin: item.asin || '',
				marketplace: item.marketplace || '',
				dailyAvgSales: getCalcDailyAvgSales(item),
				volatility_coefficient: getItemVolatilityCoefficient(item),
				fbaValid: getFbaInventoryQuantity(item),
				fbaShippingList: filterByRowMsku(item.restocking?.fbaShippingList, item),
				alpha: undefined,
				listing_id: item.id,
				msku: item.msku || '',
				store_id: item.store_id,
				...getItemPreArrivalRequestFields(item)
			};
		});

		const algorithm = mapAlgoToInt(globalAlgo.value);
		const coefficientRange = getDialogCalendarMonthRange();

		// 并行调用每个日期段的接口
		const results = await Promise.all(
			rangesToCalc.map((range, index) =>
				(service.app as any).bsr_purchase_order_sync_lingxing
					.batchCalculateGap({
						algorithm,
						startDate: range.startDate,
						endDate: range.endDate,
						alpha: undefined,
						coefficientStartMonth: coefficientRange.startMonth,
						coefficientEndMonth: coefficientRange.endMonth,
						includeInventoryUsage: true,
						adjustPastInboundToFirstArrival: true,
						...buildPreArrivalShortageParams(index, items),
						items: payloadItems
					})
					.then((res: any[]) => ({ key: range.key, days: range.days, startDate: range.startDate, endDate: range.endDate, results: res }))
					.catch((err: any) => {
						console.error(`[calculateReplenishment] ${range.key} 计算失败:`, err);
						return { key: range.key, days: range.days, startDate: range.startDate, endDate: range.endDate, results: [] };
					})
			)
		);

		// 将结果映射回每个 item
		items.forEach(item => {
			if (!item._calcResult) item._calcResult = {};
			if (!item.shippingQuantities) item.shippingQuantities = {};

			for (const segment of results) {
				// 在此 segment 的返回结果中找到本产品
				const match = segment.results.find((r: any) => String(r.id) === String(item._batchId));
				if (match && !match.warning) {
					item._calcResult[segment.key] = buildCalcResultFromMatch(match, segment, { _manualAlpha: undefined });
					// 自动填写发货数
					setShippingQuantityFromSystem(item, segment.key, match.gap);
				} else {
					item._calcResult[segment.key] = buildEmptyCalcResult(segment, match?.warning || '计算失败');
					item.shippingQuantities[segment.key] = 0;
				}
			}
			movePreArrivalShortageToFirstActiveMethod(item);
			applyPurchasePlanDeductionToItem(item);
		});

		if (!silent) ElMessage.success(`推演完成，共计算 ${items.length} 个产品 × ${rangesToCalc.length} 段运输方式`);
	} catch (err) {
		console.error('[calculateReplenishment] 全局错误:', err);
		if (!silent) ElMessage.error('计算失败，请重试');
	} finally {
		loading?.close();
		isCalculating.value = false;
	}
};

// ========== 单条重新计算（用于明细修改算法后即时重算） ==========
const recalculateSingleItem = async (item: any, silent = false) => {
	if (deferCalculationIfPurchasePlanSyncing()) return;
	const ranges = computeShippingDateRanges();
	const lastRange = ranges.find(r => r.endDate === null);
	if (lastRange) {
		if (!globalDateRange.value || globalDateRange.value.length < 2) return;
		lastRange.endDate = globalDateRange.value[1];
		lastRange.days = dayjs(lastRange.endDate).diff(dayjs(lastRange.startDate), 'day') + 1;
	}
	const rangesToCalc = ranges.filter(r => r.endDate !== null) as { key: string; startDate: string; endDate: string; days: number }[];
	if (rangesToCalc.length === 0) return;

	if (!item._batchId) item._batchId = `batch_single_${Date.now()}`;
	const payloadItem = {
		id: item._batchId,
		product_code: item.product_code || '',
		asin: item.asin || '',
		marketplace: item.marketplace || '',
		dailyAvgSales: getCalcDailyAvgSales(item),
		volatility_coefficient: getItemVolatilityCoefficient(item),
		fbaValid: getFbaInventoryQuantity(item),
		fbaShippingList: filterByRowMsku(item.restocking?.fbaShippingList, item),
		listing_id: item.id,
		msku: item.msku || '',
		store_id: item.store_id,
		...getItemPreArrivalRequestFields(item)
	};

	// 用单条自己的算法，而不是全局算法
	const algorithm = mapAlgoToInt(item.replenishAlgo || globalAlgo.value);

	try {
		const coefficientRange = getDialogCalendarMonthRange();
		const results = await Promise.all(
			rangesToCalc.map((range, index) =>
				(service.app as any).bsr_purchase_order_sync_lingxing
					.batchCalculateGap({
						algorithm,
						startDate: range.startDate,
						endDate: range.endDate,
						alpha: undefined,
						coefficientStartMonth: coefficientRange.startMonth,
						coefficientEndMonth: coefficientRange.endMonth,
						includeInventoryUsage: true,
						adjustPastInboundToFirstArrival: true,
						...buildPreArrivalShortageParams(index, [item]),
						items: [payloadItem]
					})
					.then((res: any[]) => ({ key: range.key, days: range.days, startDate: range.startDate, endDate: range.endDate, results: res }))
					.catch((err: any) => {
						console.error(`[recalculateSingleItem] ${range.key} 计算失败:`, err);
						return { key: range.key, days: range.days, startDate: range.startDate, endDate: range.endDate, results: [] };
					})
			)
		);

		item._calcResult = {};
		if (!item.shippingQuantities) item.shippingQuantities = {};

		for (const segment of results) {
			const match = segment.results.find((r: any) => String(r.id) === String(item._batchId));
			if (match && !match.warning) {
				item._calcResult[segment.key] = buildCalcResultFromMatch(match, segment, { _manualAlpha: undefined });
				setShippingQuantityFromSystem(item, segment.key, match.gap);
			} else {
				item._calcResult[segment.key] = buildEmptyCalcResult(segment, match?.warning || '计算失败');
				item.shippingQuantities[segment.key] = 0;
			}
		}
		movePreArrivalShortageToFirstActiveMethod(item);
		applyPurchasePlanDeductionToItem(item);
		if (!silent) ElMessage.success('单条重新推演完成');
	} catch (err) {
		console.error('[recalculateSingleItem] 错误:', err);
		ElMessage.error('单条计算失败');
	}
};

const onItemAlgoChange = (item: any) => {
	if (!hasGlobalCalcData.value) return;
	// 如果明细有自己的日期范围，用分段重算；否则用全局日期重算
	if (item.replenishDateRange && item.replenishDateRange.length === 2 && item.replenishDateRange[0] && item.replenishDateRange[1]) {
		recalculateItemByDateRange(item, item.replenishDateRange[0], item.replenishDateRange[1]);
	} else {
		recalculateSingleItem(item);
	}
};

const onCalcDailyAvgChange = (item: any, value: any) => {
	const next = Number(value);
	item._calcDailyAvgSales = Number.isFinite(next) && next >= 0
		? Number(next.toFixed(2))
		: getDailyAvgSales(item);

	if (!hasGlobalCalcData.value) return;
	if (item.replenishDateRange && item.replenishDateRange.length === 2 && item.replenishDateRange[0] && item.replenishDateRange[1]) {
		void recalculateItemByDateRange(item, item.replenishDateRange[0], item.replenishDateRange[1], true);
	} else {
		void recalculateSingleItem(item, true);
	}
};

// Bug3: 单行 alpha 变更后触发重算


// ========== 从 _calcResult 读取指标 ==========
const getItemDailyConsumption = (item: any) => {
	// 直接用产品的日均销量，不受运输方式勾选影响
	return getCalcDailyAvgSales(item);
};

const getItemTotalDemand = (item: any) => {
	const effective = getEffectiveCalcResult(item);
	let total = 0;
	for (const key of sortedSelectedMethods.value) {
		if (!item.inactiveMethods?.includes(key)) {
			total += effective[key].expectedDemand || 0;
		}
	}
	return Math.round(total);
};

const getItemCycleEndDate = (item: any) => {
	const dates = sortedSelectedMethods.value
		.map(key => item._calcResult?.[key]?.endDate)
		.filter(Boolean)
		.sort();
	if (dates.length > 0) return dates[dates.length - 1];
	if (item.replenishDateRange?.[1]) return item.replenishDateRange[1];
	return globalDateRange.value?.[1] || '';
};

const getCombinedMonthFormulaCalc = (item: any, month: string) => {
	for (const key of sortedSelectedMethods.value) {
		if (item.inactiveMethods?.includes(key)) continue;
		const cr = item._calcResult?.[key];
		const mc = cr?.monthlyCoefficients?.[month];
		if (!mc) continue;
		const manualAlpha = cr._manualAlpha;
		const mode = cr._alphaMode || 'system';
		const alpha = manualAlpha ?? (mode === 'user' ? (mc.user_alpha ?? mc.system_alpha ?? 0.7) : (mc.system_alpha ?? 0.7));
		const salesCoeff = Number(mc.filled_sales_coefficient) || 0;
		const searchCoeff = Number(mc.keyword_coefficient) || 0;
		const rawCoefficient = getRawCombinedCoefficient(mc, alpha);
		const coefficient = applyItemVolatilityCoefficient(item, rawCoefficient);
		return {
			alpha,
			salesCoeff,
			searchCoeff,
			rawCoefficient,
			volatilityCoefficient: getItemVolatilityCoefficient(item),
			coefficient,
			fallbackReason: isCombinedNoData(mc) ? "销量/搜索均无可用数据，按日均计算" : null,
			isNoDataAlpha: isCombinedNoData(mc)
		};
	}

	const alpha = 0.7;
	const coeffInfo = getItemMonthCoefficient(item, month, 4, alpha);
	return {
		alpha,
		salesCoeff: null,
		searchCoeff: null,
		rawCoefficient: coeffInfo.rawCoefficient,
		volatilityCoefficient: coeffInfo.volatilityCoefficient,
		coefficient: coeffInfo.coefficient,
		fallbackReason: coeffInfo.fallbackReason
	};
};

const getCombinedCycleDemandRows = (item: any) => {
	const endDate = getItemCycleEndDate(item);
	if (!endDate) return [];
	const start = dayjs().startOf('day');
	const end = dayjs(endDate).startOf('day');
	if (!end.isValid() || end.isBefore(start)) return [];

	const dailyAvg = getCalcDailyAvgSales(item);
	return getSegmentMonthDateChunks(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')).map(chunk => {
		const calc = getCombinedMonthFormulaCalc(item, chunk.month);
		const roundedCoeff = Math.round(calc.coefficient * 100) / 100;
		const dailyNeed = Math.round(dailyAvg * roundedCoeff * 100) / 100;
		const subtotal = Math.round(chunk.days * dailyNeed);
		return {
			...chunk,
			...calc,
			raw_coefficient: calc.rawCoefficient,
			volatility_coefficient: calc.volatilityCoefficient,
			adjusted_coefficient: roundedCoeff,
			coefficient: roundedCoeff,
			dailyNeed,
			subtotal
		};
	});
};

const getCombinedCycleDemandTotal = (item: any) => {
	return getCombinedCycleDemandRows(item).reduce((sum, row) => sum + row.subtotal, 0);
};

const getCombinedCycleInbound = (item: any) => {
	const endDate = getItemCycleEndDate(item);
	if (!endDate) return { total: 0, list: [] as any[] };
	const start = dayjs().startOf('day');
	const end = dayjs(endDate).startOf('day');
	if (!end.isValid() || end.isBefore(start)) return { total: 0, list: [] as any[] };
	const adjustment = getPastInboundAdjustmentOptions(item);
	const list = filterByRowMsku(item.restocking?.fbaShippingList, item)
		.map((shipping: any) => buildEffectiveInboundRow(shipping, adjustment))
		.filter((shipping: any) => {
			const saleDate = shipping.effectiveAmazonSaleDate || shipping.amazonSaleDate;
			if (!saleDate) return false;
			const date = dayjs(saleDate).startOf('day');
			return date.isValid() && (date.isAfter(start) || date.isSame(start, 'day')) && (date.isBefore(end) || date.isSame(end, 'day'));
		});
	return {
		total: Math.round(list.reduce((sum: number, shipping: any) => sum + (Number(shipping.quantity) || 0), 0)),
		list
	};
};

type CycleSystemFormulaParts = {
	demandQty: number;
	referenceDemandQty: number;
	referenceDiff: number;
	calculatedSystemQty: number;
	isReferenceAligned: boolean;
	fbaQty: number;
	inboundQty: number;
	systemQty: number;
	cycleStart: string;
	cycleEnd: string;
};

const normalizeFormulaQty = (value: any) => Math.max(0, Math.round(Number(value) || 0));

const buildCycleSystemFormulaParts = (params: {
	calculatedDemand: number;
	systemQty: number;
	fbaQty: number;
	inboundQty: number;
	cycleStart: string;
	cycleEnd: string;
}): CycleSystemFormulaParts => {
	const demandQty = normalizeFormulaQty(params.calculatedDemand);
	const systemQty = normalizeFormulaQty(params.systemQty);
	const fbaQty = normalizeFormulaQty(params.fbaQty);
	const inboundQty = normalizeFormulaQty(params.inboundQty);
	const referenceDemandQty = systemQty + fbaQty + inboundQty;
	const calculatedSystemQty = Math.max(demandQty - fbaQty - inboundQty, 0);
	const referenceDiff = referenceDemandQty - demandQty;

	return {
		demandQty,
		referenceDemandQty,
		referenceDiff,
		calculatedSystemQty,
		isReferenceAligned: Math.abs(calculatedSystemQty - systemQty) <= 1,
		fbaQty,
		inboundQty,
		systemQty,
		cycleStart: params.cycleStart,
		cycleEnd: params.cycleEnd
	};
};

const shouldShowDemandReferenceDiff = (
	parts: Pick<CycleSystemFormulaParts, "demandQty" | "referenceDiff">
) => {
	return parts.demandQty > 0 && Math.abs(parts.referenceDiff) > 1;
};

const getDemandCoverageDiffText = (referenceDiff: number) => {
	const diff = Math.round(Number(referenceDiff) || 0);
	if (diff === 0) return "刚好覆盖";
	return diff < 0
		? `少覆盖 ${formatCompactNumber(Math.abs(diff))} 件`
		: `多覆盖 ${formatCompactNumber(diff)} 件`;
};

const getCombinedSystemFormulaParts = (item: any) => {
	const systemQty = getItemAlgorithmTotalGap(item);
	const fbaQty = Math.round(getFbaInventoryQuantity(item));
	const inboundQty = getCombinedCycleInbound(item).total;
	const calculatedDemand = Math.round(getCombinedCycleDemandTotal(item));
	return buildCycleSystemFormulaParts({
		calculatedDemand,
		systemQty,
		fbaQty,
		inboundQty,
		cycleStart: dayjs().format('YYYY-MM-DD'),
		cycleEnd: getItemCycleEndDate(item)
	});
};

const getItemPreArrivalShortageInfo = (item: any) => {
	const calcResult = item?._calcResult || {};
	const orderedKeys = [
		...sortedSelectedMethods.value,
		...Object.keys(calcResult).filter(key => !sortedSelectedMethods.value.includes(key))
	];
	for (const key of orderedKeys) {
		const risk = calcResult[key]?.preArrivalShortage;
		if (risk && Number(risk.total) > 0 && Number(risk.shortageDays) > 0) {
			const method = shippingMethods.find(m => m.key === key);
			return {
				...risk,
				methodKey: key,
				methodLabel: risk.fastestArrivalMethodLabel || method?.label || key
			};
		}
	}
	return null;
};

const getDemandCoverageCheckHtml = (parts: CycleSystemFormulaParts, item: any) => {
	if (!shouldShowDemandReferenceDiff(parts)) return "";
	const diff = Math.round(Number(parts.referenceDiff) || 0);
	const risk = getItemPreArrivalShortageInfo(item);
	const hasPreArrivalRisk = diff < -1 && risk && Number(risk.total) > 0;
	const riskText = hasPreArrivalRisk
		? `差异原因：当前库存只能覆盖至${risk.lastCoveredDate ? formatShortMonthDay(risk.lastCoveredDate) : "首日前"}，${risk.shortageStartDate ? formatShortMonthDay(risk.shortageStartDate) : "-"}~${risk.shortageEndDate ? formatShortMonthDay(risk.shortageEndDate) : "-"}缺货约${formatCompactNumber(risk.total)}件；最快到货${risk.fastestArrivalDate ? formatShortMonthDay(risk.fastestArrivalDate) : "-"}，所以本次补货补不到。`
		: "说明：系统建议按逐日库存推演，当前方案可覆盖需求与按月周期总需求不一致。";

	return [
		'<div class="qty-tooltip-section">覆盖校验</div>',
		`<div>按月周期总需求：${parts.demandQty}</div>`,
		`<div>当前方案可覆盖：${parts.referenceDemandQty}</div>`,
		`<div><strong>结论：当前方案${getDemandCoverageDiffText(parts.referenceDiff)}</strong></div>`,
		`<div>${riskText}</div>`
	].join("");
};

const getSystemFormulaSummaryText = (parts: CycleSystemFormulaParts) => {
	if (parts.isReferenceAligned) {
		return `周期总需求 ${parts.demandQty} - FBA ${parts.fbaQty} - 期内在途 ${parts.inboundQty} = ${parts.systemQty}`;
	}
	return `系统建议 ${parts.systemQty}（逐日推演）；当前方案${getDemandCoverageDiffText(parts.referenceDiff)}`;
};

const getDemandCoverageBriefHtml = (parts: CycleSystemFormulaParts, item: any) => {
	if (!shouldShowDemandReferenceDiff(parts)) return "";
	const diff = Math.round(Number(parts.referenceDiff) || 0);
	const risk = getItemPreArrivalShortageInfo(item);
	const hasPreArrivalRisk = diff < -1 && risk && Number(risk.total) > 0;
	const riskRange = hasPreArrivalRisk && risk.shortageStartDate && risk.shortageEndDate
		? `${formatShortMonthDay(risk.shortageStartDate)}~${formatShortMonthDay(risk.shortageEndDate)}`
		: "";
	const riskText = hasPreArrivalRisk
		? `原因：最快到货前 ${riskRange} 缺货约${formatCompactNumber(risk.total)}件，这段本次补货补不到。`
		: "原因：当前方案可覆盖需求与按月周期总需求不一致。";

	return [
		'<div class="qty-tooltip-section">覆盖提示</div>',
		`<div>当前方案可覆盖：${parts.referenceDemandQty}，${getDemandCoverageDiffText(parts.referenceDiff)}</div>`,
		`<div>${riskText}</div>`,
		'<div>详细原因看“系统建议”。</div>'
	].join("");
};

const getTheoreticalSystemFormulaHtml = (parts: CycleSystemFormulaParts) => {
	return [
		'<div class="qty-tooltip-section">理论可补需求</div>',
		`<div>周期总需求 ${parts.demandQty} - FBA ${parts.fbaQty} - 期内在途 ${parts.inboundQty} = <strong>${parts.calculatedSystemQty}</strong></div>`
	].join("");
};

const getSystemSuggestionDetailHtml = (parts: CycleSystemFormulaParts, item: any) => {
	const diff = Math.round(Number(parts.referenceDiff) || 0);
	const preArrivalGap = diff < -1 ? Math.abs(diff) : 0;
	const currentQty = getItemTotalGap(item);
	const delta = currentQty - parts.systemQty;
	const adjustedText = preArrivalGap > 0
		? `<div>${parts.calculatedSystemQty} - 到货前不可补缺口 ${formatCompactNumber(preArrivalGap)} = <strong>${parts.systemQty}</strong></div><div>说明：到货前缺口已经发生在最快物流到货前，不进入本次可补货系统建议。</div>`
		: `<div><strong>${getSystemFormulaSummaryText(parts)}</strong></div>`;
	const currentText = delta === 0
		? ""
		: `<div>当前系统建议：${currentQty}（手动调整 ${delta > 0 ? "+" : ""}${delta}）</div>`;

	return [
		'<div class="qty-tooltip-section">系统建议结论</div>',
		adjustedText,
		currentText
	].join("");
};

const getPreArrivalShortageDetailHtml = (item: any, parts?: Pick<CycleSystemFormulaParts, "referenceDiff">) => {
	const risk = getItemPreArrivalShortageInfo(item);
	if (!risk) return "";
	const referenceGap = parts && Number(parts.referenceDiff) < -1
		? Math.abs(Math.round(Number(parts.referenceDiff) || 0))
		: 0;
	const totalText = formatCompactNumber(risk.total);
	const summaryTotalText = formatCompactNumber(referenceGap || risk.total);
	const shortageStartText = risk.shortageStartDate ? formatShortMonthDay(risk.shortageStartDate) : "-";
	const shortageEndText = risk.shortageEndDate ? formatShortMonthDay(risk.shortageEndDate) : "-";
	const arrivalText = risk.fastestArrivalDate ? formatShortMonthDay(risk.fastestArrivalDate) : "-";
	const unavailableRange = `${formatShortMonthDay(risk.startDate)}~${formatShortMonthDay(risk.endDate)}`;
	const lastCoveredText = risk.lastCoveredDate ? formatShortMonthDay(risk.lastCoveredDate) : "无法完整覆盖首日";
	const detailRows = Array.isArray(risk.details)
		? risk.details.map((detail: any) => {
			return `<div>${formatShortMonthDay(detail.date)}：库存 ${formatCompactNumber(detail.stockBeforeDemand, 2)}，日耗 ${formatCompactNumber(detail.dailyNeed, 2)}，缺 ${formatCompactNumber(detail.shortage, 2)}</div>`;
		}).join("")
		: "";
	const summaryTitle = referenceGap > 0
		? `到货前缺货：库存覆盖至${lastCoveredText}，${shortageStartText}~${shortageEndText}缺约${summaryTotalText}件`
		: `到货前缺货风险：${shortageStartText}~${shortageEndText}缺约${totalText}件`;
	const conclusionText = referenceGap > 0
		? `结论：这 ${summaryTotalText} 件发生在最快物流到货前，本次补货无法覆盖，所以周期总需求会比系统建议反推值多。`
		: "结论：这段发生在最快物流到货前，本次补货无法覆盖，只作为缺货风险提示。";

	return [
		'<details class="qty-risk-details">',
		`<summary><span class="qty-risk-summary-main">${summaryTitle}</span><span class="qty-risk-summary-hint">展开每日明细</span></summary>`,
		'<div class="qty-risk-body">',
		`<div>当前库存可覆盖至：${lastCoveredText}</div>`,
		`<div>开始缺货：${shortageStartText}</div>`,
		`<div>缺货区间：${shortageStartText}~${shortageEndText}，共${Number(risk.shortageDays) || 0}天，约${totalText}件</div>`,
		`<div>本次最快到货：${arrivalText}（${risk.methodLabel || "最快物流"}）</div>`,
		`<div>不可补货区间：${unavailableRange}</div>`,
		`<div class="qty-risk-conclusion">${conclusionText}</div>`,
		detailRows ? `<div class="qty-risk-detail-title">每日缺货明细</div><div class="qty-risk-detail-list">${detailRows}</div>` : "",
		'</div>',
		'</details>'
	].join("");
};

const getCombinedSystemFormulaText = (item: any) => {
	const parts = getCombinedSystemFormulaParts(item);
	const currentQty = getItemTotalGap(item);
	const delta = currentQty - parts.systemQty;
	const base = getSystemFormulaSummaryText(parts);
	if (delta === 0) return base;
	return `${base}；当前系统建议 ${currentQty}（手动调整 ${delta > 0 ? "+" : ""}${delta}）`;
};

const getCombinedCycleDemandDetail = (item: any) => {
	const parts = getCombinedSystemFormulaParts(item);
	const rows = getCombinedCycleDemandRows(item);
	const rowHtml = rows.length
		? rows.map(row => {
			const coeffText = row.fallbackReason
				? `系数 ${formatCompactNumber(row.coefficient, 2)}（${row.fallbackReason}）`
				: `综合系数 ${formatCompactNumber(row.coefficient, 2)}，α ${formatCompactNumber(row.alpha, 2)}`;
			return `<div>${formatShortMonthDay(row.startDate)}~${formatShortMonthDay(row.endDate)}：${row.days}天 × 日耗 ${formatCompactNumber(row.dailyNeed, 2)}（${coeffText}）= <strong>${row.subtotal}</strong></div>`;
		}).join('')
		: '<div>暂无周期需求明细</div>';
	return [
		'<div class="qty-tooltip-block">',
		`<div>周期口径：${parts.cycleStart} 至 ${parts.cycleEnd || '-'}</div>`,
		'<div class="qty-tooltip-section">按月拆分</div>',
		rowHtml,
		`<div class="qty-tooltip-section">合计：<strong>${parts.demandQty}</strong></div>`,
		getDemandCoverageBriefHtml(parts, item),
		'</div>'
	].join('');
};

const getCombinedActualPurchaseFormulaText = (item: any) => {
	const systemQty = getItemTotalGap(item);
	const purchasePlanDeductedQty = getItemPurchasePlanDeductedTotal(item);
	const afterPurchasePlanQty = getItemAfterPurchasePlanTotal(item);
	const localPendingDeductedQty = getItemLocalPendingDeliveryDeductedTotal(item);
	const afterLocalQty = getItemAfterLocalDeductionsTotal(item);
	const lingxingSummary = getItemLingxingFinalDeductionSummary(item);
	const rawQty = getItemActualPurchaseRawQty(item);
	const baseQty = getItemActualPurchaseBaseQty(item);
	const actualQty = getItemActualPurchaseQty(item);
	const coefficient = getItemManualCoefficient(item);
	const baseText = rawQty < 0 ? `0（覆盖 ${Math.abs(rawQty)}）` : String(baseQty);
	const excessQty = getItemPurchasePlanExcessQty(item);
	const excessText = excessQty > 0 ? `，超额覆盖 ${excessQty}` : "";
	const pendingExcessQty = getItemLocalPendingDeliveryExcessQty(item);
	const pendingExcessText = pendingExcessQty > 0 ? `，超额覆盖 ${pendingExcessQty}` : "";
	const lingxingExcessText = lingxingSummary.excessQty > 0 ? `，超额覆盖 ${lingxingSummary.excessQty}` : "";
	return `系统建议 ${systemQty} - 艾为采购计划抵扣 ${purchasePlanDeductedQty}${excessText} = 采购计划扣后 ${afterPurchasePlanQty}；采购计划扣后 ${afterPurchasePlanQty} - 艾为待交付抵扣 ${localPendingDeductedQty}${pendingExcessText} = 艾为扣后分段 ${afterLocalQty}；艾为扣后分段 ${afterLocalQty} - 领星总抵扣（采购计划+待交付） ${lingxingSummary.deductedTotal}${lingxingExcessText} = ${baseText} × 系数 ${coefficient.toFixed(1)} = ${actualQty}`;
};

const getInboundDetailRowHtml = (shipping: any) => {
	const orderText = shipping.orderSn || shipping.shippingOrderSn || "-";
	const qty = Number(shipping.quantity) || 0;
	const effectiveDate = shipping.effectiveAmazonSaleDate || shipping.amazonSaleDate || "-";
	if (shipping.arrivalAdjusted) {
		const originalDate = shipping.originalAmazonSaleDate || "-";
		const methodText = shipping.arrivalAdjustMethodLabel ? `${shipping.arrivalAdjustMethodLabel}段` : "首个运输段";
		return `<div>${orderText}：原预计 ${originalDate}，按 ${effectiveDate} ${methodText}参与测算，${qty}件</div>`;
	}
	return `<div>${orderText}：${effectiveDate} 到库，${qty}件</div>`;
};

const getCombinedSystemFormulaDetail = (item: any) => {
	const parts = getCombinedSystemFormulaParts(item);
	const inbound = getCombinedCycleInbound(item);
	const inboundRows = inbound.list.length
		? inbound.list.map((shipping: any) => getInboundDetailRowHtml(shipping)).join('')
		: '<div>期内无在途货件</div>';

	return [
		'<div class="qty-tooltip-block">',
		`<div class="qty-tooltip-section">周期口径：${parts.cycleStart} 至 ${parts.cycleEnd || '-'}</div>`,
		`<div class="qty-tooltip-section">系统建议公式</div>`,
		`<div>周期总需求：${parts.demandQty}</div>`,
		`<div>FBA库存：${parts.fbaQty}</div>`,
		`<div>期内在途：${parts.inboundQty}</div>`,
		getTheoreticalSystemFormulaHtml(parts),
		getDemandCoverageCheckHtml(parts, item),
		getPreArrivalShortageDetailHtml(item, parts),
		getSystemSuggestionDetailHtml(parts, item),
		`<div class="qty-tooltip-section">期内在途明细</div>`,
		inboundRows,
		'</div>'
	].join('');
};

const getSimpleCycleDemandRows = (item: any) => {
	const endDate = getItemCycleEndDate(item);
	if (!endDate) return [];
	const start = dayjs().startOf('day');
	const end = dayjs(endDate).startOf('day');
	if (!end.isValid() || end.isBefore(start)) return [];

	const dailyAvg = getCalcDailyAvgSales(item);
	const algoKey = getItemAlgoKey(item);
	const algoId = mapAlgoToInt(algoKey);
	return getSegmentMonthDateChunks(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')).map(chunk => {
		const coeffInfo = getItemMonthCoefficient(item, chunk.month, algoId);
		const roundedCoeff = Math.round(coeffInfo.coefficient * 100) / 100;
		const dailyNeed = Math.round(dailyAvg * roundedCoeff * 100) / 100;
		const subtotal = Math.round(chunk.days * dailyNeed);
		return {
			...chunk,
			raw_coefficient: coeffInfo.rawCoefficient,
			volatility_coefficient: coeffInfo.volatilityCoefficient,
			adjusted_coefficient: roundedCoeff,
			coefficient: roundedCoeff,
			dailyNeed,
			subtotal,
			fallbackReason: coeffInfo.fallbackReason,
			algoUsed: coeffInfo.algoUsed
		};
	});
};

const getFormulaCycleDemandRows = (item: any) => {
	return isCombinedAlgo(item) ? getCombinedCycleDemandRows(item) : getSimpleCycleDemandRows(item);
};

const getFormulaCycleDemandTotal = (item: any) => {
	return getFormulaCycleDemandRows(item).reduce((sum, row) => sum + row.subtotal, 0);
};

const getSimpleAlgoFormulaLabel = (item: any) => {
	const algoKey = getItemAlgoKey(item);
	if (algoKey === "history") return "历史销量系数";
	if (algoKey === "trend") return "搜索趋势系数";
	return "日均销量系数";
};

const getFormulaSystemParts = (item: any) => {
	if (isCombinedAlgo(item)) return getCombinedSystemFormulaParts(item);
	const systemQty = getItemAlgorithmTotalGap(item);
	const fbaQty = Math.round(getFbaInventoryQuantity(item));
	const inboundQty = getCombinedCycleInbound(item).total;
	const calculatedDemand = Math.round(getFormulaCycleDemandTotal(item));
	return buildCycleSystemFormulaParts({
		calculatedDemand,
		systemQty,
		fbaQty,
		inboundQty,
		cycleStart: dayjs().format('YYYY-MM-DD'),
		cycleEnd: getItemCycleEndDate(item)
	});
};

const getFormulaSystemText = (item: any) => {
	if (isCombinedAlgo(item)) return getCombinedSystemFormulaText(item);
	const parts = getFormulaSystemParts(item);
	const currentQty = getItemTotalGap(item);
	const delta = currentQty - parts.systemQty;
	const base = getSystemFormulaSummaryText(parts);
	if (delta === 0) return base;
	return `${base}；当前系统建议 ${currentQty}（手动调整 ${delta > 0 ? "+" : ""}${delta}）`;
};

const getFormulaActualPurchaseText = (item: any) => {
	return getCombinedActualPurchaseFormulaText(item);
};

const getFormulaCycleDemandDetail = (item: any) => {
	if (isCombinedAlgo(item)) return getCombinedCycleDemandDetail(item);
	const parts = getFormulaSystemParts(item);
	const rows = getFormulaCycleDemandRows(item);
	const coeffLabel = getSimpleAlgoFormulaLabel(item);
	const rowHtml = rows.length
		? rows.map(row => {
			const coeffText = row.fallbackReason
				? `${coeffLabel} ${formatCompactNumber(row.coefficient, 2)}（${row.fallbackReason}）`
				: `${coeffLabel} ${formatCompactNumber(row.coefficient, 2)}`;
			return `<div>${formatShortMonthDay(row.startDate)}~${formatShortMonthDay(row.endDate)}：${row.days}天 × 日耗 ${formatCompactNumber(row.dailyNeed, 2)}（${coeffText}）= <strong>${row.subtotal}</strong></div>`;
		}).join('')
		: '<div>暂无周期需求明细</div>';
	return [
		'<div class="qty-tooltip-block">',
		`<div>周期口径：${parts.cycleStart} 至 ${parts.cycleEnd || '-'}</div>`,
		`<div>算法口径：${getAlgoPanelTitle(item)}</div>`,
		'<div class="qty-tooltip-section">按月拆分</div>',
		rowHtml,
		`<div class="qty-tooltip-section">合计：<strong>${parts.demandQty}</strong></div>`,
		getDemandCoverageBriefHtml(parts, item),
		'</div>'
	].join('');
};

const getFormulaSystemDetail = (item: any) => {
	if (isCombinedAlgo(item)) return getCombinedSystemFormulaDetail(item);
	const parts = getFormulaSystemParts(item);
	const inbound = getCombinedCycleInbound(item);
	const inboundRows = inbound.list.length
		? inbound.list.map((shipping: any) => getInboundDetailRowHtml(shipping)).join('')
		: '<div>期内无在途货件</div>';

	return [
		'<div class="qty-tooltip-block">',
		`<div class="qty-tooltip-section">周期口径：${parts.cycleStart} 至 ${parts.cycleEnd || '-'}</div>`,
		`<div class="qty-tooltip-section">系统建议公式</div>`,
		`<div>周期总需求：${parts.demandQty}</div>`,
		`<div>FBA库存：${parts.fbaQty}</div>`,
		`<div>期内在途：${parts.inboundQty}</div>`,
		getTheoreticalSystemFormulaHtml(parts),
		getDemandCoverageCheckHtml(parts, item),
		getPreArrivalShortageDetailHtml(item, parts),
		getSystemSuggestionDetailHtml(parts, item),
		`<div class="qty-tooltip-section">期内在途明细</div>`,
		inboundRows,
		'</div>'
	].join('');
};

const getItemAlgorithmTotalGap = (item: any) => {
	const effective = getEffectiveCalcResult(item);
	let total = 0;
	for (const key of sortedSelectedMethods.value) {
		if (!item.inactiveMethods?.includes(key)) {
			total += effective[key].gap || 0;
		}
	}
	return Math.round(total);
};

const hasItemCurrentShippingQuantities = (item: any) => {
	if (!item?.shippingQuantities) return false;
	return sortedSelectedMethods.value.some(key => {
		return !item.inactiveMethods?.includes(key) && Object.prototype.hasOwnProperty.call(item.shippingQuantities, key);
	});
};

const getItemCurrentMethodSuggestionQty = (item: any, methodKey: string) => {
	return getSegmentSuggestedQty(item, methodKey);
};

const getItemCurrentSystemSuggestionQty = (item: any) => {
	let total = 0;
	for (const key of sortedSelectedMethods.value) {
		if (item.inactiveMethods?.includes(key)) continue;
		total += getItemCurrentMethodSuggestionQty(item, key);
	}
	return Math.round(total);
};

const getItemTotalGap = (item: any) => {
	return getItemCurrentSystemSuggestionQty(item);
};

const getItemRemainingGap = (item: any) => {
	const totalGap = getItemTotalGap(item);
	const totalShipping = getItemTotalShipping(item);
	return Math.max(0, totalGap - totalShipping);
};

// 「应用到全部」按钮
const applyToAll = async (silentOrEvent?: boolean | Event) => {
	const silent = silentOrEvent === true;
	if (deferCalculationIfPurchasePlanSyncing()) {
		if (!silent) ElMessage.info("采购计划/待交付数据正在刷新，刷新完成后会自动计算");
		return;
	}
	deferredCalculateAfterPurchasePlanSync.value = false;
	if (!globalDateRange.value || globalDateRange.value.length < 2) return;

	const globalItems: any[] = [];
	const customItems: any[] = [];

	props.items.forEach(item => {
		const range = applyItemReplenishDateRange(item);
		if (!range) return;
		if (getCustomTargetStockDays(item) > 0) {
			customItems.push(item);
		} else {
			globalItems.push(item);
		}
	});

	if (globalItems.length > 0) {
		await calculateReplenishment(globalItems, silent);
	}

	for (const item of customItems) {
		const range = item.replenishDateRange;
		if (range && range.length === 2) {
			await recalculateItemByDateRange(item, range[0], range[1], true);
		}
	}
};

// 切换算法时自动应用到全部
const onAlgoChange = () => {
	if (globalDateRange.value && globalDateRange.value.length === 2) {
		applyToAll();
	}
};

// 辅助方法：获取物流方式详情
const getShippingMethodInfo = (key: string) => {
	return shippingMethods.find(m => m.key === key);
};

// 辅助方法：计算单行选中物流的合计数量
const getItemTotalShipping = (item: any) => {
	if (!item.shippingQuantities) return 0;
	let total = 0;
	for (const key of sortedSelectedMethods.value) {
		if (item.inactiveMethods?.includes(key)) continue;
		total += normalizeShippingQuantity(item.shippingQuantities?.[key]);
	}
	return Math.round(total);
};

const applyIndependentShippingQuantityChange = (item: any, methodKey: string, val: any, oldVal?: any) => {
	if (!item.shippingQuantities) item.shippingQuantities = {};
	const normalized = normalizeShippingQuantity(val);
	const oldQty = oldVal === undefined || oldVal === null
		? getManualShippingQuantity(item, methodKey) ?? getCurrentShippingQuantity(item, methodKey)
		: normalizeShippingQuantity(oldVal);
	const totalBefore = getItemTotalShippingWithOverrides(item, { [methodKey]: oldQty });
	item.shippingQuantities[methodKey] = normalized;
	setManualShippingQuantity(item, methodKey, normalized);
	const totalAfter = getItemTotalShipping(item);
	recordShippingAdjustment(item, {
		mode: "independent",
		mode_label: getShippingAdjustModeLabel("independent"),
		source: "manual",
		trigger_method: methodKey,
		trigger_label: getMethodLabel(methodKey),
		from_qty: oldQty,
		to_qty: normalized,
		applied_qty: normalized,
		delta: normalized - oldQty,
		total_before: totalBefore,
		total_after: totalAfter,
		adjustments: []
	});
};

const applyRedistributedShippingQuantityChange = (
	item: any,
	methodKey: string,
	val: any,
	oldVal?: any,
	source: "manual" | "restore" = "manual"
) => {
	if (!item.shippingQuantities) item.shippingQuantities = {};
	const replacedTriggerGroup = resetExistingTriggerRedistributionGroupForUpdate(item, methodKey);
	const groupId = createShippingAdjustmentGroupId();
	const beforeManualQuantities = { ...ensureManualShippingQuantities(item) };
	const beforeManualGroups = { ...ensureManualShippingGroups(item) };
	const beforeRedistributionEffects = cloneRedistributionEffects(ensureShippingRedistributionEffects(item));
	const activeKeys = getActiveShippingMethodKeys(item);
	const requestedQty = normalizeShippingQuantity(val);
	const oldQty = replacedTriggerGroup?.baseQty ?? (oldVal === undefined || oldVal === null
		? getManualShippingQuantity(item, methodKey) ?? getCurrentShippingQuantity(item, methodKey)
		: normalizeShippingQuantity(oldVal));
	const beforeQuantities = buildShippingQuantitySnapshot(item);
	beforeQuantities[methodKey] = oldQty;
	const totalBefore = getItemTotalShippingWithOverrides(item, { [methodKey]: oldQty });
	const affectedKeys = new Set<string>([methodKey]);
	const adjustments: Array<{ method: string; label: string; from_qty: number; to_qty: number; delta: number }> = [];

	if (item.inactiveMethods?.includes(methodKey)) {
		item.shippingQuantities[methodKey] = 0;
		return { affectedKeys: Array.from(affectedKeys), appliedQty: 0, clamped: false };
	}

	if (activeKeys.length <= 1) {
		item.shippingQuantities[methodKey] = oldQty;
		ElMessage.warning("分段调配至少需要保留两个启用的运输方式");
		return { affectedKeys: Array.from(affectedKeys), appliedQty: oldQty, clamped: true };
	}

	const delta = requestedQty - oldQty;
	if (delta === 0) {
		item.shippingQuantities[methodKey] = requestedQty;
		if (requestedQty === getSystemShippingQuantity(item, methodKey)) {
			const manualMap = ensureManualShippingQuantities(item);
			const manualGroups = ensureManualShippingGroups(item);
			delete manualMap[methodKey];
			delete manualGroups[methodKey];
			clearShippingRedistributionEffect(item, methodKey);
			syncShippingManualFlag(item);
		} else {
			setManualShippingQuantity(item, methodKey, requestedQty);
		}
		return { affectedKeys: Array.from(affectedKeys), appliedQty: requestedQty, clamped: false };
	}

	let appliedQty = requestedQty;
	let clamped = false;
	if (delta > 0) {
		const donors = getRedistributionDonorKeys(item, methodKey);
		const available = donors.reduce((sum, key) => sum + getCurrentShippingQuantity(item, key), 0);
		const appliedIncrease = Math.min(delta, available);
		appliedQty = oldQty + appliedIncrease;
		clamped = appliedIncrease < delta;
		if (appliedIncrease <= 0) {
			item.shippingQuantities[methodKey] = oldQty;
			ElMessage.warning("其他启用运输方式没有可调配数量，已保持原值");
			return { affectedKeys: Array.from(affectedKeys), appliedQty: oldQty, clamped: true };
		}
		item.shippingQuantities[methodKey] = appliedQty;
		setManualShippingQuantity(item, methodKey, appliedQty, groupId);

		let remaining = appliedIncrease;
		for (const key of donors) {
			if (remaining <= 0) break;
			const before = getCurrentShippingQuantity(item, key);
			const used = Math.min(before, remaining);
			const after = before - used;
			item.shippingQuantities[key] = after;
			setShippingRedistributionEffect(item, key, after, groupId, methodKey);
			affectedKeys.add(key);
			adjustments.push({
				method: key,
				label: getMethodLabel(key),
				from_qty: before,
				to_qty: after,
				delta: -used
			});
			remaining -= used;
		}

		if (clamped) {
			ElMessage.warning(`其他运输方式最多可调配 ${appliedIncrease} 件，已限制为 ${appliedQty} 件`);
		}
	} else {
		const receiverKey = getRedistributionReceiverKey(item, methodKey);
		if (!receiverKey) {
			item.shippingQuantities[methodKey] = oldQty;
			ElMessage.warning("没有可承接减少数量的启用运输方式");
			return { affectedKeys: Array.from(affectedKeys), appliedQty: oldQty, clamped: true };
		}
		const released = oldQty - requestedQty;
		item.shippingQuantities[methodKey] = requestedQty;
		setManualShippingQuantity(item, methodKey, requestedQty, groupId);
		const before = getCurrentShippingQuantity(item, receiverKey);
		const after = before + released;
		item.shippingQuantities[receiverKey] = after;
		setShippingRedistributionEffect(item, receiverKey, after, groupId, methodKey);
		affectedKeys.add(receiverKey);
		adjustments.push({
			method: receiverKey,
			label: getMethodLabel(receiverKey),
			from_qty: before,
			to_qty: after,
			delta: released
		});
	}

	const totalAfter = getItemTotalShipping(item);
	const affectedMethods = Array.from(affectedKeys);
	const dependsOnGroupIds = collectShippingAdjustmentDependencyIds(
		groupId,
		affectedMethods,
		beforeManualGroups,
		beforeRedistributionEffects
	);
	ensureShippingAdjustmentGroups(item)[groupId] = {
		group_id: groupId,
		mode: "redistribute",
		trigger_method: methodKey,
		depends_on_group_ids: dependsOnGroupIds,
		affected_methods: affectedMethods,
		before_quantities: pickRecordKeys(beforeQuantities, affectedMethods),
		after_quantities: pickRecordKeys(buildShippingQuantitySnapshot(item), affectedMethods),
		before_manual_quantities: pickRecordKeys(beforeManualQuantities, affectedMethods),
		before_manual_groups: pickRecordKeys(beforeManualGroups, affectedMethods),
		before_redistribution_effects: pickRecordKeys(beforeRedistributionEffects, affectedMethods),
		adjustments
	};
	recordShippingAdjustment(item, {
		mode: "redistribute",
		mode_label: getShippingAdjustModeLabel("redistribute"),
		source,
		group_id: groupId,
		trigger_method: methodKey,
		trigger_label: getMethodLabel(methodKey),
		from_qty: oldQty,
		to_qty: requestedQty,
		applied_qty: appliedQty,
		delta: appliedQty - oldQty,
		total_before: totalBefore,
		total_after: totalAfter,
		clamped,
		adjustments
	});

	return { affectedKeys: affectedMethods, appliedQty, clamped, groupId };
};

const onShippingQuantityChange = (item: any, methodKey: string, val: any, oldVal?: any) => {
	const rememberedOldVal = consumeShippingQuantityBeforeEdit(item, methodKey);
	const resolvedOldVal = oldVal ?? rememberedOldVal;
	if (getShippingAdjustMode(item) === "redistribute") {
		applyRedistributedShippingQuantityChange(item, methodKey, val, resolvedOldVal, "manual");
		return;
	}
	applyIndependentShippingQuantityChange(item, methodKey, val, resolvedOldVal);
};

const getItemPendingDeliveryQty = (item: any) => Math.max(0, Math.round(Number(item.pending_delivery_qty) || 0));

const getItemPurchasePlanQty = (item: any) => Math.max(0, Math.round(Number(item.purchase_plan_qty) || 0));

watch(() => props.items.map(item => {
	return [
		item.id || item.asin || "",
		item.store_id || "",
		item.msku || "",
		getItemLocalPurchasePlanQty(item),
		getItemPendingDeliveryQty(item)
	].join("|");
}).join(";"), () => {
	props.items.forEach(item => {
		if (item?._calcResult && Object.keys(item._calcResult).length > 0) {
			applyPurchasePlanDeductionToItem(item);
		}
	});
}, { flush: "post" });

const getItemActualPurchaseRawQty = (item: any) => {
	return getItemAfterLocalDeductionsTotal(item) - getItemLingxingFinalDeductionSourceQty(item);
};

const getItemManualCoefficient = (item: any) => Number(item._manualCoefficient ?? 1) || 1;

const getItemActualPurchaseBaseQty = (item: any) => Math.max(0, Math.round(getItemActualPurchaseRawQty(item)));

const getItemActualPurchaseQty = (item: any) => {
	return Math.round(getItemActualPurchaseBaseQty(item) * getItemManualCoefficient(item));
};

const getItemFinalPurchaseQty = (item: any) => {
	return getBoxAdjustmentResult(item).adjustedQty;
};

const joinQtyFormula = (parts: Array<{ label: string; qty: number }>, total: number) => {
	const visibleParts = parts.filter(part => part.qty > 0);
	const sourceParts = visibleParts.length > 0 ? visibleParts : parts;
	const expression = sourceParts.map(part => `${part.label} ${Math.round(part.qty)}`).join(" + ") || "0";
	return `${expression} = ${Math.round(total)}`;
};

const getItemSystemSuggestionFormula = (item: any) => {
	const parts = sortedSelectedMethods.value
		.filter(key => !item.inactiveMethods?.includes(key))
		.map(key => ({
			label: getMethodLabel(key),
			qty: getItemCurrentMethodSuggestionQty(item, key)
		}));
	const currentQty = getItemTotalGap(item);
	const algorithmQty = getItemAlgorithmTotalGap(item);
	const delta = currentQty - algorithmQty;
	const formula = joinQtyFormula(parts, currentQty);
	if (delta === 0) return formula;
	return `${formula}；原算法建议 ${algorithmQty}，手动调整 ${delta > 0 ? "+" : ""}${delta}`;
};

const getItemActualPurchaseFormula = (item: any) => {
	const systemQty = getItemTotalGap(item);
	const pendingQty = getItemPendingDeliveryQty(item);
	const purchasePlanQty = getItemLocalPurchasePlanQty(item);
	const purchasePlanDeductedQty = getItemPurchasePlanDeductedTotal(item);
	const purchasePlanExcessQty = getItemPurchasePlanExcessQty(item);
	const localPendingDeductedQty = getItemLocalPendingDeliveryDeductedTotal(item);
	const localPendingExcessQty = getItemLocalPendingDeliveryExcessQty(item);
	const afterPurchasePlanQty = getItemAfterPurchasePlanTotal(item);
	const afterLocalQty = getItemAfterLocalDeductionsTotal(item);
	const lingxingPurchasePlanQty = getItemLingxingPurchasePlanQty(item);
	const lingxingPendingQty = getItemLingxingPendingDeliveryQty(item);
	const lingxingSummary = getItemLingxingFinalDeductionSummary(item);
	const rawQty = getItemActualPurchaseRawQty(item);
	const baseQty = getItemActualPurchaseBaseQty(item);
	const actualQty = getItemActualPurchaseQty(item);
	const coefficient = getItemManualCoefficient(item);
	const deductionLines = [
		`系统建议：${systemQty}`,
		`艾为采购计划：${purchasePlanQty}`,
		`艾为采购计划抵扣：${purchasePlanDeductedQty}`,
		`艾为采购计划扣后分段合计：${afterPurchasePlanQty}`,
		`艾为待交付：${pendingQty}`,
		`艾为待交付抵扣：${localPendingDeductedQty}`,
		`艾为扣后分段合计：${afterLocalQty}`,
		`领星采购计划：${lingxingPurchasePlanQty}`,
		`领星待交付：${lingxingPendingQty}`,
		`领星总抵扣（采购计划+待交付）：${lingxingSummary.deductedTotal}`,
		`扣减结果：${afterLocalQty} - ${lingxingSummary.lingxingQty} = ${rawQty}`
	];
	if (purchasePlanExcessQty > 0) {
		deductionLines.splice(3, 0, `艾为采购计划超额覆盖：${purchasePlanExcessQty}`);
	}
	if (localPendingExcessQty > 0) {
		deductionLines.splice(7, 0, `艾为待交付超额覆盖：${localPendingExcessQty}`);
	}
	if (lingxingSummary.excessQty > 0) {
		deductionLines.splice(deductionLines.length - 1, 0, `领星数据超额覆盖：${lingxingSummary.excessQty}`);
	}
	if (rawQty < 0) {
		deductionLines.push(`基础采购量：0（已覆盖 ${Math.abs(rawQty)}）`);
	} else {
		deductionLines.push(`基础采购量：${baseQty}`);
	}
	return [
		'<div class="qty-tooltip-block">',
		'<div class="qty-tooltip-section">扣减过程</div>',
		...deductionLines.map(line => `<div>${line}</div>`),
		'<div class="qty-tooltip-section">系数计算</div>',
		`<div>人工系数：${coefficient.toFixed(1)}</div>`,
		`<div>实际采购量：${baseQty} × ${coefficient.toFixed(1)} = <strong>${actualQty}</strong></div>`,
		'</div>'
	].join('');
};

// ========== 跨店补货（Bug6: 按行隔离，避免快速切换时数据串行覆盖） ==========
const crossStoreLoading = ref(false);
const crossStoreList = ref<any[]>([]);
const crossStoreCurrentItem = ref<any>(null); // 当前正在加载的行

const fetchOtherStoreListings = async (item: any) => {
	crossStoreCurrentItem.value = item;
	crossStoreLoading.value = true;
	crossStoreList.value = [];
	try {
		const res = await (service.app.bsr_purchase_plan_lingxing as any).getOtherStoreListings({
			product_code: item.product_code,
			marketplace: item.marketplace,
		});
		// 只有当前仍在看同一行时才更新结果，防止请求串行覆盖
		if (crossStoreCurrentItem.value === item) {
			crossStoreList.value = res || [];
		}
	} catch (e: any) {
		console.error('获取其他店铺listing失败:', e);
		ElMessage.error('获取其他店铺数据失败');
	} finally {
		if (crossStoreCurrentItem.value === item) {
			crossStoreLoading.value = false;
		}
	}
};

const selectTargetListing = (item: any, listing: any) => {
	// 如果选中的就是当前店铺+ASIN，则清除跨店选择（回到本店）
	if (listing.store_id === item.store_id && listing.asin === item.asin) {
		delete item._targetListing;
		ElMessage.info('已切换回本店');
	} else {
		item._targetListing = { ...listing };
		ElMessage.success(`已选择目标：${listing.seller_name || listing.shop} / ${listing.local_sku}`);
	}
};

const clearTargetListing = (item: any) => {
	delete item._targetListing;
};

const filterByRowMsku = (list: any, row: any, skuField = "msku") => {
	if (!Array.isArray(list)) return [];
	return list.filter((item: any) => {
		if (!row?.msku) return true;
		return item?.[skuField] ? item[skuField] === row.msku : true;
	});
};

function getDailyAvgSales(row: any) {
	const val = Number(row?.dailyAvgSales);
	if (!Number.isNaN(val) && val > 0) return val;

	const salesInfo = row?.restocking?.salesInfo;
	if (!salesInfo) return 0;

	const A1 = salesInfo.salesAvg3 || 0;
	const A2 = salesInfo.salesAvg7 || 0;
	const A3 = salesInfo.salesAvg14 || 0;
	let dailyAvgSales = 0;

	if (A3 === 0) dailyAvgSales = 0;
	else if (A2 === 0) dailyAvgSales = 0;
	else if (A1 === 0) dailyAvgSales = A2;
	else {
		const rate1_2 = A2 > 0 ? (A1 - A2) / A2 : 0;
		const rate1_3 = A3 > 0 ? (A1 - A3) / A3 : 0;
		if (rate1_2 < -0.66) dailyAvgSales = (A1 * 2 + A2 * 0.8 + A3 * 0.2) / 3;
		else if (rate1_2 > 2) dailyAvgSales = (A1 * 2 + A2 * 0.8 + A3 * 0.2) / 3;
		else if (rate1_3 > 1) dailyAvgSales = (A1 * 1.8 + A2 * 0.8 + A3 * 0.4) / 3;
		else if (rate1_3 < -0.5) dailyAvgSales = (A1 * 1.8 + A2 * 0.8 + A3 * 0.4) / 3;
		else if (rate1_3 > 0.5) dailyAvgSales = (A1 * 1.4 + A2 * 1 + A3 * 0.6) / 3;
		else if (rate1_3 < -0.33) dailyAvgSales = (A1 * 1.4 + A2 * 1 + A3 * 0.6) / 3;
		else dailyAvgSales = (A1 * 1.1 + A2 * 1.1 + A3 * 0.8) / 3;
	}

	return Number(dailyAvgSales.toFixed(2));
}

function getDailyAvgSalesDetailText(row: any) {
	const salesInfo = row?.restocking?.salesInfo;
	if (!salesInfo) return "-";
	return `${salesInfo.salesAvg3 || 0}/${salesInfo.salesAvg7 || 0}/${salesInfo.salesAvg14 || 0}`;
}

function getRealtimeSalesVolume(row: any) {
	const value = row?.restocking?.realtimeSales;
	if (value === null || value === undefined || value === "") return null;
	const num = Number(value);
	return Number.isFinite(num) ? num : null;
}

function getRecentSalesTrendList(row: any) {
	const trendList = row?.restocking?.salesInfo?.recentSalesTrendList;
	if (!Array.isArray(trendList)) return [];

	return trendList
		.filter((item: any) => item?.date)
		.map((item: any) => {
			const volume = Number(item?.volume);
			return {
				date: String(item.date),
				volumeText: Number.isFinite(volume) ? formatCompactNumber(volume) : "-"
			};
		});
}

function formatRecentSalesDate(date: any) {
	const parsed = dayjs(date);
	return parsed.isValid() ? parsed.format("MM-DD") : String(date || "-");
}

function getDailySalesMetricValue(row: any, key: string) {
	const value = row?.restocking?.salesInfo?.[key];
	const num = Number(value);
	return Number.isFinite(num) ? formatCompactNumber(num, 2) : "-";
}

function getDailySalesTooltipData(row: any) {
	const realtimeSales = getRealtimeSalesVolume(row);
	return {
		dailyAvg: formatCompactNumber(getDailyAvgSales(row), 2),
		status: getResolvedSalesChangeStatus(row),
		metrics: [
			{ label: "3日均", value: getDailySalesMetricValue(row, "salesAvg3") },
			{ label: "7日均", value: getDailySalesMetricValue(row, "salesAvg7") },
			{ label: "14日均", value: getDailySalesMetricValue(row, "salesAvg14") },
			{ label: "实时销量", value: realtimeSales === null ? "-" : formatCompactNumber(realtimeSales) }
		],
		history: getRecentSalesTrendList(row)
	};
}

function getCalcDailyAvgSales(row: any) {
	const manual = Number(row?._calcDailyAvgSales);
	if (row?._calcDailyAvgSales !== undefined && row?._calcDailyAvgSales !== null && Number.isFinite(manual) && manual >= 0) {
		return Number(manual.toFixed(2));
	}
	return getDailyAvgSales(row);
}

function getFbaInventoryQuantity(row: any) {
	const matchedList = filterByRowMsku(row?.restocking?.fbaValidList, row);
	if (matchedList.length > 0) {
		return matchedList.reduce((sum: number, item: any) => {
			return sum + (Number(item.quantity) || 0);
		}, 0);
	}

	return Number(row?.afn_fulfillable_quantity) || 0;
}

function getFbaReservedQuantity(row: any) {
	const matchedList = filterByRowMsku(row?.restocking?.fbaValidList, row);
	if (matchedList.length > 0) {
		return matchedList.reduce((sum: number, item: any) => {
			return sum + (Number(item.afnReservedQuantity) || 0);
		}, 0);
	}

	const directValue = row?.afnReservedQuantity ?? row?.afn_reserved_quantity;
	if (directValue !== undefined && directValue !== null && directValue !== "") {
		const reservedQuantity = Number(directValue);
		return Number.isNaN(reservedQuantity) ? 0 : reservedQuantity;
	}

	return (
		(Number(row?.reserved_customerorders) || 0) +
		(Number(row?.reserved_fc_processing) || 0) +
		(Number(row?.reserved_fc_transfers) || 0)
	);
}

function getRestockingFbaShippingQuantity(row: any) {
	const matchedList = filterByRowMsku(row?.restocking?.fbaShippingList, row);
	return matchedList.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0);
}

function getAvailableSaleDays(row: any) {
	const dailyAvg = getDailyAvgSales(row);
	const fba = getFbaInventoryQuantity(row);
	const inTransit = getRestockingFbaShippingQuantity(row);
	const total = dailyAvg > 0 ? Math.floor((fba + inTransit) / dailyAvg) : "999";
	const fbaDays = dailyAvg > 0 ? Math.floor(fba / dailyAvg) : "999";
	return `${total}/${fbaDays}`;
}

function calculateSalesChangeStatusFromSalesInfo(salesInfo: any) {
	if (!salesInfo) return "";
	const f = !salesInfo.salesAvg3 ? 0.01 : Number(salesInfo.salesAvg3);
	const g = !salesInfo.salesAvg7 ? 0.01 : Number(salesInfo.salesAvg7);
	const h = !salesInfo.salesAvg14 ? 0.01 : Number(salesInfo.salesAvg14);
	const shortR = (f - g) / g;
	const longR = (g - h) / h;

	if (shortR > 3) return "短期突增";
	if (shortR < -0.75) return "短期突降";
	if (longR > 0.66) return "明显增长";
	if (longR < -0.4) return "明显下滑";
	if (longR > 0.3) return "持续增长";
	if (longR < -0.25) return "持续下滑";
	return "销量稳定";
}

function getResolvedSalesChangeStatus(row: any) {
	return row?.salesChangeStatus || calculateSalesChangeStatusFromSalesInfo(row?.restocking?.salesInfo);
}

function getSalesStatusShortText(status: string) {
	const map: Record<string, string> = {
		"销量稳定": "稳定",
		"14天无单": "14无",
		"7天无单": "7无",
		"3天无单": "3无",
		"短期突降": "短降",
		"短期突增": "短增",
		"明显增长": "显增",
		"明显下滑": "显降",
		"小幅增长": "小增",
		"小幅下滑": "小降",
		"销量平稳": "平稳"
	};
	return map[status] || status;
}

function formatSummaryValue(value: any) {
	if (Array.isArray(value)) return value.join(", ");
	return value ?? "-";
}

function getHistoryTrendSummary(value: any, compareIndex = 10) {
	const history = Array.isArray(value) ? value : [];
	const current = Number(history[0]);
	const compare = Number(history[compareIndex]);
	const hasCurrent = Number.isFinite(current);
	const hasCompare = Number.isFinite(compare);
	const currentText = hasCurrent ? formatCompactNumber(current, 2) : "-";
	const compareText = hasCompare ? formatCompactNumber(compare, 2) : "-";

	if (!hasCurrent) {
		return {
			currentText,
			compareText,
			trendText: "-",
			trendClass: "is-flat"
		};
	}

	if (!hasCompare) {
		return {
			currentText,
			compareText,
			trendText: "-",
			trendClass: "is-flat"
		};
	}

	const diff = current - compare;
	if (diff > 0) {
		return {
			currentText,
			compareText,
			trendText: `↑${formatCompactNumber(Math.abs(diff), 2)}`,
			trendClass: "is-up"
		};
	}

	if (diff < 0) {
		return {
			currentText,
			compareText,
			trendText: `↓${formatCompactNumber(Math.abs(diff), 2)}`,
			trendClass: "is-down"
		};
	}

	return {
		currentText,
		compareText,
		trendText: "→0",
		trendClass: "is-flat"
	};
}

function getRatingMiniRows(item: any) {
	return [
		{
			key: "stars",
			label: "评分",
			...getHistoryTrendSummary(item?.stars)
		},
		{
			key: "reviews_num",
			label: "总数",
			...getHistoryTrendSummary(item?.reviews_num)
		}
	];
}

const buildQuantitySummary = (param: any, quantityProp: string) => {
	const { columns, data } = param;
	const sums: string[] = [];

	columns.forEach((column: any, index: number) => {
		if (index === 0) {
			sums[index] = "合计";
			return;
		}
		if (column.property === quantityProp) {
			const total = data.reduce((sum: number, row: any) => {
				const value = Number(row?.[quantityProp]);
				return Number.isNaN(value) ? sum : sum + value;
			}, 0);
			sums[index] = `${total}`;
			return;
		}
		sums[index] = "";
	});

	return sums;
};

const getPendingDeliverySummary = (param: any) => buildQuantitySummary(param, "quantity");

const getPurchasePlanSummary = (param: any) => buildQuantitySummary(param, "quantity_plan");

const getPendingDeliverySourceLabel = (detail: any) => {
	const source = String(detail?.source || "").trim().toLowerCase();
	const label = String(detail?.source_label || "").trim();
	if (source === "lingxing" || label === "领星") return "领星";
	return "艾为";
};

const getPendingDeliverySourceTagType = (detail: any): "success" | "warning" | "info" | "danger" | "primary" => {
	return getPendingDeliverySourceLabel(detail) === "领星" ? "warning" : "success";
};

function getPendingDeliveryTagType(status: any, statusText = ""): "success" | "warning" | "info" | "danger" | "primary" {
	switch (Number(status)) {
		case 2:
			return "warning";
		case 1:
			return "primary";
		case 3:
		case 121:
			return "info";
		case 122:
			return "danger";
		default:
			break;
	}

	const text = String(statusText || "").trim();
	if (text.includes("待到货") || text.includes("待签收")) return "warning";
	if (text.includes("待下单")) return "primary";
	if (text.includes("待提交") || text.includes("待审核") || text.includes("待审批")) return "info";
	if (text.includes("驳回") || text.includes("作废")) return "danger";
	if (text.includes("完成")) return "success";
	return "info";
}

const handleClose = (done?: () => void) => {
	clearSyncNoticeTimers();
	// 重置内部状态
	globalDateRange.value = null;
	globalAlgo.value = DEFAULT_GLOBAL_ALGO;
	globalAlpha.value = 0.7;
	shippingBuffer.value = DEFAULT_SHIPPING_BUFFER;
	applyShippingProfile("default");
	clearAllItemCalcData(); // 清空所有明细的计算数据和日期选择
	// 清理所有临时属性（这些属性直接挂在 props.items 行对象上）
	props.items.forEach(item => {
		delete item._excluded;
		delete item._manualCoefficient;
		delete item._manualRemark;
		delete item._calcDailyAvgSales;
		delete item._calendarData;
		delete item._targetListing;
		delete item._shippingQuantityManual;
		delete item._manualShippingQuantities;
		delete item._manualShippingGroups;
		delete item._shippingRedistributionEffects;
		delete item._shippingAdjustmentGroups;
		delete item._shippingAdjustMode;
		delete item._shippingAdjustModeTouched;
		delete item._shippingAdjustmentLog;
		delete item._bulkSelectKey;
		delete item._purchasePlanDeductionApplied;
		delete item._shippingMethodPrefsLoaded;
		delete item._shippingMethodPrefsLoading;
		delete item._shippingMethodPrefsSaving;
		delete item._shippingMethodPrefsRecordId;
		delete item._volatilityCoefficient;
		delete item._volatilityCoefficientInput;
		delete item._volatilityCoefficientBeforeEdit;
		delete item._volatilityCoefficientLoading;
		delete item._volatilityCoefficientSaving;
		delete item._volatilityCoefficientLoaded;
		delete item._volatilityCoefficientRecordId;
		delete item._volatilityCoefficientClientKey;
		delete item._manualBoxPcsInput;
		delete item._productPurchaseRemarkOriginal;
		delete item._productPurchaseRemark;
		delete item._productPurchaseRemarkDirty;
		delete item._purchaseWarehouseWid;
		delete item._warehouseValidationError;

	});
	currentStep.value = 1; // 回到步骤1
	syncNoticeDismissed.value = false;
	syncNoticeLeaving.value = false;
	deferredCalculateAfterPurchasePlanSync.value = false;
	shippingQuantityInputDrafts.value = {};
	shippingQuantityEditBeforeDrafts.value = {};
	// 重置生成相关状态（先保存结果再重置）
	const hasSuccess = generateProgress.value.results.some(r => r.success);
	isGenerating.value = false;
	generateProgress.value = { current: 0, total: 0, results: [] };
	generateResultVisible.value = false;
	remarkPreviewVisible.value = false;
	remarkPreviewData.value = null;
	coeffPanelVisible.value = false;
	coeffPanelItem.value = null;
	bulkSelectedKeys.value = [];
	bulkSettingsVisible.value = false;
	bulkSettingsApplying.value = false;
	dialogVisible.value = false;
	// 通知父组件刷新列表
	if (hasSuccess) emit('success');
	if (done) done();
};

// ========== 步骤 2 相关 ==========
const currentStep = ref(1);
const isGenerating = ref(false);
const warehouseLoading = ref(false);
const warehouseList = ref<WarehouseGroups>({
	local: [],
	overseas: [],
	awd: []
});

const hasWarehouseOptions = computed(() => {
	return warehouseList.value.local.length > 0
		|| warehouseList.value.overseas.length > 0
		|| warehouseList.value.awd.length > 0;
});

const getAllWarehouses = () => {
	return [
		...warehouseList.value.local,
		...warehouseList.value.overseas,
		...warehouseList.value.awd
	];
};

const normalizeWarehouseWid = (value: any) => {
	const num = Number(value);
	return Number.isFinite(num) && num > 0 ? num : 0;
};

const getItemWarehouseWid = (item: any) => {
	const raw = item?._purchaseWarehouseWid !== undefined
		? item._purchaseWarehouseWid
		: (item?.warehouse_wid ?? item?.wid);
	return normalizeWarehouseWid(raw);
};

const getWarehouseName = (wid: any) => {
	const normalized = normalizeWarehouseWid(wid);
	if (!normalized) return "";
	return getAllWarehouses().find(warehouse => Number(warehouse.wid) === normalized)?.name || "";
};

const itemCardRefs = new Map<string, HTMLElement>();

const getItemValidationKey = (item: any) => {
	return String(item?._batchId || item?.id || item?.listing_id || `${item?.asin || ""}_${item?.msku || ""}_${item?.store_id || ""}`);
};

const setItemCardRef = (item: any, el: Element | null) => {
	const key = getItemValidationKey(item);
	if (!key) return;
	if (el) {
		itemCardRefs.set(key, el as HTMLElement);
		return;
	}
	itemCardRefs.delete(key);
};

const isItemWarehouseMissing = (item: any) => {
	return Boolean(item?._warehouseValidationError && !getItemWarehouseWid(item));
};

const getItemCompactIdentifier = (item: any) => {
	const target = item?._targetListing || item || {};
	const asin = target.asin || item?.asin || "-";
	const sku = target.msku || target.local_sku || item?.msku || item?.local_sku || "-";
	const shop = target.seller_name || target.shop || item?.seller_name || item?.shop || item?.marketplace || "";
	return [asin, sku, shop].filter(Boolean).join(" / ");
};

const scrollToItemForValidation = (item: any) => {
	void nextTick(() => {
		const el = itemCardRefs.get(getItemValidationKey(item));
		el?.scrollIntoView({ behavior: "smooth", block: "center" });
	});
};

const markMissingWarehouseItems = (missingItems: any[]) => {
	const missingKeys = new Set(missingItems.map(getItemValidationKey));
	props.items.forEach(item => {
		item._warehouseValidationError = missingKeys.has(getItemValidationKey(item));
	});
	if (missingItems[0]) {
		scrollToItemForValidation(missingItems[0]);
	}
};

const clearWarehouseValidation = (item?: any) => {
	if (item) {
		item._warehouseValidationError = false;
		return;
	}
	props.items.forEach(row => {
		row._warehouseValidationError = false;
	});
};

const showMissingWarehouseMessage = (missingItems: any[], actionText: string) => {
	const firstText = getItemCompactIdentifier(missingItems[0]);
	const prefix = missingItems.length > 1
		? `${missingItems.length} 个产品未选择采购仓库`
		: "1 个产品未选择采购仓库";
	ElMessage.error(`${prefix}，已定位到第一个：${firstText}，${actionText}`);
};

const fetchWarehouseList = async () => {
	if (hasWarehouseOptions.value || warehouseLoading.value) return;
	warehouseLoading.value = true;
	try {
		const res = await (service.app.bsr_purchase_order_sync_lingxing as any).getWarehouseList();
		warehouseList.value = {
			local: Array.isArray(res?.local) ? res.local : [],
			overseas: Array.isArray(res?.overseas) ? res.overseas : [],
			awd: Array.isArray(res?.awd) ? res.awd : []
		};
		if (!hasWarehouseOptions.value) {
			ElMessage.warning("未获取到可用采购仓库，请检查领星仓库接口");
		}
	} catch (error) {
		console.error("获取采购仓库列表失败:", error);
		ElMessage.error("获取采购仓库列表失败，请稍后重试");
	} finally {
		warehouseLoading.value = false;
	}
};

const onItemWarehouseChange = (item: any, value: any) => {
	item._purchaseWarehouseWid = normalizeWarehouseWid(value) || "";
	if (getItemWarehouseWid(item)) clearWarehouseValidation(item);
};

const getStep2MissingWarehouseItems = (items = step2Items.value) => {
	return items.filter(item => !getItemWarehouseWid(item));
};

const getStep2MissingWarehouseCount = () => {
	return getStep2MissingWarehouseItems().length;
};

const hasAnyCalculation = computed(() => {
	return props.items.some(item => !item._excluded && getItemFinalPurchaseQty(item) > 0);
});

const removeItem = (idx: number) => {
	const item = props.items[idx];
	const name = item.item_name || item.local_name || item.asin || '产品';
	props.items.splice(idx, 1);
	ElMessage.success(`已移除: ${name}`);
};

const toggleExclude = (item: any) => {
	item._excluded = !item._excluded;
};

// 步骤2 只显示有效产品（未排除 且 实际采购量 > 0）
const step2Items = computed(() => {
	return props.items.filter(item => !item._excluded && getItemFinalPurchaseQty(item) > 0);
});

const goToStep2 = async () => {
	// 初始化确认前依赖字段
	props.items.forEach(item => {
		if (item._manualCoefficient === undefined) item._manualCoefficient = 1.0;
		if (item._manualRemark === undefined) item._manualRemark = '';
		if (item._productPurchaseRemarkOriginal === undefined) {
			item._productPurchaseRemarkOriginal = normalizeProductPurchaseRemark(item.purchase_remark ?? item.product_purchase_remark);
		}
		if (item._productPurchaseRemark === undefined) item._productPurchaseRemark = item._productPurchaseRemarkOriginal;
		if (item._productPurchaseRemarkDirty === undefined) item._productPurchaseRemarkDirty = false;
		if (item._purchaseWarehouseWid === undefined) item._purchaseWarehouseWid = normalizeWarehouseWid(item.warehouse_wid || item.wid) || "";
		if (getItemWarehouseWid(item)) item._warehouseValidationError = false;
	});

	await fetchWarehouseList();
	if (!hasWarehouseOptions.value) {
		ElMessage.error("未获取到可用采购仓库，不能进入预览");
		return;
	}

	const missingWarehouseItems = getStep2MissingWarehouseItems(step2Items.value);
	if (missingWarehouseItems.length > 0) {
		markMissingWarehouseItems(missingWarehouseItems);
		showMissingWarehouseMessage(missingWarehouseItems, "不能进入预览");
		return;
	}

	clearWarehouseValidation();

	// 先加载日历系数，防止确认页使用降级值闪烁
	await loadCalendarDataForItems();
	currentStep.value = 2;
};

const getMethodColor = (key: string): string => {
	const method = shippingMethods.find(m => m.key === key);
	return method?.color || '#909399';
};

const getMethodLabel = (key: string): string => {
	const method = shippingMethods.find(m => m.key === key);
	return method?.label || key;
};

const getStep2TotalItems = () => {
	return step2Items.value.length;
};

const getStep2SystemTotal = () => {
	return step2Items.value.reduce((sum, item) => sum + getItemTotalGap(item), 0);
};

const getStep2ActualPurchaseTotal = () => {
	return step2Items.value.reduce((sum, item) => sum + getItemActualPurchaseQty(item), 0);
};

const getStep2ActualPurchaseFormula = () => {
	const baseTotal = step2Items.value.reduce((sum, item) => sum + getItemActualPurchaseBaseQty(item), 0);
	const actualTotal = getStep2ActualPurchaseTotal();
	const overCoveredTotal = step2Items.value.reduce((sum, item) => {
		return sum + Math.max(0, -getItemActualPurchaseRawQty(item));
	}, 0);
	const lines = [
		'<div class="qty-tooltip-block">',
		'<div class="qty-tooltip-section">汇总口径</div>',
		`<div>基础采购量合计：${baseTotal}</div>`,
		`<div>实际采购量合计：<strong>${actualTotal}</strong></div>`
	];
	if (overCoveredTotal > 0) {
		lines.push(`<div>超额覆盖合计：${overCoveredTotal}</div>`);
	}
	lines.push('</div>');
	return lines.join('');
};

const getStep2BoxAdjustedPurchaseTotal = () => {
	return step2Items.value.reduce((sum, item) => sum + getItemFinalPurchaseQty(item), 0);
};

const getStep2BoxAdjustmentDelta = () => {
	return getStep2BoxAdjustedPurchaseTotal() - getStep2ActualPurchaseTotal();
};

const getStep2MissingBoxPcsCount = () => {
	return step2Items.value.filter(item => getItemActualPurchaseQty(item) > 0 && !getBoxAdjustmentResult(item).hasValidBox).length;
};

const getStep2BoxAdjustedPurchaseFormula = () => {
	const originalTotal = getStep2ActualPurchaseTotal();
	const adjustedTotal = getStep2BoxAdjustedPurchaseTotal();
	const delta = adjustedTotal - originalTotal;
	const itemLines = step2Items.value.map(item => {
		const result = getBoxAdjustmentResult(item);
		const name = item.item_name || item.local_name || item.asin || item.msku || "产品";
		if (!result.hasValidBox) return `<div>${name}：未设置装箱数，保持 ${result.adjustedQty}</div>`;
		return `<div>${name}：${result.originalQty} → ${result.adjustedQty}（装箱数 ${result.boxPcs}，${formatSignedQty(result.delta)}）</div>`;
	});
	return [
		'<div class="qty-tooltip-block">',
		'<div class="qty-tooltip-section">汇总口径</div>',
		`<div>原实际采购量合计：${originalTotal}</div>`,
		`<div>按箱调整后合计：<strong>${adjustedTotal}</strong></div>`,
		`<div>装箱调整合计：${formatSignedQty(delta)}</div>`,
		'<div class="qty-tooltip-section">单品明细</div>',
		...(itemLines.length ? itemLines : ['<div>暂无产品</div>']),
		'</div>'
	].join('');
};

// 算法名称映射（与 ListingAnalysisCharts 保持一致）
const algoNameMap: Record<string, string> = {
	daily_avg: '日均单量',
	history: '历史销量',
	trend: '搜索词趋势',
	combined: '综合走势'
};

// ========== 日历系数数据（per-item） ==========
const calendarDataLoading = ref(false);

const getDialogCalendarMonthRange = () => ({
	startMonth: dayjs().subtract(1, 'month').format('YYYY-MM'),
	endMonth: dayjs().add(6, 'month').format('YYYY-MM')
});

// 加载每个产品的日历系数（右侧系数栏和 Step 2 备注预览共用）
async function loadCalendarDataForItems(targetItems?: any[]) {
	const items = (targetItems || step2Items.value)
		.filter(item => item && !item._excluded && !item._calendarData && !item._calendarDataLoading);
	if (items.length === 0) return;

	calendarDataLoading.value = true;
	const { startMonth, endMonth } = getDialogCalendarMonthRange();

	const tasks = items.map(async (item) => {
		item._calendarDataLoading = true;
		try {
			const res = await service.request({
				url: '/admin/app/analysis/getCalendarData',
				method: 'POST',
				data: {
					product_code: item.product_code || '',
					asin: item.asin,
					marketplace: item.marketplace,
					startMonth,
					endMonth,
					listing_id: item.id,
					msku: item.msku,
					store_id: item.store_id
				}
			});
			if (res) {
				item._calendarData = {
					base_month: res.base_month || '',
					base_sales_value: res.base_sales_value || 0,
					base_keyword_value: res.base_keyword_value || 0,
					calendar: res.calendar_data || {}
				};
			}
		} catch (e) {
			console.warn(`[日历系数] ${item.asin} 加载失败:`, e);
			item._calendarData = null;
		} finally {
			item._calendarDataLoading = false;
		}
	});
	await Promise.all(tasks);
	calendarDataLoading.value = false;
}

// 获取某产品某月的算法系数
function getItemMonthCoefficient(item: any, monthStr: string, algoId: number, alpha?: number): {
	coefficient: number;
	rawCoefficient: number;
	volatilityCoefficient: number;
	adjustedCoefficient: number;
	algoUsed: number;
	fallbackReason: string | null;
} {
	const volatilityCoefficient = getItemVolatilityCoefficient(item);
	const buildResult = (rawCoefficient: number, algoUsed: number, fallbackReason: string | null = null) => {
		const adjustedCoefficient = algoUsed === 1
			? 1
			: applyVolatilityToCoefficient(rawCoefficient, volatilityCoefficient);
		return {
			coefficient: adjustedCoefficient,
			rawCoefficient,
			volatilityCoefficient,
			adjustedCoefficient,
			algoUsed,
			fallbackReason
		};
	};
	// 算法1：日均单量，系数恒为1
	if (algoId === 1) return buildResult(1, 1, null);

	const cal = item._calendarData?.calendar?.[monthStr];
	if (!cal) return buildResult(1, 1, `${monthStr} 无日历数据，降级为日均`);

	if (algoId === 2) {
		// 历史销量
		if (cal.sales?.status === 'ok' && cal.sales.coefficient !== undefined) {
			return buildResult(Number(cal.sales.raw_coefficient ?? cal.sales.coefficient) || 1, 2, null);
		}
		return buildResult(1, 1, `${monthStr} 历史销量缺失，降级为日均`);
	}
	if (algoId === 3) {
		// 搜索词趋势
		if (cal.keywords?.status === 'ok' && cal.keywords.coefficient !== undefined) {
			return buildResult(Number(cal.keywords.raw_coefficient ?? cal.keywords.coefficient) || 1, 3, null);
		}
		return buildResult(1, 1, `${monthStr} 搜索词缺失，降级为日均`);
	}
	if (algoId === 4) {
		// 综合走势
		const combinedData = cal.combined;
		if (combinedData && combinedData.coefficient !== undefined) {
			let rawCoeff = getRawCombinedCoefficient(combinedData, alpha);
			// 如果有自定义 α，用子系数重算
			if (alpha !== undefined
				&& !isCombinedNoData(combinedData)
				&& combinedData.filled_sales_coefficient !== undefined
				&& combinedData.keyword_coefficient !== undefined) {
				rawCoeff = alpha * combinedData.filled_sales_coefficient
					+ (1 - alpha) * combinedData.keyword_coefficient;
			}
			return buildResult(rawCoeff, 4, null);
		}
		return buildResult(1, 1, `${monthStr} 综合走势数据缺失，降级为日均`);
	}
	return buildResult(1, 1, null);
}

// 将运输段按月拆分，填入真实系数
function splitShippingSegmentsByMonth(item: any) {
	const algoKey = item.replenishAlgo || globalAlgo.value;
	const algoId = mapAlgoToInt(algoKey);
	const dailyAvg = getCalcDailyAvgSales(item);
	
	let ranges: { key: string; startDate: string; endDate: string; days: number }[] = [];
	if (item.replenishDateRange && item.replenishDateRange.length === 2 && item.replenishDateRange[0] && item.replenishDateRange[1]) {
		ranges = computeItemSegments(item.replenishDateRange[0], item.replenishDateRange[1], item.inactiveMethods);
	} else {
		const globalRanges = computeShippingDateRanges();
		ranges = globalRanges.map(r => ({
			key: r.key,
			startDate: r.startDate,
			endDate: r.endDate || globalDateRange.value?.[1] || '',
			days: r.endDate ? r.days : (globalDateRange.value?.[1] ? dayjs(globalDateRange.value[1]).diff(dayjs(r.startDate), 'day') + 1 : 0)
		})).filter(r => r.endDate);
	}

	const result: any[] = [];

	for (const key of sortedSelectedMethods.value) {
		// 跳过该产品已禁用的运输方式
		if (item.inactiveMethods?.includes(key)) continue;
		const method = shippingMethods.find(m => m.key === key);
		const range = ranges.find(r => r.key === key);
		if (!method || !range || !range.endDate) continue;

		const segStart = dayjs(range.startDate);
		const segEnd = dayjs(range.endDate);
		let cursor = segStart;

		while (cursor.isSameOrBefore(segEnd, 'day')) {
			const monthEnd = cursor.endOf('month');
			const chunkEnd = monthEnd.isBefore(segEnd, 'day') ? monthEnd : segEnd;
			const chunkDays = chunkEnd.diff(cursor, 'day') + 1;
			const monthStr = cursor.format('YYYY-MM');

			// 优先级: 手填α > 模式对应α > 全局α
			const hasManualAlpha = item._calcResult?.[key]?._manualAlpha !== undefined && item._calcResult?.[key]?._manualAlpha !== null;
			let effectiveAlpha: number;
			if (hasManualAlpha) {
				effectiveAlpha = item._calcResult[key]._manualAlpha;
			} else {
				// 没有手填α，按模式从后端系数中取（未设置mode时默认system）
				const mode = item._calcResult?.[key]?._alphaMode || 'system';
				const mc = item._calcResult?.[key]?.monthlyCoefficients?.[monthStr];
				if (mc) {
					if (mode === 'user') effectiveAlpha = mc.user_alpha ?? mc.system_alpha ?? 0.7;
					else effectiveAlpha = mc.system_alpha ?? 0.7;
				} else {
					effectiveAlpha = 0.7;
				}
			}
			const coeffInfo = getItemMonthCoefficient(item, monthStr, algoId, effectiveAlpha);
			const roundedCoeff = Math.round(coeffInfo.coefficient * 100) / 100;
			const segDailyNeed = Math.round(dailyAvg * roundedCoeff * 100) / 100;
			const subtotal = Math.round(chunkDays * segDailyNeed);

			result.push({
				startDate: cursor.format('YYYY-MM-DD'),
				endDate: chunkEnd.format('YYYY-MM-DD'),
				days: chunkDays,
				coefficient: roundedCoeff,
				raw_coefficient: Math.round(coeffInfo.rawCoefficient * 1000000) / 1000000,
				volatility_coefficient: coeffInfo.volatilityCoefficient,
				adjusted_coefficient: roundedCoeff,
				dailyNeed: segDailyNeed,
				suggestedDaily: segDailyNeed,
				subtotal,
				algoUsed: coeffInfo.algoUsed,
				algo_used_name: algoNameMap[algoKey] || '日均单量',
				fallback_reason: coeffInfo.fallbackReason,
				shipping_method: key,
				shipping_label: method.label,
				// 综合走势α信息（供调试弹窗展示）
				...(algoId === 4 ? (() => {
					const mc = item._calcResult?.[key]?.monthlyCoefficients?.[monthStr];
					const mode = item._calcResult?.[key]?._alphaMode || 'system';
					return {
						alpha: mode === 'system' ? (mc?.system_alpha ?? null) : (mc?.user_alpha ?? mc?.system_alpha ?? null),
						alpha_source: mc?.alpha_source || null,
						alpha_reason_text: mc?.alpha_reason_text || null,
						alpha_mode: mode,
						sales_coeff: mc?.filled_sales_coefficient ?? null,
						search_coeff: mc?.keyword_coefficient ?? null
					};
				})() : {})
			});

			cursor = monthEnd.add(1, 'day');
		}
	}
	return result;
}

// 计算单个产品的5个月固定窗口
function calculate5MonthWindowForItem(item: any) {
	const dailyAvg = getCalcDailyAvgSales(item);
	const algoKey = item.replenishAlgo || globalAlgo.value;
	const algoId = mapAlgoToInt(algoKey);
	const coefficient = getItemManualCoefficient(item);

	if (dailyAvg === 0) {
		return { base_month: dayjs().format('YYYY-MM'), total_window_qty: 0, segments: [] };
	}

	const today = dayjs();
	const wStart = today.subtract(1, 'month').startOf('month');
	const wEnd = today.add(3, 'month').endOf('month');
	const segments: any[] = [];
	let total = 0;

	for (let m = wStart; m.isSameOrBefore(wEnd, 'month'); m = m.add(1, 'month')) {
		const daysInMonth = m.daysInMonth();
		const monthStr = m.format('YYYY-MM');
		// 优先级：后端 system_alpha > 0.7 fallback（5月窗口是全局预览，不区分段）
		let effectiveAlpha = 0.7;
		const firstCalcResult = Object.values(item._calcResult || {})[0] as any;
		if (firstCalcResult?.monthlyCoefficients?.[monthStr]) {
			const mc = firstCalcResult.monthlyCoefficients[monthStr];
			const mode = firstCalcResult._alphaMode || 'system';
			if (mode === 'user') effectiveAlpha = mc.user_alpha ?? mc.system_alpha ?? 0.7;
			else effectiveAlpha = mc.system_alpha ?? 0.7;
		} else {
			effectiveAlpha = 0.7;
		}
		const coeffInfo = getItemMonthCoefficient(item, monthStr, algoId, effectiveAlpha);
		const roundedCoeff = Math.round(coeffInfo.coefficient * 100) / 100;
		const dailyNeed = Math.round(dailyAvg * roundedCoeff * 100) / 100;
		const subtotal = Math.round(daysInMonth * dailyNeed);

		segments.push({
			month: monthStr,
			monthName: m.format('YYYY年M月'),
			days: daysInMonth,
			coefficient: roundedCoeff,
			raw_coefficient: Math.round(coeffInfo.rawCoefficient * 1000000) / 1000000,
			volatility_coefficient: coeffInfo.volatilityCoefficient,
			adjusted_coefficient: roundedCoeff,
			algoUsed: coeffInfo.algoUsed,
			algo_used_name: algoNameMap[algoKey] || '日均单量',
			fallback_reason: coeffInfo.fallbackReason,
			daily_sales: dailyNeed,
			subtotal
		});
		total += subtotal;
	}

	return {
		base_month: today.format('YYYY-MM'),
		total_window_qty: Math.round(total * coefficient),
		segments
	};
}

// ========== 领星备注预览（仅人工备注） ==========
function getItemFinalRemark(item: any): string {
	return String(item?._manualRemark || '').trim();
}

const buildPurchaseRemarkUpdatePayload = (item: any, target: any) => {
	return {
		enabled: true,
		product_id: target?.product_id || item?.product_id,
		sku: target?.local_sku || item?.local_sku,
		product_name: target?.item_name || target?.local_name || item?.item_name || item?.local_name || "",
		sku_identifier: target?.sku_identifier || target?.local_sku || item?.sku_identifier || item?.local_sku || "",
		original_purchase_remark: getProductPurchaseRemarkOriginal(item),
		purchase_remark: getProductPurchaseRemark(item)
	};
};

const buildFallbackPurchaseRemarkSync = (item: any, message = "未取得采购备注处理结果") => {
	return {
		enabled: true,
		changed: isProductPurchaseRemarkChanged(item),
		status: "client_error",
		message,
		before: getProductPurchaseRemarkOriginal(item),
		after: getProductPurchaseRemark(item),
		verified: false,
		rollback_status: "unknown"
	};
};

const getPurchaseRemarkSyncTagType = (sync: any) => {
	const status = sync?.status || "";
	if (["verified", "already_current"].includes(status)) return "success";
	if (["skipped", "disabled"].includes(status)) return "info";
	if (status === "rollback_success") return "warning";
	if (["failed", "verify_failed", "rollback_failed", "client_error"].includes(status)) return "danger";
	return "info";
};

const getPurchaseRemarkSyncStatusText = (sync: any) => {
	const status = sync?.status || "";
	const map: Record<string, string> = {
		disabled: "未启用",
		skipped: "未修改",
		already_current: "已是目标值",
		verified: "已验证",
		failed: "处理失败",
		verify_failed: "验证失败",
		rollback_success: "已回滚",
		rollback_failed: "回滚失败",
		client_error: "无结果"
	};
	return map[status] || "未知";
};

// ========== 调试预览 ==========
const remarkPreviewVisible = ref(false);
const remarkPreviewData = ref<any>(null);
const remarkPreviewItemName = ref('');

function previewItemRemark(item: any) {
	// Bug1: 日历系数未加载完成时禁止预览（会使用降级系数1）
	if (calendarDataLoading.value) {
		ElMessage.warning('日历系数正在加载，请稍候...');
		return;
	}
	remarkPreviewItemName.value = item.item_name || item.asin || '产品';
	remarkPreviewData.value = buildItemRemarkData(item);
	remarkPreviewVisible.value = true;
}

const getManualShippingQuantitiesSnapshot = (item: any) => {
	const manualMap = ensureManualShippingQuantities(item);
	const result: Record<string, any> = {};
	for (const methodKey of sortedSelectedMethods.value) {
		if (!Object.prototype.hasOwnProperty.call(manualMap, methodKey)) continue;
		result[methodKey] = {
			shipping_method: methodKey,
			shipping_label: getMethodLabel(methodKey),
			quantity: normalizeShippingQuantity(manualMap[methodKey]),
			active: !item.inactiveMethods?.includes(methodKey)
		};
	}
	return result;
};

const getShippingRedistributionEffectsSnapshot = (item: any) => {
	const effects = ensureShippingRedistributionEffects(item);
	const result: Record<string, any> = {};
	for (const methodKey of sortedSelectedMethods.value) {
		if (!Object.prototype.hasOwnProperty.call(effects, methodKey)) continue;
		result[methodKey] = {
			shipping_method: methodKey,
			shipping_label: getMethodLabel(methodKey),
			quantity: normalizeShippingQuantity(effects[methodKey]?.quantity),
			group_id: effects[methodKey]?.group_id || "",
			trigger_method: effects[methodKey]?.trigger_method || "",
			trigger_label: getMethodLabel(effects[methodKey]?.trigger_method),
			active: !item.inactiveMethods?.includes(methodKey)
		};
	}
	return result;
};

const getShippingAdjustmentLogSnapshot = (item: any) => {
	return Array.isArray(item?._shippingAdjustmentLog)
		? item._shippingAdjustmentLog.map((log: any) => ({ ...log }))
		: [];
};

const getShippingAdjustmentSummaryText = (item: any) => {
	const logs = getShippingAdjustmentLogSnapshot(item);
	if (logs.length === 0) return "";
	const last = logs[logs.length - 1];
	const modeLabel = last.mode_label || getShippingAdjustModeLabel(getShippingAdjustMode(item));
	const triggerText = `${last.trigger_label || last.trigger_method} ${last.from_qty}→${last.applied_qty}`;
	const adjustmentText = Array.isArray(last.adjustments) && last.adjustments.length > 0
		? `；联动 ${last.adjustments.map((adj: any) => `${adj.label || adj.method} ${adj.from_qty}→${adj.to_qty}`).join("，")}`
		: "";
	const totalText = `；总量 ${last.total_before}→${last.total_after}`;
	const clampedText = last.clamped ? "；已按可调配上限限制" : "";
	return `${modeLabel}：${triggerText}${adjustmentText}${totalText}${clampedText}`;
};

const getSegmentMonthlyCoefficientSnapshot = (item: any, methodKey: string) => {
	const calcResult = item._calcResult?.[methodKey];
	const monthly = calcResult?.monthlyCoefficients || {};
	const result: Record<string, any> = {};
	const algoId = mapAlgoToInt(item.replenishAlgo || globalAlgo.value);
	const mode = calcResult?._alphaMode || "system";
	const manualAlpha = calcResult?._manualAlpha;

	for (const [month, source] of Object.entries(monthly) as [string, any][]) {
		let rawCoefficient = 1;
		if (algoId === 2 || algoId === 3) {
			rawCoefficient = Number(source?.raw_coefficient ?? source?.coefficient ?? 1) || 1;
		} else if (algoId === 4) {
			const alpha = manualAlpha ?? (
				mode === "user"
					? (source?.user_alpha ?? source?.system_alpha ?? 0.7)
					: (source?.system_alpha ?? 0.7)
			);
			rawCoefficient = getRawCombinedCoefficient(source, alpha);
		}
		const volatilityCoefficient = getItemVolatilityCoefficient(item);
		const adjustedCoefficient = algoId === 1 ? 1 : applyVolatilityToCoefficient(rawCoefficient, volatilityCoefficient);
		result[month] = {
			...source,
			raw_coefficient: roundCoefficient(rawCoefficient),
			volatility_coefficient: volatilityCoefficient,
			adjusted_coefficient: roundCoefficient(adjustedCoefficient),
			coefficient: roundCoefficient(adjustedCoefficient),
			alpha_mode: mode,
			effective_alpha: algoId === 4
				? manualAlpha ?? (mode === "user" ? (source?.user_alpha ?? source?.system_alpha ?? 0.7) : (source?.system_alpha ?? 0.7))
				: undefined
		};
	}

	return Object.keys(result).length > 0 ? result : null;
};

// 构建与 ListingAnalysisCharts 完全兼容的 remark JSON
function buildItemRemarkData(item: any) {
	const dailyAvg = getCalcDailyAvgSales(item);
	const algoKey = item.replenishAlgo || globalAlgo.value;
	const algoId = mapAlgoToInt(algoKey);
	const algoName = algoNameMap[algoKey] || '日均单量';
	const coefficient = item._manualCoefficient || 1;
	const volatilityCoefficient = getItemVolatilityCoefficient(item);

	// 按月拆分运输段（用于记录算法理论值）
	const breakdown = splitShippingSegmentsByMonth(item);

	const algorithmSuggestedQty = getItemAlgorithmTotalGap(item);
	const systemSuggestedQty = getItemTotalGap(item);
	const manualAdjustDelta = systemSuggestedQty - algorithmSuggestedQty;
	const pendingDeliveryQty = getItemPendingDeliveryQty(item);
	const lingxingPendingDeliveryQty = getItemLingxingPendingDeliveryQty(item);
	const totalPurchasePlanQty = getItemPurchasePlanQty(item);
	const localPurchasePlanQty = getItemLocalPurchasePlanQty(item);
	const lingxingPurchasePlanQty = getItemLingxingPurchasePlanQty(item);
	const purchasePlanQty = localPurchasePlanQty;
	const purchasePlanDeductedQty = getItemPurchasePlanDeductedTotal(item);
	const purchasePlanExcessQty = getItemPurchasePlanExcessQty(item);
	const localPendingDeliveryDeductedQty = getItemLocalPendingDeliveryDeductedTotal(item);
	const localPendingDeliveryExcessQty = getItemLocalPendingDeliveryExcessQty(item);
	const afterPurchasePlanQty = getItemAfterPurchasePlanTotal(item);
	const afterLocalDeductionsQty = getItemAfterLocalDeductionsTotal(item);
	const lingxingFinalDeduction = getItemLingxingFinalDeductionSummary(item);
	const actualPurchaseRawQty = getItemActualPurchaseRawQty(item);
	const actualPurchaseBaseQty = getItemActualPurchaseBaseQty(item);
	const actualPurchaseQty = getItemActualPurchaseQty(item);
	const boxAdjustment = getBoxAdjustmentResult(item);
	const actualShippingTotal = getItemTotalShipping(item);
	const finalQty = getItemFinalPurchaseQty(item);
	const productPurchaseRemarkOriginal = getProductPurchaseRemarkOriginal(item);
	const productPurchaseRemark = getProductPurchaseRemark(item);
	const productPurchaseRemarkChanged = isProductPurchaseRemarkChanged(item);
	const warehouseWid = getItemWarehouseWid(item);
	const warehouseName = getWarehouseName(warehouseWid);
	const shippingAdjustMode = getShippingAdjustMode(item);
	const shippingAdjustmentLog = getShippingAdjustmentLogSnapshot(item);
	const shippingAdjustmentSummary = getShippingAdjustmentSummaryText(item);
	const actualShippingBreakdown = sortedSelectedMethods.value
		.filter(methodKey => !item.inactiveMethods?.includes(methodKey))
		.map(methodKey => {
			const method = shippingMethods.find(m => m.key === methodKey);
			return {
				shipping_method: methodKey,
				shipping_label: method?.label || methodKey,
				original_suggested_qty: getSegmentSuggestedQty(item, methodKey),
				purchase_plan_deducted_qty: getSegmentPurchasePlanDeductedQty(item, methodKey),
				local_pending_delivery_deducted_qty: getSegmentLocalPendingDeliveryDeductedQty(item, methodKey),
				actual_qty: Math.max(0, Math.round(Number(item.shippingQuantities?.[methodKey]) || 0))
			};
		});

	// 获取总日期范围
	const startDate = breakdown.length > 0 ? breakdown[0].startDate : (globalDateRange.value?.[0] || '');
	const endDate = breakdown.length > 0 ? breakdown[breakdown.length - 1].endDate : (globalDateRange.value?.[1] || '');
	const totalDays = startDate && endDate ? dayjs(endDate).diff(dayjs(startDate), 'day') + 1 : 0;
	const daily = totalDays > 0 ? (finalQty / totalDays).toFixed(1) : '0';

	// 生成 remark_text：使用用户实际填写的运输数量
	const segmentTexts: string[] = [];
	for (const methodKey of sortedSelectedMethods.value) {
		if (item.inactiveMethods?.includes(methodKey)) continue;
		const qty = item.shippingQuantities?.[methodKey] || 0;
		if (qty > 0) {
			const method = shippingMethods.find(m => m.key === methodKey);
			const label = method?.label || methodKey;
			const days = method?.days || 0;
			segmentTexts.push(`${label}${days}天${qty}件`);
		}
	}

	const startShort = startDate;
	const endShort = endDate?.substring(5) || endDate;
	const timeRange = `${startShort}至${endShort}(${totalDays}天)`;
	const baseDailyText = `基础日均${dailyAvg.toFixed(1)}`;
	const volatilityText = `波动系数${volatilityCoefficient.toFixed(2)}`;
	const manualCoeffText = `人工系数${coefficient.toFixed(1)}`;
	const boxAdjustText = boxAdjustment.hasValidBox
		? `装箱${boxAdjustment.boxPcs}，按箱调整${formatSignedQty(boxAdjustment.delta)}`
		: "未设置装箱数";
	const actualPurchaseText = `实际采购${finalQty}件`;
	const crossStoreText = item._targetListing
		? `跨店补货：数据来源 ${item.shop || item.seller_name || ''}(${item.asin})`
		: '';
	const remarkParts = [timeRange, baseDailyText, volatilityText, ...segmentTexts, actualPurchaseText, boxAdjustText, manualCoeffText];
	if (crossStoreText) remarkParts.push(crossStoreText);
	const remarkText = remarkParts.join(' | ');

	// 5个月窗口计算
	const windowCalc = calculate5MonthWindowForItem(item);

	const remarkData = {
		version: 6,
		remark_text: remarkText,

		summary: `采购 ${finalQty}个，销售时间 ${startDate} 至 ${endDate}，计划日均 ${daily}单`,
		formula: `${manualAdjustDelta === 0 ? "" : `原算法建议 ${algorithmSuggestedQty}，手动调整 ${manualAdjustDelta > 0 ? "+" : ""}${manualAdjustDelta}；`}当前系统建议 ${systemSuggestedQty} - 艾为采购计划抵扣 ${purchasePlanDeductedQty}${purchasePlanExcessQty > 0 ? `（超额覆盖 ${purchasePlanExcessQty}）` : ""} = 采购计划扣后分段 ${afterPurchasePlanQty}；采购计划扣后分段 ${afterPurchasePlanQty} - 艾为待交付抵扣 ${localPendingDeliveryDeductedQty}${localPendingDeliveryExcessQty > 0 ? `（超额覆盖 ${localPendingDeliveryExcessQty}）` : ""} = 艾为扣后分段 ${afterLocalDeductionsQty}；max(艾为扣后分段 ${afterLocalDeductionsQty} - 领星总抵扣（采购计划+待交付） ${lingxingFinalDeduction.deductedTotal}${lingxingFinalDeduction.excessQty > 0 ? `（超额覆盖 ${lingxingFinalDeduction.excessQty}）` : ""}, 0) = 基础采购量 ${actualPurchaseBaseQty}；基础采购量 (${actualPurchaseBaseQty}) × 人工系数 (${coefficient.toFixed(1)}) = 原实际采购量 (${actualPurchaseQty})；${boxAdjustment.hasValidBox ? `按装箱数 ${boxAdjustment.boxPcs} 就近取 ${boxAdjustment.boxes} 箱 = 实际采购量 (${finalQty})` : `未设置有效装箱数，实际采购量保持 ${finalQty}`}`,

		algorithm_suggested_qty: algorithmSuggestedQty,
		system_suggested_qty: systemSuggestedQty,
		manual_adjust_delta: manualAdjustDelta,
		pending_delivery_qty: pendingDeliveryQty,
		local_pending_delivery_qty: pendingDeliveryQty,
		lingxing_pending_delivery_qty: lingxingPendingDeliveryQty,
		purchase_plan_qty: purchasePlanQty,
		total_purchase_plan_qty: totalPurchasePlanQty,
		local_purchase_plan_qty: localPurchasePlanQty,
		lingxing_purchase_plan_qty: lingxingPurchasePlanQty,
		purchase_plan_deducted_qty: purchasePlanDeductedQty,
		purchase_plan_excess_qty: purchasePlanExcessQty,
		local_pending_delivery_deducted_qty: localPendingDeliveryDeductedQty,
		local_pending_delivery_excess_qty: localPendingDeliveryExcessQty,
		after_purchase_plan_qty: afterPurchasePlanQty,
		after_local_deductions_qty: afterLocalDeductionsQty,
		lingxing_final_deducted_qty: lingxingFinalDeduction.deductedTotal,
		lingxing_final_excess_qty: lingxingFinalDeduction.excessQty,
		actual_purchase_raw_qty: actualPurchaseRawQty,
		actual_purchase_base_qty: actualPurchaseBaseQty,
		actual_purchase_qty_before_box: actualPurchaseQty,
		actual_purchase_qty: finalQty,
		box_pcs: boxAdjustment.hasValidBox ? boxAdjustment.boxPcs : null,
		box_count: boxAdjustment.hasValidBox ? boxAdjustment.boxes : null,
		box_adjusted_purchase_qty: boxAdjustment.adjustedQty,
		box_adjustment_delta: boxAdjustment.delta,
		box_adjustment_formula: getBoxAdjustmentSummary(item),
		actual_shipping_total: actualShippingTotal,
		actual_shipping_breakdown: actualShippingBreakdown,
		shipping_adjust_mode: shippingAdjustMode,
		shipping_adjust_mode_label: getShippingAdjustModeLabel(shippingAdjustMode),
		manual_shipping_quantities: getManualShippingQuantitiesSnapshot(item),
		shipping_redistribution_effects: getShippingRedistributionEffectsSnapshot(item),
		shipping_adjustment_log: shippingAdjustmentLog,
		shipping_adjustment_summary: shippingAdjustmentSummary,
		product_purchase_remark_original: productPurchaseRemarkOriginal,
		product_purchase_remark: productPurchaseRemark,
		product_purchase_remark_changed: productPurchaseRemarkChanged,
		warehouse_wid: warehouseWid || null,
		warehouse_name: warehouseName,
		artificial_coefficient: coefficient,
		volatility_coefficient: volatilityCoefficient,
		final_replenishment_qty: finalQty,

		base_daily_avg_sales: dailyAvg,
		user_selected_algo_id: algoId,
		user_selected_algo_name: algoName,
		custom_alpha: (() => {
			// 取第一个有效段的实际α（手填 > 模式 > 后端默认），保证返回number
			const methods = sortedSelectedMethods.value;
			for (const mk of methods) {
				const cr = item._calcResult?.[mk];
				if (cr?._manualAlpha !== undefined && cr?._manualAlpha !== null) return cr._manualAlpha;
				const mode = cr?._alphaMode || 'system';
				const mcs = cr?.monthlyCoefficients;
				if (mcs) {
					const months = Object.keys(mcs);
					if (months.length > 0) {
						const mc = mcs[months[0]];
						if (mode === 'user') return mc?.user_alpha ?? mc?.system_alpha ?? 0.7;
						return mc?.system_alpha ?? 0.7;
					}
				}
			}
			return 0.7;
		})(),

		// 各运输段各月完整α记录，用于历史复盘（custom_alpha只是代表值）
		alpha_by_method: (() => {
			if (algoId !== 4) return undefined; // 只有综合走势才有α
			const result: Record<string, Record<string, number>> = {};
			for (const mk of sortedSelectedMethods.value) {
				if (item.inactiveMethods?.includes(mk)) continue;
				const cr = item._calcResult?.[mk];
				if (!cr?.monthlyCoefficients) continue;
				const mode = cr._alphaMode || 'system';
				const monthMap: Record<string, number> = {};
				for (const [month, mc] of Object.entries(cr.monthlyCoefficients) as [string, any][]) {
					if (cr._manualAlpha !== undefined && cr._manualAlpha !== null) {
						monthMap[month] = cr._manualAlpha;
					} else if (mode === 'user') {
						monthMap[month] = mc?.user_alpha ?? mc?.system_alpha ?? 0.7;
					} else {
						monthMap[month] = mc?.system_alpha ?? 0.7;
					}
				}
				if (Object.keys(monthMap).length > 0) result[mk] = monthMap;
			}
			return Object.keys(result).length > 0 ? result : undefined;
		})(),

		start_date: startDate,
		end_date: endDate,
		total_days: totalDays,

		manualCoefficient: coefficient,
		systemQty: systemSuggestedQty,
		actualPurchaseQty: finalQty,
		actualPurchaseQtyBeforeBox: actualPurchaseQty,
		boxAdjustedPurchaseQty: boxAdjustment.adjustedQty,
		finalQty: finalQty,

		breakdown: breakdown,

		window_calculation: windowCalc,

		// 跨店补货信息
		...(item._targetListing ? {
			cross_store: true,
			source_store_id: item.store_id,
			source_asin: item.asin,
			source_shop: item.shop || item.seller_name || '',
			target_store_id: item._targetListing.store_id,
			target_asin: item._targetListing.asin,
			target_shop: item._targetListing.seller_name || item._targetListing.shop || '',
		} : {})
	};

	return remarkData;
}

const toSnapshotJson = (value: any) => {
	if (value === undefined) return null;
	try {
		return JSON.parse(JSON.stringify(value ?? null));
	} catch (error: any) {
		return {
			_snapshot_error: "JSON序列化失败",
			message: error?.message || String(error)
		};
	}
};

const getSnapshotMethodRows = (item: any) => {
	return sortedSelectedMethods.value.map(methodKey => {
		const method = shippingMethods.find(m => m.key === methodKey);
		const calcResult = item._calcResult?.[methodKey] || {};
		const active = !item.inactiveMethods?.includes(methodKey);
		return {
			method_key: methodKey,
			method_label: method?.label || methodKey,
			icon: method?.icon || "",
			color: method?.color || "",
			days_to_arrive: method?.days || 0,
			active,
			start_date: calcResult.startDate || null,
			end_date: calcResult.endDate || null,
			period_label: calcResult.startDate && calcResult.endDate ? getSegmentUsagePeriod(item, methodKey) : "",
			period_days: calcResult.startDate && calcResult.endDate
				? getSegmentMonthBreakdown(calcResult.startDate, calcResult.endDate).reduce((sum, row) => sum + row.days, 0)
				: 0,
			manual_alpha: calcResult._manualAlpha ?? null,
			alpha_mode: calcResult._alphaMode || "system",
			alpha_tooltip: toSnapshotJson(getAlphaTooltipData(item, methodKey)),
			system_suggested_qty: getSegmentSuggestedQty(item, methodKey),
			purchase_plan_deducted_qty: getSegmentPurchasePlanDeductedQty(item, methodKey),
			after_purchase_plan_qty: getSegmentAfterPurchasePlanQty(item, methodKey),
			local_pending_delivery_deducted_qty: getSegmentLocalPendingDeliveryDeductedQty(item, methodKey),
			after_local_deductions_qty: getSegmentAfterLocalDeductionsQty(item, methodKey),
			final_qty: active ? normalizeShippingQuantity(item.shippingQuantities?.[methodKey]) : 0,
			is_manual: hasManualShippingQuantity(item, methodKey),
			is_redistributed: hasShippingRedistributionEffect(item, methodKey),
			manual_snapshot: toSnapshotJson(ensureManualShippingQuantities(item)?.[methodKey] ?? null),
			redistribution_effect: toSnapshotJson(getShippingRedistributionEffect(item, methodKey)),
			shortage_label: getSegmentShortageLabel(item, methodKey),
			shortage_ranges: toSnapshotJson(getSegmentShortageRanges(item, methodKey)),
			shortage_formula_rows: toSnapshotJson(getSegmentShortageRanges(item, methodKey).map((range: any) => ({
				...range,
				formula: getShortageRangeFormula(range)
			}))),
			expected_demand: calcResult.expectedDemand || 0,
			covered_qty: getSegmentCoveredQty(item, methodKey),
			arrival_qty: getSegmentArrivalQty(item, methodKey),
			inbound_usage_qty: getSegmentInboundUsageQty(item, methodKey),
			final_covered: shouldShowSegmentFinalCovered(item, methodKey),
			final_covered_text: shouldShowSegmentFinalCovered(item, methodKey) ? getSegmentFinalCoveredText(item, methodKey) : "",
			demand_breakdown: toSnapshotJson(getSegmentDemandBreakdown(item, methodKey)),
			monthly_coefficients: toSnapshotJson(getSegmentMonthlyCoefficientSnapshot(item, methodKey)),
			inventory_usage: toSnapshotJson(calcResult.inventoryUsage || null),
			inventory_usage_summary: toSnapshotJson(getSegmentInventoryUsageSummary(item, methodKey)),
			inventory_usage_formula: hasSegmentInventoryUsage(item, methodKey)
				? getSegmentInventoryUsageFormulaText(item, methodKey)
				: "",
			inventory_usage_sources: toSnapshotJson(getSegmentUsageSources(item, methodKey)),
			pre_arrival_shortage: toSnapshotJson(calcResult.preArrivalShortage || null),
			raw_calc_result: toSnapshotJson(calcResult)
		};
	});
};

const buildBatchReplenishSnapshot = (
	item: any,
	remarkData: any,
	target: any,
	warehouse: { wid: any; name: any }
) => {
	const algoKey = item.replenishAlgo || globalAlgo.value;
	const algoName = algoNameMap[algoKey] || "日均单量";
	const shippingAdjustMode = getShippingAdjustMode(item);
	const shippingRows = getSnapshotMethodRows(item);
	const activeShippingRows = shippingRows.filter(row => row.active);
	const boxAdjustment = getBoxAdjustmentResult(item);
	const formulaParts = getFormulaSystemParts(item);
	const targetStockDays = getPreviewTargetStockDays(item);
	const volatilityCoefficient = getItemVolatilityCoefficient(item);
	const identity = {
		store_id: target?.store_id ?? item.store_id ?? null,
		asin: target?.asin ?? item.asin ?? "",
		msku: target?.msku ?? item.msku ?? "",
		marketplace: target?.marketplace || item.marketplace || "",
		product_code: item.product_code || "",
		local_sku: target?.local_sku || item.local_sku || "",
		listing_id: target?.id || target?.listing_id || item.listing_id || item.id || null,
		source_store_id: item.store_id ?? null,
		source_asin: item.asin || "",
		source_msku: item.msku || "",
		source_local_sku: item.local_sku || ""
	};
	const quickFields = {
		store_id: identity.store_id,
		asin: identity.asin,
		msku: identity.msku,
		marketplace: identity.marketplace,
		product_code: identity.product_code,
		local_sku: identity.local_sku,
		algorithm_key: algoKey,
		algorithm_name: algoName,
		cycle_start_date: remarkData.start_date,
		cycle_end_date: remarkData.end_date,
		daily_avg_sales: remarkData.base_daily_avg_sales,
		target_stock_days: targetStockDays || null,
		volatility_coefficient: volatilityCoefficient,
		system_suggested_qty: remarkData.system_suggested_qty,
		actual_purchase_qty: remarkData.actual_purchase_qty_before_box,
		final_purchase_qty: remarkData.final_replenishment_qty,
		warehouse_wid: warehouse.wid || null,
		warehouse_name: warehouse.name || "",
		adjust_mode: shippingAdjustMode,
		box_pcs: remarkData.box_pcs
	};
	const summaryJson = {
		remark_text: remarkData.remark_text,
		summary: remarkData.summary,
		formula: remarkData.formula,
		system_suggested_qty: remarkData.system_suggested_qty,
		actual_purchase_qty_before_box: remarkData.actual_purchase_qty_before_box,
		final_purchase_qty: remarkData.final_replenishment_qty,
		actual_shipping_total: remarkData.actual_shipping_total,
		active_shipping_count: activeShippingRows.length
	};
	const inputJson = {
		identity,
		product: {
			item_name: item.item_name || item.local_name || "",
			image_url: item.image_url_display || item.image_url || "",
			shop: item.shop || item.seller_name || "",
			fnsku: target?.fnsku || item.fnsku || "",
			cross_store: Boolean(item._targetListing),
			target_listing: toSnapshotJson(item._targetListing || null)
		},
		algorithm: {
			key: algoKey,
			id: remarkData.user_selected_algo_id,
			name: algoName
		},
		period: {
			global_range: toSnapshotJson(globalDateRange.value),
			item_range: toSnapshotJson(item.replenishDateRange),
			start_date: remarkData.start_date,
			end_date: remarkData.end_date,
			total_days: remarkData.total_days
		},
		daily_avg_sales: remarkData.base_daily_avg_sales,
		target_stock_days: targetStockDays || null,
		volatility_coefficient: volatilityCoefficient,
		warehouse: {
			wid: warehouse.wid || null,
			name: warehouse.name || ""
		},
		shipping_profile: {
			profile_key: globalShippingProfile.value,
			profile_label: currentShippingProfile.value.label,
			buffer_days: shippingBuffer.value,
			selected_methods: toSnapshotJson(sortedSelectedMethods.value),
			inactive_methods: toSnapshotJson(item.inactiveMethods || []),
			methods: toSnapshotJson(shippingMethods.map(method => ({
				...method,
				active: sortedSelectedMethods.value.includes(method.key) && !item.inactiveMethods?.includes(method.key)
			}))),
			pref_record_id: item._shippingMethodPrefsRecordId || null
		}
	};
	const calculationJson = {
		cycle: {
			start_date: remarkData.start_date,
			end_date: remarkData.end_date,
			total_days: remarkData.total_days,
			demand_qty: formulaParts.demandQty,
			detail_html: getFormulaCycleDemandDetail(item),
			breakdown: toSnapshotJson(remarkData.breakdown)
		},
		system_suggested_qty: remarkData.system_suggested_qty,
		system_formula_text: getFormulaSystemText(item),
		system_formula_html: getFormulaSystemDetail(item),
		actual_purchase_qty_before_box: remarkData.actual_purchase_qty_before_box,
		actual_purchase_formula_text: getFormulaActualPurchaseText(item),
		actual_purchase_formula_html: getItemActualPurchaseFormula(item),
		final_purchase_qty: remarkData.final_replenishment_qty,
		manual_coefficient: remarkData.artificial_coefficient,
		deductions: {
			purchase_plan_qty: remarkData.purchase_plan_qty,
			total_purchase_plan_qty: remarkData.total_purchase_plan_qty,
			local_purchase_plan_qty: remarkData.local_purchase_plan_qty,
			lingxing_purchase_plan_qty: remarkData.lingxing_purchase_plan_qty,
			purchase_plan_deducted_qty: remarkData.purchase_plan_deducted_qty,
			local_pending_delivery_qty: remarkData.local_pending_delivery_qty,
			lingxing_pending_delivery_qty: remarkData.lingxing_pending_delivery_qty,
			local_pending_delivery_deducted_qty: remarkData.local_pending_delivery_deducted_qty,
			lingxing_final_deducted_qty: remarkData.lingxing_final_deducted_qty
		},
		box_adjustment: {
			box_pcs: remarkData.box_pcs,
			box_count: remarkData.box_count,
			adjusted_qty: remarkData.box_adjusted_purchase_qty,
			delta: remarkData.box_adjustment_delta,
			summary: getBoxAdjustmentSummary(item),
			formula_html: getBoxAdjustmentFormula(item),
			raw_result: toSnapshotJson(boxAdjustment)
		}
	};
	const shippingJson = {
		total_qty: remarkData.actual_shipping_total,
		actual_shipping_breakdown: toSnapshotJson(remarkData.actual_shipping_breakdown),
		segments: toSnapshotJson(shippingRows)
	};
	const adjustmentJson = {
		mode: shippingAdjustMode,
		mode_label: getShippingAdjustModeLabel(shippingAdjustMode),
		mode_source: item._shippingAdjustModeTouched ? "user" : "default",
		user_changed_mode: Boolean(item._shippingAdjustModeTouched),
		manual_quantities: toSnapshotJson(getManualShippingQuantitiesSnapshot(item)),
		redistribution_effects: toSnapshotJson(getShippingRedistributionEffectsSnapshot(item)),
		adjustment_groups: toSnapshotJson(item._shippingAdjustmentGroups || {}),
		adjustment_log: toSnapshotJson(getShippingAdjustmentLogSnapshot(item)),
		adjustment_summary: getShippingAdjustmentSummaryText(item)
	};
	const coefficientJson = {
		manual_coefficient: remarkData.artificial_coefficient,
		volatility_coefficient: volatilityCoefficient,
		volatility_formula: "(原始系数 - 1) × 波动系数 + 1",
		custom_alpha: remarkData.custom_alpha,
		alpha_by_method: toSnapshotJson(remarkData.alpha_by_method || null),
		window_calculation: toSnapshotJson(remarkData.window_calculation),
		five_month_rows: toSnapshotJson(isCombinedAlgo(item) ? getFiveMonthCombinedRows(item) : getFiveMonthSimpleRows(item)),
		segment_alpha_details: toSnapshotJson(Object.fromEntries(
			sortedSelectedMethods.value.map(methodKey => [methodKey, getAlphaTooltipData(item, methodKey)])
		))
	};
	const inventoryJson = {
		fba_valid: getFbaInventoryQuantity(item),
		fba_reserved: getFbaReservedQuantity(item),
		fba_valid_list: toSnapshotJson(filterByRowMsku(item.restocking?.fbaValidList, item)),
		inbound_qty: getRestockingFbaShippingQuantity(item),
		fba_shipping_list: toSnapshotJson(filterByRowMsku(item.restocking?.fbaShippingList, item)),
		local_valid: item.restocking_local_valid ?? 0,
		local_valid_detail_list: toSnapshotJson(filterByRowMsku(item.restocking?.extInfo?.localValidDetailList, item, "sku")),
		local_purchase_plan: {
			total: getItemLocalPurchasePlanQty(item),
			details: toSnapshotJson(getLocalPurchasePlanDetails(item))
		},
		local_pending_delivery: {
			total: getItemPendingDeliveryQty(item),
			details: toSnapshotJson(item.pending_delivery_details || [])
		},
		lingxing_purchase_plan: {
			total: getItemLingxingPurchasePlanQty(item),
			details: toSnapshotJson(getLingxingPurchasePlanDetails(item))
		},
		lingxing_pending_delivery: {
			total: getItemLingxingPendingDeliveryQty(item),
			details: toSnapshotJson(getLingxingPendingDeliveryDetails(item))
		},
		pre_arrival_shortage: toSnapshotJson(activeShippingRows.find(row => row.pre_arrival_shortage)?.pre_arrival_shortage || null),
		segment_inventory_usage: toSnapshotJson(Object.fromEntries(
			shippingRows.map(row => [row.method_key, row.inventory_usage])
		))
	};
	const remarkJson = {
		manual_replenish_remark: item._manualRemark || "",
		product_purchase_remark: {
			before: getProductPurchaseRemarkOriginal(item),
			after: getProductPurchaseRemark(item),
			changed: isProductPurchaseRemarkChanged(item)
		},
		generated_remark_text: remarkData.remark_text,
		legacy_remark_data: toSnapshotJson(remarkData)
	};
	const uiSnapshotJson = {
		daily_sales_tooltip: toSnapshotJson(getDailySalesTooltipData(item)),
		cycle_demand_detail_html: getFormulaCycleDemandDetail(item),
		system_formula_detail_html: getFormulaSystemDetail(item),
		actual_purchase_formula_html: getItemActualPurchaseFormula(item),
		box_adjustment_formula_html: getBoxAdjustmentFormula(item),
		system_formula_text: getFormulaSystemText(item),
		actual_purchase_formula_text: getFormulaActualPurchaseText(item),
		algo_panel_title: getAlgoPanelTitle(item),
		segment_cards: toSnapshotJson(shippingRows.map(row => ({
			method_key: row.method_key,
			method_label: row.method_label,
			active: row.active,
			date_range: `${row.start_date || ""}~${row.end_date || ""}`,
			final_qty: row.final_qty,
			system_suggested_qty: row.system_suggested_qty,
			shortage_label: row.shortage_label,
			inventory_usage_formula: row.inventory_usage_formula
		})))
	};
	const snapshot = {
		snapshot_version: 1,
		snapshot_source: "batch_replenish",
		created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
		identity,
		quick_fields: quickFields,
		summary_json: summaryJson,
		input_json: inputJson,
		calculation_json: calculationJson,
		shipping_json: shippingJson,
		adjustment_json: adjustmentJson,
		coefficient_json: coefficientJson,
		inventory_json: inventoryJson,
		remark_json: remarkJson,
		ui_snapshot_json: uiSnapshotJson
	};
	return {
		...snapshot,
		full_snapshot_json: toSnapshotJson({
			...snapshot,
			raw_calc_result_by_method: Object.fromEntries(
				sortedSelectedMethods.value.map(methodKey => [methodKey, item._calcResult?.[methodKey] || null])
			),
			raw_shipping_quantities: item.shippingQuantities || {},
			raw_manual_state: {
				manual_shipping_quantities: item._manualShippingQuantities || {},
				manual_shipping_groups: item._manualShippingGroups || {},
				shipping_redistribution_effects: item._shippingRedistributionEffects || {},
				shipping_adjustment_groups: item._shippingAdjustmentGroups || {}
			}
		})
	};
};

// 生成中状态
const generateProgress = ref({ current: 0, total: 0, results: [] as any[] });
const generateResultVisible = ref(false);

const generateOrders = async () => {
	if (props.purchasePlanSyncing) {
		ElMessage.warning('采购计划/待交付数据正在刷新，请稍候再生成');
		return;
	}

	let validItems = step2Items.value;
	if (validItems.length === 0) {
		ElMessage.warning('没有可生成的产品');
		return;
	}

	// Bug1: 等待日历系数加载完成
	if (calendarDataLoading.value) {
		ElMessage.warning('日历系数正在加载，请稍候...');
		return;
	}

	// 先过滤实际采购量为0的产品（人工系数可能把量压成0）
	const zeroQtyItems = validItems.filter(item => {
		return getItemFinalPurchaseQty(item) <= 0;
	});
	if (zeroQtyItems.length > 0) {
		const names = zeroQtyItems.map(i => i.item_name || i.asin || '未知').join('、');
		ElMessage.warning(`以下产品实际采购量为0，已自动跳过：${names}`);
		validItems = validItems.filter(item => {
			return getItemFinalPurchaseQty(item) > 0;
		});
		if (validItems.length === 0) {
			ElMessage.warning('所有产品实际采购量均为0，无法生成');
			return;
		}
	}

	// 再校验 local_sku（在过滤0数量后，避免0数量缺SKU的项阻断整批）
	const missingSkuItems = validItems.filter(item => {
		const t = item._targetListing || item;
		return !t.local_sku;
	});
	if (missingSkuItems.length > 0) {
		const names = missingSkuItems.map(i => i.item_name || i.asin || '未知').join('、');
		ElMessage.error(`以下产品缺少本地SKU，无法生成：${names}`);
		return;
	}

	const missingWarehouseItems = getStep2MissingWarehouseItems(validItems);
	if (missingWarehouseItems.length > 0) {
		currentStep.value = 1;
		markMissingWarehouseItems(missingWarehouseItems);
		showMissingWarehouseMessage(missingWarehouseItems, "无法生成单据");
		return;
	}

	// 二次确认
	try {
		await ElMessageBox.confirm(
			`即将为 ${validItems.length} 个产品创建采购计划。原实际采购量合计 ${getStep2ActualPurchaseTotal()}，按箱调整后合计 ${getStep2BoxAdjustedPurchaseTotal()}，装箱调整 ${formatSignedQty(getStep2BoxAdjustmentDelta())}。确认继续？`,
			'确认生成',
			{ confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
		);
	} catch {
		return; // 用户取消
	}

	isGenerating.value = true;
	generateProgress.value = { current: 0, total: validItems.length, results: [] };

	for (let i = 0; i < validItems.length; i++) {
		const item = validItems[i];
		generateProgress.value.current = i + 1;

		const remarkData = buildItemRemarkData(item);
		// 使用 remarkData 的值，确保与 breakdown 计算一致
		const finalQty = remarkData.final_replenishment_qty;

		try {
			// 跨店补货：使用目标 listing 的 sku/store_id/asin/msku
			const target = item._targetListing || item;
			const warehouseWid = getItemWarehouseWid(item);
			const warehouseName = getWarehouseName(warehouseWid);
			const batchReplenishSnapshot = buildBatchReplenishSnapshot(item, remarkData, target, {
				wid: warehouseWid,
				name: warehouseName
			});
			const result = await (service.app.bsr_purchase_plan_lingxing as any).createPurchasePlan({
				sku: target.local_sku,
				quantity_plan: finalQty,
				wid: warehouseWid,
				require_wid: true,
				manual_remark: item._manualRemark || undefined,
				return_structured_failure: true,
				purchase_remark_update: buildPurchaseRemarkUpdatePayload(item, target),
				analysis_data: {
					store_id: target.store_id,
					asin: target.asin,
					marketplace: target.marketplace || item.marketplace,
					msku: target.msku,
					local_sku: target.local_sku,
					product_code: item.product_code,
					fnsku: target.fnsku,
					expected_sales: {
						...remarkData,
						totalQty: remarkData.final_replenishment_qty,
						startDate: remarkData.start_date,
						endDate: remarkData.end_date,
						days: remarkData.total_days,
						dailyAvg: remarkData.base_daily_avg_sales,
						userSelectedAlgo: remarkData.user_selected_algo_id,
						warehouse_wid: warehouseWid,
						warehouse_name: warehouseName
					},
					remark: JSON.stringify(remarkData),
					manual_remark: item._manualRemark || '',
					batch_replenish_snapshot: batchReplenishSnapshot
				}
			});

			const snapshotSaveResult = result?.batch_replenish_snapshot;
			const snapshotWarning = snapshotSaveResult?.saved === false && !snapshotSaveResult?.skipped
				? `；${snapshotSaveResult.message || "批量补货快照保存失败"}`
				: "";

			if (result?.success === false) {
				generateProgress.value.results.push({
					item_name: item.item_name || item.asin,
					asin: item.asin,
					local_sku: target.local_sku || item.local_sku,
					quantity: finalQty,
					wid: warehouseWid,
					warehouse_name: warehouseName || warehouseWid,
					success: false,
					plan_sn: '',
					message: `失败：${result?.message || '未知错误'}`,
					purchase_remark_sync: result?.purchase_remark_sync || buildFallbackPurchaseRemarkSync(item),
					snapshot_save: snapshotSaveResult
				});
			} else {
				generateProgress.value.results.push({
					item_name: item.item_name || item.asin,
					asin: item.asin,
					local_sku: target.local_sku || item.local_sku,
					quantity: finalQty,
					wid: warehouseWid,
					warehouse_name: warehouseName || warehouseWid,
					success: true,
					plan_sn: result?.plan_sn || '',
					message: `成功 → ${result?.plan_sn || ''}${snapshotWarning}`,
					purchase_remark_sync: result?.purchase_remark_sync || buildFallbackPurchaseRemarkSync(item, "采购计划已创建，但未返回采购备注处理结果"),
					snapshot_save: snapshotSaveResult
				});
			}
		} catch (e: any) {
			generateProgress.value.results.push({
				item_name: item.item_name || item.asin,
				asin: item.asin,
				local_sku: item.local_sku,
				quantity: finalQty,
				wid: getItemWarehouseWid(item),
				warehouse_name: getWarehouseName(getItemWarehouseWid(item)) || getItemWarehouseWid(item),
				success: false,
				plan_sn: '',
				message: `失败：${e?.message || '未知错误'}`,
				purchase_remark_sync: e?.purchase_remark_sync || buildFallbackPurchaseRemarkSync(item, "请求异常，未取得采购备注处理结果")
			});
		}

		// 节流 200ms，防止领星API限流
		if (i < validItems.length - 1) {
			await new Promise(resolve => setTimeout(resolve, 200));
		}
	}

	isGenerating.value = false;

	// 显示结果
	const successCount = generateProgress.value.results.filter(r => r.success).length;
	const failCount = generateProgress.value.results.filter(r => !r.success).length;

	if (failCount === 0) {
		ElMessage.success(`全部 ${successCount} 个采购计划创建成功！`);
	} else {
		ElMessage.warning(`完成: 成功 ${successCount} 个，失败 ${failCount} 个`);
	}

	generateResultVisible.value = true;
};

</script>

<style lang="scss" scoped>
.batch-replenish-dialog {
	max-width: calc(100vw - 48px);

	:deep(.el-dialog__body) {
		padding: 0;
	}
}

.batch-dialog-header {
	display: flex;
	align-items: center;
	justify-content: space-between;

	.header-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.header-title {
		font-size: 18px;
		font-weight: 700;
		color: #1f2d3d;
	}

	.header-sync-tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
}

.remark-sync-cell {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 4px;
	font-size: 12px;
	line-height: 1.4;
}

.remark-sync-message {
	color: #606266;
	white-space: normal;
	word-break: break-all;
}

.remark-sync-rollback {
	color: #e6a23c;
	white-space: normal;
	word-break: break-all;
}

.batch-replenish-content {
	padding: 16px;
	max-height: calc(96vh - 150px);
	overflow-y: auto;
}

.batch-global-settings {
	position: sticky;
	top: 0;
	z-index: 20;
	background: linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 100%);
	border: 1px solid #d0e4f7;
	border-radius: 12px;
	padding: 16px 20px;
	margin-bottom: 16px;
	box-shadow: 0 8px 18px rgba(49, 112, 190, 0.12);

	.setting-row {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}

	.setting-item {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.setting-period-item {
		flex: 0 0 340px;

		:deep(.visual-date-picker) {
			flex: 1;
			min-width: 0;
		}

		:deep(.picker-trigger) {
			width: 280px;
			max-width: none;
		}
	}

	.setting-algo-item {
		margin-left: 8px;
	}

	.setting-bulk-item {
		gap: 8px;
	}

	.bulk-selected-text {
		display: inline-flex;
		align-items: center;
		height: 24px;
		padding: 0 8px;
		border: 1px solid #c6e2ff;
		border-radius: 12px;
		background: #ecf5ff;
		font-size: 12px;
		font-weight: 600;
		color: #337ecc;
		white-space: nowrap;
	}

	.bulk-actions-panel {
		padding: 6px 8px;
		border: 1px solid #d9e8ff;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.72);
	}

	.setting-calc-button {
		margin-left: auto;
	}

	.setting-label {
		font-size: 13px;
		font-weight: 600;
		color: #606266;
		white-space: nowrap;
	}
}

.purchase-plan-sync-waiting {
	display: flex;
	align-items: center;
	gap: 8px;
	margin: -4px 0 12px;
	padding: 10px 14px;
	border: 1px solid #b3d8ff;
	border-radius: 10px;
	background: #ecf5ff;
	color: #337ecc;
	font-size: 13px;
	font-weight: 600;
	animation: sync-notice-enter 0.22s ease-out;
	transition: opacity 0.28s ease, transform 0.28s ease, max-height 0.28s ease, margin 0.28s ease, padding 0.28s ease;
}

.purchase-plan-sync-waiting.is-leaving {
	max-height: 0;
	margin-top: -4px;
	margin-bottom: 0;
	padding-top: 0;
	padding-bottom: 0;
	opacity: 0;
	transform: translateY(-8px);
	overflow: hidden;
}

.sync-notice-text {
	flex: 1;
	min-width: 0;
}

.sync-retry-btn {
	flex-shrink: 0;
}

.sync-notice-close {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	margin-left: auto;
	padding: 0;
	border: 0;
	border-radius: 50%;
	background: transparent;
	color: inherit;
	cursor: pointer;
	opacity: 0.72;
	transition: background-color 0.15s, opacity 0.15s;
}

.sync-notice-close:hover {
	background: rgba(0, 0, 0, 0.06);
	opacity: 1;
}

.purchase-plan-sync-waiting.is-success {
	border-color: #b3e19d;
	background: #f0f9eb;
	color: #529b2e;
}

.purchase-plan-sync-waiting.is-partial_failed {
	border-color: #f3d19e;
	background: #fdf6ec;
	color: #b88230;
}

.purchase-plan-sync-waiting.is-failed {
	border-color: #fab6b6;
	background: #fef0f0;
	color: #c45656;
}

@keyframes sync-notice-enter {
	from {
		opacity: 0;
		transform: translateY(-6px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.batch-items-scroll {
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin-bottom: 16px;
}

.batch-item-card {
	display: flex;
	align-items: center;
	position: relative;
	overflow: hidden;
	border: 1px solid #e4e7ed;
	border-radius: 12px;
	padding: 16px;
	background: #fff;
	transition: box-shadow 0.2s;
	gap: 12px;

	&:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}

	&.is-missing-warehouse {
		border-color: #f56c6c;
		box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.12);
	}
}

.item-product {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 0 0 238px;
	min-width: 220px;
	max-width: 238px;

	.item-select-checkbox {
		flex: 0 0 auto;
		margin-right: 2px;
	}

	.item-index {
		font-size: 14px;
		font-weight: 700;
		color: #409eff;
		min-width: 18px;
		text-align: center;
		padding-top: 4px;
	}

	.img-placeholder {
		width: 56px;
		height: 56px;
		border-radius: 8px;
		background: #f5f7fa;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.item-info {
		flex: 1;
		min-width: 0;

		.item-name {
			font-size: 12px;
			font-weight: 600;
			color: #303133;
			margin-bottom: 5px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.item-local-combined {
			display: flex;
			flex-direction: column;
			gap: 2px;
			max-width: 100%;
			margin-bottom: 5px;
			padding: 4px 6px;
			border: 1px solid #e4e7ed;
			border-radius: 6px;
			background: #fafcff;
			cursor: help;
		}

		.item-local-label {
			width: fit-content;
			padding: 1px 5px;
			border-radius: 4px;
			background: #ecf5ff;
			color: #409eff;
			font-size: 10px;
			font-weight: 700;
			line-height: 1.2;
		}

		.item-local-name,
		.item-local-sku {
			display: block;
			max-width: 100%;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			line-height: 1.25;
		}

		.item-local-name {
			color: #303133;
			font-size: 11px;
			font-weight: 600;
		}

		.item-local-sku {
			color: #909399;
			font-size: 10px;
		}

		.item-meta {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 11px;
			color: #909399;
			flex-wrap: wrap;
		}

		.cross-store-row {
			margin-top: 6px;
		}

		.profile-summary {
			margin-top: 7px;
			padding: 6px 7px;
			border: 1px solid #d9e8ff;
			border-radius: 6px;
			background: #f7fbff;
			line-height: 1.25;

			&.is-preset {
				border-color: #c8ebd4;
				background: #f4fbf6;
			}
		}

		.profile-summary-head {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 4px;
			margin-bottom: 4px;
			font-size: 11px;
			color: #606266;
		}

		.profile-summary-title {
			max-width: 100%;
			font-weight: 700;
			color: #303133;
			white-space: normal;
			word-break: break-all;
		}

		.profile-summary-buffer {
			display: inline-flex;
			align-items: center;
			max-width: 100%;
			padding: 1px 5px;
			border: 1px solid #d9ecff;
			border-radius: 4px;
			background: #ecf5ff;
			color: #409eff;
			font-size: 10px;
			font-weight: 700;
			white-space: nowrap;
		}

		.profile-summary-methods {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 3px;
		}

		.profile-summary-method {
			min-width: 0;
			padding: 1px 5px;
			border-radius: 4px;
			background: #eef5ff;
			color: #337ecc;
			font-size: 10px;
			white-space: nowrap;
			overflow: hidden;
			text-align: center;
			text-overflow: ellipsis;
		}

		.warehouse-missing-tag {
			display: inline-flex;
			align-items: center;
			width: fit-content;
			margin-top: 6px;
			padding: 2px 8px;
			border: 1px solid #fab6b6;
			border-radius: 4px;
			background: #fef0f0;
			color: #c45656;
			font-size: 12px;
			font-weight: 600;
		}
	}
}

.item-analysis {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.analysis-data-grid {
	--summary-label-height: 31px;
	--summary-value-height: 30px;

	display: grid;
	grid-template-columns:
		minmax(64px, 0.72fr)
		minmax(74px, 0.78fr)
		minmax(116px, 1fr)
		minmax(128px, 1.08fr)
		minmax(58px, 0.62fr)
		minmax(68px, 0.7fr)
		minmax(92px, 0.95fr)
		minmax(78px, 0.76fr)
		minmax(78px, 0.76fr)
		minmax(126px, 1.02fr);
	align-items: start;
	justify-content: stretch;
	column-gap: clamp(7px, 0.8vw, 13px);
	row-gap: 0;
	background: #fafbfc;
	border: 1px solid #ebeef5;
	border-radius: 8px;
	padding: 10px 16px;
	overflow: hidden;

	.grid-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		text-align: center;
		min-width: 0;
		min-height: 68px;
		padding: 0 2px;

		.grid-label {
			display: flex;
			align-items: flex-start;
			justify-content: center;
			flex: 0 0 var(--summary-label-height);
			min-height: var(--summary-label-height);
			box-sizing: border-box;
			font-size: 11px;
			color: #909399;
			line-height: 1.3;
			white-space: nowrap;
		}

		.grid-val {
			display: flex;
			align-items: flex-start;
			justify-content: center;
			min-height: var(--summary-value-height);
			line-height: 1.2;
			font-size: 13px;
			font-weight: 600;
			color: #303133;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			max-width: 100%;

			&.highlight {
				color: #409eff;
			}
		}
	}

	.summary-inventory-item,
	.summary-delivery-item,
	.summary-rating-item {
		.grid-val {
			max-width: none;
		}
	}
}

.summary-daily-sales {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	gap: 2px;
	min-height: var(--summary-value-height);

	.daily-sales-trigger {
		color: #3b82f6;
		font-size: 13px;
		font-weight: 600;
		line-height: 1.2;
	}
}

.daily-sales-detail {
	font-size: 12px;
	line-height: 1.6;

	strong {
		color: #fff;
		font-size: 13px;
	}
}

.daily-sales-tooltip-panel {
	min-width: 360px;
	max-width: 640px;
	color: #303133;
	font-size: 12px;
	line-height: 1.4;
}

.daily-sales-tooltip-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 8px;
	padding-bottom: 8px;
	border-bottom: 1px solid #ebeef5;

	strong {
		display: block;
		margin-top: 2px;
		color: #2563eb;
		font-size: 18px;
		line-height: 1.1;
	}
}

.daily-sales-tooltip-title {
	color: #606266;
	font-weight: 600;
}

.daily-sales-tooltip-status {
	flex-shrink: 0;
}

.daily-sales-metric-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(68px, 1fr));
	gap: 6px;
	margin-bottom: 10px;
}

.daily-sales-metric {
	padding: 6px 8px;
	border: 1px solid #e4e7ed;
	border-radius: 6px;
	background: #f8fafc;
	text-align: center;

	span {
		display: block;
		margin-bottom: 2px;
		color: #909399;
		font-size: 11px;
	}

	strong {
		color: #303133;
		font-size: 13px;
	}
}

.daily-sales-history-section {
	padding-top: 2px;
}

.daily-sales-history-title {
	margin-bottom: 6px;
	color: #606266;
	font-weight: 600;
}

.daily-sales-history-grid {
	display: flex;
	gap: 6px;
	max-width: 620px;
	overflow-x: auto;
	padding-bottom: 2px;
}

.daily-sales-history-item {
	flex: 0 0 auto;
	min-width: 54px;
	padding: 5px 6px;
	border: 1px solid #ebeef5;
	border-radius: 5px;
	background: #fff;
	text-align: center;

	span {
		display: block;
		margin-bottom: 3px;
		color: #909399;
		font-size: 11px;
		white-space: nowrap;
	}

	strong {
		color: #303133;
		font-size: 13px;
	}
}

.daily-sales-history-empty {
	padding: 8px 0 2px;
	color: #909399;
	text-align: center;
}

.summary-sales-tag {
	margin-top: 2px;
	height: auto;
	padding: 0 4px;
	font-size: 9px;
	line-height: 1.5;
}

.inventory-combined,
.delivery-purchase-combined {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 3px;
	white-space: nowrap;
}

.inventory-combined {
	width: 136px;
	max-width: 100%;
	font-size: 12px;
	min-height: var(--summary-value-height);
	align-items: flex-start;

	.summary-link {
		display: inline-block;
		max-width: 42px;
		overflow: hidden;
		text-overflow: ellipsis;
		vertical-align: top;
	}
}

.analysis-data-grid .grid-item .grid-val.delivery-purchase-matrix {
	display: grid;
	grid-template-rows: repeat(2, 14px);
	row-gap: 2px;
	width: 124px;
	min-width: 124px;
	max-width: 100%;
	align-self: start;
	align-items: center;
	justify-items: stretch;
	justify-content: center;
	align-content: start;
	min-height: var(--summary-value-height);
	overflow: hidden !important;
	white-space: nowrap !important;
	line-height: 1;

	.dp-row {
		display: grid;
		grid-template-columns: 30px 39px 8px 39px;
		align-items: center;
		justify-content: center;
		column-gap: 0;
		width: 100%;
		min-width: 0;
	}

	.dp-source {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		overflow: hidden;
		font-size: 9px;
		font-weight: 700;
		color: #606266;
	}

	.dp-cell-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		overflow: hidden;
	}

	.dp-separator {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #c0c4cc;
		font-size: 10px;
		font-weight: 500;
	}

	.dp-cell {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-width: 0;
		min-height: 12px;
		font-size: 10px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.is-lingxing .dp-source {
		color: #b88230;
	}

	.is-lingxing .dp-cell {
		color: #e6a23c !important;
	}

	.dp-cell.is-empty {
		color: #c0c4cc !important;
	}
}

.summary-link {
	color: #409eff !important;
	cursor: help;
}

.delivery-purchase-matrix .is-lingxing .dp-cell.summary-link {
	color: #e6a23c !important;
}

.delivery-purchase-matrix .dp-cell.is-empty.summary-link {
	color: #c0c4cc !important;
}

.summary-help {
	cursor: help;
}

.box-pcs-value {
	display: flex;
	align-items: flex-start;
	justify-content: center;
	min-height: var(--summary-value-height);
}

.box-pcs-popover {
	font-size: 12px;
}

.box-pcs-row {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	margin-bottom: 8px;
	color: #606266;

	code {
		padding: 1px 4px;
		border-radius: 4px;
		background: #f5f7fa;
		color: #303133;
		word-break: break-all;
	}
}

.box-pcs-label {
	flex: 0 0 56px;
	color: #909399;
}

.box-pcs-actions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	margin-top: 10px;
}

.box-pcs-error {
	color: #f56c6c;
}

.target-days-input {
	width: 66px;
	margin-top: 0;

	:deep(.el-input__wrapper) {
		padding: 0 6px;
		box-shadow: 0 0 0 1px #dcdfe6 inset;
	}

	:deep(.el-input__inner) {
		height: 22px;
		text-align: center;
		font-size: 12px;
		font-weight: 600;
		color: #303133;
	}
}

.volatility-coefficient-input {
	width: 68px;
	margin-top: 0;

	:deep(.el-input__wrapper) {
		padding: 0 6px;
		box-shadow: 0 0 0 1px #dcdfe6 inset;
	}

	:deep(.el-input__inner) {
		height: 22px;
		text-align: center;
		font-size: 12px;
		font-weight: 600;
		color: #303133;
	}
}

.shipping-quantity-input {
	width: 96px;

	:deep(.el-input__wrapper) {
		padding: 0 7px;
	}

	:deep(.el-input__inner) {
		text-align: center;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
}

.bulk-volatility-input {
	width: 132px;
}

.summary-separator {
	color: #dcdfe6;
	margin: 0 1px;
}

.analysis-data-grid .grid-item .grid-val.rating-combined {
	overflow: visible;
	white-space: normal;
	text-overflow: clip;
	display: block;
	min-height: var(--summary-value-height);
	line-height: 1.15;
}

.rating-mini-table {
	width: 124px;
	max-width: 100%;
	margin: 0 auto;
	table-layout: fixed;
	border-collapse: collapse;
	font-variant-numeric: tabular-nums;
}

.rating-mini-table th,
.rating-mini-table td {
	padding: 0;
	text-align: center;
	white-space: nowrap;
	line-height: 1.15;
}

.rating-mini-table thead th {
	padding-bottom: 0;
	color: #909399;
	font-size: 10px;
	font-weight: 500;
}

.rating-mini-table tbody tr:first-child th,
.rating-mini-table tbody tr:first-child td {
	border-top: 1px solid #ebeef5;
	padding-top: 1px;
}

.rating-mini-table tbody th {
	color: #606266;
	font-size: 10px;
	font-weight: 600;
	text-align: right;
	padding-right: 3px;
}

.rating-mini-table tbody td {
	color: #303133;
	font-size: 10px;
	font-weight: 600;
}

.rating-mini-col-label {
	width: 30px;
}

.rating-mini-col-now {
	width: 24px;
}

.rating-mini-col-compare {
	width: 38px;
}

.rating-mini-col-delta {
	width: 36px;
}

.rating-mini-delta {
	font-weight: 700;
}

.rating-mini-delta.is-up {
	color: #67c23a;
}

.rating-mini-delta.is-down {
	color: #f56c6c;
}

.rating-mini-delta.is-flat {
	color: #909399;
}

.summary-detail-content {
	max-height: 460px;
	overflow-y: auto;
}

.summary-detail-section {
	& + & {
		margin-top: 14px;
	}
}

.summary-detail-title {
	margin-bottom: 6px;
	color: #303133;
	font-size: 13px;
	font-weight: 600;
}

.summary-empty {
	padding: 8px 0;
	color: #909399;
	font-size: 12px;
}

.summary-rating-full {
	line-height: 1.6;
	font-size: 12px;
	word-break: break-all;
}

.summary-rating-title {
	margin-top: 8px;
}

.box-pcs-debug {
	.debug-block {
		margin-top: 14px;
	}

	.debug-title {
		margin-bottom: 6px;
		color: #606266;
		font-size: 12px;
		font-weight: 600;
	}

	.debug-field-descriptions {
		:deep(.el-descriptions__label) {
			width: 128px;
			color: #606266;
		}
	}

	.debug-field-value {
		white-space: pre-wrap;
		word-break: break-all;
		line-height: 1.4;
	}

	.debug-field-hint {
		margin-top: 6px;
		color: #909399;
		font-size: 12px;
		line-height: 1.4;
	}

	:deep(.el-textarea__inner) {
		font-family: Consolas, "Courier New", monospace;
		font-size: 12px;
	}
}

.analysis-panel {
	background: #fafbfc;
	border: 1px solid #ebeef5;
	border-radius: 8px;
	padding: 16px;
	margin-top: 4px;
	position: relative;

	&.is-locked {
		opacity: 0.45;
		pointer-events: none;
		user-select: none;
	}

	.panel-top {
		display: flex;
		justify-content: flex-start;
		align-items: flex-start;
		gap: 12px;
		padding-bottom: 16px;
		border-bottom: 1px dashed #e4e7ed;
		margin-bottom: 16px;

		.panel-metrics {
			display: flex;
			gap: 32px;
			flex-shrink: 0;

			.pm-item {
				display: flex;
				flex-direction: column;
				gap: 6px;
				text-align: center;

				.pm-label {
					font-size: 12px;
					color: #909399;
				}

				.pm-value {
					font-size: 15px;
					font-weight: 600;
					color: #303133;

					&.text-danger {
						color: #f56c6c;
					}
				}
			}
		}

		.combined-formula-panel {
			display: grid;
			grid-template-columns: 78px minmax(0, 1fr);
			align-items: stretch;
			column-gap: 7px;
			min-width: 0;
			max-width: none;
			flex: 1 1 auto;
			font-size: 12px;

			.cf-mini-metrics {
				display: flex;
				flex-direction: column;
				gap: 4px;
				padding: 5px 6px;
				border: 1px solid #e4e7ed;
				border-radius: 6px;
				background: #fff;
			}

			.cf-mini-item {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				min-height: 30px;
				line-height: 1.15;
				border-radius: 4px;

				&.is-help {
					cursor: help;
					border: 1px dashed #c6e2ff;
					background: #f8fbff;
				}

				&.is-editable-daily {
					padding: 2px 4px;
				}

				&.is-help:hover {
					background: #ecf5ff;
					border-color: #409eff;
				}

				span {
					color: #909399;
					font-size: 11px;
					transform: scale(0.96);
					transform-origin: center;
					white-space: nowrap;
				}

				strong {
					margin-top: 2px;
					font-size: 14px;
					color: #303133;
				}

				.calc-daily-input {
					width: 72px;
					margin-top: 2px;

					:deep(.el-input-number__decrease),
					:deep(.el-input-number__increase) {
						width: 16px;
					}

					:deep(.el-input__wrapper) {
						padding-left: 4px;
						padding-right: 18px;
					}

					:deep(.el-input__inner) {
						height: 22px;
						font-size: 12px;
						font-weight: 700;
						text-align: center;
						color: #303133;
					}
				}
			}

			.cf-formula-box {
				display: flex;
				flex-direction: column;
				justify-content: center;
				gap: 4px;
				min-width: 0;
				padding: 5px 7px;
				border: 1px solid #d9ecff;
				border-radius: 6px;
				background: #f8fbff;
			}

			.cf-line {
				display: flex;
				align-items: flex-start;
				gap: 6px;
				min-width: 0;
				padding: 3px 7px;
				border-radius: 5px;
				background: #fff;
				border: 1px solid transparent;
				line-height: 1.2;
				cursor: help;
				font-size: 11px;

				&.is-help {
					border-color: #d9ecff;
				}

				&:hover {
					background: #ecf5ff;
					border-color: #a0cfff;
				}

				&.is-actual {
					background: #fff7ed;
					border-color: #fde2c4;

					&:hover {
						background: #fff3e0;
						border-color: #f3c78c;
					}

					.cf-main strong {
						color: #e6a23c;
					}
				}

				.cf-main {
					flex: 0 0 auto;
					color: #606266;
					white-space: nowrap;

					strong {
						margin-left: 3px;
						font-size: 13px;
						color: #409eff;
					}
				}

				.cf-expression {
					flex: 1 1 auto;
					min-width: 0;
					color: #606266;
					white-space: normal;
					overflow-wrap: anywhere;
					word-break: break-word;
					line-height: 1.45;
				}
			}

			.covered-summary-line {
				display: flex;
				align-items: center;
				gap: 6px;
				min-width: 0;
				padding: 3px 7px;
				border: 1px solid #c8f0c2;
				border-radius: 5px;
				background: #f2fbef;
				font-size: 11px;
				line-height: 1.25;
				cursor: help;

				.covered-summary-badge {
					flex: 0 0 auto;
					padding: 1px 5px;
					border-radius: 999px;
					background: #67c23a;
					color: #fff;
					font-weight: 700;
					white-space: nowrap;
				}

				.covered-summary-text {
					flex: 1 1 auto;
					min-width: 0;
					color: #529b2e;
					font-weight: 600;
					white-space: normal;
					overflow-wrap: anywhere;
				}
			}
		}

		.panel-actions {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			flex-wrap: wrap;
			column-gap: 8px;
			row-gap: 8px;
			min-width: 0;
			max-width: 100%;
			margin-left: auto;
			background: #fff;
			padding: 8px 12px;
			border-radius: 6px;
			border: 1px solid #dcdfe6;

			&.is-two-line {
				flex: 0 0 320px;
				box-sizing: border-box;
				flex-direction: column;
				align-items: stretch;
				justify-content: center;
				padding: 8px 9px;
				row-gap: 6px;

				.pa-row {
					width: 100%;
				}
			}

			.pa-row {
				display: flex;
				align-items: center;
				justify-content: flex-start;
				gap: 8px;
				min-width: 0;
				width: auto;
			}

			.pa-row-period {
				justify-content: flex-start;

				:deep(.visual-date-picker) {
					min-width: 0;
					flex: 1;
				}

				:deep(.picker-trigger) {
					box-sizing: border-box;
					min-width: 0;
					width: 100%;
					max-width: none;
				}

				:deep(.trigger-text) {
					flex: 1;
					min-width: 0;
					gap: 5px;
				}

				:deep(.trigger-days) {
					display: inline-flex;
					padding: 0 5px;
					font-size: 10px;
				}

				:deep(.trigger-clear) {
					margin-left: 0;
				}
			}

			.pa-algo-select {
				width: 96px;
				flex: 0 0 96px;
			}

			.pa-label {
				font-size: 12px;
				color: #606266;
				margin-right: 0;
				flex-shrink: 0;

				&.pa-label-hoverable {
					cursor: pointer;
					border-bottom: 1px dashed #409eff;
					color: #409eff;
					transition: all 0.2s;
					padding-bottom: 1px;

					&:hover {
						color: #337ecc;
						border-bottom-color: #337ecc;
					}
				}
			}
		}
	}

	.analysis-main-row {
		display: flex;
		align-items: stretch;
		gap: 12px;
		min-width: 0;
	}

	.panel-bottom {
		display: flex;
		align-items: stretch;
		gap: 8px;
		overflow-x: auto;
		padding: 10px;
		flex: 1;
		min-width: 0;
		border: 1px solid #e4e7ed;
		border-radius: 7px;
		background: #fff;

		.si-col {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 4px;
			min-width: 102px;
			flex-shrink: 0;
			justify-content: flex-start;
			padding: 7px 7px 6px;
			border: 1px solid #edf0f5;
			border-radius: 6px;
			background: #fafbfc;

			.si-tag {
				font-size: 12px;
				padding: 2px 10px;
				border-radius: 10px;
				border: 1px solid transparent;
				white-space: nowrap;
			}
		}

		// 综合走势α展示样式（紧凑布局）
		.alpha-info-compact {
			display: flex;
			align-items: center;
			gap: 4px;
			white-space: nowrap;
			line-height: 1;

			.alpha-date-range {
				font-size: 10px;
				color: #909399;
			}

			.alpha-sys-badge {
				font-size: 10px;
				color: #409eff;
				background: #ecf5ff;
				padding: 1px 5px;
				border-radius: 3px;
				cursor: pointer;
				font-weight: 600;
				border: 1px solid #d9ecff;
				transition: all 0.2s;
				user-select: none;

				&:hover {
					background: #d9ecff;
				}

				&.is-user {
					color: #e6a23c;
					background: #fdf6ec;
					border-color: #f5dab1;

					&:hover {
						background: #faecd8;
					}
				}

				.badge-mode {
					font-size: 9px;
					opacity: 0.8;
				}

				.badge-toggle-icon {
					font-size: 9px;
					margin-left: 2px;
					opacity: 0.5;
					transition: opacity 0.2s;
				}

				&:hover .badge-toggle-icon {
					opacity: 1;
				}
			}
		}

		.alpha-manual-row {
			display: flex;
			align-items: center;
			gap: 3px;
			cursor: help;

			.alpha-manual-label {
				font-size: 10px;
				color: #e6a23c;
				font-weight: 600;
				white-space: nowrap;
			}

			.alpha-manual-fixed {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 54px;
				height: 22px;
				padding: 0 6px;
				border-radius: 4px;
				border: 1px solid #dcdfe6;
				background: #f7f8fa;
				color: #606266;
				font-size: 11px;
				font-weight: 600;
				white-space: nowrap;
			}

			:deep(.el-input-number) {
				width: 80px !important;

				.el-input__inner {
					font-size: 11px;
					padding: 0 2px;
					text-align: center;
					color: #e6a23c;
					font-weight: 600;
				}
			}
		}

		.manual-qty-row {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 4px;
			min-height: 20px;
			line-height: 1;

			:deep(.el-tag) {
				height: 18px;
				padding: 0 5px;
				font-size: 10px;
			}

			:deep(.el-button) {
				height: 18px;
				padding: 0;
				font-size: 10px;
			}
		}

		.redistribution-effect-text {
			color: #86909c;
			font-size: 11px;
			line-height: 1;
			white-space: nowrap;
		}

		.alpha-demand-info {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 2px;
			margin-top: 3px;
			font-size: 10px;
			justify-content: center;
			width: 100%;
			min-height: 42px;
			line-height: 1.2;

			.suggest-tag,
			.purchase-plan-deduct-tag,
			.pending-delivery-deduct-tag,
			.demand-tag {
				color: #909399;
				white-space: nowrap;
				max-width: 100%;
				overflow: hidden;
				text-overflow: ellipsis;

				&.suggest-clickable,
				&.demand-clickable {
					cursor: help;
					border-bottom: 1px dashed #909399;
					transition: all 0.2s;

					&:hover {
						color: #409eff;
						border-color: #409eff;
					}
				}

				&.has-suggestion {
					color: #f56c6c;
					font-weight: 600;
					border-color: #f56c6c;
				}
			}

			.purchase-plan-deduct-tag {
				color: #e6a23c;
				font-weight: 600;
			}

			.pending-delivery-deduct-tag {
				color: #409eff;
				font-weight: 600;
			}

			.final-covered-tag {
				color: #67c23a;
				font-weight: 700;
				white-space: nowrap;
				cursor: help;
			}

			.shortage-tag {
				color: #f56c6c;
				white-space: nowrap;
				font-weight: 600;
				max-width: 100%;
				overflow: hidden;
				text-overflow: ellipsis;

				&.is-covered {
					color: #67c23a;
					font-weight: 500;
				}
			}

			.inventory-usage-tags {
				display: inline-flex;
				flex-direction: column;
				align-items: center;
				gap: 1px;
				max-width: 100%;
				cursor: help;
			}

			.transit-tag {
				color: #909399;
				white-space: nowrap;
				cursor: default;

				&.has-transit {
					color: #e6a23c;
					font-weight: 600;
					cursor: help;
				}
			}

			.arrival-tag {
				color: #909399;
				white-space: nowrap;
				cursor: help;

				&.has-arrival {
					color: #409eff;
					font-weight: 600;
				}
			}
		}

		.coeff-mini-panel {
			box-sizing: border-box;
			width: 268px;
			min-width: 268px;
			padding: 10px 11px;
			border: 1px solid #dcdfe6;
			border-radius: 6px;
			background: #fff;
			cursor: pointer;
			align-self: stretch;
			display: flex;
			flex-direction: column;
			justify-content: center;
			gap: 3px;

			&:hover {
				border-color: #409eff;
				box-shadow: 0 2px 8px rgba(64, 158, 255, 0.12);
			}
		}

		.coeff-mini-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			font-size: 11px;
			font-weight: 600;
			color: #303133;
			line-height: 1;

			:deep(.el-button) {
				height: 16px;
				padding: 0;
				font-size: 10px;
			}
		}

		.coeff-mini-sub {
			color: #909399;
			font-size: 10px;
			line-height: 1;
		}

		.coeff-mini-table {
			display: flex;
			flex-direction: column;
			gap: 2px;
			margin-top: 3px;
			font-size: 11px;
			line-height: 1.25;
			font-variant-numeric: tabular-nums;
		}

		.coeff-mini-row {
			display: grid;
			grid-template-columns: 26px 32px 32px 38px 34px 54px;
			align-items: center;
			column-gap: 6px;
			min-height: 18px;
			padding: 2px 3px;
			border-radius: 3px;
			color: #606266;

			span {
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				text-align: right;

				&:first-child {
					text-align: left;
				}
			}

			&.is-current-month {
				background: #ecf5ff;
			}

			&.is-missing {
				color: #c0c4cc;
			}
		}

		.coeff-mini-simple-row {
			grid-template-columns: 30px 28px 46px 48px 52px;
			column-gap: 3px;
		}

		.coeff-mini-combined-table {
			.coeff-mini-row {
				grid-template-columns: 30px repeat(5, minmax(0, 1fr));
				column-gap: 0;
				padding: 2px 6px;
			}

			.coeff-mini-row span {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				text-align: center;
				justify-self: stretch;

				&:first-child {
					text-align: center;
				}
			}

			.coeff-mini-row .combined-coeff,
			.coeff-mini-row .subtotal {
				justify-self: center;
				padding-right: 0;
				text-align: center;
			}

			.coeff-mini-row .mini-alpha {
				justify-self: center;
				width: fit-content;
			}
		}

		.coeff-mini-header {
			color: #909399;
			background: #f5f7fa;
			font-weight: 600;

			span:nth-child(5) {
				text-align: center;
			}
		}

		.coeff-mini-row .combined-coeff {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			color: #409eff;
			font-weight: 600;
			justify-self: center;
			width: fit-content;
			padding: 0 1px;
			text-decoration: underline wavy #409eff 1px;
			text-underline-offset: 3px;
			text-decoration-skip-ink: none;
			border-bottom: 1px dotted rgba(64, 158, 255, 0.45);
			cursor: help;
		}

		.coeff-mini-row .simple-coeff {
			display: inline-flex;
			width: fit-content;
			justify-self: end;
			color: #67c23a;
			font-weight: 600;
			border-bottom: 1px dashed #67c23a;
			cursor: help;
		}

		.coeff-mini-row .mini-alpha {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			justify-self: center;
			min-width: 0;
			width: fit-content;
			padding: 0 1px;
			color: #e6a23c;
			font-weight: 600;
			text-decoration: underline wavy #e6a23c 1px;
			text-underline-offset: 3px;
			text-decoration-skip-ink: none;
			border-bottom: 1px dotted rgba(230, 162, 60, 0.45);
			cursor: help;
		}

		.coeff-mini-row .subtotal {
			color: #303133;
			font-weight: 600;
			font-variant-numeric: tabular-nums;
		}

		.si-col-total {
			padding-left: 12px;
			border-left: 1px dashed #e4e7ed;

			.si-total-value {
				font-size: 18px;
				font-weight: bold;
				color: #303133;
				line-height: 32px;
			}
		}

		.panel-totals {
			margin-left: auto;
			background: #fffafa;
			border: 1px solid #f7e6e6;
			border-radius: 6px;
			padding: 8px 16px;
			display: flex;
			flex-direction: column;
			gap: 6px;
			min-width: 140px;

			.pt-row {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 16px;

				&.is-help {
					cursor: help;
				}

				.pt-label {
					font-size: 12px;
					color: #909399;
				}
				.pt-value {
					font-size: 14px;
					font-weight: bold;
					color: #303133;
				}

				&.highlight {
					.pt-label, .pt-value {
						color: #e6a23c;
					}
				}
			}
		}
	}

	.coeff-trigger-btn {
		flex-shrink: 0;
		margin-right: 12px;
		padding: 5px 8px;
	}
}

.combined-coeff-panel {
	min-height: 230px;
	display: flex;
	flex-direction: column;
	width: 760px;
	min-width: 720px;
	max-width: 860px;

	.coeff-panel-head {
		margin-bottom: 8px;
		color: #303133;
		font-size: 13px;
		font-weight: 600;
	}

	.coeff-title-block {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		max-width: 760px;
	}

	.coeff-title-text {
		max-width: 760px;
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: help;
	}

	.coeff-meta-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.coeff-daily {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		width: fit-content;
		padding: 3px 8px;
		border: 1px solid #d9ecff;
		border-radius: 4px;
		background: #ecf5ff;
		color: #606266;
		font-size: 12px;
		font-weight: 500;
		line-height: 1.2;

		b {
			color: #1677ff;
			font-size: 13px;
			font-weight: 700;
		}
	}

	.coeff-tabs {
		flex: 1;
		min-height: 0;

		:deep(.el-tabs__header) {
			margin: 0 0 8px;
		}

		:deep(.el-tabs__item) {
			height: 26px;
			padding: 0 10px;
			font-size: 12px;
			line-height: 26px;
		}
	}

	.coeff-table {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 12px;
		line-height: 1.25;
	}

	.coeff-five-table,
	.coeff-current-table,
	.coeff-simple-five-table,
	.coeff-simple-current-table,
	.coeff-replenish-current-table {
		width: fit-content;
		max-width: 100%;
	}

	.coeff-row {
		display: grid;
		align-items: center;
		gap: 8px;
		min-height: 24px;
		padding: 3px 7px;
		border-radius: 4px;
		color: #606266;

		&:hover {
			background: #f5f7fa;
		}

		&.is-current-month {
			background: #f0f7ff;
		}

		&.is-missing {
			color: #c0c4cc;
			cursor: default;
		}
	}

	.coeff-head-row {
		color: #909399;
		font-weight: 600;
		background: #f7f8fa;
		cursor: default;

		&:hover {
			background: #f7f8fa;
		}
	}

	.coeff-total-row {
		margin-top: 3px;
		border-top: 1px solid #ebeef5;
		background: #fbfcff;
		color: #303133;
		font-weight: 600;
		cursor: default;

		&:hover {
			background: #fbfcff;
		}
	}

	.coeff-five-table,
	.coeff-simple-five-table {
		width: 100%;
		max-width: 100%;
		gap: 0;
		overflow: hidden;
		border: 1px solid #e8edf5;
		border-radius: 8px;
		background: #fff;
	}

	.coeff-five-table .coeff-row,
	.coeff-simple-five-table .coeff-row {
		gap: 0;
		min-height: 36px;
		padding: 0;
		border-radius: 0;
		border-top: 1px solid #edf1f7;

		&:first-child {
			border-top: 0;
		}
	}

	.coeff-five-table .coeff-head-row,
	.coeff-simple-five-table .coeff-head-row {
		min-height: 32px;
		background: #f6f8fb;
	}

	.coeff-five-table .coeff-row:not(.coeff-head-row):nth-child(odd),
	.coeff-simple-five-table .coeff-row:not(.coeff-head-row):nth-child(odd) {
		background: #fbfdff;
	}

	.coeff-five-table .coeff-row.is-current-month,
	.coeff-simple-five-table .coeff-row.is-current-month {
		background: #edf6ff;
	}

	.coeff-five-table .coeff-row {
		grid-template-columns: 66px 52px 112px 112px 92px 64px 86px minmax(112px, 1fr);
	}

	.coeff-simple-five-table .coeff-row {
		grid-template-columns: 88px 64px minmax(132px, 1fr) 112px minmax(132px, 1fr);
	}

	.coeff-five-table .table-cell,
	.coeff-simple-five-table .table-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		height: 100%;
		padding: 6px 8px;
		font-size: 12px;
		line-height: 1.2;
		text-align: center;
		font-variant-numeric: tabular-nums;
		box-sizing: border-box;
	}

	.coeff-five-table .coeff-head-row .table-cell,
	.coeff-simple-five-table .coeff-head-row .table-cell {
		color: #8a93a3;
		font-weight: 600;
	}

	.coeff-five-table .table-cell-range,
	.coeff-simple-five-table .table-cell-range {
		justify-content: flex-start;
		text-align: left;
		padding-left: 12px;
	}

	.coeff-current-table .coeff-row {
		grid-template-columns: 150px 46px 108px 108px 92px 64px 82px 112px;
	}

	.coeff-current-table .coeff-row > span:nth-child(n + 2):nth-child(-n + 7) {
		text-align: center;
		justify-self: center;
	}

	.coeff-simple-current-table .coeff-row {
		grid-template-columns: 150px 46px 82px 78px 104px;
	}

	.coeff-replenish-current-table {
		width: 100%;
		max-width: 100%;
		gap: 0;
		overflow: hidden;
		border: 1px solid #e8edf5;
		border-radius: 8px;
		background: #fff;

		.coeff-row {
			grid-template-columns: 90px 48px 58px 72px 82px 74px 84px 84px minmax(106px, 1fr);
			gap: 0;
			min-height: 36px;
			padding: 0;
			border-radius: 0;
			border-top: 1px solid #edf1f7;

			&:first-child {
				border-top: 0;
			}
		}

		.coeff-head-row {
			min-height: 32px;
			background: #f6f8fb;
		}

		.coeff-current-row {
			min-height: 38px;
		}

		.coeff-current-row:nth-child(odd) {
			background: #fbfdff;
		}

		.table-cell {
			display: flex;
			align-items: center;
			justify-content: center;
			min-width: 0;
			height: 100%;
			padding: 6px 7px;
			font-size: 12px;
			line-height: 1.2;
			text-align: center;
			font-variant-numeric: tabular-nums;
			box-sizing: border-box;
		}

		.coeff-head-row .table-cell {
			color: #8a93a3;
			font-weight: 600;
		}

		.table-cell-range {
			justify-content: flex-start;
			text-align: left;
			padding-left: 10px;
		}

		.table-cell-status {
			justify-content: center;
			padding-left: 6px;
			padding-right: 6px;
		}
	}

	.coeff-current-table .coeff-row > span:last-child,
	.coeff-simple-current-table .coeff-row > span:last-child {
		text-align: right;
		justify-self: end;
		font-variant-numeric: tabular-nums;
	}

	.sales-coeff {
		color: #67c23a;
	}

	.search-coeff {
		color: #909399;
	}

	.combined-coeff {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #409eff;
		font-weight: 600;
		text-decoration: underline wavy #409eff 1px;
		text-underline-offset: 3px;
		text-decoration-skip-ink: none;
		border-bottom: 1px dotted rgba(64, 158, 255, 0.45);
		cursor: help;
	}

	.simple-coeff {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		min-width: 30px;
		color: #67c23a;
		font-weight: 600;
		border-bottom: 1px dashed #67c23a;
		cursor: help;
	}

	.alpha-coeff {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		justify-self: center;
		min-width: 28px;
		padding: 0 2px;
		color: #e6a23c;
		font-weight: 600;
		text-decoration: underline wavy #e6a23c 1px;
		text-underline-offset: 3px;
		text-decoration-skip-ink: none;
		border-bottom: 1px dotted rgba(230, 162, 60, 0.45);
		cursor: help;
	}

	.subtotal {
		color: #303133;
		font-weight: 600;
		text-align: right;
	}

	.system-suggest {
		color: #409eff;
		font-weight: 600;
	}

	.current-ship {
		color: #e6a23c;
		font-weight: 600;
	}

	.coverage-status {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 74px;
		max-width: 96px;
		padding: 1px 10px;
		border-radius: 10px;
		font-size: 11px;
		line-height: 18px;
		font-weight: 600;
		white-space: nowrap;
		box-sizing: border-box;
		cursor: help;

		&.is-covered {
			color: #059669;
			background: #ecfdf5;
			border: 1px solid #bbf7d0;
		}

		&.is-shortage {
			color: #f56c6c;
			background: #fff2f2;
			border: 1px solid #ffd6d6;
		}

		&.is-empty {
			color: #909399;
			background: #f5f7fa;
			border: 1px solid #ebeef5;
		}
	}

	.current-purchase-summary {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 8px;
		padding: 10px;
		border: 1px solid #e4e7ed;
		border-radius: 6px;
		background: #fafcff;
	}

	.cps-line {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		font-size: 12px;
		line-height: 1.4;
		padding: 6px 8px;
		border: 1px solid #d9ecff;
		border-radius: 6px;
		background: #fff;

		.cps-kpi {
			display: flex;
			flex: 0 0 116px;
			align-items: baseline;
			justify-content: space-between;
			gap: 8px;
			padding-right: 10px;
			border-right: 1px dashed #dcdfe6;
		}

		.cps-label {
			flex: 0 0 auto;
			color: #606266;
			font-weight: 600;
			white-space: nowrap;
		}

		strong {
			flex: 0 0 auto;
			color: #409eff;
			font-size: 20px;
			line-height: 1;
			font-weight: 800;
			font-variant-numeric: tabular-nums;
		}

		.cps-formula {
			min-width: 0;
			color: #606266;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&.is-actual {
			border-color: #fde2c4;
			background: #fffaf2;

			strong {
				color: #e6a23c;
			}

			.cps-kpi {
				border-right-color: #f3d4a7;
			}
		}
	}

	.coeff-range {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: 2px;
		min-width: 0;
		height: 100%;

		b {
			color: #303133;
			font-size: 12px;
			font-weight: 600;
			white-space: nowrap;
			line-height: 1.1;
		}

		em {
			color: #909399;
			font-size: 10px;
			font-style: normal;
			white-space: nowrap;
			line-height: 1.1;
		}
	}

	.coeff-empty {
		padding: 28px 0;
		color: #909399;
		font-size: 12px;
		text-align: center;
	}
}

.batch-summary-bar {
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 12px 16px;
	background: #f5f7fa;
	border-radius: 10px;
	border: 1px solid #e4e7ed;

	.summary-chip {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;

		&.is-help {
			cursor: help;
		}

		.chip-label {
			color: #909399;
		}

		.chip-value {
			font-weight: 700;
			color: #303133;
			font-size: 16px;
		}

		.chip-unit {
			color: #909399;
		}
	}
}

/* ========== 步骤 2 样式 ========== */
.step2-container {
	display: flex;
	flex-direction: column;
	gap: 12px;
	height: 100%;
}

.step2-header {
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 12px 16px;
	background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
	border-radius: 10px;
	border: 1px solid #bae6fd;
}

.step2-title {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 15px;
	font-weight: 600;
	color: #1e40af;
}

.step2-subtitle {
	font-size: 12px;
	color: #64748b;
}

.step2-scroll {
	flex: 1;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding-right: 4px;
}

.step2-card {
	background: #fff;
	border: 1px solid #e4e7ed;
	border-radius: 10px;
	padding: 14px 16px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	transition: box-shadow 0.2s;
}

.step2-card:hover {
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.batch-item-card:hover {
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.batch-item-card.no-sales {
	border-left: 3px solid #e6a23c;
	background: #fffbf0;
}

.batch-item-card.is-excluded {
	opacity: 0.5;
	border-color: #dcdfe6;
	background: #f9f9f9;
}

.item-exclude-btn {
	position: absolute;
	top: 6px;
	right: 6px;
	z-index: 10;
	cursor: pointer;
	opacity: 0;
	transition: opacity 0.2s;
}

.batch-item-card:hover .item-exclude-btn,
.batch-item-card.no-sales .item-exclude-btn,
.batch-item-card.is-excluded .item-exclude-btn {
	opacity: 1;
}

.exclude-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	border-radius: 50%;
	background: #f56c6c;
	color: #fff;
	font-size: 14px;
	font-weight: 700;
	line-height: 1;
	transition: transform 0.15s;
}

.exclude-icon:hover {
	transform: scale(1.15);
	background: #e04040;
}

.restore-label {
	display: inline-block;
	padding: 2px 8px;
	border-radius: 10px;
	background: #67c23a;
	color: #fff;
	font-size: 11px;
	font-weight: 600;
	cursor: pointer;
}

.restore-label:hover {
	background: #529e2e;
}

.excluded-overlay {
	position: absolute;
	inset: 0;
	background: rgba(255, 255, 255, 0.6);
	z-index: 5;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 10px;
}

.excluded-overlay span {
	padding: 4px 16px;
	background: #909399;
	color: #fff;
	border-radius: 20px;
	font-size: 12px;
	font-weight: 600;
	letter-spacing: 2px;
}

.s2-product-row {
	display: flex;
	align-items: center;
	gap: 10px;
}

.s2-index {
	width: 22px;
	height: 22px;
	border-radius: 50%;
	background: #f0f0f0;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	font-weight: 600;
	color: #909399;
	flex-shrink: 0;
}

.s2-image {
	flex-shrink: 0;
}

.img-placeholder-sm {
	width: 44px;
	height: 44px;
	border-radius: 6px;
	background: #f5f7fa;
	display: flex;
	align-items: center;
	justify-content: center;
}

.s2-info {
	flex: 1;
	min-width: 0;
}

.s2-name {
	font-size: 13px;
	font-weight: 500;
	color: #303133;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.s2-local-combined {
	display: flex;
	align-items: center;
	gap: 6px;
	max-width: 100%;
	margin-top: 2px;
	cursor: help;
}

.s2-local-name,
.s2-local-sku {
	display: inline-block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.s2-local-name {
	max-width: min(360px, 52vw);
	color: #303133;
	font-size: 12px;
	font-weight: 600;
}

.s2-local-sku {
	max-width: 160px;
	color: #909399;
	font-size: 11px;
}

.s2-meta {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-top: 2px;
}

.s2-sku {
	font-size: 11px;
	color: #909399;
}

.s2-shipping-row {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

.s2-ship-chip {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 3px 8px;
	background: #f5f7fa;
	border-radius: 12px;
	font-size: 11px;
}

.s2-ship-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex-shrink: 0;
}

.s2-ship-label {
	color: #606266;
}

.s2-ship-qty {
	font-weight: 600;
	color: #303133;
}

.s2-adjust-row {
	display: flex;
	align-items: center;
	gap: 16px;
	flex-wrap: wrap;
}

.s2-qty-section {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}

.s2-qty-item {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 2px;
}
.s2-qty-item.is-help {
	min-width: 72px;
	padding: 5px 8px;
	border: 1px dashed #c6e2ff;
	border-radius: 6px;
	background: #f8fbff;
	cursor: help;
	transition: all 0.15s ease;
}
.s2-qty-item.is-help:hover {
	border-color: #409eff;
	background: #ecf5ff;
	box-shadow: 0 2px 6px rgba(64, 158, 255, 0.12);
}
.s2-qty-item.is-help .s2-qty-label {
	color: #606266;
	border-bottom: 1px dashed #a0cfff;
	line-height: 1.2;
}
.s2-qty-item.is-help .s2-qty-value {
	color: #1677ff;
}

.s2-qty-label {
	font-size: 11px;
	color: #909399;
}

.s2-qty-value {
	font-size: 15px;
	font-weight: 600;
	color: #303133;
}

.s2-box-adjust-row {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
	min-width: 520px;
	padding: 6px 8px;
	border: 1px solid #e4e7ed;
	border-radius: 8px;
	background: #fbfdff;
}

.s2-box-input-wrap {
	display: flex;
	align-items: center;
	gap: 6px;
	flex-shrink: 0;
}

.s2-box-label {
	font-size: 11px;
	color: #909399;
	white-space: nowrap;
}

.s2-box-input {
	width: 118px;
}

.s2-box-final {
	min-width: 92px !important;
	border-color: #b7eb8f !important;
	background: #f6ffed !important;

	.s2-qty-value {
		color: #16a34a !important;
	}

	&.has-adjustment {
		border-color: #95d9b8 !important;
		background: #ecfdf5 !important;
	}
}

.s2-box-adjust-desc {
	flex: 1;
	min-width: 160px;
	color: #606266;
	font-size: 11px;
	line-height: 1.4;

	&.is-muted {
		color: #e6a23c;
	}
}

.s2-warehouse-wrap {
	display: flex;
	align-items: center;
	gap: 6px;
	flex-shrink: 0;
	padding: 5px 8px;
	border: 1px solid #e4e7ed;
	border-radius: 8px;
	background: #fff;

	&.is-readonly {
		background: #f8fbff;
		border-color: #d9ecff;
	}

	&.is-missing {
		background: #fef0f0;
		border-color: #fab6b6;

		.s2-warehouse-value {
			color: #c45656;
		}
	}
}

.s2-warehouse-label {
	font-size: 11px;
	color: #909399;
	white-space: nowrap;
}

.s2-warehouse-value {
	max-width: 120px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 12px;
	font-weight: 600;
	color: #303133;
}

.s2-final {
	padding: 4px 12px;
	background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
	border-radius: 8px;
	border: 1px solid #a7f3d0;
}

.s2-final-value {
	color: #059669 !important;
	font-size: 18px !important;
}

.s2-final-remark-row {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-top: 6px;
	padding: 0 12px;
}

.s2-final-remark-label {
	font-size: 11px;
	color: #909399;
	white-space: nowrap;
	flex-shrink: 0;
}

.s2-final-remark-text {
	flex: 1;
	min-width: 0;
	font-size: 11px;
	color: #606266;
	background: #f5f7fa;
	border: 1px solid #ebeef5;
	border-radius: 4px;
	padding: 3px 8px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.s2-debug-btn {
	flex-shrink: 0;
	font-size: 11px !important;
	color: #909399 !important;
}

.s2-purchase-remark-row {
	align-items: flex-start;
}

.s2-purchase-remark-text {
	white-space: normal;
	line-height: 1.45;
}

.s2-purchase-remark-tag {
	flex-shrink: 0;
	margin-top: 2px;
}

.step2-summary {
	display: flex;
	align-items: center;
	gap: 20px;
	flex-wrap: wrap;
	padding: 12px 16px;
	background: #f5f7fa;
	border-radius: 10px;
	border: 1px solid #e4e7ed;

	.summary-chip {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;

		.chip-label { color: #909399; }
		.chip-value { font-weight: 700; color: #303133; font-size: 16px; }
		.chip-unit { color: #909399; }

		&.highlight {
			padding: 6px 14px;
			background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
			border-radius: 8px;
			border: 1px solid #a7f3d0;

			.chip-label { color: #059669; }
			.chip-value { color: #059669; font-size: 20px; }
		}

		&.is-help {
			padding: 6px 12px;
			border: 1px dashed #c6e2ff;
			border-radius: 8px;
			background: #fff;
			cursor: help;
			transition: all 0.15s ease;

			.chip-label {
				color: #606266;
				border-bottom: 1px dashed #a0cfff;
				line-height: 1.2;
			}

			&:hover {
				border-color: #409eff;
				background: #ecf5ff;
				box-shadow: 0 2px 6px rgba(64, 158, 255, 0.12);
			}
		}

		&.highlight.is-help {
			border-color: #95d9b8;
			background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);

			.chip-label {
				color: #059669;
				border-bottom-color: #67c23a;
			}

			&:hover {
				border-color: #67c23a;
				background: #dcfce7;
				box-shadow: 0 2px 6px rgba(103, 194, 58, 0.14);
			}
		}

		&.box-delta {
			padding: 6px 12px;
			border: 1px solid #f3d19e;
			border-radius: 8px;
			background: #fdf6ec;

			.chip-value {
				color: #b88230;
			}

			&.is-zero {
				border-color: #e4e7ed;
				background: #fff;

				.chip-value {
					color: #606266;
				}
			}
		}

		&.box-warning {
			padding: 6px 12px;
			border: 1px solid #fab6b6;
			border-radius: 8px;
			background: #fef0f0;

			.chip-label,
			.chip-value {
				color: #c45656;
			}
		}
	}
}

.batch-footer {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	width: 100%;
}

/* 跨店补货 Step2 Banner */
.s2-cross-store-banner {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 8px;
	padding: 8px 12px;
	background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
	border: 1px solid #fed7aa;
	border-radius: 8px;
	border-left: 4px solid #f97316;

	.cs-banner-flow {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
	}
	.cs-banner-source, .cs-banner-target {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.cs-banner-label {
		font-size: 11px;
		color: #9ca3af;
	}
	.cs-banner-source .cs-banner-store {
		font-weight: 600;
		color: #059669;
	}
	.cs-banner-target .cs-banner-store {
		font-weight: 700;
		color: #ea580c;
	}
	.cs-banner-arrow {
		font-size: 16px;
	}
	.cs-banner-asin {
		font-size: 11px;
		color: #78716c;
		font-weight: 400;
	}
	.cs-banner-reset {
		padding: 4px;
		opacity: 0.5;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;

		&:hover {
			opacity: 1;
			background: rgba(234, 88, 12, 0.1);
			color: #ea580c;
		}
	}
}
.cross-store-popover {
	.cs-title {
		font-weight: 600;
		font-size: 13px;
		color: #303133;
		margin-bottom: 10px;
		padding-bottom: 8px;
		border-bottom: 1px solid #f0f0f0;
	}
	.cs-list {
		max-height: 280px;
		overflow-y: auto;
	}
	.cs-item {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 8px 10px;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.15s;
		margin-bottom: 4px;
		border: 1px solid transparent;
		&:hover { background: #f5f7fa; }
		&.is-current {
			background: #f0f9eb;
			border-color: #c2e7b0;
		}
		&.is-selected {
			background: #fdf6ec;
			border-color: #f5dab1;
		}
	}
	.cs-thumb {
		width: 44px;
		height: 44px;
		flex: 0 0 44px;
		border: 1px solid #ebeef5;
		border-radius: 6px;
		background: #fff;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.cs-img {
		width: 100%;
		height: 100%;
	}
	.cs-img-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f7f8fa;
	}
	.cs-item-body {
		flex: 1;
		min-width: 0;
	}
	.cs-item-main {
		display: flex;
		align-items: center;
		gap: 8px;
		.cs-shop {
			min-width: 0;
			max-width: 170px;
			font-weight: 600;
			font-size: 13px;
			color: #303133;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
	.cs-status-tag {
		margin-left: auto;
		flex-shrink: 0;
	}
	.cs-item-sub {
		font-size: 12px;
		color: #909399;
		margin-top: 5px;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 12px;
		row-gap: 3px;
	}
	.cs-field {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cs-field-label {
		margin-right: 4px;
		color: #a8abb2;
	}
}

.bulk-settings-body {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

.bulk-settings-section {
	padding: 12px;
	border: 1px solid #ebeef5;
	border-radius: 8px;
	background: #fbfcff;
}

.bulk-settings-title {
	margin-bottom: 10px;
	font-weight: 700;
	color: #303133;
}

.bulk-settings-row {
	display: flex;
	align-items: center;
	gap: 10px;
	flex-wrap: wrap;
}

.bulk-settings-label {
	width: 64px;
	font-size: 12px;
	color: #606266;
	white-space: nowrap;
}

.bulk-warehouse-select {
	width: 260px;
}

.bulk-settings-subtitle {
	margin: 12px 0 8px;
	font-size: 12px;
	font-weight: 600;
	color: #606266;
}

.bulk-method-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;

	&.is-disabled {
		opacity: 0.62;
	}
}

.bulk-method-card {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	padding: 10px;
	border: 1px solid #dcdfe6;
	border-radius: 8px;
	background: #fff;
	cursor: pointer;
	transition: border-color 0.16s, background-color 0.16s, box-shadow 0.16s;

	&:hover {
		border-color: #a0cfff;
		background: #f5faff;
	}

	&.is-selected {
		border-color: #409eff;
		background: #ecf5ff;
		box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.08);
	}

	&.is-disabled {
		cursor: not-allowed;
	}
}

.bulk-method-icon {
	flex: 0 0 auto;
	font-size: 18px;
	line-height: 1;
}

.bulk-method-body {
	min-width: 0;
	line-height: 1.25;
}

.bulk-method-name {
	font-size: 13px;
	font-weight: 700;
	color: #303133;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.bulk-method-days {
	margin-top: 3px;
	font-size: 12px;
	color: #909399;
	white-space: nowrap;
}

.bulk-target-input {
	width: 120px;
}

.bulk-settings-unit,
.bulk-settings-hint {
	font-size: 12px;
	color: #909399;
}

.bulk-settings-hint {
	margin-top: 8px;
	line-height: 1.5;
}

/* ========== 人工调整底部条带 ========== */
.manual-adjust-strip {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 6px;
	padding: 8px 16px;
	background: #f0f5ff;
	border-top: 1px solid #e8eaed;
	border-radius: 0 0 10px 10px;
	font-size: 12px;
	color: #606266;
	min-height: 76px;
}
.mas-main-row,
.mas-detail-row {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}
.mas-main-row {
	flex-wrap: wrap;
}
.mas-detail-row {
	flex-wrap: nowrap;
}
.mas-icon {
	font-size: 13px;
	flex-shrink: 0;
}
.mas-label {
	font-size: 12px;
	color: #86909c;
	white-space: nowrap;
	flex-shrink: 0;
}
.mas-formula {
	font-size: 12px;
	color: #86909c;
	white-space: nowrap;
	flex-shrink: 0;
}
.mas-final {
	font-size: 14px;
	font-weight: 700;
	color: #1d2129;
	min-width: 40px;
	flex-shrink: 0;
}
.mas-divider {
	width: 1px;
	height: 18px;
	background: #dcdfe6;
	flex-shrink: 0;
}
.mas-remark-group {
	display: grid;
	grid-template-columns: minmax(180px, 1fr) minmax(220px, 1fr);
	gap: 8px;
	flex: 1 1 520px;
	min-width: 360px;
}
.mas-field {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}
.mas-adjust-mode-field {
	flex: 0 0 auto;
}
.shipping-adjust-mode-toggle {
	display: inline-flex;
	align-items: center;
	padding: 2px;
	border: 1px solid #dcdfe6;
	border-radius: 7px;
	background: rgba(255, 255, 255, 0.72);
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
}
.shipping-adjust-mode-btn {
	height: 24px;
	min-width: 68px;
	padding: 0 10px;
	border: 0;
	border-radius: 5px;
	background: transparent;
	color: #606266;
	font-size: 12px;
	line-height: 24px;
	cursor: pointer;
	transition: color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease;

	&:hover {
		color: #2f6fe4;
		background: #ecf5ff;
	}

	&.is-active {
		color: #fff;
		background: #4169e1;
		box-shadow: 0 2px 6px rgba(65, 105, 225, 0.22);
	}
}
.mas-warehouse-field {
	flex: 0 0 auto;
}
.mas-warehouse-select {
	width: 180px;

	&.is-missing :deep(.el-input__wrapper) {
		box-shadow: 0 0 0 1px #f56c6c inset;
		background: #fff7f7;
	}
}
.mas-inline-error {
	color: #f56c6c;
	font-size: 12px;
	font-weight: 600;
	white-space: nowrap;
}
.mas-field-label {
	font-size: 12px;
	color: #86909c;
	white-space: nowrap;
	flex-shrink: 0;
}
.mas-field-tag {
	flex-shrink: 0;
}
.mas-remark,
.mas-purchase-remark {
	min-width: 0;
}
.mas-remark :deep(.el-input__wrapper),
.mas-purchase-remark :deep(.el-input__wrapper) {
	background: rgba(255, 255, 255, 0.8);
	box-shadow: 0 0 0 1px #e4e7ed inset;
}
.mas-summary-totals {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-left: auto;
	padding: 4px 10px;
	background: #fffafa;
	border: 1px solid #f7e6e6;
	border-radius: 6px;
	flex-shrink: 0;
}
.mst-item {
	display: flex;
	align-items: center;
	gap: 4px;
	white-space: nowrap;
}
.mst-item.is-help {
	cursor: help;
}
.mst-label {
	font-size: 12px;
	color: #909399;
}
.mst-value {
	font-size: 13px;
	font-weight: 700;
	color: #303133;
}
.mst-item.highlight .mst-label,
.mst-item.highlight .mst-value {
	color: #e6a23c;
}
</style>

<style>
/* 非 scoped：tooltip popper 渲染在 body 上 */
.final-remark-tooltip {
	max-width: 600px !important;
	word-break: break-all;
	white-space: pre-line;
	line-height: 1.6;
}
.cross-store-tooltip {
	white-space: pre-line !important;
	line-height: 1.6 !important;
}
.batch-local-product-tooltip {
	max-width: min(520px, calc(100vw - 24px)) !important;
	white-space: pre-line !important;
	word-break: break-all;
	line-height: 1.6 !important;
}
.qty-tooltip-content {
	font-size: 12px;
	line-height: 1.65;
	max-width: 460px;
	min-width: 280px;
	max-height: min(58vh, 480px);
	overflow-y: auto;
	overflow-x: hidden;
	padding-right: 4px;
	overscroll-behavior: contain;
	overflow-wrap: anywhere;
}
.qty-detail-tooltip {
	max-width: min(560px, calc(100vw - 24px)) !important;
	z-index: 3000 !important;
}
.inventory-usage-tooltip {
	max-width: none !important;
	padding: 10px 12px !important;
}
.inventory-usage-panel {
	--inventory-usage-grid: 126px minmax(178px, 1.05fr) 150px 62px 74px 74px 74px;
	box-sizing: border-box;
	width: min(820px, calc(100vw - 36px));
	font-size: 12px;
	line-height: 1.55;
}
.inventory-usage-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	margin-bottom: 6px;
	font-weight: 700;
	color: #ffffff;
}
.inventory-usage-head-total {
	color: #67c23a;
	white-space: nowrap;
}
.inventory-usage-period {
	margin-bottom: 6px;
	color: #cfd3dc;
}
.inventory-usage-summary-grid {
	display: grid;
	grid-template-columns: repeat(6, minmax(0, 1fr));
	gap: 6px;
	margin-bottom: 6px;
	padding: 7px 9px;
	border-radius: 4px;
	background: rgba(64, 158, 255, 0.12);
}
.inventory-usage-shortage {
	color: #f56c6c;
}
.inventory-usage-formula {
	margin-bottom: 6px;
	padding: 5px 8px;
	border-radius: 4px;
	background: rgba(230, 162, 60, 0.12);
	color: #f3d19e;
}
.inventory-usage-note {
	margin-bottom: 6px;
	padding: 5px 8px;
	border-radius: 4px;
	background: rgba(103, 194, 58, 0.12);
	color: #b3e19d;
}
.inventory-usage-table-head,
.inventory-usage-table-row,
.inventory-usage-table-total {
	display: grid;
	grid-template-columns: var(--inventory-usage-grid);
	column-gap: 8px;
	align-items: center;
	box-sizing: border-box;
}
.inventory-usage-table-head {
	padding: 5px 14px 5px 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.2);
	color: #d8dde8;
	font-size: 11px;
	font-weight: 700;
}
.inventory-usage-table-body {
	max-height: 208px;
	overflow-y: auto;
	overflow-x: hidden;
	padding-right: 8px;
	scrollbar-gutter: stable;
	overscroll-behavior: contain;
}
.inventory-usage-table-body::-webkit-scrollbar {
	width: 6px;
}
.inventory-usage-table-body::-webkit-scrollbar-track {
	background: rgba(255, 255, 255, 0.06);
	border-radius: 999px;
}
.inventory-usage-table-body::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.28);
	border-radius: 999px;
}
.inventory-usage-table-body::-webkit-scrollbar-thumb:hover {
	background: rgba(255, 255, 255, 0.42);
}
.inventory-usage-table-row {
	min-height: 31px;
	padding: 4px 0;
	border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
	font-size: 11px;
}
.inventory-usage-table-row > span,
.inventory-usage-table-head > span,
.inventory-usage-table-total > span {
	min-width: 0;
}
.inventory-usage-table-row .is-center {
	text-align: center;
	overflow-wrap: anywhere;
}
.inventory-usage-table-row .is-ellipsis {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.inventory-usage-table-head .is-num,
.inventory-usage-table-row .is-num,
.inventory-usage-table-total .is-num {
	text-align: right;
	white-space: nowrap;
}
.inventory-usage-table-row .is-used,
.inventory-usage-table-total {
	color: #e6a23c;
	font-weight: 700;
}
.inventory-usage-empty {
	padding: 10px 0;
	color: #a8abb2;
	text-align: center;
}
.inventory-usage-table-total {
	margin-top: 3px;
	padding: 7px 14px 2px 0;
	border-top: 1px solid rgba(255, 255, 255, 0.25);
}
.qty-tooltip-title {
	font-weight: 600;
	margin-bottom: 6px;
	color: #ffffff;
}
.qty-tooltip-block {
	display: flex;
	flex-direction: column;
	gap: 2px;
	margin-top: 6px;
}
.qty-tooltip-section {
	margin-top: 6px;
	padding-top: 6px;
	border-top: 1px solid rgba(255, 255, 255, 0.18);
	color: #d7e7ff;
	font-weight: 600;
}
.qty-tooltip-details {
	margin-top: 4px;
}
.qty-tooltip-details summary {
	cursor: pointer;
	color: #d7e7ff;
	font-weight: 600;
}
.qty-tooltip-details summary::-webkit-details-marker {
	color: #d7e7ff;
}
.qty-risk-details {
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px solid rgba(255, 255, 255, 0.18);
}
.qty-risk-details > summary {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	cursor: pointer;
	color: #ffffff;
	font-weight: 700;
	list-style: none;
}
.qty-risk-details > summary::-webkit-details-marker {
	display: none;
}
.qty-risk-details > summary::before {
	content: "▶";
	color: #d7e7ff;
	font-size: 10px;
	flex: 0 0 auto;
}
.qty-risk-details[open] > summary::before {
	content: "▼";
}
.qty-risk-summary-main {
	flex: 1 1 280px;
	min-width: 0;
}
.qty-risk-summary-hint {
	color: #d7e7ff;
	font-size: 11px;
	font-weight: 600;
	white-space: nowrap;
}
.qty-risk-body {
	margin-top: 6px;
	padding-left: 14px;
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.qty-risk-conclusion {
	margin-top: 4px;
	color: #ffffff;
	font-weight: 600;
}
.qty-risk-detail-title {
	margin-top: 6px;
	color: #d7e7ff;
	font-weight: 600;
}
.qty-risk-detail-list {
	max-height: 160px;
	overflow-y: auto;
	padding-left: 8px;
	border-left: 1px solid rgba(255, 255, 255, 0.18);
}
</style>

<!-- 非 scoped 样式：处理 teleported 到 body 的 alpha popover 面板 -->
<style>
.alpha-config-panel { padding: 4px 0; }
.alpha-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.alpha-title { font-size: 14px; font-weight: 700; color: #303133; }
.alpha-slider-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.alpha-range-labels { display: flex; justify-content: space-between; font-size: 11px; color: #909399; margin-bottom: 12px; }
.alpha-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>

<!-- 非 scoped 样式：趋势图悬停弹窗 -->
<style>
.trend-chart-popover {
	border-radius: 10px !important;
	box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12) !important;
	padding: 0 !important;
	overflow: hidden;
}
.trend-popover-content {
	padding: 12px 14px;
}
.trend-popover-title {
	font-size: 13px;
	font-weight: 600;
	color: #303133;
	margin-bottom: 8px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
