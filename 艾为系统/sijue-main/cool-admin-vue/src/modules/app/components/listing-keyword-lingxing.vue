<template>
	<cl-crud ref="Crud">
		<template v-if="listing">
			<cl-row>
				<listing-description :listing="listing"></listing-description>
			</cl-row>
		</template>

		<el-divider>关键词列表</el-divider>
		<cl-row>
			<el-button @click="handleRefresh" :loading="refreshLoading">刷新</el-button>
			<el-tooltip content="调用 SIF 更新月搜索量和搜索趋势，当前月缺失时会用周数据补充" placement="top">
				<span>
					<el-button
						type="primary"
						:loading="syncLoading"
						:disabled="!Table?.selection?.length"
						@click="handleFetchSearchHistory"
					>
						更新选中词趋势
					</el-button>
				</span>
			</el-tooltip>
			<el-dropdown
				trigger="click"
				:disabled="translateLoading || !Table?.selection?.length"
				@command="(language) => handleBatchTranslate(String(language))"
			>
				<el-button
					type="warning"
					:loading="translateLoading"
					:disabled="!Table?.selection?.length"
				>
					批量重译选中项{{ Table?.selection?.length ? ` (${Table.selection.length})` : '' }}
				</el-button>
				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item
							v-for="item in translateLanguageOptions"
							:key="item.value"
							:command="item.value"
						>
							{{ item.label }}
						</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
			<el-button
				type="success"
				:loading="batchTrackingLoading"
				:disabled="!Table?.selection?.length"
				@click="handleBatchStartTracking"
			>
				批量开启跟踪
			</el-button>
			<el-button
				type="info"
				plain
				:loading="batchStopTrackingLoading"
				:disabled="!Table?.selection?.length"
				@click="handleBatchStopTracking"
			>
				批量关闭跟踪
			</el-button>
			<el-button
				type="danger"
				plain
				:loading="deleteLoading"
				:disabled="!Table?.selection?.length"
				@click="handleBatchDelete"
			>
				批量删除
			</el-button>
			<el-tooltip content="输入竞品ASIN，批量获取关键词并导入" placement="top">
				<el-button
					type="primary"
					plain
					@click="manualAsinDialogVisible = true"
				>
					asin反查
				</el-button>
			</el-tooltip>
			<el-tooltip content="导出选中关键词为Excel，未选中则导出全部" placement="top">
				<el-button
					type="warning"
					plain
					:loading="exportLoading"
					@click="handleExportExcel"
				>
					导出{{ Table?.selection?.length ? ` (${Table.selection.length})` : '' }}
				</el-button>
			</el-tooltip>
			<cl-flex1 />
			<div style="margin-right: 15px;">
				<el-radio-group v-model="keyword_filter_type" size="default">
					<el-radio-button label="all">全部</el-radio-button>
					<el-radio-button label="tracked">我跟踪的</el-radio-button>
					<el-radio-button label="mine">我入库的</el-radio-button>
					<el-radio-button label="default">我的默认</el-radio-button>
					<el-radio-button label="others">他人入库</el-radio-button>
				</el-radio-group>
			</div>
			<cl-search-key />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-value="{ scope }">
					<div style="display: flex; flex-direction: column; gap: 4px">
						<el-link
							target="_blank"
							:underline="false"
							:href="
								appConfig.get_amazon_url_keyword_search(
									scope.row.value,
									scope.row.marketplaces
								)
							"
							style="justify-content: flex-start; font-weight: bold; font-size: 14px"
						>
							{{ scope.row.value }}
						</el-link>
						<div style="display: flex; gap: 4px; align-items: center" v-if="scope.row.is_default">
							<el-tag size="small" type="warning" effect="dark" round style="transform: scale(0.85); transform-origin: left center;">
								默认
							</el-tag>
						</div>
					</div>
				</template>

				<template #column-value_cn="{ scope }">
					<div class="keyword-translation-cell">
						<div class="keyword-translation-text">
							<span>{{ scope.row.value_cn || '-' }}</span>
							<el-tag size="small" type="info" effect="plain">
								{{ getRowTranslateLanguageLabel(scope.row) }}
							</el-tag>
						</div>
						<div class="keyword-translation-actions">
							<el-dropdown
								trigger="click"
								:disabled="translatingRowId === scope.row.id"
								@command="(language) => handleSingleTranslate(scope.row, String(language))"
							>
								<el-button
									link
									type="primary"
									size="small"
									:loading="translatingRowId === scope.row.id"
								>
									重译
								</el-button>
								<template #dropdown>
									<el-dropdown-menu>
										<el-dropdown-item
											v-for="item in translateLanguageOptions"
											:key="item.value"
											:command="item.value"
										>
											{{ item.label }}
										</el-dropdown-item>
									</el-dropdown-menu>
								</template>
							</el-dropdown>
							<el-button
								link
								type="primary"
								size="small"
								@click="openTranslationEdit(scope.row)"
							>
								编辑
							</el-button>
						</div>
					</div>
				</template>

				<template #column-sif_score="{ scope }">
					<span style="font-weight: 600; color: #E6A23C;">
						{{ scope.row.sif_score != null ? Number(scope.row.sif_score).toFixed(2) : '-' }}
					</span>
				</template>

				<template #column-search_volume_data="{ scope }">
					<el-button
						size="small"
						v-if="!!scope.row.sif_search_history"
						@click="
							jsonViewerContent = JSON.stringify(
								scope.row.sif_search_history,
								null,
								2
							);
							jsonViewerDialogVisible = true;
						"
					>
						查看 {{ scope.row.sif_search_history?.length }}
					</el-button>
					<template v-else>暂无</template>
				</template>

				<template #column-search_volume_chart="{ scope }">
					<template v-if="scope.row.sif_search_history">
						<el-popover
							placement="right"
							title="关键词搜索量走势"
							:width="400"
							trigger="hover"
						>
							<template #reference>
								<el-button plain circle size="default">
									<el-icon>
										<data-line />
									</el-icon>
								</el-button>
							</template>
							<template #default>
								<v-chart
									:option="
										generateKeywordSearchVolumeChartOption(
											scope.row.sif_search_history
										)
									"
									style="height: 200px"
									autoresize
								></v-chart>
							</template>
						</el-popover>
					</template>
					<template v-else>暂无</template>
				</template>

				<template #column-sif_search_history_update_time="{ scope }">
					<span>{{ formatSearchHistoryUpdateTime(scope.row.sif_search_history_update_time) }}</span>
				</template>

				<template #slot-op="{ scope }">
					<div style="display: flex; gap: 5px; flex-wrap: nowrap">

						<el-button
							v-if="!scope.row._is_tracking"
							type="primary"
							size="small"
							@click="handleStartTracking(scope.row)"
						>
							开启跟踪
						</el-button>
						<el-button
							v-else
							type="info"
							size="small"
							@click="handleStopTracking(scope.row)"
						>
							关闭跟踪
						</el-button>
						<el-button
							v-if="scope.row.is_default"
							type="danger"
							size="small"
							@click="handleRemoveDefaultKeyword(scope.row)"
						>
							取消默认
						</el-button>
						<el-button
							v-else-if="currentDefaultKeywordCount < 3 && scope.row.status === 3"
							type="success"
							size="small"
							@click="handleAddDefaultKeyword(scope.row)"
						>
							设为默认
						</el-button>
						<el-button
							type="danger"
							size="small"
							plain
							@click="handleDeleteKeywords([scope.row], scope.row.value)"
						>
							删除
						</el-button>
					</div>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert" />

		<el-dialog v-model="translationEditVisible" title="编辑中文翻译" width="520" align-center draggable>
			<el-form label-width="90px">
				<el-form-item label="关键词">
					<span>{{ translationEditRow?.value || '-' }}</span>
				</el-form-item>
				<el-form-item label="国家">
					<span>{{ translationEditRow?.marketplaces || props.listing?.marketplace || '-' }}</span>
				</el-form-item>
				<el-form-item label="中文翻译">
					<el-input
						v-model="translationEditValue"
						type="textarea"
						:rows="3"
						clearable
						placeholder="请输入中文翻译"
					/>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="translationEditVisible = false">取消</el-button>
				<el-button type="primary" :loading="translationEditSaving" @click="saveTranslationEdit">
					保存
				</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="batchImportDialogVisible" align-center draggable width="500">
			<template #header>批量添加</template>
			<template #default>
				<el-space fill style="width: 100%">
					<!-- 新增的国家选择器 -->
					<el-select
						v-model="importMarketplace"
						placeholder="选择国家"
						clearable
						style="margin-bottom: 15px; width: 100%"
					>
						<el-option
							v-for="country in countryOptions"
							:key="country.value"
							:label="country.label"
							:value="country.value"
						/>
					</el-select>

					<el-alert type="info" show-icon :closable="false">
						请输入若干个关键词条，一行一个。<br />
						完全一致的关键词条不会被重复添加到系统中。
					</el-alert>
					<el-input
						type="textarea"
						:rows="10"
						resize="vertical"
						:autosize="{ minRows: 10, maxRows: 30 }"
						v-model="importingKeywordsInput"
					></el-input>
				</el-space>
			</template>
			<template #footer>
				<el-button @click="batchImportDialogVisible = false">取消</el-button>
				<el-button type="primary" @click="importKeywords()">确认导入</el-button>
			</template>
		</el-dialog>

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

		<!-- 手动输入竞品ASIN弹窗 -->
		<el-dialog v-model="manualAsinDialogVisible" title="手动输入竞品ASIN" width="600" align-center draggable :close-on-click-modal="false">
			<el-alert type="info" show-icon :closable="false" style="margin-bottom: 16px">
				ASIN格式：10位字母数字组成（如 B0DM1SXB7G）。<br/>
				支持两种输入方式：① 逐个输入按回车 ② 批量粘贴后点击识别
			</el-alert>

			<!-- 方式1：逐个输入 -->
			<div style="margin-bottom: 12px">
				<div style="font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 6px">逐个输入</div>
				<el-input
					v-model="manualAsinInputText"
					placeholder="输入ASIN后按回车添加，例如 B0DM1SXB7G"
					@keydown.enter.prevent="addManualAsin"
					clearable
				/>
			</div>

			<!-- 方式2：批量粘贴 -->
			<div style="margin-bottom: 12px">
				<div style="font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 6px">批量粘贴</div>
				<el-input
					type="textarea"
					v-model="manualAsinBulkText"
					:rows="4"
					resize="vertical"
					placeholder="粘贴多个ASIN，支持换行、逗号、空格分隔&#10;B0DM1SXB7G&#10;B0DZWVFWT6&#10;B0CR14S8JB"
				/>
				<el-button size="small" type="primary" plain style="margin-top: 8px" @click="parseBulkAsins" :disabled="!manualAsinBulkText?.trim()">
					识别并添加
				</el-button>
			</div>

			<!-- 已识别的ASIN标签 -->
			<el-divider style="margin: 12px 0" />
			<div v-if="manualAsinTags.length > 0">
				<div style="font-size: 13px; color: #909399; margin-bottom: 8px">
					已添加 <span style="color: #409EFF; font-weight: 600">{{ manualAsinTags.length }}</span> 个ASIN
				</div>
				<div style="display: flex; flex-wrap: wrap; gap: 8px">
					<el-tag
						v-for="asin in manualAsinTags"
						:key="asin"
						closable
						type="primary"
						effect="light"
						round
						@close="removeManualAsin(asin)"
						style="font-family: monospace; font-size: 13px"
					>
						{{ asin }}
					</el-tag>
				</div>
			</div>
			<div v-else style="text-align: center; padding: 20px 0; color: #C0C4CC; font-size: 13px">
				暂无ASIN，请在上方输入或粘贴
			</div>
			<template #footer>
				<el-button @click="manualAsinDialogVisible = false">取消</el-button>
				<el-button type="primary" :disabled="manualAsinTags.length === 0" @click="handleManualAsinConfirm">
					确认查询 ({{ manualAsinTags.length }})
				</el-button>
			</template>
		</el-dialog>

		<!-- 关键词查询结果面板（复用已有组件） -->
		<batch-keyword-result
			v-model:visible="manualKeywordResultVisible"
			:asin="props.listing?.asin || ''"
			:product-code="props.listing?.product_code || ''"
			:marketplaces="props.listing?.marketplace || ''"
			:competitor-asins="manualCompetitorAsins"
			@saved="() => Crud?.refresh()"
		/>

	</cl-crud>
