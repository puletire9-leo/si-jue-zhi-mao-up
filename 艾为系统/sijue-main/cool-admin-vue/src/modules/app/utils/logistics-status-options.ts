export interface LogisticsStatusOption {
	label: string;
	value: string;
	short: string;
	description: string;
	field: string;
	rule: string;
}

export interface LogisticsStatusGroup {
	label: string;
	options: LogisticsStatusOption[];
}

export const logisticsStatusGroups: LogisticsStatusGroup[] = [
	{
		label: "常用",
		options: [
			{
				label: "在途",
				value: "in_transit",
				short: "在途",
				description: "已有物流包裹，但还没有签收，且未超过超时阈值。",
				field: "logistics_status = in_transit",
				rule: "有有效物流包裹，尚未全部签收，并且未超过7天。"
			},
			{
				label: "超时未签收",
				value: "overtime_unsigned",
				short: "超时",
				description: "已有物流包裹但超过阈值仍未签收，当前阈值按后端规则计算。",
				field: "logistics_status = overtime_unsigned",
				rule: "有有效物流包裹，全部未签收，并且已超过7天。"
			},
			{
				label: "全部签收",
				value: "signed",
				short: "签收",
				description: "采购单所有有效物流包裹均已签收，不需要再人工确认。",
				field: "logistics_status = signed",
				rule: "采购单所有有效物流包裹都已签收。"
			},
			{
				label: "已确认收货",
				value: "confirmed",
				short: "人工",
				description: "本地已人工确认收货，优先级高于物流包裹状态。",
				field: "logistics_status = confirmed",
				rule: "采购单已在系统里人工确认收货。"
			},
			{
				label: "暂无物流",
				value: "no_logistics",
				short: "无物流",
				description: "采购单创建时间较近，暂未录入物流包裹。",
				field: "logistics_status = no_logistics",
				rule: "采购单创建3天内，暂未录入有效物流包裹。"
			}
		]
	},
	{
		label: "待处理",
		options: [
			{
				label: "部分签收",
				value: "partial_signed",
				short: "部分",
				description: "采购单部分物流包裹已签收，仍有包裹未签收。",
				field: "logistics_status = partial_signed",
				rule: "多个有效包裹中，部分已签收，仍有包裹未签收，且未超过7天。"
			},
			{
				label: "部分签收超时",
				value: "partial_overtime_unsigned",
				short: "部分超时",
				description: "采购单部分物流包裹签收，其余包裹超过阈值未签收。",
				field: "logistics_status = partial_overtime_unsigned",
				rule: "多个有效包裹中，部分已签收，仍有包裹超过7天未签收。"
			},
			{
				label: "待自动识别",
				value: "pending_mapping",
				short: "识别",
				description: "运单号尚未自动识别出快递100编码，需要先识别快递公司。",
				field: "logistics_status = pending_mapping",
				rule: "存在快递100查询包裹，但还没有识别出快递公司编码。"
			},
			{
				label: "缺少手机号",
				value: "phone_required",
				short: "手机",
				description: "顺丰或中通等物流查询缺少手机号，需在包裹上补充手机号后再查。",
				field: "logistics_status = phone_required",
				rule: "存在需要手机号校验的包裹，但没有可用手机号。"
			},
			{
				label: "需人工判断",
				value: "manual_required",
				short: "人工",
				description: "该物流来源不走快递100查询，需要人工判断物流，不代表已经收货。",
				field: "logistics_status = manual_required",
				rule: "存在设置为不查快递100、需要人工判断物流的包裹。"
			}
		]
	},
	{
		label: "异常",
		options: [
			{
				label: "无物流异常",
				value: "logistics_abnormal",
				short: "无物流",
				description: "采购单创建超过 3 天仍没有有效物流包裹记录。",
				field: "logistics_status = logistics_abnormal",
				rule: "采购单创建超过3天，仍无有效物流包裹。"
			},
			{
				label: "轨迹异常",
				value: "logistics_exception",
				short: "轨迹",
				description: "快递100返回疑难、退回、拒签、清关异常等异常物流状态。",
				field: "logistics_status = logistics_exception",
				rule: "快递100返回疑难、退回、拒签、清关异常等异常轨迹状态。"
			}
		]
	}
];

export const logisticsStatusOptions = logisticsStatusGroups.flatMap((group) => group.options);

export function getLogisticsStatusLabel(status = "") {
	return logisticsStatusOptions.find((item) => item.value === status)?.label || status || "";
}
