<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />

			<!-- <cl-multi-delete-btn /> -->

			<cl-add-btn />
			<cl-import-btn
				template="/待处理数据导入模板.xlsx"
				tips="ASIN、国家、数据来源、产品名称为必填项"
				:on-submit="onSubmit4"
			/>
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

			<!-- 隐藏阿里云图片对比按钮，作为自动流程一部分 -->
			<!-- <el-button @click="triggerSimilarityProcessing()" type="success">
				阿里云图片对比
			</el-button> -->

			<el-space direction="horizontal">
				<el-text>仅展示待处理数据</el-text>
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

			<!-- 新增导出按钮 -->
			<!-- <el-button type="primary" @click="handleExport"> 1、八爪鱼获取竞品 </el-button> -->

			<!-- 2026-04-03 切换为直接传八爪鱼，不再需要手动导入excel -->
			<!-- <cl-import-btn tips="" :on-submit="onSubmit" type="primary" /> -->

			<!-- <el-button
				type="primary"
				@click="handleExport4"
				:loading="exporting4"
				:class="{ 'exporting-button': exporting4 }"
			>
				{{ exporting4 ? "数据获取中..." : "2、获取推荐位数据" }}
			</el-button> -->

			<!-- <el-button
				type="primary"
				@click="handleExport5"
				:loading="exporting5"
				:class="{ 'exporting-button': exporting5 }"
			>
				{{ exporting5 ? "数据获取中..." : "3、获取搜索页数据" }}
			</el-button> -->

			<!-- <el-button type="primary" @click="handleFetchKeywordsForSelection">
				4、获取关键词数据
			</el-button> -->

			<!-- <el-button type="warning" @click="handleExport2">
        导出竞品详情所需
      </el-button>
      <cl-import-btn tips="" :on-submit="onSubmit2" type="warning" />-->
			<!-- 竞品详情按钮已隐藏，作为自动流程一部分 -->
			<!--
			<el-button
				type="warning"
				@click="getCompetitor"
				:disabled="isCompetitorTaskRunning"
				:loading="isCompetitorTaskRunning"
				style="margin-right: 10px"
			>
				<template v-if="isCompetitorTaskRunning">
					<el-icon><loading /></el-icon> 获取中... {{ competitorTaskProgress }}
				</template>
				<template v-else-if="lastCompetitorTaskStatus === 'Finished'">
					<el-icon><Check /></el-icon> 获取(已完成) {{ competitorTaskProgress }}
				</template>
				<template v-else-if="lastCompetitorTaskStatus === 'Failed'">
					<el-icon><Warning /></el-icon> 获取(失败) {{ competitorTaskProgress }}
				</template>
				<template v-else> 获取竞品详情 {{ competitorTaskProgress }} </template>
			</el-button>
			-->

			<!-- 刷新任务状态按钮已隐藏，作为自动流程一部分 -->
			<!--
			<el-button @click="fetchTaskStatus()" type="primary">
				<el-icon><Refresh /></el-icon> 刷新任务状态
			</el-button>
			-->

			<!-- <el-button type="success" @click="handleExport3">
        导出关键词所需
      </el-button>
      <cl-import-btn tips="" :on-submit="onSubmit3" :template="importTemplate" type="success" /> -->

			<el-button type="primary" @click="handleBatchUpdateStatus"> 更新状态汇总 </el-button>
			<el-button type="warning" @click="updateStockQuantity"> 更新库存数据 </el-button>

			<!-- <el-button type="primary" @click="setInventoryStatus">
				勾选选品设置竞品为待获取库存
			</el-button> -->

			<el-select
				v-model="filterStatus.competitor_import"
				placeholder="竞品已导入"
				style="margin-right: 10px; width: 130px"
			>
				<el-option label="未选择" value="" />
				<el-option label="已导入" value="1" />
				<el-option label="未导入" value="0" />
			</el-select>

			<el-select
				v-model="filterStatus.UKDEStatus"
				placeholder="英德已导入"
				style="margin-right: 10px; width: 130px"
			>
				<el-option label="未选择" value="" />
				<el-option label="已导入" value="1" />
				<el-option label="未导入" value="0" />
			</el-select>

			<!-- 利润计算状态 -->
			<el-select
				v-model="filterStatus.profit_calculation"
				placeholder="利润已计算"
				style="margin-right: 10px; width: 130px"
			>
				<el-option label="未选择" value="" />
				<el-option label="已计算" value="1" />
				<el-option label="未计算" value="0" />
			</el-select>

			<!-- 竞品全拥有状态 -->
			<el-select
				v-model="filterStatus.competitor_full"
				placeholder="竞品全拥有"
				style="margin-right: 10px; width: 130px"
			>
				<el-option label="未选择" value="" />
				<el-option label="已拥有" value="1" />
				<el-option label="未拥有" value="0" />
			</el-select>

			<!-- 关键词导入状态 -->
			<el-select
				v-model="filterStatus.keyword_import"
				placeholder="关键词导入"
				style="margin-right: 10px; width: 130px"
			>
				<el-option label="未选择" value="" />
				<el-option label="已导入" value="1" />
				<el-option label="未导入" value="0" />
			</el-select>

			<!-- 流程状态 -->
			<el-select
				v-model="filterStatus.competitor_status"
				placeholder="流程状态"
				style="margin-right: 10px; width: 150px"
			>
				<el-option label="全部" value="" />
				<el-option label="0-八爪鱼抓取中" :value="0" />
				<el-option label="1-八爪鱼抓取完成" :value="1" />
				<el-option label="2-识图中" :value="2" />
				<el-option label="3-识图完成" :value="3" />
				<el-option label="3-1识图回跳" :value="31" />
				<el-option label="3-2回跳缺少竞品" :value="32" />
				<el-option label="4-部分详情拉取中" :value="4" />
				<el-option label="5-部分详情已获取/失败" :value="5" />
				<el-option label="6-部分标题评分比对中" :value="6" />
				<el-option label="7-部分标题评分比对已完成" :value="7" />
				<el-option label="8-获取推荐位中" :value="8" />
				<el-option label="9-推荐位获取完成" :value="9" />
				<el-option label="10-获取搜索页中" :value="10" />
				<el-option label="11-获取搜索页完成" :value="11" />
				<el-option label="12-再次识图中" :value="12" />
				<el-option label="13-再次识图完成" :value="13" />
				<el-option label="14-再次详情拉取中" :value="14" />
				<el-option label="15-再次详情获取失败回滚" :value="15" />
				<el-option label="16-再次标题评分比对中" :value="16" />
				<el-option label="17-再次标题评分比对完成" :value="17" />
				<el-option label="18-关键词获取中" :value="18" />
				<el-option label="19-关键词获取完成" :value="19" />
				<el-option label="20-得分计算完成" :value="20" />
			</el-select>

			<div
				style="
					margin: 0px 10;
					padding: 4px 9px;
					background: #f5f7fa;
					border-radius: 0px;
					font-size: 14px;
				"
			>
				<span style="color: #333">库存数量：</span>
				<span v-if="stockLoading" style="color: #909399; font-weight: 600; margin: 0 10px">
					加载中...
					<el-icon style="font-size: 12px; vertical-align: middle"><loading /></el-icon>
				</span>
				<!-- 加载完成显示真实数据 -->
				<span v-else style="color: #409eff; font-weight: 600; margin: 0 10px">
					{{ stockStatistics.ratio }}
				</span>
			</div>

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

				<template #slot-management-buttons="{ scope }">
					<el-button
						size="default"
						type="success"
						text
						bg
						@click="
							updateStatus(scope.row, appConfig.BSR_CANDIDATE_STATUS.RESERVED.value)
						"
					>
						精选
					</el-button>

					<el-dropdown trigger="hover" @command="(cmd) => updateCompetitorStatus(scope.row, cmd)">
						<span style="display: inline-block; margin-left: 10px;">
							<el-tooltip content="修改流程状态" placement="top" :hide-after="0">
								<el-button
									type="info"
									size="default"
									plain
									circle
								>
									<el-icon><Operation /></el-icon>
								</el-button>
							</el-tooltip>
						</span>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item :command="0" style="justify-content: flex-start;">0-八爪鱼抓取中</el-dropdown-item>
								<el-dropdown-item :command="1" style="justify-content: flex-start;">1-八爪鱼抓取完成</el-dropdown-item>
								<el-dropdown-item :command="2" style="justify-content: flex-start;">2-识图中</el-dropdown-item>
								<el-dropdown-item :command="3" style="justify-content: flex-start;">3-识图完成</el-dropdown-item>
								<el-dropdown-item :command="31" style="justify-content: flex-start;">3-1识图回跳</el-dropdown-item>
								<el-dropdown-item :command="32" style="justify-content: flex-start;">3-2回跳缺少竞品</el-dropdown-item>
								<el-dropdown-item :command="4" style="justify-content: flex-start;">4-部分详情拉取中</el-dropdown-item>
								<el-dropdown-item :command="5" style="justify-content: flex-start;">5-部分详情已获取/失败</el-dropdown-item>
								<el-dropdown-item :command="6" style="justify-content: flex-start;">6-部分标题评分比对中</el-dropdown-item>
								<el-dropdown-item :command="7" style="justify-content: flex-start;">7-部分标题评分比对已完成</el-dropdown-item>
								<el-dropdown-item :command="8" style="justify-content: flex-start;">8-获取推荐位中</el-dropdown-item>
								<el-dropdown-item :command="9" style="justify-content: flex-start;">9-推荐位获取完成</el-dropdown-item>
								<el-dropdown-item :command="10" style="justify-content: flex-start;">10-获取搜索页中</el-dropdown-item>
								<el-dropdown-item :command="11" style="justify-content: flex-start;">11-获取搜索页完成</el-dropdown-item>
								<el-dropdown-item :command="12" style="justify-content: flex-start;">12-再次识图中</el-dropdown-item>
								<el-dropdown-item :command="13" style="justify-content: flex-start;">13-再次识图完成</el-dropdown-item>
								<el-dropdown-item :command="14" style="justify-content: flex-start;">14-再次详情拉取中</el-dropdown-item>
								<el-dropdown-item :command="15" style="justify-content: flex-start;">15-再次详情获取失败回滚</el-dropdown-item>
								<el-dropdown-item :command="16" style="justify-content: flex-start;">16-再次标题评分比对中</el-dropdown-item>
								<el-dropdown-item :command="17" style="justify-content: flex-start;">17-再次标题评分比对完成</el-dropdown-item>
								<el-dropdown-item :command="18" style="justify-content: flex-start;">18-关键词获取中</el-dropdown-item>
								<el-dropdown-item :command="19" style="justify-content: flex-start;">19-关键词获取完成</el-dropdown-item>
								<el-dropdown-item :command="20" style="justify-content: flex-start;">20-得分计算完成</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>

					<el-tooltip content="编辑" placement="top" :hide-after="0">
						<el-button
							type="primary"
							size="default"
							plain
							circle
							style="margin-left: 10px;"
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
							style="margin-left: 10px;"
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
							style="margin-left: 10px;"
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

				<template #column-aliyun_img_display="{ scope }">
					<el-popover
						placement="right"
						trigger="hover"
						:width="1300"
						@show="boostProductImages(scope.row, { prefixes: ['aliyun_img'] })"
					>
						<template #reference>
							<resilient-product-image
								:src="scope.row.aliyun_img_display"
								style="width: 50px; height: 50px; cursor: pointer"
								fit="contain"
								priority="visible"
								@mouseenter="boostProductImages(scope.row, { prefixes: ['aliyun_img'] })"
							/>
						</template>
						<template #default>
							<div
								style="display: flex; overflow-x: auto; gap: 10px; padding: 10px 0"
							>
								<template v-for="i in 6" :key="i">
									<resilient-product-image
										v-if="scope.row[`aliyun_img${i === 1 ? '' : i}`]"
										:src="
											convert_image_url(
												scope.row[`aliyun_img${i === 1 ? '' : i}`]
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
											swapMainImage(
												scope.row,
												`aliyun_img${i === 1 ? '' : i}`
											)
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

			<template #slot-produce_image_url="{ scope }">
				<el-form-item label="主图链接" prop="sku">
					<el-input v-model="scope.image_url">
						<template #append>
							<el-button @click="archiveWithImage(scope.id)">上传到阿里云</el-button>
						</template>
					</el-input>
				</el-form-item>
			</template>

			<template #slot-get_product_info="{ scope }">
				<el-form-item label=" ">
					<el-button
						type="primary"
						:loading="isSubmitting"
						@click="getProductInfo(scope.id)"
						>获取详细信息</el-button
					>
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
								<div v-for="market in ['UK', 'DE']" :key="market">
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
																	?.daysInMonth || 30)
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
													v-for="market in ['UK', 'DE']"
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
import {
	PURCHASER_COUNTRY_OPTIONS,
	getAllowedCountryCodes,
	pickRandomIndexes,
	selectPurchasersByCountry
} from "/$/app/utils/bsr-candidate-purchaser-selection";
import ResilientProductImage from "/$/app/components/resilient-product-image.vue";
import { Delete, EditPen, GoodsFilled, Memo, Loading, Operation } from "@element-plus/icons-vue";
import { ref, watch, reactive, h } from "vue";
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
// 2026-02-06 Fix: Add customParseFormat plugin for parsing YYYYMMDD dates
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);
import ListingKeyword from "/$/app/components/listing-keyword.vue";
import { ElLoading, ElMessage } from "element-plus";
import pinyin from "pinyin";

