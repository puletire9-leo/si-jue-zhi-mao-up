<template>
	<el-dialog
		:modelValue="visible"
		@update:modelValue="handleDialogUpdate"
		:before-close="handleBeforeClose"
		title=""
		width="820px"
		:close-on-click-modal="false"
		class="alpha-config-dialog"
		append-to-body
	>
		<!-- 自定义标题 -->
		<template #header>
			<div class="acd-header">
				<div class="acd-title-row">
					<span class="acd-title">α 权重配置</span>
					<span class="acd-subtitle" v-if="listing?.asin">{{ listing.asin }} · {{ listing.marketplace }}</span>
					<span class="acd-date-hint" v-if="selectionStart && selectionEnd">
						{{ selectionStart }} ~ {{ selectionEnd }}
					</span>
				</div>
			</div>
		</template>

		<div class="acd-body">
			<!-- 1. 模式切换 -->
			<div class="acd-mode-bar">
				<el-radio-group v-model="mode" size="small">
					<el-radio-button label="system" title="只读查看当前生效的α值和系数，不可编辑">系统自动</el-radio-button>
					<el-radio-button label="user" title="自定义α并保存到数据库，下次打开自动加载">用户配置</el-radio-button>
					<el-radio-button label="manual" title="临时调整α，仅当前页面生效，关闭后恢复">手动调整</el-radio-button>
				</el-radio-group>
				<span class="mode-hint">
					{{ mode === 'system' ? '只读，展示当前生效α' : mode === 'user' ? '持久化保存到数据库' : '仅当前页面生效，不存库' }}
				</span>

				<!-- 实时预览卡 -->
				<div class="acd-preview-card">
					<div class="preview-main">
						<span class="preview-label">预估补货量</span>
						<span class="preview-value">{{ formatNum(totalDemand) }} 件</span>
					</div>
					<div class="preview-compare" v-if="mode !== 'system'">
						<span :class="demandDiffClass">
							vs 系统 {{ formatNum(systemTotalDemand) }}件
							({{ demandDiffText }})
						</span>
					</div>
				</div>
			</div>

			<!-- 2. 全局α控制（仅用户配置/手动调整） -->
			<div class="acd-global-row" v-if="mode !== 'system'">
				<div class="global-label">全局默认 α</div>
				<div class="global-slider">
					<el-slider
						v-model="globalAlpha"
						:min="0"
						:max="1"
						:step="0.05"
						:show-tooltip="true"
						style="flex: 1"
					/>
				</div>
				<el-input-number
					v-model="globalAlpha"
					:min="0"
					:max="1"
					:step="0.05"
					:precision="2"
					:controls="false"
					size="small"
					style="width: 72px"
				/>
				<div class="global-hint">
					<span class="hint-left">← 搜索侧重</span>
					<span class="hint-right">销量侧重 →</span>
				</div>
			</div>

			<!-- 3. 月份范围切换 -->
			<div class="acd-filter-bar">
				<el-radio-group v-model="showRange" size="small">
					<el-radio-button label="selected">选中区间</el-radio-button>
					<el-radio-button label="all">全部月份</el-radio-button>
				</el-radio-group>
				<span class="filter-hint" v-if="showRange === 'selected' && (!selectionStart || !selectionEnd)">
					未选择日期区间，显示全部
				</span>
			</div>

			<!-- 4. 逐月明细表 -->
			<div class="acd-table-wrap">
				<table class="acd-table">
					<thead>
						<tr>
							<th class="col-month">月份</th>
							<th class="col-status">销量</th>
							<th class="col-status">搜索</th>
							<th class="col-alpha">系统 α</th>
							<th class="col-reason">系统原因</th>
							<th class="col-alpha-edit">当前 α</th>
							<th class="col-num">系数</th>
							<th class="col-num">天数</th>
							<th class="col-num">日销</th>
							<th class="col-num">需求</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="row in filteredRows" :key="row.month" :class="{ 'row-no-data': row.bothNoData, 'row-in-range': row.inRange }">
							<td class="col-month">
								<span class="month-label">{{ row.monthLabel }}</span>
							</td>
							<td class="col-status">
								<span class="status-tag" :class="'st-' + row.salesStatus">{{ statusText(row.salesStatus) }}</span>
							</td>
							<td class="col-status">
								<span class="status-tag" :class="'st-' + row.keywordStatus">{{ statusText(row.keywordStatus) }}</span>
							</td>
							<td class="col-alpha sys-alpha">{{ row.systemAlpha !== null ? row.systemAlpha.toFixed(2) : '—' }}</td>
							<td class="col-reason">
								<el-tooltip :content="row.reasonFull" placement="top" :show-after="200" :disabled="!row.reasonFull">
									<span class="reason-text">{{ row.reasonShort }}</span>
								</el-tooltip>
							</td>
							<td class="col-alpha-edit">
								<div class="current-alpha-cell">
									<!-- 系统自动模式：只读显示实际α+来源 -->
									<template v-if="mode === 'system'">
										<span class="alpha-value-readonly">{{ row.actualAlpha.toFixed(2) }}</span>
										<el-tooltip placement="top" :show-after="200">
											<template #content>
												<div style="font-size:12px;line-height:1.8;min-width:140px">
													<div v-if="row.alphaSource === '用户'">
														<div><b>来源：用户配置</b></div>
														<div>全局 α：{{ userConfig?.default_alpha ?? '—' }}</div>
														<div v-if="userConfig?.monthly_remarks?.[row.month]">备注：{{ userConfig.monthly_remarks[row.month] }}</div>
														<div v-else-if="userConfig?.monthly_remarks?._global">备注：{{ userConfig.monthly_remarks._global }}</div>
													</div>
													<div v-else-if="row.alphaSource === '手动'">
														<div><b>来源：手动调整</b></div>
														<div>仅当前页面生效，关闭后恢复</div>
													</div>
													<div v-else>
														<div><b>来源：系统默认</b></div>
														<div>后端根据数据质量自动分配 α=0.70</div>
													</div>
												</div>
											</template>
											<span
												class="alpha-source-label source-hoverable"
												:class="'src-' + ({ '手动':'manual','用户':'user','系统':'system' }[row.alphaSource] || 'system')"
											>{{ row.alphaSource }}</span>
										</el-tooltip>
									</template>
									<!-- 用户/手动模式：可编辑 -->
									<template v-else-if="!hasMonthOverride(row.month)">
										<span class="alpha-value-global" @click="startMonthEdit(row.month)">{{ Number(globalAlpha).toFixed(2) }}</span>
										<span class="alpha-source-label src-global">全局</span>
									</template>
									<template v-else>
										<el-input-number
											:modelValue="getMonthAlpha(row.month)"
											@update:modelValue="setMonthAlpha(row.month, $event)"
											:min="0" :max="1" :step="0.05" :precision="2"
											:controls="false" size="small"
											style="width: 60px"
										/>
										<span class="alpha-clear" @click="clearMonthAlpha(row.month)" title="恢复全局">×</span>
									</template>
								</div>
							</td>
							<td class="col-num coeff-cell">
								<el-tooltip placement="top" :show-after="150">
									<template #content>
										<div style="font-size:12px;line-height:1.8;min-width:200px">
											<div><b>系数计算明细</b></div>
											<div>销量系数(sc): <b>{{ smartNum(row.filledSalesCoeff) }}</b></div>
											<div>搜索系数(kc): <b>{{ smartNum(row.keywordCoeff) }}</b></div>
											<div>当前 α: <b>{{ row.actualAlpha.toFixed(2) }}</b></div>
											<div style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.2)">
												{{ row.actualAlpha.toFixed(2) }} × {{ smartNum(row.filledSalesCoeff) }}
												+ {{ (1 - row.actualAlpha).toFixed(2) }} × {{ smartNum(row.keywordCoeff) }}
												= <b>{{ row.coefficient.toFixed(2) }}</b>
											</div>
										</div>
									</template>
									<span class="coeff-value">{{ row.coefficient.toFixed(2) }}</span>
								</el-tooltip>
							</td>
							<td class="col-num days-cell">{{ row.effectiveDays }}天</td>
							<td class="col-num">{{ row.dailySales.toFixed(1) }}</td>
							<td class="col-num demand-cell">{{ Math.round(row.monthDemand) }}</td>
						</tr>
					</tbody>
					<tfoot>
						<tr class="total-row">
							<td colspan="7" style="text-align: right; font-weight: 600">合计</td>
							<td class="col-num"></td>
							<td class="col-num days-cell" style="font-weight: 600">{{ totalDays }}天</td>
							<td class="col-num"></td>
							<td class="col-num demand-cell" style="font-weight: 700; font-size: 14px">{{ formatNum(totalDemand) }}</td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>

		<!-- 底部按钮 -->
		<template #footer>
			<div class="acd-footer">
				<el-button v-if="mode !== 'system'" @click="handleReset" size="default">重置</el-button>
				<div style="flex:1"></div>
				<el-button @click="handleClose" size="default">取消</el-button>
				<el-button v-if="mode === 'manual'" type="primary" plain @click="handleApply" size="default">应用</el-button>
				<el-button v-if="mode === 'user'" type="primary" @click="handleSave" :loading="saving" size="default">保存配置</el-button>
			</div>
		</template>
	</el-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch, nextTick } from "vue";
