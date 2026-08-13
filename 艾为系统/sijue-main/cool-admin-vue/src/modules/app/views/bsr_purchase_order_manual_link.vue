<template>
	<div class="manual-link-page">
		<div class="page-toolbar">
			<div class="toolbar-title">
				<div class="title">采购单历史补全</div>
				<el-tag type="info" effect="plain">待到货 + 已完成</el-tag>
				<el-tag type="warning" effect="plain">未关联本地分析记录</el-tag>
				<el-tag type="success" effect="plain">写入完整补货快照</el-tag>
			</div>

			<div class="toolbar-actions">
				<el-button
					:icon="Refresh"
					:loading="refreshing"
					:disabled="loading"
					@click="refreshAll"
				>
					刷新
				</el-button>
			</div>
		</div>

		<el-tabs v-model="activeTab" class="mode-tabs" @tab-change="handleTabChange">
			<el-tab-pane label="待补全采购单" name="pending" />
			<el-tab-pane label="人工补全记录" name="completed" />
			<el-tab-pane label="自动补全记录" name="auto" />
		</el-tabs>

		<div v-if="activeTab === 'pending'" class="stats-bar">
			<button
				v-for="item in statsItems"
				:key="item.key"
				type="button"
				class="stats-item"
				:class="[item.tone, { active: activeMatchFilter === item.matchStatus }]"
				@click="applyStatsFilter(item.matchStatus)"
			>
				<span class="stats-value">{{ item.value }}</span>
				<span class="stats-label">{{ item.label }}</span>
			</button>
		</div>

		<div v-if="activeTab === 'pending'" class="manual-link-workbench">
			<div class="manual-link-workbench-main">
				<el-radio-group
					v-model="manualLinkWorkStatus"
					size="small"
					@change="handleManualLinkWorkStatusChange"
				>
					<el-radio-button label="current">待处理</el-radio-button>
					<el-radio-button label="shelved">已搁置</el-radio-button>
				</el-radio-group>
				<div class="manual-link-workbench-copy">
					<strong>{{ manualLinkWorkbenchTitle }}</strong>
					<span>{{ manualLinkWorkbenchHint }}</span>
				</div>
			</div>
			<div class="manual-link-workbench-actions">
				<el-button
					:type="isManualLinkShelvedWorkbench ? 'success' : 'warning'"
					plain
					:loading="manualLinkShelfLoading"
					:disabled="!manualLinkSelectedRows.length || manualLinkShelfLoading"
					@click="confirmManualLinkShelfAction('selected')"
				>
					{{ manualLinkShelfActionText }}选中 ({{
						manualLinkSelectedRows.length
					}})
				</el-button>
				<el-tooltip :content="manualLinkShelfFilterButtonTooltip" placement="top">
					<el-button
						:type="isManualLinkShelvedWorkbench ? 'success' : 'warning'"
						:loading="manualLinkShelfLoading"
						:disabled="manualLinkShelfLoading || loading"
						@click="confirmManualLinkShelfAction('filter')"
					>
						{{ manualLinkShelfFilterButtonText }}
					</el-button>
				</el-tooltip>
			</div>
		</div>

		<div v-else-if="activeTab === 'completed'" class="stats-bar completed-stats">
			<div
				v-for="item in completedStatsItems"
				:key="item.key"
				class="stats-item readonly completed-summary-item"
				:class="item.tone"
			>
				<span class="stats-value">{{ item.value }}</span>
				<span class="stats-label">{{ item.label }}</span>
			</div>
		</div>

		<div v-else class="auto-panel">
			<div class="stats-bar completed-stats auto-summary-bar">
				<button
					v-for="item in autoSummaryItems"
					:key="item.key"
					type="button"
					class="stats-item auto-summary-item"
					:class="[item.tone, { active: activeAutoStatusGroup === item.group }]"
					@click="applyAutoStatsFilter(item.group)"
				>
					<span class="stats-value">{{ item.value }}</span>
					<span class="stats-label" :title="item.label">{{ item.label }}</span>
					<span v-if="item.hint" class="stats-hint" :title="item.hint">{{ item.hint }}</span>
				</button>
			</div>
		</div>

		<div v-if="activeTab === 'pending'" class="filter-bar">
			<el-input
				v-model="filters.keyWord"
				clearable
				placeholder="采购单 / 计划号 / SKU / MSKU / 店铺"
				class="filter-keyword"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			>
				<template #prefix>
					<el-icon><Search /></el-icon>
				</template>
			</el-input>

			<el-select
				v-model="filters.match_status"
				clearable
				placeholder="匹配状态"
				class="filter-status"
				@change="handleMatchStatusChange"
				@clear="handleMatchStatusChange"
			>
				<el-option
					v-for="item in matchStatusOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>

			<el-select
				v-model="filters.purchase_order_statuses"
				multiple
				collapse-tags
				collapse-tags-tooltip
				clearable
				placeholder="采购状态"
				class="filter-order-status"
				@change="handleSearch"
				@clear="handleSearch"
			>
				<el-option label="待到货" :value="2" />
				<el-option label="已完成" :value="9" />
				<el-option label="待下单" :value="1" />
				<el-option label="待提交" :value="3" />
				<el-option label="作废" :value="-1" />
			</el-select>

			<el-input
				v-model="filters.seller_name"
				clearable
				placeholder="店铺"
				class="filter-small"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			/>

			<el-input
				v-model="filters.marketplace"
				clearable
				placeholder="国家"
				class="filter-mini"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			/>

			<el-switch
				v-model="filters.include_no_plan_blocked"
				active-text="显示无计划号"
				@change="handleSearch"
			/>

			<el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
			<el-button :icon="RefreshRight" @click="resetFilters">重置</el-button>
		</div>

		<div v-else-if="activeTab === 'completed'" class="filter-bar">
			<el-input
				v-model="completedFilters.keyWord"
				clearable
				placeholder="采购单 / 计划号 / ASIN / MSKU / 本地SKU / 操作人"
				class="filter-keyword"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			>
				<template #prefix>
					<el-icon><Search /></el-icon>
				</template>
			</el-input>

			<el-input
				v-model="completedFilters.seller_name"
				clearable
				placeholder="店铺"
				class="filter-small"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			/>

			<el-input
				v-model="completedFilters.marketplace"
				clearable
				placeholder="国家"
				class="filter-mini"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			/>

			<el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
			<el-button :icon="RefreshRight" @click="resetFilters">重置</el-button>
		</div>

		<div v-else class="filter-bar">
			<el-input
				v-model="autoFilters.keyWord"
				clearable
				placeholder="采购单 / 计划号 / ASIN / MSKU / 本地SKU / 错误原因"
				class="filter-keyword"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			>
				<template #prefix>
					<el-icon><Search /></el-icon>
				</template>
			</el-input>

			<el-input
				v-model="autoFilters.seller_name"
				clearable
				placeholder="店铺"
				class="filter-small"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			/>

			<el-input
				v-model="autoFilters.marketplace"
				clearable
				placeholder="国家"
				class="filter-mini"
				@keyup.enter="handleSearch"
				@clear="handleSearch"
			/>

			<el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
			<el-button :icon="RefreshRight" @click="resetFilters">重置</el-button>
		</div>

		<div v-if="activeTab === 'pending'" class="table-wrap">
			<el-table
				v-loading="loading"
				:data="tableData"
				border
				stripe
				:height="tableHeight"
				row-key="order_item_id"
				style="width: 100%"
				:row-class-name="getRowClassName"
				@selection-change="handleManualLinkSelectionChange"
			>
				<el-table-column type="selection" width="44" fixed="left" />
				<el-table-column width="126" fixed="left">
					<template #header>
						<span class="source-header">状态</span>
					</template>
					<template #default="{ row }">
						<div class="status-cell">
							<el-tag
								:type="getMatchStatusMeta(row.match_status).type"
								effect="plain"
							>
								{{ getMatchStatusMeta(row.match_status).label }}
							</el-tag>
							<el-tooltip
								v-if="isManualLinkShelved(row)"
								:content="getManualLinkShelfTooltip(row)"
								placement="top"
							>
								<el-tag size="small" type="warning" effect="plain">已搁置</el-tag>
							</el-tooltip>
							<span v-if="row.blocked_reason" class="status-reason">{{
								row.blocked_reason
							}}</span>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="采购单 / 计划" min-width="220" fixed="left">
					<template #default="{ row }">
						<div class="order-cell">
							<div class="order-line">
								<strong>{{ row.order_sn || "-" }}</strong>
								<el-tag size="small" effect="plain">{{
									row.purchase_order?.status_text || "-"
								}}</el-tag>
							</div>
							<div class="order-identities">
								<span><b>计划</b>{{ row.plan_sn || "-" }}</span>
								<span><b>批次</b>{{ row.purchase_plan?.ppg_sn || "-" }}</span>
								<span
									><b>店铺</b
									>{{
										row.purchase_plan?.seller_name ||
										row.item?.plan_seller_name ||
										"-"
									}}</span
								>
								<span
									><b>国家</b
									>{{
										row.purchase_plan?.marketplace ||
										row.item?.plan_marketplace ||
										"-"
									}}</span
								>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="产品信息" min-width="360" fixed="left">
					<template #default="{ row }">
						<div class="product-cell">
							<div class="product-image-wrap">
								<el-image
									v-if="getProductImage(row)"
									:src="getProductImage(row)"
									fit="contain"
									class="product-image"
									:preview-src-list="[getProductImage(row)]"
									preview-teleported
								/>
								<span v-else class="image-empty">无图</span>
							</div>
							<div class="product-main">
								<el-tooltip
									:content="
										row.item?.product_name ||
										row.purchase_plan?.product_name ||
										'-'
									"
									placement="top-start"
									:show-after="240"
								>
									<div class="product-title">
										{{
											row.item?.product_name ||
											row.purchase_plan?.product_name ||
											"-"
										}}
									</div>
								</el-tooltip>
								<div class="product-identities">
									<span
										><b>SKU</b
										>{{ row.item?.sku || row.purchase_plan?.sku || "-" }}</span
									>
									<span
										><b>FNSKU</b
										>{{
											row.item?.fnsku || row.purchase_plan?.fnsku || "-"
										}}</span
									>
									<span><b>首个MSKU</b>{{ row.item?.first_msku || "-" }}</span>
									<span><b>计划SKU</b>{{ row.purchase_plan?.sku || "-" }}</span>
								</div>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="候选店铺商品" min-width="300">
					<template #default="{ row }">
						<div v-if="row.suggested_listing" class="candidate-cell">
							<el-tag
								size="small"
								:type="getMatchStatusMeta(row.match_status).type"
								effect="plain"
							>
								{{ getMatchStatusMeta(row.match_status).label }}
							</el-tag>
							<div class="candidate-main">
								<div class="candidate-title">
									{{
										row.suggested_listing.item_name ||
										row.suggested_listing.local_name ||
										"-"
									}}
								</div>
								<div class="candidate-identities">
									<span><b>ASIN</b>{{ row.suggested_listing.asin || "-" }}</span>
									<span><b>MSKU</b>{{ row.suggested_listing.msku || "-" }}</span>
									<span
										><b>本地SKU</b
										>{{ row.suggested_listing.local_sku || "-" }}</span
									>
									<span
										><b>店铺</b
										>{{
											row.suggested_listing.shop ||
											row.suggested_listing.seller_name ||
											"-"
										}}</span
									>
								</div>
							</div>
						</div>
						<div
							v-else-if="row.match_status === 'manual_required'"
							class="manual-required-cell"
						>
							<el-tag size="small" type="warning" effect="plain">需人工选品</el-tag>
							<span>未找到自动候选商品</span>
						</div>
						<div v-else class="manual-required-cell">
							<el-tag size="small" type="danger" effect="plain">无法处理</el-tag>
							<span>{{ row.blocked_reason || "-" }}</span>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="数量" min-width="220">
					<template #default="{ row }">
						<div class="qty-grid">
							<div>
								<span>明细计划</span
								><b>{{ formatNumber(row.item?.quantity_plan) }}</b>
							</div>
							<div>
								<span>实际采购</span
								><b>{{ formatNumber(row.item?.quantity_real) }}</b>
							</div>
							<div>
								<span>入库量</span
								><b>{{ formatNumber(row.item?.quantity_entry) }}</b>
							</div>
							<div>
								<span>待到货</span
								><b>{{ formatNumber(row.item?.quantity_receive) }}</b>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="时间" min-width="190">
					<template #default="{ row }">
						<div class="time-cell">
							<span><b>下单</b>{{ formatDate(row.purchase_order?.order_time) }}</span>
							<span
								><b>期望到货</b>{{ formatDate(row.item?.expect_arrive_time) }}</span
							>
							<span
								><b>更新</b
								>{{ formatDate(row.purchase_order?.update_time_remote) }}</span
							>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="操作" width="112" fixed="right" align="center">
					<template #default="{ row }">
						<el-button
							v-if="isManualLinkShelvedWorkbench"
							type="success"
							size="small"
							@click="confirmManualLinkShelfAction('selected', [row])"
						>
							恢复
						</el-button>
						<el-tooltip
							v-else
							:disabled="row.match_status !== 'blocked'"
							:content="row.blocked_reason || '无法处理'"
							placement="top"
						>
							<span>
								<el-button
									type="primary"
									size="small"
									:disabled="row.match_status === 'blocked'"
									@click="openDialog(row)"
								>
									完整补全
								</el-button>
							</span>
						</el-tooltip>
					</template>
				</el-table-column>
			</el-table>
		</div>

		<div v-else-if="activeTab === 'completed'" class="table-wrap">
			<el-table
				v-loading="loading"
				:data="completedData"
				border
				stripe
				:height="tableHeight"
				row-key="snapshot_id"
				style="width: 100%"
			>
				<el-table-column label="补全信息" min-width="190" fixed="left">
					<template #default="{ row }">
						<div class="completed-meta">
							<div class="completed-meta-block">
								<span class="completed-meta-label">补全时间</span>
								<strong>{{ formatDate(row.completed_time) }}</strong>
							</div>
							<div class="completed-meta-block">
								<span class="completed-meta-label">操作人</span>
								<el-tag
									size="small"
									type="success"
									effect="plain"
									class="operator-tag"
								>
									{{ row.created_by_name || "-" }}
								</el-tag>
							</div>
							<div class="completed-status-line">
								<span class="completed-meta-label">快照状态</span>
								<el-tag
									size="small"
									:type="getCompletedQualityType(row)"
									effect="plain"
								>
									{{ row.snapshot_quality?.snapshot_label || "-" }}
								</el-tag>
							</div>
							<span
								v-if="row.snapshot_quality?.missing_sections?.length"
								class="status-reason"
							>
								缺少 {{ getSnapshotMissingText(row) }}
							</span>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="采购单 / 计划" min-width="230" fixed="left">
					<template #default="{ row }">
						<div class="order-cell">
							<div class="order-line">
								<strong>{{
									row.order_sns?.join(", ") || row.representative_order_sn || "-"
								}}</strong>
								<el-tag size="small" effect="plain"
									>明细 {{ row.linked_order_item_count || 0 }}</el-tag
								>
							</div>
							<div class="order-identities">
								<span><b>计划</b>{{ row.plan_sn || "-" }}</span>
								<span><b>批次</b>{{ row.ppg_sn || "-" }}</span>
								<span><b>店铺</b>{{ row.purchase_plan?.seller_name || "-" }}</span>
								<span
									><b>国家</b
									>{{
										row.purchase_plan?.marketplace ||
										row.listing?.marketplace ||
										"-"
									}}</span
								>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="产品 / 店铺商品" min-width="360">
					<template #default="{ row }">
						<div class="product-cell">
							<div class="product-image-wrap">
								<el-image
									v-if="getCompletedProductImage(row)"
									:src="getCompletedProductImage(row)"
									fit="contain"
									class="product-image"
									:preview-src-list="[getCompletedProductImage(row)]"
									preview-teleported
								/>
								<span v-else class="image-empty">无图</span>
							</div>
							<div class="product-main">
								<el-tooltip
									:content="getCompletedProductTitle(row)"
									placement="top-start"
									:show-after="240"
								>
									<div class="product-title">
										{{ getCompletedProductTitle(row) }}
									</div>
								</el-tooltip>
								<div class="product-identities">
									<span><b>ASIN</b>{{ row.listing?.asin || "-" }}</span>
									<span><b>MSKU</b>{{ row.listing?.msku || "-" }}</span>
									<span><b>本地SKU</b>{{ row.listing?.local_sku || "-" }}</span>
									<span><b>SKU</b>{{ row.order_item?.sku || "-" }}</span>
								</div>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="补货快照" min-width="300">
					<template #default="{ row }">
						<div class="qty-grid completed-qty">
							<div>
								<span>最终采购</span
								><b>{{ formatNumber(row.replenish?.final_purchase_qty) }}</b>
							</div>
							<div>
								<span>系统建议</span
								><b>{{ formatNumber(row.replenish?.system_suggested_qty) }}</b>
							</div>
							<div>
								<span>算法</span><b>{{ row.replenish?.algorithm_name || "-" }}</b>
							</div>
							<div>
								<span>仓库</span><b>{{ row.replenish?.warehouse_name || "-" }}</b>
							</div>
						</div>
						<div class="time-cell completed-cycle">
							<span
								><b>周期</b>{{ formatDateOnly(row.replenish?.cycle_start_date) }} ~
								{{ formatDateOnly(row.replenish?.cycle_end_date) }}</span
							>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="操作" width="128" fixed="right" align="center">
					<template #default="{ row }">
						<div class="completed-actions">
							<el-popover trigger="click" placement="left" width="320">
								<template #reference>
									<el-button size="small">摘要</el-button>
								</template>
								<div class="snapshot-summary">
									<div><b>计划号</b>{{ row.plan_sn || "-" }}</div>
									<div><b>操作人</b>{{ row.created_by_name || "-" }}</div>
									<div><b>补全时间</b>{{ formatDate(row.completed_time) }}</div>
									<div>
										<b>采购量</b
										>{{ formatNumber(row.replenish?.final_purchase_qty) }}
									</div>
									<div><b>仓库</b>{{ row.replenish?.warehouse_name || "-" }}</div>
									<div>
										<b>店铺商品</b>{{ row.listing?.asin || "-" }} /
										{{ row.listing?.msku || "-" }}
									</div>
									<div v-if="row.snapshot_quality?.missing_sections?.length">
										<b>缺少内容</b>{{ getSnapshotMissingText(row) }}
									</div>
									<div class="snapshot-summary-actions">
										<el-button
											size="small"
											type="primary"
											link
											@click="openProductView(row)"
											>查看关联产品</el-button
										>
									</div>
								</div>
							</el-popover>
							<el-button
								size="small"
								:icon="CopyDocument"
								@click="copyCompletedInfo(row)"
								>复制</el-button
							>
						</div>
					</template>
				</el-table-column>
			</el-table>
		</div>

		<div v-else class="table-wrap">
			<el-table
				v-loading="loading"
				:data="autoData"
				border
				stripe
				:height="tableHeight"
				row-key="plan_sn"
				style="width: 100%"
			>
				<el-table-column label="自动补全状态" min-width="210" fixed="left">
					<template #default="{ row }">
						<div class="completed-meta">
							<div class="completed-meta-block">
								<span class="completed-meta-label">最近运行</span>
								<strong>{{ formatDate(row.last_run_time) }}</strong>
							</div>
							<div class="completed-status-line">
								<span class="completed-meta-label">状态</span>
								<el-tag
									size="small"
									:type="getAutoStatusType(row.status)"
									effect="plain"
								>
									{{ row.status_label || "-" }}
								</el-tag>
							</div>
							<span v-if="getAutoProblemText(row)" class="status-reason">
								{{ getAutoProblemText(row) }}
							</span>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="采购单 / 计划" min-width="240" fixed="left">
					<template #default="{ row }">
						<div class="order-cell">
							<div class="order-line">
								<strong>{{ row.order_sn || "-" }}</strong>
								<el-tag size="small" effect="plain">自动补全</el-tag>
							</div>
							<div class="order-identities">
								<span><b>计划</b>{{ row.plan_sn || "-" }}</span>
								<span><b>批次</b>{{ row.ppg_sn || "-" }}</span>
								<span><b>店铺</b>{{ row.seller_name || "-" }}</span>
								<span><b>国家</b>{{ row.marketplace || "-" }}</span>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="产品 / 店铺商品" min-width="360">
					<template #default="{ row }">
						<div class="product-cell">
							<div class="product-image-wrap">
								<el-image
									v-if="row.pic_url"
									:src="row.pic_url"
									fit="contain"
									class="product-image"
									:preview-src-list="[row.pic_url]"
									preview-teleported
								/>
								<span v-else class="image-empty">无图</span>
							</div>
							<div class="product-main">
								<el-tooltip
									:content="row.product_name || '-'"
									placement="top-start"
									:show-after="240"
								>
									<div class="product-title">{{ row.product_name || "-" }}</div>
								</el-tooltip>
								<div class="product-identities">
									<span><b>ASIN</b>{{ row.asin || "-" }}</span>
									<span><b>MSKU</b>{{ row.msku || "-" }}</span>
									<span><b>本地SKU</b>{{ row.local_sku || "-" }}</span>
									<span><b>SKU</b>{{ row.sku || "-" }}</span>
								</div>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="数量 / 仓库" min-width="300">
					<template #default="{ row }">
						<div class="qty-grid completed-qty">
							<div>
								<span>采购数量</span><b>{{ formatNumber(row.purchase_qty) }}</b>
							</div>
							<div>
								<span>分配合计</span><b>{{ formatNumber(row.allocation_total) }}</b>
							</div>
							<div>
								<span>仓库</span>
								<b>{{
									row.warehouse_name ||
									(row.warehouse_confirmation_required ? "未匹配" : "-")
								}}</b>
							</div>
							<div>
								<span>快照ID</span><b>{{ row.snapshot_id || "-" }}</b>
							</div>
						</div>
						<div
							v-if="row.warehouse_confirmation_required"
							class="time-cell completed-cycle"
						>
							<span class="status-reason">仓库未匹配真实仓库，后续需人工确认</span>
						</div>
					</template>
				</el-table-column>

				<el-table-column label="操作" width="128" fixed="right" align="center">
					<template #default="{ row }">
						<div class="completed-actions">
							<el-button size="small" @click="openAutoDetail(row)">详情</el-button>
							<el-button size="small" :icon="CopyDocument" @click="copyAutoInfo(row)"
								>复制</el-button
							>
						</div>
					</template>
				</el-table-column>
			</el-table>
		</div>

		<div v-if="activeTab === 'pending'" class="pagination-wrap">
			<el-pagination
				v-model:current-page="pagination.page"
				v-model:page-size="pagination.size"
				:page-sizes="[10, 20, 30, 50]"
				:total="pagination.total"
				layout="total, sizes, prev, pager, next, jumper"
				background
				@size-change="handlePageSizeChange"
				@current-change="loadData"
			/>
		</div>

		<div v-else-if="activeTab === 'completed'" class="pagination-wrap">
			<el-pagination
				v-model:current-page="completedPagination.page"
				v-model:page-size="completedPagination.size"
				:page-sizes="[10, 20, 30, 50]"
				:total="completedPagination.total"
				layout="total, sizes, prev, pager, next, jumper"
				background
				@size-change="handlePageSizeChange"
				@current-change="loadCompletedData"
			/>
		</div>

		<div v-else class="pagination-wrap">
			<el-pagination
				v-model:current-page="autoPagination.page"
				v-model:page-size="autoPagination.size"
				:page-sizes="[10, 20, 30, 50]"
				:total="autoPagination.total"
				layout="total, sizes, prev, pager, next, jumper"
				background
				@size-change="handlePageSizeChange"
				@current-change="loadAutoData"
			/>
		</div>

		<PurchaseOrderManualLinkDialog
			v-model:visible="dialogVisible"
			:row="activeRow"
			@completed="handleCompleted"
		/>

		<PurchasePlanRemarkAutoCompleteDetailDialog
			v-model:visible="autoDetailVisible"
			:loading="autoDetailLoading"
			:detail="autoDetailData"
		/>
	</div>
