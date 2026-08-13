<template>
	<el-dialog
		v-model="dialogVisible"
		width="min(1500px, 96vw)"
		top="24px"
		:close-on-click-modal="false"
		:destroy-on-close="true"
		class="manual-link-dialog"
	>
		<template #header>
			<div class="dialog-header">
				<div class="header-main">
					<div class="dialog-title">采购单历史补全</div>
					<div class="dialog-subtitle">
						<span>采购单 {{ row?.order_sn || "-" }}</span>
						<span>计划 {{ row?.plan_sn || "-" }}</span>
						<span>{{ row?.purchase_order?.status_text || "-" }}</span>
					</div>
				</div>
				<div class="header-tags">
					<el-tag type="warning" effect="plain">人工历史补全</el-tag>
					<el-tag :type="matchStatusMap[row?.match_status || '']?.type || 'info'" effect="plain">
						{{ matchStatusMap[row?.match_status || ""]?.label || row?.match_status || "-" }}
					</el-tag>
					<el-tag v-if="prepareDefaults.reconstruction_confidence" type="info" effect="plain">
						{{ getConfidenceLabel(prepareDefaults.reconstruction_confidence) }}
					</el-tag>
				</div>
			</div>
		</template>

		<div v-if="row" v-loading="currentStep === 'history' && prepareLoading" class="dialog-shell">
			<div class="step-strip">
				<div class="step-node active">
					<span>1</span>
					<div>
						<strong>关联店铺商品</strong>
						<em>先确认采购单对应的真实商品</em>
					</div>
				</div>
				<div class="step-line" :class="{ active: currentStep === 'history' }"></div>
				<div class="step-node" :class="{ active: currentStep === 'history' }">
					<span>2</span>
					<div>
						<strong>填写历史补货数据</strong>
						<em>再还原算法、分段和快照信息</em>
					</div>
				</div>
			</div>

			<div class="dialog-body" :class="{ 'select-mode': currentStep === 'select', 'history-mode': currentStep === 'history' }">
				<div v-if="currentStep === 'select'" class="select-review-layout">
					<section class="relation-summary">
						<div class="relation-end source">
							<span>采购单对象</span>
							<strong>{{ purchaseProductTitle }}</strong>
							<em>{{ row.item?.sku || row.purchase_plan?.sku || "-" }}</em>
						</div>
						<div class="relation-center">
							<el-tag :type="selectionSourceMeta.type" effect="plain">{{ selectionSourceMeta.shortLabel }}</el-tag>
							<div>用户确认后建立关联</div>
						</div>
						<div class="relation-end target" :class="{ empty: !selectedListing }">
							<span>当前店铺商品</span>
							<strong>{{ selectedListing?.item_name || selectedListing?.local_name || "尚未选择店铺商品" }}</strong>
							<em>{{ selectedListing ? [selectedListing.asin, selectedListing.msku, selectedListing.local_sku].filter(Boolean).join(" / ") : "请从系统推荐或搜索结果中选择" }}</em>
						</div>
					</section>

					<aside class="review-panel purchase-review-panel">
						<div class="review-panel-head">
							<div>
								<div class="review-title">采购单 / 采购计划信息</div>
								<div class="review-subtitle">用于核对采购单原始商品、数量、仓库、店铺和计划来源。</div>
							</div>
							<el-button size="small" :icon="CopyDocument" @click="copyVerificationInfo">复制校验信息</el-button>
						</div>

						<section class="source-hero-card">
							<div class="product-thumb">
								<el-image
									v-if="purchaseProductImage"
									:src="purchaseProductImage"
									fit="contain"
									class="thumb-img"
									:preview-src-list="[purchaseProductImage]"
									preview-teleported
								/>
								<el-icon v-else :size="24" color="#c0c4cc"><Picture /></el-icon>
							</div>
							<div class="source-hero-main">
								<div class="product-name">{{ purchaseProductTitle }}</div>
								<div class="match-field-panel source-match-fields">
									<div><span>采购单 SKU</span><b>{{ row.item?.sku || "-" }}</b></div>
									<div><span>明细 MSKU</span><b>{{ row.item?.first_msku || "-" }}</b></div>
									<div><span>计划本地 SKU</span><b>{{ row.purchase_plan?.sku || "-" }}</b></div>
									<div><span>计划 MSKU</span><b>{{ formatSkuList(row.purchase_plan?.msku) }}</b></div>
									<div><span>计划店铺</span><b>{{ row.purchase_plan?.seller_name || row.item?.plan_seller_name || "-" }}</b></div>
									<div><span>计划国家</span><b>{{ row.purchase_plan?.marketplace || row.item?.plan_marketplace || "-" }}</b></div>
								</div>
								<div class="source-mini-grid">
									<div><span>采购量</span><b>{{ formatNumber(row.item?.quantity_plan || row.purchase_plan?.quantity_plan) }}</b></div>
									<div><span>待到货数量</span><b>{{ formatNumber(purchasePendingArrivalQty) }}</b></div>
									<div><span>仓库</span><b>{{ row.purchase_plan?.warehouse_name || row.item?.plan_warehouse_name || row.purchase_order?.order_warehouse_name || "-" }}</b></div>
									<div><span>计划号</span><b>{{ row.plan_sn || "-" }}</b></div>
								</div>
							</div>
						</section>

						<el-collapse v-model="verificationActiveNames" class="verification-collapse">
							<el-collapse-item v-for="group in verificationGroups" :key="group.key" :name="group.key">
								<template #title>
									<div class="verification-title">
										<span>{{ group.title }}</span>
										<el-tag v-if="group.tag" size="small" effect="plain" v-text="group.tag" />
									</div>
								</template>
								<div class="verification-grid">
									<div v-for="field in group.fields" :key="field.key" class="verification-cell" :class="{ wide: field.wide }">
										<span>{{ field.label }}</span>
										<strong :title="field.valueText">{{ field.valueText }}</strong>
										<el-button
											v-if="field.copyable && hasCopyValue(field.rawValue)"
											link
											:icon="CopyDocument"
											@click="copyText(field.rawValue, `${field.label}已复制`)"
										/>
									</div>
								</div>
							</el-collapse-item>
						</el-collapse>
					</aside>

					<main class="review-panel product-review-panel">
						<section class="current-product-section">
							<div class="review-panel-head">
								<div>
									<div class="review-title">当前关联店铺商品</div>
									<div class="review-subtitle">最终写入本地分析记录的真实店铺商品，必须人工确认。</div>
								</div>
								<el-tag :type="selectionSourceMeta.type" effect="plain">{{ selectionSourceMeta.label }}</el-tag>
							</div>

							<div v-if="selectedListing" class="current-product-card" :class="{ suggested: isSelectedSuggested }">
								<div class="listing-thumb large">
									<el-image v-if="selectedListing.image_url" :src="selectedListing.image_url" fit="contain" class="listing-img" />
									<el-icon v-else :size="22" color="#c0c4cc"><Picture /></el-icon>
								</div>
								<div class="current-product-main">
									<div class="listing-title">{{ selectedListing.item_name || selectedListing.local_name || "-" }}</div>
									<div class="match-field-panel listing-match-fields">
										<div><span>ASIN</span><b>{{ selectedListing.asin || "-" }}</b></div>
										<div><span>MSKU</span><b>{{ selectedListing.msku || "-" }}</b></div>
										<div><span>本地 SKU</span><b>{{ selectedListing.local_sku || "-" }}</b></div>
										<div><span>店铺</span><b>{{ getListingShop(selectedListing) }}</b></div>
										<div><span>国家</span><b>{{ getListingMarketplace(selectedListing) }}</b></div>
									</div>
									<div class="selection-status-row">
										<el-tag :type="selectionSourceMeta.type" size="small" effect="plain">{{ selectionSourceMeta.shortLabel }}</el-tag>
										<span>{{ selectionReasonText }}</span>
									</div>
								</div>
								<div class="current-product-metrics">
									<div><span>30天日均</span><b>{{ formatNumber(selectedListing.average_thirty_volume) }}</b></div>
									<div><span>FBA可售</span><b>{{ formatNumber(selectedListing.afn_fulfillable_quantity) }}</b></div>
									<div><span>FBA在途</span><b>{{ formatNumber(getListingInboundQty(selectedListing)) }}</b></div>
									<div><span>预留</span><b>{{ formatNumber(getListingReservedQty(selectedListing)) }}</b></div>
								</div>
								<el-button link :icon="Close" class="current-clear" @click="clearSelectedListing" />
							</div>

							<div v-else class="compact-empty-product">
								<el-icon><Warning /></el-icon>
								<div>
									<strong>暂无系统推荐商品</strong>
									<span>请根据左侧采购单信息搜索真实店铺商品，选中后再进入下一步。</span>
								</div>
							</div>

							<div class="match-evidence refined">
								<div class="evidence-title">
									<span>匹配依据</span>
									<el-tag :type="matchStatusMap[row.match_status || '']?.type || 'info'" size="small" effect="plain">
										{{ matchStatusMap[row.match_status || ""]?.label || row.match_status || "-" }}
									</el-tag>
								</div>
								<div class="evidence-table">
									<div class="evidence-table-head">
										<span>校验项</span>
										<span>采购单 / 计划值</span>
										<span>店铺商品值</span>
										<span>结果</span>
									</div>
									<div v-for="item in matchEvidenceRows" :key="item.key" class="evidence-table-row" :class="item.tone">
										<span class="evidence-label">{{ item.label }}</span>
										<span :title="item.leftText">{{ item.leftText }}</span>
										<span :title="item.rightText">{{ item.rightText }}</span>
										<el-tag size="small" :type="item.tagType" effect="plain">{{ item.statusText }}</el-tag>
									</div>
								</div>
							</div>
						</section>

						<section class="search-product-section">
							<div class="review-panel-head compact">
								<div>
									<div class="review-title">搜索其他店铺商品</div>
									<div class="review-subtitle">支持 ASIN、MSKU、本地 SKU、产品编码、标题和店铺关键词。</div>
								</div>
							</div>

							<div class="listing-search refined">
								<el-input
									v-model="listingKeyword"
									clearable
									placeholder="ASIN / MSKU / 本地SKU / 产品编码 / 店铺"
									@keyup.enter="searchListings"
									@clear="searchListings"
								>
									<template #prefix><el-icon><Search /></el-icon></template>
								</el-input>
								<el-input v-model="listingSellerFilter" clearable placeholder="店铺" />
								<el-input v-model="listingMarketplaceFilter" clearable placeholder="国家" />
								<el-button :icon="Search" :loading="listingLoading" @click="searchListings" />
							</div>

							<div class="candidate-list compact" v-loading="listingLoading">
								<button
									v-for="item in listingList"
									:key="item.id"
									type="button"
									class="candidate-row"
									:class="{ selected: Number(selectedListing?.id) === Number(item.id) }"
									@click="selectListing(item)"
								>
									<div class="listing-thumb small">
										<el-image v-if="item.image_url" :src="item.image_url" fit="contain" class="listing-img" />
										<el-icon v-else :size="16" color="#c0c4cc"><Picture /></el-icon>
									</div>
									<div class="candidate-main">
										<div class="listing-title">{{ item.item_name || item.local_name || "-" }}</div>
										<div class="listing-lines inline">
										<span><b>ASIN</b>{{ item.asin || "-" }}</span>
										<span><b>MSKU</b>{{ item.msku || "-" }}</span>
										<span><b>本地SKU</b>{{ item.local_sku || "-" }}</span>
										<span><b>店铺</b>{{ getListingShop(item) }}</span>
										<span><b>国家</b>{{ getListingMarketplace(item) }}</span>
									</div>
									</div>
									<div class="candidate-metrics">
										<div><span>30天</span><b>{{ formatNumber(item.average_thirty_volume) }}</b></div>
										<div><span>FBA</span><b>{{ formatNumber(item.afn_fulfillable_quantity) }}</b></div>
										<div><span>在途</span><b>{{ formatNumber(getListingInboundQty(item)) }}</b></div>
									</div>
									<el-icon v-if="Number(selectedListing?.id) === Number(item.id)" class="check-icon"><Check /></el-icon>
								</button>
								<div v-if="!listingLoading && listingList.length === 0" class="compact-empty-product search-empty">
									<el-icon><Search /></el-icon>
									<div>
										<strong>暂无店铺商品</strong>
										<span>换一个 SKU、MSKU、ASIN 或店铺关键词继续搜索。</span>
									</div>
								</div>
							</div>
						</section>
					</main>
				</div>

			<main v-else class="main-pane history-pane">
				<el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="manual-form history-form">
					<section class="history-section compact-context-panel compact-overview-panel">
						<div class="compact-context-head">
							<div>
								<div class="section-title">核对与推算摘要</div>
								<div class="section-desc">默认只放关键核对字段；完整单据和来源在下方展开查看。</div>
							</div>
							<div class="panel-actions">
								<el-button size="small" :icon="CopyDocument" @click="copyVerificationInfo">复制校验信息</el-button>
								<el-button size="small" @click="goSelectStep">返回选品</el-button>
							</div>
						</div>

						<div class="overview-relation-strip">
							<div class="overview-product is-order">
								<span>采购单商品</span>
								<strong>{{ purchaseProductTitle }}</strong>
								<em>{{ row.item?.first_msku || row.item?.sku || row.purchase_plan?.sku || "-" }}</em>
							</div>
							<div class="overview-arrow">→</div>
							<div class="overview-product is-listing">
								<span>已关联店铺商品</span>
								<strong>{{ selectedListing?.item_name || selectedListing?.local_name || "-" }}</strong>
								<em>{{ [selectedListing?.asin, selectedListing?.msku, selectedListing?.local_sku].filter(Boolean).join(" / ") || "-" }}</em>
							</div>
						</div>

						<div class="overview-summary-grid">
							<el-tooltip
								v-for="item in compactOverviewRows"
								:key="item.key"
								:content="buildOverviewTooltip(item)"
								placement="top"
								:show-after="260"
								popper-class="manual-link-reference-tooltip"
							>
								<div class="overview-summary-item" :class="item.tone">
									<span>{{ item.label }}</span>
									<strong>{{ item.value }}</strong>
									<em>{{ item.source }}</em>
								</div>
							</el-tooltip>
						</div>
						<el-collapse v-model="historyContextActiveNames" class="history-context-collapse compact-collapse">
							<el-collapse-item name="documents">
								<template #title>
									<div class="verification-title">
										<span>展开单据详情</span>
										<el-tag size="small" effect="plain">采购单 / 明细 / 采购计划</el-tag>
									</div>
								</template>
								<el-collapse class="nested-document-collapse">
									<el-collapse-item v-for="group in verificationGroups" :key="group.key" :name="group.key">
										<template #title>
											<div class="verification-title">
												<span>{{ group.title }}</span>
												<el-tag v-if="group.tag" size="small" effect="plain" v-text="group.tag" />
											</div>
										</template>
										<div class="verification-grid context-verification-grid">
											<div v-for="field in group.fields" :key="field.key" class="verification-cell" :class="{ wide: field.wide }">
												<span>{{ field.label }}</span>
												<strong>{{ field.valueText }}</strong>
												<el-button v-if="field.copyable && hasCopyValue(field.rawValue)" text :icon="CopyDocument" @click.stop="copyText(field.rawValue)" />
											</div>
										</div>
									</el-collapse-item>
								</el-collapse>
							</el-collapse-item>
							<el-collapse-item name="references">
								<template #title>
									<div class="verification-title">
										<span>展开参考来源</span>
										<el-tag size="small" type="info" effect="plain">只读</el-tag>
									</div>
								</template>
								<div class="overview-basis-grid">
									<el-tooltip
										v-for="item in systemBasisRows"
										:key="item.key"
										:content="buildOverviewTooltip(item)"
										placement="top"
										:show-after="260"
										popper-class="manual-link-reference-tooltip"
									>
										<div class="overview-basis-item" :class="{ wide: item.wide, strong: item.strong }">
											<span>{{ item.label }}</span>
											<strong>{{ item.value }}</strong>
											<em>{{ item.source }}</em>
										</div>
									</el-tooltip>
								</div>
								<div class="reference-detail-grid compact-reference-detail">
									<div v-for="item in referenceDetailRows" :key="item.key" class="reference-detail-row">
										<span>{{ item.label }}</span>
										<strong>{{ item.value }}</strong>
										<em class="source-badge">{{ item.source }}</em>
									</div>
								</div>
							</el-collapse-item>
						</el-collapse>
					</section>

					<section class="history-section manual-replenish-editor">
						<div class="history-section-head editor-head">
							<div>
								<div class="section-title">填写区：历史补货明细</div>
								<div class="section-desc">按批量补货明细方式集中填写；上方展示区只是参考，下方内容会写入本地分析记录和补货快照。</div>
							</div>
							<div class="editor-head-actions">
								<span class="segment-total" :class="{ danger: hasSegmentMismatch }">
									合计 {{ segmentTotal }} / {{ formatNumber(form.final_purchase_qty) }}
								</span>
								<el-button size="small" type="primary" plain @click="applyCoverageShippingAllocation">按当前配置重新推算</el-button>
							</div>
						</div>

						<div class="manual-analysis-panel">
							<div class="manual-panel-top">
								<div class="manual-combined-formula">
									<div class="manual-mini-metrics">
										<el-form-item prop="daily_avg_sales" class="mini-metric-form-item">
											<span>日均消耗</span>
											<el-input-number
												v-model="form.daily_avg_sales"
												:min="0.01"
												:precision="2"
												:step="0.5"
												size="small"
												controls-position="right"
												class="manual-daily-input"
												@update:model-value="handleRecalculateFieldChange('daily_avg_sales')"
											/>
										</el-form-item>
										<el-tooltip :content="cycleDemandTooltip" placement="bottom-start" popper-class="manual-link-reference-tooltip">
											<div class="mini-metric-help">
												<span>周期总需求</span>
												<strong>{{ cycleDemandQty }}</strong>
											</div>
										</el-tooltip>
									</div>

									<div class="manual-formula-box">
										<el-tooltip :content="fieldReferenceTooltip('system_suggested_qty')" placement="bottom-start" popper-class="manual-link-reference-tooltip">
											<div class="formula-line is-help">
												<span class="formula-main">系统建议 <strong>{{ formatNumber(form.system_suggested_qty) }}</strong></span>
												<span class="formula-expression">{{ systemSuggestionText }}</span>
											</div>
										</el-tooltip>
										<el-tooltip :content="fieldReferenceTooltip('actual_purchase_qty_before_box')" placement="bottom-start" popper-class="manual-link-reference-tooltip">
											<div class="formula-line is-help is-actual">
												<span class="formula-main">实际采购量 <strong>{{ formatNumber(form.actual_purchase_qty_before_box) }}</strong></span>
												<span class="formula-expression">{{ actualPurchaseText }}</span>
											</div>
										</el-tooltip>
										<el-tooltip :content="fieldReferenceTooltip('final_purchase_qty')" placement="bottom-start" popper-class="manual-link-reference-tooltip">
											<div class="formula-line is-help is-final">
												<span class="formula-main">最终采购量 <strong>{{ formatNumber(form.final_purchase_qty) }}</strong></span>
												<span class="formula-expression">采购单事实数量，不能由分段反向修改。</span>
											</div>
										</el-tooltip>
										<div v-if="prepareDefaults.quantity_mismatch_text" class="formula-warning">
											{{ prepareDefaults.quantity_mismatch_text }}
										</div>
									</div>
								</div>

								<div class="manual-panel-actions">
									<div class="manual-action-row">
										<div class="manual-action-row-head">
											<span class="manual-action-label">计算依据</span>
											<el-tooltip :content="fieldReferenceTooltip('algorithm_key')" placement="top" popper-class="manual-link-reference-tooltip">
												<el-tag size="small" :type="getWriteFieldState('algorithm_key').type" effect="plain">{{ getWriteFieldState("algorithm_key").label }}</el-tag>
											</el-tooltip>
										</div>
										<el-form-item prop="algorithm_key" class="manual-inline-form-item">
											<el-select v-model="form.algorithm_key" size="small" @change="handleAlgorithmChange">
												<el-option v-for="item in algorithmOptions" :key="item.key" :label="item.label" :value="item.key" />
											</el-select>
										</el-form-item>
									</div>

									<div class="manual-action-row">
										<div class="manual-action-row-head">
											<span class="manual-action-label">周期</span>
											<el-tooltip :content="fieldReferenceTooltip('cycle_range')" placement="top" popper-class="manual-link-reference-tooltip">
												<el-tag size="small" :type="getWriteFieldState('cycle_range').type" effect="plain">{{ getWriteFieldState("cycle_range").label }}</el-tag>
											</el-tooltip>
										</div>
										<el-form-item prop="cycle_range" class="manual-inline-form-item period-inline-item">
											<el-date-picker
												v-model="form.cycle_range"
												type="daterange"
												value-format="YYYY-MM-DD"
												range-separator="~"
												start-placeholder="开始"
												end-placeholder="结束"
												size="small"
												class="compact-period-picker"
												@update:model-value="markFieldTouched('cycle_range')"
												@change="refreshSegmentDays"
											/>
										</el-form-item>
									</div>

								</div>
							</div>

							<div class="manual-param-strip">
								<div class="param-strip-head">
									<div>
										<strong>推算参数</strong>
										<span>这些值决定销售周期、运输覆盖区间和分段数量；蓝色为系统带入，修改后会标记为人工填写。</span>
									</div>
									<el-button size="small" type="primary" plain @click="applyCoverageShippingAllocation">按当前配置重新推算</el-button>
								</div>
								<div class="param-strip-fields">
									<el-form-item prop="plan_start_date" class="param-control is-date">
										<div class="param-label-line">
											<span>计划开始</span>
											<el-tooltip :content="fieldReferenceTooltip('plan_start_date')" placement="top" popper-class="manual-link-reference-tooltip">
												<el-tag size="small" :type="getWriteFieldState('plan_start_date').type" effect="plain">{{ getWriteFieldState("plan_start_date").label }}</el-tag>
											</el-tooltip>
										</div>
										<el-date-picker
											v-model="form.plan_start_date"
											type="date"
											value-format="YYYY-MM-DD"
											size="small"
											placeholder="计划开始"
											@update:model-value="markFieldTouched('plan_start_date')"
											@change="handlePlanStartChange"
										/>
									</el-form-item>
									<div class="param-control">
										<div class="param-label-line">
											<span>运输配置</span>
											<el-tag size="small" type="info" effect="plain">{{ form.shipping_profile_label || "默认" }}</el-tag>
										</div>
										<el-select v-model="form.shipping_profile_key" size="small" @change="handleShippingProfileChange">
											<el-option v-for="item in shippingProfileOptions" :key="item.key" :label="item.label" :value="item.key" />
										</el-select>
									</div>
									<el-form-item prop="shipping_buffer_days" class="param-control">
										<div class="param-label-line">
											<span>缓冲天数</span>
											<el-tooltip :content="fieldReferenceTooltip('shipping_buffer_days')" placement="top" popper-class="manual-link-reference-tooltip">
												<el-tag size="small" :type="getWriteFieldState('shipping_buffer_days').type" effect="plain">{{ getWriteFieldState("shipping_buffer_days").label }}</el-tag>
											</el-tooltip>
										</div>
										<el-input-number
											v-model="form.shipping_buffer_days"
											:min="0"
											:max="120"
											:precision="0"
											controls-position="right"
											size="small"
											@change="handleShippingBufferChange"
										/>
									</el-form-item>
									<el-form-item prop="target_stock_days" class="param-control">
										<div class="param-label-line">
											<span>目标库存</span>
											<el-tooltip :content="fieldReferenceTooltip('target_stock_days')" placement="top" popper-class="manual-link-reference-tooltip">
												<el-tag size="small" :type="getWriteFieldState('target_stock_days').type" effect="plain">{{ getWriteFieldState("target_stock_days").label }}</el-tag>
											</el-tooltip>
										</div>
										<el-input-number
											v-model="form.target_stock_days"
											:min="1"
											:precision="0"
											size="small"
											controls-position="right"
											@update:model-value="handleRecalculateFieldChange('target_stock_days')"
										/>
									</el-form-item>
									<el-form-item prop="volatility_coefficient" class="param-control">
										<div class="param-label-line">
											<span>波动系数</span>
											<el-tooltip :content="fieldReferenceTooltip('volatility_coefficient')" placement="top" popper-class="manual-link-reference-tooltip">
												<el-tag size="small" :type="getWriteFieldState('volatility_coefficient').type" effect="plain">{{ getWriteFieldState("volatility_coefficient").label }}</el-tag>
											</el-tooltip>
										</div>
										<el-input-number
											v-model="form.volatility_coefficient"
											:min="0.01"
											:precision="2"
											:step="0.05"
											size="small"
											controls-position="right"
											@update:model-value="handleRecalculateFieldChange('volatility_coefficient')"
										/>
									</el-form-item>
									<el-form-item class="param-control">
										<div class="param-label-line">
											<span>装箱数</span>
											<el-tooltip :content="fieldReferenceTooltip('box_pcs')" placement="top" popper-class="manual-link-reference-tooltip">
												<el-tag size="small" :type="getWriteFieldState('box_pcs').type" effect="plain">{{ getWriteFieldState("box_pcs").label }}</el-tag>
											</el-tooltip>
										</div>
										<el-input-number
											v-model="form.box_pcs"
											:min="1"
											:precision="0"
											size="small"
											controls-position="right"
											@update:model-value="markFieldTouched('box_pcs')"
										/>
										<div class="box-pcs-helper" :class="{ warning: boxPcsLookupMessage && !boxPcsLookupValue }">
											<span v-if="boxPcsLookupLoading">正在查询本地产品装箱数...</span>
											<span v-else-if="boxPcsLookupValue">本地产品详情带入 {{ boxPcsLookupValue }}</span>
											<span v-else-if="boxPcsLookupMessage">{{ boxPcsLookupMessage }}</span>
											<span v-else>未设置时提交不做整箱调整</span>
										</div>
									</el-form-item>
								</div>
							</div>

							<div class="manual-shipping-head">
								<div>
									<strong>运输分段 / 发货节奏</strong>
									<span>当前配置：{{ form.shipping_profile_label }} · 缓冲 {{ form.shipping_buffer_days }}天 · 推算基准日 {{ shippingBaseDate || "-" }}</span>
								</div>
								<div class="shipping-head-actions">
									<el-tooltip
										:content="buildShippingSummaryTooltip()"
										placement="top"
										:show-after="260"
										popper-class="manual-link-reference-tooltip"
									>
										<em class="shipping-method-summary">{{ shippingMethodSummary }}</em>
									</el-tooltip>
									<el-tag v-if="shippingPrefsLoading" size="small" type="info" effect="plain">读取运输偏好</el-tag>
									<el-tag v-else-if="shippingInactiveMethods.length" size="small" type="warning" effect="plain">
										偏好关闭 {{ shippingInactiveMethods.length }} 种
									</el-tag>
									<el-tag v-else size="small" type="success" effect="plain">默认全开</el-tag>
									<el-button size="small" @click="restoreShippingSuggestion">{{ hasHistoryShippingSuggestion ? "恢复历史建议" : "恢复系统建议" }}</el-button>
								</div>
							</div>

							<div class="manual-panel-bottom">
								<div
									v-for="segment in form.shipping_segments"
									:key="segment.method_key"
									class="manual-si-col"
									:class="{ active: segment.active, inactive: !segment.active, recommended: segment.recommended }"
								>
									<div class="si-head">
										<el-checkbox v-model="segment.active" @change="handleSegmentActiveChange(segment)" />
										<span
											class="si-tag"
											:class="{ 'is-inactive': !segment.active }"
											:style="segment.active ? { background: `${segment.color || '#909399'}15`, color: segment.color || '#606266', borderColor: `${segment.color || '#909399'}40` } : undefined"
										>
											{{ getSegmentIcon(segment) }} {{ segment.method_label }}
										</span>
										<el-tooltip :content="getSegmentTooltip(segment)" placement="top" popper-class="manual-link-reference-tooltip">
											<el-icon><InfoFilled /></el-icon>
										</el-tooltip>
									</div>
									<div class="si-days-row">
										<span>运输天数</span>
										<el-input-number
											v-model="segment.days_to_arrive"
											:min="1"
											:max="120"
											:precision="0"
											controls-position="right"
											size="small"
											:disabled="!segment.active"
											@change="handleSegmentDaysChange(segment)"
										/>
									</div>
									<div class="si-date-range" :class="{ empty: !segment.start_date || !segment.end_date }">
										<span>{{ getSegmentShortRange(segment) }}</span>
										<em>{{ segment.period_days || 0 }}天</em>
									</div>
									<div class="si-arrival">预计到达 {{ getSegmentTraceValue(segment, "arrival_date") || getSegmentArrivalDate(segment) || "-" }}</div>
									<div class="si-suggestion">
										<el-tooltip :content="getSegmentTooltip(segment)" placement="bottom" popper-class="manual-link-reference-tooltip">
											<span class="suggest-clickable">建议发货 {{ formatNumber(getSegmentSuggestedQty(segment)) }}</span>
										</el-tooltip>
										<el-tag size="small" :type="getSegmentStatusType(segment)" effect="plain">{{ getSegmentStatusLabel(segment) }}</el-tag>
									</div>
									<el-input-number
										v-model="segment.final_qty"
										:min="0"
										:precision="0"
										:disabled="!segment.active"
										controls-position="right"
										size="small"
										class="manual-shipping-qty-input"
										@change="handleSegmentQtyChange(segment)"
									/>
									<div class="si-foot">
										<button type="button" :disabled="!segment.active" @click="fillRemaining(segment)">填入剩余</button>
										<button type="button" :disabled="!segment.active" @click="restoreSegmentSuggestion(segment)">恢复本段</button>
									</div>
								</div>
							</div>

							<div class="manual-adjust-strip-lite">
								<div class="mas-main-row">
									<span class="mas-icon">🔧</span>
									<span class="mas-label">人工系数</span>
									<el-form-item prop="manual_coefficient" class="mas-form-item">
										<el-input-number
											v-model="form.manual_coefficient"
											:min="0.01"
											:precision="2"
											:step="0.1"
											size="small"
											controls-position="right"
											@update:model-value="handleRecalculateFieldChange('manual_coefficient')"
										/>
									</el-form-item>
									<span class="mas-formula">× {{ formatNumber(form.actual_purchase_qty_before_box) }} =</span>
									<span class="mas-final">{{ formatNumber(form.final_purchase_qty) }}</span>
									<span class="mas-divider"></span>
									<div class="mas-field mas-warehouse-field">
										<span class="mas-field-label">采购仓库</span>
										<el-form-item prop="warehouse_wid" class="mas-form-item">
											<el-select
												v-model="form.warehouse_wid"
												clearable
												filterable
												size="small"
												class="mas-warehouse-select"
												:class="{ 'is-missing': !normalizeWarehouseWid(form.warehouse_wid) }"
												:loading="warehouseLoading"
												:validate-event="false"
												placeholder="必选"
												@visible-change="handleWarehouseDropdownVisible"
												@change="handleWarehouseChange"
											>
												<el-option
													v-if="recommendedWarehouseText"
													:value="`__recommended_${recommendedWarehouseText}`"
													:label="`推荐仓库：${recommendedWarehouseText}`"
													disabled
												>
													<div class="warehouse-recommend-row">
														<span>推荐仓库：{{ recommendedWarehouseText }}</span>
														<el-tag size="small" :type="matchedRecommendedWarehouse ? 'success' : 'warning'" effect="plain">
															{{ matchedRecommendedWarehouse ? "已在列表匹配" : "未匹配真实仓库" }}
														</el-tag>
													</div>
												</el-option>
												<template v-for="group in warehouseGroups" :key="group.key">
													<el-option-group v-if="group.list.length > 0" :label="group.label">
														<el-option v-for="warehouse in group.list" :key="`${group.key}-${warehouse.wid}`" :label="warehouse.name" :value="warehouse.wid">
															<div class="warehouse-option-row">
																<span>{{ warehouse.name }}</span>
																<div>
																	<el-tag v-if="isRecommendedWarehouse(warehouse)" size="small" type="success" effect="plain">推荐匹配</el-tag>
																	<el-tag v-else-if="isSelectedWarehouse(warehouse)" size="small" type="primary" effect="plain">当前选择</el-tag>
																</div>
															</div>
														</el-option>
													</el-option-group>
												</template>
											</el-select>
										</el-form-item>
										<el-tooltip v-if="warehouseMatchWarning" :content="warehouseMatchWarning" placement="top" popper-class="manual-link-reference-tooltip">
											<el-tag size="small" type="warning" effect="plain" class="mas-inline-warning">需选择真实仓库</el-tag>
										</el-tooltip>
									</div>
									<span class="mas-divider"></span>
									<div class="mas-summary-totals">
										<div class="mst-item">
											<span class="mst-label">系统建议</span>
											<span class="mst-value">{{ formatNumber(form.system_suggested_qty) }}</span>
										</div>
										<div class="mst-item highlight">
											<span class="mst-label">实际采购量</span>
											<span class="mst-value">{{ formatNumber(form.actual_purchase_qty_before_box) }}</span>
										</div>
										<div class="mst-item" :class="{ highlight: !hasSegmentMismatch }">
											<span class="mst-label">已分配</span>
											<span class="mst-value">{{ segmentTotal }} / {{ formatNumber(form.final_purchase_qty) }}</span>
										</div>
									</div>
								</div>
								<div class="mas-detail-row">
									<div ref="manualRemarkFieldRef" class="mas-field mas-remark-field" :class="{ 'is-attention': remarkAttentionActive || !String(form.manual_remark || '').trim() }">
										<span class="mas-field-label">人工备注</span>
										<el-form-item prop="manual_remark" class="mas-form-item mas-remark-form-item">
											<el-input
												v-model="form.manual_remark"
												size="small"
												clearable
												maxlength="500"
												placeholder="历史补全原因、依据、确认说明"
											/>
										</el-form-item>
										<div class="mas-remark-hint">提交前必须填写，点击确认补全后会自动定位到这里。</div>
									</div>
									<div class="mas-preview-line">
										<span>写入预览</span>
										<strong>{{ compactWritePreviewText }}</strong>
									</div>
								</div>
							</div>

							<el-collapse v-model="advancedWriteActiveNames" class="advanced-write-collapse">
								<el-collapse-item name="inventory">
									<template #title>
										<div class="verification-title">
											<span>高级：库存与抵扣修正</span>
											<el-tag size="small" type="info" effect="plain">默认使用系统带入</el-tag>
										</div>
									</template>
									<div class="inventory-grid compact-inventory-grid">
										<el-form-item label="FBA可售">
											<el-input-number v-model="form.inventory.fba_valid" :min="0" :precision="0" size="small" controls-position="right" />
										</el-form-item>
										<el-form-item label="FBA预留">
											<el-input-number v-model="form.inventory.fba_reserved" :min="0" :precision="0" size="small" controls-position="right" />
										</el-form-item>
										<el-form-item label="FBA在途">
											<el-input-number v-model="form.inventory.inbound_qty" :min="0" :precision="0" size="small" controls-position="right" />
										</el-form-item>
										<el-form-item label="本地库存">
											<el-input-number v-model="form.inventory.local_valid" :min="0" :precision="0" size="small" controls-position="right" />
										</el-form-item>
										<el-form-item label="本地采购计划">
											<el-input-number v-model="form.inventory.local_purchase_plan" :min="0" :precision="0" size="small" controls-position="right" />
										</el-form-item>
										<el-form-item label="本地待交付">
											<el-input-number v-model="form.inventory.local_pending_delivery" :min="0" :precision="0" size="small" controls-position="right" />
										</el-form-item>
									</div>
								</el-collapse-item>
							</el-collapse>
						</div>
					</section>
				</el-form>
			</main>
			</div>
		</div>

		<template #footer>
			<div class="dialog-footer">
				<div class="footer-left">
					<span v-if="validationText" class="validation-text">{{ validationText }}</span>
					<span v-else-if="currentStep === 'select' && selectedListing" class="footer-ok">已选择店铺商品，可以进入数据填写</span>
					<span v-else-if="currentStep === 'select'" class="validation-text">请先确认要关联的店铺商品</span>
					<span v-else-if="currentStep === 'history' && confirmDisabledReason" class="validation-text">{{ confirmDisabledReason }}</span>
					<span v-else class="footer-ok">已完成数量校验</span>
				</div>
				<div class="footer-actions">
					<el-button @click="dialogVisible = false">取消</el-button>
					<el-button v-if="currentStep === 'select'" type="primary" :disabled="!selectedListing" @click="goHistoryStep">
						下一步：填写历史补货数据
					</el-button>
					<el-button v-else @click="goSelectStep">上一步</el-button>
					<el-tooltip v-if="currentStep === 'history'" :disabled="!confirmDisabledReason" :content="confirmDisabledReason" placement="top" effect="dark">
						<span class="submit-tooltip-wrap">
							<el-button type="primary" :loading="submitting" :disabled="Boolean(confirmDisabledReason)" @click="submit">
								确认补全
							</el-button>
						</span>
					</el-tooltip>
				</div>
			</div>
		</template>
	</el-dialog>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage, ElMessageBox } from "element-plus";
