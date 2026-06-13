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
// DR. KUZBURY CHAT — Enhanced Clinical AI
// ============================================================

/**
 * Build a live patient context snapshot from Supabase data.
 * This is prepended to each chat message so Kuzbury has real-time awareness.
 */
export async function buildPatientContext(supabase) {
    if (!supabase) return '';

    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();

        // Fetch latest vitals (most recent of each type)
        const vitalTypes = ['resting_heart_rate', 'hrv', 'blood_oxygen', 'steps', 'blood_pressure_systolic', 'blood_pressure_diastolic'];
        const vitalsPromises = vitalTypes.map(type =>
            supabase.from('vitals').select('metric_type, value, unit, recorded_at')
                .eq('metric_type', type).order('recorded_at', { ascending: false }).limit(1)
        );

        // Fetch latest body composition
        const bodyPromise = supabase.from('body_composition').select('metric_type, value, unit, recorded_at')
            .eq('metric_type', 'weight').order('recorded_at', { ascending: false }).limit(1);

        // Fetch latest lab results
        const labPromise = supabase.from('lab_results').select('metric_type, value, unit, test_date')
            .order('test_date', { ascending: false }).limit(10);

        // Fetch medication adherence (30-day)
        const adherencePromise = supabase.from('medication_log').select('medication_id, taken, log_date')
            .gte('log_date', thirtyDaysAgo.split('T')[0]);

        // Fetch medications
        const medsPromise = supabase.from('medications').select('id, drug_name, dose, frequency');

        // Fetch recent daily summaries for health score
        const summaryPromise = supabase.from('daily_summary').select('date, health_score, avg_rhr, avg_hrv')
            .order('date', { ascending: false }).limit(7);

        // Execute all in parallel
        const [vitalsResults, bodyResult, labResult, adherenceResult, medsResult, summaryResult] = await Promise.all([
            Promise.all(vitalsPromises),
            bodyPromise,
            labPromise,
            adherencePromise,
            medsPromise,
            summaryPromise
        ]);

        // Parse vitals
        const latestVitals = {};
        vitalsResults.forEach(r => {
            if (r.data && r.data.length > 0) {
                const v = r.data[0];
                latestVitals[v.metric_type] = { value: v.value, unit: v.unit, date: v.recorded_at?.split('T')[0] };
            }
        });

        // Parse weight
        const weight = bodyResult.data?.[0];

        // Parse labs
        const labs = labResult.data || [];
        const labLines = labs.map(l =>
            `${l.metric_type}: ${l.value} ${l.unit} (${l.test_date})`
        ).join('\n');

        // Calculate adherence rate
        const meds = medsResult.data || [];
        const adherenceLogs = adherenceResult.data || [];
        const totalLogs = adherenceLogs.length;
        const takenLogs = adherenceLogs.filter(l => l.taken).length;
        const adherenceRate = totalLogs > 0 ? Math.round((takenLogs / totalLogs) * 100) : null;

        // Parse health scores
        const summaries = summaryResult.data || [];
        const avgHealthScore = summaries.length > 0
            ? Math.round(summaries.reduce((sum, s) => sum + (s.health_score || 0), 0) / summaries.filter(s => s.health_score).length)
            : null;

        // Build context string
        let context = `\n[PATIENT CONTEXT — live data snapshot, do NOT repeat verbatim to patient]\n`;
        context += `Generated: ${now.toISOString().split('T')[0]}\n\n`;

        context += `LATEST VITALS:\n`;
        if (latestVitals.resting_heart_rate) context += `  Resting HR: ${latestVitals.resting_heart_rate.value} bpm (${latestVitals.resting_heart_rate.date})\n`;
        if (latestVitals.hrv) context += `  HRV (SDNN): ${latestVitals.hrv.value} ms (${latestVitals.hrv.date})\n`;
        if (latestVitals.blood_oxygen) context += `  SpO2: ${latestVitals.blood_oxygen.value}% (${latestVitals.blood_oxygen.date})\n`;
        if (latestVitals.steps) context += `  Steps (latest): ${latestVitals.steps.value} (${latestVitals.steps.date})\n`;
        if (latestVitals.blood_pressure_systolic && latestVitals.blood_pressure_diastolic) {
            context += `  BP: ${latestVitals.blood_pressure_systolic.value}/${latestVitals.blood_pressure_diastolic.value} mmHg (${latestVitals.blood_pressure_systolic.date})\n`;
            context += `  ⚠️ NOTE: Only limited BP readings on file — critical gap for post-MI patient\n`;
        } else {
            context += `  BP: No readings on file — CRITICAL GAP\n`;
        }
        if (weight) context += `  Weight: ${weight.value} ${weight.unit} (${weight.recorded_at?.split('T')[0]})\n`;

        context += `\nLATEST LAB RESULTS:\n${labLines || '  No lab results on file'}\n`;

        context += `\nMEDICATIONS:\n`;
        meds.forEach(m => { context += `  ${m.drug_name} ${m.dose} — ${m.frequency}\n`; });
        if (adherenceRate !== null) context += `  30-day adherence rate: ${adherenceRate}%\n`;

        if (avgHealthScore !== null) {
            context += `\nHEALTH SCORE: ${avgHealthScore}/100 (7-day avg)\n`;
        }

        context += `\nKNOWN DATA GAPS: BP (very few readings), HRV (may have stopped updating Jan 2026), Weight (may have stopped Feb 2025)\n`;

        return context;
    } catch (error) {
        console.error('buildPatientContext error:', error);
        return '\n[PATIENT CONTEXT: Failed to load — proceed with static knowledge only]\n';
    }
}

