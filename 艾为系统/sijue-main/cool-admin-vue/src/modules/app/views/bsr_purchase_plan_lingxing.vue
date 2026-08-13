<template>
	<div class="purchase-plan-page">
		<!-- 页面头部 -->
		<div class="page-header">
			<div class="header-left">
				<h2 class="page-title">采购计划管理</h2>
				<el-tag type="info" size="small">领星同步</el-tag>
			</div>
			<div class="header-actions">
				<el-button :icon="Refresh" @click="handleRefresh">刷新</el-button>
				<el-button
					type="primary"
					:icon="Refresh"
					:loading="syncLoading"
					@click="handleSyncAll"
				>
					同步领星数据
				</el-button>
			</div>
		</div>

		<!-- 筛选区域 -->
		<div class="filter-section">
			<div class="filter-row">
				<div class="filter-group">
					<label class="filter-label">状态</label>
					<el-select
						v-model="filterStatus"
						placeholder="全部状态"
						clearable
						style="width: 120px"
						@change="handleFilter"
					>
						<el-option label="待采购" :value="2" />
						<el-option label="已完成" :value="-2" />
						<el-option label="待审批" :value="121" />
						<el-option label="已驳回" :value="122" />
						<el-option label="已作废" :value="-3" />
					</el-select>
				</div>

				<div class="filter-divider"></div>

				<div class="filter-group">
					<label class="filter-label">领星状态</label>
					<el-select
						v-model="filterDeleted"
						placeholder="全部"
						clearable
						style="width: 100px"
						@change="handleFilter"
					>
						<el-option label="正常" :value="0" />
						<el-option label="已删除" :value="1" />
					</el-select>
				</div>

				<div class="filter-divider"></div>

				<div class="filter-group">
					<label class="filter-label">创建时间</label>
					<el-date-picker
						v-model="filterDateRange"
						type="daterange"
						range-separator="至"
						start-placeholder="开始日期"
						end-placeholder="结束日期"
						value-format="YYYY-MM-DD"
						style="width: 260px"
						@change="handleFilter"
					/>
				</div>

				<div class="filter-divider"></div>

				<div class="filter-group">
					<label class="filter-label">搜索</label>
					<el-input
						v-model="searchKeyword"
						placeholder="SKU / 品名 / 计划编号"
						clearable
						style="width: 200px"
						@keyup.enter="handleFilter"
						@clear="handleFilter"
					>
						<template #suffix>
							<el-icon class="search-icon" @click="handleFilter"><search /></el-icon>
						</template>
					</el-input>
				</div>

				<el-button type="primary" text @click="resetFilter">
					<el-icon><refresh-right /></el-icon>
					重置筛选
				</el-button>
			</div>
		</div>

		<!-- 数据表格 -->
		<div class="table-section">
			<el-table
				ref="tableRef"
				v-loading="tableLoading"
				:data="tableData"
				border
				stripe
				style="width: 100%"
				:height="tableHeight"
				@sort-change="handleSortChange"
				@selection-change="handleSelectionChange"
			>
				<!-- 🔒 固定左侧列 -->
				<el-table-column type="selection" width="40" fixed="left" />
				<el-table-column prop="pic_url" label="图片" width="55" align="center" fixed="left">
					<template #default="{ row }">
						<el-image
							v-if="row.pic_url"
							:src="row.pic_url"
							fit="contain"
							style="width: 36px; height: 36px; cursor: zoom-in"
							:preview-src-list="[row.pic_url]"
							:z-index="3000"
							preview-teleported
						/>
						<span v-else class="no-data">-</span>
					</template>
				</el-table-column>
				<el-table-column prop="plan_sn" label="计划编号" width="120" fixed="left">
					<template #default="{ row }">
						<span class="plan-sn">{{ row.plan_sn }}</span>
					</template>
				</el-table-column>
				<el-table-column
					prop="sku"
					label="SKU"
					width="140"
					fixed="left"
					show-overflow-tooltip
				/>
				<el-table-column
					prop="product_name"
					label="品名"
					width="130"
					fixed="left"
					show-overflow-tooltip
				/>

				<!-- 📜 可滚动中间区域 -->
				<el-table-column prop="seller_name" label="店铺" width="100" show-overflow-tooltip>
					<template #default="{ row }">{{ row.seller_name || "-" }}</template>
				</el-table-column>
				<el-table-column prop="marketplace" label="站点" width="70" align="center">
					<template #default="{ row }">{{ row.marketplace || "-" }}</template>
				</el-table-column>
				<el-table-column prop="quantity_plan" label="采购量" width="75" align="center">
					<template #default="{ row }">
						<span class="qty-value">{{ row.quantity_plan || "-" }}</span>
					</template>
				</el-table-column>
				<el-table-column prop="status" label="状态" width="80" align="center">
					<template #default="{ row }">
						<el-tag :type="getStatusType(row.status)" size="small">
							{{ getStatusText(row.status) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column
					prop="warehouse_name"
					label="仓库"
					width="100"
					show-overflow-tooltip
				>
					<template #default="{ row }">{{ row.warehouse_name || "-" }}</template>
				</el-table-column>
				<el-table-column
					prop="expect_arrive_time"
					label="期望到货"
					width="100"
					align="center"
				>
					<template #default="{ row }">
						<span v-if="row.expect_arrive_time">{{
							row.expect_arrive_time.split(" ")[0]
						}}</span>
						<span v-else class="no-data">-</span>
					</template>
				</el-table-column>
				<el-table-column
					prop="supplier_name"
					label="供应商"
					width="100"
					show-overflow-tooltip
				>
					<template #default="{ row }">{{ row.supplier_name || "-" }}</template>
				</el-table-column>
				<el-table-column prop="cg_opt_username" label="采购员" width="80">
					<template #default="{ row }">{{ row.cg_opt_username || "-" }}</template>
				</el-table-column>
				<el-table-column prop="remark" label="备注" width="130" show-overflow-tooltip>
					<template #default="{ row }">{{ row.remark || "-" }}</template>
				</el-table-column>
				<el-table-column
					prop="analysis_record_id"
					label="算法详情"
					width="95"
					align="center"
				>
					<template #default="{ row }">
						<el-tooltip
							v-if="row.analysis_data_missing"
							content="关联的分析记录在本地已缺失，可能已被删除"
							placement="top"
						>
							<el-tag type="danger" size="small" effect="plain" style="cursor: help"
								>数据异常</el-tag
							>
						</el-tooltip>
						<el-button
							v-else-if="row.analysis_record_id"
							type="primary"
							link
							size="small"
							@click="showAnalysisDetail(row.analysis_record_id)"
						>
							查看
						</el-button>
						<span v-else class="no-data">-</span>
					</template>
				</el-table-column>
				<el-table-column prop="creator_real_name" label="创建人" width="80">
					<template #default="{ row }">{{ row.creator_real_name || "-" }}</template>
				</el-table-column>
				<el-table-column prop="createTime" label="创建时间" width="150" sortable="custom" />
				<el-table-column prop="is_deleted_remote" label="领星" width="65" align="center">
					<template #default="{ row }">
						<el-tag
							:type="row.is_deleted_remote === 1 ? 'danger' : 'success'"
							size="small"
						>
							{{ row.is_deleted_remote === 1 ? "删除" : "正常" }}
						</el-tag>
					</template>
				</el-table-column>

				<!-- 🔒 固定右侧操作列 -->
				<el-table-column label="操作" width="80" fixed="right" align="center">
					<template #default="{ row }">
						<el-button type="primary" link size="small" @click="handleSync(row)"
							>同步</el-button
						>
					</template>
				</el-table-column>
			</el-table>

			<!-- 分页 -->
			<div class="pagination-wrapper">
				<el-pagination
					v-model:current-page="pagination.page"
					v-model:page-size="pagination.size"
					:total="pagination.total"
					:page-sizes="[20, 50, 100]"
					layout="total, sizes, prev, pager, next, jumper"
					@size-change="handleFilter"
					@current-change="handleFilter"
				/>
			</div>
		</div>

		<!-- 编辑弹窗 -->
		<el-dialog v-model="editDialogVisible" title="编辑采购计划" width="500px">
			<el-form :model="editForm" label-width="100px">
				<el-form-item label="计划编号">
					<el-input v-model="editForm.plan_sn" disabled />
				</el-form-item>
				<el-form-item label="SKU">
					<el-input v-model="editForm.sku" disabled />
				</el-form-item>
				<el-form-item label="采购量">
					<el-input-number v-model="editForm.quantity_plan" :min="1" />
				</el-form-item>
				<el-form-item label="备注">
					<el-input v-model="editForm.remark" type="textarea" :rows="3" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="editDialogVisible = false">取消</el-button>
				<el-button type="primary" @click="submitEdit">保存</el-button>
			</template>
		</el-dialog>

		<!-- 算法详情弹窗 -->
		<el-dialog
			v-model="detailDialogVisible"
			title="补货分析详情"
			width="640px"
			:close-on-click-modal="false"
		>
			<div v-if="detailLoading" class="detail-loading">
				<el-icon class="is-loading"><loading /></el-icon>
				<span>加载中...</span>
			</div>
			<div v-else-if="analysisDetail" class="detail-content">
				<!-- 标题行 -->
				<div class="algo-header">
					系统补货建议 (基于{{
						analysisDetail.remark?.user_selected_algo_name || "系数算法"
					}}):
				</div>

				<!-- 公式卡片 -->
				<div class="formula-card">
					<div class="formula-body">
						<div class="formula-item">
							<div class="formula-label">系统预计成交</div>
							<div class="formula-value primary">
								{{ analysisDetail.remark?.system_suggested_qty || "-" }}
							</div>
						</div>
						<div class="formula-op">×</div>
						<div class="formula-item">
							<div class="formula-label">人工系数</div>
							<div class="formula-value warning">
								{{ analysisDetail.remark?.artificial_coefficient || 1.0 }}
							</div>
						</div>
						<div class="formula-op">=</div>
						<div class="formula-item highlight">
							<div class="formula-label">最终补货单量</div>
							<div class="formula-value success">
								{{ analysisDetail.remark?.final_replenishment_qty || "-" }}
							</div>
						</div>
					</div>
				</div>

				<!-- 汇总信息 - 蓝色背景凸显 -->
				<div v-if="analysisDetail.remark?.summary" class="summary-box">
					{{ analysisDetail.remark.summary }}
				</div>

				<!-- 分段明细表 -->
				<div v-if="analysisDetail.remark?.breakdown?.length" class="breakdown-section">
					<div class="section-title">分段计算明细</div>
					<el-table
						:data="analysisDetail.remark.breakdown"
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
				<div v-if="analysisDetail.manual_remark" class="remark-box">
					<div class="section-title">人工备注</div>
					<div class="remark-content">{{ analysisDetail.manual_remark }}</div>
				</div>
			</div>
			<div v-else class="detail-empty">
				<el-empty description="暂无分析数据" :image-size="60" />
			</div>
		</el-dialog>

		<!-- 发货日历弹窗 -->
		<el-dialog
			v-model="shippingCalendarVisible"
			title="📅 发货日历"
			width="700px"
			:close-on-click-modal="false"
		>
			<div class="shipping-calendar-content">
				<!-- 已选商品列表 -->
				<div class="selected-items-section">
					<div class="section-label">已选商品 ({{ shippingItems.length }}件)</div>
					<div class="selected-items-list">
						<div v-for="item in shippingItems" :key="item.id" class="selected-item">
							<span class="item-sn">{{ item.plan_sn }}</span>
							<span class="item-name">{{ item.product_name }}</span>
							<span class="item-qty">{{ item.quantity_plan }}件</span>
						</div>
					</div>
				</div>

				<!-- 日期选择 -->
				<div class="date-section">
					<div class="section-label">选择期望到货日期</div>
					<el-date-picker
						v-model="expectedArrivalDate"
						type="date"
						placeholder="选择日期"
						value-format="YYYY-MM-DD"
						:disabled-date="disablePastDate"
						style="width: 100%"
						@change="calculateAvailableChannels"
					/>
				</div>

				<!-- 物流渠道选择 -->
				<div v-if="expectedArrivalDate" class="channels-section">
					<div class="section-label">选择物流渠道</div>
					<div class="channel-list">
						<div
							v-for="channel in logisticsChannels"
							:key="channel.id"
							class="channel-item"
							:class="{
								selected: selectedChannel === channel.id,
								disabled: !channel.available
							}"
							@click="channel.available && (selectedChannel = channel.id)"
						>
							<span class="channel-icon">{{ channel.icon }}</span>
							<span class="channel-name">{{ channel.name }}</span>
							<span class="channel-days">{{ channel.days }}天到</span>
							<span class="channel-status">
								<el-tag v-if="channel.available" type="success" size="small"
									>可选</el-tag
								>
								<el-tag v-else type="danger" size="small">时效不足</el-tag>
							</span>
						</div>
					</div>
				</div>

				<!-- 发货摘要 -->
				<div v-if="selectedChannel && expectedArrivalDate" class="summary-section">
					<div class="summary-item">
						<span class="label">发货商品:</span>
						<span class="value">{{ shippingItems.length }}件</span>
					</div>
					<div class="summary-item">
						<span class="label">物流渠道:</span>
						<span class="value">{{ getChannelName(selectedChannel) }}</span>
					</div>
					<div class="summary-item">
						<span class="label">预计到货:</span>
						<span class="value highlight">{{ expectedArrivalDate }}</span>
					</div>
				</div>
			</div>

			<template #footer>
				<el-button @click="shippingCalendarVisible = false">取消</el-button>
				<el-button
					type="primary"
					:disabled="!selectedChannel || !expectedArrivalDate"
					@click="confirmShipping"
				>
					确认发货
				</el-button>
			</template>
		</el-dialog>

		<!-- 发货成功弹窗 -->
		<el-dialog v-model="shippingSuccessVisible" title="✅ 发货单创建成功" width="500px">
			<div class="shipping-success-content">
				<div class="success-header">
					<el-icon class="success-icon"><success-filled /></el-icon>
					<span>发货单已创建</span>
				</div>
				<div class="success-info">
					<div class="info-row">
						<span class="label">发货单号:</span>
						<span class="value">{{ shippingResult.shippingNo }}</span>
					</div>
					<div class="info-row">
						<span class="label">商品数量:</span>
						<span class="value">{{ shippingResult.itemCount }}件</span>
					</div>
					<div class="info-row">
						<span class="label">物流渠道:</span>
						<span class="value">{{ shippingResult.channelName }}</span>
					</div>
					<div class="info-row">
						<span class="label">预计到货:</span>
						<span class="value highlight">{{ shippingResult.arrivalDate }}</span>
					</div>
				</div>
				<div class="success-items">
					<div class="items-title">商品清单:</div>
					<div v-for="item in shippingResult.items" :key="item.plan_sn" class="item-row">
						<span class="item-sn">{{ item.plan_sn }}</span>
						<span class="item-qty">({{ item.quantity_plan }}件)</span>
					</div>
				</div>
			</div>
			<template #footer>
				<el-button type="primary" @click="shippingSuccessVisible = false">确定</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script lang="ts" name="app-bsr_purchase_plan_lingxing" setup>
import { ref, reactive, onMounted } from "vue";
import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox } from "element-plus";
import {
	Refresh,
	RefreshRight,
	Search,
	Loading,
	InfoFilled,
	SuccessFilled
} from "@element-plus/icons-vue";

