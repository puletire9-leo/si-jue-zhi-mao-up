<template>
	<cl-crud ref="Crud">
		<cl-row>
			<el-button @click="refreshListingTable">
				<el-icon><refresh /></el-icon>
				刷新
			</el-button>
			<cl-add-btn />
			<el-button type="danger" :disabled="selectedListingCount === 0" @click="deleteSelectedListings">
				批量删除
			</el-button>

			<el-button type="primary" @click="openBatchStagingDialog">
				批量暂存
			</el-button> 

			<el-button
				type="success"
				:disabled="selectedListingCount === 0 || batchReplenishPlanSyncing"
				:loading="batchReplenishPlanSyncing"
				@click="openBatchReplenishDialog"
			>
				批量补货{{ selectedListingCount ? ` (${selectedListingCount})` : "" }}
			</el-button>

			<el-dropdown trigger="click">
				<el-button type="warning">
					补货设置<el-icon class="el-icon--right"><arrow-down /></el-icon>
				</el-button>
				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item @click="handleSelectedRestockSetting('no_restock')">不再补货</el-dropdown-item>
						<el-dropdown-item @click="handleSelectedRestockSetting('future_restock')">设置未来补货数</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>

			<!-- <el-button @click="fetchTaskStatus()" type="primary">刷新任务状态</el-button> -->

			<!-- <el-button
				@click="bzyShiTu()"
				type="success"
				:disabled="isBzyTaskRunning"
				:loading="isBzyTaskRunning"
			>
				<template v-if="isBzyTaskRunning">八爪鱼识图中...</template>
				<template v-else-if="lastBzyTaskStatus === 'Finished'">八爪鱼识图(已完成)</template>
				<template v-else-if="lastBzyTaskStatus === 'Failed'">八爪鱼识图(失败)</template>
				<template v-else>八爪鱼识图</template>
			</el-button> -->

			<!-- <el-button
				@click="searchByItemName()"
				type="success"
				:disabled="isSearchTaskRunning"
				:loading="isSearchTaskRunning"
			>
				<template v-if="isSearchTaskRunning">搜索中...</template>
				<template v-else-if="lastSearchTaskStatus === 'Finished'">搜索(已完成)</template>
				<template v-else-if="lastSearchTaskStatus === 'Failed'">搜索(失败)</template>
				<template v-else>获取搜索页数据</template>
			</el-button> -->

			<!-- <el-button
				@click="manualDeduplicate()"
				type="warning"
				:disabled="isManualDeduplicateRunning"
				:loading="isManualDeduplicateRunning"
			>
				<template v-if="isManualDeduplicateRunning">去重中...</template>
				<template v-else>手动去重</template>
			</el-button>

			<el-button @click="aliyunImageUpload()" type="success">阿里云图片上传</el-button>

			<el-button
				@click="aliyunImageSearch()"
				type="success"
				:disabled="isAliyunTaskRunning"
				:loading="isAliyunTaskRunning"
			>
				<template v-if="isAliyunTaskRunning">对比中...</template>
				<template v-else-if="lastAliyunTaskStatus === 'Finished'">对比(已完成)</template>
				<template v-else-if="lastAliyunTaskStatus === 'Failed'">对比(失败)</template>
				<template v-else>阿里云图片对比</template>
			</el-button> -->

			<!-- <el-button type="warning" @click="batchUpdateCompetitorDetails">获取竞品详情</el-button> -->
			<!-- <el-button @click="handleMergeId" type="primary">合并编号</el-button> -->
			<el-button @click="requestLingXingListing" type="primary">获取数据</el-button>
			<el-button @click="requestLingXingShipmentStatus" type="primary">
				更新在途状态-修改测试字段
			</el-button>
			<!-- <el-button @click="updateInventoryStatus" type="primary"> 更新库存状态 </el-button> -->
			<el-button @click="syncRealtimeSales" type="primary"> 更新实时销量 </el-button>
 
			<el-select
				v-model="filters.marketplace"
				placeholder="站点"
				style="width: 120px; margin-left: 10px"
				@change="handleFilterChange('marketplace', $event)"
				multiple
				collapse-tags
				clearable
			>
				<el-option
					v-for="item in marketplaceOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>

			<el-select
				v-model="filters.seller_name"
				placeholder="店铺"
				style="width: 120px; margin-left: 10px"
				@change="handleFilterChange('seller_name', $event)"
				multiple
				collapse-tags
				clearable
			>
				<el-option
					v-for="item in storeOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>

			

			<el-select
				v-model="filters.combinedStatus"
				placeholder="产品状态"
				style="width: 120px; margin-left: 10px"
				clearable
				@change="handleCombinedStatusChange"
			>
				<el-option label="正常" value="normal" />
				<el-option label="断货" value="outOfStock" />
				<el-option label="异常下架" value="abnormalOffline" />
			</el-select>

			<!-- <el-select
				v-model="filters.newProductStatus"
				placeholder="新品状态"
				style="width: 150px; margin-left: 10px"
				clearable
				@change="handleFilterChange('newProductStatus', $event)"
			>
				<el-option
					v-for="item in newProductStatusOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select> -->

			<!-- <el-select
				v-model="filters.inventoryStatusText"
				placeholder="库存状态"
				style="width: 120px; margin-left: 10px"
				clearable
				@change="handleFilterChange('inventoryStatusText', $event)"
			>
				<el-option label="库存<10天" value="库存<10天" />
				<el-option label="库存<20天" value="库存<20天" />
				<el-option label="库存<30天" value="库存<30天" />
				<el-option label="库存<45天" value="库存<45天" />
				<el-option label="库存<60天" value="库存<60天" />
				<el-option label="库存>90天" value="库存>90天" />
			</el-select> -->

			<!-- 2025-01-16: 弃用 -->
			<!-- <el-select
				v-model="filters.needUpdateOperationPlan"
				placeholder="是否采发"
				style="width: 120px; margin-left: 10px"
				clearable
				@change="handleFilterChange('needUpdateOperationPlan', $event)"
			>
				<el-option
					v-for="item in needUpdateOperationPlanOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select> -->

			<el-select
				v-model="filters.trafficCombined"
				placeholder="流量"
				style="width: 150px; margin-left: 10px"
				clearable
				@change="handleTrafficFilterChange"
			>
				<el-option
					v-for="item in trafficFilterOptions"
					:key="item.value === undefined ? 'all' : item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>

			<!-- 2026-04-23: 新增日均销量变化状态筛选 -->
			<el-select
				v-model="filters.salesChangeStatus"
				placeholder="销量变化状态"
				style="width: 150px; margin-left: 10px"
				clearable
				@change="handleFilterChange('salesChangeStatus', $event)"
			>
				<el-option
					v-for="item in salesChangeStatusOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>

			<!-- 可售天数筛选 -->
			<!-- 2026-04-03: 修改可售天数筛选的触发方式，去掉 select 的 change 事件，添加 input 的 blur 和 keyup.enter -->
			<el-select
				v-model="filters.sellableDaysCondition"
				placeholder="可售天数类型"
				style="width: 160px; margin-left: 10px"
				clearable
				@clear="handleSellableDaysFilterChange"
			>
				<!-- 原代码: @change="handleSellableDaysFilterChange" -->
				<el-option label="总可售天数 >" value="total_gt" />
				<el-option label="总可售天数 <" value="total_lt" />
				<el-option label="FBA可售天数 >" value="fba_gt" />
				<el-option label="FBA可售天数 <" value="fba_lt" />
			</el-select>
			<el-input
				v-model="filters.sellableDaysValue"
				placeholder="天数"
				style="width: 80px; margin-left: 5px"
				type="number"
				@blur="handleSellableDaysFilterChange"
				@keyup.enter="handleSellableDaysFilterChange"
				@clear="handleSellableDaysFilterChange"
				clearable
			/>
			<!-- 原代码: @input="handleSellableDaysValueInput" -->
			<el-select
				v-model="filters.stockoutRiskFilter"
				placeholder="断货风险"
				style="width: 120px; margin-left: 10px"
				@change="handleSellableDaysFilterChange"
			>
				<el-option label="全部数据" value="all" />
				<el-option label="断" value="risk" />
				<el-option label="非断" value="safe" />
			</el-select>

			<!-- 2025-01-16: 弃用 -->
			<!-- <el-select
				v-model="filters.stockOver90Days"
				placeholder="库存>90天"
				style="width: 120px; margin-left: 10px"
				clearable
				@change="handleFilterChange('stockOver90Days', $event)"
			>
				<el-option
					v-for="item in stockOver90DaysOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select> -->

			<cl-flex1 />
			<!-- 2026-03-28: 支持按指定字段批量搜索 -->
			<cl-search-key
				ref="searchKey"
				v-model="searchKeywordInput"
				:field="searchField"
				:width="320"
				placeholder="多个值请用换行/逗号/分号分隔"
				:field-list="searchFieldOptions"
				:on-search="handleBatchSearch"
				@field-change="handleSearchFieldChange"
			/>
		</cl-row>

		<cl-row v-if="bzyTaskProgress || searchTaskProgress || aliyunTaskProgress">
			<el-text v-if="bzyTaskProgress" type="info" style="margin-right: 15px">{{
				bzyTaskProgress
			}}</el-text>
			<el-text v-if="searchTaskProgress" type="info" style="margin-right: 15px">{{
				searchTaskProgress
			}}</el-text>
			<el-text v-if="aliyunTaskProgress" type="info">{{ aliyunTaskProgress }}</el-text>
		</cl-row>

		<cl-row>
			<!-- 数据表格 -->
			<cl-table
				ref="Table"
				row-key="_selectionKey"
				:row-class-name="getListingRowClassName"
				:cell-class-name="getListingCellClassName"
				@selection-change="handleListingSelectionChange"
				@sort-change="handleTableSortChange"
				@row-click="handleListingParentRowClick"
			>
				<template #column-asin="{ scope }">
					<strong
						v-if="isLingxingParentAggregate(scope.row)"
						class="lingxing-parent-asin"
						:title="isListingParentExpanded(scope.row) ? '收起子体' : '展开子体'"
					>
						{{ scope.row.parent_asin }}
					</strong>
					<el-link
						v-else
						target="_blank"
						:underline="false"
						:href="getAmazonDpUrl(scope.row.asin, scope.row.marketplace)"
					>
						{{ scope.row.asin }}
					</el-link>
				</template>
				<template #column-image_url_display="{ scope }">
					<el-popover
						placement="right"
						trigger="hover"
						:width="300"
						@show="boostProductImages(scope.row)"
					>
						<template #reference>
							<resilient-product-image
								:src="scope.row.image_url_display"
								width="50px"
								height="50px"
								fit="contain"
								priority="visible"
								class="listing-product-image"
								@mouseenter="boostProductImages(scope.row)"
							/>
						</template>
						<template #default>
							<resilient-product-image
								:src="scope.row.image_url_display"
								width="280px"
								height="280px"
								fit="contain"
								priority="hover"
							/>
						</template>
					</el-popover>
				</template>

				<template #column-msku_fnsku="{ scope }">
					<div>{{ scope.row.msku }}</div>
					<div style="font-size: 12px; color: #909399">{{ scope.row.fnsku }}</div>
				</template>

				<template #column-amz_product_id_combined="{ scope }">
					<div>{{ scope.row.amz_product_id }}</div>
					<div style="font-size: 12px; color: #909399">
						{{ scope.row.amz_product_id_type_text }}
					</div>
				</template>

				<template #column-temp_stored_total="{ scope }">
					<el-popover
						v-if="
							scope.row.temp_stored_details &&
							scope.row.temp_stored_details.length > 0
						"
						placement="top"
						:width="380"
						trigger="hover"
						:show-after="200"
						:hide-after="100"
					>
						<template #reference>
							<span
								style="
									cursor: pointer;
									border-bottom: 1px dashed #409eff;
									color: #409eff;
									font-weight: 600;
								"
							>
								{{ scope.row.temp_stored_total }}
							</span>
						</template>
						<!-- 合计头部 -->
						<div
							style="
								padding: 6px 8px;
								background: #f5f7fa;
								border-bottom: 1px solid #ebeef5;
								font-weight: 700;
								font-size: 14px;
								display: flex;
								justify-content: space-between;
								align-items: center;
								border-radius: 4px 4px 0 0;
							"
						>
							<span>合计 {{ scope.row.temp_stored_total }} 件</span>
							<span style="font-weight: 400; font-size: 12px; color: #909399"
								>{{ scope.row.temp_stored_details.length }} 条记录</span
							>
						</div>
						<!-- 记录列表 -->
						<div style="max-height: 300px; overflow-y: auto">
							<div
								v-for="(item, idx) in scope.row.temp_stored_details"
								:key="item.id"
								:style="{
									padding: '8px',
									borderBottom:
										idx < scope.row.temp_stored_details.length - 1
											? '1px solid #ebeef5'
											: 'none'
								}"
							>
								<!-- 第一行: 状态标签 + 件数 + 时间 + 删除 -->
								<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px">
									<div style="display: flex; align-items: center; gap: 8px">
										<el-tag :type="item.status === 0 ? 'success' : 'info'" size="small" effect="plain">{{ item.status_text }}</el-tag>
										<span style="font-weight: 700; font-size: 14px">{{ item.final_qty }} 件</span>
									</div>
									<div style="display: flex; align-items: center; gap: 8px">
										<span style="font-size: 12px; color: #909399">{{ item.create_time_short }}</span>
										<el-link type="danger" :underline="false" style="font-size: 12px" @click.stop="deleteTempStoredRecord(item.id, scope.row)">删除</el-link>
									</div>
								</div>
								<!-- 第二行: 日期范围 · 日均 · 系数 -->
								<div style="font-size: 12px; color: #606266">
									{{ item.start_date_short }} ~ {{ item.end_date_short }} ({{ item.total_days }}天)
									· 日均{{ item.daily_avg }}
									· 系数{{ item.coefficient }}
								</div>
								<!-- 第三行: 备注(仅有时显示) -->
								<div v-if="item.manual_remark" style="font-size: 12px; color: #909399; margin-top: 2px">
									备注: {{ item.manual_remark }}
								</div>
							</div>
						</div>
					</el-popover>
					<span v-else>{{ scope.row.temp_stored_total || 0 }}</span>
				</template>

				<template #column-local_combined="{ scope }">
					<div style="font-weight: bold">{{ scope.row.local_name }}</div>
					<div style="font-size: 12px; color: #909399">{{ scope.row.local_sku }}</div>
				</template>

				<template #column-rank_combined="{ scope }">
					<div style="font-size: 12px; word-break: break-all">
						{{
							Array.isArray(scope.row.rank)
								? scope.row.rank.join(", ")
								: scope.row.rank
						}}
					</div>
					<div style="font-size: 12px; color: #909399" v-if="scope.row.seller_category">
						{{ scope.row.seller_category.join(" > ") }}
					</div>
				</template>

				<template #column-status="{ scope }">
					<div v-if="isLingxingParentAggregate(scope.row)" class="lingxing-parent-marketplace">
						<el-tag
							v-if="scope.row.marketplace"
							size="small"
							effect="dark"
							:color="getMarketplaceColor(scope.row.marketplace)"
							style="border: none"
							disable-transitions
						>
							{{ getMarketplaceShortName(scope.row.marketplace) }}
						</el-tag>
						<span v-else>-</span>
					</div>
					<div v-else class="asin-cell">
						<div class="asin-badges">
							<!-- 2026-01-30: Display country tag -->
							<el-tag
								v-if="scope.row.marketplace"
								size="small"
								effect="dark"
								:color="getMarketplaceColor(scope.row.marketplace)"
								style="border: none; margin-right: 4px"
								disable-transitions
							>
								{{ getMarketplaceShortName(scope.row.marketplace) }}
							</el-tag>
							<el-tag
								size="small"
								:type="scope.row.status === 1 ? 'success' : 'danger'"
								effect="dark"
								disable-transitions
							>
								{{
									scope.row.status === 1
										? "售"
										: scope.row.abnormalOfflineStatus === 1
											? "异"
											: "断"
								}}
							</el-tag>

							<el-tag
								v-if="scope.row.newProductStatus === 1"
								size="small"
								type="success"
								effect="plain"
								disable-transitions
							>
								{{ scope.row.in_transit_type === 1 ? '新在1' : scope.row.in_transit_type === 2 ? '新在2' : scope.row.in_transit_type === 3 ? '新在双' : '新在' }}
							</el-tag>
							<el-tag
								v-else-if="scope.row.newProductStatus === 2"
								size="small"
								type="warning"
								effect="plain"
								disable-transitions
							>
								新无
							</el-tag>
							<el-tag
								v-else-if="scope.row.newProductStatus === 3"
								size="small"
								type="warning"
								effect="plain"
								disable-transitions
							>
								老&gt;7
							</el-tag>
							<el-tag
								v-else-if="scope.row.newProductStatus === 4"
								size="small"
								type="warning"
								effect="plain"
								disable-transitions
							>
								老&gt;14
							</el-tag>
							<el-tag
								v-else-if="scope.row.newProductStatus === 5"
								size="small"
								type="warning"
								effect="plain"
								disable-transitions
							>
								老&gt;30
							</el-tag>

							<!-- <el-tag
								size="small"
								:type="scope.row.needUpdateOperationPlan === 1 ? 'danger' : 'info'"
								effect="dark"
								disable-transitions
							>
								采发
							</el-tag> -->

							<el-tag
								v-if="scope.row.categoryTrafficStatus === 2"
								size="small"
								type="success"
								effect="plain"
								disable-transitions
							>
								类↑
							</el-tag>
							<el-tag
								v-else-if="scope.row.categoryTrafficStatus === 1"
								size="small"
								type="danger"
								effect="plain"
								disable-transitions
							>
								类↓
							</el-tag>

							<el-tag
								v-if="scope.row.productTrafficStatus === 2"
								size="small"
								type="success"
								effect="plain"
								disable-transitions
							>
								节↑
							</el-tag>
							<el-tag
								v-else-if="scope.row.productTrafficStatus === 1"
								size="small"
								type="danger"
								effect="plain"
								disable-transitions
							>
								节↓
							</el-tag>

							<!-- 2025-01-16: 弃用 -->
							<!-- <el-tag
								size="small"
								:type="scope.row.stockOver90Days === 1 ? 'danger' : 'info'"
								effect="dark"
								disable-transitions
							>
								{{ scope.row.stockOver90Days === 1 ? "库>90天" : "库<90天" }}
							</el-tag> -->

							<!-- 新库存状态标签 -->
							<!-- <el-tag
								v-if="scope.row.inventoryStatusText"
								size="small"
								:type="
									scope.row.inventoryStatusText.includes('>90') ||
									scope.row.inventoryStatusText.includes('<10') ||
									scope.row.inventoryStatusText.includes('<20')
										? 'danger'
										: 'warning'
								"
								effect="dark"
								disable-transitions
							>
								{{ scope.row.inventoryStatusText }}
							</el-tag> -->

							<!-- 采购计划标签（近3天） -->
							<el-popover
								v-if="scope.row.purchase_plan_details && getRecentPurchasePlans(scope.row.purchase_plan_details, 3).length > 0"
								placement="right"
								:width="700"
								trigger="hover"
							>
								<template #reference>
									<el-tag
										size="small"
										type="warning"
										effect="dark"
										disable-transitions
										style="margin-left: 4px; cursor: pointer"
									>
										采{{ getRecentPurchasePlans(scope.row.purchase_plan_details, 3).length }}
									</el-tag>
								</template>
								<div style="max-height: 350px; overflow-y: auto;">
									<el-table 
										:data="getRecentPurchasePlans(scope.row.purchase_plan_details, 3)" 
										size="small" 
										border
										:show-summary="getRecentPurchasePlans(scope.row.purchase_plan_details, 3).length > 1"
									:summary-method="(param) => {
										const { columns, data } = param;
										const sums: string[] = [];
										columns.forEach((column, index) => {
											if (index === 0) {
												sums[index] = '合计';
												return;
											}
											if (column.property === 'quantity_plan') {
												const values = data.map(item => Number(item[column.property]));
												if (!values.every(value => isNaN(value))) {
													sums[index] = values.reduce((prev, curr) => {
														const value = Number(curr);
														if (!isNaN(value)) {
															return prev + curr;
														} else {
															return prev;
														}
													}, 0) + '';
												} else {
													sums[index] = 'N/A';
												}
											} else {
												sums[index] = '';
											}
										});
										return sums;
									}"
								>
									<el-table-column prop="plan_sn" label="计划编号" min-width="130" />
									<el-table-column label="来源" min-width="66">
										<template #default="{ row: detail }">
											<el-tag size="small" :type="getSourceTagType(detail)" effect="light">
												{{ getSourceLabel(detail) }}
											</el-tag>
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
								</div>
							</el-popover>

						</div>
					</div>
				</template>

				<template #column-shop="{ scope }">
					<span v-if="isLingxingParentAggregate(scope.row)" class="lingxing-parent-shop">
						{{ scope.row.shop || scope.row.seller_name || "-" }}
					</span>
					<span v-else>{{ scope.row.shop || scope.row.seller_name || "-" }}</span>
				</template>

				<template #column-variant_text="{ scope }">
					<el-tooltip
						placement="top"
						v-if="scope.row.variant_text && scope.row.variant_text.length > 0"
					>
						<template #content>
							<div
								v-for="(item, index) in typeof scope.row.variant_text === 'string'
									? JSON.parse(scope.row.variant_text)
									: scope.row.variant_text"
								:key="index"
							>
								{{ item.attr_name }}: {{ item.attr_value }}
							</div>
						</template>
						<span>
							{{
								(typeof scope.row.variant_text === "string"
									? JSON.parse(scope.row.variant_text)
									: scope.row.variant_text
								)
									.map((item) => item.attr_value)
									.join(", ")
							}}
						</span>
					</el-tooltip>
					<span v-else>-</span>
				</template>

				<template #column-small_rank="{ scope }">
					<div style="font-size: 12px; word-break: break-all">
						{{
							Array.isArray(scope.row.small_rank)
								? scope.row.small_rank.join(", ")
								: scope.row.small_rank
						}}
					</div>
				</template>

				<template #column-rating_combined="{ scope }">
					<div style="font-size: 12px; word-break: break-all">
						{{
							Array.isArray(scope.row.stars)
								? scope.row.stars.join(", ")
								: scope.row.stars
						}}
					</div>
					<div style="font-size: 12px; color: #909399; word-break: break-all">
						{{
							Array.isArray(scope.row.reviews_num)
								? scope.row.reviews_num.join(", ")
								: scope.row.reviews_num
						}}
					</div>
				</template>
 
				<template #column-listing_price="{ scope }">
					<el-tooltip
						v-if="getListingPriceHistory(scope.row).length > 0"
						placement="top"
						effect="light"
					>
						<template #content>
							<div
								v-for="(item, index) in getListingPriceHistory(scope.row)"
								:key="`${scope.row.id || scope.row.asin}-${index}`"
								style="font-size: 12px; line-height: 20px"
							>
								{{ getPriceHistoryLabel(index) }}：{{
									formatListingPriceValue(item)
								}}
							</div>
						</template>
						<span style="cursor: help">
							{{ formatListingPriceValue(scope.row.listing_price) }}
						</span>
					</el-tooltip>
					<span v-else>{{ formatListingPriceValue(scope.row.listing_price) }}</span>
				</template>

				<template #column-profit_combined="{ scope }">
					<div
						v-if="scope.row.profit_rate !== undefined && scope.row.profit_rate !== null"
					>
						{{ (scope.row.profit_rate * 100).toFixed(2) }}%
					</div>
					<!-- 2026-01-31: Hidden as per request
					<div
						v-if="scope.row.profit !== undefined && scope.row.profit !== null"
						style="font-size: 12px; color: #909399"
					>
						{{ scope.row.currency_symbol }}{{ scope.row.profit }}
					</div>
					-->
					<div
						v-if="
							scope.row.profit_rate === undefined || scope.row.profit_rate === null
							// && (scope.row.profit === undefined || scope.row.profit === null)
						"
					>
						-
					</div>
				</template>

				<!-- dailyAvgSales2 removed -->

				<template #column-delivery_purchase_combined="{ scope }">
					<div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
						<el-popover
							v-if="getPendingDeliveryDisplayDetails(scope.row).length > 0"
							placement="bottom"
							:width="700"
							trigger="hover"
						>
							<template #reference>
								<span style="cursor: pointer; color: #409eff; font-weight: 500;">
									{{ getPendingDeliveryDisplayQty(scope.row) }}
								</span>
							</template>
							<div style="max-height: 350px; overflow-y: auto;">
								<el-table 
									:data="getPendingDeliveryDisplayDetails(scope.row)"
									size="small"
									border
									:show-summary="getPendingDeliveryDisplayDetails(scope.row).length > 1"
								:summary-method="(param) => {
									const { columns, data } = param;
									const sums: string[] = [];
									columns.forEach((column, index) => {
										if (index === 0) {
											sums[index] = '合计';
											return;
										}
										if (column.property === 'quantity') {
											const values = data.map(item => Number(item[column.property]));
											if (!values.every(value => isNaN(value))) {
												sums[index] = values.reduce((prev, curr) => {
													const value = Number(curr);
													if (!isNaN(value)) {
														return prev + curr;
													} else {
														return prev;
													}
												}, 0) + '';
											} else {
												sums[index] = 'N/A';
											}
										} else {
											sums[index] = '';
										}
									});
									return sums;
								}"
							>
								<el-table-column prop="order_sn" label="采购单号" min-width="130" />
								<el-table-column label="来源" min-width="66">
									<template #default="{ row: detail }">
										<el-tag size="small" :type="getSourceTagType(detail)" effect="light">
											{{ getSourceLabel(detail) }}
										</el-tag>
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
							</div>
						</el-popover>
						<span v-else>{{ getPendingDeliveryDisplayQty(scope.row) }}</span>
						<span style="color: #dcdfe6; margin: 0 1px;">/</span>
					<el-popover
						v-if="scope.row.purchase_plan_details && scope.row.purchase_plan_details.length > 0"
						placement="bottom"
						:width="700"
						trigger="hover"
					>
						<template #reference>
							<span style="cursor: pointer; color: #e6a23c; font-weight: 500;">
								{{ scope.row.purchase_plan_qty ?? 0 }}
							</span>
						</template>
						<div style="max-height: 350px; overflow-y: auto;">
							<el-table 
								:data="scope.row.purchase_plan_details" 
								size="small" 
								border
								:show-summary="scope.row.purchase_plan_details.length > 1"
							:summary-method="(param) => {
								const { columns, data } = param;
								const sums: string[] = [];
								columns.forEach((column, index) => {
									if (index === 0) {
										sums[index] = '合计';
										return;
									}
									if (column.property === 'quantity_plan') {
										const values = data.map(item => Number(item[column.property]));
										if (!values.every(value => isNaN(value))) {
											sums[index] = values.reduce((prev, curr) => {
												const value = Number(curr);
												if (!isNaN(value)) {
													return prev + curr;
												} else {
													return prev;
												}
											}, 0) + '';
										} else {
											sums[index] = 'N/A';
										}
									} else {
										sums[index] = '';
									}
								});
								return sums;
							}"
						>
							<el-table-column prop="plan_sn" label="计划编号" min-width="130" />
							<el-table-column label="来源" min-width="66">
								<template #default="{ row: detail }">
									<el-tag size="small" :type="getSourceTagType(detail)" effect="light">
										{{ getSourceLabel(detail) }}
									</el-tag>
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
					</div>
					</el-popover>
					<span v-else style="color: #909399;">{{ scope.row.purchase_plan_qty ?? 0 }}</span>
					</div>
				</template>

				<template #column-restocking_sales_avg="{ scope }">
					<el-tooltip v-if="scope.row.restocking?.salesInfo" placement="top">
						<template #content>
							{{ scope.row.restocking.salesInfo.salesAvg3 || 0 }}/{{
								scope.row.restocking.salesInfo.salesAvg7 || 0
							}}/{{ scope.row.restocking.salesInfo.salesAvg14 || 0 }}
						</template>
						<span style="cursor: help">
							{{ scope.row.restocking.salesInfo.salesAvg3 || 0 }}/{{
								scope.row.restocking.salesInfo.salesAvg7 || 0
							}}/{{ scope.row.restocking.salesInfo.salesAvg14 || 0 }}
						</span>
					</el-tooltip>
					<span v-else>-</span>
				</template>

				<template #column-restocking_sales_total="{ scope }">
					<el-tooltip v-if="scope.row.restocking?.salesInfo" placement="top">
						<template #content>
							{{ scope.row.restocking.salesInfo.salesTotal3 || 0 }}/{{
								scope.row.restocking.salesInfo.salesTotal7 || 0
							}}/{{ scope.row.restocking.salesInfo.salesTotal14 || 0 }}
						</template>
						<span style="cursor: help">
							{{ scope.row.restocking.salesInfo.salesTotal3 || 0 }}/{{
								scope.row.restocking.salesInfo.salesTotal7 || 0
							}}/{{ scope.row.restocking.salesInfo.salesTotal14 || 0 }}
						</span>
					</el-tooltip>
					<span v-else>-</span>
				</template>

				<template #header-sellable_days_combined>
					<div
						style="
							display: flex;
							justify-content: center;
							align-items: center;
							gap: 4px;
						"
					>
						<span>可售天数(</span>
						<span
							style="cursor: pointer; color: #409eff; user-select: none"
							@click.stop="onSort('totalSellableDaysSort')"
						>
							总{{ getSortIndicator("totalSellableDaysSort") }}
						</span>
						<span style="color: #dcdfe6">/</span>
						<span
							style="cursor: pointer; color: #409eff; user-select: none"
							@click.stop="onSort('fbaSellableDaysSort')"
						>
							FBA{{ getSortIndicator("fbaSellableDaysSort") }}
						</span>
						<span>)</span>
					</div>
				</template>

				<template #header-dailyAvgSales>
					<div
						style="
							display: flex;
							justify-content: center;
							align-items: center;
							gap: 4px;
							cursor: pointer;
							color: #409eff;
							user-select: none;
						"
						@click.stop="onSort('dailyAvgSales')"
					>
						<span>日均销量</span>
						<span>{{ getSortIndicator("dailyAvgSales") }}</span>
					</div>
				</template>

				<template #header-inventory_details="{ column }">
					<div style="display: flex; justify-content: center; align-items: center; gap: 4px;"
							@click.stop="onSort('afn_fulfillable_quantity', 'desc')">
						<span
							style="cursor: pointer; transition: color 0.2s;"
							onmouseover="this.style.color='#409eff'"
							onmouseout="this.style.color=''"
							title="点击按FBA库存排序"
							@click.stop="onSort('afn_fulfillable_quantity')"
							>FBA</span
						>
						<span>{{ getSortIndicator("afn_fulfillable_quantity") }}</span>
						<span style="color: #dcdfe6">/</span>
						<span title="FBA预留库存">FBA预留</span>
						<span style="color: #dcdfe6">/</span>
						<span
							style="cursor: pointer; transition: color 0.2s;"
							onmouseover="this.style.color='#409eff'"
							onmouseout="this.style.color=''"
							title="点击按在途库存排序"
						>在途</span>
						<span style="color: #dcdfe6">/</span>
						<span
							style="cursor: pointer; transition: color 0.2s;"
							onmouseover="this.style.color='#409eff'"
							onmouseout="this.style.color=''"
							title="点击按本地库存排序"
						>本地</span>
					</div>
				</template>

				<template #column-inventory_details="{ scope }">
					<div
						v-if="isLingxingParentAggregate(scope.row)"
						class="lingxing-parent-inventory"
					>
						<span>{{ scope.row._summaryInventory?.fba ?? 0 }}</span>
						<i>/</i>
						<span>{{ scope.row._summaryInventory?.fbaReserved ?? 0 }}</span>
						<i>/</i>
						<span>{{ scope.row._summaryInventory?.inTransit ?? 0 }}</span>
						<i>/</i>
						<span>{{ scope.row._summaryInventory?.local ?? 0 }}</span>
					</div>
					<div v-else style="display: flex; justify-content: center; align-items: center; gap: 2px;">
						<el-tooltip placement="top" effect="light">
							<template #content>
								<div v-if="scope.row.restocking?.fbaValidList?.length">
									<el-table
										:data="scope.row.restocking.fbaValidList.filter((item: any) => !scope.row.msku || (item.msku ? item.msku === scope.row.msku : true))"
										size="small"
										border
										style="max-width: 950px"
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
										<el-table-column prop="amazonSaleDate" label="预计可售时间" min-width="160">
											<template #default="{ row: shipment }">
												<span>{{ shipment.amazonSaleDate }}</span>
												<el-tag v-if="isShipmentLate(scope.row, shipment)" type="danger" size="small" effect="dark" style="margin-left: 5px">断</el-tag>
											</template>
										</el-table-column>
									</el-table>
								</div>
								<div v-else>暂无FBA库存明细</div>
							</template>
							<span style="cursor: help; color: #409eff">
								{{ getFbaInventoryQuantity(scope.row) }}
							</span>
						</el-tooltip>
						<span style="color: #dcdfe6; margin: 0 2px;">/</span>
						<span title="FBA预留库存">
							{{ getFbaReservedQuantity(scope.row) }}
						</span>
						<span style="color: #dcdfe6; margin: 0 2px;">/</span>
						<el-tooltip placement="top" effect="light">
							<template #content>
								<div v-if="scope.row.restocking?.fbaShippingList?.length">
									<el-table
										:data="scope.row.restocking.fbaShippingList.filter((item: any) => !scope.row.msku || (item.msku ? item.msku === scope.row.msku : true))"
										size="small"
										border
										style="max-width: 950px"
									>
										<el-table-column prop="orderSn" label="货件单号" min-width="140">
											<template #default="{ row: shipment }">
												<span>{{ shipment.orderSn }}</span>
												<el-tag v-if="shipment.shipment_status === '断' || isShipmentLate(scope.row, shipment)" type="danger" size="small" effect="dark" style="margin-left: 5px">断</el-tag>
											</template>
										</el-table-column>
										<el-table-column prop="shippingOrderSn" label="发货单号" min-width="140" />
										<el-table-column prop="quantity" label="数量" min-width="80" />
										<el-table-column prop="logisticsChannelName" label="物流方式" min-width="140" />
										<el-table-column prop="shippingMethod" label="运输方式" min-width="120" />
										<el-table-column prop="shipmentTime" label="发货时间" min-width="160" />
										<el-table-column prop="amazonSaleDate" label="预计可售时间" min-width="160" />
									</el-table>
								</div>
								<div v-else>暂无在途货件</div>
							</template>
							<span style="cursor: help; color: #409eff">
								{{ getRestockingFbaShippingQuantity(scope.row) }}
								<el-tag v-if="hasStockoutRisk(scope.row)" type="danger" size="small" effect="dark" style="margin-left: 5px">断</el-tag>
							</span>
						</el-tooltip>
						<span style="color: #dcdfe6; margin: 0 2px;">/</span>
						<el-tooltip placement="top" effect="light">
							<template #content>
								<div v-if="scope.row.restocking?.extInfo?.localValidDetailList?.length">
									<el-table
										:data="scope.row.restocking.extInfo.localValidDetailList.filter((item: any) => !scope.row.msku || (item.sku ? item.sku === scope.row.msku : true))"
										size="small"
										border
										style="max-width: 950px"
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
								</div>
								<div v-else>暂无本地可用明细</div>
							</template>
							<span style="cursor: help; color: #409eff">
								{{ scope.row.restocking_local_valid ?? "-" }}
							</span>
						</el-tooltip>
					</div>
				</template>

				<template #column-yesterday_realtime_sales="{ scope }">
					<el-popover placement="top" width="auto" trigger="hover">
						<template #reference>
							<span style="cursor: pointer; border-bottom: 1px dashed #409eff">
								{{ getRealtimeSalesVolume(scope.row) ?? "-" }}
							</span>
						</template>
						<div v-if="scope.row?.restocking?.salesInfo?.recentSalesTrendList?.length">
							<div style="display: flex; gap: 10px">
								<div
									v-for="(item, index) in scope.row.restocking.salesInfo
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

				<template #column-restocking_fba_shipping="{ scope }">
					<el-tooltip placement="top" effect="light">
						<template #content>
							<div v-if="scope.row.restocking?.fbaShippingList?.length">
								<el-table
									:data="scope.row.restocking.fbaShippingList"
									size="small"
									border
									style="max-width: 950px"
								>
									<el-table-column
										prop="orderSn"
										label="货件单号"
										min-width="140"
									>
										<template #default="{ row: shipment }">
											<span>{{ shipment.orderSn }}</span>
											<el-tag
												v-if="
													shipment.shipment_status === '断' ||
													isShipmentLate(scope.row, shipment)
												"
												type="danger"
												size="small"
												effect="dark"
												style="margin-left: 5px"
											>
												断
											</el-tag>
										</template>
									</el-table-column>
									<el-table-column
										prop="shippingOrderSn"
										label="发货单号"
										min-width="140"
									/>
									<el-table-column prop="quantity" label="数量" min-width="80" />
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
						<span style="cursor: help; color: #409eff">
							{{ getRestockingFbaShippingQuantity(scope.row) }}
							<el-tag
								v-if="hasStockoutRisk(scope.row)"
								type="danger"
								size="small"
								effect="dark"
								style="margin-left: 5px"
							>
								断
							</el-tag>
						</span>
					</el-tooltip>
				</template>

				<template #column-sellable_days_fba="{ scope }">
					{{
						scope.row.sellableDays !== undefined && scope.row.sellableDays !== null
							? Math.round(Number(scope.row.sellableDays))
							: "-"
					}}
				</template>

				<template #column-sellable_days_total="{ scope }">
					{{
						scope.row.stockDays !== undefined && scope.row.stockDays !== null
							? Math.round(Number(scope.row.stockDays))
							: "-"
					}}
				</template>

				<template #column-restocking_local_valid="{ scope }">
					<el-tooltip placement="top" effect="light">
						<template #content>
							<div v-if="scope.row.restocking?.extInfo?.localValidDetailList?.length">
								<el-table
									:data="scope.row.restocking.extInfo.localValidDetailList"
									size="small"
									border
									style="max-width: 950px"
								>
									<el-table-column prop="whName" label="仓库" min-width="120" />
									<el-table-column prop="sku" label="SKU" min-width="120" />
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
									<el-table-column prop="remark" label="备注" min-width="160" />
								</el-table>
							</div>
							<div v-else>暂无本地可用明细</div>
						</template>
						<span style="cursor: help; color: #409eff">
							{{ scope.row.restocking_local_valid ?? "-" }}
						</span>
					</el-tooltip>
				</template>

				<template #column-restocking_reserved_customerorders="{ scope }">
					<el-tooltip placement="top" effect="light">
						<template #content>
							<div
								v-if="
									scope.row.restocking?.extInfo?.purchaseShippingDetailList
										?.length
								"
							>
								<el-table
									:data="scope.row.restocking.extInfo.purchaseShippingDetailList"
									size="small"
									border
									style="max-width: 950px"
								>
									<el-table-column
										prop="orderSn"
										label="单据号"
										min-width="140"
									/>
									<el-table-column prop="quantity" label="数量" min-width="80" />
									<el-table-column prop="whName" label="仓库" min-width="120" />
									<el-table-column
										prop="statusName"
										label="状态"
										min-width="100"
									/>
									<el-table-column
										prop="orderDate"
										label="下单日期"
										min-width="140"
									/>
									<el-table-column
										prop="expectArriveDate"
										label="预计到货时间"
										min-width="120"
									/>
									<el-table-column
										prop="amazonSaleDate"
										label="预计可售时间"
										min-width="160"
									/>
								</el-table>
							</div>
							<div v-else>暂无待交付明细</div>
						</template>
						<span style="cursor: help; color: #409eff">
							{{ scope.row.restocking_reserved_customerorders ?? "-" }}
						</span>
					</el-tooltip>
				</template>

				<template #column-restocking_purchase_plan="{ scope }">
					<el-tooltip placement="top" effect="light">
						<template #content>
							<div
								v-if="scope.row.restocking?.extInfo?.purchasePlanDetailList?.length"
							>
								<el-table
									:data="scope.row.restocking.extInfo.purchasePlanDetailList"
									size="small"
									border
									style="max-width: 950px"
								>
									<el-table-column
										prop="orderSn"
										label="计划单号"
										min-width="140"
									/>
									<el-table-column prop="sku" label="SKU" min-width="120" />
									<el-table-column
										prop="storeName"
										label="店铺"
										min-width="140"
									/>
									<el-table-column prop="whName" label="仓库" min-width="120" />
									<el-table-column
										prop="statusName"
										label="状态"
										min-width="100"
									/>
									<el-table-column prop="quantity" label="数量" min-width="80" />
									<el-table-column
										prop="amazonSaleDate"
										label="预计可售时间"
										min-width="160"
									/>
								</el-table>
							</div>
							<div v-else>暂无采购计划明细</div>
						</template>
						<span style="cursor: help; color: #409eff">
							{{ scope.row.restocking_purchase_plan ?? "-" }}
						</span>
					</el-tooltip>
				</template>

				<template #column-restocking_estimated_sale_quantity="{ scope }">
					<el-tooltip placement="top" effect="light">
						<template #content>
							<div
								v-if="
									scope.row.restocking?.extInfo?.fbaShippingPlanDetailList?.length
								"
							>
								<el-table
									:data="scope.row.restocking.extInfo.fbaShippingPlanDetailList"
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
									<el-table-column prop="quantity" label="数量" min-width="80" />
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
						<span style="cursor: help; color: #409eff">
							{{ scope.row.restocking_estimated_sale_quantity ?? "-" }}
						</span>
					</el-tooltip>
				</template>

				<template #column-restocking_local_aged="{ scope }">
					<el-tooltip placement="top">
						<template #content>
							<div v-if="scope.row.restocking?.localAgedInfo">
								<div>
									段1: {{ scope.row.restocking.localAgedInfo.section1 || 0 }}
								</div>
								<div>
									段2: {{ scope.row.restocking.localAgedInfo.section2 || 0 }}
								</div>
								<div>
									段3: {{ scope.row.restocking.localAgedInfo.section3 || 0 }}
								</div>
								<div>
									段4: {{ scope.row.restocking.localAgedInfo.section4 || 0 }}
								</div>
							</div>
							<div v-else>-</div>
						</template>
						<span style="cursor: help">
							{{ scope.row.restocking?.localAgedInfo?.section1 ?? "-" }}
						</span>
					</el-tooltip>
				</template>

				<!-- 日均销量列：注入迷你分析工作台 -->
				<template #column-dailyAvgSales="{ scope }">
					<span v-if="isLingxingParentAggregate(scope.row)" class="lingxing-parent-sales">
						{{ formatListingParentDailyAvgSales(scope.row) }}
					</span>
					<el-popover
						v-else
						trigger="click"
						placement="left"
						popper-class="listing-mini-popover"
						:show-arrow="true"
						:hide-after="300"  
					>
						<template #reference>
							<div class="daily-sales-wrapper" style="cursor: pointer; display: flex; flex-direction: column; align-items: flex-start;">
								<div class="daily-sales-trigger" style="color: #3b82f6; font-weight: 500;">
									{{ getDailyAvgSales(scope.row) || '-' }}
								</div>
								<el-tag
									v-if="scope.row.salesChangeStatus"
									size="small"
									effect="plain"
									style="margin-top: 2px; font-size: 9px; height: auto; line-height: 1.5; padding: 0 4px;" 
								>
									{{ getSalesStatusShortText(scope.row.salesChangeStatus) }}
								</el-tag>
							</div>
						</template>
						<listing-analysis-mini :listing="scope.row" />
					</el-popover>
				</template>

				<template #slot-management-buttons="{ scope }">
					<el-tooltip content="分析" placement="top" :hide-after="0">
						<el-button
							type="success"
							size="default"
							plain
							circle
							@click="
								curEditingLingxingComponent = scope.row;
								lingxingComponentManagementPaneVisible = true;
							"
						>
							<el-icon>
								<memo />
							</el-icon>
						</el-button>
					</el-tooltip>
					<el-tooltip content="调价" placement="top" :hide-after="0">
						<el-button
							type="primary"
							size="default"
							plain
							circle
							@click="openPriceStrategy(scope.row)"
						>
							<el-icon>
								<price-tag />
							</el-icon>
						</el-button>
					</el-tooltip>
					<el-tooltip content="关键词管理" placement="top" :hide-after="0">
						<el-button
							type="warning"
							size="default"
							plain
							circle
							@click="openKeywordManagement(scope.row)"
						>
							<el-icon>
								<Collection />
							</el-icon>
						</el-button>
					</el-tooltip>
					<el-dropdown trigger="click">
						<el-button type="info" size="default" plain circle title="补货设置">
							<el-icon><setting /></el-icon>
						</el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item @click="handleRestockSetting('no_restock', scope.row)">不再补货</el-dropdown-item>
								<el-dropdown-item @click="handleRestockSetting('future_restock', scope.row)">设置未来补货数</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<!-- 分页控件 -->
			<cl-pagination />
		</cl-row>

		<!-- 新增、编辑 -->
		<cl-upsert ref="Upsert"> </cl-upsert>
		<cl-form ref="priceForm">
			<template #slot-price-info="{ scope }">
				<div style="background-color: #f4f4f5; padding: 15px; border-radius: 4px; margin-bottom: 10px;">
					<el-row :gutter="20">
						<el-col :span="8">
							<div style="text-align: center;">
								<div style="font-size: 13px; color: #909399; margin-bottom: 5px;">清仓价 (0 利润)</div>
								<div style="font-size: 16px; font-weight: bold; color: #f56c6c;">{{ calculateClearancePrice(scope) }}</div>
							</div>
						</el-col>
						<el-col :span="8">
							<div style="text-align: center; border-left: 1px solid #e4e7ed; border-right: 1px solid #e4e7ed;">
								<div style="font-size: 13px; color: #909399; margin-bottom: 5px;">平本价 (0% 毛利)</div>
								<div style="font-size: 16px; font-weight: bold; color: #e6a23c;">{{ calculateTargetPrice(scope, 0) }}</div>
							</div>
						</el-col>
						<el-col :span="8">
							<div style="text-align: center;">
								<div style="font-size: 13px; color: #909399; margin-bottom: 5px;">BD价 (20% 毛利)</div>
								<div style="font-size: 16px; font-weight: bold; color: #67c23a;">{{ calculateTargetPrice(scope, 0.20) }}</div>
							</div>
						</el-col>
					</el-row>
				</div>
			</template>

			<template #slot-edit-tags="{ scope }">
				<div>
					<!-- <el-alert type="info" :closable="false"> -->
						<!-- <template #title> 请勾选要启用的标签。</template>
						<template #default>
							<div style="line-height: 1.5em">
								可按住标签或
								<el-icon>
									<more-filled />
								</el-icon>
								图标拖动排序以决定策略的 <strong>优先级</strong>。<br />
								未启用的标签不会参与补货/调价策略算法。
							</div>
						</template> -->
					<!-- </el-alert> -->
					<div style="margin-bottom: 10px"></div>
					<draggable
						v-model="scope.tagsRenderList"
						item-key="value"
						handle=".draggable-handle"
					>
						<template #item="{ element: tag, index }">
							<div>
								<el-space size="large">
									<el-icon class="draggable-handle">
										<more-filled />
									</el-icon>
									<el-text>{{ index + 1 }}</el-text>
									<el-switch
										v-model="tag.active"
										inline-prompt
										active-text="启用"
										inactive-text="关闭"
									></el-switch>
									<el-tag
										:type="tag.active ? 'primary' : 'info'"
										effect="plain"
										hit
										round
										class="draggable-handle"
									>
										{{ tag.desc }}｜{{ tag.value }}
									</el-tag>
								</el-space>
							</div>
						</template>
					</draggable>
				</div>
			</template>
		</cl-form>

		<el-drawer v-model="lingxingComponentManagementPaneVisible" size="90%" direction="ltr" :with-header="false">
			<lingxing-component
				:lingxing="curEditingLingxingComponent"
				@temp-stored-saved="handleTempStoredSaved"
			></lingxing-component>
		</el-drawer>

		<el-drawer v-model="keywordManagementPaneVisible" size="90%" direction="ltr">
			<listing-keyword :listing="curEditingListing"></listing-keyword>
		</el-drawer>

		<!-- 批量暂存预览模态框 -->
		<el-dialog
			v-model="batchStagingDialogVisible"
			title="批量创建采购计划"
			width="950px"
			:close-on-click-modal="false"
			class="batch-staging-dialog"
		>
			<div v-if="batchStagingLoading" style="text-align: center; padding: 60px;">
				<el-icon class="is-loading" :size="40"><Loading /></el-icon>
				<div style="margin-top: 16px; color: #909399; font-size: 14px;">正在加载暂存记录...</div>
			</div>
			<div v-else-if="batchStagingProducts.length === 0" style="text-align: center; padding: 60px;">
				<el-empty description="暂无暂存记录" :image-size="80" />
			</div>
			<div v-else>
				<!-- 统计概览 -->
				<div class="batch-staging-summary">
					<div class="summary-item">
						<span class="summary-label">选中产品</span>
						<span class="summary-value">{{ batchStagingProducts.length }}</span>
					</div>
					<div class="summary-divider"></div>
					<div class="summary-item">
						<span class="summary-label">暂存记录</span>
						<span class="summary-value">{{ batchStagingTotalRecords }}</span>
					</div>
					<div class="summary-divider"></div>
					<div class="summary-item">
						<span class="summary-label">已勾选</span>
						<span class="summary-value primary">{{ batchStagingCheckedCount }}</span>
					</div>
					<div class="summary-divider"></div>
					<div class="summary-item">
						<span class="summary-label">总数量</span>
						<span class="summary-value primary large">{{ batchStagingTotalQuantity }}</span>
						<span class="summary-unit">件</span>
					</div>
				</div>

				<!-- 产品列表 -->
				<div class="batch-staging-list">
					<div
						v-for="(product, pIdx) in batchStagingProducts"
						:key="pIdx"
						class="product-card"
					>
						<!-- 产品头部 -->
						<div class="product-header">
							<resilient-product-image
								:src="product.image_url"
								class="product-image"
								fit="cover"
							>
								<template #error>
									<div class="product-image-placeholder">
										<el-icon :size="24" color="#c0c4cc"><Picture /></el-icon>
									</div>
								</template>
							</resilient-product-image>
							<div class="product-info">
								<div class="product-title-row">
									<span class="product-asin">{{ product.asin }}</span>
									<el-tag size="small" effect="plain" class="marketplace-tag">{{ product.marketplace }}</el-tag>
									<span class="product-store">{{ product.seller_name }}</span>
								</div>
								<div class="product-name">{{ product.item_name }}</div>
							</div>
							<div class="product-subtotal">
								<span class="subtotal-value">{{ getProductCheckedTotal(product) }}</span>
								<span class="subtotal-unit">件</span>
							</div>
						</div>

						<!-- 暂存记录列表 -->
						<div class="records-list">
							<div
								v-for="(record, rIdx) in product.records"
								:key="record.id"
								class="record-item"
								:class="{ checked: record.checked }"
								@click="record.checked = !record.checked"
							>
								<el-checkbox v-model="record.checked" class="record-checkbox" @click.stop />
								<div class="record-content">
									<div class="record-row-1">
										<el-tag
											:type="record.status === 0 ? 'primary' : 'info'"
											size="small"
											effect="light"
											class="status-tag"
										>
											{{ record.status_text }}
										</el-tag>
										<span class="record-id">#{{ record.id }}</span>
										<span class="record-sku">本地SKU: <strong>{{ record.local_sku || '未设置' }}</strong></span>
										<span class="record-qty">
											<em>{{ record.expected_sales?.finalQty || 0 }}</em> 件
										</span>
									</div>
									<div class="record-row-2">
										<span class="record-algo">{{ record.expected_sales?.user_selected_algo_name || '日均单量' }}</span>
										<span class="record-date">
											{{ (record.expected_sales?.start_date || '').substring(5) }} ~ {{ (record.expected_sales?.end_date || '').substring(5) }}
											<em>({{ record.expected_sales?.total_days || 0 }}天)</em>
										</span>
										<span class="record-daily">日均 {{ formatNumber(record.expected_sales?.base_daily_avg_sales) }}</span>
										<span class="record-coef">系数 ×{{ record.expected_sales?.artificial_coefficient || 1 }}</span>
									</div>
									<div v-if="record.manual_remark" class="record-remark">
										<el-icon :size="12"><Memo /></el-icon>
										{{ record.manual_remark }}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<template #footer>
				<div class="dialog-footer">
					<el-button @click="batchStagingDialogVisible = false">取消</el-button>
					<el-button
						type="primary"
						@click="submitBatchStaging"
						:loading="batchStagingSubmitting"
						:disabled="batchStagingCheckedCount === 0"
					>
						确认创建 ({{ batchStagingCheckedCount }}条 / {{ batchStagingTotalQuantity }}件)
					</el-button>
				</div>
			</template>
		</el-dialog>

		<!-- 批量暂存结果模态框 -->
		<el-dialog
			v-model="batchStagingResultDialogVisible"
			title="批量创建结果"
			width="700px"
			class="batch-staging-result-dialog"
		>
			<div style="margin-bottom: 16px;">
				<el-alert
					:title="batchStagingResultSummary"
					:type="batchStagingResult?.total_failed > 0 ? 'warning' : 'success'"
					:closable="false"
					show-icon
				/>
			</div>
			<div class="batch-staging-result-list" style="max-height: 400px; overflow-y: auto;">
				<div
					v-for="(result, idx) in batchStagingResult?.results || []"
					:key="idx"
					style="padding: 12px; border: 1px solid #e4e7ed; border-radius: 6px; margin-bottom: 8px;"
				>
					<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
						<el-icon v-if="result.details?.some((d: any) => d.success)" color="#67c23a" :size="18"><CircleCheckFilled /></el-icon>
						<el-icon v-else color="#f56c6c" :size="18"><CircleCloseFilled /></el-icon>
						<span style="font-weight: 500;">{{ result.asin }}</span>
						<el-tag size="small" effect="plain">{{ result.marketplace }}</el-tag>
						<span style="color: #909399; font-size: 12px;">{{ result.message }}</span>
					</div>
					<div v-if="result.details && result.details.length > 0" style="padding-left: 26px;">
						<div
							v-for="(detail, dIdx) in result.details"
							:key="dIdx"
							style="font-size: 12px; color: #606266; padding: 4px 0;"
						>
							<template v-if="detail.success">
								<span style="color: #67c23a;">✓</span>
								<span style="color: #409eff; margin-left: 8px;">{{ detail.plan_sn }}</span>
								<span style="margin-left: 12px;">数量: {{ detail.quantity }}</span>
								<span style="margin-left: 12px;">本地SKU: {{ detail.local_sku }}</span>
							</template>
							<template v-else>
								<span style="color: #f56c6c;">✗</span>
								<span style="margin-left: 8px; color: #f56c6c;">{{ detail.message }}</span>
							</template>
						</div>
					</div>
				</div>
			</div>
			<template #footer>
				<el-button @click="batchStagingResultDialogVisible = false">关闭</el-button>
				<el-button type="primary" @click="refreshAfterBatchStaging">刷新列表</el-button>
			</template>
		</el-dialog>

		<!-- 批量补货分析弹窗 -->
		<batch-replenish-dialog
			v-model:visible="batchReplenishVisible"
			:items="selectedListingRows"
			:purchase-plan-syncing="batchReplenishPlanSyncing"
			:purchase-plan-sync-error="batchReplenishPlanSyncError"
			:purchase-plan-sync-progress="batchReplenishPlanSyncProgress"
			:purchase-plan-sync-result="batchReplenishPlanSyncResult"
			@success="Crud?.refresh()"
			@retry-sync-failed="retryBatchReplenishFailedSync"
		/>

		<!-- 补货设置：未来补货数对话框 -->
		<el-dialog v-model="futureRestockDialogVisible" title="设置未来补货数" width="480px" @close="resetFutureRestockForm">
			<el-form :model="futureRestockForm" label-width="110px">
				<el-form-item label="未来补货日期">
					<el-date-picker
						v-model="futureRestockForm.date"
						type="date"
						placeholder="选择日期"
						value-format="YYYY-MM-DD"
						style="width: 100%"
					/>
				</el-form-item>
				<el-form-item label="补货数量">
					<el-input-number
						v-model="futureRestockForm.quantity"
						:min="0"
						:step="1"
						placeholder="输入数量(可选)"
						style="width: 100%"
					/>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="futureRestockDialogVisible = false">取消</el-button>
				<el-button type="primary" :loading="futureRestockSubmitting" @click="submitFutureRestock">
					确认设置 ({{ restockSettingTargetRows.length || 0 }} 条)
				</el-button>
			</template>
		</el-dialog>
	</cl-crud>
