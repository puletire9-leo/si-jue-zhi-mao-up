<template>
	<el-space direction="vertical" alignment="stretch">
		<el-descriptions :column="12" size="small" border>
			<el-descriptions-item label-align="center" label="缩略图" :span="1">
				<div class="thumbnail-container">
					<!-- 主图 -->
					<el-image class="thumbnail-main" :src="imageUrls[0]?.url" fit="cover" />
					<!-- 悬停图片列表 -->
					<div class="thumbnail-hover">
						<el-image
							v-for="(item, index) in imageUrls"
							:key="index"
							:src="item.url"
							fit="cover"
							class="thumbnail-item"
							@click.prevent="swapMainImage(candidate, item.field)"
						/>
					</div>
				</div>
			</el-descriptions-item>
			<el-descriptions-item
				label-align="center"
				label="产品标题"
				:span="1"
				:show-overflow-tooltip="true"
			>
				{{ candidate.item_name || "-" }}
			</el-descriptions-item>

			<el-descriptions-item label-align="center" :span="2" label="国家">{{
				candidate.marketplace || "-"
			}}</el-descriptions-item>
			<el-descriptions-item label-align="center" label="卖家">
				{{ candidate.seller_country || "-" }}
			</el-descriptions-item>
			<el-descriptions-item label-align="center" label="ASIN">
				<el-link
					v-if="candidate.asin"
					type="primary"
					:underline="false"
					target="_blank"
					@click.prevent="openProductLinks(candidate)"
				>
					{{ candidate.asin }}
				</el-link>
				<span v-else>-</span>
			</el-descriptions-item>

			<el-descriptions-item label-align="center" label="评论">{{
				candidate.review_num || "-"
			}}</el-descriptions-item>
			<el-descriptions-item label-align="center" label="星级">{{
				candidate.last_star || "-"
			}}</el-descriptions-item>
			<el-descriptions-item label-align="center" label="排名">
				{{
					!candidate.bsr_rank || candidate.bsr_rank === 999999999
						? "-"
						: candidate.bsr_rank
				}}
			</el-descriptions-item>

			<el-descriptions-item label-align="center" label="价格">{{
				candidate.price || "-"
			}}</el-descriptions-item>
			<el-descriptions-item label-align="center" label="重量">{{
				candidate.weight || "-"
			}}</el-descriptions-item>
			<el-descriptions-item label-align="center" label="尺寸">{{
				candidate.dimensions || "-"
			}}</el-descriptions-item>
		</el-descriptions>

		<!-- <el-descriptions :column="9" border>
     
    </el-descriptions> -->
	</el-space>
</template>

<script setup lang="ts" name="bsr-candidate-description">
import { computed } from "vue";
import { useCool } from "/@/cool";
import { appConfig } from "../../../../../appConfig";

const { service } = useCool();
const props = defineProps(["candidate"]);

const openProductLinks = (row: any) => {
	if (!row.asin) return;
	const cleanAsin = row.asin.replace(/[^A-Z0-9]/g, "");
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, row.marketplace);
	window.open(dpUrl, "_blank");
};

// 计算图片URL数组
const imageUrls = computed(() => {
	const fields = [
		"image_url",
		"image_url2",
		"image_url3",
		"image_url4",
		"image_url5",
		"image_url6"
	];

	return fields
		.map((field) => ({
			field,
			url: props.candidate[field]
		}))
		.filter((item) => item.url); // 过滤空值
});

const swapMainImage = (row: any, clickedField: string) => {
	// 确保不是当前主图
	if (clickedField === "image_url") return;

	// 交换图片逻辑
	const temp = row.image_url;
	row.image_url = row[clickedField];
	row[clickedField] = temp;

	// 更新显示（如果需要）
	if (row.image_url_display) {
		row.image_url_display = convert_image_url(row.image_url);
	}

	// 调用API保存修改
	service.app.bsr_candidate.update(row);
};

// 图片URL转换方法（根据实际需要实现）
const convert_image_url = (url: string) => {
	// 你的图片处理逻辑
	return url;
};
</script>

<style scoped lang="scss">
.thumbnail-container {
	position: relative;
	display: inline-block;
	&:hover .thumbnail-hover {
		display: flex;
	}
}

.thumbnail-main {
	width: 100px;
	height: 100px;
	cursor: pointer;
}

.thumbnail-hover {
	position: absolute;
	left: 100%;
	top: 0;
	display: none;
	background: white;
	z-index: 1000;
	padding: 5px;
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
	gap: 10px; // 增加间距
	max-width: 980px; /* 150*6 + 10*5 */
	overflow-x: auto;
	flex-wrap: nowrap;
}

.thumbnail-item {
	width: 150px; // 放大默认尺寸
	height: 150px; // 放大默认尺寸
	flex-shrink: 0;
	/* 移除所有过渡效果和悬停变换 */
	border: 2px solid transparent; // 添加默认边框保持布局稳定
}
</style>
