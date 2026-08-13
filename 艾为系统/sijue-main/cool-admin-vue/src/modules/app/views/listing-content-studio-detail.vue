<!-- ListingContentStudio — SKU 工作台（纯前端 mock） -->
<!-- #/app/listing-content-studio/studio?sku=SKU-10021 -->
<template>
	<div class="lcs-studio-page">
		<div class="studio-top">
			<el-button text type="primary" class="back-btn" @click="goList">
				← 返回列表
			</el-button>
			<div v-if="skuRow" class="sku-top-panel">
				<div class="head-main">
					<div class="hero-thumb" :style="skuRow.thumbStyle" />
					<div class="head-text">
						<div class="sku-line">
							<span class="sku-code">{{ skuRow.sku }}</span>
							<el-tag size="small" :type="skuOverallTagType">{{ skuOverallStatusText }}</el-tag>
						</div>
						<h1 class="title">{{ skuRow.title }}</h1>
						<div class="meta-row muted">
							<el-tooltip placement="top" :show-after="200">
								<template #content>
									<div class="top-list-tooltip">
										<div v-for="m in topMskuList" :key="m" class="top-list-line">{{ m }}</div>
									</div>
								</template>
								<span class="meta-metric">MSKU {{ skuRow.mskuCount }}</span>
							</el-tooltip>
							<span>·</span>
							<el-tooltip placement="top" :show-after="200">
								<template #content>
									<div class="top-list-tooltip">
										<div v-for="a in topAccountList" :key="a" class="top-list-line">{{ a }}</div>
									</div>
								</template>
								<span class="meta-metric">账号 {{ skuRow.accounts.length }}</span>
							</el-tooltip>
							<span>·</span>
							<el-tooltip placement="top" :show-after="200">
								<template #content>
									<div class="top-list-tooltip">
										<div v-for="v in topVariantList" :key="v" class="top-list-line">{{ v }}</div>
									</div>
								</template>
								<span class="meta-metric">变体 {{ topVariantList.length }}</span>
							</el-tooltip>
							<span>·</span>
							<span>更新 {{ skuRow.updatedAt }}</span>
						</div>
					</div>
				</div>
				<div class="sku-actions">
					<el-button
						:type="skuDesignButtonType"
						plain
						:disabled="isSkuDesignActionDisabled"
						@click="handleSkuAction"
					>
						[父SKU] 创建/更新图需
					</el-button>
				</div>
			</div>
			<el-alert v-else type="warning" show-icon :closable="false" title="未找到演示数据" description="请从列表进入或检查父SKU参数" />
		</div>

		<design-requirement-regenerate-dialog
			ref="designRequirementDialogRef"
			@success="handleDesignRequirementDialogChange"
			@closed="handleDesignRequirementDialogChange"
		/>
		<design-task-detail
			v-model="designReviewDialogVisible"
			:task-id="designReviewTaskId"
			@closed="handleDesignRequirementDialogChange"
		/>
		<design-task-too-new-dialog
			v-model="designTooNewDialogVisible"
			@confirm="onDesignTooNewConfirm"
		/>
		<el-dialog
			v-model="aiCopyDetailDialogVisible"
			title="AI 文案任务详情"
			width="88%"
			top="4vh"
			align-center
			@closed="handleAiCopyDetailDialogClosed"
		>
			<listing-ai-copy-task-detail
				v-if="aiCopyDetailTaskId"
				:task-id="aiCopyDetailTaskId"
				embedded
				@approved="refreshCurrentSkuData"
				@refreshed="refreshCurrentSkuData"
				@close="aiCopyDetailDialogVisible = false"
			/>
		</el-dialog>

		<div class="studio-body">
			<aside class="msku-rail">
				<div class="rail-title">MSKU（按店铺分组）</div>
				<el-scrollbar class="rail-scroll">
					<div v-for="group in groupedMskuList" :key="group.account" class="shop-group">
						<div class="shop-group-title">{{ group.account }}</div>
						<button
							v-for="m in group.items"
							:key="m.id"
							type="button"
							class="msku-item"
							:class="{ active: m.id === activeMskuId }"
							@click="activeMskuId = m.id"
						>
							<div class="msku-row">
								<code class="msku-code">{{ m.msku }}</code>
							</div>
							<div class="muted small variant-line">变体 {{ m.variantLabel }}</div>
							<state-chain-lite :tags="compactStateTagsByMsku(m.msku)" />
							<div class="muted small owner-line">负责人 {{ m.owner }}</div>
							<div class="asin muted small">ASIN {{ m.asin }}</div>
						</button>
					</div>
				</el-scrollbar>
			</aside>

			<div class="studio-main">
				<el-tabs v-model="activeTab" class="studio-tabs">
					<el-tab-pane label="基础信息" name="base">
						<el-descriptions v-if="skuRow" :column="2" border class="desc-block">
							<el-descriptions-item label="系统 MSKU" :span="2">
								<template v-if="activeMsku">
									<code class="msku-inline-code">{{ activeMsku.msku }}</code>
									<span class="muted">
										· {{ activeMsku.amazonAccount }} · {{ activeMsku.variantLabel }} · 负责人
										{{ activeMsku.owner }}
									</span>
								</template>
								<template v-else>—</template>
							</el-descriptions-item>
							<el-descriptions-item label="上架 SKU" :span="2">
								<template v-if="activeMsku">
									<div class="seller-sku-row">
										<code v-if="activeMsku.sellerSku" class="msku-inline-code">{{ activeMsku.sellerSku }}</code>
										<span v-else class="muted">未设置（上架时用系统 MSKU）</span>
										<el-button type="primary" link @click="openSellerSkuDialog">编辑</el-button>
										<el-button
											v-if="activeMsku.sellerSku"
											type="info"
											link
											@click="copySellerSkuToClipboard"
										>
											复制
										</el-button>
									</div>
								</template>
								<template v-else>—</template>
							</el-descriptions-item>
							<el-descriptions-item label="语言" :span="2">
								<div v-if="activeMskuRequiredLanguages.length" class="base-lang-tags">
									<el-tag
										v-for="lang in activeMskuRequiredLanguages"
										:key="lang"
										size="small"
										type="info"
										effect="plain"
									>
										{{ labelForRequiredLang(lang) }}
									</el-tag>
								</div>
								<span v-else class="muted">—</span>
							</el-descriptions-item>
							<el-descriptions-item label="状态链" :span="2">
								<div class="major-steps-wrap">
									<div class="major-steps-head">
										<el-tag size="small" :type="readyChainOverallTagType">{{ readyChainOverallText }}</el-tag>
										<span class="muted">依赖：刊登 ← 文案；图片上传 ← 刊登 + 制图</span>
									</div>
									<div class="dep-dag">
										<svg class="dep-dag-lines" viewBox="0 0 1000 300" preserveAspectRatio="none">
											<line
												v-for="edge in dagEdges"
												:key="edge.key"
												:x1="edge.x1"
												:y1="edge.y1"
												:x2="edge.x2"
												:y2="edge.y2"
												class="dag-line"
												:class="[edge.baseClass, edge.stateClass]"
											/>
										</svg>
										<button
											v-for="node in dagNodes"
											:key="node.key"
											type="button"
											class="dag-node"
											:class="[`state-${node.state}`, node.className, { 'state-muted': node.muted }]"
											@click="handleResolveStep(node.key)"
										>
											<div class="dag-node-title">{{ node.label }}</div>
											<div class="dag-node-state">
												<el-tag
													size="small"
													:type="
														node.muted && node.state === 'need_action'
															? 'info'
															: stepStateTagType(node.state)
													"
												>
													{{ stepStateLabel(node.state) }}
												</el-tag>
											</div>
											<div class="dag-node-reason muted">{{ node.reason }}</div>
											<div v-if="node.reasonHint" class="dag-node-reason-hint">
												{{ node.reasonHint }}
											</div>
											<div v-if="node.dependsOn?.length" class="dag-node-deps muted">
												依赖：{{ node.dependsOn.join(" + ") }}
											</div>
											<div v-if="node.actionLabel && node.state === 'need_action'" class="dag-node-action">
												<span>{{ node.actionLabel }}</span>
											</div>
										</button>
									</div>
								</div>
							</el-descriptions-item>
							<el-descriptions-item label="时间线" :span="2">
								<div class="base-timeline-wrap">
									<timeline :items="activeMskuTimeline" compact />
								</div>
							</el-descriptions-item>
						</el-descriptions>
					</el-tab-pane>
					<el-tab-pane label="文案" name="copy">
						<div v-if="!activeMsku" class="muted">请选择左侧 MSKU</div>
						<div
							v-else-if="copyEditorsMounted"
							:key="copyEditorSurfaceKey"
							class="five-market-grid copy-five"
						>
							<div class="tab-top-actions">
								<el-button
									type="primary"
									plain
									size="small"
									:loading="translatingOtherLangs"
									@click="translateOtherLanguageCards"
								>
									一键翻译其他语言
								</el-button>
								<el-button
									type="primary"
									plain
									size="small"
									:loading="resolvingMasterCopyTask"
									@click="openMasterCopyEditDialog"
								>
									重新编辑母版文案
								</el-button>
								<el-button
									type="success"
									plain
									size="small"
									:disabled="!canMarkListingDone"
									:loading="markListingSaving"
									@click="markListingDone"
								>
									标记刊登完成
								</el-button>
								<el-tag
									size="small"
									:type="activeMsku?.listingStatus === 'done' ? 'success' : 'info'"
								>
									刊登：{{ activeMsku?.listingStatus === "done" ? "已完成" : "未完成" }}
								</el-tag>
							</div>
							<div
								v-for="lang in activeCopyLangs"
								:key="`${copyEditorSurfaceKey}-${lang}`"
								class="market-card"
							>
								<div class="market-card-head">
									<div class="market-card-head-main">
										<span class="site-code">{{ lang }}</span>
										<span class="locale-pair muted small">{{
											{ EN: "英语", DE: "德语", FR: "法语", IT: "意大利语", ES: "西语" }[lang] || lang
										}}</span>
										<el-tag size="small" :type="copyReadiness(lang).type">
											{{ copyReadiness(lang).text }}
										</el-tag>
									</div>
									<div class="market-card-actions">
										<el-button
											size="small"
											type="primary"
											:disabled="copyLocked[lang]"
											:loading="copyConfirmSavingLang === lang"
											@click="confirmCopy(lang)"
										>
											确认
										</el-button>
										<el-button size="small" :disabled="!copyLocked[lang]" @click="reeditCopy(lang)">
											重新编辑
										</el-button>
									</div>
								</div>
								<el-form label-position="top" class="copy-form copy-form--compact">
									<el-form-item>
										<template #label>
											<span>Title</span>
											<span
												v-if="copyDrafts[lang]"
												class="title-char-badge"
												:class="{
													'is-over': isListingTitleOverLimit(copyDrafts[lang].title)
												}"
											>
												{{ listingTitleLimitLabel(copyDrafts[lang].title) }}
											</span>
										</template>
										<el-input
											v-if="copyDrafts[lang]"
											:key="copyFieldInputKey(lang, 'title')"
											v-model="copyDrafts[lang].title"
											type="textarea"
											autosize
											:readonly="copyLocked[lang]"
											placeholder="接后端 / AI Listing"
										/>
									</el-form-item>
									<div class="bullets-section-label">五点描述</div>
									<template v-if="copyDrafts[lang]">
										<el-form-item
											v-for="(_line, idx) in copyDrafts[lang].bullets"
											:key="`${copyEditorSurfaceKey}-${lang}-bp-${idx}`"
											:label="`第 ${idx + 1} 点`"
											class="bullet-form-item"
										>
											<el-input
												:key="copyFieldInputKey(lang, 'bullet', idx)"
												v-model="copyDrafts[lang].bullets[idx]"
												type="textarea"
												autosize
												:readonly="copyLocked[lang]"
												placeholder="—"
											/>
										</el-form-item>
									</template>
									<el-form-item label="描述">
										<el-input
											v-if="copyDrafts[lang]"
											:key="copyFieldInputKey(lang, 'description')"
											v-model="copyDrafts[lang].description"
											type="textarea"
											autosize
											:readonly="copyLocked[lang]"
										/>
									</el-form-item>
								</el-form>
							</div>
						</div>
					</el-tab-pane>
					<el-tab-pane label="商品图与 A+" name="media">
						<div v-if="!activeMsku" class="muted">请选择左侧 MSKU</div>
						<div v-else class="media-tab" v-loading="uploadInfoLoading">
							<div class="tab-top-actions">
								<el-button
									type="success"
									plain
									size="small"
									:disabled="!canMarkUploadDone"
									@click="markUploadDone"
								>
									标记图片上传完成
								</el-button>
								<el-tag
									size="small"
									:type="activeMsku?.uploadStatus === 'done' ? 'success' : 'info'"
								>
									图片上传：{{ activeMsku?.uploadStatus === "done" ? "已完成" : "未完成" }}
								</el-tag>
								<el-tag v-if="uploadInfo.hasUploadTask" size="small" type="primary">
									已生成上传任务
								</el-tag>
								<el-tag v-else-if="uploadInfo.hasDesignTask" size="small" type="warning">
									图需阶段
								</el-tag>
								<el-tag v-else size="small" type="info">未建图需</el-tag>
							</div>

							<!-- 上：MSKU 需上传的图片编号列表（与美工任务-当前上传任务模块完全一致） -->
							<el-card class="checklist-card" shadow="never">
								<div class="section-header">
									<div>
										<div class="section-title">上传检查表</div>
										<div class="section-tip">
											提示：文案区支持双击/右键标记行，点列名✓可整列标记，Ctrl/Cmd + 单击可复制单元格
										</div>
									</div>
									<div class="section-actions">
										<div class="sort-mode-switch">
											<span :class="{ active: imageSlotSortMode === 'position' }">按位置</span>
											<el-switch
												:model-value="imageSlotSortMode === 'set'"
												@change="handleImageSlotSortModeSwitchChange"
											/>
											<span :class="{ active: imageSlotSortMode === 'set' }">按套图</span>
										</div>
										<el-button
											size="small"
											type="primary"
											link
											:disabled="!uploadInfo.uploadTaskId || !uploadInfo.checklist.length"
											@click="handleMarkAllChecklistCompleted"
										>
											全部标记完成
										</el-button>
									</div>
								</div>
								<div
									v-if="!uploadInfo.hasDesignTask"
									class="muted"
									style="padding: 12px 0"
								>
									该 MSKU 还没有图需，需要在父SKU维度发起 AI 文案/图需任务
								</div>
								<div
									v-else-if="!uploadInfo.hasUploadTask"
									class="muted"
									style="padding: 12px 0"
								>
									图需阶段，尚未生成上传任务（待上传 401 之后才会生成）
								</div>
								<div
									v-else-if="!uploadInfo.checklist.length"
									class="muted"
									style="padding: 12px 0"
								>
									暂无图位
								</div>
								<el-table
									v-else
									:data="uploadInfo.checklist"
									border
									style="width: 100%"
								>
									<el-table-column prop="code" label="图片编号" width="100" />
									<el-table-column label="参考图" width="120" align="center">
										<template #default="{ row }">
											<image-zoom
												v-if="row.referenceImage"
												:src="row.referenceImage"
												fit="cover"
												:width="80"
												:height="80"
											/>
											<span v-else class="text-value">-</span>
										</template>
									</el-table-column>
									<el-table-column prop="type" label="Tag" width="120" align="center">
										<template #default="{ row }">
											<el-tag v-if="row.type" type="primary" size="small">{{
												row.type
											}}</el-tag>
											<span v-else class="text-value">-</span>
										</template>
									</el-table-column>
									<el-table-column
										prop="requirements"
										label="图需"
										min-width="260"
										show-overflow-tooltip
									>
										<template #default="{ row }">
											<div class="requirements-text">
												{{ row.requirements }}
											</div>
										</template>
									</el-table-column>
									<el-table-column label="操作" width="160" align="center">
										<template #default="{ row }">
											<el-checkbox
												v-model="row.completed"
												:disabled="!uploadInfo.uploadTaskId"
												@change="onChecklistItemChange"
											>
												已完成
											</el-checkbox>
										</template>
									</el-table-column>
								</el-table>
							</el-card>

							<!-- 下：上传位置预览 -->
							<el-card class="upload-paths-card" shadow="never">
								<template #header>
									<div class="section-title">上传位置</div>
								</template>
								<div class="upload-path-block">
									<div class="upload-path-label">
										<span>摄影上传路径</span>
										<el-tag
											v-if="uploadInfo.photographerUploadPath"
											size="small"
											:type="isMinioPath(uploadInfo.photographerUploadPath) ? 'success' : 'info'"
										>
											{{ isMinioPath(uploadInfo.photographerUploadPath) ? "MinIO" : "本地路径" }}
										</el-tag>
									</div>
									<div v-if="!uploadInfo.photographerUploadPath" class="muted">未设置</div>
									<template v-else>
										<div class="upload-path-text">{{ uploadInfo.photographerUploadPath }}</div>
										<MinioPathBrowser
											v-if="isMinioPath(uploadInfo.photographerUploadPath)"
											:path="uploadInfo.photographerUploadPath"
											class="mt-8"
										/>
									</template>
								</div>
								<div class="upload-path-block">
									<div class="upload-path-label">
										<span>美工上传路径</span>
										<el-tag
											v-if="uploadInfo.designerUploadPath"
											size="small"
											:type="isMinioPath(uploadInfo.designerUploadPath) ? 'success' : 'info'"
										>
											{{ isMinioPath(uploadInfo.designerUploadPath) ? "MinIO" : "本地路径" }}
										</el-tag>
									</div>
									<div v-if="!uploadInfo.designerUploadPath" class="muted">未设置</div>
									<template v-else>
										<div class="upload-path-text">{{ uploadInfo.designerUploadPath }}</div>
										<MinioPathBrowser
											v-if="isMinioPath(uploadInfo.designerUploadPath)"
											:path="uploadInfo.designerUploadPath"
											class="mt-8"
										/>
									</template>
								</div>
							</el-card>
						</div>
					</el-tab-pane>
				</el-tabs>
			</div>
		</div>
	</div>

	<el-dialog
		v-model="sellerSkuDialogVisible"
		title="编辑上架 SKU"
		width="480px"
		destroy-on-close
		@closed="sellerSkuDraft = ''"
	>
		<p class="muted seller-sku-dialog-hint">
			仅记录在系统内，不影响内部 MSKU 关联。留空并保存表示清除，上架时默认用系统 MSKU。
		</p>
		<el-input
			v-model="sellerSkuDraft"
			placeholder="字母、数字、连字符，最多 40 字"
			maxlength="40"
			show-word-limit
			clearable
		/>
		<p class="muted seller-sku-dialog-sys">系统 MSKU：{{ activeMsku?.msku || "—" }}</p>
		<template #footer>
			<el-button @click="sellerSkuDialogVisible = false">取消</el-button>
			<el-button type="primary" :loading="sellerSkuSaving" @click="saveSellerSku">保存</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts" name="app-listing-content-studio-detail">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { loadStudioDetailBySku } from "./listing-content-studio/useContentWorkbenchDetailData";
