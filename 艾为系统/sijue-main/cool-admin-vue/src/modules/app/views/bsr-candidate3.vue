<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<!-- <cl-multi-delete-btn /> -->

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
			<!-- <cl-add-btn /> -->
			<batch-update-bsr-candidate-status :Crud="Crud" />

			<!-- <batch-update-competitor-spider-status :Crud="Crud" /> -->

			<batch-open-dp-link :Crud="Crud" />
			<el-button
				v-permission="service.app.bsr_candidate.sync_from_FX"
				@click="syncFX()"
				type="success"
			>
				从领星同步汇率信息
			</el-button>

			<el-button type="primary" @click="ProcessExportOfSelectedPurchases">
				导出勾选采购数据
			</el-button>

			<cl-flex1 />

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

			<el-space direction="horizontal" >
				<el-text>仅展示不做</el-text>
				<el-switch
					v-model="showOnlyStatusReject"
					active-text="是"
					inactive-text="否"
					inline-prompt
				></el-switch>
				<el-divider direction="vertical"></el-divider>
			</el-space>

			<bsr-candidate-filter-status />

			<cl-search-key placeholder="模糊搜索" />
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

				<template #column-factory_links="{ scope }">
					<el-popover placement="right" trigger="hover" :width="300">
						<template #reference>
							<el-button type="text" icon="Link" circle></el-button>
						</template>
						<div v-for="(link, index) in scope.row.factory_links" :key="index">
							<el-link
								:href="ensureFullUrl(link.user_input)"
								target="_blank"
								type="primary"
								@click.stop
							>
								{{ extractDomain(link.user_input) }}
							</el-link>
						</div>
					</el-popover>
				</template>

				<template #slot-management-buttons="{ scope }">
					<!-- <el-button size="default" type="success" text bg
            @click="updateStatus(scope.row, appConfig.BSR_CANDIDATE_STATUS.LIBRARY2.value)">
            精选
          </el-button> -->
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

			<template #slot-opinion_operator="{ scope }">
				<!-- 其他部分保持不变 -->
				<el-form-item>
					<!-- 新增意见编辑区 -->
					<el-input
						v-model="newOpinion"
						type="textarea"
						:rows="2"
						placeholder="请输入新的运营意见"
						class="new-opinion"
					/>

					<!-- 历史意见（只读） -->
					<el-input
						v-if="isEditMode"
						:model-value="formatHistoryOpinions"
						type="textarea"
						:rows="10"
						readonly
						class="history-opinions"
					/>
				</el-form-item>
			</template>

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
											size="small"
											placeholder="或输入图片URL"
											:disabled="row.locked"
											class="url-input"
											style="margin-top: 5px"
										/>
									</div>
								</div>
							</template>
						</el-table-column>

						<el-table-column label="工厂链接组合" width="350" align="center">
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
								<el-popover
									placement="right"
									:width="300"
									trigger="hover"
									v-model:visible="row.showTooltip"
								>
									<template #reference>
										<el-input
											v-model="row.description"
											placeholder="变体描述"
											size="small"
											:disabled="row.locked"
										/>
									</template>
									<div class="procurement-tooltip-content">
										{{ row.description || "无描述" }}
									</div>
								</el-popover>
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
					type="warning"
					v-if="sysName != 'woeau'"
					@click="handleGeneratePurchaseOrder(scope)"
				>
					生成采购单
				</el-button>

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
				<div class="purchase-section">
					<el-table
						:data="computeGroupedPurchasers(scope.purchasers)"
						border
						style="width: 100%"
						empty-text="暂无采购计划"
						:span-method="spanMethod"
					>
						<!-- 国家列 -->
						<el-table-column
							v-for="country in countries2"
							:key="country.code"
							:label="country.name"
							:prop="country.code"
							width="110"
						>
							<template #default="{ row }">
								<el-input
									v-model.number="row.purchaserNum[country.code]"
									type="number"
									:min="0"
									placeholder="数量"
									controls-position="right"
									style="width: 95px"
									:disabled="!canEditPurchaserQuantity(row, country.code)"
									@input="handleInputChange(scope, row)"
								/>
							</template>
						</el-table-column>

						<el-table-column label="状态" width="120" align="center">
							<template #default="{ row }">
								<el-tag
									:type="
										row.is_generate === 2
											? 'success'
											: row.is_generate === 0
												? 'danger'
												: 'info'
									"
									effect="plain"
								>
									{{
										row.is_generate === 2
											? "✅ 已确认"
											: row.is_generate === 0
												? "❌ 已取消"
												: row.is_generate === 3
													? "⏳ 待决策(满)"
													: row.is_generate === 4
														? "❌ 分配不可做"
														: "⏳ 待决策"
									}}
								</el-tag>
							</template>
						</el-table-column>

						<el-table-column label="采购意见" width="200" align="center">
							<template #default="{ row }">
								<!-- 输入框组件 -->
								<div class="procurement-opinion-container">
									<el-popover
										placement="left"
										:width="300"
										trigger="hover"
										v-model:visible="row.showTooltip"
									>
										<template #reference>
											<el-input
												v-model="row.procurement"
												placeholder="输入意见..."
												size="small"
												class="procurement-input"
											/>
										</template>
										<div class="procurement-tooltip-content">
											{{ row.procurement || "无意见" }}
										</div>
									</el-popover>
								</div>
							</template>
						</el-table-column>

						<el-table-column label="不做理由" width="180" align="center">
							<template #default="{ row }">
								<el-tooltip
									v-if="row.reject_reason"
									:content="row.reject_reason"
									placement="top"
									:hide-after="0"
								>
									<el-text truncated>{{ row.reject_reason }}</el-text>
								</el-tooltip>
								<el-text v-else type="info">-</el-text>
							</template>
						</el-table-column>

						<el-table-column
							v-if="canManagePurchaserAllocation"
							label="开发调整"
							width="140"
							align="center"
						>
							<template #default="{ row }">
								<el-select
									:model-value="row.is_generate"
									size="small"
									style="width: 120px"
									@change="(value) => handleDeveloperDecisionChange(scope, row, value)"
								>
									<el-option
										v-for="item in purchaserDecisionOptions"
										:key="item.value"
										:label="item.label"
										:value="item.value"
									/>
								</el-select>
							</template>
						</el-table-column>

						<el-table-column label="选择变体" width="140" align="center">
							<template #default="{ row }">
								<el-select
									v-model="row.selectedVariantId"
									placeholder="选择变体"
									size="small"
									style="width: 100%; margin-top: 5px"
									clearable
								>
									<el-option
										v-for="(variant, index) in Upsert?.form
											.variant_Combination || []"
										:key="variant.id || index"
										:label="variant.name"
										:value="variant.id"
									/>
								</el-select>
							</template>
						</el-table-column>

						<!-- 合计列 -->
						<el-table-column label="合计" width="80" align="center" prop="groupTotal">
							<template #default="{ row }">
								{{ row.groupTotal }}
							</template>
						</el-table-column>

						<!-- 提交人列 -->
						<el-table-column label="提交人" width="100" align="center" prop="purchaser">
							<template #default="{ row }">
								<el-tag type="info">{{ row.purchaser }}</el-tag>
							</template>
						</el-table-column>

						<!-- 账户名称列：直接使用 bsr_candidate/info 返回的账户选项 -->
						<el-table-column align="center" prop="account_name" width="180">
							<template #header>
								<span>账户名称</span>
								<el-text type="danger" style="margin-left: 2px">*</el-text>
							</template>
							<template #default="{ row }">
								<el-select
									v-model="row.seller_account_id"
									placeholder="请选择账户"
									size="small"
									style="width: 100%"
									@change="handleAccountChange(row)"
									:class="{ 'required-field': !row.seller_account_id }"
								>
									<el-option
										v-for="acc in getSellerAccountOptions()"
										:key="acc.seller_account_id"
										:label="acc.account_name"
										:value="acc.seller_account_id"
									/>
								</el-select>
							</template>
						</el-table-column>

						<el-table-column label="操作" width="80" align="center">
							<template #default="{ row }">
								<el-button type="danger" size="small" @click="deletePurchaser(row)">
									删除
								</el-button>
							</template>
						</el-table-column>
					</el-table>
					<div class="total-purchase">
						<el-text type="primary" size="large"
							>采购总数: {{ scope.total || 0 }}</el-text
						>
					</div>
					<div class="purchase-actions">
						<el-button type="success" @click="handleDecision(scope, 2)"> 做 </el-button>
						<el-button type="danger" @click="handleDecision(scope, 0)">
							不做
						</el-button>
						<el-button type="primary" @click="addRowPurchaserNum(scope.id)">
							+ 添加采购数量
						</el-button>
					</div>
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

			<template #slot-updateTime="{ scope }">
				<div>
					<el-form-item v-for="(item, index) in scope.updateTime" :key="index">
						<el-input
							v-model="item.purchaser3"
							:placeholder="`采购时间 ${index + 1}`"
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
								<div class="sales-info-filter-panel">
									<el-text type="primary" size="small"
										>各国销量信息数据范围</el-text
									>
									<div class="sales-info-filter-buttons">
										<el-button
											:type="salesChartMode === 'all' ? 'primary' : 'default'"
											size="small"
											@click="handleSalesChartModeChange('all')"
										>
											切换成全部数据
										</el-button>
										<el-button
											:type="
												salesChartMode === 'same' ? 'primary' : 'default'
											"
											size="small"
											@click="handleSalesChartModeChange('same')"
										>
											切换成同款数据
										</el-button>
										<el-button
											:type="
												salesChartMode === 'nonSame' ? 'primary' : 'default'
											"
											size="small"
											@click="handleSalesChartModeChange('nonSame')"
										>
											切换成非同款数据
										</el-button>
									</div>
								</div>
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
												<!-- 竞品销量前五自然/广告分 -->
												<div
													v-if="competitorTop5Scores && competitorTop5Scores[getMarketName(market)]"
													class="competitor-score-line"
													style="margin-top:6px"
												>
													<el-popover placement="right" trigger="hover" :width="280">
														<template #reference>
															<span class="competitor-score-summary" style="font-size:12px">
																<span>前五自然/广告分：</span>
																<el-tag type="success" size="small">自然 {{ competitorTop5Scores[getMarketName(market)].totalOrganic }}</el-tag>
																<el-tag type="warning" size="small" style="margin-left:4px">广告 {{ competitorTop5Scores[getMarketName(market)].totalAd }}</el-tag>
															</span>
														</template>
														<template #default>
															<div style="font-size:13px; line-height:1.8">
																<div
																	v-for="comp in competitorTop5Scores[getMarketName(market)].competitors"
																	:key="comp.asin"
																>
																	<span style="color:#409eff">{{ comp.asin }}</span>
																	<span style="margin-left:8px">自然:{{ comp.keyword_organic_score }}</span>
																	<span style="margin-left:4px">广告:{{ comp.keyword_ad_score }}</span>
																</div>
															</div>
														</template>
													</el-popover>
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
											<div class="data-line">
												<span>非同款竞品asin占比数：</span
												>{{
													scope.delivery_volumes?.[market]
														?.nonSameAsinCount || 0
												}}/{{
													scope.delivery_volumes?.[market]
														?.totalAsinCount || 0
												}}（{{
													(
														scope.delivery_volumes?.[market]
															?.nonSameAsinPercentage || 0
													).toFixed(2)
												}}%）
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
						<!-- 在保存按钮处绑定点击事件 -->
						<!-- <el-button
    type="primary"
    @click="handleSubmit"
    :loading="isSubmitting">
    保存利润数据
  </el-button> -->
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
import { useCool } from "/@/cool";
import { uuid } from "/@/cool/utils";
import {
	convert_image_url,
	ensureCandidateIds,
	is_admin,
	validateBsrCandidateVariants
} from "/$/app/utils";
import { boostProductImages, preloadProductImages } from "/$/app/utils/product-image-loading";
import ResilientProductImage from "/$/app/components/resilient-product-image.vue";
import { Delete, EditPen, GoodsFilled, Memo } from "@element-plus/icons-vue";
import { ref, watch, reactive } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
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
import ClTableColumnPopoverContent from "/$/app/components/cl-table-column-popover-content.vue";
import BatchOpenDpLink from "/$/app/components/batch-open-dp-link.vue";
import { onMounted, onUnmounted } from "vue";
import * as echarts from "echarts";
import axios from "axios";
import { computed, nextTick } from "vue";
import dayjs from "dayjs";
import ListingKeyword from "/$/app/components/listing-keyword.vue";
import pinyin from "pinyin";

