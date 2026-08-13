import { Config, Logger, Provide } from '@midwayjs/decorator';
import { ILogger } from '@midwayjs/logger';
import axios, { AxiosInstance } from 'axios';

type GoKeywordTaskStatus = 'queued' | 'running' | 'finished' | 'failed';

export interface GoKeywordSubmitPayload {
  target_key: string;
  marketplace: string;
  reference_titles: string[];
  keywords: Array<{ value: string; traffic_score?: number }>;
  options?: Record<string, any>;
}

@Provide()
export class KeywordResearchGoClientService {
  @Logger()
  logger: ILogger;

  @Config('keywordResearchGo')
  cfg: {
    baseUrl?: string;
    timeoutMs?: number;
    pollIntervalMs?: number;
  };

  private getClient(): AxiosInstance {
    const baseURL = (this.cfg?.baseUrl || '').trim();
    if (!baseURL) {
      throw new Error('keywordResearchGo.baseUrl 未配置');
    }
    return axios.create({
      baseURL,
      timeout: Math.max(3_000, Number(this.cfg?.timeoutMs || 30_000)),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async submitTask(
    payload: GoKeywordSubmitPayload
  ): Promise<{ taskId: string }> {
    const client = this.getClient();
    const { data } = await client.post('/v1/tasks/keyword-research', payload);
    const taskId = data?.task_id || data?.taskId || '';
    if (!taskId) {
      throw new Error('Go评分服务未返回 task_id');
    }
    return { taskId: String(taskId) };
  }

  async getTask(taskId: string): Promise<{
    taskId: string;
    status: GoKeywordTaskStatus;
    errorMessage?: string;
    raw: any;
  }> {
    const client = this.getClient();
    const { data } = await client.get(
      `/v1/tasks/${encodeURIComponent(taskId)}`
    );
    const task = data?.task || data || {};
    return {
      taskId: String(task?.task_id || taskId),
      status: String(task?.status || 'queued') as GoKeywordTaskStatus,
      errorMessage: task?.error_message || task?.errorMessage || undefined,
      raw: data,
    };
  }

  async getTaskResult(taskId: string): Promise<any> {
    const client = this.getClient();
    const encoded = encodeURIComponent(taskId);
    try {
      const { data } = await client.get(`/v1/tasks/${encoded}/results`);
      return data;
    } catch (err: any) {
      // Backward-compatible fallback for older Go service versions.
      if (Number(err?.response?.status || 0) !== 404) throw err;
      const { data } = await client.get(`/v1/tasks/${encoded}/result`);
      return data;
    }
  }
}
