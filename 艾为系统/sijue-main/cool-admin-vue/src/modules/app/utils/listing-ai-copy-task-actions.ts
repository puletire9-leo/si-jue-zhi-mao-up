/** 是否展示「触发德国文案」按钮（以任务结果快照为准） */
export function canShowTriggerDeButton(row?: {
	can_trigger_de?: boolean;
	canTriggerDe?: boolean;
} | null): boolean {
	return Boolean(row?.can_trigger_de ?? row?.canTriggerDe);
}