import { Check, Close, CopyDocument, InfoFilled, Picture, Search, Warning } from "@element-plus/icons-vue";
import { useCool } from "/@/cool";

interface ShippingSegmentForm {
	method_key: string;
	method_label: string;
	days_to_arrive: number;
	color: string;
	icon?: string;
	active: boolean;
	start_date: string;
	end_date: string;
	period_days: number;
	coefficient: number;
	raw_coefficient?: number;
	adjusted_coefficient?: number;
	system_suggested_qty: number;
	purchase_plan_deducted_qty?: number;
	local_pending_delivery_deducted_qty?: number;
	final_qty: number;
	alpha_mode: string;
	manual_alpha: number | null;
	monthly_coefficients?: any;
	recommended?: boolean;
	source?: string;
	allocation_status?: string;
	source_confidence?: string;
	help_text?: string;
	scaled_from_qty?: number;
	calculation_trace?: any;
}

interface WarehouseOption {
	wid: number | string;
	name: string;
	type?: string;
	[key: string]: any;
}

const props = defineProps<{
	visible: boolean;
	row: any | null;
}>();

const emit = defineEmits<{
	(e: "update:visible", value: boolean): void;
	(e: "completed"): void;
}>();

const { service } = useCool();
const manualLinkService = computed(() => (service.app as any).bsr_purchase_order_manual_link);

const dialogVisible = computed({
	get: () => props.visible,
	set: (value: boolean) => emit("update:visible", value)
});

const row = computed(() => props.row);
const formRef = ref<FormInstance>();
const manualRemarkFieldRef = ref<HTMLElement | null>(null);
const prepareLoading = ref(false);
const listingLoading = ref(false);
const submitting = ref(false);
const currentStep = ref<"select" | "history">("select");
const selectedListing = ref<any | null>(null);
const listingKeyword = ref("");
const listingSellerFilter = ref("");
const listingMarketplaceFilter = ref("");
const listingList = ref<any[]>([]);
const prepareData = ref<any | null>(null);
const validationText = ref("");
const preparedKey = ref("");
const verificationActiveNames = ref<string[]>(["order"]);
const historyContextActiveNames = ref<string[]>([]);
const advancedWriteActiveNames = ref<string[]>([]);
const warehouseLoading = ref(false);
const warehouseList = ref<Record<"local" | "overseas" | "awd", WarehouseOption[]>>({
	local: [],
	overseas: [],
	awd: []
});
const preparedShippingDefaults = ref<any[]>([]);
const shippingPrefsLoading = ref(false);
const shippingInactiveMethods = ref<string[]>([]);
const boxPcsLookupLoading = ref(false);
const boxPcsLookupValue = ref<number | undefined>(undefined);
const boxPcsLookupMessage = ref("");
const shippingBaseDate = ref("");
const remarkAttentionActive = ref(false);
const touchedFields = reactive<Record<string, boolean>>({});
const systemCalculatedFields = reactive<Record<string, boolean>>({});
const DEFAULT_SHIPPING_BUFFER = 5;

const fallbackAlgorithms = [
	{ key: "daily_avg", label: "日均单量" },
	{ key: "history", label: "历史销量" },
	{ key: "trend", label: "搜索词趋势" },
	{ key: "combined", label: "综合走势" },
	{ key: "operator_intent", label: "运营意向" }
];

const fallbackShippingMethods = [
	{ key: "express", label: "快递", days: 5, color: "#f56c6c" },
	{ key: "air", label: "空快", days: 8, color: "#409eff" },
	{ key: "air_slow", label: "空慢", days: 10, color: "#67b8ff" },
	{ key: "truck", label: "卡车", days: 30, color: "#67c23a" },
	{ key: "rail", label: "铁路", days: 35, color: "#e6a23c" },
	{ key: "sea", label: "海运", days: 60, color: "#f56c6c" }
];

const fallbackShippingProfiles = [
	{ key: "default", label: "默认" },
	{ key: "uk", label: "英国" },
	{ key: "de", label: "德国" }
];

const form = reactive({
	algorithm_key: "daily_avg",
	shipping_profile_key: "default",
	shipping_profile_label: "默认",
	shipping_buffer_days: DEFAULT_SHIPPING_BUFFER,
	plan_start_date: "",
	daily_avg_sales: undefined as number | undefined,
	cycle_range: [] as string[],
	target_stock_days: 20,
	volatility_coefficient: 0.75,
	manual_coefficient: 1,
	system_suggested_qty: undefined as number | undefined,
	actual_purchase_qty_before_box: undefined as number | undefined,
	final_purchase_qty: undefined as number | undefined,
	box_pcs: undefined as number | undefined,
	warehouse_wid: undefined as number | string | undefined,
	warehouse_name: "",
	shipping_adjust_mode: "independent",
	manual_remark: "",
	shipping_segments: [] as ShippingSegmentForm[],
	inventory: {
		fba_valid: 0,
		fba_reserved: 0,
		inbound_qty: 0,
		local_valid: 0,
		local_purchase_plan: 0,
		local_pending_delivery: 0,
		lingxing_purchase_plan: 0,
		lingxing_pending_delivery: 0
	}
});

const matchStatusMap: Record<string, { label: string; type: "success" | "warning" | "info" | "danger" | "primary" }> = {
	auto_item_first_msku: { label: "明细 MSKU 匹配", type: "success" },
	auto_plan_local_sku: { label: "计划本地 SKU 匹配", type: "primary" },
	auto_plan_msku: { label: "计划 MSKU 匹配", type: "primary" },
	manual_required: { label: "需人工选品", type: "warning" },
	blocked: { label: "无法处理", type: "danger" }
};

const positiveRule = (label: string) => ({
	validator: (_rule: any, value: any, callback: any) => {
		const num = Number(value);
		if (!Number.isFinite(num) || num <= 0) {
			callback(new Error(`${label}必须大于0`));
		} else {
			callback();
		}
	},
	trigger: "change"
});

const nonNegativeRule = (label: string) => ({
	validator: (_rule: any, value: any, callback: any) => {
		const num = Number(value);
		if (!Number.isFinite(num) || num < 0) {
			callback(new Error(`${label}不能小于0`));
		} else {
			callback();
		}
	},
	trigger: "change"
});

const requiredWarehouseRule = {
	validator: (_rule: any, value: any, callback: any) => {
		if (!normalizeWarehouseWid(value)) {
			callback(new Error("请选择真实采购仓库"));
			return;
		}
		callback();
	},
	trigger: "change"
};

const rules: FormRules = {
	algorithm_key: [{ required: true, message: "请选择算法", trigger: "change" }],
	plan_start_date: [{ required: true, message: "请选择计划开始时间", trigger: "change" }],
	shipping_buffer_days: [nonNegativeRule("缓冲天数")],
	daily_avg_sales: [positiveRule("日均销量")],
	target_stock_days: [positiveRule("目标库存天数")],
	volatility_coefficient: [positiveRule("波动系数")],
	manual_coefficient: [positiveRule("人工系数")],
	system_suggested_qty: [positiveRule("系统建议量")],
	actual_purchase_qty_before_box: [positiveRule("装箱前实际采购量")],
	final_purchase_qty: [positiveRule("最终采购量")],
	cycle_range: [
		{
			validator: (_rule: any, value: any, callback: any) => {
				if (!Array.isArray(value) || value.length !== 2 || !value[0] || !value[1]) {
					callback(new Error("请选择销售周期"));
				} else {
					callback();
				}
			},
			trigger: "change"
		}
	],
	warehouse_wid: [requiredWarehouseRule],
	manual_remark: [{ required: true, message: "请填写人工备注", trigger: "blur" }]
};