const { service } = useCool();

// 筛选状态
const filterStatus = ref<number | null>(null);
const filterDeleted = ref<number | null>(null);
const filterDateRange = ref<string[] | null>(null);
const searchKeyword = ref("");

// 表格相关
const tableRef = ref();
const tableLoading = ref(false);
const tableData = ref<any[]>([]);
const syncLoading = ref(false);
const tableHeight = "calc(100vh - 280px)"; // 固定表格高度，让固定列正常工作
const selectedRows = ref<any[]>([]); // 已选择的行

// 物流渠道配置（模拟数据）
const logisticsChannelsConfig = [
	{ id: "express", name: "快递", icon: "🚚", days: 2 },
	{ id: "air", name: "空运", icon: "✈️", days: 3 },
	{ id: "truck", name: "卡车", icon: "🚛", days: 7 },
	{ id: "rail", name: "铁路", icon: "🚂", days: 15 },
	{ id: "sea", name: "海运", icon: "🚢", days: 30 }
];

// 发货日历弹窗
const shippingCalendarVisible = ref(false);
const shippingItems = ref<any[]>([]);
const expectedArrivalDate = ref<string | null>(null);
const selectedChannel = ref<string | null>(null);
const logisticsChannels = ref<any[]>([]);

// 发货成功弹窗
const shippingSuccessVisible = ref(false);
const shippingResult = reactive({
	shippingNo: "",
	itemCount: 0,
	channelName: "",
	arrivalDate: "",
	items: [] as any[]
});

