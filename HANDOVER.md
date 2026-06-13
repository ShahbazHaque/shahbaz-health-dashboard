# Shahbaz Health Dashboard — Full Project Handover

## Your Role
You are continuing development of a personal AI Cardiologist health dashboard for Shahbaz (45y male, post-MI patient). This project has been built across multiple sessions. You are picking up exactly where the previous AI assistant left off.

**CRITICAL: Read the `CLAUDE.md` file in the project root FIRST. It is the master project context and contains everything: patient profile, Supabase schema, file structure, completed work, action plan, known bugs, and current status.**

---

## Project Summary
- **What:** React 19 + Vite 7 dashboard called "Dr. Kuzbury" — an AI cardiologist powered by Google Gemini 2.5 Flash, backed by Supabase (PostgreSQL)
- **Where:** `~/Desktop/Antigravity/shahbaz-health-dashboard/`
- **GitHub:** https://github.com/ShahbazHaque/shahbaz-health-dashboard
- **Live:** https://shahbazhaque.github.io/shahbaz-health-dashboard/
- **CI/CD:** GitHub Actions auto-deploys to GitHub Pages on every push to `main`

---

## How to Run Locally
```bash
cd ~/Desktop/Antigravity/shahbaz-health-dashboard
npm run dev
# Open http://localhost:5173
```

---

## Key Architecture Decisions
1. **All AI calls are client-side** — Gemini API key is in `.env.local` and exposed in browser. Security debt for Sprint 6.
2. **Supabase anon key is hardcoded** in `App.jsx` line 11-13, `import-data.mjs`, `compute-summaries.mjs`. Security debt.
3. **No authentication** — single-user app, no Supabase Auth or RLS yet.
4. **GitHub Pages deployment** — Vite `base: '/shahbaz-health-dashboard/'` in `vite.config.js`. All image paths MUST use `import.meta.env.BASE_URL` prefix, not hardcoded `/`.
5. **`VITE_GEMINI_API_KEY`** is stored as a GitHub repo secret for CI builds.

---

## Supabase Connection
- **Project ID:** `ajgeanhsqhzrwtwfrkdu`
- **URL:** `https://ajgeanhsqhzrwtwfrkdu.supabase.co`
- **Anon key:** Found hardcoded in `src/App.jsx` lines 11-13
- **9 tables:** profile, vitals (~1.3M rows), body_composition, daily_summary, health_insights, medications, medication_log, lab_results, ecg_results

---

## What's Been Built (All Working)
1. **8-tab dark-theme dashboard** — overview, medications, vitals, body, clinical, insights, add-data, report
2. **Dr. Kuzbury AI chat** with voice dictation (Web Speech API)
3. **Medication Manager** — full CRUD, Log Dose, 14-day adherence heatmap
4. **Clinical biomarker tracking** from real lab_results table
5. **Clinician Report** — A4 printable PDF with live data
6. **Health score** computation + rule-based insights
7. **Add Data tab** — 5 data entry methods:
   - Scan Medicine Label (Gemini Vision → medications table)
   - Scan Lab Results (Gemini Vision → lab_results table)
   - Scan ECG Report (Gemini Vision → ecg_results table)
   - Upload Apple Health ZIP → vitals/body_composition
   - Quick BP Entry → vitals table
8. **GitHub Pages + CI/CD** — auto-deploy on push to main

---

## What Needs to Be Built Next

### SPRINT 1 — AI Intelligence (HIGHEST PRIORITY, start here)

This is the highest-ROI work. Dr. Kuzbury currently has a 6-line system prompt and ZERO access to patient data. He literally lies in his greeting saying he's reviewed the patient's data.

#### S1.1 — Enhanced System Prompt (~30 min)
**File:** `src/lib/gemini.js` → `chatWithKuzbury()` function

Expand the `systemInstruction` from its current 6 lines to include:
- Full patient profile: Shahbaz, 45y male, ASHD of native coronary artery, Chronic IHD, Old Myocardial Infarction, Hyperlipidaemia
- Medications: Rosuvastatin 40mg (statin), Bisoprolol 2.5mg (beta-blocker), Aspirin 75mg (antiplatelet)
- ESC 2024 + AHA 2025 secondary prevention targets: LDL-C <55 mg/dL, BP <130/80, RHR 55-65 bpm, HbA1c <5.7%
- Drug-specific side effect knowledge (statin myalgia, beta-blocker fatigue, aspirin GI warnings)
- Red flag matrix: chest pain >7/10 OR at rest OR new onset → call 112 (KSA) / 999 (UK) immediately
- Lifestyle: Mediterranean diet, 150 min moderate exercise/week, post-MI mental health awareness
- Tone: warm, knowledgeable, proactive — like a brilliant cardiologist who actually cares

#### S1.2 — Context Injection / RAG-lite (~2 hrs)
**Files:** `src/lib/gemini.js` + `src/components/KuzburyChat.jsx`

