<!-- AI 生成文案任务详情（纯 mock） — #/app/listing-ai-copy-task/detail?id=lac-001 -->
<template>
	<div
		class="lact-detail-page"
		v-loading="detailLoading"
		:class="{ 'lact-detail-page--loading': detailLoading }"
	>
		<div v-if="!embedded" class="detail-top">
			<el-button text type="primary" class="back-btn" @click="goList"
				>← 返回任务列表</el-button
			>
		</div>

		<template v-if="run && !detailLoading">
			<!-- 顶栏：选品信息紧凑两列 -->
			<el-card class="meta-card" shadow="never">
				<div class="meta-head">
					<div class="meta-title">选品信息</div>
					<div class="meta-actions">
						<el-button type="primary" @click="openStudio"
							>打开 Listing Studio</el-button
						>
						<el-button
							v-if="canTriggerDeCopy"
							type="success"
							plain
							:loading="triggeringDe"
							@click="triggerDeCopy"
							>触发德国文案</el-button
						>
						<el-button
							type="danger"
							plain
							:disabled="!canTerminateTask"
							:loading="terminatingTask"
							@click="terminateTask"
							>终止任务</el-button
						>
						<el-button disabled title="演示">重试任务</el-button>
					</div>
				</div>

				<div class="meta-block">
					<div class="meta-compact-grid">
						<div class="meta-kv-item meta-kv-item--name">
							<span class="meta-kv-key">名称</span>
							<span class="meta-kv-value">{{ run.productTitle || "—" }}</span>
						</div>
						<div class="meta-kv-item meta-kv-item--image">
							<span class="meta-kv-key">图片</span>
							<div class="meta-kv-image-wrap">
								<el-image
									v-if="metaPickImageSrc"
									:src="metaPickImageSrc"
									fit="cover"
									class="meta-kv-image"
									:preview-src-list="[metaPickImageSrc]"
									preview-teleported
								/>
								<div v-else class="meta-kv-image meta-kv-image--empty">
									暂无图片
								</div>
							</div>
						</div>
						<div class="meta-kv-item meta-kv-item--sku">
							<span class="meta-kv-key">父SKU</span>
							<span class="meta-kv-value meta-kv-value--sku">
								<code class="meta-sku-code">{{ run.sku || "—" }}</code>
								<el-button
									v-if="canOpenProductPage"
									link
									type="primary"
									class="open-product-btn"
									@click="openProductPage"
								>
									打开产品页
								</el-button>
							</span>
						</div>
						<div class="meta-kv-item">
							<span class="meta-kv-key">关联账号</span>
							<span class="meta-kv-value">{{ run.accountName || "—" }}</span>
						</div>
						<div class="meta-kv-item">
							<span class="meta-kv-key">语言</span>
							<span class="meta-kv-value">
								<div v-if="displayRequiredLanguages.length" class="meta-lang-tags">
									<el-tag
										v-for="lang in displayRequiredLanguages"
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
						<div class="meta-kv-item">
							<span class="meta-kv-key">申请人</span>
							<span class="meta-kv-value">{{ run.applicantName || "—" }}</span>
						</div>
						<div class="meta-kv-item">
							<span class="meta-kv-key">状态</span>
							<span class="meta-kv-value">
								<el-tag :type="phaseTagType(run.phase)" size="small">{{
									phaseLabel(run.phase)
								}}</el-tag>
							</span>
						</div>
						<div class="meta-kv-item">
							<span class="meta-kv-key">任务类型</span>
							<span class="meta-kv-value">
								<el-tag
									size="small"
									:type="run.taskMode === 'delta' ? 'warning' : 'success'"
								>
									{{ run.taskMode === "delta" ? "追加" : "主任务" }}
								</el-tag>
							</span>
						</div>
						<div class="meta-kv-item">
							<span class="meta-kv-key">任务 ID</span>
							<span class="meta-kv-value"
								><code class="meta-sku-code">{{
									run.runUuid || run.goTaskId || "—"
								}}</code></span
							>
						</div>
						<div v-if="run.taskMode === 'delta'" class="meta-kv-item">
							<span class="meta-kv-key">父任务 ID</span>
							<span class="meta-kv-value">{{ run.rootTaskId || "—" }}</span>
						</div>
						<div v-if="run.taskMode === 'delta'" class="meta-kv-item">
							<span class="meta-kv-key">并入目标 ID</span>
							<span class="meta-kv-value">{{ run.mergeIntoTaskId || "—" }}</span>
						</div>
						<div class="meta-kv-item meta-kv-item--full">
							<span class="meta-kv-key">变体列表</span>
							<div class="meta-variant-tags">
								<el-tag
									v-for="v in metaVariantTags"
									:key="v"
									size="small"
									type="info"
									effect="plain"
								>
									{{ v }}
								</el-tag>
								<span v-if="!metaVariantTags.length" class="meta-kv-value">—</span>
							</div>
						</div>
						<div class="meta-kv-item">
							<span class="meta-kv-key">创建时间</span>
							<span class="meta-kv-value">{{ run.createdAt || "—" }}</span>
						</div>
						<div class="meta-kv-item">
							<span class="meta-kv-key">更新时间</span>
							<span class="meta-kv-value">{{ run.updatedAt || "—" }}</span>
						</div>
					</div>
				</div>

				<el-alert
					v-if="run.errorMessage"
					class="meta-alert"
					type="error"
					:title="run.errorMessage"
					:closable="false"
					show-icon
				/>
			</el-card>

			<!-- 文案 + 关键词：常看区左右分栏（各 50%，同高限高，两侧独立滚动） -->
			<div v-if="run" class="copy-keyword-workbench">
				<div class="copy-keyword-workbench__copy">
					<el-card class="result-card copy-keyword-workbench__copy-card" shadow="never">
						<template #header>
							<div class="card-head-row">
								<div class="card-head-left">
									<span class="card-h">AI 生成结果（可审核编辑）</span>
									<el-tag
										v-if="hasUnsavedReviewDraft"
										class="review-draft-tag"
										type="warning"
										size="small"
										effect="plain"
										>已编辑，待保存</el-tag
									>
									<span v-if="run.copy?.threadRef" class="card-sub muted"
										>thread {{ run.copy.threadRef }}</span
									>
								</div>
								<div class="card-head-actions">
									<el-button
										size="small"
										:disabled="!auditCopyRows.length"
										@click="capitalizeAllBulletBodiesAfterSubtitle"
										>卖点正文首字母大写</el-button
									>
									<el-button
										size="small"
										:loading="translatingCopyToZh"
										:disabled="!auditCopyRows.length"
										@click="translateAllCopyToZh"
										>一键翻译</el-button
									>
									<el-button size="small" @click="cancelReviewEdit"
										>取消编辑</el-button
									>
									<el-button
										size="small"
										:loading="resettingReviewDraft"
										@click="resetAuditDraft"
										>重置</el-button
									>
									<el-button
										size="small"
										type="primary"
										plain
										:disabled="!canSaveReviewDraft"
										:loading="savingReviewDraft"
										@click="saveReviewDraft"
										>保存</el-button
									>
									<el-button
										size="small"
										type="success"
										:disabled="!canSaveReviewDraft"
										@click="approveReview"
										>审核通过</el-button
									>
								</div>
							</div>
						</template>

						<p v-if="run.copy" class="copy-result-hint muted">
							「标题」为母版主标题（不含变体后缀）；「变体选项」为父SKU下各变体
							标题后缀。上传刊登前系统会自动拼接，生成每个变体的完整标题。
						</p>

						<template v-if="run.copy">
							<div class="copy-table-wrap">
								<el-table
									:data="auditCopyRows"
									border
									size="small"
									class="copy-lang-table"
									:span-method="copyTableSpanMethod"
								>
									<el-table-column label="字段" fixed="left" width="104">
										<template #default="{ row }">
											<span>{{ row.fieldLabel }}</span>
										</template>
									</el-table-column>
									<el-table-column
										v-for="lang in copyTableColumns"
										:key="lang.key"
										:prop="lang.key"
										:min-width="lang.minWidth"
									>
										<template #header>
											<span class="copy-lang-col-head">
												<span class="copy-lang-col-title">{{
													lang.label
												}}</span>
												<el-icon
													v-if="isCopyLangRequired(lang.key)"
													class="copy-lang-col-status copy-lang-col-status--yes"
													:size="20"
												>
													<circle-check-filled />
												</el-icon>
												<el-icon
													v-else
													class="copy-lang-col-status copy-lang-col-status--no"
													:size="20"
												>
													<circle-close-filled />
												</el-icon>
											</span>
										</template>
										<template #default="{ row }">
											<div
												v-if="
													row.rowType === 'variant_option' &&
													lang.key === 'en'
												"
												class="variant-option-row-wrap"
											>
												<div class="variant-option-row">
													<div class="variant-option-suffix">
														<span class="variant-option-suffix-label"
															>EN</span
														>
														<div class="copy-cell-editor-wrap">
															<div
																class="copy-cell-text-block copy-cell-text-block--compact"
																:class="{
																	'with-inline-highlight':
																		keywordDetectionEnabled
																}"
															>
																<div
																	v-if="keywordDetectionEnabled"
																	class="copy-cell-inline-highlight"
																	v-html="
																		renderCopyKeywordHighlightByKey(
																			String(row.en || ''),
																			'en'
																		)
																	"
																/>
																<el-input
																	v-model="row.en"
																	type="textarea"
																	:autosize="{
																		minRows: 1,
																		maxRows: 3
																	}"
																	resize="none"
																	class="copy-cell-editor copy-cell-editor--compact"
																	@input="
																		onAuditCopyCellInput(
																			row,
																			'en'
																		)
																	"
																/>
															</div>
															<div class="copy-char-badge-row">
																<div class="copy-char-badge">
																	{{
																		copyCharBadgeLabel(
																			row,
																			"en"
																		)
																	}}
																</div>
															</div>
															<div
																v-if="getCopyZhTranslation(row, 'en')"
																class="copy-cell-zh"
															>
																<span class="copy-cell-zh-label"
																	>EN 中文</span
																>
																<span class="copy-cell-zh-text">{{
																	getCopyZhTranslation(row, "en")
																}}</span>
															</div>
														</div>
													</div>
													<div class="variant-option-meta">
														<div class="variant-option-meta-name">
															{{ row.variantTitle || "—" }}
														</div>
														<div class="variant-option-meta-desc">
															{{ row.variantDesc || "—" }}
														</div>
													</div>
													<div class="variant-option-suffix">
														<span class="variant-option-suffix-label"
															>DE</span
														>
														<div class="copy-cell-editor-wrap">
															<div
																class="copy-cell-text-block copy-cell-text-block--compact"
																:class="{
																	'with-inline-highlight':
																		keywordDetectionEnabled
																}"
															>
																<div
																	v-if="keywordDetectionEnabled"
																	class="copy-cell-inline-highlight"
																	v-html="
																		renderCopyKeywordHighlightByKey(
																			String(row.de || ''),
																			'de'
																		)
																	"
																/>
																<el-input
																	v-model="row.de"
																	type="textarea"
																	:autosize="{
																		minRows: 1,
																		maxRows: 3
																	}"
																	resize="none"
																	class="copy-cell-editor copy-cell-editor--compact"
																	@input="
																		onAuditCopyCellInput(
																			row,
																			'de'
																		)
																	"
																/>
															</div>
															<div class="copy-char-badge-row">
																<div class="copy-char-badge">
																	{{
																		copyCharBadgeLabel(
																			row,
																			"de"
																		)
																	}}
																</div>
															</div>
															<div
																v-if="getCopyZhTranslation(row, 'de')"
																class="copy-cell-zh"
															>
																<span class="copy-cell-zh-label"
																	>DE 中文</span
																>
																<span class="copy-cell-zh-text">{{
																	getCopyZhTranslation(row, "de")
																}}</span>
															</div>
														</div>
													</div>
												</div>
											</div>
											<div
												v-else-if="row.rowType !== 'variant_option'"
												class="copy-cell-editor-wrap"
											>
												<div
													class="copy-cell-text-block"
													:class="{
														'with-inline-highlight':
															keywordDetectionEnabled &&
															(lang.key === 'en' || lang.key === 'de')
													}"
												>
													<div
														v-if="
															keywordDetectionEnabled &&
															(lang.key === 'en' || lang.key === 'de')
														"
														class="copy-cell-inline-highlight"
														v-html="
															renderCopyKeywordHighlightByKey(
																String(row[lang.key] || ''),
																String(lang.key || '')
															)
														"
													/>
													<el-input
														v-model="row[lang.key]"
														type="textarea"
														:autosize="{ minRows: 2 }"
														resize="none"
														class="copy-cell-editor"
														@input="onAuditCopyCellInput(row, lang.key)"
													/>
												</div>
												<div class="copy-char-badge-row">
													<div
														class="copy-char-badge"
														:class="{
															'copy-char-badge--over':
																copyCharBadgeOver(row, lang.key)
														}"
													>
														{{ copyCharBadgeLabel(row, lang.key) }}
													</div>
												</div>
												<div
													v-if="getCopyZhTranslation(row, lang.key)"
													class="copy-cell-zh"
												>
													<span class="copy-cell-zh-label">中文</span>
													<span class="copy-cell-zh-text">{{
														getCopyZhTranslation(row, lang.key)
													}}</span>
												</div>
											</div>
										</template>
									</el-table-column>
								</el-table>
							</div>
						</template>
						<el-empty v-else :description="pendingCopyHint" :image-size="72" />
					</el-card>
				</div>

				<aside v-if="run.params" class="copy-keyword-workbench__keywords keyword-workbench">
					<div class="keyword-workbench-head">
						<span class="keyword-workbench-title">关键词</span>
						<el-radio-group
							v-model="keywordViewMode"
							size="small"
							class="keyword-view-mode-switch"
						>
							<el-radio-button label="word">单词模式</el-radio-button>
							<el-radio-button label="phrase">词组模式</el-radio-button>
							<el-radio-button label="keyword">关键词模式</el-radio-button>
						</el-radio-group>
					</div>
					<div class="keyword-workbench-body">
						<div class="keyword-toolbar">
							<div class="keyword-toolbar-left">
								<el-button size="small" type="warning" @click="runKeywordDetection"
									>检测关键词</el-button
								>
								<el-button
									size="small"
									type="primary"
									plain
									:loading="translatingKeywordsToZh"
									@click="translateAllKeywordTextsToZh"
									>批量翻译</el-button
								>
							</div>
						</div>
						<div
							class="keyword-two-col"
							:class="{ 'keyword-locale-stack': keywordViewMode !== 'word' }"
						>
							<div class="keyword-block">
								<div class="keyword-col-head">
									英语 - {{ keywordModeColLabel(keywordViewMode) }}
								</div>
								<div class="keyword-table-wrap">
									<el-table
										:key="`kw-en-${keywordViewMode}-${keywordTableRenderKey}`"
										:data="keywordTableDataEn"
										:row-class-name="keywordRowClassNameEn"
										border
										size="small"
										class="keyword-table keyword-table--workbench"
									>
										<template v-if="keywordViewMode === 'word'">
											<el-table-column
												prop="word"
												label="单词"
												min-width="116"
												sortable
											>
												<template #default="{ row, $index }">
													<el-tooltip
														:disabled="!wordHasSourceKeywords(row)"
														placement="right"
														:show-after="250"
														effect="dark"
													>
														<template #content>
															<div class="word-source-kw-tooltip">
																<div
																	class="word-source-kw-tooltip__label"
																>
																	来源关键词
																</div>
																<div
																	v-for="(
																		kw, ki
																	) in row.sourceKeywords"
																	:key="`${ki}-${kw}`"
																	class="word-source-kw-tooltip__item"
																>
																	<div class="word-source-kw-tooltip__kw">
																		{{ kw }}
																	</div>
																	<div
																		v-if="getSourceKeywordZhText('en', kw)"
																		class="word-source-kw-tooltip__zh"
																	>
																		{{
																			getSourceKeywordZhText(
																				"en",
																				kw
																			)
																		}}
																	</div>
																</div>
															</div>
														</template>
														<div
															class="keyword-cell-with-zh"
															:class="{
																'keyword-cell-with-sources':
																	wordHasSourceKeywords(row)
															}"
														>
															<div class="keyword-text-with-copy">
																<a
																	class="keyword-search-link"
																	:href="amazonKeywordSearchHref(row.word, 'en')"
																	target="_blank"
																	rel="noopener noreferrer"
																	@click.stop
																	>{{ row.word }}</a
																>
																<el-button
																	link
																	type="primary"
																	class="keyword-copy-btn"
																	:icon="DocumentCopy"
																	title="复制"
																	@click.stop="copyKeyword(row.word)"
																/>
															</div>
															<template
																v-if="
																	getKeywordZhText(
																		'en',
																		'word',
																		$index
																	)
																"
															>
																<template
																	v-if="
																		keywordZhDisplayInline(
																			row.word
																		)
																	"
																>
																	<span
																		class="keyword-zh keyword-zh-inline"
																		>{{
																			getKeywordZhText(
																				"en",
																				"word",
																				$index
																			)
																		}}</span
																	>
																</template>
																<div
																	v-else
																	class="keyword-zh keyword-zh-block"
																>
																	{{
																		getKeywordZhText(
																			"en",
																			"word",
																			$index
																		)
																	}}
																</div>
															</template>
														</div>
													</el-tooltip>
												</template>
											</el-table-column>
											<el-table-column
												prop="totalFreq"
												label="总频率"
												width="72"
												align="right"
												sortable
											/>
											<el-table-column
												prop="totalParentSearchVolume"
												label="总父体搜索量"
												width="108"
												align="right"
												sortable
												:sort-method="sortKeywordTotalParentSearchVolume"
											>
												<template #default="{ row }">
													{{
														Number(
															row.totalParentSearchVolume || 0
														).toLocaleString()
													}}
												</template>
											</el-table-column>
										</template>
										<template v-else-if="keywordViewMode === 'phrase'">
											<el-table-column
												prop="token"
												label="单词"
												min-width="116"
												sortable
											>
												<template #default="{ row, $index }">
													<div class="keyword-cell-with-zh">
														<div class="keyword-text-with-copy">
															<a
																class="keyword-search-link"
																:href="amazonKeywordSearchHref(row.token, 'en')"
																target="_blank"
																rel="noopener noreferrer"
																@click.stop
																>{{ row.token }}</a
															>
															<el-button
																link
																type="primary"
																class="keyword-copy-btn"
																:icon="DocumentCopy"
																title="复制"
																@click.stop="copyKeyword(row.token)"
															/>
														</div>
														<template
															v-if="
																getKeywordZhText(
																	'en',
																	'phrase',
																	$index
																)
															"
														>
															<template
																v-if="
																	keywordZhDisplayInline(
																		row.token
																	)
																"
															>
																<span
																	class="keyword-zh keyword-zh-inline"
																	>{{
																		getKeywordZhText(
																			"en",
																			"phrase",
																			$index
																		)
																	}}</span
																>
															</template>
															<div
																v-else
																class="keyword-zh keyword-zh-block"
															>
																{{
																	getKeywordZhText(
																		"en",
																		"phrase",
																		$index
																	)
																}}
															</div>
														</template>
													</div>
												</template>
											</el-table-column>
											<el-table-column
												prop="tokenType"
												label="类型"
												width="100"
												sortable
											/>
											<el-table-column
												prop="wordFreq"
												label="词频"
												width="72"
												align="right"
												sortable
											/>
											<el-table-column
												prop="searchVolume"
												label="搜索量"
												width="96"
												align="right"
												sortable
											/>
											<el-table-column
												prop="score"
												label="分数"
												width="72"
												align="right"
												sortable
											/>
										</template>
										<template v-else>
											<el-table-column
												prop="keyword"
												label="关键词"
												min-width="112"
												sortable
											>
												<template #default="{ row, $index }">
													<div class="keyword-cell-with-zh">
														<div class="keyword-text-with-copy">
															<a
																class="keyword-search-link"
																:href="amazonKeywordSearchHref(row.keyword, 'en')"
																target="_blank"
																rel="noopener noreferrer"
																@click.stop
																>{{ row.keyword }}</a
															>
															<el-button
																link
																type="primary"
																class="keyword-copy-btn"
																:icon="DocumentCopy"
																title="复制"
																@click.stop="copyKeyword(row.keyword)"
															/>
														</div>
														<template
															v-if="
																getKeywordZhText(
																	'en',
																	'sys',
																	$index
																)
															"
														>
															<template
																v-if="
																	keywordZhDisplayInline(
																		row.keyword
																	)
																"
															>
																<span
																	class="keyword-zh keyword-zh-inline"
																	>{{
																		getKeywordZhText(
																			"en",
																			"sys",
																			$index
																		)
																	}}</span
																>
															</template>
															<div
																v-else
																class="keyword-zh keyword-zh-block"
															>
																{{
																	getKeywordZhText(
																		"en",
																		"sys",
																		$index
																	)
																}}
															</div>
														</template>
													</div>
												</template>
											</el-table-column>
											<el-table-column prop="role" label="类型" min-width="92" sortable>
												<template #default="{ row }">
													<el-tag size="small" type="info">{{
														snapshotKeywordRoleLabel(row.role)
													}}</el-tag>
												</template>
											</el-table-column>
											<el-table-column
												label="父体搜索量"
												min-width="118"
												align="right"
												sortable
												:sort-method="sortKeywordParentSearchVolume"
											>
												<template #default="{ row }">
													{{
														Number(
															row?.parentSearchVolume ||
																row?.monthlySearch ||
																0
														)
													}}
												</template>
											</el-table-column>
											<el-table-column
												label="相似度总分"
												width="86"
												align="right"
												sortable
												:sort-method="sortKeywordSimilarityTotal"
											>
												<template #default="{ row }">
													{{
														Number(
															row?.similarityTotal ||
																row?.compositeScore ||
																0
														)
													}}
												</template>
											</el-table-column>
											<el-table-column
												prop="similarityImage"
												label="相似度图片"
												width="86"
												align="right"
												sortable
											>
												<template #default="{ row }">
													{{ Number(row?.similarityImage || 0) }}
												</template>
											</el-table-column>
											<el-table-column
												prop="similarityTitle"
												label="相似度标题"
												width="86"
												align="right"
												sortable
											>
												<template #default="{ row }">
													{{ Number(row?.similarityTitle || 0) }}
												</template>
											</el-table-column>
										</template>
									</el-table>
								</div>
							</div>
							<div class="keyword-block">
								<div class="keyword-col-head">
									德语 - {{ keywordModeColLabel(keywordViewMode) }}
								</div>
								<div class="keyword-table-wrap">
									<el-table
										:key="`kw-de-${keywordViewMode}-${keywordTableRenderKey}`"
										:data="keywordTableDataDe"
										:row-class-name="keywordRowClassNameDe"
										border
										size="small"
										class="keyword-table keyword-table--workbench"
									>
										<template v-if="keywordViewMode === 'word'">
											<el-table-column
												prop="word"
												label="单词"
												min-width="116"
												sortable
											>
												<template #default="{ row, $index }">
													<el-tooltip
														:disabled="!wordHasSourceKeywords(row)"
														placement="right"
														:show-after="250"
														effect="dark"
													>
														<template #content>
															<div class="word-source-kw-tooltip">
																<div
																	class="word-source-kw-tooltip__label"
																>
																	来源关键词
																</div>
																<div
																	v-for="(
																		kw, ki
																	) in row.sourceKeywords"
																	:key="`${ki}-${kw}`"
																	class="word-source-kw-tooltip__item"
																>
																	<div class="word-source-kw-tooltip__kw">
																		{{ kw }}
																	</div>
																	<div
																		v-if="getSourceKeywordZhText('de', kw)"
																		class="word-source-kw-tooltip__zh"
																	>
																		{{
																			getSourceKeywordZhText(
																				"de",
																				kw
																			)
																		}}
																	</div>
																</div>
															</div>
														</template>
														<div
															class="keyword-cell-with-zh"
															:class="{
																'keyword-cell-with-sources':
																	wordHasSourceKeywords(row)
															}"
														>
															<div class="keyword-text-with-copy">
																<a
																	class="keyword-search-link"
																	:href="amazonKeywordSearchHref(row.word, 'de')"
																	target="_blank"
																	rel="noopener noreferrer"
																	@click.stop
																	>{{ row.word }}</a
																>
																<el-button
																	link
																	type="primary"
																	class="keyword-copy-btn"
																	:icon="DocumentCopy"
																	title="复制"
																	@click.stop="copyKeyword(row.word)"
																/>
															</div>
															<template
																v-if="
																	getKeywordZhText(
																		'de',
																		'word',
																		$index
																	)
																"
															>
																<template
																	v-if="
																		keywordZhDisplayInline(
																			row.word
																		)
																	"
																>
																	<span
																		class="keyword-zh keyword-zh-inline"
																		>{{
																			getKeywordZhText(
																				"de",
																				"word",
																				$index
																			)
																		}}</span
																	>
																</template>
																<div
																	v-else
																	class="keyword-zh keyword-zh-block"
																>
																	{{
																		getKeywordZhText(
																			"de",
																			"word",
																			$index
																		)
																	}}
																</div>
															</template>
														</div>
													</el-tooltip>
												</template>
											</el-table-column>
											<el-table-column
												prop="totalFreq"
												label="总频率"
												width="72"
												align="right"
												sortable
											/>
											<el-table-column
												prop="totalParentSearchVolume"
												label="总父体搜索量"
												width="108"
												align="right"
												sortable
												:sort-method="sortKeywordTotalParentSearchVolume"
											>
												<template #default="{ row }">
													{{
														Number(
															row.totalParentSearchVolume || 0
														).toLocaleString()
													}}
												</template>
											</el-table-column>
										</template>
										<template v-else-if="keywordViewMode === 'phrase'">
											<el-table-column
												prop="token"
												label="单词"
												min-width="116"
												sortable
											>
												<template #default="{ row, $index }">
													<div class="keyword-cell-with-zh">
														<div class="keyword-text-with-copy">
															<a
																class="keyword-search-link"
																:href="amazonKeywordSearchHref(row.token, 'de')"
																target="_blank"
																rel="noopener noreferrer"
																@click.stop
																>{{ row.token }}</a
															>
															<el-button
																link
																type="primary"
																class="keyword-copy-btn"
																:icon="DocumentCopy"
																title="复制"
																@click.stop="copyKeyword(row.token)"
															/>
														</div>
														<template
															v-if="
																getKeywordZhText(
																	'de',
																	'phrase',
																	$index
																)
															"
														>
															<template
																v-if="
																	keywordZhDisplayInline(
																		row.token
																	)
																"
															>
																<span
																	class="keyword-zh keyword-zh-inline"
																	>{{
																		getKeywordZhText(
																			"de",
																			"phrase",
																			$index
																		)
																	}}</span
																>
															</template>
															<div
																v-else
																class="keyword-zh keyword-zh-block"
															>
																{{
																	getKeywordZhText(
																		"de",
																		"phrase",
																		$index
																	)
																}}
															</div>
														</template>
													</div>
												</template>
											</el-table-column>
											<el-table-column
												prop="tokenType"
												label="类型"
												width="100"
												sortable
											/>
											<el-table-column
												prop="wordFreq"
												label="词频"
												width="72"
												align="right"
												sortable
											/>
											<el-table-column
												prop="searchVolume"
												label="搜索量"
												width="96"
												align="right"
												sortable
											/>
											<el-table-column
												prop="score"
												label="分数"
												width="72"
												align="right"
												sortable
											/>
										</template>
										<template v-else>
											<el-table-column
												prop="keyword"
												label="关键词"
												min-width="112"
												sortable
											>
												<template #default="{ row, $index }">
													<div class="keyword-cell-with-zh">
														<div class="keyword-text-with-copy">
															<a
																class="keyword-search-link"
																:href="amazonKeywordSearchHref(row.keyword, 'de')"
																target="_blank"
																rel="noopener noreferrer"
																@click.stop
																>{{ row.keyword }}</a
															>
															<el-button
																link
																type="primary"
																class="keyword-copy-btn"
																:icon="DocumentCopy"
																title="复制"
																@click.stop="copyKeyword(row.keyword)"
															/>
														</div>
														<template
															v-if="
																getKeywordZhText(
																	'de',
																	'sys',
																	$index
																)
															"
														>
															<template
																v-if="
																	keywordZhDisplayInline(
																		row.keyword
																	)
																"
															>
																<span
																	class="keyword-zh keyword-zh-inline"
																	>{{
																		getKeywordZhText(
																			"de",
																			"sys",
																			$index
																		)
																	}}</span
																>
															</template>
															<div
																v-else
																class="keyword-zh keyword-zh-block"
															>
																{{
																	getKeywordZhText(
																		"de",
																		"sys",
																		$index
																	)
																}}
															</div>
														</template>
													</div>
												</template>
											</el-table-column>
											<el-table-column prop="role" label="类型" min-width="92" sortable>
												<template #default="{ row }">
													<el-tag size="small" type="info">{{
														snapshotKeywordRoleLabel(row.role)
													}}</el-tag>
												</template>
											</el-table-column>
											<el-table-column
												label="父体搜索量"
												min-width="118"
												align="right"
												sortable
												:sort-method="sortKeywordParentSearchVolume"
											>
												<template #default="{ row }">
													{{
														Number(
															row?.parentSearchVolume ||
																row?.monthlySearch ||
																0
														)
													}}
												</template>
											</el-table-column>
											<el-table-column
												label="相似度总分"
												width="86"
												align="right"
												sortable
												:sort-method="sortKeywordSimilarityTotal"
											>
												<template #default="{ row }">
													{{
														Number(
															row?.similarityTotal ||
																row?.compositeScore ||
																0
														)
													}}
												</template>
											</el-table-column>
											<el-table-column
												prop="similarityImage"
												label="相似度图片"
												width="86"
												align="right"
												sortable
											>
												<template #default="{ row }">
													{{ Number(row?.similarityImage || 0) }}
												</template>
											</el-table-column>
											<el-table-column
												prop="similarityTitle"
												label="相似度标题"
												width="86"
												align="right"
												sortable
											>
												<template #default="{ row }">
													{{ Number(row?.similarityTitle || 0) }}
												</template>
											</el-table-column>
										</template>
									</el-table>
								</div>
							</div>
						</div>
						<div class="keyword-warning-head">问题词预警</div>
						<div class="keyword-two-col keyword-warning-two-col keyword-locale-stack">
							<div class="keyword-block">
								<div class="keyword-col-head">英语 - 问题词预警</div>
								<div class="keyword-table-wrap">
									<el-table
										:data="run.params.keywordsByLocale.en.warningWords || []"
										:row-class-name="warningRowClassNameEn"
										border
										size="small"
										class="keyword-table keyword-table--workbench"
									>
										<el-table-column prop="word" label="词" min-width="176" sortable>
											<template #default="{ row, $index }">
												<div class="keyword-cell-with-zh">
													<div class="keyword-text-with-copy">
														<a
															class="keyword-search-link"
															:href="amazonKeywordSearchHref(row.word, 'en')"
															target="_blank"
															rel="noopener noreferrer"
															@click.stop
															>{{ row.word }}</a
														>
														<el-button
															link
															type="primary"
															class="keyword-copy-btn"
															:icon="DocumentCopy"
															title="复制"
															@click.stop="copyKeyword(row.word)"
														/>
													</div>
													<template
														v-if="
															getKeywordZhText('en', 'warn', $index)
														"
													>
														<template
															v-if="keywordZhDisplayInline(row.word)"
														>
															<span
																class="keyword-zh keyword-zh-inline"
																>{{
																	getKeywordZhText(
																		"en",
																		"warn",
																		$index
																	)
																}}</span
															>
														</template>
														<div
															v-else
															class="keyword-zh keyword-zh-block"
														>
															{{
																getKeywordZhText(
																	"en",
																	"warn",
																	$index
																)
															}}
														</div>
													</template>
												</div>
											</template>
										</el-table-column>
										<el-table-column prop="type" label="类型" width="90" sortable />
										<el-table-column
											prop="reason"
											label="原因"
											min-width="120"
											sortable
										/>
										<el-table-column
											label="操作"
											width="96"
											align="center"
										>
											<template #default="{ row }">
												<template v-if="isReviewableWarningWord(row)">
													<el-button
														v-if="!row.ignored"
														link
														type="primary"
														size="small"
														@click="toggleWarningWordIgnored('en', row)"
														>忽略</el-button
													>
													<el-button
														v-else
														link
														type="info"
														size="small"
														@click="toggleWarningWordIgnored('en', row)"
														>取消</el-button
													>
												</template>
												<span v-else class="keyword-warn-op-muted">—</span>
											</template>
										</el-table-column>
									</el-table>
								</div>
							</div>
							<div class="keyword-block">
								<div class="keyword-col-head">德语 - 问题词预警</div>
								<div class="keyword-table-wrap">
									<el-table
										:data="run.params.keywordsByLocale.de.warningWords || []"
										:row-class-name="warningRowClassNameDe"
										border
										size="small"
										class="keyword-table keyword-table--workbench"
									>
										<el-table-column prop="word" label="词" min-width="176" sortable>
											<template #default="{ row, $index }">
												<div class="keyword-cell-with-zh">
													<div class="keyword-text-with-copy">
														<a
															class="keyword-search-link"
															:href="amazonKeywordSearchHref(row.word, 'de')"
															target="_blank"
															rel="noopener noreferrer"
															@click.stop
															>{{ row.word }}</a
														>
														<el-button
															link
															type="primary"
															class="keyword-copy-btn"
															:icon="DocumentCopy"
															title="复制"
															@click.stop="copyKeyword(row.word)"
														/>
													</div>
													<template
														v-if="
															getKeywordZhText('de', 'warn', $index)
														"
													>
														<template
															v-if="keywordZhDisplayInline(row.word)"
														>
															<span
																class="keyword-zh keyword-zh-inline"
																>{{
																	getKeywordZhText(
																		"de",
																		"warn",
																		$index
																	)
																}}</span
															>
														</template>
														<div
															v-else
															class="keyword-zh keyword-zh-block"
														>
															{{
																getKeywordZhText(
																	"de",
																	"warn",
																	$index
																)
															}}
														</div>
													</template>
												</div>
											</template>
										</el-table-column>
										<el-table-column prop="type" label="类型" width="90" sortable />
										<el-table-column
											prop="reason"
											label="原因"
											min-width="120"
											sortable
										/>
										<el-table-column
											label="操作"
											width="96"
											align="center"
										>
											<template #default="{ row }">
												<template v-if="isReviewableWarningWord(row)">
													<el-button
														v-if="!row.ignored"
														link
														type="primary"
														size="small"
														@click="toggleWarningWordIgnored('de', row)"
														>忽略</el-button
													>
													<el-button
														v-else
														link
														type="info"
														size="small"
														@click="toggleWarningWordIgnored('de', row)"
														>取消</el-button
													>
												</template>
												<span v-else class="keyword-warn-op-muted">—</span>
											</template>
										</el-table-column>
									</el-table>
								</div>
							</div>
						</div>
					</div>
				</aside>
			</div>

			<!-- 商品信息：折叠默认展开，紧凑总览 + 变体/链接 -->
			<el-collapse
				v-if="run"
				v-model="productInfoCollapseNames"
				class="product-info-collapse"
			>
				<el-collapse-item title="商品信息" name="product">
					<div class="product-three-col">
						<div class="product-panel">
							<div class="product-panel-title">变体列表</div>
							<el-table
								:data="variantTableRows"
								border
								size="small"
								max-height="260"
								class="product-mini-table"
							>
								<el-table-column
									prop="variantName"
									label="变体名称"
									min-width="120"
									show-overflow-tooltip
								/>
								<el-table-column
									prop="variantImage"
									label="变体图片"
									width="86"
									align="center"
								/>
								<el-table-column
									prop="factoryBundle"
									label="工厂链接组合"
									min-width="130"
									show-overflow-tooltip
								/>
								<el-table-column
									prop="variantDesc"
									label="变体描述"
									min-width="260"
								>
									<template #default="{ row }">
										<div class="product-variant-desc-cell">
											{{ row.variantDesc || "—" }}
										</div>
									</template>
								</el-table-column>
								<el-table-column
									prop="submitter"
									label="提交人"
									width="90"
									show-overflow-tooltip
								/>
							</el-table>
						</div>
						<div class="product-panel">
							<div class="product-panel-title">工厂链接</div>
							<el-table
								:data="factoryLinkRows"
								border
								size="small"
								max-height="260"
								class="product-mini-table"
							>
								<el-table-column
									prop="type"
									label="类型"
									width="68"
									align="center"
								/>
								<el-table-column
									prop="name"
									label="品名"
									min-width="100"
									show-overflow-tooltip
								/>
								<el-table-column
									prop="price"
									label="价格"
									width="72"
									align="right"
								/>
								<el-table-column label="链接" min-width="110" show-overflow-tooltip>
									<template #default="{ row }">
										<el-link
											:href="row.url"
											type="primary"
											target="_blank"
											:underline="false"
											>{{ row.linkLabel }}</el-link
										>
									</template>
								</el-table-column>
								<el-table-column
									prop="linkDesc"
									label="链接描述"
									min-width="120"
									show-overflow-tooltip
								/>
							</el-table>
						</div>
						<div class="product-panel">
							<div class="product-panel-title">采购数量</div>
							<el-table
								:data="purchaseRows"
								border
								size="small"
								max-height="260"
								class="product-mini-table"
							>
								<el-table-column
									prop="purchaseQty"
									label="采购数量"
									width="84"
									align="right"
								/>
								<el-table-column
									prop="ukQty"
									label="英国"
									width="64"
									align="right"
								/>
								<el-table-column
									prop="deQty"
									label="德国"
									width="64"
									align="right"
								/>
								<el-table-column label="状态" width="86" align="center">
									<template #default="{ row }">
										<el-tag
											:type="purchaseStatusType(row.status)"
											size="small"
											>{{ row.status }}</el-tag
										>
									</template>
								</el-table-column>
								<el-table-column
									prop="advice"
									label="采购意见"
									min-width="90"
									show-overflow-tooltip
								/>
								<el-table-column
									prop="selectedVariant"
									label="选择变体"
									min-width="100"
									show-overflow-tooltip
								/>
								<el-table-column
									prop="total"
									label="合计"
									width="64"
									align="right"
								/>
								<el-table-column
									prop="submitter"
									label="提交人"
									width="90"
									show-overflow-tooltip
								/>
							</el-table>
						</div>
					</div>
				</el-collapse-item>
			</el-collapse>

			<!-- 参考输入：折叠默认收起 -->
			<el-collapse
				v-if="run"
				v-model="referenceCompetitorCollapseNames"
				class="reference-competitor-collapse"
			>
				<el-collapse-item :title="referenceInputPanelTitle" name="competitorRef">
					<div class="reference-toolbar">
						<el-button
							size="small"
							:loading="translatingCompetitorRefToZh"
							:disabled="!hasCompetitorRefTranslateItems"
							@click="translateAllCompetitorRefToZh"
							>一键翻译</el-button
						>
					</div>
					<div
						v-if="referenceSourceType === 'manual_bullets'"
						class="reference-manual-list"
					>
						<div v-if="manualReferenceTitle" class="reference-item reference-manual-title">
							<div class="reference-item-title">参考标题：{{ manualReferenceTitle }}</div>
							<div
								v-if="manualReferenceTitleZh"
								class="reference-item-zh"
							>
								<span class="reference-item-zh-label">中文</span>
								<span class="reference-item-zh-text">{{ manualReferenceTitleZh }}</span>
							</div>
						</div>
						<div
							v-for="(item, idx) in manualReferenceRows"
							:key="`manual-${idx}`"
							class="reference-item"
						>
							<div class="reference-item-title">
								卖点{{ idx + 1 }}：{{ item.title || "-" }}
							</div>
							<div
								v-if="getCompetitorRefZhTranslation('en', idx, 'title')"
								class="reference-item-zh"
							>
								<span class="reference-item-zh-label">中文</span>
								<span class="reference-item-zh-text">{{
									getCompetitorRefZhTranslation("en", idx, "title")
								}}</span>
							</div>
						</div>
					</div>
					<div v-else class="reference-two-col">
						<div class="reference-col">
							<div class="reference-col-head">英语参考竞品</div>
							<div class="reference-list">
								<div
									v-for="(item, idx) in competitorRefEnRows"
									:key="`en-${idx}`"
									class="reference-item"
								>
									<div class="reference-item-title">
										竞品{{ idx + 1 }}：{{ item.title || "-" }}
									</div>
									<div
										v-if="getCompetitorRefZhTranslation('en', idx, 'title')"
										class="reference-item-zh"
									>
										<span class="reference-item-zh-label">中文</span>
										<span class="reference-item-zh-text">{{
											getCompetitorRefZhTranslation("en", idx, "title")
										}}</span>
									</div>
									<div
										v-for="(bp, bidx) in item.bullets"
										:key="`en-${idx}-bp-${bidx}`"
									>
										<div class="reference-item-bullet">
											卖点{{ bidx + 1 }}：{{ bp || "-" }}
										</div>
										<div
											v-if="
												getCompetitorRefZhTranslation(
													'en',
													idx,
													'bullet',
													bidx
												)
											"
											class="reference-item-zh reference-item-zh--bullet"
										>
											<span class="reference-item-zh-label">中文</span>
											<span class="reference-item-zh-text">{{
												getCompetitorRefZhTranslation(
													"en",
													idx,
													"bullet",
													bidx
												)
											}}</span>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="reference-col">
							<div class="reference-col-head">德语参考竞品</div>
							<div class="reference-list">
								<div
									v-for="(item, idx) in competitorRefDeRows"
									:key="`de-${idx}`"
									class="reference-item"
								>
									<div class="reference-item-title">
										竞品{{ idx + 1 }}：{{ item.title || "-" }}
									</div>
									<div
										v-if="getCompetitorRefZhTranslation('de', idx, 'title')"
										class="reference-item-zh"
									>
										<span class="reference-item-zh-label">中文</span>
										<span class="reference-item-zh-text">{{
											getCompetitorRefZhTranslation("de", idx, "title")
										}}</span>
									</div>
									<div
										v-for="(bp, bidx) in item.bullets"
										:key="`de-${idx}-bp-${bidx}`"
									>
										<div class="reference-item-bullet">
											卖点{{ bidx + 1 }}：{{ bp || "-" }}
										</div>
										<div
											v-if="
												getCompetitorRefZhTranslation(
													'de',
													idx,
													'bullet',
													bidx
												)
											"
											class="reference-item-zh reference-item-zh--bullet"
										>
											<span class="reference-item-zh-label">中文</span>
											<span class="reference-item-zh-text">{{
												getCompetitorRefZhTranslation(
													"de",
													idx,
													"bullet",
													bidx
												)
											}}</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</el-collapse-item>
			</el-collapse>

			<el-collapse class="progress-collapse" accordion>
				<el-collapse-item title="任务进度与时间线" name="p">
					<div class="progress-grid">
						<div class="progress-col">
							<div class="progress-col-title">流水线步骤</div>
							<el-steps
								direction="vertical"
								:active="stepActiveIndex"
								finish-status="success"
								align-center
							>
								<el-step
									v-for="s in run.steps"
									:key="s.key"
									:title="s.label"
									:status="stepUiStatus(s.status)"
									:description="stepDescription(s)"
								/>
							</el-steps>
						</div>
						<div class="progress-col">
							<div class="progress-col-title">事件时间线</div>
							<el-timeline class="lact-tl">
								<el-timeline-item
									v-for="(ev, i) in run.timeline"
									:key="i"
									:timestamp="ev.at"
									:type="timelineType(ev.level)"
									placement="top"
								>
									<div class="tl-title">{{ ev.title }}</div>
									<div v-if="ev.desc" class="tl-desc muted">{{ ev.desc }}</div>
								</el-timeline-item>
							</el-timeline>
						</div>
					</div>
				</el-collapse-item>
			</el-collapse>

			<div v-if="run.copy" class="audit-action-bar">
				<div class="audit-action-left">
					<span class="audit-action-title">审核操作</span>
					<el-tag v-if="hasUnsavedReviewDraft" type="warning" size="small" effect="plain"
						>已编辑，待保存</el-tag
					>
					<span class="muted">修改后可先保存草稿，确认无误再审核通过</span>
				</div>
				<div class="audit-action-right">
					<el-button size="small" @click="cancelReviewEdit">取消编辑</el-button>
					<el-button size="small" :loading="resettingReviewDraft" @click="resetAuditDraft"
						>重置文案</el-button
					>
					<el-button
						size="small"
						type="primary"
						plain
						:disabled="!canSaveReviewDraft"
						:loading="savingReviewDraft"
						@click="saveReviewDraft"
						>保存</el-button
					>
					<el-button
						size="small"
						type="success"
						:disabled="!canSaveReviewDraft"
						@click="approveReview"
						>审核通过</el-button
					>
				</div>
			</div>
		</template>

		<el-empty v-else-if="!detailLoading" description="未找到该任务（检查 id 或从列表进入）" />
		<listing-review-float-toolbar
			v-if="run && !detailLoading"
			:task-key="chatTaskKey"
			:task-id="chatTaskId"
			:reference-library="chatReferenceLibrary"
			:applied-suffix-row-keys="appliedCommonSuffixRowKeys"
			@banned-words-saved="onUserBannedWordsSaved"
			@apply-suffix-to-title="onApplyCommonSuffixToTitle"
			@revert-suffix-from-title="onRevertCommonSuffixFromTitle"
		/>
	</div>
