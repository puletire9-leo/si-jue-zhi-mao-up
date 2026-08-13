import {
  Provide,
  Config,
  Init,
  Scope,
  ScopeEnum,
} from '@midwayjs/decorator';
import { Context } from '@midwayjs/koa';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import sharp = require('sharp');

export interface AssetConfig {
  /** 后端容器内调用的内网 HTTP 文件服务器地址，如 http://host.docker.internal:9000 */
  internalBase: string;
  /** dufs basic auth 用户名 */
  username: string;
  /** dufs basic auth 密码 */
  password: string;
  /** 给浏览器返回的签名 URL 用的 HMAC 密钥 */
  signSecret: string;
  /** 签名 URL 过期秒数 */
  signExpireSeconds: number;
  /** 缩略图磁盘缓存目录（不配则用 os.tmpdir()/woeau-asset-cache） */
  cacheDir?: string;
}

export interface AssetListResult {
  prefix: string;
  folders: Array<{ name: string; path: string }>;
  files: Array<{
    name: string;
    key: string;
    size: number;
    lastModified: string | null;
  }>;
  truncated: false;
}

/** 缩略图允许的宽度白名单（防止任意 width 把磁盘塞爆） */
const ALLOWED_THUMB_WIDTHS = [200, 400, 800, 1280];

/**
 * dufs HTTP 文件服务器代理服务。
 *
 * - listDirectory: 调内网 dufs 列目录，归一化结果
 * - signUrl: 生成 HMAC 签名 URL，浏览器直连 midway 拉取
 * - streamFile: 把 dufs 的原图 stream 转发给浏览器（透传 Range / Content-Type 等）
 * - 缩略图：当 signUrl 传入 width>0 时，midway 端用 sharp resize 成 webp，并落磁盘缓存
 */
@Provide()
@Scope(ScopeEnum.Singleton)
export class AssetService {
  @Config('asset')
  cfg: AssetConfig;

  private client: AxiosInstance | null = null;
  private cacheDir = '';

  @Init()
  async init() {
    if (!this.cfg?.internalBase) return;
    this.client = axios.create({
      baseURL: this.cfg.internalBase.replace(/\/+$/, ''),
      auth: this.cfg.username
        ? { username: this.cfg.username, password: this.cfg.password || '' }
        : undefined,
      timeout: 60_000,
      maxRedirects: 0,
      validateStatus: () => true,
    });
    this.cacheDir =
      this.cfg.cacheDir || path.join(os.tmpdir(), 'woeau-asset-cache');
    try {
      await fsp.mkdir(this.cacheDir, { recursive: true });
    } catch {
      // ignore
    }
  }

  private ensureReady() {
    if (!this.client) {
      throw new Error(
        '素材服务未配置：请在 compose.env 设置 ASSET_INTERNAL_BASE / ASSET_USERNAME / ASSET_PASSWORD / ASSET_SIGN_SECRET'
      );
    }
  }

  /**
   * 列目录。prefix 为相对 dufs 根目录的路径（''=根，'foo/bar/'=子目录）。
   */
  async listDirectory(prefix: string): Promise<AssetListResult> {
    this.ensureReady();
    const normalized = this.normalizePrefix(prefix);
    // dufs 不认 Accept: application/json，必须用 ?json 查询参数
    const url = '/' + this.encodePath(normalized) + '?json';
    const r = await this.client!.get(url);
    if (r.status === 404) {
      return { prefix: normalized, folders: [], files: [], truncated: false };
    }
    if (r.status >= 400) {
      throw new Error(
        `dufs 列目录失败: HTTP ${r.status} ${
          typeof r.data === 'string' ? r.data.slice(0, 200) : ''
        }`
      );
    }
    const data = r.data || {};
    const paths: Array<{
      name: string;
      path_type: string;
      size?: number;
      mtime?: number;
    }> = Array.isArray(data.paths) ? data.paths : [];

    const folders: AssetListResult['folders'] = [];
    const files: AssetListResult['files'] = [];
    for (const p of paths) {
      const name = p?.name;
      if (!name) continue;
      const kind = String(p.path_type || '').toLowerCase();
      if (kind === 'dir' || kind === 'symlinkdir') {
        folders.push({ name, path: normalized + name + '/' });
      } else {
        files.push({
          name,
          key: normalized + name,
          size: Number(p.size || 0),
          lastModified: p.mtime ? new Date(p.mtime).toISOString() : null,
        });
      }
    }
    folders.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    files.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    return { prefix: normalized, folders, files, truncated: false };
  }

