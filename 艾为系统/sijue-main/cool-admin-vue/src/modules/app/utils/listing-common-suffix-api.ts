import { service } from "/@/cool";

const BASE = "/admin/app/listingCommonSuffix";

export type CommonSuffixRecord = {
	id: number;
	user_id: number;
	use_scene: string;
	suffix_en: string;
	suffix_de: string;
	submitter: string;
};

export type CommonSuffixApplyPayload = {
	rowKey: string;
	suffixEn: string;
	suffixDe: string;
	useScene: string;
};

export type CommonSuffixRevertPayload = {
	rowKey: string;
};

function unwrapPayload(res: any) {
	const raw = res?.data ?? res;
	return raw?.data !== undefined ? raw.data : raw;
}

function getListingCommonSuffixApi() {
	return (service as any).app?.listingCommonSuffix as Record<string, any> | undefined;
}

async function requestCommonSuffix(
	path: string,
	method: "GET" | "POST",
	data?: Record<string, any>
) {
	const api = getListingCommonSuffixApi();
	const key = path.replace(/^\//, "");
	if (method === "GET" && api?.[key]) {
		return api[key](data);
	}
	if (method === "POST" && api?.[key]) {
		return api[key](data);
	}
	return service.request({ url: `${BASE}${path}`, method, data });
}

export async function fetchListingCommonSuffixes(): Promise<{
	list: CommonSuffixRecord[];
}> {
	const res = await requestCommonSuffix("/list", "GET");
	const payload = unwrapPayload(res);
	const list = Array.isArray(payload?.list) ? payload.list : [];
	return {
		list: list.map((x: any) => ({
			id: Number(x?.id || 0),
			user_id: Number(x?.user_id || 0),
			use_scene: String(x?.use_scene || "").trim(),
			suffix_en: String(x?.suffix_en || "").trim(),
			suffix_de: String(x?.suffix_de || "").trim(),
			submitter: String(x?.submitter || "").trim()
		}))
	};
}

export async function addListingCommonSuffix(data: {
	use_scene: string;
	suffix_en?: string;
	suffix_de?: string;
}): Promise<CommonSuffixRecord> {
	const res = await requestCommonSuffix("/add", "POST", data);
	const payload = unwrapPayload(res);
	const row = payload?.row || payload;
	return {
		id: Number(row?.id || 0),
		user_id: Number(row?.user_id || 0),
		use_scene: String(row?.use_scene || "").trim(),
		suffix_en: String(row?.suffix_en || "").trim(),
		suffix_de: String(row?.suffix_de || "").trim(),
		submitter: String(row?.submitter || "").trim()
	};
}

export async function updateListingCommonSuffix(data: {
	id: number;
	use_scene: string;
	suffix_en?: string;
	suffix_de?: string;
}): Promise<CommonSuffixRecord> {
	const res = await requestCommonSuffix("/update", "POST", data);
	const payload = unwrapPayload(res);
	const row = payload?.row || payload;
	return {
		id: Number(row?.id || data.id),
		user_id: Number(row?.user_id || 0),
		use_scene: String(row?.use_scene || "").trim(),
		suffix_en: String(row?.suffix_en || "").trim(),
		suffix_de: String(row?.suffix_de || "").trim(),
		submitter: String(row?.submitter || "").trim()
	};
}

export async function deleteListingCommonSuffix(id: number) {
	return requestCommonSuffix("/delete", "POST", { id });
}

export async function translateListingSuffixEnToDe(text: string): Promise<string> {
	const taskApi = (service as any).app?.ai_listing_task;
	if (taskApi?.request) {
		const res = await taskApi.request({
			url: "/translateEnToDe",
			method: "POST",
			data: { text }
		});
		const payload = unwrapPayload(res);
		return String(payload?.text ?? "").trim();
	}
	const res = await requestCommonSuffix("/translateEnToDe", "POST", { text });
	const payload = unwrapPayload(res);
	return String(payload?.text ?? "").trim();
}