</template>

<script setup lang="ts" name="app-listing-ai-copy-task-detail">
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { CircleCheckFilled, CircleCloseFilled, DocumentCopy } from "@element-plus/icons-vue";
// @ts-ignore
import ListingReviewFloatToolbar from "/$/app/components/listing-review-float-toolbar.vue";
import { service } from "/@/cool";
import { appConfig } from "../../../../../appConfig";
import {
	phaseLabel,
	phaseTagType,
	snapshotKeywordRoleLabel,
	type ListingAiCopyRun,
	type ListingAiParamsSnapshot,
	type ListingAiRunPhase,
	type ListingAiRunStep,
	type ListingAiRunStepStatus
} from "./listing-ai-copy-task-mock";
import {
	collectFlexiblePhraseMatches,
	phraseAppearsInText,
	pickNonOverlappingKeywordMatches
} from "../utils/keyword-phrase-match";
import { fetchListingBannedWords } from "../utils/listing-banned-word-api";
import { product_main_image_display_url } from "/$/app/utils";
import { appendCommaTitleSuffix } from "../utils/listing-title-append-suffix";
import { LISTING_TITLE_AMAZON_MAX } from "../utils/listing-title-char-limit";
import {
	assertVariantTitleSuffixRoundTrip,
	extractVariantTitleSuffix,
	stripVariantTitleSuffix
} from "../utils/listing-variant-title-suffix";
import {
	labelForRequiredLang,
	normalizeRequiredLanguages,
	requiredLanguagesFromPurchaseRows,
	type ListingAiRequiredLang
} from "../utils/listing-ai-required-languages";
import type {
	CommonSuffixApplyPayload,
	CommonSuffixRevertPayload
} from "../utils/listing-common-suffix-api";
import {
	clearReviewDraftCache,
	loadReviewDraftCache,
	saveReviewDraftCache,
	type ReviewDraftCachePayload
} from "../utils/listing-ai-copy-review-draft-cache";
import {
	capitalizeBulletBodyAfterSubtitle,
	isBulletCopyFieldLabel
} from "../utils/listing-bullet-subtitle-capitalize";
import { aggregateWordsFromSystemKeywords } from "../utils/listing-keyword-word-aggregate";
import { canShowTriggerDeButton } from "../utils/listing-ai-copy-task-actions";

