import request from "@/utils/request";

/** 八爪鱼周表原始行 */
export interface BazhuayuRawRow {
  id: number;
  marketplace: string;
  asin: string;
  price: string | null;
  reviews: string | null;
  title: string | null;
  weekTag: string;
  lotNo: string | null;
  scrapedAt: string;
}

/** 分页响应（后端手动分页） */
export interface PageResp<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
}

/** 自动初筛任务（asin_import_tasks 的子集） */
export interface BazhuayuTask {
  id: number;
  marketplace: string;
  importType: string;
  taskStatus: string;
  totalCount: number;
  passCount: number;
  priceFailCount: number;
  reviewFailCount: number;
  duplicateCount: number;
  skipCount: number;
  batchTotal: number;
  batchCurrent: number;
  apiSuccess: number;
  apiFail: number;
  dataMonth: string | null;
  createdAt: string;
}

export interface BazhuayuTaskMapItem {
  id: number;
  marketplace: string;
  importType: string;
  bazhuayuMappingId?: number | null;
  bazhuayuTaskId?: string | null;
  taskName?: string | null;
  taskCategory?: string | null;
  initialFilter: boolean;
  targetTable?: string | null;
  status: string;
  processedCount: number;
  totalCount: number;
  passCount: number;
  priceFailCount: number;
  reviewFailCount: number;
  duplicateCount: number;
  skipCount: number;
  batchTotal: number;
  batchCurrent: number;
  apiSuccess: number;
  apiFail: number;
  apiRequestsUsed: number;
  parentAsinCount: number;
  variantAsinCount: number;
  dataMonth: string | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt: string;
  /** 关联的请求中心 ASIN 批量运行；存在时优先展示其真实执行状态。 */
  sellerSpriteRun?: SellerspriteRunSummary | null;
}

export interface SellerspriteRunSummary {
  runId: string;
  status: string;
  totalCount: number;
  pendingCount: number;
  runningCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  apiCalls: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastErrorMessage?: string | null;
}

export interface BazhuayuMarketplaceOverview {
  marketplace: string;
  // 当前运行（内存态）
  currentPhase: BazhuayuPhase;
  currentRunning: boolean;
  currentCloudExtractCount: number;
  currentDrainedRows: number;
  currentError: string | null;
  // 本周
  weeklyRawCount: number;
  weekTaskCount: number;
  weekReadyCount: number;
  weekRunningCount: number;
  weekDoneCount: number;
  weekErrorCount: number;
  weekPausedCount: number;
  // 历史累计
  lifetimeTaskCount: number;
  lifetimeDoneCount: number;
  lifetimeErrorCount: number;
  latestTask: BazhuayuTaskMapItem | null;
  // 云端行数快照（后端每小时刷 + 前端可手动刷；null = 未同步过）
  cloudStatsBangdan: BazhuayuCloudStat | null;
  cloudStatsYitushitu: BazhuayuCloudStat | null;
}

/** 云端行数快照，来自 BazhuayuCloudStatsService */
export interface BazhuayuCloudStat {
  function: string;
  marketplace: string;
  taskId: string;
  /** 云端返回的原始状态: Finished / Running / Stopped / "" */
  cloudStatus: string | null;
  /** 云端当前已采集条数 */
  cloudCount: number;
  /** 最新一次云采集批次号，格式 yyyyMMdd-HHmmss */
  latestBatchNo: string | null;
  latestBatchStartTime: string | null;
  latestBatchExecutingTime: string | null;
  latestBatchEndTime: string | null;
  latestBatchCount: number;
  /** 上次刷新成功时间 ISO 字符串 */
  lastSyncAt: string | null;
  /** 上次刷新失败的错误信息(可能非空但 lastSyncAt 也非空,代表最近一次失败) */
  lastError: string | null;
  lastErrorAt: string | null;
}