const algorithmOptions = computed(() => prepareData.value?.options?.algorithms || fallbackAlgorithms);
const shippingProfileOptions = computed(() => prepareData.value?.options?.shipping_profiles || fallbackShippingProfiles);
const shippingMethodOptions = computed(() => buildShippingMethodsForProfile(form.shipping_profile_key));
const prepareDefaults = computed(() => prepareData.value?.defaults || {});
const sourceRows = computed(() => prepareDefaults.value?.reconstruction_sources || []);
const fieldReferences = computed(() => (Array.isArray(prepareDefaults.value?.field_references) ? prepareDefaults.value.field_references : []));
const fieldReferenceMap = computed(() => {
	const map = new Map<string, any>();
	fieldReferences.value.forEach((item: any) => {
		if (item?.key) map.set(item.key, item);
	});
	return map;
});
const prepareWarehouseSuggestions = computed(() => (Array.isArray(prepareData.value?.options?.warehouses) ? prepareData.value.options.warehouses : []));
const warehouseGroups = computed(() => [
	{ key: "local", label: "本地仓", list: warehouseList.value.local },
	{ key: "overseas", label: "海外仓", list: warehouseList.value.overseas },
	{ key: "awd", label: "AWD仓", list: warehouseList.value.awd }
]);
const warehouseOptions = computed(() => warehouseGroups.value.flatMap((group) => group.list.map((item) => ({ ...item, group: group.label }))));
const hasWarehouseOptions = computed(() => warehouseOptions.value.length > 0);
const activeSegments = computed(() => form.shipping_segments.filter((item) => item.active));
const segmentTotal = computed(() => activeSegments.value.reduce((sum, item) => sum + (Number(item.final_qty) || 0), 0));
const hasSegmentMismatch = computed(() => Number(form.final_purchase_qty) > 0 && segmentTotal.value !== Number(form.final_purchase_qty));
const segmentMismatchReason = computed(() => {
	const purchaseQty = Number(form.final_purchase_qty) || 0;
	const allocatedQty = segmentTotal.value;
	if (purchaseQty <= 0) return "";
	if (allocatedQty > purchaseQty) {
		return `运输分段合计 ${allocatedQty}，超过采购单数量 ${purchaseQty}，请减少 ${allocatedQty - purchaseQty} 件后再提交`;
	}
	if (allocatedQty < purchaseQty) {
		return `运输分段合计 ${allocatedQty}，少于采购单数量 ${purchaseQty}，请补足 ${purchaseQty - allocatedQty} 件后再提交`;
	}
	return "";
});
const confirmDisabledReason = computed(() => {
	if (currentStep.value !== "history") return "";
	if (!selectedListing.value) return "请先确认要关联的店铺商品";
	return segmentMismatchReason.value;
});
const allocationStatus = computed(() => {
	const total = Number(form.final_purchase_qty) || 0;
	if (!total) return { label: "缺少采购量", type: "warning" as const, className: "warning" };
	if (segmentTotal.value > total) return { label: `超出 ${segmentTotal.value - total}`, type: "danger" as const, className: "danger" };
	if (segmentTotal.value < total) return { label: `未分配 ${total - segmentTotal.value}`, type: "warning" as const, className: "warning" };
	return { label: "已分配完成", type: "success" as const, className: "success" };
});
const currentAlgorithmLabel = computed(() => algorithmOptions.value.find((item: any) => item.key === form.algorithm_key)?.label || "-");
const purchaseProductImage = computed(() => getProductImage(row.value));
const purchaseProductTitle = computed(() => row.value?.item?.product_name || row.value?.purchase_plan?.product_name || "-");
const purchaseQuantity = computed(() =>
	Number(row.value?.item?.quantity_real) ||
	Number(row.value?.item?.quantity_plan) ||
	Number(row.value?.purchase_plan?.quantity_plan) ||
	undefined
);
const purchasePendingArrivalQty = computed(() => {
	const item = row.value?.item || {};
	const order = row.value?.purchase_order || {};
	const directQty = firstFiniteNumber(item.quantity_receive, order.quantity_receive);
	if (directQty !== undefined) return directQty;
	const purchasedQty = firstFiniteNumber(item.quantity_real, item.quantity_plan, order.quantity_real, order.quantity);
	if (purchasedQty === undefined) return undefined;
	const enteredQty = firstFiniteNumber(item.quantity_entry, order.quantity_entry) || 0;
	return Math.max(0, purchasedQty - enteredQty);
});
const purchaseBoxPcs = computed(() => Number(row.value?.purchase_plan?.cg_box_pcs) || Number(row.value?.item?.quantity_per_case) || undefined);
const purchaseWarehouseName = computed(() =>
	row.value?.purchase_plan?.warehouse_name ||
	row.value?.item?.ware_house_name ||
	row.value?.purchase_order?.order_warehouse_name ||
	""
);
const selectedWarehouseName = computed(() => {
	const wid = normalizeWarehouseWid(form.warehouse_wid);
	if (!wid) return form.warehouse_name || "";
	return warehouseOptions.value.find((item: any) => normalizeWarehouseWid(item.wid) === wid)?.name || form.warehouse_name || "";
});
const recommendedWarehouseText = computed(() => {
	const defaults = prepareDefaults.value || {};
	const suggestion = prepareWarehouseSuggestions.value.find((item: any) => item?.name || item?.wid);
	return (
		defaults.warehouse_name ||
		suggestion?.name ||
		purchaseWarehouseName.value ||
		(defaults.warehouse_wid ? `仓库ID ${defaults.warehouse_wid}` : "")
	);
});
const warehouseMatchWarning = computed(() => {
	if (normalizeWarehouseWid(form.warehouse_wid)) return "";
	if (recommendedWarehouseText.value) return "当前只有推荐仓库名称，需从真实仓库列表中确认选择";
	return "必须选择真实采购仓库";
});
const recommendedWarehouseWid = computed(() => normalizeWarehouseWid(prepareDefaults.value?.warehouse_wid || prepareWarehouseSuggestions.value[0]?.wid));
const matchedRecommendedWarehouse = computed(() => {
	const wid = recommendedWarehouseWid.value;
	const name = normalizeWarehouseName(recommendedWarehouseText.value);
	return warehouseOptions.value.find((item: any) => {
		const itemWid = normalizeWarehouseWid(item.wid);
		if (wid && itemWid === wid) return true;
		return name && normalizeWarehouseName(item.name) === name;
	}) || null;
});
const warehouseMatchState = computed(() => {
	const selectedWid = normalizeWarehouseWid(form.warehouse_wid);
	if (selectedWid) {
		const matchedWid = normalizeWarehouseWid(matchedRecommendedWarehouse.value?.wid);
		return selectedWid === matchedWid
			? { label: "已匹配真实仓库", type: "success" as const, className: "state-filled" }
			: { label: "已人工选择", type: "success" as const, className: "state-filled" };
	}
	if (recommendedWarehouseText.value) {
		return { label: "需选择真实仓库", type: "warning" as const, className: "state-warning" };
	}
	return { label: "待填写", type: "danger" as const, className: "state-empty" };
});
const isSelectedSuggested = computed(
	() => Boolean(selectedListing.value && row.value?.suggested_listing && Number(selectedListing.value.id) === Number(row.value.suggested_listing.id))
);
const selectionSourceMeta = computed(() => {
	if (!selectedListing.value) {
		return { label: "未选择店铺商品", shortLabel: "未选择", type: "warning" as const };
	}
	if (isSelectedSuggested.value) {
		return { label: "系统推荐，待人工确认", shortLabel: "系统推荐", type: "warning" as const };
	}
	return { label: "人工搜索选择", shortLabel: "人工选择", type: "success" as const };
});
const selectionReasonText = computed(() => {
	if (!selectedListing.value) return "请先搜索并选择真实店铺商品。";
	if (isSelectedSuggested.value) {
		const label = matchStatusMap[row.value?.match_status || ""]?.label || "系统推荐";
		return `推荐来源：${label}。`;
	}
	return "来源：用户从搜索结果中人工选择。";
});
const verificationGroups = computed(() => {
	const current = row.value || {};
	const order = current.purchase_order || {};
	const item = current.item || {};
	const plan = current.purchase_plan || {};

	return [
		{
			key: "order",
			title: "采购单主表",
			tag: order.status_text || "",
			fields: [
				makeCheckField("order_sn", "采购单号", current.order_sn || order.order_sn),
				makeCheckField("custom_order_sn", "自定义单号", order.custom_order_sn),
				makeCheckField("order_status", "采购状态", order.status_text || order.status),
				makeCheckField("arrival_status", "到货状态", order.arrival_status_text || order.arrival_status),
				makeCheckField("pay_status", "付款状态", order.pay_status_text),
				makeCheckField("supplier", "供应商", order.supplier_name),
				makeCheckField("warehouse", "仓库", order.warehouse_name || order.order_warehouse_name),
				makeCheckField("order_time", "下单时间", formatDateTime(order.order_time)),
				makeCheckField("create_time_remote", "采购单创建", formatDateTime(order.create_time_remote)),
				makeCheckField("update_time_remote", "采购单更新", formatDateTime(order.update_time_remote)),
				makeCheckField("quantity", "采购总量", order.quantity),
				makeCheckField("quantity_real", "实际采购", order.quantity_real),
				makeCheckField("quantity_entry", "入库量", order.quantity_entry),
				makeCheckField("quantity_receive", "待到货数量", order.quantity_receive)
			]
		},
		{
			key: "item",
			title: "采购单明细",
			tag: item.item_id ? `领星明细 ${item.item_id}` : "",
			fields: [
				makeCheckField("order_item_id", "本地明细ID", current.order_item_id),
				makeCheckField("item_id", "领星明细ID", item.item_id),
				makeCheckField("product_name", "产品名", item.product_name || plan.product_name, { wide: true }),
				makeCheckField("sku", "SKU", item.sku),
				makeCheckField("fnsku", "FNSKU", item.fnsku),
				makeCheckField("first_msku", "首个 MSKU", item.first_msku),
				makeCheckField("quantity_plan", "计划采购", item.quantity_plan),
				makeCheckField("quantity_real", "实际采购", item.quantity_real),
				makeCheckField("quantity_entry", "入库量", item.quantity_entry),
				makeCheckField("quantity_receive", "待到货数量", item.quantity_receive),
				makeCheckField("quantity_per_case", "单箱数量", item.quantity_per_case),
				makeCheckField("expect_arrive_time", "预计到货", formatDateTime(item.expect_arrive_time)),
				makeCheckField("plan_creator", "计划创建人", item.plan_creator_name),
				makeCheckField("plan_create_time", "计划快照创建", formatDateTime(item.plan_create_time))
			]
		},
		{
			key: "plan",
			title: "关联采购计划",
			tag: plan.status_text || (current.plan_sn ? "已关联计划号" : "无计划号"),
			fields: [
				makeCheckField("plan_sn", "计划号", current.plan_sn || plan.plan_sn),
				makeCheckField("ppg_sn", "批次号", plan.ppg_sn),
				makeCheckField("local_sku", "本地 SKU", plan.sku),
				makeCheckField("plan_msku", "计划 MSKU", formatSkuList(plan.msku)),
				makeCheckField("fnsku", "FNSKU", plan.fnsku),
				makeCheckField("plan_status", "计划状态", plan.status_text || plan.status),
				makeCheckField("plan_qty", "计划采购量", plan.quantity_plan),
				makeCheckField("box_pcs", "装箱数", plan.cg_box_pcs || item.quantity_per_case),
				makeCheckField("warehouse", "计划仓库", plan.warehouse_name || item.plan_warehouse_name),
				makeCheckField("seller", "店铺", plan.seller_name || item.plan_seller_name),
				makeCheckField("marketplace", "国家", plan.marketplace || item.plan_marketplace),
				makeCheckField("supplier", "供应商", plan.supplier_name || item.plan_supplier_name),
				makeCheckField("analysis_record_id", "分析记录ID", plan.analysis_record_id),
				makeCheckField("expect_arrive_time", "计划到货", formatDateTime(plan.expect_arrive_time)),
				makeCheckField("create_time_remote", "计划创建", formatDateTime(plan.create_time_remote)),
				makeCheckField("update_time_remote", "计划更新", formatDateTime(plan.update_time_remote))
			]
		}
	];
});
const historyContextSummary = computed(() => {
	const current = row.value || {};
	const order = current.purchase_order || {};
	const item = current.item || {};
	const plan = current.purchase_plan || {};
	return [
		{ label: "下单时间", value: formatDateTime(order.order_time), source: "采购单主表" },
		{ label: "预计到货", value: formatDateTime(item.expect_arrive_time || plan.expect_arrive_time), source: item.expect_arrive_time ? "采购单明细" : "采购计划" },
		{ label: "计划创建", value: formatDateTime(plan.create_time_remote || item.plan_create_time), source: plan.create_time_remote ? "采购计划" : "采购单明细" },
		{ label: "采购单更新", value: formatDateTime(order.update_time_remote), source: "采购单主表" },
		{ label: "采购量", value: formatNumber(purchaseQuantity.value), source: "采购单明细" },
		{ label: "仓库", value: purchaseWarehouseName.value || "-", source: "采购计划" }
	];
});
const shippingMethodSummary = computed(() =>
	shippingMethodOptions.value.map((method: any) => `${method.label}${method.days}`).join(" · ")
);
const planStartSourceText = computed(() => {
	const plan = row.value?.purchase_plan || {};
	const item = row.value?.item || {};
	const order = row.value?.purchase_order || {};
	if (plan.create_time_remote || plan.create_time) return "采购计划";
	if (item.plan_create_time) return "采购单明细";
	if (order.order_time || order.create_time_remote) return "采购单主表";
	return "系统默认";
});
const compactOverviewRows = computed(() => [
	{ key: "order_sn", label: "采购单", value: row.value?.order_sn || "-", source: "采购单主表" },
	{ key: "plan_sn", label: "计划", value: row.value?.plan_sn || "-", source: "采购计划" },
	{ key: "qty", label: "采购量", value: formatNumber(form.final_purchase_qty || purchaseQuantity.value), source: "采购单明细", tone: "strong" },
	{ key: "warehouse", label: "仓库", value: purchaseWarehouseName.value || "-", source: getReferenceSource("warehouse", "采购计划") },
	{
		key: "marketplace",
		label: "国家",
		value: row.value?.purchase_plan?.marketplace || row.value?.item?.plan_marketplace || getListingMarketplaceValue(selectedListing.value) || "-",
		source: "采购计划"
	},
	{ key: "daily_avg", label: "日均", value: formatNumber(form.daily_avg_sales), source: getReferenceSource("daily_avg_sales", "店铺商品"), tone: "strong" },
	{
		key: "fba",
		label: "FBA",
		value: `${formatNumber(form.inventory.fba_valid)} / ${formatNumber(form.inventory.fba_reserved)} / ${formatNumber(form.inventory.inbound_qty)}`,
		source: "可售/预留/在途"
	},
	{ key: "box_pcs", label: "装箱", value: formatNumber(form.box_pcs), source: getReferenceSource("box_pcs", "采购单明细") },
	{
		key: "plan_start",
		label: "计划开始",
		value: form.plan_start_date || "-",
		source: getReferenceSourceLine("plan_start_date", planStartSourceText.value),
		tone: "strong"
	},
	{
		key: "shipping_profile",
		label: "运输配置",
		value: `${form.shipping_profile_label || "-"} / 缓冲${formatNumber(form.shipping_buffer_days)}天`,
		source: "批量补货配置",
		tone: "wide"
	},
	{
		key: "method_days",
		label: "配置天数",
		value: shippingMethodSummary.value || "-",
		source: "批量补货配置",
		tone: "wide"
	}
]);
const systemBasisRows = computed(() => [
	{
		key: "algorithm",
		label: "算法",
		value: currentAlgorithmLabel.value,
		source: getReferenceSource("algorithm_key", "系统默认"),
		strong: false
	},
	{
		key: "daily_avg",
		label: "日均销量",
		value: formatNumber(form.daily_avg_sales),
		source: getReferenceSource("daily_avg_sales", "店铺商品"),
		strong: true
	},
	{
		key: "shipping_profile",
		label: "运输配置",
		value: form.shipping_profile_label || "-",
		source: "按国家匹配"
	},
	{
		key: "buffer",
		label: "缓冲天数",
		value: `${formatNumber(form.shipping_buffer_days)}天`,
		source: getReferenceSource("shipping_buffer_days", "系统默认"),
		strong: true
	},
	{
		key: "plan_start",
		label: "计划开始",
		value: form.plan_start_date || "-",
		source: getReferenceSourceLine("plan_start_date", planStartSourceText.value)
	},
	{
		key: "method_days",
		label: "配置天数",
		value: shippingMethodSummary.value || "-",
		source: "批量补货配置",
		wide: true
	}
]);

function buildOverviewTooltip(item: any) {
	return [
		item?.label || "字段",
		"",
		`当前显示：${formatReferenceValue(item?.value)}`,
		`来源：${formatReferenceValue(item?.source)}`,
		item?.key === "method_days" ? `完整配置：${shippingMethodSummary.value || "-"}` : ""
	]
		.filter((line) => line !== "")
		.join("\n");
}

function buildShippingSummaryTooltip() {
	return [
		"运输方式配置天数",
		"",
		`运输配置：${form.shipping_profile_label || "-"}`,
		`缓冲天数：${formatNumber(form.shipping_buffer_days)}天`,
		`配置天数：${shippingMethodSummary.value || "-"}`,
		`推算基准日：${shippingBaseDate.value || "-"}`
	].join("\n");
}

const matchEvidenceRows = computed(() => {
	const current = row.value || {};
	const item = current.item || {};
	const plan = current.purchase_plan || {};
	const listing = selectedListing.value || {};
	const planSeller = plan.seller_name || item.plan_seller_name;
	const listingSeller = getListingShopValue(listing);
	const listingMarketplace = getListingMarketplaceValue(listing);

	return [
		makeEvidenceRow("item_msku", "明细 MSKU", "采购单", item.first_msku, "店铺商品", listing.msku),
		makeEvidenceRow("plan_local_sku", "计划本地 SKU", "采购计划", plan.sku, "店铺商品", listing.local_sku),
		makeEvidenceRow("plan_msku", "计划 MSKU", "采购计划", plan.msku, "店铺商品", listing.msku),
		makeEvidenceRow("seller", "店铺", "采购计划", planSeller, "店铺商品", listingSeller),
		makeEvidenceRow("marketplace", "国家", "采购计划", plan.marketplace || item.plan_marketplace, "店铺商品", listingMarketplace)
	];
});
const totalDays = computed(() => {
	if (!Array.isArray(form.cycle_range) || form.cycle_range.length !== 2) return 0;
	return diffDays(form.cycle_range[0], form.cycle_range[1]);
});
const suggestedByDaily = computed(() => {
	const daily = Number(form.daily_avg_sales) || 0;
	return totalDays.value > 0 ? Math.round(daily * totalDays.value) : 0;
});
const cycleDemandQty = computed(() => Math.max(0, Math.round((Number(form.daily_avg_sales) || 0) * totalDays.value)));
const cycleDemandTooltip = computed(() =>
	[
		"周期总需求",
		"",
		`销售周期：${form.cycle_range?.[0] || "-"} ~ ${form.cycle_range?.[1] || "-"}`,
		`周期天数：${totalDays.value} 天`,
		`日均消耗：${formatNumber(form.daily_avg_sales)}`,
		`计算：${formatNumber(form.daily_avg_sales)} × ${totalDays.value} = ${cycleDemandQty.value}`
	].join("\n")
);
const systemSuggestionText = computed(() => {
	const segmentText = activeSegments.value
		.map((item) => `${item.method_label}${formatNumber(getSegmentSuggestedQty(item))}`)
		.join(" + ");
	return segmentText
		? `分段建议 ${segmentText}；按采购单历史补全写入 ${formatNumber(form.system_suggested_qty)}`
		: `当前采购单数量 ${formatNumber(form.final_purchase_qty)} 作为历史补全建议`;
});
const actualPurchaseText = computed(() =>
	`装箱前 ${formatNumber(form.actual_purchase_qty_before_box)}；最终采购 ${formatNumber(form.final_purchase_qty)}；人工系数 ${formatNumber(form.manual_coefficient)}`
);
const formulaPreview = computed(() => {
	const segmentText = activeSegments.value.map((item) => `${item.method_label}${Number(item.final_qty) || 0}`).join(" + ") || "0";
	return `分段 ${segmentText} = ${segmentTotal.value}；最终采购 ${Number(form.final_purchase_qty) || 0}`;
});
const compactWritePreviewText = computed(() =>
	[
		`周期 ${form.cycle_range?.[0] || "-"}~${form.cycle_range?.[1] || "-"}`,
		`算法 ${currentAlgorithmLabel.value}`,
		`分段 ${segmentTotal.value}/${formatNumber(form.final_purchase_qty)}`,
		`仓库 ${selectedWarehouseName.value || "-"}`
	].join(" · ")
);
const referencePanelCards = computed(() => [
	{
		key: "daily_avg_sales",
		label: "日均销量",
		value: getReferenceValue("daily_avg_sales", formatNumber(form.daily_avg_sales)),
		source: getReferenceSource("daily_avg_sales", "店铺商品"),
		tone: "blue"
	},
	{
		key: "final_purchase_qty",
		label: "采购量",
		value: getReferenceValue("final_purchase_qty", formatNumber(form.final_purchase_qty)),
		source: getReferenceSource("final_purchase_qty", "采购单明细"),
		tone: "blue"
	},
	{
		key: "box_pcs",
		label: "装箱数",
		value: getReferenceValue("box_pcs", formatNumber(form.box_pcs)),
		source: getReferenceSource("box_pcs", "采购单明细"),
		tone: ""
	},
	{
		key: "warehouse",
		label: "仓库",
		value: getReferenceValue("warehouse", recommendedWarehouseText.value || "-"),
		source: getReferenceSource("warehouse", "采购计划"),
		tone: ""
	},
	{
		key: "fba_valid",
		label: "FBA可售",
		value: formatNumber(form.inventory.fba_valid),
		source: "店铺商品",
		tone: ""
	},
	{
		key: "fba_reserved",
		label: "FBA预留",
		value: formatNumber(form.inventory.fba_reserved),
		source: "店铺商品",
		tone: ""
	},
	{
		key: "inbound",
		label: "FBA在途",
		value: formatNumber(form.inventory.inbound_qty),
		source: "店铺商品",
		tone: "blue"
	},
	{
		key: "pending",
		label: "待交付 / 采购计划",
		value: `${formatNumber(form.inventory.local_pending_delivery)} / ${formatNumber(form.inventory.local_purchase_plan)}`,
		source: normalizeReferenceSource("历史上下文"),
		tone: ""
	},
	{
		key: "shipping_segments",
		label: "建议运输",
		value: prepareDefaults.value?.recommended_shipping_label || "无历史参考，需人工分配",
		source: getReferenceSource("shipping_segments", getReferenceSource("shipping_method", "系统推测")),
		tone: "orange"
	}
]);
const referenceDetailRows = computed(() => {
	const order = row.value?.purchase_order || {};
	const item = row.value?.item || {};
	const plan = row.value?.purchase_plan || {};
	return [
		{
			key: "cycle",
			label: "销售周期参考",
			value: getReferenceValue("cycle_range", "无历史参考，需人工填写"),
			source: getReferenceSource("cycle_range", "人工填写")
		},
		{
			key: "timeline",
			label: "采购单时间线",
			value: [
				`下单 ${formatReferenceBrief(formatDateTime(order.order_time))}`,
				`预计到货 ${formatReferenceBrief(formatDateTime(item.expect_arrive_time || plan.expect_arrive_time))}`,
				`更新 ${formatReferenceBrief(formatDateTime(order.update_time_remote))}`
			].join(" / "),
			source: "采购单主表"
		},
		{
			key: "warehouse",
			label: "推荐仓库来源",
			value: recommendedWarehouseText.value || "无仓库参考，需人工选择",
			source: getReferenceSource("warehouse", "采购计划")
		},
		{
			key: "shipping",
			label: "推荐运输依据",
			value: prepareDefaults.value?.recommended_shipping_reason || "无历史分段参考，需人工分配",
			source: getReferenceSource("shipping_segments", getReferenceSource("shipping_method", "人工填写"))
		}
	];
});
const hasHistoryShippingSuggestion = computed(() =>
	preparedShippingDefaults.value.some((item: any) => {
		const hasHistorySource = String(item?.source || "").includes("历史");
		const hasUsablePlan =
			Number(item?.final_qty) > 0 ||
			Number(item?.system_suggested_qty) > 0 ||
			(Boolean(item?.start_date) && Boolean(item?.end_date));
		return Boolean(item?.active && hasHistorySource && hasUsablePlan);
	})
);

watch(
	() => [props.visible, props.row?.order_item_id, props.row?.suggested_listing?.id],
	([visible]) => {
		if (visible && props.row) {
			initFromRow(props.row);
		}
		if (!visible) {
			clearRemarkAttentionTimer();
			remarkAttentionActive.value = false;
		}
	}
);

onBeforeUnmount(() => {
	clearRemarkAttentionTimer();
});

async function initFromRow(current: any) {
	currentStep.value = "select";
	validationText.value = "";
	prepareData.value = null;
	preparedKey.value = "";
	verificationActiveNames.value = ["order"];
	historyContextActiveNames.value = [];
	advancedWriteActiveNames.value = [];
	selectedListing.value = current.suggested_listing || null;
	listingList.value = current.suggested_listing ? [current.suggested_listing] : [];
	listingKeyword.value = current.item?.first_msku || current.purchase_plan?.sku || current.item?.sku || current.plan_sn || "";
	listingSellerFilter.value = current.purchase_plan?.seller_name || current.item?.plan_seller_name || "";
	listingMarketplaceFilter.value = current.purchase_plan?.marketplace || current.item?.plan_marketplace || "";
	resetForm({});
	shippingInactiveMethods.value = [];
	nextTick(() => formRef.value?.clearValidate());
}

async function loadPrepare(force = false) {
	if (!row.value || !selectedListing.value) return;
	const key = `${row.value.order_item_id}:${selectedListing.value.id}`;
	if (!force && preparedKey.value === key && prepareData.value) return;
	prepareLoading.value = true;
	try {
		const res = await manualLinkService.value.prepare({
			order_item_id: row.value.order_item_id,
			listing_id: selectedListing.value?.id || undefined
		});
		prepareData.value = res || {};
		preparedKey.value = key;
		if (!selectedListing.value && res?.listing) {
			selectedListing.value = res.listing;
			listingList.value = [res.listing];
		}
		resetForm(res || {});
		await loadLocalProductBoxPcs();
		await fetchWarehouseList();
		matchWarehouseRecommendation();
		await loadShippingMethodPrefs();
		if (!hasHistoryShippingSuggestion.value) {
			applyCoverageShippingAllocation(true);
		}
	} catch (error: any) {
		ElMessage.error(error?.message || "加载补全草稿失败");
		resetForm({});
	} finally {
		prepareLoading.value = false;
	}
}

function resetForm(data: any) {
	const defaults = data?.defaults || {};
	const finalQty =
		Number(defaults.final_purchase_qty) ||
		Number(row.value?.item?.quantity_plan) ||
		Number(row.value?.purchase_plan?.quantity_plan) ||
		undefined;
	form.algorithm_key = defaults.algorithm_key || "daily_avg";
	form.shipping_profile_key = defaults.recommended_shipping_profile_key || inferShippingProfileKey();
	form.shipping_profile_label = resolveShippingProfileLabel(form.shipping_profile_key);
	form.shipping_buffer_days = normalizeShippingBuffer(defaults.shipping_buffer_days);
	form.plan_start_date = defaults.plan_start_date || getDefaultShippingBaseDate();
	form.daily_avg_sales = Number(defaults.daily_avg_sales) || getListingDailyAvg(selectedListing.value) || undefined;
	form.cycle_range = defaults.cycle_start_date && defaults.cycle_end_date ? [defaults.cycle_start_date, defaults.cycle_end_date] : [];
	form.target_stock_days = Number(defaults.target_stock_days) || 20;
	form.volatility_coefficient = Number(defaults.volatility_coefficient) || 0.75;
	form.manual_coefficient = Number(defaults.manual_coefficient) || 1;
	form.system_suggested_qty = Number(defaults.system_suggested_qty) || finalQty;
	form.actual_purchase_qty_before_box = Number(defaults.actual_purchase_qty_before_box) || finalQty;
	form.final_purchase_qty = finalQty;
	form.box_pcs = Number(defaults.box_pcs) || undefined;
	form.warehouse_wid = defaults.warehouse_wid || undefined;
	form.warehouse_name = defaults.warehouse_name || "";
	form.shipping_adjust_mode = defaults.shipping_adjust_mode || "independent";
	form.manual_remark = "";
	boxPcsLookupLoading.value = false;
	boxPcsLookupValue.value = undefined;
	boxPcsLookupMessage.value = "";
	shippingBaseDate.value = form.plan_start_date || getDefaultShippingBaseDate();
	Object.keys(touchedFields).forEach((key) => delete touchedFields[key]);
	Object.keys(systemCalculatedFields).forEach((key) => delete systemCalculatedFields[key]);
	Object.assign(form.inventory, {
		fba_valid: 0,
		fba_reserved: 0,
		inbound_qty: 0,
		local_valid: 0,
		local_purchase_plan: 0,
		local_pending_delivery: 0,
		lingxing_purchase_plan: 0,
		lingxing_pending_delivery: 0,
		...(defaults.inventory || {})
	});
	preparedShippingDefaults.value = JSON.parse(JSON.stringify(Array.isArray(defaults.shipping_segments) ? defaults.shipping_segments : []));
	form.shipping_segments = normalizeSegmentDefaults(defaults.shipping_segments);
}

