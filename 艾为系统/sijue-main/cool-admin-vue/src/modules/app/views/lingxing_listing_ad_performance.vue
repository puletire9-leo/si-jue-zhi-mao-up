<template>
	<cl-crud ref="Crud">
		<cl-row>
			<el-button @click="refresh">
				<el-icon><refresh /></el-icon>
				刷新
			</el-button>
			<el-input
				v-model="filters.keyWord"
				placeholder="ASIN / 标题 / 店铺 / MSKU / FNSKU"
				clearable
				style="width: 280px; margin-left: 10px"
				@keyup.enter="search"
				@clear="search"
			/>
			<el-select
				v-model="filters.marketplace"
				placeholder="站点"
				clearable
				multiple
				collapse-tags
				style="width: 150px; margin-left: 10px"
				@change="search"
			>
				<el-option label="英国" value="英国" />
				<el-option label="德国" value="德国" />
				<el-option label="法国" value="法国" />
				<el-option label="西班牙" value="西班牙" />
				<el-option label="意大利" value="意大利" />
				<el-option label="美国" value="美国" />
				<el-option label="日本" value="日本" />
				<el-option label="加拿大" value="加拿大" />
			</el-select>
			<el-select
				v-model="filters.seller_name"
				placeholder="店铺"
				clearable
				filterable
				multiple
				collapse-tags
				style="width: 180px; margin-left: 10px"
				@change="search"
			>
				<el-option
					v-for="item in storeOptions"
					:key="item"
					:label="item"
					:value="item"
				/>
			</el-select>
			<el-select
				v-model="filters.status"
				placeholder="状态"
				clearable
				style="width: 120px; margin-left: 10px"
				@change="search"
			>
				<el-option label="在售" :value="1" />
				<el-option label="停售" :value="0" />
				<el-option label="断货" :value="2" />
			</el-select>
			<el-button type="primary" style="margin-left: 10px" @click="search">查询</el-button>
		</cl-row>

		<cl-row>
			<cl-table ref="Table" row-key="id" @sort-change="handleSortChange">
				<template #column-image_url_display="{ scope }">
					<el-popover placement="right" trigger="hover" :width="300">
						<template #reference>
							<resilient-product-image
								:src="scope.row.image_url_display"
								width="50px"
								height="50px"
								fit="contain"
								priority="visible"
								class="listing-product-image"
							/>
						</template>
						<resilient-product-image
							:src="scope.row.image_url_display"
							width="280px"
							height="280px"
							fit="contain"
							priority="hover"
						/>
					</el-popover>
				</template>

				<template #column-status="{ scope }">
					<div class="status-tags">
						<el-tag
							v-if="scope.row.marketplace"
							size="small"
							effect="dark"
							:color="getMarketplaceColor(scope.row.marketplace)"
							style="border: none"
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
							{{ getListingStatusText(scope.row) }}
						</el-tag>
						<el-tag
							v-if="isClearanceListing(scope.row)"
							size="small"
							type="warning"
							effect="dark"
							disable-transitions
						>
							清
						</el-tag>
					</div>
				</template>

				<template #column-asin="{ scope }">
					<el-link
						target="_blank"
						:underline="false"
						:href="getAmazonDpUrl(scope.row.asin, scope.row.marketplace)"
					>
						{{ scope.row.asin || "-" }}
					</el-link>
				</template>

				<template #column-shop="{ scope }">
					<span>{{ scope.row.shop || scope.row.seller_name || "-" }}</span>
				</template>

				<template #column-msku_fnsku="{ scope }">
					<div>{{ scope.row.msku || "-" }}</div>
					<div class="muted">{{ scope.row.fnsku || "-" }}</div>
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
								class="price-history-line"
							>
								<span>{{ getPriceHistoryLabel(index) }}：{{ formatListingPriceValue(item) }}</span>
								<span
									v-if="getPriceHistoryTrend(scope.row, index)"
									:class="getPriceHistoryTrend(scope.row, index)?.className"
								>
									{{ getPriceHistoryTrend(scope.row, index)?.text }}
								</span>
							</div>
						</template>
						<span class="price-current">
							{{ formatListingPriceValue(scope.row.listing_price) }}
						</span>
					</el-tooltip>
					<span v-else>{{ formatListingPriceValue(scope.row.listing_price) }}</span>
				</template>

				<template #column-sellable_days_combined="{ scope }">
					<div class="sellable-days">
						<span>{{ getTotalSellableDays(scope.row) }}</span>
						<span class="divider">/</span>
						<span>{{ getFbaSellableDays(scope.row) }}</span>
					</div>
				</template>

				<template #header-inventory_details>
					<div class="inventory-header">
						<span
							class="inventory-header-sort"
							title="点击按FBA库存排序"
							@click.stop="onSort('afn_fulfillable_quantity')"
						>
							FBA{{ getSortIndicator("afn_fulfillable_quantity") }}
						</span>
						<span class="divider">/</span>
						<span
							class="inventory-header-sort"
							title="点击按FBA预留排序"
							@click.stop="onSort('afn_reserved_quantity')"
						>
							FBA预留{{ getSortIndicator("afn_reserved_quantity") }}
						</span>
						<span class="divider">/</span>
						<span
							class="inventory-header-sort"
							title="点击按在途库存排序"
							@click.stop="onSort('restocking_fba_shipping')"
						>
							在途{{ getSortIndicator("restocking_fba_shipping") }}
						</span>
						<span class="divider">/</span>
						<span
							class="inventory-header-sort"
							title="点击按本地库存排序"
							@click.stop="onSort('restocking_local_valid')"
						>
							本地{{ getSortIndicator("restocking_local_valid") }}
						</span>
					</div>
				</template>

				<template #column-inventory_details="{ scope }">
					<div class="inventory-details">
						<span class="inventory-link">{{ getFbaInventoryQuantity(scope.row) }}</span>
						<span class="divider">/</span>
						<span>{{ getFbaReservedQuantity(scope.row) }}</span>
						<span class="divider">/</span>
						<span class="inventory-link">{{ getRestockingFbaShippingQuantity(scope.row) }}</span>
						<span class="divider">/</span>
						<span>{{ getLocalValidQuantity(scope.row) }}</span>
					</div>
				</template>

				<template #column-dailyAvgSales="{ scope }">
					<el-popover
						trigger="click"
						placement="left"
						popper-class="listing-mini-popover"
						:show-arrow="true"
						:hide-after="300"
					>
						<template #reference>
							<div class="daily-sales-cell">
								<div class="daily-sales-main">
									{{ formatNumber(getDailyAvgSales(scope.row)) }}
								</div>
								<div class="daily-sales-label">
									3/7/14：
									<span>{{ getSalesAvgText(scope.row) }}</span>
								</div>
								<el-tag
									v-if="scope.row.salesChangeStatus"
									size="small"
									effect="plain"
									class="sales-status-tag"
								>
									{{ getSalesStatusShortText(scope.row.salesChangeStatus) }}
								</el-tag>
							</div>
						</template>
						<listing-analysis-mini :listing="scope.row" />
					</el-popover>
				</template>

				<template #column-non_ad_unit_cost="{ scope }">
					<span class="profit-cost-value">
						{{ formatMoney(scope.row.non_ad_unit_cost) }}
					</span>
				</template>

				<template #column-non_ad_profit_rate="{ scope }">
					<span :class="['profit-rate-value', getProfitRateClass(scope.row.non_ad_profit_rate)]">
						{{ formatRate(scope.row.non_ad_profit_rate) }}
					</span>
				</template>

				<template #column-suggested_ad_budget="{ scope }">
					<div class="ad-budget-cell">
						<div>
							<span class="ad-budget-label">销售额</span>
							<span class="ad-budget-value">{{ formatMoney(getSalesBasedAdBudget(scope.row), getCurrencySymbol(scope.row)) }}</span>
						</div>
						<div>
							<span class="ad-budget-label">利润</span>
							<span class="ad-budget-value is-profit">{{ formatMoney(getProfitBasedAdBudget(scope.row), getCurrencySymbol(scope.row)) }}</span>
						</div>
					</div>
				</template>

				<template #column-keyword_score_combined="{ scope }">
					<div class="keyword-metric-combo">
						<span class="keyword-metric-item" @click="openKeywordTrackingDetail(scope.row)">
							<span class="keyword-metric-label">自然</span>
							<span class="keyword-metric-link">{{ formatKeywordMetric(scope.row.score_nf, "score_nf") }}</span>
						</span>
						<span class="keyword-metric-item" @click="openKeywordTrackingDetail(scope.row)">
							<span class="keyword-metric-label">广告</span>
							<span class="keyword-metric-link">{{ formatKeywordMetric(scope.row.score_sp, "score_sp") }}</span>
						</span>
					</div>
				</template>

				<template #column-keyword_behind_rate_combined="{ scope }">
					<div class="keyword-metric-combo">
						<span class="keyword-metric-item" @click="openKeywordTrackingDetail(scope.row)">
							<span class="keyword-metric-label">自然</span>
							<span class="keyword-metric-link is-rate">{{ formatKeywordMetric(scope.row.behind_rate_nf, "behind_rate_nf") }}</span>
						</span>
						<span class="keyword-metric-item" @click="openKeywordTrackingDetail(scope.row)">
							<span class="keyword-metric-label">SP</span>
							<span class="keyword-metric-link is-rate">{{ formatKeywordMetric(scope.row.behind_rate_sp, "behind_rate_sp") }}</span>
						</span>
					</div>
				</template>

				<template #column-rating_combined="{ scope }">
					<el-popover placement="top" :width="360" trigger="hover">
						<template #reference>
							<div class="rating-mini">
								<div v-for="row in getRatingMiniRows(scope.row)" :key="row.key">
									<span>{{ row.label }}：</span>
									<span>{{ row.currentText }}</span>
									<span :class="['rating-delta', row.trendClass]">
										{{ row.trendText }}
									</span>
								</div>
							</div>
						</template>
						<div>
							<div class="summary-title">评分</div>
							<div>{{ formatSummaryValue(scope.row.stars) }}</div>
							<div class="summary-title">Rating总数</div>
							<div>{{ formatSummaryValue(scope.row.reviews_num) }}</div>
						</div>
					</el-popover>
				</template>

				<template #slot-management-buttons="{ scope }">
					<el-tooltip content="关键词管理" placement="top" :hide-after="0">
						<el-button type="warning" size="default" plain circle @click="openKeywordManagement(scope.row)">
							<el-icon><Collection /></el-icon>
						</el-button>
					</el-tooltip>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-pagination />
		</cl-row>

		<el-drawer v-model="keywordManagementPaneVisible" size="90%" direction="ltr">
			<listing-keyword :listing="curEditingListing" />
		</el-drawer>

		<keyword-tracking-detail
			v-model="detailDialogVisible"
			:listing-row="detailListingRow"
			@changed="refresh"
		/>
	</cl-crud>