export interface BazhuayuTaskEntry {
  id: number;
  taskName: string;
  functionKey: string;
  marketplace: string;
  taskId: string;
  taskCategory: string;
  initialFilter: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 跨站点汇总（后端预计算） */
export interface BazhuayuOverviewSummary {
  currentRunning: number;
  currentCloudExtractCount: number;
  weeklyRawCount: number;
  weekTaskCount: number;
  weekDoneCount: number;
  weekErrorCount: number;
  lifetimeTaskCount: number;
  lifetimeDoneCount: number;
  lifetimeErrorCount: number;
}

/** 当前连接的数据库（只读展示，不含账密） */
export interface BazhuayuDatasourceInfo {
  profile: string;
  host: string;
  port: string;
  database: string;
}

export interface BazhuayuOverviewResp {
  weekTag: string;
  weekStart: string;
  currentStates: BazhuayuRunState[];
  marketplaces: BazhuayuMarketplaceOverview[];
  /** 本周内产生的任务（createdAt >= weekStart） */
  weekTasks: BazhuayuTaskMapItem[];
  /** 历史全部任务 */
  lifetimeTasks: BazhuayuTaskMapItem[];
  summary: BazhuayuOverviewSummary;
  datasource: BazhuayuDatasourceInfo;
}

/** 一条龙运行阶段 */
export type BazhuayuPhase =
  | "IDLE"
  | "STARTING"
  | "WAITING_CLOUD"
  | "DRAINING"
  | "DONE"
  | "ERROR"
  | "TIMEOUT"
  | "STOPPED";

/** 单任务一条龙运行态（后端内存态） */
export interface BazhuayuRunState {
  taskKey: string;
  function: string; // 'bangdan' | 'yitushitu'
  marketplace: string;
  taskId: string;
  phase: BazhuayuPhase;
  lotNo: string | null;
  cloudExtractCount: number;
  drainedRows: number;
  error: string | null;
  cancelRequested: boolean;
  startedAt: number;
  updatedAt: number;
}

/** 启动云端采集结果 */
export interface StartCollectResp {
  function: string;
  accepted: string[]; // 已启动的站点
  skipped: string[]; // 正在跑被跳过
  missing: string[]; // 未配置 taskId
}

/** 以图识图结果行 */
export interface ImageSearchResult {
  id: number;
  sourceAsin: string;
  marketplace: string;
  sourceImageUrl: string | null;
  searchUrl: string | null;
  resultAsin: string | null;
  resultTitle: string | null;
  resultImage: string | null;
  resultPrice: string | null;
  lotNo: string | null;
  scrapedAt: string | null;
  createdAt: string | null;
}

/** Result<T> 包装解包：拦截器返回整个 {code,message,data}，业务层只需 data */
function unwrap<T>(p: Promise<any>): Promise<T> {
  return p.then((res) => res?.data as T);
}

export const bazhuayuApi = {
  /** 读取已采数据：手动触发一次 drain 增量（异步，不启动云端） */
  trigger(
    marketplace?: string,
    taskId?: string,
    func = "bangdan",
    batch?: Pick<
      BazhuayuCloudStat,
      | "latestBatchNo"
      | "latestBatchStartTime"
      | "latestBatchEndTime"
      | "latestBatchCount"
    >,
  ): Promise<{ status: string; marketplace: string; batchNo: string }> {
    return unwrap(
      request({
        url: "/api/v1/modules/bazhuayu/trigger",
        method: "post",
        params: {
          function: func,
          ...(marketplace ? { marketplace } : {}),
          ...(taskId ? { taskId } : {}),
          ...(batch?.latestBatchNo ? { batchNo: batch.latestBatchNo } : {}),
          ...(batch?.latestBatchStartTime
            ? { batchStartTime: batch.latestBatchStartTime }
            : {}),
          ...(batch?.latestBatchEndTime
            ? { batchEndTime: batch.latestBatchEndTime }
            : {}),
          ...(batch ? { batchCount: batch.latestBatchCount || 0 } : {}),
        },
      }),
    );
  },

  /** 启动云端采集一条龙（启动→等待→榜单则入库初筛，全异步） */
  startCollect(func: string, marketplace?: string, taskId?: string): Promise<StartCollectResp> {
    return unwrap(
      request({
        url: "/api/v1/modules/bazhuayu/start-collect",
        method: "post",
        params: {
          function: func,
          ...(marketplace ? { marketplace } : {}),
          ...(taskId ? { taskId } : {}),
        },
      }),
    );
  },

  /** 停止采集：协作式取消 + 调云端 stopExtraction */
  stopCollect(
    func: string,
    marketplace: string,
    taskId?: string,
  ): Promise<{
    function: string;
    marketplace: string;
    stopped: boolean;
    cloudStopError?: string;
  }> {
    return unwrap(
      request({
        url: "/api/v1/modules/bazhuayu/stop-collect",
        method: "post",
        params: { function: func, marketplace, ...(taskId ? { taskId } : {}) },
      }),
    );
  },

  /** 查询 6 任务一条龙运行态（前端轮询） */
  runState(): Promise<BazhuayuRunState[]> {
    return unwrap<BazhuayuRunState[]>(
      request({ url: "/api/v1/modules/bazhuayu/run-state", method: "get" }),
    ).then((d) => (Array.isArray(d) ? d : []));
  },

  /** 分页查询本周原始采集数据 */
  weeklyRaw(
    page = 1,
    size = 50,
    marketplace?: string,
  ): Promise<PageResp<BazhuayuRawRow>> {
    return unwrap(
      request({
        url: "/api/v1/modules/bazhuayu/weekly-raw",
        method: "get",
        params: { page, size, marketplace },
      }),
    );
  },

  /** 本周自动初筛任务列表 */
  latestTasks(): Promise<BazhuayuTask[]> {
    return unwrap<BazhuayuTask[]>(
      request({ url: "/api/v1/modules/bazhuayu/latest-tasks", method: "get" }),
    ).then((d) => (Array.isArray(d) ? d : []));
  },

  /** 控制台总览：当前态 + 历史任务 + 周原始量 */
  overview(): Promise<BazhuayuOverviewResp> {
    return unwrap<BazhuayuOverviewResp>(
      request({ url: "/api/v1/modules/bazhuayu/overview", method: "get" }),
    );
  },

  /** 读回当前生效的任务映射（DB 优先，env 回退）+ 来源标识 */
  getMapping(): Promise<{
    mapping: Record<string, Record<string, string>>;
    taskNames: Record<string, Record<string, string>>;
    entries: BazhuayuTaskEntry[];
    fromDb: boolean;
  }> {
    return unwrap(
      request({
        url: "/api/v1/modules/bazhuayu/config/mapping",
        method: "get",
      }),
    );
  },

  createTaskEntry(data: {
    taskName: string;
    function: string;
    marketplace: string;
    taskId: string;
    taskCategory: string;
    initialFilter?: boolean;
  }): Promise<BazhuayuTaskEntry> {
    return unwrap(request({
      url: "/api/v1/modules/bazhuayu/config/task-entry",
      method: "post",
      data,
    }));
  },

  updateTaskEntry(id: number, data: {
    taskName: string;
    taskId: string;
    taskCategory: string;
    initialFilter?: boolean;
  }): Promise<BazhuayuTaskEntry> {
    return unwrap(request({
      url: `/api/v1/modules/bazhuayu/config/task-entry/${id}`,
      method: "put",
      data,
    }));
  },

  deleteTaskEntry(id: number): Promise<void> {
    return unwrap(request({
      url: `/api/v1/modules/bazhuayu/config/task-entry/${id}`,
      method: "delete",
    }));
  },

  /** 整包覆盖任务映射（旧接口，PUT，JSON） */
  updateMapping(
    mapping: Record<string, Record<string, string>>,
  ): Promise<void> {
    return unwrap(
      request({
        url: "/api/v1/modules/bazhuayu/config/mapping",
        method: "put",
        data: { mapping },
      }),
    );
  },

  /** 新增或更新单条映射 (function+marketplace → taskId)，前端 CRUD 行内保存用 */
  upsertMappingEntry(
    function_: string,
    marketplace: string,
    taskId: string,
    taskName: string,
  ): Promise<Record<string, Record<string, string>>> {
    return unwrap(
      request({
        url: "/api/v1/modules/bazhuayu/config/mapping/entry",
        method: "post",
        data: { function: function_, marketplace, taskId, taskName },
      }),
    );
  },

  /** 删除单条映射，删空整表则代码回退 env */
  deleteMappingEntry(
    function_: string,
    marketplace: string,
  ): Promise<Record<string, Record<string, string>>> {
    return unwrap(
      request({
        url: "/api/v1/modules/bazhuayu/config/mapping/entry",
        method: "delete",
        params: { function: function_, marketplace },
      }),
    );
  },

  /** 查询云端行数快照（后端每小时刷 + 手动刷；进程内缓存） */
  cloudStats(): Promise<Record<string, BazhuayuCloudStat>> {
    return unwrap<Record<string, BazhuayuCloudStat>>(
      request({
        url: "/api/v1/modules/bazhuayu/cloud-stats",
        method: "get",
      }),
    ).then((d) => d ?? {});
  },

  /**
   * 手动触发云端行数刷新。
   * 不带参数=全刷；带 function+marketplace=单条刷（避免云端 API 限流）。
   */
  refreshCloudStats(
    function_?: string,
    marketplace?: string,
    taskId?: string,
  ): Promise<{
    refreshed: number;
    stat?: BazhuayuCloudStat;
    snapshot?: Record<string, BazhuayuCloudStat>;
  }> {
    return unwrap(
      request({
        url: "/api/v1/modules/bazhuayu/cloud-stats/refresh",
        method: "post",
        params: {
          ...(function_ ? { function: function_ } : {}),
          ...(marketplace ? { marketplace } : {}),
          ...(taskId ? { taskId } : {}),
        },
        // 全刷走一次批量状态接口；保留较长超时以兼容云端偶发延迟和退避重试。
        timeout: 90000,
      }),
    );
  },

  /** 以图识图：对一个 ASIN 发起英国 stylesnap 视觉搜索（同步等待，约数分钟） */
  imageSearch(
    asin: string,
    forceRefresh = false,
  ): Promise<ImageSearchResult[]> {
    return unwrap<ImageSearchResult[]>(
      request({
        url: "/api/v1/modules/bazhuayu/image-search",
        method: "post",
        data: { asin, forceRefresh },
        // 云端采集耗时长，单独放大超时到 10 分钟
        timeout: 600000,
      }),
    ).then((d) => (Array.isArray(d) ? d : []));
  },

  /** 查询以图识图缓存结果（不触发采集） */
  getImageSearch(asin: string): Promise<ImageSearchResult[]> {
    return unwrap<ImageSearchResult[]>(
      request({
        url: `/api/v1/modules/bazhuayu/image-search/${encodeURIComponent(asin)}`,
        method: "get",
      }),
    ).then((d) => (Array.isArray(d) ? d : []));
  },
};
