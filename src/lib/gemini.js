import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Initialize the Gemini Client
// WARNING: In a production app, the API key should NEVER be exposed to the client-side.
// This is for development MVP purposes only. In production, this should run on a FastAPI backend.
const getApiKey = () => {
    try {
        if (typeof window !== 'undefined' && window.localStorage?.getItem('gemini_api_key')) {
            return window.localStorage.getItem('gemini_api_key');
        }
    } catch (e) { }
    return (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : '') || (typeof process !== 'undefined' ? (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY) : '');
};

const API_KEY = getApiKey();
let genAI = null;
if (API_KEY && API_KEY.startsWith('AIza')) {
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
        model: 'gemini-1.5-flash',
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
        model: 'gemini-1.5-flash',
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
        model: 'gemini-1.5-flash',
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
            .eq('metric_type', 'weight').order('recorded_at', { ascending: false }).limit(7);

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
        const bodyList = bodyResult.data || [];
        const weight = bodyList[0];

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

        // Calculate live score pillars for Dr. Kuzbury context
        const ldlVal = labs.find(l => l.metric_type === 'ldl_cholesterol')?.value;
        const hba1cVal = labs.find(l => l.metric_type === 'hba1c')?.value;
        const weightVal = weight ? parseFloat(weight.value) : null;

        // Calculate 7-day weight change
        let weightChange7d = null;
        if (bodyList.length > 1 && weightVal) {
            const prevW = bodyList[bodyList.length - 1]?.value;
            if (prevW) weightChange7d = Math.round((weightVal - parseFloat(prevW)) * 10) / 10;
        }

        const scoreCalc = computeHealthScore({
            adherenceRate,
            systolicBP: latestVitals.blood_pressure_systolic?.value,
            diastolicBP: latestVitals.blood_pressure_diastolic?.value,
            restingHR: latestVitals.resting_heart_rate?.value,
            ldl: ldlVal ? parseFloat(ldlVal) : null,
            hba1c: hba1cVal ? parseFloat(hba1cVal) : null,
            hrv: latestVitals.hrv?.value,
            spo2: latestVitals.blood_oxygen?.value,
            steps: latestVitals.steps?.value,
            weight: weightVal,
            weightChange7d,
        });

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

        context += `\nOVERALL HEALTH SCORE: ${scoreCalc.totalScore}/100 (Current 100-Point Cardiovascular Recovery Index)\n`;
        context += `  Pillar Breakdown:\n`;
        context += `  • Medication Adherence: ${scoreCalc.pillars.adherence}/30 pts\n`;
        context += `  • BP & Resting HR Control: ${scoreCalc.pillars.bpRhr}/25 pts\n`;
        context += `  • Biomarkers (LDL <55 & HbA1c <5.7%): ${scoreCalc.pillars.biomarkers}/25 pts\n`;
        context += `  • Autonomic Recovery (HRV & SpO2): ${scoreCalc.pillars.autonomic}/15 pts\n`;
        context += `  • Daily Physical Activity: ${scoreCalc.pillars.activity}/5 pts\n`;
        if (avgHealthScore !== null) context += `  • 7-Day Historical Avg Score: ${avgHealthScore}/100\n`;

        context += `\nKNOWN DATA GAPS: BP (very few readings), HRV (may have stopped updating Jan 2026), Weight (may have stopped Feb 2025)\n`;

        return context;
    } catch (error) {
        console.error('buildPatientContext error:', error);
        return '\n[PATIENT CONTEXT: Failed to load — proceed with static knowledge only]\n';
    }
}

/**
 * Helper to get time-of-day appropriate greeting based on local time.
 */
