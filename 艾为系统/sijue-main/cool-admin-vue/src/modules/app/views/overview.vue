<template>
	<div class="container">
		<el-row>
			<h2>数据概览</h2>
		</el-row>

		<el-row>
			<el-col :span="6">
				<router-link to="/app/seller">
					<el-statistic :value="output_sellers">
						<template #title>
							<el-text size="large">
								<el-space>
									店铺数量
									<el-icon :size="20">
										<shop />
									</el-icon>
								</el-space>
							</el-text>
						</template>
					</el-statistic>
				</router-link>
			</el-col>
			<el-col :span="6">
				<router-link to="/app/listing">
					<el-statistic :value="output_listings">
						<template #title>
							<el-text size="large">
								<el-space>
									<el-tooltip
										effect="dark"
										placement="top"
										content="这里统计的是未删除且状态为可售的 Listing"
									>
										Listing 数量
									</el-tooltip>
									<el-icon :size="20">
										<goods-filled />
									</el-icon>
								</el-space>
							</el-text>
						</template>
					</el-statistic>
				</router-link>
			</el-col>
			<el-col :span="6">
				<router-link to="/app/listing/custom">
					<el-statistic :value="output_custom_listings">
						<template #title>
							<el-text size="large">
								<el-space>
									自定义产品数量
									<el-icon :size="20">
										<goods />
									</el-icon>
								</el-space>
							</el-text>
						</template>
					</el-statistic>
				</router-link>
			</el-col>
		</el-row>

		<el-row>
			<el-col :span="6">
				<router-link to="/app/backlog/keyword">
					<el-statistic :value="output_todo_keywords">
						<template #title>
							<el-text size="large">
								<el-space>
									待入库关键词
									<el-icon :size="20">
										<document />
									</el-icon>
								</el-space>
							</el-text>
						</template>
					</el-statistic>
				</router-link>
			</el-col>
			<el-col :span="6">
				<router-link to="/app/backlog/competitor">
					<el-statistic :value="output_todo_competitors">
						<template #title>
							<el-text size="large">
								<el-space>
									待入库竞品
									<el-icon :size="20">
										<document-copy />
									</el-icon>
								</el-space>
							</el-text>
						</template>
					</el-statistic>
				</router-link>
			</el-col>
			<el-col :span="6">
				<router-link to="/app/backlog/tactic/price">
					<el-statistic :value="output_todo_tactic_price">
						<template #title>
							<el-text size="large">
								<el-space>
									待执行调价
									<el-icon :size="20">
										<price-tag />
									</el-icon>
								</el-space>
							</el-text>
						</template>
					</el-statistic>
				</router-link>
			</el-col>
			<el-col :span="6">
				<router-link to="/app/backlog/tactic/inventory">
					<el-statistic :value="output_todo_tactic_inventory">
						<template #title>
							<el-text size="large">
								<el-space>
									待执行补货
									<el-icon :size="20">
										<box />
									</el-icon>
								</el-space>
							</el-text>
						</template>
					</el-statistic>
				</router-link>
			</el-col>
		</el-row>

		<el-divider></el-divider>
	</div>
</template>

<script setup lang="ts" name="overview">
import { ref, onMounted } from "vue";
import { useTransition } from "@vueuse/core";
import {
	Box,
	Document,
	DocumentCopy,
	GoodsFilled,
	Goods,
	MagicStick,
	PriceTag,
	Shop
} from "@element-plus/icons-vue";
import { useCool } from "/@/cool";
import { is_admin } from "/$/app/utils";

const { service } = useCool();

const sellers = ref(0);
const listings = ref(0);
const custom_listings = ref(0);
const todo_keywords = ref(0);
const todo_competitors = ref(0);
const todo_tactic_price = ref(0);
const todo_tactic_inventory = ref(0);
const seller_sprite_aba = ref(0);

const output_sellers = useTransition(sellers, { duration: 200 });
const output_listings = useTransition(listings, { duration: 500 });
const output_custom_listings = useTransition(custom_listings, { duration: 500 });
const output_todo_keywords = useTransition(todo_keywords, { duration: 200 });
const output_todo_competitors = useTransition(todo_competitors, { duration: 200 });
const output_todo_tactic_price = useTransition(todo_tactic_price, { duration: 300 });
const output_todo_tactic_inventory = useTransition(todo_tactic_inventory, { duration: 300 });
const output_seller_sprite_aba = useTransition(seller_sprite_aba, { duration: 300 });

onMounted(async () => {
	let statistics = await service.app.overview?.get_statistics();
	console.log(statistics);
	sellers.value = statistics?.sellers || 0;
	listings.value = statistics?.listings || 0;
	custom_listings.value = statistics?.custom_listings || 0;
	todo_keywords.value = statistics?.todo_keywords || 0;
	todo_competitors.value = statistics?.todo_competitors || 0;
	todo_tactic_price.value = statistics?.todo_tactic_price || 0;
	todo_tactic_inventory.value = statistics?.todo_tactic_inventory || 0;

	if (Array.isArray(statistics?.seller_sprite_api_visits)) {
		statistics.seller_sprite_api_visits.forEach((visit_data) => {
			if (visit_data?.module === "abaResearch") {
				seller_sprite_aba.value = visit_data?.remain || 0;
			}
		});
	}
});
</script>

<style scoped lang="scss">
.container {
	position: relative;
	box-sizing: border-box;
	padding: 36px;
	height: 100%;
	overflow: hidden auto;
	background-color: #fff;
}

.el-row {
	margin-bottom: 40px;
}

.el-col {
}

.el-statistic {
	--el-statistic-content-font-size: 28px;
}
</style>
