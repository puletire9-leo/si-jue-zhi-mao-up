<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<el-input v-model="searchForm.asin" placeholder="ASIN" clearable style="width: 160px; margin-left: 10px;" @keyup.enter="doSearch" />
			<el-input v-model="searchForm.product_code" placeholder="产品代码" clearable style="width: 130px; margin-left: 10px;" @keyup.enter="doSearch" />
			<el-input v-model="searchForm.msku" placeholder="MSKU" clearable style="width: 150px; margin-left: 10px;" @keyup.enter="doSearch" />
			<el-select v-model="searchForm.marketplace" placeholder="国家" clearable style="width: 100px; margin-left: 10px;" @change="doSearch">
				<el-option label="英国" value="英国" />
				<el-option label="德国" value="德国" />
				<el-option label="法国" value="法国" />
				<el-option label="意大利" value="意大利" />
				<el-option label="西班牙" value="西班牙" />
				<el-option label="美国" value="美国" />
				<el-option label="加拿大" value="加拿大" />
				<el-option label="日本" value="日本" />
			</el-select>
			<el-button type="primary" style="margin-left: 10px;" @click="doSearch">搜索</el-button>
			<el-button @click="resetSearch">重置</el-button>
			<el-button
				type="danger"
				plain
				:loading="batchStopMyTrackingLoading"
				@click="handleBatchStopMyTracking"
			>
				<el-icon><Delete /></el-icon>
				批量取消跟踪
			</el-button>
			<cl-flex1 />
		</cl-row>

		<cl-row>
			<!-- 数据表格 -->
			<cl-table ref="Table">
				<template #column-asin="{ scope }">
					<el-link
						target="_blank"
						:underline="false"
						:href="getAmazonDpUrl(scope.row.asin, scope.row.marketplace)"
					>
						{{ scope.row.asin }}
					</el-link>
				</template>
				<template #column-image_url_display="{ scope }">
					<el-popover placement="right" trigger="hover" :width="300" @show="boostProductImages(scope.row)">
						<template #reference>
							<resilient-product-image
								:src="scope.row.image_url_display"
								style="width: 50px; height: 50px; cursor: pointer"
								fit="contain"
								priority="visible"
								@mouseenter="boostProductImages(scope.row)"
							/>
						</template>
						<template #default>
							<resilient-product-image
								:src="scope.row.image_url_display"
								style="width: 100%; height: auto; max-width: 280px"
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
								<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px">
									<div style="display: flex; align-items: center; gap: 8px">
										<el-tag :type="item.status === 0 ? 'success' : 'info'" size="small" effect="plain">{{ item.status_text }}</el-tag>
										<span style="font-weight: 700; font-size: 14px">{{ item.final_qty }} 件</span>
									</div>
									<div style="display: flex; align-items: center; gap: 8px">
										<span style="font-size: 12px; color: #909399">{{ item.create_time_short }}</span>
									</div>
								</div>
								<div style="font-size: 12px; color: #606266">
									{{ item.start_date_short }} ~ {{ item.end_date_short }} ({{ item.total_days }}天)
									· 日均{{ item.daily_avg }}
									· 系数{{ item.coefficient }}
								</div>
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
					<div class="asin-cell">
						<div class="asin-badges">
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

							<el-tag v-if="scope.row.newProductStatus === 1" size="small" type="success" effect="plain" disable-transitions>新在</el-tag>
							<el-tag v-else-if="scope.row.newProductStatus === 2" size="small" type="warning" effect="plain" disable-transitions>新无</el-tag>
							<el-tag v-else-if="scope.row.newProductStatus === 3" size="small" type="warning" effect="plain" disable-transitions>老&gt;7</el-tag>
							<el-tag v-else-if="scope.row.newProductStatus === 4" size="small" type="warning" effect="plain" disable-transitions>老&gt;14</el-tag>
							<el-tag v-else-if="scope.row.newProductStatus === 5" size="small" type="warning" effect="plain" disable-transitions>老&gt;30</el-tag>

							<el-tag v-if="scope.row.categoryTrafficStatus === 2" size="small" type="success" effect="plain" disable-transitions>类↑</el-tag>
							<el-tag v-else-if="scope.row.categoryTrafficStatus === 1" size="small" type="danger" effect="plain" disable-transitions>类↓</el-tag>

							<el-tag v-if="scope.row.productTrafficStatus === 2" size="small" type="success" effect="plain" disable-transitions>节↑</el-tag>
							<el-tag v-else-if="scope.row.productTrafficStatus === 1" size="small" type="danger" effect="plain" disable-transitions>节↓</el-tag>

							<el-tag
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
							</el-tag>

							<el-popover
								v-if="scope.row.purchase_plan_details && getRecentPurchasePlans(scope.row.purchase_plan_details, 3).length > 0"
								placement="right"
								:width="700"
								trigger="hover"
							>
								<template #reference>
									<el-tag size="small" type="warning" effect="dark" disable-transitions style="margin-left: 4px; cursor: pointer">
										采{{ getRecentPurchasePlans(scope.row.purchase_plan_details, 3).length }}
									</el-tag>
								</template>
								<div style="max-height: 350px; overflow-y: auto;">
									<el-table
										:data="getRecentPurchasePlans(scope.row.purchase_plan_details, 3)"
										size="small"
										border
										:show-summary="getRecentPurchasePlans(scope.row.purchase_plan_details, 3).length > 1"
										:summary-method="(param: any) => {
											const { columns, data } = param;
											const sums: string[] = [];
											columns.forEach((column: any, index: number) => {
												if (index === 0) { sums[index] = '合计'; return; }
												if (column.property === 'quantity_plan') {
													const values = data.map((item: any) => Number(item[column.property]));
													if (!values.every((value: number) => isNaN(value))) {
														sums[index] = values.reduce((prev: number, curr: number) => {
															const value = Number(curr);
															return !isNaN(value) ? prev + curr : prev;
														}, 0) + '';
													} else { sums[index] = 'N/A'; }
												} else { sums[index] = ''; }
											});
											return sums;
										}"
									>
										<el-table-column prop="plan_sn" label="计划编号" min-width="130" />
										<el-table-column prop="status_text" label="状态" min-width="70">
											<template #default="{ row: detail }">
												<el-tag size="small" :type="detail.status === 121 ? 'warning' : 'primary'" effect="light">{{ detail.status_text }}</el-tag>
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
								{{ getPriceHistoryLabel(index) }}：{{ formatListingPriceValue(item) }}
							</div>
						</template>
						<span style="cursor: help">
							{{ formatListingPriceValue(scope.row.listing_price) }}
						</span>
					</el-tooltip>
					<span v-else>{{ formatListingPriceValue(scope.row.listing_price) }}</span>
				</template>

				<template #column-profit_combined="{ scope }">
					<div v-if="scope.row.profit_rate !== undefined && scope.row.profit_rate !== null">
						{{ (scope.row.profit_rate * 100).toFixed(2) }}%
					</div>
					<div v-if="scope.row.profit_rate === undefined || scope.row.profit_rate === null">-</div>
				</template>

				<template #column-delivery_purchase_combined="{ scope }">
					<div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
						<el-popover
							v-if="scope.row.pending_delivery_details && scope.row.pending_delivery_details.length > 0"
							placement="bottom"
							:width="700"
							trigger="hover"
						>
							<template #reference>
								<span style="cursor: pointer; color: #409eff; font-weight: 500;">
									{{ scope.row.pending_delivery_qty ?? 0 }}
								</span>
							</template>
							<div style="max-height: 350px; overflow-y: auto;">
								<el-table
									:data="scope.row.pending_delivery_details"
									size="small"
									border
									:show-summary="scope.row.pending_delivery_details.length > 1"
									:summary-method="(param: any) => {
										const { columns, data } = param;
										const sums: string[] = [];
										columns.forEach((column: any, index: number) => {
											if (index === 0) { sums[index] = '合计'; return; }
											if (column.property === 'quantity') {
												const values = data.map((item: any) => Number(item[column.property]));
												if (!values.every((value: number) => isNaN(value))) {
													sums[index] = values.reduce((prev: number, curr: number) => {
														const value = Number(curr);
														return !isNaN(value) ? prev + curr : prev;
													}, 0) + '';
												} else { sums[index] = 'N/A'; }
											} else { sums[index] = ''; }
										});
										return sums;
									}"
								>
									<el-table-column prop="order_sn" label="采购单号" min-width="130" />
									<el-table-column prop="status_text" label="状态" min-width="80">
										<template #default="{ row: detail }">
											<el-tag size="small" :type="getPendingDeliveryTagType(detail.status)" effect="light">{{ detail.status_text }}</el-tag>
										</template>
									</el-table-column>
									<el-table-column prop="supplier_name" label="供应商" min-width="100" show-overflow-tooltip />
									<el-table-column prop="quantity" label="数量" min-width="60" />
									<el-table-column prop="order_time" label="下单时间" min-width="100" show-overflow-tooltip />
									<el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
								</el-table>
							</div>
						</el-popover>
						<span v-else>{{ scope.row.pending_delivery_qty ?? 0 }}</span>
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
									:summary-method="(param: any) => {
										const { columns, data } = param;
										const sums: string[] = [];
										columns.forEach((column: any, index: number) => {
											if (index === 0) { sums[index] = '合计'; return; }
											if (column.property === 'quantity_plan') {
												const values = data.map((item: any) => Number(item[column.property]));
												if (!values.every((value: number) => isNaN(value))) {
													sums[index] = values.reduce((prev: number, curr: number) => {
														const value = Number(curr);
														return !isNaN(value) ? prev + curr : prev;
													}, 0) + '';
												} else { sums[index] = 'N/A'; }
											} else { sums[index] = ''; }
										});
										return sums;
									}"
								>
									<el-table-column prop="plan_sn" label="计划编号" min-width="130" />
									<el-table-column prop="status_text" label="状态" min-width="70">
										<template #default="{ row: detail }">
											<el-tag size="small" :type="detail.status === 121 ? 'warning' : 'primary'" effect="light">{{ detail.status_text }}</el-tag>
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

				<template #header-sellable_days_combined>
					<div style="display: flex; justify-content: center; align-items: center; gap: 4px;">
						<span>可售天数(</span>
						<span style="cursor: pointer; color: #409eff; user-select: none" @click.stop="onSort('totalSellableDaysSort')">
							总{{ getSortIndicator("totalSellableDaysSort") }}
						</span>
						<span style="color: #dcdfe6">/</span>
						<span style="cursor: pointer; color: #409eff; user-select: none" @click.stop="onSort('fbaSellableDaysSort')">
							FBA{{ getSortIndicator("fbaSellableDaysSort") }}
						</span>
						<span>)</span>
					</div>
				</template>

				<template #header-dailyAvgSales>
					<div
						style="display: flex; justify-content: center; align-items: center; gap: 4px; cursor: pointer; color: #409eff; user-select: none;"
						@click.stop="onSort('dailyAvgSales')"
					>
						<span>日均销量</span>
						<span>{{ getSortIndicator("dailyAvgSales") }}</span>
					</div>
				</template>

				<template #header-inventory_details="{ column }">
					<div style="display: flex; justify-content: center; align-items: center; gap: 4px;">
						<span
							style="cursor: pointer; transition: color 0.2s;"
							onmouseover="this.style.color='#409eff'"
							onmouseout="this.style.color=''"
							title="点击按FBA库存排序"
							@click.stop="onSort('afn_fulfillable_quantity')"
						>FBA</span>
						<span>{{ getSortIndicator("afn_fulfillable_quantity") }}</span>
						<span style="color: #dcdfe6">/</span>
						<span style="cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#409eff'" onmouseout="this.style.color=''">在途</span>
						<span style="color: #dcdfe6">/</span>
						<span style="cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#409eff'" onmouseout="this.style.color=''">本地</span>
					</div>
				</template>

				<template #column-inventory_details="{ scope }">
					<div style="display: flex; justify-content: center; align-items: center; gap: 2px;">
						<el-tooltip placement="top" effect="light">
							<template #content>
								<div v-if="scope.row.restocking?.fbaValidList?.length">
									<el-table :data="scope.row.restocking.fbaValidList" size="small" border style="max-width: 950px">
										<el-table-column prop="fnsku" label="FNSKU" min-width="140" />
										<el-table-column prop="msku" label="msku" min-width="120" />
										<el-table-column prop="quantity" label="数量" min-width="80" />
										<el-table-column prop="afnFulfillableQuantity" label="可售" min-width="80" />
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
						<el-tooltip placement="top" effect="light">
							<template #content>
								<div v-if="scope.row.restocking?.fbaShippingList?.length">
									<el-table :data="scope.row.restocking.fbaShippingList" size="small" border style="max-width: 950px">
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
									<el-table :data="scope.row.restocking.extInfo.localValidDetailList" size="small" border style="max-width: 950px">
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
									v-for="(item, index) in scope.row.restocking.salesInfo.recentSalesTrendList"
									:key="index"
									style="text-align: center"
								>
									<div style="font-size: 12px; color: #909399; margin-bottom: 5px; white-space: nowrap;">
										{{ item.date }}
									</div>
									<div style="font-weight: bold">{{ item.volume }}</div>
								</div>
							</div>
						</div>
						<div v-else>暂无近期销量数据</div>
					</el-popover>
				</template>

				<template #column-restocking_estimated_sale_quantity="{ scope }">
					<span style="cursor: help; color: #409eff">
						{{ scope.row.restocking_estimated_sale_quantity ?? "-" }}
					</span>
				</template>

				<template #column-restocking_local_aged="{ scope }">
					<el-tooltip placement="top">
						<template #content>
							<div v-if="scope.row.restocking?.localAgedInfo">
								<div>段1: {{ scope.row.restocking.localAgedInfo.section1 || 0 }}</div>
								<div>段2: {{ scope.row.restocking.localAgedInfo.section2 || 0 }}</div>
								<div>段3: {{ scope.row.restocking.localAgedInfo.section3 || 0 }}</div>
								<div>段4: {{ scope.row.restocking.localAgedInfo.section4 || 0 }}</div>
							</div>
							<div v-else>-</div>
						</template>
						<span style="cursor: help">
							{{ scope.row.restocking?.localAgedInfo?.section1 ?? "-" }}
						</span>
					</el-tooltip>
				</template>

				<template #column-dailyAvgSales="{ scope }">
					<div style="display: flex; flex-direction: column; align-items: flex-start;">
						<div style="color: #3b82f6; font-weight: 500;">
							{{ scope.row.dailyAvgSales ?? '-' }}
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

				<!-- 自然位综合分（hover显示最近15天汇总历史） -->
				<template #column-score_nf="{ scope }">
					<el-popover
						v-if="getSummaryMetricHistory(scope.row, 'score_nf').length"
						placement="bottom"
						trigger="hover"
						:width="420"
						:offset="8"
						:show-after="120"
						popper-class="summary-history-popper"
						:popper-options="summaryPopoverOptions"
					>
						<template #reference>
							<span :class="['summary-metric-trigger', { 'is-empty': getSummaryMetricValue(scope.row, 'score_nf') === null }]">
								<span class="summary-metric-value">{{ formatSummaryMetricCellValue(scope.row, 'score_nf') }}</span>
								<span
									v-if="getSummaryMetricComparison(scope.row, 'score_nf')"
									:class="['summary-metric-delta', getSummaryMetricComparison(scope.row, 'score_nf')?.className]"
								>
									{{ getSummaryMetricComparison(scope.row, 'score_nf')?.text }}
								</span>
								<el-icon class="summary-metric-history-icon"><TrendCharts /></el-icon>
							</span>
						</template>
						<div class="summary-history-popover">
							<div class="summary-history-title">
								<span>自然位综合分 · 最近15天</span>
								<span v-if="getSummaryMetricComparison(scope.row, 'score_nf')" :class="['summary-history-compare', getSummaryMetricComparison(scope.row, 'score_nf')?.className]">
									{{ getSummaryMetricComparison(scope.row, 'score_nf')?.detail }}
								</span>
							</div>
							<div class="summary-history-chart-wrap">
								<v-chart
									v-if="hasSummaryMetricTrend(scope.row, 'score_nf')"
									class="summary-history-chart"
									:option="getSummaryMetricChartOption(scope.row, 'score_nf')"
									autoresize
								/>
								<div v-else class="summary-history-chart-empty">历史天数不足，暂无趋势图</div>
							</div>
							<el-table :data="getSummaryMetricHistory(scope.row, 'score_nf')" size="small" border max-height="280">
								<el-table-column type="index" label="序号" width="56" align="center" />
								<el-table-column prop="summary_date" label="日期" width="110" />
								<el-table-column label="值" align="center">
									<template #default="{ row }">
										{{ formatSummaryMetricValue(row.score_nf, 'score_nf') }}
									</template>
								</el-table-column>
							</el-table>
						</div>
					</el-popover>
					<span v-else>{{ formatSummaryMetricValue(getSummaryMetricValue(scope.row, 'score_nf'), 'score_nf') }}</span>
				</template>

				<!-- 广告位综合分（hover显示最近15天汇总历史） -->
				<template #column-score_sp="{ scope }">
					<el-popover
						v-if="getSummaryMetricHistory(scope.row, 'score_sp').length"
						placement="bottom"
						trigger="hover"
						:width="420"
						:offset="8"
						:show-after="120"
						popper-class="summary-history-popper"
						:popper-options="summaryPopoverOptions"
					>
						<template #reference>
							<span :class="['summary-metric-trigger', { 'is-empty': getSummaryMetricValue(scope.row, 'score_sp') === null }]">
								<span class="summary-metric-value">{{ formatSummaryMetricCellValue(scope.row, 'score_sp') }}</span>
								<span
									v-if="getSummaryMetricComparison(scope.row, 'score_sp')"
									:class="['summary-metric-delta', getSummaryMetricComparison(scope.row, 'score_sp')?.className]"
								>
									{{ getSummaryMetricComparison(scope.row, 'score_sp')?.text }}
								</span>
								<el-icon class="summary-metric-history-icon"><TrendCharts /></el-icon>
							</span>
						</template>
						<div class="summary-history-popover">
							<div class="summary-history-title">
								<span>广告位综合分 · 最近15天</span>
								<span v-if="getSummaryMetricComparison(scope.row, 'score_sp')" :class="['summary-history-compare', getSummaryMetricComparison(scope.row, 'score_sp')?.className]">
									{{ getSummaryMetricComparison(scope.row, 'score_sp')?.detail }}
								</span>
							</div>
							<div class="summary-history-chart-wrap">
								<v-chart
									v-if="hasSummaryMetricTrend(scope.row, 'score_sp')"
									class="summary-history-chart"
									:option="getSummaryMetricChartOption(scope.row, 'score_sp')"
									autoresize
								/>
								<div v-else class="summary-history-chart-empty">历史天数不足，暂无趋势图</div>
							</div>
							<el-table :data="getSummaryMetricHistory(scope.row, 'score_sp')" size="small" border max-height="280">
								<el-table-column type="index" label="序号" width="56" align="center" />
								<el-table-column prop="summary_date" label="日期" width="110" />
								<el-table-column label="值" align="center">
									<template #default="{ row }">
										{{ formatSummaryMetricValue(row.score_sp, 'score_sp') }}
									</template>
								</el-table-column>
							</el-table>
						</div>
					</el-popover>
					<span v-else>{{ formatSummaryMetricValue(getSummaryMetricValue(scope.row, 'score_sp'), 'score_sp') }}</span>
				</template>

				<!-- 自然位落后率（hover显示最近15天汇总历史） -->
				<template #column-behind_rate_nf="{ scope }">
					<el-popover
						v-if="getSummaryMetricHistory(scope.row, 'behind_rate_nf').length"
						placement="bottom"
						trigger="hover"
						:width="420"
						:offset="8"
						:show-after="120"
						popper-class="summary-history-popper"
						:popper-options="summaryPopoverOptions"
					>
						<template #reference>
							<span :class="['summary-metric-trigger', { 'is-empty': getSummaryMetricValue(scope.row, 'behind_rate_nf') === null }]">
								<span class="summary-metric-value">{{ formatSummaryMetricCellValue(scope.row, 'behind_rate_nf') }}</span>
								<span
									v-if="getSummaryMetricComparison(scope.row, 'behind_rate_nf')"
									:class="['summary-metric-delta', getSummaryMetricComparison(scope.row, 'behind_rate_nf')?.className]"
								>
									{{ getSummaryMetricComparison(scope.row, 'behind_rate_nf')?.text }}
								</span>
								<el-icon class="summary-metric-history-icon"><TrendCharts /></el-icon>
							</span>
						</template>
						<div class="summary-history-popover">
							<div class="summary-history-title">
								<span>自然位落后率 · 最近15天</span>
								<span v-if="getSummaryMetricComparison(scope.row, 'behind_rate_nf')" :class="['summary-history-compare', getSummaryMetricComparison(scope.row, 'behind_rate_nf')?.className]">
									{{ getSummaryMetricComparison(scope.row, 'behind_rate_nf')?.detail }}
								</span>
							</div>
							<div v-if="scope.row.behind_rate_nf != null" class="summary-history-note">
								当前：{{ scope.row.behind_count_nf }}/{{ scope.row.competitor_count }} 个竞品自然分比自己高
							</div>
							<div class="summary-history-chart-wrap">
								<v-chart
									v-if="hasSummaryMetricTrend(scope.row, 'behind_rate_nf')"
									class="summary-history-chart"
									:option="getSummaryMetricChartOption(scope.row, 'behind_rate_nf')"
									autoresize
								/>
								<div v-else class="summary-history-chart-empty">历史天数不足，暂无趋势图</div>
							</div>
							<el-table :data="getSummaryMetricHistory(scope.row, 'behind_rate_nf')" size="small" border max-height="280">
								<el-table-column type="index" label="序号" width="56" align="center" />
								<el-table-column prop="summary_date" label="日期" width="110" />
								<el-table-column label="值" align="center">
									<template #default="{ row }">
										{{ formatSummaryMetricValue(row.behind_rate_nf, 'behind_rate_nf') }}
									</template>
								</el-table-column>
							</el-table>
						</div>
					</el-popover>
					<span v-else>{{ formatSummaryMetricValue(getSummaryMetricValue(scope.row, 'behind_rate_nf'), 'behind_rate_nf') }}</span>
				</template>

				<!-- SP落后率（hover显示最近15天汇总历史） -->
				<template #column-behind_rate_sp="{ scope }">
					<el-popover
						v-if="getSummaryMetricHistory(scope.row, 'behind_rate_sp').length"
						placement="bottom"
						trigger="hover"
						:width="420"
						:offset="8"
						:show-after="120"
						popper-class="summary-history-popper"
						:popper-options="summaryPopoverOptions"
					>
						<template #reference>
							<span :class="['summary-metric-trigger', { 'is-empty': getSummaryMetricValue(scope.row, 'behind_rate_sp') === null }]">
								<span class="summary-metric-value">{{ formatSummaryMetricCellValue(scope.row, 'behind_rate_sp') }}</span>
								<span
									v-if="getSummaryMetricComparison(scope.row, 'behind_rate_sp')"
									:class="['summary-metric-delta', getSummaryMetricComparison(scope.row, 'behind_rate_sp')?.className]"
								>
									{{ getSummaryMetricComparison(scope.row, 'behind_rate_sp')?.text }}
								</span>
								<el-icon class="summary-metric-history-icon"><TrendCharts /></el-icon>
							</span>
						</template>
						<div class="summary-history-popover">
							<div class="summary-history-title">
								<span>SP落后率 · 最近15天</span>
								<span v-if="getSummaryMetricComparison(scope.row, 'behind_rate_sp')" :class="['summary-history-compare', getSummaryMetricComparison(scope.row, 'behind_rate_sp')?.className]">
									{{ getSummaryMetricComparison(scope.row, 'behind_rate_sp')?.detail }}
								</span>
							</div>
							<div v-if="scope.row.behind_rate_sp != null" class="summary-history-note">
								当前：{{ scope.row.behind_count_sp }}/{{ scope.row.competitor_count }} 个竞品SP分比自己高
							</div>
							<div class="summary-history-chart-wrap">
								<v-chart
									v-if="hasSummaryMetricTrend(scope.row, 'behind_rate_sp')"
									class="summary-history-chart"
									:option="getSummaryMetricChartOption(scope.row, 'behind_rate_sp')"
									autoresize
								/>
								<div v-else class="summary-history-chart-empty">历史天数不足，暂无趋势图</div>
							</div>
							<el-table :data="getSummaryMetricHistory(scope.row, 'behind_rate_sp')" size="small" border max-height="280">
								<el-table-column type="index" label="序号" width="56" align="center" />
								<el-table-column prop="summary_date" label="日期" width="110" />
								<el-table-column label="值" align="center">
									<template #default="{ row }">
										{{ formatSummaryMetricValue(row.behind_rate_sp, 'behind_rate_sp') }}
									</template>
								</el-table-column>
							</el-table>
						</div>
					</el-popover>
					<span v-else>{{ formatSummaryMetricValue(getSummaryMetricValue(scope.row, 'behind_rate_sp'), 'behind_rate_sp') }}</span>
				</template>

				<!-- 操作列：关键词详情 -->
				<template #slot-test-btn="{ scope }">
					<el-tooltip content="关键词详情" placement="top" :hide-after="0">
						<el-button
							type="primary"
							size="default"
							plain
							circle
							@click="handleDetailClick(scope.row)"
						>
							<el-icon><Memo /></el-icon>
						</el-button>
					</el-tooltip>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>
	</cl-crud>

	<!-- 关键词跟踪详情模态框 -->
	<keyword-tracking-detail
		v-model="detailDialogVisible"
		:listingRow="detailListingRow"
		@changed="handleDetailChanged"
	/>
