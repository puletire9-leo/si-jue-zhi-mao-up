import { App, Config, Inject, Logger, Provide } from '@midwayjs/decorator';
import { ILogger } from '@midwayjs/logger';
import OpenAI from 'openai';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Application } from '@midwayjs/koa';
import { BaiduTranslateService } from './baidu_translate';

/** 单条文案：原图文案 + 机翻中文（若有）+ 文案类型 + 中文 + 五语言 */
export interface CaptionItem {
  /** 图中抽取的原文 */
  rawText?: string;
  /** 机翻后的中文（精炼前）；与原文相同或未调用翻译时为 null */
  rawAfterRephrase?: string | null;
  /** 文案类型（标题/副标题/卖点等），第一步抽取时由 AI 判断 */
  role?: string;
  zh: string;
  uk: string;
  de: string;
  fr: string;
  it: string;
  es: string;
}

/**
 * 第一步抽取时，每条文案的类型（由 AI 判断）
 * title=标题 subtitle=副标题 bullet=卖点 detail_desc=详情描述 product_spec=产品参数
 * section_title=分项标题 section_desc=分项描述 step=步骤说明 label_badge=标签/徽章 other=其他
 */
export const RAW_CAPTION_ROLES = [
  'title',
  'subtitle',
  'bullet',
  'detail_desc',
  'product_spec',
  'section_title',
  'section_desc',
  'step',
  'label_badge',
  'other',
] as const;
export type RawCaptionRole = (typeof RAW_CAPTION_ROLES)[number];

/** 第一步：从图片里抽取出来的原始文案（不翻译、不一定改写） */
export interface RawCaption {
  id: number;
  text: string;
  /** 文案类型，由 AI 在抽取时判断 */
  role?: RawCaptionRole | string;
  /** 可选：该段文字语种（百度 from 代码，如 en、fra）；不确定可省略，服务端用 auto */
  lang?: string;
}

/** 第一步：图需骨架结果 */
export interface ImageSkeleton {
  effect: string;
  photography: string;
  design: string;
  rawCaptions: RawCaption[];
}

/** AI 图需单图输出（对外） */
export interface ImageRequirementResult {
  requirement: string;
  captions: CaptionItem[];
}

/** 第一步：看图 + 生成图需骨架 + 抽取所有文字块（含每条文案类型） */
const SKELETON_PROMPT = `你是电商图需撰写专家。根据一张竞品参考图（可能包含产品图、场景、文案等），以及可选的产品描述，输出严格的 JSON，不要输出 markdown 代码块或其它说明。

输出格式（仅此 JSON）：
{
  "effect": "一句话：整体要展现的效果",
  "photography": "一句话：摄影师需要怎么拍摄产品（只说跟产品本身相关的拍摄即可）",
  "design": "一句话：美工怎么作图（包括在产品以外要加什么元素、怎么组合）",
  "rawCaptions": [
    { "id": 1, "text": "主标题原文", "role": "title", "lang": "en" },
    { "id": 2, "text": "副标题原文", "role": "subtitle", "lang": "de" }
  ]
}

可选字段 lang：该段文字在图上的语言，填百度翻译支持的源语种代码（如 en、de、fra、it、spa）；不确定或混合语言时可省略，服务端将用自动检测（auto）。

每条 rawCaptions 的 role 必须为以下之一（表示该条文案在图中的类型）：
- title：标题（主标题、大标题、最醒目的主文案）
- subtitle：副标题（主标题下方的辅助标题）
- bullet：卖点（要点、bullet 列表项、短卖点）
- detail_desc：详情描述（一段话的产品/场景描述）
- product_spec：产品参数（尺寸、重量、材质、规格等）
- section_title：分项标题（如「产品特点」「使用方法」「注意事项」）
- section_desc：分项描述（分项标题下的说明段落）
- step：步骤说明（1. 2. 3. 或 How to use 类步骤）
- label_badge：标签/徽章（如「新品」「热卖」「限时」等短标签）
- other：其他（以上都不符时的兜底）

规则：
- effect、photography、design 各写一句话，只能描述参考图中真实可见的内容和构图；产品描述仅用于帮助你理解这是哪类产品，不能因为产品描述而虚构图中不存在的元素或文案。
- rawCaptions 只列出「作图时需要美工添加的说明性文字」；每一块独立文案对应一个对象，必须带 role。根据文案在图中的位置与形式判断其类型。
- 不要列入「产品本体上的文字」：如产品表面/包装上的品牌名、型号、刻字、条码、按键上的字等。若整张图只有产品上的字、没有说明性文案，则 rawCaptions 为 []。`;

