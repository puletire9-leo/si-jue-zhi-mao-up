<!-- AI 生成文案任务列表（纯 mock） — #/app/listing-ai-copy-task -->
<template>
	<div class="lact-list-page">
		<el-card class="section-card" shadow="never">
			<template #header>
				<div class="section-header">
					<span>AI 生成文案任务</span>
					<el-tag type="info">{{ filteredTotal }}</el-tag>
					<span class="section-sub">MSKU 维度 · 演示数据</span>
					<div class="section-header-actions">
						<el-tooltip
							effect="dark"
							content="暂时禁用，请在 BSR 选品运营页面选择“做”后自动触发"
							placement="bottom"
						>
							<el-button type="primary" disabled
								>新建 AI 生成文案任务（暂不可用）</el-button
							>
						</el-tooltip>
						<el-button link type="primary" @click="goListingStudio"
							>Listing 内容工作室</el-button
						>
					</div>
				</div>
			</template>

			<div class="toolbar">
				<el-input
					v-model="filters.keyword"
					class="toolbar-search"
					clearable
					placeholder="MSKU / 父SKU / 标题 / Run UUID / 账号"
					@clear="applyFilters"
					@keyup.enter="applyFilters"
				/>
				<el-select
					v-model="filters.phase"
					class="toolbar-phase"
					clearable
					placeholder="阶段"
					@change="onPhaseFilterChange"
				>
					<el-option
						v-for="opt in LISTING_AI_RUN_PHASE_OPTIONS"
						:key="opt.value || 'all'"
						:label="opt.label"
						:value="opt.value"
					/>
				</el-select>
				<el-select
					v-model="filters.accountId"
					class="toolbar-phase"
					clearable
					filterable
					placeholder="店铺"
					@change="applyFilters"
				>
					<el-option
						v-for="opt in accountOptions"
						:key="opt.value"
						:label="opt.label"
						:value="opt.value"
					/>
				</el-select>
				<el-select
					v-model="filters.applicantId"
					class="toolbar-phase"
					clearable
					filterable
					placeholder="运营"
					@change="applyFilters"
				>
					<el-option
						v-for="opt in applicantOptions"
						:key="opt.value"
						:label="opt.label"
						:value="opt.value"
					/>
				</el-select>
				<el-checkbox v-model="filters.onlyFailed" @change="onOnlyFailedChange"
					>仅失败</el-checkbox
				>
				<el-checkbox v-model="filters.onlyPendingReview" @change="onOnlyPendingReviewChange"
					>待 Studio 确认</el-checkbox
				>
				<el-checkbox v-model="filters.onlyClosed" @change="onOnlyClosedChange"
					>已关闭</el-checkbox
				>
				<el-button type="primary" @click="applyFilters">查询</el-button>
				<el-button @click="resetFilters">重置</el-button>
			</div>

			<el-table :data="pageRows" stripe border class="lact-table" row-key="id">
				<el-table-column prop="sku" label="父SKU" width="170" show-overflow-tooltip />
				<el-table-column label="产品名" width="170" show-overflow-tooltip>
					<template #default="{ row }">{{ row.productTitle || "—" }}</template>
				</el-table-column>
				<el-table-column label="图片" width="170" align="center">
					<template #default="{ row }">
						<el-image
							v-if="row.candidateImageUrl"
							:src="row.candidateImageUrl"
							fit="cover"
							class="list-thumb"
							:preview-src-list="[row.candidateImageUrl]"
							preview-teleported
						/>
						<span v-else class="muted">—</span>
					</template>
				</el-table-column>
				<el-table-column label="状态" width="170" align="center">
					<template #default="{ row }">
						<el-tag size="small" :type="phaseTagType(row.phase)">{{
							phaseLabel(row.phase)
						}}</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="失败原因" min-width="220" show-overflow-tooltip>
					<template #default="{ row }">
						<span
							v-if="row.phase === 'failed' && row.errorMessage"
							class="error-text"
							>{{ row.errorMessage }}</span
						>
						<span v-else class="muted">—</span>
					</template>
				</el-table-column>
				<el-table-column label="任务类型" width="120" align="center">
					<template #default="{ row }">
						<el-tag size="small" :type="taskModeTagType(row.taskMode)">
							{{ taskModeLabel(row.taskMode) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="店铺" width="170" show-overflow-tooltip>
					<template #default="{ row }">{{ row.accountName || "—" }}</template>
				</el-table-column>
				<el-table-column label="语言" width="120" align="center">
					<template #default="{ row }">
						<div v-if="row.requiredLanguages.length" class="lang-tags">
							<el-tag
								v-for="lang in row.requiredLanguages"
								:key="lang"
								size="small"
								type="info"
								effect="plain"
							>
								{{ labelForRequiredLang(lang) }}
							</el-tag>
						</div>
						<span v-else class="muted">—</span>
					</template>
				</el-table-column>
				<el-table-column label="运营" width="120" show-overflow-tooltip>
					<template #default="{ row }">{{ row.applicantName || "—" }}</template>
				</el-table-column>
				<el-table-column label="变体" width="170" show-overflow-tooltip>
					<template #default="{ row }">
						<el-tooltip
							v-if="row.variantCount > 0"
							effect="dark"
							placement="top"
							:content="row.variantNames.join('，') || row.variantIds.join('，')"
						>
							<span class="variant-count-text">{{ row.variantCount }} 个</span>
						</el-tooltip>
						<span v-else class="muted">—</span>
					</template>
				</el-table-column>
				<el-table-column label="更新时间" width="168">
					<template #default="{ row }">
						<lazy-activity-timeline
							:updated-at="row.updatedAt"
							:dialog-title="`任务时间线 · #${row.id}${row.productTitle ? ` · ${row.productTitle}` : ''}`"
							:load="() => fetchAiListingTimelineItems(row.id)"
						/>
					</template>
				</el-table-column>
				<el-table-column label="操作" width="320" fixed="right" align="center">
					<template #default="{ row }">
						<el-button link type="primary" @click="openDetail(row)">详情</el-button>
						<el-button link type="primary" @click="openStudio(row)">Studio</el-button>
						<el-button
							v-if="canShowTriggerDeButton(row)"
							link
							type="success"
							:loading="triggerDeIds.has(row.id)"
							@click="triggerDeCopy(row)"
							>触发德国文案</el-button
						>
						<el-button
							v-if="row.phase === 'awaiting_review'"
							link
							type="info"
							:loading="closingIds.has(row.id)"
							@click="closeTask(row)"
							>关闭</el-button
						>
						<el-button
							link
							type="warning"
							@click="openPreflightDialog(row)"
							>补充参数重新提交</el-button
						>
						<el-button
							link
							type="warning"
							:loading="retryingIds.has(row.id)"
							@click="retryTask(row)"
							>重跑AI</el-button
						>
					</template>
				</el-table-column>
			</el-table>

			<div class="pager">
				<el-pagination
					:current-page="page"
					:page-size="pageSize"
					:total="filteredTotal"
					:page-sizes="[10, 20, 50]"
					layout="total, sizes, prev, pager, next"
					background
					@size-change="onPageSizeChange"
					@current-change="onPageChange"
				/>
			</div>
		</el-card>

		<el-dialog
			v-model="createDialogVisible"
			title="新建 AI 生成文案任务"
			width="640px"
			align-center
		>
			<el-form label-width="130px">
				<el-form-item label="父SKU">
					<el-input
						v-model.trim="createForm.sku"
						placeholder="请输入父SKU"
						clearable
						@keyup.enter="loadCreateMeta"
					>
						<template #append>
							<el-button :loading="metaLoading" @click="loadCreateMeta"
								>加载</el-button
							>
						</template>
					</el-input>
				</el-form-item>

				<el-form-item label="选品信息">
					<div v-if="createMeta?.candidate" class="meta-line">
						<span class="meta-item">ID: {{ createMeta.candidate.id }}</span>
						<span class="meta-item">父SKU: {{ createMeta.candidate.sku || "-" }}</span>
						<span class="meta-item">ASIN: {{ createMeta.candidate.asin || "-" }}</span>
						<span class="meta-item"
							>站点: {{ createMeta.candidate.marketplace || "-" }}</span
						>
					</div>
					<span v-else class="muted">请先输入父SKU并加载</span>
				</el-form-item>

				<el-form-item label="变体" required>
					<el-select
						v-model="createForm.target_variant_ids"
						placeholder="请选择需要写文案的变体"
						filterable
						multiple
						clearable
						style="width: 100%"
					>
						<el-option
							v-for="item in createMeta?.variants || []"
							:key="item.id"
							:label="item.name || item.id"
							:value="item.id"
						/>
					</el-select>
				</el-form-item>

				<el-form-item label="亚马逊账号" required>
					<el-select
						v-model="createForm.target_amazon_account_id"
						placeholder="请选择账号"
						filterable
						clearable
						style="width: 100%"
					>
						<el-option
							v-for="item in createMeta?.accounts || []"
							:key="item.id"
							:label="`${item.name} (${item.id})`"
							:value="item.id"
						/>
					</el-select>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="createDialogVisible = false">取消</el-button>
				<el-button type="primary" :loading="submitting" @click="submitCreateTask"
					>提交任务</el-button
				>
			</template>
		</el-dialog>
		<el-dialog
			v-model="detailDialogVisible"
			title="AI 文案任务详情"
			width="88%"
			top="4vh"
			align-center
			@closed="fetchList"
		>
			<listing-ai-copy-task-detail
				v-if="detailTaskId"
				:task-id="detailTaskId"
				embedded
				@approved="fetchList"
				@close="detailDialogVisible = false"
			/>
		</el-dialog>
		<el-dialog
			v-model="preflightDialogVisible"
			title="补充参数重新提交"
			width="92%"
			top="3vh"
			align-center
		>
			<div v-if="preflightRow" v-loading="preflightLoading" class="preflight-dialog">
				<el-card v-if="preflightMeta" class="preflight-meta-card" shadow="never">
					<div class="preflight-meta-head">
						<div class="preflight-meta-title">选品信息</div>
					</div>
					<div class="preflight-meta-block">
						<div class="preflight-meta-grid">
							<div class="pf-meta-kv pf-meta-kv--name">
								<span class="pf-meta-key">名称</span>
								<span class="pf-meta-value">{{ preflightMeta.productTitle }}</span>
							</div>
							<div class="pf-meta-kv pf-meta-kv--image">
								<span class="pf-meta-key">图片</span>
								<div class="pf-meta-image-wrap">
									<el-image
										v-if="preflightMeta.candidateImageUrl"
										:src="preflightMeta.candidateImageUrl"
										fit="cover"
										class="pf-meta-image"
										:preview-src-list="[preflightMeta.candidateImageUrl]"
										preview-teleported
									/>
									<div v-else class="pf-meta-image pf-meta-image--empty">
										暂无图片
									</div>
								</div>
							</div>
							<div class="pf-meta-kv pf-meta-kv--sku">
								<span class="pf-meta-key">父SKU</span>
								<span class="pf-meta-value pf-meta-value--sku">
									<code class="pf-meta-code">{{ preflightMeta.sku }}</code>
									<el-button
										v-if="canOpenPreflightProductPage"
										link
										type="primary"
										class="open-product-btn"
										@click="openPreflightProductPage"
									>
										打开产品页
									</el-button>
								</span>
							</div>
							<div class="pf-meta-kv">
								<span class="pf-meta-key">关联账号</span>
								<span class="pf-meta-value">{{ preflightMeta.accountName }}</span>
							</div>
							<div class="pf-meta-kv">
								<span class="pf-meta-key">语言</span>
								<span class="pf-meta-value">
									<div
										v-if="preflightDisplayLanguages.length"
										class="pf-meta-lang-tags"
									>
										<el-tag
											v-for="lang in preflightDisplayLanguages"
											:key="lang"
											size="small"
											type="info"
											effect="plain"
										>
											{{ labelForRequiredLang(lang) }}
										</el-tag>
									</div>
									<span v-else class="muted">—</span>
								</span>
							</div>
							<div class="pf-meta-kv">
								<span class="pf-meta-key">申请人</span>
								<span class="pf-meta-value">{{ preflightMeta.applicantName }}</span>
							</div>
							<div class="pf-meta-kv">
								<span class="pf-meta-key">状态</span>
								<span class="pf-meta-value">
									<el-tag
										:type="phaseTagType(preflightMeta.phase)"
										size="small"
										>{{ phaseLabel(preflightMeta.phase) }}</el-tag
									>
								</span>
							</div>
							<div class="pf-meta-kv">
								<span class="pf-meta-key">任务类型</span>
								<span class="pf-meta-value">
									<el-tag
										size="small"
										:type="
											preflightMeta.taskMode === 'delta'
												? 'warning'
												: 'success'
										"
									>
										{{ preflightMeta.taskMode === "delta" ? "追加" : "主任务" }}
									</el-tag>
								</span>
							</div>
							<div class="pf-meta-kv">
								<span class="pf-meta-key">任务 ID</span>
								<span class="pf-meta-value"
									><code class="pf-meta-code">{{
										preflightMeta.taskRunId
									}}</code></span
								>
							</div>
							<div v-if="preflightMeta.taskMode === 'delta'" class="pf-meta-kv">
								<span class="pf-meta-key">父任务 ID</span>
								<span class="pf-meta-value">{{
									preflightMeta.rootTaskId || "—"
								}}</span>
							</div>
							<div v-if="preflightMeta.taskMode === 'delta'" class="pf-meta-kv">
								<span class="pf-meta-key">并入目标 ID</span>
								<span class="pf-meta-value">{{
									preflightMeta.mergeIntoTaskId || "—"
								}}</span>
							</div>
							<div class="pf-meta-kv pf-meta-kv--full">
								<span class="pf-meta-key">变体列表</span>
								<div class="pf-meta-variant-tags">
									<el-tag
										v-for="v in preflightMetaVariantTags"
										:key="v"
										size="small"
										type="info"
										effect="plain"
									>
										{{ v }}
									</el-tag>
									<span
										v-if="!preflightMetaVariantTags.length"
										class="pf-meta-value"
										>—</span
									>
								</div>
							</div>
							<div class="pf-meta-kv">
								<span class="pf-meta-key">失败阶段</span>
								<span class="pf-meta-value">{{ preflightMeta.failedStage }}</span>
							</div>
							<div class="pf-meta-kv">
								<span class="pf-meta-key">创建时间</span>
								<span class="pf-meta-value">{{ preflightMeta.createdAt }}</span>
							</div>
							<div class="pf-meta-kv">
								<span class="pf-meta-key">更新时间</span>
								<span class="pf-meta-value">{{ preflightMeta.updatedAt }}</span>
							</div>
						</div>
					</div>
				</el-card>

				<div class="preflight-overview">
					<div
						v-for="item in preflightChecks"
						:key="item.label"
						:class="['preflight-overview-card', item.ok ? 'is-ok' : 'is-error']"
					>
						<div class="overview-top">
							<span>{{ item.label }}</span>
							<el-tag size="small" :type="item.ok ? 'success' : 'danger'">
								{{ item.ok ? "满足" : "缺失" }}
							</el-tag>
						</div>
						<div class="overview-value mono">{{ item.currentText }}</div>
						<div class="overview-desc">{{ item.message }}</div>
					</div>
				</div>

				<el-alert
					v-if="showPreflightTaskErrorAlert"
					:title="preflightRow.errorMessage"
					type="error"
					:closable="false"
					show-icon
					class="preflight-alert"
				/>

				<el-collapse v-model="preflightCollapseNames" class="preflight-collapse">
					<el-collapse-item name="keywords">
						<template #title>
							<div class="collapse-title">
								<span>关键词块</span>
								<el-tag
									size="small"
									:type="keywordBlockOk ? 'success' : 'danger'"
									effect="plain"
								>
									英语 {{ keywordRows.en.length }}/{{ keywordRequiredLabel }} ·
									德语 {{ keywordRows.de.length }}/{{ keywordRequiredLabel }}
									<span v-if="preflightForceLowKeywords" class="force-kw-hint"
										>（强制）</span
									>
								</el-tag>
							</div>
						</template>
						<div class="manage-method">
							在各站点栏粘贴竞品 ASIN（每行一个，最多 20
							个），点「ASIN反查关键词」调用 SIF
							接口；在结果弹窗勾选后入库。也可在下方列表勾选关键词后批量删除。入库后刷新本页，每站点至少
							30 条（按 SIF 分/搜索量排序）。
						</div>
						<div v-if="keywordForceEligible" class="keyword-force-row">
							<el-checkbox v-model="preflightForceLowKeywords">
								该产品已无更多关键词可补充（强制提交：英/德关键词各需不少于 3 条）
							</el-checkbox>
						</div>
						<div class="two-column-grid">
							<div class="param-panel">
								<div class="param-panel-title">
									<span>英语 / 英国</span>
									<el-tag
										size="small"
										:type="keywordRows.en.length >= 30 ? 'success' : 'danger'"
									>
										{{ keywordRows.en.length }}/30
									</el-tag>
								</div>
								<div class="keyword-asin-bar">
									<el-input
										v-model="keywordUkAsinBulk"
										type="textarea"
										:rows="2"
										resize="vertical"
										placeholder="粘贴英国站竞品 ASIN，每行一个（最多20个）&#10;B0DM1SXB7G&#10;B0DZWVFWT6"
									/>
									<el-button
										type="primary"
										size="small"
										:loading="keywordUkFetching"
										@click="openKeywordReverse('uk')"
									>
										ASIN反查关键词
									</el-button>
								</div>
								<div class="keyword-table-toolbar">
									<el-button
										type="danger"
										size="small"
										plain
										:disabled="!keywordUkSelected.length"
										:loading="keywordUkDeleting"
										@click="batchDeletePreflightKeywords('uk')"
									>
										删除选中{{
											keywordUkSelected.length
												? ` (${keywordUkSelected.length})`
												: ""
										}}
									</el-button>
								</div>
								<el-table
									ref="keywordUkTableRef"
									:data="keywordRows.en"
									border
									size="small"
									max-height="360"
									@selection-change="onKeywordUkSelectionChange"
								>
									<el-table-column type="selection" width="42" />
									<el-table-column
										prop="value"
										label="关键词"
										min-width="180"
										show-overflow-tooltip
									/>
									<el-table-column
										prop="value_cn"
										label="中文"
										min-width="120"
										show-overflow-tooltip
									/>
									<el-table-column
										prop="search_volume_monthly"
										label="月搜索量"
										width="90"
										align="right"
									/>
									<el-table-column
										prop="sif_score"
										label="SIF分"
										width="80"
										align="right"
									/>
								</el-table>
							</div>
							<div class="param-panel">
								<div class="param-panel-title">
									<span>德语 / 德国</span>
									<el-tag
										size="small"
										:type="keywordRows.de.length >= 30 ? 'success' : 'danger'"
									>
										{{ keywordRows.de.length }}/30
									</el-tag>
								</div>
								<div class="keyword-asin-bar">
									<el-input
										v-model="keywordDeAsinBulk"
										type="textarea"
										:rows="2"
										resize="vertical"
										placeholder="粘贴德国站竞品 ASIN，每行一个（最多20个）&#10;B0DM1SXB7G&#10;B0DZWVFWT6"
									/>
									<el-button
										type="primary"
										size="small"
										:loading="keywordDeFetching"
										@click="openKeywordReverse('de')"
									>
										ASIN反查关键词
									</el-button>
								</div>
								<div class="keyword-table-toolbar">
									<el-button
										type="danger"
										size="small"
										plain
										:disabled="!keywordDeSelected.length"
										:loading="keywordDeDeleting"
										@click="batchDeletePreflightKeywords('de')"
									>
										删除选中{{
											keywordDeSelected.length
												? ` (${keywordDeSelected.length})`
												: ""
										}}
									</el-button>
								</div>
								<el-table
									ref="keywordDeTableRef"
									:data="keywordRows.de"
									border
									size="small"
									max-height="360"
									@selection-change="onKeywordDeSelectionChange"
								>
									<el-table-column type="selection" width="42" />
									<el-table-column
										prop="value"
										label="关键词"
										min-width="180"
										show-overflow-tooltip
									/>
									<el-table-column
										prop="value_cn"
										label="中文"
										min-width="120"
										show-overflow-tooltip
									/>
									<el-table-column
										prop="search_volume_monthly"
										label="月搜索量"
										width="90"
										align="right"
									/>
									<el-table-column
										prop="sif_score"
										label="SIF分"
										width="80"
										align="right"
									/>
								</el-table>
							</div>
						</div>
					</el-collapse-item>

					<el-collapse-item name="competitors">
						<template #title>
							<div class="collapse-title">
								<span>{{
									preflightReferenceSourceType === "manual_bullets"
										? "人工卖点块"
										: "竞品块"
								}}</span>
								<el-tag
									size="small"
									:type="competitorBlockOk ? 'success' : 'danger'"
									effect="plain"
								>
									<template
										v-if="preflightReferenceSourceType === 'manual_bullets'"
									>
										人工卖点
										{{
											preflightManualReferenceBullets.filter(Boolean).length
										}}/5
									</template>
									<template v-else>
										英国 {{ ukCompetitorSelectionLabel }} · 德国
										{{ deCompetitorSelectionLabel }}
									</template>
								</el-tag>
							</div>
						</template>
						<div class="reference-mode-panel">
							<div class="reference-mode-title">本次重提参考模式</div>
							<el-radio-group v-model="preflightReferenceSourceTypeDraft">
								<el-radio label="competitor">竞品模式</el-radio>
								<el-radio label="manual_bullets">人工卖点模式</el-radio>
							</el-radio-group>
						</div>
						<template v-if="preflightReferenceSourceType === 'manual_bullets'">
							<div class="manage-method">
								当前任务使用人工卖点模式，以下 5
								条卖点将直接作为文案生成主参考输入；可选填参考标题，供标题扩写阶段仿照整体表述风格。
							</div>
							<div class="param-panel">
								<div class="param-panel-title">
									<span>人工参考卖点</span>
									<el-tag
										size="small"
										:type="
											preflightManualReferenceBullets.filter(Boolean)
												.length === 5
												? 'success'
												: 'danger'
										"
									>
										{{
											preflightManualReferenceBullets.filter(Boolean).length
										}}/5
									</el-tag>
								</div>
								<div class="manual-bullet-list">
									<div
										v-for="(item, idx) in preflightManualReferenceBulletsDraft"
										:key="`manual-ref-${idx}`"
										class="manual-bullet-item"
									>
										<span class="manual-bullet-index">卖点{{ idx + 1 }}</span>
										<el-input
											v-model="preflightManualReferenceBulletsDraft[idx]"
											type="textarea"
											:autosize="{ minRows: 2, maxRows: 4 }"
											placeholder="可输入中文、英文或混合语言"
										/>
									</div>
									<div class="manual-bullet-item">
										<span class="manual-bullet-index">参考标题</span>
										<el-input
											v-model="preflightManualReferenceTitleDraft"
											type="textarea"
											:autosize="{ minRows: 1, maxRows: 3 }"
											placeholder="可选，标题扩写时可仿照此标题的整体意思与风格；支持中文、英文或混合"
										/>
									</div>
									<el-input
										v-model="preflightManualReferenceNotesDraft"
										type="textarea"
										:autosize="{ minRows: 2, maxRows: 4 }"
										placeholder="可选，补充风格、禁用点或注意事项"
									/>
								</div>
							</div>
						</template>
						<template v-else>
							<div class="manage-method">
								在各站点栏粘贴竞品 ASIN（每行一个，最多 20
								个），点「查询并添加」批量调用 Oxylabs
								拉取标题/卖点并入库（status=2）；已存在的 ASIN
								自动跳过。下方列表默认勾选销量前 4 条作为 AI
								参考竞品，可手动调整（每站点 1-4 条）。
							</div>
							<div class="block-toolbar">
								<span class="block-toolbar-status muted"
									>添加后立即入库；同站点已存在的 ASIN
									将直接提示，不会重复查询。</span
								>
							</div>
							<div class="two-column-grid">
								<div class="param-panel">
									<div class="param-panel-title">
										<span>英国竞品</span>
										<el-tag
											size="small"
											:type="ukCompetitorSelectionOk ? 'success' : 'danger'"
										>
											已选 {{ preflightSelectedCompetitorAsinsUk.length }}/4
										</el-tag>
									</div>
									<div class="competitor-add-bar">
										<el-input
											v-model="competitorUkAsinBulk"
											type="textarea"
											:rows="2"
											resize="vertical"
											:disabled="competitorUkAdding"
											placeholder="粘贴英国站竞品 ASIN，每行一个（最多20个）&#10;B0FN7N5PT9&#10;B0FJ2MH4VN"
										/>
										<el-button
											type="primary"
											size="small"
											:loading="competitorUkAdding"
											@click="addPreflightCompetitor('uk')"
										>
											查询并添加
										</el-button>
									</div>
									<el-table
										ref="competitorUkTableRef"
										:data="competitorRows.uk"
										border
										size="small"
										max-height="380"
										row-key="asin"
										@selection-change="onUkCompetitorSelectionChange"
									>
										<el-table-column
											type="selection"
											width="42"
											:selectable="(row) => competitorRowSelectable(row, 'uk')"
										/>
										<el-table-column label="ASIN" width="148">
											<template #default="{ row }">
												<div class="competitor-asin-cell">
													<el-image
														v-if="competitorImageUrl(row)"
														:src="competitorImageUrl(row)"
														fit="cover"
														class="competitor-thumb"
														:preview-src-list="[competitorImageUrl(row)]"
														preview-teleported
													/>
													<div v-else class="competitor-thumb competitor-thumb--empty">
														无图
													</div>
													<el-link
														v-if="row.asin"
														target="_blank"
														type="primary"
														:underline="false"
														class="competitor-asin-link"
														:href="
															getCompetitorAmazonDpUrl(
																row.asin,
																row.marketplace || '英国'
															)
														"
													>
														{{ row.asin }}
													</el-link>
													<span v-else>—</span>
												</div>
											</template>
										</el-table-column>
										<el-table-column
											prop="title"
											label="标题"
											min-width="220"
											show-overflow-tooltip
										/>
										<el-table-column
											prop="monthly_sales"
											label="月销"
											width="80"
											align="right"
										/>
										<el-table-column
											label="卖点"
											min-width="180"
											show-overflow-tooltip
										>
											<template #default="{ row }">{{
												row.bullet_points.join("；") || "—"
											}}</template>
										</el-table-column>
										<el-table-column label="操作" width="92" fixed="right">
											<template #default="{ row }">
												<el-button
													link
													type="primary"
													size="small"
													:disabled="!competitorNeedsSupplement(row)"
													:loading="competitorSupplementLoadingId === row.id"
													@click="supplementPreflightCompetitor(row)"
												>
													{{
														competitorNeedsSupplement(row)
															? "获取数据"
															: "已完整"
													}}
												</el-button>
											</template>
										</el-table-column>
									</el-table>
								</div>
								<div class="param-panel">
									<div class="param-panel-title">
										<span>德国竞品</span>
										<el-tag
											size="small"
											:type="deCompetitorSelectionOk ? 'success' : 'danger'"
										>
											已选 {{ preflightSelectedCompetitorAsinsDe.length }}/4
										</el-tag>
									</div>
									<div class="competitor-add-bar">
										<el-input
											v-model="competitorDeAsinBulk"
											type="textarea"
											:rows="2"
											resize="vertical"
											:disabled="competitorDeAdding"
											placeholder="粘贴德国站竞品 ASIN，每行一个（最多20个）&#10;B0F1FXGH1W"
										/>
										<el-button
											type="primary"
											size="small"
											:loading="competitorDeAdding"
											@click="addPreflightCompetitor('de')"
										>
											查询并添加
										</el-button>
									</div>
									<el-table
										ref="competitorDeTableRef"
										:data="competitorRows.de"
										border
										size="small"
										max-height="380"
										row-key="asin"
										@selection-change="onDeCompetitorSelectionChange"
									>
										<el-table-column
											type="selection"
											width="42"
											:selectable="(row) => competitorRowSelectable(row, 'de')"
										/>
										<el-table-column label="ASIN" width="148">
											<template #default="{ row }">
												<div class="competitor-asin-cell">
													<el-image
														v-if="competitorImageUrl(row)"
														:src="competitorImageUrl(row)"
														fit="cover"
														class="competitor-thumb"
														:preview-src-list="[competitorImageUrl(row)]"
														preview-teleported
													/>
													<div v-else class="competitor-thumb competitor-thumb--empty">
														无图
													</div>
													<el-link
														v-if="row.asin"
														target="_blank"
														type="primary"
														:underline="false"
														class="competitor-asin-link"
														:href="
															getCompetitorAmazonDpUrl(
																row.asin,
																row.marketplace || '德国'
															)
														"
													>
														{{ row.asin }}
													</el-link>
													<span v-else>—</span>
												</div>
											</template>
										</el-table-column>
										<el-table-column
											prop="title"
											label="标题"
											min-width="220"
											show-overflow-tooltip
										/>
										<el-table-column
											prop="monthly_sales"
											label="月销"
											width="80"
											align="right"
										/>
										<el-table-column
											label="卖点"
											min-width="180"
											show-overflow-tooltip
										>
											<template #default="{ row }">{{
												row.bullet_points.join("；") || "—"
											}}</template>
										</el-table-column>
										<el-table-column label="操作" width="92" fixed="right">
											<template #default="{ row }">
												<el-button
													link
													type="primary"
													size="small"
													:disabled="!competitorNeedsSupplement(row)"
													:loading="competitorSupplementLoadingId === row.id"
													@click="supplementPreflightCompetitor(row)"
												>
													{{
														competitorNeedsSupplement(row)
															? "获取数据"
															: "已完整"
													}}
												</el-button>
											</template>
										</el-table-column>
									</el-table>
								</div>
							</div>
						</template>
					</el-collapse-item>

					<el-collapse-item name="variants">
						<template #title>
							<div class="collapse-title">
								<span>变体块</span>
								<el-tag
									size="small"
									:type="variantBlockOk ? 'success' : 'danger'"
									effect="plain"
								>
									{{ variantRows.length }} 个变体
								</el-tag>
							</div>
						</template>
						<div class="manage-method">
							添加/修改方法：在选品变体里补齐名称和变体描述。这里展示的是当前任务已选中的变体。
						</div>
						<div class="block-toolbar">
							<span v-if="variantDirty" class="block-toolbar-status error-text"
								>有未保存变体改动</span
							>
							<span v-else class="block-toolbar-status muted">变体信息已同步</span>
							<el-button
								size="small"
								type="success"
								:disabled="!variantDirty || variantSaving"
								:loading="variantSaving"
								@click.stop="savePreflightVariants"
								>保存变体信息</el-button
							>
						</div>
						<el-table :data="variantRows" border size="small" max-height="420">
							<el-table-column
								prop="id"
								label="变体 ID"
								width="230"
								show-overflow-tooltip
							/>
							<el-table-column prop="name" label="名称" min-width="160">
								<template #default="{ row }">
									<el-input
										v-model.trim="row.name"
										placeholder="填写变体名称"
										clearable
										:disabled="!row.exists || row.deleted"
									/>
								</template>
							</el-table-column>
							<el-table-column prop="description" label="变体描述" min-width="360">
								<template #default="{ row }">
									<el-input
										v-model.trim="row.description"
										type="textarea"
										:rows="2"
										placeholder="填写这个变体用于写文案的差异点、规格、颜色、尺寸等"
										:disabled="!row.exists || row.deleted"
									/>
								</template>
							</el-table-column>
							<el-table-column label="状态" width="100" align="center">
								<template #default="{ row }">
									<el-tag
										size="small"
										:type="row.exists && !row.deleted ? 'success' : 'danger'"
									>
										{{ row.exists && !row.deleted ? "正常" : "异常" }}
									</el-tag>
								</template>
							</el-table-column>
						</el-table>
					</el-collapse-item>
				</el-collapse>

				<div v-if="preflightIssues.length" class="preflight-issues">
					<div class="preflight-issues-title">
						{{
							preflightReferenceSourceType === "manual_bullets"
								? "当前校验项"
								: "原始失败项"
						}}
					</div>
					<el-tag
						v-for="issue in preflightIssues"
						:key="issue"
						type="danger"
						effect="plain"
						class="preflight-issue-tag"
					>
						{{ issue }}
					</el-tag>
				</div>

				<batch-keyword-result
					v-model:visible="keywordUkResultVisible"
					:asin="preflightKeywordMainAsin"
					:product-code="preflightKeywordProductCode"
					marketplaces="英国"
					:competitor-asins="keywordUkCompetitorAsins"
					@saved="onKeywordBatchSaved"
				/>
				<batch-keyword-result
					v-model:visible="keywordDeResultVisible"
					:asin="preflightKeywordMainAsin"
					:product-code="preflightKeywordProductCode"
					marketplaces="德国"
					:competitor-asins="keywordDeCompetitorAsins"
					@saved="onKeywordBatchSaved"
				/>
			</div>
			<template #footer>
				<div class="preflight-dialog-footer">
					<div
						v-if="preflightRetryLanguageOptions.length"
						class="preflight-retry-lang-group"
					>
						<span class="preflight-retry-lang-label">本次重新提交生成语言</span>
						<el-checkbox-group
							v-model="preflightSelectedLanguages"
							class="preflight-retry-lang-options"
						>
							<el-checkbox
								v-for="lang in preflightRetryLanguageOptions"
								:key="lang"
								:label="lang"
							>
								{{ labelForRequiredLang(lang) }}
							</el-checkbox>
						</el-checkbox-group>
					</div>
					<el-button :loading="preflightLoading" @click="refreshPreflightParams"
						>刷新校验数据</el-button
					>
					<el-button @click="preflightDialogVisible = false">关闭</el-button>
					<el-button
						type="primary"
						:disabled="!preflightRow || variantDirty"
						:loading="preflightRow ? retryingIds.has(preflightRow.id) : false"
						@click="retryPreflightTask"
						>补齐后重新提交</el-button
					>
				</div>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts" name="app-listing-ai-copy-task-list">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { service } from "/@/cool";
