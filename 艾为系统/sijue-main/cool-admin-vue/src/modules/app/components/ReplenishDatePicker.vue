<template>
	<div class="visual-date-picker" :class="{ 'is-detail-mode': isDetailMode }">
		<!-- 触发器：跟 el-date-picker 一样大小的输入框 -->
		<el-popover
			ref="popoverRef"
			trigger="click"
			placement="bottom-start"
			:width="popoverWidth"
			:show-arrow="false"
			:popper-class="popoverClass"
			@show="onPopoverShow"
		>
			<template #reference>
				<div class="picker-trigger">
					<el-icon class="trigger-icon"><calendar /></el-icon>
					<span v-if="displayDateRange" class="trigger-text">
						<span class="trigger-range" :title="`${displayDateRange.fullStart} ~ ${displayDateRange.fullEnd}`">
							{{ displayDateRange.start }} ~ {{ displayDateRange.end }}
						</span>
						<span class="trigger-days">共 {{ displayDateRange.days }} 天</span>
					</span>
					<span v-else class="trigger-placeholder">选择销售周期</span>
					<el-icon
						v-if="displayDateRange"
						class="trigger-clear"
						@click.stop="clearSelection"
					>
						<circle-close />
					</el-icon>
				</div>
			</template>

			<!-- 弹出层内容 -->
			<div class="vdp-content" :class="{ 'vdp-content-detail': isDetailMode }" v-loading="loading">
				<!-- 运输方式选择器（仅当 showShippingSelector 为 true 时显示） -->
				<div v-if="showShippingSelector" class="vdp-shipping-selector">
					<div v-if="shippingProfiles.length > 0" class="vdp-profile-selector">
						<span class="vdp-profile-label">配置</span>
						<el-radio-group
							:model-value="shippingProfile"
							size="small"
							@change="onProfileChange"
						>
							<el-radio-button
								v-for="profile in shippingProfiles"
								:key="profile.key"
								:label="profile.key"
							>
								{{ profile.label }}
							</el-radio-button>
						</el-radio-group>
						<span v-if="shippingConfigReadonly" class="vdp-profile-note">预设天数已锁定</span>
					</div>
					<div class="vdp-shipping-row">
						<div
							v-for="method in localShippingMethods"
							:key="method.key"
							class="vdp-sm-btn"
							:class="{ active: localSelectedMethods.includes(method.key), inactive: !localSelectedMethods.includes(method.key), 'is-disabled': !!selectionEnd || shippingConfigReadonly, 'is-readonly': shippingConfigReadonly }"
							:style="localSelectedMethods.includes(method.key) ? { borderColor: method.color, background: method.color + '20', boxShadow: '0 2px 10px ' + method.color + '40' } : {}"
							@click="!selectionEnd && !shippingConfigReadonly && onClickShippingMethod(method.key)"
						>
							<span class="vdp-sm-check" v-if="localSelectedMethods.includes(method.key)" :style="{ color: method.color }">✓</span>
							<span class="vdp-sm-icon">{{ method.icon }}</span>
							<span class="vdp-sm-label">{{ method.label }}</span>
							<el-input-number
								v-model="method.days"
								:min="1"
								:max="365"
								size="small"
								controls-position="right"
								style="width: 65px"
								:disabled="!!selectionEnd || shippingConfigReadonly"
								@click.stop
								@change="onShippingConfigChange"
							/>
							<span class="vdp-sm-unit">天</span>
						</div>
						<div class="vdp-sm-buffer">
							<span class="vdp-sm-unit">缓冲</span>
							<el-input-number
								v-model="localBuffer"
								:min="0"
								:max="120"
								size="small"
								controls-position="right"
								style="width: 60px"
								:disabled="!!selectionEnd"
								@click.stop
								@change="onShippingConfigChange"
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

				<!-- 视图标题（仅库存断货模式） -->
				<div v-if="dailyAvgSales > 0 && computedMarkers.length > 0" class="vdp-view-toggle">
					<button class="vt-btn vt-active">📦 库存断货</button>
				</div>

				<div v-if="isDetailMode && detailEarliestMarker" class="vdp-min-date-tip">
					<span class="vdp-min-label">最早可选</span>
					<strong>{{ detailMinSelectableDate }}</strong>
					<span>{{ detailEarliestDescription }}</span>
				</div>

				<!-- 图例 -->
				<div class="vdp-legend">
					<!-- 库存状态图例 -->
					<template v-if="dailyAvgSales > 0">
						<span class="lg-item"><span class="lg-dot safe"></span>≥5天</span>
						<span class="lg-item"><span class="lg-dot warn"></span>&lt;5天</span>
						<span class="lg-item"><span class="lg-dot danger"></span>断货</span>
					</template>
					<!-- 运输方式图例（物流视图）：仅显示库存状态图例，不再重复显示运输按钮 -->
					<!-- 运输方式已在顶部选择器中展示，此处不再重复 -->
				</div>

				<!-- 单运输方式引导提示（等待用户选择结束日期） -->
				<div v-if="seaWaitingEnd && waitingMethodInfo" class="vdp-sea-guide">
					<span class="vdp-sea-pulse"></span>
					{{ waitingMethodInfo.icon }} {{ waitingMethodInfo.label }}到达日已选为开始日期，请在日历上点击选择结束日期
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
								:title="getDayTitle(day)"
							>
								<template v-if="day.isCurrentMonth">
									<span class="dn">{{ day.day }}</span>
									<span
										v-if="isDetailSelectionBoundary(day)"
										class="vdp-select-boundary"
										:class="getSelectionBoundaryClass(day)"
									>
										{{ getSelectionBoundaryText(day) }}
									</span>
									<el-tooltip
										v-if="isDetailSegmentBoundary(day)"
										:content="getSegmentBoundaryTitle(day)"
										placement="top"
										:show-after="100"
									>
										<span class="vdp-seg-marker" :class="getSegmentBoundaryClass(day)">
											{{ getSegmentBoundaryText(day) }}
										</span>
									</el-tooltip>
									<!-- 等待选择结束日期时的提示 -->
									<div v-if="seaWaitingEnd && day.dateStr === selectionStart" class="vdp-start-label">
										开始
									</div>
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
						<template v-if="selectionEnd">
							{{ selectionStart }}{{ selectionEnd !== selectionStart ? ' ~ ' + selectionEnd : '' }}
							<span class="sel-days">共 {{ dayjs(selectionEnd).diff(dayjs(selectionStart), 'day') + 1 }} 天</span>
						</template>
						<template v-else-if="seaWaitingEnd">
							<span v-if="waitingMethodInfo">{{ waitingMethodInfo.icon }} {{ waitingMethodInfo.label }}</span>
							到达日已选为开始日期，请点击选择结束日期
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
							:disabled="!selectionEnd"
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
	shippingMarkers: { type: Array as () => { key: string; label: string; arrivalDate: string; color: string; icon: string; days?: number }[], default: () => [] },
	showShippingSelector: { type: Boolean, default: false },
	shippingMethods: { type: Array as () => { key: string; label: string; days: number; color: string; icon: string }[], default: () => [] },
	shippingBuffer: { type: Number, default: 5 },
	selectedShippingMethods: { type: Array as () => string[], default: () => [] },
	shippingProfile: { type: String, default: "default" },
	shippingProfiles: { type: Array as () => { key: string; label: string }[], default: () => [] },
	shippingConfigReadonly: { type: Boolean, default: false },
	commitOnConfirmOnly: { type: Boolean, default: false },
	variant: { type: String, default: "default" },
	// 全局日期约束（用于明细级选择器，限制可选范围）
	globalStartDate: { type: String, default: '' },
	globalEndDate: { type: String, default: '' }
});