function buildShippingMethodsForProfile(profileKey: string) {
	const profileMap: Record<string, Record<string, number>> = {
		default: {
			express: 5,
			air: 8,
			air_slow: 10,
			truck: 30,
			rail: 35,
			sea: 60
		},
		uk: {
			express: 5,
			air: 9,
			air_slow: 14,
			truck: 28,
			sea: 52
		},
		de: {
			express: 5,
			air: 16,
			air_slow: 20,
			truck: 30,
			sea: 56
		}
	};
	const selected = profileMap[profileKey] || profileMap.default;
	return fallbackShippingMethods
		.filter((method) => Object.prototype.hasOwnProperty.call(selected, method.key))
		.map((method) => ({
			...method,
			days: selected[method.key] ?? method.days
		}));
}

function resolveShippingProfileLabel(profileKey: string) {
	return shippingProfileOptions.value.find((item: any) => item.key === profileKey)?.label || "默认";
}

function normalizeShippingBuffer(value: any) {
	const num = Number(value);
	return Number.isFinite(num) && num >= 0 ? Math.round(num) : DEFAULT_SHIPPING_BUFFER;
}

function inferShippingProfileKey() {
	const text = [
		row.value?.purchase_plan?.marketplace,
		row.value?.item?.plan_marketplace,
		selectedListing.value?.marketplace,
		selectedListing.value?.country
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	if (/英国|uk|united kingdom|gb|great britain/.test(text)) return "uk";
	if (/德国|de|germany|deutschland/.test(text)) return "de";
	return "default";
}

function normalizeSegmentDefaults(defaults: any[] = []) {
	const hasSourceDefaults = Array.isArray(defaults) && defaults.length > 0;
	const sourceMap = new Map((Array.isArray(defaults) ? defaults : []).map((item) => [item.method_key, item]));
	return shippingMethodOptions.value.map((method: any) => {
		const hasMethodDefault = sourceMap.has(method.key);
		const item: any = sourceMap.get(method.key) || {};
		return {
			method_key: method.key,
			method_label: item.method_label || method.label,
			days_to_arrive: Number(item.days_to_arrive || method.days) || 0,
			color: item.color || method.color || "#909399",
			icon: item.icon || method.icon || "",
			active: hasSourceDefaults && hasMethodDefault ? Boolean(item.active) : true,
			start_date: item.start_date || "",
			end_date: item.end_date || "",
			period_days: Number(item.period_days) || 0,
			coefficient: Number(item.coefficient) || 1,
			raw_coefficient: Number(item.raw_coefficient) || Number(item.coefficient) || 1,
			adjusted_coefficient: Number(item.adjusted_coefficient) || Number(item.coefficient) || 1,
			system_suggested_qty: Number(item.system_suggested_qty) || 0,
			purchase_plan_deducted_qty: Number(item.purchase_plan_deducted_qty) || 0,
			local_pending_delivery_deducted_qty: Number(item.local_pending_delivery_deducted_qty) || 0,
			final_qty: Number(item.final_qty) || 0,
			alpha_mode: item.alpha_mode || "system",
			manual_alpha: item.manual_alpha ?? null,
			monthly_coefficients: item.monthly_coefficients || null,
			recommended: Boolean(item.recommended),
			source: item.source || "",
			allocation_status: item.allocation_status || (item.active ? "manual_assigned" : "inactive"),
			source_confidence: item.source_confidence || "",
			help_text: item.help_text || "",
			scaled_from_qty: Number(item.scaled_from_qty) || undefined,
			calculation_trace: item.calculation_trace || null
		};
	});
}

function handleShippingProfileChange(value: string) {
	form.shipping_profile_key = value || "default";
	form.shipping_profile_label = resolveShippingProfileLabel(form.shipping_profile_key);
	markFieldTouched("shipping_profile");
	const currentSegments = form.shipping_segments.map((segment) => ({
		...segment,
		active: segment.active,
		days_to_arrive: undefined
	}));
	form.shipping_segments = normalizeSegmentDefaults(currentSegments);
	applyShippingMethodPrefsToSegments();
	applyCoverageShippingAllocation(true);
}

function handleAlgorithmChange() {
	markFieldTouched("algorithm_key");
	applyCoverageShippingAllocation(true);
}

function handlePlanStartChange() {
	form.plan_start_date = normalizeDateOnly(form.plan_start_date) || getDefaultShippingBaseDate();
	shippingBaseDate.value = form.plan_start_date;
	markFieldTouched("plan_start_date");
	applyCoverageShippingAllocation(true);
}

function handleShippingBufferChange() {
	form.shipping_buffer_days = normalizeShippingBuffer(form.shipping_buffer_days);
	markFieldTouched("shipping_buffer_days");
	applyCoverageShippingAllocation(true);
}

function handleRecalculateFieldChange(key: string) {
	markFieldTouched(key);
	applyCoverageShippingAllocation(true);
}

function clearSelectedListing() {
	selectedListing.value = null;
	preparedKey.value = "";
	prepareData.value = null;
	shippingInactiveMethods.value = [];
}

function selectListing(item: any) {
	selectedListing.value = item;
	preparedKey.value = "";
	prepareData.value = null;
	shippingInactiveMethods.value = [];
	validationText.value = "";
	if (!listingList.value.some((row) => Number(row.id) === Number(item.id))) {
		listingList.value.unshift(item);
	}
}

async function searchListings() {
	if (!row.value) return;
	listingLoading.value = true;
	try {
		const res = await manualLinkService.value.searchListings({
			keyWord: listingKeyword.value,
			seller_name: listingSellerFilter.value,
			marketplace: listingMarketplaceFilter.value,
			size: 10
		});
		listingList.value = Array.isArray(res?.list) ? res.list : [];
		if (selectedListing.value && !listingList.value.some((item) => Number(item.id) === Number(selectedListing.value?.id))) {
			listingList.value.unshift(selectedListing.value);
		}
	} catch (error: any) {
		ElMessage.error(error?.message || "搜索店铺商品失败");
	} finally {
		listingLoading.value = false;
	}
}

async function goHistoryStep() {
	validationText.value = "";
	if (!selectedListing.value) {
		validationText.value = "请先确认要关联的店铺商品";
		return;
	}
	currentStep.value = "history";
	await loadPrepare();
	if (
		!hasHistoryShippingSuggestion.value &&
		Number(form.final_purchase_qty) > 0 &&
		Number(form.daily_avg_sales) > 0 &&
		segmentTotal.value !== Number(form.final_purchase_qty)
	) {
		applyCoverageShippingAllocation(true);
	}
	nextTick(() => formRef.value?.clearValidate());
}

function goSelectStep() {
	currentStep.value = "select";
	validationText.value = "";
}

async function fetchWarehouseList() {
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
			ElMessage.warning("未获取到可用采购仓库，请检查仓库接口");
		}
	} catch (error) {
		console.error("获取采购仓库列表失败:", error);
		ElMessage.error("获取采购仓库列表失败，请稍后重试");
	} finally {
		warehouseLoading.value = false;
	}
}

function buildShippingMethodPrefsPayloadItem() {
	const listing = selectedListing.value || {};
	return {
		clientKey: `manual_link_${row.value?.order_item_id || "row"}_${listing.id || "listing"}`,
		listing_id: listing.id,
		product_code: listing.product_code,
		marketplace: listing.marketplace,
		asin: listing.asin,
		msku: listing.msku,
		store_id: listing.store_id
	};
}

function buildBoxPcsPayloadItem() {
	const listing = selectedListing.value || {};
	return {
		clientKey: `manual_link_box_${row.value?.order_item_id || "row"}_${listing.id || "listing"}`,
		listing_id: listing.id,
		product_id: listing.product_id,
		local_sku: listing.local_sku,
		msku: listing.msku,
		asin: listing.asin,
		marketplace: listing.marketplace,
		store_id: listing.store_id
	};
}

function normalizePositiveIntegerValue(value: any) {
	const num = Number(value);
	if (!Number.isFinite(num)) return undefined;
	const normalized = Math.round(num);
	return normalized > 0 ? normalized : undefined;
}

async function loadLocalProductBoxPcs() {
	boxPcsLookupValue.value = undefined;
	boxPcsLookupMessage.value = "";
	if (!selectedListing.value) return;

	boxPcsLookupLoading.value = true;
	try {
		const payloadItem = buildBoxPcsPayloadItem();
		const res = await service.request({
			url: "/admin/app/analysis/getLocalProductBoxPcsBatch",
			method: "POST",
			data: {
				items: [payloadItem]
			}
		});
		const matched = (Array.isArray(res?.list) ? res.list : []).find((item: any) => item?.clientKey === payloadItem.clientKey) || res?.list?.[0] || {};
		const boxPcs = normalizePositiveIntegerValue(matched?.cg_box_pcs);
		if (boxPcs) {
			boxPcsLookupValue.value = boxPcs;
			boxPcsLookupMessage.value = "";
			if (!normalizePositiveIntegerValue(form.box_pcs)) {
				form.box_pcs = boxPcs;
				systemCalculatedFields.box_pcs = true;
				delete touchedFields.box_pcs;
			}
			return;
		}
		boxPcsLookupMessage.value = matched?.message || "未查到有效装箱数，提交时不做整箱调整";
	} catch (error: any) {
		console.error("查询本地产品装箱数失败:", error);
		boxPcsLookupMessage.value = error?.message || "装箱数查询失败，提交时不做整箱调整";
	} finally {
		boxPcsLookupLoading.value = false;
	}
}

function normalizeInactiveShippingMethods(value: any) {
	const validKeys = new Set(shippingMethodOptions.value.map((method: any) => method.key));
	const seen = new Set<string>();
	const normalized: string[] = [];
	for (const raw of Array.isArray(value) ? value : []) {
		const key = String(raw || "").trim();
		if (!validKeys.has(key) || seen.has(key)) continue;
		seen.add(key);
		normalized.push(key);
	}
	return normalized;
}

async function loadShippingMethodPrefs() {
	shippingInactiveMethods.value = [];
	if (!selectedListing.value) return;
	shippingPrefsLoading.value = true;
	try {
		const payloadItem = buildShippingMethodPrefsPayloadItem();
		const res = await service.request({
			url: "/admin/app/analysis/getShippingMethodPrefsBatch",
			method: "POST",
			data: {
				items: [payloadItem]
			}
		});
		const matched = (Array.isArray(res?.list) ? res.list : []).find((item: any) => item?.clientKey === payloadItem.clientKey) || res?.list?.[0] || {};
		shippingInactiveMethods.value = normalizeInactiveShippingMethods(matched?.inactive_methods);
		applyShippingMethodPrefsToSegments();
	} catch (error: any) {
		console.error("读取运输方式偏好失败:", error);
		shippingInactiveMethods.value = [];
		applyShippingMethodPrefsToSegments();
		ElMessage.warning(error?.message || "运输方式偏好读取失败，已默认全开");
	} finally {
		shippingPrefsLoading.value = false;
	}
}

function applyShippingMethodPrefsToSegments() {
	if (hasHistoryShippingSuggestion.value) return;
	const inactiveSet = new Set(shippingInactiveMethods.value);
	let activeCount = 0;
	form.shipping_segments.forEach((segment) => {
		const isInactiveByPref = inactiveSet.has(segment.method_key);
		segment.active = !isInactiveByPref;
		if (segment.active) {
			activeCount += 1;
			segment.source = segment.recommended ? segment.source || "系统推测" : "系统默认";
			segment.source_confidence = segment.recommended ? segment.source_confidence || "low" : "manual_required";
			segment.allocation_status = segment.final_qty > 0 ? "manual_assigned" : "manual_required";
			segment.help_text = segment.help_text || "运输方式默认启用；可按当前配置重新推算周期和数量，也可人工调整。";
			return;
		}
		segment.start_date = "";
		segment.end_date = "";
		segment.period_days = 0;
		segment.system_suggested_qty = 0;
		segment.final_qty = 0;
		segment.source = "运输偏好排除";
		segment.source_confidence = "high";
		segment.allocation_status = "inactive_preference";
		segment.help_text = "该方式按批量补货运输偏好默认关闭；可手动重新启用。";
	});
	if (activeCount === 0 && form.shipping_segments.length) {
		const fallback = form.shipping_segments.find((segment) => segment.recommended) || form.shipping_segments[0];
		fallback.active = true;
		fallback.source = "系统默认";
		fallback.source_confidence = "manual_required";
		fallback.allocation_status = "manual_required";
		fallback.help_text = "运输偏好排除了全部方式，系统保留一个可用方式以便继续补全。";
		ElMessage.warning("运输偏好排除了全部方式，已保留一个可用方式");
	}
	refreshSegmentDays();
}

function handleWarehouseDropdownVisible(visible: boolean) {
	if (visible) {
		void fetchWarehouseList().then(() => matchWarehouseRecommendation());
	}
}

function matchWarehouseRecommendation() {
	if (!hasWarehouseOptions.value) {
		form.warehouse_wid = undefined;
		form.warehouse_name = form.warehouse_name || recommendedWarehouseText.value || "";
		return;
	}
	const currentWid = normalizeWarehouseWid(form.warehouse_wid);
	if (currentWid) {
		const selected = warehouseOptions.value.find((item: any) => normalizeWarehouseWid(item.wid) === currentWid);
		if (selected) {
			form.warehouse_wid = selected.wid;
			form.warehouse_name = selected.name || "";
			return;
		}
	}

	const targetName = normalizeWarehouseName(form.warehouse_name || recommendedWarehouseText.value || purchaseWarehouseName.value);
	if (!targetName) {
		form.warehouse_wid = undefined;
		return;
	}
	const matched = warehouseOptions.value.find((item: any) => normalizeWarehouseName(item.name) === targetName);
	if (matched) {
		form.warehouse_wid = matched.wid;
		form.warehouse_name = matched.name || "";
		return;
	}

	form.warehouse_wid = undefined;
	form.warehouse_name = form.warehouse_name || recommendedWarehouseText.value || "";
}

function handleWarehouseChange(value: any) {
	markFieldTouched("warehouse");
	const item = warehouseOptions.value.find((row: any) => normalizeWarehouseWid(row.wid) === normalizeWarehouseWid(value));
	if (item?.name) {
		form.warehouse_name = item.name;
	} else if (!value) {
		form.warehouse_name = "";
	}
}

function handleSegmentActiveChange(segment: ShippingSegmentForm) {
	if (!segment.active) {
		if (activeSegments.value.length === 0) {
			segment.active = true;
			ElMessage.warning("至少保留一种运输方式");
			return;
		}
		segment.final_qty = 0;
		segment.system_suggested_qty = 0;
		segment.allocation_status = "inactive";
		if (!segment.recommended) {
			segment.source = "";
			segment.source_confidence = "";
		}
	} else {
		if (form.cycle_range?.[0] && form.cycle_range?.[1]) {
			segment.start_date = segment.start_date || form.cycle_range[0];
			segment.end_date = segment.end_date || form.cycle_range[1];
		}
		segment.allocation_status = segment.allocation_status === "inactive" ? "manual_assigned" : segment.allocation_status;
		segment.source = segment.source || "人工填写";
		segment.help_text = segment.help_text || "人工启用该运输方式，提交前需确认周期和最终数量。";
	}
	refreshSegmentDays();
}

function handleSegmentDaysChange(segment: ShippingSegmentForm) {
	segment.days_to_arrive = Math.max(1, Math.round(Number(segment.days_to_arrive) || 1));
	segment.help_text = segment.help_text || "运输天数已确认；点击按当前配置重新推算后会重新生成周期和数量。";
	if (segment.active && segment.allocation_status === "manual_required") {
		segment.source = segment.source || "人工填写";
	}
	applyCoverageShippingAllocation(true);
}

function handleSegmentQtyChange(segment: ShippingSegmentForm) {
	segment.final_qty = Math.max(0, Math.round(Number(segment.final_qty) || 0));
	if (!segment.active) return;
	segment.source = "人工填写";
	segment.source_confidence = "high";
	segment.allocation_status = "manual_assigned";
	segment.help_text = "该分段数量已由用户人工调整。";
	patchSegmentTraceFinalQty(segment);
}

function patchSegmentTraceFinalQty(segment: ShippingSegmentForm) {
	if (!segment.calculation_trace) {
		segment.calculation_trace = {};
	}
	segment.calculation_trace.final_qty = Number(segment.final_qty) || 0;
	const lines = Array.isArray(segment.calculation_trace.lines) ? [...segment.calculation_trace.lines] : [];
	const text = `填写数量：用户最终确认本段写入 ${formatNumber(segment.final_qty)}`;
	const index = lines.findIndex((line: string) => String(line).startsWith("填写数量："));
	if (index >= 0) {
		lines[index] = text;
	} else {
		lines.push(text);
	}
	segment.calculation_trace.lines = lines;
}

function applyRecommendedSegment(segment: ShippingSegmentForm) {
	segment.active = true;
	if (form.cycle_range?.[0] && form.cycle_range?.[1]) {
		segment.start_date = segment.start_date || form.cycle_range[0];
		segment.end_date = segment.end_date || form.cycle_range[1];
	}
	fillRemaining(segment);
	refreshSegmentDays();
}

function buildSegmentCalculationTrace(input: {
	segment: ShippingSegmentForm;
	baseDate: string;
	bufferDays: number;
	arrivalDate: string;
	nextLabel?: string;
	nextArrivalDate?: string;
	startDate: string;
	endDate: string;
	periodDays: number;
	rawQty: number;
	referenceQty: number;
	finalQty: number;
}) {
	const dailyAvg = Number(form.daily_avg_sales) || 0;
	const volatility = Number(form.volatility_coefficient) || 1;
	const manual = Number(form.manual_coefficient) || 1;
	const segmentCoefficient = Number(input.segment.adjusted_coefficient) || Number(input.segment.coefficient) || 1;
	const factorText = segmentCoefficient !== 1
		? ` × 分段系数 ${formatNumber(segmentCoefficient)}`
		: "";
	const rawText = formatNumber(input.rawQty);
	const nextLine = input.nextArrivalDate
		? `到下一个方式${input.nextLabel || ""}到达日前一天 ${input.endDate}`
		: `最后一段按目标库存天数覆盖到 ${input.endDate}`;

	return {
		plan_start_date: input.baseDate,
		buffer_days: input.bufferDays,
		days_to_arrive: Number(input.segment.days_to_arrive) || 0,
		arrival_date: input.arrivalDate,
		coverage_start_date: input.startDate,
		coverage_end_date: input.endDate,
		coverage_days: input.periodDays,
		daily_avg_sales: dailyAvg,
		volatility_coefficient: volatility,
		manual_coefficient: manual,
		segment_coefficient: segmentCoefficient,
		raw_suggested_qty: Number(rawText) || 0,
		suggested_qty: input.referenceQty,
		final_qty: input.finalQty,
		lines: [
			`计划开始 ${input.baseDate || "-"} + 缓冲 ${input.bufferDays} 天 + ${input.segment.method_label} ${Number(input.segment.days_to_arrive) || 0} 天 = ${input.arrivalDate || "-"}`,
			`覆盖周期：本段到达日 ${input.arrivalDate || "-"}，${nextLine}，共 ${input.periodDays} 天`,
			`建议发货：日均 ${formatNumber(dailyAvg)} × ${input.periodDays} 天${factorText} × 波动系数 ${formatNumber(volatility)} × 人工系数 ${formatNumber(manual)} = ${rawText}，取整 ${input.referenceQty}`,
			`填写数量：按采购单总量 ${formatNumber(form.final_purchase_qty)} 做比例和尾差修正后，本段写入 ${input.finalQty}`,
		],
	};
}

function applyCoverageShippingAllocation(silent = false) {
	const finalQty = Number(form.final_purchase_qty) || 0;
	if (finalQty <= 0) {
		if (!silent) ElMessage.warning("缺少采购单数量，不能推算分段");
		return;
	}
	const baseDate = normalizeDateOnly(form.plan_start_date) || normalizeDateOnly(shippingBaseDate.value) || getDefaultShippingBaseDate();
	form.plan_start_date = baseDate;
	shippingBaseDate.value = baseDate;
	const bufferDays = normalizeShippingBuffer(form.shipping_buffer_days);
	form.shipping_buffer_days = bufferDays;
	const enabled = activeSegments.value
		.map((segment, index) => ({
			segment,
			index,
			arrivalDate: addDateDays(baseDate, bufferDays + (Number(segment.days_to_arrive) || 0)),
			daysToArrive: Number(segment.days_to_arrive) || 0
		}))
		.sort((a, b) => a.daysToArrive - b.daysToArrive || a.index - b.index);
	if (enabled.length === 0) {
		if (!silent) ElMessage.warning("至少启用一个运输分段");
		return;
	}

	const coverageRows: Array<{
		segment: ShippingSegmentForm;
		arrivalDate: string;
		nextLabel?: string;
		nextArrivalDate?: string;
		startDate: string;
		endDate: string;
		periodDays: number;
		rawQty: number;
	}> = [];
	enabled.forEach((item, index) => {
		const next = enabled[index + 1];
		const startDate = item.arrivalDate;
		const endDate = next
			? addDateDays(next.arrivalDate, -1)
			: addDateDays(item.arrivalDate, Math.max(1, Number(form.target_stock_days) || 1) - 1);
		if (!startDate || !endDate || startDate > endDate) return;
		const periodDays = diffDays(startDate, endDate);
		if (periodDays <= 0) return;
		const coefficient =
			(Number(item.segment.adjusted_coefficient) || Number(item.segment.coefficient) || 1) *
			(Number(form.manual_coefficient) || 1) *
			(Number(form.volatility_coefficient) || 1);
		const rawQty = Math.max(0, (Number(form.daily_avg_sales) || 0) * periodDays * coefficient);
		coverageRows.push({
			segment: item.segment,
			arrivalDate: item.arrivalDate,
			nextLabel: next?.segment?.method_label,
			nextArrivalDate: next?.arrivalDate,
			startDate,
			endDate,
			periodDays,
			rawQty
		});
	});

	if (coverageRows.length === 0) {
		if (!silent) ElMessage.warning("当前配置没有可覆盖周期，请调整计划开始或运输天数");
		return;
	}
	form.cycle_range = [coverageRows[0].startDate, coverageRows[coverageRows.length - 1].endDate];
	markFieldCalculated("cycle_range");

	const rawTotal = coverageRows.reduce((sum, item) => sum + item.rawQty, 0);
	const dayTotal = coverageRows.reduce((sum, item) => sum + item.periodDays, 0) || 1;
	const activeKeys = new Set(coverageRows.map((item) => item.segment.method_key));
	form.shipping_segments.forEach((segment) => {
		if (!segment.active || activeKeys.has(segment.method_key)) return;
		segment.active = false;
		segment.start_date = "";
		segment.end_date = "";
		segment.period_days = 0;
		segment.system_suggested_qty = 0;
		segment.final_qty = 0;
		segment.source = "覆盖区间推算";
		segment.source_confidence = "medium";
		segment.allocation_status = "no_coverage";
		segment.help_text = "按当前基准日和销售周期推算，该运输方式没有可覆盖周期。";
		segment.calculation_trace = {
			active: false,
			lines: ["该运输方式未启用，不参与覆盖周期和建议数量推算。"]
		};
	});

	let remainingQty = Math.round(finalQty);
	coverageRows.forEach((item, index) => {
		const isLast = index === coverageRows.length - 1;
		const ratio = rawTotal > 0 ? item.rawQty / rawTotal : item.periodDays / dayTotal;
		const finalSegmentQty = isLast ? remainingQty : Math.max(0, Math.round(finalQty * ratio));
		remainingQty -= finalSegmentQty;
		const referenceQty = Math.round(item.rawQty || finalQty * (item.periodDays / dayTotal));
		item.segment.active = finalSegmentQty > 0;
		item.segment.start_date = finalSegmentQty > 0 ? item.startDate : "";
		item.segment.end_date = finalSegmentQty > 0 ? item.endDate : "";
		item.segment.period_days = finalSegmentQty > 0 ? item.periodDays : 0;
		item.segment.system_suggested_qty = finalSegmentQty > 0 ? referenceQty : 0;
		item.segment.final_qty = finalSegmentQty > 0 ? finalSegmentQty : 0;
		item.segment.source = "覆盖区间推算";
		item.segment.source_confidence = "medium";
		item.segment.allocation_status = finalSegmentQty > 0 ? "coverage_calculated" : "no_quantity";
		item.segment.help_text =
			finalSegmentQty > 0
				? `基准日 ${baseDate} + 缓冲 ${bufferDays} 天 + 运输 ${item.segment.days_to_arrive} 天得到到达日，按 ${item.periodDays} 天覆盖期推算后再按最终采购量修正尾差。`
				: "该分段按比例分配后数量为 0，系统暂不启用。";
		item.segment.calculation_trace = buildSegmentCalculationTrace({
			segment: item.segment,
			baseDate,
			bufferDays,
			arrivalDate: item.arrivalDate,
			nextLabel: item.nextLabel,
			nextArrivalDate: item.nextArrivalDate,
			startDate: item.startDate,
			endDate: item.endDate,
			periodDays: item.periodDays,
			rawQty: item.rawQty,
			referenceQty,
			finalQty: finalSegmentQty
		});
	});
	refreshSegmentDays();
	if (!silent) ElMessage.success("已按当前配置推算运输周期和数量");
}

