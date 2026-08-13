<template>
	<div class="mini-analysis-container" v-loading="loading" ref="miniContainerRef">
		<!-- 0. 刷新按钮 -->
		<div class="mini-refresh-bar">
			<span
				class="refresh-btn"
				:class="{ spinning: refreshing }"
				@click="refreshData"
				title="刷新数据（不影响当前编辑状态）"
			>🔄</span>
		</div>
		<!-- 1. 聚合趋势图 -->
		<div class="mini-chart-section">
			<v-chart :option="miniChartOption" style="width: 100%; height: 160px" autoresize />
		</div>

		<!-- 2. 交互式日历 -->
		<div class="mini-calendar-section">
			<!-- 日历头部：月份导航 -->
			<div class="calendar-header">
				<button class="nav-btn" @click="moveMonth(-1)" :disabled="isPrevMonthDisabled">
					◀
				</button>
				<div class="header-center">
					<span class="calendar-title">{{ currentYear }}年{{ currentMonthRange }}</span>
					<!-- 状态图例 -->
					<div class="inline-legend">
						<div class="legend-item">
							<div class="dot safe"></div>
							≥5天
						</div>
						<div class="legend-item">
							<div class="dot warning"></div>
							&lt;5天
						</div>
						<div class="legend-item">
							<div class="dot danger"></div>
							断货
						</div>
					</div>
				</div>
				<button class="nav-btn" @click="moveMonth(1)" :disabled="isNextMonthDisabled">
					▶
				</button>
			</div>

			<!-- 3. 日历网格 -->
			<div class="mini-calendar-grid">
				<div v-for="(month, mIdx) in calendarMonths" :key="mIdx" class="calendar-month">
					<div class="month-title">{{ month.format("M月") }}</div>
					<div class="weekday-header">
						<span v-for="d in ['一', '二', '三', '四', '五', '六', '日']" :key="d">{{
							d
						}}</span>
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
								<span v-if="getMilestoneDay(day.dateStr)" class="milestone-badge">{{ getMilestoneDay(day.dateStr) }}天</span>
								<div class="day-icons-wrap">
									<!-- 货件图标 (Rich Tooltip) -->
									<el-tooltip
										v-if="day.shipments.length > 0"
										placement="top"
										effect="dark"
										popper-class="mini-rich-tooltip"
										:teleported="false"
									>
										<template #content>
											<div class="shipment-tooltip-content">
												<div class="tooltip-header-row">
													<span class="header-icon">📦</span>
													<span class="header-text"
														>货件到货 ({{
															day.shipments.reduce(
																(s, x) => s + (x.quantity || 0),
																0
															)
														}}件)</span
													>
												</div>
												<div class="tooltip-scroller">
													<div
														v-for="ship in day.shipments"
														:key="ship.orderSn"
														class="shipment-tooltip-item"
													>
														<div
															class="ship-item-store"
															v-if="ship.store_name"
														>
															🏪 {{ ship.store_name }}
														</div>
														<div class="ship-item-header">
															<span class="ship-item-sn">{{
																ship.orderSn
															}}</span>
															<span class="ship-item-qty"
																>{{ ship.quantity }}件</span
															>
														</div>
														<div
															class="ship-item-asin"
															v-if="ship.asin"
														>
															ASIN: {{ ship.asin }}
														</div>
														<div class="ship-item-meta">
															<span v-if="ship.logisticsChannelName"
																>渠道:
																{{
																	ship.logisticsChannelName
																}}</span
															>
														</div>
														<div
															class="ship-item-time"
															v-if="ship.amazonSaleDate"
														>
															预计可售: {{ ship.amazonSaleDate }}
														</div>
													</div>
												</div>
											</div>
										</template>
										<span class="day-icon shipment-icon">📦</span>
									</el-tooltip>

									<!-- BD标签 (Rich Tooltip) -->
									<el-tooltip
										v-if="day.promotions.length > 0"
										placement="top"
										effect="dark"
										popper-class="mini-rich-tooltip"
										:teleported="false"
									>
										<template #content>
											<div class="promo-tooltip-content">
												<div class="tooltip-header-row">
													<span class="header-icon">🔥</span>
													<span class="header-text"
														>促销活动 ({{
															day.promotions.length
														}}个)</span
													>
												</div>
												<div class="tooltip-scroller">
													<div
														v-for="promo in day.promotions"
														:key="promo.id"
														class="promo-tooltip-item"
													>
														<div class="promo-type-badge">
															{{ promo.name }}
														</div>
														<div
															class="promo-info-row"
															style="
																color: #94a3b8;
																margin-bottom: 2px;
															"
														>
															ASIN: {{ promo.asin }}
														</div>
														<div
															class="promo-info-row"
															v-if="promo.shop_name"
														>
															<span class="promo-label">店铺:</span>
															{{ promo.shop_name }}
														</div>
														<div class="promo-info-row">
															<span class="promo-label">时间:</span>
															{{ dayjs(promo.start).format("MM-DD") }}
															~ {{ dayjs(promo.end).format("MM-DD") }}
														</div>
														<div class="promo-info-row">
															<span class="promo-label">状态:</span>
															{{ promo.status }}
														</div>
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

		<!-- 3. 高端方格动态底栏 (仿 ListingAnalysisCharts) -->
		<div class="mini-control-section" v-if="baseDailyAvgSales > 0">
			<!-- A. 算法矩阵卡片 -->
			<div class="algo-matrix-container" :class="{ 'algo-only-mode': !selectionEnd }">
				<template v-for="(algo, idx) in algoNames" :key="idx">
					<!-- 综合走势卡片：带 α 设置 Popover -->
					<el-popover
						v-if="idx === 3"
						:visible="alphaPopoverVisible"
						placement="top"
						:width="280"
						:teleported="true"
					>
						<template #reference>
							<div
								class="matrix-card"
								:class="{
									'is-active': algoSelection === idx + 1,
									'is-disabled': !algoAvailability[idx],
									'has-custom-alpha': customAlpha !== undefined
								}"
								@click="handleAlgoClick(idx)"
							>
								<div class="card-inner">
									<span class="m-label">
										{{ algo }}
										<el-tooltip v-if="algoSelection === 4" placement="top" :show-after="200">
											<template #content>
												<div style="font-size: 12px; line-height: 1.8; min-width: 180px">
													<div style="font-weight: 700; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px">
														{{ customAlpha !== undefined ? `α = ${customAlpha.toFixed(2)} (自定义)` : 'α = 默认' }}
														<span style="opacity: 0.7; font-weight: 400"> · 点击可调整</span>
													</div>
													<div v-for="item in alphaMonthlyDetail" :key="item.month" style="display: flex; justify-content: space-between; gap: 12px">
														<span style="font-weight: 600">{{ item.month }}</span>
														<span>销{{ item.sc }} · 搜{{ item.kc }} → <b>{{ item.coeff }}</b></span>
													</div>
												</div>
											</template>
											<span class="alpha-tag">
												{{ customAlpha !== undefined ? `α${customAlpha.toFixed(1)}` : 'α' }}▾
											</span>
										</el-tooltip>
									</span>
									<span v-if="selectionEnd && algoAvailability[idx]" class="m-val">{{ algoForecasts[idx] }}</span>
									<span v-else-if="selectionEnd && !algoAvailability[idx]" class="m-val disabled-val">数据不足</span>
								</div>
							</div>
						</template>
						<div class="alpha-config-panel" @click.stop>
							<div class="alpha-header">
								<span class="alpha-title">α 权重设置</span>
								<el-button size="small" text type="info" @click="alphaPopoverVisible = false" style="padding: 2px">✕</el-button>
							</div>
							<div class="alpha-slider-row">
								<el-slider v-model="alphaInputValue" :min="0" :max="1" :step="0.05" style="flex: 1" />
								<el-input-number v-model="alphaInputValue" :min="0" :max="1" :step="0.1" :precision="2" :controls="false" size="small" style="width: 68px; margin-left: 12px" />
							</div>
							<div class="alpha-range-labels">
								<span>← 搜索侧重</span>
								<span>销量侧重 →</span>
							</div>
							<div class="alpha-actions">
								<el-button size="small" @click="resetAlpha">重置默认</el-button>
								<el-button size="small" type="primary" @click="applyAlpha">应用</el-button>
							</div>
						</div>
					</el-popover>
					<!-- 其他算法卡片：带 Tooltip -->
					<el-tooltip
						v-else
						:content="['基于近期日均销量计算', '基于去年同期历史销量计算', '基于搜索词趋势数据计算'][idx]"
						placement="top"
						:show-after="300"
					>
						<div
							class="matrix-card"
							:class="{
								'is-active': algoSelection === idx + 1,
								'is-disabled': !algoAvailability[idx]
							}"
							@click="handleAlgoClick(idx)"
						>
							<div class="card-inner">
								<span class="m-label">{{ algo }}</span>
								<span v-if="selectionEnd && algoAvailability[idx]" class="m-val">{{ algoForecasts[idx] }}</span>
								<span v-else-if="selectionEnd && !algoAvailability[idx]" class="m-val disabled-val">数据不足</span>
							</div>
						</div>
					</el-tooltip>
				</template>
			</div>

			<!-- B. 行动中心 (仅在选择结束日期后显示) -->
			<div v-if="selectionEnd" class="action-center">
				<!-- B1. 日期看板 -->
				<div class="date-panel">
					<div class="date-item">
						<span class="date-dot start"></span>
						<span class="date-val">{{ selectionStart }}</span>
					</div>
					<div class="date-arrow">→</div>
					<div class="date-item">
						<span class="date-dot end"></span>
						<span class="date-val">{{ selectionEnd }}</span>
					</div>
					<div class="day-badge">
						{{ dayjs(selectionEnd).diff(dayjs(selectionStart), "day") + 1 }}天
					</div>
				</div>

				<!-- B2. 计算公式预览 (简化版: 两块) -->
				<div class="formula-row-simple">
					<!-- 第一块: 系统建议 / 系数销量 (动态切换) -->
					<transition name="sales-toggle" mode="out-in">
						<div v-if="manualCoefficient === 1.0" class="value-block base" key="base">
							<span class="block-label">系统建议</span>
							<el-input-number
								v-model="expectedDemandInput as number | undefined"
								:controls="false"
								:min="0"
								:precision="0"
								size="small"
								class="block-input"
							/>
						</div>
						<div v-else class="value-block final" key="final">
							<span class="block-label">系数销量</span>
							<span class="block-value">{{
								Math.round((expectedDemandInput || 0) * manualCoefficient)
							}}</span>
						</div>
					</transition>
					<!-- 第二块: ×系数 -->
					<div class="coef-block">
						<span class="coef-sign">×</span>
						<el-input-number
							v-model="manualCoefficient"
							:controls="false"
							:min="0.1"
							:max="5"
							:step="0.1"
							:precision="1"
							size="small"
							class="coef-input"
						/>
					</div>
				</div>

				<!-- B3. 工具图标行 -->
				<div class="tool-row">
					<!-- 明细 Popover (增强版 + 5个月窗口) -->
					<el-popover
						placement="bottom-start"
						:width="340"
						trigger="click"
						popper-class="mini-detail-popover-enhanced"
						:teleported="false"
					>
						<template #reference>
							<span class="tool-icon" title="查看计算明细" @click.stop>📊</span>
						</template>
						<div class="detail-enhanced">
							<!-- Tab 切换 -->
							<div class="detail-tab-row">
								<span
									class="detail-tab"
									:class="{ active: detailTabMode === 'selection' }"
									@click="detailTabMode = 'selection'"
									>用户选择</span
								>
								<span
									class="detail-tab"
									:class="{ active: detailTabMode === 'window' }"
									@click="detailTabMode = 'window'"
									>5个月窗口</span
								>
							</div>

							<!-- 用户选择明细 -->
							<template v-if="detailTabMode === 'selection'">
								<div class="detail-info">
									<div class="info-row">
										<span>当前算法</span>
										<span class="info-val">{{
											algoNames[algoSelection - 1]
										}}</span>
									</div>
									<div class="info-row">
										<span>基准日销</span>
										<span class="info-val">{{ baseDailyAvgSales }} 件/天</span>
									</div>
								</div>
								<table class="segment-table" v-if="currentSegments.length > 0">
									<thead>
										<tr>
											<th>月份</th>
											<th>系数</th>
											<th>日均</th>
											<th>天数</th>
											<th>小计</th>
										</tr>
									</thead>
									<tbody>
										<tr v-for="(seg, idx) in currentSegments" :key="idx">
											<td>{{ dayjs(seg.startDate).format("M月") }}</td>
											<td>{{ seg.coefficient.toFixed(2) }}</td>
											<td>{{ seg.dailyNeed }}</td>
											<td>{{ seg.days }}</td>
											<td class="subtotal">{{ seg.subtotal }}</td>
										</tr>
									</tbody>
									<tfoot>
										<tr>
											<td colspan="4" class="total-label">系统建议合计</td>
											<td class="total-val">
												{{ expectedDemandInput || 0 }}
											</td>
										</tr>
										<tr v-if="manualCoefficient !== 1">
											<td colspan="4" class="final-label">
												× {{ manualCoefficient }} = 最终
											</td>
											<td class="final-val">
												{{
													Math.round(
														(expectedDemandInput || 0) *
															manualCoefficient
													)
												}}
											</td>
										</tr>
									</tfoot>
								</table>
								<div v-else class="no-segment">请先选择日期区间</div>
							</template>

							<!-- 5个月窗口总览 -->
							<template v-else-if="detailTabMode === 'window'">
								<div class="window-summary">
									<div class="window-info">
										<span>窗口范围</span>
										<span class="info-val"
											>{{ windowCalculation.startMonth }} ~
											{{ windowCalculation.endMonth }}</span
										>
									</div>
									<div class="window-info">
										<span>基础日均</span>
										<span class="info-val">{{ baseDailyAvgSales }} 件/天</span>
									</div>
									<div class="window-info highlight">
										<span>窗口总需求</span>
										<span class="info-val primary"
											>{{
												Math.round(
													windowCalculation.total * manualCoefficient
												)
											}}
											件</span
										>
									</div>
								</div>
								<table
									class="segment-table"
									v-if="windowCalculation.segments.length > 0"
								>
									<thead>
										<tr>
											<th>月份</th>
											<th>天数</th>
											<th>系数</th>
											<th>日均</th>
											<th>小计</th>
										</tr>
									</thead>
									<tbody>
										<tr
											v-for="(seg, idx) in windowCalculation.segments"
											:key="idx"
											:class="{
												'current-month':
													seg.month === dayjs().format('YYYY-MM')
											}"
										>
											<td>{{ seg.monthName }}</td>
											<td>{{ seg.days }}</td>
											<td>{{ seg.coefficient.toFixed(2) }}</td>
											<td>{{ seg.daily_sales.toFixed(1) }}</td>
											<td class="subtotal">{{ seg.subtotal }}</td>
										</tr>
									</tbody>
									<tfoot>
										<tr>
											<td colspan="4" class="total-label">窗口合计</td>
											<td class="total-val">{{ windowCalculation.total }}</td>
										</tr>
										<tr v-if="manualCoefficient !== 1">
											<td colspan="4" class="final-label">
												× {{ manualCoefficient }} = 最终
											</td>
											<td class="final-val">
												{{
													Math.round(
														windowCalculation.total * manualCoefficient
													)
												}}
											</td>
										</tr>
									</tfoot>
								</table>
								<div v-else class="no-segment">暂无数据</div>
							</template>
						</div>
					</el-popover>

					<!-- 备注 Popover (增强版) -->
					<el-popover
						placement="bottom-start"
						:width="320"
						trigger="click"
						popper-class="mini-remark-popover-enhanced"
						:teleported="false"
					>
						<template #reference>
							<span
								class="tool-icon"
								:class="{ 'has-content': manualRemark }"
								title="编辑备注"
								@click.stop
							>
								📝<span v-if="manualRemark" class="remark-dot"></span>
							</span>
						</template>
						<div class="remark-enhanced">
							<div class="remark-header">
								<span class="header-icon">📝</span>
								<span class="header-title">备注信息</span>
							</div>
							<!-- 公式可视化 (像 Charts 组件一样) -->
							<div class="formula-visual">
								<div class="formula-box base">
									<div class="box-label">系统预计</div>
									<div class="box-value">{{ expectedDemandInput || 0 }}</div>
								</div>
								<span class="formula-op">×</span>
								<div class="formula-box coef">
									<div class="box-label">人工系数</div>
									<div class="box-value">{{ manualCoefficient }}</div>
								</div>
								<span class="formula-op">=</span>
								<div class="formula-box result">
									<div class="box-label">最终补货</div>
									<div class="box-value">
										{{
											Math.round(
												(expectedDemandInput || 0) * manualCoefficient
											)
										}}
									</div>
								</div>
							</div>
							<!-- 汇总信息 -->
							<div class="system-remark-preview">
								<div class="preview-content">
									{{ parsedSystemRemark?.summary || "选择日期后自动生成" }}
								</div>
							</div>
							<!-- 分段明细表格 -->
							<div class="segment-detail" v-if="currentSegments.length > 0">
								<table class="segment-table-mini">
									<thead>
										<tr>
											<th>开始</th>
											<th>结束</th>
											<th>天数</th>
											<th>系数</th>
											<th>日均</th>
											<th>算法</th>
											<th>小计</th>
										</tr>
									</thead>
									<tbody>
										<tr v-for="(seg, idx) in currentSegments" :key="idx">
											<td>{{ dayjs(seg.startDate).format("M/D") }}</td>
											<td>{{ dayjs(seg.endDate).format("M/D") }}</td>
											<td>{{ seg.days }}</td>
											<td>{{ seg.coefficient.toFixed(2) }}</td>
											<td>{{ seg.dailyNeed }}</td>
											<td>
												{{ seg.algorithm || algoNames[algoSelection - 1] }}
											</td>
											<td class="subtotal">{{ seg.subtotal }}</td>
										</tr>
									</tbody>
								</table>
							</div>
							<!-- 手动备注输入 -->
							<div class="manual-remark-section">
								<div class="section-label">手动备注</div>
								<el-input
									v-model="manualRemark"
									type="textarea"
									:rows="2"
									placeholder="输入备货或运营备注..."
									size="small"
									class="remark-input"
								/>
							</div>
						</div>
					</el-popover>

					<!-- 暂存历史 Popover -->
					<el-popover
						ref="historyPopoverRef"
						placement="bottom-start"
						:width="320"
						trigger="click"
						popper-class="mini-history-popover"
						:teleported="false"
						@show="onHistoryPopoverShow"
						@hide="onHistoryPopoverHide"
					>
						<template #reference>
							<span class="tool-icon" title="查看暂存历史" @click.stop>📋</span>
						</template>
						<div class="history-popover-content">
							<!-- 列表视图 -->
							<template v-if="!historyDetailRecord">
								<div class="history-header">
									<span class="header-icon">📋</span>
									<span class="header-title">暂存历史</span>
								</div>
								<div v-if="historyLoading" class="history-loading">加载中...</div>
								<div v-else-if="historyRecords.length === 0" class="history-empty">
									暂无暂存记录
								</div>
								<div v-else class="history-list">
									<div
										v-for="record in historyRecords"
										:key="record.id"
										class="history-record-item"
									>
										<div class="record-header">
											<span class="record-time">{{
												formatHistoryTime(record.createTime)
											}}</span>
											<el-tag
												size="small"
												:type="record.status === 0 ? 'primary' : 'info'"
												>{{ record.status_text }}</el-tag
											>
										</div>
										<div class="record-body">
											<span class="record-range">{{
												getHistoryDateRange(record)
											}}</span>
											<span class="record-qty"
												>{{ getHistoryQty(record) }} 件</span
											>
										</div>
										<div class="record-meta">
											<el-tag size="small" effect="plain">{{ getHistoryAlgo(record) }}</el-tag>
											<span class="record-coeff">人工系数 ×{{ getHistoryCoeff(record) }}</span>
										</div>
										<div class="record-actions">
											<el-button
												size="small"
												type="primary"
												link
												@click="restoreHistoryRecord(record)"
												>使用</el-button
											>
											<el-button
												size="small"
												type="info"
												link
												@click="showHistoryDetail(record)"
												>详情</el-button
											>
											<el-button
												size="small"
												type="danger"
												link
												@click="deleteHistoryRecord(record)"
												>删除</el-button
											>
										</div>
									</div>
								</div>
							</template>

							<!-- 详情视图 -->
							<template v-else>
								<div class="history-header">
									<span class="back-btn" @click="historyDetailRecord = null"
										>← 返回</span
									>
									<span class="header-title">暂存详情</span>
								</div>
								<div class="detail-inline">
									<div class="detail-summary-card">
										<div class="summary-qty">
											{{ getHistoryQty(historyDetailRecord) }}
										</div>
										<div class="summary-label">补货数量（件）</div>
										<div class="summary-range">
											{{ getHistoryDateRange(historyDetailRecord) }}（{{
												getHistoryDays(historyDetailRecord)
											}}天）
										</div>
									</div>
									<div class="detail-info-row">
										<span class="info-label">算法</span>
										<span class="info-value">{{
											getHistoryAlgo(historyDetailRecord)
										}}</span>
									</div>
									<div class="detail-info-row">
										<span class="info-label">系数</span>
										<span class="info-value"
											>×{{ getHistoryCoeff(historyDetailRecord) }}</span
										>
									</div>
									<div
										v-if="historyDetailRecord.manual_remark"
										class="detail-remark"
									>
										<span class="info-label">备注</span>
										<span class="info-value">{{
											historyDetailRecord.manual_remark
										}}</span>
									</div>
									<el-button
										type="primary"
										size="small"
										style="width: 100%; margin-top: 8px"
										@click="restoreHistoryRecord(historyDetailRecord)"
										>使用此记录</el-button
									>
								</div>
							</template>
						</div>
					</el-popover>
				</div>

				<!-- B4. 操作按钮 -->
				<div class="action-btns">
					<button class="act-btn cancel" @click="clearSelection">取消</button>
					<button class="act-btn save" @click="stageOrder">暂存</button>
					<button class="act-btn submit" @click="generateReplenishmentOrder">生成</button>
				</div>
			</div>
		</div>

		<!-- 无数据提示 -->
		<div v-else class="no-data-tip">
			<el-empty description="暂无日均销量数据" :image-size="60" style="padding: 10px 0" />
		</div>
	</div>

	<!-- 备注弹窗 (用于生成单据流程) -->
	<el-dialog v-model="remarkDialogVisible" title="填写备注" width="380px" :append-to-body="true">
		<div style="margin-bottom: 12px">
			<p style="font-size: 12px; color: #6b7280; margin-bottom: 8px">
				请输入本次采购的备注信息：
			</p>
			<el-input
				v-model="manualRemark"
				type="textarea"
				:rows="3"
				placeholder="输入备货或运营备注..."
			/>
		</div>
		<template #footer>
			<el-button @click="remarkDialogVisible = false">取消</el-button>
			<el-button type="primary" @click="handleRemarkConfirm">保存并继续</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useCool } from "/@/cool";
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart, LineChart } from "echarts/charts";
import {
	TitleComponent,
	TooltipComponent,
	LegendComponent,
	GridComponent
} from "echarts/components";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";