import { findMskuRow, mskuKeysEquivalent } from "../utils/msku-key";
import { service } from "/@/cool";
import {
	LCS_MARKETPLACES,
	LCS_SITE_LOCALE,
	type LcsMskuCardPoint,
	type LcsMarketplace,
	type LcsWorkbenchMsku,
	type LcsSkuRow
} from "./listing-content-studio/types";
import {
	designTaskStatusText,
	sortImageSlots,
	getImageSlotSortModeBySku,
	setImageSlotSortModeBySku,
	type ImageSlotSortMode
} from "../utils";
import { deriveCompactTags, mapAiStatusTextZh } from "./listing-content-studio/state-machine";
import { labelForRequiredLang } from "../utils/listing-ai-required-languages";
import {
	isListingTitleOverLimit,
	listingTitleCharCount,
	listingTitleLimitLabel,
	LISTING_TITLE_AMAZON_MAX
} from "../utils/listing-title-char-limit";
import {
	assertVariantTitleSuffixRoundTrip,
	extractVariantTitleSuffix,
	resolveListingTitleText,
	stripVariantTitleSuffix
} from "../utils/listing-variant-title-suffix";
// @ts-ignore
import Timeline from "/$/app/components/timeline.vue";
// @ts-ignore
import StateChainLite from "/$/app/components/state-chain-lite.vue";
// @ts-ignore
import DesignRequirementRegenerateDialog from "/$/app/components/design-requirement-regenerate-dialog.vue";
// @ts-ignore
// @ts-ignore
import ListingAiCopyTaskDetail from "./listing-ai-copy-task-detail.vue";
// @ts-ignore
import DesignTaskDetail from "./design-task-detail.vue";
// @ts-ignore
import DesignTaskTooNewDialog from "/$/app/components/design-task-too-new-dialog.vue";
import {
	designTooNewReasonHint,
	evaluateDesignTaskTooNew,
	type DesignTaskTooNewInfo
} from "../utils/design-task-too-new";
// @ts-ignore
import MinioPathBrowser from "/$/app/components/minio-path-browser.vue";
// @ts-ignore
import ImageZoom from "/$/app/components/image-zoom.vue";

const route = useRoute();
const router = useRouter();

const sku = computed(() => String(route.query.sku || ""));
const targetMsku = computed(() => String(route.query.msku || ""));
const skuRow = ref<LcsSkuRow | undefined>(undefined);
const mskuList = ref<LcsWorkbenchMsku[]>([]);
const activeMskuId = ref("");
const designRequirementDialogRef = ref<InstanceType<typeof DesignRequirementRegenerateDialog> | null>(null);
const designReviewDialogVisible = ref(false);
const designReviewTaskId = ref<number>(0);
const designTooNewDialogVisible = ref(false);
const pendingDesignOpenTaskId = ref(0);
const aiCopyDetailDialogVisible = ref(false);
const aiCopyDetailTaskId = ref<number>(0);
const resolvingMasterCopyTask = ref(false);
const sellerSkuDialogVisible = ref(false);
const sellerSkuDraft = ref("");
const sellerSkuSaving = ref(false);
watch(
	() => ({ sku: sku.value, msku: targetMsku.value }),
	async ({ sku: skuCode, msku }) => {
		if (!skuCode) {
			mskuList.value = [];
			skuRow.value = undefined;
			activeMskuId.value = "";
			return;
		}
		const data = await loadStudioDetailBySku(skuCode, msku || undefined);
		skuRow.value = data.skuRow;
		const list = data.mskuList || [];
		mskuList.value = list;
		const matched = msku ? findMskuRow(list, msku) : undefined;
		activeMskuId.value = matched?.id ?? list[0]?.id ?? "";
	},
	{ immediate: true }
);

const activeMsku = computed(() => mskuList.value.find((m) => m.id === activeMskuId.value));
const activeWorkbenchDetail = ref<any | null>(null);
const activeGraphNodes = computed<any[]>(() =>
	Array.isArray(activeWorkbenchDetail.value?.graph?.nodes) ? activeWorkbenchDetail.value.graph.nodes : []
);
const activeCurrentAiNode = computed<any | null>(() => {
	return activeGraphNodes.value.find((x: any) => x.domain === "ai" && x.isCurrent) || null;
});
const activeCurrentDesignNode = computed<any | null>(() => {
	return activeGraphNodes.value.find((x: any) => x.domain === "design" && x.isCurrent) || null;
});
const currentDesignStageCode = computed<number>(() => {
	const node = activeCurrentDesignNode.value;
	const code = Number(node?.stage ?? node?.status ?? 0);
	return Number.isFinite(code) ? code : 0;
});
const currentDesignTaskId = computed<number>(() => {
	const node = activeCurrentDesignNode.value;
	const id = Number(node?.taskId || 0);
	return Number.isFinite(id) ? id : 0;
});
const isSkuDesignActionDisabled = computed<boolean>(() => {
	// 2xx 及以上阶段（摄影/美工及后续）不允许从这里创建/更新图需
	return currentDesignStageCode.value >= 200;
});
const activeDesignCreateTime = computed(() => {
	const node = activeCurrentDesignNode.value;
	return node?.createTime ?? activeMsku.value?.designTaskCreateTime ?? null;
});

