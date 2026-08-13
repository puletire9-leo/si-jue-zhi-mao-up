<template>
	<div class="visual-date-picker">
		<!-- 触发器：跟 el-date-picker 一样大小的输入框 -->
		<el-popover
			ref="popoverRef"
			trigger="click"
			placement="bottom-start"
			:width="popoverWidth"
			:show-arrow="false"
			popper-class="vdp-popover"
			@show="onPopoverShow"
		>
			<template #reference>
				<div class="picker-trigger">
					<el-icon class="trigger-icon"><calendar /></el-icon>
					<span v-if="modelValue && modelValue.length === 2" class="trigger-text">
						{{ modelValue[0] }} ~ {{ modelValue[1] }}
					</span>
					<span v-else class="trigger-placeholder">选择销售周期</span>
					<el-icon
						v-if="modelValue && modelValue.length === 2"
						class="trigger-clear"
						@click.stop="clearSelection"
					>
						<circle-close />
					</el-icon>
				</div>
			</template>

			<!-- 弹出层内容 -->
			<div class="vdp-content" v-loading="loading">
				<!-- 运输方式选择器（仅当 showShippingSelector 为 true 时显示） -->
				<div v-if="showShippingSelector" class="vdp-shipping-selector">
					<div class="vdp-shipping-row">
						<div
							v-for="method in localShippingMethods"
							:key="method.key"
							class="vdp-sm-btn"
							:class="{ active: localSelectedMethod === method.key }"
							:style="localSelectedMethod === method.key ? { borderColor: method.color, background: method.color + '30', boxShadow: '0 2px 10px ' + method.color + '40' } : {}"
							@click="onClickShippingMethod(method.key)"
						>
							<span class="vdp-sm-icon">{{ method.icon }}</span>
							<span class="vdp-sm-label">{{ method.label }}</span>
							<el-input-number
								v-model="method.days"
								:min="1"
								:max="120"
								size="small"
								controls-position="right"
								style="width: 65px"
								@click.stop
								@change="localSelectedMethod && onClickShippingMethod(localSelectedMethod)"
							/>
							<span class="vdp-sm-unit">天</span>
						</div>
						<div class="vdp-sm-buffer">
							<span class="vdp-sm-unit">缓冲</span>
							<el-input-number
								v-model="localBuffer"
								:min="0"
								:max="30"
								size="small"
								controls-position="right"
								style="width: 60px"
								@click.stop
								@change="localSelectedMethod && onClickShippingMethod(localSelectedMethod)"
							/>
							<span class="vdp-sm-unit">天</span>
						</div>
					</div>
					<!-- 运输到达图例 -->
					<div v-if="computedMarkers.length > 0" class="vdp-shipping-legend">
						<div v-for="(marker, idx) in computedMarkers" :key="marker.key" class="vdp-sl-item">
							<span class="vdp-sl-dot" :style="{ background: marker.color }"></span>
							<span>{{ marker.icon }} {{ marker.label }}: <strong>{{ marker.arrivalDate }}</strong></span>
							<span v-if="idx < computedMarkers.length - 1" style="color: #c0c4cc; margin: 0 2px">→</span>
						</div>
					</div>
				</div>

				<!-- 头部导航 -->
				<div class="vdp-header">
					<button class="nav-btn" :disabled="monthOffset <= 0" @click="navigateMonth(-1)">
						‹
					</button>
					<span class="vdp-title"
						>{{ calendarMonths[0]?.format("YYYY年M月") }} —
						{{ calendarMonths[1]?.format("M月") }}</span
					>
					<button class="nav-btn" :disabled="monthOffset >= 6" @click="navigateMonth(1)">
						›
					</button>
				</div>

				<!-- 视图切换按钮 -->
				<div v-if="dailyAvgSales > 0 && computedMarkers.length > 0" class="vdp-view-toggle">
					<button
						:class="['vt-btn', viewMode === 'stock' && 'vt-active']"
						@click="viewMode = 'stock'"
					>📦 库存断货</button>
					<button
						:class="['vt-btn', viewMode === 'logistics' && 'vt-active']"
						@click="viewMode = 'logistics'"
					>🚚 物流推导</button>
				</div>

				<!-- 图例 -->
				<div class="vdp-legend">
					<!-- 库存状态图例（仅库存视图） -->
					<template v-if="dailyAvgSales > 0 && viewMode === 'stock'">
						<span class="lg-item"><span class="lg-dot safe"></span>≥5天</span>
						<span class="lg-item"><span class="lg-dot warn"></span>&lt;5天</span>
						<span class="lg-item"><span class="lg-dot danger"></span>断货</span>
					</template>
					<!-- 运输方式图例（物流视图，可点击选择） -->
					<template v-if="computedMarkers.length > 0 && viewMode === 'logistics'">
						<button
							v-for="marker in computedMarkers"
							:key="marker.key"
							class="vdp-lg-btn"
							:class="{ active: localSelectedMethod === marker.key }"
							:style="localSelectedMethod === marker.key
								? { background: marker.color, borderColor: marker.color, color: '#fff', boxShadow: '0 2px 8px ' + marker.color + '50' }
								: { background: marker.color + '15', borderColor: marker.color + '40', color: marker.color }"
							@click="onClickShippingMethod(marker.key)"
						>{{ marker.icon }} {{ marker.label }}</button>
					</template>
				</div>

				<!-- 海运引导提示（醒目位置） -->
				<div v-if="seaWaitingEnd" class="vdp-sea-guide">
					<span class="vdp-sea-pulse"></span>
					🚢 海运到达日已选为开始日期，请在日历上点击选择结束日期
				</div>

				<!-- 日历网格 -->
				<div class="vdp-grid">
					<div v-for="(month, mIdx) in calendarMonths" :key="mIdx" class="vdp-month">
						<div class="month-label">{{ month.format("M月") }}</div>
						<div class="wk-header">
							<span
								v-for="d in ['一', '二', '三', '四', '五', '六', '日']"
								:key="d"
								>{{ d }}</span
							>
						</div>
						<div class="day-grid">
							<div
								v-for="day in getMonthDays(month)"
								:key="day.dateStr"
								class="dc"
								:class="getDayCellClass(day)"
								:style="getShippingCellStyle(day)"
								@click="handleDayClick(day)"
								:title="day.shippingLabel || ''"
							>
								<template v-if="day.isCurrentMonth">
									<span class="dn">{{ day.day }}</span>
									<div
										class="di"
										v-if="day.shipments.length > 0 || day.promotions.length > 0"
									>
										<el-tooltip
											v-if="day.shipments.length > 0"
											placement="top"
											:show-after="100"
										>
											<template #content>
												<div
													style="
														max-width: 260px;
														max-height: 180px;
														overflow-y: auto;
													"
												>
													<div
														style="
															font-weight: 600;
															margin-bottom: 4px;
															position: sticky;
															top: 0;
															background: #303133;
															padding: 2px 0;
														"
													>
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
														style="
															padding: 3px 0;
															border-top: 1px solid
																rgba(255, 255, 255, 0.1);
														"
													>
														<div style="font-weight: 500">
															{{ s.orderSn }}: {{ s.quantity }}件
														</div>
														<div style="font-size: 11px; color: #aaa">
															{{ s.logisticsChannelName }} |
															{{ s.shippingMethod }}
														</div>
													</div>
												</div>
											</template>
											<span class="ic ship">📦</span>
										</el-tooltip>
										<el-tooltip
											v-if="day.promotions.length > 0"
											placement="top"
											:show-after="100"
										>
											<template #content>
												<div
													style="
														max-width: 260px;
														max-height: 150px;
														overflow-y: auto;
													"
												>
													<div
														style="
															font-weight: 600;
															margin-bottom: 4px;
															position: sticky;
															top: 0;
															background: #303133;
															padding-bottom: 4px;
															z-index: 2;
														"
													>
														🔥 促销 ({{ day.promotions.length }}个)
													</div>
													<div
														v-for="p in day.promotions"
														:key="p.id"
														style="
															padding: 4px 0;
															border-bottom: 1px solid
																rgba(255, 255, 255, 0.1);
														"
													>
														<div
															style="font-weight: 500; color: #e6a23c"
														>
															{{ p.name }}
														</div>
														<div
															style="font-size: 11px; margin-top: 2px"
														>
															{{ p.start?.split(" ")[0] }} ~
															{{ p.end?.split(" ")[0] }}
														</div>
													</div>
												</div>
											</template>
											<span class="ic promo">BD</span>
										</el-tooltip>
									</div>
								</template>
							</div>
						</div>
					</div>
				</div>

				<!-- 底部：选择信息 + 确认 -->
				<div class="vdp-footer" v-if="selectionStart">
					<span class="sel-info">
						<span v-if="selectionColor" class="sel-color-dot" :style="{ background: selectionColor }"></span>
						<template v-if="selectionEnd && selectionEnd !== selectionStart">
							{{ selectionStart }} ~ {{ selectionEnd }}
							<span class="sel-days">共 {{ dayjs(selectionEnd).diff(dayjs(selectionStart), 'day') + 1 }} 天</span>
						</template>
						<template v-else-if="seaWaitingEnd">
							🚢 海运到达日已选为开始日期，请点击选择结束日期
						</template>
						<template v-else>
							{{ selectionStart }} (请选择结束日期)
						</template>
					</span>
					<div class="sel-actions">
						<el-button size="small" @click="clearSelection">清除</el-button>
						<el-button
							size="small"
							type="primary"
							:disabled="!selectionEnd || selectionEnd === selectionStart"
							@click="confirmSelection"
							>确认</el-button
						>
					</div>
				</div>
			</div>
		</el-popover>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, reactive } from "vue";
