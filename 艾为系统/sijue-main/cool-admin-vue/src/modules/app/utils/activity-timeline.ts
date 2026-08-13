import type { TimelineItem } from "../components/timeline.vue";
import { service } from "/@/cool";

export function formatActivityTime(raw: string): string {
	const s = String(raw || "").trim();
	if (!s) return "";
	if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
		const d = new Date(s);
		if (!Number.isNaN(d.getTime())) {
			return d.toLocaleString("zh-CN", { hour12: false });
		}
	}
	return s;
}

export function mapDesignTaskTimeline(raw: unknown): TimelineItem[] {
	return (Array.isArray(raw) ? raw : []).map((x: any) => ({
		time: formatActivityTime(String(x?.time ?? x?.at ?? "")),
		content: String(x?.content ?? x?.remark ?? x?.title ?? ""),
		operator: String(x?.operator ?? x?.user ?? x?.username ?? "")
	})).filter((x) => x.time || x.content);
}

export function mapAiListingTimeline(raw: unknown): TimelineItem[] {
	return (Array.isArray(raw) ? raw : []).map((x: any) => ({
		time: formatActivityTime(String(x?.at ?? x?.time ?? "")),
		content: String(x?.remark ?? x?.title ?? x?.content ?? ""),
		operator: String(x?.operator ?? "")
	})).filter((x) => x.time || x.content);
}

export function mapWorkbenchTimeline(raw: unknown): TimelineItem[] {
	return (Array.isArray(raw) ? raw : []).map((x: any) => {
		const domain = String(x?.domain || "").trim();
		const prefix = domain === "ai" ? "AI" : domain === "design" ? "图需" : "";
		const title = String(x?.title ?? x?.remark ?? x?.content ?? "");
		return {
			time: formatActivityTime(String(x?.at ?? x?.time ?? "")),
			content: prefix ? `[${prefix}] ${title}` : title,
			operator: String(x?.operator ?? "")
		};
	}).filter((x) => x.time || x.content);
}

async function requestTimelineData(
	url: string,
	id: number
): Promise<{ timeline?: unknown; updateTime?: string }> {
	const res = await (service as any).request({
		url,
		method: "GET",
		params: { id }
	});
	return (res?.data ?? res) as { timeline?: unknown; updateTime?: string };
}

export async function fetchDesignTaskTimelineItems(taskId: number): Promise<TimelineItem[]> {
	const api = (service as any).app?.design_task;
	let data: { timeline?: unknown };
	if (typeof api?.timeline === "function") {
		const res = await api.timeline({ id: taskId });
		data = res?.data ?? res;
	} else {
		data = await requestTimelineData("/admin/app/design_task/timeline", taskId);
	}
	return mapDesignTaskTimeline(data?.timeline);
}

export async function fetchAiListingTimelineItems(taskId: number): Promise<TimelineItem[]> {
	const api = (service as any).app?.ai_listing_task;
	let data: { timeline?: unknown };
	if (typeof api?.timeline === "function") {
		const res = await api.timeline({ id: taskId });
		data = res?.data ?? res;
	} else {
		data = await requestTimelineData("/admin/app/ai_listing_task/timeline", taskId);
	}
	return mapAiListingTimeline(data?.timeline);
}

export async function fetchWorkbenchTimelineItems(workItemId: number): Promise<TimelineItem[]> {
	const api = (service as any).app?.content_workbench;
	let data: { timeline?: unknown };
	if (typeof api?.timeline === "function") {
		const res = await api.timeline({ id: workItemId });
		data = res?.data ?? res;
	} else {
		data = await requestTimelineData("/admin/app/content_workbench/timeline", workItemId);
	}
	return mapWorkbenchTimeline(data?.timeline);
}