const route = useRoute();
const router = useRouter();
const props = withDefaults(
	defineProps<{
		taskId?: number | string;
		embedded?: boolean;
	}>(),
	{
		taskId: "",
		embedded: false
	}
);
const emit = defineEmits<{
	(e: "approved"): void;
	(e: "refreshed"): void;
	(e: "close"): void;
}>();
const embedded = computed(() => Boolean(props.embedded));
type LocaleKey = "en" | "de";

const keywordViewMode = ref<"word" | "phrase" | "keyword">("word");
/** 切换模式 / 检测关键词时强制表格重挂载，避免 el-table 列缓存导致德英列不一致 */
const keywordTableRenderKey = ref(0);

function keywordModeColLabel(mode: typeof keywordViewMode.value) {
	if (mode === "word") return "单词";
	if (mode === "phrase") return "词组";
	return "关键词";
}

function wordHasSourceKeywords(row: { sourceKeywords?: string[] }) {
	return Array.isArray(row?.sourceKeywords) && row.sourceKeywords.length > 0;
}

const keywordWordAggregateEn = computed(() =>
	aggregateWordsFromSystemKeywords(run.value?.params?.keywordsByLocale?.en?.systemKeywords, "en")
);

const keywordWordAggregateDe = computed(() =>
	aggregateWordsFromSystemKeywords(run.value?.params?.keywordsByLocale?.de?.systemKeywords, "de")
);

const keywordTableDataEn = computed(() => {
	const mode = keywordViewMode.value;
	if (mode === "word") return keywordWordAggregateEn.value;
	if (mode === "phrase") return run.value?.params?.keywordsByLocale?.en?.aiSplitTokens || [];
	return run.value?.params?.keywordsByLocale?.en?.systemKeywords || [];
});

const keywordTableDataDe = computed(() => {
	const mode = keywordViewMode.value;
	if (mode === "word") return keywordWordAggregateDe.value;
	if (mode === "phrase") return run.value?.params?.keywordsByLocale?.de?.aiSplitTokens || [];
	return run.value?.params?.keywordsByLocale?.de?.systemKeywords || [];
});

watch(keywordViewMode, () => {
	keywordTableRenderKey.value += 1;
});
/** 商品信息折叠：默认展开 */
const productInfoCollapseNames = ref<string[]>(["product"]);
/** 参考竞品折叠：默认折叠 */
const referenceCompetitorCollapseNames = ref<string[]>([]);

const run = ref<ListingAiCopyRun | undefined>();
const detailLoading = ref(false);
let loadDetailSeq = 0;
const loadedDetailTaskId = ref(0);
const resettingReviewDraft = ref(false);
let suppressAuditSyncFromServer = false;
const serverWarningIgnoresBaseline = ref<{
	en: Record<string, boolean>;
	de: Record<string, boolean>;
}>({ en: {}, de: {} });
const terminatingTask = ref(false);
const triggeringDe = ref(false);
const savingReviewDraft = ref(false);
const canTriggerDeCopy = computed(() => canShowTriggerDeButton((run.value as any)?._rawTask));
const canTerminateTask = computed(() => {
	const status = Number((run.value as any)?._rawTask?.status || 0);
	return status >= 100 && status < 390;
});
const canSaveReviewDraft = computed(() => {
	if (!run.value?.copy) return false;
	const status = Number((run.value as any)?._rawTask?.status || 0);
	if (status !== 390) return false;
	const phase = run.value.phase;
	return phase === "awaiting_review";
});
const metaPickImageSrc = computed(() => String(run.value?.candidateImageUrl || "").trim());
const canOpenProductPage = computed(() => {
	const asin = String(run.value?.asin || "").trim();
	const marketplace = String(run.value?.marketplace || "").trim();
	return Boolean(asin && marketplace);
});

function openProductPage() {
	if (!run.value?.asin || !run.value?.marketplace) return;
	const cleanAsin = String(run.value.asin).replace(/[^A-Z0-9]/g, "");
	if (!cleanAsin) return;
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, run.value.marketplace);
	window.open(dpUrl);
}

const keywordDetectionEnabled = ref(false);
/** 全员违禁词库（检测用，按词去重） */
const userBannedWordsCatalog = ref<Array<{ word: string; reason: string }>>([]);
/** 关键词区：单词/词列 批量译中文结果，key 见 keywordTransKey */
const keywordZhTranslations = ref<Record<string, string>>({});
const translatingKeywordsToZh = ref(false);
/** 原文长度 ≤ 此值时译文与原文同一行 */
const KEYWORD_ZH_INLINE_MAX = 40;
const designTaskOtherInfo = ref<{ variants: any[]; factoryLinks: any[]; purchases: any[] }>({
	variants: [],
	factoryLinks: [],
	purchases: []
});
const shopAmazonAccountId = computed(() =>
	String((run.value as any)?._rawTask?.target_amazon_account_id || "").trim()
);
const displayRequiredLanguages = computed((): ListingAiRequiredLang[] => {
	const fromApi = normalizeRequiredLanguages(run.value?.requiredLanguages);
	if (fromApi.length) return fromApi;
	return requiredLanguagesFromPurchaseRows(
		designTaskOtherInfo.value.purchases || [],
		shopAmazonAccountId.value
	);
});
const metaVariantTags = computed(() => {
	const names = (designTaskOtherInfo.value.variants || [])
		.map((v: any) => String(v?.name || v?.variant_name || v?.variantsid || "").trim())
		.filter(Boolean);
	return Array.from(new Set(names));
});

function emptyParams() {
	return {
		language: "English / German",
		coreKeywordsCount: 0,
		longTailCount: 0,
		competitorGroupsUsed: 0,
		paramsNote: "",
		selectedKeywords: [],
		selectedCompetitors: [],
		keywordsByLocale: {
			en: {
				aiSplitTokens: [],
				systemKeywords: [],
				aiWarningWords: [],
				warningWords: [],
				selectedTitleWords: { mainWords: [], coreWords: [], longTailPhrases: [] }
			},
			de: {
				aiSplitTokens: [],
				systemKeywords: [],
				aiWarningWords: [],
				warningWords: [],
				selectedTitleWords: { mainWords: [], coreWords: [], longTailPhrases: [] }
			}
		},
		extraNotes: "",
		rawPreview: {}
	};
}

function makeStepsByPhase(phase: ListingAiRunPhase): ListingAiRunStep[] {
	const enqueueDone: ListingAiRunStep = { key: "enqueue", label: "入队", status: "done" };
	if (phase === "queued") {
		return [
			enqueueDone,
			{ key: "ai_params", label: "AI 选参", status: "pending" },
			{ key: "ai_copy", label: "AI 生成文案", status: "pending" },
			{ key: "publish_studio", label: "写入 Studio", status: "pending" },
			{ key: "review", label: "人工确认", status: "pending" }
		];
	}
	if (phase === "ai_params_running") {
		return [
			enqueueDone,
			{ key: "ai_params", label: "AI 选参", status: "running" },
			{ key: "ai_copy", label: "AI 生成文案", status: "pending" },
			{ key: "publish_studio", label: "写入 Studio", status: "pending" },
			{ key: "review", label: "人工确认", status: "pending" }
		];
	}
	if (phase === "ai_params_failed") {
		return [
			enqueueDone,
			{ key: "ai_params", label: "AI 选参", status: "failed" },
			{ key: "ai_copy", label: "AI 生成文案", status: "skipped" },
			{ key: "publish_studio", label: "写入 Studio", status: "skipped" },
			{ key: "review", label: "人工确认", status: "skipped" }
		];
	}
	if (phase === "ai_copy_running") {
		return [
			enqueueDone,
			{ key: "ai_params", label: "AI 选参", status: "done" },
			{ key: "ai_copy", label: "AI 生成文案", status: "running" },
			{ key: "publish_studio", label: "写入 Studio", status: "pending" },
			{ key: "review", label: "人工确认", status: "pending" }
		];
	}
	if (phase === "ai_copy_failed") {
		return [
			enqueueDone,
			{ key: "ai_params", label: "AI 选参", status: "done" },
			{ key: "ai_copy", label: "AI 生成文案", status: "failed" },
			{ key: "publish_studio", label: "写入 Studio", status: "skipped" },
			{ key: "review", label: "人工确认", status: "skipped" }
		];
	}
	if (phase === "ai_params_failed") {
		return [
			enqueueDone,
			{ key: "ai_params", label: "前置校验", status: "failed" },
			{ key: "ai_copy", label: "AI 生成文案", status: "skipped" },
			{ key: "publish_studio", label: "写入 Studio", status: "skipped" },
			{ key: "review", label: "人工确认", status: "skipped" }
		];
	}
	return [
		enqueueDone,
		{ key: "ai_params", label: "AI 选参", status: "done" },
		{ key: "ai_copy", label: "AI 生成文案", status: "done" },
		{ key: "publish_studio", label: "写入 Studio", status: "done" },
		{
			key: "review",
			label: "人工确认",
			status:
				phase === "awaiting_review"
					? "running"
					: phase === "accepted" || phase === "closed"
						? "done"
						: "pending",
			detail: phase === "closed" ? "已关闭" : phase === "accepted" ? "已确认" : undefined
		}
	];
}

function makeTimeline(task: any) {
	const rows = Array.isArray(task?.timeline) ? task.timeline : [];
	return rows.map((item: any) => ({
		at: String(item?.at || ""),
		title: String(item?.remark || item?.stage || "事件"),
		desc: String(item?.extra ? JSON.stringify(item.extra) : ""),
		level: item?.status >= 900 ? "danger" : "info"
	}));
}

function mapStatusToDetailPhase(status: number, stage?: string): ListingAiRunPhase {
	if (status === 390) {
		const s = String(stage || "").toLowerCase();
		if (s === "review_approved" || s === "accepted") return "accepted";
		if (s === "review_closed") return "closed";
		return "awaiting_review";
	}
	if (status === 900) return "ai_copy_failed";
	if (status === 990) return "superseded";
	if (status >= 300) return "ai_copy_done";
	if (status >= 200) return "ai_copy_running";
	if (status >= 190) return "ai_params_done";
	if (status >= 110) return "ai_params_running";
	return "queued";
}