</template>

<script lang="ts" name="app-bsr_keyword_tracking" setup>
import { useCrud, useTable } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { convert_image_url } from "/$/app/utils";
import ResilientProductImage from "/$/app/components/resilient-product-image.vue";
import { boostProductImages, preloadProductImages } from "/$/app/utils/product-image-loading";
import { ref } from "vue";
import { useRoute } from "vue-router";
import { Delete, Memo, TrendCharts } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import dayjs from "dayjs";
import { use } from "echarts/core";
import { LineChart } from "echarts/charts";
import KeywordTrackingDetail from "../components/keyword-tracking-detail.vue";

use([LineChart]);

const { service } = useCool();
const route = useRoute();

const summaryPopoverOptions = {
	strategy: "fixed",
	modifiers: [
		{
			name: "flip",
			options: {
				fallbackPlacements: ["bottom", "top", "right", "left"],
			},
		},
		{
			name: "preventOverflow",
			options: {
				boundary: "viewport",
				padding: 12,
			},
		},
	],
};

// ========== 辅助函数 ==========

function getMarketplaceShortName(marketplace: string) {
	if (!marketplace) return "";
	const map: Record<string, string> = {
		英国: "英", 德国: "德", 法国: "法", 西班牙: "西", 意大利: "意"
	};
	return map[marketplace] || marketplace.charAt(0);
}

