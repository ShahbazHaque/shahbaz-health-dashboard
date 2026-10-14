/**
 * xAI Grok API Configuration
 * Current models as of Dec 2024
 * See: https://docs.x.ai/docs/models
 */

export const XAI_MODELS = {
  // Chat model - use for text generation, chat, insights
  CHAT: 'grok-beta',
  
  // Vision model - use for image analysis (medicine labels, lab reports, ECG)
  VISION: 'grok-vision-beta',
};

export const XAI_CONFIG = {
  baseURL: 'https://api.x.ai/v1',
  defaultTemperature: 0.7,
  defaultMaxTokens: 500,
};