/** 样品采购汇总（制图处于 201/202 时写入状态链详细状态） */
interface SamplePurchaseChainSummary {
	plan_count: number;
	po_count: number;
	has_plan: boolean;
	has_po: boolean;
	status_text: string;
}

const samplePurchaseForChain = ref<SamplePurchaseChainSummary | null>(null);

function isDesignShootStatusCode(code: number) {
	return code === 201 || code === 202;
}

function samplePurchaseChainSuffix(summary: SamplePurchaseChainSummary | null): string {
	if (!summary) return "；样品采购：—";
	const bits = [summary.status_text];
	if (summary.has_plan) bits.push(`计划${summary.plan_count}`);
	if (summary.has_po) bits.push(`PO${summary.po_count}单`);
	else if (summary.has_plan) bits.push("未下PO");
	return `；样品采购：${bits.join("，")}`;
}

async function refreshSamplePurchaseForChain() {
	const cid = Number(activeMsku.value?.candidateId || 0);
	const code = currentDesignStageCode.value;
	if (!cid || !isDesignShootStatusCode(code)) {
		samplePurchaseForChain.value = null;
		return;
	}
	const api = (service as any).app?.design_task;
	if (!api?.request) {
		samplePurchaseForChain.value = null;
		return;
	}
	try {
		const res = await api.request({
			url: "/samplePurchaseSummary",
			method: "GET",
			params: { candidateId: cid }
		});
		const raw = res?.data ?? res;
		samplePurchaseForChain.value =
			raw && typeof raw === "object" && raw.status_text != null ? raw : null;
	} catch {
		samplePurchaseForChain.value = null;
	}
}

watch(
	() => [Number(activeMsku.value?.candidateId || 0), currentDesignStageCode.value] as const,
	() => {
		void refreshSamplePurchaseForChain();
	},
	{ immediate: true }
);
const activeDesignTooNewInfo = computed<DesignTaskTooNewInfo>(() =>
	evaluateDesignTaskTooNew({
		statusCode: currentDesignStageCode.value || activeMsku.value?.designTaskStatus,
		createTime: activeDesignCreateTime.value
	})
);
const skuDesignButtonType = computed<"primary" | "info">(() =>
	activeDesignTooNewInfo.value.tooNew && !isSkuDesignActionDisabled.value ? "info" : "primary"
);
const activeGraphTimeline = computed<any[]>(() =>
	Array.isArray(activeWorkbenchDetail.value?.timeline) ? activeWorkbenchDetail.value.timeline : []
);

async function refreshActiveWorkbenchDetail(workItemId?: number) {
	const id = Number(workItemId || activeMsku.value?.workItemId || 0);
	if (!id || !(service as any).app?.content_workbench?.detail) {
		activeWorkbenchDetail.value = null;
		return;
	}
	try {
		const resp = await (service as any).app.content_workbench.detail({ id });
		const data = resp?.data ?? resp;
		activeWorkbenchDetail.value = data || null;
	} catch {
		activeWorkbenchDetail.value = null;
	}
}

watch(
	() => Number(activeMsku.value?.workItemId || 0),
	async (workItemId) => {
		await refreshActiveWorkbenchDetail(workItemId);
	},
	{ immediate: true }
);

interface UploadChecklistItem {
	pictureId: number;
	code: string;
	completed: boolean;
	referenceImage: string;
	type: string;
	requirements: string;
}
const uploadInfo = ref<{
	hasDesignTask: boolean;
	hasUploadTask: boolean;
	uploadTaskId: number | null;
	photographerUploadPath: string;
	designerUploadPath: string;
	checklist: UploadChecklistItem[];
}>({
	hasDesignTask: false,
	hasUploadTask: false,
	uploadTaskId: null,
	photographerUploadPath: "",
	designerUploadPath: "",
	checklist: []
});
const uploadInfoLoading = ref(false);
const uploadInfoSaving = ref(false);
const imageSlotSortMode = ref<ImageSlotSortMode>("position");

function sortUploadChecklistInPlace() {
	uploadInfo.value.checklist = [...uploadInfo.value.checklist].sort((a, b) =>
		sortImageSlots({ label: a.code }, { label: b.code }, imageSlotSortMode.value)
	);
}

function handleImageSlotSortModeSwitchChange(checked: string | number | boolean) {
	imageSlotSortMode.value = checked ? "set" : "position";
	const skuCode = skuRow.value?.sku || sku.value || "";
	if (skuCode) setImageSlotSortModeBySku(skuCode, imageSlotSortMode.value);
	sortUploadChecklistInPlace();
}

async function fetchMskuUploadInfo() {
	const candidateId = Number(activeMsku.value?.candidateId || 0);
	const msku = String(activeMsku.value?.msku || "");
	if (!candidateId || !msku) {
		uploadInfo.value = {
			hasDesignTask: false,
			hasUploadTask: false,
			uploadTaskId: null,
			photographerUploadPath: "",
			designerUploadPath: "",
			checklist: []
		};
		return;
	}
	uploadInfoLoading.value = true;
	try {
		const r: any = await (service as any).app.design_task.request({
			url: "/mskuUploadInfo",
			method: "GET",
			params: { candidateId, msku }
		});
		const data = r?.data ?? r;
		const skuCode = skuRow.value?.sku || sku.value || "";
		if (skuCode) imageSlotSortMode.value = getImageSlotSortModeBySku(skuCode);
		const list: UploadChecklistItem[] = Array.isArray(data?.checklist)
			? data.checklist.map((x: any) => ({
					pictureId: Number(x.pictureId) || 0,
					code: String(x.code || ""),
					completed: !!x.completed,
					referenceImage: String(x.referenceImage || ""),
					type: String(x.type || ""),
					requirements: String(x.requirements || "")
				}))
			: [];
		list.sort((a, b) =>
			sortImageSlots({ label: a.code }, { label: b.code }, imageSlotSortMode.value)
		);
		uploadInfo.value = {
			hasDesignTask: !!data?.hasDesignTask,
			hasUploadTask: !!data?.hasUploadTask,
			uploadTaskId:
				data?.basic?.uploadTaskId != null ? Number(data.basic.uploadTaskId) : null,
			photographerUploadPath: String(data?.basic?.photographerUploadPath || ""),
			designerUploadPath: String(data?.basic?.designerUploadPath || ""),
			checklist: list
		};
	} catch (e) {
		console.error(e);
		uploadInfo.value = {
			hasDesignTask: false,
			hasUploadTask: false,
			uploadTaskId: null,
			photographerUploadPath: "",
			designerUploadPath: "",
			checklist: []
		};
	} finally {
		uploadInfoLoading.value = false;
	}
}

watch(
	() =>
		`${activeMsku.value?.candidateId || ""}::${activeMsku.value?.msku || ""}`,
	() => {
		fetchMskuUploadInfo();
	},
	{ immediate: true }
);

/** 保存当前 checklist 勾选状态到 design_upload_task */
async function saveUploadChecklist(): Promise<boolean> {
	const id = Number(uploadInfo.value.uploadTaskId || 0);
	if (!id) {
		ElMessage.warning("尚未生成上传任务，无法保存");
		return false;
	}
	uploadInfoSaving.value = true;
	try {
		await (service as any).app.design_task.request({
			url: "/saveUploadTaskDetail",
			method: "POST",
			data: {
				id,
				items: uploadInfo.value.checklist.map((item) => ({
					pictureId: item.pictureId,
					code: item.code,
					completed: item.completed
				}))
			}
		});
		return true;
	} catch (e) {
		console.error(e);
		ElMessage.error("保存失败");
		return false;
	} finally {
		uploadInfoSaving.value = false;
	}
}

let checklistSaveTimer: ReturnType<typeof setTimeout> | null = null;
function onChecklistItemChange() {
	if (!uploadInfo.value.uploadTaskId) return;
	if (checklistSaveTimer) clearTimeout(checklistSaveTimer);
	checklistSaveTimer = setTimeout(() => {
		saveUploadChecklist();
	}, 400);
}

async function handleMarkAllChecklistCompleted() {
	if (!uploadInfo.value.checklist.length) return;
	if (!uploadInfo.value.uploadTaskId) {
		ElMessage.warning("尚未生成上传任务，无法保存");
		return;
	}
	uploadInfo.value.checklist.forEach((item) => {
		item.completed = true;
	});
	const ok = await saveUploadChecklist();
	if (ok) ElMessage.success("已全部标记完成");
}

/**
 * 判断是否是 MinIO 路径（相对、无盘符、无协议）
 * - 老格式：C:\xxx、\\share\xxx、http://...、/abs/path
 * - 新格式：assets/photo/.. 这种纯相对路径
 */
