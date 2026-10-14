/**
 * Vercel Serverless Function: /api/chat
 * Handles Dr. Kuzbury chat requests using xAI Grok API
 */

import OpenAI from 'openai';

// Initialize xAI Grok client with OpenAI-compatible endpoint
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

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history = [], systemPrompt, patientContext = '' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const client = getClient();

    // Build full system prompt with patient context
    const fullSystemPrompt = patientContext
      ? `${systemPrompt}\n\n${patientContext}`
      : systemPrompt;

    // Format history for OpenAI-compatible API
    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.text
      })),
      { role: 'user', content: message }
    ];

    // Call Grok API (using grok-2-vision-1212 for general chat)
    const completion = await client.chat.completions.create({
      model: 'grok-2-1212',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Grok API error:', error);
    
    // Return a safe error message (no hallucinated medical advice)
    return res.status(500).json({
      error: 'AI service temporarily unavailable. Please try again in a moment.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
