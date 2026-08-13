<template>
	<cl-filter label="选品状态">
		<cl-select
			prop="status"
			placeholder="过滤状态"
			:width="150"
			:options="[
				{ label: '待入库', value: appConfig.BSR_CANDIDATE_STATUS.PENDING.value },
				{ label: '待精选', value: appConfig.BSR_CANDIDATE_STATUS.LIBRARY.value },
				{ label: '已精选', value: appConfig.BSR_CANDIDATE_STATUS.LIBRARY2.value },
				{ label: '预留', value: appConfig.BSR_CANDIDATE_STATUS.RESERVED.value },
				{ label: '已归档', value: appConfig.BSR_CANDIDATE_STATUS.ARCHIVED.value }
			]"
		/>
	</cl-filter>
</template>

<script setup lang="ts">
import { appConfig } from "../../../../../appConfig";
</script>
<style scoped lang="scss"></style>
