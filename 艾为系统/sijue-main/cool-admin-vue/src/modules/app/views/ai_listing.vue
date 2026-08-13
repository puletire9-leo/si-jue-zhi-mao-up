<template>
	<cl-crud ref="Crud">
		<cl-row>
			<!-- 刷新按钮 -->
			<cl-refresh-btn />
			<!-- 新增按钮 -->
			<cl-add-btn />
			<!-- 删除按钮 -->
			<cl-multi-delete-btn />

			<!-- 复制对话框 -->
			<el-dialog
				v-model="duplicateDialogVisible"
				title="复制数据"
				width="500px"
				:close-on-click-modal="false"
			>
				<div>
					<el-form label-width="100px">
						<el-form-item label="复制数量">
							<el-input-number
								v-model="duplicateCount"
								:min="1"
								:max="10"
								@change="handleCountChange"
							/>
						</el-form-item>

						<div v-for="(variant, index) in selectedVariants" :key="index">
							<el-form-item :label="`变体 ${index + 1}`">
								<el-select
									v-model="selectedVariants[index]"
									placeholder="请选择变体"
								>
									<el-option
										v-for="option in variantOptions"
										:key="option.value"
										:label="option.label"
										:value="option.value"
									/>
								</el-select>

								<div v-if="selectedVariants[index]" class="new-msku-preview">
									<span>新MSKU: </span>
									<el-tag type="success">
										{{
											updateMsku(
												currentDuplicateRow.msku,
												selectedVariants[index]
											)
										}}
									</el-tag>
								</div>
							</el-form-item>
						</div>
					</el-form>
				</div>

				<template #footer>
					<el-button @click="duplicateDialogVisible = false">取消</el-button>
					<el-button type="primary" @click="confirmDuplicate">确定</el-button>
				</template>
			</el-dialog>

			<el-dialog
				v-model="translateDialogVisible"
				title="翻译数据"
				width="600px"
				:close-on-click-modal="true"
				:close-on-press-escape="true"
			>
				<el-form label-width="120px">
					<el-form-item label="选择国家">
						<el-checkbox-group v-model="selectedCountries">
							<el-checkbox
								v-for="country in availableCountries"
								:key="country"
								:label="country"
							>
								{{ country }}
							</el-checkbox>
						</el-checkbox-group>
					</el-form-item>

					<template v-if="keywordsLoading">
						<div class="loading-container">
							<el-icon class="is-loading" size="24">
								<Loading />
							</el-icon>
							<span>正在加载关键词数据...</span>
						</div>
					</template>

					<template v-else>
						<!-- 固定显示5个国家的关键词选择器（支持选择和输入） -->
						<template
							v-for="country in ['英国', '德国', '法国', '西班牙', '意大利']"
							:key="country"
						>
							<el-form-item
								:label="`${country}关键词`"
								class="country-keyword-form-item"
							>
								<!-- 关键词1：支持选择已有关键词或手动输入 -->
								<el-select
									v-model="selectedKeywords[country][0]"
									placeholder="请选择或输入关键词1"
									style="width: 100%; margin-bottom: 15px"
									:min-width="700"
									:max-height="500"
									:popper-append-to-body="true"
									filterable
									allow-create
								>
									<el-option
										v-for="item in countryKeywords[country]"
										:key="item.keyword"
										:value="item.keyword"
										class="keyword-option"
									>
										<div class="option-content">
											<div class="main-keyword">
												关键词:{{ item.keyword || "无关键词" }} || 中文:{{
													item.value_cn || "无翻译"
												}}
												|| 综合:{{ item.weight || 0 }} || 标题分:{{
													item.score2 || 0
												}}
												|| 图片分:{{ item.score1 || 0 }}
												<el-popover
													placement="right-start"
													title="关键词搜索结果图片"
													width="500"
													trigger="hover"
													:persistent="false"
													append-to-body="true"
												>
													<template #reference>
														<el-icon
															class="image-preview-icon"
															size="16"
															v-if="item.result_details?.length"
														>
															<picture />
														</el-icon>
													</template>
													<template #default>
														<div class="image-vertical-scroll">
															<el-space
																direction="horizontal"
																wrap
																size="10"
															>
																<template
																	v-for="(
																		res, idx
																	) in item.result_details"
																	:key="idx"
																>
																	<el-link
																		:href="
																			appConfig.get_amazon_url_dp(
																				res.asin,
																				item.marketplace
																			)
																		"
																		target="_blank"
																		:disabled="!res.asin"
																	>
																		<el-image
																			:src="
																				convert_image_url(
																					res.url_image
																				)
																			"
																			style="
																				width: 100px;
																				height: 100px;
																				border: 1px solid
																					#eee;
																				object-fit: contain;
																			"
																			:preview-src-list="
																				item.result_details.map(
																					(img) =>
																						convert_image_url(
																							img.url_image
																						)
																				)
																			"
																			:initial-index="idx"
																			preview-teleported
																			hide-on-click-modal
																		></el-image>
																	</el-link>
																</template>
															</el-space>
														</div>
													</template>
												</el-popover>
											</div>
										</div>
									</el-option>
								</el-select>

								<el-select
									v-model="selectedKeywords[country][1]"
									placeholder="请选择或输入关键词2"
									style="width: 100%"
									:min-width="700"
									:max-height="500"
									:popper-append-to-body="true"
									filterable
									allow-create
								>
									<el-option
										v-for="item in countryKeywords[country]"
										:key="item.keyword"
										:value="item.keyword"
										class="keyword-option"
									>
										<div class="option-content">
											<div class="main-keyword">
												关键词:{{ item.keyword || "无关键词" }} || 中文:{{
													item.value_cn || "无翻译"
												}}
												|| 综合:{{ item.weight || 0 }} || 标题分:{{
													item.score2 || 0
												}}
												|| 图片分:{{ item.score1 || 0 }}
												<el-popover
													placement="right-start"
													title="关键词搜索结果图片"
													width="500"
													trigger="hover"
													:persistent="false"
													append-to-body="true"
												>
													<template #reference>
														<el-icon
															class="image-preview-icon"
															size="16"
															v-if="item.result_details?.length"
														>
															<picture />
														</el-icon>
													</template>
													<template #default>
														<div class="image-vertical-scroll">
															<el-space
																direction="horizontal"
																wrap
																size="10"
															>
																<template
																	v-for="(
																		res, idx
																	) in item.result_details"
																	:key="idx"
																>
																	<el-link
																		:href="
																			appConfig.get_amazon_url_dp(
																				res.asin,
																				item.marketplace
																			)
																		"
																		target="_blank"
																		:disabled="!res.asin"
																	>
																		<el-image
																			:src="
																				convert_image_url(
																					res.url_image
																				)
																			"
																			style="
																				width: 100px;
																				height: 100px;
																				border: 1px solid
																					#eee;
																				object-fit: contain;
																			"
																			:preview-src-list="
																				item.result_details.map(
																					(img) =>
																						convert_image_url(
																							img.url_image
																						)
																				)
																			"
																			:initial-index="idx"
																			preview-teleported
																			hide-on-click-modal
																		></el-image>
																	</el-link>
																</template>
															</el-space>
														</div>
													</template>
												</el-popover>
											</div>
										</div>
									</el-option>
								</el-select>
							</el-form-item>
						</template>
					</template>
				</el-form>

				<template #footer>
					<el-button @click="translateDialogVisible = false">取消</el-button>
					<el-button type="primary" @click="executeTranslation" :loading="translating">
						开始翻译
					</el-button>
				</template>
			</el-dialog>

			<el-button type="primary" @click="handleExport"> 导出勾选数据上传文件 </el-button>
			<el-button type="success" @click="handleLingxinPairAll"> 配对勾选领星数据 </el-button>

			<el-select
				v-model="status"
				placeholder="数据状态"
				style="margin-right: 10px; width: 150px"
				@change="handleStatusChange"
			>
				<el-option label="所有数据" value="" />
				<el-option label="初始状态" value="1" />
				<el-option label="人工复合状态" value="2" />
				<el-option label="已完成状态" value="3" />
			</el-select>

			<cl-flex1 />
			<!-- 关键字搜索 -->
			<cl-search-key />
		</cl-row>

		<cl-row>
			<!-- 数据表格 -->
			<cl-table ref="Table">
				<template #column-isPair="{ scope }">
					<el-tooltip :content="getPairStatusText(scope.row.isPair)" placement="top">
						<span :class="`pair-status pair-status-${scope.row.isPair}`">
							{{ getPairStatusIcon(scope.row.isPair) }}
						</span>
					</el-tooltip>
				</template>

				<template #column-image_url_display="{ scope }">
					<el-popover placement="right" trigger="hover" :width="300">
						<template #reference>
							<el-image
								:src="scope.row.image_url_display"
								style="width: 50px; height: 50px; cursor: pointer"
								fit="contain"
							/>
						</template>
						<template #default>
							<el-image
								:src="scope.row.image_url_display"
								style="width: 100%; height: auto; max-width: 300px"
								fit="contain"
							/>
						</template>
					</el-popover>
				</template>

				<template #slot-management-buttons="{ scope }">
					<el-tooltip content="编辑" placement="left" :hide-after="0">
						<el-button
							type="primary"
							size="default"
							plain
							circle
							@click="handleEdit(scope.row)"
						>
							<el-icon>
								<edit-pen />
							</el-icon>
						</el-button>
					</el-tooltip>

					<el-tooltip content="获取数据" placement="left" :hide-after="0">
						<el-button
							type="primary"
							size="default"
							plain
							circle
							@click="getState(scope.row.thread_id, scope.row.status)"
						>
							<el-icon>
								<memo />
							</el-icon>
						</el-button>
					</el-tooltip>

					<el-tooltip content="翻译数据" placement="left" :hide-after="0">
						<el-button
							type="success"
							size="default"
							plain
							circle
							@click="openTranslateDialog(scope.row)"
						>
							<el-icon>
								<switch />
							</el-icon>
						</el-button>
					</el-tooltip>
					<el-tooltip content="人工复核" placement="left" :hide-after="0">
						<el-button
							type="warning"
							size="default"
							plain
							circle
							@click="setManualReviewStatus(scope.row)"
						>
							<el-icon>
								<goods-filled />
							</el-icon>
						</el-button>
					</el-tooltip>

					<el-tooltip content="复制数据" placement="left" :hide-after="0">
						<el-button
							type="info"
							size="default"
							plain
							circle
							@click="openDuplicateDialog(scope.row)"
						>
							<el-icon>
								<document-copy />
							</el-icon>
						</el-button>
					</el-tooltip>

					<el-tooltip content="领星配对" placement="left" :hide-after="0">
						<el-button
							type="primary"
							size="default"
							plain
							circle
							@click="lingxinPair(scope.row.msku, scope.row.sku, scope.row.id)"
						>
							<el-icon>
								<checked />
							</el-icon>
						</el-button>
					</el-tooltip>
				</template>

				<template #column-selectedVariant="{ scope }">
					<el-select
						v-model="scope.row.selectedVariant"
						placeholder="请选择"
						style="width: 100%"
						@change="handleDispatchTypeChange(scope.row)"
						@blur="handleDispatchTypeBlur(scope.row)"
					>
						<el-option
							v-for="(variant, index) in scope.row.variant_Combination"
							:key="index"
							:label="variant.name"
							:value="variant.name"
						/>
						<!-- 保留原有的空选项 -->
						<el-option label="" value="" />
					</el-select>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<!-- 分页控件 -->
			<cl-pagination />
		</cl-row>

		<!-- 新增、编辑 -->
		<cl-upsert ref="Upsert">
			<template #slot-title-field="{ scope }">
				<el-row :gutter="20">
					<el-col :span="20">
						<div class="title-section">
							<el-radio v-model="selectedTitleType" label="title"></el-radio>
							<el-input
								v-model="scope.title"
								type="textarea"
								:rows="4"
								placeholder="请输入常规标题"
							></el-input>

							<div v-if="showBrandInTitles" class="matched-brand-words">
								<div v-if="getMatchedBrandWords(scope.title).brandWords.length > 0">
									<span
										v-for="(word, index) in getMatchedBrandWords(scope.title)
											.brandWords"
										:key="'brand-title-' + index"
										class="highlight-brand"
									>
										{{ word }}
									</span>
								</div>
								<div v-if="getMatchedBrandWords(scope.title).keywords.length > 0">
									<span
										v-for="(word, index) in getMatchedBrandWords(scope.title)
											.keywords"
										:key="'keyword-title-' + index"
										class="highlight-keyword"
									>
										{{ word }}
									</span>
								</div>

								<div
									v-if="
										getMatchedBrandWords(scope.title).irrelevant_words.length >
										0
									"
								>
									<span
										v-for="(word, index) in getMatchedBrandWords(scope.title)
											.irrelevant_words"
										:key="'irrelevant_words-title-' + index"
										class="highlight-irrelevant_word"
									>
										{{ word }}
									</span>
								</div>
							</div>
						</div>
					</el-col>

					<el-col :span="20">
						<h3></h3>
						<div class="title-section">
							<el-radio
								v-model="selectedTitleType"
								label="title_more_freq"
							></el-radio>
							<el-input
								v-model="scope.title_more_freq"
								type="textarea"
								:rows="4"
								placeholder="请输入高频标题"
							></el-input>
							<div v-if="showBrandInTitles" class="matched-brand-words">
								<div
									v-if="
										getMatchedBrandWords(scope.title_more_freq).brandWords
											.length > 0
									"
								>
									<span
										v-for="(word, index) in getMatchedBrandWords(
											scope.title_more_freq
										).brandWords"
										:key="'brand-hfreq-' + index"
										class="highlight-brand"
									>
										{{ word }}
									</span>
								</div>
								<div
									v-if="
										getMatchedBrandWords(scope.title_more_freq).keywords
											.length > 0
									"
								>
									<span
										v-for="(word, index) in getMatchedBrandWords(
											scope.title_more_freq
										).keywords"
										:key="'keyword-hfreq-' + index"
										class="highlight-keyword"
									>
										{{ word }}
									</span>
								</div>

								<div
									v-if="
										getMatchedBrandWords(scope.title_more_freq).irrelevant_words
											.length > 0
									"
								>
									<span
										v-for="(word, index) in getMatchedBrandWords(
											scope.title_more_freq
										).irrelevant_words"
										:key="'irrelevant_words-hfreq-' + index"
										class="highlight-irrelevant_word"
									>
										{{ word }}
									</span>
								</div>
							</div>
						</div>
					</el-col>

					<el-col :span="20">
						<h3></h3>
						<div class="title-section">
							<el-radio
								v-model="selectedTitleType"
								label="title_less_freq"
							></el-radio>
							<el-input
								v-model="scope.title_less_freq"
								type="textarea"
								:rows="4"
								placeholder="请输入低频标题"
								class="highlight-container"
							></el-input>
							<div v-if="showBrandInTitles" class="matched-brand-words">
								<div
									v-if="
										getMatchedBrandWords(scope.title_less_freq).brandWords
											.length > 0
									"
								>
									<span
										v-for="(word, index) in getMatchedBrandWords(
											scope.title_less_freq
										).brandWords"
										:key="'brand-lfreq-' + index"
										class="highlight-brand"
									>
										{{ word }}
									</span>
								</div>
								<div
									v-if="
										getMatchedBrandWords(scope.title_less_freq).keywords
											.length > 0
									"
								>
									<span
										v-for="(word, index) in getMatchedBrandWords(
											scope.title_less_freq
										).keywords"
										:key="'keyword-lfreq-' + index"
										class="highlight-keyword"
									>
										{{ word }}
									</span>
								</div>
								<div
									v-if="
										getMatchedBrandWords(scope.title_less_freq).irrelevant_words
											.length > 0
									"
								>
									<span
										v-for="(word, index) in getMatchedBrandWords(
											scope.title_less_freq
										).irrelevant_words"
										:key="'irrelevant_words-lfreq-' + index"
										class="highlight-irrelevant_word"
									>
										{{ word }}
									</span>
								</div>
							</div>
						</div>
						<div>
							<div>已选标题：</div>
							<div>{{ getSelectedTitle(scope) }}</div>
						</div>
					</el-col>
				</el-row>

				<el-col :span="12">
					<br />
					<div class="opinions-section">
						<el-form-item label="专利情况" label-width="100px">
							<el-input
								v-model="scope.patent_memo"
								type="textarea"
								:autosize="{ minRows: 2, maxRows: 3 }"
							></el-input>
						</el-form-item>
						<el-form-item label="开发意见" label-width="100px">
							<el-input
								v-model="scope.opinion_dev"
								type="textarea"
								:autosize="{ minRows: 5, maxRows: 10 }"
							></el-input>
						</el-form-item>
						<el-form-item label="运营意见" label-width="100px">
							<el-input
								v-model="scope.opinion_operator"
								type="textarea"
								:autosize="{ minRows: 5, maxRows: 10 }"
							></el-input>
						</el-form-item>
						<el-form-item label="采购意见" label-width="100px">
							<el-input
								v-model="scope.opinion_procurement"
								type="textarea"
								:autosize="{ minRows: 5, maxRows: 10 }"
							></el-input>
						</el-form-item>
						<el-form-item label="变体名称" label-width="100px">
							<el-tooltip
								placement="top"
								:content="getVariantTooltipContent(scope)"
								:raw-content="true"
							>
								<el-input
									v-model="scope.selectedVariant"
									type="input"
									readonly
								></el-input>
							</el-tooltip>
						</el-form-item>

						<el-form-item label="店铺" label-width="100px">
							<el-input v-model="scope.account_name" type="input" readonly></el-input>
						</el-form-item>
					</div>
				</el-col>
			</template>

			<!-- 卖点选择部分 - 保持不变 -->
			<template #slot-bullet_points="{ scope }">
				<el-checkbox-group v-model="selectedBulletIndexes" :max="5">
					<el-row :gutter="20" style="row-gap: 30px">
						<el-col
							v-for="(point, index) in scope.bullet_points"
							:key="index"
							:span="8"
							style="height: 300px"
						>
							<el-checkbox :label="index" border> 卖点 {{ index + 1 }} </el-checkbox>
							<el-input
								v-model="point.content"
								type="textarea"
								:rows="8"
								placeholder="请输入卖点内容"
								class="highlight-container"
							></el-input>
							<!-- <div v-if="showBrandInTitles" class="matched-brand-words" style="max-height: 100px; overflow-y: auto; margin-top: 5px;"> -->
							<!-- 修改后的卖点匹配词显示代码 -->
							<div
								v-if="showBrandInTitles"
								class="matched-brand-words"
								style="margin-top: 10px; max-height: 100px; overflow-y: auto"
							>
								<div
									v-if="getMatchedBrandWords(point.content).brandWords.length > 0"
									class="phrase-group"
								>
									<div class="phrase-container">
										<el-tag
											v-for="(word, wordIndex) in getMatchedBrandWords(
												point.content
											).brandWords"
											:key="'brand-bullet-' + wordIndex"
											size="small"
											class="highlight-brand"
										>
											{{ word }}
										</el-tag>
									</div>
								</div>
								<div
									v-if="getMatchedBrandWords(point.content).keywords.length > 0"
									class="phrase-group"
								>
									<div class="phrase-container">
										<el-tag
											v-for="(word, wordIndex) in getMatchedBrandWords(
												point.content
											).keywords"
											:key="'keyword-bullet-' + wordIndex"
											size="small"
											class="highlight-keyword"
										>
											{{ word }}
										</el-tag>
									</div>
								</div>
								<div
									v-if="
										getMatchedBrandWords(point.content).irrelevant_words
											.length > 0
									"
									class="phrase-group"
								>
									<div class="phrase-container">
										<el-tag
											v-for="(word, wordIndex) in getMatchedBrandWords(
												point.content
											).irrelevant_words"
											:key="'irrelevant_words-bullet-' + wordIndex"
											size="small"
											class="highlight-irrelevant_word"
										>
											{{ word }}
										</el-tag>
									</div>
								</div>
							</div>
						</el-col>
					</el-row>
				</el-checkbox-group>
			</template>

			<template #slot-description="{ scope }">
				<div class="title-section">
					<el-input
						v-model="scope.description"
						type="textarea"
						:rows="3"
						style="width: 1300px"
					></el-input>
					<br />
					<div v-if="showBrandInTitles">
						<div v-if="descriptionMatched.brandWords.length > 0">
							<span
								v-for="(word, index) in descriptionMatched.brandWords"
								:key="'brand-desc-' + index"
								class="highlight-brand"
							>
								{{ word }}
							</span>
						</div>
						<div v-if="descriptionMatched.keywords.length > 0">
							<span
								v-for="(word, index) in descriptionMatched.keywords"
								:key="'keyword-desc-' + index"
								class="highlight-keyword"
							>
								{{ word }}
							</span>
						</div>

						<div v-if="descriptionMatched.irrelevant_words.length > 0">
							<span
								v-for="(word, index) in descriptionMatched.irrelevant_words"
								:key="'irrelevant_words-desc-' + index"
								class="highlight-irrelevant_word"
							>
								{{ word }}
							</span>
						</div>
					</div>
				</div>
			</template>

			<template #slot-long_tail_phrases="{ scope }">
				<div class="phrase-table">
					<el-table
						:data="scope.long_tail_phrases"
						size="default"
						border
						style="width: 100%"
						max-height="400"
					>
						<el-table-column prop="word" label="单词" width="200">
							<template #default="{ row }">
								<el-input
									v-model="row.word"
									size="default"
									readonly
									class="highlight-container"
								/>
							</template>
						</el-table-column>

						<el-table-column prop="type" label="类型" width="120">
							<template #default="{ row }">
								<el-select v-model="row.type" size="default" :disabled="true">
									<el-option label="modifier" value="modifier" />
									<el-option label="alternative" value="alternative" />
								</el-select>
							</template>
						</el-table-column>

						<el-table-column prop="frequency" label="词频" width="120" align="center">
							<template #default="{ row }">
								<el-input-number
									v-model="row.frequency"
									:min="0"
									size="default"
									controls-position="right"
									style="width: 100%"
									:disabled="true"
								/>
							</template>
						</el-table-column>

						<el-table-column
							prop="search_volume"
							label="搜索量"
							width="120"
							align="center"
						>
							<template #default="{ row }">
								<el-input-number
									v-model="row.search_volume"
									:min="0"
									size="default"
									controls-position="right"
									style="width: 100%"
									:disabled="true"
								/>
							</template>
						</el-table-column>

						<el-table-column prop="score" label="分数" width="120" align="center">
							<template #default="{ row }">
								<el-input-number
									v-model="row.score"
									:min="0"
									:max="1"
									:step="0.1"
									:precision="2"
									size="default"
									controls-position="right"
									style="width: 100%"
									:disabled="true"
								/>
							</template>
						</el-table-column>
					</el-table>
				</div>

				<div
					class="brand-section"
					v-if="
						(scope.brand_names && scope.brand_names.length) ||
						(scope.keywords && scope.keywords.length)
					"
				>
					<!-- 合并显示品牌名称建议和关键词 -->
					<el-table
						:data="[
							...(scope.brand_names || []),
							...(scope.keywords || []),
							...(scope.irrelevant_words || [])
						]"
						border
						style="width: 100%"
						class="highlight-container"
					>
						<el-table-column prop="brand_name" label="关键词" width="200">
							<template #default="{ row }">
								{{ row.brand_name || row.keyword || row.irrelevant_word }}
							</template>
						</el-table-column>

						<el-table-column label="类型" width="150">
							<template #default="{ row }">
								<span v-if="row.brand_name">品牌名</span>
								<span v-else-if="row.keyword">关键词</span>
								<span v-else-if="row.irrelevant_word">不相关的词</span>
								<span v-else>{{ row.type }}</span>
							</template>
						</el-table-column>

						<el-table-column label="描述/搜索量" width="300">
							<template #default="{ row }">
								<div v-if="row.brand_name">{{ row.reason }}</div>
								<div v-if="row.irrelevant_word">{{ row.reason }}</div>
								<div v-else>搜索量: {{ row.search_volume }}</div>
							</template>
						</el-table-column>

						<el-table-column label="操作" width="100" align="center">
							<template #default="{ $index, row }">
								<el-button
									type="danger"
									size="small"
									icon="Delete"
									@click="handleDeleteItem(scope, row, $index)"
									>删除</el-button
								>
							</template>
						</el-table-column>
					</el-table>
					<el-button
						type="primary"
						size="small"
						@click="highlightBrandInTitles(scope)"
						class="highlight-btn"
					>
						显示相同关键词
					</el-button>
				</div>
			</template>

			<template #slot-primary3="{ scope }">
				<el-card class="profit-calculator" shadow="never">
					<div class="common-params">
						<el-row :gutter="20">
							<el-col :span="16">
								<el-form-item label="成本价 (¥)" label-width="100px">
									<el-input-number
										v-model="common.cost"
										:precision="2"
										controls-position="right"
									/>
								</el-form-item>
							</el-col>
						</el-row>

						<el-row :gutter="20">
							<el-col :span="12">
								<el-form-item label="尺寸 (cm)" label-width="100px">
									<el-space :size="8">
										<el-input-number
											v-model="common.length"
											:precision="1"
											placeholder="长"
										/>
										<el-input-number
											v-model="common.width"
											:precision="1"
											placeholder="宽"
										/>
										<el-input-number
											v-model="common.height"
											:precision="1"
											placeholder="高"
										/>
									</el-space>
								</el-form-item>
							</el-col>

							<el-col :span="6">
								<el-form-item label="重量 (kg)">
									<el-space>
										<el-input-number
											v-model="common.actualWeight"
											:precision="2"
											:min="0"
										/>
										<el-tag type="info"
											>抛重：{{ volumetricWeight.toFixed(2) }}kg</el-tag
										>
										<el-tag
											>有效重量：{{ effectiveWeight.toFixed(2) }}kg</el-tag
										>
									</el-space>
								</el-form-item>
							</el-col>
						</el-row>
					</div>

					<!-- 国家参数表格 -->
					<el-table :data="markets" border>
						<el-table-column label="国家" prop="country" fixed width="100" />

						<el-table-column label="本地售价" width="180" align="center">
							<template #default="{ row }">
								<el-input
									v-model="row.localPrice"
									:precision="2"
									:controls="false"
									:prefix="row.currencySymbol"
								/>
							</template>
						</el-table-column>

						<el-table-column label="头程运费" width="100">
							<template #default="{ row }">
								<el-input
									v-model="row.shipping"
									:precision="2"
									:min="0"
									controls-position="right"
								/>
							</template>
						</el-table-column>

						<el-table-column label="配送费" width="180">
							<template #default="{ row }">
								<el-input
									v-model="row.deliveryFee"
									:precision="2"
									:min="0"
									controls-position="right"
								/>
							</template>
						</el-table-column>

						<el-table-column label="汇率" width="140" align="center">
							<template #default="{ row }">
								<el-input
									v-model="row.exchangeRate"
									:precision="2"
									:min="0"
									controls-position="right"
								/>
							</template>
						</el-table-column>

						<el-table-column label="税率 (%)" width="150">
							<template #default="{ row }">
								<el-input
									v-model="row.taxRate"
									:precision="2"
									:min="0"
									:max="100"
									controls-position="right"
								/>
							</template>
						</el-table-column>

						<el-table-column label="利润 (¥)" width="150">
							<template #default="{ row }">
								<el-tag :type="row.profit > 0 ? 'success' : 'danger'">
									{{ row.profit }}
								</el-tag>
							</template>
						</el-table-column>

						<el-table-column label="利润率 (%)" width="150">
							<template #default="{ row }">
								<el-tag :type="row.profitRate > 0 ? 'success' : 'danger'">
									{{ row.profitRate }}%
								</el-tag>
							</template>
						</el-table-column>
					</el-table>
				</el-card>
			</template>
		</cl-upsert>
	</cl-crud>
