<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<!-- <cl-multi-delete-btn /> -->

			<cl-add-btn />
			<el-dialog v-model="copyDialogVisible" title="复制工厂链接" width="500px">
				<div>
					<el-form label-width="120px">
						<el-form-item label="复制数量">
							<el-input-number
								v-model="copyCount"
								:min="1"
								:max="10"
								controls-position="right"
							/>
							<span style="margin-left: 10px; color: #666">最多10组</span>
						</el-form-item>

						<el-form-item label="品名后缀">
							<div
								v-for="(item, index) in copyPreview"
								:key="index"
								style="margin-bottom: 10px"
							>
								<el-input
									v-model="copyPreview[index].suffix"
									:placeholder="`组 ${index + 1} 的后缀`"
									style="width: 100%"
								>
									<template #prepend>
										{{ copyBaseName
										}}<span v-if="copyPreview[index].suffix">-</span>
									</template>
								</el-input>
							</div>
						</el-form-item>
					</el-form>
				</div>

				<template #footer>
					<el-button @click="copyDialogVisible = false">取消</el-button>
					<el-button type="primary" @click="confirmCopy">确定</el-button>
				</template>
			</el-dialog>

			<batch-update-bsr-candidate-status :Crud="Crud" />

			<!-- <batch-update-competitor-spider-status :Crud="Crud" /> -->

			<batch-open-dp-link :Crud="Crud" />

			<el-space direction="horizontal">
				<el-text>仅展示待精选</el-text>
				<el-switch
					v-model="showOnlyStatusLibrary"
					active-text="是"
					inactive-text="否"
					inline-prompt
				></el-switch>
				<el-divider direction="vertical"></el-divider>
			</el-space>

			<bsr-candidate-filter-status />

			<cl-search-key placeholder="模糊搜索" />
			<el-button type="primary" @click="handleBatchUpdateStatus"> 更新状态汇总 </el-button>

			<el-button
				v-permission="service.app.bsr_candidate.sync_from_FX"
				@click="syncFX()"
				type="success"
			>
				从领星同步汇率信息
			</el-button>

			<cl-import-btn tips="" :on-submit="onSubmit" type="warning" />

			<cl-flex1 />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-asin="{ scope }">
					<div class="date-cell">
						<div class="asin-value">
							<el-link type="primary" :underline="false" @click.prevent="openProductLinks2(scope.row)">
								{{ scope.row.asin }}
							</el-link>
						</div>
						<!-- 状态标签 -->
						<br />
						<div v-if="scope.row.source === 1" class="status-tag status-tag--close">
							数
						</div>
						<div
							v-else-if="scope.row.source === 2"
							class="status-tag status-tag--compete"
						>
							1688
						</div>
						<div
							v-else-if="scope.row.source === 3"
							class="status-tag status-tag--success"
						>
							变
						</div>
						<div
							v-else-if="scope.row.source === 4"
							class="status-tag status-tag--success"
						>
							季
						</div>
						<br />
						<el-link target="_blank" :underline="false" @click.prevent="openProductLinks(scope.row)">
							<el-button size="small">批量打开</el-button>
						</el-link>
					</div>
				</template>

				<template #column-bsr_link="{ scope }">
					<cl-table-column-bsr-link :bsr_link="scope.row.bsr_link" />
				</template>

				<template #column-bullet_points="{ scope }">
					<cl-table-column-bullet-points :bullet_points="scope.row.bullet_points" />
				</template>

				<template #column-bsr_html="{ scope }">
					<cl-table-column-bsr-html :bsr_html="scope.row.bsr_html" />
				</template>

				<template #column-competitor_spider_res="{ scope }">
					<el-button
						size="small"
						v-if="!!scope.row.competitor_spider_res"
						@click="
							jsonViewerContent = JSON.stringify(
								scope.row.competitor_spider_res,
								null,
								2
							);
							jsonViewerDialogVisible = true;
						"
					>
						查看 {{ scope.row.competitor_spider_res?.length }}
					</el-button>
					<template v-else>暂无</template>
				</template>

				<!-- <template #column-factory_links="{scope}">
          <cl-table-column-popover-content :content="scope.row.factory_links?.map(item=>item.user_input).join('\n')"
                                           title="工厂链接" :width="550"
                                           :replace-return-to-br="true"
                                           :replacing-br-quantity="1"/>
        </template> -->

				<template #slot-management-buttons="{ scope }">
					<el-button
						size="default"
						type="success"
						text
						bg
						@click="updateStatus(scope.row, 6)"
					>
						待处理数据
					</el-button>
					<el-tooltip content="编辑" placement="top" :hide-after="0">
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

					<el-tooltip content="竞品管理" placement="top" :hide-after="0">
						<el-button
							type="warning"
							size="default"
							plain
							circle
							@click="
								curEditingBsrCandidate = scope.row;
								competitorManagementPaneVisible = true;
							"
						>
							<el-icon>
								<goods-filled />
							</el-icon>
						</el-button>
					</el-tooltip>

					<el-tooltip content="关键词管理" placement="top" :hide-after="0">
						<el-button
							type="success"
							size="default"
							plain
							circle
							@click="
								curEditingListing = scope.row;
								keywordManagementPaneVisible = true;
							"
						>
							<el-icon>
								<memo />
							</el-icon>
						</el-button>
					</el-tooltip>
				</template>

				<template #column-image_url_display="{ scope }">
					<el-popover
						placement="right"
						trigger="hover"
						:width="1300"
						@show="boostProductImages(scope.row)"
					>
						<template #reference>
							<resilient-product-image
								:src="scope.row.image_url_display"
								style="width: 50px; height: 50px; cursor: pointer"
								fit="contain"
								priority="visible"
								@mouseenter="boostProductImages(scope.row)"
							/>
						</template>
						<template #default>
							<div
								style="display: flex; overflow-x: auto; gap: 10px; padding: 10px 0"
							>
								<template v-for="i in 6" :key="i">
									<resilient-product-image
										v-if="scope.row[`image_url${i === 1 ? '' : i}`]"
										:src="
											convert_image_url(
												scope.row[`image_url${i === 1 ? '' : i}`]
											)
										"
										style="
											width: 200px;
											height: 200px;
											flex-shrink: 0;
											cursor: pointer;
										"
										fit="contain"
										priority="hover"
										@click="
											swapMainImage(scope.row, `image_url${i === 1 ? '' : i}`)
										"
									/>
								</template>
							</div>
						</template>
					</el-popover>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert">
			<template #slot-calculate="{ scope }">
				<cl-flex1 />
				<el-row>
					<el-button @click="calculate()">计算</el-button>
				</el-row>
			</template>

			<template #slot-describe="{ scope }">
				<div>
					<el-form-item v-for="(item, index) in scope.describe" :key="index">
						<el-dropdown trigger="click">
							<el-button>
								选择描述类型
								<el-icon class="el-icon--right">
									<arrow-down />
								</el-icon>
							</el-button>
							<template #dropdown>
								<el-dropdown-menu>
									<el-dropdown-item @click="selectType('color', index)"
										>颜色</el-dropdown-item
									>
									<el-dropdown-item @click="selectType('quantity', index)"
										>数量</el-dropdown-item
									>
									<el-dropdown-item @click="selectType('style', index)"
										>风格</el-dropdown-item
									>
									<el-dropdown-item @click="selectType('capacity', index)"
										>容量</el-dropdown-item
									>
								</el-dropdown-menu>
							</template>
						</el-dropdown>
						<el-input v-model="item.describe1" :placeholder="`请填写描述 ${index + 1}`">
							<template #append>
								<el-button @click="DeleteRowDescribe(index)">
									<el-icon>
										<delete />
									</el-icon>
								</el-button>
							</template>
						</el-input>
					</el-form-item>
					<el-row>
						<el-button @click="addRowDescribe()">添加描述</el-button>
					</el-row>
				</div>
			</template>

			<template #slot-produce_name="{ scope }">
				<!-- 在产品名称字段旁添加按钮 -->
				<el-form-item label="产品名称" prop="produce_name">
					<el-input v-model="scope.produce_name" placeholder="输入产品名称">
						<template #append>
							<el-button @click="handleAutoSave">生成SKU</el-button>
						</template>
					</el-input>
				</el-form-item>
				<el-form-item label="SKU" prop="sku">
					<el-input v-model="scope.sku">
						<template #append>
							<el-button @click="handleAsinModeChange">同步到ASIN</el-button>
						</template>
					</el-input>
				</el-form-item>
			</template>

			<!-- 其他字段配置保持不变 -->
			<template #slot-factory_links="{ scope }">
				<div class="factory-links-section">
					<!-- 工厂链接表格 -->
					<div class="section-header">
						<div class="action-buttons">
							<el-button type="primary" @click="addGroup('main')"
								>添加主体组</el-button
							>
							<el-button type="success" @click="addGroup('accessory')"
								>添加配件组</el-button
							>
							<el-button type="warning" @click="addGroup('packing')"
								>添加包装组</el-button
							>
						</div>
					</div>

					<!-- 工厂链接表格 -->
					<el-table
						:data="groupedFactoryLinks"
						border
						style="width: 100%"
						:span-method="linkSpanMethod"
					>
						<el-table-column label="类型" prop="type" width="120" align="center">
							<template #default="{ row }">
								<div style="display: flex; align-items: center">
									<el-tag :type="getTypeTagType(row.type)">
										{{ getTypeLabel(row.type) }}
									</el-tag>
									<el-button
										v-if="row.isFirst"
										type="text"
										icon="DocumentCopy"
										@click="openCopyDialog(row)"
										style="margin-left: 5px"
										>复制</el-button
									>
								</div>
							</template>
						</el-table-column>

						<el-table-column label="品名" prop="name" width="200" align="center">
							<template #default="{ row }">
								<el-input
									v-model="row.name"
									placeholder="输入品名"
									size="small"
									@input="handleNameInput(row)"
									:disabled="row.locked"
								/>
							</template>
						</el-table-column>

						<el-table-column label="价格" prop="price" width="120" align="center">
							<template #default="{ row }">
								<el-input
									v-model="row.price"
									:precision="2"
									controls-position="right"
									size="small"
									:disabled="row.locked"
								/>
							</template>
						</el-table-column>

						<el-table-column label="链接" prop="user_input" align="center">
							<template #default="{ row }">
								<el-input
									v-model="row.user_input"
									placeholder="输入工厂链接"
									size="small"
									:disabled="row.locked"
								/>
							</template>
						</el-table-column>

						<el-table-column
							label="链接描述"
							prop="user_input_description"
							align="center"
						>
							<template #default="{ row }">
								<el-input
									v-model="row.user_input_description"
									placeholder="输入工厂链接描述"
									size="small"
									:disabled="row.locked"
								/>
							</template>
						</el-table-column>

						<el-table-column label="操作" width="120" align="center">
							<template #default="{ row, $index }">
								<el-button
									v-if="row.isFirst"
									type="success"
									circle
									size="small"
									@click="addAlternativeLink(row.groupId)"
									title="添加备选"
									:disabled="row.locked"
									>+</el-button
								>
								<el-button
									type="danger"
									circle
									size="small"
									@click="removeLink(row.groupId, row.id)"
									title="删除"
									:disabled="row.locked"
									>-</el-button
								>
							</template>
						</el-table-column>
					</el-table>

					<!-- 变体管理表格 -->
					<div class="section-header" style="margin-top: 20px">
						<el-text type="primary" size="large">变体管理</el-text>
					</div>

					<el-table :data="scope.variant_Combination" border style="width: 100%">
						<el-table-column label="选择" width="60" align="center">
							<template #default="{ row }">
								<el-checkbox v-model="row.selected" />
							</template>
						</el-table-column>

						<el-table-column label="变体名称" width="150" align="center">
							<template #default="{ row }">
								<el-input
									v-model="row.name"
									placeholder="变体名称"
									size="small"
									:disabled="row.locked"
								/>
							</template>
						</el-table-column>

						<el-table-column label="变体图片" width="200" align="center">
							<template #default="{ row }">
								<div class="image-container">
									<!-- 图片预览（选择后立即替换） -->
									<el-popover placement="right" trigger="hover" :width="350">
										<template #reference>
											<div class="thumbnail-wrapper" @mouseenter="() => loadCompetitorImages(scope.id, row)">
												<!-- 选择图片后，row.image_url 会变成 base64，自动显示新图片 -->
												<resilient-product-image
													v-if="row.image_url"
													:src="row.image_url"
													alt="变体图片"
													class="preview-img"
													referrerpolicy="no-referrer"
													priority="visible"
												/>
												<div v-else class="no-image">无图</div>
											</div>
										</template>
										<template #default>
											<div style="text-align: center">
												<resilient-product-image
													v-if="row.image_url"
													:src="row.image_url"
													class="popover-image"
													alt="变体图片预览"
													referrerpolicy="no-referrer"
													style="margin-bottom: 10px; max-width: 100%;"
													priority="hover"
												/>
												<div v-else style="padding: 10px">暂无图片</div>

												<div v-if="row._competitorImages && row._competitorImages.length > 0" class="competitor-images-section" style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
													<div style="font-size: 12px; color: #666; margin-bottom: 8px; text-align: left;">从竞品选择:</div>
													<div style="display: flex; flex-wrap: wrap; gap: 5px; justify-content: flex-start;">
														<resilient-product-image
															v-for="(img, idx) in row._competitorImages"
															:key="idx"
															:src="img"
															referrerpolicy="no-referrer"
															style="width: 50px; height: 50px; object-fit: contain; cursor: pointer; border: 1px solid #ddd; border-radius: 4px;"
															priority="hover"
															@click="row.image_url = img"
															title="点击选择该图片"
														/>
													</div>
												</div>
												<div v-else-if="row._loadingImages" style="font-size: 12px; color: #999; margin-top: 10px;">
													加载竞品图片中...
												</div>
											</div>
										</template>
									</el-popover>

									<!-- 本地图片选择组件（直接读取本地文件，不经过后端上传） -->
									<div class="upload-container">
										<!-- 用原生文件输入框配合自定义样式，实现本地图片选择 -->
										<label class="custom-upload-btn" :disabled="row.locked">
											<input
												type="file"
												accept="image/*"
												@change="(e) => handleLocalImageSelect(e, row)"
												:disabled="row.locked"
												hidden
											/>
											<span class="btn-text">{{
												row.image_url ? "更换" : "选择图片"
											}}</span>
										</label>
										<br />

										<!-- 可选：隐藏URL输入框（因为现在用本地图片，不需要URL了） -->
										<!-- 如果仍需要保留URL输入，可继续保留，输入后会覆盖本地图片 -->
										<el-input
											v-model="row.image_url"
											size="mini"
											placeholder="或输入图片URL"
											:disabled="row.locked"
											class="url-input"
											style="margin-top: 5px"
										/>
									</div>
								</div>
							</template>
						</el-table-column>

						<el-table-column label="工厂链接组合" width="300" align="center">
							<template #default="{ row }">
								<el-select
									v-model="row.selectedGroups"
									multiple
									placeholder="选择品名"
									style="width: 100%"
									:disabled="row.locked"
									@change="() => ensureVariantGroupProportions(row)"
								>
									<el-option
										v-for="group in uniqueProductNames"
										:key="group.name"
										:label="`${getTypeLabel(group.type)}: ${group.name}`"
										:value="group.name"
									/>
								</el-select>
								<div style="margin-top: 8px; display: flex; flex-direction: column; gap: 5px;">
									<el-input
										v-model="row.uk_title"
										placeholder="英国标题"
										size="small"
										:disabled="row.locked"
									>
										<template #prepend>UK</template>
									</el-input>
									<el-input
										v-model="row.de_title"
										placeholder="德国标题"
										size="small"
										:disabled="row.locked"
									>
										<template #prepend>DE</template>
									</el-input>
								</div>
							</template>
						</el-table-column>

						<el-table-column label="变体描述" width="150" align="center">
							<template #default="{ row }">
								<el-input
									v-model="row.description"
									placeholder="变体描述"
									size="small"
									:disabled="row.locked"
								/>
							</template>
						</el-table-column>

						<el-table-column label="数量" width="200" align="center">
							<template #default="{ row }">
								<div
									v-if="row.selectedGroups && row.selectedGroups.length > 0"
									class="proportion-container"
								>
									<div
										v-for="(productName, index) in row.selectedGroups"
										:key="index"
										class="proportion-item"
									>
										<el-tooltip :content="productName" placement="top">
											<el-input
												v-model="row.groupProportions[productName]"
												min="1"
												controls-position="right"
												size="small"
												placeholder="数量"
												style="width: 35px"
												:disabled="row.locked"
											/>
										</el-tooltip>
									</div>
								</div>
							</template>
						</el-table-column>

						<el-table-column label="操作" width="150" align="center">
							<template #default="{ row, $index }">
								<el-button
									type="danger"
									icon="Delete"
									circle
									size="small"
									@click="deleteVariant(scope, $index)"
									:disabled="row.locked"
								/>
								<el-tooltip
									:content="row.locked ? '已锁定' : '未锁定'"
									placement="top"
								>
									<el-button type="text" :icon="row.locked ? 'Lock' : 'Unlock'">
										{{ row.locked ? "已锁定" : "可编辑" }}
									</el-button>
								</el-tooltip>
							</template>
						</el-table-column>
					</el-table>

					<el-button type="primary" @click="addVariant(scope)" style="margin-top: 10px">
						添加变体
					</el-button>
				</div>
			</template>

			<template #slot-btns="{ scope }">
				<el-button
					type="success"
					:loading="isFileUploading"
					:disabled="isFileUploading"
					@click="Upsert?.submit(scope)"
				>
					保存
				</el-button>
			</template>

			<template #slot-purchaserNum="{ scope }">
				<div>
					<el-form-item v-for="(item, index) in scope.purchaserNum" :key="index">
						<el-input
							v-model="item.purchaser2"
							:placeholder="`请填写采购数量 ${index + 1}`"
						>
							<template #append>
								<el-button @click="DeleteRowPurchaserNum(index)">
									<el-icon>
										<delete />
									</el-icon>
								</el-button>
							</template>
						</el-input>
					</el-form-item>
					<el-row>
						<el-button @click="addRowPurchaserNum()">添加采购数量</el-button>
					</el-row>
				</div>
			</template>

			<template #slot-purchaser="{ scope }">
				<div>
					<el-form-item v-for="(item, index) in scope.purchaser" :key="index">
						<el-input
							v-model="item.purchaser1"
							:placeholder="`采购人 ${index + 1}`"
							disabled
						>
							<template #append> </template>
						</el-input>
					</el-form-item>
				</div>
			</template>

			<template #slot-purchaserid="{ scope }">
				<div>
					<el-form-item v-for="(item, index) in scope.purchasersid" :key="index">
						<el-input
							v-model="item.purchaserid"
							:placeholder="`采购人id ${index + 1}`"
							hidden
						>
							<template #append> </template>
						</el-input>
					</el-form-item>
				</div>
			</template>

			<template #slot-primary="{ scope }">
				<template v-if="isEditMode">
					<el-row style="margin-bottom: 20px">
						<el-col :span="24">
							<el-card shadow="never" body-style="padding:12px">
								<div v-for="market in ['UK', 'DE', 'FR', 'ES', 'IT']" :key="market">
									<!-- 国家标题 -->
									<el-text
										type="primary"
										size="large"
										tag="strong"
										class="market-title"
									>
										{{ getMarketName(market) }}
									</el-text>

									<!-- 数据表格 - 仅调整列宽分配，不改变原有样式 -->
									<div class="compact-data-grid">
										<!-- FBA 数据（变宽 + 拆分为左右两列） -->
										<div class="data-column fba-wide-column">
											<el-text type="primary" class="column-title"
												>FBA</el-text
											>
											<!-- FBA 左右分栏（仅为容纳13个指标，不改变原有样式） -->
											<div style="display: flex; gap: 16px; margin-top: 8px">
												<!-- FBA 左列（7行） -->
												<div style="flex: 1">
													<div class="data-line">
														<span>日均销量：</span>
														<template v-if="market !== 'EU'">
															{{
																formatNumber(
																	scope.delivery_volumes?.[market]
																		?.FBA?.total || 0
																)
															}}
														</template>
													</div>
													<div class="data-line">
														<span>日/人均销量（剔除最大值）：</span>
														<template v-if="market !== 'EU'">
															{{
																scope.delivery_volumes?.[market]
																	?.FBA?.count > 1
																	? formatNumber(
																			scope
																				.delivery_volumes?.[
																				market
																			]?.FBA
																				?.avgDailySalesExcludeMax
																		)
																	: "0"
															}}
														</template>
													</div>
													<div class="data-line">
														<span>日/人均销量 </span>
														<template v-if="market !== 'EU'">
															{{
																scope.delivery_volumes?.[market]
																	?.FBA?.count > 0
																	? formatNumber(
																			scope
																				.delivery_volumes?.[
																				market
																			]?.FBA
																				?.avgDailySalesPerAsin
																		)
																	: "0"
															}}
														</template>
													</div>
													<div class="data-line">
														<span>ASIN数量：</span>
														<template v-if="market !== 'EU'">
															{{
																formatNumber(
																	scope.delivery_volumes?.[market]
																		?.FBA?.count
																)
															}}
														</template>
													</div>
													<div class="data-line">
														<span>卖家数量：</span>
														<template v-if="market !== 'EU'">
															{{
																scope.delivery_volumes?.[market]
																	?.FBA?.sellerCount
															}}
														</template>
													</div>
													<div class="data-line">
														<span>最大量单量：</span>
														<template v-if="market !== 'EU'">
															{{
																formatNumber(
																	scope.delivery_volumes?.[market]
																		?.FBA?.max
																)
															}}
														</template>
													</div>
													<div class="data-line compact-price">
														<span>价格区间：</span>
														<template v-if="market !== 'EU'">
															{{
																formatNumber(
																	scope.delivery_volumes?.[market]
																		?.FBA?.min_price
																)
															}}～{{
																formatNumber(
																	scope.delivery_volumes?.[market]
																		?.FBA?.max_price
																)
															}}
														</template>
													</div>
												</div>

												<!-- FBA 右列（6行） -->
												<div style="flex: 1">
													<div class="data-line">
														<span>月销量：</span>
														<template v-if="market !== 'EU'">
															{{
																formatNumber(
																	(scope.delivery_volumes?.[
																		market
																	]?.FBA?.total || 0) *
																		(scope.delivery_volumes?.[
																			market
																		]?.daysInMonth || 30)
																)
															}}
														</template>
													</div>
													<div class="data-line">
														<span>库存数量：</span>
														<template v-if="market !== 'EU'">
															{{
																scope.delivery_volumes?.[market]
																	?.FBA?.stockTotal === "数据不全"
																	? "数据不全"
																	: formatNumber(
																			scope
																				.delivery_volumes?.[
																				market
																			]?.FBA?.stockTotal
																		)
															}}
														</template>
													</div>
													<div class="data-line">
														<span>平均review：</span>
														<template v-if="market !== 'EU'">
															{{
																scope.delivery_volumes?.[market]
																	?.FBA?.avgReview > 0
																	? formatNumber(
																			scope
																				.delivery_volumes?.[
																				market
																			]?.FBA?.avgReview
																		)
																	: "0"
															}}
														</template>
													</div>
													<div class="data-line">
														<span>最大review：</span>
														<template v-if="market !== 'EU'">
															{{
																scope.delivery_volumes?.[market]
																	?.FBA?.maxReview > 0
																	? formatNumber(
																			scope
																				.delivery_volumes?.[
																				market
																			]?.FBA?.maxReview
																		)
																	: "0"
															}}
														</template>
													</div>
													<div class="data-line">
														<span>最低出单review：</span>
														<template v-if="market !== 'EU'">
															{{
																scope.delivery_volumes?.[market]
																	?.FBA?.minReviewWithSales > 0
																	? formatNumber(
																			scope
																				.delivery_volumes?.[
																				market
																			]?.FBA
																				?.minReviewWithSales
																		)
																	: "0"
															}}
														</template>
													</div>
													<div class="data-line">
														<span>库销比（库存/月销）：</span>
														<template v-if="market !== 'EU'">
															{{
																scope.delivery_volumes?.[market]
																	?.FBA?.stockTotal !==
																	"数据不全" &&
																scope.delivery_volumes?.[market]
																	?.FBA?.inventorySalesRatio > 0
																	? formatNumber(
																			scope
																				.delivery_volumes?.[
																				market
																			]?.FBA
																				?.inventorySalesRatio
																		)
																	: "0"
															}}
														</template>
													</div>
												</div>
											</div>
										</div>

										<!-- FBM 数据（宽度缩小一半） -->
										<div class="data-column narrow-column">
											<el-text type="success" class="column-title"
												>FBM</el-text
											>
											<div class="data-line">
												<span>日均销量：</span>
												<template v-if="market !== 'EU'">
													{{
														formatNumber(
															scope.delivery_volumes?.[market]?.FBM
																?.total
														)
													}}
												</template>
											</div>
											<div class="data-line">
												<span>ASIN数量：</span
												>{{
													formatNumber(
														scope.delivery_volumes?.[market]?.FBM?.count
													)
												}}
											</div>
											<div class="data-line">
												<span>卖家总数：</span
												>{{
													scope.delivery_volumes?.[market]?.FBM
														?.sellerCount
												}}
											</div>
											<div class="data-line">
												<span>最大单量：</span
												>{{
													formatNumber(
														scope.delivery_volumes?.[market]?.FBM?.max
													)
												}}
											</div>
											<div class="data-line compact-price">
												<span>价格区间：</span
												>{{
													formatNumber(
														scope.delivery_volumes?.[market]?.FBM
															?.min_price
													)
												}}～{{
													formatNumber(
														scope.delivery_volumes?.[market]?.FBM
															?.max_price
													)
												}}
											</div>
											<div class="data-line">
												<span>月销量：</span>
												<template v-if="market !== 'EU'">
													{{
														formatNumber(
															(scope.delivery_volumes?.[market]?.FBM
																?.total || 0) *
																(scope.delivery_volumes?.[market]
																	?.daysInMonth || 30),
															2
														)
													}}
												</template>
											</div>
											<div class="data-line">
												<span>库存数量：</span>
												<template v-if="market !== 'EU'">
													{{
														scope.delivery_volumes?.[market]?.FBM
															?.stockTotal === "数据不全"
															? "数据不全"
															: formatNumber(
																	scope.delivery_volumes?.[market]
																		?.FBM?.stockTotal
																)
													}}
												</template>
											</div>
										</div>

										<!-- 自营数据（宽度缩小一半） -->
										<div class="data-column narrow-column">
											<el-text type="warning" class="column-title"
												>自营</el-text
											>
											<div class="data-line">
												<span>日均销量：</span>
												<template v-if="market !== 'EU'">
													{{
														formatNumber(
															scope.delivery_volumes?.[market]?.Other
																?.total
														)
													}}
												</template>
											</div>
											<div class="data-line">
												<span>卖家数量：</span
												>{{
													scope.delivery_volumes?.[market]?.Other?.count
												}}
											</div>
											<div class="data-line">
												<span>最大单量：</span
												>{{
													formatNumber(
														scope.delivery_volumes?.[market]?.Other?.max
													)
												}}
											</div>
											<div class="data-line compact-price">
												<span>价格区间：</span
												>{{
													formatNumber(
														scope.delivery_volumes?.[market]?.Other
															?.min_price
													)
												}}～{{
													formatNumber(
														scope.delivery_volumes?.[market]?.Other
															?.max_price
													)
												}}
											</div>
											<div class="data-line">
												<span>月销量：</span>
												<template v-if="market !== 'EU'">
													{{
														formatNumber(
															(scope.delivery_volumes?.[market]?.Other
																?.total || 0) *
																(scope.delivery_volumes?.[market]
																	?.daysInMonth || 30),
															2
														)
													}}
												</template>
											</div>
											<div class="data-line">
												<span>库存数量：</span>
												<template v-if="market !== 'EU'">
													{{
														scope.delivery_volumes?.[market]?.Other
															?.stockTotal === "数据不全"
															? "数据不全"
															: formatNumber(
																	scope.delivery_volumes?.[market]
																		?.Other?.stockTotal
																)
													}}
												</template>
											</div>
										</div>

										<!-- 市场数据（保持原有样式和宽度不变） -->
										<div class="data-column">
											<el-text type="info" class="column-title">市场</el-text>
											<div class="data-line">
												<span>平均单量：</span
												>{{
													formatNumber(
														scope.delivery_volumes?.[market]?.marketAvg
													)
												}}
											</div>
											<div class="data-line">
												<span>平均上架天数：</span
												>{{ scope.delivery_volumes?.[market]?.avgDays }}
											</div>
											<div class="data-line">
												<span>有销量平均天数：</span
												>{{
													scope.delivery_volumes?.[market]
														?.avgDaysWithVolume
												}}
											</div>
											<div class="data-line compact-date">
												<span>最早上架日期：</span
												>{{
													scope.delivery_volumes?.[market]?.earliestDate
												}}
											</div>
											<div class="data-line">
												<span>新品百分比：</span
												>{{
													scope.delivery_volumes?.[
														market
													]?.newProductPercentage?.toFixed(2)
												}}%
											</div>
											<div class="data-line">
												<span>FBA90天内上架ASIN数：</span
												>{{
													scope.delivery_volumes?.[market]
														?.fbaNewAsinCount
												}}
											</div>
											<div class="data-line">
												<span>FBM90天内上架ASIN数：</span
												>{{
													scope.delivery_volumes?.[market]
														?.fbmNewAsinCount
												}}
											</div>
											<div class="data-line">
												<span>新品出单ASIN数：</span
												>{{
													scope.delivery_volumes?.[market]
														?.newProductWithVolumeCount
												}}
											</div>
											<div class="data-line">
												<span>新品销量占总销量的百分比：</span
												>{{
													scope.delivery_volumes?.[
														market
													]?.newProductVolumePercentage?.toFixed(2)
												}}%
											</div>
										</div>
									</div>
								</div>
							</el-card>
						</el-col>
					</el-row>
				</template>
			</template>

			<template #slot-charts="{ scope }">
				<el-row :gutter="20" class="chart-row">
					<el-col
						v-for="country in countries"
						:key="country"
						:span="24"
						class="country-column"
					>
						<div class="country-group">
							<!-- 合并后的销量与关键词图表 -->
							<div class="chart-container">
								<div
									:id="'combined-chart-' + countryCodeMap[country]"
									class="compact-chart"
									style="width: 100%; height: 400px"
								></div>
							</div>
						</div>
					</el-col>
				</el-row>
			</template>

			<template #slot-primary2="{ scope }">
				<template v-if="isEditMode">
					<el-row style="margin-bottom: 20px">
						<el-col :span="24">
							<el-card shadow="never" body-style="padding:12px">
								<div class="node-stats-container">
									<div class="filter-header">
										<el-text type="primary" size="small">
											<el-icon>
												<DataAnalysis />
											</el-icon>
											BSR节点统计(数量/总单量)
										</el-text>
										<el-select
											v-model="selectedMarket"
											size="small"
											style="width: 120px; margin-left: 10px"
											@change="calculateAll"
										>
											<el-option label="所有国家" value="ALL" />
											<el-option label="英国" value="UK" />
											<el-option label="德国" value="DE" />
											<el-option label="法国" value="FR" />
											<el-option label="西班牙" value="ES" />
											<el-option label="意大利" value="IT" />
										</el-select>
									</div>
									<el-divider />

									<template
										v-if="
											selectedMarket === 'ALL' ||
											scope.delivery_volumes?.[selectedMarket]?.nodeStats
												?.length
										"
									>
										<el-row
											:gutter="8"
											class="node-grid"
											:style="{
												'--sm-columns': selectedMarket === 'ALL' ? 2 : 3,
												'--xs-columns': 1
											}"
										>
											<!-- 全部国家显示 -->
											<template v-if="selectedMarket === 'ALL'">
												<el-col
													v-for="market in ['UK', 'DE', 'FR', 'ES', 'IT']"
													:key="market"
													class="node-col"
												>
													<div class="market-section">
														<el-text type="info" size="small">{{
															getMarketName(market)
														}}</el-text>
														<template
															v-if="
																scope.delivery_volumes?.[market]
																	?.nodeStats?.length
															"
														>
															<div
																v-for="(node, index) in scope
																	.delivery_volumes[market]
																	.nodeStats"
																:key="index"
																class="compact-node"
															>
																<el-text size="small">{{
																	node.name
																}}</el-text>
																<el-space>
																	<el-tag size="small">{{
																		node.count
																	}}</el-tag>
																	<el-tag
																		type="info"
																		size="small"
																		>{{
																			Math.round(
																				node.totalVolume
																			)
																		}}</el-tag
																	>
																</el-space>
															</div>
														</template>
														<el-empty
															v-else
															:image-size="40"
															description="无数据"
															style="padding: 5px"
														/>
													</div>
												</el-col>
											</template>

											<!-- 单个国家显示 -->
											<template v-else>
												<el-col
													v-for="(node, index) in scope.delivery_volumes[
														selectedMarket
													]?.nodeStats"
													:key="index"
													class="node-col"
												>
													<div class="compact-node">
														<el-text size="small">{{
															node.name
														}}</el-text>
														<el-space>
															<el-tag size="small">{{
																node.count
															}}</el-tag>
															<el-tag type="info" size="small">{{
																Math.round(node.totalVolume)
															}}</el-tag>
														</el-space>
													</div>
												</el-col>
											</template>
										</el-row>
									</template>

									<el-empty
										v-else
										description="暂无节点统计数据"
										:image-size="60"
										style="padding: 10px"
									/>
								</div>
							</el-card>
						</el-col>
					</el-row>
				</template>
			</template>

			<template #slot-competitor_apply>
				<el-card shadow="never" class="competitor-apply">
					<div class="header">
						<el-text type="primary" size="large">竞品参数应用</el-text>
						<el-select
							v-model="competitorFilterCountry"
							placeholder="选择国家"
							size="small"
							style="width: 120px; margin-left: 20px"
							@change="handleCompetitorCountryChange"
						>
							<el-option label="全部" value="" />
							<el-option
								v-for="country in countryOptions"
								:key="country.value"
								:label="country.label"
								:value="country.value"
							/>
						</el-select>
					</div>
					<el-table
						:data="filteredCompetitors"
						height="300px"
						border
						highlight-current-row
					>
						<el-table-column label="ASIN" width="130">
							<template #default="{ row }">
								<el-link
									target="_blank"
									:underline="false"
									@click.prevent="openProductLinks3(row)"
								>
									{{ row.asin_competitor }}
								</el-link>
							</template>
						</el-table-column>

						<el-table-column label="图片" width="130">
							<template #default="{ row }">
								<el-popover
									placement="right"
									trigger="hover"
									:width="row.image_url_display ? 300 : 0"
								>
									<template #reference>
										<resilient-product-image
											:src="row.image_url_display"
											style="width: 70px; height: 70px"
											fit="contain"
											:preview-src-list="[row.image_url_display]"
											hide-on-click-modal
											priority="visible"
										>
										</resilient-product-image>
									</template>
									<resilient-product-image
										:src="row.image_url_display"
										style="max-width: 280px; height: auto; border-radius: 4px"
										priority="hover"
									/>
								</el-popover>
							</template>
						</el-table-column>

						<!-- <<el-table-column prop="image_url_display"  label="图片" width="130"/> -->
						<el-table-column prop="dispatches_type" label="配送类型" width="110" sortable>
							<template #default="{ row }">
								<el-tag
									:type="dispatchTypeDict[row.dispatches_type]?.type"
									effect="plain"
								>
									{{ dispatchTypeDict[row.dispatches_type]?.label || "未知" }}
								</el-tag>
							</template>
						</el-table-column>

						<!-- <el-table-column prop="dispatches_type" label="配送类型" width="100"/> -->

						<el-table-column prop="Main_monthly_sales" label="父体销量" width="110" sortable />
						<el-table-column prop="marketplace" label="国家" width="80" />
						<el-table-column label="尺寸（cm）" width="150">
							<template #default="{ row }">
								{{ parseDimensions(row.dimensions)?.join(" × ") || "-" }}
							</template>
						</el-table-column>
						<el-table-column label="重量（kg）" width="100">
							<template #default="{ row }">
								{{ row.weight ? (parseFloat(row.weight) / 1000).toFixed(3) : "-" }}
							</template>
						</el-table-column>
						<el-table-column label="本地售价" width="100">
							<template #default="{ row }">
								{{ row.price }}
							</template>
						</el-table-column>
						<el-table-column label="配送费" width="100">
							<template #default="{ row }">
								{{ row.FBA_price || "-" }}
							</template>
						</el-table-column>
						<el-table-column label="操作" width="120" fixed="right">
							<template #default="{ row }">
								<el-button
									type="primary"
									size="small"
									@click="applyDimensionsAndWeight(row)"
								>
									应用尺寸重量
								</el-button>
								<br />
								<el-button
									type="success"
									size="small"
									@click="applyPriceAndDelivery(row)"
								>
									应用售价运费
								</el-button>
							</template>
						</el-table-column>
					</el-table>
				</el-card>
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

						<!-- 在保存按钮处绑定点击事件 -->
						<el-button type="primary" @click="handleSubmit" :loading="isSubmitting">
							保存利润数据
						</el-button>
						<el-button
							type="primary"
							@click="autoAdaptLocalPrice"
							:loading="isAdaptingPrice"
						>
							适配本地售价
						</el-button>
						<el-button
							type="primary"
							@click="calculateDeliveryFee"
							:loading="isCalculatingFees"
						>
							计算配送费
						</el-button>
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

		<el-drawer v-model="competitorManagementPaneVisible" size="90%" direction="ltr">
			<bsr-candidate-competitor-component :candidate="curEditingBsrCandidate" />
		</el-drawer>
		<el-drawer v-model="keywordManagementPaneVisible" size="90%" direction="ltr">
			<listing-keyword :listing="curEditingListing"></listing-keyword>
		</el-drawer>

		<cl-dialog v-model="jsonViewerDialogVisible" align-center>
			<cl-editor-monaco
				v-model="jsonViewerContent"
				language="json"
				:height="800"
				disabled
			></cl-editor-monaco>
			<template #footer>
				<el-button size="large" @click="jsonViewerDialogVisible = false">OK</el-button>
			</template>
		</cl-dialog>
	</cl-crud>