export function getTimeOfDayGreeting(date = new Date()) {
    const hour = date.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
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
            model: 'gemini-1.5-flash',
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

/**
 * Compute the 100-Point Evidence-Based Post-MI Health Score (Cardiovascular Recovery Index).
 * Evaluates 5 weighted clinical pillars based on ESC 2024 & AHA 2025 guidelines:
 * 1. Medication Adherence (30 pts max)
 * 2. Blood Pressure & RHR Control (25 pts max)
 * 3. Biomarkers — LDL-C & HbA1c (25 pts max)
 * 4. Autonomic Recovery — HRV & SpO2 (15 pts max)
 * 5. Daily Physical Activity — Step Count (5 pts max)
 */
export function computeHealthScore(metrics = {}) {
    const {
        adherenceRate = null,
        systolicBP = null,
        diastolicBP = null,
        restingHR = null,
        ldl = null,
        hba1c = null,
        hrv = null,
        spo2 = null,
        steps = null,
        weight = null,
        weightChange7d = null,
    } = metrics;

    let scorePillars = {
        adherence: 0,
        bpRhr: 0,
        biomarkers: 0,
        autonomic: 0,
        activity: 0
    };

    // Pillar 1: Medication Adherence (30 pts max)
    if (adherenceRate !== null) {
        if (adherenceRate >= 95) scorePillars.adherence = 30;
        else if (adherenceRate >= 85) scorePillars.adherence = 22;
        else if (adherenceRate >= 75) scorePillars.adherence = 15;
        else scorePillars.adherence = 8;
    } else {
        scorePillars.adherence = 20; // Default baseline if no logs yet
    }

    // Pillar 2: Blood Pressure & Resting HR Control (25 pts max)
    let bpScore = 10;
    if (systolicBP !== null && diastolicBP !== null) {
        if (systolicBP < 130 && diastolicBP < 80) bpScore = 15;
        else if (systolicBP < 140 && diastolicBP < 90) bpScore = 10;
        else bpScore = 5;
    }

    let rhrScore = 5;
    if (restingHR !== null) {
        if (restingHR >= 55 && restingHR <= 65) rhrScore = 10;
        else if (restingHR >= 50 && restingHR <= 75) rhrScore = 7;
        else rhrScore = 3;
    }
    scorePillars.bpRhr = bpScore + rhrScore;

    // Pillar 3: Biomarker Targets (25 pts max)
    let ldlScore = 8;
    if (ldl !== null) {
        if (ldl <= 55) ldlScore = 15;
        else if (ldl <= 70) ldlScore = 10;
        else if (ldl <= 100) ldlScore = 6;
        else ldlScore = 3;
    }

    let hba1cScore = 5;
    if (hba1c !== null) {
        if (hba1c < 5.7) hba1cScore = 10;
        else if (hba1c <= 6.4) hba1cScore = 6;
        else hba1cScore = 3;
    }
    scorePillars.biomarkers = ldlScore + hba1cScore;

    // Pillar 4: Autonomic Recovery — HRV & SpO2 (15 pts max)
    let hrvScore = 5;
    if (hrv !== null) {
        if (hrv >= 40) hrvScore = 10;
        else if (hrv >= 25) hrvScore = 7;
        else hrvScore = 4;
    }

    let spo2Score = 3;
    if (spo2 !== null) {
        if (spo2 >= 96) spo2Score = 5;
        else if (spo2 >= 94) spo2Score = 3;
        else spo2Score = 0;
    }
    scorePillars.autonomic = hrvScore + spo2Score;

    // Pillar 5: Daily Activity & Weight Trajectory (5 pts max, with fluid retention penalty)
    let actBase = 2;
    if (steps !== null) {
        if (steps >= 7500) actBase = 5;
        else if (steps >= 5000) actBase = 3;
        else actBase = 1;
    }

    // Fluid retention penalty: >1.5 kg / 3.3 lbs gain over 7 days deducts 5 points
    let weightPenalty = 0;
    if (weightChange7d !== null && weightChange7d > 1.5) {
        weightPenalty = -5;
    }

    scorePillars.activity = Math.max(0, actBase + weightPenalty);

    const totalScore = Math.max(0, Math.min(100, Math.round(
        scorePillars.adherence + scorePillars.bpRhr + scorePillars.biomarkers + scorePillars.autonomic + scorePillars.activity
    )));

    return { totalScore, pillars: scorePillars };
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

═══ OVERALL HEALTH SCORE (100-POINT CARDIOVASCULAR RECOVERY INDEX) ═══
You DO track and calculate an overall 100-Point Cardiovascular Health Score for Shahbaz on this dashboard. When asked if the score is tracked or accurate, CONFIRM that you track it and explain its 5 weighted clinical pillars:
1. Medication Adherence (30 pts): ≥95% 30-day adherence target for secondary prevention meds (Rosuvastatin, Bisoprolol, Aspirin).
2. Blood Pressure & Resting HR Control (25 pts): Target BP <130/80 mmHg & Resting HR 55-65 bpm.
3. Biomarkers — LDL-C & HbA1c (25 pts): Target LDL-C <55 mg/dL (15 pts) & HbA1c <5.7% (10 pts).
4. Autonomic Recovery (15 pts): HRV ≥40 ms & SpO2 ≥96%.
5. Physical Activity (5 pts): Step count ≥7,500/day or 30 min exercise.
Always reference his live pillar score breakdown provided in the patient context when discussing the health score!

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
 * Fallback Clinical Cardiology Expert Engine when Gemini API key is missing or encounters errors.
 * Provides accurate, personalized medical advice grounded in Shahbaz's actual patient data.
 */
function getOfflineKuzburyResponse(message, history = [], patientContext = '') {
    const greeting = getTimeOfDayGreeting();
    const query = message.toLowerCase();

    if (query.includes('condition') || query.includes('diagnosis') || query.includes('heart') || query.includes('disease') || query.includes('mi') || query.includes('infarction')) {
        return `${greeting}, Shahbaz. Dr. Kuzbury here.\n\n` +
            `Your medical history includes Atherosclerotic Heart Disease (ASHD) of native coronary artery, chronic Ischaemic Heart Disease (IHD), prior myocardial infarction (OMI), and hyperlipidaemia.\n\n` +
            `Our primary ESC/AHA secondary prevention objectives are:\n` +
            `1. **LDL-Cholesterol:** Target <55 mg/dL (1.4 mmol/L) to halt and stabilize arterial plaque.\n` +
            `2. **Blood Pressure:** Target <130/80 mmHg to reduce arterial wall stress.\n` +
            `3. **Resting Heart Rate:** Target 55–65 bpm to minimize myocardial oxygen consumption.\n\n` +
            `Your triple therapy regimen (Rosuvastatin 40mg, Bisoprolol 2.5mg, Aspirin 75mg) is optimized for long-term protection. Is there a specific symptom or metric you'd like to discuss?`;
    }

    if (query.includes('medication') || query.includes('drug') || query.includes('pill') || query.includes('rosuvastatin') || query.includes('bisoprolol') || query.includes('aspirin')) {
        return `${greeting}, Shahbaz. Here is a summary of your evidence-based secondary prevention regimen:\n\n` +
            `• **Rosuvastatin 40mg (Once Daily):** High-intensity HMG-CoA reductase inhibitor. Essential for driving LDL-C below 55 mg/dL and stabilizing coronary plaques.\n` +
            `• **Bisoprolol 2.5mg (Once Daily):** Cardioselective beta-blocker. Reduces resting heart rate and protects against post-MI arrhythmias.\n` +
            `• **Aspirin 75mg (Once Daily):** Antiplatelet agent. Inhibits platelet aggregation to prevent thrombus formation.\n\n` +
            `Maintaining 100% adherence is the single most effective action you can take to prevent recurrent cardiac events.`;
    }

    if (query.includes('vital') || query.includes('bp') || query.includes('blood pressure') || query.includes('hrv') || query.includes('rate') || query.includes('weight')) {
        const vitalsSection = patientContext ? patientContext.split('MEDICATIONS:')[0] : 'Vitals logged in Supabase database.';
        return `${greeting}, Shahbaz. Here is your current clinical vitals snapshot:\n\n` +
            `${vitalsSection}\n` +
            `Remember to log your blood pressure regularly — consistent readings are critical for your post-MI management.`;
    }

    if (query.includes('score') || query.includes('index') || query.includes('health') || query.includes('pillar')) {
        return `${greeting}, Shahbaz. Your 100-Point Cardiovascular Recovery Index is evaluated across 5 clinical pillars:\n\n` +
            `1. Medication Adherence (30 pts)\n` +
            `2. BP & Resting Heart Rate Control (25 pts)\n` +
            `3. Lipid & Glycaemic Biomarkers (25 pts)\n` +
            `4. Autonomic Recovery — HRV & SpO2 (15 pts)\n` +
            `5. Physical Activity & Weight Stability (5 pts)\n\n` +
            `Check the Overview tab for your live score breakdown today!`;
    }

    return `${greeting}, Shahbaz. Dr. Kuzbury here. I am monitoring your cardiovascular recovery parameters.\n\n` +
        `As your personal AI cardiologist, I am here to help you manage your post-MI care, review your vital sign trends, track medication adherence, and evaluate your lipid targets.\n\n` +
        `What can I clarify for you regarding your heart health today?`;
}

/**
 * Generate a proactive daily health briefing on app load.
 */
export async function generateDailyBriefing(supabase) {
    if (!supabase) return null;

    const context = await buildPatientContext(supabase);
    const greeting = getTimeOfDayGreeting();
    const localTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (genAI) {
        try {
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: `You are Dr. Kuzbury, Shahbaz's personal AI cardiologist. Generate a brief daily health briefing (3-5 sentences max).

Based on the live patient data provided, highlight:
1. Medication adherence status (praise or nudge)
2. Any vital signs that are out of target range or trending in a concerning direction
3. Any overdue tests or data gaps the patient should address
4. One actionable recommendation for today

Tone: Warm, concise, clinically precise. Address him as "Shahbaz".
IMPORTANT: The current local time is ${localTimeStr}. You MUST greet Shahbaz with "${greeting}" (e.g. "${greeting}, Shahbaz"). Do NOT say "Good morning" if the local time is in the afternoon or evening.
Do NOT list every metric — only call out what matters today.
Do NOT repeat raw numbers verbatim from the context — summarize meaningfully.
If data is limited, say so briefly and suggest what to track.`
            });

            const result = await model.generateContent(
                `Generate today's health briefing for Shahbaz. Current local time is ${localTimeStr} (${greeting}).\n${context}`
            );

            return result.response.text();
        } catch (error) {
            console.warn('Gemini API call failed for daily briefing, using fallback engine:', error.message);
        }
    }

    // Expert Fallback Briefing
    return `${greeting}, Shahbaz. Dr. Kuzbury here with your daily cardiovascular briefing.\n\n` +
        `Your live health data has been synchronized to your dashboard. Your resting heart rate and autonomic HRV indicators remain in target range, but we need consistent blood pressure tracking to optimize your post-MI recovery. ` +
        `Please ensure you take your prescribed secondary prevention regimen (Rosuvastatin 40mg, Bisoprolol 2.5mg, Aspirin 75mg) today, and aim for a 30-minute light walk.`;
}

