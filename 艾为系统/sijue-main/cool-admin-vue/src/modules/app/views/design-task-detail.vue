<template>
	<el-dialog
		v-model="dialogVisible"
		:width="isFullscreen ? '100%' : '1400px'"
		:close-on-click-modal="false"
		:close-on-press-escape="false"
		:class="['design-task-detail-dialog', { 'is-fullscreen': isFullscreen }]"
		:show-close="false"
		@close="handleClose"
	>
		<template #header>
			<div class="dialog-header">
				<span class="dialog-title">美工任务详情</span>
				<div class="dialog-header-actions">
					<el-button
						text
						@click="toggleFullscreen"
						:title="isFullscreen ? '退出全屏' : '全屏'"
					>
						<el-icon>
							<full-screen v-if="!isFullscreen" />
							<minus v-else />
						</el-icon>
					</el-button>
					<el-button text @click="handleClose" title="关闭">
						<el-icon>
							<close />
						</el-icon>
					</el-button>
				</div>
			</div>
		</template>
		<div class="design-task-detail">
			<el-card class="basic-card" shadow="never">
				<div class="basic-info-wrapper">
					<el-form label-width="120px" label-position="left" class="basic-form">
						<el-form-item label="产品名称">
							<span class="text-value">{{ detail.productName }}</span>
						</el-form-item>
						<el-form-item label="父SKU">
							<span class="text-value">{{ detail.sku }}</span>
							<el-button
								v-if="detail.asin && detail.marketplace"
								link
								type="primary"
								class="open-product-btn"
								@click="openProductPage"
							>
								打开产品页
							</el-button>
						</el-form-item>
						<el-form-item label="任务状态">
							<el-tag :type="statusTagType(detail.status)">{{
								detail.status
							}}</el-tag>
						</el-form-item>
						<el-form-item label="摄影上传路径">
							<div class="upload-path-row">
								<el-input
									v-model="detail.photographerUploadPath"
									placeholder="可粘贴 D:\comfyui共享\xxx 或浏览选择"
									clearable
									:disabled="uploadPathSaving.photographer"
									@keyup.enter="commitUploadPath('photographer')"
									@blur="commitUploadPath('photographer')"
								/>
								<el-button
									type="primary"
									size="default"
									:loading="uploadPathSaving.photographer"
									@mousedown.prevent
									@click="openMinioPicker('photographer')"
								>浏览</el-button>
							</div>
						</el-form-item>
						<el-form-item label="美工上传路径">
							<div class="upload-path-row">
								<el-input
									v-model="detail.designerUploadPath"
									placeholder="可粘贴 D:\美工图片（已完成）\xxx 或浏览选择"
									clearable
									:disabled="uploadPathSaving.designer"
									@keyup.enter="commitUploadPath('designer')"
									@blur="commitUploadPath('designer')"
								/>
								<el-button
									type="primary"
									size="default"
									:loading="uploadPathSaving.designer"
									@mousedown.prevent
									@click="openMinioPicker('designer')"
								>浏览</el-button>
							</div>
						</el-form-item>
					</el-form>
					<div class="main-image-wrapper">
						<image-zoom
							:src="detail.mainImage"
							fit="cover"
							:width="180"
							:height="130"
						/>
					</div>
				</div>
			</el-card>

			<div class="requirement-section" @keydown.capture="onRequirementEditKeydown">
				<div class="requirement-header">
					<div class="requirement-header-left">
						<div class="section-title">图需表</div>
						<picture-mount-lang-indicators
							class="requirement-title-lang"
							:status="candidateTotalLangStatus"
						/>
					</div>
					<div class="requirement-header-actions">
						<el-button
							:type="isEditMode ? 'warning' : 'primary'"
							size="small"
							@click="toggleEditMode"
						>
							{{ isEditMode ? "完成修改" : "修改图需" }}
						</el-button>
						<el-button
							v-if="showStepCheckbox"
							type="success"
							size="small"
							@click="handleMarkAllCompleted"
						>
							一键标记所有已完成
						</el-button>
					</div>
				</div>
				<input
					ref="detailRemarkFileInputRef"
					type="file"
					accept="image/*"
					class="detail-remark-file-hidden"
					@change="onDetailRemarkFileSelected"
				/>
				<input
					ref="detailReferenceFileInputRef"
					type="file"
					accept="image/*"
					class="detail-remark-file-hidden"
					@change="onDetailReferenceFileSelected"
				/>
				<div class="requirement-table-wrapper">
					<div class="requirement-table-toolbar">
						<span class="caption-quick-tip">{{ tableToolbarTip }}</span>
						<div class="requirement-table-toolbar-actions">
							<template v-if="isEditMode && batchRewriteMode">
								<el-button size="small" @click="exitBatchRewriteMode">退出批量改写</el-button>
								<el-button size="small" @click="batchSelectAllCaptionRows">全选</el-button>
								<el-button size="small" @click="batchClearSelection">取消全选</el-button>
								<el-button
									size="small"
									type="primary"
									:disabled="batchSelectedCount === 0"
									@click="applyBatchLatinCase('title')"
								>
									首字母大写
								</el-button>
								<el-button
									size="small"
									type="primary"
									:disabled="batchSelectedCount === 0"
									@click="applyBatchLatinCase('upper')"
								>
									全大写
								</el-button>
								<el-button
									size="small"
									type="primary"
									:disabled="batchSelectedCount === 0"
									@click="applyBatchLatinCase('lower')"
								>
									全小写
								</el-button>
							</template>
							<el-button
								v-else-if="isEditMode"
								size="small"
								@click="enterBatchRewriteMode"
							>
								批量改写
							</el-button>
							<template v-if="isEditMode">
								<el-button
									size="small"
									:icon="RefreshLeft"
									:disabled="!canUndoEdit"
									@click="undoEdit"
								>
									撤销
								</el-button>
								<el-button
									size="small"
									:icon="RefreshRight"
									:disabled="!canRedoEdit"
									@click="redoEdit"
								>
									重做
								</el-button>
							</template>
							<div class="sort-mode-switch">
								<span :class="{ active: imageSlotSortMode === 'position' }">按位置</span>
								<el-switch
									:model-value="imageSlotSortMode === 'set'"
									@change="handleImageSlotSortModeSwitchChange"
								/>
								<span :class="{ active: imageSlotSortMode === 'set' }">按套图</span>
							</div>
							<el-button
								v-if="isEditMode"
								type="primary"
								size="small"
								@click="openAddPictureSlotDialog"
							>
								新增图片位
							</el-button>
						</div>
					</div>
					<el-table
						ref="detailTableRef"
						:data="flattenedTableData"
						border
						class="detail-table detail-table-below-toolbar"
						:class="{ 'is-batch-rewrite-mode': batchRewriteMode }"
						:height="requirementTablePxHeight"
						scrollbar-always-on
						:row-key="captionRowKey"
						:span-method="getSpanMethod"
						:cell-class-name="tableCellClassName"
						:row-class-name="tableRowClassName"
						@selection-change="onBatchTableSelectionChange"
						@row-dblclick="handleCaptionRowDblclick"
						@row-contextmenu="handleCaptionRowContextmenu"
						@cell-click="handleTableCellClick"
					>
						<el-table-column
							v-if="batchRewriteMode"
							type="selection"
							width="46"
							align="center"
							fixed="left"
							class-name="batch-select-col"
							:selectable="isBatchRowSelectable"
						/>
						<el-table-column
							label="编号"
							width="108"
							align="left"
							fixed="left"
							class-name="sticky-first-col"
							label-class-name="sticky-first-col-header"
						>
							<template #default="{ row }">
								<template v-if="row.isFirstRow">
									<div class="picture-id-cell">
										<div class="picture-id-read-label">
											{{ row.picture.label }}
										</div>
										<el-tag
											v-if="row.picture.type"
											type="primary"
											size="small"
											class="picture-id-read-tag"
										>
											{{ row.picture.type }}
										</el-tag>
										<div
											v-if="showStepCheckbox || isEditMode"
											class="picture-id-actions"
										>
											<el-checkbox
												v-if="showStepCheckbox"
												v-model="completedMap[row.requirementId]"
												@change="handleCompletedChange(row.requirementId)"
											>
												<span title="当前流程阶段下该图片位分项是否做完"
													>分项完成</span
												>
											</el-checkbox>
											<el-button
												v-if="isEditMode"
												link
												type="danger"
												size="small"
												@click="handleDeletePicture(row.requirementId)"
											>
												删图位
											</el-button>
										</div>
									</div>
								</template>
							</template>
						</el-table-column>
						<el-table-column label="挂载" min-width="128" fixed="left">
							<template #default="{ row }">
								<template v-if="row.isFirstRow">
									<div class="picture-mount-cell">
										<template v-if="isEditMode">
											<template v-if="row.picture.type === '主图'">
												<div
													v-if="!row.picture.initialMsku"
													:data-edit-cell="editCellKey(row, 'msku')"
												>
												<el-select
													v-model="row.picture.msku"
													size="small"
													placeholder="挂载 MSKU"
													class="mount-select-full"
													filterable
													@focus="beginEditFieldFocus(editFocusTarget(row, 'msku'))"
													@change="commitEditFieldChange(editFocusTarget(row, 'msku'))"
												>
													<el-option
														v-for="m in detail.mskus"
														:key="m.msku"
														:label="`${m.variant_name || '-'}-${m.account_name || '-'}`"
														:value="m.msku"
													/>
												</el-select>
												</div>
												<div
													v-else
													class="mount-readonly-msku"
													:title="getMskuLabelDetail(row.picture.msku)"
												>
													{{ getMskuLabelDetail(row.picture.msku) }}
												</div>
												<div
													v-if="row.picture.initialMsku"
													class="mount-hint"
												>
													主图 MSKU 已关联，不可更改
												</div>
											</template>
											<template v-else>
												<div :data-edit-cell="editCellKey(row, 'variantId')">
												<el-select
													v-model="row.picture.variantId"
													size="small"
													placeholder="全部变体"
													class="mount-select-full"
													clearable
													@focus="beginEditFieldFocus(editFocusTarget(row, 'variantId'))"
													@change="commitEditFieldChange(editFocusTarget(row, 'variantId'))"
												>
													<el-option label="全部变体" value="" />
													<el-option
														v-for="v in detail.variants"
														:key="v.variantsid"
														:label="v.name || v.variantsid"
														:value="v.variantsid"
													/>
												</el-select>
												</div>
												<div :data-edit-cell="editCellKey(row, 'sellerAccountId')">
												<el-select
													v-model="row.picture.sellerAccountId"
													size="small"
													placeholder="全部账号"
													class="mount-select-full mount-select-second"
													clearable
													@focus="beginEditFieldFocus(editFocusTarget(row, 'sellerAccountId'))"
													@change="commitEditFieldChange(editFocusTarget(row, 'sellerAccountId'))"
												>
													<el-option label="全部账号" value="" />
													<el-option
														v-for="s in detail.sellers"
														:key="s.seller_account_id"
														:label="
															s.account_name || s.seller_account_id
														"
														:value="s.seller_account_id"
													/>
												</el-select>
												</div>
												<div class="mount-hint">未选即挂载全部</div>
											</template>
										</template>
										<template v-else>
											<template v-if="row.picture.type === '主图'">
												<div class="mount-read-line">
													<span class="mount-k">MSKU</span>
													<span
														class="mount-v"
														:title="row.picture.msku"
														>{{
															getMskuLabelDetail(row.picture.msku) ||
															"—"
														}}</span
													>
												</div>
											</template>
											<template v-else>
												<div class="mount-read-line">
													<span class="mount-k">变体</span>
													<el-tag
														v-if="row.picture.variantId"
														type="success"
														size="small"
														class="clickable-tag"
														@click="
															handleVariantClick(
																String(row.picture.variantId || '')
															)
														"
													>
														{{
															getVariantName(row.picture.variantId) ||
															"—"
														}}
													</el-tag>
													<span v-else class="mount-v">全部变体</span>
												</div>
												<div class="mount-read-line">
													<span class="mount-k">账号</span>
													<span class="mount-v">{{
														row.picture.sellerAccountId
															? getSellerName(
																	row.picture.sellerAccountId
																)
															: "全部账号"
													}}</span>
												</div>
											</template>
										</template>
										<picture-mount-lang-indicators
											:status="pictureMountLangStatusFor(row.picture)"
										/>
									</div>
								</template>
							</template>
						</el-table-column>
						<el-table-column label="参考图" width="112" fixed="left">
							<template #default="{ row }">
								<div class="reference-image-cell">
									<image-zoom
										v-if="row.referenceImage"
										:src="row.referenceImage"
										fit="cover"
										class="reference-image"
									/>
									<div v-else class="reference-image-placeholder">—</div>
									<div
										v-if="isEditMode && row.isFirstRow"
										class="reference-image-edit-actions"
										:data-edit-cell="editCellKey(row, 'referenceImage')"
									>
										<el-button
											size="small"
											:loading="
												detailReferenceUploadingId === Number(row.pictureId)
											"
											@click="openDetailReferencePicker(row.pictureId)"
										>
											{{ row.referenceImage ? "更换" : "上传" }}
										</el-button>
										<el-button
											v-if="row.referenceImage"
											link
											type="danger"
											size="small"
											@click="clearDetailReferenceImage(row)"
										>
											清除
										</el-button>
									</div>
								</div>
							</template>
						</el-table-column>
						<el-table-column label="图需" min-width="250" fixed="left">
							<template #default="{ row }">
								<div
									v-if="isEditMode && row.isFirstRow"
									class="editable-grid-cell editable-grid-cell--large"
									contenteditable="plaintext-only"
									spellcheck="false"
									data-placeholder="填写图需"
									:data-edit-cell="editCellKey(row, 'requirements')"
									@focus="beginEditFieldFocus(editFocusTarget(row, 'requirements'))"
									@paste="onEditableCellPaste"
									@blur="
										onEditableCellBlur(row, 'requirements', $event);
										commitEditFieldChange(editFocusTarget(row, 'requirements'));
									"
									v-text="row.requirements"
								></div>
								<span v-else>{{ row.requirements }}</span>
							</template>
						</el-table-column>
						<el-table-column label="补充说明" min-width="120" fixed="left">
							<template #default="{ row }">
								<template v-if="row.isFirstRow">
									<div
										v-if="isEditMode"
										class="detail-remark-edit"
										:data-edit-cell="editCellKey(row, 'remarkDoc.text')"
									>
										<div
											class="editable-grid-cell editable-grid-cell--remark"
											contenteditable="plaintext-only"
											spellcheck="false"
											data-placeholder="文字说明（可选）"
											@focus="beginEditFieldFocus(editFocusTarget(row, 'remarkDoc.text'))"
											@paste="onEditableCellPaste"
											@blur="
												onEditableCellBlur(row, 'remarkDoc.text', $event);
												commitEditFieldChange(
													editFocusTarget(row, 'remarkDoc.text')
												);
											"
											v-text="row.remarkDoc.text"
										></div>
										<div
											class="detail-remark-images"
											:data-edit-cell="editCellKey(row, 'remarkDoc.images')"
										>
											<div
												v-for="(ru, ri) in row.remarkDoc.images"
												:key="ri"
												class="detail-remark-thumb-wrap"
											>
												<image-zoom
													:src="ru"
													fit="cover"
													class="detail-remark-thumb"
												/>
												<el-icon
													class="detail-remark-thumb-del"
													@click="removeDetailRemarkImageAtRow(row, ri)"
												>
													<circle-close />
												</el-icon>
											</div>
											<el-button
												size="small"
												:loading="
													detailRemarkUploadingId ===
													Number(row.pictureId)
												"
												@click="openDetailRemarkPicker(row.pictureId)"
											>
												上传示意图
											</el-button>
										</div>
									</div>
									<div v-else class="detail-remark-read">
										<div v-if="row.remarkDoc.text" class="detail-remark-text">
											{{ row.remarkDoc.text }}
										</div>
										<div
											v-if="row.remarkDoc.images?.length"
											class="detail-remark-images-read"
										>
											<image-zoom
												v-for="(u, ii) in row.remarkDoc.images"
												:key="ii"
												:src="u"
												fit="cover"
												class="detail-remark-thumb-read"
											/>
										</div>
										<span
											v-if="
												!row.remarkDoc.text &&
												!(
													row.remarkDoc.images &&
													row.remarkDoc.images.length
												)
											"
											>-</span
										>
									</div>
								</template>
							</template>
						</el-table-column>
						<el-table-column label="原图文案" min-width="150" show-overflow-tooltip>
							<template #header>
								<div class="caption-col-header">
									<button
										type="button"
										class="caption-col-toggle"
										:class="{ 'is-active': isCaptionColumnApplied('原图文案') }"
										@click="toggleCaptionColumnApplied('原图文案')"
									>
										原图文案 {{ isCaptionColumnApplied("原图文案") ? "✓" : "" }}
									</button>
								</div>
							</template>
							<template #default="{ row }">
								<span v-if="isMainPictureRow(row)">-</span>
								<template v-else>
									<span v-if="row.copy.raw_after_rephrase">
										{{ row.copy.raw_text || "-" }} →
										{{ row.copy.raw_after_rephrase }}
									</span>
									<span v-else>{{ row.copy.raw_text || "-" }}</span>
								</template>
							</template>
						</el-table-column>
						<el-table-column label="文案类型" width="80" align="center">
							<template #header>
								<div class="caption-col-header">
									<button
										type="button"
										class="caption-col-toggle"
										:class="{ 'is-active': isCaptionColumnApplied('文案类型') }"
										@click="toggleCaptionColumnApplied('文案类型')"
									>
										文案类型 {{ isCaptionColumnApplied("文案类型") ? "✓" : "" }}
									</button>
								</div>
							</template>
							<template #default="{ row }">
								<span v-if="isMainPictureRow(row)">-</span>
								<template v-else>
									<div
										v-if="isEditMode"
										:data-edit-cell="editCellKey(row, 'copy.role')"
									>
									<el-select
										v-model="row.copy.role"
										class="caption-role-select"
										clearable
										filterable
										placeholder="类型"
										@focus="beginEditFieldFocus(editFocusTarget(row, 'copy.role'))"
										@change="
											commitEditFieldChange(editFocusTarget(row, 'copy.role'));
											updateCopy(row);
										"
									>
										<el-option
											v-for="opt in CAPTION_ROLE_OPTIONS"
											:key="opt.value"
											:label="opt.label"
											:value="opt.value"
										/>
									</el-select>
									</div>
									<template v-else>
										<el-tag
											v-if="row.copy.role"
											type="info"
											size="small"
											effect="light"
										>
											{{ captionRoleLabel(row.copy.role) }}
										</el-tag>
										<span v-else class="caption-type-empty">-</span>
									</template>
								</template>
							</template>
						</el-table-column>
						<el-table-column label="中文案" min-width="140">
							<template #header>
								<div class="caption-col-header">
									<button
										type="button"
										class="caption-col-toggle"
										:class="{ 'is-active': isCaptionColumnApplied('中文案') }"
										@click="toggleCaptionColumnApplied('中文案')"
									>
										中文案 {{ isCaptionColumnApplied("中文案") ? "✓" : "" }}
									</button>
								</div>
							</template>
							<template #default="{ row }">
								<span v-if="isMainPictureRow(row)">-</span>
								<template v-else>
									<div
										v-if="isEditMode"
										:data-edit-cell="editCellKey(row, 'copy.zh')"
									>
										<div
											class="editable-grid-cell"
											contenteditable="plaintext-only"
											spellcheck="false"
											data-placeholder="中文案"
											@focus="
												onZhCaptionFocus(row);
												beginEditFieldFocus(
													editFocusTarget(row, 'copy.zh')
												);
											"
											@paste="onEditableCellPaste"
											@blur="
												onEditableCellBlur(row, 'copy.zh', $event);
												commitEditFieldChange(
													editFocusTarget(row, 'copy.zh')
												);
												onZhCaptionBlur(row);
											"
											v-text="row.copy.zh"
										></div>
									</div>
									<span v-else>{{ row.copy.zh || "-" }}</span>
								</template>
							</template>
						</el-table-column>
						<el-table-column label="UK文案" min-width="140">
							<template #header>
								<div class="caption-col-header">
									<button
										type="button"
										class="caption-col-toggle"
										:class="{ 'is-active': isCaptionColumnApplied('UK文案') }"
										@click="toggleCaptionColumnApplied('UK文案')"
									>
										UK文案 {{ isCaptionColumnApplied("UK文案") ? "✓" : "" }}
									</button>
								</div>
							</template>
							<template #default="{ row }">
								<span v-if="isMainPictureRow(row)">-</span>
								<template v-else>
									<div
										v-if="isEditMode"
										class="caption-locale-cell"
										:data-edit-cell="editCellKey(row, 'copy.uk')"
									>
										<div
											class="editable-grid-cell"
											contenteditable="plaintext-only"
											spellcheck="false"
											data-placeholder="UK文案"
											@focus="
												beginEditFieldFocus(editFocusTarget(row, 'copy.uk'))
											"
											@paste="onEditableCellPaste"
											@blur="
												onEditableCellBlur(row, 'copy.uk', $event);
												commitEditFieldChange(
													editFocusTarget(row, 'copy.uk')
												);
												updateCopy(row);
											"
											v-text="row.copy.uk"
										></div>
										<button
											type="button"
											class="caption-auto-translate-check"
											:class="{
												'is-on': isCaptionLocaleAutoTranslateOn(
													row.copy.captionUid,
													'uk'
												)
											}"
											title="自动翻译"
											@mousedown.prevent
											@click.stop="
												toggleCaptionLocaleAutoTranslate(
													row.copy.captionUid,
													'uk'
												)
											"
										>
											✓
										</button>
									</div>
									<span v-else>{{ row.copy.uk || "-" }}</span>
								</template>
							</template>
						</el-table-column>
						<el-table-column label="DE文案" min-width="140">
							<template #header>
								<div class="caption-col-header">
									<button
										type="button"
										class="caption-col-toggle"
										:class="{ 'is-active': isCaptionColumnApplied('DE文案') }"
										@click="toggleCaptionColumnApplied('DE文案')"
									>
										DE文案 {{ isCaptionColumnApplied("DE文案") ? "✓" : "" }}
									</button>
								</div>
							</template>
							<template #default="{ row }">
								<span v-if="isMainPictureRow(row)">-</span>
								<template v-else>
									<div
										v-if="isEditMode"
										class="caption-locale-cell"
										:data-edit-cell="editCellKey(row, 'copy.de')"
									>
										<div
											class="editable-grid-cell"
											contenteditable="plaintext-only"
											spellcheck="false"
											data-placeholder="DE文案"
											@focus="
												beginEditFieldFocus(editFocusTarget(row, 'copy.de'))
											"
											@paste="onEditableCellPaste"
											@blur="
												onEditableCellBlur(row, 'copy.de', $event);
												commitEditFieldChange(
													editFocusTarget(row, 'copy.de')
												);
												updateCopy(row);
											"
											v-text="row.copy.de"
										></div>
										<button
											type="button"
											class="caption-auto-translate-check"
											:class="{
												'is-on': isCaptionLocaleAutoTranslateOn(
													row.copy.captionUid,
													'de'
												)
											}"
											title="自动翻译"
											@mousedown.prevent
											@click.stop="
												toggleCaptionLocaleAutoTranslate(
													row.copy.captionUid,
													'de'
												)
											"
										>
											✓
										</button>
									</div>
									<span v-else>{{ row.copy.de || "-" }}</span>
								</template>
							</template>
						</el-table-column>
						<el-table-column label="FR文案" min-width="140">
							<template #header>
								<div class="caption-col-header">
									<button
										type="button"
										class="caption-col-toggle"
										:class="{ 'is-active': isCaptionColumnApplied('FR文案') }"
										@click="toggleCaptionColumnApplied('FR文案')"
									>
										FR文案 {{ isCaptionColumnApplied("FR文案") ? "✓" : "" }}
									</button>
								</div>
							</template>
							<template #default="{ row }">
								<span v-if="isMainPictureRow(row)">-</span>
								<template v-else>
									<div
										v-if="isEditMode"
										class="caption-locale-cell"
										:data-edit-cell="editCellKey(row, 'copy.fr')"
									>
										<div
											class="editable-grid-cell"
											contenteditable="plaintext-only"
											spellcheck="false"
											data-placeholder="FR文案"
											@focus="
												beginEditFieldFocus(editFocusTarget(row, 'copy.fr'))
											"
											@paste="onEditableCellPaste"
											@blur="
												onEditableCellBlur(row, 'copy.fr', $event);
												commitEditFieldChange(
													editFocusTarget(row, 'copy.fr')
												);
												updateCopy(row);
											"
											v-text="row.copy.fr"
										></div>
										<button
											type="button"
											class="caption-auto-translate-check"
											:class="{
												'is-on': isCaptionLocaleAutoTranslateOn(
													row.copy.captionUid,
													'fr'
												)
											}"
											title="自动翻译"
											@mousedown.prevent
											@click.stop="
												toggleCaptionLocaleAutoTranslate(
													row.copy.captionUid,
													'fr'
												)
											"
										>
											✓
										</button>
									</div>
									<span v-else>{{ row.copy.fr || "-" }}</span>
								</template>
							</template>
						</el-table-column>
						<el-table-column label="IT文案" min-width="140">
							<template #header>
								<div class="caption-col-header">
									<button
										type="button"
										class="caption-col-toggle"
										:class="{ 'is-active': isCaptionColumnApplied('IT文案') }"
										@click="toggleCaptionColumnApplied('IT文案')"
									>
										IT文案 {{ isCaptionColumnApplied("IT文案") ? "✓" : "" }}
									</button>
								</div>
							</template>
							<template #default="{ row }">
								<span v-if="isMainPictureRow(row)">-</span>
								<template v-else>
									<div
										v-if="isEditMode"
										class="caption-locale-cell"
										:data-edit-cell="editCellKey(row, 'copy.it')"
									>
										<div
											class="editable-grid-cell"
											contenteditable="plaintext-only"
											spellcheck="false"
											data-placeholder="IT文案"
											@focus="
												beginEditFieldFocus(editFocusTarget(row, 'copy.it'))
											"
											@paste="onEditableCellPaste"
											@blur="
												onEditableCellBlur(row, 'copy.it', $event);
												commitEditFieldChange(
													editFocusTarget(row, 'copy.it')
												);
												updateCopy(row);
											"
											v-text="row.copy.it"
										></div>
										<button
											type="button"
											class="caption-auto-translate-check"
											:class="{
												'is-on': isCaptionLocaleAutoTranslateOn(
													row.copy.captionUid,
													'it'
												)
											}"
											title="自动翻译"
											@mousedown.prevent
											@click.stop="
												toggleCaptionLocaleAutoTranslate(
													row.copy.captionUid,
													'it'
												)
											"
										>
											✓
										</button>
									</div>
									<span v-else>{{ row.copy.it || "-" }}</span>
								</template>
							</template>
						</el-table-column>
						<el-table-column label="ES文案" min-width="140">
							<template #header>
								<div class="caption-col-header">
									<button
										type="button"
										class="caption-col-toggle"
										:class="{ 'is-active': isCaptionColumnApplied('ES文案') }"
										@click="toggleCaptionColumnApplied('ES文案')"
									>
										ES文案 {{ isCaptionColumnApplied("ES文案") ? "✓" : "" }}
									</button>
								</div>
							</template>
							<template #default="{ row }">
								<span v-if="isMainPictureRow(row)">-</span>
								<template v-else>
									<div
										v-if="isEditMode"
										class="caption-locale-cell"
										:data-edit-cell="editCellKey(row, 'copy.es')"
									>
										<div
											class="editable-grid-cell"
											contenteditable="plaintext-only"
											spellcheck="false"
											data-placeholder="ES文案"
											@focus="
												beginEditFieldFocus(editFocusTarget(row, 'copy.es'))
											"
											@paste="onEditableCellPaste"
											@blur="
												onEditableCellBlur(row, 'copy.es', $event);
												commitEditFieldChange(
													editFocusTarget(row, 'copy.es')
												);
												updateCopy(row);
											"
											v-text="row.copy.es"
										></div>
										<button
											type="button"
											class="caption-auto-translate-check"
											:class="{
												'is-on': isCaptionLocaleAutoTranslateOn(
													row.copy.captionUid,
													'es'
												)
											}"
											title="自动翻译"
											@mousedown.prevent
											@click.stop="
												toggleCaptionLocaleAutoTranslate(
													row.copy.captionUid,
													'es'
												)
											"
										>
											✓
										</button>
									</div>
									<span v-else>{{ row.copy.es || "-" }}</span>
								</template>
							</template>
						</el-table-column>
						<el-table-column
							label="文案操作"
							width="88"
							align="center"
							class-name="caption-actions-col"
						>
							<template #header>
								<div class="caption-col-header">
									<button
										type="button"
										class="caption-col-toggle"
										:class="{ 'is-active': isCaptionColumnApplied('文案操作') }"
										@click="toggleCaptionColumnApplied('文案操作')"
									>
										文案操作 {{ isCaptionColumnApplied("文案操作") ? "✓" : "" }}
									</button>
								</div>
							</template>
							<template #default="{ row }">
								<span v-if="isMainPictureRow(row)">-</span>
								<div
									v-else
									class="caption-actions-cell"
									:data-edit-cell="editCellKey(row, 'captionActions')"
								>
									<el-button
										v-if="isEditMode"
										link
										type="primary"
										size="small"
										title="根据当前中文案翻译并填充已开启自动翻译的语言列"
										:loading="zhAutoTranslateKey === zhCaptionEditKey(row)"
										:disabled="!String(row.copy?.zh ?? '').trim()"
										@click="triggerCaptionRowTranslate(row)"
									>
										翻译
									</el-button>
									<el-button
										v-if="isEditMode"
										link
										type="primary"
										size="small"
										title="在当前文案行正下方插入一条空文案"
										@click="
											handleAddCaptionRow(row.requirementId, row.copyIndex)
										"
									>
										+ 加在下方
									</el-button>
									<el-button
										v-if="isEditMode && row.copiesCount > 1"
										link
										type="primary"
										size="small"
										:disabled="row.copyIndex <= 0"
										@click="handleMoveCaptionRow(row, -1)"
									>
										上移
									</el-button>
									<el-button
										v-if="isEditMode && row.copiesCount > 1"
										link
										type="primary"
										size="small"
										:disabled="row.copyIndex >= row.copiesCount - 1"
										@click="handleMoveCaptionRow(row, 1)"
									>
										下移
									</el-button>
									<el-checkbox
										:model-value="!!captionApplied[row.copy.captionUid || '']"
										size="small"
										class="caption-applied-check"
										@update:model-value="
											(v) =>
												setCaptionApplied(row.copy.captionUid, Boolean(v))
										"
									>
										<span title="是否已用于上架，与左侧「分项完成」无关"
											>已采用</span
										>
									</el-checkbox>
									<el-button
										v-if="isEditMode && row.copiesCount > 1"
										link
										type="danger"
										size="small"
										@click="handleDeleteCaptionRow(row)"
									>
										删文案
									</el-button>
								</div>
							</template>
						</el-table-column>
					</el-table>
				</div>
			</div>

			<!-- 其他信息折叠框 -->
			<design-task-other-info
				:variants="detail.variants"
				:factory-links="detail.factoryLinks"
				:purchases="detail.purchases"
				class="other-info-collapse"
			/>

			<!-- 变体信息对话框 -->
			<el-dialog v-model="variantDialogVisible" title="变体信息" width="800px">
				<div v-if="currentVariant" class="variant-dialog-content">
					<el-descriptions :column="2" border>
						<el-descriptions-item label="变体名称" :span="2">
							{{ currentVariant.name }}
						</el-descriptions-item>
						<el-descriptions-item label="变体图片" :span="2">
							<image-zoom
								v-if="currentVariant.imageUrl"
								:src="currentVariant.imageUrl"
								fit="cover"
								class="variant-dialog-image"
							/>
							<span v-else class="no-image-text">无图</span>
						</el-descriptions-item>
						<el-descriptions-item label="工厂链接组合" :span="2">
							<div class="factory-link-groups">
								<template
									v-if="
										currentVariant.group_proportions &&
										Object.keys(currentVariant.group_proportions).length
									"
								>
									<div
										v-for="(val, id) in currentVariant.group_proportions"
										:key="id"
										class="factory-link-group-item"
									>
										<template v-if="getFactoryLinkInfo(String(id))">
											<a
												:href="
													getFactoryLinkInfo(String(id))?.link ||
													undefined
												"
												target="_blank"
												class="factory-link-group-link"
											>
												{{ getFactoryLinkInfo(String(id))?.displayText }}
											</a>
											<span> * {{ val }}</span>
										</template>
										<template v-else> {{ id }} * {{ val }} </template>
									</div>
								</template>
								<span v-else class="no-submitter">—</span>
							</div>
						</el-descriptions-item>
						<el-descriptions-item label="变体描述" :span="2">
							{{ currentVariant.description }}
						</el-descriptions-item>
						<el-descriptions-item label="数量">
							{{ currentVariant.quantity }}
						</el-descriptions-item>
						<el-descriptions-item label="提交人">
							<div class="submitters">
								<el-tag
									v-for="(submitter, index) in getSubmitters(
										currentVariant.variantsid
									)"
									:key="index"
									type="info"
									class="submitter-tag"
								>
									{{ submitter }}
								</el-tag>
								<span
									v-if="getSubmitters(currentVariant.variantsid).length === 0"
									class="no-submitter"
									>暂无</span
								>
							</div>
						</el-descriptions-item>
					</el-descriptions>
				</div>
			</el-dialog>

			<el-dialog
				v-model="addSlotDialogVisible"
				title="新增图片位"
				width="480px"
				align-center
				append-to-body
				destroy-on-close
				@closed="resetAddPictureSlotForm"
			>
				<el-form label-width="92px" @submit.prevent>
					<el-form-item label="编号" required>
						<el-input
							v-model="addSlotLabel"
							placeholder="如 4-2"
							clearable
							@input="onAddSlotLabelInput"
						/>
					</el-form-item>
					<el-form-item label="类型" required>
						<el-select
							v-model="addSlotType"
							placeholder="类型"
							class="add-slot-type-select"
							:disabled="addMainOnlyLocked"
							@change="onAddSlotTypeChange"
						>
							<el-option-group label="自定义">
								<el-option
									v-for="opt in customTagOptions"
									:key="opt"
									:label="opt"
									:value="opt"
								/>
							</el-option-group>
							<el-option-group label="必选">
								<el-option
									v-for="opt in requiredTagOptionsNoMain"
									:key="opt"
									:label="opt"
									:value="opt"
								/>
							</el-option-group>
						</el-select>
						<div v-if="addMainOnlyLocked" class="add-slot-hint">
							编号为 *-1 时固定为主图
						</div>
					</el-form-item>
					<template v-if="addSlotEffectiveType === '主图'">
						<el-form-item label="MSKU" required>
							<el-select
								v-model="addSlotMsku"
								placeholder="挂载 MSKU"
								class="add-slot-mount-select"
								filterable
							>
								<el-option
									v-for="m in detail.mskus"
									:key="m.msku"
									:label="`${m.variant_name || '-'}-${m.account_name || '-'}`"
									:value="m.msku"
								/>
							</el-select>
						</el-form-item>
					</template>
					<template v-else>
						<el-form-item label="变体">
							<el-select
								v-model="addSlotVariantId"
								placeholder="全部变体"
								class="add-slot-mount-select"
								clearable
							>
								<el-option label="全部变体" value="" />
								<el-option
									v-for="v in detail.variants"
									:key="v.variantsid"
									:label="v.name || v.variantsid"
									:value="v.variantsid"
								/>
							</el-select>
						</el-form-item>
						<el-form-item label="账号">
							<el-select
								v-model="addSlotSellerAccountId"
								placeholder="全部账号"
								class="add-slot-mount-select"
								clearable
							>
								<el-option label="全部账号" value="" />
								<el-option
									v-for="s in detail.sellers"
									:key="s.seller_account_id"
									:label="s.account_name || s.seller_account_id"
									:value="s.seller_account_id"
								/>
							</el-select>
						</el-form-item>
						<div class="add-slot-hint">未选即挂载全部</div>
					</template>
					<el-form-item label="语言">
						<picture-mount-lang-indicators :status="addSlotMountLangStatus" />
					</el-form-item>
				</el-form>
				<template #footer>
					<el-button @click="addSlotDialogVisible = false">取消</el-button>
					<el-button
						type="primary"
						:loading="addSlotSubmitting"
						@click="submitAddPictureSlot"
					>
						创建
					</el-button>
				</template>
			</el-dialog>
		</div>
		<template #footer>
			<div class="dialog-footer">
				<el-button
					:type="isEditMode ? 'warning' : 'primary'"
					size="large"
					@click="toggleEditMode"
				>
					{{ isEditMode ? "完成修改" : "修改图需" }}
				</el-button>
				<el-button size="large" @click="handleBackToList">返回列表</el-button>
				<el-button
					v-if="primaryActionLabel"
					type="primary"
					size="large"
					@click="handleCompleteTask"
				>
					{{ primaryActionLabel }}
				</el-button>
			</div>
		</template>

		<MinioPathPicker
			:visible="minioPickerVisible"
			@update:visible="minioPickerVisible = $event"
			:initial-path="minioPickerInitialPath"
			folder-only
			@confirm="onMinioPathConfirm"
		/>
	</el-dialog>