import { product_main_image_display_url } from "/$/app/utils";
import { appConfig } from "../../../../../appConfig";
// @ts-ignore
import LazyActivityTimeline from "/$/app/components/lazy-activity-timeline.vue";
import { fetchAiListingTimelineItems } from "/$/app/utils/activity-timeline";
// @ts-ignore
import ListingAiCopyTaskDetail from "./listing-ai-copy-task-detail.vue";
import {
	labelForRequiredLang,
	normalizeRequiredLanguages,
	type ListingAiRequiredLang
} from "../utils/listing-ai-required-languages";
import {
	isAiListingReviewApprovedStage,
	isAiListingReviewClosedStage
} from "../utils/listing-ai-review-stage";
import { canShowTriggerDeButton } from "../utils/listing-ai-copy-task-actions";
// @ts-ignore
import BatchKeywordResult from "/$/app/components/BatchKeywordResult.vue";

const router = useRouter();

type ListingAiRunPhase =
	| "queued"
	| "params_running"
	| "copy_running"
	| "awaiting_review"
	| "done"
	| "closed"
	| "failed"
	| "cancelled";

type ListingAiRow = {
	id: number;
	phase: ListingAiRunPhase;
	taskMode: "full" | "delta";
	rootTaskId: number | null;
	mergeIntoTaskId: number | null;
	msku: string;
	sku: string;
	asin: string;
	productTitle: string;
	candidateImageUrl: string;
	accountName: string;
	applicantName: string;
	goTaskId: string;
	variantIds: string[];
	variantNames: string[];
	variantCount: number;
	requiredLanguages: ListingAiRequiredLang[];
	marketplace: string;
	createdAt: string;
	updatedAt: string;
	errorMessage: string;
	failedStage: string;
	status: number;
	progressPercent: number;
	canTriggerDe?: boolean;
};

