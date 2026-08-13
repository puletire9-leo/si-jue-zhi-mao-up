<template>
	<el-dialog
		v-model="visible"
		fullscreen
		:close-on-click-modal="false"
		@close="onClose"
	>
		<template #header>
			<div style="display: flex; align-items: center; gap: 12px;">
				<span style="font-size: 16px; font-weight: 600;">关键词跟踪详情</span>
				<el-tooltip content="刷新全部数据" placement="bottom">
					<el-button :icon="Refresh" circle size="small" :loading="loading" @click="loadAll()" />
				</el-tooltip>
			</div>
		</template>
		<div style="display: flex; gap: 16px; height: calc(100vh - 120px);">
		<!-- ===== 左侧面板：ASIN 排名总分 ===== -->
		<div style="width: 520px; min-width: 520px; border-right: 1px solid #ebeef5; padding-right: 12px; overflow-y: auto;">
			<div style="font-weight: 600; font-size: 14px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
				ASIN 排名总分
				<el-tooltip content="基于过去15天数据，每日各关键词得分累加后取平均。ASIN需出现≥3天才显示。" placement="right">
					<el-icon :size="14" style="color: #909399; cursor: help;"><QuestionFilled /></el-icon>
				</el-tooltip>
				<!-- 列表/图表切换 -->
				<div style="margin-left: auto; display: flex; background: #f4f4f5; border-radius: 6px; padding: 2px;">
					<button
						@click="scoreSummaryView = 'list'"
						:style="{ padding: '2px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 500, background: scoreSummaryView === 'list' ? '#fff' : 'transparent', color: scoreSummaryView === 'list' ? '#409eff' : '#909399', boxShadow: scoreSummaryView === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }"
					>列表</button>
					<button
						@click="scoreSummaryView = 'chart'"
						:style="{ padding: '2px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 500, background: scoreSummaryView === 'chart' ? '#fff' : 'transparent', color: scoreSummaryView === 'chart' ? '#409eff' : '#909399', boxShadow: scoreSummaryView === 'chart' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }"
					>图表</button>
				</div>
			</div>
			<!-- 统计栏：自己/公司/竞品 条数 -->
			<div v-if="scoreSummaryData.length > 0" style="display: flex; gap: 12px; margin-bottom: 8px; font-size: 12px; color: #606266;">
				<span>共 <b style="color: #409EFF;">{{ scoreSummaryData.length }}</b> 个ASIN</span>
				<span>自己: <b style="color: #67C23A;">{{ scoreSummaryData.filter((r: any) => r.type === '自己').length }}</b></span>
				<span>公司: <b style="color: #E6A23C;">{{ scoreSummaryData.filter((r: any) => r.type === '公司').length }}</b></span>
				<span>竞品: <b style="color: #F56C6C;">{{ scoreSummaryData.filter((r: any) => r.type === '竞品').length }}</b></span>
			</div>
			<div v-if="scoreSummaryLoading" style="text-align: center; padding: 40px;">
				<el-icon class="is-loading" :size="20"><Loading /></el-icon>
				<div style="margin-top: 6px; color: #909399; font-size: 12px;">计算评分中...</div>
			</div>
			<div v-else-if="scoreSummaryData.length === 0" style="text-align: center; padding: 30px; color: #909399; font-size: 13px;">
				暂无评分数据<br><span style="font-size: 11px;">需要至少3天的采集数据</span>
			</div>

			<!-- 列表模式 -->
			<el-table v-else-if="scoreSummaryView === 'list'" :data="sortedScoreSummaryData" size="small" border stripe max-height="calc(100vh - 200px)" :row-class-name="scoreRowClassName" @row-click="(row: any) => openCompare(row.asin)" :row-style="(info: any) => ({ cursor: info.row.type !== '自己' ? 'pointer' : 'default' })">
				<el-table-column label="产品" min-width="200">
					<template #default="{ row }">
						<div style="display: flex; align-items: center; gap: 8px;">
							<el-popover v-if="row.image_url" placement="right" trigger="hover" :width="220" :show-after="300" :persistent="false">
							<template #reference>
								<el-image
									:src="convert_image_url(row.image_url)"
									:preview-src-list="[convert_image_url(row.image_url)]"
									fit="contain"
									loading="lazy"
									style="width: 40px; height: 40px; flex-shrink: 0; border-radius: 4px; border: 1px solid #ebeef5; cursor: pointer;"
									preview-teleported
									@click.stop
								/>
							</template>
							<el-image :src="convert_image_url(row.image_url)" fit="contain" loading="lazy" style="width: 200px; height: 200px;" />
						</el-popover>
						<div v-else style="width: 40px; height: 40px; flex-shrink: 0; border-radius: 4px; background: #f5f7fa; display: flex; align-items: center; justify-content: center;">
							<el-icon :size="16" style="color: #c0c4cc;"><Picture /></el-icon>
						</div>
							<div style="min-width: 0; flex: 1;">
								<div style="display: flex; align-items: center; gap: 4px;">
									<el-tag :type="row.type === '自己' ? 'success' : row.type === '公司' ? 'primary' : 'danger'" size="small" effect="dark" style="padding: 0 4px; flex-shrink: 0;">{{ row.type }}</el-tag>
									<span style="font-size: 12px; font-weight: 600; font-family: monospace;">{{ row.asin }}</span>
								</div>
								<div v-if="row.seller" style="font-size: 11px; color: #909399; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="row.seller">{{ row.seller }}</div>
							<div v-if="row.monthly_sales != null" style="font-size: 11px; color: #e6a23c; margin-top: 1px;">{{ row.type === '竞品' ? '父体销量' : '30天销量' }}: {{ row.monthly_sales?.toLocaleString() }}</div>
							</div>
						</div>
					</template>
				</el-table-column>
				<el-table-column label="自然流量均分" width="95" align="center" sortable :sort-method="(a: any, b: any) => a.avgNf - b.avgNf">
					<template #header>
				<el-tooltip content="所有关键词自然排名得分之和 ÷ 天数" placement="top"><span style="cursor: help;">自然综合分</span></el-tooltip>
					</template>
					<template #default="{ row }">
						<span :style="{ fontWeight: 600, color: row.avgNf > 50 ? '#67c23a' : row.avgNf > 20 ? '#e6a23c' : '#909399' }">{{ row.avgNf.toFixed(1) }}</span>
					</template>
				</el-table-column>
				<el-table-column label="SP广告均分" width="95" align="center" sortable :sort-method="(a: any, b: any) => a.avgSp - b.avgSp">
					<template #header>
						<el-tooltip content="所有关键词SP广告得分之和 ÷ 天数" placement="top"><span style="cursor: help;">SP综合分</span></el-tooltip>
					</template>
					<template #default="{ row }">
						<span :style="{ fontWeight: 600, color: row.avgSp > 50 ? '#67c23a' : row.avgSp > 20 ? '#e6a23c' : '#909399' }">{{ row.avgSp.toFixed(1) }}</span>
					</template>
				</el-table-column>
				<el-table-column label="自然覆盖" width="65" align="center" sortable :sort-method="(a: any, b: any) => (a.coverageNfRate ?? 0) - (b.coverageNfRate ?? 0)">
					<template #header>
						<el-tooltip content="自然排名在几成关键词中出现过" placement="top"><span style="cursor: help;">自然覆盖</span></el-tooltip>
					</template>
					<template #default="{ row }">
						<span :style="{ fontSize: '11px', fontWeight: 500, color: row.coverageNfRate >= 0.8 ? '#67c23a' : row.coverageNfRate >= 0.5 ? '#e6a23c' : '#f56c6c' }">{{ row.coverageNf }}</span>
					</template>
				</el-table-column>
				<el-table-column label="广告覆盖" width="65" align="center" sortable :sort-method="(a: any, b: any) => (a.coverageSpRate ?? 0) - (b.coverageSpRate ?? 0)">
					<template #header>
						<el-tooltip content="SP广告在几成关键词中出现过" placement="top"><span style="cursor: help;">广告覆盖</span></el-tooltip>
					</template>
					<template #default="{ row }">
						<span :style="{ fontSize: '11px', fontWeight: 500, color: row.coverageSpRate >= 0.8 ? '#67c23a' : row.coverageSpRate >= 0.5 ? '#e6a23c' : '#f56c6c' }">{{ row.coverageSp }}</span>
					</template>
				</el-table-column>
			</el-table>

			<!-- 图表模式 -->
			<div v-else-if="scoreSummaryView === 'chart' && sortedScoreSummaryData.length > 0"
				:style="{ height: Math.max(260, sortedScoreSummaryData.length * 52 + 80) + 'px' }">
				<v-chart
					:key="'summary_chart_' + sortedScoreSummaryData.length + '_' + scoreSortMode + '_' + scoreSortField + '_' + scoreSortOrder"
					:option="getSummaryChartOption()"
					:update-options="{ notMerge: true }"
					autoresize
					style="height: 100%; width: 100%;"
					@legendselectchanged="handleChartLegendClick"
					@click="(params: any) => { if (params.dataIndex != null) { const row = [...sortedScoreSummaryData].reverse()[params.dataIndex]; if (row) openCompare(row.asin); } }"
				/>
			</div>
		</div>

		<!-- ===== 右侧主体区 ===== -->
		<div style="flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; overflow: hidden;">
		<el-tabs v-model="mainTab" class="right-panel-tabs" tab-position="top">
		<el-tab-pane label="关键词列表" name="list" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
		<div v-if="listingRow" style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; background: #fafafa; padding: 8px 12px; border-radius: 6px; border: 1px solid #ebeef5;">
			<div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
				<el-popover v-if="listingRow.image_url" placement="right" trigger="hover" :width="220" :show-after="300" :persistent="false">
					<template #reference>
						<el-image
							:src="convert_image_url(listingRow.image_url)"
							:preview-src-list="[convert_image_url(listingRow.image_url)]"
							fit="contain"
							loading="lazy"
							style="width: 44px; height: 44px; border-radius: 4px; border: 1px solid #ebeef5; background: #fff; flex-shrink: 0; cursor: pointer;"
							preview-teleported
						/>
					</template>
					<el-image :src="convert_image_url(listingRow.image_url)" fit="contain" loading="lazy" style="width: 200px; height: 200px;" />
				</el-popover>
				<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; justify-content: center;">
					<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
						<el-tag effect="dark" :color="getMarketplaceColor(listingRow.marketplace)" style="border: none;" size="small">{{ listingRow.marketplace }}</el-tag>
						<span style="font-weight: 600; font-size: 15px;">{{ listingRow.asin }}</span>
						<span v-if="listingRow.seller_name" style="color: #409EFF; font-size: 12px; background: #ecf5ff; padding: 1px 6px; border-radius: 4px; font-weight: 500;">
							{{ listingRow.seller_name }}
						</span>
						<span v-if="listingRow.thirty_volume != null" style="color: #e6a23c; font-size: 12px; font-weight: 600; background: #fdf6ec; padding: 1px 6px; border-radius: 4px;">
							30天销量: {{ listingRow.thirty_volume?.toLocaleString() }}
						</span>
					</div>
					<div v-if="listingRow.item_name" style="color: #606266; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 800px;" :title="listingRow.item_name">
						{{ listingRow.item_name }}
					</div>
				</div>
			</div>
			
			<div style="display: flex; align-items: center; gap: 10px;">
				<div style="font-size: 13px; color: #606266; white-space: nowrap;">
					共 <span style="font-weight: bold; color: #409EFF;">{{ filteredTableData.length }}</span> 个关键词
				</div>
				<el-button
					size="small"
					type="success"
					plain
					:disabled="selectedRows.length === 0"
					:loading="historyFetching"
					@click="fetchHistoricalData"
				>
					获取15天历史{{ selectedRows.length > 0 ? `(${selectedRows.length})` : '' }}
				</el-button>
				<el-button
					size="small"
					type="danger"
					plain
					:disabled="selectedMyRows.length === 0"
					:loading="stopMyTrackingLoading"
					@click="batchStopSelectedMyTracking"
				>
					<el-icon><Delete /></el-icon>
					取消我的跟踪{{ selectedMyRows.length > 0 ? `(${selectedMyRows.length})` : '' }}
				</el-button>
				<el-input 
					v-model="searchKeyword" 
					placeholder="搜索关键词..." 
					clearable 
					style="width: 200px;" 
					:prefix-icon="Search"
				/>
			</div>
		</div>

		<div v-if="loading" style="text-align: center; padding: 40px;">
			<el-icon class="is-loading" :size="24"><Loading /></el-icon>
			<div style="margin-top: 8px; color: #909399;">加载中...</div>
		</div>

		<div v-else-if="tableData.length === 0" style="text-align: center; padding: 40px; color: #909399;">
			暂无跟踪中的关键词，请在关键词列表中点击「开启跟踪」
		</div>

		<el-table
			v-else
			:data="paginatedTableData"
			size="small"
			border
			stripe
			height="calc(95vh - 250px)"
			style="width: 100%;"
			:row-class-name="rowClassName"
			@selection-change="onSelectionChange"
		>
			<el-table-column type="selection" width="40" />
			<!-- 关键词 -->
			<el-table-column prop="keyword_value" label="关键词" min-width="130">
				<template #default="{ row }">
					<div style="font-weight: 500;">{{ row.keyword_value }}</div>
					<div style="font-size: 11px; color: #c0c4cc;">{{ row.snapshot_date || '未采集' }}</div>
					<el-tag v-if="Number(row.is_mine) === 1" size="small" type="success" effect="plain" style="margin-top: 3px;">我的跟踪</el-tag>
				</template>
			</el-table-column>

			<!-- 中文翻译 -->
			<el-table-column label="中文翻译" width="100">
				<template #default="{ row }">
					<span v-if="row._value_cn" style="color: #606266;">{{ row._value_cn }}</span>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>

			<!-- 流量得分 -->
			<el-table-column label="流量得分" width="85" align="center" sortable :sort-method="(a: any, b: any) => (a._sifScore || 0) - (b._sifScore || 0)">
				<template #default="{ row }">
					<span v-if="row._sifScore" style="font-weight: 600; color: #303133;">{{ row._sifScore }}</span>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>

			<!-- 搜索量 -->
			<el-table-column label="搜索量" width="75" align="center" sortable :sort-method="(a: any, b: any) => (a._searchVolume || 0) - (b._searchVolume || 0)">
				<template #default="{ row }">
					<span v-if="row._searchVolume" style="font-weight: 500;">{{ row._searchVolume?.toLocaleString() }}</span>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>

			<!-- 我的自然排名 -->
			<el-table-column label="自然排名" min-width="115" align="center" sortable :sort-method="(a: any, b: any) => { const av = a._self?.natural ? (a._self.natural.page * 100 + a._self.natural.position) : 999999; const bv = b._self?.natural ? (b._self.natural.page * 100 + b._self.natural.position) : 999999; return av - bv; }">
				<template #default="{ row }">
					<el-popover
						v-if="row._self?.natural"
						placement="top"
						trigger="hover"
						:width="300"
						@show="loadHistory(row)"
					>
						<template #reference>
							<span style="cursor: pointer;">
								<span style="font-weight: 600; color: #303133;">第{{ row._self.natural.page }}页 第{{ row._self.natural.position }}位</span>
								<span v-if="row._naturalTrend > 0" style="color: #67c23a; font-weight: 700; font-size: 13px; margin-left: 4px;">↑{{ row._naturalTrend }}</span>
								<span v-else-if="row._naturalTrend < 0" style="color: #f56c6c; font-weight: 700; font-size: 13px; margin-left: 4px;">↓{{ Math.abs(row._naturalTrend) }}</span>
							</span>
						</template>
						<div style="font-weight: 600; margin-bottom: 8px;">自然排名 · 最近15天</div>
						<div v-if="row._historyLoading" style="text-align: center; padding: 10px;">
							<el-icon class="is-loading"><Loading /></el-icon>
						</div>
						<el-table v-else-if="row._history?.length" :data="row._history" size="small" border max-height="300">
							<el-table-column prop="date" label="日期" width="90" />
							<el-table-column label="排名" align="center">
								<template #default="{ row: h }">
									<span v-if="h.natural" style="font-weight: 600;">第{{ h.natural.page }}页 第{{ h.natural.position }}位</span>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
						</el-table>
						<div v-else style="color: #909399; text-align: center; padding: 10px;">暂无历史</div>
					</el-popover>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>

			<!-- SP广告 -->
			<el-table-column label="SP广告" min-width="115" align="center" sortable :sort-method="(a: any, b: any) => { const av = a._self?.sp?.rank > 0 ? (a._self.sp.page * 100 + a._self.sp.position) : 999999; const bv = b._self?.sp?.rank > 0 ? (b._self.sp.page * 100 + b._self.sp.position) : 999999; return av - bv; }">
				<template #default="{ row }">
					<el-popover
						v-if="row._self?.sp && row._self.sp.rank > 0"
						placement="top"
						trigger="hover"
						:width="300"
						@show="loadHistory(row)"
					>
						<template #reference>
							<span style="cursor: pointer;">
								<span style="font-weight: 600; color: #303133;">第{{ row._self.sp.page }}页 第{{ row._self.sp.position }}位</span>
								<span v-if="row._spTrend > 0" style="color: #67c23a; font-weight: 700; font-size: 13px; margin-left: 4px;">↑{{ row._spTrend }}</span>
								<span v-else-if="row._spTrend < 0" style="color: #f56c6c; font-weight: 700; font-size: 13px; margin-left: 4px;">↓{{ Math.abs(row._spTrend) }}</span>
							</span>
						</template>
						<div style="font-weight: 600; margin-bottom: 8px;">SP广告 · 最近15天</div>
						<div v-if="row._historyLoading" style="text-align: center; padding: 10px;">
							<el-icon class="is-loading"><Loading /></el-icon>
						</div>
						<el-table v-else-if="row._history?.length" :data="row._history" size="small" border max-height="300">
							<el-table-column prop="date" label="日期" width="90" />
							<el-table-column label="SP排名" align="center">
								<template #default="{ row: h }">
									<span v-if="h.sp && h.sp.rank > 0" style="font-weight: 600; color: #303133;">第{{ h.sp.page }}页 第{{ h.sp.position }}位</span>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
						</el-table>
						<div v-else style="color: #909399; text-align: center; padding: 10px;">暂无历史</div>
					</el-popover>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>


			<!-- 顶部广告 -->
			<el-table-column label="顶部" width="45" align="center">
				<template #default="{ row }">
					<el-tooltip v-if="row._self?.topAd" content="顶部广告位 (Top Ad)" placement="top">
						<span style="color: #409eff; cursor: help;">✓</span>
					</el-tooltip>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>

			<!-- 品牌广告 -->
			<el-table-column label="品牌" width="45" align="center">
				<template #default="{ row }">
					<el-tooltip v-if="row._self?.brandAd" content="品牌广告 (Brand Ad)" placement="top">
						<span style="color: #409eff; cursor: help;">✓</span>
					</el-tooltip>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>

			<!-- 视频广告 -->
			<el-table-column label="视频" width="45" align="center">
				<template #default="{ row }">
					<el-tooltip v-if="row._self?.videoAd" content="视频广告 (Video Ad)" placement="top">
						<span style="color: #409eff; cursor: help;">✓</span>
					</el-tooltip>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>

			<!-- 公司ASIN数 -->
			<el-table-column label="公司" width="50" align="center">
				<template #default="{ row }">
					<el-popover
						v-if="row._analysis?.company?.length"
						placement="right"
						trigger="hover"
						:width="650"
					>
						<template #reference>
							<el-tag type="primary" size="small" style="cursor: pointer;">{{ row._analysis.company.length }}</el-tag>
						</template>
						<div style="font-weight: 600; margin-bottom: 8px;">公司ASIN排名</div>
						<el-table :data="row._analysis.company" size="small" border max-height="300">
							<el-table-column prop="asin" label="产品" min-width="170">
								<template #default="{ row: r }">
									<div style="display: flex; align-items: center; gap: 8px;">
										<el-popover v-if="r.image_url" placement="right" trigger="hover" :width="220" :show-after="300" :persistent="false">
											<template #reference>
												<el-image
													:src="convert_image_url(r.image_url)"
													:preview-src-list="[convert_image_url(r.image_url)]"
													fit="contain"
													loading="lazy"
													style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 4px; border: 1px solid #ebeef5; cursor: pointer;"
													preview-teleported
													@click.stop
												/>
											</template>
											<el-image :src="convert_image_url(r.image_url)" fit="contain" loading="lazy" style="width: 200px; height: 200px;" />
										</el-popover>
										<div v-else style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 4px; background: #f5f7fa; display: flex; align-items: center; justify-content: center;">
											<el-icon :size="14" style="color: #c0c4cc;"><Picture /></el-icon>
										</div>
										<div style="min-width: 0; flex: 1;">
											<div style="font-size: 11px; font-weight: 600; font-family: monospace;">{{ r.asin }}</div>
											<div v-if="r.seller" style="font-size: 10px; color: #909399; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="r.seller">{{ r.seller }}</div>
											<div v-if="asinSalesMap.has(r.asin)" style="font-size: 10px; color: #e6a23c; margin-top: 2px;">30天销量: {{ asinSalesMap.get(r.asin)?.toLocaleString() }}</div>
										</div>
									</div>
								</template>
							</el-table-column>
							<el-table-column label="自然排名" align="center" sortable :sort-method="(a: any, b: any) => (a.natural?.rank || 9999) - (b.natural?.rank || 9999)">
								<template #default="{ row: r }">
									<span v-if="r.natural" style="font-weight: 600;">第{{ r.natural.page }}页 第{{ r.natural.position }}位</span>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
							<el-table-column label="SP广告" align="center" sortable :sort-method="(a: any, b: any) => (a.sp?.rank || 9999) - (b.sp?.rank || 9999)">
								<template #default="{ row: r }">
									<span v-if="r.sp && r.sp.rank > 0" style="font-weight: 600; color: #303133;">第{{ r.sp.page }}页 第{{ r.sp.position }}位</span>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
							<el-table-column label="Ⓐ" width="40" align="center">
								<template #default="{ row: r }">
									<el-tooltip v-if="r.ac" content="亚马逊精选" placement="top"><span style="color: #67c23a; font-weight: 700; cursor: help;">Ⓐ</span></el-tooltip>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
							<el-table-column label="顶部" width="45" align="center">
								<template #default="{ row: r }">
									<el-tooltip v-if="r.topAd" content="顶部广告位" placement="top"><span style="color: #409eff; cursor: help;">✓</span></el-tooltip>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
							<el-table-column label="品牌" width="45" align="center">
								<template #default="{ row: r }">
									<el-tooltip v-if="r.brandAd" content="品牌广告" placement="top"><span style="color: #409eff; cursor: help;">✓</span></el-tooltip>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
							<el-table-column label="视频" width="45" align="center">
								<template #default="{ row: r }">
									<el-tooltip v-if="r.videoAd" content="视频广告" placement="top"><span style="color: #409eff; cursor: help;">✓</span></el-tooltip>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
						</el-table>
					</el-popover>
					<span v-else style="color: #c0c4cc;">0</span>
				</template>
			</el-table-column>

			<!-- 竞品ASIN数 -->
			<el-table-column label="竞品" width="50" align="center">
				<template #default="{ row }">
					<el-popover
						v-if="row._analysis?.competitor?.length"
						placement="right"
						trigger="hover"
						:width="650"
					>
						<template #reference>
							<el-tag type="danger" size="small" style="cursor: pointer;">{{ row._analysis.competitor.length }}</el-tag>
						</template>
						<div style="font-weight: 600; margin-bottom: 8px;">竞品ASIN排名</div>
						<el-table :data="row._analysis.competitor" size="small" border max-height="300">
							<el-table-column prop="asin" label="产品" min-width="170">
								<template #default="{ row: r }">
									<div style="display: flex; align-items: center; gap: 8px;">
										<el-popover v-if="r.image_url" placement="right" trigger="hover" :width="220" :show-after="300" :persistent="false">
											<template #reference>
												<el-image
													:src="convert_image_url(r.image_url)"
													:preview-src-list="[convert_image_url(r.image_url)]"
													fit="contain"
													loading="lazy"
													style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 4px; border: 1px solid #ebeef5; cursor: pointer;"
													preview-teleported
													@click.stop
												/>
											</template>
											<el-image :src="convert_image_url(r.image_url)" fit="contain" loading="lazy" style="width: 200px; height: 200px;" />
										</el-popover>
										<div v-else style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 4px; background: #f5f7fa; display: flex; align-items: center; justify-content: center;">
											<el-icon :size="14" style="color: #c0c4cc;"><Picture /></el-icon>
										</div>
										<div style="min-width: 0; flex: 1;">
											<div style="font-size: 11px; font-weight: 600; font-family: monospace;">{{ r.asin }}</div>
											<div v-if="r.seller" style="font-size: 10px; color: #909399; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="r.seller">{{ r.seller }}</div>
											<div v-if="asinSalesMap.has(r.asin)" style="font-size: 10px; color: #e6a23c; margin-top: 2px;">父体销量: {{ asinSalesMap.get(r.asin)?.toLocaleString() }}</div>
										</div>
									</div>
								</template>
							</el-table-column>
							<el-table-column label="自然排名" align="center" sortable :sort-method="(a: any, b: any) => (a.natural?.rank || 9999) - (b.natural?.rank || 9999)">
								<template #default="{ row: r }">
									<span v-if="r.natural" style="font-weight: 600;">第{{ r.natural.page }}页 第{{ r.natural.position }}位</span>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
							<el-table-column label="SP广告" align="center" sortable :sort-method="(a: any, b: any) => (a.sp?.rank || 9999) - (b.sp?.rank || 9999)">
								<template #default="{ row: r }">
									<span v-if="r.sp && r.sp.rank > 0" style="font-weight: 600; color: #303133;">第{{ r.sp.page }}页 第{{ r.sp.position }}位</span>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
							<el-table-column label="Ⓐ" width="40" align="center">
								<template #default="{ row: r }">
									<el-tooltip v-if="r.ac" content="亚马逊精选" placement="top"><span style="color: #67c23a; font-weight: 700; cursor: help;">Ⓐ</span></el-tooltip>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
							<el-table-column label="顶部" width="45" align="center">
								<template #default="{ row: r }">
									<el-tooltip v-if="r.topAd" content="顶部广告位" placement="top"><span style="color: #409eff; cursor: help;">✓</span></el-tooltip>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
							<el-table-column label="品牌" width="45" align="center">
								<template #default="{ row: r }">
									<el-tooltip v-if="r.brandAd" content="品牌广告" placement="top"><span style="color: #409eff; cursor: help;">✓</span></el-tooltip>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
							<el-table-column label="视频" width="45" align="center">
								<template #default="{ row: r }">
									<el-tooltip v-if="r.videoAd" content="视频广告" placement="top"><span style="color: #409eff; cursor: help;">✓</span></el-tooltip>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
						</el-table>
					</el-popover>
					<span v-else style="color: #c0c4cc;">0</span>
				</template>
			</el-table-column>

			<el-table-column label="操作" width="80" align="center" fixed="right">
				<template #default="{ row }">
					<el-button
						size="small"
						type="primary"
						plain
						:disabled="!row._analysis"
						@click="openAnalysis(row)"
					>
						分析
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<div v-if="filteredTableData.length > 0" style="margin-top: 16px; display: flex; justify-content: flex-end;">
			<el-pagination
				v-model:current-page="currentPage"
				v-model:page-size="pageSize"
				:page-sizes="[10, 20, 50, 100, 200]"
				layout="total, sizes, prev, pager, next, jumper"
				:total="filteredTableData.length"
				background
			/>
		</div>
	</el-tab-pane>

	<!-- ===== Tab2: 关键词得分分析 ===== -->
	<el-tab-pane label="关键词得分" name="score" lazy style="flex: 1; overflow-y: auto; overflow-x: hidden;">
		<div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; position: sticky; top: 0; z-index: 10; background: #fff; padding: 8px 0;">
			<div style="display: flex; align-items: center; gap: 4px;">
				<el-button-group size="small">
					<el-button
						:type="scoreFilterType === '全部' ? 'primary' : ''"
						@click="scoreFilterType = '全部'">全部</el-button>
					<el-tooltip content="无自己产品数据" :disabled="scoreKeywordList.some(k => k.countSelf > 0)" placement="top">
						<span>
							<el-button
								:type="scoreFilterType === '自己' ? 'primary' : ''"
								:disabled="!scoreKeywordList.some(k => k.countSelf > 0)"
								@click="scoreFilterType = '自己'">
								自己
							</el-button>
						</span>
					</el-tooltip>
					<el-tooltip content="无公司产品数据" :disabled="scoreKeywordList.some(k => k.countCompany > 0)" placement="top">
						<span>
							<el-button
								:type="scoreFilterType === '公司' ? 'primary' : ''"
								:disabled="!scoreKeywordList.some(k => k.countCompany > 0)"
								@click="scoreFilterType = '公司'">
								公司
							</el-button>
						</span>
					</el-tooltip>
					<el-tooltip content="无竞品数据" :disabled="scoreKeywordList.some(k => k.countCompetitor > 0)" placement="top">
						<span>
							<el-button
								:type="scoreFilterType === '竞品' ? 'primary' : ''"
								:disabled="!scoreKeywordList.some(k => k.countCompetitor > 0)"
								@click="scoreFilterType = '竞品'">
								竞品
							</el-button>
						</span>
					</el-tooltip>
				</el-button-group>
			</div>
			<el-input v-model="scoreSearchAsin" placeholder="搜索ASIN..." clearable style="width: 200px;" size="small" :prefix-icon="Search" />
			<div style="margin-left: auto; display: flex; align-items: center; gap: 6px;">
				<el-radio-group v-model="scoreCurrentView" size="small" style="margin-right: 12px;">
					<el-radio-button label="table">数据表格</el-radio-button>
					<el-radio-button label="chart">可视化图表</el-radio-button>
				</el-radio-group>
				<span style="font-size: 12px; color: #606266;">日期:</span>
				<el-select v-model="scoreGlobalDate" size="small" style="width: 130px;" v-if="availableScoreDates.length > 0">
					<el-option v-for="d in availableScoreDates" :key="d" :label="d" :value="d" />
				</el-select>
				<span v-else style="font-size: 12px; color: #909399;">暂无数据</span>
			</div>
		</div>

		<div v-if="scoreSnapshotsLoading" style="text-align: center; padding: 40px;">
			<el-icon class="is-loading" :size="24"><Loading /></el-icon>
			<div style="margin-top: 6px; color: #909399; font-size: 12px;">加载快照数据中...</div>
		</div>
		<div v-else-if="scoreKeywordList.length === 0" style="text-align: center; padding: 40px; color: #909399;">暂无数据</div>
		<el-collapse v-else v-model="scoreCollapseActive" accordion style="width: 100%; max-height: calc(100vh - 280px); overflow-y: auto; overflow-x: hidden;">
			<el-collapse-item
				v-for="kw in scoreKeywordList" :key="kw.keyword" :name="kw.keyword"
				:class="{ 'kw-collapse-active': isScoreCollapseActive(kw.keyword) }">
				<template #title>
					<div style="display: flex; align-items: center; gap: 12px; width: 100%;">
						<span :style="{ fontWeight: 600, color: isScoreCollapseActive(kw.keyword) ? '#409eff' : '#303133' }">{{ kw.keyword }}</span>
						<span v-if="kw.valueCn" style="color: #909399; font-size: 12px;">{{ kw.valueCn }}</span>
						<el-tooltip v-if="kw.isFallback" :content="`该关键词在 ${scoreGlobalDate} 无数据，已自动显示 ${kw.actualDate} 的数据`" placement="top">
							<span style="color: #e6a23c; font-size: 11px; background: #fdf6ec; border: 1px solid #f5dab1; padding: 1px 6px; border-radius: 3px; cursor: help;">⚠ {{ kw.actualDate }}</span>
						</el-tooltip>
						<span v-else style="color: #409eff; font-size: 11px; background: #ecf5ff; padding: 1px 6px; border-radius: 3px;">{{ kw.actualDate }}</span>
						<span style="margin-left: auto; font-size: 12px; color: #606266;">
							流量: <b>{{ kw.sifScore || '-' }}</b>
							&nbsp;&middot;&nbsp;
							搜索量: <b>{{ kw.searchVolume?.toLocaleString() || '-' }}</b>
						</span>
					</div>
				</template>

				<template v-if="isScoreCollapseActive(kw.keyword)">
				<!-- 当日得分表 / 图表 -->
				<div v-if="scoreCurrentView === 'table'">
					<el-table :data="kw.filteredAsins" size="small" border stripe max-height="300" :row-class-name="scoreRowClassName">
					<el-table-column label="产品" min-width="180">
						<template #default="{ row }">
							<div style="display: flex; align-items: center; gap: 8px;">
								<el-popover v-if="row.image_url" placement="right" trigger="hover" :width="220" :show-after="300" :persistent="false">
									<template #reference>
										<el-image
											:src="convert_image_url(row.image_url)"
											:preview-src-list="[convert_image_url(row.image_url)]"
											fit="contain"
											loading="lazy"
											style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 4px; border: 1px solid #ebeef5; cursor: pointer;"
											preview-teleported
											@click.stop
										/>
									</template>
									<el-image :src="convert_image_url(row.image_url)" fit="contain" loading="lazy" style="width: 200px; height: 200px;" />
								</el-popover>
								<div v-else style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 4px; background: #f5f7fa; display: flex; align-items: center; justify-content: center;">
									<el-icon :size="14" style="color: #c0c4cc;"><Picture /></el-icon>
								</div>
								<div style="min-width: 0; flex: 1;">
									<div style="font-size: 12px; font-weight: 600; font-family: monospace; display: flex; align-items: center;">
										{{ row.asin }}
										<el-tooltip v-if="row.ac" content="亚马逊精选" placement="top">
											<span style="color: #67c23a; font-weight: 700; font-size: 14px; margin-left: 3px; cursor: help;">Ⓐ</span>
										</el-tooltip>
									</div>
									<div v-if="row.seller" style="font-size: 11px; color: #909399; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="row.seller">{{ row.seller }}</div>
									<div v-if="row.type !== '竞品' && asinSalesMap.has(row.asin)" style="font-size: 10px; color: #e6a23c; margin-top: 2px;">30天销量: {{ asinSalesMap.get(row.asin)?.toLocaleString() }}</div>
									<div v-if="row.type === '竞品' && asinSalesMap.has(row.asin)" style="font-size: 10px; color: #e6a23c; margin-top: 2px;">父体销量: {{ asinSalesMap.get(row.asin)?.toLocaleString() }}</div>
								</div>
							</div>
						</template>
					</el-table-column>
					<el-table-column label="类型" width="60" align="center">
						<template #default="{ row }">
							<el-tag :type="row.type === '自己' ? 'success' : row.type === '公司' ? 'primary' : 'danger'" size="small" effect="dark">{{ row.type }}</el-tag>
						</template>
					</el-table-column>
					<el-table-column label="自然排名" min-width="120" align="center" sortable :sort-method="(a: any, b: any) => { const av = a.natural ? (a.natural.page * 100 + a.natural.position) : 999999; const bv = b.natural ? (b.natural.page * 100 + b.natural.position) : 999999; return av - bv; }">
						<template #header>
							<el-tooltip content="这个ASIN搜这个关键词时，在自然搜索结果里排第几页第几位" placement="top"><span style="cursor: help;">自然排名</span></el-tooltip>
						</template>
						<template #default="{ row }">
							<span v-if="row.natural" style="color: #303133;">第{{ row.natural.page }}页 第{{ row.natural.position }}位</span>
							<span v-else style="color: #c0c4cc;">-</span>
						</template>
					</el-table-column>
					<el-table-column label="自然流量得分" width="100" align="center" sortable :sort-method="(a: any, b: any) => (a.score_nf ?? -1) - (b.score_nf ?? -1)">
						<template #header>
							<el-tooltip content="根据自然排名位置算出的分数。第1名=100分，排名越往后分越低，没出现=0分" placement="top"><span style="cursor: help;">自然流量得分</span></el-tooltip>
						</template>
						<template #default="{ row }">
							<span v-if="row.score_nf != null" :style="{ fontWeight: 600, color: row.score_nf > 50 ? '#67c23a' : row.score_nf > 20 ? '#e6a23c' : '#909399' }">{{ row.score_nf }}</span>
							<span v-else style="color: #c0c4cc;">-</span>
						</template>
					</el-table-column>
					<el-table-column label="SP广告排名" min-width="120" align="center" sortable :sort-method="(a: any, b: any) => { const av = a.sp?.rank > 0 ? (a.sp.page * 100 + a.sp.position) : 999999; const bv = b.sp?.rank > 0 ? (b.sp.page * 100 + b.sp.position) : 999999; return av - bv; }">
						<template #header>
							<el-tooltip content="这个ASIN搜这个关键词时，在SP广告位里排第几页第几位" placement="top"><span style="cursor: help;">SP广告排名</span></el-tooltip>
						</template>
						<template #default="{ row }">
							<span v-if="row.sp && row.sp.rank > 0" style="color: #303133;">第{{ row.sp.page }}页 第{{ row.sp.position }}位</span>
							<span v-else style="color: #c0c4cc;">-</span>
						</template>
					</el-table-column>
					<el-table-column label="SP广告得分" width="100" align="center" sortable :sort-method="(a: any, b: any) => (a.score_sp ?? -1) - (b.score_sp ?? -1)">
						<template #header>
							<el-tooltip content="根据SP广告排名位置算出的分数。第1名=100分，排名越往后分越低，没投广告=0分" placement="top"><span style="cursor: help;">SP广告得分</span></el-tooltip>
						</template>
						<template #default="{ row }">
							<span v-if="row.score_sp != null" :style="{ fontWeight: 600, color: row.score_sp > 50 ? '#67c23a' : row.score_sp > 20 ? '#e6a23c' : '#909399' }">{{ row.score_sp }}</span>
							<span v-else style="color: #c0c4cc;">-</span>
						</template>
					</el-table-column>
				</el-table>
				</div>
				<div v-if="scoreCurrentView === 'chart'" :style="{ height: kw.filteredAsins.length === 0 ? '100px' : Math.max(220, kw.filteredAsins.length * 72 + 100) + 'px', padding: '6px 0' }">
					<!-- 没有符合筛选的 ASIN -->
					<div v-if="kw.filteredAsins.length === 0"
						style="height: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; color: #909399; font-size: 13px; background: #fafafa; border-radius: 6px; border: 1px dashed #e4e7ed;">
						<el-icon><InfoFilled /></el-icon>
						<span>该关键词在此日期没有「{{ scoreFilterType === '全部' ? '' : scoreFilterType }}」类型的展示数据</span>
					</div>
					<!-- 有 ASIN 但得分全为 0 -->
					<template v-else-if="kw.filteredAsins.every(a => (a.score_nf == null || a.score_nf === 0) && (a.score_sp == null || a.score_sp === 0))">
						<div style="height: 100px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #c0c4cc; font-size: 13px; background: #fafafa; border-radius: 6px; border: 1px dashed #e4e7ed;">
							<el-icon><InfoFilled /></el-icon>
							<span>当前共 {{ kw.filteredAsins.length }} 个 ASIN，本日自然流量得分和 SP 广告得分均为 0，可能还没有投放或未上架</span>
						</div>
					</template>
					<!-- 正常有数据：用 key 强制完整重建 ECharts 实例，避免 canvas 尺寸残留导致柱子不显示 -->
					<v-chart
						v-else
						:key="kw.keyword + '_bar_' + scoreFilterType + '_' + kw.filteredAsins.length"
						:option="getBarChartOption(kw)"
						:update-options="{ notMerge: true }"
						autoresize
						style="height: 100%; width: 100%;"
					/>
				</div>

				<!-- 历史趋势入口行 -->
				<div style="margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
					<el-button
						v-if="!scoreHistoryState[kw.keyword]"
						size="small" text type="primary"
						@click="toggleScoreHistory(kw.keyword, kw.trackingId)">查看历史趋势</el-button>
					<el-button
						v-else
						size="small" text type="info"
						@click="scoreHistoryState[kw.keyword] = false">收起历史</el-button>
				</div>

				<!-- 历史趋势区域（懒加载） -->
				<div v-if="scoreHistoryState[kw.keyword]" style="margin-top: 4px; overflow: hidden; width: 100%;">
					<!-- 加载中 -->
					<div v-if="scoreHistoryLoading[kw.keyword]" style="text-align: center; padding: 20px;">
						<el-icon class="is-loading" :size="16"><Loading /></el-icon>
						<span style="margin-left: 6px; font-size: 12px; color: #909399;">加载历史数据...</span>
					</div>
					<div v-else-if="scoreHistoryCache[kw.keyword]">

						<!-- 控制栏：表格/图表 + 指标单选 + ASIN选择器 -->
						<div style="display: flex; align-items: flex-start; gap: 16px; padding: 10px 12px; background: #f7f9fc; border-radius: 8px; border: 1px solid #ebeef5; margin-bottom: 8px; flex-wrap: wrap;">

							<!-- 左侧：视图 + 指标切换 -->
							<div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
								<el-radio-group v-model="scoreHistoryView" size="small">
									<el-radio-button label="table">表格</el-radio-button>
									<el-radio-button label="chart">图表</el-radio-button>
								</el-radio-group>
								<el-divider direction="vertical" />
								<!-- 指标单选，仅在图表模式下显示 -->
								<template v-if="scoreHistoryView === 'chart'">
									<span style="font-size: 11px; color: #606266; white-space: nowrap;">指标:</span>
									<el-radio-group v-model="scoreHistoryMetric" size="small">
										<el-radio-button label="nf">自然流量</el-radio-button>
										<el-radio-button label="sp">SP广告</el-radio-button>
									</el-radio-group>
								</template>
							</div>

							<!-- 右侧：ASIN 选择器，按类型分组，仅在图表模式下显示 -->
							<div v-if="scoreHistoryView === 'chart'" style="flex: 1; display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto; padding: 4px 0;">

								<!-- 自己类型 -->
								<div v-if="scoreHistoryCache[kw.keyword].columns.some((c: any) => c.type === '自己')" style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
									<span style="font-size: 10px; font-weight: 600; color: #67c23a; background: #f0f9eb; border: 1px solid #c2e7b0; padding: 1px 6px; border-radius: 10px; white-space: nowrap;">自己</span>
									<div style="display: flex; gap: 4px; flex-wrap: wrap;">
										<el-popover
											v-for="col in scoreHistoryCache[kw.keyword].columns.filter((c: any) => c.type === '自己')"
											:key="col.asin"
											placement="bottom"
											trigger="hover"
											:width="150"
											:show-after="300">
											<template #reference>
												<el-tag
													:effect="(scoreHistorySelectedAsins[kw.keyword] || []).includes(col.asin) ? 'dark' : 'plain'"
													type="success" size="small" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
													@click="toggleHistoryAsin(kw.keyword, col.asin)">
													<img v-if="col.image_url" :src="convert_image_url(col.image_url)" loading="lazy" decoding="async" style="width: 16px; height: 16px; object-fit: contain; border-radius: 2px; flex-shrink: 0;" />
													{{ col.asin.slice(-8) }}
													<span style="font-size: 9px; margin-left: 3px; opacity: 0.8;">avg {{ scoreHistoryCache[kw.keyword].avgScores?.[col.asin]?.[scoreHistoryMetric] ?? 0 }}</span>
												</el-tag>
											</template>
											<div style="text-align: center;">
												<el-image v-if="col.image_url" :src="convert_image_url(col.image_url)" :preview-src-list="[convert_image_url(col.image_url)]" fit="contain" loading="lazy" style="width: 120px; height: 120px;" preview-teleported @click.stop />
												<div style="font-size: 11px; font-weight: 600; margin-top: 4px;">{{ col.asin }}</div>
												<div v-if="col.seller" style="font-size: 10px; color: #909399; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ col.seller }}</div>
												<div style="font-size: 10px; color: #67c23a; margin-top: 2px;">自然 {{ scoreHistoryCache[kw.keyword].avgScores?.[col.asin]?.nf ?? 0 }} / SP {{ scoreHistoryCache[kw.keyword].avgScores?.[col.asin]?.sp ?? 0 }}</div>
												<div v-if="asinSalesMap.has(col.asin)" style="font-size: 10px; color: #e6a23c; margin-top: 2px;">30天销量: {{ asinSalesMap.get(col.asin)?.toLocaleString() }}</div>
											</div>
										</el-popover>
									</div>
								</div>

								<!-- 公司类型 -->
								<div v-if="scoreHistoryCache[kw.keyword].columns.some((c: any) => c.type === '公司')" style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
									<span style="font-size: 10px; font-weight: 600; color: #409eff; background: #ecf5ff; border: 1px solid #b3d8ff; padding: 1px 6px; border-radius: 10px; white-space: nowrap;">公司</span>
									<div style="display: flex; gap: 4px; flex-wrap: wrap;">
										<el-popover
											v-for="col in scoreHistoryCache[kw.keyword].columns.filter((c: any) => c.type === '公司')"
											:key="col.asin"
											placement="bottom"
											trigger="hover"
											:width="150"
											:show-after="300">
											<template #reference>
												<el-tag
													:effect="(scoreHistorySelectedAsins[kw.keyword] || []).includes(col.asin) ? 'dark' : 'plain'"
													type="primary" size="small" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
													@click="toggleHistoryAsin(kw.keyword, col.asin)">
													<img v-if="col.image_url" :src="convert_image_url(col.image_url)" loading="lazy" decoding="async" style="width: 16px; height: 16px; object-fit: contain; border-radius: 2px; flex-shrink: 0;" />
													{{ col.asin.slice(-8) }}
													<span style="font-size: 9px; margin-left: 3px; opacity: 0.8;">avg {{ scoreHistoryCache[kw.keyword].avgScores?.[col.asin]?.[scoreHistoryMetric] ?? 0 }}</span>
												</el-tag>
											</template>
											<div style="text-align: center;">
												<el-image v-if="col.image_url" :src="convert_image_url(col.image_url)" :preview-src-list="[convert_image_url(col.image_url)]" fit="contain" loading="lazy" style="width: 120px; height: 120px;" preview-teleported @click.stop />
												<div style="font-size: 11px; font-weight: 600; margin-top: 4px;">{{ col.asin }}</div>
												<div v-if="col.seller" style="font-size: 10px; color: #909399; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ col.seller }}</div>
												<div style="font-size: 10px; color: #409eff; margin-top: 2px;">自然 {{ scoreHistoryCache[kw.keyword].avgScores?.[col.asin]?.nf ?? 0 }} / SP {{ scoreHistoryCache[kw.keyword].avgScores?.[col.asin]?.sp ?? 0 }}</div>
												<div v-if="asinSalesMap.has(col.asin)" style="font-size: 10px; color: #e6a23c; margin-top: 2px;">30天销量: {{ asinSalesMap.get(col.asin)?.toLocaleString() }}</div>
											</div>
										</el-popover>
									</div>
								</div>

								<!-- 竞品类型 -->
								<div v-if="scoreHistoryCache[kw.keyword].columns.some((c: any) => c.type === '竞品')" style="display: flex; align-items: flex-start; gap: 6px; flex-shrink: 0;">
									<span style="font-size: 10px; font-weight: 600; color: #f56c6c; background: #fef0f0; border: 1px solid #fbc4c4; padding: 1px 6px; border-radius: 10px; white-space: nowrap; margin-top: 2px;">竞品</span>
									<div style="display: flex; gap: 4px; flex-wrap: wrap;">
										<el-popover
											v-for="col in scoreHistoryCache[kw.keyword].columns.filter((c: any) => c.type === '竞品').sort((a: any, b: any) => (scoreHistoryCache[kw.keyword].avgScores?.[b.asin]?.[scoreHistoryMetric] || 0) - (scoreHistoryCache[kw.keyword].avgScores?.[a.asin]?.[scoreHistoryMetric] || 0))"
											:key="col.asin"
											placement="bottom"
											trigger="hover"
											:width="150"
											:show-after="300">
											<template #reference>
												<el-tag
													:effect="(scoreHistorySelectedAsins[kw.keyword] || []).includes(col.asin) ? 'dark' : 'plain'"
													type="danger" size="small" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
													@click="toggleHistoryAsin(kw.keyword, col.asin)">
													<img v-if="col.image_url" :src="convert_image_url(col.image_url)" loading="lazy" decoding="async" style="width: 16px; height: 16px; object-fit: contain; border-radius: 2px; flex-shrink: 0;" />
													{{ col.asin.slice(-8) }}
													<span style="font-size: 9px; margin-left: 3px; opacity: 0.8;">avg {{ scoreHistoryCache[kw.keyword].avgScores?.[col.asin]?.[scoreHistoryMetric] ?? 0 }}</span>
												</el-tag>
											</template>
											<div style="text-align: center;">
												<el-image v-if="col.image_url" :src="convert_image_url(col.image_url)" :preview-src-list="[convert_image_url(col.image_url)]" fit="contain" loading="lazy" style="width: 120px; height: 120px;" preview-teleported @click.stop />
												<div style="font-size: 11px; font-weight: 600; margin-top: 4px;">{{ col.asin }}</div>
												<div v-if="col.seller" style="font-size: 10px; color: #909399; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ col.seller }}</div>
												<div style="font-size: 10px; color: #f56c6c; margin-top: 2px;">自然 {{ scoreHistoryCache[kw.keyword].avgScores?.[col.asin]?.nf ?? 0 }} / SP {{ scoreHistoryCache[kw.keyword].avgScores?.[col.asin]?.sp ?? 0 }}</div>
												<div v-if="asinSalesMap.has(col.asin)" style="font-size: 10px; color: #e6a23c; margin-top: 2px;">父体销量: {{ asinSalesMap.get(col.asin)?.toLocaleString() }}</div>
											</div>
										</el-popover>
									</div>
								</div>

								<!-- 总线条数超限提示 -->
								<div v-if="(scoreHistorySelectedAsins[kw.keyword] || []).length > 5"
									style="font-size: 11px; color: #e6a23c; display: flex; align-items: center; gap: 4px;">
									<el-icon><WarningFilled /></el-icon>
									已选 {{ (scoreHistorySelectedAsins[kw.keyword] || []).length }} 条线，建议不超过 5 条
								</div>
							</div>
						</div>

						<!-- 表格视图 -->
						<div v-if="scoreHistoryView === 'table'" style="overflow-x: auto; max-width: 100%; width: 100%;">
							<el-table :data="scoreHistoryCache[kw.keyword].rows" size="small" border stripe max-height="400" scrollbar-always-on>
								<el-table-column label="日期" width="100" fixed align="center" prop="date" />
								<el-table-column
									v-for="aCol in scoreHistoryCache[kw.keyword].columns"
									:key="aCol.asin" width="140" align="center">
									<template #header>
										<div style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 0;">
											<el-popover v-if="aCol.image_url" placement="top" trigger="hover" :width="220" :show-after="300" :persistent="false">
												<template #reference>
													<el-image
														:src="convert_image_url(aCol.image_url)"
														fit="contain"
														loading="lazy"
														style="width: 24px; height: 24px; border-radius: 4px; cursor: pointer; border: 1px solid #ebeef5;"
													/>
												</template>
												<el-image :src="convert_image_url(aCol.image_url)" fit="contain" loading="lazy" style="width: 200px; height: 200px;" />
											</el-popover>
											<div style="line-height: 1.2;">
												<span :style="{ color: aCol.type === '自己' ? '#67c23a' : aCol.type === '公司' ? '#409eff' : '#f56c6c', fontWeight: 600 }">{{ aCol.label }}</span>
												<div v-if="aCol.seller" style="font-size: 10px; color: #909399; font-weight: 400; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 2px auto 0 auto;" :title="aCol.seller">{{ aCol.seller }}</div>
												<div v-if="aCol.type !== '竞品' && asinSalesMap.has(aCol.asin)" style="font-size: 10px; color: #e6a23c; font-weight: 400; margin-top: 2px;">30天销量: {{ asinSalesMap.get(aCol.asin)?.toLocaleString() }}</div>
												<div v-if="aCol.type === '竞品' && asinSalesMap.has(aCol.asin)" style="font-size: 10px; color: #e6a23c; font-weight: 400; margin-top: 2px;">父体销量: {{ asinSalesMap.get(aCol.asin)?.toLocaleString() }}</div>
												<div style="font-size: 10px; color: #c0c4cc; font-weight: 400; margin-top: 2px;">自然 / SP</div>
											</div>
										</div>
									</template>
									<template #default="{ row }">
										<span :style="scoreColorStyle(row[aCol.asin + '_nf'])">{{ row[aCol.asin + '_nf'] != null ? row[aCol.asin + '_nf'] : '-' }}</span>
										<span style="color: #dcdfe6; margin: 0 2px;">/</span>
										<span :style="scoreColorStyle(row[aCol.asin + '_sp'])">{{ row[aCol.asin + '_sp'] != null ? row[aCol.asin + '_sp'] : '-' }}</span>
									</template>
								</el-table-column>
							</el-table>
						</div>

						<!-- 图表视图 -->
						<div v-else
							:style="{ width: '100%', height: '420px', padding: '0', overflow: 'hidden' }">
							<v-chart
								:key="kw.keyword + '_line_' + scoreHistoryMetric + '_' + (scoreHistorySelectedAsins[kw.keyword] || []).join(',')"
								:option="getLineChartOption(kw.keyword)"
								:update-options="{ notMerge: true }"
								autoresize
								style="height: 100%; width: 100%;"
							/>
						</div>
					</div>
				</div>
				</template>
			</el-collapse-item>
		</el-collapse>
	</el-tab-pane>

	<!-- ===== Tab3: 对比分析（点击竞品后出现）===== -->
	<el-tab-pane v-if="compareTarget" name="compare" lazy style="flex: 1; overflow-y: auto; overflow-x: hidden;">
		<template #label>
			<span>对比分析 <span style="font-size: 10px; color: #909399; cursor: pointer;" @click.stop="closeCompare()">✕</span></span>
		</template>

		<!-- 头部 -->
		<div style="margin-bottom: 16px;">
			<div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
				<!-- A侧 (源) 选择器 -->
				<div style="display: flex; align-items: center; gap: 8px;">
					<el-popover v-if="sourceAsinInfo?.image_url" placement="right" trigger="hover" :width="220" :show-after="300" :persistent="false">
						<template #reference>
							<img :src="convert_image_url(sourceAsinInfo.image_url)" loading="lazy" decoding="async" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px; border: 1px solid #dcdfe6; cursor: pointer;" />
						</template>
						<el-image :src="convert_image_url(sourceAsinInfo.image_url)" fit="contain" loading="lazy" style="width: 200px; height: 200px;" />
					</el-popover>
					
					<el-popover placement="bottom-start" trigger="click" :width="300" v-model:visible="compareSourcePopoverVisible">
						<template #reference>
							<div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: background 0.2s;"
								 @mouseenter="($event.currentTarget as HTMLElement).style.background = '#f5f7fa'"
								 @mouseleave="($event.currentTarget as HTMLElement).style.background = 'transparent'">
								<el-tag :type="sourceAsinInfo?.type === '自己' ? 'success' : sourceAsinInfo?.type === '公司' ? 'primary' : 'danger'" size="small" effect="dark" style="padding: 0 6px;">{{ sourceName }}</el-tag>
								<span style="font-weight: 600; font-size: 13px; color: #303133;">{{ compareSource }}</span>
								<span v-if="sourceAsinInfo?.seller" style="font-size: 11px; color: #909399; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ sourceAsinInfo.seller }}</span>
								<span v-if="asinSalesMap.has(compareSource)" style="font-size: 11px; color: #e6a23c; font-weight: 500;">{{ sourceAsinInfo?.type === '竞品' ? '父体销量' : '30天销量' }}: {{ asinSalesMap.get(compareSource)?.toLocaleString() }}</span>
								<span style="font-size: 10px; color: #c0c4cc; margin-left: 2px;">▼</span>
							</div>
						</template>
						<div style="max-height: 280px; overflow-y: auto;">
							<div v-for="item in scoreSummaryData" :key="'src_' + item.asin"
								 @click="item.asin !== compareTarget ? changeCompareAsin('source', item.asin) : undefined"
								 style="display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 4px; transition: background 0.15s;"
								 :style="{ background: item.asin === compareSource ? '#f0f9eb' : item.asin === compareTarget ? '#fafafa' : 'transparent', cursor: item.asin === compareTarget ? 'not-allowed' : 'pointer', opacity: item.asin === compareTarget ? 0.5 : 1 }"
								 @mouseenter="($event.currentTarget as HTMLElement).style.background = item.asin === compareSource ? '#f0f9eb' : item.asin === compareTarget ? '#fafafa' : '#f5f7fa'"
								 @mouseleave="($event.currentTarget as HTMLElement).style.background = item.asin === compareSource ? '#f0f9eb' : item.asin === compareTarget ? '#fafafa' : 'transparent'">
								<img v-if="item.image_url" :src="convert_image_url(item.image_url)" loading="lazy" decoding="async" style="width: 20px; height: 20px; object-fit: contain; border-radius: 2px; border: 1px solid #ebeef5; flex-shrink: 0;" />
								<div v-else style="width: 20px; height: 20px;"></div>
								<el-tag :type="item.type === '自己' ? 'success' : item.type === '公司' ? 'primary' : 'danger'" size="small" effect="dark" style="padding: 0 4px; height: 16px; line-height: 14px; font-size: 10px;">{{ item.type }}</el-tag>
								<span style="font-size: 12px; font-weight: 500;">{{ item.asin }}</span>
								<span v-if="item.asin === compareTarget" style="font-size: 10px; color: #c0c4cc; margin-left: auto;">已选为B侧</span>
							</div>
						</div>
					</el-popover>
				</div>

				<!-- B侧 (目标) 选择器 -->
				<div style="display: flex; align-items: center; gap: 8px;">
					<el-popover v-if="targetAsinInfo?.image_url" placement="right" trigger="hover" :width="220" :show-after="300" :persistent="false">
						<template #reference>
							<img :src="convert_image_url(targetAsinInfo.image_url)" loading="lazy" decoding="async" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px; border: 1px solid #ffd6d6; cursor: pointer;" />
						</template>
						<el-image :src="convert_image_url(targetAsinInfo.image_url)" fit="contain" loading="lazy" style="width: 200px; height: 200px;" />
					</el-popover>
					
					<el-popover placement="bottom-start" trigger="click" :width="300" v-model:visible="compareTargetPopoverVisible">
						<template #reference>
							<div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: background 0.2s;"
								 @mouseenter="($event.currentTarget as HTMLElement).style.background = '#fcf0f0'"
								 @mouseleave="($event.currentTarget as HTMLElement).style.background = 'transparent'">
								<el-tag :type="targetAsinInfo?.type === '自己' ? 'success' : targetAsinInfo?.type === '公司' ? 'primary' : 'danger'" size="small" effect="dark" style="padding: 0 6px;">{{ targetName }}</el-tag>
								<span style="font-weight: 600; font-size: 13px; color: #303133;">{{ compareTarget }}</span>
								<span v-if="targetAsinInfo?.seller" style="font-size: 11px; color: #909399; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ targetAsinInfo.seller }}</span>
								<span v-if="asinSalesMap.has(compareTarget)" style="font-size: 11px; color: #e6a23c; font-weight: 500;">{{ targetAsinInfo?.type === '竞品' ? '父体销量' : '30天销量' }}: {{ asinSalesMap.get(compareTarget)?.toLocaleString() }}</span>
								<span style="font-size: 10px; color: #c0c4cc; margin-left: 2px;">▼</span>
							</div>
						</template>
						<div style="max-height: 280px; overflow-y: auto;">
							<div v-for="item in scoreSummaryData" :key="'tgt_' + item.asin"
								 @click="item.asin !== compareSource ? changeCompareAsin('target', item.asin) : undefined"
								 style="display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 4px; transition: background 0.15s;"
								 :style="{ background: item.asin === compareTarget ? '#fef0f0' : item.asin === compareSource ? '#fafafa' : 'transparent', cursor: item.asin === compareSource ? 'not-allowed' : 'pointer', opacity: item.asin === compareSource ? 0.5 : 1 }"
								 @mouseenter="($event.currentTarget as HTMLElement).style.background = item.asin === compareTarget ? '#fef0f0' : item.asin === compareSource ? '#fafafa' : '#f5f7fa'"
								 @mouseleave="($event.currentTarget as HTMLElement).style.background = item.asin === compareTarget ? '#fef0f0' : item.asin === compareSource ? '#fafafa' : 'transparent'">
								<img v-if="item.image_url" :src="convert_image_url(item.image_url)" loading="lazy" decoding="async" style="width: 20px; height: 20px; object-fit: contain; border-radius: 2px; border: 1px solid #ebeef5; flex-shrink: 0;" />
								<div v-else style="width: 20px; height: 20px;"></div>
								<el-tag :type="item.type === '自己' ? 'success' : item.type === '公司' ? 'primary' : 'danger'" size="small" effect="dark" style="padding: 0 4px; height: 16px; line-height: 14px; font-size: 10px;">{{ item.type }}</el-tag>
								<span style="font-size: 12px; font-weight: 500;">{{ item.asin }}</span>
								<span v-if="item.asin === compareSource" style="font-size: 10px; color: #c0c4cc; margin-left: auto;">已选为A侧</span>
							</div>
						</div>
					</el-popover>
					<span style="color: #909399; font-size: 12px; margin-left: auto;">共 {{ compareData.length }} 天数据</span>
				</div>
			</div>

			<!-- 过滤按钮 -->
			<div style="display: flex; align-items: center; gap: 4px;">
				<el-button-group size="small">
					<el-button :type="compareFilter === 'opponent' ? 'danger' : ''" @click="compareFilter = 'opponent'">{{ targetName }}领先</el-button>
					<el-button :type="compareFilter === 'self' ? 'success' : ''" @click="compareFilter = 'self'">{{ sourceName }}领先</el-button>
					<el-button :type="compareFilter === 'all' ? 'primary' : ''" @click="compareFilter = 'all'">全部</el-button>
				</el-button-group>
			</div>
		</div>

		<!-- 无数据 -->
		<div v-if="compareData.length === 0" style="text-align: center; padding: 40px; color: #909399;">
			<div style="font-size: 14px; margin-bottom: 6px;">暂无{{ compareFilter === 'opponent' ? targetName + '领先' : compareFilter === 'self' ? sourceName + '领先' : '' }}的数据</div>
			<div style="font-size: 12px;">试试切换过滤条件</div>
		</div>

		<!-- 日期列表（第一层） -->
		<div v-else style="display: flex; flex-direction: column; gap: 6px;">
			<div v-for="day in compareData" :key="day.date">
				<!-- 日期行（粗左边框 + 紧凑布局） -->
				<div
					@click="compareExpandedDays.includes(day.date) ? compareExpandedDays = compareExpandedDays.filter(d => d !== day.date) : compareExpandedDays.push(day.date)"
					:style="{
						display: 'flex', alignItems: 'center', padding: '10px 14px',
						borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s',
						background: '#fff',
						borderLeft: '4px solid ' + (day.diff > 0 ? '#f56c6c' : day.diff < 0 ? '#67c23a' : '#dcdfe6'),
						borderTop: '1px solid #ebeef5', borderRight: '1px solid #ebeef5', borderBottom: '1px solid #ebeef5',
						boxShadow: compareExpandedDays.includes(day.date) ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
					}"
				>
					<span style="font-size: 11px; color: #909399; margin-right: 6px;">{{ compareExpandedDays.includes(day.date) ? '▼' : '►' }}</span>
					<span style="font-weight: 700; font-size: 13px; color: #303133; min-width: 86px;">{{ day.date }}</span>

					<!-- 自然差值 -->
					<span style="margin-left: 12px; font-size: 12px; display: inline-flex; align-items: center; gap: 3px;">
						<span style="color: #909399;">自然</span>
						<b :style="{ color: day.nfDiff > 0 ? '#f56c6c' : day.nfDiff < 0 ? '#67c23a' : '#c0c4cc' }">
							{{ day.nfDiff === 0 ? '持平' : (day.nfDiff > 0 ? targetName + '+' + day.nfDiff.toFixed(0) : sourceName + '+' + Math.abs(day.nfDiff).toFixed(0)) }}
						</b>
					</span>

					<!-- SP差值 -->
					<span style="margin-left: 16px; font-size: 12px; display: inline-flex; align-items: center; gap: 3px;">
						<span style="color: #909399;">广告</span>
						<b :style="{ color: day.spDiff > 0 ? '#f56c6c' : day.spDiff < 0 ? '#67c23a' : '#c0c4cc' }">
							{{ day.spDiff === 0 ? '持平' : (day.spDiff > 0 ? targetName + '+' + day.spDiff.toFixed(0) : sourceName + '+' + Math.abs(day.spDiff).toFixed(0)) }}
						</b>
					</span>

					<span style="margin-left: auto; font-size: 11px; color: #c0c4cc;">{{ day.keywords.length }}词</span>
				</div>

				<!-- 关键词明细（第二层） -->
				<div v-if="compareExpandedDays.includes(day.date)" style="margin: 4px 0 8px 24px;">
					<div v-for="kw in day.keywords" :key="kw.keyword" style="margin-bottom: 4px;">
						<!-- 关键词行（可点击展开） -->
						<div
							@click.stop="toggleCompareDetail(day.date, kw.keyword)"
							:style="{
								display: 'flex', alignItems: 'center', padding: '8px 12px',
								borderRadius: '6px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s',
								background: compareDetailKey === day.date + '|' + kw.keyword ? '#f5f7fa' : '#fff',
								border: '1px solid ' + (compareDetailKey === day.date + '|' + kw.keyword ? '#d9d9d9' : '#ebeef5'),
							}"
						>
							<span style="font-size: 11px; color: #909399; margin-right: 6px;">{{ compareDetailKey === day.date + '|' + kw.keyword ? '▼' : '►' }}</span>
							<span style="font-weight: 600; color: #303133; min-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ kw.keyword }}</span>

							<!-- 自然：(竞品:xx / 自己:xx) 差值 -->
							<span style="font-size: 11px; margin-left: 8px; display: inline-flex; align-items: center; gap: 3px;">
								<span style="color: #909399;">自然</span>
								<span style="color: #909399;">(</span>
								<span style="color: #f56c6c; font-weight: 500;">{{ targetName }}:{{ kw.theirNf.toFixed(0) }}</span>
								<span style="color: #c0c4cc;">/</span>
								<span style="color: #67c23a; font-weight: 500;">{{ sourceName }}:{{ kw.myNf.toFixed(0) }}</span>
								<span style="color: #909399;">)</span>
								<b v-if="kw.theirNf - kw.myNf !== 0" :style="{ color: (kw.theirNf - kw.myNf) > 0 ? '#f56c6c' : '#67c23a' }">
									{{ (kw.theirNf - kw.myNf) > 0 ? targetName + '+' : sourceName + '+' }}{{ Math.abs(kw.theirNf - kw.myNf).toFixed(0) }}
								</b>
								<span v-else style="color: #c0c4cc;">持平</span>
							</span>

							<!-- 广告：(竞品:xx / 自己:xx) 差值 -->
							<span style="font-size: 11px; margin-left: 12px; display: inline-flex; align-items: center; gap: 3px;">
								<span style="color: #909399;">广告</span>
								<span style="color: #909399;">(</span>
								<span style="color: #f56c6c; font-weight: 500;">{{ targetName }}:{{ kw.theirSp.toFixed(0) }}</span>
								<span style="color: #c0c4cc;">/</span>
								<span style="color: #67c23a; font-weight: 500;">{{ sourceName }}:{{ kw.mySp.toFixed(0) }}</span>
								<span style="color: #909399;">)</span>
								<b v-if="kw.theirSp - kw.mySp !== 0" :style="{ color: (kw.theirSp - kw.mySp) > 0 ? '#f56c6c' : '#67c23a' }">
									{{ (kw.theirSp - kw.mySp) > 0 ? targetName + '+' : sourceName + '+' }}{{ Math.abs(kw.theirSp - kw.mySp).toFixed(0) }}
								</b>
								<span v-else style="color: #c0c4cc;">持平</span>
							</span>
						</div>

						<!-- 展开的详情面板 -->
						<div v-if="compareDetailKey === day.date + '|' + kw.keyword"
							style="margin: 2px 0 6px 0; padding: 12px 14px; background: #fafbfc; border: 1px solid #ebeef5; border-radius: 6px;">

							<!-- 排名表 -->
							<div style="font-weight: 600; font-size: 12px; color: #606266; margin-bottom: 8px;">
								{{ day.date }} 全部ASIN排名
							</div>

							<div v-if="compareDetailLoading" style="text-align: center; padding: 16px;">
								<el-icon class="is-loading" :size="16"><Loading /></el-icon>
								<span style="margin-left: 6px; color: #909399; font-size: 12px;">加载中...</span>
							</div>

							<el-table v-else-if="compareDetailData.length > 0" :data="compareDetailData" size="small" border max-height="240"
								:row-style="(info: any) => ({
									background: info.row._isSelf ? '#f0f9eb' : info.row._isTarget ? '#fef0f0' : '',
									fontWeight: (info.row._isSelf || info.row._isTarget) ? 600 : 400,
								})"
							>
								<el-table-column label="标识" width="70" align="center">
									<template #default="{ row }">
										<el-tag v-if="row._isSelf || row._isTarget"
											:type="row._origType === '自己' ? 'success' : row._origType === '公司' ? 'primary' : 'danger'"
											size="small" effect="dark" style="padding: 0 4px;">{{ row._type }}</el-tag>
										<span v-else style="color: #909399; font-size: 11px;">{{ row._type }}</span>
									</template>
								</el-table-column>
								<el-table-column prop="asin" label="产品" width="220">
									<template #default="{ row }">
										<div style="display: flex; align-items: center; gap: 8px;">
										<el-popover v-if="row.image_url" placement="right" trigger="hover" :width="220" :show-after="300" :persistent="false">
												<template #reference>
													<el-image
														:src="convert_image_url(row.image_url)"
														:preview-src-list="[convert_image_url(row.image_url)]"
														fit="contain"
														loading="lazy"
														style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 4px; border: 1px solid #ebeef5; cursor: pointer;"
														preview-teleported
														@click.stop
													/>
												</template>
												<el-image :src="convert_image_url(row.image_url)" fit="contain" loading="lazy" style="width: 200px; height: 200px;" />
											</el-popover>
											<div v-else style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 4px; background: #f5f7fa; display: flex; align-items: center; justify-content: center;">
												<el-icon :size="14" style="color: #c0c4cc;"><Picture /></el-icon>
											</div>
											<div style="min-width: 0; flex: 1;">
												<div style="font-size: 12px; font-weight: 600; font-family: monospace;">{{ row.asin }}</div>
												<div v-if="row.seller" style="font-size: 11px; color: #909399; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="row.seller">{{ row.seller }}</div>
												<div v-if="row._origType !== '竞品' && asinSalesMap.has(row.asin)" style="font-size: 10px; color: #e6a23c; margin-top: 2px;">30天销量: {{ asinSalesMap.get(row.asin)?.toLocaleString() }}</div>
												<div v-if="row._origType === '竞品' && asinSalesMap.has(row.asin)" style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #e6a23c; margin-top: 2px;">
													<span>父体销量: {{ asinSalesMap.get(row.asin)?.toLocaleString() }}</span>
													<el-popover placement="right" trigger="hover" :width="280" :show-after="200">
														<template #reference>
															<el-icon :style="{ cursor: 'pointer', fontSize: '14px', color: competitorTrendMap.get(row.asin)?.sales_volume_data?.length ? '#67c23a' : '#c0c4cc' }" title="月销量走势"><DataLine /></el-icon>
														</template>
														<div v-if="competitorTrendMap.has(row.asin) && competitorTrendMap.get(row.asin)?.sales_volume_data?.length">
															<div style="font-size: 12px; font-weight: 600; color: #303133; margin-bottom: 6px;">{{ row.asin }} 月销量走势</div>
															<div style="height: 120px; width: 100%;">
																<v-chart
																	:option="generateMiniTrendOption(competitorTrendMap.get(row.asin)?.sales_volume_data) as any"
																	style="width: 100%; height: 100%;"
																	autoresize
																/>
															</div>
														</div>
														<div v-else style="text-align: center; color: #909399; padding: 12px 0; font-size: 12px;">暂无走势数据</div>
													</el-popover>
												</div>
												<div v-if="row._origType === '竞品' && !asinSalesMap.has(row.asin)" style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
													<el-popover placement="right" trigger="hover" :width="280" :show-after="200">
														<template #reference>
															<el-icon :style="{ cursor: 'pointer', fontSize: '14px', color: competitorTrendMap.get(row.asin)?.sales_volume_data?.length ? '#67c23a' : '#c0c4cc' }" title="月销量走势"><DataLine /></el-icon>
														</template>
														<div v-if="competitorTrendMap.has(row.asin) && competitorTrendMap.get(row.asin)?.sales_volume_data?.length">
															<div style="font-size: 12px; font-weight: 600; color: #303133; margin-bottom: 6px;">{{ row.asin }} 月销量走势</div>
															<div style="height: 120px; width: 100%;">
																<v-chart
																	:option="generateMiniTrendOption(competitorTrendMap.get(row.asin)?.sales_volume_data) as any"
																	style="width: 100%; height: 100%;"
																	autoresize
																/>
															</div>
														</div>
														<div v-else style="text-align: center; color: #909399; padding: 12px 0; font-size: 12px;">暂无走势数据</div>
													</el-popover>
												</div>
											</div>
										</div>
									</template>
								</el-table-column>
								<el-table-column label="自然排名" width="110" align="center" sortable :sort-method="(a: any, b: any) => { const av = a.natural ? (a.natural.page * 100 + a.natural.position) : 999999; const bv = b.natural ? (b.natural.page * 100 + b.natural.position) : 999999; return av - bv; }">
									<template #default="{ row }">
										<span v-if="row.natural" style="color: #303133;">第{{ row.natural.page }}页 第{{ row.natural.position }}位</span>
										<span v-else style="color: #c0c4cc;">-</span>
									</template>
								</el-table-column>
								<el-table-column label="SP排名" width="110" align="center" sortable :sort-method="(a: any, b: any) => { const av = a.sp?.rank > 0 ? (a.sp.page * 100 + a.sp.position) : 999999; const bv = b.sp?.rank > 0 ? (b.sp.page * 100 + b.sp.position) : 999999; return av - bv; }">
									<template #default="{ row }">
										<span v-if="row.sp && row.sp.rank > 0" style="color: #303133;">第{{ row.sp.page }}页 第{{ row.sp.position }}位</span>
										<span v-else style="color: #c0c4cc;">-</span>
									</template>
								</el-table-column>
								<el-table-column label="自然分" width="70" align="center" sortable :sort-method="(a: any, b: any) => (a.score_nf ?? -1) - (b.score_nf ?? -1)">
									<template #default="{ row }">
										<span :style="{ color: row.score_nf > 0 ? '#52c41a' : '#c0c4cc', fontWeight: row.score_nf > 0 ? 600 : 400 }">{{ row.score_nf ? (+row.score_nf).toFixed(1).replace(/\.0$/, '') : '0' }}</span>
									</template>
								</el-table-column>
								<el-table-column label="广告分" width="70" align="center" sortable :sort-method="(a: any, b: any) => (a.score_sp ?? -1) - (b.score_sp ?? -1)">
									<template #default="{ row }">
										<span :style="{ color: row.score_sp > 0 ? '#409eff' : '#c0c4cc', fontWeight: row.score_sp > 0 ? 600 : 400 }">{{ row.score_sp ? (+row.score_sp).toFixed(1).replace(/\.0$/, '') : '0' }}</span>
									</template>
								</el-table-column>
							</el-table>

							<!-- 趋势图折叠 -->
							<div style="margin-top: 10px; border-top: 1px solid #ebeef5; padding-top: 8px;">
								<div style="display: flex; align-items: center; justify-content: space-between;">
									<div
										@click="compareDetailShowChart = !compareDetailShowChart"
										style="display: flex; align-items: center; cursor: pointer; font-size: 12px; color: #409eff; user-select: none;"
									>
										<span style="margin-right: 4px;">{{ compareDetailShowChart ? '▼' : '►' }}</span>
										<span>得分趋势对比</span>
									</div>
									<div v-if="compareDetailShowChart" style="display: flex; gap: 8px;">
										<el-radio-group v-model="compareDetailTrendMetric" size="small">
											<el-radio-button label="all">全部</el-radio-button>
											<el-radio-button label="nf">只看自然</el-radio-button>
											<el-radio-button label="sp">只看广告</el-radio-button>
										</el-radio-group>
									</div>
								</div>

								<div v-if="compareDetailShowChart" style="height: 220px; margin-top: 6px;">
									<v-chart
										:key="'compare_trend_' + kw.keyword"
										:option="getCompareKwTrendOption(kw.keyword)"
										:update-options="{ notMerge: true }"
										autoresize
										style="height: 100%; width: 100%;"
									/>
								</div>
							</div>
						</div>
					</div>

					<div v-if="day.keywords.length === 0" style="padding: 12px; text-align: center; color: #c0c4cc; font-size: 12px;">
						该日期无匹配数据
					</div>
				</div>
			</div>
		</div>
	</el-tab-pane>


	</el-tabs>
	</div> <!-- 右侧主体区结束 -->
	</div> <!-- 左右分栏结束 -->
	</el-dialog>



	<!-- 分析弹窗 -->
	<el-dialog
		v-model="analysisVisible"
		width="1100px"
		align-center
	>
		<template #header>
			<div style="display: flex; align-items: center; justify-content: space-between; padding-right: 20px;">
				<span>关键词分析: {{ analysisRow?.keyword_value || '' }}</span>
				<el-tooltip content="调试面板" placement="left">
					<el-icon
						:size="16"
						style="cursor: pointer; color: #909399; transition: color 0.2s;"
						@click="toggleDebugPanel"
						@mouseenter="($event.target as HTMLElement).style.color = '#409eff'"
						@mouseleave="($event.target as HTMLElement).style.color = '#909399'"
					>
						<Setting />
					</el-icon>
				</el-tooltip>
			</div>
		</template>
		<!-- 上半部分：当前排名对比 -->
		<div style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">当前排名对比</div>
		<el-table :data="analysisCurrentData" size="small" border max-height="300" row-key="_key" :row-class-name="analysisRowClassName">
			<el-table-column label="类型" width="80" align="center">
				<template #default="{ row }">
					<el-tag :type="row._type === '自己' ? 'success' : row._type === '公司' ? 'primary' : 'danger'" size="small" effect="dark">{{ row._type }}</el-tag>
				</template>
			</el-table-column>
			<el-table-column label="ASIN" min-width="210">
				<template #default="{ row }">
					<div style="display: flex; align-items: center; gap: 8px;">
						<el-popover v-if="row.image_url" placement="right" trigger="hover" :width="220" :show-after="300" :persistent="false">
							<template #reference>
								<el-image
									:src="convert_image_url(row.image_url)"
									:preview-src-list="[convert_image_url(row.image_url)]"
									fit="contain"
									loading="lazy"
									style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 4px; border: 1px solid #ebeef5; cursor: pointer;"
									preview-teleported
									@click.stop
								/>
							</template>
							<el-image :src="convert_image_url(row.image_url)" fit="contain" loading="lazy" style="width: 200px; height: 200px;" />
						</el-popover>
						<div v-else style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 4px; background: #f5f7fa; display: flex; align-items: center; justify-content: center;">
							<el-icon :size="14" style="color: #c0c4cc;"><Picture /></el-icon>
						</div>
						<div style="min-width: 0; flex: 1;">
							<div style="display: flex; align-items: center;">
								<span style="font-size: 12px; font-weight: 600; font-family: monospace;">{{ row.asin }}</span>
								<el-tooltip v-if="row.ac" content="亚马逊精选 (Amazon's Choice)" placement="top" :hide-after="0">
									<span style="color: #67c23a; font-weight: 700; font-size: 14px; margin-left: 4px; cursor: help;">Ⓐ</span>
								</el-tooltip>
							</div>
							<div v-if="row.seller" style="font-size: 11px; color: #909399; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="row.seller">{{ row.seller }}</div>
							<div v-if="row._type !== '竞品' && asinSalesMap.has(row.asin)" style="font-size: 10px; color: #e6a23c; margin-top: 2px;">30天销量: {{ asinSalesMap.get(row.asin)?.toLocaleString() }}</div>
							<div v-if="row._type === '竞品' && asinSalesMap.has(row.asin)" style="font-size: 10px; color: #e6a23c; margin-top: 2px;">父体销量: {{ asinSalesMap.get(row.asin)?.toLocaleString() }}</div>
						</div>
					</div>
				</template>
			</el-table-column>
			<el-table-column label="自然排名" min-width="140" align="center" sortable :sort-method="(a: any, b: any) => (a.natural?.rank || 9999) - (b.natural?.rank || 9999)">
				<template #default="{ row }">
					<template v-if="row.natural">
						<span :style="{ fontWeight: row._bestNatural ? 700 : 500, color: '#303133' }">第{{ row.natural.page }}页 第{{ row.natural.position }}位</span>
						<el-tooltip v-if="row._bestNatural" content="当前自然排名最佳" placement="top"><span style="font-size: 11px; cursor: help;"> 🏆</span></el-tooltip>
					</template>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>
			<el-table-column label="SP广告" min-width="140" align="center" sortable :sort-method="(a: any, b: any) => (a.sp?.rank || 9999) - (b.sp?.rank || 9999)">
				<template #default="{ row }">
					<template v-if="row.sp && row.sp.rank > 0">
						<span :style="{ fontWeight: row._bestSp ? 700 : 500, color: '#303133' }">第{{ row.sp.page }}页 第{{ row.sp.position }}位</span>
						<el-tooltip v-if="row._bestSp" content="当前SP广告排名最佳" placement="top"><span style="font-size: 11px; cursor: help;"> 🏆</span></el-tooltip>
					</template>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>
			<el-table-column label="顶部" width="45" align="center">
				<template #default="{ row }">
					<el-tooltip v-if="row.topAd" content="顶部广告位 (Top Ad)" placement="top"><span style="color: #409eff; cursor: help;">✓</span></el-tooltip>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>
			<el-table-column label="品牌" width="45" align="center">
				<template #default="{ row }">
					<el-tooltip v-if="row.brandAd" content="品牌广告 (Brand Ad)" placement="top"><span style="color: #409eff; cursor: help;">✓</span></el-tooltip>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>
			<el-table-column label="视频" width="45" align="center">
				<template #default="{ row }">
					<el-tooltip v-if="row.videoAd" content="视频广告 (Video Ad)" placement="top"><span style="color: #409eff; cursor: help;">✓</span></el-tooltip>
					<span v-else style="color: #c0c4cc;">-</span>
				</template>
			</el-table-column>
		</el-table>

		<!-- 下半部分：排名历史 -->
		<div style="margin-top: 16px; padding-bottom: 20px;">
			<div v-if="analysisHistoryLoading" style="text-align: center; padding: 20px;">
				<el-icon class="is-loading"><Loading /></el-icon> 加载中...
			</div>
			<div v-else-if="analysisNaturalHistory.length || analysisSpHistory.length">
				<el-tabs v-model="analysisHistoryTab" class="analysis-history-tabs">
					<el-tab-pane label="自然排名历史（15天）" name="natural" lazy>
						<div style="overflow-x: auto;">
						<el-table :data="analysisNaturalHistory" size="small" border stripe max-height="320" scrollbar-always-on>
							<el-table-column prop="date" label="日期" width="100" fixed align="center" />
							<el-table-column v-for="col in analysisHistoryColumns" :key="'n_'+col.asin" :label="col.label" width="140" align="center">
								<template #header>
									<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 4px 0;">
										<el-popover v-if="col.image_url" placement="bottom" trigger="hover" :width="160" :show-after="300" :persistent="false">
											<template #reference>
												<img :src="convert_image_url(col.image_url)" loading="lazy" decoding="async" style="width: 24px; height: 24px; object-fit: contain; border-radius: 2px; border: 1px solid #ebeef5; flex-shrink: 0; background: #fff; cursor: pointer;" />
											</template>
											<el-image :src="convert_image_url(col.image_url)" fit="contain" loading="lazy" style="width: 140px; height: 140px;" />
										</el-popover>
										<span :style="{ color: col.type === '自己' ? '#67c23a' : col.type === '公司' ? '#409eff' : '#f56c6c', lineHeight: 1.2 }">{{ col.label }}</span>
										<div v-if="col.type !== '竞品' && asinSalesMap.has(col.asin)" style="font-size: 11px; color: #e6a23c; line-height: 1.2;">30天销量: {{ asinSalesMap.get(col.asin)?.toLocaleString() }}</div>
										<div v-if="col.type === '竞品' && asinSalesMap.has(col.asin)" style="font-size: 11px; color: #e6a23c; line-height: 1.2;">父体销量: {{ asinSalesMap.get(col.asin)?.toLocaleString() }}</div>
									</div>
								</template>
								<template #default="{ row, $index }">
									<template v-if="row[col.asin]">
										<span style="color: #303133;">{{ row[col.asin] }}</span>
										<span v-if="getHistoryTrend(row, col.asin, $index, analysisNaturalHistory) > 0" style="color: #67c23a; font-size: 11px; font-weight: 700; margin-left: 2px;">↑</span>
										<span v-else-if="getHistoryTrend(row, col.asin, $index, analysisNaturalHistory) < 0" style="color: #f56c6c; font-size: 11px; font-weight: 700; margin-left: 2px;">↓</span>
									</template>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
						</el-table>
						</div>
					</el-tab-pane>
					<el-tab-pane label="SP广告历史（15天）" name="sp" lazy>
						<div style="overflow-x: auto;">
						<el-table :data="analysisSpHistory" size="small" border stripe max-height="320" scrollbar-always-on>
							<el-table-column prop="date" label="日期" width="100" fixed align="center" />
							<el-table-column v-for="col in analysisHistoryColumns" :key="'s_'+col.asin" :label="col.label" width="140" align="center">
								<template #header>
									<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 4px 0;">
										<el-popover v-if="col.image_url" placement="bottom" trigger="hover" :width="160" :show-after="300" :persistent="false">
											<template #reference>
												<img :src="convert_image_url(col.image_url)" loading="lazy" decoding="async" style="width: 24px; height: 24px; object-fit: contain; border-radius: 2px; border: 1px solid #ebeef5; flex-shrink: 0; background: #fff; cursor: pointer;" />
											</template>
											<el-image :src="convert_image_url(col.image_url)" fit="contain" loading="lazy" style="width: 140px; height: 140px;" />
										</el-popover>
										<span :style="{ color: col.type === '自己' ? '#67c23a' : col.type === '公司' ? '#409eff' : '#f56c6c', lineHeight: 1.2 }">{{ col.label }}</span>
										<div v-if="col.type !== '竞品' && asinSalesMap.has(col.asin)" style="font-size: 11px; color: #e6a23c; line-height: 1.2;">30天销量: {{ asinSalesMap.get(col.asin)?.toLocaleString() }}</div>
										<div v-if="col.type === '竞品' && asinSalesMap.has(col.asin)" style="font-size: 11px; color: #e6a23c; line-height: 1.2;">父体销量: {{ asinSalesMap.get(col.asin)?.toLocaleString() }}</div>
									</div>
								</template>
								<template #default="{ row, $index }">
									<template v-if="row[col.asin]">
										<span style="color: #303133;">{{ row[col.asin] }}</span>
										<span v-if="getHistoryTrend(row, col.asin, $index, analysisSpHistory) > 0" style="color: #67c23a; font-size: 11px; font-weight: 700; margin-left: 2px;">↑</span>
										<span v-else-if="getHistoryTrend(row, col.asin, $index, analysisSpHistory) < 0" style="color: #f56c6c; font-size: 11px; font-weight: 700; margin-left: 2px;">↓</span>
									</template>
									<span v-else style="color: #c0c4cc;">-</span>
								</template>
							</el-table-column>
						</el-table>
						</div>
					</el-tab-pane>
				</el-tabs>
			</div>
			<div v-else style="color: #909399; text-align: center; padding: 20px;">暂无历史数据</div>
		</div>

		<!-- 调试面板 -->
		<div v-if="debugPanelVisible" style="margin-top: 20px; border-top: 1px dashed #dcdfe6; padding-top: 16px;">
			<div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #909399;">🔧 调试面板</div>
			<el-tabs v-model="debugTab">
				<el-tab-pane label="排名总览" name="overview">
					<div v-if="debugTrackData">
						<div style="margin-bottom: 12px; display: flex; gap: 20px; flex-wrap: wrap; color: #606266; font-size: 13px;">
							<span>站点: <b>{{ debugTrackData.site }}</b></span>
							<span>总商品数: <b style="color: #E6A23C">{{ debugTrackData.totalResultCount?.toLocaleString() }}</b></span>
							<span>更新时间: <b>{{ debugTrackData.preciseUpdateTime ? new Date(debugTrackData.preciseUpdateTime).toLocaleString() : '-' }}</b></span>
						</div>
						<el-tabs v-if="debugTrackData.pages?.length">
							<el-tab-pane v-for="page in debugTrackData.pages" :key="page.pageNum" :label="`第 ${page.pageNum} 页`" lazy>
								<div style="font-size: 13px; color: #909399; margin-bottom: 12px;">每页 {{ page.productCntPerPage }} 个商品 · 邮编: {{ page.zipCode }}</div>
								<div v-if="page.nfAsin?.length" style="margin-bottom: 14px">
									<div style="font-weight: 600; margin-bottom: 6px; color: #409EFF">🔵 自然排名 ({{ page.nfAsin.length }})</div>
									<div style="display: flex; flex-wrap: wrap; gap: 6px">
										<el-tag v-for="(asin, idx) in page.nfAsin" :key="asin" size="small">{{ Number(idx) + 1 }}. {{ asin }}</el-tag>
									</div>
								</div>
								<div v-if="page.spAsin?.length" style="margin-bottom: 14px">
									<div style="font-weight: 600; margin-bottom: 6px; color: #E6A23C">🟡 SP广告 ({{ page.spAsin.length }})</div>
									<div style="display: flex; flex-wrap: wrap; gap: 6px">
										<el-tag v-for="asin in page.spAsin" :key="asin" type="warning" size="small">{{ asin }}</el-tag>
									</div>
								</div>
								<div v-if="page.acAsin?.length" style="margin-bottom: 14px">
									<div style="font-weight: 600; margin-bottom: 6px; color: #67C23A">🟢 Amazon's Choice ({{ page.acAsin.length }})</div>
									<div style="display: flex; flex-wrap: wrap; gap: 6px">
										<el-tag v-for="asin in page.acAsin" :key="asin" type="success" size="small">{{ asin }}</el-tag>
									</div>
								</div>
								<div v-if="page.topAdAsin?.length" style="margin-bottom: 14px">
									<div style="font-weight: 600; margin-bottom: 6px; color: #F56C6C">🔴 顶部广告 ({{ page.topAdAsin.length }})</div>
									<div style="display: flex; flex-wrap: wrap; gap: 6px">
										<el-tag v-for="asin in page.topAdAsin" :key="asin" type="danger" size="small">{{ asin }}</el-tag>
									</div>
								</div>
								<div v-if="page.topBrand" style="margin-bottom: 14px">
									<div style="font-weight: 600; margin-bottom: 6px; color: #9B59B6">🟣 品牌广告SB: {{ page.topBrand.brand }}</div>
									<div style="display: flex; flex-wrap: wrap; gap: 6px">
										<el-tag v-for="asin in page.topBrand.asins" :key="asin" color="#F3E8FF" style="color: #7C3AED; border-color: #D8B4FE" size="small">{{ asin }}</el-tag>
									</div>
								</div>
								<div v-if="page.bottomAdAsins?.length" style="margin-bottom: 14px">
									<div style="font-weight: 600; margin-bottom: 6px; color: #909399">⚫ 底部广告 ({{ page.bottomAdAsins.length }})</div>
									<div style="display: flex; flex-wrap: wrap; gap: 6px">
										<el-tag v-for="asin in page.bottomAdAsins" :key="asin" type="info" size="small">{{ asin }}</el-tag>
									</div>
								</div>
								<div v-if="page.videoAdAsins?.length" style="margin-bottom: 14px">
									<div style="font-weight: 600; margin-bottom: 6px; color: #E91E63">🎬 视频广告 ({{ page.videoAdAsins.length }})</div>
									<div style="display: flex; flex-wrap: wrap; gap: 6px">
										<el-tag v-for="asin in page.videoAdAsins" :key="asin" type="danger" effect="plain" size="small">{{ asin }}</el-tag>
									</div>
								</div>
								<div v-if="page.relatedSearches?.length" style="margin-bottom: 14px">
									<div style="font-weight: 600; margin-bottom: 6px; color: #606266">🔍 联想搜索 ({{ page.relatedSearches.length }})</div>
									<div style="display: flex; flex-wrap: wrap; gap: 6px">
										<el-tag v-for="s in page.relatedSearches" :key="s" effect="plain" size="small">{{ s }}</el-tag>
									</div>
								</div>
							</el-tab-pane>
						</el-tabs>
						<el-empty v-else description="暂无页面数据" />
					</div>
					<el-empty v-else description="暂无排名数据" />
				</el-tab-pane>
				<el-tab-pane label="分析结果" name="analysis_json">
					<pre style="max-height: 400px; overflow: auto; background: #f5f7fa; padding: 16px; border-radius: 4px; font-size: 12px; line-height: 1.5;">{{ debugAnalysisJson }}</pre>
				</el-tab-pane>
				<el-tab-pane label="原始API数据" name="raw_json">
					<pre style="max-height: 400px; overflow: auto; background: #f5f7fa; padding: 16px; border-radius: 4px; font-size: 12px; line-height: 1.5;">{{ debugRawJson }}</pre>
				</el-tab-pane>
			</el-tabs>
		</div>
	</el-dialog>