import { useCool } from "/@/cool";
import { Calendar, CircleClose } from "@element-plus/icons-vue";
import dayjs from "dayjs";

const { service } = useCool();

const props = defineProps({
	modelValue: { type: Array as () => string[] | null, default: null },
	dailyAvgSales: { type: Number, default: 0 },
	fbaValid: { type: Number, default: 0 },
	fbaShippingList: { type: Array as () => any[], default: () => [] },
	productCode: { type: String, default: "" },
	asin: { type: String, default: "" },
	marketplace: { type: String, default: "" },
	algorithm: { type: String, default: "daily_avg" },
	alpha: { type: Number, default: undefined }, // 综合走势 α 权重（可选）
	listingId: { type: Number, default: undefined }, // Listing表ID（用于查找用户α配置）
	msku: { type: String, default: "" }, // MSKU（备选定位）
	storeId: { type: Number, default: undefined }, // 店铺ID（备选定位）
	// 运输方式相关
	shippingMarkers: { type: Array as () => { key: string; label: string; arrivalDate: string; color: string; icon: string }[], default: () => [] },
	showShippingSelector: { type: Boolean, default: false },
	shippingMethods: { type: Array as () => { key: string; label: string; days: number; color: string; icon: string }[], default: () => [] },
	shippingBuffer: { type: Number, default: 5 },
	selectedShippingMethod: { type: String, default: null }
});