/**
 * Generate a proactive daily health briefing on app load.
 */
export async function generateDailyBriefing(supabase) {
    if (!genAI || !supabase) return null;

    try {
        const context = await buildPatientContext(supabase);

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: `You are Dr. Kuzbury, Shahbaz's personal AI cardiologist. Generate a brief daily health briefing (3-5 sentences max).

Based on the live patient data provided, highlight:
1. Medication adherence status (praise or nudge)
2. Any vital signs that are out of target range or trending in a concerning direction
3. Any overdue tests or data gaps the patient should address
4. One actionable recommendation for today

Tone: Warm, concise, clinically precise. Address him as "Shahbaz".
Do NOT list every metric — only call out what matters today.
Do NOT repeat raw numbers verbatim from the context — summarize meaningfully.
If data is limited, say so briefly and suggest what to track.`
        });

        const result = await model.generateContent(
            `Generate today's daily health briefing for Shahbaz.\n${context}`
        );

        return result.response.text();
    } catch (error) {
        console.error('Daily briefing generation error:', error);
        return null;
    }
}

// ============================================================
// SPRINT 3.1 — AI-GENERATED TREND INSIGHTS
// ============================================================

/**
 * Generate AI-powered clinical insights from 90-day trend data.
 * Replaces the old rule-based generateInsights() in App.jsx.
 * Saves results to health_insights table and returns the array.
 */