</template>

<script lang="ts" name="app-bsr-candidate" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { uuid } from "/@/cool/utils";
import { useCool } from "/@/cool";
import {
	convert_image_url,
	ensureCandidateIds,
	is_admin,
	normalizeCandidateLinkVariants,
	validateBsrCandidateVariants
} from "/$/app/utils";
import { boostProductImages, preloadProductImages } from "/$/app/utils/product-image-loading";
import ResilientProductImage from "/$/app/components/resilient-product-image.vue";
import { Delete, EditPen, GoodsFilled, Memo } from "@element-plus/icons-vue";
import { ref, watch, reactive } from "vue";
import { appConfig } from "../../../../../appConfig";
import ClCrud from "/~/crud/src/components/crud";
import ClRow from "/~/crud/src/components/row";
import ClDialog from "/~/crud/src/components/dialog";
import ClTableColumnBsrHtml from "/$/app/components/cl-table-column-bsr-html.vue";
import ClTableColumnBsrLink from "/$/app/components/cl-table-column-bsr-link.vue";
import ClTableColumnBulletPoints from "/$/app/components/cl-table-column-bullet-points.vue";
import BatchUpdateBsrCandidateStatus from "/$/app/components/batch-update-bsr-candidate-status.vue";
import BsrCandidateCompetitorComponent from "/$/app/components/bsr-candidate-competitor-component.vue";
import BatchUpdateCompetitorSpiderStatus from "/$/app/components/batch-update-competitor-spider-status.vue";
import BsrCandidateFilterStatus from "/$/app/components/bsr-candidate-filter-status.vue";
import BatchOpenDpLink from "/$/app/components/batch-open-dp-link.vue";
import { computed, nextTick } from "vue";
import { onMounted, onUnmounted } from "vue";
import * as echarts from "echarts";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import ListingKeyword from "/$/app/components/listing-keyword.vue";
import { ElLoading, ElMessage, ElMessageBox } from "element-plus";
import pinyin from "pinyin";