</template>

<script lang="ts" setup>
import { ref, shallowRef, computed, watch, nextTick } from "vue";
import { Setting, QuestionFilled, InfoFilled, WarningFilled } from "@element-plus/icons-vue";
import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox } from "element-plus";
import { Delete, Loading, Search, Refresh, Picture, DataLine } from "@element-plus/icons-vue";
import { convert_image_url } from "../utils";

import VChart from "vue-echarts";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart, LineChart } from "echarts/charts";
import {
	GridComponent,
	TooltipComponent,
	LegendComponent,
	TitleComponent,
	DataZoomComponent
} from "echarts/components";

use([
	CanvasRenderer,
	BarChart,
	LineChart,
	GridComponent,
	TooltipComponent,
	LegendComponent,
	TitleComponent,
	DataZoomComponent
]);

const { service } = useCool();

const props = defineProps<{
	modelValue: boolean;
	listingRow: any;
}>();

const emit = defineEmits(["update:modelValue", "changed"]);

const visible = computed({
	get: () => props.modelValue,
	set: (val) => emit("update:modelValue", val),
});

const loading = ref(false);
const tableData = ref<any[]>([]);

const searchKeyword = ref("");
const currentPage = ref(1);
const pageSize = ref(20);
const selectedRows = ref<any[]>([]);
const historyFetching = ref(false);
const stopMyTrackingLoading = ref(false);

