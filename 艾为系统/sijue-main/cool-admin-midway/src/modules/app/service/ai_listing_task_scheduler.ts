import {
  App,
  Config,
  Logger,
  Provide,
  Scope,
  ScopeEnum,
} from '@midwayjs/decorator';
import { ILogger } from '@midwayjs/logger';
import { IMidwayApplication } from '@midwayjs/core';
import { JobsOptions, Queue, Worker } from 'bullmq';

type AiListingQueueJobType = 'ai_listing.generate';
type JobPayload = {
  taskId: number;
  taskType?: string;
  taskMode?: string;
  countryCode?: string;
  candidateId?: number;
  amazonAccountId?: string | null;
  variantIds?: string[] | null;
  groupKey?: string | null;
  rootTaskId?: number | null;
  mergeIntoTaskId?: number | null;
  stage?: string;
  triggerSource?: string;
  triggeredBy?: string;
};

@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class AiListingTaskSchedulerService {
  @App()
  app: IMidwayApplication;

  @Logger()
  logger: ILogger;

  @Config('cool')
  coolConfig: any;

  @Config('aiListingTaskQueue')
  queueConfig: {
    enabled?: boolean;
    queueName?: string;
    concurrency?: number;
    defaultAttempts?: number;
    defaultTimeoutMs?: number;
    keepCompletedSeconds?: number;
    keepFailedSeconds?: number;
  };

  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private started = false;

  isEnabled(): boolean {
    return !!this.queueConfig?.enabled;
  }

  private getConnection() {
    const redis = this.coolConfig?.redis || {};
    return {
      host: redis.host || '127.0.0.1',
      port: Number(redis.port || 6379),
      password: redis.password || undefined,
      db: redis.db != null ? Number(redis.db) : undefined,
    };
  }

  private getQueueName() {
    return this.queueConfig?.queueName || 'ai-listing-task-queue';
  }

  private getDefaultJobOptions(): JobsOptions {
    return {
      attempts: Math.max(1, Number(this.queueConfig?.defaultAttempts || 2)),
      removeOnComplete: {
        age: Number(this.queueConfig?.keepCompletedSeconds || 7 * 24 * 3600),
      },
      removeOnFail: {
        age: Number(this.queueConfig?.keepFailedSeconds || 14 * 24 * 3600),
      },
      backoff: {
        type: 'exponential',
        delay: 5_000,
      },
    };
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`任务执行超时(${timeoutMs}ms)`)),
        timeoutMs
      );
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async pushJobLog(job: any, message: string) {
    try {
      if (typeof job?.log === 'function') {
        await job.log(String(message || ''));
      }
    } catch (e) {
      this.logger.warn(
        '[aiListingTaskJob:%s] write job.log failed: %s',
        job?.id,
        (e as any)?.message || String(e)
      );
    }
  }

  private async pushJobProgress(
    job: any,
    progress: number | Record<string, any>
  ) {
    try {
      if (typeof job?.updateProgress === 'function') {
        await job.updateProgress(progress);
      }
    } catch (e) {
      this.logger.warn(
        '[aiListingTaskJob:%s] update progress failed: %s',
        job?.id,
        (e as any)?.message || String(e)
      );
    }
  }

  async onServerReady() {
    if (!this.isEnabled() || this.started) return;
    this.queue = new Queue(this.getQueueName(), {
      connection: this.getConnection(),
      defaultJobOptions: this.getDefaultJobOptions(),
    });

    const concurrency = Math.max(1, Number(this.queueConfig?.concurrency || 2));
    this.worker = new Worker(
      this.getQueueName(),
      async job => {
        const payload = ((job.data || {}).payload || {}) as JobPayload;
        const taskService: any = await this.app
          .getApplicationContext()
          .getAsync('aiListingTaskService');
        const timeoutMs = Math.max(
          30_000,
          Number(this.queueConfig?.defaultTimeoutMs || 10 * 60_000)
        );
        const startedAt = Date.now();
        await this.pushJobProgress(job, {
          stage: 'running',
          percent: 5,
          taskId: payload.taskId,
          taskType: payload.taskType || '',
          taskMode: payload.taskMode || '',
          countryCode: payload.countryCode || '',
          candidateId: payload.candidateId || null,
          accountId: payload.amazonAccountId || null,
          variantIds: payload.variantIds || [],
          groupKey: payload.groupKey || '',
          rootTaskId: payload.rootTaskId || null,
          mergeIntoTaskId: payload.mergeIntoTaskId || null,
          queueStage: payload.stage || '',
          startedAt,
        });
        await this.pushJobLog(
          job,
          `[start] name=${
            job.name
          } timeoutMs=${timeoutMs} payload=${JSON.stringify({
            taskId: payload.taskId,
            taskType: payload.taskType || '',
            taskMode: payload.taskMode || '',
            countryCode: payload.countryCode || '',
            candidateId: payload.candidateId || null,
            accountId: payload.amazonAccountId || null,
            variantIds: payload.variantIds || [],
            groupKey: payload.groupKey || '',
            rootTaskId: payload.rootTaskId || null,
            mergeIntoTaskId: payload.mergeIntoTaskId || null,
            stage: payload.stage || '',
            triggerSource: payload.triggerSource || '',
            triggeredBy: payload.triggeredBy || '',
          })}`
        );

        if (job.name === 'ai_listing.generate') {
          await this.pushJobProgress(job, {
            stage: 'ai_listing.generate',
            percent: 20,
            taskId: payload.taskId,
          });
          await this.withTimeout(
            taskService.runAIListingGenerator(
              payload.taskId,
              async (message: string, extra?: Record<string, any>) => {
                await this.pushJobLog(
                  job,
                  `[stage] ${message}${
                    extra ? ` extra=${JSON.stringify(extra)}` : ''
                  }`
                );
              }
            ),
            timeoutMs
          );
          const elapsedMs = Date.now() - startedAt;
          await this.pushJobProgress(job, {
            stage: 'ai_listing.generate_done',
            percent: 100,
            elapsedMs,
          });
          await this.pushJobLog(
            job,
            `[finish] ai listing generator succeeded elapsedMs=${elapsedMs}`
          );
          return;
        }
        throw new Error(`未知任务类型: ${job.name}`);
      },
      {
        connection: this.getConnection(),
        concurrency,
      }
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        '[aiListingTaskJob:%s] failed: %s',
        job?.id,
        err?.message || String(err)
      );
      this.pushJobProgress(job, {
        stage: 'failed',
        percent: 100,
        error: err?.message || String(err),
      });
      this.pushJobLog(
        job,
        `[finish] failed error=${err?.message || String(err)}`
      );
    });
    this.started = true;
    this.logger.info(
      '[aiListingTaskScheduler] started queue=%s concurrency=%s',
      this.getQueueName(),
      concurrency
    );
  }

  async enqueueAIListingGenerator(
    payload: JobPayload,
    options?: { delayMs?: number; jobId?: string }
  ): Promise<string> {
    return this.enqueue('ai_listing.generate', payload, options);
  }

  // Backward-compatible wrappers for in-progress refactor.
  async enqueueKeywordScoring(payload: JobPayload): Promise<string> {
    return this.enqueueAIListingGenerator(payload);
  }

  async enqueueLangGraph(payload: JobPayload): Promise<string> {
    return this.enqueueAIListingGenerator(payload);
  }

  async enqueuePersist(payload: JobPayload): Promise<string> {
    return this.enqueueAIListingGenerator(payload);
  }

  private async enqueue(
    jobType: AiListingQueueJobType,
    payload: JobPayload,
    options?: { delayMs?: number; jobId?: string }
  ): Promise<string> {
    if (!this.isEnabled())
      throw new Error('aiListingTaskQueue 未启用，无法派发任务');
    if (!this.queue) await this.onServerReady();
    if (!this.queue) throw new Error('AI Listing 任务队列未初始化');
    const delayMs = Math.max(0, Math.floor(Number(options?.delayMs ?? 0)));
    const jobId =
      options?.jobId ?? `${jobType}:${payload.taskId}:${Date.now()}`;
    const job = await this.queue.add(
      jobType,
      { payload },
      {
        jobId,
        ...(delayMs > 0 ? { delay: delayMs } : {}),
      }
    );
    return String(job.id || '');
  }
}