</template>

<script lang="ts" name="app-bsr_purchase_order_manual_link" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox } from "element-plus";
import { CopyDocument, Refresh, RefreshRight, Search } from "@element-plus/icons-vue";
import PurchasePlanRemarkAutoCompleteDetailDialog from "../components/PurchasePlanRemarkAutoCompleteDetailDialog.vue";
import PurchaseOrderManualLinkDialog from "../components/PurchaseOrderManualLinkDialog.vue";

type MatchStatus =
	| "auto_item_first_msku"
	| "auto_plan_local_sku"
	| "auto_plan_msku"
	| "manual_required"
	| "blocked";

type MatchFilter = "" | MatchStatus | "auto_candidate";
type AutoStatusGroup = "available" | "problem" | "skipped" | "all";

const DEFAULT_ORDER_STATUSES = [2, 9];
const AUTO_MATCH_STATUSES: MatchStatus[] = [
	"auto_item_first_msku",
	"auto_plan_local_sku",
	"auto_plan_msku"
];

const { service } = useCool();
const manualLinkService = computed(() => (service.app as any).bsr_purchase_order_manual_link);
const remarkAutoCompleteService = computed(
	() => (service.app as any).bsr_purchase_plan_remark_auto_complete
);

const loading = ref(false);
const refreshing = ref(false);
const tableData = ref<any[]>([]);
const completedData = ref<any[]>([]);
const autoData = ref<any[]>([]);
const dialogVisible = ref(false);
const activeRow = ref<any | null>(null);
const autoDetailVisible = ref(false);
const autoDetailLoading = ref(false);
const autoDetailData = ref<any | null>(null);
const activeMatchFilter = ref<MatchFilter>("");
const activeAutoStatusGroup = ref<AutoStatusGroup>("available");
const activeTab = ref<"pending" | "completed" | "auto">("pending");
const manualLinkWorkStatus = ref<"current" | "shelved">("current");
const manualLinkSelectedRows = ref<any[]>([]);
const manualLinkShelfLoading = ref(false);

