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
        <el-button
          size="small"
          type="primary"
          :loading="triggeringAll"
          @click="triggerAllImport"
        >
          一键全导
        </el-button>
        <el-button size="small" @click="openMappingDrawer">
          任务配置
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
        <span class="segment-sub" v-if="weekStart">自 {{ formatTs(weekStart) }} 起</span>
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
          <span class="header-controls">
            <el-radio-group v-model="scope" size="small">
              <el-radio-button label="week">本周任务</el-radio-button>
              <el-radio-button label="lifetime">历史累计</el-radio-button>
            </el-radio-group>
            <el-select
              v-model="categoryFilter"
              size="small"
              clearable
              placeholder="全部分类"
              style="width: 150px"
            >
              <el-option label="全部分类" value="" />
              <el-option
                v-for="c in categoryOptions"
                :key="c"
                :label="c"
                :value="c"
              />
            </el-select>
            <span class="category-chips">
              <el-tag
                v-for="g in categoryCounts"
                :key="g.category"
                size="small"
                :type="categoryFilter === g.category ? 'primary' : 'info'"
                :effect="categoryFilter === g.category ? 'dark' : 'plain'"
                class="category-chip"
                @click="
                  categoryFilter = categoryFilter === g.category ? '' : g.category
                "
                >{{ g.category }} {{ g.count }}</el-tag
              >
            </span>
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
        <el-table-column label="任务" min-width="170">
          <template #default="{ row }">
            <div>{{ (row as BazhuayuTaskMapItem).taskName || "历史任务" }}</div>
            <span class="muted">{{ (row as BazhuayuTaskMapItem).taskCategory || "未分类" }}</span>
          </template>
        </el-table-column>
        <el-table-column label="初筛" width="85" align="center">
          <template #default="{ row }">
            <el-tag
              :type="(row as BazhuayuTaskMapItem).initialFilter ? 'success' : 'warning'"
              size="small"
            >{{ (row as BazhuayuTaskMapItem).initialFilter ? "是" : "否" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="displayStatusTag(row as BazhuayuTaskMapItem)"
              size="small"
            >
              {{ displayStatusText(row as BazhuayuTaskMapItem) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">
            {{ formatTs((row as BazhuayuTaskMapItem).createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="八爪鱼批次" min-width="190">
          <template #default="{ row }">
            <div>{{ (row as BazhuayuTaskMapItem).bazhuayuBatchNo || "历史任务" }}</div>
            <span v-if="(row as BazhuayuTaskMapItem).bazhuayuBatchCount" class="muted">
              {{ (row as BazhuayuTaskMapItem).bazhuayuBatchCount?.toLocaleString() }} 条
            </span>
          </template>
        </el-table-column>
        <el-table-column label="完成时间" width="170">
          <template #default="{ row }">
            {{ displayCompletedAt(row as BazhuayuTaskMapItem) }}
          </template>
        </el-table-column>
        <el-table-column label="量级" min-width="180">
          <template #default="{ row }">
            <span>总数 {{ (row as BazhuayuTaskMapItem).totalCount || 0 }}</span>
            <span class="sep"
              >/ 通过 {{ (row as BazhuayuTaskMapItem).passCount || 0 }}</span
            >
          </template>
        </el-table-column>
        <el-table-column label="通过原因" min-width="180">
          <template #default="{ row }">
            <span
              v-for="chip in passBreakdown(row as BazhuayuTaskMapItem)"
              :key="chip.label"
              class="reason-chip"
              :class="chip.tone"
              >{{ chip.label }} {{ chip.value }}</span
            >
            <span
              v-if="passBreakdown(row as BazhuayuTaskMapItem).length === 0"
              class="muted"
              >—</span
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
        <el-table-column label="请求次数" width="100" align="center">
          <template #default="{ row }">
            {{ displayRequestCount(row as BazhuayuTaskMapItem) }}
          </template>
        </el-table-column>
        <el-table-column label="批次" width="90">
          <template #default="{ row }">
            <span
              >{{ displayBatchCurrent(row as BazhuayuTaskMapItem) }}/{{
                displayBatchTotal(row as BazhuayuTaskMapItem)
              }}</span
            >
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <!-- @click.stop 防止触发行点击 openDetail -->
            <el-button
              v-if="hasSellerSpriteRun(row as BazhuayuTaskMapItem)"
              type="success"
              link
              size="small"
              @click.stop="openSellerSpriteRun(row as BazhuayuTaskMapItem)"
              >查看请求中心</el-button
            >
            <el-button
              v-else-if="(row as BazhuayuTaskMapItem).status === 'READY'"
              type="primary"
              size="small"
              :loading="executingIds.has((row as BazhuayuTaskMapItem).id)"
              @click.stop="executeTask(row as BazhuayuTaskMapItem)"
              >请求卖家精灵</el-button
            >
            <!-- 导入阶段控制：暂停(运行中) / 继续(暂停·中断·失败) / 重新获取(终态) -->
            <el-button
              v-if="['RUNNING', 'DRAINING'].includes((row as BazhuayuTaskMapItem).status)"
              type="warning"
              link
              size="small"
              :loading="controlIds.has((row as BazhuayuTaskMapItem).id)"
              @click.stop="pauseImportTask(row as BazhuayuTaskMapItem)"
              >暂停</el-button
            >
            <el-button
              v-if="['PAUSED', 'INTERRUPTED', 'ERROR'].includes((row as BazhuayuTaskMapItem).status) && !hasSellerSpriteRun(row as BazhuayuTaskMapItem)"
              type="primary"
              link
              size="small"
              :loading="controlIds.has((row as BazhuayuTaskMapItem).id)"
              @click.stop="resumeImportTask(row as BazhuayuTaskMapItem)"
              >继续</el-button
            >
            <el-button
              v-if="['READY', 'DONE', 'PAUSED', 'INTERRUPTED', 'ERROR'].includes((row as BazhuayuTaskMapItem).status) && !hasSellerSpriteRun(row as BazhuayuTaskMapItem)"
              type="success"
              link
              size="small"
              :loading="controlIds.has((row as BazhuayuTaskMapItem).id)"
              @click.stop="refetchImportTask(row as BazhuayuTaskMapItem)"
              >重新获取</el-button
            >
            <el-button
              type="danger"
              link
              size="small"
              :disabled="['QUEUED', 'RUNNING', 'DRAINING'].includes((row as BazhuayuTaskMapItem).status) || hasSellerSpriteRun(row as BazhuayuTaskMapItem)"
              @click.stop="deleteImportTask(row as BazhuayuTaskMapItem)"
            >删除任务</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!refreshing && !filteredHistory.length"
        :description="scope === 'week' ? '本周暂无任务' : '暂无历史任务'"
      />
    </el-card>

    <!--
      任务映射配置抽屉
      - 表格展示 function+marketplace 全量 + 云端行数 + 本地入库行数 + 上次同步
      - 支持行内编辑保存 / 删除 / 底部新增
      - fromDb=false 时提示当前是走 env 兜底
    -->
    <el-drawer
      v-model="mappingDrawerVisible"
      size="1180px"
      title="八爪鱼任务映射配置"
      @open="loadMappingPanel"
    >
      <div class="mapping-drawer">
        <div class="mapping-head">
          <el-tag :type="mappingFromDb ? 'warning' : 'info'" size="small">
            {{
              mappingFromDb
                ? "当前来自 DB (覆盖 dev.env)"
                : "当前来自 dev.env (未持久化到 DB)"
            }}
          </el-tag>
          <div class="mapping-actions">
            <el-button
              size="small"
              type="primary"
              :loading="triggeringAll"
              @click="triggerAllImport"
            >
              一键导入全部DB
            </el-button>
            <el-button
              size="small"
              :loading="cloudRefreshing"
              @click="refreshAllCloudStats"
            >
              刷新最新云采集批次
            </el-button>
            <el-button size="small" @click="startNewMappingRow">
              新增映射
            </el-button>
          </div>
        </div>

        <el-collapse v-model="openCategories" v-loading="mappingLoading">
        <el-collapse-item
          v-for="group in mappingGroups"
          :key="group.category"
          :name="group.category"
        >
          <template #title>
            <el-icon class="folder-icon"><Folder /></el-icon>
            <span class="folder-title">{{ group.category }}</span>
            <span class="folder-count">{{ group.rows.length }} 个任务</span>
          </template>
        <el-table
          :data="group.rows"
          border
          size="small"
          row-key="key"
        >
          <el-table-column label="任务名称" width="170">
            <template #default="{ row }">
              <el-input
                v-if="row._editing"
                v-model="row.taskName"
                size="small"
                maxlength="60"
                show-word-limit
                placeholder="任务名称"
              />
              <span v-else>{{ row.taskName }}</span>
            </template>
          </el-table-column>
          <el-table-column label="功能类型" width="120">
            <template #default="{ row }">
              <el-select
                v-if="row._editing"
                v-model="row.function"
                size="small"
                :disabled="!row._isNew"
                style="width: 100%"
              >
                <el-option label="榜单 bangdan" value="bangdan" />
                <el-option label="以图识图 yitushitu" value="yitushitu" />
              </el-select>
              <span v-else>{{ functionLabel(row.function) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="站点" width="100">
            <template #default="{ row }">
              <el-select
                v-if="row._editing"
                v-model="row.marketplace"
                size="small"
                :disabled="!row._isNew"
                style="width: 100%"
              >
                <el-option label="US" value="US" />
                <el-option label="UK" value="UK" />
                <el-option label="DE" value="DE" />
              </el-select>
              <span v-else>{{ row.marketplace }}</span>
            </template>
          </el-table-column>
          <el-table-column label="分类" width="130">
            <template #default="{ row }">
              <el-input
                v-if="row._editing"
                v-model="row.taskCategory"
                size="small"
                maxlength="32"
                placeholder="如：精铺/精品"
              />
              <el-tag v-else size="small">{{ row.taskCategory }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="初筛" width="110" align="center">
            <template #default="{ row }">
              <el-switch
                v-if="row._editing && row.function === 'bangdan'"
                v-model="row.initialFilter"
                size="small"
                inline-prompt
                active-text="是"
                inactive-text="否"
              />
              <el-tag v-else-if="row.function !== 'bangdan'" type="info" size="small">不适用</el-tag>
              <el-tag v-else-if="row.initialFilter" type="success" size="small">初筛</el-tag>
              <el-tag v-else type="warning" size="small">直入精品</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="taskId" min-width="290">
            <template #default="{ row }">
              <el-input
                v-if="row._editing"
                v-model="row.taskId"
                size="small"
                placeholder="八爪鱼任务 ID"
              />
              <code v-else class="task-id">{{ row.taskId }}</code>
            </template>
          </el-table-column>
          <el-table-column label="最新云采集批次" width="300">
            <template #default="{ row }">
              <span v-if="row._isNew" class="muted">—</span>
              <div v-else-if="row.cloudStat?.latestBatchNo" class="latest-batch">
                <div class="latest-batch__head">
                  <el-tag type="warning" effect="dark" size="small">
                    {{ row.cloudStat.latestBatchNo }}
                  </el-tag>
                  <strong>{{
                    (row.cloudStat.latestBatchCount ?? 0).toLocaleString()
                  }} 条</strong>
                  <span
                    v-if="row.cloudStat.cloudStatus"
                    :class="cloudStatusTone(row.cloudStat.cloudStatus)"
                    >{{ row.cloudStat.cloudStatus }}</span
                  >
                </div>
                <div class="latest-batch__time">
                  {{ formatTs(row.cloudStat.latestBatchStartTime) }}
                  <span>→</span>
                  {{ formatBatchEnd(row.cloudStat.latestBatchEndTime) }}
                </div>
              </div>
              <span v-else-if="row.cloudStat" class="muted">尚无云采集历史</span>
              <span v-else class="muted">未同步</span>
            </template>
          </el-table-column>
          <el-table-column label="上次同步" width="170">
            <template #default="{ row }">
              <span v-if="row._isNew" class="muted">—</span>
              <span v-else-if="row.cloudStat?.lastSyncAt">{{
                formatTs(row.cloudStat.lastSyncAt)
              }}</span>
              <span v-else class="muted">—</span>
              <el-tooltip
                v-if="row.cloudStat?.lastError"
                :content="row.cloudStat.lastError"
                placement="top"
              >
                <el-icon class="danger" style="margin-left: 4px"
                  ><Warning
                /></el-icon>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="配置" width="150" fixed="right">
            <template #default="{ row }">
              <template v-if="row._editing">
                <el-button
                  type="primary"
                  size="small"
                  :loading="row._saving"
                  @click="saveMappingRow(row as MappingRow)"
                  >保存</el-button
                >
                <el-button
                  size="small"
                  @click="cancelMappingRow(row as MappingRow)"
                  >取消</el-button
                >
              </template>
              <template v-else>
                <el-button
                  size="small"
                  @click="editMappingRow(row as MappingRow)"
                  >改</el-button
                >
                <el-button
                  size="small"
                  :loading="row._refreshing"
                  @click="refreshOneCloudStat(row as MappingRow)"
                  >刷云端</el-button
                >
                <el-button
                  type="danger"
                  size="small"
                  :loading="row._deleting"
                  @click="deleteMappingRow(row as MappingRow)"
                  >删</el-button
                >
              </template>
            </template>
          </el-table-column>
          <el-table-column label="采集操作" width="280" fixed="right">
            <template #default="{ row }">
              <!--
                只有榜单(bangdan)接进了 trigger/start-collect 全流程；以图识图目前只支持
                独立的 /image-search 单条调用，不适用这组按钮，所以其他行做灰化。
              -->
              <template v-if="row._isNew || row._editing">
                <span class="muted">保存后可用</span>
              </template>
              <template v-else-if="row.function === 'bangdan'">
                <el-button
                  type="primary"
                  size="small"
                  :loading="row._importing"
                  :disabled="!canImportBatch(row as MappingRow)"
                  @click="importToDb(row as MappingRow)"
                  >导入DB</el-button
                >
                <el-button
                  size="small"
                  :loading="row._starting"
                  @click="startCloudCollect(row as MappingRow)"
                  >启动云端</el-button
                >
                <el-button
                  type="danger"
                  size="small"
                  plain
                  :loading="row._stopping"
                  @click="stopCloudCollect(row as MappingRow)"
                  >停止</el-button
                >
              </template>
              <template v-else>
                <span class="muted">仅榜单支持</span>
              </template>
            </template>
          </el-table-column>
        </el-table>
        </el-collapse-item>
        </el-collapse>

        <el-empty
          v-if="!mappingLoading && !mappingRows.length"
          description="未配置任何映射，点右上角新增"
        />
      </div>
    </el-drawer>

    <el-drawer v-model="detailVisible" size="480px" title="批次详情">
      <div v-if="detailRow" class="detail-grid">
        <div>
          <span>站点</span><strong>{{ detailRow.marketplace }}</strong>
        </div>
        <div>
          <span>任务</span><strong>{{ detailRow.taskName || `#${detailRow.id}` }}</strong>
        </div>
        <div>
          <span>分类</span><strong>{{ detailRow.taskCategory || "未分类" }}</strong>
        </div>
        <div>
          <span>是否初筛</span><strong>{{ detailRow.initialFilter ? "是" : "否" }}</strong>
        </div>
        <div>
          <span>结果库</span><strong>{{ detailRow.targetTable === "premium_products" ? "精品独立表" : "新品榜表" }}</strong>
        </div>
        <div>
          <span>状态</span><strong>{{ displayStatusText(detailRow) }}</strong>
        </div>
        <div>
          <span>总数</span><strong>{{ detailRow.totalCount || 0 }}</strong>
        </div>
        <div>
          <span>通过（等待人工请求）</span
          ><strong class="ok">{{ detailRow.passCount || 0 }}</strong>
        </div>
        <template v-if="detailRow.passRefetchCount != null || detailRow.passNewCount != null">
          <div>
            <span>· 新品重取</span
            ><strong>{{ detailRow.passRefetchCount || 0 }}</strong>
          </div>
          <div>
            <span>· 全新通过</span
            ><strong>{{ detailRow.passNewCount || 0 }}</strong>
          </div>
        </template>
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
        <template v-if="detailRow.skipMainCount != null || detailRow.skipBlacklistCount != null">
          <div>
            <span>主表已有(去重)</span
            ><strong>{{ detailRow.skipMainCount || 0 }}</strong>
          </div>
          <div>
            <span>已采过淘汰</span
            ><strong>{{ detailRow.skipBlacklistCount || 0 }}</strong>
          </div>
        </template>
        <div v-else>
          <span>已采过 / 黑名单</span
          ><strong>{{ detailRow.skipCount || 0 }}</strong>
        </div>
        <div class="section">卖家精灵调用</div>
        <div>
          <span>成功</span
          ><strong class="ok">{{ displayApiSuccess(detailRow) }}</strong>
        </div>
        <div>
          <span>失败</span
          ><strong :class="{ danger: displayApiFail(detailRow) }">{{
            displayApiFail(detailRow)
          }}</strong>
        </div>
        <div>
          <span>请求次数</span
          ><strong>{{ displayRequestCount(detailRow) }}</strong>
        </div>
        <div>
          <span>批次进度</span
          ><strong
            >{{ displayBatchCurrent(detailRow) }} /
            {{ displayBatchTotal(detailRow) }}</strong
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
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { Warning, Folder } from "@element-plus/icons-vue";
import {
  bazhuayuApi,
  type BazhuayuCloudStat,
  type BazhuayuOverviewResp,
  type BazhuayuPhase,
  type BazhuayuRunState,
  type BazhuayuTaskEntry,
  type BazhuayuTaskMapItem,
} from "@/api/bazhuayu";
import { requestCenterApi } from "@/api/shopPremium";

type Scope = "week" | "lifetime";

const router = useRouter();
const marketplace = ref("");
const refreshing = ref(false);
const triggeringAll = ref(false);
const weekTag = ref("");
const weekStart = ref("");
const overview = ref<BazhuayuOverviewResp | null>(null);
const runStates = ref<BazhuayuRunState[]>([]);
const scope = ref<Scope>("week");
const categoryFilter = ref<string>("");
const detailVisible = ref(false);
const detailRow = ref<BazhuayuTaskMapItem | null>(null);
/** 正在执行的 taskId 集合，用于按钮 loading */
const executingIds = ref<Set<number>>(new Set());
/** 正在暂停/续跑/重新获取的 taskId 集合，用于按钮 loading */
const controlIds = ref<Set<number>>(new Set());

/** === 任务映射配置面板状态 === */
const mappingDrawerVisible = ref(false);
const mappingLoading = ref(false);
const mappingFromDb = ref(false);
const cloudRefreshing = ref(false);
/** 面板表格行：每条 (function+marketplace) 一行；含云端快照 + 编辑态标志 */
interface MappingRow {
  /** 表格 row-key: function:marketplace，新建时是 __new__:index */
  key: string;
  id: number | null;
  function: string;
  marketplace: string;
  taskId: string;
  taskName: string;
  taskCategory: string;
  initialFilter: boolean;
  cloudStat: BazhuayuCloudStat | null;
  /** 是否编辑态；新增行默认 true */
  _editing: boolean;
  /** 是否新增行（用于把 function+marketplace 变成不可改） */
  _isNew: boolean;
  /** 编辑前的原值，取消时还原 */
  _snapshot?: {
    function: string;
    marketplace: string;
    taskId: string;
    taskName: string;
    taskCategory: string;
    initialFilter: boolean;
  };
  _saving?: boolean;
  _deleting?: boolean;
  _refreshing?: boolean;
  _importing?: boolean;
  _starting?: boolean;
  _stopping?: boolean;
}
const mappingRows = ref<MappingRow[]>([]);
/** 映射配置面板：当前展开的分类文件夹（默认全展开）。 */
const openCategories = ref<string[]>([]);

/** 分类排序优先级：精铺 → 精品 → 以图识图 → 其它（按名）。 */
const CATEGORY_ORDER = ["精铺", "精品", "以图识图"];
function categoryRank(c: string): number {
  const i = CATEGORY_ORDER.indexOf(c);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

/** 按分类分组的映射行（文件夹式折叠用）。 */
const mappingGroups = computed(() => {
  const groups = new Map<string, MappingRow[]>();
  for (const row of mappingRows.value) {
    const c = row.taskCategory?.trim() || "未分类";
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c)!.push(row);
  }
  return Array.from(groups.entries())
    .map(([category, rows]) => ({ category, rows }))
    .sort(
      (a, b) =>
        categoryRank(a.category) - categoryRank(b.category) ||
        a.category.localeCompare(b.category),
    );
});

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

/**
 * 本周原始量：跨站点汇总"本周任务 total_count"。
 * 旧口径按 bazhuayu_weekly_raw.week_tag 过滤，会因周日采集打上上周 tag 而漏计；
 * 新口径按 asin_import_tasks.created_at 落本周判定，与"本周任务"列同源。
 */
const weeklyRawTotalCount = computed(
  () =>
    overview.value?.weekTasks?.reduce((s, t) => s + (t.totalCount || 0), 0) ??
    0,
);

/** 本周段：createdAt >= 本周一 00:00 的任务口径 */
const weekMetrics = computed(() => [
  {
    label: "本周原始量",
    value: weeklyRawTotalCount.value.toLocaleString(),
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

/** 当前 scope 下出现过的分类（供筛选下拉）。 */
const categoryOptions = computed(() => {
  const src =
    scope.value === "week"
      ? (overview.value?.weekTasks ?? [])
      : (overview.value?.lifetimeTasks ?? []);
  const set = new Set<string>();
  for (const t of src) set.add(t.taskCategory || "未分类");
  return Array.from(set).sort();
});

const filteredHistory = computed(() => {
  const src =
    scope.value === "week"
      ? (overview.value?.weekTasks ?? [])
      : (overview.value?.lifetimeTasks ?? []);
  return src.filter(
    (t) =>
      (!marketplace.value || t.marketplace === marketplace.value) &&
      (!categoryFilter.value ||
        (t.taskCategory || "未分类") === categoryFilter.value),
  );
});

const scopeCount = computed(() => filteredHistory.value.length);

/** 各分类计数（分组概览小标签）——只按 scope+站点，不受分类筛选影响，点标签可切换筛选。 */
const categoryCounts = computed(() => {
  const src =
    scope.value === "week"
      ? (overview.value?.weekTasks ?? [])
      : (overview.value?.lifetimeTasks ?? []);
  const counts = new Map<string, number>();
  for (const t of src) {
    if (marketplace.value && t.marketplace !== marketplace.value) continue;
    const c = t.taskCategory || "未分类";
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
});

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
        QUEUED: "排队中",
        READY: "待确认",
        RUNNING: "运行中",
        DRAINING: "入库中",
        DONE: "完成",
        ERROR: "失败",
        INTERRUPTED: "已中断",
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
  if (status === "ERROR" || status === "INTERRUPTED") return "danger";
  if (status === "RUNNING" || status === "QUEUED") return "warning";
  if (status === "DRAINING") return "primary";
  return "info";
}

function sellerSpriteRun(row: BazhuayuTaskMapItem) {
  return row.sellerSpriteRun || null;
}

function hasSellerSpriteRun(row: BazhuayuTaskMapItem) {
  return sellerSpriteRun(row) !== null;
}

function displayStatusText(row: BazhuayuTaskMapItem) {
  const run = sellerSpriteRun(row);
  if (!run) return statusText(row.status);
  return (
    {
      PENDING: "卖家精灵待执行",
      RUNNING: "卖家精灵执行中",
      PAUSED: "卖家精灵已暂停",
      PAUSED_SYSTEM: "卖家精灵系统暂停",
      SUCCESS: "卖家精灵已完成",
      PARTIAL_SUCCESS: "卖家精灵部分成功",
      FAILED: "卖家精灵执行失败",
      STOPPED: "卖家精灵已停止",
    } as Record<string, string>
  )[run.status] || run.status;
}

function displayStatusTag(
  row: BazhuayuTaskMapItem,
): "primary" | "success" | "warning" | "info" | "danger" {
  const run = sellerSpriteRun(row);
  if (!run) return statusTag(row.status);
  if (run.status === "SUCCESS") return "success";
  if (run.status === "FAILED") return "danger";
  if (run.status === "PARTIAL_SUCCESS" || run.status === "PAUSED" || run.status === "PAUSED_SYSTEM") return "warning";
  if (run.status === "RUNNING") return "primary";
  return "info";
}

function displayCompletedAt(row: BazhuayuTaskMapItem) {
  const runFinishedAt = sellerSpriteRun(row)?.finishedAt;
  if (runFinishedAt) return formatTs(runFinishedAt);
  const terminalStatuses = ["READY", "DONE", "ERROR", "INTERRUPTED", "REJECTED", "CANCELLED"];
  return terminalStatuses.includes(row.status) ? formatTs(row.completedAt) : "—";
}

function displayApiSuccess(row: BazhuayuTaskMapItem) {
  return sellerSpriteRun(row)?.successCount ?? row.apiSuccess ?? 0;
}

function displayApiFail(row: BazhuayuTaskMapItem) {
  return sellerSpriteRun(row)?.failedCount ?? row.apiFail ?? 0;
}

function displayRequestCount(row: BazhuayuTaskMapItem) {
  return sellerSpriteRun(row)?.apiCalls ?? row.apiRequestsUsed ?? 0;
}

function displayBatchCurrent(row: BazhuayuTaskMapItem) {
  const run = sellerSpriteRun(row);
  if (!run) return row.batchCurrent || 0;
  return (run.successCount || 0) + (run.failedCount || 0) + (run.skippedCount || 0) + (run.runningCount || 0);
}

function displayBatchTotal(row: BazhuayuTaskMapItem) {
  return sellerSpriteRun(row)?.totalCount ?? row.batchTotal ?? 0;
}

function openSellerSpriteRun(row: BazhuayuTaskMapItem) {
  const run = sellerSpriteRun(row);
  if (!run) return;
  router.push({
    name: "module-sellersprite-request-center-SellerspriteRequestCenter",
    query: { runId: run.runId },
  });
}

/**
 * 未通过原因分解：把各类不通过来源拆成独立、含义明确的芯片。
 * 后端源：AsinImportService (priceFail/reviewFail/duplicate/skipMain/skipBlacklist)。
 * 「已采过/黑名单」拆成两类：
 *   - 主表已有 = SKIP_MAIN（competitor_products 已入库，去重跳过）
 *   - 已采过淘汰 = SKIP_BLACKLIST（skip_asins 命中且非新品重取候选，如上架≥30天）
 * 旧数据无分列（skipMainCount/skipBlacklistCount 为 null）时回退显示合并的「已采过/黑名单」。
 */
function failureBreakdown(row: BazhuayuTaskMapItem) {
  const chips: Array<{ label: string; value: number; tone: string }> = [];
  if (row.priceFailCount)
    chips.push({ label: "价格不符", value: row.priceFailCount, tone: "warning" });
  if (row.reviewFailCount)
    chips.push({ label: "评论超标", value: row.reviewFailCount, tone: "warning" });
  if (row.duplicateCount)
    chips.push({ label: "文件内重复", value: row.duplicateCount, tone: "info" });

  const hasSplit =
    row.skipMainCount != null || row.skipBlacklistCount != null;
  if (hasSplit) {
    if (row.skipMainCount)
      chips.push({ label: "主表已有", value: row.skipMainCount, tone: "info" });
    if (row.skipBlacklistCount)
      chips.push({ label: "已采过淘汰", value: row.skipBlacklistCount, tone: "info" });
  } else if (row.skipCount) {
    chips.push({ label: "已采过/黑名单", value: row.skipCount, tone: "info" });
  }
  return chips;
}

/**
 * 通过原因分解：把 PASS 拆成两类含义明确的芯片。
 * 后端源：filterRows 的 _passKind（REFETCH/NEW）。
 *   - 新品重取 = 已采过但主表<30天，重新去卖家精灵取（会重复消耗 API，值得盯）
 *   - 全新通过 = 从没见过的 ASIN
 * 旧数据无分列（passRefetchCount/passNewCount 为 null）时回退显示合并的「通过」。
 */
function passBreakdown(row: BazhuayuTaskMapItem) {
  const chips: Array<{ label: string; value: number; tone: string }> = [];
  const hasSplit =
    row.passRefetchCount != null || row.passNewCount != null;
  if (hasSplit) {
    if (row.passRefetchCount)
      chips.push({ label: "新品重取", value: row.passRefetchCount, tone: "refetch" });
    if (row.passNewCount)
      chips.push({ label: "全新通过", value: row.passNewCount, tone: "ok" });
  } else if (row.passCount) {
    chips.push({ label: "通过", value: row.passCount, tone: "ok" });
  }
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
 * 触发卖家精灵调用：对 READY 任务创建请求中心 ASIN_BATCH_LOOKUP 任务，
 * 由请求中心统一调度、跟踪进度、支持暂停重试。
 * 旧 /asin-import/execute 暂保留兼容，新链路走请求中心。
 */
async function executeTask(row: BazhuayuTaskMapItem) {
  const db = overview.value?.datasource;
  const dbLabel = db ? `${db.database} @ ${db.host}:${db.port}` : "当前数据库";
  try {
    await ElMessageBox.confirm(
      `任务：${row.taskName || `#${row.id}`}\n分类：${row.taskCategory || "未分类"}\n初筛：${row.initialFilter ? "是" : "否（全部 ASIN）"}\n预计批次：${row.batchTotal || 0}\n结果写入：${row.targetTable === "premium_products" ? "精品独立表" : "新品榜表"}\n数据库：${dbLabel}\n\n只有确认后才会调用卖家精灵，是否继续？`,
      "确认执行",
      { type: "warning", confirmButtonText: "执行", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  executingIds.value.add(row.id);
  try {
    const run = await requestCenterApi.createFromStreaming(row.id);
    ElMessage.success(`请求中心任务已创建: ${run.runId}，正在自动执行`);
    // 跳转到请求中心页面并定位到新创建的任务
    router.push({
      name: "module-sellersprite-request-center-SellerspriteRequestCenter",
      query: { runId: run.runId },
    });
  } catch (e: any) {
    ElMessage.error(e?.message || "创建请求中心任务失败");
  } finally {
    executingIds.value.delete(row.id);
  }
}

async function deleteImportTask(row: BazhuayuTaskMapItem) {
  if (["QUEUED", "RUNNING", "DRAINING"].includes(row.status) || hasSellerSpriteRun(row)) return;
  try {
    await ElMessageBox.confirm(
      `确定删除任务「${row.taskName || `#${row.id}`}」吗？\n\n将删除任务记录、ASIN 明细及该批次写入的八爪鱼原始/去重数据，使对应批次可以真正重新导入；已关联卖家精灵请求的任务不能删除。`,
      "删除导入任务",
      {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        confirmButtonClass: "el-button--danger",
      },
    );
  } catch {
    return;
  }
  try {
    await bazhuayuApi.deleteTask(row.id);
    ElMessage.success("任务已删除，可以重新导入该批次");
    if (detailRow.value?.id === row.id) detailVisible.value = false;
    await loadOverview();
  } catch (e: any) {
    ElMessage.error(e?.message || "删除任务失败");
  }
}

/** 暂停正在导入的任务：停在当前进度，可续跑。 */
async function pauseImportTask(row: BazhuayuTaskMapItem) {
  controlIds.value.add(row.id);
  try {
    await bazhuayuApi.pauseImport(row.id);
    ElMessage.success("已请求暂停，处理完当前页后停在断点");
    await loadOverview();
    syncPolling();
  } catch (e: any) {
    ElMessage.error(e?.message || "暂停失败");
  } finally {
    controlIds.value.delete(row.id);
  }
}

/** 续跑 PAUSED/中断/失败任务：从断点 offset 继续同批次。 */
async function resumeImportTask(row: BazhuayuTaskMapItem) {
  controlIds.value.add(row.id);
  try {
    await bazhuayuApi.resumeImport(row.id);
    ElMessage.success("已从断点续跑");
    await loadOverview();
    syncPolling();
  } catch (e: any) {
    ElMessage.error(e?.message || "续跑失败");
  } finally {
    controlIds.value.delete(row.id);
  }
}

/** 重新获取：删旧任务数据后重拉云端最新批次。 */
async function refetchImportTask(row: BazhuayuTaskMapItem) {
  try {
    await ElMessageBox.confirm(
      `将删除任务「${row.taskName || `#${row.id}`}」已导入的数据（明细/去重/原始行），` +
        "再按同配置重新拉取云端当前最新批次并初筛。是否继续？",
      "确认重新获取",
      { type: "warning", confirmButtonText: "重新获取", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  controlIds.value.add(row.id);
  try {
    const resp: any = await bazhuayuApi.refetchImport(row.id);
    ElMessage.success(`已重新触发，新任务 #${resp?.newTaskId ?? "?"}`);
    if (detailRow.value?.id === row.id) detailVisible.value = false;
    await loadOverview();
    syncPolling();
  } catch (e: any) {
    ElMessage.error(e?.message || "重新获取失败");
  } finally {
    controlIds.value.delete(row.id);
  }
}

function openDetail(row: BazhuayuTaskMapItem) {
  detailRow.value = row;
  detailVisible.value = true;
}

let loading = false; // 请求在途锁，避免轮询与手动刷新重叠

async function loadOverview() {
  if (loading) return;
  loading = true;
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
    syncPolling();
  } catch (e: any) {
    ElMessage.error(e?.message || "加载八爪鱼总览失败");
  } finally {
    refreshing.value = false;
    loading = false;
  }
}

const POLL_INTERVAL_MS = 3000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** 是否存在处理中的任务：DB 任务处于 RUNNING/DRAINING，或内存运行态处于运行段 */
function hasActiveWork(): boolean {
  const tasks = overview.value?.lifetimeTasks ?? [];
  const taskActive = tasks.some(
    (t) => t.status === "RUNNING" || t.status === "DRAINING"
      || ["PENDING", "RUNNING", "PAUSED_SYSTEM"].includes(t.sellerSpriteRun?.status || ""),
  );
  const stateActive = runStates.value.some((s) =>
    RUNNING_PHASES.includes(s.phase),
  );
  return taskActive || stateActive;
}

const POST_TRIGGER_POLL_MS = 60_000;
let postTriggerPollUntil = 0;
let postTriggerTaskId: number | null = null;
let postTriggerStopTimer: ReturnType<typeof setTimeout> | null = null;

function recentlyQueuedTask(): boolean {
  const now = Date.now();
  return (overview.value?.lifetimeTasks ?? []).some((task) => {
    if (task.status !== "QUEUED") return false;
    const createdAt = Date.parse(task.createdAt);
    return Number.isFinite(createdAt) && now - createdAt < POST_TRIGGER_POLL_MS;
  });
}

function hasPostTriggerPolling(): boolean {
  if (!postTriggerTaskId || Date.now() >= postTriggerPollUntil) {
    postTriggerTaskId = null;
    postTriggerPollUntil = 0;
    return recentlyQueuedTask();
  }
  const task = overview.value?.lifetimeTasks.find((t) => t.id === postTriggerTaskId);
  if (task && task.status !== "QUEUED") {
    postTriggerTaskId = null;
    postTriggerPollUntil = 0;
    return false;
  }
  return true;
}

function startPostTriggerPolling(taskId: number) {
  postTriggerTaskId = taskId;
  postTriggerPollUntil = Date.now() + POST_TRIGGER_POLL_MS;
  if (postTriggerStopTimer) clearTimeout(postTriggerStopTimer);
  postTriggerStopTimer = setTimeout(() => {
    postTriggerTaskId = null;
    postTriggerPollUntil = 0;
    postTriggerStopTimer = null;
    syncPolling();
  }, POST_TRIGGER_POLL_MS);
  syncPolling();
}

/** 有处理中任务或刚提交的目标任务时开轮询，结束或超过等待上限则停。 */
function syncPolling() {
  if (hasActiveWork() || hasPostTriggerPolling()) {
    if (!pollTimer) {
      pollTimer = setInterval(loadOverview, POLL_INTERVAL_MS);
    }
  } else if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ==================== 任务映射配置抽屉 ====================

/** 打开抽屉时按钮触发的桩，实际加载在 @open 里 */
function openMappingDrawer() {
  mappingDrawerVisible.value = true;
}

const FUNCTION_LABEL: Record<string, string> = {
  bangdan: "榜单采集",
  yitushitu: "以图识图",
};
function functionLabel(fn: string) {
  return FUNCTION_LABEL[fn] || fn;
}

function cloudStatusTone(status: string) {
  if (status === "Finished") return "ok";
  if (status === "Stopped" || status === "Failed") return "danger";
  return "muted";
}

function formatTs(iso: string | null | undefined) {
  if (!iso) return "—";
  // 后端返回无时区 LocalDateTime，保持现有时区语义，仅统一到秒。
  const normalized = iso.replace("T", " ");
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)
    ? `${normalized}:00`
    : normalized.slice(0, 19);
}

function formatBatchEnd(iso: string | null) {
  if (!iso) return "进行中";
  return iso.replace("T", " ").slice(11, 19);
}

function canImportBatch(row: MappingRow) {
  const stat = row.cloudStat;
  return Boolean(
    stat?.latestBatchNo &&
      stat.latestBatchStartTime &&
      stat.cloudStatus === "Finished",
  );
}

/**
 * 抽屉打开时加载：映射 + 云端行数快照。
 * 快照未命中的行 cloudStat 就是 null（面板会展示"未同步"提示用户手动刷）。
 */
async function loadMappingPanel() {
  mappingLoading.value = true;
  try {
    const [mappingResp, refreshResp] = await Promise.all([
      bazhuayuApi.getMapping(),
      bazhuayuApi.refreshCloudStats().catch(() => null),
    ]);
    // 打开配置页即自动读取最新云采集批次；云端限流/已有刷新时回退进程内缓存。
    const statsResp = refreshResp?.snapshot ?? (await bazhuayuApi.cloudStats());
    mappingFromDb.value = mappingResp.fromDb;
    const entries: BazhuayuTaskEntry[] = Array.isArray(mappingResp.entries)
      ? mappingResp.entries
      : [];
    const rows: MappingRow[] = entries.map((entry) => ({
      key: String(entry.id),
      id: entry.id,
      function: entry.functionKey,
      marketplace: entry.marketplace,
      taskId: entry.taskId,
      taskName: entry.taskName,
      taskCategory: entry.taskCategory || "默认",
      initialFilter: entry.initialFilter !== false,
      cloudStat: statsResp[entry.taskId] ?? null,
      _editing: false,
      _isNew: false,
    }));
    mappingRows.value = rows;
    // 默认展开全部分类文件夹
    openCategories.value = Array.from(
      new Set(rows.map((r) => r.taskCategory?.trim() || "未分类")),
    );
  } catch (e: any) {
    ElMessage.error(e?.message || "加载映射失败");
  } finally {
    mappingLoading.value = false;
  }
}

/** 新增一行编辑态，插到表头方便看见 */
function startNewMappingRow() {
  mappingRows.value.unshift({
    key: `__new__:${Date.now()}`,
    id: null,
    function: "bangdan",
    marketplace: "US",
    taskId: "",
    taskName: "榜单采集",
    taskCategory: "精铺",
    initialFilter: true,
    cloudStat: null,
    _editing: true,
    _isNew: true,
  });
  // 确保新增行所在的分类文件夹是展开的（否则新行藏在折叠里看不见）
  if (!openCategories.value.includes("精铺")) openCategories.value.push("精铺");
}

function editMappingRow(row: MappingRow) {
  row._snapshot = {
    function: row.function,
    marketplace: row.marketplace,
    taskId: row.taskId,
    taskName: row.taskName,
    taskCategory: row.taskCategory,
    initialFilter: row.initialFilter,
  };
  row._editing = true;
}

function cancelMappingRow(row: MappingRow) {
  if (row._isNew) {
    mappingRows.value = mappingRows.value.filter((r) => r.key !== row.key);
    return;
  }
  if (row._snapshot) {
    row.function = row._snapshot.function;
    row.marketplace = row._snapshot.marketplace;
    row.taskId = row._snapshot.taskId;
    row.taskName = row._snapshot.taskName;
    row.taskCategory = row._snapshot.taskCategory;
    row.initialFilter = row._snapshot.initialFilter;
  }
  row._editing = false;
  row._snapshot = undefined;
}

/** 保存：调 POST /config/mapping/entry（upsert 语义） */
async function saveMappingRow(row: MappingRow) {
  if (!row.taskName?.trim() || !row.taskCategory?.trim() || !row.function || !row.marketplace || !row.taskId?.trim()) {
    ElMessage.warning("任务名称/分类/功能/站点/taskId 都必填");
    return;
  }
  row._saving = true;
  try {
    const saved = row._isNew
      ? await bazhuayuApi.createTaskEntry({
          function: row.function,
          marketplace: row.marketplace,
          taskId: row.taskId.trim(),
          taskName: row.taskName.trim(),
          taskCategory: row.taskCategory.trim(),
          initialFilter: row.initialFilter,
        })
      : await bazhuayuApi.updateTaskEntry(row.id!, {
          taskId: row.taskId.trim(),
          taskName: row.taskName.trim(),
          taskCategory: row.taskCategory.trim(),
          initialFilter: row.initialFilter,
        });
    ElMessage.success("已保存");
    row.taskId = row.taskId.trim();
    row.taskName = row.taskName.trim();
    row.taskCategory = row.taskCategory.trim();
    row.id = saved.id;
    row.initialFilter = saved.initialFilter !== false;
    mappingFromDb.value = true;
    row._editing = false;
    row._isNew = false;
    row._snapshot = undefined;
    row.key = String(saved.id);
    // 保存后单条刷云端行数，让面板立即显示新 taskId 的云端量
    await refreshOneCloudStat(row, { silent: true });
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败");
  } finally {
    row._saving = false;
  }
}

async function deleteMappingRow(row: MappingRow) {
  try {
    await ElMessageBox.confirm(
      `删除 ${row.taskName} · ${row.marketplace} 的任务映射？`,
      "确认删除",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  row._deleting = true;
  try {
    await bazhuayuApi.deleteTaskEntry(row.id!);
    mappingRows.value = mappingRows.value.filter((r) => r.key !== row.key);
    ElMessage.success("已删除");
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败");
  } finally {
    row._deleting = false;
  }
}

async function refreshOneCloudStat(
  row: MappingRow,
  opts: { silent?: boolean } = {},
) {
  if (row._isNew) return;
  row._refreshing = true;
  try {
    const resp = await bazhuayuApi.refreshCloudStats(
      row.function,
      row.marketplace,
      row.taskId,
    );
    if (resp.stat) row.cloudStat = resp.stat;
    if (!opts.silent) {
      if (resp.refreshed > 0) ElMessage.success("云端已刷");
      else ElMessage.warning(resp.stat?.lastError || "云端正在限流或刷新中，已保留上次数据");
    }
  } catch (e: any) {
    if (!opts.silent) ElMessage.error(e?.message || "刷新失败");
  } finally {
    row._refreshing = false;
  }
}

async function refreshAllCloudStats() {
  cloudRefreshing.value = true;
  try {
    const resp = await bazhuayuApi.refreshCloudStats();
    if (resp.snapshot) {
      // 把最新云端快照映射回每一行
      for (const row of mappingRows.value) {
        row.cloudStat =
          resp.snapshot[row.taskId] ?? row.cloudStat;
      }
    }
    if (resp.refreshed > 0) ElMessage.success(`已刷 ${resp.refreshed} 条`);
    else ElMessage.warning("云端正在限流或已有刷新任务，已保留上次数据，请稍后再试");
  } catch (e: any) {
    ElMessage.error(e?.message || "刷新失败");
  } finally {
    cloudRefreshing.value = false;
  }
}

// ==================== 采集操作 (导入DB / 启动云端 / 停止云端) ====================

/**
 * 导入云端已采数据到本地 DB。
 * 后端接口 POST /trigger 是异步 fire-and-forget，前端立即返回；
 * 用户看进度靠"当前运行"段（内存态）+ 主页面刷新。
 */
/** 一键全导：后端遍历所有榜单任务，各自锁定最新批次异步入库。 */
async function triggerAllImport() {
  try {
    await ElMessageBox.confirm(
      "将遍历全部榜单任务，各自锁定当前最新已完成批次后异步导入并初筛。\n" +
        "已导入的批次会自动跳过，中断的任务会重跑。是否继续？",
      "确认一键全导",
      { type: "warning", confirmButtonText: "开始", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  triggeringAll.value = true;
  try {
    const resp = await bazhuayuApi.triggerAll();
    const parts = [`共 ${resp.total} 个任务`];
    if (resp.submitted) parts.push(`提交 ${resp.submitted}`);
    if (resp.alreadyImported) parts.push(`已导入 ${resp.alreadyImported}`);
    if (resp.failed) parts.push(`失败 ${resp.failed}`);
    if (resp.failed > 0) {
      ElMessage.warning(parts.join(" · "));
    } else {
      ElMessage.success(parts.join(" · "));
    }
    scope.value = "week";
    await loadOverview();
    syncPolling();
  } catch (e: any) {
    ElMessage.error(e?.message || "一键全导失败");
  } finally {
    triggeringAll.value = false;
  }
}

async function importToDb(row: MappingRow) {
  const batch = row.cloudStat;
  if (!batch?.latestBatchNo || !batch.latestBatchStartTime) {
    ElMessage.warning("请先刷新最新云采集批次");
    return;
  }
  if (batch.cloudStatus !== "Finished") {
    ElMessage.warning(`批次 ${batch.latestBatchNo} 尚未完成，暂不能导入`);
    return;
  }
  try {
    const batchSummary = `最新批次：${batch.latestBatchNo}\n时间：${formatTs(batch.latestBatchStartTime)} → ${formatTs(batch.latestBatchEndTime)}\n本批次数量：${(batch.latestBatchCount || 0).toLocaleString()} 条`;
    await ElMessageBox.confirm(
      row.initialFilter
        ? `任务：${row.taskName}\n${batchSummary}\n\n只导入上面显示的批次，并执行现有初筛。是否继续？`
        : `任务：${row.taskName}\n${batchSummary}\n\n只导入上面显示的批次；全部合法唯一 ASIN 生成待请求任务，不初筛、不自动调用卖家精灵。是否继续？`,
      `确认导入批次 ${batch.latestBatchNo}`,
      {
        type: "warning",
        confirmButtonText: "开始导入",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  row._importing = true;
  try {
    const resp = await bazhuayuApi.trigger(
      row.marketplace,
      row.taskId,
      row.function,
      batch,
    );
    if (resp.alreadyImported) {
      ElMessage.info(`批次 ${resp.batchNo} 已存在，已定位任务 #${resp.taskId}`);
    } else {
      ElMessage.success(`导入请求已提交，正在创建任务 #${resp.taskId}`);
      if (resp.taskId) startPostTriggerPolling(resp.taskId);
    }
    scope.value = "week";
    await loadOverview();
  } catch (e: any) {
    ElMessage.error(e?.message || "导入失败");
  } finally {
    row._importing = false;
  }
}

/** 启动云端一条龙：云端启动 → 等待采完 → drain 入库（长时间异步） */
async function startCloudCollect(row: MappingRow) {
  try {
    await ElMessageBox.confirm(
      row.initialFilter
        ? `将启动「${row.taskName}」云端采集，完成后自动导入并初筛。全流程可能耗时数十分钟。是否继续？`
        : `将启动「${row.taskName}」云端采集，完成后跳过初筛，只生成待请求任务，不会自动调用卖家精灵。是否继续？`,
      "确认启动云端",
      {
        type: "warning",
        confirmButtonText: "启动",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  row._starting = true;
  try {
    const resp = await bazhuayuApi.startCollect(
      row.function,
      row.marketplace,
      row.taskId,
    );
    if (resp.skipped?.length) {
      ElMessage.warning(
        `${resp.skipped.join(",")} 已在运行，跳过；已启动 ${resp.accepted?.length || 0} 站`,
      );
    } else if (resp.missing?.length) {
      ElMessage.error(`${resp.missing.join(",")} 未配置 taskId`);
    } else {
      ElMessage.success(
        `已启动 ${resp.accepted?.join(",") || row.marketplace}`,
      );
    }
    await loadOverview();
  } catch (e: any) {
    ElMessage.error(e?.message || "启动失败");
  } finally {
    row._starting = false;
  }
}

async function stopCloudCollect(row: MappingRow) {
  try {
    await ElMessageBox.confirm(
      `停止「${row.marketplace}」的云端采集？（协作式取消 + 调云端 stopExtraction）`,
      "确认停止",
      {
        type: "warning",
        confirmButtonText: "停止",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  row._stopping = true;
  try {
    const resp = await bazhuayuApi.stopCollect(
      row.function,
      row.marketplace,
      row.taskId,
    );
    if (resp.stopped) {
      ElMessage.success(`已请求停止 ${resp.marketplace}`);
    } else {
      ElMessage.warning(resp.cloudStopError || "停止请求已发出");
    }
    await loadOverview();
  } catch (e: any) {
    ElMessage.error(e?.message || "停止失败");
  } finally {
    row._stopping = false;
  }
}

onMounted(loadOverview);
onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (postTriggerStopTimer) {
    clearTimeout(postTriggerStopTimer);
    postTriggerStopTimer = null;
  }
});
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
  flex-wrap: wrap;
  gap: 8px;
}

.header-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.category-chip {
  cursor: pointer;
  user-select: none;
}

.folder-icon {
  margin-right: 6px;
  color: var(--el-color-warning);
}

.folder-title {
  font-weight: 600;
  font-size: 14px;
}

.folder-count {
  margin-left: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
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

.latest-batch {
  line-height: 1.45;
}

.latest-batch__head {
  display: flex;
  align-items: center;
  gap: 8px;

  strong {
    color: var(--el-color-primary);
    font-size: 14px;
  }
}

.latest-batch__time {
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;

  span {
    margin: 0 4px;
  }
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
  /* 全新通过：绿 */
  &.ok {
    background: var(--el-color-success-light-9);
    color: var(--el-color-success);
    border-color: var(--el-color-success-light-5);
  }
  /* 新品重取：主色，提示会重复消耗卖家精灵 API */
  &.refetch {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    border-color: var(--el-color-primary-light-5);
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