const getAmazonDpUrl = (asin: string, marketplace: string) => {
	if (!asin || !marketplace) return "#";
	const domainMap: Record<string, string> = {
		英国: "co.uk", 德国: "de", 法国: "fr", 西班牙: "es", 意大利: "it"
	};
	const domain = domainMap[marketplace] || "com";
	return `https://www.amazon.${domain}/dp/${asin}`;
};

function getMarketplaceColor(marketplace: string) {
	if (!marketplace) return "#909399";
	const map: Record<string, string> = {
		英国: "#409EFF", 德国: "#303133", 法国: "#8e44ad", 西班牙: "#E6A23C", 意大利: "#67C23A"
	};
	return map[marketplace] || "#909399";
}

function formatNumber(num: number | undefined | null): string {
	if (num === undefined || num === null) return "0";
	return Number(num).toFixed(2).replace(/\.?0+$/, "");
}

function formatListingPriceValue(num: number | undefined | null): string {
	if (num === undefined || num === null || Number.isNaN(Number(num))) return "-";
	return formatNumber(Number(num));
}

type SummaryMetricKey = "score_nf" | "score_sp" | "behind_rate_nf" | "behind_rate_sp";

const summaryRateMetrics = new Set<SummaryMetricKey>(["behind_rate_nf", "behind_rate_sp"]);