</template>

<script lang="ts" name="app-listing-keyword" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { computed, h, ref, watch, nextTick } from "vue";
import { ElLoading, ElMessage, ElMessageBox } from "element-plus";
import ListingDescription from "/$/app/components/listing-description.vue";
import BatchUpdateKeywordStatus from "/$/app/components/batch-update-keyword-status.vue";
import BatchKeywordResult from "/$/app/components/BatchKeywordResult.vue";
import { useUserStore } from "/$/base/store/user";
import ClDialog from "/~/crud/src/components/dialog";
import { DataLine, Picture } from "@element-plus/icons-vue";
import { generateKeywordSearchVolumeChartOption } from "/$/app/utils";
import KeywordFilterStatus from "/$/app/components/keyword-filter-status.vue";
import DuplicatorForKeywordOrCompetitor from "/$/app/components/duplicator-for-keyword-or-competitor.vue";
import { appConfig } from "../../../../../appConfig";
import { convert_image_url } from "/$/app/utils";
import dayjs from "dayjs";
import { export_json_to_excel } from "/@/plugins/excel/utils";

const { service } = useCool();

const props = defineProps(["listing"]);

const userStore = useUserStore();
const is_admin = computed(() => {
	return "admin" === userStore.info?.username;
});

const normalizeTrackingKeyPart = (value: any) => value == null ? '' : String(value).trim();
const getListingStoreId = () => props.listing?.store_id ?? props.listing?.sid ?? null;
const getListingMsku = () => props.listing?.msku ?? props.listing?.seller_sku ?? null;
const getTrackingKey = (row: any) => [
	normalizeTrackingKeyPart(row.store_id),
	normalizeTrackingKeyPart(row.marketplace),
	normalizeTrackingKeyPart(row.product_code),
	normalizeTrackingKeyPart(row.asin_self),
	normalizeTrackingKeyPart(row.msku),
	normalizeTrackingKeyPart(row.keyword_value),
].join('\u0001');