  /**
   * 生成签名 URL，给浏览器 <img src> / window.open 直接访问。
   * width: 0 或不传 = 原图；>0 = 缩略图宽度（必须在 ALLOWED_THUMB_WIDTHS 内）。
   */
  signUrl(
    key: string,
    options: {
      filename?: string;
      inline?: boolean;
      expiresIn?: number;
      width?: number;
    } = {}
  ): string {
    this.ensureReady();
    const cleanKey = String(key || '').replace(/^\/+/, '');
    if (!cleanKey) throw new Error('key 不能为空');
    const exp =
      Math.floor(Date.now() / 1000) +
      (options.expiresIn || this.cfg.signExpireSeconds || 3600);
    const filename = options.filename || '';
    const inline = options.inline ? '1' : '0';
    const width = this.clampWidth(options.width || 0);
    const token = this.makeToken(cleanKey, exp, filename, inline, width);
    const params: Record<string, string> = {
      key: cleanKey,
      exp: String(exp),
      filename,
      inline,
      token,
    };
    if (width > 0) params.w = String(width);
    const qs = new URLSearchParams(params).toString();
    return `/admin/app/asset/file?${qs}`;
  }

  verifyToken(params: {
    key: string;
    exp: string | number;
    filename?: string;
    inline?: string;
    w?: string | number;
    token: string;
  }): boolean {
    const exp = Number(params.exp || 0);
    if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
    const width = this.clampWidth(Number(params.w || 0));
    const expected = this.makeToken(
      params.key || '',
      exp,
      params.filename || '',
      params.inline || '0',
      width
    );
    return safeEqual(expected, params.token || '');
  }

  /**
   * 把 dufs 的文件转发给当前 ctx。
   * - width 不传/为 0：原图流式转发（透传 Range）
   * - width > 0 且文件是图片：sharp resize 成 webp，落磁盘缓存，再吐
   */
  async streamFile(
    ctx: Context,
    key: string,
    options: {
      filename?: string;
      inline?: boolean;
      width?: number;
    } = {}
  ): Promise<void> {
    this.ensureReady();
    const cleanKey = String(key || '').replace(/^\/+/, '');
    if (!cleanKey) {
      ctx.status = 400;
      ctx.body = { code: 400, message: 'key 不能为空' };
      return;
    }

    const width = this.clampWidth(options.width || 0);
    const isImg = this.isImage(cleanKey);
    if (width > 0 && isImg) {
      await this.streamThumbnail(ctx, cleanKey, width, options.inline);
      return;
    }

    // 原图直传
    await this.streamOriginal(ctx, cleanKey, options);
  }