</template>

<script lang="ts" name="app-ai_listing" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { ElLoading, ElMessage, ElMessageBox } from "element-plus";
import { ref, watch, reactive, onMounted, onUnmounted } from "vue";
import * as XLSX from "xlsx";
import { convert_image_url, is_admin } from "/$/app/utils";
import { computed, nextTick } from "vue";
import * as echarts from "echarts";
import {
	Delete,
	EditPen,
	GoodsFilled,
	Memo,
	DocumentCopy,
	Switch,
	Checked
} from "@element-plus/icons-vue";
import { h } from "vue";
import pinyin from "pinyin";
import { DataLine, Picture } from "@element-plus/icons-vue";
import { appConfig } from "../../../../../appConfig";

import dayjs from "dayjs";

// 状态筛选
const status = ref("");

const { service } = useCool();

const isEditMode = ref(false);
// cl-upsert
const Upsert = useUpsert({
	dialog: {
		draggable: true,
		"align-center": true,
		width: "1500"
	},
	props: {
		labelWidth: 150
	},
	async onInfo(data, { next, done }) {
		let newData = await next(data);

		done({
			...newData,
			image_url_display: convert_image_url(newData.image_url)
		});
	},

	items: [
		{
			label: "主图",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 250, fit: "contain" } },
			fixed: "left"
		},

		{
			prop: "basic_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "选品信息",
					expand: false,
					isExpand: true
				}
			},
			children: [
				{
					label: "本地SKU",
					prop: "sku",
					component: { name: "el-input", props: { clearable: true } },
					span: 4
				},
				{
					label: "MSKU",
					prop: "msku",
					component: { name: "el-input", props: { clearable: true } },
					span: 4
				},
				{
					label: "线程ID",
					prop: "thread_id",
					component: { name: "el-input", props: { clearable: true } },
					span: 4
				},

				{ label: "BSR编号", prop: "bsr_node_id", component: { name: "el-input" }, span: 4 },
				{ label: "BSR节点", prop: "bsr_node", component: { name: "el-input" }, span: 4 },
				{
					label: "BSR类目",
					prop: "bsr_category",
					component: { name: "el-input" },
					span: 4
				},
				{
					label: "材料",
					prop: "material",
					component: {
						name: "el-select",
						options: [
							{ label: "", value: "" }, // 空值选项
							{ label: "Nylon", value: "Nylon" },
							{ label: "Stoneware", value: "Stoneware" },
							{ label: "Brass", value: "Brass" },
							{ label: "Rattan", value: "Rattan" },
							{ label: "Glass", value: "Glass" },
							{ label: "Iron", value: "Iron" },
							{ label: "Plastic", value: "Plastic" },
							{ label: "Metal", value: "Metal" },
							{ label: "Stone", value: "Stone" },
							{ label: "Porcelain", value: "Porcelain" },
							{ label: "Stainless Steel", value: "Stainless Steel" },
							{ label: "Resin", value: "Resin" },
							{ label: "Copper", value: "Copper" },
							{ label: "Rubber", value: "Rubber" },
							{ label: "Wood", value: "Wood" },
							{ label: "Melamine", value: "Melamine" },
							{ label: "Silicone", value: "Silicone" },
							{ label: "Aluminium", value: "Aluminium" },
							{ label: "Marble", value: "Marble" },
							{ label: "Earthenware", value: "Earthenware" },
							{ label: "Ceramic", value: "Ceramic" },
							{ label: "Acrylic", value: "Acrylic" }
						]
					},
					span: 4
				},
				{
					label: "颜色",
					prop: "color",
					component: {
						name: "el-select",
						options: [
							{ label: "", value: "" }, // 空值选项
							{ label: "White", value: "White" },
							{ label: "Black", value: "Black" },
							{ label: "Gray", value: "Gray" },
							{ label: "Green", value: "Green" },
							{ label: "Pink", value: "Pink" },
							{ label: "Blue", value: "Blue" },
							{ label: "Red", value: "Red" },
							{ label: "Orange", value: "Orange" },
							{ label: "Yellow", value: "Yellow" },
							{ label: "Purple", value: "Purple" },
							{ label: "Brown", value: "Brown" },
							{ label: "Beige", value: "Beige" },
							{ label: "Multicolour", value: "Multicolour" }
						]
					},
					span: 4
				},
				{
					label: "尺码",
					prop: "size",
					component: {
						name: "el-select",
						options: [
							{ label: "", value: "" }, // 空值选项
							{ label: "XXS", value: "XXS" },
							{ label: "XS", value: "XS" },
							{ label: "S", value: "S" },
							{ label: "M", value: "M" },
							{ label: "L", value: "L" },
							{ label: "XL", value: "XL" },
							{ label: "XXL", value: "XXL" },
							{ label: "One Size", value: "One Size" }
						]
					},
					span: 4
				},
				{
					label: "单位计数",
					prop: "unit_count",
					component: {
						name: "el-input"
					},
					span: 4
				},
				{
					label: "产品数量",
					prop: "product_quantity",
					component: {
						name: "el-input"
					},
					span: 4
				},
				{
					label: "长(cm)",
					prop: "length",
					component: { name: "el-input", props: { min: 0, step: 0.1, precision: 1 } },
					span: 4
				},
				{
					label: "宽(cm)",
					prop: "width",
					component: { name: "el-input", props: { min: 0, step: 0.1, precision: 1 } },
					span: 4
				},
				{
					label: "高(cm)",
					prop: "height",
					component: { name: "el-input", props: { min: 0, step: 0.1, precision: 1 } },
					span: 4
				},
				{
					label: "实际重量(kg)",
					prop: "actual_weight",
					component: { name: "el-input", props: { min: 0, step: 0.1, precision: 2 } },
					span: 4
				},
				{ label: "成本价", prop: "cost", component: { name: "el-input" }, span: 4 },
				{
					label: "本地价格",
					prop: "local_price",
					component: {
						name: "el-input",
						props: {
							"suffix-icon": () => h("span", {}, `最低价: ${currentMinPrice.value}`)
						}
					},
					span: 5
				}
			]
		},
		{
			prop: "basic_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "AI生成内容",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "",
					prop: "long_tail_phrases",
					component: { name: "slot-long_tail_phrases" },
					span: 100 // 关键！启用插槽模式
				},
				{
					label: " ",
					prop: "",
					component: { name: "slot-title-field" },
					span: 50
				},
				{
					prop: "final_title",
					component: { name: "el-input", props: { type: "hidden" } }
				},
				{
					label: "卖点列表",
					prop: "",
					component: { name: "slot-bullet_points" },
					span: 200
				},

				{
					label: "描述",
					prop: "",
					component: { name: "slot-description" },
					span: 200
				},
				{
					prop: "bullet_points1",
					component: { name: "el-input", props: { type: "hidden" } }
				},
				{
					prop: "bullet_points2",
					component: { name: "el-input", props: { type: "hidden" } }
				},
				{
					prop: "bullet_points3",
					component: { name: "el-input", props: { type: "hidden" } }
				},
				{
					prop: "bullet_points4",
					component: { name: "el-input", props: { type: "hidden" } }
				},
				{
					prop: "bullet_points5",
					component: { name: "el-input", props: { type: "hidden" } }
				}
			]
		}
	]
});