export async function generateAIInsights(supabase) {
    if (!genAI || !supabase) return [];

    try {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        // Fetch 90-day daily summaries
        const { data: summaries } = await supabase
            .from('daily_summary')
            .select('date, avg_rhr, avg_hrv, blood_oxygen_avg, step_count, weight_kg, health_score, active_calories')
            .gte('date', ninetyDaysAgo)
            .order('date', { ascending: true });

        // Fetch all lab results (for trend context)
        const { data: labs } = await supabase
            .from('lab_results')
            .select('test_date, metric_type, value, unit')
            .order('test_date', { ascending: false })
            .limit(30);

        // Fetch 30-day medication adherence
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { data: adherenceLogs } = await supabase
            .from('medication_log')
            .select('taken, log_date')
            .gte('log_date', thirtyDaysAgo);

        if (!summaries || summaries.length < 7) return [];

        // Summarise the data for the prompt (avoid sending raw 90 rows)
        const recent7 = summaries.slice(-7);
        const prior30 = summaries.slice(-37, -7);
        const all90 = summaries;

        const avg = (arr, key) => {
            const vals = arr.filter(s => s[key] != null).map(s => s[key]);
            return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'N/A';
        };

        const adherenceRate = adherenceLogs && adherenceLogs.length > 0
            ? Math.round((adherenceLogs.filter(l => l.taken).length / adherenceLogs.length) * 100)
            : null;

        const summaryPayload = {
            period: `${ninetyDaysAgo} to ${today}`,
            data_points: summaries.length,
            last_7_days: {
                avg_rhr: avg(recent7, 'avg_rhr'),
                avg_hrv: avg(recent7, 'avg_hrv'),
                avg_spo2: avg(recent7, 'blood_oxygen_avg'),
                avg_steps: avg(recent7, 'step_count'),
                avg_weight_kg: avg(recent7, 'weight_kg'),
                avg_health_score: avg(recent7, 'health_score'),
            },
            prior_30_days: {
                avg_rhr: avg(prior30, 'avg_rhr'),
                avg_hrv: avg(prior30, 'avg_hrv'),
                avg_spo2: avg(prior30, 'blood_oxygen_avg'),
                avg_steps: avg(prior30, 'step_count'),
                avg_weight_kg: avg(prior30, 'weight_kg'),
            },
            lab_results: labs || [],
            medication_adherence_30d: adherenceRate !== null ? `${adherenceRate}%` : 'No data',
        };

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                responseMimeType: 'application/json',
            },
            systemInstruction: `You are a clinical cardiology AI analysing health trend data for Shahbaz, 45y male with ASHD, Chronic IHD, Old MI, and Hyperlipidaemia.
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

severity guide: info = positive or neutral, warning = needs attention, alert = clinically urgent`
        });

        const result = await model.generateContent(
            `Analyse this 90-day health trend data and generate insights:\n\n${JSON.stringify(summaryPayload, null, 2)}`
        );

        let insights = JSON.parse(result.response.text());
        if (!Array.isArray(insights)) return [];

        // Validate and clean each insight
        insights = insights.map(ins => ({
            date: ins.date || today,
            category: ins.category || 'vitals',
            severity: ['info', 'warning', 'alert'].includes(ins.severity) ? ins.severity : 'info',
            title: ins.title || 'Health Insight',
            description: ins.description || '',
            metric_type: ins.metric_type || null,
        })).filter(ins => ins.title && ins.description);

        // Clear old AI-generated insights and save new ones
        if (insights.length > 0) {
            await supabase.from('health_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('health_insights').insert(insights);
        }

        return insights;
    } catch (error) {
        console.error('generateAIInsights error:', error);
        return [];
    }
}