import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox } from "element-plus";
import dayjs from "dayjs";

const { service } = useCool();

// 安全解析α值：Number(0) || 0.7 会把合法的 α=0 吞掉，必须显式判空
const safeAlpha = (val: any, fallback = 0.7): number => {
	const n = Number(val);
	return (val === null || val === undefined || isNaN(n)) ? fallback : n;
};

const props = defineProps({
	visible: { type: Boolean, default: false },
	listing: { type: Object, default: () => ({}) },
	calendarData: { type: Object, default: () => ({}) },
	dailyAvgSales: { type: Number, default: 0 },
	selectionStart: { type: [String, null] as any, default: "" },
	selectionEnd: { type: [String, null] as any, default: "" },
	// 父组件传入的手动调整值（用于判断优先级）
	customAlpha: { type: [Number, undefined] as any, default: undefined },
	customMonthlyAlphas: { type: Object, default: () => ({}) }
});

const emit = defineEmits(["update:visible", "apply", "save", "reset"]);

// ========== 状态 ==========
const mode = ref<"system" | "user" | "manual">("system");
const globalAlpha = ref(0.7);
const monthlyOverrides = ref<Record<string, number>>({});
const saving = ref(false);
const showRange = ref<"selected" | "all">("selected");

// 用户历史配置（从数据库读取）
const userConfig = ref<any>(null);
const userConfigLoaded = ref(false);

