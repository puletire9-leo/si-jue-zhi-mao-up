import { Inject, Provide } from '@midwayjs/decorator';
import { ILogger } from '@midwayjs/logger';
import { Logger } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { AiChatSessionEntity } from '../entity/ai_chat_session';
import { AiChatMessageEntity } from '../entity/ai_chat_message';
import {
  AiCopyChatProviderService,
  AiCopyMessage,
  AiCopyProvider,
} from './ai_copy_chat_provider';

interface MentionResolved {
  key: string;
  value: string;
}

@Provide()
export class AiCopyChatService {
  @InjectEntityModel(AiChatSessionEntity)
  sessionRepo: Repository<AiChatSessionEntity>;

  @InjectEntityModel(AiChatMessageEntity)
  messageRepo: Repository<AiChatMessageEntity>;

  @Inject()
  providerService: AiCopyChatProviderService;

  @Logger()
  logger: ILogger;

  private normalizeProvider(v?: string): AiCopyProvider {
    if (v === 'qwen' || v === 'doubao') return v;
    return 'openai';
  }

  private async touchSession(sessionId: number) {
    await this.sessionRepo.update(sessionId, { last_message_at: new Date() });
  }

  private normalizeTaskKey(v?: string): string {
    const key = String(v || '').trim();
    if (!key) throw new Error('taskKey 不能为空');
    return key.slice(0, 64);
  }

  async getOrCreateSession(params: {
    taskId?: number | null;
    taskKey: string;
    module?: string;
    userId: string;
    modelProvider?: string;
    modelName?: string;
  }) {
    const taskKey = this.normalizeTaskKey(params.taskKey);
    const module = String(params.module || 'listing_ai_copy').trim() || 'listing_ai_copy';
    const userId = String(params.userId || '').trim();
    if (!userId) throw new Error('用户未登录');
    const provider = this.normalizeProvider(params.modelProvider || this.providerService.getDefaultProvider());
    const modelName = String(params.modelName || this.providerService.getDefaultModel(provider)).trim();
    const taskId = Number(params.taskId);
    const taskIdValue = Number.isFinite(taskId) && taskId > 0 ? taskId : null;

    let row = await this.sessionRepo.findOne({
      where: {
        task_key: taskKey,
        module,
        created_by: userId,
      },
    });

    if (!row) {
      row = await this.sessionRepo.save(this.sessionRepo.create({
        task_id: taskIdValue,
        task_key: taskKey,
        module,
        title: `AI 文案会话 ${taskKey}`,
        model_provider: provider,
        model_name: modelName,
        created_by: userId,
        last_message_at: null,
      }));
    } else {
      const patch: Partial<AiChatSessionEntity> = {};
      if (taskIdValue && !row.task_id) patch.task_id = taskIdValue;
      if (row.model_provider !== provider) patch.model_provider = provider;
      if (modelName && row.model_name !== modelName) patch.model_name = modelName;
      if (Object.keys(patch).length > 0) {
        await this.sessionRepo.update(row.id, patch);
        row = await this.sessionRepo.findOne({ where: { id: row.id } });
      }
    }

    return row!;
  }

  async listMessages(sessionId: number, limit = 100) {
    const id = Number(sessionId);
    if (!id) throw new Error('sessionId 无效');
    const size = Math.max(1, Math.min(200, Number(limit) || 100));
    return this.messageRepo.find({
      where: { session_id: id },
      order: { id: 'ASC' },
      take: size,
    });
  }

  async getSessionById(sessionId: number, userId?: string) {
    const id = Number(sessionId);
    if (!id) throw new Error('sessionId 无效');
    const where: any = { id };
    if (userId) where.created_by = String(userId);
    const row = await this.sessionRepo.findOne({ where });
    if (!row) throw new Error('会话不存在');
    return row;
  }

  async clearSession(sessionId: number) {
    const id = Number(sessionId);
    if (!id) throw new Error('sessionId 无效');
    await this.messageRepo.delete({ session_id: id });
    await this.sessionRepo.update(id, { last_message_at: null });
  }

  private parseMentions(input: string, referenceLibrary?: Record<string, string>): {
    content: string;
    resolved: MentionResolved[];
    missed: string[];
  } {
    const text = String(input || '');
    const lib = referenceLibrary || {};
    const keys = Array.from(
      new Set((text.match(/@([a-zA-Z0-9_.-]+)/g) || []).map(v => v.slice(1)))
    );
    const resolved: MentionResolved[] = [];
    const missed: string[] = [];
    for (const k of keys) {
      const value = String(lib[k] || '').trim();
      const maxLen = k.startsWith('keywords_') ? 100000 : 3000;
      if (value) resolved.push({ key: k, value: value.slice(0, maxLen) });
      else missed.push(k);
    }
    return { content: text, resolved, missed };
  }