const tableHeight = computed(() => "100%");

const pagination = reactive({
	page: 1,
	size: 10,
	total: 0
});

const completedPagination = reactive({
	page: 1,
	size: 10,
	total: 0
});

const autoPagination = reactive({
	page: 1,
	size: 10,
	total: 0
});

const filters = reactive({
	keyWord: "",
	match_status: "" as "" | MatchStatus,
	purchase_order_statuses: [...DEFAULT_ORDER_STATUSES] as number[],
	seller_name: "",
	marketplace: "",
	include_no_plan_blocked: false
});

const completedFilters = reactive({
	keyWord: "",
	seller_name: "",
	marketplace: ""
});

const autoFilters = reactive({
	keyWord: "",
	seller_name: "",
	marketplace: ""
});

const stats = reactive({
	total_unlinked: 0,
	total_orders: 0,
	pending_linkable: 0,
	auto_candidate: 0,
	manual_required: 0,
	blocked: 0,
	by_match_status: {
		auto_item_first_msku: 0,
		auto_plan_local_sku: 0,
		auto_plan_msku: 0,
		manual_required: 0,
		blocked: 0
	} as Record<MatchStatus, number>
});

const completedStats = reactive({
	total_completed: 0,
	total_orders: 0,
	total_operators: 0,
	latest_completed_time: null as any
});