</template>

<script lang="ts" name="app-bsr_product_Listing_Lingxing" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { convert_image_url } from "/$/app/utils";
import {
	boostProductImages,
	preloadProductImages,
	preloadProductMainImages
} from "/$/app/utils/product-image-loading";
import { computed, nextTick, ref, onMounted } from "vue";
import draggable from "vuedraggable";
import LingxingComponent from "/$/app/components/amazon_product_Listing_Lingxing_component.vue";
import ListingKeyword from "/$/app/components/listing-keyword-lingxing.vue";
import ListingAnalysisMini from "/$/app/components/ListingAnalysisMini.vue";
import BatchReplenishDialog from "/$/app/components/BatchReplenishDialog.vue";
import ResilientProductImage from "/$/app/components/resilient-product-image.vue";
import StrategyTestBtn from "../components/strategy-test-btn.vue";
import { Loading, Check, Warning, Memo, Refresh, PriceTag, MoreFilled, Picture, CircleCheckFilled, CircleCloseFilled, Collection, Setting, ArrowDown } from "@element-plus/icons-vue";
import * as XLSX from "xlsx";
import { ElLoading, ElMessage, ElMessageBox } from "element-plus";
import dayjs from "dayjs";
import { appConfig } from "../../../../../appConfig";
import {
	flattenExpandedLingxingRows,
	getLingxingListingRowKey,
	getLingxingRealRows,
	getSelectedLingxingRealRows,
	isLingxingParentAggregate,
	isLingxingRowSelected,
	refreshLingxingParentSummaries,
	updateLingxingSelectionStore
} from "../utils/lingxing-replenishment-fold";
const upsert_short_label_width = "120px";

