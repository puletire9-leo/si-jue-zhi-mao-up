<template>
	<cl-filter label="任务状态">
		<cl-select
			prop="status"
			:width="150"
			:options="[
				{ label: '待执行', value: 0 },
				{ label: '爬虫中', value: 102 },
				{ label: '调研中', value: 1 },
				{ label: '已完成', value: 2 }
			]"
		/>
	</cl-filter>
</template>

<script setup lang="ts"></script>
<style scoped lang="scss"></style>
