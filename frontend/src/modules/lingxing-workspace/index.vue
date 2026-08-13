<template>
  <div class="lingxing-workspace">
    <!-- 顶栏 -->
    <div class="page-head">
      <div class="head-title">
        <span class="title">领星工作台</span>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadOverview"
          >刷新</el-button
        >
      </div>
    </div>

    <!-- 数据总览卡片 -->
    <div class="stat-grid" v-loading="loading && !overview">
      <div
        class="stat-card unified-card"
        role="button"
        tabindex="0"
        @click="activeTab = 'unified'"
      >
        <div class="stat-label">产品统一表 · 最终产出</div>
        <div class="stat-value">
          {{ formatNumber(overview?.unified?.total) }}
          <span class="stat-sub"
            >有销量 {{ formatNumber(overview?.unified?.withSales) }}</span
          >
        </div>
        <div class="stat-hint">
          6 目标标签 ASIN · 最新月 {{ overview?.coverage.weeklyLatest ?? "--" }}
          · 点击查看明细 →
        </div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">月度产品表现</div>
        <div class="stat-value">
          {{ formatNumber(overview?.tableCounts.monthlyPerformance) }}
        </div>
        <div class="stat-hint">
          最新月份 {{ overview?.coverage.monthlyLatest ?? "--" }}
        </div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">周级 SKU 表现</div>
        <div class="stat-value">
          {{ formatNumber(overview?.tableCounts.skuWeekly) }}
        </div>
        <div class="stat-hint">
          最新周 {{ overview?.coverage.weeklyLatest ?? "--" }}
        </div>
      </div>
      <div class="stat-card danger">
        <div class="stat-label">日级利润</div>
        <div class="stat-value">
          {{ formatNumber(overview?.tableCounts.profitAsin) }}
        </div>
        <div class="stat-hint">
          最新日 {{ overview?.coverage.profitLatest ?? "--" }}
        </div>
      </div>
      <div class="stat-card info">
        <div class="stat-label">本地产品</div>
        <div class="stat-value">
          {{ formatNumber(overview?.tableCounts.localProduct) }}
        </div>
        <div class="stat-hint">团队 SKU 主档</div>
      </div>
      <div class="stat-card info">
        <div class="stat-label">店铺</div>
        <div class="stat-value">
          {{ formatNumber(overview?.tableCounts.seller) }}
        </div>
        <div class="stat-hint">UK + DE 授权店</div>
      </div>
      <div class="stat-card info">
        <div class="stat-label">采购计划/订单/明细</div>
        <div class="stat-value">
          {{ formatNumber(overview?.tableCounts.purchasePlan) }}
          <span class="stat-sub"
            >/ {{ formatNumber(overview?.tableCounts.purchaseOrder) }} /
            {{ formatNumber(overview?.tableCounts.purchaseOrderItem) }}</span
          >
        </div>
        <div class="stat-hint">Q1/Q2/Q3 定义</div>
      </div>
      <div class="stat-card info">
        <div class="stat-label">同步任务</div>
        <div class="stat-value">
          {{ formatNumber(overview?.tableCounts.dataSyncRun) }}
        </div>
        <div class="stat-hint">历史累计运行</div>
      </div>
    </div>

    <!-- Tab 区 -->
    <el-tabs v-model="activeTab" type="border-card" class="tab-panel">
      <!-- 概览 -->
      <el-tab-pane label="概览" name="overview">
        <div class="tab-body">
          <!-- 产品统一表图表（最终产出物） -->
          <div class="section-title">
            产品统一表分布
            <span class="section-sub"
              >共 {{ formatNumber(overview?.unified?.total) }} 个目标标签
              ASIN</span
            >
          </div>
          <div class="chart-row">
            <div class="chart-card">
              <div class="chart-title">按目标标签</div>
              <div v-if="unifiedTagBars.length" class="bar-list">
                <div
                  v-for="row in unifiedTagBars"
                  :key="row.name"
                  class="bar-item"
                >
                  <div class="bar-label">{{ row.name }}</div>
                  <div class="bar-track">
                    <div
                      class="bar-fill green"
                      :style="{ width: barPercent(row.cnt, unifiedTagMax) + '%' }"
                    />
                  </div>
                  <div class="bar-value">{{ formatNumber(row.cnt) }}</div>
                </div>
              </div>
              <el-empty v-else description="暂无数据" :image-size="60" />
            </div>

            <div class="chart-card">
              <div class="chart-title">按国家</div>
              <div v-if="overview?.unified?.byCountry?.length" class="pie-list">
                <div
                  v-for="row in overview.unified.byCountry"
                  :key="row.country"
                  class="pie-item"
                  :class="row.country === 'UK' ? 'gbp' : 'eur'"
                >
                  <div class="pie-currency">{{ row.country }}</div>
                  <div class="pie-count">{{ formatNumber(row.cnt) }}</div>
                  <div class="pie-percent">
                    {{ percent(row.cnt, overview.unified.total) }}%
                  </div>
                </div>
              </div>
              <el-empty v-else description="暂无数据" :image-size="60" />
            </div>
          </div>

          <div class="chart-row">
            <div class="chart-card full">
              <div class="chart-title">按最新销量月份分布</div>
              <div v-if="unifiedMonthsSorted.length" class="month-chart">
                <div
                  v-for="row in unifiedMonthsSorted"
                  :key="row.month"
                  class="month-bar"
                  :title="`${row.month}: ${row.cnt} ASIN`"
                >
                  <div
                    class="month-fill green"
                    :style="{ height: barPercent(row.cnt, unifiedMonthMax) + '%' }"
                  />
                  <div class="month-label">{{ shortMonth(row.month) }}</div>
                </div>
              </div>
              <el-empty v-else description="暂无数据" :image-size="60" />
            </div>
          </div>

        </div>
      </el-tab-pane>

      <!-- 产品统一表明细 -->
      <el-tab-pane label="产品统一表" name="unified">
        <div class="tab-body">
          <div class="unified-toolbar">
            <el-input
              v-model="unifiedFilter.asin"
              placeholder="搜索 ASIN"
              clearable
              style="width: 200px"
              @keyup.enter="reloadUnified"
              @clear="reloadUnified"
            />
            <el-input
              v-model="unifiedFilter.developer"
              placeholder="开发人"
              clearable
              style="width: 160px"
              @keyup.enter="reloadUnified"
              @clear="reloadUnified"
            />
            <el-button type="primary" :icon="Search" @click="reloadUnified"
              >查询</el-button
            >
            <span class="unified-total"
              >共 {{ formatNumber(unifiedPage.total) }} 个 ASIN</span
            >
          </div>

          <el-table
            :data="unifiedRows"
            v-loading="unifiedLoading"
            size="small"
            stripe
            border
            class="unified-table"
          >
            <el-table-column
              prop="asin"
              label="ASIN"
              width="120"
              fixed
              show-overflow-tooltip
            />
            <el-table-column
              prop="title"
              label="标题"
              min-width="220"
              show-overflow-tooltip
            />
            <el-table-column prop="developer" label="开发人" width="90" />
            <el-table-column prop="country" label="国家" width="66" />
            <el-table-column
              prop="listingTags"
              label="标签"
              width="160"
              show-overflow-tooltip
            />
            <el-table-column prop="listingDate" label="上架日期" width="100" />
            <el-table-column label="累计销量" width="100" align="right">
              <template #default="{ row }">{{
                formatNumber(row.totalVolume)
              }}</template>
            </el-table-column>
            <el-table-column label="累计金额" width="110" align="right">
              <template #default="{ row }">{{
                formatMoney(row.totalAmount)
              }}</template>
            </el-table-column>
            <el-table-column label="毛利率" width="90" align="right">
              <template #default="{ row }">{{
                formatPercent(row.avgGrossMargin)
              }}</template>
            </el-table-column>
            <el-table-column prop="latestMonth" label="最新月" width="90" />
            <el-table-column label="最新销量" width="100" align="right">
              <template #default="{ row }">{{
                formatNumber(row.latestVolume)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="fbaObservationStatus"
              label="FBA观测"
              width="150"
              show-overflow-tooltip
            />
          </el-table>

          <div class="unified-pager">
            <el-pagination
              v-model:current-page="unifiedPage.current"
              v-model:page-size="unifiedPage.size"
              :total="unifiedPage.total"
              :page-sizes="[60, 100, 200]"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="reloadUnified"
              @current-change="loadUnified"
            />
          </div>
        </div>
      </el-tab-pane>

      <!-- 同步中心 -->
      <el-tab-pane name="sync">
        <template #label>
          <span>同步中心</span>
          <el-badge
            v-if="runningCount > 0"
            :value="runningCount"
            class="tab-badge"
            type="primary"
          />
        </template>
        <div class="tab-body">
          <div class="sync-hint">
            <el-alert
              title="领星 API 只有限流，没有配额上限"
              type="info"
              show-icon
              :closable="false"
            >
              <div>
                单店铺请求 1 秒间隔，多店铺请求 10 秒间隔，令牌桶容量 1。
              </div>
              <div>
                周同步 UK+DE 全量 12 分钟拉完，请在服务器命令行运行
                <code
                  >python scripts/lingxing_daily/weekly_asin_sync.py --api</code
                >
              </div>
            </el-alert>
          </div>

          <el-table
            :data="syncRuns"
            v-loading="loading"
            size="small"
            stripe
            border
          >
            <el-table-column
              prop="run_id"
              label="任务 ID"
              width="180"
              show-overflow-tooltip
            />
            <el-table-column prop="run_type" label="类型" width="130" />
            <el-table-column prop="marketplace" label="站点" width="80" />
            <el-table-column label="时间窗" width="200">
              <template #default="{ row }">
                <span v-if="row.start_date"
                  >{{ row.start_date }} ~ {{ row.end_date }}</span
                >
                <span v-else class="text-muted">--</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="runStatusType(row.status)" size="small">{{
                  row.status
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="upserted_count"
              label="写入数"
              width="90"
              align="right"
            />
            <el-table-column
              prop="fetched_count"
              label="拉取数"
              width="90"
              align="right"
            />
            <el-table-column label="开始时间" width="170">
              <template #default="{ row }">
                {{ formatTime(row.started_at) }}
              </template>
            </el-table-column>
            <el-table-column label="结束时间" width="170">
              <template #default="{ row }">
                {{ formatTime(row.finished_at) }}
              </template>
            </el-table-column>
            <el-table-column
              prop="error_message"
              label="异常"
              min-width="200"
              show-overflow-tooltip
            />
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 凭证 -->
      <el-tab-pane
        v-if="userStore.isAdmin"
        label="凭证 & API 规则"
        name="credentials"
      >
        <div class="tab-body">
          <el-alert
            title="更新领星凭证会覆盖当前会话的 access_token"
            type="warning"
            :closable="false"
            show-icon
          >
            仅在需要切换领星账号或凭证失效时使用。生产环境请通过部署脚本注入。
          </el-alert>

          <el-form label-position="top" :model="credForm" class="cred-form">
            <el-form-item label="appId">
              <el-input
                v-model="credForm.appId"
                placeholder="领星 appId"
                clearable
              />
            </el-form-item>
            <el-form-item label="appSecret">
              <el-input
                v-model="credForm.appSecret"
                type="password"
                placeholder="领星 appSecret"
                show-password
                clearable
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                :loading="credSaving"
                :disabled="!credForm.appId || !credForm.appSecret"
                @click="submitCredentials"
              >
                更新凭证
              </el-button>
              <el-button :loading="pinging" @click="doPing"
                >链路验证 (ping)</el-button
              >
            </el-form-item>
          </el-form>

          <div class="rule-card">
            <div class="rule-title">领星 API 关键规则</div>
            <ul class="rule-list">
              <li><strong>只有限流，没有配额上限</strong> —— 可以放心多调</li>
              <li>单店铺请求：<code>1 秒间隔</code></li>
              <li>多店铺请求（sid 数组 &gt; 1）：<code>10 秒间隔</code></li>
              <li>令牌桶容量 <code>1</code> —— 紧凑请求会累积等待</li>
              <li>
                单次 sid 数组上限 <code>200</code>（UK/DE 各 115 个正好塞得下）
              </li>
              <li>
                <code>is_recently_enum: false</code> 必须传（默认 true
                只返回活跃 ASIN，会漏淘汰品）
              </li>
            </ul>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh, Search } from "@element-plus/icons-vue";
import { useUserStore } from "@/stores/user";
import {
  lingxingProductApi,
  type LingxingOverview,
  type LingxingProductUnified,
  type SyncRun,
} from "@/api/lingxingProduct";

const userStore = useUserStore();
const loading = ref(false);
const activeTab = ref<"overview" | "unified" | "sync" | "credentials">(
  "overview",
);
const overview = ref<LingxingOverview | null>(null);
const syncRuns = ref<SyncRun[]>([]);

/* ─── 产品统一表明细 ─── */
const unifiedRows = ref<LingxingProductUnified[]>([]);
const unifiedLoading = ref(false);
const unifiedFilter = reactive({ asin: "", developer: "" });
const unifiedPage = reactive({ current: 1, size: 60, total: 0 });

async function loadUnified() {
  unifiedLoading.value = true;
  try {
    const page = await lingxingProductApi.listProductUnified({
      current: unifiedPage.current,
      size: unifiedPage.size,
      asin: unifiedFilter.asin.trim() || undefined,
      developer: unifiedFilter.developer.trim() || undefined,
    });
    unifiedRows.value = page.records;
    unifiedPage.total = page.total;
  } catch (e: unknown) {
    ElMessage.error(
      "加载统一表失败：" + (e instanceof Error ? e.message : String(e)),
    );
  } finally {
    unifiedLoading.value = false;
  }
}

/** 筛选/页大小变化：回到第 1 页重新加载 */
function reloadUnified() {
  unifiedPage.current = 1;
  loadUnified();
}

const credForm = reactive({ appId: "", appSecret: "" });
const credSaving = ref(false);
const pinging = ref(false);

async function loadOverview() {
  loading.value = true;
  try {
    const [overviewData, runs] = await Promise.all([
      lingxingProductApi.getOverview(),
      lingxingProductApi.listSyncRuns(50),
    ]);
    overview.value = overviewData;
    syncRuns.value = runs;
  } catch (e: unknown) {
    ElMessage.error(
      "加载工作台数据失败：" + (e instanceof Error ? e.message : String(e)),
    );
  } finally {
    loading.value = false;
  }
}

async function submitCredentials() {
  credSaving.value = true;
  try {
    await lingxingProductApi.updateCredentials({
      appId: credForm.appId.trim(),
      appSecret: credForm.appSecret,
    });
    ElMessage.success("凭证已更新");
    credForm.appId = "";
    credForm.appSecret = "";
  } catch (e: unknown) {
    ElMessage.error(
      "更新失败：" + (e instanceof Error ? e.message : String(e)),
    );
  } finally {
    credSaving.value = false;
  }
}

async function doPing() {
  pinging.value = true;
  try {
    const info = await lingxingProductApi.ping();
    ElMessage.success(`链路 OK · token=${info?.token} · code=${info?.code}`);
  } catch (e: unknown) {
    ElMessage.error(
      "链路验证失败：" + (e instanceof Error ? e.message : String(e)),
    );
  } finally {
    pinging.value = false;
  }
}

/* ─── computed / util ─── */

/** 6 目标标签 bar 数据（后端 byTag 一行 6 列 → 数组，值可能是字符串） */
const unifiedTagBars = computed(() => {
  const t = overview.value?.unified?.byTag;
  if (!t) return [] as Array<{ name: string; cnt: number }>;
  const toNum = (v: number | string | null) => Number(v ?? 0) || 0;
  return [
    { name: "欧洲精铺2025", cnt: toNum(t.tag_jingpu) },
    { name: "非标品", cnt: toNum(t.tag_feibiao) },
    { name: "淘汰", cnt: toNum(t.tag_taotai) },
    { name: "待淘汰", cnt: toNum(t.tag_daitaotai) },
    { name: "季节性断货", cnt: toNum(t.tag_jijie) },
    { name: "绿标", cnt: toNum(t.tag_lvbiao) },
  ]
    .filter((r) => r.cnt > 0)
    .sort((a, b) => b.cnt - a.cnt);
});

const unifiedTagMax = computed(() =>
  unifiedTagBars.value.length
    ? Math.max(...unifiedTagBars.value.map((r) => r.cnt))
    : 1,
);

const unifiedMonthsSorted = computed(() => {
  const arr = overview.value?.unified?.byLatestMonth ?? [];
  return [...arr].sort((a, b) => (a.month > b.month ? 1 : -1));
});

const unifiedMonthMax = computed(() => {
  const arr = overview.value?.unified?.byLatestMonth ?? [];
  return arr.length ? Math.max(...arr.map((r) => r.cnt)) : 1;
});

const runningCount = computed(
  () => syncRuns.value.filter((run) => run.status === "RUNNING").length,
);

function barPercent(v: number, max: number) {
  if (!max) return 0;
  return Math.max(3, Math.round((v / max) * 100));
}

function percent(v: number, total: number) {
  if (!total) return "0";
  return ((v / total) * 100).toFixed(1);
}

function formatNumber(v: number | null | undefined) {
  if (v == null) return "--";
  return v.toLocaleString("en-US");
}

/** 金额：字符串数字 → 千分位保留 2 位 */
function formatMoney(v: string | number | null | undefined) {
  if (v == null || v === "") return "--";
  const n = Number(v);
  if (Number.isNaN(n)) return "--";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 毛利率：小数(如 0.35) → 百分比 */
function formatPercent(v: string | number | null | undefined) {
  if (v == null || v === "") return "--";
  const n = Number(v);
  if (Number.isNaN(n)) return "--";
  return (n * 100).toFixed(1) + "%";
}

function shortMonth(m: string) {
  return m?.slice(2) ?? "";
}

function formatTime(t: string | null) {
  if (!t) return "--";
  return t.replace("T", " ").slice(0, 19);
}

function runStatusType(
  status: string,
): "primary" | "success" | "warning" | "info" | "danger" {
  if (status === "SUCCESS") return "success";
  if (status === "RUNNING") return "primary";
  if (status === "FAILED") return "danger";
  return "info";
}

onMounted(() => {
  loadOverview();
  loadUnified();
});
</script>

<style scoped lang="scss">
.lingxing-workspace {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 4px 0;
}

.head-title {
  display: flex;
  align-items: baseline;
  gap: 12px;

  .title {
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
  }
  .subtitle {
    font-size: 13px;
    color: #6b7280;
  }
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.stat-card {
  padding: 14px 16px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  transition:
    transform 0.15s,
    box-shadow 0.15s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.06);
  }

  .stat-label {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 6px;
  }
  .stat-value {
    font-size: 24px;
    font-weight: 600;
    line-height: 1.2;
    color: #111827;

    .stat-sub {
      font-size: 13px;
      color: #6b7280;
      font-weight: 400;
      margin-left: 4px;
    }
  }
  .stat-hint {
    margin-top: 4px;
    font-size: 11px;
    color: #9ca3af;
  }

  &.primary {
    border-top: 3px solid #3b82f6;
  }
  &.success {
    border-top: 3px solid #10b981;
  }
  &.warning {
    border-top: 3px solid #f59e0b;
  }
  &.danger {
    border-top: 3px solid #ef4444;
  }
  &.info {
    border-top: 3px solid #6366f1;
  }
}

.tab-panel {
  --el-tabs-header-height: 44px;
  border-radius: 8px;
  overflow: hidden;
}

.tab-body {
  padding: 12px 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chart-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  padding: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  min-height: 200px;

  &.full {
    grid-column: 1 / -1;
  }
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}

.bar-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bar-item {
  display: grid;
  grid-template-columns: 100px 1fr 60px;
  gap: 8px;
  align-items: center;
  font-size: 13px;

  .bar-label {
    color: #374151;
  }
  .bar-track {
    height: 12px;
    background: #f3f4f6;
    border-radius: 6px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    border-radius: 6px;
    transition: width 0.4s ease;
  }
  .bar-value {
    text-align: right;
    color: #6b7280;
    font-variant-numeric: tabular-nums;
  }
}

.pie-list {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.pie-item {
  flex: 1;
  min-width: 120px;
  padding: 20px 16px;
  border-radius: 8px;
  text-align: center;

  &.gbp {
    background: linear-gradient(135deg, #dbeafe, #eff6ff);
  }
  &.eur {
    background: linear-gradient(135deg, #fce7f3, #fdf2f8);
  }
  &.other {
    background: #f3f4f6;
  }

  .pie-currency {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 4px;
  }
  .pie-count {
    font-size: 22px;
    font-weight: 600;
    color: #111827;
  }
  .pie-percent {
    font-size: 12px;
    color: #6b7280;
    margin-top: 2px;
  }
}

.month-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 160px;
  padding-top: 8px;
}

.month-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;

  .month-fill {
    width: 100%;
    background: linear-gradient(180deg, #6366f1, #a5b4fc);
    border-radius: 3px 3px 0 0;
    min-height: 4px;
    transition: height 0.4s;
  }
  .month-label {
    font-size: 10px;
    color: #9ca3af;
    transform: rotate(-45deg);
    white-space: nowrap;
    margin-top: 4px;
    transform-origin: center top;
  }
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-tag {
  font-size: 13px;
  padding: 6px 12px;
  height: auto;
}

.sync-hint {
  margin-bottom: 4px;

  code {
    background: rgba(0, 0, 0, 0.05);
    padding: 1px 6px;
    border-radius: 3px;
    font-family: "Fira Code", monospace;
    font-size: 12px;
  }
}

.text-muted {
  color: #9ca3af;
}

.tab-badge {
  margin-left: 4px;
  vertical-align: middle;
}

.cred-form {
  max-width: 460px;
  margin-top: 16px;
}

.rule-card {
  margin-top: 8px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border-left: 3px solid #3b82f6;

  .rule-title {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 10px;
  }
  .rule-list {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    color: #374151;
    line-height: 1.9;

    code {
      background: rgba(0, 0, 0, 0.06);
      padding: 1px 6px;
      border-radius: 3px;
      font-family: "Fira Code", monospace;
      font-size: 12px;
    }
  }
}

/* 统一表卡片（最终产出物，绿色强调 + 可点击） */
.unified-card {
  border-top: 3px solid #10b981;
  background: linear-gradient(135deg, #ecfdf5, #ffffff);
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid #10b981;
    outline-offset: 2px;
  }
}

/* 概览分区标题 */
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin: 4px 0 -4px;

  .section-sub {
    font-size: 12px;
    font-weight: 400;
    color: #9ca3af;
    margin-left: 8px;
  }
}

/* 统一表图表用绿色系区分 baseline 蓝色 */
.bar-fill.green {
  background: linear-gradient(90deg, #10b981, #6ee7b7);
}
.month-fill.green {
  background: linear-gradient(180deg, #10b981, #6ee7b7);
}

/* 统一表明细工具栏 + 分页 */
.unified-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;

  .unified-total {
    margin-left: auto;
    font-size: 13px;
    color: #6b7280;
    font-variant-numeric: tabular-nums;
  }
}

.unified-pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

/* 让整页自然滚动：Element Plus 的 border-card tabs 默认 content overflow:hidden，
   会裁掉高内容导致外层 lay-content 感知不到溢出而无法滚动。放开裁剪，
   表格按数据自然撑高，由外层 .lay-content 整页滚动（鼠标在任意位置都能滚）。 */
.tab-panel {
  overflow: visible;

  :deep(.el-tabs__content) {
    overflow: visible;
  }
}
</style>
