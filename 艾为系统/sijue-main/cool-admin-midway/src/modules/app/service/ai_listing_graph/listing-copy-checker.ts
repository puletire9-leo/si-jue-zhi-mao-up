import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { ListingKeywordItem } from './state';
import {
  expandMergedKeywordTerms,
  keywordsOverlapForSelection,
} from './keyword-phrase-match';

export type VariantFactItem = {
  name: string;
  description: string;
};

export type ListingCopyCheckerContext = {
  language: string;
  productSummary: string;
  productName: string;
  produceName: string;
  keyParameters: string;
  packageInfo: string;
  variantFacts: VariantFactItem[];
  allowedKeywords: string[];
  reviewText: string;
};

export function collectAllowedKeywordsFromList(
  keywords: ListingKeywordItem[] | string[] | null | undefined
): string[] {
  const allowTypes = new Set(['核心大词', '核心词', '长尾词']);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of keywords || []) {
    if (typeof row === 'string') {
      const kw = row.trim();
      if (!kw) continue;
      const key = kw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(kw);
      continue;
    }
    const type = String(row?.type || '').trim();
    if (!allowTypes.has(type)) continue;
    const kw = String(row?.keyword || '').trim();
    if (!kw) continue;
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
  }
  return out;
}

export function formatCheckerFactBlock(ctx: ListingCopyCheckerContext): string {
  const lines: string[] = [];
  if (ctx.productName) lines.push(`产品名称（前台）: ${ctx.productName}`);
  if (ctx.produceName && ctx.produceName !== ctx.productName) {
    lines.push(`产品品名（ERP）: ${ctx.produceName}`);
  }
  if (ctx.productSummary) lines.push(`商品梗概:\n${ctx.productSummary}`);
  if (ctx.keyParameters) lines.push(`规格参数:\n${ctx.keyParameters}`);
  if (ctx.packageInfo) lines.push(`包装信息:\n${ctx.packageInfo}`);
  if (ctx.variantFacts.length) {
    lines.push('变体信息:');
    for (const v of ctx.variantFacts) {
      const name = String(v.name || '').trim();
      const desc = String(v.description || '').trim();
      if (!name && !desc) continue;
      lines.push(`  - ${name}${desc ? `：${desc}` : ''}`);
    }
  }
  if (ctx.allowedKeywords.length) {
    lines.push(
      `允许布局的关键词（刻意用于 SEO，梗概未写也允许；除非与上文事实明确矛盾）:\n${ctx.allowedKeywords.join('、')}`
    );
  }
  return lines.join('\n\n');
}

/** LLM 工具/结构化输出偶发填充的占位行，并非真实审核结果 */
function isPlaceholderCheckerWord(word: string, reason: string): boolean {
  const w = String(word || '').trim();
  const r = String(reason || '').trim().toLowerCase();
  if (/^example_word_\d+$/i.test(w)) return true;
  if (r.includes('placeholder for required function')) return true;
  if (r.includes('not used in audit')) return true;
  return false;
}

function isPlaceholderIrrelevantRow(row: {
  irrelevant_word: string;
  reason: string;
}): boolean {
  return isPlaceholderCheckerWord(row.irrelevant_word, row.reason);
}

export function filterIrrelevantWords(
  rows: Array<{ irrelevant_word?: string; reason?: string }> | null | undefined,
  allowedKeywords: string[]
): Array<{ irrelevant_word: string; reason: string }> {
  const allowed = (allowedKeywords || []).map((k) => String(k || '').trim()).filter(Boolean);
  const normalized = (rows || [])
    .map((row) => ({
      irrelevant_word: String(row?.irrelevant_word || '').trim(),
      reason: String(row?.reason || '').trim(),
    }))
    .filter((row) => row.irrelevant_word && !isPlaceholderIrrelevantRow(row));
  if (!allowed.length) {
    return normalized;
  }
  return normalized.filter((row) => {
    const fragments = expandMergedKeywordTerms(row.irrelevant_word);
    const covered = fragments.every((fragment) =>
      allowed.some((allowedKw) => keywordsOverlapForSelection(fragment, allowedKw))
    );
    return !covered;
  });
}

const IRRELEVANT_SYSTEM_PROMPT = `你是一个亚马逊 Listing 事实审核员。请根据提供的商品事实材料，审核 {language} 文案中的用词。

只标记满足以下任一条件的词或短语（可含 / 分隔的合并写法）：
1. 与商品梗概、规格参数、变体信息等事实材料存在明确矛盾（例如参数写明无加热，文案却写 heating）。
2. 明显照搬竞品专属功能/配件，且事实材料表明本产品不具备。

以下情况不要标记（返回空列表或跳过该项）：
- 仅因梗概/参数未提及；品类常见表述（如 mask、therapy、light、massager）不算错误。
- 出现在「允许布局的关键词」列表中的词及其合理写法（含连字符、空格、语序变化、/ 合并项中的任一分支）。
- 无法用现有材料 100% 否定的功能；禁止输出「如果产品没有…则…」「若设备不含…」等条件句。
- 与允许关键词存在词袋包含关系的 shorter/longer 表述（如允许 red light therapy 时，不要单独报 light）。

无明确矛盾时返回空列表。理由须陈述矛盾点，使用肯定句。`;