/** 第三步（LLM）：输入已为中文的 rawCaptions，只做轻微润色与事实校对，不翻译外语 */
const REFINE_CAPTIONS_PROMPT = `你是电商中文文案专家。rawCaptions 中的 text 已是中文（可能来自机翻），每条对应图中一块说明性文案。

任务：在「不与产品事实冲突」的前提下，尽量保留含义，仅在必要时做轻微润色或按产品描述纠正；不要翻译成其他语言。

输出严格 JSON（不要 markdown 代码块）：
{
  "captions": [
    { "sourceId": 1, "zh": "润色后的中文文案" }
  ]
}

规则：
- sourceId 必须对应输入 rawCaptions 中的 id，一条 rawCaption 对应一条 caption，不要合并不同 id。
- 若某条与产品描述明显冲突（容量、材质、功能等），优先遵循产品描述改写为正确中文卖点。
- 若不冲突，尽量保持原意，只做轻微润色。
- 禁止捏造与产品描述相矛盾的事实。`;

/**
 * 根据竞品参考图 + 产品描述调用视觉大模型，生成图需描述与多语文案
 */
@Provide()
export class DesignTaskAiService {
  @App()
  app: Application;

  @Inject()
  baiduTranslateService: BaiduTranslateService;

  @Config('designTaskAi')
  designTaskAiConfig: {
    provider?: 'openai';
    apiKey?: string;
    baseURL?: string;
    model?: string;
  };

  @Logger()
  logger: ILogger;

  private client: OpenAI | null = null;

  private extractErrorMessage(err: any): string {
    const msg =
      err?.response?.data?.error?.message ||
      err?.response?.data?.error_msg ||
      err?.message ||
      String(err);
    return String(msg || '未知错误').trim();
  }

  private withSourceError(source: string, err: any): Error {
    return new Error(`[${source}] ${this.extractErrorMessage(err)}`);
  }

