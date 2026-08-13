<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-sidList="{ scope }">
					<template v-for="sid in scope.row.sidList || []">
						<el-tag size="small" effect="light" hit style="margin-right: 4px">
							{{ sellerSidNameMap[sid] }}
						</el-tag>
					</template>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert">
			<template #slot-edit-user-seller="{ scope }">
				<div class="user-seller-edit-wrapper">
					<!-- 2026-04-22 新增：添加全选、清空和按店铺前缀全选的按钮组 -->
					<div style="margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 8px;">
						<el-button size="small" type="primary" @click="handleSelectAll(scope)">全选所有</el-button>
						<el-button size="small" @click="handleClearAll(scope)">清空所有</el-button>
						<el-button 
							size="small" 
							v-for="prefix in sellerPrefixes" 
							:key="prefix"
							@click="handleSelectPrefix(scope, prefix)"
						>
							全选 {{ prefix }}
						</el-button>
					</div>
					<el-scrollbar max-height="700">
						<div>
							<el-checkbox-group
								v-model="scope.sidList"
								@change="scope.sidList = scope.sidList.sort()"
							>
								<template v-for="seller in sellerList" :key="seller.sid">
									<el-checkbox v-model="seller.sid" :label="seller.sid">
										<slot>{{ seller.name }}</slot>
									</el-checkbox>
									<br />
								</template>
							</el-checkbox-group>
						</div>
					</el-scrollbar>
				</div>
			</template>
		</cl-upsert>

		<template data-info="仅用于测试" v-if="false">
			<hr />
			<div>
				<p>所有店铺：</p>
				<template v-for="s in sellerList">
					<p>sid: {{ s.sid }} | name: {{ s.name }}</p>
				</template>
			</div>
			<hr />
			<el-checkbox-group v-model="checkedSidList">
				<template v-for="seller in sellerList">
					<el-checkbox v-model="seller.sid" :label="seller.sid">
						<slot>{{ seller.name }}</slot>
					</el-checkbox>
					<br />
				</template>
			</el-checkbox-group>
			<hr />
			<div>目前选中的项：{{ checkedSidList }}</div>
		</template>
	</cl-crud>
</template>

<script lang="ts" name="app-user-seller" setup>
import { useTable, useUpsert, useCrud } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { computed, onActivated, onMounted, ref } from "vue";
import { useStore } from "/$/base/store";

const { service } = useCool();

const Crud = useCrud(
	{
		service: service.base.sys.user
	},
	(app) => {
		app.refresh();
	}
);

const Table = useTable({
	columns: [
		{
			prop: "username",
			label: "用户名",
			minWidth: 100,
			fixed: "left"
		},
		{
			prop: "name",
			label: "姓名",
			minWidth: 100
		},
		{
			prop: "nickName",
			label: "昵称",
			minWidth: 100
		},

		{
			prop: "roleName",
			label: "所属角色",
			minWidth: 200
		},
		{
			prop: "sidList",
			label: "可访问店铺",
			minWidth: 400
		},
		{
			prop: "updateTime",
			label: "更新时间",
			sortable: "custom",
			width: 170
		},
		{
			label: "操作",
			type: "op",
			buttons: ["edit"],
			width: 80
		}
	]
});

const Upsert = useUpsert({
	dialog: {
		"align-center": true,
		draggable: true
	},
	items: [
		{
			prop: "username",
			label: "用户名",
			required: true,
			component: { name: "el-input", props: { disabled: true } }
		},
		{
			prop: "name",
			label: "姓名",
			required: true,
			component: { name: "el-input", props: { disabled: true } }
		},
		{
			prop: "nickName",
			label: "昵称",
			required: true,
			component: { name: "el-input", props: { disabled: true } }
		},

		{
			prop: "sidList",
			label: "可访问店铺",
			component: {
				name: "slot-edit-user-seller"
			}
		}
	],

	async onInfo(data, { next, done }) {
		let newData = await next(data);

		done({
			...newData,
			sidList: newData.sidList || []
		});
	}
});

const sellerList = ref();
onActivated(async () => {
	sellerList.value = await service.app.seller.list();
});

const sellerSidNameMap = computed(() => {
	let map = {};
	sellerList.value.forEach((seller) => {
		map[seller.sid] = seller.name;
	});
	return map;
});

const checkedSidList = ref([]);

// 2026-04-22 新增：提取店铺前缀
const sellerPrefixes = computed(() => {
	if (!sellerList.value) return [];
	const prefixes = new Set<string>();
	sellerList.value.forEach((seller: any) => {
		const prefix = seller.name.split('-')[0];
		if (prefix) {
			prefixes.add(prefix);
		}
	});
	return Array.from(prefixes);
});

// 2026-04-22 新增：全选所有
const handleSelectAll = (scope: any) => {
	if (!sellerList.value) return;
	scope.sidList = sellerList.value.map((s: any) => s.sid).sort();
};

// 2026-04-22 新增：清空所有
const handleClearAll = (scope: any) => {
	scope.sidList = [];
};

// 2026-04-22 新增：按前缀全选
const handleSelectPrefix = (scope: any, prefix: string) => {
	if (!sellerList.value) return;
	const prefixSids = sellerList.value
		.filter((s: any) => s.name.startsWith(prefix + '-') || s.name === prefix)
		.map((s: any) => s.sid);
	
	const currentSids = new Set(scope.sidList || []);
	prefixSids.forEach((sid: any) => currentSids.add(sid));
	scope.sidList = Array.from(currentSids).sort();
};

const { app, user, menu } = useStore();
console.log(user);
</script>