  /** 原图流式转发 */
  private async streamOriginal(
    ctx: Context,
    cleanKey: string,
    options: { filename?: string; inline?: boolean }
  ) {
    const url = '/' + this.encodePath(cleanKey);
    const range =
      (ctx.headers && (ctx.headers['range'] as string | undefined)) || '';
    const r = await this.client!.get(url, {
      responseType: 'stream',
      headers: range ? { Range: range } : undefined,
    });
    if (r.status === 404) {
      ctx.status = 404;
      ctx.body = { code: 404, message: '文件不存在' };
      return;
    }
    if (r.status >= 400) {
      ctx.status = r.status;
      ctx.body = { code: r.status, message: 'dufs 读取失败' };
      return;
    }
    const passThrough = [
      'content-type',
      'content-length',
      'last-modified',
      'accept-ranges',
      'content-range',
      'etag',
    ];
    for (const h of passThrough) {
      const v = r.headers[h];
      if (v != null) ctx.set(h, String(v));
    }
    if (!r.headers['content-type']) {
      ctx.set('Content-Type', this.guessContentType(cleanKey));
    }
    const disposition = options.inline ? 'inline' : 'attachment';
    const fname = options.filename || cleanKey.split('/').pop() || 'file';
    ctx.set(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encodeURIComponent(fname)}`
    );
    ctx.set('Cache-Control', 'private, max-age=300');
    ctx.status = r.status;
    ctx.body = r.data;
  }

  /**
   * 缩略图：先查磁盘缓存，缓存命中直接吐文件；否则从 dufs 拉原图、sharp resize 成 webp、写缓存、吐 buffer。
   */
  private async streamThumbnail(
    ctx: Context,
    cleanKey: string,
    width: number,
    inline?: boolean
  ) {
    const cachePath = this.thumbCachePath(cleanKey, width);
    // 命中缓存
    try {
      const stat = await fsp.stat(cachePath);
      if (stat.isFile() && stat.size > 0) {
        ctx.set('Content-Type', 'image/webp');
        ctx.set('Content-Length', String(stat.size));
        ctx.set('X-Asset-Thumb-Cache', 'HIT');
        this.setThumbHeaders(ctx, cleanKey, inline);
        ctx.status = 200;
        ctx.body = fs.createReadStream(cachePath);
        return;
      }
    } catch {
      // miss
    }

    // 拉原图
    const url = '/' + this.encodePath(cleanKey);
    const r = await this.client!.get(url, { responseType: 'arraybuffer' });
    if (r.status === 404) {
      ctx.status = 404;
      ctx.body = { code: 404, message: '文件不存在' };
      return;
    }
    if (r.status >= 400) {
      ctx.status = r.status;
      ctx.body = { code: r.status, message: 'dufs 读取失败' };
      return;
    }
    const src = Buffer.from(r.data);

    // sharp resize -> webp
    let out: Buffer;
    try {
      out = await sharp(src, { failOn: 'none' })
        .rotate()
        .resize({
          width,
          withoutEnlargement: true,
          fit: 'inside',
        })
        .webp({ quality: 75 })
        .toBuffer();
    } catch (e: any) {
      // sharp 失败（比如不支持的格式），降级为原图
      ctx.set('Content-Type', this.guessContentType(cleanKey));
      ctx.set('X-Asset-Thumb-Cache', 'ERROR');
      this.setThumbHeaders(ctx, cleanKey, inline);
      ctx.body = src;
      return;
    }

    // 写缓存（不阻塞响应）
    (async () => {
      try {
        await fsp.mkdir(path.dirname(cachePath), { recursive: true });
        await fsp.writeFile(cachePath, out);
      } catch {
        // 缓存写失败不影响响应
      }
    })();

    ctx.set('Content-Type', 'image/webp');
    ctx.set('Content-Length', String(out.length));
    ctx.set('X-Asset-Thumb-Cache', 'MISS');
    this.setThumbHeaders(ctx, cleanKey, inline);
    ctx.status = 200;
    ctx.body = out;
  }

  private setThumbHeaders(ctx: Context, cleanKey: string, inline?: boolean) {
    const disposition = inline ? 'inline' : 'attachment';
    const baseName = cleanKey.split('/').pop() || 'thumb';
    const fname = baseName.replace(/\.[^.]+$/, '') + '.webp';
    ctx.set(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encodeURIComponent(fname)}`
    );
    // 缩略图本身可以让浏览器多缓存些（HMAC 已经签了 exp，URL 本身有失效保护）
    ctx.set('Cache-Control', 'private, max-age=86400, immutable');
  }

  /** 路径校验：dir 还是 file 还是 404 */
  async checkPath(
    path: string
  ): Promise<{ exists: boolean; isDirectory: boolean }> {
    this.ensureReady();
    const p = (path || '').replace(/^\/+/, '');
    if (!p) return { exists: true, isDirectory: true };
    const url = '/' + this.encodePath(p) + '?json';
    const r = await this.client!.get(url);
    if (r.status === 404) return { exists: false, isDirectory: false };
    if (r.status >= 400)
      throw new Error(`dufs 校验路径失败: HTTP ${r.status}`);
    const data = r.data || {};
    const isDirectory = !!data.dir_exists || data.kind === 'Index';
    return { exists: true, isDirectory };
  }

  private clampWidth(w: number): number {
    const v = Number(w);
    if (!v || v <= 0) return 0;
    // 找到 ALLOWED_THUMB_WIDTHS 里 >=v 的最小值；都不够就取最大
    for (const allowed of ALLOWED_THUMB_WIDTHS) {
      if (v <= allowed) return allowed;
    }
    return ALLOWED_THUMB_WIDTHS[ALLOWED_THUMB_WIDTHS.length - 1];
  }

  private isImage(key: string): boolean {
    return /\.(jpe?g|png|gif|webp|bmp|tiff?|avif|heic|heif)$/i.test(key);
  }

  private thumbCachePath(key: string, width: number): string {
    const hash = crypto
      .createHash('sha1')
      .update(`${key}|${width}`)
      .digest('hex');
    // 分两层目录，避免一个目录文件过多
    return path.join(
      this.cacheDir,
      hash.slice(0, 2),
      hash.slice(2, 4),
      `${hash}.webp`
    );
  }

  private makeToken(
    key: string,
    exp: number,
    filename: string,
    inline: string,
    width: number
  ): string {
    // 注意：width 加进 payload，防止前端篡改 ?w= 绕过 HMAC
    const payload = `${key}|${exp}|${filename}|${inline}|${width}`;
    return crypto
      .createHmac('sha256', this.cfg.signSecret || '')
      .update(payload)
      .digest('hex');
  }

  /** 标准化目录前缀：去掉前导 /，确保以 / 结尾（空串=根） */
  private normalizePrefix(prefix: string): string {
    let p = String(prefix || '').trim();
    p = p.replace(/^\/+/, '');
    if (!p) return '';
    if (!p.endsWith('/')) p += '/';
    return p;
  }

  /** 对路径做 URL 编码但保留斜杠分隔符 */
  private encodePath(p: string): string {
    return p
      .split('/')
      .map(seg => encodeURIComponent(seg))
      .join('/');
  }

  private guessContentType(key: string): string {
    const ext = (key.split('.').pop() || '').toLowerCase();
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      txt: 'text/plain; charset=utf-8',
      json: 'application/json',
    };
    return map[ext] || 'application/octet-stream';
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
