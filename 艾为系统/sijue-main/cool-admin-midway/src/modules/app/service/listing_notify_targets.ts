/** AI 图需生成完成（design_task.status → 103）时的通知上下文 */
export type DesignRequirementAiDoneNotifyContext = {
  designTaskId: number;
  candidateId: number;
  productName: string;
};

/** AI 文案任务生成完成（status=390, stage=awaiting_review） */
export type AiListingCopyDoneNotifyContext = {
  aiListingTaskId: number;
  candidateId: number;
  productName: string;
  variantCount: number;
};

export type DesignRequirementAiFailedNotifyContext = {
  designTaskId: number;
  candidateId: number;
  productName: string;
  reason: string;
};

export type AiListingCopyFailedNotifyContext = {
  aiListingTaskId: number;
  candidateId: number;
  productName: string;
  variantCount: number;
  reason: string;
};

/** @see ListingNotifyTargetsService.resolveListingTaskNotifyUserIds */