</template>

<script lang="ts" name="app-lingxing-listing-ad-performance" setup>
import { useCrud, useTable } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { convert_image_url } from "/$/app/utils";
import ResilientProductImage from "/$/app/components/resilient-product-image.vue";
import ListingAnalysisMini from "/$/app/components/ListingAnalysisMini.vue";
import ListingKeyword from "/$/app/components/listing-keyword-lingxing.vue";
import KeywordTrackingDetail from "../components/keyword-tracking-detail.vue";
import { Collection, Refresh } from "@element-plus/icons-vue";
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";

const { service } = useCool();

const filters = reactive({
	keyWord: "",
	marketplace: [] as string[],
	seller_name: [] as string[],
	status: undefined as number | undefined
});

const storeOptions = ref<string[]>([]);
const currentSort = ref<{ prop?: string; order?: string }>({
	prop: "afn_fulfillable_quantity",
	order: "desc"
});

const replenishmentViewService = {
	page(params: any) {
		return (service.app.bsr_product_Listing_Lingxing as any).page(params);
	}
};

const Table = useTable({
	columns: [
		{ label: "图片", prop: "image_url_display", width: 70, align: "center", fixed: "left" },
		{ label: "状态", prop: "status", minWidth: 90, fixed: "left" },
		{ label: "ASIN", prop: "asin", minWidth: 100, fixed: "left" },
		{ label: "标题", prop: "item_name", minWidth: 220, showOverflowTooltip: true, fixed: "left" },
		{ label: "店铺", prop: "shop", minWidth: 120, showOverflowTooltip: true },
		{ label: "MSKU/FNSKU", prop: "msku_fnsku", minWidth: 140, showOverflowTooltip: true },
		{ label: "售价", prop: "listing_price", minWidth: 170, sortable: "custom" },
		{ label: "可售天数(总/FBA)", prop: "sellable_days_combined", minWidth: 130 },
		{ label: "FBA/FBA预留/在途/本地", prop: "inventory_details", minWidth: 160 },
		{ label: "日均销量趋势", prop: "dailyAvgSales", minWidth: 125, sortable: "custom" },
		{ label: "不含广告单件成本", prop: "non_ad_unit_cost", minWidth: 130, align: "center", sortable: "custom" },
		{ label: "不含广告利润率", prop: "non_ad_profit_rate", minWidth: 120, align: "center", sortable: "custom" },
		{ label: "建议广告预算", prop: "suggested_ad_budget", minWidth: 135, align: "center" },
		{ label: "综合分(自然/广告)", prop: "keyword_score_combined", minWidth: 150, align: "center" },
		{ label: "落后率(自然/SP)", prop: "keyword_behind_rate_combined", minWidth: 150, align: "center" },
		{ label: "评分", prop: "rating_combined", minWidth: 150 },
		{ label: "管理", type: "op", buttons: ["slot-management-buttons"], width: 80, fixed: "right" }
	]
});