// ========== 打开弹窗时加载用户配置 ==========
watch(() => props.visible, async (val) => {
	if (val) {
		showRange.value = (props.selectionStart && props.selectionEnd) ? "selected" : "all";
		await loadUserConfig();
		// 根据当前状态自动选tab：有手动→手动，有用户配置→用户，否则→系统
		suppressAlphaWatch.value = true;
		if (props.customAlpha !== undefined) {
			mode.value = "manual";
			globalAlpha.value = safeAlpha(props.customAlpha);
			monthlyOverrides.value = { ...(props.customMonthlyAlphas || {}) };
		} else if (userConfig.value) {
			mode.value = "user";
			globalAlpha.value = safeAlpha(userConfig.value.default_alpha);
			monthlyOverrides.value = { ...(userConfig.value.monthly_alphas || {}) };
		} else {
			mode.value = "system";
			globalAlpha.value = 0.7;
			monthlyOverrides.value = {};
		}
		nextTick(() => { suppressAlphaWatch.value = false; });
	}
});

const loadUserConfig = async () => {
	if (!props.listing?.id) return;
	try {
		const res = await service.request({
			url: "/admin/app/userAlphaConfig/get",
			method: "POST",
			data: {
				listing_id: props.listing.id,
				product_code: props.listing.product_code,
				marketplace: props.listing.marketplace,
				asin: props.listing.asin,
				msku: props.listing.msku,
				store_id: props.listing.store_id
			}
		});
		userConfig.value = res || null;
		userConfigLoaded.value = true;
	} catch {
		userConfig.value = null;
		userConfigLoaded.value = true;
	}
};

