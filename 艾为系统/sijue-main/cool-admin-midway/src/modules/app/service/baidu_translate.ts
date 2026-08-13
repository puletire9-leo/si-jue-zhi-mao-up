import { Provide, Config } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';
import OpenAI from 'openai';
import { BaseSysParamEntity } from '../../base/entity/sys/param';

export type ZhListingLocales = {
  uk: string;
  de: string;
  fr: string;
  it: string;
  es: string;
};

export type ZhListingLocalesResult = ZhListingLocales & {
  provider: 'qwen-mt' | 'baidu-fallback' | 'none';
  model: string;
};

/** OpenAI 翻译服务（保留原 Service 名称以兼容现有调用方） */
@Provide()
export class BaiduTranslateService {
  @Config('designTaskAi')
  designTaskAiConfig: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
    /** 图需多语言翻译模型，默认 qwen-mt-flash */
    translateModel?: string;
  };

  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamRepo: Repository<BaseSysParamEntity>;

  private client: OpenAI | null = null;
  // 开关：百度失败时是否回退 OpenAI
  private readonly enableOpenAIFallback = true;
  // 百度 q 参数限长约 6000 bytes，预留签名和边界余量
  private readonly baiduBatchMaxBytes = 5200;

  private normalizeBaiduRows(rows: string[]): string {
    return (rows || [])
      .map(row => String(row || '').trim())
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  private async getBaiduCredentials() {
    const [paramAppId, paramKey] = await Promise.all([
      this.baseSysParamRepo.findOne({ where: { keyName: 'baiduTranslateAppId' } }),
      this.baseSysParamRepo.findOne({ where: { keyName: 'baiduTranslateKey' } }),
    ]);
    const appid = String(paramAppId?.data || '').trim();
    const appkey = String(paramKey?.data || '').trim();
    if (!appid || !appkey) {
      throw new Error('百度翻译API未配置，请在 base_sys_param 表中添加 baiduTranslateAppId 和 baiduTranslateKey');
    }
    return { appid, appkey };
  }

  private async requestBaiduTranslate(
    sourceText: string,
    to: 'en' | 'de' | 'fr' | 'it' | 'es' | 'zh'
  ): Promise<string[]> {
    const q = String(sourceText || '').trim();
    if (!q) return [];
    const { appid, appkey } = await this.getBaiduCredentials();
    const startAt = Date.now();
    const toMap: Record<'en' | 'de' | 'fr' | 'it' | 'es' | 'zh', string> = {
      en: 'en',
      de: 'de',
      fr: 'fra',
      it: 'it',
      es: 'spa',
      zh: 'zh',
    };
    const baiduTo = toMap[to];
    const salt = String(Date.now()) + Math.random().toString(36).slice(2, 8);
    const signStr = appid + q + salt + appkey;
    const sign = crypto.createHash('md5').update(signStr, 'utf8').digest('hex');
    const response = await axios.post(
      'https://fanyi-api.baidu.com/api/trans/vip/translate',
      new URLSearchParams({
        q,
        from: 'auto',
        to: baiduTo,
        appid,
        salt,
        sign,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );
    const data = response?.data || {};
    if (data?.error_code) {
      const elapsed = Date.now() - startAt;
      console.error(
        '[translateFromZh][baidu][error] to=%s elapsed=%dms code=%s msg=%s textSample=%s',
        baiduTo,
        elapsed,
        String(data?.error_code || ''),
        String(data?.error_msg || ''),
        q.slice(0, 80)
      );
      throw new Error(`百度翻译失败: ${data?.error_msg || 'unknown'} (${data?.error_code})`);
    }
    const rows = Array.isArray(data?.trans_result) ? data.trans_result : [];
    return rows.map((row: any) => String(row?.dst || '').trim());
  }

  private async translateByBaidu(sourceText: string, to: 'en' | 'de' | 'fr' | 'it' | 'es' | 'zh') {
    const rows = await this.requestBaiduTranslate(sourceText, to);
    return this.normalizeBaiduRows(rows);
  }

  private buildBaiduTextChunks(
    rows: Array<{ key: string; text: string }>
  ): Array<Array<{ key: string; text: string }>> {
    const chunks: Array<Array<{ key: string; text: string }>> = [];
    let current: Array<{ key: string; text: string }> = [];
    let currentBytes = 0;
    for (const row of rows) {
      const normalized = String(row.text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lineBytes = Buffer.byteLength(normalized, 'utf8');
      const sepBytes = current.length ? 1 : 0; // '\n'
      if (current.length && currentBytes + sepBytes + lineBytes > this.baiduBatchMaxBytes) {
        chunks.push(current);
        current = [];
        currentBytes = 0;
      }
      current.push({ key: row.key, text: normalized });
      currentBytes += (current.length > 1 ? 1 : 0) + lineBytes;
    }
    if (current.length) chunks.push(current);
    return chunks;
  }

  private getClient(): OpenAI {
    if (this.client) return this.client;
    const conf = this.designTaskAiConfig || {};
    const apiKey = conf.apiKey || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      throw new Error('未配置 OpenAI：请设置 designTaskAi.apiKey 或 OPENAI_API_KEY');
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: conf.baseURL || process.env.OPENAI_BASE_URL || undefined,
    });
    return this.client;
  }

  private getModel(): string {
    return this.designTaskAiConfig?.model || process.env.OPENAI_VISION_MODEL || 'gpt-5-mini';
  }

  private getTranslateModel(): string {
    return (
      this.designTaskAiConfig?.translateModel ||
      process.env.QWEN_MT_MODEL ||
      'qwen-mt-flash'
    );
  }

  private getChatCompletionsUrl(): string {
    const conf = this.designTaskAiConfig || {};
    const base = String(conf.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(
      /\/$/,
      '',
    );
    return `${base}/chat/completions`;
  }

  private readonly qwenMtTargetLang: Record<'uk' | 'de' | 'fr' | 'it' | 'es', string> = {
    uk: 'English',
    de: 'German',
    fr: 'French',
    it: 'Italian',
    es: 'Spanish',
  };

  private resolveQwenSourceLang(fromHint?: string): string {
    const hint = (fromHint || '').trim().toLowerCase();
    if (!hint || hint === 'auto') return 'auto';
    const map: Record<string, string> = {
      zh: 'Chinese',
      cht: 'Chinese',
      wyw: 'Chinese',
      yue: 'Chinese',
      en: 'English',
      de: 'German',
      fra: 'French',
      fr: 'French',
      it: 'Italian',
      spa: 'Spanish',
      es: 'Spanish',
      jp: 'Japanese',
      ja: 'Japanese',
      kor: 'Korean',
      ko: 'Korean',
    };
    return map[hint] || 'auto';
  }

  /** qwen-mt-flash 通用翻译（智增增 OpenAI 兼容端点） */
  private async requestQwenMt(
    sourceText: string,
    translationOptions: { source_lang: string; target_lang: string },
    logTag: string,
  ): Promise<string> {
    const q = String(sourceText || '').trim();
    if (!q) return '';
    const conf = this.designTaskAiConfig || {};
    const apiKey = conf.apiKey || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      throw new Error('未配置翻译 API：请设置 designTaskAi.apiKey 或 OPENAI_API_KEY');
    }
    const { source_lang, target_lang } = translationOptions;
    const startAt = Date.now();
    try {
      const response = await axios.post(
        this.getChatCompletionsUrl(),
        {
          model: this.getTranslateModel(),
          messages: [{ role: 'user', content: q }],
          translation_options: { source_lang, target_lang },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        },
      );
      const content = String(response?.data?.choices?.[0]?.message?.content || '').trim();
      if (!content) {
        throw new Error('qwen-mt 返回为空');
      }
      return content;
    } catch (err: any) {
      const elapsed = Date.now() - startAt;
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'unknown';
      console.error(
        '[%s][qwen-mt][error] source=%s target=%s elapsed=%dms msg=%s textSample=%s',
        logTag,
        source_lang,
        target_lang,
        elapsed,
        String(msg),
        q.slice(0, 80),
      );
      throw new Error(`翻译失败: ${msg}`);
    }
  }

  /** qwen-mt-flash：中文 → 单目标语种 */
  private async translateByQwenMt(
    sourceText: string,
    targetLang: 'uk' | 'de' | 'fr' | 'it' | 'es',
    sourceLang = 'Chinese',
  ): Promise<string> {
    return this.requestQwenMt(
      sourceText,
      { source_lang: sourceLang, target_lang: this.qwenMtTargetLang[targetLang] },
      'translateFromZh',
    );
  }

  /** qwen-mt-flash：外语 → 简体中文 */
  private async translateToZhByQwenMt(sourceText: string, fromHint?: string): Promise<string> {
    return this.requestQwenMt(
      sourceText,
      { source_lang: this.resolveQwenSourceLang(fromHint), target_lang: 'Chinese' },
      'translateToZh',
    );
  }

  private async translateByOpenAI(
    sourceText: string,
    targetLang: 'zh' | 'uk' | 'de' | 'fr' | 'it' | 'es',
  ): Promise<string> {
    const client = this.getClient();
    const model = this.getModel();
    const targetLabelMap: Record<'zh' | 'uk' | 'de' | 'fr' | 'it' | 'es', string> = {
      zh: '简体中文',
      uk: 'English (UK)',
      de: 'Deutsch',
      fr: 'Français',
      it: 'Italiano',
      es: 'Español',
    };
    const resp = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            `你是专业翻译引擎。将输入文本准确翻译为 ${targetLabelMap[targetLang]}。` +
            '仅输出译文纯文本，不要解释，不要 markdown，不要引号。',
        },
        { role: 'user', content: sourceText },
      ],
    });
    return String(resp.choices?.[0]?.message?.content || '').trim();
  }

  /** 未知语种 → 简体中文（qwen-mt-flash，失败回退百度） */
  async translateUnknownToZh(text: string, fromHint?: string): Promise<string> {
    const q = (text || '').trim();
    if (!q) return '';
    const hint = (fromHint || '').trim().toLowerCase();
    if (hint === 'zh' || hint === 'cht' || hint === 'wyw' || hint === 'yue') {
      return q;
    }
    try {
      return await this.translateToZhByQwenMt(q, fromHint);
    } catch (e: any) {
      console.warn(
        '[translateToZh][qwen-mt] 失败，回退百度: %s',
        e?.message || String(e),
      );
      return this.translateByBaidu(q, 'zh');
    }
  }

  /** 批量：未知语种 → 简体中文（优先百度合并请求，失败回退 OpenAI）。 */
  async translateUnknownToZhBatch(
    items: Array<{ key?: string; text?: string; from?: string }>
  ): Promise<Record<string, string>> {
    const map: Record<string, string> = {};
    const pending: Array<{ key: string; text: string }> = [];
    const multilinePending: Array<{ key: string; text: string }> = [];
    for (let idx = 0; idx < (items || []).length; idx++) {
      const item = items[idx] || {};
      const key = String(item?.key ?? idx);
      const raw = String(item?.text || '').trim();
      if (!raw) {
        map[key] = '';
        continue;
      }
      const hint = String(item?.from || '').trim().toLowerCase();
      if (hint === 'zh' || hint === 'cht' || hint === 'wyw' || hint === 'yue') {
        map[key] = raw;
        continue;
      }
      if (/[\r\n]/.test(raw)) {
        multilinePending.push({ key, text: raw });
      } else {
        pending.push({ key, text: raw });
      }
    }
    if (!pending.length && !multilinePending.length) return map;

    if (pending.length) {
      const chunks = this.buildBaiduTextChunks(pending);
      for (const chunk of chunks) {
        const merged = chunk.map(x => x.text).join('\n');
        try {
          const rows = await this.requestBaiduTranslate(merged, 'zh');
          if (rows.length === chunk.length) {
            chunk.forEach((item, i) => {
              map[item.key] = String(rows[i] || '').trim();
            });
            continue;
          }
          await Promise.all(
            chunk.map(async item => {
              map[item.key] = await this.translateByBaidu(item.text, 'zh');
            })
          );
        } catch (e: any) {
          if (!this.enableOpenAIFallback) throw e;
          await Promise.all(
            chunk.map(async item => {
              map[item.key] = await this.translateByOpenAI(item.text, 'zh');
            })
          );
        }
      }
    }

    for (const item of multilinePending) {
      try {
        map[item.key] = await this.translateByBaidu(item.text, 'zh');
      } catch (e: any) {
        if (!this.enableOpenAIFallback) throw e;
        map[item.key] = await this.translateByOpenAI(item.text, 'zh');
      }
    }
    return map;
  }

  private async translateZhToListingLocalesByBaidu(zh: string): Promise<ZhListingLocalesResult> {
    const raw = (zh || '').trim();
    if (!raw) {
      return { uk: '', de: '', fr: '', it: '', es: '', provider: 'none', model: '' };
    }
    const [uk, de, fr, it, es] = await Promise.all([
      this.translateByBaidu(raw, 'en'),
      this.translateByBaidu(raw, 'de'),
      this.translateByBaidu(raw, 'fr'),
      this.translateByBaidu(raw, 'it'),
      this.translateByBaidu(raw, 'es'),
    ]);
    return { uk, de, fr, it, es, provider: 'baidu-fallback', model: 'baidu' };
  }

  /** 英文（或其它语种，auto 检测）→ 德文后缀 */
  async translateToDe(text: string): Promise<string> {
    const q = (text || '').trim();
    if (!q) return '';
    try {
      return await this.translateByBaidu(q, 'de');
    } catch (e: any) {
      if (this.enableOpenAIFallback) {
        return this.translateByOpenAI(q, 'de');
      }
      throw e;
    }
  }

  /** 中文 → UK(英)、德、法、意、西（qwen-mt-flash @ 智增增，失败回退百度） */
  async translateZhToListingLocales(zh: string): Promise<ZhListingLocalesResult> {
    const raw = (zh || '').trim();
    if (!raw) {
      return { uk: '', de: '', fr: '', it: '', es: '', provider: 'none', model: '' };
    }
    const model = this.getTranslateModel();
    try {
      const [uk, de, fr, it, es] = await Promise.all([
        this.translateByQwenMt(raw, 'uk'),
        this.translateByQwenMt(raw, 'de'),
        this.translateByQwenMt(raw, 'fr'),
        this.translateByQwenMt(raw, 'it'),
        this.translateByQwenMt(raw, 'es'),
      ]);
      return { uk, de, fr, it, es, provider: 'qwen-mt', model };
    } catch (e: any) {
      console.warn(
        '[translateFromZh][qwen-mt] 失败，回退百度: %s',
        e?.message || String(e),
      );
      return this.translateZhToListingLocalesByBaidu(raw);
    }
  }
}
