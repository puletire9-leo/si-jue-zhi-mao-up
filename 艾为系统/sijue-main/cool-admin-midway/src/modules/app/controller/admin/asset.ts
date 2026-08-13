import {
  BaseController,
  CoolController,
  CoolTag,
  TagTypes,
} from '@cool-midway/core';
import { Body, Get, Inject, Post, Query } from '@midwayjs/decorator';
import { Context } from '@midwayjs/koa';
import { AssetService } from '../../service/asset';

/**
 * 素材库（dufs）HTTP 接口。
 *
 * - POST /list      列目录（admin 鉴权）
 * - POST /sign      生成签名 URL（admin 鉴权）
 * - GET  /file      转发文件流（HMAC 签名鉴权，<img src> 直连用）
 * - POST /checkPath 校验路径是否存在（admin 鉴权）
 */
@CoolController({})
export class AdminAppAssetController extends BaseController {
  @Inject()
  assetService: AssetService;

  // BaseController 只有 baseCtx，没有 ctx，需要自己注入
  @Inject()
  ctx: Context;

  @Post('/list')
  async listDirectory(@Body() body: { prefix?: string }) {
    try {
      const r = await this.assetService.listDirectory(body?.prefix || '');
      return this.ok(r);
    } catch (e: any) {
      return this.fail(e?.message || '素材库列目录失败');
    }
  }

  @Post('/sign')
  async sign(
    @Body()
    body: {
      key: string;
      filename?: string;
      inline?: boolean;
      expiresIn?: number;
      width?: number;
    }
  ) {
    try {
      const url = this.assetService.signUrl(body?.key || '', {
        filename: body?.filename,
        inline: body?.inline,
        expiresIn: body?.expiresIn,
        width: body?.width,
      });
      return this.ok({ url });
    } catch (e: any) {
      return this.fail(e?.message || '签名失败');
    }
  }

  @Post('/checkPath')
  async checkPath(@Body('path') path: string) {
    try {
      const r = await this.assetService.checkPath(path || '');
      return this.ok(r);
    } catch (e: any) {
      return this.fail(e?.message || '校验路径失败');
    }
  }

  /**
   * 签名 URL 直接访问的文件流端点。
   * 走 IGNORE_TOKEN：不需要 admin JWT，仅靠 HMAC token 鉴权，方便 <img src> / window.open 直连。
   */
  @CoolTag(TagTypes.IGNORE_TOKEN)
  @Get('/file')
  async file(
    @Query('key') key: string,
    @Query('exp') exp: string,
    @Query('filename') filename: string,
    @Query('inline') inline: string,
    @Query('w') w: string,
    @Query('token') token: string
  ) {
    const ok = this.assetService.verifyToken({
      key,
      exp,
      filename,
      inline,
      w,
      token,
    });
    if (!ok) {
      this.ctx.status = 403;
      this.ctx.body = { code: 403, message: '签名无效或已过期' };
      return;
    }
    await this.assetService.streamFile(this.ctx, key, {
      filename: filename || undefined,
      inline: inline === '1',
      width: Number(w || 0),
    });
  }
}
