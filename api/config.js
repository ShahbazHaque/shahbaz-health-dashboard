/**
 * xAI Grok API Configuration
 * Current models as of Dec 2024
 * See: https://docs.x.ai/docs/models
 */

export const XAI_MODELS = {
  // Chat model - use for text generation, chat, insights
  // grok-4.7 supports both text and vision (jpg/png image input)
  CHAT: 'grok-4.7',
  
  // Vision model - grok-4.7 handles vision too (jpg/png image input)
  VISION: 'grok-4.7',
};

export const XAI_CONFIG = {
  baseURL: 'https://api.x.ai/v1',
  defaultTemperature: 0.7,
  defaultMaxTokens: 500,
};