const Crud = useCrud(
	{
		service: replenishmentViewService,
		async onRefresh(params, { next }) {
			Object.assign(params, buildQueryParams());
			if (currentSort.value.prop && currentSort.value.order) {
				params.prop = currentSort.value.prop;
				params.order = currentSort.value.order;
			}
			await next(params);
			for (const item of Table.value?.data || []) {
				item.image_url_display = convert_image_url(item.image_url_display || item.image_url);
			}
		}
	},
	app => {
		app.refresh();
	}
);

onMounted(() => {
	loadStores();
});

async function loadStores() {
	try {
		const res = await (service.app.bsr_product_Listing_Lingxing as any).getStores();
		storeOptions.value = Array.isArray(res) ? res.filter(Boolean) : [];
	} catch (error) {
		console.warn("加载店铺失败", error);
	}
}

const keywordManagementPaneVisible = ref(false);
const curEditingListing = ref<any>(null);
const detailDialogVisible = ref(false);
const detailListingRow = ref<any>(null);

type KeywordMetricKey = "score_nf" | "score_sp" | "behind_rate_nf" | "behind_rate_sp";
const keywordRateMetrics = new Set<KeywordMetricKey>(["behind_rate_nf", "behind_rate_sp"]);

function toNullableNumber(value: any): number | null {
	if (value === undefined || value === null || value === "") return null;
	const num = Number(value);
	return Number.isFinite(num) ? num : null;
}

