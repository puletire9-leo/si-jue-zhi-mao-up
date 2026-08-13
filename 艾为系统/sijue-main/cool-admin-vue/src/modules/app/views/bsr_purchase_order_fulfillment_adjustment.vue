<template>
	<div class="fulfillment-workbench-page">
		<div class="page-toolbar">
			<div class="toolbar-title">
				<div class="title">履约异常单据</div>
				<div class="subtitle">
					列表只负责定位单据；处理页自动分配处理人，确认前先核对上方信息。
				</div>
			</div>
			<div class="toolbar-actions">
				<el-button :loading="loading || summaryLoading" @click="reloadAll">刷新</el-button>
			</div>
		</div>

		<div class="filter-bar">
			<el-input
				v-model="filters.keyWord"
				clearable
				placeholder="采购单 / 计划 / ASIN / MSKU / 产品编码 / 店铺"
				class="filter-keyword"
				@keyup.enter="search"
				@clear="search"
			/>
			<el-input
				v-model="filters.marketplace"
				clearable
				placeholder="国家"
				class="filter-small"
				@keyup.enter="search"
				@clear="search"
			/>
			<el-input
				v-model="filters.seller_name"
				clearable
				placeholder="店铺"
				class="filter-store"
				@keyup.enter="search"
				@clear="search"
			/>
			<el-select
				v-model="filters.document_status"
				clearable
				class="filter-small"
				placeholder="单据进度"
				@change="search"
			>
				<el-option
					v-for="item in documentStatusOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
			<el-select
				v-model="filters.exception_type"
				clearable
				class="filter-small"
				placeholder="异常类型"
				@change="search"
			>
				<el-option
					v-for="item in exceptionTypeOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
			<el-button type="primary" @click="search">搜索</el-button>
			<el-button @click="resetFilters">重置</el-button>
		</div>

		<div class="status-overview" v-loading="summaryLoading">
			<button
				v-for="item in statusSummaryCards"
				:key="item.key"
				class="status-chip"
				:class="[item.className, { active: isStatusFilterActive(item.filterValue) }]"
				@click="applyDocumentStatusFilter(item.filterValue)"
			>
				<span>{{ item.label }}</span>
				<strong>{{ item.value }}</strong>
			</button>
			<div class="metric-chips">
				<button
					class="metric-chip"
					:class="{ active: filters.exception_type === 'defective' }"
					@click="applyExceptionTypeFilter('defective')"
				>
					<span>残次品待处理</span>
					<strong>{{ summary.defective_pending_qty }}</strong>
				</button>
				<button
					class="metric-chip"
					:class="{ active: filters.exception_type === 'short_shipped' }"
					@click="applyExceptionTypeFilter('short_shipped')"
				>
					<span>少发待处理</span>
					<strong>{{ summary.short_shipped_pending_qty }}</strong>
				</button>
			</div>
		</div>

		<el-table
			v-loading="loading"
			:data="tableData"
			border
			stripe
			size="small"
			row-key="id"
			class="fulfillment-table"
		>
			<el-table-column type="expand" width="44">
				<template #default="{ row }">
					<div class="source-detail-panel">
						<div class="source-detail-title">采购来源详情</div>
						<div class="source-detail-grid">
							<div class="source-detail-card">
								<div class="source-card-title">采购单</div>
								<div class="source-field">
									<span>单号</span>
									<strong>{{ row.purchase_order_sn || "-" }}</strong>
								</div>
								<div class="source-field">
									<span>采购员</span>
									<strong>{{ getPurchaseOrderOperator(row) }}</strong>
								</div>
								<div class="source-field">
									<span>最后操作</span>
									<strong>{{ getPurchaseOrderLastOperator(row) }}</strong>
								</div>
								<div class="source-field">
									<span>供应商 / 仓库</span>
									<strong>{{ getPurchaseOrderSupplierWarehouse(row) }}</strong>
								</div>
								<div class="source-field">
									<span>创建 / 下单</span>
									<strong>{{ getPurchaseOrderTimeText(row) }}</strong>
								</div>
							</div>
							<div class="source-detail-card">
								<div class="source-card-title">采购计划</div>
								<div class="source-field">
									<span>计划号</span>
									<strong>{{ row.primary_plan_sn || "-" }}</strong>
								</div>
								<div class="source-field">
									<span>创建人</span>
									<strong>{{ getPurchasePlanCreator(row) }}</strong>
								</div>
								<div class="source-field">
									<span>采购员</span>
									<strong>{{ getPurchasePlanBuyer(row) }}</strong>
								</div>
								<div class="source-field">
									<span>供应商 / 仓库</span>
									<strong>{{ getPurchasePlanSupplierWarehouse(row) }}</strong>
								</div>
								<div class="source-field">
									<span>创建时间</span>
									<strong>{{ formatTime(row.purchase_plan_create_time) }}</strong>
								</div>
							</div>
						</div>
					</div>
				</template>
			</el-table-column>

			<el-table-column label="产品 / 采购信息" min-width="460">
				<template #default="{ row }">
					<div class="product-purchase-cell">
						<el-popover
							v-if="getProductImage(row)"
							trigger="hover"
							placement="right"
							:width="292"
							popper-class="product-image-popover"
						>
							<template #reference>
								<el-image
									class="product-thumb"
									:src="getProductImage(row)"
									fit="cover"
								/>
							</template>
							<el-image
								class="product-image-large"
								:src="getProductImage(row)"
								fit="contain"
							/>
						</el-popover>
						<div v-else class="product-thumb image-placeholder">无图</div>
						<div class="product-copy">
							<div class="product-title-row">
								<strong>{{
									row.item_name || row.product_name || row.local_sku || "-"
								}}</strong>
								<el-tag size="small" effect="plain">{{
									row.marketplace || "-"
								}}</el-tag>
							</div>
							<div class="identity-line">
								<span>ASIN：{{ row.asin || "-" }}</span>
								<span>MSKU：{{ row.msku || "-" }}</span>
								<span>编码：{{ row.product_code || "-" }}</span>
							</div>
							<div class="purchase-line">
								<span>采购单：{{ row.purchase_order_sn || "-" }}</span>
								<span>计划：{{ row.primary_plan_sn || "-" }}</span>
							</div>
							<div class="muted">
								{{ row.seller_name || row.shop || "-" }} ·
								{{ getDocumentNo(row) }} · {{ formatTime(getRowUpdateTime(row)) }}
							</div>
						</div>
					</div>
				</template>
			</el-table-column>

			<el-table-column label="单据进度" width="130">
				<template #default="{ row }">
					<div class="document-progress-cell">
						<el-tag
							size="small"
							effect="plain"
							:type="getDocumentStatusTagType(getDocumentStatus(row))"
						>
							{{ getDocumentStatusText(getDocumentStatus(row)) }}
						</el-tag>
						<span class="muted">{{ getDocumentProgressHint(row) }}</span>
					</div>
				</template>
			</el-table-column>

			<el-table-column label="异常明细" min-width="240">
				<template #default="{ row }">
					<div class="exception-summary-list">
						<div
							v-if="hasExceptionQty(row, 'defective')"
							class="exception-summary-chip"
							:class="{ done: isFieldProcessed(row, 'defective') }"
						>
							<span>残次品</span>
							<strong>{{ Number(row.defective_qty) || 0 }}</strong>
							<el-tag
								size="small"
								effect="plain"
								:type="getExceptionStatusTagType(row, 'defective')"
							>
								{{ getExceptionStatusText(row, "defective") }}
							</el-tag>
						</div>
						<div
							v-if="hasExceptionQty(row, 'short_shipped')"
							class="exception-summary-chip"
							:class="{ done: isFieldProcessed(row, 'short_shipped') }"
						>
							<span>商家少发</span>
							<strong>{{ Number(row.short_shipped_qty) || 0 }}</strong>
							<el-tag
								size="small"
								effect="plain"
								:type="getExceptionStatusTagType(row, 'short_shipped')"
							>
								{{ getExceptionStatusText(row, "short_shipped") }}
							</el-tag>
						</div>
						<span
							v-if="
								!hasExceptionQty(row, 'defective') &&
								!hasExceptionQty(row, 'short_shipped')
							"
							class="muted"
						>
							无异常明细
						</span>
					</div>
				</template>
			</el-table-column>

			<el-table-column label="处理流转" min-width="180">
				<template #default="{ row }">
					<div class="flow-brief">
						<div>
							<span>处理</span>
							<strong>{{
								row.assigned_to_nickname || row.assigned_to_username || "-"
							}}</strong>
						</div>
						<div>
							<span>确认</span>
							<strong>{{
								row.confirmed_by_nickname || row.confirmed_by_username || "-"
							}}</strong>
						</div>
					</div>
				</template>
			</el-table-column>

			<el-table-column label="操作" width="140" fixed="right">
				<template #default="{ row }">
					<div class="table-actions">
						<el-button link type="primary" @click="openDetail(row, 'detail')"
							>查看</el-button
						>
						<el-button
							link
							type="success"
							:disabled="isLocked(row)"
							:loading="openingRowId === row.id"
							@click="openDetail(row, 'process')"
						>
							处理
						</el-button>
					</div>
				</template>
			</el-table-column>
		</el-table>

		<div class="pagination-bar">
			<el-pagination
				v-model:current-page="pagination.page"
				v-model:page-size="pagination.size"
				:page-sizes="[10, 20, 50, 100]"
				:total="pagination.total"
				layout="total, sizes, prev, pager, next, jumper"
				@size-change="handlePageChange"
				@current-change="handlePageChange"
			/>
		</div>

		<el-drawer
			v-model="drawer.visible"
			size="min(1280px, 96vw)"
			destroy-on-close
			class="fulfillment-drawer"
		>
			<template #header>
				<div class="drawer-header">
					<div>
						<div class="drawer-title">{{ getDocumentNo(currentRow) }}</div>
						<div class="drawer-subtitle">
							{{ currentRow?.purchase_order_sn || "-" }}
							<span v-if="currentRow?.primary_plan_sn">
								/ {{ currentRow.primary_plan_sn }}</span
							>
							<span v-if="currentRow?.marketplace">
								/ {{ currentRow.marketplace }}</span
							>
						</div>
					</div>
					<el-tag
						size="small"
						effect="plain"
						:type="getDocumentStatusTagType(getDocumentStatus(currentRow))"
					>
						{{ getDocumentStatusText(getDocumentStatus(currentRow)) }}
					</el-tag>
				</div>
			</template>

			<div
				v-if="currentRow"
				class="drawer-body"
				:class="{ 'is-process-mode': isProcessMode }"
			>
				<section class="drawer-product-summary">
					<el-image
						v-if="getProductImage(currentRow)"
						class="drawer-product-image"
						:src="getProductImage(currentRow)"
						fit="cover"
					/>
					<div v-else class="drawer-product-image image-placeholder">无图</div>
					<div class="drawer-summary-main">
						<strong class="drawer-product-name">
							{{
								currentRow.item_name ||
								currentRow.product_name ||
								currentRow.local_sku ||
								"-"
							}}
						</strong>
						<div class="drawer-product-identities">
							<span>ASIN：{{ currentRow.asin || "-" }}</span>
							<span>MSKU：{{ currentRow.msku || "-" }}</span>
							<span>编码：{{ currentRow.product_code || "-" }}</span>
						</div>
						<div class="drawer-product-identities">
							<span>采购单：{{ currentRow.purchase_order_sn || "-" }}</span>
							<span>计划：{{ currentRow.primary_plan_sn || "-" }}</span>
						</div>
					</div>
					<div class="drawer-summary-status">
						<el-tag
							effect="plain"
							:type="getDocumentStatusTagType(getDocumentStatus(currentRow))"
						>
							{{ getDocumentStatusText(getDocumentStatus(currentRow)) }}
						</el-tag>
						<span v-if="hasExceptionQty(currentRow, 'defective')">
							残次品 {{ Number(currentRow.defective_qty) || 0 }}
						</span>
						<span v-if="hasExceptionQty(currentRow, 'short_shipped')">
							少发 {{ Number(currentRow.short_shipped_qty) || 0 }}
						</span>
					</div>
				</section>

				<el-alert
					v-if="isLocked(currentRow)"
					class="document-lock-alert"
					title="该单据已确认锁定，原采购页面不能再修改。"
					type="success"
					:closable="false"
					show-icon
				/>

				<el-collapse v-model="drawer.activePanels" class="drawer-collapse">
					<el-collapse-item name="source">
						<template #title>
							<div class="collapse-title">
								<strong>采购来源</strong>
								<span>采购单、采购计划、创建人和异常原始信息</span>
							</div>
						</template>
						<section class="document-section info-section">
							<div class="section-head">
								<div>
									<div class="section-title">单据信息</div>
									<div class="section-desc">
										先核对采购单、采购计划和产品身份，下面才是处理输入。
									</div>
								</div>
								<div class="section-tags">
									<el-tag
										size="small"
										effect="plain"
										:type="
											getDocumentStatusTagType(getDocumentStatus(currentRow))
										"
									>
										{{ getDocumentStatusText(getDocumentStatus(currentRow)) }}
									</el-tag>
									<el-tag
										v-if="isProcessMode && !isLocked(currentRow)"
										size="small"
										type="success"
										effect="plain"
									>
										处理中
									</el-tag>
								</div>
							</div>

							<div class="info-grid">
								<div class="info-card">
									<span>采购单号</span>
									<strong>{{ currentRow.purchase_order_sn || "-" }}</strong>
								</div>
								<div class="info-card">
									<span>采购计划</span>
									<strong>{{ currentRow.primary_plan_sn || "-" }}</strong>
								</div>
								<div class="info-card">
									<span>国家 / 店铺</span>
									<strong
										>{{ currentRow.marketplace || "-" }} /
										{{ currentRow.seller_name || "-" }}</strong
									>
								</div>
								<div class="info-card">
									<span>产品编码</span>
									<strong>{{ currentRow.product_code || "-" }}</strong>
								</div>
								<div class="info-card wide">
									<span>ASIN / MSKU</span>
									<strong
										>{{ currentRow.asin || "-" }} /
										{{ currentRow.msku || "-" }}</strong
									>
								</div>
								<div class="info-card wide">
									<span>产品名称</span>
									<strong>{{
										currentRow.item_name || currentRow.product_name || "-"
									}}</strong>
								</div>
								<div class="info-card">
									<span>采购单采购员</span>
									<strong>{{ getPurchaseOrderOperator(currentRow) }}</strong>
								</div>
								<div class="info-card">
									<span>采购单最后操作</span>
									<strong>{{ getPurchaseOrderLastOperator(currentRow) }}</strong>
								</div>
								<div class="info-card">
									<span>采购计划创建人</span>
									<strong>{{ getPurchasePlanCreator(currentRow) }}</strong>
								</div>
								<div class="info-card">
									<span>采购计划采购员</span>
									<strong>{{ getPurchasePlanBuyer(currentRow) }}</strong>
								</div>
							</div>
						</section>

						<section class="document-section exception-section">
							<div class="section-head">
								<div>
									<div class="section-title">异常信息</div>
									<div class="section-desc">
										这里是采购侧填写的异常事实和处理结果，只读展示。
									</div>
								</div>
							</div>

							<div class="exception-detail-grid">
								<article
									class="exception-detail-card"
									:class="{ empty: !hasExceptionQty(currentRow, 'defective') }"
								>
									<div class="exception-card-head">
										<div>
											<div class="exception-name">残次品</div>
											<div class="exception-qty">
												数量 {{ Number(currentRow.defective_qty) || 0 }}
											</div>
										</div>
										<el-tag
											size="small"
											effect="plain"
											:type="
												getAdjustmentStatusTagType(
													currentRow.defective_status
												)
											"
										>
											{{
												getAdjustmentStatusText(currentRow.defective_status)
											}}
										</el-tag>
									</div>
									<div class="readonly-field">
										<span>异常说明</span>
										<strong>{{ currentRow.defective_remark || "-" }}</strong>
									</div>
									<div class="readonly-field">
										<span>处理备注</span>
										<strong>{{
											currentRow.defective_process_remark || "-"
										}}</strong>
									</div>
									<div class="readonly-field">
										<span>处理人</span>
										<strong>{{
											getDefectiveProcessedUserText(currentRow)
										}}</strong>
										<em>{{
											formatTime(currentRow.defective_processed_time)
										}}</em>
									</div>
								</article>

								<article
									class="exception-detail-card"
									:class="{
										empty: !hasExceptionQty(currentRow, 'short_shipped')
									}"
								>
									<div class="exception-card-head">
										<div>
											<div class="exception-name">商家少发</div>
											<div class="exception-qty">
												数量 {{ Number(currentRow.short_shipped_qty) || 0 }}
											</div>
										</div>
										<el-tag
											size="small"
											effect="plain"
											:type="
												getAdjustmentStatusTagType(
													currentRow.short_shipped_status
												)
											"
										>
											{{
												getAdjustmentStatusText(
													currentRow.short_shipped_status
												)
											}}
										</el-tag>
									</div>
									<div class="readonly-field">
										<span>异常说明</span>
										<strong>{{
											currentRow.short_shipped_remark || "-"
										}}</strong>
									</div>
									<div class="readonly-field">
										<span>处理备注</span>
										<strong>{{
											currentRow.short_shipped_process_remark || "-"
										}}</strong>
									</div>
									<div class="readonly-field">
										<span>处理人</span>
										<strong>{{
											getShortShippedProcessedUserText(currentRow)
										}}</strong>
										<em>{{
											formatTime(currentRow.short_shipped_processed_time)
										}}</em>
									</div>
								</article>
							</div>
						</section>

						<section class="document-section flow-section">
							<div class="section-head compact">
								<div class="section-title">流转信息</div>
							</div>
							<div class="flow-grid">
								<div class="flow-item">
									<span>接手人</span>
									<strong>{{ getAssignedUserText(currentRow) }}</strong>
									<em>{{ formatTime(currentRow.assigned_time) }}</em>
								</div>
								<div class="flow-item">
									<span>确认人</span>
									<strong>{{
										currentRow.confirmed_by_nickname ||
										currentRow.confirmed_by_username ||
										"-"
									}}</strong>
									<em>{{ formatTime(currentRow.confirmed_time) }}</em>
								</div>
								<div class="flow-item wide">
									<span>确认备注</span>
									<strong>{{ currentRow.confirm_remark || "-" }}</strong>
								</div>
							</div>
						</section>
					</el-collapse-item>

					<el-collapse-item name="process">
						<template #title>
							<div class="collapse-title">
								<strong>处理填写</strong>
								<span>填写处理结果，全部完成后确认锁定</span>
							</div>
						</template>
						<section
							v-if="isProcessMode && !isLocked(currentRow)"
							class="document-section input-section"
						>
							<div class="section-head">
								<div>
									<div class="section-title">处理信息</div>
									<div class="section-desc">
										这里只填写怎么处理，不能改采购侧的异常事实。
									</div>
								</div>
							</div>

							<div class="process-form-grid">
								<div
									v-if="hasExceptionQty(currentRow, 'defective')"
									class="process-form-card"
									:class="{
										done: isFieldProcessed(currentRow, 'defective'),
										editing: isProcessFieldEditing('defective')
									}"
								>
									<div class="form-card-head">
										<div>
											<div class="form-card-title">残次品处理方式</div>
											<div class="form-card-desc">
												数量
												{{
													Number(currentRow.defective_qty) || 0
												}}，例如退货、补发、报损。
											</div>
										</div>
										<el-tag
											size="small"
											:type="getProcessFieldTagType(currentRow, 'defective')"
											effect="plain"
										>
											{{ getProcessFieldTagText(currentRow, "defective") }}
										</el-tag>
									</div>
									<div
										v-if="
											isFieldProcessed(currentRow, 'defective') &&
											!isProcessFieldEditing('defective')
										"
										class="process-result-panel"
									>
										<div class="readonly-field">
											<span>处理备注</span>
											<strong>{{
												getProcessFieldRemark(currentRow, "defective") ||
												"-"
											}}</strong>
										</div>
										<div class="process-result-meta">
											<div class="readonly-field compact">
												<span>处理人</span>
												<strong>{{
													getProcessFieldUserText(currentRow, "defective")
												}}</strong>
											</div>
											<div class="readonly-field compact">
												<span>处理时间</span>
												<strong>{{
													formatTime(
														getProcessFieldTimeText(
															currentRow,
															"defective"
														)
													)
												}}</strong>
											</div>
										</div>
										<div class="action-footer">
											<el-button
												type="primary"
												plain
												@click="startEditingProcessField('defective')"
											>
												修改
											</el-button>
										</div>
									</div>
									<div v-else class="process-editor-panel">
										<el-input
											v-model="draft.defective_process_remark"
											type="textarea"
											:rows="4"
											:placeholder="
												isProcessFieldEditing('defective')
													? '修改怎么处理残次品，例如退货、补发、报损'
													: '填写怎么处理残次品，例如退货、补发、报损'
											"
										/>
										<div class="action-footer">
											<el-button
												type="success"
												plain
												:disabled="!canProcessField('defective')"
												:loading="actionLoading === 'defective'"
												@click="processField('defective')"
											>
												{{ getProcessFieldSubmitText("defective") }}
											</el-button>
											<el-button
												v-if="isProcessFieldEditing('defective')"
												@click="cancelEditingProcessField('defective')"
											>
												取消修改
											</el-button>
										</div>
									</div>
								</div>

								<div
									v-if="hasExceptionQty(currentRow, 'short_shipped')"
									class="process-form-card"
									:class="{
										done: isFieldProcessed(currentRow, 'short_shipped'),
										editing: isProcessFieldEditing('short_shipped')
									}"
								>
									<div class="form-card-head">
										<div>
											<div class="form-card-title">商家少发处理方式</div>
											<div class="form-card-desc">
												数量
												{{
													Number(currentRow.short_shipped_qty) || 0
												}}，例如索赔、补发、改单。
											</div>
										</div>
										<el-tag
											size="small"
											:type="
												getProcessFieldTagType(currentRow, 'short_shipped')
											"
											effect="plain"
										>
											{{
												getProcessFieldTagText(currentRow, "short_shipped")
											}}
										</el-tag>
									</div>
									<div
										v-if="
											isFieldProcessed(currentRow, 'short_shipped') &&
											!isProcessFieldEditing('short_shipped')
										"
										class="process-result-panel"
									>
										<div class="readonly-field">
											<span>处理备注</span>
											<strong>{{
												getProcessFieldRemark(
													currentRow,
													"short_shipped"
												) || "-"
											}}</strong>
										</div>
										<div class="process-result-meta">
											<div class="readonly-field compact">
												<span>处理人</span>
												<strong>{{
													getProcessFieldUserText(
														currentRow,
														"short_shipped"
													)
												}}</strong>
											</div>
											<div class="readonly-field compact">
												<span>处理时间</span>
												<strong>{{
													formatTime(
														getProcessFieldTimeText(
															currentRow,
															"short_shipped"
														)
													)
												}}</strong>
											</div>
										</div>
										<div class="action-footer">
											<el-button
												type="primary"
												plain
												@click="startEditingProcessField('short_shipped')"
											>
												修改
											</el-button>
										</div>
									</div>
									<div v-else class="process-editor-panel">
										<el-input
											v-model="draft.short_shipped_process_remark"
											type="textarea"
											:rows="4"
											:placeholder="
												isProcessFieldEditing('short_shipped')
													? '修改怎么处理少发，例如索赔、补发、改单'
													: '填写怎么处理少发，例如索赔、补发、改单'
											"
										/>
										<div class="action-footer">
											<el-button
												type="success"
												plain
												:disabled="!canProcessField('short_shipped')"
												:loading="actionLoading === 'short_shipped'"
												@click="processField('short_shipped')"
											>
												{{ getProcessFieldSubmitText("short_shipped") }}
											</el-button>
											<el-button
												v-if="isProcessFieldEditing('short_shipped')"
												@click="cancelEditingProcessField('short_shipped')"
											>
												取消修改
											</el-button>
										</div>
									</div>
								</div>
							</div>
						</section>

						<section
							v-if="isProcessMode && !isLocked(currentRow)"
							class="document-section final-confirm-section"
							:class="{ ready: canConfirm(currentRow) }"
						>
							<div class="section-head">
								<div>
									<div class="section-title">最终确认</div>
									<div class="section-desc">
										确认后单据会锁定，原采购页面不能再修改。
									</div>
								</div>
								<el-tag
									size="small"
									effect="plain"
									:type="canConfirm(currentRow) ? 'warning' : 'info'"
								>
									{{ canConfirm(currentRow) ? "可确认" : "需先处理完异常" }}
								</el-tag>
							</div>
							<div v-if="!canConfirm(currentRow)" class="pending-confirm-hint">
								待处理：{{ getPendingProcessText(currentRow) }}
							</div>
							<el-input
								v-model="draft.confirm_remark"
								type="textarea"
								:rows="4"
								:disabled="!canConfirm(currentRow)"
								placeholder="填写确认备注，例如已与供应商确认、已完成补发"
							/>
							<div class="action-footer">
								<el-button
									type="primary"
									:disabled="
										!canConfirm(currentRow) || !draft.confirm_remark.trim()
									"
									:loading="actionLoading === 'confirm'"
									@click="confirmDocument"
								>
									确认并锁定
								</el-button>
							</div>
						</section>
						<div
							v-if="!isProcessMode || isLocked(currentRow)"
							class="process-readonly-hint"
						>
							当前为查看模式；需要处理时请从列表点击“处理”。
						</div>
					</el-collapse-item>

					<el-collapse-item name="logs">
						<template #title>
							<div class="collapse-title">
								<strong>操作日志</strong>
								<span>查看单据创建、处理和确认记录</span>
							</div>
						</template>
						<div class="drawer-section">
							<el-table
								v-loading="logsLoading"
								:data="logs"
								border
								size="small"
								max-height="280"
							>
								<el-table-column label="时间" width="150">
									<template #default="{ row }">{{
										formatTime(row.createTime)
									}}</template>
								</el-table-column>
								<el-table-column label="动作" width="130">
									<template #default="{ row }">{{
										getLogActionText(row.action_type, row.field_group)
									}}</template>
								</el-table-column>
								<el-table-column
									prop="operator_username"
									label="操作人"
									width="100"
								/>
								<el-table-column label="变更摘要" min-width="320">
									<template #default="{ row }">
										{{ getLogSummary(row) }}
									</template>
								</el-table-column>
								<el-table-column
									prop="remark"
									label="备注"
									min-width="220"
									show-overflow-tooltip
								/>
							</el-table>
						</div>
					</el-collapse-item>
				</el-collapse>
			</div>
		</el-drawer>
	</div>
