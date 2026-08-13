import { ElMessageBox } from "element-plus";

/** 悬浮工具栏面板的 z-index 为 2200，确认框需更高以免被遮挡 */
const REVIEW_FLOAT_MSGBOX_Z_INDEX = 3100;

export async function confirmReviewFloatDelete(message: string) {
	await ElMessageBox.confirm(message, "删除确认", {
		type: "warning",
		confirmButtonText: "确认删除",
		cancelButtonText: "取消",
		confirmButtonClass: "el-button--danger",
		zIndex: REVIEW_FLOAT_MSGBOX_Z_INDEX,
		draggable: true
	});
}

export async function confirmReviewFloatTranslateDe(message: string) {
	await ElMessageBox.confirm(message, "翻译德文后缀", {
		type: "info",
		confirmButtonText: "自动翻译",
		cancelButtonText: "不用",
		zIndex: REVIEW_FLOAT_MSGBOX_Z_INDEX,
		draggable: true
	});
}