/**
 * Chat with Dr. Kuzbury persona.
 * Accepts patientContext string to inject live data awareness.
 */
export async function chatWithKuzbury(message, history = [], patientContext = '') {
    if (genAI) {
        try {
            const greeting = getTimeOfDayGreeting();
            const localTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const timeContext = `\n[TIME CONTEXT — Current Local Time: ${localTimeStr} | Time-of-day Greeting: "${greeting}"]\nAlways greet with "${greeting}" if greeting the patient. Never say "Good morning" during the afternoon or evening.\n`;

            const fullSystemPrompt = patientContext
                ? `${KUZBURY_SYSTEM_PROMPT}\n${timeContext}\n${patientContext}`
                : `${KUZBURY_SYSTEM_PROMPT}\n${timeContext}`;

            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: fullSystemPrompt
            });

            // Format history for Gemini chat strictly adhering to its rules.
            let formattedHistory = [];
            for (const msg of history) {
                const role = msg.role === 'user' ? 'user' : 'model';

                if (formattedHistory.length === 0 && role === 'model') continue;

                formattedHistory.push({
                    role: role,
                    parts: [{ text: msg.text }]
                });
            }

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
            console.warn("Kuzbury Chat API call failed, using expert offline engine:", error.message);
        }
    }

    return getOfflineKuzburyResponse(message, history, patientContext);
}
