<template>
	<el-card class="api-usage-dashboard">
		<template #header>
			<div class="card-header">
				<span>API用量统计</span>
				<el-button type="primary" @click="refreshData">刷新数据</el-button>
			</div>
		</template>

		<!-- 总览统计卡片 -->
		<el-row :gutter="20" class="overview-cards">
			<el-col :span="6">
				<el-card class="stat-card sellersprite">
					<div class="stat-content">
						<div class="stat-info">
							<div class="stat-label">卖家精灵</div>
							<div class="stat-value">{{ overview.sellersprite.totalCalls }}</div>
							<div class="stat-sub">
								今日调用: {{ overview.sellersprite.todayCalls }}
							</div>
						</div>
					</div>
				</el-card>
			</el-col>
			<el-col :span="6">
				<el-card class="stat-card sif">
					<div class="stat-content">
						<div class="stat-info">
							<div class="stat-label">SIF</div>
							<div class="stat-value">{{ overview.sif.totalCalls }}</div>
							<div class="stat-sub">今日调用: {{ overview.sif.todayCalls }}</div>
						</div>
					</div>
				</el-card>
			</el-col>
			<el-col :span="6">
				<el-card class="stat-card baidu">
					<div class="stat-content">
						<div class="stat-info">
							<div class="stat-label">百度翻译</div>
							<div class="stat-value">{{ overview.baidu.totalCalls }}</div>
							<div class="stat-sub">今日调用: {{ overview.baidu.todayCalls }}</div>
						</div>
					</div>
				</el-card>
			</el-col>
			<el-col :span="6">
				<el-card class="stat-card oxylabs">
					<div class="stat-content">
						<div class="stat-info">
							<div class="stat-label">Oxylabs</div>
							<div class="stat-value">{{ overview.oxylabs.totalCalls }}</div>
							<div class="stat-sub">今日调用: {{ overview.oxylabs.todayCalls }}</div>
						</div>
					</div>
				</el-card>
			</el-col>
		</el-row>

		<!-- 详细统计表格 -->
		<el-tabs v-model="activeTab" class="detail-tabs" @tab-change="handleTabChange">
			<el-tab-pane label="卖家精灵" name="sellersprite">
				<api-usage-table
					:api-type="'sellersprite'"
					:table-data="sellerspriteData"
					:loading="loading"
					@refresh="loadSellerspriteData"
				/>
			</el-tab-pane>
			<el-tab-pane label="SIF" name="sif">
				<api-usage-table
					:api-type="'sif'"
					:table-data="sifData"
					:loading="loading"
					@refresh="loadSifData"
				/>
			</el-tab-pane>
			<el-tab-pane label="百度翻译" name="baidu">
				<api-usage-table
					:api-type="'baidu'"
					:table-data="baiduData"
					:loading="loading"
					@refresh="loadBaiduData"
				/>
			</el-tab-pane>
			<el-tab-pane label="Oxylabs" name="oxylabs">
				<api-usage-table
					:api-type="'oxylabs'"
					:table-data="oxylabsData"
					:loading="loading"
					@refresh="loadOxylabsData"
				/>
			</el-tab-pane>
		</el-tabs>
	</el-card>
</template>

<script lang="ts" name="app-api-usage-dashboard" setup>
import { ref, reactive, onMounted } from "vue";
import { useCool } from "/@/cool";
import { ElMessage } from "element-plus";
import ApiUsageTable from "/$/app/components/api-usage-table.vue";

const { service } = useCool();

// 当前激活的标签页
const activeTab = ref("sellersprite");
const loading = ref(false);

// 总览数据
const overview = reactive({
	sellersprite: { totalCalls: 0, todayCalls: 0 },
	sif: { totalCalls: 0, todayCalls: 0 },
	baidu: { totalCalls: 0, todayCalls: 0 },
	oxylabs: { totalCalls: 0, todayCalls: 0 }
});

// 各API的详细数据
const sellerspriteData = ref([]);
const sifData = ref([]);
const baiduData = ref([]);
const oxylabsData = ref([]);

