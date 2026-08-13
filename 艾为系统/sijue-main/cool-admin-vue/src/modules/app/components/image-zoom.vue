<template>
	<div class="image-zoom-wrapper" :style="wrapperStyle">
		<el-image
			:src="src"
			:fit="fit"
			:preview-src-list="[]"
			:style="imageStyle"
			v-bind="attrs"
			@dblclick="handleDblClick"
		/>

		<teleport to="body">
			<div v-if="zoomVisible" class="image-zoom-mask" @click="closeZoom">
				<div class="image-zoom-panel" @click.stop>
					<el-button class="image-zoom-close" type="danger" plain @click="closeZoom">
						关闭放大
					</el-button>
					<img :src="src" alt="参考图放大" class="image-zoom-img" :style="zoomStyle" />
				</div>
			</div>
		</teleport>
	</div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, useAttrs, watch } from "vue";

export default defineComponent({
	name: "app-image-zoom",
	inheritAttrs: false,
	props: {
		src: {
			type: String,
			required: true
		},
		fit: {
			type: String as () => "fill" | "contain" | "cover" | "none" | "scale-down",
			default: "cover"
		},
		width: {
			type: [String, Number],
			default: undefined
		},
		height: {
			type: [String, Number],
			default: undefined
		},
		zoomWidth: {
			type: Number,
			default: 520
		},
		enableZoom: {
			type: Boolean,
			default: true
		}
	},
	setup(props) {
		const attrs = useAttrs();
		const zoomVisible = ref(false);
		const zoomStyle = computed(() => {
			return {
				width: `${props.zoomWidth}px`,
				maxWidth: "80vw"
			};
		});

		const wrapperStyle = computed(() => {
			const style: Record<string, string> = {};
			if (props.width) {
				style.width = typeof props.width === "number" ? `${props.width}px` : props.width;
			}
			if (props.height) {
				style.height =
					typeof props.height === "number" ? `${props.height}px` : props.height;
			}
			return style;
		});

		const imageStyle = computed(() => {
			const style: Record<string, string> = {};
			if (props.width) {
				style.width = typeof props.width === "number" ? `${props.width}px` : props.width;
			}
			if (props.height) {
				style.height =
					typeof props.height === "number" ? `${props.height}px` : props.height;
			}
			return style;
		});

		function handleDblClick() {
			if (!props.enableZoom) return;
			zoomVisible.value = true;
		}

		function closeZoom() {
			zoomVisible.value = false;
		}

		watch(zoomVisible, (visible) => {
			if (typeof document === "undefined") return;
			document.body.classList.toggle("image-zoom-lock", visible);
		});

		return {
			attrs,
			zoomVisible,
			zoomStyle,
			wrapperStyle,
			imageStyle,
			handleDblClick,
			closeZoom
		};
	}
});
</script>

<style scoped lang="scss">
.image-zoom-wrapper {
	display: inline-flex;
}

.image-zoom-mask {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.6);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 9999;
}

.image-zoom-panel {
	position: relative;
	background: #1f2330;
	padding: 18px 18px 14px;
	border-radius: 10px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
}

.image-zoom-close {
	align-self: flex-end;
}

.image-zoom-img {
	border-radius: 8px;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

:global(body.image-zoom-lock) {
	overflow: hidden;
}
</style>
