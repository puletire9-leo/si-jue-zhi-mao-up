import { ChatOpenAI } from '@langchain/openai';

type UserConfig = {
  model_name: string;
  model_key: string;
  model_base: string;
};

function getUserConfig(username: string): UserConfig {
  const prefix = `AI_LISTING_USER_${String(username || 'default').toUpperCase()}`;
  return {
    // 临时统一：AIListing 优先复用 designTaskAi 所对应的 OPENAI_* 配置
    model_name:
      process.env[`${prefix}_MODEL_NAME`] ||
      process.env.OPENAI_VISION_MODEL ||
      process.env.MODEL_NAME ||
      'gpt-4o',
    model_key:
      process.env[`${prefix}_MODEL_KEY`] ||
      process.env.OPENAI_API_KEY ||
      '',
    model_base:
      process.env[`${prefix}_MODEL_BASE`] ||
      process.env.OPENAI_BASE_URL ||
      process.env.OPENAI_API_BASE ||
      '',
  };
}

export function getLlmByUser(username: string) {
  const userConfig = getUserConfig(username);
  return new ChatOpenAI({
    model: userConfig.model_name,
    apiKey: userConfig.model_key,
    configuration: userConfig.model_base
      ? {
          baseURL: userConfig.model_base,
        }
      : undefined,
  });
}