</template>

<script setup lang="ts" name="app-design-task-detail">
import { reactive, computed, ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { FullScreen, Minus, Close, CircleClose, RefreshLeft, RefreshRight } from "@element-plus/icons-vue";
// @ts-ignore
import ImageZoom from "/$/app/components/image-zoom.vue";
import DesignTaskOtherInfo from "/$/app/components/design-task-other-info.vue";
// @ts-ignore
import PictureMountLangIndicators from "/$/app/components/picture-mount-lang-indicators.vue";
import { pictureMountLangStatus } from "../utils/listing-ai-required-languages";
import MinioPathPicker from "/$/app/components/minio-path-picker.vue";
import {
	resolveAssetUploadPickerPath,
	resolveAndValidateAssetUploadPath,
	type AssetUploadPathRole
} from "../utils/asset-upload-paths";
import {
	sortImageSlots,
	designTaskStatusText,
	isSlotLabelMinus1,
	getImageSlotSortModeBySku,
	setImageSlotSortModeBySku,
	product_main_image_display_url,
	type ImageSlotSortMode
} from "../utils";
import { service } from "/@/cool";
import { useUpload } from "/@/plugins/upload/hooks";
import { appConfig } from "../../../../../appConfig";
import { getMskuDisplayLabel } from "../utils/msku-key";

/** 文案类型 code -> 展示文案（与 DesignTaskAiService RAW_CAPTION_ROLES / 抽取 JSON prompt 一致） */
const CAPTION_ROLE_LABELS: Record<string, string> = {
	title: "标题",
	subtitle: "副标题",
	bullet: "卖点",
	detail_desc: "详情描述",
	product_spec: "产品参数",
	section_title: "分项标题",
	section_desc: "分项描述",
	step: "步骤说明",
	label_badge: "标签/徽章",
	other: "其他"
};

/** 下拉顺序与后端 SKELETON_PROMPT 中 rawCaptions.role 枚举一致 */
const CAPTION_ROLE_ORDER = [
	"title",
	"subtitle",
	"bullet",
	"detail_desc",
	"product_spec",
	"section_title",
	"section_desc",
	"step",
	"label_badge",
	"other"
] as const;

const CAPTION_ROLE_OPTIONS = CAPTION_ROLE_ORDER.map((value) => ({
	value,
	label: CAPTION_ROLE_LABELS[value] ?? value
}));

function captionRoleLabel(role: string | undefined): string {
	if (!role) return "";
	return CAPTION_ROLE_LABELS[role] ?? role;
}

/** 主图不展示、不可编辑 caption / 多语言文案 */
function isMainPictureRow(row: { picture?: { type?: string }; type?: string } | null | undefined): boolean {
	const t = row?.picture?.type ?? row?.type;
	return t === "主图";
}

function genCaptionUid(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

const captionApplied = ref<Record<string, boolean>>({});
const captionColumnApplied = ref<Record<string, boolean>>({});

/** 每条文案各语言单元格是否参与中文变更后的自动翻译（缺省 / true = 开启） */
const CAPTION_AUTO_TRANSLATE_LOCALES = ["uk", "de", "fr", "it", "es"] as const;
type CaptionAutoTranslateLocale = (typeof CAPTION_AUTO_TRANSLATE_LOCALES)[number];
const CAPTION_AUTO_TRANSLATE_LABELS: Record<CaptionAutoTranslateLocale, string> = {
	uk: "UK文案",
	de: "DE文案",
	fr: "FR文案",
	it: "IT文案",
	es: "ES文案"
};
const captionAutoTranslate = ref<
	Record<string, Partial<Record<CaptionAutoTranslateLocale, boolean>>>
>({});

const captionUidStorageKey = (taskId: number) => `design_task_caption_uids_v1_${taskId}`;
const captionAppliedStorageKey = (taskId: number) => `design_task_caption_applied_v1_${taskId}`;
const captionColumnAppliedStorageKey = (taskId: number) =>
	`design_task_caption_column_applied_v1_${taskId}`;
const captionAutoTranslateStorageKey = (taskId: number) =>
	`design_task_caption_auto_translate_v1_${taskId}`;

function readCaptionUidMap(taskId: number): Record<number, string[]> {
	try {
		const raw = localStorage.getItem(captionUidStorageKey(taskId));
		if (!raw) return {};
		const o = JSON.parse(raw) as Record<string, string[]>;
		const out: Record<number, string[]> = {};
		for (const k of Object.keys(o)) out[Number(k)] = o[k];
		return out;
	} catch {
		return {};
	}
}

function writeCaptionUidMap(taskId: number, map: Record<number, string[]>) {
	const asRecord: Record<string, string[]> = {};
	for (const pid of Object.keys(map)) {
		asRecord[pid] = map[Number(pid)];
	}
	localStorage.setItem(captionUidStorageKey(taskId), JSON.stringify(asRecord));
}

/** 与服务器返回的每条文案按顺序对齐 client uid，供「已采用」等纯前端状态使用 */
function reconcileAllCaptionUids(taskId: number) {
	const map = readCaptionUidMap(taskId);
	for (const pic of detail.pictures) {
		const pid = pic.id as number | undefined;
		if (!pid) continue;
		let copies = pic.copies;
		if (!Array.isArray(copies) || copies.length === 0) {
			copies = [{}];
			pic.copies = copies;
		}
		let uids = map[pid] || [];
		if (uids.length > copies.length) uids = uids.slice(0, copies.length);
		while (uids.length < copies.length) uids.push(genCaptionUid());
		map[pid] = uids;
		copies.forEach((c: any, i: number) => {
			c.captionUid = uids[i];
		});
	}
	writeCaptionUidMap(taskId, map);
}

function loadCaptionAppliedState(taskId: number) {
	try {
		const raw = localStorage.getItem(captionAppliedStorageKey(taskId));
		captionApplied.value = raw ? JSON.parse(raw) : {};
	} catch {
		captionApplied.value = {};
	}
}

function persistCaptionAppliedState(taskId: number) {
	try {
		localStorage.setItem(
			captionAppliedStorageKey(taskId),
			JSON.stringify(captionApplied.value)
		);
	} catch (e) {
		console.warn("persist caption applied", e);
	}
}

function loadCaptionColumnAppliedState(taskId: number) {
	try {
		const raw = localStorage.getItem(captionColumnAppliedStorageKey(taskId));
		captionColumnApplied.value = raw ? JSON.parse(raw) : {};
	} catch {
		captionColumnApplied.value = {};
	}
}

function persistCaptionColumnAppliedState(taskId: number) {
	try {
		localStorage.setItem(
			captionColumnAppliedStorageKey(taskId),
			JSON.stringify(captionColumnApplied.value)
		);
	} catch (e) {
		console.warn("persist caption column applied", e);
	}
}

function loadCaptionAutoTranslateState(taskId: number) {
	try {
		const raw = localStorage.getItem(captionAutoTranslateStorageKey(taskId));
		captionAutoTranslate.value = raw ? JSON.parse(raw) : {};
	} catch {
		captionAutoTranslate.value = {};
	}
}

function persistCaptionAutoTranslateState(taskId: number) {
	try {
		localStorage.setItem(
			captionAutoTranslateStorageKey(taskId),
			JSON.stringify(captionAutoTranslate.value)
		);
	} catch (e) {
		console.warn("persist caption auto translate", e);
	}
}

function isCaptionLocaleAutoTranslateOn(
	uid: string | undefined,
	locale: CaptionAutoTranslateLocale
): boolean {
	if (!uid) return true;
	return captionAutoTranslate.value[uid]?.[locale] !== false;
}

function setCaptionLocaleAutoTranslate(
	uid: string | undefined,
	locale: CaptionAutoTranslateLocale,
	enabled: boolean
) {
	if (!uid) return;
	const taskId = Number(props.taskId);
	if (Number.isNaN(taskId)) return;
	const prev = captionAutoTranslate.value[uid] || {};
	const nextLocales = { ...prev };
	if (enabled) delete nextLocales[locale];
	else nextLocales[locale] = false;
	const next = { ...captionAutoTranslate.value };
	if (Object.keys(nextLocales).length === 0) delete next[uid];
	else next[uid] = nextLocales;
	captionAutoTranslate.value = next;
	persistCaptionAutoTranslateState(taskId);
}

function toggleCaptionLocaleAutoTranslate(
	uid: string | undefined,
	locale: CaptionAutoTranslateLocale
) {
	setCaptionLocaleAutoTranslate(
		uid,
		locale,
		!isCaptionLocaleAutoTranslateOn(uid, locale)
	);
}

function setCaptionApplied(uid: string | undefined, value: boolean) {
	if (!uid) return;
	const taskId = Number(props.taskId);
	if (Number.isNaN(taskId)) return;
	const next = { ...captionApplied.value };
	if (value) next[uid] = true;
	else delete next[uid];
	captionApplied.value = next;
	persistCaptionAppliedState(taskId);
}

function toggleCaptionRowApplied(row: any) {
	if (isMainPictureRow(row)) return;
	const uid = row?.copy?.captionUid as string | undefined;
	if (!uid) return;
	setCaptionApplied(uid, !Boolean(captionApplied.value[uid]));
}

function handleCaptionRowDblclick(row: any, column: any) {
	if (batchRewriteMode.value) return;
	const label = column?.label as string | undefined;
	if (!label || !CAPTION_AREA_COLUMN_LABELS.has(label)) return;
	if (isMainPictureRow(row)) return;
	toggleCaptionRowApplied(row);
}

function handleCaptionRowContextmenu(row: any, column: any, event: Event) {
	if (batchRewriteMode.value) return;
	const label = column?.label as string | undefined;
	if (!label || !CAPTION_AREA_COLUMN_LABELS.has(label)) return;
	if (isMainPictureRow(row)) return;
	event.preventDefault();
	toggleCaptionRowApplied(row);
}

function getCellCopyText(row: any, label: string): string {
	if (label === "编号") return String(row?.picture?.label ?? row?.label ?? "");
	if (label === "挂载") {
		if (row?.picture?.type === "主图") return getMskuLabelDetail(row?.picture?.msku) || "—";
		const variant = row?.picture?.variantId
			? getVariantName(row?.picture?.variantId) || String(row?.picture?.variantId)
			: "全部变体";
		const seller = row?.picture?.sellerAccountId
			? getSellerName(row?.picture?.sellerAccountId)
			: "全部账号";
		return `变体: ${variant}; 账号: ${seller}`;
	}
	if (label === "参考图") return String(row?.referenceImage || "—");
	if (label === "图需") return String(row?.requirements || "—");
	if (label === "补充说明") {
		const text = String(row?.remarkDoc?.text || "").trim();
		const imgs = Array.isArray(row?.remarkDoc?.images) ? row.remarkDoc.images.length : 0;
		if (!text && imgs === 0) return "-";
		if (!text) return `图片 ${imgs} 张`;
		if (imgs === 0) return text;
		return `${text}（图片 ${imgs} 张）`;
	}
	if (CAPTION_AREA_COLUMN_LABELS.has(label)) {
		if (isMainPictureRow(row)) return "-";
	}
	if (label === "原图文案") {
		if (row?.copy?.raw_after_rephrase) {
			return `${row?.copy?.raw_text || "-"} -> ${row?.copy?.raw_after_rephrase || "-"}`;
		}
		return String(row?.copy?.raw_text || "-");
	}
	if (label === "文案类型") return captionRoleLabel(row?.copy?.role) || "-";
	if (label === "中文案") return String(row?.copy?.zh || "-");
	if (label === "UK文案") return String(row?.copy?.uk || "-");
	if (label === "DE文案") return String(row?.copy?.de || "-");
	if (label === "FR文案") return String(row?.copy?.fr || "-");
	if (label === "IT文案") return String(row?.copy?.it || "-");
	if (label === "ES文案") return String(row?.copy?.es || "-");
	if (label === "文案操作") return captionApplied.value[row?.copy?.captionUid || ""] ? "已采用" : "未采用";
	return "";
}

async function copyTextToClipboard(text: string) {
	if (navigator?.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}
	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.style.position = "fixed";
	textarea.style.left = "-9999px";
	document.body.appendChild(textarea);
	textarea.focus();
	textarea.select();
	document.execCommand("copy");
	document.body.removeChild(textarea);
}

async function handleTableCellClick(row: any, column: any, _cell: any, event: MouseEvent) {
	if (!event?.ctrlKey && !event?.metaKey) return;
	const target = event.target as HTMLElement | null;
	if (
		target?.closest(
			"input, textarea, button, a, .el-input, .el-select, .el-checkbox, .editable-grid-cell, [contenteditable]"
		)
	) {
		return;
	}

	const label = column?.label as string | undefined;
	if (!label) return;
	const text = getCellCopyText(row, label).trim();
	if (!text) return;
	try {
		await copyTextToClipboard(text);
		ElMessage.success(`已复制：${text.length > 24 ? `${text.slice(0, 24)}...` : text}`);
	} catch (e) {
		console.error(e);
		ElMessage.error("复制失败");
	}
}

function isCaptionColumnApplied(label: string): boolean {
	return Boolean(captionColumnApplied.value[label]);
}

function toggleCaptionColumnApplied(label: string) {
	if (batchRewriteMode.value) return;
	if (!CAPTION_AREA_COLUMN_LABELS.has(label)) return;
	const taskId = Number(props.taskId);
	if (Number.isNaN(taskId)) return;

	const next = { ...captionColumnApplied.value };
	if (next[label]) delete next[label];
	else next[label] = true;
	captionColumnApplied.value = next;
	persistCaptionColumnAppliedState(taskId);
}

const CAPTION_AREA_COLUMN_LABELS = new Set([
	"原图文案",
	"文案类型",
	"中文案",
	"UK文案",
	"DE文案",
	"FR文案",
	"IT文案",
	"ES文案",
	"文案操作"
]);

/** 分项已完成的绿色底：仅图位列（与「已采用」涂文案列对称） */
const PICTURE_SLOT_COLUMN_LABELS = new Set([
	"编号",
	"挂载",
	"参考图",
	"图需",
	"补充说明"
]);

/** 与选图弹窗 design-requirement-regenerate-dialog 一致 */
const customTagOptions = ["多场景图", "对比图", "模特图", "细节图", "多细节图"];
const requiredTagOptionsNoMain = ["尺寸图", "配件图", "场景图"];

type DetailRemarkDocState = { text: string; images: string[] };

function emptyDetailRemarkDoc(): DetailRemarkDocState {
	return { text: "", images: [] };
}

function parseRemarkDocFromApi(raw: unknown): DetailRemarkDocState {
	if (raw == null || raw === "") return emptyDetailRemarkDoc();
	let o: any = raw;
	if (typeof raw === "string") {
		try {
			o = JSON.parse(raw);
		} catch {
			return emptyDetailRemarkDoc();
		}
	}
	if (typeof o !== "object" || !o) return emptyDetailRemarkDoc();
	const text = typeof o.text === "string" ? o.text : "";
	const images = Array.isArray(o.images)
		? o.images.filter((x: unknown) => typeof x === "string" && String(x).trim())
		: [];
	return { text, images: [...images] };
}

function remarkDocToSavePayload(doc: DetailRemarkDocState): {
	text?: string;
	images?: string[];
} | null {
	const t = (doc.text ?? "").trim();
	const imgs = (doc.images ?? []).map((u) => String(u).trim()).filter(Boolean);
	if (!t && !imgs.length) return null;
	const out: { text?: string; images?: string[] } = {};
	if (t) out.text = t;
	if (imgs.length) out.images = imgs;
	return out;
}

function captionSnapshotFields(c: any) {
	return {
		raw_text: c.raw_text ?? "",
		raw_after_rephrase: c.raw_after_rephrase ?? "",
		role: c.role ?? "",
		zh: c.zh ?? "",
		uk: c.uk ?? "",
		de: c.de ?? "",
		fr: c.fr ?? "",
		it: c.it ?? "",
		es: c.es ?? ""
	};
}

const detailTableRef = ref<any>(null);

const { toUpload } = useUpload();
const detailRemarkFileInputRef = ref<HTMLInputElement | null>(null);
const detailRemarkPickId = ref<number | null>(null);
const detailRemarkUploadingId = ref<number | null>(null);
const detailReferenceFileInputRef = ref<HTMLInputElement | null>(null);
const detailReferencePickId = ref<number | null>(null);
const detailReferenceUploadingId = ref<number | null>(null);

function removeDetailRemarkImage(pictureId: number | undefined, index: number) {
	if (pictureId == null) return;
	const pic = detail.pictures.find((p: any) => Number(p.id) === pictureId);
	if (pic?.remarkDoc?.images) pic.remarkDoc.images.splice(index, 1);
}

function removeDetailRemarkImageAtRow(row: { pictureId?: number; requirementId?: string }, index: number | string) {
	const target =
		editFocusTargetByPictureId(row.pictureId, "remarkDoc.images") ??
		(row.requirementId
			? { requirementId: row.requirementId, field: "remarkDoc.images" as const }
			: null);
	if (target) recordImmediateEdit(target);
	removeDetailRemarkImage(row.pictureId, Number(index));
}

function openDetailRemarkPicker(pictureId: number | undefined) {
	if (pictureId == null) return;
	detailRemarkPickId.value = pictureId;
	detailRemarkFileInputRef.value?.click();
}

async function onDetailRemarkFileSelected(ev: Event) {
	const input = ev.target as HTMLInputElement;
	const file = input.files?.[0];
	const pid = detailRemarkPickId.value;
	input.value = "";
	detailRemarkPickId.value = null;
	if (!file || pid == null) return;
	if (!file.type.startsWith("image/")) {
		ElMessage.warning("请选择图片文件");
		return;
	}
	const pic = detail.pictures.find((p: any) => Number(p.id) === pid);
	if (!pic?.remarkDoc) return;
	const target = editFocusTargetByPictureId(pid, "remarkDoc.images");
	if (target) recordImmediateEdit(target);
	detailRemarkUploadingId.value = pid;
	try {
		const { url } = await toUpload(file);
		pic.remarkDoc.images.push(url);
		ElMessage.success("已上传示意图");
	} catch {
		// 错误提示由 useUpload / toUpload 统一处理（含 413）
	} finally {
		detailRemarkUploadingId.value = null;
	}
}

function openDetailReferencePicker(pictureId: number | undefined) {
	if (pictureId == null) return;
	detailReferencePickId.value = pictureId;
	detailReferenceFileInputRef.value?.click();
}

async function onDetailReferenceFileSelected(ev: Event) {
	const input = ev.target as HTMLInputElement;
	const file = input.files?.[0];
	const pid = detailReferencePickId.value;
	input.value = "";
	detailReferencePickId.value = null;
	if (!file || pid == null) return;
	if (!file.type.startsWith("image/")) {
		ElMessage.warning("请选择图片文件");
		return;
	}
	const pic = detail.pictures.find((p: any) => Number(p.id) === pid);
	if (!pic) return;
	const target = editFocusTargetByPictureId(pid, "referenceImage");
	if (target) recordImmediateEdit(target);
	detailReferenceUploadingId.value = pid;
	try {
		const { url } = await toUpload(file);
		pic.referenceImage = url;
		ElMessage.success("参考图已更新");
	} catch {
		// 错误提示由 useUpload / toUpload 统一处理（含 413）
	} finally {
		detailReferenceUploadingId.value = null;
	}
}

function clearDetailReferenceImage(row: { picture?: any; pictureId?: number; requirementId?: string }) {
	const pic =
		row.picture ?? detail.pictures.find((p: any) => Number(p.id) === Number(row.pictureId));
	if (!pic) return;
	const target =
		editFocusTargetByPictureId(row.pictureId ?? pic.id, "referenceImage") ??
		(row.requirementId || pic.label
			? {
					requirementId: row.requirementId || pic.label,
					field: "referenceImage" as const
				}
			: null);
	if (target) recordImmediateEdit(target);
	pic.referenceImage = "";
}

// 展平表格数据，每个copy一行，使用编号(label)作为唯一ID
const flattenedTableData = computed(() => {
	const result: any[] = [];
	// 先对 pictures 进行排序
	const sortedPictures = [...detail.pictures].sort((a: any, b: any) =>
		sortImageSlots(a, b, imageSlotSortMode.value)
	);

	sortedPictures.forEach((picture: any) => {
		// 主图不展示多条文案行，仅占位一行
		const copies = isMainPictureRow({ picture }) ? [{}] : picture.copies || [{}];
		// 使用编号(label)作为唯一ID，因为每个图片位的编号是唯一的
		const requirementId = picture.label;
		copies.forEach((copy: any, copyIndex: number) => {
			result.push({
				picture,
				requirementId, // 编号ID，用于完成状态
				pictureId: picture.id != null ? Number(picture.id) : undefined,
				label: picture.label,
				type: picture.type,
				variantId: picture.variantId,
				variantName: getVariantName(picture.variantId as string | undefined),
				shop: picture.shop,
				msku: picture.msku, // MSKU
				referenceImage: picture.referenceImage,
				requirements: picture.requirements,
				remarkDoc: picture.remarkDoc,
				copy: copy, // 单个文案
				copyIndex,
				isFirstRow: copyIndex === 0, // 标记是否为第一行，用于显示完成状态
				copiesCount: copies.length // 该图需的文案数量，用于rowspan计算
			});
		});
	});
	return result;
});

// Props
interface Props {
	modelValue: boolean;
	taskId?: string | number;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: false,
	taskId: undefined
});

// Emits
const emit = defineEmits<{
	"update:modelValue": [value: boolean];
	stepProgressChange: [payload: { taskId: number; stepDone: number; stepTotal: number }];
	closed: [];
}>();

// 对话框显示状态
const dialogVisible = computed({
	get: () => props.modelValue,
	set: (value) => emit("update:modelValue", value)
});

const isFullscreen = ref(true);

/** el-table 的 height 用数字(px)；全屏时给图需表更多纵向空间 */
const REQUIREMENT_TABLE_VH = 0.8;
const REQUIREMENT_TABLE_VH_FULLSCREEN = 0.8;
const REQUIREMENT_TABLE_MAX_PX = 700;
const requirementTablePxHeight = ref(REQUIREMENT_TABLE_MAX_PX);

function computeRequirementTableHeightPx(): number {
	if (typeof window === "undefined") return REQUIREMENT_TABLE_MAX_PX;
	const vh = isFullscreen.value ? REQUIREMENT_TABLE_VH_FULLSCREEN : REQUIREMENT_TABLE_VH;
	const maxPx = isFullscreen.value ? 2400 : REQUIREMENT_TABLE_MAX_PX;
	const h = Math.round(window.innerHeight * vh);
	return Math.min(Math.max(h, 240), maxPx);
}

function refreshRequirementTableHeight() {
	requirementTablePxHeight.value = computeRequirementTableHeightPx();
}

const variantDialogVisible = ref(false);
const currentVariant = ref<any>(null);
const completedMap = ref<Record<string, boolean>>({}); // 存储每个图片的完成状态

/** 批量改写：仅拉丁语列（不含中文） */
const BATCH_LATIN_COPY_FIELDS = ["uk", "de", "fr", "it", "es"] as const;

const batchRewriteMode = ref(false);
const batchSelectedRows = ref<any[]>([]);

const batchSelectedCount = computed(() => batchSelectedRows.value.length);

const tableToolbarTip = computed(() => {
	if (batchRewriteMode.value) {
		return "批量改写：勾选文案行后点「首字母大写 / 全大写 / 全小写」（仅 UK/DE/FR/IT/ES，中文不变）；此模式下双击/右键不再切换「已采用」";
	}
	return "提示：文案区支持双击/右键标记行，点列名✓可整列标记，Ctrl/Cmd + 单击可复制单元格；编辑中 Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z 重做";
});

function captionRowKey(row: { requirementId?: string; copyIndex?: number }): string {
	return `${row.requirementId ?? ""}::${row.copyIndex ?? 0}`;
}

function isBatchRowSelectable(row: any): boolean {
	return !isMainPictureRow(row);
}

function exitBatchRewriteMode() {
	batchRewriteMode.value = false;
	batchSelectedRows.value = [];
	nextTick(() => detailTableRef.value?.clearSelection?.());
}

function enterBatchRewriteMode() {
	if (!isEditMode.value) {
		ElMessage.warning("请先点击「修改图需」");
		return;
	}
	batchRewriteMode.value = true;
	batchSelectedRows.value = [];
	nextTick(() => detailTableRef.value?.clearSelection?.());
}

function onBatchTableSelectionChange(rows: any[]) {
	batchSelectedRows.value = rows.filter((r) => !isMainPictureRow(r));
}

function getBatchSelectableCaptionRows(): any[] {
	return flattenedTableData.value.filter((r) => !isMainPictureRow(r));
}

function batchSelectAllCaptionRows() {
	const table = detailTableRef.value;
	if (!table) return;
	table.clearSelection?.();
	getBatchSelectableCaptionRows().forEach((row) => {
		table.toggleRowSelection?.(row, true);
	});
}

function batchClearSelection() {
	detailTableRef.value?.clearSelection?.();
	batchSelectedRows.value = [];
}

/** 按词首字母大写（拉丁语系文案） */
function toTitleCaseLatin(text: string): string {
	return text
		.split(/(\s+)/)
		.map((part) => {
			if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(part)) return part;
			const lower = part.toLowerCase();
			return lower.charAt(0).toUpperCase() + lower.slice(1);
		})
		.join("");
}