const Crud = useCrud(
	{
		service: service.app.sifKeyword,

		async onRefresh(params, { next, done, render }) {
			// 所有 tab 默认只看已入库(status=3)
			if (params.status === undefined) {
				Object.assign(params, { status: 3 });
			}

			// 使用新的 keywordPage 接口，按 asin + product_code + marketplaces 查询
			const result = await service.app.sifKeyword.keywordPage({
				...params,
				filter_type: keyword_filter_type.value,
				asin: props.listing?.asin,
				product_code: props.listing?.product_code,
				marketplaces: props.listing?.marketplace,
				store_id: getListingStoreId(),
				msku: getListingMsku(),
			});

			const list = result?.list || [];
            
            // 优先使用后端默认数量，避免只统计当前页导致按钮状态不准
            let defCount = 0;
			const processedList = list.map((item: any) => {
                if (item.is_default) defCount++;
                return {
                    ...item,
                    keyword_type: item.keyword_type != null ? item.keyword_type : null,
                    _is_tracking: false,
                    _tracking_id: null,
                };
            });
            currentDefaultKeywordCount.value = Number(result?.defaultCount ?? defCount);

			// 加载后查询跟踪状态
			try {
				const trackingIdentityBase = {
					store_id: getListingStoreId(),
					marketplace: props.listing?.marketplace || '',
					product_code: props.listing?.product_code || '',
					asin_self: props.listing?.asin || '',
					msku: getListingMsku(),
				};
				const trackingQuery: any = {
					marketplace: trackingIdentityBase.marketplace,
					product_code: trackingIdentityBase.product_code,
					asin_self: trackingIdentityBase.asin_self,
					status: 1,
					size: 200,
					page: 1,
				};
				if (trackingIdentityBase.store_id != null) trackingQuery.store_id = trackingIdentityBase.store_id;
				if (trackingIdentityBase.msku != null) trackingQuery.msku = trackingIdentityBase.msku;
				const trackingRes = await service.app.bsr_keyword_tracking.page(trackingQuery);
				const trackingMap = new Map<string, number>();
				for (const t of (trackingRes?.list || [])) {
					trackingMap.set(getTrackingKey(t), t.id!);
				}
				for (const row of processedList) {
					const tid = trackingMap.get(getTrackingKey({
						...trackingIdentityBase,
						keyword_value: row.value,
					}));
					if (tid) {
						row._is_tracking = true;
						row._tracking_id = tid;
					}
				}
			} catch (e) {
				console.warn('加载跟踪状态失败', e);
			}

			render(processedList, result?.pagination);
		}
	},
	(app) => {
		app.refresh({
			size: 50,
			order: 'sif_score',
			sort: 'desc',
		});
	}
);

watch(props, () => {
	Crud.value?.refresh();
});

const keyword_filter_type = ref('all'); // 默认显示全部
watch([keyword_filter_type], () => setTimeout(() => Crud.value?.refresh(), 200));

// 记录当前页面默认关键词的数量（用于控制是否还能继续设为默认）
const currentDefaultKeywordCount = ref(0);

// API 交互操作
const handleAddDefaultKeyword = async (row: any) => {
	try {
        // 先拉取最新的默认关键字配置
        const fetchRes = await service.app.sifKeyword.getUserDefaultKeywords({
            asin: props.listing?.asin,
            product_code: props.listing?.product_code,
            marketplaces: props.listing?.marketplace,
        });

        const currentIds = fetchRes?.isCustom ? (fetchRes?.keywords?.map((k: any) => k.id) || []) : [];
        if (currentIds.length >= 3) {
            ElMessage.warning('默认关键词最多只能设置3个');
            return;
        }

        const newIds = [...new Set([...currentIds, row.id])];
        
        await service.app.sifKeyword.setUserDefaultKeywords({
            asin: props.listing?.asin,
            product_code: props.listing?.product_code,
            marketplaces: props.listing?.marketplace,
            keyword_ids: newIds,
        });
        
        ElMessage.success('已设为默认');
        Crud.value?.refresh();
	} catch (err: any) {
		ElMessage.error(err?.message || '设置失败');
	}
};

const handleRemoveDefaultKeyword = async (row: any) => {
	try {
        const fetchRes = await service.app.sifKeyword.getUserDefaultKeywords({
            asin: props.listing?.asin,
            product_code: props.listing?.product_code,
            marketplaces: props.listing?.marketplace,
        });

        const currentIds = fetchRes?.isCustom ? (fetchRes?.keywords?.map((k: any) => k.id) || []) : [];
        const newIds = currentIds.filter((id: number) => id !== row.id);
        
        await service.app.sifKeyword.setUserDefaultKeywords({
            asin: props.listing?.asin,
            product_code: props.listing?.product_code,
            marketplaces: props.listing?.marketplace,
            keyword_ids: newIds,
        });
        
        ElMessage.success('已取消默认');
        Crud.value?.refresh();
	} catch (err: any) {
		ElMessage.error(err?.message || '取消失败');
	}
};