const keywordManagementPaneVisible = ref(false);
const curEditingListing = ref();

const { service } = useCool();

import { useUserStore } from "/$/base/store/user";
import upsert from "/~/crud/src/components/upsert";
import { status } from "nprogress";

const userStore = useUserStore();
const departmentId = userStore.info?.departmentId;

const filterStatus = reactive({
	competitor_import: "", // 竞品导入状态
	profit_calculation: "", // 利润计算状态
	competitor_full: "", // 竞品全拥有
	keyword_import: "", // 关键词导入
	UKDEStatus: ""
});

const Crud = useCrud(
	{
		service: service.app.bsr_candidate,
		async onRefresh(params, { next, done, render }) {
			if (showOnlyStatusLibrary.value)
				Object.assign(params, { status: appConfig.BSR_CANDIDATE_STATUS.LIBRARY.value });
			if (filterStatus.competitor_import)
				Object.assign(params, { competitor_import_status: filterStatus.competitor_import });
			if (filterStatus.profit_calculation)
				Object.assign(params, {
					profit_calculation_status: filterStatus.profit_calculation
				});
			if (filterStatus.competitor_full)
				Object.assign(params, {
					competitor_full_ownership_status: filterStatus.competitor_full
				});
			if (filterStatus.keyword_import)
				Object.assign(params, { keyword_import_status: filterStatus.keyword_import });
			if (filterStatus.UKDEStatus)
				Object.assign(params, { UKDEStatus: filterStatus.UKDEStatus });
			// params.competitor_import = filterStatus.competitor_import;
			// params.profit_calculation = filterStatus.profit_calculation;
			// params.competitor_full = filterStatus.competitor_full;
			// params.keyword_import = filterStatus.keyword_import;
			const { list } = await next({
				...params
			});

			const rows = Table.value?.data?.length ? Table.value.data : list || [];
			rows.forEach((item) => {
				item.image_url_display = convert_image_url(item.image_url);
				if (item.delivery_volumes) {
					item.fba_max_price = item.delivery_volumes.FBA?.max_price || 0;
					item.fba_min_price = item.delivery_volumes.FBA?.min_price || 0;
					item.fbm_max_price = item.delivery_volumes.FBM?.max_price || 0;
					item.fbm_min_price = item.delivery_volumes.FBM?.min_price || 0;
				}
			});
			preloadProductImages(rows, { reason: "bsr-candidate" });
		}
	},
	(app) => {
		app.refresh();
	}
);
const showOnlyStatusLibrary = ref(true);

const competitor_import_status = ref(false);
const profit_calculation_status = ref(false);
const competitor_full_ownership_status = ref(false);
const keyword_import_status = ref(false);

watch([showOnlyStatusLibrary], () => void setTimeout(Crud?.value?.refresh(), 200));

watch(
	() => [
		showOnlyStatusLibrary.value,
		filterStatus.competitor_import,
		filterStatus.profit_calculation,
		filterStatus.competitor_full,
		filterStatus.keyword_import,
		filterStatus.UKDEStatus
	],
	() => {
		setTimeout(() => Crud?.value?.refresh(), 200);
	},
	{ deep: true }
);

const Table = useTable({
	columns: [
		{ type: "selection" },
		{ label: "ASIN", prop: "asin", minWidth: 100, fixed: "left", showOverflowTooltip: true },
		{
			label: "图片",
			prop: "image_url_display",
			component: {
				name: "cl-image",
				props: { size: 50, fit: "contain", referrerpolicy: "no-referrer" }
			},
			fixed: "left"
		},
		{
			label: "产品标题",
			prop: "item_name",
			showOverflowTooltip: true,
			minWidth: 100,
			fixed: "left"
		},
		{
			label: "产品名称",
			prop: "produce_name",
			minWidth: 50,
			showOverflowTooltip: true,
			fixed: "left"
		},
		{ label: "sku", prop: "sku", minWidth: 50, showOverflowTooltip: true, fixed: "left" },
		{
			label: "状态",
			prop: "status",
			dict: [
				{
					label: "待入库",
					value: appConfig.BSR_CANDIDATE_STATUS.PENDING.value,
					type: "primary"
				},
				{
					label: "待精选",
					value: appConfig.BSR_CANDIDATE_STATUS.LIBRARY.value,
					type: "warning"
				},
				{
					label: "已精选",
					value: appConfig.BSR_CANDIDATE_STATUS.LIBRARY2.value,
					type: "success"
				},
				{
					label: "已归档",
					value: appConfig.BSR_CANDIDATE_STATUS.ARCHIVED.value,
					type: "info"
				}
			],
			width: 80,
			showOverflowTooltip: true,
			sortable: "custom"
		},
		{ label: "BSR 链接", prop: "bsr_link", minWidth: 50, showOverflowTooltip: true },
		{ label: "价格", prop: "price", minWidth: 70, sortable: "custom" },
		{ label: "评论数量", prop: "review_num", minWidth: 50, sortable: "custom" },
		{
			label: "星级",
			prop: "last_star",
			minWidth: 60,
			sortable: "custom"
		},
		{
			label: "状态汇总",
			prop: "status_group",
			minWidth: 120,
			formatter(row) {
				// 将数字状态转换为符号的函数
				const format = (val) => (val === "1" ? "√" : "x");

				return [
					`竞品已导入: ${format(row.competitor_import_status)}`,
					`英德已导入: ${format(row.UKDEStatus)}`,
					`利润已计算: ${format(row.profit_calculation_status)}`,
					`竞品全拥有: ${format(row.competitor_full_ownership_status)}`,
					`关键词导入: ${format(row.keyword_import_status)}`
				].join("\n"); // 使用换行符分隔
			}
		},
		{
			label: "配送类型",
			prop: "_distribution_type",
			minWidth: 60,
			formatter(row, column, value, index) {
				return appConfig.estimate_distribution_type(row.dispatches_from, row.sold_by);
			}
		},
		{ label: "卖点", prop: "bullet_points", minWidth: 70 },
		{ label: "BSR", prop: "bsr_html", minWidth: 200, sortable: "custom" },

		{
			label: "尺寸",
			prop: "dimensions",
			showOverflowTooltip: true,
			width: 50,
			sortable: "custom"
		},
		{
			label: "重量",
			prop: "weight",
			showOverflowTooltip: true,
			minWidth: 50,
			sortable: "custom"
		},
		{
			label: "上架时间",
			prop: "date_first_available",
			sortable: "custom",
			minWidth: 120,
			component: { name: "cl-date-text", props: { format: "YYYY-MM-DD" } }
		},

		{
			label: "配送方*",
			prop: "dispatches_from",
			minWidth: 80,
			sortable: "custom",
			hidden: !is_admin.value,
			showOverflowTooltip: true
		},
		{
			label: "售卖方*",
			prop: "sold_by",
			minWidth: 100,
			sortable: "custom",
			hidden: !is_admin.value,
			showOverflowTooltip: true
		},
		{ label: "卖家国家", prop: "seller_country", minWidth: 50 },

		{
			label: "竞品",
			children: [
				{
					label: "状态",
					prop: "competitor_spider_status",
					dict: [
						{ label: "待调研", value: 0, type: "info" },
						{ label: "调研中", value: 1, color: "purple" },
						{ label: "已调研", value: 2, type: "success" }
					],
					width: 80,
					sortable: "custom"
				},
				{
					label: "爬虫数据*",
					prop: "competitor_spider_res",
					width: 95,
					hidden: !is_admin.value
				},
				{
					label: "调研日期*",
					prop: "competitor_spider_time",
					sortable: "custom",
					minWidth: 160,
					component: { name: "cl-date-text" },
					hidden: !is_admin.value
				}
			]
		},

		{
			label: "补充信息",
			children: [
				{ label: "成本", prop: "cost_price", minWidth: 90, sortable: "custom" },
				{ label: "售价", prop: "selling_price", minWidth: 90, sortable: "custom" },
				{ label: "抛重", prop: "dimensional_weight", minWidth: 90, sortable: "custom" },
				{ label: "实重", prop: "actual_weight", minWidth: 90, sortable: "custom" },
				{ label: "头程运费", prop: "first_leg_freight", minWidth: 140, sortable: "custom" },
				{ label: "FBA 配送费", prop: "fba_freight", minWidth: 140, sortable: "custom" },
				{ label: "汇率", prop: "exchange_rate", minWidth: 140 },
				{ label: "税率", prop: "tax_rate", minWidth: 140 },

				{ label: "毛利率", prop: "gross_profit_rate", minWidth: 140, sortable: "custom" },
				{ label: "毛利润", prop: "gross_profit", minWidth: 140, sortable: "custom" },
				{
					label: "专利情况",
					prop: "patent_memo",
					showOverflowTooltip: true,
					minWidth: 200
				},
				{
					label: "开发意见",
					prop: "opinion_dev",
					showOverflowTooltip: true,
					minWidth: 200
				},
				{
					label: "运营意见",
					prop: "opinion_operator",
					showOverflowTooltip: true,
					minWidth: 200
				},
				{
					label: "采购意见",
					prop: "opinion_procurement",
					showOverflowTooltip: true,
					minWidth: 200
				},
				// {
				//   label: '工厂链接', prop: 'factory_links', showOverflowTooltip: true, minWidth: 200,
				//   formatter(row, column, value, index) {
				//     // return value?.map(item => item.user_input).join(',')
				//   }
				// },
				{
					label: "专利查询截图",
					prop: "keyword_screenshots",
					component: { name: "cl-image", props: { size: 50, fit: "contain" } }
				}
			]
		},

		{ label: "开发人员", prop: "distinguish", minWidth: 90 },
		{
			label: "收录时间",
			prop: "createTime",
			minWidth: 160,
			component: { name: "cl-date-text" },
			sortable: "desc"
		},
		{
			label: "更新时间",
			prop: "updateTime",
			minWidth: 160,
			component: { name: "cl-date-text" },
			sortable: "custom"
		},

		{
			type: "op",
			buttons: ["slot-management-buttons"],
			width: 120
		}
	],
	contextMenu: []
});

let isHidden1 = false;
let isHidden2 = false;
// if(departmentId === 2){
//   isHidden1 = true;
// }
// if(departmentId === 3){
//   isHidden2 = true;
// }

const generateSKU = (produceName: string) => {
	const productInitials = pinyin(produceName, { style: pinyin.STYLE_FIRST_LETTER })
		.map((arr) => arr[0].toUpperCase())
		.join("")
		.substring(0, 5);

	const now = new Date();
	const datePart = [
		now.getFullYear(),
		(now.getMonth() + 1).toString().padStart(2, "0"),
		now.getDate().toString().padStart(2, "0")
	].join("");

	const userInitials = pinyin(userStore.info?.name || "", {
		style: pinyin.STYLE_FIRST_LETTER
	})
		.map((arr) => arr[0].toUpperCase())
		.join("");

	return `${productInitials}-${datePart}-${userInitials}`;
};

const handleAutoSave = () => {
	try {
		// 生成SKU并更新表单
		const sku = generateSKU(Upsert.value?.form.produce_name);
		// 仅更新必要字段（参考网页4的成本控制思路）
		const res = service.app.bsr_candidate.update({
			id: Upsert.value?.form.id,
			produce_name: Upsert.value?.form.produce_name,
			sku: sku,
			skipVersionUpdate: true // 关键：跳过版本号更新
		});
		Upsert.value.form.sku = sku;

		ElMessage.success("自动保存成功");
	} catch (e) {
		ElMessage.error("自动保存失败");
	}
};

// 模式切换处理
const handleAsinModeChange = () => {
	if (!Upsert.value.form.sku) {
		ElMessage.warning("请先生成SKU");
		asinMode.value = "manual";
		return;
	}
	Upsert.value.form.asin = Upsert.value.form.sku;
};