</template>

<script lang="ts" name="app-bsr_purchase_order_fulfillment_adjustment" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useBase } from "/$/base";
import { useCool } from "/@/cool";

const { service } = useCool();
const { user } = useBase();

const filters = reactive({
	keyWord: "",
	marketplace: "",
	seller_name: "",
	document_status: "",
	exception_type: ""
});

const pagination = reactive({
	page: 1,
	size: 20,
	total: 0
});

const summary = reactive({
	total: 0,
	pending: 0,
	processing: 0,
	pending_confirm: 0,
	confirmed: 0,
	defective_pending_qty: 0,
	short_shipped_pending_qty: 0
});

const tableData = ref<any[]>([]);
const loading = ref(false);
const summaryLoading = ref(false);
const drawer = reactive({
	visible: false,
	mode: "detail" as "detail" | "process",
	activePanels: ["source"] as string[]
});
const currentRow = ref<any>(null);
const logs = ref<any[]>([]);
const logsLoading = ref(false);
const actionLoading = ref("");
const openingRowId = ref<number | null>(null);
const draft = reactive({
	defective_process_remark: "",
	short_shipped_process_remark: "",
	confirm_remark: ""
});
const processEditing = reactive({
	defective: false,
	short_shipped: false
});

const documentStatusOptions = [
	{ label: "待处理", value: 0 },
	{ label: "处理中", value: 1 },
	{ label: "待确认", value: 2 },
	{ label: "已锁定", value: 3 }
];