  private async buildModelMessages(params: {
    session: AiChatSessionEntity;
    userInput: string;
    mentionResolved: MentionResolved[];
    mentionMissed: string[];
  }): Promise<AiCopyMessage[]> {
    const historyLimit = this.providerService.getDefaultHistoryLimit();
    const recent = await this.messageRepo.find({
      where: { session_id: params.session.id, status: 'done' },
      order: { id: 'DESC' },
      take: historyLimit,
    });
    recent.reverse();

    const messages: AiCopyMessage[] = [];
    const mentionLines =
      params.mentionResolved.length > 0
        ? params.mentionResolved.map(m => `- @${m.key}: ${m.value}`).join('\n')
        : '';
    const missedLine =
      params.mentionMissed.length > 0
        ? `以下引用未命中：${params.mentionMissed.map(k => `@${k}`).join(', ')}`
        : '';
    // TODO 未来这个System Prompt 我们要重新考虑一下
    const systemPrompt = [
      '你是电商 Listing 文案编辑助手。',
      '目标：帮助用户在标题、卖点、描述上做可执行修改。',
      '规则：',
      '1) 先给可直接替换的文本，再给极简理由；',
      '2) 不要输出无关说明；',
      '3) 如果用户用了 @引用，优先基于引用内容改写；',
      missedLine ? `4) ${missedLine}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    messages.push({ role: 'system', content: systemPrompt });

    if (mentionLines) {
      messages.push({
        role: 'system',
        content: `当前引用上下文：\n${mentionLines}`,
      });
    }

    for (const row of recent) {
      if (row.role !== 'user' && row.role !== 'assistant') continue;
      messages.push({
        role: row.role as 'user' | 'assistant',
        content: row.content || '',
      });
    }

    messages.push({ role: 'user', content: params.userInput });
    return messages;
  }

  async *streamReply(params: {
    session: AiChatSessionEntity;
    userInput: string;
    referenceLibrary?: Record<string, string>;
    provider?: string;
    model?: string;
    traceId?: string;
  }) {
    const traceId = params.traceId || `trace_${Date.now()}`;
    const mention = this.parseMentions(params.userInput, params.referenceLibrary);
    const extraJson = {
      mentions: mention.resolved,
      missedMentions: mention.missed,
    };

    const userRow = await this.messageRepo.save(this.messageRepo.create({
      session_id: params.session.id,
      task_id: params.session.task_id,
      task_key: params.session.task_key,
      role: 'user',
      content: mention.content,
      status: 'done',
      token_usage: null,
      reply_to: null,
      extra_json: extraJson,
    }));
    await this.touchSession(params.session.id);

    const assistantRow = await this.messageRepo.save(this.messageRepo.create({
      session_id: params.session.id,
      task_id: params.session.task_id,
      task_key: params.session.task_key,
      role: 'assistant',
      content: '',
      status: 'streaming',
      token_usage: null,
      reply_to: userRow.id,
      extra_json: extraJson,
    }));

    const provider = this.normalizeProvider(params.provider || params.session.model_provider);
    const model = String(
      params.model || params.session.model_name || this.providerService.getDefaultModel(provider)
    ).trim();

    const modelMessages = await this.buildModelMessages({
      session: params.session,
      userInput: mention.content,
      mentionResolved: mention.resolved,
      mentionMissed: mention.missed,
    });

    let full = '';
    let thinkingFull = '';
    let thinkingStarted = false;
    let answerStarted = false;
    try {
      for await (const chunk of this.providerService.streamText({
        provider,
        model,
        messages: modelMessages,
      })) {
        if (chunk.phase === 'thinking') {
          thinkingFull += chunk.content;
          if (!thinkingStarted) {
            thinkingStarted = true;
            yield { event: 'thinking_start', data: {} };
          }
          yield {
            event: 'thinking_delta',
            data: { content: chunk.content },
          };
        } else {
          full += chunk.content;
          if (!answerStarted) {
            answerStarted = true;
            yield { event: 'answer_start', data: {} };
          }
          yield {
            event: 'delta',
            data: {
              content: chunk.content,
            },
          };
        }
      }

      const doneExtra: Record<string, any> = {
        ...(extraJson || {}),
        thinking: thinkingFull || null,
      };
      await this.messageRepo.update(assistantRow.id, {
        content: full,
        status: 'done',
        extra_json: doneExtra,
      });
      await this.touchSession(params.session.id);
      yield {
        event: 'done',
        data: {
          messageId: assistantRow.id,
          content: full,
          missedMentions: mention.missed,
        },
      };
    } catch (err: any) {
      const msg = String(err?.message || err || 'AI 生成失败').slice(0, 1000);
      this.logger.error(
        '[AI_CHAT_STREAM_ERR] traceId=%s ts=%s msg=%s',
        traceId,
        new Date().toISOString(),
        msg
      );
      const errorExtra: Record<string, any> = {
        ...(extraJson || {}),
        error: msg,
      };
      await this.messageRepo.update(assistantRow.id, {
        content: full || `[error] ${msg}`,
        status: 'error',
        extra_json: errorExtra,
      });
      yield {
        event: 'error',
        data: {
          message: msg,
        },
      };
    }
  }
}