// ===== 主Tab =====
const mainTab = ref('list');

// ===== 左侧ASIN总分面板 =====
const scoreSummaryLoading = ref(false);
const scoreSummaryData = ref<any[]>([]);
const scoreSummaryView = ref<'list' | 'chart'>('list'); // 列表 / 图表 切换
const scoreSortMode = ref<'default' | 'field'>('default'); // default=按类型分组, field=按字段排序
const scoreSortField = ref<'avgNf' | 'avgSp'>('avgNf'); // 排序字段
const scoreSortOrder = ref<'desc' | 'asc'>('desc');     // 排序方向
let summaryRequestSeq = 0;

// 实时销量数据映射
const asinSalesMap = shallowRef<Map<string, number>>(new Map());
// 竞品月销量走势数据（sales_volume_data + price，用于图表渲染）
const competitorTrendMap = shallowRef<Map<string, { sales_volume_data: any; price: string | null }>>(new Map());

// 迷你月销量走势图配置生成器
function generateMiniTrendOption(salesData: any[]) {
	if (!salesData || !Array.isArray(salesData) || salesData.length === 0) return null;
	const data = [...salesData].sort((a, b) => String(a.date).localeCompare(String(b.date)));
	const xData = data.map(item => {
		const d = String(item.date);
		return d.length >= 6 ? `${d.substring(0, 4)}年${d.substring(4, 6)}月` : d;
	});
	const yData = data.map(item => Number(item.searches || 0));
	return {
		tooltip: {
			trigger: 'axis',
			appendToBody: true,
			backgroundColor: 'rgba(50, 50, 50, 0.9)',
			borderColor: '#333',
			textStyle: { color: '#fff', fontSize: 11 },
			formatter: (params: any) => {
				const p = params[0];
				if (!p) return '';
				const vol = yData[p.dataIndex];
				return `<div style="font-size:11px;"><div>${p.axisValue}</div><div>销量: <b>${vol}</b></div></div>`;
			},
		},
		grid: { left: 0, right: 0, top: 2, bottom: 0, containLabel: false },
		xAxis: { type: 'category', data: xData, show: false, boundaryGap: false },
		yAxis: { type: 'value', show: false, min: 0 },
		series: [{
			data: yData,
			type: 'line',
			smooth: true,
			showSymbol: false,
			lineStyle: { width: 1, color: '#ff9900' },
			areaStyle: {
				color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
					{ offset: 0, color: 'rgba(255, 153, 0, 0.3)' },
					{ offset: 1, color: 'rgba(255, 153, 0, 0.05)' },
				]},
			},
			itemStyle: { color: '#ff9900' },
		}],
	};
}