// 注册 ECharts 组件
use([
	CanvasRenderer,
	BarChart,
	LineChart,
	TitleComponent,
	TooltipComponent,
	LegendComponent,
	GridComponent
]);

dayjs.extend(isBetween);

const props = defineProps(["listing"]);
const { service } = useCool();

// ========== 数据状态 ==========
const loading = ref(false);
const monthlySales = ref<number[]>([]);
const monthlyInventory = ref<number[]>([]);
const monthlyRatio = ref<number[]>([]);
const allKeywords = ref<any[]>([]);
const last12Months = ref<string[]>([]);
const shipmentByMonth = ref<any>({});
const promotionsRaw = ref<any>({});
const baseDailyAvgSales = ref(0);

// ========== 日历系数数据（与 Charts 一致）==========
const calendarDataLoading = ref(false);
const calendarBaseMonth = ref("");
const calendarBaseSalesValue = ref(0);
const calendarBaseKeywordValue = ref(0);
const calendarCoefficients = ref<Record<string, any>>({});

// ========== 日历状态 ==========

// ========== 补货选择状态 ==========
const selectionStart = ref<string | null>(null);
const selectionEnd = ref<string | null>(null);

// ========= 里程碑计算 =========
const getMilestoneDay = (dateStr: string) => {
	if (!selectionStart.value) return false;
	const diff = dayjs(dateStr).diff(dayjs(selectionStart.value), "day") + 1;
	// 常见的备货周期节点
	if ([15, 30, 45, 60, 75, 90, 120, 150, 180].includes(diff)) {
		return diff;
	}
	return false;
};
const expectedDemandInput = ref<number | null>(null);
const algoSelection = ref(1);
const algoNames = ["日均单量", "历史销售", "搜索词趋势", "综合走势"];
const manualCoefficient = ref(1); // 人工系数

// --- α 权重设置（综合走势算法）---
const customAlpha = ref<number | undefined>(undefined);
const alphaPopoverVisible = ref(false);
const alphaInputValue = ref(0.7);

// α 月度系数明细（用于 tooltip 悬停展示）
const alphaMonthlyDetail = computed(() => {
	const data = calendarCoefficients.value;
	if (!data || Object.keys(data).length === 0) return [];
	const alpha = customAlpha.value;
	return Object.keys(data).sort().map(month => {
		const combined = data[month]?.combined;
		if (!combined || combined.coefficient === undefined) return null;
		const sc = combined.filled_sales_coefficient;
		const kc = combined.keyword_coefficient;
		let coeff = combined.coefficient;
		if (alpha !== undefined && sc !== undefined && kc !== undefined) {
			coeff = alpha * sc + (1 - alpha) * kc;
		}
		return {
			month: dayjs(month + '-01').format('M月'),
			coeff: coeff?.toFixed(2) || '-',
			sc: sc?.toFixed(2) || '-',
			kc: kc?.toFixed(2) || '-'
		};
	}).filter((x): x is { month: string; coeff: string; sc: string; kc: string } => x !== null);
});

// ========== 弹窗和交互状态 ==========
const remarkDialogVisible = ref(false);
const manualRemark = ref("");
const replenishmentDetailVisible = ref(false);
const detailTabMode = ref<"selection" | "window">("selection"); // 明细弹窗Tab切换

