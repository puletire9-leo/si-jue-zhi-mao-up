/** 图需任务创建未满该时长且 status=101 时，建议暂缓生成图需 */
export const DESIGN_TASK_TOO_NEW_MS = 3 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** 展示用剩余天数上限（与等待窗口一致，避免 ceil/时区导致出现「约剩 4 天」） */
export const DESIGN_TASK_TOO_NEW_MAX_DAYS = 3;

export interface DesignTaskTooNewInput {
	statusCode?: number;
	status?: string | number;
	createTime?: string | number | Date | null;
	now?: number;
}

export interface DesignTaskTooNewInfo {
	tooNew: boolean;
	daysLeft: number;
	remainingMs: number;
	createTimeMs: number;
}

export function evaluateDesignTaskTooNew(input: DesignTaskTooNewInput): DesignTaskTooNewInfo {
	const statusCode = Number(input.statusCode ?? input.status ?? 0);
	const createTimeMs = input.createTime ? new Date(input.createTime).getTime() : 0;
	const now = input.now ?? Date.now();
	// 忽略 createTime 略晚于本地的时区偏差，避免剩余窗口被放大到 >3 天
	const elapsed = createTimeMs ? Math.max(0, now - createTimeMs) : DESIGN_TASK_TOO_NEW_MS;
	const remainingMs = createTimeMs ? Math.max(0, DESIGN_TASK_TOO_NEW_MS - elapsed) : 0;
	const tooNew = statusCode === 101 && !!createTimeMs && elapsed < DESIGN_TASK_TOO_NEW_MS;
	const daysLeft = tooNew
		? Math.max(1, Math.min(DESIGN_TASK_TOO_NEW_MAX_DAYS, Math.ceil(remainingMs / MS_PER_DAY)))
		: 0;
	return { tooNew, daysLeft, remainingMs, createTimeMs };
}

export function isDesignTaskTooNew(input: DesignTaskTooNewInput): boolean {
	return evaluateDesignTaskTooNew(input).tooNew;
}

export function designTooNewReasonHint(info: DesignTaskTooNewInfo): string {
	if (!info.tooNew) return "";
	return `建议等待运营完成「做/不做」决策满 3 天后再生成图需（约剩 ${info.daysLeft} 天）`;
}

/** 102 运行中超过该时长未更新，视为可重新触发生成 */
export const DESIGN_REQUIREMENT_AI_STALE_MS = 5 * 60 * 1000;

export function isDesignRequirementAiRegenerable(input: {
	statusCode?: number;
	updateTime?: string | number | Date | null;
	now?: number;
}): boolean {
	const statusCode = Number(input.statusCode ?? 0);
	if (statusCode !== 102) return false;
	const updateTimeMs = input.updateTime ? new Date(input.updateTime).getTime() : 0;
	if (!updateTimeMs || Number.isNaN(updateTimeMs)) return true;
	const now = input.now ?? Date.now();
	return now - updateTimeMs >= DESIGN_REQUIREMENT_AI_STALE_MS;
}