// ========== 删除关键词 ==========
const deleteLoading = ref(false);

const buildDeleteTrackingScope = () => ({
	marketplace: props.listing?.marketplace || '',
	product_code: props.listing?.product_code || '',
	asin_self: props.listing?.asin || '',
	store_id: getListingStoreId(),
	msku: getListingMsku(),
});

const getDeleteTrackingCount = (rows: any[]) => {
	return rows.filter((row: any) => row?._is_tracking).length;
};

const buildDeleteConfirmContent = (
	rows: any[],
	displayName: string,
	trackingCount: number
) => {
	const deleteCount = rows.length;
	return h('div', { style: 'line-height: 1.7; color: #303133;' }, [
		h('div', { style: 'font-weight: 600;' }, `确定要删除「${displayName}」吗？`),
		h('div', { style: 'margin-top: 8px;' }, `将永久删除 ${deleteCount} 个关键词，并从所有用户的默认配置中移除这些关键词。`),
		trackingCount > 0
			? h('div', { style: 'margin-top: 8px; color: #e6a23c;' }, `检测到其中 ${trackingCount} 个正在被你跟踪，删除后会同时关闭你在当前 Listing 下的对应跟踪，历史数据保留。`)
			: h('div', { style: 'margin-top: 8px; color: #909399;' }, '当前页未检测到你的跟踪；后端仍会按当前 Listing 校验，只关闭你的匹配跟踪。'),
		h('div', { style: 'margin-top: 8px; color: #909399;' }, '不会关闭其他用户的跟踪。'),
	]);
};

// 批量删除（表头按钮）
const handleBatchDelete = () => {
	const selected = Table.value?.selection || [];
	if (selected.length === 0) {
		ElMessage.warning('请先勾选需要删除的关键词');
		return;
	}
	const names = selected.map((row: any) => row.value).slice(0, 5).join('、');
	const suffix = selected.length > 5 ? ` 等 ${selected.length} 个` : '';
	handleDeleteKeywords(selected, names + suffix);
};

// 执行删除（单个 / 批量通用）
const handleDeleteKeywords = async (rows: any[], displayName: string) => {
	const ids = rows.map((row: any) => row.id).filter(Boolean);
	if (ids.length === 0) {
		ElMessage.warning('缺少关键词ID，无法删除');
		return;
	}

	const trackingCount = getDeleteTrackingCount(rows);
	try {
		await ElMessageBox.confirm(
			buildDeleteConfirmContent(rows, displayName, trackingCount),
			'确认删除',
			{
				confirmButtonText: '确认删除',
				cancelButtonText: '取消',
				type: 'warning',
			}
		);
	} catch {
		return; // 用户取消
	}

	deleteLoading.value = true;
	try {
		const res = await service.request({
			url: '/admin/app/sifKeyword/deleteKeywords',
			method: 'POST',
			data: {
				ids,
				tracking_scope: buildDeleteTrackingScope(),
			},
		});
		if (res) {
			let msg = `已删除 ${res.deleted_count} 个关键词`;
			if (Number(res.tracking_stopped_count || 0) > 0) {
				msg += `，取消跟踪 ${res.tracking_stopped_count} 条`;
			}
			if (res.configs_cleaned > 0 || res.configs_deleted > 0) {
				msg += `，清理了 ${res.configs_cleaned + res.configs_deleted} 个用户的默认配置`;
			}
			ElMessage.success(msg);
		}
		Crud.value?.refresh();
	} catch (err: any) {
		ElMessage.error(err?.message || '删除失败');
	} finally {
		deleteLoading.value = false;
	}
};

// ========== 开启关键词跟踪 ==========
const handleStartTracking = async (row: any) => {
	try {
		const res = await service.app.bsr_keyword_tracking.startTracking({
			keyword_id: row.id,
			keyword_value: row.value,
			marketplace: props.listing?.marketplace || '',
			product_code: props.listing?.product_code || '',
			asin_self: props.listing?.asin || '',
			listing_id: props.listing?.id || null,
			msku: getListingMsku(),
			store_id: getListingStoreId(),
		});
		if (res?.action === 'reactivated') {
			ElMessage.success(`已重新开启跟踪「${row.value}」`);
		} else {
			ElMessage.success(`已开启跟踪「${row.value}」`);
		}
		Crud.value?.refresh();
	} catch (err: any) {
		ElMessage.error(err?.message || '开启跟踪失败');
	}
};

// ========== 批量开启关键词跟踪 ==========
const batchTrackingLoading = ref(false);

function getBatchTrackingResultType(res: any): 'success' | 'warning' | 'error' {
	if (Number(res?.success || 0) > 0 && Number(res?.failed || 0) === 0) return 'success';
	if (Number(res?.success || 0) > 0) return 'warning';
	return 'error';
}

function getBatchTrackingResultTitle(res: any) {
	const type = getBatchTrackingResultType(res);
	if (type === 'success') return '批量开启跟踪完成';
	if (type === 'warning') return '批量开启跟踪部分完成';
	return '批量开启跟踪失败';
}

function buildBatchTrackingResultContent(res: any) {
	const success = Number(res?.success || 0);
	const skipped = Number(res?.skipped || 0);
	const failed = Number(res?.failed || 0);
	const failedDetails = (res?.details || []).filter((item: any) => item.status === 'failed');
	const reasons = Array.from(new Set(
		failedDetails
			.map((item: any) => item.error)
			.filter(Boolean)
	));

	return h('div', { style: 'line-height: 1.7; color: #303133;' }, [
		h('div', { style: 'font-weight: 600; margin-bottom: 8px;' }, success > 0
			? '本次批量开启跟踪已处理完成。'
			: '本次没有关键词成功开启跟踪。'),
		h('div', `成功：${success} 个`),
		h('div', `跳过：${skipped} 个`),
		h('div', `失败：${failed} 个`),
		success > 0
			? h('div', { style: 'margin-top: 8px; color: #67c23a;' }, '成功开启的关键词，数据采集正在后台进行中。')
			: null,
		failed > 0 && reasons.length > 0
			? h('div', { style: 'margin-top: 12px;' }, [
				h('div', { style: 'font-weight: 600; margin-bottom: 4px;' }, '失败原因：'),
				h('ul', { style: 'margin: 0; padding-left: 18px;' }, reasons.map(reason => h('li', String(reason)))),
			])
			: null,
	]);
}

