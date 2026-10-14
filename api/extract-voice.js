/**
 * Vercel Serverless Function: /api/extract-voice
 * Extracts structured health data from voice transcription using xAI Grok
 */

import OpenAI from 'openai';
import { XAI_MODELS, XAI_CONFIG } from './config.js';

const getClient = () => {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required');
  }
  
  return new OpenAI({
    apiKey,
    baseURL: XAI_CONFIG.baseURL
  });
};

const HEALTH_EVENT_SCHEMA = `{
  "event_category": "symptom|diet|medication|exercise|compound_event",
  "relative_timestamp": "e.g., '20 minutes ago', 'just now'",
  "symptom_details": {
    "type": "e.g., Angina, Palpitations, Shortness of breath",
    "severity": "Mild|Moderate|Severe|Unspecified",
    "context": "What was happening during the symptom (e.g., walking, resting)"
  },
  "dietary_details": {
    "meal_description": "string",
    "metabolic_flags": ["High Carbohydrate", "Refined Sugar", "Liquid Carb", "High Sodium", "Heavy Meal"]
  }
}`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transcription } = req.body;

    if (!transcription) {
      return res.status(400).json({ error: 'Transcription is required' });
    }

    const client = getClient();

    const systemPrompt = `You are an expert clinical extraction engine. Analyze transcriptions from a cardiovascular patient and extract structured data according to this JSON schema:

${HEALTH_EVENT_SCHEMA}

Return ONLY valid JSON matching this schema. Extract all relevant information from the transcription.`;

    const completion = await client.chat.completions.create({
      model: XAI_MODELS.CHAT,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this transcription: "${transcription}"` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const extractedData = JSON.parse(completion.choices[0]?.message?.content || '{}');

    return res.status(200).json(extractedData);

  } catch (error) {
    console.error('Voice extraction error:', error);
    return res.status(500).json({
      error: 'Extraction failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