const LISTING_AI_RUN_PHASE_OPTIONS: Array<{ value: ListingAiRunPhase | ""; label: string }> = [
	{ value: "", label: "全部阶段" },
	{ value: "queued", label: "排队中" },
	{ value: "params_running", label: "选词调研中" },
	{ value: "copy_running", label: "文案生成中" },
	{ value: "awaiting_review", label: "待 Studio 确认" },
	{ value: "done", label: "已完成" },
	{ value: "closed", label: "已关闭" },
	{ value: "failed", label: "失败" },
	{ value: "cancelled", label: "已取消" }
];

const filters = reactive({
	keyword: "",
	phase: "" as ListingAiRunPhase | "",
	accountId: "",
	applicantId: "",
	onlyFailed: false,
	onlyPendingReview: false,
	onlyClosed: false
});
const accountOptions = ref<Array<{ value: string; label: string }>>([]);
const applicantOptions = ref<Array<{ value: string; label: string }>>([]);

const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);
const total = ref(0);
const rows = ref<ListingAiRow[]>([]);
const retryingIds = reactive(new Set<number>());
const closingIds = reactive(new Set<number>());
const triggerDeIds = reactive(new Set<number>());
const createDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const detailTaskId = ref<number>(0);
const preflightDialogVisible = ref(false);
const preflightRow = ref<ListingAiRow | null>(null);
const preflightLoading = ref(false);
const variantSaving = ref(false);
const competitorUkAsinBulk = ref("");
const competitorDeAsinBulk = ref("");
const competitorUkAdding = ref(false);
const competitorDeAdding = ref(false);
const competitorSupplementLoadingId = ref<number | null>(null);
const competitorUkTableRef = ref<any>(null);
const competitorDeTableRef = ref<any>(null);
const preflightSelectedCompetitorAsinsUk = ref<string[]>([]);
const preflightSelectedCompetitorAsinsDe = ref<string[]>([]);
/** 程序化同步表格勾选时忽略 selection-change，避免 clearSelection 清空已选 ASIN */
const competitorSelectionSyncing = ref(false);
const keywordUkAsinBulk = ref("");
const keywordDeAsinBulk = ref("");
const keywordUkFetching = ref(false);
const keywordDeFetching = ref(false);
const keywordUkResultVisible = ref(false);
const keywordDeResultVisible = ref(false);
const keywordUkCompetitorAsins = ref<string[]>([]);
const keywordDeCompetitorAsins = ref<string[]>([]);
const keywordUkTableRef = ref<any>(null);
const keywordDeTableRef = ref<any>(null);
const keywordUkSelected = ref<PreflightKeywordRow[]>([]);
const keywordDeSelected = ref<PreflightKeywordRow[]>([]);
const keywordUkDeleting = ref(false);
const keywordDeDeleting = ref(false);
const preflightParams = ref<PreflightParamsResp | null>(null);
const preflightForceLowKeywords = ref(false);
/** 补充参数重新提交：是否在本次任务中生成德国文案（仅影响校验范围与 retry 入参） */
const preflightSelectedLanguages = ref<Array<"en" | "de">>([]);
const preflightVariantSnapshot = ref("");
const preflightCollapseNames = ref<string[]>(["keywords", "competitors", "variants"]);
const metaLoading = ref(false);
const submitting = ref(false);

const createForm = reactive({
	sku: "",
	target_candidate_id: 0,
	target_variant_ids: [] as string[],
	target_amazon_account_id: ""
});

type CreateMetaResp = {
	candidate: {
		id: number;
		sku: string;
		asin?: string;
		marketplace?: string;
		produce_name?: string;
	};
	variants: Array<{ id: string; name: string; msku?: string }>;
	accounts: Array<{ id: string; name: string }>;
} | null;

const createMeta = ref<CreateMetaResp>(null);

const filteredTotal = computed(() => total.value);
const pageRows = computed(() => rows.value);
const PREFLIGHT_MIN_KEYWORDS = 30;
const PREFLIGHT_FORCE_KEYWORD_MIN = 3;

type PreflightCheckRow = {
	label: string;
	hint?: string;
	currentText: string;
	requiredText: string;
	ok: boolean;
	message: string;
	/** 当前任务 preflight 范围外，仅展示不要求 */
	skipped?: boolean;
};

type PreflightKeywordRow = {
	id: number;
	value: string;
	value_cn: string;
	search_volume_monthly: number;
	sif_score: number | null;
};

type PreflightCompetitorRow = {
	id: number;
	asin: string;
	marketplace?: string;
	title: string;
	image_url?: string;
	bullet_points: string[];
	monthly_sales: number;
};

