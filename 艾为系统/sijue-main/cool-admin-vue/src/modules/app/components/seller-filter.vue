<template>
	<cl-filter label="店铺筛选">
		<cl-select prop="sid" :width="150" :options="options" />
	</cl-filter>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useCool } from "/@/cool";

const { service } = useCool();
const options = ref();

onMounted(async function () {
	const sellers = await service?.app?.seller.list();

	options.value = sellers.map((seller: any) => {
		return {
			label: seller.name,
			value: seller.sid
		};
	});
});
</script>

<style scoped lang="scss"></style>