const keywordManagementPaneVisible = ref(false);
const curEditingListing = ref();

const { service } = useCool();

import { useUserStore } from "/$/base/store/user";
import upsert from "/~/crud/src/components/upsert";
import { status } from "nprogress";
import { ElMessageBox } from "element-plus";

type ArchivedCandidateInfo = {
	id: number;
	asin: string;
	marketplace: string;
	produce_name?: string;
	item_name?: string;
	status: number;
};

function normalizeArchivedCheckAsin(value: any) {
	return String(value ?? "").trim().toUpperCase();
}

function normalizeArchivedCheckMarketplace(value: any) {
	return String(value ?? "").trim();
}

function archivedCandidateKey(item: any) {
	return `${normalizeArchivedCheckMarketplace(item?.marketplace)}|${normalizeArchivedCheckAsin(item?.asin)}`;
}

function unwrapArchivedCandidatesResponse(response: any): ArchivedCandidateInfo[] {
	if (Array.isArray(response)) return response;
	if (Array.isArray(response?.data)) return response.data;
	return [];
}

async function fetchArchivedCandidates(items: any[]) {
	const uniqueItems = Array.from(
		new Map(
			items
				.map((item) => ({
					asin: normalizeArchivedCheckAsin(item?.asin),
					marketplace: normalizeArchivedCheckMarketplace(item?.marketplace)
				}))
				.filter((item) => item.asin)
				.map((item) => [`${item.marketplace}|${item.asin}`, item])
		).values()
	);

	if (uniqueItems.length === 0) return [];

	const response = await (service.app.bsr_candidate as any).request({
		url: "/findArchivedCandidates",
		method: "POST",
		data: { items: uniqueItems }
	});

	return unwrapArchivedCandidatesResponse(response);
}

async function confirmRestoreArchivedCandidates(items: any[]) {
	let archivedCandidates: ArchivedCandidateInfo[] = [];
	try {
		archivedCandidates = await fetchArchivedCandidates(items);
	} catch (error) {
		console.error("检查已归档 ASIN 失败:", error);
		ElMessage.error("检查已归档 ASIN 失败，请稍后重试");
		return false;
	}

	if (archivedCandidates.length === 0) return true;

	const preview = archivedCandidates
		.slice(0, 5)
		.map((item) => `${item.asin}${item.marketplace ? `/${item.marketplace}` : ""}`)
		.join("、");
	const moreText =
		archivedCandidates.length > 5 ? ` 等 ${archivedCandidates.length} 条` : "";

	try {
		await ElMessageBox.confirm(
			`该 ASIN 已归档：${preview}${moreText}，是否进入待处理数据状态？`,
			"该 ASIN 已归档",
			{
				confirmButtonText: "是，进入待处理",
				cancelButtonText: "否",
				type: "warning"
			}
		);
	} catch {
		return false;
	}

	const archivedKeys = new Set(archivedCandidates.map(archivedCandidateKey));
	items.forEach((item) => {
		if (archivedKeys.has(archivedCandidateKey(item))) {
			item.status = 6;
			item.competitor_spider_status = item.competitor_spider_status ?? 0;
			item._restoreArchivedCandidate = true;
		}
	});

	return true;
}

const userStore = useUserStore();
const departmentId = userStore.info?.departmentId;

const filterStatus = reactive({
	competitor_import: "", // 竞品导入状态
	profit_calculation: "", // 利润计算状态
	competitor_full: "", // 竞品全拥有
	keyword_import: "", // 关键词导入
	UKDEStatus: "",
	competitor_status: "" // 流程状态
});

const Crud = useCrud(
	{
		service: service.app.bsr_candidate,
		async onRefresh(params, { next, done, render }) {
			if (showOnlyStatusLibrary.value) Object.assign(params, { status: 6 });
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
			if (filterStatus.competitor_status !== "")
				Object.assign(params, { competitor_status: filterStatus.competitor_status });
			// params.competitor_import = filterStatus.competitor_import;
			// params.profit_calculation = filterStatus.profit_calculation;
			// params.competitor_full = filterStatus.competitor_full;
			// params.keyword_import = filterStatus.keyword_import;
			const [tableRes] = await Promise.all([
				next({ ...params }),
				fetchStockStatistics() // 并行调用，不用等表格加载完
			]);
			const { list } = tableRes;

			const rows = Table.value?.data?.length ? Table.value.data : list || [];
			rows.forEach((item) => {
				item.image_url_display = convert_image_url(item.image_url);
				item.aliyun_img_display = convert_image_url(item.aliyun_img);
				if (item.delivery_volumes) {
					item.fba_max_price = item.delivery_volumes.FBA?.max_price || 0;
					item.fba_min_price = item.delivery_volumes.FBA?.min_price || 0;
					item.fbm_max_price = item.delivery_volumes.FBM?.max_price || 0;
					item.fbm_min_price = item.delivery_volumes.FBM?.min_price || 0;
				}
			});
			preloadProductImages(rows, {
				prefixes: ["image_url", "aliyun_img"],
				reason: "bsr-candidate4"
			});
		}
	},
	(app) => {
		app.refresh();
	}
);
const showOnlyStatusLibrary = ref(true);

const competitor_import_status = ref(false);
const profit_calculation_status = ref(false);

// 批量获取关键词（替换为 SIF 接口） 2026-04-02
async function handleFetchKeywordsForSelection() {
	const selection = Table.value?.selection;
	if (!selection || selection.length === 0) {
		ElMessage.warning("请先勾选要获取关键词的选品");
		return;
	}

	try {
		const loadingInstance = ElLoading.service({
			lock: false,
			text: "正在提交关键词获取任务，请稍候...",
			background: "rgba(0, 0, 0, 0.7)"
		});

		const ids = selection.map((item: any) => item.asinid || item.candidate_id || item.id);

		// 2026-04-02 修改：使用 SIF 关键词接口替换原卖家精灵接口，旧代码注释保留
			/*
			const response = await (service.app as any).keyword.fetchKeywords({
				ids: ids
			});
			loadingInstance.close();
			ElMessage.success(`获取关键词成功: ${response.message || '已提交后台获取'}`);
			*/

			// 调用新版按英国/德国分别查询的方法
			const response = await (service.app as any).sifKeyword.fetchKeywordsForCandidatesUKDE({
				ids: ids
			});

		loadingInstance.close();
		ElMessage.success(`关键词获取任务已提交`);
		Crud.value?.refresh();
	} catch (error) {
		console.error("获取关键词失败:", error);
		ElMessage.error("获取关键词失败");
	}
}
const competitor_full_ownership_status = ref(false);

async function updateCompetitorStatus(row: any, newStatus: number) {
	const oldStatus = row.competitor_status;
	try {
		row.competitor_status = newStatus;
		await Crud.value?.service.update({
			id: row.id,
			competitor_status: newStatus
		});
		ElMessage({ message: "更新流程状态成功", type: "success" });
		Crud.value?.refresh();
	} catch (err) {
		row.competitor_status = oldStatus;
		ElMessage({ message: "更新流程状态失败，请重试", type: "error" });
		console.error("更新流程状态失败:", err);
	}
}

const keyword_import_status = ref(false);

