<template>
	<div class="analysis-charts-container">
		<div class="dashboard-split-wrapper" ref="splitWrapperRef">
			<!-- 左侧：销售视图 -->
			<div class="split-column sales-column" :style="{ width: leftWidth + '%' }">
				<div class="column-content sales-content">
					<div class="chart-header">
						<span class="title">{{ chartTitle }}</span>
						<div class="header-controls">
							<!-- 普通刷新按钮 -->
							<el-button
								type="primary"
								size="small"
								@click="refreshData"
								:loading="loading"
								style="margin-right: 8px"
							>
								🔄 刷新数据
							</el-button>
							<!-- 强制刷新按钮（会重新请求所有历史数据） -->
							<el-button
								type="warning"
								size="small"
								@click="forceRefreshMySales"
								:loading="mySalesLoading"
								style="margin-right: 8px"
							>
								⚡ 强制刷新我的销量
							</el-button>
							<el-radio-group v-model="salesViewType" size="small">
								<el-radio-button label="month">月视图 (Month)</el-radio-button>
								<el-radio-button label="week">周视图 (Week)</el-radio-button>
							</el-radio-group>
						</div>
					</div>
					<div class="chart-section current-year">
						<div
							class="chart-wrapper SalesMain"
							:class="{ 'is-week': salesViewType === 'week' }"
						>
							<v-chart
								ref="salesChartRef"
								:option="salesChartOption"
								autoresize
								@datazoom="handleDataZoom"
							/>
						</div>

						<!-- 第一行：预计销量编辑行 -->
						<div class="forecast-grid-row input-row">
							<div class="forecast-title-label">预计销量</div>
							<div
								class="forecast-cells-container"
								ref="forecastWrapperRef"
								@scroll="handleGridScroll"
							>
								<div class="forecast-cells-inner" :style="getGridInnerStyle()">
									<div
										v-for="(val, idx) in salesViewType === 'month'
											? monthlyForecast
											: weeklyForecast"
										:key="idx"
										class="forecast-cell"
										:style="getEditItemStyle()"
									>
										<div class="forecast-input-wrapper">
											<el-input
												v-model.number="
													(salesViewType === 'month'
														? monthlyForecast
														: weeklyForecast)[idx]
												"
												size="small"
												placeholder="0"
											/>
										</div>
									</div>
								</div>
							</div>
							<div class="forecast-right-spacer"></div>
						</div>

						<!-- 第二行：活动/促销预览行 -->
						<div class="forecast-grid-row promo-row">
							<div class="forecast-title-label">活动促销</div>
							<div
								class="forecast-cells-container"
								@scroll="handleGridScrollProxy($event, 'promo')"
							>
								<div class="forecast-cells-inner" :style="getGridInnerStyle()">
									<div
										v-for="(val, idx) in salesViewType === 'month'
											? monthlyForecast
											: weeklyForecast"
										:key="idx"
										class="forecast-cell promo-cell"
										:style="getEditItemStyle()"
									>
										<template v-if="getActivePromosForIndex(idx).length > 0">
											<el-tooltip
												placement="top"
												effect="dark"
												popper-class="promo-tooltip-popper"
											>
												<template #content>
													<div class="promo-tooltip-content">
														<div
															v-for="promo in getActivePromosForIndex(
																idx
															)"
															:key="promo.id"
															class="promo-tooltip-item"
														>
															<div class="promo-info-row">
																<span class="promo-label"
																	>类型:</span
																>
																{{ promo.name }}
															</div>
															<div class="promo-info-row">
																<span class="promo-label"
																	>店铺:</span
																>
																{{ promo.shop_name }}
															</div>
															<div class="promo-info-row">
																<span class="promo-label"
																	>ASIN:</span
																>
																{{ promo.asin }}
															</div>
															<div class="promo-info-row">
																<span class="promo-label"
																	>国家:</span
																>
																{{ promo.marketplace }}
															</div>
															<div class="promo-info-row">
																<span class="promo-label"
																	>开始:</span
																>
																{{ promo.start }}
															</div>
															<div class="promo-info-row">
																<span class="promo-label"
																	>结束:</span
																>
																{{ promo.end }}
															</div>
															<div class="promo-info-row">
																<span class="promo-label"
																	>状态:</span
																>
																{{ promo.statusText }}
															</div>
															<div
																v-if="
																	promo.discount_rate &&
																	promo.discount_rate !== '0.00'
																"
																class="promo-info-row"
															>
																<span class="promo-label"
																	>折扣率:</span
																>
																{{ promo.discount_rate }}%
															</div>
															<div
																v-if="
																	promo.discount_price &&
																	promo.discount_price !== '0.00'
																"
																class="promo-info-row"
															>
																<span class="promo-label"
																	>折扣价:</span
																>
																{{ promo.discount_price }}
															</div>
														</div>
													</div>
												</template>

												<!-- 统一使用蓝色系风格，不再区分具体颜色 -->
												<div
													v-if="getActivePromosForIndex(idx).length === 1"
													class="promo-tag single-tag"
												>
													<span class="promo-text">{{
														getActivePromosForIndex(idx)[0].name
													}}</span>
												</div>
												<div v-else class="promo-tag multi-tag">
													<span class="promo-text">BD</span>
												</div>
											</el-tooltip>
										</template>
									</div>
								</div>
							</div>
							<div class="forecast-right-spacer"></div>
						</div>

						<!-- 货件追踪行 (改为按月/按周显示) -->
						<div class="forecast-grid-row shipment-row">
							<div class="forecast-title-label">货件</div>
							<div class="forecast-cells-container scrollbar-hide">
								<div class="forecast-cells-inner" :style="getGridInnerStyle()">
									<div
										v-for="(val, idx) in salesViewType === 'month'
											? monthlyForecast
											: weeklyForecast"
										:key="idx"
										class="forecast-cell shipment-cell"
										:style="getEditItemStyle()"
									>
										<template v-if="getShipmentsForIndex(idx).length > 0">
											<el-tooltip placement="top" effect="dark">
												<template #content>
													<div class="shipment-tooltip-content">
														<div
															style="
																font-weight: 700;
																margin-bottom: 10px;
																color: #fff;
																font-size: 14px;
																border-bottom: 1px solid
																	rgba(255, 255, 255, 0.2);
																padding-bottom: 6px;
															"
														>
															🚢 该周期在途明细 (总计
															{{
																getShipmentsForIndex(idx).reduce(
																	(s, p) => s + p.quantity,
																	0
																)
															}})
														</div>
														<div
															v-for="ship in getShipmentsForIndex(
																idx
															)"
															:key="ship.orderSn"
															class="shipment-tooltip-item"
														>
															<div class="ship-item-store">
																🏪
																{{ ship.store_name || "未知店铺" }}
															</div>
															<div class="ship-item-header">
																<span class="ship-item-sn">{{
																	ship.orderSn
																}}</span>
																<span class="ship-item-qty">{{
																	ship.quantity
																}}</span>
															</div>
															<div class="ship-item-asin">
																ASIN: {{ ship.asin }}
															</div>
															<div class="ship-item-meta">
																<span
																	>渠道:
																	{{
																		ship.logisticsChannelName
																	}}</span
																>
																<span
																	>方式:
																	{{ ship.shippingMethod }}</span
																>
															</div>
															<div class="ship-item-time">
																发货时间:
																{{ ship.shipmentTime || "未知" }}
															</div>
															<div class="ship-item-time">
																亚马逊预计可售时间:
																{{ ship.amazonSaleDate }}
															</div>
														</div>
													</div>
												</template>

												<div class="shipment-tag">
													<span class="ship-text">
														{{
															getShipmentsForIndex(idx).reduce(
																(s, p) => s + p.quantity,
																0
															)
														}}
													</span>
												</div>
											</el-tooltip>
										</template>
									</div>
								</div>
							</div>
							<div class="forecast-right-spacer"></div>
						</div>

						<!-- 新增：本地可用库存行 -->
						<div class="forecast-grid-row local-stock-row">
							<div class="forecast-title-label">库存</div>
							<div class="local-stock-container">
								<div class="local-stock-tag">
									<span class="stock-label">本地:</span>
									<span class="stock-value">{{ localStockQty }}</span>
								</div>
								<div class="local-stock-tag fba-stock-tag">
									<span class="stock-label">FBA:</span>
									<span class="stock-value">{{ fbaStockQty }}</span>
								</div>
								<div class="local-stock-tag shipment-stock-tag">
									<span class="stock-label">货件:</span>
									<span class="stock-value">{{ totalShipmentQty }}</span>
								</div>
							</div>
							<div class="forecast-right-spacer"></div>
						</div>

						<!-- obivious divider -->
						<div class="row-divider"></div>

						<!-- 新增：同事可售汇总行 (Mini Table 布局) -->
						<div class="forecast-grid-row peer-sales-row">
							<div class="forecast-title-label">同事可售</div>
							<div class="peer-sales-container">
								<div class="peer-metric-col">
									<div class="peer-header-cell">可售</div>
									<div class="peer-value-cell">{{ peerAvailableStock }}</div>
								</div>
								<div class="peer-metric-col">
									<div class="peer-header-cell">在途</div>
									<div class="peer-value-cell">{{ peerInTransitStock }}</div>
								</div>
								<div class="peer-metric-col">
									<div class="peer-header-cell">月销</div>
									<div class="peer-value-cell">{{ peerMonthlySales }}</div>
								</div>
							</div>
							<div class="forecast-right-spacer"></div>
						</div>
					</div>
				</div>
			</div>

			<!-- 分隔条 (Resizer) -->
			<div class="layout-resizer" @mousedown="startResizing">
				<div class="resizer-handle"></div>
			</div>

			<!-- 右侧：上下分栏布局 -->
			<div
				class="split-column keywords-column"
				ref="keywordsColumnRef"
				:style="{ width: 100 - leftWidth + '%' }"
			>
				<!-- 上部：搜索词趋势 -->
				<div
					class="right-upper-section"
					:style="{ height: verticalUpperHeightPx + 'px', minHeight: '200px' }"
				>
					<div class="column-content keywords-content">
						<div class="chart-header">
							<span class="title">搜索词趋势 (过去12个月)</span>
							<div class="keyword-tags">
								<el-check-tag
									v-for="kw in allKeywords"
									:key="kw.name"
									:checked="kw.selected"
									@change="toggleKeyword(kw)"
									class="kw-tag"
								>
									{{ kw.name }}
								</el-check-tag>
							</div>
						</div>

						<div class="chart-wrapper keyword-chart-flex">
							<v-chart
								ref="keywordChartRef"
								:option="keywordChartOption"
								autoresize
							/>
						</div>
					</div>
				</div>

				<!-- 上下分隔条 (Vertical Resizer) -->
				<div class="vertical-resizer" @mousedown="startVerticalResizing">
					<div class="vertical-resizer-handle"></div>
				</div>

				<!-- 下部：库存日历视图 -->
				<div
					class="right-lower-section"
					ref="calendarSectionRef"
					style="flex: 1; min-height: 0; display: flex; flex-direction: column"
				>
					<div class="calendar-header" :class="{ 'is-narrow': isNarrowCalendar }">
						<button
							class="nav-btn"
							:class="{ 'is-disabled': calendarMonthOffset <= minMonthOffset }"
							:disabled="calendarMonthOffset <= minMonthOffset"
							@click="navigateMonths(-1)"
						>
							◀
						</button>
						<span class="calendar-title">
							{{ calendarMonths[0]?.format("YYYY年M月") }} -
							{{ calendarMonths[1]?.format("M月") }}
						</span>
						<button
							class="nav-btn"
							:class="{ 'is-disabled': calendarMonthOffset >= maxMonthOffset }"
							:disabled="calendarMonthOffset >= maxMonthOffset"
							@click="navigateMonths(1)"
						>
							▶
						</button>
					</div>

					<!-- 图例说明（仅保留库存状态，货件/BD靠格子自解释） -->
					<div class="calendar-legend">
						<span class="legend-item"><span class="dot safe"></span>≥5天</span>
						<span class="legend-item"><span class="dot warning"></span>&lt;5天</span>
						<span class="legend-item"><span class="dot danger"></span>断货</span>
					</div>

					<!-- 算法警告提示 -->
					<!-- 算法警告提示已从顶部移除，改为点击时弹窗 -->
					<div
						class="calendar-scroll-container"
						:class="{ 'is-narrow-mode': isNarrowCalendar }"
					>
						<div class="calendar-grid" :class="{ 'is-narrow': isNarrowCalendar }">
							<!-- 4个月份并排 -->
							<div
								v-for="(month, mIdx) in calendarMonths"
								:key="mIdx"
								class="calendar-month"
							>
								<div class="month-title">{{ month.format("M月") }}</div>
								<div class="weekday-header">
									<span
										v-for="d in ['一', '二', '三', '四', '五', '六', '日']"
										:key="d"
										>{{ d }}</span
									>
								</div>
								<div class="days-grid">
									<div
										v-for="day in getMonthDays(month)"
										:key="day.dateStr"
										class="day-cell"
										:class="[
											getDayCellClass(day),
											{ 'is-selected': isInSelectionRange(day.dateStr) }
										]"
										@click="handleDayClickForSelection(day)"
									>
										<template v-if="day.isCurrentMonth">
											<span class="day-number">{{ day.day }}</span>
											<div class="day-icons-wrap">
												<!-- 货件图标 -->
												<el-tooltip
													v-if="day.shipments.length > 0"
													placement="top"
												>
													<template #content>
														<div class="calendar-tooltip">
															<div class="tooltip-title">
																📦 货件到货 ({{
																	day.shipments.reduce(
																		(s, x) => s + x.quantity,
																		0
																	)
																}}件)
															</div>
															<div
																v-for="s in day.shipments"
																:key="s.orderSn"
																class="tooltip-item"
															>
																<div
																	style="
																		font-weight: 600;
																		color: #67c23a;
																		margin-bottom: 3px;
																	"
																>
																	🏪
																	{{ s.store_name || "未知店铺" }}
																</div>
																<div
																	style="
																		font-weight: 600;
																		margin-bottom: 3px;
																	"
																>
																	{{ s.orderSn }}:
																	{{ s.quantity }}件
																</div>
																<div
																	style="
																		font-size: 11px;
																		color: #409eff;
																		margin-bottom: 2px;
																	"
																>
																	ASIN: {{ s.asin }}
																</div>
																<div
																	style="
																		font-size: 11px;
																		color: #a3a3a3;
																	"
																>
																	渠道:
																	{{ s.logisticsChannelName }} |
																	方式: {{ s.shippingMethod }}
																</div>
																<div
																	style="
																		font-size: 11px;
																		color: #a3a3a3;
																	"
																>
																	发货时间:
																	{{ s.shipmentTime || "未知" }}
																</div>
																<div
																	style="
																		font-size: 11px;
																		color: #a3a3a3;
																	"
																>
																	到货时间: {{ s.amazonSaleDate }}
																</div>
															</div>
														</div>
													</template>
													<span class="day-icon shipment-icon">📦</span>
												</el-tooltip>
												<!-- 活动图标 -->
												<el-tooltip
													v-if="day.promotions.length > 0"
													placement="top"
												>
													<template #content>
														<div class="calendar-tooltip promo-tooltip">
															<div class="tooltip-title">
																🔥 促销活动 ({{
																	day.promotions.length
																}}个)
															</div>
															<div
																v-for="p in day.promotions"
																:key="p.id || p.name"
																class="promo-detail-item"
															>
																<div class="promo-row">
																	<span class="promo-type">{{
																		p.name || "BD"
																	}}</span>
																	<span class="promo-shop">{{
																		p.shop_name
																	}}</span>
																</div>
																<div class="promo-row small">
																	<span>ASIN: {{ p.asin }}</span>
																</div>
																<div class="promo-row small">
																	<span
																		>开始:
																		{{
																			p.start?.split(" ")[0]
																		}}</span
																	>
																	<span
																		>结束:
																		{{
																			p.end?.split(" ")[0]
																		}}</span
																	>
																</div>
																<div class="promo-row small">
																	<span
																		:class="[
																			'promo-status',
																			p.status === 1
																				? 'active'
																				: 'inactive'
																		]"
																		>{{
																			p.statusText || "进行中"
																		}}</span
																	>
																</div>
															</div>
														</div>
													</template>
													<span class="day-icon promo-icon">BD</span>
												</el-tooltip>
											</div>
										</template>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- 高端方格动态底栏 (Premium Dynamic Grid Bar) -->
					<div class="premium-replenishment-bar" :class="{ 'is-active': selectionEnd }">
						<!-- 左侧：算法矩阵 (Dynamic Flex Cards) -->
						<div
							class="algo-matrix-container"
							:class="{
								'algo-only-mode': !selectionEnd,
								'is-disabled': baseDailyAvgSales === 0
							}"
						>
							<div
								v-for="(algo, idx) in algoNames"
								:key="idx"
								class="matrix-card"
								:class="{
									'is-active': algoSelection === idx + 1,
									'is-disabled': baseDailyAvgSales === 0 || !algoAvailability[idx]
								}"
								@click="handleAlgoClick(idx)"
							>
								<div class="card-inner">
									<span class="m-label">{{ algo }}</span>
									<span
										v-if="selectionEnd && algoAvailability[idx]"
										class="m-val"
										>{{ algoForecasts[idx] }}</span
									>
									<span
										v-else-if="selectionEnd && !algoAvailability[idx]"
										class="m-val disabled-val"
										>数据不足</span
									>
								</div>
							</div>
						</div>

						<!-- 中间：日期看板 (Info Panel) -->
						<div v-if="selectionEnd" class="info-panel-grid">
							<div class="date-stack">
								<div class="date-row start">
									<span class="dot icon-start"></span>
									<span v-if="selectionStart" class="val">{{
										selectionStart
									}}</span
									><span v-else class="val placeholder">点击日历选择...</span>
								</div>
								<div class="date-row end">
									<span class="dot icon-end"></span>
									<span v-if="selectionEnd" class="val">{{ selectionEnd }}</span>
									<span v-else class="val placeholder">请选择结束日期...</span>
								</div>
							</div>
							<div v-if="selectionEnd" class="duration-badge">
								<span class="num">{{
									dayjs(selectionEnd).diff(dayjs(selectionStart), "day") + 1
								}}</span>
							</div>
						</div>

						<!-- 右侧：行动中心 (紧凑扁平化) -->
						<transition name="slide-right"
							><div v-if="selectionEnd" class="action-center">
								<div class="input-box">
									<!-- 动态切换：系数为1时显示输入框，否则显示计算结果 -->
									<transition name="sales-toggle" mode="out-in">
										<div
											v-if="manualCoefficient === 1.0"
											class="sales-unit-wrapper"
											key="base-input"
										>
											<span class="box-label">预计销量</span>
											<el-input-number
												v-model="expectedDemandInput"
												:controls="false"
												placeholder="输入"
												size="small"
												class="box-input"
											/>
										</div>
										<div v-else class="sales-unit-wrapper" key="final-display">
											<span class="box-label active-coef">系数销量</span>
											<span class="box-final-val">
												{{
													Math.round(
														(expectedDemandInput || 0) *
															manualCoefficient
													)
												}}
											</span>
										</div>
									</transition>

									<span class="box-sep"></span>

									<span class="box-label coeff-label">人工系数</span>
									<el-input-number
										v-model="manualCoefficient"
										:controls="false"
										:step="0.1"
										:precision="1"
										placeholder="1.0"
										size="small"
										class="box-input coeff-input"
									/>

									<el-tooltip content="点击添加备注" placement="top">
										<span
											class="box-icon remark-icon"
											@click="remarkDialogVisible = true"
											:class="{ 'has-content': manualRemark }"
											>📝<span v-if="manualRemark" class="remark-dot"></span
										></span>
									</el-tooltip>
									<el-tooltip content="查看计算明细" placement="top">
										<span
											class="box-icon detail-icon"
											@click="replenishmentDetailVisible = true"
											>📊</span
										>
									</el-tooltip>
								</div>
								<div class="action-btns">
									<button class="act-btn cancel" @click="clearSelection">
										取消
									</button>
									<button class="act-btn save" @click="stageOrder">暂存</button>
									<button
										class="act-btn submit"
										@click="generateReplenishmentOrder"
									>
										生成单据
									</button>
								</div>
							</div></transition
						>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- 备注编辑弹窗 -->
	<el-dialog
		v-model="remarkDialogVisible"
		title="编辑备注"
		width="fit-content"
		:close-on-click-modal="false"
		custom-class="dynamic-remark-dialog"
	>
		<div class="remark-dialog-content">
			<div class="remark-section system-remark">
				<label class="remark-label">系统补货建议 (基于系数算法)：</label>
				<template v-if="parsedSystemRemark">
					<!-- 新增计算汇总看板 -->
					<div class="calculation-summary-card">
						<div class="calc-item">
							<span class="c-label">系统预计成交</span>
							<span class="c-val">{{ currentReplenishmentResult.total }}</span>
						</div>
						<div class="calc-sign">×</div>
						<div class="calc-item highlight">
							<span class="c-label">人工系数</span>
							<span class="c-val">{{ manualCoefficient.toFixed(1) }}</span>
						</div>
						<div class="calc-sign">=</div>
						<div class="calc-item result">
							<span class="c-label">最终补货单量</span>
							<span class="c-val">{{
								Math.round(currentReplenishmentResult.total * manualCoefficient)
							}}</span>
						</div>
					</div>

					<p class="remark-summary">{{ parsedSystemRemark.summary }}</p>

					<el-table
						v-if="
							parsedSystemRemark.breakdown && parsedSystemRemark.breakdown.length > 0
						"
						:data="parsedSystemRemark.breakdown"
						size="small"
						stripe
						class="compact-no-wrap-table"
					>
						<el-table-column prop="startDate" label="开始日期" min-width="95" />
						<el-table-column prop="endDate" label="结束日期" min-width="95" />
						<el-table-column prop="days" label="天数" width="55" align="center" />
						<el-table-column
							prop="coefficient"
							label="系统系数"
							width="75"
							align="center"
						/>
						<el-table-column label="建议日均" width="75" align="center">
							<template #default="{ row }">
								{{ (baseDailyAvgSales * row.coefficient).toFixed(1) }}
							</template>
						</el-table-column>
						<el-table-column label="建议算法" min-width="90">
							<template #default="{ row }">
								<span class="algo-name">{{
									algoNames[row.algoUsed - 1] || "日均"
								}}</span>
								<el-tooltip
									v-if="row.fallbackReason"
									:content="row.fallbackReason"
									placement="top"
								>
									<span class="fallback-indicator">*</span>
								</el-tooltip>
							</template>
						</el-table-column>
						<el-table-column
							prop="subtotal"
							label="补货建议"
							min-width="70"
							align="right"
						/>
					</el-table>
				</template>
				<p v-else class="remark-text readonly">暂未生成</p>
			</div>
			<div class="remark-section manual-remark">
				<label class="remark-label">人工备注：</label>
				<el-input
					v-model="manualRemark"
					type="textarea"
					:rows="3"
					placeholder="可选填写补充说明..."
					maxlength="500"
					show-word-limit
				/>
			</div>
		</div>
		<template #footer>
			<el-button @click="remarkDialogVisible = false">取消</el-button
			><el-button type="primary" @click="handleRemarkConfirm">保存</el-button>
		</template>
	</el-dialog>

	<!-- 补货明细弹窗 -->
	<el-dialog
		v-model="replenishmentDetailVisible"
		title="📊 补货明细计算"
		width="680px"
		:close-on-click-modal="true"
	>
		<div class="replenishment-detail-content">
			<!-- Tab切换 -->
			<div class="detail-tab-switcher">
				<el-radio-group v-model="remarkTabMode" size="default" @change="onRemarkTabChange">
					<el-radio-button value="window">5个月窗口总览</el-radio-button>
					<el-radio-button value="selection">用户选择明细</el-radio-button>
					<el-radio-button value="history">暂存历史</el-radio-button>
				</el-radio-group>
			</div>

			<!-- 5个月窗口总览 -->
			<div v-if="remarkTabMode === 'window'" class="detail-section">
				<template v-if="windowCalculation && windowCalculation.isValid">
					<!-- 窗口汇总卡片 -->
					<div class="window-summary-card">
						<div class="summary-item">
							<span class="s-label">窗口范围</span>
							<span class="s-value"
								>{{ windowCalculation.segments[0]?.month }} ~
								{{
									windowCalculation.segments[
										windowCalculation.segments.length - 1
									]?.month
								}}</span
							>
						</div>
						<div class="summary-divider"></div>
						<div class="summary-item">
							<span class="s-label">基础日均</span>
							<span class="s-value">{{ baseDailyAvgSales.toFixed(1) }}</span>
						</div>
						<div class="summary-divider"></div>
						<div class="summary-item">
							<span class="s-label">人工系数</span>
							<span class="s-value highlight">{{
								manualCoefficient.toFixed(1)
							}}</span>
						</div>
						<div class="summary-divider"></div>
						<div class="summary-item large">
							<span class="s-label">窗口总需求</span>
							<span class="s-value primary"
								>{{
									Math.round(windowCalculation.total * manualCoefficient)
								}}
								件</span
							>
						</div>
					</div>

					<!-- 5个月窗口分段表格 -->
					<el-table
						:data="windowCalculation.segments"
						stripe
						style="width: 100%"
						size="small"
					>
						<el-table-column prop="monthName" label="月份" min-width="90">
							<template #default="{ row }">
								<span
									v-if="row.month === dayjs().format('YYYY-MM')"
									class="current-month-dot"
								>
									<span class="dot-icon"></span>{{ row.monthName }}
								</span>
								<span v-else>{{ row.monthName }}</span>
							</template>
						</el-table-column>
						<el-table-column prop="days" label="天数" width="60" align="center" />
						<el-table-column
							prop="coefficient"
							label="系统系数"
							width="80"
							align="center"
						>
							<template #default="{ row }">
								<span
									:style="{
										color:
											row.coefficient > 1
												? '#e6a23c'
												: row.coefficient < 1
													? '#67c23a'
													: '#909399'
									}"
								>
									{{ row.coefficient.toFixed(2) }}
								</span>
							</template>
						</el-table-column>
						<el-table-column
							prop="daily_sales"
							label="建议日均"
							width="90"
							align="right"
						/>
						<el-table-column label="建议算法" min-width="110">
							<template #default="{ row }">
								<span class="algo-name-text">{{ row.algo_used_name }}</span>
								<el-tooltip
									v-if="row.fallback_reason"
									:content="row.fallback_reason"
									placement="top"
								>
									<span class="fallback-star">*</span>
								</el-tooltip>
							</template>
						</el-table-column>
						<el-table-column prop="subtotal" label="月度需求" align="right">
							<template #default="{ row }">
								<strong>{{ row.subtotal }}</strong>
							</template>
						</el-table-column>
					</el-table>
				</template>
				<el-alert
					v-else
					:title="windowCalculation?.warning || '暂无数据'"
					type="warning"
					:closable="false"
					show-icon
				/>
			</div>

			<!-- 用户选择明细 -->
			<div v-else-if="remarkTabMode === 'selection'" class="detail-section">
				<!-- 汇总信息 -->
				<div class="detail-summary">
					<div class="summary-row">
						<span class="label">日期范围：</span>
						<span class="value">{{ selectionStart }} ~ {{ selectionEnd }}</span>
					</div>
					<div class="summary-row">
						<span class="label">基础日均销量：</span>
						<span class="value">{{ baseDailyAvgSales.toFixed(2) }}</span>
					</div>
					<div class="summary-row">
						<span class="label">算法：</span>
						<span class="value">{{ algoNames[(algoSelection || 1) - 1] }}</span>
					</div>
					<div class="summary-row total">
						<span class="label">补货总量：</span>
						<span class="value highlight"
							>{{ currentReplenishmentResult.total }} 件</span
						>
					</div>
				</div>

				<!-- 分段明细表格 -->
				<el-table
					:data="currentReplenishmentResult.segments"
					stripe
					style="width: 100%"
					size="small"
				>
					<el-table-column prop="startDate" label="开始日期" width="100" />
					<el-table-column prop="endDate" label="结束日期" width="100" />
					<el-table-column prop="days" label="天数" width="55" align="center" />
					<el-table-column prop="coefficient" label="系数" width="70" align="center">
						<template #default="{ row }">
							<span
								:style="{
									color:
										row.coefficient > 1
											? '#e6a23c'
											: row.coefficient < 1
												? '#67c23a'
												: '#909399'
								}"
							>
								{{ row.coefficient.toFixed(2) }}
							</span>
						</template>
					</el-table-column>
					<el-table-column prop="dailyNeed" label="日需" width="70" align="center" />
					<el-table-column label="算法" min-width="100">
						<template #default="{ row }">
							<span class="algo-name-text">{{
								algoNames[row.algoUsed - 1] || "日均"
							}}</span>
							<el-tooltip
								v-if="row.fallbackReason"
								:content="row.fallbackReason"
								placement="top"
							>
								<span class="fallback-star">*</span>
							</el-tooltip>
						</template>
					</el-table-column>
					<el-table-column prop="subtotal" label="小计" align="right">
						<template #default="{ row }">
							<strong>{{ row.subtotal }}</strong>
						</template>
					</el-table-column>
				</el-table>

				<!-- 警告提示 -->
				<el-alert
					v-if="currentReplenishmentResult.warning"
					:title="currentReplenishmentResult.warning"
					type="warning"
					:closable="false"
					show-icon
					style="margin-top: 10px"
				/>
			</div>

			<!-- 历史记录 -->
			<div v-else-if="remarkTabMode === 'history'" class="detail-section history-section">
				<div v-if="historyLoading" class="history-loading">
					<el-icon class="is-loading"><i-ep-loading /></el-icon>
					加载中...
				</div>
				<div v-else-if="historyRecords.length === 0" class="history-empty">
					<el-empty description="暂无历史记录" />
				</div>
				<div v-else class="history-list">
					<div
						v-for="record in historyRecords"
						:key="record.id"
						class="history-item"
						:class="{ 'is-current': record.status === 0 }"
					>
						<div class="history-item-header">
							<span class="history-time">{{
								formatHistoryTime(record.createTime)
							}}</span>
							<el-tag size="small" :type="record.status === 0 ? 'primary' : 'info'">{{
								record.status_text
							}}</el-tag>
						</div>
						<div class="history-item-body">
							<div class="history-info">
								<span class="history-range">{{ getHistoryDateRange(record) }}</span>
								<span class="history-algo">{{ getHistoryAlgoName(record) }}</span>
								<span class="history-coeff">系数{{ getHistoryCoeff(record) }}</span>
								<span class="history-qty">{{ getHistoryQty(record) }} 件</span>
							</div>
						</div>
						<div class="history-item-actions">
							<el-button
								size="small"
								type="primary"
								link
								@click="restoreHistoryRecord(record)"
								>使用此记录</el-button
							>
							<el-button
								size="small"
								type="info"
								link
								@click="viewHistoryDetail(record)"
								>查看明细</el-button
							>
						</div>
					</div>
				</div>
			</div>
		</div>
		<template #footer>
			<el-button @click="replenishmentDetailVisible = false">关闭</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { ElMessageBox, ElMessage } from "element-plus";