function buildRunFromTask(task: any): ListingAiCopyRun {
	const status = Number(task?.status || 0);
	const failedStage = String(task?.failed_stage || "").toLowerCase();
	let phase = mapStatusToDetailPhase(status, String(task?.stage || ""));
	if (status === 900 && failedStage === "preflight") {
		phase = "ai_params_failed";
	}
	const idStr = String(task?.id ?? "");
	const flowContext = task?.flow_context || {};
	const variantResult = flowContext?.variant_materialize_stage?.result || {};
	const firstVariant = Object.values(variantResult || {})[0] as any;
	const langgraphResult = (task?.langgraph_result || {}) as Record<string, any>;
	const enCopy = langgraphResult?.en?.base_copy || {};
	const deCopy = langgraphResult?.de?.base_copy || {};
	const parseBullets = (raw: any) =>
		Array.isArray(raw)
			? raw
					.map((row) =>
						String(
							row?.bullet_point ??
								row?.bullet ??
								row?.text ??
								row?.content ??
								(typeof row === "string" ? row : "")
						)
					)
					.slice(0, 5)
			: [];
	const parseSplitTokens = (raw: any) =>
		Array.isArray(raw)
			? raw
					.map((row: any) => ({
						token: String(row?.word || ""),
						tokenType:
							String(row?.type || "").toLowerCase() === "alternative"
								? "替换词"
								: String(row?.type || "").toLowerCase() === "scene"
									? "场景词"
									: "修饰词",
						wordFreq: String(Number(row?.frequency || 0)),
						searchVolume: String(Number(row?.search_volume || 0)),
						score:
							row?.score != null && !Number.isNaN(Number(row.score))
								? Number(row.score).toFixed(2)
								: String(Number(row?.traffic_score || 0))
					}))
					.filter((x: any) => x.token)
			: [];
	const prependCoreTokenRows = (
		rows: Array<{
			token: string;
			tokenType: string;
			wordFreq: string;
			searchVolume: string;
			score: string;
		}>,
		titleWords: any
	) => {
		const mainWord = Array.isArray(titleWords?.main_word)
			? String(titleWords.main_word[0] || "").trim()
			: "";
		const coreWords = Array.isArray(titleWords?.core_words)
			? titleWords.core_words.map((w: any) => String(w || "").trim()).filter(Boolean)
			: [];
		const fixedRows: Array<{
			token: string;
			tokenType: string;
			wordFreq: string;
			searchVolume: string;
			score: string;
		}> = [];
		if (mainWord) {
			fixedRows.push({
				token: mainWord,
				tokenType: "核心大词",
				wordFreq: "-",
				searchVolume: "-",
				score: "-"
			});
		}
		for (const word of coreWords.slice(0, 2)) {
			fixedRows.push({
				token: word,
				tokenType: "核心词",
				wordFreq: "-",
				searchVolume: "-",
				score: "-"
			});
		}
		return [...fixedRows, ...rows];
	};
	const enBullets = parseBullets(enCopy?.bullet_points);
	const deBullets = parseBullets(deCopy?.bullet_points);
	const enLongTailPhrases = Array.isArray(enCopy?.long_tail_phrases)
		? enCopy.long_tail_phrases
		: [];
	const deLongTailPhrases = Array.isArray(deCopy?.long_tail_phrases)
		? deCopy.long_tail_phrases
		: [];
	const enTitleWords = enCopy?.title_words || {};
	const deTitleWords = deCopy?.title_words || {};
	const parseWarningWords = (copy: any) => {
		const rows: Array<{
			word: string;
			type: "品牌词" | "无关词" | "潜在风险词" | "违禁词";
			reason: string;
			ignored?: boolean;
		}> = [];
		const brandRows = Array.isArray(copy?.brand_names) ? copy.brand_names : [];
		const irrelevantRows = Array.isArray(copy?.irrelevant_words) ? copy.irrelevant_words : [];
		const potentialRiskRows = Array.isArray(copy?.potential_risk_words)
			? copy.potential_risk_words
			: [];
		for (const row of brandRows) {
			const word = String(row?.brand_name || "").trim();
			if (!word) continue;
			rows.push({
				word,
				type: "品牌词",
				reason: String(row?.reason || "").trim()
			});
		}
		for (const row of irrelevantRows) {
			const word = String(row?.irrelevant_word || "").trim();
			if (!word) continue;
			rows.push({
				word,
				type: "无关词",
				reason: String(row?.reason || "").trim()
			});
		}
		for (const row of potentialRiskRows) {
			const word = String(row?.risk_phrase || row?.word || "").trim();
			if (!word) continue;
			rows.push({
				word,
				type: "潜在风险词",
				reason: String(row?.reason || "").trim()
			});
		}
		return rows;
	};
	const enSplitTokens = prependCoreTokenRows(parseSplitTokens(enLongTailPhrases), enTitleWords);
	const deSplitTokens = prependCoreTokenRows(parseSplitTokens(deLongTailPhrases), deTitleWords);
	const reviewWarningWordIgnores = (flowContext?.review_warning_word_ignores || {}) as Record<
		string,
		Record<string, boolean>
	>;
	const enAiWarningWords = parseWarningWords(enCopy);
	const deAiWarningWords = parseWarningWords(deCopy);
	/** 展示用：合并上次审核落库的忽略；aiWarningWords 保持 AI 原始结果供检测重建 */
	const enWarningWords = applyWarningWordIgnores(
		enAiWarningWords.map((row) => ({ ...row })),
		reviewWarningWordIgnores.en
	);
	const deWarningWords = applyWarningWordIgnores(
		deAiWarningWords.map((row) => ({ ...row })),
		reviewWarningWordIgnores.de
	);
	const mapSystemKeywords = (rows: any[], country: string) =>
		Array.isArray(rows)
			? rows.map((row: any) => ({
					keyword: String(row?.keyword || ""),
					role:
						row?.type === "核心大词"
							? "core_head"
							: row?.type === "长尾词"
								? "long_tail"
								: "core",
					trafficRatio: "",
					monthlySearch: String(row?.search_volume || 0),
					parentSearchVolume: Number(row?.search_volume || 0),
					compositeScore: String(row?.total_relevance_score || row?.traffic_score || ""),
					similarityTotal: Number(row?.total_relevance_score ?? row?.traffic_score ?? 0),
					similarityImage: Number(row?.image_relevance_score ?? 0),
					similarityTitle: Number(row?.title_relevance_score ?? 0),
					country
				}))
			: [];
	const keywordRaw = (task?.keyword_result || {}) as Record<string, any>;
	const keywordByLang = {
		en: keywordRaw?.en || {},
		de: keywordRaw?.de || {}
	} as Record<string, any>;
	const selectedKeywords = mapSystemKeywords(
		keywordByLang?.en?.normalized_keywords || [],
		"英国"
	);
	const deInputKeywords = mapSystemKeywords(keywordByLang?.de?.normalized_keywords || [], "德国");
	const deSystemKeywords = deInputKeywords.length
		? deInputKeywords
		: selectedKeywords.map((row: any) => ({ ...row, country: "德国" }));
	return {
		_rawTask: task as any,
		id: idStr,
		taskMode: String(task?.task_mode || "full") === "delta" ? "delta" : "full",
		rootTaskId: task?.root_task_id != null ? Number(task.root_task_id) : null,
		mergeIntoTaskId: task?.merge_into_task_id != null ? Number(task.merge_into_task_id) : null,
		runUuid: String(
			task?.langgraph_run_id || task?.go_task_id || `task-${idStr || "unknown"}`
		).trim(),
		langgraphRunId: String(task?.langgraph_run_id || "").trim(),
		goTaskId: String(task?.go_task_id || "").trim(),
		sku: String(task?.sku || ""),
		asin: String(task?.asin || "").trim(),
		msku: String(task?.msku || firstVariant?.variant_id || ""),
		productTitle: String(task?.product_title || firstVariant?.title || ""),
		candidateImageUrl: product_main_image_display_url(task?.candidate_image_url),
		accountName: String(task?.account_name || task?.accountName || "").trim(),
		requiredLanguages: normalizeRequiredLanguages(
			task?.required_languages ?? task?.requiredLanguages
		),
		applicantName: String(task?.applicant_name || task?.applicantName || "").trim(),
		marketplace: String(task?.marketplace || "").trim(),
		phase,
		trigger: "auto_msku",
		triggerLabel: "系统触发",
		createdAt: String(task?.createTime || ""),
		updatedAt: String(task?.updateTime || ""),
		errorMessage: String(task?.error_message || task?.last_error_message || ""),
		steps: makeStepsByPhase(phase),
		timeline: makeTimeline(task),
		params: {
			...emptyParams(),
			selectedKeywords,
			keywordsByLocale: {
				en: {
					aiSplitTokens: enSplitTokens,
					systemKeywords: selectedKeywords,
					aiWarningWords: enAiWarningWords,
					warningWords: enWarningWords,
					selectedTitleWords: {
						mainWords: Array.isArray(enTitleWords?.main_word)
							? enTitleWords.main_word
							: [],
						coreWords: Array.isArray(enTitleWords?.core_words)
							? enTitleWords.core_words
							: [],
						longTailPhrases: enLongTailPhrases
					}
				},
				de: {
					aiSplitTokens: deSplitTokens,
					systemKeywords: deSystemKeywords,
					aiWarningWords: deAiWarningWords,
					warningWords: deWarningWords,
					selectedTitleWords: {
						mainWords: Array.isArray(deTitleWords?.main_word)
							? deTitleWords.main_word
							: [],
						coreWords: Array.isArray(deTitleWords?.core_words)
							? deTitleWords.core_words
							: [],
						longTailPhrases: deLongTailPhrases
					}
				}
			},
			selectedCompetitors: Array.isArray(
				task?.keyword_result?.keyword_stage?.competitor_pick?.top4
			)
				? task.keyword_result.keyword_stage.competitor_pick.top4.map((x: any) => ({
						id: String(x?.id || ""),
						asin: String(x?.asin || ""),
						marketplace: String(x?.marketplace || ""),
						brandHint: "",
						title: String(x?.title || ""),
						bullets: String(x?.bullet_points || "")
							.split(/\r?\n+/)
							.map((t) => t.trim())
							.filter(Boolean)
							.slice(0, 5)
					}))
				: []
		},
		copy:
			enCopy && typeof enCopy === "object"
				? {
						titleDraft: String(enCopy?.title || firstVariant?.title || ""),
						bullets: enBullets.length ? enBullets : ["", "", "", "", ""],
						description: String(enCopy?.description || firstVariant?.summary || ""),
						threadRef: "",
						_de: {
							titleDraft: String(deCopy?.title || ""),
							bullets: deBullets,
							description: String(deCopy?.description || "")
						} as any
					}
				: undefined
	} as any;
}

function resetDetailViewState() {
	run.value = undefined;
	serverWarningIgnoresBaseline.value = { en: {}, de: {} };
	keywordZhTranslations.value = {};
	clearCompetitorRefZhTranslations();
	auditCopyRows.value = [];
	clearCopyZhTranslations();
	clearAppliedCommonSuffixState();
	designTaskOtherInfo.value = { variants: [], factoryLinks: [], purchases: [] };
}

async function loadRunDetail() {
	const id = String(props.taskId || route.query.id || "").trim();
	const seq = ++loadDetailSeq;
	detailLoading.value = true;
	resetDetailViewState();

	const finishLoading = () => {
		if (seq === loadDetailSeq) detailLoading.value = false;
	};

	if (!id) {
		finishLoading();
		return;
	}
	const numericId = Number(id);
	if (!Number.isFinite(numericId) || numericId <= 0) {
		finishLoading();
		return;
	}

	try {
		const api = (service as any).app?.ai_listing_task;
		if (!api) {
			finishLoading();
			return;
		}
		const statusRes = api.status
			? await api.status({ id: numericId })
			: api.getStatus
				? await api.getStatus({ id: numericId })
				: null;
		if (seq !== loadDetailSeq) return;
		const task = statusRes?.data ?? statusRes;
		if (!task?.id) {
			finishLoading();
			return;
		}

		let listDetail: any = null;
		try {
			if (api.page) {
				const pageRes = await api.page({
					page: 1,
					size: 1,
					keyword: String(numericId),
					statusGroup: "all"
				});
				if (seq !== loadDetailSeq) return;
				const pageData = pageRes?.data ?? pageRes;
				listDetail = Array.isArray(pageData?.list)
					? pageData.list.find((x: any) => Number(x.id) === numericId)
					: null;
			}
		} catch {
			// ignore page errors, status fallback still works
		}

		if (seq !== loadDetailSeq) return;
		const mergedTask = {
			...task,
			...(listDetail || {}),
			required_languages:
				task?.required_languages ??
				listDetail?.required_languages ??
				listDetail?.requiredLanguages,
			can_trigger_de:
				task?.can_trigger_de ?? listDetail?.can_trigger_de ?? listDetail?.canTriggerDe
		};
		run.value = buildRunFromTask(mergedTask);
		serverWarningIgnoresBaseline.value = extractServerWarningIgnoresFromTask(mergedTask);
		keywordZhTranslations.value = {};
		await loadDesignTaskOtherInfo({
			targetCandidateId: Number(task?.target_candidate_id || 0),
			sku: String(listDetail?.sku || task?.sku || "")
		});
		if (seq !== loadDetailSeq) return;
		await loadUserBannedWordsCatalog();
		if (seq !== loadDetailSeq) return;
		await nextTick();
		loadedDetailTaskId.value = numericId;
		await restoreReviewDraftFromCache(numericId);
	} catch {
		if (seq !== loadDetailSeq) return;
		resetDetailViewState();
	} finally {
		finishLoading();
		if (seq === loadDetailSeq && run.value) {
			void autoTranslateDetailContent(seq);
		}
	}
}

type VariantMetaRow = { variantsid: string; name: string; description: string };

function mergeVariantMetaRows(...sources: Array<VariantMetaRow[] | undefined>): VariantMetaRow[] {
	const map = new Map<string, VariantMetaRow>();
	for (const list of sources) {
		for (const row of list || []) {
			const id = String(row?.variantsid || "").trim();
			if (!id) continue;
			const prev = map.get(id);
			const name = String(row?.name || prev?.name || "").trim();
			const description = String(row?.description ?? prev?.description ?? "").trim();
			map.set(id, { variantsid: id, name, description });
		}
	}
	return Array.from(map.values());
}

/** 选品全量变体（不受图需 MSKU 过滤）；用于对齐 langgraph variant_titles 的 key */
async function loadCandidateVariantMeta(candidateId: number): Promise<VariantMetaRow[]> {
	const cid = Number(candidateId || 0);
	if (!cid) return [];
	try {
		const api = (service as any).app?.bsr_candidate;
		if (!api?.info) return [];
		const res = await api.info({ id: cid });
		const data = res?.data ?? res ?? {};
		const vc = Array.isArray(data?.variant_Combination) ? data.variant_Combination : [];
		return vc
			.map((v: any) => ({
				variantsid: String(v?.id || "").trim(),
				name: String(v?.name || "").trim(),
				description: String(v?.description || "").trim()
			}))
			.filter((v: VariantMetaRow) => v.variantsid);
	} catch {
		return [];
	}
}

function buildVariantMarkerNameMap(rawTask: any): Map<string, string> {
	const map = new Map<string, string>();
	const fc = rawTask?.flow_context || {};
	const byLang = fc?.keyword_stage_by_lang || {};
	const buckets = [
		...(byLang?.en?.variant_marker?.markers || []),
		...(byLang?.de?.variant_marker?.markers || []),
		...(fc?.keyword_stage?.variant_marker?.markers || [])
	];
	for (const m of buckets) {
		const id = String(m?.variant_id || "").trim();
		const marker = String(m?.marker || "").trim();
		if (id && marker && !map.has(id)) map.set(id, marker);
	}
	return map;
}

async function loadDesignTaskOtherInfo(args: { targetCandidateId: number; sku: string }) {
	const candidateVariants = await loadCandidateVariantMeta(args.targetCandidateId);
	const api = (service as any).app?.design_task;
	if (!api?.pageByScene || !api?.detail) {
		designTaskOtherInfo.value = {
			variants: candidateVariants,
			factoryLinks: [],
			purchases: []
		};
		return;
	}
	try {
		const pageRes = await api.pageByScene({
			scene: "all",
			keyword: args.sku || "",
			page: 1,
			size: 20
		});
		const pageData = pageRes?.data ?? pageRes ?? {};
		const list = Array.isArray(pageData?.list) ? pageData.list : [];
		const matched =
			list.find(
				(x: any) => Number(x?.candidate_id || 0) === Number(args.targetCandidateId || 0)
			) || list[0];
		if (!matched?.id) {
			designTaskOtherInfo.value = {
				variants: candidateVariants,
				factoryLinks: [],
				purchases: []
			};
			return;
		}
		const detailRes = await api.detail({ id: Number(matched.id) });
		const detailData = detailRes?.data ?? detailRes ?? {};
		const designVariants = Array.isArray(detailData?.variants) ? detailData.variants : [];
		designTaskOtherInfo.value = {
			variants: mergeVariantMetaRows(candidateVariants, designVariants),
			factoryLinks: Array.isArray(detailData?.factoryLinks) ? detailData.factoryLinks : [],
			purchases: Array.isArray(detailData?.purchases) ? detailData.purchases : []
		};
	} catch {
		designTaskOtherInfo.value = {
			variants: candidateVariants,
			factoryLinks: [],
			purchases: []
		};
	}
}

const chatTaskKey = computed(() => String(props.taskId || route.query.id || ""));
const chatTaskId = computed(() => {
	const n = Number(props.taskId || route.query.taskId || 0);
	return Number.isFinite(n) && n > 0 ? n : undefined;
});

function formatKeywordsForChatReference(block?: ListingAiParamsSnapshot["keywordsByLocale"]["en"]) {
	const keywords = Array.isArray(block?.systemKeywords) ? block.systemKeywords : [];
	if (!keywords.length) return "";
	return keywords
		.map((k) => {
			const parts = [
				String(k?.keyword || "").trim(),
				k?.role ? `role=${k.role}` : "",
				k?.trafficRatio ? `traffic=${k.trafficRatio}` : "",
				k?.monthlySearch ? `search=${k.monthlySearch}` : "",
				k?.compositeScore ? `score=${k.compositeScore}` : "",
				k?.country ? `country=${k.country}` : ""
			].filter(Boolean);
			return parts.join(" | ");
		})
		.filter(Boolean)
		.join("\n");
}

const chatReferenceLibrary = computed<Record<string, string>>(() => {
	const emptyBullets = ["", "", "", "", ""];
	const copy = run.value?.copy;
	const de = (copy as any)?._de || {};
	const kw = run.value?.params?.keywordsByLocale;
	const enBullets = copy?.bullets?.length ? copy.bullets : emptyBullets;
	const deBullets = Array.isArray(de?.bullets) && de.bullets.length ? de.bullets : emptyBullets;
	return {
		title_en: copy?.titleDraft || "",
		title_de: de?.titleDraft || "",
		bullet1_en: enBullets[0] || "",
		bullet1_de: deBullets[0] || "",
		bullet2_en: enBullets[1] || "",
		bullet2_de: deBullets[1] || "",
		bullet3_en: enBullets[2] || "",
		bullet3_de: deBullets[2] || "",
		bullet4_en: enBullets[3] || "",
		bullet4_de: deBullets[3] || "",
		bullet5_en: enBullets[4] || "",
		bullet5_de: deBullets[4] || "",
		description_en: copy?.description || "",
		description_de: de?.description || "",
		keywords_en: formatKeywordsForChatReference(kw?.en),
		keywords_de: formatKeywordsForChatReference(kw?.de)
	};
});

const pendingCopyHint = computed(() => {
	const p = run.value?.phase;
	if (!p) return "暂无文案";
	if (p === "ai_copy_running") return "文案生成中，完成后将展示标题、五点与描述";
	if (p === "ai_copy_failed" || p === "ai_params_failed") return "流水线失败，未产出完整文案";
	if (p === "ai_params_done") return "选参已完成，等待或正在进行文案生成";
	return "当前阶段尚无完整生成结果";
});

interface CopyTableRow {
	fieldLabel: string;
	rowType?: "normal" | "variant_option";
	variantTitle?: string;
	variantDesc?: string;
	en: string;
	de: string;
}

const copyTableColumns = [
	{ key: "en", label: "英语 (EN)", minWidth: 260 },
	{ key: "de", label: "德语 (DE)", minWidth: 260 }
] as const;

function isCopyLangRequired(lang: (typeof copyTableColumns)[number]["key"]): boolean {
	return displayRequiredLanguages.value.includes(lang);
}

/** 变体选项行：合并 EN+DE 列，中间展示变体名/描述 */
function copyTableSpanMethod({
	row,
	columnIndex
}: {
	row: CopyTableRow;
	column: unknown;
	rowIndex: number;
	columnIndex: number;
}) {
	if (row.rowType !== "variant_option") {
		return { rowspan: 1, colspan: 1 };
	}
	if (columnIndex === 1) {
		return { rowspan: 1, colspan: 2 };
	}
	if (columnIndex === 2) {
		return { rowspan: 0, colspan: 0 };
	}
	return { rowspan: 1, colspan: 1 };
}

const copyTableRows = computed<CopyTableRow[]>(() => {
	const copy = run.value?.copy;
	if (!copy) return [];
	const rawTask = (run.value as any)?._rawTask || {};
	const enVariantTitles = rawTask?.langgraph_result?.en?.variant_titles || {};
	const deVariantTitles = rawTask?.langgraph_result?.de?.variant_titles || {};
	const firstEnVariantTitle = Object.values(enVariantTitles || {})[0] as any;
	const firstDeVariantTitle = Object.values(deVariantTitles || {})[0] as any;
	const enBaseTitle =
		String(copy.titleDraft || "").trim() ||
		stripVariantTitleSuffix(firstEnVariantTitle);
	const de = (copy as any)?._de || {};
	const deBaseTitle =
		String(de?.titleDraft || "").trim() ||
		stripVariantTitleSuffix(firstDeVariantTitle);
	const deBullets = Array.isArray(de?.bullets) ? de.bullets : [];
	const bullets = Array.from({ length: 5 }, (_, i) => copy.bullets[i] || "");
	const variantDescMap = new Map<string, string>(
		(designTaskOtherInfo.value.variants || []).map((v: any) => [
			String(v?.variantsid || ""),
			String(v?.description || "")
		])
	);
	const variantOptionRows = variantTitleSuffixRows.value.map((x, idx) => ({
		fieldLabel: `变体选项 ${idx + 1}`,
		rowType: "variant_option" as const,
		variantTitle: x.variantName,
		variantDesc: variantDescMap.get(String(x.variantId)) || "",
		en: x.enSuffix || "",
		de: x.deSuffix || ""
	}));
	const baseRows: Array<CopyTableRow> = [
		{ fieldLabel: "标题", rowType: "normal", en: enBaseTitle, de: deBaseTitle },
		...variantOptionRows,
		...bullets.map((line, idx) => ({
			fieldLabel: `卖点 ${idx + 1}`,
			rowType: "normal" as const,
			en: line,
			de: String(deBullets[idx] || "")
		})),
		{
			fieldLabel: "描述",
			rowType: "normal",
			en: copy.description || "",
			de: String(de?.description || "")
		}
	];
	return baseRows.map((item) => ({
		fieldLabel: item.fieldLabel,
		rowType: item.rowType || "normal",
		variantTitle: item.variantTitle || "",
		variantDesc: item.variantDesc || "",
		en: item.en,
		de: String(item.de || "")
	}));
});