type PreflightVariantRow = {
	id: string;
	exists: boolean;
	deleted: boolean;
	name: string;
	description: string;
};

type PreflightParamsResp = {
	task?: {
		id?: number;
		mode?: string;
		candidate_id?: number;
		amazon_account_id?: string;
		variant_ids?: string[];
		reference_source_type?: "manual_bullets" | "competitor";
	};
	candidate?: {
		id?: number;
		asin?: string;
		sku?: string;
		produce_name?: string;
		marketplace?: string;
	};
	preflight?: {
		force_low_keywords?: boolean;
	};
	reference_input?: {
		reference_source_type?: "manual_bullets" | "competitor";
		manual_reference_bullets?: string[];
		manual_reference_notes?: string;
		manual_reference_title?: string;
		reference_competitor_asins?: {
			uk?: string[];
			de?: string[];
		};
	};
	details?: Record<string, any>;
	keywords?: {
		en?: PreflightKeywordRow[];
		de?: PreflightKeywordRow[];
	};
	competitors?: {
		uk?: PreflightCompetitorRow[];
		de?: PreflightCompetitorRow[];
	};
	variants?: PreflightVariantRow[];
	/** 与列表「语言」列一致：店铺采购 uk/de */
	required_languages?: Array<"en" | "de">;
	preflight_scope?: Array<"en" | "de">;
	task_requested_languages?: Array<"en" | "de">;
};

const preflightReferenceSourceTypeDraft = ref<"manual_bullets" | "competitor">("competitor");
const preflightManualReferenceBulletsDraft = ref<string[]>(["", "", "", "", ""]);
const preflightManualReferenceNotesDraft = ref("");
const preflightManualReferenceTitleDraft = ref("");

const preflightReferenceSourceType = computed<"manual_bullets" | "competitor">(
	() => preflightReferenceSourceTypeDraft.value
);

const preflightManualReferenceBullets = computed(() =>
	preflightManualReferenceBulletsDraft.value.map((x) => String(x || "").trim())
);

const preflightDetails = computed<Record<string, any>>(() => preflightParams.value?.details || {});

function buildManualPreflightIssues(): string[] {
	const issues: string[] = [];
	const bullets = preflightManualReferenceBullets.value;
	if (bullets.length !== 5) {
		issues.push("人工卖点必须提供 5 条");
	}
	bullets.forEach((item, index) => {
		if (!item) issues.push(`人工卖点第 ${index + 1} 条为空`);
	});
	return issues;
}

const keywordRows = computed(() => ({
	en: preflightParams.value?.keywords?.en || [],
	de: preflightParams.value?.keywords?.de || []
}));

const competitorRows = computed(() => ({
	uk: preflightParams.value?.competitors?.uk || [],
	de: preflightParams.value?.competitors?.de || []
}));

const PREFLIGHT_MAX_REFERENCE_COMPETITORS = 4;

function normalizePreflightCompetitorAsin(raw: string) {
	return String(raw || "")
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
}

function resolveCompetitorSelectionAsins(
	rows: PreflightCompetitorRow[],
	saved?: string[]
) {
	const rowAsins = rows
		.map((row) => normalizePreflightCompetitorAsin(row.asin))
		.filter((asin) => asin.length === 10);
	const validSaved = (saved || [])
		.map((asin) => normalizePreflightCompetitorAsin(asin))
		.filter((asin) => rowAsins.includes(asin));
	const uniqueSaved = Array.from(new Set(validSaved)).slice(
		0,
		PREFLIGHT_MAX_REFERENCE_COMPETITORS
	);
	if (uniqueSaved.length) return uniqueSaved;
	return rowAsins.slice(0, PREFLIGHT_MAX_REFERENCE_COMPETITORS);
}

function buildReferenceCompetitorAsinsPayload() {
	return {
		uk: preflightSelectedCompetitorAsinsUk.value
			.map((asin) => normalizePreflightCompetitorAsin(asin))
			.filter((asin) => asin.length === 10)
			.slice(0, PREFLIGHT_MAX_REFERENCE_COMPETITORS),
		de: preflightSelectedCompetitorAsinsDe.value
			.map((asin) => normalizePreflightCompetitorAsin(asin))
			.filter((asin) => asin.length === 10)
			.slice(0, PREFLIGHT_MAX_REFERENCE_COMPETITORS)
	};
}

function competitorSelectionCountOk(count: number) {
	return count >= 0 && count <= PREFLIGHT_MAX_REFERENCE_COMPETITORS;
}

const ukCompetitorSelectionOk = computed(() =>
	competitorSelectionCountOk(preflightSelectedCompetitorAsinsUk.value.length)
);
const deCompetitorSelectionOk = computed(() =>
	competitorSelectionCountOk(preflightSelectedCompetitorAsinsDe.value.length)
);
const ukCompetitorSelectionLabel = computed(() => {
	const selected = preflightSelectedCompetitorAsinsUk.value.length;
	return selected > 0 ? `已选${selected}` : "自动选Top4";
});
const deCompetitorSelectionLabel = computed(() => {
	const selected = preflightSelectedCompetitorAsinsDe.value.length;
	return selected > 0 ? `已选${selected}` : "自动选Top4";
});

function competitorRowSelectable(row: PreflightCompetitorRow, country: "uk" | "de") {
	const asin = normalizePreflightCompetitorAsin(row.asin);
	const selected =
		country === "uk"
			? preflightSelectedCompetitorAsinsUk.value
			: preflightSelectedCompetitorAsinsDe.value;
	if (selected.includes(asin)) return true;
	return selected.length < PREFLIGHT_MAX_REFERENCE_COMPETITORS;
}

function onUkCompetitorSelectionChange(rows: PreflightCompetitorRow[]) {
	if (competitorSelectionSyncing.value || preflightLoading.value) return;
	preflightSelectedCompetitorAsinsUk.value = (Array.isArray(rows) ? rows : [])
		.map((row) => normalizePreflightCompetitorAsin(row.asin))
		.filter((asin) => asin.length === 10)
		.slice(0, PREFLIGHT_MAX_REFERENCE_COMPETITORS);
}

function onDeCompetitorSelectionChange(rows: PreflightCompetitorRow[]) {
	if (competitorSelectionSyncing.value || preflightLoading.value) return;
	preflightSelectedCompetitorAsinsDe.value = (Array.isArray(rows) ? rows : [])
		.map((row) => normalizePreflightCompetitorAsin(row.asin))
		.filter((asin) => asin.length === 10)
		.slice(0, PREFLIGHT_MAX_REFERENCE_COMPETITORS);
}

function applyCompetitorTableSelection(
	country: "uk" | "de",
	targetAsins: string[]
) {
	const tableRef = country === "uk" ? competitorUkTableRef : competitorDeTableRef;
	const rows = country === "uk" ? competitorRows.value.uk : competitorRows.value.de;
	const selected = new Set(targetAsins);
	tableRef.value?.clearSelection?.();
	for (const row of rows) {
		const asin = normalizePreflightCompetitorAsin(row.asin);
		if (selected.has(asin)) {
			tableRef.value?.toggleRowSelection?.(row, true);
		}
	}
}

type ReferenceCompetitorAsinsPayload = {
	uk: string[];
	de: string[];
};

function restoreCompetitorSelection(asins: ReferenceCompetitorAsinsPayload) {
	const ukAsins = asins.uk
		.map((asin) => normalizePreflightCompetitorAsin(asin))
		.filter((asin) => asin.length === 10)
		.slice(0, PREFLIGHT_MAX_REFERENCE_COMPETITORS);
	const deAsins = asins.de
		.map((asin) => normalizePreflightCompetitorAsin(asin))
		.filter((asin) => asin.length === 10)
		.slice(0, PREFLIGHT_MAX_REFERENCE_COMPETITORS);
	preflightSelectedCompetitorAsinsUk.value = [...ukAsins];
	preflightSelectedCompetitorAsinsDe.value = [...deAsins];
	competitorSelectionSyncing.value = true;
	nextTick(() => {
		applyCompetitorTableSelection("uk", ukAsins);
		applyCompetitorTableSelection("de", deAsins);
		preflightSelectedCompetitorAsinsUk.value = [...ukAsins];
		preflightSelectedCompetitorAsinsDe.value = [...deAsins];
		void nextTick(() => {
			void nextTick(() => {
				competitorSelectionSyncing.value = false;
			});
		});
	});
}

function syncCompetitorSelectionFromParams() {
	const refInput = preflightParams.value?.reference_input || {};
	const saved = refInput.reference_competitor_asins || {};
	restoreCompetitorSelection({
		uk: resolveCompetitorSelectionAsins(competitorRows.value.uk, saved.uk),
		de: resolveCompetitorSelectionAsins(competitorRows.value.de, saved.de)
	});
}

function isCompetitorSelectionPayloadOk(asins: ReferenceCompetitorAsinsPayload) {
	if (preflightReferenceSourceType.value === "manual_bullets") return true;
	if (preflightTaskMode.value === "delta") return true;
	if (!preflightScope.value.length) return true;
	if (preflightRequiresEn.value && asins.uk.length > PREFLIGHT_MAX_REFERENCE_COMPETITORS) {
		return false;
	}
	if (preflightRequiresDe.value && asins.de.length > PREFLIGHT_MAX_REFERENCE_COMPETITORS) {
		return false;
	}
	return true;
}

function validatePreflightCompetitorSelection(asins?: ReferenceCompetitorAsinsPayload): string | null {
	if (preflightReferenceSourceType.value === "manual_bullets") return null;
	if (preflightTaskMode.value === "delta") return null;
	if (!preflightScope.value.length) return null;
	const ukCount = asins?.uk.length ?? preflightSelectedCompetitorAsinsUk.value.length;
	const deCount = asins?.de.length ?? preflightSelectedCompetitorAsinsDe.value.length;
	if (preflightRequiresEn.value && ukCount > PREFLIGHT_MAX_REFERENCE_COMPETITORS) {
		return `英国参考竞品已选 ${ukCount} 条，最多 4 条`;
	}
	if (preflightRequiresDe.value && deCount > PREFLIGHT_MAX_REFERENCE_COMPETITORS) {
		return `德国参考竞品已选 ${deCount} 条，最多 4 条`;
	}
	return null;
}

const variantRows = computed(() => {
	const rows = preflightParams.value?.variants;
	if (Array.isArray(rows)) return rows;
	const row = preflightRow.value;
	if (!row) return [];
	return row.variantIds.map((id, index) => ({
		id,
		exists: true,
		deleted: false,
		name: row.variantNames[index] || "",
		description: ""
	}));
});

const preflightMeta = computed(() => {
	const row = preflightRow.value;
	const cand = preflightParams.value?.candidate;
	if (!row) return null;
	const productTitle = String(row.productTitle || cand?.produce_name || "").trim() || "—";
	const sku = String(row.sku || cand?.sku || "").trim() || "—";
	const asin = String(row.asin || cand?.asin || "").trim();
	const marketplace = String(row.marketplace || cand?.marketplace || "").trim();
	return {
		productTitle,
		sku,
		asin,
		marketplace,
		candidateImageUrl: String(row.candidateImageUrl || "").trim(),
		accountName: String(row.accountName || "").trim() || "—",
		applicantName: String(row.applicantName || "").trim() || "—",
		phase: row.phase,
		taskMode: row.taskMode,
		taskRunId:
			String(row.goTaskId || "").trim() ||
			String(preflightParams.value?.task?.id || row.id || "").trim() ||
			"—",
		rootTaskId: row.rootTaskId,
		mergeIntoTaskId: row.mergeIntoTaskId,
		failedStage: String(row.failedStage || "").trim() || "—",
		createdAt: String(row.createdAt || "").trim() || "—",
		updatedAt: String(row.updatedAt || "").trim() || "—"
	};
});

const preflightMetaVariantTags = computed(() => {
	const names = [
		...variantRows.value.map((row) => String(row.name || "").trim()),
		...(preflightRow.value?.variantNames || []).map((x) => String(x || "").trim())
	].filter(Boolean);
	return Array.from(new Set(names));
});

/** 与列表「语言」列一致：店铺采购 uk/de（非 task flow_context.requested_languages） */
function resolvePreflightShopLanguages(): ListingAiRequiredLang[] {
	return normalizeRequiredLanguages(
		preflightParams.value?.required_languages ?? preflightRow.value?.requiredLanguages
	);
}

const preflightDisplayLanguages = computed((): ListingAiRequiredLang[] =>
	resolvePreflightShopLanguages()
);

const canOpenPreflightProductPage = computed(() => {
	const meta = preflightMeta.value;
	return Boolean(meta?.asin && meta?.marketplace);
});

function openPreflightProductPage() {
	const meta = preflightMeta.value;
	if (!meta?.asin || !meta.marketplace) return;
	const cleanAsin = String(meta.asin).replace(/[^A-Z0-9]/g, "");
	if (!cleanAsin) return;
	window.open(appConfig.get_amazon_url_dp(cleanAsin, meta.marketplace));
}

const preflightKeywordMainAsin = computed(() => {
	const raw = String(preflightMeta.value?.asin || "").trim();
	return raw.replace(/[^A-Z0-9]/g, "");
});

const preflightKeywordProductCode = computed(() => {
	const sku = String(preflightMeta.value?.sku || "").trim();
	if (!sku || sku === "—") return "";
	return sku;
});

function parseKeywordCompetitorAsins(text: string): string[] {
	return text
		.split(/[\n\r,;\s\t]+/)
		.map((s) => s.trim().toUpperCase())
		.filter((s) => /^[A-Z0-9]{10}$/.test(s));
}