function isMinioPath(p: string): boolean {
	const s = String(p || "").trim();
	if (!s) return false;
	if (/^[a-zA-Z]:[\\/]/.test(s)) return false;
	if (s.startsWith("\\\\")) return false;
	if (/^[a-z]+:\/\//i.test(s)) return false;
	if (s.startsWith("/")) return false;
	if (s.includes("\\")) return false;
	return true;
}
const activeMskuStatus = computed<LcsMskuCardPoint | undefined>(() => {
	if (!skuRow.value || !activeMsku.value) return undefined;
	return skuRow.value.mskuCardPoints.find((x) =>
		mskuKeysEquivalent(x.msku, activeMsku.value?.msku)
	);
});
const activeMskuRequiredLanguages = computed(
	() => activeMsku.value?.requiredLanguages || activeMskuStatus.value?.requiredLanguages || []
);
const activeMskuTimeline = computed(() => {
	const toMs = (time: any): number => {
		const s = String(time || "").trim();
		if (!s) return 0;
		// 统一兼容：
		// - 2026-05-08 15:34:38
		// - 2026-05-08T07:12:57.449Z
		// - 时间戳字符串
		if (/^\d{10,13}$/.test(s)) {
			const n = Number(s);
			return s.length === 13 ? n : n * 1000;
		}
		const normalized = s.includes("T") ? s : s.replace(" ", "T");
		const candidates = [
			normalized,
			normalized.endsWith("Z") ? normalized : `${normalized}Z`,
			s
		];
		for (const c of candidates) {
			const ms = Date.parse(c);
			if (Number.isFinite(ms) && ms > 0) return ms;
		}
		return 0;
	};
	const pushIf = (
		list: Array<{ time: string; content: string; operator?: string }>,
		item?: { time?: any; content?: any; operator?: any }
	) => {
		const content = String(item?.content || "").trim();
		const time = String(item?.time || "").trim();
		const operator = String(item?.operator || "").trim();
		if (!content && !time) return;
		list.push({ time, content, operator });
	};
	const merged: Array<{ time: string; content: string; operator?: string }> = [];

	// 1) 图上的 AI/制图事件
	activeGraphTimeline.value.forEach((x: any) =>
		pushIf(merged, {
			time: x?.at,
			content: x?.title,
			operator: x?.operator
		})
	);

	// 2) 当前节点状态事件（补齐没写 timeline 的任务）
	const aiNode = activeCurrentAiNode.value;
	if (aiNode) {
		pushIf(merged, {
			time: aiNode?.finishedAt || aiNode?.startedAt || activeWorkbenchDetail.value?.work_item?.updateTime,
			content: `文案：${mapAiStatusTextZh(aiNode?.stage || aiNode?.status || "进行中")}`,
			operator: ""
		});
	}
	const designNode = activeCurrentDesignNode.value;
	if (designNode) {
		const code = Number(designNode?.stage || designNode?.status || 0);
		pushIf(merged, {
			time: activeWorkbenchDetail.value?.work_item?.updateTime,
			content: `制图：${designTaskStatusText(code) || String(code || "进行中")}`,
			operator: ""
		});
	}

	// 3) 刊登 / 图片上传事件（独立节点）
	const workItem = activeWorkbenchDetail.value?.work_item || {};
	if (String(workItem?.listing_status || "").toLowerCase() === "done") {
		pushIf(merged, {
			time: workItem?.listing_finished_at || workItem?.updateTime,
			content: "刊登：已完成",
			operator: ""
		});
	}
	if (String(workItem?.upload_status || "").toLowerCase() === "done") {
		pushIf(merged, {
			time: workItem?.upload_finished_at || workItem?.updateTime,
			content: "图片上传：已完成",
			operator: ""
		});
	}

	if (merged.length) {
		const uniq = new Map<string, { time: string; content: string; operator?: string }>();
		merged.forEach((item) => {
			const key = `${item.time}|${item.content}|${item.operator || ""}`;
			if (!uniq.has(key)) uniq.set(key, item);
		});
		return Array.from(uniq.values())
			.sort((a, b) => toMs(a.time) - toMs(b.time))
			.slice(-12);
	}

	if (!skuRow.value || !activeMsku.value) return [];
	const timeline = skuRow.value.activityTimeline || [];
	const filtered = timeline.filter(
		(t) =>
			t.content.includes(activeMsku.value!.amazonAccount) &&
			t.content.includes(activeMsku.value!.variantLabel)
	);
	const fallback = filtered.length ? filtered : timeline.slice(0, 12);
	return [...fallback].sort((a, b) => toMs(a.time) - toMs(b.time)).slice(-12);
});
const groupedMskuList = computed(() => {
	const map = new Map<string, LcsWorkbenchMsku[]>();
	mskuList.value.forEach((m) => {
		const arr = map.get(m.amazonAccount) || [];
		arr.push(m);
		map.set(m.amazonAccount, arr);
	});
	return Array.from(map.entries()).map(([account, items]) => ({ account, items }));
});

/** 仅当前选中 MSKU 的站点（落在五国内的子集，顺序固定）；不与同账号其它 MSKU 并集 */
const shopSites = computed(() => {
	if (!activeMsku.value) return [];
	const raw = activeMsku.value.sites || [];
	const inFive = raw.filter((s) => LCS_MARKETPLACES.includes(s as LcsMarketplace));
	return LCS_MARKETPLACES.filter((mkt) => inFive.includes(mkt));
});

function localeCodeForSite(site: string): string {
	return LCS_SITE_LOCALE[site as LcsMarketplace] || "EN";
}

function primaryLangForSite(site: string): string {
	return localeCodeForSite(site);
}

interface LocaleCopyData {
	title: string;
	bullets: string[];
	description: string;
}

type AiCopyByLang = Record<
	string,
	{
		title: string;
		bullets: string[];
		description: string;
		variantTitles: Record<string, string>;
		variantCopy: Record<string, { bullets: string[]; description: string }>;
	}
>;
const aiCopyByLang = ref<AiCopyByLang>({});
const translatedCopyByLang = ref<AiCopyByLang>({});
const BASE_COPY_LANGS = ["EN", "DE"] as const;
const EXTRA_COPY_LANGS = ["FR", "IT", "ES"] as const;
const enabledExtraCopyLangs = ref<string[]>([]);
const translatingOtherLangs = ref(false);
const activeCopyLangs = computed(() => [...BASE_COPY_LANGS, ...enabledExtraCopyLangs.value]);
const lastAiCopyTaskId = ref<number>(0);
const TRANSLATION_CACHE_PREFIX = "lcs_copy_translation_cache_v1";

function translationCacheKey(taskId: number) {
	return `${TRANSLATION_CACHE_PREFIX}:${taskId}`;
}

function loadTranslationCache(taskId: number) {
	if (!taskId) return;
	try {
		const raw = localStorage.getItem(translationCacheKey(taskId));
		if (!raw) return;
		const parsed = JSON.parse(raw || "{}");
		const payload = parsed?.translatedCopyByLang;
		const langs = parsed?.enabledExtraCopyLangs;
		if (!payload || typeof payload !== "object") return;
		translatedCopyByLang.value = payload;
		enabledExtraCopyLangs.value = Array.isArray(langs)
			? langs.filter((x: any) => EXTRA_COPY_LANGS.includes(String(x || "").toUpperCase() as any))
			: [];
	} catch {
		// ignore invalid cache payload
	}
}

function saveTranslationCache(taskId: number) {
	if (!taskId) return;
	try {
		localStorage.setItem(
			translationCacheKey(taskId),
			JSON.stringify({
				translatedCopyByLang: translatedCopyByLang.value,
				enabledExtraCopyLangs: enabledExtraCopyLangs.value,
				savedAt: Date.now()
			})
		);
	} catch {
		// ignore storage quota / privacy mode errors
	}
}

/** 与 langgraph base_copy.bullet_points 一致：每项 { bullet_point, retry_count? } */
function parseBullets(value: any): string[] {
	if (!Array.isArray(value)) {
		const text = String(value || "").trim();
		if (!text) return ["", "", "", "", ""];
		const lines = text
			.split(/\r?\n+/)
			.map((x) => x.trim())
			.filter(Boolean)
			.slice(0, 5);
		while (lines.length < 5) lines.push("");
		return lines;
	}
	return Array.from({ length: 5 }, (_, i) => {
		const row = value[i];
		if (row == null) return "";
		if (typeof row === "string") return String(row).trim();
		if (typeof row === "object") {
			return String((row as any).bullet_point ?? "").trim();
		}
		return String(row).trim();
	});
}

function extractVariantMarker(title: string, baseTitle?: string): string {
	return extractVariantTitleSuffix(title, baseTitle);
}

function stripTailMarker(title: string, baseTitle?: string): string {
	return stripVariantTitleSuffix(title, baseTitle);
}

function resolveBaseCopyTitle(locale: string): string {
	const row = aiCopyByLang.value[locale] || aiCopyByLang.value.en;
	return resolveListingTitleText(row?.title);
}

/** 变体完整标题：只读 variant_titles，不再从 base + marker 二次拼接 */
function resolveVariantFullTitle(lang: string): string {
	const locale = String(lang || "EN").toLowerCase();
	const row = aiCopyByLang.value[locale] || aiCopyByLang.value.en;
	if (!row) return "";
	const variantKey = String(activeMsku.value?.selectedVariantId || "").trim();
	const legacyMskuKey = String(activeMsku.value?.msku || "").trim();
	const titles = row.variantTitles || {};
	if (variantKey && titles[variantKey]) {
		return String(titles[variantKey]).trim();
	}
	if (legacyMskuKey && titles[legacyMskuKey]) {
		return String(titles[legacyMskuKey]).trim();
	}
	return resolveBaseCopyTitle(locale);
}

async function refreshActiveAiCopyResult() {
	const taskId = Number(activeMsku.value?.currentAiTaskId || 0);
	const api = (service as any).app?.ai_listing_task;
	if (taskId !== lastAiCopyTaskId.value) {
		translatedCopyByLang.value = {};
		enabledExtraCopyLangs.value = [];
		loadTranslationCache(taskId);
	}
	if (!taskId || !api?.status) {
		lastAiCopyTaskId.value = 0;
		aiCopyByLang.value = {};
		return;
	}
	try {
		const statusRes = await api.status({ id: taskId });
		const task = statusRes?.data ?? statusRes ?? {};
		const langgraphResult = task?.langgraph_result || {};
		const readLang = (lang: string) => {
			const payload = langgraphResult?.[lang] || {};
			const base = payload?.base_copy || {};
			const variantCopyRaw = (payload?.variant_copy || {}) as Record<string, any>;
			const variantCopy: Record<string, { bullets: string[]; description: string }> = {};
			for (const [vid, row] of Object.entries(variantCopyRaw)) {
				if (!vid) continue;
				variantCopy[vid] = {
					bullets: parseBullets((row as any)?.bullet_points),
					description: String((row as any)?.description || "")
				};
			}
			return {
				title: resolveListingTitleText(base?.title),
				bullets: parseBullets(base?.bullet_points),
				description: String(base?.description || ""),
				variantTitles: (payload?.variant_titles || {}) as Record<string, string>,
				variantCopy
			};
		};
		aiCopyByLang.value = {
			en: readLang("en"),
			de: readLang("de"),
			fr: readLang("fr"),
			it: readLang("it"),
			es: readLang("es")
		};
		lastAiCopyTaskId.value = taskId;
	} catch {
		aiCopyByLang.value = {};
	}
}

function getCopyByLocale(_site: string, lang: string): LocaleCopyData {
	const locale = String(lang || "EN").toLowerCase();
	const translated = translatedCopyByLang.value[locale];
	const current = translated || aiCopyByLang.value[locale] || aiCopyByLang.value.en;
	const variantKey = String(activeMsku.value?.selectedVariantId || "").trim();
	const scoped = variantKey ? current?.variantCopy?.[variantKey] : undefined;
	const title = translated
		? String(translated.title || "").trim()
		: resolveVariantFullTitle(lang) ||
			resolveBaseCopyTitle(locale) ||
			String(skuRow.value?.title || "").trim();
	const bullets = scoped
		? [...scoped.bullets]
		: Array.from({ length: 5 }, (_, idx) => String(current?.bullets?.[idx] || "").trim());
	const description = scoped
		? String(scoped.description || "").trim()
		: String(current?.description || "").trim();
	return {
		title: title || `${skuRow.value?.title ?? ""}`,
		bullets: bullets.some(Boolean) ? bullets : ["", "", "", "", ""],
		description
	};
}

function cloneLocaleDraft(site: string): LocaleCopyData {
	const lang = String(site || "").toUpperCase();
	const src = getCopyByLocale(site, lang);
	return { title: src.title, bullets: [...src.bullets], description: src.description };
}

const copyDrafts = ref<Record<string, LocaleCopyData>>({});
const copyLocked = ref<Record<string, boolean>>({});
const mediaLocked = ref<Record<string, boolean>>({});
const copyEditorsMounted = ref(true);
const markListingSaving = ref(false);
const copyConfirmSavingLang = ref("");

/** MSKU / 变体 / 文案任务变化时整表 remount，避免 el-input autosize 复用塌陷 */
const copyEditorSurfaceKey = computed(() => {
	const m = activeMsku.value;
	if (!m) return "none";
	return [
		String(m.id || ""),
		String(m.msku || ""),
		String(m.workItemId || 0),
		String(m.currentAiTaskId || 0),
		String(m.selectedVariantId || "")
	].join("::");
});

function copyFieldInputKey(lang: string, field: string, bulletIdx?: number) {
	const bulletPart = bulletIdx != null ? `-bp${bulletIdx}` : `-${field}`;
	return `${copyEditorSurfaceKey.value}-${lang}${bulletPart}`;
}

function resetSiteEditors() {
	if (!activeMsku.value) {
		copyDrafts.value = {};
		copyLocked.value = {};
		mediaLocked.value = {};
		return;
	}
	const langs = activeCopyLangs.value;
	if (!langs.length) {
		copyDrafts.value = {};
		copyLocked.value = {};
		mediaLocked.value = {};
		return;
	}
	const d: Record<string, LocaleCopyData> = {};
	const cl: Record<string, boolean> = {};
	const ml: Record<string, boolean> = {};
	for (const lang of langs) {
		d[lang] = cloneLocaleDraft(lang);
		cl[lang] = false;
		ml[lang] = false;
	}
	copyDrafts.value = d;
	copyLocked.value = cl;
	mediaLocked.value = ml;
}

async function remountCopyEditors() {
	if (!activeMsku.value) {
		copyEditorsMounted.value = true;
		resetSiteEditors();
		return;
	}
	copyEditorsMounted.value = false;
	await nextTick();
	resetSiteEditors();
	copyEditorsMounted.value = true;
}

watch(
	() =>
		[
			sku.value,
			activeMskuId.value,
			String(activeMsku.value?.msku || ""),
			String(activeMsku.value?.selectedVariantId || "")
		] as const,
	() => {
		void remountCopyEditors();
	},
	{ immediate: true }
);

watch(
	() => Number(activeMsku.value?.currentAiTaskId || 0),
	async () => {
		await refreshActiveAiCopyResult();
		await remountCopyEditors();
	},
	{ immediate: true }
);

watch(
	() => enabledExtraCopyLangs.value.join(","),
	() => {
		void remountCopyEditors();
	}
);

type WorkbenchCopyLanePayload = {
	title: string;
	bullets: string[];
	description: string;
	variantSuffixes?: Record<string, string>;
	/** 内容工作台：直接写入完整变体标题，避免 base(suffix) 二次包裹 */
	variantFullTitles?: Record<string, string>;
	variantId?: string;
};

function buildWorkbenchCopyPayload(langs?: string[]): {
	en?: WorkbenchCopyLanePayload;
	de?: WorkbenchCopyLanePayload;
} {
	const targetLangs = langs?.length ? langs : activeCopyLangs.value;
	const variantId = String(activeMsku.value?.selectedVariantId || "").trim();
	const copy: { en?: WorkbenchCopyLanePayload; de?: WorkbenchCopyLanePayload } = {};
	for (const lang of targetLangs) {
		const locale = String(lang || "").toLowerCase();
		if (locale !== "en" && locale !== "de") continue;
		const draft = copyDrafts.value[lang];
		if (!draft) continue;
		const fullTitle = String(draft.title || "").trim();
		const baseTitle = resolveBaseCopyTitle(locale);
		const lane: WorkbenchCopyLanePayload = {
			title: stripTailMarker(fullTitle, baseTitle),
			bullets: draft.bullets.map((line) => String(line || "").trim()),
			description: String(draft.description || "").trim()
		};
		if (variantId) {
			lane.variantFullTitles = { [variantId]: fullTitle };
			lane.variantId = variantId;
		}
		copy[locale as "en" | "de"] = lane;
	}
	return copy;
}

async function callContentWorkbenchApi(
	method: "saveListingCopy" | "markListingDone",
	data: Record<string, unknown>
) {
	const api = (service as any).app?.content_workbench;
	if (typeof api?.[method] === "function") {
		return api[method](data);
	}
	if (typeof api?.request === "function") {
		return api.request({ url: `/${method}`, method: "POST", data });
	}
	throw new Error(`后端 ${method} 接口不可用`);
}

function collectWorkbenchVariantSuffixViolations(): string[] {
	const variantId = String(activeMsku.value?.selectedVariantId || "").trim();
	if (!variantId) return [];
	const hits: string[] = [];
	for (const lang of activeCopyLangs.value) {
		const locale = String(lang || "").toLowerCase();
		if (locale !== "en" && locale !== "de") continue;
		const draft = copyDrafts.value[lang];
		if (!draft) continue;
		const fullTitle = String(draft.title || "").trim();
		const baseTitle = resolveBaseCopyTitle(locale);
		const marker = extractVariantMarker(fullTitle, baseTitle);
		const suffix = String(marker || "").trim();
		if (!suffix || suffix === "-") continue;
		const localeLabel = locale === "en" ? "英语" : "德语";
		try {
			assertVariantTitleSuffixRoundTrip(baseTitle, suffix, localeLabel);
		} catch (err: any) {
			hits.push(String(err?.message || `${localeLabel}变体选项无法保存`));
		}
	}
	return hits;
}

async function persistWorkbenchCopy(langs?: string[]) {
	const suffixViolations = collectWorkbenchVariantSuffixViolations();
	if (suffixViolations.length) {
		throw new Error(suffixViolations[0]);
	}
	const workItemId = Number(activeMsku.value?.workItemId || 0);
	if (!workItemId) throw new Error("工作项无效");
	const copy = buildWorkbenchCopyPayload(langs);
	if (!copy.en && !copy.de) return;
	await callContentWorkbenchApi("saveListingCopy", { workItemId, copy });
	await refreshActiveAiCopyResult();
	const nextDrafts = { ...copyDrafts.value };
	for (const lang of langs?.length ? langs : activeCopyLangs.value) {
		nextDrafts[lang] = cloneLocaleDraft(lang);
	}
	copyDrafts.value = nextDrafts;
}

function collectWorkbenchTitleLimitViolations(): string[] {
	const hits: string[] = [];
	for (const lang of activeCopyLangs.value) {
		const title = String(copyDrafts.value[lang]?.title ?? "");
		if (!isListingTitleOverLimit(title)) continue;
		const localeLabel =
			{ EN: "英语", DE: "德语", FR: "法语", IT: "意大利语", ES: "西语" }[lang] || lang;
		hits.push(
			`${localeLabel} Title（${listingTitleCharCount(title)}/${LISTING_TITLE_AMAZON_MAX} 字，含变体后缀）`
		);
	}
	return hits;
}

async function confirmCopy(site: string) {
	const title = String(copyDrafts.value[site]?.title ?? "");
	if (isListingTitleOverLimit(title)) {
		ElMessage.error(
			`${site} Title 超出 ${LISTING_TITLE_AMAZON_MAX} 字（含变体后缀 ${listingTitleCharCount(title)} 字），请缩短或去掉后缀后重试`
		);
		return;
	}
	copyConfirmSavingLang.value = site;
	try {
		await persistWorkbenchCopy([site]);
		copyLocked.value[site] = true;
		ElMessage.success(`${site} 文案已保存并确认`);
	} catch (err: any) {
		ElMessage.error(err?.message || "保存失败");
	} finally {
		copyConfirmSavingLang.value = "";
	}
}

function reeditCopy(site: string) {
	copyLocked.value[site] = false;
}

function confirmMedia(site: string) {
	mediaLocked.value[site] = true;
	ElMessage.success(`${site} 图稿已确认`);
}

function reeditMedia(site: string) {
	mediaLocked.value[site] = false;
}

interface LocaleMediaProgress {
	productDone: number;
	productTotal: number;
	aPlusDone: number;
	aPlusTotal: number;
}

function mediaByLocale(site: string, lang: string): LocaleMediaProgress {
	const base = skuRow.value;
	if (!base) return { productDone: 0, productTotal: 1, aPlusDone: 0, aPlusTotal: 1 };
	if (site === "UK" && lang === "EN") {
		return {
			productDone: base.productImagesDone,
			productTotal: base.productImagesTotal,
			aPlusDone: base.aPlusImagesDone,
			aPlusTotal: base.aPlusImagesTotal
		};
	}
	return {
		productDone: Math.max(0, Math.min(base.productImagesDone - 2, base.productImagesTotal)),
		productTotal: base.productImagesTotal,
		aPlusDone: Math.max(0, Math.min(base.aPlusImagesDone - 2, base.aPlusImagesTotal)),
		aPlusTotal: base.aPlusImagesTotal
	};
}

function siteMediaProgress(site: string): LocaleMediaProgress {
	return mediaByLocale(site, primaryLangForSite(site));
}

function siteReadiness(site: string): { text: string; type: "success" | "warning" | "info" } {
	const lang = localeCodeForSite(site);
	const copy = getCopyByLocale(site, lang);
	const copyAll = Boolean(copy.title || copy.description || copy.bullets.some(Boolean));
	const m = siteMediaProgress(site);
	const imageReady = m.productDone > 0 || m.aPlusDone > 0;
	if (copyAll && imageReady) return { text: "已就绪", type: "success" };
	if (copyAll || imageReady) return { text: "部分缺失", type: "warning" };
	return { text: "未配置", type: "info" };
}

function copyReadiness(lang: string): { text: string; type: "success" | "warning" | "info" } {
	const copy = getCopyByLocale(lang, lang);
	const hasTitle = Boolean(String(copy.title || "").trim());
	const hasBullets = copy.bullets.some((x) => Boolean(String(x || "").trim()));
	const hasDesc = Boolean(String(copy.description || "").trim());
	const filled = [hasTitle, hasBullets, hasDesc].filter(Boolean).length;
	if (filled === 3) return { text: "已就绪", type: "success" };
	if (filled > 0) return { text: "部分缺失", type: "warning" };
	return { text: "未配置", type: "info" };
}

async function baiduTranslateFromZh(text: string): Promise<any> {
	const api = (service as any).app?.design_task;
	if (!api?.request) throw new Error("翻译接口不可用");
	const res = await api.request({
		url: "/translateFromZh",
		method: "POST",
		data: { text: String(text || "").trim() }
	});
	const raw = res?.data ?? res;
	return raw?.data !== undefined ? raw.data : raw;
}

async function translateOtherLanguageCards() {
	const seed = getCopyByLocale("EN", "EN");
	const sourceTexts = [seed.title, ...seed.bullets, seed.description].map((x) => String(x || "").trim());
	if (!sourceTexts.some(Boolean)) {
		ElMessage.warning("当前无可翻译文案");
		return;
	}
	translatingOtherLangs.value = true;
	try {
		const [titleRes, ...allResults] = await Promise.all([
			seed.title ? baiduTranslateFromZh(seed.title) : Promise.resolve({}),
			...seed.bullets.map((line) => (line ? baiduTranslateFromZh(line) : Promise.resolve({}))),
			seed.description ? baiduTranslateFromZh(seed.description) : Promise.resolve({})
		]);
		const bulletResults = allResults.slice(0, 5);
		const descRes = allResults[5] || {};

		const targetMap: Record<string, "fr" | "it" | "es"> = {
			FR: "fr",
			IT: "it",
			ES: "es"
		};
		for (const lang of EXTRA_COPY_LANGS) {
			const key = targetMap[lang];
			translatedCopyByLang.value[key] = {
				title: String(titleRes?.[key] || ""),
				bullets: bulletResults.map((x: any) => String(x?.[key] || "")).slice(0, 5),
				description: String(descRes?.[key] || ""),
				variantTitles: {},
				variantCopy: {}
			};
		}
		enabledExtraCopyLangs.value = [...EXTRA_COPY_LANGS];
		saveTranslationCache(Number(activeMsku.value?.currentAiTaskId || 0));
		await remountCopyEditors();
		ElMessage.success("已生成 FR/IT/ES 翻译卡片");
	} catch (e: any) {
		const msg = e?.response?.data?.message ?? e?.response?.data?.msg ?? e?.message ?? "翻译失败";
		ElMessage.error(typeof msg === "string" ? msg : "翻译失败");
	} finally {
		translatingOtherLangs.value = false;
	}
}

function productGridStyleFor(total: number): Record<string, string> {
	const n = Math.max(total, 1);
	const cols = Math.min(n <= 4 ? n : n <= 8 ? 4 : 6, 8);
	return { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
}

const topMskuList = computed(() => mskuList.value.map((m) => m.msku));
const topAccountList = computed(() => (skuRow.value ? skuRow.value.accounts : []));
const topVariantList = computed(() => (skuRow.value ? skuRow.value.variants : []));

const skuOverallStatusText = computed(() => {
	if (!skuRow.value) return "准备中";
	const points = skuRow.value.mskuCardPoints || [];
	if (!points.length) return "准备中";
	const allUploaded = points.every((p) => p.tone === "uploaded");
	const hasBlocked = points.some((p) => p.tone === "blocked");
	if (allUploaded) return "已完成";
	if (!hasBlocked) return "待上传";
	return "准备中";
});

const skuOverallTagType = computed((): "success" | "warning" | "info" => {
	if (skuOverallStatusText.value === "已完成") return "success";
	if (skuOverallStatusText.value === "待上传") return "warning";
	return "info";
});

type ChainStepKey = "copy" | "listing" | "design" | "upload";
type ReadyChainState = "need_action" | "in_progress" | "done" | "waiting_pre";
interface ReadyChainStep {
	key: string;
	label: string;
	state: ReadyChainState;
	reason: string;
	reasonHint?: string;
	muted?: boolean;
	dependsOn?: string[];
	actionLabel?: string;
}

function withDesignTooNewPresentation(
	step: ReadyChainStep,
	designCode: number,
	tooNewInfo: DesignTaskTooNewInfo
): ReadyChainStep {
	if (!tooNewInfo.tooNew || designCode !== 101) return step;
	return {
		...step,
		reasonHint: designTooNewReasonHint(tooNewInfo),
		muted: true
	};
}
interface StateChainLiteTag {
	text: string;
	type: "success" | "warning" | "danger" | "info";
}

const readyChainSteps = computed<ReadyChainStep[]>(() => {
	const tone = activeMskuStatus.value?.tone;
	const listingDone = activeMsku.value?.listingStatus === "done";
	const uploadDone = activeMsku.value?.uploadStatus === "done";
	const aiNode = activeGraphNodes.value.find((x: any) => x.domain === "ai" && x.isCurrent);
	const designNode = activeGraphNodes.value.find((x: any) => x.domain === "design" && x.isCurrent);
	if (aiNode || designNode) {
		const aiStatus = String(aiNode?.status || "").toLowerCase();
		const aiStage = String(aiNode?.stage || "").toLowerCase();
		const aiDetailStage = mapAiStatusTextZh(aiNode?.stage || "");
		const aiDetailStatus = mapAiStatusTextZh(aiNode?.status || "");
		const aiAwaitingReview =
			aiStage.includes("awaiting_review") ||
			aiStage.includes("pending_review") ||
			aiStatus.includes("awaiting_review") ||
			aiStage.includes("待确认") ||
			aiStage.includes("待审核");
		const aiException =
			["failed", "blocked", "cancelled"].includes(aiStatus) ||
			aiStage.includes("fail") ||
			aiStage.includes("error") ||
			aiStage.includes("exception") ||
			aiStage.includes("cancel");
		const copyState: ReadyChainState = aiException || aiAwaitingReview
			? "need_action"
			: aiStatus === "done"
			? "done"
			: "in_progress";
		const designCode = Number(designNode?.stage || designNode?.status || 0);
		const designStatusText = designTaskStatusText(designCode);
		const designNeedActionKind =
			designCode === 101 || designStatusText === "待选参考图"
				? "select_ref"
				: designCode === 103 || designStatusText === "待审核"
				? "review"
				: "";
		const designDone = designCode === 401 || designCode === 500 || designStatusText === "待上传";
		const designNeedAction = Boolean(designNeedActionKind);
		const designState: ReadyChainState = designDone
			? "done"
			: designNeedAction
			? "need_action"
			: "in_progress";

		const listingBase: ReadyChainState = listingDone ? "done" : "need_action";
		const listingState: ReadyChainState =
			copyState === "done" ? listingBase : "waiting_pre";

		const uploadDoneNow = uploadDone || tone === "uploaded";
		const uploadState: ReadyChainState = uploadDoneNow
			? "done"
			: listingState === "done" && designState === "done"
			? "need_action"
			: "waiting_pre";

		const copyStep: ReadyChainStep = {
			key: "copy",
			label: "文案",
			state: copyState,
			reason:
				copyState === "done"
					? `详细状态：${aiDetailStage || aiDetailStatus || "已完成"}`
					: copyState === "need_action"
					? `详细状态：${aiDetailStage || aiDetailStatus || "待确认/异常"}`
					: `详细状态：${aiDetailStage || aiDetailStatus || "进行中"}`,
			actionLabel: "去文案"
		};
		const listingStep: ReadyChainStep = {
			key: "listing",
			label: "刊登",
			state: listingState,
			reason:
				listingState === "done"
					? "详细状态：已完成刊登"
					: listingState === "waiting_pre"
					? "等待前置步骤：文案"
					: "详细状态：未刊登",
			dependsOn: ["文案"],
			actionLabel: "去刊登"
		};
		const designTooNewInfo = evaluateDesignTaskTooNew({
			statusCode: designCode,
			createTime: designNode?.createTime ?? activeDesignCreateTime.value
		});
		const shootPurchaseSuffix = isDesignShootStatusCode(designCode)
			? samplePurchaseChainSuffix(samplePurchaseForChain.value)
			: "";
		const designReasonBase =
			designState === "done"
				? `详细状态：${designStatusText || "待上传"}`
				: designState === "need_action"
				? `详细状态：${designStatusText || "待处理"}`
				: `详细状态：${designStatusText || String(designCode || "进行中")}`;
		const designStep: ReadyChainStep = withDesignTooNewPresentation(
			{
				key: "design",
				label: "制图",
				state: designState,
				reason: designReasonBase + shootPurchaseSuffix,
				actionLabel:
					designState === "need_action"
						? designNeedActionKind === "review"
							? "去审核图需"
							: "去生成图需"
						: undefined
			},
			designCode,
			designTooNewInfo
		);
		const uploadStep: ReadyChainStep = {
			key: "upload",
			label: "图片上传",
			state: uploadState,
			reason:
				uploadState === "done"
					? "详细状态：已完成上传"
					: uploadState === "waiting_pre"
					? "等待前置步骤：刊登 + 制图"
					: "详细状态：未上传",
			dependsOn: ["刊登", "制图"],
			actionLabel: uploadState === "need_action" ? "去上传" : undefined
		};
		return [copyStep, listingStep, designStep, uploadStep];
	}

	const statusText = activeMskuStatus.value?.cardPoint || "";
	const timelineText = activeMskuTimeline.value.map((x) => x.content).join(" | ");
	const hasCopyAiGenerated =
		timelineText.includes("文案 AI 推荐已生成") ||
		statusText.includes("文案:待运营确认") ||
		tone === "pending_upload" ||
		tone === "uploaded";
	const copyConfirmed = tone === "pending_upload" || tone === "uploaded";
	const copyBlocked = statusText.includes("文案") && !copyConfirmed;

	const imageReadyToUpload = tone === "pending_upload" || tone === "uploaded";
	const imageBlocked =
		(statusText.includes("图需") || statusText.includes("商品图") || statusText.includes("A+")) &&
		!imageReadyToUpload;

	let copyStep: ReadyChainStep = {
		key: "copy",
		label: "文案",
		state: "in_progress",
		reason: "文案进行中",
		actionLabel: "去文案"
	};
	if (copyBlocked) {
		copyStep = {
			key: "copy",
			label: "文案",
			state: "need_action",
			reason: "文案需处理（异常或待审核）",
			actionLabel: "去文案"
		};
	} else if (copyConfirmed) {
		copyStep = { key: "copy_branch", label: "文案", state: "done", reason: "文案已完成" };
	} else if (hasCopyAiGenerated) {
		copyStep = {
			key: "copy_branch",
			label: "文案",
			state: "need_action",
			reason: "文案需处理（待审核）",
			actionLabel: "去文案"
		};
	}

	let listingStep: ReadyChainStep = {
		key: "listing",
		label: "刊登",
		state: listingDone ? "done" : copyStep.state === "done" ? "need_action" : "waiting_pre",
		reason: listingDone
			? "刊登已完成"
			: copyStep.state === "done"
			? "刊登需处理（未刊登）"
			: "等待前置步骤：文案",
		dependsOn: ["文案"],
		actionLabel: "去刊登"
	};

	let designStep: ReadyChainStep = {
		key: "design",
		label: "制图",
		state: "in_progress",
		reason: "制图进行中",
		actionLabel: undefined
	};
	if (imageBlocked) {
		const fallbackDesignCode = Number(activeMsku.value?.designTaskStatus ?? 101);
		const fallbackTooNew = evaluateDesignTaskTooNew({
			statusCode: fallbackDesignCode,
			createTime: activeMsku.value?.designTaskCreateTime
		});
		designStep = withDesignTooNewPresentation(
			{
				key: "design",
				label: "制图",
				state: "need_action",
				reason: "制图需处理（待选参考图/待审核）",
				actionLabel: "去生成图需"
			},
			fallbackDesignCode,
			fallbackTooNew
		);
	} else if (imageReadyToUpload) {
		designStep = { key: "design", label: "制图", state: "done", reason: "制图已完成（待上传）" };
	}

	let uploadStep: ReadyChainStep = {
		key: "upload",
		label: "图片上传",
		state: "waiting_pre",
		reason: "等待前置步骤：刊登 + 制图",
		dependsOn: ["刊登", "制图"],
		actionLabel: undefined
	};
	if (uploadDone || tone === "uploaded") {
		uploadStep = { key: "upload", label: "图片上传", state: "done", reason: "已上传完成" };
	} else if (listingStep.state === "done" && designStep.state === "done") {
		uploadStep = {
			key: "upload",
			label: "图片上传",
			state: "need_action",
			reason: "图片上传需处理（未上传）",
			actionLabel: "去上传"
		};
	} else {
		uploadStep = {
			key: "upload",
			label: "图片上传",
			state: "waiting_pre",
			reason: "等待前置步骤：刊登 + 制图",
			dependsOn: ["刊登", "制图"],
			actionLabel: "去刊登"
		};
	}

	return [copyStep, listingStep, designStep, uploadStep];
});

const readyChainOverallText = computed(() => {
	const steps = readyChainSteps.value;
	if (steps.every((s) => s.state === "done")) return "链路完成";
	if (steps.some((s) => s.state === "need_action")) return "存在需处理节点";
	return "进行中";
});

const readyChainOverallTagType = computed((): "success" | "danger" | "warning" => {
	if (readyChainOverallText.value === "链路完成") return "success";
	if (readyChainOverallText.value === "存在需处理节点") return "danger";
	return "warning";
});

const readyStepMap = computed(() => {
	const map = new Map<string, ReadyChainStep>();
	readyChainSteps.value.forEach((step) => map.set(step.key, step));
	return map;
});

const dagNodes = computed<
	Array<{
		key: ChainStepKey;
		label: string;
		state: ReadyChainState;
		className: string;
		reason: string;
		reasonHint?: string;
		muted?: boolean;
		dependsOn?: string[];
		actionLabel?: string;
	}>
>(() => {
	const stepInfo = (key: ChainStepKey): ReadyChainStep | undefined => readyStepMap.value.get(key);
	return [
		{
			key: "copy",
			label: "文案",
			state: stepInfo("copy")?.state || "in_progress",
			className: "pos-copy",
			reason: stepInfo("copy")?.reason || "",
			reasonHint: stepInfo("copy")?.reasonHint,
			muted: stepInfo("copy")?.muted,
			dependsOn: stepInfo("copy")?.dependsOn,
			actionLabel: stepInfo("copy")?.actionLabel
		},
		{
			key: "listing",
			label: "刊登",
			state: stepInfo("listing")?.state || "waiting_pre",
			className: "pos-listing",
			reason: stepInfo("listing")?.reason || "",
			reasonHint: stepInfo("listing")?.reasonHint,
			muted: stepInfo("listing")?.muted,
			dependsOn: stepInfo("listing")?.dependsOn,
			actionLabel: stepInfo("listing")?.actionLabel
		},
		{
			key: "design",
			label: "制图",
			state: stepInfo("design")?.state || "in_progress",
			className: "pos-design",
			reason: stepInfo("design")?.reason || "",
			reasonHint: stepInfo("design")?.reasonHint,
			muted: stepInfo("design")?.muted,
			dependsOn: stepInfo("design")?.dependsOn,
			actionLabel: stepInfo("design")?.actionLabel
		},
		{
			key: "upload",
			label: "图片上传",
			state: stepInfo("upload")?.state || "waiting_pre",
			className: "pos-upload",
			reason: stepInfo("upload")?.reason || "",
			reasonHint: stepInfo("upload")?.reasonHint,
			muted: stepInfo("upload")?.muted,
			dependsOn: stepInfo("upload")?.dependsOn,
			actionLabel: stepInfo("upload")?.actionLabel
		}
	];
});

const dagEdges = computed<
	Array<{
		key: string;
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		baseClass?: string;
		stateClass: string;
	}>
>(() => {
	const stateOf = (key: ChainStepKey): ReadyChainState =>
		readyStepMap.value.get(key)?.state || "in_progress";
	const edgeStateClass = (from: ChainStepKey, to: ChainStepKey) => {
		const fromState = stateOf(from);
		if (fromState === "done") return "state-done";
		return "state-pending";
	};
	return [
		{
			key: "copy-listing",
			x1: 200,
			y1: 72,
			x2: 385,
			y2: 72,
			stateClass: edgeStateClass("copy", "listing")
		},
		{
			key: "listing-upload",
			x1: 615,
			y1: 72,
			x2: 750,
			y2: 72,
			stateClass: edgeStateClass("listing", "upload")
		},
		{
			key: "design-upload",
			x1: 200,
			y1: 228,
			x2: 750,
			y2: 72,
			baseClass: "dashed",
			stateClass: edgeStateClass("design", "upload")
		}
	];
});

const activeTab = ref("base");

function statusLabel(s: LcsSkuRow["status"]) {
	const map: Record<LcsSkuRow["status"], string> = {
		draft: "草稿",
		asset: "制图",
		copy: "文案",
		ready: "待上架"
	};
	return map[s];
}

function statusTagType(s: LcsSkuRow["status"]): "info" | "warning" | "success" {
	if (s === "draft") return "info";
	if (s === "ready") return "success";
	return "warning";
}

function mskuStatusTagType(
	tone: "blocked" | "pending_upload" | "uploaded" | undefined
): "success" | "warning" | "danger" | "info" {
	if (!tone) return "info";
	if (tone === "uploaded") return "success";
	if (tone === "pending_upload") return "warning";
	return "danger";
}

function compactStateTagsByMsku(msku: string): StateChainLiteTag[] {
	const point = skuRow.value?.mskuCardPoints?.find((x) => mskuKeysEquivalent(x.msku, msku));
	if (!point) return [{ text: "文案：需处理", type: "info" }];
	return deriveCompactTags(
		{
			aiStatus: point.aiStatus,
			aiStage: point.aiStage,
			designStatus: point.designStatus,
			designStage: point.designStage,
			designTaskCreateTime: point.designTaskCreateTime,
			listingStatus: point.listingStatus,
			uploadStatus: point.uploadStatus
		},
		2
	);
}

function handleResolveStep(key: string) {
	const stepKey = key as ChainStepKey;
	const stepState = readyStepMap.value.get(stepKey)?.state;
	if (stepState !== "need_action") return;
	if (stepKey === "copy") {
		openAiCopyTaskDetailDialog();
		return;
	}
	if (stepKey === "design") {
		const taskId = Number(activeCurrentDesignNode.value?.taskId || 0);
		if (!taskId) {
			ElMessage.warning("未找到对应图需任务");
			return;
		}
		const stageText = String(activeCurrentDesignNode.value?.stage || "");
		const stageCode = Number(stageText || activeCurrentDesignNode.value?.status || 0);
		const isReview = stageText.includes("待审核") || stageCode === 103;
		const isPickRef = stageText.includes("待选参考图") || stageCode === 101;
		if (!isReview && !isPickRef) return;
		if (isReview) {
			designReviewTaskId.value = taskId;
			designReviewDialogVisible.value = true;
			return;
		}
		openDesignRequirementWithTooNewGuard(taskId, stageCode, activeDesignCreateTime.value);
		return;
	}
	if (stepKey === "listing") {
		activeTab.value = "copy";
		return;
	}
	// key === upload
	activeTab.value = "media";
}

function stepStateLabel(state: ReadyChainState) {
	if (state === "done") return "完成";
	if (state === "need_action") return "需处理";
	if (state === "waiting_pre") return "等待前置步骤";
	return "进行中";
}

function stepStateTagType(state: ReadyChainState): "success" | "danger" | "info" {
	if (state === "done") return "success";
	if (state === "need_action") return "danger";
	return "info";
}

const canMarkListingDone = computed(() => {
	if (!activeMsku.value?.workItemId) return false;
	if (activeMsku.value?.listingStatus === "done") return false;
	const copyStep = readyStepMap.value.get("copy");
	return copyStep?.state === "done";
});

const canMarkUploadDone = computed(() => {
	if (!activeMsku.value?.workItemId) return false;
	if (activeMsku.value?.uploadStatus === "done") return false;
	const listingStep = readyStepMap.value.get("listing");
	const designStep = readyStepMap.value.get("design");
	return listingStep?.state === "done" && designStep?.state === "done";
});

function openSellerSkuDialog() {
	if (!activeMsku.value?.msku) {
		ElMessage.warning("请先在左侧选择一个 MSKU");
		return;
	}
	sellerSkuDraft.value = String(activeMsku.value.sellerSku || "");
	sellerSkuDialogVisible.value = true;
}

async function copySellerSkuToClipboard() {
	const text = String(activeMsku.value?.sellerSku || "").trim();
	if (!text) return;
	try {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
			ElMessage.success("已复制上架 SKU");
			return;
		}
		throw new Error("Clipboard API 不可用或非安全上下文");
	} catch (clipboardError) {
		console.warn("[copySellerSkuToClipboard] Clipboard API failed:", clipboardError);
		try {
			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			textarea.style.left = "-9999px";
			document.body.appendChild(textarea);
			textarea.focus();
			textarea.select();
			textarea.setSelectionRange(0, text.length);
			const ok = document.execCommand("copy");
			document.body.removeChild(textarea);
			if (!ok) throw new Error("execCommand copy returned false");
			ElMessage.success("已复制上架 SKU");
		} catch (fallbackError) {
			console.error("[copySellerSkuToClipboard] Fallback copy failed:", fallbackError);
			ElMessage.error("复制失败");
		}
	}
}

async function saveSellerSku() {
	const msku = String(activeMsku.value?.msku || "").trim();
	if (!msku) return;
	const api = (service as any).app?.content_workbench;
	if (!api?.updateSellerSku) {
		ElMessage.error("后端 updateSellerSku 接口不可用");
		return;
	}
	const draft = String(sellerSkuDraft.value || "").trim();
	if (draft && !/^[A-Za-z0-9-]+$/.test(draft)) {
		ElMessage.warning("上架 SKU 仅支持字母、数字和连字符 -");
		return;
	}
	sellerSkuSaving.value = true;
	try {
		await api.updateSellerSku({
			msku,
			seller_sku: draft || null
		});
		ElMessage.success(draft ? "上架 SKU 已保存" : "已清除上架 SKU");
		sellerSkuDialogVisible.value = false;
		const idx = mskuList.value.findIndex((x) => mskuKeysEquivalent(x.msku, msku));
		if (idx >= 0) {
			mskuList.value[idx] = {
				...mskuList.value[idx],
				sellerSku: draft || null
			};
		}
	} catch (e: any) {
		ElMessage.error(e?.message || "保存失败");
	} finally {
		sellerSkuSaving.value = false;
	}
}

async function refreshCurrentSkuData() {
	const skuCode = sku.value;
	if (!skuCode) return;
	const selectedWorkItemId = Number(activeMsku.value?.workItemId || 0);
	const selectedMsku = activeMsku.value?.msku || targetMsku.value || "";
	const data = await loadStudioDetailBySku(skuCode, selectedMsku || undefined);
	skuRow.value = data.skuRow;
	mskuList.value = data.mskuList || [];
	const matchedByWorkItem = selectedWorkItemId
		? mskuList.value.find((x) => Number(x.workItemId || 0) === selectedWorkItemId)
		: undefined;
	const matchedByMsku = selectedMsku ? findMskuRow(mskuList.value, selectedMsku) : undefined;
	const matched = matchedByWorkItem || matchedByMsku;
	activeMskuId.value = matched?.id ?? mskuList.value[0]?.id ?? "";
	await refreshActiveAiCopyResult();
	await remountCopyEditors();
	await refreshActiveWorkbenchDetail();
}

async function markListingDone() {
	const workItemId = Number(activeMsku.value?.workItemId || 0);
	if (!workItemId) return;
	const titleViolations = collectWorkbenchTitleLimitViolations();
	if (titleViolations.length) {
		ElMessage.error(`以下标题超出 ${LISTING_TITLE_AMAZON_MAX} 字上限：${titleViolations.join("；")}`);
		return;
	}
	const copy = buildWorkbenchCopyPayload();
	if (!copy.en && !copy.de) {
		ElMessage.warning("无文案可保存");
		return;
	}
	markListingSaving.value = true;
	try {
		await callContentWorkbenchApi("markListingDone", { workItemId, copy });
		ElMessage.success("文案已保存，并已标记刊登完成");
		await refreshActiveAiCopyResult();
		const nextDrafts: Record<string, LocaleCopyData> = {};
		for (const lang of activeCopyLangs.value) {
			nextDrafts[lang] = cloneLocaleDraft(lang);
		}
		copyDrafts.value = nextDrafts;
		await refreshCurrentSkuData();
	} catch (err: any) {
		ElMessage.error(err?.message || "操作失败");
	} finally {
		markListingSaving.value = false;
	}
}

async function markUploadDone() {
	const workItemId = Number(activeMsku.value?.workItemId || 0);
	if (!workItemId) return;
	if (!(service as any).app?.content_workbench?.markUploadDone) {
		ElMessage.error("后端 markUploadDone 接口不可用");
		return;
	}
	await (service as any).app.content_workbench.markUploadDone({ workItemId });
	ElMessage.success("已标记图片上传完成");
	await refreshCurrentSkuData();
	await fetchMskuUploadInfo();
}

function pickRootAiTaskId(task: any) {
	const mode = String(task?.task_mode || "full");
	if (mode === "delta") {
		const rootId = Number(task?.root_task_id || task?.merge_into_task_id || 0);
		if (rootId > 0) return rootId;
	}
	return Number(task?.id || 0);
}

async function resolveMasterAiCopyTaskId() {
	const api = (service as any).app?.ai_listing_task;
	if (!api) return 0;
	const skuCode = skuRow.value?.sku || sku.value || "";
	const candidateId = Number(activeMsku.value?.candidateId || 0);
	const directTaskId = Number(activeMsku.value?.currentAiTaskId || 0);

	if (directTaskId && api.status) {
		try {
			const statusRes = await api.status({ id: directTaskId });
			const task = statusRes?.data ?? statusRes;
			const rootId = pickRootAiTaskId(task);
			if (rootId > 0) return rootId;
		} catch {
			// fall through to page lookup
		}
	}

	if (!api.page) return 0;
	const resp = await api.page({
		page: 1,
		size: 100,
		keyword: skuCode || String(candidateId || "")
	});
	const data = resp?.data ?? resp;
	const rows = Array.isArray(data?.list) ? data.list : [];
	const sameCandidate = (r: any) =>
		!candidateId || Number(r?.candidate_id || 0) === candidateId;

	const fullTask = rows.find(
		(r: any) => sameCandidate(r) && String(r?.task_mode || "full") === "full"
	);
	if (fullTask?.id) return Number(fullTask.id);

	const anyTask = rows.find((r: any) => sameCandidate(r));
	if (!anyTask?.id) return 0;
	if (String(anyTask.task_mode || "") === "delta") {
		return Number(anyTask.root_task_id || anyTask.merge_into_task_id || anyTask.id);
	}
	return Number(anyTask.id);
}

async function openMasterCopyEditDialog() {
	if (!activeMsku.value) {
		ElMessage.warning("请先在左侧选择一个 MSKU");
		return;
	}
	resolvingMasterCopyTask.value = true;
	try {
		const taskId = await resolveMasterAiCopyTaskId();
		if (!taskId) {
			ElMessage.warning("未找到对应的 AI 文案主任务");
			return;
		}
		aiCopyDetailTaskId.value = taskId;
		aiCopyDetailDialogVisible.value = true;
	} catch (err: any) {
		ElMessage.error(err?.message || "打开母版文案编辑失败");
	} finally {
		resolvingMasterCopyTask.value = false;
	}
}

async function openAiCopyTaskDetailInNewTab() {
	const taskId = await resolveMasterAiCopyTaskId();
	if (!taskId) {
		ElMessage.warning("未找到对应的 AI 文案主任务");
		return;
	}
	const href = router.resolve({
		path: "/app/listing-ai-copy-task/detail",
		query: { id: String(taskId) }
	}).href;
	window.open(href, "_blank");
}

async function openAiCopyTaskDetailDialog() {
	const taskId = await resolveMasterAiCopyTaskId();
	if (!taskId) {
		ElMessage.warning("未找到对应的 AI 文案主任务");
		return;
	}
	aiCopyDetailTaskId.value = taskId;
	aiCopyDetailDialogVisible.value = true;
}

async function handleAiCopyDetailDialogClosed() {
	aiCopyDetailTaskId.value = 0;
	await refreshCurrentSkuData();
}

async function handleDesignRequirementDialogChange() {
	await refreshCurrentSkuData();
}

function openDesignRequirementDialog(taskId: number) {
	void designRequirementDialogRef.value?.open(taskId);
}

function openDesignRequirementWithTooNewGuard(
	taskId: number,
	statusCode: number,
	createTime?: string | number | Date | null
) {
	const info = evaluateDesignTaskTooNew({ statusCode, createTime });
	if (!info.tooNew) {
		openDesignRequirementDialog(taskId);
		return;
	}
	pendingDesignOpenTaskId.value = taskId;
	designTooNewDialogVisible.value = true;
}

function onDesignTooNewConfirm() {
	const taskId = pendingDesignOpenTaskId.value;
	pendingDesignOpenTaskId.value = 0;
	if (taskId) openDesignRequirementDialog(taskId);
}

function handleSkuAction() {
	if (!activeMsku.value) {
		ElMessage.warning("请先在左侧选择一个 MSKU");
		return;
	}
	if (isSkuDesignActionDisabled.value) {
		ElMessage.warning("图需已进入 2xx 及以上阶段，不允许创建/更新图需");
		return;
	}
	const taskId = currentDesignTaskId.value;
	if (!taskId) {
		ElMessage.warning("未找到对应图需任务，暂无法打开图需管理");
		return;
	}
	openDesignRequirementWithTooNewGuard(
		taskId,
		currentDesignStageCode.value,
		activeDesignCreateTime.value
	);
}

function goList() {
	router.push({ path: "/app/listing-content-studio" });
}
</script>

<style scoped lang="scss">
.lcs-studio-page {
	padding: 20px;
	background: var(--el-bg-color-page);
	min-height: 100%;
	box-sizing: border-box;
}

.studio-top {
	margin-bottom: 16px;
}

.sku-top-panel {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 14px 16px;
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 10px;
}

.back-btn {
	padding-left: 0;
	margin-bottom: 12px;
}

.head-main {
	display: flex;
	gap: 16px;
	align-items: flex-start;
}

.hero-thumb {
	width: 72px;
	height: 72px;
	border-radius: 10px;
	border: 1px solid var(--el-border-color-lighter);
	flex-shrink: 0;
}

.head-text {
	min-width: 0;
}

.sku-actions {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
	justify-content: flex-end;
}

.sku-line {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 6px;
}

.sku-code {
	font-size: 13px;
	font-weight: 600;
	font-family: ui-monospace, monospace;
}

.title {
	margin: 0 0 8px;
	font-size: 20px;
	font-weight: 600;
	line-height: 1.3;
}

.meta-row {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	font-size: 13px;
}

.meta-metric {
	cursor: default;
	border-bottom: 1px dashed var(--el-border-color);
	padding-bottom: 1px;
}

.muted {
	color: var(--el-text-color-secondary);
}

.muted.small {
	font-size: 12px;
}

.variant-line {
	margin-top: 2px;
}

.owner-line {
	margin-top: 6px;
}

.studio-body {
	display: flex;
	gap: 16px;
	align-items: stretch;
	min-height: 520px;
}

.msku-rail {
	width: 280px;
	flex-shrink: 0;
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	display: flex;
	flex-direction: column;
}

.rail-title {
	padding: 12px 14px;
	font-weight: 600;
	font-size: 13px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	line-height: 1.35;
}

.rail-scroll {
	flex: 1;
	padding: 8px;
}

.shop-group {
	margin-bottom: 12px;
}

.shop-group-title {
	font-size: 12px;
	font-weight: 600;
	color: var(--el-text-color-regular);
	padding: 4px 6px 8px;
}

.msku-item {
	display: block;
	width: 100%;
	text-align: left;
	border: 1px solid transparent;
	border-radius: 8px;
	padding: 10px;
	margin-bottom: 6px;
	background: var(--el-fill-color-blank);
	cursor: pointer;
	transition: border-color 0.15s, background 0.15s;

	&:hover {
		border-color: var(--el-border-color);
	}

	&.active {
		border-color: var(--el-color-primary-light-5);
		background: var(--el-color-primary-light-9);
	}
}

.msku-row {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	gap: 8px;
	margin-bottom: 4px;
}

.msku-inline-code,
.seller-sku-row .msku-inline-code {
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: 12px;
}

.seller-sku-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
}