// 排序后的数据（列表和图表共用）
const sortedScoreSummaryData = computed(() => {
	const data = [...scoreSummaryData.value];
	if (scoreSortMode.value === 'default') {
		// 默认：自己在上 → 公司 → 竞品，同类型内按总分降序
		const typeOrder: Record<string, number> = { '自己': 0, '公司': 1, '竞品': 2 };
		return data.sort((a, b) => {
			const ta = typeOrder[a.type] ?? 9;
			const tb = typeOrder[b.type] ?? 9;
			if (ta !== tb) return ta - tb;
			return (b.avgNf + b.avgSp) - (a.avgNf + a.avgSp);
		});
	}
	// 按字段排序
	const field = scoreSortField.value;
	const dir = scoreSortOrder.value === 'desc' ? -1 : 1;
	return data.sort((a, b) => ((a[field] || 0) - (b[field] || 0)) * dir);
});

// 切换排序（点击同一字段切换升降序，点击不同字段默认降序）
function toggleScoreSort(field: 'avgNf' | 'avgSp') {
	scoreSortMode.value = 'field';
	if (scoreSortField.value === field) {
		scoreSortOrder.value = scoreSortOrder.value === 'desc' ? 'asc' : 'desc';
	} else {
		scoreSortField.value = field;
		scoreSortOrder.value = 'desc';
	}
}