const variantTitleSuffixRows = computed(() => {
	const rawTask = (run.value as any)?._rawTask || {};
	const enVariantTitles = (rawTask?.langgraph_result?.en?.variant_titles || {}) as Record<
		string,
		string
	>;
	const deVariantTitles = (rawTask?.langgraph_result?.de?.variant_titles || {}) as Record<
		string,
		string
	>;
	const variantNameMap = new Map<string, string>(
		(designTaskOtherInfo.value.variants || []).map((v: any) => [
			String(v?.variantsid || ""),
			String(v?.name || "")
		])
	);
	const markerNameMap = buildVariantMarkerNameMap(rawTask);
	const enBaseTitle = String(run.value?.copy?.titleDraft || "").trim();
	const deBaseTitle = String((run.value?.copy as any)?._de?.titleDraft || "").trim();
	const allIds = Array.from(
		new Set([...Object.keys(enVariantTitles), ...Object.keys(deVariantTitles)])
	);
	const resolveVariantDisplayName = (id: string) => {
		const name = String(variantNameMap.get(id) || "").trim();
		if (name) return name;
		const marker = String(markerNameMap.get(id) || "").trim();
		if (marker) return marker;
		return id;
	};
	return allIds
		.map((id) => ({
			variantId: id,
			variantName: resolveVariantDisplayName(id),
			enSuffix: extractVariantTitleSuffix(enVariantTitles[id], enBaseTitle),
			deSuffix: extractVariantTitleSuffix(deVariantTitles[id], deBaseTitle)
		}))
		.filter((x) => x.enSuffix || x.deSuffix);
});

const auditCopyRows = ref<CopyTableRow[]>([]);

type AppliedCommonSuffixSnapshot = {
	titleEnBefore: string;
	titleDeBefore: string;
	appliedSuffixEn: string;
	appliedSuffixDe: string;
};
const appliedCommonSuffixByKey = ref<Record<string, AppliedCommonSuffixSnapshot>>({});
const appliedCommonSuffixRowKeys = computed(() => Object.keys(appliedCommonSuffixByKey.value));

function clearAppliedCommonSuffixState() {
	appliedCommonSuffixByKey.value = {};
}
const copyZhTranslations = ref<Record<string, string>>({});
const copyZhTranslateActive = ref(false);
const translatingCopyToZh = ref(false);
const COPY_ZH_RETRANSLATE_DEBOUNCE_MS = 600;
const copyZhRetranslateTimers = new Map<string, ReturnType<typeof setTimeout>>();
const copyZhRetranslateSeq = new Map<string, number>();

type CopyLangKey = (typeof copyTableColumns)[number]["key"];

/** 审核层：母版标题本身上限 200（不含变体后缀；拼接总长在工作台再校验） */
const COPY_CHAR_LIMIT_BULLET = 500;
const COPY_CHAR_LIMIT_DESCRIPTION = 2000;
const COPY_TITLE_AMAZON_MAX = LISTING_TITLE_AMAZON_MAX;

function copyFieldCharCount(text: unknown): number {
	return String(text ?? "").length;
}

function copyCharBadgeLabel(row: CopyTableRow, lang: CopyLangKey): string {
	const n = copyFieldCharCount((row as any)[lang]);
	if (row.rowType === "variant_option") {
		return String(n);
	}
	if (row.fieldLabel === "标题") {
		return `${n} / ${COPY_TITLE_AMAZON_MAX}`;
	}
	if (row.fieldLabel.startsWith("卖点")) {
		return `${n} / ${COPY_CHAR_LIMIT_BULLET}`;
	}
	if (row.fieldLabel === "描述") {
		return `${n} / ${COPY_CHAR_LIMIT_DESCRIPTION}`;
	}
	return String(n);
}

function copyCharLimitForRow(row: CopyTableRow, lang: CopyLangKey): number {
	if (row.fieldLabel === "标题") return COPY_TITLE_AMAZON_MAX;
	if (row.fieldLabel.startsWith("卖点")) return COPY_CHAR_LIMIT_BULLET;
	if (row.fieldLabel === "描述") return COPY_CHAR_LIMIT_DESCRIPTION;
	return Number.POSITIVE_INFINITY;
}

function copyCharBadgeOver(row: CopyTableRow, lang: CopyLangKey): boolean {
	if (row.rowType === "variant_option") return false;
	const n = copyFieldCharCount((row as any)[lang]);
	return n > copyCharLimitForRow(row, lang);
}

type CopyCharLimitViolation = {
	fieldLabel: string;
	langLabel: string;
	count: number;
	limit: number;
};

function collectCopyCharLimitViolations(): CopyCharLimitViolation[] {
	const violations: CopyCharLimitViolation[] = [];
	const langLabel = (lang: CopyLangKey) => (lang === "en" ? "英语" : "德语");
	const rows = auditCopyRows.value || [];

	for (const row of rows) {
		if (row.rowType === "variant_option") continue;
		for (const col of copyTableColumns) {
			if (!copyCharBadgeOver(row, col.key)) continue;
			violations.push({
				fieldLabel: row.fieldLabel,
				langLabel: langLabel(col.key),
				count: copyFieldCharCount((row as any)[col.key]),
				limit: copyCharLimitForRow(row, col.key)
			});
		}
	}

	return violations;
}

function copyZhTranslationKey(row: CopyTableRow, lang: CopyLangKey) {
	return `${String(row.fieldLabel || "")}::${lang}`;
}

function getCopyZhTranslation(row: CopyTableRow, lang: CopyLangKey) {
	return String(copyZhTranslations.value[copyZhTranslationKey(row, lang)] || "").trim();
}

function clearCopyZhRetranslateTimers() {
	for (const timer of copyZhRetranslateTimers.values()) clearTimeout(timer);
	copyZhRetranslateTimers.clear();
	copyZhRetranslateSeq.clear();
}

function clearCopyZhTranslations() {
	copyZhTranslations.value = {};
	copyZhTranslateActive.value = false;
	clearCopyZhRetranslateTimers();
}

async function fetchCopyZhTranslationMap(
	items: Array<{ key: string; text: string; from: string }>
): Promise<Record<string, string>> {
	if (!items.length) return {};
	const api = (service as any).app?.ai_listing_task;
	if (!api?.request) throw new Error("翻译接口不可用");
	const res = await api.request({
		url: "/translateToZhBatch",
		method: "POST",
		data: { items }
	});
	const raw = res?.data ?? res;
	const payload = raw?.data !== undefined ? raw.data : raw;
	return ((payload?.map || {}) as Record<string, string>) || {};
}

function removeCopyZhTranslationKey(key: string) {
	if (!(key in copyZhTranslations.value)) return;
	const next = { ...copyZhTranslations.value };
	delete next[key];
	copyZhTranslations.value = next;
}

async function retranslateCopyCell(row: CopyTableRow, lang: CopyLangKey) {
	const key = copyZhTranslationKey(row, lang);
	const text = String((row as any)[lang] || "").trim();
	if (!text || text === "-") {
		removeCopyZhTranslationKey(key);
		return;
	}
	const seq = (copyZhRetranslateSeq.get(key) || 0) + 1;
	copyZhRetranslateSeq.set(key, seq);
	try {
		const map = await fetchCopyZhTranslationMap([
			{ key, text, from: lang === "de" ? "de" : "en" }
		]);
		if (copyZhRetranslateSeq.get(key) !== seq) return;
		copyZhTranslations.value = { ...copyZhTranslations.value, ...map };
	} catch {
		if (copyZhRetranslateSeq.get(key) !== seq) return;
		// 静默失败，避免编辑时频繁弹错；批量翻译仍会提示
	}
}

function scheduleCopyCellRetranslate(row: CopyTableRow, lang: CopyLangKey) {
	if (!copyZhTranslateActive.value) return;
	const cacheKey = copyZhTranslationKey(row, lang);
	const prev = copyZhRetranslateTimers.get(cacheKey);
	if (prev) clearTimeout(prev);
	copyZhRetranslateTimers.set(
		cacheKey,
		setTimeout(() => {
			copyZhRetranslateTimers.delete(cacheKey);
			void retranslateCopyCell(row, lang);
		}, COPY_ZH_RETRANSLATE_DEBOUNCE_MS)
	);
}

function onAuditCopyCellInput(row: CopyTableRow, lang: CopyLangKey) {
	scheduleCopyCellRetranslate(row, lang);
}

function capitalizeAllBulletBodiesAfterSubtitle() {
	const rows = auditCopyRows.value || [];
	let changed = 0;
	for (const row of rows) {
		if (!isBulletCopyFieldLabel(row.fieldLabel)) continue;
		for (const lang of copyTableColumns) {
			const prev = String(row[lang.key] || "");
			if (!prev.trim() || prev === "-") continue;
			const next = capitalizeBulletBodyAfterSubtitle(prev);
			if (next === prev) continue;
			row[lang.key] = next;
			scheduleCopyCellRetranslate(row, lang.key);
			changed++;
		}
	}
	if (!changed) {
		ElMessage.info("无需调整：卖点行无【副标题】或其后首字母已为大写");
		return;
	}
	ElMessage.success(`已将 ${changed} 处卖点正文首字母大写`);
}

async function translateAllCopyToZh(options?: { silent?: boolean }) {
	const silent = Boolean(options?.silent);
	const rows = auditCopyRows.value || [];
	const items: Array<{ key: string; text: string; from: string }> = [];
	for (const row of rows) {
		for (const lang of copyTableColumns) {
			const text = String(row[lang.key] || "").trim();
			if (!text || text === "-") continue;
			items.push({
				key: copyZhTranslationKey(row, lang.key),
				text,
				from: lang.key === "de" ? "de" : "en"
			});
		}
	}
	if (!items.length) {
		if (!silent) ElMessage.warning("当前无可翻译文案");
		return;
	}
	const api = (service as any).app?.ai_listing_task;
	if (!api?.request) {
		if (!silent) ElMessage.error("翻译接口不可用");
		return;
	}
	translatingCopyToZh.value = true;
	try {
		const map = await fetchCopyZhTranslationMap(items);
		copyZhTranslations.value = { ...map };
		const hit = Object.values(map).filter((x) => String(x || "").trim()).length;
		if (!hit) {
			if (!silent) ElMessage.warning("未获得翻译结果");
			return;
		}
		copyZhTranslateActive.value = true;
		if (!silent) ElMessage.success(`已翻译 ${hit} 处文案`);
	} catch (err: any) {
		const msg =
			err?.response?.data?.message ?? err?.response?.data?.msg ?? err?.message ?? "翻译失败";
		if (!silent) ElMessage.error(typeof msg === "string" ? msg : "翻译失败");
	} finally {
		translatingCopyToZh.value = false;
	}
}

async function resetAuditDraft() {
	const taskId = currentDetailTaskId();
	if (!taskId) return;
	resettingReviewDraft.value = true;
	try {
		clearReviewDraftCache(taskId);
		await loadRunDetail();
		ElMessage.success("已从数据库恢复最新内容");
	} catch (err: any) {
		ElMessage.error(err?.message || "重置失败");
	} finally {
		resettingReviewDraft.value = false;
	}
}

function dedupeBannedWordsForDetection(
	list: Array<{ word: string; reason: string; submitter?: string }>
) {
	const map = new Map<string, { word: string; reason: string }>();
	for (const item of list) {
		const word = String(item?.word || "").trim();
		if (!word) continue;
		const key = word.toLowerCase();
		if (map.has(key)) continue;
		let reason = String(item?.reason || "").trim();
		if (!reason && item.submitter) {
			reason = `${item.submitter}的违禁词`;
		}
		map.set(key, { word, reason: reason || "违禁词库" });
	}
	return Array.from(map.values());
}

async function loadUserBannedWordsCatalog() {
	try {
		const { list } = await fetchListingBannedWords();
		userBannedWordsCatalog.value = dedupeBannedWordsForDetection(list);
	} catch {
		userBannedWordsCatalog.value = [];
	}
}

async function onUserBannedWordsSaved() {
	await loadUserBannedWordsCatalog();
	if (keywordDetectionEnabled.value) syncWarningWordsWithBannedDetection();
}

function findAuditTitleRow() {
	return (auditCopyRows.value || []).find(
		(r) => r.fieldLabel === "标题" && r.rowType !== "variant_option"
	);
}

function onApplyCommonSuffixToTitle(payload: CommonSuffixApplyPayload) {
	if (!run.value?.copy) {
		ElMessage.warning("当前无可编辑文案");
		return;
	}
	const rowKey = String(payload?.rowKey || "").trim();
	if (!rowKey) return;
	if (appliedCommonSuffixByKey.value[rowKey]) {
		ElMessage.info("该条已添加，请先「取消添加」");
		return;
	}
	const titleRow = findAuditTitleRow();
	if (!titleRow) {
		ElMessage.warning("未找到标题行");
		return;
	}
	const suffixEn = String(payload?.suffixEn || "").trim();
	const suffixDe = String(payload?.suffixDe || "").trim();
	if (!suffixEn && !suffixDe) {
		ElMessage.warning("该条后缀为空");
		return;
	}
	const snapshot: AppliedCommonSuffixSnapshot = {
		titleEnBefore: String(titleRow.en || ""),
		titleDeBefore: String(titleRow.de || ""),
		appliedSuffixEn: suffixEn,
		appliedSuffixDe: suffixDe
	};
	const parts: string[] = [];
	if (suffixEn) {
		const prev = String(titleRow.en || "").trim();
		const next = appendCommaTitleSuffix(prev, suffixEn);
		if (next !== prev) {
			titleRow.en = next;
			scheduleCopyCellRetranslate(titleRow, "en");
			parts.push("英文标题");
		}
	}
	if (suffixDe) {
		const prev = String(titleRow.de || "").trim();
		const next = appendCommaTitleSuffix(prev, suffixDe);
		if (next !== prev) {
			titleRow.de = next;
			scheduleCopyCellRetranslate(titleRow, "de");
			parts.push("德文标题");
		}
	}
	if (!parts.length) {
		ElMessage.info("标题已包含该后缀");
		return;
	}
	appliedCommonSuffixByKey.value = {
		...appliedCommonSuffixByKey.value,
		[rowKey]: snapshot
	};
	const scene = String(payload?.useScene || "").trim();
	ElMessage.success(
		scene ? `已将「${scene}」后缀追加到${parts.join("、")}` : `已追加到${parts.join("、")}`
	);
	if (keywordDetectionEnabled.value) syncWarningWordsWithBannedDetection();
}

function onRevertCommonSuffixFromTitle(payload: CommonSuffixRevertPayload) {
	const rowKey = String(payload?.rowKey || "").trim();
	const snap = appliedCommonSuffixByKey.value[rowKey];
	if (!snap) {
		ElMessage.info("该条未添加或已取消");
		return;
	}
	const titleRow = findAuditTitleRow();
	if (!titleRow) {
		ElMessage.warning("未找到标题行");
		return;
	}
	titleRow.en = snap.titleEnBefore;
	titleRow.de = snap.titleDeBefore;
	scheduleCopyCellRetranslate(titleRow, "en");
	scheduleCopyCellRetranslate(titleRow, "de");
	const next = { ...appliedCommonSuffixByKey.value };
	delete next[rowKey];
	appliedCommonSuffixByKey.value = next;
	ElMessage.success("已取消添加，标题已恢复");
	if (keywordDetectionEnabled.value) syncWarningWordsWithBannedDetection();
}

function getBaseAiWarningWords(locale: LocaleKey) {
	const block = (run.value as any)?.params?.keywordsByLocale?.[locale] || {};
	if (Array.isArray(block.aiWarningWords)) return block.aiWarningWords;
	if (Array.isArray(block.warningWords)) {
		block.aiWarningWords = block.warningWords.filter(
			(x: any) => String(x?.type || "") !== "违禁词"
		);
		return block.aiWarningWords;
	}
	block.aiWarningWords = [];
	return block.aiWarningWords;
}

function collectIgnoredWarningMap(locale: LocaleKey) {
	const map = new Map<string, boolean>();
	const warningWords = Array.isArray(
		(run.value as any)?.params?.keywordsByLocale?.[locale]?.warningWords
	)
		? (run.value as any).params.keywordsByLocale[locale].warningWords
		: [];
	for (const row of warningWords) {
		if (!row?.ignored) continue;
		const word = String(row?.word || "").trim();
		const type = String(row?.type || "").trim();
		if (!word || !type) continue;
		map.set(warningWordIgnoreKey(type, word), true);
	}
	return map;
}

function syncWarningWordsWithBannedDetection() {
	const r = run.value as any;
	if (!r?.params?.keywordsByLocale) return;
	for (const locale of ["en", "de"] as LocaleKey[]) {
		const block = r.params.keywordsByLocale[locale];
		const base = getBaseAiWarningWords(locale);
		const text = getAuditCopyTextByLocale(locale);
		const ignoredMap = collectIgnoredWarningMap(locale);
		const bannedRows = userBannedWordsCatalog.value
			.filter((item) => {
				const word = String(item?.word || "").trim();
				return word && phraseAppearsInText(text, word);
			})
			.map((item) => {
				const word = String(item.word || "").trim();
				return {
					word,
					type: "违禁词" as const,
					reason: String(item.reason || "").trim() || "违禁词库",
					ignored: ignoredMap.get(warningWordIgnoreKey("违禁词", word)) || false
				};
			});
		block.warningWords = [
			...bannedRows,
			...base.map((row: any) => {
				const key = warningWordIgnoreKey(String(row?.type || ""), String(row?.word || ""));
				return {
					...row,
					ignored: ignoredMap.has(key)
				};
			})
		];
	}
}

function runKeywordDetection() {
	keywordDetectionEnabled.value = true;
	keywordTableRenderKey.value += 1;
	syncWarningWordsWithBannedDetection();
	ElMessage.success("关键词检测已开启");
}

type KeywordTransSegment = "phrase" | "sys" | "warn" | "word";

function keywordTransKey(locale: LocaleKey, segment: KeywordTransSegment, index: number) {
	return `${locale}-${segment}-${index}`;
}

function getKeywordZhText(locale: LocaleKey, segment: KeywordTransSegment, index: number) {
	return String(
		keywordZhTranslations.value[keywordTransKey(locale, segment, index)] || ""
	).trim();
}

function getSourceKeywordZhText(locale: LocaleKey, keywordPhrase: string) {
	const phrase = String(keywordPhrase || "").trim();
	if (!phrase) return "";
	const systemKeywords = run.value?.params?.keywordsByLocale?.[locale]?.systemKeywords || [];
	const idx = systemKeywords.findIndex(
		(row) => String(row?.keyword || "").trim().toLowerCase() === phrase.toLowerCase()
	);
	if (idx < 0) return "";
	return getKeywordZhText(locale, "sys", idx);
}

function keywordZhDisplayInline(sourceText: string) {
	const t = String(sourceText || "").trim();
	if (!t) return true;
	return t.length <= KEYWORD_ZH_INLINE_MAX;
}

async function translateAllKeywordTextsToZh(options?: { silent?: boolean }) {
	const silent = Boolean(options?.silent);
	const r = run.value as any;
	const kw = r?.params?.keywordsByLocale;
	if (!kw) {
		if (!silent) ElMessage.warning("暂无关键词数据");
		return;
	}
	const items: Array<{ key: string; text: string; from: string }> = [];

	function pushRows(
		rows: any[] | undefined,
		field: string,
		locale: LocaleKey,
		segment: KeywordTransSegment
	) {
		(rows || []).forEach((row, idx) => {
			const text = String(row?.[field] ?? "").trim();
			if (!text || text === "-") return;
			items.push({
				key: keywordTransKey(locale, segment, idx),
				text,
				from: locale === "de" ? "de" : "en"
			});
		});
	}

	pushRows(kw.en?.aiSplitTokens, "token", "en", "phrase");
	pushRows(kw.de?.aiSplitTokens, "token", "de", "phrase");
	pushRows(kw.en?.systemKeywords, "keyword", "en", "sys");
	pushRows(kw.de?.systemKeywords, "keyword", "de", "sys");
	pushRows(keywordWordAggregateEn.value, "word", "en", "word");
	pushRows(keywordWordAggregateDe.value, "word", "de", "word");
	pushRows(kw.en?.warningWords, "word", "en", "warn");
	pushRows(kw.de?.warningWords, "word", "de", "warn");

	if (!items.length) {
		if (!silent) ElMessage.warning("当前无可翻译关键词");
		return;
	}
	const api = (service as any).app?.ai_listing_task;
	if (!api?.request) {
		if (!silent) ElMessage.error("翻译接口不可用");
		return;
	}
	translatingKeywordsToZh.value = true;
	try {
		const res = await api.request({
			url: "/translateToZhBatch",
			method: "POST",
			data: { items }
		});
		const raw = res?.data ?? res;
		const payload = raw?.data !== undefined ? raw.data : raw;
		const map = (payload?.map || {}) as Record<string, string>;
		keywordZhTranslations.value = { ...keywordZhTranslations.value, ...map };
		const hit = Object.keys(map).filter((k) => String(map[k] || "").trim()).length;
		if (!hit) {
			if (!silent) ElMessage.warning("未获得翻译结果");
			return;
		}
		if (!silent) ElMessage.success(`已翻译 ${hit} 处关键词`);
	} catch (err: any) {
		const msg =
			err?.response?.data?.message ?? err?.response?.data?.msg ?? err?.message ?? "翻译失败";
		if (!silent) ElMessage.error(typeof msg === "string" ? msg : "翻译失败");
	} finally {
		translatingKeywordsToZh.value = false;
	}
}