const emit = defineEmits(["update:modelValue", "change", "shipping-change", "shipping-profile-change"]);

const popoverRef = ref();
const loading = ref(false);
const dataLoaded = ref(false);

// 弹出层宽度：有运输选择器时加宽
const isDetailMode = computed(() => props.variant === "detail");
const popoverWidth = computed(() => props.showShippingSelector ? 760 : isDetailMode.value ? 760 : 560);
const popoverClass = computed(() => isDetailMode.value ? "vdp-popover vdp-popover-detail" : "vdp-popover");

// ====== 本地运输方式状态 ======
const localShippingMethods = reactive<{ key: string; label: string; days: number; color: string; icon: string }[]>([]);
const localBuffer = ref(5);
const localSelectedMethods = ref<string[]>([]);

// 初始化本地运输配置
watch(
	() => props.shippingMethods,
	(val) => {
		if (val && val.length > 0) {
			localShippingMethods.splice(0, localShippingMethods.length, ...val.map(m => ({ ...m })));
			// 默认按天数排序
			localShippingMethods.sort((a, b) => a.days - b.days);
		}
	},
	{ immediate: true, deep: true }
);
watch(() => props.shippingBuffer, (val) => { localBuffer.value = val; }, { immediate: true });
watch(() => props.selectedShippingMethods, (val) => { localSelectedMethods.value = [...(val || [])]; }, { immediate: true });