// 图表图例选中状态（控制显示/隐藏）
const chartLegendSelected = ref<Record<string, boolean>>({
	'自然综合分': true,
	'SP综合分': true,
});

// 图例点击：切换排序 + 控制显示
function handleChartLegendClick(params: any) {
	const name = params.name as string;
	const selected = params.selected as Record<string, boolean>;

	// 更新显示状态
	chartLegendSelected.value = { ...selected };

	// 映射图例名→排序字段
	const fieldMap: Record<string, 'avgNf' | 'avgSp'> = {
		'自然综合分': 'avgNf',
		'SP综合分': 'avgSp',
	};
	const field = fieldMap[name];
	if (field && selected[name]) {
		// 显示该系列时 → 按该字段排序
		toggleScoreSort(field);
	}
}

// ===== 关键词得分Tab =====
const scoreCurrentView = ref<'table' | 'chart'>('table');
const scoreHistoryView = ref<'table' | 'chart'>('chart');
const scoreHistoryMetric = ref<'nf' | 'sp'>('nf');
const scoreHistorySelectedAsins = ref<Record<string, string[]>>({});
const scoreFilterType = ref('全部');
const scoreSearchAsin = ref('');
const scoreCollapseActive = ref<string[] | string>([]);
const scoreGlobalDate = ref('');
const availableScoreDates = ref<string[]>([]);
const scoreSnapshotsLoading = ref(false);

const scoreHistoryState = ref<Record<string, boolean>>({});
const scoreHistoryLoading = ref<Record<string, boolean>>({});
const scoreHistoryCache = ref<Record<string, any>>({});

function isScoreCollapseActive(keyword: string) {
	const active = scoreCollapseActive.value;
	return Array.isArray(active) ? active.includes(keyword) : active === keyword;
}

// ===== 对比分析Tab =====
// rawData[asin][keyword][date] = { nf, sp } - 从 calcScoreSummary 保存
const compareRawData = shallowRef<Map<string, Map<string, Map<string, { nf: number; sp: number }>>>>(new Map());
const compareSource = ref(''); // A侧 ASIN (默认是我方)
const compareTarget = ref(''); // B侧 ASIN (通常是竞品)
const compareFilter = ref<'opponent' | 'self' | 'all'>('opponent'); // 对方领先 / 我方领先 / 全部
const compareExpandedDays = ref<string[]>([]); // 展开的日期列表

const compareSourcePopoverVisible = ref(false);
const compareTargetPopoverVisible = ref(false);

// 找到"自己"的ASIN
const selfAsin = computed(() => {
	const self = scoreSummaryData.value.find(r => r.type === '自己');
	return self?.asin || '';
});

// A侧的图片/类型/卖家信息
const sourceAsinInfo = computed(() => {
	return scoreSummaryData.value.find(r => r.asin === compareSource.value) || null;
});

// B侧的图片/类型/卖家信息
const targetAsinInfo = computed(() => {
	return scoreSummaryData.value.find(r => r.asin === compareTarget.value) || null;
});

// 动态名字（统一用type原始值，同类型时加A/B后缀区分）
const sourceName = computed(() => {
	if (!sourceAsinInfo.value) return 'A侧';
	const myType = sourceAsinInfo.value.type;
	if (myType === targetAsinInfo.value?.type) return myType + 'A';
	return myType;
});
const targetName = computed(() => {
	if (!targetAsinInfo.value) return 'B侧';
	const myType = targetAsinInfo.value.type;
	if (myType === sourceAsinInfo.value?.type) return myType + 'B';
	return myType;
});

// 对比数据计算（只使用合格数据，与总分一致）
const compareData = computed(() => {
	if (!compareTarget.value || !compareSource.value) return [];
	const rawData = compareRawData.value;
	const myData = rawData.get(compareSource.value);
	const theirData = rawData.get(compareTarget.value);
	if (!myData || !theirData) return [];

	// ===== 对两个ASIN分别做合格性判断 =====
	function getQualified(asinData: Map<string, Map<string, { nf: number; sp: number }>>) {
		const nfKws = new Set<string>();
		const spKws = new Set<string>();
		for (const [kw, dateMap] of asinData) {
			let nfDays = 0, spDays = 0;
			for (const [, s] of dateMap) {
				if (s.nf > 0) nfDays++;
				if (s.sp > 0) spDays++;
			}
			if (nfDays >= MIN_QUALIFIED_DAYS) nfKws.add(kw);
			if (spDays >= MIN_QUALIFIED_DAYS) spKws.add(kw);
		}
		return { nfKws, spKws };
	}

	const myQ = getQualified(myData);
	const theirQ = getQualified(theirData);

	// 收集所有日期（只从合格的关键词里收集）
	const allDates = new Set<string>();
	const allKeywords = new Set<string>();

	for (const [kw, dateMap] of myData) {
		if (myQ.nfKws.has(kw) || myQ.spKws.has(kw)) {
			allKeywords.add(kw);
			for (const d of dateMap.keys()) allDates.add(d);
		}
	}
	for (const [kw, dateMap] of theirData) {
		if (theirQ.nfKws.has(kw) || theirQ.spKws.has(kw)) {
			allKeywords.add(kw);
			for (const d of dateMap.keys()) allDates.add(d);
		}
	}

	const sortedDates = [...allDates].sort((a, b) => b.localeCompare(a));
	const result: any[] = [];

	for (const date of sortedDates) {
		let myDayNf = 0, myDaySp = 0;
		let theirDayNf = 0, theirDaySp = 0;
		const keywords: any[] = [];

		for (const kw of allKeywords) {
			const myRaw = myData.get(kw)?.get(date) || { nf: 0, sp: 0 };
			const theirRaw = theirData.get(kw)?.get(date) || { nf: 0, sp: 0 };

			// 只用合格的指标
			const myNf = myQ.nfKws.has(kw) ? myRaw.nf : 0;
			const mySp = myQ.spKws.has(kw) ? myRaw.sp : 0;
			const theirNf = theirQ.nfKws.has(kw) ? theirRaw.nf : 0;
			const theirSp = theirQ.spKws.has(kw) ? theirRaw.sp : 0;

			const myTotal = myNf + mySp;
			const theirTotal = theirNf + theirSp;
			const diff = theirTotal - myTotal;

			myDayNf += myNf;
			myDaySp += mySp;
			theirDayNf += theirNf;
			theirDaySp += theirSp;

			const show = compareFilter.value === 'all'
				|| (compareFilter.value === 'opponent' && diff > 0)
				|| (compareFilter.value === 'self' && diff < 0);

			if (show && (myTotal > 0 || theirTotal > 0)) {
				keywords.push({
					keyword: kw,
					myNf, mySp, myTotal,
					theirNf, theirSp, theirTotal,
					diff,
				});
			}
		}

		const myDayTotal = myDayNf + myDaySp;
		const theirDayTotal = theirDayNf + theirDaySp;
		const dayDiff = theirDayTotal - myDayTotal;
		const nfDiff = theirDayNf - myDayNf;
		const spDiff = theirDaySp - myDaySp;
		const showDay = compareFilter.value === 'all'
			|| (compareFilter.value === 'opponent' && dayDiff > 0)
			|| (compareFilter.value === 'self' && dayDiff < 0);

		if (showDay && (myDayTotal > 0 || theirDayTotal > 0)) {
			keywords.sort((a: any, b: any) => Math.abs(b.diff) - Math.abs(a.diff));
			result.push({
				date,
				myTotal: myDayTotal,
				theirTotal: theirDayTotal,
				diff: dayDiff,
				nfDiff,
				spDiff,
				keywords,
			});
		}
	}

	return result;
});

// 打开对比视图 (默认A侧是我方，B侧是被点击的ASIN)
function openCompare(asin: string) {
	if (!compareSource.value) {
		compareSource.value = selfAsin.value || scoreSummaryData.value[0]?.asin || '';
	}

	if (asin === compareSource.value) {
		ElMessage.warning('对比双方不能是同一个 ASIN');
		return;
	}

	// 检查自己是否有数据
	const rawData = compareRawData.value;
	const myData = rawData.get(compareSource.value);
	if (!myData || myData.size === 0) {
		ElMessage.warning(`${compareSource.value} 暂无排名数据，无法进行对比分析`);
		return;
	}

	// 检查对方是否有数据
	const theirData = rawData.get(asin);
	if (!theirData || theirData.size === 0) {
		ElMessage.warning(`${asin} 暂无排名数据，无法进行对比`);
		return;
	}

	compareTarget.value = asin;
	compareFilter.value = 'opponent';
	compareExpandedDays.value = [];
	compareDetailKey.value = '';
	mainTab.value = 'compare';
}

// 在对比页内切换选人
function changeCompareAsin(side: 'source' | 'target', asin: string) {
	if (side === 'source' && asin === compareTarget.value) {
		ElMessage.warning('对比双方不能是同一个 ASIN');
		return;
	}
	if (side === 'target' && asin === compareSource.value) {
		ElMessage.warning('对比双方不能是同一个 ASIN');
		return;
	}
	
	const rawData = compareRawData.value;
	const data = rawData.get(asin);
	if (!data || data.size === 0) {
		ElMessage.warning(`${asin} 暂无有效排名数据`);
		return;
	}

	if (side === 'source') {
		compareSource.value = asin;
		compareSourcePopoverVisible.value = false;
	} else {
		compareTarget.value = asin;
		compareTargetPopoverVisible.value = false;
	}
	compareExpandedDays.value = [];
	compareDetailKey.value = ''; // 收起展开的关键词详情，避免显示旧数据
}

// 关闭对比视图
function closeCompare() {
	compareTarget.value = '';
	compareSource.value = ''; // 重置，下次开启对比时重新默认为自己
	mainTab.value = 'list';
}

// 从对比视图跳转到关键词得分
function jumpToScoreTab(date: string) {
	scoreGlobalDate.value = date;
	mainTab.value = 'score';
}

// ===== 对比详情：关键词展开面板 =====
const compareDetailKey = ref(''); // 当前展开的关键词 格式: "date|keyword"
const compareDetailLoading = ref(false);
const compareDetailData = ref<any[]>([]); // 排名表数据
const compareDetailShowChart = ref(false); // 是否显示趋势图
const compareDetailTrendMetric = ref<'all' | 'nf' | 'sp'>('all'); // 趋势图显示的指标

function toggleCompareDetail(date: string, keyword: string) {
	const key = `${date}|${keyword}`;
	if (compareDetailKey.value === key) {
		compareDetailKey.value = ''; // 收起
		return;
	}
	compareDetailKey.value = key;
	compareDetailShowChart.value = false;
	compareDetailTrendMetric.value = 'all';
	loadCompareDetail(date, keyword);
}

async function loadCompareDetail(date: string, keyword: string) {
	compareDetailLoading.value = true;
	compareDetailData.value = [];

	try {
		// 找到这个关键词的 tracking row
		const row = tableData.value.find(r => r.keyword_value === keyword);
		if (!row) return;

		// 加载快照
		const res = await service.app.bsr_keyword_tracking_snapshot.page({
			tracking_id: row.id,
			size: 15,
			page: 1,
		});
		const snapList = res?.list || [];

		// 找到对应日期的快照
		const snap = snapList.find((s: any) => String(s.snapshot_date) === date);
		if (!snap) return;

		const analysis = typeof snap.analysis_data === 'string'
			? JSON.parse(snap.analysis_data)
			: snap.analysis_data;
		if (!analysis) return;

		// 构建排名表——根据 compareSource/compareTarget 动态找
		// 剪出当前两侧的显示名，与头部标签直接同步
		const _srcLabel = sourceName.value;
		const _tgtLabel = targetName.value;

		const list: any[] = [];
		if (analysis.self?.asin) {
			const asinStr = String(analysis.self.asin);
			const isSource = asinStr === compareSource.value;
			const isTarget = asinStr === compareTarget.value;
			list.push({ ...analysis.self, _type: isSource ? _srcLabel : isTarget ? _tgtLabel : '自己', _origType: '自己', _isSelf: isSource, _isTarget: isTarget });
		}
		for (const c of (analysis.company || [])) {
			const asinStr = String(c.asin);
			const isSource = asinStr === compareSource.value;
			const isTarget = asinStr === compareTarget.value;
			list.push({ ...c, _type: isSource ? _srcLabel : isTarget ? _tgtLabel : '公司', _origType: '公司', _isSelf: isSource, _isTarget: isTarget });
		}
		for (const c of (analysis.competitor || [])) {
			const asinStr = String(c.asin);
			const isSource = asinStr === compareSource.value;
			const isTarget = asinStr === compareTarget.value;
			list.push({ ...c, _type: isSource ? _srcLabel : isTarget ? _tgtLabel : '竞品', _origType: '竞品', _isSelf: isSource, _isTarget: isTarget });
		}

		// 排序：我方 > 对比竞品 > 其他（按自然排名）
		list.sort((a, b) => {
			if (a._isSelf) return -1;
			if (b._isSelf) return 1;
			if (a._isTarget) return -1;
			if (b._isTarget) return 1;
			const ra = a.natural?.rank ?? 999;
			const rb = b.natural?.rank ?? 999;
			return ra - rb;
		});

		compareDetailData.value = list;
	} catch (e) {
		console.warn('加载对比详情失败:', e);
	} finally {
		compareDetailLoading.value = false;
	}
}

