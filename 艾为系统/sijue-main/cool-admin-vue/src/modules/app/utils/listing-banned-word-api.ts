import { service } from "/@/cool";

const BASE = "/admin/app/listingBannedWord";

export type BannedWordRecord = {
	id: number;
	user_id: number;
	word: string;
	reason: string;
	submitter: string;
};

function unwrapPayload(res: any) {
	const raw = res?.data ?? res;
	return raw?.data !== undefined ? raw.data : raw;
}

/** EPS 键名为 listingBannedWord，与 controller 前缀一致 */
export function getListingBannedWordApi() {
	return (service as any).app?.listingBannedWord as Record<string, any> | undefined;
}

async function requestBannedWord(
	path: string,
	method: "GET" | "POST",
	data?: Record<string, any>
) {
	const api = getListingBannedWordApi();
	const key = path.replace(/^\//, "");
	if (method === "GET" && api?.[key]) {
		return api[key](data);
	}
	if (method === "POST" && api?.[key]) {
		return api[key](data);
	}
	return service.request({ url: `${BASE}${path}`, method, data });
}

export async function fetchListingBannedWords(): Promise<{ list: BannedWordRecord[] }> {
	const res = await requestBannedWord("/list", "GET");
	const payload = unwrapPayload(res);
	const list = Array.isArray(payload?.list) ? payload.list : [];
	return {
		list: list.map((x: any) => ({
			id: Number(x?.id || 0),
			user_id: Number(x?.user_id || 0),
			word: String(x?.word || "").trim(),
			reason: String(x?.reason || "").trim(),
			submitter: String(x?.submitter || "").trim()
		}))
	};
}

export async function addListingBannedWord(data: {
	word: string;
	reason?: string;
}): Promise<BannedWordRecord> {
	const res = await requestBannedWord("/add", "POST", data);
	const payload = unwrapPayload(res);
	const row = payload?.row || payload;
	return {
		id: Number(row?.id || 0),
		user_id: Number(row?.user_id || 0),
		word: String(row?.word || "").trim(),
		reason: String(row?.reason || "").trim(),
		submitter: String(row?.submitter || "").trim()
	};
}

export async function updateListingBannedWord(data: {
	id: number;
	word: string;
	reason?: string;
}): Promise<BannedWordRecord> {
	const res = await requestBannedWord("/update", "POST", data);
	const payload = unwrapPayload(res);
	const row = payload?.row || payload;
	return {
		id: Number(row?.id || data.id),
		user_id: Number(row?.user_id || 0),
		word: String(row?.word || "").trim(),
		reason: String(row?.reason || "").trim(),
		submitter: String(row?.submitter || "").trim()
	};
}

export async function deleteListingBannedWord(id: number) {
	return requestBannedWord("/delete", "POST", { id });
}

export async function saveListingBannedWordsReplace(
	items: Array<{ word: string; reason?: string }>
) {
	return requestBannedWord("/saveReplace", "POST", { items });
}