function applyBatchLatinCase(mode: "title" | "upper" | "lower") {
	const rows = batchSelectedRows.value.filter((r) => !isMainPictureRow(r));
	if (!rows.length) {
		ElMessage.warning("请先勾选要改写的文案行");
		return;
	}
	const first = rows[0];
	recordImmediateEdit({
		requirementId: first.requirementId,
		copyIndex: first.copyIndex ?? 0,
		field: "copy.uk"
	});

	let cellCount = 0;
	for (const row of rows) {
		const pic = detail.pictures.find((p: any) => p.label === row.requirementId);
		if (!pic?.copies?.length) continue;
		const idx = row.copyIndex as number;
		const copy = pic.copies[idx];
		if (!copy) continue;
		for (const field of BATCH_LATIN_COPY_FIELDS) {
			const raw = String(copy[field] ?? "").trim();
			if (!raw) continue;
			const next =
				mode === "title"
					? toTitleCaseLatin(raw)
					: mode === "upper"
						? raw.toUpperCase()
						: raw.toLowerCase();
			if (next !== copy[field]) {
				copy[field] = next;
				cellCount++;
			}
		}
		Object.assign(row.copy, copy);
	}

	const modeLabel =
		mode === "title" ? "首字母大写" : mode === "upper" ? "全大写" : "全小写";
	if (cellCount === 0) {
		ElMessage.info("所选行的拉丁语列为空或无需变更");
		return;
	}
	ElMessage.success(`已对 ${rows.length} 行应用${modeLabel}（${cellCount} 个单元格，中文未改）`);
}