const isFileUploading = ref(false);
const Upsert = useUpsert({
	dialog: {
		width: "1200",
		top: "10vh"
	},
	async onInfo(data, { next, done }) {
		let newData = await next(data);
		const { factory_links, variant_Combination } = normalizeCandidateLinkVariants(newData);

		// 自动填补变体中为空的英德标题
		if (newData.id && variant_Combination && variant_Combination.length > 0) {
			let ukTitle = '';
			let deTitle = '';
			let fetched = false;

			for (const v of variant_Combination) {
				if (!v.uk_title || !v.de_title) {
					if (!fetched) {
						try {
							[ukTitle, deTitle] = await Promise.all([
								getHighestSalesCompetitorTitle(newData.id, '英国'),
								getHighestSalesCompetitorTitle(newData.id, '德国')
							]);
							fetched = true;
						} catch (error) {
							console.error('获取竞品标题失败:', error);
						}
					}
					if (!v.uk_title && ukTitle) v.uk_title = ukTitle;
					if (!v.de_title && deTitle) v.de_title = deTitle;
				}
			}
		}

		// 新增：获取配送类型销量数据
		const deliveryVolumes = isEditMode.value
			? await calculateDeliveryVolumes(newData.id)
			: null;
		console.log("Delivery Volumes:", deliveryVolumes); // 添加日志

		done({
			...newData,
			delivery_volumes: deliveryVolumes,
			factory_links: factory_links.length > 0 ? factory_links : [{ user_input: "" }],
			variant_Combination,
			describe: newData.describe || [{ describe1: "" }],
			image_url_display: convert_image_url(newData.image_url)
		});
	},
	items: [
		{
			prop: "basic_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "选品信息",
					expand: computed(() => !isEditMode.value),
					isExpand: true
				}
			},
			children: [
				{
					label: "ASIN",
					prop: "asin",
					component: {
						name: "el-input",
						props: {
							// disabled: computed(() => isEditMode.value)  // 编辑时禁用
						}
					},
					span: 12
				},
				{
					label: "国家",
					prop: "marketplace",
					component: {
						name: "el-input",
						props: {
							// disabled: computed(() => isEditMode.value)  // 编辑时禁用
						}
					},
					span: 12
				},
				{
					label: "来源",
					prop: "source",
					component: {
						name: "el-select",
						options: [
							{ label: "数据选品", value: 1 },
							{ label: "1688选品", value: 2 },
							{ label: "新增变体", value: 3 },
							{ label: "季节性产品", value: 4 }
						]
					},
					span: 12 // 根据布局需要设置
				},
				{
					label: "备注",
					prop: "remark",
					component: {
						name: "el-input",
						props: {
							// disabled: computed(() => isEditMode.value)  // 编辑时禁用
						}
					},
					span: 12
				},
				{
					label: "主图",
					prop: "image_url",
					component: {
						name: "el-input",
						props: {
							// 核心配置
							modelValue: "", // 双向绑定值
							placeholder: "请输入图片URL地址",
							clearable: true,

							// 动态控制
							// disabled: computed(() => isEditMode.value),

							// 输入验证
							type: "url",
							pattern: "https?://.*"
						},
						// 值更新处理器
						on: {
							"update:modelValue": (val) => {
								Upsert.value.form.image_url = val;
							}
						}
					},
					span: 24
				},
				{
					label: "产品标题",
					prop: "item_name",
					component: {
						name: "el-input",
						props: {
							type: "textarea",
							autosize: { minRows: 1, maxRows: 6 },
							resize: "none"
							// disabled: computed(() => isEditMode.value)
						}
					}
				},
				{
					label: "评论数",
					prop: "review_num",
					component: { name: "el-input-number", props: {} },
					span: 12
				},
				{
					label: "评价星级",
					prop: "last_star",
					component: { name: "el-rate", props: { "show-score": true } },
					span: 12
				},
				{
					label: "价格",
					prop: "price",
					component: { name: "el-input-number", props: {} },
					span: 12
				},
				{
					label: "BSR排名",
					prop: "bsr_rank",
					component: { name: "el-input-number", props: {} },
					span: 12
				},
				{
					label: "尺寸",
					prop: "dimensions",
					component: { name: "el-input", props: {} },
					span: 12
				},
				{
					label: "重量",
					prop: "weight",
					component: { name: "el-input", props: {} },
					span: 12
				},
				{
					label: "卖家国家",
					prop: "seller_country",
					component: { name: "el-input", props: {} },
					span: 12
				},
				{
					label: "上架时间",
					prop: "date_first_available",
					component: {
						name: "el-date-picker",
						props: { type: "date", valueFormat: "YYYY-MM-DD" }
					},
					span: 12
				}
			]
		},
		{
			label: "状态",
			prop: "status",
			component: {
				name: "el-radio-group",
				options: [
					{ label: "待入库", value: appConfig.BSR_CANDIDATE_STATUS.PENDING.value },
					{ label: "待精选", value: appConfig.BSR_CANDIDATE_STATUS.LIBRARY.value },
					// { label: "已精选", value: appConfig.BSR_CANDIDATE_STATUS.LIBRARY2.value },
					{ label: "已归档", value: appConfig.BSR_CANDIDATE_STATUS.ARCHIVED.value }
				]
			},
			value: appConfig.BSR_CANDIDATE_STATUS.LIBRARY.value,
			required: true
		},

		{
			label: "",
			prop: "produce_name",
			component: { name: "slot-produce_name" }
		},
		//     {
		//   label: '产品名称',
		//   prop: 'produce_name',
		//   component: {
		//     name: 'el-input',
		//     props: {
		//       onBlur: handleAutoSave,
		//       modelModifiers: { debounce: 300 },
		//       placeholder: '输入后自动生成SKU'
		//     }
		//   },
		//   span: 12
		// },
		// { label: 'sku', prop: 'sku', component: { name: 'el-input' }, span: 12 },

		{
			label: "",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 250, fit: "contain" } },
			fixed: "left"
		},
		{
			prop: "charts",
			component: {
				name: "cl-form-card",
				props: {
					label: "数据分析图表",
					expand: false,
					isExpand: true
				}
			},
			children: [{ component: { name: "slot-charts" } }]
		},
		{
			prop: "sale_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "各国销量信息",
					expand: false,
					isExpand: true
				}
			},
			children: [
				{
					component: { name: "slot-primary" }
				}
			]
		},
		{
			prop: "BSR_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "BSR节点信息",
					expand: false,
					isExpand: true
				}
			},
			children: [
				{
					component: { name: "slot-primary2" }
				}
			]
		},

		{
			prop: "jingpin_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "竞品参数应用",
					expand: false,
					isExpand: true
				}
			},
			children: [
				{
					component: { name: "slot-competitor_apply" }
				}
			]
		},
		{
			prop: "jisuan_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "利润、利润率计算",
					expand: false,
					isExpand: true
				}
			},
			children: [
				{
					component: { name: "slot-primary3" }
				}
			]
		},

		{
			prop: "additional_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "补充信息",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "专利情况",
					prop: "patent_memo",
					component: {
						name: "el-input",
						props: { type: "textarea", autosize: { minRows: 2, maxRows: 6 } }
					}
				},
				{
					label: "开发意见",
					prop: "opinion_dev",
					component: {
						name: "el-input",
						props: { type: "textarea", autosize: { minRows: 2, maxRows: 6 } }
					},
					hidden: isHidden2
				},
				{
					label: "运营意见",
					prop: "opinion_operator",
					component: {
						name: "el-input",
						props: { type: "textarea", autosize: { minRows: 2, maxRows: 6 } }
					},
					hidden: isHidden1
				},
				{
					label: "采购意见",
					prop: "opinion_procurement",
					component: {
						name: "el-input",
						props: { type: "textarea", autosize: { minRows: 2, maxRows: 6 } }
					},
					hidden: true
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
						name: "el-input-number"
					},
					span: 5
				},
				{
					label: "产品数量",
					prop: "product_quantity",
					component: {
						name: "el-input-number"
					},
					span: 5
				},
				{
					label: "海关编码",
					prop: "HS_code",
					component: { name: "el-input", props: {} },
					span: 12
				},
				{
					label: "描述",
					prop: "describe",
					value: [_getAnEmptyDescribeItem()],
					component: { name: "slot-describe" }
				},
				{
					label: "工厂链接",
					prop: "factory_links",
					value: [_getAnEmptyFactoryLinkItem()],
					component: { name: "slot-factory_links" },
					hidden: isHidden2
				},
				// {
				//   label: '采购数量', prop: 'purchaserNum',
				//   value :[_getAnEmptyPurchaserNumItem()],
				//   component: {name: 'slot-purchaserNum'}, span: 12,
				//   hidden: isHidden2
				// },
				// {
				//   label: '提交采购人', prop: 'purchaser',
				//   value :[_getAnEmptyPurchaserItem()],
				//   component: {name: 'slot-purchaser'},
				//   span: 12,
				//   hidden: isHidden2
				// },

				{
					label: "专利查询截图",
					prop: "keyword_screenshots",
					component: {
						name: "cl-upload",
						props: {
							text: "选择图片",
							draggable: true,
							multiple: true,
							limitSize: 2,
							onUpload: function (file) {
								isFileUploading.value = true;
							},
							onProgress: function (file) {},
							onSuccess: function (file) {
								setTimeout(function () {
									isFileUploading.value = false;
								}, 3500);
							},
							onError: function (file) {
								setTimeout(function () {
									isFileUploading.value = false;
								}, 3500);
							}
						}
					}
				}
			]
		}
	],

	async onSubmit(data, { next, done }) {
		try {
			ensureCandidateIds(data);
			data.factory_links = data.factory_links
				.map((item) => {
					item.user_input = item.user_input.trim();
					return item;
				})
				.filter((item) => item.user_input);
			data.describe = data.describe
				.map((item) => {
					item.describe1 = item.describe1.trim();
					return item;
				})
				.filter((item) => item.describe1);
		} catch (err) {
			console.log(err);
		}

		if (data.produce_name === null) {
			ElMessage({ message: "请填写产品名称", type: "error" });
			return;
		}

		const vr = validateBsrCandidateVariants(data);
		if (!vr.valid) {
			ElMessage.warning(vr.message);
			return;
		}

		// 移除变体中用于前端展示的内部字段，避免后端报错
		if (data.variant_Combination && Array.isArray(data.variant_Combination)) {
			data.variant_Combination.forEach((v: any) => {
				delete v._competitorImages;
				delete v._competitorImagesLoaded;
				delete v._loadingImages;
				delete v.originalImageUrl;
			});
		}

		await next(data);
	},
	op: {
		buttons: ["close", "slot-btns"]
	}
});

function _getAnEmptyFactoryLinkItem() {
	return { user_input: "" };
}

function _getAnEmptyPurchaserNumItem() {
	return { purchaser2: 0 };
}

function _getAnEmptyPurchaserItem() {
	return { purchaser1: userStore.info?.username };
}

function _getAnEmptyDescribeItem() {
	return { describe1: "" };
}

function addRowDescribe() {
	if (!Upsert.value?.form.describe) {
		Upsert.value.form.describe = [];
	}
	Upsert.value?.form.describe.push(_getAnEmptyDescribeItem());
}

function addRowPurchaserNum() {
	if (!Upsert.value?.form.purchaserNum) {
		Upsert.value.form.purchaserNum = [];
	}
	if (!Upsert.value?.form.purchaser) {
		Upsert.value.form.purchaser = [];
	}
	Upsert.value?.form.purchaserNum.push(_getAnEmptyPurchaserNumItem());
	Upsert.value?.form.purchaser.push(_getAnEmptyPurchaserItem());
}

function DeleteRowDescribe(index: number) {
	Upsert.value?.form.describe.splice(index, 1);
}

function DeleteRowFactoryLink(index: number) {
	Upsert.value?.form.factory_links.splice(index, 1);
}

function DeleteRowPurchaserNum(index: number) {
	Upsert.value?.form.purchaserNum.splice(index, 1);
	Upsert.value?.form.purchaser.splice(index, 1);
	Upsert.value?.form.purchaserid.splice(index, 1);
}

async function calculate() {
	// 输入验证
	if (
		!Upsert.value?.form.cost_price ||
		!Upsert.value?.form.length ||
		!Upsert.value?.form.width ||
		!Upsert.value?.form.height ||
		!Upsert.value?.form.actual_weight
	) {
		ElMessage.warning("请填写成本价、长、宽、高和重量");
		return;
	}
	const defaultMarket = {
		sellingPrice: 0,
		type: "FBM" as const
	};

	const marketPrices = {
		UK: { sellingPrice: 0, type: "FBM" as const },
		DE: { sellingPrice: 0, type: "FBM" as const },
		FR: { sellingPrice: 0, type: "FBM" as const },
		ES: { sellingPrice: 0, type: "FBM" as const },
		IT: { sellingPrice: 0, type: "FBM" as const }
	};

	// 市场映射关系
	const marketConfig = {
		UK: {
			headFreightKey: "first_leg_freight_UK",
			fbaFreightKey: "fba_freight_UK"
		},
		DE: {
			headFreightKey: "first_leg_freight_DE",
			fbaFreightKey: "fba_freight_DE",
			covers: ["DE", "FR", "ES", "IT"] // 德法西意共用德国头程
		}
	};

	try {
		// 获取竞品数据
		const candidateId = Upsert.value?.form.id;
		const response = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			size: 1000
		});

		// 处理竞品数据
		const marketPrices = processCompetitors(response.list || []);

		// 计算重量相关参数
		const dimensionalWeight = Math.ceil(
			(Upsert.value.form.length * Upsert.value.form.width * Upsert.value.form.height) / 6000
		);
		const weight = Math.max(dimensionalWeight, Upsert.value.form.actual_weight);

		// 基础参数
		const costPrice = Upsert.value.form.cost_price;
		const exchangeRate = Upsert.value.form.exchange_rate || 1;
		const taxRate = (Upsert.value.form.tax_rate || 0) / 100;

		// 计算各国利润
		const results: Record<
			string,
			{
				grossProfit: number;
				grossProfitRate: number;
			}
		> = {};

		Object.entries(marketConfig).forEach(([market, config]) => {
			const headFreight = Upsert.value.form[config.headFreightKey];
			const coveredMarkets = config.covers || [market];

			coveredMarkets.forEach((targetMarket) => {
				// 添加市场数据检查
				const priceInfo = marketPrices[targetMarket] || defaultMarket;
				if (!priceInfo) return;

				const fbaFreight =
					Upsert.value.form[
						marketConfig[targetMarket]?.fbaFreightKey || config.fbaFreightKey
					];

				// 添加有效性检查（关键修复）
				if (headFreight > 0 && fbaFreight > 0 && priceInfo.sellingPrice > 0) {
					const profit = calculateProfit(
						priceInfo.sellingPrice,
						fbaFreight,
						taxRate,
						exchangeRate,
						costPrice,
						weight,
						headFreight
					);

					results[targetMarket] = {
						grossProfit: profit,
						grossProfitRate: profit / (exchangeRate * priceInfo.sellingPrice)
					};
				}
			});
		});

		// 更新表单数据
		Object.entries(results).forEach(([market, result]) => {
			Upsert.value.form[`gross_profit_${market}`] = result.grossProfit;
			Upsert.value.form[`gross_profit_rate_${market}`] = result.grossProfitRate;
		});

		// 更新抛重字段
		Upsert.value.form.dimensional_weight = dimensionalWeight;
	} catch (error) {
		console.error("计算失败:", error);
		ElMessage.error("计算过程中发生错误");
	}
}

const isAdaptingPrice = ref(false);

async function autoAdaptLocalPrice() {
	try {
		isAdaptingPrice.value = true;

		// 1. 获取当前候选产品的竞品数据
		const candidateId = Upsert.value?.form.id;
		if (!candidateId) {
			ElMessage.warning("请先保存产品基本信息");
			return;
		}

		const response = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			size: 1000
		});

		const competitors = response.list || [];

		// 2. 按国家分组处理
		markets.value.forEach((market) => {
			// 获取当前国家的FBA竞品
			const countryName = market.country; // 如"英国"
			const fbaCompetitors = competitors.filter(
				(comp) => comp.marketplace === countryName && comp.dispatches_type == "1" // FBA类型
			);

			if (fbaCompetitors.length > 0) {
				// 3. 取FBA最低价格
				const minPrice = Math.min(
					...fbaCompetitors.map((c) => parseFloat(c.price || 0)).filter((p) => p > 0)
				);
				market.localPrice = parseFloat(minPrice.toFixed(2));
			} else {
				// 4. 没有FBA竞品时，按30%利润率推算售价
				const cost = common.cost;
				const headFreight = market.shipping;
				const deliveryFee = market.deliveryFee;
				const exchangeRate = market.exchangeRate;
				const taxRate = market.taxRate / 100; // 转换为小数

				// 计算有效重量
				const volumetricWeight = (common.length * common.width * common.height) / 6000;
				const effectiveWeight = Math.max(volumetricWeight, common.actualWeight);

				// 计算公式推导：
				// 利润 = 售价 * 汇率 * 0.3
				// 同时：利润 = (售价 * 0.84 - 配送费 - 售价 * 税率) * 汇率 - 成本 - 头程运费*有效重量
				// 解方程得：
				const numerator = deliveryFee * exchangeRate + cost + headFreight * effectiveWeight;
				const denominator = exchangeRate * (0.54 - taxRate);

				if (denominator <= 0) {
					ElMessage.warning(`${countryName}税率过高，无法计算适配价格`);
					return;
				}

				market.localPrice = parseFloat((numerator / denominator).toFixed(2));
			}
		});

		ElMessage.success("本地售价适配完成");
	} catch (error) {
		ElMessage.error("适配本地售价失败: " + error);
	} finally {
		isAdaptingPrice.value = false;
	}
}
// 处理国家筛选变化
const handleCompetitorCountryChange = () => {
	// 可以添加额外的逻辑，比如记录筛选行为等
};

const competitorFilterCountry = ref("");
const countryOptions = [
	{ label: "英国", value: "UK" },
	{ label: "德国", value: "DE" },
	{ label: "法国", value: "FR" },
	{ label: "西班牙", value: "ES" },
	{ label: "意大利", value: "IT" }
];

// 计算过滤后的竞品数据
const filteredCompetitors = computed(() => {
	if (!competitorFilterCountry.value) return competitorData.value;
	return competitorData.value.filter(
		(item) =>
			item.marketplace ===
			countryOptions.find((c) => c.value === competitorFilterCountry.value)?.label
	);
});

function processCompetitors(competitors: any[]) {
	const marketPrices: Record<
		string,
		{
			sellingPrice: number;
			type: "FBA" | "FBM";
		}
	> = {};

	const marketMapping: Record<string, string> = {
		英国: "UK",
		德国: "DE",
		法国: "FR",
		西班牙: "ES",
		意大利: "IT"
	};

	competitors.forEach((item) => {
		const market = marketMapping[item.marketplace] || item.marketplace;
		const price = Number(item.price) || 0;
		const type = appConfig.estimate_distribution_type(item.dispatches_from, item.sold_by);

		if (!marketPrices[market]) {
			marketPrices[market] = { sellingPrice: 0, type: "FBM" };
		}

		// 优先取最低FBA价格
		if (type === "FBA") {
			if (price < marketPrices[market].sellingPrice || marketPrices[market].type === "FBM") {
				marketPrices[market] = { sellingPrice: price, type };
			}
		}
		// 没有FBA时取最高FBM价格
		else if (type === "FBM" && marketPrices[market].type === "FBM") {
			if (price > marketPrices[market].sellingPrice) {
				marketPrices[market].sellingPrice = price;
			}
		}
	});

	return marketPrices;
}

function calculateProfit(
	sellingPrice: number,
	fbaFreight: number,
	taxRate: number,
	exchangeRate: number,
	costPrice: number,
	weight: number,
	headFreight: number
): number {
	return (
		(sellingPrice * 0.84 - // 平台费
			fbaFreight - // FBA配送费
			sellingPrice * taxRate) * // 税率
			exchangeRate -
		costPrice - // 成本价
		weight * headFreight // 头程运费
	);
}

const jsonViewerContent = ref();
const jsonViewerDialogVisible = ref(false);

