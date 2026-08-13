import { Config, Logger, Provide } from '@midwayjs/decorator';
import { ILogger } from '@midwayjs/logger';
import OpenAI from 'openai';

export type AiCopyProvider = 'openai' | 'qwen' | 'doubao';
export type AiCopyRole = 'system' | 'user' | 'assistant';

export interface AiCopyMessage {
  role: AiCopyRole;
  content: string;
}

export interface AiCopyStreamChunk {
  phase: 'thinking' | 'answer';
  content: string;
}

interface ProviderRuntimeConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

@Provide()
export class AiCopyChatProviderService {
  @Config('aiCopyChat')
  aiCopyChatConfig: any;

  @Logger()
  logger: ILogger;

  private clientMap = new Map<string, OpenAI>();

  private providerConfig(provider: AiCopyProvider): ProviderRuntimeConfig {
    const cfg = this.aiCopyChatConfig || {};
    const node = cfg?.providers?.[provider] || {};
    const apiKey = String(node.apiKey || '').trim();
    const baseURL = String(node.baseURL || '').trim();
    const model = String(node.model || '').trim();
    if (!apiKey) {
      throw new Error(`AI 对话 provider=${provider} 未配置 apiKey`);
    }
    if (!model) {
      throw new Error(`AI 对话 provider=${provider} 未配置 model`);
    }
    return {
      apiKey,
      baseURL: baseURL || undefined,
      model,
    };
  }

  getDefaultProvider(): AiCopyProvider {
    const provider = String(
      this.aiCopyChatConfig?.defaults?.provider || 'openai'
    ).trim();
    if (provider === 'qwen' || provider === 'doubao') return provider;
    return 'openai';
  }

  getDefaultHistoryLimit(): number {
    const n = Number(this.aiCopyChatConfig?.defaults?.historyLimit ?? 20);
    if (!Number.isFinite(n)) return 20;
    return Math.max(2, Math.min(60, Math.floor(n)));
  }

  getDefaultModel(provider?: AiCopyProvider): string {
    const p = provider || this.getDefaultProvider();
    return this.providerConfig(p).model;
  }

  private getClient(provider: AiCopyProvider): {
    client: OpenAI;
    model: string;
  } {
    const conf = this.providerConfig(provider);
    const key = `${provider}:${conf.baseURL || ''}:${conf.apiKey.slice(0, 12)}`;
    let client = this.clientMap.get(key);
    if (!client) {
      client = new OpenAI({
        apiKey: conf.apiKey,
        baseURL: conf.baseURL,
      });
      this.clientMap.set(key, client);
    }
    return { client, model: conf.model };
  }

  async *streamText(params: {
    provider: AiCopyProvider;
    model?: string;
    messages: AiCopyMessage[];
  }): AsyncGenerator<AiCopyStreamChunk, void, unknown> {
    const provider = params.provider;
    const { client, model: defaultModel } = this.getClient(provider);
    const model = (params.model || defaultModel || '').trim();
    if (!model) throw new Error('未指定模型');

    const stream = await client.chat.completions.create({
      model,
      messages: params.messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta: any = chunk.choices?.[0]?.delta || {};
      const thinking =
        delta.reasoning_content ||
        delta.reasoning ||
        (Array.isArray(delta.reasoning_details)
          ? delta.reasoning_details
              .map((x: any) => String(x?.text || ''))
              .join('')
          : '');
      const answer = delta.content || '';
      if (thinking) {
        yield { phase: 'thinking', content: String(thinking) };
      }
      if (answer) {
        yield { phase: 'answer', content: String(answer) };
      }
    }
  }
}