async function openKeywordReverse(countryCode: "uk" | "de") {
	const isUk = countryCode === "uk";
	const siteLabel = isUk ? "英国" : "德国";
	const loadingRef = isUk ? keywordUkFetching : keywordDeFetching;
	const bulkRef = isUk ? keywordUkAsinBulk : keywordDeAsinBulk;

	if (!preflightKeywordMainAsin.value) {
		ElMessage.warning("缺少选品主 ASIN，请先刷新校验数据");
		return;
	}
	if (!preflightKeywordProductCode.value) {
		ElMessage.warning("缺少父SKU（产品编码），无法反查关键词");
		return;
	}

	const parsed = Array.from(new Set(parseKeywordCompetitorAsins(bulkRef.value)));
	if (!parsed.length) {
		ElMessage.warning(`请粘贴至少一个有效${siteLabel}站竞品 ASIN（每行一个，10位字母数字）`);
		return;
	}
	if (parsed.length > 20) {
		ElMessage.warning("单次最多支持 20 个竞品 ASIN");
		return;
	}

	loadingRef.value = true;
	try {
		if (isUk) {
			keywordUkCompetitorAsins.value = parsed;
			keywordUkResultVisible.value = true;
		} else {
			keywordDeCompetitorAsins.value = parsed;
			keywordDeResultVisible.value = true;
		}
	} finally {
		loadingRef.value = false;
	}
}

async function onKeywordBatchSaved() {
	await refreshPreflightParams();
	clearPreflightKeywordSelection();
	ElMessage.success("关键词已入库，列表已刷新");
}

function onKeywordUkSelectionChange(rows: PreflightKeywordRow[]) {
	keywordUkSelected.value = Array.isArray(rows) ? rows : [];
}

function onKeywordDeSelectionChange(rows: PreflightKeywordRow[]) {
	keywordDeSelected.value = Array.isArray(rows) ? rows : [];
}

function clearPreflightKeywordSelection() {
	keywordUkSelected.value = [];
	keywordDeSelected.value = [];
	keywordUkTableRef.value?.clearSelection?.();
	keywordDeTableRef.value?.clearSelection?.();
}

function buildPreflightKeywordDeleteScope(countryCode: "uk" | "de") {
	return {
		marketplace: countryCode === "de" ? "德国" : "英国",
		product_code: preflightKeywordProductCode.value,
		asin_self: preflightKeywordMainAsin.value
	};
}

async function batchDeletePreflightKeywords(countryCode: "uk" | "de") {
	const isUk = countryCode === "uk";
	const selected = isUk ? keywordUkSelected.value : keywordDeSelected.value;
	const deletingRef = isUk ? keywordUkDeleting : keywordDeDeleting;
	const siteLabel = isUk ? "英国" : "德国";

	if (!selected.length) {
		ElMessage.warning("请先勾选需要删除的关键词");
		return;
	}

	const ids = selected.map((row) => Number(row.id)).filter((id) => id > 0);
	if (!ids.length) {
		ElMessage.warning("缺少关键词 ID，无法删除");
		return;
	}

	const preview = selected
		.map((row) => String(row.value || "").trim())
		.filter(Boolean)
		.slice(0, 5)
		.join("、");
	const previewSuffix = selected.length > 5 ? ` 等 ${selected.length} 个` : "";

	try {
		await ElMessageBox.confirm(
			`将从关键词表永久删除 ${siteLabel}站 ${ids.length} 条关键词（${preview}${previewSuffix}），并清理相关默认配置。`,
			"确认删除关键词",
			{
				type: "warning",
				confirmButtonText: "确认删除",
				cancelButtonText: "取消"
			}
		);
	} catch {
		return;
	}

	deletingRef.value = true;
	try {
		const res = await service.request({
			url: "/admin/app/sifKeyword/deleteKeywords",
			method: "POST",
			data: {
				ids,
				tracking_scope: buildPreflightKeywordDeleteScope(countryCode)
			}
		});
		const deletedCount = Number(res?.deleted_count ?? ids.length);
		let msg = `已删除 ${deletedCount} 个关键词`;
		if (Number(res?.tracking_stopped_count || 0) > 0) {
			msg += `，取消跟踪 ${res.tracking_stopped_count} 条`;
		}
		ElMessage.success(msg);
		await refreshPreflightParams();
		clearPreflightKeywordSelection();
	} catch (err: any) {
		ElMessage.error(err?.message || "删除关键词失败");
	} finally {
		deletingRef.value = false;
	}
}

function buildVariantPayload() {
	return variantRows.value.map((row) => ({
		id: String(row.id || "").trim(),
		name: String(row.name || "").trim(),
		description: String(row.description || "").trim()
	}));
}

const variantDirty = computed(() => {
	if (!preflightRow.value || !preflightParams.value) return false;
	return JSON.stringify(buildVariantPayload()) !== preflightVariantSnapshot.value;
});

const preflightTaskMode = computed(() => {
	const mode = preflightParams.value?.task?.mode || preflightRow.value?.taskMode || "full";
	return mode === "delta" ? "delta" : "full";
});

/** 补充参数校验范围：与列表语言列同源；delta 为空表示只验变体 */
const preflightScope = computed((): Array<"en" | "de"> => {
	if (preflightTaskMode.value === "delta") return [];
	return resolvePreflightShopLanguages();
});

/** 任务配置上的 preflight 范围（接口返回） */
const preflightRetryLanguageOptions = computed((): Array<"en" | "de"> => {
	if (preflightTaskMode.value === "delta") return [];
	return ["en", "de"];
});

/** 用户勾选后的实际校验/提交范围 */
const effectivePreflightScope = computed((): Array<"en" | "de"> => {
	if (preflightTaskMode.value === "delta") return [];
	const selected = normalizeRequiredLanguages(preflightSelectedLanguages.value) as Array<
		"en" | "de"
	>;
	const base = preflightRetryLanguageOptions.value;
	return base.filter((lang) => selected.includes(lang));
});

const preflightRequiresEn = computed(() => effectivePreflightScope.value.includes("en"));
const preflightRequiresDe = computed(() => effectivePreflightScope.value.includes("de"));

function syncPreflightSelectedLanguages(options?: Array<"en" | "de">) {
	const hasExplicitOptions = Array.isArray(options);
	const base = hasExplicitOptions ? options : preflightRetryLanguageOptions.value;
	const normalizedBase = normalizeRequiredLanguages(base) as Array<"en" | "de">;
	const normalizedSelected = normalizeRequiredLanguages(
		preflightSelectedLanguages.value
	) as Array<"en" | "de">;
	const next = normalizedBase.filter((lang) => normalizedSelected.includes(lang));
	if (hasExplicitOptions) {
		preflightSelectedLanguages.value = [...next];
		return;
	}
	preflightSelectedLanguages.value = next.length ? next : [...normalizedBase];
}

function buildRetryRequestedLanguages(): Array<"en" | "de"> {
	return [...effectivePreflightScope.value];
}

function keywordCountMeetsRequirement(count: number) {
	if (preflightForceLowKeywords.value) {
		return count >= PREFLIGHT_FORCE_KEYWORD_MIN;
	}
	return count >= PREFLIGHT_MIN_KEYWORDS;
}

function buildManualModePreflightIssues(): string[] {
	const issues = buildManualPreflightIssues();
	if (preflightTaskMode.value === "delta" || !effectivePreflightScope.value.length) {
		return issues;
	}
	const scope = effectivePreflightScope.value;
	const kwLabel = preflightForceLowKeywords.value
		? `>= ${PREFLIGHT_FORCE_KEYWORD_MIN}`
		: `>= ${PREFLIGHT_MIN_KEYWORDS}`;
	if (scope.includes("en") && !keywordCountMeetsRequirement(keywordRows.value.en.length)) {
		issues.push(`英国关键词 ${keywordRows.value.en.length}/${kwLabel}`);
	}
	if (scope.includes("de") && !keywordCountMeetsRequirement(keywordRows.value.de.length)) {
		issues.push(`德国关键词 ${keywordRows.value.de.length}/${kwLabel}`);
	}
	return issues;
}

const preflightIssues = computed(() => {
	if (preflightReferenceSourceType.value === "manual_bullets") {
		return buildManualModePreflightIssues();
	}
	const issues = preflightDetails.value?.issues;
	return Array.isArray(issues) ? issues.map((x: any) => String(x || "")).filter(Boolean) : [];
});

const keywordRequiredLabel = computed(() =>
	preflightForceLowKeywords.value
		? `>=${PREFLIGHT_FORCE_KEYWORD_MIN}`
		: String(PREFLIGHT_MIN_KEYWORDS)
);

const keywordForceEligible = computed(() => {
	if (preflightTaskMode.value !== "full" || !preflightScope.value.length) return false;
	const checks: boolean[] = [];
	if (preflightRequiresEn.value) {
		const uk = keywordRows.value.en.length;
		checks.push(uk < PREFLIGHT_MIN_KEYWORDS && uk >= PREFLIGHT_FORCE_KEYWORD_MIN);
	}
	if (preflightRequiresDe.value) {
		const de = keywordRows.value.de.length;
		checks.push(de < PREFLIGHT_MIN_KEYWORDS && de >= PREFLIGHT_FORCE_KEYWORD_MIN);
	}
	return checks.length > 0 && checks.every(Boolean);
});

const keywordBlockOk = computed(() => {
	if (preflightTaskMode.value === "delta") return true;
	if (!preflightScope.value.length) return true;
	let ok = true;
	if (preflightRequiresEn.value) {
		ok = ok && keywordCountMeetsRequirement(keywordRows.value.en.length);
	}
	if (preflightRequiresDe.value) {
		ok = ok && keywordCountMeetsRequirement(keywordRows.value.de.length);
	}
	return ok;
});

watch(keywordForceEligible, (eligible) => {
	if (!eligible) preflightForceLowKeywords.value = false;
});
const competitorBlockOk = computed(() => {
	if (preflightReferenceSourceType.value === "manual_bullets") return true;
	if (preflightTaskMode.value === "delta") return true;
	if (!preflightScope.value.length) return true;
	let ok = true;
	if (preflightRequiresEn.value) {
		ok = ok && ukCompetitorSelectionOk.value;
	}
	if (preflightRequiresDe.value) {
		ok = ok && deCompetitorSelectionOk.value;
	}
	return ok;
});
const variantBlockOk = computed(
	() =>
		variantRows.value.length >= 1 &&
		variantRows.value.every(
			(row) =>
				row.exists &&
				!row.deleted &&
				String(row.name || "").trim() &&
				String(row.description || "").trim()
		)
);
const preflightAllOk = computed(() => {
	if (preflightTaskMode.value === "delta") return variantBlockOk.value;
	return keywordBlockOk.value && competitorBlockOk.value && variantBlockOk.value;
});

const showPreflightTaskErrorAlert = computed(() => {
	const row = preflightRow.value;
	const msg = String(row?.errorMessage || "").trim();
	if (!msg) return false;
	if (preflightReferenceSourceType.value === "manual_bullets") {
		return !preflightAllOk.value;
	}
	return true;
});