const autoStats = reactive({
	total: 0,
	success: 0,
	success_with_warnings: 0,
	failed: 0,
	needs_attention: 0,
	skipped: 0,
	latest_run_time: null as any
});

const matchStatusOptions: Array<{
	value: MatchStatus;
	label: string;
	type: "success" | "primary" | "warning" | "danger";
}> = [
	{ value: "auto_item_first_msku", label: "明细 MSKU 匹配", type: "success" },
	{ value: "auto_plan_local_sku", label: "计划本地 SKU 匹配", type: "primary" },
	{ value: "auto_plan_msku", label: "计划 MSKU 匹配", type: "primary" },
	{ value: "manual_required", label: "需人工选品", type: "warning" },
	{ value: "blocked", label: "无法处理", type: "danger" }
];

const statsItems = computed<
	Array<{ key: string; label: string; value: number; matchStatus: MatchFilter; tone: string }>
>(() => [
	{
		key: "all",
		label: `${
			manualLinkWorkStatus.value === "shelved" ? "已搁置" : "待处理"
		} / ${stats.total_orders} 单`,
		value: stats.total_unlinked,
		matchStatus: "",
		tone: "primary"
	},
	{
		key: "auto",
		label: "自动候选",
		value: stats.auto_candidate,
		matchStatus: "auto_candidate",
		tone: "success"
	},
	{
		key: "manual",
		label: "需人工选品",
		value: stats.manual_required,
		matchStatus: "manual_required",
		tone: "warning"
	},
	{
		key: "blocked",
		label: "无法处理",
		value: stats.blocked,
		matchStatus: "blocked",
		tone: "danger"
	}
]);