function restoreShippingSuggestion() {
	form.shipping_segments = normalizeSegmentDefaults(preparedShippingDefaults.value);
	applyShippingMethodPrefsToSegments();
	if (!hasHistoryShippingSuggestion.value) {
		applyCoverageShippingAllocation(true);
	}
	refreshSegmentDays();
	ElMessage.success(hasHistoryShippingSuggestion.value ? "已恢复历史分段建议" : "已恢复系统运输建议");
}

function applyCycleToActiveSegments() {
	if (!form.cycle_range?.[0] || !form.cycle_range?.[1]) {
		ElMessage.warning("请先选择销售周期");
		return;
	}
	activeSegments.value.forEach((segment) => {
		segment.start_date = segment.start_date || form.cycle_range[0];
		segment.end_date = segment.end_date || form.cycle_range[1];
	});
	refreshSegmentDays();
}

function applyDailyDemand() {
	if (suggestedByDaily.value <= 0) {
		ElMessage.warning("请先填写日均销量和销售周期");
		return;
	}
	form.system_suggested_qty = suggestedByDaily.value;
	form.actual_purchase_qty_before_box = suggestedByDaily.value;
	if (!form.final_purchase_qty) {
		form.final_purchase_qty = suggestedByDaily.value;
	}
	activeSegments.value.forEach((segment) => {
		if (!segment.start_date || !segment.end_date) return;
		const days = diffDays(segment.start_date, segment.end_date);
		segment.system_suggested_qty = Math.round((Number(form.daily_avg_sales) || 0) * days * (Number(segment.coefficient) || 1));
	});
	if (form.cycle_range?.[0] && form.cycle_range?.[1]) {
		applyCoverageShippingAllocation();
	}
}

function fillRemaining(segment: ShippingSegmentForm) {
	const otherTotal = activeSegments.value
		.filter((item) => item.method_key !== segment.method_key)
		.reduce((sum, item) => sum + (Number(item.final_qty) || 0), 0);
	segment.final_qty = Math.max(0, (Number(form.final_purchase_qty) || 0) - otherTotal);
	if (!segment.system_suggested_qty) {
		segment.system_suggested_qty = segment.final_qty;
	}
	handleSegmentQtyChange(segment);
}

function restoreSegmentSuggestion(segment: ShippingSegmentForm) {
	segment.active = true;
	if (form.cycle_range?.[0] && form.cycle_range?.[1]) {
		segment.start_date = segment.start_date || form.cycle_range[0];
		segment.end_date = segment.end_date || form.cycle_range[1];
	}
	const sourceQty = Number(segment.system_suggested_qty) || Number(segment.final_qty) || 0;
	if (sourceQty > 0) {
		segment.final_qty = sourceQty;
	} else {
		fillRemaining(segment);
	}
	segment.allocation_status = segment.allocation_status === "inactive" ? "manual_assigned" : segment.allocation_status;
	patchSegmentTraceFinalQty(segment);
	refreshSegmentDays();
}

function syncFinalFromSegments() {
	if (segmentTotal.value <= 0) {
		ElMessage.warning("运输分段合计为 0");
		return;
	}
	form.final_purchase_qty = segmentTotal.value;
	if (!form.actual_purchase_qty_before_box) {
		form.actual_purchase_qty_before_box = segmentTotal.value;
	}
	if (!form.system_suggested_qty) {
		form.system_suggested_qty = segmentTotal.value;
	}
}

function refreshSegmentDays() {
	form.shipping_segments.forEach((segment) => {
		segment.period_days = segment.start_date && segment.end_date ? Math.max(diffDays(segment.start_date, segment.end_date), 0) : 0;
	});
}

let remarkAttentionTimer: ReturnType<typeof window.setTimeout> | null = null;

function clearRemarkAttentionTimer() {
	if (remarkAttentionTimer) {
		window.clearTimeout(remarkAttentionTimer);
		remarkAttentionTimer = null;
	}
}

async function focusManualRemark(message?: string) {
	if (message) {
		validationText.value = message;
	}
	remarkAttentionActive.value = true;
	clearRemarkAttentionTimer();
	await nextTick();
	formRef.value?.scrollToField?.("manual_remark");
	const input = manualRemarkFieldRef.value?.querySelector("input, textarea") as HTMLInputElement | HTMLTextAreaElement | null;
	input?.focus();
	remarkAttentionTimer = window.setTimeout(() => {
		remarkAttentionActive.value = false;
		remarkAttentionTimer = null;
	}, 2500);
}

async function validateForm() {
	validationText.value = "";
	if (!selectedListing.value) {
		validationText.value = "请选择真实店铺商品";
		return false;
	}
	const valid = await formRef.value?.validate().catch(() => false);
	if (!valid) return false;
	if (!normalizeWarehouseWid(form.warehouse_wid)) {
		validationText.value = "请选择真实采购仓库";
		return false;
	}
	if (activeSegments.value.length === 0) {
		validationText.value = "至少启用一个运输分段";
		return false;
	}
	const [cycleStart, cycleEnd] = form.cycle_range;
	for (const segment of activeSegments.value) {
		if (!segment.start_date || !segment.end_date) {
			validationText.value = `${segment.method_label}缺少分段日期`;
			return false;
		}
		if (segment.start_date < cycleStart || segment.end_date > cycleEnd) {
			validationText.value = `${segment.method_label}日期超出销售周期`;
			return false;
		}
		if (diffDays(segment.start_date, segment.end_date) <= 0) {
			validationText.value = `${segment.method_label}结束日期必须大于等于开始日期`;
			return false;
		}
		if (Number(segment.final_qty) <= 0) {
			validationText.value = `${segment.method_label}最终数量必须大于0`;
			return false;
		}
	}
	if (segmentTotal.value > Number(form.final_purchase_qty)) {
		validationText.value = "运输分段合计不能大于采购单数量";
		return false;
	}
	if (segmentTotal.value < Number(form.final_purchase_qty)) {
		validationText.value = "运输分段合计需要等于采购单数量";
		return false;
	}
	return true;
}

function buildPayload() {
	const [cycleStartDate, cycleEndDate] = form.cycle_range;
	return {
		order_item_id: row.value?.order_item_id,
		listing_id: selectedListing.value?.id,
		snapshot_draft: {
			algorithm_key: form.algorithm_key,
			daily_avg_sales: form.daily_avg_sales,
			target_stock_days: form.target_stock_days,
			volatility_coefficient: form.volatility_coefficient,
			manual_coefficient: form.manual_coefficient,
			cycle_start_date: cycleStartDate,
			cycle_end_date: cycleEndDate,
			system_suggested_qty: form.system_suggested_qty,
			actual_purchase_qty_before_box: form.actual_purchase_qty_before_box,
			final_purchase_qty: form.final_purchase_qty,
			box_pcs: form.box_pcs || null,
			warehouse_wid: form.warehouse_wid || null,
			warehouse_name: form.warehouse_name,
			shipping_adjust_mode: form.shipping_adjust_mode,
			shipping_profile: {
				profile_key: form.shipping_profile_key,
				profile_label: form.shipping_profile_label,
				buffer_days: normalizeShippingBuffer(form.shipping_buffer_days),
				selected_methods: activeSegments.value.map((segment) => segment.method_key),
				inactive_methods: form.shipping_segments.filter((segment) => !segment.active).map((segment) => segment.method_key),
				methods: form.shipping_segments.map((segment) => ({
					key: segment.method_key,
					label: segment.method_label,
					days: segment.days_to_arrive,
					color: segment.color,
					icon: segment.icon,
					active: segment.active
				}))
			},
			manual_remark: form.manual_remark,
			inventory: { ...form.inventory },
			reconstruction_context: {
				confidence: prepareDefaults.value?.reconstruction_confidence || "manual_confirmed",
				sources: sourceRows.value,
				recommended_shipping_method: prepareDefaults.value?.recommended_shipping_method || "",
				recommended_shipping_reason: prepareDefaults.value?.recommended_shipping_reason || "",
				recommended_daily_avg_source: prepareDefaults.value?.recommended_daily_avg_source || ""
			},
			shipping_segments: form.shipping_segments.map((segment) => ({
				method_key: segment.method_key,
				method_label: segment.method_label,
				days_to_arrive: segment.days_to_arrive,
				active: segment.active,
				start_date: segment.start_date,
				end_date: segment.end_date,
				period_days: segment.period_days,
				system_suggested_qty: segment.system_suggested_qty,
				purchase_plan_deducted_qty: segment.purchase_plan_deducted_qty || 0,
				local_pending_delivery_deducted_qty: segment.local_pending_delivery_deducted_qty || 0,
				final_qty: segment.final_qty,
				coefficient: segment.coefficient,
				raw_coefficient: segment.raw_coefficient || segment.coefficient,
				adjusted_coefficient: segment.adjusted_coefficient || segment.coefficient,
				alpha_mode: segment.alpha_mode,
				manual_alpha: segment.manual_alpha,
				monthly_coefficients: segment.monthly_coefficients || null,
				source: segment.source || "",
				source_confidence: segment.source_confidence || "",
				help_text: segment.help_text || "",
				calculation_trace: segment.calculation_trace || null
			}))
		}
	};
}

async function submit() {
	if (!row.value) return;
	const valid = await validateForm();
	if (!valid) {
		if (!String(form.manual_remark || "").trim()) {
			const reminder = "请填写人工备注：历史补全原因、依据、确认说明";
			ElMessage.warning(reminder);
			await focusManualRemark(reminder);
		}
		return;
	}
	const payload = buildPayload();
	const listingText = [selectedListing.value?.asin, selectedListing.value?.msku, selectedListing.value?.local_sku].filter(Boolean).join(" / ");

	try {
		await ElMessageBox.confirm(
			`采购单 ${row.value.order_sn}，计划 ${row.value.plan_sn}，店铺商品 ${listingText || selectedListing.value?.id}，最终采购 ${form.final_purchase_qty}，运输分段合计 ${segmentTotal.value}。`,
			"确认补全",
			{
				type: "warning",
				confirmButtonText: "确认补全",
				cancelButtonText: "取消"
			}
		);
		submitting.value = true;
		await manualLinkService.value.complete(payload);
		ElMessage.success("补全成功");
		emit("completed");
		dialogVisible.value = false;
	} catch (error: any) {
		if (error !== "cancel") {
			ElMessage.error(error?.message || "补全失败");
		}
	} finally {
		submitting.value = false;
	}
}

function makeCheckField(key: string, label: string, value: any, options: { wide?: boolean; copyable?: boolean } = {}) {
	return {
		key,
		label,
		rawValue: value,
		valueText: formatFieldValue(value),
		wide: Boolean(options.wide),
		copyable: options.copyable !== false
	};
}

function makeEvidenceRow(key: string, label: string, leftLabel: string, leftValue: any, rightLabel: string, rightValue: any) {
	const leftTokens = normalizeCompareTokens(leftValue);
	const rightTokens = normalizeCompareTokens(rightValue);
	const leftText = formatEvidenceValue(leftValue);
	const rightText = formatEvidenceValue(rightValue);
	const missing = leftTokens.length === 0 || rightTokens.length === 0;
	const matched = !missing && leftTokens.some((item) => rightTokens.includes(item));
	const tagType = missing ? "info" : matched ? "success" : "warning";

	return {
		key,
		label,
		leftLabel,
		rightLabel,
		leftText,
		rightText,
		tagType,
		tone: missing ? "missing" : matched ? "matched" : "mismatch",
		statusText: missing ? "缺字段" : matched ? "匹配" : "需核对"
	};
}

function copyVerificationInfo() {
	const current = row.value || {};
	const item = current.item || {};
	const order = current.purchase_order || {};
	const plan = current.purchase_plan || {};
	const lines = [
		`采购单号: ${formatFieldValue(current.order_sn || order.order_sn)}`,
		`计划号: ${formatFieldValue(current.plan_sn || plan.plan_sn)}`,
		`批次号: ${formatFieldValue(plan.ppg_sn)}`,
		`采购状态: ${formatFieldValue(order.status_text || order.status)}`,
		`到货状态: ${formatFieldValue(order.arrival_status_text || order.arrival_status)}`,
		`产品名: ${formatFieldValue(item.product_name || plan.product_name)}`,
		`明细SKU: ${formatFieldValue(item.sku)}`,
		`首个MSKU: ${formatFieldValue(item.first_msku)}`,
		`计划本地SKU: ${formatFieldValue(plan.sku)}`,
		`计划MSKU: ${formatSkuList(plan.msku)}`,
		`店铺: ${formatFieldValue(plan.seller_name || item.plan_seller_name)}`,
		`国家: ${formatFieldValue(plan.marketplace || item.plan_marketplace)}`,
		`采购量: ${formatFieldValue(purchaseQuantity.value)}`,
		`待到货数量: ${formatFieldValue(purchasePendingArrivalQty.value)}`,
		`装箱数: ${formatFieldValue(purchaseBoxPcs.value)}`,
		`仓库: ${formatFieldValue(purchaseWarehouseName.value)}`
	];
	void copyText(lines.join("\n"), "校验信息已复制");
}

async function copyText(value: any, successMessage = "已复制") {
	const text = formatCopyValue(value);
	if (!text) return;
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
			document.execCommand("copy");
			document.body.removeChild(textarea);
		}
		ElMessage.success(successMessage);
	} catch (_error) {
		ElMessage.error("复制失败，请手动复制");
	}
}

function hasCopyValue(value: any) {
	if (Array.isArray(value)) return value.length > 0;
	return value !== undefined && value !== null && String(value) !== "" && String(value) !== "-";
}

function formatCopyValue(value: any) {
	if (Array.isArray(value)) return value.map((item) => formatCopyValue(item)).filter(Boolean).join(", ");
	if (value === undefined || value === null) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function formatFieldValue(value: any) {
	if (value === undefined || value === null || value === "") return "-";
	if (Array.isArray(value)) return value.length ? value.map((item) => formatFieldValue(item)).join(", ") : "-";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function formatSkuList(value: any) {
	const list = normalizeTokenList(value, false);
	return list.length ? list.join(", ") : "-";
}

function formatEvidenceValue(value: any) {
	const list = normalizeTokenList(value, false);
	return list.length ? list.join(", ") : "-";
}

function normalizeCompareTokens(value: any) {
	return normalizeTokenList(value, true);
}

function normalizeTokenList(value: any, lowerCase: boolean) {
	let list: any[] = [];
	if (Array.isArray(value)) {
		list = value;
	} else if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
			try {
				const parsed = JSON.parse(trimmed);
				list = Array.isArray(parsed) ? parsed : [value];
			} catch (_error) {
				list = [value];
			}
		} else if (trimmed.includes(",")) {
			list = trimmed.split(",");
		} else {
			list = [value];
		}
	} else if (value !== undefined && value !== null) {
		list = [value];
	}

	return list
		.map((item) => String(item).trim())
		.filter(Boolean)
		.map((item) => (lowerCase ? item.toLowerCase() : item));
}

function getFieldReference(key: string) {
	return fieldReferenceMap.value.get(key) || {};
}

function getReferenceValue(key: string, fallback: any = "-") {
	const reference = getFieldReference(key);
	if (reference?.value !== undefined && reference?.value !== null && reference?.value !== "") {
		return formatReferenceValue(reference.value);
	}
	return formatReferenceValue(fallback);
}

function getReferenceSource(key: string, fallback = "人工确认") {
	const reference = getFieldReference(key);
	return normalizeReferenceSource(reference?.source || getSourceLabel(key) || fallback);
}

function getReferenceSourceLine(key: string, fallbackSource = "人工填写") {
	const reference = getFieldReference(key);
	if (touchedFields[key]) {
		return "人工填写";
	}
	if (key === "box_pcs" && boxPcsLookupValue.value) {
		return "本地产品详情 · cg_box_pcs";
	}
	if (systemCalculatedFields[key]) {
		return "系统推算";
	}
	const source = normalizeReferenceSource(reference?.source_label || reference?.source || getSourceLabel(key) || fallbackSource);
	const fieldName = reference?.field_name ? ` · ${reference.field_name}` : "";
	return `${source}${fieldName}`;
}

function getReferenceSummaryLine(key: string, fallbackSource = "人工填写", fallbackValue: any = "-") {
	if (systemCalculatedFields[key] && key === "cycle_range") {
		return "来源：系统推算；参考：运输分段覆盖周期";
	}
	const referenceValue = getReferenceValue(key, fallbackValue);
	return `来源：${getReferenceSourceLine(key, fallbackSource)}；参考：${referenceValue}`;
}

function isReferenceRequired(key: string) {
	const reference = getFieldReference(key);
	return reference?.required !== false;
}

function fieldReferenceTooltip(key: string) {
	const reference = getFieldReference(key);
	const fallbackValue = getFieldReferenceFallbackValue(key);
	const finalValue = formatReferenceValue(getWriteFieldValue(key) ?? reference?.value ?? fallbackValue);
	const sourceLabel = key === "box_pcs" && boxPcsLookupValue.value && !touchedFields[key]
		? "本地产品详情"
		: systemCalculatedFields[key] && !touchedFields[key]
		? "系统推算"
		: normalizeReferenceSource(reference?.source_label || reference?.source || getSourceLabel(key) || "未标记");
	const tableField = getReferenceTableField(key, reference);
	const lines = [
		`${reference?.label || getFieldLabel(key)}取值详情`,
		"",
		`最终使用：${finalValue}`,
		`来源：${touchedFields[key] ? "人工填写" : sourceLabel}`,
		`字段：${tableField || "-"}`,
		`来源记录：${formatReferenceValue(reference?.source_record_id || "-")}`,
		`置信度：${formatConfidenceText(reference?.confidence)}`,
		`是否必填：${reference?.required === false ? "否" : "是"}`,
		`写入位置：${reference?.write_target || "-"}`
	];
	const traceLines = formatReferencePriorityTrace(reference?.priority_trace);
	if (traceLines.length) {
		lines.push("", "取值优先级：", ...traceLines);
	}
	if (key === "cycle_range" && systemCalculatedFields[key] && !touchedFields[key]) {
		lines.push("", "推算依据：", ...getCycleRangeCalculationLines());
	}
	if (touchedFields[key]) {
		lines.push("", `原系统参考：${formatReferenceValue(reference?.value ?? fallbackValue)}`);
	}
	if (reference?.help_text) lines.push(`说明：${reference.help_text}`);
	return lines.join("\n");
}

function getCycleRangeCalculationLines() {
	const active = activeSegments.value
		.filter((segment) => segment.start_date && segment.end_date)
		.sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
	if (!active.length) {
		return ["暂无启用运输分段，无法推算销售周期。"];
	}
	const first = active[0];
	const last = active[active.length - 1];
	return [
		`第一段 ${first.method_label} 覆盖开始：${first.start_date}`,
		`最后一段 ${last.method_label} 覆盖结束：${last.end_date}`,
		`销售周期 = ${first.start_date} ~ ${last.end_date}`,
	];
}

function getReferenceTableField(key: string, reference: any) {
	const explicit = [reference?.table_name, reference?.field_name].filter(Boolean).join(".");
	if (explicit) return explicit;
	const source = normalizeReferenceSource(reference?.source_label || reference?.source || "");
	if (source === "历史快照") return "app_amz_bsr_batch_replenish_snapshot";
	if (key === "box_pcs") return "app_amz_bsr_purchase_plan_lingxing.cg_box_pcs / app_amz_bsr_purchase_order_item_sync_lingxing.quantity_per_case";
	if (key === "warehouse") return "app_amz_bsr_purchase_plan_lingxing.wid / warehouse_name";
	if (["system_suggested_qty", "actual_purchase_qty_before_box", "final_purchase_qty"].includes(key)) {
		return "app_amz_bsr_purchase_order_item_sync_lingxing.quantity_plan / quantity_real";
	}
	if (["target_stock_days", "volatility_coefficient", "manual_coefficient", "algorithm_key", "shipping_buffer_days"].includes(key)) {
		return source === "系统默认" ? "系统默认配置" : "";
	}
	if (key === "cycle_range") return source === "人工填写" ? "人工填写" : "app_amz_bsr_batch_replenish_snapshot";
	return "";
}

function formatReferencePriorityTrace(trace: any) {
	if (!Array.isArray(trace)) return [];
	return trace.map((item: any) => {
		const mark = item?.used ? "✅" : "   ";
		const source = normalizeReferenceSource(item?.source_label || item?.source || "");
		const field = item?.field_name || "-";
		const value = formatReferenceValue(item?.value || item?.normalized_value || "-");
		return `${mark} ${source} ${field} = ${value}`;
	});
}

function getFieldLabel(key: string) {
	const labels: Record<string, string> = {
		algorithm_key: "算法",
		plan_start_date: "计划开始",
		shipping_buffer_days: "缓冲天数",
		cycle_range: "销售周期",
		daily_avg_sales: "日均销量",
		system_suggested_qty: "系统建议量",
		actual_purchase_qty_before_box: "装箱前采购量",
		final_purchase_qty: "最终采购量",
		target_stock_days: "目标库存天数",
		volatility_coefficient: "波动系数",
		manual_coefficient: "人工系数",
		box_pcs: "装箱数",
		warehouse: "采购仓库"
	};
	return labels[key] || key;
}

function getFieldReferenceFallbackValue(key: string) {
	const fallbackMap: Record<string, any> = {
		daily_avg_sales: form.daily_avg_sales,
		system_suggested_qty: form.system_suggested_qty,
		actual_purchase_qty_before_box: form.actual_purchase_qty_before_box,
		final_purchase_qty: form.final_purchase_qty,
		target_stock_days: form.target_stock_days,
		volatility_coefficient: form.volatility_coefficient,
		manual_coefficient: form.manual_coefficient,
		box_pcs: form.box_pcs,
		warehouse: recommendedWarehouseText.value,
		algorithm_key: currentAlgorithmLabel.value,
		plan_start_date: form.plan_start_date,
		shipping_buffer_days: form.shipping_buffer_days,
		cycle_range: Array.isArray(form.cycle_range) && form.cycle_range.length === 2 ? `${form.cycle_range[0]} ~ ${form.cycle_range[1]}` : ""
	};
	return fallbackMap[key] ?? "-";
}

function markFieldTouched(key: string) {
	touchedFields[key] = true;
	delete systemCalculatedFields[key];
}

function markFieldCalculated(key: string) {
	delete touchedFields[key];
	systemCalculatedFields[key] = true;
}

function getWriteFieldState(key: string) {
	if (key === "warehouse") return warehouseMatchState.value;
	if (key === "box_pcs" && !getWriteFieldValue(key)) {
		return { label: "可选", type: "info" as const, className: "state-optional" };
	}
	const valid = isWriteFieldValid(key);
	if (!valid) {
		return { label: "待填写", type: "danger" as const, className: "state-empty" };
	}
	if (touchedFields[key]) {
		return { label: "已填写", type: "success" as const, className: "state-filled" };
	}
	if (systemCalculatedFields[key]) {
		return { label: "系统推算", type: "success" as const, className: "state-calculated" };
	}
	return { label: "已带入", type: "primary" as const, className: "state-prefilled" };
}

