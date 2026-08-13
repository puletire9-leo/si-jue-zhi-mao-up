import { CoolConfig } from '@cool-midway/core';
import { MidwayConfig } from '@midwayjs/core';

/**
 * 生产环境配置。Docker 部署时通过环境变量覆盖：
 * MYSQL_HOST、MYSQL_PORT、MYSQL_USER、MYSQL_PASSWORD、MYSQL_DATABASE、
 * REDIS_HOST、REDIS_PORT、FILE_DOMAIN 以及 AI 相关：
 * OPENAI_API_KEY、OPENAI_BASE_URL、OPENAI_VISION_MODEL、
 * AI_COPY_CHAT_OPENAI_API_KEY、AI_COPY_CHAT_OPENAI_BASE_URL、AI_COPY_CHAT_OPENAI_MODEL、
 * AI_COPY_CHAT_QWEN_API_KEY、AI_COPY_CHAT_QWEN_BASE_URL、AI_COPY_CHAT_QWEN_MODEL、
 * AI_COPY_CHAT_DOUBAO_API_KEY、AI_COPY_CHAT_DOUBAO_BASE_URL、AI_COPY_CHAT_DOUBAO_MODEL、
 * AI_COPY_CHAT_DEFAULT_PROVIDER、AI_COPY_CHAT_TEMPERATURE、AI_COPY_CHAT_MAX_TOKENS、AI_COPY_CHAT_HISTORY_LIMIT、
 * BAIDU_FANYI_APP_ID、BAIDU_FANYI_SECRET（图需自动翻译）、
 * WORKFLOW_AUTO_CANDIDATE_ENABLED（选品自动流水线开关）、
 * LINGXING_OPENAPI_ENABLED（是否调用领星 OpenAPI，默认 true）、
 * DESIGN_JOB_QUEUE_ENABLED、DESIGN_JOB_QUEUE_NAME、DESIGN_JOB_QUEUE_CONCURRENCY、
 * DESIGN_JOB_QUEUE_ATTEMPTS、DESIGN_JOB_QUEUE_TIMEOUT_MS、
 * DESIGN_JOB_QUEUE_KEEP_COMPLETED_SECONDS、DESIGN_JOB_QUEUE_KEEP_FAILED_SECONDS、
 * DESIGN_JOB_BOARD_BASE_PATH、DESIGN_JOB_BOARD_HOST、DESIGN_JOB_BOARD_PORT、
 * DESIGN_JOB_BOARD_AUTH_ENABLED、DESIGN_JOB_BOARD_AUTH_USER、DESIGN_JOB_BOARD_AUTH_PASS、
 * AI_LISTING_TASK_QUEUE_ENABLED、AI_LISTING_TASK_QUEUE_NAME、AI_LISTING_TASK_QUEUE_CONCURRENCY、
 * AI_LISTING_TASK_QUEUE_ATTEMPTS、AI_LISTING_TASK_QUEUE_TIMEOUT_MS、
 * AI_LISTING_TASK_QUEUE_KEEP_COMPLETED_SECONDS、AI_LISTING_TASK_QUEUE_KEEP_FAILED_SECONDS、
 * AI_LISTING_TASK_MAX_ATTEMPTS、AI_LISTING_TASK_BACKOFF_MS、
 * KEYWORD_RESEARCH_GO_BASE_URL、KEYWORD_RESEARCH_GO_TIMEOUT_MS、KEYWORD_RESEARCH_GO_POLL_INTERVAL_MS、
 * LANGGRAPH_BASE_URL、LANGGRAPH_API_KEY、LANGGRAPH_TIMEOUT_MS、LANGGRAPH_POLL_INTERVAL_MS（遗留外部 LangGraph，主路径已内化）、
 * LANGSMITH_API_KEY、LANGCHAIN_PROJECT、LANGCHAIN_TRACING_V2、LANGSMITH_TRACING、LANGSMITH_ENDPOINT、
 * ASSET_INTERNAL_BASE、ASSET_USERNAME、ASSET_PASSWORD、ASSET_SIGN_SECRET、ASSET_SIGN_EXPIRE
 */