const { service } = useCool();

import { useUserStore } from "/$/base/store/user";
import upsert from "/~/crud/src/components/upsert";
import { size } from "lodash-es";

const userStore = useUserStore();
const departmentId = userStore.info?.departmentId;

const normalizeRoleValues = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value.flatMap((item) => normalizeRoleValues(item));
	}

	return String(value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
};

const isDeveloperRole = (value: string) => value === "开发" || value.toLowerCase() === "developer";
const hasDeveloperRole = (userInfo: any) => {
	const roleValues = [
		...normalizeRoleValues(userInfo?.roleName),
		...normalizeRoleValues(userInfo?.roleLabels)
	];
	return roleValues.some(isDeveloperRole);
};

const getUserIdentityValues = (userInfo: any): string[] => {
	return [userInfo?.name, userInfo?.nickName, userInfo?.username]
		.map((item) => String(item ?? "").trim())
		.filter(Boolean);
};

const canManagePurchaserAllocation = computed(() => {
	const userInfo = userStore.info as any;
	return hasDeveloperRole(userInfo);
});
const canBypassPurchaserDataFilter = computed(() => {
	const userInfo = userStore.info as any;
	const userIdentityValues = getUserIdentityValues(userInfo);
	return Boolean(
		hasDeveloperRole(userInfo) ||
			userIdentityValues.includes("admin") ||
			userIdentityValues.includes("超级管理员") ||
			userIdentityValues.includes("胡忠勇")
	);
});
const purchaserDecisionOptions = [
	{ label: "待决策", value: 1 },
	{ label: "做", value: 2 },
	{ label: "不做", value: 0 },
	{ label: "分配不可做", value: 4 }
];

const keywordManagementPaneVisible = ref(false);
const curEditingListing = ref();

const Crud = useCrud(
	{
		service: service.app.bsr_candidate,
		async onRefresh(params, { next, done, render }) {
			if (showOnlyStatusLibrary.value)
				Object.assign(params, { status: appConfig.BSR_CANDIDATE_STATUS.LIBRARY2.value });

			// 获取数据列表
			const { list } = await next({
				...params
			});

			if (!canBypassPurchaserDataFilter.value) {
				// 批量请求所有购买者数据
				const purchaserRequests = list.map((item) => {
					return service.app.bsr_candidate_purchaser
						.page({
							size: 20,
							candidate_id: item.id
						})
						.catch(() => null); // 防止请求失败导致中断
				});

				// 等待所有请求完成
				const purchaserResults = await Promise.all(purchaserRequests);

				// 根据 purchaser 数据进行过滤
				const filteredList = list.filter((item, index) => {
					const purchaserData = purchaserResults[index];
					// 获取返回的 purchaser 数据
					if (purchaserData && purchaserData.list && purchaserData.list.length > 0) {
						if (showOnlyStatusReject.value) {
							// 仅展示不做
							const hasRejectPurchaser = purchaserData.list.some((purchaser) => {
								return (
									isCurrentPurchaserRow(purchaser) &&
									purchaser.is_generate === 0
								);
							});
							if (hasRejectPurchaser) {
								return true;
							}
						} else {
							// 判断是否有符合条件的 purchaser
							const hasInvalidPurchaser = purchaserData.list.some((purchaser) => {
								return (
									isCurrentPurchaserRow(purchaser) &&
									(purchaser.is_generate === 1 ||
										purchaser.is_generate === 2 ||
										purchaser.is_generate === 3)
								);
							});
							// 如果有符合条件的 purchaser，不显示该条 bsr_candidate 数据
							if (hasInvalidPurchaser) {
								return true;
							}
						}
					}

					// 如果没有不符合条件的 purchaser，不做过滤
					return false; // 2024: 确保正确过滤
				});
				if (Table.value) {
					Table.value.data = filteredList; // 更新表格数据
				}
				// 处理每条数据的其他信息
				filteredList.forEach((item) => {
					item.image_url_display = convert_image_url(item.image_url);
					if (item.delivery_volumes) {
						item.fba_max_price = item.delivery_volumes.FBA?.max_price || 0;
						item.fba_min_price = item.delivery_volumes.FBA?.min_price || 0;
						item.fbm_max_price = item.delivery_volumes.FBM?.max_price || 0;
						item.fbm_min_price = item.delivery_volumes.FBM?.min_price || 0;
					}
				});

				// 渲染表格，传递 filteredList 作为参数
				render(filteredList);
				preloadProductImages(filteredList, { reason: "bsr-candidate3" });
			} else {
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
				preloadProductImages(rows, { reason: "bsr-candidate3" });
			}

			// 更新表格数据
		}
	},
	(app) => {
		app.refresh();
	}
);

