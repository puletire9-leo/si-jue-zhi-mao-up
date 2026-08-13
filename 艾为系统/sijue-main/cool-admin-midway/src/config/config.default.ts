import { CoolConfig, MODETYPE } from '@cool-midway/core';
import { MidwayConfig } from '@midwayjs/core';
import * as fsStore from '@cool-midway/cache-manager-fs-hash';

export default {
  // use for cookie sign key, should change to your own and keep security
  keys: 'cool-admin for node',
  koa: {
    port: 8001,
  },
  bodyParser: {
    jsonLimit: '50mb', // 调整为50MB
    formLimit: '50mb',
  },
  // 模板渲染
  view: {
    mapping: {
      '.html': 'ejs',
    },
  },
  // 静态文件配置
  staticFile: {
    buffer: true,
  },
  // 文件上传
  upload: {
    fileSize: '200mb',
    whitelist: null,
  },
  // 缓存 可切换成其他缓存如：redis http://midwayjs.org/docs/extensions/cache
  cache: {
    store: fsStore,
    options: {
      path: 'cache',
      ttl: -1,
    },
  },
  // AI 生成图需：OpenAI 兼容 API（含 vision）
  designTaskAi: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
  },
  // AI 文案对话：多 provider 统一配置（优先 OpenAI 兼容网关，如 LiteLLM）
  aiCopyChat: {
    providers: {
      openai: {
        apiKey:
          process.env.AI_COPY_CHAT_OPENAI_API_KEY ||
          process.env.OPENAI_API_KEY ||
          '',
        baseURL:
          process.env.AI_COPY_CHAT_OPENAI_BASE_URL ||
          process.env.OPENAI_BASE_URL ||
          '',
        model: process.env.AI_COPY_CHAT_OPENAI_MODEL || 'gpt-4o-mini',
      },
      qwen: {
        apiKey:
          process.env.AI_COPY_CHAT_QWEN_API_KEY ||
          process.env.DASHSCOPE_API_KEY ||
          '',
        baseURL:
          process.env.AI_COPY_CHAT_QWEN_BASE_URL ||
          process.env.DASHSCOPE_BASE_URL ||
          'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model:
          process.env.AI_COPY_CHAT_QWEN_MODEL ||
          process.env.DASHSCOPE_MODEL ||
          'qwen-plus',
      },
      doubao: {
        apiKey:
          process.env.AI_COPY_CHAT_DOUBAO_API_KEY ||
          process.env.ARK_API_KEY ||
          '',
        baseURL:
          process.env.AI_COPY_CHAT_DOUBAO_BASE_URL ||
          process.env.ARK_BASE_URL ||
          'https://ark.cn-beijing.volces.com/api/v3',
        model:
          process.env.AI_COPY_CHAT_DOUBAO_MODEL ||
          process.env.ARK_MODEL ||
          'doubao-seed-1-6-250615',
      },
    },
    defaults: {
      provider: process.env.AI_COPY_CHAT_DEFAULT_PROVIDER || 'openai',
      temperature: Number(process.env.AI_COPY_CHAT_TEMPERATURE || 0.7),
      maxTokens: Number(process.env.AI_COPY_CHAT_MAX_TOKENS || 1200),
      historyLimit: Number(process.env.AI_COPY_CHAT_HISTORY_LIMIT || 20),
    },
  },
  // 设计任务通用调度器（BullMQ）
  designJobQueue: {
    enabled: process.env.DESIGN_JOB_QUEUE_ENABLED === '1',
    queueName: process.env.DESIGN_JOB_QUEUE_NAME || 'design-job-queue',
    boardBasePath: process.env.DESIGN_JOB_BOARD_BASE_PATH || '/ops/queue',
    boardHost: process.env.DESIGN_JOB_BOARD_HOST || '127.0.0.1',
    boardPort: Number(process.env.DESIGN_JOB_BOARD_PORT || 8011),
    boardReadonly: false,
    boardAuthEnabled: process.env.DESIGN_JOB_BOARD_AUTH_ENABLED !== '0',
    boardAuthUser: process.env.DESIGN_JOB_BOARD_AUTH_USER || 'ops',
    boardAuthPass: process.env.DESIGN_JOB_BOARD_AUTH_PASS || 'ops123456',
    concurrency: Number(process.env.DESIGN_JOB_QUEUE_CONCURRENCY || 2),
    defaultAttempts: Number(process.env.DESIGN_JOB_QUEUE_ATTEMPTS || 2),
    defaultTimeoutMs: Number(
      process.env.DESIGN_JOB_QUEUE_TIMEOUT_MS || 10 * 60 * 1000
    ),
    keepCompletedSeconds: Number(
      process.env.DESIGN_JOB_QUEUE_KEEP_COMPLETED_SECONDS || 7 * 24 * 3600
    ),
    keepFailedSeconds: Number(
      process.env.DESIGN_JOB_QUEUE_KEEP_FAILED_SECONDS || 14 * 24 * 3600
    ),
  },
  aiListingTaskQueue: {
    enabled: process.env.AI_LISTING_TASK_QUEUE_ENABLED === '1',
    queueName:
      process.env.AI_LISTING_TASK_QUEUE_NAME || 'ai-listing-task-queue',
    concurrency: Number(process.env.AI_LISTING_TASK_QUEUE_CONCURRENCY || 2),
    defaultAttempts: Number(process.env.AI_LISTING_TASK_QUEUE_ATTEMPTS || 2),
    defaultTimeoutMs: Number(
      process.env.AI_LISTING_TASK_QUEUE_TIMEOUT_MS || 10 * 60 * 1000
    ),
    keepCompletedSeconds: Number(
      process.env.AI_LISTING_TASK_QUEUE_KEEP_COMPLETED_SECONDS || 7 * 24 * 3600
    ),
    keepFailedSeconds: Number(
      process.env.AI_LISTING_TASK_QUEUE_KEEP_FAILED_SECONDS || 14 * 24 * 3600
    ),
  },
  aiListingTask: {
    maxAttempts: Number(process.env.AI_LISTING_TASK_MAX_ATTEMPTS || 3),
    backoffMs: String(
      process.env.AI_LISTING_TASK_BACKOFF_MS || '5000,15000,45000'
    )
      .split(',')
      .map(v => Number(v.trim()))
      .filter(v => Number.isFinite(v) && v > 0),
  },
  keywordResearchGo: {
    baseUrl: process.env.KEYWORD_RESEARCH_GO_BASE_URL || '',
    timeoutMs: Number(process.env.KEYWORD_RESEARCH_GO_TIMEOUT_MS || 30000),
    pollIntervalMs: Number(
      process.env.KEYWORD_RESEARCH_GO_POLL_INTERVAL_MS || 2000
    ),
  },
  langgraph: {
    baseUrl: process.env.LANGGRAPH_BASE_URL || '',
    apiKey: process.env.LANGGRAPH_API_KEY || '',
    timeoutMs: Number(process.env.LANGGRAPH_TIMEOUT_MS || 45000),
    pollIntervalMs: Number(process.env.LANGGRAPH_POLL_INTERVAL_MS || 2000),
  },
  /** LangSmith：@langchain/* 读 process.env；生产在 config.prod 启动时注入（见 config.prod.ts） */
  langsmith: {
    apiKey: process.env.LANGSMITH_API_KEY || '',
    project: process.env.LANGCHAIN_PROJECT || '',
    endpoint: process.env.LANGSMITH_ENDPOINT || '',
    tracingV2: process.env.LANGCHAIN_TRACING_V2 === 'true',
    tracing: process.env.LANGSMITH_TRACING === 'true',
  },

  /**
   * 百度翻译（图需中文案多语言）。占位：本地在 config.local.ts 覆盖（见 config.local.example.ts）；
   * Docker/生产由 compose.env → 环境变量，在 config.prod.ts 读取。
   */
  baiduFanyi: {
    appId: '',
    secret: '',
  },
  /**
   * 内网素材服务器（dufs HTTP 文件服务，通过 frps 反向接入）。
   * - internalBase     后端容器内访问的地址，例如 http://host.docker.internal:9000
   * - username/password dufs basic auth 凭据（写在 --auth 里那个）
   * - signSecret       生成给浏览器的签名 URL 用的 HMAC 密钥，**不要泄露**
   * - signExpireSeconds 签名 URL 过期时间（秒）
   */
  asset: {
    internalBase: process.env.ASSET_INTERNAL_BASE || '',
    username: process.env.ASSET_USERNAME || '',
    password: process.env.ASSET_PASSWORD || '',
    signSecret: process.env.ASSET_SIGN_SECRET || '',
    signExpireSeconds: Number(process.env.ASSET_SIGN_EXPIRE || 3600),
  },
  /** 领星 OpenAPI：createLocalSKU 等是否实际发起 HTTP 请求 */
  lingxing: {
    openApiEnabled: true,
  },
  workflow: {
    autoCandidate: {
      enabled: true,
    },
  },
  /** 钉钉企业内部应用：工作通知（个人）。凭证用环境变量，无需 CorpId */
  dingtalk: {
    enabled: process.env.DINGTALK_ENABLED !== 'false',
    appKey: process.env.DINGTALK_APP_KEY || '',
    appSecret: process.env.DINGTALK_APP_SECRET || '',
    agentId: process.env.DINGTALK_AGENT_ID || '',
    adminBaseUrl: process.env.DINGTALK_ADMIN_BASE_URL || '',
    notifyOnStartup: process.env.DINGTALK_NOTIFY_ON_STARTUP === 'true',
    reserveOperatorMobiles: (process.env.DINGTALK_RESERVE_OPERATOR_MOBILES || '')
      .split(/[,，\s]+/)
      .map(item => item.trim())
      .filter(Boolean),
  },

  cool: {
    // 启用 EPS，让后端收集并暴露 controller/entity 元数据
    eps: true,
    // cool-midway task queue redis 配置（@cool-midway/task）
    redis: {
      host: '127.0.0.1',
      port: 6379,
    },
    file: {
      // 上传模式 本地上传或云存储
      mode: MODETYPE.LOCAL,
      // 本地上传 文件地址前缀
      domain: 'http://127.0.0.1:8001',
    },
    // crud配置
    crud: {
      // 插入模式，save不会校验字段(允许传入不存在的字段)，insert会校验字段
      upsert: 'save',
      // 软删除
      softDelete: true,
    },
  } as CoolConfig,
} as MidwayConfig;