const isManualLinkShelvedWorkbench = computed(() => manualLinkWorkStatus.value === "shelved");
const manualLinkShelfActionText = computed(() =>
	isManualLinkShelvedWorkbench.value ? "恢复" : "搁置"
);
const manualLinkShelfFilterButtonText = computed(() =>
	isManualLinkShelvedWorkbench.value ? "恢复筛选结果..." : "搁置筛选结果..."
);
const manualLinkShelfFilterButtonTooltip = computed(
	() => "按当前搜索、匹配状态、采购状态、店铺、国家等筛选条件批量处理；不是产品规则，不影响未来新单。"
);
const manualLinkWorkbenchTitle = computed(() =>
	isManualLinkShelvedWorkbench.value ? "已搁置的采购单产品明细" : "待处理的采购单产品明细"
);
const manualLinkWorkbenchHint = computed(() =>
	isManualLinkShelvedWorkbench.value
		? "这里可以查看历史搁置记录，并把选中的明细恢复回待处理。"
		: "每行是采购单里的一个产品明细；搁置只影响当前已有明细，不影响未来新单。"
);

const completedStatsItems = computed(() => [
	{
		key: "completed",
		label: "已补全记录",
		value: completedStats.total_completed,
		tone: "success"
	},
	{
		key: "orders",
		label: "涉及采购单",
		value: completedStats.total_orders,
		tone: "primary"
	},
	{
		key: "operators",
		label: "操作人数",
		value: completedStats.total_operators,
		tone: "warning"
	},
	{
		key: "latest",
		label: "最近补全",
		value: formatDate(completedStats.latest_completed_time),
		tone: "info"
	}
]);

const autoSummaryItems = computed(() => [
	{
		key: "success",
		label: "成功优先",
		value: autoStats.success + autoStats.success_with_warnings,
		tone: "success",
		hint: `成功 ${autoStats.success} / 有警告 ${autoStats.success_with_warnings}`,
		group: "available" as AutoStatusGroup
	},
	{
		key: "problem",
		label: "失败 / 需处理",
		value: autoStats.failed + autoStats.needs_attention,
		tone: "danger",
		hint: `失败 ${autoStats.failed} / 需处理 ${autoStats.needs_attention}`,
		group: "problem" as AutoStatusGroup
	},
	{
		key: "skipped",
		label: "已跳过",
		value: autoStats.skipped,
		tone: "info",
		hint: "无配置块或受保护",
		group: "skipped" as AutoStatusGroup
	},
	{
		key: "total",
		label: "全部记录",
		value: autoStats.total,
		tone: "primary",
		hint: `最近运行 ${formatDate(autoStats.latest_run_time)}`,
		group: "all" as AutoStatusGroup
	}
]);

const snapshotSectionLabels: Record<string, string> = {
	calculation_json: "计算过程",
	shipping_json: "运输段",
	coefficient_json: "系数复盘",
	inventory_json: "库存推演"
};

function getMatchStatusMeta(status: MatchStatus) {
	return (
		matchStatusOptions.find((item) => item.value === status) || {
			label: status || "-",
			type: "info"
		}
	);
}

function buildBaseParams(includeMatchStatus = true) {
	const params: Record<string, any> = {
		keyWord: filters.keyWord,
		purchase_order_statuses: filters.purchase_order_statuses.length
			? filters.purchase_order_statuses
			: DEFAULT_ORDER_STATUSES,
		seller_name: filters.seller_name,
		marketplace: filters.marketplace,
		include_no_plan_blocked: filters.include_no_plan_blocked,
		work_status: manualLinkWorkStatus.value
	};

	if (includeMatchStatus) {
		if (activeMatchFilter.value === "auto_candidate") {
			params.match_status = AUTO_MATCH_STATUSES;
		} else if (activeMatchFilter.value) {
			params.match_status = activeMatchFilter.value;
		}
	}

	return params;
}

function buildCompletedParams() {
	return {
		keyWord: completedFilters.keyWord,
		seller_name: completedFilters.seller_name,
		marketplace: completedFilters.marketplace
	};
}

function buildAutoParams() {
	return {
		keyword: autoFilters.keyWord,
		status_group: activeAutoStatusGroup.value,
		seller_name: autoFilters.seller_name,
		marketplace: autoFilters.marketplace
	};
}

async function loadStats() {
	try {
		const res = await manualLinkService.value.stats(buildBaseParams(false));
		stats.total_unlinked = Number(res?.total_unlinked) || 0;
		stats.total_orders = Number(res?.total_orders) || 0;
		stats.pending_linkable = Number(res?.pending_linkable) || 0;
		stats.auto_candidate = Number(res?.auto_candidate) || 0;
		stats.manual_required = Number(res?.manual_required) || 0;
		stats.blocked = Number(res?.blocked) || 0;
		stats.by_match_status = {
			auto_item_first_msku: Number(res?.by_match_status?.auto_item_first_msku) || 0,
			auto_plan_local_sku: Number(res?.by_match_status?.auto_plan_local_sku) || 0,
			auto_plan_msku: Number(res?.by_match_status?.auto_plan_msku) || 0,
			manual_required: Number(res?.by_match_status?.manual_required) || 0,
			blocked: Number(res?.by_match_status?.blocked) || 0
		};
	} catch (error: any) {
		ElMessage.error(error?.message || "加载统计失败");
	}
}

async function loadCompletedStats() {
	try {
		const res = await manualLinkService.value.completedStats(buildCompletedParams());
		completedStats.total_completed = Number(res?.total_completed) || 0;
		completedStats.total_orders = Number(res?.total_orders) || 0;
		completedStats.total_operators = Number(res?.total_operators) || 0;
		completedStats.latest_completed_time = res?.latest_completed_time || null;
	} catch (error: any) {
		ElMessage.error(error?.message || "加载已补全统计失败");
	}
}

async function loadAutoStats() {
	try {
		const res = await remarkAutoCompleteService.value.statusStats(buildAutoParams());
		autoStats.total = Number(res?.total) || 0;
		autoStats.success = Number(res?.success) || 0;
		autoStats.success_with_warnings = Number(res?.success_with_warnings) || 0;
		autoStats.failed = Number(res?.failed) || 0;
		autoStats.needs_attention = Number(res?.needs_attention) || 0;
		autoStats.skipped = Number(res?.skipped) || 0;
		autoStats.latest_run_time = res?.latest_run_time || null;
	} catch (error: any) {
		ElMessage.error(error?.message || "加载自动补全统计失败");
	}
}

async function loadData() {
	loading.value = true;
	try {
		const res = await manualLinkService.value.page({
			...buildBaseParams(true),
			page: pagination.page,
			size: pagination.size
		});
		tableData.value = Array.isArray(res?.list) ? res.list : [];
		pagination.total = Number(res?.pagination?.total) || 0;
		manualLinkSelectedRows.value = [];
		return true;
	} catch (error: any) {
		ElMessage.error(error?.message || "加载采购单补全列表失败");
		return false;
	} finally {
		loading.value = false;
	}
}

async function loadCompletedData() {
	loading.value = true;
	try {
		const res = await manualLinkService.value.completedPage({
			...buildCompletedParams(),
			page: completedPagination.page,
			size: completedPagination.size
		});
		completedData.value = Array.isArray(res?.list) ? res.list : [];
		completedPagination.total = Number(res?.pagination?.total) || 0;
		return true;
	} catch (error: any) {
		ElMessage.error(error?.message || "加载已补全记录失败");
		return false;
	} finally {
		loading.value = false;
	}
}

async function loadAutoData() {
	loading.value = true;
	try {
		const res = await remarkAutoCompleteService.value.statusPage({
			...buildAutoParams(),
			page: autoPagination.page,
			size: autoPagination.size
		});
		autoData.value = Array.isArray(res?.list) ? res.list : [];
		autoPagination.total = Number(res?.total) || 0;
		return true;
	} catch (error: any) {
		ElMessage.error(error?.message || "加载自动补全记录失败");
		return false;
	} finally {
		loading.value = false;
	}
}