// 关键词趋势图（我方 vs 竞品，可切换NF/SP）
function getCompareKwTrendOption(keyword: string): any {
	const rawData = compareRawData.value;
	const myDateMap = rawData.get(compareSource.value)?.get(keyword);
	const theirDateMap = rawData.get(compareTarget.value)?.get(keyword);

	// 收集所有日期
	const allDates = new Set<string>();
	if (myDateMap) for (const d of myDateMap.keys()) allDates.add(d);
	if (theirDateMap) for (const d of theirDateMap.keys()) allDates.add(d);
	const sortedDates = [...allDates].sort();

	const myNfSeries = sortedDates.map(d => { const s = myDateMap?.get(d); return s?.nf ?? null; });
	const mySpSeries = sortedDates.map(d => { const s = myDateMap?.get(d); return s?.sp ?? null; });
	const theirNfSeries = sortedDates.map(d => { const s = theirDateMap?.get(d); return s?.nf ?? null; });
	const theirSpSeries = sortedDates.map(d => { const s = theirDateMap?.get(d); return s?.sp ?? null; });

	const metric = compareDetailTrendMetric.value;
	const series: any[] = [];
	const legendData: string[] = [];

	// 选手名字：直接复用 sourceName/targetName，保持全局一致
	const sLabel = sourceName.value;
	const tLabel = targetName.value;

	if (metric === 'all' || metric === 'nf') {
		legendData.push(`${sLabel}自然`, `${tLabel}自然`);
		series.push({
			name: `${sLabel}自然`, type: 'line', data: myNfSeries, smooth: true,
			showSymbol: true, symbolSize: 5,
			lineStyle: { color: '#52c41a', width: 2 },
			itemStyle: { color: '#52c41a' },
			areaStyle: metric === 'nf' ? { color: 'rgba(82,196,26,0.06)' } : undefined,
		});
		series.push({
			name: `${tLabel}自然`, type: 'line', data: theirNfSeries, smooth: true,
			showSymbol: true, symbolSize: 5,
			lineStyle: { color: '#f56c6c', width: 2 },
			itemStyle: { color: '#f56c6c' },
			areaStyle: metric === 'nf' ? { color: 'rgba(245,108,108,0.06)' } : undefined,
		});
	}

	if (metric === 'all' || metric === 'sp') {
		legendData.push(`${sLabel}广告`, `${tLabel}广告`);
		series.push({
			name: `${sLabel}广告`, type: 'line', data: mySpSeries, smooth: true,
			showSymbol: true, symbolSize: 5,
			lineStyle: { color: '#52c41a', width: metric === 'sp' ? 2 : 1.5, type: metric === 'sp' ? 'solid' : 'dashed' },
			itemStyle: { color: metric === 'sp' ? '#52c41a' : '#95de64' },
			areaStyle: metric === 'sp' ? { color: 'rgba(82,196,26,0.06)' } : undefined,
		});
		series.push({
			name: `${tLabel}广告`, type: 'line', data: theirSpSeries, smooth: true,
			showSymbol: true, symbolSize: 5,
			lineStyle: { color: '#f56c6c', width: metric === 'sp' ? 2 : 1.5, type: metric === 'sp' ? 'solid' : 'dashed' },
			itemStyle: { color: metric === 'sp' ? '#f56c6c' : '#ff9c9c' },
			areaStyle: metric === 'sp' ? { color: 'rgba(245,108,108,0.06)' } : undefined,
		});
	}

	return {
		tooltip: {
			trigger: 'axis',
			backgroundColor: 'rgba(255,255,255,0.97)',
			borderColor: '#ebeef5',
			textStyle: { color: '#303133', fontSize: 12 },
			formatter: (params: any[]) => {
				let html = '';

				// 头部：A/B两侧产品卡片
				html += `<div style="display:flex;gap:10px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #f0f0f0;">`;
				// A侧
				const sImgUrl = sourceAsinInfo.value?.image_url;
				const sSeller = sourceAsinInfo.value?.seller;
				html += `<div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">`;
				if (sImgUrl) html += `<img src="${sImgUrl}" style="width:32px;height:32px;object-fit:contain;border-radius:3px;border:1px solid #d9f7be;flex-shrink:0;" />`;
				html += `<div style="min-width:0;"><div style="font-size:11px;font-weight:600;color:#52c41a;">${sLabel}</div>`;
				if (sSeller) html += `<div style="font-size:10px;color:#909399;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px;">${sSeller}</div>`;
				html += `</div></div>`;
				// 中间分隔
				html += `<div style="display:flex;align-items:center;font-size:10px;color:#c0c4cc;">vs</div>`;
				// B侧
				const tImgUrl = targetAsinInfo.value?.image_url;
				const tSeller = targetAsinInfo.value?.seller;
				html += `<div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">`;
				if (tImgUrl) html += `<img src="${tImgUrl}" style="width:32px;height:32px;object-fit:contain;border-radius:3px;border:1px solid #ffd6d6;flex-shrink:0;" />`;
				html += `<div style="min-width:0;"><div style="font-size:11px;font-weight:600;color:#f56c6c;">${tLabel}</div>`;
				if (tSeller) html += `<div style="font-size:10px;color:#909399;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px;">${tSeller}</div>`;
				html += `</div></div>`;
				html += `</div>`;

				html += `<div style="font-size:12px;color:#909399;margin-bottom:6px;">${params[0].name}</div>`;
				let myNf: number | null = null, mySp: number | null = null, theirNf: number | null = null, theirSp: number | null = null;

				params.forEach(p => {
					// 渲染默认的指标行
					html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 12px;">
						<div style="display: flex; align-items: center;">${p.marker}<span style="color: #606266; margin-left: 2px;">${p.seriesName}</span></div>
						<span style="font-weight: 600; margin-left: 20px;">${p.value ?? '-'}</span>
					</div>`;
					if (p.seriesName.endsWith('自然') && !p.seriesName.includes(tLabel)) myNf = p.value;
					if (p.seriesName.endsWith('自然') && p.seriesName.includes(tLabel)) theirNf = p.value;
					if (p.seriesName.endsWith('广告') && !p.seriesName.includes(tLabel)) mySp = p.value;
					if (p.seriesName.endsWith('广告') && p.seriesName.includes(tLabel)) theirSp = p.value;
				});

				let hasDiff = false;
				let diffHtml = '';

				if (myNf !== null && theirNf !== null && (myNf > 0 || theirNf > 0)) {
					const diff = theirNf - myNf;
					const color = diff > 0 ? '#f56c6c' : diff < 0 ? '#67c23a' : '#909399';
					const text = diff > 0 ? `${tLabel}+${diff.toFixed(0)}` : diff < 0 ? `${sLabel}+${Math.abs(diff).toFixed(0)}` : '持平';
					diffHtml += `<div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
						<span style="color: #909399;">自然差值</span><span style="font-weight: 600; color: ${color};">${text}</span>
					</div>`;
					hasDiff = true;
				}

				if (mySp !== null && theirSp !== null && (mySp > 0 || theirSp > 0)) {
					const diff = theirSp - mySp;
					const color = diff > 0 ? '#f56c6c' : diff < 0 ? '#67c23a' : '#909399';
					const text = diff > 0 ? `${tLabel}+${diff.toFixed(0)}` : diff < 0 ? `${sLabel}+${Math.abs(diff).toFixed(0)}` : '持平';
					diffHtml += `<div style="display: flex; justify-content: space-between; font-size: 11px;">
						<span style="color: #909399;">广告差值</span><span style="font-weight: 600; color: ${color};">${text}</span>
					</div>`;
					hasDiff = true;
				}

				if (hasDiff) {
					html += `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #ebeef5;">${diffHtml}</div>`;
				}

				return html;
			}
		},
		legend: {
			data: legendData,
			top: 0, right: 0,
			textStyle: { fontSize: 10, color: '#606266' },
			itemWidth: 16, itemHeight: 3,
		},
		grid: { left: 40, right: 16, top: 30, bottom: 30 },
		xAxis: {
			type: 'category',
			data: sortedDates,
			axisLabel: { fontSize: 10, color: '#909399' },
			axisTick: { show: false },
		},
		yAxis: {
			type: 'value',
			splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
			axisLabel: { fontSize: 10, color: '#c0c4cc' },
		},
		series: series,
		animationDuration: 400,
	};
}

// 切到关键词得分Tab时，默认展开第一条
watch(mainTab, (val) => {
	if (val === 'score' && scoreKeywordList.value.length > 0) {
		scoreCollapseActive.value = [scoreKeywordList.value[0].keyword];
	}
});

// 关键词得分：为每个关键词构建 ASIN 得分列表
const scoreKeywordList = computed(() => {
	// 依赖于全局日期 scoreGlobalDate
	const date = scoreGlobalDate.value;
	return tableData.value
		.filter(row => row._snapshots && row._snapshots.length > 0)
		.map(row => {
			let snap = row._snapshots[0];
			let isFallback = false;
			if (date) {
				const found = row._snapshots.find((s: any) => s.snapshot_date === date);
				if (found) {
					snap = found;
				} else {
					isFallback = true; // 选中日期无数据，使用最新快照
				}
			}
			const actualDate = snap.snapshot_date;
			
			const analysis = snap.analysis_data_parsed;
			if (!analysis) return null;
			
			const asins: any[] = [];

			// 自己
			if (analysis.self) {
				asins.push({ ...analysis.self, type: '自己' });
			}
			// 公司
			for (const c of (analysis.company || [])) {
				asins.push({ ...c, type: '公司' });
			}
			// 竞品
			for (const c of (analysis.competitor || [])) {
				asins.push({ ...c, type: '竞品' });
			}

			// 筛选
			const filterType = scoreFilterType.value;
			const searchAsin = scoreSearchAsin.value?.toUpperCase() || '';
			const filteredAsins = asins.filter(a => {
				if (filterType !== '全部' && a.type !== filterType) return false;
				if (searchAsin && !a.asin?.toUpperCase().includes(searchAsin)) return false;
				return true;
			});

			// 全量（未过滤）用于统计各类型数量
			const allAsins = asins;
			const countSelf = allAsins.filter((a: any) => a.type === '自己').length;
			const countCompany = allAsins.filter((a: any) => a.type === '公司').length;
			const countCompetitor = allAsins.filter((a: any) => a.type === '竞品').length;

			return {
				keyword: row.keyword_value,
				valueCn: row._value_cn,
				sifScore: row._sifScore,
				searchVolume: row._searchVolume,
				trackingId: row.id,
				allAsins,
				countSelf,
				countCompany,
				countCompetitor,
				filteredAsins,
				actualDate,
				isFallback,
			};
		})
		.filter((kw): kw is any => kw !== null && kw.allAsins.length > 0);
});

function scoreRowClassName({ row }: any) {
	if (row.type === '自己') return 'analysis-row-self';
	return '';
}

// 历史趋势颜色样式
function scoreColorStyle(score: number | undefined | null) {
	if (score == null || score === 0) return { color: '#c0c4cc' };
	if (score > 50) return { fontWeight: 600, color: '#67c23a' };
	if (score > 20) return { fontWeight: 600, color: '#e6a23c' };
	return { fontWeight: 600, color: '#909399' };
}

function parseSnapshotAnalysis(snap: any) {
	return snap?.analysis_data_parsed
		|| (typeof snap?.analysis_data === 'string' ? JSON.parse(snap.analysis_data) : snap?.analysis_data);
}

async function yieldToBrowserPaint() {
	await nextTick();
	await new Promise<void>((resolve) => {
		if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
			resolve();
			return;
		}
		window.requestAnimationFrame(() => {
			window.setTimeout(resolve, 0);
		});
	});
}

function getCachedSnapshots(trackingId: number) {
	const row = tableData.value.find((r: any) => Number(r.id) === Number(trackingId));
	return Array.isArray(row?._snapshots) ? row._snapshots : [];
}

async function getTrackingSnapshots(trackingId: number) {
	const cached = getCachedSnapshots(trackingId);
	if (cached.length > 0) return cached;

	const res = await service.app.bsr_keyword_tracking_snapshot.page({
		tracking_id: trackingId,
		size: 15,
		page: 1,
	});
	return res?.list || [];
}

// 懒加载历史趋势
async function toggleScoreHistory(keyword: string, trackingId: number) {
	const currentState = scoreHistoryState.value[keyword];
	if (currentState) {
		scoreHistoryState.value[keyword] = false;
		return;
	}

	scoreHistoryState.value[keyword] = true;
	if (scoreHistoryCache.value[keyword]) return; // 已加载过
	
	scoreHistoryLoading.value[keyword] = true;
	
	try {
		const snapList = await getTrackingSnapshots(trackingId);
		
		// 重要：用 allAsins（全量）而不是 filteredAsins（当前筛选），历史对比不受当日筛选影响
		const currentKw = scoreKeywordList.value.find((k: any) => k.keyword === keyword);
		const allAsins = currentKw?.allAsins || currentKw?.filteredAsins || [];
		const columns = allAsins.map((a: any) => ({
			asin: a.asin,
			type: a.type,
			label: a.asin,
			image_url: a.image_url,
			seller: a.seller
		}));

		const rows = snapList.map((snap: any) => {
			const analysis = parseSnapshotAnalysis(snap);
			const rowData: any = { date: snap.snapshot_date };
			if (!analysis) return rowData;
			// 自己
			if (analysis.self) {
				rowData[analysis.self.asin + '_nf'] = analysis.self.score_nf ?? null;
				rowData[analysis.self.asin + '_sp'] = analysis.self.score_sp ?? null;
			}
			// 公司
			for (const c of (analysis.company || [])) {
				rowData[c.asin + '_nf'] = c.score_nf ?? null;
				rowData[c.asin + '_sp'] = c.score_sp ?? null;
			}
			// 竞品
			for (const c of (analysis.competitor || [])) {
				rowData[c.asin + '_nf'] = c.score_nf ?? null;
				rowData[c.asin + '_sp'] = c.score_sp ?? null;
			}
			return rowData;
		});

		// 计算每个 ASIN 的历史平均分（用于智能预选 + 显示排序）
		const avgScores: Record<string, { nf: number; sp: number }> = {};
		for (const col of columns) {
			const nfVals = rows.map((r: any) => r[col.asin + '_nf']).filter((v: any) => v != null && v > 0);
			const spVals = rows.map((r: any) => r[col.asin + '_sp']).filter((v: any) => v != null && v > 0);
			avgScores[col.asin] = {
				nf: nfVals.length ? Math.round(nfVals.reduce((a: number, b: number) => a + b, 0) / nfVals.length) : 0,
				sp: spVals.length ? Math.round(spVals.reduce((a: number, b: number) => a + b, 0) / spVals.length) : 0,
			};
		}

		scoreHistoryCache.value[keyword] = { columns, rows, avgScores };

		// 智能自动预选：自己 + 平均分前2个竞品
		if (!scoreHistorySelectedAsins.value[keyword]) {
			const selfAsins = columns.filter((c: any) => c.type === '自己').map((c: any) => c.asin);
			const topCompetitors = columns
				.filter((c: any) => c.type === '竞品')
				.sort((a: any, b: any) => (avgScores[b.asin]?.nf || 0) - (avgScores[a.asin]?.nf || 0))
				.slice(0, 2)
				.map((c: any) => c.asin);
			scoreHistorySelectedAsins.value[keyword] = [...selfAsins, ...topCompetitors];
		}
	} catch (e) {
		console.warn('加载得分历史失败', e);
	} finally {
		scoreHistoryLoading.value[keyword] = false;
	}
}

// ASIN 切换选择（点击 tag 切换显示状态）
function toggleHistoryAsin(keyword: string, asin: string) {
	if (!scoreHistorySelectedAsins.value[keyword]) {
		scoreHistorySelectedAsins.value[keyword] = [];
	}
	const list = scoreHistorySelectedAsins.value[keyword];
	const idx = list.indexOf(asin);
	if (idx >= 0) {
		// 至少保留 1 条线
		if (list.length > 1) list.splice(idx, 1);
	} else {
		list.push(asin);
	}
}


const typeLabels: Record<string, string> = { '自己': '自有产品', '公司': '公司产品', '竞品': '竞争对手' };
const typeColors: Record<string, string> = { '自己': '#67c23a', '公司': '#409eff', '竞品': '#f56c6c' };

// 获取横向柱状图配置（单日得分）
function getBarChartOption(kw: any): any {
	const asins = [...kw.filteredAsins].reverse();

	// 用 ECharts rich text 渲染 Y 轴标签，类型用彩色标签 + 小图片
	const names = asins.map((a: any) => a.asin);
	const typeRichName: Record<string, string> = { '自己': 'tagSelf', '公司': 'tagCom', '竞品': 'tagComp' };

	// 构建 rich 配置：基础标签 + 每个有图片的 ASIN 动态生成 img 样式
	const richConfig: any = {
		tagSelf: { fontSize: 10, color: '#fff', backgroundColor: '#67c23a', padding: [1, 4, 1, 4], borderRadius: 3, lineHeight: 20 },
		tagCom: { fontSize: 10, color: '#fff', backgroundColor: '#409eff', padding: [1, 4, 1, 4], borderRadius: 3, lineHeight: 20 },
		tagComp: { fontSize: 10, color: '#fff', backgroundColor: '#f56c6c', padding: [1, 4, 1, 4], borderRadius: 3, lineHeight: 20 },
		asin: { fontSize: 11, color: '#303133', padding: [0, 0, 0, 4], lineHeight: 20 },
	};

	// 为每个有图片的 ASIN 注册一个 rich 图片 key
	for (const a of asins) {
		if (a.image_url) {
			richConfig['img_' + a.asin.replace(/[^a-zA-Z0-9]/g, '_')] = {
				backgroundColor: { image: convert_image_url(a.image_url) },
				width: 18, height: 18, borderRadius: 3, lineHeight: 20
			};
		}
	}

	const richYFormatter = (value: string) => {
		const item = asins.find((a: any) => a.asin === value);
		if (!item) return value;
		const richTag = typeRichName[item.type] || 'tagComp';
		const imgKey = 'img_' + item.asin.replace(/[^a-zA-Z0-9]/g, '_');
		const imgPart = item.image_url ? `{${imgKey}| } ` : '';
		return `${imgPart}{${richTag}|${item.type}} {asin|${value}}`;
	};

	const nfData = asins.map((a: any) => a.score_nf ?? 0);
	const spData = asins.map((a: any) => a.score_sp ?? 0);

	return {
		tooltip: {
			trigger: 'axis',
			axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,0.03)' } },
			backgroundColor: 'rgba(255,255,255,0.96)',
			borderColor: '#ebeef5',
			textStyle: { color: '#303133', fontSize: 12 },
			formatter: (params: any[]) => {
				const idx = params[0]?.dataIndex;
				if (idx == null) return '';
				const item = asins[idx];
				const typeFull = typeLabels[item?.type] || item?.type || '';
				const tColor = typeColors[item?.type] || '#909399';
				// 头部：图片 + 类型标签 + ASIN + 店铺
				let html = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #f0f0f0;">`;
				if (item?.image_url) {
					html += `<img src="${convert_image_url(item.image_url)}" style="width:80px;height:80px;object-fit:contain;border-radius:6px;border:1px solid #ebeef5;flex-shrink:0;background:#fafafa;" />`;
				}
				html += `<div>`;
				html += `<div><span style="display:inline-block;padding:1px 6px;border-radius:3px;background:${tColor};color:#fff;font-size:10px;margin-right:6px;">${typeFull}</span><b style="font-size:12px;">${item?.asin}</b></div>`;
				if (item?.seller) {
					html += `<div style="font-size:11px;color:#909399;margin-top:4px;">店铺: ${item.seller}</div>`;
				}
				if (item?.title) {
					html += `<div style="font-size:10px;color:#b0b0b0;margin-top:2px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.title}</div>`;
				}
				const salesValue = asinSalesMap.value.get(item?.asin);
				if (salesValue !== undefined) {
					const prefix = item?.type === '竞品' ? '父体销量' : '30天销量';
					html += `<div style="font-size:11px;color:#e6a23c;margin-top:4px;">${prefix}: ${salesValue.toLocaleString()}</div>`;
				}
				html += `</div></div>`;
				for (const p of params) {
					const pct = Math.round(p.value);
					const barColor = p.seriesName === '自然流量得分' ? '#67c23a' : '#409eff';
					html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;">`;
					html += `<span style="width:78px;font-size:11px;color:#606266;">${p.seriesName}</span>`;
					html += `<div style="flex:1;height:10px;background:#f5f7fa;border-radius:5px;overflow:hidden;min-width:80px;"><div style="height:100%;width:${pct}%;background:${barColor};border-radius:5px;transition:width 0.3s;"></div></div>`;
					html += `<b style="width:28px;text-align:right;">${pct}</b>`;
					html += `</div>`;
				}
				return html;
			}
		},
		legend: {
			data: ['自然流量得分', 'SP广告得分'],
			top: 4,
			textStyle: { fontSize: 12 },
			itemWidth: 14, itemHeight: 10
		},
		grid: { left: '3%', right: '8%', top: 36, bottom: '3%', containLabel: true },
		xAxis: {
			type: 'value', max: 100,
			splitLine: { lineStyle: { type: 'dashed', color: '#ebeef5' } },
			axisLabel: { fontSize: 11, color: '#909399' }
		},
		yAxis: {
			type: 'category',
			data: names,
			axisLabel: {
				fontSize: 11,
				formatter: richYFormatter,
				rich: richConfig
			},
			axisTick: { show: false },
			axisLine: { lineStyle: { color: '#ebeef5' } }
		},
		animationDuration: 600,
		animationEasing: 'cubicOut',
		series: [
			{
				name: '自然流量得分',
				type: 'bar',
				barMaxWidth: 28,
				barMinHeight: 4,
				data: nfData,
				itemStyle: {
					color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#b3e19d' }, { offset: 1, color: '#67c23a' }] },
					borderRadius: [0, 4, 4, 0]
				},
				emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(103,194,58,0.3)' } },
				label: {
					show: true, position: 'right', fontSize: 11, color: '#606266',
					formatter: (p: any) => p.value > 0 ? p.value : ''
				},
				animationDelay: (idx: number) => idx * 60
			},
			{
				name: 'SP广告得分',
				type: 'bar',
				barMaxWidth: 28,
				barMinHeight: 4,
				data: spData,
				itemStyle: {
					color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#a0cfff' }, { offset: 1, color: '#409eff' }] },
					borderRadius: [0, 4, 4, 0]
				},
				emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(64,158,255,0.3)' } },
				label: {
					show: true, position: 'right', fontSize: 11, color: '#606266',
					formatter: (p: any) => p.value > 0 ? p.value : ''
				},
				animationDelay: (idx: number) => idx * 60 + 30
			}
		]
	};
}