// 批量补货弹窗
const batchReplenishVisible = ref(false);
	const batchReplenishPlanSyncing = ref(false);
	const batchReplenishPlanSyncError = ref("");
	const batchReplenishPlanSyncProgress = ref({ current: 0, total: 0 });
	type BatchReplenishPlanSyncResult = {
		status: "success" | "partial_failed" | "failed";
		total: number;
		successCount: number;
		failedCount: number;
		message: string;
		failedRows?: any[];
	};
	const batchReplenishPlanSyncResult = ref<BatchReplenishPlanSyncResult | null>(null);
	const PURCHASE_PLAN_SYNC_CHUNK_SIZE = 5;
	const futureRestockDialogVisible = ref(false);
	const futureRestockSubmitting = ref(false);
	const futureRestockForm = ref({ date: "", quantity: null as number | null });
	const restockSettingTargetRows = ref<any[]>([]);

	function resetFutureRestockForm() {
		futureRestockForm.value = { date: "", quantity: null };
	}

	function getRestockSettingRows(rows: any[]) {
		return (Array.isArray(rows) ? rows : []).filter((row) => row?.id && !isLingxingParentAggregate(row));
	}

	async function handleSelectedRestockSetting(command: string) {
		await handleRestockSetting(command, selectedListingRows.value);
	}

	async function handleRestockSetting(command: string, rowOrRows?: any | any[]) {
		const targetRows = getRestockSettingRows(
			Array.isArray(rowOrRows)
				? rowOrRows
				: rowOrRows
					? [rowOrRows]
					: selectedListingRows.value
		);

		if (targetRows.length === 0) {
			ElMessage.warning("请先选择产品");
			return;
		}

		if (command === "no_restock") {
			try {
				await ElMessageBox.confirm(
					`确定将选中的 ${targetRows.length} 条产品设置为"不再补货"吗？设置后这些产品将不再出现在页面中。`,
					"确认操作",
					{ confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
				);
			} catch {
				return;
			}

			try {
				await (service.app.bsr_product_Listing_Lingxing as any).batchSetRestockSetting({
					ids: targetRows.map((row: any) => row.id),
					settingType: 1
				});
				ElMessage.success(`已设置 ${targetRows.length} 条产品为不再补货`);
				clearListingSelections();
				Crud.value?.refresh();
			} catch (error: any) {
				ElMessage.error(error?.message || "操作失败");
			}
		} else if (command === "future_restock") {
			restockSettingTargetRows.value = targetRows;
			resetFutureRestockForm();
			futureRestockDialogVisible.value = true;
		}
	}

	async function submitFutureRestock() {
		const targetRows = getRestockSettingRows(restockSettingTargetRows.value);
		if (targetRows.length === 0) {
			ElMessage.warning("请先选择产品");
			return;
		}
		if (!futureRestockForm.value.date) {
			ElMessage.warning("请选择未来补货日期");
			return;
		}

		futureRestockSubmitting.value = true;
		try {
			await (service.app.bsr_product_Listing_Lingxing as any).batchSetRestockSetting({
				ids: targetRows.map((row: any) => row.id),
				settingType: 2,
				futureRestockDate: futureRestockForm.value.date,
				futureRestockQuantity: futureRestockForm.value.quantity ?? undefined
			});
			ElMessage.success(`已设置 ${targetRows.length} 条产品的未来补货`);
			futureRestockDialogVisible.value = false;
			clearListingSelections();
			Crud.value?.refresh();
		} catch (error: any) {
			ElMessage.error(error?.message || "操作失败");
		} finally {
			futureRestockSubmitting.value = false;
		}
	}
const searchKey = ref()
const searchKeywordInput = ref("");
const searchField = ref("msku");

// 2026-03-28: 支持按字段批量搜索
const searchFieldOptions = [
	{ label: "中文品名", value: "local_name" },
	{ label: "MSKU", value: "msku" },
	{ label: "英文标题", value: "item_name" },
	{ label: "ASIN", value: "asin" },
	{ label: "ID", value: "product_code" }
];

const LISTING_TAGS = [
	{ value: "p1", desc: "调价策略：新品", desc_short: "新品", key: "PRICING_NEW" },
	{ value: "p2", desc: "调价策略：竞品", desc_short: "竞品", key: "PRICING_COMPETITOR" },
	{ value: "p3", desc: "调价策略：清仓", desc_short: "清仓", key: "PRICING_CLEARANCE" },
	{ value: "p4", desc: "调价策略：日常", desc_short: "日常", key: "PRICING_DEFAULT" }
];

// 任务状态类型定义（包含统计字段）
interface TaskInfo {
	id?: number;
	createTime?: string;
	updateTime?: string;
	taskName?: string;
	taskCode?: string;
	taskStatus?: "Unexecuted" | "Running" | "Finished" | "Failed" | "Stopped";
	invokeTime?: string;
	executeStartTime?: string | null;
	executeEndTime?: string | null;
	retryCount?: number;
	maxRetryCount?: number;
	executeResult?: string | null;
	remark?: string | null;
}

const lingxingComponentManagementPaneVisible = ref(false);
const curEditingLingxingComponent = ref<any>(null);

// 关键词管理
const keywordManagementPaneVisible = ref(false);
const curEditingListing = ref<any>(null);

function openKeywordManagement(row: any) {
	if (!row.asin) {
		ElMessage.warning("当前产品缺少 ASIN，无法管理关键词");
		return;
	}

	// 传递行数据用于顶部展示，后端仍只按 asin 查询（onRefresh 里控制）
	curEditingListing.value = {
		id: row.id,
		asin: row.asin,
		product_code: row.product_code,
		sid: row.store_id,
		store_id: row.store_id,
		seller_sku: row.msku,
		msku: row.msku,
		sellerName: row.seller_name,
		seller_name: row.seller_name,
		marketplace: row.marketplace,
		local_name: row.local_name,
		item_name: row.item_name,
		image_url: row.image_url
	};
	keywordManagementPaneVisible.value = true;
}
const { service } = useCool();

const restockingCache = ref(new Map<string, any>());

// 采购计划缓存（近N天的采购计划数据）
const purchasePlansCache = ref(new Map<string, any[]>());
// 采购计划查询天数配置
const PURCHASE_PLANS_DAYS = 3;

function getRestockingKey(asin: string, marketplace: string, sellerName?: string) {
	const seller = sellerName ? sellerName.trim() : "";
	return `${asin}__${marketplace}__${seller}`;
}

// 2026-01-30: Helper functions for country display
function getMarketplaceShortName(marketplace: string) {
	if (!marketplace) return "";
	const map: Record<string, string> = {
		英国: "英",
		德国: "德",
		法国: "法",
		西班牙: "西",
		意大利: "意"
	};
	return map[marketplace] || marketplace.charAt(0);
}

// 生成Amazon商品链接
const getAmazonDpUrl = (asin: string, marketplace: string) => {
	if (!asin || !marketplace) return "#";

	// 映射国家到对应的域名后缀
	const domainMap: Record<string, string> = {
		英国: "co.uk",
		德国: "de",
		法国: "fr",
		西班牙: "es",
		意大利: "it"
	};

	const domain = domainMap[marketplace] || "com"; // 默认使用.com
	return `https://www.amazon.${domain}/dp/${asin}`;
};

function getMarketplaceColor(marketplace: string) {
	if (!marketplace) return "#909399";
	const map: Record<string, string> = {
		英国: "#409EFF", // Primary Blue
		德国: "#303133", // Dark/Black
		法国: "#8e44ad", // Purple
		西班牙: "#E6A23C", // Warning/Orange
		意大利: "#67C23A" // Success/Green
	};
	return map[marketplace] || "#909399";
}

// ========== 批量暂存相关 ==========
const batchStagingDialogVisible = ref(false);
const batchStagingLoading = ref(false);
const batchStagingSubmitting = ref(false);
const batchStagingProducts = ref<any[]>([]);
const batchStagingResultDialogVisible = ref(false);
const batchStagingResult = ref<any>(null);

// 计算属性：总暂存记录数
const batchStagingTotalRecords = computed(() => {
	return batchStagingProducts.value.reduce((sum, p) => sum + p.records.length, 0);
});

// 计算属性：勾选的记录数
const batchStagingCheckedCount = computed(() => {
	return batchStagingProducts.value.reduce((sum, p) => {
		return sum + p.records.filter((r: any) => r.checked).length;
	}, 0);
});

// 计算属性：勾选的总数量
const batchStagingTotalQuantity = computed(() => {
	return batchStagingProducts.value.reduce((sum, p) => {
		return sum + p.records
			.filter((r: any) => r.checked)
			.reduce((s: number, r: any) => s + (r.expected_sales?.finalQty || 0), 0);
	}, 0);
});

// 格式化数字（保留2位小数）
function formatNumber(num: number | undefined | null): string {
	if (num === undefined || num === null) return "0";
	return Number(num)
		.toFixed(2)
		.replace(/\.?0+$/, "");
}

function formatListingParentDailyAvgSales(row: any): string {
	const value = Number(row?.dailyAvgSales);
	if (!Number.isFinite(value)) return "0.00";
	return value.toFixed(2);
}

// 2026-03-30: 售价悬浮展示15天历史
function formatListingPriceValue(num: number | undefined | null): string {
	if (num === undefined || num === null || Number.isNaN(Number(num))) return "-";
	return formatNumber(Number(num));
}

function getListingPriceHistory(row: any): Array<number | null> {
	if (Array.isArray(row?.listing_price_history) && row.listing_price_history.length > 0) {
		return row.listing_price_history;
	}

	if (row?.listing_price === undefined || row?.listing_price === null) {
		return [];
	}

	return [row.listing_price];
}

function getPriceHistoryLabel(index: number): string {
	if (index === 0) {
		return "最新";
	}

	const d = new Date();
	d.setDate(d.getDate() - index);
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${month}-${day}`;
}

// 获取产品勾选的总数量
function getProductCheckedTotal(product: any): number {
	return product.records
		.filter((r: any) => r.checked)
		.reduce((sum: number, r: any) => sum + (r.expected_sales?.finalQty || 0), 0);
}

// 获取产品勾选的记录数
function getProductCheckedCount(product: any): number {
	return product.records.filter((r: any) => r.checked).length;
}

// 计算属性：结果摘要
const batchStagingResultSummary = computed(() => {
	if (!batchStagingResult.value) return "";
	const r = batchStagingResult.value;
	return `共 ${r.total_items} 个产品，创建 ${r.total_plans_created} 个采购计划，成功 ${r.total_plans_created} 个，失败 ${r.total_failed} 个`;
});

// 打开批量暂存模态框
async function openBatchStagingDialog() {
	const selectedRows = selectedListingRows.value;
	if (!selectedRows || selectedRows.length === 0) {
		ElMessage.warning("请先选择产品");
		return;
	}

	batchStagingDialogVisible.value = true;
	batchStagingLoading.value = true;
	batchStagingProducts.value = [];

	try {
		// 并发获取每个产品的暂存记录
		const promises = selectedRows.map(async (row: any) => {
			if (!row.asin || !row.marketplace || !row.store_id) return null;

			try {
				const records = await (service.app as any).bsr_analysis_record_lingxing.getHistory({
					asin: row.asin,
					marketplace: row.marketplace,
					store_id: row.store_id,
					msku: row.msku
				});

				if (!records || records.length === 0) return null;

				return {
					asin: row.asin,
					marketplace: row.marketplace,
					store_id: row.store_id,
					seller_name: row.seller_name || "",
					item_name: row.item_name || "",
					image_url: row.image_url_display || row.image_url || "",
					records: records.map((r: any) => ({
						...r,
						checked: true // 默认全选
					}))
				};
			} catch (e) {
				console.error(`获取 ${row.asin} 暂存记录失败:`, e);
				return null;
			}
		});

		const results = await Promise.all(promises);
		batchStagingProducts.value = results.filter((r): r is any => r !== null);

		if (batchStagingProducts.value.length === 0) {
			ElMessage.info("选中的产品没有暂存记录");
			batchStagingDialogVisible.value = false;
		}
	} catch (e) {
		console.error("获取暂存记录失败:", e);
		ElMessage.error("获取暂存记录失败");
		batchStagingDialogVisible.value = false;
	} finally {
		batchStagingLoading.value = false;
	}
}

// 提交批量暂存
async function submitBatchStaging() {
	// 收集勾选的记录，按产品分组
	const items: Array<{ asin: string; marketplace: string; store_id: number; record_ids: number[] }> = [];

	for (const product of batchStagingProducts.value) {
		const checkedRecords = product.records.filter((r: any) => r.checked);
		if (checkedRecords.length > 0) {
			items.push({
				asin: product.asin,
				marketplace: product.marketplace,
				store_id: product.store_id,
				record_ids: checkedRecords.map((r: any) => r.id)
			});
		}
	}

	if (items.length === 0) {
		ElMessage.warning("请至少选择一条暂存记录");
		return;
	}

	batchStagingSubmitting.value = true;

	try {
		const result = await (service.app.bsr_purchase_plan_lingxing as any).batchCreateFromStaging({
			items
		});

		batchStagingResult.value = result;
		batchStagingDialogVisible.value = false;
		batchStagingResultDialogVisible.value = true;
	} catch (e: any) {
		console.error('批量创建采购计划失败:', e);
		ElMessage.error(e.message || '批量创建采购计划失败');
	} finally {
		batchStagingSubmitting.value = false;
	}
}

// 刷新列表
function refreshAfterBatchStaging() {
	batchStagingResultDialogVisible.value = false;
	Crud.value?.refresh();
}

function getRestockingFbaShippingQuantity(row: any) {
	const list = row?.restocking?.fbaShippingList;
	if (!Array.isArray(list)) return 0;
	// 过滤出与当前行 msku 匹配的货件
	const matchedList = list.filter((item: any) => {
		if (!row.msku) return true;
		return item.msku ? item.msku === row.msku : true;
	});
	return matchedList.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0);
}

function getFbaInventoryQuantity(row: any) {
	const list = row?.restocking?.fbaValidList;
	// FBA 主显示使用库存明细的“数量”，待调仓/调仓中只保留在悬浮明细里展示。
	if (Array.isArray(list) && list.length > 0) {
		const matchedList = list.filter((item: any) => {
			if (!row.msku) return true;
			return item.msku ? item.msku === row.msku : true;
		});

		if (matchedList.length > 0) {
			return matchedList.reduce((sum: number, item: any) => {
				return sum + (Number(item.quantity) || 0);
			}, 0);
		}
	}

	return Number(row?.afn_fulfillable_quantity) || 0;
}

function getFbaReservedQuantity(row: any) {
	const list = row?.restocking?.fbaValidList;
	if (Array.isArray(list) && list.length > 0) {
		const matchedList = list.filter((item: any) => {
			if (!row.msku) return true;
			return item.msku ? item.msku === row.msku : true;
		});

		if (matchedList.length > 0) {
			return matchedList.reduce((sum: number, item: any) => {
				return sum + (Number(item.afnReservedQuantity) || 0);
			}, 0);
		}
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

function getYesterdaySalesVolume(row: any) {
	const trendList = row?.restocking?.salesInfo?.recentSalesTrendList;
	if (!Array.isArray(trendList) || trendList.length === 0) return null;
	const yesterday = dayjs().subtract(2, "day").format("YYYY-MM-DD");
	const item = trendList.find((it: any) => it?.date === yesterday);
	if (!item) return null;
	const volume = Number(item.volume);
	return Number.isNaN(volume) ? null : volume;
}

function getRealtimeSalesVolume(row: any) {
	const value = row?.restocking?.realtimeSales;
	if (value === null || value === undefined) return null;
	const num = Number(value);
	return Number.isNaN(num) ? null : num;
}

function getDailyAvgSales(row: any) {
	// 如果能从后端取到当前行的 dailyAvgSales，直接使用，因为它在后端已经是基于 MSKU 精确计算过的了
	const val = Number(row?.dailyAvgSales);
	if (!Number.isNaN(val) && val > 0) return val;
	
	// 如果出于某种原因后端没返回，从补充加载的 restocking 缓存中按 msku 精确查找
	const salesInfo = row?.restocking?.salesInfo;
	if (salesInfo) {
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
	return 0;
}

const listingTopLevelRows = ref<any[]>([]);
const expandedListingParentKeys = ref<Set<string>>(new Set());
const selectedListingRowsByKey = ref<Map<string, any>>(new Map());
const selectedListingRows = computed(() =>
	getSelectedLingxingRealRows(selectedListingRowsByKey.value)
);
const selectedListingCount = computed(() => selectedListingRows.value.length);
let restoringListingSelection = false;
let visibleListingSelectionKeys = new Set<string>();
let nextListingPageImagePreloadSeq = 0;

function prepareListingImageRows(rows: any[]) {
	for (const item of rows) {
		item.image_url_display = convert_image_url(item.image_url);
	}

	return rows;
}

async function preloadNextListingPageImages(params: any, sequence: number) {
	const page = Number(params?.page) || 1;
	const size = Number(params?.size) || 20;

	try {
		const res = await (service.app.bsr_product_Listing_Lingxing as any).page({
			...params,
			page: page + 1,
			size,
			parentFold: 1
		});

		if (sequence !== nextListingPageImagePreloadSeq) return;

		const nextRows = prepareListingImageRows(getLingxingRealRows(res?.list || []));
		preloadProductMainImages(nextRows, {
			priority: "prefetch",
			reason: "bsr-product-listing-next-page"
		});
	} catch (err) {
		console.warn("预加载下一页图片失败", err);
	}
}

function getListingLocalQuantity(row: any) {
	return Number(row?.restocking_local_valid) || 0;
}

function refreshListingParentSummaries() {
	refreshLingxingParentSummaries(listingTopLevelRows.value, {
		getDailyAvgSales,
		getFbaInventoryQuantity,
		getFbaReservedQuantity,
		getInTransitQuantity: getRestockingFbaShippingQuantity,
		getLocalQuantity: getListingLocalQuantity
	});
}

function refreshSelectedListingRows(rows: any[]) {
	for (const row of rows) {
		const key = getLingxingListingRowKey(row);

		if (selectedListingRowsByKey.value.has(key)) {
			selectedListingRowsByKey.value.set(key, row);
		}
	}
}

async function restoreVisibleListingSelection() {
	await nextTick();
	const table = Table.value;
	if (!table) return;

	restoringListingSelection = true;
	table.clearSelection();
	for (const row of table.data || []) {
		if (isLingxingRowSelected(selectedListingRowsByKey.value, row)) {
			table.toggleRowSelection(row, true);
		}
	}
	await nextTick();
	visibleListingSelectionKeys = new Set(
		(table.getSelectionRows() || []).map(getLingxingListingRowKey)
	);
	restoringListingSelection = false;
}

function applyVisibleListingRows() {
	refreshListingParentSummaries();
	Table.value?.setData(
		flattenExpandedLingxingRows(listingTopLevelRows.value, expandedListingParentKeys.value)
	);
	void restoreVisibleListingSelection();
}

function expandAllListingParents(rows: any[]) {
	expandedListingParentKeys.value = new Set(
		(Array.isArray(rows) ? rows : [])
			.filter((row) => isLingxingParentAggregate(row))
			.map((row) => String(row?._groupKey || ""))
			.filter(Boolean)
	);
}

function handleListingSelectionChange(selection: any[]) {
	if (restoringListingSelection) return;
	visibleListingSelectionKeys = updateLingxingSelectionStore(
		selectedListingRowsByKey.value,
		Table.value?.data || [],
		selection,
		visibleListingSelectionKeys
	);
	void restoreVisibleListingSelection();
}

function isListingParentExpanded(row: any) {
	return expandedListingParentKeys.value.has(String(row?._groupKey || ""));
}

function toggleListingParentExpand(row: any) {
	if (!isLingxingParentAggregate(row)) return;
	const key = String(row?._groupKey || "");
	if (expandedListingParentKeys.value.has(key)) {
		expandedListingParentKeys.value.delete(key);
	} else {
		expandedListingParentKeys.value.add(key);
	}
	applyVisibleListingRows();
}

function handleListingParentRowClick(row: any) {
	if (!isLingxingParentAggregate(row)) return;
	toggleListingParentExpand(row);
}

function getListingRowClassName({ row }: { row: any }) {
	if (isLingxingParentAggregate(row)) return "lingxing-parent-row";
	if (row?._isChildRow) return "lingxing-child-row";
	return "";
}

function getListingCellClassName({ row, column }: { row: any; column: any }) {
	if (!isLingxingParentAggregate(row)) return "";
	if (
		column?.type === "selection" ||
		["image_url_display", "status", "shop", "asin", "dailyAvgSales", "inventory_details"].includes(
			column?.property
		)
	) {
		return "";
	}
	return "lingxing-parent-hidden-cell";
}

function clearListingSelections() {
	selectedListingRowsByKey.value.clear();
	visibleListingSelectionKeys = new Set();
	Table.value?.clearSelection();
}

function refreshListingTable() {
	clearListingSelections();
	expandedListingParentKeys.value.clear();
	Crud.value?.refresh();
}

function deleteSelectedListings() {
	const rows = selectedListingRows.value;
	if (!rows.length) return;
	Crud.value?.rowDelete(...rows);
}

function getRiskShipmentSns(row: any): Set<string> {

	const riskSns = new Set<string>();
	const dailyAvg = getDailyAvgSales(row);
	if (dailyAvg <= 0) {
		return riskSns;
	}

	// 1. 初始库存及断货时间
	const initialStock = getFbaInventoryQuantity(row);
	let stockoutDate = dayjs().add(initialStock / dailyAvg, "day");

	// 2. 获取并排序在途货件 (按预计可售时间升序)
	const list = row?.restocking?.fbaShippingList;
	if (!Array.isArray(list) || list.length === 0) {
		return riskSns;
	}

	const sortedShipments = [...list].filter(item => item?.amazonSaleDate).sort((a, b) => {
		return dayjs(a.amazonSaleDate).valueOf() - dayjs(b.amazonSaleDate).valueOf();
	});

	// 3. 累计计算
	for (const shipment of sortedShipments) {
		const arrivalDate = dayjs(shipment.amazonSaleDate);
		if (!arrivalDate.isValid()) continue;

		// 判定逻辑：如果 预计可售时间 > 当前断货时间，则标记为断货
		// stockoutDate 当前时间 + 天数
		if (arrivalDate.startOf('day').isAfter(stockoutDate, 'day')) { 
			if (shipment.orderSn) riskSns.add(shipment.orderSn);
		}
		const addedDays = (Number(shipment.quantity) || 0) / dailyAvg;
		
		if (arrivalDate.isAfter(stockoutDate)) {
			stockoutDate = arrivalDate.add(addedDays, "day");
		} else {
			stockoutDate = stockoutDate.add(addedDays, "day");
		}
	}

	// row._riskShipmentSns = riskSns;
	return riskSns;
}

function isShipmentLate(productRow: any, shipment: any) {
	if (!shipment?.orderSn) return false;
	const riskSns = getRiskShipmentSns(productRow);
	return riskSns.has(shipment.orderSn);
}

function hasShipmentStatusStockoutRisk(productRow: any) {
	const list = productRow?.restocking?.fbaShippingList;
	if (!Array.isArray(list)) return false;
	return list.some((shipment: any) => shipment?.shipment_status === "断");
}

function hasStockoutRisk(productRow: any) {
	return hasShipmentStatusStockoutRisk(productRow) || getRiskShipmentSns(productRow).size > 0;
}

async function hydrateRestockingForRows(rows: any[]) {
	const items = rows
		.filter((r) => r?.asin && r?.marketplace)
		.map((r) => ({
			asin: r.asin,
			marketplace: r.marketplace,
			sellerName: r.seller_name ? String(r.seller_name).trim() : undefined
		}));

	const uniqueMap = new Map<string, { asin: string; marketplace: string; sellerName?: string }>();
	for (const it of items) {
		uniqueMap.set(getRestockingKey(it.asin, it.marketplace, it.sellerName), it);
	}

	const missing = Array.from(uniqueMap.values()).filter(
		(it) => !restockingCache.value.has(getRestockingKey(it.asin, it.marketplace, it.sellerName))
	);

	if (missing.length > 0) {
		try {
			const res =
				await service.app.bsr_restocking_center_lingxing.getByAsinAndMarketplaceBatch({
					items: missing
				});
			const list = Array.isArray(res) ? res : [];

			for (const entity of list) {
				const asin = entity?.asin;
				const marketplaces = entity?.marketplaceList;
				const stores = entity?.storeList;
				
				if (!asin || !Array.isArray(marketplaces)) continue;
				for (const mp of marketplaces) {
					const loopStores = Array.isArray(stores) && stores.length > 0 ? stores : [""];
					for (const storeName of loopStores) {
						const key = getRestockingKey(asin, mp, storeName);
						restockingCache.value.set(key, entity);
					}
				}
			}
		} catch (err) {
			console.error("批量获取补货建议失败:", err);
		}
	}

	for (const row of rows) {
		if (!row?.asin || !row?.marketplace) {
			row.restocking = null;
			continue;
		}
		const sellerName = row.seller_name ? String(row.seller_name).trim() : "";
		const key = getRestockingKey(row.asin, row.marketplace, sellerName || undefined);
		const restocking = restockingCache.value.get(key);

		row.restocking = restocking ?? null;
		const r = row.restocking;
		// 优先从 extInfo.localValidDetailList 计算本地可用库存（可用 + 锁定）
		if (Array.isArray(r?.extInfo?.localValidDetailList) && r.extInfo.localValidDetailList.length > 0) {
			const matchedList = r.extInfo.localValidDetailList.filter((item: any) => {
				if (!row.msku) return true;
				// 本地可用明细通常使用 sku 字段
				return item.sku ? item.sku === row.msku : true;
			});
			row.restocking_local_valid = matchedList.reduce(
				(sum: number, item: any) => {
					const valid = Number(item.quantityValid) || 0;
					const locked = Number(item.quantityLocked) || 0;
					return sum + valid + locked;
				},
				0
			);
		} else {
			row.restocking_local_valid = r?.scmQuantityInfo?.scQuantityLocalValid ?? null;
		}
		
		row.restocking_stock_total = r?.stockQuantityInfo?.stockTotal ?? null;
		row.restocking_reserved_customerorders =
			r?.scmQuantityInfo?.scQuantityPurchaseShipping ?? null;
		row.restocking_purchase_plan = r?.scmQuantityInfo?.scQuantityPurchasePlan ?? null;
		row.restocking_estimated_sale_quantity =
			r?.amazonQuantityInfo?.amazonQuantityShippingPlan ?? null;
		row.restocking_oversea_valid = r?.scmQuantityInfo?.scQuantityOverseaValid ?? null;
		row.restocking_available_sale_days = r?.suggestInfo?.availableSaleDays ?? null;
		row.restocking_available_sale_days_fba = r?.suggestInfo?.availableSaleDaysFba ?? null;
		row.restocking_out_stock_date = r?.suggestInfo?.outStockDate ?? null;
		row.restocking_sug_date_purchase = r?.suggestInfo?.sugDatePurchase ?? null;
		row.restocking_sug_date_send_local = r?.suggestInfo?.sugDateSendLocal ?? null;
		row.restocking_sales_prediction = r?.suggestInfo?.estimatedSaleAvgQuantity ?? null;
		row.restocking_quantity_sug_purchase = r?.suggestInfo?.quantitySugPurchase ?? null;
		row.restocking_quantity_sug_local_to_fba = r?.suggestInfo?.quantitySugLocalToFba ?? null;
		row.restocking_quantity_sug_oversea_to_fba =
			r?.suggestInfo?.quantitySugOverseaToFba ?? null;
		row.restocking_ext_remark = r?.extInfo?.remark ?? null;
	}
}

async function hydrateTempStoredQtyForRows(rows: any[]) {
	const items = rows
		.filter((r) => r?.asin && r?.marketplace)
		.map((r) => ({
			asin: r.asin,
			marketplace: r.marketplace,
			store_id: r.store_id,
			msku: r.msku,
			seller_name: r.seller_name
		}));

	if (items.length === 0) return;

	// Deduplicate
	const uniqueMap = new Map<string, { asin: string; marketplace: string; store_id?: number; msku?: string; seller_name?: string }>();
	for (const it of items) {
		uniqueMap.set(`${it.asin}-${it.marketplace}-${it.store_id}-${it.msku}`, it);
	}
	const uniqueItems = Array.from(uniqueMap.values());

	try {
		const res = await service.app.bsr_analysis_record_lingxing.getHistoryBatch({
			items: uniqueItems
		});

		const recordMap = new Map<string, any[]>();
		if (Array.isArray(res)) {
			for (const r of res) {
				const key = `${r.asin}-${r.marketplace}-${r.store_id}-${r.msku}`;
				if (!recordMap.has(key)) {
					recordMap.set(key, []);
				}
				recordMap.get(key)?.push(r);
			}
		}

		for (const row of rows) {
			if (!row?.asin || !row?.marketplace) {
				row.temp_stored_total = 0;
				continue;
			}
			// Fallback to 0 or undefined if store_id is missing, to match key generation
			const key = `${row.asin}-${row.marketplace}-${row.store_id}-${row.msku}`;
			const records = recordMap.get(key) || [];
			let total = 0;
			const details: any[] = [];
			for (const record of records) {
				let finalQty = 0;
				let remarkData: any = {};
				if (record.remark) {
					try {
						remarkData = JSON.parse(record.remark) || {};
						finalQty = Number(remarkData.final_replenishment_qty) || 0;
					} catch (e) {
						// ignore
					}
				}
				total += finalQty;
				// 格式化日期: "2026-03-20" → "03-20"
				const fmtDate = (d: string) => d ? d.substring(5) : '';
				// 格式化时间: "2026-03-13 15:39:45" → "03-13 15:39"
				const fmtTime = (t: string) => t ? t.substring(5, 16) : '';
				details.push({
					id: record.id,
					status: record.status,
					status_text: record.status_text || (record.status === 0 ? '当前' : '历史'),
					final_qty: finalQty,
					start_date_short: fmtDate(remarkData.start_date || ''),
					end_date_short: fmtDate(remarkData.end_date || ''),
					total_days: remarkData.total_days || 0,
					daily_avg: remarkData.base_daily_avg_sales || 0,
					coefficient: remarkData.artificial_coefficient ?? 1,
					manual_remark: record.manual_remark || '',
					create_time_short: fmtTime(record.createTime || '')
				});
			}
			row.temp_stored_total = total;
			row.temp_stored_details = details;
		}
	} catch (err) {
		console.error("批量获取暂存总数失败:", err);
	}
}

/**
 * 过滤出最近 N 天内创建的采购计划（对齐原后端 YYYY-MM-DD 字符串过滤逻辑）
 */
function getRecentPurchasePlans(details: any[], days: number) {
	if (!details || !Array.isArray(details)) return [];

	// 计算 N 天前的时间，格式化为 YYYY-MM-DD，跟老后端 dayjs 完全一致
	const d = new Date();
	d.setDate(d.getDate() - days);
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	const threshold = `${yyyy}-${mm}-${dd}`;

	return details.filter(item => {
		if (!item.create_time_remote) return false;
		// 字符串比较：'2026-03-16 10:20:00' >= '2026-03-16'
		return item.create_time_remote >= threshold;
	});
}

/**
 * 批量获取采购计划数据（待采购 + 待审批）
 * 调用新接口 getPendingPurchasePlansByProducts
 */
async function hydratePurchasePlansForRows(rows: any[], options: { syncLinkedPlans?: boolean } = {}) {
	const items = rows
		.filter((r) => r?.asin && r?.marketplace && r?.store_id)
		.map((r) => ({
			asin: r.asin,
			marketplace: r.marketplace,
			store_id: r.store_id,
			msku: r.msku,
			seller_name: r.seller_name,
			product_code: r.product_code,
			local_sku: r.local_sku
		}));

	if (items.length === 0) return true;

	// 去重
	const uniqueMap = new Map<string, { asin: string; marketplace: string; store_id: number; msku?: string; seller_name?: string; product_code?: string; local_sku?: string }>();
	for (const it of items) {
		uniqueMap.set(`${it.asin}|${it.marketplace}|${it.store_id}|${it.msku || ''}`, it);
	}

	try {
		const payload: any = { products: Array.from(uniqueMap.values()) };
		if (options.syncLinkedPlans) {
			payload.syncLinkedPlans = true;
		}
		const res = await (service.app.bsr_purchase_order_sync_lingxing as any).getPendingPurchasePlansByProducts(payload);

		// 填充到每一行
		let syncFailed = false;
		for (const row of rows) {
			if (!row?.asin || !row?.marketplace || !row?.store_id) continue;
			const key = `${row.asin}|${row.marketplace}|${row.store_id}|${row.msku || ''}`;
			const data = res?.[key];
			row.purchase_plan_qty = data?.plan_qty ?? 0;
			row.purchase_plan_count = data?.plan_count ?? 0;
			row.purchase_plan_details = data?.details ?? [];
			if (options.syncLinkedPlans && data?.sync_attempted && data?.sync_success === false) {
				syncFailed = true;
			}
		}
		return !syncFailed;
	} catch (err) {
		console.error('批量获取采购计划数据失败:', err);
		return false;
	}
}

async function hydratePurchasePlansForRowsInChunks(rows: any[], options: { syncLinkedPlans?: boolean } = {}) {
	const failedRows: any[] = [];

	batchReplenishPlanSyncProgress.value = { current: 0, total: rows.length };

	for (let start = 0; start < rows.length; start += PURCHASE_PLAN_SYNC_CHUNK_SIZE) {
		const chunk = rows.slice(start, start + PURCHASE_PLAN_SYNC_CHUNK_SIZE);
		const synced = await hydratePurchasePlansForRows(chunk, options);
		if (!synced) {
			failedRows.push(...chunk);
		}
		batchReplenishPlanSyncProgress.value = {
			current: Math.min(start + chunk.length, rows.length),
			total: rows.length
		};
	}

	const total = rows.length;
	const failedCount = failedRows.length;
	const successCount = Math.max(0, total - failedCount);
	if (failedCount <= 0) {
		return {
			status: "success" as const,
			total,
			successCount,
			failedCount: 0,
			message: `采购计划已刷新，已使用最新可关联采购计划重新计算分段。`,
			failedRows: []
		};
	}
	if (failedCount >= total) {
		return {
			status: "failed" as const,
			total,
			successCount: 0,
			failedCount: total,
			message: `采购计划刷新失败：已全部使用缓存采购计划数据。`,
			failedRows
		};
	}
	return {
		status: "partial_failed" as const,
		total,
		successCount,
		failedCount,
		message: `采购计划部分刷新失败：至少 ${failedCount}/${total} 个产品使用缓存采购计划数据。`,
		failedRows
	};
}

async function hydrateBatchReplenishDataForRowsInChunks(rows: any[]) {
	const failedRows: any[] = [];

	batchReplenishPlanSyncProgress.value = { current: 0, total: rows.length };

	for (let start = 0; start < rows.length; start += PURCHASE_PLAN_SYNC_CHUNK_SIZE) {
		const chunk = rows.slice(start, start + PURCHASE_PLAN_SYNC_CHUNK_SIZE);
		const [plansSynced, deliverySynced] = await Promise.all([
			hydratePurchasePlansForRows(chunk, { syncLinkedPlans: true }),
			hydratePendingDeliveryForRows(chunk, { syncLinkedOrders: true })
		]);

		if (!plansSynced || !deliverySynced) {
			failedRows.push(...chunk);
		}

		batchReplenishPlanSyncProgress.value = {
			current: Math.min(start + chunk.length, rows.length),
			total: rows.length
		};
	}

	const total = rows.length;
	const failedCount = failedRows.length;
	const successCount = Math.max(0, total - failedCount);
	if (failedCount <= 0) {
		return {
			status: "success" as const,
			total,
			successCount,
			failedCount: 0,
			message: `采购计划/待交付数据已刷新，已使用最新可关联数据重新计算分段。`,
			failedRows: []
		};
	}
	if (failedCount >= total) {
		return {
			status: "failed" as const,
			total,
			successCount: 0,
			failedCount: total,
			message: `采购计划/待交付数据刷新失败：已全部使用缓存数据。`,
			failedRows
		};
	}
	return {
		status: "partial_failed" as const,
		total,
		successCount,
		failedCount,
		message: `部分数据刷新失败：至少 ${failedCount}/${total} 个产品使用缓存数据。`,
		failedRows
	};
}

async function openBatchReplenishDialog() {
	const selectedRows = selectedListingRows.value;
	if (!selectedRows || selectedRows.length === 0) {
		ElMessage.warning("请先选择产品");
		return;
	}

	batchReplenishVisible.value = true;
	batchReplenishPlanSyncError.value = "";
	batchReplenishPlanSyncResult.value = null;
	batchReplenishPlanSyncProgress.value = { current: 0, total: selectedRows.length };
	batchReplenishPlanSyncing.value = true;
	try {
		const result = await hydrateBatchReplenishDataForRowsInChunks(selectedRows);
		batchReplenishPlanSyncResult.value = result;
		if (result.status !== "success") {
			batchReplenishPlanSyncError.value = result.message;
			ElMessage.warning(result.message);
		}
	} finally {
		batchReplenishPlanSyncing.value = false;
	}
}

async function retryBatchReplenishFailedSync() {
	const previousResult = batchReplenishPlanSyncResult.value;
	const failedRows = previousResult?.failedRows || [];
	if (batchReplenishPlanSyncing.value) return;
	if (!previousResult || failedRows.length === 0) {
		ElMessage.info("暂无失败项需要继续刷新");
		return;
	}

	const originalTotal = previousResult.total || failedRows.length;
	batchReplenishPlanSyncError.value = "";
	batchReplenishPlanSyncProgress.value = { current: 0, total: failedRows.length };
	batchReplenishPlanSyncing.value = true;
	try {
		const retryResult = await hydrateBatchReplenishDataForRowsInChunks(failedRows);
		const retryFailedRows = retryResult.failedRows || [];
		const failedCount = retryFailedRows.length;
		const successCount = Math.max(0, originalTotal - failedCount);
		const status = failedCount <= 0
			? "success"
			: (failedCount >= originalTotal ? "failed" : "partial_failed");
		const message = failedCount <= 0
			? `失败项已刷新成功，数据已刷新 ${originalTotal}/${originalTotal}。`
			: `继续刷新后仍有 ${failedCount}/${originalTotal} 个产品失败，其余已使用最新数据。`;

		batchReplenishPlanSyncResult.value = {
			status,
			total: originalTotal,
			successCount,
			failedCount,
			message,
			failedRows: retryFailedRows
		};

		if (status === "success") {
			batchReplenishPlanSyncError.value = "";
			ElMessage.success(message);
			return;
		}

		batchReplenishPlanSyncError.value = message;
		ElMessage.warning(message);
	} finally {
		batchReplenishPlanSyncing.value = false;
	}
}

// ========== 待交付数据加载（从本地采购单查询） ==========
async function hydratePendingDeliveryForRows(rows: any[], options: { syncLinkedOrders?: boolean } = {}) {
	const items = rows
		.filter((r) => r?.asin && r?.marketplace && r?.store_id)
		.map((r) => ({
			asin: r.asin,
			marketplace: r.marketplace,
			store_id: r.store_id,
			msku: r.msku,
			seller_name: r.seller_name,
			product_code: r.product_code,
			local_sku: r.local_sku
		}));

	if (items.length === 0) return true;

	// 去重
	const uniqueMap = new Map<string, { asin: string; marketplace: string; store_id: number; msku?: string; seller_name?: string; product_code?: string; local_sku?: string }>();
	for (const it of items) {
		uniqueMap.set(`${it.asin}|${it.marketplace}|${it.store_id}|${it.msku || ''}`, it);
	}

	try {
		const payload: any = { products: Array.from(uniqueMap.values()) };
		if (options.syncLinkedOrders) {
			payload.syncLinkedOrders = true;
		}
		const res = await (service.app.bsr_purchase_order_sync_lingxing as any).getPendingDeliveryByProducts(payload);

		// 填充到每一行
		let syncFailed = false;
		for (const row of rows) {
			if (!row?.asin || !row?.marketplace || !row?.store_id) continue;
			const key = `${row.asin}|${row.marketplace}|${row.store_id}|${row.msku || ''}`;
			const data = res?.[key];
			row.pending_delivery_qty = data?.pending_qty ?? 0;
			row.pending_delivery_count = data?.pending_count ?? 0;
			row.pending_delivery_details = data?.details ?? [];
			row.lingxing_pending_delivery_qty = data?.lingxing_pending_qty ?? 0;
			row.lingxing_pending_delivery_count = data?.lingxing_pending_count ?? 0;
			row.lingxing_pending_delivery_details = data?.lingxing_details ?? [];
			if (options.syncLinkedOrders && data?.sync_attempted && data?.sync_success === false) {
				syncFailed = true;
			}
		}
		return !syncFailed;
	} catch (err) {
		console.error('批量获取待交付数据失败:', err);
		return false;
	}
}

function getPendingDeliveryDisplayDetails(row: any) {
	return [
		...(Array.isArray(row?.pending_delivery_details) ? row.pending_delivery_details : []),
		...(Array.isArray(row?.lingxing_pending_delivery_details) ? row.lingxing_pending_delivery_details : [])
	];
}

function getPendingDeliveryDisplayQty(row: any) {
	const localQty = Number(row?.pending_delivery_qty) || 0;
	const lingxingQty = Number(row?.lingxing_pending_delivery_qty) || 0;
	return Math.max(0, Math.round(localQty + lingxingQty));
}

function getSourceLabel(detail: any) {
	const source = String(detail?.source || "").trim().toLowerCase();
	const label = String(detail?.source_label || "").trim();
	if (source === "lingxing" || label === "领星") return "领星";
	return "艾为";
}

function getSourceTagType(detail: any): 'success' | 'warning' | 'info' {
	return getSourceLabel(detail) === "领星" ? "warning" : "success";
}

// 待交付状态标签颜色
function getPendingDeliveryTagType(status: number, statusText?: string): 'success' | 'warning' | 'info' | 'danger' | 'primary' {
	const text = String(statusText || "").trim();
	if (text.includes("已驳回")) return "danger";
	if (text.includes("待到货")) return "warning";
	if (text.includes("待下单")) return "primary";
	if (text.includes("待提交") || text.includes("待审核")) return "info";

	switch (status) {
		case 2: return 'warning';  // 待到货
		case 1: return 'primary';  // 待下单
		case 3: return 'info';     // 待提交
		case 121: return 'info';   // 待审核
		case 122: return 'danger'; // 已驳回
		default: return 'info';
	}
}

async function handleTempStoredSaved(payload: any) {
	if (!payload || !payload.asin) return;
	
	// 父体收起时子体不在 Table.data 中，始终从顶层结构展开真实 Listing。
	const tableData = getLingxingRealRows(listingTopLevelRows.value);
	
	// Filter rows that match the payload (asin, marketplace, store_id)
	const targetRows = tableData.filter((r: any) => 
		r.asin === payload.asin && 
		r.marketplace === payload.marketplace && 
		(payload.store_id ? r.store_id === payload.store_id : true)
	);

	if (targetRows.length > 0) {
		await hydrateTempStoredQtyForRows(targetRows);
		refreshListingParentSummaries();
		ElMessage.success(`已刷新 ${payload.asin} 的暂存数据`);
	}
}

// 删除单条暂存记录
async function deleteTempStoredRecord(recordId: number, row: any) {
	try {
		await ElMessageBox.confirm('确定删除该条暂存记录？', '提示', {
			confirmButtonText: '确定',
			cancelButtonText: '取消',
			type: 'warning'
		});
	} catch {
		return; // 用户取消
	}

	try {
		await service.app.bsr_analysis_record_lingxing.delete({ ids: [recordId] });
		ElMessage.success('删除成功');
		// 刷新当前行的暂存数据
		await hydrateTempStoredQtyForRows([row]);
	} catch (err) {
		console.error('删除暂存记录失败:', err);
		ElMessage.error('删除失败');
	}
}
// 任务状态响应式数据
const taskStatus = ref({
	overallTask: {} as TaskInfo,
	searchTask: {} as TaskInfo,
	aliyunTask: {} as TaskInfo
});

// 获取任务状态
async function fetchTaskStatus() {
	try {
		const status = await service.app.amazon_product_Listing_Lingxing.getLatestTaskStatus();
		taskStatus.value = status;
	} catch (err) {
		console.error("获取任务状态失败:", err);
	}
}

// 计算属性：各任务状态
const isBzyTaskRunning = computed(() => taskStatus.value.overallTask?.taskStatus === "Running");
const lastBzyTaskStatus = computed(() => taskStatus.value.overallTask?.taskStatus);
const bzyTaskProgress = computed(() => {
	const task = taskStatus.value.overallTask;
	if (task?.taskStatus === "Running") {
		return task.executeResult || "正在执行...";
	}
	return "";
});

const isSearchTaskRunning = computed(() => taskStatus.value.searchTask?.taskStatus === "Running");
const lastSearchTaskStatus = computed(() => taskStatus.value.searchTask?.taskStatus);
const searchTaskProgress = computed(() => {
	const task = taskStatus.value.searchTask;
	if (task?.taskStatus === "Running") {
		return task.executeResult || "正在执行...";
	}
	return "";
});

const isAliyunTaskRunning = computed(() => taskStatus.value.aliyunTask?.taskStatus === "Running");
const lastAliyunTaskStatus = computed(() => taskStatus.value.aliyunTask?.taskStatus);
const aliyunTaskProgress = computed(() => {
	const task = taskStatus.value.aliyunTask;
	if (task?.taskStatus === "Running") {
		return task.executeResult || "正在执行...";
	}
	return "";
});

const isManualDeduplicateRunning = ref(false);

// 店铺选项
const storeOptions = ref<any[]>([]);
// 店铺名称选项
const shopOptions = ref<any[]>([]);

// 获取店铺列表
async function getStores() {
	try {
		const res = await service.app.bsr_product_Listing_Lingxing.getStores();
		storeOptions.value = res.map((item: string) => ({ label: item, value: item }));
	} catch (err) {
		console.error("获取店铺列表失败:", err);
	}
}

// 获取店铺名称列表
async function getShops() {
	try {
		const res = await service.app.bsr_product_Listing_Lingxing.getShops();
		shopOptions.value = res.map((item: string) => ({ label: item, value: item }));
	} catch (err) {
		console.error("获取店铺名称列表失败:", err);
	}
}

const priceForm = ref<any>(null);

// 2026-04-24: 弃置费计算逻辑
function getDisposalFee(listing: any) {
	const l = Number(listing.tactic_length) || 0;
	const w = Number(listing.tactic_width) || 0;
	const h = Number(listing.tactic_height) || 0;
	const actual_weight = Number(listing.tactic_weight) || 0;
	
	if (l === 0 || w === 0 || h === 0 || actual_weight === 0) return 0;
	
	// Sort dimensions descending
	const dims = [l, w, h].sort((a, b) => b - a);
	const longest = dims[0];
	const median = dims[1];
	const shortest = dims[2];
	
	const volume_weight = (l * w * h) / 5000;
	const chargeable_weight_kg = Math.max(actual_weight, volume_weight);
	const weight_g = chargeable_weight_kg * 1000;
	
	// Determine size tier (Standard vs Oversize)
	const isStandard = (actual_weight <= 11.9) && (longest <= 45) && (median <= 34) && (shortest <= 26);
	
	const mkp = listing.marketplace || '';
	const isUK = ['英国', 'UK', 'GB'].includes(mkp.toUpperCase());
	
	let fee = 0;
	if (isStandard) {
		if (isUK) {
			if (weight_g <= 200) fee = 0.74;
			else if (weight_g <= 500) fee = 1.15;
			else if (weight_g <= 1000) fee = 2.28;
			else fee = 2.73 + Math.ceil((weight_g - 1000) / 1000) * 0.88;
		} else { // EUR
			if (weight_g <= 200) fee = 0.74;
			else if (weight_g <= 500) fee = 1.19;
			else if (weight_g <= 1000) fee = 2.73;
			else fee = 3.73 + Math.ceil((weight_g - 1000) / 1000) * 1.41;
		}
	} else { // Oversize
		if (isUK) {
			if (weight_g <= 500) fee = 3.06;
			else if (weight_g <= 1000) fee = 6.56;
			else if (weight_g <= 2000) fee = 9.68;
			else if (weight_g <= 5000) fee = 12.26;
			else fee = 16.06 + Math.ceil((weight_g - 5000) / 1000) * 0.88;
		} else { // EUR
			if (weight_g <= 500) fee = 3.74;
			else if (weight_g <= 1000) fee = 7.67;
			else if (weight_g <= 2000) fee = 10.66;
			else if (weight_g <= 5000) fee = 14.59;
			else fee = 15.23 + Math.ceil((weight_g - 5000) / 1000) * 1.55;
		}
	}
	return fee;
}

// 2026-04-23: 计算调价策略中的各项参考价格
function calculateTargetPrice(listing: any, targetProfitRate: number) {
	if (!listing) return "-";
	
	const cost = Number(listing.tactic_cost_rmb) || 0;
	const firstLeg = Number(listing.tactic_first_leg_rmb) || 0;
	const ff = Number(listing.fba_fee) || 0;
	
	if (cost === 0 || firstLeg === 0) return "-";
	
	// 固定成本(外币) = 商品成本(外币) + 头程(外币) + FBA配送费
	const fixedCost = cost + firstLeg + ff;
	
	// 亚马逊平台费率按15%，VAT按16.5%
	const feeRate = 0.15 + 0.165;
	
	// 平本价公式: targetPrice * (1 - 15% - 16.5%) - fixedCost = 利润
	// 所以 targetPrice = (fixedCost + 利润) / (1 - 15% - 16.5%)
	// 这里利润 = targetPrice * targetProfitRate
	// targetPrice = fixedCost / (1 - feeRate - targetProfitRate)
	const denominator = 1 - feeRate - targetProfitRate;
	if (denominator <= 0) return "-";
	
	const targetPrice = fixedCost / denominator;
	return listing.tactic_exchange_rate ? `${listing.tactic_exchange_rate} ${targetPrice.toFixed(2)}` : targetPrice.toFixed(2);
}

function calculateClearancePrice(listing: any) {
	if (!listing) return "-";
	
	const ff = Number(listing.fba_fee) || 0;
	const disposalFee = getDisposalFee(listing);
	
	// 清仓价公式: 售价 * (1 - 15% - 16.5%) - FBA配送费 + 弃置费 = 0
	// 售价 = (FBA配送费 - 弃置费) / (1 - 15% - 16.5%)
	const feeRate = 0.15 + 0.165;
	if (1 - feeRate <= 0) return "-";
	
	const clearancePrice = (ff - disposalFee) / (1 - feeRate);
	
	// 如果清仓价算出来是负数，说明卖出去也不如直接弃置（即弃置费大于FBA配送费），但通常会展示0或实际数值
	const displayPrice = clearancePrice > 0 ? clearancePrice : 0;
	return listing.tactic_exchange_rate ? `${listing.tactic_exchange_rate} ${displayPrice.toFixed(2)}` : displayPrice.toFixed(2);
}

async function openPriceStrategy(row: any) {
	if (!row.asin) {
		ElMessage.warning("缺少 ASIN 信息");
		return;
	}

	try {
		// 1. 查找对应的 Listing
		const res = await service.app.bsr_product_Listing_Lingxing.page({
			asin: row.asin,
			marketplace: row.marketplace,
			seller_name: row.seller_name,
			msku: row.msku,
			page: 1,
			size: 1
		});

		if (!res.list || res.list.length === 0) {
			ElMessage.warning(`未找到 ASIN: ${row.asin} 的 Listing 信息`);
			return;
		}

		let listing = res.list[0];

		// 检查长宽高是否缺失，如果缺失则自动获取
		if (!listing.tactic_length || !listing.tactic_width || !listing.tactic_height) {
			try {
				const fetchRes = await service.app.bsr_product_Listing_Lingxing.fetchSinglePricingAndDimensions({
					id: listing.id,
					sid: listing.store_id,
					msku: listing.msku,
					marketplace: listing.marketplace
				});
				if (fetchRes) {
					// 合并新数据到 listing 对象中
					listing = { ...listing, ...fetchRes };
					ElMessage.success("已自动获取最新的长宽高及价格数据");
				}
			} catch (error) {
				console.error("自动获取长宽高失败：", error);
			}
		}

		// 准备 tagsRenderList
		let curTags = listing.tags ?? [];
		listing.tagsRenderList = LISTING_TAGS.map((TAG: any) => {
			return { ...TAG, active: curTags.includes(TAG.value) };
		})
			.sort((a: any, b: any) => curTags.indexOf(a.value) - curTags.indexOf(b.value))
			.sort((a: any, b: any) => (a.active === b.active ? 0 : (a.active && !b.active ? -1 : 1)));

		// 2. 打开表单
		priceForm.value?.open({
			title: "调价策略",
			width: "800px",
			items: [
				{
					type: "tabs",
					props: {
						type: "card",
						labels: [
							{ label: "基础信息", value: "base" },
							{ label: "新品策略", value: "new" },
							{ label: "竞品策略", value: "competitor" },
							{ label: "清仓策略", value: "clearance" },
							{ label: "日常策略", value: "normal" }
						]
					}
				},
				{
					prop: "seller_name",
					label: "店铺",
					group: "base",
					props: { labelWidth: "80px" },
					component: { name: "el-select", props: { options: shopOptions.value, clearable: true, filterable: true, style: "width: 100%;" } },
					span: 8
				},
				{
					prop: "asin",
					label: "ASIN",
					props: { labelWidth: "80px" },
					component: { name: "el-input", props: { disabled: true } },
					group: "base",
					span: 8
				},
				{
					prop: "msku",
					label: "MSKU",
					props: { labelWidth: "80px" },
					component: { name: "el-input", props: { disabled: true } },
					group: "base",
					span: 8
				},
				{
					prop: "tactic_cost_rmb",
					label: "商品成本",
					props: { labelWidth: "80px" },
					component: { name: "el-input-number", props: { min: 0, "controls-position": "right" } },
					group: "base",
					span: 8
				},
				{
					prop: "tactic_first_leg_rmb",
					label: "头程运费",
					props: { labelWidth: "80px" },
					component: { name: "el-input-number", props: { min: 0, "controls-position": "right" } },
					group: "base",
					span: 8
				},
				{
					prop: "tactic_exchange_rate",
					label: "币种",
					props: { labelWidth: "80px" },
					component: { name: "el-input" },
					group: "base",
					span: 8
				},
				// 2026-04-24 修改：实重不要了，改为注释保留
				/* {
					prop: "tactic_weight",
					label: "实重(kg)",
					props: { labelWidth: upsert_short_label_width },
					component: { name: "el-input-number", props: { min: 0, step: 0.01 } },
					group: "base",
					span: 12
				}, */
				{
					prop: "tactic_length",
					label: "长(cm)",
					props: { labelWidth: "80px" },
					component: { name: "el-input-number", props: { min: 0, step: 0.1, "controls-position": "right" } },
					group: "base",
					span: 8
				},
				{
					prop: "tactic_width",
					label: "宽(cm)",
					props: { labelWidth: "80px" },
					component: { name: "el-input-number", props: { min: 0, step: 0.1, "controls-position": "right" } },
					group: "base",
					span: 8
				},
				{
					prop: "tactic_height",
					label: "高(cm)",
					props: { labelWidth: "80px" },
					component: { name: "el-input-number", props: { min: 0, step: 0.1, "controls-position": "right" } },
					group: "base",
					span: 8
				},
				{
					prop: "manual_fetch_btn",
					label: "",
					props: { labelWidth: "80px" },
					component: {
						name: "el-button",
						props: {
							type: "primary",
							icon: "Refresh",
							plain: true,
							style: "width: 100%; margin-bottom: 10px; margin-top: 5px;"
						},
						on: {
							click: async () => {
								try {
									const formRef = priceForm.value;
									const formValues = formRef.getForm();
									if (!formValues.id || !formValues.store_id || !formValues.msku) {
										ElMessage.warning("缺少必要参数无法获取");
										return;
									}
									
									formRef.showLoading();
									const fetchRes = await service.app.bsr_product_Listing_Lingxing.fetchSinglePricingAndDimensions({
										id: formValues.id,
										sid: formValues.store_id,
										msku: formValues.msku,
										marketplace: formValues.marketplace
									});
									
									if (fetchRes && Object.keys(fetchRes).length > 0) {
										formRef.setForm(fetchRes);
										ElMessage.success("已更新最新的长宽高及价格数据");
									} else {
										ElMessage.warning("未获取到新数据");
									}
								} catch (error) {
									console.error("手动获取数据失败：", error);
									ElMessage.error("获取失败");
								} finally {
									priceForm.value.hideLoading();
								}
							}
						},
						slots: {
							default: () => "获取最新数据"
						}
					},
					group: "base",
					span: 24
				},
				{
					prop: "calculated_prices",
					props: { labelWidth: "0px" },
					group: "base",
					component: { name: "slot-price-info" }
				},
				{
					prop: "tactic_switch",
					props: { labelWidth: "0px" },
					group: "base",
					component: {
						name: "cl-form-card",
						props: {
							label: "策略启用",
							expand: true,
							isExpand: true
						}
					},
					children: [
						{
							prop: "tactic_inventory_active",
							label: "补货策略",
							props: { labelWidth: upsert_short_label_width },
							component: {
								name: "cl-switch",
								props: {
									"active-text": "启用",
									"inactive-text": "关闭",
									"inline-prompt": true
								}
							},
							span: 10
						},
						{
							label: "低于该可售天数时触发",
							prop: "tactic_inventory_min_salable_days",
							hook: "number",
							props: { labelWidth: "160px" },
							component: { name: "el-input-number", props: { min: 0 } },
							span: 14
						},
						{
							prop: "tags",
							label: "调价策略",
							props: { labelWidth: upsert_short_label_width },
							component: { name: "slot-edit-tags" }
						}
					]
				},

				{
					prop: "tactic_new",
					props: { labelWidth: "0px" },
					group: "new",
					component: {
						name: "cl-form-card",
						props: {
							label: "新品调价策略",
							expand: true,
							isExpand: true
						}
					},
					children: [
						{
							prop: "test_p1_btn",
							label: "测试策略",
							component: {
								vm: StrategyTestBtn,
								props: {
									strategyType: "p1",
									strategyName: "新品策略"
								}
							},
							props: { labelWidth: "160px" }
						},
						{
							label: "新品上架日期",
							prop: "tactic_new_product_date",
							props: { labelWidth: "160px" },
							component: {
								name: "el-date-picker",
								props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
							},
							group: "new"
						},
						{
							label: "新品调价数值",
							prop: "tactic_new_price_modify_value",
							props: { labelWidth: "160px" },
							hook: "number",
							component: { name: "el-input-number", props: { min: 0 } }
						},
						{
							label: "新品预期日单量",
							prop: "tactic_new_product_expected_daily_order_quantity",
							props: { labelWidth: "160px" },
							hook: "number",
							component: { name: "el-input-number" }
						},
						{
							label: "新品单量预警阈值 (%)",
							prop: "tactic_new_product_price_alert_threshold",
							props: { labelWidth: "160px" },
							hook: "number",
							component: { name: "el-input-number", props: { min: 0, max: 100 } }
						},
						{
							label: "新品调价幅度 (%)",
							prop: "tactic_new_price_modify_range",
							props: { labelWidth: "160px" },
							hook: "number",
							component: { name: "el-input-number", props: { min: 0, max: 200 } },
							required: true
						},
					]
				},

				{
					prop: "tactic_competitor",
					props: { labelWidth: "0px" },
					group: "competitor",
					component: {
						name: "cl-form-card",
						props: {
							label: "竞品调价策略",
							expand: true,
							isExpand: true
						}
					},
					children: [
						{
							prop: "test_p2_btn",
							label: "测试策略",
							component: {
								vm: StrategyTestBtn,
								props: {
									strategyType: "p2",
									strategyName: "竞品策略"
								}
							},
							props: { labelWidth: "160px" }
						},
						{
							label: "涨价触发幅度 (%)",
							prop: "tactic_competitor_price_up_threshold",
							props: { labelWidth: "160px" },
							hook: "number",
							component: { name: "el-input-number" }
						},
						{
							label: "降价触发幅度 (%)",
							prop: "tactic_competitor_price_down_threshold",
							props: { labelWidth: "160px" },
							hook: "number",
							component: { name: "el-input-number" }
						}
					]
				},

				{
					prop: "tactic_clearance-price",
					props: { labelWidth: "0px" },
					group: "clearance",
					component: {
						name: "cl-form-card",
						props: {
							label: "清仓调价策略-价格相关",
							expand: true,
							isExpand: true
						}
					},
					children: [
						{
							prop: "test_p3_btn",
							label: "测试策略",
							component: {
								vm: StrategyTestBtn,
								props: {
									strategyType: "p3",
									strategyName: "清仓策略"
								}
							},
							props: { labelWidth: "160px" }
						},
						{
							label: "清仓调价幅度 (%)",
							props: { labelWidth: "160px" },
							prop: "tactic_clearance_price_modify_range",
							hook: "number",
							component: { name: "el-input-number", props: { min: 0, max: 200 } },
							required: true
						},
						{
							label: "清仓调价数值",
							props: { labelWidth: "160px" },
							prop: "tactic_clearance_price_modify_value",
							hook: "number",
							component: { name: "el-input-number", props: { min: 0 } }
						},
						{
							label: "【清仓价格】上限：",
							props: { labelWidth: "160px" },
							prop: "tactic_clearance_price_modify_upper_limit",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false
						},
						{
							label: "下限：",
							prop: "tactic_clearance_price_modify_lower_limit",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false,
							props: { labelWidth: "125" }
						}
					]
				},
				{
					prop: "tactic_clearance-orders",
					props: { labelWidth: "0px" },
					group: "clearance",
					component: {
						name: "cl-form-card",
						props: {
							label: "清仓调价策略-预期日单量设置",
							expand: true,
							isExpand: true
						}
					},
					children: [
						{
							label: "【09 时前】最小：",
							props: { labelWidth: "160px" },
							prop: "tactic_clearance_expected_order_min_before_9",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false
						},
						{
							label: "最大：",
							prop: "tactic_clearance_expected_order_max_before_9",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false,
							props: { labelWidth: "125" }
						},
						{
							label: "【12 时前】最小：",
							props: { labelWidth: "160px" },
							prop: "tactic_clearance_expected_order_min_before_12",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false
						},
						{
							label: "最大：",
							prop: "tactic_clearance_expected_order_max_before_12",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false,
							props: { labelWidth: "125" }
						},
						{
							label: "【15 时前】最小：",
							props: { labelWidth: "160px" },
							prop: "tactic_clearance_expected_order_min_before_15",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false
						},
						{
							label: "最大：",
							prop: "tactic_clearance_expected_order_max_before_15",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false,
							props: { labelWidth: "125" }
						},
						{
							label: "【18 时前】最小：",
							props: { labelWidth: "160px" },
							prop: "tactic_clearance_expected_order_min_before_18",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false
						},
						{
							label: "最大：",
							prop: "tactic_clearance_expected_order_max_before_18",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false,
							props: { labelWidth: "125" }
						},
						{
							label: "【21 时前】最小：",
							props: { labelWidth: "160px" },
							prop: "tactic_clearance_expected_order_min_before_21",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false
						},
						{
							label: "最大：",
							prop: "tactic_clearance_expected_order_max_before_21",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false,
							props: { labelWidth: "125" }
						},
						{
							label: "【24 时前】最小：",
							props: { labelWidth: "160px" },
							prop: "tactic_clearance_expected_order_min_before_24",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false
						},
						{
							label: "最大：",
							prop: "tactic_clearance_expected_order_max_before_24",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false,
							props: { labelWidth: "125" }
						}
					]
				},

				{
					prop: "tactic_normal-inventory",
					props: { labelWidth: "0px" },
					group: "normal",
					component: {
						name: "cl-form-card",
						props: {
							label: "日常调价策略 - 以库存天数为目标",
							expand: true,
							isExpand: true
						}
					},
					children: [
						{
							prop: "test_p4_btn",
							label: "测试策略",
							component: {
								vm: StrategyTestBtn,
								props: {
									strategyType: "p4",
									strategyName: "日常策略"
								}
							},
							props: { labelWidth: "160px" }
						},
						{
							label: "【触发库存天数】小于：",
							props: { labelWidth: "180px" },
							prop: "tactic_normal_target_inventory_days_min",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false
						},
						{
							label: "或大于：",
							prop: "tactic_normal_target_inventory_days_max",
							hook: "number",
							component: { name: "el-input-number" },
							span: 12,
							flex: false,
							props: { labelWidth: "125" }
						}
					]
				},
				{
					prop: "tactic_normal-orders",
					props: { labelWidth: "0px" },
					group: "normal",
					component: {
						name: "cl-form-card",
						props: {
							label: "日常调价策略 - 以日均出单为目标",
							expand: true,
							isExpand: true
						}
					},
					children: [
						{
							label: "目标日均出单",
							props: { labelWidth: "160px" },
							prop: "tactic_normal_target_daily_order_quantity",
							hook: "number",
							component: { name: "el-input-number" }
						},
						{
							label: "日均出单触发阈值 (%)",
							props: { labelWidth: "160px" },
							prop: "tactic_normal_target_daily_order_quantity_alert_threshold",
							hook: "number",
							component: { name: "el-input-number" }
						}
					]
				},
				{
					prop: "tactic_normal-searches",
					props: { labelWidth: "0px" },
					group: "normal",
					component: {
						name: "cl-form-card",
						props: {
							label: "日常调价策略 - 搜索量突变预警",
							expand: true,
							isExpand: true
						}
					},
					children: [
						{
							label: "搜索量突变预警阈值 (%)",
							props: { labelWidth: "180px" },
							prop: "tactic_normal_sharp_change_alert_threshold",
							hook: "number",
							component: { name: "el-input-number" }
						}
					]
				},
				{
					prop: "tactic_normal-price",
					props: { labelWidth: "0px" },
					group: "normal",
					component: {
						name: "cl-form-card",
						props: {
							label: "日常调价策略 - 价格相关",
							expand: true,
							isExpand: true
						}
					},
					children: [
						{
							label: "日常调价幅度 (%)",
							props: { labelWidth: "160px" },
							prop: "tactic_normal_price_modify_range",
							hook: "number",
							component: { name: "el-input-number", props: { min: 0, max: 200 } },
							required: true
						},
						{
							label: "日常调价数值",
							props: { labelWidth: "160px" },
							prop: "tactic_normal_price_modify_value",
							hook: "number",
							component: { name: "el-input-number", props: { min: 0 } }
						}
					]
				},

				{
					prop: "tactic_ignore_until",
					props: { labelWidth: "0px" },
					group: "base",
					component: {
						name: "cl-form-card",
						props: {
							label: "暂停策略触发",
							expand: true,
							isExpand: true
						}
					},
					children: [
						{
						label: "不再提醒调价直至",
						prop: "tactic_price_ignore_until",
						props: { labelWidth: "160px" },
						component: {
							name: "el-date-picker",
							props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
						}
					},
					{
						label: "不再提醒补货直至",
						prop: "tactic_inventory_ignore_until",
						props: { labelWidth: "160px" },
						component: {
							name: "el-date-picker",
							props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
						}
					}
					]
				}
			],
			form: {
				...listing
			},
			on: {
				async submit(data: any, { close, done }: any) {
					let submitData = {
						...data,
						tags: data.tagsRenderList.filter((o: any) => o.active).map((o: any) => o.value)
					};

					try {
						await service.app.bsr_product_Listing_Lingxing.update({
							id: listing.id,
							...submitData
						});
						ElMessage.success("更新成功");
						close();
					} catch (err) {
						ElMessage.error(String(err));
						done();
					}
				}
			}
		});
	} catch (err) {
		console.error(err);
		ElMessage.error("获取 Listing 失败");
	}
}

onMounted(() => {
	getStores();
	getShops();
	fetchTaskStatus();
	// 每一分钟自动刷新一次状态
	const timer = setInterval(fetchTaskStatus, 60000);
	return () => clearInterval(timer);
});

// 筛选条件
const filters = ref({
	outOfStockStatus: undefined,
	abnormalOfflineStatus: undefined,
	newProductStatus: undefined,
	inventoryStatusText: undefined,
	// needUpdateOperationPlan: undefined,
	categoryTrafficStatus: undefined,
	productTrafficStatus: undefined,
	salesChangeStatus: undefined, // 2026-04-23: 新增销量变化状态
	stockOver90Days: undefined,
	status: undefined,
	marketplace: undefined,
	seller_name: undefined,
	shop: undefined,
	combinedStatus: undefined,
	trafficCombined: undefined,
	sellableDaysCondition: undefined,
	sellableDaysValue: undefined,
	stockoutRiskFilter: "all"
});

let sellableDaysFilterTimer: ReturnType<typeof setTimeout> | undefined;

function handleSearchFieldChange(value: string) {
	searchField.value = value || "msku";
	searchKeywordInput.value = "";
}

function splitBatchSearchKeywords(value: string) {
	return Array.from(
		new Set(
			String(value || "")
				.split(/[\r\n,，;；\t]+/)
				.map((item) => item.trim())
				.filter(Boolean)
		)
	);
}

function handleBatchSearch(params: any, { next }: { next: (data?: any) => void }) {
	const keywordList = splitBatchSearchKeywords(searchKeywordInput.value);

	next({
		...params,
		searchField: keywordList.length ? searchField.value : undefined,
		searchKeywordList: keywordList.length ? keywordList : undefined,
		keyWord: undefined,
		msku: undefined,
		item_name: undefined,
		asin: undefined,
		product_code: undefined
	});
}

const handleSellableDaysFilterChange = () => {
	// 2026-03-06: Parse sellableDaysCondition to type and operator
	let type = undefined;
	let operator = undefined;

	if (filters.value.sellableDaysCondition) {
		const parts = filters.value.sellableDaysCondition.split("_");
		if (parts.length === 2) {
			type = parts[0];
			operator = parts[1];
		}
	}

	Crud.value?.refresh({
		sellableDaysType: type,
		sellableDaysOperator: operator,
		sellableDaysValue: filters.value.sellableDaysValue,
		stockoutRiskFilter:
			filters.value.stockoutRiskFilter && filters.value.stockoutRiskFilter !== "all"
				? filters.value.stockoutRiskFilter
				: undefined,
		page: 1
	});
};

// 2026-04-03: 弃用原有的 handleSellableDaysValueInput，改为 blur 和 enter 触发
// const handleSellableDaysValueInput = () => {
// 	if (sellableDaysFilterTimer) {
// 		clearTimeout(sellableDaysFilterTimer);
// 	}
//
// 	sellableDaysFilterTimer = setTimeout(() => {
// 		handleSellableDaysFilterChange();
// 	}, 300);
// };

// 筛选选项
const outOfStockOptions = [
	{ label: "正常", value: 1 },
	{ label: "断货", value: 0 }
];

const marketplaceOptions = [
	{ label: "英国", value: "英国" },
	{ label: "德国", value: "德国" },
	{ label: "法国", value: "法国" },
	{ label: "西班牙", value: "西班牙" },
	{ label: "意大利", value: "意大利" }
];
const status = [
	{ label: "正常", value: 1 },
	{ label: "断货", value: 0 }
];

const abnormalOfflineOptions = [
	{ label: "正常", value: 0 },
	{ label: "异常下架", value: 1 }
];

const newProductStatusOptions = [
	{ label: "无", value: 0 },
	// { label: "新品在途", value: 1 },
	{ label: "产品创建时间新品在途", value: 11 },
	{ label: "listing创建时间新品在途", value: 12 },
	{ label: "新品到货无销量", value: 2 },
	{ label: "到货超过7天无销量", value: 3 },
	{ label: "到货超过14天无销量", value: 4 },
	{ label: "到货超过30天无销量", value: 5 }
];

const needUpdateOperationPlanOptions = [
	{ label: "否", value: 0 },
	{ label: "是", value: 1 }
];

const trafficStatusOptions = [
	{ label: "无变化", value: 0 },
	{ label: "降低", value: 1 },
	{ label: "增长", value: 2 }
];

const trafficFilterOptions = [
	{ label: "全部", value: "" },
	{ label: "类目增长", value: "categoryUp" },
	{ label: "类目降低", value: "categoryDown" },
	{ label: "产品增长", value: "productUp" },
	{ label: "产品降低", value: "productDown" }
];

const stockOver90DaysOptions = [
	{ label: "否", value: 0 },
	{ label: "是", value: 1 }
];

// 2026-04-23: 新增日均销量变化状态选项
const salesChangeStatusOptions = [
	{ label: "销量稳定", value: "销量稳定" },
	{ label: "14天无单", value: "14天无单" },
	{ label: "7天无单", value: "7天无单" },
	{ label: "3天无单", value: "3天无单" },
	{ label: "短期突降", value: "短期突降" },
	{ label: "短期突增", value: "短期突增" },
	{ label: "明显增长", value: "明显增长" },
	{ label: "明显下滑", value: "明显下滑" },
	{ label: "小幅增长", value: "小幅增长" },
	{ label: "小幅下滑", value: "小幅下滑" },
	{ label: "销量平稳", value: "销量平稳" }
];

// 处理筛选变化
const handleFilterChange = (filterType: string, value: any) => {
	if (
		value === "" ||
		value === null ||
		value === undefined ||
		(Array.isArray(value) && value.length === 0)
	) {
		(filters.value as any)[filterType] = undefined;
	}

	if (filterType === 'newProductStatus') {
		let params: any = { page: 1 };
		if (value === 11) {
			params.newProductStatus = 1;
			params.in_transit_type = [1, 3];
		} else if (value === 12) {
			params.newProductStatus = 1;
			params.in_transit_type = [2, 3];
		} else {
			params.newProductStatus = (filters.value as any).newProductStatus;
			params.in_transit_type = undefined;
		}
		Crud.value?.refresh(params);
		return;
	}

	Crud.value?.refresh({ [filterType]: (filters.value as any)[filterType], page: 1 });
};

const handleTrafficFilterChange = (value: any) => {
	filters.value.categoryTrafficStatus = undefined;
	filters.value.productTrafficStatus = undefined;

	if (value === "categoryUp") {
		filters.value.categoryTrafficStatus = 2;
	} else if (value === "categoryDown") {
		filters.value.categoryTrafficStatus = 1;
	} else if (value === "productUp") {
		filters.value.productTrafficStatus = 2;
	} else if (value === "productDown") {
		filters.value.productTrafficStatus = 1;
	}

	Crud.value?.refresh({
		categoryTrafficStatus: filters.value.categoryTrafficStatus,
		productTrafficStatus: filters.value.productTrafficStatus,
		page: 1
	});
};

// 处理合并状态筛选变化
const handleCombinedStatusChange = (value: string) => {
	filters.value.status = undefined;
	filters.value.abnormalOfflineStatus = undefined;

	if (value === "normal") {
		filters.value.status = 1;
		filters.value.abnormalOfflineStatus = 0;
	} else if (value === "outOfStock") {
		filters.value.abnormalOfflineStatus = 0;
		filters.value.status = 0;
	} else if (value === "abnormalOffline") {
		filters.value.status = 3;
		filters.value.abnormalOfflineStatus = 1;
	}

	Crud.value?.refresh({
		status: filters.value.status,
		abnormalOfflineStatus: filters.value.abnormalOfflineStatus,
		page: 1
	});
};

// --- 任务操作方法 ---

async function bzyShiTu() {
	try {
		taskStatus.value.overallTask = {
			...taskStatus.value.overallTask,
			taskStatus: "Running",
			executeResult: "任务开始执行..."
		};

		const result = await service.app.amazon_product_Listing_Lingxing.bzyShiTu_UK();
		console.log("八爪鱼识图任务启动结果:", result);
		await fetchTaskStatus();
		ElMessage.success("八爪鱼识图任务已启动");
	} catch (err) {
		console.error("八爪鱼识图任务启动失败:", err);
		ElMessage.error(`启动失败: ${(err as Error).message || "未知错误"}`);
		await fetchTaskStatus();
	}
}

async function searchByItemName() {
	try {
		taskStatus.value.searchTask = {
			...taskStatus.value.searchTask,
			taskStatus: "Running",
			executeResult: "任务开始执行..."
		};

		const result = await service.app.amazon_product_Listing_Lingxing.searchByItemName();
		console.log("搜索任务启动结果:", result);
		await fetchTaskStatus();
		ElMessage.success("搜索任务已启动");
	} catch (err) {
		console.error("搜索任务启动失败:", err);
		ElMessage.error(`启动失败: ${(err as Error).message || "未知错误"}`);
		await fetchTaskStatus();
	}
}

async function manualDeduplicate() {
	try {
		isManualDeduplicateRunning.value = true;
		const result = await service.app.amazon_product_Listing_Lingxing.manualDeduplicate();
		console.log("手动去重结果:", result);
		if (result && result.message) {
			ElMessage.success(result.message);
		} else {
			ElMessage.success("手动去重完成");
		}
	} catch (err) {
		console.error("手动去重失败:", err);
		ElMessage.error(`去重失败: ${(err as Error).message || "未知错误"}`);
	} finally {
		isManualDeduplicateRunning.value = false;
	}
}

async function aliyunImageSearch() {
	try {
		taskStatus.value.aliyunTask = {
			...taskStatus.value.aliyunTask,
			taskStatus: "Running",
			executeResult: "任务开始执行..."
		};

		const result = await service.app.amazon_product_Listing_Lingxing.aliyunImageSearch();
		console.log("阿里云对比任务启动结果:", result);
		await fetchTaskStatus();
		ElMessage.success("阿里云图片对比任务已启动");
	} catch (err) {
		console.error("阿里云对比任务启动失败:", err);
		ElMessage.error(`启动失败: ${(err as Error).message || "未知错误"}`);
		await fetchTaskStatus();
	}
}

async function aliyunImageUpload() {
	try {
		const result = await service.app.amazon_product_Listing_Lingxing.aliyunImageUpload();
		console.log("阿里云上传任务启动结果:", result);
		ElMessage.success("阿里云上传任务已启动");
	} catch (err) {
		console.error("阿里云上传任务启动失败:", err);
		ElMessage.error(`启动失败: ${(err as Error).message || "未知错误"}`);
	}
}

async function getCompetitor() {
	try {
		ElMessage.info("正在请求竞品详情...");
		await service.app.amazon_product_Listing_Lingxing.getCompetitor();
		ElMessage.success("请求已发送");
	} catch (err) {
		ElMessage.error("获取竞品详情失败");
	}
}

async function requestLingXingListing() {
	try {
		ElMessage.info("正在获取数据...");
		await service.app.bsr_product_Listing_Lingxing.requestLingXingListing();
		ElMessage.success("获取数据任务已启动");
	} catch (err) {
		ElMessage.error("获取数据失败");
	}
}

async function batchUpdateCompetitorDetails() {
	try {
		ElMessage.info("正在批量更新竞品详情...");
		const res = await service.app.bsr_product_Listing_Lingxing.batchUpdateCompetitorDetails();
		if (res && res.message) {
			ElMessage.warning(res.message);
		} else {
			ElMessage.success("批量更新任务已启动，请稍后查看结果");
		}
	} catch (err) {
		console.error(err);
		ElMessage.error("启动失败");
	}
}

async function requestLingXingShipmentStatus() {
	const selectedIds = selectedListingRows.value.map((row: any) => row.id);

	if (!selectedIds || selectedIds.length === 0) {
		ElMessage.warning("请先选择要获取在途状态的产品");
		return;
	}

	try {
		await service.app.bsr_restocking_center_lingxing.requestLingXingShipmentStatus({
			ids: selectedIds
		});
		ElMessage.success("更新在途状态任务已启动");
	} catch (err) {
		ElMessage.error("更新失败");
	}
}

async function syncRealtimeSales() {
	try {
		ElMessage.info("正在更新实时销量...");
		const res = await service.app.bsr_restocking_center_lingxing.syncRealtimeSales();
		ElMessage.success("实时销量更新完成");
		Crud.value?.refresh();
		return res;
	} catch (err) {
		ElMessage.error("更新实时销量失败");
	}
}

async function updateInventoryStatus() {
	const selectedIds = selectedListingRows.value.map((row: any) => row.id);

	if (!selectedIds || selectedIds.length === 0) {
		ElMessage.warning("请先选择要更新库存状态的产品");
		return;
	}

	try {
		ElMessage.info("正在更新库存状态...");
		await service.app.bsr_product_Listing_Lingxing.updateInventoryStatus({ ids: selectedIds });
		ElMessage.success("更新库存状态成功");
		Crud.value?.refresh();
	} catch (err) {
		console.error("更新库存状态失败:", err);
		ElMessage.error("更新库存状态失败");
	}
}


// 合并编号处理函数
const handleMergeId = async () => {
	try {
		const selectedRows = selectedListingRows.value;
		if (!selectedRows || selectedRows.length < 2) {
			ElMessage.warning("请至少选择两条数据进行合并编号操作");
			return;
		}

		const targetMergeId = selectedRows[0].mergeId;
		if (!targetMergeId) {
			ElMessage.warning("选中的第一个产品没有合并编号，无法作为目标编号");
			return;
		}

		const ids = selectedRows.map((row: any) => row.id);
		const affectedCount = selectedRows.length;

		ElMessageBox.confirm(
			`确定要将选中的 ${affectedCount} 条数据的合并编号统一设置为 ${targetMergeId} 吗？`,
			"确认合并编号",
			{
				confirmButtonText: "确定",
				cancelButtonText: "取消",
				type: "warning"
			}
		)
			.then(async () => {
				const loading = ElLoading.service({
					lock: true,
					text: "正在更新合并编号，请稍候...",
					background: "rgba(0, 0, 0, 0.7)"
				});

				try {
					const res = await service.app.amazon_product_Listing_Lingxing.updateMergeId({
						ids,
						mergeId: targetMergeId
					});

					if (res.success) {
						ElMessage.success(`更新成功：${res.message}`);
					} else {
						ElMessage.error(`更新失败：${res.message}`);
					}

					clearListingSelections();
					Crud.value?.refresh();
				} catch (e) {
					ElMessage.error("更新合并编号失败");
					console.error(e);
				} finally {
					loading.close();
				}
			})
			.catch(() => {});
	} catch (e) {
		ElMessage.error("操作失败");
		console.error(e);
	}
};

// cl-upsert
const Upsert = useUpsert({
	items: [
		{
			label: "FBA可售数量",
			prop: "afn_fulfillable_quantity",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "FBA入库接收中数量",
			prop: "afn_inbound_receiving_quantity",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "FBA入库已发货数量",
			prop: "afn_inbound_shipped_quantity",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "FBA入库处理中数量",
			prop: "afn_inbound_working_quantity",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "FBA不可售数量",
			prop: "afn_unsellable_quantity",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "亚马逊产品ID",
			prop: "amz_product_id",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "亚马逊产品ID类型",
			prop: "amz_product_id_type",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "亚马逊产品ID类型文本",
			prop: "amz_product_id_type_text",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "亚马逊产品类型",
			prop: "amz_product_type",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "ASIN",
			prop: "asin",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "ASIN链接",
			prop: "asin_url",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		},
		{
			label: "14天平均销量",
			prop: "average_fourteen_volume",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "7天平均销量",
			prop: "average_seven_volume",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "30天平均销量",
			prop: "average_thirty_volume",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "B2B价格",
			prop: "b2b_price",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "品牌ID",
			prop: "brand_id",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "类目ID",
			prop: "category_id",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "类目文本",
			prop: "category_text",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "货币符号",
			prop: "currency_symbol",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "FBA费用",
			prop: "fba_fee",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "FBA费用货币编码",
			prop: "fba_fee_currency_code",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "FBA费用货币图标",
			prop: "fba_fee_currency_icon",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "首单时间",
			prop: "first_order_time",
			component: {
				name: "el-date-picker",
				props: { type: "date", valueFormat: "YYYY-MM-DD" }
			}
		},
		{
			label: "FNSKU",
			prop: "fnsku",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "14天销售额",
			prop: "fourteen_amount",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "14天广告费",
			prop: "fourteen_spend",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "14天销量",
			prop: "fourteen_volume",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "配送渠道类型",
			prop: "fulfillment_channel_type",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "货币图标",
			prop: "icon",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "领星产品ID",
			prop: "lingxing_id",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "ID哈希值",
			prop: "id_hash",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "是否删除",
			prop: "is_delete",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "是否西班牙站点",
			prop: "is_es",
			flex: false,
			component: { name: "cl-switch" },
			required: true
		},
		{
			label: "是否配对",
			prop: "is_pair",
			flex: false,
			component: { name: "cl-switch" },
			required: true
		},
		{
			label: "商品状态",
			prop: "item_condition",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "商品名称",
			prop: "item_name",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		},
		{
			label: "落地价",
			prop: "landed_price",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "落地价货币编码",
			prop: "landed_price_currency_code",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "落地价货币图标",
			prop: "landed_price_currency_icon",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "标价",
			prop: "list_price",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "售价",
			prop: "listing_price",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "售价货币编码",
			prop: "listing_price_currency_code",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "售价货币图标",
			prop: "listing_price_currency_icon",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "本地名称",
			prop: "local_name",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "本地SKU",
			prop: "local_sku",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "站点/市场",
			prop: "marketplace",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "市场ID",
			prop: "marketplace_id",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "店铺mid",
			prop: "mid",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "MSKU",
			prop: "msku",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "上架时间",
			prop: "on_sale_time",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "开通日期",
			prop: "open_date",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "开通日期时间",
			prop: "open_date_time",
			component: {
				name: "el-date-picker",
				props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
			}
		},
		{
			label: "配对类型",
			prop: "pair_type",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "积分",
			prop: "points",
			component: { name: "el-input", props: { clearable: true } }
		},
		{ label: "价格", prop: "price", hook: "number", component: { name: "el-input-number" } },
		{
			label: "负责人列表",
			prop: "principal_list",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		},
		{
			label: "负责人真实姓名",
			prop: "principal_realname",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "负责人UID列表",
			prop: "principal_uids",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		},
		{
			label: "产品品牌文本",
			prop: "product_brand_text",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "产品ID",
			prop: "product_id",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "产品关联ID",
			prop: "product_relation_id",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "产品类型",
			prop: "product_type",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "库存数量",
			prop: "quantity",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "大类排名数组（15天）",
			prop: "rank",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } },
			required: true
		},
		{
			label: "推荐费",
			prop: "referral_fee",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "推荐费货币编码",
			prop: "referral_fee_currency_code",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "推荐费货币图标",
			prop: "referral_fee_currency_icon",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "常规价格",
			prop: "regular_price",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "常规价格货币编码",
			prop: "regular_price_currency_code",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "常规价格货币图标",
			prop: "regular_price_currency_icon",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "备注",
			prop: "remark",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		},
		{
			label: "预留-客户订单",
			prop: "reserved_customerorders",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "预留-FC处理中",
			prop: "reserved_fc_processing",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "预留-FC转移中",
			prop: "reserved_fc_transfers",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "评论数",
			prop: "reviews_num",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "规则唯一ID",
			prop: "rule_unique_id",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "卖家品牌",
			prop: "seller_brand",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "卖家类目",
			prop: "seller_category",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		},
		{
			label: "卖家名称",
			prop: "seller_name",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "卖家排名",
			prop: "seller_rank",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "7天销售额",
			prop: "seven_amount",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "7天广告费",
			prop: "seven_spend",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{ label: "运费", prop: "shipping", hook: "number", component: { name: "el-input-number" } },
		{
			label: "运费货币编码",
			prop: "shipping_currency_code",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "运费货币图标",
			prop: "shipping_currency_icon",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "店铺名称",
			prop: "shop",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "主图链接",
			prop: "image_url",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		},
		{
			label: "小排名数组（15天）",
			prop: "small_rank",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } },
			required: true
		},
		{
			label: "评分星级",
			prop: "stars",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "状态码",
			prop: "status",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "状态文本",
			prop: "status_text",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "店铺ID",
			prop: "store_id",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "店铺类型",
			prop: "store_type",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "30天销售额",
			prop: "thirty_amount",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "30天广告费",
			prop: "thirty_spend",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "30天销量",
			prop: "thirty_volume",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "总销量",
			prop: "total_volume",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "变体",
			prop: "variant",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "变体文本",
			prop: "variant_text",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		},
		{
			label: "昨日销售额",
			prop: "yesterday_amount",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "昨日广告费",
			prop: "yesterday_spend",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "昨日销量",
			prop: "yesterday_volume",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		// {
		// 	label: "合并编号",
		// 	prop: "mergeId",
		// 	component: { name: "el-input", props: { clearable: true } }
		// },
		{
			label: "产品编码",
			prop: "product_code",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "产品状态",
			prop: "product_state",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "过滤类型",
			prop: "filter_type",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "价格(取优惠价和价格两者最低价)",
			prop: "price_target",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "断货状态",
			prop: "outOfStockStatus",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "断货开始时间",
			prop: "outOfStockStartTime",
			component: {
				name: "el-date-picker",
				props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
			}
		},
		{
			label: "上一次总库存",
			prop: "lastQuantitySum",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "异常下架状态",
			prop: "abnormalOfflineStatus",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "异常下架开始时间",
			prop: "abnormalOfflineStartTime",
			component: {
				name: "el-date-picker",
				props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
			}
		},
		{
			label: "异常下架恢复时间",
			prop: "abnormalOfflineRecoveryTime",
			component: {
				name: "el-date-picker",
				props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
			}
		},
		{
			label: "在售天数",
			prop: "onSaleDays",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		},
		{
			label: "新品状态",
			prop: "newProductStatus",
			flex: false,
			component: { name: "cl-switch" },
			required: true
		},
		{
			label: "是否需要更新运营计划",
			prop: "needUpdateOperationPlan",
			flex: false,
			component: { name: "cl-switch" },
			required: true
		},
		{
			label: "类目流量状态",
			prop: "categoryTrafficStatus",
			flex: false,
			component: { name: "cl-switch" },
			required: true
		},
		{
			label: "产品流量状态",
			prop: "productTrafficStatus",
			flex: false,
			component: { name: "cl-switch" },
			required: true
		},
		{
			label: "库存是否超90天",
			prop: "stockOver90Days",
			flex: false,
			component: { name: "cl-switch" },
			required: true
		}
	]
});

// cl-table
const Table = useTable({
	columns: [
		{ type: "selection", reserveSelection: true },
		{ label: "图片", prop: "image_url_display", width: 70, align: "center"  ,fixed: "left"},
		{
			label: "状态",
			prop: "status",
			minWidth: 90,
			dict: [
				{ label: "在售", value: 1, type: "success" },
				{ label: "停售", value: 0, type: "danger" },
				{ label: "断货", value: 2, type: "danger" }
			] ,fixed: "left"
		},
		{ label: "ASIN", prop: "asin", minWidth: 70  ,fixed: "left"},
		{ label: "标题", prop: "item_name", showOverflowTooltip: true, minWidth: 70 ,fixed: "left"},
		// 2026-01-30: Moved country to status column
		// { label: "国家", prop: "marketplace", minWidth: 70  ,fixed: "left"},
		{ label: "店铺", prop: "shop", minWidth: 70, showOverflowTooltip: true  ,fixed: "left"},
		{ label: "MSKU/FNSKU", prop: "msku_fnsku", minWidth: 70, showOverflowTooltip: true  ,fixed: "left"},
		{ label: "售价", prop: "listing_price", minWidth: 70, sortable: "custom" },
		// { label: "价格", prop: "price", minWidth: 70, sortable: "custom" },
		// { label: "优惠价", prop: "price_target", minWidth: 70, sortable: "custom" },
		{
			label: "结算毛利率",
			prop: "profit_combined",
			minWidth: 70,
			showOverflowTooltip: true,
			fixed: "left"
		},
		// { label: "汇总销量(3/7/14)", prop: "restocking_sales_total", minWidth: 70 },
		{ label: "实时销量", prop: "yesterday_realtime_sales", minWidth: 75 },
		{ label: "日均销量(3/7/14)", prop: "restocking_sales_avg", minWidth: 75 },
		// 2025-01-21: 新增日均销量及可售天数计算列
		// 2026-01-30: Merged Sale Days
		{
			prop: "sellable_days_combined",
			label: "可售天数(总/FBA)",
			minWidth: 150,
			showOverflowTooltip: true,
			formatter: (row) => {
				const dailyAvg = getDailyAvgSales(row);
				const fba = getFbaInventoryQuantity(row);
				const inTransit = getRestockingFbaShippingQuantity(row);
				
				const total = dailyAvg > 0
					? Math.floor((fba + inTransit) / dailyAvg)
					: "999";
				const fbaDays = dailyAvg > 0
					? Math.floor(fba / dailyAvg)
					: "999";
				return `${total} / ${fbaDays}`;
			}
		},
		// {
		// 	label: "可售天数(FBA)",
		// 	minWidth: 70,
		// 	showOverflowTooltip: true,
		// 	formatter: (row) =>
		// 		row.dailyAvgSales && row.dailyAvgSales !== 0
		// 			? (row.afn_fulfillable_quantity / row.dailyAvgSales).toFixed(2)
		// 			: "--"
		// },
		{
			label: "日均销量",
			prop: "dailyAvgSales",
			minWidth: 65
		},
		// 2026-01-31: Removed salesChangeStatus column, moved to dailyAvgSales tag
		// { label: "销量变化状态", prop: "salesChangeStatus", minWidth: 70 },
		// 2026-01-30: Combined Inventory Columns
		// { label: "库存详情", prop: "inventory_details", minWidth: 130 },
		{
			label: "FBA/FBA预留/在途/本地",
			prop: "inventory_details",
			minWidth: 130,
			align: "center",
			sortable: false
		},
		// { label: "FBA库存", prop: "afn_fulfillable_quantity", minWidth: 70, sortable: "custom" },
		// { label: "FBA在途", prop: "restocking_fba_shipping", minWidth: 70 },
		// { label: "本地可用", prop: "restocking_local_valid", minWidth: 70 },
		{ label: "暂存总数", prop: "temp_stored_total", minWidth: 70 },
		{ label: "总库存", prop: "restocking_stock_total", minWidth: 70 },
		{ label: "建议采购量", prop: "restocking_quantity_sug_purchase", minWidth: 90, sortable: "custom" },
		// { label: "FBM库存", prop: "quantity", minWidth: 70, sortable: "custom" },
		// 2026-01-31: Merged delivery and purchase plan
		// { label: "待交付", prop: "restocking_reserved_customerorders", minWidth: 70 },
		// { label: "采购计划", prop: "restocking_purchase_plan", minWidth: 70 },
		{ label: "待交付/采购计划", prop: "delivery_purchase_combined", minWidth: 90 },
		{ label: "预计发货量", prop: "restocking_estimated_sale_quantity", minWidth: 70 },
		// {
		// 	label: "可售天数(总)",
		// 	prop: "restocking_available_sale_days",
		// 	minWidth: 70,
		// 	formatter: (row) => {
		// 		const val = row.restocking_available_sale_days;
		// 		return val || val === 0 ? Math.floor(val) : "-";
		// 	}
		// },
		// {
		// 	label: "可售天数(FBA)",
		// 	prop: "restocking_available_sale_days_fba",
		// 	minWidth: 70,
		// 	formatter: (row) => {
		// 		const val = row.restocking_available_sale_days_fba;
		// 		return val || val === 0 ? Math.floor(val) : "-";
		// 	}
		// },
		{ label: "断货时间", prop: "restocking_out_stock_date", minWidth: 70 },
		// { label: "销量预测", prop: "restocking_sales_prediction", minWidth: 70 },
		// { label: "本地发FBA量", prop: "restocking_quantity_sug_local_to_fba", minWidth: 70 },
		// { label: "海外仓发FBA量", prop: "restocking_quantity_sug_oversea_to_fba", minWidth: 70 },
		{ label: "FBA库龄", prop: "restocking_fba_aged", minWidth: 70 },
		{ label: "本地仓库龄", prop: "restocking_local_aged", minWidth: 70 },
		{ label: "海外仓可用", prop: "restocking_oversea_valid", minWidth: 70 },
		{ label: "建议采购日", prop: "restocking_sug_date_purchase", minWidth: 70 },
		{ label: "建议本地发货日", prop: "restocking_sug_date_send_local", minWidth: 70 },
		{
			label: "补货备注",
			prop: "restocking_ext_remark",
			minWidth: 70,
			showOverflowTooltip: true
		},
		{ label: "大类排名", prop: "rank_combined", minWidth: 70, showOverflowTooltip: true },
		{ label: "节点排名", prop: "small_rank", minWidth: 70, showOverflowTooltip: true },
		{ label: "亚马逊品牌", prop: "seller_brand", minWidth: 70, showOverflowTooltip: true },
		{ label: "品名/SKU", prop: "local_combined", minWidth: 70, showOverflowTooltip: true },
		{ label: "分类", prop: "category_text", showOverflowTooltip: true, minWidth: 70 },
		{
			label: "评分/Rating总数",
			prop: "rating_combined",
			minWidth: 70,
			sortable: "custom",
			showOverflowTooltip: true
		},
		{
			label: "创建时间",
			prop: "open_date_time",
			minWidth: 70,
			sortable: "custom",
			component: { name: "cl-date-text" },
			showOverflowTooltip: true
		},
		{ label: "负责人", prop: "principal_realname", minWidth: 70 },
		{ label: "备注", prop: "remark", showOverflowTooltip: true, minWidth: 70 },
		{
			label: "首单时间",
			prop: "first_order_time",
			minWidth: 70,
			sortable: "custom",
			component: { name: "cl-date-text" },
			showOverflowTooltip: true
		},
		// { label: "配对方式", prop: "pair_type", minWidth: 120 },
		{ label: "管理", type: "op", buttons: ["slot-management-buttons"] }
	]
});

// 2026-03-28: 统一维护手动排序状态
const currentSort = ref<{ prop?: string; order?: string }>({});

function getNextSortOrder(prop: string) {
	if (currentSort.value.prop !== prop) {
		return "desc";
	}

	if (currentSort.value.order === "desc") {
		return "asc";
	}

	if (currentSort.value.order === "asc") {
		return undefined;
	}

	return "desc";
}

function getSortIndicator(prop: string) {
	if (currentSort.value.prop !== prop) {
		return "";
	}

	return currentSort.value.order === "desc" ? "↓" : currentSort.value.order === "asc" ? "↑" : "";
}

function onSort(prop: string, order?: string) {
	const nextOrder = order ?? getNextSortOrder(prop);

	currentSort.value = nextOrder ? { prop, order: nextOrder } : {};

	Crud.value?.refresh({
		prop: nextOrder ? prop : undefined,
		order: nextOrder,
		page: 1
	});
}

function handleTableSortChange({ prop, order }: { prop?: string; order?: string }) {
	currentSort.value = prop && order ? { prop, order } : {};
}

// 2026-01-31: Shorten sales status text
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



// cl-crud
const Crud = useCrud(
	{
		service: service.app.bsr_product_Listing_Lingxing,
		async onDelete(_selection, { next }) {
			await next();
			clearListingSelections();
		},
		async onRefresh(params, { next }) {
			// Set default sort if not provided
			if (!params.order && !params.sort) {
				params.order = "restocking_quantity_sug_purchase";
				params.sort = "desc";
			}

			// 清空缓存，确保刷新时重新获取数据
			restockingCache.value.clear();
			purchasePlansCache.value.clear();

			const imagePreloadSequence = ++nextListingPageImagePreloadSeq;
			params.parentFold = 1;
			await next(params);

			const topLevelRows = Table.value?.data || [];
			const rows = prepareListingImageRows(getLingxingRealRows(topLevelRows));
			const currentPageImageLoads = preloadProductImages(rows, {
				reason: "bsr-product-listing-current-page"
			});

			await hydrateRestockingForRows(rows);
			await hydrateTempStoredQtyForRows(rows);
			await hydratePurchasePlansForRows(rows);
			await hydratePendingDeliveryForRows(rows);
			refreshSelectedListingRows(rows);
			listingTopLevelRows.value = topLevelRows;
			expandAllListingParents(topLevelRows);
			applyVisibleListingRows();
			void Promise.allSettled(currentPageImageLoads).then(() => {
				if (imagePreloadSequence === nextListingPageImagePreloadSeq) {
					void preloadNextListingPageImages(params, imagePreloadSequence);
				}
			});
		}
	},
	(app) => {
		app.refresh();
	}
);
</script>


<style scoped>
/* 强制隐藏抽屉溢出，使滚动条完全贴边 */
:deep(.el-drawer) {
	--el-drawer-padding-primary: 0 !important;
}
:deep(.el-drawer__body) {
	padding: 0 !important;
	margin: 0 !important;
}
:deep(.el-drawer__header) {
	/* 保留关闭按钮在右侧 */
	display: flex !important;
	justify-content: flex-end !important;
	padding: 8px 12px !important;
	margin: 0 !important;
	border-bottom: 1px solid #e2e8f0;
	background: #f8fafc;
}
:deep(.el-drawer__header .el-drawer__title) {
	display: none;
}
:deep(.el-drawer__header .el-drawer__close-btn) {
	font-size: 20px;
	color: #64748b;
	margin-left: auto;
}
:deep(.el-drawer__header .el-drawer__close-btn:hover) {
	color: #ef4444;
}

/* 迷你分析工作台 Popover 全局样式 - 紧凑版 */
:deep(.listing-mini-popover) {
	min-width: 450px !important;
	max-width: 500px !important;
	width: auto !important;
	background: #ffffff !important;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
	z-index: 9999 !important;
	padding: 0 !important;
}


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
/* Reduce overall table font size */
:deep(.el-table .cell) {
	font-size: 12px;
}

/* 批量暂存模态框样式 */
.batch-staging-product-card .last-record {
	border-bottom: none !important;
}

/* 批量暂存模态框 - 统计概览 */
.batch-staging-summary {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0;
	background: linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%);
	border-radius: 12px;
	padding: 16px 24px;
	margin-bottom: 16px;
}
.summary-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 0 20px;
}
.summary-label {
	font-size: 12px;
	color: #909399;
	margin-bottom: 4px;
}
.summary-value {
	font-size: 24px;
	font-weight: 600;
	color: #303133;
}
.summary-value.primary {
	color: #409eff;
}
.summary-value.large {
	font-size: 28px;
}
.summary-unit {
	font-size: 12px;
	color: #909399;
	margin-left: 2px;
}
.summary-divider {
	width: 1px;
	height: 40px;
	background: #dcdfe6;
}

/* 批量暂存模态框 - 产品列表 */
.batch-staging-list {
	max-height: 500px;
	overflow-y: auto;
	padding-right: 4px;
}
.batch-staging-list::-webkit-scrollbar {
	width: 6px;
}
.batch-staging-list::-webkit-scrollbar-thumb {
	background: #dcdfe6;
	border-radius: 3px;
}
.batch-staging-list::-webkit-scrollbar-track {
	background: #f5f7fa;
}

/* 产品卡片 */
.product-card {
	background: #fff;
	border: 1px solid #e4e7ed;
	border-radius: 12px;
	margin-bottom: 16px;
	overflow: hidden;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	transition: box-shadow 0.2s;
}
.product-card:hover {
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* 产品头部 */
.product-header {
	display: flex;
	align-items: center;
	padding: 14px 16px;
	background: linear-gradient(135deg, #fafbfc 0%, #f5f7fa 100%);
	border-bottom: 1px solid #ebeef5;
}
.product-image {
	width: 56px;
	height: 56px;
	border-radius: 8px;
	margin-right: 14px;
	flex-shrink: 0;
	border: 1px solid #ebeef5;
}
.product-image-placeholder {
	background: #f5f7fa;
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 8px;
}
.product-info {
	flex: 1;
	min-width: 0;
}
.product-title-row {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 4px;
}
.product-asin {
	font-weight: 600;
	font-size: 14px;
	color: #303133;
}
.marketplace-tag {
	border-radius: 4px;
}
.product-store {
	color: #909399;
	font-size: 12px;
}
.product-name {
	color: #606266;
	font-size: 12px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 450px;
}
.product-subtotal {
	display: flex;
	align-items: baseline;
	padding: 8px 16px;
	background: #ecf5ff;
	border-radius: 8px;
	margin-left: auto;
}
.subtotal-value {
	font-size: 22px;
	font-weight: 600;
	color: #409eff;
}
.subtotal-unit {
	font-size: 12px;
	color: #909399;
	margin-left: 4px;
}

/* 暂存记录列表 */
.records-list {
	padding: 8px 12px;
}

/* 单条记录 */
.record-item {
	display: flex;
	align-items: flex-start;
	padding: 12px;
	border-radius: 8px;
	margin-bottom: 8px;
	background: #fafbfc;
	cursor: pointer;
	transition: all 0.2s;
	border: 2px solid transparent;
}
.record-item:last-child {
	margin-bottom: 0;
}
.record-item:hover {
	background: #f0f5ff;
}
.record-item.checked {
	background: #f0f7ff;
	border-color: #409eff;
}
.record-checkbox {
	margin-right: 12px;
	margin-top: 2px;
}
.record-content {
	flex: 1;
	min-width: 0;
}
.record-row-1 {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-bottom: 6px;
}
.status-tag {
	border-radius: 4px;
	font-weight: 500;
}
.record-id {
	font-size: 11px;
	color: #c0c4cc;
	font-family: monospace;
}
.record-sku {
	font-size: 12px;
	color: #606266;
}
.record-sku strong {
	color: #303133;
}
.record-qty {
	font-size: 12px;
	color: #606266;
	margin-left: auto;
}
.record-qty em {
	font-style: normal;
	font-weight: 600;
	font-size: 15px;
	color: #409eff;
}

.record-row-2 {
	display: flex;
	align-items: center;
	gap: 16px;
	font-size: 12px;
	color: #909399;
}
.record-algo {
	color: #606266;
	font-weight: 500;
}
.record-date em {
	font-style: normal;
	color: #c0c4cc;
}
.record-daily, .record-coef {
	color: #909399;
}

.record-remark {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-top: 8px;
	padding: 6px 10px;
	background: #fdf6ec;
	border-radius: 4px;
	font-size: 12px;
	color: #e6a23c;
}

/* 对话框底部 */
.dialog-footer {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
}

.listing-image-status {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
	min-height: 50px;
	padding: 2px;
	box-sizing: border-box;
	background: #f5f7fa;
	border: 1px solid #ebeef5;
	border-radius: 4px;
	color: #909399;
	font-size: 11px;
	line-height: 1.2;
	text-align: center;
}

.listing-image-status-error {
	color: #f56c6c;
	background: #fef0f0;
	border-color: #fde2e2;
}

.listing-image-status-preview {
	min-height: 160px;
}

:deep(.el-table .lingxing-parent-row > td) {
	background-color: #ecf5ff !important;
	font-weight: 600;
	cursor: pointer;
}

:deep(.el-table .lingxing-child-row > td) {
	background-color: #e8edf5 !important;
}

:deep(.el-table td.lingxing-parent-hidden-cell .cell) {
	visibility: hidden;
}

.lingxing-parent-asin {
	color: #337ecc;
	font-size: 13px;
}

.lingxing-parent-asin:hover {
	color: #409eff;
}

.lingxing-parent-marketplace,
.lingxing-parent-shop {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	color: #337ecc;
}

.lingxing-parent-inventory {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 4px;
	color: #337ecc;
}

.lingxing-parent-inventory i {
	color: #a8abb2;
	font-style: normal;
}

.lingxing-parent-sales {
	color: #337ecc;
	font-weight: 700;
}

</style>