async function autoTranslateDetailContent(seq: number) {
	await nextTick();
	if (seq !== loadDetailSeq || !run.value) return;
	await Promise.all([
		translateAllCopyToZh({ silent: true }),
		translateAllKeywordTextsToZh({ silent: true })
	]);
}

function buildReviewCopyPayload() {
	const rows = auditCopyRows.value || [];
	const titleRow = rows.find((r) => r.fieldLabel === "标题");
	const descRow = rows.find((r) => r.fieldLabel === "描述");
	const bulletRows = rows
		.filter((r) => r.fieldLabel.startsWith("卖点 "))
		.sort((a, b) => {
			const ai = Number(a.fieldLabel.replace(/\D/g, "")) || 0;
			const bi = Number(b.fieldLabel.replace(/\D/g, "")) || 0;
			return ai - bi;
		});
	const variantRows = rows.filter((r) => r.rowType === "variant_option");
	const variantIds = variantTitleSuffixRows.value.map((x) => x.variantId);
	const enVariantSuffixes: Record<string, string> = {};
	const deVariantSuffixes: Record<string, string> = {};
	variantRows.forEach((row, idx) => {
		const id = variantIds[idx];
		if (!id) return;
		enVariantSuffixes[id] = String(row.en || "");
		deVariantSuffixes[id] = String(row.de || "");
	});
	return {
		en: {
			title: String(titleRow?.en || "").trim(),
			bullets: bulletRows.map((r) => String(r.en || "")),
			description: String(descRow?.en || "").trim(),
			variantSuffixes: enVariantSuffixes
		},
		de: {
			title: String(titleRow?.de || "").trim(),
			bullets: bulletRows.map((r) => String(r.de || "")),
			description: String(descRow?.de || "").trim(),
			variantSuffixes: deVariantSuffixes
		}
	};
}

function collectVariantSuffixRoundTripViolations(): string[] {
	const payload = buildReviewCopyPayload();
	const variantRows = (auditCopyRows.value || []).filter((r) => r.rowType === "variant_option");
	const variantIds = variantTitleSuffixRows.value.map((x) => x.variantId);
	const hits: string[] = [];
	const check = (
		lang: "en" | "de",
		langLabel: string,
		baseTitle: string,
		suffixes: Record<string, string>
	) => {
		variantRows.forEach((row, idx) => {
			const id = variantIds[idx];
			if (!id) return;
			const suffix = String(suffixes[id] ?? "").trim();
			if (!suffix || suffix === "-") return;
			try {
				assertVariantTitleSuffixRoundTrip(
					baseTitle,
					suffix,
					langLabel,
					String(row.variantTitle || id)
				);
			} catch (err: any) {
				hits.push(String(err?.message || `${langLabel}变体选项无法保存`));
			}
		});
	};
	check("en", "英语", payload.en.title, payload.en.variantSuffixes);
	check("de", "德语", payload.de.title, payload.de.variantSuffixes);
	return hits;
}

function warningWordIgnoreKey(type: string, word: string) {
	return `${String(type || "").trim()}::${String(word || "").trim()}`;
}

function applyWarningWordIgnores<T extends { word: string; type: string; ignored?: boolean }>(
	rows: T[],
	ignoreMap?: Record<string, boolean> | null
): T[] {
	if (!ignoreMap || typeof ignoreMap !== "object") return rows;
	return rows.map((row) => ({
		...row,
		ignored: Boolean(ignoreMap[warningWordIgnoreKey(row.type, row.word)])
	}));
}

function buildWarningWordIgnoresPayload(): {
	en: Record<string, boolean>;
	de: Record<string, boolean>;
} {
	const payload: { en: Record<string, boolean>; de: Record<string, boolean> } = {
		en: {},
		de: {}
	};
	for (const locale of ["en", "de"] as LocaleKey[]) {
		const warningWords = Array.isArray(
			(run.value as any)?.params?.keywordsByLocale?.[locale]?.warningWords
		)
			? (run.value as any).params.keywordsByLocale[locale].warningWords
			: [];
		for (const row of warningWords) {
			if (!row?.ignored || !isIgnorableWarningWord(row)) continue;
			const word = String(row?.word || "").trim();
			const type = String(row?.type || "").trim();
			if (!word || !type) continue;
			payload[locale][warningWordIgnoreKey(type, word)] = true;
		}
	}
	return payload;
}

function extractServerWarningIgnoresFromTask(task: any): {
	en: Record<string, boolean>;
	de: Record<string, boolean>;
} {
	const raw = (task?.flow_context?.review_warning_word_ignores || {}) as Record<
		string,
		Record<string, boolean>
	>;
	const out: { en: Record<string, boolean>; de: Record<string, boolean> } = { en: {}, de: {} };
	for (const locale of ["en", "de"] as LocaleKey[]) {
		const block = raw[locale] || {};
		for (const [key, val] of Object.entries(block)) {
			if (val) out[locale][key] = true;
		}
	}
	return out;
}

function stableWarningIgnoresJson(payload: {
	en: Record<string, boolean>;
	de: Record<string, boolean>;
}) {
	const norm = (block: Record<string, boolean>) =>
		Object.keys(block)
			.filter((k) => block[k])
			.sort();
	return JSON.stringify({ en: norm(payload.en), de: norm(payload.de) });
}

function normalizeCopyRowsForCompare(rows: CopyTableRow[]) {
	return JSON.stringify(
		(rows || []).map((r) => ({
			fieldLabel: r.fieldLabel,
			rowType: r.rowType || "normal",
			variantTitle: r.variantTitle || "",
			en: String(r.en || ""),
			de: String(r.de || "")
		}))
	);
}

function applyWarningWordIgnoresToRun(payload: {
	en: Record<string, boolean>;
	de: Record<string, boolean>;
}) {
	const r = run.value as any;
	if (!r?.params?.keywordsByLocale) return;
	for (const locale of ["en", "de"] as LocaleKey[]) {
		const rows = r.params.keywordsByLocale[locale]?.warningWords;
		if (!Array.isArray(rows)) continue;
		for (const row of rows) {
			if (!isIgnorableWarningWord(row)) continue;
			row.ignored = Boolean(
				payload[locale]?.[
					warningWordIgnoreKey(String(row.type || ""), String(row.word || ""))
				]
			);
		}
	}
}

function restoreServerWarningIgnoresBaseline() {
	applyWarningWordIgnoresToRun(serverWarningIgnoresBaseline.value);
}

function currentDetailTaskId() {
	return Number(run.value?.id || props.taskId || route.query.id || 0);
}

function persistReviewDraftCacheForTask(taskId: number) {
	if (!taskId) return;
	if (!hasUnsavedReviewDraft.value) {
		clearReviewDraftCache(taskId);
		return;
	}
	const payload: ReviewDraftCachePayload = {
		savedAt: Date.now(),
		auditCopyRows: (auditCopyRows.value || []).map((x) => ({ ...x })),
		warningWordIgnores: buildWarningWordIgnoresPayload()
	};
	saveReviewDraftCache(taskId, payload);
}

function persistReviewDraftCacheForCurrentTask() {
	const taskId = loadedDetailTaskId.value || currentDetailTaskId();
	if (taskId) persistReviewDraftCacheForTask(taskId);
}

function clearReviewDraftForCurrentTask() {
	const taskId = currentDetailTaskId();
	if (taskId) clearReviewDraftCache(taskId);
}

async function restoreReviewDraftFromCache(taskId: number) {
	const cached = loadReviewDraftCache(taskId);
	if (!cached?.auditCopyRows?.length) return;
	suppressAuditSyncFromServer = true;
	auditCopyRows.value = cached.auditCopyRows.map((x) => ({ ...x })) as CopyTableRow[];
	applyWarningWordIgnoresToRun(cached.warningWordIgnores || { en: {}, de: {} });
	clearCopyZhTranslations();
	clearAppliedCommonSuffixState();
	await nextTick();
	suppressAuditSyncFromServer = false;
}

const hasUnsavedReviewDraft = computed(() => {
	if (!run.value?.copy || detailLoading.value) return false;
	if (!auditCopyRows.value.length || !copyTableRows.value.length) return false;
	const copyDirty =
		normalizeCopyRowsForCompare(auditCopyRows.value) !==
		normalizeCopyRowsForCompare(copyTableRows.value);
	const warnDirty =
		stableWarningIgnoresJson(buildWarningWordIgnoresPayload()) !==
		stableWarningIgnoresJson(serverWarningIgnoresBaseline.value);
	return copyDirty || warnDirty;
});

function isIgnorableWarningWord(row: any) {
	const type = String(row?.type || "").trim();
	return type === "品牌词" || type === "无关词" || type === "违禁词";
}

function isReviewableWarningWord(row: any) {
	return isIgnorableWarningWord(row);
}

function toggleWarningWordIgnored(locale: LocaleKey, row: any) {
	if (!isIgnorableWarningWord(row)) return;
	const word = String(row?.word || "").trim();
	if (!word) return;
	row.ignored = !row.ignored;
	if (row.ignored) {
		ElMessage.success(`${locale === "en" ? "英语" : "德语"}「${word}」已标注忽略`);
	} else {
		ElMessage.info(`${locale === "en" ? "英语" : "德语"}「${word}」已取消忽略`);
	}
}

function collectBlockingWarningHits(): Array<{ locale: LocaleKey; word: string; type: string }> {
	const hits: Array<{ locale: LocaleKey; word: string; type: string }> = [];
	for (const locale of ["en", "de"] as LocaleKey[]) {
		const text = getAuditCopyTextByLocale(locale);
		const warningWords = Array.isArray(
			(run.value as any)?.params?.keywordsByLocale?.[locale]?.warningWords
		)
			? (run.value as any).params.keywordsByLocale[locale].warningWords
			: [];
		for (const row of warningWords) {
			if (!isIgnorableWarningWord(row) || row?.ignored) continue;
			const word = String(row?.word || "").trim();
			const type = String(row?.type || "").trim();
			if (!word) continue;
			if (phraseAppearsInText(text, word)) hits.push({ locale, word, type });
		}
	}
	return hits;
}

/** 保存草稿 / 审核通过共用的请求体（与后端 persistReviewSubmitPayload 对齐） */
function buildReviewSubmitPayload() {
	const r = run.value;
	if (!r) return null;
	return {
		id: Number(r.id),
		copy: buildReviewCopyPayload(),
		warningWordIgnores: buildWarningWordIgnoresPayload()
	};
}

async function persistReviewEditsToServer(method: "saveReviewDraft" | "approve"): Promise<boolean> {
	const payload = buildReviewSubmitPayload();
	if (!payload) return false;
	const api = (service as any).app?.ai_listing_task;
	if (!api) {
		ElMessage.error("AI 文案任务接口不可用");
		return false;
	}
	// 必须通过 api.xxx() 调用，不能 fn = api.xxx; fn()，否则 EPS 封装里 this.request 为 undefined
	if (typeof api[method] === "function") {
		await api[method](payload);
		return true;
	}
	if (typeof api.request === "function") {
		const path = method === "saveReviewDraft" ? "/saveReviewDraft" : "/approve";
		await api.request({ url: path, method: "POST", data: payload });
		return true;
	}
	ElMessage.error(method === "saveReviewDraft" ? "后端保存接口不可用" : "后端审核接口不可用");
	return false;
}

async function saveReviewDraft() {
	if (!canSaveReviewDraft.value) return;
	const charViolations = collectCopyCharLimitViolations();
	if (charViolations.length) {
		const preview = charViolations
			.slice(0, 8)
			.map((v) => `${v.langLabel}·${v.fieldLabel}（${v.count}/${v.limit} 字）`)
			.join("；");
		const suffix = charViolations.length > 8 ? ` 等共 ${charViolations.length} 处` : "";
		ElMessage.error(`以下文案超出字数上限，请缩减后重试：${preview}${suffix}`);
		return;
	}
	const suffixViolations = collectVariantSuffixRoundTripViolations();
	if (suffixViolations.length) {
		ElMessage.error(suffixViolations[0]);
		return;
	}
	savingReviewDraft.value = true;
	try {
		const ok = await persistReviewEditsToServer("saveReviewDraft");
		if (!ok) return;
		clearReviewDraftForCurrentTask();
		ElMessage.success("已保存草稿");
		await loadRunDetail();
		if (embedded.value) emit("refreshed");
	} catch (err: any) {
		ElMessage.error(err?.message || "保存失败");
	} finally {
		savingReviewDraft.value = false;
	}
}

async function approveReview() {
	if (!run.value) return;
	const charViolations = collectCopyCharLimitViolations();
	if (charViolations.length) {
		const preview = charViolations
			.slice(0, 8)
			.map((v) => `${v.langLabel}·${v.fieldLabel}（${v.count}/${v.limit} 字）`)
			.join("；");
		const suffix = charViolations.length > 8 ? ` 等共 ${charViolations.length} 处` : "";
		ElMessage.error(`以下文案超出字数上限，请缩减后重试：${preview}${suffix}`);
		return;
	}
	const suffixViolations = collectVariantSuffixRoundTripViolations();
	if (suffixViolations.length) {
		ElMessage.error(suffixViolations[0]);
		return;
	}
	const blockingHits = collectBlockingWarningHits();
	if (blockingHits.length) {
		const localeLabel = (locale: LocaleKey) => (locale === "en" ? "英语" : "德语");
		const preview = blockingHits
			.slice(0, 6)
			.map((h) => `${localeLabel(h.locale)}「${h.word}」(${h.type})`)
			.join("、");
		const suffix = blockingHits.length > 6 ? ` 等 ${blockingHits.length} 处` : "";
		ElMessage.error(
			`文案中仍含未忽略的品牌词或无关词，请先修改文案或标注忽略：${preview}${suffix}`
		);
		return;
	}
	try {
		const ok = await persistReviewEditsToServer("approve");
		if (!ok) return;
		clearReviewDraftForCurrentTask();
		ElMessage.success("已保存修改并审核通过");
		if (embedded.value) {
			emit("approved");
			emit("refreshed");
			emit("close");
		} else {
			goList();
		}
	} catch (err: any) {
		ElMessage.error(err?.message || "审核失败");
	}
}

async function triggerDeCopy() {
	const r = run.value;
	if (!r) return;
	const api = (service as any).app?.ai_listing_task;
	if (!api?.triggerDe && !(service as any).request) {
		ElMessage.error("后端 triggerDe 接口不可用");
		return;
	}
	try {
		await ElMessageBox.confirm(
			`将为任务 #${r.id} 补触发德国文案（不覆盖已有英文结果），确认继续？`,
			"触发德国文案",
			{ type: "warning", confirmButtonText: "确认", cancelButtonText: "取消" }
		);
	} catch {
		return;
	}
	triggeringDe.value = true;
	try {
		const res = await api.triggerDe({ id: Number(r.id) });
		const data = res?.data ?? res;
		if (data?.skipped) {
			ElMessage.info("德文文案已存在或正在生成");
		} else {
			ElMessage.success(`已触发德国文案任务 ${data?.taskId || r.id}`);
		}
		await loadRunDetail();
		emit("refreshed");
	} catch (err: any) {
		ElMessage.error(err?.message || "触发德国文案失败");
	} finally {
		triggeringDe.value = false;
	}
}

async function terminateTask() {
	const r = run.value;
	if (!r) return;
	const api = (service as any).app?.ai_listing_task;
	if (!api?.cancel) {
		ElMessage.error("后端终止接口不可用");
		return;
	}
	try {
		await ElMessageBox.confirm("确认终止该 AI 文案任务？", "终止确认", {
			type: "warning",
			confirmButtonText: "确认终止",
			cancelButtonText: "取消"
		});
		terminatingTask.value = true;
		await api.cancel({ id: Number(r.id) });
		ElMessage.success("任务已终止");
		await loadRunDetail();
	} catch (err: any) {
		if (err === "cancel") return;
		ElMessage.error(err?.message || "终止任务失败");
	} finally {
		terminatingTask.value = false;
	}
}

function cancelReviewEdit() {
	clearReviewDraftForCurrentTask();
	suppressAuditSyncFromServer = true;
	auditCopyRows.value = copyTableRows.value.map((x) => ({ ...x }));
	restoreServerWarningIgnoresBaseline();
	clearCopyZhTranslations();
	clearAppliedCommonSuffixState();
	suppressAuditSyncFromServer = false;
	ElMessage.info("已取消本次编辑");
}