const exceptionTypeOptions = [
	{ label: "残次品", value: "defective" },
	{ label: "商家少发", value: "short_shipped" }
];

const statusSummaryCards = computed(() => {
	return [
		{ key: "total", label: "全部", value: summary.total, filterValue: "", className: "" },
		{
			key: "pending",
			label: "待处理",
			value: summary.pending,
			filterValue: 0,
			className: "warning"
		},
		{
			key: "processing",
			label: "处理中",
			value: summary.processing,
			filterValue: 1,
			className: "warning"
		},
		{
			key: "pending_confirm",
			label: "待确认",
			value: summary.pending_confirm,
			filterValue: 2,
			className: "primary"
		},
		{
			key: "confirmed",
			label: "已锁定",
			value: summary.confirmed,
			filterValue: 3,
			className: "success"
		}
	];
});

onMounted(() => {
	void reloadAll();
});

const isProcessMode = computed(() => drawer.mode === "process");

function normalizeRow(row: any) {
	return {
		...row,
		...(row?.adjustment || {})
	};
}

function getDocumentNo(row: any) {
	return row?.document_no || (row?.id ? `FA-${row.id}` : "-");
}

function getRowUpdateTime(row: any) {
	return row?.updateTime || row?.updated_at || row?.updatedTime || null;
}