// ========== 切换模式时回显 ==========
const suppressAlphaWatch = ref(false);
watch(mode, (newMode) => {
	suppressAlphaWatch.value = true;
	if (newMode === "system") {
		monthlyOverrides.value = {};
	} else if (newMode === "user") {
		if (userConfig.value) {
			globalAlpha.value = safeAlpha(userConfig.value.default_alpha);
			monthlyOverrides.value = { ...(userConfig.value.monthly_alphas || {}) };
		} else {
			globalAlpha.value = 0.7;
			monthlyOverrides.value = {};
		}
	} else if (newMode === "manual") {
		// 手动模式：回显父组件的customAlpha，否则用当前值
		if (props.customAlpha !== undefined) {
			globalAlpha.value = safeAlpha(props.customAlpha);
			monthlyOverrides.value = { ...(props.customMonthlyAlphas || {}) };
		}
		// 如果没有customAlpha，保持当前globalAlpha不变（用户可能刚从用户配置切过来）
	}
	nextTick(() => { suppressAlphaWatch.value = false; });
});

// 拖动全局α滑块时清除逐月覆盖，让所有月份跟全局走
watch(globalAlpha, () => {
	if (!suppressAlphaWatch.value && mode.value !== 'system' && Object.keys(monthlyOverrides.value).length > 0) {
		monthlyOverrides.value = {};
	}
});

// ========== 月份范围 ==========
const selectedMonths = computed(() => {
	if (!props.selectionStart || !props.selectionEnd) return null;
	return {
		start: dayjs(props.selectionStart).format('YYYY-MM'),
		end: dayjs(props.selectionEnd).format('YYYY-MM')
	};
});

// ========== 逐月数据 ==========
interface MonthRow {
	month: string;
	monthLabel: string;
	salesStatus: string;
	keywordStatus: string;
	systemAlpha: number | null;
	actualAlpha: number;
	alphaSource: string;
	reasonFull: string;
	reasonShort: string;
	filledSalesCoeff: number;
	keywordCoeff: number;
	coefficient: number;
	dailySales: number;
	effectiveDays: number;
	monthDemand: number;
	bothNoData: boolean;
	inRange: boolean;
}