// cl-table
const Table = useTable({
	columns: [
		{ type: "selection" },
		// { label: "关联的选品ID", prop: "candidate_id", minWidth: 140 },
		{ label: "国家", prop: "marketplace", minWidth: 140 },
		{
			label: "状态",
			prop: "status",
			dict: [
				{ label: "初始", value: 1, type: "info" },
				{ label: "人工复核", value: 2, type: "warning" },
				{ label: "已完成", value: 3, type: "success" }
			],
			width: 120
		},
		{
			label: "图片",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 50, fit: "contain" } },
			fixed: "left"
		},
		{ label: "产品名称", prop: "produce_name", minWidth: 140 },
		{ label: "本地SKU", prop: "sku", minWidth: 140 },
		{ label: "MSKU", prop: "msku", minWidth: 140 },
		{ label: "配对状态", prop: "isPair", minWidth: 140 },
		{
			label: "变体名称",
			prop: "selectedVariant",
			width: 140,
			align: "center"
		},
		{ label: "店铺名称", prop: "account_name", minWidth: 140 },
		{ label: "线程ID", prop: "thread_id", minWidth: 140 },
		{
			label: "长尾词",
			prop: "long_tail_phrases",
			minWidth: 120,
			component: { name: "cl-editor-preview", props: { name: "wang" } }
		},
		{
			label: "要点标题",
			prop: "bullet_titles",
			minWidth: 120,
			component: { name: "cl-editor-preview", props: { name: "wang" } }
		},
		{
			label: "常规标题",
			prop: "title",
			showOverflowTooltip: true,
			minWidth: 200
		},
		{
			label: "高频标题",
			prop: "title_more_freq",
			showOverflowTooltip: true,
			minWidth: 200
		},
		{
			label: "低频标题",
			prop: "title_less_freq",
			showOverflowTooltip: true,
			minWidth: 200
		},
		{
			label: "品牌名称",
			prop: "brand_names",
			minWidth: 200,
			render: (row) => {
				if (!row.brand_names || !row.brand_names.length) return "-";
				return row.brand_names.map((brand) => brand.brand_name).join(", ");
			}
		},
		{ label: "描述", prop: "description", showOverflowTooltip: true, minWidth: 200 },
		{
			label: "卖点列表",
			prop: "bullet_points",
			minWidth: 120,
			component: { name: "cl-editor-preview", props: { name: "wang" } }
		},
		{ label: "国家", prop: "marketplace", minWidth: 120 },
		{ label: "材质", prop: "material", minWidth: 120 },
		{ label: "颜色", prop: "color", minWidth: 120 },
		{ label: "尺寸", prop: "size", minWidth: 120 },
		{ label: "单位数量", prop: "unit_count", minWidth: 120 },
		{ label: "产品数量", prop: "product_quantity", minWidth: 120 },
		{ label: "长(cm)", prop: "length", minWidth: 120 },
		{ label: "宽(cm)", prop: "width", minWidth: 120 },
		{ label: "高(cm)", prop: "height", minWidth: 120 },
		{ label: "实际重量(kg)", prop: "actual_weight", minWidth: 140 },
		{ label: "本地价格", prop: "local_price", minWidth: 120 },
		// { label: "BSR节点", prop: "node_name", minWidth: 200, showOverflowTooltip: true },
		{ label: "BSR节点编号", prop: "bsr_node_id", minWidth: 200, showOverflowTooltip: true },
		{ label: "BSR节点名称", prop: "bsr_node", minWidth: 200, showOverflowTooltip: true },
		{ label: "BSR类目名称", prop: "bsr_category", minWidth: 200, showOverflowTooltip: true },
		{
			label: "创建时间",
			prop: "createTime",
			minWidth: 170,
			sortable: "custom",
			component: { name: "cl-date-text" }
		},
		{
			label: "更新时间",
			prop: "updateTime",
			minWidth: 170,
			sortable: "custom",
			component: { name: "cl-date-text" }
		},
		{ type: "op", buttons: ["slot-management-buttons"] }
	]
});