function tableRowClassName({ row }: { row: any }) {
	if (!batchRewriteMode.value || isMainPictureRow(row)) return "";
	if (batchSelectedRows.value.some((r) => captionRowKey(r) === captionRowKey(row))) {
		return "batch-rewrite-row-selected";
	}
	return "";
}

/** 合并行用 column.label；分项完成涂左、已采用涂右，互不影响 */
function tableCellClassName({ row, column }: { row: any; column: any }) {
	const label = column?.label as string | undefined;
	if (!label) return "";
	if (PICTURE_SLOT_COLUMN_LABELS.has(label) && completedMap.value[row.requirementId]) {
		return "caption-cell-adopted";
	}
	if (!CAPTION_AREA_COLUMN_LABELS.has(label)) return "";
	if (isMainPictureRow(row)) return "";
	const uid = row.copy?.captionUid as string | undefined;
	const rowAdopted = Boolean(uid && captionApplied.value[uid]);
	const colAdopted = Boolean(captionColumnApplied.value[label]);
	if (rowAdopted && colAdopted) return "caption-cell-adopted-strong";
	if (rowAdopted || colAdopted) {
		return "caption-cell-adopted";
	}
	return "";
}

const isEditMode = ref(false); // 编辑模式状态

/** 图需表编辑撤销 / 重做（对应 Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z） */
type EditFocusField =
	| "msku"
	| "variantId"
	| "sellerAccountId"
	| "requirements"
	| "remarkDoc.text"
	| "referenceImage"
	| "remarkDoc.images"
	| "copy.role"
	| "copy.zh"
	| "copy.uk"
	| "copy.de"
	| "copy.fr"
	| "copy.it"
	| "copy.es"
	| "captionActions"
	| "pictureSlot";

