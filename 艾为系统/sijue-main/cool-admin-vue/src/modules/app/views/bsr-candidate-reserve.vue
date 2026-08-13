<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-flex1 />
			<cl-search-key placeholder="模糊搜索" />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-image_url_display="{ scope }">
					<resilient-product-image
						:src="scope.row.image_url_display"
						style="width: 50px; height: 50px; cursor: pointer"
						fit="contain"
						:preview-src-list="scope.row.reserve_preview_images"
						preview-teleported
						priority="visible"
						@show="boostProductImages(scope.row, { prefixes: ['image_url', 'aliyun_img'] })"
						@mouseenter="boostProductImages(scope.row, { prefixes: ['image_url', 'aliyun_img'] })"
					/>
				</template>

				<template #slot-reserve-actions="{ scope }">
					<el-button size="default" type="danger" text bg @click="rejectReserve(scope.row)">
						打回
					</el-button>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>
	</cl-crud>
</template>

<script lang="ts" name="app-bsr-candidate-reserve" setup>
import { useCrud, useTable } from "@cool-vue/crud";
import { ElMessage, ElMessageBox } from "element-plus";
import { useCool } from "/@/cool";
import { appConfig } from "../../../../../appConfig";
import { convert_image_url } from "/$/app/utils";
import { boostProductImages, preloadProductImages } from "/$/app/utils/product-image-loading";
import ResilientProductImage from "/$/app/components/resilient-product-image.vue";
import ClCrud from "/~/crud/src/components/crud";
import ClRow from "/~/crud/src/components/row";

const { service } = useCool();

const Crud = useCrud(
	{
		service: service.app.bsr_candidate,
		async onRefresh(params, { next, render }) {
			const { list } = await next({
				...params,
				status: appConfig.BSR_CANDIDATE_STATUS.RESERVED.value
			});
			const renderList = (list || []).map((item: any) => {
				const images = [
					item.image_url,
					item.aliyun_img,
					item.image_url2,
					item.image_url3,
					item.image_url4,
					item.image_url5,
					item.image_url6
				]
					.map((url) => convert_image_url(url))
					.filter(Boolean);
				return {
					...item,
					image_url_display: convert_image_url(item.image_url || item.aliyun_img),
					reserve_preview_images: images
				};
			});
			preloadProductImages(renderList, {
				prefixes: ["image_url", "aliyun_img"],
				reason: "bsr-candidate-reserve"
			});
			render(renderList);
		}
	},
	(app) => {
		app.refresh();
	}
);

const Table = useTable({
	columns: [
		{ type: "selection" },
		{ label: "ASIN", prop: "asin", minWidth: 110, fixed: "left" },
		{
			label: "图片",
			prop: "image_url_display",
			width: 80,
			fixed: "left"
		},
		{ label: "产品标题", prop: "item_name", minWidth: 220, showOverflowTooltip: true },
		{ label: "产品名称", prop: "produce_name", minWidth: 160, showOverflowTooltip: true },
		{ label: "SKU", prop: "sku", minWidth: 100, showOverflowTooltip: true },
		{
			label: "状态",
			prop: "status",
			dict: [
				{
					label: "预留",
					value: appConfig.BSR_CANDIDATE_STATUS.RESERVED.value,
					type: "warning"
				}
			],
			width: 90
		},
		{ label: "预留开发", prop: "reserved_by_user_name", minWidth: 110 },
		{
			label: "进入预留时间",
			prop: "reserved_at",
			minWidth: 170,
			component: { name: "cl-date-text" },
			sortable: "custom"
		},
		{ label: "打回原因", prop: "reserve_reject_reason", minWidth: 180, showOverflowTooltip: true },
		{
			type: "op",
			buttons: ["slot-reserve-actions"],
			width: 110
		}
	],
	contextMenu: []
});

async function rejectReserve(row: any) {
	const result = await ElMessageBox.prompt("请输入打回原因", "打回预留数据", {
		confirmButtonText: "确认打回",
		cancelButtonText: "取消",
		inputType: "textarea",
		inputPlaceholder: "说明需要开发处理的问题"
	}).catch(() => null);
	if (!result) return;

	try {
		await (service.app.bsr_candidate as any).request({
			url: "/rejectReserve",
			method: "POST",
			data: {
				id: row.id,
				reason: result.value || ""
			}
		});
		ElMessage.success("已打回待处理数据");
		Crud.value?.refresh();
	} catch (err) {
		console.error("打回预留失败:", err);
		ElMessage.error("打回失败，请重试");
	}
}
</script>