async function showBatchTrackingResult(res: any) {
	await ElMessageBox.alert(
		buildBatchTrackingResultContent(res),
		getBatchTrackingResultTitle(res),
		{
			confirmButtonText: '知道了',
			type: getBatchTrackingResultType(res),
			showClose: false,
			closeOnClickModal: false,
			closeOnPressEscape: false,
		}
	);
}

const handleBatchStartTracking = async () => {
	const selected = Table.value?.selection || [];
	// 自动过滤掉已在跟踪中的
	const toTrack = selected.filter((row: any) => !row._is_tracking);
	if (toTrack.length === 0) {
		ElMessage.warning('所选关键词均已在跟踪中');
		return;
	}

	try {
		await ElMessageBox.confirm(
			`将为 ${toTrack.length} 个关键词开启跟踪。\n数据采集将在后台自动进行，不影响当前操作。`,
			'批量开启跟踪',
			{ confirmButtonText: '确认开启', cancelButtonText: '取消', type: 'info' }
		);
	} catch { return; }

	batchTrackingLoading.value = true;
	try {
		const items = toTrack.map((row: any) => ({
			keyword_id: row.id,
			keyword_value: row.value,
			marketplace: props.listing?.marketplace || '',
			product_code: props.listing?.product_code || '',
			asin_self: props.listing?.asin || '',
			listing_id: props.listing?.id || null,
			msku: getListingMsku(),
			store_id: getListingStoreId(),
		}));

		const res = await service.app.bsr_keyword_tracking.batchStartTracking({ items });

		await showBatchTrackingResult(res);

		Crud.value?.refresh();
	} catch (err: any) {
		ElMessage.error(err?.message || '批量开启跟踪失败');
	} finally {
		batchTrackingLoading.value = false;
	}
};

// ========== 批量关闭关键词跟踪 ==========
const batchStopTrackingLoading = ref(false);

const handleBatchStopTracking = async () => {
	const selected = Table.value?.selection || [];
	const toStop = selected.filter((row: any) => row._is_tracking && row._tracking_id);
	if (toStop.length === 0) {
		ElMessage.warning('所选关键词均未开启跟踪');
		return;
	}

	try {
		await ElMessageBox.confirm(
			`将关闭 ${toStop.length} 个关键词跟踪，历史数据会保留，确认继续？`,
			'批量关闭跟踪',
			{ confirmButtonText: '确认关闭', cancelButtonText: '取消', type: 'warning' }
		);
	} catch { return; }

	batchStopTrackingLoading.value = true;
	try {
		const ids = toStop.map((row: any) => row._tracking_id);
		const res = await service.app.bsr_keyword_tracking.batchStopTracking({ ids });

		let msg = `批量关闭完成：成功 ${res.success} 个`;
		if (res.skipped > 0) msg += `，跳过 ${res.skipped} 个`;
		ElMessage.success(msg);

		Crud.value?.refresh();
	} catch (err: any) {
		ElMessage.error(err?.message || '批量关闭跟踪失败');
	} finally {
		batchStopTrackingLoading.value = false;
	}
};

// ========== 关闭关键词跟踪 ==========
const handleStopTracking = async (row: any) => {
	try {
		await service.app.bsr_keyword_tracking.stopTracking({
			id: row._tracking_id,
		});
		ElMessage.success(`已关闭跟踪「${row.value}」`);
		Crud.value?.refresh();
	} catch (err: any) {
		ElMessage.error(err?.message || '关闭跟踪失败');
	}
};
// 刷新表格并带有提示框
const refreshLoading = ref(false);
const handleRefresh = async () => {
	refreshLoading.value = true;
	try {
		await Crud.value?.refresh();
		ElMessage.success('列表已刷新至最新');
	} catch (err: any) {
		ElMessage.error(err?.message || '刷新失败');
	} finally {
		refreshLoading.value = false;
	}
};

// 更新选中词趋势
const syncLoading = ref(false);
const translateLoading = ref(false);
const translatingRowId = ref<number | null>(null);
const TRANSLATE_LANGUAGE_AUTO = 'auto';
const rowTranslateSourceLanguageMap = ref<Record<number, string>>({});

const translateLanguageOptions = [
	{ label: '自动（按国家）', value: TRANSLATE_LANGUAGE_AUTO },
	{ label: '英语', value: 'en' },
	{ label: '德语', value: 'de' },
	{ label: '法语', value: 'fra' },
	{ label: '西班牙语', value: 'spa' },
	{ label: '意大利语', value: 'it' },
	{ label: '日语', value: 'jp' },
];

const translateLanguageLabelMap: Record<string, string> = {
	en: '英语',
	de: '德语',
	fra: '法语',
	spa: '西班牙语',
	it: '意大利语',
	jp: '日语',
};

const marketplaceLanguageMap: Record<string, string> = {
	'美国': 'en',
	US: 'en',
	'英国': 'en',
	UK: 'en',
	GB: 'en',
	'加拿大': 'en',
	CA: 'en',
	'澳大利亚': 'en',
	AU: 'en',
	'德国': 'de',
	DE: 'de',
	'法国': 'fra',
	FR: 'fra',
	'西班牙': 'spa',
	ES: 'spa',
	'意大利': 'it',
	IT: 'it',
	'日本': 'jp',
	JP: 'jp',
};

const getMarketplaceTranslateLanguage = (marketplace?: string) => {
	const value = String(marketplace || '').trim();
	if (!value) return 'en';
	return marketplaceLanguageMap[value] || marketplaceLanguageMap[value.toUpperCase()] || 'en';
};

const getTranslateLanguageLabel = (sourceLanguage: string, marketplace?: string) => {
	if (sourceLanguage && sourceLanguage !== TRANSLATE_LANGUAGE_AUTO) {
		return `${translateLanguageLabelMap[sourceLanguage] || sourceLanguage}（手动）`;
	}

	const marketplaceText = marketplace || '';
	const lang = getMarketplaceTranslateLanguage(marketplaceText);
	return `${translateLanguageLabelMap[lang] || lang}（按${marketplaceText || '默认'}）`;
};

const getRowTranslateLanguageLabel = (row: any) => {
	const sourceLanguage = rowTranslateSourceLanguageMap.value[row?.id] || TRANSLATE_LANGUAGE_AUTO;
	const marketplace = row?.marketplaces || props.listing?.marketplace || '';
	return getTranslateLanguageLabel(sourceLanguage, marketplace);
};