async function refreshAll() {
	if (loading.value) return;

	refreshing.value = true;
	try {
		if (activeTab.value === "completed") {
			await Promise.all([loadCompletedStats(), loadCompletedData()]);
		} else if (activeTab.value === "auto") {
			await Promise.all([loadAutoStats(), loadAutoData()]);
		} else {
			await Promise.all([loadStats(), loadData(), loadCompletedStats(), loadAutoStats()]);
		}
	} finally {
		refreshing.value = false;
	}
}

function handleSearch() {
	if (activeTab.value === "completed") {
		completedPagination.page = 1;
	} else if (activeTab.value === "auto") {
		autoPagination.page = 1;
	} else {
		pagination.page = 1;
	}
	refreshAll();
}

function resetFilters() {
	if (activeTab.value === "completed") {
		completedFilters.keyWord = "";
		completedFilters.seller_name = "";
		completedFilters.marketplace = "";
		completedPagination.page = 1;
	} else if (activeTab.value === "auto") {
		autoFilters.keyWord = "";
		activeAutoStatusGroup.value = "available";
		autoFilters.seller_name = "";
		autoFilters.marketplace = "";
		autoPagination.page = 1;
	} else {
		filters.keyWord = "";
		filters.match_status = "";
		activeMatchFilter.value = "";
		filters.purchase_order_statuses = [...DEFAULT_ORDER_STATUSES];
		filters.seller_name = "";
		filters.marketplace = "";
		filters.include_no_plan_blocked = false;
		pagination.page = 1;
	}
	refreshAll();
}

function handlePageSizeChange() {
	if (activeTab.value === "completed") {
		completedPagination.page = 1;
		loadCompletedData();
	} else if (activeTab.value === "auto") {
		autoPagination.page = 1;
		loadAutoData();
	} else {
		pagination.page = 1;
		loadData();
	}
}

function handleTabChange() {
	manualLinkSelectedRows.value = [];
	refreshAll();
}

function handleMatchStatusChange() {
	activeMatchFilter.value = filters.match_status || "";
	handleSearch();
}

function applyStatsFilter(status: MatchFilter) {
	activeMatchFilter.value = status;
	filters.match_status = status === "auto_candidate" ? "" : status;
	handleSearch();
}

function handleManualLinkWorkStatusChange() {
	manualLinkSelectedRows.value = [];
	pagination.page = 1;
	refreshAll();
}

function handleManualLinkSelectionChange(rows: any[]) {
	manualLinkSelectedRows.value = Array.isArray(rows) ? rows : [];
}

function getManualLinkOrderItemIds(rows: any[]) {
	return Array.from(
		new Set(
			(rows || [])
				.map((row) => Number(row?.order_item_id))
				.filter((id) => Number.isFinite(id) && id > 0)
		)
	);
}

async function previewManualLinkShelfByFilter() {
	const res = await manualLinkService.value.shelfPreview({
		...buildBaseParams(true),
		work_status: manualLinkWorkStatus.value
	});
	return {
		total: Number(res?.total) || 0,
		total_orders: Number(res?.total_orders) || 0
	};
}

function buildManualLinkShelfConfirmMessage(
	scope: "selected" | "filter",
	count: number,
	totalOrders = 0
) {
	const action = manualLinkShelfActionText.value;
	if (scope === "filter") {
		const targetText = `将${action} ${count} 个采购单产品明细，涉及 ${totalOrders} 张采购单。`;
		const nextText = isManualLinkShelvedWorkbench.value
			? "恢复后会回到待处理列表。"
			: "搁置后默认列表不再显示这些历史明细。";
		return [
			'<div style="line-height:1.7;color:var(--el-text-color-regular);">',
			`<p style="margin:0 0 6px;"><strong style="color:var(--el-text-color-primary);">${targetText}</strong></p>`,
			'<p style="margin:0;">这是当前筛选条件下的全部结果，不只是当前页。</p>',
			'<p style="margin:0;">这里只处理当前已存在的采购单产品明细；不是产品规则，不影响未来新同步的采购单。</p>',
			`<p style="margin:6px 0 0;color:var(--el-text-color-secondary);">${nextText}</p>`,
			"</div>"
		].join("");
	}

	const nextText = isManualLinkShelvedWorkbench.value
		? "恢复后会回到待处理列表。"
		: "搁置后默认列表不再显示这些历史明细。";
	return [
		'<div style="line-height:1.7;color:var(--el-text-color-regular);">',
		`<p style="margin:0 0 6px;"><strong style="color:var(--el-text-color-primary);">${action}选中的 ${count} 个采购单产品明细。</strong></p>`,
		`<p style="margin:0;">${nextText}</p>`,
		'<p style="margin:0;color:var(--el-text-color-secondary);">这里只处理当前已存在的明细，不影响未来新同步的采购单。</p>',
		"</div>"
	].join("");
}

async function confirmManualLinkShelfAction(scope: "selected" | "filter", rows?: any[]) {
	if (manualLinkShelfLoading.value) return;

	const actionText = manualLinkShelfActionText.value;
	const targetRows = rows || manualLinkSelectedRows.value;
	let targetCount = scope === "selected" ? getManualLinkOrderItemIds(targetRows).length : 0;
	let targetOrderCount = 0;

	try {
		if (scope === "filter") {
			manualLinkShelfLoading.value = true;
			const preview = await previewManualLinkShelfByFilter();
			targetCount = preview.total;
			targetOrderCount = preview.total_orders;
			manualLinkShelfLoading.value = false;
		}

		if (!targetCount) {
			ElMessage.warning(
				scope === "selected"
					? `请先选择需要${actionText}的采购单产品明细`
					: `当前筛选下没有可${actionText}的采购单产品明细`
			);
			return;
		}

		const { value } = await ElMessageBox.prompt(
			buildManualLinkShelfConfirmMessage(scope, targetCount, targetOrderCount),
			scope === "filter" ? `按筛选结果${actionText}` : `${actionText}采购单产品明细`,
			{
				confirmButtonText: `确认${actionText} ${targetCount} 个`,
				cancelButtonText: "取消",
				inputValue: isManualLinkShelvedWorkbench.value ? "恢复到待处理列表" : "历史数据，暂不处理",
				inputPlaceholder: `${actionText}原因，可不填`,
				inputType: "textarea",
				dangerouslyUseHTMLString: true
			}
		);

		manualLinkShelfLoading.value = true;
		const remark = value || (isManualLinkShelvedWorkbench.value ? "恢复到待处理列表" : "历史数据，暂不处理");
		const payload =
			scope === "selected"
				? {
						order_item_ids: getManualLinkOrderItemIds(targetRows),
						remark
					}
				: {
						...buildBaseParams(true),
						work_status: manualLinkWorkStatus.value,
						remark
					};
		const res = isManualLinkShelvedWorkbench.value
			? scope === "selected"
				? await manualLinkService.value.unshelveItems(payload)
				: await manualLinkService.value.unshelveByFilter(payload)
			: scope === "selected"
				? await manualLinkService.value.shelveItems(payload)
				: await manualLinkService.value.shelveByFilter(payload);

		const successCount = Number(res?.success_count) || 0;
		const failedCount = Number(res?.failed_count) || 0;
		if (failedCount) {
			ElMessage.warning(`${actionText}完成 ${successCount} 个，失败 ${failedCount} 个`);
		} else {
			ElMessage.success(`已${actionText} ${successCount} 个采购单产品明细`);
		}
		manualLinkSelectedRows.value = [];
		await refreshAll();
	} catch (error: any) {
		if (error !== "cancel") {
			ElMessage.error(error?.message || `${actionText}失败`);
		}
	} finally {
		manualLinkShelfLoading.value = false;
	}
}

