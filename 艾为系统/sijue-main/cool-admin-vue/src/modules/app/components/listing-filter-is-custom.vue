<!--
自定义产品全部关联一个特殊的 sid 为 80386 的店铺，可考虑继续仅提供店铺筛选，而不需要使用本筛选组件。
不过本组件可用于筛选非自定义产品，还是用上吧。
-->

<template>
	<cl-filter label="Listing 来源筛选">
		<cl-select
			prop="is_custom_listing"
			:width="160"
			:options="[
				{ label: '来自领星 ERP', value: 0 },
				{ label: '来自自定义产品', value: 1 }
			]"
		/>
	</cl-filter>
</template>

<script setup lang="ts"></script>
<style scoped lang="scss"></style>
