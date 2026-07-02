<template>
  <div class="bazhuayu-auto">
    <section class="overview-head">
      <div>
        <h1>八爪鱼自动采集</h1>
        <p>三段口径：当前运行（内存） / 本周（ISO 周） / 历史累计（全量）。</p>
      </div>
      <div class="overview-actions">
        <!-- 顶部数据库标签：只读展示，让你一眼确认在往哪个库写 -->
        <el-tooltip
          v-if="overview?.datasource"
          :content="datasourceTooltip"
          placement="bottom"
        >
          <el-tag
            :type="isProdDb ? 'danger' : 'success'"
            size="small"
            effect="dark"
          >
            DB: {{ overview.datasource.database }} ·
            {{ overview.datasource.profile }}
          </el-tag>
        </el-tooltip>
        <el-select
          v-model="marketplace"
          clearable
          size="small"
          style="width: 120px"
          placeholder="全部站点"
        >
          <el-option label="US" value="US" />
          <el-option label="UK" value="UK" />
          <el-option label="DE" value="DE" />
        </el-select>
        <el-button size="small" :loading="refreshing" @click="loadOverview">
          刷新
        </el-button>
      </div>
    </section>

    <!-- 段一：当前运行（内存态，服务重启即清空） -->
    <section class="segment">
      <div class="segment-head">
        <span class="segment-title">当前运行</span>
        <span class="segment-sub">内存态，服务重启即清空</span>
      </div>
      <el-row :gutter="12">
        <el-col
          v-for="item in currentMetrics"
          :key="item.label"
          :xs="12"
          :sm="8"
          :md="8"
        >
          <div class="metric-card current">
            <div class="metric-label">{{ item.label }}</div>
            <div class="metric-value">{{ item.value }}</div>
          </div>
        </el-col>
      </el-row>
    </section>

    <!-- 段二：本周（createdAt >= 本周一 00:00） -->
    <section class="segment">
      <div class="segment-head">
        <span class="segment-title">本周（{{ weekTag || "—" }}）</span>
        <span class="segment-sub" v-if="weekStart">自 {{ weekStart }} 起</span>
      </div>
      <el-row :gutter="12">
        <el-col
          v-for="item in weekMetrics"
          :key="item.label"
          :xs="12"
          :sm="8"
          :md="6"
        >
          <div class="metric-card week">
            <div class="metric-label">{{ item.label }}</div>
            <div class="metric-value" :class="item.tone">{{ item.value }}</div>
          </div>
        </el-col>
      </el-row>
    </section>

    <!-- 段三：历史累计（全量） -->
    <section class="segment">
      <div class="segment-head">
        <span class="segment-title">历史累计</span>
        <span class="segment-sub">全量，跨周</span>
      </div>
      <el-row :gutter="12">
        <el-col
          v-for="item in lifetimeMetrics"
          :key="item.label"
          :xs="12"
          :sm="8"
          :md="8"
        >
          <div class="metric-card lifetime">
            <div class="metric-label">{{ item.label }}</div>
            <div class="metric-value" :class="item.tone">{{ item.value }}</div>
          </div>
        </el-col>
      </el-row>
    </section>

    <el-card class="console-card">
      <template #header>
        <div class="card-header">
          <span>当前任务状态</span>
          <span class="card-subtitle"
            >6 个槽位（2 功能 × 3 站点），空闲不代表没历史数据</span
          >
        </div>
      </template>

      <el-table :data="consoleRows" border size="small" v-loading="refreshing">
        <el-table-column prop="functionLabel" label="功能" width="110" />
        <el-table-column prop="marketplace" label="站点" width="80" />
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <el-tag
              :type="phaseTag((row as ConsoleRow).state?.phase)"
              size="small"
            >
              {{ phaseText((row as ConsoleRow).state?.phase) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前进度" min-width="220">
          <template #default="{ row }">
            <span v-if="(row as ConsoleRow).state">
              <span v-if="(row as ConsoleRow).state?.cloudExtractCount"
                >云端
                {{
                  (row as ConsoleRow).state?.cloudExtractCount.toLocaleString()
                }}</span
              >
              <span v-if="(row as ConsoleRow).state?.drainedRows" class="sep"
                >/ 入库
                {{
                  (row as ConsoleRow).state?.drainedRows.toLocaleString()
                }}</span
              >
              <span v-if="(row as ConsoleRow).state?.error" class="danger"
                >/ {{ (row as ConsoleRow).state?.error }}</span
              >
            </span>
            <span v-else class="muted">空闲</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="history-card">
      <template #header>
        <div class="card-header">
          <span>
            <el-radio-group v-model="scope" size="small">
              <el-radio-button label="week">本周任务</el-radio-button>
              <el-radio-button label="lifetime">历史累计</el-radio-button>
            </el-radio-group>
          </span>
          <span class="card-subtitle"
            >{{ scopeCount }} 条 · 按创建时间倒序</span
          >
        </div>
      </template>

      <el-table
        :data="filteredHistory"
        border
        stripe
        v-loading="refreshing"
        @row-click="openDetail"
      >
        <el-table-column prop="marketplace" label="站点" width="80" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="statusTag((row as BazhuayuTaskMapItem).status)"
              size="small"
            >
              {{ statusText((row as BazhuayuTaskMapItem).status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column prop="completedAt" label="完成时间" width="170" />
        <el-table-column label="量级" min-width="180">
          <template #default="{ row }">
            <span>总数 {{ (row as BazhuayuTaskMapItem).totalCount || 0 }}</span>
            <span class="sep"
              >/ 通过 {{ (row as BazhuayuTaskMapItem).passCount || 0 }}</span
            >
          </template>
        </el-table-column>
        <el-table-column label="未通过原因" min-width="280">
          <template #default="{ row }">
            <span
              v-for="chip in failureBreakdown(row as BazhuayuTaskMapItem)"
              :key="chip.label"
              class="reason-chip"
              :class="chip.tone"
              >{{ chip.label }} {{ chip.value }}</span
            >
            <span
              v-if="failureBreakdown(row as BazhuayuTaskMapItem).length === 0"
              class="muted"
              >—</span
            >
          </template>
        </el-table-column>
        <el-table-column label="API" width="130">
          <template #default="{ row }">
            <span>{{ (row as BazhuayuTaskMapItem).apiSuccess || 0 }}</span>
            <span
              class="sep"
              :class="{ danger: (row as BazhuayuTaskMapItem).apiFail }"
              >/ {{ (row as BazhuayuTaskMapItem).apiFail || 0 }}</span
            >
          </template>
        </el-table-column>
        <el-table-column label="批次" width="90">
          <template #default="{ row }">
            <span
              >{{ (row as BazhuayuTaskMapItem).batchCurrent || 0 }}/{{
                (row as BazhuayuTaskMapItem).batchTotal || 0
              }}</span
            >
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <!-- @click.stop 防止触发行点击 openDetail -->
            <el-button
              v-if="(row as BazhuayuTaskMapItem).status === 'READY'"
              type="primary"
              size="small"
              :loading="executingIds.has((row as BazhuayuTaskMapItem).id)"
              @click.stop="executeTask(row as BazhuayuTaskMapItem)"
              >执行卖家精灵</el-button
            >
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!refreshing && !filteredHistory.length"
        :description="scope === 'week' ? '本周暂无任务' : '暂无历史任务'"
      />
    </el-card>

    <el-drawer v-model="detailVisible" size="480px" title="批次详情">
      <div v-if="detailRow" class="detail-grid">
        <div>
          <span>站点</span><strong>{{ detailRow.marketplace }}</strong>
        </div>
        <div>
          <span>状态</span><strong>{{ statusText(detailRow.status) }}</strong>
        </div>
        <div>
          <span>总数</span><strong>{{ detailRow.totalCount || 0 }}</strong>
        </div>
        <div>
          <span>通过（进入卖家精灵）</span
          ><strong class="ok">{{ detailRow.passCount || 0 }}</strong>
        </div>
        <div class="section">未通过原因（合计 {{ detailRejectSum }}）</div>
        <div>
          <span>价格不符</span
          ><strong>{{ detailRow.priceFailCount || 0 }}</strong>
        </div>
        <div>
          <span>评论数不符</span
          ><strong>{{ detailRow.reviewFailCount || 0 }}</strong>
        </div>
        <div>
          <span>输入重复</span
          ><strong>{{ detailRow.duplicateCount || 0 }}</strong>
        </div>
        <div>
          <span>已采过 / 黑名单</span
          ><strong>{{ detailRow.skipCount || 0 }}</strong>
        </div>
        <div class="section">卖家精灵调用</div>
        <div>
          <span>成功</span
          ><strong class="ok">{{ detailRow.apiSuccess || 0 }}</strong>
        </div>
        <div>
          <span>失败</span
          ><strong :class="{ danger: detailRow.apiFail }">{{
            detailRow.apiFail || 0
          }}</strong>
        </div>
        <div>
          <span>已消耗请求</span
          ><strong>{{ detailRow.apiRequestsUsed || 0 }}</strong>
        </div>
        <div>
          <span>批次进度</span
          ><strong
            >{{ detailRow.batchCurrent || 0 }} /
            {{ detailRow.batchTotal || 0 }}</strong
          >
        </div>
        <div class="section">其它</div>
        <div>
          <span>周标签</span
          ><strong>{{ detailRow.dataMonth || weekTag }}</strong>
        </div>
        <div>
          <span>错误信息</span
          ><strong>{{ detailRow.errorMessage || "无" }}</strong>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  bazhuayuApi,
  type BazhuayuOverviewResp,
  type BazhuayuPhase,
  type BazhuayuRunState,
  type BazhuayuTaskMapItem,
} from "@/api/bazhuayu";
import { asinImportApi } from "@/api/asinImport";

type Scope = "week" | "lifetime";

const marketplace = ref("");
const refreshing = ref(false);
const weekTag = ref("");
const weekStart = ref("");
const overview = ref<BazhuayuOverviewResp | null>(null);
const runStates = ref<BazhuayuRunState[]>([]);
const scope = ref<Scope>("week");
const detailVisible = ref(false);
const detailRow = ref<BazhuayuTaskMapItem | null>(null);
/** 正在执行的 taskId 集合，用于按钮 loading */
const executingIds = ref<Set<number>>(new Set());

const FUNCTIONS = [
  { key: "bangdan", label: "榜单采集" },
  { key: "yitushitu", label: "以图识图" },
];
const MARKETS = ["US", "UK", "DE"];
const RUNNING_PHASES: BazhuayuPhase[] = [
  "STARTING",
  "WAITING_CLOUD",
  "DRAINING",
];

interface ConsoleRow {
  taskKey: string;
  function: string;
  functionLabel: string;
  marketplace: string;
  state: BazhuayuRunState | null;
}

const consoleRows = computed<ConsoleRow[]>(() => {
  const byKey = new Map(runStates.value.map((s) => [s.taskKey, s] as const));
  return FUNCTIONS.flatMap((f) =>
    MARKETS.map((mp) => ({
      taskKey: `${f.key}:${mp}`,
      function: f.key,
      functionLabel: f.label,
      marketplace: mp,
      state: byKey.get(`${f.key}:${mp}`) ?? null,
    })),
  );
});

/** 按站点过滤：拿到符合筛选条件的 marketplace 行（已带三段字段） */
const selectedMarkets = computed(() => {
  const markets = overview.value?.marketplaces ?? [];
  return marketplace.value
    ? markets.filter((m) => m.marketplace === marketplace.value)
    : markets;
});

/** 按站点过滤后聚合数字，避免在 template 里重复 reduce */
function sumBy<K extends keyof (typeof selectedMarkets)["value"][number]>(
  key: K,
): number {
  return selectedMarkets.value.reduce((s, m) => s + (Number(m[key]) || 0), 0);
}

/** 当前运行段：内存态判定，与 DB 无关 */
const currentMetrics = computed(() => {
  // 站点筛选也过滤运行态
  const runningStates = runStates.value.filter((s) =>
    RUNNING_PHASES.includes(s.phase),
  );
  const filtered = marketplace.value
    ? runningStates.filter((s) => s.marketplace === marketplace.value)
    : runningStates;
  const cloudSum = filtered.reduce((s, r) => s + (r.cloudExtractCount || 0), 0);
  return [
    { label: "当前周", value: weekTag.value || "—" },
    { label: "运行中槽位", value: filtered.length.toLocaleString() },
    { label: "云端已采", value: cloudSum.toLocaleString() },
  ];
});

/** 本周段：createdAt >= 本周一 00:00 的任务口径 */
const weekMetrics = computed(() => [
  {
    label: "本周原始量",
    value: sumBy("weeklyRawCount").toLocaleString(),
    tone: "",
  },
  {
    label: "本周任务",
    value: sumBy("weekTaskCount").toLocaleString(),
    tone: "",
  },
  {
    label: "本周完成",
    value: sumBy("weekDoneCount").toLocaleString(),
    tone: "success",
  },
  {
    label: "本周失败",
    value: sumBy("weekErrorCount").toLocaleString(),
    tone: sumBy("weekErrorCount") > 0 ? "danger" : "",
  },
]);

/** 历史累计段：全量任务，与本周独立 */
const lifetimeMetrics = computed(() => [
  {
    label: "累计任务",
    value: sumBy("lifetimeTaskCount").toLocaleString(),
    tone: "",
  },
  {
    label: "累计完成",
    value: sumBy("lifetimeDoneCount").toLocaleString(),
    tone: "success",
  },
  {
    label: "累计失败",
    value: sumBy("lifetimeErrorCount").toLocaleString(),
    tone: sumBy("lifetimeErrorCount") > 0 ? "danger" : "",
  },
]);

const filteredHistory = computed(() => {
  const src =
    scope.value === "week"
      ? (overview.value?.weekTasks ?? [])
      : (overview.value?.lifetimeTasks ?? []);
  return marketplace.value
    ? src.filter((t) => t.marketplace === marketplace.value)
    : src;
});

const scopeCount = computed(() => filteredHistory.value.length);

function phaseText(phase?: BazhuayuPhase) {
  return (
    (
      {
        IDLE: "空闲",
        STARTING: "启动中",
        WAITING_CLOUD: "云端采集中",
        DRAINING: "入库中",
        DONE: "完成",
        ERROR: "失败",
        TIMEOUT: "超时",
        STOPPED: "已停止",
      } as Record<BazhuayuPhase, string>
    )[phase ?? "IDLE"] ?? "空闲"
  );
}

function phaseTag(
  phase?: BazhuayuPhase,
): "primary" | "success" | "warning" | "info" | "danger" {
  if (phase === "DONE") return "success";
  if (phase === "ERROR" || phase === "TIMEOUT") return "danger";
  if (phase === "WAITING_CLOUD" || phase === "DRAINING") return "primary";
  if (phase === "STARTING") return "warning";
  return "info";
}

function statusText(status: string) {
  return (
    (
      {
        READY: "待确认",
        RUNNING: "运行中",
        DONE: "完成",
        ERROR: "失败",
        REJECTED: "已拒绝",
        PAUSED: "已暂停",
        CANCELLED: "已取消",
      } as Record<string, string>
    )[status] || status
  );
}

function statusTag(
  status: string,
): "primary" | "success" | "warning" | "info" | "danger" {
  if (status === "DONE") return "success";
  if (status === "ERROR") return "danger";
  if (status === "RUNNING") return "warning";
  return "info";
}

/**
 * 未通过原因分解：把 5 类不通过来源拆成独立的芯片
 * 后端源：AsinImportService.finishStreamingTask (priceFail/reviewFail/duplicate/skipMain/skipBlacklist)
 * 页面拿到的 skipCount = skipMain + skipBlacklist；这里只显示合并的「已采过/黑名单」
 */
function failureBreakdown(row: BazhuayuTaskMapItem) {
  const chips: Array<{ label: string; value: number; tone: string }> = [];
  if (row.priceFailCount)
    chips.push({ label: "价格", value: row.priceFailCount, tone: "warning" });
  if (row.reviewFailCount)
    chips.push({ label: "评论", value: row.reviewFailCount, tone: "warning" });
  if (row.duplicateCount)
    chips.push({ label: "重复", value: row.duplicateCount, tone: "info" });
  if (row.skipCount)
    chips.push({ label: "已采过/黑名单", value: row.skipCount, tone: "info" });
  return chips;
}

/** 数据库标签 hover 展示完整连接串 */
const datasourceTooltip = computed(() => {
  const d = overview.value?.datasource;
  if (!d) return "";
  return `${d.database} @ ${d.host}:${d.port} · profile=${d.profile}`;
});

/** 抽屉里的「未通过合计」，跟 total - pass 做对比看有没有漏计 */
const detailRejectSum = computed(() => {
  const r = detailRow.value;
  if (!r) return 0;
  return (
    (r.priceFailCount || 0) +
    (r.reviewFailCount || 0) +
    (r.duplicateCount || 0) +
    (r.skipCount || 0)
  );
});

/** 从库名/profile 粗判是否生产库，用来把标签涂红提醒 */
const isProdDb = computed(() => {
  const d = overview.value?.datasource;
  if (!d) return false;
  const db = (d.database || "").toLowerCase();
  const profile = (d.profile || "").toLowerCase();
  return (
    profile.includes("prod") ||
    (db.length > 0 && !db.includes("dev") && !db.includes("test"))
  );
});

/**
 * 触发卖家精灵调用：对某个 READY 任务调 /asin-import/execute
 * 后端异步执行，前端立即刷新一次并把 taskId 从 executingIds 移除；
 * 进度靠用户手动/定时刷新 overview 回写（页面没做长轮询以避免刷新抖动）。
 */
async function executeTask(row: BazhuayuTaskMapItem) {
  const db = overview.value?.datasource;
  const dbLabel = db ? `${db.database} @ ${db.host}:${db.port}` : "当前数据库";
  try {
    await ElMessageBox.confirm(
      `即将对任务 #${row.id}（${row.marketplace}）调用卖家精灵，写入到 ${dbLabel}。是否继续？`,
      "确认执行",
      { type: "warning", confirmButtonText: "执行", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  executingIds.value.add(row.id);
  try {
    await asinImportApi.execute(row.id, row.dataMonth || "", row.marketplace);
    ElMessage.success(`任务 #${row.id} 已提交给卖家精灵，稍后刷新查看进度`);
    // 立刻刷一次总览，让状态由 READY 变 RUNNING
    await loadOverview();
  } catch (e: any) {
    ElMessage.error(e?.message || "执行失败");
  } finally {
    executingIds.value.delete(row.id);
  }
}

function openDetail(row: BazhuayuTaskMapItem) {
  detailRow.value = row;
  detailVisible.value = true;
}

async function loadOverview() {
  refreshing.value = true;
  try {
    const [overviewResp, states] = await Promise.all([
      bazhuayuApi.overview(),
      bazhuayuApi.runState(),
    ]);
    overview.value = overviewResp;
    runStates.value = states;
    weekTag.value = overviewResp.weekTag;
    weekStart.value = overviewResp.weekStart || "";
  } catch (e: any) {
    ElMessage.error(e?.message || "加载八爪鱼总览失败");
  } finally {
    refreshing.value = false;
  }
}

onMounted(loadOverview);
</script>

<style scoped lang="scss">
.bazhuayu-auto {
  padding: 20px;
}

.overview-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
  margin-bottom: 16px;

  h1 {
    margin: 0 0 6px;
    font-size: 20px;
  }

  p {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
}

.overview-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.segment {
  margin-bottom: 14px;
}

.segment-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}

.segment-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.segment-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.metric-card {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 12px;
  min-height: 74px;

  &.current {
    border-left: 3px solid var(--el-color-primary);
  }
  &.week {
    border-left: 3px solid var(--el-color-warning);
  }
  &.lifetime {
    border-left: 3px solid var(--el-color-info);
  }
}

.metric-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.metric-value {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 700;

  &.success {
    color: var(--el-color-success);
  }
  &.danger {
    color: var(--el-color-danger);
  }
}

.console-card,
.history-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-subtitle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.sep {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}

.danger {
  color: var(--el-color-danger);
}

.muted {
  color: var(--el-text-color-secondary);
}

/** 未通过原因芯片，密集展示 4 类值 */
.reason-chip {
  display: inline-block;
  margin: 2px 6px 2px 0;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  border: 1px solid var(--el-border-color-lighter);

  &.warning {
    background: var(--el-color-warning-light-9);
    color: var(--el-color-warning-dark-2);
    border-color: var(--el-color-warning-light-5);
  }
  &.info {
    background: var(--el-color-info-light-9);
    color: var(--el-color-info);
    border-color: var(--el-color-info-light-5);
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;

  /** 分区标题：不参与左右分布，跨整行 */
  .section {
    display: block;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px dashed var(--el-border-color-lighter);
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  div:not(.section) {
    display: flex;
    justify-content: space-between;
    gap: 12px;

    span {
      color: var(--el-text-color-secondary);
    }
  }

  strong.ok {
    color: var(--el-color-success);
  }
  strong.danger {
    color: var(--el-color-danger);
  }
}
</style>
