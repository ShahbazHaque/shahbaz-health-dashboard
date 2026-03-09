# Shahbaz Health Dashboard — Master Project Context
**Last Updated:** 2026-03-09 (Post Data Capture feature)

---

## Quick Resume
- **Path:** `/Users/shahbazhaque/Desktop/Antigravity/shahbaz-health-dashboard/`
- **Stack:** React 19 + Vite 7 + Supabase + Google Gemini 2.5 Flash
- **Supabase Project ID:** `ajgeanhsqhzrwtwfrkdu`
- **Supabase URL:** `https://ajgeanhsqhzrwtwfrkdu.supabase.co`
- **Run:** Use Node API — NOT `npm run dev` (node_modules are macOS-built):
  ```js
  node -e "const { createServer } = require('./node_modules/vite'); createServer({ cacheDir: '/tmp/vite-cache', server: { port: 5173, host: '0.0.0.0' } }).then(s => s.listen()).then(() => console.log('Server started on port 5173')).catch(e => console.error(e));" &
  ```
  - ⚠️ First run: `npm install @rollup/rollup-linux-arm64-gnu --no-save`
  - ⚠️ Use `cacheDir: '/tmp/vite-cache'` to avoid EPERM errors on mounted Mac folder
- **URL:** `http://localhost:5173`
- **GitHub:** `https://github.com/ShahbazHaque/shahbaz-health-dashboard`

---

## Patient Profile
- **Patient:** Shahbaz, 45y male, DOB 15 May 1980
- **Diagnoses:** ASHD of native coronary artery, Chronic IHD, Old Myocardial Infarction (OMI), Hyperlipidaemia
- **Medications:** Rosuvastatin 40mg (statin), Bisoprolol 2.5mg (beta-blocker), Aspirin 75mg (antiplatelet)
- **Clinical Targets:** LDL-C <55 mg/dL, BP <130/80 mmHg, Resting HR 55-65 bpm, HbA1c <5.7%
- **Guidelines:** ESC 2024 Secondary Prevention, AHA 2025 ASCVD Protocol

---

## Environment & API Keys
- **`VITE_GEMINI_API_KEY`**: `AIzaSyBZH1oHDUdndaz_E1QdRqHWM0JmkCs6xeA` (in `.env.local`)
- **`VITE_ELEVENLABS_AGENT_ID`**: `agent_01jwk33b9tek7br97s5an2sagn` (in `.env.local`, currently unused)
- **Supabase anon key**: hardcoded in `App.jsx`, `import-data.mjs`, `compute-summaries.mjs` — security debt, fix in Sprint 6
- All AI (Gemini) calls are client-side — security debt, should move to backend in Sprint 6

---

## Supabase Tables (Current — 9 tables)
| Table | Rows | Purpose |
|-------|------|---------|
| `profile` | 1 | Patient profile |
| `vitals` | ~1,318,961 | Apple Watch telemetry (HR, HRV, SpO2, steps, BP, etc.) |
| `body_composition` | ~1,442 | Weight, BMI, body fat from Apple Health |
| `daily_summary` | ~3,141 | Pre-computed daily aggregates + health score |
| `health_insights` | ~10 | AI-generated trend insights |
| `medications` | 3 | Active regimen (Rosuvastatin, Bisoprolol, Aspirin) |
| `medication_log` | 90+ | Daily adherence (taken/missed per med per day) |
| `lab_results` | 34 | LDL, Total Chol, HDL, Trig, HbA1c, ApoB, Lp(a), BP |
| `ecg_results` | 0 | ECG findings extracted via Gemini Vision (NEW) |

### Known Data Gaps (March 2026 audit)
- **BP:** Only 2 readings across 8.5 years — critical gap; BP is #1 modifiable post-MI risk factor
- **HRV:** Stopped updating after Jan 2026 — Apple Health re-sync needed
- **Weight:** Stopped after Feb 2025 — manual entry fallback needed
- **Daily summaries:** Missing RHR/HRV/weight/calories for recent days
- **Symptoms:** Voice extraction results are `console.log`'d — never persisted to DB
- **Exercise:** Only step counts, no structured exercise session data

### Tables Still Needed
| Table | Schema | Sprint |
|-------|--------|--------|
| `symptom_log` | id, timestamp, symptom_type, severity (1-10), duration_minutes, context, triggers, relieving_factors, associated_vitals_snapshot (jsonb), notes | S2.3 |
| `exercise_log` | id, date, exercise_type, duration_minutes, intensity, max_hr, avg_hr, symptoms_during, notes | S4.1 |
| `meal_log` | id, timestamp, photo_url, description, calories_est, metabolic_flags (text[]), notes | S5.1 |

---