// 表格选择变化
const handleSelectionChange = (rows: any[]) => {
	selectedRows.value = rows;
};

// 打开发货日历
const openShippingCalendar = (items: any[]) => {
	if (!items || items.length === 0) {
		ElMessage.warning("请先选择要发货的采购计划");
		return;
	}
	shippingItems.value = items;
	expectedArrivalDate.value = null;
	selectedChannel.value = null;
	logisticsChannels.value = [];
	shippingCalendarVisible.value = true;
};

// 禁用过去的日期
const disablePastDate = (date: Date) => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return date < today;
};

// 计算可用物流渠道
const calculateAvailableChannels = () => {
	if (!expectedArrivalDate.value) {
		logisticsChannels.value = [];
		return;
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const arrivalDate = new Date(expectedArrivalDate.value);
	const daysToArrival = Math.ceil(
		(arrivalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
	);

	logisticsChannels.value = logisticsChannelsConfig.map((channel) => ({
		...channel,
		available: daysToArrival >= channel.days
	}));

	// 自动选择第一个可用的渠道
	selectedChannel.value = null;
	const firstAvailable = logisticsChannels.value.find((c) => c.available);
	if (firstAvailable) {
		selectedChannel.value = firstAvailable.id;
	}
};

// 获取渠道名称
const getChannelName = (channelId: string | null) => {
	if (!channelId) return "";
	const channel = logisticsChannelsConfig.find((c) => c.id === channelId);
	return channel ? `${channel.icon} ${channel.name}` : "";
};

// 确认发货（模拟）
const confirmShipping = () => {
	if (!selectedChannel.value || !expectedArrivalDate.value) return;

	// 生成模拟发货单号
	const now = new Date();
	const shippingNo = `SH${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;

	// 设置结果
	shippingResult.shippingNo = shippingNo;
	shippingResult.itemCount = shippingItems.value.length;
	shippingResult.channelName = getChannelName(selectedChannel.value);
	shippingResult.arrivalDate = expectedArrivalDate.value;
	shippingResult.items = shippingItems.value.map((item) => ({
		plan_sn: item.plan_sn,
		quantity_plan: item.quantity_plan
	}));

	// 关闭日历弹窗，打开成功弹窗
	shippingCalendarVisible.value = false;
	shippingSuccessVisible.value = true;

	// 清空选择
	selectedRows.value = [];
	tableRef.value?.clearSelection();

	ElMessage.success("发货单创建成功！");
};

// 分页
const pagination = reactive({
	page: 1,
	size: 20,
	total: 0
});

// 排序
const sortInfo = reactive({
	order: "createTime",
	sort: "DESC"
});

// 编辑弹窗
const editDialogVisible = ref(false);
const editForm = reactive({
	id: 0,
	plan_sn: "",
	sku: "",
	quantity_plan: 0,
	remark: ""
});

// 算法详情弹窗
const detailDialogVisible = ref(false);
const detailLoading = ref(false);
const analysisDetail = ref<any>(null);

// 状态映射
const statusMap: Record<
	number,
	{ text: string; type: "success" | "warning" | "info" | "danger" | "primary" }
> = {
	2: { text: "待采购", type: "warning" },
	"-2": { text: "已完成", type: "success" },
	121: { text: "待审批", type: "info" },
	122: { text: "已驳回", type: "danger" },
	"-3": { text: "已作废", type: "info" },
	124: { text: "已作废", type: "info" }
};

const getStatusText = (status: number) => statusMap[status]?.text || "未知";
const getStatusType = (status: number): "success" | "warning" | "info" | "danger" | "primary" =>
	statusMap[status]?.type || "info";

// 加载数据
const loadData = async () => {
	tableLoading.value = true;
	try {
		const params: any = {
			page: pagination.page,
			size: pagination.size,
			order: sortInfo.order,
			sort: sortInfo.sort
		};

		if (filterStatus.value !== null) params.status = filterStatus.value;
		if (filterDeleted.value !== null) params.is_deleted_remote = filterDeleted.value;
		if (filterDateRange.value?.length === 2) {
			params.startDate = filterDateRange.value[0];
			params.endDate = filterDateRange.value[1];
		}
		if (searchKeyword.value) params.keyWord = searchKeyword.value;

		const res = await service.app.bsr_purchase_plan_lingxing.customPage(params);
		tableData.value = res.list || [];
		pagination.total = res.pagination?.total || 0;
	} catch (e: any) {
		ElMessage.error("加载数据失败");
	} finally {
		tableLoading.value = false;
	}
};

// 刷新
const handleRefresh = () => loadData();

// 筛选
const handleFilter = () => {
	pagination.page = 1;
	loadData();
};

// 重置筛选
const resetFilter = () => {
	filterStatus.value = null;
	filterDeleted.value = null;
	filterDateRange.value = null;
	searchKeyword.value = "";
	pagination.page = 1;
	loadData();
};

// 排序变化
const handleSortChange = ({ prop, order }: any) => {
	if (prop) {
		sortInfo.order = prop;
		sortInfo.sort = order === "ascending" ? "ASC" : "DESC";
	} else {
		sortInfo.order = "createTime";
		sortInfo.sort = "DESC";
	}
	loadData();
};

// 同步单条
const handleSync = async (row: any) => {
	try {
		await service.app.bsr_purchase_plan_lingxing.syncPlans({ plan_sns: [row.plan_sn] });
		ElMessage.success("同步成功");
		loadData();
	} catch (e: any) {
		ElMessage.error(`同步失败: ${e?.message || "未知错误"}`);
	}
};

// 编辑
const handleEdit = (row: any) => {
	editForm.id = row.id;
	editForm.plan_sn = row.plan_sn;
	editForm.sku = row.sku;
	editForm.quantity_plan = row.quantity_plan;
	editForm.remark = row.remark || "";
	editDialogVisible.value = true;
};

// 提交编辑
const submitEdit = async () => {
	try {
		await service.app.bsr_purchase_plan_lingxing.update({
			id: editForm.id,
			quantity_plan: editForm.quantity_plan,
			remark: editForm.remark
		});
		ElMessage.success("保存成功");
		editDialogVisible.value = false;
		loadData();
	} catch (e: any) {
		ElMessage.error("保存失败");
	}
};

// 删除
const handleDelete = async (row: any) => {
	try {
		await ElMessageBox.confirm("确定删除该记录吗？", "提示", { type: "warning" });
		await service.app.bsr_purchase_plan_lingxing.delete({ ids: [row.id] });
		ElMessage.success("删除成功");
		loadData();
	} catch (e: any) {
		if (e !== "cancel") ElMessage.error("删除失败");
	}
};

// 查看算法详情
const showAnalysisDetail = async (analysisRecordId: number) => {
	detailDialogVisible.value = true;
	detailLoading.value = true;
	analysisDetail.value = null;

	try {
		const result = await service.app.bsr_purchase_plan_lingxing.getAnalysisRecord({
			analysis_record_id: analysisRecordId
		});
		analysisDetail.value = result;
	} catch (e: any) {
		ElMessage.error("获取分析详情失败");
	} finally {
		detailLoading.value = false;
	}
};

// 同步所有数据
const handleSyncAll = async () => {
	try {
		await ElMessageBox.confirm("确定要同步所有采购计划数据吗？", "确认同步", {
			confirmButtonText: "确定",
			cancelButtonText: "取消",
			type: "info"
		});

		syncLoading.value = true;

		const existingPlanSns = tableData.value.map((item: any) => item.plan_sn).filter(Boolean);

		let analysisRecordPlanSns: string[] = [];
		try {
			const analysisRecords = await service.app.bsr_analysis_record_lingxing.getWithPlanSn();
			analysisRecordPlanSns = (analysisRecords || [])
				.map((r: any) => r.plan_sn)
				.filter(Boolean);
		} catch (e) {
			console.warn("获取 analysis_record 的 plan_sn 失败:", e);
		}

		const allPlanSns = [...new Set([...existingPlanSns, ...analysisRecordPlanSns])];

		if (allPlanSns.length === 0) {
			ElMessage.warning("当前没有可同步的数据");
			return;
		}

		const syncResult = await service.app.bsr_purchase_plan_lingxing.syncPlans({
			plan_sns: allPlanSns
		});

		if (syncResult?.error) {
			if (syncResult.errorType === "TOKEN_EXPIRED") {
				ElMessage.error("同步失败：领星Token已过期，请重新授权");
			} else {
				ElMessage.error(`同步失败：${syncResult.error}`);
			}
		} else if (syncResult?.syncCount > 0) {
			ElMessage.success(`已成功同步 ${syncResult.syncCount} 条数据`);
		} else {
			ElMessage.warning("未找到可同步的数据");
		}
		loadData();
	} catch (e: any) {
		if (e !== "cancel") {
			ElMessage.error(`同步失败: ${e?.message || "未知错误"}`);
		}
	} finally {
		syncLoading.value = false;
	}
};

onMounted(() => {
	loadData();
});
</script>

<style scoped>
.purchase-plan-page {
	padding: 20px;
	background: #f5f7fa;
	min-height: 100%;
}

/* 页面头部 */
.page-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16px;
}

.header-left {
	display: flex;
	align-items: center;
	gap: 12px;
}

.page-title {
	margin: 0;
	font-size: 20px;
	font-weight: 600;
	color: #303133;
}

.header-actions {
	display: flex;
	gap: 8px;
}

/* 筛选区域 */
.filter-section {
	background: #fff;
	border-radius: 8px;
	padding: 16px 20px;
	margin-bottom: 16px;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.filter-row {
	display: flex;
	align-items: center;
	gap: 16px;
	flex-wrap: wrap;
}

.filter-group {
	display: flex;
	align-items: center;
	gap: 8px;
}

.filter-label {
	font-size: 13px;
	color: #606266;
	font-weight: 500;
	white-space: nowrap;
}

.filter-divider {
	width: 1px;
	height: 24px;
	background: #dcdfe6;
}

.search-icon {
	cursor: pointer;
	color: #909399;
}
.search-icon:hover {
	color: #409eff;
}

/* 表格区域 */
.table-section {
	background: #fff;
	border-radius: 8px;
	padding: 16px;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

/* 固定列阴影效果 */
.table-section :deep(.el-table__fixed-left) {
	box-shadow: 2px 0 6px rgba(0, 0, 0, 0.08);
}
.table-section :deep(.el-table__fixed-right) {
	box-shadow: -2px 0 6px rgba(0, 0, 0, 0.08);
}

/* 紧凑行高 */
.table-section :deep(.el-table .el-table__cell) {
	padding: 8px 0;
}

.plan-sn {
	color: #409eff;
	font-weight: 500;
	cursor: pointer;
}
.plan-sn:hover {
	text-decoration: underline;
}

.qty-value {
	font-weight: 600;
	color: #409eff;
	font-size: 14px;
}

.no-image,
.no-data {
	color: #c0c4cc;
	font-size: 12px;
}

/* 分页 */
.pagination-wrapper {
	display: flex;
	justify-content: flex-end;
	margin-top: 16px;
}

/* 详情弹窗 */
.detail-loading {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 8px;
	padding: 40px;
	color: #909399;
}

.detail-empty {
	padding: 20px;
}

.detail-content {
	padding: 0 8px;
}

/* 公式卡片 - 浅蓝色风格 */
.formula-card {
	background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%);
	border-radius: 12px;
	padding: 20px;
	margin-bottom: 16px;
	border: 1px solid #d4e5ff;
}

.formula-header {
	text-align: center;
	margin-bottom: 16px;
}

.formula-title {
	font-size: 14px;
	font-weight: 600;
	color: #409eff;
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
}

.formula-item.highlight {
	background: #fff;
	border: 2px solid #67c23a;
}

.formula-value {
	font-size: 28px;
	font-weight: 700;
	line-height: 1.2;
}

.formula-value.primary {
	color: #409eff;
}
.formula-value.warning {
	color: #e6a23c;
}
.formula-value.success {
	color: #67c23a;
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

/* 算法标题 */
.algo-header {
	font-size: 14px;
	font-weight: 600;
	color: #303133;
	margin-bottom: 12px;
}

/* 汇总文字 - 普通样式 */
.summary-text {
	font-size: 13px;
	color: #606266;
	margin-bottom: 16px;
	padding-left: 2px;
}

/* 分段明细 */
.breakdown-section {
	margin-bottom: 16px;
}

.section-title {
	font-size: 14px;
	font-weight: 600;
	color: #303133;
	margin-bottom: 12px;
	padding-left: 10px;
	border-left: 3px solid #409eff;
}

.highlight-value {
	font-weight: 600;
	color: #409eff;
}

/* 人工备注 */
.remark-box {
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

/* 发货日历弹窗样式 */
.shipping-calendar-content {
	padding: 0 8px;
}

.selected-items-section {
	margin-bottom: 20px;
}

.section-label {
	font-size: 14px;
	font-weight: 600;
	color: #303133;
	margin-bottom: 10px;
}

.selected-items-list {
	max-height: 120px;
	overflow-y: auto;
	border: 1px solid #ebeef5;
	border-radius: 6px;
	padding: 8px;
}

.selected-item {
	display: flex;
	align-items: center;
	padding: 6px 8px;
	border-bottom: 1px solid #f0f0f0;
}
.selected-item:last-child {
	border-bottom: none;
}

.selected-item .item-sn {
	color: #409eff;
	font-weight: 500;
	width: 120px;
}

.selected-item .item-name {
	flex: 1;
	color: #606266;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.selected-item .item-qty {
	color: #409eff;
	font-weight: 600;
	margin-left: 12px;
}

.date-section {
	margin-bottom: 20px;
}

.channels-section {
	margin-bottom: 20px;
}

.channel-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.channel-item {
	display: flex;
	align-items: center;
	padding: 12px 16px;
	border: 2px solid #ebeef5;
	border-radius: 8px;
	cursor: pointer;
	transition: all 0.2s;
}

.channel-item:hover:not(.disabled) {
	border-color: #409eff;
	background: #ecf5ff;
}

.channel-item.selected {
	border-color: #409eff;
	background: #ecf5ff;
}

.channel-item.disabled {
	opacity: 0.5;
	cursor: not-allowed;
	background: #f5f7fa;
}

.channel-icon {
	font-size: 20px;
	margin-right: 12px;
}

.channel-name {
	font-weight: 600;
	color: #303133;
	width: 60px;
}

.channel-days {
	flex: 1;
	color: #909399;
	font-size: 13px;
}

.channel-status {
	margin-left: auto;
}

.summary-section {
	background: #f0f7ff;
	border-radius: 8px;
	padding: 16px;
}

.summary-item {
	display: flex;
	justify-content: space-between;
	padding: 6px 0;
}

.summary-item .label {
	color: #606266;
}

.summary-item .value {
	font-weight: 600;
	color: #303133;
}

.summary-item .value.highlight {
	color: #409eff;
}

/* 发货成功弹窗 */
.shipping-success-content {
	text-align: center;
}

.success-header {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 8px;
	font-size: 18px;
	font-weight: 600;
	color: #67c23a;
	margin-bottom: 20px;
}

.success-icon {
	font-size: 28px;
}

.success-info {
	background: #f0f9eb;
	border-radius: 8px;
	padding: 16px;
	margin-bottom: 16px;
	text-align: left;
}

.info-row {
	display: flex;
	justify-content: space-between;
	padding: 6px 0;
}

.info-row .label {
	color: #606266;
}

.info-row .value {
	font-weight: 600;
	color: #303133;
}

.info-row .value.highlight {
	color: #67c23a;
}

.success-items {
	text-align: left;
	background: #f5f7fa;
	border-radius: 8px;
	padding: 12px 16px;
}

.items-title {
	color: #909399;
	font-size: 13px;
	margin-bottom: 8px;
}

.item-row {
	padding: 4px 0;
	color: #606266;
}

.item-row .item-sn {
	color: #409eff;
	font-weight: 500;
}

.item-row .item-qty {
	color: #909399;
	margin-left: 8px;
}
</style>