function escapeHtml(input: string) {
	return String(input || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function getLocaleKeywordLexicon(locale: LocaleKey) {
	const block = (run.value as any)?.params?.keywordsByLocale?.[locale] || {};
	const titleWords = block?.selectedTitleWords || {};
	const mainWords = Array.isArray(titleWords?.mainWords)
		? titleWords.mainWords.map((x: any) => String(x || "").trim()).filter(Boolean)
		: [];
	const coreWords = Array.isArray(titleWords?.coreWords)
		? titleWords.coreWords.map((x: any) => String(x || "").trim()).filter(Boolean)
		: [];
	const coreTerms = Array.from(new Set([...mainWords, ...coreWords]));
	const longTailTerms = Array.isArray(titleWords?.longTailPhrases)
		? titleWords.longTailPhrases.map((x: any) => String(x?.word || "").trim()).filter(Boolean)
		: [];
	const splitTokenTerms = Array.isArray(block?.aiSplitTokens)
		? block.aiSplitTokens.map((x: any) => String(x?.token || "").trim()).filter(Boolean)
		: [];
	const otherTerms = Array.from(
		new Set([...longTailTerms, ...splitTokenTerms].filter((x) => !coreTerms.includes(x)))
	);
	return { coreTerms, otherTerms };
}

function getLocaleWarningLexicon(locale: LocaleKey) {
	const block = (run.value as any)?.params?.keywordsByLocale?.[locale] || {};
	const warningWords = Array.isArray(block?.warningWords) ? block.warningWords : [];
	const activeWarningWords = warningWords.filter((x: any) => !x?.ignored);
	const potentialRiskTerms: string[] = activeWarningWords
		.filter((x: any) => String(x?.type || "").trim() === "潜在风险词")
		.map((x: any) => String(x?.word || "").trim())
		.filter((x: string) => Boolean(x));
	const potentialRiskSet = new Set<string>(potentialRiskTerms);
	const brandTerms: string[] = activeWarningWords
		.filter((x: any) => String(x?.type || "") === "品牌词")
		.map((x: any) => String(x?.word || "").trim())
		.filter((x: string) => Boolean(x));
	const irrelevantTerms: string[] = activeWarningWords
		.filter((x: any) => String(x?.type || "") === "无关词")
		.map((x: any) => String(x?.word || "").trim())
		.filter((x: string) => Boolean(x) && !potentialRiskSet.has(x));
	const bannedTerms: string[] = activeWarningWords
		.filter((x: any) => String(x?.type || "") === "违禁词")
		.map((x: any) => String(x?.word || "").trim())
		.filter((x: string) => Boolean(x));
	return {
		bannedTerms: Array.from(new Set<string>(bannedTerms)),
		brandTerms: Array.from(new Set<string>(brandTerms)),
		irrelevantTerms: Array.from(new Set<string>(irrelevantTerms))
	};
}

function collectMatches(
	text: string,
	terms: string[],
	type: "core" | "other" | "brand" | "irrelevant" | "banned"
): Array<{
	start: number;
	end: number;
	text: string;
	type: "core" | "other" | "brand" | "irrelevant" | "banned";
	term: string;
}> {
	return collectFlexiblePhraseMatches(text, terms).map((m) => ({
		...m,
		type
	}));
}

function getAuditCopyTextByLocale(locale: LocaleKey): string {
	return (auditCopyRows.value || []).map((row: any) => String(row?.[locale] || "")).join("\n");
}

function renderCopyKeywordHighlight(text: string, locale: LocaleKey) {
	const source = String(text || "");
	if (!source) return "";
	const { coreTerms, otherTerms } = getLocaleKeywordLexicon(locale);
	const { bannedTerms, brandTerms, irrelevantTerms } = getLocaleWarningLexicon(locale);
	const matches = pickNonOverlappingKeywordMatches([
		...collectMatches(source, bannedTerms, "banned"),
		...collectMatches(source, brandTerms, "brand"),
		...collectMatches(source, irrelevantTerms, "irrelevant"),
		...collectMatches(source, coreTerms, "core"),
		...collectMatches(source, otherTerms, "other")
	]);
	if (!matches.length) return escapeHtml(source);
	let html = "";
	let pos = 0;
	for (const m of matches) {
		if (m.start > pos) html += escapeHtml(source.slice(pos, m.start));
		const cls =
			m.type === "banned"
				? "kw-hit-banned"
				: m.type === "brand"
					? "kw-hit-brand"
					: m.type === "irrelevant"
						? "kw-hit-irrelevant"
						: m.type === "core"
							? "kw-hit-core"
							: "kw-hit-other";
		html += `<span class="${cls}">${escapeHtml(source.slice(m.start, m.end))}</span>`;
		pos = m.end;
	}
	if (pos < source.length) html += escapeHtml(source.slice(pos));
	return html;
}

function renderCopyKeywordHighlightByKey(text: string, key: string) {
	if (key !== "en" && key !== "de") return escapeHtml(text);
	return renderCopyKeywordHighlight(text, key);
}

function getAuditCopyTitleTextByLocale(locale: LocaleKey): string {
	const titleRow = (auditCopyRows.value || []).find(
		(r) => r.fieldLabel === "标题" && r.rowType !== "variant_option"
	);
	return String((titleRow as any)?.[locale] || "");
}

function getAuditCopyBodyTextByLocale(locale: LocaleKey): string {
	return (auditCopyRows.value || [])
		.filter((r) => !(r.fieldLabel === "标题" && r.rowType !== "variant_option"))
		.map((row: any) => String(row?.[locale] || ""))
		.join("\n");
}

function resolveKeywordRowHitClass(term: string, locale: LocaleKey): string {
	const raw = String(term || "").trim();
	if (!raw) return "";
	const titleText = getAuditCopyTitleTextByLocale(locale);
	const bodyText = getAuditCopyBodyTextByLocale(locale);
	if (titleText.trim() && phraseAppearsInText(titleText, raw)) return "keyword-row-hit-title";
	if (bodyText.trim() && phraseAppearsInText(bodyText, raw)) return "keyword-row-hit-body";
	return "";
}

function keywordRowClassName(row: any, locale: LocaleKey) {
	if (!keywordDetectionEnabled.value) return "";
	const mode = keywordViewMode.value;
	if (mode === "word") {
		return resolveKeywordRowHitClass(String(row?.word || ""), locale);
	}
	return resolveKeywordRowHitClass(String(row?.keyword || row?.token || ""), locale);
}

function keywordRowClassNameEn(payload: any) {
	return keywordRowClassName(payload?.row, "en");
}

function keywordRowClassNameDe(payload: any) {
	return keywordRowClassName(payload?.row, "de");
}

function warningRowClassName(row: any, locale: LocaleKey) {
	if (!keywordDetectionEnabled.value) return "";
	const rawWord = String(row?.word || "").trim();
	const type = String(row?.type || "");
	if (!rawWord) return "";
	if (row?.ignored) return "keyword-row-warning-ignored";
	if (type === "潜在风险词") return "";
	const block = (run.value as any)?.params?.keywordsByLocale?.[locale] || {};
	const warningWords = Array.isArray(block?.warningWords) ? block.warningWords : [];
	const isPotentialRiskWord = warningWords.some(
		(x: any) =>
			String(x?.type || "").trim() === "潜在风险词" &&
			String(x?.word || "").trim() === rawWord
	);
	if (isPotentialRiskWord) return "";
	const text = getAuditCopyTextByLocale(locale);
	if (type === "违禁词") {
		return phraseAppearsInText(text, rawWord) ? "keyword-row-warning-banned" : "";
	}
	if (type === "品牌词") {
		return phraseAppearsInText(text, rawWord) ? "keyword-row-warning-brand" : "";
	}
	if (type === "无关词") {
		return phraseAppearsInText(text, rawWord) ? "keyword-row-warning-irrelevant" : "";
	}
	return "";
}

function warningRowClassNameEn(payload: any) {
	return warningRowClassName(payload?.row, "en");
}

function warningRowClassNameDe(payload: any) {
	return warningRowClassName(payload?.row, "de");
}

function encodeAmazonSearchKeyword(keyword: string): string {
	return encodeURIComponent(String(keyword || "").trim()).replace(/%20/g, "+");
}

function amazonKeywordSearchHref(keyword: string, locale: LocaleKey): string {
	const text = String(keyword || "").trim();
	if (!text) return "javascript:void(0)";
	const marketplace =
		locale === "de" ? "DE" : String(run.value?.marketplace || "UK").trim() || "UK";
	return appConfig.get_amazon_url_keyword_search(encodeAmazonSearchKeyword(text), marketplace);
}

async function copyKeyword(text: string) {
	const t = (text || "").trim();
	if (!t) return;
	try {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(t);
			ElMessage.success("已复制到剪贴板");
			return;
		}
		throw new Error("Clipboard API 不可用或非安全上下文");
	} catch (clipboardError) {
		console.warn("[copyKeyword] Clipboard API failed:", clipboardError);
		try {
			const textarea = document.createElement("textarea");
			textarea.value = t;
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			textarea.style.left = "-9999px";
			document.body.appendChild(textarea);
			textarea.focus();
			textarea.select();
			textarea.setSelectionRange(0, t.length);
			const ok = document.execCommand("copy");
			document.body.removeChild(textarea);
			if (!ok) throw new Error("execCommand copy returned false");
			ElMessage.success("已复制到剪贴板");
		} catch (fallbackError) {
			console.error("[copyKeyword] Fallback copy failed:", fallbackError);
			ElMessage.warning("复制失败，请手动选择复制");
		}
	}
}

function sortKeywordParentSearchVolume(a: any, b: any) {
	return (
		Number(a?.parentSearchVolume || a?.monthlySearch || 0) -
		Number(b?.parentSearchVolume || b?.monthlySearch || 0)
	);
}

function sortKeywordSimilarityTotal(a: any, b: any) {
	return (
		Number(a?.similarityTotal || a?.compositeScore || 0) -
		Number(b?.similarityTotal || b?.compositeScore || 0)
	);
}

function sortKeywordTotalParentSearchVolume(a: any, b: any) {
	return Number(a?.totalParentSearchVolume || 0) - Number(b?.totalParentSearchVolume || 0);
}

const variantTableRows = computed(() => {
	const variants = designTaskOtherInfo.value.variants || [];
	const purchases = designTaskOtherInfo.value.purchases || [];
	const factoryLinks = designTaskOtherInfo.value.factoryLinks || [];
	if (variants.length) {
		const getFactoryLinkInfo = (id: string): { displayText: string } | null => {
			const factoryLink = factoryLinks.find((link: any) => String(link?.id) === String(id));
			if (!factoryLink) return null;
			const typeMap: Record<string, string> = {
				main: "主体",
				accessory: "配件",
				packing: "包装"
			};
			const typeLabel =
				typeMap[String(factoryLink?.type || "")] || String(factoryLink?.type || "");
			return {
				displayText: `${typeLabel}: ${String(factoryLink?.name || "")}`
			};
		};
		const getSubmitters = (variantId: string): string[] => {
			const related = purchases.filter(
				(p: any) => String(p?.variantId || "") === String(variantId) && p?.submitter
			);
			return Array.from(new Set(related.map((p: any) => String(p.submitter))));
		};
		return variants.map((v: any) => {
			const gp =
				v?.group_proportions && typeof v.group_proportions === "object"
					? v.group_proportions
					: {};
			const factoryBundle = Object.keys(gp)
				.map((id) => {
					const info = getFactoryLinkInfo(String(id));
					const base = info?.displayText || String(id);
					return `${base} * ${String((gp as any)[id] ?? "")}`;
				})
				.join(" ; ");
			return {
				variantName: String(v?.name || v?.variantsid || ""),
				variantImage: v?.imageUrl ? "有图" : "",
				factoryBundle,
				variantDesc: String(v?.description || ""),
				submitter: getSubmitters(String(v?.variantsid || "")).join(", ")
			};
		});
	}
	const r = run.value;
	if (!r) return [];
	const raw = (r as any)._rawTask || {};
	const variantTitlesByLang = {
		en: raw?.langgraph_result?.en?.variant_titles || {},
		de: raw?.langgraph_result?.de?.variant_titles || {}
	} as Record<string, Record<string, string>>;
	const enTitles = variantTitlesByLang?.en || {};
	const variantIds = Object.keys(enTitles || {});
	if (variantIds.length) {
		return variantIds.map((id) => ({
			variantName: id,
			variantImage: "",
			factoryBundle: "",
			variantDesc: String(enTitles[id] || ""),
			submitter: String(raw?.triggered_by || "")
		}));
	}
	return [
		{
			variantName: r.msku,
			variantImage: "",
			factoryBundle: "",
			variantDesc: r.productTitle,
			submitter: String((r as any)?._rawTask?.triggered_by || "")
		}
	];
});

const factoryLinkRows = computed(() => {
	const rows = designTaskOtherInfo.value.factoryLinks || [];
	const typeMap: Record<string, string> = {
		main: "主体",
		accessory: "配件",
		packing: "包装"
	};
	return rows.map((row: any) => ({
		type: typeMap[String(row?.type || "")] || String(row?.type || ""),
		name: String(row?.name || ""),
		price: Number(row?.price || 0),
		url: String(row?.link || ""),
		linkLabel: String(row?.link || ""),
		linkDesc: String(row?.linkDescription || "")
	}));
});

type PurchaseStatus = "已确认" | "待决策" | "已取消";
const purchaseRows = computed(() => {
	const rows = designTaskOtherInfo.value.purchases || [];
	const variantNameMap = new Map<string, string>(
		(designTaskOtherInfo.value.variants || []).map((v: any) => [
			String(v?.variantsid || ""),
			String(v?.name || "")
		])
	);
	return rows.map((row: any) => {
		const uk = Number(row?.uk || 0);
		const de = Number(row?.de || 0);
		const total = Number(row?.total || uk + de);
		return {
			purchaseQty: "",
			ukQty: uk,
			deQty: de,
			status: String(row?.status || "待决策") as PurchaseStatus,
			advice: String(row?.opinion || ""),
			selectedVariant: variantNameMap.get(String(row?.variantId || "")) || "",
			total,
			submitter: String(row?.submitter || "")
		};
	});
});

function purchaseStatusType(s: PurchaseStatus): "success" | "info" | "danger" {
	return s === "已确认" ? "success" : s === "已取消" ? "danger" : "info";
}

const parseCompetitorBullets = (raw: any): string[] => {
	if (Array.isArray(raw))
		return raw
			.map((x) => String(x || "").trim())
			.filter(Boolean)
			.slice(0, 5);
	const text = String(raw || "").trim();
	if (!text) return [];
	return text
		.split(/\r?\n+/)
		.map((x) => x.replace(/^\s*(?:[-•]|\d+[.)])\s*/, "").trim())
		.filter(Boolean)
		.slice(0, 5);
};

const referenceSourceType = computed<"manual_bullets" | "competitor">(() => {
	const task = (run.value as any)?._rawTask || {};
	const raw =
		task?.flow_context?.input?.reference_source_type ||
		task?.flow_context?.reference_input?.reference_source_type;
	return String(raw || "")
		.trim()
		.toLowerCase() === "manual_bullets"
		? "manual_bullets"
		: "competitor";
});

const manualReferenceTitle = computed(() => {
	const task = (run.value as any)?._rawTask || {};
	return String(task?.flow_context?.input?.manual_reference_title || "").trim();
});

const manualReferenceRows = computed(() => {
	const task = (run.value as any)?._rawTask || {};
	const raw = task?.flow_context?.input?.manual_reference_bullets || [];
	return (Array.isArray(raw) ? raw : []).map((item: any) => ({
		title: String(item || "").trim(),
		bullets: [] as string[]
	}));
});

const MANUAL_REFERENCE_TITLE_ZH_KEY = "compRef::manual::title";

const manualReferenceTitleZh = computed(() =>
	String(competitorRefZhTranslations.value[MANUAL_REFERENCE_TITLE_ZH_KEY] || "").trim()
);

const referenceInputPanelTitle = computed(() =>
	referenceSourceType.value === "manual_bullets" ? "参考输入" : "参考竞品"
);

const competitorRefByLocale = computed(() => {
	if (referenceSourceType.value === "manual_bullets") {
		return {
			en: manualReferenceRows.value,
			de: []
		};
	}
	const task = (run.value as any)?._rawTask || {};
	const keywordResult = task?.keyword_result || {};
	const mapTop4 = (rows: any[]) =>
		(Array.isArray(rows) ? rows : []).slice(0, 4).map((row: any) => ({
			title: String(row?.title || ""),
			bullets: parseCompetitorBullets(row?.bullet_points)
		}));
	return {
		en: mapTop4(keywordResult?.en?.keyword_stage?.competitor_pick?.top4 || []),
		de: mapTop4(keywordResult?.de?.keyword_stage?.competitor_pick?.top4 || [])
	};
});

const competitorRefEnRows = computed(() => competitorRefByLocale.value.en);
const competitorRefDeRows = computed(() => competitorRefByLocale.value.de);
const competitorRefZhTranslations = ref<Record<string, string>>({});
const translatingCompetitorRefToZh = ref(false);

type CompetitorRefLocale = "en" | "de";

function competitorRefZhKey(
	locale: CompetitorRefLocale,
	compIdx: number,
	part: "title" | `bullet:${number}`
) {
	return `compRef::${locale}::${compIdx}::${part}`;
}

function collectCompetitorRefTranslateItems() {
	const items: Array<{ key: string; text: string; from: string }> = [];
	const pushLocale = (
		locale: CompetitorRefLocale,
		rows: Array<{ title: string; bullets: string[] }>
	) => {
		rows.forEach((item, idx) => {
			const title = String(item.title || "").trim();
			if (title && title !== "-") {
				items.push({
					key: competitorRefZhKey(locale, idx, "title"),
					text: title,
					from: locale === "de" ? "de" : "en"
				});
			}
			item.bullets.forEach((bp, bidx) => {
				const text = String(bp || "").trim();
				if (!text || text === "-") return;
				items.push({
					key: competitorRefZhKey(locale, idx, `bullet:${bidx}`),
					text,
					from: locale === "de" ? "de" : "en"
				});
			});
		});
	};
	pushLocale("en", competitorRefEnRows.value);
	pushLocale("de", competitorRefDeRows.value);
	if (referenceSourceType.value === "manual_bullets") {
		const title = manualReferenceTitle.value;
		if (title) {
			items.push({
				key: MANUAL_REFERENCE_TITLE_ZH_KEY,
				text: title,
				from: "en"
			});
		}
	}
	return items;
}

const hasCompetitorRefTranslateItems = computed(
	() => collectCompetitorRefTranslateItems().length > 0
);

function getCompetitorRefZhTranslation(
	locale: CompetitorRefLocale,
	compIdx: number,
	kind: "title" | "bullet",
	bulletIdx?: number
) {
	const part: "title" | `bullet:${number}` =
		kind === "title" ? "title" : `bullet:${Number(bulletIdx)}`;
	return String(
		competitorRefZhTranslations.value[competitorRefZhKey(locale, compIdx, part)] || ""
	).trim();
}

function clearCompetitorRefZhTranslations() {
	competitorRefZhTranslations.value = {};
}

async function translateAllCompetitorRefToZh() {
	const items = collectCompetitorRefTranslateItems();
	if (!items.length) {
		ElMessage.warning("当前无可翻译竞品文案");
		return;
	}
	translatingCompetitorRefToZh.value = true;
	try {
		const map = await fetchCopyZhTranslationMap(items);
		competitorRefZhTranslations.value = { ...map };
		const hit = Object.values(map).filter((x) => String(x || "").trim()).length;
		if (!hit) {
			ElMessage.warning("未获得翻译结果");
			return;
		}
		ElMessage.success(`已翻译 ${hit} 处竞品文案`);
	} catch (err: any) {
		const msg =
			err?.response?.data?.message ?? err?.response?.data?.msg ?? err?.message ?? "翻译失败";
		ElMessage.error(typeof msg === "string" ? msg : "翻译失败");
	} finally {
		translatingCompetitorRefToZh.value = false;
	}
}

watch(
	() => copyTableRows.value,
	(rows) => {
		if (suppressAuditSyncFromServer) return;
		auditCopyRows.value = rows.map((x) => ({ ...x }));
		clearCopyZhTranslations();
		clearAppliedCommonSuffixState();
	},
	{ immediate: true }
);

watch(
	() => [route.query.id, props.taskId],
	() => {
		if (loadedDetailTaskId.value) persistReviewDraftCacheForTask(loadedDetailTaskId.value);
		loadedDetailTaskId.value = 0;
		void loadRunDetail();
	},
	{ immediate: true }
);

onBeforeUnmount(() => {
	clearCopyZhRetranslateTimers();
	persistReviewDraftCacheForCurrentTask();
});

onDeactivated(() => {
	persistReviewDraftCacheForCurrentTask();
});

onBeforeRouteLeave(() => {
	persistReviewDraftCacheForCurrentTask();
	return true;
});

const stepActiveIndex = computed(() => {
	if (!run.value) return 0;
	const idx = run.value.steps.findIndex((s) => s.status === "running" || s.status === "pending");
	if (idx === -1) return run.value.steps.length;
	return idx;
});

function stepUiStatus(s: ListingAiRunStepStatus): "wait" | "process" | "finish" | "error" {
	if (s === "done") return "finish";
	if (s === "running") return "process";
	if (s === "failed") return "error";
	if (s === "skipped") return "finish";
	return "wait";
}

function stepDescription(s: ListingAiRunStep): string {
	const parts: string[] = [];
	if (s.startedAt) parts.push(`开始 ${s.startedAt}`);
	if (s.endedAt) parts.push(`结束 ${s.endedAt}`);
	if (s.detail) parts.push(s.detail);
	return parts.join(" · ") || "—";
}

function timelineType(level?: string): "primary" | "success" | "warning" | "danger" {
	if (level === "success") return "success";
	if (level === "danger") return "danger";
	if (level === "warning") return "warning";
	return "primary";
}

function goList() {
	router.push({ path: "/app/listing-ai-copy-task" });
}

function openStudio() {
	if (!run.value) return;
	router.push({
		path: "/app/listing-content-studio/studio",
		query: { sku: run.value.sku, msku: run.value.msku }
	});
}
</script>

<style scoped lang="scss">
.lact-detail-page {
	padding: 20px;
	background: var(--el-bg-color-page);
	min-height: 100%;
	box-sizing: border-box;
}

.lact-detail-page--loading {
	min-height: 360px;
}

.back-btn {
	margin-bottom: 12px;
	padding-left: 0;
}

.meta-card {
	border-radius: 8px;
	margin-bottom: 16px;
}

.meta-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 8px;
}

.meta-title {
	font-size: 14px;
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.meta-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.meta-block {
	margin-top: 16px;
}

.meta-block-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--el-text-color-primary);
	margin-bottom: 10px;
}

.meta-compact-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px 16px;
	align-items: start;
}

@media (max-width: 640px) {
	.meta-compact-grid {
		grid-template-columns: 1fr;
	}
}

.meta-kv-item {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	min-width: 0;
	padding: 2px 0;
}

.meta-kv-item--full {
	grid-column: 1 / -1;
}

.meta-kv-item--image {
	grid-row: 1 / span 2;
	grid-column: 2;
}

.meta-kv-item--name {
	grid-column: 1;
	grid-row: 1;
}