const buildTranslateAndSavePayload = (
	ids: number[],
	sourceLanguage = TRANSLATE_LANGUAGE_AUTO
) => {
	const payload: { ids: number[]; from?: string } = { ids };
	if (sourceLanguage !== TRANSLATE_LANGUAGE_AUTO) {
		payload.from = sourceLanguage;
	}
	return payload;
};

const markRowsTranslateLanguage = (ids: number[], sourceLanguage: string) => {
	const nextMap = { ...rowTranslateSourceLanguageMap.value };
	ids.forEach((id) => {
		nextMap[id] = sourceLanguage;
	});
	rowTranslateSourceLanguageMap.value = nextMap;
};

const handleBatchTranslate = async (sourceLanguage: string) => {
	const selected = Table.value?.selection || [];
	if (selected.length === 0) {
		ElMessage.warning('请先勾选需要翻译的关键词');
		return;
	}

	const ids = selected.map((row: any) => row.id);
	translateLoading.value = true;
	try {
		const res = await service.request({
			url: '/admin/app/sifKeyword/translateAndSave',
			method: 'POST',
			data: buildTranslateAndSavePayload(ids, sourceLanguage),
		});
		if (res) {
			ElMessage.success(`翻译完成，更新了 ${res.success}/${res.total} 个关键词`);
			markRowsTranslateLanguage(ids, sourceLanguage);
		}
		Crud.value?.refresh();
	} catch (err: any) {
		ElMessage.error(err?.message || '批量翻译失败');
	} finally {
		translateLoading.value = false;
	}
};

const handleSingleTranslate = async (row: any, sourceLanguage: string) => {
	if (!row?.id) {
		ElMessage.warning('缺少关键词ID，无法重译');
		return;
	}

	translatingRowId.value = row.id;
	try {
		const res = await service.request({
			url: '/admin/app/sifKeyword/translateAndSave',
			method: 'POST',
			data: buildTranslateAndSavePayload([row.id], sourceLanguage),
		});
		if (res) {
			ElMessage.success(`已重译「${row.value}」`);
			markRowsTranslateLanguage([row.id], sourceLanguage);
		}
		Crud.value?.refresh();
	} catch (err: any) {
		ElMessage.error(err?.message || '重译失败');
	} finally {
		translatingRowId.value = null;
	}
};

const translationEditVisible = ref(false);
const translationEditSaving = ref(false);
const translationEditRow = ref<any>(null);
const translationEditValue = ref('');

const openTranslationEdit = (row: any) => {
	translationEditRow.value = row;
	translationEditValue.value = row?.value_cn || '';
	translationEditVisible.value = true;
};

const saveTranslationEdit = async () => {
	if (!translationEditRow.value?.id) {
		ElMessage.warning('缺少关键词ID，无法保存');
		return;
	}

	translationEditSaving.value = true;
	try {
		await service.request({
			url: '/admin/app/sifKeyword/updateTranslation',
			method: 'POST',
			data: {
				id: translationEditRow.value.id,
				value_cn: translationEditValue.value,
			},
		});
		ElMessage.success('中文翻译已保存');
		translationEditVisible.value = false;
		Crud.value?.refresh();
	} catch (err: any) {
		ElMessage.error(err?.message || '保存中文翻译失败');
	} finally {
		translationEditSaving.value = false;
	}
};

const handleFetchSearchHistory = async () => {
	const selected = Table.value?.selection || [];
	if (selected.length === 0) {
		ElMessage.warning('请先勾选需要更新趋势的关键词');
		return;
	}

	const keywords = selected.map((row: any) => row.value).filter(Boolean);
	const marketplaces = props.listing?.marketplace;
	if (!marketplaces) {
		ElMessage.error('缺少国家信息');
		return;
	}

	syncLoading.value = true;
	try {
		const res = await service.app.sifKeyword.fetchSearchHistory({
			keywords,
			marketplaces,
			product_code: props.listing?.product_code,
		});
		if (res?.summary) {
			ElMessage.success(`同步完成: 成功 ${res.summary.success} 个, 失败 ${res.summary.fail} 个`);
		}
		Crud.value?.refresh();
	} catch (err: any) {
		ElMessage.error(err?.message || '更新搜索趋势失败');
	} finally {
		syncLoading.value = false;
	}
};

const formatSearchHistoryUpdateTime = (value?: string | Date | null) => {
	if (!value) return '未同步';
	const date = dayjs(value);
	return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : '未同步';
};

const Table = useTable({
	columns: [
		{ type: "selection", fixed: "left" },

		{
			label: "关键词",
			prop: "value",
			minWidth: 200,
			fixed: "left",
			sortable: "custom"
		},
		{
			label: "中文翻译",
			prop: "value_cn",
			minWidth: 240,
			fixed: "left",
			sortable: "custom"
		},
		{
			label: "状态",
			prop: "status",
			dict: [
				{ label: "待调研", value: 0, type: "warning" },
				{ label: "调研中", value: 1, color: "purple" },
				{ label: "待入库", value: 2, type: "primary" },
				{ label: "已入库", value: 3, type: "success" },
				{ label: "已归档", value: 4, type: "info" }
			],
			width: 110,
			sortable: "custom"
		},
		{ label: "国家", prop: "marketplaces", width: 80, sortable: "custom" },
		{
			label: "流量得分",
			prop: "sif_score",
			width: 120,
			sortable: "custom",
			align: "center"
		},
		{ label: "月搜索量", prop: "sif_search_volume_monthly", width: 110, sortable: "custom" },
		{ label: "趋势更新时间", prop: "sif_search_history_update_time", width: 160, sortable: "custom" },
		{ label: "搜索量数据 *", prop: "search_volume_data", width: 120, hidden: !is_admin.value },
		{ label: "搜索趋势", prop: "search_volume_chart", width: 90 },

		{ type: "op", buttons: ["slot-op"], width: 230 }
	]
});