// 获取折线图配置（历史趋势）- 单指标模式
function getLineChartOption(keyword: string): any {
	const cache = scoreHistoryCache.value[keyword];
	if (!cache) return {};
	const { rows, columns } = cache;

	const selected = scoreHistorySelectedAsins.value[keyword] || [];
	const metric = scoreHistoryMetric.value; // 'nf' | 'sp'
	const metricKey = `_${metric}`;
	const metricLabel = metric === 'nf' ? '自然流量得分' : 'SP广告得分';

	const filteredColumns = columns.filter((c: any) => selected.includes(c.asin));
	if (filteredColumns.length === 0) {
		return {
			title: { text: '请在上方点击选择要对比的 ASIN', left: 'center', top: 'middle', textStyle: { color: '#909399', fontSize: 13 } }
		};
	}

	const sortedRows = [...rows].sort((a: any, b: any) => a.date.localeCompare(b.date));
	const dates = sortedRows.map((r: any) => r.date);

	// 检查「自己」ASIN 是否有数据
	const selfCols = filteredColumns.filter((c: any) => c.type === '自己');
	const selfHasNoData = selfCols.length > 0 && selfCols.every((col: any) =>
		sortedRows.every((r: any) => r[col.asin + metricKey] == null || r[col.asin + metricKey] === 0)
	);

	// 竞品颜色（差异明显，容易区分）
	const competitorColors = ['#f56c6c', '#e6a23c', '#9b59b6', '#00bcd4', '#795548', '#ff6f91', '#607d8b', '#8bc34a'];
	let competitorIdx = 0;

	const series: any[] = [];
	for (let ci = 0; ci < filteredColumns.length; ci++) {
		const col = filteredColumns[ci];
		const isSelf = col.type === '自己';
		const isCompany = col.type === '公司';
		const isCompetitor = col.type === '竞品';

		let lineColor: string;
		let lineWidth: number;
		let symbolSize: number;
		let areaStyle: any;

		if (isSelf) {
			lineColor = '#52c41a';
			lineWidth = 3;
			symbolSize = 6;
			areaStyle = {
				color: {
					type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
					colorStops: [{ offset: 0, color: 'rgba(82,196,26,0.18)' }, { offset: 1, color: 'rgba(82,196,26,0)' }]
				}
			};
		} else if (isCompany) {
			lineColor = '#409eff';
			lineWidth = 2;
			symbolSize = 5;
			areaStyle = undefined;
		} else {
			lineColor = competitorColors[competitorIdx % competitorColors.length];
			competitorIdx++;
			lineWidth = 1.5;
			symbolSize = 5;
			areaStyle = undefined;
		}

		const typeTag = isSelf ? '自有' : isCompany ? '公司' : '竞品';

		series.push({
			name: `[${typeTag}] ${col.asin.slice(-8)}`,
			type: 'line',
			smooth: 0.3,
			symbol: 'circle',
			symbolSize,
			showSymbol: true,
			itemStyle: { color: lineColor },
			lineStyle: { width: lineWidth, type: 'solid', color: lineColor },
			areaStyle,
			emphasis: {
				focus: 'series',
				scale: false,
				lineStyle: { width: lineWidth + 1 },
				itemStyle: { color: lineColor, borderWidth: 2, borderColor: '#fff', shadowBlur: 4, shadowColor: lineColor + '44' }
			},
			connectNulls: false,
			data: sortedRows.map((r: any) => {
				const v = r[col.asin + metricKey];
				return (v != null && v > 0) ? v : null;
			}),
			zlevel: isSelf ? 2 : isCompany ? 1 : 0,
			animationDelay: ci * 120
		});
	}

	// 如果自己没数据，加一条图形注释
	const graphicItems: any[] = selfHasNoData ? [{
		type: 'text',
		left: 'center',
		top: 20,
		style: {
			text: '⚠ 自有产品在此段时间内暂无排名记录',
			fill: '#e6a23c',
			fontSize: 12,
			fontWeight: 'bold',
			backgroundColor: '#fdf6ec',
			padding: [4, 10, 4, 10],
			borderRadius: 4,
			borderColor: '#f5dab1',
			borderWidth: 1
		}
	}] : [];

	return {
		graphic: graphicItems,
		tooltip: {
			trigger: 'axis',
			confine: true,
			backgroundColor: 'rgba(255,255,255,0.97)',
			borderColor: '#ebeef5',
			shadowBlur: 8,
			shadowColor: 'rgba(0,0,0,0.08)',
			textStyle: { color: '#303133', fontSize: 12 },
			formatter: (params: any[]) => {
				if (!params.length) return '';
				const validParams = params.filter((p: any) => p.value != null);
				if (!validParams.length) return '';
				let html = `<div style="font-weight:700;margin-bottom:8px;font-size:12px;color:#303133;border-bottom:1px solid #f0f0f0;padding-bottom:4px;">${params[0].axisValue}  <span style="font-size:10px;color:#909399;font-weight:normal;">${metricLabel}</span></div>`;
				const sorted = [...validParams].sort((a: any, b: any) => {
					const order = (name: string) => name.includes('[自有]') ? 0 : name.includes('[公司]') ? 1 : 2;
					return order(a.seriesName) - order(b.seriesName);
				});
				for (const p of sorted) {
					const tagMatch = p.seriesName.match(/\[(.+?)\]/);
					const tag = tagMatch?.[1] || '';
					const tColor = tag === '自有' ? '#52c41a' : tag === '公司' ? '#409eff' : '#f56c6c';
					// 通过 seriesName 里的 ASIN 后8位找到对应的 column 信息
					const asinSuffix = p.seriesName.replace(/\[.+?\]\s*/, '');
					const colInfo = filteredColumns.find((c: any) => c.asin.endsWith(asinSuffix));
					html += `<div style="display:flex;align-items:flex-start;gap:6px;margin:5px 0;padding:4px 0;">`;
					if (colInfo?.image_url) {
						html += `<img src="${convert_image_url(colInfo.image_url)}" style="width:26px;height:26px;object-fit:contain;border-radius:3px;border:1px solid #ebeef5;flex-shrink:0;margin-top:1px;" />`;
					}
					html += `<div style="flex:1;min-width:0;">`;
					html += `<div style="display:flex;align-items:center;gap:4px;">`;
					html += `<span style="display:inline-block;width:16px;height:3px;background:${p.color};border-radius:2px;flex-shrink:0;"></span>`;
					html += `<span style="display:inline-block;padding:0 4px;border-radius:2px;background:${tColor};color:#fff;font-size:10px;flex-shrink:0;">${tag}</span>`;
					html += `<span style="color:#606266;font-size:11px;">${asinSuffix}</span>`;
					html += `<b style="font-size:13px;margin-left:auto;color:${p.value > 50 ? '#52c41a' : p.value > 20 ? '#e6a23c' : '#909399'};">${p.value}</b>`;
					html += `</div>`;
					if (colInfo?.seller) {
						html += `<div style="font-size:10px;color:#b0b0b0;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${colInfo.seller}</div>`;
					}
					const salesVal = colInfo ? asinSalesMap.value.get(colInfo.asin) : undefined;
					if (salesVal !== undefined) {
						const salesPrefix = colInfo?.type === '竞品' ? '父体销量' : '30天销量';
						html += `<div style="font-size:10px;color:#e6a23c;margin-top:2px;">${salesPrefix}: ${salesVal.toLocaleString()}</div>`;
					}
					html += `</div></div>`;
				}
				return html;
			}
		},
		legend: {
			type: 'scroll',
			top: 4,
			left: 0,
			right: 60,
			textStyle: { fontSize: 11, color: '#606266' },
			itemWidth: 18, itemHeight: 4,
			pageIconSize: 10
		},
		grid: { left: '2%', right: '3%', top: 42, bottom: 8, containLabel: true },
		xAxis: {
			type: 'category',
			boundaryGap: false,
			data: dates,
			axisLabel: {
				fontSize: 10,
				color: '#909399',
				rotate: dates.length > 10 ? 30 : 0,
				formatter: (v: string) => v.slice(5) // 只显示月-日
			},
			axisLine: { lineStyle: { color: '#e4e7ed' } },
			axisTick: { show: false },
			splitLine: { show: false }
		},
		yAxis: {
			type: 'value',
			min: 0,
			max: 100,
			interval: 25,
			splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
			axisLabel: { fontSize: 10, color: '#c0c4cc', formatter: (v: number) => v === 0 ? '' : String(v) }
		},
		// 15天数据不需要滚动条，去掉 dataZoom 保持图表干净
		animationDuration: 700,
		animationEasing: 'cubicOut',
		series
	};
}

// ASIN 总分柱状图配置
function getSummaryChartOption(): any {
	// 使用已排序的数据（ECharts Y轴从下到上，所以要反转）
	const sorted = [...sortedScoreSummaryData.value].reverse();

	const typeColors: Record<string, string> = { '自己': '#52c41a', '公司': '#409eff', '竞品': '#f56c6c' };

	const yLabels = sorted.map(r => r.asin);
	const nfData = sorted.map(r => r.avgNf);
	const spData = sorted.map(r => r.avgSp);

	// ===== Y轴 rich 配置：类型色块 + 缩略图 =====
	const richConfig: any = {
		tagSelf:  { fontSize: 9, color: '#fff', backgroundColor: '#52c41a', padding: [1, 3, 1, 3], borderRadius: 2, lineHeight: 20 },
		tagCom:   { fontSize: 9, color: '#fff', backgroundColor: '#409eff', padding: [1, 3, 1, 3], borderRadius: 2, lineHeight: 20 },
		tagComp:  { fontSize: 9, color: '#fff', backgroundColor: '#f56c6c', padding: [1, 3, 1, 3], borderRadius: 2, lineHeight: 20 },
		asin:     { fontSize: 11, color: '#303133', padding: [0, 0, 0, 4], lineHeight: 20 },
		noImg:    { width: 18, height: 18, lineHeight: 20 },
	};
	// 为每个有图片的 ASIN 动态注册 rich 图片 key
	for (const row of sorted) {
		if (row.image_url) {
			const key = 'img_' + row.asin.replace(/[^a-zA-Z0-9]/g, '_');
			richConfig[key] = {
				backgroundColor: { image: convert_image_url(row.image_url) },
				width: 18, height: 18, borderRadius: 3, lineHeight: 20,
			};
		}
	}

	const richYFormatter = (value: string, idx: number) => {
		const row = sorted[idx];
		if (!row) return value;
		const richTag = row.type === '自己' ? 'tagSelf' : row.type === '公司' ? 'tagCom' : 'tagComp';
		const imgKey = 'img_' + row.asin.replace(/[^a-zA-Z0-9]/g, '_');
		const imgPart = row.image_url ? `{${imgKey}| } ` : `{noImg|  } `;
		return `${imgPart}{${richTag}|${row.type.slice(0, 1)}} {asin|${value}}`;
	};

	return {
		tooltip: {
			trigger: 'axis',
			axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,0.03)' } },
			backgroundColor: 'rgba(255,255,255,0.97)',
			borderColor: '#ebeef5',
			textStyle: { color: '#303133', fontSize: 12 },
			formatter: (params: any[]) => {
				const idx = params[0]?.dataIndex;
				if (idx == null) return '';
				const row = sorted[idx];
				const tColor = typeColors[row.type] || '#909399';
				const total = (row.avgNf + row.avgSp).toFixed(1);

				// 头部：图片 + 类型标签 + ASIN + 店铺 + 标题
				let html = `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #f0f0f0;">`;
				if (row.image_url) {
					html += `<img src="${convert_image_url(row.image_url)}" style="width:64px;height:64px;object-fit:contain;border-radius:6px;border:1px solid #ebeef5;flex-shrink:0;background:#fafafa;" />`;
				}
				html += `<div style="min-width:0;">`;
				html += `<div style="margin-bottom:3px;"><span style="display:inline-block;padding:0 5px;border-radius:3px;background:${tColor};color:#fff;font-size:10px;margin-right:5px;">${row.type}</span><b style="font-size:12px;">${row.asin}</b></div>`;
				if (row.seller) {
					html += `<div style="font-size:11px;color:#606266;margin-bottom:2px;">🏪 ${row.seller.trim()}</div>`;
				}
				if (row.title) {
					const shortTitle = row.title.length > 40 ? row.title.slice(0, 40) + '…' : row.title;
					html += `<div style="font-size:10px;color:#b0b0b0;">${shortTitle}</div>`;
				}
				html += `<div style="font-size:10px;color:#c0c4cc;margin-top:3px;">自然覆盖 ${row.coverageNf || '-'} · 广告覆盖 ${row.coverageSp || '-'}</div>`;
				if (row.monthly_sales != null) {
					const salesLabel = row.type === '竞品' ? '父体销量' : '30天销量';
					html += `<div style="font-size:10px;color:#e6a23c;margin-top:2px;">${salesLabel}: ${row.monthly_sales.toLocaleString()}</div>`;
				}
				html += `</div></div>`;

				// 得分详情
				for (const p of params) {
					const barColor = p.color;
					html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;">`;
					html += `<span style="width:8px;height:8px;border-radius:50%;background:${barColor};display:inline-block;flex-shrink:0;"></span>`;
					html += `<span style="color:#606266;font-size:11px;">${p.seriesName}</span>`;
					html += `<b style="margin-left:auto;">${(+p.value).toFixed(1)}</b>`;
					html += `</div>`;
				}
				html += `<div style="margin-top:6px;padding-top:4px;border-top:1px dashed #ebeef5;display:flex;justify-content:space-between;align-items:center;">`;
				html += `<span style="font-size:11px;color:#909399;">综合总分</span>`;
				html += `<b style="font-size:13px;color:${+total > 100 ? '#52c41a' : +total > 50 ? '#e6a23c' : '#909399'};">${total}</b>`;
				html += `</div>`;
				return html;
			}
		},
		legend: {
			data: [
				{
					name: '自然综合分',
					icon: 'roundRect',
				},
				{
					name: 'SP综合分',
					icon: 'roundRect',
				}
			],
			selected: chartLegendSelected.value,
			top: 4,
			right: 0,
			textStyle: { fontSize: 11, color: '#606266' },
			itemWidth: 12, itemHeight: 8,
			formatter: (name: string) => {
				if (scoreSortMode.value !== 'field') return name;
				const arrows: Record<string, string> = { 'avgNf': '自然综合分', 'avgSp': 'SP综合分' };
				const isActive = arrows[scoreSortField.value] === name;
				if (isActive) {
					const arrow = scoreSortOrder.value === 'desc' ? '↓' : '↑';
					return name + arrow;
				}
				return name;
			}
		},
		grid: { left: 4, right: 50, top: 36, bottom: 4, containLabel: true },
		xAxis: {
			type: 'value',
			splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
			axisLabel: { fontSize: 10, color: '#c0c4cc', formatter: (v: number) => v === 0 ? '' : String(v) }
		},
		yAxis: {
			type: 'category',
			data: yLabels,
			axisLabel: {
				fontSize: 11,
				formatter: richYFormatter,
				rich: richConfig,
			},
			axisTick: { show: false },
			axisLine: { lineStyle: { color: '#ebeef5' } }
		},
		series: [
			{
				name: '自然综合分',
				type: 'bar',
				barMaxWidth: 14,
				barMinHeight: 3,
				data: nfData,
				itemStyle: {
					color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#b7eb8f' }, { offset: 1, color: '#52c41a' }] },
					borderRadius: [0, 3, 3, 0]
				},
				label: { show: true, position: 'right', fontSize: 10, color: '#606266', formatter: (p: any) => p.value > 0 ? (+p.value).toFixed(1) : '' },
				emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(82,196,26,0.3)' } },
				animationDelay: (idx: number) => idx * 40
			},
			{
				name: 'SP综合分',
				type: 'bar',
				barMaxWidth: 14,
				barMinHeight: 3,
				data: spData,
				itemStyle: {
					color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#91caff' }, { offset: 1, color: '#409eff' }] },
					borderRadius: [0, 3, 3, 0]
				},
				label: { show: true, position: 'right', fontSize: 10, color: '#606266', formatter: (p: any) => p.value > 0 ? (+p.value).toFixed(1) : '' },
				emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(64,158,255,0.3)' } },
				animationDelay: (idx: number) => idx * 40 + 20
			}
		],
		animationDuration: 600,
		animationEasing: 'cubicOut'
	};
}

// ===== 计算ASIN总分（左侧面板）=====
// 数据合格判断：每个 (ASIN × 关键词 × 指标) 需要 ≥3天有非零数据才纳入计算
const MIN_QUALIFIED_DAYS = 3;

async function calcScoreSummary(inputRows: any[], requestSeq: number) {
	try {
		if (inputRows.length === 0) return;

		const totalKeywords = inputRows.length;

		// ========== 第一轮：收集原始数据 ==========
		// rawData[asin][keyword][date] = { nf, sp }
		// asinTypes[asin] = type (自己/公司/竞品)
		const rawData = new Map<string, Map<string, Map<string, { nf: number; sp: number }>>>();
		const asinTypes = new Map<string, string>();
		const asinInfoMap = new Map<string, { image_url: string | null; seller: string | null; title: string | null }>();

		function collectRaw(asin: string, type: string, keyword: string, date: string, nf: number, sp: number) {
			// 类型优先级：自己 > 公司 > 竞品
			const priority: Record<string, number> = { '自己': 0, '公司': 1, '竞品': 2 };
			const existing = asinTypes.get(asin);
			if (!existing || priority[type] < priority[existing]) {
				asinTypes.set(asin, type);
			}

			if (!rawData.has(asin)) rawData.set(asin, new Map());
			const kwMap = rawData.get(asin)!;
			if (!kwMap.has(keyword)) kwMap.set(keyword, new Map());
			const dateMap = kwMap.get(keyword)!;
			dateMap.set(date, { nf, sp });
		}

		// 遍历每个跟踪关键词，直接使用 loadAll 已加载的 _snapshots 缓存（不再重复请求）
		for (const row of inputRows) {
			try {
				const snapList = row._snapshots || [];

				for (const snap of snapList) {
					const date = String(snap.snapshot_date);
					const analysis = snap.analysis_data_parsed
						|| (typeof snap.analysis_data === 'string' ? JSON.parse(snap.analysis_data) : snap.analysis_data);
					if (!analysis) continue;

					const kw = row.keyword_value;

					if (analysis.self?.asin) {
						collectRaw(String(analysis.self.asin), '自己', kw, date, analysis.self.score_nf || 0, analysis.self.score_sp || 0);
						if (!asinInfoMap.has(analysis.self.asin)) asinInfoMap.set(analysis.self.asin, { image_url: analysis.self.image_url || null, seller: analysis.self.seller || null, title: analysis.self.title || null });
					}
					for (const c of (analysis.company || [])) {
						if (c.asin) {
							collectRaw(String(c.asin), '公司', kw, date, c.score_nf || 0, c.score_sp || 0);
							if (!asinInfoMap.has(c.asin)) asinInfoMap.set(c.asin, { image_url: c.image_url || null, seller: c.seller || null, title: c.title || null });
						}
					}
					for (const c of (analysis.competitor || [])) {
						if (c.asin) {
							collectRaw(String(c.asin), '竞品', kw, date, c.score_nf || 0, c.score_sp || 0);
							if (!asinInfoMap.has(c.asin)) asinInfoMap.set(c.asin, { image_url: c.image_url || null, seller: c.seller || null, title: c.title || null });
						}
					}
				}
			} catch (e) {
				console.warn('处理快照缓存失败(评分):', row.keyword_value, e);
			}
		}

		if (requestSeq !== summaryRequestSeq) return;

		// 保存原始数据供对比分析使用
		compareRawData.value = rawData;

		// ========== 第二轮：判断合格性 & 累加 ==========
		const result: any[] = [];

		for (const [asin, kwMap] of rawData) {
			const type = asinTypes.get(asin) || '竞品';

			// 判断每个 (关键词, 指标) 是否合格（≥3天有非零分）
			const qualifiedNfKws = new Set<string>();
			const qualifiedSpKws = new Set<string>();

			for (const [kw, dateMap] of kwMap) {
				let nfDays = 0;
				let spDays = 0;
				for (const [, scores] of dateMap) {
					if (scores.nf > 0) nfDays++;
					if (scores.sp > 0) spDays++;
				}
				if (nfDays >= MIN_QUALIFIED_DAYS) qualifiedNfKws.add(kw);
				if (spDays >= MIN_QUALIFIED_DAYS) qualifiedSpKws.add(kw);
			}

			// NF 和 SP 都没有合格关键词 → 跳过
			if (qualifiedNfKws.size === 0 && qualifiedSpKws.size === 0) continue;

			// ========== 第三轮：每个关键词独立算均分，再加总 ==========
			let sumNf = 0;
			let sumSp = 0;
			let maxDays = 0; // 记录最大天数用于显示

			for (const [kw, dateMap] of kwMap) {
				const nfOk = qualifiedNfKws.has(kw);
				const spOk = qualifiedSpKws.has(kw);
				if (!nfOk && !spOk) continue;

				// 统计这个关键词自己的天数和总分
				let kwNfTotal = 0;
				let kwSpTotal = 0;
				let kwDays = dateMap.size; // 这个关键词有几天快照

				for (const [, scores] of dateMap) {
					if (nfOk) kwNfTotal += scores.nf;
					if (spOk) kwSpTotal += scores.sp;
				}

				// 这个关键词的均分
				if (nfOk) sumNf += kwNfTotal / kwDays;
				if (spOk) sumSp += kwSpTotal / kwDays;

				if (kwDays > maxDays) maxDays = kwDays;
			}

			// 至少要有3天数据的关键词才能进来，所以 maxDays >= 3
			if (maxDays < MIN_QUALIFIED_DAYS) continue;

			const kwCount = Math.max(totalKeywords, 1);

			const info = asinInfoMap.get(asin);
			result.push({
				asin,
				type,
				avgNf: sumNf,
				avgSp: sumSp,
				days: maxDays,
				coverageNf: `${qualifiedNfKws.size}/${kwCount}`,
				coverageSp: `${qualifiedSpKws.size}/${kwCount}`,
				coverageNfRate: qualifiedNfKws.size / kwCount,
				coverageSpRate: qualifiedSpKws.size / kwCount,
				image_url: info?.image_url || null,
				seller: info?.seller || null,
				title: info?.title || null,
				monthly_sales: null,
			});
		}

		// 排序：自己 > 公司 > 竞品，同类型内按NF均分倒序
		const typeOrder: Record<string, number> = { '自己': 0, '公司': 1, '竞品': 2 };
		result.sort((a, b) => {
			if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];
			return b.avgNf - a.avgNf;
		});



		// ========== 收集需要查询销量的ASIN ==========
		const compAsinSet = new Set<string>();
		const selfCompanyAsinSet = new Set<string>();

		result.forEach(r => {
			if (r.type === '竞品') compAsinSet.add(r.asin);
			if (r.type === '自己' || r.type === '公司') selfCompanyAsinSet.add(r.asin);
		});

		inputRows.forEach(row => {
			if (row._analysis?.competitor) {
				row._analysis.competitor.forEach((c: any) => compAsinSet.add(c.asin));
			}
			if (row._analysis?.company) {
				row._analysis.company.forEach((c: any) => selfCompanyAsinSet.add(c.asin));
			}
		});

		const competitorAsins = Array.from(compAsinSet);
		const selfCompanyAsins = Array.from(selfCompanyAsinSet);
		const newSalesMap = new Map<string, number>();

		// ========== 并行请求销量 ==========
		const [compSalesRes, selfSalesRes] = await Promise.all([
			competitorAsins.length > 0
				? service.app.bsr_keyword_tracking.competitorMonthlySales({
					asins: competitorAsins,
					marketplace: props.listingRow.marketplace,
				}).catch((e: any) => { console.warn('查询竞品父体销量失败:', e); return null; })
				: Promise.resolve(null),
			selfCompanyAsins.length > 0
				? service.app.bsr_keyword_tracking.selfCompanyMonthlySales({
					asins: selfCompanyAsins,
					marketplace: props.listingRow.marketplace,
				}).catch((e: any) => { console.warn('查询自己/公司30天销量失败:', e); return null; })
				: Promise.resolve(null),
		]);

		if (requestSeq !== summaryRequestSeq) return;

		if (compSalesRes) {
			const newTrendMap = new Map<string, { sales_volume_data: any; price: string | null }>();
			for (const asin in compSalesRes) {
				const data = compSalesRes[asin];
				newSalesMap.set(asin, data?.Main_monthly_sales ?? 0);
				if (data?.sales_volume_data || data?.price) {
					newTrendMap.set(asin, {
						sales_volume_data: data.sales_volume_data,
						price: data.price,
					});
				}
			}
			competitorTrendMap.value = newTrendMap;
		}
		if (selfSalesRes) {
			for (const asin in selfSalesRes) newSalesMap.set(asin, selfSalesRes[asin]);
		}

		// 回填销量到 result（在赋值给 Vue 之前）
		for (const row of result) {
			if (newSalesMap.has(row.asin)) {
				row.monthly_sales = newSalesMap.get(row.asin);
			}
		}

		// ========== 一次性赋值所有响应式数据 ==========
		scoreSummaryData.value = result;
		asinSalesMap.value = newSalesMap;
	} catch (err) {
		console.error('计算评分汇总失败:', err);
	} finally {
		if (requestSeq === summaryRequestSeq) {
			scoreSummaryLoading.value = false;
		}
	}
}