import { useCool } from "/@/cool";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart, LineChart } from "echarts/charts";
import {
	GridComponent,
	TooltipComponent,
	LegendComponent,
	DataZoomComponent
} from "echarts/components";
import VChart from "vue-echarts";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import weekOfYear from "dayjs/plugin/weekOfYear";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isBetween);
dayjs.extend(weekOfYear);
dayjs.extend(isSameOrBefore);

use([
	CanvasRenderer,
	BarChart,
	LineChart,
	GridComponent,
	TooltipComponent,
	LegendComponent,
	DataZoomComponent
]);

const props = defineProps(["listing"]);
const { service } = useCool();
const salesChartRef = ref<any>(null);
const weekGridRef = ref<HTMLElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);

const salesViewType = ref("month"); // 'month' | 'week'
const leftWidth = ref(50); // 左侧占比 %
const isResizing = ref(false);
const splitWrapperRef = ref<HTMLElement | null>(null);

const startResizing = (e: MouseEvent) => {
	isResizing.value = true;
	document.addEventListener("mousemove", handleResizing);
	document.addEventListener("mouseup", stopResizing);
	document.body.style.cursor = "col-resize";
	document.body.style.userSelect = "none";
};

const handleResizing = (e: MouseEvent) => {
	if (!isResizing.value || !splitWrapperRef.value) return;

	const wrapperRect = splitWrapperRef.value.getBoundingClientRect();
	const newLeftWidth = ((e.clientX - wrapperRect.left) / wrapperRect.width) * 100;

	// 限制范围: 20% ~ 80%
	if (newLeftWidth >= 20 && newLeftWidth <= 80) {
		leftWidth.value = newLeftWidth;
	}
};

const stopResizing = () => {
	isResizing.value = false;
	document.removeEventListener("mousemove", handleResizing);
	document.removeEventListener("mouseup", stopResizing);
	document.body.style.cursor = "";
	document.body.style.userSelect = "";
};

// --- 上下分隔条 (Vertical Resizer) ---
const keywordsColumnRef = ref<HTMLElement | null>(null);
const calendarSectionRef = ref<HTMLElement | null>(null);
const keywordChartRef = ref<any>(null);
const verticalUpperHeightPx = ref(300); // 初始像素高度 (会在 onMounted 更新)
const isVerticalResizing = ref(false);

const calendarGridWidth = ref(0);
// 动态计算切换阈值：单月日历在显示“日期+图标”时的最低体面宽度约为 340px
// 如果可用空间小于 2 个月所需的宽度 (340 * 2)，则切换为单列排布
const isNarrowCalendar = computed(() => {
	const minDecentMonthWidth = 340;
	return calendarGridWidth.value < minDecentMonthWidth * 2;
});
let calendarObserver: ResizeObserver | null = null;

// 当前暂存记录的ID（用于后续完结操作）
const currentRecordId = ref<number | null>(null);

// 人工备注相关
const manualRemark = ref<string>("");
const remarkDialogVisible = ref(false);
const remarkFromGenerateFlow = ref(false); // 标记备注弹窗是否来自"生成单据"流程
const remarkFromStageFlow = ref(false); // 标记备注弹窗是否来自"暂存"流程

// 采购计划创建中状态（防止重复点击）
const isCreatingPurchasePlan = ref(false);

onMounted(async () => {
	// 使用 nextTick 确保 DOM 已经初次渲染
	nextTick(() => {
		if (keywordsColumnRef.value) {
			const totalHeight = keywordsColumnRef.value.getBoundingClientRect().height;
			// 初始比例改为动态：如果没有足够高度，按 45% 分配，绝不给死数字
			verticalUpperHeightPx.value = totalHeight > 100 ? Math.floor(totalHeight * 0.45) : 250;
		}

		// 监听日历区域宽度
		if (calendarSectionRef.value) {
			calendarObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					calendarGridWidth.value = entry.contentRect.width;
				}
			});
			calendarObserver.observe(calendarSectionRef.value);
		}
	});

	// 查询是否有暂存记录，如果有则回填数据
	try {
		const latestRecord = await service.app.bsr_analysis_record_lingxing.latest({
			store_id: props.listing?.store_id,
			asin: props.listing?.asin,
			marketplace: props.listing?.marketplace
		});
		if (latestRecord && latestRecord.expected_sales) {
			// 回填数据 - 设置标记避免自动弹窗
			isRestoringData.value = true;
			currentRecordId.value = latestRecord.id;
			const salesData = latestRecord.expected_sales;
			selectionStart.value = salesData.startDate || null;
			selectionEnd.value = salesData.endDate || null;
			expectedDemandInput.value = salesData.totalQty || null;

			// 新增：回填算法选择和人工系数
			algoSelection.value = salesData.userSelectedAlgo || 1;
			manualCoefficient.value = salesData.manualCoefficient || 1.0;

			// 回填人工备注
			manualRemark.value = latestRecord.manual_remark || "";
			// 系统备注会自动通过 computed 生成
			ElMessage.info("已加载上次暂存的补货分析记录");
			// 延迟重置标记，确保 watcher 执行完毕
			nextTick(() => {
				isRestoringData.value = false;
			});
		}
	} catch (err) {
		console.warn("查询暂存记录失败:", err);
	}
});

onUnmounted(() => {
	if (calendarObserver) {
		calendarObserver.disconnect();
	}
});

const startVerticalResizing = (e: MouseEvent) => {
	isVerticalResizing.value = true;
	document.addEventListener("mousemove", handleVerticalResizing);
	document.addEventListener("mouseup", stopVerticalResizing);
	document.body.style.cursor = "ns-resize";
	document.body.style.userSelect = "none";
	e.preventDefault();
};

const handleVerticalResizing = (e: MouseEvent) => {
	if (!isVerticalResizing.value || !keywordsColumnRef.value) return;

	const wrapperRect = keywordsColumnRef.value.getBoundingClientRect();
	const containerHeight = wrapperRect.height;
	const mouseRelativeY = e.clientY - wrapperRect.top;

	// --- 完全动态的保护限制 (绝不糊弄) ---

	// 1. 动态获取上部最小高度 (实测标题栏)
	let minTopH = 80;
	const upperHeader = keywordsColumnRef.value.querySelector(".chart-header");
	if (upperHeader) minTopH = (upperHeader as HTMLElement).offsetHeight + 10;

	// 2. 动态获取下部最小高度 (实测日历全内容)
	let minBottomH = 350;
	const grid = calendarSectionRef.value?.querySelector(".calendar-grid");
	const cHeader = calendarSectionRef.value?.querySelector(".calendar-header");
	const cLegend = calendarSectionRef.value?.querySelector(".calendar-legend");
	if (grid && cHeader && cLegend) {
		minBottomH =
			(grid as HTMLElement).offsetHeight +
			(cHeader as HTMLElement).offsetHeight +
			(cLegend as HTMLElement).offsetHeight +
			10;
	}

	// 3. 智能冲突解决：如果屏幕实在太小，放不下两份“完整内容”，则允许压缩，保证 Resizer 永远能动
	let allowedMaxTop = containerHeight - minBottomH;

	// 如果计算出的范围冲突，强制留出上下各 10% 的滑动余地，决不卡死
	if (allowedMaxTop <= minTopH + 20) {
		minTopH = containerHeight * 0.1;
		allowedMaxTop = containerHeight * 0.9;
	}

	const newHeightPx = Math.max(minTopH, Math.min(allowedMaxTop, mouseRelativeY));
	verticalUpperHeightPx.value = newHeightPx;

	// 手动触发 ECharts resize 并在 nextTick 中确保 DOM 更新
	if (keywordChartRef.value) {
		keywordChartRef.value.resize();
	}

	// 同时触发全局 resize 以防万一
	nextTick(() => {
		window.dispatchEvent(new Event("resize"));
	});
};

const stopVerticalResizing = () => {
	isVerticalResizing.value = false;
	document.removeEventListener("mousemove", handleVerticalResizing);
	document.removeEventListener("mouseup", stopVerticalResizing);
	document.body.style.cursor = "";
	document.body.style.userSelect = "";

	// 最终确保一切都已就绪
	if (keywordChartRef.value) {
		keywordChartRef.value.resize();
	}
	window.dispatchEvent(new Event("resize"));
};

// --- 销售视图逻辑 ---
const getWeekFullLabel = (index: number) => {
	const start = chartStartBase.value.add(index * 7, "day");
	const year = start.year();
	const weekIdx = Math.floor(start.diff(dayjs(`${year}-01-01`), "day") / 7) + 1;
	return `${year}年 第${weekIdx}周`;
};
const currentYear = dayjs().year();
const currentMonth = dayjs().month(); // 0-11
const currentWeek = dayjs().week();

// --- 补货区间选择逻辑 (A 方案：首尾点选) ---
const selectionStart = ref<string | null>(null); // 开始日期字符串 YYYY-MM-DD
const selectionEnd = ref<string | null>(null); // 结束日期字符串
const isSelecting = computed(() => !!selectionStart.value && !!selectionEnd.value);

// --- 补货增强功能状态 ---
const expectedDemandInput = ref<number | null>(null); // 手动编辑的预计需求
const algoSelection = ref<number | null>(1); // 当前选中的算法 (1=日均单量, 2=历史销售, 3=搜索词趋势)，默认选中第一个
const algoNames = ["日均单量", "历史销售", "搜索词趋势"]; // 算法名称列表
const stagedOrders = ref<any[]>([]); // 暂存订单 (内存)
const replenishmentDetailVisible = ref(false); // 补货明细弹窗可见性
const manualCoefficient = ref<number>(1.0); // 手动系数，用户可调整预计销量，默认1.0
const isRestoringData = ref(false); // 标记：是否正在回填暂存数据（避免自动弹窗）

// 补货明细接口（前向声明，实际实现在算法核心部分）
interface ReplenishmentSegment {
	startDate: string;
	endDate: string;
	days: number;
	algorithm: string; // 用户选择的算法名称
	coefficient: number;
	dailyNeed: number;
	subtotal: number;
	algoUsed: number; // 实际使用的算法 (1/2/3)，可能因数据不足降级
	fallbackReason: string | null; // 降级原因，null表示未降级
}

interface ReplenishmentResult {
	total: number;
	segments: ReplenishmentSegment[];
	isValid: boolean;
	warning: string | null;
}

// 算法数据可用性检测
const algoAvailability = computed(() => {
	// 统一基准：去年同月
	const currentBaseMonthStr = dayjs().subtract(1, "year").format("YYYY-MM");
	const currentBaseIndex = last12Months.value.findIndex((m) => m === currentBaseMonthStr);

	// 算法1: 日均单量，始终可用
	const algo1Available = true;

	// 算法2: 历史销量
	const historyData = lastYearMonthlySales.value;
	const historyBase = currentBaseIndex >= 0 ? historyData?.[currentBaseIndex] : 0;
	const algo2Available =
		historyData &&
		historyData.length > 0 &&
		currentBaseIndex >= 0 &&
		historyBase &&
		historyBase > 0;

	// 算法3: 搜索词趋势
	const keywordBase = currentBaseIndex >= 0 ? keywordMonthlyTotals.value?.[currentBaseIndex] : 0;
	// 只要能找到去年同月的数据，且不为0，算法就可用
	const algo3Available =
		keywordMonthlyTotals.value &&
		keywordMonthlyTotals.value.length > 0 &&
		currentBaseIndex >= 0 &&
		keywordBase &&
		keywordBase > 0;

	return [algo1Available, algo2Available, algo3Available];
});

// 前向声明占位符 - 实际函数在后面定义
const _lazyAlgoForecasts = ref<number[]>([0, 0, 0]);
const _lazyReplenishmentResult = ref<ReplenishmentResult>({
	total: 0,
	segments: [],
	isValid: false,
	warning: null
});

// 兼容接口 - 用于UI绑定 (实际值由后面的computed驱动)
const algoForecasts = computed(() => _lazyAlgoForecasts.value);
const currentReplenishmentResult = computed(() => _lazyReplenishmentResult.value);

// 处理算法按钮点击（包含禁用状态提示）
const handleAlgoClick = (index: number) => {
	if (baseDailyAvgSales.value === 0) {
		ElMessageBox.alert(
			"该产品目前暂无日均销量数据，系统无法生成库存预测。不过，您仍可以查看已有的活动和货件到货安排。",
			"查阅模式说明",
			{
				confirmButtonText: "我知道了",
				type: "info"
			}
		);
		return;
	}
	selectAlgo(index);
};

// 点击算法赋值（会检查数据可用性）
const selectAlgo = async (index: number) => {
	const algo = index + 1; // 1=日均单量, 2=历史销量, 3=搜索词趋势

	// 算法1 直接选中
	if (algo === 1) {
		algoSelection.value = algo;
		algorithmWarning.value = null;
		expectedDemandInput.value = algoForecasts.value[index];
		return;
	}

	// 检查算法2/3的数据是否可用
	let warningMessage = "";
	if (algo === 2) {
		// 检查历史销量数据 (修复为检查去年同月)
		const currentBaseMonthStr = dayjs().subtract(1, "year").format("YYYY-MM");
		const currentBaseIndex = last12Months.value.findIndex((m) => m === currentBaseMonthStr);
		const baseValue = currentBaseIndex >= 0 ? lastYearMonthlySales.value[currentBaseIndex] : 0;
		if (!lastYearMonthlySales.value || lastYearMonthlySales.value.length === 0) {
			warningMessage = '历史销量数据不足，是否切换为"日均单量"算法？';
		} else if (!baseValue || baseValue === 0) {
			warningMessage = '当前月历史销量为0，无法计算系数。是否切换为"日均单量"算法？';
		}
	} else if (algo === 3) {
		// 检查搜索词数据 (修复为检查去年同月)
		const currentBaseMonthStr = dayjs().subtract(1, "year").format("YYYY-MM");
		const currentBaseIndex = last12Months.value.findIndex((m) => m === currentBaseMonthStr);
		const baseValue = currentBaseIndex >= 0 ? keywordMonthlyTotals.value[currentBaseIndex] : 0;

		if (!keywordMonthlyTotals.value || keywordMonthlyTotals.value.length === 0) {
			warningMessage = '搜索词数据不足，是否切换为"日均单量"算法？';
		} else if (!baseValue || baseValue === 0) {
			warningMessage = '当前月搜索词数据为0，无法计算系数。是否切换为"日均单量"算法？';
		}
	}

	// 如果有警告，弹窗确认
	if (warningMessage) {
		try {
			await ElMessageBox.confirm(warningMessage, "数据不足提示", {
				confirmButtonText: "切换到日均单量",
				cancelButtonText: "取消",
				type: "warning"
			});
			// 用户确认，切换到算法1
			algoSelection.value = 1;
			algorithmWarning.value = null;
			expectedDemandInput.value = algoForecasts.value[0];
		} catch (e) {
			// 用户取消，保持原算法
		}
		return;
	}

	// 数据可用，正常选中
	algoSelection.value = algo;
	algorithmWarning.value = null;
	expectedDemandInput.value = algoForecasts.value[index];
};

// 自动跟随时长变化同步预计需求
watch(
	algoForecasts,
	(newVals) => {
		if (algoSelection.value !== null) {
			const idx = algoSelection.value - 1;
			if (idx >= 0 && idx < newVals.length) {
				expectedDemandInput.value = newVals[idx];
			}
		}
	},
	{ deep: true }
);

// 切换算法时，如果选的是算法1（日均单量），清除警告
watch(algoSelection, (newVal) => {
	if (newVal === 1) {
		algorithmWarning.value = null;
	}
});

// 完成日期选择后，自动弹出补货明细（回填数据时跳过）
watch(selectionEnd, (newVal) => {
	if (newVal && !isRestoringData.value) {
		// 延迟一帧确保数据计算完成
		nextTick(() => {
			replenishmentDetailVisible.value = true;
		});
	}
});