const BRAND_SYSTEM_PROMPT = `请找出我提供的亚马逊商品标题或卖点等 {language} 文本中，哪些词可能是品牌词（不是泛指品类词）。
以列表形式返回，并给出一中文简要理由。如果文本中不包含任何品牌词，则返回空列表。
品牌词通常具有以下特点：
1. 拼写奇怪: 拼写比较奇怪的词很可能是品牌词。
2. 简洁直接: 避免复杂和冗长的名称，便于消费者记忆和传播。
3. 富有识别度: 听到或看到时立即引起消费者认知。
4. 意义明确: 清晰传达品牌核心价值。
5. 结构规范: 避免过多缩写或外来词堆砌。
6. 文化适应性: 避免引起冲突或误解的词语。
7. 创新性与独特性: 帮助品牌在竞争中脱颖而出。
8. 体现品质与专业性。
9. 具有国际化视野：在不同语言和文化背景下都能保持良好的含义和可读性。`;

const POTENTIAL_RISK_SYSTEM_PROMPT = `你是亚马逊 Listing 合规助理，任务：标记「潜在风险」表述（仅证据不足，不是明确错误）。

定义（需同时满足）：
1. {language} 文案对产品作出了**相对具体**的断言或可核查陈述（如具体尺寸、重量、材质、功率/波长、认证、固定配件清单、变体专属功能等）。
2. 「变体信息」段落中，**每个变体名称后的描述文字合并**后，仍无法找到与该断言直接对应或同义的信息。

不要标记：
- 商品梗概、规格参数、包装信息等**已在事实材料中写明**的内容（视为有据，不依赖变体描述）。
- 泛泛营销夸赞、品类常识（如 durable、professional quality），无具体可核查点时。
- 与事实**明确矛盾**的请留给另一类审核；本任务只标记「变体描述未覆盖、举证缺口」。

无此类情况时返回空列表。reason 用简短中文说明：文案断言了什么、变体描述缺哪类信息。`;

export async function runListingCopyChecks(
  llm: ChatOpenAI,
  ctx: ListingCopyCheckerContext
): Promise<{
  brand_names: Array<{ brand_name: string; reason: string }>;
  irrelevant_words: Array<{ irrelevant_word: string; reason: string }>;
  potential_risk_words: Array<{ risk_phrase: string; reason: string }>;
}> {
  const factBlock = formatCheckerFactBlock(ctx);
  const brandPrompt = ChatPromptTemplate.fromMessages([
    ['system', BRAND_SYSTEM_PROMPT],
    ['human', '文本如下：\n{text}'],
  ]);
  const brandChain = brandPrompt.pipe(
    llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          brand_names: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                brand_name: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['brand_name', 'reason'],
            },
          },
        },
        required: ['brand_names'],
      },
      {
        name: 'brand_name_list',
        method: 'functionCalling',
      } as any
    )
  );
  const irrelevantPrompt = ChatPromptTemplate.fromMessages([
    ['system', IRRELEVANT_SYSTEM_PROMPT],
    [
      'human',
      `商品事实材料：
{fact_block}

需要审核的 {language} 文案：
{text}`,
    ],
  ]);
  const irrelevantChain = irrelevantPrompt.pipe(
    llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          irrelevant_words: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                irrelevant_word: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['irrelevant_word', 'reason'],
            },
          },
        },
        required: ['irrelevant_words'],
      },
      {
        name: 'irrelevant_word_list',
        method: 'functionCalling',
      } as any
    )
  );
  const potentialRiskPrompt = ChatPromptTemplate.fromMessages([
    ['system', POTENTIAL_RISK_SYSTEM_PROMPT],
    [
      'human',
      `商品事实材料：
{fact_block}

需要审核的 {language} 文案：
{text}`,
    ],
  ]);
  const potentialRiskChain = potentialRiskPrompt.pipe(
    llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          potential_risk_words: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                risk_phrase: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['risk_phrase', 'reason'],
            },
          },
        },
        required: ['potential_risk_words'],
      },
      {
        name: 'potential_risk_word_list',
        method: 'functionCalling',
      } as any
    )
  );
  const [brand, irrelevant, potentialRaw] = await Promise.all([
    brandChain.invoke({
      language: ctx.language,
      text: ctx.reviewText,
    } as any),
    irrelevantChain.invoke({
      language: ctx.language,
      fact_block: factBlock,
      text: ctx.reviewText,
    } as any),
    potentialRiskChain.invoke({
      language: ctx.language,
      fact_block: factBlock,
      text: ctx.reviewText,
    } as any),
  ]);
  const brandAny = brand as any;
  const irrelevantAny = irrelevant as any;
  const potentialAny = potentialRaw as any;
  const filtered = filterIrrelevantWords(
    irrelevantAny?.irrelevant_words || [],
    ctx.allowedKeywords
  );
  const potential_risk_words = (
    (potentialAny?.potential_risk_words || []) as Array<{
      risk_phrase?: string;
      reason?: string;
    }>
  )
    .map((row) => ({
      risk_phrase: String(row?.risk_phrase || '').trim(),
      reason: String(row?.reason || '').trim(),
    }))
    .filter(
      (row) =>
        row.risk_phrase &&
        !isPlaceholderCheckerWord(row.risk_phrase, row.reason)
    );
  return {
    brand_names: brandAny?.brand_names || [],
    irrelevant_words: filtered,
    potential_risk_words,
  };
}