// 加载总览数据
const loadOverview = async () => {
	try {
		const res = await service.app.api_usage.getOverview();
		Object.assign(overview, res);
	} catch (error) {
		console.error("加载总览数据失败:", error);
	}
};

// 加载卖家精灵数据
const loadSellerspriteData = async () => {
	loading.value = true;
	try {
		const res = await service.app.api_usage.getSellerspriteCallStats();
		sellerspriteData.value = res || [];
	} catch (error) {
		console.error("加载卖家精灵数据失败:", error);
		ElMessage.error("加载卖家精灵数据失败");
	} finally {
		loading.value = false;
	}
};

// 加载SIF数据
const loadSifData = async () => {
	loading.value = true;
	try {
		const res = await service.app.api_usage.getSifCallStats();
		sifData.value = res || [];
	} catch (error) {
		console.error("加载SIF数据失败:", error);
		ElMessage.error("加载SIF数据失败");
	} finally {
		loading.value = false;
	}
};

// 加载百度翻译数据
const loadBaiduData = async () => {
	loading.value = true;
	try {
		const res = await service.app.api_usage.getBaiduLogs();
		baiduData.value = res.items || res || [];
	} catch (error) {
		console.error("加载百度翻译数据失败:", error);
		ElMessage.error("加载百度翻译数据失败");
	} finally {
		loading.value = false;
	}
};

// 加载Oxylabs数据
const loadOxylabsData = async () => {
	loading.value = true;
	try {
		const res = await service.app.api_usage.getOxylabsLogs();
		oxylabsData.value = res.items || res || [];
	} catch (error) {
		console.error("加载Oxylabs数据失败:", error);
		ElMessage.error("加载Oxylabs数据失败");
	} finally {
		loading.value = false;
	}
};

// 刷新所有数据
const refreshData = async () => {
	await loadOverview();
	switch (activeTab.value) {
		case "sellersprite":
			await loadSellerspriteData();
			break;
		case "sif":
			await loadSifData();
			break;
		case "baidu":
			await loadBaiduData();
			break;
		case "oxylabs":
			await loadOxylabsData();
			break;
	}
	ElMessage.success("数据已刷新");
};

// 标签页切换
const handleTabChange = (tabName: string) => {
	switch (tabName) {
		case "sellersprite":
			if (sellerspriteData.value.length === 0) {
				loadSellerspriteData();
			}
			break;
		case "sif":
			if (sifData.value.length === 0) {
				loadSifData();
			}
			break;
		case "baidu":
			if (baiduData.value.length === 0) {
				loadBaiduData();
			}
			break;
		case "oxylabs":
			if (oxylabsData.value.length === 0) {
				loadOxylabsData();
			}
			break;
	}
};

// 页面加载时初始化数据
onMounted(async () => {
	await loadOverview();
	await loadSellerspriteData();
});
</script>

<style scoped lang="scss">
.api-usage-dashboard {
	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 18px;
		font-weight: bold;
	}

	.overview-cards {
		margin-bottom: 20px;

		.stat-card {
			.stat-content {
				display: flex;
				align-items: center;
				gap: 15px;

				.stat-icon {
					font-size: 40px;
				}

				.stat-info {
					flex: 1;

					.stat-label {
						font-size: 14px;
						color: #666;
						margin-bottom: 5px;
					}

					.stat-value {
						font-size: 24px;
						font-weight: bold;
						color: #333;
						margin-bottom: 5px;
					}

					.stat-sub {
						font-size: 12px;
						color: #999;
					}
				}
			}

			&.sellersprite {
				border-left: 4px solid #409eff;
			}

			&.sif {
				border-left: 4px solid #67c23a;
			}

			&.baidu {
				border-left: 4px solid #e6a23c;
			}

			&.oxylabs {
				border-left: 4px solid #f56c6c;
			}
		}
	}

	.detail-tabs {
		:deep(.el-tabs__content) {
			padding: 20px 0;
		}
	}
}
</style>