// 自动生成备注 (JSON格式，可视化与程序化增强版)
const generatedRemark = computed(() => {
	if (!selectionStart.value || !selectionEnd.value || !expectedDemandInput.value) return "";
	const days = dayjs(selectionEnd.value).diff(dayjs(selectionStart.value), "day") + 1;
	const systemQty = expectedDemandInput.value;
	const finalQty = Math.round(systemQty * manualCoefficient.value);
	const daily = (finalQty / days).toFixed(1);
	const algoName = algoNames[(algoSelection.value || 1) - 1] || "未知算法";

	// 生成分段明细
	const segments = currentReplenishmentResult.value.segments.map((seg) => ({
		...seg,
		segment_daily_sales: (baseDailyAvgSales.value * seg.coefficient).toFixed(2),
		algo_used_name: algoNames[seg.algoUsed - 1] || "日均"
	}));

	// 生成一行文本备注 (remark_text)
	// 格式: 2026-01-01至02-24(55天) | 基础日均2.0 | 1月(31天):搜索词,系数0.83,日均1.66,51件 | ... | 人工系数1.0 | 总计99件
	const startDateShort = selectionStart.value;
	const endDateShort = selectionEnd.value?.substring(5) || selectionEnd.value; // 月-日
	const timeRange = `${startDateShort}至${endDateShort}(${days}天)`;
	const baseDaily = `基础日均${baseDailyAvgSales.value.toFixed(1)}`;

	// 生成每个段落的描述
	const segmentTexts = segments.map((seg) => {
		const monthNum = dayjs(seg.startDate).format("M");
		const segDays = seg.days;
		const algoShort = seg.algo_used_name?.replace("单量", "") || "日均";
		const coeff = seg.coefficient?.toFixed(2) || "1.00";
		const segDaily = seg.segment_daily_sales || baseDailyAvgSales.value.toFixed(2);
		const subtotal = seg.subtotal || 0;
		return `${monthNum}月(${segDays}天):${algoShort},系数${coeff},日均${segDaily},${subtotal}件`;
	});

	const manualCoeffText = `人工系数${manualCoefficient.value.toFixed(1)}`;
	const totalText = `总计${finalQty}件`;

	// 组合成一行
	const remarkText = [timeRange, baseDaily, ...segmentTexts, manualCoeffText, totalText].join(
		" | "
	);

	const remarkData = {
		version: 5, // 升级版本号
		// 新增：一行文本备注（用于传给领星API）
		remark_text: remarkText,

		// 1. 人类直观描述
		summary: `采购 ${finalQty}个，销售时间 ${selectionStart.value} 至 ${selectionEnd.value}，计划日均 ${daily}单`,
		formula: `系统建议 (${systemQty}) × 人工系数 (${manualCoefficient.value.toFixed(1)}) = 最终补货 (${finalQty})`,

		// 2. 核心计算字段 (显式存储，方便后台提取)
		system_suggested_qty: systemQty, // 系统建议数
		artificial_coefficient: manualCoefficient.value, // 人工系数
		final_replenishment_qty: finalQty, // 最终补货单量

		// 3. 算法与基础数据
		base_daily_avg_sales: baseDailyAvgSales.value,
		user_selected_algo_id: algoSelection.value,
		user_selected_algo_name: algoName,

		// 4. 时间区间
		start_date: selectionStart.value,
		end_date: selectionEnd.value,
		total_days: days,

		// 5. 兼容性保留 (CamelCase)
		manualCoefficient: manualCoefficient.value,
		systemQty: systemQty,
		finalQty: finalQty,

		// 6. 分段明细 (记录每一段的计算因子)
		breakdown: segments,

		// 7. 5个月固定窗口计算
		window_calculation: windowCalculation.value
			? {
					base_month: windowCalculation.value.baseMonth,
					total_window_qty: Math.round(
						(windowCalculation.value.total || 0) * manualCoefficient.value
					),
					segments: windowCalculation.value.segments || []
				}
			: null
	};

	return JSON.stringify(remarkData);
});

// 解析后的系统备注 (用于UI展示)
const parsedSystemRemark = computed(() => {
	if (!generatedRemark.value) return null;
	try {
		return JSON.parse(generatedRemark.value);
	} catch {
		// 兼容旧版本纯文本格式
		return { summary: generatedRemark.value, breakdown: [] };
	}
});

// 暂存功能 (调用后端接口保存)
const stageOrder = async () => {
	if (!expectedDemandInput.value) {
		ElMessageBox.alert("请先输入预计销量", "提示", {
			confirmButtonText: "好的",
			type: "warning"
		});
		return;
	}
	if (!selectionStart.value || !selectionEnd.value) {
		ElMessageBox.alert("请先在日历上选择时间区间", "提示", {
			confirmButtonText: "好的",
			type: "warning"
		});
		return;
	}

	// 兜底：如果备注为空，提醒用户
	if (!manualRemark.value) {
		try {
			await ElMessageBox.confirm("是否需要添加备注？", "提示", {
				confirmButtonText: "填写备注",
				cancelButtonText: "跳过",
				type: "info"
			});
			remarkFromStageFlow.value = true; // 标记来自暂存流程
			remarkDialogVisible.value = true;
			return;
		} catch (e) {
			/* 用户选择跳过 */
		}
	}

	try {
		const remarkObj = JSON.parse(generatedRemark.value);
		const result = await service.app.bsr_analysis_record_lingxing.save({
			store_id: props.listing?.store_id,
			asin: props.listing?.asin,
			marketplace: props.listing?.marketplace,
			msku: props.listing?.msku,
			local_sku: props.listing?.local_sku,
			expected_sales: {
				...remarkObj, // 直接保存包含显式字段的对象
				totalQty: remarkObj.final_replenishment_qty,
				systemQty: remarkObj.system_suggested_qty,
				manualCoefficient: remarkObj.artificial_coefficient,
				finalQty: remarkObj.final_replenishment_qty,
				startDate: remarkObj.start_date,
				endDate: remarkObj.end_date,
				days: remarkObj.total_days,
				dailyAvg: Number(
					(remarkObj.final_replenishment_qty / remarkObj.total_days).toFixed(1)
				),
				userSelectedAlgo: remarkObj.user_selected_algo_id
			},
			remark: generatedRemark.value,
			manual_remark: manualRemark.value
		});
		currentRecordId.value = result; // 保存返回的记录ID
		ElMessage.success("已成功暂存补货需求");
		// 重置UI状态，让用户明确看到保存已完成
		selectionStart.value = null;
		selectionEnd.value = null;
		expectedDemandInput.value = null;
		manualRemark.value = "";
		manualCoefficient.value = 1.0;
	} catch (err) {
		console.error("暂存失败:", err);
		ElMessage.error("暂存失败，请稍后重试");
	}
};

// 备注弹窗确认处理（支持自动继续暂存或生成单据）
const handleRemarkConfirm = () => {
	remarkDialogVisible.value = false;
	// 如果是从暂存流程触发的，自动继续暂存
	if (remarkFromStageFlow.value) {
		remarkFromStageFlow.value = false; // 重置标记
		nextTick(() => {
			stageOrder();
		});
		return;
	}
	// 如果是从生成单据流程触发的，自动继续生成
	if (remarkFromGenerateFlow.value) {
		remarkFromGenerateFlow.value = false; // 重置标记
		// 使用 nextTick 确保弹窗关闭后再继续
		nextTick(() => {
			generateReplenishmentOrder();
		});
	}
};

// ========== 历史记录相关函数 ==========

// Tab切换事件处理
const onRemarkTabChange = (tab: string | number | boolean | undefined) => {
	if (tab === "history") {
		loadHistoryRecords();
	}
};

// 加载历史记录列表
const loadHistoryRecords = async () => {
	if (!props.listing?.asin || !props.listing?.marketplace) return;

	historyLoading.value = true;
	try {
		const result = await service.app.bsr_analysis_record_lingxing.getHistory({
			asin: props.listing.asin,
			marketplace: props.listing.marketplace,
			store_id: props.listing.store_id
		});
		historyRecords.value = result || [];
	} catch (err) {
		console.error("加载历史记录失败:", err);
		historyRecords.value = [];
	} finally {
		historyLoading.value = false;
	}
};

// 使用历史记录（复制数据到UI，清空currentRecordId）
const restoreHistoryRecord = (record: any) => {
	const salesData = record.expected_sales;
	if (!salesData) {
		ElMessage.warning("该记录数据不完整，无法恢复");
		return;
	}

	// 复制数据到UI状态
	selectionStart.value = salesData.startDate || null;
	selectionEnd.value = salesData.endDate || null;
	expectedDemandInput.value = salesData.totalQty || null;
	algoSelection.value = salesData.userSelectedAlgo || 1;
	manualCoefficient.value = salesData.manualCoefficient || 1.0;
	manualRemark.value = record.manual_remark || "";

	// 清空 currentRecordId（这样后续暂存/创建单据会创建新记录）
	currentRecordId.value = null;

	// 关闭弹窗，切回默认Tab
	replenishmentDetailVisible.value = false;
	remarkTabMode.value = "window";

	ElMessage.success("已恢复历史记录，您可以修改后暂存或创建单据");
};

// 查看历史记录明细（弹窗显示详细信息）
const viewHistoryDetail = (record: any) => {
	const salesData = record.expected_sales;
	let breakdownHtml = "";

	// 尝试解析 remark 获取 breakdown
	if (record.remark) {
		try {
			const remarkObj = JSON.parse(record.remark);
			const breakdown = remarkObj.breakdown || [];

			if (breakdown.length > 0) {
				breakdownHtml = breakdown
					.map((item: any) => {
						const monthNum = item.startDate
							? dayjs(item.startDate).format("M") + "月"
							: "-";
						const dailySales = item.segment_daily_sales || item.dailyNeed || "-";
						return `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #eee;">
						<span>${monthNum} <span style="color: #999;">${item.days || 0}天</span></span>
						<span><span style="color: #666;">日均${dailySales}×${item.coefficient?.toFixed(2) || "1.00"}</span> = <b style="color: #409eff;">${item.subtotal || 0}件</b></span>
					</div>`;
					})
					.join("");
			}
		} catch (e) {
			console.warn("解析 breakdown 失败:", e);
		}
	}

	const startDate = salesData?.startDate || salesData?.start_date || "N/A";
	const endDate = salesData?.endDate || salesData?.end_date || "N/A";
	const totalQty =
		salesData?.finalQty || salesData?.final_replenishment_qty || salesData?.totalQty || "N/A";
	const totalDays = salesData?.totalDays || salesData?.total_days || "-";
	const algo = salesData?.userSelectedAlgo || salesData?.user_selected_algo_id || 1;
	const algoName = algoNames[algo - 1] || "日均单量";
	const manualCoeff = salesData?.manualCoefficient || salesData?.artificial_coefficient || 1.0;
	const baseDailyAvg = salesData?.dailyAvg || salesData?.base_daily_avg_sales || "-";

	ElMessageBox.alert(
		`<div style="font-family: -apple-system, sans-serif; font-size: 13px; min-width: 320px;">
			<!-- 顶部汇总卡片 - 蓝色渐变 -->
			<div style="background: linear-gradient(135deg, #409eff 0%, #36cfc9 100%); color: white; padding: 16px; border-radius: 10px; margin-bottom: 16px;">
				<div style="font-size: 12px; opacity: 0.9;">补货数量</div>
				<div style="font-size: 28px; font-weight: 700; margin: 4px 0;">${totalQty} <span style="font-size: 14px; font-weight: 400;">件</span></div>
				<div style="font-size: 12px; opacity: 0.8;">${startDate} ~ ${endDate}（共${totalDays}天）</div>
			</div>
			
			<!-- 参数信息 - 三卡片 -->
			<div style="display: flex; gap: 12px; margin-bottom: 16px;">
				<div style="flex: 1; background: #f0f9ff; padding: 10px; border-radius: 8px; text-align: center;">
					<div style="color: #909399; font-size: 11px;">计算方式</div>
					<div style="color: #303133; font-weight: 500;">${algoName}</div>
				</div>
				<div style="flex: 1; background: #f0fdf4; padding: 10px; border-radius: 8px; text-align: center;">
					<div style="color: #909399; font-size: 11px;">平均日均</div>
					<div style="color: #303133; font-weight: 500;">${typeof baseDailyAvg === "number" ? baseDailyAvg.toFixed(1) : baseDailyAvg}</div>
				</div>
				<div style="flex: 1; background: #fef3c7; padding: 10px; border-radius: 8px; text-align: center;">
					<div style="color: #909399; font-size: 11px;">人工系数</div>
					<div style="color: #303133; font-weight: 500;">×${manualCoeff.toFixed(1)}</div>
				</div>
			</div>
			
			${record.manual_remark ? `<div style="background: #fafafa; padding: 10px; border-radius: 6px; margin-bottom: 12px; font-size: 12px; color: #606266;"><b>备注：</b>${record.manual_remark}</div>` : ""}
			
			${breakdownHtml ? `<div style="color: #909399; font-size: 12px; margin-bottom: 8px;">📅 分月明细</div>${breakdownHtml}` : ""}
		</div>`,
		"暂存详情",
		{
			confirmButtonText: "关闭",
			dangerouslyUseHTMLString: true,
			customClass: "history-detail-dialog"
		}
	);
};

// 格式化历史记录时间
const formatHistoryTime = (time: string) => {
	if (!time) return "N/A";
	return dayjs(time).format("YYYY-MM-DD HH:mm");
};

// 获取历史记录状态对应的Tag类型
const getHistoryStatusType = (status: number): string => {
	const typeMap: Record<number, string> = {
		0: "primary", // 暂存(最新)
		1: "success", // 已完结
		2: "info", // 历史覆盖
		3: "warning" // 已过期
	};
	return typeMap[status] || "info";
};

// 获取历史记录的日期范围
const getHistoryDateRange = (record: any): string => {
	const salesData = record.expected_sales;
	if (!salesData) return "N/A";
	const start = salesData.startDate?.substring(5) || "";
	const end = salesData.endDate?.substring(5) || "";
	return start && end ? `${start} ~ ${end}` : "N/A";
};

// 获取历史记录的补货数量
const getHistoryQty = (record: any): number => {
	const salesData = record.expected_sales;
	return salesData?.finalQty || salesData?.totalQty || 0;
};

// 获取历史记录的算法名称
const getHistoryAlgoName = (record: any): string => {
	const salesData = record.expected_sales;
	const algoId = salesData?.userSelectedAlgo || salesData?.user_selected_algo_id || 1;
	return algoNames[algoId - 1] || "日均单量";
};

// 获取历史记录的人工系数
const getHistoryCoeff = (record: any): string => {
	const salesData = record.expected_sales;
	const coeff = salesData?.manualCoefficient || salesData?.artificial_coefficient || 1.0;
	return coeff.toFixed(1);
};

const handleDayClickForSelection = (day: any) => {
	// 日均销量为空时，禁止选择日期范围（只能查看模式）
	if (baseDailyAvgSales.value === 0) {
		ElMessageBox.alert(
			"抱歉，由于暂无日均销量数据，系统暂时无法开启补货预测功能。您目前可以查看历史日历信息和未来到货计划。",
			"查阅模式说明",
			{
				confirmButtonText: "我知道了",
				type: "info"
			}
		);
		return;
	}
	if (!day.isCurrentMonth) return;

	const dateStr = day.dateStr;

	// 5个月窗口限制检查
	const selectedDate = dayjs(dateStr);
	const minDate = dayjs().subtract(1, "month").startOf("month"); // 上个月1号
	const maxDate = dayjs().add(3, "month").endOf("month"); // 后3月最后一天

	if (selectedDate.isBefore(minDate) || selectedDate.isAfter(maxDate)) {
		ElMessage.warning("只能选择上个月到后3个月范围内的日期");
		return;
	}

	if (!selectionStart.value || (selectionStart.value && selectionEnd.value)) {
		// 重新开始选择，同时重置之前的选择状态
		selectionStart.value = dateStr;
		selectionEnd.value = null;
		// 只重置销量输入，不重置算法选择（算法始终保持选中状态）
		expectedDemandInput.value = null;
	} else {
		// 选择终点
		const start = dayjs(selectionStart.value);
		const end = dayjs(dateStr);

		if (end.isBefore(start)) {
			// 如果选的反了，自动翻转
			selectionEnd.value = selectionStart.value;
			selectionStart.value = dateStr;
		} else {
			selectionEnd.value = dateStr;
		}
	}
};

const isInSelectionRange = (dateStr: string) => {
	if (!selectionStart.value) return false;
	if (!selectionEnd.value) return dateStr === selectionStart.value;

	const d = dayjs(dateStr);
	const s = dayjs(selectionStart.value);
	const e = dayjs(selectionEnd.value);
	return (d.isSame(s) || d.isAfter(s)) && (d.isSame(e) || d.isBefore(e));
};

const clearSelection = () => {
	selectionStart.value = null;
	selectionEnd.value = null;
	// 不重置算法选择，保持当前选中的算法不变
	// algoSelection 保持不动
	expectedDemandInput.value = null;
};

const generateReplenishmentOrder = async () => {
	// 防止重复点击
	if (isCreatingPurchasePlan.value) {
		ElMessage.warning("正在创建中，请勿重复点击");
		return;
	}

	// 先校验销量
	if (!expectedDemandInput.value) {
		ElMessageBox.alert("请先输入预计销量", "提示", {
			confirmButtonText: "好的",
			type: "warning"
		});
		return;
	}

	// 兜底：如果备注为空，提醒用户
	if (!manualRemark.value) {
		try {
			await ElMessageBox.confirm("是否需要填写备注？", "提示", {
				confirmButtonText: "填写备注",
				cancelButtonText: "跳过",
				type: "info"
			});
			remarkFromGenerateFlow.value = true; // 标记来自生成单据流程
			remarkDialogVisible.value = true;
			return;
		} catch (e) {
			/* 用户选择跳过，继续执行 */
		}
	}

	const currentQty = Math.round((expectedDemandInput.value || 0) * manualCoefficient.value);
	const localSku = props.listing?.local_sku;

	if (!localSku) {
		ElMessageBox.alert("缺少本地SKU (local_sku)，无法创建采购计划", "错误", {
			confirmButtonText: "好的",
			type: "error"
		});
		return;
	}

	try {
		// 1. 检查是否已有待采购计划
		const checkResult = await service.app.bsr_purchase_plan_lingxing.checkExisting({
			sku: localSku
		});

		if (checkResult?.hasExisting && checkResult.plans?.length > 0) {
			// 显示已有计划信息，让用户确认是否继续创建
			const existingPlan = checkResult.plans[0];
			const existingInfo = `
				<div style="font-family: Inter, sans-serif; text-align: left;">
					<p style="color: #f59e0b; font-weight: bold; margin-bottom: 12px;">⚠️ 该产品已有待采购计划：</p>
					<div style="background: #fef3c7; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
						<p><b>计划编号:</b> ${existingPlan.plan_sn || "N/A"}</p>
						<p><b>计划数量:</b> ${existingPlan.quantity_plan || 0} 件</p>
						<p><b>创建时间:</b> ${existingPlan.createTime || "N/A"}</p>
						<p><b>状态:</b> ${existingPlan.status_text || "待采购"}</p>
						<p><b>创建人:</b> ${existingPlan.creator_real_name || "N/A"}</p>
					</div>
					<p>是否仍要创建新的采购计划？</p>
				</div>
			`;

			try {
				await ElMessageBox.confirm(existingInfo, "提示", {
					confirmButtonText: "确定创建",
					cancelButtonText: "取消",
					dangerouslyUseHTMLString: true,
					type: "warning"
				});
			} catch (e) {
				// 用户取消
				console.log("用户取消重复创建");
				return;
			}
		}

		// 2. 显示确认弹窗
		await ElMessageBox.alert(
			`<div style="font-family: Inter, sans-serif;">
				<p><b>时间区间:</b> ${selectionStart.value} 至 ${selectionEnd.value}</p>
				<p><b>SKU:</b> ${localSku}</p>
				<p><b>MSKU:</b> ${props.listing?.msku || "N/A"}</p>
				<p><b>计划采购量:</b> <span style="color: #4f46e5; font-weight: bold; font-size: 1.25em;">${currentQty}</span> 件</p>
				<p style="font-size: 11px; color: #94a3b8;">(预计销量 ${expectedDemandInput.value} × 人工系数 ${manualCoefficient.value})</p>
				<hr style="border: none; border-top: 1px solid #f1f5f9; margin: 12px 0;"/>
				<p style="font-size: 11px; color: #94a3b8; line-height: 1.4;">* 点击确认后将调用领星API创建采购计划</p>
			</div>`,
			"生成采购计划",
			{
				confirmButtonText: "确认创建",
				dangerouslyUseHTMLString: true,
				customClass: "replenishment-confirm-modal"
			}
		);

		// 3. 设置创建中状态，防止重复点击
		isCreatingPurchasePlan.value = true;

		// 4. 调用创建采购计划接口（传递分析数据用于创建/更新分析记录）
		// 解析 generatedRemark 获取完整的分析数据（与暂存流程一致）
		let remarkObj: any = {};
		try {
			remarkObj = JSON.parse(generatedRemark.value);
		} catch (e) {
			console.warn("解析 generatedRemark 失败:", e);
		}

		const createResult = await service.app.bsr_purchase_plan_lingxing.createPurchasePlan({
			sku: localSku,
			quantity_plan: currentQty,
			manual_remark: manualRemark.value || undefined, // 人工备注传给领星API
			analysis_record_id: currentRecordId.value || undefined,
			// 始终传递 analysis_data（包含最新 remark），这样后端可以提取 remark_text 给领星
			analysis_data: {
				store_id: props.listing?.store_id,
				asin: props.listing?.asin,
				marketplace: props.listing?.marketplace,
				msku: props.listing?.msku,
				// 保存完整的分析数据（包含 breakdown 等）- 与暂存流程一致
				expected_sales: {
					...remarkObj, // 展开完整的备注对象
					totalQty: remarkObj.final_replenishment_qty || expectedDemandInput.value,
					systemQty: remarkObj.system_suggested_qty || expectedDemandInput.value,
					manualCoefficient: remarkObj.artificial_coefficient || manualCoefficient.value,
					finalQty: remarkObj.final_replenishment_qty || currentQty,
					startDate: remarkObj.start_date || selectionStart.value,
					endDate: remarkObj.end_date || selectionEnd.value,
					days:
						remarkObj.total_days ||
						dayjs(selectionEnd.value).diff(dayjs(selectionStart.value), "day") + 1,
					dailyAvg: remarkObj.base_daily_avg_sales || null,
					userSelectedAlgo: remarkObj.user_selected_algo_id || null
				},
				remark: generatedRemark.value, // 系统备注（包含 remark_text）
				manual_remark: manualRemark.value
			}
		});

		if (createResult?.plan_sn) {
			ElMessage.success(`采购计划创建成功！计划编号: ${createResult.plan_sn}`);
			// 清空当前记录ID
			currentRecordId.value = null;
			// 清空选择
			clearSelection();
			// 清空备注和重置系数
			manualRemark.value = "";
			manualCoefficient.value = 1.0;
		} else {
			ElMessage.error("创建采购计划失败，请稍后重试");
		}
	} catch (e: any) {
		if (e === "cancel" || e?.message?.includes("cancel")) {
			// 用户取消了弹窗
			console.log("用户取消了生成操作");
		} else {
			console.error("创建采购计划失败:", e);
			ElMessage.error(`创建采购计划失败: ${e?.message || "未知错误"}`);
		}
	} finally {
		// 重置创建中状态
		isCreatingPurchasePlan.value = false;
	}
};

// --- 核心时间窗口定义 (滚动 13 个月，包含起止月完整天数) ---
const chartStartBase = computed(() => dayjs().subtract(1, "year").startOf("month"));
const chartEndBase = computed(() => dayjs().endOf("month"));

// 核心数据 (通过 API 加载)
const monthlyRatio = ref<number[]>([]); // 库销比 (月)
const weeklyRatio = ref<number[]>([]); // 库销比 (周)
const monthlyInventory = ref<number[]>([]); // 月度库存
const weeklyInventory = ref<number[]>([]); // 周度库存