const viewMode = ref<'stock'>('stock');

// 计算运输标记（只为勾选的运输方式生成节点）
const computedMarkers = computed(() => {
	// 如果外部传了 shippingMarkers 直接用（产品级别）
	if (props.shippingMarkers && props.shippingMarkers.length > 0) {
		return props.shippingMarkers;
	}
	// 否则从本地运输状态计算（全局级别）
	if (localSelectedMethods.value.length === 0 || localShippingMethods.length === 0) return [];
	const today = dayjs().startOf('day');

	const markers: { key: string; label: string; arrivalDate: string; color: string; icon: string; days?: number }[] = [];
	for (let i = 0; i < localShippingMethods.length; i++) {
		const m = localShippingMethods[i];
		// 只有勾选的才计算到达日
		if (localSelectedMethods.value.includes(m.key)) {
			const arrival = today.add(m.days + localBuffer.value, 'day').format('YYYY-MM-DD');
			markers.push({ key: m.key, label: m.label, arrivalDate: arrival, color: m.color, icon: m.icon, days: m.days });
		}
	}

	// 按照到达日期从早到晚排序
	markers.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
	return markers;
});

const detailEarliestMarker = computed(() => {
	if (!isDetailMode.value) return null;
	const markers = computedMarkers.value
		.filter(m => !!m?.arrivalDate)
		.slice()
		.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
	return markers[0] || null;
});
const detailMinSelectableDate = computed(() => detailEarliestMarker.value?.arrivalDate || "");
const detailEarliestDescription = computed(() => {
	const marker = detailEarliestMarker.value;
	if (!marker) return "";
	const daysText = marker.days ? `${marker.label}${marker.days}天` : marker.label;
	const bufferText = props.shippingBuffer > 0 ? ` + 缓冲${props.shippingBuffer}天` : "";
	return `${marker.icon || ""} ${daysText}${bufferText}，之前不能作为补货周期`;
});

// 视图模式固定为库存断货
// (物流推导已移至全局配置，明细只保留库存视图)

// 点击运输方式按钮（Toggle）
const onClickShippingMethod = (methodKey: string) => {
	const idx = localSelectedMethods.value.indexOf(methodKey);
	if (idx > -1) {
		localSelectedMethods.value.splice(idx, 1);
	} else {
		localSelectedMethods.value.push(methodKey);
	}
	if (!props.commitOnConfirmOnly) {
		emitConfigChange();
	}
	checkAndEnterWaitMode();
};

const checkAndEnterWaitMode = () => {
	// 找到最后一个选中的方式（按天数排序后的最慢的），自动进入"等待结束日期"模式
	if (localSelectedMethods.value.length >= 1) {
		const sortedSelected = localSelectedMethods.value
			.map(key => localShippingMethods.find(m => m.key === key)!)
			.filter(Boolean)
			.sort((a, b) => a.days - b.days);
		const lastMethod = sortedSelected[sortedSelected.length - 1];

		if (lastMethod) {
			const arrivalDate = dayjs().startOf('day').add(lastMethod.days + localBuffer.value, 'day');
			selectionStart.value = arrivalDate.format('YYYY-MM-DD');
			selectionEnd.value = null;
			selectionColor.value = lastMethod.color;
			seaWaitingEnd.value = true;
			waitingMethodKey.value = lastMethod.key;
			// 自动导航日历到达日所在的月份
			const arrivalMonth = arrivalDate.startOf('month');
			const currentViewStart = dayjs().startOf('month').add(monthOffset.value, 'month');
			if (arrivalMonth.isBefore(currentViewStart) || arrivalMonth.isAfter(currentViewStart.add(1, 'month'))) {
				const diff = arrivalMonth.diff(dayjs().startOf('month'), 'month');
				monthOffset.value = Math.max(0, Math.min(6, diff));
			}
		}
	} else {
		seaWaitingEnd.value = false;
		waitingMethodKey.value = null;
		selectionStart.value = null;
		selectionEnd.value = null;
		selectionColor.value = null;
	}
};

// ====== 计算总体展示范围 ======
const formatCompactDate = (value: any) => {
	const parsed = dayjs(value);
	return parsed.isValid() ? parsed.format("M/D") : "-";
};

const displayDateRange = computed(() => {
	if (!props.modelValue || props.modelValue.length !== 2) return null;
	// 全局选择器（带运输方式面板）：起点为最快物流到达日
	// 明细级选择器（不带运输面板）：起点为用户自选的日期
	let start: string;
	if (props.showShippingSelector && computedMarkers.value.length > 0) {
		start = computedMarkers.value[0].arrivalDate;
	} else {
		start = props.modelValue[0] as string;
	}
	const end = props.modelValue[1];
	const days = dayjs(end).diff(dayjs(start), 'day') + 1;
	return {
		start: formatCompactDate(start),
		end: formatCompactDate(end),
		fullStart: start,
		fullEnd: end,
		days
	};
});