const preflightChecks = computed<PreflightCheckRow[]>(() => {
	const row = preflightRow.value;
	if (!row) return [];
	const details = preflightDetails.value;
	const issues = preflightIssues.value;
	const hasIssue = (keyword: string) => issues.some((issue) => issue.includes(keyword));
	const numberValue = (key: string) => {
		const n = Number(details[key]);
		return Number.isFinite(n) ? n : 0;
	};
	const ukKeywordCount = preflightParams.value
		? keywordRows.value.en.length
		: numberValue("uk_keyword_count");
	const deKeywordCount = preflightParams.value
		? keywordRows.value.de.length
		: numberValue("de_keyword_count");
	const ukCompetitorCount = preflightParams.value
		? preflightSelectedCompetitorAsinsUk.value.length
		: numberValue("uk_competitor_count");
	const deCompetitorCount = preflightParams.value
		? preflightSelectedCompetitorAsinsDe.value.length
		: numberValue("de_competitor_count");
	const variantIds = Array.isArray(details.variant_ids)
		? details.variant_ids.map((x: any) => String(x || "").trim()).filter(Boolean)
		: row.variantIds;
	const variantCount = variantIds.length;
	const variantExistsOk =
		variantRows.value.length > 0 &&
		variantRows.value.every((item) => item.exists && !item.deleted);
	const variantNameOk =
		variantRows.value.length > 0 &&
		variantRows.value.every((item) => String(item.name || "").trim());
	const variantDescOk =
		variantRows.value.length > 0 &&
		variantRows.value.every((item) => String(item.description || "").trim());

	const kwRequired = preflightForceLowKeywords.value
		? `>= ${PREFLIGHT_FORCE_KEYWORD_MIN}`
		: `>= ${PREFLIGHT_MIN_KEYWORDS}`;
	const scope = effectivePreflightScope.value;
	const needEn = scope.includes("en");
	const needDe = scope.includes("de");
	const ukKwOk = preflightForceLowKeywords.value
		? ukKeywordCount >= PREFLIGHT_FORCE_KEYWORD_MIN
		: ukKeywordCount >= PREFLIGHT_MIN_KEYWORDS;
	const deKwOk = preflightForceLowKeywords.value
		? deKeywordCount >= PREFLIGHT_FORCE_KEYWORD_MIN
		: deKeywordCount >= PREFLIGHT_MIN_KEYWORDS;
	const isManualMode = preflightReferenceSourceType.value === "manual_bullets";

	const rows: PreflightCheckRow[] = [];

	if (needEn) {
		rows.push({
			label: "英国关键词",
			hint: "app_amz_listing_keyword / UK",
			currentText: `${ukKeywordCount}/${keywordRequiredLabel.value}`,
			requiredText: kwRequired,
			ok: ukKwOk,
			message: hasIssue("英国关键词")
				? preflightForceLowKeywords.value
					? "强制模式下仍须不少于 3 条"
					: "关键词不足"
				: "可用于选词调研"
		});
	} else if (preflightTaskMode.value === "full") {
		rows.push({
			label: "英国关键词",
			hint: "app_amz_listing_keyword / UK",
			currentText: `${ukKeywordCount}`,
			requiredText: "不要求",
			ok: true,
			skipped: true,
			message: "本任务不要求英国市场"
		});
	}

	if (needDe) {
		rows.push({
			label: "德国关键词",
			hint: "app_amz_listing_keyword / DE",
			currentText: `${deKeywordCount}/${keywordRequiredLabel.value}`,
			requiredText: kwRequired,
			ok: deKwOk,
			message: hasIssue("德国关键词")
				? preflightForceLowKeywords.value
					? "强制模式下仍须不少于 3 条"
					: "关键词不足"
				: "可用于选词调研"
		});
	} else if (preflightTaskMode.value === "full") {
		rows.push({
			label: "德国关键词",
			hint: "app_amz_listing_keyword / DE",
			currentText: `${deKeywordCount}`,
			requiredText: "不要求",
			ok: true,
			skipped: true,
			message:
				preflightScope.value.includes("de") &&
				!effectivePreflightScope.value.includes("de")
					? "本次重新提交不生成德国文案"
					: "本任务不要求德国市场"
		});
	}

	if (!isManualMode && needEn) {
		rows.push({
			label: "英国竞品",
			hint: "勾选参考竞品 ASIN",
			currentText: `${ukCompetitorCount}/4`,
			requiredText: "0-4 条",
			ok: ukCompetitorSelectionOk.value,
			message: ukCompetitorSelectionOk.value
				? ukCompetitorCount > 0
					? "已选择 AI 参考竞品"
					: "未手动选择时将自动按销量取 Top4"
				: "参考竞品最多选择 4 条"
		});
	} else if (isManualMode && needEn) {
		rows.push({
			label: "英国竞品",
			hint: "status=2 的 UK 竞品",
			currentText: `${ukCompetitorCount}`,
			requiredText: "不要求",
			ok: true,
			skipped: true,
			message: "人工卖点模式不要求竞品"
		});
	} else if (preflightTaskMode.value === "full") {
		rows.push({
			label: "英国竞品",
			hint: "status=2 的 UK 竞品",
			currentText: `${ukCompetitorCount}`,
			requiredText: "不要求",
			ok: true,
			skipped: true,
			message: "本任务不要求英国市场"
		});
	}

	if (!isManualMode && needDe) {
		rows.push({
			label: "德国竞品",
			hint: "勾选参考竞品 ASIN",
			currentText: `${deCompetitorCount}/4`,
			requiredText: "0-4 条",
			ok: deCompetitorSelectionOk.value,
			message: deCompetitorSelectionOk.value
				? deCompetitorCount > 0
					? "已选择 AI 参考竞品"
					: "未手动选择时将自动按销量取 Top4"
				: "参考竞品最多选择 4 条"
		});
	} else if (isManualMode && needDe) {
		rows.push({
			label: "德国竞品",
			hint: "status=2 的 DE 竞品",
			currentText: `${deCompetitorCount}`,
			requiredText: "不要求",
			ok: true,
			skipped: true,
			message: "人工卖点模式不要求竞品"
		});
	} else if (preflightTaskMode.value === "full") {
		rows.push({
			label: "德国竞品",
			hint: "status=2 的 DE 竞品",
			currentText: `${deCompetitorCount}`,
			requiredText: "不要求",
			ok: true,
			skipped: true,
			message:
				preflightScope.value.includes("de") &&
				!effectivePreflightScope.value.includes("de")
					? "本次重新提交不生成德国文案"
					: "本任务不要求德国市场"
		});
	}

	if (isManualMode) {
		const filledCount = preflightManualReferenceBullets.value.filter(Boolean).length;
		rows.push({
			label: "人工卖点",
			hint: "manual_reference_bullets",
			currentText: `${filledCount}/5`,
			requiredText: "5 条完整",
			ok: filledCount === 5,
			message: filledCount === 5 ? "已提供 5 条人工卖点" : "请补齐 5 条人工卖点"
		});
	}

	return [
		...rows,
		{
			label: "指定变体",
			hint: "target_variant_ids",
			currentText: `${variantCount} 个`,
			requiredText: ">= 1",
			ok: variantCount >= 1,
			message: variantCount >= 1 ? variantIds.join("，") || "已指定" : "未指定变体"
		},
		{
			label: "变体存在",
			hint: "variant 未删除",
			currentText: variantExistsOk ? "通过" : "异常",
			requiredText: "全部存在",
			ok: variantExistsOk,
			message: variantExistsOk ? "未发现缺失或删除" : "存在不存在或已删除的变体"
		},
		{
			label: "变体名称",
			hint: "variant.name",
			currentText: variantNameOk ? "通过" : "缺失",
			requiredText: "全部非空",
			ok: variantNameOk,
			message: variantNameOk ? "所有变体都有名称" : "存在变体缺少名称"
		},
		{
			label: "变体描述",
			hint: "variant.description",
			currentText: variantDescOk ? "通过" : "缺失",
			requiredText: "全部非空",
			ok: variantDescOk,
			message: variantDescOk ? "所有变体都有描述" : "存在变体缺少描述"
		}
	];
});

function effectiveListingPhase(): ListingAiRunPhase | undefined {
	if (filters.phase) return filters.phase;
	if (filters.onlyPendingReview) return "awaiting_review";
	if (filters.onlyClosed) return "closed";
	return undefined;
}

function onPhaseFilterChange(phase: ListingAiRunPhase | "") {
	if (phase) {
		filters.onlyFailed = false;
		filters.onlyPendingReview = false;
		filters.onlyClosed = false;
	}
	applyFilters();
}

function onOnlyFailedChange(checked: boolean) {
	if (checked) {
		filters.onlyPendingReview = false;
		filters.onlyClosed = false;
		filters.phase = "";
	}
	applyFilters();
}

function onOnlyPendingReviewChange(checked: boolean) {
	if (checked) {
		filters.onlyFailed = false;
		filters.onlyClosed = false;
		filters.phase = "";
	}
	applyFilters();
}

function onOnlyClosedChange(checked: boolean) {
	if (checked) {
		filters.onlyFailed = false;
		filters.onlyPendingReview = false;
		filters.phase = "";
	}
	applyFilters();
}

function applyFilters() {
	page.value = 1;
	void fetchList();
}

function resetFilters() {
	filters.keyword = "";
	filters.phase = "";
	filters.accountId = "";
	filters.applicantId = "";
	filters.onlyFailed = false;
	filters.onlyPendingReview = false;
	filters.onlyClosed = false;
	page.value = 1;
	void fetchList();
}

async function fetchFilterOptions() {
	try {
		const res = await (service as any).request({
			url: "/admin/app/ai_listing_task/filters",
			method: "GET"
		});
		const data = res?.data ?? res;
		accountOptions.value = Array.isArray(data?.shops) ? data.shops : [];
		applicantOptions.value = Array.isArray(data?.applicants) ? data.applicants : [];
	} catch (err) {
		console.error(err);
	}
}

function onPageSizeChange(size: number) {
	pageSize.value = size;
	page.value = 1;
	void fetchList();
}

function onPageChange(p: number) {
	page.value = p;
	void fetchList();
}

function openDetail(row: ListingAiRow) {
	detailTaskId.value = Number(row.id || 0);
	detailDialogVisible.value = true;
}

function openStudio(row: ListingAiRow) {
	router.push({
		path: "/app/listing-content-studio/studio",
		query: { sku: row.sku, msku: row.msku }
	});
}

async function openPreflightDialog(row: ListingAiRow) {
	if (row.phase !== "failed") {
		try {
			await ElMessageBox.confirm(
				"您的文案已经生成，确认要补充参数并覆盖原来的生成结果吗",
				"补充参数重新提交",
				{
					type: "warning",
					confirmButtonText: "确认",
					cancelButtonText: "取消"
				}
			);
		} catch {
			return;
		}
	}
	preflightRow.value = row;
	preflightParams.value = null;
	preflightForceLowKeywords.value = false;
	preflightSelectedLanguages.value = normalizeRequiredLanguages(
		row.requiredLanguages || []
	) as Array<"en" | "de">;
	syncPreflightSelectedLanguages(
		normalizeRequiredLanguages(row.requiredLanguages || []) as Array<"en" | "de">
	);
	preflightReferenceSourceTypeDraft.value = "competitor";
	preflightManualReferenceBulletsDraft.value = ["", "", "", "", ""];
	preflightManualReferenceNotesDraft.value = "";
	preflightManualReferenceTitleDraft.value = "";
	preflightSelectedCompetitorAsinsUk.value = [];
	preflightSelectedCompetitorAsinsDe.value = [];
	competitorUkAsinBulk.value = "";
	competitorDeAsinBulk.value = "";
	keywordUkAsinBulk.value = "";
	keywordDeAsinBulk.value = "";
	keywordUkResultVisible.value = false;
	keywordDeResultVisible.value = false;
	clearPreflightKeywordSelection();
	preflightCollapseNames.value = ["keywords", "competitors", "variants"];
	preflightDialogVisible.value = true;
	await refreshPreflightParams();
}

async function savePreflightReferenceInput(competitorAsins?: ReferenceCompetitorAsinsPayload) {
	const row = preflightRow.value;
	if (!row) return;
	const competitorPayload = competitorAsins ?? buildReferenceCompetitorAsinsPayload();
	if (preflightReferenceSourceTypeDraft.value === "competitor") {
		const selectionError = validatePreflightCompetitorSelection(competitorPayload);
		if (selectionError) {
			ElMessage.warning(selectionError);
			throw new Error(selectionError);
		}
	}
	competitorSelectionSyncing.value = true;
	preflightLoading.value = true;
	try {
		const res = await (service as any).request({
			url: "/admin/app/ai_listing_task/preflightReference",
			method: "POST",
			data: {
				id: row.id,
				reference_source_type: preflightReferenceSourceTypeDraft.value,
				manual_reference_bullets: preflightManualReferenceBulletsDraft.value.map((item) =>
					String(item || "").trim()
				),
				manual_reference_notes: String(preflightManualReferenceNotesDraft.value || "").trim(),
				manual_reference_title: String(preflightManualReferenceTitleDraft.value || "").trim(),
				reference_competitor_asins: competitorPayload
			}
		});
		preflightParams.value = (res?.data ?? res) as PreflightParamsResp;
		const refInput = preflightParams.value?.reference_input || {};
		preflightReferenceSourceTypeDraft.value =
			refInput.reference_source_type === "manual_bullets" ? "manual_bullets" : "competitor";
		preflightManualReferenceBulletsDraft.value = Array.from({ length: 5 }, (_, idx) =>
			String(refInput.manual_reference_bullets?.[idx] || "")
		);
		preflightManualReferenceNotesDraft.value = String(refInput.manual_reference_notes || "");
		preflightManualReferenceTitleDraft.value = String(refInput.manual_reference_title || "");
	} catch (err: any) {
		competitorSelectionSyncing.value = false;
		ElMessage.error(err?.message || "保存参考模式失败");
		throw err;
	} finally {
		preflightLoading.value = false;
	}
	restoreCompetitorSelection(competitorPayload);
}

async function refreshPreflightParams() {
	const row = preflightRow.value;
	if (!row) return;
	preflightLoading.value = true;
	try {
		const res = await (service as any).request({
			url: "/admin/app/ai_listing_task/preflightParams",
			method: "GET",
			params: { id: row.id }
		});
		preflightParams.value = (res?.data ?? res) as PreflightParamsResp;
		// 后端仅在重提成功后才有 force 标记；刷新时保留用户当前勾选，避免提交前被冲掉
		const forceFromApi = Boolean(preflightParams.value?.preflight?.force_low_keywords);
		preflightForceLowKeywords.value = forceFromApi || preflightForceLowKeywords.value;
		const shopLangs = normalizeRequiredLanguages(preflightParams.value?.required_languages);
		if (preflightRow.value) {
			preflightRow.value.requiredLanguages = shopLangs;
		}
		syncPreflightSelectedLanguages(shopLangs as Array<"en" | "de">);
		const refInput = preflightParams.value?.reference_input || {};
		preflightReferenceSourceTypeDraft.value =
			refInput.reference_source_type === "manual_bullets" ? "manual_bullets" : "competitor";
		preflightManualReferenceBulletsDraft.value = Array.from({ length: 5 }, (_, idx) =>
			String(refInput.manual_reference_bullets?.[idx] || "")
		);
		preflightManualReferenceNotesDraft.value = String(refInput.manual_reference_notes || "");
		preflightManualReferenceTitleDraft.value = String(refInput.manual_reference_title || "");
		syncCompetitorSelectionFromParams();
		preflightVariantSnapshot.value = JSON.stringify(buildVariantPayload());
	} catch (err: any) {
		ElMessage.warning(err?.message || "读取校验参数失败，先展示失败快照");
	} finally {
		preflightLoading.value = false;
	}
}

function normalizeCompetitorAsin(raw: string) {
	return String(raw || "")
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
}

function getCompetitorAmazonDpUrl(asin: string, marketplace: string) {
	const cleanAsin = normalizeCompetitorAsin(asin);
	if (!cleanAsin) return "#";
	return appConfig.get_amazon_url_dp(cleanAsin, marketplace || "英国");
}