.seller-sku-dialog-hint {
	margin: 0 0 12px;
	font-size: 13px;
}

.seller-sku-dialog-sys {
	margin: 12px 0 0;
	font-size: 12px;
}

.msku-code {
	font-size: 12px;
}

.asin {
	margin-top: 4px;
}

.studio-main {
	flex: 1;
	min-width: 0;
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	padding: 8px 16px 16px;
}

.five-market-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	gap: 12px;
	align-items: start;
}

.copy-five {
	grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 1200px) {
	.copy-five {
		grid-template-columns: 1fr;
	}
}

.tab-top-actions {
	grid-column: 1 / -1;
	display: flex;
	align-items: center;
	gap: 10px;
}

.media-tab {
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.media-tab .checklist-card,
.media-tab .upload-paths-card {
	border-radius: 6px;
}
.media-tab .section-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12px;
}
.media-tab .section-title {
	font-size: 15px;
	font-weight: 600;
}
.media-tab .section-tip {
	margin-top: 4px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}
.media-tab .section-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}
.media-tab .sort-mode-switch {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}
.media-tab .sort-mode-switch > span.active {
	color: var(--el-color-primary);
	font-weight: 600;
}
.media-tab .requirements-text {
	font-size: 14px;
	color: #303133;
	white-space: pre-wrap;
	line-height: 1.5;
}
.media-tab .text-value {
	font-size: 14px;
	color: #303133;
}
.media-tab .upload-paths-card :deep(.el-card__header) {
	padding: 10px 14px;
}
.media-tab .upload-paths-card :deep(.el-card__body) {
	padding: 12px 14px;
}
.upload-path-block {
	&:not(:first-child) {
		margin-top: 14px;
		padding-top: 14px;
		border-top: 1px dashed var(--el-border-color-lighter);
	}
}
.upload-path-label {
	display: flex;
	align-items: center;
	gap: 8px;
	font-weight: 600;
	font-size: 13px;
	margin-bottom: 6px;
}
.upload-path-text {
	font-family: var(--el-font-family-mono, monospace);
	font-size: 12px;
	color: var(--el-text-color-primary);
	background: var(--el-fill-color);
	border-radius: 4px;
	padding: 6px 10px;
	word-break: break-all;
	margin-bottom: 6px;
}
.mt-8 {
	margin-top: 8px;
}