function getDocumentStatus(row: any) {
	return Number(row?.document_status ?? row?.adjustment?.document_status ?? 0) || 0;
}

function getDocumentStatusText(status: any) {
	return (
		(
			{
				0: "待处理",
				1: "处理中",
				2: "待确认",
				3: "已锁定"
			} as Record<number, string>
		)[Number(status) || 0] || "待处理"
	);
}

function getDocumentProgressHint(row: any) {
	const status = getDocumentStatus(row);
	if (status === 0) return "等待处理";
	if (status === 1) return getAssignedUserText(row);
	if (status === 2) return "等确认锁单";
	return "原页面已锁";
}

function getDocumentStatusTagType(status: any): any {
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

function getAdjustmentStatusText(status: any) {
	const value = Number(status) || 0;
	if (value === 2) return "已处理";
	if (value === 1) return "未处理";
	return "无异常";
}

function getAdjustmentStatusTagType(status: any): any {
	const value = Number(status) || 0;
	if (value === 2) return "success";
	if (value === 1) return "danger";
	return "info";
}

function getExceptionStatusText(row: any, fieldGroup: "defective" | "short_shipped") {
	if (!hasExceptionQty(row, fieldGroup)) return "无异常";
	return isFieldProcessed(row, fieldGroup) ? "已处理" : "未处理";
}

function getExceptionStatusTagType(row: any, fieldGroup: "defective" | "short_shipped"): any {
	if (!hasExceptionQty(row, fieldGroup)) return "info";
	return isFieldProcessed(row, fieldGroup) ? "success" : "danger";
}

function getProductImage(row: any) {
	const candidates = [
		row?.image_url,
		row?.imageUrl,
		row?.main_image_url,
		row?.product_image_url,
		row?.purchase_plan_image_url,
		row?.source?.image_url,
		row?.source?.imageUrl
	];
	const url = candidates.find((item) => String(item || "").trim());
	return url ? String(url).trim() : "";
}

function pickText(...values: any[]) {
	const value = values.find((item) => String(item || "").trim());
	return value ? String(value).trim() : "-";
}

function joinSourceText(...values: any[]) {
	const list = values.map((item) => String(item || "").trim()).filter(Boolean);
	return list.length ? list.join(" / ") : "-";
}

function getPurchaseOrderOperator(row: any) {
	return pickText(row?.purchase_order_operator_name, row?.opt_realname);
}

function getPurchaseOrderLastOperator(row: any) {
	return pickText(
		row?.purchase_order_last_operator_name,
		row?.last_realname,
		row?.purchase_order_auditor_name
	);
}

function getPurchaseOrderSupplierWarehouse(row: any) {
	return joinSourceText(
		row?.purchase_order_supplier_name || row?.supplier_name,
		row?.warehouse_name
	);
}

function getPurchaseOrderTimeText(row: any) {
	const values = [row?.purchase_order_time, row?.purchase_order_order_time]
		.filter(Boolean)
		.map((item) => formatTime(item));
	return values.length ? values.join(" / ") : "-";
}

function getPurchasePlanCreator(row: any) {
	return pickText(row?.purchase_plan_creator_name, row?.plan_creator_name);
}

function getPurchasePlanBuyer(row: any) {
	return pickText(row?.purchase_plan_buyer_name, row?.cg_opt_username);
}

function getPurchasePlanSupplierWarehouse(row: any) {
	return joinSourceText(row?.purchase_plan_supplier_name, row?.purchase_plan_warehouse_name);
}

function formatTime(value: any) {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
	return date.toLocaleString("zh-CN", { hour12: false });
}

function formatLinkedPlans(value: any) {
	if (Array.isArray(value)) {
		return value.length ? value.join(" / ") : "-";
	}
	if (!value) return "-";
	if (typeof value === "string") {
		const text = value.trim();
		if (!text) return "-";
		try {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed)) {
				return parsed.length ? parsed.join(" / ") : "-";
			}
		} catch {
			return text;
		}
		return text;
	}
	return String(value);
}