const emit = defineEmits(["update:modelValue", "change", "shipping-change"]);

const popoverRef = ref();
const loading = ref(false);
const dataLoaded = ref(false);

// 弹出层宽度：有运输选择器时加宽
const popoverWidth = computed(() => props.showShippingSelector ? 620 : 560);

// ====== 本地运输方式状态 ======
const localShippingMethods = reactive<{ key: string; label: string; days: number; color: string; icon: string }[]>([]);
const localBuffer = ref(5);
const localSelectedMethod = ref<string | null>(null);

// 初始化本地运输配置
watch(
	() => props.shippingMethods,
	(val) => {
		if (val && val.length > 0) {
			localShippingMethods.splice(0, localShippingMethods.length, ...val.map(m => ({ ...m })));
		}
	},
	{ immediate: true, deep: true }
);
watch(() => props.shippingBuffer, (val) => { localBuffer.value = val; }, { immediate: true });
watch(() => props.selectedShippingMethod, (val) => { localSelectedMethod.value = val; }, { immediate: true });

const viewMode = ref<'stock' | 'logistics'>('stock');

// 计算运输标记
const computedMarkers = computed(() => {
	// 如果外部传了 shippingMarkers 直接用（产品级别）
	if (props.shippingMarkers && props.shippingMarkers.length > 0) {
		return props.shippingMarkers;
	}
	// 否则从本地运输状态计算（全局级别）
	if (!localSelectedMethod.value || localShippingMethods.length === 0) return [];
	const today = dayjs().startOf('day');
	const methodIndex = localShippingMethods.findIndex(m => m.key === localSelectedMethod.value);
	if (methodIndex < 0) return [];

	const markers: { key: string; label: string; arrivalDate: string; color: string; icon: string }[] = [];
	for (let i = methodIndex; i < localShippingMethods.length; i++) {
		const m = localShippingMethods[i];
		const arrival = today.add(m.days + localBuffer.value, 'day').format('YYYY-MM-DD');
		markers.push({ key: m.key, label: m.label, arrivalDate: arrival, color: m.color, icon: m.icon });
	}
	return markers;
});

// 视图模式仅初始化一次：有运输标记但没有产品数据时默认物流视图
let viewModeInitialized = false;
watch(
	() => [computedMarkers.value.length, props.dailyAvgSales],
	([markersLen, avg]) => {
		if (viewModeInitialized) return; // 只初始化一次，不覆盖用户手动切换
		if (markersLen > 0 && !avg) { viewMode.value = 'logistics'; viewModeInitialized = true; }
		else if (avg && avg > 0) { viewMode.value = 'stock'; viewModeInitialized = true; }
	},
	{ immediate: true }
);

