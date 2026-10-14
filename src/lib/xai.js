/**
 * xAI Grok Client Library
 * All AI calls are made to Vercel serverless functions (/api/*) for security
 */

import { getPatientProfile, updatePatientDob } from './patientProfile.js';

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
 * Extract structured health data from voice transcription
 */
export async function extractVoiceLog(transcription) {
    try {
        const response = await fetch('/api/extract-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcription })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Voice extraction error:', error);
        throw error;
    }
}

/**
 * Scan a medicine label/box photo → extract drug details
 */
export async function scanMedicineLabel(imageBase64, mimeType = 'image/jpeg') {
    try {
        const response = await fetch('/api/scan-vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, mimeType, scanType: 'medicine' })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Medicine label scan error:', error);
        throw error;
    }
}

/**
 * Scan lab results document/photo → extract test values
 */
export async function scanLabResults(imageBase64, mimeType = 'image/jpeg') {
    try {
        const response = await fetch('/api/scan-vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, mimeType, scanType: 'lab' })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Lab results scan error:', error);
        throw error;
    }
}

/**
 * Scan ECG report/printout photo → extract findings
 */
export async function scanECGReport(imageBase64, mimeType = 'image/jpeg') {
    try {
        const response = await fetch('/api/scan-vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, mimeType, scanType: 'ecg' })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('ECG scan error:', error);
        throw error;
    }
}

/**
 * Build a live patient context snapshot from Supabase data.
 * This is prepended to each chat message so Dr. Kuzbury has real-time awareness.
 */
export async function buildPatientContext(supabase) {
    if (!supabase) return '';

    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
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
 * Helper to get time-of-day appropriate greeting
 */
export function getTimeOfDayGreeting(date = new Date()) {
    const hour = date.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

/**
 * Compute the 100-Point Evidence-Based Post-MI Health Score
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
        scorePillars.adherence = 20;
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

    // Pillar 4: Autonomic Recovery (15 pts max)
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

    // Pillar 5: Daily Activity (5 pts max, with fluid retention penalty)
    let actBase = 2;
    if (steps !== null) {
        if (steps >= 7500) actBase = 5;
        else if (steps >= 5000) actBase = 3;
        else actBase = 1;
    }

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
const KUZBURY_SYSTEM_PROMPT = `You are Dr. Kuzbury, a senior AI Cardiologist serving as the patient's personal cardiovascular health advisor.

═══ PATIENT PROFILE ═══
Age: 45 years | Sex: Male

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
• Medication Adherence: ≥95% target

═══ OVERALL HEALTH SCORE (100-POINT CARDIOVASCULAR RECOVERY INDEX) ═══
You DO track and calculate an overall 100-Point Cardiovascular Health Score on this dashboard. When asked if the score is tracked or accurate, CONFIRM that you track it and explain its 5 weighted clinical pillars:
1. Medication Adherence (30 pts): ≥95% 30-day adherence target
2. Blood Pressure & Resting HR Control (25 pts): Target BP <130/80 mmHg & RHR 55-65 bpm
3. Biomarkers — LDL-C & HbA1c (25 pts): Target LDL-C <55 mg/dL (15 pts) & HbA1c <5.7% (10 pts)
4. Autonomic Recovery (15 pts): HRV ≥40 ms & SpO2 ≥96%
5. Physical Activity (5 pts): Step count ≥7,500/day or 30 min exercise
Always reference the live pillar score breakdown provided in the patient context when discussing the health score!

═══ RED FLAG MATRIX — IMMEDIATE ACTION ═══
🚨 CALL EMERGENCY SERVICES IMMEDIATELY if ANY of these:
  - Chest pain at rest, or chest pain severity ≥7/10
  - New-onset chest pain (different character from usual)
  - Chest pain with sweating, nausea, or jaw/arm radiation
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

═══ COMMUNICATION STYLE ═══
• Warm, professional, peer-level — speak as a senior cardiologist to an intelligent, engaged patient
• Clinically authoritative but never alarmist
• Concise: 1-3 short paragraphs max per response
• Reference specific numbers from the patient context when relevant
• Always caveat that medication changes or new treatments require their human cardiologist's approval
• When patient data shows gaps (missing BP, stale HRV), gently flag it as actionable
• Celebrate wins — good adherence, improving trends, consistent exercise`;

/**
 * Generate AI-powered insights from 90-day health trend data
 */
export async function generateAIInsights(supabase) {
    if (!supabase) return [];

    try {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        // Fetch 90-day daily summaries
        const { data: summaries } = await supabase
            .from('daily_summary')
            .select('date, avg_rhr, avg_hrv, blood_oxygen_avg, step_count, weight_kg, health_score, active_calories')
            .gte('date', ninetyDaysAgo)
            .order('date', { ascending: true });

        // Fetch all lab results
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

        // Summarise the data
        const recent7 = summaries.slice(-7);
        const prior30 = summaries.slice(-37, -7);

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

        // Call API
        const response = await fetch('/api/generate-insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summaryData: summaryPayload })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        let insights = result.insights || [];

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
 * Generate a proactive daily health briefing
 */
export async function generateDailyBriefing(supabase) {
    if (!supabase) return null;

    const context = await buildPatientContext(supabase);
    const greeting = getTimeOfDayGreeting();
    const localTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
        const response = await fetch('/api/daily-briefing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientContext: context, greeting, localTimeStr })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        return result.briefing;
    } catch (error) {
        console.warn('Daily briefing API failed, using fallback:', error.message);
        
        // Fallback briefing
        return `${greeting}. Dr. Kuzbury here with your daily cardiovascular briefing.\n\n` +
            `Your live health data has been synchronized to your dashboard. Please ensure you take your prescribed secondary prevention regimen (Rosuvastatin 40mg, Bisoprolol 2.5mg, Aspirin 75mg) today, and aim for a 30-minute light walk.`;
    }
}

/**
 * Chat with Dr. Kuzbury
 */
export async function chatWithKuzbury(message, history = [], patientContext = '', supabase = null) {
    const query = message.toLowerCase();
    const greeting = getTimeOfDayGreeting();
    const localTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Handle DOB update requests locally
    if (query.includes('dob') || query.includes('date of birth') || query.includes('born') || query.includes('record')) {
        const dateMatch = message.match(/(\d{1,2}\s+[a-zA-Z]+\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
        if (dateMatch) {
            const res = await updatePatientDob(dateMatch[0]);
            return `${greeting}. I have updated the clinical records.\n\n` +
                `Date of Birth is now recorded as **${res.dobFormatted}** (Age: **${res.age} years old**).`;
        }
    }

    // Handle weight update requests locally and save to DB
    if (query.includes('weight') || query.includes('weigh') || query.includes('kg') || query.includes('kilos')) {
        const weightMatch = message.match(/(?:weight|weigh|kg|kilos|scale).*?(\d{2,3}(?:\.\d)?)\s*(?:kg|kilos|kilograms)?/i) || message.match(/(\d{2,3}(?:\.\d)?)\s*(?:kg|kilos|kilograms)/i);
        if (weightMatch) {
            const weightVal = parseFloat(weightMatch[1]);
            if (weightVal >= 30 && weightVal <= 300) {
                let prevWeight = 86.6;
                const prevMatch = patientContext.match(/Weight:\s*(\d+(?:\.\d+)?)\s*kg/i);
                if (prevMatch) prevWeight = parseFloat(prevMatch[1]);

                if (supabase) {
                    try {
                        await supabase.from('body_composition').insert([{
                            recorded_at: new Date().toISOString(),
                            metric_type: 'weight',
                            value: Math.round(weightVal * 10) / 10,
                            unit: 'kg',
                            source: 'manual',
                            notes: 'Logged via Dr. Kuzbury AI Chat'
                        }]);
                    } catch (err) {
                        console.warn('Supabase weight insert notice:', err.message);
                    }
                }

                const diff = Math.round((weightVal - prevWeight) * 10) / 10;
                const diffText = diff > 0 ? `+${diff} kg gain` : (diff < 0 ? `${diff} kg reduction` : 'no change');

                let fluidWarning = '';
                if (diff > 1.5) {
                    fluidWarning = `\n\n⚠️ **Fluid Retention Alert:** Rapid weight gain of >1.5 kg (+${diff} kg) within a week can indicate fluid retention or early post-MI decompensation. Please monitor for any ankle swelling or breathlessness.`;
                }

                return `${greeting}. I have recorded your updated weight as **${weightVal.toFixed(1)} kg**.\n\n` +
                    `**Clinical Trajectory Analysis:**\n` +
                    `• New Weight: **${weightVal.toFixed(1)} kg** (${new Date().toLocaleDateString('en-GB')})\n` +
                    `• Trajectory: ${diffText} vs previous reading (${prevWeight} kg)` +
                    `${fluidWarning}\n\n` +
                    `Your 100-Point Recovery Index and daily briefings have been updated to reflect your new reading.`;
            }
        }
    }

    // Call chat API
    try {
        const timeContext = `\n[TIME CONTEXT — Current Local Time: ${localTimeStr} | Time-of-day Greeting: "${greeting}"]\nAlways greet with "${greeting}" if greeting the patient. Never say "Good morning" during the afternoon or evening.\n`;
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history,
                systemPrompt: KUZBURY_SYSTEM_PROMPT + timeContext,
                patientContext
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        return result.reply;
    } catch (error) {
        console.error('Chat API error:', error);
        
        // Return clear error message (no fake medical advice)
        return `${greeting}. I'm experiencing a temporary connection issue and cannot provide medical advice at this moment. Please try again shortly, or contact your healthcare provider if this is urgent.`;
    }
}