## File Structure (Audited 2026-03-09)
```
src/
  App.jsx                  # ~880 lines. Main app. 8-tab dashboard. Supabase data loading.
                           # Supabase URL+key HARDCODED lines 11-13 (security debt)
                           # Tabs: overview, medications, vitals, body, clinical, insights, add-data, report
                           # State: summaries, insights, latestVitals, latestBody, labResults, medications, adherenceRate
                           # loadData() fetches all tables on mount
                           # generateInsights() is rule-based threshold checks only
  App.css
  components/
    KuzburyChat.jsx        # 238 lines. AI chat + voice dictation.
                           # BUG: extractVoiceLog() result console.log'd, NEVER persisted to DB
                           # BUG: No patient context injected — Kuzbury is completely data-blind
                           # BUG: Greeting falsely claims to have "fully reviewed historical data"
                           # Needs: supabase prop, context injection, symptom persistence
    KuzburyChat.css
    MedicationManager.jsx  # 258 lines. Full CRUD + Log Dose + 14-day heatmap. Supabase-connected. ✅
    MedicationManager.css
    GlidePathChart.jsx     # Reusable biometric trend chart with clinical target bands. ✅
    ClinicianReport.jsx    # 178 lines. A4 printable PDF report. Live Supabase data. window.print(). ✅
    ClinicianReport.css
    DataCapture.jsx        # ~440 lines. "Add Data" tab. 5 data entry cards:
                           # 1. Scan Medicine Label → medications table
                           # 2. Scan Lab Results → lab_results table
                           # 3. Scan ECG Report → ecg_results table
                           # 4. Upload Apple Health → vitals/body_composition tables
                           # 5. Quick BP Entry → vitals table
                           # UX: Upload → AI Extract → Review/Edit → Confirm → Save
    DataCapture.css        # Dark theme styling for DataCapture component
    VoiceCapture.jsx       # ORPHANED — not imported anywhere. Remove in Sprint 6.
    VoiceCapture.css       # ORPHANED
  lib/
    gemini.js              # ~291 lines. Functions:
                           # 1. extractVoiceLog(transcription) — structured JSON via Gemini
                           # 2. chatWithKuzbury(message, history) — Kuzbury chat (system prompt: 6 lines only)
                           # 3. fileToBase64(file) — convert File to base64
                           # 4. scanMedicineLabel(imageBase64) — Gemini Vision → drug details
                           # 5. scanLabResults(imageBase64) — Gemini Vision → lab values
                           # 6. scanECGReport(imageBase64) — Gemini Vision → ECG findings
                           # NO buildPatientContext() — Kuzbury has ZERO access to real patient data
backend/
  app/main.py              # FastAPI stub — skeleton only, no real endpoints
  app/db/db_schemas.sql    # PostgreSQL + TimescaleDB + pgvector schema (reference)
  requirements.txt
compute-summaries.mjs      # Node: recompute daily_summary from raw vitals
import-data.mjs            # Node: Apple Health XML ZIP import to Supabase. No --since flag yet.
```

---

## Completed Work (Priority 1 — All Done ✅)
- [x] Apple Health data import pipeline (import-data.mjs)
- [x] Dr. Kuzbury AI chat with Gemini 2.5 Flash
- [x] Voice dictation (Web Speech API, continuous, interim results)
- [x] Medication Manager — Supabase CRUD, Log Dose, real adherence heatmap
- [x] Clinical biomarkers from real `lab_results` table
- [x] Clinician Report — live data, PDF print
- [x] Health score computation + rule-based insights
- [x] 8-tab dark-theme dashboard (added "Add Data" tab)
- [x] Data Capture tab — Gemini Vision photo scanning (medicine labels, lab results, ECG reports)
- [x] Data Capture tab — Apple Health quick upload (reused existing pipeline)
- [x] Data Capture tab — Quick BP manual entry
- [x] ecg_results Supabase table created

---

## ACTION PLAN — Ordered by Impact

### 🔴 SPRINT 1 — AI Intelligence (No new DB needed, highest ROI)

#### S1.1 — Enhanced System Prompt [`src/lib/gemini.js`] ~30 min
Expand `systemInstruction` in `chatWithKuzbury()` from 6 lines to full clinical prompt:
- Full patient profile (Shahbaz, 45y, ASHD/OMI/Hyperlipidaemia, all 3 meds)
- ESC 2024 + AHA 2025 secondary prevention targets
- Drug-specific knowledge (statin myalgia, beta-blocker fatigue, aspirin GI warnings)
- Red flag matrix: chest pain >7/10 OR at rest OR new onset → 112 (KSA) / 999 (UK) immediately
- Lifestyle guidance: Mediterranean diet, 150 min moderate exercise/week post-MI
- Post-MI mental health awareness

#### S1.2 — Context Injection / RAG-lite [`src/lib/gemini.js` + `KuzburyChat.jsx`] ~2 hrs
Add `buildPatientContext(supabase)` to gemini.js — queries Supabase for latest snapshot:
```
[PATIENT CONTEXT — live data, do not repeat verbatim to patient]
Latest vitals: RHR X bpm, HRV Xms, SpO2 X%, Weight Xkg
Latest labs: LDL X mg/dL (date), HbA1c X% (date)
BP trend: X/X (last reading — only N readings on file)
Medication adherence: X% (30-day), meds taken today: [list]
Recent symptoms: [from symptom_log or "None logged in past 7 days"]
Health score: X/100 (90-day avg), trend: stable/improving/declining
```
Pass `supabase` prop from App.jsx to KuzburyChat. Prepend context before each `chatWithKuzbury()` call.
Fix the lying greeting message.