// 点击运输方式按钮
const onClickShippingMethod = (methodKey: string) => {
	localSelectedMethod.value = methodKey;

	// 优先使用 localShippingMethods（全局日历有完整配置）
	if (localShippingMethods.length > 0) {
		const today = dayjs().startOf('day');
		const methodIndex = localShippingMethods.findIndex(m => m.key === methodKey);
		if (methodIndex < 0) return;

		const method = localShippingMethods[methodIndex];
		const startDate = today.add(method.days + localBuffer.value, 'day');

		selectionColor.value = method.color;
		seaWaitingEnd.value = false;

		if (methodIndex < localShippingMethods.length - 1) {
			const nextMethod = localShippingMethods[methodIndex + 1];
			const endDate = today.add(nextMethod.days + localBuffer.value, 'day').subtract(1, 'day');

			selectionStart.value = startDate.format('YYYY-MM-DD');
			selectionEnd.value = endDate.format('YYYY-MM-DD');

			const range = [selectionStart.value, selectionEnd.value];
			emit("update:modelValue", range);
			emit("change", range);
			emit("shipping-change", {
				method: methodKey,
				methods: localShippingMethods.map(m => ({ key: m.key, label: m.label, days: m.days })),
				buffer: localBuffer.value,
				dateRange: range
			});
		} else {
			selectionStart.value = startDate.format('YYYY-MM-DD');
			selectionEnd.value = null;
			seaWaitingEnd.value = true;
		}

		const startMonth = startDate.startOf('month');
		const currentBaseMonth = dayjs().startOf('month');
		monthOffset.value = startMonth.diff(currentBaseMonth, 'month');
		if (monthOffset.value < 0) monthOffset.value = 0;
		return;
	}

	// 备用路径：使用 computedMarkers（明细日历只有 shippingMarkers prop）
	const markers = computedMarkers.value;
	const markerIndex = markers.findIndex(m => m.key === methodKey);
	if (markerIndex < 0) return;

	const marker = markers[markerIndex];
	selectionColor.value = marker.color;
	seaWaitingEnd.value = false;

	const startDate = dayjs(marker.arrivalDate);

	if (markerIndex < markers.length - 1) {
		const nextMarker = markers[markerIndex + 1];
		selectionStart.value = marker.arrivalDate;
		selectionEnd.value = dayjs(nextMarker.arrivalDate).subtract(1, 'day').format('YYYY-MM-DD');

		const range = [selectionStart.value, selectionEnd.value];
		emit("update:modelValue", range);
		emit("change", range);
	} else {
		// 海运：只选开始日期
		selectionStart.value = marker.arrivalDate;
		selectionEnd.value = null;
		seaWaitingEnd.value = true;
	}

	const startMonth = startDate.startOf('month');
	const currentBaseMonth = dayjs().startOf('month');
	monthOffset.value = startMonth.diff(currentBaseMonth, 'month');
	if (monthOffset.value < 0) monthOffset.value = 0;
};

// ====== 日历导航 ======
const monthOffset = ref(0);
const calendarMonths = computed(() => {
	const base = dayjs().startOf("month").add(monthOffset.value, "month");
	return [base, base.add(1, "month")];
});
const navigateMonth = (d: number) => {
	monthOffset.value += d;
};

// ====== 日期选择 ======
const selectionStart = ref<string | null>(null);
const selectionEnd = ref<string | null>(null);
const selectionColor = ref<string | null>(null); // 选中区间的颜色（来自运输方式或默认蓝紫色）
const seaWaitingEnd = ref(false); // 海运等待用户选结束日期

watch(
	() => props.modelValue,
	(val) => {
		if (val && val.length === 2) {
			selectionStart.value = val[0] as string;
			selectionEnd.value = val[1] as string;
		}
	},
	{ immediate: true }
);

const handleDayClick = (day: DayData) => {
	if (!day.isCurrentMonth || day.isPast) return;
	if (!selectionStart.value || (selectionEnd.value && !seaWaitingEnd.value)) {
		selectionStart.value = day.dateStr;
		selectionEnd.value = null;
		selectionColor.value = null; // 手动选择用默认色
		seaWaitingEnd.value = false;
	} else {
		if (day.dateStr < selectionStart.value) {
			selectionEnd.value = selectionStart.value;
			selectionStart.value = day.dateStr;
		} else {
			selectionEnd.value = day.dateStr;
		}
		seaWaitingEnd.value = false;

		// 海运等待结束日期时，用户点了结束日期后自动 emit
		if (selectionColor.value && selectionStart.value && selectionEnd.value) {
			const range = [selectionStart.value, selectionEnd.value];
			emit("update:modelValue", range);
			emit("change", range);
			emit("shipping-change", {
				method: localSelectedMethod.value || '',
				methods: localShippingMethods.map(m => ({ key: m.key, label: m.label, days: m.days })),
				buffer: localBuffer.value,
				dateRange: range
			});
		}
	}
};

const confirmSelection = () => {
	if (selectionStart.value && selectionEnd.value) {
		const range = [selectionStart.value, selectionEnd.value];
		emit("update:modelValue", range);
		emit("change", range);
		popoverRef.value?.hide?.();
	}
};

const clearSelection = () => {
	selectionStart.value = null;
	selectionEnd.value = null;
	selectionColor.value = null;
	seaWaitingEnd.value = false;
	// 不清除 localSelectedMethod，保留运输色带显示
	emit("update:modelValue", null);
	emit("change", null);
};

const isInRange = (ds: string): boolean => {
	if (!selectionStart.value) return false;
	if (!selectionEnd.value) return ds === selectionStart.value;
	return ds >= selectionStart.value && ds <= selectionEnd.value;
};

