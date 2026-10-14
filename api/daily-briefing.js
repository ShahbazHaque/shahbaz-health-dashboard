/**
 * Vercel Serverless Function: /api/daily-briefing
 * Generates daily health briefing using xAI Grok
 */

import OpenAI from 'openai';

const getClient = () => {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required');
  }
  
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1'
  });
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { patientContext, greeting, localTimeStr } = req.body;

    if (!patientContext || !greeting || !localTimeStr) {
      return res.status(400).json({ error: 'patientContext, greeting, and localTimeStr are required' });
    }

    const client = getClient();

    const systemPrompt = `You are Dr. Kuzbury, the patient's personal AI cardiologist. Generate a brief daily health briefing (3-5 sentences max).

Based on the live patient data provided, highlight:
1. Medication adherence status (praise or nudge)
2. Any vital signs that are out of target range or trending in a concerning direction
3. Any overdue tests or data gaps the patient should address
4. One actionable recommendation for today

Tone: Warm, concise, clinically precise. Address the patient directly.
IMPORTANT: The current local time is ${localTimeStr}. You MUST greet with "${greeting}". Do NOT say "Good morning" if the local time is in the afternoon or evening.
Do NOT list every metric — only call out what matters today.
Do NOT repeat raw numbers verbatim from the context — summarize meaningfully.
If data is limited, say so briefly and suggest what to track.`;

    const completion = await client.chat.completions.create({
      model: 'grok-2-1212',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate today's health briefing. Current local time is ${localTimeStr} (${greeting}).\n${patientContext}` }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const briefing = completion.choices[0]?.message?.content || 'Unable to generate briefing at this time.';

    return res.status(200).json({ briefing });

  } catch (error) {
    console.error('Daily briefing error:', error);
    return res.status(500).json({
      error: 'Briefing generation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