#### S1.3 — Proactive Daily Briefing [`src/lib/gemini.js` + `App.jsx`] ~1.5 hrs
Add `generateDailyBriefing(supabase)` to gemini.js. Call on app load. Display on Overview tab above the chat.
Example: "Good morning Shahbaz. All 3 medications logged yesterday. Your HRV was 34ms, below your 90-day avg of 38ms. Last LDL was 3 months ago — consider scheduling blood work."

---

### 🟠 SPRINT 2 — Data Tracking (Critical Gaps)

#### S2.1 — BP Quick Logger [`src/components/BPLogger.jsx`] ~2 hrs
Floating action button on Overview + Vitals tabs → modal.
Fields: Systolic / Diastolic / HR / Position (sitting/standing) / Notes.
Validation: Sys 70-250, Dia 40-150, HR 30-220. Alert if Sys >180 or <90.
Write to `vitals` table: `metric_type = 'blood_pressure_systolic'` and `'blood_pressure_diastolic'`.

#### S2.2 — Lab Result Entry Form [`src/components/LabEntryForm.jsx`] ~1 hr
"Add Lab Result" button on Clinical tab → modal.
Fields: Date, Metric (dropdown: LDL/HDL/Total Chol/Trig/HbA1c/ApoB/Lp(a)/Systolic BP/Diastolic BP), Value, Unit (auto-fill), Lab Name, Notes.
Write to existing `lab_results` table.

#### S2.3 — Structured Symptom Diary [`src/components/SymptomDiary.jsx` + new DB table] ~2.5 hrs
1. Create `symptom_log` table in Supabase
2. Build SymptomDiary component (symptom type, severity 1-10, duration, triggers, notes)
3. Wire `extractVoiceLog()` output in KuzburyChat.jsx to write to symptom_log
4. Display symptom log on new tab or Overview section

---

### 🟡 SPRINT 3 — AI Intelligence (High Value)

#### S3.1 — AI-Generated Trend Insights [`src/lib/gemini.js` + `App.jsx`] ~2 hrs
Replace rule-based `generateInsights()` with Gemini-powered multi-variable pattern analysis.
Send 90-day summary to Gemini → write results to `health_insights` table.

#### S3.2 — Symptom-Vitals Correlation [`src/lib/correlations.js`] ~2 hrs
New utility: when symptom logged, query `vitals` for ±30 min window, attach as `associated_vitals_snapshot`.

---

### 🟢 SPRINT 4 — More Data Tracking

#### S4.1 — Exercise Session Logger [`src/components/ExerciseLogger.jsx` + new DB table] ~2 hrs
Create `exercise_log` table. Types: Walking, Cycling, Swimming, Strength, Yoga, Other.
Fields: Date, Type, Duration, Intensity (light/moderate/vigorous), Max HR, Avg HR, Symptoms, Notes.

#### S4.2 — Apple Health Incremental Re-sync [`import-data.mjs`] ~1 hr
Add `--since YYYY-MM-DD` flag. UI button in app to trigger re-sync.

---

### 🔵 SPRINT 5 — Medium Priority

#### S5.1 — Meal Photo Logging (Gemini Vision) [`src/components/MealLogger.jsx` + new DB table] ~3 hrs
Photo → Gemini Vision → meal description + metabolic risk flags. Write to `meal_log` table.

---

### ⚪ SPRINT 6 — Security & Polish (Do last)
- Move Supabase URL + anon key to `.env.local`
- Move Gemini API key to backend
- Add Supabase Auth + RLS policies
- Remove orphaned VoiceCapture.jsx + VoiceCapture.css
- Mobile responsive tabs
- Proper favicon + page title
- FastAPI backend: connect real DB, move LLM server-side
- ElevenLabs voice agent integration (agent ID exists, no code yet)

---

## Known Bugs
1. **Kuzbury greeting lies** — "I have fully reviewed all your historical data" — he has ZERO data access
2. **Voice extraction lost** — `extractVoiceLog()` results only `console.log`'d, never saved
3. **Vite startup** — `npm run dev` fails in Cowork; use Node API with `cacheDir: '/tmp/vite-cache'`
4. **getDaysSupply() synthetic** — calculated from `med.created_at`, not actual refill cycles
5. **BP shows "—"** — only 2 readings exist across 8.5 years
6. **HRV gap** — data stopped Jan 2026 (Apple Health re-sync needed)
7. **Weight gap** — data stopped Feb 2025

---

## Session Startup Checklist
1. Read this CLAUDE.md
2. Start dev server (Node API method in Quick Resume above)
3. Check current sprint status below and continue

## Current Status (2026-03-09)
- **Data Capture (Add Data tab):** COMPLETE — all 5 data entry methods working
- **Next up:** Sprint 1 — AI Intelligence
  - S1.1: Enhanced System Prompt (~30 min) — expand Kuzbury's 6-line prompt to full clinical knowledge
  - S1.2: Context Injection (~2 hrs) — give Kuzbury live access to patient data via `buildPatientContext()`
  - S1.3: Daily Briefing (~1.5 hrs) — proactive health summary on app load