function isLocked(row: any) {
	return getDocumentStatus(row) === 3;
}

function hasPendingException(row: any) {
	return (
		((Number(row?.defective_qty) || 0) > 0 && Number(row?.defective_status) !== 2) ||
		((Number(row?.short_shipped_qty) || 0) > 0 && Number(row?.short_shipped_status) !== 2)
	);
}

function canConfirm(row: any) {
	return !isLocked(row) && !hasPendingException(row);
}

function hasExceptionQty(row: any, fieldGroup: "defective" | "short_shipped") {
	if (!row) return false;
	return fieldGroup === "defective"
		? (Number(row.defective_qty) || 0) > 0
		: (Number(row.short_shipped_qty) || 0) > 0;
}

function isFieldProcessed(row: any, fieldGroup: "defective" | "short_shipped") {
	if (!row) return false;
	return fieldGroup === "defective"
		? Number(row.defective_status) === 2
		: Number(row.short_shipped_status) === 2;
}

function isProcessFieldEditing(fieldGroup: "defective" | "short_shipped") {
	return Boolean(processEditing[fieldGroup]);
}

function syncProcessDraftFromCurrentRow(fieldGroup: "defective" | "short_shipped") {
	if (!currentRow.value) return;
	if (fieldGroup === "defective") {
		draft.defective_process_remark = String(currentRow.value.defective_process_remark || "");
		return;
	}
	draft.short_shipped_process_remark = String(
		currentRow.value.short_shipped_process_remark || ""
	);
}

function startEditingProcessField(fieldGroup: "defective" | "short_shipped") {
	const row = currentRow.value;
	if (!row || isLocked(row) || !isFieldProcessed(row, fieldGroup)) return;
	syncProcessDraftFromCurrentRow(fieldGroup);
	processEditing[fieldGroup] = true;
}

function cancelEditingProcessField(fieldGroup: "defective" | "short_shipped") {
	syncProcessDraftFromCurrentRow(fieldGroup);
	processEditing[fieldGroup] = false;
}

function getProcessFieldRemark(row: any, fieldGroup: "defective" | "short_shipped") {
	return fieldGroup === "defective"
		? row?.defective_process_remark
		: row?.short_shipped_process_remark;
}

function getProcessFieldUserText(row: any, fieldGroup: "defective" | "short_shipped") {
	return fieldGroup === "defective"
		? getDefectiveProcessedUserText(row)
		: getShortShippedProcessedUserText(row);
}

function getProcessFieldTimeText(row: any, fieldGroup: "defective" | "short_shipped") {
	return fieldGroup === "defective"
		? row?.defective_processed_time
		: row?.short_shipped_processed_time;
}

function getProcessFieldTagText(row: any, fieldGroup: "defective" | "short_shipped") {
	if (isProcessFieldEditing(fieldGroup)) return "编辑中";
	return isFieldProcessed(row, fieldGroup) ? "已处理" : "必填";
}

function getProcessFieldTagType(row: any, fieldGroup: "defective" | "short_shipped"): any {
	if (isProcessFieldEditing(fieldGroup)) return "warning";
	return isFieldProcessed(row, fieldGroup) ? "success" : "danger";
}

function getProcessFieldSubmitText(fieldGroup: "defective" | "short_shipped") {
	return isProcessFieldEditing(fieldGroup)
		? "保存修改"
		: fieldGroup === "defective"
			? "提交残次品处理"
			: "提交少发处理";
}

function canProcessField(fieldGroup: "defective" | "short_shipped") {
	const row = currentRow.value;
	if (!row || isLocked(row)) return false;
	if (!hasExceptionQty(row, fieldGroup)) return false;
	if (isFieldProcessed(row, fieldGroup) && !isProcessFieldEditing(fieldGroup)) return false;
	const remark =
		fieldGroup === "defective"
			? draft.defective_process_remark
			: draft.short_shipped_process_remark;
	return Boolean(String(remark || "").trim());
}

function buildIdentityPayload(row: any) {
	return {
		store_id: row.store_id,
		marketplace: row.marketplace,
		asin: row.asin,
		msku: row.msku || "",
		product_code: row.product_code || "",
		purchase_order_sn: row.purchase_order_sn || "",
		primary_plan_sn: row.primary_plan_sn || "",
		linked_plan_sns: Array.isArray(row.linked_plan_sns) ? row.linked_plan_sns : []
	};
}

function getCurrentUserPayload() {
	const info = (user.info as any)?.value || user.info || {};
	return {
		assigned_to_user_id: info.id || info.userId || null,
		assigned_to_username: info.username || info.name || "",
		assigned_to_nickname: info.nickname || info.nickName || ""
	};
}

function getAssignedUserText(row: any) {
	return row?.assigned_to_nickname || row?.assigned_to_username || "-";
}

function getDefectiveProcessedUserText(row: any) {
	return row?.defective_processed_by_nickname || row?.defective_processed_by_username || "-";
}

function getShortShippedProcessedUserText(row: any) {
	return (
		row?.short_shipped_processed_by_nickname || row?.short_shipped_processed_by_username || "-"
	);
}

function getPendingProcessText(row: any) {
	const list: string[] = [];
	if (hasExceptionQty(row, "defective") && !isFieldProcessed(row, "defective")) {
		list.push("残次品");
	}
	if (hasExceptionQty(row, "short_shipped") && !isFieldProcessed(row, "short_shipped")) {
		list.push("商家少发");
	}
	return list.length ? list.join("、") : "无";
}

function normalizeActionPayload(result: any) {
	return result?.fulfillment_adjustment || result || {};
}

function mergeRowWithPayload(row: any, payload: any) {
	const normalizedPayload = normalizeActionPayload(payload);
	return normalizeRow({
		...row,
		...normalizedPayload,
		adjustment: {
			...(row?.adjustment || {}),
			...normalizedPayload
		}
	});
}

function syncRowInList(updated: any, rowId = Number(currentRow.value?.id) || 0) {
	if (!updated || !rowId) return;
	const payload = normalizeActionPayload(updated);
	tableData.value = tableData.value.map((item) =>
		item.id === rowId ? mergeRowWithPayload(item, payload) : item
	);
	if (Number(currentRow.value?.id) === rowId) {
		currentRow.value = mergeRowWithPayload(currentRow.value, payload);
	}
}

function refreshCurrentRowFromList() {
	if (!currentRow.value?.id) return;
	const latest = tableData.value.find((item) => item.id === currentRow.value.id);
	if (latest) {
		currentRow.value = normalizeRow({ ...currentRow.value, ...latest });
	}
}

async function reloadSummary() {
	summaryLoading.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/bsr_purchase_order_fulfillment_adjustment/summary",
			method: "POST",
			data: { ...filters }
		});
		summary.total = Number(res?.total) || 0;
		summary.pending = Number(res?.pending) || 0;
		summary.processing = Number(res?.processing) || 0;
		summary.pending_confirm = Number(res?.pending_confirm) || 0;
		summary.confirmed = Number(res?.confirmed) || 0;
		summary.defective_pending_qty = Number(res?.defective_pending_qty) || 0;
		summary.short_shipped_pending_qty = Number(res?.short_shipped_pending_qty) || 0;
	} catch (error: any) {
		ElMessage.error(error?.message || "加载统计失败");
	} finally {
		summaryLoading.value = false;
	}
}

