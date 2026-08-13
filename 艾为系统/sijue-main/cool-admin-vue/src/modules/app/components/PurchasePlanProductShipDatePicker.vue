<template>
	<div class="ship-date-picker">
		<section class="picker-section period-section">
			<div class="picker-section-head">
				<span class="picker-section-title">目标周期</span>
				<span class="period-chip">共 {{ periodDays }} 天</span>
			</div>
			<div class="period-main">
				<div class="period-days-control">
					<el-input-number
						:model-value="targetDays"
						:min="1"
						:max="180"
						:step="1"
						size="small"
						controls-position="right"
						class="target-days-input"
						:disabled="disabled"
						@change="handleTargetDaysChange"
					/>
					<span class="picker-muted">天</span>
				</div>
				<div class="period-range">{{ startDateText }} → {{ endDateShortText }}</div>
			</div>
			<div class="period-mode-row">
				<span class="picker-label">应用</span>
				<div class="target-mode-switch">
					<button
						type="button"
						class="target-mode-option"
						:class="{ 'is-active': targetMode === 'product' }"
						:disabled="disabled"
						@click="emit('target-mode-change', 'product')"
					>
						产品目标
					</button>
					<button
						type="button"
						class="target-mode-option"
						:class="{ 'is-active': targetMode === 'global' }"
						:disabled="disabled"
						@click="emit('target-mode-change', 'global')"
					>
						统一周期
					</button>
				</div>
			</div>
			<div class="period-sub">
				<div class="mini-control">
					<span class="picker-label">缓冲</span>
					<el-input-number
						:model-value="shippingBuffer"
						:min="0"
						:max="30"
						:step="1"
						size="small"
						controls-position="right"
						class="buffer-input"
						:disabled="disabled"
						@change="(value) => emit('update:shippingBuffer', normalizePositive(value, 0))"
					/>
					<span class="picker-muted">天</span>
				</div>
			</div>
		</section>

		<section class="picker-section methods-section">
			<div class="picker-section-head">
				<span class="picker-section-title">运输配置</span>
				<span class="picker-section-hint">已选 {{ selectedMethods.length }}/{{ shippingMethods.length }}</span>
			</div>
			<div class="profile-row">
				<div class="profile-switch">
					<button
						v-for="profile in shippingProfiles"
						:key="profile.key"
						type="button"
						class="profile-option"
						:class="{ 'is-active': profile.key === shippingProfile }"
						:disabled="disabled"
						@click="emit('shipping-profile-change', profile.key)"
					>
						{{ profile.label }}
					</button>
				</div>
				<el-tooltip
					placement="bottom"
					effect="light"
					popper-class="shipping-profile-tooltip"
					:disabled="shippingProfiles.length === 0"
				>
					<template #content>
						<div class="profile-tooltip-panel">
							<div class="profile-tooltip-title">运输配置对照</div>
							<div class="profile-tooltip-table">
								<div class="profile-tooltip-row is-header">
									<span>配置</span>
									<span v-for="method in profileMethodColumns" :key="method.key">{{ method.label }}</span>
								</div>
								<div
									v-for="profile in shippingProfiles"
									:key="profile.key"
									class="profile-tooltip-row"
									:class="{ 'is-current': profile.key === shippingProfile }"
								>
									<strong>{{ profile.label }}</strong>
									<span v-for="method in profileMethodColumns" :key="`${profile.key}-${method.key}`">
										{{ formatProfileMethodDays(profile, method.key) }}
									</span>
								</div>
							</div>
						</div>
					</template>
					<span class="profile-lock">
						{{ shippingConfigReadonly ? "预设天数已锁定" : "默认天数可编辑" }}
					</span>
				</el-tooltip>
			</div>
			<div class="profile-summary">
				<span>当前：{{ currentProfile?.label || "-" }}</span>
				<strong>{{ currentProfileSummary }}</strong>
			</div>
			<div class="method-config-grid">
				<div
					v-for="method in shippingMethods"
					:key="method.key"
					class="method-config-item"
					:class="{
						'is-checked': selectedMethodSet.has(method.key),
						'is-disabled': disabled
					}"
				>
					<button
						type="button"
						class="method-check"
						:class="{ 'is-hidden': !selectedMethodSet.has(method.key) }"
						:disabled="disabled"
						@click.stop="toggleMethod(method.key)"
					>
						✓
					</button>
					<div class="method-chip-content">
						<span class="method-chip-icon">{{ method.icon }}</span>
						<span class="method-chip-label">{{ method.label }}</span>
						<el-input-number
							v-if="canEditMethodDays"
							:model-value="method.days"
							:min="1"
							:max="180"
							:step="1"
							size="small"
							controls-position="right"
							class="method-days-input"
							@click.stop
							@mousedown.stop
							@keydown.stop
							@change="(value) => handleMethodDaysChange(method.key, value)"
						/>
						<em v-else>{{ method.days }}天</em>
					</div>
				</div>
			</div>
		</section>
	</div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import dayjs from "dayjs";