const monthlyForecast = ref<number[]>([]);
const weeklyForecast = ref<number[]>([]);
const forecastWrapperRef = ref<HTMLElement | null>(null);
const stockInfo = ref<any>(null);
const monthlySales = ref<number[]>([]);
const weeklySales = ref<number[]>([]);

// 我的销量 (来自领星 API)
const myMonthlySales = ref<number[]>([]);
const myWeeklySales = ref<number[]>([]);
const mySalesLastUpdated = ref<string | null>(null);
const mySalesLoading = ref(false);

// 接口原始数据保存（用于算法优化）
const apiSalesData = ref<any>(null);

// 备注弹窗Tab切换模式
const remarkTabMode = ref<"window" | "selection" | "history">("window");

// 5个月窗口计算结果
const windowCalculation = ref<any>(null);

// 历史记录相关
const historyRecords = ref<any[]>([]);
const historyLoading = ref(false);

const loading = ref(false);

// 加载真实数据
const refreshData = async () => {
	// 使用 product_code 来查询该产品编码下所有选品的竞品数据
	if (!props.listing?.product_code) {
		console.warn("缺少 product_code，无法加载数据");
		return;
	}
	loading.value = true;

	// ===== 调试：打印店铺信息 =====
	console.log("===== 选品信息 (listing) =====");
	console.log("Product Code:", props.listing.product_code);
	console.log("ASIN:", props.listing.asin);
	console.log("MSKU:", props.listing.msku);
	console.log("Store ID:", props.listing.store_id);
	console.log("Shop Name:", props.listing.shop);
	console.log("Marketplace:", props.listing.marketplace);
	console.log("Local SKU:", props.listing.local_sku);
	console.log("完整 listing 对象:", JSON.stringify(props.listing, null, 2));

	// ===== 生成 Apipost 测试用 JSON =====
	const today = dayjs();
	const startDate = today.subtract(12, "month").startOf("month").format("YYYY-MM-DD");
	const endDate = today.format("YYYY-MM-DD");
	const apipostJson = {
		start_date: startDate,
		end_date: endDate,
		data_type: "3", // 3=MSKU
		result_type: "1", // 1=销量
		date_unit: "2", // 2=月
		page: 1,
		length: 100,
		sids: props.listing.store_id ? [String(props.listing.store_id)] : []
	};
	console.log("===== Apipost 测试 JSON (月视图) =====");
	console.log(JSON.stringify(apipostJson, null, 2));

	// 周视图 JSON
	const weekJson = { ...apipostJson, date_unit: "3" };
	console.log("===== Apipost 测试 JSON (周视图) =====");
	console.log(JSON.stringify(weekJson, null, 2));
	// ===== 调试结束 =====

	try {
		// 使用 product_code + marketplace 获取汇总销量数据，asin + shop 用于库存和货件查询
		const res = await service.app.analysis.getData({
			product_code: props.listing.product_code,
			marketplace: props.listing.marketplace,
			asin: props.listing.asin, // 库存使用当前选品的 ASIN
			shop: props.listing.shop // 店铺名称，用于精确匹配 restocking 表
		});

		// 保存接口原始数据（用于算法优化）
		apiSalesData.value = res;

		// ===== 精确按时间轴月份映射数据（修复数据对齐问题） =====
		const lastYear = res.lastYear; // 2025
		const currentYear = res.currentYear; // 2026
		const lastYearSales = res.salesData.last.month; // [0, 12, 155, ...] 1-12月
		const currentYearSales = res.salesData.current.month; // [64, 138, ...] 1-12月

		// 生成13个月的时间轴 (去年同月到今年本月)
		const monthsTimeline: string[] = [];
		for (let i = 12; i >= 0; i--) {
			const d = dayjs().subtract(i, "month");
			monthsTimeline.push(d.format("YYYY-MM"));
		}

		// 按时间轴精确提取销量数据
		monthlySales.value = monthsTimeline.map((monthStr) => {
			const [year, month] = monthStr.split("-").map(Number);
			const monthIndex = month - 1; // 数组是0-indexed
			if (year === lastYear) {
				return lastYearSales[monthIndex] || 0;
			} else if (year === currentYear) {
				return currentYearSales[monthIndex] || 0;
			}
			return 0;
		});

		// 2. 周维度：动态计算总周数 (涵盖去年同月 1 日到今年当前月最后一日)
		const totalWeeks = chartEndBase.value.diff(chartStartBase.value, "week") + 1;
		const lastYearWeeks = res.salesData.last.week;
		const currentYearWeeks = res.salesData.current.week;
		const fullWeekly = lastYearWeeks.concat(currentYearWeeks);

		// 如果后端返回的周数不足 totalWeeks (例如当前只是 1月21日)，则补 0
		weeklySales.value = new Array(totalWeeks).fill(0).map((_, i) => fullWeekly[i] || 0);

		// --- 库存数据 (从 API 获取真实汇总数据) ---
		const ratio = res.inventoryRatio || 0;
		const realStock = (res.stockInfo?.localValid || 0) + (res.stockInfo?.inbound || 0);

		const monthLen = monthlySales.value.length;
		const weekLen = weeklySales.value.length;

		// 库存数据：使用精确按月份映射的方式
		if (res.inventoryData) {
			const lastYearInv = res.inventoryData.last?.month || [];
			const currentYearInv = res.inventoryData.current?.month || [];

			// 按时间轴精确提取库存数据
			monthlyInventory.value = monthsTimeline.map((monthStr) => {
				const [year, month] = monthStr.split("-").map(Number);
				const monthIndex = month - 1;
				if (year === lastYear) {
					return lastYearInv[monthIndex] || 0;
				} else if (year === currentYear) {
					return currentYearInv[monthIndex] || 0;
				}
				return 0;
			});

			// 周度库存：后端已使用平摊算法计算，直接使用
			const lastYearWeekInv = res.inventoryData.last?.week || [];
			const currentYearWeekInv = res.inventoryData.current?.week || [];
			const fullWeeklyInv = lastYearWeekInv.concat(currentYearWeekInv);
			weeklyInventory.value = new Array(weekLen).fill(0).map((_, i) => fullWeeklyInv[i] || 0);
		} else {
			// 如果后端没返回库存数据，使用0填充
			monthlyInventory.value = new Array(monthLen).fill(0);
			weeklyInventory.value = new Array(weekLen).fill(0);
		}

		// 库销比计算：平均库存 / 当月销量 （返回库存可售月数，如2.45表示可卖2.45个月）
		monthlyRatio.value = monthlyInventory.value.map((inv, i) => {
			const sales = monthlySales.value[i];
			// 销量为0时返回0，避免无穷大
			if (!sales || sales === 0) return 0;
			return Math.round((inv / sales) * 100) / 100; // 保留2位小数
		});

		weeklyRatio.value = weeklyInventory.value.map((inv, i) => {
			const sales = weeklySales.value[i];
			if (!sales || sales === 0) return 0;
			return Math.round((inv / sales) * 100) / 100;
		});

		// --- 确保预计销量数组长度匹配 ---
		if (monthlyForecast.value.length !== monthLen) {
			const old = [...monthlyForecast.value];
			monthlyForecast.value = new Array(monthLen).fill(0).map((_, i) => old[i] || 0);
		}
		if (weeklyForecast.value.length !== weekLen) {
			const old = [...weeklyForecast.value];
			weeklyForecast.value = new Array(weekLen).fill(0).map((_, i) => old[i] || 0);
		}

		stockInfo.value = res.stockInfo;
		// shipments.value = res.shipmentList || []; // 使用新的 shipmentByMonth

		// ========== 新增：使用后端返回的汇总数据 ==========
		// 本地可用库存总和（所有选品）
		totalLocalValidValue.value = res.totalLocalValid || 0;
		// FBA库存总和
		totalFbaStockValue.value = res.totalFbaStock || 0;

		// 按月份汇总的货件数据
		shipmentByMonth.value = res.shipmentByMonth || {};

		// 将所有货件展平到 shipments 数组（用于兼容原有逻辑）
		const allShipments: any[] = [];
		Object.values(res.shipmentByMonth || {}).forEach((monthData: any) => {
			if (monthData.details) {
				allShipments.push(...monthData.details);
			}
		});
		shipments.value = allShipments;

		// --- 并行加载我的销量和促销数据（不阻塞主页面）---
		await Promise.all([
			loadMySalesData(),
			loadPromotionsData(),
			loadKeywordTrendData(),
			loadCalendarData() // 新增：加载日历系数数据
		]);
	} catch (err) {
		console.error("加载数据失败", err);
	} finally {
		loading.value = false;
	}
};

/**
 * 加载我的销量数据 (来自领星 API)
 */
const loadMySalesData = async (forceRefresh: boolean = false) => {
	if (!props.listing?.product_code || !props.listing?.marketplace) return;

	mySalesLoading.value = true;
	try {
		// 直接使用 request 调用，绕过动态服务代理（新端点可能未被自动发现）
		const apiPath = forceRefresh
			? "/admin/app/analysis/refreshMySales"
			: "/admin/app/analysis/getMySales";
		const res = await service.request({
			url: apiPath,
			method: "POST",
			data: {
				product_code: props.listing.product_code,
				marketplace: props.listing.marketplace
			}
		});

		console.log("===== 我的销量原始返回 =====");
		console.log(JSON.stringify(res, null, 2));

		// 将 API 返回的 {period: value} 格式映射到数组
		const monthLen = monthlySales.value.length || 13;
		const weekLen = weeklySales.value.length || 52;

		// 月销量映射: "2025-11" -> 对应的数组索引
		myMonthlySales.value = new Array(monthLen).fill(0);
		if (res.monthly) {
			for (const [period, value] of Object.entries(res.monthly)) {
				const idx = getMonthIndex(period);
				if (idx >= 0 && idx < monthLen) {
					myMonthlySales.value[idx] = Number(value) || 0;
				}
			}
		}

		// 周销量映射: "2025-11-24~2025-11-30" -> 对应的数组索引
		myWeeklySales.value = new Array(weekLen).fill(0);
		if (res.weekly) {
			for (const [period, value] of Object.entries(res.weekly)) {
				const idx = getWeekIndex(period);
				if (idx >= 0 && idx < weekLen) {
					myWeeklySales.value[idx] = Number(value) || 0;
				}
			}
		}

		mySalesLastUpdated.value = res.lastUpdated || null;
		console.log(`[loadMySalesData] 更新完成, lastUpdated=${res.lastUpdated}`);
	} catch (err) {
		console.error("获取我的销量数据失败:", err);
	} finally {
		mySalesLoading.value = false;
	}
};

/**
 * 加载促销活动数据（独立接口，不阻塞主页面）
 */
const promotionsLoading = ref(false);
const loadPromotionsData = async (forceRefresh: boolean = false) => {
	if (!props.listing?.product_code || !props.listing?.marketplace) return;

	promotionsLoading.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/analysis/getPromotions",
			method: "POST",
			data: {
				product_code: props.listing.product_code,
				marketplace: props.listing.marketplace,
				asin: props.listing.asin, // 只查当前 ASIN 的促销
				forceRefresh
			}
		});

		if (res.promotions) {
			promotionsRaw.value = res.promotions;
			console.log("[促销] 加载了", Object.keys(res.promotions).length, "个秒杀活动");
			if (res.syncing) {
				console.log("[促销] 后台正在同步中...");
			}
		} else {
			promotionsRaw.value = {};
		}
	} catch (err) {
		console.error("[促销] 加载失败:", err);
	} finally {
		promotionsLoading.value = false;
	}
};

/**
 * 加载关键词搜索趋势 (新接口)
 */
const loadKeywordTrendData = async () => {
	if (!props.listing?.asin || !props.listing?.marketplace) return;

	try {
		const res = await service.request({
			url: "/admin/app/analysis/getKeywords",
			method: "POST",
			data: {
				asin: props.listing.asin,
				marketplace: props.listing.marketplace
			}
		});

		if (res) {
			// 1. 更新 X 轴 (后端已做对齐，理论上应该一致，但为了保险起见使用后端的)
			if (res.xAxis && Array.isArray(res.xAxis)) {
				last12Months.value = res.xAxis;
			}

			// 2. 更新关键词数据 (保留原有配色逻辑)
			// 预设高级配色池
			const colors = [
				"#312e81",
				"#4338ca",
				"#6366f1",
				"#818cf8",
				"#2dd4bf",
				"#14b8a6",
				"#0d9488",
				"#94a3b8",
				"#64748b",
				"#475569"
			];

			if (res.series && Array.isArray(res.series)) {
				allKeywords.value = res.series.map((item: any, index: number) => ({
					name: item.name,
					selected: true, // 默认选中
					color: colors[index % colors.length], // 循环配色
					data: item.data || [],
					total: item.total
				}));

				// 强制重绘图表，解决初始加载时坐标轴压缩或不显示的问题 (Fix UI Bug)
				nextTick(() => {
					keywordChartRef.value?.resize();
				});
			}
		}
	} catch (err) {
		console.error("加载关键词趋势失败:", err);
	}
};

/**
 * 加载日历模式系数数据 (新接口)
 * 调用后端 getCalendarData 接口，获取预计算的历史销量和搜索词系数
 */
const loadCalendarData = async () => {
	if (!props.listing?.product_code || !props.listing?.asin || !props.listing?.marketplace) {
		console.warn("[日历系数] 缺少必要参数，跳过加载");
		return;
	}

	calendarDataLoading.value = true;
	try {
		// 计算请求的月份范围：当前月前1个月 ~ 当前月后6个月
		const startMonth = dayjs().subtract(1, "month").format("YYYY-MM");
		const endMonth = dayjs().add(6, "month").format("YYYY-MM");

		console.log(`[日历系数] 请求范围: ${startMonth} ~ ${endMonth}`);

		const res = await service.request({
			url: "/admin/app/analysis/getCalendarData",
			method: "POST",
			data: {
				product_code: props.listing.product_code,
				asin: props.listing.asin,
				marketplace: props.listing.marketplace,
				startMonth,
				endMonth
			}
		});

		if (res) {
			console.log("[日历系数] API返回:", res);
			calendarBaseMonth.value = res.base_month || "";
			calendarBaseSalesValue.value = res.base_sales_value || 0;
			calendarBaseKeywordValue.value = res.base_keyword_value || 0;
			calendarCoefficients.value = res.calendar_data || {};
			console.log(
				`[日历系数] 已加载 ${Object.keys(calendarCoefficients.value).length} 个月份的系数`
			);
		}
	} catch (err) {
		console.error("[日历系数] 加载失败:", err);
	} finally {
		calendarDataLoading.value = false;
	}
};

/**
 * 将月份字符串 ("2025-11") 转换为图表数组索引
 */
const getMonthIndex = (period: string): number => {
	const targetDate = dayjs(period + "-01");
	const startDate = chartStartBase.value;
	return targetDate.diff(startDate, "month");
};

/**
 * 将周范围字符串 ("2025-11-24~2025-11-30") 转换为图表数组索引
 */
const getWeekIndex = (period: string): number => {
	const startDateStr = period.split("~")[0];
	const targetDate = dayjs(startDateStr);
	const startDate = chartStartBase.value;
	return Math.floor(targetDate.diff(startDate, "day") / 7);
};

/**
 * 强制刷新我的销量数据（带确认对话框）
 */
const forceRefreshMySales = async () => {
	try {
		await ElMessageBox.confirm(
			"确定要强制刷新销量数据吗？这将重新请求所有历史数据，可能需要等待较长时间。",
			"确认刷新",
			{
				confirmButtonText: "确定刷新",
				cancelButtonText: "取消",
				type: "warning"
			}
		);
		// 用户点击确定后执行刷新
		await loadMySalesData(true);
	} catch {
		// 用户取消
		console.log("用户取消刷新");
	}
};

/**
 * 自定义周索引算法 (与后端同步)：1月1日为第0周
 */
const getCustomWeekIndexForDate = (dateStr: string) => {
	const targetDate = dayjs(dateStr);
	const startOfChart = chartStartBase.value;
	const diffDays = targetDate.diff(startOfChart, "day");
	return Math.floor(diffDays / 7);
};

// 加载数据时触发
watch(() => props.listing?.product_code, refreshData);

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
	refreshData();
	resizeObserver = new ResizeObserver(updateItemWidths);
	if (weekGridRef.value) resizeObserver.observe(weekGridRef.value);
	updateItemWidths();
});

const isPastMonth = (index: number) => index < 12;
const isCurrentMonth = (index: number) => index === 12;
const isFutureMonth = (index: number) => index > 12;

const currentWeekIndex = computed(() => getCustomWeekIndexForDate(dayjs().format("YYYYMMDD")));
const isPastWeek = (index: number) => index < currentWeekIndex.value;
const isCurrentWeek = (index: number) => index === currentWeekIndex.value;
const isFutureWeek = (index: number) => index > currentWeekIndex.value;

/**
 * 自定义周起止日期算法：1月1日强制开始，每7天一周
 */
const getWeekDateRange = (index: number) => {
	const start = chartStartBase.value.add(index * 7, "day");
	const end = start.add(6, "day");
	return `${start.format("YY/MM-DD")}~${end.format("MM-DD")}`;
};

const chartTitle = computed(() => {
	const start = chartStartBase.value.format("YYYY年MM月");
	const end = chartEndBase.value.format("YYYY年MM月");
	return `销量汇总分析 (${start} ~ ${end})`;
});

const handleSalesChange = () => {
	// 目前仅支持前端响应，未来可在此处增加分配逻辑
};

const isSyncing = ref(false);
const salesStartIndex = ref(0);
const visibleWeeks = 12;

// --- 全局 X 轴数据计算 ---
const xAxisData = computed(() => {
	const isMonth = salesViewType.value === "month";
	const sData = isMonth ? monthlySales.value : weeklySales.value;
	const startOfChart = chartStartBase.value;

	return isMonth
		? sData.map((_, i) => startOfChart.add(i, "month").format("YYYY-MM"))
		: sData.map((_, i) => {
				const d = startOfChart.add(i * 7, "day");
				const year = d.year();
				const weekIdx = Math.floor(d.diff(dayjs(`${year}-01-01`), "day") / 7) + 1;
				return `W${weekIdx}\n${d.format("MM-DD")}`;
			});
});

// 存储精确的像素宽度，用于纠正 CSS calc 带来的累积误差
const salesItemWidth = ref(0);

// 初始化与观测容器宽度，确保 1-to-1 像素对齐
const updateItemWidths = () => {
	if (forecastWrapperRef.value) {
		salesItemWidth.value = forecastWrapperRef.value.clientWidth / visibleWeeks;
	}
};

// 移除冗余的观测逻辑，合并到统一的 onMounted 中
onUnmounted(() => resizeObserver?.disconnect());

const getGridInnerStyle = () => {
	if (salesViewType.value === "month") return { width: "100%", display: "flex" };
	const totalItems = weeklySales.value.length;
	return { width: `${salesItemWidth.value * totalItems}px`, display: "flex" };
};

const getEditItemStyle = () => {
	if (salesViewType.value === "month") {
		return { flex: 1, minWidth: 0 };
	}
	return { width: `${salesItemWidth.value}px`, flexShrink: 0 };
};

// 处理图表缩放/拖拽事件
const handleDataZoom = (event: any) => {
	if (salesViewType.value !== "week" || isSyncing.value) return;

	const zoom = event.batch ? event.batch[0] : event;
	let { startValue, start } = zoom;

	const totalItems = weeklySales.value.length;
	let newIndex = 0;
	if (startValue !== undefined) {
		newIndex = Math.round(startValue);
	} else if (start !== undefined) {
		newIndex = Math.round((start / 100) * (totalItems - 1));
	}

	if (newIndex !== salesStartIndex.value) {
		isSyncing.value = true;
		salesStartIndex.value = newIndex;

		const containers = document.querySelectorAll(".forecast-cells-container");
		containers.forEach((container) => {
			if (salesItemWidth.value > 0) {
				container.scrollTo({
					left: newIndex * salesItemWidth.value,
					behavior: "auto"
				});
			}
		});

		setTimeout(() => {
			isSyncing.value = false;
		}, 100);
	}
};

// 代理滚动事件，确保活动行与预测行同步
const handleGridScrollProxy = (e: any, type?: string) => {
	if (salesViewType.value === "month" || isSyncing.value) return;
	// 由于目前是通过 forecastWrapperRef 统一触发同步，我们只需要让其他行的滚动触发 handleGridScroll
	// 实际上，如果我们将两个容器放入 handleGridScroll 的监听逻辑中会更好
	handleGridScroll(e);
};

// 处理底端网格滚动事件
const handleGridScroll = (e: any) => {
	if (salesViewType.value === "month" || isSyncing.value) return;

	if (salesItemWidth.value <= 0) return;

	const { scrollLeft } = e.target;

	// 同步所有相关的滚动容器
	const containers = document.querySelectorAll(".forecast-cells-container");
	containers.forEach((container) => {
		if (container !== e.target) {
			container.scrollLeft = scrollLeft;
		}
	});

	let newIndex = Math.round(scrollLeft / salesItemWidth.value);

	if (newIndex !== salesStartIndex.value) {
		isSyncing.value = true;
		salesStartIndex.value = newIndex;

		salesChartRef.value?.setOption({
			dataZoom: [{ id: "insideZoom", startValue: newIndex, endValue: newIndex + 11 }]
		});

		setTimeout(() => {
			isSyncing.value = false;
		}, 100);
	}
};

// 监听视图切换，重置所有滚动位置
watch(salesViewType, () => {
	isSyncing.value = true;
	salesStartIndex.value = 0;

	const resetOption = { dataZoom: [{ id: "insideZoom", startValue: 0, endValue: 11 }] };
	salesChartRef.value?.setOption(resetOption);

	nextTick(() => {
		updateItemWidths();
		forecastWrapperRef.value?.scrollTo({ left: 0 });
		setTimeout(() => {
			isSyncing.value = false;
		}, 300);
	});
});

// --- 活动/促销数据 (从后端API获取) ---
// 数据格式: { promotion_id: { type, start, end, status, discount_price, discount_rate, name, asin, store_id, marketplace } }
const promotionsRaw = ref<Record<string, any>>({});

// 状态映射
const getStatusText = (status: number): string => {
	const map: Record<number, string> = { 0: "其他", 1: "进行中", 2: "已过期", 3: "未开始" };
	return map[status] || "未知";
};

// 转换为数组格式供模板使用
const promotions = computed(() => {
	return Object.entries(promotionsRaw.value).map(([id, promo]) => ({
		id,
		name: promo.type || "BD", // 显示 BD, LD 等类型缩写
		start: promo.start,
		end: promo.end,
		status: promo.status,
		statusText: getStatusText(promo.status),
		discount_price: promo.discount_price,
		discount_rate: promo.discount_rate,
		fullName: promo.name, // 完整活动名称
		desc: promo.desc || promo.name, // 备注/描述
		// 父级信息
		asin: promo.asin,
		store_id: promo.store_id,
		marketplace: promo.marketplace,
		shop_name: promo.shop_name || `店铺${promo.store_id}`,
		color: "#4f46e5"
	}));
});

// --- 货件数据 (从后端API获取) ---
const shipments = ref<any[]>([]);
// 按月份汇总的货件数据 (从后端返回)
const shipmentByMonth = ref<Record<string, { total: number; details: any[] }>>({});
// 所有选品的本地可用库存总和
const totalLocalValidValue = ref<number>(0);
// FBA库存总和
const totalFbaStockValue = ref<number>(0);

// ================== 日历模式系数数据 (新接口) ==================
// 存储后端预计算的系数数据，格式: { '2025-12': { sales: {...}, keywords: {...} }, ... }
const calendarCoefficients = ref<
	Record<
		string,
		{
			sales: { ref_month: string; ref_value: number; coefficient: number; status: string };
			keywords: { ref_month: string; ref_value: number; coefficient: number; status: string };
		}
	>
