<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<el-button
				v-permission="service.app.search_threads.ai_listing"
				@click="syncSellers"
				type="success"
			>
				查询数据
			</el-button>
			<cl-search-key />
		</cl-row>

		<cl-upsert ref="Upsert" />

		<!-- 显示获取到的所有任务数据 -->
		<div v-if="data.length > 0">
			<div v-for="(item, index) in data" :key="index">
				<!-- 可折叠的任务名称 -->
				<div class="task-header" @click="toggleCollapse(index)">
					<h2>{{ item.metadata?.name }}</h2>
					<span class="toggle-icon">
						{{ isCollapsed(index) ? "▶" : "▼" }}
					</span>
				</div>

				<!-- 任务详情部分 -->
				<div v-show="!isCollapsed(index)" class="task-details">
					<!-- 标题展示 -->
					<div>
						<h3>标题:</h3>
						<p>{{ item.values?.title?.title }}</p>
					</div>

					<!-- 高频标题展示 -->
					<div>
						<h3>高频标题:</h3>
						<p>{{ item.values?.title_more_freq?.title }}</p>
					</div>

					<!-- 低频标题展示 -->
					<div>
						<h3>低频标题:</h3>
						<p>{{ item.values?.title_less_freq?.title }}</p>
					</div>

					<!-- 动态展示所有 bullet_point_* 字段 -->
					<div>
						<h3>卖点:</h3>
						<ul>
							<li
								v-for="(bulletPoint, idx) in getBulletPoints(item.values)"
								:key="idx"
							>
								{{ bulletPoint?.bullet_point }}
							</li>
						</ul>
					</div>

					<!-- 描述展示 -->
					<div>
						<h3>描述:</h3>
						<p>{{ item.values?.description }}</p>
					</div>

					<!-- Bullet Titles展示 -->
					<div>
						<h3>Bullet Titles:</h3>
						<ul>
							<li
								v-for="(bt, btIndex) in item.values?.bullet_titles?.bullet_titles"
								:key="btIndex"
							>
								{{ bt.key_words.join(", ") }}
							</li>
						</ul>
					</div>

					<!-- 长尾词展示 -->
					<div>
						<h3>长尾词:</h3>
						<ul>
							<li
								v-for="(ltp, ltpIndex) in item.values?.long_tail_phrases"
								:key="ltpIndex"
							>
								{{ ltp.word }} ({{ ltp.type }}) - 搜索量: {{ ltp.search_volume }}
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	</cl-crud>
</template>

<script lang="ts" name="app-aiListing" setup>
import { useCrud } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { ref } from "vue";

const { service } = useCool();

// 用于存储从后端获取的多条数据
const data = ref<any[]>([]);

// 用于存储每个任务的折叠状态
const collapsedState = ref<boolean[]>([]);

// 同步卖家数据并获取AI生成的内容
async function syncSellers() {
	try {
		const result = await service.app.search_threads.ai_listing();
		console.log(result); // 打印返回的结果
		data.value = result; // 将多条数据存储在 `data` 数组中
		// 初始化所有任务的折叠状态为展开
		collapsedState.value = new Array(result.length).fill(false);
	} catch (error) {
		console.error("数据同步失败", error);
	}
}

// 切换折叠状态
function toggleCollapse(index: number) {
	collapsedState.value[index] = !collapsedState.value[index];
}

// 判断某个任务是否折叠
function isCollapsed(index: number) {
	return collapsedState.value[index];
}

// 获取所有 bullet_point_* 字段
function getBulletPoints(values: any) {
	// 如果 values 为 null 或 undefined，返回空数组
	if (!values) {
		return [];
	}
	return Object.keys(values)
		.filter((key) => key.startsWith("bullet_point_"))
		.map((key) => values[key]);
}
</script>

<style scoped>
.task-header {
	font-weight: bold;
	cursor: pointer;
	display: flex;
	align-items: center;
}

.toggle-icon {
	margin-left: 10px;
	font-size: 14px;
	color: #333;
}

.task-details {
	margin-top: 10px;
	padding-left: 20px;
	background-color: #f9f9f9;
	border-left: 2px solid #ccc;
}
</style>