async function reloadList() {
	loading.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/bsr_purchase_order_fulfillment_adjustment/page",
			method: "POST",
			data: {
				page: pagination.page,
				size: pagination.size,
				...filters
			}
		});
		const list = Array.isArray(res?.list) ? res.list : [];
		tableData.value = list.map((row: any) => normalizeRow(row));
		pagination.total = Number(res?.pagination?.total) || 0;
		pagination.page = Number(res?.pagination?.page) || pagination.page;
		pagination.size = Number(res?.pagination?.size) || pagination.size;
	} catch (error: any) {
		ElMessage.error(error?.message || "加载单据列表失败");
	} finally {
		loading.value = false;
	}
}

async function reloadAll() {
	await Promise.all([reloadSummary(), reloadList()]);
}

function search() {
	pagination.page = 1;
	void reloadAll();
}

function isStatusFilterActive(value: any) {
	return String(filters.document_status ?? "") === String(value ?? "");
}

function applyDocumentStatusFilter(value: any) {
	filters.document_status = value;
	search();
}

function applyExceptionTypeFilter(value: "defective" | "short_shipped") {
	filters.exception_type = filters.exception_type === value ? "" : value;
	search();
}

function resetFilters() {
	filters.keyWord = "";
	filters.marketplace = "";
	filters.seller_name = "";
	filters.document_status = "";
	filters.exception_type = "";
	search();
}

function handlePageChange() {
	void reloadList();
}

async function loadLogs(row: any) {
	if (!row?.id) return;
	logsLoading.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/bsr_purchase_order_fulfillment_adjustment/logs",
			method: "POST",
			data: { adjustment_id: row.id }
		});
		logs.value = Array.isArray(res) ? res : [];
	} catch (error: any) {
		logs.value = [];
		ElMessage.error(error?.message || "加载日志失败");
	} finally {
		logsLoading.value = false;
	}
}

async function openDetail(row: any, mode: "detail" | "process" = "detail") {
	const normalized = normalizeRow(row);
	if (mode === "process" && isLocked(normalized)) {
		ElMessage.warning("单据已确认锁定，只能查看");
		return;
	}

	openingRowId.value = mode === "process" ? Number(normalized.id) || null : null;
	try {
		const target = mode === "process" ? await ensureAssignedForProcess(normalized) : normalized;
		if (!target) return;

		currentRow.value = normalizeRow(target);
		drawer.mode = mode;
		drawer.activePanels = mode === "process" && !isLocked(target) ? ["process"] : ["source"];
		resetDraftFromCurrentRow();
		drawer.visible = true;
		void loadLogs(currentRow.value);
	} catch (error: any) {
		if (error?.message !== "cancelled") {
			ElMessage.error(error?.message || "打开单据失败");
		}
	} finally {
		openingRowId.value = null;
	}
}

function resetDraftFromCurrentRow() {
	if (!currentRow.value) return;
	syncProcessDraftFromCurrentRow("defective");
	syncProcessDraftFromCurrentRow("short_shipped");
	draft.confirm_remark = String(currentRow.value.confirm_remark || "");
	processEditing.defective = false;
	processEditing.short_shipped = false;
}

async function ensureAssignedForProcess(row: any) {
	if (isLocked(row)) return row;

	const currentUser = getCurrentUserPayload();
	const assignedUserId = Number(row.assigned_to_user_id) || 0;
	const currentUserId = Number(currentUser.assigned_to_user_id) || 0;
	const hasAssignee = assignedUserId > 0 || Boolean(row.assigned_to_username);
	const isMine =
		assignedUserId > 0 && currentUserId > 0
			? assignedUserId === currentUserId
			: Boolean(
					row.assigned_to_username &&
						currentUser.assigned_to_username &&
						row.assigned_to_username === currentUser.assigned_to_username
				);

	if (hasAssignee && !isMine) {
		try {
			await ElMessageBox.confirm(
				"该单据已指派给 " + getAssignedUserText(row) + "，是否接手处理？",
				"接手处理确认",
				{
					type: "warning",
					confirmButtonText: "接手处理",
					cancelButtonText: "取消"
				}
			);
		} catch {
			throw new Error("cancelled");
		}
	}

	if (hasAssignee && isMine) return row;

	const result = await service.request({
		url: "/admin/app/bsr_purchase_order_fulfillment_adjustment/assign",
		method: "POST",
		data: {
			adjustment_id: row.id,
			...currentUser,
			remark: hasAssignee ? "工作台接手处理" : "打开处理自动指派"
		}
	});
	const merged = mergeRowWithPayload(row, result);
	syncRowInList(result, row.id);
	return merged;
}

function updateCurrentRowFromActionResult(result: any) {
	if (!currentRow.value) return;
	syncRowInList(result, Number(currentRow.value.id) || 0);
}

async function refreshAfterAction() {
	await reloadAll();
	refreshCurrentRowFromList();
	if (currentRow.value) {
		await loadLogs(currentRow.value);
	}
}

function clearSubmittedDraft(fieldGroup: "defective" | "short_shipped") {
	if (fieldGroup === "defective") {
		draft.defective_process_remark = "";
		processEditing.defective = false;
		return;
	}
	draft.short_shipped_process_remark = "";
	processEditing.short_shipped = false;
}

async function processField(fieldGroup: "defective" | "short_shipped") {
	const row = currentRow.value;
	if (!row) return;
	const editingMode = isProcessFieldEditing(fieldGroup);
	if (isLocked(row)) {
		ElMessage.warning("单据已确认锁定，不能再处理");
		return;
	}
	if (isFieldProcessed(row, fieldGroup) && !editingMode) {
		ElMessage.warning("该异常已经处理完成，如需修改请先点击修改");
		return;
	}
	const remark =
		fieldGroup === "defective"
			? String(draft.defective_process_remark || "").trim()
			: String(draft.short_shipped_process_remark || "").trim();
	if (!remark) {
		ElMessage.warning("请先填写处理备注");
		return;
	}

	actionLoading.value = fieldGroup;
	try {
		const res = await service.request({
			url: "/admin/app/bsr_purchase_order_fulfillment_adjustment/process",
			method: "POST",
			data: {
				...buildIdentityPayload(row),
				field_group: fieldGroup,
				remark
			}
		});
		updateCurrentRowFromActionResult(res || {});
		clearSubmittedDraft(fieldGroup);
		ElMessage.success(editingMode ? "修改已保存" : "处理完成");
		await refreshAfterAction();
	} catch (error: any) {
		ElMessage.error(error?.message || "处理失败");
	} finally {
		actionLoading.value = "";
	}
}

async function confirmDocument() {
	const row = currentRow.value;
	if (!row) return;
	if (isLocked(row)) {
		ElMessage.warning("单据已确认锁定");
		return;
	}
	if (hasPendingException(row)) {
		ElMessage.warning("仍有未处理的异常，不能确认锁定");
		return;
	}
	const confirmRemark = String(draft.confirm_remark || "").trim();
	if (!confirmRemark) {
		ElMessage.warning("请先填写确认备注");
		return;
	}

	try {
		await ElMessageBox.confirm("确认后该单据会锁定，原采购页面不能再修改。", "确认锁定", {
			type: "warning",
			confirmButtonText: "确认锁定",
			cancelButtonText: "取消"
		});
	} catch {
		return;
	}

	actionLoading.value = "confirm";
	try {
		const res = await service.request({
			url: "/admin/app/bsr_purchase_order_fulfillment_adjustment/confirm",
			method: "POST",
			data: {
				adjustment_id: row.id,
				confirm_remark: confirmRemark
			}
		});
		updateCurrentRowFromActionResult(res || {});
		ElMessage.success("已确认锁定");
		await refreshAfterAction();
	} catch (error: any) {
		ElMessage.error(error?.message || "确认失败");
	} finally {
		actionLoading.value = "";
	}
}

function getLogActionText(actionType: string, fieldGroup: string) {
	const fieldText =
		fieldGroup === "defective"
			? "残次品"
			: fieldGroup === "short_shipped"
				? "商家少发"
				: fieldGroup === "manual_completed"
					? "人工完成"
					: "单据";
	const actionText =
		(
			{
				assign: "指派",
				process: "处理",
				confirm: "确认",
				create: "创建",
				update: "保存"
			} as Record<string, string>
		)[actionType] || "修改";
	return `${actionText}${fieldText}`;
}