const monthRows = computed<MonthRow[]>(() => {
	const data = props.calendarData || {};
	const months = Object.keys(data).sort();
	const avgSales = props.dailyAvgSales || 0;
	const range = selectedMonths.value;

	return months.map(month => {
		const d = data[month];
		const combined = d?.combined || {};

		const salesStatus = combined.sales_data_status || (d?.sales?.status === 'ok' ? 'real' : 'no_data');
		const keywordStatus = combined.keyword_data_status || (d?.keywords?.status === 'ok' ? 'real' : 'no_data');
		// system_alpha = 纯系统建议值，alpha = 实际生效值（可能来自用户配置）
		const systemAlpha = (combined.system_alpha != null && !isNaN(Number(combined.system_alpha))) ? Number(combined.system_alpha) : null;
		const reasonFull = combined.alpha_reason_text || '';
		const reasonShort = reasonFull.length > 24 ? reasonFull.substring(0, 24) + '...' : reasonFull;
		const sc = combined.filled_sales_coefficient ?? 1;
		const kc = combined.keyword_coefficient ?? 1;
		const bothNoData = salesStatus === 'no_data' && keywordStatus === 'no_data';
		const inRange = range ? (month >= range.start && month <= range.end) : true;

		let actualAlpha: number;
		let coefficient: number;
		let alphaSource: string;

		if (mode.value === 'system') {
			// 系统自动：展示当前生效值（手动 > 用户配置 > 系统默认）
			if (props.customAlpha !== undefined) {
				// 有手动调整生效
				const monthAlpha = (props.customMonthlyAlphas || {})[month];
				actualAlpha = Number(monthAlpha ?? props.customAlpha);
				coefficient = bothNoData ? 1 : (actualAlpha * sc + (1 - actualAlpha) * kc);
				alphaSource = '手动';
			} else {
				// 没有手动 → 用后端预算值（已包含用户配置/系统默认优先级）
				actualAlpha = safeAlpha(combined.alpha);
				coefficient = bothNoData ? 1 : (combined.coefficient ?? 1);
				const src = combined.alpha_source || '';
				if (src.includes('user')) alphaSource = '用户';
				else alphaSource = '系统';
			}
		} else {
			// 用户配置/手动调整：用当前设置重算
			actualAlpha = Number(monthlyOverrides.value[month] ?? globalAlpha.value);
			coefficient = bothNoData ? 1 : (actualAlpha * sc + (1 - actualAlpha) * kc);
			alphaSource = (month in monthlyOverrides.value) ? '自定义' : '全局';
		}

		// 与外面 calculateReplenishment 保持一致：系数四舍五入到2位小数再算日需
		const roundedCoeff = Math.round(coefficient * 100) / 100;
		const dailySales = Math.round(avgSales * roundedCoeff * 100) / 100;

		// 按选择范围裁剪有效天数
		const monthStart = dayjs(month + '-01');
		const monthEnd = monthStart.endOf('month');
		let effectiveDays = monthStart.daysInMonth();

		if (props.selectionStart && props.selectionEnd && showRange.value === 'selected') {
			const selStart = dayjs(props.selectionStart);
			const selEnd = dayjs(props.selectionEnd);
			const effectiveStart = selStart.isAfter(monthStart) ? selStart : monthStart;
			const effectiveEnd = selEnd.isBefore(monthEnd) ? selEnd : monthEnd;
			effectiveDays = Math.max(0, effectiveEnd.diff(effectiveStart, 'day') + 1);
		}

		const monthDemand = Math.round(effectiveDays * dailySales);

		return {
			month, monthLabel: dayjs(month + '-01').format('M月'),
			salesStatus, keywordStatus, systemAlpha, actualAlpha, alphaSource,
			reasonFull, reasonShort,
			filledSalesCoeff: sc, keywordCoeff: kc,
			coefficient: roundedCoeff, dailySales, effectiveDays, monthDemand, bothNoData, inRange
		};
	});
});

// 按选中范围过滤
const filteredRows = computed(() => {
	if (showRange.value === 'all' || !selectedMonths.value) return monthRows.value;
	return monthRows.value.filter(r => r.inRange);
});

// ========== 系统默认总需求（用于对比） ==========
const systemTotalDemand = computed(() => {
	const data = props.calendarData || {};
	const avgSales = props.dailyAvgSales || 0;
	let total = 0;
	for (const month of Object.keys(data)) {
		const combined = data[month]?.combined || {};
		const coeff = combined.coefficient ?? 1;
		const days = dayjs(month + '-01').daysInMonth();
		total += avgSales * coeff * days;
	}
	return total;
});

const totalDemand = computed(() => filteredRows.value.reduce((sum, r) => sum + r.monthDemand, 0));
const totalDays = computed(() => filteredRows.value.reduce((sum, r) => sum + r.effectiveDays, 0));

const demandDiff = computed(() => totalDemand.value - systemTotalDemand.value);
const demandDiffClass = computed(() => demandDiff.value > 0 ? 'diff-up' : demandDiff.value < 0 ? 'diff-down' : 'diff-same');
const demandDiffText = computed(() => {
	const pct = systemTotalDemand.value > 0 ? ((demandDiff.value / systemTotalDemand.value) * 100).toFixed(1) : '0';
	const sign = demandDiff.value >= 0 ? '+' : '';
	return `${sign}${Math.round(demandDiff.value)}件 / ${sign}${pct}%`;
});