const Upsert = useUpsert({
	dialog: {
		draggable: true,
		"align-center": true,
		width: "650"
	},
	props: {
		labelWidth: 150
	},
	items: [
		{
			label: "关键词条",
			prop: "value",
			component: { name: "el-input", props: { clearable: true } },
			required: true
		},
		{
			label: "关键词中文意思",
			prop: "value_cn",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "国家",
			prop: "marketplaces",
			component: { name: "el-input", props: { clearable: true } },
			required: true
		},

		{
			label: "状态",
			prop: "status",
			component: {
				name: "el-radio-group",
				options: [
					{ label: "待调研", value: 0 },
					{ label: "调研中", value: 1 },
					{ label: "待入库", value: 2 },
					{ label: "已入库", value: 3 },
					{ label: "已归档", value: 4 }
				]
			},
			value: 0,
			required: true
		}
	]
});

const batchImportDialogVisible = ref(false);
const importingKeywordsInput = ref("");
const importAsCoreKeyword = ref(false);
const importMarketplace = ref("");

async function importKeywords() {
	let input = importingKeywordsInput.value
		.trim()
		.split("\n")
		.map((row) => row.trim())
		.filter((row) => row);

	if (input.length === 0) {
		ElMessage.info("请填写内容。");
		return false;
	}

	if (!importMarketplace.value) {
		ElMessage.warning("请选择国家");
		return;
	}

	const loading = ElLoading.service({
		lock: true,
		text: "请稍后"
	});
	try {
		const result = await service.app.keyword.batch_import({
			sid: props.listing?.sid,
			asin: props.listing?.asin,
			seller_sku: props.listing?.seller_sku,
			keywords: input,
			is_core: importAsCoreKeyword.value,
			weight: 10,
			marketplaces: importMarketplace.value
		});
		if ("ok" === result) {
			ElMessage.success("导入成功");
			importingKeywordsInput.value = "";
			Crud.value?.refresh();
		} else {
			ElMessage.error("导入失败，请重试。");
		}
	} catch (err: any) {
		ElMessage.error(err);
	} finally {
		importMarketplace.value = "";
		batchImportDialogVisible.value = false;
		loading.close();
	}
}

// 新增国家选项配置
const countryOptions = ref([
	{ label: "英国", value: "英国" },
	{ label: "德国", value: "德国" },
	{ label: "法国", value: "法国" },
	{ label: "西班牙", value: "西班牙" },
	{ label: "意大利", value: "意大利" }
]);
const handleCountryChange = () => {
	Crud.value?.refresh({
		marketplaces: selectedCountry.value
	});
};

const handleDispatchTypeBlur = (row) => {
	// saveDispatchType(row);
};
const handleDispatchTypeChange = async (row: any) => {
	await saveDispatchType(row);
};

const saveDispatchType = async (row: any) => {
	try {
		await service.app.keyword.update({
			id: row.id,
			keyword_type: row.keyword_type
		});

		ElMessage.success("关键词类型已更新");
		// 刷新数据保持一致性
		Crud.value?.refresh();
	} catch (error) {
		console.error("保存失败:", error);
		ElMessage.error("保存失败");
		// 恢复原始数据
		Crud.value?.refresh();
	}
};

const KEY_TYPE_MAP: Record<string, string> = {
	core_major: "核心大词",
	core: "核心词",
	long_tail: "长尾词"
} as const;

const selectedCountry = ref<string>("");
const jsonViewerDialogVisible = ref(false);
const jsonViewerContent = ref();

// ========== 关键词跟踪 ==========
const trackDialogVisible = ref(false);
const trackLoading = ref(false);
const trackData = ref<any>(null);
const trackKeywordText = ref('');

async function setKeywordTypesByAsin() {
	try {
		const result = await service.app.keyword.setKeywordTypesByAsin({
			asin: props.listing?.asin
		});
		if ("ok" === result) {
			ElMessage.success("设置成功");
			Crud.value?.refresh();
		} else {
			ElMessage.error("设置失败，请重试。");
		}
	} catch (error) {
		console.error("设置失败:", error);
		ElMessage.error("设置失败");
	}
}