>({});
// 基准月信息
const calendarBaseMonth = ref<string>("");
const calendarBaseSalesValue = ref<number>(0);
const calendarBaseKeywordValue = ref<number>(0);
const calendarDataLoading = ref(false);

// ================== 库存日历视图相关 ==================

// 日历显示的起始月份偏移量（0=当前月开始）
// 初始值 = 0，显示当前月+下个月（2月-3月）
const calendarMonthOffset = ref(0);

// 计算当前显示的2个月份
const calendarMonths = computed(() => {
	const baseMonth = dayjs().startOf("month").add(calendarMonthOffset.value, "month");
	return [baseMonth, baseMonth.add(1, "month")];
});

// 日历导航限制：-1 到 2
// -1: 显示1月-2月（向前翻1次）
//  0: 显示2月-3月（初始状态）
//  1: 显示3月-4月（向后翻1次）
//  2: 显示4月-5月（向后翻2次）
const minMonthOffset = -1;
const maxMonthOffset = 2;

// 月份导航
const navigateMonths = (delta: number) => {
	const newOffset = calendarMonthOffset.value + delta;

	// 检查是否超出范围
	if (newOffset < minMonthOffset || newOffset > maxMonthOffset) {
		ElMessage.warning("只能选择上个月到后3个月范围内的日期");
		return;
	}

	calendarMonthOffset.value = newOffset;
};

// 日历货件数据（直接使用所有货件数据，包括过去已到货的）
// 注意：shipments 中的货件已包含 shipmentTime 字段
const calendarShipments = computed(() => shipments.value);

// 日历促销数据（直接使用所有促销数据，不过滤已过期的）
// 后端已做过期清理（删除结束超过15个月的活动），这里无需再筛选
const calendarPromotions = computed(() => promotions.value);

// ==================== 库存预测算法核心 ====================

// 基础日均销量（从 props.listing 获取）
const baseDailyAvgSales = computed(() => {
	const val = props.listing?.dailyAvgSales;
	return typeof val === "number" && val > 0 ? val : 0;
});

// 当前FBA库存（从 props.listing.restocking.fbaValidList 计算）
// 与UI显示的 FBA:XX 值保持一致，取 quantity（总库存）总和
const currentFbaStock = computed(() => {
	const fbaList = props.listing?.restocking?.fbaValidList;
	if (!fbaList || !Array.isArray(fbaList)) return 0;
	return fbaList.reduce((sum: number, item: any) => {
		return sum + (item.quantity || 0);
	}, 0);
});

// 历史销量数据 (去年同月的月销量，用于计算系数)
// monthlySales.value 包含 13 个月数据：[去年1月, 去年2月, ..., 去年12月, 今年当月]
// 索引 0 = 去年1月, 索引 11 = 去年12月
// 数据来源：竞品销量数据 (sales_volume_data)
// 降级逻辑：如果某月数据为0或不存在，算法会自动降级到算法1（日均单量）
// 并在备注中记录 fallback_reason（降级原因）
const lastYearMonthlySales = computed(() => {
	// 返回完整数据，不再截断，确保能取到第13个月的数据 (2025-01 ~ 2026-01)
	// 这样 Algorithm 2 也能像 Algorithm 3 一样访问所有历史月份
	return monthlySales.value;
});

// 搜索词月度总量（所有关键词的月搜索量加总）
// allKeywords.value 结构: [{ name, data: [month1, month2, ...], total }, ...]
const keywordMonthlyTotals = computed(() => {
	if (!allKeywords.value || allKeywords.value.length === 0) return [];
	// 获取第一个关键词的数据长度作为月份数量
	const monthCount = allKeywords.value[0]?.data?.length || 12;
	// 对每个月份，加总所有关键词的搜索量
	const totals: number[] = [];
	for (let i = 0; i < monthCount; i++) {
		let monthSum = 0;
		for (const kw of allKeywords.value) {
			monthSum += kw.data?.[i] || 0;
		}
		totals.push(monthSum);
	}
	return totals;
});

// 算法缺失数据警告
const algorithmWarning = ref<string | null>(null);

/**
 * 获取月份在 last12Months 数组中的实际索引
 * @param monthStr - 月份字符串（如 "2026-02"）
 * @returns 索引值，找不到返回 -1
 */
const getMonthDataIndex = (monthStr: string): number => {
	if (!last12Months.value || last12Months.value.length === 0) return -1;
	return last12Months.value.findIndex((m) => m === monthStr);
};

// ================== 核心算法复用逻辑 (私有) ==================
/**
 * 获取指定算法在指定日期的【基准值】和【目标值】
 * 优先使用 calendarCoefficients（新接口预计算数据），回退到原有逻辑
 */
const _getAlgorithmData = (targetDate: dayjs.Dayjs, algorithm: number) => {
	const targetMonthStr = targetDate.format("YYYY-MM");

	// ========== 优先使用新接口的预计算系数 ==========
	const calendarData = calendarCoefficients.value[targetMonthStr];
	if (calendarData) {
		if (algorithm === 2) {
			// 历史销量
			const salesData = calendarData.sales;
			if (salesData.status === "ok" && salesData.ref_value > 0) {
				return {
					valid: true,
					reason: null,
					base: calendarBaseSalesValue.value,
					target: salesData.ref_value,
					coefficient: salesData.coefficient // 直接返回预计算的系数
				};
			} else {
				return {
					valid: false,
					reason: `${salesData.ref_month}历史销量数据缺失`,
					base: calendarBaseSalesValue.value,
					target: 0
				};
			}
		} else if (algorithm === 3) {
			// 搜索词趋势
			const keywordData = calendarData.keywords;
			if (keywordData.status === "ok" && keywordData.ref_value > 0) {
				return {
					valid: true,
					reason: null,
					base: calendarBaseKeywordValue.value,
					target: keywordData.ref_value,
					coefficient: keywordData.coefficient // 直接返回预计算的系数
				};
			} else {
				return {
					valid: false,
					reason: `${keywordData.ref_month}搜索词数据缺失`,
					base: calendarBaseKeywordValue.value,
					target: 0
				};
			}
		}
	}

	// ========== 回退到原有逻辑（兼容旧数据源）==========
	// 1. 确定基准月（分母）：当前真实时间的去年同月
	const currentBaseMonthStr = dayjs().subtract(1, "year").format("YYYY-MM");

	// 2. 确定目标月（分子）：目标时间的去年同月
	const targetMonthLastYearStr = targetDate.subtract(1, "year").format("YYYY-MM");

	let data: number[] = [];
	let algoName = "";

	if (algorithm === 2) {
		data = lastYearMonthlySales.value;
		algoName = "历史销量";
	} else if (algorithm === 3) {
		data = keywordMonthlyTotals.value;
		algoName = "搜索词";
	} else {
		return { valid: false, reason: "未知算法", base: 0, target: 0 };
	}

	if (!data || data.length === 0) {
		return { valid: false, reason: `${algoName}数据不足`, base: 0, target: 0 };
	}

	// 使用 unified index 查找
	const baseIndex = getMonthDataIndex(currentBaseMonthStr);
	const targetIndex = getMonthDataIndex(targetMonthLastYearStr);

	if (baseIndex < 0) {
		return {
			valid: false,
			reason: `${algoName}数据缺少基准月(${currentBaseMonthStr})`,
			base: 0,
			target: 0
		};
	}
	if (targetIndex < 0) {
		return {
			valid: false,
			reason: `${algoName}数据缺少目标月(${targetMonthLastYearStr})`,
			base: 0,
			target: 0
		};
	}

	const baseValue = data[baseIndex];
	const targetValue = data[targetIndex];

	if (!baseValue || baseValue === 0) {
		const baseMonthName = dayjs(currentBaseMonthStr).format("M月");
		return {
			valid: false,
			reason: `基准月(${baseMonthName})${algoName}数据为0`,
			base: 0,
			target: 0
		};
	}
	if (targetValue === undefined || targetValue === null || targetValue === 0) {
		const targetMonthName = dayjs(targetMonthLastYearStr).format("M月");
		return {
			valid: false,
			reason: `${targetMonthName}${algoName}数据为0`,
			base: baseValue,
			target: 0
		};
	}

	return { valid: true, reason: null, base: baseValue, target: targetValue };
};

/**
 * 获取某个月份的系数
 * @param targetMonth - 目标日期
 * @param algorithm - 算法类型 (1=日均单量, 2=历史销量, 3=搜索词趋势)
 * @returns 系数值，默认为1
 */
const getMonthCoefficient = (targetMonth: dayjs.Dayjs, algorithm: number): number => {
	if (algorithm === 1) return 1;

	// 使用统一逻辑提取数据
	const result = _getAlgorithmData(targetMonth, algorithm);

	if (result.valid) {
		// 优先使用后端预算的系数（与 Mini / VisualDatePicker 保持一致，消除浮点重算误差）
		if (result.coefficient !== undefined) {
			return result.coefficient;
		}
		// 回退：后端未返回 coefficient 时，用 base/target 重新计算
		if (result.base > 0) {
			return result.target / result.base;
		}
	}

	// 如果数据无效（降级），默认返回 1
	return 1;
};

// 带降级信息的系数返回接口
interface CoefficientWithFallback {
	coefficient: number;
	algoUsed: number; // 实际使用的算法 (1=日均, 2=历史, 3=搜索词)
	fallbackReason: string | null; // 降级原因，null表示正常
}

/**
 * 获取某个月份的系数（带降级追踪）
 * @param targetMonth - 目标日期
 * @param algorithm - 用户选择的算法类型 (1=日均单量, 2=历史销量, 3=搜索词趋势)
 * @returns 系数、实际使用的算法、降级原因
 */
const getMonthCoefficientWithFallback = (
	targetMonth: dayjs.Dayjs,
	algorithm: number
): CoefficientWithFallback => {
	// 算法1：日均单量，系数恒为1，无降级
	if (algorithm === 1) {
		return { coefficient: 1, algoUsed: 1, fallbackReason: null };
	}

	// 使用统一逻辑提取数据
	const result = _getAlgorithmData(targetMonth, algorithm);

	if (result.valid) {
		// 优先使用后端预算的系数（与 Mini / VisualDatePicker 保持一致）
		const coeff =
			result.coefficient !== undefined
				? result.coefficient
				: result.base > 0
					? result.target / result.base
					: 1;
		return { coefficient: coeff, algoUsed: algorithm, fallbackReason: null };
	}

	// 发生降级
	return { coefficient: 1, algoUsed: 1, fallbackReason: result.reason };
};

// 库存计算数据（基于真实数据）
const stockCalculation = computed(() => {
	const algorithm = algoSelection.value || 1;
	algorithmWarning.value = null; // 重置警告

	// 日均销量为0时，无法计算
	if (baseDailyAvgSales.value === 0) {
		algorithmWarning.value = "暂无日均销量数据，无法生成库存预测";
		return {
			currentStock: currentFbaStock.value,
			baseDailySales: 0,
			algorithm,
			isValid: false
		};
	}

	return {
		currentStock: currentFbaStock.value,
		baseDailySales: baseDailyAvgSales.value,
		algorithm,
		isValid: true
	};
});

// 保留 mockStock 的兼容接口（旧代码可能引用）
const mockStock = computed(() => {
	return {
		currentStock: stockCalculation.value.currentStock,
		dailySales: stockCalculation.value.baseDailySales
	};
});

// ==================== 补货需求计算（真实实现） ====================

/**
 * 计算某段日期范围内的补货需求（按月份分段，应用不同系数）
 */
const calculateReplenishment = (
	startDateStr: string,
	endDateStr: string,
	algorithm: number
): ReplenishmentResult => {
	const baseDailySales = baseDailyAvgSales.value;
	if (baseDailySales === 0) {
		return {
			total: 0,
			segments: [],
			isValid: false,
			warning: "暂无日均销量数据，无法计算补货需求"
		};
	}

	const startDate = dayjs(startDateStr);
	const endDate = dayjs(endDateStr);
	const segments: ReplenishmentSegment[] = [];

	let currentSegmentStart = startDate;
	let currentMonth = startDate.month();
	let total = 0;

	// 逐日遍历，按月份分组
	for (let d = startDate; d.isSameOrBefore(endDate, "day"); d = d.add(1, "day")) {
		const dayMonth = d.month();

		// 如果进入新月份，结算上一段
		if (dayMonth !== currentMonth && currentSegmentStart.isBefore(d)) {
			const segmentEnd = d.subtract(1, "day");
			const segmentDays = segmentEnd.diff(currentSegmentStart, "day") + 1;
			const coeffInfo = getMonthCoefficientWithFallback(currentSegmentStart, algorithm);
			const roundedCoeff = Math.round(coeffInfo.coefficient * 100) / 100;
			const dailyNeed = Math.round(baseDailySales * roundedCoeff * 100) / 100;
			const subtotal = Math.round(segmentDays * dailyNeed);

			segments.push({
				startDate: currentSegmentStart.format("YYYY-MM-DD"),
				endDate: segmentEnd.format("YYYY-MM-DD"),
				days: segmentDays,
				algorithm: algoNames[algorithm - 1] || "日均单量",
				coefficient: roundedCoeff,
				dailyNeed,
				subtotal,
				algoUsed: coeffInfo.algoUsed,
				fallbackReason: coeffInfo.fallbackReason
			});
			total += subtotal;

			currentSegmentStart = d;
			currentMonth = dayMonth;
		}
	}

	// 处理最后一段
	const lastSegmentDays = endDate.diff(currentSegmentStart, "day") + 1;
	if (lastSegmentDays > 0) {
		const coeffInfo = getMonthCoefficientWithFallback(currentSegmentStart, algorithm);
		const roundedCoeff = Math.round(coeffInfo.coefficient * 100) / 100;
		const dailyNeed = Math.round(baseDailySales * roundedCoeff * 100) / 100;
		const subtotal = Math.round(lastSegmentDays * dailyNeed);

		segments.push({
			startDate: currentSegmentStart.format("YYYY-MM-DD"),
			endDate: endDate.format("YYYY-MM-DD"),
			days: lastSegmentDays,
			algorithm: algoNames[algorithm - 1] || "日均单量",
			coefficient: roundedCoeff,
			dailyNeed,
			subtotal,
			algoUsed: coeffInfo.algoUsed,
			fallbackReason: coeffInfo.fallbackReason
		});
		total += subtotal;
	}

	return { total, segments, isValid: true, warning: algorithmWarning.value };
};

/**
 * 计算5个月固定窗口的补货需求
 * 窗口范围：上个月(-1) 到 后3个月(+3)
 * @param algorithm - 算法类型 (1=日均单量, 2=历史销量, 3=搜索词趋势)
 * @returns { total: number, segments: [...], baseMonth: string }
 */
const calculate5MonthWindow = (algorithm: number) => {
	const baseDailySales = baseDailyAvgSales.value;
	if (baseDailySales === 0) {
		return {
			total: 0,
			segments: [],
			baseMonth: dayjs().format("YYYY-MM"),
			isValid: false,
			warning: "暂无日均销量数据，无法计算补货需求"
		};
	}

	const today = dayjs();
	const startMonth = today.subtract(1, "month").startOf("month"); // 上个月1号
	const endMonth = today.add(3, "month").endOf("month"); // 后3月最后一天

	const segments: any[] = [];
	let total = 0;

	// 逐月计算
	for (let m = startMonth; m.isSameOrBefore(endMonth, "month"); m = m.add(1, "month")) {
		const daysInMonth = m.daysInMonth();
		const coeffInfo = getMonthCoefficientWithFallback(m, algorithm);
		const dailyNeed = Math.round(baseDailySales * coeffInfo.coefficient * 100) / 100;
		const subtotal = Math.round(daysInMonth * dailyNeed);

		segments.push({
			month: m.format("YYYY-MM"),
			monthName: m.format("YYYY年M月"),
			days: daysInMonth,
			coefficient: Math.round(coeffInfo.coefficient * 100) / 100,
			algoUsed: coeffInfo.algoUsed,
			algo_used_name: algoNames[coeffInfo.algoUsed - 1] || "日均单量",
			fallback_reason: coeffInfo.fallbackReason,
			daily_sales: dailyNeed,
			subtotal
		});
		total += subtotal;
	}

	return {
		total,
		segments,
		baseMonth: today.format("YYYY-MM"),
		isValid: true,
		warning: null
	};
};

// 监听选择变化，更新补货计算结果
watch(
	[selectionStart, selectionEnd, algoSelection],
	() => {
		// 更新当前选中算法的结果
		if (selectionStart.value && selectionEnd.value) {
			_lazyReplenishmentResult.value = calculateReplenishment(
				selectionStart.value,
				selectionEnd.value,
				algoSelection.value || 1
			);
			// 更新三种算法的预测值
			_lazyAlgoForecasts.value = [1, 2, 3].map((algo) => {
				return calculateReplenishment(selectionStart.value!, selectionEnd.value!, algo)
					.total;
			});
		} else {
			_lazyReplenishmentResult.value = {
				total: 0,
				segments: [],
				isValid: false,
				warning: null
			};
			_lazyAlgoForecasts.value = [0, 0, 0];
		}
	},
	{ immediate: true }
);

// 监听算法选择变化，更新5个月窗口计算结果
watch(
	algoSelection,
	() => {
		const algo = algoSelection.value || 1;
		windowCalculation.value = calculate5MonthWindow(algo);
	},
	{ immediate: true }
);

// 监听日历系数数据加载完成，重新计算（修复时序问题）
// 因为 algoSelection 的 watch 可能在 calendarCoefficients 加载前就执行了
watch(
	calendarCoefficients,
	(newVal) => {
		if (newVal && Object.keys(newVal).length > 0) {
			console.log("[日历系数] 数据已加载，重新计算窗口");
			const algo = algoSelection.value || 1;
			windowCalculation.value = calculate5MonthWindow(algo);
			// 同时更新用户选择范围的计算结果
			if (selectionStart.value && selectionEnd.value) {
				_lazyReplenishmentResult.value = calculateReplenishment(
					selectionStart.value,
					selectionEnd.value,
					algo
				);
				_lazyAlgoForecasts.value = [1, 2, 3].map((a) => {
					return calculateReplenishment(selectionStart.value!, selectionEnd.value!, a)
						.total;
				});
			}
		}
	},
	{ deep: true }
);

// 生成某月的日期网格数据
interface DayData {
	dateStr: string;
	day: number;
	isCurrentMonth: boolean;
	isPast: boolean;
	isToday: boolean;
	stockStatus: "safe" | "warning" | "danger" | "none";
	shipments: any[];
	promotions: any[];
}

const getMonthDays = (month: dayjs.Dayjs): DayData[] => {
	const days: DayData[] = [];
	const startOfMonth = month.startOf("month");
	const endOfMonth = month.endOf("month");
	const today = dayjs().startOf("day");

	// 计算第一天是周几（周一=0，周日=6）
	let firstDayOfWeek = startOfMonth.day() - 1;
	if (firstDayOfWeek < 0) firstDayOfWeek = 6;

	// 填充上个月的空白
	for (let i = 0; i < firstDayOfWeek; i++) {
		days.push({
			dateStr: `empty-${i}`,
			day: 0,
			isCurrentMonth: false,
			isPast: true,
			isToday: false,
			stockStatus: "none",
			shipments: [],
			promotions: []
		});
	}

	// 填充当月的日期
	for (let d = 1; d <= endOfMonth.date(); d++) {
		const currentDate = month.date(d);
		const dateStr = currentDate.format("YYYY-MM-DD");
		const isPast = currentDate.isBefore(today, "day");
		const isToday = currentDate.isSame(today, "day");

		// 查找当天的货件
		const dayShipments = calendarShipments.value.filter((s) => s.amazonSaleDate === dateStr);

		// 查找当天的促销活动（整个活动期间的每一天都显示）
		// 注意：API 返回的日期格式可能是 "2026-01-05 00:00:00"，需要只取日期部分比较
		const dayPromos = calendarPromotions.value.filter((p) => {
			// 取日期部分（去掉时间）
			const startStr = p.start ? p.start.split(" ")[0] : null;
			const endStr = p.end ? p.end.split(" ")[0] : null;
			if (!startStr || !endStr) return false;

			const start = dayjs(startStr);
			const end = dayjs(endStr);
			// 整个活动期间（含开始日和结束日）都匹配
			return (
				(currentDate.isSame(start, "day") || currentDate.isAfter(start, "day")) &&
				(currentDate.isSame(end, "day") || currentDate.isBefore(end, "day"))
			);
		});

		// 计算库存状态（仅对未来日期有效）
		let stockStatus: "safe" | "warning" | "danger" | "none" = "none";
		if (!isPast) {
			const daysFromToday = currentDate.diff(today, "day");
			stockStatus = calculateStockStatus(daysFromToday, dateStr);
		}

		days.push({
			dateStr,
			day: d,
			isCurrentMonth: true,
			isPast,
			isToday,
			stockStatus,
			shipments: dayShipments,
			promotions: dayPromos
		});
	}

	return days;
};

// 计算某一天的库存状态
// 绿色 = 安全（≥5天），黄色 = 预警（<5天），红色 = 断货（≤0）
const calculateStockStatus = (
	daysFromToday: number,
	dateStr: string
): "safe" | "warning" | "danger" | "none" => {
	// 日均销量为0时，无法计算
	if (!stockCalculation.value.isValid || stockCalculation.value.baseDailySales === 0) {
		return "none";
	}

	let stock = stockCalculation.value.currentStock;
	const baseDailySales = stockCalculation.value.baseDailySales;
	const algorithm = stockCalculation.value.algorithm;
	const today = dayjs().startOf("day");

	// 模拟从今天到目标日期之前的库存消耗（目标日期开始时的库存）
	for (let i = 0; i < daysFromToday; i++) {
		const checkDate = today.add(i, "day");
		const checkDateStr = checkDate.format("YYYY-MM-DD");

		// 检查是否有货件到货（先加库存再消耗）
		const arrivals = calendarShipments.value.filter((s) => s.amazonSaleDate === checkDateStr);
		arrivals.forEach((a) => (stock += a.quantity || 0));

		// 获取当天所在月份的系数
		const coefficient = getMonthCoefficient(checkDate, algorithm);
		// 当日消耗 = 基础日均销量 × 系数
		const dailyConsumption = baseDailySales * coefficient;
		stock -= dailyConsumption;

		// 库存不能为负（断货后不累积欠债，到货后从新库存开始算）
		if (stock < 0) stock = 0;
	}

	// 检查目标日期当天是否有货件到货
	const targetDateStr = dateStr;
	const arrivals = calendarShipments.value.filter((s) => s.amazonSaleDate === targetDateStr);
	arrivals.forEach((a) => (stock += a.quantity || 0));

	// 断货判断：库存≤0
	if (stock <= 0) return "danger";

	// 获取目标日期的系数用于计算剩余天数
	const targetDate = today.add(daysFromToday, "day");
	const targetCoefficient = getMonthCoefficient(targetDate, algorithm);
	const effectiveDailySales = baseDailySales * targetCoefficient;

	// 计算剩余可售天数（防止除以0）
	if (effectiveDailySales <= 0) return "safe";
	const daysLeft = stock / effectiveDailySales;

	// 安全：≥5天（与图例一致）
	if (daysLeft >= 5) return "safe";
	// 预警：<5天
	return "warning";
};

// 获取日期格子的CSS类
const getDayCellClass = (day: DayData) => {
	const classes: string[] = [];
	if (!day.isCurrentMonth) classes.push("empty-day");
	if (day.isPast) classes.push("past-day");
	if (day.isToday) classes.push("today");
	if (day.stockStatus) classes.push(`stock-${day.stockStatus}`);
	if (day.shipments.length > 0) classes.push("has-shipment");
	if (day.promotions.length > 0) classes.push("has-promo");
	return classes;
};

