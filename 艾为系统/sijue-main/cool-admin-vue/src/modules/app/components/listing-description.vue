<template>
	<el-descriptions :column="7" size="small" border>
		<el-descriptions-item label-align="center" label="店铺" width="200">
			{{ listing.sellerName || listing.sid || "-" }}
		</el-descriptions-item>
		<el-descriptions-item label-align="center" label="国家">{{
			listing.marketplace || "-"
		}}</el-descriptions-item>
		<el-descriptions-item label-align="center" label="ASIN">
			{{ appConfig.get_from_custom_listing_hint(listing, "asin") || "-" }}
		</el-descriptions-item>
		<el-descriptions-item label-align="center" label="SKU">
			{{ appConfig.get_from_custom_listing_hint(listing, "seller_sku") || "-" }}
		</el-descriptions-item>
		<el-descriptions-item label-align="center" label="品名">{{
			listing.local_name || "-"
		}}</el-descriptions-item>

		<el-descriptions-item label-align="center" label="缩略图">
			<el-popover placement="right" trigger="hover" :width="300">
				<template #reference>
					<el-image
						style="width: 75px; height: 75px; cursor: pointer"
						:src="listing.image_url"
						fit="cover"
					/>
				</template>
				<el-image
					:src="listing.image_url"
					style="max-width: 300px; width: auto; height: auto"
					:preview-src-list="[listing.image_url]"
				/>
			</el-popover>
		</el-descriptions-item>

		<el-descriptions-item label-align="center" :span="2" label="标题">
			{{ listing.item_name || "-" }}
		</el-descriptions-item>
	</el-descriptions>
</template>

<script setup lang="ts">
import { appConfig } from "../../../../../appConfig";

const props = defineProps(["listing"]);
</script>

<style scoped lang="scss"></style>