watch([showOnlyStatusLibrary], () => void setTimeout(Crud?.value?.refresh(), 200));
watch(
	() => [
		showOnlyStatusLibrary.value,
		filterStatus.competitor_import,
		filterStatus.profit_calculation,
		filterStatus.competitor_full,
		filterStatus.keyword_import,
		filterStatus.UKDEStatus,
		filterStatus.competitor_status
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
					label: "预留",
					value: appConfig.BSR_CANDIDATE_STATUS.RESERVED.value,
					type: "warning"
				},
				{
					label: "已归档",
					value: appConfig.BSR_CANDIDATE_STATUS.ARCHIVED.value,
					type: "info"
				},
				{ label: "待处理", value: 6, type: "primary" }
			],
			width: 80,
			showOverflowTooltip: true,
			sortable: "custom"
		},
		{
			label: "流程状态",
			prop: "competitor_status",
			dict: [
				{ label: "0-八爪鱼抓取中", value: 0, type: "info" },
				{ label: "1-八爪鱼抓取完成", value: 1, type: "primary" },
				{ label: "2-识图中", value: 2, type: "warning" },
				{ label: "3-识图完成", value: 3, type: "success" },
				{ label: "3-1识图回跳", value: 31, type: "warning" },
				{ label: "3-2回跳缺少竞品", value: 32, type: "danger" },
				{ label: "4-部分详情拉取中", value: 4, type: "warning" },
				{ label: "5-部分详情已获取/失败", value: 5, type: "info" },
				{ label: "6-部分标题评分比对中", value: 6, type: "warning" },
				{ label: "7-部分标题评分比对已完成", value: 7, type: "success" },
				{ label: "8-获取推荐位中", value: 8, type: "warning" },
				{ label: "9-推荐位获取完成", value: 9, type: "success" },
				{ label: "10-获取搜索页中", value: 10, type: "warning" },
				{ label: "11-获取搜索页完成", value: 11, type: "success" },
				{ label: "12-再次识图中", value: 12, type: "warning" },
				{ label: "13-再次识图完成", value: 13, type: "success" },
				{ label: "14-再次详情拉取中", value: 14, type: "warning" },
				{ label: "15-再次详情获取失败回滚", value: 15, type: "danger" },
				{ label: "16-再次标题评分比对中", value: 16, type: "warning" },
				{ label: "17-再次标题评分比对完成", value: 17, type: "success" },
				{ label: "18-关键词获取中", value: 18, type: "warning" },
				{ label: "19-关键词获取完成", value: 19, type: "success" },
				{ label: "20-得分计算完成", value: 20, type: "success" }
			],
			minWidth: 120,
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
			label: "上传阿里云图片",
			prop: "aliyun_img_display",
			component: { name: "cl-image", props: { size: 50, fit: "contain" } }
		},
		{
			label: "是否上传阿里云",
			prop: "isUpload",
			minWidth: 90,
			sortable: "custom",
			dict: [
				{ label: "待上传", value: 0, type: "warning" },
				{ label: "成功", value: 1, type: "success" },
				{ label: "失败", value: 2, type: "info" }
			]
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

		// 获取竞品前五自然/广告分
		if (isEditMode.value && newData.id) {
			fetchCompetitorTop5Scores(newData.id);
		}
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
				// {
				//   label: '主图',
				//   prop: 'image_url',
				//   component: {
				//     name: 'el-input',
				//     props: {
				//       // 核心配置
				//       modelValue: '', // 双向绑定值
				//       placeholder: '请输入图片URL地址',
				//       clearable: true,

				//       // 动态控制
				//       // disabled: computed(() => isEditMode.value),

				//       // 输入验证
				//       type: 'url',
				//       pattern: 'https?://.*'
				//     },
				//     // 值更新处理器
				//     on: {
				//       'update:modelValue': (val) => {
				//         Upsert.value.form.image_url = val
				//       }
				//     }
				//   },
				//   span: 24
				// },
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
				},

				{
					label: "开发人员",
					prop: "distinguish",
					component: { name: "el-input", props: {} },
					span: 12
				}
			]
		},
		{
			label: "",
			prop: "get_product_info",
			component: { name: "slot-get_product_info" }
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
			required: true,
			span: 12
		},

		{
			label: "",
			prop: "produce_name",
			component: { name: "slot-produce_name" }
		},

		{
			label: "",
			prop: "image_url",
			component: { name: "slot-produce_image_url" }
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

		if (!isEditMode.value) {
			const canSubmit = await confirmRestoreArchivedCandidates([data]);
			if (!canSubmit) return;
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

function addRowFactoryLink() {
	if (!Upsert.value?.form.factory_links) {
		Upsert.value.form.factory_links = [];
	}
	Upsert.value?.form.factory_links.push(_getAnEmptyFactoryLinkItem());
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

function deleteVariant(scope: any, index: number) {
	scope.variant_Combination.splice(index, 1);
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
	if (candidate.produce_name === null) {
		ElMessage({ message: "请填写产品名称", type: "error" });
		return;
	}
	if (candidate.asin === null) {
		ElMessage({ message: "请填写asin", type: "error" });
		return;
	}

	// 1. 添加弹窗获取用户输入的最大采购量
	let maxPurchaseInput = await ElMessageBox.prompt("请输入最大采购量", "采购量设置", {
		confirmButtonText: "下一步",
		cancelButtonText: "取消",
		inputPattern: /^[1-9]\d*$/, // 验证正整数
		inputErrorMessage: "请输入有效的正整数",
		inputValue: "40" // 默认值
	}).catch((err) => {
		// 用户点击取消
		if (err !== "cancel") {
			ElMessage({ type: "error", message: "输入错误: " + err });
		}
		return null;
	});

	// 用户取消操作或关闭弹窗
	if (maxPurchaseInput === null) {
		return;
	}

	const maxPurchase = parseInt(maxPurchaseInput.value);

	// 获取采购员角色用户
	const roleUsers = await service.base.sys.user_role.page({
		roleId: 7,
		page: 1,
		size: 100
	});

	// 获取用户名映射
	const userIds = roleUsers.list?.map((u) => u.userId) || [];
	const users = await service.base.sys.user.page({
		id: userIds,
		page: 1,
		size: 100
	});

	const userList = users.list || [];
	const totalUsers = userList.length;
	const purchaserCountryOptions = PURCHASER_COUNTRY_OPTIONS;
	const purchaserCountryCodes = purchaserCountryOptions.map((country) => country.code);
	const allowedCountryCodesByUserIndex = userList.map((user) =>
		getAllowedCountryCodes(user, purchaserCountryCodes)
	);
	const countryEligibleCounts = purchaserCountryCodes.map(
		(countryCode) =>
			allowedCountryCodesByUserIndex.filter((allowedCodes) =>
				allowedCodes.includes(countryCode)
			).length
	);
	const maxRandomPurchaserCount =
		countryEligibleCounts.length > 0 ? Math.min(...countryEligibleCounts) : totalUsers;

	// 采购员勾选状态 / 国家启用状态
	const selectedPurchasers: Record<string, boolean> = {};
	const countryEnabled: Record<string, Record<string, boolean>> = {};
	purchaserCountryCodes.forEach((countryCode) => {
		countryEnabled[countryCode] = {};
	});
	userList.forEach((user) => {
		selectedPurchasers[user.name] = false;
		purchaserCountryCodes.forEach((countryCode) => {
			countryEnabled[countryCode][user.name] = false;
		});
	});

	const escapeHtml = (value: any) =>
		String(value ?? "").replace(
			/[&<>"']/g,
			(char) =>
				({
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					'"': "&quot;",
					"'": "&#039;"
				})[char] || char
		);

	const countryHeadersHTML = purchaserCountryOptions
		.map((country) => {
			const suffix = country.code.toUpperCase();
			return `
	        <th style="width:25%">
	          <input type="number" id="num${suffix}" class="num-input" value="0" min="0" max="0" onchange="window._purchaserDialog.onNumChange('${country.code}')">
	          <div>${escapeHtml(country.label)} (<span id="cnt${suffix}">0</span>/<span id="max${suffix}">0</span>)</div>
	        </th>`;
		})
		.join("");

	// 构建三列表格 HTML：采购员 | 英国 | 德国
	let purchasersHTML = `
	<div>
	  <style>
	    .purchaser-table { width: 100%; border-collapse: collapse; font-size: 13px; }
	    .purchaser-table th, .purchaser-table td { padding: 6px 8px; text-align: center; border-bottom: 1px solid #ebeef5; }
	    .purchaser-table th { font-weight: 600; color: #303133; background: #f5f7fa; }
	    .purchaser-table .num-input { width: 56px; text-align: center; padding: 3px 4px; border: 1px solid #dcdfe6; border-radius: 4px; }
	    .purchaser-table .col-name { text-align: left; }
	    .purchaser-table tbody tr:hover { background: #f5f7fa; }
	    .section-hint { margin-bottom: 10px; color: #909399; font-size: 12px; }
	  </style>
	  <p class="section-hint">请在下方选择采购员及对应国家，打勾表示该采购员可对该国家输入采购数量</p>
	  <table class="purchaser-table">
	    <thead>
	      <tr>
	        <th style="width:50%">
	          <input type="number" id="numPurchaser" class="num-input" value="0" min="0" max="${maxRandomPurchaserCount}" onchange="window._purchaserDialog.onNumChange('purchaser')">
	          <div>每国随机数 (<span id="cntPurchaser">0</span>/${maxRandomPurchaserCount})</div>
	        </th>
	        ${countryHeadersHTML}
	      </tr>
	    </thead>
	    <tbody>
	`;

	userList.forEach((user, index) => {
		const countryCellsHTML = purchaserCountryOptions
			.map((country) => {
				const isAllowed = allowedCountryCodesByUserIndex[index]?.includes(country.code);
				return `
	        <td><input type="checkbox" id="cb-${country.code}-${index}" class="cb-${country.code}" ${isAllowed ? "" : 'title="该采购员无此国家权限" data-country-disallowed="1"'} disabled onchange="window._purchaserDialog.onCbChange('${country.code}', ${index})"></td>`;
			})
			.join("");
		purchasersHTML += `
	      <tr>
	        <td class="col-name">
	          <input type="checkbox" id="cb-p-${index}" class="cb-purchaser" onchange="window._purchaserDialog.onCbChange('purchaser', ${index})">
	          <label for="cb-p-${index}">${escapeHtml(user.name)}</label>
	        </td>
	        ${countryCellsHTML}
	      </tr>
	`;
	});

	purchasersHTML += `
	    </tbody>
	  </table>
	</div>`;

	const purchaserDialogWindow = window as Window & { _purchaserDialog?: any };
	purchaserDialogWindow._purchaserDialog = {
		total: totalUsers,
		maxRandomCount: maxRandomPurchaserCount,
		randomTargetCount: 0,
		userIndexes: userList.map((_, index) => index),
		countryCodes: purchaserCountryCodes,
		allowedCountryCodesByUserIndex,
		getInput(id: string) {
			return document.getElementById(id) as HTMLInputElement | null;
		},
		getCheckboxes(type: string) {
			return Array.from(document.querySelectorAll<HTMLInputElement>(`.cb-${type}`));
		},
		getCountrySuffix(country: string) {
			return String(country).toUpperCase();
		},
		isCountryAllowed(country: string, index: number) {
			return this.allowedCountryCodesByUserIndex[index]?.includes(country);
		},
		getEligibleIndexes(country: string) {
			return this.userIndexes.filter((index: number) => this.isCountryAllowed(country, index));
		},
		setCountrySelection(country: string, indexes: number[]) {
			this.getCheckboxes(country).forEach((checkbox: HTMLInputElement) => {
				checkbox.checked = false;
			});
			indexes.forEach((index: number) => {
				const countryCheckbox = this.getInput(`cb-${country}-${index}`);
				const purchaserCheckbox = this.getInput(`cb-p-${index}`);
				if (countryCheckbox && this.isCountryAllowed(country, index)) {
					countryCheckbox.checked = true;
					if (purchaserCheckbox) purchaserCheckbox.checked = true;
				}
			});
		},
		syncPurchaserSelectionFromCountries() {
			this.getCheckboxes("purchaser").forEach((checkbox: HTMLInputElement, index: number) => {
				checkbox.checked = this.countryCodes.some(
					(country: string) => !!this.getInput(`cb-${country}-${index}`)?.checked
				);
			});
		},
		syncCountryAvailability() {
			this.getCheckboxes("purchaser").forEach((checkbox: HTMLInputElement, index: number) => {
				this.countryCodes.forEach((country: string) => {
					const countryCheckbox = this.getInput(`cb-${country}-${index}`);
					if (!countryCheckbox) return;
					const enabled = checkbox.checked && this.isCountryAllowed(country, index);
					countryCheckbox.disabled = !enabled;
					if (!enabled) countryCheckbox.checked = false;
				});
			});
		},
		updateCounts() {
			this.syncCountryAvailability();
			const purchaserInput = this.getInput("numPurchaser");
			if (purchaserInput) {
				purchaserInput.value = String(this.randomTargetCount);
				purchaserInput.max = String(this.maxRandomCount);
			}
			const purchaserTotal = document.getElementById("cntPurchaser");
			if (purchaserTotal) purchaserTotal.textContent = String(this.randomTargetCount);
			this.countryCodes.forEach((country: string) => {
				const suffix = this.getCountrySuffix(country);
				const countryCount = this.getCheckboxes(country).filter(
					(checkbox: HTMLInputElement) => checkbox.checked
				).length;
				const countryMax = this.getEligibleIndexes(country).length;
				const countryInput = this.getInput(`num${suffix}`);
				const countryTotal = document.getElementById(`cnt${suffix}`);
				const countryMaxText = document.getElementById(`max${suffix}`);
				if (countryInput) {
					countryInput.value = String(countryCount);
					countryInput.max = String(countryMax);
				}
				if (countryTotal) countryTotal.textContent = String(countryCount);
				if (countryMaxText) countryMaxText.textContent = String(countryMax);
			});
		},
		onNumChange(type: string) {
			if (type === "purchaser") {
				let n = parseInt(this.getInput("numPurchaser")?.value) || 0;
				n = Math.min(Math.max(n, 0), this.maxRandomCount);
				this.randomTargetCount = n;
				const assignment = selectPurchasersByCountry({
					userIndexes: this.userIndexes,
					countryCodes: this.countryCodes,
					allowedCountryCodesByUserIndex: this.allowedCountryCodesByUserIndex,
					count: n
				});
				["purchaser", ...this.countryCodes].forEach((checkboxType) => {
					this.getCheckboxes(checkboxType).forEach((checkbox: HTMLInputElement) => {
						checkbox.checked = false;
					});
				});
				assignment.selectedIndexes.forEach((index: number) => {
					const purchaserCheckbox = this.getInput(`cb-p-${index}`);
					if (purchaserCheckbox) purchaserCheckbox.checked = true;
				});
				this.countryCodes.forEach((country: string) => {
					this.setCountrySelection(country, assignment.countryIndexes[country] || []);
				});
				this.syncPurchaserSelectionFromCountries();
			} else if (this.countryCodes.includes(type)) {
				const inputId = `num${this.getCountrySuffix(type)}`;
				const selectedIndexes = this.getEligibleIndexes(type);
				let n = parseInt(this.getInput(inputId)?.value) || 0;
				n = Math.min(Math.max(n, 0), selectedIndexes.length);
				this.setCountrySelection(type, pickRandomIndexes(selectedIndexes, n));
				this.syncPurchaserSelectionFromCountries();
			}
			this.updateCounts();
		},
		onCbChange(type: string, index: number) {
			if (type === "purchaser") {
				const purchaserCheckbox = this.getInput(`cb-p-${index}`);
				if (!purchaserCheckbox?.checked) {
					this.countryCodes.forEach((country: string) => {
						const checkbox = this.getInput(`cb-${country}-${index}`);
						if (checkbox) checkbox.checked = false;
					});
				}
			} else if (this.countryCodes.includes(type)) {
				const purchaserCheckbox = this.getInput(`cb-p-${index}`);
				const countryCheckbox = this.getInput(`cb-${type}-${index}`);
				if (!purchaserCheckbox?.checked || !this.isCountryAllowed(type, index)) {
					if (countryCheckbox) countryCheckbox.checked = false;
				} else if (countryCheckbox?.checked) {
					purchaserCheckbox.checked = true;
				}
			}
			this.updateCounts();
		}
	};

	// 显示采购员选择弹窗
	let purchaserSelection;
	try {
		purchaserSelection = await ElMessageBox({
			title: "选择采购员",
			message: purchasersHTML,
			showCancelButton: true,
			confirmButtonText: "确认",
			cancelButtonText: "上一步",
			dangerouslyUseHTMLString: true,
			beforeClose: async (action, instance, done) => {
				if (action === "confirm") {
					userList.forEach((user, index) => {
						selectedPurchasers[user.name] =
							!!purchaserDialogWindow._purchaserDialog?.getInput(`cb-p-${index}`)
								?.checked;
						purchaserCountryCodes.forEach((countryCode) => {
							countryEnabled[countryCode][user.name] =
								!!purchaserDialogWindow._purchaserDialog?.getInput(
									`cb-${countryCode}-${index}`
								)?.checked;
						});
					});
					done();
				} else if (action === "cancel") {
					done();
				} else {
					done();
				}
			}
		});
	} catch (err) {
		delete purchaserDialogWindow._purchaserDialog;
		if (err === "cancel") {
			return updateStatus(candidate, status);
		}
		if (err !== "cancel") {
			ElMessage({ type: "error", message: "选择采购员时出错: " + err });
		}
		return;
	}

	delete purchaserDialogWindow._purchaserDialog;

	let oldStatus = candidate?.status;

	const insertData = userList.map((user) => ({
		purchaser: user.name,
		userId: user.id ?? user.userId,
		candidate_id: candidate.id,
		is_generate: selectedPurchasers[user.name] ? 1 : 4,
		purchaserNum: '{"de":0,"es":0,"fr":0,"it":0,"uk":0}',
		country_enabled: JSON.stringify(
			purchaserCountryCodes.reduce<Record<string, boolean>>((result, countryCode) => {
				result[countryCode] = !!countryEnabled[countryCode]?.[user.name];
				return result;
			}, {})
		)
	}));

	try {
		candidate.status = status;

		const reserveResult = await (service.app.bsr_candidate as any).request({
			url: "/reserve",
			method: "POST",
			data: {
				id: candidate.id,
				max_purchase: maxPurchase,
				purchasers: insertData
			}
		});

		ElMessage({
			message: reserveResult?.message || "已进入预留",
			type: reserveResult?.notified === false ? "warning" : "success"
		});
		Crud.value?.refresh();
	} catch (err) {
		// 失败时回滚状态
		candidate.status = oldStatus;
		ElMessage({ message: "进入预留失败，请刷新/重试。", type: "error" });
		console.error("预留流程错误:", err);
	}
}
async function archiveWithImage(id: number) {
	await service.app.bsr_candidate.archiveWithImage3({
		id: id
	});
}

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
async function getProductInfo(id: number) {
	await service.app.bsr_candidate.getProductInfo({
		id: id
	});
}
async function triggerSimilarityProcessing() {
	try {
		syncing.value = true;
		await service.app.bsr_candidate.triggerSimilarityProcessing();
		ElMessage.success("识图成功");
	} catch (err) {
		ElMessage.error("识图失败");
	} finally {
		syncing.value = false;
	}
}

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

		const productStockGroups: Record<
			string,
			Record<
				string,
				{
					hasXian: boolean; // 是否包含inventory_type="XIAN"的记录
					xianMainMonthlySales: number | null; // XIAN类型只存一次Main_monthly_sales
					fbaStockSum: number; // 非XIAN的FBA库存总和
					hasInvalidStock: boolean; // 是否有无效库存数据（null/空）
				}
			>
		> = {
			UK: {},
			DE: {},
			FR: {},
			ES: {},
			IT: {}
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

			// 生成产品组唯一标识：parent_asin优先，无则用variants+sold_by+Main_monthly_sales
			const parentAsin = item.parent_asin || "";
			const variants = item.variants || "";
			const mainMonthlySales = (item.Main_monthly_sales || 0).toString();
			const productGroupKey = parentAsin || `${variants}_${soldBy}_${mainMonthlySales}`;

			// 获取当前市场的产品组
			let productGroup = productStockGroups[marketplaceEn][productGroupKey];
			if (!productGroup) {
				productGroup = {
					hasXian: false,
					xianMainMonthlySales: null,
					fbaStockSum: 0,
					hasInvalidStock: false
				};
				productStockGroups[marketplaceEn][productGroupKey] = productGroup;
			}

			// 标记无效库存数据 (注意: 过滤掉 inventory_type === "1" 的情况)
			if (rawStockQuantity === null && item.inventory_type !== "1") {
				productGroup.hasInvalidStock = true;
			}

			// 处理inventory_type="XIAN"的情况
			const inventoryType = item.inventory_type || "";
			if (inventoryType === "XIAN") {
				productGroup.hasXian = true;
				// XIAN类型只取一次Main_monthly_sales
				if (productGroup.xianMainMonthlySales === null) {
					productGroup.xianMainMonthlySales = Number(item.Main_monthly_sales) || 0;
				}
			} else if (type === "FBA" && rawStockQuantity !== null) {
				// 非XIAN的FBA类型，累加库存
				productGroup.fbaStockSum += rawStockQuantity;
			}

			if (item.inventory_type !== "1") {
				stockDataByMarketType[marketplaceEn][type].push(rawStockQuantity);
			}

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
			const marketGroups = productStockGroups[marketplace];
			let fbaStockTotal = 0;
			let fbaHasInvalid = false;

			// 计算FBA库存（按产品组规则）
			Object.values(marketGroups).forEach((group) => {
				if (group.hasInvalidStock) {
					fbaHasInvalid = true;
					return;
				}
				if (group.hasXian) {
					// 有XIAN类型，只加一次Main_monthly_sales
					fbaStockTotal += group.xianMainMonthlySales || 0;
				} else {
					// 无XIAN类型，累加FBA库存
					fbaStockTotal += group.fbaStockSum;
				}
			});

			// 设置FBA库存结果
			volumesByMarketplace[marketplace].FBA.stockTotal = fbaHasInvalid
				? "数据不全"
				: fbaStockTotal;

			// FBM/Other保持原有计算逻辑
			for (const type of ["FBM", "Other"] as const) {
				const stockQuantities = stockDataByMarketType[marketplace][type];
				const typeHasInvalid = stockQuantities.some((sq) => sq === null);

				if (typeHasInvalid) {
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
					? parseFloat((fbaData.totalReview / fbaData.count).toFixed(2))
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

const stockLoading = ref(true);

// 新增：库存统计数据
const stockStatistics = ref({
	totalGot: 0,
	totalShouldGet: 0,
	ratio: ""
});

const fetchStockStatistics = async () => {
	stockLoading.value = true;
	try {
		const res = await service.app.bsr_candidate_competitor.getStockStatistics();
		console.log("后端返回的完整数据：", JSON.stringify(res));

		// 关键修改：后端直接返回数据体，无需判断code，直接赋值
		if (res && res.totalShouldGet !== undefined) {
			// 只要有totalShouldGet字段就认为成功
			stockStatistics.value = {
				totalGot: res.totalGot || 0,
				totalShouldGet: res.totalShouldGet || 0,
				ratio: res.ratio || "0/0"
			};
			console.log("前端赋值后的库存数据：", stockStatistics.value);
		} else {
			ElMessage.warning(`获取库存统计失败：${res?.message || "接口返回异常"}`);
			stockStatistics.value = { totalGot: 0, totalShouldGet: 0, ratio: "0/0" };
		}
	} catch (error: any) {
		console.error("库存统计请求异常：", error);
		ElMessage.error(`获取库存统计失败：${error.message || "网络异常"}`);
		stockStatistics.value = { totalGot: 0, totalShouldGet: 0, ratio: "0/0" };
	} finally {
		stockLoading.value = false;
	}
};

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

// 在 globals.d.ts 或其他类型声明文件中添加
// 修改后的handleExport方法
async function handleExport() {
	try {
		// 修改为调用八爪鱼识图接口 - 2026-04-03
		let response = await service.app.bsr_candidate.startBzyShiTu();

		if (response.success) {
			if (response.taskName) {
				ElMessage.success("已成功发送数据至八爪鱼任务池，任务名：" + response.taskName);
			} else {
				ElMessage.warning(response.message || "无待处理数据");
			}
		} else {
			ElMessage.error(response.message || "发起任务失败");
		}
	} catch (error) {
		console.error("发起八爪鱼任务错误:", error);
		ElMessage.error("发起任务失败: " + error);
	}
}

// 新增智能截断工具函数
function smartTruncate(str: string, maxLength: number) {
	if (str.length <= maxLength) return str;

	// 查找最后一个空格位置
	const lastSpaceIndex = str.lastIndexOf(" ", maxLength);

	// 如果找不到空格，直接硬截断
	return lastSpaceIndex === -1
		? str.substring(0, maxLength) + "..."
		: str.substring(0, lastSpaceIndex) + "...";
}

//导入asin
function flexibleMapping(item: any) {
	// 定义中文字段与英文字段的映射关系（完全保留原有）
	const mapping: Record<string, string> = {
		ASIN: "asin_competitor",
		标题: "item_name",
		img1: "img1",
		img2: "img2",
		img3: "img3",
		img4: "img4",
		img5: "img5",
		img6: "img6",
		imgurl1: "image_url",
		价格: "price",
		评论数: "review_num",
		评分: "last_star",
		类目: "bsr_category",
		类目排名: "bsr_rank",
		节点: "bsr_node",
		节点排名: "bsr_node_rank",
		节点编号: "bsr_node_id",
		配送方: "dispatches_from",
		售卖方: "sold_by",
		卖家: "sold_by",
		卖家ID: "sold_byID",
		配送方式: "dispatches_type",
		配送类型: "dispatches_type",
		上架日期: "date_first_available",
		上架时间: "date_first_available",
		首次上架时间: "date_first_available",
		国家: "marketplace",
		颜色变体数量: "color_variants",
		尺寸变体数量: "size_variants",
		售价: "price",
		任务源ASIN: "asin_candidate",
		评级: "last_star",
		review数量: "review_num",
		任务源asin: "asin_candidate",
		任务源ID: "candidate_id",
		竞品ID: "id",
		卖点: "bullet_points",
		变体数: "variants",
		父体月销: "Main_monthly_sales",
		子体月销: "Main_monthly_sales_sub",
		父体销量: "Main_monthly_sales",
		子体销量: "Main_monthly_sales_sub",
		库存数量: "stock_quantity",
		FBA配送费: "FBA_price",
		包装尺寸: "dimensions",
		包装重量: "weight",
		历史销量: "sales_volume_data",
		关联位置: "associated"
	};

	const newItem: any = {};

	// 遍历映射关系（完全保留原有逻辑）
	Object.keys(mapping).forEach((chineseKey) => {
		if (item.hasOwnProperty(chineseKey)) {
			newItem[mapping[chineseKey]] = item[chineseKey];
		}
	});

	// 仿照你的改动：批量清理空字段（替代20+个重复if，逻辑完全一致）
	const emptyFieldRules = [
		{ field: "Main_monthly_sales", condition: (v: any) => !v },
		{ field: "Main_monthly_sales_sub", condition: (v: any) => !v },
		{ field: "stock_quantity", condition: (v: any) => !v },
		{ field: "FBA_price", condition: (v: any) => !v || v === "0" },
		{ field: "bsr_category", condition: (v: any) => !v },
		{ field: "bsr_rank", condition: (v: any) => !v },
		{ field: "bsr_node", condition: (v: any) => !v },
		{ field: "bsr_node_rank", condition: (v: any) => !v },
		{ field: "bsr_node_id", condition: (v: any) => !v },
		{ field: "dimensions", condition: (v: any) => !v || v === "0" },
		{ field: "weight", condition: (v: any) => !v || v === "0" },
		{ field: "last_star", condition: (v: any) => !v },
		{ field: "review_num", condition: (v: any) => !v },
		{ field: "price", condition: (v: any) => !v },
		{ field: "image_url", condition: (v: any) => !v },
		{ field: "marketplace", condition: (v: any) => !v },
		{ field: "date_first_available", condition: (v: any) => !v || v === "0" },
		{ field: "dispatches_from", condition: (v: any) => !v },
		{ field: "sold_by", condition: (v: any) => !v },
		{ field: "img1", condition: (v: any) => !v },
		{ field: "img2", condition: (v: any) => !v },
		{ field: "img3", condition: (v: any) => !v },
		{ field: "img4", condition: (v: any) => !v },
		{ field: "img5", condition: (v: any) => !v },
		{ field: "img6", condition: (v: any) => !v },
		{ field: "sales_volume_data", condition: (v: any) => !v },
		{ field: "bullet_points", condition: (v: any) => !v },
		{ field: "variants", condition: (v: any) => !v }
	];

	// 批量执行清理（逻辑和原有if完全一致，仅代码结构优化）
	emptyFieldRules.forEach(({ field, condition }) => {
		if (condition(newItem[field])) {
			delete newItem[field];
		}
	});

	// 以下所有业务逻辑完全保留，不做任何修改
	if (newItem.dispatches_from) {
		// 以"配送"作为分隔符，取第一个元素
		newItem.dispatches_from = newItem.dispatches_from.split("配送")[0];
	}

	if (newItem.sold_by) {
		// 以"配送"作为分隔符，取第一个元素
		newItem.sold_by = newItem.sold_by.split("配送")[0];
	}

	if (newItem.image_url) {
		newItem.image_url = newItem.image_url.replace(",", ".");
	}
	if (newItem.dispatches_type && newItem.dispatches_type != "NA") {
		if (newItem.dispatches_type == "FBA") {
			newItem.dispatches_type = "1";
		}
		if (newItem.dispatches_type == "FBM") {
			newItem.dispatches_type = "2";
		}
		if (newItem.dispatches_type == "AMZ") {
			newItem.dispatches_type = "0";
		}
	}
	newItem.inventory_status = "0";

	if (
		newItem.dispatches_from &&
		newItem.sold_by &&
		(!newItem.dispatches_type || newItem.dispatches_type == "NA")
	) {
		if (newItem.sold_by == "Amazon" || newItem.sold_by == "amazon") {
			newItem.dispatches_type = "0";
		} else if (newItem.dispatches_from == "amazon" || newItem.dispatches_from == "Amazon") {
			newItem.dispatches_type = "1";
		} else {
			newItem.dispatches_type = "2";
		}
	}

	if (newItem.stock_quantity) {
		newItem.stock_quantity = newItem.stock_quantity.toString().replace(">", "");
		newItem.stock_quantity = newItem.stock_quantity.toString().replace("<", "");
	}

	// if(newItem.review_num){
	//   newItem.review_num = newItem.review_num.replace('-','')
	// }
	// if(newItem.price){
	//   newItem.price = newItem.price.replace('£','')
	// }
	// if(newItem.bsr_rank){
	//   newItem.bsr_rank = newItem.bsr_rank.replace('#','')
	// }
	if (newItem.image_url) {
		// 使用正则表达式匹配 _AC_US 后接数字的部分，统一替换为 _AC_US500
		newItem.image_url = newItem.image_url.replace(/_AC_US\d+/g, "_AC_US1000");
		newItem.image_url = newItem.image_url.replace(/_AC_UL\d+/g, "_AC_UL1000");
		newItem.image_url = newItem.image_url.replace(/_SL\d+/g, "_SL1000");
		newItem.image_url = newItem.image_url.replace(/SS40+/g, "SS500");
		newItem.image_url = newItem.image_url.replace(/_AC_SR\d+,?\d*/g, "_AC_SR1000,1000");
		newItem.image_url = newItem.image_url.replace(
			/_SX\d+_SY\d+_CR[^_]*_/,
			"_SX1000_SY1000_CR,0,0,1000,1000_"
		);
	}
	// 另外，如果数据中本身已经存在英文字段，也一并保留
	Object.values(mapping).forEach((key) => {
		if (!newItem[key] && item.hasOwnProperty(key)) {
			newItem[key] = item[key];
		}
	});
	if (newItem.Main_monthly_sales) {
		newItem.expected_volume = newItem.Main_monthly_sales / 30;
	} else {
		newItem.expected_volume = 0.0;
		newItem.Main_monthly_sales = 0;
	}

	if (newItem.Main_monthly_sales && newItem.Main_monthly_sales_sub) {
		// 转换为数字进行比较（处理可能的字符串格式）
		const parentSales = parseFloat(newItem.Main_monthly_sales);
		const childSales = parseFloat(newItem.Main_monthly_sales_sub);

		if (!isNaN(parentSales) && !isNaN(childSales) && parentSales < childSales) {
			// 当父体销量小于子体销量时，将父体销量替换为子体销量

			newItem.Main_monthly_sales = newItem.Main_monthly_sales_sub.replace("+", "");
		}
	}

	// 处理 dimensions (替换逗号, 并加上 cm)
	// if (newItem.dimensions) {
	//   newItem.dimensions = newItem.dimensions.replace(/,/g, ".").replace(/\s*x\s*/g, "x") + " cm";
	// }
	if (newItem.price) {
		// 处理价格格式，截取至小数点后两位
		let priceStr = newItem.price
			.toString()
			.replace(/,/g, ".")
			.replace(/[^0-9.]/g, "");
		const dotIndex = priceStr.indexOf(".");
		if (dotIndex !== -1) {
			priceStr =
				priceStr.substring(0, dotIndex + 1) +
				priceStr.substring(dotIndex + 1).replace(/\./g, "");
		}

		// 解析并截断小数位
		const priceNum = parseFloat(priceStr);
		if (!isNaN(priceNum)) {
			// 截断至两位小数（非四舍五入）
			const truncated = Math.floor(priceNum * 100) / 100;
			newItem.price = truncated.toFixed(2);
		} else {
			newItem.price = "0.00";
		}
	}
	if (newItem.last_star > 5) {
		newItem.last_star = 0;
	}

	// 处理 weight (替换逗号, 并加上重量单位)
	if (newItem.weight) {
		newItem.weight = newItem.weight.toString().replace(/,/g, ".");
		if (item["重量单位"]) {
			const unitMap: Record<string, string> = { Kilogramm: "kg", Gramm: "g" };
			newItem.weight += unitMap[item["重量单位"]] || item["重量单位"];
		}
	}

	// 颜色变体数量和尺寸变体数量默认值设为1
	// const colorVariants = newItem.color_variants ? Number(newItem.color_variants) : 1;
	// const sizeVariants = newItem.size_variants ? Number(newItem.size_variants) : 1;
	// newItem.variants = colorVariants * sizeVariants;

	if (newItem.bsr_category) {
		const hasChinese = /[\u4e00-\u9fff]/.test(newItem.bsr_category);
		if (hasChinese) {
			newItem.bsr_category = newItem.bsr_category.substring(0, 225);
		}
	}
	// 组合 bsr_html

	if (!newItem.associated) {
		newItem.bsr_html = `所属类目：${newItem.bsr_category || ""}，类目排名：${newItem.bsr_rank || ""}，所属节点：${newItem.bsr_node || ""}，节点排名：${newItem.bsr_node_rank || ""}`;
	}
	if (newItem.marketplace) {
		if ("UK" == newItem.marketplace || "uk" == newItem.marketplace) {
			newItem.marketplace = "英国";
		}
		if ("DE" == newItem.marketplace || "de" == newItem.marketplace) {
			newItem.marketplace = "德国";
		}
		if ("FR" == newItem.marketplace || "fr" == newItem.marketplace) {
			newItem.marketplace = "法国";
		}
		if ("ES" == newItem.marketplace || "es" == newItem.marketplace) {
			newItem.marketplace = "西班牙";
		}
		if ("IT" == newItem.marketplace || "it" == newItem.marketplace) {
			newItem.marketplace = "意大利";
		}
	}
	if (newItem.date_first_available && typeof newItem.date_first_available === "number") {
		// 将 Excel 序列号转换为标准日期字符串（YYYY-MM-DD）
		newItem.date_first_available = new Date(
			(newItem.date_first_available - 25569) * 86400 * 1000
		)
			.toISOString()
			.slice(0, 10);
	}
	return newItem;
}

async function onSubmit(data: any, helpers: any = {}) {
	const CONFIG = {
		TRANSFORM_BATCH_SIZE: 500, // 预处理分片大小（避免阻塞）
		SUBMIT_BATCH_SIZE: 100, // 备用：若单ASIN数据量极大，可内部再分批次
		CONCURRENCY: 3, // 已废弃（改为串行），保留避免报错
		MAX_RETRY: 3 // 保留原有重试次数
	};

	const total = data.list.length;
	if (total === 0) {
		ElMessage.warning("无数据可导入");
		helpers.done?.();
		helpers.close?.();
		return;
	}

	const {
		done = () => {},
		close = () => {},
		setProgress = (current: number, total: number, message?: string) => {
			console.log(message || `进度：${current}/${total}，剩余：${total - current}`);
		}
	}: {
		done?: (result?: { failedItems: any[] }) => void;
		close?: () => void;
		setProgress?: (current: number, total: number, message?: string) => void;
	} = helpers;

	let successCount = 0;
	const failedItems: Array<{ index: number; item: any; error?: string }> = [];
	let processedList: Array<{
		_originalIndex: number;
		source: 1;
		_processError?: string;
		[key: string]: any;
	}> = [];
	// ========== 修复：提升asinGroupList作用域 ==========
	let asinGroupList: Array<{ asin: string; data: any[]; total: number }> = [];

	// 初始提示：显示总条数
	ElMessage.info(`开始导入，共需处理 ${total} 条数据`);
	setProgress(0, total, `待处理：${total} 条，已成功：0 条，剩余：${total} 条`);

	// 分片异步预处理（保留原有逻辑，无修改）
	const chunkedProcessData = async (): Promise<any[]> => {
		return new Promise((resolve) => {
			const result: any[] = [];
			let index = 0;

			function processNextBatch() {
				if (index >= total) {
					resolve(result);
					return;
				}

				// 处理当前分片（保留原有预处理逻辑：失败捕获、原始索引）
				const end = Math.min(index + CONFIG.TRANSFORM_BATCH_SIZE, total);
				const batch = data.list.slice(index, end);
				const processedBatch = batch
					.map((item: any, idx: number) => {
						const originalIndex = index + idx;
						try {
							return {
								...flexibleMapping(item), // 调用原有数据映射函数
								source: 1,
								_originalIndex: originalIndex
							};
						} catch (e) {
							const errorMsg = (e as Error).message;
							console.error(
								`预处理失败（原始索引：${originalIndex}）：`,
								errorMsg,
								item
							);
							failedItems.push({
								index: originalIndex,
								item: item,
								error: `预处理失败：${errorMsg}`
							});
							return null; // 标记失败数据，后续过滤
						}
					})
					.filter(Boolean); // 过滤失败数据

				result.push(...processedBatch);
				index = end;

				// 让出主线程（核心：避免UI卡死）
				setTimeout(() => {
					// 实时更新预处理进度（保留原有进度逻辑）
					const processedCount = result.length + failedItems.length;
					const remaining = total - processedCount;
					setProgress(
						processedCount,
						total,
						`预处理中：已处理 ${processedCount}/${total} 条，失败 ${failedItems.length} 条，剩余 ${remaining} 条`
					);
					processNextBatch();
				}, 0);
			}

			processNextBatch();
		});
	};

	// ========== 核心修改：按asin_candidate分组提交（每秒1个ASIN） ==========
	// 单ASIN分组提交（保留重试逻辑，适配ASIN维度）
	const submitSingleAsinGroup = async (asin: string, batch: any[], asinNo: number) => {
		let retryCount = 0;
		while (retryCount < CONFIG.MAX_RETRY) {
			try {
				const result = await service.app.bsr_candidate.add2(batch);
				const actualSuccess = result?.inserted + (result?.updated || 0) || batch.length;
				successCount += actualSuccess;

				// 进度更新：按ASIN维度展示
				const globalProcessed = successCount + failedItems.length;
				const globalRemaining = total - globalProcessed;
				setProgress(
					globalProcessed,
					total,
					`当前导入ASIN：${asin}（第${asinNo}/${asinGroupList.length}个），该ASIN应导入${batch.length}条，成功${actualSuccess}条；全局累计成功${successCount}条，剩余${globalRemaining}条`
				);
				ElMessage.success(
					`任务源ASIN【${asin}】导入成功，该ASIN成功${actualSuccess}条，全局累计成功${successCount}条`
				);
				return;
			} catch (err) {
				const errorMsg = (err as Error).message || "未知错误";
				retryCount++;

				if (retryCount === CONFIG.MAX_RETRY) {
					// 记录该ASIN下所有数据失败
					batch.forEach((item) => {
						failedItems.push({
							index: item._originalIndex,
							item: data.list[item._originalIndex],
							error: `任务源ASIN【${asin}】重试${CONFIG.MAX_RETRY}次失败：${errorMsg}`
						});
					});

					// 进度更新：包含ASIN失败信息
					const globalProcessed = successCount + failedItems.length;
					const globalRemaining = total - globalProcessed;
					setProgress(
						globalProcessed,
						total,
						`当前导入ASIN：${asin}（第${asinNo}/${asinGroupList.length}个），该ASIN${batch.length}条全部失败；全局累计失败${failedItems.length}条，剩余${globalRemaining}条`
					);
					ElMessage.error(
						`任务源ASIN【${asin}】导入失败（已重试3次），该ASIN${batch.length}条数据全部标记为失败`
					);
					console.error(`ASIN【${asin}】最终失败：`, errorMsg);
					return;
				} else {
					console.warn(`ASIN【${asin}】第${retryCount}次重试：`, errorMsg);
					await new Promise((r) => setTimeout(r, 2000 * retryCount)); // 原有重试间隔逻辑
				}
			}
		}
	};

	// 串行遍历ASIN分组（每秒1个）
	const submitByAsin = async () => {
		for (let i = 0; i < asinGroupList.length; i++) {
			const { asin, data } = asinGroupList[i];
			// 前端提示：开始导入当前ASIN
			ElMessage.info(`开始导入任务源ASIN：${asin}，共${data.length}条数据`);

			// 提交当前ASIN的所有数据
			await submitSingleAsinGroup(asin, data, i + 1);

			// 控制速率：每秒导入1个ASIN（最后一个ASIN无需等待）
			if (i < asinGroupList.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	};

	// ========== 主流程 ==========
	try {
		// 1. 分片异步预处理
		processedList = await chunkedProcessData();
		if (processedList.length === 0) {
			ElMessage.error("无有效数据可提交");
			done?.({ failedItems: failedItems.map((f) => f.item) });
			close?.();
			return;
		}

		// 2. 核心修改：按asin_candidate分组（替代原数量分批次）
		const asinGroups: Record<string, any[]> = {};
		processedList.forEach((item) => {
			const key = item.asin_candidate;
			if (!key) {
				// 无asin_candidate的归为失败
				failedItems.push({
					index: item._originalIndex,
					item: data.list[item._originalIndex],
					error: "缺失任务源ASIN（asin_candidate），无法分组导入"
				});
				return;
			}
			if (!asinGroups[key]) {
				asinGroups[key] = [];
			}
			asinGroups[key].push(item);
		});
		// 赋值给全局作用域的asinGroupList
		asinGroupList = Object.entries(asinGroups).map(([asin, data]) => ({
			asin,
			data,
			total: data.length
		}));

		if (asinGroupList.length === 0) {
			ElMessage.error("无有效任务源ASIN可提交");
			done?.({ failedItems: failedItems.map((f) => f.item) });
			close?.();
			return;
		}
		ElMessage.info(
			`预处理完成，共识别到 ${asinGroupList.length} 个任务源ASIN，将每秒导入1个ASIN的所有数据`
		);

		// 3. 按ASIN串行提交（每秒1个）
		await submitByAsin();

		// 4. 原有业务逻辑：批量更新导入状态
		const updatePayload = {
			field: "competitor_import_status" as const,
			status: 1,
			items: Array.from(
				new Set(
					processedList
						.filter((item) => item?.asin_candidate && item?.marketplace)
						.map((item) => `${item.asin_candidate}|${item.marketplace}`)
				)
			).map((str) => {
				const [asin, marketplace] = str.split("|") as [string, string];
				return { asin, marketplace };
			})
		};
		await service.app.bsr_candidate.batch_update_status(updatePayload);

		ElMessage.info("已发起阿里云图片对比任务（后台执行）");

		await service.app.bsr_candidate.triggerSimilarityProcessing();
		// 5. 最终结果反馈（补充ASIN维度统计）
		const successAsinCount = asinGroupList.filter((g) => {
			// 计算该ASIN的成功数
			const success = g.data.filter(
				(item) => !failedItems.some((f) => f.index === item._originalIndex)
			).length;
			return success > 0;
		}).length;
		ElMessage.success(
			`导入完成！总条数：${total}，成功：${successCount}，失败：${failedItems.length}`
		);
		ElMessage.info(
			`任务源ASIN统计：共${asinGroupList.length}个ASIN，成功${successAsinCount}个，失败${asinGroupList.length - successAsinCount}个`
		);

		// 控制台打印详情
		if (failedItems.length > 0) {
			console.error("失败条目详情（原始索引+数据）：");
			failedItems.forEach(({ index, item, error }) => {
				console.error(`索引 ${index}：`, error, "原始数据：", item);
			});
			console.log("各ASIN导入详情：");
			asinGroupList.forEach(({ asin, total }) => {
				const success =
					total - failedItems.filter((f) => f.error?.includes(`ASIN【${asin}】`)).length;
				console.log(
					`ASIN【${asin}】：应导入${total}条，成功${success}条，失败${total - success}条`
				);
			});
			ElMessage.warning(`存在 ${failedItems.length} 条失败数据，详情见控制台`);
		}

		setTimeout(() => done?.({ failedItems: failedItems.map((f) => f.item) }), 100);
	} catch (err: any) {
		const errorMsg = err.message || "系统级错误";
		ElMessage.error(`导入中断：${errorMsg}`);
		console.error("导入总异常：", err);
		done?.({ failedItems: failedItems.map((f) => f.item) });
	} finally {
		close?.();
	}
}

function onSubmit2(data: any, { close }: any) {
	data.list = data.list.map((item: any) => {
		let newItem = flexibleMapping(item);
		newItem.source = 1;
		return newItem;
	});

	// 分批提交
	batchSubmit(data.list, 100)
		.then(() => {
			ElMessage.success("所有数据已成功导入");
			close();
		})
		.catch(() => {
			ElMessage.error("部分数据导入失败");
		});
}

// 分批提交数据
async function batchSubmit(dataList: any[], batchSize = 100) {
	// 按 batchSize 拆分数据
	const batches: any[][] = [];
	for (let i = 0; i < dataList.length; i += batchSize) {
		batches.push(dataList.slice(i, i + batchSize));
	}

	console.log(`共分成 ${batches.length} 批次提交`);

	for (let index = 0; index < batches.length; index++) {
		const batch = batches[index];

		try {
			console.log(`正在提交第 ${index + 1} 批数据，共 ${batch.length} 条`);
			await service.app.bsr_candidate_competitor.updateCompetitor(batch);
			console.log(`第 ${index + 1} 批数据提交成功`);
		} catch (err: any) {
			console.error(`第 ${index + 1} 批提交失败:`, err);
			ElMessage.error(`第 ${index + 1} 批提交失败: ${err.message || "未知错误"}`);
			return Promise.reject(err);
		}
	}

	return Promise.resolve();
}

async function handleExport2() {
	try {
		// 获取双 CSV 数据
		let response = await service.app.bsr_candidate.exportData2();

		// 解析竞品数据
		const taskRows = response.csvData
			.split("\n")
			.filter((row) => row.trim())
			.map((row) => row.split(","));

		// 解析部门数据
		const departmentRows = response.departmentCsv
			.split("\n")
			.filter((row) => row.trim())
			.map((row) => row.split(","));

		// 创建 Excel 工作簿
		const wb = XLSX.utils.book_new();

		// 竞品数据工作表
		const taskWs = XLSX.utils.aoa_to_sheet(taskRows);
		XLSX.utils.book_append_sheet(wb, taskWs, "Sheet1");

		// 部门数据工作表
		const departmentWs = XLSX.utils.aoa_to_sheet(departmentRows);
		XLSX.utils.book_append_sheet(wb, departmentWs, "Sheet2");

		// 导出文件
		XLSX.writeFile(wb, "export_data2.xlsx");
	} catch (error) {
		console.error("导出错误:", error);
		ElMessage.error("导出失败，请检查接口");
	}
}

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
	openProductLinks2(row.asin_competitor);
}

function openProductLinks3(row: any) {
	const asin = row.asin_competitor || row.asin;
	const cleanAsin = asin.replace(/[^A-Z0-9]/g, "");
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, row.marketplace);
	window.open(dpUrl);
}

async function onSubmit3(data: any, helpers: any = {}) {
	const BATCH_SIZE = 1000;
	const total = data.list.length;
	let successCount = 0;
	const failedItems: any[] = [];

	const {
		done = () => {},
		close = () => {},
		setProgress = (current: number, total: number) => {
			console.log(`Progress: ${current}/${total}`);
		}
	} = helpers;

	// 初始化进度
	setProgress(0, total);

	// 前置处理：字段映射 + 标记核心商品
	const processedList = data.list.map((item: any) => ({
		...flexibleMapping2(item),
		status: 3,
		competitor_spider_status: 0
	}));
	// markTop10ByAsin(processedList);

	try {
		for (let i = 0; i < processedList.length; i += BATCH_SIZE) {
			const batch = processedList.slice(i, i + BATCH_SIZE);

			try {
				await service.app.keyword.add2(batch); // 根据实际接口调整
				successCount += batch.length;
				setProgress(successCount, total);
			} catch (err) {
				failedItems.push(...batch);
				console.error(`批次 ${i / BATCH_SIZE + 1} 失败`, err);
			}
		}

		if (failedItems.length === 0) {
			// 生成需要更新状态的列表（存在ASIN则更新）
			const updateList = Array.from(
				new Set(
					processedList
						.filter(
							(item): item is { asin: string; marketplaces: string } =>
								Boolean(item.asin) // 只要存在ASIN即更新
						)
						.map((item) => `${item.asin}|${item.marketplaces}`) // 保持与国家组合
				) as Set<string>
			).map((str) => {
				const [asin, marketplace] = str.split("|") as [string, string];
				return { asin, marketplace };
			});

			// 调用批量状态更新
			if (updateList.length > 0) {
				await service.app.bsr_candidate.batch_update_status({
					field: "keyword_import_status" as const, // 指定更新字段
					status: 1, // 设置状态值
					items: updateList
				});
			}

			ElMessage.success(`成功导入全部 ${total} 条数据`);
			close();
		} else {
			ElMessage.warning(`成功导入 ${successCount} 条，失败 ${failedItems.length} 条`);
			done({ failedItems });
		}
	} catch (err: any) {
		ElMessage.error(err.message || "导入异常");
		done();
	}
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

async function handleExport3() {
	try {
		// 发起请求
		const response = await service.app.bsr_candidate.exportCompetitors();

		// 检查响应数据
		if (!response) {
			ElMessage.error("导出失败，服务器未返回数据");
			return;
		}

		// 创建Blob
		const blob = new Blob([response], {
			type: "text/csv;charset=utf-8;"
		});

		// 创建下载链接
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `competitors_${dayjs().format("YYYY-MM")}.csv`;

		// 触发下载
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		// 释放资源
		URL.revokeObjectURL(link.href);
	} catch (error) {
		console.error("导出失败:", error);
	}
}
const exporting4 = ref(false);
const exporting5 = ref(false);

async function handleExport4() {
	try {
		exporting4.value = true; // 开始加载
		const response = await service.app.bsr_candidate.exportRecommendationData();
		if ("ok" === response) {
			ElMessage.success("获取成功");
			Crud.value?.refresh();
		} else {
			ElMessage.error("获取失败，请重试。");
		}
	} catch (error) {
		ElMessage.success("获取成功");
	} finally {
		exporting4.value = false; // 结束加载
	}
}

async function handleExport5() {
	try {
		exporting5.value = true; // 开始加载
		const response = await service.app.bsr_candidate.exportSearchResultData();
		if ("ok" === response) {
			ElMessage.success("获取成功");
			Crud.value?.refresh();
		} else {
			ElMessage.error("获取失败，请重试。");
		}
	} catch (error) {
		ElMessage.success("获取成功");
	} finally {
		exporting5.value = false; // 结束加载
	}
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

const getCountryName = (input: string): Country | undefined => {
	if ((countries as readonly string[]).includes(input)) return input as Country;
	const entry = Object.entries(countryCodeMap).find(([_, code]) => code === input);
	return entry ? (entry[0] as Country) : undefined;
};

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

function handleComponentTypeChange(item: any, scope: any) {
	// 当选择"主体"类型且用户未手动修改过品名时，自动设置品名为产品名称
	if (item.componentType === "firstMain" || item.componentType === "main") {
		item.name = scope.produce_name || "";
	}
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

const updateStockQuantity = async () => {
	try {
		const response = await service.app.bsr_candidate_competitor.updateStockQuantity();
		// 基于响应状态显示不同提示
		ElMessage.success("更新成功");
		Crud.value?.refresh();
	} catch (err) {
		ElMessage.error("更新失败: " + JSON.stringify(err.message));
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
	// 移除所有非字母数字字符（保留大写字母和数字）
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

async function onSubmit4(data: any, { close }: any) {
	// 1. 数据映射和默认值注入
	const newList = data.list.map((item: any, index: number) => {
		let newItem = flexibleMapping4(item);
		// 注入默认值
		newItem.status = 6;
		newItem.competitor_spider_status = 0;
		return newItem;
	});

	// 2. 必填项校验（ASIN、国家、数据来源、产品名称）
	const errorMessages: string[] = [];
	newList.forEach((item: any, index: number) => {
		const rowNum = index + 1; // 行号从1开始，符合用户认知
		const trimVal = (val: any) => val?.toString().trim() || "";

		// 校验ASIN
		if (!trimVal(item.asin)) {
			errorMessages.push(`第${rowNum}行：ASIN不能为空`);
		}
		// 校验国家（映射后的marketplace字段）
		if (!trimVal(item.marketplace)) {
			errorMessages.push(`第${rowNum}行：国家不能为空`);
		}
		// 校验数据来源（映射后的source字段）
		if (!trimVal(item.source)) {
			errorMessages.push(`第${rowNum}行：数据来源不能为空`);
		}
		// 校验产品名称（映射后的produce_name字段）
		if (!trimVal(item.produce_name)) {
			errorMessages.push(`第${rowNum}行：产品名称不能为空`);
		}
	});

	// 3. 校验失败处理
	if (errorMessages.length > 0) {
		// 使用弹窗展示完整的错误信息（比单行提示更清晰）
		ElMessageBox.alert(
			`### 数据校验失败，请修正后重新导入：<br/>${errorMessages.join("<br/>")}`,
			"导入校验失败",
			{
				dangerouslyUseHTMLString: true,
				confirmButtonText: "确定",
				type: "error",
				width: "500px"
			}
		);
		return; // 终止提交流程
	}

	const canSubmit = await confirmRestoreArchivedCandidates(newList);
	if (!canSubmit) return;

	// 4. 校验通过，执行分批提交
	batchSubmit4(newList, 100)
		.then(() => {
			ElMessage.success("所有数据已成功导入");
			close();
		})
		.catch(() => {
			ElMessage.error("部分数据导入失败");
		});
}

function flexibleMapping4(item: any) {
	// 定义中文字段与英文字段的映射关系
	const mapping: Record<string, string> = {
		ASIN: "asin",
		标题: "item_name",
		img_url: "image_url",
		国家: "marketplace",
		产品名称: "produce_name",
		来源: "source",
		SKU: "sku",
		成本价: "cost",
		长: "length",
		宽: "width",
		高: "height",
		重量: "actual_weight",
		开发人区分: "distinguish"
	};

	const newItem: any = {};
	// 遍历映射关系，若上传数据中包含中文字段，则赋值到对应的英文字段
	Object.keys(mapping).forEach((chineseKey) => {
		if (item.hasOwnProperty(chineseKey)) {
			newItem[mapping[chineseKey]] = item[chineseKey];
		}
	});

	if (newItem.image_url) {
		// 使用正则表达式匹配 _AC_US 后接数字的部分，统一替换为 _AC_US1000
		newItem.image_url = newItem.image_url.replace(/_AC_US\d+/g, "_AC_US1000");
		newItem.image_url = newItem.image_url.replace(/SS40+/g, "SS1000");
		newItem.image_url = newItem.image_url.replace(/_AC_SR\d+,?\d*/g, "_AC_SR1000,1000");
		newItem.image_url = newItem.image_url.replace(
			/_SX\d+_SY\d+_CR[^_]*_/,
			"_SX1000_SY1000_CR,0,0,1000,1000_"
		);
		newItem.image_url = newItem.image_url.replace(",", ".");
		newItem.aliyun_img = newItem.image_url;
	}
	if (newItem.source == "数据选品") {
		newItem.source = "1";
	} else if (newItem.source == "1688选品") {
		newItem.source = "2";
	} else if (newItem.source == "新增变体") {
		newItem.source = "3";
	} else if (newItem.source == "季节性产品") {
		newItem.source = "4";
	}
	// 另外，如果数据中本身已经存在英文字段，也一并保留
	Object.values(mapping).forEach((key) => {
		if (!newItem[key] && item.hasOwnProperty(key)) {
			newItem[key] = item[key];
		}
	});
	return newItem;
}
async function batchSubmit4(dataList: any[], batchSize = 100) {
	// 按 batchSize 拆分数据
	const batches: any[][] = [];
	for (let i = 0; i < dataList.length; i += batchSize) {
		batches.push(dataList.slice(i, i + batchSize));
	}

	console.log(`共分成 ${batches.length} 批次提交`);
	// 记录失败的批次
	const failedBatches: number[] = [];

	for (let index = 0; index < batches.length; index++) {
		const batch = batches[index];
		const batchNum = index + 1;

		try {
			console.log(`正在提交第 ${batchNum} 批数据，共 ${batch.length} 条`);
			await service.app.bsr_candidate.add3(batch);
			console.log(`第 ${batchNum} 批数据提交&阿里云上传启动成功`);
		} catch (err: any) {
			console.error(`第 ${batchNum} 批提交失败:`, err);
			ElMessage.error(`第 ${batchNum} 批提交失败: ${err.message || "未知错误"}`);
			failedBatches.push(batchNum);
		}
	}

	// 最终结果提示
	if (failedBatches.length > 0) {
		ElMessage.error(`共 ${failedBatches.length} 个批次提交失败：${failedBatches.join(", ")}`);
		return Promise.reject(new Error(`批次 ${failedBatches.join(", ")} 提交失败`));
	} else {
		return Promise.resolve();
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

const setInventoryStatus = async () => {
	try {
		const selectedRows = Table.value?.getSelectionRows();
		if (!selectedRows || selectedRows.length === 0) {
			ElMessage.warning("请先选择要设置为待获取库存的数据");
			return;
		}

		const ids = selectedRows.map((row) => row.id);
		try {
			const res = await service.app.bsr_candidate.setInventoryStatus({ ids });
			ElMessage.success(res.message || `成功设置 ${ids.length} 条数据`);
			// 清空选择
			Table.value?.clearSelection();

			Crud.value?.refresh();
		} catch (e) {
			ElMessage.error("批量配对失败");
			console.error(e);
		}
	} catch (e) {
		ElMessage.error("操作失败");
		console.error(e);
	}
};

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

// 竞品任务状态管理（移除定时器相关变量）
const isCompetitorTaskRunning = ref(false); // 是否正在执行
const lastCompetitorTaskStatus = ref(""); // Finished/Failed/''
const competitorTaskProgress = ref(""); // 新增：进度文本（如 319/884条）

async function getCompetitor() {
	try {
		// 重置所有状态
		isCompetitorTaskRunning.value = true;
		lastCompetitorTaskStatus.value = "";
		competitorTaskProgress.value = ""; // 重置进度显示

		// 调用后端启动任务
		const res = await service.app.bsr_candidate.getCompetitor();
		console.log("竞品任务启动结果:", res);
		ElMessage.success("获取竞品详情任务已启动");
	} catch (err: any) {
		console.error("竞品任务启动失败:", err);
		ElMessage.error(`启动失败: ${err.message || "未知错误"}`);
		// 重置状态
		isCompetitorTaskRunning.value = false;
		lastCompetitorTaskStatus.value = "Failed";
		competitorTaskProgress.value = ""; // 失败时清空进度
	}
}

// 统一刷新任务状态
async function fetchTaskStatus() {
	try {
		ElMessage({ message: "正在刷新任务状态...", type: "info", duration: 1000 });
		// 调用后端统一的任务状态查询接口
		const res = await service.app.amazon_product_Listing_Lingxing.getLatestTaskStatus();
		const newStatus = res;

		// 提取竞品任务状态并更新
		if (newStatus.competitorTask) {
			const task = newStatus.competitorTask;

			// 1. 更新进度文本（核心：已完成条数/总条数）
			if (task.totalCount) {
				competitorTaskProgress.value = `${task.completedCount || 0}/${task.totalCount}条`;
			} else {
				competitorTaskProgress.value = "";
			}

			// 2. 修正状态判断（后端返回首字母大写：Running/Finished/Failed）
			switch (task.taskStatus) {
				case "Running": // 原错误：RUNNING（全大写），改为和后端一致的Running
					isCompetitorTaskRunning.value = true;
					lastCompetitorTaskStatus.value = "";
					break;
				case "Finished": // 原错误：FINISHED
					isCompetitorTaskRunning.value = false;
					lastCompetitorTaskStatus.value = "Finished";
					break;
				case "Failed": // 原错误：FAILED
					isCompetitorTaskRunning.value = false;
					lastCompetitorTaskStatus.value = "Failed";
					ElMessage.warning(`竞品任务状态：${task.executeResult || "执行失败"}`);
					break;
			}
		} else {
			// 无竞品任务时清空进度
			competitorTaskProgress.value = "";
		}

		ElMessage({ message: "任务状态已更新", type: "success", duration: 1000 });
	} catch (error) {
		console.error("获取任务状态失败:", error);
		ElMessage.error("刷新任务状态失败，请重试");
		competitorTaskProgress.value = ""; // 刷新失败时清空进度
	}
}
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

.proportion-container {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 8px;
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

	/* 添加以下样式 */
	.proportion-container {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 8px;
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

.exporting-button {
	background-color: #f56c6c !important;
	border-color: #f56c6c !important;
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