// 日期点击处理（预留：用于日期选择和补货单）
const handleDayClick = (day: DayData) => {
	if (!day.isCurrentMonth || day.isPast) return;
	console.log("点击日期:", day.dateStr);
	// TODO: 实现日期范围选择和补货单生成
};

// 获取特定索引下的货件汇总
// 核心逻辑：货件的 amazonSaleDate 需要"向前推一年"来对齐柱状图
const getShipmentsForIndex = (index: number) => {
	const isMonth = salesViewType.value === "month";
	const chartStart = chartStartBase.value;

	// 该格子的精确时间范围
	const cellStart = chartStart.add(index, isMonth ? "month" : "week");
	const cellEnd = isMonth ? cellStart.endOf("month") : cellStart.add(6, "day");

	return shipments.value.filter((ship) => {
		const shipDate = dayjs(ship.amazonSaleDate);
		if (!shipDate.isValid()) return false;

		// ★ 核心：货件日期向前推一年，对齐到柱状图的"去年同期"
		const shipDateShifted = shipDate.subtract(1, "year");

		if (isMonth) {
			// 月视图：比较年份和月份
			return (
				shipDateShifted.year() === cellStart.year() &&
				shipDateShifted.month() === cellStart.month()
			);
		} else {
			// 周视图：判断推前一年后的日期是否在该周范围内
			return (
				(shipDateShifted.isAfter(cellStart) || shipDateShifted.isSame(cellStart, "day")) &&
				(shipDateShifted.isBefore(cellEnd) || shipDateShifted.isSame(cellEnd, "day"))
			);
		}
	});
};

// 货件总数计算
const totalShipmentQty = computed(() => {
	return shipments.value.reduce((sum: number, item: any) => sum + item.quantity, 0);
});

// 本地可用库存计算 (使用后端汇总的所有选品数据)
const localStockQty = computed(() => {
	return totalLocalValidValue.value;
});

// FBA库存计算 (使用后端返回的 totalFbaStock 数据)
const fbaStockQty = computed(() => {
	return totalFbaStockValue.value;
});

// --- 同事可售模拟数据 ---
const peerAvailableStock = computed(() => 500);
const peerInTransitStock = computed(() => 200);
const peerMonthlySales = computed(() => 1500);

// 获取索引位置的货件
const getActiveShipmentsForIndex = (index: number) => {
	const isMonth = salesViewType.value === "month";
	const bucketStart = chartStartBase.value.add(
		index * (isMonth ? 1 : 7),
		isMonth ? "month" : "day"
	);
	const bucketEnd = isMonth ? bucketStart.endOf("month") : bucketStart.add(6, "day").endOf("day");

	return shipments.value.filter((ship) => {
		const saleDate = dayjs(ship.amazonSaleDate);
		return (
			(saleDate.isAfter(bucketStart) || saleDate.isSame(bucketStart, "day")) &&
			(saleDate.isBefore(bucketEnd) || saleDate.isSame(bucketEnd, "day"))
		);
	});
};

// 修正：获取特定索引的活动
// 关键逻辑：促销活动是未来的（如2026-03），需要映射到柱状图上的对应历史月份（2025-03）
const getActivePromosForIndex = (index: number) => {
	const isMonth = salesViewType.value === "month";
	// 柱状图对应的历史月份（如 index=2 -> 2025-03）
	const bucketStart = chartStartBase.value.add(
		index * (isMonth ? 1 : 7),
		isMonth ? "month" : "day"
	);
	const bucketEnd = isMonth ? bucketStart.endOf("month") : bucketStart.add(6, "day").endOf("day");

	return promotions.value.filter((promo) => {
		// 促销开始时间是未来月份（如 2026-03-15），需要减去1年映射到历史月份
		const promoStart = dayjs(promo.start);
		// 映射：2026-03-15 -> 2025-03-15（减去1年）
		const mappedPromoStart = promoStart.subtract(1, "year");

		return (
			(mappedPromoStart.isAfter(bucketStart) ||
				mappedPromoStart.isSame(bucketStart, "day")) &&
			(mappedPromoStart.isBefore(bucketEnd) || mappedPromoStart.isSame(bucketEnd, "day"))
		);
	});
};

const salesChartOption = computed(() => {
	const isMonth = salesViewType.value === "month";
	const sData = isMonth ? monthlySales.value : weeklySales.value;
	const iData = isMonth ? monthlyInventory.value : weeklyInventory.value;
	const rData = isMonth ? monthlyRatio.value : weeklyRatio.value;

	const chartStart = chartStartBase.value;

	// xAxisData 已提取为全局 computed

	const barSalesData = sData.map((val, index) => {
		// 使用专业 Indigo 色系
		let color = index === sData.length - 1 ? "#4f46e5" : "#a5b4fc";
		return { value: val, itemStyle: { color } };
	});

	const barInventoryData = iData.map((val, index) => {
		// 使用专业 Teal/Emerald 色系
		let color = index === iData.length - 1 ? "#059669" : "#6ee7b7";
		return { value: val, itemStyle: { color } };
	});

	// 我的销量数据 (橙色系)
	const myData = isMonth ? myMonthlySales.value : myWeeklySales.value;
	const barMySalesData = myData.map((val, index) => {
		let color = index === myData.length - 1 ? "#ea580c" : "#fdba74";
		return { value: val, itemStyle: { color } };
	});

	const defaultZoom = isMonth
		? { startValue: 0, endValue: 11, start: 0, end: 100 }
		: { startValue: 0, endValue: 11 };

	return {
		// 统一颜色配置：销量(蓝)、我的销量(橙)、库存(绿)、库销比(琥珀)
		color: ["#a5b4fc", "#fdba74", "#6ee7b7", "#f59e0b"],
		grid: {
			top: 60,
			bottom: isMonth ? 12 : 38, // 周视图需要留出位置给双行标签 + 滚动条
			left: 45,
			right: 45,
			containLabel: false
		},
		legend: {
			show: true,
			left: "center",
			top: 10,
			icon: "roundRect",
			itemGap: 25,
			textStyle: { color: "#64748b", fontSize: 12 }
		},
		tooltip: {
			trigger: "axis",
			backgroundColor: "rgba(255, 255, 255, 0.98)",
			borderColor: "#f1f5f9",
			borderWidth: 1,
			padding: [12, 16],
			textStyle: { color: "#1e293b", fontSize: 13 },
			extraCssText: "box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-radius: 8px;",
			formatter: (params: any) => {
				if (!params || params.length === 0) return "";
				const index = params[0].dataIndex;
				let title = isMonth
					? chartStart.add(index, "month").format("YYYY年MM月")
					: getWeekFullLabel(index);

				let res = `<div style="font-weight:700;margin-bottom:8px;color:#0f172a;font-size:14px">${title}</div>`;

				params.forEach((p: any) => {
					let val = p.value;
					// 库销比显示为"X月"格式，表示可售月数
					if (p.seriesName === "库销比") val = val > 0 ? val.toFixed(2) : "—";
					res += `<div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0">
						<span style="display:flex;align-items:center;color:#64748b">
							<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:8px"></span>
							${p.seriesName}
						</span>
						<span style="font-weight:700;color:#1e293b;margin-left:20px">${val}</span>
					</div>`;
				});
				if (!isMonth) {
					const dateRange = getWeekDateRange(index);
					res += `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:11px">统计周期: ${dateRange}</div>`;
				}
				return res;
			}
		},
		xAxis: {
			type: "category",
			data: xAxisData.value,
			axisLabel: {
				interval: isMonth ? 0 : "auto",
				rotate: 0, // 恢复正着放，方便对齐后续格子
				color: "#64748b",
				fontSize: 10,
				margin: isMonth ? 1 : 4, // 周视图增加一点间距，避免紧贴坐标轴
				align: "center"
			},
			axisTick: { show: true, alignWithLabel: true },
			axisLine: { lineStyle: { color: "#e2e8f0" } }
		},
		yAxis: [
			{
				type: "value",
				name: "销量/库存",
				splitLine: { show: true, lineStyle: { color: "#f1f5f9", type: "dashed" } },
				axisLabel: { color: "#64748b" },
				max: (val: any) => Math.ceil((val.max + 50) / 10) * 10
			},
			{
				type: "value",
				name: "库销比",
				nameTextStyle: { color: "#f59e0b", padding: [0, 0, 0, 40] },
				// 动态计算最大值：根据实际数据自动缩放
				max: (val: any) => {
					const maxRatio = val.max || 1;
					return Math.ceil(maxRatio * 2) / 2; // 向上取整到0.5的倍数
				},
				min: 0,
				show: true,
				position: "right",
				splitLine: { show: false },
				// 显示为倍数形式，如 2.5 表示可卖2.5个月
				axisLabel: {
					color: "#f59e0b",
					formatter: (v: number) => (v > 0 ? v.toFixed(1) : "—")
				}
			}
		],
		series: [
			{
				name: "销量",
				type: "bar",
				barWidth: isMonth ? "18%" : "25%",
				barGap: "10%",
				data: barSalesData,
				label: {
					show: isMonth,
					position: "top",
					fontSize: 10,
					color: "#64748b",
					formatter: (p: any) => (p.value > 0 ? p.value : "")
				},
				itemStyle: {
					borderRadius: [4, 4, 0, 0]
				}
			},
			{
				name: "我的销量",
				type: "bar",
				barWidth: isMonth ? "18%" : "25%",
				data: barMySalesData,
				label: {
					show: isMonth,
					position: "top",
					fontSize: 10,
					color: "#64748b",
					formatter: (p: any) => (p.value > 0 ? p.value : "")
				},
				itemStyle: {
					borderRadius: [4, 4, 0, 0]
				}
			},
			{
				name: "库存",
				type: "bar",
				barWidth: isMonth ? "22%" : "35%",
				data: barInventoryData,
				label: {
					show: isMonth,
					position: "top",
					fontSize: 10,
					color: "#64748b",
					formatter: (p: any) => (p.value > 0 ? p.value : "")
				},
				itemStyle: {
					borderRadius: [4, 4, 0, 0]
				}
			},
			{
				name: "库销比",
				type: "line",
				yAxisIndex: 1,
				data: rData,
				smooth: true,
				showSymbol: false,
				lineStyle: {
					width: 3,
					color: "#f59e0b",
					shadowColor: "rgba(245, 158, 11, 0.2)",
					shadowBlur: 10
				},
				itemStyle: {
					color: "#f59e0b"
				}
			}
		],
		dataZoom: [
			{
				id: "insideZoom",
				type: "inside",
				zoomOnMouseWheel: false,
				moveOnMouseMove: true,
				moveOnMouseWheel: true,
				...defaultZoom,
				disabled: false
			},
			{
				id: "sliderZoom",
				type: "slider",
				show: !isMonth,
				height: 6, // 极致纤细
				bottom: 4, // 贴近底部
				borderColor: "transparent",
				fillerColor: "rgba(79, 70, 229, 0.15)", // 淡淡的 Indigo 色
				backgroundColor: "rgba(0, 0, 0, 0.02)",
				handleIcon: "path://M-20,0 L20,0 L20,10 L-20,10 Z", // 扁平化手柄
				handleSize: "100%",
				handleStyle: {
					color: "#a5b4fc",
					borderWidth: 0
				},
				moveHandleSize: 0,
				showDetail: false,
				brushSelect: false,
				...defaultZoom
			}
		]
	};
});

// --- 关键词视图逻辑 (采用 Harmony Ocean & Stone 色系) ---
const allKeywords = ref([
	{ name: "无线耳机", selected: true, color: "#312e81", data: [] as number[] }, // Indigo 900
	{ name: "蓝牙耳机", selected: true, color: "#4338ca", data: [] as number[] }, // Indigo 700
	{ name: "降噪耳机", selected: true, color: "#6366f1", data: [] as number[] }, // Indigo 500
	{ name: "运动耳机", selected: true, color: "#818cf8", data: [] as number[] }, // Indigo 400
	{ name: "头戴式耳机", selected: true, color: "#2dd4bf", data: [] as number[] }, // Teal 400
	{ name: "入耳式耳机", selected: true, color: "#14b8a6", data: [] as number[] }, // Teal 500
	{ name: "骨传导", selected: true, color: "#0d9488", data: [] as number[] }, // Teal 600
	{ name: "防水耳机", selected: true, color: "#94a3b8", data: [] as number[] }, // Slate 400
	{ name: "游戏耳机", selected: true, color: "#64748b", data: [] as number[] }, // Slate 500
	{ name: "耳机收纳", selected: true, color: "#475569", data: [] as number[] } // Slate 600
]);

// 预生成稳定数据，防止随机跳动
allKeywords.value.forEach((kw) => {
	kw.data = Array.from({ length: 12 }, () => Math.floor(Math.random() * 500) + 100);
});

const last12Months = ref(
	Array.from({ length: 12 }, (_, i) => {
		return dayjs()
			.subtract(12 - i, "month")
			.format("YYYY-MM");
	})
);

const toggleKeyword = (kw: any) => {
	kw.selected = !kw.selected;
};

const keywordChartOption = computed(() => {
	const selectedKws = allKeywords.value.filter((k) => k.selected);

	// 数据处理：始终截取最后12个月的数据用于图表展示
	// 这样即使API返回13个月（用于包含去年同月做基数），图表也保持整洁
	const displayCount = 12;
	const startIndex = Math.max(0, last12Months.value.length - displayCount);

	const displayXAxis = last12Months.value.slice(startIndex);

	// 计算每个月的总计，用于顶部显示标签
	const totals = Array(displayCount).fill(0);
	selectedKws.forEach((kw) => {
		const kwData = kw.data.slice(startIndex);
		kwData.forEach((val, idx) => {
			totals[idx] += val;
		});
	});

	const series: any[] = selectedKws.map((kw) => {
		return {
			name: kw.name,
			type: "bar",
			stack: "total",
			itemStyle: { color: kw.color },
			data: kw.data.slice(startIndex) // 仅展示最后12个月
		};
	});

	// 添加一个专门显示总值的 Series (透明，仅用于撑开 Label)
	series.push({
		name: "总计",
		type: "bar",
		stack: "total",
		itemStyle: { color: "rgba(0,0,0,0)" },
		label: {
			show: true,
			position: "top",
			formatter: (p: any) => {
				const sum = totals[p.dataIndex];
				return sum > 0 ? `{sum|${sum}}` : "";
			},
			rich: {
				sum: {
					fontWeight: "bold",
					fontSize: 13,
					color: "#334155",
					padding: [4, 0]
				}
			}
		} as any,
		data: Array(displayCount).fill(0.01) // 给极小的值以显示 label，但视觉上看不见
	});

	return {
		tooltip: {
			trigger: "axis",
			axisPointer: { type: "shadow" },
			confine: true,
			enterable: true,
			// 自定义位置：让提示框水平居中于鼠标，这样垂直向上移动就不会触发月份切换
			position: function (point: any, params: any, dom: any, rect: any, size: any) {
				const x = point[0] - size.contentSize[0] / 2;
				const y = point[1] - size.contentSize[1] - 20;
				return [x, y];
			},
			backgroundColor: "rgba(255, 255, 255, 0.98)",
			borderColor: "#e2e8f0",
			borderWidth: 1,
			padding: [4, 6],
			// 极致窄边设计：宽度进一步压缩 + 显眼但优雅的滚动条
			extraCssText: `
				box-shadow: 0 4px 16px rgba(0,0,0,0.1);
				border-radius: 6px;
				width: auto;
				min-width: 130px;
				background: rgba(255, 255, 255, 0.98) !important;
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
				border: 1px solid rgba(226, 232, 240, 0.8);
				padding: 0 !important;
			`,
			formatter: (params: any) => {
				if (!params || params.length === 0) return "";
				let total = 0;
				let headerHtml = `
					<div style="
						margin-bottom: 4px; 
						font-weight: 800; 
						border-bottom: 1px solid #e2e8f0; 
						padding: 6px 10px 4px 10px; 
						font-size: 11px; 
						color: #334155; 
						background: #f8fafc;
						border-radius: 6px 6px 0 0;
					">
						${params[0].axisValue}
					</div>`;

				// 注入极细的高级感滚动条样式 + 斑马纹 + 胶囊标 (紧凑版)
				let itemsHtml = `
					<style>
						.custom-tooltip-list::-webkit-scrollbar { width: 3px; }
						.custom-tooltip-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.02); }
						.custom-tooltip-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
						.custom-tooltip-list::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
						.tooltip-row {
							display: flex; 
							justify-content: space-between; 
							align-items: center; 
							padding: 4px 10px; 
							border-bottom: 1px dashed #f1f5f9;
							transition: background 0.2s;
							line-height: 1.2;
						}
						.tooltip-row:last-child { border-bottom: none; }
						.tooltip-row:hover { background: #f8fafc; }
						.tooltip-capsule {
							display: inline-flex;
							width: 8px; 
							height: 8px; 
							border-radius: 2px;
							margin-right: 6px;
							box-shadow: 0 1px 1px rgba(0,0,0,0.05);
						}
					</style>
					<div class="custom-tooltip-list" style="max-height: 180px; overflow-y: auto; overflow-x: hidden;">
				`;

				params.forEach((p: any, idx: number) => {
					if (p.seriesName !== "总计" && p.value > 0.01) {
						total += Number(p.value);
						itemsHtml += `
							<div class="tooltip-row">
								<span style="display: flex; align-items: center; font-size: 11px; color: #475569; font-weight: 500;">
									<span class="tooltip-capsule" style="background: ${p.color};"></span>
									${p.seriesName}
								</span>
								<span style="font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 11px; margin-left: 12px; color: #1e293b;">
									${Number(p.value).toLocaleString()}
								</span>
							</div>
						`;
					}
				});
				itemsHtml += "</div>";

				const totalHtml = `
					<div style="
						margin-top: 0; 
						border-top: 1px solid #e2e8f0; 
						padding: 6px 10px; 
						background: #fff;
						border-radius: 0 0 6px 6px;
						display: flex; 
						justify-content: space-between; 
						align-items: center;
					">
						<span style="font-weight: 700; font-size: 11px; color: #64748b;">本月总计</span>
						<span style="font-weight: 800; font-size: 12px; color: #0f172a; font-family: 'JetBrains Mono', monospace;">
							${total.toLocaleString()}
						</span>
					</div>
				`;
				return headerHtml + itemsHtml + totalHtml;
			}
		},
		legend: { show: false },
		grid: { left: "3%", right: "3%", bottom: "3%", containLabel: true },
		xAxis: {
			type: "category",
			data: displayXAxis,
			axisLine: { lineStyle: { color: "#e2e8f0" } },
			axisLabel: { color: "#64748b" }
		},
		yAxis: {
			type: "value",
			splitLine: { lineStyle: { type: "dashed", color: "#f1f5f9" } },
			axisLabel: { color: "#64748b" }
		},
		series
	};
});
</script>

<style scoped>
/* 活动促销 Tooltip 样式 - 添加滚动支持 */
.promo-tooltip-content {
	max-height: 400px;
	overflow-y: auto;
	padding-right: 8px;
}

.promo-tooltip-item {
	padding: 10px 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.promo-tooltip-item:last-child {
	border-bottom: none;
}

.promo-info-row {
	display: flex;
	align-items: center;
	padding: 3px 0;
	font-size: 13px;
	line-height: 1.4;
}

.promo-label {
	color: rgba(255, 255, 255, 0.7);
	margin-right: 8px;
	flex-shrink: 0;
	min-width: 45px;
}

/* 自定义滚动条样式 */
.promo-tooltip-content::-webkit-scrollbar {
	width: 5px;
}

.promo-tooltip-content::-webkit-scrollbar-track {
	background: rgba(255, 255, 255, 0.1);
	border-radius: 3px;
}

.promo-tooltip-content::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.3);
	border-radius: 3px;
}

.promo-tooltip-content::-webkit-scrollbar-thumb:hover {
	background: rgba(255, 255, 255, 0.5);
}

.right-lower-section {
	padding-bottom: 80px; /* 留出空间给补货工具栏 */
	position: relative;
}

.analysis-charts-container {
	padding: 0 5px;
	height: 100%;
	display: flex;
	flex-direction: column;
	background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

/* 导航栏已移除，相关样式删除 */

.dashboard-split-wrapper {
	flex: 1;
	display: flex;
	overflow: hidden;
	position: relative;
}

.layout-resizer {
	width: 12px;
	margin: 0 -6px; /* 增加点击区域但保持视觉距离 */
	cursor: col-resize;
	z-index: 100;
	display: flex;
	justify-content: center;
	align-items: center;
	transition: background 0.2s;
}

.layout-resizer:hover {
	background: rgba(59, 130, 246, 0.1);
}

.resizer-handle {
	width: 2px;
	height: 30px;
	background: #e2e8f0;
	border-radius: 2px;
	transition: background 0.2s;
}

.layout-resizer:hover .resizer-handle {
	background: #3b82f6;
	height: 60px;
}

.split-column {
	display: flex;
	flex-direction: column;
	min-width: 0;
	padding: 0 4px; /* 进一步减小列间距 */
}

.column-content {
	flex: 1;
	display: flex;
	flex-direction: column;
	background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
	padding: 12px 16px;
	border-radius: 10px;
	box-shadow:
		0 1px 4px rgba(0, 0, 0, 0.06),
		0 2px 8px rgba(0, 0, 0, 0.04);
	border: 1px solid #e2e8f0;
	overflow: hidden;
}

.nav-left {
	display: flex;
	align-items: center;
}

.keyword-tags {
	display: flex;
	flex-wrap: nowrap;
	gap: 6px;
	max-width: 70%;
	overflow-x: auto;
	scroll-behavior: smooth;
	padding: 4px 0;
	/* 隐藏滚动条但保留功能 */
	scrollbar-width: none;
	-ms-overflow-style: none;
}
.keyword-tags::-webkit-scrollbar {
	display: none;
}

.kw-tag {
	cursor: pointer;
	padding: 4px 12px;
	font-size: 11px;
	border-radius: 16px;
	background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
	color: #4338ca;
	border: 1px solid #a5b4fc;
	transition: all 0.2s ease;
	flex-shrink: 0;
	font-weight: 500;
}
.kw-tag:hover {
	background: linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%);
	transform: translateY(-1px);
	box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
}
.kw-tag.is-checked {
	background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
	color: #fff;
	border-color: #4f46e5;
	box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
}

.chart-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 4px; /* 紧凑排列 */
	flex-shrink: 0;
}

.header-controls {
	display: flex;
	align-items: center;
}

.title {
	font-size: 15px;
	font-weight: 700;
	color: #1e293b;
	border-left: 4px solid #6366f1;
	padding-left: 12px;
	letter-spacing: -0.3px;
}

.title.small {
	font-size: 13px;
	border-left-color: #94a3b8;
}

.legend-hint {
	font-size: 12px;
	color: #64748b;
}

.dot {
	display: inline-block;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	margin-left: 10px;
}
.dot.past {
	background-color: #cbd5e1;
}
.dot.current {
	background-color: #1d4ed8;
}
.dot.future {
	background-color: #93c5fd;
}

.chart-wrapper {
	flex: 1;
	min-height: 150px;
}

.chart-wrapper.SalesMain {
	position: relative;
	/* height: auto !important; 取消强制自动高度，允许 Flex 收缩 */
	flex: 1;
	min-height: 0;
	transition: flex 0.3s ease;
}
.chart-wrapper.SalesMain.is-week {
	/* height: auto !important; */
}

.chart-section {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-height: 0; /* 关键：允许容器收缩 */
}