// ====== 懒加载 ======
const promotionsRaw = ref<Record<string, any>>({});
const calendarCoefficients = ref<Record<string, any>>({});
const calendarBaseSalesValue = ref(0);

const onPopoverShow = () => {
	if (!dataLoaded.value && props.productCode) loadData();
	// 打开时自动触发运输方式选择（确保颜色和选中状态正确）
	if (localSelectedMethod.value && props.showShippingSelector) {
		onClickShippingMethod(localSelectedMethod.value);
	} else if (selectionStart.value) {
		// 无运输选择器时，导航到已选开始日期的月份
		const startMonth = dayjs(selectionStart.value).startOf('month');
		const currentBaseMonth = dayjs().startOf('month');
		const offset = startMonth.diff(currentBaseMonth, 'month');
		monthOffset.value = Math.max(0, offset);
	}
};

const loadData = async () => {
	if (!props.productCode || !props.asin || !props.marketplace) return;
	loading.value = true;
	try {
		const sm = dayjs().subtract(1, "month").format("YYYY-MM");
		const em = dayjs().add(6, "month").format("YYYY-MM");
		await Promise.all([
			service
				.request({
					url: "/admin/app/analysis/getPromotions",
					method: "POST",
					data: {
						product_code: props.productCode,
						marketplace: props.marketplace,
						asin: props.asin
					}
				})
				.then((r: any) => {
					promotionsRaw.value = r?.promotions || {};
				})
				.catch(() => {}),
			service
				.request({
					url: "/admin/app/analysis/getCalendarData",
					method: "POST",
					data: {
						product_code: props.productCode,
						asin: props.asin,
						marketplace: props.marketplace,
						startMonth: sm,
						endMonth: em,
						listing_id: props.listingId,
						msku: props.msku,
						store_id: props.storeId
					}
				})
				.then((r: any) => {
					calendarBaseSalesValue.value = r?.base_sales_value || 0;
					calendarCoefficients.value = r?.calendar_data || {};
				})
				.catch(() => {})
		]);
		dataLoaded.value = true;
	} finally {
		loading.value = false;
	}
};

// ====== 促销数据 ======
const promotions = computed(() =>
	Object.entries(promotionsRaw.value).map(([id, p]) => ({
		id,
		name: p.type || "BD",
		start: p.start,
		end: p.end,
		status: p.status,
		discount_price: p.discount_price,
		asin: p.asin,
		shop_name: p.shop_name || ""
	}))
);

// ====== 日历核心 ======
interface DayData {
	dateStr: string;
	day: number;
	isCurrentMonth: boolean;
	isPast: boolean;
	isToday: boolean;
	stockStatus: "safe" | "warning" | "danger" | "none";
	shipments: any[];
	promotions: any[];
	shippingZone: string | null;
	shippingLabel: string;
}

const getMonthDays = (month: dayjs.Dayjs): DayData[] => {
	const days: DayData[] = [];
	const som = month.startOf("month"),
		eom = month.endOf("month");
	const today = dayjs().startOf("day");
	let fw = som.day() - 1;
	if (fw < 0) fw = 6;
	for (let i = 0; i < fw; i++) {
		days.push({
			dateStr: `e-${i}`,
			day: 0,
			isCurrentMonth: false,
			isPast: true,
			isToday: false,
			stockStatus: "none",
			shipments: [],
			promotions: [],
			shippingZone: null,
			shippingLabel: ''
		});
	}
	for (let d = 1; d <= eom.date(); d++) {
		const cur = month.date(d),
			ds = cur.format("YYYY-MM-DD");
		const isPast = cur.isBefore(today, "day"),
			isToday = cur.isSame(today, "day");
		const dShip = (props.fbaShippingList || []).filter((s: any) => s.amazonSaleDate === ds);
		const dProm = promotions.value.filter((p) => {
			const s = p.start?.split(" ")[0],
				e = p.end?.split(" ")[0];
			return s && e && ds >= s && ds <= e;
		});
		let ss: "safe" | "warning" | "danger" | "none" = "none";
		if (!isPast && props.dailyAvgSales > 0) {
			ss = calcStock(cur.diff(today, "day"), ds);
		}
		const szInfo = getShippingZone(ds);
		days.push({
			dateStr: ds,
			day: d,
			isCurrentMonth: true,
			isPast,
			isToday,
			stockStatus: ss,
			shipments: dShip,
			promotions: dProm,
			shippingZone: szInfo.zone,
			shippingLabel: szInfo.label
		});
	}
	return days;
};

