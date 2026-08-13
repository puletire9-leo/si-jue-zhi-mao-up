import {App, Controller, Get, Inject, Query} from "@midwayjs/decorator";
import {Application, Context} from "@midwayjs/koa";
import {CoolController, CoolTag, CoolUrlTag, TagTypes} from "@cool-midway/core";
import axios from 'axios';

const IMAGE_PROXY_TIMEOUT_MS = 45 * 1000;
const IMAGE_PROXY_MAX_ATTEMPTS = 3;
const IMAGE_PROXY_RETRY_DELAY_MS = 600;
const IMAGE_PROXY_SUCCESS_CACHE_TTL_MS = 10 * 60 * 1000;
const IMAGE_PROXY_FAILURE_CACHE_TTL_MS = 15 * 1000;
const IMAGE_PROXY_SUCCESS_CACHE_MAX_ITEMS = 300;
const IMAGE_PROXY_SUCCESS_CACHE_MAX_BYTES = 80 * 1024 * 1024;
const IMAGE_PROXY_MAX_CACHEABLE_BYTES = 5 * 1024 * 1024;

interface ImageProxyResponse {
  data: Buffer;
  headers: Record<string, any>;
}

type ImageProxyFetcher = (url: string) => Promise<{ data: any; headers?: Record<string, any> }>;

interface ImageProxySuccessCacheEntry {
  response: ImageProxyResponse;
  expiresAt: number;
  bytes: number;
}

interface ImageProxyFailureCacheEntry {
  error: any;
  expiresAt: number;
}

const imageProxySuccessCache = new Map<string, ImageProxySuccessCacheEntry>();
const imageProxyFailureCache = new Map<string, ImageProxyFailureCacheEntry>();
const imageProxyInflight = new Map<string, Promise<ImageProxyResponse>>();
let imageProxySuccessCacheBytes = 0;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeRemoteImageUrl(rawUrl: string) {
  const parsed = new URL(String(rawUrl || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https image urls are allowed');
  }

  return parsed.href;
}

async function fetchRemoteImage(url: string) {
  let lastError: any;
  const referer = new URL(url).origin + '/';

  for (let attempt = 1; attempt <= IMAGE_PROXY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await axios({
        url,
        method: 'get',
        responseType: 'arraybuffer',
        timeout: IMAGE_PROXY_TIMEOUT_MS,
        validateStatus: status => status >= 200 && status < 300,
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          Referer: referer,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
        }
      });
    } catch (err) {
      lastError = err;
      if (attempt < IMAGE_PROXY_MAX_ATTEMPTS) {
        await sleep(IMAGE_PROXY_RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
}


function normalizeImageProxyResponse(res: { data: any; headers?: Record<string, any> }): ImageProxyResponse {
  return {
    data: Buffer.isBuffer(res.data) ? Buffer.from(res.data) : Buffer.from(res.data || []),
    headers: { ...(res.headers || {}) },
  };
}

function cloneImageProxyResponse(res: ImageProxyResponse): ImageProxyResponse {
  return {
    data: Buffer.from(res.data),
    headers: { ...res.headers },
  };
}

function deleteImageProxySuccessCacheEntry(url: string) {
  const entry = imageProxySuccessCache.get(url);
  if (!entry) return;

  imageProxySuccessCacheBytes = Math.max(0, imageProxySuccessCacheBytes - entry.bytes);
  imageProxySuccessCache.delete(url);
}

function pruneImageProxyCaches(now = Date.now()) {
  for (const [url, entry] of imageProxySuccessCache) {
    if (entry.expiresAt <= now) {
      deleteImageProxySuccessCacheEntry(url);
    }
  }

  for (const [url, entry] of imageProxyFailureCache) {
    if (entry.expiresAt <= now) {
      imageProxyFailureCache.delete(url);
    }
  }

  while (
    imageProxySuccessCache.size > IMAGE_PROXY_SUCCESS_CACHE_MAX_ITEMS ||
    imageProxySuccessCacheBytes > IMAGE_PROXY_SUCCESS_CACHE_MAX_BYTES
  ) {
    const oldestUrl = imageProxySuccessCache.keys().next().value;
    if (!oldestUrl) break;
    deleteImageProxySuccessCacheEntry(oldestUrl);
  }
}

function setImageProxySuccessCache(url: string, response: ImageProxyResponse) {
  const bytes = response.data.byteLength;
  if (bytes > IMAGE_PROXY_MAX_CACHEABLE_BYTES) return;

  deleteImageProxySuccessCacheEntry(url);
  imageProxySuccessCache.set(url, {
    response: cloneImageProxyResponse(response),
    expiresAt: Date.now() + IMAGE_PROXY_SUCCESS_CACHE_TTL_MS,
    bytes,
  });
  imageProxySuccessCacheBytes += bytes;
  pruneImageProxyCaches();
}


async function fetchRemoteImageWithCache(
  url: string,
  fetcher: ImageProxyFetcher = fetchRemoteImage
): Promise<ImageProxyResponse> {
  const now = Date.now();
  pruneImageProxyCaches(now);

  const cached = imageProxySuccessCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cloneImageProxyResponse(cached.response);
  }

  const failed = imageProxyFailureCache.get(url);
  if (failed && failed.expiresAt > now) {
    throw failed.error;
  }

  const inflight = imageProxyInflight.get(url);
  if (inflight) {
    return cloneImageProxyResponse(await inflight);
  }

  const request = (async () => {
    try {
      const response = normalizeImageProxyResponse(await fetcher(url));
      setImageProxySuccessCache(url, response);
      imageProxyFailureCache.delete(url);
      return cloneImageProxyResponse(response);
    } catch (err) {
      imageProxyFailureCache.set(url, {
        error: err,
        expiresAt: Date.now() + IMAGE_PROXY_FAILURE_CACHE_TTL_MS,
      });
      throw err;
    } finally {
      imageProxyInflight.delete(url);
    }
  })();

  imageProxyInflight.set(url, request);
  return cloneImageProxyResponse(await request);
}

@Controller('/proxy')
export class RemoteProxyController {
  @App()
  app: Application;

  @Inject()
  ctx: Context;

  @Get('/image')
  async image(@Query('url') url: string) {
    if (!url) {
      this.ctx.status = 400;
      return 'Missing image url';
    }

    let remoteUrl = '';
    try {
      remoteUrl = normalizeRemoteImageUrl(url);
    } catch (err) {
      this.ctx.status = 400;
      return err instanceof Error ? err.message : String(err);
    }

    try {
      const res = await fetchRemoteImageWithCache(remoteUrl);
      this.ctx.type = (res.headers['content-type'] as string) || 'image/jpeg';
      this.ctx.set('Cache-Control', `public, max-age=${60 * 60 * 24 * 10}`);
      return Buffer.from(res.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.ctx.status = 502;
      this.ctx.type = 'text/plain';
      this.ctx.set('Cache-Control', 'no-store');
      console.warn('/proxy/image failed:', remoteUrl, message);
      return `/proxy/image failed: ${message}`;
    }
  }
}
