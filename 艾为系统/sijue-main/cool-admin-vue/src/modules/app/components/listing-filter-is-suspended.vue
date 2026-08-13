<template>
	<cl-filter label="停用状态">
		<cl-select
			prop="is_suspended"
			:width="100"
			:options="[
				{ label: '否', value: 0 },
				{ label: '是', value: 1 }
			]"
		/>
	</cl-filter>
</template>

<script setup lang="ts"></script>
<style scoped lang="scss"></style>