// ========== 逐月覆盖操作 ==========
const hasMonthOverride = (month: string) => month in monthlyOverrides.value;
const getMonthAlpha = (month: string) => monthlyOverrides.value[month] ?? globalAlpha.value;
const setMonthAlpha = (month: string, val: number | undefined) => {
	if (val !== null && val !== undefined) {
		monthlyOverrides.value[month] = Math.min(1, Math.max(0, val));
	}
};
const clearMonthAlpha = (month: string) => {
	delete monthlyOverrides.value[month];
	monthlyOverrides.value = { ...monthlyOverrides.value }; // 触发响应式
};
const startMonthEdit = (month: string) => {
	if (mode.value === 'system') return;
	monthlyOverrides.value[month] = globalAlpha.value;
	monthlyOverrides.value = { ...monthlyOverrides.value };
};

// ========== 工具函数 ==========
const statusText = (s: string) => {
	if (s === 'real') return '真实';
	if (s === 'filled') return '补全';
	return '无数据';
};

const formatNum = (n: number) => Math.round(n).toLocaleString();

// 智能精度：最多4位小数，去掉尾部多余0，至少保留2位
const smartNum = (n: number) => {
	const s = n.toFixed(4);
	// 去掉尾部0，但至少保留2位小数
	const trimmed = s.replace(/0+$/, '');
	const dotIdx = trimmed.indexOf('.');
	const decimals = dotIdx >= 0 ? trimmed.length - dotIdx - 1 : 0;
	return decimals < 2 ? n.toFixed(2) : trimmed;
};

// ========== 操作 ==========
const handleReset = () => {
	globalAlpha.value = 0.7;
	monthlyOverrides.value = {};
};

// 关闭弹窗（取消按钮）
const handleClose = () => {
	if (mode.value === 'system') emit('reset');
	emit('update:visible', false);
};

// X按钮/ESC关闭
const handleBeforeClose = (done: () => void) => {
	if (mode.value === 'system') emit('reset');
	done();
};

// el-dialog @update:modelValue
const handleDialogUpdate = (val: boolean) => {
	if (!val && mode.value === 'system') emit('reset');
	emit('update:visible', val);
};

// 手动调整：临时应用
const handleApply = () => {
	emit('apply', {
		mode: mode.value,
		alpha: globalAlpha.value,
		monthlyAlphas: { ...monthlyOverrides.value }
	});
	emit('update:visible', false);
};

// 用户配置：持久化保存（带确认弹窗）
const handleSave = async () => {
	const overrideMonths = Object.keys(monthlyOverrides.value);
	let summaryHtml = `<div style="font-size:13px;line-height:1.8;color:#1d2129">`;
	summaryHtml += `<div style="margin-bottom:8px"><b>全局默认 α：</b><span style="color:#4080ff;font-weight:600">${globalAlpha.value.toFixed(2)}</span></div>`;
	if (overrideMonths.length > 0) {
		summaryHtml += `<div style="margin-bottom:4px"><b>逐月覆盖：</b></div><div style="padding-left:12px">`;
		overrideMonths.sort().forEach(m => {
			summaryHtml += `<div>${dayjs(m + '-01').format('YYYY年M月')}：<span style="color:#4080ff;font-weight:600">${monthlyOverrides.value[m].toFixed(2)}</span></div>`;
		});
		summaryHtml += `</div>`;
	} else {
		summaryHtml += `<div style="color:#86909c">无逐月覆盖，所有月份使用全局默认值</div>`;
	}
	summaryHtml += `<div style="margin-top:10px;border-top:1px solid #f0f0f0;padding-top:8px"><b>预估补货量：</b>${formatNum(totalDemand.value)} 件</div></div>`;

	try {
		const { value: remark } = await ElMessageBox.prompt(summaryHtml, '保存用户配置', {
			dangerouslyUseHTMLString: true,
			confirmButtonText: '确认保存',
			cancelButtonText: '取消',
			inputPlaceholder: '备注说明（选填，如：旺季调高销量权重）',
			inputType: 'textarea',
			inputValue: '',
			customClass: 'alpha-save-confirm',
			distinguishCancelAndClose: true
		});

		const monthlyRemarks: Record<string, string> = {};
		if (remark && remark.trim()) monthlyRemarks._global = remark.trim();

		saving.value = true;
		await service.request({
			url: "/admin/app/userAlphaConfig/save",
			method: "POST",
			data: {
				listing_id: props.listing.id,
				product_code: props.listing.product_code,
				marketplace: props.listing.marketplace,
				asin: props.listing.asin,
				msku: props.listing.msku,
				store_id: props.listing.store_id,
				default_alpha: globalAlpha.value,
				monthly_alphas: monthlyOverrides.value,
				monthly_remarks: monthlyRemarks  // 没填备注时为{}，覆盖清掉旧备注
			}
		});
		ElMessage.success('α 配置已保存');
		emit('save', {
			mode: mode.value,
			alpha: globalAlpha.value,
			monthlyAlphas: { ...monthlyOverrides.value }
		});
		emit('update:visible', false);
	} catch (e: any) {
		if (e === 'cancel' || e === 'close') return;
		ElMessage.error('保存失败: ' + (e?.message || '未知错误'));
	} finally {
		saving.value = false;
	}
};
</script>