const isEditing = ref(false);

// cl-crud
const Crud = useCrud(
	{
		service: service.app.ai_listing,

		async onRefresh(params, { next, done, render }) {
			const { list } = await next({
				...params,
				status: status.value // 加入状态参数
			});
			Table.value?.data.forEach((item) => {
				item.image_url_display = convert_image_url(item.image_url);
				// 确保状态字段存在
				if (item.status === undefined) {
					item.status = 1; // 默认初始状态
				}
			});
		}
	},
	(app) => {
		app.refresh();
	}
);

const getPairStatusText = (status: number) => {
	switch (status) {
		case 0:
			return "未配对";
		case 1:
			return "配对成功";
		case 2:
			return "配对失败";
		default:
			return "未知状态";
	}
};

// 获取配对状态图标
const getPairStatusIcon = (status: number) => {
	switch (status) {
		case 0:
			return "❓"; // 未配对
		case 1:
			return "✅"; // 配对成功
		case 2:
			return "❌"; // 配对失败
		default:
			return "❓"; // 未知状态
	}
};

const lingxinPair = async (msku: string, sku: string, id: number) => {
	try {
		const res = await service.app.ai_listing.lingxinPair({
			msku: msku,
			sku: sku,
			id: id
		});
		// 这里处理接口返回结果，示例显示成功提示
		ElMessage.success(res.message || "配对数据成功");
		// 如果需要刷新表格数据
		Crud.value?.refresh();
	} catch (e) {
		ElMessage.error("配对数据失败");
		console.error(e);
	}
};