.market-card {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	padding: 10px 12px;
	background: var(--el-fill-color-blank);
	min-width: 0;
}

.market-card-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 10px;
	margin-bottom: 10px;
}

.market-card-head-main {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	flex: 1;
	min-width: 0;
}

.market-card-head-main .site-code {
	font-weight: 700;
	font-size: 14px;
	letter-spacing: 0.02em;
}

.market-card-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	flex-shrink: 0;
}

.title-char-badge {
	margin-left: 8px;
	font-size: 12px;
	font-variant-numeric: tabular-nums;
	color: var(--el-text-color-secondary);
}

.title-char-badge.is-over {
	color: var(--el-color-danger);
	font-weight: 600;
}

.media-panel-body {
	position: relative;
	transition: opacity 0.15s ease;
}

.media-panel-body.is-locked {
	pointer-events: none;
	opacity: 0.88;
	user-select: none;
}

.locale-pair {
	font-variant-numeric: tabular-nums;
}

.copy-five .copy-form--compact,
.media-five .panel-section {
	max-width: none;
}

.copy-five .copy-form--compact :deep(.el-textarea__inner) {
	overflow-y: hidden;
	resize: none;
}

.studio-tabs {
	:deep(.el-tabs__content) {
		padding-top: 8px;
	}
}