<style scoped>
/* ========== 弹窗整体 ========== */
.alpha-config-dialog :deep(.el-dialog__header) {
	padding: 16px 20px 12px;
	border-bottom: 1px solid #f0f0f0;
	margin-right: 0;
}
.alpha-config-dialog :deep(.el-dialog__body) {
	padding: 0;
}
.alpha-config-dialog :deep(.el-dialog__footer) {
	padding: 12px 20px;
	border-top: 1px solid #f0f0f0;
}

/* ========== 标题 ========== */
.acd-header {
	display: flex;
	align-items: center;
	gap: 12px;
}
.acd-title-row {
	display: flex;
	align-items: baseline;
	gap: 10px;
}
.acd-title {
	font-size: 16px;
	font-weight: 700;
	color: #1d2129;
}
.acd-subtitle {
	font-size: 12px;
	color: #86909c;
	font-weight: 400;
}
.acd-date-hint {
	font-size: 11px;
	color: #4080ff;
	background: #e8f3ff;
	padding: 2px 8px;
	border-radius: 3px;
}

/* ========== 内容区 ========== */
.acd-body {
	padding: 16px 20px;
}

/* ========== 模式栏 ========== */
.acd-mode-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16px;
	gap: 8px 16px;
	flex-wrap: wrap;
}
.mode-hint {
	font-size: 11px;
	color: #86909c;
	margin-left: 4px;
}

