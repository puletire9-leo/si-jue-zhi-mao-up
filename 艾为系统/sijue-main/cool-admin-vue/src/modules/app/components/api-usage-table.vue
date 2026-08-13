<template>
	<div class="api-usage-table">
		<el-row :gutter="20" class="table-filters">
			<el-col :span="6">
				<el-date-picker
					v-model="dateRange"
					type="daterange"
					range-separator="至"
					start-placeholder="开始日期"
					end-placeholder="结束日期"
					@change="handleDateChange"
				/>
			</el-col>
			<el-col :span="4">
				<el-select v-model="callerFilter" placeholder="调用来源" clearable @change="handleFilterChange">
					<el-option v-for="c in uniqueCallers" :key="c" :label="c" :value="c" />
				</el-select>
			</el-col>
			<el-col :span="4">
				<el-select v-model="callLocationFilter" placeholder="调用位置" clearable @change="handleFilterChange">
					<el-option v-for="l in uniqueCallLocations" :key="l" :label="l" :value="l" />
				</el-select>
			</el-col>
			<el-col :span="4">
				<el-select v-model="countryFilter" placeholder="国家/站点" clearable @change="handleFilterChange">
					<el-option v-for="c in uniqueCountries" :key="c" :label="c" :value="c" />
				</el-select>
			</el-col>
			<el-col :span="6">
				<el-button type="primary" @click="$emit('refresh')">刷新</el-button>
				<el-button @click="resetFilters">重置</el-button>
			</el-col>
		</el-row>

		<!-- 聚合视图 -->
		<el-table
			:data="pagedData"
			v-loading="loading"
			stripe border
			style="width: 100%; margin-top: 20px"
			:default-sort="{ prop: 'call_date', order: 'descending' }"
			@expand-change="handleExpand"
		>
			<el-table-column type="expand">
				<template #default="{ row }">
					<div style="padding: 10px 20px">
						<div v-if="row._detailLoading" v-loading="true" style="min-height: 60px" />
						<div v-else-if="row._detailError" style="color: #f56c6c">{{ row._detailError }}</div>
						<div v-else-if="row._details && row._details.length">
							<div style="margin-bottom: 8px; color: #909399">
								共 {{ row._detailTotal }} 条，当前显示 {{ row._details.length }} 条
								<el-button v-if="row._detailTotal > row._details.length" size="small" @click="loadMoreDetails(row)">
									加载更多
								</el-button>
							</div>
							<el-table :data="row._details" size="small" border>
								<el-table-column prop="createTime" label="时间" width="180" />
								<el-table-column v-if="apiType === 'sif'" prop="keyword_count" label="关键词数" width="80" />
								<el-table-column v-if="apiType === 'sif'" prop="keywords_sample" label="关键词示例" min-width="150" show-overflow-tooltip />
								<el-table-column v-if="apiType !== 'sif'" prop="asin_count" label="ASIN数" width="80" />
								<el-table-column v-if="apiType !== 'sif'" prop="asins_sample" label="ASIN示例" min-width="180" show-overflow-tooltip />
								<el-table-column v-if="apiType === 'sif'" prop="asin_count" label="ASIN数" width="80" />
								<el-table-column v-if="apiType === 'sif'" prop="asins_sample" label="ASIN示例" min-width="150" show-overflow-tooltip />
								<el-table-column prop="duration_ms" label="耗时(ms)" width="90" />
								<el-table-column prop="is_success" label="状态" width="70">
									<template #default="{ row: d }">
										<el-tag :type="d.is_success === 1 ? 'success' : 'danger'" size="small">
											{{ d.is_success === 1 ? '成功' : '失败' }}
										</el-tag>
									</template>
								</el-table-column>
								<el-table-column prop="error_message" label="错误信息" min-width="150" show-overflow-tooltip />
							</el-table>
						</div>
						<div v-else style="color: #909399">无详细记录</div>
					</div>
				</template>
			</el-table-column>
			<el-table-column prop="call_date" label="日期" width="120" sortable />
			<el-table-column prop="caller" label="调用来源" min-width="130" show-overflow-tooltip />
			<el-table-column v-if="apiType !== 'sif'" prop="call_location" label="调用位置" min-width="200" show-overflow-tooltip />
			<el-table-column prop="api_path" label="接口" min-width="160" show-overflow-tooltip>
				<template #default="{ row }">
					<span>{{ formatApiPath(row.api_path) }}</span>
				</template>
			</el-table-column>
			<el-table-column prop="country" label="站点" width="80" />
			<el-table-column v-if="apiType === 'sif'" prop="total_keywords" label="关键词数" width="90" />
			<el-table-column v-if="apiType === 'sif'" prop="total_asins" label="ASIN数" width="80" />
			<el-table-column prop="call_count" label="调用次数" width="100" sortable>
				<template #default="{ row }">
					<el-tag>{{ row.call_count }}</el-tag>
				</template>
			</el-table-column>
			<el-table-column prop="success_count" label="成功" width="70">
				<template #default="{ row }">
					<span style="color: #67c23a">{{ row.success_count }}</span>
				</template>
			</el-table-column>
			<el-table-column prop="fail_count" label="失败" width="70">
				<template #default="{ row }">
					<span :style="{ color: row.fail_count > 0 ? '#f56c6c' : '#909399' }">{{ row.fail_count }}</span>
				</template>
			</el-table-column>
			<el-table-column prop="avg_duration" label="平均耗时(ms)" width="120" sortable />
		</el-table>

		<el-pagination
			v-if="groupedData.length > pageSize"
			style="margin-top: 20px; justify-content: flex-end"
			v-model:current-page="currentPage"
			v-model:page-size="pageSize"
			:page-sizes="[10, 20, 50]"
			layout="total, sizes, prev, pager, next, jumper"
			:total="groupedData.length"
			@size-change="handleSizeChange"
			@current-change="handlePageChange"
		/>

		<!-- 汇总统计 -->
		<el-row :gutter="20" class="statistics-row">
			<el-col :span="6">
				<el-statistic title="总API调用次数" :value="statistics.totalCalls" />
			</el-col>
			<el-col :span="6">
				<el-statistic title="成功次数" :value="statistics.successCalls">
					<template #suffix><span style="color: #67c23a">({{ successRate }}%)</span></template>
				</el-statistic>
			</el-col>
			<el-col :span="6">
				<el-statistic title="失败次数" :value="statistics.failCalls">
					<template #suffix><span style="color: #f56c6c">({{ failRate }}%)</span></template>
				</el-statistic>
			</el-col>
			<el-col :span="6">
				<el-statistic title="总计费" :value="statistics.totalCredits" />
			</el-col>
		</el-row>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useCool } from "/@/cool";