// ========== 5个月窗口计算（与 Charts calculate5MonthWindow 一致） ==========
const windowCalculation = computed(() => {
	const baseDailySales = baseDailyAvgSales.value || 0;
	const algorithm = algoSelection.value;

	if (baseDailySales === 0) {
		return {
			total: 0,
			segments: [],
			startMonth: "",
			endMonth: "",
			baseMonth: dayjs().format("YYYY-MM"),
			isValid: false,
			warning: "暂无日均销量数据"
		};
	}

	const today = dayjs();
	// 与 Charts 一致：上个月(-1) 到 后3个月(+3)，共5个月
	const startMonthDate = today.subtract(1, "month").startOf("month");

	const segments: any[] = [];

	let total = 0;

	// 逐月计算（共5个月：-1, 0, +1, +2, +3）
	for (let i = 0; i < 5; i++) {
		const m = startMonthDate.add(i, "month");
		const daysInMonth = m.daysInMonth();
		const coeffInfo = getMonthCoefficientWithFallback(m, algorithm);
		const roundedCoeff = Math.round(coeffInfo.coefficient * 100) / 100;
		const dailyNeed = Math.round(baseDailySales * roundedCoeff * 100) / 100;
		const subtotal = Math.round(daysInMonth * dailyNeed);

		// 与 Charts calculate5MonthWindow 完全一致的字段
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
		segments,
		total,
		startMonth: segments[0]?.monthName || "",
		endMonth: segments[segments.length - 1]?.monthName || "",
		baseMonth: today.format("YYYY-MM"),
		isValid: true,
		warning: null
	};
});

// ========== 暂存历史记录 ==========
const historyRecords = ref<any[]>([]);
const historyLoading = ref(false);
const historyDetailRecord = ref<any>(null); // 当前查看详情的记录
const historyPopoverRef = ref<any>(null); // 暂存历史 Popover 实例

// Popover 显示时加载数据
const onHistoryPopoverShow = () => {
	loadHistoryRecords();
};

// Popover 隐藏时重置详情视图
const onHistoryPopoverHide = () => {
	historyDetailRecord.value = null;
};

// 显示详情（切换到详情视图）
const showHistoryDetail = (record: any) => {
	historyDetailRecord.value = record;
};

// 加载历史记录
const loadHistoryRecords = async () => {
	if (!props.listing?.asin || !props.listing?.marketplace) return;

	historyLoading.value = true;
	try {
		const result = await (service.app as any).bsr_analysis_record_lingxing.getHistory({
			asin: props.listing.asin,
			marketplace: props.listing.marketplace,
			store_id: props.listing.store_id,
			msku: props.listing.msku
		});
		historyRecords.value = result || [];
	} catch (err) {
		console.error("加载历史记录失败:", err);
		historyRecords.value = [];
	} finally {
		historyLoading.value = false;
	}
};

// 格式化历史记录时间
const formatHistoryTime = (time: string) => {
	if (!time) return "N/A";
	return dayjs(time).format("MM-DD HH:mm");
};

// 获取历史记录日期范围
const getHistoryDateRange = (record: any) => {
	const sales = record.expected_sales;
	if (!sales) return "N/A";
	const start = sales.startDate || sales.start_date;
	const end = sales.endDate || sales.end_date;
	if (start && end) {
		return `${dayjs(start).format("M/D")} ~ ${dayjs(end).format("M/D")}`;
	}
	return "N/A";
};

// 获取历史记录数量
const getHistoryQty = (record: any) => {
	const sales = record.expected_sales;
	return sales?.finalQty || sales?.final_replenishment_qty || sales?.totalQty || "N/A";
};

// 获取历史记录天数
const getHistoryDays = (record: any) => {
	const sales = record.expected_sales;
	return sales?.totalDays || sales?.total_days || sales?.days || "-";
};

// 获取历史记录算法名称
const getHistoryAlgo = (record: any) => {
	const sales = record.expected_sales;
	const algoId = sales?.userSelectedAlgo || sales?.user_selected_algo_id || 1;
	return algoNames[algoId - 1] || "日均单量";
};

// 获取历史记录系数
const getHistoryCoeff = (record: any) => {
	const sales = record.expected_sales;
	const coeff = sales?.manualCoefficient || sales?.artificial_coefficient || 1.0;
	return typeof coeff === "number" ? coeff.toFixed(1) : coeff;
};

// 使用历史记录（复制数据到UI + 删除数据库记录）
const restoreHistoryRecord = async (record: any) => {
	const salesData = record.expected_sales;
	if (!salesData) {
		ElMessage.warning("该记录数据不完整，无法恢复");
		return;
	}

	// 复制数据到UI状态
	selectionStart.value = salesData.startDate || null;
	selectionEnd.value = salesData.endDate || null;
	expectedDemandInput.value = salesData.totalQty || salesData.systemQty || null;
	algoSelection.value = salesData.userSelectedAlgo || 1;
	manualCoefficient.value = salesData.manualCoefficient || 1.0;
	customAlpha.value = salesData.customAlpha !== undefined ? salesData.customAlpha : undefined;
	alphaInputValue.value = salesData.customAlpha !== undefined ? salesData.customAlpha : 0.7;
	manualRemark.value = record.manual_remark || "";

	// 清空 currentRecordId（这样后续暂存会创建新记录）
	currentRecordId.value = null;

	// 硬删除数据库中的暂存记录
	try {
		await service.app.bsr_analysis_record_lingxing.delete({ ids: [record.id] });
	} catch (err) {
		console.warn("删除暂存记录失败:", err);
	}

	// 关闭暂存历史 Popover
	historyPopoverRef.value?.hide?.();

	// 刷新历史列表
	await loadHistoryRecords();

	ElMessage.success("已恢复历史记录，暂存已删除");
};

// 单独删除暂存记录（不恢复数据）
const deleteHistoryRecord = async (record: any) => {
	try {
		await ElMessageBox.confirm(
			"确定删除该条暂存记录？此操作不可撤销。",
			"确认删除",
			{
				confirmButtonText: "删除",
				cancelButtonText: "取消",
				type: "warning",
				confirmButtonClass: "el-button--danger"
			}
		);
	} catch {
		return;
	}

	try {
		await service.app.bsr_analysis_record_lingxing.delete({ ids: [record.id] });
		ElMessage.success("删除成功");
		await loadHistoryRecords();
	} catch (err) {
		console.error("删除暂存记录失败:", err);
		ElMessage.error("删除失败");
	}
};

// ========== 数据加载 ==========
const loadMiniData = async () => {
	if (!props.listing?.product_code) {
		console.warn("缺少 product_code");
		return;
	}

	loading.value = true;
	try {
		// 并行加载三个数据源
		const [salesRes, keywordsRes, promotionsRes] = await Promise.all([
			service.app.analysis.getData({
				product_code: props.listing.product_code,
				marketplace: props.listing.marketplace,
				asin: props.listing.asin,
				shop: props.listing.shop
			}),
			service.request({
				url: "/admin/app/analysis/getKeywords",
				method: "POST",
				data: {
					asin: props.listing.asin,
					marketplace: props.listing.marketplace,
					product_code: props.listing.product_code
				}
			}),
			service.request({
				url: "/admin/app/analysis/getPromotions",
				method: "POST",
				data: {
					product_code: props.listing.product_code,
					marketplace: props.listing.marketplace,
					asin: props.listing.asin
				}
			})
		]);

		// ===== 先生成时间轴（当前月往前12个月 = 13个月） =====
		const months: string[] = [];
		for (let i = 12; i >= 0; i--) {
			const d = dayjs().subtract(i, "month");
			months.push(d.format("YYYY-MM"));
		}
		last12Months.value = months;

		// ===== 精确按时间轴月份提取销量数据 =====
		const lastYear = salesRes.lastYear; // 2025
		const currentYear = salesRes.currentYear; // 2026
		const lastYearSales = salesRes.salesData.last.month; // [0, 12, 155, ...] 1-12月
		const currentYearSales = salesRes.salesData.current.month; // [64, 138, 0, ...] 1-12月

		monthlySales.value = months.map((monthStr) => {
			const [year, month] = monthStr.split("-").map(Number);
			const monthIndex = month - 1; // 数组是0-indexed
			if (year === lastYear) {
				return lastYearSales[monthIndex] || 0;
			} else if (year === currentYear) {
				return currentYearSales[monthIndex] || 0;
			}
			return 0;
		});

		// ===== 精确按时间轴月份提取库存数据 =====
		if (salesRes.inventoryData) {
			const lastYearInv = salesRes.inventoryData.last?.month || [];
			const currentYearInv = salesRes.inventoryData.current?.month || [];

			monthlyInventory.value = months.map((monthStr) => {
				const [year, month] = monthStr.split("-").map(Number);
				const monthIndex = month - 1;
				if (year === lastYear) {
					return lastYearInv[monthIndex] || 0;
				} else if (year === currentYear) {
					return currentYearInv[monthIndex] || 0;
				}
				return 0;
			});
		}

		// 计算库销比
		monthlyRatio.value = monthlyInventory.value.map((inv, i) => {
			const sales = monthlySales.value[i];
			if (!sales || sales === 0) return 0;
			return Math.round((inv / sales) * 100) / 100;
		});

		// ===== 精确按时间轴月份提取关键词数据 =====
		if (keywordsRes?.series) {
			const keywordXAxis = keywordsRes.xAxis || []; // API返回的时间轴
			allKeywords.value = keywordsRes.series;

			// 为每个关键词系列，重新映射数据到我们的时间轴
			allKeywords.value = keywordsRes.series.map((serie: any) => ({
				...serie,
				// 重新映射data数组，使其与我们的时间轴对齐
				alignedData: months.map((monthStr) => {
					const idx = keywordXAxis.indexOf(monthStr);
					return idx >= 0 ? serie.data?.[idx] || 0 : 0;
				})
			}));
		}

		// 处理货件和促销
		shipmentByMonth.value = salesRes.shipmentByMonth || {};
		promotionsRaw.value = promotionsRes?.promotions || {};

		// 计算日均销量（最近7天）
		baseDailyAvgSales.value = props.listing?.dailyAvgSales || 0;
	} catch (err) {
		console.error("加载迷你分析数据失败:", err);
		ElMessage.error("数据加载失败");
	} finally {
		loading.value = false;
	}
};

/**
 * 加载日历系数数据（与 Charts 组件一致）
 * 调用后端预计算的系数接口，用于更精确的算法2/3计算
 */
const loadCalendarData = async () => {
	if (!props.listing?.product_code) return;

	calendarDataLoading.value = true;
	try {
		// 计算请求的月份范围：当前月前1个月 ~ 当前月后6个月
		const startMonth = dayjs().subtract(1, "month").format("YYYY-MM");
		const endMonth = dayjs().add(6, "month").format("YYYY-MM");

		console.log(`[Mini日历系数] 请求范围: ${startMonth} ~ ${endMonth}`);

		const res = await service.request({
			url: "/admin/app/analysis/getCalendarData",
			method: "POST",
			data: {
				product_code: props.listing.product_code,
				asin: props.listing.asin,
				marketplace: props.listing.marketplace,
				startMonth,
				endMonth,
				listing_id: props.listing.id,
				msku: props.listing.msku,
				store_id: props.listing.store_id
			}
		});

		if (res) {
			console.log("[Mini日历系数] API返回:", res);
			calendarBaseMonth.value = res.base_month || "";
			calendarBaseSalesValue.value = res.base_sales_value || 0;
			calendarBaseKeywordValue.value = res.base_keyword_value || 0;
			calendarCoefficients.value = res.calendar_data || {};
			console.log(
				`[Mini日历系数] 已加载 ${Object.keys(calendarCoefficients.value).length} 个月份的系数`
			);
		}
	} catch (err) {
		console.error("[Mini日历系数] 加载失败:", err);
	} finally {
		calendarDataLoading.value = false;
	}
};

// ========== 手动刷新（只刷数据，不刷暂存状态） ==========
const refreshing = ref(false);
const refreshData = async () => {
	if (refreshing.value) return;
	refreshing.value = true;
	try {
		await Promise.all([
			loadMiniData(),
			loadCalendarData()
		]);
		ElMessage.success('数据已刷新');
	} catch (err) {
		console.error('[Mini刷新] 刷新失败:', err);
	} finally {
		refreshing.value = false;
	}
};

// ========== 懒加载逻辑（IntersectionObserver） ==========
const miniContainerRef = ref<HTMLElement | null>(null);
const dataLoaded = ref(false); // 标记是否已加载过数据
let visibilityObserver: IntersectionObserver | null = null;

// 统一的数据加载入口（只会被调用一次）
const loadAllData = async () => {
	if (dataLoaded.value) return; // 已加载过，不重复调用
	dataLoaded.value = true;

	console.log(`[Mini懒加载] 组件变为可见，开始加载数据: ${props.listing?.asin}`);

	// 并行加载三大数据源 + 日历系数
	loadMiniData();
	loadCalendarData();

	// 查询暂存记录
	try {
		const latestRecord = await (service.app as any).bsr_analysis_record_lingxing.latest({
			store_id: props.listing?.store_id,
			asin: props.listing?.asin,
			marketplace: props.listing?.marketplace,
			msku: props.listing?.msku
		});
		if (latestRecord && latestRecord.expected_sales) {
			currentRecordId.value = latestRecord.id;
			const salesData = latestRecord.expected_sales;
			selectionStart.value = salesData.startDate || null;
			selectionEnd.value = salesData.endDate || null;
			expectedDemandInput.value = salesData.totalQty || null;
			algoSelection.value = salesData.userSelectedAlgo || 1;
			manualCoefficient.value = salesData.manualCoefficient || 1.0;
			customAlpha.value = salesData.customAlpha !== undefined ? salesData.customAlpha : undefined;
			alphaInputValue.value = salesData.customAlpha !== undefined ? salesData.customAlpha : 0.7;
			manualRemark.value = latestRecord.manual_remark || "";
			ElMessage.info("已加载上次暂存的补货分析记录");
		}
	} catch (err) {
		console.warn("[Mini] 查询暂存记录失败:", err);
	}
};

