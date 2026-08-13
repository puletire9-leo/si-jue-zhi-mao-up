<template>
	<div class="logistics-workbench">
		<div class="page-head">
			<div>
				<div class="page-title">物流工作台</div>
				<div class="page-subtitle">处理采购单包裹、快递100查询、手机号补充和人工判断物流。</div>
			</div>
			<div class="head-actions">
				<el-input
					v-model="packageState.keyWord"
					placeholder="采购单 / 运单号 / 原始公司 / 编码"
					clearable
					@keyup.enter="refreshPackages"
				>
					<template #prefix>
						<el-icon><Search /></el-icon>
					</template>
				</el-input>
				<el-button :icon="Refresh" :loading="loadingAll" @click="refreshAll">刷新列表</el-button>
				<el-button :icon="Setting" plain @click="openWarehouseDrawer">仓库联系人</el-button>
				<el-button :icon="Setting" plain @click="openCarrierPhoneRuleDrawer">手机号规则</el-button>
				<el-button :icon="Setting" plain @click="openRulesDrawer">例外规则</el-button>
				<el-button :icon="DataAnalysis" plain @click="openStatsDialog">调用统计</el-button>
			</div>
		</div>

		<div class="status-grid">
			<button
				v-for="item in packageScopes"
				:key="item.value"
				class="status-card"
				:class="{ active: activeScope === item.value }"
				@click="selectScope(item.value)"
			>
				<span>{{ item.label }}</span>
				<strong>{{ packageCounts[item.value] ?? "-" }}</strong>
			</button>
		</div>

		<section class="panel">
			<div class="panel-head">
				<div>
					<div class="panel-title">{{ activeScopeLabel }}</div>
					<div class="hint">共 {{ packageState.pagination.total }} 个包裹</div>
				</div>
				<div class="panel-actions">
					<el-button
						type="success"
						:icon="Promotion"
						:loading="batchQuerying"
						:disabled="selectedPackageRows.length === 0"
						@click="querySelectedPackages"
					>
						刷新选中物流<span v-if="selectedPackageRows.length">（{{ selectedPackageRows.length }}）</span>
					</el-button>
					<el-button
						type="warning"
						plain
						:icon="Promotion"
						:loading="batchQuerying"
						:disabled="packageState.pagination.total === 0"
						@click="queryFilteredPackages"
					>
						刷新当前筛选
					</el-button>
					<el-button :icon="Refresh" :loading="packageState.loading" @click="refreshPackages">刷新列表</el-button>
				</div>
			</div>

			<el-table
				:data="packageState.rows"
				v-loading="packageState.loading"
				row-key="id"
				border
				height="620"
				highlight-current-row
				@selection-change="handlePackageSelectionChange"
			>
				<el-table-column type="selection" width="48" fixed="left" />
				<el-table-column label="商品" min-width="300">
					<template #default="{ row }">
						<div class="product-cell">
							<div class="product-thumb">
								<el-image
									v-if="getProductImage(row)"
									:src="getProductImage(row)"
									fit="cover"
									preview-teleported
									:preview-src-list="[getProductImage(row)]"
								/>
								<div v-else class="product-thumb-empty">无图</div>
							</div>
							<div class="product-main">
								<div class="product-name" :title="getProductSummary(row).product_name || '-'">
									{{ getProductSummary(row).product_name || "-" }}
								</div>
								<div class="product-meta">
									<span>SKU：{{ getProductSummary(row).sku || "-" }}</span>
									<span>MSKU：{{ getProductSummary(row).msku_text || "-" }}</span>
								</div>
								<div class="product-tags">
									<el-popover
										v-if="productRows(row).length"
										placement="right"
										trigger="hover"
										:width="440"
										popper-class="logistics-product-popover"
									>
										<template #reference>
											<el-tag size="small" type="primary" class="product-count-tag" @click.stop="openPackageDetail(row, 'products')">
												查看 {{ row.product_count || productRows(row).length }} 个产品
											</el-tag>
										</template>
										<div class="product-preview">
											<div class="product-preview-title">采购单关联产品</div>
											<div
												v-for="(item, index) in productPreviewRows(row)"
												:key="`${item.id || item.item_id || item.sku || item.product_name || 'product'}-${index}`"
												class="product-preview-item"
											>
												<div class="product-preview-thumb">
													<el-image v-if="getProductItemImage(item)" :src="getProductItemImage(item)" fit="cover" />
													<div v-else class="product-preview-empty">无图</div>
												</div>
												<div class="product-preview-main">
													<div class="product-preview-name" :title="item.product_name || '-'">
														{{ item.product_name || "-" }}
													</div>
													<div class="product-preview-meta">
														SKU：{{ item.sku || "-" }} / MSKU：{{ item.msku_text || "-" }}
													</div>
													<div class="product-preview-meta">
														采购计划：{{ formatPlanSns(item.plan_sns) }}，待到货 {{ item.quantity_receive || 0 }}
													</div>
												</div>
											</div>
											<div v-if="getRemainingProductCount(row) > 0" class="product-preview-more">
												还有 {{ getRemainingProductCount(row) }} 条，点详情查看完整关联产品
											</div>
										</div>
									</el-popover>
									<el-tag v-else size="small" type="info">暂无产品明细</el-tag>
									<el-tag v-if="getPlanCount(row) > 1" size="small" type="info">
										{{ getPlanCount(row) }} 个采购计划
									</el-tag>
								</div>
							</div>
						</div>
					</template>
				</el-table-column>
				<el-table-column label="采购信息" min-width="260">
					<template #default="{ row }">
						<div class="purchase-cell">
							<div class="mono strong">{{ row.order_sn || "-" }}</div>
							<div class="purchase-line">采购计划：{{ getPlanDisplayText(row) }}</div>
							<div class="purchase-line">
								{{ getSupplierText(row) }} / {{ getWarehouseText(row) }}
							</div>
							<div class="purchase-line">
								物流仓库：{{ getPackageWarehouseText(row) }}
								<el-tag v-if="row.warehouse_wid" size="small" type="info">
									{{ row.warehouse_contact_count || 0 }} 个联系人
								</el-tag>
							</div>
							<el-tooltip content="待到货 = 采购单明细里的 quantity_receive，不是物流状态" placement="top">
								<div class="quantity-grid">
									<span><em>计划采购</em><b>{{ getProductSummary(row).quantity_plan || 0 }}</b></span>
									<span><em>实际采购</em><b>{{ getProductSummary(row).quantity_real || 0 }}</b></span>
									<span><em>已入库</em><b>{{ getProductSummary(row).quantity_entry || 0 }}</b></span>
									<span><em>待到货</em><b>{{ getProductSummary(row).quantity_receive || 0 }}</b></span>
								</div>
							</el-tooltip>
						</div>
					</template>
				</el-table-column>
				<el-table-column label="运单" min-width="260">
					<template #default="{ row }">
						<div class="tracking-cell">
							<div class="mono strong">{{ row.tracking_no || "-" }}</div>
							<div class="tracking-company">
								{{ row.raw_company_name || row.company_name || "-" }}
								<el-tag v-if="sourceRows(row).length > 1" size="small" type="info">
									来源 {{ sourceRows(row).length }}
								</el-tag>
							</div>
							<div class="tracking-company">
								快递100：{{ row.company_name || "-" }}
								<span v-if="row.company_code">（{{ row.company_code }}）</span>
							</div>
						</div>
					</template>
				</el-table-column>
				<el-table-column label="物流状态" min-width="260">
					<template #default="{ row }">
						<div class="status-cell">
							<div class="status-tags">
								<el-tag :type="getPackageStatusTag(row.status)" size="small">
									{{ getPackageStatusText(row.status) }}
								</el-tag>
								<el-tag :type="getQueryModeTag(row.query_mode)" size="small">
									{{ getQueryModeText(row.query_mode) }}
								</el-tag>
								<el-tag :type="getPhoneTag(row)" size="small">{{ getPhoneText(row) }}</el-tag>
							</div>
							<div class="trace-line" :title="latestTraceText(row)">{{ latestTraceText(row) }}</div>
							<div v-if="Number(row.phone_required) === 1" class="query-line">
								手机号来源：{{ getPhoneSourceText(row) }}
							</div>
							<div class="query-line">{{ getPackageHint(row) }}</div>
						</div>
					</template>
				</el-table-column>
				<el-table-column label="时间" width="190">
					<template #default="{ row }">
							<div class="time-cell">
								<div>更新：{{ formatDateTime(row.updateTime) }}</div>
								<div>上查：{{ formatDateTime(row.last_query_time) }}</div>
								<div>下次：{{ getNextQueryAfterText(row) }}</div>
							</div>
						</template>
					</el-table-column>
				<el-table-column label="操作" width="270" fixed="right">
					<template #default="{ row }">
						<div class="row-actions">
							<el-tooltip :content="getPackageQueryTip(row)" placement="top">
								<span>
									<el-button
										type="success"
										link
										:icon="Promotion"
										:disabled="!row.can_query"
										:loading="queryingPackageId === Number(row.id)"
										@click="queryPackage(row)"
									>
										查询物流
									</el-button>
								</span>
							</el-tooltip>
							<el-button
								v-if="Number(row.phone_required) === 1"
								type="primary"
								link
								:icon="EditPen"
								@click="openPhoneDialog(row)"
							>
								手动手机号
							</el-button>
							<el-button type="primary" link :icon="EditPen" @click="openCompanyDialog(row)">
								改编码
							</el-button>
							<el-button type="primary" link :icon="View" @click="openPackageDetail(row)">详情</el-button>
						</div>
					</template>
				</el-table-column>
			</el-table>

			<div class="pagination-row">
				<el-pagination
					background
					layout="total, sizes, prev, pager, next"
					:page-sizes="[10, 20, 50]"
					v-model:current-page="packageState.pagination.page"
					v-model:page-size="packageState.pagination.size"
					:total="packageState.pagination.total"
					@size-change="refreshPackages"
					@current-change="refreshPackages"
				/>
			</div>
		</section>

		<el-drawer v-model="detailDrawer.visible" title="包裹详情" size="860px" @closed="detailDrawer.package = null">
			<div v-if="detailDrawer.package" class="detail-drawer">
				<el-tabs v-model="detailDrawer.activeTab">
					<el-tab-pane label="包裹信息" name="base">
						<el-descriptions :column="2" border>
							<el-descriptions-item label="采购单">{{ detailDrawer.package.order_sn || "-" }}</el-descriptions-item>
							<el-descriptions-item label="运单号">{{ detailDrawer.package.tracking_no || "-" }}</el-descriptions-item>
							<el-descriptions-item label="原始物流公司">{{ detailDrawer.package.raw_company_name || "-" }}</el-descriptions-item>
							<el-descriptions-item label="来源数量">{{ sourceRows(detailDrawer.package).length || 1 }} 条</el-descriptions-item>
							<el-descriptions-item label="采购仓库">{{ getPackageWarehouseText(detailDrawer.package) }}</el-descriptions-item>
							<el-descriptions-item label="仓库联系人">{{ detailDrawer.package.warehouse_contact_count || 0 }} 个启用</el-descriptions-item>
							<el-descriptions-item label="识别快递公司">{{ detailDrawer.package.company_name || "-" }}</el-descriptions-item>
							<el-descriptions-item label="快递100编码">{{ detailDrawer.package.company_code || "-" }}</el-descriptions-item>
							<el-descriptions-item label="编码来源">{{ getCompanySourceText(detailDrawer.package.company_code_source) }}</el-descriptions-item>
							<el-descriptions-item label="查询方式">{{ getQueryModeText(detailDrawer.package.query_mode) }}</el-descriptions-item>
							<el-descriptions-item label="包裹状态">{{ getPackageStatusText(detailDrawer.package.status) }}</el-descriptions-item>
							<el-descriptions-item label="查询状态">{{ getPackageHint(detailDrawer.package) }}</el-descriptions-item>
							<el-descriptions-item label="手机号">{{ getPhoneText(detailDrawer.package) }}</el-descriptions-item>
							<el-descriptions-item label="手机号来源">{{ getPhoneSourceText(detailDrawer.package) }}</el-descriptions-item>
							<el-descriptions-item label="匹配联系人">{{ detailDrawer.package.matched_contact_name || "-" }}</el-descriptions-item>
							<el-descriptions-item label="服务状态">{{ getProviderStateText(detailDrawer.package) }}</el-descriptions-item>
							<el-descriptions-item label="更新时间">{{ formatDateTime(detailDrawer.package.updateTime) }}</el-descriptions-item>
							<el-descriptions-item label="上次查询">{{ formatDateTime(detailDrawer.package.last_query_time) }}</el-descriptions-item>
							<el-descriptions-item label="下次可查">{{ getNextQueryAfterText(detailDrawer.package) }}</el-descriptions-item>
							<el-descriptions-item label="查询次数">{{ detailDrawer.package.query_count || 0 }}</el-descriptions-item>
							<el-descriptions-item label="失败次数">{{ detailDrawer.package.error_count || 0 }}</el-descriptions-item>
							<el-descriptions-item label="失败原因" :span="2">
								{{ detailDrawer.package.last_error_message || detailDrawer.package.provider_message || "-" }}
							</el-descriptions-item>
						</el-descriptions>
					</el-tab-pane>

					<el-tab-pane label="关联产品" name="products">
						<el-alert
							class="product-relation-alert"
							type="info"
							show-icon
							:closable="false"
							title="包裹按采购单 + 运单号归并，下面是该采购单关联产品，不代表每个产品都一定在这个包裹里。"
						/>
						<el-table :data="productRows(detailDrawer.package)" border height="420">
							<el-table-column label="图片" width="78">
								<template #default="{ row }">
									<el-image
										v-if="getProductItemImage(row)"
										:src="getProductItemImage(row)"
										fit="cover"
										class="detail-product-image"
										preview-teleported
										:preview-src-list="[getProductItemImage(row)]"
									/>
									<div v-else class="detail-product-empty">无图</div>
								</template>
							</el-table-column>
							<el-table-column label="产品" min-width="240" show-overflow-tooltip>
								<template #default="{ row }">
									<div class="detail-product-name">{{ row.product_name || "-" }}</div>
									<div class="detail-product-meta">SKU：{{ row.sku || "-" }}</div>
									<div class="detail-product-meta">MSKU：{{ row.msku_text || "-" }}</div>
								</template>
							</el-table-column>
							<el-table-column label="采购计划" min-width="170" show-overflow-tooltip>
								<template #default="{ row }">{{ formatPlanSns(row.plan_sns) }}</template>
							</el-table-column>
							<el-table-column label="计划采购" width="92" align="right">
								<template #default="{ row }">{{ row.quantity_plan || 0 }}</template>
							</el-table-column>
							<el-table-column label="实际采购" width="92" align="right">
								<template #default="{ row }">{{ row.quantity_real || 0 }}</template>
							</el-table-column>
							<el-table-column label="已入库" width="86" align="right">
								<template #default="{ row }">{{ row.quantity_entry || 0 }}</template>
							</el-table-column>
							<el-table-column label="待到货" width="86" align="right">
								<template #default="{ row }">{{ row.quantity_receive || 0 }}</template>
							</el-table-column>
						</el-table>
						<el-empty v-if="!productRows(detailDrawer.package).length" description="暂无关联产品" />
					</el-tab-pane>

					<el-tab-pane label="来源明细" name="sources">
						<el-table :data="sourceRows(detailDrawer.package)" border height="420">
							<el-table-column label="#" width="60">
								<template #default="{ $index }">{{ $index + 1 }}</template>
							</el-table-column>
							<el-table-column label="原始物流公司" min-width="170" show-overflow-tooltip>
								<template #default="{ row }">{{ getSourceCompany(row) || "-" }}</template>
							</el-table-column>
							<el-table-column label="pol_id" min-width="170" show-overflow-tooltip>
								<template #default="{ row }">{{ getSourcePolId(row) || "-" }}</template>
							</el-table-column>
							<el-table-column label="运单号" min-width="180" show-overflow-tooltip>
								<template #default="{ row }">{{ getSourceTrackingNo(row) || "-" }}</template>
							</el-table-column>
							<el-table-column label="来源类型" width="110">
								<template #default="{ row }">
									<el-tag :type="row.is_exception_source ? 'info' : 'success'" size="small">
										{{ row.is_exception_source ? "例外来源" : "查询来源" }}
									</el-tag>
								</template>
							</el-table-column>
						</el-table>
						<el-empty v-if="!sourceRows(detailDrawer.package).length" description="暂无来源明细" />
					</el-tab-pane>

					<el-tab-pane label="物流轨迹" name="trace">
						<el-timeline v-if="traceRows(detailDrawer.package).length">
							<el-timeline-item
								v-for="(trace, index) in traceRows(detailDrawer.package)"
								:key="index"
								:timestamp="trace.accept_time || trace.time || trace.ftime"
								:type="index === 0 ? 'primary' : 'info'"
								:hollow="index !== 0"
							>
								{{ trace.remark || trace.context || "-" }}
							</el-timeline-item>
						</el-timeline>
						<el-empty v-else description="暂无轨迹" />
					</el-tab-pane>

					<el-tab-pane label="智能识别" name="identify">
						<div class="detail-action-row">
							<el-button
								type="primary"
								:icon="MagicStick"
								:loading="identifyingPackageId === Number(detailDrawer.package.id)"
								@click="identifyPackage(detailDrawer.package)"
							>
								重新识别
							</el-button>
							<span class="detail-action-tip">普通查询会自动识别；这里仅用于识别失败或需要人工复查时强制重识别。</span>
						</div>
						<el-descriptions :column="2" border>
							<el-descriptions-item label="识别状态">{{ getIdentifyText(detailDrawer.package.identify_status) }}</el-descriptions-item>
							<el-descriptions-item label="识别时间">{{ formatDateTime(detailDrawer.package.identify_time) }}</el-descriptions-item>
							<el-descriptions-item label="错误码">{{ detailDrawer.package.identify_error_code || "-" }}</el-descriptions-item>
							<el-descriptions-item label="错误信息">{{ detailDrawer.package.identify_error_message || "-" }}</el-descriptions-item>
						</el-descriptions>
						<pre class="raw-json">{{ JSON.stringify(detailDrawer.package.identify_candidates_json || [], null, 2) }}</pre>
					</el-tab-pane>

					<el-tab-pane label="原始响应" name="raw">
						<pre class="raw-json">{{ JSON.stringify(detailDrawer.package.raw_response_json || {}, null, 2) }}</pre>
					</el-tab-pane>

					<el-tab-pane label="调用日志" name="logs">
						<el-table :data="detailDrawer.logs" v-loading="detailDrawer.loadingLogs" border height="420">
							<el-table-column prop="provider" label="接口" width="150" />
							<el-table-column label="成功" width="80">
								<template #default="{ row }">
									<el-tag :type="Number(row.success) === 1 ? 'success' : 'danger'" size="small">
										{{ Number(row.success) === 1 ? "成功" : "失败" }}
									</el-tag>
								</template>
							</el-table-column>
							<el-table-column prop="return_code" label="返回码" width="110" />
							<el-table-column prop="message" label="消息" min-width="220" show-overflow-tooltip />
							<el-table-column prop="duration_ms" label="耗时ms" width="95" />
							<el-table-column label="时间" width="165">
								<template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
							</el-table-column>
						</el-table>
					</el-tab-pane>

					<el-tab-pane label="手机号匹配" name="phoneAttempts">
						<el-table :data="detailDrawer.phoneAttempts" v-loading="detailDrawer.loadingPhoneAttempts" border height="420">
							<el-table-column prop="warehouse_wid" label="仓库ID" width="100" />
							<el-table-column label="联系人" min-width="150" show-overflow-tooltip>
								<template #default="{ row }">
									{{ row.contact_name || `联系人ID ${row.contact_id || "-"}` }}
								</template>
							</el-table-column>
							<el-table-column prop="contact_phone_masked" label="手机号" width="130" />
							<el-table-column prop="company_code" label="快递编码" width="120" />
							<el-table-column label="结果" width="90">
								<template #default="{ row }">
									<el-tag :type="Number(row.success) === 1 ? 'success' : 'danger'" size="small">
										{{ Number(row.success) === 1 ? "成功" : "失败" }}
									</el-tag>
								</template>
							</el-table-column>
							<el-table-column prop="return_code" label="返回码" width="110" />
							<el-table-column prop="message" label="消息" min-width="220" show-overflow-tooltip />
							<el-table-column label="时间" width="165">
								<template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
							</el-table-column>
						</el-table>
					</el-tab-pane>
				</el-tabs>
			</div>
		</el-drawer>

		<el-dialog
			v-model="warehouseDrawer.visible"
			title="仓库联系人配置"
			width="1180px"
			append-to-body
			destroy-on-close
		>
			<div class="config-toolbar">
				<el-input
					v-model="warehouseDrawer.keyWord"
					placeholder="搜索仓库名 / 仓库ID"
					clearable
					style="width: 260px"
					@keyup.enter="loadWarehouses"
				/>
				<el-select v-model="warehouseDrawer.cloudStatus" clearable placeholder="云端状态" style="width: 130px">
					<el-option label="正常" value="active" />
					<el-option label="云端已移除" value="removed" />
				</el-select>
				<el-select v-model="warehouseDrawer.warehouseType" clearable placeholder="仓库类型" style="width: 130px">
					<el-option label="本地仓" value="local" />
					<el-option label="海外仓" value="overseas" />
					<el-option label="AWD仓" value="awd" />
				</el-select>
				<el-select v-model="warehouseDrawer.contactStatus" clearable placeholder="联系人状态" style="width: 150px">
					<el-option label="已配置联系人" value="has_contact" />
					<el-option label="未配置联系人" value="no_contact" />
				</el-select>
				<el-button :icon="Refresh" :loading="warehouseDrawer.loading" @click="loadWarehouses">刷新</el-button>
				<el-button type="primary" :icon="Refresh" :loading="warehouseDrawer.syncing" @click="syncWarehouses">
					从领星更新仓库
				</el-button>
			</div>
			<div class="config-help">
				联系人只维护一份，可以绑定到多个仓库；快递100需要手机号时会按仓库绑定的优先级尝试。
			</div>

			<el-tabs v-model="warehouseDrawer.activeTab" class="warehouse-contact-tabs" @tab-change="handleWarehouseTabChange">
				<el-tab-pane label="按仓库查看" name="warehouse">
					<div class="mini-action-row">
						<el-button
							type="primary"
							:disabled="warehouseDrawer.selectedRows.length === 0"
							@click="openBatchBindContactDialog"
						>
							批量绑定联系人
						</el-button>
						<span class="hint">已选 {{ warehouseDrawer.selectedRows.length }} 个仓库</span>
					</div>
					<el-table
						:data="warehouseDrawer.rows"
						v-loading="warehouseDrawer.loading"
						border
						height="430"
						highlight-current-row
						class="config-table"
						@selection-change="handleWarehouseSelectionChange"
					>
						<el-table-column type="selection" width="44" />
						<el-table-column prop="wid" label="仓库ID" width="95" />
						<el-table-column prop="warehouse_name" label="仓库名称" min-width="180" show-overflow-tooltip />
						<el-table-column label="类型" width="95">
							<template #default="{ row }">{{ getWarehouseTypeText(row.warehouse_type) }}</template>
						</el-table-column>
						<el-table-column label="联系人" min-width="280">
							<template #default="{ row }">
								<div v-if="row.contact_summary?.length" class="contact-chip-line">
									<el-tag
										v-for="item in row.contact_summary.slice(0, 2)"
										:key="item.binding_id"
										size="small"
										type="info"
									>
										{{ item.contact_name || "未命名" }} {{ item.contact_phone_masked }}
									</el-tag>
									<el-tag v-if="row.contact_summary.length > 2" size="small">
										+{{ row.contact_summary.length - 2 }}
									</el-tag>
								</div>
								<el-tag v-else type="warning" size="small">未配置联系人</el-tag>
							</template>
						</el-table-column>
						<el-table-column label="云端状态" width="110">
							<template #default="{ row }">
								<el-tag :type="row.cloud_status === 'removed' ? 'danger' : 'success'" size="small">
									{{ row.cloud_status === "removed" ? "云端已移除" : "正常" }}
								</el-tag>
							</template>
						</el-table-column>
						<el-table-column label="最近同步" width="165">
							<template #default="{ row }">{{ formatDateTime(row.last_seen_time) }}</template>
						</el-table-column>
						<el-table-column label="操作" width="110" fixed="right">
							<template #default="{ row }">
								<el-button type="primary" link @click.stop="openWarehouseContactManager(row)">管理联系人</el-button>
							</template>
						</el-table-column>
					</el-table>
					<div class="pagination-row">
						<el-pagination
							background
							layout="total, prev, pager, next"
							v-model:current-page="warehouseDrawer.pagination.page"
							:page-size="warehouseDrawer.pagination.size"
							:total="warehouseDrawer.pagination.total"
							@current-change="loadWarehouses"
						/>
					</div>
				</el-tab-pane>
				<el-tab-pane label="按联系人管理" name="contact">
					<div class="mini-action-row">
						<el-input
							v-model="contactState.keyWord"
							placeholder="搜索联系人 / 手机号"
							clearable
							style="width: 260px"
							@keyup.enter="loadContacts"
						/>
						<el-select v-model="contactState.enabled" clearable placeholder="状态" style="width: 120px">
							<el-option label="启用" :value="1" />
							<el-option label="停用" :value="0" />
						</el-select>
						<el-button :icon="Refresh" :loading="contactState.loading" @click="loadContacts">刷新</el-button>
						<el-button type="primary" :icon="EditPen" @click="openContactDialog()">新增联系人</el-button>
					</div>
					<el-table :data="contactState.rows" v-loading="contactState.loading" border height="430" class="config-table">
						<el-table-column prop="contact_name" label="联系人" min-width="120" show-overflow-tooltip />
						<el-table-column prop="contact_phone" label="手机号" width="150" show-overflow-tooltip />
						<el-table-column label="绑定仓库" min-width="260">
							<template #default="{ row }">
								<div v-if="row.warehouse_summary?.length" class="contact-chip-line">
									<el-tag
										v-for="item in row.warehouse_summary.slice(0, 3)"
										:key="item.warehouse_wid"
										size="small"
										type="info"
									>
										{{ item.warehouse_name }}
									</el-tag>
									<el-tag v-if="row.warehouse_count > 3" size="small">+{{ row.warehouse_count - 3 }}</el-tag>
								</div>
								<el-tag v-else type="warning" size="small">未绑定仓库</el-tag>
							</template>
						</el-table-column>
						<el-table-column label="状态" width="90">
							<template #default="{ row }">
								<el-tag :type="Number(row.enabled) === 1 ? 'success' : 'info'" size="small">
									{{ Number(row.enabled) === 1 ? "启用" : "停用" }}
								</el-tag>
							</template>
						</el-table-column>
						<el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
						<el-table-column label="操作" width="200" fixed="right">
							<template #default="{ row }">
								<el-button type="primary" link @click="openBindWarehouseDialog(row)">关联仓库</el-button>
								<el-button type="primary" link @click="openContactDialog(row)">编辑</el-button>
								<el-button type="danger" link @click="disableContact(row)">停用</el-button>
							</template>
						</el-table-column>
					</el-table>
					<div class="pagination-row">
						<el-pagination
							background
							layout="total, prev, pager, next"
							v-model:current-page="contactState.pagination.page"
							:page-size="contactState.pagination.size"
							:total="contactState.pagination.total"
							@current-change="loadContacts"
						/>
					</div>
				</el-tab-pane>
			</el-tabs>
		</el-dialog>

		<el-dialog
			v-model="phoneRuleDrawer.visible"
			title="快递手机号规则"
			width="820px"
			append-to-body
			destroy-on-close
		>
			<div class="config-toolbar">
				<el-input v-model="phoneRuleDrawer.keyWord" placeholder="搜索快递编码 / 名称" clearable style="width: 240px" @keyup.enter="loadCarrierPhoneRules" />
				<el-button :icon="Refresh" :loading="phoneRuleDrawer.loading" @click="loadCarrierPhoneRules">刷新</el-button>
				<el-button type="primary" :icon="EditPen" @click="openCarrierPhoneRuleDialog()">新增规则</el-button>
			</div>
			<div class="config-help">
				这里只配置“哪些快递查询时需要手机号”。新增时的快递选项来自已有规则和系统已识别包裹，按快递100编码去重。
			</div>
			<el-table :data="phoneRuleDrawer.rows" v-loading="phoneRuleDrawer.loading" border height="520" class="config-table">
				<el-table-column prop="company_code" label="快递100编码" width="150" />
				<el-table-column prop="company_name" label="快递公司" min-width="160" show-overflow-tooltip />
				<el-table-column label="手机号" width="120">
					<template #default="{ row }">
						<el-tag :type="Number(row.need_phone) === 1 ? 'warning' : 'info'" size="small">
							{{ Number(row.need_phone) === 1 ? "需要" : "不需要" }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="启用" width="90">
					<template #default="{ row }">
						<el-tag :type="Number(row.enabled) === 1 ? 'success' : 'info'" size="small">
							{{ Number(row.enabled) === 1 ? "启用" : "停用" }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column prop="remark" label="备注" min-width="170" show-overflow-tooltip />
				<el-table-column label="操作" width="80" fixed="right">
					<template #default="{ row }">
						<el-button type="primary" link @click="openCarrierPhoneRuleDialog(row)">编辑</el-button>
					</template>
				</el-table-column>
			</el-table>
		</el-dialog>

		<el-dialog
			v-model="warehouseContactDialog.visible"
			:title="warehouseContactDialog.form.id ? '编辑仓库绑定' : '绑定联系人到仓库'"
			width="520px"
			append-to-body
		>
			<el-form label-width="90px">
				<el-form-item label="仓库">
					<span class="readonly-text">
						{{ warehouseManageDialog.warehouse?.warehouse_name || "-" }}（{{ warehouseManageDialog.warehouse?.wid || "-" }}）
					</span>
				</el-form-item>
				<el-form-item label="联系人">
					<el-input v-model="warehouseContactDialog.form.contact_name" placeholder="例如：仓库收件人" clearable />
				</el-form-item>
				<el-form-item label="手机号">
					<el-input v-model="warehouseContactDialog.form.contact_phone" placeholder="手机号或快递100校验号码" clearable />
				</el-form-item>
				<el-form-item label="优先级">
					<el-input-number
						v-model="warehouseContactDialog.form.priority"
						:min="1"
						:max="999"
						controls-position="right"
					/>
				</el-form-item>
				<el-form-item label="启用">
					<el-switch v-model="warehouseContactDialog.form.enabled" />
				</el-form-item>
				<el-form-item label="备注">
					<el-input v-model="warehouseContactDialog.form.remark" type="textarea" :rows="2" placeholder="备注" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="warehouseContactDialog.visible = false">取消</el-button>
				<el-button type="primary" :loading="warehouseContactDialog.saving" @click="saveWarehouseContact">
					保存
				</el-button>
			</template>
		</el-dialog>

		<el-dialog
			v-model="warehouseManageDialog.visible"
			:title="`管理联系人 - ${warehouseManageDialog.warehouse?.warehouse_name || ''}`"
			width="820px"
			append-to-body
		>
			<div class="config-help">
				快递100需要手机号时，会按优先级从小到大尝试；只有 408 手机号校验失败才继续试下一个联系人。
			</div>
			<div class="mini-action-row">
				<el-button type="primary" :icon="EditPen" @click="openWarehouseContactDialog()">绑定联系人</el-button>
			</div>
			<el-table :data="warehouseManageDialog.contacts" v-loading="warehouseManageDialog.loading" border height="360">
				<el-table-column prop="contact_name" label="联系人" min-width="120" show-overflow-tooltip />
				<el-table-column prop="contact_phone" label="手机号" width="150" show-overflow-tooltip />
				<el-table-column prop="priority" label="优先级" width="90" />
				<el-table-column label="绑定状态" width="100">
					<template #default="{ row }">
						<el-tag :type="Number(row.enabled) === 1 ? 'success' : 'info'" size="small">
							{{ Number(row.enabled) === 1 ? "启用" : "停用" }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="联系人状态" width="100">
					<template #default="{ row }">
						<el-tag :type="Number(row.contact_enabled) === 1 ? 'success' : 'info'" size="small">
							{{ Number(row.contact_enabled) === 1 ? "启用" : "停用" }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column prop="remark" label="绑定备注" min-width="150" show-overflow-tooltip />
				<el-table-column label="操作" width="120" fixed="right">
					<template #default="{ row }">
						<el-button type="primary" link @click="openWarehouseContactDialog(row)">编辑</el-button>
						<el-button type="danger" link @click="deleteWarehouseContact(row)">移除</el-button>
					</template>
				</el-table-column>
			</el-table>
		</el-dialog>

		<el-dialog
			v-model="contactDialog.visible"
			:title="contactDialog.form.id ? '编辑联系人' : '新增联系人'"
			width="520px"
			append-to-body
		>
			<el-form label-width="90px">
				<el-form-item label="联系人">
					<el-input v-model="contactDialog.form.contact_name" placeholder="例如：张三" clearable />
				</el-form-item>
				<el-form-item label="手机号">
					<el-input v-model="contactDialog.form.contact_phone" placeholder="手机号或快递100校验号码" clearable />
				</el-form-item>
				<el-form-item label="启用">
					<el-switch v-model="contactDialog.form.enabled" />
				</el-form-item>
				<el-form-item label="备注">
					<el-input v-model="contactDialog.form.remark" type="textarea" :rows="2" placeholder="备注" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="contactDialog.visible = false">取消</el-button>
				<el-button type="primary" :loading="contactDialog.saving" @click="saveContact">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog
			v-model="bindWarehouseDialog.visible"
			:title="`关联仓库 - ${bindWarehouseDialog.contact?.contact_name || bindWarehouseDialog.contact?.contact_phone || ''}`"
			width="920px"
			append-to-body
		>
			<div class="config-toolbar">
				<el-input
					v-model="bindWarehouseDialog.keyWord"
					placeholder="搜索仓库名 / 仓库ID"
					clearable
					style="width: 240px"
					@keyup.enter="loadBindWarehouseOptions"
				/>
				<el-select v-model="bindWarehouseDialog.cloudStatus" clearable placeholder="云端状态" style="width: 130px">
					<el-option label="正常" value="active" />
					<el-option label="云端已移除" value="removed" />
				</el-select>
				<el-select v-model="bindWarehouseDialog.warehouseType" clearable placeholder="仓库类型" style="width: 130px">
					<el-option label="本地仓" value="local" />
					<el-option label="海外仓" value="overseas" />
					<el-option label="AWD仓" value="awd" />
				</el-select>
				<el-button :icon="Refresh" :loading="bindWarehouseDialog.loading" @click="loadBindWarehouseOptions">刷新</el-button>
			</div>
			<div v-if="bindWarehouseDialog.presetWarehouseRows.length" class="config-help">
				已从仓库列表带入 {{ bindWarehouseDialog.presetWarehouseRows.length }} 个仓库；也可以在下方重新勾选仓库覆盖本次选择。
			</div>
			<el-table
				:data="bindWarehouseDialog.rows"
				v-loading="bindWarehouseDialog.loading"
				border
				height="420"
				@selection-change="handleBindWarehouseSelectionChange"
			>
				<el-table-column type="selection" width="44" />
				<el-table-column prop="wid" label="仓库ID" width="95" />
				<el-table-column prop="warehouse_name" label="仓库名称" min-width="200" show-overflow-tooltip />
				<el-table-column label="类型" width="100">
					<template #default="{ row }">{{ getWarehouseTypeText(row.warehouse_type) }}</template>
				</el-table-column>
				<el-table-column label="联系人" min-width="220">
					<template #default="{ row }">
						<span v-if="row.contact_count">{{ row.contact_count }} 个联系人</span>
						<el-tag v-else type="warning" size="small">未配置联系人</el-tag>
					</template>
				</el-table-column>
			</el-table>
			<div class="pagination-row">
				<el-pagination
					background
					layout="total, prev, pager, next"
					v-model:current-page="bindWarehouseDialog.pagination.page"
					:page-size="bindWarehouseDialog.pagination.size"
					:total="bindWarehouseDialog.pagination.total"
					@current-change="loadBindWarehouseOptions"
				/>
			</div>
			<template #footer>
				<span class="hint">已选择 {{ getBindWarehouseSelectedCount() }} 个仓库</span>
				<el-button @click="bindWarehouseDialog.visible = false">取消</el-button>
				<el-button type="primary" :loading="bindWarehouseDialog.saving" @click="saveBindWarehouses">保存绑定</el-button>
			</template>
		</el-dialog>

		<el-dialog
			v-model="phoneRuleEditDialog.visible"
			:title="phoneRuleEditDialog.form.id ? '编辑手机号规则' : '新增手机号规则'"
			width="560px"
			append-to-body
		>
			<el-form label-width="110px">
				<el-form-item label="录入方式">
					<el-radio-group v-model="phoneRuleEditDialog.inputMode" @change="handlePhoneRuleModeChange">
						<el-radio-button label="select">从系统选择</el-radio-button>
						<el-radio-button label="manual">手动录入</el-radio-button>
					</el-radio-group>
				</el-form-item>
				<template v-if="phoneRuleEditDialog.inputMode === 'select'">
					<el-form-item label="选择快递公司">
						<div class="carrier-select-wrap">
							<el-select
								v-model="phoneRuleEditDialog.selectedCompanyCode"
								filterable
								remote
								clearable
								:remote-method="searchCarrierPhoneRuleOptions"
								:loading="carrierOptionState.loading"
								placeholder="搜索快递公司名称或快递100编码"
								no-data-text="暂无系统快递，可切换为手动录入"
								style="width: 100%"
								@change="handleCarrierOptionChange"
							>
								<template #prefix>
									<span class="select-prefix">选择</span>
								</template>
								<el-option
									v-for="item in carrierOptionState.options"
									:key="item.company_code"
									:label="getCarrierOptionLabel(item)"
									:value="item.company_code"
								>
									<div class="carrier-option">
										<span class="carrier-option-name">{{ item.company_name || item.company_code }}</span>
										<span class="carrier-option-code">{{ item.company_code }}</span>
										<el-tag size="small" :type="item.has_rule ? 'success' : 'info'">
											{{ item.has_rule ? "已有规则" : "系统识别" }}
										</el-tag>
										<span v-if="Number(item.package_count) > 0" class="carrier-option-count">
											{{ item.package_count }} 个包裹
										</span>
									</div>
								</el-option>
							</el-select>
							<div class="form-hint">这里是选择框，不是普通输入框；数据来自已有规则和系统已识别包裹，并按快递100编码去重。</div>
						</div>
					</el-form-item>
					<el-form-item label="已选快递">
						<div class="selected-carrier-card" :class="{ empty: !phoneRuleEditDialog.form.company_code }">
							<template v-if="phoneRuleEditDialog.form.company_code">
								<div>
									<strong>{{ phoneRuleEditDialog.form.company_name || phoneRuleEditDialog.form.company_code }}</strong>
									<span>{{ phoneRuleEditDialog.form.company_code }}</span>
								</div>
								<el-tag size="small" type="primary">将保存为手机号规则</el-tag>
							</template>
							<span v-else>请先选择一个快递公司</span>
						</div>
					</el-form-item>
				</template>
				<template v-else>
					<el-form-item label="快递100编码">
						<el-input v-model="phoneRuleEditDialog.form.company_code" placeholder="例如：shunfeng" clearable />
						<div class="form-hint">只在系统选项里没有这个快递时手动录入；编码必须是快递100官方编码。</div>
					</el-form-item>
					<el-form-item label="快递公司名称">
						<el-input v-model="phoneRuleEditDialog.form.company_name" placeholder="例如：顺丰速运" clearable />
					</el-form-item>
				</template>
				<el-form-item label="手机号">
					<el-switch
						v-model="phoneRuleEditDialog.form.need_phone"
						active-text="需要手机号"
						inactive-text="不需要"
					/>
				</el-form-item>
				<el-form-item label="启用">
					<el-switch v-model="phoneRuleEditDialog.form.enabled" />
				</el-form-item>
				<el-form-item label="备注">
					<el-input v-model="phoneRuleEditDialog.form.remark" type="textarea" :rows="2" placeholder="备注" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="phoneRuleEditDialog.visible = false">取消</el-button>
				<el-button type="primary" :loading="phoneRuleEditDialog.saving" @click="saveCarrierPhoneRule">
					保存
				</el-button>
			</template>
		</el-dialog>

		<el-drawer v-model="rulesDrawer.visible" title="例外规则" size="760px">
			<div class="rules-toolbar">
				<el-select
					v-model="rulesDrawer.form.raw_company_name"
					filterable
					remote
					clearable
					:remote-method="searchRawCompanyOptions"
					:loading="rawCompanyState.loading"
					placeholder="选择系统已有原始物流公司"
					style="width: 280px"
				>
					<el-option
						v-for="item in rawCompanyState.options"
						:key="item.raw_company_name"
						:label="`${item.raw_company_name}（${item.package_count}）`"
						:value="item.raw_company_name"
					/>
				</el-select>
				<el-radio-group v-model="rulesDrawer.form.query_mode">
					<el-radio-button label="manual_required">不查快递100，人工判断物流</el-radio-button>
					<el-radio-button label="ignored">忽略</el-radio-button>
					<el-radio-button label="disabled">停用</el-radio-button>
				</el-radio-group>
				<el-switch v-model="rulesDrawer.form.enabled" />
				<el-button type="primary" :loading="rulesDrawer.saving" @click="saveExceptionRule">保存</el-button>
			</div>
			<el-input v-model="rulesDrawer.form.remark" type="textarea" :rows="2" placeholder="备注" />

			<el-table :data="rulesDrawer.rows" v-loading="rulesDrawer.loading" border height="520" class="rules-table">
				<el-table-column prop="raw_company_name" label="原始物流公司" min-width="160" show-overflow-tooltip />
				<el-table-column label="处理方式" width="110">
					<template #default="{ row }">
						<el-tag :type="getQueryModeTag(row.query_mode)" size="small">
							{{ getQueryModeText(row.query_mode) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column prop="affected_package_count" label="影响包裹" width="95" />
				<el-table-column label="启用" width="80">
					<template #default="{ row }">
						<el-tag :type="Number(row.enabled) === 1 ? 'success' : 'info'" size="small">
							{{ Number(row.enabled) === 1 ? "启用" : "停用" }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
				<el-table-column label="操作" width="80" fixed="right">
					<template #default="{ row }">
						<el-button type="primary" link @click="editRule(row)">编辑</el-button>
					</template>
				</el-table-column>
			</el-table>
		</el-drawer>

		<el-dialog v-model="phoneDialog.visible" title="填写包裹手机号" width="460px" append-to-body>
			<el-form label-width="90px">
				<el-form-item label="采购单">
					<span class="readonly-text">{{ phoneDialog.package?.order_sn || "-" }}</span>
				</el-form-item>
				<el-form-item label="运单号">
					<span class="readonly-text">{{ phoneDialog.package?.tracking_no || "-" }}</span>
				</el-form-item>
				<el-form-item label="手机号">
					<el-input v-model="phoneDialog.contactPhone" placeholder="请输入手机号或校验号码" clearable />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="phoneDialog.visible = false">取消</el-button>
				<el-button type="primary" :loading="phoneDialog.saving" @click="savePackagePhone">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="companyDialog.visible" title="修改识别结果" width="500px" append-to-body>
			<el-form label-width="110px">
				<el-form-item label="采购单">
					<span class="readonly-text">{{ companyDialog.package?.order_sn || "-" }}</span>
				</el-form-item>
				<el-form-item label="运单号">
					<span class="readonly-text">{{ companyDialog.package?.tracking_no || "-" }}</span>
				</el-form-item>
				<el-form-item label="快递100编码">
					<el-input v-model="companyDialog.companyCode" placeholder="例如：yuantong" clearable />
				</el-form-item>
				<el-form-item label="快递公司名称">
					<el-input v-model="companyDialog.companyName" placeholder="例如：圆通速递" clearable />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="companyDialog.visible = false">取消</el-button>
				<el-button type="primary" :loading="companyDialog.saving" @click="savePackageCompany">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="statsDialog.visible" title="快递100调用统计" width="900px" append-to-body>
			<div class="stats-toolbar">
				<el-date-picker
					v-model="statsDialog.dateRange"
					type="daterange"
					value-format="YYYY-MM-DD"
					start-placeholder="开始日期"
					end-placeholder="结束日期"
				/>
				<el-button :icon="Refresh" :loading="statsDialog.loading" @click="loadStats">刷新</el-button>
			</div>
			<el-table :data="statsDialog.data.daily || []" v-loading="statsDialog.loading" border height="320">
				<el-table-column prop="query_date" label="日期" width="140" />
				<el-table-column prop="total" label="调用数" width="120" />
				<el-table-column prop="success" label="成功" width="120" />
				<el-table-column prop="failed" label="失败" width="120" />
			</el-table>
		</el-dialog>
	</div>
</template>

<script lang="ts" name="app-bsr_logistics_config" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import dayjs from "dayjs";
import { ElMessage, ElMessageBox } from "element-plus";
import {
	DataAnalysis,
	EditPen,
	MagicStick,
	Promotion,
	Refresh,
	Search,
	Setting,
	View
} from "@element-plus/icons-vue";
import { useCool } from "/@/cool";
import { convert_image_url } from "/$/app/utils";
import {
	buildLogisticsQuerySummary,
	buildPackageSnapshot,
	formatLogisticsQuerySummaryMessage
} from "/@/modules/app/utils/logistics-query-summary";

const { service } = useCool();
const route = useRoute();
const logisticsConfigService = (service.app as any).bsr_logistics_config;

const loadingAll = ref(false);
const activeScope = ref("all");
const identifyingPackageId = ref<number | null>(null);
const queryingPackageId = ref<number | null>(null);
const batchQuerying = ref(false);
const selectedPackageRows = ref<any[]>([]);
const MAX_MANUAL_BATCH_QUERY_PACKAGES = 100;

const packageScopes = [
	{ label: "全部包裹", value: "all" },
	{ label: "待自动识别", value: "pending_mapping" },
	{ label: "已识别待查询", value: "recognized_pending_query" },
	{ label: "在途", value: "in_transit" },
	{ label: "派件中", value: "delivering" },
	{ label: "已签收", value: "signed" },
	{ label: "物流异常", value: "logistics_exception" },
	{ label: "识别失败", value: "identify_failed" },
	{ label: "缺手机号", value: "phone_required" },
	{ label: "查询失败", value: "no_result" },
	{ label: "需人工判断", value: "manual_required" },
	{ label: "忽略/停用", value: "ignored_disabled" }
];

const packageCounts = reactive<Record<string, number | null>>({});

const packageState = reactive({
	loading: false,
	keyWord: "",
	orderSn: "",
	rows: [] as any[],
	pagination: {
		page: 1,
		size: 20,
		total: 0
	}
});

const detailDrawer = reactive({
	visible: false,
	activeTab: "base",
	loadingLogs: false,
	loadingPhoneAttempts: false,
	package: null as any,
	logs: [] as any[],
	phoneAttempts: [] as any[]
});

const warehouseDrawer = reactive({
	visible: false,
	activeTab: "warehouse",
	loading: false,
	syncing: false,
	contactsLoading: false,
	keyWord: "",
	cloudStatus: "",
	warehouseType: "",
	contactStatus: "",
	rows: [] as any[],
	contacts: [] as any[],
	selected: null as any,
	selectedRows: [] as any[],
	pagination: {
		page: 1,
		size: 20,
		total: 0
	}
});

const contactState = reactive({
	loading: false,
	keyWord: "",
	enabled: "" as any,
	rows: [] as any[],
	pagination: {
		page: 1,
		size: 20,
		total: 0
	}
});

const warehouseManageDialog = reactive({
	visible: false,
	loading: false,
	warehouse: null as any,
	contacts: [] as any[]
});

const warehouseContactDialog = reactive({
	visible: false,
	saving: false,
	form: {
		id: 0,
		contact_id: 0,
		contact_name: "",
		contact_phone: "",
		priority: 100,
		enabled: true,
		remark: ""
	}
});

const contactDialog = reactive({
	visible: false,
	saving: false,
	form: {
		id: 0,
		contact_name: "",
		contact_phone: "",
		enabled: true,
		remark: ""
	}
});

const bindWarehouseDialog = reactive({
	visible: false,
	loading: false,
	saving: false,
	contact: null as any,
	keyWord: "",
	cloudStatus: "",
	warehouseType: "",
	rows: [] as any[],
	selectedRows: [] as any[],
	presetWarehouseRows: [] as any[],
	pagination: {
		page: 1,
		size: 20,
		total: 0
	}
});

const phoneRuleDrawer = reactive({
	visible: false,
	loading: false,
	keyWord: "",
	rows: [] as any[]
});

const phoneRuleEditDialog = reactive({
	visible: false,
	saving: false,
	inputMode: "select",
	selectedCompanyCode: "",
	form: {
		id: 0,
		company_code: "",
		company_name: "",
		need_phone: true,
		enabled: true,
		remark: ""
	}
});

const carrierOptionState = reactive({
	loading: false,
	options: [] as any[]
});

const rulesDrawer = reactive({
	visible: false,
	loading: false,
	saving: false,
	rows: [] as any[],
	form: {
		raw_company_name: "",
		query_mode: "manual_required",
		enabled: true,
		remark: ""
	}
});

const rawCompanyState = reactive({
	loading: false,
	options: [] as any[]
});

const phoneDialog = reactive({
	visible: false,
	saving: false,
	package: null as any,
	contactPhone: ""
});

const companyDialog = reactive({
	visible: false,
	saving: false,
	package: null as any,
	companyCode: "",
	companyName: ""
});

const statsDialog = reactive({
	visible: false,
	loading: false,
	dateRange: [
		dayjs().subtract(30, "day").format("YYYY-MM-DD"),
		dayjs().format("YYYY-MM-DD")
	] as string[],
	data: {} as any
});

const activeScopeLabel = computed(() => {
	return packageScopes.find((item) => item.value === activeScope.value)?.label || "全部包裹";
});

onMounted(() => {
	packageState.orderSn = String(route.query.order_sn || "");
	refreshAll();
});

const refreshAll = async () => {
	loadingAll.value = true;
	try {
		await Promise.all([refreshPackages(), loadPackageCounts()]);
	} finally {
		loadingAll.value = false;
	}
};

const selectScope = async (value: string) => {
	activeScope.value = value;
	packageState.pagination.page = 1;
	selectedPackageRows.value = [];
	await refreshPackages();
};

const refreshPackages = async () => {
	packageState.loading = true;
	try {
		const res = await logisticsConfigRequest("packages", {
			scope: activeScope.value,
			keyWord: packageState.keyWord,
			order_sn: packageState.orderSn,
			page: packageState.pagination.page,
			size: packageState.pagination.size
		});
		packageState.rows = res?.list || [];
		packageState.pagination = {
			page: Number(res?.pagination?.page) || 1,
			size: Number(res?.pagination?.size) || 50,
			total: Number(res?.pagination?.total) || 0
		};
		packageCounts[activeScope.value] = packageState.pagination.total;
	} catch (e: any) {
		ElMessage.error(e.message || "加载包裹失败");
	} finally {
		packageState.loading = false;
	}
};

const handlePackageSelectionChange = (rows: any[]) => {
	selectedPackageRows.value = rows || [];
};

const loadPackageCounts = async () => {
	const res = await logisticsConfigRequest("packageCounts", {
		keyWord: packageState.keyWord,
		order_sn: packageState.orderSn
	});
	Object.assign(packageCounts, res?.counts || {});
};

const identifyPackage = async (row: any) => {
	if (!row?.id) return;
	identifyingPackageId.value = Number(row.id);
	try {
		const res = await logisticsConfigRequest("identifyPackage", { package_id: row.id, force: true });
		updatePackageInList(res);
		if (detailDrawer.visible && Number(detailDrawer.package?.id) === Number(row.id)) {
			detailDrawer.package = res;
			await Promise.all([loadPackageLogs(row.id), loadPackagePhoneAttempts(row.id)]);
		}
		ElMessage.success(res?.identify_status === "success" ? "识别完成" : "识别失败，已记录原因");
		await loadPackageCounts();
	} catch (e: any) {
		ElMessage.error(e.message || "智能识别失败");
	} finally {
		identifyingPackageId.value = null;
	}
};

const queryPackage = async (row: any) => {
	if (!row?.id) return;
	queryingPackageId.value = Number(row.id);
	try {
		const before = buildPackageSnapshot([row]);
		const res = await logisticsConfigRequest("testQueryPackage", { package_id: row.id });
		updatePackageInList(res);
		const summary = buildLogisticsQuerySummary(res ? [res] : [], before);
		const message = formatLogisticsQuerySummaryMessage(summary);
		if (summary.realQueryCount > 0 && isPositiveQueryResult(res)) {
			ElMessage.success(`${message}：${getPackageStatusText(res?.status)}`);
		} else if (summary.realQueryCount > 0) {
			ElMessage.warning(`${message}：${getPackageHint(res)}`);
		} else {
			ElMessage.warning(message || getPackageHint(res));
		}
		await loadPackageCounts();
		if (detailDrawer.visible && Number(detailDrawer.package?.id) === Number(row.id)) {
			detailDrawer.package = res;
			await Promise.all([loadPackageLogs(row.id), loadPackagePhoneAttempts(row.id)]);
		}
	} catch (e: any) {
		ElMessage.error(e.message || "查询物流失败");
	} finally {
		queryingPackageId.value = null;
	}
};

const querySelectedPackages = async () => {
	const rows = selectedPackageRows.value.filter((row) => row?.id);
	if (!rows.length) {
		ElMessage.warning("请先选择要刷新的物流包裹");
		return;
	}
	const processCount = Math.min(rows.length, MAX_MANUAL_BATCH_QUERY_PACKAGES);
	await confirmAndRunBatchQuery({
		message: `已选择 ${rows.length} 个包裹，本次最多处理前 ${processCount} 个。系统会遵守45分钟冷却；需要手机号的包裹会自动按仓库联系人优先级尝试，只有408会继续试下一个联系人。确定刷新选中物流吗？`,
		payload: {
			mode: "selected",
			package_ids: rows.map((row) => row.id),
			limit: MAX_MANUAL_BATCH_QUERY_PACKAGES
		}
	});
};

const queryFilteredPackages = async () => {
	const total = Number(packageState.pagination.total) || 0;
	if (!total) {
		ElMessage.warning("当前筛选没有可处理的包裹");
		return;
	}
	const processCount = Math.min(total, MAX_MANUAL_BATCH_QUERY_PACKAGES);
	await confirmAndRunBatchQuery({
		message: `当前筛选匹配 ${total} 个包裹，本次最多处理前 ${processCount} 个。系统会遵守45分钟冷却；需要手机号的包裹会自动按仓库联系人优先级尝试，只有408会继续试下一个联系人。确定刷新当前筛选吗？`,
		payload: {
			mode: "filter",
			filters: buildPackageFilterPayload(),
			limit: MAX_MANUAL_BATCH_QUERY_PACKAGES
		}
	});
};

const confirmAndRunBatchQuery = async ({ message, payload }: { message: string; payload: any }) => {
	try {
		await ElMessageBox.confirm(message, "刷新快递100", {
			confirmButtonText: "确认刷新",
			cancelButtonText: "取消",
			type: "warning"
		});
	} catch {
		return;
	}

	batchQuerying.value = true;
	try {
		const res = await logisticsConfigRequest("batchQueryPackages", payload);
		(res?.list || []).forEach((row: any) => updatePackageInList(row));
		showBatchQueryResult(res);
		selectedPackageRows.value = [];
		await Promise.all([refreshPackages(), loadPackageCounts()]);
	} catch (e: any) {
		ElMessage.error(e.message || "批量刷新物流失败");
	} finally {
		batchQuerying.value = false;
	}
};

const buildPackageFilterPayload = () => ({
	scope: activeScope.value,
	keyWord: packageState.keyWord,
	order_sn: packageState.orderSn
});

const showBatchQueryResult = (res: any = {}) => {
	const summary = res?.summary || {};
	const realQueryCount = Number(summary.real_query_count) || 0;
	const skippedCount = Number(summary.skipped_count) || 0;
	const matchedCount = Number(res?.matched_count) || 0;
	const processedCount = Number(res?.processed_count || summary.total) || 0;
	const limit = Number(res?.limit) || MAX_MANUAL_BATCH_QUERY_PACKAGES;
	const reasonText = formatBatchReasons(summary.reasons || {});
	const problemText = formatBatchProblemRows(res?.list || []);
	const scopeText = matchedCount > processedCount
		? `当前匹配 ${matchedCount} 个，单次最多处理 ${limit} 个；`
		: "";
	const message = `${scopeText}真实调用快递100：${realQueryCount} 次；跳过：${skippedCount} 个${reasonText ? `；${reasonText}` : ""}${problemText ? `；${problemText}` : ""}`;
	if (realQueryCount > 0 && !problemText) {
		ElMessage.success(message);
	} else {
		ElMessage.warning(message || "未调用快递100");
	}
};

const isPositiveQueryResult = (row: any) => {
	const status = String(row?.status || "").trim();
	return !["phone_required", "no_result", "logistics_exception", "identify_failed"].includes(status);
};

const formatBatchProblemRows = (rows: any[] = []) => {
	const reasons: Record<string, number> = {};
	rows.forEach((row) => {
		if (isPositiveQueryResult(row)) return;
		const reason = getPackageHint(row);
		reasons[reason] = (reasons[reason] || 0) + 1;
	});
	return formatBatchReasons(reasons);
};

const formatBatchReasons = (reasons: Record<string, number>) => {
	const entries = Object.entries(reasons || {});
	if (!entries.length) return "";
	return entries.map(([reason, count]) => `${reason}：${count} 个`).join("；");
};

const openPackageDetail = async (row: any, activeTab = "base") => {
	detailDrawer.package = row;
	detailDrawer.activeTab = activeTab;
	detailDrawer.visible = true;
	await Promise.all([loadPackageLogs(row.id), loadPackagePhoneAttempts(row.id)]);
};

const loadPackageLogs = async (packageId: number) => {
	detailDrawer.loadingLogs = true;
	try {
		const res = await logisticsConfigRequest("packageQueryLogs", { package_id: packageId, page: 1, size: 100 });
		detailDrawer.logs = res?.list || [];
	} catch (e: any) {
		ElMessage.error(e.message || "加载调用日志失败");
	} finally {
		detailDrawer.loadingLogs = false;
	}
};

const loadPackagePhoneAttempts = async (packageId: number) => {
	detailDrawer.loadingPhoneAttempts = true;
	try {
		const res = await logisticsConfigRequest("phoneMatchAttempts", { package_id: packageId, page: 1, size: 100 });
		detailDrawer.phoneAttempts = res?.list || [];
	} catch (e: any) {
		ElMessage.error(e.message || "加载手机号匹配记录失败");
	} finally {
		detailDrawer.loadingPhoneAttempts = false;
	}
};

const openPhoneDialog = (row: any) => {
	phoneDialog.package = row;
	phoneDialog.contactPhone = row.can_view_contact_phone ? String(row.contact_phone || "") : "";
	phoneDialog.visible = true;
};

const savePackagePhone = async () => {
	if (!phoneDialog.package?.id) return;
	if (!phoneDialog.contactPhone.trim()) {
		ElMessage.warning("请填写手机号");
		return;
	}
	phoneDialog.saving = true;
	try {
		const res = await logisticsConfigRequest("updatePackagePhone", {
			package_id: phoneDialog.package.id,
			order_sn: phoneDialog.package.order_sn,
			contact_phone: phoneDialog.contactPhone.trim()
		});
		const updated = Array.isArray(res?.packages) ? res.packages[0] : null;
		if (updated) updatePackageInList(updated);
		phoneDialog.visible = false;
		ElMessage.success("手机号已保存");
		await loadPackageCounts();
	} catch (e: any) {
		ElMessage.error(e.message || "保存手机号失败");
	} finally {
		phoneDialog.saving = false;
	}
};

const openCompanyDialog = (row: any) => {
	companyDialog.package = row;
	companyDialog.companyCode = row.company_code || "";
	companyDialog.companyName = row.company_name || "";
	companyDialog.visible = true;
};

const savePackageCompany = async () => {
	if (!companyDialog.package?.id) return;
	if (!companyDialog.companyCode.trim()) {
		ElMessage.warning("请填写快递100编码");
		return;
	}
	companyDialog.saving = true;
	try {
		const res = await logisticsConfigRequest("updatePackageCompany", {
			package_id: companyDialog.package.id,
			company_code: companyDialog.companyCode.trim(),
			company_name: companyDialog.companyName.trim()
		});
		updatePackageInList(res);
		companyDialog.visible = false;
		ElMessage.success("识别结果已修改");
		await loadPackageCounts();
	} catch (e: any) {
		ElMessage.error(e.message || "保存识别结果失败");
	} finally {
		companyDialog.saving = false;
	}
};

const openRulesDrawer = async () => {
	rulesDrawer.visible = true;
	await Promise.all([loadExceptionRules(), searchRawCompanyOptions("")]);
};

const loadExceptionRules = async () => {
	rulesDrawer.loading = true;
	try {
		const res = await logisticsConfigRequest("exceptionRules", { page: 1, size: 200 });
		rulesDrawer.rows = res?.list || [];
	} catch (e: any) {
		ElMessage.error(e.message || "加载例外规则失败");
	} finally {
		rulesDrawer.loading = false;
	}
};

const searchRawCompanyOptions = async (keyWord: string) => {
	rawCompanyState.loading = true;
	try {
		const res = await logisticsConfigRequest("rawCompanyOptions", { keyWord, size: 80 });
		rawCompanyState.options = res?.list || [];
	} catch (e: any) {
		ElMessage.error(e.message || "加载原始物流公司失败");
	} finally {
		rawCompanyState.loading = false;
	}
};

const editRule = async (row: any) => {
	rulesDrawer.form.raw_company_name = row.raw_company_name || "";
	rulesDrawer.form.query_mode = row.query_mode || "manual_required";
	rulesDrawer.form.enabled = Number(row.enabled) === 1;
	rulesDrawer.form.remark = row.remark || "";
	await searchRawCompanyOptions(row.raw_company_name || "");
};

const saveExceptionRule = async () => {
	if (!rulesDrawer.form.raw_company_name) {
		ElMessage.warning("请选择原始物流公司");
		return;
	}
	rulesDrawer.saving = true;
	try {
		const res = await logisticsConfigRequest("saveExceptionRule", {
			...rulesDrawer.form,
			enabled: rulesDrawer.form.enabled ? 1 : 0
		});
		ElMessage.success(`规则已保存，已应用 ${res?.affected_packages || 0} 个包裹`);
		await Promise.all([loadExceptionRules(), refreshPackages(), loadPackageCounts()]);
	} catch (e: any) {
		ElMessage.error(e.message || "保存例外规则失败");
	} finally {
		rulesDrawer.saving = false;
	}
};

const openWarehouseDrawer = async () => {
	warehouseDrawer.visible = true;
	await Promise.all([loadWarehouses(), loadContacts()]);
};

const loadWarehouses = async () => {
	warehouseDrawer.loading = true;
	try {
		const res = await logisticsConfigRequest("warehouses", {
			keyWord: warehouseDrawer.keyWord,
			cloud_status: warehouseDrawer.cloudStatus,
			warehouse_type: warehouseDrawer.warehouseType,
			contact_status: warehouseDrawer.contactStatus,
			page: warehouseDrawer.pagination.page,
			size: warehouseDrawer.pagination.size
		});
		warehouseDrawer.rows = res?.list || [];
		warehouseDrawer.pagination = {
			page: Number(res?.pagination?.page) || 1,
			size: Number(res?.pagination?.size) || 20,
			total: Number(res?.pagination?.total) || 0
		};
	} catch (e: any) {
		ElMessage.error(e.message || "加载仓库失败");
	} finally {
		warehouseDrawer.loading = false;
	}
};

const syncWarehouses = async () => {
	warehouseDrawer.syncing = true;
	try {
		const res = await logisticsConfigRequest("syncWarehousesFromLingxing");
		ElMessage.success(`仓库已更新：同步 ${res?.synced || 0} 个，标记移除 ${res?.removed || 0} 个`);
		await Promise.all([loadWarehouses(), loadContacts()]);
	} catch (e: any) {
		ElMessage.error(e.message || "从领星更新仓库失败");
	} finally {
		warehouseDrawer.syncing = false;
	}
};

const handleWarehouseTabChange = async (tab: string | number) => {
	if (tab === "contact") await loadContacts();
	else await loadWarehouses();
};

const handleWarehouseSelectionChange = (rows: any[]) => {
	warehouseDrawer.selectedRows = rows || [];
};

const openWarehouseContactManager = async (row: any) => {
	warehouseManageDialog.warehouse = row;
	warehouseManageDialog.visible = true;
	resetWarehouseContactForm();
	await loadWarehouseContacts();
};

const loadWarehouseContacts = async () => {
	if (!warehouseManageDialog.warehouse?.wid) return;
	warehouseManageDialog.loading = true;
	try {
		const res = await logisticsConfigRequest("warehouseContacts", {
			warehouse_wid: warehouseManageDialog.warehouse.wid
		});
		warehouseManageDialog.contacts = res?.list || [];
	} catch (e: any) {
		ElMessage.error(e.message || "加载仓库联系人失败");
	} finally {
		warehouseManageDialog.loading = false;
	}
};

const resetWarehouseContactForm = () => {
	warehouseContactDialog.form = {
		id: 0,
		contact_id: 0,
		contact_name: "",
		contact_phone: "",
		priority: 100,
		enabled: true,
		remark: ""
	};
};

const openWarehouseContactDialog = (row?: any) => {
	if (!warehouseManageDialog.warehouse?.wid) {
		ElMessage.warning("请先选择仓库");
		return;
	}
	if (row?.id) {
		warehouseContactDialog.form = {
			id: Number(row.id) || 0,
			contact_id: Number(row.contact_id) || 0,
			contact_name: row.contact_name || "",
			contact_phone: row.contact_phone || "",
			priority: Number(row.priority) || 100,
			enabled: Number(row.enabled) === 1,
			remark: row.remark || ""
		};
	} else {
		resetWarehouseContactForm();
	}
	warehouseContactDialog.visible = true;
};

const saveWarehouseContact = async () => {
	if (!warehouseManageDialog.warehouse?.wid) {
		ElMessage.warning("请先选择仓库");
		return;
	}
	if (!warehouseContactDialog.form.contact_id && !warehouseContactDialog.form.contact_phone.trim()) {
		ElMessage.warning("请填写手机号");
		return;
	}
	warehouseContactDialog.saving = true;
	try {
		await logisticsConfigRequest("saveWarehouseContact", {
			...warehouseContactDialog.form,
			warehouse_wid: warehouseManageDialog.warehouse.wid,
			enabled: warehouseContactDialog.form.enabled ? 1 : 0
		});
		ElMessage.success("仓库联系人已保存");
		warehouseContactDialog.visible = false;
		resetWarehouseContactForm();
		await Promise.all([loadWarehouseContacts(), loadWarehouses(), loadContacts(), refreshPackages()]);
	} catch (e: any) {
		ElMessage.error(e.message || "保存仓库联系人失败");
	} finally {
		warehouseContactDialog.saving = false;
	}
};

const deleteWarehouseContact = async (row: any) => {
	try {
		await ElMessageBox.confirm("移除后该仓库不会再使用这个联系人自动匹配手机号，确定移除吗？", "移除绑定", {
			confirmButtonText: "移除",
			cancelButtonText: "取消",
			type: "warning"
		});
	} catch {
		return;
	}
	try {
		await logisticsConfigRequest("deleteWarehouseContact", { id: row.id });
		ElMessage.success("绑定已移除");
		await Promise.all([loadWarehouseContacts(), loadWarehouses(), loadContacts(), refreshPackages()]);
	} catch (e: any) {
		ElMessage.error(e.message || "移除仓库联系人失败");
	}
};

const loadContacts = async () => {
	contactState.loading = true;
	try {
		const res = await logisticsConfigRequest("contacts", {
			keyWord: contactState.keyWord,
			enabled: contactState.enabled,
			page: contactState.pagination.page,
			size: contactState.pagination.size
		});
		contactState.rows = res?.list || [];
		contactState.pagination = {
			page: Number(res?.pagination?.page) || 1,
			size: Number(res?.pagination?.size) || 20,
			total: Number(res?.pagination?.total) || 0
		};
	} catch (e: any) {
		ElMessage.error(e.message || "加载联系人失败");
	} finally {
		contactState.loading = false;
	}
};

const resetContactForm = () => {
	contactDialog.form = {
		id: 0,
		contact_name: "",
		contact_phone: "",
		enabled: true,
		remark: ""
	};
};

const openContactDialog = (row?: any) => {
	if (row?.id) {
		contactDialog.form = {
			id: Number(row.id) || 0,
			contact_name: row.contact_name || "",
			contact_phone: row.contact_phone || "",
			enabled: Number(row.enabled) === 1,
			remark: row.remark || ""
		};
	} else {
		resetContactForm();
	}
	contactDialog.visible = true;
};

const saveContact = async () => {
	if (!contactDialog.form.contact_phone.trim()) {
		ElMessage.warning("请填写手机号");
		return;
	}
	contactDialog.saving = true;
	try {
		await logisticsConfigRequest("saveContact", {
			...contactDialog.form,
			enabled: contactDialog.form.enabled ? 1 : 0
		});
		ElMessage.success("联系人已保存");
		contactDialog.visible = false;
		await Promise.all([loadContacts(), loadWarehouses(), refreshPackages()]);
	} catch (e: any) {
		ElMessage.error(e.message || "保存联系人失败");
	} finally {
		contactDialog.saving = false;
	}
};

const disableContact = async (row: any) => {
	try {
		await ElMessageBox.confirm("停用后所有仓库绑定也会停用，不再用于自动匹配手机号。确定停用吗？", "停用联系人", {
			confirmButtonText: "停用",
			cancelButtonText: "取消",
			type: "warning"
		});
	} catch {
		return;
	}
	try {
		await logisticsConfigRequest("deleteContact", { id: row.id });
		ElMessage.success("联系人已停用");
		await Promise.all([loadContacts(), loadWarehouses(), refreshPackages()]);
	} catch (e: any) {
		ElMessage.error(e.message || "停用联系人失败");
	}
};

const openBindWarehouseDialog = async (row: any) => {
	bindWarehouseDialog.contact = row;
	bindWarehouseDialog.visible = true;
	bindWarehouseDialog.selectedRows = [];
	bindWarehouseDialog.presetWarehouseRows = [...warehouseDrawer.selectedRows];
	await loadBindWarehouseOptions();
};

const openBatchBindContactDialog = () => {
	if (warehouseDrawer.selectedRows.length === 0) {
		ElMessage.warning("请先选择仓库");
		return;
	}
	warehouseDrawer.activeTab = "contact";
	ElMessage.info("请在联系人列表里选择一个联系人并点击“关联仓库”");
};

const loadBindWarehouseOptions = async () => {
	bindWarehouseDialog.loading = true;
	try {
		const res = await logisticsConfigRequest("warehouses", {
			keyWord: bindWarehouseDialog.keyWord,
			cloud_status: bindWarehouseDialog.cloudStatus,
			warehouse_type: bindWarehouseDialog.warehouseType,
			page: bindWarehouseDialog.pagination.page,
			size: bindWarehouseDialog.pagination.size
		});
		bindWarehouseDialog.rows = res?.list || [];
		bindWarehouseDialog.pagination = {
			page: Number(res?.pagination?.page) || 1,
			size: Number(res?.pagination?.size) || 20,
			total: Number(res?.pagination?.total) || 0
		};
	} catch (e: any) {
		ElMessage.error(e.message || "加载仓库失败");
	} finally {
		bindWarehouseDialog.loading = false;
	}
};

const handleBindWarehouseSelectionChange = (rows: any[]) => {
	bindWarehouseDialog.selectedRows = rows || [];
};

const getBindWarehouseSelectedCount = () => {
	return bindWarehouseDialog.selectedRows.length || bindWarehouseDialog.presetWarehouseRows.length;
};

const saveBindWarehouses = async () => {
	const contactId = Number(bindWarehouseDialog.contact?.id) || 0;
	const selectedRows =
		bindWarehouseDialog.selectedRows.length > 0 ? bindWarehouseDialog.selectedRows : bindWarehouseDialog.presetWarehouseRows;
	const warehouseWids = selectedRows.map(row => Number(row.wid)).filter(Boolean);
	if (!contactId || warehouseWids.length === 0) {
		ElMessage.warning("请选择联系人和仓库");
		return;
	}
	bindWarehouseDialog.saving = true;
	try {
		const res = await logisticsConfigRequest("bindContactWarehouses", {
			contact_id: contactId,
			warehouse_wids: warehouseWids,
			priority: 100,
			enabled: 1
		});
		ElMessage.success(`已保存 ${res?.saved || 0} 条仓库绑定`);
		bindWarehouseDialog.visible = false;
		await Promise.all([loadContacts(), loadWarehouses(), refreshPackages()]);
	} catch (e: any) {
		ElMessage.error(e.message || "保存仓库绑定失败");
	} finally {
		bindWarehouseDialog.saving = false;
	}
};

const openCarrierPhoneRuleDrawer = async () => {
	phoneRuleDrawer.visible = true;
	await Promise.all([loadCarrierPhoneRules(), searchCarrierPhoneRuleOptions("")]);
};

const loadCarrierPhoneRules = async () => {
	phoneRuleDrawer.loading = true;
	try {
		const res = await logisticsConfigRequest("carrierPhoneRules", {
			keyWord: phoneRuleDrawer.keyWord,
			page: 1,
			size: 200
		});
		phoneRuleDrawer.rows = res?.list || [];
	} catch (e: any) {
		ElMessage.error(e.message || "加载手机号规则失败");
	} finally {
		phoneRuleDrawer.loading = false;
	}
};

const resetCarrierPhoneRuleForm = () => {
	phoneRuleEditDialog.inputMode = "select";
	phoneRuleEditDialog.selectedCompanyCode = "";
	phoneRuleEditDialog.form = {
		id: 0,
		company_code: "",
		company_name: "",
		need_phone: true,
		enabled: true,
		remark: ""
	};
};

const openCarrierPhoneRuleDialog = async (row?: any) => {
	if (row?.id) {
		phoneRuleEditDialog.inputMode = "manual";
		phoneRuleEditDialog.selectedCompanyCode = row.company_code || "";
		phoneRuleEditDialog.form = {
			id: Number(row.id) || 0,
			company_code: row.company_code || "",
			company_name: row.company_name || "",
			need_phone: Number(row.need_phone) === 1,
			enabled: Number(row.enabled) === 1,
			remark: row.remark || ""
		};
	} else {
		resetCarrierPhoneRuleForm();
	}
	phoneRuleEditDialog.visible = true;
	await searchCarrierPhoneRuleOptions(row?.company_code || "");
};

const handlePhoneRuleModeChange = (mode: string | number | boolean) => {
	if (mode === "select") {
		phoneRuleEditDialog.selectedCompanyCode = phoneRuleEditDialog.form.company_code || "";
		if (phoneRuleEditDialog.selectedCompanyCode) {
			handleCarrierOptionChange(phoneRuleEditDialog.selectedCompanyCode);
		}
		return;
	}
	phoneRuleEditDialog.selectedCompanyCode = "";
};

const searchCarrierPhoneRuleOptions = async (keyWord = "") => {
	carrierOptionState.loading = true;
	try {
		const res = await logisticsConfigRequest("carrierPhoneRuleOptions", {
			keyWord,
			size: 80
		});
		carrierOptionState.options = res?.list || [];
	} catch (e: any) {
		ElMessage.error(e.message || "加载快递公司选项失败");
	} finally {
		carrierOptionState.loading = false;
	}
};

const handleCarrierOptionChange = (companyCode: string) => {
	const code = String(companyCode || "").trim().toLowerCase();
	if (!code) {
		phoneRuleEditDialog.selectedCompanyCode = "";
		phoneRuleEditDialog.form.company_code = "";
		phoneRuleEditDialog.form.company_name = "";
		return;
	}
	phoneRuleEditDialog.selectedCompanyCode = code;
	phoneRuleEditDialog.form.company_code = code;
	const option = carrierOptionState.options.find((item) => String(item.company_code || "").toLowerCase() === code);
	if (!option) return;
	phoneRuleEditDialog.form.company_name = option.company_name || code;
	if (!phoneRuleEditDialog.form.id && option.has_rule) {
		phoneRuleEditDialog.form.id = Number(option.rule_id) || 0;
		phoneRuleEditDialog.form.need_phone = Number(option.need_phone) === 1;
		phoneRuleEditDialog.form.enabled = Number(option.enabled) === 1;
	}
};

const getCarrierOptionLabel = (item: any) => {
	const name = item.company_name || item.company_code || "-";
	const code = item.company_code || "-";
	const sourceText = item.has_rule ? "已有规则" : "系统识别";
	const packageCount = Number(item.package_count) || 0;
	return packageCount > 0 ? `${name}（${code}）· ${sourceText} · ${packageCount} 个包裹` : `${name}（${code}）· ${sourceText}`;
};

const saveCarrierPhoneRule = async () => {
	if (!phoneRuleEditDialog.form.company_code.trim()) {
		ElMessage.warning("请填写快递100编码");
		return;
	}
	phoneRuleEditDialog.saving = true;
	try {
		const res = await logisticsConfigRequest("saveCarrierPhoneRule", {
			...phoneRuleEditDialog.form,
			company_code: phoneRuleEditDialog.form.company_code.trim().toLowerCase(),
			need_phone: phoneRuleEditDialog.form.need_phone ? 1 : 0,
			enabled: phoneRuleEditDialog.form.enabled ? 1 : 0
		});
		ElMessage.success(`手机号规则已保存，已应用 ${res?.affected_packages || 0} 个包裹`);
		phoneRuleEditDialog.visible = false;
		resetCarrierPhoneRuleForm();
		await Promise.all([loadCarrierPhoneRules(), searchCarrierPhoneRuleOptions(""), refreshPackages(), loadPackageCounts()]);
	} catch (e: any) {
		ElMessage.error(e.message || "保存手机号规则失败");
	} finally {
		phoneRuleEditDialog.saving = false;
	}
};

const openStatsDialog = async () => {
	statsDialog.visible = true;
	await loadStats();
};

const loadStats = async () => {
	statsDialog.loading = true;
	try {
		const [startDate, endDate] = statsDialog.dateRange || [];
		statsDialog.data = await logisticsConfigRequest("queryStats", { startDate, endDate });
	} catch (e: any) {
		ElMessage.error(e.message || "加载统计失败");
	} finally {
		statsDialog.loading = false;
	}
};

const updatePackageInList = (pkg: any) => {
	if (!pkg?.id) return;
	const idx = packageState.rows.findIndex((item) => Number(item.id) === Number(pkg.id));
	if (idx >= 0) {
		packageState.rows.splice(idx, 1, { ...packageState.rows[idx], ...pkg });
	}
	if (detailDrawer.visible && Number(detailDrawer.package?.id) === Number(pkg.id)) {
		detailDrawer.package = { ...detailDrawer.package, ...pkg };
	}
};

const logisticsConfigRequest = (path: string, data: any = {}) => {
	if (logisticsConfigService?.request) {
		return logisticsConfigService.request({
			url: `/${path}`,
			method: "POST",
			data
		});
	}

	return service.request({
		url: `/admin/app/bsr_logistics_config/${path}`,
		method: "POST",
		data
	});
};

const traceRows = (pkg: any) => {
	if (Array.isArray(pkg?.trace_info_json)) return pkg.trace_info_json;
	if (Array.isArray(pkg?.trace_json)) return pkg.trace_json;
	return [];
};

const productRows = (pkg: any) => {
	return Array.isArray(pkg?.product_items) ? pkg.product_items : [];
};

const productPreviewRows = (pkg: any) => {
	return productRows(pkg).slice(0, 5);
};

const getRemainingProductCount = (pkg: any) => {
	return Math.max(productRows(pkg).length - productPreviewRows(pkg).length, 0);
};

const getProductSummary = (row: any) => {
	return row?.product_summary || {};
};

const getOrderSummary = (row: any) => {
	return row?.order_summary || {};
};

const getSupplierText = (row: any) => {
	return getOrderSummary(row).supplier_name || "供应商未记录";
};

const getWarehouseText = (row: any) => {
	return getOrderSummary(row).warehouse_name || "仓库未记录";
};

const getPackageWarehouseText = (row: any) => {
	const name = String(row?.warehouse_name || "").trim();
	const wid = row?.warehouse_wid ? String(row.warehouse_wid) : "";
	if (name && wid) return `${name}（${wid}）`;
	return name || (wid ? `仓库ID ${wid}` : "未记录");
};

const getProductImage = (row: any) => {
	return normalizeImageUrl(getProductSummary(row).image_url);
};

const getProductItemImage = (row: any) => {
	return normalizeImageUrl(row?.image_url);
};

const normalizeImageUrl = (url: any) => {
	const text = String(url || "").trim();
	return text ? convert_image_url(text) : "";
};

const getPlanCount = (row: any) => {
	return Array.isArray(row?.plan_sns) ? row.plan_sns.length : 0;
};

const getPlanDisplayText = (row: any) => {
	const planSns = Array.isArray(row?.plan_sns) ? row.plan_sns.filter(Boolean) : [];
	if (!planSns.length) return "-";
	if (planSns.length === 1) return planSns[0];
	return `${planSns[0]} 等 ${planSns.length} 个计划`;
};

const formatPlanSns = (planSns: any) => {
	const list = Array.isArray(planSns) ? planSns.filter(Boolean) : [];
	return list.length ? list.join("、") : "-";
};

const sourceRows = (pkg: any) => {
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
};

const getSourceCompany = (source: any) => {
	return String(source?.logistics_company || source?.raw_company_name || "").trim();
};

const getSourcePolId = (source: any) => {
	return String(source?.pol_id || source?.source_pol_id || "").trim();
};

const getSourceTrackingNo = (source: any) => {
	return String(source?.logistics_order_no || source?.tracking_no || "").trim();
};

const latestTraceText = (pkg: any) => {
	const first = traceRows(pkg)[0];
	if (first) return first.remark || first.context || "-";
	return pkg?.last_error_message || pkg?.provider_message || pkg?.identify_error_message || "-";
};

const getPackageHint = (row: any) => {
	if (String(row?.last_error_code || "").trim() === "408") {
		return row?.last_error_message || "手机号校验失败，可更换手机号或继续按仓库联系人尝试";
	}
	if (row?.can_query === true) {
		if (String(row?.identify_status || "").trim() === "failed" && !String(row?.company_code || "").trim()) {
			return `可重试识别：${row?.identify_error_message || row?.last_error_message || "上次识别失败"}`;
		}
		if (!String(row?.company_code || "").trim()) return "可查询：会先自动识别快递公司";
		if (Number(row?.phone_required) === 1 && row?.warehouse_phone_attempt_enabled) {
			return "可查询：会按采购仓库联系人优先级尝试手机号";
		}
		return "可查询物流";
	}
	const reason = row?.query_block_reason;
	const reasonMap: Record<string, string> = {
		cooldown: `冷却中，下次可查询：${formatDateTime(row.next_query_after)}`,
		phone_required: "缺少手机号",
		phone_invalid: "手机号格式无效",
		pending_mapping: "待自动识别",
		identify_failed: row?.identify_error_message || "识别失败",
		missing_warehouse: "采购单没有仓库，无法自动匹配手机号",
		warehouse_contact_required: "该仓库未配置联系人手机号",
		warehouse_contact_exhausted: "仓库联系人手机号均未匹配，请人工填写手机号",
		manual_required: "需人工判断物流，不查快递100",
		ignored: "已忽略",
		disabled: "已停用",
		missing_tracking_no: "缺少运单号"
	};
	if (reason && reasonMap[reason]) return reasonMap[reason];
	return row?.last_error_message || row?.provider_message || row?.identify_error_message || "-";
};

const getNextQueryAfterText = (row: any) => {
	if (String(row?.last_error_code || "").trim() === "408") return "-";
	return formatDateTime(row?.next_query_after);
};

const getPackageQueryTip = (row: any) => {
	if (!row?.can_query) return getPackageHint(row);
	if (String(row?.identify_status || "").trim() === "failed" && !String(row?.company_code || "").trim()) {
		return "会重新智能识别快递公司；识别成功后继续查询物流。";
	}
	if (!String(row?.company_code || "").trim()) {
		return "会先自动识别快递公司，识别成功后继续查询物流；已识别的包裹不会重复识别。";
	}
	if (Number(row?.phone_required) === 1 && row?.warehouse_phone_attempt_enabled) {
		return "系统会按采购仓库联系人优先级尝试手机号；只有408会继续试下一个联系人。";
	}
	if (Number(row?.phone_required) === 1) {
		return "使用当前包裹手机号查询物流。";
	}
	return "直接查询快递100物流轨迹。";
};

const getPackageStatusText = (status: string) => {
	const map: Record<string, string> = {
		pending_mapping: "待自动识别",
		identify_failed: "识别失败",
		phone_required: "缺手机号",
		in_transit: "在途",
		delivering: "派件中",
		signed: "已签收",
		logistics_exception: "物流异常",
		no_result: "查询失败",
		manual_required: "需人工判断",
		ignored: "忽略",
		disabled: "停用"
	};
	return map[String(status || "")] || status || "-";
};

const getPackageStatusTag = (status: string) => {
	const map: Record<string, string> = {
		pending_mapping: "warning",
		identify_failed: "danger",
		phone_required: "warning",
		in_transit: "primary",
		delivering: "primary",
		signed: "success",
		logistics_exception: "danger",
		no_result: "danger",
		manual_required: "info",
		ignored: "info",
		disabled: "danger"
	};
	return map[String(status || "")] || "info";
};

const getIdentifyText = (status: string) => {
	const map: Record<string, string> = {
		pending: "待识别",
		success: "已识别",
		failed: "识别失败"
	};
	return map[String(status || "")] || status || "-";
};

const getCompanySourceText = (source: string) => {
	const map: Record<string, string> = {
		autonumber: "自动识别",
		manual: "人工修改",
		imported: "历史数据"
	};
	return map[String(source || "")] || source || "-";
};

const getPhoneText = (row: any) => {
	if (Number(row?.phone_required) !== 1) return "不需要";
	if (row.phone_status === "ok") return row.contact_phone ? `已填 ${row.contact_phone}` : "已填写";
	if (row.phone_status === "invalid") return "无效";
	return "缺少";
};

const getPhoneSourceText = (row: any) => {
	if (Number(row?.phone_required) !== 1) return "不需要手机号";
	const source = String(row?.phone_source || "").trim();
	if (source === "manual") return "人工填写";
	if (source === "warehouse_contact") {
		return row?.matched_contact_name ? `仓库联系人：${row.matched_contact_name}` : "仓库联系人";
	}
	if (row?.latest_phone_match_message) return `待匹配：${row.latest_phone_match_message}`;
	return "未填写";
};

const getPhoneTag = (row: any) => {
	if (Number(row?.phone_required) !== 1) return "info";
	if (row.phone_status === "ok") return "success";
	return "warning";
};

const getWarehouseTypeText = (type: string) => {
	const map: Record<string, string> = {
		local: "本地仓",
		overseas: "海外仓",
		awd: "AWD仓"
	};
	return map[String(type || "")] || type || "-";
};

const getQueryModeText = (mode: string) => {
	const map: Record<string, string> = {
		kuaidi100: "快递100",
		manual_required: "不查快递100",
		ignored: "忽略",
		disabled: "停用"
	};
	return map[String(mode || "")] || mode || "-";
};

const getQueryModeTag = (mode: string) => {
	const map: Record<string, string> = {
		manual_required: "warning",
		ignored: "info",
		disabled: "danger"
	};
	return map[String(mode || "")] || "info";
};

const getProviderStateText = (row: any) => {
	const stateMap: Record<string, string> = {
		"0": "在途",
		"1": "揽收",
		"2": "疑难",
		"3": "签收",
		"4": "退签",
		"5": "派件",
		"6": "退回",
		"7": "转投",
		"8": "清关",
		"13": "清关异常",
		"14": "拒签"
	};
	const state = String(row?.provider_state || "");
	return state ? `${stateMap[state] || "未知"} (${state})` : "-";
};

const formatDateTime = (time: any) => {
	if (!time) return "-";
	const value = dayjs(time);
	return value.isValid() ? value.format("YYYY-MM-DD HH:mm:ss") : String(time);
};
</script>

<style lang="scss" scoped>
.logistics-workbench {
	min-height: 100%;
	padding: 16px;
	background: #f6f7f9;
	color: #1f2937;
}

.page-head,
.panel-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
}

.page-head {
	margin-bottom: 12px;
}

.page-title {
	font-size: 18px;
	font-weight: 650;
	line-height: 28px;
}

.page-subtitle,
.hint {
	font-size: 13px;
	color: #6b7280;
	line-height: 20px;
}

.head-actions,
.panel-actions,
.row-actions,
.rules-toolbar,
.stats-toolbar,
.config-toolbar {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
}

.head-actions .el-input {
	width: 310px;
}

.status-grid {
	display: grid;
	grid-template-columns: repeat(6, minmax(0, 1fr));
	gap: 10px;
	margin-bottom: 12px;
}

.status-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-height: 54px;
	padding: 10px 12px;
	border: 1px solid #e5e7eb;
	border-radius: 6px;
	background: #fff;
	color: #374151;
	cursor: pointer;
	text-align: left;
}

.status-card.active {
	border-color: #409eff;
	background: #ecf5ff;
	color: #1d4ed8;
}

.status-card strong {
	font-size: 18px;
}

.panel {
	background: #fff;
	border: 1px solid #e5e7eb;
	border-radius: 6px;
	padding: 12px;
	min-width: 0;
}

.panel-title {
	font-size: 15px;
	font-weight: 650;
}

.row-actions :deep(.el-button) {
	margin-left: 0;
}

.raw-company-cell {
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

.product-cell {
	display: grid;
	grid-template-columns: 54px minmax(0, 1fr);
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.product-thumb,
.product-thumb :deep(.el-image),
.product-thumb-empty {
	width: 54px;
	height: 54px;
	border-radius: 6px;
}

.product-thumb {
	overflow: hidden;
	background: #f3f4f6;
}

.product-thumb-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px dashed #d1d5db;
	color: #9ca3af;
	font-size: 12px;
}

.product-main,
.purchase-cell,
.tracking-cell,
.status-cell,
.time-cell {
	min-width: 0;
	font-size: 12px;
	line-height: 20px;
}

.product-name,
.trace-line,
.purchase-line,
.tracking-company {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.product-name {
	font-size: 13px;
	font-weight: 650;
	color: #1f2937;
}

.product-meta,
.product-tags,
.status-tags {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6px;
	color: #6b7280;
}

.product-count-tag {
	cursor: pointer;
}

.mono {
	font-family: Monaco, Consolas, monospace;
}

.strong {
	font-weight: 650;
	color: #1f2937;
}

.quantity-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 6px;
	margin-top: 4px;
	max-width: 210px;
}

.quantity-grid span {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-width: 0;
	padding: 2px 7px;
	border-radius: 4px;
	background: #f3f4f6;
	color: #4b5563;
}

.quantity-grid em {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-style: normal;
	color: #6b7280;
}

.quantity-grid b {
	flex-shrink: 0;
	font-weight: 650;
	color: #1f2937;
}

.trace-line {
	color: #374151;
}

.query-line,
.time-cell {
	color: #6b7280;
}

.detail-product-image,
.detail-product-empty {
	width: 48px;
	height: 48px;
	border-radius: 6px;
}

.detail-product-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px dashed #d1d5db;
	color: #9ca3af;
	font-size: 12px;
}

.detail-product-name {
	font-weight: 650;
	color: #1f2937;
}

.detail-product-meta {
	font-size: 12px;
	color: #6b7280;
	line-height: 18px;
}

.product-relation-alert {
	margin-bottom: 10px;
}

:global(.logistics-product-popover) .product-preview {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

:global(.logistics-product-popover) .product-preview-title {
	font-size: 13px;
	font-weight: 650;
	color: #1f2937;
}

:global(.logistics-product-popover) .product-preview-item {
	display: grid;
	grid-template-columns: 42px minmax(0, 1fr);
	gap: 8px;
	padding: 8px;
	border: 1px solid #edf0f5;
	border-radius: 6px;
	background: #fafafa;
}

:global(.logistics-product-popover) .product-preview-thumb,
:global(.logistics-product-popover) .product-preview-thumb .el-image,
:global(.logistics-product-popover) .product-preview-empty {
	width: 42px;
	height: 42px;
	border-radius: 5px;
}

:global(.logistics-product-popover) .product-preview-thumb {
	overflow: hidden;
	background: #f3f4f6;
}

:global(.logistics-product-popover) .product-preview-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px dashed #d1d5db;
	color: #9ca3af;
	font-size: 12px;
}

:global(.logistics-product-popover) .product-preview-main {
	min-width: 0;
}

:global(.logistics-product-popover) .product-preview-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 13px;
	font-weight: 650;
	color: #1f2937;
}

:global(.logistics-product-popover) .product-preview-meta {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 12px;
	line-height: 18px;
	color: #6b7280;
}

:global(.logistics-product-popover) .product-preview-more {
	padding-top: 2px;
	font-size: 12px;
	color: #6b7280;
}

.pagination-row {
	display: flex;
	justify-content: flex-end;
	padding-top: 12px;
}

.detail-action-row {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-bottom: 12px;
}

.detail-action-tip {
	color: #6b7280;
	font-size: 12px;
	line-height: 18px;
}

.raw-json {
	max-height: 560px;
	overflow: auto;
	margin: 12px 0 0;
	padding: 10px;
	background: #111827;
	color: #f9fafb;
	border-radius: 4px;
	font-size: 12px;
	line-height: 18px;
}

.rules-toolbar,
.stats-toolbar,
.config-toolbar {
	margin-bottom: 12px;
}

.config-help,
.form-hint {
	color: #6b7280;
	font-size: 12px;
	line-height: 18px;
}

.config-help {
	margin: -4px 0 10px;
}

.form-hint {
	margin-top: 6px;
}

.carrier-select-wrap {
	width: 100%;
}

.select-prefix {
	display: inline-flex;
	align-items: center;
	height: 20px;
	padding: 0 6px;
	border-radius: 4px;
	background: #ecf5ff;
	color: #1d4ed8;
	font-size: 12px;
}

.carrier-option {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	width: 100%;
}

.carrier-option-name {
	font-weight: 650;
	color: #1f2937;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.carrier-option-code,
.carrier-option-count {
	color: #6b7280;
	font-size: 12px;
	white-space: nowrap;
}

.selected-carrier-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	width: 100%;
	min-height: 42px;
	padding: 8px 10px;
	border: 1px solid #c6e2ff;
	border-radius: 6px;
	background: #f4f9ff;

	div {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	strong,
	span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		color: #1f2937;
		line-height: 20px;
	}

	span {
		color: #6b7280;
		font-size: 12px;
	}
}

.selected-carrier-card.empty {
	border-color: #e5e7eb;
	background: #f9fafb;
	color: #9ca3af;
}

.rules-table,
.config-table {
	margin-top: 12px;
}

.warehouse-contact-tabs {
	margin-top: 8px;
}

.mini-action-row {
	display: flex;
	align-items: center;
	gap: 10px;
	min-height: 34px;
	margin: 4px 0 8px;
}

.contact-chip-line {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 5px;
	min-height: 24px;
}

.contact-panel {
	margin-top: 14px;
	padding-top: 12px;
	border-top: 1px solid #e5e7eb;
}

.readonly-text {
	color: #374151;
}

@media (max-width: 1280px) {
	.status-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
}

@media (max-width: 760px) {
	.logistics-workbench {
		padding: 10px;
	}

	.page-head,
	.panel-head {
		flex-direction: column;
		align-items: flex-start;
	}

	.head-actions .el-input {
		width: 100%;
	}

	.status-grid {
		grid-template-columns: 1fr;
	}
}
</style>