function applyAutoStatsFilter(group: AutoStatusGroup) {
	activeAutoStatusGroup.value = group;
	autoPagination.page = 1;
	refreshAll();
}

function openDialog(row: any) {
	if (row.match_status === "blocked") return;
	activeRow.value = row;
	dialogVisible.value = true;
}

async function openAutoDetail(row: any) {
	const planSn = row?.plan_sn || "";
	if (!planSn) {
		ElMessage.warning("缺少采购计划编号");
		return;
	}
	autoDetailData.value = null;
	autoDetailVisible.value = true;
	autoDetailLoading.value = true;
	try {
		const res = await remarkAutoCompleteService.value.statusDetail({ plan_sn: planSn });
		autoDetailData.value = res || null;
	} catch (error: any) {
		ElMessage.error(error?.message || "加载自动补全详情失败");
		autoDetailVisible.value = false;
	} finally {
		autoDetailLoading.value = false;
	}
}

async function handleCompleted() {
	await loadStats();
	await loadData();
	await loadCompletedStats();
	if (tableData.value.length === 0 && pagination.total > 0 && pagination.page > 1) {
		pagination.page -= 1;
		await loadData();
	}
}

function getProductImage(row: any) {
	return row.purchase_plan?.pic_url || row.item?.plan_pic_url || "";
}

function formatNumber(value: any) {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
}

function formatDate(value: any) {
	if (!value) return "-";
	return String(value).replace("T", " ").slice(0, 16);
}

function isManualLinkShelved(row: any) {
	return Number(row?.manual_link_shelf?.shelved) === 1;
}

function getManualLinkShelfTooltip(row: any) {
	const shelf = row?.manual_link_shelf || {};
	const operator = shelf.shelved_by_nickname || shelf.shelved_by_username || "-";
	return [
		`搁置人：${operator}`,
		`搁置时间：${formatDate(shelf.shelved_time)}`,
		`原因：${shelf.shelved_remark || "-"}`
	].join("；");
}

function formatDateOnly(value: any) {
	if (!value) return "-";
	return String(value).slice(0, 10);
}

function getCompletedProductImage(row: any) {
	return row.order_item?.image_url || row.purchase_plan?.pic_url || "";
}

function getCompletedProductTitle(row: any) {
	return row.order_item?.product_name || row.purchase_plan?.product_name || "-";
}

function getCompletedQualityType(row: any) {
	return row.snapshot_quality?.restorable ? "success" : "warning";
}

function getSnapshotMissingText(row: any) {
	const sections = row.snapshot_quality?.missing_sections;
	if (!Array.isArray(sections) || sections.length === 0) return "";
	return sections.map((key: string) => snapshotSectionLabels[key] || key).join(" / ");
}

function getAutoStatusType(status: string) {
	if (status === "success") return "success";
	if (status === "success_with_warnings") return "warning";
	if (status === "failed") return "danger";
	if (status === "needs_attention") return "danger";
	if (status === "skipped") return "info";
	return "info";
}

function getAutoProblemText(row: any) {
	if (Array.isArray(row.errors) && row.errors.length) {
		return row.errors.slice(0, 2).join("；");
	}
	if (Array.isArray(row.warnings) && row.warnings.length) {
		return row.warnings.slice(0, 2).join("；");
	}
	return "";
}

async function copyCompletedInfo(row: any) {
	const text = [
		`采购单: ${row.order_sns?.join(", ") || row.representative_order_sn || "-"}`,
		`计划号: ${row.plan_sn || "-"}`,
		`店铺商品: ${row.listing?.asin || "-"} / ${row.listing?.msku || "-"}`,
		`本地SKU: ${row.listing?.local_sku || "-"}`,
		`采购量: ${formatNumber(row.replenish?.final_purchase_qty)}`,
		`仓库: ${row.replenish?.warehouse_name || "-"}`,
		`操作人: ${row.created_by_name || "-"}`,
		`补全时间: ${formatDate(row.completed_time)}`,
		`快照状态: ${row.snapshot_quality?.snapshot_label || "-"}`,
		`缺少内容: ${getSnapshotMissingText(row) || "-"}`
	].join("\n");
	try {
		await writeClipboardText(text);
		ElMessage.success("已复制补全记录信息");
	} catch (error) {
		ElMessage.error("复制失败，请手动选择文本复制");
	}
}

async function copyAutoInfo(row: any) {
	const text = [
		`采购单: ${row.order_sn || "-"}`,
		`计划号: ${row.plan_sn || "-"}`,
		`状态: ${row.status_label || "-"}`,
		`采购数量: ${formatNumber(row.purchase_qty)}`,
		`分配合计: ${formatNumber(row.allocation_total)}`,
		`店铺商品: ${row.asin || "-"} / ${row.msku || "-"}`,
		`本地SKU: ${row.local_sku || "-"}`,
		`仓库: ${row.warehouse_name || "-"}`,
		`错误: ${row.errors?.length ? row.errors.join("；") : "-"}`,
		`警告: ${row.warnings?.length ? row.warnings.join("；") : "-"}`,
		`最近运行: ${formatDate(row.last_run_time)}`
	].join("\n");
	try {
		await writeClipboardText(text);
		ElMessage.success("已复制自动补全记录信息");
	} catch (error) {
		ElMessage.error("复制失败，请手动选择文本复制");
	}
}

async function writeClipboardText(text: string) {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}
	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "readonly");
	textarea.style.position = "fixed";
	textarea.style.left = "-9999px";
	document.body.appendChild(textarea);
	textarea.select();
	const copied = document.execCommand("copy");
	document.body.removeChild(textarea);
	if (!copied) {
		throw new Error("copy failed");
	}
}

function openProductView(row: any) {
	const keyword = row.plan_sn || row.listing?.msku || row.listing?.asin || "";
	const url = `${window.location.origin}${window.location.pathname}#/app/bsr_purchase_plan_product_view?keyWord=${encodeURIComponent(keyword)}`;
	window.open(url, "_blank");
}

function getRowClassName({ row }: { row: any }) {
	if (row.match_status === "blocked") return "row-blocked";
	if (row.match_status === "manual_required") return "row-manual";
	return "";
}

onMounted(() => {
	refreshAll();
});
</script>

<style lang="scss" scoped>
.manual-link-page {
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
.mode-tabs,
.stats-bar,
.manual-link-workbench,
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
	gap: 12px;
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
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.mode-tabs {
	flex: 0 0 auto;
	padding: 0 14px;
	border: 1px solid var(--el-border-color-light);
	border-bottom: 0;
}

.mode-tabs :deep(.el-tabs__header) {
	margin: 0;
}

.mode-tabs :deep(.el-tabs__nav-wrap::after) {
	display: none;
}

.toolbar-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}

.stats-bar {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 0;
	border: 1px solid var(--el-border-color-light);
	border-bottom: 0;
}

.manual-link-workbench {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 14px;
	border: 1px solid var(--el-border-color-light);
	border-bottom: 0;
}

