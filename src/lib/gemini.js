import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Initialize the Gemini Client
// WARNING: In a production app, the API key should NEVER be exposed to the client-side.
// This is for development MVP purposes only. In production, this should run on a FastAPI backend.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let genAI = null;
if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
}

// 1. Define the Clinical Extraction Schema EXACTLY as architected in our blueprint
export const HealthEventSchema = {
    type: SchemaType.OBJECT,
    description: "Structured extraction of a user's voice health log.",
    properties: {
        event_category: {
            type: SchemaType.STRING,
            description: "Primary categorization of the log (symptom, diet, medication, exercise, or compound_event)."
        },
        relative_timestamp: {
            type: SchemaType.STRING,
            description: "Extracted time concept (e.g., '20 minutes ago', 'just now')."
        },
        symptom_details: {
            type: SchemaType.OBJECT,
            properties: {
                type: { type: SchemaType.STRING, description: "e.g., Angina, Palpitations, Shortness of breath" },
                severity: { type: SchemaType.STRING, description: "Mild, Moderate, Severe, or Unspecified" },
                context: { type: SchemaType.STRING, description: "What was happening during the symptom (e.g., walking, resting)" }
            }
        },
        dietary_details: {
            type: SchemaType.OBJECT,
            properties: {
                meal_description: { type: SchemaType.STRING },
                metabolic_flags: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Flags like 'High Carbohydrate', 'Refined Sugar', 'Liquid Carb', 'High Sodium', 'Heavy Meal'"
                }
            }
        }
    },
    required: ["event_category", "relative_timestamp"]
};

/**
 * Extracts structured data from raw transcriptions.
 * Uses gemini-1.5-flash for lowest latency.
 */
export async function extractVoiceLog(transcription) {
    if (!genAI) {
        console.warn("Gemini API Key missing. Falling back to mock extraction.");
        return null;
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: HealthEventSchema,
            }
        });

        const prompt = `
      You are an expert clinical extraction engine. Analyze the following transcription provided by a cardiovascular patient.
      Extract the data strictly according to the provided JSON schema.
      
      Transcription to analyze: "${transcription}"
    `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        return JSON.parse(responseText);

    } catch (error) {
        console.error("Gemini Extraction Error:", error);
        throw error;
    }
}

// ============================================================
// GEMINI VISION — Photo-based data extraction
// ============================================================

/**
 * Convert a File object to base64 string (without data URL prefix).
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1]; // Strip "data:image/...;base64,"
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Scan a medicine label/box photo → extract drug details.
 */
export async function scanMedicineLabel(imageBase64, mimeType = 'image/jpeg') {
    if (!genAI) throw new Error('Gemini API key not configured');

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            responseMimeType: 'application/json',
        }
    });

    const result = await model.generateContent([
        { inlineData: { mimeType, data: imageBase64 } },
        { text: `You are a clinical pharmacology extraction AI. Analyze this image of a medication label, box, or bottle.

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

If you cannot read the image clearly, set confidence below 0.5 and explain in extraction_notes.` }
    ]);

    return JSON.parse(result.response.text());
}

/**
 * Scan a lab results document/photo → extract test values.
 */
export async function scanLabResults(imageBase64, mimeType = 'image/jpeg') {
    if (!genAI) throw new Error('Gemini API key not configured');

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            responseMimeType: 'application/json',
        }
    });

    const result = await model.generateContent([
        { inlineData: { mimeType, data: imageBase64 } },
        { text: `You are a clinical pathology data extraction AI. Analyze this image of a laboratory report.

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

If a date is not visible, use null for test_date. Extract EVERY readable value.` }
    ]);

    return JSON.parse(result.response.text());
}

/**
 * Scan an ECG report/printout photo → extract findings.
 */
export async function scanECGReport(imageBase64, mimeType = 'image/jpeg') {
    if (!genAI) throw new Error('Gemini API key not configured');

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            responseMimeType: 'application/json',
        }
    });

    const result = await model.generateContent([
        { inlineData: { mimeType, data: imageBase64 } },
        { text: `You are a cardiology ECG interpretation AI. Analyze this ECG report or printout image.

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

Set any unavailable numeric field to null. If you cannot interpret the ECG, set confidence below 0.5.` }
    ]);

    return JSON.parse(result.response.text());
}

// ============================================================
// DR. KUZBURY CHAT
// ============================================================

/**
 * Chat with Dr. Kuzbury persona.
 */
export async function chatWithKuzbury(message, history = []) {
    if (!genAI) {
        console.warn("Gemini API Key missing. Returning mock Kuzbury response.");
        return "I am operating in offline mode right now, Shahbaz. I have saved your log to my episodic memory. We can review it in detail once connectivity is restored.";
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: `You are Dr. Kuzbury, a personal AI Cardiologist.
Your patient is Shahbaz (45y). He has ASHD of native coronary artery, chronic IHD, old myocardial infarction (OMI), and hyperlipidaemia.
Targets: LDL-C <55 mg/dL, BP <130/80 mmHg, resting HR 55-65 bpm.
Tone: Warm, professional, clinically authoritative, never alarmist. Speak as a senior cardiologist to an intelligent patient.
Provide advice, interpret his metrics/symptoms, and politely add caveats that formal clinical changes require his human cardiologist's approval.
If he mentions chest pain >7/10 or BP >180/110, immediately advise calling emergency services (112 in KSA / 999 in UK).
Keep responses concise, peer-level, and conversational (1-3 small paragraphs max).`
        });

        // Format history for Gemini chat strictly adhering to its rules.
        let formattedHistory = [];
        for (const msg of history) {
            const role = msg.role === 'user' ? 'user' : 'model';

            // Gemini history MUST start with 'user'. Skip initial model greetings.
            if (formattedHistory.length === 0 && role === 'model') {
                continue;
            }

            // Ensure alternating roles by merging adjacent messages from the same role.
            if (formattedHistory.length > 0) {
                if (formattedHistory[formattedHistory.length - 1].role === role) {
                    formattedHistory[formattedHistory.length - 1].parts[0].text += "\n" + msg.text;
                    continue;
                }
            }

            formattedHistory.push({
                role: role,
                parts: [{ text: msg.text }]
            });
        }

        // History must end with 'model' because the next interaction is a 'user' message.
        let finalMessage = message;
        if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === 'user') {
            const popped = formattedHistory.pop();
            finalMessage = popped.parts[0].text + "\n" + finalMessage;
        }

        const chat = model.startChat({
            history: formattedHistory,
            generationConfig: {
                maxOutputTokens: 500,
            },
        });

        const result = await chat.sendMessage(finalMessage);
        return result.response.text();
    } catch (error) {
        console.error("Kuzbury Chat Error:", error);
        throw error;
    }
}