.meta-kv-item--sku {
	grid-column: 1;
	grid-row: 2;
}

@media (max-width: 640px) {
	.meta-kv-item--image {
		grid-row: auto;
		grid-column: auto;
	}
	.meta-kv-item--name,
	.meta-kv-item--sku {
		grid-column: auto;
		grid-row: auto;
	}
}

.meta-kv-key {
	flex-shrink: 0;
	white-space: nowrap;
	width: 66px;
	font-size: 12px;
	line-height: 1.6;
	color: var(--el-text-color-secondary);
}

.meta-kv-value {
	min-width: 0;
	font-size: 13px;
	line-height: 1.6;
	color: var(--el-text-color-primary);
	word-break: break-word;
}

.meta-sku-code {
	font-size: 13px;
}

.meta-kv-value--sku {
	display: inline-flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 4px 8px;
}

.open-product-btn {
	margin-left: 0;
	padding: 0 4px;
	height: auto;
}

.meta-kv-image-wrap {
	flex: 1;
}

.meta-kv-image {
	width: 120px;
	height: 72px;
	border-radius: 6px;
	border: 1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-light);
}

.meta-kv-image--empty {
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.meta-variant-tags,
.meta-lang-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	align-items: center;
}

.meta-dot {
	margin: 0 6px;
}

.meta-alert {
	margin-top: 12px;
}

.uuid {
	font-family: ui-monospace, monospace;
	font-size: 11px;
	opacity: 0.85;
}

.result-card {
	border-radius: 8px;
	margin-bottom: 16px;
}

/* 文案 + 关键词审核主工作区 */
.copy-keyword-workbench {
	--copy-keyword-workbench-h: 80vh;
	display: grid;
	grid-template-columns: minmax(0, 6fr) minmax(0, 4fr);
	gap: 12px;
	align-items: stretch;
	margin-bottom: 16px;
}

.copy-keyword-workbench__copy,
.copy-keyword-workbench__keywords {
	min-width: 0;
	min-height: 0;
	height: var(--copy-keyword-workbench-h);
	display: flex;
	flex-direction: column;
}

.result-card.copy-keyword-workbench__copy-card {
	margin-bottom: 0;
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.result-card.copy-keyword-workbench__copy-card :deep(.el-card__header) {
	flex-shrink: 0;
}

.result-card.copy-keyword-workbench__copy-card :deep(.el-card__body) {
	flex: 1;
	min-width: 0;
	min-height: 0;
	overflow: auto;
	scrollbar-gutter: stable;
}

.keyword-workbench {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	background: var(--el-fill-color-blank);
	overflow: hidden;
}

.keyword-workbench-head {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 10px 12px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-blank);
}

.keyword-view-mode-switch {
	flex-shrink: 0;
}

.keyword-workbench-title {
	font-size: 15px;
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.keyword-workbench-body {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	padding: 10px 12px 12px;
}

.copy-keyword-workbench .keyword-toolbar {
	margin-bottom: 10px;
}

.copy-keyword-workbench .keyword-two-col,
.copy-keyword-workbench .keyword-warning-two-col {
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
}

.copy-keyword-workbench .keyword-workbench-body {
	container-type: inline-size;
	container-name: keyword-workbench;
}

@container keyword-workbench (max-width: 920px) {
	.copy-keyword-workbench .keyword-locale-stack {
		grid-template-columns: 1fr;
	}

	.copy-keyword-workbench .keyword-locale-stack .keyword-table-wrap {
		overflow-x: hidden;
	}
}

.copy-keyword-workbench .keyword-table-wrap {
	overflow-x: auto;
}

.copy-keyword-workbench .keyword-warning-head {
	margin-top: 12px;
}

@media (max-width: 1400px) {
	.copy-keyword-workbench {
		grid-template-columns: 1fr;
		--copy-keyword-workbench-h: 50vh;
	}
}

.keyword-section-collapse {
	border-radius: 8px;
	margin-bottom: 16px;
	overflow: hidden;
	border: 1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-blank);
}

.product-info-collapse {
	border-radius: 8px;
	margin-bottom: 16px;
	overflow: hidden;
	border: 1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-blank);
}

.product-info-collapse :deep(.el-collapse-item__header) {
	font-weight: 600;
	font-size: 15px;
	padding: 0 16px;
	height: 48px;
	line-height: 48px;
	background: var(--el-fill-color-blank);
}

.product-info-collapse :deep(.el-collapse-item__content) {
	padding: 0 12px 12px;
}

.product-three-col {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 10px;
}

@media (max-width: 1600px) {
	.product-three-col {
		grid-template-columns: 1fr;
	}
}

.product-panel {
	min-width: 0;
}

.product-panel-title {
	font-size: 13px;
	font-weight: 600;
	margin: 0 0 6px;
	color: var(--el-text-color-primary);
}

.product-mini-table {
	width: 100%;
}

.product-mini-table :deep(.el-table__cell) {
	padding-top: 6px;
	padding-bottom: 6px;
	font-size: 12px;
}

.reference-competitor-collapse {
	border-radius: 8px;
	margin-bottom: 16px;
	overflow: hidden;
	border: 1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-blank);
}

.reference-competitor-collapse :deep(.el-collapse-item__header) {
	font-weight: 600;
	font-size: 15px;
	padding: 0 16px;
	height: 48px;
	line-height: 48px;
	background: var(--el-fill-color-blank);
}

.reference-competitor-collapse :deep(.el-collapse-item__content) {
	padding: 0 12px 12px;
}

.reference-two-col {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;
}

@media (max-width: 1700px) {
	.reference-two-col {
		grid-template-columns: 1fr;
	}
}

.reference-col {
	min-width: 0;
}

.reference-toolbar {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	margin-bottom: 10px;
}

.reference-col-head {
	font-size: 13px;
	font-weight: 600;
	margin-bottom: 8px;
	color: var(--el-text-color-primary);
}

.reference-list {
	display: grid;
	grid-template-columns: 1fr;
	gap: 8px;
}

.reference-item {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	padding: 8px 10px;
	background: var(--el-fill-color-blank);
}

.reference-item-title {
	font-size: 12px;
	font-weight: 600;
	margin-bottom: 6px;
	line-height: 1.5;
}

.reference-item-bullet {
	font-size: 12px;
	line-height: 1.5;
	color: var(--el-text-color-regular);
}

.reference-item-zh {
	margin-top: 4px;
	padding: 6px 8px;
	border-radius: 6px;
	background: var(--el-fill-color-light);
	display: flex;
	gap: 8px;
	align-items: flex-start;
}

.reference-item-zh--bullet {
	margin-top: 2px;
	margin-bottom: 6px;
}

.reference-item-zh-label {
	flex-shrink: 0;
	font-size: 11px;
	font-weight: 600;
	color: var(--el-text-color-secondary);
}

.reference-item-zh-text {
	font-size: 12px;
	line-height: 1.5;
	color: var(--el-text-color-regular);
	white-space: pre-wrap;
	word-break: break-word;
}

.keyword-section-collapse :deep(.el-collapse-item__header) {
	font-weight: 600;
	font-size: 15px;
	padding: 0 16px;
	height: 48px;
	line-height: 48px;
	background: var(--el-fill-color-blank);
}

.keyword-section-collapse :deep(.el-collapse-item__content) {
	padding: 0 12px 12px;
}

.keyword-toolbar {
	display: flex;
	align-items: center;
	gap: 10px;
}

.keyword-toolbar-left {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
}

.keyword-text-with-copy {
	display: inline-flex;
	align-items: flex-start;
	gap: 2px;
	max-width: 100%;
}

.keyword-text-with-copy > span:first-child,
.keyword-search-link {
	flex: 1;
	min-width: 0;
}

.keyword-search-link {
	color: var(--el-color-primary);
	cursor: pointer;
	text-decoration: none;
	word-break: break-word;
}

.keyword-search-link:hover {
	text-decoration: underline;
}

.keyword-copy-btn {
	flex-shrink: 0;
	padding: 0 2px !important;
	height: 18px !important;
	margin-left: 0;
	vertical-align: top;
}

.keyword-copy-btn :deep(.el-icon) {
	font-size: 14px;
}

.keyword-cell-with-zh {
	white-space: normal;
	word-break: break-word;
	line-height: 1.45;
}

.keyword-zh {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.keyword-zh-inline::before {
	content: "\00a0";
}

.keyword-zh-block {
	margin-top: 4px;
}

.keyword-two-col {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;
	align-items: start;
}

.keyword-block {
	min-width: 0;
}

.keyword-warning-head {
	margin-top: 14px;
	margin-bottom: 8px;
	font-size: 13px;
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.keyword-warning-two-col {
	margin-top: 0;
}

.keyword-col-head {
	font-size: 13px;
	font-weight: 600;
	margin-bottom: 8px;
	color: var(--el-text-color-primary);
}

.keyword-table-wrap {
	width: 100%;
	overflow-x: auto;
}

.keyword-table {
	width: 100%;
}

.keyword-table :deep(.el-table__cell) {
	vertical-align: top;
	height: auto;
}

.keyword-table :deep(.el-table__cell .cell) {
	white-space: normal !important;
	word-break: break-word;
	overflow: visible;
	text-overflow: unset;
	line-height: 1.45;
}

.keyword-table :deep(.el-table__body tr) {
	height: auto;
}

.keyword-cell-with-zh {
	white-space: normal;
	word-break: break-word;
}

.keyword-cell-with-sources {
	cursor: help;
}

.word-source-kw-tooltip {
	max-width: 320px;
	max-height: 260px;
	overflow-y: auto;
	line-height: 1.45;
	font-size: 12px;
}

.word-source-kw-tooltip__label {
	margin-bottom: 6px;
	font-size: 11px;
	opacity: 0.75;
}

.word-source-kw-tooltip__item + .word-source-kw-tooltip__item {
	margin-top: 6px;
	padding-top: 6px;
	border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.word-source-kw-tooltip__kw {
	word-break: break-word;
}

.word-source-kw-tooltip__zh {
	margin-top: 2px;
	font-size: 11px;
	opacity: 0.82;
	word-break: break-word;
}

.keyword-table :deep(.keyword-row-hit-title td) {
	background: rgba(56, 142, 60, 0.34) !important;
}

.keyword-table :deep(.keyword-row-hit-body td) {
	background: rgba(103, 194, 58, 0.12) !important;
}

.keyword-table :deep(.keyword-row-warning-banned td) {
	background: rgba(220, 38, 38, 0.22) !important;
	color: #b91c1c;
}

.keyword-table :deep(.keyword-row-warning-brand td) {
	background: rgba(158, 52, 52, 0.18) !important;
}

.keyword-table :deep(.keyword-row-warning-irrelevant td) {
	background: rgba(255, 214, 102, 0.35) !important;
}

.keyword-table :deep(.keyword-row-warning-ignored td) {
	color: var(--el-text-color-secondary);
	background: var(--el-fill-color-light) !important;
}

.keyword-warn-op-muted {
	color: var(--el-text-color-placeholder);
	font-size: 12px;
}

.input-card {
	border-radius: 8px;
	margin-bottom: 16px;
}

.card-head-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 8px;
}

.card-head-left {
	display: flex;
	align-items: baseline;
	flex-wrap: wrap;
	gap: 8px;
}

.review-draft-tag {
	flex-shrink: 0;
}

.card-head-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

.variant-suffix-row {
	margin-top: 10px;
	display: flex;
	gap: 8px;
	align-items: flex-start;
	flex-wrap: wrap;
}

.variant-suffix-label {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	line-height: 24px;
}

.variant-suffix-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

.card-h {
	font-weight: 600;
	font-size: 15px;
}

.card-sub {
	font-size: 12px;
	font-weight: 400;
}

.variant-option-row-wrap {
	width: 100%;
}

.variant-option-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(260px, 1.5fr) minmax(0, 1fr);
	gap: 10px;
	align-items: start;
	width: 100%;
}

.variant-option-suffix {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
}

.variant-option-suffix-label {
	font-size: 11px;
	font-weight: 600;
	color: var(--el-text-color-secondary);
	letter-spacing: 0.02em;
}

.variant-option-meta {
	min-width: 0;
	padding: 8px 10px;
	border-radius: 6px;
	background: var(--el-color-warning-light-9);
	border: 1px solid var(--el-color-warning-light-5);
}

.variant-option-meta-name {
	font-size: 13px;
	font-weight: 600;
	line-height: 1.35;
	color: var(--el-text-color-primary);
	word-break: break-word;
}

.variant-option-meta-desc {
	margin-top: 6px;
	font-size: 12px;
	line-height: 1.5;
	color: var(--el-text-color-regular);
	word-break: break-word;
	white-space: pre-wrap;
}

.product-variant-desc-cell {
	white-space: pre-wrap;
	word-break: break-word;
	line-height: 1.5;
}

.copy-cell-text-block--compact .copy-cell-inline-highlight {
	padding: 6px 8px;
}

.copy-cell-editor--compact :deep(.el-textarea__inner) {
	box-sizing: border-box;
	width: 100%;
	padding: 6px 8px;
	min-height: 32px !important;
}

.copy-result-hint {
	margin: 0 0 10px;
	font-size: 12px;
	line-height: 1.5;
}

.copy-table-wrap {
	width: 100%;
	min-width: 0;
	overflow-x: auto;
}

.copy-lang-table {
	width: 100%;
	min-width: 624px;
}

.copy-lang-table :deep(.el-table__cell) {
	vertical-align: top;
	height: auto;
}

.copy-lang-table :deep(.el-table__cell .cell) {
	white-space: normal !important;
	word-break: break-word;
	overflow: visible;
	text-overflow: unset;
	line-height: 1.45;
}

.copy-lang-table :deep(.el-table__cell:last-child .cell) {
	padding-right: 12px;
}

.copy-lang-col-head {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	font-weight: 600;
}

.copy-lang-col-status--yes {
	color: var(--el-color-success);
}

.copy-lang-col-status--no {
	color: var(--el-color-danger);
}

.copy-cell-editor :deep(.el-textarea__inner) {
	box-sizing: border-box;
	width: 100%;
	padding: 6px 8px;
	font-size: 12px;
	line-height: 1.4;
}

.copy-cell-zh {
	margin-top: 6px;
	padding: 6px 8px;
	border-radius: 4px;
	background: var(--el-fill-color-light);
	border: 1px dashed var(--el-border-color);
	font-size: 12px;
	line-height: 1.45;
	word-break: break-word;
}

.copy-cell-zh-label {
	display: inline-block;
	margin-right: 6px;
	padding: 0 4px;
	border-radius: 3px;
	font-size: 11px;
	color: var(--el-color-primary);
	background: var(--el-color-primary-light-9);
	vertical-align: top;
}

.copy-cell-zh-text {
	color: var(--el-text-color-regular);
	white-space: pre-wrap;
}

.copy-cell-editor-wrap {
	position: relative;
	width: 100%;
	min-width: 0;
}

.copy-cell-text-block {
	position: relative;
	width: 100%;
	min-width: 0;
}

.copy-cell-editor {
	width: 100%;
}

.copy-cell-editor :deep(.el-textarea) {
	width: 100%;
}

.copy-char-badge-row {
	display: flex;
	justify-content: flex-end;
	margin-top: 4px;
	min-height: 18px;
}

.copy-char-badge {
	pointer-events: none;
	font-size: 11px;
	line-height: 1.2;
	padding: 2px 6px;
	border-radius: 4px;
	background: color-mix(in srgb, var(--el-fill-color) 82%, var(--el-text-color-primary) 8%);
	color: var(--el-text-color-secondary);
	white-space: nowrap;
}

.copy-char-badge--over {
	background: var(--el-color-danger-light-9);
	color: var(--el-color-danger);
	font-weight: 600;
}

.copy-cell-inline-highlight {
	position: absolute;
	inset: 0;
	z-index: 1;
	pointer-events: none;
	box-sizing: border-box;
	padding: 6px 8px;
	font-size: 12px;
	line-height: 1.4;
	white-space: pre-wrap;
	word-break: break-word;
	color: var(--el-text-color-primary);
	border-radius: 4px;
	overflow: visible;
}

.copy-cell-text-block.with-inline-highlight .copy-cell-editor {
	position: relative;
	z-index: 2;
}

.copy-cell-text-block.with-inline-highlight .copy-cell-editor :deep(.el-textarea__inner) {
	background: transparent;
	color: transparent;
	-webkit-text-fill-color: transparent;
	caret-color: var(--el-text-color-primary);
}

.copy-cell-inline-highlight :deep(.kw-hit-core) {
	background: rgba(36, 120, 74, 0.38);
	border-radius: 3px;
	padding: 0;
	box-decoration-break: clone;
	-webkit-box-decoration-break: clone;
}

.copy-cell-inline-highlight :deep(.kw-hit-other) {
	background: rgba(147, 213, 144, 0.35);
	border-radius: 3px;
	padding: 0;
	box-decoration-break: clone;
	-webkit-box-decoration-break: clone;
}

.copy-cell-inline-highlight :deep(.kw-hit-banned) {
	background: rgba(220, 38, 38, 0.5);
	color: #fff;
	border-radius: 3px;
	padding: 0;
	box-decoration-break: clone;
	-webkit-box-decoration-break: clone;
}

.copy-cell-inline-highlight :deep(.kw-hit-brand) {
	background: rgba(158, 52, 52, 0.45);
	border-radius: 3px;
	padding: 0;
	box-decoration-break: clone;
	-webkit-box-decoration-break: clone;
}

.copy-cell-inline-highlight :deep(.kw-hit-irrelevant) {
	background: rgba(255, 214, 102, 0.55);
	border-radius: 3px;
	padding: 0;
	box-decoration-break: clone;
	-webkit-box-decoration-break: clone;
}

.input-lang {
	font-size: 13px;
	margin: 0 0 18px;
}

.lcs-section {
	margin-bottom: 22px;
}

.section-head {
	margin-bottom: 10px;
}

.section-title {
	margin: 0 0 6px;
	font-size: 15px;
	font-weight: 600;
}

.section-desc {
	margin: 0;
	font-size: 12px;
	color: var(--el-text-color-secondary);
	line-height: 1.5;
}

.table-wrap {
	width: 100%;
	overflow-x: auto;
}

.competitor-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	gap: 12px;
}

.competitor-card {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	padding: 10px 12px;
	background: var(--el-fill-color-blank);
}

.competitor-card.checked {
	border-color: var(--el-color-primary-light-5);
	box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}

.competitor-card-h {
	margin-bottom: 8px;
}

.com-asin {
	font-weight: 600;
	margin-right: 8px;
}

.small {
	font-size: 12px;
}

.comp-title {
	font-size: 13px;
	font-weight: 600;
	line-height: 1.4;
	margin-bottom: 8px;
	color: var(--el-text-color-primary);
}

.comp-bullets {
	margin: 0;
	padding-left: 18px;
	font-size: 12px;
	line-height: 1.45;
	color: var(--el-text-color-regular);
}

.raw-collapse {
	margin-top: 8px;
}

.json-pre {
	margin: 0;
	padding: 12px;
	background: var(--el-fill-color-light);
	border-radius: 6px;
	font-size: 12px;
	overflow: auto;
	max-height: 240px;
}

.progress-collapse {
	border-radius: 8px;
	margin-bottom: 16px;
	overflow: hidden;
	border: 1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-blank);
}

.progress-collapse :deep(.el-collapse-item__header) {
	font-weight: 600;
	font-size: 15px;
	padding: 0 16px;
	height: 48px;
	line-height: 48px;
	background: var(--el-fill-color-blank);
}

.progress-collapse :deep(.el-collapse-item__content) {
	padding: 0 12px 12px;
}

.progress-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	gap: 24px;
	padding: 8px 0 12px;
}

.progress-col-title {
	font-size: 13px;
	font-weight: 600;
	margin-bottom: 12px;
}

.lact-tl {
	padding-top: 4px;
}

.tl-title {
	font-weight: 500;
	font-size: 14px;
}

.tl-desc {
	font-size: 12px;
	margin-top: 4px;
}

.muted {
	color: var(--el-text-color-secondary);
}

.audit-action-bar {
	position: sticky;
	bottom: 0;
	z-index: 10;
	margin-top: 10px;
	padding: 10px 12px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	background: color-mix(in srgb, var(--el-bg-color) 92%, #ffffff 8%);
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
}

.audit-action-left {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.audit-action-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.audit-action-right {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}
</style>