/* ========== 预览卡 ========== */
.acd-preview-card {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 2px;
}
.preview-main {
	display: flex;
	align-items: baseline;
	gap: 6px;
}
.preview-label {
	font-size: 12px;
	color: #86909c;
}
.preview-value {
	font-size: 18px;
	font-weight: 700;
	color: #1d2129;
}
.preview-compare {
	font-size: 11px;
}
.diff-up { color: #f53f3f; }
.diff-down { color: #00b42a; }
.diff-same { color: #86909c; }

/* ========== 全局α行 ========== */
.acd-global-row {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 16px;
	background: #f7f8fa;
	border-radius: 8px;
	margin-bottom: 16px;
	flex-wrap: wrap;
	position: relative;
}
.global-label {
	font-size: 13px;
	font-weight: 600;
	color: #4e5969;
	white-space: nowrap;
}
.global-slider {
	flex: 1;
	min-width: 180px;
}
.global-hint {
	width: 100%;
	display: flex;
	justify-content: space-between;
	font-size: 11px;
	color: #c9cdd4;
	margin-top: -4px;
	padding: 0 80px 0 100px;
}

/* ========== 过滤栏 ========== */
.acd-filter-bar {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 10px;
}
.filter-hint {
	font-size: 11px;
	color: #c9cdd4;
}

/* ========== 表格 ========== */
.acd-table-wrap {
	border: 1px solid #e5e6eb;
	border-radius: 8px;
	overflow: hidden;
}
.acd-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 12px;
}
.acd-table th {
	background: #f7f8fa;
	color: #4e5969;
	font-weight: 600;
	padding: 8px 10px;
	text-align: center;
	border-bottom: 1px solid #e5e6eb;
	white-space: nowrap;
}
.acd-table td {
	padding: 7px 10px;
	text-align: center;
	border-bottom: 1px solid #f2f3f5;
	color: #1d2129;
}
.acd-table tbody tr:hover {
	background: #f2f3f5;
}
.acd-table tbody tr:last-child td {
	border-bottom: none;
}

/* 列宽 */
.col-month { width: 52px; }
.col-status { width: 56px; }
.col-alpha { width: 64px; }
.col-reason { width: auto; text-align: left !important; }
.col-num { width: 60px; }

.col-reason th,
.col-reason { text-align: left !important; }

/* 月份标签 */
.month-label {
	font-weight: 600;
	color: #1d2129;
}

/* 状态标签 */
.status-tag {
	display: inline-block;
	padding: 1px 6px;
	border-radius: 3px;
	font-size: 11px;
	font-weight: 500;
}
.st-real { background: #e8f5e9; color: #2e7d32; }
.st-filled { background: #fff3e0; color: #e65100; }
.st-no_data { background: #ffebee; color: #c62828; }

/* 系统α列 */
.sys-alpha {
	color: #86909c;
	font-family: 'SF Mono', 'Consolas', monospace;
}

/* 原因文字 */
.reason-text {
	color: #86909c;
	font-size: 11px;
	cursor: default;
	max-width: 160px;
	display: inline-block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	vertical-align: middle;
}

/* 当前α列 */
.col-alpha-edit { width: 100px; }
.current-alpha-cell {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
}
/* 只读值（系统模式） */
.alpha-value-readonly {
	font-size: 12px;
	font-family: 'SF Mono', 'Consolas', monospace;
	color: #86909c;
}
/* 全局值（可点击切为独立） */
.alpha-value-global {
	font-size: 12px;
	font-family: 'SF Mono', 'Consolas', monospace;
	color: #4080ff;
	cursor: pointer;
	padding: 1px 6px;
	border: 1px dashed #c9cdd4;
	border-radius: 3px;
	transition: all 0.15s;
}
.alpha-value-global:hover {
	border-color: #4080ff;
	background: #f0f5ff;
}
/* 来源标签 */
.alpha-source-label {
	font-size: 10px;
	padding: 0 4px;
	border-radius: 2px;
	white-space: nowrap;
	line-height: 16px;
}
.src-system { color: #86909c; background: #f2f3f5; }
.src-global { color: #4080ff; background: #e8f3ff; }
.src-user { color: #ff7d00; background: #fff7e8; }
.src-manual { color: #00b42a; background: #e8ffea; }
.source-hoverable {
	cursor: help;
	border-bottom: 1px dashed currentColor;
	padding-bottom: 1px;
}
/* 清除按钮 */
.alpha-clear {
	font-size: 14px;
	color: #c9cdd4;
	cursor: pointer;
	line-height: 1;
	padding: 2px;
}
.alpha-clear:hover {
	color: #f53f3f;
}

/* 系数列高亮 */
.coeff-cell {
	font-weight: 600;
	font-family: 'SF Mono', 'Consolas', monospace;
	color: #4080ff;
}
.coeff-value {
	border-bottom: 1px dashed #4080ff;
	cursor: help;
	padding-bottom: 1px;
}

/* 需求列 */
.demand-cell {
	font-weight: 700;
	color: #1d2129;
}

/* 无数据行 */
.row-no-data {
	opacity: 0.55;
}
.row-in-range {
	background: #fafbff;
}
.days-cell {
	color: #86909c;
	font-size: 11px;
}

/* 合计行 */
.total-row td {
	background: #f7f8fa;
	font-size: 13px;
	border-top: 1px solid #e5e6eb;
	border-bottom: none !important;
}

/* ========== 底部 ========== */
.acd-footer {
	display: flex;
	align-items: center;
	gap: 8px;
}
</style>
