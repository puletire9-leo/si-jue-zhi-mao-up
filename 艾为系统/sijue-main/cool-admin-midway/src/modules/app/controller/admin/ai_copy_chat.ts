import { BaseController, CoolController } from '@cool-midway/core';
import { Body, Get, Inject, Post, Query } from '@midwayjs/decorator';
import { Context } from '@midwayjs/koa';
import { AiCopyChatService } from '../../service/ai_copy_chat';
import { AiCopyChatProviderService } from '../../service/ai_copy_chat_provider';

@CoolController('/admin/app/designTask/chat')
export class AdminAiCopyChatController extends BaseController {
  @Inject()
  chatService: AiCopyChatService;

  @Inject()
  providerService: AiCopyChatProviderService;

  @Inject()
  ctx: Context;

  private userId(): string {
    const uid = this.ctx?.admin?.userId;
    if (uid == null) return '';
    return String(uid);
  }

  @Post('/session/getOrCreate')
  async getOrCreateSession(
    @Body()
    body: {
      taskId?: number;
      taskKey?: string;
      module?: string;
      modelProvider?: string;
      modelName?: string;
    }
  ) {
    const userId = this.userId();
    if (!userId) return this.fail('未登录');
    try {
      const session = await this.chatService.getOrCreateSession({
        taskId: body?.taskId,
        taskKey: body?.taskKey || '',
        module: body?.module || 'listing_ai_copy',
        userId,
        modelProvider: body?.modelProvider,
        modelName: body?.modelName,
      });
      return this.ok({
        session,
        defaults: {
          provider: this.providerService.getDefaultProvider(),
        },
      });
    } catch (err: any) {
      return this.fail(err?.message || '创建会话失败');
    }
  }

  @Get('/session/messages')
  async messages(@Query('sessionId') sessionId: number, @Query('limit') limit?: number) {
    try {
      const list = await this.chatService.listMessages(sessionId, Number(limit) || 100);
      return this.ok({ list });
    } catch (err: any) {
      return this.fail(err?.message || '获取会话历史失败');
    }
  }

  @Post('/session/clear')
  async clear(@Body('sessionId') sessionId: number) {
    try {
      await this.chatService.clearSession(sessionId);
      return this.ok({ success: true });
    } catch (err: any) {
      return this.fail(err?.message || '清理会话失败');
    }
  }

  @Post('/stream')
  async stream(
    @Body()
    body: {
      sessionId?: number;
      taskId?: number;
      taskKey?: string;
      module?: string;
      input?: string;
      modelProvider?: string;
      modelName?: string;
      referenceLibrary?: Record<string, string>;
    }
  ) {
    const uid = this.userId();
    if (!uid) {
      this.ctx.status = 401;
      this.ctx.body = { code: 401, message: '未登录' };
      return;
    }
    const input = String(body?.input || '').trim();
    if (!input) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: 'input 不能为空' };
      return;
    }

    let sessionId = Number(body?.sessionId);
    const traceId = `chat_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    let session;
    if (!sessionId) {
      session = await this.chatService.getOrCreateSession({
        taskId: body?.taskId,
        taskKey: body?.taskKey || '',
        module: body?.module || 'listing_ai_copy',
        userId: uid,
        modelProvider: body?.modelProvider,
        modelName: body?.modelName,
      });
      sessionId = session.id;
    } else {
      session = await this.chatService.getSessionById(sessionId, uid);
    }

    this.ctx.set('Content-Type', 'text/event-stream; charset=utf-8');
    this.ctx.set('Cache-Control', 'no-cache, no-transform');
    this.ctx.set('Connection', 'keep-alive');
    this.ctx.set('X-Accel-Buffering', 'no');
    this.ctx.status = 200;
    this.ctx.respond = false;
    // 尽量避免中间层压缩/缓冲导致“伪流式”
    (this.ctx as any).compress = false;

    const res = this.ctx.res;
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }
    const writeEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    };

    // 先发一条注释行，尽快建立 SSE 流通道
    res.write(': stream-init\n\n');
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
    writeEvent('start', { sessionId, traceId });

    try {
      for await (const packet of this.chatService.streamReply({
        session,
        userInput: input,
        referenceLibrary: body?.referenceLibrary || {},
        provider: body?.modelProvider,
        model: body?.modelName,
        traceId,
      })) {
        writeEvent(packet.event, packet.data);
      }
    } catch (err: any) {
      writeEvent('error', { message: err?.message || 'stream 失败' });
    } finally {
      res.end();
    }
  }
}