const getCoeff = (d: dayjs.Dayjs): number => {
	if (props.algorithm === "daily_avg") return 1;
	const monthStr = d.format("YYYY-MM");
	const cd = calendarCoefficients.value[monthStr];
	if (!cd) return 1;
	if (props.algorithm === "history") {
		return cd.sales?.status === "ok" && cd.sales.coefficient > 0 ? cd.sales.coefficient : 1;
	} else if (props.algorithm === "trend") {
		return cd.keywords?.status === "ok" && cd.keywords.coefficient > 0
			? cd.keywords.coefficient
			: 1;
	} else if (props.algorithm === "combined") {
		const combined = cd.combined;
		if (combined && combined.coefficient !== undefined) {
			if (props.alpha !== undefined
				&& combined.filled_sales_coefficient !== undefined
				&& combined.keyword_coefficient !== undefined) {
				return props.alpha * combined.filled_sales_coefficient
					+ (1 - props.alpha) * combined.keyword_coefficient;
			}
			return combined.coefficient;
		}
		return 1;
	}
	return 1;
};

const calcStock = (dft: number, ds: string): "safe" | "warning" | "danger" | "none" => {
	if (props.dailyAvgSales <= 0) return "none";
	let stock = props.fbaValid;
	const base = props.dailyAvgSales,
		today = dayjs().startOf("day");
	for (let i = 0; i < dft; i++) {
		const cd = today.add(i, "day"),
			cds = cd.format("YYYY-MM-DD");
		(props.fbaShippingList || [])
			.filter((s: any) => s.amazonSaleDate === cds)
			.forEach((a: any) => (stock += a.quantity || 0));
		stock -= base * getCoeff(cd);
		if (stock < 0) stock = 0;
	}
	(props.fbaShippingList || [])
		.filter((s: any) => s.amazonSaleDate === ds)
		.forEach((a: any) => (stock += a.quantity || 0));
	if (stock <= 0) return "danger";
	const eff = base * getCoeff(today.add(dft, "day"));
	if (eff <= 0) return "safe";
	return stock / eff >= 5 ? "safe" : "warning";
};

const getDayCellClass = (day: DayData) => {
	const c: string[] = [];
	if (!day.isCurrentMonth) c.push("empty");
	if (day.isPast) c.push("past");
	if (day.isToday) c.push("today");
	// 库存状态只在库存视图下显示
	if (viewMode.value === 'stock' && day.stockStatus !== "none") c.push(`s-${day.stockStatus}`);
	if (day.shipments.length > 0) c.push("has-ship");
	if (day.promotions.length > 0) c.push("has-promo");
	// 运输色带只在物流视图下显示
	if (viewMode.value === 'logistics' && day.shippingZone) c.push('has-shipping');
	if (isInRange(day.dateStr)) c.push("in-range");
	return c;
};

// 运输方式区间判断
const getShippingZone = (dateStr: string): { zone: string | null; label: string } => {
	const markers = computedMarkers.value;
	if (!markers || markers.length === 0) return { zone: null, label: '' };

	for (let i = 0; i < markers.length; i++) {
		const current = markers[i];
		const next = markers[i + 1];
		const start = current.arrivalDate;
		const end = next ? dayjs(next.arrivalDate).subtract(1, 'day').format('YYYY-MM-DD') : null;

		if (dateStr === start) {
			return { zone: current.key, label: `${current.icon} ${current.label}到达日` };
		}
		if (end && dateStr > start && dateStr <= end) {
			return { zone: current.key, label: `${current.icon} ${current.label}段` };
		}
		if (!end && dateStr >= start) {
			return { zone: current.key, label: `${current.icon} ${current.label}到达后` };
		}
	}
	return { zone: null, label: '' };
};

// 运输方式单元格样式
const getShippingCellStyle = (day: DayData) => {
	const inRange = isInRange(day.dateStr);
	const hasShipping = day.shippingZone && day.isCurrentMonth;

	// 选中区间：使用运输方式颜色或默认蓝紫色
	if (inRange && day.isCurrentMonth) {
		// 库存模式用默认蓝紫色，物流模式用运输方式颜色
		const color = viewMode.value === 'stock' ? '#7c5cfc' : (selectionColor.value || '#7c5cfc');
		// 整段统一深色
		return {
			background: color + '88',
			borderColor: color,
			borderWidth: '1.5px',
			color: '#fff',
		};
	}

	// 非选中区间：显示运输色带（仅物流视图）
	if (viewMode.value !== 'logistics') return {};
	if (!hasShipping) {
		// 物流视图下无运输色带的格子也要有可见背景
		if (day.isCurrentMonth && !day.isPast) return { background: '#f7f8fa' };
		return {};
	}
	const markers = computedMarkers.value;
	if (!markers) return {};
	const marker = markers.find(m => m.key === day.shippingZone);
	if (!marker) return {};

	const isArrivalDay = day.dateStr === marker.arrivalDate;
	if (isArrivalDay) {
		return {
			background: marker.color + '45',
			borderColor: marker.color,
			borderWidth: '2px',
			boxShadow: `0 0 6px ${marker.color}30`
		};
	}
	return {
		background: marker.color + '20',
		borderColor: marker.color + '50',
	};
};
</script>

<style scoped>
.visual-date-picker {
	display: inline-block;
}