// 批量配对领星数据
const handleLingxinPairAll = async () => {
	try {
		const selectedRows = Table.value?.getSelectionRows();
		if (!selectedRows || selectedRows.length === 0) {
			ElMessage.warning("请先选择要配对的数据");
			return;
		}

		const ids = selectedRows.map((row) => row.id);

		ElMessageBox.confirm(`确定要配对选中的 ${ids.length} 条数据吗？`, "确认配对", {
			confirmButtonText: "确定",
			cancelButtonText: "取消",
			type: "warning"
		})
			.then(async () => {
				const loading = ElLoading.service({
					lock: true,
					text: "配对中，请稍候...",
					background: "rgba(0, 0, 0, 0.7)"
				});

				try {
					const res = await service.app.ai_listing.lingxinPairAll({ ids });
					ElMessage.success(res.message || `成功配对 ${ids.length} 条数据`);
					// 清空选择
					Table.value?.clearSelection();

					Crud.value?.refresh();
				} catch (e) {
					ElMessage.error("批量配对失败");
					console.error(e);
				} finally {
					loading.close();
				}
			})
			.catch(() => {
				// 用户取消操作
			});
	} catch (e) {
		ElMessage.error("操作失败");
		console.error(e);
	}
};

const getState = async (thread_id: string, status: string) => {
	try {
		if (status == "1") {
			const res = await service.app.search_threads.getState({
				id: thread_id
			});
			// 这里处理接口返回结果，示例显示成功提示
			ElMessage.success(res.message || "获取数据成功");

			// 如果需要刷新表格数据
			Crud.value?.refresh();
		} else {
			ElMessage.error("已人工复核，无法重新获取数据");
		}
	} catch (e) {
		ElMessage.error("获取数据失败");
		console.error(e);
	}
};

const handleStatusChange = () => {
	Crud.value?.pagination?.setCurrentPage(1);
	Crud.value?.refresh();
};
const setManualReviewStatus = async (row: any) => {
	try {
		const reviewResult = await service.app.ai_listing.checkReviewData({ id: row.id });

		if (!reviewResult.hasSelected) {
			ElMessage.warning(reviewResult.message);
			return;
		}

		// 3. 如果包含品牌词
		if (reviewResult.hasBrand) {
			const brands = reviewResult.foundBrands.join("、");
			ElMessage.warning(`标题或卖点中包含品牌词：${brands}，请修改后再提交`);
			return;
		}

		await service.app.ai_listing.update({
			id: row.id,
			status: 2
		});

		ElMessage.success("已标记为人工复核状态");
		Crud.value?.refresh();
	} catch (e) {
		ElMessage.error("状态更新失败");
		console.error(e);
	}
};

// 标题选择 - 使用独立的ref，完全与表单对象分离
const selectedTitleType = ref("title");

// 卖点选择
const selectedBulletIndexes = ref<number[]>([]);

watch(
	selectedBulletIndexes,
	(newVal) => {
		if (isInitializing.value) return; // 跳过初始化阶段

		const form = Upsert.value?.form;
		if (form && form.bullet_points) {
			// 清空所有隐藏字段
			for (let i = 1; i <= 5; i++) {
				form[`bullet_points${i}`] = "";
			}

			// 按顺序设置选中的卖点内容
			const sortedIndexes = [...newVal].sort((a, b) => a - b);
			sortedIndexes.forEach((index, i) => {
				if (i < 5 && form.bullet_points[index]) {
					form[`bullet_points${i + 1}`] = form.bullet_points[index].content;
				}
			});
		}
	},
	{ deep: true }
);

// 获取选中的标题内容
const getSelectedTitle = (scope: any) => {
	if (!selectedTitleType.value) return "未选择";

	const selectedTitle = (() => {
		switch (selectedTitleType.value) {
			case "title":
				return scope.title || "未设置内容";
			case "title_more_freq":
				return scope.title_more_freq || "未设置内容";
			case "title_less_freq":
				return scope.title_less_freq || "未设置内容";
			default:
				return "未选择";
		}
	})();

	// 自动更新 final_title
	if (scope && selectedTitleType.value) {
		scope.final_title = selectedTitle;
	}

	return selectedTitle;
};

async function handleExport() {
	try {
		const selectedIds = Table.value?.getSelectionRows().map((row) => row.id);

		if (!selectedIds || selectedIds.length === 0) {
			ElMessage.warning("请先选择要导出的候选产品");
			return;
		}
		let response = await service.app.ai_listing.exportData({ ids: selectedIds });

		// 解析候选数据（现在包含国家列）
		const candidateRows = response.split("\n").filter((row) => row.trim());
		// 直接使用后端返回的列（不需要处理国家列）
		const wb = XLSX.utils.book_new();

		const candidateWs = XLSX.utils.aoa_to_sheet(candidateRows.map((row) => row.split(",")));
		XLSX.utils.book_append_sheet(wb, candidateWs, "Sheet1");

		// 导出文件
		XLSX.writeFile(wb, "上传数据.xlsx");
	} catch (error) {
		console.error("导出错误:", error.response?.data?.message || error.message);
		ElMessage.error("导出失败: " + (error.response?.data?.message || error.message));
	}
}

watch(
	() => Upsert.value?.form,
	(form) => {
		if (form) {
			// 确保 selectedTitleType 存在于表单对象中
			if (!form.selectedTitleType) {
				form.selectedTitleType = "title";
			}

			// 确保 final_title 有值
			if (!form.final_title) {
				form.final_title = form[form.selectedTitleType] || "";
			}
		}
	},
	{ deep: true, immediate: true }
);

const countries = ["英国", "德国", "法国", "西班牙", "意大利"] as const;

const countryCodeMap: Record<string, string> = {
	英国: "UK",
	德国: "DE",
	法国: "FR",
	西班牙: "ES",
	意大利: "IT"
};
let calculatorInitialized = false;

const loadingRates = ref(false);

interface ExchangeRate {
	currency: string;
	rate: number;
	symbol: string;
}

onMounted(async () => {
	if (!calculatorInitialized) {
		resetCalculator();
		calculatorInitialized = true;
	}
});
const resetCalculator = () => {
	// 重置公共参数
	common.cost = 0;
	common.length = 0;
	common.width = 0;
	common.height = 0;
	common.actualWeight = 0;

	// 重置国家参数（使用 forEach 保持响应性）
	markets.value.forEach((market) => {
		market.localPrice = 0;
		market.shipping = 20;
		market.deliveryFee = 0;
		market.profit = market.profitRate = 0;
	});

	// 重置表单字段（逐个属性修改）
	if (Upsert.value?.form) {
		const form = Upsert.value.form;

		// 使用 Object.assign 合并修改而不是替换整个对象
		Object.assign(form, {
			cost_price: 0,
			length: 0,
			width: 0,
			height: 0,
			actual_weight: 0,
			dimensional_weight: 0,
			// 其他需要重置的字段...
			// 保留必要字段（如 ID）
			...(form.asinid && { id: form.asinid }), // 保留原有 ID
			...(form.asin && { asin: form.asin }) // 保留 ASIN
			// 添加其他需要保留的字段...
		});
	}
};
const common = reactive({
	cost: 0,
	length: 0,
	width: 0,
	height: 0,
	actualWeight: 0,
	min_price: ""
});

const markets = ref([
	{
		country: "英国",
		currency: "GBP",
		currencySymbol: "￡",
		localPrice: 0, // 本地货币价格
		exchangeRate: 0, // 从服务获取
		shipping: 20,
		deliveryFee: 0,
		taxRate: 16.66,
		profit: 0,
		profitRate: 0
	},
	{
		country: "德国",
		currency: "EUR",
		currencySymbol: "€",
		localPrice: 0,
		exchangeRate: 0,
		shipping: 20,
		deliveryFee: 0,
		taxRate: 15.96,
		profit: 0,
		profitRate: 0
	},

	{
		country: "法国",
		currency: "EUR",
		currencySymbol: "€",
		localPrice: 0,
		shipping: 20,
		deliveryFee: 0,
		exchangeRate: 0,
		profit: 0,
		profitRate: 0,
		taxRate: 16.66
	},

	{
		country: "西班牙",
		currency: "EUR",
		currencySymbol: "€",
		localPrice: 0,
		shipping: 20,
		deliveryFee: 0,
		exchangeRate: 0,
		profit: 0,
		profitRate: 0,
		taxRate: 18.03
	},

	{
		country: "意大利",
		currency: "EUR",
		currencySymbol: "€",
		localPrice: 0,
		shipping: 20,
		deliveryFee: 0,
		exchangeRate: 0,
		profit: 0,
		profitRate: 0,
		taxRate: 17.35
	}
]);

const salesChart = ref<HTMLElement>();
const keywordChart = ref<HTMLElement>();
let salesChartInstance: echarts.ECharts | null = null;
let keywordChartInstance: echarts.ECharts | null = null;
const initCharts = () => {
	console.log("执行了initCharts");
	// 销毁旧实例
	salesChartInstance?.dispose();
	keywordChartInstance?.dispose();

	if (salesChart.value && keywordChart.value) {
		salesChartInstance = echarts.init(salesChart.value);
		keywordChartInstance = echarts.init(keywordChart.value);
	}
};

type Country = (typeof countries)[number];