const showOnlyStatusLibrary = ref(true);
const showOnlyStatusReject = ref(false);
watch(
	[showOnlyStatusLibrary, showOnlyStatusReject],
	() => void setTimeout(Crud?.value?.refresh(), 200)
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
			showOverflowTooltip: true,
			minWidth: 50,
			fixed: "left"
		},
		{ label: "sku", prop: "sku", minWidth: 50, showOverflowTooltip: true, fixed: "left" },
		{ label: "价格", prop: "price", minWidth: 70, sortable: "custom" , fixed: "left" },
		// {
		//   label: "状态", prop: "status",
		//   dict: [
		//     { label: "待入库", value: appConfig.BSR_CANDIDATE_STATUS.PENDING.value, type: 'primary' },
		//     { label: "待精选", value: appConfig.BSR_CANDIDATE_STATUS.LIBRARY.value, type: 'warning' },
		//     { label: "已精选", value: appConfig.BSR_CANDIDATE_STATUS.LIBRARY2.value, type: 'success' },
		//     { label: "已归档", value: appConfig.BSR_CANDIDATE_STATUS.ARCHIVED.value, type: 'info' },
		//   ],
		//   width: 80, showOverflowTooltip: true, sortable: "custom",
		// },
		{
			label: "工厂链接",
			prop: "factory_links",
			minWidth: 50
		},
		{ label: "BSR 链接", prop: "bsr_link", minWidth: 50, showOverflowTooltip: true },
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
				// {
				// 	label: "爬虫数据*",
				// 	prop: "competitor_spider_res",
				// 	width: 95,
				// 	hidden: !is_admin.value
				// },
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