type EditFocusTarget = {
	requirementId: string;
	copyIndex?: number;
	field: EditFocusField;
};

type EditHistoryEntry = {
	pictures: any[];
	captionUidMap: Record<string, string[]>;
	focus?: EditFocusTarget;
};

const editUndoStack = ref<EditHistoryEntry[]>([]);
const editRedoStack = ref<EditHistoryEntry[]>([]);
let editPendingBaseline: EditHistoryEntry | null = null;

const canUndoEdit = computed(() => editUndoStack.value.length > 0);
const canRedoEdit = computed(() => editRedoStack.value.length > 0);

function clonePicturesForHistory(): any[] {
	return JSON.parse(JSON.stringify(detail.pictures));
}

function cloneCaptionUidMapForHistory(): Record<string, string[]> {
	const taskId = Number(props.taskId);
	if (Number.isNaN(taskId)) return {};
	return JSON.parse(JSON.stringify(readCaptionUidMap(taskId)));
}

function editHistorySnapshotsEqual(a: EditHistoryEntry, b: EditHistoryEntry): boolean {
	return (
		JSON.stringify(a.pictures) === JSON.stringify(b.pictures) &&
		JSON.stringify(a.captionUidMap) === JSON.stringify(b.captionUidMap)
	);
}

function snapshotEditHistoryEntry(focus?: EditFocusTarget): EditHistoryEntry {
	return {
		pictures: clonePicturesForHistory(),
		captionUidMap: cloneCaptionUidMapForHistory(),
		focus
	};
}

function clearEditHistory() {
	editUndoStack.value = [];
	editRedoStack.value = [];
	editPendingBaseline = null;
}

function restoreEditHistoryEntry(entry: EditHistoryEntry) {
	detail.pictures.length = 0;
	detail.pictures.push(...JSON.parse(JSON.stringify(entry.pictures)));
	const taskId = Number(props.taskId);
	if (!Number.isNaN(taskId)) {
		writeCaptionUidMap(taskId, JSON.parse(JSON.stringify(entry.captionUidMap)));
		reconcileAllCaptionUids(taskId);
	}
}

function editFocusTarget(row: any, field: EditFocusField): EditFocusTarget {
	const copyField =
		field.startsWith("copy.") || field === "captionActions";
	return {
		requirementId: String(row.requirementId ?? row.picture?.label ?? ""),
		copyIndex: copyField ? (row.copyIndex ?? 0) : undefined,
		field
	};
}

function editFocusTargetByPictureId(
	pictureId: number | undefined,
	field: EditFocusField,
	copyIndex = 0
): EditFocusTarget | null {
	if (pictureId == null) return null;
	const pic = detail.pictures.find((p: any) => Number(p.id) === Number(pictureId));
	if (!pic?.label) return null;
	const copyField = field.startsWith("copy.") || field === "captionActions";
	return {
		requirementId: pic.label,
		copyIndex: copyField ? copyIndex : undefined,
		field
	};
}

function editCellKey(row: any, field: EditFocusField): string {
	const target = editFocusTarget(row, field);
	const copyIndex = target.copyIndex ?? 0;
	return `${target.requirementId}::${copyIndex}::${field}`;
}

function focusEditTarget(target: EditFocusTarget | undefined) {
	if (!target?.requirementId) return;
	const key = `${target.requirementId}::${target.copyIndex ?? 0}::${target.field}`;
	nextTick(() => {
		const tableEl = detailTableRef.value?.$el as HTMLElement | undefined;
		const cell = tableEl?.querySelector(`[data-edit-cell="${key}"]`) as HTMLElement | null;
		if (!cell) {
			scrollDetailToPictureLabel(target.requirementId);
			return;
		}
		const textarea = cell.querySelector("textarea") as HTMLTextAreaElement | null;
		const input = cell.querySelector(
			"input:not([type='hidden']):not([type='checkbox'])"
		) as HTMLInputElement | null;
		const editable = cell.querySelector("[contenteditable]") as HTMLElement | null;
		const selectWrap = cell.querySelector(
			".el-select .el-select__wrapper, .el-select__wrapper"
		) as HTMLElement | null;
		const focusable = textarea || input || editable || selectWrap;
		if (focusable?.focus) {
			focusable.focus({ preventScroll: false });
		} else {
			cell.focus?.();
		}
		cell.scrollIntoView({ block: "nearest", inline: "nearest" });
	});
}

function beginEditFieldFocus(target: EditFocusTarget) {
	if (!isEditMode.value) return;
	if (editPendingBaseline) return;
	editPendingBaseline = snapshotEditHistoryEntry(target);
}

function commitEditFieldChange(target: EditFocusTarget) {
	if (!isEditMode.value || !editPendingBaseline) return;
	const current = snapshotEditHistoryEntry(target);
	if (!editHistorySnapshotsEqual(editPendingBaseline, current)) {
		editUndoStack.value.push({ ...editPendingBaseline, focus: target });
		editRedoStack.value = [];
	}
	editPendingBaseline = null;
}

function recordImmediateEdit(target: EditFocusTarget) {
	if (!isEditMode.value) return;
	const entry = snapshotEditHistoryEntry(target);
	const last = editUndoStack.value[editUndoStack.value.length - 1];
	if (last && editHistorySnapshotsEqual(last, entry)) return;
	editUndoStack.value.push(entry);
	editRedoStack.value = [];
}

function undoEdit() {
	if (!canUndoEdit.value) return;
	const undoEntry = editUndoStack.value[editUndoStack.value.length - 1];
	const current = snapshotEditHistoryEntry(undoEntry?.focus);
	editRedoStack.value.push({ ...current, focus: undoEntry?.focus });
	const entry = editUndoStack.value.pop()!;
	editPendingBaseline = null;
	restoreEditHistoryEntry(entry);
	if (entry.focus) focusEditTarget(entry.focus);
}

function redoEdit() {
	if (!canRedoEdit.value) return;
	const redoEntry = editRedoStack.value[editRedoStack.value.length - 1];
	const current = snapshotEditHistoryEntry(redoEntry?.focus);
	editUndoStack.value.push({ ...current, focus: redoEntry?.focus });
	const entry = editRedoStack.value.pop()!;
	editPendingBaseline = null;
	restoreEditHistoryEntry(entry);
	if (entry.focus) focusEditTarget(entry.focus);
}

function onRequirementEditKeydown(e: KeyboardEvent) {
	if (!isEditMode.value) return;
	if (!(e.metaKey || e.ctrlKey)) return;
	const key = e.key.toLowerCase();
	if (key === "z") {
		if (e.shiftKey) {
			if (!canRedoEdit.value) return;
			e.preventDefault();
			redoEdit();
		} else {
			if (!canUndoEdit.value) return;
			e.preventDefault();
			undoEdit();
		}
	} else if (key === "y" && e.ctrlKey && !e.metaKey) {
		if (!canRedoEdit.value) return;
		e.preventDefault();
		redoEdit();
	}
}

const addSlotDialogVisible = ref(false);
const addSlotLabel = ref("");
const addSlotType = ref("场景图");
const addSlotMsku = ref("");
const addSlotVariantId = ref("");
const addSlotSellerAccountId = ref("");
const addSlotSubmitting = ref(false);

const addMainOnlyLocked = computed(() => isSlotLabelMinus1(addSlotLabel.value.trim()));

const addSlotEffectiveType = computed(() => {
	if (addMainOnlyLocked.value) return "主图";
	return addSlotType.value;
});

const addSlotMountLangStatus = computed(() => {
	if (addSlotEffectiveType.value === "主图") {
		return pictureMountLangStatus(detail.purchases, {
			isMainPicture: true,
			msku: addSlotMsku.value
		});
	}
	return pictureMountLangStatus(detail.purchases, {
		variantId: addSlotVariantId.value,
		sellerAccountId: addSlotSellerAccountId.value
	});
});

const detailLoading = ref(false);
const statusCode = ref<number | null>(null);
const imageSlotSortMode = ref<ImageSlotSortMode>("position");

const showStepCheckbox = computed(() => {
	const code = statusCode.value ?? 0;
	return code === 103 || code === 202 || code === 302;
});

const primaryActionLabel = computed(() => {
	const code = statusCode.value ?? 0;
	if (code === 103) return "完成审核";
	if (code === 201) return "领取任务";
	if (code === 202) return "完成拍摄";
	if (code === 301) return "领取任务";
	if (code === 302) return "完成做图";
	return "";
});

// ===== 素材库上传路径 =====
const minioPickerVisible = ref(false);
const minioPickerInitialPath = ref("");
const minioPickerTarget = ref<AssetUploadPathRole>("photographer");
const lastSavedUploadPaths = reactive({
	photographer: "",
	designer: ""
});
const uploadPathSaving = reactive({
	photographer: false,
	designer: false
});

function syncLastSavedUploadPaths() {
	lastSavedUploadPaths.photographer = detail.photographerUploadPath || "";
	lastSavedUploadPaths.designer = detail.designerUploadPath || "";
}

function openMinioPicker(target: AssetUploadPathRole) {
	minioPickerTarget.value = target;
	const existing =
		target === "photographer"
			? detail.photographerUploadPath
			: detail.designerUploadPath;
	minioPickerInitialPath.value = resolveAssetUploadPickerPath(existing, target);
	minioPickerVisible.value = true;
}

async function persistUploadPath(target: AssetUploadPathRole, path: string) {
	const taskId = Number(props.taskId);
	if (!taskId) {
		ElMessage.warning("任务尚未加载完成，请稍后再试");
		return false;
	}
	const patch: Record<string, any> = { taskId };
	if (target === "photographer") {
		patch.photographer_upload_path = path;
	} else {
		patch.designer_upload_path = path;
	}
	await (service as any).app.design_task.request({
		url: "/updateUploadPaths",
		method: "POST",
		data: patch
	});
	if (target === "photographer") {
		detail.photographerUploadPath = path;
	} else {
		detail.designerUploadPath = path;
	}
	lastSavedUploadPaths[target] = path;
	return true;
}

async function commitUploadPath(target: AssetUploadPathRole, options?: { silent?: boolean }) {
	const raw =
		target === "photographer" ? detail.photographerUploadPath : detail.designerUploadPath;
	const trimmed = String(raw || "").trim();
	if (trimmed === lastSavedUploadPaths[target]) return true;

	uploadPathSaving[target] = true;
	try {
		if (!trimmed) {
			const ok = await persistUploadPath(target, "");
			if (ok && !options?.silent) ElMessage.success("已保存上传路径");
			return ok;
		}

		const resolved = await resolveAndValidateAssetUploadPath(trimmed);
		if (resolved.error) {
			if (!options?.silent) ElMessage.error(resolved.error);
			if (target === "photographer") {
				detail.photographerUploadPath = lastSavedUploadPaths.photographer;
			} else {
				detail.designerUploadPath = lastSavedUploadPaths.designer;
			}
			return false;
		}

		const ok = await persistUploadPath(target, resolved.path);
		if (ok && !options?.silent) ElMessage.success("已保存上传路径");
		return ok;
	} catch (e: any) {
		if (!options?.silent) ElMessage.error(e?.message || "保存失败");
		if (target === "photographer") {
			detail.photographerUploadPath = lastSavedUploadPaths.photographer;
		} else {
			detail.designerUploadPath = lastSavedUploadPaths.designer;
		}
		return false;
	} finally {
		uploadPathSaving[target] = false;
	}
}

async function onMinioPathConfirm(path: string) {
	const target = minioPickerTarget.value;
	try {
		const ok = await persistUploadPath(target, path);
		if (ok) ElMessage.success("已保存上传路径");
	} catch (e: any) {
		ElMessage.error(e?.message || "保存失败");
	}
}