// 处理销售数据（按国家分组）
const processSalesData = (list: any[]) => {
	const dataByCountry: Record<Country, Map<string, number>> = {
		英国: new Map(),
		德国: new Map(),
		法国: new Map(),
		西班牙: new Map(),
		意大利: new Map()
	};

	list.forEach((competitor) => {
		const country = competitor.marketplace as Country;
		if (!countries.includes(country)) return;

		const salesData =
			typeof competitor.sales_volume_data === "string"
				? JSON.parse(competitor.sales_volume_data || "[]")
				: competitor.sales_volume_data || [];

		salesData.forEach((item: any) => {
			const dateStr = item.date ? item.date.toString() : "";
			let month = "";
			if (!dateStr) return;

			if (dateStr.includes("-")) {
				month = dayjs(dateStr).format("YYYY-MM");
			} else if (dateStr.length === 6) {
				month = dayjs(dateStr, "YYYYMM").format("YYYY-MM");
			} else if (dateStr.length === 8) {
				month = dayjs(dateStr, "YYYYMMDD").format("YYYY-MM");
			} else {
				month = dayjs(dateStr).format("YYYY-MM");
			}

			// 兼容不同字段名，可能是 sales, search 或 searches
			const val = item.sales !== undefined ? item.sales : (item.searches !== undefined ? item.searches : item.search);

			if (month !== "Invalid Date") {
				const current = dataByCountry[country].get(month) || 0;
				dataByCountry[country].set(month, current + (Number(val) || 0));
			}
		});
	});

	// 转换为排序后的数组
	const result: Record<Country, [string, number][]> = {} as any;
	countries.forEach((country) => {
		result[country] = Array.from(dataByCountry[country].entries()).sort(([a], [b]) =>
			a.localeCompare(b)
		);
	});
	return result;
};

// 处理关键词数据（同样逻辑）
const processKeywordData = (list: any[]) => {
	const dataByCountry: Record<Country, Map<string, number>> = {
		英国: new Map(),
		德国: new Map(),
		法国: new Map(),
		西班牙: new Map(),
		意大利: new Map()
	};

	list.forEach((keyword) => {
		const country = keyword.marketplaces as Country;
		if (!countries.includes(country)) return;

		const keywordData =
			typeof keyword.sif_search_history === "string"
				? JSON.parse(keyword.sif_search_history || "[]")
				: keyword.sif_search_history || [];

		console.log("keywordData:", keywordData);

		keywordData.forEach((item: any) => {
			const dateStr = item.date ? item.date.toString() : "";
			let month = "";
			if (!dateStr) return;

			if (dateStr.includes("-")) {
				month = dayjs(dateStr).format("YYYY-MM");
			} else if (dateStr.length === 6) {
				month = dayjs(dateStr, "YYYYMM").format("YYYY-MM");
			} else if (dateStr.length === 8) {
				month = dayjs(dateStr, "YYYYMMDD").format("YYYY-MM");
			} else {
				month = dayjs(dateStr).format("YYYY-MM");
			}

			// 兼容不同字段名，可能是 search 或 searches
			const val = item.search !== undefined ? item.search : item.searches;

			if (month !== "Invalid Date") {
				const current = dataByCountry[country].get(month) || 0;
				dataByCountry[country].set(month, current + (Number(val) || 0));
			}
		});
	});

	const result: Record<Country, [string, number][]> = {} as any;
	countries.forEach((country) => {
		result[country] = Array.from(dataByCountry[country].entries()).sort(([a], [b]) =>
			a.localeCompare(b)
		);
	});
	console.log("result:", result);
	return result;
};

const getChartOption = (title: string, data: [string, number][], color: string) => {
	const xData = data.map(([month]) => month);
	const seriesData = data.map(([, value]) => value);

	return {
		title: { text: title, left: "center" },
		tooltip: { trigger: "axis" },
		xAxis: {
			type: "category",
			data: xData,
			axisLabel: {
				formatter: (value: string) => {
					const [year, month] = value.split("-");
					return `${year.slice(-2)}-${month}`; // 显示为 24-04 格式
				}
			}
		},
		yAxis: { type: "value" },
		series: [
			{
				type: "bar",
				data: seriesData,
				itemStyle: { color, borderRadius: 4 },
				emphasis: { itemStyle: { shadowBlur: 10 } }
			}
		]
	};
};
// 更新图表数据
const updateCharts = async (row: any) => {
	try {
		const [competitors, keywords] = await Promise.all([
			service.app.bsr_candidate_competitor_customize.page({
				candidate_id: row.asinid,
				size: 1000,
				status: 2
			}),
			service.app.keyword.page({
				asin: row.asin,
				size: 1000,
				keyword_type: ["core_major", "core"]
			})
		]);

		const salesData = processSalesData(competitors.list);
		const keywordData = processKeywordData(keywords.list);

		countries.forEach((country) => {
			// 销售图表
			const salesChartEl = document.getElementById(`sales-chart-${countryCodeMap[country]}`);
			if (salesChartEl) {
				const chart = echarts.init(salesChartEl);
				chart.setOption(
					getChartOption(`${country}竞品销量`, salesData[country], "#5470C6")
				);
			}

			// 关键词图表
			const keywordChartEl = document.getElementById(
				`keyword-chart-${countryCodeMap[country]}`
			);
			if (keywordChartEl) {
				const chart = echarts.init(keywordChartEl);
				chart.setOption(
					getChartOption(`${country}关键词搜索量`, keywordData[country], "#91CC75")
				);
			}
		});
	} catch (error) {
		console.error("图表更新失败", error);
	}
};
const isInitializing = ref(false);

const handleEdit = async (row: any) => {
	try {
		// 先执行清空操作
		resetCalculator();
		const candidateId = row.asinid;

		isInitializing.value = true;

		// 清空当前选中
		selectedBulletIndexes.value = [];

		if (row.final_title) {
			if (row.final_title === row.title) {
				selectedTitleType.value = "title";
			} else if (row.final_title === row.title_more_freq) {
				selectedTitleType.value = "title_more_freq";
			} else if (row.final_title === row.title_less_freq) {
				selectedTitleType.value = "title_less_freq";
			}
		}

		// 匹配已保存的卖点
		if (row.bullet_points && row.bullet_points.length) {
			const savedPoints = [
				row.bullet_points1,
				row.bullet_points2,
				row.bullet_points3,
				row.bullet_points4,
				row.bullet_points5
			].filter(Boolean); // 过滤掉空值

			// 遍历所有卖点找到匹配项
			row.bullet_points.forEach((point: any, index: number) => {
				if (savedPoints.includes(point.content)) {
					selectedBulletIndexes.value.push(index);
				}
			});
		}

		// 关闭初始化标志
		isInitializing.value = false;

		showBrandInTitles.value = false; // 重置高亮状态

		// 使用组件提供的编辑方法
		Upsert.value?.edit({
			...row,
			// 显式保留关键字段
			id: row.id,
			asin: row.asin,
			marketplace: row.marketplace
		});
		await nextTick();
		initCharts(); // 每次打开都重新初始化
		updateCharts(row);
	} catch (error) {
		console.error("编辑时发生错误:", error);
		ElMessage.error("初始化编辑表单失败");
	}
};

watch(selectedTitleType, (newVal) => {
	const form = Upsert.value?.form;
	if (form && newVal) {
		form.final_title = form[newVal] || ""; // 同步到最终标题字段
	}
});

const countries2 = [
	{ name: "英国", code: "uk" },
	{ name: "德国", code: "de" },
	{ name: "法国", code: "fr" },
	{ name: "西班牙", code: "es" },
	{ name: "意大利", code: "it" }
];

const volumetricWeight = computed(() => {
	return (common.length * common.width * common.height) / 6000;
});

// 计算有效重量
const effectiveWeight = computed(() => {
	return Math.max(volumetricWeight.value, common.actualWeight);
});

const calculateAll = () => {
	markets.value.forEach(calculateRow);
	markets.value.forEach(calculateMinPrice);
};

watch(
	() => [
		common.cost,
		common.length,
		common.width,
		common.height,
		common.actualWeight,
		...markets.value.map((m) => [
			m.localPrice,
			m.shipping,
			m.deliveryFee,
			m.taxRate,
			m.exchangeRate
		])
	],
	calculateAll,
	{ deep: true }
);
const calculateRow = (row: any) => {
	const effectiveWeight = Math.max(volumetricWeight.value, common.actualWeight);

	// 转换为人民币的售价
	const priceCNY = row.localPrice * row.exchangeRate;

	// 计算利润
	const taxAmount = row.localPrice * (row.taxRate / 100);
	const profit =
		(row.localPrice * 0.84 - row.deliveryFee - taxAmount) * row.exchangeRate -
		(common.cost + effectiveWeight * row.shipping);

	// 计算利润率
	const profitRate = priceCNY > 0 ? (profit / priceCNY) * 100 : 0;

	row.profit = Number(profit.toFixed(2));
	row.profitRate = Number(profitRate.toFixed(2));
};
// 计算指定国家的最低售价
const calculateMinPrice = (country: string) => {
	// 找到对应国家的市场数据
	const market = markets.value.find((m) => m.country === country);

	if (!market) return "未找到国家配置";
	try {
		const cost = common.cost;
		const actualWeight = common.actualWeight;

		// 计算公式: ((成本价 + 有效重量 * 头程运费) / 汇率 + 配送费) * 1.1
		const minPrice =
			((cost + actualWeight * Number(market.shipping)) / Number(market.exchangeRate) +
				Number(market.deliveryFee)) *
			1.1;
		console.log(cost, actualWeight, market.shipping, market.exchangeRate, market.deliveryFee);
		// 格式化为两位小数并添加货币符号
		console.log("1232131231", minPrice.toFixed(2));
		return minPrice.toFixed(2) + " " + market.currencySymbol;
	} catch (e) {
		console.error("最低价计算错误", e);
		return "计算错误";
	}
};

// 获取当前国家的最低售价
const currentMinPrice = computed(() => {
	if (!Upsert.value?.form?.marketplace) return "请选择国家";
	return calculateMinPrice("英国");
});

// 添加品牌词高亮功能相关变量和方法
const showBrandInTitles = ref(false);

const currentKeywords = computed(() => {
	return Upsert.value?.form?.keywords || [];
});