.manual-link-workbench-main {
	display: flex;
	align-items: center;
	gap: 12px;
	min-width: 0;
}

.manual-link-workbench-copy {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
	font-size: 12px;
	line-height: 1.45;
	color: var(--el-text-color-secondary);
}

.manual-link-workbench-copy strong {
	font-size: 13px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.manual-link-workbench-actions {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	gap: 8px;
}

.auto-panel {
	display: flex;
	flex-direction: column;
	gap: 0;
}

.auto-summary-bar {
	grid-template-columns: repeat(4, minmax(0, 1fr));
	align-items: stretch;
}

.auto-summary-item {
	flex-direction: column;
	align-items: flex-start;
	justify-content: center;
	gap: 5px;
	height: auto;
	min-height: 76px;
	padding: 10px 16px;
	overflow: hidden;
}

.auto-summary-item .stats-value {
	line-height: 1;
}

.auto-summary-item .stats-label {
	line-height: 18px;
	min-height: 18px;
	max-width: 100%;
}

.auto-summary-item .stats-hint {
	line-height: 16px;
	min-height: 16px;
}

.stats-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	min-width: 0;
	height: 54px;
	padding: 8px 14px;
	border: 0;
	border-right: 1px solid var(--el-border-color-lighter);
	background: #fff;
	color: var(--el-text-color-regular);
	cursor: pointer;
	text-align: left;
	transition:
		background 0.16s,
		box-shadow 0.16s;
}

.stats-item:last-child {
	border-right: 0;
}

.stats-item:hover,
.stats-item.active {
	background: var(--el-color-primary-light-9);
	box-shadow: inset 0 -2px 0 var(--el-color-primary);
}

.stats-item.readonly {
	cursor: default;
}

.stats-item.readonly:hover {
	background: #fff;
	box-shadow: none;
}

.completed-summary-item {
	height: 64px;
	flex-direction: column;
	align-items: flex-start;
	justify-content: center;
	gap: 4px;
	background: linear-gradient(180deg, #fff, var(--el-fill-color-extra-light));
}

.completed-summary-item .stats-value {
	max-width: 100%;
	font-size: 18px;
	line-height: 22px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.completed-summary-item .stats-label {
	max-width: 100%;
	line-height: 16px;
}

.stats-item.success.active {
	box-shadow: inset 0 -2px 0 var(--el-color-success);
}

.stats-item.warning.active {
	box-shadow: inset 0 -2px 0 var(--el-color-warning);
}

.stats-item.danger.active {
	box-shadow: inset 0 -2px 0 var(--el-color-danger);
}

.stats-item.info.active {
	box-shadow: inset 0 -2px 0 var(--el-color-info);
}

.stats-value {
	font-size: 22px;
	font-weight: 800;
	color: var(--el-text-color-primary);
}

.completed-stats .stats-value {
	font-size: 18px;
}

.stats-label {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.stats-hint {
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-placeholder);
	font-size: 11px;
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

.filter-keyword {
	width: 320px;
	flex: 0 0 320px;
}

.filter-status {
	width: 158px;
	flex: 0 0 158px;
}

.filter-order-status {
	width: 176px;
	flex: 0 0 176px;
}

.filter-small {
	width: 150px;
	flex: 0 0 150px;
}

.filter-mini {
	width: 110px;
	flex: 0 0 110px;
}

.table-wrap {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	border: 1px solid var(--el-border-color-light);
}

.table-wrap :deep(.el-table),
.table-wrap :deep(.el-table__inner-wrapper) {
	height: 100%;
	flex: 1;
	min-height: 0;
}

.table-wrap :deep(.el-table__body .el-table__cell) {
	padding: 6px 0;
	vertical-align: top;
}

.source-header {
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.status-cell {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 6px;
}

.status-reason {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
	color: var(--el-color-danger);
	font-size: 12px;
	line-height: 1.35;
}

.order-cell,
.product-main,
.candidate-main {
	min-width: 0;
}

.order-line {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.order-line strong {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-primary);
	font-size: 13px;
}

.order-identities,
.product-identities,
.candidate-identities,
.time-cell {
	display: flex;
	flex-wrap: wrap;
	gap: 2px 8px;
	margin-top: 4px;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 16px;
}

.order-identities b,
.product-identities b,
.candidate-identities b,
.time-cell b {
	margin-right: 4px;
	color: var(--el-text-color-placeholder);
	font-weight: 600;
}

.product-cell {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	min-width: 0;
}

.product-image-wrap {
	display: flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 44px;
	width: 44px;
	height: 44px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 5px;
	background: var(--el-fill-color-light);
	overflow: hidden;
}

.product-image {
	width: 100%;
	height: 100%;
}

.image-empty {
	color: var(--el-text-color-placeholder);
	font-size: 12px;
}

.product-title,
.candidate-title {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-primary);
	font-size: 12px;
	font-weight: 700;
}

.candidate-cell,
.manual-required-cell {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	min-width: 0;
}

.manual-required-cell {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.qty-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 6px;
}

.qty-grid div {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 6px;
	min-width: 0;
	padding: 4px 6px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 5px;
	background: #fff;
}

.qty-grid span {
	color: var(--el-text-color-secondary);
	font-size: 11px;
}

.qty-grid b {
	color: var(--el-text-color-primary);
	font-size: 11px;
}

.time-cell {
	flex-direction: column;
	gap: 2px;
	margin-top: 0;
}

.completed-meta {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 0;
}

.completed-meta strong {
	color: var(--el-text-color-primary);
	font-size: 13px;
	line-height: 1.2;
}

.completed-meta-block,
.completed-status-line {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 6px;
	min-width: 0;
}

.completed-meta-block {
	padding-bottom: 6px;
	border-bottom: 1px dashed var(--el-border-color-lighter);
}

.completed-status-line {
	flex-wrap: wrap;
}

.completed-meta-label {
	flex: 0 0 auto;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.operator-tag {
	max-width: 122px;
}

.operator-tag :deep(.el-tag__content) {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.completed-qty {
	grid-template-columns: repeat(2, minmax(0, 1fr));
}

.completed-qty b {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.completed-cycle {
	margin-top: 6px;
}

.completed-actions {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
}

.snapshot-summary {
	display: grid;
	gap: 8px;
	color: var(--el-text-color-regular);
	font-size: 13px;
}

.snapshot-summary div {
	display: grid;
	grid-template-columns: 72px minmax(0, 1fr);
	gap: 8px;
	min-width: 0;
}

.snapshot-summary b {
	color: var(--el-text-color-secondary);
	font-weight: 600;
}

.snapshot-summary-actions {
	display: flex !important;
	justify-content: flex-end;
	padding-top: 4px;
	border-top: 1px solid var(--el-border-color-lighter);
}

.pagination-wrap {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 8px 14px 10px;
	border: 1px solid var(--el-border-color-light);
	border-top: 0;
	background: var(--el-bg-color);
}

.table-wrap :deep(.row-blocked td) {
	background: var(--el-color-danger-light-9) !important;
}

.table-wrap :deep(.row-manual td) {
	background: var(--el-color-warning-light-9) !important;
}

@media (max-width: 980px) {
	.stats-bar {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.page-toolbar {
		align-items: flex-start;
		flex-direction: column;
	}

	.manual-link-workbench {
		align-items: stretch;
		flex-direction: column;
	}

	.manual-link-workbench-main {
		align-items: flex-start;
		flex-direction: column;
	}

	.manual-link-workbench-actions {
		flex-wrap: wrap;
	}
}
</style>
