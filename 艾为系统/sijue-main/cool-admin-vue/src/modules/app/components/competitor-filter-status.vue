<template>
	<cl-filter label="状态筛选">
		<cl-select
			prop="status"
			:width="120"
			:options="[
				{ label: '待入库', value: 2 },
				{ label: '已入库', value: 3 },
				{ label: '已归档', value: 4 }
			]"
		/>
	</cl-filter>
</template>

<script setup lang="ts"></script>
<style scoped lang="scss"></style>