type ShippingMethod = {
	key: string;
	label: string;
	days: number;
	color: string;
	icon: string;
};

type ShippingProfileMethod = {
	key: string;
	label: string;
	icon?: string;
	days: number;
	enabled: boolean;
};

type ShippingProfileOption = {
	key: string;
	label: string;
	readonly?: boolean;
	methods: ShippingProfileMethod[];
};

type TargetPeriodMode = "product" | "global";

const props = withDefaults(
	defineProps<{
		targetDays: number;
		shippingBuffer: number;
		shippingMethods: ShippingMethod[];
		selectedMethods: string[];
		targetMode?: TargetPeriodMode;
		shippingProfile?: string;
		shippingProfiles?: ShippingProfileOption[];
		shippingConfigReadonly?: boolean;
		disabled?: boolean;
	}>(),
	{
		targetMode: "product",
		shippingProfile: "default",
		shippingProfiles: () => [],
		shippingConfigReadonly: false,
		disabled: false
	}
);

const emit = defineEmits<{
	"update:targetDays": [value: number];
	"update:shippingBuffer": [value: number];
	"target-mode-change": [value: TargetPeriodMode];
	"shipping-change": [value: string[]];
	"shipping-profile-change": [value: string];
	"shipping-method-days-change": [value: { key: string; days: number }];
}>();

const periodDays = computed(() => normalizePositive(props.targetDays, 75));

const startDateText = computed(() => dayjs().startOf("day").format("M/D"));

const endDateValue = computed(() => {
	const start = dayjs().startOf("day");
	return start.add(periodDays.value - 1, "day").format("YYYY-MM-DD");
});

const endDateShortText = computed(() => dayjs(endDateValue.value).format("M/D"));

const selectedMethodSet = computed(() => new Set(props.selectedMethods));

const canEditMethodDays = computed(() => !props.disabled && !props.shippingConfigReadonly);

const currentProfile = computed(() => {
	return props.shippingProfiles.find((profile) => profile.key === props.shippingProfile) || props.shippingProfiles[0] || null;
});

const currentProfileSummary = computed(() => {
	const methods = currentProfile.value?.methods.filter((method) => method.enabled) || props.shippingMethods;
	return methods.map((method) => `${method.label}${method.days}`).join(" · ") || "-";
});

const profileMethodColumns = computed(() => {
	const seen = new Set<string>();
	return props.shippingProfiles.flatMap((profile) => profile.methods).filter((method) => {
		if (seen.has(method.key)) return false;
		seen.add(method.key);
		return true;
	});
});

function normalizePositive(value: any, fallback: number) {
	const num = Number(value);
	return Number.isFinite(num) && num >= 1 ? Math.round(num) : fallback;
}

function handleTargetDaysChange(value: any) {
	emit("target-mode-change", "global");
	emit("update:targetDays", normalizePositive(value, 75));
}

function normalizeMethods(value: any) {
	return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function toggleMethod(methodKey: string) {
	if (props.disabled) return;
	const current = new Set(props.selectedMethods);
	if (current.has(methodKey)) {
		if (current.size <= 1) return;
		current.delete(methodKey);
	} else {
		current.add(methodKey);
	}
	emit("shipping-change", normalizeMethods(Array.from(current)));
}

function normalizeMethodDays(value: any, fallback: number) {
	const num = Number(value);
	return Number.isFinite(num) && num >= 1 ? Math.min(180, Math.round(num)) : fallback;
}

function handleMethodDaysChange(methodKey: string, value: any) {
	if (!canEditMethodDays.value) return;
	const method = props.shippingMethods.find((item) => item.key === methodKey);
	emit("shipping-method-days-change", {
		key: methodKey,
		days: normalizeMethodDays(value, method?.days || 1)
	});
}

function formatProfileMethodDays(profile: ShippingProfileOption, methodKey: string) {
	const method = profile.methods.find((item) => item.key === methodKey);
	if (!method || !method.enabled) return "-";
	return `${method.days}`;
}
</script>

<style lang="scss" scoped>
.ship-date-picker {
	display: grid;
	grid-template-columns: minmax(360px, 0.9fr) minmax(420px, 1.1fr);
	align-items: stretch;
	gap: 0;
	width: 100%;
	min-width: 0;
	padding: 0;
	box-sizing: border-box;
	overflow: visible;
	border: 0;
	border-radius: 0;
	background: transparent;
}

.picker-section {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 1px;
	min-width: 0;
	min-height: 82px;
	padding: 2px 8px;
	border-right: 1px solid #dce8f6;
}

.picker-section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-width: 0;
}