function toNullableNumber(val: any): number | null {
	if (val === undefined || val === null || val === "") return null;
	const num = Number(val);
	return Number.isNaN(num) ? null : num;
}

function getSummaryMetricValue(row: any, metric: SummaryMetricKey): number | null {
	return toNullableNumber(row?.[metric]);
}

function normalizeSummaryDate(val: any): string {
	if (!val) return "";
	return String(val).slice(0, 10);
}

function getSummaryHistory(row: any) {
	const list = Array.isArray(row?.summary_history) ? row.summary_history : [];
	return [...list]
		.map((item: any) => ({
			summary_date: normalizeSummaryDate(item.summary_date),
			score_nf: toNullableNumber(item.score_nf),
			score_sp: toNullableNumber(item.score_sp),
			behind_rate_nf: toNullableNumber(item.behind_rate_nf),
			behind_rate_sp: toNullableNumber(item.behind_rate_sp),
		}))
		.filter((item: any) => item.summary_date)
		.sort((a: any, b: any) => b.summary_date.localeCompare(a.summary_date));
}

function getSummaryMetricHistory(row: any, metric: SummaryMetricKey) {
	return getSummaryHistory(row).filter((item: any) => item[metric] !== null);
}

function hasSummaryMetricTrend(row: any, metric: SummaryMetricKey) {
	return getSummaryMetricHistory(row, metric).length > 1;
}