async function handleExport() {
	try {
		// 发起请求
		const response = await service.app.keyword.exportKeyword({
			asin: props.listing?.asin
		});

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

// script 部分修改
const batchAction = ref("");

// 处理批量操作
async function handleBatchAction(action: string) {
	const selection = Table.value?.selection;

	if (!selection || selection.length === 0) {
		ElMessage.warning("请先勾选要操作的关键词");
		batchAction.value = "";
		return;
	}

	// 立即更新前端显示
	selection.forEach((row) => {
		row.keyword_type = action; // 直接修改选中行的标签
		service.app.keyword.update({
			id: row.id,
			keyword_type: row.keyword_type
		});
	});

	ElMessage.success(`已更新 ${selection.length} 个关键词类型`);
	batchAction.value = "";
}

async function handleFetchKeywordsForListing() {
	try {
		const candidateId = props.listing?.asinid || props.listing?.candidate_id;

		if (!candidateId) {
			ElMessage.warning("缺少候选产品ID，无法获取关键词");
			return;
		}

		const loadingInstance = ElLoading.service({
			lock: true,
			text: "正在获取关键词信息，请稍候...",
			background: "rgba(0, 0, 0, 0.7)"
		});

		const response = await service.app.keyword.fetchKeywords({
			ids: [candidateId]
		});

		loadingInstance.close();

		ElMessage.success(`关键词获取成功：${response}`);
		Crud.value?.refresh();
	} catch (error) {
		console.error("获取关键词失败:", error);
		ElMessage.error("获取关键词失败");
	}
}

async function handleTrackKeyword(row: any) {
	const keyword = row.value;
	const marketplaces = row.marketplaces || props.listing?.marketplace;

	if (!keyword) {
		ElMessage.warning('缺少关键词信息');
		return;
	}
	if (!marketplaces) {
		ElMessage.warning('缺少国家信息');
		return;
	}

	trackKeywordText.value = keyword;
	trackData.value = null;
	trackDialogVisible.value = true;
	trackLoading.value = true;

	try {
		const res = await service.request({
			url: '/admin/app/sifKeyword/fetchAsinPageListByKeyword',
			method: 'POST',
			data: {
				keyword,
				marketplaces,
			},
		});
		trackData.value = res;
	} catch (err: any) {
		ElMessage.error(err?.message || '查询关键词ASIN排名失败');
	} finally {
		trackLoading.value = false;
	}
}

// ========== 手动输入竞品ASIN查询关键词 ==========
const manualAsinDialogVisible = ref(false);
const manualAsinInputText = ref('');
const manualAsinBulkText = ref('');
const manualAsinTags = ref<string[]>([]);
const manualKeywordResultVisible = ref(false);
const manualCompetitorAsins = ref<string[]>([]);

/**
 * 解析文本，提取有效ASIN
 * Amazon ASIN 为 10位大写字母+数字组合（绝大多数以 B0 开头）
 */
const parseAsins = (text: string): string[] => {
	return text
		.split(/[\n\r,;\s\t]+/) // 支持换行、逗号、分号、空格、Tab
		.map(s => s.trim().toUpperCase())
		.filter(s => /^[A-Z0-9]{10}$/.test(s)); // 严格10位字母数字
};

/**
 * 把合法ASIN加入标签列表（去重）
 */
const addAsinsToTags = (asins: string[]): number => {
	const existing = new Set(manualAsinTags.value);
	let added = 0;
	for (const asin of asins) {
		if (!existing.has(asin)) {
			manualAsinTags.value.push(asin);
			existing.add(asin);
			added++;
		}
	}
	return added;
};

/**
 * 方式1：逐个输入，按回车添加
 */
const addManualAsin = () => {
	const input = manualAsinInputText.value.trim();
	if (!input) return;
	const parsed = parseAsins(input);
	if (parsed.length === 0) {
		ElMessage.warning(`「${input}」不是有效的ASIN格式（需10位字母数字）`);
		return;
	}
	const added = addAsinsToTags(parsed);
	manualAsinInputText.value = '';
	if (added === 0) {
		ElMessage.info('该ASIN已存在，无需重复添加');
	}
};

/**
 * 方式2：批量粘贴，点击"识别并添加"
 */
const parseBulkAsins = () => {
	const text = manualAsinBulkText.value.trim();
	if (!text) return;
	const parsed = parseAsins(text);
	if (parsed.length === 0) {
		ElMessage.warning('未识别到有效ASIN（需10位字母数字，如 B0DM1SXB7G）');
		return;
	}
	const added = addAsinsToTags(parsed);
	const duplicated = parsed.length - added;
	let msg = `成功识别 ${parsed.length} 个ASIN，添加 ${added} 个`;
	if (duplicated > 0) msg += `，${duplicated} 个重复已跳过`;
	ElMessage.success(msg);
	manualAsinBulkText.value = ''; // 清空textarea
};

/**
 * 删除单个标签
 */
const removeManualAsin = (asin: string) => {
	manualAsinTags.value = manualAsinTags.value.filter(a => a !== asin);
};

/**
 * 确认查询 → 打开 BatchKeywordResult
 */
const handleManualAsinConfirm = () => {
	if (manualAsinTags.value.length === 0) {
		ElMessage.warning('请至少添加一个ASIN');
		return;
	}
	manualCompetitorAsins.value = [...manualAsinTags.value];
	manualAsinDialogVisible.value = false;
	manualKeywordResultVisible.value = true;
};

// 弹窗打开时清空所有状态
watch(manualAsinDialogVisible, (val) => {
	if (val) {
		manualAsinInputText.value = '';
		manualAsinBulkText.value = '';
		manualAsinTags.value = [];
	}
});

// ========== 导出 Excel ==========
const exportLoading = ref(false);

/**
 * 状态数字转中文
 */
const statusTextMap: Record<number, string> = {
	0: '待调研',
	1: '调研中',
	2: '待入库',
	3: '已入库',
	4: '已归档',
};

/**
 * 将数据行转换为导出格式
 */
const formatExportData = (rows: any[]): any[][] => {
	return rows.map(row => [
		row.value || '',
		row.value_cn || '',
		statusTextMap[row.status] || String(row.status ?? ''),
		row.marketplaces || '',
		row.sif_score != null ? Number(Number(row.sif_score).toFixed(2)) : '',
		row.sif_search_volume_monthly != null ? Number(row.sif_search_volume_monthly) : '',
	]);
};

/**
 * 生成文件名：关键词_产品编码_国家_日期
 */
const getExportFilename = () => {
	const code = props.listing?.product_code || 'unknown';
	const market = props.listing?.marketplace || '';
	const date = dayjs().format('YYYYMMDD_HHmm');
	return `关键词_${code}_${market}_${date}`;
};

const EXPORT_HEADERS = ['关键词', '中文翻译', '状态', '国家', '流量得分', '月搜索量'];

/**
 * 导出处理
 */
const handleExportExcel = async () => {
	const selected = Table.value?.selection || [];

	if (selected.length > 0) {
		// 有勾选 → 直接导出选中的
		const data = formatExportData(selected);
		export_json_to_excel({
			header: EXPORT_HEADERS,
			data,
			filename: getExportFilename(),
			autoWidth: true,
		} as any);
		ElMessage.success(`已导出 ${selected.length} 条关键词`);
		return;
	}

	// 没勾选 → 确认是否导出全部
	try {
		await ElMessageBox.confirm(
			'当前未勾选任何关键词，将导出当前筛选条件下的全部关键词。\n数据量较大时可能需要等待几秒，确定要导出吗？',
			'导出全部关键词',
			{
				confirmButtonText: '确定导出',
				cancelButtonText: '取消',
				type: 'warning',
			}
		);
	} catch {
		return; // 用户取消
	}

	exportLoading.value = true;
	try {
		// 查询全量数据
		const result = await service.app.sifKeyword.keywordPage({
			page: 1,
			size: 9999,
			status: 3,
			filter_type: keyword_filter_type.value,
			asin: props.listing?.asin,
			product_code: props.listing?.product_code,
			marketplaces: props.listing?.marketplace,
			store_id: getListingStoreId(),
			msku: getListingMsku(),
			order: 'sif_score',
			sort: 'desc',
		});

		const allList = result?.list || [];
		if (allList.length === 0) {
			ElMessage.warning('没有可导出的关键词数据');
			return;
		}

		const data = formatExportData(allList);
		export_json_to_excel({
			header: EXPORT_HEADERS,
			data,
			filename: getExportFilename(),
			autoWidth: true,
		} as any);
		ElMessage.success(`已导出全部 ${allList.length} 条关键词`);
	} catch (err: any) {
		ElMessage.error(err?.message || '导出失败');
	} finally {
		exportLoading.value = false;
	}
};
</script>

<style scoped>
.keyword-translation-cell {
	display: flex;
	flex-direction: column;
	gap: 4px;
	align-items: center;
}

.keyword-translation-text {
	display: flex;
	gap: 6px;
	align-items: center;
	justify-content: center;
	max-width: 100%;
}

.keyword-translation-text > span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.keyword-translation-actions {
	display: flex;
	gap: 8px;
	justify-content: center;
}
</style>