.picker-section-title {
	color: var(--el-text-color-primary);
	font-size: 13px;
	font-weight: 800;
	white-space: nowrap;
}

.picker-section-hint {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	white-space: nowrap;
}

.period-main {
	display: grid;
	grid-template-columns: auto minmax(112px, 1fr);
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.period-days-control,
.mini-control {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.period-range {
	min-width: 0;
	padding: 2px 8px;
	overflow: hidden;
	border: 1px solid #d9ecff;
	border-radius: 6px;
	background: #f8fbff;
	color: #1677ff;
	font-size: 13px;
	font-weight: 700;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.period-sub {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 3px 8px;
	min-width: 0;
}

.period-mode-row {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.target-mode-switch {
	display: inline-flex;
	align-items: center;
	min-width: 0;
	padding: 1px;
	border: 1px solid #d8e4f6;
	border-radius: 7px;
	background: #fff;
}

.target-mode-option {
	height: 19px;
	padding: 0 8px;
	border: 0;
	border-radius: 5px;
	background: transparent;
	color: var(--el-text-color-regular);
	font-size: 12px;
	font-weight: 700;
	cursor: pointer;
	white-space: nowrap;
	transition:
		background 0.15s ease,
		color 0.15s ease;
}

.target-mode-option:hover:not(:disabled) {
	background: #ecf5ff;
	color: #1677ff;
}

.target-mode-option.is-active {
	background: #1677ff;
	color: #fff;
}

.target-mode-option:disabled {
	cursor: not-allowed;
	opacity: 0.62;
}

.profile-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.profile-switch {
	display: inline-flex;
	align-items: center;
	min-width: 0;
	padding: 1px;
	border: 1px solid #cfe3ff;
	border-radius: 7px;
	background: #f8fbff;
}

.profile-option {
	min-width: 46px;
	height: 19px;
	padding: 0 8px;
	border: 0;
	border-radius: 5px;
	background: transparent;
	color: var(--el-text-color-regular);
	font-size: 12px;
	font-weight: 700;
	cursor: pointer;
	transition:
		background 0.15s ease,
		color 0.15s ease,
		box-shadow 0.15s ease;
}

.profile-option:hover:not(:disabled) {
	background: #ecf5ff;
	color: #1677ff;
}

.profile-option.is-active {
	background: #1677ff;
	color: #fff;
	box-shadow: 0 1px 4px rgba(22, 119, 255, 0.22);
}

.profile-option:disabled {
	cursor: not-allowed;
	opacity: 0.62;
}

.profile-lock {
	display: inline-flex;
	align-items: center;
	height: 19px;
	padding: 0 7px;
	border: 1px solid #c6e2ff;
	border-radius: 999px;
	background: #f5faff;
	color: #1677ff;
	font-size: 12px;
	font-weight: 700;
	white-space: nowrap;
	cursor: help;
}

.profile-summary {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	min-height: 17px;
	padding: 0 7px;
	border: 1px dashed #d9ecff;
	border-radius: 6px;
	background: #fff;
	color: var(--el-text-color-secondary);
	font-size: 10.5px;
	line-height: 1.2;
}

.profile-summary span {
	flex: 0 0 auto;
	font-weight: 700;
}

.profile-summary strong {
	min-width: 0;
	overflow: hidden;
	color: var(--el-text-color-regular);
	font-weight: 700;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.picker-label {
	flex: 0 0 auto;
	color: var(--el-text-color-regular);
	font-size: 12px;
	font-weight: 700;
	white-space: nowrap;
}

.picker-muted {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	white-space: nowrap;
}

.period-chip {
	display: inline-flex;
	align-items: center;
	height: 17px;
	padding: 0 7px;
	border: 1px solid #d9ecff;
	border-radius: 999px;
	background: #f5faff;
	color: #409eff;
	font-size: 11px;
	font-weight: 700;
	white-space: nowrap;
}

.target-days-input {
	width: 106px;
}

.buffer-input {
	width: 92px;
}

.method-config-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(92px, 1fr));
	gap: 3px;
	min-width: 0;
	max-width: 100%;
	overflow: visible;
}

.method-config-item {
	display: grid;
	grid-template-columns: 16px minmax(0, 1fr);
	align-items: center;
	gap: 3px;
	min-width: 0;
	min-height: 21px;
	padding: 1px 7px;
	overflow: hidden;
	border: 1px solid #d8e4f6;
	border-radius: 6px;
	background: #fff;
	color: var(--el-text-color-regular);
	transition:
		border-color 0.15s ease,
		background 0.15s ease,
		box-shadow 0.15s ease;
}

.method-config-item.is-checked {
	border-color: #409eff;
	background: linear-gradient(180deg, #f2f8ff 0%, #e9f3ff 100%);
	box-shadow:
		inset 0 0 0 1px rgba(64, 158, 255, 0.38),
		0 1px 4px rgba(64, 158, 255, 0.12);
	color: #1677ff;
}

.method-config-item.is-disabled {
	background: #f5f7fa;
	color: var(--el-text-color-placeholder);
}

.method-chip-content {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) minmax(44px, auto);
	align-items: center;
	gap: 3px;
	width: 100%;
	min-width: 0;
	font-size: 11px;
	font-weight: 700;
	line-height: 1.1;
}

.method-check {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 14px;
	height: 14px;
	padding: 0;
	border: 0;
	border-radius: 50%;
	background: #1677ff;
	color: #fff;
	font-size: 11px;
	font-weight: 900;
	line-height: 1;
	cursor: pointer;
}

.method-check.is-hidden {
	opacity: 0;
	background: #dcdfe6;
	color: #fff;
}

.method-check:disabled {
	cursor: not-allowed;
	opacity: 0.55;
}

.method-chip-icon,
.method-chip-content em {
	flex: 0 0 auto;
	font-style: normal;
}

.method-chip-content em {
	color: inherit;
	font-size: 10.5px;
	font-weight: 600;
	opacity: 0.82;
}

.method-chip-label {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.method-days-input {
	width: 54px;
}

.method-days-input :deep(.el-input-number__decrease),
.method-days-input :deep(.el-input-number__increase) {
	width: 15px;
	border-left-color: #d9ecff;
	background: #f8fbff;
}

.method-days-input :deep(.el-input__wrapper) {
	min-height: 17px;
	padding-left: 3px;
	padding-right: 16px;
	border-radius: 4px;
	box-shadow: 0 0 0 1px #d9ecff inset;
}

.method-days-input :deep(.el-input__inner) {
	height: 17px;
	color: #1677ff;
	font-size: 10.5px;
	font-weight: 800;
}

@media (max-width: 1360px) {
	.ship-date-picker {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	}
}

@media (max-width: 980px) {
	.ship-date-picker {
		grid-template-columns: minmax(0, 1fr);
	}

	.picker-section {
		border-right: 0;
		border-bottom: 1px solid #dce8f6;
	}

	.period-main {
		grid-template-columns: minmax(0, 1fr);
	}

	.method-config-grid {
		grid-template-columns: repeat(2, minmax(92px, 1fr));
	}
}

:global(.shipping-profile-tooltip) {
	padding: 10px 12px !important;
	border: 1px solid #d9e2ef !important;
	box-shadow: 0 8px 24px rgb(31 45 61 / 14%) !important;
}

:global(.shipping-profile-tooltip .profile-tooltip-panel) {
	width: 430px;
	max-width: 72vw;
}

:global(.shipping-profile-tooltip .profile-tooltip-title) {
	margin-bottom: 8px;
	color: #303133;
	font-size: 13px;
	font-weight: 800;
}

:global(.shipping-profile-tooltip .profile-tooltip-table) {
	display: flex;
	flex-direction: column;
	gap: 3px;
}

:global(.shipping-profile-tooltip .profile-tooltip-row) {
	display: grid;
	grid-template-columns: 48px repeat(6, minmax(0, 1fr));
	align-items: center;
	min-height: 28px;
	padding: 0 7px;
	border-radius: 5px;
	color: #303133;
	font-size: 12px;
	text-align: center;
}

:global(.shipping-profile-tooltip .profile-tooltip-row.is-header) {
	background: #f5f7fa;
	color: #909399;
	font-weight: 700;
}

:global(.shipping-profile-tooltip .profile-tooltip-row.is-current) {
	background: #ecf5ff;
}

:global(.shipping-profile-tooltip .profile-tooltip-row strong),
:global(.shipping-profile-tooltip .profile-tooltip-row span) {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
