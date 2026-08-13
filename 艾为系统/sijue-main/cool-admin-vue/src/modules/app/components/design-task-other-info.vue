<template>
	<el-collapse v-model="activeNames" class="design-task-other-info">
		<el-collapse-item name="other-info" title="其他信息">
			<!-- 变体列表 -->
			<div class="variant-section">
				<div class="section-title">变体列表</div>
				<el-table :data="variants" border style="width: 100%">
					<el-table-column label="变体名称" prop="name" width="150" align="center" />
					<el-table-column label="变体图片" width="200" align="center">
						<template #default="{ row }">
							<image-zoom
								v-if="row.imageUrl"
								:src="row.imageUrl"
								fit="cover"
								class="variant-image"
							/>
							<span v-else class="no-image-text">无图</span>
						</template>
					</el-table-column>
					<el-table-column label="工厂链接组合" width="350" align="center">
						<template #default="{ row }">
							<div class="factory-link-groups">
								<template
									v-if="
										row.group_proportions &&
										Object.keys(row.group_proportions).length
									"
								>
									<div
										v-for="(val, id) in row.group_proportions"
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
						</template>
					</el-table-column>
					<el-table-column
						label="变体描述"
						prop="description"
						width="150"
						align="center"
					/>
					<el-table-column label="提交人" width="200" align="center">
						<template #default="{ row }">
							<div class="submitters">
								<el-tag
									v-for="(submitter, index) in getSubmitters(row.variantsid)"
									:key="index"
									type="info"
									class="submitter-tag"
								>
									{{ submitter }}
								</el-tag>
								<span
									v-if="getSubmitters(row.variantsid).length === 0"
									class="no-submitter"
									>暂无</span
								>
							</div>
						</template>
					</el-table-column>
				</el-table>
			</div>

			<!-- 工厂链接 -->
			<div class="factory-links-section">
				<div class="section-title">工厂链接</div>
				<el-table :data="factoryLinks" border style="width: 100%">
					<el-table-column label="类型" prop="type" width="120" align="center">
						<template #default="{ row }">
							<el-tag :type="getTypeTagType(row.type)">{{
								getTypeLabel(row.type)
							}}</el-tag>
						</template>
					</el-table-column>
					<el-table-column label="品名" prop="name" width="200" align="center" />
					<el-table-column label="价格" prop="price" width="120" align="center" />
					<el-table-column label="链接" prop="link" align="center">
						<template #default="{ row }">
							<a :href="row.link" target="_blank" class="factory-link">{{
								row.link
							}}</a>
						</template>
					</el-table-column>
					<el-table-column label="链接描述" prop="linkDescription" align="center" />
				</el-table>
			</div>

			<!-- 采购数量 -->
			<div class="purchase-section">
				<div class="section-title">采购数量</div>
				<el-table :data="purchases" border style="width: 100%">
					<el-table-column label="采购数量" width="100" align="center">
						<template #default>
							<span></span>
						</template>
					</el-table-column>
					<el-table-column label="英国" prop="uk" width="120" align="center" />
					<el-table-column label="德国" prop="de" width="120" align="center" />
					<el-table-column label="状态" width="130" align="center">
						<template #default="{ row }">
							<el-tag
								:type="
									row.status === '已确认'
										? 'success'
										: row.status === '已取消'
											? 'danger'
											: 'info'
								"
								effect="plain"
							>
								{{
									row.status === "已确认"
										? "✅ 已确认"
										: row.status === "已取消"
											? "❌ 已取消"
											: "⏳ 待决策"
								}}
							</el-tag>
						</template>
					</el-table-column>
					<el-table-column label="采购意见" prop="opinion" width="280" align="center" />
					<el-table-column label="选择变体" width="150" align="center">
						<template #default="{ row }">
							{{ getVariantName(row.variantId) || "-" }}
						</template>
					</el-table-column>
					<el-table-column label="合计" prop="total" width="100" align="center" />
					<el-table-column label="提交人" width="100" align="center">
						<template #default="{ row }">
							<el-tag v-if="row.submitter" type="info">{{ row.submitter }}</el-tag>
							<span v-else></span>
						</template>
					</el-table-column>
				</el-table>
				<div class="total-purchase">
					<el-text type="primary" size="large">采购总数: {{ purchaseTotal }}</el-text>
				</div>
			</div>
		</el-collapse-item>
	</el-collapse>
</template>

<script setup lang="ts" name="design-task-other-info">
import { ref, computed } from "vue";
// @ts-ignore
import ImageZoom from "/$/app/components/image-zoom.vue";

export interface VariantItem {
	variantsid: string;
	name: string;
	imageUrl?: string;
	group_proportions?: Record<string, number>;
	description?: string;
}

export interface FactoryLinkItem {
	id: string;
	type: string;
	name: string;
	price: number;
	link: string;
	linkDescription?: string;
}

export interface PurchaseItem {
	uk: number;
	de: number;
	status: string;
	opinion?: string;
	variantId?: string;
	total: number;
	submitter?: string;
}

const props = withDefaults(
	defineProps<{
		variants?: VariantItem[];
		factoryLinks?: FactoryLinkItem[];
		purchases?: PurchaseItem[];
		defaultExpanded?: boolean;
	}>(),
	{
		variants: () => [],
		factoryLinks: () => [],
		purchases: () => [],
		defaultExpanded: false
	}
);

const activeNames = ref<string[]>(props.defaultExpanded ? ["other-info"] : []);

const purchaseTotal = computed(() =>
	(props.purchases ?? []).reduce((sum, item) => sum + (item.total || 0), 0)
);

function getTypeLabel(type: string) {
	const map: Record<string, string> = {
		main: "主体",
		accessory: "配件",
		packing: "包装"
	};
	return map[type] || type;
}

function getTypeTagType(type: string): "primary" | "success" | "warning" | "info" | "danger" {
	const map: Record<string, "primary" | "success" | "warning" | "info"> = {
		main: "primary",
		accessory: "success",
		packing: "warning"
	};
	return map[type] || "info";
}

function getFactoryLinkInfo(id: string): { link: string; displayText: string } | null {
	const factoryLink = (props.factoryLinks ?? []).find((link) => String(link.id) === String(id));
	if (!factoryLink) return null;
	const typeLabel = getTypeLabel(factoryLink.type);
	return {
		link: factoryLink.link,
		displayText: `${typeLabel}: ${factoryLink.name}`
	};
}

function getSubmitters(variantId: string): string[] {
	const sid = String(variantId);
	const related = (props.purchases ?? []).filter(
		(p) => p.variantId != null && String(p.variantId) === sid && p.submitter
	);
	return Array.from(new Set(related.map((p) => p.submitter!)));
}

function getVariantName(variantId: string | undefined): string {
	if (variantId == null) return "";
	const v = (props.variants ?? []).find((x) => String(x.variantsid) === String(variantId));
	return v?.name ?? "";
}
</script>

<style scoped lang="scss">
.design-task-other-info :deep(.el-collapse-item__content) {
	padding-bottom: 0;
}

.variant-section {
	margin-top: 0;
}

.factory-links-section,
.purchase-section {
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
</style>
