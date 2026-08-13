<template>
	<cl-crud ref="Crud" v-loading="isLoading">
		<cl-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />

			<el-button
				v-permission="service.app.seller.sync_from_lx"
				@click="syncSellers()"
				type="success"
			>
				从领星同步店铺信息
			</el-button>

			<cl-flex1 />

			<cl-search-key />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #slot-sync-listings="{ scope }">
					<el-button
						type="primary"
						bg
						text
						v-if="scope.row.sid !== 80386"
						@click="syncListingsBySeller(scope.row)"
						>同步 Listing
					</el-button>

					<el-button
						type="primary"
						bg
						text
						v-if="false"
						@click="
							Crud?.service.sync_listings_fba_inventory_from_lx({
								sid: scope.row.sid
							})
						"
					>
						同步库存
					</el-button>

					<el-button
						type="primary"
						bg
						text
						v-if="is_admin && scope.row.sid !== 80386"
						@click="
							Crud?.service.sync_listings_yesterday_volume_from_lx({
								sid: scope.row.sid
							})
						"
					>
						同步销量
					</el-button>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" name="app-seller" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox } from "element-plus";
import { ref } from "vue";
import { useDict } from "/$/dict";
import { is_admin } from "/$/app/utils";

const { service } = useCool();
const { dict } = useDict();

const Crud = useCrud(
	{
		service: service.app.seller
	},
	(app) => {
		app.refresh({
			size: 50
		});
	}
);

const Table = useTable({
	columns: [
		{ type: "selection" },
		{ prop: "sid", label: "sid", width: 80, sortable: "custom" },
		{ prop: "seller_id", label: "卖家 ID", width: 160, sortable: "custom" },
		{ prop: "account_name", label: "店铺账户名称", sortable: "custom" },
		{ prop: "name", label: "店铺名", sortable: "custom" },
		{ prop: "country", label: "国家", width: 90, sortable: "custom" },
		{
			prop: "status",
			label: "领星 ERP 状态",
			width: 160,
			dict: dict.get("lingxingSellerStatus"),
			sortable: "custom"
		},
		{ prop: "createTime", label: "创建时间", sortable: "custom", width: 160 },
		{ prop: "updateTime", label: "更新时间", sortable: "desc", width: 160 },
		{
			prop: "listing_last_fetch_date",
			label: "最近同步 listing 信息",
			sortable: "custom",
			width: 190
		},
		{
			prop: "daily_order_quantity_history_updateTime",
			label: "最近同步 listing 销量",
			sortable: "custom",
			width: 190
		},
		{
			type: "op",
			buttons: ["slot-sync-listings"],
			width: 230
		}
	]
});

const Upsert = useUpsert({
	dialog: {
		width: "600",
		draggable: true,
		"align-center": true
	},
	props: {
		labelPosition: "right",
		labelWidth: "auto"
	},
	items: [
		{ prop: "name", label: "店铺名", component: { name: "el-input" }, required: true },
		{ prop: "sid", label: "sid", component: { name: "el-input-number" }, required: true },
		{ prop: "seller_id", label: "卖家ID", component: { name: "el-input" }, required: true },
		{
			prop: "account_name",
			label: "店铺账户名称",
			component: { name: "el-input" },
			required: true
		},
		{
			prop: "seller_account_id",
			label: "店铺账号 ID",
			component: { name: "el-input" },
			required: true
		},
		{ prop: "region", label: "站点简称", component: { name: "el-input" }, required: true },
		{
			prop: "country",
			label: "商城所在国家名称",
			component: { name: "el-input" },
			required: true
		},
		{
			prop: "has_ads_setting",
			label: "否授权广告",
			component: { name: "cl-switch" },
			required: true
		},
		{
			prop: "marketplace_id",
			label: "市场ID",
			component: { name: "el-input" },
			required: true
		},
		{ prop: "status", label: "状态", component: { name: "cl-switch" }, required: true }
	]
});

async function syncSellers() {
	isLoading.value = true;
	try {
		let result = await service.app.seller.sync_from_lx();
		console.log(result);

		if (result === "ok") {
			ElMessage({
				message: "同步成功",
				type: "success"
			});
			Crud?.value?.refresh();
		} else {
			ElMessage({
				message: "同步有误，请稍后重试。",
				type: "error"
			});
		}
	} catch (err: any) {
		console.log(err);
		ElMessage({
			message: err,
			type: "error"
		});
	} finally {
		isLoading.value = false;
	}
}

async function syncListingsBySeller(seller: any) {
	ElMessageBox.confirm(
		"系统会定期自动同步 listing，通常无需主动手动操作。",
		"确认要拉取本店铺 listing 信息吗？",
		{
			type: "info",
			draggable: true
		}
	)
		.then(async () => {
			isLoading.value = true;
			try {
				let result = await service.app.seller.sync_listings_from_lx({ sid: seller.sid });
				console.log(result);

				if (result === "ok") {
					await ElMessageBox.alert(
						"正在同步该店 Listing，请稍后到 Listing 管理菜单中查看。",
						"提示"
					);
				} else {
					ElMessage({
						message: "同步有误，请稍后重试。",
						type: "error"
					});
				}
			} catch (err: any) {
				console.log(err);
				ElMessage({
					message: err,
					type: "error"
				});
			} finally {
				isLoading.value = false;
			}
		})
		.catch(() => {});
}

const isLoading = ref(false);
</script>