// LangSmith tracing（生产：密钥走 compose.env → LANGSMITH_API_KEY，勿在代码里写死）
// 与 config.local 相同：@langchain/* 运行时读 process.env；未配置 API Key 则不开启 trace
if (process.env.LANGSMITH_API_KEY) {
  if (!process.env.LANGCHAIN_PROJECT) {
    process.env.LANGCHAIN_PROJECT =
      String(process.env.LANGSMITH_PROJECT || '').trim() || 'woeau-prod';
  }
  if (!process.env.LANGCHAIN_TRACING_V2) {
    process.env.LANGCHAIN_TRACING_V2 = 'true';
  }
  // 新版 LangSmith 变量，和 LANGCHAIN_TRACING_V2 同时设置更稳
  if (!process.env.LANGSMITH_TRACING) {
    process.env.LANGSMITH_TRACING = 'true';
  }
}

export default {
  typeorm: {
    dataSource: {
      default: {
        type: 'mysql',
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        username: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || 'psw4mysql_optimiser',
        database: process.env.MYSQL_DATABASE || 'listing_optimiser',
        // 自动建表 注意：线上部署的时候不要使用，有可能导致数据丢失
        synchronize: false,
        // 启动时不自动执行 migration（需手动执行）
        migrationsRun: false,
        // 启动时不清空 schema
        dropSchema: false,
        // 打印日志
        logging: false,
        eps: true,
        // 字符集
        charset: 'utf8mb4',
        // 是否开启缓存
        cache: true,
        /* 实体路径：和开发环境不同，生产环境运行的是编译后的 js 文件，而不是 ts 文件，这里无需修改 */
        entities: ['**/modules/*/entity'],
        /* 表结构同步：注意这里前缀不要使用 **，否则也会匹配到 src 目录下的 migration */
        migrations: ['dist/migration/*'],
      },
    },
  },
  // AI 生成图需：OpenAI 兼容 API（含 vision），全部从环境变量读取
  designTaskAi: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    model: process.env.OPENAI_VISION_MODEL || 'gpt-5-mini',
  },
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
        model: process.env.AI_COPY_CHAT_OPENAI_MODEL || 'gpt-5-mini',
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
  designJobQueue: {
    enabled: process.env.DESIGN_JOB_QUEUE_ENABLED === '1',
    queueName: process.env.DESIGN_JOB_QUEUE_NAME || 'design-job-queue',
    boardBasePath: process.env.DESIGN_JOB_BOARD_BASE_PATH || '/ops/queue',
    boardHost: process.env.DESIGN_JOB_BOARD_HOST || '0.0.0.0',
    boardPort: Number(process.env.DESIGN_JOB_BOARD_PORT || 8011),
    boardReadonly: false,
    boardAuthEnabled: process.env.DESIGN_JOB_BOARD_AUTH_ENABLED !== '0',
    boardAuthUser: process.env.DESIGN_JOB_BOARD_AUTH_USER || '',
    boardAuthPass: process.env.DESIGN_JOB_BOARD_AUTH_PASS || '',
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
  langsmith: {
    apiKey: process.env.LANGSMITH_API_KEY || '',
    project: process.env.LANGCHAIN_PROJECT || '',
    endpoint: process.env.LANGSMITH_ENDPOINT || '',
    tracingV2: process.env.LANGCHAIN_TRACING_V2 === 'true',
    tracing: process.env.LANGSMITH_TRACING === 'true',
  },
  baiduFanyi: {
    appId: process.env.BAIDU_FANYI_APP_ID || '',
    secret: process.env.BAIDU_FANYI_SECRET || '',
  },
  asset: {
    internalBase: process.env.ASSET_INTERNAL_BASE || '',
    username: process.env.ASSET_USERNAME || '',
    password: process.env.ASSET_PASSWORD || '',
    signSecret: process.env.ASSET_SIGN_SECRET || '',
    signExpireSeconds: Number(process.env.ASSET_SIGN_EXPIRE || 3600),
  },
  lingxing: {
    openApiEnabled: process.env.LINGXING_OPENAPI_ENABLED !== 'false',
  },
  workflow: {
    autoCandidate: {
      enabled: process.env.WORKFLOW_AUTO_CANDIDATE_ENABLED !== 'false',
    },
  },
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
    eps: true,
    initDB: false,
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    file: {
      domain: process.env.FILE_DOMAIN || '',
    },
  } as CoolConfig,
} as MidwayConfig;
