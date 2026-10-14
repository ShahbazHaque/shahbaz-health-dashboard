/**
 * Vercel Serverless Function: /api/scan-vision
 * Processes images (medicine labels, lab results, ECG reports) using xAI Grok Vision
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

const PROMPTS = {
  medicine: `You are a clinical pharmacology extraction AI. Analyze this image of a medication label, box, or bottle.

Extract ALL visible information and return strict JSON:
{
  "drug_name": "generic name (brand name if visible)",
  "dose": "e.g. 40mg",
  "frequency": "e.g. Once daily",
  "drug_class": "e.g. Statin, Beta-blocker, Antiplatelet",
  "route": "oral|IV|IM|SC|topical|inhaled",
  "target": "clinical target if inferrable, e.g. LDL-C <55 mg/dL",
  "expiration_date": "YYYY-MM or null",
  "manufacturer": "if visible or null",
  "confidence": 0.0-1.0,
  "extraction_notes": "any issues with image quality or partial reads"
}

If you cannot read the image clearly, set confidence below 0.5 and explain in extraction_notes.`,

  lab: `You are a clinical pathology data extraction AI. Analyze this image of a laboratory report.

Extract ALL numerical lab values visible. Use these standardized metric_type names:
ldl_cholesterol, hdl_cholesterol, total_cholesterol, triglycerides, hba1c, glucose,
apob, lpa, creatinine, egfr, alt, ast, crp, tsh, vitamin_d, iron, ferritin,
systolic_bp, diastolic_bp, white_blood_cells, hemoglobin, platelets

Return strict JSON:
{
  "test_date": "YYYY-MM-DD (from report header/date stamp)",
  "lab_name": "facility name if visible or null",
  "results": [
    { "metric_type": "ldl_cholesterol", "value": 48, "unit": "mg/dL", "reference_range": "<100 mg/dL", "flag": "normal|high|low|critical" }
  ],
  "confidence": 0.0-1.0,
  "extraction_notes": "any issues"
}

If a date is not visible, use null for test_date. Extract EVERY readable value.`,

  ecg: `You are a cardiology ECG interpretation AI. Analyze this ECG report or printout image.

The patient is a 45-year-old male with ASHD of native coronary artery, chronic IHD, old myocardial infarction (OMI), and hyperlipidaemia. On Rosuvastatin 40mg, Bisoprolol 2.5mg, Aspirin 75mg.

Extract ALL available information and return strict JSON:
{
  "interpretation": "e.g. Normal sinus rhythm, ST elevation in leads II/III/aVF",
  "heart_rate": 68,
  "pr_interval": 160,
  "qrs_duration": 88,
  "qtc_interval": 420,
  "axis_degrees": 45,
  "rhythm": "e.g. Sinus rhythm, Atrial fibrillation",
  "abnormalities": ["list", "of", "findings"],
  "recommendations": "clinical notes if present",
  "test_datetime": "YYYY-MM-DDTHH:MM:SS or just YYYY-MM-DD if time not visible",
  "confidence": 0.0-1.0,
  "extraction_notes": "any issues with image quality"
}

Set any unavailable numeric field to null. If you cannot interpret the ECG, set confidence below 0.5.`
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg', scanType } = req.body;

    if (!imageBase64 || !scanType) {
      return res.status(400).json({ error: 'imageBase64 and scanType are required' });
    }

    if (!PROMPTS[scanType]) {
      return res.status(400).json({ error: 'Invalid scanType. Must be: medicine, lab, or ecg' });
    }

    const client = getClient();

    // Use grok-2-vision-1212 for vision tasks
    const completion = await client.chat.completions.create({
      model: 'grok-2-vision-1212',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPTS[scanType] },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const extractedData = JSON.parse(completion.choices[0]?.message?.content || '{}');

    return res.status(200).json(extractedData);

  } catch (error) {
    console.error('Vision scan error:', error);
    return res.status(500).json({
      error: 'Vision processing failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