Create `buildPatientContext(supabase)` function in gemini.js that queries Supabase for a live data snapshot:
```
[PATIENT CONTEXT — live data, do not repeat verbatim to patient]
Latest vitals: RHR X bpm, HRV Xms, SpO2 X%, Weight Xkg
Latest labs: LDL X mg/dL (date), HbA1c X% (date)
BP trend: X/X (last reading — only N readings on file)
Medication adherence: X% (30-day), meds taken today: [list]
Recent symptoms: [from symptom_log or "None logged in past 7 days"]
Health score: X/100 (90-day avg), trend: stable/improving/declining
```

Then:
1. Pass `supabase` prop from App.jsx → KuzburyChat.jsx (it's NOT passed currently)
2. Call `buildPatientContext(supabase)` before each `chatWithKuzbury()` call
3. Prepend context to the user message or system prompt
4. **FIX THE LYING GREETING** — change from "I have fully reviewed all your historical data" to something honest like "Good morning Shahbaz. Let me check your latest data..."

#### S1.3 — Proactive Daily Briefing (~1.5 hrs)
**Files:** `src/lib/gemini.js` + `src/App.jsx`

Add `generateDailyBriefing(supabase)` — call on app load, display on Overview tab above chat.
Example output: "Good morning Shahbaz. All 3 medications logged yesterday. Your HRV was 34ms, below your 90-day avg of 38ms. Last LDL was 3 months ago — consider scheduling blood work."

### SPRINT 2 — Data Tracking (Critical Gaps)
- S2.1: BP Quick Logger component with floating action button
- S2.2: Lab Result Entry Form on Clinical tab
- S2.3: Structured Symptom Diary + new `symptom_log` Supabase table + wire voice extraction

### SPRINT 3 — AI Intelligence (High Value)
- S3.1: Replace rule-based insights with Gemini-powered trend analysis
- S3.2: Symptom-Vitals correlation engine

### SPRINT 4 — More Data Tracking
- S4.1: Exercise Session Logger + new `exercise_log` table
- S4.2: Apple Health incremental re-sync (`--since` flag)

### SPRINT 5 — Meal Photo Logging (Gemini Vision)

### SPRINT 6 — Security & Polish
- Move secrets to env vars + GitHub secrets
- Supabase Auth + RLS
- Remove orphaned VoiceCapture.jsx/css
- Mobile responsive
- FastAPI backend
- ElevenLabs voice agent

---

## Known Bugs (Must Fix)
1. **Kuzbury greeting lies** — says "fully reviewed historical data" but has ZERO data access
2. **Voice extraction lost** — `extractVoiceLog()` in KuzburyChat.jsx only `console.log`'s results, never persists to DB
3. **getDaysSupply() synthetic** — calculated from `med.created_at`, not actual refill data
4. **BP shows "—"** — only 2 readings exist across 8.5 years of data
5. **HRV gap** — data stopped Jan 2026 (needs Apple Health re-sync)
6. **Weight gap** — data stopped Feb 2025

---

## Critical Patterns to Follow
1. **Image paths:** Always use `` `${import.meta.env.BASE_URL}filename` `` — NEVER hardcode `/filename`. GitHub Pages serves from `/shahbaz-health-dashboard/`.
2. **Supabase queries:** Use the `supabase` client instance created in App.jsx (imported from `@supabase/supabase-js`).
3. **Gemini Vision pattern:** `model.generateContent([{ inlineData: { mimeType, data: base64 } }, { text: prompt }])` with `responseMimeType: 'application/json'`.
4. **Component pattern:** Each component gets its own `.jsx` + `.css` file in `src/components/`.
5. **Data flow:** App.jsx owns all state → passes as props to child components → `loadData()` refreshes everything.
6. **Git workflow:** Commit to branch → push → PR → merge → auto-deploys to GitHub Pages.

---

## Environment Setup
```bash
# .env.local (not committed, create manually)
VITE_GEMINI_API_KEY=[REDACTED — replace with your Gemini API key]
VITE_ELEVENLABS_AGENT_ID=agent_01jwk33b9tek7br97s5an2sagn
```

---

## File Quick Reference
| File | Lines | What it does |
|------|-------|-------------|
| `src/App.jsx` | 869 | Main app, 8 tabs, all state, Supabase loading |
| `src/lib/gemini.js` | 290 | All Gemini AI functions (chat, vision, voice) |
| `src/components/KuzburyChat.jsx` | 238 | AI chat + voice dictation |
| `src/components/MedicationManager.jsx` | 258 | Med CRUD + adherence heatmap |
| `src/components/DataCapture.jsx` | 725 | Add Data tab (5 entry methods) |
| `src/components/ClinicianReport.jsx` | 178 | Printable PDF report |
| `src/components/GlidePathChart.jsx` | 139 | Biometric trend chart |
| `compute-summaries.mjs` | - | Recompute daily_summary from raw vitals |
| `import-data.mjs` | - | Apple Health XML ZIP → Supabase import |

---

## Start Here
1. Read `CLAUDE.md` in the project root
2. Run `npm run dev` and open `http://localhost:5173`
3. Begin with **Sprint 1.1** — expand Dr. Kuzbury's system prompt in `src/lib/gemini.js`
4. Then **Sprint 1.2** — add `buildPatientContext()` and fix the lying greeting
5. Commit, push, and it auto-deploys