onMounted(() => {
	// 不立即加载数据，而是等组件变为可见时才加载
	nextTick(() => {
		if (!miniContainerRef.value) return;

		visibilityObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting && !dataLoaded.value) {
						// 组件变为可见，触发数据加载
						loadAllData();
						// 加载后停止观察，不再需要了
						visibilityObserver?.disconnect();
						visibilityObserver = null;
					}
				}
			},
			{ threshold: 0.1 } // 只要 10% 可见就触发
		);

		visibilityObserver.observe(miniContainerRef.value);
	});
});

onUnmounted(() => {
	if (visibilityObserver) {
		visibilityObserver.disconnect();
		visibilityObserver = null;
	}
});

// ========== 聚合图表配置 ==========
const keywordMonthlyTotals = computed(() => {
	if (!allKeywords.value || allKeywords.value.length === 0) return [];

	// 使用 alignedData（已对齐的数据），如果没有则回退到原始 data
	const monthCount = last12Months.value.length || 13;
	const totals: number[] = [];

	for (let i = 0; i < monthCount; i++) {
		let monthSum = 0;
		for (const kw of allKeywords.value) {
			// 优先使用已对齐的数据
			const data = (kw as any).alignedData || kw.data || [];
			monthSum += data[i] || 0;
		}
		totals.push(monthSum);
	}
	return totals;
});

const miniChartOption = computed(() => {
	// ===== 归一化处理：让所有系列在0-1范围内显示，便于对比趋势 =====
	const salesData = monthlySales.value || [];
	const keywordData = keywordMonthlyTotals.value || [];
	const ratioData = monthlyRatio.value || [];

	// 计算各系列最大值
	const maxSales = Math.max(...salesData, 1); // 避免除以0
	const maxKeyword = Math.max(...keywordData, 1);
	const maxRatio = Math.max(...ratioData, 1);

	// 归一化函数
	const normalize = (data: number[], maxVal: number) =>
		data.map((v) => (maxVal > 0 ? v / maxVal : 0));

	// 归一化后的数据（用于图表显示）
	const normalizedSales = normalize(salesData, maxSales);
	const normalizedKeyword = normalize(keywordData, maxKeyword);
	const normalizedRatio = normalize(ratioData, maxRatio);

	return {
		title: {
			text: "趋势图（归一化）",
			textStyle: { fontSize: 11, fontWeight: "bold", color: "#374151" },
			top: 0,
			left: 0
		},
		tooltip: {
			trigger: "axis",
			axisPointer: { type: "line" },
			textStyle: { fontSize: 10 },
			confine: true,
			// 自定义 formatter 显示真实值
			formatter: (params: any) => {
				if (!params || params.length === 0) return "";
				const date = params[0].axisValue;
				let html = `<div style="font-size:11px;font-weight:500;margin-bottom:4px;">${date}</div>`;
				params.forEach((item: any) => {
					const idx = item.dataIndex;
					let realValue: number | string = 0;
					// 根据系列名获取对应的真实值
					if (item.seriesName === "竞品销量") {
						realValue = salesData[idx] ?? 0;
					} else if (item.seriesName === "搜索趋势") {
						realValue = keywordData[idx] ?? 0;
					} else if (item.seriesName === "库销比") {
						realValue = ratioData[idx]?.toFixed(2) ?? 0;
					}
					html += `<div style="display:flex;align-items:center;gap:4px;font-size:10px;">
						<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};"></span>
						<span>${item.seriesName}:</span>
						<span style="font-weight:500;">${realValue}</span>
					</div>`;
				});
				return html;
			}
		},
		legend: { show: false },
		grid: {
			top: 20,
			right: 5,
			bottom: 0,
			left: 5,
			containLabel: true
		},
		xAxis: {
			type: "category",
			data: last12Months.value,
			axisLabel: {
				rotate: 0,
				interval: 2,
				fontSize: 8,
				color: "#9ca3af",
				formatter: (v: string) => v.slice(5)
			},
			axisTick: { show: false },
			axisLine: { show: false }
		},
		yAxis: [
			{
				type: "value",
				min: 0,
				max: 1, // 归一化后范围固定为0-1
				show: false
			},
			{
				type: "value",
				min: 0,
				max: 1,
				show: false
			}
		],
		series: [
			{
				name: "竞品销量",
				type: "bar",
				data: normalizedSales, // 归一化数据
				itemStyle: { color: "#3b82f6" },
				barMaxWidth: 12
			},
			{
				name: "搜索趋势",
				type: "bar",
				data: normalizedKeyword, // 归一化数据
				itemStyle: { color: "#f59e0b" },
				barMaxWidth: 12
			},
			{
				name: "库销比",
				type: "line",
				yAxisIndex: 1,
				data: normalizedRatio, // 归一化数据
				itemStyle: { color: "#10b981" },
				lineStyle: { width: 1.5 },
				symbolSize: 4
			}
		]
	};
});

// ========== 日历控制逻辑 ==========
const calendarOffset = ref(0);

// 日历导航限制（与 Charts 组件保持一致）
// -1: 显示1月-2月（向前翻1次）
//  0: 显示2月-3月（初始状态）
//  1: 显示3月-4月（向后翻1次）
//  2: 显示4月-5月（向后翻2次）
const minMonthOffset = -1;
const maxMonthOffset = 2;

const calendarMonths = computed(() => {
	const current = dayjs().startOf("month");
	// 根据偏移量计算显示的两个月
	const m1 = current.add(calendarOffset.value, "month");
	const m2 = current.add(calendarOffset.value + 1, "month");
	return [m1, m2];
});

const currentYear = computed(() => calendarMonths.value[0].year());
const currentMonthRange = computed(() => {
	const m1 = calendarMonths.value[0].month() + 1;
	const m2 = calendarMonths.value[1].month() + 1;
	return `${m1}月 - ${m2}月`;
});

const isPrevMonthDisabled = computed(() => calendarOffset.value <= minMonthOffset);
const isNextMonthDisabled = computed(() => calendarOffset.value >= maxMonthOffset);

const moveMonth = (step: number) => {
	// 每次翻页移动1个月（与Charts一致）
	const newOffset = calendarOffset.value + step;
	if (newOffset < minMonthOffset || newOffset > maxMonthOffset) {
		return; // 超出范围不操作
	}
	calendarOffset.value = newOffset;
};

const navigateMonths = (step: number) => moveMonth(step);

// ========== 日历数据生成 ==========
const getShipmentsForDay = (dateStr: string) => {
	const monthKey = dayjs(dateStr).format("YYYY-MM");
	const monthData = shipmentByMonth.value[monthKey];
	if (!monthData?.details) return [];
	return monthData.details.filter((s: any) => {
		return dayjs(s.amazonSaleDate).format("YYYY-MM-DD") === dateStr;
	});
};

const getPromotionsForDay = (dateStr: string) => {
	const promos: any[] = [];
	// FIX: Use processed promotions (with short names) instead of raw data
	promotions.value.forEach((p: any) => {
		const start = dayjs(p.start);
		const end = dayjs(p.end);
		const current = dayjs(dateStr);
		if (current.isBetween(start, end, "day", "[]")) {
			promos.push(p);
		}
	});
	return promos;
};

const getMonthDays = (month: dayjs.Dayjs) => {
	const days: any[] = [];
	const firstDay = month.startOf("month");
	const lastDay = month.endOf("month");

	// day() 返回 0=周日, 1=周一, 2=周二... 6=周六
	// 我们的日历是周一开始，所以：
	// - 周一(1) -> 0个空格
	// - 周二(2) -> 1个空格
	// - 周日(0) -> 6个空格
	const dayOfWeek = firstDay.day(); // 0-6
	const emptySlots = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

	// 前置空格
	for (let i = 0; i < emptySlots; i++) {
		days.push({ dateStr: "", isCurrentMonth: false, day: "" });
	}

	// 当月日期
	for (let d = 1; d <= lastDay.date(); d++) {
		const dateObj = month.date(d);
		const dateStr = dateObj.format("YYYY-MM-DD");
		days.push({
			dateStr,
			isCurrentMonth: true,
			day: d,
			shipments: getShipmentsForDay(dateStr),
			promotions: getPromotionsForDay(dateStr)
		});
	}
	return days;
};

// ========== 库存状态计算 ==========

// 获取 FBA 当前库存
const currentFbaStock = computed(() => {
	const fbaList = props.listing?.restocking?.fbaValidList;
	if (!fbaList || !Array.isArray(fbaList)) return 0;
	return fbaList.reduce((sum: number, item: any) => {
		return sum + (item.quantity || 0);
	}, 0);
});

// 获取货件列表（从 shipmentByMonth 提取所有货件详情）
const shipments = computed(() => {
	const allShipments: any[] = [];
	Object.values(shipmentByMonth.value).forEach((monthData: any) => {
		if (monthData?.details && Array.isArray(monthData.details)) {
			allShipments.push(...monthData.details);
		}
	});
	return allShipments;
});

// 获取促销活动列表
// 获取促销活动列表
const promotions = computed(() => {
	// Helper to shorten names
	const getShortName = (name: string) => {
		if (!name) return "BD";
		const n = name.toLowerCase();
		if (n.includes("lightning")) return "Lightning Deal";
		if (n.includes("best")) return "Best Deal";
		if (n.includes("deal of day") || n.includes("dod")) return "Deal of Day";
		if (n.includes("prime")) return "Prime Exclusive";
		if (n.includes("coupon")) return "Coupon";
		return "Best Deal"; // Default fallback per user request
	};

	return Object.entries(promotionsRaw.value).map(([id, promo]: [string, any]) => ({
		id,
		name: getShortName(promo.type), // Logically shortened name
		start: promo.start,
		end: promo.end,
		status: promo.status,
		shop_name: promo.shop_name || `店铺${promo.store_id}`,
		asin: promo.asin
	}));
});

// ========== 核心算法逻辑 (Ported from ListingAnalysisCharts) ==========

// 历史销量数据 (去年同月的月销量，用于计算系数)
const lastYearMonthlySales = computed(() => {
	return monthlySales.value.slice(0, 12);
});

// 注意：getMonthCoefficient 函数已移到 getMonthCoefficientWithFallback 下方

// 计算某一天的库存状态（完整版：模拟每日消耗，响应算法切换）
const calculateStockStatus = (dateStr: string): "safe" | "warning" | "danger" | "none" => {
	const dailySales = baseDailyAvgSales.value;
	const algorithm = algoSelection.value || 1; // 响应 current algorithm

	if (dailySales === 0) return "none";

	const today = dayjs().startOf("day");
	const targetDate = dayjs(dateStr);
	const daysFromToday = targetDate.diff(today, "day");

	// 过去日期不计算
	if (daysFromToday < 0) return "none";

	// 从 FBA 当前库存开始模拟
	let stock = currentFbaStock.value;

	// 逐日模拟：从今天到目标日期前一天
	for (let i = 0; i < daysFromToday; i++) {
		const checkDate = today.add(i, "day");
		const checkDateStr = checkDate.format("YYYY-MM-DD");

		// 检查是否有货件到货（先加库存）
		shipments.value.forEach((s: any) => {
			if (s.amazonSaleDate === checkDateStr) {
				stock += s.quantity || 0;
			}
		});

		// 获取当天所在月份的系数
		const coefficient = getMonthCoefficient(checkDate, algorithm);
		// 当日消耗 = 基础日均销量 × 系数
		stock -= dailySales * coefficient;

		// 库存不能为负
		if (stock < 0) stock = 0;
	}

	// 目标日期当天货件到货
	shipments.value.forEach((s: any) => {
		if (s.amazonSaleDate === dateStr) {
			stock += s.quantity || 0;
		}
	});

	// 断货判断：库存≤0
	if (stock <= 0) return "danger";

	// 计算剩余可售天数 (应用目标日期的系数)
	const targetCoefficient = getMonthCoefficient(targetDate, algorithm);
	const effectiveDailySales = dailySales * targetCoefficient;

	if (effectiveDailySales <= 0) return "safe";
	const daysLeft = stock / effectiveDailySales;

	// ≥5天绿色，<5天黄色
	if (daysLeft >= 5) return "safe";
	return "warning";
};

// 获取日期格子的 CSS 类
const getDayCellClass = (day: any) => {
	if (!day.isCurrentMonth) return "empty-day";

	const classes: string[] = [];
	const dateObj = dayjs(day.dateStr);
	const today = dayjs().startOf("day");
	const isPast = dateObj.isBefore(today, "day");
	const isToday = dateObj.isSame(today, "day");

	if (isPast) classes.push("past-day");
	if (isToday) classes.push("today");

	// 计算库存状态（仅对今天及未来日期）
	if (!isPast) {
		const status = calculateStockStatus(day.dateStr);
		if (status !== "none") {
			classes.push(`stock-${status}`);
		}
	}

	if (day.shipments && day.shipments.length > 0) classes.push("has-shipment");
	if (day.promotions && day.promotions.length > 0) classes.push("has-promo");

	return classes.join(" ");
};