const competitorManagementPaneVisible = ref(false);
const curEditingBsrCandidate = ref();

async function updateStatus(candidate, status: number) {
	const candidateResponse = await service.app.bsr_candidate.info({
		id: candidate.id
	});
	let candidateId = candidate.id;
	let profitData = await service.app.bsr_candidate.getProfitData({ candidateId });

	const requiredFields = [
		{ field: profitData.common.cost, name: "成本价" },
		{ field: profitData.common.length, name: "尺寸-长度" },
		{ field: profitData.common.width, name: "尺寸-宽度" },
		{ field: profitData.common.height, name: "尺寸-高度" },
		{ field: candidateResponse.material, name: "材料" },
		{ field: candidateResponse.color, name: "颜色" },
		{ field: candidateResponse.size, name: "尺码" },
		{ field: candidateResponse.HS_code, name: "海关编码" }
	];

	const missingFields = requiredFields.filter((item) => !item.field).map((item) => item.name);

	if (missingFields.length > 0) {
		ElMessage.error(`请先填写以下信息：${missingFields.join("、")}`);
		return;
	}

	// 验证变体管理数据
	if (!candidateResponse.variant_Combination) {
		ElMessage.error("请至少添加一条变体管理数据");
		return;
	}

	// 验证本地售价和配送费（针对各个国家）- 从profitData.markets中获取
	const markets = ["UK", "DE", "FR", "ES", "IT"];
	const missingMarketData: any[] = [];

	for (const market of markets) {
		const marketData = profitData.markets.find((m) => m.country_code === market);
		if (
			!marketData ||
			!marketData.local_price ||
			marketData.local_price === "0.00" ||
			!marketData.delivery_fee ||
			marketData.delivery_fee === "0.00"
		) {
			missingMarketData.push(market);
		}
	}

	if (missingMarketData.length > 0) {
		ElMessage.error(`请填写以下国家的本地售价和配送费：${missingMarketData.join("、")}`);
		return;
	}

	if (candidate.produce_name === null) {
		ElMessage({ message: "请填写产品名称", type: "error" });
		return;
	}

	// 新增：待精选数据移入待处理数据（状态6）前，校验是否含有英国和德国竞品
	// 修改时间：2026-04-20
	if (status === 6) {
		try {
			const competitorsResponse = await service.app.bsr_candidate_competitor.page({
				candidate_id: candidateId,
				size: 1000
			});
			const competitors = competitorsResponse.list || [];

			const hasUK = competitors.some((c: any) => c.marketplace === '英国');
			const hasDE = competitors.some((c: any) => c.marketplace === '德国');

			if (!hasUK || !hasDE) {
				const missing: string[] = [];
				if (!hasUK) missing.push('英国');
				if (!hasDE) missing.push('德国');

				await ElMessageBox.confirm(
					`该产品缺失${missing.join('和')}竞品，是否强制移入待处理数据？`,
					'提示',
					{
						confirmButtonText: '强制移入',
						cancelButtonText: '取消',
						type: 'warning'
					}
				);
			}
		} catch (e) {
			// 如果点击取消，则阻止执行状态更新
			return;
		}
	}

	let oldStatus = candidate?.status;
	try {
		candidate.status = status;
		await Crud.value?.service.update({
			id: candidate.id,
			status,
			max_purchase: 40
		});
		await service.app.bsr_candidate.archiveWithImage2({
			ids: [candidate.id]
		});

		Crud.value?.refresh();
		ElMessage({ message: "更新状态成功", type: "success" });
	} catch (err) {
		// 失败时回滚状态
		candidate.status = oldStatus;
		ElMessage({ message: "更新状态失败，请刷新/重试。", type: "error" });
		console.error("SKU 生成/更新错误:", err);
	}
}

async function syncFX() {
	try {
		syncing.value = true;
		const rates = await service.app.bsr_candidate.sync_from_FX();

		// 更新汇率到对应国家
		markets.value = markets.value.map((market) => ({
			...market,
			exchangeRate: rates[market.country] || market.exchangeRate
		}));

		ElMessage.success("汇率同步成功");
	} catch (err) {
		ElMessage.error("汇率同步失败");
	} finally {
		syncing.value = false;
	}
}

// async function syncFX() {
//   try {
//     let result = await service.app.search_threads.ai_listing();
//     console.log(result);

//     if (result === 'ok') {
//       ElMessage({
//         message: '',
//         type: 'success',
//       });
//       Crud?.value?.refresh();
//     } else {
//       ElMessage({
//         message: '同步有误，请稍后重试。',
//         type: 'error',
//       });
//     }
//   } catch (err: any) {

//     console.log(err);
//     ElMessage({
//       message: err,
//       type: 'error',
//     });
//   }
// }

async function selectType(type: string, index: number) {
	Upsert.value.form.describe[index].describe1 =
		`${type}: ${Upsert.value.form.describe[index].describe1 || ""}`;
}

// 在 setup 中添加状态控制
const isEditMode = ref(false);

// 监听编辑/新增操作
watch(
	() => Upsert.value?.mode,
	(mode) => {
		isEditMode.value = mode === "update";
	}
);

const marketNameMapping: Record<string, string> = {
	英国: "UK",
	德国: "DE",
	法国: "FR",
	西班牙: "ES",
	意大利: "IT"
};
const competitorData = ref<any[]>([]);

const dispatchTypeDict = {
	0: { label: "自营", type: "success" },
	1: { label: "FBA", type: "warning" },
	2: { label: "FBM", type: "info" }
};

async function calculateDeliveryVolumes(candidateId: number): Promise<Record<string, any> | null> {
	if (!candidateId) return null;
	try {
		const volumesByMarketplace: Record<string, any> = {
			UK: {
				FBA: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0,
					avgReview: 0,
					maxReview: 0,
					minReviewWithSales: Infinity,
					totalReview: 0,
					totalMainMonthlySales: 0,
					inventorySalesRatio: 0,
					avgDailySalesExcludeMax: 0,
					avgDailySalesPerAsin: 0
				},
				FBM: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0
				},
				Other: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					stockTotal: 0
				},
				marketAvg: 0,
				earliestDate: "",
				avgDays: 0,
				avgDaysWithVolume: 0,
				totalProducts: 0,
				productsWithVolume: 0,
				volumePercentage: 0,
				nodeStats: [],
				newProductCount: 0,
				fbaNewAsinCount: 0,
				fbmNewAsinCount: 0,
				newProductWithVolumeCount: 0,
				newProductVolumePercentage: 0
			},
			DE: {
				FBA: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0,
					avgReview: 0,
					maxReview: 0,
					minReviewWithSales: Infinity,
					totalReview: 0,
					totalMainMonthlySales: 0,
					inventorySalesRatio: 0,
					avgDailySalesExcludeMax: 0,
					avgDailySalesPerAsin: 0
				},
				FBM: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0
				},
				Other: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					stockTotal: 0
				},
				marketAvg: 0,
				earliestDate: "",
				avgDays: 0,
				avgDaysWithVolume: 0,
				totalProducts: 0,
				productsWithVolume: 0,
				volumePercentage: 0,
				nodeStats: [],
				newProductCount: 0,
				fbaNewAsinCount: 0,
				fbmNewAsinCount: 0,
				newProductWithVolumeCount: 0,
				newProductVolumePercentage: 0
			},
			FR: {
				FBA: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0,
					avgReview: 0,
					maxReview: 0,
					minReviewWithSales: Infinity,
					totalReview: 0,
					totalMainMonthlySales: 0,
					inventorySalesRatio: 0,
					avgDailySalesExcludeMax: 0,
					avgDailySalesPerAsin: 0
				},
				FBM: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0
				},
				Other: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					stockTotal: 0
				},
				marketAvg: 0,
				earliestDate: "",
				avgDays: 0,
				avgDaysWithVolume: 0,
				totalProducts: 0,
				productsWithVolume: 0,
				volumePercentage: 0,
				nodeStats: [],
				newProductCount: 0,
				fbaNewAsinCount: 0,
				fbmNewAsinCount: 0,
				newProductWithVolumeCount: 0,
				newProductVolumePercentage: 0
			},
			ES: {
				FBA: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0,
					avgReview: 0,
					maxReview: 0,
					minReviewWithSales: Infinity,
					totalReview: 0,
					totalMainMonthlySales: 0,
					inventorySalesRatio: 0,
					avgDailySalesExcludeMax: 0,
					avgDailySalesPerAsin: 0
				},
				FBM: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0
				},
				Other: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					stockTotal: 0
				},
				marketAvg: 0,
				earliestDate: "",
				avgDays: 0,
				avgDaysWithVolume: 0,
				totalProducts: 0,
				productsWithVolume: 0,
				volumePercentage: 0,
				nodeStats: [],
				newProductCount: 0,
				fbaNewAsinCount: 0,
				fbmNewAsinCount: 0,
				newProductWithVolumeCount: 0,
				newProductVolumePercentage: 0
			},
			IT: {
				FBA: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0,
					avgReview: 0,
					maxReview: 0,
					minReviewWithSales: Infinity,
					totalReview: 0,
					totalMainMonthlySales: 0,
					inventorySalesRatio: 0,
					avgDailySalesExcludeMax: 0,
					avgDailySalesPerAsin: 0
				},
				FBM: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0
				},
				Other: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					stockTotal: 0
				},
				marketAvg: 0,
				earliestDate: "",
				avgDays: 0,
				avgDaysWithVolume: 0,
				totalProducts: 0,
				productsWithVolume: 0,
				volumePercentage: 0,
				nodeStats: [],
				newProductCount: 0,
				fbaNewAsinCount: 0,
				fbmNewAsinCount: 0,
				newProductWithVolumeCount: 0,
				newProductVolumePercentage: 0
			}
		};

		const sellerCountMap: Record<string, Set<string>> = {
			UK: new Set(),
			DE: new Set(),
			FR: new Set(),
			ES: new Set(),
			IT: new Set()
		};

		const sellerCountMap2: Record<string, Set<string>> = {
			UK: new Set(),
			DE: new Set(),
			FR: new Set(),
			ES: new Set(),
			IT: new Set()
		};

		const stockDataByMarketType: Record<
			string,
			Record<string, (number | null | undefined)[]>
		> = {
			UK: { FBA: [], FBM: [], Other: [] },
			DE: { FBA: [], FBM: [], Other: [] },
			FR: { FBA: [], FBM: [], Other: [] },
			ES: { FBA: [], FBM: [], Other: [] },
			IT: { FBA: [], FBM: [], Other: [] }
		};

		const currentDate = new Date();
		const year = currentDate.getFullYear();
		const month = currentDate.getMonth() + 1;
		const daysInMonth = new Date(year, month, 0).getDate();

		const nonSameStatus = appConfig.BSR_CANDIDATE_COMPETITOR_STATUS.NON_SAME.value;
		const response = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			size: 1000,
			status: [2, 6, nonSameStatus]
		});
		const response2 = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			size: 1000
		});

		const filteredList = response.list || [];
		const filteredList2 = (response2.list || []).filter((item) => [1, 2].includes(item.status));

		competitorData.value = response.list || [];
		competitorData.value.forEach((item) => {
			item.image_url_display = convert_image_url(item.image_url);
		});

		const nodeStatsByMarket: Record<
			string,
			Record<
				string,
				{
					name: string;
					count: number;
					totalVolume: number;
				}
			>
		> = {
			UK: {},
			DE: {},
			FR: {},
			ES: {},
			IT: {}
		};

		filteredList2.forEach((item) => {
			const marketplaceZh = item.marketplace || "";
			const marketplaceEn = marketNameMapping[marketplaceZh] || marketplaceZh;
			if (item.bsr_node) {
				const nodeName = item.bsr_node;
				if (!nodeStatsByMarket[marketplaceEn][nodeName]) {
					nodeStatsByMarket[marketplaceEn][nodeName] = {
						name: nodeName,
						count: 0,
						totalVolume: 0
					};
				}
				const volume = Number(item.expected_volume) || 0;
				nodeStatsByMarket[marketplaceEn][nodeName].count++;
				nodeStatsByMarket[marketplaceEn][nodeName].totalVolume += volume;
			}
		});

		const ninetyDaysAgo = new Date();
		ninetyDaysAgo.setDate(currentDate.getDate() - 90);

		filteredList.forEach((item) => {
			const dispatchesFrom = item.dispatches_from || "";
			const soldBy = item.sold_by || "";
			const marketplaceZh = item.marketplace || "";
			const marketplaceEn = marketNameMapping[marketplaceZh] || marketplaceZh;

			const daysInMonth = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth() + 1,
				0
			).getDate();
			volumesByMarketplace[marketplaceEn].daysInMonth = daysInMonth;
			const euMarkets = ["DE", "FR", "ES", "IT"];

			let type = "";
			if (item.dispatches_type == "1") {
				type = "FBA";
			} else if (item.dispatches_type == "2") {
				type = "FBM";
			} else {
				type = "Other";
			}
			const volume = parseFloat(Number(item.expected_volume).toFixed(2));

			if (type === "FBA" && item.sold_by) {
				sellerCountMap[marketplaceEn]?.add(item.sold_by.trim().toLowerCase());
			}
			if (type === "FBM" && item.sold_by) {
				sellerCountMap2[marketplaceEn]?.add(item.sold_by.trim().toLowerCase());
			}

			let rawStockQuantity: number | null | undefined;
			if (
				item.stock_quantity === undefined ||
				item.stock_quantity === null ||
				item.stock_quantity === ""
			) {
				rawStockQuantity = null;
			} else {
				rawStockQuantity = Number(item.stock_quantity);
			}
			stockDataByMarketType[marketplaceEn][type].push(rawStockQuantity);

			if (!volumesByMarketplace[marketplaceEn]) {
				volumesByMarketplace[marketplaceEn] = {
					FBA: {
						total: 0,
						count: 0,
						max: 0,
						max_price: 0,
						min_price: Infinity,
						stockTotal: 0
					},
					FBM: { total: 0, count: 0, max: 0, max_price: 0, min_price: Infinity },
					Other: { total: 0, count: 0, max: 0, max_price: 0, min_price: Infinity },
					marketAvg: 0,
					earliestDate: "",
					avgDays: 0,
					avgDaysWithVolume: 0,
					totalProducts: 0,
					productsWithVolume: 0,
					volumePercentage: 0,
					nodeStats: []
				};
			}

			volumesByMarketplace[marketplaceEn].totalProducts += 1;

			if (!volumesByMarketplace[marketplaceEn][type]) {
				volumesByMarketplace[marketplaceEn][type] = {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					stockTotal: 0
				};
			}

			volumesByMarketplace[marketplaceEn][type].count += 1;
			volumesByMarketplace[marketplaceEn][type].total += Number(volume);
			volumesByMarketplace[marketplaceEn][type].max = Math.max(
				volumesByMarketplace[marketplaceEn][type].max,
				volume
			);

			const price = item.price || item.current_price || 0;
			volumesByMarketplace[marketplaceEn][type].max_price = Math.max(
				volumesByMarketplace[marketplaceEn][type].max_price,
				price
			);
			volumesByMarketplace[marketplaceEn][type].min_price = Math.min(
				volumesByMarketplace[marketplaceEn][type].min_price,
				price
			);

			if (volume > 0) {
				volumesByMarketplace[marketplaceEn].productsWithVolume += 1;
			}

			// 新增：收集FBA相关原始数据
			if (type === "FBA") {
				const fbaData = volumesByMarketplace[marketplaceEn][type];
				// review相关
				const reviewNum = Number(item.review_num) || 0;
				fbaData.totalReview += reviewNum;
				fbaData.maxReview = Math.max(fbaData.maxReview, reviewNum);

				// 最低出单review（有父体月销量）
				const mainMonthlySales = Number(item.Main_monthly_sales) || 0;
				if (mainMonthlySales > 0) {
					fbaData.minReviewWithSales = Math.min(fbaData.minReviewWithSales, reviewNum);
					fbaData.totalMainMonthlySales += mainMonthlySales;
				}
			}

			if (item.date_first_available) {
				const itemDate = new Date(item.date_first_available);
				if (
					!volumesByMarketplace[marketplaceEn].earliestDate ||
					itemDate < new Date(volumesByMarketplace[marketplaceEn].earliestDate)
				) {
					volumesByMarketplace[marketplaceEn].earliestDate = itemDate
						.toISOString()
						.split("T")[0];
				}
				const diffTime = currentDate.getTime() - itemDate.getTime();
				const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
				volumesByMarketplace[marketplaceEn].totalDays =
					(volumesByMarketplace[marketplaceEn].totalDays || 0) + diffDays;
				volumesByMarketplace[marketplaceEn].dateCount =
					(volumesByMarketplace[marketplaceEn].dateCount || 0) + 1;

				if (volume > 0) {
					volumesByMarketplace[marketplaceEn].volumeDays =
						(volumesByMarketplace[marketplaceEn].volumeDays || 0) + diffDays;
					volumesByMarketplace[marketplaceEn].volumeCount =
						(volumesByMarketplace[marketplaceEn].volumeCount || 0) + 1;
				}

				if (isNewProduct(item.date_first_available)) {
					volumesByMarketplace[marketplaceEn].newProductCount += 1;
				}
			}

			const isNewProduct2 =
				item.date_first_available && new Date(item.date_first_available) > ninetyDaysAgo;
			const hasRankOrSales = (item.bsr_rank && item.bsr_rank > 0) || item.Main_monthly_sales;
			const hasLowReviews = (item.review_num || 0) < 5;

			if (type === "FBA" && isNewProduct2 && hasRankOrSales && hasLowReviews) {
				volumesByMarketplace[marketplaceEn].fbaNewAsinCount += 1;
			}
			if (type === "FBM" && isNewProduct2 && hasRankOrSales && hasLowReviews) {
				volumesByMarketplace[marketplaceEn].fbmNewAsinCount += 1;
			}
			if (isNewProduct2 && hasRankOrSales && hasLowReviews && volume > 0) {
				volumesByMarketplace[marketplaceEn].newProductWithVolumeCount += 1;
			}
			if (isNewProduct2 && hasRankOrSales && hasLowReviews) {
				volumesByMarketplace[marketplaceEn].newProductVolumeTotal =
					(volumesByMarketplace[marketplaceEn].newProductVolumeTotal || 0) + volume;
			}
		});

		Object.keys(nodeStatsByMarket).forEach((market) => {
			if (!volumesByMarketplace[market]) {
				volumesByMarketplace[market] = { nodeStats: [] };
			}
			volumesByMarketplace[market].nodeStats = Object.values(nodeStatsByMarket[market])
				.filter((node) => node.totalVolume >= 0)
				.sort((a, b) => b.totalVolume - a.totalVolume);
		});

		for (const market of Object.keys(volumesByMarketplace)) {
			volumesByMarketplace[market].FBA.sellerCount = sellerCountMap[market]?.size || 0;
		}
		for (const market of Object.keys(volumesByMarketplace)) {
			volumesByMarketplace[market].FBM.sellerCount = sellerCountMap2[market]?.size || 0;
		}

		for (const marketplace of Object.keys(volumesByMarketplace)) {
			for (const type of ["FBA", "FBM", "Other"] as const) {
				const stockQuantities = stockDataByMarketType[marketplace][type];
				const hasInvalidStock = stockQuantities.some((sq) => sq === null);

				if (hasInvalidStock) {
					volumesByMarketplace[marketplace][type].stockTotal = "数据不全";
				} else if (stockQuantities.length > 0) {
					volumesByMarketplace[marketplace][type].stockTotal = stockQuantities.reduce(
						(sum, sq) => sum + (sq || 0),
						0
					);
				} else {
					volumesByMarketplace[marketplace][type].stockTotal = 0;
				}
			}
		}

		// 新增：计算6个FBA指标
		for (const market of Object.keys(volumesByMarketplace)) {
			const fbaData = volumesByMarketplace[market].FBA;
			const daysInMonth = volumesByMarketplace[market].daysInMonth || 30;
			const totalMonthlySales = fbaData.total * daysInMonth; // 总月销量

			// 1. 平均review = 总review数 / 卖家数量
			fbaData.avgReview =
				fbaData.sellerCount > 0
					? parseFloat((fbaData.totalReview / fbaData.sellerCount).toFixed(2))
					: 0;

			// 2. 最大review（已在循环中收集最大值）
			fbaData.maxReview = parseFloat(fbaData.maxReview.toFixed(2));

			// 3. 最低出单review（处理无符合条件数据的情况）
			fbaData.minReviewWithSales =
				fbaData.minReviewWithSales !== Infinity
					? parseFloat(fbaData.minReviewWithSales.toFixed(2))
					: 0;

			// 4. 库销比 = 总库存 / 总月销量（处理库存数据不全、除数为0）
			if (fbaData.stockTotal === "数据不全" || totalMonthlySales <= 0) {
				fbaData.inventorySalesRatio = 0;
			} else {
				fbaData.inventorySalesRatio = parseFloat(
					(fbaData.stockTotal / totalMonthlySales).toFixed(2)
				);
			}

			// 5. 日/人均销量（剔除最大值）= (日均销量 - 最大单量) / (ASIN数量 - 1)
			fbaData.avgDailySalesExcludeMax =
				fbaData.count > 1
					? parseFloat(((fbaData.total - fbaData.max) / (fbaData.count - 1)).toFixed(2))
					: 0;

			// 6. 日/人均销量（日均销量/ASIN数量）= 日均销量 / ASIN数量
			fbaData.avgDailySalesPerAsin =
				fbaData.count > 0 ? parseFloat((fbaData.total / fbaData.count).toFixed(2)) : 0;
		}

		for (const marketplace in volumesByMarketplace) {
			const validVolumes = filteredList.filter(
				(item) =>
					marketNameMapping[item.marketplace] === marketplace &&
					(Number(item.expected_volume) || 0) >= 0
			);
			if (validVolumes.length > 0) {
				const totalVolume = validVolumes.reduce(
					(sum, item) => sum + (Number(item.expected_volume) || 0),
					0
				);
				volumesByMarketplace[marketplace].marketAvg = totalVolume / validVolumes.length;
			} else {
				volumesByMarketplace[marketplace].marketAvg = 0;
			}

			const totalVolume =
				volumesByMarketplace[marketplace].FBA.total +
				volumesByMarketplace[marketplace].FBM.total;
			volumesByMarketplace[marketplace].newProductVolumePercentage =
				totalVolume > 0
					? ((volumesByMarketplace[marketplace].newProductVolumeTotal || 0) /
							totalVolume) *
						100
					: 0;

			volumesByMarketplace[marketplace].avgDays =
				volumesByMarketplace[marketplace].dateCount > 0
					? Math.round(
							volumesByMarketplace[marketplace].totalDays /
								volumesByMarketplace[marketplace].dateCount
						)
					: 0;
			volumesByMarketplace[marketplace].avgDaysWithVolume =
				volumesByMarketplace[marketplace].volumeCount > 0
					? Math.round(
							volumesByMarketplace[marketplace].volumeDays /
								volumesByMarketplace[marketplace].volumeCount
						)
					: 0;

			volumesByMarketplace[marketplace].volumePercentage =
				volumesByMarketplace[marketplace].totalProducts > 0
					? (volumesByMarketplace[marketplace].productsWithVolume /
							volumesByMarketplace[marketplace].totalProducts) *
						100
					: 0;

			volumesByMarketplace[marketplace].newProductPercentage =
				volumesByMarketplace[marketplace].totalProducts > 0
					? (volumesByMarketplace[marketplace].newProductCount /
							volumesByMarketplace[marketplace].totalProducts) *
						100
					: 0;
		}

		console.log("最终计算结果:", volumesByMarketplace);
		return volumesByMarketplace;
	} catch (err) {
		console.error("获取竞品数据失败:", err);
		return null;
	}
}
function getMarketName(market: string): string {
	const reverseMapping: Record<string, string> = {
		UK: "英国",
		DE: "德国",
		FR: "法国",
		ES: "西班牙",
		IT: "意大利"
	};

	return reverseMapping[market] || market;
}