const logFields = [
	{ key: "defective_qty", label: "残次品数量", type: "qty" },
	{ key: "defective_status", label: "残次品状态", type: "status" },
	{ key: "defective_remark", label: "残次品异常说明", type: "text" },
	{ key: "defective_process_remark", label: "残次品处理备注", type: "text" },
	{ key: "defective_processed_by_nickname", label: "残次品处理人", type: "text" },
	{ key: "short_shipped_qty", label: "商家少发数量", type: "qty" },
	{ key: "short_shipped_status", label: "商家少发状态", type: "status" },
	{ key: "short_shipped_remark", label: "商家少发异常说明", type: "text" },
	{ key: "short_shipped_process_remark", label: "商家少发处理备注", type: "text" },
	{ key: "short_shipped_processed_by_nickname", label: "商家少发处理人", type: "text" },
	{ key: "document_status", label: "单据状态", type: "document_status" },
	{ key: "assigned_to_username", label: "指派人", type: "text" },
	{ key: "assigned_time", label: "指派时间", type: "datetime" },
	{ key: "confirmed_by_username", label: "确认人", type: "text" },
	{ key: "confirmed_time", label: "确认时间", type: "datetime" },
	{ key: "confirm_remark", label: "确认备注", type: "text" }
];

function parseLogJson(value: any) {
	if (!value) return null;
	if (typeof value === "object") return value;
	if (typeof value !== "string") return null;
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

function getDefaultLogSnapshot() {
	return {
		defective_qty: 0,
		defective_status: 0,
		defective_remark: "",
		defective_process_remark: "",
		defective_processed_by_nickname: "",
		short_shipped_qty: 0,
		short_shipped_status: 0,
		short_shipped_remark: "",
		short_shipped_process_remark: "",
		short_shipped_processed_by_nickname: "",
		document_status: 0,
		assigned_to_username: "",
		assigned_time: null,
		confirmed_by_username: "",
		confirmed_time: null,
		confirm_remark: ""
	};
}

function formatLogValue(field: any, value: any) {
	if (field.type === "qty") return String(Number(value) || 0);
	if (field.type === "status") return getAdjustmentStatusText(Number(value) || 0);
	if (field.type === "document_status") return getDocumentStatusText(Number(value) || 0);
	if (field.type === "datetime") return formatTime(value);
	const text = String(value ?? "").trim();
	return text || "空";
}

function getLogSummary(row: any) {
	const before = { ...getDefaultLogSnapshot(), ...(parseLogJson(row?.before_json) || {}) };
	const after = { ...getDefaultLogSnapshot(), ...(parseLogJson(row?.after_json) || {}) };
	const changes = logFields.filter((field) => {
		return formatLogValue(field, before[field.key]) !== formatLogValue(field, after[field.key]);
	});
	if (!changes.length) return "无字段变化";
	return changes
		.slice(0, 2)
		.map(
			(field) =>
				`${field.label}：${formatLogValue(field, before[field.key])} → ${formatLogValue(field, after[field.key])}`
		)
		.join("；");
}
</script>

<style scoped>
.fulfillment-workbench-page {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

.page-toolbar {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
}

.toolbar-title {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.title {
	font-size: 18px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.subtitle {
	color: var(--el-text-color-secondary);
	font-size: 13px;
}

.toolbar-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}

.filter-bar {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	align-items: center;
}

.filter-keyword {
	width: 340px;
}

.filter-small {
	width: 140px;
}

.filter-store {
	width: 180px;
}

.status-overview {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	padding: 8px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 12px;
	background: #fff;
}

.status-chip,
.metric-chip {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	height: 36px;
	padding: 0 13px;
	border: 1px solid transparent;
	border-radius: 999px;
	background: #f7f8fa;
	color: var(--el-text-color-regular);
	cursor: pointer;
	transition:
		background-color 0.18s ease,
		border-color 0.18s ease,
		box-shadow 0.18s ease,
		transform 0.18s ease;
}

.status-chip:hover,
.metric-chip:hover {
	transform: translateY(-1px);
	border-color: var(--el-color-primary-light-5);
	box-shadow: 0 6px 16px rgb(64 158 255 / 12%);
}

.status-chip.active,
.metric-chip.active {
	border-color: var(--el-color-primary);
	background: var(--el-color-primary-light-9);
	color: var(--el-color-primary);
}

.status-chip span,
.metric-chip span {
	font-size: 13px;
}

.status-chip strong,
.metric-chip strong {
	font-size: 18px;
	line-height: 1;
}

.status-chip.warning strong {
	color: var(--el-color-warning);
}

.status-chip.primary strong {
	color: var(--el-color-primary);
}

.status-chip.success strong {
	color: var(--el-color-success);
}

.metric-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-left: auto;
}

.metric-chip strong {
	color: var(--el-color-danger);
}

.fulfillment-table {
	width: 100%;
}

.product-purchase-cell {
	display: flex;
	align-items: flex-start;
	gap: 12px;
	min-width: 0;
}

.product-thumb {
	width: 64px;
	height: 64px;
	flex: 0 0 64px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 10px;
	background: #f5f7fa;
	overflow: hidden;
	cursor: zoom-in;
	transition:
		transform 0.18s ease,
		box-shadow 0.18s ease,
		border-color 0.18s ease;
}

.product-thumb:hover {
	transform: translateY(-1px) scale(1.03);
	border-color: var(--el-color-primary-light-5);
	box-shadow: 0 8px 18px rgb(31 45 61 / 14%);
}

:global(.product-image-popover) {
	padding: 10px !important;
	border-radius: 12px !important;
	box-shadow: 0 14px 36px rgb(31 45 61 / 18%) !important;
}

.product-image-large {
	display: block;
	width: 270px;
	height: 270px;
	border-radius: 8px;
	background: #f7f8fa;
}

.image-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 64px;
	height: 64px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
	background: #f5f7fa;
}

.product-copy {
	display: flex;
	min-width: 0;
	flex: 1;
	flex-direction: column;
	gap: 5px;
}

.product-title-row {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.product-title-row strong {
	min-width: 0;
	font-size: 13px;
	line-height: 1.35;
	color: var(--el-text-color-primary);
	word-break: break-word;
}

.identity-line,
.purchase-line {
	display: flex;
	flex-wrap: wrap;
	gap: 8px 14px;
	font-size: 12px;
	line-height: 1.4;
	color: var(--el-text-color-regular);
}

.document-progress-cell {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 7px;
}

.source-detail-panel {
	padding: 14px 20px 18px 56px;
	background: linear-gradient(180deg, #f8fafc, #fff);
}

.source-detail-title {
	margin-bottom: 10px;
	font-size: 13px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.source-detail-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;
}

.source-detail-card {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 10px;
	padding: 12px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 12px;
	background: #fff;
	box-shadow: 0 5px 16px rgb(31 45 61 / 4%);
}

.source-card-title {
	grid-column: 1 / -1;
	font-size: 13px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.source-field {
	display: flex;
	min-width: 0;
	flex-direction: column;
	gap: 4px;
	padding: 8px 9px;
	border-radius: 8px;
	background: #f8fafc;
}

.source-field span {
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.source-field strong {
	font-size: 13px;
	font-weight: 600;
	line-height: 1.4;
	color: var(--el-text-color-primary);
	word-break: break-word;
}

.cell-vertical {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.muted {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.exception-stack {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.exception-item {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.exception-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}

.exception-line {
	font-size: 12px;
	line-height: 1.4;
	word-break: break-word;
}

.exception-summary-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.exception-summary-chip {
	display: grid;
	grid-template-columns: minmax(64px, 1fr) auto auto;
	align-items: center;
	gap: 8px;
	padding: 7px 9px;
	border: 1px solid rgba(245, 108, 108, 0.28);
	border-radius: 10px;
	background: rgba(254, 240, 240, 0.72);
}

.exception-summary-chip.done {
	border-color: rgba(103, 194, 58, 0.26);
	background: rgba(240, 249, 235, 0.72);
}

.exception-summary-chip span {
	font-size: 13px;
	color: var(--el-text-color-regular);
}

.exception-summary-chip strong {
	font-size: 18px;
	line-height: 1;
	color: var(--el-text-color-primary);
}

.flow-brief {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.flow-brief div {
	display: flex;
	align-items: center;
	gap: 8px;
}

.flow-brief span {
	width: 32px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.flow-brief strong {
	font-size: 13px;
	font-weight: 600;
	color: var(--el-text-color-primary);
	word-break: break-word;
}

.table-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

.pagination-bar {
	display: flex;
	justify-content: flex-end;
}

.drawer-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	width: 100%;
}

.drawer-title {
	font-size: 16px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.drawer-subtitle {
	margin-top: 4px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.drawer-body {
	display: flex;
	flex-direction: column;
	gap: 14px;
	padding-bottom: 12px;
}

.drawer-product-summary {
	display: flex;
	align-items: flex-start;
	gap: 13px;
	padding: 14px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 12px;
	background: linear-gradient(135deg, #fff, #f8fafc);
	box-shadow: 0 8px 24px rgb(31 45 61 / 6%);
}

.drawer-product-image {
	width: 76px;
	height: 76px;
	flex: 0 0 76px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 12px;
	background: #f5f7fa;
	overflow: hidden;
}

.drawer-summary-main {
	display: flex;
	min-width: 0;
	flex: 1;
	flex-direction: column;
	gap: 7px;
}

.drawer-product-name {
	font-size: 14px;
	line-height: 1.45;
	color: var(--el-text-color-primary);
	word-break: break-word;
}

.drawer-product-identities {
	display: flex;
	flex-wrap: wrap;
	gap: 6px 16px;
	font-size: 12px;
	color: var(--el-text-color-regular);
}

.drawer-summary-status {
	display: flex;
	min-width: 130px;
	flex-direction: column;
	align-items: flex-end;
	gap: 7px;
}

.drawer-summary-status span {
	padding: 4px 8px;
	border-radius: 999px;
	background: var(--el-color-danger-light-9);
	font-size: 12px;
	color: var(--el-color-danger);
}

.drawer-collapse {
	border-top: 0;
	border-bottom: 0;
}

.document-lock-alert {
	margin-bottom: 10px;
	border-radius: 10px;
}

.drawer-collapse :deep(.el-collapse-item) {
	margin-bottom: 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 12px;
	background: #fff;
	overflow: hidden;
}

.drawer-collapse :deep(.el-collapse-item__header) {
	height: auto;
	min-height: 54px;
	padding: 9px 14px;
	border-bottom: 0;
	background: #fff;
}

.drawer-collapse :deep(.el-collapse-item__wrap) {
	border-bottom: 0;
}

.drawer-collapse :deep(.el-collapse-item__content) {
	padding: 0 12px 12px;
}

.collapse-title {
	display: flex;
	min-width: 0;
	flex-direction: column;
	gap: 2px;
	line-height: 1.4;
}

.collapse-title strong {
	font-size: 14px;
	color: var(--el-text-color-primary);
}

.collapse-title span {
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.process-readonly-hint {
	padding: 14px;
	border-radius: 10px;
	background: #f5f7fa;
	font-size: 13px;
	color: var(--el-text-color-secondary);
}

.document-section,
.drawer-section {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 14px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 12px;
	background: #fff;
	box-shadow: 0 6px 18px rgb(31 45 61 / 4%);
	animation: drawer-section-in 0.22s ease both;
	transition:
		border-color 0.18s ease,
		box-shadow 0.18s ease,
		transform 0.18s ease;
}

.document-section:hover {
	transform: translateY(-1px);
	box-shadow: 0 10px 26px rgb(31 45 61 / 7%);
}

.input-section {
	border-color: rgba(103, 194, 58, 0.38);
	background: linear-gradient(180deg, rgba(240, 249, 235, 0.78), #fff 48%);
}

.final-confirm-section {
	border-color: rgba(230, 162, 60, 0.36);
	background: linear-gradient(180deg, rgba(253, 246, 236, 0.86), #fff 48%);
}

.final-confirm-section.ready {
	border-color: rgba(64, 158, 255, 0.42);
	background: linear-gradient(180deg, rgba(236, 245, 255, 0.9), #fff 48%);
}

.section-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
}

.section-head.compact {
	align-items: center;
}

.section-title {
	font-size: 14px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.section-desc {
	margin-top: 4px;
	font-size: 12px;
	line-height: 1.45;
	color: var(--el-text-color-secondary);
}

.section-tags {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 6px;
}

.info-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 10px;
}

.info-card {
	display: flex;
	min-height: 66px;
	flex-direction: column;
	justify-content: center;
	gap: 6px;
	padding: 10px 12px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 10px;
	background: #f8fafc;
}

.info-card.wide {
	grid-column: span 2;
}

.info-card span,
.readonly-field span,
.flow-item span {
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.info-card strong,
.readonly-field strong,
.flow-item strong {
	font-size: 13px;
	font-weight: 600;
	line-height: 1.45;
	color: var(--el-text-color-primary);
	word-break: break-word;
}

.exception-detail-grid,
.process-form-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;
}

.exception-detail-card,
.process-form-card {
	display: flex;
	min-height: 190px;
	flex-direction: column;
	gap: 12px;
	padding: 13px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 12px;
	background: #fff;
	transition:
		border-color 0.18s ease,
		box-shadow 0.18s ease,
		transform 0.18s ease;
}

.exception-detail-card.empty {
	opacity: 0.72;
	background: #fafafa;
}

.exception-detail-card:hover,
.process-form-card:hover {
	transform: translateY(-1px);
	box-shadow: 0 8px 20px rgb(31 45 61 / 6%);
}

.process-form-card.done {
	background: #f7fbf5;
	border-color: rgba(103, 194, 58, 0.32);
}

.process-form-card.editing {
	background: #f5f9ff;
	border-color: rgba(64, 158, 255, 0.34);
}

.process-result-panel,
.process-editor-panel {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 10px;
}

.process-result-meta {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 10px;
}

.readonly-field.compact {
	min-height: 0;
}

.exception-card-head,
.form-card-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 10px;
}

.exception-name,
.form-card-title {
	font-size: 14px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.exception-qty,
.form-card-desc {
	margin-top: 4px;
	font-size: 12px;
	line-height: 1.45;
	color: var(--el-text-color-secondary);
}

.readonly-field {
	display: flex;
	min-height: 54px;
	flex-direction: column;
	gap: 6px;
	padding: 9px 10px;
	border-radius: 8px;
	background: #f8fafc;
}

.flow-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 10px;
}

.flow-item {
	display: flex;
	min-height: 64px;
	flex-direction: column;
	justify-content: center;
	gap: 4px;
	padding: 10px 12px;
	border-radius: 10px;
	background: #f8fafc;
}

.flow-item.wide {
	grid-column: span 1;
}

.flow-item em {
	font-size: 12px;
	font-style: normal;
	color: var(--el-text-color-secondary);
}

.pending-confirm-hint {
	padding: 9px 11px;
	border-radius: 8px;
	background: rgba(230, 162, 60, 0.12);
	color: var(--el-color-warning-dark-2);
	font-size: 13px;
}

.action-footer {
	margin-top: auto;
	display: flex;
	justify-content: flex-end;
}

@keyframes drawer-section-in {
	from {
		opacity: 0;
		transform: translateY(8px);
	}

	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@media (max-width: 1280px) {
	.metric-chips {
		width: 100%;
		margin-left: 0;
	}

	.product-purchase-cell {
		min-width: 360px;
	}

	.source-detail-grid,
	.info-grid,
	.exception-detail-grid,
	.process-form-grid,
	.flow-grid {
		grid-template-columns: 1fr;
	}

	.source-detail-panel {
		padding-left: 14px;
	}

	.drawer-product-summary {
		flex-wrap: wrap;
	}

	.drawer-summary-status {
		width: 100%;
		flex-direction: row;
		align-items: center;
	}

	.info-card.wide,
	.flow-item.wide {
		grid-column: span 1;
	}

	.filter-keyword {
		width: 100%;
	}

	.filter-small,
	.filter-store {
		width: 100%;
	}
}
</style>