// ========== 日期选择逻辑 ==========
const handleDayClickForSelection = (day: any) => {
	if (baseDailyAvgSales.value === 0) {
		ElMessage.warning("暂无日均销量数据，无法选择日期");
		return;
	}
	if (!day.isCurrentMonth) return;

	const dateStr = day.dateStr;

	// 5个月窗口限制检查（与 Charts 一致）
	const selectedDate = dayjs(dateStr);
	const minDate = dayjs().subtract(1, "month").startOf("month"); // 上个月1号
	const maxDate = dayjs().add(3, "month").endOf("month"); // 后3月最后一天

	if (selectedDate.isBefore(minDate) || selectedDate.isAfter(maxDate)) {
		ElMessage.warning("只能选择上个月到后3个月范围内的日期");
		return;
	}

	if (!selectionStart.value || (selectionStart.value && selectionEnd.value)) {
		selectionStart.value = dateStr;
		selectionEnd.value = null;
		expectedDemandInput.value = null;
	} else {
		const start = dayjs(selectionStart.value);
		const end = dayjs(dateStr);

		if (end.isBefore(start)) {
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
	expectedDemandInput.value = null;
};

// 切换系数：点击时在1和1.2之间切换
const toggleCoefficient = () => {
	if (manualCoefficient.value === 1.0) {
		manualCoefficient.value = 1.2;
	} else {
		manualCoefficient.value = 1.0;
	}
};

// ========== 算法逻辑 ==========
// 算法数据可用性检测
const algoAvailability = computed(() => {
	// 与 Charts 一致：用 dayjs 动态计算去年同月，再 findIndex 查找
	const currentBaseMonthStr = dayjs().subtract(1, "year").format("YYYY-MM");
	const currentBaseIndex = last12Months.value.findIndex((m) => m === currentBaseMonthStr);

	// 算法1: 日均单量，始终可用
	const algo1Available = true;

	// 算法2: 历史销量 - 检查去年同月是否有数据
	const historyBase = currentBaseIndex >= 0 ? monthlySales.value[currentBaseIndex] : 0;
	const algo2Available =
		monthlySales.value.length > 0 && currentBaseIndex >= 0 && historyBase && historyBase > 0;

	// 算法3: 搜索词趋势 - 检查去年同月是否有数据
	const keywordBase = currentBaseIndex >= 0 ? keywordMonthlyTotals.value[currentBaseIndex] : 0;
	const algo3Available =
		keywordMonthlyTotals.value.length > 0 &&
		currentBaseIndex >= 0 &&
		keywordBase &&
		keywordBase > 0;

	// 算法4: 综合走势（后端已预计算combined字段，只要calendarCoefficients有数据就可用）
	const calData = calendarCoefficients.value;
	const algo4Available =
		calData &&
		Object.keys(calData).length > 0 &&
		Object.values(calData).some((d: any) => d.combined?.coefficient !== undefined);

	return [algo1Available, algo2Available, algo3Available, algo4Available];
});

const algoForecasts = computed(() => {
	if (!selectionStart.value || !selectionEnd.value || baseDailyAvgSales.value === 0) {
		return [0, 0, 0, 0];
	}

	const start = dayjs(selectionStart.value).startOf("day");
	const end = dayjs(selectionEnd.value).startOf("day");

	// 按月分段计算（与 Charts 的 calculateReplenishment 精度完全一致）
	const calcTotal = (algo: number) => {
		let total = 0;
		let current = start;

		while (current.isBefore(end) || current.isSame(end, "day")) {
			const monthEnd = current.endOf("month").startOf("day");
			const segEnd = monthEnd.isBefore(end) ? monthEnd : end;

			const segDays = segEnd.diff(current, "day") + 1;
			const coeffInfo = getMonthCoefficientWithFallback(current, algo);
			// 三重 round 与 Charts / calculateReplenishment 一致
			const roundedCoeff = Math.round(coeffInfo.coefficient * 100) / 100;
			const dailyNeed = Math.round(baseDailyAvgSales.value * roundedCoeff * 100) / 100;
			const subtotal = Math.round(segDays * dailyNeed);

			total += subtotal;
			current = segEnd.add(1, "day").startOf("day");
		}
		return total;
	};

	return [calcTotal(1), calcTotal(2), calcTotal(3), calcTotal(4)];
});

// 当日期选择完成后，自动填入当前算法的预测值
watch(algoForecasts, (newForecasts) => {
	if (selectionEnd.value && baseDailyAvgSales.value > 0) {
		const currentAlgoIndex = algoSelection.value - 1;
		// 只有当算法可用时才自动填入
		if (algoAvailability.value[currentAlgoIndex]) {
			expectedDemandInput.value = newForecasts[currentAlgoIndex];
		}
	}
});

const handleAlgoClick = async (index: number) => {
	if (baseDailyAvgSales.value === 0) {
		ElMessageBox.alert(
			"该产品目前暂无日均销量数据，系统无法生成库存预测。不过，您仍可以查看已有的活动和货件到货安排。",
			"查阅模式说明",
			{ confirmButtonText: "我知道了", type: "info" }
		);
		return;
	}
	// 综合走势已激活时，再次点击打开 α 设置面板
	if (index === 3 && algoSelection.value === 4) {
		alphaPopoverVisible.value = !alphaPopoverVisible.value;
		return;
	}
	// 切换到其他算法时关闭 α 设置面板
	alphaPopoverVisible.value = false;

	const algo = index + 1; // 1=日均单量, 2=历史销量, 3=搜索词趋势

	// 算法1：直接选中
	if (algo === 1) {
		algoSelection.value = algo;
		expectedDemandInput.value = algoForecasts.value[index];
		return;
	}

	// 检查算法2/3的数据是否可用
	let warningMessage = "";
	// 与 Charts 一致：动态计算去年同月索引
	const currentBaseMonthStr = dayjs().subtract(1, "year").format("YYYY-MM");
	const lastYearSameMonthIndex = last12Months.value.findIndex((m) => m === currentBaseMonthStr);

	if (algo === 2) {
		// 检查历史销量数据 - 使用时间轴第一个月(去年同期)
		const baseValue = monthlySales.value[lastYearSameMonthIndex];
		if (!monthlySales.value || monthlySales.value.length === 0) {
			warningMessage = '历史销量数据不足，是否切换为"日均单量"算法？';
		} else if (!baseValue || baseValue === 0) {
			warningMessage = '去年同期销量为0，无法计算系数。是否切换为"日均单量"算法？';
		}
	} else if (algo === 3) {
		// 检查搜索词数据 - 使用时间轴第一个月(去年同期)
		const baseValue = keywordMonthlyTotals.value[lastYearSameMonthIndex];
		if (!keywordMonthlyTotals.value || keywordMonthlyTotals.value.length === 0) {
			warningMessage = '搜索词数据不足，是否切换为"日均单量"算法？';
		} else if (!baseValue || baseValue === 0) {
			warningMessage = '去年同期搜索词数据为0，无法计算系数。是否切换为"日均单量"算法？';
		}
	} else if (algo === 4) {
		// 算法4: 综合走势（后端已预计算，检查calendarCoefficients是否有combined数据）
		const calData = calendarCoefficients.value;
		if (!calData || Object.keys(calData).length === 0) {
			warningMessage = '日历系数数据尚未加载，是否切换为"日均单量"算法？';
		} else if (!Object.values(calData).some((d: any) => d.combined?.coefficient !== undefined)) {
			warningMessage = '综合走势数据不可用，是否切换为"日均单量"算法？';
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
			expectedDemandInput.value = algoForecasts.value[0];
		} catch (e) {
			// 用户取消，保持原算法
		}
		return;
	}

	// 数据可用，正常选中
	algoSelection.value = algo;
	expectedDemandInput.value = algoForecasts.value[index];
};

// α 权重设置：重置为默认
const resetAlpha = () => {
	customAlpha.value = undefined;
	alphaInputValue.value = 0.7;
	alphaPopoverVisible.value = false;
};

// α 权重设置：应用自定义值
const applyAlpha = () => {
	customAlpha.value = alphaInputValue.value;
	alphaPopoverVisible.value = false;
};

// ========== 补货计算 (v3 增强版) ==========

// 获取系数并记录降级原因
interface CoefficientWithFallback {
	coefficient: number;
	algoUsed: number;
	fallbackReason: string | null;
}

/**
 * 获取月份在 last12Months 数组中的实际索引
 * @param monthStr - 月份字符串（如 "2025-02"）
 * @returns 索引值，找不到返回 -1
 */
const getMonthDataIndex = (monthStr: string): number => {
	if (!last12Months.value || last12Months.value.length === 0) return -1;
	return last12Months.value.findIndex((m) => m === monthStr);
};

/**
 * 获取某个月份的系数（带降级追踪）
 * 与 Charts 组件保持一致的逻辑：
 * - 优先使用 calendarCoefficients（后端预计算数据）
 * - 回退到前端计算逻辑
 */
const getMonthCoefficientWithFallback = (
	targetMonth: dayjs.Dayjs,
	algorithm: number
): CoefficientWithFallback => {
	// 算法1：日均单量，系数恒为1，无降级
	if (algorithm === 1) {
		return { coefficient: 1, algoUsed: 1, fallbackReason: null };
	}

	const targetMonthStr = targetMonth.format("YYYY-MM");

	// ========== 优先使用后端预计算的系数 ==========
	const calendarData = calendarCoefficients.value[targetMonthStr];
	if (calendarData) {
		if (algorithm === 2) {
			// 历史销量
			const salesData = calendarData.sales;
			if (salesData?.status === "ok" && salesData.coefficient !== undefined) {
				return {
					coefficient: salesData.coefficient,
					algoUsed: 2,
					fallbackReason: null
				};
			} else {
				return {
					coefficient: 1,
					algoUsed: 1,
					fallbackReason: salesData?.ref_month
						? `${salesData.ref_month}历史销量数据缺失`
						: "历史销量数据缺失"
				};
			}
		} else if (algorithm === 3) {
			// 搜索词趋势
			const keywordData = calendarData.keywords;
			if (keywordData?.status === "ok" && keywordData.coefficient !== undefined) {
				return {
					coefficient: keywordData.coefficient,
					algoUsed: 3,
					fallbackReason: null
				};
			} else {
				return {
					coefficient: 1,
					algoUsed: 1,
					fallbackReason: keywordData?.ref_month
						? `${keywordData.ref_month}搜索词数据缺失`
						: "搜索词数据缺失"
				};
			}
		} else if (algorithm === 4) {
			// 算法4: 综合走势
			const combinedData = calendarData.combined;
			if (combinedData && combinedData.coefficient !== undefined) {
				// 如果用户设置了自定义 α，用存储的子系数前端重算
				let coeff = combinedData.coefficient;
				if (customAlpha.value !== undefined
					&& combinedData.filled_sales_coefficient !== undefined
					&& combinedData.keyword_coefficient !== undefined) {
					coeff = customAlpha.value * combinedData.filled_sales_coefficient
						+ (1 - customAlpha.value) * combinedData.keyword_coefficient;
				}
				return {
					coefficient: coeff,
					algoUsed: 4,
					fallbackReason: null
				};
			} else {
				return {
					coefficient: 1,
					algoUsed: 1,
					fallbackReason: "综合走势数据缺失"
				};
			}
		}
	}

	// ========== 回退到前端计算逻辑（兼容旧数据）==========
	// 1. 确定基准月（分母）：当前真实时间的去年同月
	const currentBaseMonthStr = dayjs().subtract(1, "year").format("YYYY-MM");

	// 2. 确定目标月（分子）：目标时间的去年同月
	const targetMonthLastYearStr = targetMonth.subtract(1, "year").format("YYYY-MM");

	let data: number[] = [];
	let algoName = "";

	if (algorithm === 2) {
		data = monthlySales.value;
		algoName = "历史销量";
	} else if (algorithm === 3) {
		data = keywordMonthlyTotals.value;
		algoName = "搜索词";
	} else {
		return { coefficient: 1, algoUsed: 1, fallbackReason: "未知算法" };
	}

	if (!data || data.length === 0) {
		return { coefficient: 1, algoUsed: 1, fallbackReason: `${algoName}数据不足` };
	}

	// 使用 getMonthDataIndex 在时间轴中查找正确索引
	const baseIndex = getMonthDataIndex(currentBaseMonthStr);
	const targetIndex = getMonthDataIndex(targetMonthLastYearStr);

	if (baseIndex < 0) {
		return {
			coefficient: 1,
			algoUsed: 1,
			fallbackReason: `缺少基准月(${currentBaseMonthStr})`
		};
	}
	if (targetIndex < 0) {
		return {
			coefficient: 1,
			algoUsed: 1,
			fallbackReason: `缺少目标月(${targetMonthLastYearStr})`
		};
	}

	const baseValue = data[baseIndex];
	const targetValue = data[targetIndex];

	if (!baseValue || baseValue === 0) {
		const baseMonthName = dayjs(currentBaseMonthStr).format("M月");
		return {
			coefficient: 1,
			algoUsed: 1,
			fallbackReason: `基准月(${baseMonthName})${algoName}为0`
		};
	}
	if (targetValue === undefined || targetValue === null || targetValue === 0) {
		const targetMonthName = dayjs(targetMonthLastYearStr).format("M月");
		return { coefficient: 1, algoUsed: 1, fallbackReason: `${targetMonthName}${algoName}为0` };
	}

	return { coefficient: targetValue / baseValue, algoUsed: algorithm, fallbackReason: null };
};

/**
 * 获取某个月份的系数（简化版，不带降级追踪）
 * @param targetMonth - 目标日期
 * @param algorithm - 算法类型 (1=日均单量, 2=历史销量, 3=搜索词趋势)
 * @returns 系数值，默认为1
 */
const getMonthCoefficient = (targetMonth: dayjs.Dayjs, algorithm: number): number => {
	if (algorithm === 1) return 1;

	// 使用统一逻辑
	const { coefficient } = getMonthCoefficientWithFallback(targetMonth, algorithm);
	return coefficient;
};

// 分段计算补货量
interface ReplenishmentSegment {
	startDate: string;
	endDate: string;
	days: number;
	coefficient: number;
	dailyNeed: number;
	subtotal: number;
	algorithm: string;
	algoUsed: number;
	fallbackReason: string | null;
	segment_daily_sales: string;
	algo_used_name: string;
}

const calculateReplenishment = () => {
	if (!selectionStart.value || !selectionEnd.value) return { total: 0, segments: [] };

	const segments: ReplenishmentSegment[] = [];
	let current = dayjs(selectionStart.value).startOf("day");
	const end = dayjs(selectionEnd.value).startOf("day");
	let total = 0;

	while (current.isBefore(end) || current.isSame(end, "day")) {
		// 使用 startOf('day') 避免 endOf('month') 的 23:59:59.999 时间精度问题
		const monthEnd = current.endOf("month").startOf("day");
		const segEnd = monthEnd.isBefore(end) ? monthEnd : end;

		const days = segEnd.diff(current, "day") + 1;
		const coeffInfo = getMonthCoefficientWithFallback(current, algoSelection.value);
		// 与 Charts 一致：系数和日均都四舍五入到2位
		const roundedCoeff = Math.round(coeffInfo.coefficient * 100) / 100;
		const dailyNeed = Math.round(baseDailyAvgSales.value * roundedCoeff * 100) / 100;
		const subtotal = Math.round(days * dailyNeed);

		segments.push({
			startDate: current.format("YYYY-MM-DD"),
			endDate: segEnd.format("YYYY-MM-DD"),
			days,
			algorithm: algoNames[coeffInfo.algoUsed - 1] || "日均单量",
			coefficient: roundedCoeff,
			dailyNeed,
			subtotal,
			algoUsed: coeffInfo.algoUsed,
			fallbackReason: coeffInfo.fallbackReason,
			segment_daily_sales: (baseDailyAvgSales.value * roundedCoeff).toFixed(2),
			algo_used_name: algoNames[coeffInfo.algoUsed - 1] || "日均单量"
		});

		total += subtotal;
		current = segEnd.add(1, "day").startOf("day");
	}

	return { total, segments };
};

// 当前分段数据（用于 UI 表格显示）
const currentSegments = computed(() => {
	const { segments } = calculateReplenishment();
	return segments;
});

// 解析系统备注（用于 UI 预览）
const parsedSystemRemark = computed(() => {
	if (!generatedRemark.value) return null;
	try {
		return JSON.parse(generatedRemark.value);
	} catch {
		return null;
	}
});

// 生成 v5 JSON 备注 (与 ListingAnalysisCharts 一致)
const generatedRemark = computed(() => {
	if (!selectionStart.value || !selectionEnd.value || !expectedDemandInput.value) return "";

	const days = dayjs(selectionEnd.value).diff(dayjs(selectionStart.value), "day") + 1;
	const systemQty = expectedDemandInput.value;
	const finalQty = Math.round(systemQty * manualCoefficient.value);
	const daily = (finalQty / days).toFixed(1);
	const algoName = algoNames[(algoSelection.value || 1) - 1] || "未知算法";
	const { segments } = calculateReplenishment();

	// 生成分段明细（添加 segment_daily_sales 和 algo_used_name）
	const enrichedSegments = segments.map((seg) => ({
		...seg,
		segment_daily_sales: (baseDailyAvgSales.value * seg.coefficient).toFixed(2),
		algo_used_name: algoNames[seg.algoUsed - 1] || "日均"
	}));

	// 生成一行文本备注 (remark_text) - 用于传给领星API
	// 格式: 2026-01-01至02-24(55天) | 基础日均2.0 | 1月(31天):日均,系数1.00,日均2.00,62件 | 人工系数1.0 | 总计62件
	const startDateShort = selectionStart.value;
	const endDateShort = selectionEnd.value?.substring(5) || selectionEnd.value;
	const timeRange = `${startDateShort}至${endDateShort}(${days}天)`;
	const baseDaily = `基础日均${baseDailyAvgSales.value.toFixed(1)}`;

	const segmentTexts = enrichedSegments.map((seg) => {
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
	const remarkText = [timeRange, baseDaily, ...segmentTexts, manualCoeffText, totalText].join(
		" | "
	);

	const remarkData = {
		version: 5, // 升级版本号 (与 Charts 一致)
		// 新增：一行文本备注（用于传给领星API）
		remark_text: remarkText,

		// 人类直观描述
		summary: `采购 ${finalQty}个，销售时间 ${selectionStart.value} 至 ${selectionEnd.value}，计划日均 ${daily}单`,
		formula: `系统建议 (${systemQty}) × 人工系数 (${manualCoefficient.value.toFixed(1)}) = 最终补货 (${finalQty})`,

		// 显式字段
		system_suggested_qty: systemQty,
		artificial_coefficient: manualCoefficient.value,
		final_replenishment_qty: finalQty,

		base_daily_avg_sales: baseDailyAvgSales.value,
		user_selected_algo_id: algoSelection.value,
		user_selected_algo_name: algoName,
		custom_alpha: customAlpha.value,

		start_date: selectionStart.value,
		end_date: selectionEnd.value,
		total_days: days,

		// 兼容性
		manualCoefficient: manualCoefficient.value,
		systemQty: systemQty,
		finalQty: finalQty,

		breakdown: enrichedSegments,

		// 7. 5个月固定窗口计算（与 Charts 一致）
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

// ========== 暂存和生成 ==========
const remarkFromStageFlow = ref(false); // 标记备注弹窗是否来自暂存流程

const stageOrder = async () => {
	if (!expectedDemandInput.value) {
		ElMessage.warning("请先输入预计销量");
		return;
	}
	if (!selectionStart.value || !selectionEnd.value) {
		ElMessage.warning("请先选择时间区间");
		return;
	}

	// 如果没有备注，提示用户填写（与 Charts 一致）
	if (!manualRemark.value) {
		try {
			await ElMessageBox.confirm("是否需要填写备注？", "提示", {
				confirmButtonText: "填写备注",
				cancelButtonText: "跳过",
				type: "info"
			});
			remarkFromStageFlow.value = true;
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
				...remarkObj,
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
				userSelectedAlgo: remarkObj.user_selected_algo_id,
				customAlpha: remarkObj.custom_alpha
			},
			remark: generatedRemark.value,
			manual_remark: manualRemark.value
		});
		currentRecordId.value = result; // 保存返回的记录ID
		ElMessage.success("已成功暂存补货需求");
		// 重置UI状态，让用户明确看到保存已完成（与 Charts 一致）
		selectionStart.value = null;
		selectionEnd.value = null;
		expectedDemandInput.value = null;
		manualRemark.value = "";
		manualCoefficient.value = 1.0;
		customAlpha.value = undefined;
		alphaInputValue.value = 0.7;
		alphaPopoverVisible.value = false;
	} catch (err) {
		console.error("暂存失败:", err);
		ElMessage.error("暂存失败");
	}
};

// 创建中状态
const isCreatingPurchasePlan = ref(false);
const currentRecordId = ref<number | null>(null);
const remarkFromGenerateFlow = ref(false); // 标记备注弹窗是否来自生成单据流程

// 备注弹窗确认处理（支持暂存流程和生成单据流程）
const handleRemarkConfirm = () => {
	remarkDialogVisible.value = false;
	// 如果是从暂存流程触发的，自动继续暂存（与 Charts 一致，用 nextTick）
	if (remarkFromStageFlow.value) {
		remarkFromStageFlow.value = false;
		nextTick(() => {
			stageOrder();
		});
		return;
	}
	// 如果是从生成单据流程触发的，自动继续生成
	if (remarkFromGenerateFlow.value) {
		remarkFromGenerateFlow.value = false;
		nextTick(() => {
			generateReplenishmentOrder();
		});
	}
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
				fnsku: props.listing?.fnsku,
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
					userSelectedAlgo: remarkObj.user_selected_algo_id || null,
					customAlpha: remarkObj.custom_alpha
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
			// 清空备注和重置系数（与 Charts 一致）
			manualRemark.value = "";
			manualCoefficient.value = 1.0;
			customAlpha.value = undefined;
			alphaInputValue.value = 0.7;
			alphaPopoverVisible.value = false;
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

defineExpose({
	loadMiniData
});
</script>

<style scoped>
.mini-analysis-container {
	max-width: 480px;
	min-width: 360px;
	background: #ffffff;
	border-radius: 6px;
	position: relative;
	z-index: 1;
	/* 修复上下突出：移除内边距，内容自身控制 */
	padding: 0;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

/* 刷新按钮 */
.mini-refresh-bar {
	position: absolute;
	top: 4px;
	right: 6px;
	z-index: 10;
}
.refresh-btn {
	cursor: pointer;
	font-size: 14px;
	opacity: 0.4;
	transition: opacity 0.2s, transform 0.3s;
	display: inline-block;
	user-select: none;
}
.refresh-btn:hover {
	opacity: 0.9;
}
.refresh-btn.spinning {
	animation: spin-refresh 0.8s linear infinite;
	opacity: 0.7;
	pointer-events: none;
}
@keyframes spin-refresh {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}

/* 图表区域 */
.mini-chart-section {
	border-bottom: 1px solid #f3f4f6;
	padding-bottom: 4px; /* 极小间距 */
}

/* 日历区域 - 极简模式 */
.mini-calendar-section {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.calendar-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0;
	height: 24px; /* 强制压缩头部高度 */
}

.nav-btn {
	background: transparent;
	border: 1px solid #e5e7eb;
	border-radius: 4px;
	padding: 0;
	color: #6b7280;
	font-size: 10px;
	width: 20px;
	height: 20px;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	transition: all 0.2s;
}
.nav-btn:hover:not(:disabled) {
	color: #3b82f6;
	border-color: #3b82f6;
	background: #eff6ff;
}
.nav-btn:disabled {
	opacity: 0.3;
	cursor: not-allowed;
}

.header-center {
	display: flex;
	align-items: center;
	gap: 8px;
}

.calendar-title {
	font-weight: 600;
	font-size: 12px;
	color: #374151;
}

.inline-legend {
	display: flex;
	gap: 6px;
	font-size: 10px;
	color: #9ca3af;
}

.legend-item {
	display: flex;
	align-items: center;
	gap: 2px;
	white-space: nowrap;
}

.dot {
	width: 5px;
	height: 5px;
	border-radius: 50%;
}

.dot.safe {
	background-color: #10b981;
}
.dot.warning {
	background-color: #f59e0b;
}
.dot.danger {
	background-color: #ef4444;
}

/* 日历网格 - 紧凑但可读 */
.mini-calendar-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 6px;
}

.calendar-month {
	background: #f9fafb;
	border-radius: 4px;
	padding: 4px;
}

.month-title {
	text-align: center;
	font-weight: 600;
	font-size: 11px;
	margin-bottom: 2px;
	color: #374151;
}

.weekday-header {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 1px;
	margin-bottom: 2px;
	font-size: 9px;
	color: #9ca3af;
	text-align: center;
	height: 14px;
	line-height: 14px;
}

.days-grid {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 1px;
}

.day-cell {
	height: 22px;
	border-radius: 3px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	font-size: 10px;
	cursor: pointer;
	position: relative;
	transition: all 0.1s;
	background: #fff;
	border: 1px solid transparent;
}

.day-cell:hover {
	border-color: #3b82f6;
	background: #eff6ff;
	z-index: 2;
}

.day-cell.is-selected {
	background: linear-gradient(135deg, #93c5fd, #60a5fa) !important;
	border-color: #2563eb !important;
	border-width: 2px !important;
	box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3) !important;
}
.day-cell.is-selected .day-number {
	color: #1e40af !important;
	font-weight: 700;
}

.day-cell.stock-safe {
	background-color: #d1fae5;
}
.day-cell.stock-warning {
	background-color: #fed7aa;
}
.day-cell.stock-danger {
	background-color: #fecaca;
}
.day-cell.stock-none {
	background-color: #f9fafb;
}

/* 今天高亮 - 改为绿色 (避免与黄色警告冲突) */
.day-cell.today {
	border-color: #10b981 !important;
	border-width: 2px;
	font-weight: bold;
}
.day-cell.today .day-number {
	color: #059669;
}

/* 过去日期灰化 - FIX transparency issue */
.day-cell.past-day {
	/* opacity: 0.5; REMOVED to fix tooltip transparency */
	background-color: #f9fafb;
	color: #d1d5db;
	cursor: default;
	border: 1px solid #e5e7eb; /* 添加边框显示格子 */
}
.day-cell.past-day .day-number {
	color: #9ca3af;
}
.day-cell.past-day .day-icon {
	opacity: 0.6; /* Dim the icons themselves, so the teleported=false tooltip keeps full opacity */
}

/* 空白日期 */
.day-cell.empty-day {
	background: transparent;
	cursor: default;
	border: 1px solid #f3f4f6; /* 浅边框 */
}

.day-number {
	font-weight: 600;
	color: #1f2937;
}

.day-icons-wrap {
	display: flex;
	gap: 2px;
	font-size: 10px;
}

.day-icon {
	font-size: 10px;
}

/* ========== 高级动态底栏样式 (Compact Version) ========== */
.mini-control-section {
	border-top: 1px solid #f3f4f6;
	padding: 8px 10px; /* 减小内边距 */
	background: #fff;
	display: flex;
	flex-direction: column;
	gap: 6px; /* 减小间距 */
}

/* A. 算法矩阵容器 */
.algo-matrix-container {
	display: flex;
	gap: 6px;
	transition: all 0.3s ease;
	justify-content: space-between;
}

/* 卡片样式 - 均匀分布 */
.matrix-card {
	flex: 1;
	border: 1px solid #e5e7eb;
	border-radius: 4px;
	padding: 4px 6px;
	cursor: pointer;
	transition: all 0.2s;
	background: #ffffff;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	min-width: 0; /* 允许收缩 */
}

/* 仅显示算法时的紧凑模式 */
.algo-matrix-container.algo-only-mode .matrix-card {
	height: 32px;
	flex-direction: row;
	gap: 6px;
}

.matrix-card:hover {
	border-color: #93c5fd;
	background: #f0f9ff;
	transform: translateY(-1px);
}

.matrix-card.is-active {
	border-color: #3b82f6;
	background: linear-gradient(135deg, #3b82f6, #2563eb);
	box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
}

.card-inner {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0px; /* 移除间距 */
	width: 100%;
}

.m-label {
	font-size: 10px; /* 缩小字体 */
	color: #6b7280;
	font-weight: 500;
}
.matrix-card.is-active .m-label {
	color: rgba(255, 255, 255, 0.9);
	font-weight: 600;
}

.m-val {
	font-size: 12px; /* 缩小字体 */
	font-weight: 700;
	color: #1f2937;
	font-family: "Inter", sans-serif;
	line-height: 1.2;
}
.matrix-card.is-active .m-val {
	color: #fff;
	font-weight: 800;
}

/* 禁用状态 - 数据不足时 */
.matrix-card.is-disabled {
	background: #f9fafb;
	border-color: #e5e7eb;
	opacity: 0.6;
	cursor: not-allowed;
}
.matrix-card.is-disabled:hover {
	transform: none;
	background: #f9fafb;
	border-color: #e5e7eb;
}
.matrix-card.is-disabled .m-label {
	color: #9ca3af;
}
.m-val.disabled-val {
	font-size: 9px;
	color: #ef4444;
	font-weight: 500;
}

/* α 角标 */
.alpha-tag {
	display: inline-block;
	background: rgba(47, 84, 235, 0.15);
	color: #2f54eb;
	font-size: 8px;
	font-weight: 700;
	padding: 1px 3px;
	border-radius: 3px;
	margin-left: 3px;
	vertical-align: middle;
	line-height: 1.2;
}
.matrix-card.is-active .alpha-tag {
	background: rgba(255, 255, 255, 0.25);
	color: #fff;
}
.alpha-gear {
	display: inline-block;
	font-size: 10px;
	margin-left: 2px;
	opacity: 0.6;
	vertical-align: middle;
	animation: alpha-pulse 2s ease-in-out infinite;
}
.matrix-card.is-active .alpha-gear {
	color: rgba(255, 255, 255, 0.7);
	opacity: 1;
}
@keyframes alpha-pulse {
	0%, 100% { opacity: 0.5; }
	50% { opacity: 1; }
}
.has-custom-alpha.is-active {
	background: linear-gradient(135deg, #2f54eb 0%, #722ed1 100%) !important;
	border-color: #722ed1 !important;
}

/* α 设置面板 */
.alpha-config-panel { padding: 4px 0; }
.alpha-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.alpha-title { font-size: 14px; font-weight: 700; color: #303133; }
.alpha-slider-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.alpha-range-labels { display: flex; justify-content: space-between; font-size: 11px; color: #909399; margin-bottom: 12px; }
.alpha-actions { display: flex; justify-content: flex-end; gap: 8px; }

/* B. 行动中心 (增强版) */
.action-center {
	display: flex;
	flex-direction: column;
	gap: 6px;
	background: linear-gradient(to bottom, #f8fafc, #f1f5f9);
	border-radius: 6px;
	padding: 8px 10px;
	border: 1px solid #e2e8f0;
}

/* B1. 日期看板 */
.date-panel {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 11px;
}
.date-item {
	display: flex;
	align-items: center;
	gap: 3px;
}
.date-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
}
.date-dot.start {
	background: #10b981;
}
.date-dot.end {
	background: #f59e0b;
}
.date-val {
	color: #374151;
	font-weight: 500;
	font-family: "Inter", monospace;
}
.date-arrow {
	color: #9ca3af;
	font-size: 10px;
}
.day-badge {
	background: linear-gradient(135deg, #3b82f6, #2563eb);
	color: #fff;
	font-size: 10px;
	font-weight: 700;
	padding: 2px 6px;
	border-radius: 10px;
	margin-left: auto;
}

/* B2. 简化版公式行 (两块布局) */
.formula-row-simple {
	display: flex;
	align-items: stretch;
	gap: 8px;
	background: #fff;
	padding: 6px 10px;
	border-radius: 6px;
	border: 1px solid #e5e7eb;
}

/* 第一块: 系统建议/系数销量 */
.value-block {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 4px 10px;
	border-radius: 6px;
	border: 1px solid;
	flex: 1;
}
.value-block.base {
	border-color: #bfdbfe;
	background: #eff6ff;
}
.value-block.final {
	border-color: #bbf7d0;
	background: #f0fdf4;
}
.block-label {
	font-size: 10px;
	color: #6b7280;
	font-weight: 500;
	white-space: nowrap;
}
.value-block.final .block-label {
	color: #059669;
}
.block-input {
	width: auto !important;
	min-width: 50px !important;
	flex: 1;
}
:deep(.block-input .el-input__inner) {
	height: 22px;
	line-height: 22px;
	padding: 0 4px;
	text-align: center;
	font-weight: 700;
	font-size: 14px;
	color: #2563eb;
	background: transparent;
	border: none;
}
:deep(.block-input .el-input__wrapper) {
	padding: 0 !important;
	box-shadow: none !important;
}
.block-value {
	font-size: 15px;
	font-weight: 800;
	color: #059669;
	font-family: "Inter", sans-serif;
}

/* 第二块: ×系数 */
.coef-block {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 4px 8px;
	border-radius: 6px;
	border: 1px solid #ddd6fe;
	background: #faf5ff;
}
.coef-sign {
	font-size: 12px;
	color: #7c3aed;
	font-weight: 700;
}

/* 切换动画 */
.sales-toggle-enter-active,
.sales-toggle-leave-active {
	transition: all 0.3s ease;
}
.sales-toggle-enter-from {
	opacity: 0;
	transform: scale(0.9);
}
.sales-toggle-leave-to {
	opacity: 0;
	transform: scale(0.9);
}
.f-label {
	font-size: 10px;
	color: #6b7280;
	font-weight: 500;
	white-space: nowrap;
}
.f-val {
	font-size: 14px;
	font-weight: 700;
	color: #3b82f6;
	font-family: "Inter", sans-serif;
	min-width: 0;
	flex-shrink: 0;
}
.f-op,
.f-eq {
	font-size: 12px;
	color: #9ca3af;
	font-weight: 700;
}
.demand-input {
	min-width: 50px !important;
	max-width: 90px !important;
	width: auto !important;
}
:deep(.demand-input .el-input__inner) {
	height: 22px;
	line-height: 22px;
	padding: 0 4px;
	text-align: center;
	font-weight: 700;
	font-size: 11px;
	color: #2563eb;
	background: #eff6ff;
	border-color: #bfdbfe;
}
.coef-input {
	width: auto !important;
	min-width: 35px !important;
}
:deep(.coef-input .el-input__inner) {
	height: 22px;
	line-height: 22px;
	padding: 0 4px;
	text-align: center;
	font-weight: 700;
	font-size: 12px;
	color: #7c3aed;
	background: transparent;
	border: none;
}
:deep(.coef-input .el-input__wrapper) {
	padding: 0 !important;
	box-shadow: none !important;
}
.f-final {
	font-size: 14px;
	font-weight: 800;
	color: #059669;
	font-family: "Inter", sans-serif;
}

/* 系数公式容器 */
.coef-formula {
	display: flex;
	align-items: center;
	gap: 4px;
}

/* 系数切换按钮 */
.coef-toggle {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 24px;
	height: 20px;
	padding: 0 6px;
	font-size: 10px;
	font-weight: 600;
	color: #7c3aed;
	background: #f5f3ff;
	border: 1px solid #ddd6fe;
	border-radius: 10px;
	cursor: pointer;
	transition: all 0.2s;
}
.coef-toggle:hover {
	background: #ede9fe;
	border-color: #c4b5fd;
}

/* 系数过渡动画 */
.coef-fade-enter-active,
.coef-fade-leave-active {
	transition: all 0.3s ease;
}
.coef-fade-enter-from,
.coef-fade-leave-to {
	opacity: 0;
	transform: translateX(-10px);
}

/* B3. 工具图标行 */
.tool-row {
	display: flex;
	align-items: center;
	gap: 10px;
	justify-content: center;
}
.tool-icon {
	font-size: 16px;
	cursor: pointer;
	transition: transform 0.2s;
	position: relative;
}
.tool-icon:hover {
	transform: scale(1.15);
}
.tool-icon.has-content::after {
	content: "";
	position: absolute;
	top: -2px;
	right: -2px;
	width: 6px;
	height: 6px;
	background: #ef4444;
	border-radius: 50%;
	border: 1px solid #fff;
}
.remark-dot {
	position: absolute;
	top: -2px;
	right: -2px;
	width: 5px;
	height: 5px;
	background: #ef4444;
	border-radius: 50%;
}

.input-box {
	display: flex;
	align-items: center;
	gap: 6px;
}

.box-label {
	font-size: 10px;
	color: #64748b;
	font-weight: 600;
}

.box-input {
	width: 70px !important;
}
.coef-input {
	width: 45px !important;
}
.box-sep {
	font-size: 12px;
	color: #94a3b8;
	font-weight: 700;
	margin: 0 2px;
}
.box-final {
	font-size: 11px;
	color: #059669;
	font-weight: 700;
	margin-left: 4px;
	white-space: nowrap;
}
/* 深度选择器修改 Element 输入框样式 */
:deep(.box-input .el-input__inner) {
	height: 22px; /* 更矮 */
	line-height: 22px;
	padding: 0 4px;
	text-align: center;
	font-weight: 600;
	font-size: 12px;
	color: #0f172a;
	background: #fff;
	border-color: #cbd5e1;
}

.box-icon {
	font-size: 13px;
	cursor: pointer;
	transition: transform 0.2s;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
}
.box-icon:hover {
	transform: scale(1.1);
}
.remark-icon {
	margin-left: 2px;
}
.detail-icon {
	margin-left: 0;
	filter: grayscale(1);
	opacity: 0.6;
}
.detail-icon:hover {
	filter: none;
	opacity: 1;
}

.remark-dot {
	position: absolute;
	top: -1px;
	right: -2px;
	width: 4px;
	height: 4px;
	background: #ef4444;
	border-radius: 50%;
	border: 1px solid #fff;
}
.remark-icon.has-content {
	opacity: 1;
}

.action-btns {
	display: flex;
	gap: 8px;
	justify-content: space-between;
	width: 100%;
}

.act-btn {
	flex: 1;
	border: none;
	border-radius: 4px;
	padding: 5px 8px;
	font-size: 11px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s;
	text-align: center;
}

.act-btn.cancel {
	background: #f9fafb;
	border: 1px solid #d1d5db;
	color: #6b7280;
}
.act-btn.cancel:hover {
	background: #f3f4f6;
	color: #374151;
	border-color: #9ca3af;
}

.act-btn.save {
	background: linear-gradient(135deg, #3b82f6, #2563eb);
	color: #fff;
	box-shadow: 0 1px 3px rgba(59, 130, 246, 0.3);
}
.act-btn.save:hover {
	background: linear-gradient(135deg, #2563eb, #1d4ed8);
	box-shadow: 0 2px 6px rgba(59, 130, 246, 0.4);
}

.act-btn.submit {
	background: linear-gradient(135deg, #10b981, #059669);
	color: #fff;
	box-shadow: 0 1px 3px rgba(16, 185, 129, 0.3);
}
.act-btn.submit:hover {
	background: linear-gradient(135deg, #059669, #047857);
	box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
}

.no-data-tip {
	padding: 0;
	display: flex;
	justify-content: center;
	align-items: center;
}

/* 备注 Popover 内部样式 */
.remark-popover-content {
	padding: 4px;
}
.pop-header {
	margin-bottom: 8px;
	border-bottom: 1px dashed #e5e7eb;
	padding-bottom: 4px;
}
.pop-title {
	font-size: 13px;
	font-weight: 700;
	color: #374151;
}
.remark-input :deep(.el-textarea__inner) {
	border-color: #e5e7eb;
	font-size: 12px;
	padding: 6px;
	border-radius: 4px;
}
.remark-input :deep(.el-textarea__inner):focus {
	border-color: #3b82f6;
	box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1);
}

/* 明细 Popover 内部样式 */
.detail-popover-content {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.detail-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 12px;
}
.detail-row .label {
	color: #64748b;
	font-weight: 500;
}
.detail-row .val {
	color: #1e293b;
	font-weight: 600;
	font-family: "Inter", sans-serif;
}

/* 增强版明细弹窗样式 */
.detail-enhanced {
	padding: 0;
	overflow: hidden;
	border-radius: 8px;
}
.detail-header {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 10px 12px;
	background: linear-gradient(135deg, #3b82f6, #2563eb);
	border-radius: 8px 8px 0 0;
}
.detail-header .header-icon {
	font-size: 14px;
	filter: grayscale(1) brightness(10);
}
.detail-header .header-title {
	font-size: 12px;
	font-weight: 700;
	color: #fff;
}
.remark-header {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 10px 12px;
	background: linear-gradient(135deg, #f59e0b, #d97706);
	border-radius: 8px 8px 0 0;
}
.remark-header .header-icon {
	font-size: 14px;
	filter: grayscale(1) brightness(10);
}
.remark-header .header-title {
	font-size: 12px;
	font-weight: 700;
	color: #fff;
}
.detail-info {
	padding: 8px 10px;
	background: #fafafa;
}
.info-row {
	display: flex;
	justify-content: space-between;
	font-size: 11px;
	color: #6b7280;
	margin-bottom: 4px;
}
.info-row:last-child {
	margin-bottom: 0;
}
.info-val {
	font-weight: 600;
	color: #374151;
}
.segment-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 10px;
}
.segment-table th {
	background: #f1f5f9;
	color: #64748b;
	font-weight: 600;
	padding: 6px 8px;
	text-align: center;
	border-bottom: 1px solid #e5e7eb;
}
.segment-table td {
	padding: 5px 8px;
	text-align: center;
	border-bottom: 1px solid #f1f5f9;
	color: #374151;
}
.segment-table tbody tr:hover {
	background: #f8fafc;
}
.segment-table .subtotal {
	font-weight: 700;
	color: #3b82f6;
}
.segment-table tfoot td {
	border-top: 1px solid #e5e7eb;
	font-weight: 600;
}
.total-label,
.final-label {
	text-align: right !important;
	color: #6b7280;
}
.total-val {
	color: #3b82f6;
	font-weight: 700;
}
.final-val {
	color: #059669;
	font-weight: 800;
	font-size: 11px;
}
.no-segment {
	padding: 20px;
	text-align: center;
	color: #9ca3af;
	font-size: 11px;
}

/* 增强版备注弹窗样式 */
.remark-enhanced {
	padding: 0;
	overflow: hidden;
	border-radius: 8px;
}
.system-remark-preview {
	padding: 10px;
	background: #fefce8;
	border-bottom: 1px solid #fef08a;
}
.preview-label {
	font-size: 9px;
	color: #a16207;
	font-weight: 600;
	margin-bottom: 4px;
}
.preview-content {
	font-size: 11px;
	color: #713f12;
	line-height: 1.4;
}
.preview-formula {
	font-size: 10px;
	color: #92400e;
	font-family: "Inter", monospace;
	background: rgba(251, 191, 36, 0.2);
	padding: 4px 6px;
	border-radius: 4px;
	margin-top: 6px;
}

/* 公式可视化 (三卡片) */
.formula-visual {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	padding: 10px;
	background: linear-gradient(to bottom, #f8fafc, #fff);
	border-bottom: 1px solid #e5e7eb;
}
.formula-box {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 6px 12px;
	border-radius: 6px;
	border: 1px solid;
}
.formula-box.base {
	border-color: #bfdbfe;
	background: #eff6ff;
}
.formula-box.base .box-value {
	color: #2563eb;
}
.formula-box.coef {
	border-color: #ddd6fe;
	background: #faf5ff;
}
.formula-box.coef .box-value {
	color: #7c3aed;
}
.formula-box.result {
	border-color: #bbf7d0;
	background: #f0fdf4;
}
.formula-box.result .box-value {
	color: #059669;
}
.box-label {
	font-size: 9px;
	color: #6b7280;
	margin-bottom: 2px;
}
.box-value {
	font-size: 16px;
	font-weight: 800;
	font-family: "Inter", sans-serif;
}
.formula-op {
	font-size: 14px;
	font-weight: 700;
	color: #9ca3af;
}

/* 分段明细表格 (mini版) */
.segment-detail {
	max-height: 150px;
	overflow-y: auto;
	border-bottom: 1px solid #e5e7eb;
}
.segment-table-mini {
	width: 100%;
	border-collapse: collapse;
	font-size: 10px;
}
.segment-table-mini th {
	background: #f1f5f9;
	color: #64748b;
	font-weight: 600;
	padding: 5px 6px;
	text-align: center;
	border-bottom: 1px solid #e5e7eb;
	position: sticky;
	top: 0;
}
.segment-table-mini td {
	padding: 4px 6px;
	text-align: center;
	border-bottom: 1px solid #f1f5f9;
	color: #374151;
}
.segment-table-mini .subtotal {
	font-weight: 700;
	color: #3b82f6;
}

.manual-remark-section {
	padding: 10px;
}
.section-label {
	font-size: 10px;
	color: #6b7280;
	font-weight: 600;
	margin-bottom: 6px;
}

/* Rich Tooltip Styles (Premium Dark Theme - Ultra Compact) */
.mini-rich-tooltip {
	padding: 0 !important;
	border: none !important;
	background: rgba(15, 23, 42, 0.95) !important; /* Slate 900 */
	backdrop-filter: blur(12px) !important;
	box-shadow:
		0 8px 20px -5px rgba(0, 0, 0, 0.3),
		0 6px 8px -6px rgba(0, 0, 0, 0.3) !important;
	border-radius: 6px !important;
	color: #fff !important;
	border: 1px solid rgba(255, 255, 255, 0.1) !important;
	/* FIX: Force opacity to 1 to override any parent transparency (e.g. past-day) */
	opacity: 1 !important;
}

.shipment-tooltip-content,
.promo-tooltip-content {
	/* Auto width to remove empty space */
	width: max-content;
	min-width: 160px;
	max-width: 240px;
	padding: 0;
}

.tooltip-header-row {
	display: flex;
	align-items: center;
	padding: 6px 10px; /* Ultra-Compact */
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	background: linear-gradient(to right, rgba(255, 255, 255, 0.05), transparent);
	border-radius: 6px 6px 0 0;
}
.header-icon {
	font-size: 14px;
	margin-right: 6px;
	filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}
.header-text {
	font-weight: 700;
	font-size: 11px;
	color: #f8fafc;
	letter-spacing: 0.5px;
}

.tooltip-scroller {
	max-height: 180px;
	overflow-y: auto;
	padding: 2px 0;
}
.tooltip-scroller::-webkit-scrollbar {
	width: 3px;
}
.tooltip-scroller::-webkit-scrollbar-track {
	background: transparent;
}
.tooltip-scroller::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.2);
	border-radius: 2px;
}

/* 货件条目样式 - Ultra Compact */
.shipment-tooltip-item {
	padding: 6px 10px;
	border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
	transition: background 0.2s;
}
.shipment-tooltip-item:last-child {
	border-bottom: none;
}
.shipment-tooltip-item:hover {
	background: rgba(255, 255, 255, 0.03);
}

.ship-item-store {
	font-size: 10px;
	color: #86efac;
	margin-bottom: 2px;
	font-weight: 600;
	display: flex;
	align-items: center;
	gap: 4px;
}
.ship-item-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 2px;
}
.ship-item-sn {
	font-family: "JetBrains Mono", monospace;
	font-size: 10px;
	color: #f1f5f9;
	background: rgba(255, 255, 255, 0.1);
	padding: 0px 4px;
	border-radius: 3px;
}
.ship-item-qty {
	background: rgba(59, 130, 246, 0.2);
	color: #93c5fd;
	padding: 0px 5px;
	border-radius: 8px;
	font-size: 10px;
	font-weight: 700;
	border: 1px solid rgba(59, 130, 246, 0.3);
}
.ship-item-asin {
	font-size: 10px;
	color: #94a3b8;
	margin-bottom: 1px;
	transform: scale(0.95);
	transform-origin: left;
}
.ship-item-meta {
	font-size: 10px;
	color: #64748b;
	display: flex;
	gap: 6px;
	transform: scale(0.95);
	transform-origin: left;
}
.ship-item-time {
	font-size: 10px;
	color: #fcd34d;
	margin-top: 3px;
	display: flex;
	align-items: center;
	gap: 4px;
}
.ship-item-time::before {
	content: "";
	display: inline-block;
	width: 4px;
	height: 4px;
	background: #fcd34d;
	border-radius: 50%;
}

/* 促销条目样式 - Ultra Compact */
.promo-tooltip-item {
	padding: 6px 10px;
	border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
}
.promo-tooltip-item:last-child {
	border-bottom: none;
}
.promo-type-badge {
	display: inline-block;
	background: linear-gradient(135deg, #8b5cf6, #7c3aed);
	color: #fff;
	padding: 1px 5px; /* Minimal padding */
	border-radius: 3px;
	font-size: 10px;
	font-weight: 700;
	margin-bottom: 3px;
	box-shadow: 0 2px 4px rgba(139, 92, 246, 0.3);
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.promo-info-row {
	font-size: 10px;
	color: #cbd5e1;
	line-height: 1.4;
	display: flex;
}
.promo-label {
	color: #64748b;
	margin-right: 4px;
	min-width: 24px;
}

.action-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 6px;
}

.input-group {
	display: flex;
	align-items: center;
	gap: 4px;
}

.input-label {
	font-size: 11px;
	color: #6b7280;
	white-space: nowrap;
}

.action-btns {
	display: flex;
	gap: 4px;
}

.no-data-tip {
	padding: 8px 0;
	font-size: 11px;
}

/* 暂存历史 Popover 样式 */
.history-popover-content {
	font-size: 12px;
}

.history-header {
	display: flex;
	align-items: center;
	gap: 6px;
	padding-bottom: 8px;
	border-bottom: 1px solid #eee;
	margin-bottom: 8px;
}

.history-header .header-icon {
	font-size: 14px;
}

.history-header .header-title {
	font-weight: 600;
	color: #303133;
}

.history-loading,
.history-empty {
	text-align: center;
	color: #909399;
	padding: 16px 0;
}

.history-list {
	max-height: 280px;
	overflow-y: auto;
}

.history-record-item {
	padding: 8px;
	border-radius: 6px;
	background: #f9fafb;
	margin-bottom: 8px;
}

.history-record-item:last-child {
	margin-bottom: 0;
}

.record-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 4px;
}

.record-time {
	font-size: 11px;
	color: #909399;
}

.record-body {
	display: flex;
	justify-content: space-between;
	margin-bottom: 6px;
}

.record-range {
	color: #606266;
}

.record-qty {
	font-weight: 600;
	color: #409eff;
}

.record-meta {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 6px;
}

.record-coeff {
	font-size: 12px;
	color: #e6a23c;
	font-weight: 600;
	background: #fdf6ec;
	padding: 1px 6px;
	border-radius: 3px;
}

.record-actions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}

/* 详情视图 - 返回按钮 */
.back-btn {
	color: #409eff;
	cursor: pointer;
	font-size: 12px;
}

.back-btn:hover {
	text-decoration: underline;
}

/* 详情内嵌视图 */
.detail-inline {
	padding: 4px 0;
}

.detail-summary-card {
	background: linear-gradient(135deg, #409eff 0%, #36cfc9 100%);
	color: white;
	padding: 12px;
	border-radius: 8px;
	margin-bottom: 10px;
	text-align: center;
}

.detail-summary-card .summary-qty {
	font-size: 28px;
	font-weight: 700;
}

.detail-summary-card .summary-label {
	font-size: 11px;
	opacity: 0.9;
}

.detail-summary-card .summary-range {
	font-size: 11px;
	opacity: 0.8;
	margin-top: 4px;
}

.detail-info-row {
	display: flex;
	justify-content: space-between;
	padding: 6px 0;
	border-bottom: 1px solid #f0f0f0;
}

.detail-info-row .info-label {
	color: #909399;
	font-size: 12px;
}

.detail-info-row .info-value {
	color: #303133;
	font-weight: 500;
	font-size: 12px;
}

.detail-remark {
	display: flex;
	justify-content: space-between;
	padding: 6px 0;
	font-size: 12px;
}

.detail-remark .info-label {
	color: #909399;
}

.detail-remark .info-value {
	color: #606266;
	max-width: 200px;
	text-align: right;
}

/* 明细弹窗 Tab 切换样式 */
.detail-tab-row {
	display: flex;
	gap: 0;
	margin-bottom: 10px;
	border-radius: 6px;
	overflow: hidden;
	border: 1px solid #dcdfe6;
}

.detail-tab {
	flex: 1;
	padding: 6px 0;
	text-align: center;
	font-size: 12px;
	color: #606266;
	background: #f5f7fa;
	cursor: pointer;
	transition: all 0.2s;
}

.detail-tab:hover {
	background: #ebeef5;
}

.detail-tab.active {
	background: #409eff;
	color: white;
}

/* 5个月窗口汇总样式 */
.window-summary {
	background: #f0f9ff;
	border-radius: 6px;
	padding: 10px;
	margin-bottom: 10px;
}

.window-info {
	display: flex;
	justify-content: space-between;
	padding: 4px 0;
	font-size: 12px;
}

.window-info.highlight {
	padding-top: 8px;
	margin-top: 4px;
	border-top: 1px solid #d1e9ff;
}

.window-info .info-val.primary {
	color: #409eff;
	font-weight: 600;
}

/* 当前月高亮 */
.segment-table tr.current-month {
	background: #f0f9ff;
}

.segment-table tr.current-month td:first-child::before {
	content: "•";
	color: #409eff;
	margin-right: 4px;
}

/* 里程碑角标样式 */
.milestone-badge {
	position: absolute;
	top: 1px;
	right: 1px;
	background: rgba(64, 158, 255, 0.9);
	color: #fff;
	font-size: 12px;
	padding: 0 4px;
	border-radius: 4px;
	transform: scale(0.65);
	transform-origin: top right;
	pointer-events: none;
	font-weight: 600;
	z-index: 2;
	box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
</style>

<!-- 非 scoped 样式：处理 teleported 到 body 的 popover 面板 -->
<style>
.alpha-config-panel { padding: 4px 0; }
.alpha-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.alpha-title { font-size: 14px; font-weight: 700; color: #303133; }
.alpha-slider-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.alpha-range-labels { display: flex; justify-content: space-between; font-size: 11px; color: #909399; margin-bottom: 12px; }
.alpha-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
