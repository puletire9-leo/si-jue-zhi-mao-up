import { service } from "/@/cool";

/**
 * dufs 根目录为整盘 D:\ 时，上传路径选择器的默认进入目录（相对根、以 / 结尾）。
 */
export const ASSET_UPLOAD_PATH_DEFAULTS = {
	/** 摄影上传路径 */
	photographer: "comfyui共享/",
	/** 美工上传路径 */
	designer: "美工图片（已完成）/"
} as const;

export type AssetUploadPathRole = keyof typeof ASSET_UPLOAD_PATH_DEFAULTS;

export function getAssetUploadPathDefault(role: AssetUploadPathRole): string {
	return ASSET_UPLOAD_PATH_DEFAULTS[role];
}

/** 将已存路径规范为目录前缀；空串时返回该角色的默认目录 */
export function resolveAssetUploadPickerPath(
	existing: string | null | undefined,
	role: AssetUploadPathRole
): string {
	let p = String(existing || "").trim().replace(/^\/+/, "");
	if (p && !p.endsWith("/")) {
		const i = p.lastIndexOf("/");
		p = i >= 0 ? p.slice(0, i + 1) : "";
	}
	if (!p) {
		p = getAssetUploadPathDefault(role);
	}
	return p;
}

/**
 * 将用户粘贴的 Windows/本地路径转为 dufs 相对路径（素材库根 = D:\）。
 * 例：D:\comfyui共享\刘 已完成 → comfyui共享/刘 已完成
 */
export function normalizeAssetUploadPath(input: string): string {
	let s = String(input || "").trim();
	if (!s) return "";

	// dufs 根为整盘 D:\，剥掉盘符前缀
	s = s.replace(/^[dD]:[\\/]+/, "");

	s = s.replace(/\\/g, "/");
	s = s.replace(/^\/+/, "");
	s = s.replace(/\/+/g, "/");
	s = s.replace(/\/+$/, "");
	return s;
}

/** 目录路径统一以 / 结尾（与浏览选择器、后端存储一致） */
export function toAssetUploadDirectoryPath(relativeNoTrailing: string): string {
	const p = String(relativeNoTrailing || "")
		.trim()
		.replace(/\/+$/, "");
	if (!p) return "";
	return `${p}/`;
}

export interface AssetUploadPathResolveResult {
	path: string;
	error?: string;
}

async function checkAssetPath(
	relativeNoTrailing: string
): Promise<{ exists: boolean; isDirectory: boolean }> {
	const p = String(relativeNoTrailing || "").replace(/^\/+/, "").replace(/\/+$/, "");
	if (!p) {
		return { exists: true, isDirectory: true };
	}
	const r: any = await (service as any).app.asset.request({
		url: "/checkPath",
		method: "POST",
		data: { path: p }
	});
	return {
		exists: !!r?.exists,
		isDirectory: !!r?.isDirectory
	};
}

/**
 * 规范化用户输入并校验为有效目录路径（调用 /checkPath）。
 * 若指向文件则自动取其父目录。
 */
export async function resolveAndValidateAssetUploadPath(
	input: string
): Promise<AssetUploadPathResolveResult> {
	const raw = String(input || "").trim();
	if (!raw) return { path: "" };

	if (/^[a-zA-Z]:[\\/]/.test(raw) && !/^[dD]:[\\/]/.test(raw)) {
		return { path: "", error: "仅支持 D 盘路径（素材库根目录为 D:\\）" };
	}
	if (raw.startsWith("\\\\") || raw.startsWith("//")) {
		return { path: "", error: "暂不支持网络路径，请使用 D 盘本地路径或浏览选择" };
	}

	let relative = normalizeAssetUploadPath(raw);
	if (!relative) {
		return { path: "", error: "路径无效：不能仅为 D 盘根目录" };
	}

	let probe = await checkAssetPath(relative);
	if (probe.exists && !probe.isDirectory) {
		const idx = relative.lastIndexOf("/");
		if (idx <= 0) {
			return { path: "", error: "路径指向文件，且无法推断父目录" };
		}
		relative = relative.slice(0, idx);
		probe = await checkAssetPath(relative);
	}

	if (!probe.exists) {
		return { path: "", error: `路径不存在：${raw}` };
	}
	if (!probe.isDirectory) {
		return { path: "", error: `路径不是有效目录：${raw}` };
	}

	return { path: toAssetUploadDirectoryPath(relative) };
}