.desc-block {
	margin-top: 4px;
}

.base-lang-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

.base-timeline-wrap {
	max-width: 100%;
}

.base-timeline-wrap :deep(.custom-timeline--compact) {
	max-height: 180px;
	padding: 0;
}

:deep(.el-dialog__body) {
	padding-top: 8px;
}

.major-steps-wrap {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.dep-dag {
	position: relative;
	width: 100%;
	height: 310px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	background: var(--el-fill-color-blank);
}

.dep-dag-lines {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
}

.dag-line {
	stroke: var(--el-border-color);
	stroke-width: 2;
	transition: stroke 0.2s ease, stroke-width 0.2s ease;
}

.dag-line.dashed {
	stroke-dasharray: 8 6;
}

.dag-line.state-pending {
	stroke: var(--el-border-color);
}

.dag-line.state-active {
	stroke: var(--el-color-primary);
	stroke-width: 2.5;
}

.dag-line.state-done {
	stroke: var(--el-color-success);
	stroke-width: 2.5;
}

.dag-line.state-blocked {
	stroke: var(--el-color-danger);
	stroke-width: 2.5;
	stroke-dasharray: 8 6;
}

.dag-node {
	position: absolute;
	transform: translate(-50%, -50%);
	width: 250px;
	padding: 10px 12px;
	border-radius: 8px;
	border: 1px solid var(--el-border-color);
	background: var(--el-fill-color-light);
	text-align: left;
	cursor: pointer;
}

.dag-node.pos-copy {
	left: 20%;
	top: 24%;
}

.dag-node.pos-listing {
	left: 50%;
	top: 24%;
}

.dag-node.pos-design {
	left: 20%;
	top: 76%;
}

.dag-node.pos-upload {
	left: 80%;
	top: 24%;
}

.dag-node.state-done {
	background: var(--el-color-success-light-9);
	border-color: var(--el-color-success-light-5);
}

.dag-node.state-need_action {
	background: var(--el-color-danger-light-9);
	border-color: var(--el-color-danger-light-5);
}

.dag-node.state-muted {
	background: var(--el-fill-color-light);
	border-color: var(--el-border-color);
	color: var(--el-text-color-secondary);
}

.dag-node.state-muted.state-need_action {
	background: var(--el-fill-color);
	border-color: var(--el-border-color-lighter);
}

.dag-node.state-muted .dag-node-title {
	color: var(--el-text-color-secondary);
}

.dag-node-reason-hint {
	margin-top: 4px;
	font-size: 11px;
	line-height: 1.35;
	color: var(--el-text-color-placeholder);
}

.dag-node-title {
	font-size: 13px;
	font-weight: 600;
	line-height: 1.2;
}

.dag-node-state {
	margin-top: 4px;
}

.dag-node-reason {
	margin-top: 6px;
	font-size: 12px;
	line-height: 1.35;
}

.dag-node-deps {
	margin-top: 4px;
	font-size: 12px;
}

.dag-node-action {
	margin-top: 6px;
	font-size: 12px;
	color: var(--el-color-primary);
}

.major-steps-head {
	display: flex;
	align-items: center;
	gap: 8px;
}

.panel-section {
	margin-bottom: 24px;
}

.panel-h {
	font-weight: 600;
	margin-bottom: 12px;
	font-size: 14px;
	line-height: 1.4;
}

.main-grid {
	display: grid;
	gap: 10px;
}

.main-slot {
	text-align: center;
}

.slot-preview {
	aspect-ratio: 1;
	border-radius: 8px;
	border: 1px dashed var(--el-border-color);
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--el-fill-color-light);
	position: relative;

	&.filled {
		border-style: solid;
		background: var(--el-color-success-light-9);
		border-color: var(--el-color-success-light-5);
	}
}