function isNewProduct(dateFirstAvailable: Date): boolean {
	const currentDate = new Date();
	const productDate = new Date(dateFirstAvailable);
	const timeDifference = currentDate.getTime() - productDate.getTime();
	const daysDifference = timeDifference / (1000 * 3600 * 24);
	return daysDifference <= 90;
}

// 公共参数
const common = reactive({
	cost: 0,
	length: 0,
	width: 0,
	height: 0,
	actualWeight: 0
});

// 国家参数
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
	// 其他国家...
]);
// 加载状态
const loadingRates = ref(false);

// 计算抛重
const volumetricWeight = computed(() => {
	return (common.length * common.width * common.height) / 6000;
});

// 计算有效重量
const effectiveWeight = computed(() => {
	return Math.max(volumetricWeight.value, common.actualWeight);
});

// 获取汇率数据
const loadExchangeRates = async () => {
	try {
		loadingRates.value = true;
		const rates: ExchangeRate[] = await service.app.foreign_exchange.getExchangeRate();
		markets.value = markets.value.map((market) => {
			const rateInfo = rates.find((r) => r.symbol === market.currencySymbol);
			return {
				...market,
				exchangeRate: rateInfo?.rate || 0,
				currencySymbol: rateInfo?.symbol || market.currency
			};
		});
	} catch (error) {
		ElMessage.error("汇率获取失败");
	} finally {
		loadingRates.value = false;
		calculateAll();
	}
};

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

// 新增同步状态
const syncing = ref(false);

// 全局计算
const calculateAll = () => {
	markets.value.forEach(calculateRow);
};

// 自动计算
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

// 新增汇率接口类型
interface ExchangeRate {
	currency: string;
	rate: number;
	symbol: string;
}

// 自动加载汇率
onMounted(async () => {
	await loadExchangeRates();
	if (!calculatorInitialized) {
		let params = await service.base.sys.param.page({
			keyName: "sysName"
		});
		let sysName = params.list?.[0]?.data || "woeau";
		resetCalculator(sysName);
		calculatorInitialized = true;
	}
});
// 独立的状态重置方法
const resetCalculator = async (sysName: string) => {
	// 重置公共参数
	common.cost = 0;
	common.length = 0;
	common.width = 0;
	common.height = 0;
	common.actualWeight = 0;
	// 重置国家参数（使用 forEach 保持响应性）
	markets.value.forEach((market) => {
		market.localPrice = 0;
		market.shipping = sysName === "woeau" ? 20 : 40;
		if (sysName !== "woeau" && market.country === "英国") {
			market.exchangeRate = 9.15;
		}
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
			...(form.id && { id: form.id }), // 保留原有 ID
			...(form.asin && { asin: form.asin }) // 保留 ASIN
			// 添加其他需要保留的字段...
		});
	}
};

const countryCodeMap: Record<string, string> = {
	英国: "UK",
	德国: "DE",
	法国: "FR",
	西班牙: "ES",
	意大利: "IT"
};
const handleEdit = async (row: any) => {
	try {
		// 先执行清空操作

		let params = await service.base.sys.param.page({
			keyName: "sysName"
		});
		let sysName = params.list?.[0]?.data || "woeau";

		resetCalculator(sysName);

		const candidateId = row.id;

		let profitData = await service.app.bsr_candidate.getProfitData({ candidateId });
		if (profitData) {
			// 更新common数据
			common.cost = profitData.common.cost || 0;
			common.length = profitData.common.length || 0;
			common.width = profitData.common.width || 0;
			common.height = profitData.common.height || 0;
			common.actualWeight = profitData.common.actual_weight || 0;

			// 更新markets数据
			markets.value = markets.value.map((market) => {
				const savedData = profitData.markets.find(
					(m: any) => m.country_code === countryCodeMap[market.country]
				);
				if (savedData) {
					return {
						...market,
						localPrice: savedData.local_price || 0,
						shipping: savedData.shipping || 20,
						deliveryFee: savedData.delivery_fee || 0,
						taxRate: savedData.tax_rate || 0,
						exchangeRate: savedData.exchange_rate || 0,
						profit: savedData.profit || 0,
						profitRate: savedData.profit_rate || 0
					};
				}
				return market;
			});
		}

		// 使用组件提供的编辑方法
		Upsert.value?.edit({
			...row,
			// 显式保留关键字段
			id: row.id,
			asin: row.asin,
			marketplace: row.marketplace,
			sku: 123
		});

		await nextTick();
		initCharts(); // 每次打开都重新初始化
		updateCharts(row);
	} catch (error) {
		console.error("编辑时发生错误:", error);
		ElMessage.error("初始化编辑表单失败");
	}
};

const selectedMarket = ref("ALL");

// 增加提交状态
const isSubmitting = ref(false);

// 修改提交方法
const handleSubmit = async () => {
	try {
		const countryCodeMap: Record<string, string> = {
			英国: "UK",
			德国: "DE",
			法国: "FR",
			西班牙: "ES",
			意大利: "IT"
		};

		const payload = {
			candidate_id: Upsert.value?.form.id, // 主表ID
			common: {
				cost: common.cost,
				length: common.length,
				width: common.width,
				height: common.height,
				actual_weight: common.actualWeight
			},
			markets: markets.value.map((market) => ({
				country_code: countryCodeMap[market.country],
				local_price: market.localPrice,
				shipping: market.shipping,
				delivery_fee: market.deliveryFee,
				exchange_rate: market.exchangeRate,
				tax_rate: market.taxRate,
				profit: market.profit,
				profit_rate: market.profitRate
			}))
		};
		console.log("Payload:", payload);
		await service.app.bsr_candidate.saveProfit(payload);

		if (Upsert.value?.form) {
			Upsert.value.form.profit_calculation_status = 1;
		}
		// 调用状态更新接口
		await service.app.bsr_candidate.batch_update_profit_status({
			profit_calculation_status: 1,
			candidate_id: Upsert.value?.form.id
		});

		ElMessage.success("数据保存成功");
		Crud.value?.refresh();
	} catch (error) {
		ElMessage.error("保存失败");
	}
};

let calculatorInitialized = false;

const salesChart = ref<HTMLElement>();
const keywordChart = ref<HTMLElement>();
let salesChartInstance: echarts.ECharts | null = null;
let keywordChartInstance: echarts.ECharts | null = null;

// 初始化图表
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
function markTop10ByAsin(list: any[]) {
	// 按国家 + ASIN 双重维度分组
	const groups = list.reduce((groups: Record<string, any[]>, item) => {
		// 使用国家+ASIN作为复合键
		const groupKey = `${item.marketplaces}-${item.asin}`;
		if (!groups[groupKey]) groups[groupKey] = [];
		groups[groupKey].push(item);
		return groups;
	}, {});

	// 处理每个国家+ASIN组合的独立分组
	Object.values(groups).forEach((group: any[]) => {
		// 过滤有效数字并排序
		const sortedGroup = [...group]
			.filter((item) => typeof item.trafficPercentage === "number")
			.sort((a, b) => b.trafficPercentage - a.trafficPercentage);

		// 严格取前10条
		const top10Items = sortedGroup.slice(0, 10);

		// 重置组内所有条目
		group.forEach((item) => (item.is_core = 0));

		// 标记当前组的top10
		top10Items.forEach((item) => (item.is_core = 1));
	});
}
function openCompetitorDetail(row: any) {
	openProductLinks2(row);
}

function openProductLinks3(row: any) {
	const asin = row.asin_competitor || row.asin;
	const cleanAsin = asin.replace(/[^A-Z0-9]/g, "");
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, row.marketplace);
	window.open(dpUrl);
}

/** 选中品名后未填比例时给默认 1，避免提交时 groupProportions 为空 */
function ensureVariantGroupProportions(row: any) {
	if (!row) return;
	row.groupProportions = row.groupProportions || {};
	(row.selectedGroups || []).forEach((name: string) => {
		if (row.groupProportions[name] == null || row.groupProportions[name] === "") {
			row.groupProportions[name] = 1;
		}
	});
}

// 获取指定国家父体销量最高的竞品标题
async function getHighestSalesCompetitorTitle(candidateId: string, marketplace: string): Promise<string> {
	try {
		const response = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			marketplace: marketplace,
			size: 1000,
			sort: 'desc',
			order: 'Main_monthly_sales',
			status: [1, 2, 9]
		});

		if (response.list && response.list.length > 0) {
			return response.list[0].item_name || '';
		}
		return '';
	} catch (error) {
		console.error(`获取${marketplace}竞品标题失败:`, error);
		return '';
	}
}

async function addVariant(scope: any) {
	if (!scope.variant_Combination) {
		scope.variant_Combination = [];
	}

	let ukTitle = '';
	let deTitle = '';

	if (scope.id && (scope.competitor_import_status === 1 || scope.competitor_import_status === '1')) {
		try {
			[ukTitle, deTitle] = await Promise.all([
				getHighestSalesCompetitorTitle(scope.id, '英国'),
				getHighestSalesCompetitorTitle(scope.id, '德国')
			]);
		} catch (error) {
			console.error('获取竞品标题失败:', error);
		}
	}

	scope.variant_Combination.push({
		id: uuid(),
		description: "",
		name: "",
		image_url: scope.image_url,
		selectedGroups: [], // 存储选中的品名
		groupProportions: {}, // 使用品名作为key的比例对象
		uk_title: ukTitle,
		de_title: deTitle
	});
}
function deleteVariant(scope: any, index: number) {
	scope.variant_Combination.splice(index, 1);
}

const formatNumber = (value: number | undefined) => {
	if (typeof value !== "number") return "0.00";
	if (value === Infinity) return "0.00";
	if (value === -Infinity) return "0.00";
	return value.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
};

// 定义国家列表和映射关系
const countries = ["英国", "德国"] as const;
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

function swapMainImage(row: any, clickedField: string) {
	// 保存当前主图URL
	const temp = row.image_url;

	// 将被点击的图片设为新的主图
	row.image_url = row[clickedField];

	// 将原来的主图放到被点击的位置
	row[clickedField] = temp;

	// 更新显示用的主图（如果用到计算属性的话）
	row.image_url_display = convert_image_url(row.image_url);

	// 如果需要自动保存到服务器，可以在这里添加更新请求
	service.app.bsr_candidate.update(row);
}

// 更新图表数据
const updateCharts = async (row: any) => {
	try {
		const [competitors, keywords] = await Promise.all([
			service.app.bsr_candidate_competitor.page({
				candidate_id: row.id,
				size: 1000,
				status: 2
			}),
			service.app.keyword.page({ asin: row.asin, size: 1000, is_core: 1 })
		]);

		const salesData = processSalesData(competitors.list);
		const keywordData = processKeywordData(keywords.list);
		countries.forEach((country) => {
			const chartEl = document.getElementById(`combined-chart-${countryCodeMap[country]}`);
			if (chartEl) {
				const chart = echarts.init(chartEl);
				chart.setOption(
					getCombinedChartOption(`${country} 销量与关键词搜索量对比`, salesData[country], keywordData[country])
				);
			}
		});
	} catch (error) {
		console.error("图表更新失败", error);
	}
};

// 合并图表配置生成器
const getCombinedChartOption = (title: string, salesData: [string, number][], keywordData: [string, number][]) => {
	const monthSet = new Set<string>();
	const salesMap = new Map(salesData);
	const keywordMap = new Map(keywordData);

	salesData.forEach(([m]) => monthSet.add(m));
	keywordData.forEach(([m]) => monthSet.add(m));

	const xData = Array.from(monthSet).sort();
	const seriesSales = xData.map((m) => salesMap.get(m) || 0);
	const seriesKeyword = xData.map((m) => keywordMap.get(m) || 0);

	return {
		title: { text: title, left: "center" },
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
		legend: { data: ["销量", "搜索量"], bottom: 0 },
		grid: { left: "3%", right: "3%", bottom: "10%", containLabel: true },
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
		yAxis: [
			{
				type: "value",
				name: "销量",
				position: "left",
				axisLine: { show: true, lineStyle: { color: "#5470C6" } },
				axisLabel: { formatter: "{value}" }
			},
			{
				type: "value",
				name: "搜索量",
				position: "right",
				axisLine: { show: true, lineStyle: { color: "#91CC75" } },
				axisLabel: { formatter: "{value}" }
			}
		],
		series: [
			{
				name: "销量",
				type: "bar",
				yAxisIndex: 0,
				data: seriesSales,
				itemStyle: { color: "#5470C6", borderRadius: 4 },
				emphasis: { itemStyle: { shadowBlur: 10 } }
			},
			{
				name: "搜索量",
				type: "bar",
				yAxisIndex: 1,
				data: seriesKeyword,
				itemStyle: { color: "#91CC75", borderRadius: 4 },
				emphasis: { itemStyle: { shadowBlur: 10 } }
			}
		]
	};
};