function competitorImageUrl(row: PreflightCompetitorRow) {
	return product_main_image_display_url(String(row?.image_url || "").trim());
}

function competitorNeedsSupplement(row: PreflightCompetitorRow) {
	const hasImage = Boolean(competitorImageUrl(row));
	const hasBullets = (row.bullet_points || []).some((item) =>
		String(item || "").trim()
	);
	return !hasImage || !hasBullets;
}

async function supplementPreflightCompetitor(row: PreflightCompetitorRow) {
	const taskRow = preflightRow.value;
	if (!taskRow?.id || !row?.id) return;
	if (!competitorNeedsSupplement(row)) {
		ElMessage.info("该竞品主图与卖点均已存在");
		return;
	}
	competitorSupplementLoadingId.value = row.id;
	try {
		const res = await (service as any).request({
			url: "/admin/app/ai_listing_task/preflightCompetitorRefresh",
			method: "POST",
			data: {
				id: taskRow.id,
				competitor_id: row.id
			}
		});
		const payload = (res?.data ?? res) as PreflightParamsResp & {
			supplement_result?: { skipped?: boolean; message?: string };
		};
		preflightParams.value = payload;
		const msg = String(payload?.supplement_result?.message || "竞品数据已更新");
		if (payload?.supplement_result?.skipped) {
			ElMessage.info(msg);
		} else {
			ElMessage.success(msg);
		}
		syncCompetitorSelectionFromParams();
	} catch (err: any) {
		ElMessage.error(err?.message || "获取竞品数据失败");
	} finally {
		competitorSupplementLoadingId.value = null;
	}
}

async function addPreflightCompetitor(countryCode: "uk" | "de") {
	const row = preflightRow.value;
	if (!row) return;
	const isUk = countryCode === "uk";
	const siteLabel = isUk ? "英国" : "德国";
	const bulkRef = isUk ? competitorUkAsinBulk : competitorDeAsinBulk;
	const parsed = Array.from(new Set(parseKeywordCompetitorAsins(bulkRef.value)));
	if (!parsed.length) {
		ElMessage.warning(`请粘贴至少一个有效${siteLabel}站竞品 ASIN（每行一个，10位字母数字）`);
		return;
	}
	if (parsed.length > 20) {
		ElMessage.warning("单次最多支持 20 个竞品 ASIN");
		return;
	}

	const existingRows = isUk ? competitorRows.value.uk : competitorRows.value.de;
	const existingSet = new Set(
		existingRows.map((item) => normalizeCompetitorAsin(item.asin)).filter(Boolean)
	);
	const toAdd = parsed.filter((asin) => !existingSet.has(asin));
	const skippedDup = parsed.length - toAdd.length;
	if (!toAdd.length) {
		ElMessage.warning(`${siteLabel}站所选 ASIN 均已存在，无需重复添加`);
		return;
	}

	const loadingRef = isUk ? competitorUkAdding : competitorDeAdding;
	loadingRef.value = true;
	let success = 0;
	const failures: string[] = [];
	try {
		for (const asin of toAdd) {
			try {
				const res = await (service as any).request({
					url: "/admin/app/ai_listing_task/preflightCompetitor",
					method: "POST",
					data: {
						id: row.id,
						country_code: countryCode,
						asin
					}
				});
				preflightParams.value = (res?.data ?? res) as PreflightParamsResp;
				success += 1;
			} catch (err: any) {
				failures.push(`${asin}: ${err?.message || "添加失败"}`);
			}
		}
		if (isUk) competitorUkAsinBulk.value = "";
		else competitorDeAsinBulk.value = "";

		const parts: string[] = [];
		if (success > 0) parts.push(`成功 ${success} 个`);
		if (skippedDup > 0) parts.push(`跳过重复 ${skippedDup} 个`);
		if (failures.length > 0) parts.push(`失败 ${failures.length} 个`);
		const summary = parts.join("，");
		if (failures.length > 0) {
			ElMessage.warning(`${siteLabel}站：${summary}`);
			console.warn("[preflightCompetitor]", failures);
		} else {
			ElMessage.success(`${siteLabel}站：${summary}`);
		}
		if (success > 0) {
			syncCompetitorSelectionFromParams();
			await fetchList();
		}
	} finally {
		loadingRef.value = false;
	}
}

async function savePreflightVariants() {
	const row = preflightRow.value;
	if (!row) return;
	const invalid = variantRows.value.find(
		(item) =>
			item.exists &&
			!item.deleted &&
			(!String(item.name || "").trim() || !String(item.description || "").trim())
	);
	if (invalid) {
		ElMessage.warning(`请先补齐变体 ${invalid.id} 的名称和描述`);
		return;
	}
	variantSaving.value = true;
	try {
		const res = await (service as any).request({
			url: "/admin/app/ai_listing_task/preflightVariants",
			method: "POST",
			data: {
				id: row.id,
				variants: buildVariantPayload()
			}
		});
		preflightParams.value = (res?.data ?? res) as PreflightParamsResp;
		preflightVariantSnapshot.value = JSON.stringify(buildVariantPayload());
		ElMessage.success("变体信息已保存");
		await fetchList();
	} catch (err: any) {
		ElMessage.error(err?.message || "保存变体信息失败");
	} finally {
		variantSaving.value = false;
	}
}

async function retryPreflightTask() {
	const row = preflightRow.value;
	if (!row) return;
	if (variantDirty.value) {
		ElMessage.warning("有未保存的变体改动，请先保存");
		return;
	}
	if (preflightReferenceSourceTypeDraft.value === "manual_bullets") {
		const missingIndex = preflightManualReferenceBulletsDraft.value.findIndex(
			(item) => !String(item || "").trim()
		);
		if (missingIndex >= 0) {
			ElMessage.warning(`请补齐第 ${missingIndex + 1} 条人工卖点`);
			return;
		}
	}
	const forceSubmit = preflightForceLowKeywords.value;
	const localReferenceSourceType = preflightReferenceSourceTypeDraft.value;
	const localManualReferenceBullets = preflightManualReferenceBulletsDraft.value.map((item) =>
		String(item || "").trim()
	);
	const localManualReferenceNotes = String(preflightManualReferenceNotesDraft.value || "").trim();
	const localManualReferenceTitle = String(preflightManualReferenceTitleDraft.value || "").trim();
	const localCompetitorAsins = buildReferenceCompetitorAsinsPayload();
	if (localReferenceSourceType === "competitor") {
		const selectionError = validatePreflightCompetitorSelection(localCompetitorAsins);
		if (selectionError) {
			ElMessage.warning(selectionError);
			return;
		}
	}
	try {
		await savePreflightReferenceInput(localCompetitorAsins);
	} catch {
		return;
	}
	if (forceSubmit) preflightForceLowKeywords.value = true;
	const competitorOk = isCompetitorSelectionPayloadOk(localCompetitorAsins);
	const retryAllOk =
		preflightTaskMode.value === "delta"
			? variantBlockOk.value
			: keywordBlockOk.value && competitorOk && variantBlockOk.value;
	if (!retryAllOk) {
		const missing: string[] = [];
		const scope = effectivePreflightScope.value;
		if (!keywordBlockOk.value && scope.length) {
			const parts: string[] = [];
			if (scope.includes("en")) {
				parts.push(
					forceSubmit
						? `英国关键词>=${PREFLIGHT_FORCE_KEYWORD_MIN}`
						: `英国关键词>=${PREFLIGHT_MIN_KEYWORDS}`
				);
			}
			if (scope.includes("de")) {
				parts.push(
					forceSubmit
						? `德国关键词>=${PREFLIGHT_FORCE_KEYWORD_MIN}`
						: `德国关键词>=${PREFLIGHT_MIN_KEYWORDS}`
				);
			}
			missing.push(parts.length ? `关键词（${parts.join("、")}）` : "关键词");
		}
		if (!competitorOk && scope.length) {
			const parts: string[] = [];
			if (scope.includes("en") && localCompetitorAsins.uk.length > PREFLIGHT_MAX_REFERENCE_COMPETITORS) {
				parts.push("英国参考竞品最多 4 条");
			}
			if (scope.includes("de") && localCompetitorAsins.de.length > PREFLIGHT_MAX_REFERENCE_COMPETITORS) {
				parts.push("德国参考竞品最多 4 条");
			}
			missing.push(parts.length ? `竞品（${parts.join("、")}）` : "竞品");
		}
		if (!variantBlockOk.value) missing.push("变体（名称与描述）");
		ElMessage.warning(
			missing.length
				? `校验仍未全部满足：${missing.join("、")}`
				: "校验仍未全部满足，请补齐后再提交"
		);
		return;
	}
	const requestedLanguages = buildRetryRequestedLanguages();
	if (!requestedLanguages.length) {
		ElMessage.warning("当前店铺未配置英/德采购，不会生成文案");
		return;
	}
	await retryTask(row, {
		force_low_keywords: preflightForceLowKeywords.value,
		requested_languages: requestedLanguages,
		reference_source_type: preflightReferenceSourceTypeDraft.value,
		manual_reference_bullets:
			preflightReferenceSourceTypeDraft.value === "manual_bullets"
				? localManualReferenceBullets
				: [],
		manual_reference_notes: localManualReferenceNotes,
		manual_reference_title: localManualReferenceTitle,
		reference_competitor_asins: localCompetitorAsins
	});
	preflightDialogVisible.value = false;
}

async function closeTask(row: ListingAiRow) {
	const api = (service as any).app?.ai_listing_task;
	if (!api?.closeReview) {
		ElMessage.error("后端 closeReview 接口不可用");
		return;
	}
	if (closingIds.has(row.id)) return;
	try {
		await ElMessageBox.confirm(
			`关闭后任务将标记为「已关闭」，不再阻塞后续 AI 文案任务（ID: ${row.id}）。确认关闭？`,
			"关闭任务",
			{
				type: "warning",
				confirmButtonText: "确认关闭",
				cancelButtonText: "取消"
			}
		);
	} catch {
		return;
	}
	closingIds.add(row.id);
	try {
		await api.closeReview({ id: row.id });
		ElMessage.success("任务已关闭");
		await fetchList();
	} catch (err: any) {
		ElMessage.error(err?.message || "关闭任务失败");
	} finally {
		closingIds.delete(row.id);
	}
}

async function retryTask(
	row: ListingAiRow,
	options?: {
		force_low_keywords?: boolean;
		requested_languages?: Array<"en" | "de">;
		reference_source_type?: "manual_bullets" | "competitor";
		manual_reference_bullets?: string[];
		manual_reference_notes?: string;
		manual_reference_title?: string;
		reference_competitor_asins?: {
			uk?: string[];
			de?: string[];
		};
	}
) {
	if (!(service as any).app?.ai_listing_task?.retry) {
		ElMessage.error("后端 aiListingTask retry 接口不可用");
		return;
	}
	if (retryingIds.has(row.id)) return;
	if (row.phase !== "failed") {
		try {
			await ElMessageBox.confirm(
				`任务当前阶段为「${phaseLabel(row.phase)}」，确认重新运行 AI 任务（ID: ${row.id}）吗？`,
				"确认重跑",
				{
					type: "warning",
					confirmButtonText: "确认重跑",
					cancelButtonText: "取消"
				}
			);
		} catch {
			return;
		}
	}
	retryingIds.add(row.id);
	try {
		const res = await (service as any).app.ai_listing_task.retry({
			id: row.id,
			force_low_keywords: Boolean(options?.force_low_keywords),
			requested_languages: options?.requested_languages,
			reference_source_type: options?.reference_source_type,
			manual_reference_bullets: options?.manual_reference_bullets,
			manual_reference_notes: options?.manual_reference_notes,
			manual_reference_title: options?.manual_reference_title,
			reference_competitor_asins: options?.reference_competitor_asins
		});
		const data = res?.data ?? res;
		ElMessage.success(`已重跑任务 ${data?.taskId || row.id}`);
		await fetchList();
	} catch (err: any) {
		ElMessage.error(err?.message || "重跑失败");
	} finally {
		retryingIds.delete(row.id);
	}
}

async function triggerDeCopy(row: ListingAiRow) {
	const api = (service as any).app?.ai_listing_task;
	if (!api?.triggerDe && !(service as any).request) {
		ElMessage.error("后端 triggerDe 接口不可用");
		return;
	}
	if (triggerDeIds.has(row.id)) return;
	try {
		await ElMessageBox.confirm(
			`将为任务 #${row.id} 补触发德国文案（不覆盖已有英文结果），确认继续？`,
			"触发德国文案",
			{ type: "warning", confirmButtonText: "确认", cancelButtonText: "取消" }
		);
	} catch {
		return;
	}
	triggerDeIds.add(row.id);
	try {
		const res = await api.triggerDe({ id: row.id });
		const data = res?.data ?? res;
		if (data?.skipped) {
			ElMessage.info("德文文案已存在或正在生成");
		} else {
			ElMessage.success(`已触发德国文案任务 ${data?.taskId || row.id}`);
		}
		await fetchList();
	} catch (err: any) {
		ElMessage.error(err?.message || "触发德国文案失败");
	} finally {
		triggerDeIds.delete(row.id);
	}
}

function goListingStudio() {
	router.push({ path: "/app/listing-content-studio" });
}

function openCreateDialog() {
	createDialogVisible.value = true;
}

function phaseLabel(phase: ListingAiRunPhase): string {
	const row = LISTING_AI_RUN_PHASE_OPTIONS.find((o) => o.value === phase);
	return row?.label || phase;
}