.slot-idx {
	font-size: 14px;
	font-weight: 600;
	color: var(--el-text-color-secondary);
}

.aplus-strip {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.aplus-cell {
	min-width: 88px;
	height: 64px;
	border-radius: 8px;
	border: 1px dashed var(--el-border-color);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	color: var(--el-text-color-secondary);
	background: var(--el-fill-color-light);

	&.filled {
		border-style: solid;
		background: var(--el-color-primary-light-9);
		border-color: var(--el-color-primary-light-5);
		color: var(--el-color-primary);
	}
}

.copy-form {
	max-width: 920px;
}

.bullets-section-label {
	font-size: 14px;
	font-weight: 600;
	color: var(--el-text-color-regular);
	margin: 8px 0 12px;
}

.bullet-form-item {
	margin-bottom: 14px;
}

.tiny {
	font-size: 11px;
	margin-top: 4px;
}

@media (max-width: 960px) {
	.sku-top-panel {
		flex-direction: column;
		align-items: flex-start;
	}

	.sku-actions {
		width: 100%;
		justify-content: flex-start;
	}

	.studio-body {
		flex-direction: column;
	}

	.msku-rail {
		width: 100%;
		max-height: 280px;
	}
}
</style>

<style lang="scss">
.top-list-tooltip {
	max-width: min(340px, 72vw);
	max-height: 240px;
	overflow-y: auto;
	padding: 2px 0;
	font-size: 13px;
	line-height: 1.45;
}

.top-list-line {
	padding: 2px 0;
	word-break: break-all;
}
</style>