// Full clinical system prompt for Dr. Kuzbury
const KUZBURY_SYSTEM_PROMPT = `You are Dr. Kuzbury, a senior AI Cardiologist serving as Shahbaz's personal cardiovascular health advisor.

═══ PATIENT PROFILE ═══
Name: Shahbaz | Age: 45 years | Sex: Male | DOB: 15 May 1980

═══ DIAGNOSES ═══
• Atherosclerotic Heart Disease (ASHD) of native coronary artery
• Chronic Ischaemic Heart Disease (IHD)
• Old Myocardial Infarction (OMI) — prior MI survivor
• Hyperlipidaemia

═══ CURRENT MEDICATIONS ═══
1. Rosuvastatin 40 mg daily (high-intensity statin — LDL target)
2. Bisoprolol 2.5 mg daily (beta-blocker — HR/BP control, cardioprotection)
3. Aspirin 75 mg daily (antiplatelet — secondary prevention)

═══ CLINICAL TARGETS (ESC 2024 + AHA 2025 Secondary Prevention) ═══
• LDL-C: <55 mg/dL (very high risk category)
• Blood Pressure: <130/80 mmHg
• Resting Heart Rate: 55-65 bpm (beta-blocker optimised)
• HbA1c: <5.7% (non-diabetic range — monitor metabolic risk)
• ApoB: <65 mg/dL (if available)
• Lp(a): Awareness only — no approved therapy to lower yet
• Medication Adherence: ≥95% target

═══ DRUG-SPECIFIC MONITORING ═══
Rosuvastatin 40mg:
  - Watch for: myalgia/muscle pain (CK if symptomatic), elevated ALT/AST
  - Avoid: grapefruit in excess, combination with gemfibrozil
  - Renal dose adjustment if eGFR drops
Bisoprolol 2.5mg:
  - Watch for: fatigue, cold extremities, exercise intolerance, bradycardia <50 bpm
  - Do NOT stop abruptly — taper required (rebound tachycardia risk)
  - May mask hypoglycaemia symptoms
Aspirin 75mg:
  - Watch for: GI bleeding (dark stools, epigastric pain), bruising
  - Avoid: NSAIDs (ibuprofen competes for COX-1, reduces antiplatelet effect)
  - PPI co-prescription if GI risk factors present

═══ RED FLAG MATRIX — IMMEDIATE ACTION ═══
🚨 CALL 112 (KSA) or 999 (UK) IMMEDIATELY if ANY of these:
  - Chest pain at rest, or chest pain severity ≥7/10
  - New-onset chest pain (different character from usual)
  - Chest pain with diaphoresis (sweating), nausea, or jaw/arm radiation
  - Syncope or near-syncope
  - BP >180/110 mmHg (hypertensive emergency)
  - HR <40 bpm with dizziness/lightheadedness
  - Sudden severe breathlessness at rest

⚠️ URGENT — Contact cardiologist within 24 hours:
  - Chest pain 4-6/10 with exertion, relieved by rest
  - BP consistently >150/95 on multiple readings
  - New palpitations lasting >30 minutes
  - Ankle swelling increasing over days
  - Unexplained weight gain >2 kg in 1 week (fluid retention)

═══ LIFESTYLE GUIDANCE (Post-MI Secondary Prevention) ═══
Exercise: 150 min/week moderate aerobic (brisk walking, cycling) OR 75 min vigorous
  - Always warm up 5-10 min, avoid heavy isometric strain
  - Stop if chest pain, excessive breathlessness, or dizziness
  - Target: able to talk during exercise (talk test)
Diet: Mediterranean-pattern — olive oil, fish 2x/week, vegetables, whole grains
  - Limit: saturated fat <7% calories, sodium <2g/day, refined sugar
  - Omega-3: consider if triglycerides elevated
Stress/Mental Health: Post-MI depression affects ~20% of survivors
  - Screen for: persistent low mood, loss of interest, sleep disruption
  - Cardiac rehabilitation programmes have strong evidence for both physical + psychological recovery
Sleep: 7-8 hours, screen for sleep apnoea if snoring/daytime somnolence (raises CV risk)
Alcohol: ≤14 units/week, no binge episodes
Smoking: Absolute cessation (if applicable)

═══ COMMUNICATION STYLE ═══
• Warm, professional, peer-level — speak as a senior cardiologist to an intelligent, engaged patient
• Clinically authoritative but never alarmist
• Concise: 1-3 short paragraphs max per response
• Reference specific numbers from the patient context when relevant
• Always caveat that medication changes or new treatments require his human cardiologist's approval
• If asked about something outside cardiology, briefly answer if simple, otherwise suggest the appropriate specialist
• When patient data shows gaps (missing BP, stale HRV), gently flag it as actionable
• Celebrate wins — good adherence, improving trends, consistent exercise`;

/**
 * Chat with Dr. Kuzbury persona.
 * Now accepts patientContext string to inject live data awareness.
 */
export async function chatWithKuzbury(message, history = [], patientContext = '') {
    if (!genAI) {
        console.warn("Gemini API Key missing. Returning mock Kuzbury response.");
        return "I am operating in offline mode right now, Shahbaz. I have saved your log to my episodic memory. We can review it in detail once connectivity is restored.";
    }

    try {
        const fullSystemPrompt = patientContext
            ? `${KUZBURY_SYSTEM_PROMPT}\n\n${patientContext}`
            : KUZBURY_SYSTEM_PROMPT;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: fullSystemPrompt
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