/* === 触发器（跟 el-input 一样大小） === */
.picker-trigger {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 0 8px;
	height: 28px;
	border: 1px solid #dcdfe6;
	border-radius: 4px;
	cursor: pointer;
	font-size: 12px;
	color: #606266;
	background: #fff;
	transition: border-color 0.2s;
	min-width: 180px;
	max-width: 220px;
}
.picker-trigger:hover {
	border-color: #409eff;
}
.trigger-icon {
	font-size: 14px;
	color: #c0c4cc;
	flex-shrink: 0;
}
.trigger-text {
	color: #303133;
	font-size: 12px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.trigger-placeholder {
	color: #c0c4cc;
	font-size: 12px;
}
.trigger-clear {
	font-size: 14px;
	color: #c0c4cc;
	flex-shrink: 0;
	margin-left: auto;
}
.trigger-clear:hover {
	color: #f56c6c;
}

/* === 弹出层内容 === */
.vdp-content {
	padding: 4px 0;
}

/* === 运输方式选择器 === */
.vdp-shipping-selector {
	padding: 8px 0 10px;
	margin-bottom: 6px;
	border-bottom: 1px dashed #e4e7ed;
}

.vdp-shipping-row {
	display: flex;
	align-items: center;
	gap: 6px;
	flex-wrap: wrap;
}

.vdp-sm-btn {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 4px 8px;
	border: 2px solid #dcdfe6;
	border-radius: 6px;
	cursor: pointer;
	background: #fff;
	transition: all 0.2s;
	font-size: 12px;
}
.vdp-sm-btn:hover {
	border-color: #c0c4cc;
	box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}
.vdp-sm-btn.active {
	font-weight: 700;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
	transform: scale(1.03);
}
.vdp-sm-icon {
	font-size: 14px;
}
.vdp-sm-label {
	font-weight: 500;
	color: #303133;
	min-width: 22px;
}
.vdp-sm-unit {
	font-size: 11px;
	color: #909399;
}
.vdp-sm-buffer {
	display: flex;
	align-items: center;
	gap: 4px;
	margin-left: 4px;
	padding-left: 8px;
	border-left: 1px solid #e4e7ed;
}

.vdp-shipping-legend {
	display: flex;
	align-items: center;
	gap: 4px;
	margin-top: 8px;
	flex-wrap: wrap;
	font-size: 11px;
	color: #606266;
}
.vdp-sl-item {
	display: flex;
	align-items: center;
	gap: 3px;
}
.vdp-sl-dot {
	width: 8px;
	height: 8px;
	border-radius: 2px;
	display: inline-block;
}

/* === 头部导航 === */
.vdp-header {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	margin-bottom: 4px;
}
.vdp-title {
	font-size: 13px;
	font-weight: 600;
	color: #303133;
}
.nav-btn {
	border: none;
	background: #f5f7fa;
	font-size: 16px;
	cursor: pointer;
	color: #606266;
	padding: 0 8px;
	line-height: 24px;
	border-radius: 4px;
}
.nav-btn:hover:not(:disabled) {
	background: #e4e7ed;
	color: #409eff;
}
.nav-btn:disabled {
	opacity: 0.3;
	cursor: not-allowed;
}

/* === 视图切换按钮 === */
.vdp-view-toggle {
	display: flex;
	justify-content: center;
	gap: 0;
	margin-bottom: 6px;
	background: #f0f2f5;
	border-radius: 6px;
	padding: 2px;
}
.vt-btn {
	padding: 4px 14px;
	font-size: 12px;
	border: none;
	background: transparent;
	color: #606266;
	cursor: pointer;
	border-radius: 5px;
	transition: all 0.2s;
	font-weight: 500;
}
.vt-btn:hover {
	color: #409eff;
}
.vt-btn.vt-active {
	background: #fff;
	color: #409eff;
	font-weight: 600;
	box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}

.vdp-legend {
	display: flex;
	align-items: center;
	gap: 10px;
	justify-content: center;
	font-size: 11px;
	color: #909399;
	margin-bottom: 6px;
	flex-wrap: wrap;
}
.lg-sep {
	color: #dcdfe6;
	margin: 0 2px;
}
.lg-item {
	display: flex;
	align-items: center;
	gap: 3px;
}
.lg-dot {
	width: 10px;
	height: 10px;
	border-radius: 2px;
	display: inline-block;
}
.lg-dot.safe {
	background: #d1f2cc;
	border: 1px solid #79c968;
}
.lg-dot.warn {
	background: #feebb6;
	border: 1px solid #eba434;
}
.lg-dot.danger {
	background: #ffcfcf;
	border: 1px solid #fc5d5d;
}

/* === 日历网格 === */
.vdp-grid {
	display: flex;
	gap: 16px;
}
.vdp-month {
	flex: 1;
	min-width: 0;
}
.month-label {
	text-align: center;
	font-size: 13px;
	font-weight: 600;
	color: #303133;
	margin-bottom: 4px;
}
.wk-header {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	text-align: center;
	font-size: 11px;
	color: #909399;
	margin-bottom: 2px;
}
.day-grid {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 2px;
}

/* === 日期格子 === */
.dc {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	width: 32px;
	height: 32px;
	font-size: 12px;
	border-radius: 4px;
	cursor: pointer;
	transition: all 0.12s;
	box-sizing: border-box;
	border: 1px solid #ebeef5;
	background: #fff;
	padding-top: 3px;
}
.dc:hover:not(.empty):not(.past) {
	border-color: #409eff;
	box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
	z-index: 1;
}
.dc.empty {
	cursor: default;
	background: transparent;
}
.dc.past {
	cursor: not-allowed;
	background: repeating-linear-gradient(
		45deg,
		#f5f7fa,
		#f5f7fa 4px,
		#fafbfc 4px,
		#fafbfc 8px
	) !important;
	color: #a8abb2;
	border: 1px solid #dcdfe6;
	opacity: 0.9;
}
.dc.today {
	font-weight: 700;
	box-shadow: inset 0 0 0 1.5px #409eff;
}

.dc.s-safe {
	background: #d1f2cc;
	border-color: #8be379;
	color: #2e7a1f;
	font-weight: 600;
}
.dc.s-warning {
	background: #feebb6;
	border-color: #fbba4e;
	color: #ad6800;
	font-weight: 600;
}
.dc.s-danger {
	background: #ffcfcf;
	border-color: #ffa1a1;
	color: #c41414;
	font-weight: 600;
}

.dc.in-range {
	z-index: 1;
	position: relative;
}
.dc.in-range .dn {
	font-weight: 700;
}
.sel-color-dot {
	display: inline-block;
	width: 10px;
	height: 10px;
	border-radius: 3px;
	margin-right: 4px;
	vertical-align: middle;
}

/* === 海运引导提示 === */
.vdp-sea-guide {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 10px 14px;
	margin: 8px 0;
	background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
	border: 1.5px solid #fb8c00;
	border-radius: 8px;
	font-size: 13px;
	font-weight: 600;
	color: #e65100;
	animation: seaGuideIn 0.3s ease-out;
}
.vdp-sea-pulse {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	background: #fb8c00;
	animation: seaPulse 1.2s ease-in-out infinite;
	flex-shrink: 0;
}
@keyframes seaPulse {
	0%, 100% { transform: scale(1); opacity: 1; }
	50% { transform: scale(1.5); opacity: 0.5; }
}
@keyframes seaGuideIn {
	from { opacity: 0; transform: translateY(-6px); }
	to { opacity: 1; transform: translateY(0); }
}

.dn {
	font-size: 12px;
	line-height: 1;
	color: #303133;
}
.dc.past .dn {
	color: #a8abb2;
}

/* 图标区 - 角标聚合居中 */
.di {
	display: flex;
	gap: 2px;
	position: absolute;
	bottom: 3px;
	left: 50%;
	transform: translateX(-50%);
	width: 100%;
	justify-content: center;
}
.ic {
	font-size: 8px;
	line-height: 1;
	cursor: help;
}
.ic.ship {
	font-size: 10px;
}
.ic.promo {
	font-size: 8px;
	background: #7c3aed;
	color: #fff;
	padding: 1px 2.5px;
	border-radius: 2px;
	font-weight: 700;
	box-shadow: 0 1px 3px rgba(124, 58, 237, 0.4);
	border: 0.5px solid rgba(255, 255, 255, 0.5);
	transform: scale(0.9);
}

/* === 底部 === */
.vdp-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px solid #ebeef5;
}
.sel-info {
	font-size: 12px;
	color: #409eff;
	font-weight: 500;
}
.sel-days {
	display: inline-block;
	background: #409eff;
	color: #fff;
	font-size: 11px;
	padding: 1px 8px;
	border-radius: 10px;
	margin-left: 6px;
	font-weight: 600;
}
.sel-actions {
	display: flex;
	gap: 6px;
}

/* === 物流推导快捷按钮 === */
.vdp-logistics-btns {
	display: flex;
	justify-content: center;
	gap: 6px;
	margin-bottom: 6px;
	flex-wrap: wrap;
}
.vdp-lg-btn {
	padding: 5px 14px;
	font-size: 12px;
	border: 1.5px solid;
	cursor: pointer;
	border-radius: 16px;
	transition: all 0.25s;
	font-weight: 600;
	letter-spacing: 0.3px;
}
.vdp-lg-btn:hover {
	transform: translateY(-1px);
	filter: brightness(1.1);
}
.vdp-lg-btn.active {
	transform: scale(1.05);
}
</style>

<style>
/* 全局样式：弹出层无多余间距 */
.vdp-popover.el-popover {
	padding: 12px !important;
	border-radius: 8px !important;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
}
</style>