const parseDimensions = (str: string) => {
	const matches = str?.match(/(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)/);
	return matches ? [matches[1], matches[2], matches[3]] : null;
};

const applyDimensionsAndWeight = (row: any) => {
	const dims = parseDimensions(row.dimensions || "");
	if (dims) {
		common.length = parseFloat(dims[0]);
		common.width = parseFloat(dims[1]);
		common.height = parseFloat(dims[2]);
	}

	if (row.weight) {
		const weightKg = parseFloat(row.weight.replace(/[^\d.]/g, "")) / 1000;
		common.actualWeight = isNaN(weightKg) ? 0 : weightKg;
	}
};

const applyPriceAndDelivery = (row: any) => {
	const targetMarket = markets.value.find((m) => getMarketName(m.country) === row.marketplace);

	if (!targetMarket) {
		ElMessage.warning(`未找到对应国家配置：${row.marketplace}`);
		return;
	}

	// 带类型转换的赋值逻辑
	const shouldUpdatePrice = Number(row?.price) > 0;
	const shouldUpdateDelivery = Number(row?.FBA_price) > 0;

	// 条件式更新对象
	const updates = {
		...(shouldUpdatePrice && { localPrice: Number(row.price) }),
		...(shouldUpdateDelivery && { deliveryFee: Number(row.FBA_price) })
	};

	if (Object.keys(updates).length > 0) {
		Object.assign(targetMarket, updates);
	} else {
		ElMessage.warning("价格和运费均为空或0，未执行更新");
	}
};

const handleBatchUpdateStatus = async () => {
	try {
		await service.app.bsr_candidate.batch_update_all_status();
		ElMessage.success("状态更新成功");
		Crud.value?.refresh();
	} catch (err) {
		ElMessage.error("更新失败: " + err);
	}
};

// 新增打开多链接方法
function openProductLinks(row: any) {
	// 原始产品链接
	const cleanAsin = row.asin.replace(/[^A-Z0-9]/g, "");
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, row.marketplace);

	// StyleSnap 链接（处理图片尺寸）
	// const styleSnapUrl = `https://www.amazon.co.uk/stylesnap?q=${row.image_url?.replace(/_AC_US\d+/, '_AC_US500') || ''}`;
	const styleSnapUrl = appConfig.get_amazon_url_picture_search(
		row.image_url?.replace(/_AC_US\d+/, "_AC_US500") || "",
		row.marketplace
	);
	// 搜索链接（处理标题关键词）
	const keywords = row.item_name
		?.split(/[\s,]+/) // 按空格和逗号分割
		?.filter((_: string, i: number) => i > 0) // 跳过第一个单词
		?.slice(0, 5) // 取前5个单词
		?.join("+"); // 用加号连接

	// const searchUrl = `https://www.amazon.co.uk/s?k=${keywords || ''}`;
	const searchUrl = appConfig.get_amazon_url_keyword_search(keywords, row.marketplace);

	// 同时打开三个窗口
	window.open(dpUrl);
	window.open(styleSnapUrl);
	window.open(searchUrl);
}

// 新增打开多链接方法
function openProductLinks2(row: any) {
	const cleanAsin = row.asin.replace(/[^A-Z0-9]/g, "");
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, row.marketplace);
	window.open(dpUrl);
}

const deliveryFeeConfig = {
	// 英国配送费配置
	UK: {
		lightweightEnvelope: [
			{ maxWeight: 0.02, fee: 1.83 },
			{ maxWeight: 0.04, fee: 1.87 },
			{ maxWeight: 0.06, fee: 1.89 },
			{ maxWeight: 0.08, fee: 2.07 },
			{ maxWeight: 0.1, fee: 2.08 }
		],
		standardEnvelope: [
			{ maxWeight: 0.21, fee: 2.1 },
			{ maxWeight: 0.46, fee: 2.16 }
		],
		largeEnvelope: {
			maxWeight: 0.96,
			fee: 2.72
		},
		xlEnvelope: {
			maxWeight: 0.96,
			fee: 2.94
		},
		smallParcel: [
			{ maxWeight: 0.15, fee: 2.91 },
			{ maxWeight: 0.4, fee: 3.0 },
			{ maxWeight: 0.9, fee: 3.04 },
			{ maxWeight: 1.4, fee: 3.05 },
			{ maxWeight: 1.9, fee: 3.25 },
			{ maxWeight: 3.9, fee: 5.1 }
		],
		standardParcel: [
			{ maxWeight: 0.15, fee: 2.94 },
			{ maxWeight: 0.4, fee: 3.01 },
			{ maxWeight: 0.9, fee: 3.06 },
			{ maxWeight: 1.4, fee: 3.26 },
			{ maxWeight: 1.9, fee: 3.48 },
			{ maxWeight: 2.9, fee: 4.73 },
			{ maxWeight: 3.9, fee: 5.16 },
			{ maxWeight: 5.9, fee: 5.19 },
			{ maxWeight: 8.9, fee: 5.57 },
			{ maxWeight: 11.9, fee: 5.77 }
		],
		smallOversize: (() => {
			const baseFee = 3.65;
			const increment = 0.25;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})(),
		standardOversize: (() => {
			const baseFee = 4.67;
			const increment = 0.24;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})()
	},
	// 德国配送费配置
	DE: {
		lightweightEnvelope: [
			{ maxWeight: 0.02, fee: 2.33 },
			{ maxWeight: 0.04, fee: 2.37 },
			{ maxWeight: 0.06, fee: 2.39 },
			{ maxWeight: 0.08, fee: 2.52 },
			{ maxWeight: 0.1, fee: 2.54 }
		],
		standardEnvelope: [
			{ maxWeight: 0.21, fee: 2.57 },
			{ maxWeight: 0.46, fee: 2.68 }
		],
		largeEnvelope: {
			maxWeight: 0.96,
			fee: 3.04
		},
		xlEnvelope: {
			maxWeight: 0.96,
			fee: 3.42
		},
		smallParcel: [
			{ maxWeight: 0.15, fee: 3.38 },
			{ maxWeight: 0.4, fee: 3.4 },
			{ maxWeight: 0.9, fee: 3.67 },
			{ maxWeight: 1.4, fee: 4.29 },
			{ maxWeight: 1.9, fee: 4.49 },
			{ maxWeight: 3.9, fee: 5.57 }
		],
		standardParcel: [
			{ maxWeight: 0.15, fee: 3.39 },
			{ maxWeight: 0.4, fee: 3.78 },
			{ maxWeight: 0.9, fee: 3.9 },
			{ maxWeight: 1.4, fee: 4.54 },
			{ maxWeight: 1.9, fee: 4.97 },
			{ maxWeight: 2.9, fee: 5.2 },
			{ maxWeight: 3.9, fee: 5.67 },
			{ maxWeight: 5.9, fee: 5.95 },
			{ maxWeight: 8.9, fee: 6.41 },
			{ maxWeight: 11.9, fee: 6.65 }
		],
		smallOversize: (() => {
			const baseFee = 4.79;
			const increment = 0.48;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})(),
		standardOversize: (() => {
			const baseFee = 4.91;
			const increment = 0.29;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})()
	},

	// 法国配送费配置
	FR: {
		lightweightEnvelope: [
			{ maxWeight: 0.02, fee: 2.75 },
			{ maxWeight: 0.04, fee: 2.76 },
			{ maxWeight: 0.06, fee: 2.78 },
			{ maxWeight: 0.08, fee: 3.3 },
			{ maxWeight: 0.1, fee: 3.32 }
		],
		standardEnvelope: [
			{ maxWeight: 0.21, fee: 3.33 },
			{ maxWeight: 0.46, fee: 3.77 }
		],
		largeEnvelope: {
			maxWeight: 0.96,
			fee: 4.39
		},
		xlEnvelope: {
			maxWeight: 0.96,
			fee: 4.72
		},
		smallParcel: [
			{ maxWeight: 0.15, fee: 4.56 },
			{ maxWeight: 0.4, fee: 5.07 },
			{ maxWeight: 0.9, fee: 5.79 },
			{ maxWeight: 1.4, fee: 5.87 },
			{ maxWeight: 1.9, fee: 6.1 },
			{ maxWeight: 3.9, fee: 9.1 }
		],
		standardParcel: [
			{ maxWeight: 0.15, fee: 4.58 },
			{ maxWeight: 0.4, fee: 5.4 },
			{ maxWeight: 0.9, fee: 6.28 },
			{ maxWeight: 1.4, fee: 6.41 },
			{ maxWeight: 1.9, fee: 6.84 },
			{ maxWeight: 2.9, fee: 9.36 },
			{ maxWeight: 3.9, fee: 9.55 },
			{ maxWeight: 5.9, fee: 9.67 },
			{ maxWeight: 8.9, fee: 10.53 },
			{ maxWeight: 11.9, fee: 11.03 }
		],
		smallOversize: (() => {
			const baseFee = 7.23;
			const increment = 0.24;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})(),
		standardOversize: (() => {
			const baseFee = 7.61;
			const increment = 0.38;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})()
	},

	// 西班牙配送费配置
	ES: {
		lightweightEnvelope: [
			{ maxWeight: 0.02, fee: 2.77 },
			{ maxWeight: 0.04, fee: 2.84 },
			{ maxWeight: 0.06, fee: 2.87 },
			{ maxWeight: 0.08, fee: 3.21 },
			{ maxWeight: 0.1, fee: 3.23 }
		],
		standardEnvelope: [
			{ maxWeight: 0.21, fee: 3.26 },
			{ maxWeight: 0.46, fee: 3.45 }
		],
		largeEnvelope: {
			maxWeight: 0.96,
			fee: 3.6
		},
		xlEnvelope: {
			maxWeight: 0.96,
			fee: 3.85
		},
		smallParcel: [
			{ maxWeight: 0.15, fee: 3.52 },
			{ maxWeight: 0.4, fee: 3.74 },
			{ maxWeight: 0.9, fee: 3.95 },
			{ maxWeight: 1.4, fee: 4.21 },
			{ maxWeight: 1.9, fee: 4.27 },
			{ maxWeight: 3.9, fee: 5.5 }
		],
		standardParcel: [
			{ maxWeight: 0.15, fee: 3.55 },
			{ maxWeight: 0.4, fee: 4.05 },
			{ maxWeight: 0.9, fee: 4.45 },
			{ maxWeight: 1.4, fee: 4.85 },
			{ maxWeight: 1.9, fee: 4.94 },
			{ maxWeight: 2.9, fee: 4.98 },
			{ maxWeight: 3.9, fee: 5.53 },
			{ maxWeight: 5.9, fee: 7.02 },
			{ maxWeight: 8.9, fee: 7.24 },
			{ maxWeight: 11.9, fee: 7.85 }
		],
		smallOversize: (() => {
			const baseFee = 5.86;
			const increment = 0.1;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})(),
		standardOversize: (() => {
			const baseFee = 6.91;
			const increment = 0.47;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})()
	},

	// 意大利配送费配置
	IT: {
		lightweightEnvelope: [
			{ maxWeight: 0.02, fee: 3.23 },
			{ maxWeight: 0.04, fee: 3.26 },
			{ maxWeight: 0.06, fee: 3.28 },
			{ maxWeight: 0.08, fee: 3.39 },
			{ maxWeight: 0.1, fee: 3.41 }
		],
		standardEnvelope: [
			{ maxWeight: 0.21, fee: 3.45 },
			{ maxWeight: 0.46, fee: 3.64 }
		],
		largeEnvelope: {
			maxWeight: 0.96,
			fee: 3.94
		},
		xlEnvelope: {
			maxWeight: 0.96,
			fee: 4.17
		},
		smallParcel: [
			{ maxWeight: 0.15, fee: 4.13 },
			{ maxWeight: 0.4, fee: 4.54 },
			{ maxWeight: 0.9, fee: 4.95 },
			{ maxWeight: 1.4, fee: 5.51 },
			{ maxWeight: 1.9, fee: 5.81 },
			{ maxWeight: 3.9, fee: 6.93 }
		],
		standardParcel: [
			{ maxWeight: 0.15, fee: 4.29 },
			{ maxWeight: 0.4, fee: 4.7 },
			{ maxWeight: 0.9, fee: 5.15 },
			{ maxWeight: 1.4, fee: 5.81 },
			{ maxWeight: 1.9, fee: 6.05 },
			{ maxWeight: 2.9, fee: 6.71 },
			{ maxWeight: 3.9, fee: 6.96 },
			{ maxWeight: 5.9, fee: 7.25 },
			{ maxWeight: 8.9, fee: 8.04 },
			{ maxWeight: 11.9, fee: 8.63 }
		],
		smallOversize: (() => {
			const baseFee = 7.39;
			const increment = 0.12;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})(),
		standardOversize: (() => {
			const baseFee = 7.78;
			const increment = 0.38;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})()
	}
};

// 确定包裹类型
function determinePackageType(length: number, width: number, height: number, weight: number) {
	// 排序尺寸：从大到小
	const dimensions = [length, width, height].sort((a, b) => b - a);
	const [longest, middle, shortest] = dimensions;

	// 计算体积重量 (kg) = (长×宽×高) / 5000
	const volumetricWeight = (length * width * height) / 5000;
	const effectiveWeight = Math.max(weight, volumetricWeight);

	// 检查信封类型
	if (longest <= 33 && middle <= 23) {
		if (shortest <= 2.5 && effectiveWeight <= 0.1) return "lightweightEnvelope";
		if (shortest <= 2.5 && effectiveWeight <= 0.46) return "standardEnvelope";
		if (shortest <= 4 && effectiveWeight <= 0.96) return "largeEnvelope";
		if (shortest <= 6 && effectiveWeight <= 0.96) return "xlEnvelope";
	}

	// 检查小包裹
	if (longest <= 35 && middle <= 25 && shortest <= 12 && effectiveWeight <= 3.9) {
		return "smallParcel";
	}

	// 检查标准包裹
	if (longest <= 45 && middle <= 34 && shortest <= 26 && effectiveWeight <= 11.9) {
		return "standardParcel";
	}

	// 检查小号大件
	if (longest <= 61 && middle <= 46 && shortest <= 46 && effectiveWeight <= 1.76) {
		return "smallOversize";
	}

	// 检查标准大件
	if (longest <= 120 && middle <= 60 && shortest <= 60 && effectiveWeight <= 29.76) {
		return "standardOversize";
	}

	// 其他情况视为大件
	return "largeOversize";
}

// 计算配送费
const isCalculatingFees = ref(false);

async function calculateDeliveryFee() {
	try {
		isCalculatingFees.value = true;

		// 获取尺寸参数
		const dimensions = [common.length, common.width, common.height].sort((a, b) => a - b); // 从小到大排序

		const [shortest, middle, longest] = dimensions;
		const effectiveWeight = Math.max(volumetricWeight.value, common.actualWeight);

		// 确定包裹类型
		const packageType = determinePackageType(
			common.length,
			common.width,
			common.height,
			common.actualWeight
		);

		if (!packageType) {
			ElMessage.warning("无法确定包裹类型，请检查尺寸和重量是否符合标准");
			return;
		}

		// 更新各国的配送费
		markets.value.forEach((market) => {
			const countryCode =
				market.country === "英国"
					? "UK"
					: market.country === "德国"
						? "DE"
						: market.country === "法国"
							? "FR"
							: market.country === "西班牙"
								? "ES"
								: "IT";

			const countryConfig = deliveryFeeConfig[countryCode];
			const packageConfig = countryConfig[packageType];

			if (!packageConfig) {
				ElMessage.warning(`${market.country}没有${packageType}类型的配送费配置`);
				return;
			}

			// 处理不同类型的包裹
			if (Array.isArray(packageConfig)) {
				// 处理重量分段（包裹类型）
				let fee = 0;
				for (const tier of packageConfig) {
					if (effectiveWeight <= tier.maxWeight) {
						fee = tier.fee;
						break;
					}
				}
				// 如果重量超过最大分段，使用最后一个分段的费用
				if (fee === 0 && packageConfig.length > 0) {
					fee = packageConfig[packageConfig.length - 1].fee;
				}
				market.deliveryFee = fee;
			} else {
				// 处理固定费用的类型（信封）
				market.deliveryFee = packageConfig.fee;
			}
		});

		ElMessage.success(`配送费计算完成，包裹类型: ${packageType}`);
	} catch (error) {
		console.error("计算配送费失败", error);
		ElMessage.error("计算配送费失败");
	} finally {
		isCalculatingFees.value = false;
	}
}

// 添加新组
const addGroup = (type: string) => {
	const groupId = Date.now().toString(); // 生成唯一组ID

	// 添加新组时确保 factory_links 数组存在
	if (!Upsert.value?.form.factory_links) {
		Upsert.value.form.factory_links = [];
	}

	Upsert.value?.form.factory_links.push({
		id: `link-${Date.now()}`,
		groupId,
		type,
		name: "",
		price: 0,
		user_input: "",
		user_input_description: "",
		isFirst: true
	});
};

const groupedFactoryLinks = computed(() => {
	const links = Upsert.value?.form.factory_links || [];

	// 按 groupId 分组
	const groupMap = new Map<string, any[]>();
	links.forEach((link) => {
		const groupId = link.groupId;
		if (!groupMap.has(groupId)) {
			groupMap.set(groupId, []);
		}
		groupMap.get(groupId)?.push(link);
	});

	// 构建表格数据
	const groups: any[] = [];
	groupMap.forEach((groupLinks, groupId) => {
		// 按创建顺序排序
		groupLinks.sort((a, b) => {
			// 确保第一个链接在最前面
			if (a.isFirst) return -1;
			if (b.isFirst) return 1;
			return 0;
		});

		groups.push(...groupLinks);
	});

	return groups;
});