const currentIrrelevantWords = computed(() => {
	return Upsert.value?.form?.irrelevant_words || [];
});

// 获取匹配的品牌词
const getMatchedBrandWords = (text: string) => {
	if (
		!text ||
		(!currentBrandNames.value.length &&
			!currentKeywords.value.length &&
			!currentIrrelevantWords.value.length)
	) {
		return { brandWords: [], keywords: [], irrelevant_words: [] };
	}

	const textLower = text.toLowerCase();
	const brandWords: string[] = [];
	const keywords: string[] = [];
	const irrelevant_words: string[] = [];

	// 匹配品牌词
	currentBrandNames.value.forEach((brand) => {
		if (brand.brand_name) {
			const brandPhrase = brand.brand_name.toLowerCase();
			if (textLower.includes(brandPhrase)) {
				brandWords.push(brand.brand_name);
			}
		}
	});

	// 匹配关键词
	currentKeywords.value.forEach((keywordObj) => {
		if (keywordObj.keyword) {
			const keywordPhrase = keywordObj.keyword.toLowerCase();
			if (textLower.includes(keywordPhrase)) {
				keywords.push(keywordObj.keyword);
			}
		}
	});

	// 匹配不相关词
	currentIrrelevantWords.value.forEach((irrelevantWords) => {
		if (irrelevantWords.irrelevant_word) {
			const irrelevantWordPhrase = irrelevantWords.irrelevant_word.toLowerCase();
			if (textLower.includes(irrelevantWordPhrase)) {
				irrelevant_words.push(irrelevantWords.irrelevant_word);
			}
		}
	});
	// 去重
	return {
		brandWords: [...new Set(brandWords)],
		keywords: [...new Set(keywords)],
		irrelevant_words: [...new Set(irrelevant_words)]
	};
};
const descriptionMatched = computed(() => {
	return getMatchedBrandWords(Upsert.value?.form?.description || "");
});

// 当前品牌名称列表
const currentBrandNames = computed(() => {
	return Upsert.value?.form?.brand_names || [];
});

// 高亮品牌词方法
const highlightBrandInTitles = (scope: any) => {
	showBrandInTitles.value = !showBrandInTitles.value;
};

const handleDeleteItem = (scope: any, item: any, index: number) => {
	ElMessageBox.confirm("确定要删除该项吗？此操作不可撤销。", "删除确认", {
		confirmButtonText: "确定",
		cancelButtonText: "取消",
		type: "warning"
	})
		.then(() => {
			// 判断是品牌名还是关键词
			if (item.brand_name) {
				// 从品牌名数组中删除
				if (scope.brand_names && scope.brand_names.length > index) {
					scope.brand_names.splice(index, 1);
				}
			} else {
				// 从关键词数组中删除
				if (scope.keywords && scope.keywords.length > index) {
					scope.keywords.splice(index, 1);
				}
			}
			ElMessage.success("删除成功");
		})
		.catch(() => {
			// 用户取消删除
		});
};

const translateDialogVisible = ref(false);
const currentTranslateRow = ref<any>({});
const availableCountries = ["英国", "德国", "法国", "西班牙", "意大利"];
const selectedCountries = ref<string[]>([]);
const keywordsLoading = ref(false);
const translating = ref(false);
const COUNTRY_LANG_MAP = {
	美国: "English",
	英国: "English",
	德国: "German",
	法国: "French",
	意大利: "Italian",
	西班牙: "Spanish"
};

// 关键词数据

interface KeywordItem {
	keyword: string;
	value_cn: string;
	total_search_volume: number;
	weight: number;
	score1: number;
	score2: number;
	result_details: any[]; // 建议进一步定义具体结构，如 { asin: string; url_image: string }[]
	marketplace: string;
}
const countryKeywords = ref<Record<string, KeywordItem[]>>({});

const selectedKeywords = ref<Record<string, [string, string]>>({});

// 打开翻译对话框
const openTranslateDialog = async (row: any) => {
	resetTranslateDialog();
	currentTranslateRow.value = JSON.parse(JSON.stringify(row));
	selectedCountries.value = ["英国", "德国", "法国", "西班牙", "意大利"];
	// selectedCountries.value = availableCountries.filter(c => c !== row.marketplace);

	// 初始化关键词数据结构
	countryKeywords.value = {};

	// 为每个国家初始化关键词数组
	selectedKeywords.value = Object.fromEntries(
		selectedCountries.value.map((country) => [country, ["", ""]] as const)
	);

	// 显示对话框
	translateDialogVisible.value = true;

	// 立即开始加载关键词数据
	await fetchKeywordsForCountries();
};

const resetTranslateDialog = () => {
	keywordsLoading.value = false;
	translating.value = false;
	selectedCountries.value = [];
	countryKeywords.value = {};
	selectedKeywords.value = {};
};

const hasKeywordsData = (country: string) => {
	return countryKeywords.value[country] && countryKeywords.value[country].length > 0;
};

// 为选中国家获取关键词
const fetchKeywordsForCountries = async () => {
	try {
		keywordsLoading.value = true;

		if (!currentTranslateRow.value.candidate_id) {
			throw new Error("无法获取产品ASIN");
		}

		const candidateResponse = await service.app.ai_listing_write.info({
			id: currentTranslateRow.value.candidate_id
		});

		if (!candidateResponse?.asin) {
			throw new Error("无法获取产品ASIN");
		}

		const asin = candidateResponse.asin;

		// 并行请求所有国家的关键词，同时捕获单个错误
		await Promise.all(
			selectedCountries.value.map(async (country) => {
				try {
					const keywordsResponse = await service.app.keyword.page({
						asin,
						marketplaces: country,
						size: 1000,
						page: 1
					});

					// 处理数据（同之前的逻辑）
					const processedKeywords = keywordsResponse.list.map((item: any) => ({
						keyword: item.value,
						value_cn: item.value_cn || "无翻译",
						total_search_volume:
							item.search_volume_data?.reduce(
								(sum: number, data: any) => sum + (data.search || 0),
								0
							) || 0,
						weight: item.weight || 0,
						score1: item.score1 || 0,
						score2: item.score2 || 0,
						result_details: item.result_details || [],
						marketplace: country
					}));

					countryKeywords.value[country] = processedKeywords;
				} catch (error) {
					console.error(`获取${country}关键词失败:`, error);
					// 可在此处添加用户可见提示，如 ElMessage.error(`获取${country}关键词失败`)
				}
			})
		);
	} catch (error) {
		console.error("获取关键词失败:", error);
		// ElMessage.error('获取关键词失败，请稍后重试'); // 添加用户提示
	} finally {
		keywordsLoading.value = false;
	}
};

// 监听选中国家变化
watch(selectedCountries, async (newCountries) => {
	// 如果新增了国家，获取其关键词
	for (const country of newCountries) {
		if (!countryKeywords.value[country]) {
			await fetchKeywordsForCountries();
			break;
		}
	}
});

// 执行翻译
const executeTranslation = async () => {
	// 验证至少选择了一个国家
	if (selectedCountries.value.length === 0) {
		ElMessage.warning("请至少选择一个国家");
		return;
	}

	// 验证每个国家都选择了两个关键词
	for (const country of selectedCountries.value) {
		const [keyword1, keyword2] = selectedKeywords.value[country] || ["", ""];

		if (!keyword1 || !keyword2) {
			ElMessage.warning(`请为${country}选择两个关键词`);
			return;
		}
	}

	const row = currentTranslateRow.value;
	translating.value = true;

	try {
		// 为每个选中国家调用翻译接口
		for (const country of selectedCountries.value) {
			const [keyword1, keyword2] = selectedKeywords.value[country];

			// 准备请求数据
			const requestBody = {
				input: {
					language: COUNTRY_LANG_MAP[country],
					keywords: [keyword1, keyword2],
					title: row.final_title,
					bullet_points: [
						row.bullet_points1 || "",
						row.bullet_points2 || "",
						row.bullet_points3 || "",
						row.bullet_points4 || "",
						row.bullet_points5 || ""
					].filter((p) => p), // 过滤空值
					description: row.description
				},
				sku: row.sku,
				msku: row.msku,
				candidate_id: row.candidate_id,
				shop_id: row.shop_id,
				account_name: row.account_name,
				image_url: row.image_url,
				bsr_node_id: row.bsr_node_id,
				bsr_node: row.bsr_node,
				bsr_category: row.bsr_category,
				keywords: row.keywords,
				selectedVariant: row.selectedVariant,
				factory_links: row.factory_links,
				variant_Combination: row.variant_Combination
			};

			// 调用翻译接口
			await service.app.search_threads.createAmazonListingFanYi(requestBody);
			ElMessage.success(`翻译任务已提交 (${country})`);
		}

		// 关闭对话框
		translateDialogVisible.value = false;
		ElMessage.success("所有翻译任务已提交成功");
		Crud.value?.refresh();
	} catch (error) {
		console.error("翻译失败:", error);
		ElMessage.error("翻译任务提交失败");
	} finally {
		translating.value = false;
	}
};

const handleDuplicate = async (row: any) => {
	try {
		// 调用复制接口
		await service.app.ai_listing.duplicate({ id: row.id });

		ElMessage.success("数据复制成功");
		// 刷新表格
		Crud.value?.refresh();
	} catch (e) {
		ElMessage.error("数据复制失败");
		console.error(e);
	}
};

// 在 script 部分添加以下代码
const duplicateDialogVisible = ref(false);
const duplicateCount = ref(1);
const currentDuplicateRow = ref<any>(null);
const selectedVariants = ref<string[]>([]);
const variantOptions = ref<any[]>([]); // 存储变体选项

// 打开复制对话框
const openDuplicateDialog = (row: any) => {
	console.log("当前行数据：", row);
	currentDuplicateRow.value = row;
	duplicateCount.value = 1;
	selectedVariants.value = Array(1).fill("");

	// 从 variant_Combination 中提取变体名称作为选项
	if (row.variant_Combination && Array.isArray(row.variant_Combination)) {
		variantOptions.value = row.variant_Combination.map((v: any) => ({
			value: v.name,
			label: v.name
		}));
	} else {
		variantOptions.value = [];
		console.warn("未找到有效的变体组合数据", row.variant_Combination);
	}

	duplicateDialogVisible.value = true;
};