function formatSummaryMetricValue(val: any, metric: SummaryMetricKey): string {
	const num = toNullableNumber(val);
	if (num === null) return "-";
	if (summaryRateMetrics.has(metric)) return `${(num * 100).toFixed(2)}%`;
	return num.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function formatSummaryMetricCellValue(row: any, metric: SummaryMetricKey): string {
	const value = getSummaryMetricValue(row, metric);
	if (value === null) return "暂无今日";
	return formatSummaryMetricValue(value, metric);
}

function formatSummaryMetricDelta(diff: number, metric: SummaryMetricKey): string {
	const abs = Math.abs(diff);
	if (summaryRateMetrics.has(metric)) return `${(abs * 100).toFixed(2)}%`;
	return abs.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function getSummaryMetricComparison(row: any, metric: SummaryMetricKey) {
	const history = getSummaryMetricHistory(row, metric);
	if (history.length === 0) return null;

	const currentSummaryDate = normalizeSummaryDate(row?.summary_date);
	if (currentSummaryDate !== dayjs().format("YYYY-MM-DD")) return null;

	const latest = history[0];
	const latestValue = toNullableNumber(latest[metric]);
	if (latestValue === null || latest.summary_date !== currentSummaryDate) return null;

	const targetDate = dayjs(latest.summary_date).subtract(10, "day").format("YYYY-MM-DD");
	const base = history.find((item: any) => item.summary_date === targetDate)
		|| history.find((item: any) => item.summary_date <= targetDate);
	const baseValue = toNullableNumber(base?.[metric]);
	if (!base || baseValue === null || base.summary_date === latest.summary_date) return null;

	const diff = latestValue - baseValue;
	if (Math.abs(diff) < 0.000001) {
		return {
			text: "持平",
			detail: `较 ${base.summary_date} 持平`,
			className: "is-flat",
		};
	}

	const isRate = summaryRateMetrics.has(metric);
	const isImproved = isRate ? diff < 0 : diff > 0;
	const verb = diff > 0 ? "增加" : "减少";
	const arrow = diff > 0 ? "↑" : "↓";

	return {
		text: `${arrow}${formatSummaryMetricDelta(diff, metric)}`,
		detail: `较 ${base.summary_date} ${verb} ${formatSummaryMetricDelta(diff, metric)}`,
		className: isImproved ? "is-good" : "is-bad",
	};
}

function getSummaryMetricChartOption(row: any, metric: SummaryMetricKey) {
	const history = [...getSummaryMetricHistory(row, metric)].reverse();
	const isRate = summaryRateMetrics.has(metric);
	const metricColor = "#409eff";

	return {
		animationDuration: 220,
		grid: {
			top: 14,
			right: 12,
			bottom: 26,
			left: isRate ? 46 : 42,
		},
		tooltip: {
			trigger: "axis",
			confine: true,
			formatter: (params: any[]) => {
				const point = params?.[0];
				if (!point) return "";
				return `${point.axisValue}<br/>${formatSummaryMetricValue(point.data, metric)}`;
			},
		},
		xAxis: {
			type: "category",
			boundaryGap: false,
			data: history.map((item: any) => item.summary_date),
			axisTick: { show: false },
			axisLine: { lineStyle: { color: "#dcdfe6" } },
			axisLabel: {
				color: "#909399",
				fontSize: 10,
				formatter: (value: string) => value.slice(5),
			},
		},
		yAxis: {
			type: "value",
			scale: true,
			axisTick: { show: false },
			axisLine: { show: false },
			splitLine: { lineStyle: { color: "#ebeef5" } },
			axisLabel: {
				color: "#909399",
				fontSize: 10,
				formatter: (value: number) => isRate
					? `${Math.round(value * 100)}%`
					: formatSummaryMetricValue(value, metric),
			},
		},
		series: [
			{
				type: "line",
				data: history.map((item: any) => item[metric]),
				smooth: 0.24,
				symbol: "circle",
				symbolSize: 5,
				showSymbol: history.length <= 8,
				lineStyle: {
					width: 2,
					color: metricColor,
				},
				itemStyle: {
					color: metricColor,
				},
				areaStyle: {
					color: "rgba(64, 158, 255, 0.10)",
				},
			},
		],
	};
}

function getListingPriceHistory(row: any): Array<number | null> {
	if (Array.isArray(row?.listing_price_history) && row.listing_price_history.length > 0) {
		return row.listing_price_history;
	}
	if (row?.listing_price === undefined || row?.listing_price === null) return [];
	return [row.listing_price];
}

function getPriceHistoryLabel(index: number): string {
	const d = new Date();
	d.setDate(d.getDate() - index);
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${month}-${day}`;
}

function getRestockingFbaShippingQuantity(row: any) {
	const list = row?.restocking?.fbaShippingList;
	if (!Array.isArray(list)) return 0;
	return list.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0);
}

function getFbaInventoryQuantity(row: any) {
	const info = row?.restocking?.amazonQuantityInfo;
	if (!info) {
		const base = Number(row?.afn_fulfillable_quantity);
		return Number.isNaN(base) ? 0 : base;
	}
	const afnFulfillableQuantity = Number(info.afnFulfillableQuantity) || 0;
	const reservedFcTransfers = Number(info.reservedFcTransfers) || 0;
	const reservedFcProcessing = Number(info.reservedFcProcessing) || 0;
	return afnFulfillableQuantity + reservedFcTransfers + reservedFcProcessing;
}

function getRealtimeSalesVolume(row: any) {
	const value = row?.restocking?.realtimeSales;
	if (value === null || value === undefined) return null;
	const num = Number(value);
	return Number.isNaN(num) ? null : num;
}

function getRiskShipmentSns(row: any): Set<string> {
	const riskSns = new Set<string>();
	const dailyAvg = Number(row.dailyAvgSales) || 0;
	if (dailyAvg <= 0) return riskSns;

	const initialStock = getFbaInventoryQuantity(row);
	let stockoutDate = dayjs().add(initialStock / dailyAvg, "day");

	const list = row?.restocking?.fbaShippingList;
	if (!Array.isArray(list) || list.length === 0) return riskSns;

	const sortedShipments = [...list].filter(item => item?.amazonSaleDate).sort((a, b) => {
		return dayjs(a.amazonSaleDate).valueOf() - dayjs(b.amazonSaleDate).valueOf();
	});

	for (const shipment of sortedShipments) {
		const arrivalDate = dayjs(shipment.amazonSaleDate);
		if (!arrivalDate.isValid()) continue;
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
	return riskSns;
}

function isShipmentLate(productRow: any, shipment: any) {
	if (!shipment?.orderSn) return false;
	const riskSns = getRiskShipmentSns(productRow);
	return riskSns.has(shipment.orderSn);
}

function hasStockoutRisk(productRow: any) {
	const riskSns = getRiskShipmentSns(productRow);
	return riskSns.size > 0;
}

function getSalesStatusShortText(status: string) {
	const map: Record<string, string> = {
		"销量稳定": "稳定", "14天无单": "14无", "7天无单": "7无", "3天无单": "3无",
		"短期突降": "短降", "短期突增": "短增", "明显增长": "显增", "明显下滑": "显降",
		"小幅增长": "小增", "小幅下滑": "小降", "销量平稳": "平稳"
	};
	return map[status] || status;
}

function getRecentPurchasePlans(details: any[], days: number) {
	if (!details || !Array.isArray(details)) return [];
	const d = new Date();
	d.setDate(d.getDate() - days);
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	const threshold = `${yyyy}-${mm}-${dd}`;
	return details.filter(item => {
		if (!item.create_time_remote) return false;
		return item.create_time_remote >= threshold;
	});
}

function getPendingDeliveryTagType(status: number): 'success' | 'warning' | 'info' | 'danger' | 'primary' {
	switch (status) {
		case 2: return 'warning';
		case 1: return 'primary';
		case 3: return 'info';
		case 121: return 'info';
		case 122: return 'danger';
		default: return 'info';
	}
}

// ========== 补货数据缓存 ==========

const restockingCache = ref(new Map<string, any>());
const purchasePlansCache = ref(new Map<string, any[]>());

function getRestockingKey(asin: string, marketplace: string, sellerName?: string) {
	const seller = sellerName ? sellerName.trim() : "";
	return `${asin}__${marketplace}__${seller}`;
}

// ========== hydrate 注水函数 ==========

async function hydrateRestockingForRows(rows: any[]) {
	const items = rows
		.filter((r) => r?.asin && r?.marketplace)
		.map((r) => ({ asin: r.asin, marketplace: r.marketplace, sellerName: r.seller_name ? String(r.seller_name).trim() : undefined }));

	const uniqueMap = new Map<string, { asin: string; marketplace: string; sellerName?: string }>();
	for (const it of items) {
		uniqueMap.set(getRestockingKey(it.asin, it.marketplace, it.sellerName), it);
	}

	const missing = Array.from(uniqueMap.values()).filter(
		(it) => !restockingCache.value.has(getRestockingKey(it.asin, it.marketplace, it.sellerName))
	);

	if (missing.length > 0) {
		try {
			const res = await service.app.bsr_restocking_center_lingxing.getByAsinAndMarketplaceBatch({ items: missing });
			const list = Array.isArray(res) ? res : [];
			for (const entity of list) {
				const asin = entity?.asin;
				const marketplaces = entity?.marketplaceList;
				const stores = entity?.storeList;
				if (!asin || !Array.isArray(marketplaces)) continue;
				for (const mp of marketplaces) {
					if (Array.isArray(stores) && stores.length > 0) {
						for (const storeName of stores) {
							const key = getRestockingKey(asin, mp, storeName);
							restockingCache.value.set(key, entity);
						}
						const fallbackKey = getRestockingKey(asin, mp, "");
						if (!restockingCache.value.has(fallbackKey)) {
							restockingCache.value.set(fallbackKey, entity);
						}
					} else {
						const key = getRestockingKey(asin, mp, "");
						if (!restockingCache.value.has(key)) {
							restockingCache.value.set(key, entity);
						}
					}
				}
			}
		} catch (err) {
			console.error("批量获取补货建议失败:", err);
		}
	}

	for (const row of rows) {
		if (!row?.asin || !row?.marketplace) { row.restocking = null; continue; }
		const sellerName = row.seller_name ? String(row.seller_name).trim() : "";
		const key = getRestockingKey(row.asin, row.marketplace, sellerName || undefined);
		let restocking = restockingCache.value.get(key);
		if (!restocking) {
			const fallbackKey = getRestockingKey(row.asin, row.marketplace, "");
			restocking = restockingCache.value.get(fallbackKey);
		}
		row.restocking = restocking ?? null;
		const r = row.restocking;
		if (Array.isArray(r?.extInfo?.localValidDetailList) && r.extInfo.localValidDetailList.length > 0) {
			row.restocking_local_valid = r.extInfo.localValidDetailList.reduce(
				(sum: number, item: any) => {
					const valid = Number(item.quantityValid) || 0;
					const locked = Number(item.quantityLocked) || 0;
					return sum + valid + locked;
				}, 0
			);
		} else {
			row.restocking_local_valid = r?.scmQuantityInfo?.scQuantityLocalValid ?? null;
		}
		row.restocking_stock_total = r?.stockQuantityInfo?.stockTotal ?? null;
		row.restocking_reserved_customerorders = r?.scmQuantityInfo?.scQuantityPurchaseShipping ?? null;
		row.restocking_purchase_plan = r?.scmQuantityInfo?.scQuantityPurchasePlan ?? null;
		row.restocking_estimated_sale_quantity = r?.amazonQuantityInfo?.amazonQuantityShippingPlan ?? null;
		row.restocking_oversea_valid = r?.scmQuantityInfo?.scQuantityOverseaValid ?? null;
		row.restocking_available_sale_days = r?.suggestInfo?.availableSaleDays ?? null;
		row.restocking_available_sale_days_fba = r?.suggestInfo?.availableSaleDaysFba ?? null;
		row.restocking_out_stock_date = r?.suggestInfo?.outStockDate ?? null;
		row.restocking_sug_date_purchase = r?.suggestInfo?.sugDatePurchase ?? null;
		row.restocking_sug_date_send_local = r?.suggestInfo?.sugDateSendLocal ?? null;
		row.restocking_ext_remark = r?.extInfo?.remark ?? null;
	}
}

async function hydrateTempStoredQtyForRows(rows: any[]) {
	const items = rows
		.filter((r) => r?.asin && r?.marketplace)
		.map((r) => ({ asin: r.asin, marketplace: r.marketplace, store_id: r.store_id, msku: r.msku }));
	if (items.length === 0) return;

	const uniqueMap = new Map<string, { asin: string; marketplace: string; store_id?: number; msku?: string }>();
	for (const it of items) {
		uniqueMap.set(`${it.asin}-${it.marketplace}-${it.store_id}-${it.msku}`, it);
	}
	const uniqueItems = Array.from(uniqueMap.values());

	try {
		const res = await service.app.bsr_analysis_record_lingxing.getHistoryBatch({ items: uniqueItems });
		const recordMap = new Map<string, any[]>();
		if (Array.isArray(res)) {
			for (const r of res) {
				const key = `${r.asin}-${r.marketplace}-${r.store_id}-${r.msku}`;
				if (!recordMap.has(key)) recordMap.set(key, []);
				recordMap.get(key)?.push(r);
			}
		}

		for (const row of rows) {
			if (!row?.asin || !row?.marketplace) { row.temp_stored_total = 0; continue; }
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
					} catch (e) { /* ignore */ }
				}
				total += finalQty;
				const fmtDate = (d: string) => d ? d.substring(5) : '';
				const fmtTime = (t: string) => t ? t.substring(5, 16) : '';
				details.push({
					id: record.id, status: record.status,
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

async function hydratePurchasePlansForRows(rows: any[]) {
	const items = rows
		.filter((r) => r?.asin && r?.marketplace && r?.store_id)
		.map((r) => ({ asin: r.asin, marketplace: r.marketplace, store_id: r.store_id, msku: r.msku }));
	if (items.length === 0) return;

	const uniqueMap = new Map<string, { asin: string; marketplace: string; store_id: number; msku?: string }>();
	for (const it of items) {
		uniqueMap.set(`${it.asin}|${it.marketplace}|${it.store_id}|${it.msku || ''}`, it);
	}

	try {
		const res = await (service.app.bsr_purchase_order_sync_lingxing as any).getPendingPurchasePlansByProducts({
			products: Array.from(uniqueMap.values())
		});
		for (const row of rows) {
			if (!row?.asin || !row?.marketplace || !row?.store_id) continue;
			const key = `${row.asin}|${row.marketplace}|${row.store_id}|${row.msku || ''}`;
			const data = res?.[key];
			row.purchase_plan_qty = data?.plan_qty ?? 0;
			row.purchase_plan_count = data?.plan_count ?? 0;
			row.purchase_plan_details = data?.details ?? [];
		}
	} catch (err) {
		console.error('批量获取采购计划数据失败:', err);
	}
}

async function hydratePendingDeliveryForRows(rows: any[]) {
	const items = rows
		.filter((r) => r?.asin && r?.marketplace && r?.store_id)
		.map((r) => ({ asin: r.asin, marketplace: r.marketplace, store_id: r.store_id, msku: r.msku }));
	if (items.length === 0) return;

	const uniqueMap = new Map<string, { asin: string; marketplace: string; store_id: number; msku?: string }>();
	for (const it of items) {
		uniqueMap.set(`${it.asin}|${it.marketplace}|${it.store_id}|${it.msku || ''}`, it);
	}

	try {
		const res = await (service.app.bsr_purchase_order_sync_lingxing as any).getPendingDeliveryByProducts({
			products: Array.from(uniqueMap.values())
		});
		for (const row of rows) {
			if (!row?.asin || !row?.marketplace || !row?.store_id) continue;
			const key = `${row.asin}|${row.marketplace}|${row.store_id}|${row.msku || ''}`;
			const data = res?.[key];
			row.pending_delivery_qty = data?.pending_qty ?? 0;
			row.pending_delivery_count = data?.pending_count ?? 0;
			row.pending_delivery_details = data?.details ?? [];
		}
	} catch (err) {
		console.error('批量获取待交付数据失败:', err);
	}
}

// ========== 排序 ==========
const currentSort = ref<{ prop?: string; order?: string }>({});

function getNextSortOrder(prop: string) {
	if (currentSort.value.prop !== prop) return "desc";
	if (currentSort.value.order === "desc") return "asc";
	if (currentSort.value.order === "asc") return undefined;
	return "desc";
}

function getSortIndicator(prop: string) {
	if (currentSort.value.prop !== prop) return "";
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

// ========== 关键词详情模态框 ==========
const detailDialogVisible = ref(false);
const detailListingRow = ref<any>(null);

function handleDetailClick(row: any) {
	detailListingRow.value = row;
	detailDialogVisible.value = true;
}

function handleDetailChanged() {
	Crud.value?.refresh();
}

const batchStopMyTrackingLoading = ref(false);

function buildTrackingListingPayload(row: any) {
	return {
		listing_id: row.id,
		store_id: row.store_id,
		marketplace: row.marketplace,
		product_code: row.product_code,
		asin_self: row.asin,
		msku: row.msku ?? null,
	};
}

async function handleBatchStopMyTracking() {
	const selected = Table.value?.selection || [];
	if (selected.length === 0) {
		ElMessage.warning("请先选择要取消跟踪的产品");
		return;
	}

	try {
		await ElMessageBox.confirm(
			`将取消你在 ${selected.length} 个产品下的关键词跟踪，历史数据会保留，不会影响其他用户，确认继续？`,
			"批量取消跟踪",
			{ confirmButtonText: "确认取消", cancelButtonText: "取消", type: "warning" }
		);
	} catch {
		return;
	}

	batchStopMyTrackingLoading.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/bsr_keyword_tracking/batchStopMyTracking",
			method: "POST",
			data: {
				listings: selected.map(buildTrackingListingPayload),
			},
		});

		if (res?.success > 0) {
			ElMessage.success(`已取消你的 ${res.success} 个关键词跟踪`);
		} else {
			ElMessage.warning("所选产品下没有你的跟踪记录");
		}
		Crud.value?.refresh();
	} catch (err: any) {
		ElMessage.error(err?.message || "批量取消跟踪失败");
	} finally {
		batchStopMyTrackingLoading.value = false;
	}
}

// ========== 表格列定义 ==========
const Table = useTable({
	columns: [
		{ type: "selection" },
		{ label: "图片", prop: "image_url_display", width: 70, align: "center" },
		{
			label: "状态", prop: "status", minWidth: 90,
			dict: [
				{ label: "在售", value: 1, type: "success" },
				{ label: "停售", value: 0, type: "danger" },
				{ label: "断货", value: 2, type: "danger" }
			]
		},
		{ label: "ASIN", prop: "asin", minWidth: 70 },
		{ label: "标题", prop: "item_name", showOverflowTooltip: true, minWidth: 70 },
		{ label: "店铺", prop: "shop", minWidth: 70, showOverflowTooltip: true },
		{ label: "MSKU/FNSKU", prop: "msku_fnsku", minWidth: 70, showOverflowTooltip: true },
		{ label: "售价", prop: "listing_price", minWidth: 70, sortable: "custom" },
		{ label: "自然位综合分", prop: "score_nf", minWidth: 110, align: "center", sortable: "custom" },
		{ label: "广告位综合分", prop: "score_sp", minWidth: 110, align: "center", sortable: "custom" },
		{ label: "自然位落后率", prop: "behind_rate_nf", minWidth: 120, align: "center", sortable: "custom" },
		{ label: "SP落后率", prop: "behind_rate_sp", minWidth: 120, align: "center", sortable: "custom" },
		{ label: "管理", type: "op", buttons: ["slot-test-btn"] }
	]
});

// ========== 精确搜索 ==========
const searchForm = ref({
	asin: '',
	product_code: '',
	msku: '',
	marketplace: '',
});

function doSearch() {
	// 必须始终传递全部字段（含空值），否则 cl-crud 会保留上次的旧参数
	Crud.value?.refresh({
		asin: searchForm.value.asin || undefined,
		product_code: searchForm.value.product_code || undefined,
		msku: searchForm.value.msku || undefined,
		marketplace: searchForm.value.marketplace || undefined,
	});
}

function resetSearch() {
	searchForm.value.asin = '';
	searchForm.value.product_code = '';
	searchForm.value.msku = '';
	searchForm.value.marketplace = '';
	// 显式传空对象，清除 cl-crud 内部缓存的旧搜索参数
	Crud.value?.refresh({ asin: undefined, product_code: undefined, msku: undefined, marketplace: undefined });
}

const routeAutoOpenHandled = ref(false);

function getRouteQueryString(key: string) {
	const value = route.query[key];
	return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function getRouteKeywordParams() {
	if (route.query.autoOpen !== '1') return {};
	return {
		asin: getRouteQueryString('asin') || undefined,
		product_code: getRouteQueryString('product_code') || undefined,
		msku: getRouteQueryString('msku') || undefined,
		marketplace: getRouteQueryString('marketplace') || undefined,
		store_id: getRouteQueryString('store_id') || undefined,
	};
}

function maybeOpenRouteKeywordDetail(rows: any[]) {
	if (routeAutoOpenHandled.value || route.query.autoOpen !== '1') return;
	const target = getRouteKeywordParams();
	const matched = rows.find((row: any) => {
		if (target.asin && String(row.asin) !== String(target.asin)) return false;
		if (target.marketplace && String(row.marketplace) !== String(target.marketplace)) return false;
		if (target.store_id && String(row.store_id) !== String(target.store_id)) return false;
		if (target.msku && String(row.msku || '') !== String(target.msku)) return false;
		if (target.product_code && String(row.product_code || '') !== String(target.product_code)) return false;
		return true;
	}) || rows[0];

	if (matched) {
		searchForm.value.asin = target.asin || '';
		searchForm.value.product_code = target.product_code || '';
		searchForm.value.msku = target.msku || '';
		searchForm.value.marketplace = target.marketplace || '';
		handleDetailClick(matched);
		routeAutoOpenHandled.value = true;
	}
}

// ========== CRUD ==========
const Crud = useCrud(
	{
		service: service.app.bsr_keyword_tracking,
		async onRefresh(params, { render }) {
			restockingCache.value.clear();
			purchasePlansCache.value.clear();

			// 清理空搜索参数，防止传空字符串给后端
			const cleanParams = { ...params, ...getRouteKeywordParams() };
			['asin', 'product_code', 'msku', 'marketplace', 'store_id'].forEach(key => {
				if (!cleanParams[key]) delete cleanParams[key];
			});

			// 调用自定义接口 trackingListingPage（只返回有跟踪的 Listing）
			const result = await service.request({
				url: '/admin/app/bsr_keyword_tracking/trackingListingPage',
				method: 'POST',
				data: cleanParams,
			});

			const list = result?.list || [];
			for (const item of list) {
				item.image_url_display = convert_image_url(item.image_url);
			}
			preloadProductImages(list, { reason: "bsr-keyword-tracking" });

			render(list, result?.pagination);

			const rows = Table.value?.data || [];
			await hydrateRestockingForRows(rows);
			await hydrateTempStoredQtyForRows(rows);
			await hydratePurchasePlansForRows(rows);
			await hydratePendingDeliveryForRows(rows);
			maybeOpenRouteKeywordDetail(rows);
		}
	},
	(app) => {
		app.refresh();
	}
);
</script>

<style scoped>
:deep(.el-table .cell) {
	font-size: 12px;
}

.summary-metric-trigger {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	min-height: 24px;
	padding: 0 3px;
	border: 0;
	border-radius: 4px;
	background: transparent;
	color: #303133;
	cursor: pointer;
	white-space: nowrap;
	transition: all 0.15s ease;
}

.summary-metric-trigger::after {
	position: absolute;
	right: 18px;
	bottom: 2px;
	left: 3px;
	border-bottom: 1px dashed #9fc9f6;
	content: "";
	opacity: 0.85;
}

.summary-metric-trigger:hover {
	background: #f2f8ff;
	color: #409eff;
}

.summary-metric-trigger.is-empty {
	color: #909399;
}

.summary-metric-trigger.is-empty::after {
	border-bottom-color: #c8d9ec;
}

.summary-metric-value {
	font-weight: 500;
}

.summary-metric-trigger.is-empty .summary-metric-value {
	font-weight: 400;
}

.summary-metric-history-icon {
	color: #8bbaf0;
	font-size: 13px;
	opacity: 0.9;
	transition: color 0.15s ease, opacity 0.15s ease;
}

.summary-metric-trigger:hover .summary-metric-history-icon {
	color: #409eff;
	opacity: 1;
}

.summary-metric-trigger.is-empty .summary-metric-history-icon {
	color: #a8abb2;
}

.summary-metric-delta {
	font-size: 11px;
	font-weight: 600;
}

.summary-history-popover {
	min-width: 388px;
	max-height: min(620px, calc(100vh - 96px));
	overflow-y: auto;
	padding-right: 2px;
}

.summary-history-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 8px;
	font-weight: 600;
}

.summary-history-compare {
	font-size: 12px;
	font-weight: 500;
	white-space: nowrap;
}

.summary-history-note {
	margin-bottom: 8px;
	color: #606266;
	font-size: 12px;
}

.summary-history-chart-wrap {
	margin-bottom: 10px;
	padding: 8px 8px 4px;
	border: 1px solid #ebeef5;
	border-radius: 6px;
	background: #fafcff;
}

.summary-history-chart {
	width: 100%;
	height: 150px;
}

.summary-history-chart-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 80px;
	color: #909399;
	font-size: 12px;
}

.is-good {
	color: #67c23a;
}

.is-bad {
	color: #f56c6c;
}

.is-flat {
	color: #909399;
}

:global(.summary-history-popper) {
	max-width: calc(100vw - 24px);
}
</style>