  private getClient(): OpenAI {
    if (this.client) return this.client;
    const conf = this.designTaskAiConfig || {};
    const apiKey = conf.apiKey || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      throw new Error('设计图需 AI 未配置：请设置 designTaskAi.apiKey 或 OPENAI_API_KEY');
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: conf.baseURL || process.env.OPENAI_BASE_URL || undefined,
    });
    return this.client;
  }

  /**
   * 将图片 URL 转为 API 可用的 image content：
   * - 公网 URL 直接传 url
   * - 内网或不可用则拉取为 base64
   */
  private async toImageContent(
    imageUrl: string,
  ): Promise<{ type: 'image_url'; image_url: { url: string } } | { type: 'image_url'; image_url: { url: string; detail?: 'low' } }> {
    const url = (imageUrl || '').trim();
    if (!url) throw new Error('参考图 URL 为空');

    const isHttpUrl = /^https?:\/\//i.test(url);
    const isPublicHttpUrl = isHttpUrl && !/localhost|127\.0\.0\.1/i.test(url);

    // 对于公网 http/https URL，仍然直接以 URL 形式传给 OpenAI
    if (isPublicHttpUrl) {
      return { type: 'image_url', image_url: { url, detail: 'low' } };
    }

    // 其余情况：优先尝试从本地磁盘读取（尤其是 /public/uploads），否则再通过 HTTP 拉取
    let base64: string;
    let mime: string = 'image/jpeg';

    const uploadsRelative = url.startsWith('/public/uploads/')
      ? url.replace(/^\//, '')
      : url.startsWith('public/uploads/')
        ? url
        : null;

    if (uploadsRelative) {
      // 本地上传目录：cool-admin-midway/public/uploads/...
      const localPath = path.join(this.app.getBaseDir(), '..', uploadsRelative);
      const data = await fs.promises.readFile(localPath);
      base64 = data.toString('base64');
      const ext = path.extname(localPath).toLowerCase();
      if (ext === '.png') mime = 'image/png';
      else if (ext === '.webp') mime = 'image/webp';
      else if (ext === '.gif') mime = 'image/gif';
      else mime = 'image/jpeg';
    } else {
      // 兜底：仍通过 HTTP 拉图（如 localhost 相对 URL 等）
      let fetchUrl = url;
      if (!isHttpUrl) {
        if (url.startsWith('/')) {
          const origin =
            process.env.FILE_DOMAIN ||
            process.env.PUBLIC_ORIGIN ||
            'http://127.0.0.1:8001';
          fetchUrl = origin.replace(/\/$/, '') + url;
        } else {
          throw new Error(`参考图 URL 无法识别：${url}`);
        }
      }
      const res = await axios.get(fetchUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });
      base64 = Buffer.from(res.data).toString('base64');
      mime = (res.headers['content-type'] as string) || 'image/jpeg';
    }

    const dataUrl = `data:${mime};base64,${base64}`;
    return { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } };
  }

  /**
   * 第一步：单张参考图生成图需骨架 + 原始文字列表（不翻译）
   */
  async generateImageSkeleton(params: {
    referenceImageUrl: string;
    productDescription?: string;
    label?: string;
    type?: string;
  }): Promise<ImageSkeleton> {
    const { referenceImageUrl, productDescription = '', label = '', type = '' } = params;
    const client = this.getClient();
    const model = this.designTaskAiConfig?.model || process.env.OPENAI_VISION_MODEL || 'gpt-5-mini';

    const imageContent = await this.toImageContent(referenceImageUrl);
    const userText = [
      productDescription
        ? `产品描述（仅供理解产品类型，抽取文字和图需时不得据此虚构图片中不存在的内容）：${productDescription}`
        : '',
      [label, type].filter(Boolean).length ? `本图编号/类型：${[label, type].filter(Boolean).join(' ')}` : '',
      '请先看图并理解其文案结构，然后依据上面的 SYSTEM 规则输出 JSON。不要翻译 rawCaptions，只需完整列出每一块独立文案的原文；effect/photography/design 与 rawCaptions 的内容都必须严格基于参考图中真实可见的内容。',
    ]
      .filter(Boolean)
      .join('\n');

    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: 'text', text: userText },
      imageContent,
    ];

    let resp: OpenAI.Chat.Completions.ChatCompletion;
    try {
      resp = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SKELETON_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
      });
    } catch (err: any) {
      throw this.withSourceError('OPENAI_VISION_SKELETON', err);
    }

    const raw = resp.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error('AI 返回为空');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      this.logger.warn('AI 图需骨架 JSON 解析失败，原始: %s', raw?.slice(0, 200));
      throw new Error('AI 返回不是合法 JSON');
    }

    const effect = String((parsed as any)?.effect ?? '').trim();
    const photography = String((parsed as any)?.photography ?? '').trim();
    const design = String((parsed as any)?.design ?? '').trim();

    const rawCaptionsArr = Array.isArray((parsed as any).rawCaptions) ? ((parsed as any).rawCaptions as any[]) : [];
    const rawCaptions: RawCaption[] = rawCaptionsArr
      .map((c: any, idx: number) => ({
        id: Number.isFinite(Number(c?.id)) ? Number(c.id) : idx + 1,
        text: String(c?.text ?? '').trim(),
        role: c?.role ? String(c.role).trim() : undefined,
        lang: c?.lang != null && String(c.lang).trim() ? String(c.lang).trim().toLowerCase() : undefined,
      }))
      .filter((c) => !!c.text);

    return {
      effect,
      photography,
      design,
      rawCaptions,
    };
  }

  /**
   * 中文 rawCaptions + 产品描述 → 仅输出润色后的中文（不翻译五站点）
   */
  async refineCaptions(params: {
    rawCaptions: RawCaption[];
    productDescription?: string;
    label?: string;
    type?: string;
  }): Promise<Array<{ sourceId: number; zh: string }>> {
    const { rawCaptions, productDescription = '', label = '', type = '' } = params;
    if (!rawCaptions || rawCaptions.length === 0) {
      return [];
    }
    const client = this.getClient();
    const model = this.designTaskAiConfig?.model || process.env.OPENAI_VISION_MODEL || 'gpt-5-mini';

    const payload = {
      productDescription,
      meta: {
        label,
        type,
      },
      rawCaptions,
    };

    let resp: OpenAI.Chat.Completions.ChatCompletion;
    try {
      resp = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: REFINE_CAPTIONS_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  '下面是 JSON 格式的输入数据，请按照规则返回 captions JSON：\n' +
                  JSON.stringify(payload, null, 2),
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      });
    } catch (err: any) {
      throw this.withSourceError('OPENAI_REFINE_CAPTIONS', err);
    }

    const raw = resp.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error('AI 返回为空');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      this.logger.warn('AI 文案 JSON 解析失败，原始: %s', raw?.slice(0, 200));
      throw new Error('AI 返回不是合法 JSON');
    }

    const arr = Array.isArray((parsed as any).captions) ? ((parsed as any).captions as any[]) : [];
    return arr
      .map((c: any) => ({
        sourceId: Number(c?.sourceId),
        zh: String(c?.zh ?? '').trim(),
      }))
      .filter((r) => Number.isFinite(r.sourceId) && r.zh);
  }

  /**
   * 单张参考图生成图需 + 多语文案（对外统一入口）
   * skeleton → qwen-mt 译中 → refineCaptions（LLM 仅中文）→ qwen-mt zh→五站点
   */
  async generateImageRequirement(params: {
    referenceImageUrl: string;
    productDescription?: string;
    label?: string;
    type?: string;
  }): Promise<ImageRequirementResult> {
    const { productDescription = '', label = '', type = '' } = params;

    const skeleton = await this.generateImageSkeleton(params);

    const requirement = [
      '【展现效果】',
      skeleton.effect || '（未生成）',
      '【摄影】',
      skeleton.photography || '（未生成）',
      '【美工】',
      skeleton.design || '（未生成）',
    ].join('\n');

    const originals = skeleton.rawCaptions;
    if (!originals.length) {
      return { requirement, captions: [] };
    }

    let machineZhTexts: string[];
    try {
      machineZhTexts = await Promise.all(
        originals.map((c) => this.baiduTranslateService.translateUnknownToZh(c.text, c.lang)),
      );
    } catch (err: any) {
      throw this.withSourceError('QWEN_MT_TRANSLATE_TO_ZH', err);
    }

    const rawCaptionsZh: RawCaption[] = originals.map((c, i) => ({
      id: c.id,
      role: c.role,
      text: machineZhTexts[i],
      lang: 'zh',
    }));

    const refinedRows = await this.refineCaptions({
      rawCaptions: rawCaptionsZh,
      productDescription,
      label,
      type,
    });
    const refinedById = new Map(refinedRows.map((r) => [r.sourceId, r.zh]));

    const captions: CaptionItem[] = await Promise.all(
      originals.map(async (orig, i) => {
        const machineZh = machineZhTexts[i];
        const zh = refinedById.get(orig.id) ?? machineZh;
        let locales: {
          uk: string;
          de: string;
          fr: string;
          it: string;
          es: string;
        };
        try {
          const { provider: _p, model: _m, ...localeTexts } =
            await this.baiduTranslateService.translateZhToListingLocales(zh);
          locales = localeTexts;
        } catch (err: any) {
          throw this.withSourceError('QWEN_MT_TRANSLATE_TO_LOCALES', err);
        }
        const machineDiffers = orig.text.trim() !== machineZh.trim();
        return {
          rawText: orig.text,
          rawAfterRephrase: machineDiffers ? machineZh : null,
          role: orig.role,
          zh,
          ...locales,
        };
      }),
    );

    return {
      requirement,
      captions,
    };
  }
}