.data-edit-grid {
	background: #fff;
	z-index: 10;
}

.data-edit-grid.month-fixed {
	display: flex;
	margin: 0 40px 10px 40px;
	padding-top: 10px;
	border-top: 1px solid #e2e8f0;
}

/* 高级感简约滚动条：周视图统一使用此极简样式 */
.data-edit-grid.week-scroll::-webkit-scrollbar {
	height: 12px; /* 进一步增加高度，解决“点击难”的问题 */
}
.data-edit-grid.week-scroll::-webkit-scrollbar-track {
	background: #f8fafc; /* 更明亮的轨道背景 */
	border-radius: 12px;
}
.data-edit-grid.week-scroll::-webkit-scrollbar-thumb {
	background: #cbd5e1;
	border-radius: 12px;
	border: 3px solid #f8fafc; /* 增加滑块与轨道的间距，使滑块看起来更扎实 */
}
.data-edit-grid.week-scroll::-webkit-scrollbar-thumb:hover {
	background: #94a3b8;
}
.data-edit-grid.week-scroll::-webkit-scrollbar-thumb:active {
	background: #3b82f6;
}

/* 自定义网格容器：完全由图表 dataZoom 同步，禁用手工滚动以防错位 */
.data-edit-grid.week-scroll {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 15px;
	margin: 0 40px;
	overflow-x: auto;
	padding-bottom: 12px;
	z-index: 20;
	scroll-snap-type: x mandatory;
	scroll-behavior: smooth;
	scroll-padding: 0 5px; /* 添加微小内边距，确保第一周能完美露头 */
}

.grid-inner {
	display: flex;
}

.edit-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 0 5px;
	box-sizing: border-box;
}

.edit-item.monthly {
	flex: 1;
	min-width: 0;
}

.edit-item.weekly {
	flex-shrink: 0;
	/* 取消 CSS calc，由 JS 计算 itemWidth 注入，根治累积误差 */
	scroll-snap-align: start;
}

.edit-item .label {
	display: block;
	font-size: 11px;
	color: #64748b;
	margin-top: 4px;
	font-weight: 600;
}

.edit-item .sub-label {
	display: block;
	font-size: 10px;
	color: #94a3b8;
	margin-top: 2px;
}

.edit-item.weekly.readonly .value,
.edit-item.monthly.readonly .value {
	color: #64748b;
	font-weight: 500;
	height: 32px;
	line-height: 32px;
	padding: 0 10px;
	background: #f8fafc;
	border-radius: 4px;
	width: 100%;
	text-align: center;
}

.chart-column {
	height: 500px;
	padding: 24px;
	background: #fff;
	border: 1px solid #f1f5f9;
	border-radius: 12px;
	box-shadow:
		0 1px 3px 0 rgba(0, 0, 0, 0.05),
		0 1px 2px 0 rgba(0, 0, 0, 0.06);
	display: flex;
	flex-direction: column;
	transition: all 0.3s ease;
}

.chart-column:hover {
	box-shadow:
		0 4px 6px -1px rgba(0, 0, 0, 0.1),
		0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.forecast-grid-row {
	display: flex;
	align-items: center;
	padding: 2px 0;
	background-color: #f8fafc;
	border-top: 1px solid #f1f5f9;
	flex-shrink: 0; /* 关键：防止被 Flex 压缩到消失 */
}

.forecast-grid-row.input-row {
	background-color: #f8fafc;
	border-top: 1px solid #f1f5f9;
	padding-top: 4px;
	padding-bottom: 2px;
}

.forecast-grid-row.promo-row {
	background-color: #f1f5f9;
	border-top: 1px solid #e2e8f0;
	padding-top: 5px;
	padding-bottom: 5px;
	border-bottom-left-radius: 12px;
	border-bottom-right-radius: 12px;
	height: 32px; /* 强制固定高度，不占据多行 */
}

/* 单元格固定高度 */
.promo-cell {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 4px !important;
	height: 100% !important;
}

.forecast-title-label {
	width: 45px; /* 进一步增加宽度到 45px，确保文字显示完整 */
	font-size: 10px;
	color: #64748b;
	font-weight: 600;
	text-align: center;
	flex-shrink: 0;
	overflow: hidden;
	white-space: nowrap;
}

.forecast-cells-container {
	flex: 1;
	overflow: hidden;
	display: flex;
	align-items: center;
}

.forecast-right-spacer {
	width: 45px; /* 同步增加 */
	flex-shrink: 0;
}

.forecast-cells-inner {
	display: flex;
}

.forecast-cell {
	min-width: 0;
	display: flex;
	justify-content: center;
	align-items: center;
	box-sizing: border-box;
	overflow: hidden;
}

.promo-cell {
	flex-direction: column;
	gap: 2px;
	min-height: 24px;
	padding: 0 2px;
}

/* 标签基础样式：极致压缩单行显示 */
.promo-tag {
	display: flex;
	align-items: center;
	padding: 0 4px; /* 进一步压缩内边距以释放空间 */
	border-radius: 4px; /* 改为矩形微圆角，显著增加水平文字空间 */
	font-size: 10px;
	font-weight: 700;
	white-space: nowrap;
	overflow: hidden;
	height: 18px;
	background-color: #f0f7ff;
	color: #2563eb;
	border: 1px solid #3b82f6;
	width: 95%; /* 略微增加宽度占比 */
	margin: 0 auto;
	cursor: pointer;
	box-sizing: border-box;
	box-shadow: 0 1px 2px rgba(59, 130, 246, 0.05);
}

.promo-tag.multi-tag {
	background-color: #f1f5f9;
	color: #475569;
	border: 1px solid #cbd5e1;
	justify-content: center;
	font-weight: 700;
}

.promo-tag.single-tag {
	background-color: #eff6ff;
	color: #1d4ed8;
	border: 1.2px solid #3b82f6aa;
}

.promo-text {
	width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	text-align: center;
	font-weight: 700; /* 再次确认加粗统一 */
}

.promo-tag:hover {
	filter: brightness(0.95);
	transform: translateY(-1px);
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 增强：Tooltip 丰富内容样式 */

/* 增强：Tooltip 丰富内容样式 */
.promo-tooltip-content {
	padding: 8px;
	max-width: 280px;
}

.promo-tooltip-item {
	margin-bottom: 16px;
	background: rgba(255, 255, 255, 0.03);
	padding: 8px;
	border-radius: 6px;
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.promo-tooltip-item:last-child {
	margin-bottom: 0;
}

.promo-item-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 6px;
}

.promo-item-icon {
	margin-right: 6px;
	font-size: 14px;
}

.promo-item-name {
	font-weight: 800;
	font-size: 14px;
	color: #fff;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.promo-item-time {
	font-size: 10px;
	color: #94a3b8;
	background: rgba(0, 0, 0, 0.2);
	padding: 2px 6px;
	border-radius: 4px;
	font-family: "JetBrains Mono", monospace;
}

.promo-item-desc {
	font-size: 12px;
	color: #cbd5e1;
	line-height: 1.6;
	padding-left: 4px;
	border-left: 2px solid rgba(255, 255, 255, 0.2);
}

/* 货件 Tooltip 样式 - 支持滚动 */
.shipment-tooltip-content {
	max-width: 320px;
	max-height: min(400px, 50vh); /* 响应式：取 400px 和视口高度50%的较小值 */
	overflow-y: auto;
	padding-right: 4px;
}

/* 货件 Tooltip 滚动条样式 */
.shipment-tooltip-content::-webkit-scrollbar {
	width: 4px;
}
.shipment-tooltip-content::-webkit-scrollbar-track {
	background: rgba(255, 255, 255, 0.1);
	border-radius: 2px;
}
.shipment-tooltip-content::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.3);
	border-radius: 2px;
}
.shipment-tooltip-content::-webkit-scrollbar-thumb:hover {
	background: rgba(255, 255, 255, 0.5);
}

.shipment-tooltip-item {
	padding: 10px;
	margin-bottom: 8px;
	background: rgba(255, 255, 255, 0.08);
	border-radius: 6px;
	border: 1px solid rgba(255, 255, 255, 0.1);
}
.shipment-tooltip-item:last-child {
	margin-bottom: 0;
}

.ship-item-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 4px;
}
.ship-item-sn {
	font-weight: 600;
	color: #fff;
	font-size: 12px;
}
.ship-item-qty {
	font-weight: 700;
	color: #4ade80;
	font-size: 13px;
}
.ship-item-meta {
	display: flex;
	justify-content: space-between;
	font-size: 11px;
	color: #a3a3a3;
	margin-bottom: 2px;
}
.ship-item-time {
	font-size: 11px;
	color: #94a3b8;
}

.forecast-input-wrapper {
	width: 100%;
	padding: 0 4px; /* 增加一点内间距，让输入框比格子窄一点点 */
}

.forecast-cell :deep(.el-input__inner) {
	text-align: center;
	padding: 0;
	height: 22px;
	line-height: 22px;
	font-size: 11px;
	border-radius: 4px;
	border-color: #e2e8f0;
	background-color: #ffffff;
	transition: all 0.2s;
}

.forecast-cell :deep(.el-input__inner:hover) {
	border-color: #cbd5e1;
}

.forecast-cell :deep(.el-input__inner:focus) {
	background-color: #fff;
	border-color: #6366f1;
}

.analysis-charts-container :deep(.el-input-number.el-input-number--small) {
	width: 100% !important;
	max-width: 70px;
}

.edit-item.weekly.readonly .value,
.edit-item.monthly.readonly .value {
	color: #64748b;
	font-weight: 500;
	height: 32px;
	line-height: 32px;
	padding: 0 10px;
	background: #f8fafc;
	border-radius: 4px;
	width: 100%;
	text-align: center;
	font-size: 11px;
}

.keyword-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.kw-tag {
	cursor: pointer;
}

/* 货件行样式 */
.forecast-grid-row.shipment-row {
	background-color: #f8fafc;
	border-top: 1px dashed #e2e8f0;
	padding-top: 5px;
	padding-bottom: 5px;
	height: 32px;
}

.shipment-cell {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 4px !important;
	height: 100% !important;
}

.shipment-static-list {
	display: flex;
	gap: 12px;
	padding-left: 15px;
	align-items: center;
	overflow: hidden;
}

.shipment-tag-wrapper {
	flex-shrink: 0;
}

.ship-icon {
	margin-right: 4px;
	font-size: 10px;
}

/* 货件 Tooltip 样式 */
.shipment-tooltip-content {
	padding: 4px;
	min-width: 260px;
}

.shipment-tooltip-item {
	margin-bottom: 12px;
	background: rgba(255, 255, 255, 0.05);
	padding: 10px;
	border-radius: 6px;
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.shipment-tooltip-item:last-child {
	margin-bottom: 0;
}

.ship-item-header {
	display: flex;
	justify-content: space-between;
	font-weight: 800;
	color: #10b981;
	margin-bottom: 6px;
	font-family: "JetBrains Mono", monospace;
}

.ship-item-meta {
	display: flex;
	justify-content: space-between;
	font-size: 11px;
	color: #94a3b8;
	margin-bottom: 6px;
}

.ship-item-time {
	font-size: 10px;
	color: #64748b;
	text-align: right;
	background: rgba(0, 0, 0, 0.2);
	padding: 2px 6px;
	border-radius: 4px;
}
.shipment-tag {
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 6px;
	font-size: 11px;
	font-weight: 700;
	height: 24px;
	width: 90px;
	background-color: #dcfce7;
	color: #15803d;
	border: 2px solid #15803d60;
	cursor: pointer;
	transition: all 0.2s;
	white-space: nowrap;
}

.shipment-tag:hover {
	border-color: #16a34a;
	transform: translateY(-1px);
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* 本地库存行样式 */
.forecast-grid-row.local-stock-row {
	background-color: #f8fafc;
	border-top: 1px dashed #e2e8f0;
	padding-top: 5px;
	padding-bottom: 5px;
	height: 32px;
}

/* 明显的行分割线 */
.row-divider {
	height: 1px;
	background-color: #cbd5e1;
	width: 100%;
	margin: 0;
}

/* 同事可售行样式 (区域最底部) - 明显区分 */
.peer-sales-row {
	background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
	min-height: 52px;
	padding: 10px 0;
	border-top: 2px solid #6366f1;
	border-bottom: 1px solid #a5b4fc;
	border-bottom-left-radius: 12px;
	border-bottom-right-radius: 12px;
	box-shadow: inset 0 2px 4px rgba(99, 102, 241, 0.08);
}

.peer-sales-container {
	flex: 1;
	display: flex;
	align-items: center;
	padding-left: 15px;
	gap: 40px; /* 增加间距使其像表格 */
}

.peer-metric-col {
	display: flex;
	flex-direction: column;
	align-items: center;
	min-width: 60px;
}

.peer-header-cell {
	font-size: 11px;
	color: #64748b;
	margin-bottom: 4px;
	font-weight: 600;
}

.peer-value-cell {
	font-size: 14px;
	color: #1e293b;
	font-weight: 800;
	font-family: Inter, sans-serif;
	background: #f1f5f9;
	padding: 2px 10px;
	border-radius: 4px;
	border: 1px solid #e2e8f0;
	min-width: 50px;
	text-align: center;
}

.local-stock-container,
.shipment-cell {
	min-height: 24px;
	padding: 0 2px;
}

.shipment-tag {
	display: flex;
	align-items: center;
	padding: 0 4px;
	border-radius: 4px;
	font-size: 10px;
	font-weight: 700;
	white-space: nowrap;
	overflow: hidden;
	height: 18px;
	background-color: #ecfdf5; /* 浅绿色背景 */
	color: #059669; /* 深绿色文字 */
	border: 1px solid #10b981;
	width: 95%;
	margin: 0 auto;
	cursor: pointer;
	justify-content: center;
}

.shipment-tag .ship-text {
	overflow: hidden;
	text-overflow: ellipsis;
}

.local-stock-container {
	flex: 1;
	display: flex;
	align-items: center;
	padding-left: 15px;
	gap: 20px; /* 增加间距，避免挤在一起 */
}

.local-stock-tag {
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 6px;
	font-size: 11px;
	font-weight: 700;
	height: 24px;
	min-width: 90px; /* 改为最小宽度 */
	padding: 0 8px; /* 增加内边距 */
	background-color: #dcfce7;
	color: #15803d;
	border: 2px solid #15803d60;
}

/* 货件汇总特有样式 (可选，目前保持一致) */
.shipment-stock-tag {
	/* 可以覆盖颜色，例如使用蓝色系区分 */
	/* background-color: #e0e7ff;
	color: #4338ca;
	border-color: #a5b4fc; */
}

.stock-value {
	font-family: "JetBrains Mono", monospace;
}

.shipment-tag-wrapper {
	flex-shrink: 0;
}

/* ================== 库存日历视图样式 ================== */

/* 右侧上下分栏 - flex布局 */
.keywords-column {
	display: flex;
	flex-direction: column;
	position: relative;
}

/* 上部：搜索词趋势（百分比高度） */
.right-upper-section {
	display: flex;
	flex-direction: column;
	overflow: hidden;
	position: relative;
	z-index: 2;
	background: white;
}

.right-upper-section .keywords-content {
	flex: 1;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	height: 100%;
}

.right-upper-section .chart-wrapper {
	flex: 1;
	min-height: 60px;
	overflow: hidden;
	height: 100%;
}

/* 下部：日历（百分比高度，内容自适应） */
.right-lower-section {
	display: flex;
	flex-direction: column;
	overflow: hidden; /* 这里保持 hidden 确保整体不抖动 */
	padding: 4px 0;
	position: relative;
	z-index: 1;
	background: white;
}

/* 搜索词图表自适应（随高度变化缩放） */
.keyword-chart-flex {
	flex: 1 !important;
	height: 100% !important;
	min-height: 50px;
	overflow: hidden;
}

/* 垂直分隔条 */
.vertical-resizer {
	height: 8px;
	cursor: ns-resize;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.vertical-resizer-handle {
	width: 40px;
	height: 4px;
	background: rgba(148, 163, 184, 0.3);
	border-radius: 2px;
	transition: background 0.2s;
}

.vertical-resizer:hover .vertical-resizer-handle {
	background: rgba(99, 102, 241, 0.6);
}

/* 日历头部 */
.calendar-header {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12px;
	margin-bottom: 6px;
	flex-shrink: 0;
	transition: all 0.3s;
}

.calendar-header.is-narrow {
	flex-wrap: wrap;
	gap: 6px;
	padding: 0 4px;
}

.calendar-title {
	font-size: 12px;
	font-weight: 600;
	color: #94a3b8;
}

.nav-btn {
	background: rgba(79, 70, 229, 0.1);
	border: 1px solid rgba(79, 70, 229, 0.3);
	color: #6366f1;
	padding: 4px 10px;
	border-radius: 4px;
	cursor: pointer;
	font-size: 11px;
	transition: all 0.2s;
}

.nav-btn:hover:not(.is-disabled) {
	background: rgba(79, 70, 229, 0.2);
	color: #818cf8;
}

.nav-btn.is-disabled {
	opacity: 0.4;
	cursor: not-allowed;
	background: rgba(156, 163, 175, 0.1);
	border-color: rgba(156, 163, 175, 0.2);
	color: #9ca3af;
}

/* 日历滚动容器 - 极致精简布局 */
.calendar-scroll-container {
	flex: 1;
	height: auto;
	min-height: 0;
	display: flex;
	flex-direction: column;
	overflow-y: auto; /* 允许内部滚动以适应单屏 */
	padding: 0;
	transition: all 0.3s ease;
}

/* 仅在窄屏单列模式下启用内部滚动条 */
.calendar-scroll-container.is-narrow-mode {
	overflow-y: auto;
	padding-right: 4px;
}

/* 智能美化滚动条 */
.calendar-scroll-container::-webkit-scrollbar {
	width: 5px;
}
.calendar-scroll-container::-webkit-scrollbar-track {
	background: rgba(0, 0, 0, 0.02);
	border-radius: 10px;
}
.calendar-scroll-container::-webkit-scrollbar-thumb {
	background: rgba(148, 163, 184, 0.4);
	border-radius: 10px;
	border: 1px solid transparent;
	background-clip: content-box;
}

.calendar-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 8px; /* 减小间距 */
	padding: 4px; /* 移除底部大留白，由外层padding控制 */
	height: max-content;
	transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}

.calendar-grid.is-narrow {
	grid-template-columns: 1fr;
	padding-bottom: 4px;
}

/* 单个月份 */
.calendar-month {
	background: rgba(248, 250, 252, 0.05);
	border: 1px solid rgba(148, 163, 184, 0.15);
	border-radius: 8px;
	padding: 4px; /* 紧凑模式 */
}

.month-title {
	text-align: center;
	font-size: 12px;
	font-weight: 600;
	color: #475569;
	margin-bottom: 2px;
	padding-bottom: 2px;
	border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

/* 星期标题 */
.weekday-header {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 2px;
	margin-bottom: 4px;
}

.weekday-header span {
	text-align: center;
	font-size: 9px;
	color: #64748b;
	font-weight: 500;
}

/* 日期网格 */
.days-grid {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 2px; /* 进一步减小间隔 */
}

.day-cell {
	width: 100%;
	min-height: 28px; /* 紧凑高度 */
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	padding: 1px 0; /* 极小内边距 */
	border-radius: 4px;
	cursor: pointer;
	transition:
		background-color 0.25s ease,
		transform 0.15s ease,
		border-color 0.2s ease;
	position: relative;
	gap: 0; /* 移除内部gap */
	overflow: visible;
	border: 1px solid transparent;
	/* GPU 加速优化 */
	will-change: background-color, transform;
	transform: translateZ(0);
	backface-visibility: hidden;
}

.day-cell:hover:not(.empty-day):not(.past-day) {
	filter: brightness(0.9);
	transform: scale(1.02);
}

/* 日期数字 - 深色清晰显示 */
.day-number {
	font-size: 11px;
	font-weight: 600;
	color: #1e293b;
	line-height: 1;
}

/* 空白格子 */
.day-cell.empty-day {
	visibility: hidden;
}

/* 过去的日期 - 灰色背景但数字清晰 */
.day-cell.past-day {
	background: rgba(148, 163, 184, 0.2) !important;
	cursor: default;
}

.day-cell.past-day .day-number {
	color: #64748b;
}

/* 今天 */
.day-cell.today {
	background: #3b82f6;
	border-radius: 50%;
}

.day-cell.today .day-number {
	color: #fff;
	font-weight: 700;
}

/* 库存状态颜色 - 采用更通透的配色，并增加内边框感 */
.day-cell.stock-safe {
	background: rgba(34, 197, 94, 0.15); /* 降低背景饱和度，更通透 */
	border: 1px solid rgba(34, 197, 94, 0.4);
}

.day-cell.stock-safe .day-number {
	color: #166534;
}

.day-cell.stock-warning {
	background: rgba(234, 179, 8, 0.18);
	border: 1px solid rgba(234, 179, 8, 0.5);
}

.day-cell.stock-warning .day-number {
	color: #854d0e;
}

.day-cell.stock-danger {
	background: rgba(239, 68, 68, 0.15);
	border: 1px solid rgba(239, 68, 68, 0.4);
}

.day-cell.stock-danger .day-number {
	color: #991b1b;
}

/* 无日均销量时的日历格子样式（只读模式） */
.day-cell.stock-none:not(.past-day):not(.empty-day) {
	background: rgba(245, 247, 250, 0.8);
	border: 1px solid rgba(200, 210, 220, 0.5);
}
.day-cell.stock-none:not(.past-day):not(.empty-day) .day-number {
	color: #606266;
}

/* 图标容器 - 水平排布，支持多个图标并排 */
.day-icons-wrap {
	display: flex;
	flex-direction: row; /* 水平排布 */
	flex-wrap: wrap;
	justify-content: center;
	align-items: center;
	gap: 3px;
	width: 100%;
	max-width: 100%;
}

.day-icon {
	font-size: 12px; /* 紧凑图标 */
	line-height: 1;
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

/* 货件图标 - 稍微放大 */
.shipment-icon {
	font-size: 12px;
	cursor: pointer;
}

/* BD促销图标 - 放大并突出 */
.promo-icon {
	font-size: 10px;
	background: #8b5cf6;
	color: #fff;
	padding: 2px 4px;
	border-radius: 3px;
	font-weight: 700;
	letter-spacing: 0.5px;
}

/* 图例 */
.calendar-legend {
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
	gap: 10px;
	padding: 4px 0;
	flex-shrink: 0;
}

.legend-item {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 11px;
	font-weight: 500;
	color: #475569;
}

.legend-item .dot {
	width: 10px;
	height: 10px;
	border-radius: 2px;
}

.legend-item .dot.safe {
	background: rgba(34, 197, 94, 0.5);
	border: 1px solid #22c55e;
}

.legend-item .dot.warning {
	background: rgba(234, 179, 8, 0.5);
	border: 1px solid #eab308;
}

.legend-item .dot.danger {
	background: rgba(239, 68, 68, 0.5);
	border: 1px solid #ef4444;
}

/* 日历Tooltip - 支持滚动 */
.calendar-tooltip {
	max-width: 280px;
	max-height: min(400px, 50vh); /* 响应式：取 400px 和视口高度50%的较小值 */
	overflow-y: auto;
	padding-right: 4px;
}

/* 日历 Tooltip 滚动条样式 */
.calendar-tooltip::-webkit-scrollbar {
	width: 4px;
}
.calendar-tooltip::-webkit-scrollbar-track {
	background: rgba(255, 255, 255, 0.1);
	border-radius: 2px;
}
.calendar-tooltip::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.3);
	border-radius: 2px;
}
.calendar-tooltip::-webkit-scrollbar-thumb:hover {
	background: rgba(255, 255, 255, 0.5);
}

.calendar-tooltip .tooltip-title {
	font-weight: 700;
	margin-bottom: 8px;
	padding-bottom: 4px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

/* 补货区间选中样式 - 极致强化辨识度 */
.day-cell.is-selected {
	position: relative;
	z-index: 2;
	background: #4f46e5 !important; /* 直接使用品牌色实体背景，绝不混淆 */
	box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);
}

.day-cell.is-selected .day-number,
.day-cell.is-selected .day-icon {
	color: white !important; /* 选中时文字图标变白，极高清晰度 */
	font-weight: 800;
}

.calendar-tooltip .tooltip-item {
	font-size: 12px;
	margin-bottom: 8px;
	padding: 8px;
	background: rgba(255, 255, 255, 0.08); /* 卡片背景 */
	border-radius: 6px;
	border: 1px solid rgba(255, 255, 255, 0.1);
	color: #e2e8f0;
}

.calendar-tooltip .tooltip-item:last-child {
	margin-bottom: 0;
}

/* 促销活动 Tooltip 紧凑布局 - 支持滚动 */
.calendar-tooltip.promo-tooltip {
	max-width: 280px;
	max-height: min(400px, 50vh); /* 响应式：取 400px 和视口高度50%的较小值 */
	overflow-y: auto;
	padding-right: 4px;
}

/* 促销 Tooltip 滚动条样式 */
.calendar-tooltip.promo-tooltip::-webkit-scrollbar {
	width: 4px;
}
.calendar-tooltip.promo-tooltip::-webkit-scrollbar-track {
	background: rgba(255, 255, 255, 0.1);
	border-radius: 2px;
}
.calendar-tooltip.promo-tooltip::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.3);
	border-radius: 2px;
}
.calendar-tooltip.promo-tooltip::-webkit-scrollbar-thumb:hover {
	background: rgba(255, 255, 255, 0.5);
}