const isFileUploading = ref(false);
const Upsert = useUpsert({
	dialog: {
		width: "1600",
		top: "10vh"
	},
	async onInfo(data, { next, done }) {
		let newData = await next(data);

		serverVariantVersion.value = newData.variant_version || 0;
		localVariantVersion.value = serverVariantVersion.value;

		// 新增：获取配送类型销量数据
		const deliveryVolumes = isEditMode.value
			? await calculateDeliveryVolumes(newData.id)
			: null;

		// 获取竞品前五自然/广告分
		if (isEditMode.value && newData.id) {
			fetchCompetitorTop5Scores(newData.id);
		}
		// if (newData.purchaserNum) {
		//   newData.purchaserNum = newData.purchaserNum.map(item => ({
		//     ...item.purchaserNum, // 展开JSON字段
		//     purchaser: item.purchaser,
		//     createTime: item.createTime,
		//     is_generate: item.is_generate
		//   }));
		// }
		// 为工厂链接、变体补全稳定 id（UUID），便于引用
		const factory_links = (newData.factory_links || []).map((link: any) =>
			typeof link === "object" && link !== null ? { ...link, id: link.id || uuid() } : link
		);
		const variant_Combination = (newData.variant_Combination || []).map((v: any) =>
			v && typeof v === "object" ? { ...v, id: v.id || uuid() } : v
		);

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

		done({
			...newData,
			factory_links,
			variant_Combination,
			sellerAccountOptions: newData.sellerAccountOptions || [],
			delivery_volumes: deliveryVolumes,
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
							disabled: computed(() => isEditMode.value) // 编辑时禁用
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
							disabled: computed(() => isEditMode.value) // 编辑时禁用
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
							disabled: computed(() => isEditMode.value) // 编辑时禁用
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
							disabled: computed(() => isEditMode.value),

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
					span: 12
				},
				{
					label: "产品标题",
					prop: "item_name",
					component: {
						name: "el-input",
						props: {
							type: "textarea",
							autosize: { minRows: 1, maxRows: 6 },
							resize: "none",
							disabled: computed(() => isEditMode.value)
						}
					}
				},
				{
					label: "评论数",
					prop: "review_num",
					component: {
						name: "el-input-number",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "评价星级",
					prop: "last_star",
					component: {
						name: "el-rate",
						props: { "show-score": true, disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "价格",
					prop: "price",
					component: {
						name: "el-input-number",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "BSR排名",
					prop: "bsr_rank",
					component: {
						name: "el-input-number",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "尺寸",
					prop: "dimensions",
					component: {
						name: "el-input",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "重量",
					prop: "weight",
					component: {
						name: "el-input",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "卖家国家",
					prop: "seller_country",
					component: {
						name: "el-input",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "上架时间",
					prop: "date_first_available",
					component: {
						name: "el-date-picker",
						props: {
							type: "date",
							valueFormat: "YYYY-MM-DD",
							disabled: computed(() => isEditMode.value)
						}
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

		{ label: "产品名称", prop: "produce_name", component: { name: "el-input" }, span: 12 },
		{ label: "sku", prop: "sku", component: { name: "el-input" }, span: 12 },
		{
			label: "主图",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 250, fit: "contain" } },
			fixed: "left"
		},
		{
			prop: "sale_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "各国销量信息及分析图表",
					expand: false,
					isExpand: true
				}
			},
			children: [
				{
					component: { name: "slot-charts" }
				},
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
				// {
				//   label: '运营意见', prop: 'opinion_operator',
				//   component: { name: 'el-input', props: { type: 'textarea', autosize: { minRows: 2, maxRows: 6 } } },
				//   hidden: isHidden1
				// },
				// 原columns配置中：
				// {
				//   label: '运营意见',
				//   prop: 'opinion_operator',
				//   component: {
				//     name: 'el-input',
				//     props: {
				//       type: 'textarea',
				//       autosize: { minRows: 2, maxRows: 6 },
				//       // 增加以下样式
				//       style: { whiteSpace: 'pre-wrap' }
				//     }
				//   },
				//   formatter(row) {
				//     return row.opinion_operator?.replace(/\n/g, '\n\n');
				//   }
				// },
				{
					label: "运营意见",
					prop: "opinion_operator",
					component: { name: "slot-opinion_operator" },
					hidden: isHidden2
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
					component: { name: "slot-factory_links" },
					hidden: isHidden2
				},
				{
					label: "最大采购量",
					prop: "max_purchase",
					component: {
						name: "el-input",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 20
				},
				{
					label: "采购数量",
					prop: "purchaserNum",
					// value: [_getAnEmptyPurchaserNumItem()],
					component: { name: "slot-purchaserNum" },
					span: 100,
					hidden: isHidden2
				},
				// {
				//   label: '提交采购人', prop: 'purchaser',
				//   value :[_getAnEmptyPurchaserItem()],
				//   component: {name: 'slot-purchaser'},
				//   span: 10,
				//   hidden: isHidden2
				// },
				// {
				//   label: '提交时间', prop: 'updateTime',
				//   component: {name: 'slot-updateTime'},
				//   value :[_getAnEmptyPurchaserTimeItem()],
				//   span: 8,
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

			const user = userStore.info?.name;
			const timestamp = dayjs().format("YYYY-MM-DD HH:mm");

			data.variant_version = serverVariantVersion.value;
			data.new_variant_version = localVariantVersion.value + 1;

			if (data.variant_version !== serverVariantVersion.value) {
				ElMessage.warning("变体数据已被他人修改，请刷新页面获取最新数据");
				done();
				return;
			}

			const vr = validateBsrCandidateVariants(data);
			if (!vr.valid) {
				ElMessage.warning(vr.message);
				done();
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

			// 生成带时间戳的新意见

			// 获取并处理历史意见
			if (newOpinion.value.trim() !== "") {
				const newEntry = `[${user} ${timestamp}]：${newOpinion.value.trim()}`;
				const currentData = await service.app.bsr_candidate.info({ id: data.id });
				const history = (currentData.opinion_operator || "").split("\n\n").filter(Boolean);

				// 将新意见添加到最前面
				const updatedOpinions = [newEntry, ...history].join("\n");

				// 更新数据并重置输入
				data.opinion_operator = updatedOpinions;
			}
			newOpinion.value = "";

			data.describe = data.describe
				.map((item) => {
					item.describe1 = item.describe1.trim();
					return item;
				})
				.filter((item) => item.describe1);
			// data.purchaserNum = data.purchaserNum.map(item => ({
			//   candidate_id: data.id,
			//   purchaser: userStore.info?.name,
			//   purchaserNum: {  // 保持与表结构一致
			//     uk: item.purchaserNum?.uk,
			//     de: item.purchaserNum?.de,
			//     fr: item.purchaserNum?.fr,
			//     es: item.purchaserNum?.es,
			//     it: item.purchaserNum?.it,
			//   },
			//   is_generate: 1
			// }))
			delete data.purchaserNum;
		} catch (err) {
			console.log(err);
		}
		await next(data);
	},
	op: {
		buttons: ["close", "slot-btns"]
	}
});

const newOpinion = ref("");
const formatHistoryOpinions = computed(() => {
	const existing = Upsert.value?.form.opinion_operator || "";
	return existing.split("\n\n").reverse().join("\n\n");
});

function _getAnEmptyDescribeItem() {
	return { describe1: "" };
}

function addRowDescribe() {
	if (!Upsert.value?.form.describe) {
		Upsert.value.form.describe = [];
	}
	Upsert.value?.form.describe.push(_getAnEmptyDescribeItem());
}

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

// 在 methods 中添加 addRowPurchaserNum 方法
async function addRowPurchaserNum(id: string) {
	const currentUser = userStore.info?.name;
	const currentUserId = userStore.info?.id;

	// 创建新的采购记录对象
	const newPurchaser = {
		purchaserNum: {
			uk: 0,
			de: 0,
			fr: 0,
			es: 0,
			it: 0
		},
		procurement: "",
		purchaser: currentUser,
		userId: currentUserId,
		is_generate: 1,
		selectedVariant: "",
		selectedVariantId: null,
		candidate_id: id,
		id: null,
		seller_account_id: null,
		account_name: "",
		reject_reason: ""
	};

	// 添加到采购人数组
	if (!Upsert.value?.form.purchasers) {
		Upsert.value.form.purchasers = [];
	}

	Upsert.value.form.purchasers.push(newPurchaser);
	// 4. 事务批量插入
	const response = await service.app.bsr_candidate_purchaser.add(newPurchaser);
	newPurchaser.id = response.id;
}

function getSellerAccountOptions() {
	return Upsert.value?.form?.sellerAccountOptions || [];
}

// 处理账户选择变化
function handleAccountChange(row: any) {
	const acc = getSellerAccountOptions().find(
		(item: any) => String(item.seller_account_id) === String(row.seller_account_id)
	);
	if (acc) {
		row.account_name = acc.account_name;
		service.app.bsr_candidate_purchaser.update({
			id: row.id,
			seller_account_id: row.seller_account_id,
			account_name: row.account_name
		});
	}
}

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

// 处理国家筛选变化
const handleCompetitorCountryChange = () => {
	// 可以添加额外的逻辑，比如记录筛选行为等
};

const countries2 = [
	{ name: "英国", code: "uk" },
	{ name: "德国", code: "de" }
	// { name: '法国', code: 'fr' },
	// { name: '西班牙', code: 'es' },
	// { name: '意大利', code: 'it' }
];

async function promptRejectReason(defaultValue = "") {
	try {
		const { value } = await ElMessageBox.prompt("请输入不做的理由", "不做理由", {
			confirmButtonText: "确定",
			cancelButtonText: "取消",
			inputType: "textarea",
			inputValue: defaultValue,
			inputPlaceholder: "请输入不做理由",
			inputValidator(value: string) {
				return Boolean(String(value || "").trim()) || "不做理由不能为空";
			},
			inputErrorMessage: "不做理由不能为空"
		});
		return String(value || "").trim();
	} catch {
		return null;
	}
}

async function handleDeveloperDecisionChange(scope: any, row: any, value: number) {
	if (!canManagePurchaserAllocation.value) return;
	const status = Number(value);
	let rejectReason = "";
	if (status === 0) {
		const input = await promptRejectReason(row.reject_reason || "");
		if (input == null) return;
		rejectReason = input;
	}
	if (status === 2 && (!row.seller_account_id || (!row.selectedVariantId && !row.selectedVariant))) {
		ElMessage.warning("设为做前，请先选择账户和变体");
		return;
	}
	try {
		const payload = {
			candidateId: scope.id,
			purchasers: [
				{
					id: row.id,
					purchaser: row.purchaser,
					purchaserNum: row.purchaserNum || {},
					country_enabled: row.country_enabled,
					is_generate: status,
					procurement: row.procurement || "",
					reject_reason: status === 0 ? rejectReason : "",
					selectedVariantId: row.selectedVariantId,
					selectedVariant: row.selectedVariant,
					seller_account_id: row.seller_account_id,
					account_name: row.account_name
				}
			]
		};
		const syncRes = await (service as any).app.bsr_candidate_purchaser.request({
			url: "/batchUpdateAndSync",
			method: "POST",
			data: payload
		});
		const syncData = syncRes?.data ?? syncRes;
		if (syncData?.designTaskSyncSkipped) {
			ElMessage.warning(DESIGN_TASK_SYNC_SKIPPED_MSG);
		}
		row.is_generate = status;
		row.reject_reason = status === 0 ? rejectReason : "";
		ElMessage.success("分配状态已更新");
	} catch (error) {
		console.error("开发调整分配失败:", error);
		ElMessage.error("分配状态更新失败，请稍后重试");
	}
}

// 新增合计计算方法
const calculateTotal = (row: Record<string, number>) => {
	return countries2.reduce((sum, c) => sum + (row.purchaserNum[c.code] || 0), 0);
};

// 计算分组后的采购数据
const computeGroupedPurchasers = (purchasers: any[]) => {
	if (!purchasers) return [];

	// 先按照提交人分组
	const groups: Record<string, any[]> = {};
	purchasers.forEach((row) => {
		if (!groups[row.purchaser]) {
			groups[row.purchaser] = [];
		}
		groups[row.purchaser].push(row);
	});

	// 计算每个提交人的总合计
	Object.keys(groups).forEach((purchaser) => {
		const groupRows = groups[purchaser];
		let groupTotal = 0;

		// 计算行合计和组合计
		groupRows.forEach((row) => {
			row.rowTotal = calculateRowTotal(row); // 新增行合计
			groupTotal += row.rowTotal;
		});

		// 将总合计和行数附加到每一行上
		groupRows.forEach((row, index) => {
			row.groupTotal = groupTotal; // 组合计
			row.rowspan = index === 0 ? groupRows.length : 0;
		});
	});

	// 按照提交人名字排序并展开
	const sortedKeys = Object.keys(groups).sort();
	const result: any[] = [];
	sortedKeys.forEach((key) => {
		result.push(...groups[key]);
	});

	return result;
};

const parseEnabledBoolean = (value: unknown): boolean => {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value === 1;
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		return normalized === "true" || normalized === "1";
	}
	return false;
};

const isEditablePurchaserStatus = (row: any): boolean => [1, 2].includes(Number(row?.is_generate));

const getCurrentUserNames = (): string[] => {
	const userInfo = userStore.info as any;
	return getUserIdentityValues(userInfo);
};

const isCurrentPurchaserRow = (row: any): boolean => {
	const currentUserId = String(userStore.info?.id ?? "").trim();
	const rowUserId = String(row?.userId ?? "").trim();
	if (currentUserId && rowUserId && currentUserId === rowUserId) return true;

	const rowPurchaser = String(row?.purchaser ?? "").trim();
	return Boolean(rowPurchaser && getCurrentUserNames().includes(rowPurchaser));
};

const countryCodeNameMap: Record<string, string> = {
	uk: "英国",
	de: "德国"
};

const parseCountryScope = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value.map((item) => String(item || "").trim()).filter(Boolean);
	}
	if (typeof value === "string") {
		const text = value.trim();
		if (!text) return [];
		try {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed)) {
				return parsed.map((item) => String(item || "").trim()).filter(Boolean);
			}
		} catch {
			return text.split(",").map((item) => item.trim()).filter(Boolean);
		}
	}
	return [];
};

const getOperationCountryScope = (row?: any): string[] => {
	if (row && Object.prototype.hasOwnProperty.call(row, "operation_country_scope")) {
		return parseCountryScope(row.operation_country_scope);
	}
	const userInfo = userStore.info as any;
	return parseCountryScope(userInfo?.operation_country_scope);
};

const getOperationCountryEnabled = (countryCode: string, row?: any): boolean | null => {
	const scope = getOperationCountryScope(row);
	if (scope.length === 0) return null;
	const countryName = countryCodeNameMap[countryCode] || countryCode;
	const normalizedScope = scope.map((item) => item.toLowerCase());
	return scope.includes(countryName) || normalizedScope.includes(countryCode.toLowerCase());
};

// 检查采购员是否对该国家启用了采购数量输入
const getCountryEnabled = (row: any, countryCode: string): boolean => {
	const scopeEnabled = getOperationCountryEnabled(countryCode, row);
	if (scopeEnabled === false) return false;

	if (!row.country_enabled) {
		return scopeEnabled ?? true; // 向后兼容：无国家限制则默认启用
	}
	try {
		const countryEnabled =
			typeof row.country_enabled === "string"
				? JSON.parse(row.country_enabled)
				: row.country_enabled;
		const hasAnyEnabledCountry = countries2.some((country) =>
			parseEnabledBoolean(countryEnabled?.[country.code])
		);
		if (isEditablePurchaserStatus(row) && !hasAnyEnabledCountry) {
			return scopeEnabled ?? true;
		}

		return parseEnabledBoolean(countryEnabled?.[countryCode]) && (scopeEnabled ?? true);
	} catch {
		return scopeEnabled ?? true;
	}
};

const canEditPurchaserQuantity = (row: any, countryCode: string): boolean => {
	return isEditablePurchaserStatus(row) && getCountryEnabled(row, countryCode);
};

// 单元格合并方法
const spanMethod = ({ row, column, rowIndex, columnIndex }: any) => {
	// 只对提交人和合计列进行合并
	if (column.property === "purchaser" || column.property === "groupTotal") {
		if (row.rowspan > 0) {
			return { rowspan: row.rowspan, colspan: 1 };
		} else {
			return { rowspan: 0, colspan: 0 };
		}
	}
};
// 输入验证
const validateNumber = (row: any, field: string) => {
	row[field] = row[field].replace(/[^\d]/g, "");
};

function DeleteRowDescribe(index: number) {
	Upsert.value?.form.describe.splice(index, 1);
}

const DeleteRowPurchaserNum = (index: number) => {
	Upsert.value?.form.purchaserNum.splice(index, 1);
};
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
	let oldStatus = candidate?.status;
	try {
		candidate.status = status;
		await Crud.value?.service.update({
			id: candidate.id,
			status
		});
		ElMessage({ message: "更新状态成功", type: "success" });
	} catch (err) {
		candidate.status = oldStatus;
		ElMessage({ message: "更新状态失败，请刷新/重试。", type: "error" });
		console.log(err);
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

async function selectType(type: string, index: number) {
	Upsert.value.form.describe[index].describe1 =
		`${type}: ${Upsert.value?.form.describe[index].describe1 || ""}`;
}

// 在 setup 中添加状态控制
const isEditMode = ref(false);
const competitorTop5Scores = ref<Record<string, any> | null>(null);

async function fetchCompetitorTop5Scores(candidateId: number) {
	try {
		const res = await service.app.bsr_candidate_competitor.getTop5Scores({ candidate_id: candidateId });
		if (res) {
			competitorTop5Scores.value = res;
		}
	} catch (error) {
		console.error("获取竞品前五自然/广告分失败:", error);
	}
}

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

function getMarketName(market: string): string {
	const reverseMapping: Record<string, string> = {
		UK: "英国",
		DE: "德国",
		FR: "法国",
		ES: "西班牙",
		IT: "意大利",
		Europe: "欧洲"
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

let sysName = "";
// 自动加载汇率
onMounted(async () => {
	await loadExchangeRates();
	if (!calculatorInitialized) {
		let params = await service.base.sys.param.page({
			keyName: "sysName"
		});
		sysName = params.list?.[0]?.data || "woeau";
		resetCalculator(sysName);
		calculatorInitialized = true;
	}
});

const dispatchTypeDict = {
	0: { label: "自营", type: "success" },
	1: { label: "FBA", type: "warning" },
	2: { label: "FBM", type: "info" }
};
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
		const candidateData = await service.app.bsr_candidate.info({ id: row.id });
		serverVariantVersion.value = candidateData.variant_version || 0;
		localVariantVersion.value = serverVariantVersion.value;

		// 先执行清空操作
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

		// if (row.purchaserNum) {
		//   // 将字符串解析为JSON
		//   if (typeof row.purchaserNum === 'string') {
		//     row.purchaserNum = JSON.parse(row.purchaserNum);
		//   }

		//   // 转换为表格需要的结构
		//   row.purchaserNum = row.purchaserNum.map((item: any) => ({
		//     ...item,
		//     // 确保包含所有国家字段
		//     ...countries2.reduce((acc, c) => {
		//       acc[c.code] = item[c.code] || 0;
		//       return acc;
		//     }, {} as Record<string, number>),
		//     purchaser: item.purchaser || userStore.info?.name,
		//     createTime: item.createTime || new Date().toISOString(),
		//     is_generate: item.is_generate ?? 1
		//   }));
		// }

		// 使用 info 全量数据打开编辑，保证 purchasers 含 selectedVariantId 等
		Upsert.value?.edit({
			...candidateData,
			id: row.id,
			asin: row.asin,
			marketplace: row.marketplace
		});
		await nextTick();
		// 老数据：仅有 selectedVariant(name) 时从 variant_Combination 补全 selectedVariantId
		const vc = Upsert.value?.form?.variant_Combination || [];
		(Upsert.value?.form?.purchasers || []).forEach((p: any) => {
			if (p.selectedVariantId) return;
			if (p.selectedVariant && vc.length) {
				const v = vc.find((x: any) => x.name === p.selectedVariant);
				if (v?.id) p.selectedVariantId = v.id;
			}
		});
		initCharts(); // 每次打开都重新初始化
		salesChartMode.value = "all";
		currentChartRow.value = row;
		updateCharts(row);
	} catch (error) {
		console.error("编辑时发生错误:", error);
		ElMessage.error("初始化编辑表单失败");
	}
};

const selectedMarket = ref("ALL");
type SalesChartMode = "all" | "same" | "nonSame";
const salesChartMode = ref<SalesChartMode>("all");
const currentChartRow = ref<any>(null);

let calculatorInitialized = false;

const DESIGN_TASK_SYNC_SKIPPED_MSG =
	"配图已进入设计流程，不再添加配图，如需新的配图，请在系统外跟助理同步变更。";

async function deletePurchaser(row) {
	if (row.id) {
		const res = await service.app.bsr_candidate_purchaser.delete({ ids: [row.id] });
		const data = res?.data ?? res;
		if (data?.designTaskSyncSkipped) {
			ElMessage.warning(DESIGN_TASK_SYNC_SKIPPED_MSG);
		}
	}

	// 从本地数据中移除（使用对象引用匹配，确保删除正确的行）
	const index = Upsert.value.form.purchasers.findIndex((p) => p === row);

	if (index !== -1) {
		Upsert.value.form.purchasers.splice(index, 1);
	}

	ElMessage.success("删除成功");
}

// 处理做/不做操作
// 前端处理操作按钮
const handleDecision = async (scope: any, status: number) => {
	try {
		const currentUser = getCurrentUserNames()[0];
		if (!currentUser) {
			ElMessage.error("未获取到登录用户信息");
			return;
		}
		const currentUserRecords = scope.purchasers.filter((p: any) => isCurrentPurchaserRow(p));
		if (currentUserRecords.length === 0) {
			ElMessage.warning("未找到您的采购记录");
			return;
		}
		let rejectReason = "";
		if (status === 0) {
			const input = await promptRejectReason(currentUserRecords[0]?.reject_reason || "");
			if (input == null) return;
			rejectReason = input;
		}

		// 先保存变体/工厂链接，失败则不继续做/不做
		try {
			await service.app.bsr_candidate.update({
				id: scope.id,
				factory_links: Array.isArray(scope.factory_links) ? scope.factory_links : [],
				variant_Combination: Array.isArray(scope.variant_Combination)
					? scope.variant_Combination
					: [],
				// 不做版本控制，避免额外冲突
				skipVersionUpdate: true
			});
		} catch (e) {
			console.error(e);
			ElMessage.error("保存变体/工厂链接失败，请先保存后再做/不做");
			return;
		}

		// 首次做时，自动生成领星SKU（仅第一次生成，后续不再生成）
		if (status === 2) {
			const hasExistingSKU =
				(scope.factory_links || []).some(
					(link: any) => link.productSKU || link.supplierSKU
				) ||
				(scope.variant_Combination || []).some(
					(variant: any) => variant.sku
				);

			if (!hasExistingSKU) {
				try {
					// 从当前用户的采购记录中获取已选变体（而非checkbox）
					const selectedVariantIds = (scope.purchasers || [])
						.filter((p: any) => isCurrentPurchaserRow(p))
						.map((p: any) => p.selectedVariantId)
						.filter(Boolean);
					const selectedIndexes = (scope.variant_Combination || [])
						.reduce((acc: number[], v: any, i: number) => {
							if (selectedVariantIds.map(String).includes(String(v.id))) acc.push(i);
							return acc;
						}, []);

					console.log('[SKU生成] selectedVariantIds:', selectedVariantIds, 'selectedIndexes:', selectedIndexes);
					const skuResult = await service.app.bsr_candidate.createLocalSKU({
						id: scope.id,
						selectedVariantIndexes: selectedIndexes,
						lingxingID: userStore.info?.lingxingID
					});
					if (skuResult?.lingxingSynced === false) {
						const detail = (skuResult.lingxingErrors || []).join("; ");
						ElMessage.warning(
							detail ? `本地SKU已生成，领星同步失败: ${detail}` : "本地SKU已生成，领星同步失败"
						);
					}
				} catch (e) {
					console.error("生成领星SKU失败:", e);
					ElMessage.error("生成领星SKU失败: " + (e?.message || e || "未知错误"));
					return;
				}
			}
		}

		let account_name = userStore.info?.accountName;

		// 3. 构造请求参数并调用后端持久化（做/不做都需写库并同步图需）
		if (status === 2) {
			// 检查是否超过最大采购量
			if (isExceededMax(scope)) {
				ElMessage.warning("采购总数超过限制，无法操作");
				return;
			}

			// 做：所有当前用户的采购记录都必须已选账户 + 已选变体
			const hasMissingAccount = currentUserRecords.some(
				(record: any) => !record.seller_account_id
			);
			const hasMissingVariant = currentUserRecords.some(
				(record: any) => !record.selectedVariantId && !record.selectedVariant
			);
			if (hasMissingAccount) {
				ElMessage.warning("请为所有采购记录选择账户");
				return;
			}
			if (hasMissingVariant) {
				ElMessage.warning("请为所有采购记录选择变体");
				return;
			}
		}
		const payload = {
			candidateId: scope.id,
			purchasers: currentUserRecords.map((record: any) => ({
				id: record.id,
				purchaser: record.purchaser || currentUser,
				purchaserNum: record.purchaserNum || {},
				country_enabled: record.country_enabled,
				is_generate: status,
				procurement: record.procurement || "",
				reject_reason: status === 0 ? rejectReason : "",
				selectedVariantId: record.selectedVariantId,
				seller_account_id: record.seller_account_id,
				account_name: record.account_name
			}))
		};
		const syncRes = await (service as any).app.bsr_candidate_purchaser.request({
			url: "/batchUpdateAndSync",
			method: "POST",
			data: payload
		});
		const syncData = syncRes?.data ?? syncRes;
		if (syncData?.designTaskSyncSkipped) {
			ElMessage.warning(DESIGN_TASK_SYNC_SKIPPED_MSG);
		}
		if (syncData?.opportunityReleased) {
			const countryLabels = (syncData.releasedCountries || [])
				.map((country: string) => country === "uk" ? "英国" : country === "de" ? "德国" : country)
				.join("、");
			ElMessage.success(
				`已将${countryLabels || "未填写国家"}的机会随机分配给${syncData.releasedPurchaser || "一位采购员"}`
			);
			Crud.value?.refresh();
		}

		if (status === 2) {
			await service.app.bsr_candidate.update({
				id: scope.id,
				is_generate_status: 2,
				skipVersionUpdate: true
			});
		}
		// 4. 调用后端接口
		ElMessage.success(
			status === 2 ? "操作成功：所有记录已标记为“做”" : "操作成功：所有记录已标记为“不做”"
		);

		// 5. 更新本地数据状态
		currentUserRecords.forEach((record: any) => {
			record.is_generate = status;
			record.reject_reason = status === 0 ? rejectReason : "";
		});

		// 新增SKU生成逻辑
		const generateSKU = () => {
			const productName = scope.produce_name || "PRODUCT";
			const accountName = account_name || "SHOP";

			// 产品名称首字母拼音
			const productInitials = pinyin(productName, {
				style: pinyin.STYLE_FIRST_LETTER
			})
				.map((arr) => arr[0].toUpperCase())
				.join("")
				.substring(0, 5);
			// 店铺名称首字母拼音
			const accountInitials = pinyin(accountName, {
				style: pinyin.STYLE_FIRST_LETTER
			})
				.map((arr) => arr[0].toUpperCase())
				.join("")
				.substring(0, 5);

			// 当前日期（YYYYMMDD）
			const now = new Date();
			const datePart = [
				now.getFullYear(),
				(now.getMonth() + 1).toString().padStart(2, "0"),
				now.getDate().toString().padStart(2, "0")
			].join("");

			// 操作人姓名首字母
			const username = userStore.info?.name || "USER";

			const userInitials = pinyin(username, {
				style: pinyin.STYLE_FIRST_LETTER
			})
				.map((arr) => arr[0].toUpperCase())
				.join("");

			return `${accountInitials}-${datePart}-${productInitials}`;
		};

		const candidateId = scope.id;
		const userId = userStore.info?.id; // 获取用户ID
		const { list: existingAiListing } = await service.app.ai_listing_write.page({
			userid: userId,
			asinid: candidateId,
			size: 1000
		});
		// 6. 插入写AiListing数据
		if (status === 2) {
			let marketplaceNeedsObj: Record<string, string> = {
				uk: "0",
				de: "0",
				fr: "0",
				it: "0",
				es: "0"
			};
			const hasGermany = scope.purchasers.some(
				(p: any) => p.purchaserNum && p.purchaserNum["de"] > 0
			);
			const hasUK = scope.purchasers.some(
				(p: any) => p.purchaserNum && p.purchaserNum["uk"] > 0
			);

			// 规则判断
			if (hasGermany && !hasUK) {
				marketplaceNeedsObj = {
					de: "0",
					fr: "0",
					it: "0",
					es: "0"
				};
			} else if (!hasGermany && hasUK) {
				marketplaceNeedsObj = { uk: "0" };
			}
			const aiListingData = {
				// 基础信息
				candidate_id: candidateId,
				asinid: candidateId,
				asin: scope.asin,
				userid: userId,
				bsr_task_id: scope.bsr_task_id,
				item_name: scope.item_name,
				produce_name: scope.produce_name,
				image_url: scope.image_url,
				price: scope.price,
				review_num: scope.review_num,
				last_star: scope.last_star,

				// BSR相关
				bsr_html: scope.bsr_html,
				bsr_category: scope.bsr_category,
				bsr_rank: scope.bsr_rank,
				bsr_link: scope.bsr_link,

				// 物流与销售
				dispatches_from: scope.dispatches_from,
				sold_by: scope.sold_by,
				date_first_available: scope.date_first_available,
				seller_country: scope.seller_country,

				// 产品特征
				bullet_points: scope.bullet_points,
				dimensions: scope.dimensions,
				weight: scope.weight,
				length: scope.length,
				width: scope.width,
				height: scope.height,

				// 财务计算
				cost_price: scope.cost_price,
				selling_price: scope.selling_price,
				first_leg_freight: scope.first_leg_freight,
				fba_freight: scope.fba_freight,
				tax_rate: scope.tax_rate,
				exchange_rate: scope.exchange_rate,

				// 状态与调研
				status: scope.status,
				competitor_spider_status: scope.competitor_spider_status,
				competitor_spider_res: scope.competitor_spider_res,
				competitor_spider_time: scope.competitor_spider_time,

				// 特殊字段处理
				describe: scope.describe,
				factory_links: scope.factory_links,
				keyword_screenshots: scope.keyword_screenshots,
				patent_memo: scope.patent_memo,
				remark: scope.remark,
				opinion_dev: scope.opinion_dev,
				opinion_operator: scope.opinion_operator,

				// 重量相关
				dimensional_weight: scope.dimensional_weight,
				actual_weight: scope.actual_weight,

				// 其他
				variants: scope.variants,
				max_purchase: scope.max_purchase,
				sku: scope.sku,
				msku: generateSKU(),
				seller_account_id: scope.seller_account_id,
				marketplace: scope.marketplace,
				marketplaceNeeds: [JSON.stringify(marketplaceNeedsObj)],
				variant_Combination: scope.variant_Combination,
				HS_code: scope.HS_code,
				material: scope.material,
				color: scope.color,
				size: scope.size,
				unit_count: scope.unit_count,
				product_quantity: scope.product_quantity
			};

			if (existingAiListing.length > 0) {
				// 更新现有记录
				await service.app.ai_listing_write.update({
					...aiListingData,
					id: existingAiListing[0].id
				});
			} else {
				// 创建新记录
				await service.app.ai_listing_write.add(aiListingData);
			}

			const { list: competitors } = await service.app.bsr_candidate_competitor.page({
				candidate_id: scope.id,
				marketplace: scope.marketplace,
				size: 1000
			});

			if (competitors.length > 0) {
				ElMessage.warning("已存在相同的ASIN和Marketplace记录，跳过添加操作");
				return; // 终止后续操作
			}
			for (const competitor of competitors) {
				await service.app.bsr_candidate_competitor_customize.add({
					// 基础信息
					asin_competitor: competitor.asin_competitor,
					candidate_id: competitor.candidate_id,
					asin_candidate: competitor.asin_candidate,
					item_name: competitor.item_name,
					image_url: competitor.image_url,
					price: competitor.price,

					// 评价信息
					review_num: competitor.review_num,
					last_star: competitor.last_star,

					// BSR相关
					bsr_html: competitor.bsr_html,
					bsr_category: competitor.bsr_category,
					bsr_rank: competitor.bsr_rank,

					// 物流信息
					dispatches_from: competitor.dispatches_from,
					sold_by: competitor.sold_by,
					date_first_available: competitor.date_first_available,

					// 产品规格
					bullet_points: competitor.bullet_points,
					dimensions: competitor.dimensions,
					weight: competitor.weight,

					// 关联信息
					original_candidate_id: scope.id,
					marketplace: competitor.marketplace,
					material: scope.material,
					color: scope.color,
					size: scope.size,
					unit_count: scope.unit_count,
					product_quantity: scope.product_quantity,

					// 其他字段
					remark: `自动生成自候选产品 ${scope.asin}`
				});
			}
			Crud.value?.refresh();

		} else if (status === 0) {
			// 删除对应的AI Listing数据
			if (existingAiListing.length > 0) {
				await service.app.ai_listing_write.delete({
					ids: [existingAiListing[0].id]
				});
			}

			// 随机更新一条记录状态为"待决策"
			try {
				const recordsToChange = scope.purchasers.filter((p: any) => p.is_generate === 4);
				if (recordsToChange.length > 0) {
					const randomIndex = Math.floor(Math.random() * recordsToChange.length);
					const randomRecord = recordsToChange[randomIndex];
					const updatePayload = {
						candidate_id: scope.id,
						id: randomRecord.id,
						purchaser: randomRecord.purchaser,
						purchaserNum: randomRecord.purchaserNum || {},
						is_generate: 1,
						procurement: randomRecord.procurement || "",
						reject_reason: ""
					};
					await service.app.bsr_candidate_purchaser.update(updatePayload);
					randomRecord.is_generate = 1;
					randomRecord.reject_reason = "";
					ElMessage.success('已随机更新一条记录状态为"待决策"');
				} else {
					ElMessage.warning(
						"未找到 is_generate 为 分配不可做 的记录，无法执行随机更新操作"
					);
				}
			} catch (updateErr) {
				console.error("更新随机记录状态失败:", updateErr);
			}
		}

		if (status === 2) {
			let existingRecord: any = null;
			try {
				const { list: existingRecords } = await service.app.bsr_candidate_customize.page({
					asin: scope.asin,
					marketplace: scope.marketplace,
					size: 1
				});
				existingRecord = existingRecords.length > 0 ? existingRecords[0] : null;
			} catch (error) {
				ElMessage.error("记录检查失败");
				throw error;
			}

			const customizeData = {
				asin: scope.asin,
				bsr_task_id: scope.bsr_task_id,
				item_name: scope.item_name,
				produce_name: scope.produce_name,
				image_url: scope.image_url,
				price: scope.price,
				review_num: scope.review_num,
				last_star: scope.last_star,
				asinid: scope.id,
				bsr_html: scope.bsr_html,
				bsr_category: scope.bsr_category,
				bsr_rank: scope.bsr_rank,
				bsr_link: scope.bsr_link,
				dispatches_from: scope.dispatches_from,
				sold_by: scope.sold_by,
				date_first_available: scope.date_first_available,
				seller_country: scope.seller_country,
				bullet_points: scope.bullet_points,
				dimensions: scope.dimensions,
				weight: scope.weight,
				length: scope.length,
				width: scope.width,
				height: scope.height,
				cost_price: scope.cost_price,
				selling_price: scope.selling_price,
				first_leg_freight: scope.first_leg_freight,
				fba_freight: scope.fba_freight,
				tax_rate: scope.tax_rate,
				exchange_rate: scope.exchange_rate,
				status: scope.status,
				competitor_spider_status: scope.competitor_spider_status,
				competitor_spider_res: scope.competitor_spider_res,
				competitor_spider_time: scope.competitor_spider_time,
				describe: scope.describe,
				factory_links: scope.factory_links,
				keyword_screenshots: scope.keyword_screenshots,
				patent_memo: scope.patent_memo,
				remark: scope.remark,
				dimensional_weight: scope.dimensional_weight,
				actual_weight: scope.actual_weight,
				variants: scope.variants,
				max_purchase: scope.max_purchase,
				sku: scope.sku,
				seller_account_id: scope.seller_account_id,
				marketplace: scope.marketplace,
				material: scope.material,
				color: scope.color,
				size: scope.size,
				unit_count: scope.unit_count,
				product_quantity: scope.product_quantity
			};

			if (existingRecord) {
				await service.app.bsr_candidate_customize.update({
					id: existingRecord.id,
					...customizeData
				});
				ElMessage.success(`ASIN ${scope.asin} 已更新本地SKU`);
			} else {
				await service.app.bsr_candidate_customize.add(customizeData);
				ElMessage.success(`ASIN ${scope.asin} 已生成本地SKU`);
			}

			await service.app.bsr_candidate.update({
				id: scope.id,
				is_generate_status: 4
			});
		}
	} catch (err) {
		console.error("操作失败:", err);
		ElMessage.error("操作失败，请稍后重试");
	}
};

// 计算单行合计
const calculateRowTotal = (row: any) => {
	return countries2.reduce((sum, c) => sum + (row.purchaserNum[c.code] || 0), 0);
};

// 计算分组合计
const calculateGroupTotal = (groupRows: any[]) => {
	return groupRows.reduce((total, row) => total + calculateRowTotal(row), 0);
};

// 计算所有采购人的总采购量
const calculateTotalPurchase = (purchasers: any[]) => {
	return purchasers.reduce((total, row) => total + calculateRowTotal(row), 0);
};

// 处理输入变化
const handleInputChange = (scope: any, row: any) => {
	// 1. 更新行合计
	row.rowTotal = calculateRowTotal(row);

	// 2. 更新组合计
	const groupRows = scope.purchasers.filter((p: any) => p.purchaser === row.purchaser);
	row.groupTotal = calculateGroupTotal(groupRows);

	// 3. 更新全局采购总数
	scope.total = calculateTotalPurchase(scope.purchasers);

	// 4. 更新Upsert表单的total字段
	if (Upsert.value?.form) {
		Upsert.value.form.total = scope.total;
	}
};
// 检查是否超过最大采购量
const isExceededMax = (scope) => {
	const total = calculateTotalPurchase(scope.purchasers);
	return total > scope.max_purchase;
};

const formatNumber = (value: number | undefined) => {
	if (typeof value !== "number") return "0.00";
	if (value === Infinity) return "∞";
	if (value === -Infinity) return "-∞";
	return value.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
};

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
// 更新图表数据
const updateCharts = async (row: any) => {
	try {
		if (!row?.id || !row?.asin) return;
		const nonSameStatus = appConfig.BSR_CANDIDATE_COMPETITOR_STATUS.NON_SAME.value;
		const competitorStatusByMode: Record<SalesChartMode, number | number[]> = {
			all: [2, 6, nonSameStatus],
			same: [2, 6],
			nonSame: nonSameStatus
		};
		const [competitors, keywords] = await Promise.all([
			service.app.bsr_candidate_competitor.page({
				candidate_id: row.id,
				size: 1000,
				status: competitorStatusByMode[salesChartMode.value]
			}),
			service.app.keyword.page({ asin: row.asin, size: 1000 })
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

const handleSalesChartModeChange = async (mode: SalesChartMode) => {
	salesChartMode.value = mode;
	await Promise.all([
		updateCharts(currentChartRow.value),
		(async () => {
			const candidateId = Upsert.value?.form?.id;
			if (!candidateId) return;
			const deliveryVolumes = await calculateDeliveryVolumes(candidateId, mode);
			if (deliveryVolumes && Upsert.value?.form) {
				Upsert.value.form.delivery_volumes = deliveryVolumes;
			}
		})()
	]);
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

const competitorData = ref<any[]>([]);

async function calculateDeliveryVolumes(
	candidateId: number,
	mode: SalesChartMode = "all"
): Promise<Record<string, any> | null> {
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
				newProductVolumePercentage: 0,
				totalAsinCount: 0,
				nonSameAsinCount: 0,
				nonSameAsinPercentage: 0
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
				newProductVolumePercentage: 0,
				totalAsinCount: 0,
				nonSameAsinCount: 0,
				nonSameAsinPercentage: 0
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
				newProductVolumePercentage: 0,
				totalAsinCount: 0,
				nonSameAsinCount: 0,
				nonSameAsinPercentage: 0
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
				newProductVolumePercentage: 0,
				totalAsinCount: 0,
				nonSameAsinCount: 0,
				nonSameAsinPercentage: 0
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
				newProductVolumePercentage: 0,
				totalAsinCount: 0,
				nonSameAsinCount: 0,
				nonSameAsinPercentage: 0
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
		const competitorStatusByMode: Record<SalesChartMode, number | number[]> = {
			all: [2, 6, nonSameStatus],
			same: [2, 6],
			nonSame: nonSameStatus
		};
		const response = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			size: 1000,
			status: competitorStatusByMode[mode]
		});
		const response2 = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			size: 1000,
			status: competitorStatusByMode[mode]
		});
		const response3 = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			size: 1000,
			status: nonSameStatus
		});
		const marketAsinStats: Record<string, { baseAsinCount: number; nonSameAsinCount: number }> =
			{
				UK: { baseAsinCount: 0, nonSameAsinCount: 0 },
				DE: { baseAsinCount: 0, nonSameAsinCount: 0 },
				FR: { baseAsinCount: 0, nonSameAsinCount: 0 },
				ES: { baseAsinCount: 0, nonSameAsinCount: 0 },
				IT: { baseAsinCount: 0, nonSameAsinCount: 0 }
			};
		(response.list || []).forEach((item) => {
			const marketplaceZh = item.marketplace || "";
			const marketplaceEn = marketNameMapping[marketplaceZh] || marketplaceZh;
			if (!marketAsinStats[marketplaceEn]) return;
			marketAsinStats[marketplaceEn].baseAsinCount += 1;
		});
		(response3.list || []).forEach((item) => {
			const marketplaceZh = item.marketplace || "";
			const marketplaceEn = marketNameMapping[marketplaceZh] || marketplaceZh;
			if (!marketAsinStats[marketplaceEn]) return;
			marketAsinStats[marketplaceEn].nonSameAsinCount += 1;
		});

		const filteredList = response.list || [];
		const filteredList2 = response2.list || [];

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
					nodeStats: [],
					totalAsinCount: 0,
					nonSameAsinCount: 0,
					nonSameAsinPercentage: 0
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
			volumesByMarketplace[marketplace].totalAsinCount =
				(marketAsinStats[marketplace]?.baseAsinCount || 0) +
				(marketAsinStats[marketplace]?.nonSameAsinCount || 0);
			volumesByMarketplace[marketplace].nonSameAsinCount =
				marketAsinStats[marketplace]?.nonSameAsinCount || 0;
			volumesByMarketplace[marketplace].nonSameAsinPercentage =
				volumesByMarketplace[marketplace].totalAsinCount > 0
					? (volumesByMarketplace[marketplace].nonSameAsinCount /
							volumesByMarketplace[marketplace].totalAsinCount) *
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

function openCompetitorDetail(row: any) {
	openProductLinks2(row);
}

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
function openProductLinks3(row: any) {
	const cleanAsin = row.asin_competitor.replace(/[^A-Z0-9]/g, "");
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

function extractDomain(url: string): string {
	// 移除协议和路径部分
	return url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
}

function ensureFullUrl(url: string): string {
	if (!url) return "";
	if (url.startsWith("http://") || url.startsWith("https://")) {
		return url;
	}
	return `https://${url}`;
}

async function ProcessExportOfSelectedPurchases() {
	try {
		// 获取表格选择的候选产品ID
		const selectedIds = Table.value?.getSelectionRows().map((row) => row.id);

		if (!selectedIds || selectedIds.length === 0) {
			ElMessage.warning("请先选择要导出采购信息的产品");
			return;
		}

		// 调用导出接口
		const response = await service.app.bsr_candidate.exportSelectedPurchases({
			ids: selectedIds,
			name: name
		});

		// 创建Blob
		const blob = new Blob([response], {
			type: "text/csv;charset=utf-8;"
		});

		// 创建下载链接
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `selected_competitors_${dayjs().format("YYYY-MM-DD")}.csv`;

		// 触发下载
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		// 释放资源
		URL.revokeObjectURL(link.href);

		ElMessage.success("采购信息导出成功");
	} catch (error) {
		console.error("导出失败:", error);
		ElMessage.error("采购信息导出失败");
	}
}

function flexibleMapping2(item: any) {
	const mapping: Record<string, string> = {
		关键词: "value",
		任务源asin: "asin",
		关键词中文意思: "value_cn",
		月搜索量: "search_volume_monthly",
		广告竞品数: "ad_competitor_count",
		PPC竞价最小值: "ppc_bid_min",
		PPC竞价最大值: "ppc_bid_max",
		PPC竞价: "ppc_bid",
		月搜索趋势: "search_volume_data",
		国家: "marketplaces",
		流量占比: "trafficPercentage",
		标题: "title"
	};
	const newItem: any = {};
	Object.keys(mapping).forEach((chineseKey) => {
		if (item.hasOwnProperty(chineseKey)) {
			const targetKey = mapping[chineseKey];
			const value = item[chineseKey];
			// 特殊处理 search_volume_data：解析 JSON 字符串
			if (targetKey === "search_volume_data" && typeof value === "string") {
				try {
					newItem[targetKey] = JSON.parse(value);
				} catch (e) {
					newItem[targetKey] = []; // 解析失败时设为空数组
				}
			} else {
				newItem[targetKey] = value;
			}
		}
	});
	Object.values(mapping).forEach((key) => {
		if (!newItem[key] && item.hasOwnProperty(key)) {
			newItem[key] = item[key];
		}
	});
	return newItem;
}

const importTemplate = [
	{
		关键词: "",
		任务源asin: "",
		关键词中文意思: "",
		月搜索量: "",
		广告竞品数: "",
		PPC竞价: "",
		PPC竞价最小值: "",
		PPC竞价最大值: "",
		月搜索趋势: ""
	}
];

/** 选中品名后未填比例时给默认 1，避免提交时 groupProportions 为空 */
function ensureVariantGroupProportions(row: any) {
	if (!row) return;
	row.groupProportions = row.groupProportions || {};

	// 清理已从 selectedGroups 中删除的项对应的 groupProportions 数据
	Object.keys(row.groupProportions).forEach((name: string) => {
		if (!row.selectedGroups || !row.selectedGroups.includes(name)) {
			delete row.groupProportions[name];
		}
	});

	// 为选中的品名设置默认比例
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
			// 返回父体销量最高的竞品标题
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

	// 获取英国和德国竞品标题
	let ukTitle = '';
	let deTitle = '';

	if (scope.id && (scope.competitor_import_status === 1 || scope.competitor_import_status === '1')) {
		// 只有当选品已保存（有ID）并且竞品已导入时才获取竞品标题
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
		selectedGroups: [],
		groupProportions: {},
		uk_title: ukTitle, // 英国标题
		de_title: deTitle  // 德国标题
	});
}

// 处理变体选择变化

function deleteVariant(scope: any, index: number) {
	scope.variant_Combination.splice(index, 1);
}

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

// 添加新组
const addGroup = (type: string) => {
	const groupId = Date.now().toString(); // 生成唯一组ID

	// 添加新组时确保 factory_links 数组存在
	if (!Upsert.value?.form.factory_links) {
		Upsert.value.form.factory_links = [];
	}

	Upsert.value?.form.factory_links.push({
		id: uuid(),
		groupId,
		type,
		name: "",
		price: 0,
		user_input: "",
		user_input_description: "",
		isFirst: true
	});
};

// 添加备选链接
const addAlternativeLink = (groupId: string) => {
	// 获取组内第一个链接作为模板
	const firstLink = Upsert.value?.form.factory_links.find(
		(l) => l.groupId === groupId && l.isFirst
	);

	if (firstLink) {
		Upsert.value?.form.factory_links.push({
			id: uuid(),
			groupId,
			type: firstLink.type,
			name: firstLink.name,
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

const copyDialogVisible = ref(false);
const copyCount = ref(1);
const copyBaseName = ref("");
const copyBaseGroupId = ref("");
const copyPreview = ref<{ suffix: string }[]>([]);
const copyBaseData = ref<any>(null);
const copyBaseGroupLinks = ref<any[]>([]);

// 方法
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
				id: uuid(),
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

const serverVariantVersion = ref(0);
const localVariantVersion = ref(0);

async function handleGeneratePurchaseOrder(row: any) {
	try {
		await service.app.bsr_candidate.sync_add_product_from_lx({ id: row.id });
		ElMessage.success("采购单生成成功");
		await service.app.listing.add({
			local_sku: row.sku,
			asin: row.asin,
			small_image_url: row.image_url,
			item_name: row.item_name,
			quantity: row.quantity,
			review_num: row.review_num,
			last_star: row.last_star,
			candidate_id: row.id,
			is_custom_listing: 1,
			marketplace: row.marketplace,
			local_name: row.produce_name,
			price: row.price,
			landed_price: row.price
		});
		Crud.value?.refresh(); // 刷新数据
	} catch (e) {
		ElMessage.error("生成采购单失败");
	}
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
.purchaser-table {
	border: 1px solid #ebeef5;
	border-radius: 4px;
	padding: 16px;
	background: #fff;
}

/* 必选字段样式 */
.required-field :deep(.el-input__wrapper) {
	border-color: #f56c6c;
}

:deep(.el-table th) {
	background-color: #f5f7fa;
}

:deep(.el-table td) {
	padding: 8px 0;
}

:deep(.el-input__inner) {
	text-align: center;
	padding: 0 8px;
	height: 32px;
	line-height: 32px;
}

.operation-buttons {
	display: flex;
	gap: 8px;
	justify-content: center;
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

.chart-filter-panel {
	display: flex;
	flex-direction: column;
	gap: 16px;
	height: 100%;
	justify-content: center;
}

.chart-filter-btn {
	width: 100%;
	margin-left: 0;
}

.sales-info-filter-panel {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 12px;
}

.sales-info-filter-buttons {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
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

.el-form-item.is-error .el-input__wrapper {
	box-shadow: 0 0 0 1px var(--el-color-danger) inset;
	animation: shake 0.5s;
}

@keyframes shake {
	0%,
	100% {
		transform: translateX(0);
	}

	25% {
		transform: translateX(-5px);
	}

	75% {
		transform: translateX(5px);
	}
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

/* 添加以下样式 */
.proportion-container {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 8px;
}

.proportion-item {
	display: flex;
	align-items: center;
}

.link-name {
	margin-right: 8px;
}

.proportion-input {
	width: 100px;
}

/* 锁定按钮样式 */
.lock-btn {
	width: 70px;
}

/* 已锁定标签样式 */
.lock-tag {
	vertical-align: middle;
	margin-right: 8px;
}

/* 禁用状态的输入框 */
:deep(.is-disabled .el-input__inner) {
	background-color: #f5f7fa;
	color: #909399;
	cursor: not-allowed;
}

/* 变体项样式 */
.variant-item {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	padding: 8px;
	margin-bottom: 8px;
	border: 1px solid #ebeef5;
	border-radius: 4px;
	background: #fafafa;
}

/* 锁定的变体项 */
.variant-item.locked {
	background-color: #fff8f8;
	border-color: #fde2e2;
}

.total-purchase {
	margin-top: 16px;
	padding: 8px 16px;
	background-color: #f5f7fa;
	border-radius: 4px;
	text-align: right;
	font-weight: bold;
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
