<template>
	<cl-crud ref="Crud">
		<cl-row>
			<!-- 左侧操作按钮 -->
			<cl-refresh-btn />

			<el-tooltip
				:disabled="
					selectedRows.length === 0 ||
					selectedRows.every(
						(r) => r.logistics_status === 'signed' || r.logistics_status === 'confirmed'
					)
				"
				content="选中的单据包含未收货订单，请先「人工确认物流收货」"
				placement="bottom"
			>
				<el-button
					type="success"
					:disabled="
						selectedRows.length === 0 ||
						!selectedRows.every(
							(r) =>
								r.logistics_status === 'signed' ||
								r.logistics_status === 'confirmed'
						)
					"
					@click="openShippingDialog(selectedRows)"
				>
					批量发货 ({{ selectedRows.length }})
				</el-button>
			</el-tooltip>

			<el-button
				v-if="viewMode === 'order'"
				type="warning"
				plain
				:disabled="selectedRows.length === 0"
				@click="handleConfirmReceipt(selectedRows.map((r) => r.order_sn))"
			>
				人工确认物流收货 ({{ selectedRows.length }})
			</el-button>

			<el-button
				type="danger"
				plain
				:disabled="selectedRows.length === 0"
				@click="openExceptionDialog(selectedRows)"
			>
				标记异常 ({{ selectedRows.length }})
			</el-button>

			<el-tooltip
				content="从领星按最近更新时间拉取采购单、明细和物流单号，刷新本地包裹基础数据；不查询快递100。"
				placement="bottom"
			>
				<el-button type="primary" :loading="syncing" @click="handleSync">
					<el-icon><refresh /></el-icon>
					{{ syncing ? "更新中..." : "更新采购单" }}
				</el-button>
			</el-tooltip>

			<el-tooltip
				content="只读解析采购计划备注里的【自动补全V1】配置，不写入本地分析记录或快照。"
				placement="bottom"
			>
				<el-button plain @click="openRemarkPreviewDialog">
					<el-icon><document /></el-icon>
					备注解析测试
				</el-button>
			</el-tooltip>

			<el-button type="danger" plain :loading="syncingForce" @click="handleSyncForce">
				<el-icon><warning /></el-icon>
				{{ syncingForce ? "全量重拉中..." : "全量重拉采购单(慎用)" }}
			</el-button>

			<cl-flex1 />

			<!-- 右侧筛选区 -->
			<div class="filter-wrapper">
				<!-- 独立高亮的视图切换组 -->
				<div class="view-mode-group">
					<span class="view-mode-label">数据视图</span>
					<el-select
						v-model="viewMode"
						@change="handleViewModeChange"
						size="default"
						class="view-mode-select"
						style="width: 140px"
					>
						<el-option value="all" label="全部">
							<el-tooltip
								content="显示所有产品明细，包含正常的和异常的数据。"
								placement="right"
								effect="light"
							>
								<span>全部</span>
							</el-tooltip>
						</el-option>
						<el-option value="order" label="单据视图">
							<el-tooltip
								content="按采购单号合并显示，方便进行整单操作。"
								placement="right"
								effect="light"
							>
								<span>单据视图</span>
							</el-tooltip>
						</el-option>
						<el-option value="product" label="产品视图">
							<el-tooltip
								content="只显示【正常的】产品（填了 MSKU 并且成功找到了对应的亚马逊商品）。"
								placement="right"
								effect="light"
							>
								<span>产品视图</span>
							</el-tooltip>
						</el-option>
						<el-option value="unmatched" label="信息未匹配">
							<el-tooltip
								content="【少亚马逊商品】：领星里有 MSKU 编码，但在我们系统里找不到对应的亚马逊商品。"
								placement="right"
								effect="light"
							>
								<span>信息未匹配</span>
							</el-tooltip>
						</el-option>
						<el-option value="no_link" label="暂无链接">
							<el-tooltip
								content="【少 MSKU】：领星里连 MSKU 都没有填，系统完全没法识别这是什么商品。"
								placement="right"
								effect="light"
							>
								<span>暂无链接</span>
							</el-tooltip>
						</el-option>
					</el-select>
				</div>

				<!-- 分割线 -->
				<div class="filter-divider"></div>

				<!-- 状态筛选组 -->
				<div class="filter-group">
					<!-- 异常预警快捷筛选 -->
					<div class="filter-item">
						<el-select
							v-model="alertFilter"
							placeholder="异常预警"
							clearable
							class="filter-select alert-filter-select"
							@change="handleAlertChange"
							style="width: 140px"
						>
							<el-option
								label="3天无物流"
								value="logistics_abnormal"
								title="下单超过3天，还没有物流信息"
							/>
							<el-option
								label="7天未签收"
								value="overtime_unsigned"
								title="发货超过7天，还没有签收"
							/>
						</el-select>
					</div>

					<div class="filter-item">
						<el-select
							v-model="filters.status"
							placeholder="采购状态"
							multiple
							collapse-tags
							collapse-tags-tooltip
							:max-collapse-tags="2"
							clearable
							class="filter-select"
							@change="handleFilter"
							style="min-width: 160px"
						>
							<el-option label="待到货" :value="2" />
							<el-option label="已完成" :value="9" />
							<el-option label="待下单" :value="1" />
							<el-option label="待提交" :value="3" />
							<el-option label="作废" :value="-1" />
							<el-option label="(审批流)待审核" :value="121" />
							<el-option label="(审批流)驳回" :value="122" />
							<el-option label="(审批流)作废" :value="124" />
						</el-select>
					</div>

					<!-- 物流状态筛选 -->
					<div class="filter-item">
						<el-select
							v-model="filters.logistics_status"
							placeholder="物流状态"
							clearable
							class="filter-select"
							@change="handleFilter"
							style="width: 140px"
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
									<el-tooltip
										:content="item.description"
										placement="right"
										:show-after="180"
									>
										<div class="fulfillment-status-option">
											<span>{{ item.label }}</span>
											<span>{{ item.short }}</span>
										</div>
									</el-tooltip>
								</el-option>
							</el-option-group>
						</el-select>
					</div>
					<!-- 超时天数输入已隐藏，后端默认7天 -->

					<!-- 新增店铺筛选 (仅在产品视图生效) -->
					<div class="filter-item" v-if="viewMode === 'product'">
						<el-select
							v-model="filters.shopName"
							placeholder="店铺"
							clearable
							class="filter-select"
							@change="handleFilter"
							style="width: 140px"
						>
							<el-option
								v-for="shop in shopList"
								:key="shop"
								:label="shop"
								:value="shop"
							/>
						</el-select>
					</div>

					<el-date-picker
						v-model="filters.dateRange"
						type="daterange"
						range-separator="~"
						start-placeholder="下单开始"
						end-placeholder="下单结束"
						value-format="YYYY-MM-DD"
						class="filter-date"
						@change="handleFilter"
					/>
				</div>

				<!-- 搜索框：下拉选择搜索类型 + 输入框 -->
				<div class="search-wrapper">
					<el-input
						v-model="filters.keyWord"
						:placeholder="searchPlaceholder"
						clearable
						class="search-input"
						@keyup.enter="handleFilter"
						@clear="handleFilter"
						style="width: 280px"
					>
						<template #prepend>
							<el-select v-model="filters.searchType" style="width: 110px">
								<el-option label="采购单号" value="order_sn" />
								<el-option label="计划单号" value="plan_sn" />
								<el-option label="ASIN" value="asin" />
							</el-select>
						</template>
						<template #append>
							<el-button :icon="Search" @click="handleFilter" />
						</template>
					</el-input>
				</div>
			</div>
		</cl-row>

		<el-alert
			v-if="syncResult"
			:title="`成功匹配 ${syncResult.matched} 条订单`"
			type="success"
			closable
			@close="syncResult = null"
			style="margin: 10px 0"
		>
			<div
				v-if="syncResult.auto_complete || syncResult.autoComplete"
				class="sync-auto-complete-summary"
			>
				<span>自动补全：</span>
				<el-tag size="small" type="success" effect="plain"
					>新建 {{ getAutoCompleteSummary(syncResult).created }}</el-tag
				>
				<el-tag size="small" type="primary" effect="plain"
					>更新 {{ getAutoCompleteSummary(syncResult).updated }}</el-tag
				>
				<el-tag size="small" type="info" effect="plain"
					>跳过 {{ getAutoCompleteSummary(syncResult).skipped }}</el-tag
				>
				<el-tag
					size="small"
					:type="getAutoCompleteSummary(syncResult).warningCount > 0 ? 'warning' : 'info'"
					effect="plain"
				>
					警告 {{ getAutoCompleteSummary(syncResult).warningCount }}
				</el-tag>
				<el-tag
					size="small"
					:type="getAutoCompleteSummary(syncResult).failed > 0 ? 'danger' : 'info'"
					effect="plain"
				>
					失败 {{ getAutoCompleteSummary(syncResult).failed }}
				</el-tag>
			</div>
		</el-alert>

		<cl-row>
			<el-table
				ref="tableRef"
				v-loading="loading"
				:data="tableData"
				row-key="order_sn"
				border
				stripe
				style="width: 100%"
				size="small"
				@selection-change="handleSelectionChange"
				class="purchase-table"
			>
				<!-- 多选列 -->
				<el-table-column type="selection" width="50" fixed="left" />

				<!-- ========== 基础信息区（固定左侧） ========== -->
				<el-table-column type="index" label="序号" width="60" align="center" fixed="left" />

				<!-- 单据视图：ID列 -->
				<el-table-column
					v-if="viewMode === 'order'"
					prop="order_sn"
					label="采购单号"
					width="160"
					fixed="left"
					show-overflow-tooltip
				>
					<template #default="{ row }">
						<div class="order-sn-cell">
							<span class="sn-text">{{ row.order_sn }}</span>
							<el-icon class="copy-btn" @click="copyText(row.order_sn)"
								><copy-document
							/></el-icon>
						</div>
					</template>
				</el-table-column>

				<el-table-column
					v-if="viewMode !== 'order'"
					label="匹配状态"
					width="90"
					align="center"
					fixed="left"
				>
					<template #default="{ row }">
						<el-tooltip
							v-if="row.link_status === 'normal'"
							content="已匹配到商品信息的产品"
							placement="top"
							effect="dark"
						>
							<el-tag
								type="success"
								size="small"
								effect="light"
								round
								style="cursor: help"
								>正常</el-tag
							>
						</el-tooltip>
						<el-tooltip
							v-else-if="row.link_status === 'unmatched'"
							content="产品有MSKU，但系统中找不到对应的商品Listing"
							placement="top"
							effect="dark"
						>
							<el-tag
								type="warning"
								size="small"
								effect="light"
								round
								style="cursor: help"
								>未匹配</el-tag
							>
						</el-tooltip>
						<el-tooltip
							v-else-if="row.link_status === 'no_link'"
							content="产品没有MSKU，无法关联到任何商品信息"
							placement="top"
							effect="dark"
						>
							<el-tag
								type="danger"
								size="small"
								effect="light"
								round
								style="cursor: help"
								>无 MSKU</el-tag
							>
						</el-tooltip>
						<span v-else>-</span>
					</template>
				</el-table-column>

				<!-- ========== 产品视图及无链接/未匹配视图：独立列（每个数据一个格子） ========== -->
				<template
					v-if="
						viewMode === 'product' ||
						viewMode === 'unmatched' ||
						viewMode === 'no_link' ||
						viewMode === 'all'
					"
				>
					<!-- ========== 复刻自产品Listing的列 ========== -->
					<!-- 图片 -->
					<el-table-column
						label="图片"
						prop="image_url_display"
						width="70"
						align="center"
						fixed="left"
					>
						<template #default="{ row }">
							<el-image
								:src="row.image_url_display"
								style="
									width: 50px;
									height: 50px;
									border-radius: 4px;
									border: 1px solid #ebeef5;
								"
								fit="contain"
								:preview-src-list="
									row.image_url_display ? [row.image_url_display] : []
								"
								preview-teleported
								hide-on-click-modal
							>
								<template #error>
									<div
										style="
											display: flex;
											justify-content: center;
											align-items: center;
											width: 100%;
											height: 100%;
											background: #f5f7fa;
											color: #c0c4cc;
										"
									>
										<el-icon><picture /></el-icon>
									</div>
								</template>
							</el-image>
						</template>
					</el-table-column>

					<!-- 状态 -->
					<el-table-column label="状态" prop="status" min-width="90" fixed="left">
						<template #default="{ row }">
							<div class="asin-cell">
								<div class="asin-badges">
									<!-- 站点标签 -->
									<el-tag
										v-if="row.marketplace"
										size="small"
										effect="dark"
										:color="getMarketplaceColor(row.marketplace)"
										style="border: none; margin-right: 4px"
										disable-transitions
									>
										{{ getMarketplaceShortName(row.marketplace) }}
									</el-tag>
									<!-- 售/断/异标签 -->
									<el-tag
										size="small"
										:type="row.status === 1 ? 'success' : 'danger'"
										effect="dark"
										disable-transitions
									>
										{{
											row.status === 1
												? "售"
												: row.abnormalOfflineStatus === 1
													? "异"
													: "断"
										}}
									</el-tag>
									<!-- 新品状态标签 -->
									<el-tag
										v-if="row.newProductStatus === 1"
										size="small"
										type="success"
										effect="plain"
										disable-transitions
									>
										新在
									</el-tag>
									<el-tag
										v-else-if="row.newProductStatus === 2"
										size="small"
										type="warning"
										effect="plain"
										disable-transitions
									>
										新无
									</el-tag>
									<el-tag
										v-else-if="row.newProductStatus === 3"
										size="small"
										type="warning"
										effect="plain"
										disable-transitions
									>
										老&gt;7
									</el-tag>
									<el-tag
										v-else-if="row.newProductStatus === 4"
										size="small"
										type="warning"
										effect="plain"
										disable-transitions
									>
										老&gt;14
									</el-tag>
									<el-tag
										v-else-if="row.newProductStatus === 5"
										size="small"
										type="warning"
										effect="plain"
										disable-transitions
									>
										老&gt;30
									</el-tag>
									<!-- 流量标签 - 类目 -->
									<el-tag
										v-if="row.categoryTrafficStatus === 2"
										size="small"
										type="success"
										effect="plain"
										disable-transitions
									>
										类↑
									</el-tag>
									<el-tag
										v-else-if="row.categoryTrafficStatus === 1"
										size="small"
										type="danger"
										effect="plain"
										disable-transitions
									>
										类↓
									</el-tag>
									<!-- 流量标签 - 产品 -->
									<el-tag
										v-if="row.productTrafficStatus === 2"
										size="small"
										type="success"
										effect="plain"
										disable-transitions
									>
										节↑
									</el-tag>
									<el-tag
										v-else-if="row.productTrafficStatus === 1"
										size="small"
										type="danger"
										effect="plain"
										disable-transitions
									>
										节↓
									</el-tag>
									<!-- 库存天数标签 -->
									<el-tag
										v-if="row.inventoryStatusText"
										size="small"
										:type="
											row.inventoryStatusText.includes('>90') ||
											row.inventoryStatusText.includes('<10') ||
											row.inventoryStatusText.includes('<20')
												? 'danger'
												: 'warning'
										"
										effect="dark"
										disable-transitions
									>
										{{ row.inventoryStatusText }}
									</el-tag>
								</div>
							</div>
						</template>
					</el-table-column>

					<!-- ASIN -->
					<el-table-column prop="asin" label="ASIN" min-width="70" fixed="left" />

					<!-- 标题 -->
					<el-table-column
						prop="item_name"
						label="标题"
						show-overflow-tooltip
						min-width="70"
						fixed="left"
					/>

					<!-- 店铺 -->
					<el-table-column
						prop="shop"
						label="店铺"
						min-width="70"
						show-overflow-tooltip
						fixed="left"
					/>

					<!-- MSKU/FNSKU -->
					<el-table-column
						label="MSKU/FNSKU"
						min-width="70"
						show-overflow-tooltip
						fixed="left"
					>
						<template #default="{ row }">
							<div
								v-if="
									!(
										(row.listing?.msku || row.msku) &&
										(row.listing?.msku || row.msku) !== '[]' &&
										String(row.listing?.msku || row.msku).trim() !== ''
									) &&
									!(
										(row.listing?.fnsku || row.fnsku) &&
										(row.listing?.fnsku || row.fnsku) !== '[]' &&
										String(row.listing?.fnsku || row.fnsku).trim() !== ''
									)
								"
							>
								-
							</div>
							<template v-else>
								<div
									v-if="
										(row.listing?.msku || row.msku) &&
										(row.listing?.msku || row.msku) !== '[]' &&
										String(row.listing?.msku || row.msku).trim() !== ''
									"
								>
									{{ row.listing?.msku || row.msku }}
								</div>
								<div
									v-if="
										(row.listing?.fnsku || row.fnsku) &&
										(row.listing?.fnsku || row.fnsku) !== '[]' &&
										String(row.listing?.fnsku || row.fnsku).trim() !== ''
									"
									style="font-size: 12px; color: #909399"
								>
									{{ row.listing?.fnsku || row.fnsku }}
								</div>
							</template>
						</template>
					</el-table-column>

					<!-- 订单毛利率 -->
					<el-table-column
						prop="profit_combined"
						label="订单毛利率"
						min-width="70"
						show-overflow-tooltip
						fixed="left"
					>
						<template #default="{ row }">
							<div v-if="row.profit_rate !== undefined && row.profit_rate !== null">
								{{ (row.profit_rate * 100).toFixed(2) }}%
							</div>
							<div v-else>-</div>
						</template>
					</el-table-column>

					<!-- ============================================================== -->
					<!-- ========== 采购单明细及产品基础信息大整合 ========== -->
					<template
						v-if="
							viewMode === 'product' ||
							viewMode === 'unmatched' ||
							viewMode === 'no_link'
						"
					>
						<!-- 所属采购单号 -->
						<el-table-column label="采购单号" width="160" show-overflow-tooltip>
							<template #default="{ row }">
								<div class="order-sn-cell">
									<span class="sn-text">{{
										row.parent?.order_sn || row.order_sn
									}}</span>
									<el-icon
										class="copy-btn"
										@click="copyText(row.parent?.order_sn || row.order_sn)"
										><copy-document
									/></el-icon>
								</div>
							</template>
						</el-table-column>

						<!-- 物流动态 -->
						<el-table-column label="物流动态" width="120" align="center">
							<template #default="{ row }">
								<div
									v-if="
										row.logistics_status ||
										getLogisticsPackageCount(row.parent || row)
									"
									style="
										display: flex;
										flex-direction: column;
										align-items: center;
										justify-content: center;
										gap: 6px;
										padding: 4px 0;
									"
								>
									<el-tooltip
										v-if="row.logistics_status"
										:content="
											row.logistics_status_reason || row.logistics_status_text
										"
										placement="top"
									>
										<el-tag
											:type="getLogisticsTagType(row.logistics_status)"
											size="small"
											effect="plain"
											style="cursor: pointer"
											@click="
												openLogistics({
													order_sn: row.parent?.order_sn || row.order_sn
												})
											"
										>
											{{ row.logistics_status_text }}
										</el-tag>
									</el-tooltip>
									<div
										v-if="getLogisticsPackageCount(row.parent || row)"
										style="
											color: #409eff;
											font-size: 12px;
											cursor: pointer;
											line-height: 1;
											user-select: none;
										"
										@click="
											openLogistics({
												order_sn: row.parent?.order_sn || row.order_sn
											})
										"
										title="点击查看物流轨迹"
									>
										{{ getLogisticsPackageCount(row.parent || row) }}条明细 &gt;
									</div>
								</div>
								<span v-else style="color: #c0c4cc">-</span>
							</template>
						</el-table-column>

						<!-- 数据状态 (合并了算法) -->
						<el-table-column label="数据状态" width="100" align="center">
							<template #default="{ row }">
								<div
									style="
										display: flex;
										flex-direction: column;
										align-items: center;
										justify-content: center;
										gap: 6px;
										padding: 4px 0;
									"
								>
									<template v-if="row.analysis_record_id">
										<el-tag type="success" size="small" effect="plain"
											>正常</el-tag
										>
										<div
											style="
												color: #409eff;
												font-size: 12px;
												cursor: pointer;
												line-height: 1;
												user-select: none;
											"
											@click="showAnalysisDetail(row)"
											title="查看算法详情"
										>
											<el-icon style="vertical-align: -1px; margin-right: 2px"
												><data-analysis /></el-icon
											>查看算法 &gt;
										</div>
									</template>
									<template v-else>
										<el-tooltip
											content="该产品未关联算法分析记录"
											placement="top"
										>
											<el-tag
												type="warning"
												size="small"
												effect="plain"
												style="cursor: help"
												>未关联</el-tag
											>
										</el-tooltip>
									</template>
								</div>
							</template>
						</el-table-column>

						<!-- 供应商 -->
						<el-table-column label="供应商" min-width="130" show-overflow-tooltip>
							<template #default="{ row }">
								{{ row.parent?.supplier_name || "-" }}
							</template>
						</el-table-column>

						<!-- 单据状态 -->
						<el-table-column label="采购状态" width="100" align="center">
							<template #default="{ row }">
								<el-tag
									:type="getStatusType(row.parent?.status)"
									size="small"
									effect="dark"
								>
									{{ row.parent?.status_text || "-" }}
								</el-tag>
							</template>
						</el-table-column>

						<!-- 采购计划号 -->
						<el-table-column label="采购计划" width="160" show-overflow-tooltip>
							<template #default="{ row }">
								<span
									v-if="row.plan_sn"
									class="plan-sn-link"
									@click="copyText(row.plan_sn)"
								>
									{{ row.plan_sn }}
								</span>
								<span v-else>-</span>
							</template>
						</el-table-column>

						<!-- 变体 -->
						<el-table-column prop="variant_text" label="变体" min-width="70">
							<template #default="{ row }">
								<el-tooltip
									placement="top"
									v-if="
										row.variant_text &&
										row.variant_text.length > 0 &&
										row.variant_text !== '[]'
									"
								>
									<template #content>
										<div
											v-for="(item, index) in typeof row.variant_text ===
											'string'
												? JSON.parse(row.variant_text)
												: row.variant_text"
											:key="index"
										>
											{{ item.attr_name }}: {{ item.attr_value }}
										</div>
									</template>
									<span>
										{{
											(typeof row.variant_text === "string"
												? JSON.parse(row.variant_text)
												: row.variant_text
											)
												.map((item: any) => item.attr_value)
												.join(", ")
										}}
									</span>
								</el-tooltip>
								<span v-else>-</span>
							</template>
						</el-table-column>

						<!-- 产品图片 -->
						<el-table-column label="产品图片" width="70" align="center">
							<template #default="{ row }">
								<el-image
									class="product-pic"
									:src="row.plan_pic_url"
									:preview-src-list="row.plan_pic_url ? [row.plan_pic_url] : []"
									fit="contain"
									preview-teleported
								>
									<template #error>
										<div class="no-pic">
											<el-icon><picture /></el-icon>
										</div>
									</template>
								</el-image>
							</template>
						</el-table-column>

						<!-- 品名 -->
						<el-table-column
							prop="product_name"
							label="品名"
							min-width="200"
							show-overflow-tooltip
						/>

						<!-- SKU -->
						<el-table-column prop="sku" label="SKU" width="150" show-overflow-tooltip />

						<!-- 采购单价 -->
						<el-table-column label="采购单价" width="100" align="right">
							<template #default="{ row }">
								{{ row.price }}
							</template>
						</el-table-column>

						<!-- 采购金额 -->
						<el-table-column label="采购金额" width="110" align="right">
							<template #default="{ row }">
								<span class="amount-text">{{ row.amount }}</span>
							</template>
						</el-table-column>

						<!-- 计划数 -->
						<el-table-column label="计划数" width="80" align="center">
							<template #default="{ row }">
								<el-popover
									v-if="row.plan_sn"
									placement="right"
									:width="400"
									trigger="hover"
									popper-class="plan-hover-popover"
									@show="onMouseEnterPlan([row.plan_sn])"
									@after-leave="onMouseLeavePlan"
								>
									<template #reference>
										<span
											style="
												cursor: pointer;
												padding: 2px 5px;
												color: #409eff;
												border-bottom: 1px dashed #409eff;
											"
										>
											{{ row.quantity_plan }}
										</span>
									</template>
									<div v-loading="hoverLoading" style="min-height: 50px">
										<div
											v-if="hoverIsDegraded"
											style="
												color: #e6a23c;
												font-size: 12px;
												margin-bottom: 8px;
												display: flex;
												align-items: center;
												gap: 4px;
											"
										>
											<el-icon><Warning /></el-icon
											>网络异常，当前显示为本地最新数据
										</div>
										<template
											v-if="!hoverLoading && hoverPlanDetails[row.plan_sn]"
										>
											<div
												style="
													font-weight: bold;
													margin-bottom: 5px;
													font-size: 13px;
												"
											>
												{{ row.plan_sn }}
											</div>
											<div style="display: flex; gap: 8px">
												<el-image
													:src="hoverPlanDetails[row.plan_sn].pic_url"
													style="
														width: 48px;
														height: 48px;
														border-radius: 4px;
														border: 1px solid #eee;
													"
													fit="cover"
												/>
												<div
													style="
														flex: 1;
														font-size: 12px;
														line-height: 1.6;
													"
												>
													<div
														class="text-ellipsis-2"
														:title="
															hoverPlanDetails[row.plan_sn]
																.product_name
														"
														style="color: #303133"
													>
														{{
															hoverPlanDetails[row.plan_sn]
																.product_name
														}}
													</div>
													<div style="color: #909399; margin-top: 2px">
														SKU: {{ hoverPlanDetails[row.plan_sn].sku }}
													</div>
													<div
														style="
															margin-top: 2px;
															display: flex;
															align-items: center;
															justify-content: space-between;
														"
													>
														<span>
															计划数
															<span
																style="
																	color: #f56c6c;
																	font-weight: bold;
																	font-family: Tahoma;
																"
																>{{
																	hoverPlanDetails[row.plan_sn]
																		.quantity_plan
																}}</span
															>
														</span>
														<el-tag
															size="small"
															:type="
																hoverPlanDetails[row.plan_sn]
																	.is_deleted_remote === 1
																	? 'danger'
																	: 'info'
															"
															effect="plain"
														>
															{{
																hoverPlanDetails[row.plan_sn]
																	.is_deleted_remote === 1
																	? "领星已删"
																	: hoverPlanDetails[row.plan_sn]
																			.status_text
															}}
														</el-tag>
													</div>
													<div
														style="
															margin-top: 4px;
															font-size: 11px;
															color: #b6b8bd;
															display: flex;
															align-items: center;
															gap: 4px;
														"
													>
														<el-icon><Refresh /></el-icon>
														最后更新:
														{{
															formatSyncTime(
																hoverPlanDetails[row.plan_sn]
																	.sync_time
															)
														}}
													</div>
												</div>
											</div>
										</template>
										<template v-else-if="!hoverLoading">
											<div
												style="
													color: #909399;
													text-align: center;
													padding: 10px 0;
												"
											>
												暂无此计划明细数据
											</div>
										</template>
									</div>
								</el-popover>
								<span v-else>{{ row.quantity_plan }}</span>
							</template>
						</el-table-column>

						<!-- 实际数 -->
						<el-table-column label="实际数" width="80" align="center">
							<template #default="{ row }">
								<span class="highlight-qty">{{ row.quantity_real }}</span>
							</template>
						</el-table-column>

						<!-- 待到货 (原生业务字段) -->
						<el-table-column
							prop="quantity_receive"
							label="待到货"
							width="80"
							align="center"
						/>

						<!-- 真实的预计发货数量 (V2版排版) -->
						<el-table-column label="预计发货数量" width="110" align="center">
							<template #default="{ row }">
								<el-popover
									v-if="
										shipmentMetrics.byPlan[row.plan_sn] &&
										shipmentMetrics.byPlan[row.plan_sn].items.length > 0
									"
									placement="right"
									:width="360"
									trigger="hover"
									popper-class="ship-hover-popover"
								>
									<template #reference>
										<span
											style="
												cursor: pointer;
												padding: 2px 5px;
												color: #409eff;
												border-bottom: 1px dashed #409eff;
											"
										>
											{{ shipmentMetrics.byPlan[row.plan_sn].totalQty }}
										</span>
									</template>
									<div style="max-height: 500px; overflow-y: auto">
										<!-- 顶部汇总条 -->
										<div
											style="
												display: flex;
												justify-content: space-between;
												align-items: center;
												margin-bottom: 8px;
												padding-bottom: 6px;
												border-bottom: 2px solid #ebeef5;
											"
										>
											<span
												style="
													font-weight: bold;
													font-size: 13px;
													color: #303133;
												"
												>预计发货明细 (按批次)</span
											>
											<span style="font-size: 12px"
												>合计:
												<span
													style="
														color: #f56c6c;
														font-weight: bold;
														font-family: Tahoma;
														font-size: 14px;
													"
													>{{
														shipmentMetrics.byPlan[row.plan_sn].totalQty
													}}</span
												></span
											>
										</div>

										<!-- 批次列表 -->
										<div
											style="
												max-height: 400px;
												overflow-y: auto;
												padding-right: 5px;
											"
										>
											<div
												v-for="(item, idx) in shipmentMetrics.byPlan[
													row.plan_sn
												].items"
												:key="idx"
												:style="{
													marginBottom: '10px',
													paddingBottom: '10px',
													borderBottom:
														idx ===
														shipmentMetrics.byPlan[row.plan_sn].items
															.length -
															1
															? 'none'
															: '1px dashed #ebeef5'
												}"
											>
												<div
													style="
														display: flex;
														justify-content: space-between;
														align-items: flex-start;
														margin-bottom: 4px;
													"
												>
													<div
														style="
															font-weight: bold;
															font-size: 13px;
															color: #303133;
														"
													>
														批次号: {{ item.seq }}
													</div>
													<el-tag
														size="small"
														:type="
															item.status === -5
																? 'danger'
																: item.status === 0
																	? 'warning'
																	: item.status === 5
																		? 'info'
																		: item.status === 10
																			? 'success'
																			: 'primary'
														"
														effect="plain"
														style="
															height: 20px;
															padding: 0 4px;
															line-height: 18px;
														"
														>{{ item.status_text }}</el-tag
													>
												</div>

												<div
													style="
														font-size: 11px;
														color: #909399;
														margin-bottom: 4px;
													"
												>
													创于: {{ item.createTime || "-" }} | 运输:
													{{
														{
															air: "空运",
															sea: "海运",
															express: "快递",
															rail: "铁运"
														}[item.shipping_method] ||
														item.shipping_method ||
														"-"
													}}
												</div>
												<div
													style="
														font-size: 11px;
														color: #606266;
														margin-bottom: 4px;
													"
												>
													发货仓库: {{ item.sname || "-" }} /
													{{ item.wname || "-" }}
												</div>
												<div
													v-if="item.batch_remark"
													style="
														font-size: 11px;
														color: #606266;
														margin-bottom: 4px;
													"
												>
													单据备注:
													<span style="color: #f56c6c">{{
														item.batch_remark
													}}</span>
												</div>

												<!-- 伪装成嵌套内容的该明细自身数据 -->
												<div
													style="
														margin-top: 6px;
														padding: 6px;
														background-color: #fafbfc;
														border-left: 2px solid #dcdfe6;
														border-radius: 0 4px 4px 0;
													"
												>
													<div
														style="font-size: 12px; margin-bottom: 2px"
													>
														发货量:
														<span
															style="
																color: #f56c6c;
																font-weight: bold;
																font-family: Tahoma;
															"
															>{{ item.shipment_plan_quantity }}</span
														>
													</div>
													<div
														v-if="item.shipment_mws_sn"
														style="
															font-size: 11px;
															color: #909399;
															margin-bottom: 2px;
														"
													>
														发货单: {{ item.shipment_mws_sn }}
													</div>
													<div
														v-if="item.remark"
														style="font-size: 11px; color: #e6a23c"
													>
														明细备注: {{ item.remark }}
													</div>
												</div>
											</div>
										</div>
									</div>
								</el-popover>
								<span v-else>-</span>
							</template>
						</el-table-column>

						<!-- 实际发货数量（真实数据） -->
						<el-table-column label="实际发货数量" width="110" align="center">
							<template #default="{ row }">
								<template v-if="row.plan_sn && getActualDataForPlan(row.plan_sn)">
									<el-popover
										placement="right"
										:width="350"
										trigger="hover"
										popper-class="ship-hover-popover"
									>
										<template #reference>
											<span
												style="
													cursor: pointer;
													padding: 2px 5px;
													color: #67c23a;
													font-weight: bold;
													border-bottom: 1px dashed #67c23a;
												"
											>
												{{
													getActualDataForPlan(row.plan_sn)
														?.totalActualQty
												}}
											</span>
										</template>
										<div>
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
															>{{
																getActualDataForPlan(row.plan_sn)
																	?.totalActualQty || 0
															}}</span
														>
													</div>
													<div style="font-size: 12px; color: #606266">
														计划总量
														<span
															style="
																font-family: Tahoma, sans-serif;
																font-weight: bold;
															"
															>{{
																getActualDataForPlan(row.plan_sn)
																	?.totalPlanQty || 0
															}}</span
														>
													</div>
												</div>
												<el-progress
													:percentage="
														Math.min(
															((getActualDataForPlan(row.plan_sn)
																?.totalActualQty || 0) /
																(getActualDataForPlan(row.plan_sn)
																	?.totalPlanQty || 1)) *
																100,
															100
														)
													"
													:show-text="false"
													color="#67C23A"
													:stroke-width="6"
												/>
											</div>

											<!-- 2. 中间：确认物质实体 (商品卡片) -->
											<div
												v-if="
													getActualDataForPlan(row.plan_sn)?.productInfo
														?.product_name
												"
												style="
													display: flex;
													align-items: center;
													gap: 10px;
													margin-bottom: 12px;
													padding: 8px;
													background: #ffffff;
													border: 1px solid #ebeef5;
													border-radius: 6px;
													box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
												"
											>
												<el-image
													v-if="
														getActualDataForPlan(row.plan_sn)
															?.productInfo?.small_image_url
													"
													:src="
														getActualDataForPlan(row.plan_sn)
															?.productInfo?.small_image_url
													"
													:preview-src-list="[
														getActualDataForPlan(row.plan_sn)
															?.productInfo?.small_image_url
													]"
													fit="cover"
													style="
														width: 36px;
														height: 36px;
														border-radius: 4px;
														flex-shrink: 0;
														cursor: zoom-in;
													"
												/>
												<div style="overflow: hidden; flex: 1">
													<div
														style="
															font-size: 13px;
															font-weight: bold;
															color: #303133;
															white-space: nowrap;
															overflow: hidden;
															text-overflow: ellipsis;
															margin-bottom: 2px;
														"
														:title="
															getActualDataForPlan(row.plan_sn)
																?.productInfo?.product_name
														"
													>
														{{
															getActualDataForPlan(row.plan_sn)
																?.productInfo?.product_name
														}}
													</div>
													<div
														style="
															font-size: 11px;
															color: #909399;
															display: flex;
															align-items: center;
															gap: 4px;
														"
													>
														SKU:
														{{
															getActualDataForPlan(row.plan_sn)
																?.productInfo?.sku
														}}
													</div>
												</div>
											</div>

											<!-- 3. 底部：追踪履约轨迹 (发货单列) -->
											<div
												style="
													max-height: 200px;
													overflow-y: auto;
													padding-right: 4px;
												"
											>
												<div
													v-for="(detail, idx) in getActualDataForPlan(
														row.plan_sn
													)?.details"
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
														<div
															style="
																display: flex;
																align-items: center;
																gap: 6px;
															"
														>
															<span style="font-size: 14px">🚚</span>
															<span
																style="
																	font-family:
																		&quot;Consolas&quot;,
																		&quot;Courier New&quot;,
																		monospace;
																	font-size: 14px;
																	font-weight: bold;
																	color: #303133;
																"
																>{{
																	detail.shipment_sn || "-"
																}}</span
															>
														</div>
														<el-tag
															size="small"
															:type="
																detail.is_final
																	? 'success'
																	: 'primary'
															"
															effect="light"
															style="border: none"
															>{{
																detail.shipment_status_name ||
																"进行中"
															}}</el-tag
														>
													</div>
													<div
														style="
															display: flex;
															justify-content: space-between;
															align-items: center;
															font-size: 12px;
														"
													>
														<div style="color: #606266">
															<span style="color: #909399"
																>数量:</span
															>
															<span
																style="
																	color: #303133;
																	font-weight: bold;
																	font-family: Tahoma, sans-serif;
																"
																>{{
																	detail.shipment_list_quantity ||
																	0
																}}</span
															>
														</div>
														<div style="color: #606266">
															<span style="color: #909399"
																>物流:</span
															>
															{{ detail.method_name || "-" }}
														</div>
														<div
															v-if="detail.shipment_time"
															style="color: #909399; font-size: 11px"
														>
															{{
																detail.shipment_time.substring(
																	5,
																	16
																)
															}}
														</div>
													</div>
												</div>
											</div>
										</div>
									</el-popover>
								</template>
								<span v-else style="color: #c0c4cc">-</span>
							</template>
						</el-table-column>

						<!-- 差异（计划 vs 实际） -->
						<el-table-column label="差异" width="70" align="center">
							<template #default="{ row }">
								<template v-if="row.plan_sn && getActualDataForPlan(row.plan_sn)">
									<span
										:style="{
											color:
												(getActualDataForPlan(row.plan_sn)
													?.totalActualQty || 0) -
													(shipmentMetrics.byPlan[row.plan_sn]
														?.totalQty || 0) ===
												0
													? '#67C23A'
													: '#F56C6C',
											fontWeight: 'bold'
										}"
									>
										{{
											(getActualDataForPlan(row.plan_sn)?.totalActualQty ||
												0) -
												(shipmentMetrics.byPlan[row.plan_sn]?.totalQty ||
													0) >
											0
												? "+"
												: ""
										}}{{
											(getActualDataForPlan(row.plan_sn)?.totalActualQty ||
												0) -
											(shipmentMetrics.byPlan[row.plan_sn]?.totalQty || 0)
										}}
									</span>
								</template>
								<span v-else style="color: #c0c4cc">-</span>
							</template>
						</el-table-column>

						<!-- 备注 -->
						<el-table-column
							prop="remark"
							label="备注"
							min-width="150"
							show-overflow-tooltip
						/>

						<!-- 售价 -->
						<el-table-column prop="listing_price" label="售价" min-width="70" />

						<!-- 预估FBA费 -->
						<el-table-column prop="fba_fee" label="预估FBA费" min-width="70" />
					</template>
					<!-- ============================================================== -->

					<!-- 实时销量 -->
					<el-table-column
						prop="yesterday_realtime_sales"
						label="实时销量"
						min-width="75"
					>
						<template #default="{ row }">
							<el-popover placement="top" width="auto" trigger="hover">
								<template #reference>
									<span
										style="cursor: pointer; border-bottom: 1px dashed #409eff"
									>
										{{ getRealtimeSalesVolume(row) ?? "-" }}
									</span>
								</template>
								<div
									v-if="row?.restocking?.salesInfo?.recentSalesTrendList?.length"
								>
									<div style="display: flex; gap: 10px">
										<div
											v-for="(item, index) in row.restocking.salesInfo
												.recentSalesTrendList"
											:key="index"
											style="text-align: center"
										>
											<div
												style="
													font-size: 12px;
													color: #909399;
													margin-bottom: 5px;
													white-space: nowrap;
												"
											>
												{{ item.date }}
											</div>
											<div style="font-weight: bold">{{ item.volume }}</div>
										</div>
									</div>
								</div>
								<div v-else>暂无近期销量数据</div>
							</el-popover>
						</template>
					</el-table-column>

					<!-- 日均销量(3/7/14) -->
					<el-table-column
						prop="restocking_sales_avg"
						label="日均销量(3/7/14)"
						min-width="75"
					>
						<template #default="{ row }">
							<el-tooltip v-if="row.restocking?.salesInfo" placement="top">
								<template #content>
									{{ row.restocking.salesInfo.salesAvg3 || 0 }}/{{
										row.restocking.salesInfo.salesAvg7 || 0
									}}/{{ row.restocking.salesInfo.salesAvg14 || 0 }}
								</template>
								<span style="cursor: help">
									{{ row.restocking.salesInfo.salesAvg3 || 0 }}/{{
										row.restocking.salesInfo.salesAvg7 || 0
									}}/{{ row.restocking.salesInfo.salesAvg14 || 0 }}
								</span>
							</el-tooltip>
							<span v-else>-</span>
						</template>
					</el-table-column>

					<!-- 可售天数(总/FBA) -->
					<el-table-column label="可售天数(总/FBA)" min-width="78" show-overflow-tooltip>
						<template #default="{ row }">
							{{ getSellableDaysTotal(row) }} / {{ getSellableDaysFba(row) }}
						</template>
					</el-table-column>

					<!-- 日均销量 (归一化趋势图) -->
					<el-table-column prop="dailyAvgSales" label="日均销量" min-width="65">
						<template #default="{ row }">
							<el-popover
								placement="top"
								:width="320"
								trigger="hover"
								:hide-after="50"
							>
								<template #reference>
									<div style="cursor: pointer; color: #409eff; font-weight: 500">
										{{ row.dailyAvgSales || "-" }}
									</div>
								</template>
								<!-- 嵌入趋势图组件 -->
								<div class="trend-chart-wrapper" style="padding: 0">
									<listing-trend-chart
										v-if="row.listing?.product_code"
										:product-code="row.listing.product_code"
										:asin="row.listing.asin || row.asin"
										:marketplace="row.listing.marketplace || row.marketplace"
										:daily-avg-sales="Number(row.dailyAvgSales || 0)"
									/>
									<div
										v-else
										style="
											padding: 10px;
											color: #909399;
											text-align: center;
											font-size: 12px;
										"
									>
										暂无关联Listing数据
									</div>
								</div>
							</el-popover>
						</template>
					</el-table-column>

					<!-- FBA/在途/本地 -->
					<el-table-column prop="inventory_details" min-width="145" align="center">
						<template #header="{ column }">
							<div
								style="
									display: flex;
									justify-content: center;
									align-items: center;
									gap: 2px;
									font-size: 13px;
									white-space: nowrap;
								"
							>
								<!-- FBA排序区 -->
								<div
									class="sort-clickable-area"
									@click.stop="onSort('afn_fulfillable_quantity')"
									:style="{
										color:
											currentSort.prop === 'afn_fulfillable_quantity'
												? '#409eff'
												: '#606266',
										fontWeight:
											currentSort.prop === 'afn_fulfillable_quantity'
												? 'bold'
												: 'normal'
									}"
									title="点击按FBA库存排序"
								>
									<span>FBA</span>
									<span class="sort-arrows">
										<el-icon
											:size="11"
											:style="{
												color:
													currentSort.prop ===
														'afn_fulfillable_quantity' &&
													currentSort.order === 'asc'
														? '#409eff'
														: '#c0c4cc',
												marginBottom: '-4px'
											}"
											><CaretTop
										/></el-icon>
										<el-icon
											:size="11"
											:style="{
												color:
													currentSort.prop ===
														'afn_fulfillable_quantity' &&
													currentSort.order === 'desc'
														? '#409eff'
														: '#c0c4cc',
												marginTop: '-4px'
											}"
											><CaretBottom
										/></el-icon>
									</span>
								</div>

								<span style="color: #ebeef5; margin: 0 2px">|</span>

								<!-- 在途排序区 -->
								<div
									class="sort-clickable-area"
									@click.stop="onSort('restocking_fba_shipping')"
									:style="{
										color:
											currentSort.prop === 'restocking_fba_shipping'
												? '#409eff'
												: '#606266',
										fontWeight:
											currentSort.prop === 'restocking_fba_shipping'
												? 'bold'
												: 'normal'
									}"
									title="点击按在途库存排序"
								>
									<span>在途</span>
									<span class="sort-arrows">
										<el-icon
											:size="11"
											:style="{
												color:
													currentSort.prop ===
														'restocking_fba_shipping' &&
													currentSort.order === 'asc'
														? '#409eff'
														: '#c0c4cc',
												marginBottom: '-4px'
											}"
											><CaretTop
										/></el-icon>
										<el-icon
											:size="11"
											:style="{
												color:
													currentSort.prop ===
														'restocking_fba_shipping' &&
													currentSort.order === 'desc'
														? '#409eff'
														: '#c0c4cc',
												marginTop: '-4px'
											}"
											><CaretBottom
										/></el-icon>
									</span>
								</div>

								<span style="color: #ebeef5; margin: 0 2px">|</span>

								<!-- 本地排序区 -->
								<div
									class="sort-clickable-area"
									@click.stop="onSort('restocking_local_valid')"
									:style="{
										color:
											currentSort.prop === 'restocking_local_valid'
												? '#409eff'
												: '#606266',
										fontWeight:
											currentSort.prop === 'restocking_local_valid'
												? 'bold'
												: 'normal'
									}"
									title="点击按本地库存排序"
								>
									<span>本地</span>
									<span class="sort-arrows">
										<el-icon
											:size="11"
											:style="{
												color:
													currentSort.prop === 'restocking_local_valid' &&
													currentSort.order === 'asc'
														? '#409eff'
														: '#c0c4cc',
												marginBottom: '-4px'
											}"
											><CaretTop
										/></el-icon>
										<el-icon
											:size="11"
											:style="{
												color:
													currentSort.prop === 'restocking_local_valid' &&
													currentSort.order === 'desc'
														? '#409eff'
														: '#c0c4cc',
												marginTop: '-4px'
											}"
											><CaretBottom
										/></el-icon>
									</span>
								</div>
							</div>
						</template>
						<template #default="{ row }">
							<div
								style="
									display: flex;
									justify-content: center;
									align-items: center;
									gap: 2px;
								"
							>
								<el-tooltip placement="top" effect="light">
									<template #content>
										<div v-if="row.restocking?.fbaValidList?.length">
											<el-table
												:data="row.restocking.fbaValidList"
												size="small"
												border
												style="max-width: 950px"
											>
												<el-table-column
													prop="fnsku"
													label="FNSKU"
													min-width="140"
												/>
												<el-table-column
													prop="msku"
													label="msku"
													min-width="120"
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
												/>
											</el-table>
										</div>
										<div v-else>暂无FBA库存明细</div>
									</template>
									<span style="cursor: help; color: #409eff">{{
										getFbaInventoryQuantity(row)
									}}</span>
								</el-tooltip>
								<span style="color: #dcdfe6; margin: 0 2px">/</span>
								<el-tooltip placement="top" effect="light">
									<template #content>
										<div v-if="row.restocking?.fbaShippingList?.length">
											<el-table
												:data="row.restocking.fbaShippingList"
												size="small"
												border
												style="max-width: 950px"
											>
												<el-table-column
													prop="orderSn"
													label="货件单号"
													min-width="140"
												/>
												<el-table-column
													prop="shippingOrderSn"
													label="发货单号"
													min-width="140"
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
												/>
												<el-table-column
													prop="amazonSaleDate"
													label="预计可售时间"
													min-width="160"
												/>
											</el-table>
										</div>
										<div v-else>暂无在途货件</div>
									</template>
									<span style="cursor: help; color: #409eff">{{
										getRestockingFbaShippingQuantity(row)
									}}</span>
								</el-tooltip>
								<span style="color: #dcdfe6; margin: 0 2px">/</span>
								<el-tooltip placement="top" effect="light">
									<template #content>
										<div
											v-if="
												row.restocking?.extInfo?.localValidDetailList
													?.length
											"
										>
											<el-table
												:data="row.restocking.extInfo.localValidDetailList"
												size="small"
												border
												style="max-width: 950px"
											>
												<el-table-column
													prop="whName"
													label="仓库"
													min-width="120"
												/>
												<el-table-column
													prop="sku"
													label="SKU"
													min-width="120"
												/>
												<el-table-column
													prop="storeName"
													label="店铺"
													min-width="140"
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
												/>
												<el-table-column
													prop="remark"
													label="备注"
													min-width="160"
												/>
											</el-table>
										</div>
										<div v-else>暂无本地可用明细</div>
									</template>
									<span style="cursor: help; color: #409eff">{{
										row.restocking_local_valid ?? "-"
									}}</span>
								</el-tooltip>
							</div>
						</template>
					</el-table-column>

					<!-- 总库存 -->
					<el-table-column prop="restocking_stock_total" label="总库存" min-width="70" />

					<!-- 待交付/采购计划 -->
					<el-table-column
						prop="delivery_purchase_combined"
						label="待交付/采购计划"
						min-width="90"
					>
						<template #default="{ row }">
							{{ row.restocking_reserved_customerorders || 0 }}/{{
								row.restocking_purchase_plan || 0
							}}
						</template>
					</el-table-column>

					<el-table-column
						prop="restocking_estimated_sale_quantity"
						label="领星建议量"
						min-width="90"
					>
						<template #default="{ row }">
							<el-tooltip placement="top" effect="light">
								<template #content>
									<div
										v-if="
											row.restocking?.extInfo?.fbaShippingPlanDetailList
												?.length
										"
									>
										<el-table
											:data="row.restocking.extInfo.fbaShippingPlanDetailList"
											size="small"
											border
											style="max-width: 950px"
										>
											<el-table-column
												prop="shippingPlanSn"
												label="发货计划单号"
												min-width="140"
											/>
											<el-table-column
												prop="shipmentSn"
												label="货件号"
												min-width="140"
											/>
											<el-table-column
												prop="shipmentOrderSn"
												label="发货单号"
												min-width="120"
											/>
											<el-table-column
												prop="whName"
												label="发货仓库"
												min-width="120"
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
											/>
										</el-table>
									</div>
									<div v-else>暂无预计发货量明细</div>
								</template>
								<span style="cursor: help; color: #409eff">{{
									row.restocking_estimated_sale_quantity ?? "-"
								}}</span>
							</el-tooltip>
						</template>
					</el-table-column>

					<!-- 断货时间 -->
					<el-table-column
						prop="restocking_out_stock_date"
						label="断货时间"
						min-width="70"
					/>

					<!-- FBA库龄 -->
					<el-table-column prop="restocking_fba_aged" label="FBA库龄" min-width="70" />

					<!-- 本地仓库龄 -->
					<el-table-column prop="restocking_local_aged" label="本地仓库龄" min-width="70">
						<template #default="{ row }">
							<el-tooltip placement="top">
								<template #content>
									<div v-if="row.restocking?.localAgedInfo">
										<div>
											段1: {{ row.restocking.localAgedInfo.section1 || 0 }}
										</div>
										<div>
											段2: {{ row.restocking.localAgedInfo.section2 || 0 }}
										</div>
										<div>
											段3: {{ row.restocking.localAgedInfo.section3 || 0 }}
										</div>
										<div>
											段4: {{ row.restocking.localAgedInfo.section4 || 0 }}
										</div>
									</div>
									<div v-else>-</div>
								</template>
								<span style="cursor: help">{{
									row.restocking?.localAgedInfo?.section1 ?? "-"
								}}</span>
							</el-tooltip>
						</template>
					</el-table-column>

					<!-- 海外仓可用 -->
					<el-table-column
						prop="restocking_oversea_valid"
						label="海外仓可用"
						min-width="70"
					/>

					<!-- 建议采购日 -->
					<el-table-column
						prop="restocking_sug_date_purchase"
						label="建议采购日"
						min-width="70"
					/>

					<!-- 建议本地发货日 -->
					<el-table-column
						prop="restocking_sug_date_send_local"
						label="建议本地发货日"
						min-width="70"
					/>

					<!-- 补货备注 -->
					<el-table-column
						prop="restocking_ext_remark"
						label="补货备注"
						min-width="70"
						show-overflow-tooltip
					/>

					<!-- 平台费 -->
					<el-table-column prop="referral_fee" label="平台费" min-width="70" />

					<!-- 大类排名 -->
					<el-table-column
						prop="rank_combined"
						label="大类排名"
						min-width="70"
						show-overflow-tooltip
					>
						<template #default="{ row }">
							<div style="font-size: 12px; word-break: break-all">
								{{ Array.isArray(row.rank) ? row.rank.join(", ") : row.rank }}
							</div>
							<div style="font-size: 12px; color: #909399" v-if="row.seller_category">
								{{ row.seller_category.join(" > ") }}
							</div>
						</template>
					</el-table-column>

					<!-- 节点排名 -->
					<el-table-column
						prop="small_rank"
						label="节点排名"
						min-width="70"
						show-overflow-tooltip
					>
						<template #default="{ row }">
							<div style="font-size: 12px; word-break: break-all">
								{{
									Array.isArray(row.small_rank)
										? row.small_rank.join(", ")
										: row.small_rank
								}}
							</div>
						</template>
					</el-table-column>

					<!-- 亚马逊品牌 -->
					<el-table-column
						prop="seller_brand"
						label="亚马逊品牌"
						min-width="70"
						show-overflow-tooltip
					/>

					<!-- 品名/SKU -->
					<el-table-column
						prop="local_combined"
						label="品名/SKU"
						min-width="70"
						show-overflow-tooltip
					>
						<template #default="{ row }">
							<div style="font-weight: bold">{{ row.local_name }}</div>
							<div style="font-size: 12px; color: #909399">{{ row.local_sku }}</div>
						</template>
					</el-table-column>

					<!-- 分类 -->
					<el-table-column
						prop="category_text"
						label="分类"
						show-overflow-tooltip
						min-width="70"
					/>

					<!-- 评分/Rating总数 -->
					<el-table-column prop="rating_combined" label="评分/Rating总数" min-width="70">
						<template #default="{ row }">
							<div>{{ row.stars }}</div>
							<div style="font-size: 12px; color: #909399">{{ row.reviews_num }}</div>
						</template>
					</el-table-column>

					<!-- 创建时间 -->
					<el-table-column
						prop="open_date_time"
						label="创建时间"
						min-width="70"
						show-overflow-tooltip
					/>

					<!-- 负责人 -->
					<el-table-column prop="principal_realname" label="负责人" min-width="70" />

					<!-- 备注（产品Listing的） -->
					<el-table-column
						prop="remark_listing"
						label="备注"
						min-width="70"
						show-overflow-tooltip
					/>

					<!-- 首单时间 -->
					<el-table-column
						prop="first_order_time"
						label="首单时间"
						min-width="70"
						show-overflow-tooltip
					/>
				</template>
				<!-- 单据视图：原有列 -->
				<el-table-column
					v-if="viewMode === 'order'"
					prop="custom_order_sn"
					label="自定义单号"
					min-width="150"
					show-overflow-tooltip
				/>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="supplier_name"
					label="供应商"
					min-width="150"
					show-overflow-tooltip
				/>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="purchase_type_text"
					label="采购类型"
					width="100"
					align="center"
				>
					<template #default="{ row }">
						<el-tag size="small" :type="row.purchase_type == 2 ? 'warning' : 'info'">
							{{
								row.purchase_type_text || (row.purchase_type == 2 ? "1688" : "普通")
							}}
						</el-tag>
					</template>
				</el-table-column>

				<!-- ========== 金额信息区 ========== -->
				<el-table-column
					v-if="viewMode === 'order'"
					label="货款金额"
					width="110"
					align="right"
				>
					<template #default="{ row }">
						<span class="amount-text">{{ row.icon }}{{ row.amount_total }}</span>
					</template>
				</el-table-column>

				<el-table-column v-if="viewMode === 'order'" label="运费" width="90" align="right">
					<template #default="{ row }">
						<span class="fee-text">{{ row.shipping_price || 0 }}</span>
					</template>
				</el-table-column>
				<el-table-column
					v-if="viewMode === 'order'"
					label="其他费用"
					width="100"
					align="right"
				>
					<template #default="{ row }">
						<span class="fee-text">{{ row.other_fee || 0 }}</span>
					</template>
				</el-table-column>
				<el-table-column
					v-if="viewMode === 'order'"
					label="订单总额"
					width="110"
					align="right"
				>
					<template #default="{ row }">
						<span class="total-text">{{ row.icon }}{{ row.total_price }}</span>
					</template>
				</el-table-column>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="purchase_currency"
					label="币种"
					width="70"
					align="center"
				/>

				<!-- ========== 状态信息区 ========== -->
				<el-table-column
					v-if="viewMode === 'order'"
					prop="status_text"
					label="采购状态"
					width="100"
					align="center"
				>
					<template #default="{ row }">
						<el-tag :type="getStatusType(row.status)" size="small" effect="dark">
							{{ row.status_text }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="status_shipped_text"
					label="到货状态"
					width="100"
					align="center"
				>
					<template #default="{ row }">
						<el-tag :type="getShippedType(row.status_shipped)" size="small">
							{{ row.status_shipped_text }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="pay_status_text"
					label="付款状态"
					width="100"
					align="center"
				>
					<template #default="{ row }">
						<span :class="['pay-text', getPayClass(row.pay_status)]">
							{{ row.pay_status_text }}
						</span>
					</template>
				</el-table-column>

				<!--
				========== 数据状态列 ==========
				综合判断两个维度：
				1. 领星端：is_deleted_remote（采购单是否在领星被删除）
				2. 本地端：has_analysis_missing（子项的分析记录是否缺失，即没有 status=1 的已完结分析记录）

				状态优先级：
				- 两个都异常 → 红色 "数据异常"（tooltip 显示两个原因）
				- 仅领星删除 → 红色 "领星已删除"
				- 仅本地异常 → 橙色 "本地异常"
				- 都正常 → 绿色 "正常"
			-->
				<el-table-column
					v-if="viewMode === 'order'"
					label="数据状态"
					width="110"
					align="center"
				>
					<template #default="{ row }">
						<!-- 情况1: 领星已删除 + 本地分析记录也异常 -->
						<el-tooltip
							v-if="row.is_deleted_remote === 1 && row.has_analysis_missing"
							placement="top"
						>
							<template #content>
								<div>① 该采购单在领星已被删除</div>
								<div>② 关联的分析记录无已完结状态</div>
							</template>
							<el-tag type="danger" size="small" effect="dark" style="cursor: help"
								>数据异常</el-tag
							>
						</el-tooltip>

						<!-- 情况2: 仅领星已删除 -->
						<el-tooltip
							v-else-if="row.is_deleted_remote === 1"
							content="该采购单在领星已被删除，本地仅保留历史数据"
							placement="top"
						>
							<el-tag type="danger" size="small" effect="plain" style="cursor: help"
								>领星已删除</el-tag
							>
						</el-tooltip>

						<!-- 情况3: 仅本地分析记录异常 -->
						<el-tooltip
							v-else-if="row.has_analysis_missing"
							content="关联的分析记录无已完结状态（可能已删除、过期或未完结）"
							placement="top"
						>
							<el-tag type="warning" size="small" effect="plain" style="cursor: help"
								>本地异常</el-tag
							>
						</el-tooltip>

						<!-- 情况4: 一切正常 -->
						<el-tag v-else type="success" size="small" effect="plain">正常</el-tag>
					</template>
				</el-table-column>

				<el-table-column
					v-if="viewMode === 'order'"
					label="计划量"
					width="80"
					align="center"
				>
					<template #default="{ row }">
						<el-popover
							placement="right"
							:width="400"
							trigger="hover"
							popper-class="plan-hover-popover"
							@show="onMouseEnterPlan(row.related_plans)"
							@after-leave="onMouseLeavePlan"
						>
							<template #reference>
								<span
									style="
										cursor: pointer;
										padding: 2px 5px;
										color: #409eff;
										border-bottom: 1px dashed #409eff;
									"
								>
									{{ row.quantity_total }}
								</span>
							</template>
							<div v-loading="hoverLoading" style="min-height: 50px">
								<div
									v-if="hoverIsDegraded"
									style="
										color: #e6a23c;
										font-size: 12px;
										margin-bottom: 8px;
										display: flex;
										align-items: center;
										gap: 4px;
									"
								>
									<el-icon><Warning /></el-icon>网络异常，当前显示为本地最新数据
								</div>
								<template v-if="!hoverLoading">
									<div v-if="row.related_plans && row.related_plans.length > 0">
										<div
											v-if="row.related_plans.length > 1"
											style="
												margin-bottom: 10px;
												font-weight: bold;
												font-size: 13px;
												color: #303133;
												border-bottom: 1px solid #ebeef5;
												padding-bottom: 8px;
												display: flex;
												justify-content: space-between;
												align-items: center;
											"
										>
											<span
												>包含
												{{ row.related_plans.length }} 个计划明细</span
											>
											<span
												>汇总计划数：<span
													style="
														color: #f56c6c;
														font-family: Tahoma;
														font-size: 15px;
													"
													>{{
														row.related_plans.reduce(
															(sum, sn) =>
																sum +
																(hoverPlanDetails[sn]
																	?.quantity_plan || 0),
															0
														)
													}}</span
												></span
											>
										</div>
										<div
											style="
												max-height: 200px;
												overflow-y: auto;
												padding-right: 5px;
											"
										>
											<div
												v-for="(sn, index) in row.related_plans"
												:key="sn"
												:style="{
													marginBottom: '10px',
													paddingBottom: '10px',
													borderBottom:
														index === row.related_plans.length - 1
															? 'none'
															: '1px solid #ebeef5'
												}"
											>
												<template v-if="hoverPlanDetails[sn]">
													<div
														style="
															font-weight: bold;
															margin-bottom: 5px;
															font-size: 13px;
														"
													>
														{{ sn }}
													</div>
													<div style="display: flex; gap: 8px">
														<el-image
															:src="hoverPlanDetails[sn].pic_url"
															style="
																width: 48px;
																height: 48px;
																border-radius: 4px;
																border: 1px solid #eee;
															"
															fit="cover"
														/>
														<div
															style="
																flex: 1;
																font-size: 12px;
																line-height: 1.6;
															"
														>
															<div
																class="text-ellipsis-2"
																:title="
																	hoverPlanDetails[sn]
																		.product_name
																"
																style="color: #303133"
															>
																{{
																	hoverPlanDetails[sn]
																		.product_name
																}}
															</div>
															<div
																style="
																	color: #909399;
																	margin-top: 2px;
																"
															>
																SKU: {{ hoverPlanDetails[sn].sku }}
															</div>
															<div
																style="
																	margin-top: 2px;
																	display: flex;
																	align-items: center;
																	justify-content: space-between;
																"
															>
																<span>
																	计划数
																	<span
																		style="
																			color: #f56c6c;
																			font-weight: bold;
																			font-family: Tahoma;
																		"
																		>{{
																			hoverPlanDetails[sn]
																				.quantity_plan
																		}}</span
																	>
																</span>
																<el-tag
																	size="small"
																	:type="
																		hoverPlanDetails[sn]
																			.is_deleted_remote === 1
																			? 'danger'
																			: 'info'
																	"
																	effect="plain"
																>
																	{{
																		hoverPlanDetails[sn]
																			.is_deleted_remote === 1
																			? "领星已删"
																			: hoverPlanDetails[sn]
																					.status_text
																	}}
																</el-tag>
															</div>
															<div
																style="
																	margin-top: 4px;
																	font-size: 11px;
																	color: #b6b8bd;
																	display: flex;
																	align-items: center;
																	gap: 4px;
																"
															>
																<el-icon><Refresh /></el-icon>
																最后更新:
																{{
																	formatSyncTime(
																		hoverPlanDetails[sn]
																			.sync_time
																	)
																}}
															</div>
														</div>
													</div>
												</template>
												<template v-else>
													<div style="color: #909399; font-size: 12px">
														正在加载: {{ sn }}...
													</div>
												</template>
											</div>
										</div>
									</div>
									<div
										v-else
										style="color: #909399; text-align: center; padding: 10px 0"
									>
										无绑定的采购计划明细
									</div>
								</template>
							</div>
						</el-popover>
					</template>
				</el-table-column>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="quantity_real"
					label="实际量"
					width="80"
					align="center"
				/>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="quantity_entry"
					label="入库量"
					width="80"
					align="center"
				/>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="quantity_receive"
					label="待到货"
					width="80"
					align="center"
				/>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="quantity_total"
					label="总数量"
					width="80"
					align="center"
				/>

				<!-- 单据视图的预计发货数量 (汇总) -->
				<el-table-column
					v-if="viewMode === 'order'"
					label="预计发货数量"
					width="110"
					align="center"
				>
					<template #default="{ row }">
						<el-popover
							v-if="
								shipmentMetrics.byOrder[row.order_sn] &&
								Object.keys(shipmentMetrics.byOrder[row.order_sn].batches).length >
									0
							"
							placement="right"
							:width="400"
							trigger="hover"
							popper-class="ship-hover-popover"
						>
							<template #reference>
								<span
									style="
										cursor: pointer;
										padding: 2px 5px;
										color: #409eff;
										border-bottom: 1px dashed #409eff;
									"
								>
									{{ shipmentMetrics.byOrder[row.order_sn].totalQty }}
								</span>
							</template>
							<div>
								<!-- 顶部汇总条 -->
								<div
									style="
										display: flex;
										justify-content: space-between;
										align-items: center;
										margin-bottom: 10px;
										padding-bottom: 6px;
										border-bottom: 2px solid #ebeef5;
									"
								>
									<span style="font-weight: bold; font-size: 13px; color: #303133"
										>预计发货明细 (按批次)</span
									>
									<span style="font-size: 12px"
										>合计:
										<span
											style="
												color: #f56c6c;
												font-weight: bold;
												font-family: Tahoma;
												font-size: 14px;
											"
											>{{
												shipmentMetrics.byOrder[row.order_sn].totalQty
											}}</span
										></span
									>
								</div>

								<div
									style="max-height: 480px; overflow-y: auto; padding-right: 5px"
								>
									<!-- 按单据(批次)分组 -->
									<div
										v-for="(batch, seq, bIdx) in shipmentMetrics.byOrder[
											row.order_sn
										].batches"
										:key="seq"
										:style="{
											marginBottom: '12px',
											paddingBottom: '12px',
											borderBottom:
												bIdx ===
												Object.keys(
													shipmentMetrics.byOrder[row.order_sn].batches
												).length -
													1
													? 'none'
													: '1px solid #ebeef5'
										}"
									>
										<!-- 单据级别标头 -->
										<div style="margin-bottom: 8px">
											<div
												style="
													display: flex;
													justify-content: space-between;
													align-items: center;
													margin-bottom: 4px;
												"
											>
												<span
													style="
														font-weight: bold;
														font-size: 13px;
														color: #303133;
													"
													>批次号: {{ seq }}</span
												>
												<el-tag
													size="small"
													:type="
														batch.info.status === -5
															? 'danger'
															: batch.info.status === 0
																? 'warning'
																: batch.info.status === 5
																	? 'info'
																	: batch.info.status === 10
																		? 'success'
																		: 'primary'
													"
													effect="plain"
													style="
														height: 20px;
														padding: 0 4px;
														line-height: 18px;
													"
													>{{ batch.info.status_text }}</el-tag
												>
											</div>
											<div
												style="
													font-size: 11px;
													color: #909399;
													margin-bottom: 2px;
												"
											>
												创于: {{ batch.info.createTime || "-" }} | 运输:
												{{
													{
														air: "空运",
														sea: "海运",
														express: "快递",
														rail: "铁运"
													}[batch.info.shipping_method] ||
													batch.info.shipping_method ||
													"-"
												}}
											</div>
											<div
												style="
													font-size: 11px;
													color: #606266;
													margin-bottom: 2px;
												"
											>
												发货仓库: {{ batch.info.sname || "-" }} /
												{{ batch.info.wname || "-" }}
											</div>
											<div
												v-if="batch.info.batch_remark"
												style="
													font-size: 11px;
													color: #606266;
													margin-bottom: 2px;
												"
											>
												单据备注:
												<span style="color: #f56c6c">{{
													batch.info.batch_remark
												}}</span>
											</div>
										</div>

										<!-- 产品明细列表 -->
										<div
											v-for="(item, idx) in batch.items"
											:key="idx"
											style="
												margin-left: 8px;
												padding: 6px;
												background-color: #fafbfc;
												border-left: 2px solid #dcdfe6;
												border-radius: 0 4px 4px 0;
												margin-bottom: 4px;
												display: flex;
												gap: 8px;
											"
										>
											<!-- 左侧产品小图 -->
											<el-image
												:src="item.small_image_url"
												style="
													width: 32px;
													height: 32px;
													border-radius: 4px;
													border: 1px solid #eee;
													flex-shrink: 0;
												"
												fit="cover"
											/>
											<!-- 右侧产品明细内容 -->
											<div style="flex: 1; min-width: 0">
												<div
													class="text-ellipsis-2"
													:title="item.product_name"
													style="
														color: #303133;
														font-size: 11px;
														line-height: 1.3;
														margin-bottom: 2px;
													"
												>
													{{ item.product_name || item.msku }}
												</div>
												<div
													style="
														display: flex;
														justify-content: space-between;
														align-items: center;
														margin-bottom: 2px;
													"
												>
													<span style="font-size: 11px; color: #909399"
														>MSKU: {{ item.msku }}</span
													>
													<span style="font-size: 11px; color: #606266"
														>发货量:
														<span
															style="
																color: #f56c6c;
																font-weight: bold;
																font-family: Tahoma;
																font-size: 12px;
															"
															>{{ item.shipment_plan_quantity }}</span
														></span
													>
												</div>
												<div
													v-if="item.shipment_mws_sn"
													style="font-size: 10px; color: #909399"
												>
													发货单: {{ item.shipment_mws_sn }}
												</div>
												<div
													v-if="item.remark"
													style="
														font-size: 11px;
														color: #e6a23c;
														margin-top: 2px;
													"
												>
													明细备注: {{ item.remark }}
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</el-popover>
						<span v-else>-</span>
					</template>
				</el-table-column>

				<!-- [模拟新增] 单据视图的实际发货数量 (汇总) -->
				<el-table-column
					v-if="viewMode === 'order'"
					label="实际发货数量"
					width="110"
					align="center"
				>
					<template #default="{ row }">
						<template v-if="getActualDataForOrder(row.order_sn)">
							<el-popover
								placement="right"
								:width="420"
								trigger="hover"
								popper-class="ship-hover-popover"
							>
								<template #reference>
									<span
										style="
											cursor: pointer;
											padding: 2px 5px;
											color: #67c23a;
											font-weight: bold;
											border-bottom: 1px dashed #67c23a;
										"
									>
										{{ getActualDataForOrder(row.order_sn)?.totalActualQty }}
									</span>
								</template>
								<div>
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
													>{{
														getActualDataForOrder(row.order_sn)
															?.totalActualQty || 0
													}}</span
												>
											</div>
											<div style="font-size: 12px; color: #606266">
												计划总量
												<span
													style="
														font-family: Tahoma, sans-serif;
														font-weight: bold;
													"
													>{{
														getActualDataForOrder(row.order_sn)
															?.totalPlanQty || 0
													}}</span
												>
											</div>
										</div>
										<el-progress
											:percentage="
												Math.min(
													((getActualDataForOrder(row.order_sn)
														?.totalActualQty || 0) /
														(getActualDataForOrder(row.order_sn)
															?.totalPlanQty || 1)) *
														100,
													100
												)
											"
											:show-text="false"
											color="#67C23A"
											:stroke-width="6"
										/>
									</div>

									<!-- 2. 中间：确认物质实体 (商品卡片) -->
									<div
										v-if="
											getActualDataForOrder(row.order_sn)?.details?.[0]
												?.product_name ||
											getActualDataForOrder(row.order_sn)?.productInfo
												?.product_name
										"
										style="
											display: flex;
											align-items: center;
											gap: 10px;
											margin-bottom: 12px;
											padding: 8px;
											background: #ffffff;
											border: 1px solid #ebeef5;
											border-radius: 6px;
											box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
										"
									>
										<el-image
											v-if="
												getActualDataForOrder(row.order_sn)?.productInfo
													?.small_image_url
											"
											:src="
												getActualDataForOrder(row.order_sn)?.productInfo
													?.small_image_url
											"
											:preview-src-list="[
												getActualDataForOrder(row.order_sn)?.productInfo
													?.small_image_url
											]"
											fit="cover"
											style="
												width: 36px;
												height: 36px;
												border-radius: 4px;
												flex-shrink: 0;
												cursor: zoom-in;
											"
										/>
										<div style="overflow: hidden; flex: 1">
											<div
												style="
													font-size: 13px;
													font-weight: bold;
													color: #303133;
													white-space: nowrap;
													overflow: hidden;
													text-overflow: ellipsis;
													margin-bottom: 2px;
												"
												:title="
													getActualDataForOrder(row.order_sn)?.productInfo
														?.product_name
												"
											>
												{{
													getActualDataForOrder(row.order_sn)?.productInfo
														?.product_name
												}}
											</div>
											<div
												style="
													font-size: 11px;
													color: #909399;
													display: flex;
													align-items: center;
													gap: 4px;
												"
											>
												SKU:
												{{
													getActualDataForOrder(row.order_sn)?.productInfo
														?.sku
												}}
											</div>
										</div>
									</div>

									<!-- 3. 底部：追踪履约轨迹 (发货单列) -->
									<div
										style="
											max-height: 200px;
											overflow-y: auto;
											padding-right: 4px;
										"
									>
										<div
											v-for="(detail, idx) in getActualDataForOrder(
												row.order_sn
											)?.details"
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
												<div
													style="
														display: flex;
														align-items: center;
														gap: 6px;
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
												<el-tag
													size="small"
													:type="detail.is_final ? 'success' : 'primary'"
													effect="light"
													style="border: none"
													>{{
														detail.shipment_status_name || "进行中"
													}}</el-tag
												>
											</div>
											<div
												style="
													display: flex;
													justify-content: space-between;
													align-items: center;
													font-size: 12px;
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
														>{{
															detail.shipment_list_quantity || 0
														}}</span
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
						</template>
						<span v-else style="color: #c0c4cc">-</span>
					</template>
				</el-table-column>

				<!-- 单据视图的差异（计划 vs 实际，汇总） -->
				<el-table-column v-if="viewMode === 'order'" label="差异" width="70" align="center">
					<template #default="{ row }">
						<template v-if="getActualDataForOrder(row.order_sn)">
							<span
								:style="{
									color:
										(getActualDataForOrder(row.order_sn)?.totalActualQty || 0) -
											(shipmentMetrics.byOrder[row.order_sn]?.totalQty ||
												0) ===
										0
											? '#67C23A'
											: '#F56C6C',
									fontWeight: 'bold'
								}"
							>
								{{
									(getActualDataForOrder(row.order_sn)?.totalActualQty || 0) -
										(shipmentMetrics.byOrder[row.order_sn]?.totalQty || 0) >
									0
										? "+"
										: ""
								}}{{
									(getActualDataForOrder(row.order_sn)?.totalActualQty || 0) -
									(shipmentMetrics.byOrder[row.order_sn]?.totalQty || 0)
								}}
							</span>
						</template>
						<span v-else style="color: #c0c4cc">-</span>
					</template>
				</el-table-column>

				<!-- ========== 仓库物流区 ========== -->
				<el-table-column
					v-if="viewMode === 'order'"
					prop="ware_house_name"
					label="仓库"
					min-width="130"
					show-overflow-tooltip
				/>
				<!-- 物流动态 -->
				<el-table-column
					v-if="viewMode === 'order'"
					label="物流动态"
					width="120"
					align="center"
				>
					<template #default="{ row }">
						<div
							v-if="row.logistics_status || getLogisticsPackageCount(row)"
							style="
								display: flex;
								flex-direction: column;
								align-items: center;
								justify-content: center;
								gap: 6px;
								padding: 4px 0;
							"
						>
							<el-tooltip
								v-if="row.logistics_status"
								:content="row.logistics_status_reason || row.logistics_status_text"
								placement="top"
							>
								<el-tag
									:type="getLogisticsTagType(row.logistics_status)"
									size="small"
									effect="plain"
									style="cursor: pointer"
									@click="openLogistics(row)"
								>
									{{ row.logistics_status_text }}
								</el-tag>
							</el-tooltip>
							<div
								v-if="getLogisticsPackageCount(row)"
								style="
									color: #409eff;
									font-size: 12px;
									cursor: pointer;
									line-height: 1;
									user-select: none;
								"
								@click="openLogistics(row)"
								title="点击查看物流轨迹"
							>
								{{ getLogisticsPackageCount(row) }}条明细 &gt;
							</div>
						</div>
						<span v-else style="color: #c0c4cc">-</span>
					</template>
				</el-table-column>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="alibaba_order_sn"
					label="1688单号"
					min-width="150"
					show-overflow-tooltip
				/>

				<!-- ========== 人员信息区 ========== -->
				<el-table-column
					v-if="viewMode === 'order'"
					prop="opt_realname"
					label="采购员"
					width="100"
					show-overflow-tooltip
				/>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="auditor_realname"
					label="审核人"
					width="100"
					show-overflow-tooltip
				/>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="last_realname"
					label="最后操作人"
					width="110"
					show-overflow-tooltip
				/>

				<!-- ========== 时间信息区 ========== -->
				<el-table-column
					v-if="viewMode === 'order'"
					prop="create_time_remote"
					label="创建时间"
					width="155"
					show-overflow-tooltip
				/>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="order_time"
					label="下单时间"
					width="155"
					show-overflow-tooltip
				/>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="update_time_remote"
					label="更新时间"
					width="155"
					show-overflow-tooltip
				/>

				<!-- ========== 其他信息 ========== -->
				<el-table-column
					v-if="viewMode === 'order'"
					label="结算方式"
					width="110"
					show-overflow-tooltip
				>
					<template #default="{ row }">
						{{
							row.settlement_description ||
							getSettlementText(row.settlement_method) ||
							"-"
						}}
					</template>
				</el-table-column>
				<el-table-column v-if="viewMode === 'order'" label="含税" width="80" align="center">
					<template #default="{ row }">
						{{ row.is_tax == 1 ? "是" : "否" }}
					</template>
				</el-table-column>
				<el-table-column
					v-if="viewMode === 'order'"
					prop="remark"
					label="备注"
					min-width="150"
					show-overflow-tooltip
				/>

				<!-- ========== 操作列（固定右侧） ========== -->
				<el-table-column label="操作" width="160" align="center" fixed="right">
					<template #default="{ row }">
						<template v-if="viewMode === 'order'">
							<el-button
								type="success"
								link
								size="small"
								:disabled="
									row.logistics_status !== 'signed' &&
									row.logistics_status !== 'confirmed'
								"
								@click="openShippingDialog([row])"
								>发货</el-button
							>
							<el-button
								type="primary"
								link
								size="small"
								@click="handleSyncSingle(row)"
								>同步</el-button
							>
							<el-button type="info" link size="small" @click="openDetailDrawer(row)"
								>明细</el-button
							>
						</template>
						<template v-else>
							<!-- 产品视图下的操作 -->
							<el-button
								type="success"
								link
								size="small"
								:disabled="
									row.logistics_status !== 'signed' &&
									row.logistics_status !== 'confirmed'
								"
								@click="openShippingDialog([row])"
								>发货</el-button
							>
							<el-button
								type="primary"
								link
								size="small"
								@click="handleSyncSingle({ order_sn: row.order_sn })"
								>同步</el-button
							>
						</template>
					</template>
				</el-table-column>
			</el-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<!-- ========== 批量发货分析弹窗 ========== -->
		<el-dialog
			v-model="batchShipDialog.visible"
			width="1360px"
			:close-on-click-modal="false"
			class="batch-ship-dialog"
			top="3vh"
			:show-close="true"
			:before-close="handleBatchDialogClose"
		>
			<template #header>
				<div class="batch-dialog-header">
					<div class="header-left">
						<span class="header-title">批量发货分析</span>
						<el-tag type="info" size="small" round
							>共 {{ batchShipDialog.items.length }} 个产品</el-tag
						>
					</div>
				</div>
			</template>

			<div class="batch-ship-content">
				<!-- 全局设置区 -->
				<div class="batch-global-settings">
					<div class="setting-row">
						<div class="setting-item">
							<span class="setting-label">销售周期</span>
							<visual-date-picker
								v-model="batchShipDialog.globalDateRange"
								:show-shipping-selector="true"
								:shipping-methods="shippingMethods"
								:shipping-buffer="shippingBuffer"
								:selected-shipping-method="selectedShippingMethod"
								:algorithm="batchShipDialog.globalAlgo"
								:alpha="undefined"
								@change="onGlobalDateChange"
								@shipping-change="onShippingChange"
							/>
							<el-tag
								v-if="batchShipDialog.globalDays > 0"
								type="primary"
								effect="dark"
								round
								size="small"
								>共 {{ batchShipDialog.globalDays }} 天</el-tag
							>
						</div>
						<div class="setting-item">
							<span class="setting-label">计算依据</span>
							<el-radio-group
								v-model="batchShipDialog.globalAlgo"
								size="small"
								@change="onGlobalAlgoChange"
							>
								<el-radio-button label="daily_avg">日均销量</el-radio-button>
								<el-radio-button label="history">历史销量</el-radio-button>
								<el-radio-button label="trend">搜索词趋势</el-radio-button>
								<el-radio-button label="combined">综合走势</el-radio-button>
							</el-radio-group>
							<!-- α 权重设置（仅综合走势时显示） -->
							<el-popover
								v-if="false"
								:visible="batchShipDialog.alphaPopoverVisible"
								placement="bottom"
								:width="280"
								:teleported="true"
							>
								<template #reference>
									<el-button
										size="small"
										:type="
											batchShipDialog.globalAlpha !== undefined
												? 'primary'
												: 'default'
										"
										style="margin-left: 8px"
										@click="
											batchShipDialog.alphaPopoverVisible =
												!batchShipDialog.alphaPopoverVisible
										"
									>
										{{
											batchShipDialog.globalAlpha !== undefined
												? `α=${batchShipDialog.globalAlpha?.toFixed(2)}`
												: "α 默认"
										}}
									</el-button>
								</template>
								<div class="alpha-config-panel" @click.stop>
									<div class="alpha-header">
										<span class="alpha-title">α 权重设置</span>
										<el-button
											size="small"
											text
											type="info"
											@click="batchShipDialog.alphaPopoverVisible = false"
											style="padding: 2px"
											>✕</el-button
										>
									</div>
									<div class="alpha-slider-row">
										<el-slider
											v-model="batchShipDialog.globalAlphaInput"
											:min="0"
											:max="1"
											:step="0.05"
											style="flex: 1"
										/>
										<el-input-number
											v-model="batchShipDialog.globalAlphaInput"
											:min="0"
											:max="1"
											:step="0.1"
											:precision="2"
											:controls="false"
											size="small"
											style="width: 68px; margin-left: 12px"
										/>
									</div>
									<div class="alpha-range-labels">
										<span>← 搜索侧重</span>
										<span>销量侧重 →</span>
									</div>
									<div class="alpha-actions">
										<el-button size="small" @click="onAlphaReset"
											>重置默认</el-button
										>
										<el-button size="small" type="primary" @click="onAlphaApply"
											>应用</el-button
										>
									</div>
								</div>
							</el-popover>
						</div>
						<el-button
							type="primary"
							@click="applyGlobalToAll"
							:disabled="!batchShipDialog.globalDateRange"
							:icon="Refresh"
						>
							应用到全部
						</el-button>
					</div>
				</div>

				<!-- 产品明细卡片列表 -->
				<div class="batch-items-scroll">
					<div
						v-for="(item, idx) in batchShipDialog.items"
						:key="idx"
						:class="['batch-item-card', item.gap > 0 ? 'card-warn' : 'card-ok']"
					>
						<!-- 左侧：产品信息 -->
						<div class="item-product">
							<div class="item-index">{{ idx + 1 }}</div>
							<div class="item-image">
								<el-image
									v-if="item.product_img"
									:src="item.product_img"
									fit="contain"
									style="width: 56px; height: 56px; border-radius: 8px"
									:preview-src-list="[item.product_img]"
									hide-on-click-modal
								/>
								<div v-else class="img-placeholder">
									<el-icon :size="24" color="#c0c4cc"><picture /></el-icon>
								</div>
							</div>
							<div class="item-info">
								<div class="item-name">{{ item.product_name || "-" }}</div>
								<div class="item-meta">
									<el-tag size="small" type="info" effect="plain"
										>SKU: {{ item.sku || "-" }}</el-tag
									>
									<span class="item-order-sn">采购单: {{ item.order_sn }}</span>
								</div>
								<div class="item-price-row">
									<span class="price-label">单价:</span>
									<span class="price-val">¥{{ item.unitPrice }}</span>
									<span class="qty-sep">×</span>
									<span class="qty-val">{{ item.purchaseQty }}</span>
									<span class="subtotal"
										>小计: <b>¥{{ item.subtotal }}</b></span
									>
								</div>
							</div>
						</div>

						<!-- 右侧：分析参数 + 结果 -->
						<!-- 右侧：分析参数 + 结果 -->
						<div class="item-analysis">
							<!-- 1. 静态数据区 (Reference Data) -->
							<div class="analysis-data-grid">
								<div class="grid-item">
									<div class="grid-label">日均销量<br />(3/7/14)</div>
									<div class="grid-val">{{ item.daily_avg_sales_info }}</div>
								</div>
								<div class="grid-item">
									<div class="grid-label">可售天数<br />(总/FBA)</div>
									<div class="grid-val">{{ item.days_of_supply }}</div>
								</div>
								<div class="grid-item">
									<div class="grid-label">日均<br />销量</div>
									<div class="grid-val">{{ item.daily_avg_sales }}</div>
								</div>
								<div class="grid-item">
									<div class="grid-label">FBA/在途/<br />本地</div>
									<div class="grid-val link-text">{{ item.stock_breakdown }}</div>
								</div>
								<div class="grid-item">
									<div class="grid-label">总库存</div>
									<div class="grid-val">{{ item.total_stock }}</div>
								</div>
								<div class="grid-item">
									<div class="grid-label">待交付/采购<br />计划</div>
									<div class="grid-val">{{ item.pending_plan }}</div>
								</div>
								<div class="grid-item">
									<div class="grid-label">预计发<br />货量</div>
									<div class="grid-val highlight">{{ item.est_ship_qty }}</div>
								</div>
								<div class="grid-item">
									<div class="grid-label">断货<br />时间</div>
									<div class="grid-val">{{ item.out_of_stock_date }}</div>
								</div>
								<div class="grid-item">
									<div class="grid-label">评分<br />Rating</div>
									<el-tooltip
										placement="top"
										:disabled="!item.stars || !Array.isArray(item.stars)"
									>
										<template #content>
											<div
												style="
													font-size: 12px;
													line-height: 1.6;
													max-width: 300px;
												"
											>
												<div style="font-weight: 600; margin-bottom: 4px">
													评分历史
												</div>
												<div style="word-break: break-all">
													{{
														Array.isArray(item.stars)
															? item.stars.join(" → ")
															: item.stars
													}}
												</div>
												<div style="margin-top: 6px; font-weight: 600">
													评论数
												</div>
												<div style="word-break: break-all">
													{{
														Array.isArray(item.reviews_num)
															? item.reviews_num.join(" → ")
															: item.reviews_num
													}}
												</div>
											</div>
										</template>
										<div
											class="grid-val"
											style="
												cursor: help;
												max-width: 55px;
												overflow: hidden;
												text-overflow: ellipsis;
												white-space: nowrap;
											"
										>
											{{
												Array.isArray(item.stars)
													? item.stars[0]
													: item.stars || "-"
											}}<br />
											<span style="font-size: 11px; color: #909399">{{
												Array.isArray(item.reviews_num)
													? item.reviews_num[0]
													: item.reviews_num || 0
											}}</span>
										</div>
									</el-tooltip>
								</div>
							</div>

							<!-- 2. 动态操作区 (Dynamic Data) -->
							<div class="analysis-interactive-zone">
								<div class="analysis-controls">
									<el-popover
										placement="top"
										:width="500"
										trigger="hover"
										:show-after="200"
									>
										<template #reference>
											<div class="ctrl-group" style="cursor: help">
												<span
													class="ctrl-label"
													style="border-bottom: 1px dashed #c0c4cc"
													>计算依据</span
												>
												<el-select
													v-model="item.algo"
													size="small"
													style="width: 100px"
													@change="handleAlgoChange(item)"
												>
													<el-option label="日均单量" value="daily_avg" />
													<el-option label="历史销量" value="history" />
													<el-option label="搜索词趋势" value="trend" />
													<el-option label="综合走势" value="combined" />
												</el-select>
											</div>
										</template>
										<div class="trend-chart-wrapper">
											<div
												style="
													margin-bottom: 8px;
													font-weight: 600;
													color: #303133;
													font-size: 13px;
												"
											>
												近12个月销量趋势 (决策参考)
											</div>
											<listing-trend-chart
												:product-code="
													item.listing?.product_code || item.product_code
												"
												:asin="item.listing?.asin || item.asin"
												:marketplace="
													item.listing?.marketplace || item.marketplace
												"
											/>
										</div>
									</el-popover>

									<!-- 运输方式选择（提前） -->
									<el-select
										v-model="item.shippingMethod"
										size="small"
										style="width: 110px; margin-left: 6px"
										placeholder="运输方式"
										@change="onItemShippingChange(item, $event)"
									>
										<el-option
											v-for="m in shippingMethods"
											:key="m.key"
											:value="m.key"
											:label="m.icon + ' ' + m.label"
										/>
									</el-select>

									<div
										class="ctrl-group date-ctrl"
										:class="{ 'date-highlight': item._dateHighlight }"
									>
										<span class="ctrl-label">周期</span>
										<visual-date-picker
											v-model="item.dateRange"
											:daily-avg-sales="Number(item.daily_avg_sales) || 0"
											:fba-valid="
												(item.restocking?.fbaValidList || []).reduce(
													(sum, i) => sum + (Number(i?.quantity) || 0),
													0
												)
											"
											:fba-shipping-list="
												item.restocking?.fbaShippingList || []
											"
											:product-code="
												item.listing?.product_code ||
												item.product_code ||
												''
											"
											:asin="item.listing?.asin || item.analysis?.asin || ''"
											:marketplace="
												item.listing?.marketplace ||
												item.plan_marketplace ||
												''
											"
											:algorithm="item.algo || 'daily_avg'"
											:alpha="undefined"
											:shipping-markers="getItemShippingMarkers(item)"
											@change="handleVisualDateChange(item, $event)"
										/>
									</div>

									<!-- 综合走势α信息 -->
									<template
										v-if="
											(item.algo || batchShipDialog.globalAlgo) ===
												'combined' && item._monthlyCoefficients
										"
									>
										<template
											v-for="td in [getShipAlphaTooltipData(item)]"
											:key="'alpha-td'"
										>
											<el-tooltip v-if="td" placement="top">
												<template #content>
													<div
														style="
															font-size: 12px;
															line-height: 1.8;
															min-width: 240px;
														"
													>
														<div
															style="
																font-weight: 600;
																margin-bottom: 6px;
															"
														>
															逐月α详情 (当前: {{ td.modeLabel }}模式)
														</div>
														<div
															v-for="detail in td.details"
															:key="detail.month"
															style="padding-left: 8px"
														>
															{{ detail.month.substring(5) }}月 ×
															{{ detail.days }}天: 系统α={{
																detail.systemAlpha
															}}<template
																v-if="
																	detail.userAlpha !== null &&
																	detail.userAlpha !== undefined
																"
															>
																/ 用户α={{
																	detail.userAlpha
																}}</template
															>
															<div
																v-if="detail.reasonText"
																style="
																	padding-left: 12px;
																	color: #aaa;
																	font-size: 11px;
																"
															>
																{{ detail.reasonText }}
															</div>
														</div>
														<div
															style="
																margin-top: 8px;
																border-top: 1px solid
																	rgba(255, 255, 255, 0.2);
																padding-top: 6px;
															"
														>
															<div
																style="
																	font-weight: 600;
																	margin-bottom: 4px;
																"
															>
																加权平均公式
															</div>
															<div
																style="
																	padding-left: 8px;
																	font-family: monospace;
																"
															>
																({{ td.formulaText }}) ÷
																{{ td.totalDays }}天
															</div>
															<div
																style="
																	padding-left: 8px;
																	font-weight: 700;
																	color: #67c23a;
																	margin-top: 4px;
																"
															>
																= {{ td.value }}
															</div>
														</div>
														<div
															v-if="td.hasUserAlpha"
															style="
																margin-top: 6px;
																color: #aaa;
																font-size: 11px;
															"
														>
															💡 点击α标签切换到{{
																td.nextModeLabel
															}}模式
														</div>
													</div>
												</template>
												<span
													style="
														display: inline-flex;
														align-items: center;
														gap: 3px;
														padding: 2px 8px;
														border-radius: 4px;
														font-size: 11px;
														cursor: pointer;
														white-space: nowrap;
													"
													:style="{
														background:
															td.mode === 'user'
																? 'rgba(230,162,60,0.1)'
																: 'rgba(64,158,255,0.08)',
														color:
															td.mode === 'user'
																? '#e6a23c'
																: '#409eff',
														border:
															'1px solid ' +
															(td.mode === 'user'
																? '#e6a23c40'
																: '#409eff30')
													}"
													@click="
														td.hasUserAlpha &&
														onShipToggleAlphaMode(item)
													"
												>
													<span style="font-weight: 600">{{
														td.modeLabel
													}}</span>
													α {{ td.details.map((d) => d.alpha).join("|") }}
													<span
														v-if="td.hasUserAlpha"
														style="font-size: 13px"
														>⇄</span
													>
												</span>
											</el-tooltip>
										</template>
										<!-- 人工α -->
										<el-tooltip placement="top">
											<template #content>
												<div style="font-size: 12px; line-height: 1.6">
													修改后将用新α重算发货量<br />清空则恢复加权平均值
												</div>
											</template>
											<div
												style="
													display: flex;
													align-items: center;
													gap: 4px;
													margin-left: 4px;
												"
											>
												<span style="font-size: 11px; color: #909399"
													>人工α</span
												>
												<el-input-number
													v-model="item._manualAlpha"
													:min="0"
													:max="1"
													:step="0.05"
													:precision="2"
													controls-position="right"
													size="small"
													:placeholder="
														String(
															getShipAlphaTooltipData(item)?.value ??
																0.7
														)
													"
													style="width: 80px"
													@change="
														(val) => onShipManualAlphaChange(item, val)
													"
												/>
											</div>
										</el-tooltip>
									</template>

									<!-- 暂存按钮（悬停显示暂存摘要，徽章显示记录数） -->
									<div
										style="
											margin-right: 8px;
											margin-left: auto;
											position: relative;
										"
									>
										<el-tooltip
											:content="getItemSaveSummary(item)"
											placement="top"
											raw-content
											:show-after="400"
										>
											<el-badge
												:value="getItemSaveCount(item)"
												:hidden="getItemSaveCount(item) === 0"
												:max="99"
												type="info"
												@click.native="
													getItemSaveCount(item) > 0 &&
													openTempDrawer(getItemKey(item))
												"
												style="cursor: pointer"
											>
												<el-button
													size="small"
													type="warning"
													plain
													@click.stop="saveTempRecord(item)"
													:disabled="
														!item.dateRange ||
														!item.dateRange.length ||
														!item.shippingMethod
													"
													>📌 暂存</el-button
												>
											</el-badge>
										</el-tooltip>
									</div>

									<!-- 采购依据悬浮卡片 (靠右对齐) -->
									<div class="rationale-ctrl">
										<el-popover
											placement="bottom-end"
											:width="580"
											trigger="hover"
											popper-class="premium-analysis-popover"
											@show="loadAnalysisData(item)"
										>
											<template #reference>
												<el-button
													type="primary"
													size="small"
													link
													class="rationale-btn"
												>
													<el-icon style="margin-right: 2px"
														><data-analysis /></el-icon
													>采购依据
												</el-button>
											</template>

											<!-- Popover 内部完全复用 analysisDialog 的结构 -->
											<div
												v-if="item._analysisLoading"
												class="analysis-loading"
												style="padding: 20px; text-align: center"
											>
												<el-icon
													class="is-loading"
													style="
														font-size: 20px;
														color: #409eff;
														margin-bottom: 8px;
													"
													><loading
												/></el-icon>
												<div style="font-size: 13px; color: #909399">
													正在加载算法明细...
												</div>
											</div>
											<div
												v-else-if="item._analysisData"
												class="premium-analysis-content"
												style="
													padding: 6px;
													font-family:
														-apple-system, BlinkMacSystemFont,
														&quot;Segoe UI&quot;, Roboto,
														&quot;Helvetica Neue&quot;, Arial,
														sans-serif;
												"
											>
												<!-- Header Area -->
												<div
													style="
														display: flex;
														align-items: flex-start;
														justify-content: space-between;
														margin-bottom: 20px;
													"
												>
													<!-- Left: Algorithm Name & Summary -->
													<div style="flex: 1; padding-right: 20px">
														<div
															style="
																display: flex;
																align-items: center;
																margin-bottom: 8px;
															"
														>
															<div
																style="
																	background: linear-gradient(
																		135deg,
																		#409eff 0%,
																		#2979ff 100%
																	);
																	width: 26px;
																	height: 26px;
																	border-radius: 6px;
																	display: flex;
																	align-items: center;
																	justify-content: center;
																	margin-right: 10px;
																	box-shadow: 0 3px 8px
																		rgba(64, 158, 255, 0.35);
																"
															>
																<el-icon
																	style="
																		color: #fff;
																		font-size: 15px;
																	"
																	><data-analysis
																/></el-icon>
															</div>
															<span
																style="
																	font-size: 16px;
																	font-weight: 600;
																	color: #1f2d3d;
																	letter-spacing: 0.5px;
																"
																>{{
																	item._analysisData.remark
																		?.user_selected_algo_name ||
																	"系数算法"
																}}</span
															>
														</div>

														<div
															v-if="
																item._analysisData.remark?.summary
															"
															style="
																font-size: 13px;
																color: #5e6d82;
																line-height: 1.6;
																padding-left: 2px;
															"
														>
															{{ item._analysisData.remark.summary }}
														</div>
													</div>

													<!-- Right: The Formula Badge -->
													<div
														style="
															background: #f7f9fa;
															border: 1px solid #ebeef5;
															border-radius: 8px;
															padding: 12px 16px;
															display: flex;
															align-items: center;
															box-shadow: 0 2px 12px
																rgba(0, 0, 0, 0.03);
															flex-shrink: 0;
														"
													>
														<div
															style="
																text-align: center;
																padding-right: 14px;
																border-right: 1px dashed #dcdfe6;
															"
														>
															<div
																style="
																	font-size: 11px;
																	color: #909399;
																	margin-bottom: 4px;
																"
															>
																系统建议
															</div>
															<div
																style="
																	font-size: 16px;
																	font-weight: 600;
																	color: #409eff;
																"
															>
																{{
																	item._analysisData.remark
																		?.system_suggested_qty ||
																	"-"
																}}
															</div>
														</div>
														<div
															style="
																color: #c0c4cc;
																font-size: 16px;
																padding: 0 14px;
																font-weight: 300;
															"
														>
															×
														</div>
														<div
															style="
																text-align: center;
																padding-right: 14px;
																border-right: 1px dashed #dcdfe6;
															"
														>
															<div
																style="
																	font-size: 11px;
																	color: #909399;
																	margin-bottom: 4px;
																"
															>
																人工系数
															</div>
															<div
																style="
																	font-size: 16px;
																	font-weight: 600;
																	color: #e6a23c;
																"
															>
																{{
																	item._analysisData.remark
																		?.artificial_coefficient ||
																	1.0
																}}
															</div>
														</div>
														<div
															style="
																color: #c0c4cc;
																font-size: 16px;
																padding: 0 14px;
																font-weight: 300;
															"
														>
															=
														</div>
														<div
															style="
																text-align: center;
																padding-left: 4px;
															"
														>
															<div
																style="
																	font-size: 11px;
																	color: #909399;
																	margin-bottom: 4px;
																"
															>
																发货计划
															</div>
															<div
																style="
																	font-size: 22px;
																	font-weight: 700;
																	color: #67c23a;
																	line-height: 1;
																"
															>
																{{
																	item._analysisData.remark
																		?.final_replenishment_qty ||
																	"-"
																}}
															</div>
														</div>
													</div>
												</div>

												<!-- Breakdown Table -->
												<div
													v-if="
														item._analysisData.remark?.breakdown?.length
													"
													style="
														background: #ffffff;
														border: 1px solid #ebeef5;
														border-radius: 8px;
														overflow: hidden;
														margin-bottom: 16px;
													"
												>
													<div
														style="
															padding: 10px 16px;
															background: #fbfdff;
															border-bottom: 1px solid #ebeef5;
															font-size: 13px;
															font-weight: 600;
															color: #303133;
															display: flex;
															align-items: center;
														"
													>
														<el-icon
															style="
																margin-right: 6px;
																color: #909399;
																font-size: 15px;
															"
															><Date
														/></el-icon>
														分段计算明细
													</div>
													<el-table
														:data="item._analysisData.remark.breakdown"
														size="small"
														:border="false"
														style="width: 100%; font-size: 12px"
														:header-cell-style="{
															background: '#ffffff',
															color: '#909399',
															padding: '8px 0',
															fontWeight: '500',
															borderBottom: '1px solid #ebeef5'
														}"
														:cell-style="{
															padding: '10px 0',
															color: '#606266',
															borderBottom: 'none'
														}"
													>
														<el-table-column
															prop="startDate"
															label="开始"
															min-width="85"
															align="center"
														/>
														<el-table-column
															prop="endDate"
															label="结束"
															min-width="85"
															align="center"
														/>
														<el-table-column
															prop="days"
															label="天数"
															min-width="50"
															align="center"
														/>
														<el-table-column
															prop="coefficient"
															label="系数"
															min-width="65"
															align="center"
														>
															<template #default="{ row }">
																<span
																	style="
																		background: #fdf6ec;
																		color: #e6a23c;
																		padding: 2px 8px;
																		border-radius: 10px;
																		font-size: 11px;
																		font-weight: 500;
																		white-space: nowrap;
																		display: inline-block;
																	"
																	>x {{ row.coefficient }}</span
																>
															</template>
														</el-table-column>
														<el-table-column
															label="日均"
															min-width="50"
															align="center"
														>
															<template #default="{ row }">
																{{
																	row.dailyNeed ??
																	row.suggestedDaily ??
																	"-"
																}}
															</template>
														</el-table-column>
														<el-table-column
															prop="algo_used_name"
															label="算法"
															min-width="80"
															show-overflow-tooltip
														/>
														<el-table-column
															label="建议量"
															min-width="70"
															align="right"
														>
															<template #default="{ row }">
																<span
																	style="
																		color: #409eff;
																		font-weight: 600;
																		font-size: 14px;
																		padding-right: 14px;
																	"
																>
																	{{
																		row.subtotal ??
																		(row.days && row.dailyNeed
																			? Math.ceil(
																					row.days *
																						row.dailyNeed
																				)
																			: "-")
																	}}
																</span>
															</template>
														</el-table-column>
													</el-table>
												</div>

												<!-- Manual Remark -->
												<div
													v-if="item._analysisData.manual_remark"
													style="
														position: relative;
														padding: 14px 16px 14px 44px;
														background: #fff8f2;
														border-radius: 8px;
														border: 1px solid #faecd8;
													"
												>
													<el-icon
														style="
															position: absolute;
															left: 16px;
															top: 16px;
															font-size: 18px;
															color: #e6a23c;
														"
														><document
													/></el-icon>
													<div
														style="
															font-size: 12px;
															font-weight: 600;
															color: #e6a23c;
															margin-bottom: 6px;
														"
													>
														人工审核备注
													</div>
													<div
														style="
															font-size: 13px;
															color: #606266;
															line-height: 1.6;
														"
													>
														{{ item._analysisData.manual_remark }}
													</div>
												</div>
											</div>
											<div
												v-else
												class="analysis-empty"
												style="padding: 20px"
											>
												<el-empty
													description="该产品当时未关联采购方案"
													:image-size="40"
												/>
											</div>
										</el-popover>
									</div>
								</div>

								<div class="analysis-result">
									<div class="result-cell">
										<span class="result-label">日均消耗</span>
										<span class="result-value">{{ item.dailySales }}</span>
									</div>
									<div class="result-cell">
										<span class="result-label">周期总需求</span>
										<span class="result-value">{{ item.totalDemand }}</span>
									</div>
									<div
										:class="[
											'result-cell',
											'result-gap',
											item._pureGap > 0 ? 'has-gap' : 'no-gap'
										]"
									>
										<span
											class="result-label"
											title="周期总需求 - 当前FBA库存 - 在途货件"
											>需补货</span
										>
										<span class="result-value">{{
											item._pureGap > 0 ? item._pureGap : 0
										}}</span>
									</div>
									<div
										:class="[
											'result-cell',
											'result-gap',
											item.gap > 0 ? 'has-gap' : 'no-gap'
										]"
									>
										<span
											class="result-label"
											style="color: #f56c6c"
											title="需补货 - 本单采购数量，还差多少没补上"
											>本单后仍缺</span
										>
										<span class="result-value" style="color: #f56c6c">{{
											item.gap > 0 ? item.gap : 0
										}}</span>
									</div>

									<!-- 需求/在途信息行（分开两个tooltip） -->
									<div class="result-cell" style="min-width: auto; gap: 4px">
										<!-- 需求 tooltip：逐月需求明细 -->
										<el-tooltip
											placement="bottom"
											:disabled="!item.totalDemand"
										>
											<template #content>
												<div
													style="
														font-size: 12px;
														line-height: 1.8;
														min-width: 280px;
													"
												>
													<div
														style="font-weight: 600; margin-bottom: 4px"
													>
														需求计算明细（日均 {{ item.dailySales }}）
													</div>
													<div
														style="
															padding: 3px 8px;
															margin-bottom: 6px;
															background: rgba(64, 128, 255, 0.15);
															border-radius: 4px;
															font-size: 11px;
															color: #79bbff;
														"
													>
														<template
															v-if="
																(item.algo ||
																	batchShipDialog.globalAlgo) ===
																'daily_avg'
															"
															>需求 = 日均销量 × 天数</template
														>
														<template
															v-else-if="
																(item.algo ||
																	batchShipDialog.globalAlgo) ===
																'history'
															"
															>需求 = 日均销量 × 历史系数 ×
															天数</template
														>
														<template
															v-else-if="
																(item.algo ||
																	batchShipDialog.globalAlgo) ===
																'trend'
															"
															>需求 = 日均销量 × 搜索系数 ×
															天数</template
														>
														<template v-else
															>综合系数 = α × 销量系数 + (1-α) ×
															搜索系数</template
														>
													</div>
													<div
														v-for="d in getShipDemandBreakdown(item)"
														:key="d.month"
														style="
															padding: 2px 0;
															border-bottom: 1px dashed
																rgba(255, 255, 255, 0.12);
														"
													>
														<div>
															{{ d.month.substring(5) }}月 ·
															{{ d.days }}天 · 系数={{
																d.coefficient
															}}
														</div>
														<div
															style="
																padding-left: 8px;
																color: #aaa;
																font-size: 11px;
															"
														>
															{{ d.dailyAvg }} × {{ d.coefficient }} ×
															{{ d.days }}天 =
															<span
																style="
																	color: #67c23a;
																	font-weight: 600;
																"
																>{{ d.subtotal }}</span
															>
														</div>
													</div>
													<div
														style="
															margin-top: 6px;
															font-weight: 600;
															color: #67c23a;
														"
													>
														合计需求: {{ item.totalDemand || 0 }}
													</div>
												</div>
											</template>
											<span
												style="
													font-size: 11px;
													cursor: help;
													border-bottom: 1px dashed #409eff;
													color: #606266;
													white-space: nowrap;
												"
											>
												需求
												<b style="color: #409eff">{{
													item.totalDemand || 0
												}}</b>
											</span>
										</el-tooltip>
										<!-- 在途 tooltip：货件列表明细 -->
										<el-tooltip
											placement="bottom"
											:disabled="
												!item._inTransitList ||
												item._inTransitList.length === 0
											"
										>
											<template #content>
												<div
													style="
														font-size: 12px;
														line-height: 1.6;
														min-width: 340px;
													"
												>
													<div
														style="
															font-weight: 600;
															margin-bottom: 6px;
															display: flex;
															justify-content: space-between;
														"
													>
														<span>在途货件明细</span>
														<span style="color: #67c23a"
															>共
															{{
																item._inTransitList?.length || 0
															}}
															条</span
														>
													</div>
													<div
														style="
															display: flex;
															padding: 4px 0;
															border-bottom: 1px solid
																rgba(255, 255, 255, 0.2);
															font-weight: 500;
															color: #ccc;
															font-size: 11px;
														"
													>
														<span style="flex: 2">货件号</span>
														<span style="flex: 1; text-align: center"
															>方式</span
														>
														<span style="flex: 1.2; text-align: center"
															>到库日期</span
														>
														<span style="flex: 0.8; text-align: right"
															>数量</span
														>
													</div>
													<div
														style="max-height: 200px; overflow-y: auto"
													>
														<div
															v-for="(s, si) in item._inTransitList ||
															[]"
															:key="si"
															style="
																display: flex;
																padding: 3px 0;
																border-bottom: 1px dashed
																	rgba(255, 255, 255, 0.08);
																font-size: 11px;
															"
														>
															<span
																style="
																	flex: 2;
																	overflow: hidden;
																	text-overflow: ellipsis;
																	white-space: nowrap;
																"
																>{{ s.orderSn || "-" }}</span
															>
															<span
																style="flex: 1; text-align: center"
																>{{ s.shippingMethod || "-" }}</span
															>
															<span
																style="
																	flex: 1.2;
																	text-align: center;
																"
																>{{ s.amazonSaleDate }}</span
															>
															<span
																style="
																	flex: 0.8;
																	text-align: right;
																	font-weight: 600;
																"
																>{{ s.quantity }}</span
															>
														</div>
													</div>
													<div
														style="
															display: flex;
															padding: 6px 0 2px;
															border-top: 1px solid
																rgba(255, 255, 255, 0.25);
															font-weight: 600;
															color: #e6a23c;
															margin-top: 2px;
														"
													>
														<span style="flex: 2">合计</span
														><span style="flex: 1"></span
														><span style="flex: 1.2"></span>
														<span style="flex: 0.8; text-align: right"
															>{{ item._inTransitQty || 0 }} 件</span
														>
													</div>
												</div>
											</template>
											<span
												style="
													font-size: 11px;
													cursor: help;
													border-bottom: 1px dashed #e6a23c;
													color: #606266;
													white-space: nowrap;
												"
											>
												在途
												<b
													:style="{
														color:
															(item._inTransitQty || 0) > 0
																? '#e6a23c'
																: '#909399'
													}"
													>{{ item._inTransitQty || 0 }}</b
												>
											</span>
										</el-tooltip>
									</div>

									<div class="ship-qty-cell">
										<span class="result-label" style="margin-right: 8px"
											>发货数</span
										>
										<el-tooltip
											:disabled="!item.occupiedQty || item.occupiedQty <= 0"
											:content="`⚠️ 还能发 ${item.maxShipQty} 个 (已被占用 ${item.occupiedQty} 个)`"
											placement="top"
											effect="dark"
										>
											<el-input-number
												v-model="item.shipQty"
												:min="0"
												:max="
													item.maxShipQty !== undefined
														? item.maxShipQty
														: item.purchaseQty
												"
												size="small"
												controls-position="right"
												style="width: 90px"
											/>
										</el-tooltip>
									</div>

									<div
										class="ship-qty-cell"
										style="
											margin-left: 20px;
											flex-direction: column;
											align-items: flex-start;
											gap: 6px;
										"
									>
										<!-- 第一行: 预计发货 -->
										<div style="display: flex; align-items: center">
											<span class="result-label" style="width: 60px"
												>预计发货</span
											>
											<el-popover
												v-if="
													item.plan_sn &&
													shipmentMetrics.byPlan[item.plan_sn] &&
													shipmentMetrics.byPlan[item.plan_sn].items
														.length > 0
												"
												placement="right"
												:width="360"
												trigger="hover"
												popper-class="ship-hover-popover"
											>
												<template #reference>
													<span
														style="
															cursor: pointer;
															padding: 2px 5px;
															color: #409eff;
															border-bottom: 1px dashed #409eff;
															font-weight: bold;
															font-size: 14px;
														"
													>
														{{
															shipmentMetrics.byPlan[item.plan_sn]
																.totalQty
														}}
													</span>
												</template>
												<div>
													<!-- 顶部汇总条 -->
													<div
														style="
															display: flex;
															justify-content: space-between;
															align-items: center;
															margin-bottom: 8px;
															padding-bottom: 6px;
															border-bottom: 2px solid #ebeef5;
														"
													>
														<span
															style="
																font-weight: bold;
																font-size: 13px;
																color: #303133;
															"
															>预计发货明细 (按批次)</span
														>
														<span style="font-size: 12px"
															>合计:
															<span
																style="
																	color: #409eff;
																	font-weight: bold;
																	font-family: Tahoma;
																	font-size: 14px;
																"
																>{{
																	shipmentMetrics.byPlan[
																		item.plan_sn
																	].totalQty
																}}</span
															></span
														>
													</div>

													<!-- 批次列表 -->
													<div
														style="
															max-height: 400px;
															overflow-y: auto;
															padding-right: 5px;
														"
													>
														<div
															v-for="(batch, idx) in shipmentMetrics
																.byPlan[item.plan_sn].items"
															:key="idx"
															:style="{
																marginBottom: '10px',
																paddingBottom: '10px',
																borderBottom:
																	idx ===
																	shipmentMetrics.byPlan[
																		item.plan_sn
																	].items.length -
																		1
																		? 'none'
																		: '1px dashed #ebeef5'
															}"
														>
															<div
																style="
																	display: flex;
																	justify-content: space-between;
																	align-items: flex-start;
																	margin-bottom: 4px;
																"
															>
																<div
																	style="
																		font-weight: bold;
																		font-size: 13px;
																		color: #303133;
																	"
																>
																	批次号: {{ batch.seq }}
																</div>
																<el-tag
																	size="small"
																	:type="
																		batch.status === 1
																			? 'info'
																			: batch.status === 5
																				? 'success'
																				: batch.status === 6
																					? 'danger'
																					: 'primary'
																	"
																	effect="plain"
																	style="
																		height: 20px;
																		padding: 0 4px;
																		line-height: 18px;
																	"
																	>{{ batch.status_text }}</el-tag
																>
															</div>

															<div
																style="
																	font-size: 11px;
																	color: #909399;
																	margin-bottom: 4px;
																"
															>
																创于:
																{{ batch.createTime || "-" }} |
																运输:
																{{ batch.shipping_method || "-" }}
															</div>
															<div
																style="
																	font-size: 11px;
																	color: #606266;
																	margin-bottom: 4px;
																"
															>
																发货仓库: {{ batch.sname || "-" }} /
																{{ batch.wname || "-" }}
															</div>
															<div
																v-if="batch.batch_remark"
																style="
																	font-size: 11px;
																	color: #606266;
																	margin-bottom: 4px;
																"
															>
																单据备注:
																<span style="color: #f56c6c">{{
																	batch.batch_remark
																}}</span>
															</div>

															<!-- 伪装成嵌套内容的该明细自身数据 (现在强行加入父级商品图文，同外部表格严格统一) -->
															<div
																style="
																	margin-top: 6px;
																	padding: 6px;
																	background-color: #fafbfc;
																	border-left: 2px solid #dcdfe6;
																	border-radius: 0 4px 4px 0;
																	display: flex;
																	gap: 8px;
																"
															>
																<!-- 左侧产品小图 (强制继承) -->
																<el-image
																	v-if="item.product_img"
																	:src="item.product_img"
																	style="
																		width: 38px;
																		height: 38px;
																		border-radius: 4px;
																		border: 1px solid #ebeef5;
																		flex-shrink: 0;
																	"
																	fit="cover"
																/>
																<!-- 右侧产品明细内容 -->
																<div style="flex: 1; min-width: 0">
																	<div
																		class="text-ellipsis-2"
																		:title="item.product_name"
																		style="
																			color: #303133;
																			font-size: 11px;
																			line-height: 1.3;
																			margin-bottom: 2px;
																		"
																	>
																		{{
																			item.product_name || "-"
																		}}
																	</div>
																	<div
																		style="
																			font-size: 11px;
																			color: #909399;
																			margin-bottom: 4px;
																			display: flex;
																			align-items: center;
																			justify-content: space-between;
																		"
																	>
																		<span
																			>SKU:
																			{{ item.sku }}</span
																		>
																		<span style="color: #606266"
																			>发货量:
																			<span
																				style="
																					color: #409eff;
																					font-weight: bold;
																					font-family: Tahoma;
																					font-size: 12px;
																				"
																				>{{
																					batch.shipment_plan_quantity
																				}}</span
																			></span
																		>
																	</div>
																	<div
																		v-if="batch.remark"
																		style="
																			font-size: 11px;
																			color: #e6a23c;
																		"
																	>
																		明细备注: {{ batch.remark }}
																	</div>
																</div>
															</div>
														</div>
													</div>
												</div>
											</el-popover>
											<span
												v-else
												style="
													color: #909399;
													font-weight: bold;
													padding: 2px 5px;
												"
												>-</span
											>
										</div>

										<!-- 第二行: 实际发货 -->
										<div style="display: flex; align-items: center">
											<span class="result-label" style="width: 60px"
												>实际发货</span
											>
											<el-popover
												v-if="
													item.plan_sn &&
													getActualDataForPlan(item.plan_sn)
												"
												placement="right"
												:width="350"
												trigger="hover"
												popper-class="ship-hover-popover"
											>
												<template #reference>
													<span
														style="
															cursor: pointer;
															padding: 2px 5px;
															color: #67c23a;
															font-weight: bold;
															border-bottom: 1px dashed #67c23a;
															font-size: 14px;
														"
													>
														{{
															getActualDataForPlan(item.plan_sn)
																?.totalActualQty
														}}
													</span>
												</template>
												<div>
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
																		font-family:
																			Tahoma, sans-serif;
																	"
																	>{{
																		getActualDataForPlan(
																			item.plan_sn
																		)?.totalActualQty || 0
																	}}</span
																>
															</div>
															<div
																style="
																	font-size: 12px;
																	color: #606266;
																"
															>
																计划总量
																<span
																	style="
																		font-family:
																			Tahoma, sans-serif;
																		font-weight: bold;
																	"
																	>{{
																		getActualDataForPlan(
																			item.plan_sn
																		)?.totalPlanQty || 0
																	}}</span
																>
															</div>
														</div>
														<el-progress
															:percentage="
																Math.min(
																	((getActualDataForPlan(
																		item.plan_sn
																	)?.totalActualQty || 0) /
																		(getActualDataForPlan(
																			item.plan_sn
																		)?.totalPlanQty || 1)) *
																		100,
																	100
																)
															"
															:show-text="false"
															color="#67C23A"
															:stroke-width="6"
														/>
													</div>

													<!-- 2. 中间：确认物质实体 (商品卡片) -->
													<div
														v-if="
															getActualDataForPlan(item.plan_sn)
																?.productInfo?.product_name
														"
														style="
															display: flex;
															align-items: center;
															gap: 10px;
															margin-bottom: 12px;
															padding: 8px;
															background: #ffffff;
															border: 1px solid #ebeef5;
															border-radius: 6px;
															box-shadow: 0 2px 4px
																rgba(0, 0, 0, 0.02);
														"
													>
														<el-image
															v-if="
																getActualDataForPlan(item.plan_sn)
																	?.productInfo?.small_image_url
															"
															:src="
																getActualDataForPlan(item.plan_sn)
																	?.productInfo?.small_image_url
															"
															:preview-src-list="[
																getActualDataForPlan(item.plan_sn)
																	?.productInfo?.small_image_url
															]"
															fit="cover"
															style="
																width: 36px;
																height: 36px;
																border-radius: 4px;
																flex-shrink: 0;
																cursor: zoom-in;
															"
														/>
														<div style="overflow: hidden; flex: 1">
															<div
																style="
																	font-size: 13px;
																	font-weight: bold;
																	color: #303133;
																	white-space: nowrap;
																	overflow: hidden;
																	text-overflow: ellipsis;
																	margin-bottom: 2px;
																"
																:title="
																	getActualDataForPlan(
																		item.plan_sn
																	)?.productInfo?.product_name
																"
															>
																{{
																	getActualDataForPlan(
																		item.plan_sn
																	)?.productInfo?.product_name
																}}
															</div>
															<div
																style="
																	font-size: 11px;
																	color: #909399;
																	display: flex;
																	align-items: center;
																	gap: 4px;
																"
															>
																SKU:
																{{
																	getActualDataForPlan(
																		item.plan_sn
																	)?.productInfo?.sku
																}}
															</div>
														</div>
													</div>

													<!-- 3. 底部：追踪履约轨迹 (发货单列) -->
													<div
														style="
															max-height: 200px;
															overflow-y: auto;
															padding-right: 4px;
														"
													>
														<div
															v-for="(
																detail, idx
															) in getActualDataForPlan(item.plan_sn)
																?.details"
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
																<div
																	style="
																		display: flex;
																		align-items: center;
																		gap: 6px;
																	"
																>
																	<span style="font-size: 14px"
																		>🚚</span
																	>
																	<span
																		style="
																			font-family:
																				&quot;Consolas&quot;,
																				&quot;Courier New&quot;,
																				monospace;
																			font-size: 14px;
																			font-weight: bold;
																			color: #303133;
																		"
																		>{{
																			detail.shipment_sn ||
																			"-"
																		}}</span
																	>
																</div>
																<el-tag
																	size="small"
																	:type="
																		detail.is_final
																			? 'success'
																			: 'primary'
																	"
																	effect="light"
																	style="border: none"
																	>{{
																		detail.shipment_status_name ||
																		"进行中"
																	}}</el-tag
																>
															</div>
															<div
																style="
																	display: flex;
																	justify-content: space-between;
																	align-items: center;
																	font-size: 12px;
																"
															>
																<div style="color: #606266">
																	<span style="color: #909399"
																		>数量:</span
																	>
																	<span
																		style="
																			color: #303133;
																			font-weight: bold;
																			font-family:
																				Tahoma, sans-serif;
																		"
																		>{{
																			detail.shipment_list_quantity ||
																			0
																		}}</span
																	>
																</div>
																<div style="color: #606266">
																	<span style="color: #909399"
																		>物流:</span
																	>
																	{{ detail.method_name || "-" }}
																</div>
																<div
																	v-if="detail.shipment_time"
																	style="
																		color: #909399;
																		font-size: 11px;
																	"
																>
																	{{
																		detail.shipment_time.substring(
																			5,
																			16
																		)
																	}}
																</div>
															</div>
														</div>
													</div>
												</div>
											</el-popover>
											<span
												v-else
												style="
													color: #909399;
													font-weight: bold;
													padding: 2px 5px;
												"
												>-</span
											>
										</div>
									</div>

									<!-- 状态标签 (替代原来的文字备注) -->
									<el-tag
										:type="item.gap > 0 ? 'danger' : 'success'"
										effect="plain"
										style="margin-left: auto"
									>
										{{ item.remark }}
									</el-tag>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- 汇总栏 -->
				<div class="batch-summary-bar">
					<div class="summary-chip">
						<span class="chip-label">共</span>
						<span class="chip-value">{{ batchShipDialog.items.length }}</span>
						<span class="chip-unit">个产品</span>
					</div>
					<div class="summary-chip warn">
						<span class="chip-label">需补货</span>
						<span class="chip-value">{{ batchShipSummary.needReplenish }}</span>
					</div>
					<div class="summary-chip ok">
						<span class="chip-label">库存充足</span>
						<span class="chip-value">{{ batchShipSummary.sufficient }}</span>
					</div>
					<div class="summary-chip total">
						<span class="chip-label">总缺口</span>
						<span class="chip-value">{{ batchShipSummary.totalGap }}</span>
						<span class="chip-unit">件</span>
					</div>
					<div class="summary-chip ship-total">
						<span class="chip-label">总发货</span>
						<span class="chip-value">{{ batchShipSummary.totalShipQty }}</span>
						<span class="chip-unit">件</span>
					</div>
					<div class="summary-chip total-cost">
						<span class="chip-label">采购总额</span>
						<span class="chip-value">¥{{ batchShipSummary.totalCost }}</span>
					</div>
					<div style="flex-grow: 1"></div>
					<el-button
						v-if="totalTempSaves > 0"
						type="info"
						plain
						size="small"
						@click="openTempDrawer()"
						>📋 查看全部暂存 ({{ totalTempSaves }})</el-button
					>
				</div>
			</div>

			<template #footer>
				<el-button @click="() => handleBatchDialogClose()" size="large">取消</el-button>
				<el-button
					type="primary"
					size="large"
					:disabled="totalTempSaves === 0"
					@click="openShipPlan"
					>下一步 →</el-button
				>
			</template>
		</el-dialog>

		<!-- 填写发货单据弹窗 -->
		<el-dialog
			v-model="shipPlanDialog.visible"
			title="填写发货单据"
			width="1060px"
			:append-to-body="true"
			top="3vh"
			destroy-on-close
		>
			<div
				v-if="Object.keys(groupedPlanRecords).length === 0"
				style="text-align: center; padding: 40px; color: #909399"
			>
				<div style="font-size: 36px; margin-bottom: 10px">📦</div>
				<div>暂无发货计划</div>
			</div>

			<el-collapse
				v-if="Object.keys(groupedPlanRecords).length > 0"
				v-model="shipPlanActiveCollapse"
				accordion
			>
				<el-collapse-item
					v-for="(group, methodKey) in groupedPlanRecords"
					:key="methodKey"
					:name="methodKey"
				>
					<template #title>
						<div style="display: flex; align-items: center; gap: 8px; width: 100%">
							<span
								style="
									display: inline-block;
									width: 10px;
									height: 10px;
									border-radius: 50%;
								"
								:style="{ background: group.method.color }"
							></span>
							<span style="font-size: 15px; font-weight: 600"
								>{{ group.method.icon }} {{ group.method.label }}</span
							>
							<el-tag size="small" round type="info"
								>{{ group.records.length }} 件</el-tag
							>
							<el-tag size="small" round type="success"
								>共
								{{
									group.records.reduce(
										(s: number, r: any) => s + (r.shipQty || 0),
										0
									)
								}}
								发货</el-tag
							>
						</div>
					</template>

					<!-- 批量应用栏（grid对齐） -->
					<div
						class="sp-grid-row sp-batch-bar"
						style="padding-left: 28px; padding-right: 28px"
					>
						<span class="sp-grid-label" style="text-align: right; padding-right: 4px"
							>批量应用：</span
						>
						<el-select
							v-model="batchValues[methodKey].warehouse"
							size="small"
							placeholder="发货仓库"
							@change="
								(v: string) => batchSetPlanField(String(methodKey), 'warehouse', v)
							"
							clearable
						>
							<el-option-group
								v-if="warehouseList.local.length > 0"
								label="── 本地仓 ──"
							>
								<el-option
									v-for="item in warehouseList.local"
									:key="item.wid"
									:label="item.name"
									:value="item.wid"
								/>
							</el-option-group>
							<el-option-group
								v-if="warehouseList.overseas.length > 0"
								label="── 海外仓 ──"
							>
								<el-option
									v-for="item in warehouseList.overseas"
									:key="item.wid"
									:label="item.name"
									:value="item.wid"
								/>
							</el-option-group>
							<el-option-group
								v-if="warehouseList.awd.length > 0"
								label="── AWD仓 ──"
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
							v-model="batchValues[methodKey].packageType"
							size="small"
							placeholder="包装类型"
							@change="
								(v: string) =>
									batchSetPlanField(String(methodKey), 'packageType', v)
							"
							clearable
						>
							<el-option
								v-for="o in packageTypeOptions"
								:key="o.value"
								:value="o.value"
								:label="o.label"
							/>
						</el-select>
						<el-date-picker
							v-model="batchValues[methodKey].planShipDate"
							size="small"
							type="date"
							placeholder="发货时间"
							value-format="YYYY-MM-DD"
							:disabled-date="disabledDate"
							@change="
								(v: string) =>
									batchSetPlanField(String(methodKey), 'planShipDate', v)
							"
							clearable
						/>
						<span></span>
					</div>

					<!-- 明细列表 -->
					<div class="sp-items" style="padding: 10px 14px">
						<div
							v-for="(record, idx) in group.records"
							:key="record.id"
							class="sp-item"
							style="flex-direction: column; align-items: stretch"
						>
							<!-- 第一行：产品信息 + 发货数量 -->
							<div
								style="
									display: flex;
									align-items: center;
									gap: 10px;
									margin-bottom: 8px;
								"
							>
								<el-image
									v-if="record.productImg"
									:src="record.productImg"
									:preview-src-list="[record.productImg]"
									hide-on-click-modal
									fit="cover"
									class="sp-item-img"
								/>
								<div class="sp-item-meta" style="flex: 1">
									<div class="sp-item-name">
										{{ record.productName || record.asin }}
									</div>
									<div class="sp-item-sub">
										ASIN: {{ record.asin }} | SKU: {{ record.sku }} | 采购单:
										{{ record.orderSn }}
									</div>
								</div>
								<div style="text-align: center; flex-shrink: 0; min-width: 60px">
									<div style="font-size: 11px; color: #909399">发货数量</div>
									<div style="font-size: 18px; font-weight: 700; color: #67c23a">
										{{ record.shipQty }}
									</div>
								</div>
							</div>
							<!-- 第二行：4个必填字段 + 备注（grid对齐） -->
							<div class="sp-grid-row">
								<span
									class="sp-grid-label"
									style="text-align: right; padding-right: 4px"
									>明细属性：</span
								>
								<el-select
									v-model="record.warehouse"
									size="small"
									placeholder="发货仓库"
								>
									<el-option-group
										v-if="warehouseList.local.length > 0"
										label="── 本地仓 ──"
									>
										<el-option
											v-for="item in warehouseList.local"
											:key="item.wid"
											:label="item.name"
											:value="item.wid"
										/>
									</el-option-group>
									<el-option-group
										v-if="warehouseList.overseas.length > 0"
										label="── 海外仓 ──"
									>
										<el-option
											v-for="item in warehouseList.overseas"
											:key="item.wid"
											:label="item.name"
											:value="item.wid"
										/>
									</el-option-group>
									<el-option-group
										v-if="warehouseList.awd.length > 0"
										label="── AWD仓 ──"
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
								>
									<el-option
										v-for="o in packageTypeOptions"
										:key="o.value"
										:value="o.value"
										:label="o.label"
									/>
								</el-select>
								<el-date-picker
									v-model="record.planShipDate"
									size="small"
									type="date"
									placeholder="发货时间"
									value-format="YYYY-MM-DD"
									:disabled-date="disabledDate"
								/>

								<el-input v-model="record.remark" size="small" placeholder="备注" />
							</div>
						</div>
					</div>
					<!-- 批次备注（每个运输方式分组独立备注） -->
					<div
						style="
							padding: 8px 28px 4px;
							display: flex;
							align-items: flex-start;
							gap: 8px;
						"
					>
						<span
							style="
								font-size: 12px;
								color: #909399;
								white-space: nowrap;
								line-height: 28px;
							"
							>批次备注：</span
						>
						<el-input
							v-model="batchValues[methodKey].batchRemark"
							type="textarea"
							:rows="2"
							:placeholder="`可选，填写 ${group.method.icon} ${group.method.label} 批次的备注信息`"
						/>
					</div>
				</el-collapse-item>
			</el-collapse>

			<template #footer>
				<el-button @click="shipPlanDialog.visible = false" size="large">返回</el-button>
				<el-button type="primary" size="large" @click="handleNextStep">下一步 →</el-button>
			</template>
		</el-dialog>

		<!-- 发货计划最终确认弹窗 -->
		<el-dialog
			v-model="finalConfirmDialog.visible"
			title="发货计划最终确认"
			width="1060px"
			:append-to-body="true"
			top="3vh"
			destroy-on-close
		>
			<div style="max-height: 72vh; overflow-y: auto">
				<!-- 确认页（提交前） -->
				<template v-if="!submitResults">
					<div
						v-for="(group, methodKey) in groupedPlanRecords"
						:key="methodKey"
						style="margin-bottom: 24px"
					>
						<div
							style="
								font-size: 16px;
								font-weight: 600;
								margin-bottom: 12px;
								display: flex;
								align-items: center;
								gap: 8px;
							"
						>
							<span>{{ group.method.icon }}</span>
							<span
								>{{ group.method.label }}货件 ({{
									group.records.length
								}}
								条记录，共发货
								{{
									group.records.reduce((s, r) => s + (r.shipQty || 0), 0)
								}}
								件)</span
							>
						</div>
						<el-table
							:data="group.records"
							border
							style="width: 100%"
							size="small"
							:header-cell-style="{
								background: '#f5f7fa',
								color: '#606266',
								fontWeight: 600
							}"
						>
							<el-table-column label="图片" width="70" align="center">
								<template #default="{ row }">
									<el-image
										v-if="row.productImg"
										:src="row.productImg"
										:preview-src-list="[row.productImg]"
										hide-on-click-modal
										preview-teleported
										fit="cover"
										style="width: 36px; height: 36px; border-radius: 4px"
									/>
								</template>
							</el-table-column>
							<el-table-column label="产品名称" min-width="180">
								<template #default="{ row }">
									<div style="font-weight: 500; font-size: 13px">
										{{ row.productName || "-" }}
									</div>
									<div style="font-size: 12px; color: #909399; margin-top: 2px">
										{{ row.orderSn }}
									</div>
								</template>
							</el-table-column>
							<el-table-column label="单价" width="80" align="center">
								<template #default="{ row }">
									<span
										v-if="row.unitPrice"
										style="font-weight: 500; color: #ff9900"
										>￥{{ row.unitPrice }}</span
									>
									<span v-else style="color: #c0c4cc">-</span>
								</template>
							</el-table-column>
							<el-table-column label="计划发货" width="90" align="center">
								<template #default="{ row }">
									<span
										style="font-size: 15px; font-weight: 700; color: #67c23a"
										>{{ row.shipQty }}</span
									>
								</template>
							</el-table-column>
							<el-table-column label="发货仓库" width="110" align="center">
								<template #default="{ row }">
									{{
										[
											...warehouseList.local,
											...warehouseList.overseas,
											...warehouseList.awd
										].find((w) => w.wid === row.warehouse)?.name ||
										row.warehouse
									}}
								</template>
							</el-table-column>
							<el-table-column label="包装类型" width="100" align="center">
								<template #default="{ row }">
									{{
										packageTypeOptions.find((o) => o.value === row.packageType)
											?.label || row.packageType
									}}
								</template>
							</el-table-column>
							<el-table-column
								prop="planShipDate"
								label="发货时间"
								width="110"
								align="center"
							/>
							<el-table-column label="备注" min-width="120">
								<template #default="{ row }">
									<span v-if="row.remark">{{ row.remark }}</span>
									<span v-else style="color: #c0c4cc">-</span>
								</template>
							</el-table-column>
						</el-table>
						<div
							v-if="batchValues[methodKey]?.batchRemark"
							style="
								margin-top: 8px;
								padding: 8px 12px;
								background: #f5f7fa;
								border-radius: 4px;
								font-size: 13px;
								color: #606266;
							"
						>
							<span style="color: #909399">批次备注：</span
							>{{ batchValues[methodKey].batchRemark }}
						</div>
					</div>
				</template>

				<!-- 提交结果页 -->
				<template v-else>
					<div style="padding: 20px 0">
						<div
							v-for="result in submitResults"
							:key="result.methodKey"
							style="
								margin-bottom: 16px;
								border-radius: 8px;
								border: 1px solid;
								overflow: hidden;
							"
							:style="{ borderColor: result.success ? '#b3e19d' : '#fab6b6' }"
						>
							<div
								style="
									padding: 16px;
									display: flex;
									align-items: center;
									justify-content: space-between;
								"
								:style="{ background: result.success ? '#f0f9eb' : '#fef0f0' }"
							>
								<div style="display: flex; align-items: center; gap: 10px">
									<span style="font-size: 24px">{{
										result.success ? "✅" : "❌"
									}}</span>
									<div>
										<div style="font-size: 15px; font-weight: 600">
											{{
												shippingMethods.find(
													(m) => m.key === result.methodKey
												)?.icon
											}}
											{{
												shippingMethods.find(
													(m) => m.key === result.methodKey
												)?.label || result.methodKey
											}}货件 （{{
												groupedPlanRecords[result.methodKey]?.records
													?.length || 0
											}}条，共
											{{
												groupedPlanRecords[
													result.methodKey
												]?.records?.reduce(
													(s: number, r: any) => s + (r.shipQty || 0),
													0
												) || 0
											}}
											件） —— {{ result.success ? "提交成功" : "提交失败" }}
										</div>
										<div
											v-if="result.success"
											style="font-size: 13px; color: #67c23a; margin-top: 4px"
										>
											批次号：{{ result.seq }} | 计划编号：{{
												result.order_sn?.join(", ")
											}}
										</div>
										<div
											v-else
											style="font-size: 13px; color: #f56c6c; margin-top: 4px"
										>
											错误原因：{{ result.error }}
										</div>
									</div>
								</div>
								<el-button
									v-if="!result.success"
									type="warning"
									size="small"
									:loading="result.retrying"
									@click="retryGroup(result.methodKey)"
								>
									🔄 重试
								</el-button>
							</div>
							<!-- 明细列表 -->
							<div
								v-if="groupedPlanRecords[result.methodKey]?.records"
								style="padding: 4px 16px 8px; background: #fff"
							>
								<div
									v-for="(record, idx) in groupedPlanRecords[result.methodKey]
										.records"
									:key="idx"
									style="
										display: flex;
										align-items: center;
										gap: 10px;
										padding: 8px 0;
										font-size: 13px;
									"
									:style="{
										borderBottom:
											idx <
											groupedPlanRecords[result.methodKey].records.length - 1
												? '1px dashed #ebeef5'
												: 'none'
									}"
								>
									<el-image
										v-if="record.productImg"
										:src="record.productImg"
										fit="cover"
										style="
											width: 32px;
											height: 32px;
											border-radius: 4px;
											flex-shrink: 0;
										"
									/>
									<div style="flex: 1; min-width: 0">
										<div
											style="
												overflow: hidden;
												text-overflow: ellipsis;
												white-space: nowrap;
												color: #303133;
												font-weight: 500;
											"
										>
											{{ record.productName || record.asin }}
										</div>
										<div
											style="font-size: 12px; color: #909399; margin-top: 2px"
										>
											MSKU: {{ record.msku }} | 采购单: {{ record.orderSn }}
										</div>
									</div>
									<div
										v-if="record.unitPrice"
										style="
											flex-shrink: 0;
											color: #ff9900;
											font-size: 12px;
											min-width: 60px;
											text-align: right;
										"
									>
										￥{{ record.unitPrice }}
									</div>
									<div style="flex-shrink: 0; min-width: 60px; text-align: right">
										<span
											style="
												font-size: 16px;
												font-weight: 700;
												color: #67c23a;
											"
											>{{ record.shipQty }}</span
										>
										<span style="font-size: 11px; color: #909399"> 件</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</template>
			</div>

			<template #footer>
				<div style="display: flex; justify-content: space-between; align-items: center">
					<div style="color: #606266; font-size: 14px">
						<template v-if="!submitResults">
							总计：生成
							<span style="font-weight: 600; color: #409eff">{{
								Object.keys(groupedPlanRecords).length
							}}</span>
							种运输方式的发货计划， 共
							<span style="font-weight: 600; color: #f56c6c">{{
								Object.values(groupedPlanRecords).reduce(
									(sum, g: any) =>
										sum +
										g.records.reduce(
											(s: number, r: any) => s + (r.shipQty || 0),
											0
										),
									0
								)
							}}</span>
							件商品。
						</template>
						<template v-else>
							提交完成：成功
							<span style="font-weight: 600; color: #67c23a">{{
								submitResults.filter((r) => r.success).length
							}}</span>
							组， 失败
							<span style="font-weight: 600; color: #f56c6c">{{
								submitResults.filter((r) => !r.success).length
							}}</span>
							组
						</template>
					</div>
					<div>
						<template v-if="!submitResults">
							<el-button @click="finalConfirmDialog.visible = false" size="large"
								>返回修改</el-button
							>
							<el-button
								type="primary"
								size="large"
								:loading="isSubmittingPlan"
								@click="submitShippingPlan"
								>确认提交发货</el-button
							>
						</template>
						<template v-else>
							<el-button
								v-if="submitResults.some((r) => !r.success)"
								@click="resetSubmitResults"
								size="large"
								>返回修改</el-button
							>
							<el-button type="primary" size="large" @click="closeAfterSubmit"
								>关闭</el-button
							>
						</template>
					</div>
				</div>
			</template>
		</el-dialog>

		<!-- 暂存记录抽屉 -->
		<el-drawer
			v-model="tempSaveDrawerVisible"
			title="全部暂存记录"
			size="520px"
			:append-to-body="true"
		>
			<template #header>
				<div style="display: flex; align-items: center; gap: 8px">
					<span style="font-size: 16px; font-weight: 600">📋 全部暂存记录</span>
					<el-tag size="small" type="info" round>{{ totalTempSaves }} 条</el-tag>
				</div>
			</template>
			<div
				v-if="totalTempSaves === 0"
				style="text-align: center; padding: 60px 0; color: #909399"
			>
				<div style="font-size: 40px; margin-bottom: 12px">📭</div>
				<div>暂无暂存记录</div>
			</div>
			<div v-else>
				<div
					v-for="(records, itemKey) in filteredTempSaveRecords"
					:key="itemKey"
					style="
						margin-bottom: 16px;
						background: #fff;
						border: 1px solid #e4e7ed;
						border-radius: 10px;
						padding: 14px;
						box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
					"
				>
					<!-- 产品标题 -->
					<div
						style="
							display: flex;
							align-items: center;
							gap: 8px;
							margin-bottom: 10px;
							padding-bottom: 10px;
							border-bottom: 2px solid #f0f2f5;
						"
					>
						<el-image
							v-if="records[0]?.productImg"
							:src="records[0].productImg"
							:preview-src-list="[records[0].productImg]"
							hide-on-click-modal
							fit="cover"
							style="
								width: 40px;
								height: 40px;
								border-radius: 6px;
								border: 1px solid #ebeef5;
								cursor: pointer;
								flex-shrink: 0;
							"
						/>
						<div style="flex: 1; min-width: 0">
							<div
								style="
									font-size: 13px;
									font-weight: 600;
									color: #303133;
									overflow: hidden;
									text-overflow: ellipsis;
									white-space: nowrap;
								"
							>
								{{ records[0]?.productName || records[0]?.asin || itemKey }}
							</div>
							<div style="font-size: 11px; color: #909399">
								ASIN: {{ records[0]?.asin }} | SKU: {{ records[0]?.sku }}
								<span v-if="records[0]?.unitPrice" style="margin-left: 6px"
									>单价: ¥{{ records[0].unitPrice }}</span
								>
							</div>
						</div>
						<div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0">
							<el-tag size="small" type="info" round>{{ records.length }} 条</el-tag>
							<el-tag size="small" type="success" round
								>共
								{{
									records.reduce((s: number, r: any) => s + (r.shipQty || 0), 0)
								}}
								件</el-tag
							>
						</div>
					</div>
					<!-- 记录列表 -->
					<div
						v-for="record in records"
						:key="record.id"
						style="
							padding: 10px 12px;
							margin-bottom: 8px;
							background: #f8f9fa;
							border-radius: 8px;
							border: 1px solid #ebeef5;
						"
					>
						<div
							style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px"
						>
							<el-tag
								v-if="record.shippingLabel"
								size="small"
								round
								:style="{
									background: record.shippingColor + '20',
									color: record.shippingColor,
									borderColor: record.shippingColor
								}"
								>{{ record.shippingIcon }} {{ record.shippingLabel }}</el-tag
							>
							<span style="font-size: 12px; color: #606266"
								>{{ record.dateRange[0] }} ~ {{ record.dateRange[1] }}</span
							>
							<span style="font-size: 11px; color: #909399">{{
								record.algoLabel
							}}</span>
							<el-button
								size="small"
								type="danger"
								link
								@click="deleteTempRecord(String(itemKey), record.id)"
								style="margin-left: auto; flex-shrink: 0"
								>删除</el-button
							>
						</div>
						<div
							style="
								display: flex;
								gap: 14px;
								font-size: 12px;
								color: #606266;
								flex-wrap: wrap;
							"
						>
							<span
								>日均: <strong>{{ record.dailySales }}</strong></span
							>
							<span
								>需求: <strong>{{ record.totalDemand }}</strong></span
							>
							<span
								>缺口:
								<strong style="color: #f56c6c">{{ record.gap }}</strong></span
							>
							<span
								>发货:
								<strong style="color: #67c23a">{{ record.shipQty }}</strong></span
							>
							<span
								>采购单: <strong>{{ record.orderSn }}</strong></span
							>
						</div>
					</div>
				</div>
			</div>
		</el-drawer>
		<el-drawer v-model="logisticsDrawer.visible" title="物流明细" size="760px">
			<template #header>
				<div
					style="
						display: flex;
						justify-content: space-between;
						align-items: center;
						padding-right: 20px;
					"
				>
					<span style="font-size: 16px; font-weight: 600; color: #303133"
						>物流明细 - {{ logisticsDrawer.orderSn }}</span
					>
					<div class="logistics-drawer-actions">
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
				</div>
			</template>

			<div class="logistics-content" v-loading="logisticsDrawer.loading">
				<div v-if="logisticsDrawer.data?.length" class="logistics-card-list">
					<div
						v-for="(pkg, pkgIndex) in logisticsDrawer.data"
						:key="pkg.id || pkg.tracking_no || pkgIndex"
						class="logistics-pkg-card"
					>
						<div class="pkg-card-header" @click="togglePkgExpand(pkgIndex)">
							<div class="pkg-card-left">
								<span class="pkg-index">包裹 {{ pkgIndex + 1 }}</span>
								<span class="pkg-company">{{
									pkg.raw_company_name ||
									pkg.company_name ||
									pkg.logistics_company ||
									"未知物流"
								}}</span>
								<LogisticsSourcePopover
									v-if="getPackageSourceCount(pkg) > 1"
									:sources="getPackageSourceItems(pkg)"
									:count="getPackageSourceCount(pkg)"
								>
									<template #reference>
										<button
											type="button"
											class="pkg-source-trigger"
											@click.stop
										>
											查看 {{ getPackageSourceCount(pkg) }} 条来源
										</button>
									</template>
								</LogisticsSourcePopover>
							</div>
							<div class="pkg-card-right">
								<el-tag
									:type="getLogisticsTagType(pkg.status)"
									size="small"
									effect="dark"
								>
									{{ pkg.status_text || pkg.status || "未知" }}
								</el-tag>
								<el-icon
									class="pkg-expand-icon"
									:class="{
										'is-expanded':
											logisticsDrawer.expandedPkgs.includes(pkgIndex)
									}"
								>
									<caret-bottom />
								</el-icon>
							</div>
						</div>

						<div class="pkg-card-tracking">
							<span class="tracking-label">运单号：</span>
							<span class="tracking-value">{{
								pkg.tracking_no || pkg.logistics_order_no || "-"
							}}</span>
							<el-button
								v-if="pkg.tracking_no || pkg.logistics_order_no"
								type="primary"
								link
								size="small"
								:icon="CopyDocument"
								@click.stop="copyText(pkg.tracking_no || pkg.logistics_order_no)"
								>复制</el-button
							>
						</div>

						<div
							v-show="logisticsDrawer.expandedPkgs.includes(pkgIndex)"
							class="pkg-card-body"
						>
							<div class="pkg-meta-grid">
								<div class="pkg-meta-item">
									<span>原始公司</span>
									<strong>{{
										pkg.raw_company_name || pkg.logistics_company || "-"
									}}</strong>
								</div>
								<div class="pkg-meta-item">
									<span>来源数量</span>
									<strong>{{ getPackageSourceCount(pkg) }} 条</strong>
								</div>
								<div class="pkg-meta-item">
									<span>快递100编码</span>
									<strong>{{ pkg.company_code || "-" }}</strong>
								</div>
								<div class="pkg-meta-item">
									<span>查询方式</span>
									<el-tooltip :content="getQueryModeHelp(pkg)" placement="top">
										<strong>{{ getQueryModeText(pkg.query_mode) }}</strong>
									</el-tooltip>
								</div>
								<div class="pkg-meta-item">
									<span>查询状态</span>
									<el-tooltip :content="getQueryBlockText(pkg)" placement="top">
										<el-tag size="small" :type="getQueryStatusTagType(pkg)">
											{{ getQueryBlockText(pkg) }}
										</el-tag>
									</el-tooltip>
								</div>
								<div class="pkg-meta-item">
									<span>手机号</span>
									<strong>{{ getPhoneStatusText(pkg) }}</strong>
								</div>
								<div class="pkg-meta-item">
									<span>上次查询</span>
									<strong>{{
										formatDateTime(pkg.last_query_time || pkg.last_sync_time)
									}}</strong>
								</div>
								<div class="pkg-meta-item">
									<span>下次可查</span>
									<el-tooltip
										content="快递100要求同一单号查询间隔至少半小时，系统统一限制为 45 分钟。"
									>
										<strong>{{ formatDateTime(pkg.next_query_after) }}</strong>
									</el-tooltip>
								</div>
							</div>

							<div v-if="getPackageSourceItems(pkg).length" class="pkg-source-panel">
								<div class="pkg-source-title">
									<span>来源明细（{{ getPackageSourceCount(pkg) }} 条）</span>
									<small
										>同一采购单同一运单只生成一个包裹；这里保留领星返回的全部来源。</small
									>
								</div>
								<div
									v-for="(source, sourceIndex) in getPackageSourceItems(pkg)"
									:key="`${pkg.id || pkg.tracking_no}-${sourceIndex}`"
									class="pkg-source-row"
								>
									<span class="source-index">{{ sourceIndex + 1 }}</span>
									<div class="source-main">
										<div class="source-company-line">
											<span class="source-company">{{
												getSourceCompany(source) || "-"
											}}</span>
											<el-tag
												size="small"
												:type="
													source.is_exception_source ? 'info' : 'success'
												"
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
												>运单号：{{
													getSourceTrackingNo(source) || "-"
												}}</span
											>
										</div>
									</div>
								</div>
							</div>

							<div v-if="pkg.last_error_message" class="pkg-error">
								{{ pkg.last_error_code ? `[${pkg.last_error_code}] ` : ""
								}}{{ pkg.last_error_message }}
							</div>

							<div class="pkg-action-row">
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
								<el-button
									v-if="Number(pkg.phone_required) === 1"
									size="small"
									plain
									@click.stop="openPhoneDialog(pkg)"
								>
									{{ pkg.contact_phone ? "修改手机号" : "填写手机号" }}
								</el-button>
								<el-tooltip
									v-if="isNonQueryMode(pkg)"
									content="恢复后系统会重新走快递100自动识别和实时查询；如果命中了启用的例外规则，刷新后仍会回到需人工判断。"
									placement="top"
								>
									<el-button
										size="small"
										plain
										type="primary"
										@click.stop="markPackageMode(pkg, 'kuaidi100')"
									>
										恢复快递100查询
									</el-button>
								</el-tooltip>
								<el-tooltip
									v-if="pkg.query_mode !== 'manual_required'"
									content="不调用快递100。适合官方直送、其它、1688采购下单、供应商自送、专线送货等无法通过快递100判断的物流。"
									placement="top"
								>
									<el-button
										size="small"
										plain
										@click.stop="confirmMarkPackageMode(pkg, 'manual_required')"
									>
										改为不查快递100
									</el-button>
								</el-tooltip>
								<el-tooltip
									v-if="pkg.query_mode !== 'ignored'"
									content="不调用快递100，也不参与整单物流状态判断。仅用于脏数据、重复单号、无效物流。"
									placement="top"
								>
									<el-button
										size="small"
										plain
										type="warning"
										@click.stop="confirmMarkPackageMode(pkg, 'ignored')"
									>
										忽略
									</el-button>
								</el-tooltip>
							</div>

							<el-timeline
								v-if="pkg.trace_info_json && pkg.trace_info_json.length > 0"
								class="pkg-timeline"
							>
								<el-timeline-item
									v-for="(trace, tIndex) in pkg.trace_info_json"
									:key="tIndex"
									:timestamp="trace.accept_time"
									:type="tIndex === 0 ? 'primary' : 'info'"
									:hollow="tIndex !== 0"
									:size="tIndex === 0 ? 'large' : 'normal'"
								>
									<div :class="['trace-remark', tIndex === 0 ? 'is-latest' : '']">
										{{ trace.remark }}
									</div>
								</el-timeline-item>
							</el-timeline>
							<el-empty v-else description="暂无轨迹信息" :image-size="50" />
						</div>
					</div>

					<!-- 底部调试入口（小字链接） -->
					<div class="logistics-debug-link">
						<el-button
							type="info"
							link
							size="small"
							@click="logisticsDrawer.rawDialogVisible = true"
						>
							查看原始调试数据 &gt;
						</el-button>
					</div>
				</div>
				<el-empty v-else description="暂无任何包裹物流信息" />
			</div>
		</el-drawer>

		<!-- 物流原始数据二级弹窗 -->
		<el-dialog
			v-model="logisticsDrawer.rawDialogVisible"
			title="原始调试数据"
			width="700px"
			append-to-body
		>
			<pre class="raw-json-block">{{ JSON.stringify(logisticsDrawer.data, null, 2) }}</pre>
		</el-dialog>

		<el-dialog
			v-model="phoneDialog.visible"
			title="填写物流手机号"
			width="420px"
			append-to-body
		>
			<el-form label-width="90px">
				<el-form-item label="运单号">
					<span class="readonly-text">{{ phoneDialog.package?.tracking_no || "-" }}</span>
				</el-form-item>
				<el-form-item label="手机号">
					<el-input
						v-model="phoneDialog.contactPhone"
						placeholder="请输入收/寄件人手机号或校验号码"
						clearable
					/>
				</el-form-item>
				<el-form-item>
					<el-checkbox v-model="phoneDialog.applyToOrder"
						>应用到当前采购单所有需手机号包裹</el-checkbox
					>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="phoneDialog.visible = false">取消</el-button>
				<el-button type="primary" :loading="phoneDialog.saving" @click="savePackagePhone">
					保存
				</el-button>
			</template>
		</el-dialog>

		<!-- 采购明细抽屉 -->
		<el-drawer v-model="detailDrawer.visible" title="采购明细" size="600px">
			<div class="detail-drawer-content">
				<div v-if="detailDrawer.order" class="order-info-section">
					<div class="info-header">订单信息</div>
					<div class="info-grid">
						<div class="info-item">
							<span class="label">采购单号:</span>
							<span class="value">{{ detailDrawer.order.order_sn }}</span>
						</div>
						<div class="info-item">
							<span class="label">供应商:</span>
							<span class="value">{{ detailDrawer.order.supplier_name }}</span>
						</div>
						<div class="info-item">
							<span class="label">订单总额:</span>
							<span class="value amount"
								>{{ detailDrawer.order.icon
								}}{{ detailDrawer.order.total_price }}</span
							>
						</div>
						<div class="info-item">
							<span class="label">采购状态:</span>
							<el-tag
								:type="getStatusType(detailDrawer.order.status)"
								size="small"
								effect="dark"
							>
								{{ detailDrawer.order.status_text }}
							</el-tag>
						</div>
					</div>
				</div>

				<div class="products-section">
					<div class="section-header">
						<span class="title">商品明细</span>
						<el-tag type="info" size="small"
							>共 {{ detailDrawer.products.length }} 个商品</el-tag
						>
					</div>
					<div v-if="detailDrawer.products.length" class="product-list">
						<div
							v-for="(product, index) in detailDrawer.products"
							:key="index"
							class="product-card"
						>
							<div class="product-main">
								<div class="product-image">
									<el-image
										v-if="product.plan_pic_url"
										:src="product.plan_pic_url"
										fit="contain"
									/>
									<div v-else class="no-image">暂无图片</div>
								</div>
								<div class="product-info">
									<div class="product-name">
										{{ product.product_name || product.sku }}
									</div>
									<div class="product-sku">SKU: {{ product.sku }}</div>
									<!-- 采购计划编号 -->
									<div class="product-plan" v-if="product.plan_sn">
										<el-icon><document /></el-icon>
										<span class="label">采购计划:</span>
										<el-link
											type="primary"
											@click="showAnalysisDetail(product)"
											:underline="true"
										>
											{{ product.plan_sn }}
										</el-link>
										<el-button
											v-if="product.analysis_record_id"
											type="primary"
											size="small"
											link
											style="margin-left: 6px"
											@click="showAnalysisDetail(product)"
										>
											<el-icon style="margin-right: 2px"
												><data-analysis /></el-icon
											>查看算法
										</el-button>
									</div>
									<div class="product-spec" v-if="product.attribute?.length">
										规格:
										{{
											product.attribute
												.map((a: any) => a.attr_value)
												.join(", ")
										}}
									</div>
								</div>
							</div>
							<div class="product-stats">
								<div class="stat-item">
									<span class="label">采购单价:</span>
									<span class="value">{{ product.price || "-" }}</span>
								</div>
								<div class="stat-item">
									<span class="label">采购数量:</span>
									<span class="value highlight">{{
										product.quantity_real || product.quantity_plan || 0
									}}</span>
								</div>
								<div class="stat-item">
									<span class="label">小计:</span>
									<span class="value amount">{{ product.amount || 0 }}</span>
								</div>
							</div>
						</div>
					</div>
					<el-empty v-else description="暂无商品明细" />
				</div>
			</div>
		</el-drawer>

		<!-- 算法详情弹窗 -->
		<el-dialog
			v-model="analysisDialog.visible"
			title="算法推荐详情"
			width="640px"
			:close-on-click-modal="false"
		>
			<div v-if="analysisDialog.loading" class="analysis-loading">
				<el-icon class="is-loading"><loading /></el-icon>
				<span>加载中...</span>
			</div>
			<div v-else-if="analysisDialog.data" class="analysis-content">
				<div class="algo-header">
					系统补货建议 (基于{{
						analysisDialog.data.remark?.user_selected_algo_name || "系数算法"
					}}):
				</div>

				<!-- 公式卡片 -->
				<div class="formula-card">
					<div class="formula-body">
						<div class="formula-item">
							<div class="formula-label">系统预计成交</div>
							<div class="formula-value primary">
								{{ analysisDialog.data.remark?.system_suggested_qty || "-" }}
							</div>
						</div>
						<div class="formula-op">×</div>
						<div class="formula-item">
							<div class="formula-label">人工系数</div>
							<div class="formula-value warning">
								{{ analysisDialog.data.remark?.artificial_coefficient || 1.0 }}
							</div>
						</div>
						<div class="formula-op">=</div>
						<div class="formula-item highlight">
							<div class="formula-label">最终补货单量</div>
							<div class="formula-value success">
								{{ analysisDialog.data.remark?.final_replenishment_qty || "-" }}
							</div>
						</div>
					</div>
				</div>

				<!-- 汇总信息 -->
				<div v-if="analysisDialog.data.remark?.summary" class="summary-box">
					{{ analysisDialog.data.remark.summary }}
				</div>

				<!-- 分段明细表 -->
				<div v-if="analysisDialog.data.remark?.breakdown?.length" class="breakdown-section">
					<div class="section-title">分段计算明细</div>
					<el-table
						:data="analysisDialog.data.remark.breakdown"
						size="small"
						border
						style="width: 100%"
					>
						<el-table-column prop="startDate" label="开始日期" min-width="90" />
						<el-table-column prop="endDate" label="结束日期" min-width="90" />
						<el-table-column prop="days" label="天数" min-width="50" align="center" />
						<el-table-column
							prop="coefficient"
							label="系数"
							min-width="50"
							align="center"
						/>
						<el-table-column label="日均" min-width="50" align="center">
							<template #default="{ row }">
								{{ row.dailyNeed ?? row.suggestedDaily ?? "-" }}
							</template>
						</el-table-column>
						<el-table-column prop="algo_used_name" label="算法" min-width="70" />
						<el-table-column label="建议量" min-width="60" align="center">
							<template #default="{ row }">
								<span class="highlight-value">
									{{
										row.subtotal ??
										(row.days && row.dailyNeed
											? Math.ceil(row.days * row.dailyNeed)
											: "-")
									}}
								</span>
							</template>
						</el-table-column>
					</el-table>
				</div>

				<!-- 人工备注 -->
				<div v-if="analysisDialog.data.manual_remark" class="remark-box">
					<div class="section-title">人工备注</div>
					<div class="remark-content">{{ analysisDialog.data.manual_remark }}</div>
				</div>
			</div>
			<div v-else class="analysis-empty">
				<el-empty description="暂无分析数据" :image-size="60" />
			</div>
		</el-dialog>

		<el-dialog
			v-model="remarkPreviewDialog.visible"
			title="采购计划备注自动补全预览"
			width="1180px"
			:close-on-click-modal="false"
			class="remark-preview-dialog"
			append-to-body
		>
			<div class="remark-preview-layout">
				<section class="remark-preview-input">
					<div class="preview-section-title">
						<span>输入来源</span>
						<el-tag size="small" type="info" effect="plain">只读预览</el-tag>
					</div>
					<el-radio-group
						v-model="remarkPreviewDialog.mode"
						class="preview-mode"
						@change="handleRemarkPreviewModeChange"
					>
						<el-radio-button value="order">选择采购单</el-radio-button>
						<el-radio-button value="remark">粘贴备注文本</el-radio-button>
					</el-radio-group>

					<template v-if="remarkPreviewDialog.mode === 'order'">
						<div class="plan-search-toolbar">
							<el-input
								v-model="remarkPreviewDialog.orderKeyword"
								placeholder="搜索采购单号 / 计划号 / SKU / MSKU / 供应商"
								clearable
								@keyup.enter="searchRemarkPreviewOrders(true)"
							/>
							<el-button
								type="primary"
								:loading="remarkPreviewDialog.orderLoading"
								@click="searchRemarkPreviewOrders(true)"
							>
								搜索
							</el-button>
						</div>
						<div class="plan-filter-line">
							<el-checkbox
								v-model="remarkPreviewDialog.hasAutoBlockOnly"
								@change="searchRemarkPreviewOrders(true)"
							>
								只看有关联自动补全备注的采购单
							</el-checkbox>
							<span>逐层选择采购单、明细和计划，只读校验，不写库。</span>
						</div>
						<div v-loading="remarkPreviewDialog.orderLoading" class="remark-order-list">
							<el-empty
								v-if="!remarkPreviewDialog.orderRows.length"
								description="暂无可选采购单，可放宽筛选或粘贴备注文本"
								:image-size="56"
							/>
							<div
								v-for="order in remarkPreviewDialog.orderRows"
								:key="order.order_sn"
								class="remark-order-option"
								:class="{
									'is-selected': remarkPreviewDialog.order_sn === order.order_sn
								}"
								@click="selectRemarkPreviewOrder(order)"
							>
								<div>
									<strong>{{ order.order_sn }}</strong>
									<span>{{ order.status_text || "-" }}</span>
									<small
										>{{ order.supplier_name || "未知供应商" }} ·
										{{ order.ware_house_name || "未填写仓库" }}</small
									>
								</div>
								<div class="order-option-counts">
									<span>{{ order.order_item_count }} 明细</span>
									<span>{{ order.auto_plan_count }} 自动配置</span>
								</div>
							</div>
						</div>
						<div
							v-if="
								remarkPreviewDialog.orderTotal > remarkPreviewDialog.orderPageSize
							"
							class="plan-list-pager"
						>
							<el-pagination
								v-model:current-page="remarkPreviewDialog.orderPage"
								:page-size="remarkPreviewDialog.orderPageSize"
								:total="remarkPreviewDialog.orderTotal"
								layout="prev, pager, next"
								small
								@current-change="searchRemarkPreviewOrders(false)"
							/>
						</div>

						<div
							v-loading="remarkPreviewDialog.orderContextLoading"
							class="remark-order-context"
						>
							<div
								v-if="remarkPreviewDialog.selectedOrder"
								class="selected-plan-strip"
							>
								<div>
									<span>当前采购单</span>
									<strong>{{
										remarkPreviewDialog.selectedOrder.order_sn
									}}</strong>
									<small
										>共
										{{
											remarkPreviewDialog.orderContext?.items?.length || 0
										}}
										条明细</small
									>
								</div>
								<el-tag size="small" effect="plain">选择具体计划</el-tag>
							</div>
							<div
								v-for="item in remarkPreviewDialog.orderContext?.items || []"
								:key="item.id"
								class="remark-plan-option"
								:class="{
									'is-selected':
										remarkPreviewDialog.order_item_id === Number(item.id)
								}"
								@click="selectRemarkPreviewPlan(item)"
							>
								<div class="plan-option-main">
									<div class="plan-option-info">
										<div
											class="plan-option-title"
											:title="item.product_name || item.sku"
										>
											{{ item.product_name || item.sku || "未命名采购明细" }}
										</div>
										<div class="plan-option-meta">
											<span>明细 {{ item.id }}</span>
											<span
												>计划
												{{
													item.purchase_plan?.plan_sn ||
													item.plan_sn ||
													"-"
												}}</span
											>
											<span
												>数量
												{{
													item.quantity_plan || item.quantity_real || 0
												}}</span
											>
										</div>
										<div
											class="plan-remark-snippet"
											:title="item.purchase_plan?.plan_remark"
										>
											{{
												item.purchase_plan?.plan_remark_snippet ||
												"采购计划无自动补全备注"
											}}
										</div>
									</div>
								</div>
								<el-tag
									size="small"
									:type="
										item.purchase_plan?.auto_block_valid
											? 'success'
											: item.purchase_plan?.auto_block_matched
												? 'warning'
												: 'info'
									"
									effect="plain"
								>
									{{
										item.purchase_plan?.auto_block_valid
											? "可预览"
											: item.purchase_plan?.auto_block_matched
												? "配置有误"
												: "无配置"
									}}
								</el-tag>
							</div>
						</div>

						<div v-if="remarkPreviewDialog.selectedPlan" class="remark-override-panel">
							<div class="remark-override-head">
								<div class="remark-override-title">
									<strong>临时备注覆盖</strong>
									<small
										>只用于本次预览，不修改采购计划备注，也不会写入数据库。</small
									>
								</div>
								<div class="remark-override-toggle">
									<el-tag
										size="small"
										:type="
											remarkPreviewDialog.overrideRemarkEnabled
												? 'warning'
												: 'info'
										"
										effect="plain"
									>
										{{
											remarkPreviewDialog.overrideRemarkEnabled
												? "已启用"
												: "保持关闭"
										}}
									</el-tag>
									<el-switch
										v-model="remarkPreviewDialog.overrideRemarkEnabled"
										@change="handleRemarkOverrideToggle"
									/>
								</div>
							</div>
							<div
								v-if="remarkPreviewDialog.overrideRemarkEnabled"
								class="remark-override-body"
							>
								<el-input
									v-model="remarkPreviewDialog.overrideRemark"
									type="textarea"
									:rows="4"
									placeholder="粘贴或编辑【自动补全V1】配置块；运输配置可不写，不写按默认配置完整预览。"
								/>
								<div class="preview-help preview-help--compact">
									运输配置可不写，系统按默认配置处理；需要英国/德国运输天数时再填写运输配置。
								</div>
								<div class="preview-actions preview-actions--override">
									<div class="preview-actions-toolbar">
										<el-button
											size="small"
											text
											type="primary"
											@click="fillRemarkPreviewOverrideSample"
										>
											按当前明细生成示例
										</el-button>
										<el-button
											size="small"
											text
											@click="useSelectedPlanRemarkAsOverride"
										>
											带入当前计划备注
										</el-button>
										<el-button
											size="small"
											text
											@click="remarkPreviewDialog.overrideRemark = ''"
											>清空</el-button
										>
									</div>
									<el-button
										size="small"
										type="primary"
										class="preview-actions-primary"
										:loading="remarkPreviewDialog.loading"
										@click="runRemarkPreview"
									>
										用临时备注预览
									</el-button>
								</div>
							</div>
						</div>
					</template>
					<template v-else>
						<el-input
							v-model="remarkPreviewDialog.remark"
							type="textarea"
							:rows="10"
							placeholder="粘贴包含【自动补全V1】...【/自动补全V1】的备注文本"
						/>
						<div class="preview-actions preview-actions--remark">
							<div class="preview-actions-toolbar">
								<el-button
									size="small"
									text
									type="primary"
									@click="fillRemarkPreviewSample"
									>填入示例</el-button
								>
								<el-button
									size="small"
									text
									@click="remarkPreviewDialog.remark = ''"
									>清空</el-button
								>
							</div>
						</div>
						<div class="preview-help">
							粘贴模式只校验备注语法；运输配置可不写，默认按“默认配置”校验；没有采购计划上下文时不会构造可写入草稿。
						</div>
					</template>
				</section>

				<section class="remark-preview-output">
					<div class="preview-section-title">
						<span>解析结果</span>
						<el-tag
							v-if="remarkPreviewDialog.result"
							size="small"
							:type="
								remarkPreviewDialog.result.validation?.readiness?.status === 'ready'
									? 'success'
									: remarkPreviewDialog.result.validation?.readiness?.status ===
										  'ready_with_warnings'
										? 'warning'
										: 'danger'
							"
							effect="plain"
						>
							{{
								remarkPreviewDialog.result.validation?.readiness?.text ||
								(remarkPreviewDialog.result.parsed?.valid ? "语法通过" : "解析失败")
							}}
						</el-tag>
					</div>

					<el-empty
						v-if="!remarkPreviewDialog.result"
						:description="remarkPreviewEmptyText"
						:image-size="72"
					/>
					<div v-else class="preview-result-body">
						<el-alert
							v-if="remarkPreviewErrors.length"
							type="error"
							:closable="false"
							show-icon
							class="preview-error-alert"
						>
							<div v-for="err in remarkPreviewErrors" :key="err">{{ err }}</div>
						</el-alert>
						<el-alert
							v-if="remarkPreviewWarnings.length"
							type="warning"
							:closable="false"
							show-icon
							class="preview-error-alert"
						>
							<div v-for="warning in remarkPreviewWarnings" :key="warning">
								{{ warning }}
							</div>
						</el-alert>
						<el-alert
							v-if="!remarkPreviewHasMatchedBlock"
							type="warning"
							:closable="false"
							show-icon
							title="未识别到【自动补全V1】配置块"
							description="系统只解析标记块中的内容。普通备注会保留给运营查看，但不会触发自动补全。"
						/>

						<div v-if="remarkPreviewHasMatchedBlock" class="preview-summary-grid">
							<div
								v-for="item in remarkPreviewConfigRows"
								:key="item.label"
								class="preview-summary-card"
							>
								<span>{{ item.label }}</span>
								<strong>{{ item.value || "-" }}</strong>
							</div>
						</div>

						<template v-if="remarkPreviewHasMatchedBlock">
							<div class="preview-subtitle">发货分配</div>
							<el-table
								:data="remarkPreviewAllocations"
								size="small"
								border
								class="preview-allocation-table"
							>
								<el-table-column prop="method_label" label="运输方式" width="110" />
								<el-table-column prop="arrival_date" label="预计到达" width="110" />
								<el-table-column prop="period" label="覆盖周期" min-width="190" />
								<el-table-column
									prop="system_suggested_qty"
									label="系统建议"
									width="90"
									align="right"
								/>
								<el-table-column
									prop="qty"
									label="运营填写"
									width="90"
									align="right"
								/>
							</el-table>
						</template>

						<div class="preview-hash">
							<span>内容指纹</span>
							<code>{{
								remarkPreviewDialog.result.summary?.remark_hash || "-"
							}}</code>
						</div>
						<div v-if="remarkPreviewDialog.result.context_hash" class="preview-hash">
							<span>业务上下文指纹</span>
							<code>{{ remarkPreviewDialog.result.context_hash }}</code>
						</div>

						<el-collapse class="preview-json-collapse">
							<el-collapse-item :title="remarkPreviewJsonTitle" name="draft">
								<pre class="raw-json-block">{{
									JSON.stringify(
										remarkPreviewDialog.result.draft ||
											remarkPreviewDialog.result,
										null,
										2
									)
								}}</pre>
							</el-collapse-item>
						</el-collapse>
					</div>
				</section>
			</div>

			<template #footer>
				<el-button @click="remarkPreviewDialog.visible = false">关闭</el-button>
				<el-button
					type="primary"
					:loading="remarkPreviewDialog.loading"
					@click="runRemarkPreview"
				>
					解析预览
				</el-button>
			</template>
		</el-dialog>
		<!-- ========== 标记异常弹窗 (Enterprise Standard) ========== -->
		<el-dialog
			v-model="exceptionDialog.visible"
			title="标记异常明细"
			width="820px"
			:close-on-click-modal="false"
			destroy-on-close
			class="enterprise-dialog"
		>
			<div v-loading="exceptionDialog.loading" class="exception-dialog-body">
				<!-- 实时同步全局设置面板 -->
				<div class="global-setting-panel">
					<div class="panel-header">
						<span class="title">批量异常设置</span>
						<span class="subtitle">（填写后将实时同步至下方勾选单据）</span>
					</div>
					<div class="panel-body">
						<el-select
							v-model="exceptionDialog.globalType"
							placeholder="选择异常类型"
							class="global-input type-select"
							clearable
						>
							<el-option label="数据错误" value="数据错误" />
							<el-option label="价格异常" value="价格异常" />
							<el-option label="库存异常" value="库存异常" />
							<el-option label="物流异常" value="物流异常" />
							<el-option label="其他" value="其他" />
						</el-select>
						<el-input
							v-model="exceptionDialog.globalReason"
							placeholder="请输入批量异常原因概括"
							class="global-input reason-input"
							clearable
						/>
					</div>
				</div>

				<!-- 产品精编列表 -->
				<div class="product-list-container">
					<div
						v-for="(group, orderSn) in exceptionGrouped"
						:key="orderSn"
						class="order-group-wrapper"
					>
						<!-- 采购单分组 Header -->
						<div class="order-group-header">
							<div class="order-id">
								<span class="label">采购单号</span>
								<span class="value">{{ orderSn }}</span>
							</div>
							<div class="order-meta">
								<span>{{ group[0]?.supplier_name || "未知供应商" }}</span>
								<span class="dot">·</span>
								<span>{{ group[0]?.ware_house_name || "默认仓" }}</span>
							</div>
						</div>

						<!-- 产品 Item 行 -->
						<div class="order-group-items">
							<div
								v-for="(item, idx) in group"
								:key="idx"
								class="product-item-row"
								:class="{ 'is-checked': item.checked }"
							>
								<div class="row-checkbox">
									<el-checkbox v-model="item.checked" />
								</div>

								<div class="row-content">
									<!-- 上半部分：产品详情 -->
									<div class="product-info-block">
										<div class="product-cover">
											<el-image
												v-if="item.plan_pic_url"
												:src="item.plan_pic_url"
												:preview-src-list="[item.plan_pic_url]"
												preview-teleported
												fit="cover"
												class="img"
											/>
											<div v-else class="img-placeholder">
												<el-icon><Picture /></el-icon>
											</div>
										</div>

										<div class="product-details">
											<div class="name" :title="item.product_name">
												{{ item.product_name || "未命名产品" }}
											</div>
											<div class="identifiers">
												<span class="id-item"
													>SKU: {{ item.sku || "-" }}</span
												>
												<span class="divider"></span>
												<span class="id-item"
													>MSKU: {{ item.first_msku || "-" }}</span
												>
												<span class="divider"></span>
												<span class="id-item"
													>ASIN: {{ item.asin || "-" }}</span
												>
											</div>
										</div>

										<div class="financial-block">
											<div class="fin-stat">
												<span class="fin-label">单价</span>
												<span class="fin-value price"
													>¥{{ item.price || 0 }}</span
												>
											</div>
											<div class="fin-stat">
												<span class="fin-label">数量</span>
												<span class="fin-value qty">{{
													item.quantity_plan || 0
												}}</span>
											</div>
										</div>

										<div class="refs-block">
											<div class="ref-item" v-if="item.order_sn">
												<span class="label">采购单:</span>
												{{ item.order_sn }}
											</div>
											<div class="ref-item" v-if="item.plan_sn">
												<span class="label">采购计划:</span>
												{{ item.plan_sn }}
											</div>
										</div>
									</div>

									<!-- 下半部分：操作输入栏 -->
									<div class="action-input-block" v-if="item.checked">
										<div class="input-inner-wrap">
											<el-select
												v-model="item.exceptionType"
												placeholder="手动指定类型"
												size="small"
												class="row-select"
											>
												<el-option label="数据错误" value="数据错误" />
												<el-option label="价格异常" value="价格异常" />
												<el-option label="库存异常" value="库存异常" />
												<el-option label="物流异常" value="物流异常" />
												<el-option label="其他" value="其他" />
											</el-select>
											<el-input
												v-model="item.reason"
												placeholder="填入当前明细原因（将覆盖批量原因）"
												size="small"
												class="row-input"
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<template #footer>
				<div class="dialog-footer-custom">
					<div class="selection-stats">
						已勾选
						<span class="highlight-count">{{
							exceptionDialog.items.filter((i) => i.checked).length
						}}</span>
						/ {{ exceptionDialog.items.length }} <span>项</span>
					</div>
					<div class="actions">
						<el-button @click="exceptionDialog.visible = false" class="btn-cancel"
							>取消</el-button
						>
						<el-button
							type="primary"
							class="btn-submit"
							:loading="exceptionDialog.submitting"
							@click="submitException"
							:disabled="exceptionDialog.items.filter((i) => i.checked).length === 0"
						>
							提交异常记录
						</el-button>
					</div>
				</div>
			</template>
		</el-dialog>
	</cl-crud>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted } from "vue";
import dayjs from "dayjs";
import { logisticsStatusGroups } from "/@/modules/app/utils/logistics-status-options";

const formatSyncTime = (time: string | Date | undefined) => {
	if (!time) return "未知时间";
	return dayjs(time).format("YYYY-MM-DD HH:mm:ss");
};

const formatDateTime = (time: string | Date | undefined | null) => {
	if (!time) return "-";
	const value = dayjs(time);
	return value.isValid() ? value.format("YYYY-MM-DD HH:mm:ss") : "-";
};

// ========== 实际发货数据读取工具函数 ==========
// 产品视图用：从 shipmentMetrics.byPlan 里提取某个 plan_sn 下所有 item 的 actual 数据汇总
const getActualDataForPlan = (planSn: string) => {
	const planData = shipmentMetrics.value.byPlan[planSn];
	if (!planData || !planData.items || planData.items.length === 0) return null;

	let totalActualQty = 0;
	const totalPlanQty = planData.totalQty || 0;
	const details: any[] = [];
	// 取第一个 item 的产品信息
	const firstItem = planData.items[0];
	const productInfo = {
		small_image_url: firstItem?.small_image_url,
		product_name: firstItem?.product_name,
		sku: firstItem?.sku,
		msku: firstItem?.msku
	};

	for (const item of planData.items) {
		if (item.actual && item.actual.totalActualQty > 0) {
			totalActualQty += item.actual.totalActualQty;
			details.push(...item.actual.details);
		}
	}

	if (details.length === 0) return null;
	return { totalActualQty, totalPlanQty, details, productInfo };
};

// 单据视图用：从 shipmentMetrics.byOrder 里提取某个 order_sn 下所有批次的 actual 数据汇总
const getActualDataForOrder = (orderSn: string) => {
	const orderData = shipmentMetrics.value.byOrder[orderSn];
	if (!orderData || !orderData.batches) return null;

	let totalActualQty = 0;
	const totalPlanQty = orderData.totalQty || 0;
	const details: any[] = [];
	let productInfo: any = {};

	for (const seqKey of Object.keys(orderData.batches)) {
		const batch = orderData.batches[seqKey];
		if (!productInfo.product_name && batch.items.length > 0) {
			const firstItem = batch.items[0];
			productInfo = {
				small_image_url: firstItem?.small_image_url,
				product_name: firstItem?.product_name,
				sku: firstItem?.sku,
				msku: firstItem?.msku
			};
		}

		for (const item of batch.items) {
			if (item.actual && item.actual.totalActualQty > 0) {
				totalActualQty += item.actual.totalActualQty;
				details.push(...item.actual.details);
			}
		}
	}

	if (details.length === 0) return null;
	return { totalActualQty, totalPlanQty, details, productInfo };
};

import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox, ElLoading } from "element-plus";
import {
	CopyDocument,
	Refresh,
	Loading,
	SuccessFilled,
	Document,
	List,
	Goods,
	Picture,
	DataAnalysis,
	CaretBottom,
	CaretTop,
	Box,
	Warning,
	Search,
	ArrowDown
} from "@element-plus/icons-vue";
import { useCrud } from "@cool-vue/crud";
import ListingTrendChart from "/@/modules/app/components/ListingTrendChart.vue";
import LogisticsSourcePopover from "/@/modules/app/components/LogisticsSourcePopover.vue";
import VisualDatePicker from "/@/modules/app/components/VisualDatePicker.vue";
import { useUserStore } from "/$/base/store/user";
import {
	buildLogisticsQuerySummary,
	buildPackageSnapshot,
	formatLogisticsQuerySummaryMessage,
	getQueryBlockReasonText
} from "/@/modules/app/utils/logistics-query-summary";
const { service } = useCool();
const userStore = useUserStore();

// ========== 标记异常功能 ==========
const exceptionDialog = reactive({
	visible: false,
	loading: false,
	submitting: false,
	items: [] as Array<{
		checked: boolean;
		exceptionType: string;
		reason: string;
		order_sn: string;
		sid: any;
		store_name: string;
		supplier_name: string;
		ware_house_name: string;
		order_status_text: string;
		product_name: string;
		sku: string;
		first_msku: string;
		asin: string;
		plan_sn: string;
		price: number;
		quantity_plan: number;
		plan_pic_url: string;
	}>,
	globalType: "",
	globalReason: ""
});

// 按 order_sn 分组的计算属性
const exceptionGrouped = computed(() => {
	const groups: Record<string, typeof exceptionDialog.items> = {};
	for (const item of exceptionDialog.items) {
		const key = item.order_sn || "未知";
		if (!groups[key]) groups[key] = [];
		groups[key].push(item);
	}
	return groups;
});

// 打开异常标记弹窗
const openExceptionDialog = async (items: any[]) => {
	if (!items || items.length === 0) {
		ElMessage.warning("请先选择要标记的产品或订单");
		return;
	}

	exceptionDialog.globalType = "";
	exceptionDialog.globalReason = "";
	exceptionDialog.items = [];
	exceptionDialog.visible = true;
	exceptionDialog.loading = true;

	let productsToMark: any[] = [];

	try {
		if (viewMode.value === "order") {
			// 单据视图：选中项是订单，需要根据 order_sn 去请求底下的所有产品明细
			const promises = items.map((order) =>
				(service.app as any).bsr_purchase_order_sync_lingxing
					.itemsPage({
						order_sn: order.order_sn,
						page: 1,
						size: 100
					})
					.then((res: any) => {
						const subItems = res.list || [];
						return subItems.map((sub: any) => ({ ...sub, _parentOrder: order }));
					})
			);
			const results = await Promise.all(promises);
			productsToMark = results.flat();
		} else {
			// 产品视图 / 其他视图：直接就是产品级别的明细
			productsToMark = [...items];
		}

		if (productsToMark.length === 0) {
			ElMessage.warning("选中的范围内没有有效的商品明细");
			exceptionDialog.visible = false;
			return;
		}

		// 组装弹窗数据
		exceptionDialog.items = productsToMark.map((item) => ({
			checked: true,
			exceptionType: "",
			reason: "",
			order_sn: item._parentOrder?.order_sn || item.parent?.order_sn || item.order_sn || "-",
			sid:
				item.listing?.store_id ||
				item.sid ||
				item.store_id ||
				item._parentOrder?.sid ||
				item._parentOrder?.store_id ||
				null,
			store_name:
				item.listing?.shop ||
				item.listing?.store_name ||
				item.shop ||
				item.store_name ||
				item._parentOrder?.shop ||
				item._parentOrder?.store_name ||
				"",
			supplier_name: item._parentOrder?.supplier_name || item.parent?.supplier_name || "",
			ware_house_name: item.ware_house_name || item._parentOrder?.ware_house_name || "",
			order_status_text:
				item.status_text ||
				item._parentOrder?.status_text ||
				item.parent?.status_text ||
				"",
			product_name: item.product_name || "",
			sku: item.sku || "",
			first_msku: item.first_msku || "",
			asin: item.listing?.asin || item.analysisRecord?.asin || "",
			plan_sn: item.plan_sn || "",
			price: item.price || 0,
			quantity_plan: item.quantity_plan || 0,
			plan_pic_url: item.plan_pic_url || item.listing?.image_url || ""
		}));
	} catch (error) {
		console.error("拉取产品明细失败:", error);
		ElMessage.error("拉取产品明细失败，请重试");
		exceptionDialog.visible = false;
	} finally {
		exceptionDialog.loading = false;
	}
};

import { watch } from "vue";

// 监听统一设置，实时同步到下方所有选中的产品
watch(
	() => [exceptionDialog.globalType, exceptionDialog.globalReason],
	([newType, newReason]) => {
		for (const item of exceptionDialog.items) {
			if (item.checked) {
				if (newType !== undefined) item.exceptionType = newType as string;
				if (newReason !== undefined) item.reason = newReason as string;
			}
		}
	}
);

// 提交异常记录
const submitException = async () => {
	const checkedItems = exceptionDialog.items.filter((i) => i.checked);
	if (checkedItems.length === 0) {
		ElMessage.warning("请至少勾选一个产品");
		return;
	}

	// 校验必填字段
	const incomplete = checkedItems.filter((i) => !i.exceptionType || !i.reason);
	if (incomplete.length > 0) {
		ElMessage.warning(`有 ${incomplete.length} 个产品未填写异常类型或原因，请补充完整`);
		return;
	}

	exceptionDialog.submitting = true;
	try {
		const params = {
			submit_nickname: userStore.info?.nickName || userStore.info?.username || "",
			items: checkedItems.map((item) => ({
				exception_type: item.exceptionType,
				reason: item.reason,
				sid: item.sid,
				store_name: item.store_name,
				order_sn: item.order_sn,
				supplier_name: item.supplier_name,
				ware_house_name: item.ware_house_name,
				order_status_text: item.order_status_text,
				product_name: item.product_name,
				sku: item.sku,
				msku: item.first_msku,
				asin: item.asin,
				plan_sn: item.plan_sn,
				price: item.price,
				quantity_plan: item.quantity_plan,
				plan_pic_url: item.plan_pic_url
			}))
		};

		const result = await (service.app as any).bsr_exception_tracking.submit(params);
		ElMessage.success(`已成功提交 ${result.count} 条异常记录`);
		exceptionDialog.visible = false;
	} catch (error: any) {
		console.error("提交异常失败:", error);
		ElMessage.error(error.message || "提交异常失败，请重试");
	} finally {
		exceptionDialog.submitting = false;
	}
};

// ========== 发货计划真实数据装载 (独立挂件模式) ==========
const shipmentMetrics = ref<{ byOrder: Record<string, any>; byPlan: Record<string, any> }>({
	byOrder: {},
	byPlan: {}
});

// 在数据更新时，静默拉取发货计划数据
const fetchShipmentMetrics = (list: any[]) => {
	// 提取出当前表格所有的采购单号 (单据视图自带 order_sn，产品视图通常可以通过 parent.order_sn 拿到)
	const orderSnsFilter = list
		.map((item) => item.order_sn || item.parent?.order_sn)
		.filter(Boolean);
	const orderSns = [...new Set(orderSnsFilter)];

	if (!orderSns.length) {
		shipmentMetrics.value = { byOrder: {}, byPlan: {} };
		return;
	}

	// 异步调用新建的 metrics 接口，带有完整错误隔离
	service.app.bsr_shipment_plan_lingxing
		.getBatchShipmentMetrics({ orderSns })
		.then((res: any) => {
			shipmentMetrics.value = res || { byOrder: {}, byPlan: {} };
		})
		.catch((err: any) => {
			console.warn("发货计划附属数据加载失败，表格主体不受影响", err);
		});
};

// ========== 悬浮展示采购计划明细相关 ==========
const hoverPlanDetails = ref<Record<string, any>>({});
const hoverLoading = ref(false);
const hoverIsDegraded = ref(false);
let hoverTimeout: any = null;

const handlePlanHover = async (planSns: string[]) => {
	if (!planSns || planSns.length === 0) return;

	// 检查本地是否已有全部所需数据
	const missing = planSns.filter((sn) => !hoverPlanDetails.value[sn]);
	if (missing.length === 0) {
		// 都已缓存，无需重查，重置降级状态为这批缓存的混合结果
		hoverIsDegraded.value = planSns.some((sn) => hoverPlanDetails.value[sn]?._is_degraded);
		return;
	}

	hoverLoading.value = true;
	hoverIsDegraded.value = false;
	try {
		const res = await (service.app.bsr_purchase_plan_lingxing as any).hoverDetails({
			plan_sns: missing
		});
		if (res.list && Array.isArray(res.list)) {
			res.list.forEach((item: any) => {
				hoverPlanDetails.value[item.plan_sn] = {
					...item,
					_is_degraded: !!res.is_degraded
				};
			});
		}
		// 根据本次需要显示的所有计划计算最终是否需要降级警告
		hoverIsDegraded.value = planSns.some((sn) => hoverPlanDetails.value[sn]?._is_degraded);
	} catch (e) {
		console.error("悬浮获取计划明细失败", e);
		hoverIsDegraded.value = true; // 出错也算降级

		// 若接口彻底崩溃没返回任何list，为了避免死循环请求，给missing制造一个假缓存
		missing.forEach((sn) => {
			if (!hoverPlanDetails.value[sn]) {
				hoverPlanDetails.value[sn] = {
					plan_sn: sn,
					_is_degraded: true,
					_is_failed: true
				};
			}
		});
	} finally {
		hoverLoading.value = false;
	}
};

const onMouseEnterPlan = (planSns: string[]) => {
	if (!planSns || planSns.length === 0) return;
	if (hoverTimeout) clearTimeout(hoverTimeout);
	hoverTimeout = setTimeout(() => {
		handlePlanHover(planSns);
	}, 300); // 300ms 防抖
};

const onMouseLeavePlan = () => {
	if (hoverTimeout) clearTimeout(hoverTimeout);
};

// 产品视图独立排序状态
const currentSort = ref({ prop: "", order: "" });

// 视图模式: order/product/unmatched/no_link/all
const viewMode = ref<"order" | "product" | "unmatched" | "no_link" | "all">("order");

function onSort(prop: string) {
	if (currentSort.value.prop === prop) {
		currentSort.value.order = currentSort.value.order === "desc" ? "asc" : "desc";
	} else {
		currentSort.value.prop = prop;
		currentSort.value.order = "desc";
	}
	Crud.value?.refresh({
		prop: currentSort.value.prop,
		order: currentSort.value.order,
		page: 1
	});
}

// 店铺选项列表
const shopList = ref<string[]>([]);

onMounted(() => {
	// 加载店铺选项
	service.app.bsr_purchase_order_sync_lingxing
		.getShopList()
		.then((res: any) => {
			shopList.value = res || [];
		})
		.catch((err: any) => {
			console.error("获取店铺列表失败", err);
		});

	Crud.value?.refresh();
});

// 声明 Crud
const Crud = useCrud({
	service: service.app.bsr_purchase_order_sync_lingxing,
	onRefresh: (params, { render }) => {
		loading.value = true;
		// 如果是产品视图、未匹配视图或暂无链接视图，调用 getProductViewPage
		if (
			viewMode.value === "product" ||
			viewMode.value === "unmatched" ||
			viewMode.value === "no_link" ||
			viewMode.value === "all"
		) {
			let isNoLinkVal = 0;
			if (viewMode.value === "no_link") isNoLinkVal = 1;
			if (viewMode.value === "unmatched") isNoLinkVal = 2;
			// viewMode === "all" 时不传 is_no_link 或传空，由后端全量返回

			const callParams: any = {
				...params,
				...filters,
				prop: currentSort.value.prop,
				order: currentSort.value.order
			};
			if (viewMode.value !== "all") {
				callParams.is_no_link = isNoLinkVal;
			}

			service.app.bsr_purchase_order_sync_lingxing
				.productViewPage(callParams)
				.then((res: any) => {
					// 数据扁平化处理，方便模板绑定
					const list = (res.list || []).map((item: any) => {
						const listing = item.listing || {};
						const restocking = item.restocking || {};
						const suggest = restocking.suggestInfo || {};
						const stock = restocking.stockQuantityInfo || {};
						const scm = restocking.scmQuantityInfo || {};
						const ext = restocking.extInfo || {};
						const amazon = restocking.amazonQuantityInfo || {};

						return {
							...listing, // 扁平化 listing 字段 (作为底座)
							...item, // 展开 item 字段 (覆盖重名字段，确保 id, price, remark 不被 listing 污染)
							listing_id: listing.id, // 保留 listing 的真实 ID
							remark_listing: listing.remark, // 映射 listing 专属备注
							msku:
								listing.msku ||
								(item.analysis && item.analysis.msku) ||
								item.first_msku ||
								"", // 避免被 item.msku(JSON数组字符串) 污染
							restocking, // 保留 restocking 对象

							// 映射模板所需的平铺字段
							image_url_display: listing.image_url,
							listing_price: listing.listing_price,
							referral_fee: listing.referral_fee,

							// 映射 restocking 平铺字段
							restocking_stock_total: stock.stockTotal,
							restocking_reserved_customerorders: amazon.reservedCustomerorders,
							restocking_purchase_plan: scm.scQuantityPurchasePlan || 0,
							restocking_estimated_sale_quantity: suggest.estimatedSaleQuantity,
							restocking_out_stock_date: suggest.outStockDate,
							restocking_fba_aged: "-", // 暂无直接对应字符串，留空或后续处理
							restocking_local_aged: restocking.localAgedInfo,
							restocking_oversea_valid: scm.scQuantityOverseaValid,
							restocking_sug_date_purchase: suggest.sugDatePurchase,
							restocking_sug_date_send_local: suggest.sugDateSendLocal,
							restocking_ext_remark: ext.remark,
							restocking_local_valid:
								ext.localValidDetailList?.reduce(
									(sum, i) => sum + (Number(i?.quantityValid) || 0),
									0
								) ?? 0,

							// 确保数组存在
							rank: listing.rank || [],
							small_rank: listing.small_rank || []
						};
					});
					tableData.value = list; // <--- 关键修复：更新表格数据
					render(list, res.pagination);
					fetchShipmentMetrics(list); // 独立加载发货计划数据
				})
				.catch((err: any) => {
					ElMessage.error(err.message);
					tableData.value = [];
					render([], { page: 1, size: 20, total: 0 });
				})
				.finally(() => {
					loading.value = false;
				});
		} else {
			// 否则调用默认的 page 接口（单据视图）
			service.app.bsr_purchase_order_sync_lingxing
				.customPage({ ...params, ...filters })
				.then((res: any) => {
					tableData.value = res.list; // <--- 关键修复：更新表格数据
					render(res.list, res.pagination);
					fetchShipmentMetrics(res.list); // 独立加载发货计划数据
				})
				.catch((err: any) => {
					ElMessage.error(err.message);
					tableData.value = [];
				})
				.finally(() => {
					loading.value = false;
				});
		}
	}
});

// 视图模式: 'order' | 'product' | 'no_link'

// 表格相关
const tableRef = ref();
const loading = ref(false);
const syncing = ref(false);
const syncResult = ref<any>(null);
const tableData = ref<any[]>([]);
const selectedRows = ref<any[]>([]);

const AUTO_REPLENISH_REMARK_SAMPLE =
	"【自动补全V1】\n算法=运营意向；计划开始=2026-06-04；缓冲天数=5；采购仓库=深圳花烛；发货分配=快递:2,空快:6,空慢:6,卡车:11,铁路:35,海运:9；人工备注=不写运输配置时按默认配置\n【/自动补全V1】";

const remarkPreviewDialog = reactive({
	visible: false,
	mode: "order" as "order" | "remark",
	order_sn: "",
	orderKeyword: "",
	orderLoading: false,
	orderRows: [] as any[],
	orderTotal: 0,
	orderPage: 1,
	orderPageSize: 5,
	selectedOrder: null as any,
	orderContextLoading: false,
	orderContext: null as any,
	order_item_id: 0,
	selectedOrderItem: null as any,
	plan_sn: "",
	hasAutoBlockOnly: true,
	selectedPlan: null as any,
	overrideRemarkEnabled: false,
	overrideRemark: "",
	remark: "",
	loading: false,
	result: null as any
});

const remarkPreviewErrors = computed(() => {
	const result = remarkPreviewDialog.result;
	if (!result) return [];
	return [
		...new Set([...(result.errors || []), ...(result.parsed?.errors || [])].filter(Boolean))
	];
});

const remarkPreviewWarnings = computed(() => {
	return [...new Set((remarkPreviewDialog.result?.warnings || []).filter(Boolean))];
});

const remarkPreviewAllocations = computed(() => {
	const segments = remarkPreviewDialog.result?.draft?.shipping_segments;
	if (Array.isArray(segments) && segments.length) {
		return segments.map((item: any) => ({
			method_label: item.method_label,
			method_key: item.method_key,
			qty: item.final_qty,
			system_suggested_qty: item.system_suggested_qty,
			arrival_date: item.start_date,
			period: `${item.start_date || "-"} ~ ${item.end_date || "-"}`
		}));
	}
	return remarkPreviewDialog.result?.summary?.shipping_allocations || [];
});

const remarkPreviewHasMatchedBlock = computed(() => {
	return !!remarkPreviewDialog.result?.parsed?.matched;
});

const remarkPreviewEmptyText = computed(() => {
	return remarkPreviewDialog.mode === "order"
		? "请选择采购单中的具体采购计划，系统会读取真实上下文做只读预览"
		: "粘贴备注文本后点击预览";
});

const remarkPreviewJsonTitle = computed(() => {
	if (remarkPreviewDialog.mode === "remark" && !remarkPreviewDialog.result?.draft) {
		return "解析 JSON（只读，不写库）";
	}
	return "草稿 JSON（只读，不写库）";
});

const remarkPreviewConfigRows = computed(() => {
	const summary = remarkPreviewDialog.result?.summary || {};
	const context = remarkPreviewDialog.result?.context || {};
	const validation = remarkPreviewDialog.result?.validation || {};
	if (!summary.matched) return [];
	return [
		{ label: "算法", value: summary.algorithm_label },
		{
			label: "计划开始",
			value: validation.shipping?.plan_start?.value
				? `${validation.shipping.plan_start.value} / ${validation.shipping.plan_start.source_label}`
				: summary.plan_start_date || "缺少可用时间"
		},
		{
			label: "缓冲天数",
			value:
				validation.shipping?.buffer_days !== undefined
					? `${validation.shipping.buffer_days} / ${validation.shipping.buffer_source}`
					: (summary.shipping_buffer_days ?? "未填写，默认 5")
		},
		{
			label: "采购仓库",
			value: validation.warehouse?.matched
				? `${validation.warehouse.warehouse_name} / 已匹配`
				: validation.warehouse?.requested_name
					? `${validation.warehouse.requested_name} / 未匹配`
					: summary.warehouse_name || "未填写"
		},
		{ label: "运输配置", value: summary.shipping_profile_label },
		{
			label: "采购数量 / 分配",
			value: validation.quantity?.purchase_qty
				? `${validation.quantity.purchase_qty} / ${validation.quantity.allocation_total}`
				: summary.allocation_total
		},
		{ label: "人工备注", value: summary.manual_remark },
		{ label: "关联明细", value: context.order_item_count ?? "-" },
		{ label: "匹配商品", value: context.matched_listing?.asin || "-" },
		{ label: "最终判断", value: validation.readiness?.text || "仅语法校验" }
	];
});

const getAutoCompleteSummary = (result: any) => {
	const summary = result?.auto_complete || result?.autoComplete || {};
	return {
		created: Number(summary.created) || 0,
		updated: Number(summary.updated) || 0,
		skipped: Number(summary.skipped) || 0,
		warningCount: Number(summary.warning_count ?? summary.warningCount) || 0,
		failed: Number(summary.failed) || 0
	};
};

// 筛选条件
const filters = reactive({
	status: [2, 9] as number[], // 默认勾选待到货+已完成
	status_shipped: null as number | null,
	pay_status: null as number | null,
	shopName: "" as string,
	dateRange: [] as string[],
	startDate: null as string | null,
	endDate: null as string | null,
	logistics_status: "" as string,
	overtime_days: 7 as number,
	searchType: "order_sn" as string,
	keyWord: "" as string
});

// 异常预警快捷筛选
const alertFilter = ref<string>("");

// 搜索框 placeholder 根据类型动态变化
const searchPlaceholder = computed(() => {
	switch (filters.searchType) {
		case "order_sn":
			return "请输入采购单号，如 PO260209005";
		case "plan_sn":
			return "请输入采购计划号，如 PP260209011";
		case "asin":
			return "请输入 ASIN，如 B0XXXXXX";
		default:
			return "请输入搜索内容";
	}
});

// ========== 运输方式配置 ==========
const shippingMethods = reactive([
	{ key: "express", label: "快递", days: 5, color: "#FF6B9D", icon: "🚚" },
	{ key: "air", label: "空运", days: 7, color: "#409EFF", icon: "✈️" },
	{ key: "truck", label: "卡车", days: 30, color: "#67C23A", icon: "🚛" },
	{ key: "rail", label: "铁路", days: 35, color: "#E6A23C", icon: "🚂" },
	{ key: "sea", label: "海运", days: 60, color: "#F56C6C", icon: "🚢" }
]);
const shippingBuffer = ref(5);
const selectedShippingMethod = ref<string>("air");

// ========== 发货计划确认弹窗 ==========
// 从后端获取的数据已保存在 warehouseList 中
const packageTypeOptions = [
	{ value: 1, label: "混装商品" },
	{ value: 2, label: "原厂包装商品" }
];

// 发货计划弹窗 - 禁用今天之前的日期
const disabledDate = (time: Date) => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return time.getTime() < today.getTime();
};

// 发货计划弹窗状态
const shipPlanDialog = reactive({
	visible: false,
	records: [] as any[]
});

// 发货计划最终确认弹窗状态
const finalConfirmDialog = reactive({
	visible: false
});

// 提交结果状态
interface SubmitResult {
	methodKey: string;
	success: boolean;
	seq?: string;
	order_sn?: string[];
	error?: string;
	retrying?: boolean;
}
const submitResults = ref<SubmitResult[] | null>(null);
const isSubmittingPlan = ref(false);
const shipPlanActiveCollapse = ref("");

// 批量设置的状态记录
const batchValues = ref<Record<string, any>>({});

// 打开发货计划弹窗（从暂存记录生成）
const openShipPlan = () => {
	if (totalTempSaves.value === 0) {
		ElMessage.warning("请先暂存至少一条发货记录");
		return;
	}
	// 初始化 batchValues
	const newBatchValues: Record<string, any> = {};
	const methods = shippingMethods.map((m) => m.key);
	for (const m of methods) {
		newBatchValues[m] = {
			warehouse: "",
			packageType: "",
			planShipDate: "",
			batchRemark: ""
		};
	}
	batchValues.value = newBatchValues;

	// 把所有暂存记录展开，加上必填字段
	const allRecords: any[] = [];
	for (const [itemKey, records] of Object.entries(tempSaveRecords)) {
		for (const r of records) {
			allRecords.push({
				...r,
				_itemKey: itemKey,
				warehouse: "",
				packageType: "",
				planShipDate: ""
			});
		}
	}
	shipPlanDialog.records = allRecords;

	// 触发加载真实仓库数据（已做缓存）
	checkAndFetchWarehouseList();

	// 默认展开第一个分组
	const firstKey = Object.keys(groupedPlanRecords.value)[0] || "";
	shipPlanActiveCollapse.value = firstKey;
	shipPlanDialog.visible = true;
};

// 按运输方式分组
const groupedPlanRecords = computed(() => {
	const groups: Record<string, { method: any; records: any[] }> = {};
	for (const record of shipPlanDialog.records) {
		const key = record.shippingMethod || "unknown";
		if (!groups[key]) {
			const methodInfo = shippingMethods.find((m) => m.key === key);
			groups[key] = {
				method: methodInfo || { key, label: key, color: "#909399", icon: "📦" },
				records: []
			};
		}
		groups[key].records.push(record);
	}
	return groups;
});

// 检查是否需要拉取仓库数据
const checkAndFetchWarehouseList = async () => {
	// 如果已经有缓存，则不再发请求
	if (
		warehouseList.value.local.length > 0 ||
		warehouseList.value.overseas.length > 0 ||
		warehouseList.value.awd.length > 0
	) {
		return;
	}
	try {
		const res = await service.app.bsr_purchase_order_sync_lingxing.getWarehouseList();
		warehouseList.value = res || { local: [], overseas: [], awd: [] };
	} catch (err) {
		console.error("获取真实发货仓库列表失败", err);
	}
};

// 下一步：校验必填项并弹出最终确认弹窗
const handleNextStep = () => {
	const records = shipPlanDialog.records;
	for (let i = 0; i < records.length; i++) {
		const r = records[i];
		if (!r.warehouse || !r.packageType || !r.planShipDate) {
			const productName = r.productName || r.asin;
			ElMessage.error(`产品 "${productName}" 的发货配置（仓库/包装/时间）未填写完整`);
			return;
		}
	}
	// 校验通过，检查重复 MSKU
	// 【第二层防重】提交前扫描每个运输方式组是否有重复 MSKU
	const grouped = groupedPlanRecords.value;
	for (const [methodKey, group] of Object.entries(grouped) as [string, any][]) {
		const mskuMap = new Map<string, number>();
		for (const r of group.records) {
			const msku = r.msku || "";
			if (msku) {
				mskuMap.set(msku, (mskuMap.get(msku) || 0) + 1);
			}
		}
		const duplicates = [...mskuMap.entries()].filter(([, count]) => count > 1);
		if (duplicates.length > 0) {
			const methodInfo = shippingMethods.find((m) => m.key === methodKey);
			const methodLabel = methodInfo ? `${methodInfo.icon} ${methodInfo.label}` : methodKey;
			const dupList = duplicates.map(([msku, count]) => `${msku}(${count}条)`).join("、");
			ElMessage.error(
				`[${methodLabel}] 组中存在重复商品：${dupList}，同一运输方式下同一商品只能提交一次，请删除多余记录`
			);
			return;
		}
	}
	submitResults.value = null;
	finalConfirmDialog.visible = true;
};

// 确认提交发货（真实对接领星 API）
const submitShippingPlan = async () => {
	isSubmittingPlan.value = true;
	submitResults.value = null;

	try {
		// 按运输方式分组组装数据
		const groups = Object.entries(groupedPlanRecords.value).map(
			([methodKey, group]: [string, any]) => ({
				methodKey,
				remark: batchValues.value[methodKey]?.batchRemark || "",
				product_list: group.records.map((record: any) => ({
					sid: record.sid || 0,
					packing_type: record.packageType || 1,
					shipment_time: record.planShipDate || "",
					msku: record.msku || "",
					fnsku: record.fnsku || "",
					shipment_plan_quantity: record.shipQty || 0,
					wid: record.warehouse || 0,
					remark: record.remark || "",
					purchase_plan_sn: record.planSn || "",
					purchase_order_sn: record.orderSn || ""
				}))
			})
		);

		console.log("[submitShippingPlan] 提交数据:", JSON.stringify(groups, null, 2));

		const res = await (service.app as any).bsr_purchase_order_sync_lingxing.createShipmentPlan({
			groups
		});

		submitResults.value = res;

		const successCount = res.filter((r: any) => r.success).length;
		const failCount = res.filter((r: any) => !r.success).length;

		if (failCount === 0) {
			ElMessage.success(`全部提交成功！共 ${successCount} 个批次`);
		} else if (successCount > 0) {
			ElMessage.warning(`部分提交成功：${successCount} 成功，${failCount} 失败`);
		} else {
			ElMessage.error("全部提交失败，请查看详情并重试");
		}
	} catch (error: any) {
		console.error("提交发货计划失败:", error);
		ElMessage.error("提交失败，请重试");
	} finally {
		isSubmittingPlan.value = false;
	}
};

// α 应用按钮：写入状态 + 触发重算（尊重单行自定义日期/算法）
const onAlphaApply = () => {
	batchShipDialog.globalAlpha = batchShipDialog.globalAlphaInput;
	batchShipDialog.alphaPopoverVisible = false;
	reCalcAllItemsAfterAlphaChange();
};

// α 重置按钮：清空状态 + 触发重算
const onAlphaReset = () => {
	batchShipDialog.globalAlpha = undefined;
	batchShipDialog.globalAlphaInput = 0.7;
	batchShipDialog.alphaPopoverVisible = false;
	reCalcAllItemsAfterAlphaChange();
};

// α 变更后重算所有行（区分全局行和有自定义日期/算法的行，避免冲掉单行设置）
const reCalcAllItemsAfterAlphaChange = () => {
	if (!batchShipDialog.items.length) return;
	const customItems: any[] = [];
	const globalItems: any[] = [];
	batchShipDialog.items.forEach((row) => {
		// 判断日期是否自定义
		const hasCustomDate =
			row.dateRange &&
			row.dateRange.length === 2 &&
			row.dateRange[0] &&
			row.dateRange[1] &&
			batchShipDialog.globalDateRange &&
			(row.dateRange[0] !== batchShipDialog.globalDateRange[0] ||
				row.dateRange[1] !== batchShipDialog.globalDateRange[1]);
		// 判断算法是否自定义
		const hasCustomAlgo = row.algo && row.algo !== batchShipDialog.globalAlgo;
		if (hasCustomDate || hasCustomAlgo) {
			customItems.push(row);
		} else {
			globalItems.push(row);
		}
	});
	// 全局行（日期和算法都和全局一致）：一次批量请求
	if (globalItems.length > 0 && batchShipDialog.globalDateRange) {
		doBatchCalculate(globalItems);
	}
	// 自定义行：逐条用行自己的日期和算法重算
	customItems.forEach((row) => {
		doBatchCalculate([row], row.dateRange || batchShipDialog.globalDateRange);
	});
};

// 重试单个失败的分组
const retryGroup = async (methodKey: string) => {
	if (!submitResults.value) return;

	const resultItem = submitResults.value.find((r) => r.methodKey === methodKey);
	if (!resultItem || resultItem.success) return;

	resultItem.retrying = true;

	try {
		const group = groupedPlanRecords.value[methodKey];
		if (!group) return;

		const payload = {
			groups: [
				{
					methodKey,
					remark: batchValues.value[methodKey]?.batchRemark || "",
					product_list: group.records.map((record: any) => ({
						sid: record.sid || 0,
						packing_type: record.packageType || 1,
						shipment_time: record.planShipDate || "",
						msku: record.msku || "",
						fnsku: record.fnsku || "",
						shipment_plan_quantity: record.shipQty || 0,
						wid: record.warehouse || 0,
						remark: record.remark || "",
						purchase_plan_sn: record.planSn || ""
					}))
				}
			]
		};

		const res = await (service.app as any).bsr_purchase_order_sync_lingxing.createShipmentPlan(
			payload
		);

		if (res && res.length > 0) {
			const idx = submitResults.value.findIndex((r) => r.methodKey === methodKey);
			if (idx >= 0) {
				submitResults.value[idx] = { ...res[0], retrying: false };
			}
			if (res[0].success) {
				ElMessage.success(`${methodKey} 重试成功！`);
			} else {
				ElMessage.error(`${methodKey} 重试失败: ${res[0].error}`);
			}
		}
	} catch (error: any) {
		ElMessage.error(`重试失败: ${error?.message || "未知错误"}`);
	} finally {
		resultItem.retrying = false;
	}
};

// 关闭弹窗（只清空成功组的暂存数据）
const closeAfterSubmit = () => {
	finalConfirmDialog.visible = false;
	shipPlanDialog.visible = false;
	tempSaveDrawerVisible.value = false;
	submitResults.value = null;

	// 清空暂存记录
	Object.keys(tempSaveRecords).forEach((key) => {
		delete tempSaveRecords[key];
	});
};

// 返回修改（从结果页回到确认页）
const resetSubmitResults = () => {
	submitResults.value = null;
};

// 批量设置某组的某个字段
const batchSetPlanField = (methodKey: string, field: string, value: any) => {
	const group = groupedPlanRecords.value[methodKey];
	if (!group) return;
	for (const r of group.records) {
		r[field] = value;
	}
};

// 运输方式切换回调（从 VisualDatePicker 内部触发）
const onShippingChange = (payload: {
	method: string;
	methods: any[];
	buffer: number;
	dateRange: string[];
}) => {
	selectedShippingMethod.value = payload.method;

	// 同步日期和天数
	batchShipDialog.globalDateRange = payload.dateRange;
	const start = new Date(payload.dateRange[0]);
	const end = new Date(payload.dateRange[1]);
	batchShipDialog.globalDays = Math.ceil(
		(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
	);

	// 找到运输方式的完整信息
	const methodInfo = shippingMethods.find((m) => m.key === payload.method);

	// 如果已有产品数据，同步日期+运输方式并推演
	if (batchShipDialog.items.length > 0) {
		batchShipDialog.items.forEach((row) => {
			row.dateRange = [...payload.dateRange];
			row.shippingMethod = payload.method;
			row.shippingLabel = methodInfo?.label || "";
			row.shippingIcon = methodInfo?.icon || "";
			row.shippingColor = methodInfo?.color || "";
		});
		doBatchCalculate(batchShipDialog.items);
	}
};

// ========== 暂存功能 ==========
interface TempSaveRecord {
	id: string;
	asin: string;
	sku: string;
	msku: string;
	fnsku: string;
	sid: number;
	orderSn: string;
	planSn: string;
	productName: string;
	productImg: string;
	shippingMethod: string;
	shippingLabel: string;
	shippingIcon: string;
	shippingColor: string;
	dateRange: string[];
	days: number;
	algo: string;
	algoLabel: string;
	dailySales: number;
	totalDemand: number;
	gap: number;
	shipQty: number;
	unitPrice: number;
	purchaseQty: number;
	timestamp: number;
}

const tempSaveRecords = reactive<Record<string, TempSaveRecord[]>>({});
// 获取实际仓库数据的接口响应结构定义
interface Warehouse {
	wid: number;
	name: string;
}

interface WarehouseGroups {
	local: Warehouse[];
	overseas: Warehouse[];
	awd: Warehouse[];
}

// 缓存服务端请求回来的真实仓库列表
const warehouseList = ref<WarehouseGroups>({
	local: [],
	overseas: [],
	awd: []
});

const tempSaveDrawerVisible = ref(false);
const tempSaveDrawerFilterKey = ref<string | null>(null);

// 打开暂存抽屉（可指定筛选某个产品）
const openTempDrawer = (itemKey?: string) => {
	tempSaveDrawerFilterKey.value = itemKey || null;
	tempSaveDrawerVisible.value = true;
};

// 筛选后的暂存记录
const filteredTempSaveRecords = computed(() => {
	if (!tempSaveDrawerFilterKey.value) return tempSaveRecords;
	const key = tempSaveDrawerFilterKey.value;
	if (tempSaveRecords[key]) {
		return { [key]: tempSaveRecords[key] } as Record<string, TempSaveRecord[]>;
	}
	return {} as Record<string, TempSaveRecord[]>;
});

// 获取明细唯一标识
const getItemKey = (item: any): string => {
	return `${item.order_sn}_${item.asin || item.listing?.asin || ""}_${item.sku || item.listing?.sku || ""}`;
};

// 算法标签映射
const algoLabelMap: Record<string, string> = {
	daily_avg: "日均单量",
	history: "历史销量",
	trend: "搜索词趋势",
	combined: "综合走势",
	operator_intent: "运营意向"
};

// 单条明细切换运输方式
const onItemShippingChange = (item: any, methodKey: string) => {
	const method = shippingMethods.find((m) => m.key === methodKey);
	if (!method) return;

	item.shippingMethod = methodKey;
	item.shippingLabel = method.label;
	item.shippingIcon = method.icon;
	item.shippingColor = method.color;

	// 使用统一计算逻辑
	const range = calcShippingDateRange(methodKey);
	if (range) {
		item.dateRange = [range.start, range.end];
		// 提醒用户日期已变化
		ElMessage.info(
			`${method.icon} ${method.label}：日期已更新为 ${range.start} ~ ${range.end}`
		);
		// 触发高亮动画
		item._dateHighlight = true;
		setTimeout(() => {
			item._dateHighlight = false;
		}, 1500);
	}

	// 重新推演该条
	doBatchCalculate([item], item.dateRange);
};

// 暂存一条明细
const saveTempRecord = (item: any) => {
	if (!item.shipQty || item.shipQty <= 0) {
		ElMessage.warning("该产品发货数量为0，无需暂存");
		return;
	}
	if (!item.shippingMethod) {
		ElMessage.warning("请先选择运输方式");
		return;
	}
	if (!item.dateRange || item.dateRange.length < 2) {
		ElMessage.warning("请先选择销售周期");
		return;
	}
	// 【第一层防重】同运输方式 + 同 MSKU 不能暂存两次
	const currentMsku = item.listing?.msku || "";
	if (currentMsku) {
		const allRecords = Object.values(tempSaveRecords).flat();
		const duplicate = allRecords.find(
			(r) => r.shippingMethod === item.shippingMethod && r.msku === currentMsku
		);
		if (duplicate) {
			const methodInfo = shippingMethods.find((m) => m.key === item.shippingMethod);
			const methodLabel = methodInfo
				? `${methodInfo.icon} ${methodInfo.label}`
				: item.shippingMethod;
			ElMessage.warning(
				`该产品 (${currentMsku}) 在 [${methodLabel}] 运输方式下已暂存过，请先删除旧记录或修改数量`
			);
			return;
		}
	}
	const key = getItemKey(item);
	if (!tempSaveRecords[key]) {
		tempSaveRecords[key] = [];
	}
	const record: TempSaveRecord = {
		id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
		asin: item.asin || item.listing?.asin || "",
		sku: item.sku || item.listing?.sku || "",
		msku: item.listing?.msku || item?.analysisRecord?.msku || item.first_msku || "",
		fnsku: item.listing?.fnsku || item.fnsku || "",
		sid: item.listing?.store_id || item.sid || 0,
		orderSn: item.order_sn || "",
		planSn: item.plan_sn || "",
		productName:
			item.product_name || item.plan_product_name || item.listing?.listing_name || "",
		productImg: item.product_img || "",
		shippingMethod: item.shippingMethod || "",
		shippingLabel: item.shippingLabel || "",
		shippingIcon: item.shippingIcon || "",
		shippingColor: item.shippingColor || "",
		dateRange: item.dateRange ? [...item.dateRange] : [],
		days: item.days || 0,
		algo: item.algo || "daily_avg",
		algoLabel: algoLabelMap[item.algo] || "日均单量",
		dailySales: item.dailySales || 0,
		totalDemand: item.totalDemand || 0,
		gap: item.gap || 0,
		shipQty: item.shipQty || 0,
		unitPrice: item.unitPrice || item.listing_price || item.price || item.purchasePrice || 0,
		purchaseQty: item.purchaseQty || 0,
		timestamp: Date.now()
	};
	tempSaveRecords[key].push(record);
	console.log("[暂存数据验证]", {
		msku: record.msku,
		fnsku: record.fnsku,
		sid: record.sid,
		planSn: record.planSn,
		orderSn: record.orderSn
	});
	ElMessage.success(`已暂存 (共${tempSaveRecords[key].length}条)`);
};

// 删除暂存记录
const deleteTempRecord = (itemKey: string, recordId: string) => {
	if (tempSaveRecords[itemKey]) {
		const idx = tempSaveRecords[itemKey].findIndex((r) => r.id === recordId);
		if (idx >= 0) {
			tempSaveRecords[itemKey].splice(idx, 1);
			if (tempSaveRecords[itemKey].length === 0) {
				delete tempSaveRecords[itemKey];
			}
		}
	}
};

// 暂存总数
const totalTempSaves = computed(() => {
	return Object.values(tempSaveRecords).reduce((sum, arr) => sum + arr.length, 0);
});

// 获取某条明细的暂存数量
const getItemSaveCount = (item: any): number => {
	const key = getItemKey(item);
	return tempSaveRecords[key]?.length || 0;
};

// 获取暂存摘要（tooltip 显示）
const getItemSaveSummary = (item: any): string => {
	const key = getItemKey(item);
	const records = tempSaveRecords[key];
	if (!records || records.length === 0) {
		return "点击暂存当前配置";
	}
	const totalQty = records.reduce((s, r) => s + (r.shipQty || 0), 0);
	const lines = records.map(
		(r, i) =>
			`${r.shippingIcon || "📦"} ${r.dateRange?.[0] || "?"} ~ ${r.dateRange?.[1] || "?"} • 发货 ${r.shipQty}`
	);
	return (
		`<div style="font-size:12px;line-height:1.8">` +
		`<div style="font-weight:600;margin-bottom:4px">已暂存 ${records.length} 条，共 ${totalQty} 件</div>` +
		lines.join("<br>") +
		`<div style="color:#909399;margin-top:4px;font-size:11px">点击徽章查看详情</div>` +
		`</div>`
	);
};

// 关闭模态框前检查
const handleBatchDialogClose = (done?: () => void) => {
	const count = totalTempSaves.value;
	if (count > 0) {
		ElMessageBox.confirm(`当前有 ${count} 条暂存记录，关闭后将全部清空。确定关闭？`, "提示", {
			confirmButtonText: "确定关闭",
			cancelButtonText: "取消",
			type: "warning"
		})
			.then(() => {
				Object.keys(tempSaveRecords).forEach((k) => delete tempSaveRecords[k]);
				if (done) done();
				else batchShipDialog.visible = false;
				batchShipDialog.globalAlpha = undefined;
				batchShipDialog.globalAlphaInput = 0.7;
				batchShipDialog.alphaPopoverVisible = false;
			})
			.catch(() => {});
		return;
	}
	if (done) done();
	else batchShipDialog.visible = false;
	// Bug4: 关闭后重置 α 状态
	batchShipDialog.globalAlpha = undefined;
	batchShipDialog.globalAlphaInput = 0.7;
	batchShipDialog.alphaPopoverVisible = false;
};

// ========== 统一运输计算逻辑 ==========
// 计算运输标记（从某个运输方式开始到最后）
const calcShippingMarkers = (methodKey: string) => {
	const today = dayjs().startOf("day");
	const methodIndex = shippingMethods.findIndex((m) => m.key === methodKey);
	if (methodIndex < 0) return [];

	const markers: {
		key: string;
		label: string;
		arrivalDate: string;
		color: string;
		icon: string;
	}[] = [];
	for (let i = methodIndex; i < shippingMethods.length; i++) {
		const m = shippingMethods[i];
		const arrival = today.add(m.days + shippingBuffer.value, "day").format("YYYY-MM-DD");
		markers.push({
			key: m.key,
			label: m.label,
			arrivalDate: arrival,
			color: m.color,
			icon: m.icon
		});
	}
	return markers;
};

// 计算运输日期范围（开始和结束日期）
const calcShippingDateRange = (methodKey: string) => {
	const today = dayjs().startOf("day");
	const methodIndex = shippingMethods.findIndex((m) => m.key === methodKey);
	if (methodIndex < 0) return null;

	const method = shippingMethods[methodIndex];
	const startDate = today.add(method.days + shippingBuffer.value, "day");

	let endDate: dayjs.Dayjs;
	if (methodIndex < shippingMethods.length - 1) {
		const nextMethod = shippingMethods[methodIndex + 1];
		endDate = today.add(nextMethod.days + shippingBuffer.value, "day").subtract(1, "day");
	} else {
		endDate = startDate.add(30, "day");
	}

	return { start: startDate.format("YYYY-MM-DD"), end: endDate.format("YYYY-MM-DD") };
};

// 全局运输标记（传给全局 VisualDatePicker）
const shippingMarkers = computed(() => {
	if (!selectedShippingMethod.value) return [];
	return calcShippingMarkers(selectedShippingMethod.value);
});

// 单条明细的运输标记（传给明细 VisualDatePicker）
const getItemShippingMarkers = (item: any) => {
	if (!item.shippingMethod) return [];
	return calcShippingMarkers(item.shippingMethod);
};

// ========== 批量发货分析弹窗 ==========
const batchShipDialog = reactive({
	visible: false,
	items: [] as any[],
	globalDateRange: null as string[] | null,
	globalDays: 0,
	globalAlgo: "daily_avg" as string,
	globalAlpha: undefined as number | undefined, // 综合走势 α 权重
	globalAlphaInput: 0.7, // α 滑块绑定值
	alphaPopoverVisible: false // α Popover 可见性
});

// 映射前端算法到后端
const mapAlgoToInt = (algo: string) => {
	switch (algo) {
		case "daily_avg":
			return 1;
		case "history":
			return 2;
		case "trend":
			return 3;
		case "combined":
			return 4;
		default:
			return 1;
	}
};

// 批量推演缺口 (真实对接后端接口)
const doBatchCalculate = async (itemsToCalc: any[], overrideDateRange?: string[]) => {
	const range = overrideDateRange || batchShipDialog.globalDateRange;
	if (!range || range.length < 2) return;

	const loading = ElLoading.service({
		lock: true,
		text: "正在进行引擎推演...",
		background: "rgba(0, 0, 0, 0.7)"
	});

	try {
		const startDate = range[0];
		const endDate = range[1];
		const algorithm =
			itemsToCalc.length === 1
				? mapAlgoToInt(itemsToCalc[0].algo || batchShipDialog.globalAlgo)
				: mapAlgoToInt(batchShipDialog.globalAlgo);

		// 准备请求体，由于原始数据量可能很大，只抽取后端需要的字段
		const payloadItems = itemsToCalc.map((row, index) => {
			if (!row._batchId) row._batchId = `batch_${index}_${Date.now()}`;

			return {
				id: row._batchId,
				// 多路径兜底：listing → analysis → analysisRecord → 扁平字段
				product_code:
					row.listing?.product_code ||
					row.product_code ||
					row.analysisRecord?.product_code ||
					"",
				asin:
					row.listing?.asin ||
					row.analysis?.asin ||
					row.analysisRecord?.asin ||
					row.asin ||
					"",
				marketplace:
					row.listing?.marketplace ||
					row.analysis?.marketplace ||
					row.analysisRecord?.marketplace ||
					row.marketplace ||
					row.plan_marketplace ||
					"",
				dailyAvgSales:
					Number(
						row.dailyAvgSales || row.daily_avg_sales || row.listing?.dailyAvgSales
					) || 0,
				fbaValid:
					row.restocking?.fbaValidList?.reduce(
						(sum: number, i: any) => sum + (Number(i?.quantity) || 0),
						0
					) || 0,
				fbaShippingList: row.restocking?.fbaShippingList || [],
				listing_id: row.listing?.id || row.listing_id || null, // 不用 row.id，那是 orderItem id
				msku:
					row.listing?.msku ||
					row.msku ||
					row.analysisRecord?.msku ||
					row.first_msku ||
					"",
				store_id: row.listing?.store_id || row.store_id || row.sid || null
			};
		});

		const res = await (service.app as any).bsr_purchase_order_sync_lingxing.batchCalculateGap({
			algorithm,
			startDate,
			endDate,
			alpha: undefined, // 不传全局α，让后端走用户配置/系统决策
			items: payloadItems
		});

		// 将后端返回的结果映射成字典
		const resultMap = new Map<string, any>(res.map((r: any) => [String(r.id), r]));

		itemsToCalc.forEach((row) => {
			const calcData: any = resultMap.get(String(row._batchId));
			const start = new Date(startDate);
			const end = new Date(endDate);
			const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

			row.days = days;
			row.dateRange = [...range];

			if (calcData && !calcData.warning) {
				row.totalDemand = calcData.expectedDemand;
				// 需补货 = 周期总需求 - 当前FBA - 在途货件
				row._pureGap = calcData.gap;
				// 存逐月系数详情（供tooltip展示）
				row._monthlyCoefficients = calcData.monthlyCoefficients || null;
				// 重新计算时清除旧的α状态
				row._alphaMode = undefined;
				row._manualAlpha = undefined;
				row._manualAlphaInited = false;

				// 计算在途货件量（在选定日期范围内到库的）
				const shippingList = row.restocking?.fbaShippingList || [];
				let inTransitQty = 0;
				const inTransitList: any[] = [];
				if (Array.isArray(shippingList)) {
					for (const s of shippingList) {
						const arriveDate = s.amazonSaleDate;
						if (arriveDate && arriveDate >= startDate && arriveDate <= endDate) {
							const qty = Number(s.quantity) || 0;
							inTransitQty += qty;
							inTransitList.push({ ...s, quantity: qty });
						}
					}
				}
				row._inTransitQty = inTransitQty;
				row._inTransitList = inTransitList;

				// 本单后仍缺 = 需补货 - 本单采购数量
				const actualMissing = Math.max(0, calcData.gap - row.purchaseQty);
				row.gap = actualMissing;

				// 日均消耗 = 周期总需求 / 天数
				row.dailySales = days > 0 ? +(calcData.expectedDemand / days).toFixed(1) : 0;

				// 自动填写建议发货数 = 需补货量，但不超过本单可发货上限；无缺口则填0
				if (calcData.gap > 0) {
					const actualMax =
						row.maxShipQty !== undefined ? row.maxShipQty : row.purchaseQty;
					row.shipQty = Math.min(calcData.gap, actualMax);
				} else {
					row.shipQty = 0;
				}
			} else {
				row.totalDemand = 0;
				row.gap = 0;
				row._pureGap = 0;
				row.dailySales = 0;
				row.shipQty = 0;
				row._monthlyCoefficients = null;
				row._inTransitQty = 0;
				row._inTransitList = [];
				row._alphaMode = undefined;
				row._manualAlpha = undefined;
				row._manualAlphaInited = false;
				row.remark = calcData?.warning || "计算失败";
			}

			if (calcData?.gap > 0 && row.gap > 0) {
				row.remark = `仍缺 ${row.gap} 件，需追加发货`;
			} else if (calcData?.gap > 0) {
				row.remark = `需补 ${calcData.gap} 件，本单已覆盖`;
			} else if (calcData && !calcData.warning) {
				row.remark = `库存充足，可覆盖周期`;
			}
		});
	} catch (error) {
		console.error("批量推演失败:", error);
		ElMessage.error("推演失败，请重试");
	} finally {
		loading.close();
	}
};

// 可视化日历选择器的日期变更处理
const handleVisualDateChange = (item: any, dateRange: string[] | null) => {
	item.dateRange = dateRange;
	if (dateRange && dateRange.length === 2) {
		doBatchCalculate([item], dateRange);
	} else {
		// 清除日期时，重置计算结果
		item.days = 0;
		item.dailySales = 0;
		item.totalDemand = 0;
		item.gap = 0;
		item._pureGap = 0;
		item.shipQty = 0;
		item._monthlyCoefficients = null;
		item._inTransitQty = 0;
		item._inTransitList = [];
		item._alphaMode = undefined;
		item._manualAlpha = undefined;
		item._manualAlphaInited = false;
		item.remark = "请选择销售周期";
	}
};

// 需求明细：按月拆分，返回 [{month, days, coefficient, dailyNeed, subtotal, type}]
const getShipDemandBreakdown = (item: any) => {
	if (!item.dateRange || item.dateRange.length < 2) return [];
	const startD = dayjs(item.dateRange[0]);
	const endD = dayjs(item.dateRange[1]);
	const dailyAvg = Number(item.daily_avg_sales) || 0;
	const coefficients = item._monthlyCoefficients || {};
	const algo = item.algo || batchShipDialog.globalAlgo;

	const result: any[] = [];
	let segStart = startD;
	while (segStart.isBefore(endD) || segStart.isSame(endD, "day")) {
		const monthEnd = segStart.endOf("month").startOf("day");
		const segEnd = monthEnd.isBefore(endD) ? monthEnd : endD;
		const days = segEnd.diff(segStart, "day") + 1;
		const monthStr = segStart.format("YYYY-MM");

		let coefficient = 1;
		let type = "daily";
		const monthDetail = coefficients[monthStr];
		if (monthDetail && algo !== "daily_avg") {
			coefficient = monthDetail.coefficient ?? 1;
			if (algo === "history") type = "history";
			else if (algo === "trend") type = "trend";
			else if (algo === "combined") type = "combined";
		}

		const roundedCoeff = Math.round(coefficient * 1000) / 1000;
		const dailyNeed = Math.round(dailyAvg * roundedCoeff * 100) / 100;
		const subtotal = Math.round(days * dailyNeed);

		result.push({
			month: monthStr,
			days,
			coefficient: roundedCoeff,
			dailyAvg,
			dailyNeed,
			subtotal,
			type
		});
		segStart = segEnd.add(1, "day");
	}
	return result;
};

// α详情数据：用于tooltip展示逐月α详情、加权平均公式、系统/用户模式切换
const getShipAlphaTooltipData = (item: any) => {
	const coefficients = item._monthlyCoefficients;
	if (!coefficients || !item.dateRange || item.dateRange.length < 2) return null;

	const mode = (item._alphaMode || "system") as "system" | "user";
	const startD = dayjs(item.dateRange[0]);
	const endD = dayjs(item.dateRange[1]);

	const details: any[] = [];
	let totalWeightedAlpha = 0;
	let totalDays = 0;
	let hasUserAlpha = false;
	const uniqueRemarks: string[] = [];

	let segStart = startD;
	while (segStart.isBefore(endD) || segStart.isSame(endD, "day")) {
		const monthEnd = segStart.endOf("month").startOf("day");
		const segEnd = monthEnd.isBefore(endD) ? monthEnd : endD;
		const days = segEnd.diff(segStart, "day") + 1;
		const monthStr = segStart.format("YYYY-MM");
		const mc = coefficients[monthStr];

		const sysAlpha = mc?.system_alpha ?? 0.7;
		const userAlpha = mc?.user_alpha ?? null;
		const alpha = mode === "system" ? sysAlpha : (userAlpha ?? sysAlpha);
		const reasonText = mc?.alpha_reason_text || "";

		if (userAlpha !== null && userAlpha !== undefined) hasUserAlpha = true;
		if (mc?.user_remark && !uniqueRemarks.includes(mc.user_remark)) {
			uniqueRemarks.push(mc.user_remark);
		}

		details.push({
			month: monthStr,
			days,
			alpha,
			systemAlpha: sysAlpha,
			userAlpha,
			reasonText
		});
		totalWeightedAlpha += alpha * days;
		totalDays += days;
		segStart = segEnd.add(1, "day");
	}

	const weightedValue =
		totalDays > 0 ? Math.round((totalWeightedAlpha / totalDays) * 100) / 100 : 0.7;

	return {
		mode,
		modeLabel: mode === "system" ? "系统" : "用户",
		nextModeLabel: mode === "system" ? "用户" : "系统",
		details,
		value: weightedValue,
		formulaText: details.map((d) => d.days + "×" + d.alpha).join(" + "),
		totalDays,
		uniqueRemarks,
		hasUserAlpha
	};
};

// 切换系统/用户α模式
const onShipToggleAlphaMode = (item: any) => {
	const currentMode = item._alphaMode || "system";
	const newMode = currentMode === "system" ? "user" : "system";

	if (newMode === "user") {
		const td = getShipAlphaTooltipData(item);
		if (!td || !td.hasUserAlpha) {
			ElMessage.info("该产品暂无用户α配置，请先在α配置面板中设置");
			return;
		}
	}

	item._alphaMode = newMode;
	item._manualAlpha = undefined;

	// 用新α重算
	recalcShipWithCurrentAlpha(item);
};

// 人工α改变后重算
const onShipManualAlphaChange = (item: any, newAlpha: number | undefined) => {
	// 首次点击+/-时，el-input-number从0开始，需要纠正为当前加权平均值
	if (!item._manualAlphaInited && newAlpha !== null && newAlpha !== undefined) {
		item._manualAlphaInited = true;
		const td = getShipAlphaTooltipData(item);
		const baseAlpha = td?.value ?? 0.7;
		// 如果用户点了+号得到0.05，说明从0开始的，纠正为 baseAlpha + 0.05
		if (newAlpha <= 0.05) {
			const corrected = Math.min(1, Math.round((baseAlpha + newAlpha) * 100) / 100);
			item._manualAlpha = corrected;
			newAlpha = corrected;
		} else if (newAlpha >= 0.95 && newAlpha < 1) {
			// 点了-号从0变成-0.05再被min限制，也纠正
			const corrected = Math.max(0, Math.round((baseAlpha - (1 - newAlpha)) * 100) / 100);
			item._manualAlpha = corrected;
			newAlpha = corrected;
		}
	}
	item._manualAlpha = newAlpha;
	recalcShipWithCurrentAlpha(item);
};

// 用当前α模式/人工α重算该行
const recalcShipWithCurrentAlpha = (item: any) => {
	const coefficients = item._monthlyCoefficients;
	if (!coefficients || !item.dateRange || item.dateRange.length < 2) return;

	const startDate = item.dateRange[0];
	const endDate = item.dateRange[1];
	const dailyAvg = Number(item.daily_avg_sales) || 0;
	const mode = item._alphaMode || "system";
	const manualAlpha = item._manualAlpha;

	const startD = dayjs(startDate).startOf("day");
	const endD = dayjs(endDate).startOf("day");
	const fbaShippingList = item.restocking?.fbaShippingList || [];
	const fbaValid = (item.restocking?.fbaValidList || []).reduce(
		(sum: number, i: any) => sum + (Number(i?.quantity) || 0),
		0
	);

	// Step 1: 重算 expectedDemand（按月分段 + 三重round）
	let expectedDemand = 0;
	let segStart = startD;
	while (segStart.isBefore(endD) || segStart.isSame(endD, "day")) {
		const monthEnd = segStart.endOf("month").startOf("day");
		const segEnd = monthEnd.isBefore(endD) ? monthEnd : endD;
		const segDays = segEnd.diff(segStart, "day") + 1;
		const monthStr = segStart.format("YYYY-MM");
		const mc = coefficients[monthStr];

		let coefficient = 1;
		if (mc) {
			const sysAlpha = mc.system_alpha ?? 0.7;
			const userAlpha = mc.user_alpha ?? null;
			const alpha = manualAlpha ?? (mode === "system" ? sysAlpha : (userAlpha ?? sysAlpha));
			const salesCoeff = mc.filled_sales_coefficient ?? 0;
			const searchCoeff = mc.keyword_coefficient ?? 0;
			coefficient = alpha * salesCoeff + (1 - alpha) * searchCoeff;
		}

		const roundedCoeff = Math.round(coefficient * 100) / 100;
		const dailyNeed = Math.round(dailyAvg * roundedCoeff * 100) / 100;
		expectedDemand += Math.round(segDays * dailyNeed);
		segStart = segEnd.add(1, "day");
	}

	// Step 2: 逐日库存扣减模拟（精度与后端一致）
	let currentStock = fbaValid;
	let totalGap = 0;
	let checkDate = dayjs().startOf("day");
	if (startD.isBefore(checkDate)) checkDate = startD;

	while (checkDate.isBefore(endD) || checkDate.isSame(endD, "day")) {
		const checkDateStr = checkDate.format("YYYY-MM-DD");
		const checkMonthStr = checkDate.format("YYYY-MM");

		if (Array.isArray(fbaShippingList)) {
			for (const shipping of fbaShippingList) {
				if (shipping.amazonSaleDate === checkDateStr) {
					currentStock += Number(shipping.quantity) || 0;
				}
			}
		}

		let coefficient = 1;
		const mc = coefficients[checkMonthStr];
		if (mc) {
			const sysAlpha = mc.system_alpha ?? 0.7;
			const userAlpha = mc.user_alpha ?? null;
			const alpha = manualAlpha ?? (mode === "system" ? sysAlpha : (userAlpha ?? sysAlpha));
			const salesCoeff = mc.filled_sales_coefficient ?? 0;
			const searchCoeff = mc.keyword_coefficient ?? 0;
			coefficient = alpha * salesCoeff + (1 - alpha) * searchCoeff;
		}

		const roundedCoeff = Math.round(coefficient * 100) / 100;
		const dailyNeed = Math.round(dailyAvg * roundedCoeff * 100) / 100;
		const inRange = checkDate.isAfter(startD) || checkDate.isSame(startD, "day");
		currentStock -= dailyNeed;

		if (currentStock < 0) {
			if (inRange) totalGap += Math.abs(currentStock);
			currentStock = 0;
		}
		checkDate = checkDate.add(1, "day");
	}

	// 更新行数据
	const gap = Math.round(totalGap);
	const days = endD.diff(startD, "day") + 1;

	item.totalDemand = expectedDemand;
	item._pureGap = gap;
	item.dailySales = days > 0 ? +(expectedDemand / days).toFixed(1) : 0;

	const actualMissing = Math.max(0, gap - item.purchaseQty);
	item.gap = actualMissing;

	if (gap > 0) {
		const actualMax = item.maxShipQty !== undefined ? item.maxShipQty : item.purchaseQty;
		item.shipQty = Math.min(gap, actualMax);
	} else {
		item.shipQty = 0;
	}

	if (gap > 0 && item.gap > 0) {
		item.remark = `仍缺 ${item.gap} 件，需追加发货`;
	} else if (gap > 0) {
		item.remark = `需补 ${gap} 件，本单已覆盖`;
	} else {
		item.remark = `库存充足，可覆盖周期`;
	}
};

// 算法切换处理（单品级别）
const handleAlgoChange = (item: any) => {
	const range = item.dateRange || batchShipDialog.globalDateRange;
	if (range && range.length === 2) {
		doBatchCalculate([item], range);
	}
};

// 汇总计算
const batchShipSummary = computed(() => {
	const items = batchShipDialog.items;
	const needReplenish = items.filter((i) => i.gap > 0).length;
	const sufficient = items.filter((i) => i.gap <= 0).length;
	const totalGap = items.reduce((s, i) => s + Math.max(0, i.gap), 0);
	const totalCost = items.reduce((s, i) => s + (i.subtotal || 0), 0).toFixed(2);
	const totalShipQty = items.reduce((s, i) => s + (i.shipQty || 0), 0);
	return { needReplenish, sufficient, totalGap, totalCost, totalShipQty };
});

// 行样式
const getBatchRowClass = ({ row }: { row: any }) => {
	if (row.gap > 0) return "batch-row-warn";
	return "";
};

// 采购明细抽屉
const detailDrawer = reactive({
	visible: false,
	order: null as any,
	products: [] as any[]
});

// 算法详情弹窗
const analysisDialog = reactive({
	visible: false,
	loading: false,
	data: null as any
});

// 计算总数量

// Removed mock data and duplicate Crud

// 表格多选变化
const handleSelectionChange = (rows: any[]) => {
	selectedRows.value = rows;
};

// 筛选
const handleFilter = () => {
	// 手动改了采购状态或物流状态时，重置异常预警
	alertFilter.value = "";
	const range = filters.dateRange || [];
	filters.startDate = range[0] || null;
	filters.endDate = range[1] || null;
	Crud.value?.refresh({ page: 1 });
};

// 异常预警快捷筛选联动
const handleAlertChange = (val: string | null) => {
	if (val) {
		// 自动锁定：采购状态=待到货，物流状态=对应异常
		filters.status = [2];
		filters.logistics_status = val;
	} else {
		// 清除：恢复默认
		filters.status = [2, 9];
		filters.logistics_status = "";
	}
	const range = filters.dateRange || [];
	filters.startDate = range[0] || null;
	filters.endDate = range[1] || null;
	Crud.value?.refresh({ page: 1 });
};

// 切换视图模式（兼容 radio @change 和 dropdown @command）
const handleViewModeChange = (mode?: string | number | boolean) => {
	if (mode && typeof mode === "string") {
		viewMode.value = mode as any;
	}
	tableData.value = []; // 清空数据，避免闪烁
	Crud.value?.refresh({ page: 1 });
};

// 批量同步
const openRemarkPreviewDialog = () => {
	remarkPreviewDialog.visible = true;
	remarkPreviewDialog.result = null;
	if (remarkPreviewDialog.mode === "order" && !remarkPreviewDialog.orderRows.length) {
		searchRemarkPreviewOrders(true);
	}
};

const fillRemarkPreviewSample = () => {
	remarkPreviewDialog.mode = "remark";
	remarkPreviewDialog.remark = AUTO_REPLENISH_REMARK_SAMPLE;
	remarkPreviewDialog.result = null;
};

const formatRemarkPreviewDate = (value: any) => {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return String(value).slice(0, 10);
	}
	return date.toISOString().slice(0, 10);
};

const buildRemarkAllocationText = (total: number, profileLabel: string) => {
	const qty = Math.max(0, Math.floor(Number(total) || 0));
	const methods =
		profileLabel === "默认"
			? ["快递", "空快", "空慢", "卡车", "铁路", "海运"]
			: ["快递", "空快", "空慢", "卡车", "海运"];
	const weights =
		profileLabel === "默认" ? [0.06, 0.1, 0.2, 0.28, 0.16] : [0.07, 0.1, 0.21, 0.33];
	let used = 0;
	const parts = methods.map((method, index) => {
		const value =
			index === methods.length - 1
				? Math.max(0, qty - used)
				: Math.floor(qty * (weights[index] || 0));
		used += value;
		return `${method}:${value}`;
	});
	return parts.join(",");
};

const getSelectedRemarkPreviewQuantity = () => {
	const item = remarkPreviewDialog.selectedOrderItem || {};
	const plan = remarkPreviewDialog.selectedPlan || {};
	return Number(item.quantity_plan || item.quantity_real || plan.quantity_plan || 0) || 0;
};

const getSelectedRemarkPreviewProfile = () => {
	const plan = remarkPreviewDialog.selectedPlan || {};
	const marketplace = String(plan.marketplace || plan.plan_marketplace || "").trim();
	if (marketplace.includes("德")) return "德国";
	if (marketplace.includes("英")) return "英国";
	return "默认";
};

const buildRemarkPreviewOverrideSample = () => {
	const plan = remarkPreviewDialog.selectedPlan || {};
	const qty = getSelectedRemarkPreviewQuantity();
	const profile = getSelectedRemarkPreviewProfile();
	const warehouse = plan.warehouse_name || plan.plan_warehouse_name || "";
	const planStart = formatRemarkPreviewDate(
		plan.create_time_remote ||
			plan.plan_create_time ||
			remarkPreviewDialog.selectedOrder?.create_time_remote
	);
	return [
		"【自动补全V1】",
		[
			"算法=运营意向",
			planStart ? `计划开始=${planStart}` : "",
			"缓冲天数=5",
			warehouse ? `采购仓库=${warehouse}` : "",
			`运输配置=${profile}`,
			`发货分配=${buildRemarkAllocationText(qty, profile)}`,
			"人工备注=临时备注预览"
		]
			.filter(Boolean)
			.join("；") + "；",
		"【/自动补全V1】"
	].join("\n");
};

const fillRemarkPreviewOverrideSample = () => {
	if (!remarkPreviewDialog.selectedPlan) {
		ElMessage.warning("请先选择采购单明细和采购计划");
		return;
	}
	remarkPreviewDialog.overrideRemark = buildRemarkPreviewOverrideSample();
	remarkPreviewDialog.result = null;
};

const useSelectedPlanRemarkAsOverride = () => {
	const remark = String(remarkPreviewDialog.selectedPlan?.plan_remark || "").trim();
	if (!remark) {
		ElMessage.warning("当前采购计划没有备注可带入");
		return;
	}
	remarkPreviewDialog.overrideRemark = remark;
	remarkPreviewDialog.result = null;
};

const handleRemarkOverrideToggle = () => {
	remarkPreviewDialog.result = null;
	if (remarkPreviewDialog.overrideRemarkEnabled && !remarkPreviewDialog.overrideRemark.trim()) {
		remarkPreviewDialog.overrideRemark = buildRemarkPreviewOverrideSample();
	}
};

const handleRemarkPreviewModeChange = () => {
	remarkPreviewDialog.result = null;
	if (remarkPreviewDialog.mode === "order" && !remarkPreviewDialog.orderRows.length) {
		searchRemarkPreviewOrders(true);
	}
};

const searchRemarkPreviewOrders = async (resetPage = false) => {
	if (resetPage) {
		remarkPreviewDialog.orderPage = 1;
	}
	remarkPreviewDialog.orderLoading = true;
	try {
		const res = await (service.app as any).bsr_purchase_plan_remark_auto_complete.searchOrders({
			keyword: remarkPreviewDialog.orderKeyword.trim(),
			has_auto_block: remarkPreviewDialog.hasAutoBlockOnly,
			page: remarkPreviewDialog.orderPage,
			size: remarkPreviewDialog.orderPageSize
		});
		remarkPreviewDialog.orderRows = res?.list || [];
		remarkPreviewDialog.orderTotal = Number(res?.total) || 0;
		if (
			remarkPreviewDialog.selectedOrder &&
			!remarkPreviewDialog.orderRows.some(
				(item: any) => item.order_sn === remarkPreviewDialog.selectedOrder.order_sn
			)
		) {
			remarkPreviewDialog.selectedOrder = null;
			remarkPreviewDialog.order_sn = "";
			remarkPreviewDialog.orderContext = null;
			remarkPreviewDialog.selectedPlan = null;
			remarkPreviewDialog.selectedOrderItem = null;
			remarkPreviewDialog.plan_sn = "";
		}
	} catch (e: any) {
		ElMessage.error(e.message || "采购单搜索失败");
	} finally {
		remarkPreviewDialog.orderLoading = false;
	}
};

const selectRemarkPreviewOrder = async (order: any) => {
	remarkPreviewDialog.selectedOrder = order;
	remarkPreviewDialog.order_sn = order.order_sn || "";
	remarkPreviewDialog.orderContext = null;
	remarkPreviewDialog.order_item_id = 0;
	remarkPreviewDialog.selectedOrderItem = null;
	remarkPreviewDialog.selectedPlan = null;
	remarkPreviewDialog.plan_sn = "";
	remarkPreviewDialog.overrideRemarkEnabled = false;
	remarkPreviewDialog.overrideRemark = "";
	remarkPreviewDialog.result = null;
	remarkPreviewDialog.orderContextLoading = true;
	try {
		remarkPreviewDialog.orderContext = await (
			service.app as any
		).bsr_purchase_plan_remark_auto_complete.orderContext({
			order_sn: remarkPreviewDialog.order_sn
		});
	} catch (e: any) {
		ElMessage.error(e.message || "采购单上下文读取失败");
	} finally {
		remarkPreviewDialog.orderContextLoading = false;
	}
};

const selectRemarkPreviewPlan = (item: any) => {
	const plan = item?.purchase_plan;
	if (!plan) {
		ElMessage.warning("该明细未关联本地采购计划");
		return;
	}
	remarkPreviewDialog.order_item_id = Number(item.id) || 0;
	remarkPreviewDialog.selectedOrderItem = item;
	remarkPreviewDialog.selectedPlan = plan;
	remarkPreviewDialog.plan_sn = plan.plan_sn || "";
	if (remarkPreviewDialog.overrideRemarkEnabled) {
		remarkPreviewDialog.overrideRemark = buildRemarkPreviewOverrideSample();
	}
	remarkPreviewDialog.result = null;
	runRemarkPreview();
};

const runRemarkPreview = async () => {
	const planSn = remarkPreviewDialog.plan_sn.trim();
	const remark = remarkPreviewDialog.remark.trim();
	const overrideRemark = remarkPreviewDialog.overrideRemarkEnabled
		? remarkPreviewDialog.overrideRemark.trim()
		: "";
	if (remarkPreviewDialog.mode === "order" && (!remarkPreviewDialog.order_sn || !planSn)) {
		ElMessage.warning("请先选择采购单中的具体采购计划");
		return;
	}
	if (
		remarkPreviewDialog.mode === "order" &&
		remarkPreviewDialog.overrideRemarkEnabled &&
		!overrideRemark
	) {
		ElMessage.warning("请填写临时备注，或关闭临时备注覆盖");
		return;
	}
	if (remarkPreviewDialog.mode === "remark" && !remark) {
		ElMessage.warning("请先粘贴备注文本");
		return;
	}
	const payload =
		remarkPreviewDialog.mode === "order"
			? {
					order_sn: remarkPreviewDialog.order_sn,
					order_item_id: remarkPreviewDialog.order_item_id,
					plan_sn: planSn,
					...(overrideRemark ? { remark: overrideRemark } : {})
				}
			: { remark };

	remarkPreviewDialog.loading = true;
	try {
		const res = await (service.app as any).bsr_purchase_plan_remark_auto_complete.preview(
			payload
		);
		remarkPreviewDialog.result = res;
		if (res?.validation?.readiness?.status === "ready") {
			ElMessage.success("完整校验通过，可自动补全");
		} else if (res?.validation?.readiness?.status === "ready_with_warnings") {
			ElMessage.warning("可自动补全，但存在非阻断警告");
		} else if (res?.parsed?.valid && !res?.errors?.length) {
			ElMessage.success("备注语法解析通过");
		} else {
			ElMessage.warning("备注解析完成，请查看错误或提示");
		}
	} catch (e: any) {
		ElMessage.error(e.message || "备注解析预览失败");
	} finally {
		remarkPreviewDialog.loading = false;
	}
};

const handleSync = async () => {
	syncing.value = true;
	try {
		const res = await (service.app as any).bsr_purchase_order_sync_lingxing.sync();
		syncResult.value = res;
		ElMessage.success("采购单已更新，本次未查询快递100");
		Crud.value?.refresh();
	} catch (e: any) {
		ElMessage.error(e.message || "更新采购单失败");
	} finally {
		syncing.value = false;
	}
};

// 全量重拉采购单
const syncingForce = ref(false);
const handleSyncForce = () => {
	ElMessageBox.confirm(
		"此操作会无视更新时间游标，从1990年开始重新拉取采购单历史数据，可能需要十分钟左右并消耗较多服务器性能。同步完成后会按采购计划备注触发自动补全；物流包裹只刷新本地基础数据，不查询快递100。确定要全量重拉吗？",
		"全量重拉采购单（慎用）",
		{
			confirmButtonText: "确认全量重拉",
			cancelButtonText: "取消",
			type: "error",
			confirmButtonClass: "el-button--danger"
		}
	)
		.then(async () => {
			syncingForce.value = true;
			try {
				const res = await (service.app as any).bsr_purchase_order_sync_lingxing.syncForce();
				syncResult.value = res;
				ElMessage.success("采购单已全量重拉，并已触发采购计划备注自动补全");
				Crud.value?.refresh();
			} catch (e: any) {
				ElMessage.error(e.message || "全量重拉采购单失败");
			} finally {
				syncingForce.value = false;
			}
		})
		.catch(() => {
			// 取消
		});
};

// 单条同步
const handleSyncSingle = async (row: any) => {
	try {
		await (service.app as any).bsr_purchase_order_sync_lingxing.syncSingle({
			order_sn: row.order_sn
		});
		ElMessage.success("同步成功");
		Crud.value?.refresh();
	} catch (e: any) {
		ElMessage.error(e.message || "同步失败");
	}
};

// 打开发货弹窗（新版：批量分析）
const openShippingDialog = async (items: any[]) => {
	if (!items || items.length === 0) {
		ElMessage.warning("请先选择要发货的产品");
		return;
	}

	let productsToShip: any[] = [];

	if (viewMode.value === "order") {
		// 单据视图：选中项是订单，需要根据 order_sn 去请求底下的所有产品明细
		const loading = ElLoading.service({
			lock: true,
			text: "正在拉取订单明细...",
			background: "rgba(0, 0, 0, 0.7)"
		});

		try {
			// 并发请求所有选中订单的明细
			const promises = items.map((order) =>
				(service.app as any).bsr_purchase_order_sync_lingxing
					.itemsPage({
						order_sn: order.order_sn,
						page: 1,
						size: 100
					})
					.then((res: any) => {
						const subItems = res.list || [];
						// 把父订单的信息挂载过去，方便后面取单号和供应商
						return subItems.map((sub: any) => ({ ...sub, parent: order }));
					})
			);

			const results = await Promise.all(promises);
			// 拍平数组
			productsToShip = results.flat();

			if (productsToShip.length === 0) {
				ElMessage.warning("选中的订单下没有有效的商品明细");
				loading.close();
				return;
			}
		} catch (error) {
			console.error("拉取订单明细失败:", error);
			ElMessage.error("拉取订单明细失败，请重试");
			loading.close();
			return;
		}

		loading.close();
	} else {
		// 产品视图：直接就是产品级别的明细，直接用
		productsToShip = [...items];
	}

	batchShipDialog.items = productsToShip.map((item) => {
		const unitPrice = item.price || item.listing_price || item.listing?.listing_price || 0;
		const purchaseQty = item.quantity_plan || item.quantity_real || 0;

		// 提取已占用的发货量
		const occupiedQty =
			item.plan_sn && shipmentMetrics.value.byPlan[item.plan_sn]
				? shipmentMetrics.value.byPlan[item.plan_sn].totalQty
				: 0;
		// 真实还能发货的最大上限
		const maxShipQty = Math.max(0, purchaseQty - occupiedQty);

		// 提取 FBA 相关信息
		const fbaList = item.restocking?.fbaValidList || [];
		const fbaValid = fbaList.reduce(
			(sum: number, i: any) => sum + (Number(i?.quantity) || 0),
			0
		);

		const fbaShipping = Array.isArray(item.restocking?.fbaShippingList)
			? item.restocking.fbaShippingList.reduce(
					(sum: number, i: any) => sum + (Number(i?.quantity) || 0),
					0
				)
			: 0;

		const localList = item.restocking?.extInfo?.localValidDetailList || [];
		const localValid = localList.reduce(
			(sum: number, i: any) => sum + (Number(i?.quantityValid) || 0),
			0
		);

		return {
			...item,
			product_img:
				item.plan_pic_url || item.image_url_display || item.listing?.image_url || "",
			order_sn: item.parent?.order_sn || item.order_sn || "-",
			msku: item.listing?.msku || item.analysisRecord?.msku || item.first_msku || "",
			fnsku: item.listing?.fnsku || item.fnsku || "",
			unitPrice,
			purchaseQty,
			subtotal: +(unitPrice * purchaseQty).toFixed(2),
			algo: batchShipDialog.globalAlgo,
			dateRange: batchShipDialog.globalDateRange
				? [...batchShipDialog.globalDateRange]
				: null,
			days: 0,
			dailySales: 0,
			totalDemand: 0,
			gap: 0,
			shipQty: 0,
			shippingMethod: "",
			shippingLabel: "",
			shippingIcon: "",
			shippingColor: "",
			remark: "请选择销售周期",

			// --- 真实数据映射 ---
			// 1. 日均销量 (3/7/14)
			daily_avg_sales_info: item.restocking?.salesInfo
				? `${item.restocking.salesInfo.salesAvg3 || 0}/${item.restocking.salesInfo.salesAvg7 || 0}/${item.restocking.salesInfo.salesAvg14 || 0}`
				: "-",

			// 2. 可售天数 (总/FBA)
			days_of_supply: item.restocking?.suggestInfo
				? `${item.restocking.suggestInfo.availableSaleDays || 0}/${item.restocking.suggestInfo.fbaAvailableSaleDays || 0}`
				: "-",

			// 3. 日均销量 (兼容 productView 的扁平化和 itemsPage 的嵌套结构)
			daily_avg_sales:
				typeof item.dailyAvgSales !== "undefined"
					? item.dailyAvgSales
					: typeof item.listing?.dailyAvgSales !== "undefined"
						? item.listing.dailyAvgSales
						: "-",

			// 4. FBA/在途/本地
			stock_breakdown: `${fbaValid}/${fbaShipping}/${localValid}`,

			// 5. 总库存
			total_stock:
				item.restocking?.stockQuantityInfo?.stockTotal || item.restocking_stock_total || 0,

			// 6. 待交付/采购计划
			pending_plan: `${item.restocking?.amazonQuantityInfo?.reservedCustomerorders || item.restocking_reserved_customerorders || 0}/${item.restocking?.scmQuantityInfo?.scQuantityPurchasePlan || item.restocking_purchase_plan || 0}`,

			// 7. 预计发货量
			est_ship_qty:
				item.restocking?.suggestInfo?.estimatedSaleQuantity ||
				item.restocking_estimated_sale_quantity ||
				0,

			// 8. 断货时间
			out_of_stock_date:
				item.restocking?.suggestInfo?.outStockDate || item.restocking_out_stock_date || "-",
			occupiedQty,
			maxShipQty
		};
	});
	selectedShippingMethod.value = "air";
	batchShipDialog.visible = true;
};

// 禁用过去日期
const disablePastDate = (date: Date) => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return date < today;
};

// 全局日期变更
const onGlobalDateChange = () => {
	const range = batchShipDialog.globalDateRange;
	if (range && range.length === 2) {
		const start = new Date(range[0]);
		const end = new Date(range[1]);
		batchShipDialog.globalDays =
			Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
	} else {
		batchShipDialog.globalDays = 0;
	}
};

// 全局算法变更
const onGlobalAlgoChange = () => {
	if (batchShipDialog.globalDateRange) {
		applyGlobalToAll();
	}
};

// 应用全局设置到全部行
const applyGlobalToAll = async () => {
	if (!batchShipDialog.globalDateRange) {
		ElMessage.warning("请先选择全局销售周期");
		return;
	}
	batchShipDialog.items.forEach((row) => {
		row.algo = batchShipDialog.globalAlgo;
	});

	// 调用后端批量推演
	await doBatchCalculate(batchShipDialog.items);
	ElMessage.success("已应用推演到全部产品");
};

// 物流抽屉
const logisticsDrawer = reactive({
	visible: false,
	loading: false,
	syncing: false,
	queryingPackageId: null as number | null,
	orderSn: "",
	expandedPkgs: [0] as number[], // 默认展开第一个
	rawDialogVisible: false,
	data: [] as any[]
});

const phoneDialog = reactive({
	visible: false,
	saving: false,
	package: null as any,
	contactPhone: "",
	applyToOrder: false
});

// 切换包裹展开/折叠
const togglePkgExpand = (index: number) => {
	const idx = logisticsDrawer.expandedPkgs.indexOf(index);
	if (idx > -1) {
		logisticsDrawer.expandedPkgs.splice(idx, 1);
	} else {
		logisticsDrawer.expandedPkgs.push(index);
	}
};

// 打开物流抽屉 (懒加载调用后端)
const openLogistics = async (row: any) => {
	logisticsDrawer.orderSn = row.order_sn || row.parent?.order_sn;
	if (!logisticsDrawer.orderSn) {
		ElMessage.warning("未能获取到采购单号");
		return;
	}

	logisticsDrawer.visible = true;
	logisticsDrawer.loading = true;
	logisticsDrawer.expandedPkgs = [0];
	logisticsDrawer.data = [];

	await refreshLogisticsDrawer();
};

const refreshLogisticsDrawer = async () => {
	if (!logisticsDrawer.orderSn) return;
	try {
		const res = await (service.app as any).bsr_purchase_order_sync_lingxing.getLogistics({
			order_sn: logisticsDrawer.orderSn
		});
		logisticsDrawer.data = res || [];
	} catch (e: any) {
		console.error("获取物流明细失败:", e);
		ElMessage.error(e.message || "获取物流信息失败");
	} finally {
		logisticsDrawer.loading = false;
	}
};

// 查询物流：后端会强制执行 45 分钟冷却，已签收包裹也会跳过，避免重复消耗快递100额度
const forceSyncLogistics = async (orderSn: string) => {
	if (!orderSn) return;

	logisticsDrawer.syncing = true;
	try {
		const before = buildPackageSnapshot(logisticsDrawer.data);
		const res = await (service.app as any).bsr_purchase_order_sync_lingxing.forceSyncLogistics({
			order_sn: orderSn
		});
		logisticsDrawer.data = res || [];
		logisticsDrawer.expandedPkgs = [0];
		showLogisticsQuerySummary(logisticsDrawer.data, before);
		Crud.value?.refresh();
	} catch (e: any) {
		console.error("查询物流失败:", e);
		ElMessage.error(e.message || "查询物流失败");
	} finally {
		logisticsDrawer.syncing = false;
	}
};

const queryLogisticsPackage = async (pkg: any) => {
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
		if (idx >= 0 && updated) logisticsDrawer.data.splice(idx, 1, updated);
		showLogisticsQuerySummary(updated ? [updated] : [], before);
		Crud.value?.refresh();
	} catch (e: any) {
		ElMessage.error(e.message || "包裹查询失败");
	} finally {
		logisticsDrawer.queryingPackageId = null;
	}
};

const openPhoneDialog = (pkg: any) => {
	phoneDialog.package = pkg;
	phoneDialog.contactPhone = pkg.can_view_contact_phone ? String(pkg.contact_phone || "") : "";
	phoneDialog.applyToOrder = false;
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
		await (service.app as any).bsr_purchase_order_sync_lingxing.updateLogisticsPhone({
			package_id: phoneDialog.package.id,
			order_sn: logisticsDrawer.orderSn,
			contact_phone: phoneDialog.contactPhone.trim(),
			apply_to_order: phoneDialog.applyToOrder
		});
		phoneDialog.visible = false;
		logisticsDrawer.loading = true;
		await refreshLogisticsDrawer();
		ElMessage.success("手机号已保存");
		Crud.value?.refresh();
	} catch (e: any) {
		ElMessage.error(e.message || "保存手机号失败");
	} finally {
		phoneDialog.saving = false;
	}
};

const markPackageMode = async (pkg: any, queryMode: string) => {
	if (!pkg?.id) return;
	try {
		await (service.app as any).bsr_purchase_order_sync_lingxing.markLogisticsPackageMode({
			package_id: pkg.id,
			query_mode: queryMode
		});
		logisticsDrawer.loading = true;
		await refreshLogisticsDrawer();
		Crud.value?.refresh();
		ElMessage.success("包裹状态已更新");
	} catch (e: any) {
		ElMessage.error(e.message || "更新包裹状态失败");
	}
};

const confirmMarkPackageMode = async (pkg: any, queryMode: string) => {
	const actionText = queryMode === "manual_required" ? "改为不查快递100" : "忽略";
	const description =
		queryMode === "manual_required"
			? "改为不查快递100后，这个包裹不再调用快递100，需要人工判断物流，不代表已经收货。"
			: "忽略后，这个包裹不再调用快递100，也不参与整单物流状态判断。";
	try {
		await ElMessageBox.confirm(description, actionText, {
			confirmButtonText: actionText,
			cancelButtonText: "取消",
			type: queryMode === "ignored" ? "warning" : "info"
		});
		await markPackageMode(pkg, queryMode);
	} catch (e: any) {
		if (e !== "cancel" && e !== "close") {
			ElMessage.error(e.message || "操作失败");
		}
	}
};

const showLogisticsQuerySummary = (
	rows: any[],
	before: ReturnType<typeof buildPackageSnapshot>
) => {
	const summary = buildLogisticsQuerySummary(rows || [], before);
	const message = formatLogisticsQuerySummaryMessage(summary);
	if (summary.realQueryCount > 0) {
		ElMessage.success(message);
	} else {
		ElMessage.warning(message);
	}
};

const getQueryModeText = (mode: string) => {
	const map: Record<string, string> = {
		kuaidi100: "快递100",
		manual_required: "需人工判断",
		ignored: "忽略",
		disabled: "停用"
	};
	return map[String(mode || "")] || mode || "-";
};

const getQueryModeHelp = (pkg: any) => {
	const mode = String(pkg?.query_mode || "");
	const map: Record<string, string> = {
		kuaidi100: "系统按运单号自动识别快递公司，并受 45 分钟冷却限制查询快递100轨迹。",
		manual_required:
			"不调用快递100。适合官方直送、其它、1688采购下单、供应商自送、专线送货等无法通过快递100判断的物流。",
		ignored: "不调用快递100，也不参与整单物流状态判断。仅用于脏数据、重复单号、无效物流。",
		disabled: "已停用，不调用快递100，也不参与整单物流状态判断。"
	};
	return map[mode] || "未知查询方式";
};

const getPhoneStatusText = (pkg: any) => {
	if (Number(pkg.phone_required) !== 1) return "不需要";
	const statusMap: Record<string, string> = {
		ok: pkg.contact_phone ? `已填 ${pkg.contact_phone}` : "已填写",
		missing: "缺少手机号",
		invalid: "号码无效",
		not_required: "不需要"
	};
	return statusMap[pkg.phone_status] || pkg.phone_status || "-";
};

const getPackageSourceItems = (pkg: any) => {
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

const getPackageSourceCount = (pkg: any) => {
	return getPackageSourceItems(pkg).length || 1;
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

const getQueryBlockText = (pkg: any) => {
	if (pkg?.can_query === true) return "可查询快递100";
	return getQueryBlockReasonText(pkg);
};

const getQueryStatusTagType = (pkg: any) => {
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
	if (["signed"].includes(reason)) return "success";
	if (["ignored", "manual_required", "disabled"].includes(reason)) return "info";
	if (["logistics_exception", "no_result"].includes(reason)) return "danger";
	return "info";
};

const isNonQueryMode = (pkg: any) => {
	return ["manual_required", "ignored", "disabled"].includes(String(pkg?.query_mode || ""));
};

const getLogisticsPackageCount = (row: any) => {
	if (Array.isArray(row?.logistics_packages)) return row.logistics_packages.length;
	if (Array.isArray(row?.logistics_info)) return row.logistics_info.length;
	return 0;
};

// 获取物流状态对应的 Tag 颜色
const getLogisticsTagType = (status: string) => {
	switch (status) {
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
		case "delivering":
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
		case "ignored":
			return "info";
		case "disabled":
			return "danger";
		case "no_logistics":
			return "info";
		default:
			return "info";
	}
};

// 人工确认收货
const handleConfirmReceipt = async (orderSns: string[]) => {
	if (!orderSns || orderSns.length === 0) return;
	try {
		await ElMessageBox.confirm(
			`确定要将 ${orderSns.length} 个采购单标记为「已确认收货」吗？`,
			"人工确认收货",
			{ confirmButtonText: "确认", cancelButtonText: "取消", type: "warning" }
		);
		await (service.app as any).bsr_purchase_order_sync_lingxing.confirmReceipt({
			order_sns: orderSns,
			confirmed: 1
		});
		ElMessage.success(`已确认 ${orderSns.length} 个采购单收货`);
		Crud.value?.refresh();
	} catch (e: any) {
		if (e !== "cancel") {
			ElMessage.error(e.message || "操作失败");
		}
	}
};

// 打开采购明细抽屉
const openDetailDrawer = async (row: any) => {
	detailDrawer.order = row;
	detailDrawer.products = [];
	detailDrawer.visible = true;

	try {
		const res = await (service.app as any).bsr_purchase_order_sync_lingxing.itemsPage({
			order_sn: row.order_sn,
			page: 1,
			size: 100
		});
		detailDrawer.products = res.list || [];
	} catch (e: any) {
		ElMessage.error("获取商品明细失败");
	}
};

// 查看算法详情
const showAnalysisDetail = async (product: any) => {
	const analysisRecordId = product?.analysis_record_id;

	if (!analysisRecordId) {
		ElMessage.warning("未关联分析记录");
		return;
	}

	analysisDialog.visible = true;
	analysisDialog.loading = true;
	analysisDialog.data = null;

	try {
		const result = await (service.app as any).bsr_purchase_plan_lingxing.getAnalysisRecord({
			analysis_record_id: analysisRecordId
		});
		analysisDialog.data = result;
	} catch (e: any) {
		console.error("获取算法详情失败:", e);
		ElMessage.error("获取算法详情失败");
	} finally {
		analysisDialog.loading = false;
	}
};

// 发货明细：Hover自动懒加载算法数据
const loadAnalysisData = async (item: any) => {
	// 如果已加载或者正在加载，直接返回
	if (item._analysisData || item._analysisLoading) return;

	let recordId = item.analysis_record_id;

	// 没有 analysis_record_id 就不查了

	if (!recordId) {
		item._analysisData = null; // 标记为空，不再请求
		item._analysisLoading = false;
		return;
	}

	try {
		item._analysisLoading = true;
		const result = await (service.app as any).bsr_purchase_plan_lingxing.getAnalysisRecord({
			analysis_record_id: recordId
		});
		item._analysisData = result; // 缓存结果
	} catch (e) {
		console.error("[loadAnalysisData] 加载详情失败:", e);
		item._analysisData = null;
	} finally {
		item._analysisLoading = false;
	}
};

// 复制文本
const copyText = async (text: string) => {
	if (!text) return;

	// 方法1: 使用 Clipboard API（现代浏览器）
	if (navigator.clipboard && window.isSecureContext) {
		try {
			await navigator.clipboard.writeText(text);
			ElMessage.success("已复制");
			return;
		} catch (err) {
			console.warn("Clipboard API 失败，尝试备用方法:", err);
		}
	}

	// 方法2: 使用传统方法（兼容所有浏览器）
	try {
		const textarea = document.createElement("textarea");
		textarea.value = text;
		textarea.style.position = "fixed";
		textarea.style.opacity = "0";
		textarea.style.left = "-9999px";
		document.body.appendChild(textarea);
		textarea.select();
		textarea.setSelectionRange(0, text.length);
		const successful = document.execCommand("copy");
		document.body.removeChild(textarea);

		if (successful) {
			ElMessage.success("已复制");
		} else {
			throw new Error("execCommand 失败");
		}
	} catch (err) {
		console.error("复制失败:", err);
		ElMessage.error("复制失败，请手动复制");
	}
};

// 状态样式
const getStatusType = (status: number): "primary" | "success" | "warning" | "info" | "danger" => {
	const map: Record<number, "primary" | "success" | "warning" | "info" | "danger"> = {
		9: "success", // 已完成
		1: "primary", // 待下单
		2: "warning", // 待到货
		3: "info", // 待提交
		"-1": "danger", // 作废
		121: "warning", // (审批流)待审核
		122: "danger", // (审批流)驳回
		124: "danger" // (审批流)作废
	};
	return map[status] || map[status as unknown as string] || "info";
};

const getShippedType = (status?: number): "primary" | "success" | "warning" | "info" | "danger" => {
	if (status === 3) return "success";
	if (status === 2) return "warning";
	return "info";
};

const getPayClass = (status?: number) => {
	if (status === 3) return "pay-success";
	if (status === 0) return "pay-pending";
	return "pay-partial";
};

const getSettlementText = (method?: number) => {
	const map: Record<number, string> = { 7: "现结", 8: "月结" };
	return method !== undefined ? map[method] : "";
};

// ========== 产品Listing复刻的helper函数 ==========

// 获取站点简称
const getMarketplaceShortName = (marketplace: string) => {
	if (!marketplace) return "";
	const map: Record<string, string> = {
		英国: "英",
		德国: "德",
		法国: "法",
		西班牙: "西",
		意大利: "意"
	};
	return map[marketplace] || marketplace.charAt(0);
};

// 获取站点颜色
const getMarketplaceColor = (marketplace: string) => {
	if (!marketplace) return "#909399";
	const map: Record<string, string> = {
		英国: "#409EFF", // Primary Blue
		德国: "#303133", // Dark/Black
		法国: "#8e44ad", // Purple
		西班牙: "#E6A23C", // Warning/Orange
		意大利: "#67C23A" // Success/Green
	};
	return map[marketplace] || "#909399";
};

// 获取实时销量
const getRealtimeSalesVolume = (row: any) => {
	const value = row?.restocking?.realtimeSales;
	if (value === null || value === undefined) return null;
	const num = Number(value);
	return Number.isNaN(num) ? null : num;
};

// 获取FBA库存数量（使用 quantity 总库存）
const getFbaInventoryQuantity = (row: any) => {
	const fbaList = row?.restocking?.fbaValidList;
	if (Array.isArray(fbaList) && fbaList.length > 0) {
		return fbaList.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0);
	}

	const info = row?.restocking?.amazonQuantityInfo;
	if (!info) {
		const base = Number(row?.afn_fulfillable_quantity);
		return Number.isNaN(base) ? 0 : base;
	}
	const qty = Number(info.afnFulfillableQuantity) || 0;
	return qty;
};

// 获取在途库存数量
const getRestockingFbaShippingQuantity = (row: any) => {
	const list = row?.restocking?.fbaShippingList;
	if (!Array.isArray(list)) return 0;
	return list.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0);
};

// 获取总可售天数
const getSellableDaysTotal = (row: any) => {
	const dailyAvg = Number(row.dailyAvgSales) || 0;
	const totalStock = Number(row.restocking_stock_total) || 0;
	if (dailyAvg <= 0) return "-";
	return Math.floor(totalStock / dailyAvg);
};

// 获取FBA可售天数
const getSellableDaysFba = (row: any) => {
	const dailyAvg = Number(row.dailyAvgSales) || 0;
	const fbaStock = getFbaInventoryQuantity(row);
	if (dailyAvg <= 0) return "-";
	return Math.floor(fbaStock / dailyAvg);
};
</script>

<style lang="scss" scoped>
// ========== 筛选栏样式 ==========
.filter-wrapper {
	display: flex;
	align-items: center;
	gap: 12px;
}

.filter-group {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 16px;
	background: #f8f9fa;
	border-radius: 8px;
	border: 1px solid #e9ecef;
}

.filter-item {
	display: flex;
	align-items: center;
}

.filter-select {
	width: 130px;

	::v-deep(.el-input__wrapper) {
		background: #fff;
	}
}

.fulfillment-status-option {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 18px;
	min-width: 148px;
}

.fulfillment-status-option span:first-child {
	color: var(--el-text-color-primary);
}

.fulfillment-status-option span:last-child {
	flex: 0 0 auto;
	padding: 1px 6px;
	border-radius: 999px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 18px;
}

.filter-date {
	width: 240px;
}

.search-wrapper {
	display: flex;
	align-items: center;
}

.search-input {
	width: 280px;
}

// ========== 表格优化 ==========
.purchase-table {
	// 优化滚动条样式
	:deep(.el-scrollbar__wrap) {
		background-color: #f5f7fa;
	}

	:deep(.el-scrollbar__thumb) {
		background-color: #dcdfe6;
		border-radius: 6px;

		&:hover {
			background-color: #c0c4cc;
		}
	}

	:deep(.el-scrollbar__bar) {
		opacity: 1;
	}

	// 增加行高
	:deep(.el-table__row) {
		transition: background-color 0.2s;

		&:hover {
			background-color: #f5f7fa !important;
		}
	}
}

// ========== 原有样式 ==========
.order-sn-cell {
	display: flex;
	align-items: center;
	gap: 4px;

	.sn-text {
		font-family: Monaco, monospace;
		font-weight: 600;
		color: #409eff;
	}

	.copy-btn {
		cursor: pointer;
		color: #909399;
		font-size: 12px;

		&:hover {
			color: #409eff;
		}
	}
}

.amount-text {
	color: #f56c6c;
	font-weight: 600;
}

.fee-text {
	color: #e6a23c;
}

.total-text {
	color: #f56c6c;
	font-weight: 700;
}

.pay-text {
	font-size: 12px;

	&.pay-success {
		color: #67c23a;
	}

	&.pay-pending {
		color: #909399;
	}

	&.pay-partial {
		color: #e6a23c;
	}
}

// 发货弹窗样式
.shipping-dialog-content {
	padding: 0 8px;
}

.selected-orders-section {
	margin-bottom: 20px;

	.section-title {
		font-size: 14px;
		font-weight: 600;
		color: #303133;
		margin-bottom: 10px;
	}

	.selected-orders-list {
		max-height: 120px;
		overflow-y: auto;
		border: 1px solid #ebeef5;
		border-radius: 6px;
		padding: 8px;
		background: #fafafa;
	}

	.selected-order-item {
		display: flex;
		align-items: center;
		padding: 6px 8px;
		border-bottom: 1px solid #f0f0f0;
		font-size: 13px;

		&:last-child {
			border-bottom: none;
		}

		.order-sn {
			color: #409eff;
			font-weight: 500;
			width: 140px;
			font-family: Monaco, monospace;
		}

		.order-supplier {
			flex: 1;
			color: #606266;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.order-total {
			color: #f56c6c;
			font-weight: 600;
			margin-left: 12px;
		}
	}
}

.date-section {
	margin-bottom: 20px;

	.section-title {
		font-size: 14px;
		font-weight: 600;
		color: #303133;
		margin-bottom: 10px;
	}
}

.channels-section {
	margin-bottom: 20px;

	.section-title {
		font-size: 14px;
		font-weight: 600;
		color: #303133;
		margin-bottom: 10px;
	}

	.channel-list {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}

	.channel-card {
		display: flex;
		align-items: center;
		padding: 16px;
		border: 2px solid #ebeef5;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s;
		background: #fff;

		&:hover:not(.disabled) {
			border-color: #409eff;
			background: #ecf5ff;
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
		}

		&.selected {
			border-color: #409eff;
			background: #ecf5ff;
		}

		&.disabled {
			opacity: 0.5;
			cursor: not-allowed;
			background: #f5f7fa;
		}

		.channel-icon {
			font-size: 28px;
			margin-right: 12px;
		}

		.channel-info {
			flex: 1;

			.channel-name {
				font-weight: 600;
				color: #303133;
				font-size: 15px;
			}

			.channel-days {
				color: #909399;
				font-size: 12px;
				margin-top: 2px;
			}
		}

		.channel-status {
			margin-left: auto;
		}
	}
}

.tracking-section {
	margin-bottom: 20px;

	.section-title {
		font-size: 14px;
		font-weight: 600;
		color: #303133;
		margin-bottom: 10px;
	}
}

.summary-section {
	background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%);
	border-radius: 10px;
	padding: 16px;
	border: 1px solid #d4e5ff;

	.summary-title {
		font-size: 14px;
		font-weight: 600;
		color: #409eff;
		margin-bottom: 12px;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
	}

	.summary-item {
		display: flex;
		justify-content: space-between;
		align-items: center;

		.label {
			color: #606266;
			font-size: 13px;
		}

		.value {
			font-weight: 600;
			color: #303133;

			&.highlight {
				color: #409eff;
			}
		}
	}
}

// 发货成功弹窗
.shipping-success-content {
	.success-header {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 8px;
		font-size: 18px;
		font-weight: 600;
		color: #67c23a;
		margin-bottom: 20px;

		.success-icon {
			font-size: 28px;
		}
	}

	.success-card {
		background: #f0f9eb;
		border-radius: 10px;
		padding: 16px;
		margin-bottom: 16px;

		.info-row {
			display: flex;
			justify-content: space-between;
			padding: 8px 0;
			border-bottom: 1px dashed #c2e7b0;

			&:last-child {
				border-bottom: none;
			}

			.label {
				color: #606266;
			}

			.value {
				font-weight: 600;
				color: #303133;
				display: flex;
				align-items: center;
				gap: 4px;

				&.highlight {
					color: #67c23a;
				}

				&.copyable {
					cursor: pointer;
					color: #409eff;

					&:hover {
						text-decoration: underline;
					}
				}
			}
		}
	}

	.success-orders {
		background: #f5f7fa;
		border-radius: 10px;
		padding: 12px 16px;

		.orders-title {
			color: #909399;
			font-size: 13px;
			margin-bottom: 8px;
		}

		.order-item {
			padding: 4px 0;
			color: #606266;

			.order-sn {
				color: #409eff;
				font-weight: 500;
				font-family: Monaco, monospace;
			}

			.order-qty {
				color: #909399;
				margin-left: 8px;
			}
		}
	}
}

// 物流抽屉 - 卡片折叠式布局
.logistics-content {
	padding: 0 16px 16px;
}

.logistics-drawer-actions {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
}

.logistics-card-list {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.logistics-pkg-card {
	background: #fff;
	border: 1px solid #ebeef5;
	border-radius: 10px;
	overflow: hidden;
	transition: box-shadow 0.2s;

	&:hover {
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
	}

	.pkg-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: #f8f9fa;
		cursor: pointer;
		user-select: none;
		transition: background 0.15s;

		&:hover {
			background: #f0f2f5;
		}
	}

	.pkg-card-left {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;

		.pkg-index {
			font-size: 13px;
			font-weight: 600;
			color: #409eff;
		}

		.pkg-company {
			font-size: 13px;
			color: #606266;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	.pkg-card-right {
		display: flex;
		align-items: center;
		gap: 8px;

		.pkg-expand-icon {
			font-size: 14px;
			color: #909399;
			transition: transform 0.25s;

			&.is-expanded {
				transform: rotate(180deg);
			}
		}
	}

	.pkg-card-tracking {
		display: flex;
		align-items: center;
		padding: 8px 16px;
		border-top: 1px solid #f0f0f0;
		font-size: 13px;

		.tracking-label {
			color: #909399;
			flex-shrink: 0;
		}

		.tracking-value {
			color: #303133;
			font-family: Monaco, Consolas, monospace;
			font-weight: 500;
			margin-right: 4px;
		}
	}

	.pkg-card-body {
		padding: 12px 16px 16px;
		border-top: 1px solid #f0f0f0;

		.pkg-sync-time {
			font-size: 12px;
			color: #c0c4cc;
			margin-bottom: 12px;
		}

		.pkg-timeline {
			padding-top: 4px;
		}
	}
}

.pkg-source-trigger {
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

.pkg-meta-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
	margin-bottom: 12px;
}

.pkg-meta-item {
	border: 1px solid #ebeef5;
	border-radius: 6px;
	padding: 8px 10px;
	background: #fafafa;
	min-width: 0;

	span {
		display: block;
		font-size: 12px;
		color: #909399;
		margin-bottom: 4px;
	}

	strong {
		display: block;
		font-size: 13px;
		color: #303133;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:deep(.el-tag) {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}

.pkg-error {
	color: #f56c6c;
	background: #fef0f0;
	border: 1px solid #fde2e2;
	border-radius: 6px;
	padding: 8px 10px;
	font-size: 12px;
	margin-bottom: 12px;
}

.pkg-source-panel {
	border: 1px solid #e5e7eb;
	border-radius: 6px;
	padding: 10px;
	background: #f9fafb;
	margin-bottom: 12px;
}

.pkg-source-title {
	display: flex;
	align-items: baseline;
	gap: 8px;
	margin-bottom: 8px;

	span {
		font-size: 13px;
		font-weight: 650;
		color: #303133;
	}

	small {
		font-size: 12px;
		color: #909399;
	}
}

.pkg-source-row {
	display: grid;
	grid-template-columns: 24px minmax(0, 1fr);
	gap: 8px;
	font-size: 12px;
	line-height: 1.45;

	& + & {
		margin-top: 8px;
	}

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
		font-weight: 600;
		color: #303133;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.source-fields {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 4px;
		color: #606266;
		font-family: Monaco, Consolas, monospace;
	}
}

.pkg-action-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	margin-bottom: 12px;
}

.readonly-text {
	color: #303133;
	font-family: Monaco, Consolas, monospace;
}

.unmapped-wrap {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin: 12px 0;
}

.unmapped-tag {
	cursor: pointer;
}

@media (max-width: 900px) {
	.pkg-meta-grid {
		grid-template-columns: 1fr;
	}
}

// 时间轴文字
.trace-remark {
	font-size: 13px;
	color: #606266;
	line-height: 1.6;

	&.is-latest {
		color: #303133;
		font-weight: 500;
	}
}

// 底部调试链接
.logistics-debug-link {
	text-align: center;
	padding: 16px 0 4px;
	border-top: 1px dashed #ebeef5;
	margin-top: 8px;
}

// 原始 JSON 展示块
.raw-json-block {
	background: #1e1e1e;
	color: #d4d4d4;
	padding: 16px;
	border-radius: 8px;
	font-size: 12px;
	font-family: Monaco, Consolas, monospace;
	line-height: 1.5;
	max-height: 500px;
	overflow: auto;
	white-space: pre-wrap;
	word-break: break-all;
}

// 采购明细抽屉
.detail-drawer-content {
	padding: 16px;

	.order-info-section {
		background: #f5f7fa;
		border-radius: 10px;
		padding: 16px;
		margin-bottom: 20px;

		.info-header {
			font-size: 14px;
			font-weight: 600;
			color: #303133;
			margin-bottom: 12px;
			padding-left: 10px;
			border-left: 3px solid #409eff;
		}

		.info-grid {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 10px;
		}

		.info-item {
			display: flex;
			align-items: center;
			gap: 8px;

			.label {
				color: #909399;
				font-size: 13px;
			}

			.value {
				color: #303133;
				font-weight: 500;

				&.amount {
					color: #f56c6c;
					font-weight: 600;
				}
			}
		}
	}

	.products-section {
		.section-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 12px;

			.title {
				font-size: 14px;
				font-weight: 600;
				color: #303133;
				padding-left: 10px;
				border-left: 3px solid #67c23a;
			}
		}

		.product-list {
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		.product-card {
			background: #fff;
			border: 1px solid #ebeef5;
			border-radius: 8px;
			padding: 12px;

			.product-main {
				display: flex;
				gap: 12px;
				margin-bottom: 10px;

				.product-image {
					width: 60px;
					height: 60px;
					border-radius: 4px;
					overflow: hidden;
					background: #f5f7fa;
					flex-shrink: 0;

					:deep(.el-image) {
						width: 100%;
						height: 100%;
					}

					.no-image {
						width: 100%;
						height: 100%;
						display: flex;
						align-items: center;
						justify-content: center;
						color: #c0c4cc;
						font-size: 12px;
					}
				}

				.product-info {
					flex: 1;
					min-width: 0;

					.product-name {
						font-weight: 600;
						color: #303133;
						margin-bottom: 4px;
						overflow: hidden;
						text-overflow: ellipsis;
						white-space: nowrap;
					}

					.product-sku,
					.product-spec {
						font-size: 12px;
						color: #909399;
						margin-top: 2px;
					}

					.product-plan {
						display: flex;
						align-items: center;
						gap: 4px;
						margin-top: 6px;
						padding: 4px 8px;
						background: #f0f9ff;
						border-radius: 4px;
						font-size: 12px;

						.el-icon {
							color: #409eff;
							font-size: 14px;
						}

						.label {
							color: #606266;
						}

						.el-link {
							font-weight: 500;
						}
					}
				}
			}

			.product-stats {
				display: flex;
				justify-content: space-between;
				padding-top: 10px;
				border-top: 1px solid #f0f0f0;

				.stat-item {
					display: flex;
					align-items: center;
					gap: 6px;

					.label {
						color: #909399;
						font-size: 12px;
					}

					.value {
						color: #303133;
						font-weight: 500;

						&.highlight {
							color: #409eff;
							font-weight: 600;
						}

						&.amount {
							color: #f56c6c;
							font-weight: 600;
						}
					}
				}
			}
		}
	}
}

// 算法详情弹窗
.analysis-loading {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 8px;
	padding: 40px;
	color: #909399;
}

// 产品视图样式
.product-info-cell {
	display: flex;
	gap: 12px;
	align-items: center;

	.product-pic {
		width: 48px;
		height: 48px;
		background-color: #f5f7fa;
		border-radius: 4px;
		border: 1px solid #ebeef5;
		flex-shrink: 0;
		cursor: zoom-in;

		.no-pic {
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			color: #c0c4cc;
			font-size: 20px;
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
		}

		.product-sku {
			font-size: 12px;
			color: #909399;
			display: flex;
			align-items: center;
			gap: 6px;

			span {
				font-family: monospace;
			}

			.algo-tag {
				height: 18px;
				padding: 0 4px;
				font-size: 11px;
			}
		}
	}
}

.parent-order-cell {
	display: flex;
	flex-direction: column;
	gap: 4px;

	.parent-sn {
		display: flex;
		align-items: center;
		gap: 4px;
		font-family: monospace;
		font-weight: 500;
		color: #303133;

		.copy-btn {
			cursor: pointer;
			color: #409eff;
			font-size: 14px;
			display: none;
		}

		&:hover .copy-btn {
			display: inline-flex;
		}
	}

	.parent-supplier {
		font-size: 12px;
		color: #909399;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
}

.plan-sn-link {
	color: #409eff;
	cursor: pointer;
	text-decoration: none;
	font-family: monospace;

	&:hover {
		text-decoration: underline;
	}
}

.highlight-qty {
	font-weight: 600;
	color: #409eff;
}

.analysis-empty {
	padding: 20px;
}

.analysis-content {
	padding: 0 8px;
}

.algo-header {
	font-size: 14px;
	font-weight: 600;
	color: #303133;
	margin-bottom: 12px;
}

.formula-card {
	background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%);
	border-radius: 12px;
	padding: 20px;
	margin-bottom: 16px;
	border: 1px solid #d4e5ff;
}

.formula-body {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 16px;
}

.formula-item {
	text-align: center;
	padding: 12px 20px;
	background: #fff;
	border-radius: 8px;
	min-width: 80px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

	&.highlight {
		background: #fff;
		border: 2px solid #67c23a;
	}
}

.formula-value {
	font-size: 28px;
	font-weight: 700;
	line-height: 1.2;

	&.primary {
		color: #409eff;
	}
	&.warning {
		color: #e6a23c;
	}
	&.success {
		color: #67c23a;
	}
}

.formula-label {
	font-size: 12px;
	margin-top: 4px;
	color: #909399;
}

.formula-op {
	font-size: 24px;
	font-weight: 300;
	color: #c0c4cc;
}

.summary-box {
	background: #f0f7ff;
	border-radius: 8px;
	padding: 12px 16px;
	margin-bottom: 16px;
	font-size: 13px;
	color: #606266;
	border-left: 3px solid #409eff;
}

.breakdown-section {
	margin-bottom: 16px;

	.section-title {
		font-size: 14px;
		font-weight: 600;
		color: #303133;
		margin-bottom: 12px;
		padding-left: 10px;
		border-left: 3px solid #409eff;
	}
}

.highlight-value {
	font-weight: 600;
	color: #409eff;
}

.remark-box {
	margin-bottom: 8px;

	.section-title {
		font-size: 14px;
		font-weight: 600;
		color: #303133;
		margin-bottom: 8px;
	}

	.remark-content {
		background: #fef0e6;
		padding: 12px 16px;
		border-radius: 8px;
		font-size: 13px;
		color: #e6a23c;
		border: 1px solid #faecd8;
	}
}

/* ========== 批量发货分析弹窗 ========== */
.batch-ship-dialog {
	.el-dialog__body {
		padding: 0 24px 8px;
		max-height: 80vh;
		overflow-y: auto;
	}
	.el-dialog__header {
		padding: 16px 24px 0;
	}
	.el-dialog__footer {
		padding: 12px 24px 20px;
		border-top: 1px solid #f0f0f0;
	}
}

.batch-dialog-header {
	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.header-icon {
		font-size: 22px;
	}
	.header-title {
		font-size: 17px;
		font-weight: 700;
		color: #1d2129;
	}
}

.batch-global-settings {
	background: linear-gradient(135deg, #f0f5ff 0%, #e8f4fd 100%);
	border: 1px solid #d4e5f7;
	border-radius: 12px;
	padding: 16px 20px;
	margin: 16px 0;

	.setting-row {
		display: flex;
		align-items: center;
		gap: 24px;
		flex-wrap: wrap;
	}

	.setting-item {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.setting-label {
		font-size: 13px;
		font-weight: 600;
		color: #303133;
		white-space: nowrap;
	}
}

/* 产品卡片列表 */
.batch-items-scroll {
	max-height: 480px;
	overflow-y: auto;
	padding-right: 4px;
}

.batch-item-card {
	display: flex;
	align-items: stretch;
	gap: 0;
	border: 1px solid #ebeef5;
	border-radius: 12px;
	margin-bottom: 12px;
	background: #fff;
	overflow: hidden;
	transition:
		box-shadow 0.2s,
		border-color 0.2s;

	&:hover {
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
		border-color: #d9e2ec;
	}

	&.card-warn {
		border-left: 4px solid #f56c6c;
		background: linear-gradient(90deg, #fff8f8 0%, #fff 8%);
	}

	&.card-ok {
		border-left: 4px solid #67c23a;
		background: linear-gradient(90deg, #f6ffed 0%, #fff 8%);
	}
}

.item-product {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 16px;
	min-width: 340px;
	max-width: 380px;
	border-right: 1px solid #f0f0f0;

	.item-index {
		font-size: 13px;
		font-weight: 700;
		color: #c0c4cc;
		min-width: 20px;
		text-align: center;
	}

	.item-image {
		flex-shrink: 0;
	}

	.img-placeholder {
		width: 56px;
		height: 56px;
		background: #f5f7fa;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px dashed #dcdfe6;
	}

	.item-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.item-name {
		font-size: 13px;
		font-weight: 600;
		color: #1d2129;
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.item-order-sn {
		font-size: 11px;
		color: #909399;
		font-family: "Consolas", monospace;
	}

	.item-price-row {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: #606266;
		margin-top: 2px;

		.price-label {
			color: #909399;
		}
		.price-val {
			color: #e6a23c;
			font-weight: 600;
		}
		.qty-sep {
			color: #c0c4cc;
			margin: 0 2px;
		}
		.qty-val {
			font-weight: 600;
			color: #409eff;
		}
		.subtotal {
			margin-left: auto;
			b {
				color: #f56c6c;
				font-size: 13px;
			}
		}
	}
}

.item-analysis {
	flex: 1;
	padding: 12px 16px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 0;

	.analysis-controls {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.ctrl-group {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.ctrl-label {
		font-size: 12px;
		color: #909399;
		white-space: nowrap;
	}

	.rationale-ctrl {
		margin-left: 12px;
		display: flex;
		align-items: center;

		.rationale-btn {
			font-size: 13px;
			padding: 4px 8px;
			font-weight: 600;
			&:hover {
				background: #ecf5ff;
				border-radius: 4px;
			}
		}
	}

	.stock-badge {
		background: #ecf5ff;
		color: #409eff;
		font-weight: 700;
		font-size: 14px;
		padding: 2px 12px;
		border-radius: 6px;
		border: 1px solid #d9ecff;
	}

	// 1. 静态数据区样式 (Refined)
	.analysis-data-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 0;
		margin-bottom: 8px; // 与下方动态区隔开
		background: #f8f9fb; // 浅灰色背景，表示只读/参考
		border: 1px solid #ebeef5;
		border-radius: 6px;
		padding: 8px 0;

		.grid-item {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			text-align: center;
			padding: 0 4px;
			border-right: 1px solid #ebeef5;

			&:last-child {
				border-right: none;
			}

			.grid-label {
				font-size: 11px;
				color: #909399;
				margin-bottom: 4px;
				line-height: 1.2;
				height: 26px;
				display: flex;
				align-items: center;
			}

			.grid-val {
				font-size: 13px;
				font-weight: 600;
				color: #606266; // 稍微淡一点的颜色
				word-break: break-word;
				line-height: 1.2;

				&.highlight {
					color: #409eff;
				}
				&.link-text {
					color: #909399; // 静态数据颜色淡化
					font-family: Monaco, monospace;
					font-size: 12px;
				}
			}
		}
	}

	// 2. 动态操作区样式 (New)
	.analysis-interactive-zone {
		background: #fff;
		border: 1px solid #dcdfe6; // 稍微深一点的边框，强调操作区
		border-radius: 8px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);

		// 上半部分：控制器
		.analysis-controls {
			display: flex;
			align-items: center;
			gap: 16px;
			padding-bottom: 8px;
			border-bottom: 1px dashed #ebeef5;

			.ctrl-group {
				display: flex;
				align-items: center;
				gap: 8px;
			}
			.ctrl-label {
				font-size: 12px;
				color: #606266;
			}
		}

		// 下半部分：结果与操作
		.analysis-result {
			display: flex;
			align-items: center;
			justify-content: flex-start; // 左对齐
			gap: 12px;
			padding-top: 2px;

			.result-cell {
				display: flex;
				flex-direction: column;
				align-items: center;
				min-width: 50px;

				.result-label {
					font-size: 11px;
					color: #909399;
				}
				.result-value {
					font-size: 15px;
					font-weight: 700;
					color: #303133;
				}

				&.result-gap .result-value {
					color: #f56c6c;
				}
			}

			.ship-qty-cell {
				margin-left: auto; // 发货数输入框靠右
				margin-right: 12px;
				display: flex;
				align-items: center;
				gap: 8px;
				background: #fff8e6;
				padding: 4px 8px;
				border-radius: 4px;
				border: 1px solid #faecd8;

				.result-label {
					color: #e6a23c;
					font-weight: 600;
				}
			}
		}
	}
}

.batch-summary-bar {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 14px 20px;
	margin-top: 16px;
	background: linear-gradient(135deg, #fafbfc 0%, #f5f7fa 100%);
	border-radius: 12px;
	border: 1px solid #ebeef5;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);

	.summary-chip {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 8px 16px;
		border-radius: 20px;
		font-size: 13px;
		background: #fff;
		color: #606266;
		border: 1px solid #ebeef5;

		.chip-label {
			font-weight: 400;
		}
		.chip-value {
			font-weight: 700;
			font-size: 16px;
		}
		.chip-unit {
			font-size: 12px;
			color: #909399;
		}

		&.warn {
			background: #fef0f0;
			border-color: #fde2e2;
			color: #f56c6c;
			.chip-value {
				color: #f56c6c;
			}
		}
		&.ok {
			background: #f0f9eb;
			border-color: #e1f3d8;
			color: #67c23a;
			.chip-value {
				color: #67c23a;
			}
		}
		&.total {
			background: #ecf5ff;
			border-color: #d9ecff;
			color: #409eff;
			.chip-value {
				color: #409eff;
			}
		}
		&.ship-total {
			background: #f4f0ff;
			border-color: #e0d4f7;
			color: #7c3aed;
			.chip-value {
				color: #7c3aed;
			}
		}
		&.total-cost {
			background: #fdf6ec;
			border-color: #faecd8;
			color: #e6a23c;
			.chip-value {
				color: #e6a23c;
				font-size: 15px;
			}
			margin-left: auto;
		}
	}
}

/* ========== 产品Listing复刻的样式 ========== */

/* 状态标签单元格样式 */
:deep(.asin-cell) {
	display: flex;
	flex-direction: column;
	gap: 2px;
}
:deep(.asin-badges) {
	display: flex;
	flex-wrap: wrap;
	gap: 3px;
	align-items: center;
}

/* 库存单元格样式 */
:deep(.inventory-cell) {
	display: flex;
	flex-direction: column;
	gap: 2px;
	font-size: 12px;
	line-height: 1.2;
}
:deep(.inventory-row) {
	display: flex;
	align-items: center;
	gap: 4px;
}
:deep(.inventory-label) {
	color: #909399;
	width: 32px;
	text-align: right;
	flex-shrink: 0;
}

/* 减小表格字体 */
:deep(.el-table .cell) {
	font-size: 12px;
	padding: 0 8px;
}

/* 表格行高调整 */
:deep(.el-table__row) {
	height: auto;
}
:deep(.el-table td) {
	padding: 8px 0;
}

/* 标签间距调整 */
:deep(.el-tag) {
	margin: 0;
	padding: 0 6px;
	height: 20px;
	line-height: 20px;
	font-size: 12px;
}

/* popover表格样式优化 */
:deep(.el-tooltip__popper .el-table) {
	font-size: 12px;
}
:deep(.el-tooltip__popper .el-table th) {
	padding: 8px 0;
	background: #f5f7fa;
}
:deep(.el-tooltip__popper .el-table td) {
	padding: 6px 0;
}

/* 图片样式 */
:deep(.el-image) {
	width: 50px;
	height: 50px;
}

/* 表格边框和颜色优化 */
:deep(.el-table--border) {
	border-color: #ebeef5;
}
:deep(.el-table th) {
	background: #f5f7fa;
	color: #606266;
	font-weight: 600;
}
:deep(.el-table tr:hover > td) {
	background: #f5f7fa !important;
}

/* 固定列阴影效果 */
:deep(.el-table__fixed-column--left) {
	box-shadow: 2px 0 6px rgba(0, 0, 0, 0.05);
}
:deep(.el-table__fixed-column--right) {
	box-shadow: -2px 0 6px rgba(0, 0, 0, 0.05);
}

/* 文字颜色优化 */
:deep(.el-table .cell) {
	color: #606266;
}

/* 数字颜色 */
:deep(.amount-text) {
	color: #f56c6c;
	font-weight: 600;
}
:deep(.total-text) {
	color: #409eff;
	font-weight: 600;
}
:deep(.fee-text) {
	color: #909399;
}
:deep(.highlight-qty) {
	color: #409eff;
	font-weight: 600;
}

.sort-clickable-area {
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	padding: 2px 3px;
	border-radius: 4px;
	transition: background-color 0.2s;
	white-space: nowrap;
	font-size: 12px;
}

.sort-clickable-area:hover {
	background-color: #f0f2f5;
}

.sort-arrows {
	display: inline-flex;
	flex-direction: column;
	margin-left: 1px;
	height: 16px;
	justify-content: center;
}

/* ========== 日期高亮动画 ========== */
.date-highlight {
	animation: dateFlash 1.5s ease-out;
}
@keyframes dateFlash {
	0% {
		background: #fdf6ec;
		box-shadow: 0 0 0 2px #e6a23c;
		border-radius: 6px;
	}
	50% {
		background: #fef0e0;
		box-shadow: 0 0 0 3px #f5a623;
		border-radius: 6px;
	}
	100% {
		background: transparent;
		box-shadow: none;
	}
}

/* ========== 填写发货单据弹窗 ========== */
:deep(.sp-grid-row) {
	display: grid;
	grid-template-columns: 70px 1fr 1fr 1fr 1fr 1fr;
	gap: 8px;
	align-items: center;
}
:deep(.sp-grid-row .el-select),
:deep(.sp-grid-row .el-date-editor.el-input),
:deep(.sp-grid-row .el-input) {
	width: 100% !important;
}
:deep(.sp-grid-label) {
	font-size: 12px;
	color: #909399;
	font-weight: 500;
	white-space: nowrap;
}
.sp-batch-bar {
	padding: 10px 14px;
	background: #f5f7fa;
	border-bottom: 1px solid #ebeef5;
}
.sp-items {
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.sp-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 14px;
	background: #fff;
	border: 1px solid #ebeef5;
	border-radius: 8px;
	gap: 12px;
	transition: box-shadow 0.2s;
}
.sp-item:hover {
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.sp-item-info {
	display: flex;
	align-items: center;
	gap: 10px;
	flex: 1;
	min-width: 0;
}
.sp-item-img {
	width: 40px;
	height: 40px;
	border-radius: 6px;
	object-fit: cover;
	border: 1px solid #ebeef5;
	flex-shrink: 0;
}
.sp-item-meta {
	min-width: 0;
}
.sp-item-name {
	font-size: 13px;
	font-weight: 600;
	color: #303133;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 260px;
}
.sp-item-sub {
	font-size: 11px;
	color: #909399;
	line-height: 1.6;
}
.sp-item-fields {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}

/* 独立视图切换组样式 - 进阶精美版 */
.view-mode-group {
	display: flex;
	align-items: center;
	background: linear-gradient(to right, #f8f9fa, #ffffff);
	padding: 3px 6px 3px 12px;
	border-radius: 6px;
	border: 1px solid #dcdfe6;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
	transition: all 0.2s ease;
}
.view-mode-group:hover {
	border-color: #c6e2ff;
	box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}
.view-mode-label {
	font-size: 13px;
	font-weight: 700;
	color: #303133;
	margin-right: 12px;
	display: flex;
	align-items: center;
}
.view-mode-label::before {
	content: "";
	display: inline-block;
	width: 4px;
	height: 14px;
	background-color: #409eff;
	border-radius: 2px;
	margin-right: 6px;
}
.view-mode-select :deep(.el-input__wrapper) {
	box-shadow: none !important;
	background-color: #f2f6fc;
	border-radius: 4px;
	padding: 0 10px;
	transition: background-color 0.2s;
}
.view-mode-select :deep(.el-input__inner) {
	font-weight: 600;
	color: #409eff;
	font-size: 13px;
}
.view-mode-select:hover :deep(.el-input__wrapper) {
	background-color: #ecf5ff;
}
.filter-divider {
	width: 1px;
	height: 20px;
	background-color: #e4e7ed;
	margin: 0 16px 0 8px;
}

/* 异常预警下拉高亮 */
.alert-filter-select :deep(.el-input__wrapper) {
	transition: all 0.2s;
}
.alert-filter-select.is-focus :deep(.el-input__wrapper),
.alert-filter-select :deep(.el-input__inner:not(:placeholder-shown)) {
	color: #f56c6c;
	font-weight: 600;
}

/* 仓库下拉分组标题样式 - 让分组更醒目 */
.el-select-group__title {
	font-size: 13px !important;
	font-weight: 700 !important;
	color: #1a56db !important;
	padding: 8px 20px 6px 14px !important;
	border-left: 4px solid #409eff !important;
	background: #d9ecff !important;
	margin: 0 !important;
	letter-spacing: 1px;
	line-height: 1.4 !important;
}
.el-select-group__wrap:not(:first-of-type) {
	margin-top: 4px !important;
	border-top: 1px solid #c6d9f1 !important;
}

.sync-auto-complete-summary {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-top: 6px;
	font-size: 12px;
	color: #606266;
}

.remark-preview-dialog {
	:deep(.el-dialog) {
		max-width: 96vw;
	}

	:deep(.el-dialog__body) {
		padding: 16px 20px 8px;
		background: #f7f8fb;
		max-height: calc(100vh - 150px);
		overflow-y: auto;
	}
}

.remark-preview-layout {
	display: grid;
	grid-template-columns: 430px minmax(0, 1fr);
	gap: 14px;
	min-height: 520px;
}

.remark-order-list {
	display: flex;
	flex-direction: column;
	gap: 7px;
	min-height: 96px;
	max-height: 150px;
	overflow-y: auto;
	padding-right: 2px;
}

.remark-order-option {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 9px 10px;
	border: 1px solid #e5e7ef;
	border-radius: 7px;
	background: #fff;
	cursor: pointer;
	transition:
		border-color 0.16s,
		background 0.16s;

	&:hover {
		border-color: #93c5fd;
		background: #f8fbff;
	}

	&.is-selected {
		border-color: #3b82f6;
		background: #eff6ff;
		box-shadow: inset 3px 0 0 #3b82f6;
	}

	> div:first-child {
		display: flex;
		align-items: baseline;
		gap: 7px;
		min-width: 0;
	}

	strong {
		color: #1f2d3d;
	}

	span,
	small {
		color: #7b8491;
		font-size: 12px;
	}

	small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}

.order-option-counts {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	flex: 0 0 auto;
}

.remark-order-context {
	margin-top: 10px;
	padding-top: 10px;
	border-top: 1px solid #edf0f5;
	min-height: 130px;
	max-height: 270px;
	overflow-y: auto;

	.remark-plan-option + .remark-plan-option {
		margin-top: 7px;
	}
}

.remark-preview-input,
.remark-preview-output {
	background: #fff;
	border: 1px solid #e5e7ef;
	border-radius: 8px;
	padding: 14px;
	min-width: 0;
}

.preview-section-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12px;
	font-weight: 700;
	color: #1f2d3d;
}

.preview-mode {
	margin-bottom: 12px;
}

.preview-help {
	margin-top: 8px;
	font-size: 12px;
	line-height: 1.6;
	color: #909399;
}

.plan-search-toolbar {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 72px;
	gap: 8px;
	align-items: center;
}

.plan-filter-line {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin: 8px 0 10px;
	color: #909399;
	font-size: 12px;

	span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}

.selected-plan-strip {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 10px;
	padding: 8px 10px;
	border: 1px solid #b3d8ff;
	border-radius: 6px;
	background: #ecf5ff;
	min-width: 0;

	div {
		min-width: 0;
	}

	span {
		margin-right: 6px;
		color: #606266;
		font-size: 12px;
	}

	strong {
		margin-right: 8px;
		color: #1f2d3d;
		font-weight: 700;
	}

	small {
		color: #606266;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}

.remark-plan-list {
	min-height: 288px;
	max-height: 330px;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding-right: 2px;
}

.remark-plan-option {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 88px;
	gap: 10px;
	padding: 9px;
	border: 1px solid #e5e7ef;
	border-radius: 8px;
	background: #fff;
	cursor: pointer;
	transition:
		border-color 0.16s,
		background 0.16s,
		box-shadow 0.16s;

	&:hover {
		border-color: #93c5fd;
		background: #f8fbff;
		box-shadow: 0 2px 8px rgba(64, 158, 255, 0.08);
	}

	&.is-selected {
		border-color: #3b82f6;
		background: #eff6ff;
		box-shadow: inset 3px 0 0 #3b82f6;
	}
}

.plan-option-main {
	display: flex;
	gap: 9px;
	min-width: 0;
}

.plan-option-cover {
	flex: 0 0 44px;
	width: 44px;
	height: 44px;
	border: 1px solid #edf0f5;
	border-radius: 6px;
	overflow: hidden;
	background: #f7f8fb;
	color: #a8abb2;
	font-size: 12px;
	display: flex;
	align-items: center;
	justify-content: center;

	:deep(.el-image) {
		width: 100%;
		height: 100%;
	}
}

.plan-option-info {
	min-width: 0;
}

.plan-option-title {
	font-size: 13px;
	font-weight: 700;
	color: #1f2d3d;
	line-height: 1.35;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.plan-option-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 4px 8px;
	margin-top: 4px;
	font-size: 12px;
	color: #606266;

	&.muted {
		color: #8a9099;
	}

	span {
		max-width: 148px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}

.plan-remark-snippet {
	margin-top: 6px;
	padding: 5px 7px;
	border-radius: 5px;
	background: #f8fafc;
	color: #8a9099;
	font-size: 12px;
	line-height: 1.4;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.remark-override-panel {
	margin-top: 10px;
	padding: 10px;
	border: 1px solid #f3d19e;
	border-radius: 8px;
	background: #fff8ed;
	min-width: 0;
}

.remark-override-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 8px;
	min-width: 0;

	.remark-override-title {
		min-width: 0;
		flex: 1 1 auto;
	}

	.remark-override-toggle {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		flex: 0 0 auto;
	}

	div {
		min-width: 0;
	}

	strong {
		display: block;
		color: #1f2d3d;
		font-size: 13px;
	}

	small {
		display: block;
		margin-top: 2px;
		color: #a16207;
		font-size: 12px;
		line-height: 1.45;
	}
}

.remark-override-body {
	display: flex;
	flex-direction: column;
	gap: 8px;

	:deep(.el-textarea__inner) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
		font-size: 12px;
		line-height: 1.55;
		min-height: 120px;
		max-height: 180px;
		box-sizing: border-box;
	}
}

.plan-option-side {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 6px;
	min-width: 0;
	font-size: 12px;
	color: #8a9099;

	span,
	strong {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		color: #1f2d3d;
	}
}

.plan-list-pager {
	display: flex;
	justify-content: center;
	padding-top: 8px;
}

.preview-actions {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-top: 8px;
	min-width: 0;
}

.preview-actions-toolbar {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
	min-width: 0;

	:deep(.el-button) {
		width: 100%;
		min-width: 0;
	}
}

.preview-actions--remark .preview-actions-toolbar {
	grid-template-columns: repeat(2, minmax(0, 1fr));
}

.preview-actions-primary {
	width: 100%;
}

.preview-result-body {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.preview-error-alert {
	:deep(.el-alert__content) {
		line-height: 1.6;
	}
}

.preview-summary-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
}

.preview-summary-card {
	min-width: 0;
	background: #f8fafc;
	border: 1px solid #edf0f5;
	border-radius: 6px;
	padding: 8px 10px;

	span {
		display: block;
		font-size: 12px;
		color: #8a9099;
		margin-bottom: 4px;
	}

	strong {
		display: block;
		font-size: 13px;
		color: #1f2d3d;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}

.preview-subtitle {
	font-weight: 700;
	color: #303133;
	font-size: 13px;
}

.preview-allocation-table {
	:deep(.el-table__cell) {
		padding: 6px 0;
	}
}

.preview-hash {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	font-size: 12px;
	color: #909399;

	code {
		flex: 1;
		min-width: 0;
		padding: 4px 6px;
		border-radius: 4px;
		background: #f4f6fb;
		color: #606266;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}

.preview-json-collapse {
	border-top: 1px solid #ebeef5;
}

@media (max-width: 1000px) {
	.remark-preview-layout {
		grid-template-columns: 1fr;
	}

	.preview-actions-toolbar {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

/* ======= Enterprise Exception Dialog Styles ======= */
.enterprise-dialog {
	:deep(.el-dialog__header) {
		background: #f8f9fc;
		border-bottom: 1px solid #ebeef5;
		margin-right: 0;
		padding: 16px 24px;
		.el-dialog__title {
			font-weight: 600;
			color: #1f2d3d;
			font-size: 16px;
		}
	}
	:deep(.el-dialog__body) {
		padding: 20px 24px;
		background: #ffffff;
	}
	:deep(.el-dialog__footer) {
		border-top: 1px solid #ebeef5;
		padding: 16px 24px;
		background: #fafafa;
	}
}

.exception-dialog-body {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

/* Global Settings */
.global-setting-panel {
	background: #fdfdfd;
	border: 1px solid #ebeef5;
	border-radius: 6px;
	padding: 16px 20px;
	transition: all 0.2s;

	&:hover {
		border-color: #dcdfe6;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	}

	.panel-header {
		display: flex;
		align-items: center;
		margin-bottom: 12px;

		.title {
			font-weight: 600;
			font-size: 14px;
			color: #1f2d3d;
		}
		.subtitle {
			font-size: 12px;
			color: #909399;
			margin-left: 8px;
		}
	}

	.panel-body {
		display: flex;
		gap: 16px;

		.type-select {
			width: 180px;
		}
		.reason-input {
			flex: 1;
		}
	}
}

/* List Container */
.product-list-container {
	max-height: 460px;
	overflow-y: auto;
	padding-right: 6px;
	border-radius: 6px;
	border: 1px solid #ebeef5;
	background: #fafafa;
	padding: 12px;

	&::-webkit-scrollbar {
		width: 6px;
	}
	&::-webkit-scrollbar-track {
		background: transparent;
	}
	&::-webkit-scrollbar-thumb {
		background: #dcdfe6;
		border-radius: 4px;
	}
	&::-webkit-scrollbar-thumb:hover {
		background: #c0c4cc;
	}
}

/* Group Wrapper */
.order-group-wrapper {
	margin-bottom: 20px;
	background: #ffffff;
	border: 1px solid #ebeef5;
	border-radius: 8px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
	overflow: hidden;

	&:last-child {
		margin-bottom: 0;
	}
}

/* Group Header */
.order-group-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px 16px;
	background: #f8f9fc;
	border-bottom: 1px solid #ebeef5;

	.order-id {
		font-size: 14px;
		display: flex;
		align-items: center;
		.label {
			color: #909399;
			margin-right: 6px;
		}
		.value {
			color: #1f2d3d;
			font-weight: 600;
			font-family: monospace;
			font-size: 15px;
		}
	}

	.order-meta {
		font-size: 12px;
		color: #606266;
		display: flex;
		align-items: center;
		.dot {
			margin: 0 8px;
			color: #c0c4cc;
		}
	}
}

/* Order Group Items Container */
.order-group-items {
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 16px;
	background: #fff;
}

/* Product Item Row */
.product-item-row {
	background: #ffffff;
	border: 1px solid #ebeef5;
	border-radius: 6px;
	padding: 18px 20px;
	display: flex;
	gap: 16px;
	transition: all 0.2s;

	&:hover {
		border-color: #dcdfe6;
	}

	&.is-checked {
		border-color: #c6e2ff;
		background: #f5f9ff;

		.product-info-block {
			opacity: 1;
		}
	}
	&:not(.is-checked) {
		.product-info-block {
			opacity: 0.6;
		}
	}

	.row-checkbox {
		padding-top: 14px;
	}

	.row-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	/* Upper Block: Info */
	.product-info-block {
		display: flex;
		gap: 20px;
		transition: opacity 0.2s;

		.product-cover {
			width: 54px;
			height: 54px;
			border-radius: 6px;
			border: 1px solid #ebeef5;
			background: #f8f9fc;
			flex-shrink: 0;
			overflow: hidden;

			.img {
				width: 100%;
				height: 100%;
				cursor: pointer;
			}
			.img-placeholder {
				width: 100%;
				height: 100%;
				display: flex;
				align-items: center;
				justify-content: center;
				color: #c0c4cc;
				font-size: 20px;
			}
		}

		.product-details {
			flex: 1;
			min-width: 0;
			display: flex;
			flex-direction: column;
			justify-content: center;

			.name {
				font-size: 15px;
				font-weight: 500;
				color: #303133;
				margin-bottom: 8px;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.identifiers {
				display: flex;
				align-items: center;
				font-size: 12px;
				color: #606266;

				.divider {
					width: 1px;
					height: 10px;
					background: #dcdfe6;
					margin: 0 8px;
				}
			}
		}

		.financial-block {
			display: flex;
			flex-direction: column;
			gap: 4px;
			align-items: flex-end;
			min-width: 90px;

			.fin-stat {
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 13px;

				.fin-label {
					color: #909399;
					font-size: 12px;
				}
				.fin-value {
					font-family: inherit;
					font-weight: 600;
					&.price {
						color: #f56c6c;
					}
					&.qty {
						color: #303133;
					}
				}
			}
		}

		.refs-block {
			display: flex;
			flex-direction: column;
			gap: 6px;
			align-items: flex-end;
			justify-content: center;
			min-width: 150px;
			margin-left: 20px;
			padding-left: 20px;
			border-left: 1px solid #ebeef5;

			.ref-item {
				font-size: 12px;
				color: #606266;
				background: #f4f4f5;
				padding: 4px 8px;
				border-radius: 4px;
				.label {
					color: #909399;
				}
			}
		}
	}

	/* Lower Block: Action Inputs */
	.action-input-block {
		padding-top: 14px;
		border-top: 1px dashed #ebeef5;
		margin-top: 2px;

		.input-inner-wrap {
			display: flex;
			gap: 16px;

			.row-select {
				width: 160px;
			}
			.row-input {
				flex: 1;
			}

			/* Subtle inner styling for un-focused stat */
			:deep(.el-input__wrapper) {
				background: #fdfdfd;
			}
		}
	}
}

/* Footer Custom Block */
.dialog-footer-custom {
	display: flex;
	justify-content: space-between;
	align-items: center;

	.selection-stats {
		font-size: 13px;
		color: #606266;

		.highlight-count {
			font-weight: 600;
			color: #409eff;
			font-size: 14px;
			padding: 0 4px;
		}
	}

	.actions {
		display: flex;
		gap: 12px;

		.btn-cancel {
			border-radius: 4px;
			padding: 8px 20px;
		}
		.btn-submit {
			border-radius: 4px;
			padding: 8px 24px;
			font-weight: 500;
		}
	}
}
</style>

<!-- 非 scoped 样式：处理 teleported 到 body 的 alpha popover 面板 -->
<style>
.alpha-config-panel {
	padding: 4px 0;
}
.alpha-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;
}
.alpha-title {
	font-size: 14px;
	font-weight: 700;
	color: #303133;
}
.alpha-slider-row {
	display: flex;
	align-items: center;
	gap: 4px;
	margin-bottom: 4px;
}
.alpha-range-labels {
	display: flex;
	justify-content: space-between;
	font-size: 11px;
	color: #909399;
	margin-bottom: 12px;
}
.alpha-actions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}
</style>