// 处理复制数量变化
const handleCountChange = (newCount: number) => {
	const currentCount = selectedVariants.value.length;

	if (newCount > currentCount) {
		// 增加下拉框
		const addCount = newCount - currentCount;
		selectedVariants.value = [...selectedVariants.value, ...Array(addCount).fill("")];
	} else if (newCount < currentCount) {
		// 减少下拉框
		selectedVariants.value = selectedVariants.value.slice(0, newCount);
	}
};

// 生成产品首字母缩写
const generateProductInitials = (variantName: string) => {
	if (!variantName) return "";

	try {
		return pinyin(variantName, {
			style: pinyin.STYLE_FIRST_LETTER
		})
			.map((arr) => arr[0].toUpperCase())
			.join("")
			.substring(0, 5);
	} catch (e) {
		console.error("拼音转换失败:", e);
		// 回退方案：取前5个大写字母
		return variantName
			.replace(/[^a-zA-Z]/g, "")
			.toUpperCase()
			.substring(0, 5);
	}
};

// 更新MSKU格式
const updateMsku = (originalMsku: string, variantName: string) => {
	if (!originalMsku) return "";

	const parts = originalMsku.split("-");
	if (parts.length < 2) return originalMsku;

	// 替换最后一部分
	const initials = generateProductInitials(variantName);
	parts[parts.length - 1] = initials || "VAR";

	return parts.join("-");
};

// 确认复制操作
const confirmDuplicate = async () => {
	// 检查所有下拉框是否已选择
	if (selectedVariants.value.some((v) => !v)) {
		ElMessage.warning("请为每个复制项选择变体");
		return;
	}

	try {
		const promises = selectedVariants.value.map((variant) => {
			const newMsku = updateMsku(currentDuplicateRow.value.msku, variant);
			return service.app.ai_listing.duplicate({
				id: currentDuplicateRow.value.id,
				variant: variant,
				msku: newMsku // 添加新生成的MSKU
			});
		});

		await Promise.all(promises);

		ElMessage.success(`成功复制 ${selectedVariants.value.length} 条数据`);
		duplicateDialogVisible.value = false;
		Crud.value?.refresh();
	} catch (error) {
		ElMessage.error("复制过程中出错");
		console.error(error);
	}
};

const getVariantTooltipContent = (scope: any) => {
	if (!scope.selectedVariant) return "";

	// 1. 获取采购意见
	const procurement = scope.procurement || "暂无采购意见";

	// 2. 匹配变体描述
	let description = "";
	let groupsInfoHtml = "";

	// 查找当前选中的变体组合
	const selectedVariant = scope.variant_Combination?.find(
		(v: any) => v.name === scope.selectedVariant
	);

	if (selectedVariant) {
		description = selectedVariant?.description || "未找到变体描述";
		const selectedGroups = selectedVariant.selectedGroups || [];

		if (selectedGroups.length > 0) {
			selectedGroups.forEach((groupName: string) => {
				const groupQuantity = selectedVariant.groupProportions?.[groupName] || 1;
				const matchedLink = scope.factory_links?.find(
					(link: any) => link.name === groupName
				);
				let groupLink = matchedLink?.user_input || "未找到对应工厂链接";
				if (
					groupLink &&
					!groupLink.startsWith("http://") &&
					!groupLink.startsWith("https://")
				) {
					groupLink = "http://" + groupLink;
				}

				groupsInfoHtml += `
					<div style="margin: 8px 0; padding: 6px 0;">
						<div><strong>组名称：</strong>${groupName.trim()}</div>
						<div style="margin: 3px 0;"><strong>数量：</strong>${groupQuantity}</div>
						<div><strong>工厂链接：</strong>
							<a href="${groupLink}" target="_blank" style="color: #409EFF; word-break: break-all; text-decoration: none; transition: color 0.2s;">
								${groupLink}
							</a>
						</div>
					</div>
				`;
			});
		} else {
			groupsInfoHtml = "<div>暂无选中的分组信息</div>";
		}
	} else {
		description = "未找到匹配的变体";
		groupsInfoHtml = "<div>未找到匹配的变体，无法获取分组信息</div>";
	}

	// 核心优化：强制白底+高对比度文字+样式隔离
	return `
    <div style="max-width: 350px; padding: 10px 12px; 
                color: #222222; /* 高对比度文字 */
                background: #ffffff !important; /* 强制白底，!important 抵御外部覆盖 */
                font-size: 14px; line-height: 1.5;
                word-wrap: break-word; border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15); /* 阴影强化视觉隔离 */
                z-index: 9999; position: relative; /* 确保层级，不被遮挡 */">
      <div style="margin: 8px 0;">
        <strong>采购意见：</strong>
        <div style="margin-top: 3px; line-height: 1.5;">${procurement}</div>
      </div>
      <div style="margin: 8px 0;">
        <strong>变体描述：</strong>
        <div style="margin-top: 3px; line-height: 1.5;">${description}</div>
      </div>
      <div style="margin: 8px 0;">
        <strong>选中分组详情：</strong>
        <div style="margin-top: 3px;">${groupsInfoHtml}</div>
      </div>
    </div>
  `;
};

const handleDispatchTypeBlur = (row) => {
	// saveDispatchType(row);
};

const handleDispatchTypeChange = async (row: any) => {
	await saveDispatchType(row);
};

const saveDispatchType = async (row: any) => {
	try {
		await service.app.ai_listing.update({
			id: row.id,
			selectedVariant: row.selectedVariant
		});

		ElMessage.success("变体已更新");
		// 刷新数据保持一致性
		Crud.value?.refresh();
	} catch (error) {
		console.error("保存失败:", error);
		ElMessage.error("保存失败");
		// 恢复原始数据
		Crud.value?.refresh();
	}
};
</script>

<style scoped>
/* 添加品牌词和关键词的不同样式 */
.highlight-brand {
	background-color: #ffeb3b;
	/* 黄色 */
	color: #000;
	padding: 0 2px;
	border-radius: 2px;
	font-weight: bold;
	margin-right: 4px;
}

.highlight-keyword {
	background-color: #ff6b6b;
	/* 红色 */
	color: #000;
	padding: 0 2px;
	border-radius: 2px;
	font-weight: bold;
	margin-right: 4px;
}

.highlight-irrelevant_word {
	background-color: #74a9dd;
	color: #000;
	padding: 0 2px;
	border-radius: 2px;
	font-weight: bold;
	margin-right: 4px;
}

/* 调整匹配词显示区域 */
.matched-phrases {
	margin-top: 5px;
	font-size: 13px;
	color: #666;
}

/* 高亮按钮样式 */
.highlight-btn {
	margin-bottom: 10px;
}

/* 高亮样式 */
.highlight-text {
	background-color: #ffeb3b;
	color: #000;
	padding: 0 2px;
	border-radius: 2px;
	font-weight: bold;
	box-shadow: 0 0 3px rgba(0, 0, 0, 0.3);
	margin-right: 4px;
}

/* 匹配词显示区域 */
.matched-brand-words {
	margin-top: 5px;
	font-size: 13px;
	color: #666;
}

/* 标题布局调整 */
.title-section {
	margin-bottom: 15px;
}

.title-option .el-textarea {
	width: 100%;
}

.title-option {
	padding: 10px;
}

.title-label {
	margin: 8px 0;
	font-weight: normal;
}

.selected-title-preview {
	margin-top: 15px;
	padding: 10px;
}

.preview-label {
	font-weight: bold;
}

.el-row {
	margin-bottom: 15px;
}

.el-col {
	display: flex;
	flex-direction: column;
}

/* 高亮样式 */
.highlight-text {
	background-color: #ffeb3b;
	color: #000;
	padding: 0 2px;
	border-radius: 2px;
	font-weight: bold;
	box-shadow: 0 0 3px rgba(0, 0, 0, 0.3);
}

/* 高亮按钮样式 */
.highlight-btn {
	margin-bottom: 10px;
}

/* 品牌卡片样式调整 */
.brand-card {
	position: relative;
}

.brand-name {
	cursor: pointer;
	font-weight: bold;
}

.brand-name:hover {
	text-decoration: underline;
}

.el-checkbox-group {
	display: flex;
}

.el-checkbox {
	margin-bottom: 8px;
}

.pair-status {
	font-weight: bold;
	font-size: 16px;
}

.pair-status-0 {
	color: #909399;
	/* 未配对 - 灰色 */
}

.pair-status-1 {
	color: #67c23a;
	/* 配对成功 - 绿色 */
}

.pair-status-2 {
	color: #f56c6c;
	/* 配对失败 - 红色 */
}

/* 垂直滚动容器：固定最大高度，超出显示上下滚动条 */
.image-vertical-scroll {
	max-height: 800px;
	/* 核心：最大高度（超过这个高度会出现滚动条），可按需调整 */
	overflow-y: auto;
	/* 垂直方向超出时显示上下滚动条 */
	overflow-x: hidden;
	/* 隐藏水平滚动条（避免多余空白） */
	padding: 10px;
	/* 内边距：图片不贴弹窗边缘，更美观 */
}

/* 优化上下滚动条样式（可选，让滚动条更精致） */
.image-vertical-scroll::-webkit-scrollbar {
	width: 6px;
	/* 滚动条宽度（垂直滚动条是“宽度”） */
}

.image-vertical-scroll::-webkit-scrollbar-track {
	background: #f5f5f5;
	/* 滚动条轨道背景色 */
	border-radius: 3px;
	/* 轨道圆角 */
}

.image-vertical-scroll::-webkit-scrollbar-thumb {
	background: #ccc;
	/* 滚动条滑块颜色 */
	border-radius: 3px;
	/* 滑块圆角 */
}

.image-vertical-scroll::-webkit-scrollbar-thumb:hover {
	background: #999;
	/* 鼠标 hover 滑块时加深颜色，提升交互感 */
}
</style>