/** 完成拍摄/做图前确保路径已规范化并校验通过 */
async function ensureUploadPathReady(target: AssetUploadPathRole): Promise<boolean> {
	const raw =
		target === "photographer" ? detail.photographerUploadPath : detail.designerUploadPath;
	const trimmed = String(raw || "").trim();
	if (!trimmed) {
		ElMessage.warning(
			target === "photographer" ? "请先填写摄影上传路径" : "请先填写美工上传路径"
		);
		return false;
	}

	const resolved = await resolveAndValidateAssetUploadPath(trimmed);
	if (resolved.error) {
		ElMessage.error(resolved.error);
		return false;
	}

	if (resolved.path === lastSavedUploadPaths[target]) {
		return true;
	}

	uploadPathSaving[target] = true;
	try {
		return await persistUploadPath(target, resolved.path);
	} catch (e: any) {
		ElMessage.error(e?.message || "保存失败");
		return false;
	} finally {
		uploadPathSaving[target] = false;
	}
}

const detail = reactive({
	status: "",
	productName: "",
	sku: "",
	asin: "",
	marketplace: "",
	designerUploadPath: "",
	photographerUploadPath: "",
	mainImage: "",
	extraImages: [] as string[],
	pictures: [] as any[],
	factoryLinks: [] as any[],
	variants: [] as any[],
	purchases: [] as any[],
	sellers: [] as any[],
	mskus: [] as any[]
});

async function loadDetail(id: string | number) {
	if (!service.app?.design_task?.detail) return;
	detailLoading.value = true;
	try {
		const res = await service.app.design_task.detail({ id: Number(id) });
		const data = res?.data ?? res;
		const task = data.task;
		const candidate = data.candidate;
		const pictures = data.pictures ?? [];
		if (!task) return;
		// requirements 现在是纯文本字段
		const reqStr = (p: any) => p.requirements || "";
		const code = Number(task.status);
		statusCode.value = Number.isFinite(code) ? code : null;
		detail.status = designTaskStatusText(code);
		detail.productName = candidate?.produce_name ?? "";
		detail.sku = candidate?.sku ?? "";
		imageSlotSortMode.value = getImageSlotSortModeBySku(detail.sku);
		detail.asin = candidate?.asin ?? "";
		detail.marketplace = candidate?.marketplace ?? "";
		detail.designerUploadPath = task.designer_upload_path ?? "";
		detail.photographerUploadPath = task.photographer_upload_path ?? "";
		syncLastSavedUploadPaths();
		detail.mainImage = product_main_image_display_url(
			task.main_image || candidate?.image_url
		);
		detail.extraImages = [];
		detail.pictures.length = 0;
		detail.pictures.push(
			...pictures.map((p: any) => {
				const msku = (p.msku ?? "").trim();
				const type = (p.type ?? "").trim();
				const resolvedType = isSlotLabelMinus1(p.label)
					? "主图"
					: type === "主图"
						? "场景图"
						: type;
				return {
					id: p.id != null ? Number(p.id) : undefined,
					label: p.label,
					type: resolvedType,
					variantId: (p.variant_id ?? "").trim(),
					variantName: "",
					shop: p.seller_account_id ?? p.seller_id ?? "",
					sellerAccountId: (p.seller_account_id ?? "").trim(),
					msku,
					initialMsku: msku,
					referenceImage: p.reference_image ?? "",
					requirements: reqStr(p),
					remarkDoc: parseRemarkDocFromApi(p.remark_doc),
					copies: resolvedType === "主图" ? [{}] : Array.isArray(p.copies) && p.copies.length ? p.copies : [{}]
				};
			})
		);
		detail.factoryLinks = data.factoryLinks ?? [];
		detail.variants = (data.variants ?? []).map((v: any) => ({
			...v,
			imageUrl: v.imageUrl ? product_main_image_display_url(v.imageUrl) : v.imageUrl
		}));
		detail.purchases = data.purchases ?? [];
		detail.sellers = data.sellers ?? [];
		detail.mskus = data.mskus ?? [];
		// 根据当前任务状态和接口返回的 reviewed/photographed/design_done 恢复勾选状态
		completedMap.value = {};
		pictures.forEach((p: any) => {
			let done = false;
			if (code >= 100 && code < 200) done = !!(p.reviewed === 1 || p.reviewed === true);
			else if (code >= 200 && code < 300)
				done = !!(p.photographed === 1 || p.photographed === true);
			else if (code >= 300 && code < 400)
				done = !!(p.design_done === 1 || p.design_done === true);
			if (done) completedMap.value[p.label] = true;
		});
		const tid = Number(id);
		if (!Number.isNaN(tid)) {
			reconcileAllCaptionUids(tid);
			loadCaptionAppliedState(tid);
			loadCaptionColumnAppliedState(tid);
			loadCaptionAutoTranslateState(tid);
		}
	} finally {
		detailLoading.value = false;
		if (props.modelValue) {
			void nextTick()
				.then(() => {
					refreshRequirementTableHeight();
					return nextTick();
				})
				.then(() => {
					refreshRequirementTableHeight();
				});
		}
	}
}

watch(
	() => [props.modelValue, props.taskId] as const,
	([visible, id]) => {
		if (visible && id != null && id !== "") {
			loadDetail(id);
		}
	},
	{ immediate: true }
);

watch(
	() => props.modelValue,
	async (visible) => {
		if (!visible) return;
		isFullscreen.value = true;
		await nextTick();
		refreshRequirementTableHeight();
		await nextTick();
		refreshRequirementTableHeight();
	}
);

watch(isFullscreen, async () => {
	await nextTick();
	refreshRequirementTableHeight();
});

onMounted(() => {
	refreshRequirementTableHeight();
	window.addEventListener("resize", refreshRequirementTableHeight);
});

onUnmounted(() => {
	window.removeEventListener("resize", refreshRequirementTableHeight);
});

function statusTagType(status: string) {
	if (status.includes("待")) return "warning";
	if (status.includes("中")) return "primary";
	if (status.includes("完成")) return "success";
	return "info";
}

function openProductPage() {
	if (!detail.asin || !detail.marketplace) return;
	const cleanAsin = String(detail.asin).replace(/[^A-Z0-9]/g, "");
	if (!cleanAsin) return;
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, detail.marketplace);
	window.open(dpUrl);
}

function handleAddGroup() {
	ElMessage.info("已触发新增图片组（仅示意）");
}

function getSpanMethod({ row, column }: any) {
	if (column?.type === "selection") {
		return { rowspan: 1, colspan: 1 };
	}
	const label = column?.label as string | undefined;
	// 合并：编号（含分项完成/删图位）、挂载、参考图、图需、补充说明；文案区按行不合并
	if (label && PICTURE_SLOT_COLUMN_LABELS.has(label)) {
		if (row.isFirstRow) {
			return {
				rowspan: row.copiesCount,
				colspan: 1
			};
		} else {
			return {
				rowspan: 0,
				colspan: 0
			};
		}
	}
	return {
		rowspan: 1,
		colspan: 1
	};
}

async function handleCompletedChange(id: string) {
	const pic = detail.pictures.find((p: any) => p.label === id);
	// 后端接口：/admin/design_task/markStepDone
	// TS 类型里还没生成 markStepDone，走 any 避免报错
	if (!pic || !(service as any).app?.design_task?.markStepDone) return;
	const done = !!completedMap.value[id];
	const flushed = await flushEditModeBeforeLeave(false);
	if (!flushed) {
		completedMap.value[id] = !done;
		return;
	}
	const pictureId = pic.id as number | undefined;
	if (!pictureId) return;

	(service as any).app.design_task
		.markStepDone({ pictureId, done })
		.then((res: any) => {
			const data = res?.data ?? res;
			const total = Number(data.step_total ?? 0);
			const stepDone = Number(data.step_done ?? 0);
			const taskIdNum = props.taskId != null ? Number(props.taskId) : NaN;
			if (!Number.isNaN(taskIdNum)) {
				emit("stepProgressChange", {
					taskId: taskIdNum,
					stepDone,
					stepTotal: total
				});
			}
		})
		.catch((err: any) => {
			console.error(err);
			ElMessage.error("更新分项状态失败");
			// 回滚勾选
			completedMap.value[id] = !done;
		});
}

async function handleMarkAllCompleted() {
	const taskIdNum = props.taskId != null ? Number(props.taskId) : NaN;
	if (Number.isNaN(taskIdNum)) {
		ElMessage.warning("任务信息无效");
		return;
	}
	const designTaskService = (service as any).app?.design_task;
	if (!designTaskService?.request) {
		ElMessage.warning("接口不可用");
		return;
	}
	const flushed = await flushEditModeBeforeLeave();
	if (!flushed) return;
	try {
		const res = await designTaskService.request({
			url: "/markAllStepDone",
			method: "POST",
			data: { taskId: taskIdNum, done: true }
		});
		const data = res?.data ?? res;
		const stepTotal = Number(data.step_total ?? 0);
		const stepDone = Number(data.step_done ?? 0);
		detail.pictures.forEach((p: any) => {
			completedMap.value[p.label] = true;
		});
		emit("stepProgressChange", {
			taskId: taskIdNum,
			stepDone,
			stepTotal
		});
		ElMessage.success("已标记所有图需为已完成");
	} catch (e) {
		console.error(e);
		ElMessage.error("批量标记失败");
	}
}

function buildFullRequirementUpdates(): any[] {
	return detail.pictures
		.filter((pic: any) => pic.id != null)
		.map((pic: any) => {
			const isMain = pic.type === "主图";
			const copies =
				!isMain && pic.copies && Array.isArray(pic.copies) ? pic.copies : [{}];
			const captions = isMain ? [] : copies.map((c: any) => captionSnapshotFields(c));
			return {
				pictureId: pic.id,
				requirements: pic.requirements || "",
				reference_image: pic.referenceImage ?? pic.reference_image ?? "",
				remark_doc: remarkDocToSavePayload(pic.remarkDoc ?? emptyDetailRemarkDoc()),
				msku: isMain ? (pic.msku || "").trim() || null : null,
				variant_id: isMain ? undefined : (pic.variantId || "").trim() || null,
				seller_account_id: isMain ? undefined : (pic.sellerAccountId || "").trim() || null,
				captions
			};
		});
}

/** 当前内存中的图需 + 多文案 → batchUpdateRequirements（退出编辑态时全量覆盖，保证纯排序变更也落库） */
async function saveBatchUpdateRequirements(): Promise<void> {
	const updates = buildFullRequirementUpdates();
	if (updates.length === 0) return;
	await (service as any).app.design_task.request({
		url: "/batchUpdateRequirements",
		method: "POST",
		data: { updates }
	});
}

/**
 * 若在「修改图需」编辑态，先落库再退出编辑态。
 * @param successMessage 保存成功后的提示；传 false 则不提示（关闭/分项勾选等场景）
 */
async function flushEditModeBeforeLeave(successMessage?: string | false): Promise<boolean> {
	if (!isEditMode.value) return true;
	try {
		await saveBatchUpdateRequirements();
		clearEditHistory();
		exitBatchRewriteMode();
		isEditMode.value = false;
		const tid = props.taskId;
		if (tid != null && tid !== "") await loadDetail(tid);
		if (typeof successMessage === "string" && successMessage) {
			ElMessage.success(successMessage);
		}
		return true;
	} catch (error) {
		console.error("保存失败:", error);
		ElMessage.error("保存失败，请重试");
		return false;
	}
}

async function toggleEditMode() {
	if (isEditMode.value) {
		const ok = await flushEditModeBeforeLeave("图需和文案已保存");
		if (!ok) return;
	} else {
		clearEditHistory();
		exitBatchRewriteMode();
		isEditMode.value = true;
	}
}

watch(isEditMode, (v) => {
	if (!v) exitBatchRewriteMode();
});

function updateRequirements(row: any) {
	// 更新原始数据中的图需
	const picture = detail.pictures.find((p: any) => p.label === row.requirementId);
	if (picture) {
		picture.requirements = row.requirements;
	}
}

function editableEventText(event: Event): string {
	const el = event.currentTarget as HTMLElement | null;
	const text = el?.innerText ?? "";
	// contenteditable 的块级元素在部分浏览器会多带一个末尾换行。
	return text.replace(/\n$/, "");
}

function onEditableCellPaste(event: ClipboardEvent) {
	event.preventDefault();
	const text = event.clipboardData?.getData("text/plain") ?? "";
	document.execCommand("insertText", false, text);
}

function onEditableCellBlur(row: any, field: EditFocusField, event: Event) {
	const value = editableEventText(event);
	if (field === "requirements") {
		row.requirements = value;
		updateRequirements(row);
		return;
	}
	if (field === "remarkDoc.text") {
		if (!row.remarkDoc) row.remarkDoc = { text: "", images: [] };
		row.remarkDoc.text = value;
		return;
	}
	if (field.startsWith("copy.")) {
		if (!row.copy) row.copy = {};
		const key = field.slice("copy.".length);
		row.copy[key] = value;
	}
}

/** 在指定文案行下方插入一条（与「+ 加在下方」按钮对齐，避免只在首行点却加到末尾的错位感） */
function handleAddCaptionRow(requirementId: string, afterCopyIndex: number) {
	const pic = detail.pictures.find((p: any) => p.label === requirementId);
	if (!pic?.id || pic.type === "主图") return;
	let after = Math.floor(Number(afterCopyIndex));
	if (!Number.isFinite(after) || after < 0) after = 0;
	recordImmediateEdit({
		requirementId,
		copyIndex: after + 1,
		field: "captionActions"
	});
	const taskId = Number(props.taskId);
	if (Number.isNaN(taskId)) return;
	if (!Array.isArray(pic.copies) || pic.copies.length === 0) {
		pic.copies = [{}];
	}
	if (after >= pic.copies.length) after = pic.copies.length - 1;
	const insertAt = after + 1;

	const map = readCaptionUidMap(taskId);
	let uids = map[pic.id as number] || [];
	if (uids.length > pic.copies.length) uids = uids.slice(0, pic.copies.length);
	while (uids.length < pic.copies.length) uids.push(genCaptionUid());

	const newUid = genCaptionUid();
	const newCopy: Record<string, any> = {
		raw_text: "",
		raw_after_rephrase: "",
		role: "",
		zh: "",
		uk: "",
		de: "",
		fr: "",
		it: "",
		es: "",
		captionUid: newUid
	};
	pic.copies.splice(insertAt, 0, newCopy);
	uids.splice(insertAt, 0, newUid);
	map[pic.id as number] = uids;
	writeCaptionUidMap(taskId, map);
}

function handleMoveCaptionRow(row: any, direction: -1 | 1) {
	if (isMainPictureRow(row)) return;
	const pic = detail.pictures.find((p: any) => p.label === row.requirementId);
	if (!pic?.id || !Array.isArray(pic.copies) || pic.copies.length <= 1) return;
	recordImmediateEdit(editFocusTarget(row, "captionActions"));
	const from = row.copyIndex as number;
	const to = from + direction;
	if (from < 0 || from >= pic.copies.length || to < 0 || to >= pic.copies.length) return;
	const taskId = Number(props.taskId);
	if (Number.isNaN(taskId)) return;

	const map = readCaptionUidMap(taskId);
	let uids = map[pic.id as number] || [];
	if (uids.length > pic.copies.length) uids = uids.slice(0, pic.copies.length);
	for (let i = 0; i < pic.copies.length; i++) {
		if (!uids[i] && pic.copies[i]?.captionUid) uids[i] = pic.copies[i].captionUid;
	}
	while (uids.length < pic.copies.length) uids.push(genCaptionUid());

	const [copy] = pic.copies.splice(from, 1);
	pic.copies.splice(to, 0, copy);
	const [uid] = uids.splice(from, 1);
	uids.splice(to, 0, uid);
	map[pic.id as number] = uids;
	writeCaptionUidMap(taskId, map);
	pic.copies.forEach((c: any, i: number) => {
		c.captionUid = uids[i];
	});
}

