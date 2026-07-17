<template>
  <div class="shop-shops">
    <el-card shadow="never" class="header-card">
      <ShopScreeningToolbar
        v-model="screeningFilters"
        :batches="screeningBatches"
        :loading="loading"
        @search="searchList"
        @marketplace-change="handleMarketplaceChange"
      />
    </el-card>

    <el-card shadow="never">
      <el-table :data="rows" v-loading="loading" stripe height="calc(100vh - 260px)" @row-click="openDetail">
        <template #empty>
          <el-empty description="暂无店铺选品数据。请先创建店铺抓取任务，完成后在此查看商品数据。" />
        </template>
        <el-table-column prop="sellerName" label="店铺名" min-width="170" show-overflow-tooltip />
        <el-table-column prop="latestBatchCode" label="周批次" width="105" />
        <el-table-column prop="passedProductCount" label="通过筛选" width="100">
          <template #default="{ row }"><strong class="good">{{ row.passedProductCount }}</strong></template>
        </el-table-column>
        <el-table-column prop="productCount" label="商品数" width="90" />
        <el-table-column label="A/B/C/D" min-width="170">
          <template #default="{ row }">
            <span class="tier a">{{ row.aCount }}</span> /
            <span class="tier b">{{ row.bCount }}</span> /
            <span class="tier c">{{ row.cCount }}</span> /
            <span class="tier d">{{ row.dCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="ABC" width="110">
          <template #default="{ row }">{{ row.abcCount }}（{{ pct(row.abcRatio) }}）</template>
        </el-table-column>
        <el-table-column prop="topCategory" label="通过商品主类目" min-width="150" show-overflow-tooltip />
        <el-table-column label="M01命中" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.m01HitCount" size="small" type="success">{{ row.m01HitCount }}（{{ pct(row.m01HitRatio) }}）</el-tag>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="90天新品" width="90">
          <template #default="{ row }">{{ row.new90Count ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="平均上架天数" width="110">
          <template #default="{ row }">{{ row.avgListingDays != null ? Math.round(row.avgListingDays) : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click.stop="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="screeningPage"
        v-model:page-size="screeningSize"
        :page-sizes="[20, 30, 50, 100]"
        :total="screeningTotal"
        layout="total, sizes, prev, pager, next"
        class="screening-pager"
        @current-change="loadList"
        @size-change="handleSizeChange"
      />
    </el-card>

    <el-drawer v-model="drawerVisible" :title="detailTitle" size="70%" destroy-on-close>
      <div v-loading="detailLoading" class="detail-body">
        <template v-if="detail">
          <div class="snapshot-bar">
            <el-select
              v-model="selectedSourceRunId"
              placeholder="选择快照"
              style="width: 320px"
              :disabled="snapshots.length === 0"
              @change="handleSnapshotChange"
            >
              <el-option
                v-for="item in snapshots"
                :key="item.sourceRunId"
                :label="snapshotLabel(item)"
                :value="item.sourceRunId"
              />
            </el-select>
            <div v-if="currentSnapshot" class="snapshot-meta">
              <span>{{ currentSnapshot.batchCode || '-' }}</span>
              <span>{{ currentSnapshot.batchDate || '-' }}</span>
              <span>{{ currentSnapshot.sourceRunId }}</span>
              <span>{{ currentSnapshot.fetchedCount || 0 }}/{{ currentSnapshot.total || 0 }}</span>
            </div>
          </div>

          <el-tabs v-model="activeTab" class="detail-tabs" @tab-change="ensureTabData">
          <el-tab-pane label="画像总览" name="overview">
          <el-descriptions v-if="detail.profile" :column="4" border size="small" title="全集画像">
            <el-descriptions-item label="商品数">{{ detail.profile.productCount }}</el-descriptions-item>
            <el-descriptions-item label="结构标签">
              <el-tag size="small" :type="profileTagType(detail.profile.profileType)">{{ detail.profile.profileType || '-' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="A+B强候选">{{ detail.profile.abCount }}（{{ pct(detail.profile.abRatio) }}）</el-descriptions-item>
            <el-descriptions-item label="ABC稳定盘">{{ detail.profile.abcCount }}（{{ pct(detail.profile.abcRatio) }}）</el-descriptions-item>
            <el-descriptions-item label="A">{{ detail.profile.aCount }}</el-descriptions-item>
            <el-descriptions-item label="B">{{ detail.profile.bCount }}</el-descriptions-item>
            <el-descriptions-item label="C">{{ detail.profile.cCount }}</el-descriptions-item>
            <el-descriptions-item label="D">{{ detail.profile.dCount }}（{{ pct(detail.profile.dRatio) }}）</el-descriptions-item>
            <el-descriptions-item label="A主类目">{{ detail.profile.topACategory || '-' }}</el-descriptions-item>
            <el-descriptions-item label="ABC主类目">{{ detail.profile.topABCCategory || '-' }}</el-descriptions-item>
            <el-descriptions-item label="D主类目">{{ detail.profile.topDCategory || '-' }}</el-descriptions-item>
            <el-descriptions-item label="批次">{{ detail.profile.latestBatchDate || '-' }}</el-descriptions-item>
          </el-descriptions>
          <el-empty v-else description="该店尚无全集数据，请先在观察池抓取" />

          <template v-if="insight">
            <div v-if="insight.shopProfile3dType" class="profile3d-banner">
              <el-tag size="large" type="primary" effect="dark">{{ insight.shopProfile3dType }}</el-tag>
              <span class="profile3d-exp">{{ insight.shopProfile3dExplanation }}</span>
            </div>

            <div class="section-title">画像解释层（M01 / 上架时间 / 类目标签）</div>
            <el-descriptions :column="4" border size="small">
              <el-descriptions-item label="M01命中">
                <span :class="{ hit: (insight.m01HitCount || 0) > 0 }">{{ insight.m01HitCount ?? 0 }}（{{ pct(insight.m01HitRatio) }}）</span>
              </el-descriptions-item>
              <el-descriptions-item label="平均上架天数">{{ insight.avgListingDays != null ? Math.round(insight.avgListingDays) : '-' }}</el-descriptions-item>
              <el-descriptions-item label="平均月销量">{{ insight.avgUnits != null ? Math.round(insight.avgUnits) : '-' }}</el-descriptions-item>
              <el-descriptions-item label="最早上架">{{ insight.earliestAvailableDateText || fmtDate(insight.earliestAvailableDate) }}</el-descriptions-item>
              <el-descriptions-item label="累计30天上新">{{ insight.new30Count ?? 0 }}</el-descriptions-item>
              <el-descriptions-item label="累计90天上新">{{ insight.new90Count ?? 0 }}</el-descriptions-item>
              <el-descriptions-item label="累计180天上新">{{ insight.new180Count ?? 0 }}</el-descriptions-item>
              <el-descriptions-item label="180天以上">{{ insight.old180Count ?? 0 }}</el-descriptions-item>
            </el-descriptions>
            <div class="cumulative-hint">上方 30/90/180 天为「累计窗口」，看近期上新强度，互相包含不可相加；模型分层请看下方互斥时间桶。</div>

            <div v-if="insight.ageBucketStats?.length" class="section-title sub">时间桶分布（互斥，模型分层）</div>
            <div v-if="insight.ageBucketStats?.length" class="agebucket-row">
              <div v-for="ab in insight.ageBucketStats" :key="ab.ageBucket" class="agebucket-card">
                <div class="agebucket-name">{{ ageLabel(ab.ageBucket) }}</div>
                <div class="agebucket-count">{{ ab.productCount ?? 0 }}</div>
                <div class="agebucket-sub">ABC {{ ab.abcCount ?? 0 }} · M01 {{ ab.m01HitCount ?? 0 }}</div>
              </div>
            </div>

            <div class="section-title sub">三维矩阵</div>
            <div class="matrix-wrap">
              <div v-for="m in [insight.salesAgeMatrix, insight.salesAttentionMatrix, insight.ageAttentionMatrix]" :key="m?.name" class="matrix-box">
                <template v-if="m">
                  <div class="matrix-title">{{ m.rowDim }} × {{ m.colDim }}</div>
                  <table class="matrix-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th v-for="col in m.colKeys" :key="col">{{ matrixColLabel(m, col) }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in m.rowKeys" :key="row">
                        <th>{{ matrixRowLabel(m, row) }}</th>
                        <td v-for="col in m.colKeys" :key="col" :class="cellHeat(matrixCell(m, row, col)?.productCount)">
                          {{ matrixCell(m, row, col)?.productCount || '' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </template>
              </div>
            </div>

            <div v-if="insight.topGoodTendencyCategories?.length || insight.topAttentionCategories?.length" class="topcat-row">
              <div v-if="insight.topGoodTendencyCategories?.length" class="topcat-col">
                <div class="topcat-head good">好品倾向 top 类目</div>
                <el-tag v-for="c in insight.topGoodTendencyCategories" :key="c" size="small" type="success" effect="plain">{{ c }}</el-tag>
              </div>
              <div v-if="insight.topAttentionCategories?.length" class="topcat-col">
                <div class="topcat-head attn">强注意 / 需复核 top 类目</div>
                <el-tag v-for="c in insight.topAttentionCategories" :key="c" size="small" type="warning" effect="plain">{{ c }}</el-tag>
              </div>
            </div>

            <div v-if="insight.tierStats?.length" class="section-title sub">各等级上架能力</div>
            <el-table v-if="insight.tierStats?.length" :data="insight.tierStats" size="small" border>
              <el-table-column label="等级" width="70">
                <template #default="{ row }"><el-tag size="small" :class="'tier-' + row.salesTier">{{ row.salesTier }}</el-tag></template>
              </el-table-column>
              <el-table-column prop="productCount" label="商品数" width="80" />
              <el-table-column label="M01命中" width="110">
                <template #default="{ row }">{{ row.m01HitCount ?? 0 }}（{{ pct(row.m01HitRatio) }}）</template>
              </el-table-column>
              <el-table-column label="平均上架天数" width="110">
                <template #default="{ row }">{{ row.avgListingDays != null ? Math.round(row.avgListingDays) : '-' }}</template>
              </el-table-column>
              <el-table-column label="平均月销量" width="100">
                <template #default="{ row }">{{ row.avgUnits != null ? Math.round(row.avgUnits) : '-' }}</template>
              </el-table-column>
              <el-table-column label="30/90/180天新品" min-width="140">
                <template #default="{ row }">{{ row.new30Count ?? 0 }} / {{ row.new90Count ?? 0 }} / {{ row.new180Count ?? 0 }}</template>
              </el-table-column>
            </el-table>

            <div v-if="insight.categoryLabelStats?.length" class="section-title sub">类目标签（注意 / 好品倾向，非拒绝）</div>
            <div v-if="insight.categoryLabelStats?.length" class="label-grid">
              <div v-for="(lab, idx) in insight.categoryLabelStats" :key="idx" class="label-card">
                <div class="label-head">
                  <el-tag size="small" :type="attentionTagType(lab.attentionLevel)">{{ attentionLabelText(lab.attentionLevel) }}</el-tag>
                  <span class="label-count">{{ lab.productCount ?? 0 }} 品 / {{ lab.categoryCount ?? 0 }} 类目</span>
                </div>
                <div v-if="lab.attentionReason" class="label-reason">{{ lab.attentionReason }}</div>
                <div v-if="lab.attentionTags?.length" class="label-tags">
                  <el-tag v-for="t in lab.attentionTags" :key="t" size="small" type="warning" effect="plain">{{ t }}</el-tag>
                </div>
                <div v-if="lab.tendencyTags?.length" class="label-tags">
                  <el-tag v-for="t in lab.tendencyTags" :key="t" size="small" type="success" effect="plain">{{ t }}</el-tag>
                </div>
                <div v-if="lab.topCategories?.length" class="label-cats">{{ lab.topCategories.join('、') }}</div>
              </div>
            </div>
          </template>

          <div class="promote-bar" v-if="detail.profile">
            <el-button type="success" size="small" @click="handlePromoteToPremium">加入精品店铺池</el-button>
            <span class="hint">已抓全集的店可直接入精品池（人工加入，前置快照校验）</span>
          </div>

          <div class="section-title" v-if="detail.watchlistEntries?.length">为什么进观察池</div>
          <el-table v-if="detail.watchlistEntries?.length" :data="detail.watchlistEntries" size="small" border>
            <el-table-column label="来源" width="110">
              <template #default="{ row }">{{ sourceLabel(row.sourceType) }} {{ row.sourceCode }}</template>
            </el-table-column>
            <el-table-column prop="hitCount" label="命中数" width="80" />
            <el-table-column prop="reason" label="原因" min-width="220" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="100" />
          </el-table>

          </el-tab-pane>

          <el-tab-pane label="商品数据" name="products">
          <div class="attn-hint">店铺商品数据直接读取 shop_products，可按销量层、时间层、注意/倾向层、M01、类目和关键词筛选。</div>
          <div class="section-title">商品明细（三维筛选）</div>
          <div class="prod-filters">
            <el-radio-group v-model="tierFilter" size="small" @change="reloadProducts">
              <el-radio-button label="">全部等级</el-radio-button>
              <el-radio-button label="A">A</el-radio-button>
              <el-radio-button label="B">B</el-radio-button>
              <el-radio-button label="C">C</el-radio-button>
              <el-radio-button label="D">D</el-radio-button>
              <el-radio-button label="UNKNOWN">未知</el-radio-button>
            </el-radio-group>
            <el-select v-model="ageFilter" placeholder="时间层" clearable size="small" style="width: 120px" @change="reloadProducts">
              <el-option label="新品" value="NEW" />
              <el-option label="成长期" value="GROWING" />
              <el-option label="成熟品" value="MATURE" />
              <el-option label="老品" value="OLD" />
              <el-option label="未知" value="UNKNOWN" />
            </el-select>
            <el-select v-model="attentionFilter" placeholder="注意/倾向层" clearable size="small" style="width: 140px" @change="reloadProducts">
              <el-option label="好品倾向" value="GOOD_TENDENCY" />
              <el-option label="中性" value="NEUTRAL" />
              <el-option label="需复核" value="ATTENTION_REVIEW" />
              <el-option label="强注意" value="ATTENTION_STRONG" />
              <el-option label="未知" value="UNKNOWN" />
            </el-select>
            <el-checkbox v-model="m01OnlyFilter" size="small" @change="reloadProducts">只看 M01 命中</el-checkbox>
            <el-input v-model="prodKeyword" placeholder="标题关键词" clearable size="small" style="width: 160px" @keyup.enter="reloadProducts" @clear="reloadProducts" />
          </div>
          <div class="attn-hint">注意标签用于提醒人工复核，不代表系统拒绝；好品倾向表示类目形态接近验证好品线，不代表一定能做。选注意/倾向层筛超大店时若提示候选过多，请先按销量层/时间层/关键词收窄。</div>
          <el-table :data="products" v-loading="productsLoading" size="small" border height="420">
            <el-table-column label="等级" width="60">
              <template #default="{ row }"><el-tag size="small" :class="'tier-' + row.salesTier">{{ row.salesTier }}</el-tag></template>
            </el-table-column>
            <el-table-column label="时间层" width="80">
              <template #default="{ row }">{{ ageLabel(row.ageBucket || 'UNKNOWN') }}</template>
            </el-table-column>
            <el-table-column label="注意/倾向" width="100">
              <template #default="{ row }">
                <el-tooltip v-if="row.labelMeaning" :content="row.labelMeaning" placement="top">
                  <el-tag size="small" :type="attentionTagType(row.attentionLevel)">{{ attentionLabelText(row.attentionLevel) }}</el-tag>
                </el-tooltip>
                <el-tag v-else size="small" :type="attentionTagType(row.attentionLevel)">{{ attentionLabelText(row.attentionLevel) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="asin" label="ASIN" width="120">
              <template #default="{ row }">
                <el-link v-if="row.productUrl" :href="row.productUrl" target="_blank" type="primary">{{ row.asin }}</el-link>
                <span v-else>{{ row.asin }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
            <el-table-column prop="units" label="月销量" width="90" />
            <el-table-column label="M01" width="60">
              <template #default="{ row }">
                <el-tag v-if="row.m01Hit === 1" size="small" type="success">是</el-tag>
                <span v-else class="muted">否</span>
              </template>
            </el-table-column>
            <el-table-column prop="price" label="价格" width="90" />
            <el-table-column prop="bsr" label="BSR" width="90" />
            <el-table-column prop="brand" label="品牌" min-width="110" show-overflow-tooltip>
              <template #default="{ row }">{{ row.brand || '-' }}</template>
            </el-table-column>
            <el-table-column label="评分" width="110">
              <template #default="{ row }">
                <span v-if="row.rating != null">{{ row.rating }}<span class="muted">（{{ row.ratings ?? 0 }}）</span></span>
                <span v-else class="muted">-</span>
              </template>
            </el-table-column>
            <el-table-column label="配送" width="80">
              <template #default="{ row }">{{ row.fulfillment || '-' }}</template>
            </el-table-column>
            <el-table-column prop="categoryLeaf" label="末级类目" min-width="130" show-overflow-tooltip />
            <el-table-column label="上架天数" width="90">
              <template #default="{ row }">{{ row.listingDays ?? '-' }}</template>
            </el-table-column>
            <el-table-column label="上架日" width="110">
              <template #default="{ row }">{{ fmtDate(row.availableDate) }}</template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="prodPage"
            :page-size="prodSize"
            :total="prodTotal"
            layout="total, prev, pager, next"
            small
            style="margin-top: 10px; justify-content: flex-end"
            @current-change="loadProducts"
          />
          </el-tab-pane>

          <el-tab-pane label="商品墙" name="wall">
          <div class="section-title" v-if="productWall">商品图片墙</div>
          <div v-if="productWall" v-loading="productWallLoading" class="wall-grid">
            <div v-for="tier in wallTiers" :key="tier" class="wall-section">
              <div class="wall-section-head">
                <span class="wall-tier">{{ tier }}</span>
                <span>{{ productWall.sections[tier]?.count || 0 }}</span>
              </div>
              <div class="wall-products">
                <div v-for="item in productWall.sections[tier]?.products || []" :key="item.asin" class="product-card">
                  <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.asin" />
                  <div v-else class="image-empty">{{ item.salesTier || '-' }}</div>
                  <div class="product-info">
                    <el-link v-if="item.productUrl" :href="item.productUrl" target="_blank" type="primary">{{ item.asin }}</el-link>
                    <span v-else class="asin">{{ item.asin }}</span>
                    <div class="title" :title="item.title || ''">{{ item.title || '-' }}</div>
                    <div class="metrics">
                      <span>{{ item.units ?? '-' }}</span>
                      <span>{{ item.price ?? '-' }}</span>
                      <span>{{ item.rating ?? '-' }}/{{ item.ratings ?? '-' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          </el-tab-pane>

          <el-tab-pane label="历史对比" name="compare">
          <el-empty v-if="snapshots.length <= 1" description="只有一个快照，暂无可对比的历史批次" />
          <div class="section-title" v-if="snapshots.length > 1">历史对比</div>
          <div v-if="snapshots.length > 1" class="compare-bar">
            <el-select v-model="baselineRunId" placeholder="基准快照" style="width: 260px">
              <el-option v-for="item in snapshots" :key="`b-${item.sourceRunId}`" :label="snapshotLabel(item)" :value="item.sourceRunId" />
            </el-select>
            <el-select v-model="compareRunId" placeholder="对比快照" style="width: 260px">
              <el-option v-for="item in snapshots" :key="`c-${item.sourceRunId}`" :label="snapshotLabel(item)" :value="item.sourceRunId" />
            </el-select>
            <el-button :loading="compareLoading" @click="loadCompare">对比</el-button>
            <div v-if="compareResult" class="compare-summary">
              新增 {{ compareResult.summary.newCount }} / 消失 {{ compareResult.summary.goneCount }} /
              保留 {{ compareResult.summary.keptCount }} / 升级 {{ compareResult.summary.upgradedCount }} /
              降级 {{ compareResult.summary.downgradedCount }}
            </div>
          </div>

          </el-tab-pane>

          <el-tab-pane label="抓取快照" name="snapshots">
          <el-empty v-if="!snapshots.length" description="该店铺尚未抓取全集，可加入候选池或创建请求中心任务" />
          <el-table v-else :data="snapshots" size="small" border>
            <el-table-column label="批次" min-width="120">
              <template #default="{ row }">{{ row.batchCode || row.batchDate || '-' }}</template>
            </el-table-column>
            <el-table-column prop="batchDate" label="批次日" width="110" />
            <el-table-column prop="sourceRunId" label="抓取任务" min-width="180" show-overflow-tooltip />
            <el-table-column label="抓取量" width="110">
              <template #default="{ row }">{{ row.fetchedCount || 0 }}/{{ row.total || 0 }}</template>
            </el-table-column>
            <el-table-column label="操作" width="110">
              <template #default="{ row }">
                <el-button size="small" type="primary" link :disabled="row.sourceRunId === selectedSourceRunId" @click="switchSnapshot(row.sourceRunId)">查看该快照</el-button>
              </template>
            </el-table-column>
          </el-table>
          </el-tab-pane>
          </el-tabs>
        </template>

        <!-- 店铺选品只展示 shop_products；尚无抓取快照时显示空态。 -->
        <template v-else-if="!detailLoading && currentSeller">
          <el-empty description="该店尚无店铺商品数据。请在请求中心完成店铺抓取后再查看。" />
          <div v-if="false">
          <el-alert type="warning" :closable="false" show-icon class="fallback-alert">
            <template #title>
              该店铺<strong>尚未抓取全集</strong>，以下为历史竞品商品数据（competitor_products_clean），<strong>非整店全集，仅供线索参考</strong>。
            </template>
            <template #default>
              <el-button type="primary" size="small" :loading="fetchAllLoading" @click="handleFetchAll">一键抓全集（加入候选池）</el-button>
              <span class="fallback-hint">抓全集后本页将展示完整的三维画像与筛选。</span>
            </template>
          </el-alert>
          <el-input v-model="refKeyword" placeholder="标题关键词" clearable size="small" style="width: 200px; margin: 8px 0" @keyup.enter="reloadRefProducts" @clear="reloadRefProducts" />
          <el-table :data="refProducts" v-loading="refLoading" size="small" border height="440">
            <template #empty><el-empty description="该店在历史竞品商品池中也没有数据" /></template>
            <el-table-column prop="asin" label="ASIN" width="120">
              <template #default="{ row }">
                <el-link v-if="row.productUrl || row.productLink" :href="row.productUrl || row.productLink" target="_blank" type="primary">{{ row.asin }}</el-link>
                <span v-else>{{ row.asin }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
            <el-table-column label="月销量" width="90">
              <template #default="{ row }">{{ row.units ?? row.salesVolume ?? '-' }}</template>
            </el-table-column>
            <el-table-column prop="price" label="价格" width="90" />
            <el-table-column prop="bsr" label="BSR" width="90" />
            <el-table-column prop="brand" label="品牌" min-width="110" show-overflow-tooltip>
              <template #default="{ row }">{{ row.brand || '-' }}</template>
            </el-table-column>
            <el-table-column label="评分" width="110">
              <template #default="{ row }">
                <span v-if="row.rating != null">{{ row.rating }}<span class="muted">（{{ row.ratings ?? 0 }}）</span></span>
                <span v-else class="muted">-</span>
              </template>
            </el-table-column>
            <el-table-column label="等级" width="70">
              <template #default="{ row }">
                <el-tag v-if="row.grade" size="small">{{ row.grade }}</el-tag>
                <span v-else class="muted">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="nodeLabelPath" label="类目路径" min-width="150" show-overflow-tooltip />
          </el-table>
          <el-pagination
            v-model:current-page="refPage"
            :page-size="refSize"
            :total="refTotal"
            layout="total, prev, pager, next"
            small
            style="margin-top: 10px; justify-content: flex-end"
            @current-change="loadRefProducts"
          />
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import shopCollectionApi, {
    type ShopScreeningRow,
    type ShopScreeningBatch,
    type ShopCollectionDetail,
    type ShopProfileProduct,
    type ShopSnapshot,
    type ShopProductWallResult,
    type ShopCompareResult,
    type ShopCollectionInsight,
    type ShopMatrix,
    type ShopMatrixCell
  } from '@/api/shopCollection'
import ShopScreeningToolbar from '@/modules/shop-collection-shared/ShopScreeningToolbar.vue'
import {
  buildShopScreeningQuery,
  createShopScreeningFilters,
} from '@/modules/shop-collection-shared/shopScreening'
import { shopPremiumApi } from '@/api/shopPremium'
import { competitorApi } from '@/api/competitor'
import { shopCandidateApi } from '@/api/shopCandidate'

const route = useRoute()
const marketplace = ref('UK')
const screeningFilters = ref(createShopScreeningFilters('UK'))
const screeningBatches = ref<ShopScreeningBatch[]>([])
const screeningPage = ref(1)
const screeningSize = ref(30)
const screeningTotal = ref(0)
const rows = ref<ShopScreeningRow[]>([])
const loading = ref(false)

const drawerVisible = ref(false)
const detail = ref<ShopCollectionDetail | null>(null)
const insight = ref<ShopCollectionInsight | null>(null)
const detailLoading = ref(false)
const currentSeller = ref('')
const snapshots = ref<ShopSnapshot[]>([])
const selectedSourceRunId = ref('')
const activeTab = ref('overview')
const loadedTabs = ref<Set<string>>(new Set())

const products = ref<ShopProfileProduct[]>([])
const productsLoading = ref(false)
const tierFilter = ref('')
const ageFilter = ref('')
const attentionFilter = ref('')
const m01OnlyFilter = ref(false)
const prodKeyword = ref('')
const prodPage = ref(1)
const prodSize = ref(60)
const prodTotal = ref(0)
const productWall = ref<ShopProductWallResult | null>(null)
const productWallLoading = ref(false)
const wallTiers = ['A', 'B', 'C', 'D', 'UNKNOWN']
const baselineRunId = ref('')
const compareRunId = ref('')
const compareResult = ref<ShopCompareResult | null>(null)
const compareLoading = ref(false)
const lastRouteOpenKey = ref('')

// 降级视图：该店无全集快照时，读 competitor_products_clean 显示零散竞品商品
const refProducts = ref<Record<string, any>[]>([])
const refLoading = ref(false)
const refKeyword = ref('')
const refPage = ref(1)
const refSize = ref(60)
const refTotal = ref(0)
const fetchAllLoading = ref(false)

const detailTitle = computed(() => (currentSeller.value ? `${marketplace.value} · ${currentSeller.value}` : '单店全景'))
const currentSnapshot = computed(() => snapshots.value.find((item) => item.sourceRunId === selectedSourceRunId.value) || null)

async function loadList() {
  loading.value = true
  try {
    marketplace.value = screeningFilters.value.marketplace
    const result = await shopCollectionApi.screenShops(buildShopScreeningQuery(
      screeningFilters.value, 'ALL', screeningPage.value, screeningSize.value
    ))
    rows.value = result.list || []
    screeningTotal.value = result.total || 0
  } catch (e: any) {
    rows.value = []
    screeningTotal.value = 0
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadScreeningBatches() {
  screeningBatches.value = await shopCollectionApi.screeningBatches(screeningFilters.value.marketplace)
}

function searchList() {
  screeningPage.value = 1
  loadList()
}

async function handleMarketplaceChange() {
  marketplace.value = screeningFilters.value.marketplace
  screeningPage.value = 1
  await loadScreeningBatches()
  await loadList()
}

function handleSizeChange() {
  screeningPage.value = 1
  loadList()
}

async function openDetail(row: ShopScreeningRow) {
  await openSeller(row.sellerName)
}

async function openSeller(seller: string, targetTab = 'overview', targetRunId?: string) {
  currentSeller.value = seller
  drawerVisible.value = true
  detailLoading.value = true
  activeTab.value = targetTab
  tierFilter.value = ''
  ageFilter.value = ''
  attentionFilter.value = ''
  m01OnlyFilter.value = false
  prodKeyword.value = ''
  prodPage.value = 1
  refKeyword.value = ''
  refPage.value = 1
  refProducts.value = []
  refTotal.value = 0
  snapshots.value = []
  selectedSourceRunId.value = ''
  productWall.value = null
  compareResult.value = null
  insight.value = null
  detail.value = null
  try {
    // 用 snapshots 判断该店有没有抓过全集，空数组即未抓取，不用 insight 抛异常来判断。
    snapshots.value = await shopCollectionApi.snapshots(marketplace.value, seller)
    if (!snapshots.value.length) {
      // 店铺选品页只读取 shop_products；无快照时保留空态，不混入旧竞品数据。
      activeTab.value = 'products'
      return
    }
    const preferred = targetRunId && snapshots.value.some((s) => s.sourceRunId === targetRunId)
      ? targetRunId
      : snapshots.value[0]?.sourceRunId || ''
    selectedSourceRunId.value = preferred
    baselineRunId.value = snapshots.value[1]?.sourceRunId || snapshots.value[0]?.sourceRunId || ''
    compareRunId.value = snapshots.value[0]?.sourceRunId || ''
    await loadCurrentSnapshotData()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

async function loadCurrentSnapshotData() {
  loadedTabs.value = new Set()
  detail.value = await shopCollectionApi.detail(
    marketplace.value,
    currentSeller.value,
    undefined,
    selectedSourceRunId.value || undefined
  )
  await loadInsight()
  loadedTabs.value.add('overview')
  await ensureTabData(activeTab.value)
}

async function ensureTabData(tab: string | number) {
  const name = String(tab)
  if (loadedTabs.value.has(name)) return
  loadedTabs.value.add(name)
  if (name === 'products') await loadProducts()
  else if (name === 'wall') await loadProductWall()
  // compare 与 snapshots 用已加载的 snapshots 列表，无需额外拉取
}

async function switchSnapshot(runId: string) {
  if (!runId || runId === selectedSourceRunId.value) return
  selectedSourceRunId.value = runId
  activeTab.value = 'overview'
  await handleSnapshotChange()
}

async function loadInsight() {
  if (!currentSeller.value) {
    insight.value = null
    return
  }
  try {
    insight.value = await shopCollectionApi.insight(
      marketplace.value,
      currentSeller.value,
      selectedSourceRunId.value || undefined
    )
  } catch {
    insight.value = null
  }
}

async function handleSnapshotChange() {
  detailLoading.value = true
  prodPage.value = 1
  compareResult.value = null
  try {
    await loadCurrentSnapshotData()
  } catch (e: any) {
    ElMessage.error(e?.message || '切换快照失败')
  } finally {
    detailLoading.value = false
  }
}

function reloadProducts() {
  prodPage.value = 1
  loadProducts()
}

const AGE_LABELS: Record<string, string> = {
  NEW: '新品', GROWING: '成长期', MATURE: '成熟品', OLD: '老品', UNKNOWN: '未知'
}
function ageLabel(k: string): string {
  return AGE_LABELS[k] || k
}
function matrixCell(m: ShopMatrix | null, rowKey: string, colKey: string): ShopMatrixCell | null {
  if (!m) return null
  return m.cells.find((c) => c.rowKey === rowKey && c.colKey === colKey) || null
}
function matrixColLabel(m: ShopMatrix | null, colKey: string): string {
  if (!m) return colKey
  if (m.name === 'SALES_AGE') return ageLabel(colKey)
  return attentionLabelText(colKey)
}
function matrixRowLabel(m: ShopMatrix | null, rowKey: string): string {
  if (!m) return rowKey
  if (m.name === 'AGE_ATTENTION') return ageLabel(rowKey)
  return rowKey
}
function cellHeat(count: number | null | undefined): string {
  const n = count || 0
  if (n === 0) return ''
  if (n >= 20) return 'heat-3'
  if (n >= 8) return 'heat-2'
  return 'heat-1'
}

async function loadProductWall() {
  if (!currentSeller.value || !selectedSourceRunId.value) {
    productWall.value = null
    return
  }
  productWallLoading.value = true
  try {
    productWall.value = await shopCollectionApi.productWall(
      marketplace.value,
      currentSeller.value,
      selectedSourceRunId.value,
      undefined,
      1,
      12
    )
  } finally {
    productWallLoading.value = false
  }
}

async function loadProducts() {
  if (!currentSeller.value) return
  productsLoading.value = true
  try {
    const r = await shopCollectionApi.shopProducts({
      marketplace: marketplace.value,
      sellerName: currentSeller.value,
      salesTier: tierFilter.value || undefined,
      ageBucket: ageFilter.value || undefined,
      attentionLevel: attentionFilter.value || undefined,
      m01Only: m01OnlyFilter.value || undefined,
      keyword: prodKeyword.value || undefined,
      sourceRunId: selectedSourceRunId.value || undefined,
      page: prodPage.value,
      size: prodSize.value
    })
    products.value = r.list || []
    prodTotal.value = r.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载商品失败')
  } finally {
    productsLoading.value = false
  }
}

function reloadRefProducts() {
  refPage.value = 1
  loadRefProducts()
}

// 降级：读 competitor_products_clean，按店铺名过滤，展示该店零散竞品商品。
async function loadRefProducts() {
  if (!currentSeller.value) return
  refLoading.value = true
  try {
    const res: any = await competitorApi.getList({
      marketplace: marketplace.value,
      sellerName: currentSeller.value,
      keywords: refKeyword.value || undefined,
      useCleanTable: true,
      page: refPage.value,
      size: refSize.value
    })
    refProducts.value = res?.data?.list || []
    refTotal.value = res?.data?.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载历史竞品商品失败')
  } finally {
    refLoading.value = false
  }
}

// 一键抓全集：人工加入候选池，后续走请求中心抓整店全集。
async function handleFetchAll() {
  if (!currentSeller.value || !marketplace.value) return
  try {
    await ElMessageBox.confirm(
      `将「${currentSeller.value}」(${marketplace.value}) 加入候选池并排队抓取整店全集？抓取会消耗卖家精灵使用次数。`,
      '抓全集',
      { type: 'warning', confirmButtonText: '加入候选池', cancelButtonText: '取消' }
    )
  } catch { return }
  fetchAllLoading.value = true
  try {
    await shopCandidateApi.addManual(marketplace.value, currentSeller.value, '从店铺画像商品数据 Tab 一键抓全集')
    ElMessage.success('已加入候选池，请到候选池 / 请求中心确认抓取')
  } catch (e: any) {
    ElMessage.error(e?.message || '加入候选池失败')
  } finally {
    fetchAllLoading.value = false
  }
}

async function loadCompare() {
  if (!currentSeller.value || !baselineRunId.value || !compareRunId.value) return
  compareLoading.value = true
  try {
    compareResult.value = await shopCollectionApi.compare(
      marketplace.value,
      currentSeller.value,
      baselineRunId.value,
      compareRunId.value
    )
  } catch (e: any) {
    ElMessage.error(e?.message || '历史对比失败')
  } finally {
    compareLoading.value = false
  }
}

function snapshotLabel(item: ShopSnapshot) {
  return `${item.batchCode || item.batchDate || '-'} · ${item.sourceRunId} · ${item.fetchedCount || 0}/${item.total || 0}`
}

function pct(v: number | null) {
  if (v == null) return '0%'
  return (v * 100).toFixed(1) + '%'
}
function fmtDate(ts: number | null) {
  if (!ts) return '-'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function sourceLabel(t: string) {
  const map: Record<string, string> = {
    METHOD_CARD: '方法卡', BASELINE: '基线', MANUAL: '人工', OWN_GOOD_SIMILAR: '自有相似', CATEGORY: '类目'
  }
  return map[t] || t
}
function attentionLabelText(level: string | null): string {
  const map: Record<string, string> = {
    ATTENTION_STRONG: '强注意',
    ATTENTION_REVIEW: '需复核',
    GOOD_TENDENCY: '好品倾向',
    NEUTRAL: '中性',
    UNKNOWN: '未知'
  }
  return level ? map[level] || level : '未知'
}
function attentionTagType(level: string | null): 'success' | 'warning' | 'danger' | 'info' {
  if (level === 'GOOD_TENDENCY') return 'success'
  if (level === 'ATTENTION_STRONG') return 'danger'
  if (level === 'ATTENTION_REVIEW') return 'warning'
  return 'info'
}
async function handlePromoteToPremium() {
  if (!currentSeller.value || !marketplace.value) return
  try {
    await ElMessageBox.confirm(
      `将「${currentSeller.value}」(${marketplace.value}) 加入精品店铺池？该店已有全集快照，将作为人工加入。`,
      '加入精品池',
      { type: 'warning', confirmButtonText: '入池', cancelButtonText: '取消' }
    )
  } catch { return }
  try {
    await shopPremiumApi.addManual({
      marketplace: marketplace.value,
      sellerName: currentSeller.value,
      reason: '从店铺全集画像页人工加入',
      qualityLevel: 'MID',
      refreshFrequency: 'MONTHLY'
    })
    ElMessage.success('已加入精品池')
  } catch (e: any) {
    ElMessage.error(e?.message || '入池失败')
  }
}

function profileTagType(t: string | null): 'success' | 'primary' | 'warning' | 'info' {
  if (!t) return 'info'
  if (t.includes('利润')) return 'success'
  if (t.includes('飞轮')) return 'primary'
  if (t.includes('测品')) return 'warning'
  return 'info'
}

async function openFromRouteQuery() {
  if (route.query.marketplace) {
    marketplace.value = String(route.query.marketplace)
    screeningFilters.value.marketplace = marketplace.value
  }
  if (route.query.sellerName) {
    const seller = String(route.query.sellerName)
    const tab = route.query.tab ? String(route.query.tab) : 'overview'
    const runId = route.query.sourceRunId ? String(route.query.sourceRunId) : undefined
    const key = `${marketplace.value}\u0001${seller}\u0001${tab}\u0001${runId || ''}`
    if (key === lastRouteOpenKey.value) return
    lastRouteOpenKey.value = key
    await openSeller(seller, tab, runId)
  }
}

onMounted(async () => {
  if (route.query.marketplace) {
    marketplace.value = String(route.query.marketplace)
    screeningFilters.value.marketplace = marketplace.value
  }
  await loadScreeningBatches()
  await loadList()
  await openFromRouteQuery()
})

watch(
  () => route.query,
  async () => {
    const routeName = String(route.name || '')
    if (!routeName.endsWith('ShopCollectionShops') && !routeName.endsWith('ReferenceProducts')) return
    const previousMarketplace = marketplace.value
    await openFromRouteQuery()
    if (marketplace.value !== previousMarketplace) {
      await loadScreeningBatches()
      await loadList()
    }
  }
)
</script>

<style scoped lang="scss">
.shop-shops {
  padding: 16px;
}
.header-card {
  margin-bottom: 12px;
}
.screening-pager {
  justify-content: flex-end;
  padding: 12px 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.toolbar .tip {
  color: #909399;
  font-size: 12px;
}
.section-title {
  font-weight: 600;
  margin: 18px 0 10px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}
.section-title.sub {
  font-weight: 500;
  font-size: 13px;
  border-left-color: #b3d8ff;
}
.muted {
  color: #c0c4cc;
}
.hit {
  color: #67c23a;
  font-weight: 600;
}
.good {
  color: #67c23a;
  font-weight: 600;
}
.danger {
  color: #f56c6c;
  font-weight: 600;
}
.label-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
.label-card {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 10px;
}
.label-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.label-count {
  color: #909399;
  font-size: 12px;
}
.label-reason {
  color: #606266;
  font-size: 12px;
  margin-bottom: 6px;
}
.label-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.label-cats {
  color: #909399;
  font-size: 11px;
}
.profile3d-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0 12px;
  padding: 10px 12px;
  background: #ecf5ff;
  border-radius: 6px;
}
.profile3d-exp {
  color: #606266;
  font-size: 13px;
}
.cumulative-hint,
.attn-hint {
  color: #e6a23c;
  font-size: 12px;
  margin: 6px 0 4px;
}
.agebucket-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.agebucket-card {
  flex: 1;
  min-width: 92px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 8px 10px;
  text-align: center;
}
.agebucket-name {
  font-size: 12px;
  color: #909399;
}
.agebucket-count {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}
.agebucket-sub {
  font-size: 11px;
  color: #909399;
}
.matrix-wrap {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}
.matrix-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}
.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.matrix-table th,
.matrix-table td {
  border: 1px solid #ebeef5;
  padding: 4px 6px;
  text-align: center;
  color: #606266;
}
.matrix-table thead th,
.matrix-table tbody th {
  background: #f5f7fa;
  font-weight: 600;
}
.matrix-table td.heat-1 { background: #ecf5ff; }
.matrix-table td.heat-2 { background: #b3d8ff; }
.matrix-table td.heat-3 { background: #409eff; color: #fff; font-weight: 600; }
.topcat-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.topcat-col {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-content: flex-start;
}
.topcat-head {
  width: 100%;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.topcat-head.good { color: #67c23a; }
.topcat-head.attn { color: #e6a23c; }
.prod-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.snapshot-bar,
.compare-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.snapshot-meta,
.compare-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #606266;
  font-size: 12px;
}
.wall-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}
.wall-section {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 10px;
  min-width: 0;
}
.wall-section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: #606266;
}
.wall-tier {
  font-weight: 700;
  color: #303133;
}
.wall-products {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 8px;
}
.product-card {
  min-width: 0;
  border: 1px solid #f0f2f5;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}
.product-card img,
.image-empty {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  background: #f5f7fa;
}
.image-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-weight: 600;
}
.product-info {
  padding: 6px;
  min-width: 0;
}
.asin {
  color: #409eff;
  font-size: 12px;
}
.title {
  height: 34px;
  line-height: 17px;
  margin-top: 4px;
  font-size: 12px;
  color: #303133;
  overflow: hidden;
}
.metrics {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
  color: #909399;
  font-size: 11px;
}
.promote-bar {
  margin: 14px 0 6px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.promote-bar .hint {
  color: #909399;
  font-size: 12px;
}
.tier {
  font-weight: 600;
  &.a { color: #67c23a; }
  &.b { color: #409eff; }
  &.c { color: #e6a23c; }
  &.d { color: #909399; }
}
.tier-A { background: #67c23a; color: #fff; border: none; }
.tier-B { background: #409eff; color: #fff; border: none; }
.tier-C { background: #e6a23c; color: #fff; border: none; }
.tier-D { background: #909399; color: #fff; border: none; }
</style>