// 单元格合并方法
const linkSpanMethod = ({ row, column, rowIndex, columnIndex }: any) => {
	// 只对类型和品名列进行合并
	if (column.property === "type" || column.property === "name") {
		if (row.isFirst) {
			// 计算该组有多少行
			const groupLinks = groupedFactoryLinks.value.filter((l) => l.groupId === row.groupId);
			return {
				rowspan: groupLinks.length,
				colspan: 1
			};
		}
		return {
			rowspan: 0,
			colspan: 0
		};
	}
};

// 获取类型标签样式
const getTypeTagType = (type: string) => {
	return (
		{
			main: "primary",
			accessory: "success",
			packing: "warning"
		}[type] || "info"
	);
};

// 获取类型标签文本
const getTypeLabel = (type: string) => {
	return (
		{
			main: "主体",
			accessory: "配件",
			packing: "包装"
		}[type] || type
	);
};

const copyDialogVisible = ref(false);
const copyCount = ref(1);
const copyBaseName = ref("");
const copyBaseGroupId = ref("");
const copyPreview = ref<{ suffix: string }[]>([]);
const copyBaseData = ref<any>(null);
const copyBaseGroupLinks = ref<any[]>([]);

function openCopyDialog(row: any) {
	const groupId = row.groupId;

	// 获取整个组的所有链接
	copyBaseGroupLinks.value =
		Upsert.value?.form.factory_links.filter((link: any) => link.groupId === groupId) || [];

	if (copyBaseGroupLinks.value.length === 0) return;

	copyBaseName.value = copyBaseGroupLinks.value[0].name;
	copyBaseGroupId.value = groupId;
	copyCount.value = 1;
	updateCopyPreview();
	copyDialogVisible.value = true;
}

function updateCopyPreview() {
	copyPreview.value = Array(copyCount.value)
		.fill(0)
		.map(() => ({ suffix: "" }));
}

function confirmCopy() {
	const newLinks: any[] = [];

	for (let i = 0; i < copyCount.value; i++) {
		const suffix = copyPreview.value[i].suffix;
		const newGroupId = `group-${Date.now()}-${i}`; // 生成新组ID

		// 复制组内所有链接
		copyBaseGroupLinks.value.forEach((link, index) => {
			const newLink = {
				isFirst: false,
				price: link.price,
				user_input: link.user_input,
				type: link.type,
				id: `link-${Date.now()}-${i}-${index}`,
				groupId: newGroupId,
				name: `${copyBaseName.value}${suffix ? `-${suffix}` : ""}`
			};

			// 如果是组内第一个链接，则标记为isFirst
			if (index === 0) {
				newLink.isFirst = true;
			} else {
				newLink.isFirst = false;
			}

			newLinks.push(newLink);
		});
	}

	// 添加到工厂链接列表
	Upsert.value?.form.factory_links.push(...newLinks);

	copyDialogVisible.value = false;
	ElMessage.success(`成功复制 ${copyCount.value} 个组`);
}

watch(copyCount, (newVal) => {
	if (newVal > 10) copyCount.value = 10;
	updateCopyPreview();
});

const handleNameInput = (row: any) => {
	// 当修改组内第一个链接的名称时，自动更新组内其他链接的名称
	if (row.isFirst) {
		const groupId = row.groupId;
		const newName = row.name;

		Upsert.value?.form.factory_links.forEach((link) => {
			if (link.groupId === groupId && !link.isFirst) {
				link.name = newName;
			}
		});
	}
};

// 添加备选链接
const addAlternativeLink = (groupId: string) => {
	// 获取组内第一个链接作为模板
	const firstLink = Upsert.value?.form.factory_links.find(
		(l) => l.groupId === groupId && l.isFirst
	);

	if (firstLink) {
		Upsert.value?.form.factory_links.push({
			id: `link-${Date.now()}`,
			groupId,
			type: firstLink.type,
			name: firstLink.name, // 默认使用组内第一个链接的名称
			price: 0,
			user_input: "",
			user_input_description: "",
			isFirst: false
		});
	}
};

// 删除链接或组
const removeLink = (groupId: string, linkId: string) => {
	const links = Upsert.value?.form.factory_links || [];

	// 查找要删除的链接
	const linkIndex = links.findIndex((l) => l.id === linkId);
	if (linkIndex === -1) return;

	const linkToRemove = links[linkIndex];

	// 如果是组内的第一条，则删除整个组
	if (linkToRemove.isFirst) {
		Upsert.value.form.factory_links = links.filter((l) => l.groupId !== groupId);
	} else {
		// 否则只删除单条链接
		Upsert.value.form.factory_links = links.filter((l) => l.id !== linkId);
	}
};

const uniqueProductNames = computed(() => {
	const links = Upsert.value?.form.factory_links || [];
	const seen = new Set<string>();
	const result: { name: string; type: string }[] = []; // 关键修复

	for (const link of links) {
		if (link.name && !seen.has(link.name)) {
			seen.add(link.name);
			result.push({ name: link.name, type: link.type }); // 不再报错
		}
	}
	return result;
});

function flexibleMapping(item: any) {
	const mapping: Record<string, string> = {
		ASIN: "asin",
		国家: "marketplace"
	};

	const newItem: any = {};

	// 处理基础字段映射
	Object.keys(mapping).forEach((chineseKey) => {
		if (item.hasOwnProperty(chineseKey)) {
			newItem[mapping[chineseKey]] = item[chineseKey];
		}
	});

	// 处理可能存在的英文字段
	Object.values(mapping).forEach((key) => {
		if (!newItem[key] && item.hasOwnProperty(key)) {
			newItem[key] = item[key];
		}
	});

	return newItem;
}

function onSubmit(data: any, { close }: any) {
	// 第一步：分组处理相同 ASIN+国家的记录
	const groupedData: Record<string, any> = {};

	data.list.forEach((item: any) => {
		const mappedItem = flexibleMapping(item);
		const key = `${mappedItem.asin}_${mappedItem.marketplace}`;

		if (!groupedData[key]) {
			// 创建新分组
			groupedData[key] = {
				...mappedItem,
				source: 1,
				brand_names2: []
			};
		}

		// 获取品牌词和备注
		const brandName = item["品牌词"] || item["brand_name"];
		const remark = item["备注"] || item["remark"] || item["reason"];

		// 如果有有效品牌词，添加到分组
		if (brandName && brandName.trim()) {
			groupedData[key].brand_names2.push({
				brand_name: brandName.trim(),
				reason: remark ? remark.trim() : "导入数据备注"
			});
		}
	});

	// 第二步：将分组数据转换为数组
	const processedList = Object.values(groupedData);

	// 第三步：分批提交
	batchSubmit(processedList, 100)
		.then(() => {
			ElMessage.success("所有数据已成功导入");
			close();
		})
		.catch(() => {
			ElMessage.error("部分数据导入失败");
		});
}

// 分批提交函数保持不变
async function batchSubmit(dataList: any[], batchSize = 100) {
	const batches: any[][] = [];
	for (let i = 0; i < dataList.length; i += batchSize) {
		batches.push(dataList.slice(i, i + batchSize));
	}

	for (let index = 0; index < batches.length; index++) {
		const batch = batches[index];
		try {
			await service.app.bsr_candidate.addbrandNames(batch);
		} catch (err: any) {
			ElMessage.error(`第 ${index + 1} 批提交失败: ${err.message || "未知错误"}`);
			return Promise.reject(err);
		}
	}
	return Promise.resolve();
}

const handleLocalImageSelect = (e, row) => {
	const file = e.target.files[0];
	if (!file) return;

	// 校验图片格式
	const isImage = file.type.startsWith("image/");
	if (!isImage) {
		ElMessage.error("请选择图片格式文件（JPG、PNG、GIF等）");
		e.target.value = ""; // 重置文件输入框
		return;
	}

	// 校验图片大小（限制2MB，可调整）
	const maxSize = 2 * 1024 * 1024; // 2MB
	if (file.size > maxSize) {
		ElMessage.error("图片大小不能超过2MB");
		e.target.value = ""; // 重置文件输入框
		return;
	}

	// 使用 FileReader 读取本地图片为 base64 格式
	const reader = new FileReader();

	// 读取成功后，直接赋值给 row.image_url（自动替换原有图片）
	reader.onload = (event) => {
		// 保存原图片URL（可选：用于回退）
		row.originalImageUrl = row.image_url;

		// 关键：将本地图片的 base64 赋值给 row.image_url，实现即时替换
		row.image_url = event.target.result;

		// 提示用户
		ElMessage.success(row.originalImageUrl ? "图片已成功替换" : "图片选择成功");

		// 重置文件输入框，允许重复选择同一张图片
		e.target.value = "";
	};

	// 读取失败处理
	reader.onerror = () => {
		ElMessage.error("图片读取失败，请重试");
		e.target.value = "";
	};

	// 开始读取文件（转换为 base64）
	reader.readAsDataURL(file);
};

// 悬停时加载竞品图片
const loadCompetitorImages = async (candidateId: string, row: any) => {
	if (row._competitorImagesLoaded || row._loadingImages) return;

	if (!candidateId) {
		row._competitorImagesLoaded = true;
		return;
	}

	row._loadingImages = true;
	try {
		const response = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			size: 1000,
			status: [1, 2, 9] // 有效状态的竞品
		});

		const competitors = response.list || [];
		const images = new Set<string>();

		competitors.forEach((c: any) => {
			if (c.image_url) {
				images.add(c.image_url);
			}
		});

		row._competitorImages = Array.from(images);
	} catch (error) {
		console.error("加载竞品图片失败:", error);
	} finally {
		row._loadingImages = false;
		row._competitorImagesLoaded = true;
	}
};
</script>

<style scoped>
/* 调整后的样式 */
.country-group {
	display: flex;
	flex-direction: column;
	gap: 16px;
	height: 100%;
}

.chart-container {
	flex: 1;
	background: #fff;
	border-radius: 8px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	padding: 12px;
	transition: all 0.3s;

	&:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}
}

/* 响应式调整 */
@media (max-width: 1200px) {
	.el-col {
		flex: 0 0 33.3333%;
		max-width: 33.3333%;
	}
}

@media (max-width: 768px) {
	.el-col {
		flex: 0 0 50%;
		max-width: 50%;
	}
}

@media (max-width: 480px) {
	.el-col {
		flex: 0 0 100%;
		max-width: 100%;
	}

	.compact-chart {
		height: 160px !important;
	}
}

.country-column {
	position: relative;
	margin-bottom: 4px;
}

.chart-container {
	border: 1px solid #ebeef5;
	border-radius: 4px;
	padding: 8px;
	transition: all 0.3s;

	&:hover {
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
	}
}

.compact-chart {
	min-height: 120px;
}

.country-label {
	text-align: center;
	font-size: 12px;
	color: #606266;
	padding-top: 6px;
	margin-top: 4px;
	border-top: 1px dashed #ebeef5;
}

/* 响应式适配 */
@media (max-width: 1600px) {
	.compact-chart {
		height: 100px !important;
	}

	.country-label {
		font-size: 11px;
	}
}

.proportion-container {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 8px;
}

.node-stats-container {
	padding: 16px;
}

.stats-title {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 12px;
}

.node-grid {
	display: grid;
	grid-template-columns: repeat(var(--columns), 1fr);
	gap: 16px;
}

@media (max-width: 1200px) {
	.node-grid {
		--columns: 2 !important;
	}
}

@media (max-width: 768px) {
	.node-grid {
		--columns: 1 !important;
	}
}

.node-card {
	border: 1px solid var(--el-border-color);
	border-radius: 8px;
	padding: 16px;
	height: 100%;
	transition: all 0.3s;
}

.node-card:hover {
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.node-header {
	margin-bottom: 12px;
	border-bottom: 1px dashed var(--el-border-color);
	padding-bottom: 8px;
}

.node-name {
	font-size: 14px;
	color: var(--el-text-color-primary);
	line-height: 1.4;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.node-metrics {
	display: flex;
	justify-content: space-around;
	width: 100%;
}

.metric-box {
	text-align: center;
	padding: 8px;
	flex: 1;
}

.metric-label {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	margin-bottom: 4px;
}

.metric-value {
	font-size: 16px;
	font-weight: 600;
}

.count .metric-value {
	color: var(--el-color-primary);
}

.volume .metric-value {
	color: var(--el-color-success);
}

.calculator-card {
	margin: 20px 0;
	padding: 20px;
}

.common-params {
	margin-bottom: 20px;
}

.dimension-weight {
	margin-bottom: 20px;
}

.dimension-inputs,
.weight-inputs {
	display: flex;
	gap: 10px;

	:deep(.el-input-number) {
		flex: 1;
	}
}

.market-table {
	margin-top: 20px;

	:deep(.cell) {
		padding: 8px;
	}
}

.profit-display {
	text-align: right;
	line-height: 1.4;

	div:first-child {
		color: var(--el-color-success);
		font-weight: 500;
	}

	div:last-child {
		color: var(--el-text-color-secondary);
		font-size: 0.9em;
	}

	.profit-calculator {
		background: #f8f9fa;
		border-radius: 8px;
	}

	.common-params {
		padding: 16px;
		margin-bottom: 16px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
	}

	:deep(.custom-header) th {
		background-color: #f5f7fa !important;
		font-weight: 600;
		color: #606266;
	}

	.profit-display {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		line-height: 1.4;
	}

	.amount {
		font-size: 14px;
		font-family: monospace;
	}

	.rate {
		font-size: 12px;
		opacity: 0.8;
	}

	.el-input-number :deep(.el-input__inner) {
		text-align: center;
		padding-left: 5px;
		padding-right: 5px;
	}

	.el-form-item {
		margin-bottom: 12px;
	}
}

.filter-header {
	display: flex;
	align-items: center;
	padding: 8px 12px;
}

.node-stats-container {
	padding: 8px;
}

.market-section {
	margin-bottom: 12px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 6px;
	padding: 8px;
}

.compact-node {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 6px 8px;
	margin: 4px 0;
	background: var(--el-fill-color-light);
	border-radius: 4px;
}

.compact-node .el-text {
	flex: 1;
	margin-right: 8px;
	font-size: 12px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.node-grid {
	display: grid;
	gap: 8px;
	grid-template-columns: repeat(var(--columns), 1fr);
}

/* 响应式调整 */
@media (max-width: 1200px) {
	.node-grid {
		--columns: 3 !important;
	}
}

@media (max-width: 768px) {
	.node-grid {
		--columns: 2 !important;
	}
}

.el-tag {
	height: 24px;
	line-height: 24px;
	padding: 0 6px;
}

/* FBA列变宽（原flex:1 → flex:2） */
.fba-wide-column {
	flex: 2 !important;
	min-width: 400px; /* 确保窄屏时不挤压 */
}

/* FBM/自营列缩小一半（原flex:1 → flex:0.5） */
.narrow-column {
	flex: 0.5 !important;
	min-width: 150px; /* 确保内容能正常显示 */
}

.compact-data-grid {
	display: flex;
	gap: 6px;
	/* 缩小列间距 */
	margin-top: 8px;
}

.data-column {
	flex: 1;
	min-width: 0;
	padding: 8px 6px;
	/* 缩小内边距 */
	background: #f8f9fa;
	border-radius: 4px;
}

.column-title {
	font-size: 18px !important;
	/* 标题放大 */
	margin-bottom: 8px;
}

.data-line {
	font-size: 15px;
	/* 正文放大 */
	line-height: 1.4;
	/* 调小行高保持紧凑 */
}

.data-line span {
	min-width: 38px;
	/* 标签宽度缩小 */
	font-size: 15px;
	/* 标签字体略小 */
	color: #909399;
}

/* 价格区间特殊处理 */
.compact-price {
	letter-spacing: -0.3px;
	font-size: 12.5px;
	/* 略小于正文 */
}

/* 日期显示优化 */
.compact-date {
	font-size: 12px;
}

/* 国家标题放大 */
.market-title {
	font-size: 20px !important;
	padding: 6px 0;
}

.market-block {
	margin-bottom: 12px;
}

/* 新增响应式样式 */
.node-grid {
	--columns: 4;
	--sm-columns: 2;
	--xs-columns: 1;

	display: grid;
	gap: 8px;
	grid-template-columns: repeat(var(--columns), minmax(120px, 1fr));
}

@media screen and (max-width: 1200px) {
	.node-grid {
		grid-template-columns: repeat(var(--sm-columns), minmax(100px, 1fr));
	}
}

@media screen and (max-width: 768px) {
	.node-grid {
		grid-template-columns: repeat(var(--xs-columns), minmax(80px, 1fr));
	}
}

.compact-node {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 6px 8px;
	min-width: 0;
	/* 新增：允许内容收缩 */
}

.compact-node .el-text {
	flex: 1;
	min-width: 0;
	/* 新增：解决flex布局截断问题 */
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.competitor-apply {
	margin: 16px 0;
	border-radius: 8px;

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px;
		border-bottom: 1px solid var(--el-border-color);
	}

	:deep(.el-table) {
		margin-top: 12px;

		.el-table__cell {
			padding: 8px 12px;
		}
	}

	.el-button {
		margin-left: 8px;
	}
}

.table-container {
	padding: 20px;
}

.image-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
}

.thumbnail-wrapper {
	width: 50px;
	height: 50px;
	border-radius: 4px;
	overflow: hidden;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: #f5f7fa;
	border: 1px solid #ebeef5;
	cursor: pointer;
}

.thumbnail-wrapper .preview-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	transition: transform 0.3s ease;
}

.thumbnail-wrapper:hover .preview-img {
	transform: scale(1.1);
}

.no-image {
	color: #909399;
	font-size: 12px;
}

.url-input {
	width: 100px;
}

.proportion-container {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	justify-content: center;
}

.proportion-item {
	display: flex;
	align-items: center;
}

.el-table .cell {
	display: flex;
	align-items: center;
	justify-content: center;
}

.popover-image {
	max-width: 280px;
	max-height: 280px;
	border-radius: 4px;
}
</style>