const onShippingConfigChange = () => {
	// 动态按天数排序
	localShippingMethods.sort((a, b) => a.days - b.days);
	if (!props.commitOnConfirmOnly) {
		emitConfigChange();
	}
	// 如果还在等待模式中（修改了天数会导致区间变动），重新计算等待逻辑
	if (!selectionEnd.value && localSelectedMethods.value.length > 0) {
		checkAndEnterWaitMode();
	}
};

const emitConfigChange = () => {
	emit("shipping-change", {
		methods: localSelectedMethods.value,
		configs: localShippingMethods.map(m => ({ key: m.key, label: m.label, days: m.days })),
		buffer: localBuffer.value,
		dateRange: [selectionStart.value, selectionEnd.value]
	});
};

const onProfileChange = (profileKey: string | number | boolean) => {
	selectionStart.value = null;
	selectionEnd.value = null;
	selectionColor.value = null;
	seaWaitingEnd.value = false;
	waitingMethodKey.value = null;
	emit("shipping-profile-change", String(profileKey));
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
const seaWaitingEnd = ref(false); // 等待用户选结束日期
const waitingMethodKey = ref<string | null>(null); // 当前等待结束日期的运输方式 key

// 正在等待结束日期的运输方式信息（用于 UI 提示文字）
const waitingMethodInfo = computed(() => {
	if (!waitingMethodKey.value) return null;
	return localShippingMethods.find(m => m.key === waitingMethodKey.value) || null;
});

watch(
	() => [props.shippingProfile, props.shippingMethods, props.selectedShippingMethods, props.shippingBuffer],
	() => {
		if (!props.showShippingSelector || selectionEnd.value) return;
		checkAndEnterWaitMode();
	},
	{ deep: true }
);

const syncSelectionFromModelValue = () => {
	const val = props.modelValue;
	if (val && val.length === 2 && val[0] && val[1]) {
		selectionStart.value = val[0] as string;
		selectionEnd.value = val[1] as string;
		seaWaitingEnd.value = false;
		waitingMethodKey.value = null;
		return;
	}

	if (!val || val.length === 0) {
		// 值被清空时，重置所有选择状态
		selectionStart.value = null;
		selectionEnd.value = null;
		selectionColor.value = null;
		seaWaitingEnd.value = false;
		waitingMethodKey.value = null;
	}
};

watch(() => props.modelValue, syncSelectionFromModelValue, { immediate: true, deep: true });

const isDayDisabled = (day: DayData): boolean => {
	if (!day.isCurrentMonth || day.isPast) return true;
	if (isDetailMode.value && detailMinSelectableDate.value && day.dateStr < detailMinSelectableDate.value) return true;
	// 明细选择器允许单行独立改周期，不跟随全局周期截断可选日期。
	if (!isDetailMode.value) {
		if (props.globalStartDate && day.dateStr < props.globalStartDate) return true;
		if (props.globalEndDate && day.dateStr > props.globalEndDate) return true;
	}
	return false;
};

const handleDayClick = (day: DayData) => {
	if (isDayDisabled(day)) return;

	// ======= 物流计算模式（全局选择器用） =======
	if (localSelectedMethods.value.length > 0) {
		if (!selectionStart.value) return;
		if (day.dateStr < selectionStart.value) {
			selectionEnd.value = selectionStart.value;
		} else {
			selectionEnd.value = day.dateStr;
		}
		seaWaitingEnd.value = false;
		return;
	}

	// ======= 自由选择模式（明细级选择器用） =======
	if (!selectionStart.value || (selectionEnd.value && !seaWaitingEnd.value)) {
		selectionStart.value = day.dateStr;
		selectionEnd.value = null;
		selectionColor.value = null;
		seaWaitingEnd.value = false;
	} else {
		if (day.dateStr < selectionStart.value) {
			selectionEnd.value = selectionStart.value;
			selectionStart.value = day.dateStr;
		} else {
			selectionEnd.value = day.dateStr;
		}
		seaWaitingEnd.value = false;
	}
};

const confirmSelection = () => {
	if (selectionStart.value && selectionEnd.value) {
		const range = [selectionStart.value, selectionEnd.value];
		if (props.commitOnConfirmOnly) {
			emitConfigChange();
		}
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
	// 不清除 localSelectedMethods，保留运输色带显示
	if (!props.commitOnConfirmOnly) {
		emit("update:modelValue", null);
		emit("change", null);
	}

	// 如果有勾选的运输方式，清空后应该重新进入等待最后一种方式结束日期的模式
	if (localSelectedMethods.value.length > 0) {
		checkAndEnterWaitMode();
	}
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
	syncSelectionFromModelValue();
	if (!dataLoaded.value && props.productCode) loadData();

	// 每次打开时，如果有配置运输方式且没有已确认的结束日，重新进入等待模式
	if (localSelectedMethods.value.length > 0 && !selectionEnd.value) {
		checkAndEnterWaitMode();
	}

	// 导航到已选开始日期的月份
	if (selectionStart.value) {
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
	segInfo?: { isStart: boolean; isEnd: boolean; isSingleDay: boolean; isLastSeg: boolean; color: string; tooltip: string; label: string; startDate: string; endDate: string | null };
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
			shippingLabel: szInfo.label,
			segInfo: szInfo.segInfo || undefined
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
	// 库存状态
	if (day.stockStatus !== "none") c.push(`s-${day.stockStatus}`);
	if (day.shipments.length > 0) c.push("has-ship");
	if (day.promotions.length > 0) c.push("has-promo");
	if (isInRange(day.dateStr)) c.push("in-range");
	if (isDetailMode.value && day.dateStr === selectionStart.value) c.push("sel-start");
	if (isDetailMode.value && selectionEnd.value && day.dateStr === selectionEnd.value) c.push("sel-end");
	if (isDetailMode.value && selectionStart.value && selectionEnd.value && selectionStart.value === selectionEnd.value && day.dateStr === selectionStart.value) c.push("sel-single");
	if (isDetailMode.value && detailMinSelectableDate.value && day.isCurrentMonth && !day.isPast && day.dateStr < detailMinSelectableDate.value) c.push("before-earliest");

	// 全局日期约束：超出范围的日期标记为不可选
	if (day.isCurrentMonth && !day.isPast && isDayDisabled(day) && !isInRange(day.dateStr)) c.push("out-of-range");

	// 正在等待选择结束日期
	if (seaWaitingEnd.value && day.dateStr === selectionStart.value) {
		c.push("pulse-target");
	}

	return c;
};

// 计算不重叠的运输段（每段有 key, startDate, endDate, color, label, icon）
const computedSegments = computed(() => {
	const markers = computedMarkers.value;
	if (!markers || markers.length === 0) return [];

	const segs: { key: string; startDate: string; endDate: string | null; color: string; label: string; icon: string; days: number }[] = [];

	for (let i = 0; i < markers.length; i++) {
		const current = markers[i];
		const next = markers[i + 1];
		const startDate = current.arrivalDate;

		if (next) {
			const endDate = dayjs(next.arrivalDate).subtract(1, 'day').format('YYYY-MM-DD');
			// 跳过 0 天段（两个方式同速到达）
			if (endDate < startDate) continue;
			const d = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
			segs.push({ key: current.key, startDate, endDate, color: current.color, label: current.label, icon: current.icon, days: d });
		} else {
			// 最后一个：结束日由用户选择（或已选中）
			const endDate = selectionEnd.value && selectionEnd.value >= startDate ? selectionEnd.value : null;
			const d = endDate ? dayjs(endDate).diff(dayjs(startDate), 'day') + 1 : 0;
			segs.push({ key: current.key, startDate, endDate, color: current.color, label: current.label, icon: current.icon, days: d });
		}
	}
	return segs;
});

// 运输方式区间判断（返回丰富的段信息）
const getShippingZone = (dateStr: string): { zone: string | null; label: string; segInfo?: any } => {
	const segs = computedSegments.value;
	if (!segs || segs.length === 0) return { zone: null, label: '' };

	for (let i = 0; i < segs.length; i++) {
		const seg = segs[i];
		const inSeg = seg.endDate
			? (dateStr >= seg.startDate && dateStr <= seg.endDate)
			: (dateStr === seg.startDate); // 最后一段未选结束日时只匹配开始日

		if (!inSeg) continue;

		const isStart = dateStr === seg.startDate;
		const isEnd = seg.endDate ? dateStr === seg.endDate : false;
		const isSingleDay = isStart && isEnd;
		const isLastSeg = i === segs.length - 1;

		// Tooltip
		let tooltip: string;
		const range = seg.endDate ? `${seg.startDate} ~ ${seg.endDate} (${seg.days}天)` : `${seg.startDate} ~ 待选择`;
		if (isStart) {
			tooltip = `${seg.label}到达 · ${range}`;
			if (isLastSeg && !seg.endDate) {
				tooltip = `${seg.label}到达 · 请选择结束日期`;
			}
		} else if (isEnd) {
			tooltip = `${seg.label}段结束 · ${range}`;
		} else {
			tooltip = `${seg.label}段 · ${range}`;
		}

		return {
			zone: seg.key,
			label: isStart ? `${seg.label}到达` : '',
			segInfo: { isStart, isEnd, isSingleDay, isLastSeg, color: seg.color, tooltip, label: seg.label, startDate: seg.startDate, endDate: seg.endDate }
		};
	}

	return { zone: null, label: '' };
};

// 运输方式单元格样式
const getShippingCellStyle = (day: DayData) => {
	const inRange = isInRange(day.dateStr);

	if (isDetailMode.value) {
		if (inRange && day.isCurrentMonth) {
			return {
				borderColor: '#60a5fa',
				borderWidth: '1px',
				boxShadow: 'inset 0 0 0 1px rgba(37, 99, 235, 0.35)',
			};
		}
		return {};
	}

	// 用户手动选中的区间（优先级最高）
	if (inRange && day.isCurrentMonth) {
		const color = selectionColor.value || '#7c5cfc';
		return {
			background: color + '88',
			borderColor: color,
			borderWidth: '1.5px',
			color: '#fff',
		};
	}

	// 运输段色带（深色高亮，像选中状态）
	if (!day.segInfo || !day.isCurrentMonth) return {};
	const segColor = day.segInfo.color;

	return {
		background: segColor + '80',
		borderColor: segColor,
		borderWidth: '1.5px',
		color: '#fff',
	};
};

const isDetailSelectionBoundary = (day: DayData) => {
	if (!isDetailMode.value || !day.isCurrentMonth) return false;
	return day.dateStr === selectionStart.value || (!!selectionEnd.value && day.dateStr === selectionEnd.value);
};

const getSelectionBoundaryText = (day: DayData) => {
	const isStart = day.dateStr === selectionStart.value;
	const isEnd = !!selectionEnd.value && day.dateStr === selectionEnd.value;
	if (isStart && isEnd) return "单";
	return isStart ? "始" : "终";
};

const getSelectionBoundaryClass = (day: DayData) => {
	const isStart = day.dateStr === selectionStart.value;
	const isEnd = !!selectionEnd.value && day.dateStr === selectionEnd.value;
	if (isStart && isEnd) return "is-both";
	return isStart ? "is-start" : "is-end";
};

const isDetailSegmentBoundary = (day: DayData) => {
	if (!isDetailMode.value || !day.segInfo || !day.isCurrentMonth) return false;
	return day.segInfo.isStart || day.segInfo.isEnd;
};

const getSegmentBoundaryText = (day: DayData) => {
	if (!day.segInfo) return "";
	const prefix = getShortSegmentLabel(day.segInfo.label);
	if (day.segInfo.isStart && day.segInfo.isEnd) return `${prefix}起止`;
	return `${prefix}${day.segInfo.isStart ? "始" : "终"}`;
};

const getSegmentBoundaryClass = (day: DayData) => {
	if (!day.segInfo) return "";
	if (day.segInfo.isStart && day.segInfo.isEnd) return "is-both";
	return day.segInfo.isStart ? "is-start" : "is-end";
};

const getSegmentBoundaryTitle = (day: DayData) => {
	const seg = day.segInfo;
	if (!seg) return "";
	const days = seg.endDate ? dayjs(seg.endDate).diff(dayjs(seg.startDate), 'day') + 1 : 0;
	const range = seg.endDate ? `${seg.startDate} ~ ${seg.endDate}（${days}天）` : `${seg.startDate} ~ 待选择`;
	if (seg.isStart && seg.isEnd) return `${seg.label}开始/结束 · ${range}`;
	return `${seg.label}${seg.isStart ? "开始" : "结束"} · ${range}`;
};

const getShortSegmentLabel = (label: string) => {
	const text = String(label || "").trim();
	return text ? text.slice(0, 1) : "运";
};

const getDayTitle = (day: DayData) => {
	if (isDetailMode.value) {
		if (detailMinSelectableDate.value && day.isCurrentMonth && !day.isPast && day.dateStr < detailMinSelectableDate.value) {
			return `最早可选 ${detailMinSelectableDate.value}；${detailEarliestDescription.value}`;
		}
		return isDetailSegmentBoundary(day) ? getSegmentBoundaryTitle(day) : day.shippingLabel || "";
	}
	return day.segInfo?.tooltip || day.shippingLabel || "";
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
	box-sizing: border-box;
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
	display: flex;
	align-items: center;
	gap: 4px;
	flex: 1;
	min-width: 0;
	color: #303133;
	font-size: 12px;
	white-space: nowrap;
}
.trigger-range {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.trigger-days {
	flex-shrink: 0;
	padding: 0 4px;
	border-radius: 8px;
	background: #ecf5ff;
	color: #409eff;
	font-size: 10px;
	line-height: 16px;
}
.trigger-placeholder {
	flex: 1;
	min-width: 0;
	color: #c0c4cc;
	font-size: 12px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.trigger-clear {
	font-size: 14px;
	color: #c0c4cc;
	flex-shrink: 0;
	margin-left: 0;
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

.vdp-profile-selector {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 8px;
}

.vdp-profile-label {
	font-size: 12px;
	font-weight: 600;
	color: #606266;
}

.vdp-profile-note {
	font-size: 11px;
	color: #67c23a;
	background: #f0f9eb;
	border: 1px solid #d1edc4;
	border-radius: 4px;
	padding: 2px 6px;
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
.vdp-sm-btn.inactive {
	opacity: 0.45;
	filter: grayscale(80%);
	border-color: #e4e7ed !important;
	background: #fafafa !important;
	box-shadow: none !important;
}
.vdp-sm-btn.inactive:hover {
	opacity: 0.7;
	filter: grayscale(40%);
}
.vdp-sm-check {
	font-size: 13px;
	font-weight: 900;
	margin-right: 2px;
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

.vdp-min-date-tip {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	margin: -1px 0 6px;
	padding: 5px 10px;
	border: 1px solid #dbeafe;
	border-radius: 6px;
	background: #f8fbff;
	color: #606266;
	font-size: 12px;
	line-height: 1.3;
}
.vdp-min-date-tip strong {
	color: #2563eb;
	font-weight: 700;
}
.vdp-min-label {
	display: inline-flex;
	align-items: center;
	height: 18px;
	padding: 0 6px;
	border-radius: 9px;
	background: #eaf3ff;
	color: #2563eb;
	font-size: 11px;
	font-weight: 700;
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
.vdp-content-detail .dc.in-range:not(.empty):not(.past) {
	background-clip: padding-box;
}
.vdp-content-detail .dc.sel-start:not(.empty):not(.past),
.vdp-content-detail .dc.sel-end:not(.empty):not(.past) {
	border-color: #2563eb;
}
.vdp-content-detail .vdp-grid {
	gap: 28px;
	justify-content: center;
}
.vdp-content-detail .vdp-month {
	flex: 0 0 auto;
	width: 320px;
}
.vdp-content-detail .wk-header {
	gap: 5px;
	margin-bottom: 6px;
	font-size: 12px;
}
.vdp-content-detail .day-grid {
	grid-template-columns: repeat(7, 40px);
	gap: 5px;
	justify-content: center;
}
.vdp-content-detail .dc {
	width: 40px;
	height: 40px;
	border-radius: 6px;
	padding-top: 6px;
	overflow: visible;
}
.vdp-content-detail .dc:hover:not(.empty):not(.past) {
	transform: translateY(-1px);
	box-shadow: inset 0 0 0 1px #2563eb, 0 6px 14px rgba(37, 99, 235, 0.14);
}
.vdp-content-detail .dc.in-range:not(.empty):not(.past)::after {
	content: "";
	position: absolute;
	inset: -1px;
	border: 1px solid rgba(37, 99, 235, 0.28);
	border-radius: 7px;
	pointer-events: none;
	z-index: 1;
}
.vdp-content-detail .dc.sel-start:not(.empty):not(.past)::after,
.vdp-content-detail .dc.sel-end:not(.empty):not(.past)::after {
	inset: -2px;
	border: 2px solid #2563eb;
	box-shadow: 0 4px 10px rgba(37, 99, 235, 0.16);
}
.vdp-content-detail .dc.sel-single:not(.empty):not(.past)::after {
	border-color: #2563eb;
	box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
}
.vdp-content-detail .dc.before-earliest:not(.empty):not(.past) {
	position: relative;
	filter: saturate(0.72);
	opacity: 0.78;
}
.vdp-content-detail .dc.before-earliest:not(.empty):not(.past)::before {
	content: "";
	position: absolute;
	inset: 0;
	border-radius: 6px;
	background: repeating-linear-gradient(
		45deg,
		rgba(255, 255, 255, 0),
		rgba(255, 255, 255, 0) 6px,
		rgba(255, 255, 255, 0.42) 6px,
		rgba(255, 255, 255, 0.42) 12px
	);
	pointer-events: none;
	z-index: 1;
}
.vdp-content-detail .dc.before-earliest:not(.empty):not(.past)::after {
	content: "";
	position: absolute;
	inset: 0;
	border-radius: 6px;
	border: 1px dashed rgba(100, 116, 139, 0.42);
	pointer-events: none;
	z-index: 2;
}
.vdp-content-detail .dc.before-earliest:not(.empty):not(.past):hover {
	transform: none;
	box-shadow: inset 0 0 0 1px rgba(100, 116, 139, 0.35);
}
.vdp-content-detail .dc.before-earliest .dn,
.vdp-content-detail .dc.before-earliest .di,
.vdp-content-detail .dc.before-earliest .vdp-seg-marker {
	z-index: 3;
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

.vdp-select-boundary {
	position: absolute;
	top: 3px;
	right: 3px;
	min-width: 15px;
	height: 15px;
	padding: 0 4px;
	border-radius: 5px;
	box-sizing: border-box;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 9px;
	line-height: 1;
	font-weight: 700;
	color: #fff;
	background: #2563eb;
	border: 1px solid #fff;
	box-shadow: 0 1px 4px rgba(37, 99, 235, 0.35);
	z-index: 6;
	pointer-events: none;
}
.vdp-select-boundary.is-end {
	background: #f59e0b;
	box-shadow: 0 1px 4px rgba(245, 158, 11, 0.35);
}
.vdp-select-boundary.is-both {
	min-width: 15px;
	background: #2563eb;
	box-shadow: 0 1px 4px rgba(37, 99, 235, 0.35);
}

.vdp-seg-marker {
	position: absolute;
	right: 3px;
	bottom: 3px;
	min-width: 21px;
	height: 14px;
	padding: 0 3px;
	border-radius: 4px;
	box-sizing: border-box;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 9px;
	line-height: 1;
	font-weight: 700;
	background: #fff;
	color: #2563eb;
	border: 1px solid #93c5fd;
	box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
	z-index: 3;
	cursor: help;
}
.vdp-seg-marker.is-end {
	color: #c2410c;
	border-color: #fdba74;
	background: #fff7ed;
}
.vdp-seg-marker.is-both {
	min-width: 24px;
	color: #7c3aed;
	border-color: #c4b5fd;
	background: #f5f3ff;
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
.vdp-content-detail .di {
	left: 3px;
	bottom: 3px;
	transform: none;
	width: auto;
	justify-content: flex-start;
	z-index: 3;
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
.trigger-days {
	display: inline-block;
	background: #ecf5ff;
	color: #409eff;
	font-size: 11px;
	padding: 1px 6px;
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

.vdp-sm-btn.is-disabled {
	opacity: 0.8;
	cursor: not-allowed;
}
.vdp-sm-btn.is-disabled:hover {
	transform: none;
}
.vdp-sm-btn.is-readonly {
	cursor: default;
}

/* === 闪烁动画：提示用户选择结束日期的起点格子 === */
.pulse-target {
	animation: pulse-border 1.5s infinite;
	z-index: 2 !important;
	position: relative;
}
@keyframes pulse-border {
	0% { box-shadow: 0 0 0 0px var(--el-color-primary, rgba(64, 158, 255, 0.7)); }
	70% { box-shadow: 0 0 0 6px rgba(64, 158, 255, 0); }
	100% { box-shadow: 0 0 0 0px rgba(64, 158, 255, 0); }
}

/* === 起点“开始”悬浮气泡 === */
.vdp-start-label {
	position: absolute;
	top: -24px;
	left: 50%;
	transform: translateX(-50%);
	background: #409eff;
	color: #fff;
	font-size: 11px;
	padding: 2px 8px;
	border-radius: 4px;
	white-space: nowrap;
	z-index: 10;
	box-shadow: 0 2px 6px rgba(64,158,255,0.4);
	pointer-events: none;
	animation: pop-in 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
.vdp-start-label::after {
	content: '';
	position: absolute;
	bottom: -4px;
	left: 50%;
	transform: translateX(-50%);
	border-left: 4px solid transparent;
	border-right: 4px solid transparent;
	border-top: 4px solid #409eff;
}
@keyframes pop-in {
	from { opacity: 0; transform: translate(-50%, 10px) scale(0.8); }
	to { opacity: 1; transform: translate(-50%, 0) scale(1); }
}

.dc.out-of-range {
	opacity: 0.46;
	cursor: not-allowed;
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