function handleDeleteCaptionRow(row: any) {
	if (isMainPictureRow(row)) return;
	const pic = detail.pictures.find((p: any) => p.label === row.requirementId);
	if (!pic?.copies?.length) return;
	if (pic.copies.length <= 1) {
		ElMessage.warning("至少保留一条文案");
		return;
	}
	recordImmediateEdit(editFocusTarget(row, "captionActions"));
	const idx = row.copyIndex as number;
	if (idx < 0 || idx >= pic.copies.length) return;
	const taskId = Number(props.taskId);
	if (Number.isNaN(taskId) || !pic.id) return;
	const removed = pic.copies[idx] as any;
	const removedUid = removed?.captionUid as string | undefined;
	pic.copies.splice(idx, 1);
	const map = readCaptionUidMap(taskId);
	let uids = map[pic.id as number] || [];
	if (idx < uids.length) uids.splice(idx, 1);
	if (uids.length > pic.copies.length) uids = uids.slice(0, pic.copies.length);
	while (uids.length < pic.copies.length) uids.push(genCaptionUid());
	map[pic.id as number] = uids;
	writeCaptionUidMap(taskId, map);
	pic.copies.forEach((c: any, i: number) => {
		c.captionUid = uids[i];
	});
	if (removedUid && captionApplied.value[removedUid]) {
		const next = { ...captionApplied.value };
		delete next[removedUid];
		captionApplied.value = next;
		persistCaptionAppliedState(taskId);
	}
}

function updateCopy(row: any) {
	if (isMainPictureRow(row)) return;
	// 更新原始数据中的文案
	const picture = detail.pictures.find((p: any) => p.label === row.requirementId);
	if (picture && picture.copies) {
		// 找到当前行在所有行中的索引
		const allRows = flattenedTableData.value.filter(
			(r) => r.requirementId === row.requirementId
		);
		const copyIndex = allRows.findIndex((r) => r === row);
		if (copyIndex >= 0 && picture.copies[copyIndex]) {
			// 直接更新对应索引的 copy
			Object.assign(picture.copies[copyIndex], row.copy);
		}
	}
}

const zhAutoTranslateKey = ref<string | null>(null);
/** 中文案 focus 时的内容，用于 blur 判断是否真有改动（无原生「变更后 blur」事件） */
const zhCaptionBlurBaseline = ref<Record<string, string>>({});

function zhCaptionEditKey(row: { requirementId?: string; copyIndex?: number }): string {
	return `${row.requirementId ?? ""}-${row.copyIndex ?? 0}`;
}

function onZhCaptionFocus(row: any) {
	if (isMainPictureRow(row)) return;
	zhCaptionBlurBaseline.value[zhCaptionEditKey(row)] = String(row.copy?.zh ?? "").trim();
}

function formatCaptionTranslateProvider(provider?: string, model?: string): string {
	if (provider === "qwen-mt") {
		return model ? `Qwen MT · ${model}` : "Qwen MT";
	}
	if (provider === "baidu-fallback") {
		return "百度翻译回退";
	}
	return "";
}

/** 按当前中文案翻译并填充已开启自动翻译开关的 UK/DE/FR/IT/ES（与失焦自动触发共用） */
async function runCaptionZhTranslate(row: any) {
	if (isMainPictureRow(row)) return;
	updateCopy(row);
	const zh = String(row.copy?.zh ?? "").trim();
	if (!zh) {
		ElMessage.warning("请先填写中文案");
		return;
	}
	if (!isEditMode.value) {
		ElMessage.warning("请先点击「修改图需」");
		return;
	}
	if (!(service as any).app?.design_task?.request) return;

	const key = zhCaptionEditKey(row);
	if (zhAutoTranslateKey.value) {
		if (zhAutoTranslateKey.value === key) {
			ElMessage.info("该行正在翻译中…");
		}
		return;
	}

	const captionUid = row.copy?.captionUid as string | undefined;
	const enabledLocales = CAPTION_AUTO_TRANSLATE_LOCALES.filter((locale) =>
		isCaptionLocaleAutoTranslateOn(captionUid, locale)
	);
	const disabledLabels = CAPTION_AUTO_TRANSLATE_LOCALES.filter(
		(locale) => !isCaptionLocaleAutoTranslateOn(captionUid, locale)
	).map((locale) => CAPTION_AUTO_TRANSLATE_LABELS[locale]);

	if (enabledLocales.length === 0) {
		if (disabledLabels.length) {
			ElMessage.warning({
				message: `${disabledLabels.join("、")} 翻译开关已关闭，未自动翻译，请自行核对`,
				duration: 5000
			});
		}
		return;
	}

	zhAutoTranslateKey.value = key;
	try {
		const res = await (service as any).app.design_task.request({
			url: "/translateFromZh",
			method: "POST",
			data: { text: zh }
		});
		const raw = res?.data ?? res;
		const payload = raw?.data !== undefined ? raw.data : raw;
		if (!payload || typeof payload !== "object") {
			ElMessage.error("翻译返回异常");
			return;
		}
		const pic = detail.pictures.find((p: any) => p.label === row.requirementId);
		if (!pic?.copies?.length) return;
		const idx = row.copyIndex as number;
		const copy = pic.copies[idx];
		if (!copy) return;
		let filledCount = 0;
		for (const locale of enabledLocales) {
			if (payload[locale] == null) continue;
			copy[locale] = String(payload[locale]);
			filledCount += 1;
		}
		if (filledCount > 0) {
			const providerHint = formatCaptionTranslateProvider(payload.provider, payload.model);
			ElMessage.success({
				message: providerHint
					? `已根据中文案自动翻译并填充多语言文案（${providerHint}）`
					: "已根据中文案自动翻译并填充多语言文案",
				duration: 3000
			});
		}
		if (disabledLabels.length) {
			ElMessage.warning({
				message: `${disabledLabels.join("、")} 翻译开关已关闭，未自动翻译，请自行核对`,
				duration: 5000
			});
		}
	} catch (e: any) {
		console.error(e);
		const msg =
			e?.response?.data?.message ?? e?.response?.data?.msg ?? e?.message ?? "自动翻译失败";
		ElMessage.error(typeof msg === "string" ? msg : "自动翻译失败");
	} finally {
		if (zhAutoTranslateKey.value === key) zhAutoTranslateKey.value = null;
	}
}

/** 文案操作列：手动触发翻译（逻辑与中文案失焦自动触发一致） */
function triggerCaptionRowTranslate(row: any) {
	void runCaptionZhTranslate(row);
}

/** 仅中文案失焦且内容相对 focus 时有变：自动翻译 */
async function onZhCaptionBlur(row: any) {
	if (isMainPictureRow(row)) return;
	const cellKey = zhCaptionEditKey(row);
	const baseline = zhCaptionBlurBaseline.value[cellKey];
	delete zhCaptionBlurBaseline.value[cellKey];

	updateCopy(row);
	const zh = String(row.copy?.zh ?? "").trim();
	if (baseline !== undefined && zh === baseline) return;
	if (!zh || !isEditMode.value) return;
	await runCaptionZhTranslate(row);
}

function handleDeletePicture(requirementId: string) {
	ElMessageBox.confirm(`确定要删除图片位 ${requirementId} 及其所有文案吗？`, "提示", {
		confirmButtonText: "确定",
		cancelButtonText: "取消",
		type: "warning"
	})
		.then(() => {
			const index = detail.pictures.findIndex((p: any) => p.label === requirementId);
			if (index === -1) return;
			recordImmediateEdit({ requirementId, field: "pictureSlot" });
			const pic = detail.pictures[index];
			const taskId = Number(props.taskId);
			if (!Number.isNaN(taskId) && pic?.id) {
				const map = readCaptionUidMap(taskId);
				const uids = map[pic.id as number] || [];
				const nextApplied = { ...captionApplied.value };
				for (const uid of uids) {
					if (uid) delete nextApplied[uid];
				}
				captionApplied.value = nextApplied;
				persistCaptionAppliedState(taskId);
				delete map[pic.id as number];
				writeCaptionUidMap(taskId, map);
			}
			delete completedMap.value[requirementId];
			detail.pictures.splice(index, 1);
			ElMessage.success(`已删除图片位 ${requirementId}`);
		})
		.catch(() => {
			// 用户取消删除
		});
}

async function handleClose() {
	const ok = await flushEditModeBeforeLeave(false);
	if (!ok) return;
	isFullscreen.value = false; // 关闭时重置全屏状态
	emit("update:modelValue", false);
	emit("closed");
}

function toggleFullscreen() {
	isFullscreen.value = !isFullscreen.value;
}

function toggleImageSlotSortMode() {
	const next: ImageSlotSortMode = imageSlotSortMode.value === "position" ? "set" : "position";
	imageSlotSortMode.value = next;
	setImageSlotSortModeBySku(detail.sku, next);
}

function handleImageSlotSortModeSwitchChange(checked: string | number | boolean) {
	imageSlotSortMode.value = checked ? "set" : "position";
	setImageSlotSortModeBySku(detail.sku, imageSlotSortMode.value);
}

function handleBackToList() {
	handleClose();
}

async function handleCompleteTask() {
	const code = statusCode.value ?? 0;
	const taskId = Number(props.taskId);
	if (!taskId || !(service as any).app?.design_task?.request) return;

	const flushed = await flushEditModeBeforeLeave(false);
	if (!flushed) return;

	try {
		if (code === 103) {
			await (service as any).app.design_task.request({
				url: "/markRequirementReviewed",
				method: "POST",
				data: { taskId }
			});
			ElMessage.success("已完成审核");
		} else if (code === 201) {
			await (service as any).app.design_task.request({
				url: "/shoot/take",
				method: "POST",
				data: { taskId }
			});
			ElMessage.success("已领取任务");
		} else if (code === 202) {
			if (!(await ensureUploadPathReady("photographer"))) return;
			await (service as any).app.design_task.request({
				url: "/shoot/complete",
				method: "POST",
				data: { taskId }
			});
			ElMessage.success("已完成拍摄");
		} else if (code === 301) {
			await (service as any).app.design_task.request({
				url: "/design/take",
				method: "POST",
				data: { taskId }
			});
			ElMessage.success("已领取任务");
		} else if (code === 302) {
			if (!(await ensureUploadPathReady("designer"))) return;
			await (service as any).app.design_task.request({
				url: "/design/complete",
				method: "POST",
				data: { taskId }
			});
			ElMessage.success("已完成做图");
		} else {
			return;
		}

		handleClose();
	} catch (e) {
		console.error(e);
		ElMessage.error("操作失败");
	}
}

function getFactoryLinkInfo(id: string): { link: string; displayText: string } | null {
	// 通过 id 在工厂链接表中查找
	const factoryLink = detail.factoryLinks.find((link) => link.id === id);
	if (!factoryLink) return null;

	// 类型映射为中文显示
	const typeMap: Record<string, string> = {
		main: "主体",
		accessory: "配件",
		packing: "包装"
	};

	const typeLabel = typeMap[factoryLink.type] || factoryLink.type;
	const displayText = `${typeLabel}: ${factoryLink.name}`;

	return {
		link: factoryLink.link,
		displayText
	};
}

function getSubmitters(variantId: string): string[] {
	// 根据 variantId 从 purchases 中查找所有相关的提交人
	const relatedPurchases = detail.purchases.filter(
		(purchase) => purchase.variantId === variantId && purchase.submitter
	);

	// 去重并返回提交人列表
	const submitters = new Set(relatedPurchases.map((p) => p.submitter));
	return Array.from(submitters);
}

function getVariantName(variantId: string | undefined): string {
	// 根据 variantId 查找变体名称
	if (!variantId) return "";
	const variant = detail.variants.find((v) => v.variantsid === variantId);
	return variant?.name || "";
}

function getSellerName(sellerId: string | undefined): string {
	if (!sellerId) return "";
	const seller = detail.sellers.find(
		(s: any) => s.seller_account_id === sellerId || s.seller_id === sellerId
	);
	return seller?.name ?? seller?.account_name ?? sellerId;
}

/** 选品全部采购 uk/de 汇总（与图需列表页一致） */
const candidateTotalLangStatus = computed(() => pictureMountLangStatus(detail.purchases, {}));

function pictureMountLangStatusFor(picture: {
	type?: string;
	msku?: string;
	variantId?: string;
	sellerAccountId?: string;
	shop?: string;
}) {
	return pictureMountLangStatus(detail.purchases, {
		isMainPicture: picture?.type === "主图",
		msku: picture?.msku,
		variantId: picture?.variantId,
		sellerAccountId: picture?.sellerAccountId ?? picture?.shop
	});
}

function getMskuLabelDetail(msku: string | undefined): string {
	return getMskuDisplayLabel(detail.mskus, msku);
}

function resetAddPictureSlotForm() {
	addSlotLabel.value = "";
	addSlotType.value = "场景图";
	addSlotMsku.value = "";
	addSlotVariantId.value = "";
	addSlotSellerAccountId.value = "";
}

function onAddSlotLabelInput() {
	if (isSlotLabelMinus1(addSlotLabel.value.trim())) {
		addSlotType.value = "主图";
		addSlotVariantId.value = "";
		addSlotSellerAccountId.value = "";
	}
}

function onAddSlotTypeChange() {
	if (addSlotType.value === "主图") {
		addSlotVariantId.value = "";
		addSlotSellerAccountId.value = "";
	} else {
		addSlotMsku.value = "";
	}
}

function openAddPictureSlotDialog() {
	resetAddPictureSlotForm();
	addSlotDialogVisible.value = true;
}

function scrollDetailToPictureLabel(label: string) {
	nextTick(() => {
		const rows = flattenedTableData.value;
		const idx = rows.findIndex((r) => r.isFirstRow && r.picture?.label === label);
		if (idx < 0) return;
		const root = detailTableRef.value?.$el;
		const wrap =
			root?.querySelector?.(".el-table__body-wrapper .el-scrollbar__wrap") ??
			root?.querySelector?.(".el-table__body-wrapper");
		if (!wrap) return;
		const trs = wrap.querySelectorAll("tbody tr");
		const el = trs[idx] as HTMLElement | undefined;
		el?.scrollIntoView({ block: "center", behavior: "smooth" });
	});
}