const { service } = useCool();

interface Props {
	apiType: string;
	tableData: any[];
	loading: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits(['refresh']);

const dateRange = ref([]);
const callerFilter = ref('');
const callLocationFilter = ref('');
const countryFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(10);

const apiPathNameMap: Record<string, string> = {
	'/api/search/external/v2/asinKeywordsSimpleGroupByMonthly': '竞品ASIN查关键词',
	'/api/search/external/v2/estSearchesHistory': '关键词搜索趋势',
	'/api/search/external/v2/getAsinPageListByKeyword': '关键词排名页查询',
};

const formatApiPath = (path: string) => {
	return apiPathNameMap[path] || path;
};

const uniqueCallers = computed(() => {
	const set = new Set(props.tableData.map((item: any) => item.caller).filter(Boolean));
	return Array.from(set);
});

const uniqueCallLocations = computed(() => {
	const set = new Set(props.tableData.map((item: any) => item.call_location).filter(Boolean));
	return Array.from(set);
});

const uniqueCountries = computed(() => {
	const set = new Set(props.tableData.map((item: any) => item.country).filter(Boolean));
	return Array.from(set);
});

const groupedData = computed(() => {
	let data = [...props.tableData];

	if (dateRange.value && dateRange.value.length === 2) {
		const [start, end] = dateRange.value;
		data = data.filter((item: any) => {
			const d = new Date(item.call_date);
			return d >= start && d <= end;
		});
	}
	if (callerFilter.value) data = data.filter((item: any) => item.caller === callerFilter.value);
	if (callLocationFilter.value) data = data.filter((item: any) => item.call_location === callLocationFilter.value);
	if (countryFilter.value) data = data.filter((item: any) => item.country === countryFilter.value);

	return data;
});

const pagedData = computed(() => {
	const start = (currentPage.value - 1) * pageSize.value;
	return groupedData.value.slice(start, start + pageSize.value);
});

const statistics = computed(() => {
	const data = groupedData.value;
	return {
		totalCalls: data.reduce((s: number, item: any) => s + Number(item.call_count || 0), 0),
		successCalls: data.reduce((s: number, item: any) => s + Number(item.success_count || 0), 0),
		failCalls: data.reduce((s: number, item: any) => s + Number(item.fail_count || 0), 0),
		totalCredits: data.reduce((s: number, item: any) => s + Number(item.total_credits || 0), 0)
	};
});

const successRate = computed(() => {
	if (statistics.value.totalCalls === 0) return 0;
	return ((statistics.value.successCalls / statistics.value.totalCalls) * 100).toFixed(1);
});

const failRate = computed(() => {
	if (statistics.value.totalCalls === 0) return 0;
	return ((statistics.value.failCalls / statistics.value.totalCalls) * 100).toFixed(1);
});

const detailApiMap: Record<string, string> = {
	sif: 'getSifDetailLogs',
	sellersprite: 'getSellerspriteDetailLogs',
};

const handleExpand = async (row: any, expandedRows: any[]) => {
	if (!expandedRows.includes(row)) return;
	if (row._details || row._detailLoading) return;

	row._detailLoading = true;
	const method = detailApiMap[props.apiType] || 'getSellerspriteDetailLogs';
	try {
		const res = await service.app.api_usage[method]({
			call_date: row.call_date,
			caller: row.caller,
			call_location: row.call_location,
			api_path: row.api_path,
			country: row.country,
			page: 1,
			pageSize: 100
		});
		row._details = res.items || [];
		row._detailTotal = res.total || 0;
		row._detailPage = 1;
	} catch (e: any) {
		row._detailError = e?.message || '加载详情失败';
	} finally {
		row._detailLoading = false;
	}
};

const loadMoreDetails = async (row: any) => {
	row._detailLoading = true;
	const method = detailApiMap[props.apiType] || 'getSellerspriteDetailLogs';
	try {
		const nextPage = (row._detailPage || 1) + 1;
		const res = await service.app.api_usage[method]({
			call_date: row.call_date,
			caller: row.caller,
			call_location: row.call_location,
			api_path: row.api_path,
			country: row.country,
			page: nextPage,
			pageSize: 100
		});
		row._details = [...(row._details || []), ...(res.items || [])];
		row._detailTotal = res.total || 0;
		row._detailPage = nextPage;
	} catch (e: any) {
		row._detailError = e?.message || '加载更多失败';
	} finally {
		row._detailLoading = false;
	}
};

const handlePageChange = () => {};
const handleSizeChange = () => {
	currentPage.value = 1;
};

const handleDateChange = () => {
	currentPage.value = 1;
};
const handleFilterChange = () => {
	currentPage.value = 1;
};

const resetFilters = () => {
	dateRange.value = [];
	callerFilter.value = '';
	callLocationFilter.value = '';
	countryFilter.value = '';
	currentPage.value = 1;
};
</script>

<style scoped lang="scss">
.api-usage-table {
	.table-filters { margin-bottom: 20px; }
	.statistics-row {
		margin-top: 20px;
		padding: 20px;
		background-color: #f5f7fa;
		border-radius: 4px;
	}
}
</style>