function isWriteFieldValid(key: string) {
	const value = getWriteFieldValue(key);
	if (key === "cycle_range") {
		return Array.isArray(value) && value.length === 2 && Boolean(value[0]) && Boolean(value[1]);
	}
	if (key === "algorithm_key") return Boolean(value);
	if (key === "plan_start_date") return Boolean(normalizeDateOnly(value));
	if (key === "shipping_buffer_days") return Number(value) >= 0;
	if (key === "box_pcs") return value === undefined || value === null || value === "" || Number(value) > 0;
	if (key === "warehouse") return normalizeWarehouseWid(form.warehouse_wid) > 0;
	if (["daily_avg_sales", "system_suggested_qty", "actual_purchase_qty_before_box", "final_purchase_qty", "target_stock_days", "volatility_coefficient", "manual_coefficient"].includes(key)) {
		return Number(value) > 0;
	}
	return value !== undefined && value !== null && value !== "";
}

function getWriteFieldValue(key: string): any {
	const map: Record<string, any> = {
		algorithm_key: form.algorithm_key,
		cycle_range: form.cycle_range,
		daily_avg_sales: form.daily_avg_sales,
		system_suggested_qty: form.system_suggested_qty,
		actual_purchase_qty_before_box: form.actual_purchase_qty_before_box,
		final_purchase_qty: form.final_purchase_qty,
		target_stock_days: form.target_stock_days,
		volatility_coefficient: form.volatility_coefficient,
		manual_coefficient: form.manual_coefficient,
		box_pcs: form.box_pcs,
		warehouse: form.warehouse_wid,
		plan_start_date: form.plan_start_date,
		shipping_buffer_days: form.shipping_buffer_days
	};
	return map[key];
}

function isRecommendedWarehouse(warehouse: any) {
	const matched = matchedRecommendedWarehouse.value;
	if (!matched) return false;
	const matchedWid = normalizeWarehouseWid(matched.wid);
	const warehouseWid = normalizeWarehouseWid(warehouse?.wid);
	if (matchedWid && warehouseWid) return matchedWid === warehouseWid;
	return normalizeWarehouseName(matched.name) === normalizeWarehouseName(warehouse?.name);
}

function isSelectedWarehouse(warehouse: any) {
	const selectedWid = normalizeWarehouseWid(form.warehouse_wid);
	return selectedWid > 0 && selectedWid === normalizeWarehouseWid(warehouse?.wid);
}

function formatReferenceValue(value: any) {
	if (value === undefined || value === null || value === "") return "-";
	if (typeof value === "number") return formatNumber(value);
	if (Array.isArray(value)) return value.length ? value.join(" / ") : "-";
	return String(value);
}

function formatReferenceBrief(value: any) {
	const text = formatReferenceValue(value);
	return text === "-" ? "无参考" : text;
}

function formatConfidenceText(value: any) {
	if (value === "high") return "高";
	if (value === "medium") return "中";
	if (value === "low") return "低";
	if (value === "manual_required") return "需人工填写";
	return value || "-";
}

function normalizeReferenceSource(value: any) {
	const source = String(value || "").trim();
	if (!source) return "人工填写";
	if (source.includes("当前采购单")) return "采购单明细";
	if (source.includes("采购单主表")) return "采购单主表";
	if (source.includes("采购单明细")) return "采购单明细";
	if (source.includes("采购计划")) return "采购计划";
	if (source.includes("店铺商品")) return "店铺商品";
	if (source.includes("历史")) return "历史快照";
	if (source.includes("系统")) return "系统默认";
	if (source.includes("人工")) return "人工填写";
	return source;
}

function getSourceLabel(key: string) {
	const source = sourceRows.value.find((item: any) => item.key === key);
	return source?.source || "";
}

function getConfidenceLabel(value: string) {
	if (value === "history_snapshot") return "历史快照建议";
	if (value === "system_suggested") return "系统推测建议";
	if (value === "manual_required") return "需人工填写";
	return value ? "人工确认" : "-";
}

function diffDays(start: string, end: string) {
	if (!start || !end) return 0;
	const startDate = new Date(`${start}T00:00:00`);
	const endDate = new Date(`${end}T00:00:00`);
	const diff = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
	return Number.isFinite(diff) ? diff : 0;
}

function normalizeDateOnly(value: any) {
	if (!value) return "";
	if (value instanceof Date) return formatDateOnly(value);
	const text = String(value).trim();
	const match = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
	if (match) {
		return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
	}
	const date = new Date(text);
	return Number.isNaN(date.getTime()) ? "" : formatDateOnly(date);
}

function formatDateOnly(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function addDateDays(value: string, days: number) {
	const date = parseDateOnly(value);
	if (!date) return "";
	date.setDate(date.getDate() + Math.round(Number(days) || 0));
	return formatDateOnly(date);
}

function parseDateOnly(value: any) {
	const dateOnly = normalizeDateOnly(value);
	if (!dateOnly) return null;
	const [year, month, day] = dateOnly.split("-").map((item) => Number(item));
	const date = new Date(year, month - 1, day);
	return Number.isNaN(date.getTime()) ? null : date;
}

function maxDateOnly(a: string, b: string) {
	if (!a) return b;
	if (!b) return a;
	return a > b ? a : b;
}

function minDateOnly(a: string, b: string) {
	if (!a) return b;
	if (!b) return a;
	return a < b ? a : b;
}

function getDefaultShippingBaseDate() {
	const order = row.value?.purchase_order || {};
	const item = row.value?.item || {};
	const plan = row.value?.purchase_plan || {};
	return (
		normalizeDateOnly(plan.create_time_remote) ||
		normalizeDateOnly(plan.create_time) ||
		normalizeDateOnly(item.plan_create_time) ||
		normalizeDateOnly(order.order_time) ||
		normalizeDateOnly(order.create_time_remote) ||
		formatDateOnly(new Date())
	);
}

function formatDateTime(value: any) {
	if (!value) return "-";
	if (value instanceof Date) {
		return value.toISOString().replace("T", " ").slice(0, 19);
	}
	return String(value).replace("T", " ").slice(0, 19);
}

function getProductImage(current: any) {
	return current?.purchase_plan?.pic_url || current?.item?.plan_pic_url || "";
}

function getListingInboundQty(item: any) {
	return (
		(Number(item?.afn_inbound_working_quantity) || 0) +
		(Number(item?.afn_inbound_shipped_quantity) || 0) +
		(Number(item?.afn_inbound_receiving_quantity) || 0)
	);
}

function getListingReservedQty(item: any) {
	return (
		(Number(item?.reserved_customerorders) || 0) +
		(Number(item?.reserved_fc_processing) || 0) +
		(Number(item?.reserved_fc_transfers) || 0)
	);
}

function getListingDailyAvg(item: any) {
	return (
		Number(item?.average_thirty_volume) ||
		Number(item?.average_fourteen_volume) ||
		Number(item?.average_seven_volume) ||
		0
	);
}

function getListingShop(item: any) {
	return formatFieldValue(getListingShopValue(item));
}

function getListingMarketplace(item: any) {
	return formatFieldValue(getListingMarketplaceValue(item));
}

function getListingShopValue(item: any) {
	const marketplace = getListingMarketplaceValue(item);
	let value = String(item?.shop || item?.seller_name || item?.store_name || "").trim();
	if (!value) return undefined;
	if (marketplace) {
		value = value.replace(new RegExp(`[\\s/|,，-]*${escapeRegExp(String(marketplace))}$`), "").trim();
	}
	for (const suffix of ["英国", "美国", "加拿大", "德国", "法国", "日本", "意大利", "西班牙", "澳大利亚", "墨西哥"]) {
		value = value.replace(new RegExp(`[\\s/|,，-]*${suffix}$`), "").trim();
	}
	return value || undefined;
}

function getListingMarketplaceValue(item: any) {
	const value = item?.marketplace || item?.country || item?.site;
	return value === undefined || value === null || value === "" ? undefined : String(value).trim();
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWarehouseWid(value: any) {
	const num = Number(value);
	return Number.isFinite(num) && num > 0 ? num : 0;
}

function normalizeWarehouseName(value: any) {
	return String(value ?? "")
		.trim()
		.replace(/\s+/g, "")
		.toLowerCase();
}

function getSegmentRange(segment: ShippingSegmentForm) {
	return segment.start_date && segment.end_date ? [segment.start_date, segment.end_date] : [];
}

function getSegmentArrivalDate(segment: ShippingSegmentForm) {
	const baseDate = normalizeDateOnly(shippingBaseDate.value);
	if (!baseDate) return "";
	return addDateDays(baseDate, normalizeShippingBuffer(form.shipping_buffer_days) + (Number(segment.days_to_arrive) || 0));
}

function getSegmentIcon(segment: ShippingSegmentForm) {
	const fallbackMap: Record<string, string> = {
		express: "🚚",
		air: "✈️",
		air_slow: "✈️",
		truck: "🚛",
		rail: "🚂",
		sea: "🚢"
	};
	return segment.icon || fallbackMap[segment.method_key] || "🚚";
}

function getSegmentTrace(segment: ShippingSegmentForm) {
	return segment.calculation_trace || {};
}

function getSegmentTraceValue(segment: ShippingSegmentForm, key: string) {
	const trace = getSegmentTrace(segment);
	return trace?.[key];
}

function getSegmentCoverageText(segment: ShippingSegmentForm) {
	const trace = getSegmentTrace(segment);
	const start = trace.coverage_start_date || segment.start_date || "";
	const end = trace.coverage_end_date || segment.end_date || "";
	return start && end ? `${start} ~ ${end}` : "-";
}

function getSegmentShortRange(segment: ShippingSegmentForm) {
	const trace = getSegmentTrace(segment);
	const start = trace.coverage_start_date || segment.start_date || "";
	const end = trace.coverage_end_date || segment.end_date || "";
	if (!start || !end) return "-";
	return `${formatShortDate(start)}~${formatShortDate(end)}`;
}

function formatShortDate(value: string) {
	const dateOnly = normalizeDateOnly(value);
	if (!dateOnly) return "-";
	const [, month, day] = dateOnly.split("-");
	return `${Number(month)}/${Number(day)}`;
}

function getSegmentSuggestedQty(segment: ShippingSegmentForm) {
	return Number(getSegmentTraceValue(segment, "suggested_qty")) || Number(segment.system_suggested_qty) || 0;
}

function setSegmentRange(segment: ShippingSegmentForm, value: string[] | null) {
	segment.start_date = Array.isArray(value) ? value[0] || "" : "";
	segment.end_date = Array.isArray(value) ? value[1] || "" : "";
	refreshSegmentDays();
}

function getSegmentStatusLabel(segment: ShippingSegmentForm) {
	if (!segment.active) {
		if (segment.allocation_status === "inactive_preference") return "偏好关闭";
		if (segment.allocation_status === "no_coverage") return "未覆盖";
		if (segment.allocation_status === "no_quantity") return "数量为0";
		return segment.recommended ? "推荐未分配" : "未启用";
	}
	if (segment.allocation_status === "history_snapshot_scaled") return "历史折算";
	if (segment.allocation_status === "history_snapshot") return "历史快照";
	if (segment.allocation_status === "coverage_calculated") return "已推算";
	if (segment.allocation_status === "manual_assigned" || segment.source === "人工填写") return "人工改过";
	if (segment.allocation_status === "manual_required") return "待确认";
	return "已填写";
}

function getSegmentStatusType(segment: ShippingSegmentForm) {
	if (!segment.active) return segment.allocation_status === "inactive_preference" ? "warning" : segment.recommended ? "warning" : "info";
	if (segment.allocation_status === "history_snapshot" || segment.allocation_status === "history_snapshot_scaled") return "success";
	if (segment.allocation_status === "coverage_calculated") return "success";
	if (segment.allocation_status === "manual_required") return "warning";
	return "success";
}

function getSegmentTooltip(segment: ShippingSegmentForm) {
	const traceLines = Array.isArray(segment.calculation_trace?.lines) ? segment.calculation_trace.lines.filter(Boolean) : [];
	if (traceLines.length) {
		return [
			`${segment.method_label}推算详情`,
			"",
			...traceLines,
			"",
			`参考来源：${segment.source || "无"}`,
			`置信度：${formatConfidenceText(segment.source_confidence)}`
		].join("\n");
	}
	const lines = [
		`方式：${segment.method_label}`,
		`参考来源：${segment.source || "无"}`,
		`置信度：${formatConfidenceText(segment.source_confidence)}`,
		`缓冲天数：${normalizeShippingBuffer(form.shipping_buffer_days)} 天`,
		`运输时效：${segment.days_to_arrive || 0} 天`,
		`预计到达：${getSegmentArrivalDate(segment) || "无基准日"}`,
		`参考数量：${formatNumber(segment.system_suggested_qty)}`
	];
	if (segment.scaled_from_qty) lines.push(`历史原数量：${formatNumber(segment.scaled_from_qty)}`);
	if (segment.help_text) lines.push(`说明：${segment.help_text}`);
	return lines.join("\n");
}

function firstFiniteNumber(...values: any[]) {
	for (const value of values) {
		if (value === null || value === undefined || value === "") continue;
		const num = Number(value);
		if (Number.isFinite(num)) return num;
	}
	return undefined;
}

function formatNumber(value: any) {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
}
</script>

<style lang="scss" scoped>
.manual-link-dialog :deep(.el-dialog) {
	max-height: calc(100vh - 48px);
	display: flex;
	flex-direction: column;
}

.manual-link-dialog :deep(.el-dialog__header) {
	padding: 14px 18px 10px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.manual-link-dialog :deep(.el-dialog__body) {
	flex: 1;
	min-height: 0;
	padding: 0;
	background: var(--el-bg-color-page);
	overflow: hidden;
}

.manual-link-dialog :deep(.el-dialog__footer) {
	padding: 10px 16px;
	border-top: 1px solid var(--el-border-color-lighter);
	background: #fff;
}

.dialog-header,
.dialog-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	min-width: 0;
}

.dialog-title {
	color: var(--el-text-color-primary);
	font-size: 18px;
	font-weight: 800;
	line-height: 24px;
}

.dialog-subtitle {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 4px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.header-tags,
.footer-actions,
.panel-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}

.submit-tooltip-wrap {
	display: inline-flex;
}

.dialog-shell {
	display: flex;
	flex-direction: column;
	gap: 12px;
	height: calc(100vh - 154px);
	padding: 12px 14px 14px;
	box-sizing: border-box;
	overflow: hidden;
}

.step-strip {
	display: grid;
	grid-template-columns: minmax(190px, auto) 88px minmax(210px, auto);
	align-items: center;
	gap: 10px;
	width: min(720px, 100%);
	margin: 0 auto;
	padding: 10px 12px;
	box-sizing: border-box;
	border: 1px solid var(--el-border-color-light);
	border-radius: 6px;
	background: #fff;
	box-shadow: 0 1px 2px rgb(31 45 61 / 4%);
}

.step-node {
	display: flex;
	align-items: center;
	gap: 9px;
	min-width: 0;
	color: var(--el-text-color-secondary);
}

.step-node span {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 26px;
	width: 26px;
	height: 26px;
	border: 1px solid var(--el-border-color);
	border-radius: 50%;
	background: var(--el-fill-color-light);
	font-size: 13px;
	font-weight: 800;
}

.step-node strong,
.step-node em {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.step-node strong {
	color: var(--el-text-color-primary);
	font-size: 13px;
}

.step-node em {
	margin-top: 1px;
	font-size: 12px;
	font-style: normal;
}

.step-node.active span {
	border-color: var(--el-color-primary);
	background: var(--el-color-primary);
	color: #fff;
}

.step-line {
	height: 2px;
	border-radius: 2px;
	background: var(--el-border-color-lighter);
}

.step-line.active {
	background: var(--el-color-primary-light-5);
}

.dialog-body {
	display: grid;
	grid-template-columns: 286px minmax(0, 1fr);
	gap: 10px;
	flex: 1;
	min-height: 0;
	box-sizing: border-box;
	overflow: hidden;
}

.dialog-body.select-mode {
	grid-template-columns: minmax(0, 1fr);
}

.dialog-body.history-mode {
	grid-template-columns: minmax(0, 1fr);
}

.side-pane,
.main-pane {
	min-height: 0;
	overflow: auto;
}

.select-review-layout {
	display: grid;
	grid-template-columns: 410px minmax(0, 1fr);
	grid-template-rows: auto minmax(0, 1fr);
	gap: 12px;
	min-height: 0;
	overflow: hidden;
}

.relation-summary {
	display: grid;
	grid-column: 1 / -1;
	grid-template-columns: minmax(0, 1fr) 210px minmax(0, 1fr);
	align-items: center;
	gap: 12px;
	padding: 10px 12px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 8px;
	background: #fff;
	box-shadow: 0 1px 2px rgb(31 45 61 / 4%);
}

.relation-end {
	min-width: 0;
	padding: 8px 10px;
	border-radius: 6px;
	background: var(--el-fill-color-light);
}

.relation-end.source {
	border-left: 3px solid var(--el-color-primary);
}

.relation-end.target {
	border-left: 3px solid var(--el-color-success);
}

.relation-end.empty {
	border-left-color: var(--el-color-warning);
	background: var(--el-color-warning-light-9);
}

.relation-end span,
.relation-end strong,
.relation-end em {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.relation-end span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.relation-end strong {
	margin-top: 2px;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 800;
}

.relation-end em {
	margin-top: 2px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	font-style: normal;
}

.relation-center {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	text-align: center;
}

.relation-center::before,
.relation-center::after {
	content: "";
	display: block;
	width: 100%;
	height: 1px;
	background: var(--el-border-color-lighter);
}

.review-panel {
	min-height: 0;
	overflow: auto;
	border: 1px solid var(--el-border-color-light);
	border-radius: 8px;
	background: #fff;
	box-shadow: 0 1px 2px rgb(31 45 61 / 4%);
}

.purchase-review-panel {
	border-top: 3px solid var(--el-color-primary);
}

.product-review-panel {
	display: flex;
	flex-direction: column;
	border-top: 3px solid var(--el-color-success);
}

.review-panel-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 12px 14px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.review-panel-head.compact {
	padding-bottom: 8px;
	border-bottom: 0;
}

.review-title {
	color: var(--el-text-color-primary);
	font-size: 15px;
	font-weight: 900;
	line-height: 20px;
}

.review-subtitle {
	margin-top: 2px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 17px;
}

.source-hero-card {
	display: flex;
	gap: 12px;
	padding: 12px 14px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	background: linear-gradient(180deg, #fbfdff 0%, #fff 100%);
}

.source-hero-main {
	min-width: 0;
	flex: 1;
}

.source-code-row {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	margin-top: 6px;
}

.match-field-panel {
	display: grid;
	gap: 6px;
	margin-top: 8px;
}

.source-match-fields {
	grid-template-columns: repeat(2, minmax(0, 1fr));
}

.listing-match-fields {
	grid-template-columns: repeat(5, minmax(0, 1fr));
}

.match-field-panel div {
	min-width: 0;
	padding: 6px 7px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 5px;
	background: #fff;
}

.current-product-card .match-field-panel div {
	background: rgb(255 255 255 / 72%);
}

.match-field-panel span,
.match-field-panel b {
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.match-field-panel span {
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 14px;
}

.match-field-panel b {
	margin-top: 2px;
	color: var(--el-text-color-primary);
	font-size: 12px;
	font-weight: 700;
	line-height: 16px;
}

.source-mini-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 6px;
	margin-top: 10px;
}

.source-mini-grid div,
.current-product-metrics div,
.candidate-metrics div {
	min-width: 0;
	padding: 6px 8px;
	border-radius: 5px;
	background: var(--el-fill-color-light);
}

.source-mini-grid span,
.current-product-metrics span,
.candidate-metrics span {
	display: block;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 15px;
}

.source-mini-grid b,
.current-product-metrics b,
.candidate-metrics b {
	display: block;
	overflow: hidden;
	margin-top: 1px;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-primary);
	font-size: 13px;
}

.verification-collapse {
	border-top: 0;
	border-bottom: 0;
}

.verification-collapse :deep(.el-collapse-item__header) {
	height: 42px;
	padding: 0 14px;
	border-bottom-color: var(--el-border-color-lighter);
	background: #fff;
}

.verification-collapse :deep(.el-collapse-item__wrap) {
	border-bottom-color: var(--el-border-color-lighter);
}

.verification-collapse :deep(.el-collapse-item:last-child .el-collapse-item__wrap) {
	border-bottom: 0;
}

.verification-collapse :deep(.el-collapse-item__content) {
	padding: 10px 14px 12px;
}

.verification-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	width: 100%;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 800;
}

.verification-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 7px;
}

.verification-cell {
	position: relative;
	min-width: 0;
	padding: 7px 28px 7px 8px;
	border: 1px solid transparent;
	border-radius: 6px;
	background: #f7f8fa;
	box-sizing: border-box;
}

.verification-cell.wide {
	grid-column: 1 / -1;
}

.verification-cell span,
.verification-cell strong {
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.verification-cell span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 15px;
}

.verification-cell strong {
	margin-top: 2px;
	color: var(--el-text-color-primary);
	font-size: 12px;
	font-weight: 700;
	line-height: 16px;
}

.verification-cell :deep(.el-button) {
	position: absolute;
	top: 50%;
	right: 4px;
	width: 22px;
	height: 22px;
	min-height: 22px;
	padding: 0;
	transform: translateY(-50%);
	color: var(--el-text-color-placeholder);
}

.verification-cell:hover {
	border-color: var(--el-border-color);
	background: #fff;
}

.verification-cell:hover :deep(.el-button) {
	color: var(--el-color-primary);
}

.current-product-section,
.search-product-section {
	padding: 0 14px 12px;
}

.current-product-section {
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.current-product-section > .review-panel-head,
.search-product-section > .review-panel-head {
	margin: 0 -14px;
}

.current-product-card {
	position: relative;
	display: grid;
	grid-template-areas:
		"thumb info"
		"metrics metrics";
	grid-template-columns: 80px minmax(0, 1fr);
	gap: 10px 12px;
	align-items: start;
	padding: 12px 42px 12px 12px;
	border: 1px solid var(--el-color-primary-light-5);
	border-radius: 8px;
	background: #f7faff;
}

.current-product-card.suggested {
	border-color: var(--el-color-warning-light-5);
	background: #fffaf3;
}

.current-product-main {
	grid-area: info;
	min-width: 0;
}

.current-product-card > .listing-thumb {
	grid-area: thumb;
}

.current-product-metrics {
	grid-area: metrics;
	display: grid;
	grid-template-columns: repeat(4, minmax(92px, 1fr));
	gap: 7px;
}

.current-clear {
	position: absolute;
	top: 6px;
	right: 8px;
}

.compact-empty-product {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 12px;
	border: 1px dashed var(--el-color-warning-light-5);
	border-radius: 8px;
	background: var(--el-color-warning-light-9);
	color: var(--el-color-warning);
}

.compact-empty-product strong,
.compact-empty-product span {
	display: block;
}

.compact-empty-product strong {
	color: var(--el-text-color-primary);
	font-size: 13px;
	line-height: 18px;
}

.compact-empty-product span {
	margin-top: 2px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 17px;
}

.match-evidence.refined {
	margin-top: 12px;
	padding-top: 0;
	border-top: 0;
}

.listing-search.refined {
	display: grid;
	grid-template-columns: minmax(260px, 1fr) 150px 120px 36px;
	gap: 8px;
	margin-top: 0;
}

.candidate-list.compact {
	display: flex;
	flex-direction: column;
	gap: 7px;
	max-height: 245px;
	margin-top: 10px;
	overflow: auto;
}

.candidate-row {
	position: relative;
	display: grid;
	grid-template-columns: 48px minmax(0, 1fr) 228px;
	align-items: center;
	gap: 10px;
	width: 100%;
	padding: 8px 34px 8px 8px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 7px;
	background: #fff;
	cursor: pointer;
	text-align: left;
}

.candidate-row:hover,
.candidate-row.selected {
	border-color: var(--el-color-primary-light-5);
	background: var(--el-color-primary-light-9);
}

.candidate-row.selected {
	border-color: var(--el-color-primary);
	box-shadow: inset 0 0 0 1px var(--el-color-primary-light-5);
}

.candidate-main {
	min-width: 0;
}

.candidate-metrics {
	display: grid;
	grid-template-columns: repeat(3, minmax(58px, 1fr));
	gap: 6px;
}

.search-empty {
	margin-top: 0;
	border-color: var(--el-border-color);
	background: var(--el-fill-color-light);
	color: var(--el-text-color-secondary);
}

.side-pane {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.source-pane,
.target-pane {
	position: relative;
}

.side-section,
.selection-card,
.metric-strip,
.calc-panel,
.shipping-panel,
.inventory-panel,
.adjust-panel,
.preview-panel {
	border: 1px solid var(--el-border-color-light);
	border-radius: 6px;
	background: #fff;
}

.side-section {
	padding: 10px;
}

.selection-card {
	padding: 12px;
}

.column-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 10px 12px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 6px;
	background: #fff;
	box-shadow: 0 1px 2px rgb(31 45 61 / 4%);
}

.column-header span,
.column-header em {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.column-header span {
	color: var(--el-text-color-primary);
	font-size: 15px;
	font-weight: 900;
	line-height: 20px;
}

.column-header em {
	margin-top: 2px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	font-style: normal;
}

.source-header {
	border-left: 4px solid #5470c6;
	background: linear-gradient(90deg, #f5f8ff 0%, #fff 58%);
}

.source-product-card,
.source-pane .check-section {
	border-left: 3px solid #d6e2ff;
}

.side-section-title,
.panel-head,
.preview-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 10px;
}

.side-section-title.compact {
	margin-bottom: 8px;
}

.side-section-title span:first-child,
.panel-title {
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 800;
}

.panel-desc {
	margin-top: 2px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.current-selection-card {
	border-left: 4px solid #67c23a;
	background: linear-gradient(90deg, #fbfffb 0%, #fff 44%);
}

.current-selection-card .panel-title {
	font-size: 15px;
	font-weight: 900;
}

.target-pane .selection-card:not(.current-selection-card) {
	border-left: 3px solid #dcebdd;
}

.product-brief,
.selected-listing,
.selected-product-banner,
.recommend-main,
.current-listing-main,
.listing-result {
	display: flex;
	gap: 9px;
	min-width: 0;
}

.product-thumb,
.listing-thumb {
	display: flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 68px;
	width: 68px;
	height: 68px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 5px;
	background: var(--el-fill-color-light);
	overflow: hidden;
}

.listing-thumb.small {
	flex-basis: 42px;
	width: 42px;
	height: 42px;
}

.listing-thumb.large {
	flex-basis: 76px;
	width: 76px;
	height: 76px;
}

.thumb-img,
.listing-img {
	width: 100%;
	height: 100%;
}

.product-text,
.listing-info {
	min-width: 0;
	flex: 1;
}

.product-name,
.listing-title {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 700;
	line-height: 18px;
}

.product-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	margin-top: 6px;
}

.side-facts {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 6px;
	margin-top: 10px;
}

.side-facts div,
.preview-grid div {
	min-width: 0;
	padding: 7px 8px;
	border-radius: 5px;
	background: var(--el-fill-color-light);
}

.side-facts span,
.preview-grid span,
.metric-label {
	display: block;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 16px;
}

.side-facts b,
.preview-grid b {
	display: block;
	overflow: hidden;
	margin-top: 2px;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-primary);
	font-size: 13px;
}

.check-section {
	padding: 9px 10px;
}

.check-rows {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 6px;
}

.check-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: center;
	min-width: 0;
	padding: 6px 7px;
	border: 1px solid transparent;
	border-radius: 5px;
	background: var(--el-fill-color-light);
	box-sizing: border-box;
}

.check-row.wide {
	grid-column: 1 / -1;
}

.check-row span,
.check-row strong {
	grid-column: 1;
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.check-row span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 15px;
}

.check-row strong {
	margin-top: 2px;
	color: var(--el-text-color-primary);
	font-size: 12px;
	font-weight: 700;
	line-height: 16px;
}

.check-row :deep(.el-button) {
	grid-row: 1 / span 2;
	grid-column: 2;
	width: 22px;
	height: 22px;
	min-height: 22px;
	padding: 0;
	color: var(--el-text-color-placeholder);
}

.check-row:hover {
	border-color: var(--el-border-color);
	background: #fff;
}

.check-row:hover :deep(.el-button) {
	color: var(--el-color-primary);
}

.listing-empty {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px;
	border: 1px dashed var(--el-color-warning-light-5);
	border-radius: 5px;
	color: var(--el-color-warning);
	background: var(--el-color-warning-light-9);
	font-size: 12px;
}

.listing-search {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 34px;
	gap: 6px;
	margin-top: 10px;
}

.listing-search.wide {
	grid-template-columns: minmax(220px, 1fr) 150px 130px 36px;
}

.listing-result-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
	max-height: 260px;
	margin-top: 10px;
	overflow: auto;
}

.listing-result-list.wide {
	max-height: 360px;
}

.listing-result {
	position: relative;
	width: 100%;
	padding: 7px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 5px;
	background: #fff;
	cursor: pointer;
	text-align: left;
}

.recommend-card,
.selected-product-banner,
.current-listing-card {
	position: relative;
	width: 100%;
	padding: 10px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 6px;
	background: #fff;
	box-sizing: border-box;
}

.current-listing-card {
	border-color: var(--el-color-primary-light-5);
	background: #f7faff;
}

.current-listing-card.suggested {
	border-color: var(--el-color-warning-light-5);
	background: #fffaf2;
}

.current-listing-main {
	align-items: flex-start;
}

.current-listing-main :deep(.el-button) {
	flex: 0 0 auto;
}

.recommend-card {
	cursor: pointer;
	text-align: left;
}

.selected-product-banner {
	display: flex;
	align-items: center;
	margin-bottom: 10px;
	background: var(--el-color-success-light-9);
}

.recommend-card:hover,
.recommend-card.selected,
.listing-result:hover,
.listing-result.selected {
	border-color: var(--el-color-primary-light-5);
	background: var(--el-color-primary-light-9);
}

.recommend-card.selected,
.listing-result.selected {
	border-color: var(--el-color-primary);
	box-shadow: 0 0 0 1px var(--el-color-primary-light-5);
}

.selection-status-row {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-top: 8px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 18px;
}

.selection-status-row span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.listing-lines {
	display: flex;
	flex-direction: column;
	gap: 2px;
	margin-top: 5px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 16px;
}

.listing-lines.inline {
	display: grid;
	grid-template-columns: repeat(5, minmax(110px, 1fr));
	gap: 4px 10px;
}

.listing-lines.inline span,
.listing-lines.compact span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.listing-lines b {
	margin-right: 4px;
	color: var(--el-text-color-placeholder);
	font-weight: 600;
}

.listing-lines.compact span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.result-metrics {
	display: grid;
	grid-template-columns: repeat(4, minmax(84px, 1fr));
	gap: 6px;
	margin-top: 10px;
}

.result-metrics.compact {
	grid-template-columns: repeat(3, minmax(62px, 1fr));
	flex: 0 0 210px;
	margin-top: 0;
}

.result-metrics div {
	min-width: 0;
	padding: 6px 7px;
	border-radius: 5px;
	background: var(--el-fill-color-light);
}

.result-metrics span {
	display: block;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 15px;
}

.result-metrics b {
	display: block;
	overflow: hidden;
	margin-top: 1px;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-primary);
	font-size: 13px;
}

.listing-result-list.wide .listing-result {
	display: grid;
	grid-template-columns: 48px minmax(0, 1fr) 210px;
	align-items: center;
}

.match-evidence {
	margin-top: 10px;
	padding-top: 10px;
	border-top: 1px solid var(--el-border-color-lighter);
}

.evidence-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 8px;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 800;
}