async function submitAddPictureSlot() {
	const taskId = Number(props.taskId);
	if (Number.isNaN(taskId)) {
		ElMessage.warning("任务无效");
		return;
	}
	const label = addSlotLabel.value.trim();
	if (!label) {
		ElMessage.warning("请填写编号");
		return;
	}
	if (!/^\d+-\d+$/.test(label)) {
		ElMessage.warning("编号格式须为如 4-1");
		return;
	}
	if (detail.pictures.some((p: any) => p.label === label)) {
		ElMessage.warning(`编号 ${label} 已存在`);
		return;
	}

	const effType = addSlotEffectiveType.value;
	const payload: Record<string, unknown> = {
		taskId,
		label,
		type: effType
	};
	if (effType === "主图") {
		const msku = addSlotMsku.value.trim();
		if (!msku) {
			ElMessage.warning("主图请选择 MSKU");
			return;
		}
		if (!detail.mskus.some((m: any) => m.msku === msku)) {
			ElMessage.warning("请选择该选品下已有的 MSKU");
			return;
		}
		payload.msku = msku;
	} else {
		payload.variant_id = addSlotVariantId.value.trim() || undefined;
		payload.seller_account_id = addSlotSellerAccountId.value.trim() || undefined;
	}

	addSlotSubmitting.value = true;
	try {
		const res = await (service as any).app.design_task.request({
			url: "/createPictureSlot",
			method: "POST",
			data: payload
		});
		const raw = res?.data ?? res;
		const data = raw?.data !== undefined ? raw.data : raw;
		if (!data?.pictureId) {
			ElMessage.error("创建失败");
			return;
		}

		const rawType = (data.type || "").trim();
		const uiType = isSlotLabelMinus1(data.label)
			? "主图"
			: rawType === "主图"
				? "场景图"
				: rawType;
		const msku = (data.msku ?? "").trim();
		recordImmediateEdit({ requirementId: data.label, field: "pictureSlot" });
		const pic: Record<string, any> = {
			id: Number(data.pictureId),
			label: data.label,
			type: uiType,
			variantId: (data.variant_id ?? "").trim(),
			variantName: "",
			sellerAccountId: (data.seller_account_id ?? "").trim(),
			shop: data.seller_account_id ?? "",
			msku,
			initialMsku: msku,
			referenceImage: data.reference_image ?? "",
			requirements: "",
			remarkDoc: emptyDetailRemarkDoc(),
			copies: [{}]
		};
		detail.pictures.push(pic);
		detail.pictures.sort((a: any, b: any) =>
			sortImageSlots({ label: a.label }, { label: b.label }, imageSlotSortMode.value)
		);
		const tid = Number(props.taskId);
		if (!Number.isNaN(tid)) reconcileAllCaptionUids(tid);
		addSlotDialogVisible.value = false;
		ElMessage.success("已新增图片位");
		scrollDetailToPictureLabel(label);
	} catch (e: any) {
		console.error(e);
		const msg =
			e?.response?.data?.message ?? e?.response?.data?.msg ?? e?.message ?? "创建失败";
		ElMessage.error(typeof msg === "string" ? msg : "创建失败");
	} finally {
		addSlotSubmitting.value = false;
	}
}

function handleVariantClick(variantId: string | undefined) {
	if (!variantId) return;
	const variant = detail.variants.find((v) => v.variantsid === variantId);
	if (variant) {
		currentVariant.value = variant;
		variantDialogVisible.value = true;
	}
}
</script>

<style scoped lang="scss">
.design-task-detail {
	padding: 20px;
	background: #fff;
	min-height: 100%;
	box-sizing: border-box;
}

.basic-card {
	border-radius: 6px;
	margin-bottom: 16px;
}

.basic-info-wrapper {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 20px;
}

.basic-form {
	flex: 1;
	.el-form-item {
		margin-bottom: 12px;
	}
}

.text-value {
	color: #303133;
	font-size: 14px;
}

.open-product-btn {
	margin-left: 8px;
}

.main-image-wrapper {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 8px;
	flex-shrink: 0;
}

.upload-path-row {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	:deep(.el-input) {
		flex: 1;
		min-width: 0;
	}
}

.actions {
	margin: 12px 0;
}

.detail-table {
	margin-top: 18px;
}

.tag-cell {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 6px;
}

.tag-item {
	margin: 0;
}

.copy-cell {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.copy-item {
	line-height: 1.5;
}

.clickable-tag {
	cursor: pointer;
	transition: all 0.2s;
}

.clickable-tag:hover {
	opacity: 0.8;
	transform: scale(1.05);
}

.detail-table :deep(.cell) {
	white-space: pre-line;
}

.editable-grid-cell {
	width: 100%;
	min-height: 32px;
	padding: 6px 8px;
	border: 1px solid transparent;
	border-radius: 4px;
	background: transparent;
	color: var(--el-text-color-primary);
	line-height: 1.45;
	white-space: pre-wrap;
	word-break: break-word;
	overflow: visible;
	cursor: text;
	outline: none;
	transition:
		border-color 0.15s,
		background-color 0.15s,
		box-shadow 0.15s;
}

.editable-grid-cell:hover {
	background: var(--el-fill-color-lighter);
	border-color: var(--el-border-color);
}

.editable-grid-cell:focus {
	background: #fff;
	border-color: var(--el-color-primary);
	box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}

.editable-grid-cell:empty::before {
	content: attr(data-placeholder);
	color: var(--el-text-color-placeholder);
}

.editable-grid-cell--large {
	min-height: 72px;
}

.editable-grid-cell--remark {
	min-height: 48px;
}

/* 分项完成（图位列）与 已采用（文案列）共用浅色底 */
.detail-table :deep(td.caption-cell-adopted) {
	background-color: #f4faf0 !important;
}

.detail-table :deep(td.caption-cell-adopted-strong) {
	background-color: #e3f4d7 !important;
}

.detail-table.is-batch-rewrite-mode :deep(.el-table__body tr.el-table__row.selected > td),
.detail-table.is-batch-rewrite-mode :deep(tr.batch-rewrite-row-selected > td) {
	background-color: #ecf5ff !important;
}

.detail-table.is-batch-rewrite-mode :deep(tr.batch-rewrite-row-selected > td.caption-cell-adopted),
.detail-table.is-batch-rewrite-mode :deep(tr.batch-rewrite-row-selected > td.caption-cell-adopted-strong) {
	background-color: #e0eef9 !important;
	box-shadow: inset 3px 0 0 var(--el-color-primary);
}

.caption-actions-cell {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;

	:deep(.el-button + .el-button) {
		margin-left: 0;
	}
}

.caption-applied-check {
	margin-right: 0;
	:deep(.el-checkbox__label) {
		padding-left: 6px;
		font-size: 12px;
	}
}

.caption-role-select {
	width: 100%;
	:deep(.el-input__wrapper) {
		padding-left: 6px;
		padding-right: 6px;
	}
}

.reference-image-cell {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
}

.reference-image-edit-actions {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 4px;
}

.reference-image {
	width: 60px;
	height: 60px;
	border-radius: 4px;
}

.reference-image-placeholder {
	width: 60px;
	height: 60px;
	border-radius: 4px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-secondary);
	font-size: 13px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.extra-info {
	margin-top: 24px;
	font-size: 13px;
	color: #606266;
}

.extra-title {
	font-weight: 600;
	color: #303133;
	margin-bottom: 6px;
}

.other-info-collapse {
	margin-top: 24px;
}

.requirement-section {
	margin-top: 24px;
}

/* 滚动在 el-table 内部；wrapper 不裁切，避免部分环境下滚动条被 overflow:hidden 吃掉 */
.requirement-table-wrapper {
	overflow: visible;
	margin-top: 0;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 4px;

	.requirement-table-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 8px 12px;
		padding: 8px 12px;
		background: var(--el-fill-color-lighter);
		border-bottom: 1px solid var(--el-border-color-lighter);
		border-radius: 4px 4px 0 0;
	}

	.requirement-table-toolbar-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		margin-left: auto;
	}

	:deep(.detail-table-below-toolbar) {
		border-top: none;
		border-radius: 0 0 4px 4px;
	}

	/* 让图需表底部横向滚动条更粗、更明显 */
	:deep(.el-scrollbar__bar.is-horizontal) {
		height: 12px;
	}

	:deep(.el-scrollbar__bar.is-horizontal .el-scrollbar__thumb) {
		background-color: #8d95a3;
		border-radius: 999px;
		opacity: 0.95;
	}

	:deep(.el-scrollbar__bar.is-horizontal:hover .el-scrollbar__thumb) {
		background-color: #6b7380;
	}
}

.requirement-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8px;
}

.requirement-header-left {
	display: flex;
	align-items: center;
	gap: 12px;
	flex-wrap: wrap;
}

.requirement-title-lang {
	margin-top: 0;
	padding-top: 0;
	border-top: none;
}

.requirement-header-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}

.caption-quick-tip {
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.sort-mode-switch {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.sort-mode-switch > span.active {
	color: var(--el-color-primary);
	font-weight: 600;
}

.caption-col-header {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
}

.caption-col-toggle {
	border: 0;
	background: transparent;
	cursor: pointer;
	font-size: 12px;
	color: var(--el-text-color-regular);
	padding: 0;
	line-height: 1.2;
}

.caption-col-toggle.is-active {
	color: #409eff;
	font-weight: 600;
}

.caption-col-toggle:hover {
	color: #409eff;
}

.caption-col-toggle:focus-visible {
	outline: 1px solid #409eff;
	outline-offset: 2px;
	border-radius: 3px;
}

.caption-locale-cell {
	position: relative;
}

.caption-locale-cell .editable-grid-cell {
	padding-right: 16px;
	padding-bottom: 14px;
}

.caption-auto-translate-check {
	position: absolute;
	right: 2px;
	bottom: 2px;
	z-index: 1;
	width: 14px;
	height: 14px;
	padding: 0;
	margin: 0;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 2px;
	background: var(--el-fill-color-blank);
	font-size: 11px;
	line-height: 12px;
	font-weight: 600;
	color: transparent;
	cursor: pointer;
}

.caption-auto-translate-check.is-on {
	color: var(--el-color-success);
	border-color: var(--el-color-success);
	background: var(--el-color-success-light-9);
}

.caption-auto-translate-check:hover {
	border-color: var(--el-color-success);
}

.caption-auto-translate-check:focus-visible {
	outline: 1px solid var(--el-color-success);
	outline-offset: 1px;
}

.factory-links-section,
.variant-section,
.purchase-section {
	margin-top: 32px;
}

.other-info-collapse .factory-links-section {
	margin-top: 24px;
}

.other-info-collapse .purchase-section {
	margin-top: 24px;
}

.section-title {
	font-size: 16px;
	font-weight: 600;
	color: #303133;
	margin-bottom: 12px;
}

.variant-image {
	width: 72px;
	height: 72px;
	border-radius: 4px;
}

.no-image-text {
	color: #909399;
	font-size: 13px;
}

.total-purchase {
	margin-top: 12px;
	text-align: right;
	padding-right: 12px;
}

.factory-link {
	color: #409eff;
	text-decoration: none;
	cursor: pointer;
	word-break: break-all;
}

.factory-link:hover {
	color: #66b1ff;
	text-decoration: underline;
}

.factory-link-groups {
	display: flex;
	flex-direction: column;
	gap: 4px;
	text-align: left;
}

.factory-link-group-item {
	line-height: 1.5;
}

.factory-link-group-link {
	color: #409eff;
	text-decoration: none;
	cursor: pointer;
}

.factory-link-group-link:hover {
	color: #66b1ff;
	text-decoration: underline;
}

.submitters {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	justify-content: center;
}

.submitter-tag {
	margin: 0;
}

.no-submitter {
	color: #909399;
	font-size: 13px;
}

.variant-dialog-content {
	padding: 10px 0;
}

.variant-dialog-image {
	width: 200px;
	height: 200px;
	border-radius: 6px;
}

.dialog-footer {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
}

.dialog-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	width: 100%;
}

.dialog-title {
	font-size: 18px;
	font-weight: 600;
}

.dialog-header-actions {
	display: flex;
	align-items: center;
	gap: 8px;

	.el-button {
		padding: 0 !important;
		width: 32px !important;
		height: 32px !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		border: none !important;

		.el-icon {
			font-size: 16px;
			line-height: 1;
		}
	}
}

.design-task-detail-dialog {
	:deep(.el-dialog) {
		display: flex !important;
		flex-direction: column !important;
		height: 90vh !important;
		max-height: 90vh !important;
		margin-top: 5vh !important;
		margin-bottom: 5vh !important;
		position: relative !important;
		transition: all 0.3s ease;
	}

	&.is-fullscreen {
		:deep(.el-dialog) {
			width: 100% !important;
			height: 100vh !important;
			max-height: 100vh !important;
			margin: 0 !important;
			border-radius: 0 !important;
		}
	}

	:deep(.el-dialog__header) {
		flex-shrink: 0 !important;
		padding: 20px 20px 10px !important;
		border-bottom: 1px solid #ebeef5;
		position: relative !important;
		display: flex !important;
		align-items: center !important;
	}

	:deep(.el-dialog__body) {
		flex: 1 1 auto !important;
		overflow-y: auto !important;
		overflow-x: hidden !important;
		padding: 20px !important;
		min-height: 0 !important;
		max-height: none !important;
		position: relative !important;
	}

	:deep(.el-dialog__footer) {
		flex-shrink: 0 !important;
		padding: 15px 20px !important;
		border-top: 1px solid #ebeef5;
		margin-top: 0 !important;
		position: relative !important;
	}
}

.picture-id-cell {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 6px;
	text-align: left;
}

.add-slot-type-select,
.add-slot-mount-select {
	width: 100%;
}

.add-slot-hint {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	margin-top: 4px;
	line-height: 1.4;
}

.picture-id-read-label {
	font-weight: 600;
	color: #303133;
}

.picture-id-read-tag {
	margin-top: 2px;
}

.picture-id-actions {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 4px;
	margin-top: 4px;

	:deep(.el-checkbox) {
		height: auto;
	}

	:deep(.el-checkbox__label) {
		font-size: 12px;
		padding-left: 4px;
	}

	:deep(.el-button + .el-button) {
		margin-left: 0;
	}
}

.picture-mount-cell {
	font-size: 13px;
	text-align: left;
}

.mount-select-full {
	width: 100%;
	max-width: 152px;
}

.mount-select-second {
	margin-top: 8px;
}

.mount-hint {
	font-size: 11px;
	color: #909399;
	margin-top: 6px;
}

.mount-readonly-msku {
	font-size: 12px;
	color: #606266;
	line-height: 1.4;
	word-break: break-all;
	max-width: 152px;
}

.mount-read-line {
	display: flex;
	align-items: center;
	gap: 4px;
	margin-bottom: 6px;
	flex-wrap: wrap;
}

.mount-read-line:last-child {
	margin-bottom: 0;
}

.mount-k {
	flex: 0 0 28px;
	color: #909399;
	font-size: 12px;
}

.mount-v {
	color: #303133;
	font-size: 13px;
}

.detail-remark-file-hidden {
	display: none;
}

.detail-remark-edit {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.detail-remark-images {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	align-items: center;
}

.detail-remark-thumb-wrap {
	position: relative;
	width: 48px;
	height: 48px;
	border-radius: 4px;
	overflow: hidden;
	border: 1px solid #ebeef5;
}

.detail-remark-thumb {
	width: 48px;
	height: 48px;
}

.detail-remark-thumb-del {
	position: absolute;
	top: 0;
	right: 0;
	cursor: pointer;
	color: #f56c6c;
	background: rgba(255, 255, 255, 0.9);
	font-size: 16px;
}

.detail-remark-read {
	font-size: 13px;
	color: #f56c6c;
	font-weight: 600;
	line-height: 1.5;
}

.detail-remark-text {
	margin-bottom: 6px;
	white-space: pre-wrap;
	word-break: break-word;
}

.detail-remark-images-read {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

.detail-remark-thumb-read {
	width: 56px;
	height: 56px;
	border-radius: 4px;
	border: 1px solid #ebeef5;
}

</style>

<style lang="scss">
// 全局样式确保对话框固定高度（不使用 scoped）
.design-task-detail-dialog.el-dialog__wrapper {
	.el-dialog {
		display: flex !important;
		flex-direction: column !important;
		height: 90vh !important;
		max-height: 90vh !important;
		margin-top: 5vh !important;
		margin-bottom: 5vh !important;
	}

	.el-dialog__body {
		flex: 1 1 auto !important;
		overflow-y: auto !important;
		overflow-x: hidden !important;
		min-height: 0 !important;
		max-height: none !important;
	}

	.el-dialog__footer {
		flex-shrink: 0 !important;
		margin-top: 0 !important;
	}
}
</style>
