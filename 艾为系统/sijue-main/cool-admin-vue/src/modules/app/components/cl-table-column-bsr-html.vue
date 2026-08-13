<template>
	<div v-if="bsr_html" v-html="bsr_html.replace(/\n/g, '<br>')"></div>
	<div v-else>无</div>
</template>

<script setup lang="ts" name="cl-table-column-bsr-html">
const props = defineProps({
	bsr_html: {
		required: true,
		type: [String, null],
		default: ""
	}
});
</script>

<style scoped lang="scss"></style>