.promo-detail-item {
	padding: 8px;
	margin-bottom: 8px;
	background: rgba(255, 255, 255, 0.08);
	border-radius: 6px;
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.promo-detail-item:last-child {
	margin-bottom: 0;
}

.promo-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 2px;
}

.promo-row.small {
	font-size: 11px;
	color: #a3a3a3;
}

.promo-type {
	font-weight: 600;
	color: #fff;
	background: #8b5cf6;
	padding: 1px 6px;
	border-radius: 3px;
	font-size: 11px;
}

.promo-shop {
	font-size: 11px;
	color: #93c5fd;
}

.promo-status {
	padding: 1px 6px;
	border-radius: 3px;
	font-size: 10px;
	font-weight: 500;
}

.promo-status.active {
	background: rgba(34, 197, 94, 0.3);
	color: #4ade80;
}

.promo-status.inactive {
	background: rgba(148, 163, 184, 0.3);
	color: #94a3b8;
}

/* 高端方格动态底栏 (Visibility & Contrast Fix) */
.premium-replenishment-bar {
	position: absolute;
	bottom: 12px;
	left: 12px;
	right: 12px;
	background: #ffffff;
	border: 1px solid #c0c4cc; /* 加深边框 */
	border-radius: 8px;
	height: 52px;
	display: flex;
	align-items: center;
	padding: 0;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	z-index: 1000;
	overflow: hidden;
	/* 动画优化 */
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	will-change: height, opacity;
	transform: translateZ(0); /* GPU 加速 */
}

.premium-replenishment-bar.is-active {
	height: 52px;
}

/* 算法矩阵区域 - 动态分配空间 */
.algo-matrix-container {
	flex: 1; /* 这里让它占据剩余空间，不再拥挤 */
	display: flex;
	height: 100%;
	background: #f8f9fb;
	padding: 4px;
	gap: 4px;
	min-width: 120px;
	/* 动画优化 */
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	transform: translateZ(0); /* GPU 加速 */
}

.matrix-card {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	border-radius: 6px; /* 明显的圆角边框 */
	transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	background: #ffffff;
	border: 1px solid #dcdfe6; /* 显眼的边框 */
	position: relative;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.matrix-card:hover {
	border-color: #2f54eb;
	background: #fafafa;
}

/* 垂直层级设计 */
.card-inner {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0px; /* 紧凑排列 */
}

.matrix-card .m-label {
	font-size: 10px;
	color: #8c8c8c; /* 辅助灰 */
	font-weight: 700;
	line-height: 1;
}

.matrix-card .m-val {
	font-size: 16px;
	font-weight: 900;
	color: #1a1a1a; /* 极深文本 */
	font-family: "Din Condensed", "Inter", sans-serif;
	margin-top: 2px;
}

/* 激活状态：高端蓝底 */
.matrix-card.is-active {
	background: #2f54eb;
	border-color: #2f54eb;
	box-shadow: 0 4px 12px rgba(47, 84, 235, 0.25);
}

.matrix-card.is-active .m-label {
	color: rgba(255, 255, 255, 0.75);
}

.matrix-card.is-active .m-val {
	color: #ffffff;
}

/* 日期看板 - 信息清晰化 (完全动态) */
.info-panel-grid {
	flex: 0 0 auto; /* 按内容收缩 */
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 0 8px; /* 减小内边距 */
	height: 100%;
	background: #ffffff;
	border-right: 1px solid #ebeef5;
}

.date-stack {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 2px;
}

.date-row {
	display: flex;
	align-items: center;
	gap: 6px;
	line-height: 1.1;
}

.dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
}
.icon-start {
	background: #67c23a;
}
.icon-end {
	background: #f56c6c;
}

.date-row .val {
	font-size: 11px; /* 减小字体 */
	font-weight: 700;
	color: #303133;
	font-family: "Inter", "Monaco", monospace;
}

.duration-badge {
	background: #303133;
	padding: 4px 8px;
	border-radius: 4px;
	display: flex;
	align-items: baseline;
	gap: 1px;
	color: #ffffff;
}

.duration-badge .num {
	font-size: 13px;
	font-weight: 900;
}
.duration-badge .unit {
	font-size: 10px;
	opacity: 0.8;
}

/* 备注弹窗增强 - 动态宽度与不换行 */
:deep(.dynamic-remark-dialog) {
	min-width: 480px;
	max-width: 95vw;
}

.calculation-summary-card {
	background: linear-gradient(135deg, #f0f4ff 0%, #e6edff 100%);
	border: 1px solid #d6e4ff;
	border-radius: 8px;
	padding: 12px 20px;
	display: flex;
	align-items: center;
	justify-content: space-around;
	margin-bottom: 16px;
	box-shadow: 0 2px 8px rgba(47, 84, 235, 0.08);
}

.calc-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
}
.calc-item .c-label {
	font-size: 11px;
	color: #64748b;
	font-weight: 600;
}
.calc-item .c-val {
	font-size: 20px;
	font-weight: 900;
	color: #1e293b;
	font-family: "DIN Condensed", "Inter", sans-serif;
}
.calc-item.highlight .c-val {
	color: #2f54eb;
}
.calc-item.result .c-val {
	color: #67c23a;
	font-size: 24px;
}

.calc-sign {
	font-size: 18px;
	font-weight: 700;
	color: #94a3b8;
}

.compact-no-wrap-table {
	width: 100% !important;
	margin-top: 8px;
	border-radius: 6px;
	overflow: hidden;
}

.compact-no-wrap-table :deep(th),
.compact-no-wrap-table :deep(td) {
	white-space: nowrap !important;
	padding: 6px 0 !important;
}

/* ========== 行动中心 - 紧凑定宽设计 ========== */
.action-center {
	flex: 0 0 auto; /* 改为非伸缩，保持紧凑 */
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

/* 输入框容器 - 紧凑设计，随内容变化 */
.input-box {
	display: flex;
	align-items: center;
	gap: 4px;
	background: #fff;
	border: 1px solid #dcdfe6;
	border-radius: 4px;
	padding: 0 6px;
	height: 32px;
	flex: 0 1 auto; /* 允许收缩但不允许扩张 */
	width: auto;
	overflow: visible;
}

.input-box:hover {
	border-color: #2f54eb;
}

.box-label {
	font-size: 11px;
	font-weight: 700;
	color: #606266;
	white-space: nowrap;
	flex-shrink: 0;
}

.box-input {
	flex: 1; /* 输入组件也占据剩余空间 */
}

/* ===== 暴力覆盖宽度，防止拉伸 ===== */
.box-input.el-input-number {
	width: 45px !important; /* 给定小宽度 */
	max-width: 45px !important;
}

.box-input.el-input-number :deep(.el-input) {
	width: 45px !important;
	max-width: 45px !important;
}

.box-input.el-input-number :deep(.el-input__wrapper) {
	width: 45px !important;
	max-width: 45px !important;
	box-shadow: none !important;
	background: transparent !important;
	padding: 0 !important;
}

.box-input.el-input-number :deep(.el-input__inner) {
	width: 100% !important;
	max-width: none !important;
	background: transparent !important;
	border: none !important;
	height: 28px !important;
	padding: 0 2px !important;
	font-weight: 800;
	color: #2f54eb;
	font-size: 14px; /* 减小字体 */
	text-align: left; /* 从左到右显示，符合阅读习惯 */
	font-family: "DIN Condensed", "Inter", system-ui, sans-serif;
}

.box-input :deep(.el-input__inner)::placeholder {
	color: #c0c4cc;
	font-size: 11px;
	font-weight: 400;
}

.box-icon {
	font-size: 12px;
	cursor: pointer;
	flex-shrink: 0;
	margin-left: 4px;
}

/* 按钮组 - 紧凑不换行 */
.action-btns {
	display: flex;
	gap: 6px;
	flex-shrink: 0; /* 不收缩，保证按钮完整 */
}

.act-btn {
	height: 28px;
	padding: 0 10px;
	border-radius: 4px;
	font-size: 11px;
	font-weight: 700;
	cursor: pointer;
	transition: all 0.15s;
	border: 1px solid transparent;
	white-space: nowrap;
}

.act-btn.cancel {
	background: transparent;
	color: #909399;
	border-color: #dcdfe6;
}
.act-btn.cancel:hover {
	color: #f56c6c;
	border-color: #f56c6c;
}

.act-btn.save {
	background: #fff;
	color: #606266;
	border-color: #dcdfe6;
}
.act-btn.save:hover {
	color: #2f54eb;
	border-color: #2f54eb;
}

.act-btn.submit {
	background: linear-gradient(135deg, #2f54eb 0%, #1d39c4 100%);
	color: #fff;
	border: none;
	box-shadow: 0 2px 8px rgba(47, 84, 235, 0.25);
}
.act-btn.submit:hover {
	opacity: 0.9;
	transform: translateY(-1px);
}
/* 等待提示 */
.waiting-prompt {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	color: #94a3b8;
	font-size: 13px;
	font-weight: 500;
}

.loading-spin {
	width: 14px;
	height: 14px;
	border: 2px solid #e2e8f0;
	border-top-color: #2f54eb;
	border-radius: 50%;
	animation: spin 0.8s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

.right-lower-section {
	padding-bottom: 60px !important; /* 专业版高度更低，节省空间 */
}

.btn-clear {
	background: transparent;
	border: none;
	color: #64748b;
	font-size: 12px;
	cursor: pointer;
	padding: 6px 10px;
	border-radius: 6px;
}

.btn-clear:hover {
	background: #f8fafc;
	color: #1e293b;
}

.btn-primary {
	background: #4f46e5;
	color: white;
	border: none;
	padding: 7px 16px;
	border-radius: 8px;
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s;
}

.btn-primary:hover {
	background: #4338ca;
	box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
}

/* 促销活动 Tooltip 样式 */
.promo-tooltip-content {
	max-width: 320px;
}

.promo-tooltip-item {
	padding: 8px 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.promo-tooltip-item:last-child {
	border-bottom: none;
}

.promo-info-row {
	padding: 2px 0;
	font-size: 12px;
	line-height: 1.5;
}

.promo-label {
	color: #94a3b8;
	margin-right: 6px;
	display: inline-block;
	min-width: 50px;
}

/* 备注图标样式 */
.remark-icon {
	cursor: pointer;
	position: relative;
}
.remark-icon:hover {
	opacity: 0.8;
}
.remark-dot {
	position: absolute;
	top: -2px;
	right: -2px;
	width: 6px;
	height: 6px;
	background: #f56c6c;
	border-radius: 50%;
}

/* 备注弹窗样式 */
.remark-dialog-content {
	padding: 0 10px;
}
.remark-section {
	margin-bottom: 16px;
}
.remark-label {
	display: block;
	font-weight: 600;
	color: #303133;
	margin-bottom: 8px;
	font-size: 13px;
}

/* 操作区滑入动画 */

/* 未选区域时，算法卡片居中展开，更大气的样式 */
.algo-matrix-container.algo-only-mode {
	flex: 1;
	justify-content: center;
	gap: 20px;
}
.algo-matrix-container.algo-only-mode .matrix-card {
	min-width: 140px;
	padding: 16px 32px;
	border-radius: 10px;
}
.algo-matrix-container.algo-only-mode .matrix-card .m-label {
	font-size: 15px;
	font-weight: 600;
	color: #606266;
}
.algo-matrix-container.algo-only-mode .matrix-card.is-active {
	background: linear-gradient(135deg, #2f54eb 0%, #1d39c4 100%);
	border-color: #2f54eb;
	box-shadow: 0 6px 16px rgba(47, 84, 235, 0.35);
}
.algo-matrix-container.algo-only-mode .matrix-card.is-active .m-label {
	color: #ffffff;
	font-weight: 700;
}

/* 禁用状态：日均销量为空或算法数据不足时 */
.matrix-card.is-disabled {
	opacity: 0.6;
	cursor: not-allowed;
	background: #f5f5f5 !important;
	border-color: #d9d9d9 !important;
}
.matrix-card.is-disabled:hover {
	transform: none;
	box-shadow: none;
}
.matrix-card.is-disabled .m-label {
	color: #999 !important;
}
.m-val.disabled-val {
	font-size: 10px;
	color: #ef4444;
	font-weight: 500;
}

/* 货件tooltip店铺名样式 */
.ship-item-store {
	font-weight: 700;
	color: #67c23a;
	margin-bottom: 4px;
	font-size: 13px;
}
.ship-item-asin {
	font-size: 11px;
	color: #409eff;
	margin-bottom: 3px;
}
.slide-right-enter-active,
.slide-right-leave-active {
	transition: all 0.3s ease;
}
.slide-right-enter-from {
	opacity: 0;
	transform: translateX(30px);
}
.slide-right-leave-to {
	opacity: 0;
	transform: translateX(30px);
}
.remark-text.readonly {
	color: #909399;
	font-size: 13px;
	line-height: 1.5;
	padding: 8px 12px;
	background: #f5f7fa;
	border-radius: 4px;
	margin: 0;
}

/* 补货明细弹窗样式 */
.replenishment-detail-content {
	padding: 4px;
}

/* 补货明细弹窗Tab切换器 */
.detail-tab-switcher {
	display: flex;
	justify-content: center;
	margin-bottom: 12px;
	padding-bottom: 8px;
	border-bottom: 1px solid #e5e7eb;
}

/* 补货明细弹窗深度样式优化 */
:deep(.el-dialog[aria-label="📊 补货明细计算"] .el-dialog__body) {
	padding: 12px !important;
}

:deep(.replenishment-detail-content .el-table) {
	font-size: 12px;
}

:deep(.replenishment-detail-content .el-table .el-table__cell) {
	padding: 6px 0 !important;
}

:deep(.replenishment-detail-content .el-table th.el-table__cell) {
	padding: 8px 0 !important;
}

:deep(.replenishment-detail-content .el-table .el-table__row) {
	height: 36px !important;
}

:deep(.replenishment-detail-content .el-alert) {
	padding: 8px 12px !important;
}

:deep(.replenishment-detail-content .el-alert__title) {
	font-size: 12px !important;
}

/* 补货明细弹窗footer优化 */
:deep(.el-dialog[aria-label="📊 补货明细计算"] .el-dialog__footer) {
	padding: 8px 12px !important;
}

/* 当前月份小圆点标识 */
.current-month-dot {
	display: flex;
	align-items: center;
	gap: 6px;
	font-weight: 500;
	color: #409eff;
}

.dot-icon {
	display: inline-block;
	width: 6px;
	height: 6px;
	background: #409eff;
	border-radius: 50%;
	flex-shrink: 0;
}

/* 5个月窗口汇总卡片 */
.window-summary-card {
	background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
	border: 1px solid #bae6fd;
	border-radius: 6px;
	padding: 8px 12px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 10px;
	box-shadow: 0 1px 4px rgba(14, 165, 233, 0.08);
}

.summary-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
}

.summary-item.large {
	min-width: 90px;
}

.summary-item .s-label {
	font-size: 11px;
	color: #64748b;
	font-weight: 500;
}

.summary-item .s-value {
	font-size: 14px;
	font-weight: 700;
	color: #0f172a;
}

.summary-item .s-value.highlight {
	color: #0ea5e9;
}

.summary-item .s-value.primary {
	font-size: 16px;
	color: #0284c7;
}

.summary-divider {
	width: 1px;
	height: 28px;
	background: linear-gradient(to bottom, transparent, #cbd5e1, transparent);
}

/* 算法名称文本 */
.algo-name-text {
	margin-right: 2px;
}

/* 降级星号指示器 */
.fallback-star {
	display: inline-block;
	color: #e6a23c;
	font-weight: bold;
	font-size: 18px;
	line-height: 1;
	cursor: help;
}

/* 详情分区 */
.detail-section {
	min-height: 200px;
}

/* ========== 历史记录样式 ========== */
.history-section {
	padding: 8px 0;
}

.history-loading {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 40px;
	color: #909399;
	font-size: 14px;
}

.history-empty {
	padding: 20px;
}

.history-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
	max-height: 400px;
	overflow-y: auto;
}

.history-item {
	background: #f8fafc;
	border: 1px solid #e5e7eb;
	border-radius: 8px;
	padding: 12px;
	transition: all 0.2s ease;
}

.history-item:hover {
	border-color: #409eff;
	box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.history-item.is-current {
	background: linear-gradient(135deg, #ecf5ff 0%, #f5f7fa 100%);
	border-color: #409eff;
}

.history-item-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8px;
}

.history-time {
	font-size: 12px;
	color: #909399;
}

.history-item-body {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8px;
}

.history-info {
	display: flex;
	gap: 16px;
}

.history-range {
	font-size: 13px;
	color: #606266;
}

.history-qty {
	font-size: 14px;
	font-weight: 600;
	color: #409eff;
}

.history-algo {
	font-size: 12px;
	color: #909399;
	background: #f0f2f5;
	padding: 2px 6px;
	border-radius: 4px;
}

.history-coeff {
	font-size: 12px;
	color: #67c23a;
	font-weight: 500;
}

.history-item-actions {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
	border-top: 1px dashed #e5e7eb;
	padding-top: 8px;
}

/* 暂存详情弹窗 - 去除多余宽度 */
:global(.history-detail-dialog) {
	width: auto !important;
	max-width: 420px !important;
}

.detail-summary {
	background: linear-gradient(135deg, #f5f7fa 0%, #e8f4fc 100%);
	border-radius: 6px;
	padding: 10px;
	margin-bottom: 10px;
}

.summary-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 3px 0;
	border-bottom: 1px dashed #e5e7eb;
}

.summary-row:last-child {
	border-bottom: none;
}

.summary-row .label {
	color: #606266;
	font-size: 12px;
}

.summary-row .value {
	font-weight: 500;
	color: #303133;
	font-size: 13px;
}

.summary-row.total {
	margin-top: 4px;
	padding-top: 6px;
	border-top: 2px solid #e5e7eb;
}

.summary-row .value.highlight {
	font-size: 20px;
	font-weight: 700;
	color: #409eff;
}

/* 手动系数相关样式 */
.coeff-label {
	margin-left: 12px;
}

.coeff-input {
	width: 60px !important;
}

.final-qty {
	margin-left: 8px;
	font-weight: 600;
	color: #67c23a;
	font-size: 13px;
}

/* 备注弹窗增强 */
.remark-summary {
	font-size: 13px;
	color: #303133;
	margin: 4px 0 8px;
	line-height: 1.5;
}

.coeff-badge {
	display: inline-block;
	background: #fef0f0;
	color: #f56c6c;
	padding: 2px 8px;
	border-radius: 4px;
	font-size: 12px;
	margin-bottom: 8px;
}

.fallback-tag {
	display: inline-block;
	background: #fdf6ec;
	color: #e6a23c;
	padding: 1px 6px;
	border-radius: 3px;
	font-size: 11px;
	cursor: help;
}

/* Tab切换器样式 */
.remark-tab-switcher {
	display: flex;
	justify-content: center;
	margin-bottom: 16px;
	padding-bottom: 12px;
	border-bottom: 1px solid #e5e7eb;
}

/* 降级指示器（星号） */
.fallback-indicator {
	display: inline-block;
	color: #e6a23c;
	font-weight: bold;
	font-size: 16px;
	line-height: 1;
	margin-left: 2px;
	cursor: help;
}

/* 算法名称文本 */
.algo-name {
	margin-right: 2px;
}

/* 窗口范围信息卡片 */
.calc-item.info {
	min-width: 140px;
}
.calc-item.info .c-val.small {
	font-size: 14px;
	font-weight: 700;
	color: #1e293b;
}

/* 补货条动态切换动画 */
.sales-unit-wrapper {
	display: flex;
	align-items: center;
	gap: 6px;
	flex: 0 0 auto;
	width: 90px; /* 给定固定宽度，防止切换时抖动 */
	min-width: 0;
}

.box-final-val {
	font-size: 14px; /* 减小字体 */
	font-weight: 900;
	color: #67c23a;
	font-family: "DIN Condensed", "Inter", sans-serif;
}

.active-coef {
	color: #4f46e5 !important;
}

.box-sep {
	width: 1px;
	height: 14px;
	background: #dcdfe6;
	margin: 0 4px;
	flex-shrink: 0;
}

.sales-toggle-enter-active,
.sales-toggle-leave-active {
	transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.sales-toggle-enter-from {
	opacity: 0;
	transform: translateX(-10px);
}
.sales-toggle-leave-to {
	opacity: 0;
	transform: translateX(10px);
}
</style>

<!-- 非 scoped 样式 - 用于 el-tooltip 弹出层 -->
<style>
/* 活动促销 Tooltip 弹出层样式 */
.promo-tooltip-popper {
	max-width: 320px !important;
}

.promo-tooltip-popper .promo-tooltip-content {
	max-height: 400px;
	overflow-y: auto;
	padding-right: 8px;
}

.promo-tooltip-popper .promo-tooltip-item {
	padding: 10px 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.promo-tooltip-popper .promo-tooltip-item:last-child {
	border-bottom: none;
}

.promo-tooltip-popper .promo-info-row {
	display: flex;
	align-items: center;
	padding: 3px 0;
	font-size: 13px;
	line-height: 1.4;
}

.promo-tooltip-popper .promo-label {
	color: rgba(255, 255, 255, 0.7);
	margin-right: 8px;
	flex-shrink: 0;
	min-width: 50px;
}

/* 自定义滚动条样式 */
.promo-tooltip-popper .promo-tooltip-content::-webkit-scrollbar {
	width: 5px;
}

.promo-tooltip-popper .promo-tooltip-content::-webkit-scrollbar-track {
	background: rgba(255, 255, 255, 0.1);
	border-radius: 3px;
}

.promo-tooltip-popper .promo-tooltip-content::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.3);
	border-radius: 3px;
}

.promo-tooltip-popper .promo-tooltip-content::-webkit-scrollbar-thumb:hover {
	background: rgba(255, 255, 255, 0.5);
}
</style>