function formatKeywordMetric(value: any, metric: KeywordMetricKey) {
	const num = toNullableNumber(value);
	if (num === null) return "-";
	if (keywordRateMetrics.has(metric)) return `${(num * 100).toFixed(2)}%`;
	return num.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function buildKeywordListing(row: any) {
	return {
		id: row.id,
		asin: row.asin,
		product_code: row.product_code,
		sid: row.store_id,
		store_id: row.store_id,
		seller_sku: row.msku,
		msku: row.msku,
		sellerName: row.seller_name,
		seller_name: row.seller_name,
		marketplace: row.marketplace,
		local_name: row.local_name,
		item_name: row.item_name,
		image_url: row.image_url,
		image_url_display: row.image_url_display
	};
}

function openKeywordManagement(row: any) {
	if (!row?.asin) {
		ElMessage.warning("当前产品缺少 ASIN，无法管理关键词");
		return;
	}
	curEditingListing.value = buildKeywordListing(row);
	keywordManagementPaneVisible.value = true;
}

function openKeywordTrackingDetail(row: any) {
	if (!row?.asin) {
		ElMessage.warning("当前产品缺少 ASIN，无法查看关键词详情");
		return;
	}
	detailListingRow.value = buildKeywordListing(row);
	detailDialogVisible.value = true;
}

function buildQueryParams() {
	return {
		keyWord: filters.keyWord || undefined,
		marketplace: filters.marketplace?.length ? filters.marketplace : undefined,
		seller_name: filters.seller_name?.length ? filters.seller_name : undefined,
		status: filters.status
	};
}

function refresh() {
	Crud.value?.refresh();
}

function search() {
	Crud.value?.refresh({ page: 1 });
}

function handleSortChange({ prop, order }: { prop?: string; order?: string }) {
	currentSort.value = prop && order ? { prop, order } : {};
	Crud.value?.refresh({
		page: 1,
		prop,
		order
	});
}

function getNextSortOrder(prop: string) {
	if (currentSort.value.prop !== prop) {
		return "desc";
	}

	if (currentSort.value.order === "desc") {
		return "asc";
	}

	if (currentSort.value.order === "asc") {
		return undefined;
	}

	return "desc";
}

function getSortIndicator(prop: string) {
	if (currentSort.value.prop !== prop) {
		return "";
	}

	return currentSort.value.order === "desc" ? "↓" : currentSort.value.order === "asc" ? "↑" : "";
}

function onSort(prop: string) {
	const nextOrder = getNextSortOrder(prop);
	currentSort.value = nextOrder ? { prop, order: nextOrder } : {};
	Crud.value?.refresh({
		page: 1,
		prop: nextOrder ? prop : undefined,
		order: nextOrder
	});
}

function getMarketplaceShortName(marketplace: string) {
	if (!marketplace) return "";
	const map: Record<string, string> = {
		英国: "英",
		德国: "德",
		法国: "法",
		西班牙: "西",
		意大利: "意",
		美国: "美",
		日本: "日",
		加拿大: "加"
	};
	return map[marketplace] || marketplace.charAt(0);
}

function getMarketplaceColor(marketplace: string) {
	if (!marketplace) return "#909399";
	const map: Record<string, string> = {
		英国: "#409EFF",
		德国: "#303133",
		法国: "#8e44ad",
		西班牙: "#E6A23C",
		意大利: "#67C23A",
		美国: "#67C23A",
		日本: "#F56C6C",
		加拿大: "#909399"
	};
	return map[marketplace] || "#909399";
}

function getListingStatusText(row: any) {
	if (row.status === 1) return "售";
	if (row.abnormalOfflineStatus === 1) return "异";
	return "断";
}

function isClearanceListing(row: any) {
	return Number(row?.restock_setting_type) === 1;
}

function getAmazonDpUrl(asin: string, marketplace: string) {
	if (!asin) return "#";
	const domainMap: Record<string, string> = {
		英国: "co.uk",
		德国: "de",
		法国: "fr",
		西班牙: "es",
		意大利: "it",
		美国: "com",
		日本: "co.jp",
		加拿大: "ca"
	};
	return `https://www.amazon.${domainMap[marketplace] || "com"}/dp/${asin}`;
}

function formatNumber(value: any, digits = 2) {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	return num.toFixed(digits).replace(/\.?0+$/, "");
}

function formatCompactNumber(value: any, digits = 2) {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	return num.toFixed(digits).replace(/\.?0+$/, "");
}

function formatMoney(value: any, symbol = "") {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	return `${symbol || ""}${formatNumber(num)}`;
}

function getCurrencySymbol(row: any) {
	return row?.currency_symbol || row?.performance_currency_icon || "";
}

function getDailySalesAmount(row: any) {
	const price = Number(row?.listing_price);
	const dailySales = Number(getDailyAvgSales(row));
	if (!Number.isFinite(price) || !Number.isFinite(dailySales)) return null;
	return price * dailySales;
}

function getNonAdDailyProfit(row: any) {
	const salesAmount = getDailySalesAmount(row);
	const profitRate = Number(row?.non_ad_profit_rate);
	if (!Number.isFinite(Number(salesAmount)) || !Number.isFinite(profitRate)) return null;
	return Number(salesAmount) * profitRate;
}

function getSalesBasedAdBudget(row: any) {
	const salesAmount = getDailySalesAmount(row);
	return Number.isFinite(Number(salesAmount)) ? Number(salesAmount) * 0.1 : null;
}

function getProfitBasedAdBudget(row: any) {
	const profit = getNonAdDailyProfit(row);
	return Number.isFinite(Number(profit)) ? Math.max(Number(profit) * 0.5, 0) : null;
}

function formatRate(value: any) {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	return `${(num * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function getProfitRateClass(value: any) {
	const num = Number(value);
	if (!Number.isFinite(num)) return "";
	if (num < 0.1) return "is-danger";
	if (num < 0.2) return "is-warning";
	return "is-good";
}

function normalizeNumberArray(value: any) {
	if (Array.isArray(value)) {
		return value.map(item => {
			if (item === undefined || item === null || item === "") return null;
			const num = Number(item);
			return Number.isFinite(num) ? num : null;
		});
	}
	if (typeof value === "string" && value.trim()) {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) return normalizeNumberArray(parsed);
		} catch (error) {
			const num = Number(value);
			return Number.isFinite(num) ? [num] : [];
		}
	}
	const num = Number(value);
	return Number.isFinite(num) ? [num] : [];
}

function getListingPriceHistory(row: any) {
	const history = normalizeNumberArray(row?.listing_price_history);
	if (history.length > 0) return history;
	const current = Number(row?.listing_price);
	return Number.isFinite(current) ? [current] : [];
}

function formatListingPriceValue(num: number | undefined | null): string {
	if (num === undefined || num === null || Number.isNaN(Number(num))) return "-";
	return formatNumber(Number(num));
}

function getPriceHistoryLabel(index: number): string {
	if (index === 0) {
		return "最新";
	}

	const date = new Date();
	date.setDate(date.getDate() - index);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

function getPriceHistoryTrend(row: any, index: number) {
	const trackedPositions = [3, 8, 15];
	if (!trackedPositions.includes(index + 1)) return null;

	const history = getListingPriceHistory(row);
	const current = Number(row?.listing_price ?? history[0]);
	const compareValue = history[index];
	if (compareValue === undefined || compareValue === null) return null;
	const compare = Number(compareValue);
	if (!Number.isFinite(current) || !Number.isFinite(compare)) return null;

	if (current > compare) return { text: "↑", className: "trend-up" };
	if (current < compare) return { text: "↓", className: "trend-down" };
	return { text: "=", className: "trend-flat" };
}

function getFbaInventoryQuantity(row: any) {
	const list = row?.restocking?.fbaValidList;
	if (Array.isArray(list) && list.length > 0) {
		const matchedList = list.filter((item: any) => {
			if (!row.msku) return true;
			return item.msku ? item.msku === row.msku : true;
		});
		if (matchedList.length > 0) {
			return matchedList.reduce((sum: number, item: any) => {
				const qty = item.afnFulfillableQuantity ?? item.quantity;
				return sum + (Number(qty) || 0);
			}, 0);
		}
	}
	return Number(row?.afn_fulfillable_quantity) || 0;
}

function getFbaReservedQuantity(row: any) {
	const list = row?.restocking?.fbaValidList;
	if (Array.isArray(list) && list.length > 0) {
		const matchedList = list.filter((item: any) => {
			if (!row.msku) return true;
			return item.msku ? item.msku === row.msku : true;
		});
		if (matchedList.length > 0) {
			return matchedList.reduce((sum: number, item: any) => {
				return sum + (Number(item.afnReservedQuantity) || 0);
			}, 0);
		}
	}
	return (
		(Number(row?.reserved_customerorders) || 0) +
		(Number(row?.reserved_fc_processing) || 0) +
		(Number(row?.reserved_fc_transfers) || 0)
	);
}

function getRestockingFbaShippingQuantity(row: any) {
	const list = row?.restocking?.fbaShippingList;
	if (Array.isArray(list) && list.length > 0) {
		return list
			.filter((item: any) => !row.msku || (item.msku ? item.msku === row.msku : true))
			.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
	}
	return (
		(Number(row?.afn_inbound_shipped_quantity) || 0) +
		(Number(row?.afn_inbound_working_quantity) || 0) +
		(Number(row?.afn_inbound_receiving_quantity) || 0)
	);
}

function getLocalValidQuantity(row: any) {
	const list = row?.restocking?.extInfo?.localValidDetailList;
	if (Array.isArray(list) && list.length > 0) {
		return list
			.filter((item: any) => !row.msku || (item.sku ? item.sku === row.msku : true))
			.reduce((sum: number, item: any) => sum + (Number(item.quantityValid) || 0), 0);
	}
	return Number(row?.restocking_local_valid) || 0;
}

function getDailyAvgSales(row: any) {
	const direct = Number(row?.dailyAvgSales);
	if (Number.isFinite(direct) && direct > 0) return direct;

	const salesInfo = row?.restocking?.salesInfo;
	if (!salesInfo) return 0;
	const salesAvg3 = Number(salesInfo.salesAvg3) || 0;
	const salesAvg7 = Number(salesInfo.salesAvg7) || 0;
	const salesAvg14 = Number(salesInfo.salesAvg14) || 0;
	if (salesAvg14 === 0 || salesAvg7 === 0) return 0;
	if (salesAvg3 === 0) return salesAvg7;
	const rate3To7 = salesAvg7 > 0 ? (salesAvg3 - salesAvg7) / salesAvg7 : 0;
	const rate3To14 = salesAvg14 > 0 ? (salesAvg3 - salesAvg14) / salesAvg14 : 0;
	let dailyAvgSales = 0;
	if (rate3To7 < -0.66 || rate3To7 > 2) dailyAvgSales = (salesAvg3 * 2 + salesAvg7 * 0.8 + salesAvg14 * 0.2) / 3;
	else if (rate3To14 > 1 || rate3To14 < -0.5) dailyAvgSales = (salesAvg3 * 1.8 + salesAvg7 * 0.8 + salesAvg14 * 0.4) / 3;
	else if (rate3To14 > 0.5 || rate3To14 < -0.33) dailyAvgSales = (salesAvg3 * 1.4 + salesAvg7 + salesAvg14 * 0.6) / 3;
	else dailyAvgSales = (salesAvg3 * 1.1 + salesAvg7 * 1.1 + salesAvg14 * 0.8) / 3;
	return Number(dailyAvgSales.toFixed(2));
}

function getSalesAvgText(row: any) {
	const salesInfo = row?.restocking?.salesInfo || {};
	const avg3 = salesInfo.salesAvg3 ?? row?.average_three_volume ?? "-";
	const avg7 = salesInfo.salesAvg7 ?? row?.average_seven_volume ?? "-";
	const avg14 = salesInfo.salesAvg14 ?? row?.average_fourteen_volume ?? "-";
	return `3/7/14：${formatNumber(avg3)} / ${formatNumber(avg7)} / ${formatNumber(avg14)}`;
}

function getTotalSellableDays(row: any) {
	const direct = Number(row?.stockDays ?? row?.total_sellable_days_calc);
	if (Number.isFinite(direct) && direct >= 0) return Math.floor(direct);
	const dailyAvg = getDailyAvgSales(row);
	if (dailyAvg <= 0) return 999;
	const total = getFbaInventoryQuantity(row) + getFbaReservedQuantity(row) + getRestockingFbaShippingQuantity(row);
	return Math.floor(total / dailyAvg);
}

function getFbaSellableDays(row: any) {
	const direct = Number(row?.sellableDays);
	if (Number.isFinite(direct) && direct >= 0) return Math.floor(direct);
	const dailyAvg = getDailyAvgSales(row);
	if (dailyAvg <= 0) return 999;
	return Math.floor(getFbaInventoryQuantity(row) / dailyAvg);
}

function getSalesStatusShortText(status: string) {
	const map: Record<string, string> = {
		销量稳定: "稳定",
		"14天无单": "14无",
		"7天无单": "7无",
		"3天无单": "3无",
		短期突降: "短降",
		短期突增: "短增",
		明显增长: "显增",
		明显下滑: "显降",
		小幅增长: "小增",
		小幅下滑: "小降",
		销量平稳: "平稳"
	};
	return map[status] || status;
}

function formatSummaryValue(value: any) {
	const arr = normalizeNumberArray(value);
	return arr.length ? arr.join(" → ") : "-";
}

function getHistoryTrendSummary(value: any, compareIndex = 10) {
	const arr = normalizeNumberArray(value);
	const current = Number(arr[0]);
	const compare = Number(arr[compareIndex - 1] ?? arr[arr.length - 1]);
	const currentText = Number.isFinite(current) ? formatCompactNumber(current, 2) : "-";
	const compareText = Number.isFinite(compare) ? formatCompactNumber(compare, 2) : "-";
	if (!Number.isFinite(current) || !Number.isFinite(compare)) {
		return { currentText, compareText, trendText: "-", trendClass: "is-flat" };
	}
	const diff = current - compare;
	if (diff > 0) {
		return { currentText, compareText, trendText: `↑${formatCompactNumber(Math.abs(diff), 2)}`, trendClass: "is-up" };
	}
	if (diff < 0) {
		return { currentText, compareText, trendText: `↓${formatCompactNumber(Math.abs(diff), 2)}`, trendClass: "is-down" };
	}
	return { currentText, compareText, trendText: "→", trendClass: "is-flat" };
}

function getRatingMiniRows(item: any) {
	return [
		{
			key: "stars",
			label: "评分",
			...getHistoryTrendSummary(item?.stars)
		},
		{
			key: "reviews_num",
			label: "总数",
			...getHistoryTrendSummary(item?.reviews_num)
		}
	];
}
</script>

<style scoped>
.listing-product-image {
	background: #fff;
	border-radius: 4px;
}

.status-tags,
.inventory-details,
.sellable-days {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 3px;
}

.muted {
	font-size: 12px;
	color: #909399;
}

.divider {
	color: #dcdfe6;
}

.inventory-header {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 4px;
	white-space: nowrap;
}

.inventory-header-sort {
	cursor: pointer;
	user-select: none;
	transition: color 0.2s;
}

.inventory-header-sort:hover,
.inventory-link {
	color: #409eff;
}

.inventory-link {
	font-weight: 600;
}

.inventory-details,
.sellable-days {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 4px;
	font-size: 13px;
}

.daily-sales-cell {
	cursor: pointer;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
	width: 100%;
	min-height: 62px;
	padding: 8px 6px;
	border-radius: 8px;
	background: linear-gradient(180deg, rgba(64, 158, 255, 0.08), rgba(64, 158, 255, 0.02));
	transition: background 0.2s, box-shadow 0.2s;
}

.daily-sales-cell:hover {
	background: rgba(64, 158, 255, 0.12);
	box-shadow: inset 0 0 0 1px rgba(64, 158, 255, 0.16);
}

.daily-sales-main {
	color: #3b82f6;
	font-size: 15px;
	font-weight: 700;
	line-height: 18px;
}

.daily-sales-label,
.price-history-row {
	font-size: 12px;
	color: #909399;
}

.daily-sales-label {
	line-height: 18px;
	text-align: center;
	word-break: break-word;
}

.daily-sales-label span {
	color: #606266;
}

.sales-status-tag {
	font-size: 10px;
	height: auto;
	line-height: 1.5;
	padding: 0 4px;
}

.price-current {
	cursor: help;
}

.price-history-line {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	min-width: 150px;
	font-size: 12px;
	line-height: 20px;
}

.trend-up,
.rating-delta.is-up {
	color: #f56c6c;
	font-weight: 700;
}

.trend-down,
.rating-delta.is-down {
	color: #67c23a;
	font-weight: 700;
}

.trend-flat,
.rating-delta.is-flat {
	color: #909399;
}

.ad-budget-cell {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 5px;
	font-size: 12px;
	line-height: 18px;
}

.ad-budget-cell > div {
	display: inline-flex;
	align-items: center;
	gap: 5px;
}

.ad-budget-label {
	color: #909399;
}

.ad-budget-value {
	font-weight: 700;
	color: #1677ff;
}

.ad-budget-value.is-profit {
	color: #67c23a;
}

.profit-cost-value,
.profit-rate-value {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 58px;
	height: 24px;
	padding: 0 8px;
	border-radius: 6px;
	font-size: 12px;
	font-weight: 700;
	line-height: 24px;
	white-space: nowrap;
}

.profit-cost-value {
	background: #f5f7fa;
	color: #303133;
	box-shadow: inset 0 0 0 1px rgba(144, 147, 153, 0.14);
}

.profit-rate-value.is-good {
	background: #f0f9eb;
	color: #529b2e;
}

.profit-rate-value.is-warning {
	background: #fdf6ec;
	color: #b26a00;
}

.profit-rate-value.is-danger {
	background: #fef0f0;
	color: #c45656;
}

.keyword-metric-combo {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 5px;
	padding: 4px 0;
}

.keyword-metric-item {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 5px;
	cursor: pointer;
}

.keyword-metric-label {
	min-width: 24px;
	font-size: 11px;
	color: #909399;
	text-align: right;
}

.keyword-metric-link,
.keyword-metric-pill {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 54px;
	height: 24px;
	padding: 0 8px;
	border-radius: 999px;
	font-size: 12px;
	font-weight: 600;
	line-height: 24px;
	white-space: nowrap;
}

.keyword-metric-link {
	background: #ecf5ff;
	color: #1677ff;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px rgba(64, 158, 255, 0.16);
	transition: all 0.16s ease;
}

.keyword-metric-link:hover {
	background: #409eff;
	color: #fff;
	box-shadow: 0 4px 10px rgba(64, 158, 255, 0.22);
	transform: translateY(-1px);
}

.keyword-metric-link.is-rate {
	background: #fdf6ec;
	color: #b26a00;
	box-shadow: inset 0 0 0 1px rgba(230, 162, 60, 0.18);
}

.keyword-metric-item:hover .keyword-metric-link.is-rate {
	background: #e6a23c;
	color: #fff;
	box-shadow: 0 4px 10px rgba(230, 162, 60, 0.22);
}

.keyword-metric-pill {
	background: #f5f7fa;
	color: #606266;
	box-shadow: inset 0 0 0 1px rgba(144, 147, 153, 0.14);
}

.keyword-metric-pill.is-rate {
	background: #fdf6ec;
	color: #b26a00;
	box-shadow: inset 0 0 0 1px rgba(230, 162, 60, 0.18);
}

.rating-mini {
	cursor: help;
	font-size: 12px;
	line-height: 18px;
}

.rating-delta {
	margin-left: 4px;
}

.summary-title {
	font-weight: 700;
	margin-top: 8px;
}
</style>
