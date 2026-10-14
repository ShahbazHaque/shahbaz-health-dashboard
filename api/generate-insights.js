/**
 * Vercel Serverless Function: /api/generate-insights
 * Generates AI-powered clinical insights from 90-day health trend data
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

const INSIGHTS_SYSTEM_PROMPT = `You are a clinical cardiology AI analysing health trend data for a 45-year-old male patient with ASHD, Chronic IHD, Old MI, and Hyperlipidaemia.

On: Rosuvastatin 40mg, Bisoprolol 2.5mg, Aspirin 75mg.
Clinical targets: LDL-C <55 mg/dL, BP <130/80, RHR 55-65 bpm, HbA1c <5.7%.
Guidelines: ESC 2024 + AHA 2025 Secondary Prevention.

Analyse the 90-day trend data provided and generate a list of 3-6 clinically meaningful insights.
Focus on: concerning trends, improvements, overdue tests, data gaps, goal attainment.
Do NOT generate trivial or obvious insights. Each must be actionable or clinically relevant.

Return a JSON array with this exact schema:
[
  {
    "date": "YYYY-MM-DD",
    "category": "vitals|labs|body|medications|lifestyle",
    "severity": "info|warning|alert",
    "title": "Short insight title (max 8 words)",
    "description": "2-3 sentence clinical explanation with context and recommendation.",
    "metric_type": "e.g. resting_heart_rate|ldl_cholesterol|hrv|weight|steps|adherence|null"
  }
]

severity guide: info = positive or neutral, warning = needs attention, alert = clinically urgent`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { summaryData } = req.body;

    if (!summaryData) {
      return res.status(400).json({ error: 'summaryData is required' });
    }

    const client = getClient();

    const completion = await client.chat.completions.create({
      model: XAI_MODELS.CHAT,
      messages: [
        { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `Analyse this 90-day health trend data and generate insights:\n\n${JSON.stringify(summaryData, null, 2)}` 
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{"insights":[]}');
    
    // Extract insights array (handle both direct array and object with insights key)
    const insights = Array.isArray(result) ? result : (result.insights || []);

    return res.status(200).json({ insights });

  } catch (error) {
    console.error('Insights generation error:', error);
    return res.status(500).json({
      error: 'Insights generation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
