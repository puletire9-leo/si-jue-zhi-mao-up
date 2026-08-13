import {
  App,
  Config,
  Inject,
  Logger,
  Provide,
  Scope,
  ScopeEnum,
} from '@midwayjs/decorator';
import { ILogger } from '@midwayjs/logger';
import { Queue, Worker, JobsOptions } from 'bullmq';
import { IMidwayApplication } from '@midwayjs/core';
import Koa = require('koa');
import { KoaAdapter } from '@bull-board/koa';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

type DesignQueueJobType = 'aiGenerateRequirement' | 'enrichCompetitorImages';

type JobPayloadMap = {
  aiGenerateRequirement: { taskId: number; mode?: 'all' | 'delta' };
  enrichCompetitorImages: { candidateId?: number; taskId?: number };
};

@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class DesignJobSchedulerService {
  @App()
  app: IMidwayApplication;

  @Logger()
  logger: ILogger;

  @Config('cool')
  coolConfig: any;

  @Config('designJobQueue')
  queueConfig: {
    enabled?: boolean;
    queueName?: string;
    boardBasePath?: string;
    boardHost?: string;
    boardPort?: number;
    boardReadonly?: boolean;
    boardAuthEnabled?: boolean;
    boardAuthUser?: string;
    boardAuthPass?: string;
    concurrency?: number;
    defaultAttempts?: number;
    defaultTimeoutMs?: number;
    keepCompletedSeconds?: number;
    keepFailedSeconds?: number;
  };

  @Config('aiListingTaskQueue')
  aiListingQueueConfig: {
    enabled?: boolean;
    queueName?: string;
  };

  private queue: Queue | null = null;
  private aiListingQueueForBoard: Queue | null = null;
  private worker: Worker | null = null;
  private serverAdapter: KoaAdapter | null = null;
  private boardApp: Koa | null = null;
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
    return this.queueConfig?.queueName || 'design-job-queue';
  }

  private getAiListingQueueName() {
    return this.aiListingQueueConfig?.queueName || 'ai-listing-task-queue';
  }

  private isAiListingQueueEnabled() {
    return !!this.aiListingQueueConfig?.enabled;
  }

  private getBoardBasePath() {
    return this.queueConfig?.boardBasePath || '/ops/queue';
  }

  private getBoardHost() {
    return this.queueConfig?.boardHost || '127.0.0.1';
  }

  private getBoardPort() {
    return Number(this.queueConfig?.boardPort || 8011);
  }

  private isBoardAuthEnabled() {
    return !!this.queueConfig?.boardAuthEnabled;
  }

  private checkBasicAuthHeader(authHeader: string | undefined): boolean {
    if (!this.isBoardAuthEnabled()) return true;
    const expectedUser = String(this.queueConfig?.boardAuthUser || '').trim();
    const expectedPass = String(this.queueConfig?.boardAuthPass || '').trim();
    if (!expectedUser || !expectedPass) return false;
    if (!authHeader || !authHeader.startsWith('Basic ')) return false;
    try {
      const token = authHeader.slice('Basic '.length);
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      if (idx < 0) return false;
      const user = decoded.slice(0, idx);
      const pass = decoded.slice(idx + 1);
      return user === expectedUser && pass === expectedPass;
    } catch {
      return false;
    }
  }

  private getDefaultJobOptions(): JobsOptions {
    const attempts = Math.max(
      1,
      Number(this.queueConfig?.defaultAttempts || 2)
    );
    return {
      attempts,
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
      timer = setTimeout(() => {
        reject(new Error(`任务执行超时(${timeoutMs}ms)`));
      }, timeoutMs);
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
        '[designJob:%s] write job.log failed: %s',
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
        '[designJob:%s] update progress failed: %s',
        job?.id,
        (e as any)?.message || String(e)
      );
    }
  }

  async onServerReady() {
    if (!this.isEnabled() || this.started) return;
    const connection = this.getConnection();
    const queueName = this.getQueueName();
    const concurrency = Math.max(1, Number(this.queueConfig?.concurrency || 2));
    this.queue = new Queue(queueName, {
      connection,
      defaultJobOptions: this.getDefaultJobOptions(),
    });
    this.serverAdapter = new KoaAdapter();
    this.serverAdapter.setBasePath(this.getBoardBasePath());
    const boardQueues: BullMQAdapter[] = [
      new BullMQAdapter(this.queue, {
        readOnlyMode: this.queueConfig?.boardReadonly !== false,
      }),
    ];
    if (this.isAiListingQueueEnabled()) {
      this.aiListingQueueForBoard = new Queue(this.getAiListingQueueName(), {
        connection,
      });
      boardQueues.push(
        new BullMQAdapter(this.aiListingQueueForBoard, {
          readOnlyMode: true,
        })
      );
    }
    createBullBoard({
      queues: boardQueues,
      serverAdapter: this.serverAdapter,
    });
    this.worker = new Worker(
      queueName,
      async job => {
        const payload = (job.data || {}).payload || {};
        const designTaskService: any = await this.app
          .getApplicationContext()
          .getAsync('designTaskService');
        const timeoutMs = Math.max(
          30_000,
          Number(this.queueConfig?.defaultTimeoutMs || 10 * 60_000)
        );
        const startedAt = Date.now();
        await this.pushJobProgress(job, {
          stage: 'running',
          percent: 5,
          startedAt,
        });
        await this.pushJobLog(
          job,
          `[start] jobName=${job.name} timeoutMs=${timeoutMs}`
        );
        try {
          if (job.name === 'aiGenerateRequirement') {
            await this.pushJobProgress(job, {
              stage: 'ai_generate',
              percent: 20,
            });
            await this.withTimeout(
              designTaskService.aiGenerate(payload, {
                log: async (level, step, message, context) => {
                  const line = `[${level}] step=${step} msg=${message} ctx=${JSON.stringify(
                    context || {}
                  )}`;
                  this.logger.info('[designJob:%s] %s', job.id, line);
                  await this.pushJobLog(job, line);
                },
              }),
              timeoutMs
            );
          } else if (job.name === 'enrichCompetitorImages') {
            await this.pushJobProgress(job, {
              stage: 'enrich_competitors',
              percent: 20,
            });
            await this.withTimeout(
              designTaskService.enrichCompetitorImages(payload, {
                log: async (level, step, message, context) => {
                  const line = `[${level}] step=${step} msg=${message} ctx=${JSON.stringify(
                    context || {}
                  )}`;
                  this.logger.info('[designJob:%s] %s', job.id, line);
                  await this.pushJobLog(job, line);
                },
              }),
              timeoutMs
            );
          } else {
            throw new Error(`未知任务类型: ${job.name}`);
          }
          const elapsedMs = Date.now() - startedAt;
          await this.pushJobProgress(job, {
            stage: 'completed',
            percent: 100,
            elapsedMs,
          });
          await this.pushJobLog(
            job,
            `[finish] succeeded elapsedMs=${elapsedMs}`
          );
        } catch (e: any) {
          const message = e?.message || String(e);
          if (job.name === 'aiGenerateRequirement' && payload?.taskId) {
            try {
              await designTaskService.notifyDesignRequirementAiFailed(
                Number(payload.taskId),
                message
              );
            } catch (notifyErr: any) {
              this.logger.error(
                '[designJob] notifyDesignRequirementAiFailed error:',
                notifyErr?.message || notifyErr
              );
            }
          }
          await this.pushJobProgress(job, {
            stage: 'failed',
            percent: 100,
            error: message,
          });
          await this.pushJobLog(job, `[finish] failed error=${message}`);
          throw e;
        }
      },
      {
        connection,
        concurrency,
      }
    );

    this.worker.on('failed', async (job, err) => {
      this.logger.error(
        '[designJob:%s] failed: %s',
        job?.id,
        err?.message || String(err)
      );
      await this.pushJobLog(
        job,
        `[worker_failed] ${err?.message || String(err)}`
      );
    });

    const koaApp = new Koa();
    const boardBasePath = this.getBoardBasePath();
    koaApp.use(async (ctx, next) => {
      if (!ctx.path.startsWith(boardBasePath)) {
        return await next();
      }
      if (!this.checkBasicAuthHeader(ctx.get('authorization'))) {
        ctx.set('WWW-Authenticate', 'Basic realm="Bull Board"');
        ctx.status = 401;
        ctx.body = 'Unauthorized';
        return;
      }
      await next();
    });
    if (this.serverAdapter) {
      koaApp.use(this.serverAdapter.registerPlugin());
    }
    const host = this.getBoardHost();
    const port = this.getBoardPort();
    koaApp.listen(port, host);
    this.boardApp = koaApp;
    this.started = true;
    this.logger.info(
      '[designJobScheduler] started queue=%s aiQueue=%s concurrency=%s board=http://%s:%s%s',
      queueName,
      this.isAiListingQueueEnabled()
        ? this.getAiListingQueueName()
        : 'disabled',
      concurrency,
      host,
      port,
      boardBasePath
    );
  }

  async enqueueAiGenerate(payload: JobPayloadMap['aiGenerateRequirement']) {
    return this.enqueue('aiGenerateRequirement', payload);
  }

  async enqueueEnrichCompetitorImages(
    payload: JobPayloadMap['enrichCompetitorImages']
  ) {
    return this.enqueue('enrichCompetitorImages', payload);
  }

  private async enqueue<T extends DesignQueueJobType>(
    jobType: T,
    payload: JobPayloadMap[T]
  ) {
    if (!this.isEnabled()) {
      throw new Error('designJobQueue 未启用，无法派发任务');
    }
    if (!this.queue) {
      await this.onServerReady();
    }
    if (!this.queue) {
      throw new Error('任务队列未初始化');
    }
    const job = await this.queue.add(
      jobType,
      {
        payload,
      },
      {
        jobId: `${jobType}:${Date.now()}:${Math.floor(Math.random() * 10_000)}`,
      }
    );
    return String(job.id || '');
  }
}