// 当搜索关键字改变时，重置分页到第一页
watch(searchKeyword, () => {
	currentPage.value = 1;
});

const filteredTableData = computed(() => {
	let list = tableData.value;
	if (searchKeyword.value) {
		const lower = searchKeyword.value.toLowerCase();
		list = list.filter(r => r.keyword_value?.toLowerCase().includes(lower));
	}
	return list;
});
const paginatedTableData = computed(() => {
	const start = (currentPage.value - 1) * pageSize.value;
	const end = start + pageSize.value;
	return filteredTableData.value.slice(start, end);
});

const selectedMyRows = computed(() => selectedRows.value.filter(row => Number(row?.is_mine) === 1));

function onSelectionChange(rows: any[]) {
	selectedRows.value = rows;
}

async function batchStopSelectedMyTracking() {
	const ids = selectedMyRows.value.map(row => Number(row.id)).filter(id => id > 0);
	if (ids.length === 0) {
		ElMessage.warning("请选择自己的跟踪关键词");
		return;
	}

	try {
		await ElMessageBox.confirm(
			`将取消你的 ${ids.length} 个关键词跟踪，历史数据会保留，不会影响其他用户，确认继续？`,
			"取消我的跟踪",
			{ confirmButtonText: "确认取消", cancelButtonText: "取消", type: "warning" }
		);
	} catch {
		return;
	}

	stopMyTrackingLoading.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/bsr_keyword_tracking/batchStopMyTracking",
			method: "POST",
			data: { ids },
		});

		if (res?.success > 0) {
			ElMessage.success(`已取消你的 ${res.success} 个关键词跟踪`);
			emit("changed");
			await loadAll();
		} else {
			ElMessage.warning("所选关键词里没有你的跟踪记录");
		}
	} catch (err: any) {
		ElMessage.error(err?.message || "取消跟踪失败");
	} finally {
		stopMyTrackingLoading.value = false;
	}
}

async function fetchHistoricalData() {
	if (selectedRows.value.length === 0) return;

	const trackingIds = selectedRows.value.map(row => row.id).filter((id: any) => id && id > 0);
	if (trackingIds.length === 0) {
		ElMessage.warning("请选择有效的跟踪关键词");
		return;
	}

	try {
		historyFetching.value = true;
		await service.app.bsr_keyword_tracking.fetchHistoricalSnapshots({
			tracking_ids: trackingIds,
			days: 15,
		});
		ElMessage.success(`已开始为 ${trackingIds.length} 个关键词回填15天历史数据，后台执行中`);
	} catch (err: any) {
		ElMessage.error("提交回填任务失败: " + (err?.message || err));
	} finally {
		historyFetching.value = false;
	}
}

watch(
	() => props.modelValue,
	(val) => {
		if (val && props.listingRow) {
			mainTab.value = 'list';
			loadAll();
		}
	}
);

function onClose() {
	visible.value = false;
}

function getMarketplaceColor(marketplace: string) {
	if (!marketplace) return "#909399";
	const map: Record<string, string> = {
		英国: "#409EFF", 德国: "#303133", 法国: "#8e44ad", 西班牙: "#E6A23C", 意大利: "#67C23A"
	};
	return map[marketplace] || "#909399";
}

function rowClassName({ row }: any) {
	if (row._self?.natural || row._self?.sp) return "";
	if (!row.snapshot_date) return "row-no-data";
	return "";
}

// ========== 加载所有跟踪关键词 + 最新快照 ==========
async function loadAll() {
	const requestSeq = ++summaryRequestSeq;
	loading.value = true;
	tableData.value = [];
	selectedRows.value = [];
	scoreSummaryData.value = [];
	scoreSummaryLoading.value = true;
	availableScoreDates.value = [];
	scoreGlobalDate.value = '';
	scoreCurrentView.value = 'table';
	scoreHistoryView.value = 'table';
	scoreHistoryState.value = {};
	scoreHistoryLoading.value = {};
	scoreHistoryCache.value = {};
	scoreHistorySelectedAsins.value = {};
	compareTarget.value = '';
	compareSource.value = '';
	compareExpandedDays.value = [];
	compareRawData.value = new Map();
	asinSalesMap.value = new Map();
	competitorTrendMap.value = new Map();

	try {
		// 1. 获取店铺权限范围内的跟踪列表
		const trackingRes = await service.request({
			url: '/admin/app/bsr_keyword_tracking/trackingKeywordPage',
			method: 'POST',
			data: {
				listing_id: props.listingRow.id,
				store_id: props.listingRow.store_id,
				marketplace: props.listingRow.marketplace,
				product_code: props.listingRow.product_code,
				asin_self: props.listingRow.asin,
				msku: props.listingRow.msku,
				status: 1,
				size: 200,
				page: 1,
			},
		});
		if (requestSeq !== summaryRequestSeq) return;
		const trackingList = trackingRes?.list || [];

		if (trackingList.length === 0) {
			loading.value = false;
			scoreSummaryLoading.value = false;
			return;
		}

		// 2. 并行请求：聚合快照 + 关键词信息
		const trackingIds = trackingList.map((t: any) => t.id);
		const keywordIds = trackingList.map((t: any) => t.keyword_id).filter((id: any) => id && id > 0);

		console.time('[关键词跟踪] 并行请求 batchSnapshots + keywordInfo');
		const [batchSnapshotRes, kwRes] = await Promise.all([
			service.app.bsr_keyword_tracking.batchSnapshots({
				tracking_ids: trackingIds,
				size: 15,
			}),
			keywordIds.length > 0
				? service.app.bsr_keyword_tracking.getKeywordInfoByIds({ keyword_ids: keywordIds })
				: Promise.resolve([]),
		]);
		console.timeEnd('[关键词跟踪] 并行请求 batchSnapshots + keywordInfo');
		if (requestSeq !== summaryRequestSeq) return;

		// 构建关键词信息索引
		const kwMap = new Map<number, any>();
		const kwList = kwRes || [];
		for (const kw of kwList) {
			if (kw.id) kwMap.set(Number(kw.id), kw);
		}

		// 3. 组装行数据
		const snapshotMap = (batchSnapshotRes || {}) as Record<string, any[]>;
		const rows: any[] = [];
		for (const t of trackingList) {
			const row: any = {
				...t,
				_self: null,
				_prevSelf: null,
				_analysis: null,
				_snapshots: null,
				snapshot_date: null,
				_history: null,
				_historyLoading: false,
				_historyLoaded: false,
				_raw_data: null,
				_analysis_data: null,
				_naturalTrend: 0,
				_spTrend: 0,
				_value_cn: '',
				_sifScore: null as number | null,
				_searchVolume: null as number | null,
			};

			// 从聚合结果中取该关键词的快照
			const snapList = snapshotMap[String(t.id)] || [];

			// 解析 analysis_data 并缓存，解析后释放原始字符串节省内存
			row._snapshots = snapList.map((snap: any) => {
				const parsed = typeof snap.analysis_data === "string" ? JSON.parse(snap.analysis_data) : snap.analysis_data;
				return {
					tracking_id: snap.tracking_id,
					snapshot_date: snap.snapshot_date,
					total_result_count: snap.total_result_count,
					analysis_data_parsed: parsed,
					// 不保留原始 analysis_data 字符串，减少内存（3.7MB → 0）
				};
			});

			// 收集可用日期
			row._snapshots.forEach((s: any) => {
				if (s.snapshot_date && !availableScoreDates.value.includes(s.snapshot_date)) {
					availableScoreDates.value.push(s.snapshot_date);
				}
			});

			// 设置最新快照数据
			if (row._snapshots.length > 0) {
				const latestSnap = row._snapshots[0];
				row.snapshot_date = latestSnap.snapshot_date;
				row._analysis = latestSnap.analysis_data_parsed;
				row._self = row._analysis?.self || null;
				row._raw_data = null; // batchSnapshots 不返回 raw_data，用到时按需加载
				row._analysis_data = null;

				// 计算趋势：向前最多查 6 天找到有排名的快照做对比
				for (let pi = 1; pi < row._snapshots.length && pi < 7; pi++) {
					const prevAnalysis = row._snapshots[pi].analysis_data_parsed;
					const prevSelf = prevAnalysis?.self;

					if (row._naturalTrend === 0 && row._self?.natural && prevSelf?.natural) {
						row._naturalTrend = prevSelf.natural.rank - row._self.natural.rank;
					}
					if (row._spTrend === 0 && row._self?.sp?.rank > 0 && prevSelf?.sp?.rank > 0) {
						row._spTrend = prevSelf.sp.rank - row._self.sp.rank;
					}
					if (row._naturalTrend !== 0 && row._spTrend !== 0) break;
				}
			}

			// 填充关键词信息
			const kw = kwMap.get(row.keyword_id);
			if (kw) {
				row._value_cn = kw.value_cn || '';
				row._sifScore = kw.sif_score ? Number(kw.sif_score) : null;
				row._searchVolume = kw.sif_search_volume_monthly ? Number(kw.sif_search_volume_monthly) : null;
			}

			rows.push(row);
		}

		// 4. 默认排序：流量得分倒序 → 搜索量倒序
		rows.sort((a, b) => {
			const tA = a._sifScore || 0;
			const tB = b._sifScore || 0;
			if (tB !== tA) return tB - tA;
			return (b._searchVolume || 0) - (a._searchVolume || 0);
		});

		// 5. 先渲染右侧关键词列表，左侧总分和销量继续异步计算
		tableData.value = rows;

		// 排序日期降序
		availableScoreDates.value.sort((a, b) => b.localeCompare(a));
		if (!scoreGlobalDate.value && availableScoreDates.value.length > 0) {
			scoreGlobalDate.value = availableScoreDates.value[0];
		}

		loading.value = false;
		void (async () => {
			await yieldToBrowserPaint();
			if (requestSeq !== summaryRequestSeq) return;
			await calcScoreSummary(rows, requestSeq);
		})();

		console.log(`[关键词跟踪] 首屏列表加载完成: ${rows.length}个关键词, ${Object.values(snapshotMap).reduce((s, v) => s + v.length, 0)}条快照`);
	} catch (err: any) {
		console.error("加载跟踪数据失败:", err);
		ElMessage.error("加载跟踪数据失败");
	} finally {
		if (requestSeq === summaryRequestSeq) {
			loading.value = false;
		}
	}
}

// ========== 悬停加载15天历史 ==========
async function loadHistory(row: any) {
	if (row._historyLoaded) return;
	row._historyLoading = true;

	try {
		const list = await getTrackingSnapshots(row.id);
		row._history = list.map((snap: any) => {
			const analysis = parseSnapshotAnalysis(snap);
			return {
				date: snap.snapshot_date,
				natural: analysis?.self?.natural || null,
				sp: analysis?.self?.sp || null,
				ac: analysis?.self?.ac || false,
			};
		});
		row._historyLoaded = true;
	} catch (e) {
		console.warn("加载历史失败", e);
		row._history = [];
	} finally {
		row._historyLoading = false;
	}
}

// ========== 调试面板 ==========
const debugPanelVisible = ref(false);
const debugTab = ref('overview');
const debugTrackData = ref<any>(null);
const debugRawJson = ref('');
const debugAnalysisJson = ref('');

function loadDebugData(row: any) {
	// 解析排名总览数据（SIF API 字段名需要归一化）
	try {
		const raw = typeof row._raw_data === 'string' ? JSON.parse(row._raw_data) : row._raw_data;
		debugRawJson.value = JSON.stringify(raw, null, 2) || '暂无原始数据';

		// 归一化字段：SIF 返回 pageList/totalProducts，统一成 pages/totalResultCount
		if (raw) {
			const normalized: any = { ...raw };
			normalized.pages = raw.pages || raw.pageList || [];
			normalized.totalResultCount = raw.totalResultCount ?? raw.totalProducts ?? null;
			// productCntPerPage 和 zipCode 可能在顶层而非每页里
			if (normalized.productCntPerPage || normalized.zipCode) {
				for (const page of normalized.pages) {
					if (!page.productCntPerPage) page.productCntPerPage = normalized.productCntPerPage;
					if (!page.zipCode) page.zipCode = normalized.zipCode;
				}
			}
			debugTrackData.value = normalized;
		} else {
			debugTrackData.value = null;
		}
	} catch {
		debugTrackData.value = null;
		debugRawJson.value = row._raw_data || '暂无原始数据';
	}
	// 解析分析结果
	try {
		const analysis = typeof row._analysis_data === 'string' ? JSON.parse(row._analysis_data) : row._analysis_data;
		debugAnalysisJson.value = JSON.stringify(analysis, null, 2) || '暂无分析数据';
	} catch {
		debugAnalysisJson.value = row._analysis_data || '暂无分析数据';
	}
}

function toggleDebugPanel() {
	debugPanelVisible.value = !debugPanelVisible.value;
	if (debugPanelVisible.value && analysisRow.value) {
		loadDebugData(analysisRow.value);
	}
}

// ========== 分析弹窗 ==========
const analysisVisible = ref(false);
const analysisRow = ref<any>(null);
const analysisCurrentData = ref<any[]>([]);
const analysisHistoryLoading = ref(false);
const analysisHistoryTab = ref('natural');
const analysisNaturalHistory = ref<any[]>([]);
const analysisSpHistory = ref<any[]>([]);
const analysisHistoryColumns = ref<{ asin: string; label: string; type: string; image_url?: string }[]>([]);
let analysisRequestSeq = 0;

function analysisRowClassName({ row }: any) {
	if (row._type === '自己') return 'analysis-row-self';
	return '';
}

// 历史趋势：比较当前行与下一行（时间更早）的 rank 值
function getHistoryTrend(row: any, asinKey: string, idx: number, historyList: any[]): number {
	const currentRank = row[asinKey + '_rank'];
	if (!currentRank || idx >= historyList.length - 1) return 0;
	const prevRow = historyList[idx + 1];
	const prevRank = prevRow?.[asinKey + '_rank'];
	if (!prevRank) return 0;
	return prevRank - currentRank; // 正数=上升（排名变好），负数=下降
}


async function openAnalysis(row: any) {
	const requestSeq = ++analysisRequestSeq;
	analysisRow.value = row;
	analysisVisible.value = true;
	analysisHistoryTab.value = 'natural';
	debugPanelVisible.value = false;
	debugTab.value = 'overview';
	debugTrackData.value = null;
	debugRawJson.value = '';
	debugAnalysisJson.value = '';
	analysisCurrentData.value = [];
	analysisNaturalHistory.value = [];
	analysisSpHistory.value = [];
	analysisHistoryColumns.value = [];
	analysisHistoryLoading.value = true;

	await yieldToBrowserPaint();
	if (requestSeq !== analysisRequestSeq) return;

	// 构建当前排名对比表
	const currentRows: any[] = [];
	const analysis = row._analysis;
	if (!analysis) {
		analysisHistoryLoading.value = false;
		return;
	}

	// 自己
	if (analysis.self) {
		currentRows.push({
			_key: 'self',
			_type: '自己',
			asin: row.asin_self,
			...analysis.self,
		});
	}

	// 公司
	for (const c of (analysis.company || [])) {
		currentRows.push({
			_key: 'company_' + c.asin,
			_type: '公司',
			...c,
		});
	}

	// 竞品
	for (const c of (analysis.competitor || [])) {
		currentRows.push({
			_key: 'competitor_' + c.asin,
			_type: '竞品',
			...c,
		});
	}

	// 计算最佳排名标记 (第5点优化)
	const naturalRanks = currentRows.filter(r => r.natural).map(r => r.natural.rank);
	const spRanks = currentRows.filter(r => r.sp && r.sp.rank > 0).map(r => r.sp.rank);
	const bestNatural = naturalRanks.length ? Math.min(...naturalRanks) : -1;
	const bestSp = spRanks.length ? Math.min(...spRanks) : -1;

	for (const r of currentRows) {
		r._bestNatural = r.natural && r.natural.rank === bestNatural;
		r._bestSp = r.sp && r.sp.rank > 0 && r.sp.rank === bestSp;
	}

	analysisCurrentData.value = currentRows;

	// 构建历史列定义
	const allAsins = currentRows.map(r => ({ asin: r.asin, type: r._type, image_url: r.image_url }));
	analysisHistoryColumns.value = allAsins.map(a => ({
		asin: a.asin,
		label: a.asin + (a.type === '自己' ? '(自己)' : a.type === '公司' ? '(公司)' : '(竞品)'),
		type: a.type,
		image_url: a.image_url,
	}));

	// 加载历史快照
	await yieldToBrowserPaint();
	if (requestSeq !== analysisRequestSeq) return;
	try {
		const snapList = await getTrackingSnapshots(row.id);
		if (requestSeq !== analysisRequestSeq) return;

		const naturalRows: any[] = [];
		const spRows: any[] = [];

		for (const snap of snapList) {
			const snapAnalysis = parseSnapshotAnalysis(snap);
			const nRow: any = { date: snap.snapshot_date };
			const sRow: any = { date: snap.snapshot_date };

			for (const col of allAsins) {
				let naturalFound: any = null;
				let spFound: any = null;

				if (col.type === '自己') {
					if (snapAnalysis?.self?.natural) naturalFound = snapAnalysis.self.natural;
					if (snapAnalysis?.self?.sp) spFound = snapAnalysis.self.sp;
				} else if (col.type === '公司') {
					const entry = (snapAnalysis?.company || []).find((c: any) => c.asin === col.asin);
					if (entry?.natural) naturalFound = entry.natural;
					if (entry?.sp) spFound = entry.sp;
				} else if (col.type === '竞品') {
					const entry = (snapAnalysis?.competitor || []).find((c: any) => c.asin === col.asin);
					if (entry?.natural) naturalFound = entry.natural;
					if (entry?.sp) spFound = entry.sp;
				}

				nRow[col.asin] = naturalFound ? `第${naturalFound.page}页 第${naturalFound.position}位` : null;
				nRow[col.asin + '_rank'] = naturalFound?.rank || null;
				sRow[col.asin] = spFound && spFound.rank > 0 ? `第${spFound.page}页 第${spFound.position}位` : null;
				sRow[col.asin + '_rank'] = spFound?.rank > 0 ? spFound.rank : null;
			}
			naturalRows.push(nRow);
			spRows.push(sRow);
		}
		if (requestSeq !== analysisRequestSeq) return;
		analysisNaturalHistory.value = naturalRows;
		analysisSpHistory.value = spRows;
	} catch (e) {
		console.warn('加载分析历史失败', e);
		if (requestSeq === analysisRequestSeq) {
			analysisNaturalHistory.value = [];
			analysisSpHistory.value = [];
		}
	} finally {
		if (requestSeq === analysisRequestSeq) {
			analysisHistoryLoading.value = false;
		}
	}
}
</script>

<style scoped>
:deep(.row-no-data) {
	background-color: #fafafa !important;
	color: #c0c4cc;
}
:deep(.analysis-row-self) {
	background-color: #f0f9eb !important;
}
:deep(.el-table .el-scrollbar__view) {
	padding-bottom: 14px;
}
/* 图表容器淡入动画 */
:deep(.echarts) {
	animation: chartFadeIn 0.4s ease-out;
}
@keyframes chartFadeIn {
	from { opacity: 0; transform: translateY(8px); }
	to { opacity: 1; transform: translateY(0); }
}
/* 当前展开的关键词高亮 */
:deep(.kw-collapse-active > .el-collapse-item__header) {
	background: linear-gradient(90deg, #ecf5ff 0%, #fff 100%);
	border-left: 3px solid #409eff;
	padding-left: 13px;
	transition: all 0.25s ease;
}
:deep(.el-collapse-item__header) {
	transition: background 0.2s ease, border-left 0.2s ease;
}
:deep(.right-panel-tabs) {
	flex: 1;
	display: flex !important;
	flex-direction: column !important;
	min-height: 0;
}
:deep(.right-panel-tabs > .el-tabs__header) {
	order: -1 !important;
	margin-bottom: 15px !important;
}
:deep(.right-panel-tabs > .el-tabs__content) {
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
	display: flex;
	flex-direction: column;
	min-height: 0;
	min-width: 0;
}
:deep(.right-panel-tabs > .el-tabs__content > .el-tab-pane) {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-height: 0;
	min-width: 0;
}
/* 分析弹窗 Tab 切换动画 */
:deep(.analysis-history-tabs > .el-tabs__content) {
	transition: none;
}
:deep(.analysis-history-tabs .el-tab-pane) {
	animation: tabFadeSlide 0.35s ease-out;
}
@keyframes tabFadeSlide {
	from { opacity: 0; transform: translateX(12px); }
	to { opacity: 1; transform: translateX(0); }
}


/* 表格行切换动画（搜索时） */
:deep(.el-table__body tr) {
	animation: rowFadeIn 0.3s ease-out;
}
@keyframes rowFadeIn {
	from { opacity: 0; transform: translateY(-6px); }
	to { opacity: 1; transform: translateY(0); }
}
</style>
