import { designTaskStatusText } from "../../utils";
import { evaluateDesignTaskTooNew } from "../../utils/design-task-too-new";

export type ChainNodeState = "need_action" | "in_progress" | "waiting_pre" | "done";

export type CompactTag = {
	text: string;
	type: "success" | "warning" | "danger" | "info";
};

export type ChainInput = {
	aiStatus?: string | number;
	aiStage?: string | number;
	designStatus?: string | number;
	designStage?: string | number;
	designTaskCreateTime?: string | number | Date | null;
	listingStatus?: "todo" | "done" | string;
	uploadStatus?: "todo" | "done" | string;
};

type NodeSnapshot = {
	key: "copy" | "design" | "listing" | "upload";
	label: string;
	state: ChainNodeState;
	detail: string;
};

function normalizeStatusToken(value: unknown): string {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_");
}

export function mapAiStatusTextZh(value: unknown): string {
	const raw = String(value || "").trim();
	if (!raw) return "未知状态";
	if (/[\u4e00-\u9fa5]/.test(raw)) return raw;
	const token = normalizeStatusToken(raw);
	const dict: Record<string, string> = {
		queued: "排队中",
		queueing: "排队中",
		pending: "待执行",
		waiting: "等待中",
		running: "执行中",
		processing: "处理中",
		langgraph_running: "图流程执行中",
		started: "已启动",
		awaiting_review: "待确认",
		pending_review: "待确认",
		review_pending: "待确认",
		review_approved: "审核通过",
		review_closed: "已关闭",
		approved: "已通过",
		done: "已完成",
		success: "已完成",
		succeeded: "已完成",
		completed: "已完成",
		finished: "已完成",
		failed: "失败",
		error: "异常",
		exception: "异常",
		blocked: "阻塞",
		cancelled: "已取消",
		canceled: "已取消"
	};
	if (dict[token]) return dict[token];
	if (token.includes("review") && token.includes("await")) return "待审核";
	if (token.includes("review") && token.includes("approve")) return "审核通过";
	if (token.includes("run")) return "执行中";
	if (token.includes("process")) return "处理中";
	if (token.includes("queue") || token.includes("pend")) return "排队中";
	if (token.includes("success") || token.includes("done") || token.includes("finish")) return "已完成";
	if (token.includes("fail")) return "失败";
	if (token.includes("error") || token.includes("except")) return "异常";
	if (token.includes("cancel")) return "已取消";
	return raw;
}

export function deriveNodeSnapshots(input: ChainInput): NodeSnapshot[] {
	const aiStatusCode = Number(input.aiStatus || 0);
	const aiStatus = String(input.aiStatus || "").toLowerCase();
	const aiStage = String(input.aiStage || "").toLowerCase();
	const aiDetail = mapAiStatusTextZh(input.aiStage || input.aiStatus || "unknown");
	let aiDone =
		aiStage.includes("review_approved") ||
		aiStage.includes("accepted") ||
		aiStage.includes("review_closed") ||
		(["done", "approved", "review_approved"].includes(aiStatus) &&
			(aiStage.includes("review_approved") ||
				aiStage.includes("accepted") ||
				aiStage.includes("review_closed")));
	let aiAwaitingReview =
		aiStage.includes("awaiting_review") ||
		aiStage.includes("pending_review") ||
		aiStatus.includes("awaiting_review") ||
		aiStage.includes("待确认") ||
		aiStage.includes("待审核");
	if (aiStatusCode === 390) {
		if (
			aiStage === "review_approved" ||
			aiStage === "accepted" ||
			aiStage === "review_closed"
		) {
			aiDone = true;
			aiAwaitingReview = false;
		} else {
			aiDone = false;
			aiAwaitingReview = true;
		}
	}
	const aiNeedAction =
		aiAwaitingReview ||
		["failed", "blocked", "cancelled"].includes(aiStatus) ||
		aiStage.includes("fail") ||
		aiStage.includes("error") ||
		aiStage.includes("exception") ||
		aiStage.includes("cancel");
	const copyState: ChainNodeState = aiDone ? "done" : aiNeedAction ? "need_action" : "in_progress";

	const designCode = Number(input.designStage ?? input.designStatus ?? 0);
	const designText = designTaskStatusText(designCode);
	const designDone = designCode === 401 || designCode === 500;
	const designNeedAction = designCode === 101 || designCode === 103;
	const designState: ChainNodeState = designDone ? "done" : designNeedAction ? "need_action" : "in_progress";

	const listingDone = String(input.listingStatus || "todo") === "done";
	const uploadDone = String(input.uploadStatus || "todo") === "done";

	const listingState: ChainNodeState = listingDone
		? "done"
		: copyState === "done"
		? "need_action"
		: "waiting_pre";
	const uploadState: ChainNodeState = uploadDone
		? "done"
		: listingState === "done" && designState === "done"
		? "need_action"
		: "waiting_pre";

	return [
		{ key: "copy", label: "文案", state: copyState, detail: aiDetail || "未知状态" },
		{ key: "design", label: "制图", state: designState, detail: designText || String(designCode || "未知状态") },
		{ key: "listing", label: "刊登", state: listingState, detail: listingDone ? "已完成刊登" : "未刊登" },
		{ key: "upload", label: "图片上传", state: uploadState, detail: uploadDone ? "已上传" : "未上传" },
	];
}

export function mapNodeToCompactTag(node: NodeSnapshot, input: ChainInput): CompactTag {
	if (node.key === "design" && node.state === "need_action") {
		const tooNew = evaluateDesignTaskTooNew({
			statusCode: Number(input.designStage ?? input.designStatus ?? 0),
			createTime: input.designTaskCreateTime
		});
		if (tooNew.tooNew) {
			return { text: "制图：建议稍候", type: "info" };
		}
	}
	return {
		text: node.state === "need_action" ? `${node.label}：需处理` : `${node.label}：${node.detail}`,
		type: node.state === "need_action" ? "danger" : "info"
	};
}

export function deriveCompactTags(input: ChainInput, limit = 2): CompactTag[] {
	const nodes = deriveNodeSnapshots(input);
	const priorityOrder: Array<NodeSnapshot["key"]> = ["listing", "design", "copy", "upload"];
	const candidates = nodes
		.filter((x) => x.state === "need_action" || x.state === "in_progress")
		.sort((a, b) => {
			if (a.state !== b.state) return a.state === "need_action" ? -1 : 1;
			return priorityOrder.indexOf(a.key) - priorityOrder.indexOf(b.key);
		});
	const tags = candidates.slice(0, limit).map((node) => mapNodeToCompactTag(node, input));
	if (tags.length) return tags;
	return [{ text: "已完成", type: "success" }];
}

