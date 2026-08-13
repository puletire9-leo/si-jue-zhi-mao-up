<template>
	<el-link target="_blank" :underline="false" :href="bsr_link" v-if="bsr_link">
		{{ bsr_link }}
	</el-link>
	<div v-else>无</div>
</template>

<script setup lang="ts" name="cl-table-column-bsr-link">
const props = defineProps({
	bsr_link: {
		required: true,
		type: [String, null],
		default: ""
	}
});
</script>

<style scoped lang="scss"></style>