.evidence-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 6px;
}

.evidence-table {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	overflow: hidden;
	background: #fff;
}

.evidence-table-head,
.evidence-table-row {
	display: grid;
	grid-template-columns: minmax(86px, 0.52fr) minmax(0, 1fr) minmax(0, 1fr) 72px;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.evidence-table-head {
	padding: 7px 9px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-secondary);
	font-size: 12px;
	font-weight: 700;
}

.evidence-table-row {
	padding: 7px 9px;
	border-top: 1px solid var(--el-border-color-lighter);
}

.evidence-table-row.matched {
	background: var(--el-color-success-light-9);
}

.evidence-table-row.mismatch {
	background: var(--el-color-warning-light-9);
}

.evidence-table-row.missing {
	background: #fafafa;
}

.evidence-table-row > span,
.evidence-table-head span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.evidence-table-row > span {
	color: var(--el-text-color-primary);
	font-size: 12px;
}

.evidence-row {
	display: grid;
	grid-template-columns: minmax(86px, 0.46fr) minmax(0, 1fr) auto;
	align-items: center;
	gap: 8px;
	min-width: 0;
	padding: 7px 8px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 5px;
	background: #fff;
}

.evidence-row.matched {
	border-color: var(--el-color-success-light-7);
	background: var(--el-color-success-light-9);
}

.evidence-row.mismatch {
	border-color: var(--el-color-warning-light-6);
	background: var(--el-color-warning-light-9);
}

.evidence-row.missing {
	background: var(--el-fill-color-light);
}