function phaseTagType(phase: ListingAiRunPhase): "success" | "warning" | "danger" | "info" {
	if (phase === "done") return "success";
	if (phase === "closed") return "info";
	if (phase === "awaiting_review") return "warning";
	if (phase === "failed") return "danger";
	if (phase === "cancelled") return "info";
	return "warning";
}

function runProgressText(row: ListingAiRow) {
	return `${Math.max(0, Math.min(100, Number(row.progressPercent || 0)))}%`;
}

function taskModeLabel(mode: "full" | "delta") {
	return mode === "delta" ? "追加" : "主任务";
}

function taskModeTagType(mode: "full" | "delta"): "success" | "warning" {
	return mode === "delta" ? "warning" : "success";
}

function mapStatusToPhase(status: number, stage?: string): ListingAiRunPhase {
	if (status === 390) {
		const s = String(stage || "").toLowerCase();
		if (isAiListingReviewApprovedStage(s)) return "done";
		if (isAiListingReviewClosedStage(s)) return "closed";
		return "awaiting_review";
	}
	if (status === 900) return "failed";
	if (status === 990) return "cancelled";
	if (status >= 200) return "copy_running";
	if (status >= 110) return "params_running";
	return "queued";
}

function statusGroupByFilters(): "all" | "running" | "done" | "failed" | "cancelled" {
	if (effectiveListingPhase()) return "all";
	if (filters.onlyFailed) return "failed";
	return "all";
}

async function fetchList() {
	loading.value = true;
	try {
		const payload = {
			page: page.value,
			size: pageSize.value,
			keyword: filters.keyword || undefined,
			statusGroup: statusGroupByFilters(),
			phase: effectiveListingPhase(),
			accountId: filters.accountId || undefined,
			applicantId: filters.applicantId || undefined
		};
		const api = (service as any).app?.ai_listing_task;
		let data: any;
		if (typeof api?.page === "function") {
			const res = await api.page(payload);
			data = res?.data ?? res;
		} else {
			const res = await (service as any).request({
				url: "/admin/app/ai_listing_task/page",
				method: "POST",
				data: payload
			});
			data = res?.data ?? res;
		}
		const list = Array.isArray(data?.list) ? data.list : [];
		rows.value = list.map((r: any) => {
			return {
				id: Number(r.id),
				phase: mapStatusToPhase(Number(r.status || 0), String(r.stage || "")),
				taskMode: String(r.task_mode || "full") === "delta" ? "delta" : "full",
				rootTaskId: r.root_task_id != null ? Number(r.root_task_id) : null,
				mergeIntoTaskId: r.merge_into_task_id != null ? Number(r.merge_into_task_id) : null,
				msku: String(r.msku || ""),
				sku: String(r.sku || ""),
				asin: String(r.asin || ""),
				productTitle: String(r.product_title || ""),
				candidateImageUrl: product_main_image_display_url(r.candidate_image_url),
				accountName: String(r.account_name || ""),
				applicantName: String(r.applicant_name || ""),
				goTaskId: String(r.go_task_id || r.langgraph_run_id || ""),
				variantIds: Array.isArray(r.variant_ids)
					? r.variant_ids.map((x: any) => String(x || ""))
					: [],
				variantNames: Array.isArray(r.variant_names)
					? r.variant_names.map((x: any) => String(x || ""))
					: [],
				variantCount: Number(
					r.variant_count != null
						? r.variant_count
						: Array.isArray(r.variant_ids)
							? r.variant_ids.length
							: 0
				),
				requiredLanguages: normalizeRequiredLanguages(
					r.required_languages ?? r.requiredLanguages
				),
				marketplace: String(r.marketplace || ""),
				createdAt: String(r.createTime || ""),
				updatedAt: String(r.updateTime || ""),
				errorMessage: String(r.error_message || ""),
				failedStage: String(r.failed_stage || ""),
				status: Number(r.status || 0),
				progressPercent: Number(r.progress_percent || 0),
				canTriggerDe: Boolean(r.can_trigger_de ?? r.canTriggerDe)
			};
		});
		total.value = Number(data?.pagination?.total || rows.value.length);
	} catch (err: any) {
		rows.value = [];
		total.value = 0;
		ElMessage.error(err?.message || "加载任务列表失败");
	} finally {
		loading.value = false;
	}
}

async function loadCreateMeta() {
	const sku = createForm.sku.trim();
	if (!sku) {
		ElMessage.warning("请先输入父SKU");
		return;
	}
	if (!(service as any).app?.ai_listing_task?.createMetaBySku) {
		ElMessage.error("后端 createMetaBySku 接口不可用");
		return;
	}
	metaLoading.value = true;
	try {
		const res = await (service as any).app.ai_listing_task.createMetaBySku({ sku });
		const data = (res?.data ?? res) as CreateMetaResp;
		createMeta.value = data;
		if (!data?.candidate) {
			createForm.target_candidate_id = 0;
			createForm.target_variant_ids = [];
			createForm.target_amazon_account_id = "";
			ElMessage.warning("未找到该父SKU对应选品");
			return;
		}
		createForm.target_candidate_id = Number(data.candidate.id || 0);
		createForm.target_variant_ids = [];
		createForm.target_amazon_account_id = "";
		ElMessage.success("已加载选品信息");
	} finally {
		metaLoading.value = false;
	}
}

async function submitCreateTask() {
	if (!(service as any).app?.ai_listing_task?.run) {
		ElMessage.error("后端 aiListingTask run 接口不可用");
		return;
	}
	if (!createForm.target_candidate_id) {
		ElMessage.warning("请先加载父SKU对应选品");
		return;
	}
	if (!createForm.target_variant_ids.length) {
		ElMessage.warning("请至少选择一个变体");
		return;
	}
	if (!createForm.target_amazon_account_id) {
		ElMessage.warning("请选择亚马逊账号");
		return;
	}
	submitting.value = true;
	try {
		const res = await (service as any).app.ai_listing_task.run({
			task_type: "simple_variant",
			target_candidate_id: createForm.target_candidate_id,
			target_variant_ids: createForm.target_variant_ids,
			target_amazon_account_id: createForm.target_amazon_account_id
		});
		const data = res?.data ?? res;
		const taskId = data?.taskId ?? "";
		ElMessage.success(
			`已提交 1 个任务（${createForm.target_variant_ids.length} 个变体）${
				taskId ? `: ${taskId}` : ""
			}`
		);
		createDialogVisible.value = false;
		await fetchList();
	} finally {
		submitting.value = false;
	}
}

onMounted(() => {
	void fetchFilterOptions();
	void fetchList();
});
</script>

<style scoped lang="scss">
.lact-list-page {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 20px;
	background-color: #fff;
	min-height: 100%;
	box-sizing: border-box;
}

.section-card {
	border-radius: 6px;
}

.section-header {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 15px;
	font-weight: 600;
	flex-wrap: wrap;
}

.section-header-actions {
	margin-left: auto;
	display: flex;
	align-items: center;
	gap: 8px;
}

.section-sub {
	font-size: 12px;
	font-weight: 400;
	color: var(--el-text-color-secondary);
	margin-left: 4px;
}

.toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 10px;
	margin-bottom: 16px;
}

.toolbar-search {
	width: 280px;
	max-width: 100%;
}

.toolbar-phase {
	width: 160px;
}

.lact-table {
	width: 100%;
}

.list-thumb {
	width: 42px;
	height: 42px;
	border-radius: 4px;
	border: 1px solid var(--el-border-color-lighter);
}

.lang-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	justify-content: center;
}

.variant-count-text {
	color: var(--el-color-primary);
	cursor: help;
}

.lact-updated-time {
	font-size: 13px;
	color: var(--el-text-color-regular);
}

.mono {
	font-variant-numeric: tabular-nums;
	font-size: 12px;
}

.err-text {
	color: var(--el-color-danger);
	font-size: 13px;
}

.muted {
	color: var(--el-text-color-secondary);
}

.error-text {
	color: var(--el-color-danger);
	font-size: 12px;
	line-height: 1.4;
}

.meta-line {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	line-height: 1.4;
}

.meta-item {
	color: var(--el-text-color-primary);
	font-size: 13px;
}

.pager {
	margin-top: 16px;
	display: flex;
	justify-content: flex-end;
}

.preflight-dialog {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

.preflight-meta-card {
	border-radius: 8px;
}

.preflight-meta-head {
	margin-bottom: 8px;
}

.preflight-meta-title {
	font-size: 14px;
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.preflight-meta-block {
	margin-top: 8px;
}

.preflight-meta-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px 16px;
	align-items: start;
}

@media (max-width: 640px) {
	.preflight-meta-grid {
		grid-template-columns: 1fr;
	}
}

.pf-meta-kv {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	min-width: 0;
	padding: 2px 0;
}

.pf-meta-kv--full {
	grid-column: 1 / -1;
}

.pf-meta-kv--image {
	grid-row: 1 / span 2;
	grid-column: 2;
}

.pf-meta-kv--name {
	grid-column: 1;
	grid-row: 1;
}

.pf-meta-kv--sku {
	grid-column: 1;
	grid-row: 2;
}

@media (max-width: 640px) {
	.pf-meta-kv--image,
	.pf-meta-kv--name,
	.pf-meta-kv--sku {
		grid-row: auto;
		grid-column: auto;
	}
}

.pf-meta-key {
	flex-shrink: 0;
	white-space: nowrap;
	width: 66px;
	font-size: 12px;
	line-height: 1.6;
	color: var(--el-text-color-secondary);
}

.pf-meta-lang-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	align-items: center;
}

.pf-meta-value {
	min-width: 0;
	font-size: 13px;
	line-height: 1.6;
	color: var(--el-text-color-primary);
	word-break: break-word;
}

.pf-meta-value--sku {
	display: inline-flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 4px 8px;
}

.pf-meta-code {
	font-size: 13px;
}

.pf-meta-image-wrap {
	flex: 1;
}

.pf-meta-image {
	width: 120px;
	height: 72px;
	border-radius: 4px;
	border: 1px solid var(--el-border-color-lighter);
}

.pf-meta-image--empty {
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	color: var(--el-text-color-placeholder);
	background: var(--el-fill-color-light);
}

.pf-meta-variant-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	flex: 1;
	min-width: 0;
}

.open-product-btn {
	margin-left: 0;
	padding: 0 4px;
	height: auto;
}

.keyword-force-row {
	margin-bottom: 10px;
	padding: 8px 10px;
	border-radius: 6px;
	background: var(--el-color-warning-light-9);
}

.force-kw-hint {
	margin-left: 4px;
	font-size: 12px;
	color: var(--el-color-warning);
}

.preflight-alert {
	line-height: 1.5;
}

.preflight-overview {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 10px;
}

.preflight-overview-card {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	padding: 10px;
	background: var(--el-fill-color-lighter);
}

.preflight-overview-card.is-error {
	border-color: var(--el-color-danger-light-5);
	background: var(--el-color-danger-light-9);
}

.preflight-overview-card.is-ok {
	border-color: var(--el-color-success-light-5);
}

.overview-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	font-size: 13px;
	font-weight: 500;
}

.overview-value {
	margin-top: 8px;
	font-size: 18px;
	font-weight: 600;
}

.overview-desc {
	margin-top: 4px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.preflight-collapse :deep(.el-collapse-item__header) {
	height: 44px;
}

.collapse-title {
	display: flex;
	align-items: center;
	gap: 10px;
	width: 100%;
	font-weight: 600;
}

.manage-method {
	margin-bottom: 10px;
	padding: 8px 10px;
	border-radius: 6px;
	background: var(--el-color-primary-light-9);
	color: var(--el-text-color-regular);
	font-size: 13px;
	line-height: 1.5;
}

.block-toolbar {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 10px;
	margin-bottom: 10px;
}

.block-toolbar-status {
	margin-right: auto;
	font-size: 13px;
	line-height: 1.4;
}

.two-column-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;
}

.param-panel {
	min-width: 0;
}

.param-panel-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 8px;
	font-weight: 600;
}

.competitor-add-bar {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	margin-bottom: 8px;
}

.competitor-add-bar .el-textarea {
	flex: 1;
	min-width: 0;
}

.competitor-add-bar :deep(.el-textarea__inner) {
	min-height: 56px !important;
}

.competitor-add-bar .el-button {
	flex-shrink: 0;
	margin-top: 0;
}

.keyword-asin-bar {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	margin-bottom: 8px;
}

.keyword-asin-bar .el-textarea {
	flex: 1;
	min-width: 0;
}

.keyword-asin-bar :deep(.el-textarea__inner) {
	min-height: 56px !important;
}

.keyword-asin-bar .el-button {
	flex-shrink: 0;
	margin-top: 0;
}

.keyword-table-toolbar {
	display: flex;
	justify-content: flex-end;
	margin-bottom: 8px;
}

.competitor-asin-cell {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.competitor-thumb {
	width: 40px;
	height: 40px;
	border-radius: 4px;
	flex-shrink: 0;
}

.competitor-thumb--empty {
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f5f7fa;
	color: #909399;
	font-size: 11px;
	line-height: 1.2;
	text-align: center;
}

.competitor-asin-link {
	font-size: 12px;
	word-break: break-all;
}

.preflight-issues {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.preflight-issues-title {
	width: 100%;
	font-size: 13px;
	font-weight: 500;
	color: var(--el-text-color-primary);
}

.preflight-issue-tag {
	white-space: normal;
	height: auto;
	line-height: 1.4;
	padding: 4px 8px;
}

.preflight-dialog-footer {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: flex-end;
	gap: 8px 12px;
	width: 100%;
}

.preflight-retry-de-opt {
	margin-right: 4px;
}
</style>