.evidence-label {
	overflow: hidden;
	color: var(--el-text-color-primary);
	font-size: 12px;
	font-weight: 800;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.evidence-values {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 4px;
	min-width: 0;
}

.evidence-values span,
.evidence-values b {
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.evidence-values span {
	color: var(--el-text-color-primary);
	font-size: 12px;
}

.evidence-values b {
	color: var(--el-text-color-secondary);
	font-size: 11px;
	font-weight: 600;
}

.check-icon {
	position: absolute;
	right: 8px;
	top: 8px;
	color: var(--el-color-primary);
}

.main-pane {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.select-product-pane,
.history-pane {
	min-width: 0;
}

.history-pane {
	gap: 10px;
	padding-bottom: 4px;
}

.history-section {
	border: 1px solid var(--el-border-color-light);
	border-radius: 8px;
	background: #fff;
	box-shadow: 0 1px 2px rgb(31 45 61 / 4%);
	box-sizing: border-box;
}

.history-section-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 14px 10px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.section-title {
	color: var(--el-text-color-primary);
	font-size: 14px;
	font-weight: 900;
	line-height: 20px;
}

.section-desc {
	margin-top: 2px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 17px;
}

.source-badge {
	display: inline-flex;
	align-items: center;
	width: fit-content;
	max-width: 100%;
	height: 20px;
	padding: 0 6px;
	border: 1px solid var(--el-border-color);
	border-radius: 4px;
	background: #fff;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	font-style: normal;
	font-weight: 700;
	line-height: 18px;
	white-space: nowrap;
}

.document-context-panel {
	border-top: 3px solid #5f7896;
}

.compact-context-panel {
	border-top: 3px solid #5f7896;
}

.compact-overview-panel {
	border-top-color: var(--el-color-primary);
}

.compact-context-head,
.history-section-head.compact-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 14px 8px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.compact-overview-panel .compact-context-head {
	padding: 8px 12px 7px;
}

.overview-relation-strip {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 28px minmax(0, 1fr);
	align-items: center;
	gap: 8px;
	padding: 6px 12px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	background: #fbfcff;
}

.overview-product {
	display: grid;
	grid-template-areas:
		"label meta"
		"title title";
	grid-template-columns: auto minmax(0, 1fr);
	align-items: center;
	gap: 1px 8px;
	min-width: 0;
	padding: 5px 8px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: #fff;
}

.overview-product.is-listing {
	border-color: var(--el-color-primary-light-7);
	background: var(--el-color-primary-light-9);
}

.overview-product span,
.overview-product strong,
.overview-product em {
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.overview-product span {
	grid-area: label;
	width: fit-content;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 14px;
}

.overview-product strong {
	grid-area: title;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 900;
	line-height: 16px;
}

.overview-product em {
	grid-area: meta;
	text-align: right;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	font-style: normal;
	line-height: 14px;
}

.overview-arrow {
	color: var(--el-color-primary);
	font-size: 16px;
	font-weight: 900;
	text-align: center;
}

.overview-summary-grid {
	display: grid;
	grid-template-columns: minmax(120px, 0.8fr) minmax(120px, 0.8fr) minmax(92px, 0.58fr) minmax(118px, 0.75fr) minmax(86px, 0.52fr) minmax(86px, 0.52fr) minmax(108px, 0.68fr) minmax(92px, 0.56fr) minmax(116px, 0.72fr) minmax(150px, 0.95fr) minmax(190px, 1.25fr);
	gap: 6px;
	padding: 8px 12px;
}

.overview-summary-item,
.overview-basis-item {
	min-width: 0;
	padding: 6px 8px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: #f8fafc;
	cursor: help;
}

.overview-summary-item.strong {
	border-color: var(--el-color-primary-light-7);
	background: var(--el-color-primary-light-9);
}

.overview-summary-item.wide {
	background: #fbfcff;
}

.overview-summary-item span,
.overview-summary-item strong,
.overview-summary-item em,
.overview-basis-item span,
.overview-basis-item strong,
.overview-basis-item em {
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.overview-summary-item span,
.overview-basis-item span {
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 14px;
}

.overview-summary-item strong,
.overview-basis-item strong {
	margin-top: 1px;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 900;
	line-height: 17px;
}

.overview-summary-item.strong strong,
.overview-basis-item.strong strong {
	color: var(--el-color-primary);
}

.overview-summary-item em,
.overview-basis-item em {
	margin-top: 1px;
	color: var(--el-text-color-secondary);
	font-size: 10px;
	font-style: normal;
	line-height: 13px;
}

.overview-basis-grid {
	display: grid;
	grid-template-columns: repeat(6, minmax(0, 1fr));
	gap: 6px;
	padding-bottom: 8px;
}

.overview-basis-item {
	background: #fff;
}

.overview-basis-item.wide {
	grid-column: span 2;
}

.segment-setting-stat {
	min-width: 0;
	padding: 7px 9px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: #f8fafc;
}

.segment-setting-stat span,
.segment-setting-stat strong,
.segment-setting-stat em {
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.segment-setting-stat span {
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 15px;
}

.segment-setting-stat strong {
	margin-top: 2px;
	color: var(--el-text-color-primary);
	font-size: 14px;
	font-weight: 900;
	line-height: 18px;
}

.segment-setting-stat em {
	margin-top: 2px;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	font-style: normal;
	line-height: 15px;
}

.compact-collapse {
	border-top: 1px solid var(--el-border-color-lighter);
}

.compact-overview-panel .compact-collapse {
	border-top: 0;
}

.nested-document-collapse {
	border: 0;
}

.compact-reference-detail {
	padding: 0 0 10px;
}

.segment-settings-section {
	border-top: 3px solid var(--el-color-primary);
}

.segment-settings-grid {
	display: grid;
	grid-template-columns: minmax(120px, 0.8fr) minmax(120px, 0.8fr) minmax(142px, 0.9fr) minmax(108px, 0.68fr) minmax(132px, 0.76fr) auto;
	align-items: end;
	gap: 8px;
	padding: 10px 14px 12px;
}

.segment-settings-grid :deep(.el-form-item) {
	margin-bottom: 0;
}

.segment-settings-grid :deep(.el-select),
.segment-settings-grid :deep(.el-date-editor) {
	width: 100%;
}

.segment-setting-stat.success {
	border-color: var(--el-color-success-light-5);
	background: var(--el-color-success-light-9);
}

.segment-setting-stat.warning {
	border-color: var(--el-color-warning-light-5);
	background: var(--el-color-warning-light-9);
}

.segment-setting-stat.danger {
	border-color: var(--el-color-danger-light-5);
	background: var(--el-color-danger-light-9);
}

.context-summary-grid {
	display: grid;
	grid-template-columns: repeat(6, minmax(118px, 1fr));
	gap: 8px;
	padding: 12px 14px 10px;
}

.context-summary-card {
	min-width: 0;
	padding: 9px 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 7px;
	background: linear-gradient(180deg, #fbfcfe 0%, #f6f8fb 100%);
}

.context-summary-card span,
.context-summary-card strong,
.context-summary-card em {
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.context-summary-card span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 16px;
}

.context-summary-card strong {
	margin-top: 3px;
	color: var(--el-text-color-primary);
	font-size: 14px;
	font-weight: 900;
	line-height: 18px;
}

.context-summary-card em {
	margin-top: 5px;
	width: fit-content;
	max-width: 100%;
	padding: 1px 5px;
	border: 1px solid var(--el-border-color);
	border-radius: 4px;
	background: #fff;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	font-style: normal;
	font-weight: 700;
	line-height: 16px;
}

.history-context-collapse {
	border-top: 1px solid var(--el-border-color-lighter);
	border-bottom: 0;
}

.history-context-collapse :deep(.el-collapse-item__header) {
	height: 40px;
	padding: 0 14px;
	background: #fff;
}

.compact-overview-panel .history-context-collapse :deep(.el-collapse-item__header) {
	height: 34px;
	padding: 0 12px;
}

.history-context-collapse :deep(.el-collapse-item__content) {
	padding: 0 14px 12px;
}

.compact-overview-panel .history-context-collapse :deep(.el-collapse-item__content) {
	padding: 0 12px 10px;
}

.context-verification-grid {
	grid-template-columns: repeat(4, minmax(0, 1fr));
}

.reference-grid {
	display: grid;
	grid-template-columns: repeat(7, minmax(116px, 1fr));
	gap: 8px;
	padding: 12px 14px 8px;
}

.reference-card {
	min-width: 0;
	padding: 9px 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 7px;
	background: #f8fafc;
}

.reference-card span,
.reference-card strong {
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.reference-card span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 16px;
}

.reference-card strong {
	margin: 3px 0 6px;
	color: var(--el-text-color-primary);
	font-size: 18px;
	font-weight: 900;
	line-height: 22px;
}

.reference-card strong.blue {
	color: var(--el-color-primary);
}

.reference-card strong.orange {
	color: var(--el-color-warning);
}

.reference-detail-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
	padding: 0 14px 14px;
}

.reference-detail-row {
	display: grid;
	grid-template-columns: 118px minmax(0, 1fr) auto;
	align-items: center;
	gap: 8px;
	min-width: 0;
	padding: 8px 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 7px;
	background: #fff;
}

.reference-detail-row span,
.reference-detail-row strong {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.reference-detail-row span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.reference-detail-row strong {
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 800;
}

.quantity-chain-summary {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin: 12px 14px 0;
	padding: 9px 11px;
	border: 1px solid var(--el-color-primary-light-7);
	border-radius: 7px;
	background: var(--el-color-primary-light-9);
}

.quantity-chain-summary span,
.quantity-chain-summary strong,
.quantity-chain-summary em {
	display: inline-flex;
	align-items: center;
	min-width: 0;
}

.quantity-chain-summary span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.quantity-chain-summary strong {
	margin-left: 8px;
	color: var(--el-color-primary);
	font-size: 16px;
	font-weight: 900;
}

.quantity-chain-summary em {
	margin-left: 8px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	font-style: normal;
}

.core-stat {
	min-width: 0;
	padding: 8px 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 7px;
	background: #f8fafc;
}

.core-stat span,
.core-stat strong,
.core-stat em {
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.core-stat span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 16px;
}

.core-stat strong {
	margin-top: 2px;
	color: var(--el-text-color-primary);
	font-size: 16px;
	font-weight: 900;
	line-height: 20px;
}

.core-stat em {
	margin-top: 2px;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	font-style: normal;
	line-height: 15px;
}

.core-stat.success {
	border-color: var(--el-color-success-light-5);
	background: var(--el-color-success-light-9);
}

.core-stat.warning {
	border-color: var(--el-color-warning-light-5);
	background: var(--el-color-warning-light-9);
}

.core-stat.danger {
	border-color: var(--el-color-danger-light-5);
	background: var(--el-color-danger-light-9);
}

.manual-replenish-editor {
	overflow: hidden;
	padding-bottom: 0;
	border-top: 3px solid var(--el-color-primary);
}

.editor-head {
	padding-bottom: 10px;
}

.editor-head-actions {
	display: flex;
	align-items: center;
	gap: 10px;
}

.manual-analysis-panel {
	margin: 0 12px 12px;
	padding: 12px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	background: #fafbfc;
}

.manual-panel-top {
	display: flex;
	align-items: stretch;
	gap: 12px;
	padding-bottom: 12px;
	border-bottom: 1px dashed var(--el-border-color-lighter);
}

.manual-combined-formula {
	display: grid;
	grid-template-columns: 84px minmax(0, 1fr);
	align-items: stretch;
	gap: 8px;
	flex: 1 1 auto;
	min-width: 0;
}

.manual-mini-metrics {
	display: flex;
	flex-direction: column;
	gap: 5px;
	padding: 6px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: #fff;
}

.mini-metric-form-item {
	margin-bottom: 0;
}

.mini-metric-form-item :deep(.el-form-item__content) {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 3px;
	line-height: 1.15;
}

.mini-metric-form-item span,
.mini-metric-help span {
	color: var(--el-text-color-secondary);
	font-size: 11px;
	white-space: nowrap;
}

.manual-daily-input {
	width: 74px;
}

.manual-daily-input :deep(.el-input-number__decrease),
.manual-daily-input :deep(.el-input-number__increase) {
	width: 16px;
}

.manual-daily-input :deep(.el-input__wrapper) {
	padding-left: 4px;
	padding-right: 18px;
}

.manual-daily-input :deep(.el-input__inner) {
	height: 22px;
	font-size: 12px;
	font-weight: 800;
	text-align: center;
}

.mini-metric-help {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 34px;
	border: 1px dashed var(--el-color-primary-light-7);
	border-radius: 5px;
	background: var(--el-color-primary-light-9);
	cursor: help;
}

.mini-metric-help strong {
	margin-top: 2px;
	color: var(--el-text-color-primary);
	font-size: 14px;
	font-weight: 900;
}

.manual-formula-box {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 5px;
	min-width: 0;
	padding: 7px 8px;
	border: 1px solid var(--el-color-primary-light-7);
	border-radius: 6px;
	background: #f8fbff;
}

.manual-formula-box .formula-line {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	min-width: 0;
	padding: 4px 8px;
	border: 1px solid #d9ecff;
	border-radius: 5px;
	background: #fff;
	color: var(--el-text-color-regular);
	font-size: 12px;
	line-height: 1.35;
	cursor: help;
}

.manual-formula-box .formula-line.is-actual {
	border-color: #fde2c4;
	background: #fff7ed;
}

.manual-formula-box .formula-line.is-final {
	border-color: var(--el-color-success-light-7);
	background: var(--el-color-success-light-9);
}

.manual-formula-box .formula-main {
	flex: 0 0 auto;
	white-space: nowrap;
	color: var(--el-text-color-secondary);
}

.manual-formula-box .formula-main strong {
	margin-left: 4px;
	color: var(--el-color-primary);
	font-size: 14px;
	font-weight: 900;
}

.manual-formula-box .formula-line.is-actual .formula-main strong {
	color: var(--el-color-warning);
}

.manual-formula-box .formula-line.is-final .formula-main strong {
	color: var(--el-color-success);
}

.manual-formula-box .formula-expression {
	flex: 1 1 auto;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-regular);
}

.formula-warning {
	color: var(--el-color-warning);
	font-size: 12px;
	line-height: 16px;
}

.manual-panel-actions {
	display: flex;
	flex: 0 0 clamp(360px, 30vw, 420px);
	flex-direction: column;
	justify-content: center;
	gap: 8px;
	min-width: 0;
	padding: 8px 10px;
	border: 1px solid var(--el-border-color);
	border-radius: 6px;
	background: #fff;
}

.manual-action-row {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 5px;
	min-width: 0;
}

.manual-action-row-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-width: 0;
}

.manual-action-label {
	flex: 1 1 auto;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	white-space: nowrap;
}

.manual-action-row-head :deep(.el-tag) {
	flex: 0 0 auto;
}

.manual-inline-form-item {
	flex: 1 1 auto;
	min-width: 0;
	margin-bottom: 0;
}

.manual-inline-form-item :deep(.el-form-item__content) {
	display: block;
}

.manual-inline-form-item :deep(.el-select),
.manual-inline-form-item :deep(.el-date-editor) {
	width: 100%;
}

.period-inline-item {
	width: 100%;
	min-width: 0;
	overflow: hidden;
}

.period-inline-item :deep(.el-form-item__content) {
	display: flex;
	width: 100%;
	min-width: 0;
	overflow: hidden;
}

.period-inline-item :deep(.compact-period-picker),
.period-inline-item :deep(.compact-period-picker.el-date-editor),
.period-inline-item :deep(.compact-period-picker.el-range-editor),
.period-inline-item :deep(.compact-period-picker.el-input__wrapper),
.period-inline-item :deep(.el-range-editor.el-input__wrapper) {
	display: flex;
	width: 100%;
	min-width: 0;
	max-width: 100%;
	box-sizing: border-box;
	overflow: hidden;
}

.period-inline-item :deep(.compact-period-picker .el-range__icon) {
	flex: 0 0 14px;
	width: 14px;
	min-width: 14px;
	margin-right: 2px;
	font-size: 12px;
}

.period-inline-item :deep(.compact-period-picker .el-range-separator) {
	flex: 0 0 16px;
	width: 16px;
	min-width: 16px;
	padding: 0;
	font-size: 11px;
}

.period-inline-item :deep(.compact-period-picker .el-range-input) {
	flex: 1 1 0;
	width: 0;
	min-width: 0;
	font-size: 12px;
	text-align: center;
}

.period-inline-item :deep(.compact-period-picker .el-range__close-icon) {
	flex: 0 0 14px;
	width: 14px;
	min-width: 14px;
	margin-left: 2px;
	font-size: 12px;
}

.manual-param-strip {
	margin-top: 10px;
	padding: 9px 10px 10px;
	border: 1px solid var(--el-color-primary-light-7);
	border-radius: 7px;
	background: #f8fbff;
}

.param-strip-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 8px;
}

.param-strip-head > div {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.param-strip-head strong {
	color: var(--el-text-color-primary);
	font-size: 13px;
	line-height: 18px;
}

.param-strip-head span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 16px;
}

.param-strip-fields {
	display: grid;
	grid-template-columns: minmax(170px, 1.15fr) minmax(130px, 0.82fr) minmax(110px, 0.72fr) minmax(120px, 0.78fr) minmax(110px, 0.72fr) minmax(110px, 0.72fr);
	align-items: start;
	gap: 8px;
}

.param-control {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	padding: 7px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: #fff;
	margin-bottom: 0;
}

.param-control :deep(.el-form-item__content) {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 4px;
	min-width: 0;
	line-height: 1.15;
}

.param-label-line,
.param-control :deep(.el-form-item__content > .param-label-line) {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 6px;
	min-width: 0;
}

.param-label-line > span,
.param-control :deep(.el-form-item__content > .param-label-line > span) {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 14px;
}

.param-control :deep(.el-select),
.param-control :deep(.el-date-editor),
.param-control :deep(.el-input-number) {
	width: 100%;
}

.param-control :deep(.el-input__wrapper),
.param-control :deep(.el-input-number .el-input__wrapper) {
	background: #fff;
}

.box-pcs-helper {
	min-height: 14px;
	color: var(--el-color-success);
	font-size: 11px;
	line-height: 14px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.box-pcs-helper.warning {
	color: var(--el-text-color-secondary);
}

@media (max-width: 1280px) {
	.manual-panel-top {
		flex-direction: column;
	}

	.manual-panel-actions {
		flex: 0 0 auto;
	}

	.param-strip-fields {
		grid-template-columns: repeat(3, minmax(150px, 1fr));
	}
}

.manual-shipping-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 0 8px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.manual-shipping-head > div:first-child {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.manual-shipping-head strong {
	color: var(--el-text-color-primary);
	font-size: 14px;
}

.manual-shipping-head span,
.manual-shipping-head em {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-style: normal;
}

.shipping-head-actions {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
	min-width: 0;
}

.shipping-head-actions em {
	max-width: 320px;
	color: var(--el-text-color-regular);
}

.shipping-method-summary {
	display: block;
	cursor: help;
}

.manual-panel-bottom {
	display: flex;
	align-items: stretch;
	gap: 8px;
	overflow-x: auto;
	padding: 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 7px;
	background: #fff;
}

.manual-si-col {
	display: flex;
	flex: 1 0 132px;
	flex-direction: column;
	align-items: stretch;
	gap: 5px;
	min-width: 132px;
	padding: 8px 7px 7px;
	border: 1px solid #edf0f5;
	border-radius: 6px;
	background: #fafbfc;
	box-sizing: border-box;
}

.manual-si-col.active {
	border-color: var(--el-color-primary-light-6);
	background: #f5f8ff;
}

.manual-si-col.inactive {
	opacity: 0.58;
	background: #f7f8fa;
}

.manual-si-col.recommended.active {
	border-color: var(--el-color-success-light-5);
}

.si-head {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	min-width: 0;
}

.si-head :deep(.el-checkbox) {
	height: 18px;
	margin-right: 0;
}

.si-tag {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	max-width: 86px;
	padding: 2px 8px;
	border: 1px solid transparent;
	border-radius: 999px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 12px;
	font-weight: 700;
}

.si-tag.is-inactive {
	border-color: var(--el-border-color);
	background: var(--el-fill-color-light);
	color: var(--el-text-color-placeholder);
}

.si-head .el-icon {
	flex: 0 0 auto;
	color: var(--el-text-color-secondary);
	cursor: help;
}

.si-days-row {
	display: grid;
	grid-template-columns: 52px minmax(0, 1fr);
	align-items: center;
	gap: 5px;
	min-width: 0;
}

.si-days-row span {
	color: var(--el-text-color-secondary);
	font-size: 11px;
}

.si-days-row :deep(.el-input-number) {
	width: 100%;
}

.si-date-range {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 5px;
	min-height: 24px;
	padding: 3px 5px;
	border-radius: 5px;
	background: #ecf5ff;
	color: var(--el-color-primary);
	font-size: 12px;
	font-weight: 700;
}

.si-date-range.empty {
	background: var(--el-fill-color-light);
	color: var(--el-text-color-placeholder);
}

.si-date-range span,
.si-date-range em {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-style: normal;
}

.si-date-range em {
	font-size: 11px;
	font-weight: 500;
}

.si-arrival {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	text-align: center;
}

.si-suggestion {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: center;
	gap: 4px;
	min-height: 22px;
}

.si-suggestion .suggest-clickable {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	cursor: help;
}

.si-suggestion :deep(.el-tag) {
	height: 20px;
	padding: 0 5px;
	font-size: 10px;
}

.manual-shipping-qty-input {
	width: 100%;
}

.manual-shipping-qty-input :deep(.el-input__inner) {
	font-weight: 800;
	text-align: center;
}

.si-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 4px;
	min-height: 20px;
}

.si-foot button {
	border: 0;
	background: transparent;
	color: var(--el-color-primary);
	cursor: pointer;
	font-size: 12px;
	line-height: 18px;
	white-space: nowrap;
}

.si-foot button:disabled {
	color: var(--el-text-color-placeholder);
	cursor: not-allowed;
}

.manual-adjust-strip-lite {
	display: flex;
	flex-direction: column;
	gap: 7px;
	margin-top: 10px;
	padding: 9px 12px;
	border-radius: 0 0 8px 8px;
	background: #eef4ff;
	color: var(--el-text-color-regular);
	font-size: 12px;
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
	flex: 0 0 auto;
	font-size: 13px;
}

.mas-label,
.mas-field-label,
.mas-formula {
	flex: 0 0 auto;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	white-space: nowrap;
}

.mas-final {
	min-width: 42px;
	color: var(--el-text-color-primary);
	font-size: 14px;
	font-weight: 900;
}

.mas-divider {
	flex: 0 0 auto;
	width: 1px;
	height: 19px;
	background: var(--el-border-color);
}

.mas-field {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.mas-form-item {
	margin-bottom: 0;
}

.mas-form-item :deep(.el-form-item__content) {
	display: block;
}

.mas-form-item :deep(.el-input-number) {
	width: 82px;
}

.mas-warehouse-field {
	flex: 0 1 auto;
}

.mas-warehouse-select {
	width: 178px;
}

.mas-warehouse-select.is-missing :deep(.el-input__wrapper) {
	background: #fff7f7;
	box-shadow: 0 0 0 1px var(--el-color-danger-light-5) inset;
}

.mas-inline-warning {
	flex: 0 0 auto;
	max-width: 112px;
	white-space: nowrap;
}

.mas-summary-totals {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-left: auto;
	padding: 4px 9px;
	border: 1px solid #f7e6e6;
	border-radius: 6px;
	background: #fffafa;
}

.mst-item {
	display: flex;
	align-items: center;
	gap: 4px;
	white-space: nowrap;
}

.mst-label {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.mst-value {
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 900;
}

.mst-item.highlight .mst-label,
.mst-item.highlight .mst-value {
	color: var(--el-color-warning);
}

.mas-remark-field {
	flex: 1 1 520px;
	padding: 8px 10px 10px;
	border: 1px solid transparent;
	border-radius: 6px;
	transition:
		border-color 0.2s ease,
		box-shadow 0.2s ease,
		background-color 0.2s ease;
}

.mas-remark-field.is-attention {
	border-color: var(--el-color-warning-light-5);
	background: var(--el-color-warning-light-9);
	box-shadow: 0 0 0 1px rgba(245, 154, 35, 0.14) inset;
}

.mas-remark-form-item {
	flex: 1 1 auto;
}

.mas-remark-form-item :deep(.el-input__wrapper) {
	background: rgba(255, 255, 255, 0.82);
}

.mas-remark-hint {
	margin-top: 4px;
	color: var(--el-color-warning);
	font-size: 12px;
	line-height: 1.4;
}

.mas-preview-line {
	display: flex;
	align-items: center;
	gap: 6px;
	flex: 1 1 360px;
	min-width: 240px;
	padding: 5px 8px;
	border-radius: 5px;
	background: rgba(255, 255, 255, 0.72);
}

.mas-preview-line span {
	flex: 0 0 auto;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.mas-preview-line strong {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-primary);
	font-size: 12px;
}

.advanced-write-collapse {
	margin-top: 10px;
	border-top: 1px solid var(--el-border-color-lighter);
	border-bottom: 0;
}

.advanced-write-collapse :deep(.el-collapse-item__header) {
	height: 36px;
	background: transparent;
}

.compact-inventory-grid {
	padding: 8px 0 0;
}

.warehouse-recommend-row,
.warehouse-option-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	width: 100%;
	min-width: 0;
}

.warehouse-recommend-row span,
.warehouse-option-row span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.shipping-control-bar {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px 10px;
	padding: 10px 14px 0;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.shipping-control-bar > span {
	flex: 1 1 220px;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.shipping-control-bar > em {
	flex: 0 1 520px;
	min-width: 180px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-regular);
	font-style: normal;
}

.shipping-base-field {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 4px 8px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: #fff;
}

.shipping-base-field label {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	white-space: nowrap;
}

.shipping-base-field :deep(.el-date-editor) {
	width: 132px;
}

.shipping-workbench-rail {
	grid-template-columns: repeat(6, minmax(196px, 1fr));
	padding-top: 10px !important;
}

.shipping-workbench-card {
	min-width: 206px;
	padding: 8px;
	border-radius: 8px;
	background: linear-gradient(180deg, #fff 0%, #fbfcff 100%);
	box-shadow: 0 1px 2px rgb(31 45 61 / 4%);
}

.shipping-workbench-card:not(.active):not(.recommended) {
	opacity: 0.68;
	background: #fafafa;
}

.shipping-workbench-card.recommended:not(.active) {
	border-color: var(--el-color-warning-light-6);
	background: var(--el-color-warning-light-9);
}

.shipping-workbench-card.active {
	border-color: var(--el-color-primary);
	background: linear-gradient(180deg, #f5f8ff 0%, #edf3ff 100%);
	box-shadow: inset 0 0 0 1px var(--el-color-primary-light-5);
}

.shipping-workbench-card.active.recommended {
	border-color: var(--el-color-success-light-4);
	box-shadow: inset 0 0 0 1px var(--el-color-success-light-6);
}

.shipping-workbench-card .segment-top {
	min-height: 30px;
	gap: 5px;
}

.method-emoji {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 28px;
	width: 28px;
	height: 24px;
	border: 1px solid;
	border-radius: 999px;
	font-size: 15px;
	line-height: 1;
}

.shipping-workbench-card .method-title {
	flex-direction: column;
	align-items: flex-start;
	gap: 0;
}

.shipping-workbench-card .method-title strong {
	line-height: 18px;
}

.shipping-workbench-card .method-title span {
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 14px;
}

.method-recommend-badge {
	flex: 0 0 auto;
	padding: 1px 5px;
	border: 1px solid var(--el-color-success-light-5);
	border-radius: 999px;
	background: var(--el-color-success-light-9);
	color: var(--el-color-success);
	font-size: 11px;
	line-height: 16px;
}

.method-reason-row {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	padding: 2px 0 1px;
}

.method-reason-row span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-secondary);
	font-size: 11px;
}

.shipping-workbench-card .segment-top .el-icon {
	color: var(--el-text-color-secondary);
	cursor: help;
}

.segment-days-row,
.segment-arrival-row {
	display: grid;
	grid-template-columns: 56px minmax(0, 1fr);
	align-items: center;
	gap: 6px;
}

.segment-days-row span,
.segment-arrival-row span {
	color: var(--el-text-color-secondary);
	font-size: 11px;
}

.segment-arrival-row {
	min-height: 24px;
	padding: 4px 6px;
	border-radius: 5px;
	background: #fff;
	border: 1px solid var(--el-border-color-lighter);
}

.segment-arrival-row b {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-primary);
	font-size: 12px;
}

.segment-period-box {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 2px 8px;
	min-width: 0;
	padding: 5px 6px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 5px;
	background: #fff;
}

.segment-period-box span {
	grid-column: 1 / -1;
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 14px;
}

.segment-period-box strong {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-primary);
	font-size: 12px;
	line-height: 17px;
}

.segment-period-box em {
	color: var(--el-color-primary);
	font-size: 11px;
	font-style: normal;
	line-height: 17px;
	white-space: nowrap;
}

.segment-range-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr);
	align-items: center;
	gap: 4px;
}

.segment-range-row > span {
	color: var(--el-text-color-secondary);
	text-align: center;
	font-size: 12px;
}

.segment-range-row :deep(.el-date-editor) {
	width: 100%;
	min-width: 0;
}

.segment-range-row :deep(.el-input__wrapper) {
	padding: 0 6px;
}

.segment-days-row :deep(.el-input-number) {
	width: 100%;
}

.segment-qty-row {
	display: grid;
	grid-template-columns: minmax(64px, 0.52fr) minmax(0, 1fr);
	gap: 6px;
	align-items: stretch;
}

.segment-qty-reference,
.segment-qty-input-wrap {
	min-width: 0;
	padding: 5px 7px;
	border-radius: 5px;
	background: var(--el-fill-color-light);
}

.segment-qty-input-wrap {
	display: grid;
	grid-template-rows: auto auto;
	gap: 3px;
	background: #fff;
	border: 1px solid var(--el-border-color-lighter);
}

.segment-qty-row span,
.segment-qty-row strong {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.segment-qty-row span {
	color: var(--el-text-color-secondary);
	font-size: 11px;
	line-height: 14px;
}

.segment-qty-row strong {
	margin-top: 1px;
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 900;
	line-height: 17px;
}

.qty-input-label {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-secondary);
	font-size: 11px;
}

.segment-qty-input-wrap :deep(.el-input-number) {
	width: 100%;
}

:global(.manual-link-reference-tooltip) {
	max-width: 360px;
	white-space: pre-line;
	line-height: 1.55;
}

.inventory-section,
.shipping-section,
.remark-preview-section {
	padding-bottom: 12px;
}

.inventory-section .inventory-grid,
.shipping-section .segment-rail {
	padding: 12px 14px 0;
}

.remark-preview-grid {
	display: grid;
	grid-template-columns: minmax(320px, 0.82fr) minmax(0, 1.18fr);
	gap: 12px;
	padding: 12px 14px 2px;
}

.remark-item {
	min-width: 0;
}

.inline-preview {
	min-width: 0;
	padding: 0;
	border: 0;
	background: transparent;
}

.inline-preview .preview-grid {
	height: 100%;
}

.manual-form {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.manual-form :deep(.el-form-item) {
	margin-bottom: 0;
}

.manual-form :deep(.el-form-item__label) {
	margin-bottom: 3px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 18px;
}

.metric-strip {
	display: grid;
	grid-template-columns: repeat(8, minmax(108px, 1fr));
	gap: 0;
	overflow: hidden;
}

.metric-card {
	min-width: 0;
	min-height: 72px;
	padding: 9px 10px;
	border-right: 1px solid var(--el-border-color-lighter);
	box-sizing: border-box;
}

.metric-card:last-child {
	border-right: 0;
}

.metric-card strong {
	display: block;
	overflow: hidden;
	margin: 3px 0 5px;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-primary);
	font-size: 17px;
	line-height: 22px;
}

.metric-card strong.blue {
	color: var(--el-color-primary);
}

.metric-card strong.orange {
	color: var(--el-color-warning);
}

.calc-panel {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 12px;
	padding: 10px;
}

.formula-box {
	min-width: 0;
	padding: 8px 10px;
	border: 1px solid var(--el-color-primary-light-7);
	border-radius: 5px;
	background: var(--el-color-primary-light-9);
}

.formula-line {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	color: var(--el-text-color-primary);
	font-size: 13px;
}

.formula-line strong {
	color: var(--el-color-primary);
	font-size: 16px;
}

.formula-line em {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--el-text-color-secondary);
	font-style: normal;
}

.formula-hint {
	margin-top: 5px;
	color: var(--el-color-warning);
	font-size: 12px;
	line-height: 17px;
}

.quantity-chain {
	display: grid;
	grid-template-columns: repeat(3, minmax(118px, 1fr));
	gap: 8px;
	margin-top: 8px;
}

.quantity-chain :deep(.el-form-item) {
	margin-bottom: 0;
}

.quantity-chain :deep(.el-input-number) {
	width: 100%;
}

.quantity-warning {
	margin-top: 6px;
	color: var(--el-color-warning);
	font-size: 12px;
	line-height: 17px;
}

.calc-controls {
	display: flex;
	align-items: flex-start;
	gap: 8px;
}

.control-field {
	width: 128px;
}

.period-field :deep(.el-date-editor) {
	width: 220px;
}

.shipping-panel,
.inventory-panel,
.adjust-panel,
.preview-panel {
	padding: 10px;
}

.panel-head.compact {
	margin-bottom: 6px;
}

.segment-total {
	color: var(--el-text-color-regular);
	font-size: 13px;
	font-weight: 700;
}

.segment-total.danger,
.validation-text {
	color: var(--el-color-danger);
}

.segment-rail {
	display: grid;
	grid-template-columns: repeat(6, minmax(150px, 1fr));
	gap: 8px;
	overflow-x: auto;
}

.segment-card {
	min-width: 150px;
	padding: 8px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: #fff;
	box-sizing: border-box;
}

.segment-card.active {
	border-color: var(--el-color-primary-light-5);
	background: var(--el-color-primary-light-9);
}

.segment-card.recommended:not(.active) {
	border-color: var(--el-color-warning-light-5);
}

.segment-top {
	display: flex;
	align-items: center;
	gap: 5px;
	min-height: 24px;
}

.method-dot {
	flex: 0 0 7px;
	width: 7px;
	height: 7px;
	border-radius: 50%;
}

.method-title {
	display: flex;
	align-items: baseline;
	gap: 5px;
	min-width: 0;
	flex: 1;
}

.method-title strong {
	color: var(--el-text-color-primary);
	font-size: 13px;
}

.method-title span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.segment-fields {
	display: flex;
	flex-direction: column;
	gap: 5px;
	margin-top: 8px;
}

.segment-fields.disabled {
	opacity: 0.58;
}

.segment-fields :deep(.el-date-editor),
.segment-fields :deep(.el-input-number) {
	width: 100%;
}

.segment-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 6px;
	margin-top: 7px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.segment-foot button {
	border: 0;
	background: transparent;
	color: var(--el-color-primary);
	cursor: pointer;
	font-size: 12px;
}

.segment-foot button:disabled {
	color: var(--el-text-color-placeholder);
	cursor: not-allowed;
}

.inventory-grid {
	display: grid;
	grid-template-columns: repeat(6, minmax(118px, 1fr));
	gap: 8px;
}

.inventory-grid :deep(.el-input-number),
.adjust-row :deep(.el-input-number) {
	width: 100%;
}

.adjust-panel {
	display: flex;
	flex-direction: column;
	gap: 8px;
	background: #f8fbff;
}

.adjust-row {
	display: grid;
	grid-template-columns: repeat(6, minmax(120px, 1fr));
	gap: 8px;
}

.adjust-row.wide {
	grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
}

.warehouse-row {
	display: grid;
	grid-template-columns: 130px minmax(0, 1fr);
	gap: 6px;
}

.preview-grid {
	display: grid;
	grid-template-columns: repeat(6, minmax(0, 1fr));
	gap: 8px;
}

.footer-left {
	min-width: 0;
	font-size: 13px;
}

.footer-ok {
	color: var(--el-color-success);
}

@media (max-width: 1180px) {
	.dialog-body {
		grid-template-columns: 260px minmax(0, 1fr);
	}

	.dialog-body.select-mode {
		grid-template-columns: minmax(0, 1fr);
	}

	.select-review-layout {
		grid-template-columns: 360px minmax(0, 1fr);
	}

	.relation-summary {
		grid-template-columns: minmax(0, 1fr) 180px minmax(0, 1fr);
	}

	.current-product-card {
		grid-template-columns: 76px minmax(0, 1fr);
	}

	.current-product-metrics {
		grid-column: 1 / -1;
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.listing-match-fields {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.step-strip {
		width: min(640px, 100%);
	}

	.evidence-table-head,
	.evidence-table-row {
		grid-template-columns: minmax(78px, 0.45fr) minmax(0, 1fr) minmax(0, 1fr) 66px;
		gap: 6px;
	}

	.metric-strip {
		grid-template-columns: repeat(4, minmax(120px, 1fr));
	}

	.reference-grid {
		grid-template-columns: repeat(4, minmax(120px, 1fr));
	}

	.overview-relation-strip {
		grid-template-columns: minmax(0, 1fr);
	}

	.overview-arrow {
		display: none;
	}

	.overview-summary-grid {
		grid-template-columns: repeat(4, minmax(130px, 1fr));
	}

	.overview-basis-grid {
		grid-template-columns: repeat(3, minmax(140px, 1fr));
	}

	.overview-basis-item.wide {
		grid-column: span 2;
	}

	.context-summary-grid {
		grid-template-columns: repeat(3, minmax(140px, 1fr));
	}

	.context-verification-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.reference-detail-grid {
		grid-template-columns: 1fr;
	}

	.remark-preview-grid {
		grid-template-columns: 1fr;
	}

	.calc-panel {
		grid-template-columns: 1fr;
	}

	.inventory-grid,
	.preview-grid {
		grid-template-columns: repeat(3, minmax(120px, 1fr));
	}

	.quantity-chain {
		grid-template-columns: repeat(3, minmax(110px, 1fr));
	}
}

@media (max-width: 820px) {
	.dialog-body {
		grid-template-columns: 1fr;
		overflow: auto;
	}

	.dialog-body.select-mode {
		grid-template-columns: 1fr;
	}

	.select-review-layout {
		grid-template-columns: 1fr;
		overflow: visible;
	}

	.relation-summary {
		grid-template-columns: 1fr;
	}

	.relation-center::before,
	.relation-center::after {
		display: none;
	}

	.step-strip {
		grid-template-columns: minmax(0, 1fr) 52px minmax(0, 1fr);
	}

	.step-node em {
		display: none;
	}

	.evidence-table-head,
	.evidence-table-row {
		grid-template-columns: minmax(70px, 0.45fr) minmax(0, 1fr) minmax(0, 1fr) 62px;
	}

	.listing-search.wide {
		grid-template-columns: 1fr;
	}

	.listing-search.refined {
		grid-template-columns: 1fr;
	}

	.listing-result-list.wide .listing-result {
		grid-template-columns: 48px minmax(0, 1fr);
	}

	.candidate-row {
		grid-template-columns: 48px minmax(0, 1fr);
	}

	.source-match-fields,
	.listing-match-fields {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.candidate-metrics {
		grid-column: 1 / -1;
	}

	.result-metrics.compact {
		grid-column: 1 / -1;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		width: 100%;
	}

	.side-pane,
	.main-pane {
		overflow: visible;
	}

	.adjust-row,
	.adjust-row.wide {
		grid-template-columns: 1fr;
	}

	.reference-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.context-summary-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.context-verification-grid {
		grid-template-columns: 1fr;
	}

	.reference-detail-row {
		grid-template-columns: 1fr;
		align-items: flex-start;
	}

	.warehouse-row {
		grid-template-columns: 1fr;
	}

	.shipping-control-bar {
		align-items: flex-start;
		flex-direction: column;
	}

	.calc-panel {
		grid-template-columns: 1fr;
	}

	.quantity-chain {
		grid-template-columns: 1fr;
	}
}
</style>
