# Shahbaz Health Dashboard — Claude Cowork Migration Guide
## Complete Project Context & Setup Instructions
**Generated:** 2026-06-12 | **Source:** Full Antigravity conversation thread analysis

---

## 1. WHAT THIS PROJECT IS

A **personal AI cardiac health command centre** built for a single patient (Shahbaz, 45y male) with atherosclerotic heart disease. The application's central intelligence is **Dr. Kuzbury** — a persistent AI cardiologist persona that monitors health data, interprets biometrics, and provides clinical guidance between real-world appointments.

**This is NOT a general health app.** It is an N=1 clinical decision-support system for one specific patient with known diagnoses, medications, and targets.

---

## 2. PROJECT LOCATION & URLS

| Item | Value |
|------|-------|
| **Local path** | `~/Desktop/Antigravity/shahbaz-health-dashboard/` |
| **GitHub** | https://github.com/ShahbazHaque/shahbaz-health-dashboard |
| **Live app** | https://shahbazhaque.github.io/shahbaz-health-dashboard/ |
| **CI/CD** | GitHub Actions → auto-deploy to GitHub Pages on push to `main` |

---

## 3. TECH STACK

### Frontend
- **React 19** + **Vite 7** (vanilla JS, no TypeScript)
- **Recharts** for data visualization
- **Lucide React** for icons
- **Supabase JS client** for database
- **Google Generative AI SDK** (`@google/generative-ai`) for Gemini 2.5 Flash
- **JSZip** + **SAX** for Apple Health XML parsing

### Backend (Skeleton — not yet connected)
- **FastAPI** (Python) — stub endpoints only, no real DB connection
- **SQLAlchemy** + **pgvector** + **TimescaleDB** schemas defined but not deployed
- Located in `backend/` directory

### Database (Production)
- **Supabase** (hosted PostgreSQL) — 9 tables, ~1.3M rows of real patient data

### AI
- **Google Gemini 2.5 Flash** — all calls are client-side (security debt)
  - Chat with Dr. Kuzbury persona
  - Voice log extraction (structured JSON)
  - Photo scanning: medicine labels, lab results, ECG reports (Gemini Vision)

---

## 4. HOW TO RUN

```bash
cd ~/Desktop/Antigravity/shahbaz-health-dashboard
npm install        # If needed
npm run dev        # Starts Vite dev server
# Open http://localhost:5173
```

### Environment Variables (`.env.local` — NOT committed to git)
```
VITE_GEMINI_API_KEY=AIzaSyBZH1oHDUdndaz_E1QdRqHWM0JmkCs6xeA
VITE_ELEVENLABS_AGENT_ID=agent_01jwk33b9tek7br97s5an2sagn
```

> [!IMPORTANT]
> The ElevenLabs agent ID exists and was configured in the ElevenLabs dashboard, but the voice integration was **rolled back to text-only** due to instability. The agent is still live at https://elevenlabs.io/app/talk-to?agent_id=agent_01jwk33b9tek7br97s5an2sagn and has a full Dr. Kuzbury system prompt configured. It can be re-integrated when ready.

### Backend (Optional — not connected to frontend yet)
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
# Swagger docs at http://localhost:8000/docs
```

---

## 5. PATIENT CLINICAL PROFILE

This is the single most important section. **Every AI prompt, every threshold, every target in the app is derived from this profile.**

| Field | Value |
|-------|-------|
| **Name** | Shahbaz |
| **Age** | 45 years (DOB: 15 May 1980) |
| **Gender** | Male |
| **Primary Diagnoses** | ASHD of native coronary artery, Chronic Ischaemic Heart Disease, Old Myocardial Infarction (OMI), Hyperlipidaemia |
| **Medications** | Rosuvastatin 40mg (statin), Bisoprolol 2.5mg (beta-blocker), Aspirin 75mg (antiplatelet) |
| **LDL-C Target** | <55 mg/dL (ESC 2024 very-high-risk) |
| **BP Target** | <130/80 mmHg |
| **Resting HR Target** | 55-65 bpm |
| **HbA1c Target** | <5.7% |
| **Guidelines** | ESC 2024 Secondary Prevention, AHA 2025 ASCVD Protocol |
| **Emergency Numbers** | 112 (KSA) / 999 (UK) |
| **Red Flags** | Chest pain >7/10, BP >180/110, new rest angina → immediate emergency escalation |

---

## 6. SUPABASE DATABASE

### Connection
- **Project ID:** `ajgeanhsqhzrwtwfrkdu`
- **URL:** `https://ajgeanhsqhzrwtwfrkdu.supabase.co`
- **Anon Key:** Hardcoded in `src/App.jsx` lines 12-13 (security debt — see Sprint 6)

### Tables (9 active)

| Table | ~Rows | Purpose |
|-------|-------|---------|
| `profile` | 1 | Patient demographics |
| `vitals` | ~1,318,961 | Apple Watch telemetry (HR, HRV, SpO2, steps, BP, respiratory rate) |
| `body_composition` | ~1,442 | Weight, BMI, body fat, lean body mass from Apple Health |
| `daily_summary` | ~3,141 | Pre-computed daily aggregates + health score |
| `health_insights` | ~10 | AI-generated trend insights |
| `medications` | 3 | Active medication regimen |
| `medication_log` | 90+ | Daily adherence tracking (taken/missed per med per day) |
| `lab_results` | 34 | LDL, Total Chol, HDL, Triglycerides, HbA1c, ApoB, Lp(a), BP |
| `ecg_results` | 0 | ECG findings extracted via Gemini Vision (table created, no data yet) |

### Tables Still Needed

| Table | Schema | Priority |
|-------|--------|----------|
| `symptom_log` | id, timestamp, symptom_type, severity (1-10), duration_minutes, context, triggers, relieving_factors, associated_vitals_snapshot (jsonb), notes | Sprint 2.3 |
| `exercise_log` | id, date, exercise_type, duration_minutes, intensity, max_hr, avg_hr, symptoms_during, notes | Sprint 4.1 |
| `meal_log` | id, timestamp, photo_url, description, calories_est, metabolic_flags (text[]), notes | Sprint 5.1 |

### Known Data Gaps
- **BP:** Only 2 readings across 8.5 years — critical gap
- **HRV:** Data stopped updating after Jan 2026
- **Weight:** Data stopped after Feb 2025
- **Symptoms:** Voice extraction results are `console.log`'d, never persisted
- **Exercise:** Only step counts, no structured exercise sessions

---

## 7. FILE STRUCTURE (COMPLETE)

```
shahbaz-health-dashboard/
├── .claude/                        # Empty — for Claude Cowork config
├── .env.local                      # API keys (NOT committed)
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions: build + deploy to GitHub Pages
├── CLAUDE.md                       # Master project context (15KB, very detailed)
├── HANDOVER.md                     # Supplementary handover doc (9KB)
├── backend/
│   ├── app/
│   │   ├── api/                    # Empty — placeholder
│   │   ├── core/                   # Empty — placeholder
│   │   ├── db/
│   │   │   └── db_schemas.sql      # PostgreSQL + TimescaleDB + pgvector DDL
│   │   ├── main.py                 # FastAPI stub (3 endpoints, no real DB)
│   │   └── models/                 # Empty — placeholder
│   ├── requirements.txt            # fastapi, uvicorn, pydantic, sqlalchemy, pgvector, google-generativeai
│   ├── README.md                   # Backend deployment guide
│   └── venv/                       # Python virtual environment (do not commit)
├── compute-summaries.mjs           # Node script: recompute daily_summary from raw vitals
├── import-data.mjs                 # Node script: Apple Health XML ZIP → Supabase import
├── index.html                      # Vite entry point
├── package.json                    # Dependencies (React 19, Vite 7, Gemini, Supabase, etc.)
├── public/
│   ├── dr_kuzbury.jpg              # Dr. Kuzbury's avatar image (3D cartoon doctor)
│   └── vite.svg
├── src/
│   ├── App.jsx                     # ~870 lines. Main app. 8-tab dashboard. ALL state lives here.
│   ├── index.css                   # Global CSS (dark theme)
│   ├── main.jsx                    # React entry point
│   ├── components/
│   │   ├── KuzburyChat.jsx         # 239 lines. Text chat + voice dictation with Gemini
│   │   ├── KuzburyChat.css
│   │   ├── MedicationManager.jsx   # 258 lines. Full CRUD + Log Dose + 14-day heatmap
│   │   ├── MedicationManager.css
│   │   ├── DataCapture.jsx         # ~440 lines. "Add Data" tab (5 data entry methods)
│   │   ├── DataCapture.css
│   │   ├── GlidePathChart.jsx      # Reusable biometric trend chart with target bands
│   │   ├── ClinicianReport.jsx     # 178 lines. A4 printable PDF report
│   │   ├── ClinicianReport.css
│   │   ├── VoiceCapture.jsx        # ⚠️ ORPHANED — not imported anywhere. DELETE.
│   │   └── VoiceCapture.css        # ⚠️ ORPHANED — DELETE.
│   └── lib/
│       └── gemini.js               # 291 lines. ALL AI functions:
│                                   #   - extractVoiceLog(transcription) → structured JSON
│                                   #   - chatWithKuzbury(message, history) → Dr. Kuzbury chat
│                                   #   - fileToBase64(file) → File → base64
│                                   #   - scanMedicineLabel(base64) → Gemini Vision → drug data
│                                   #   - scanLabResults(base64) → Gemini Vision → lab values
│                                   #   - scanECGReport(base64) → Gemini Vision → ECG findings
│                                   #   ⚠️ NO buildPatientContext() — Kuzbury has ZERO data access
└── vite.config.js                  # base: '/shahbaz-health-dashboard/' for GitHub Pages
```

---

## 8. WHAT IS FULLY BUILT AND WORKING

1. **8-tab dark-theme dashboard** — overview, medications, vitals, body, clinical, insights, add-data, report
2. **Dr. Kuzbury AI chat** — text input + browser voice dictation (Web Speech API) → Gemini 2.5 Flash
3. **Medication Manager** — full CRUD against Supabase, Log Dose, real 14-day adherence heatmap
4. **Clinical biomarker tracking** — LDL, HDL, Total Chol, Triglycerides, HbA1c, ApoB, Lp(a) from `lab_results`
5. **Clinician Report** — A4 printable PDF with live Supabase data + `window.print()`
6. **Health score** — computed from daily aggregates + rule-based threshold insights
7. **Add Data tab** — 5 data entry methods:
   - Scan Medicine Label (Gemini Vision → `medications` table)
   - Scan Lab Results (Gemini Vision → `lab_results` table)
   - Scan ECG Report (Gemini Vision → `ecg_results` table)
   - Upload Apple Health ZIP → `vitals` / `body_composition` tables
   - Quick BP Entry → `vitals` table
8. **GitHub Pages + CI/CD** — auto-deploy on push to `main`
9. **Dr. Kuzbury avatar** — custom 3D cartoon doctor image (`public/dr_kuzbury.jpg`)

---

## 9. KNOWN BUGS (MUST FIX)

| # | Bug | Severity | Location |
|---|-----|----------|----------|
| 1 | **Kuzbury greeting lies** — says "fully reviewed historical data" but has ZERO data access | 🔴 Critical | `KuzburyChat.jsx` line 14 |
| 2 | **Voice extraction lost** — `extractVoiceLog()` results only `console.log`'d, never persisted to DB | 🔴 Critical | `KuzburyChat.jsx` line 121 |
| 3 | **No patient context** — Dr. Kuzbury system prompt is 6 lines, has no access to vitals/labs/meds | 🔴 Critical | `gemini.js` lines 237-243 |
| 4 | **Supabase keys hardcoded** — anon key in App.jsx, import-data.mjs, compute-summaries.mjs | 🟡 Security | `App.jsx` lines 12-13 |
| 5 | **Gemini API key client-side** — exposed in browser network tab | 🟡 Security | `gemini.js` line 6 |
| 6 | **getDaysSupply() synthetic** — calculated from `med.created_at`, not actual refill data | 🟡 Cosmetic | `App.jsx` |
| 7 | **BP shows "—"** — only 2 readings across 8.5 years | 🟠 Data gap | Dashboard |
| 8 | **HRV gap** — data stopped Jan 2026 | 🟠 Data gap | Supabase vitals table |
| 9 | **Weight gap** — data stopped Feb 2025 | 🟠 Data gap | Supabase body_composition |
| 10 | **VoiceCapture.jsx is orphaned** — not imported anywhere, dead code | ⚪ Cleanup | `src/components/` |

---

## 10. ARCHITECTURAL DECISIONS & HISTORY

### What was tried and abandoned
1. **ElevenLabs Conversational AI Voice Agent** — A full WebSocket-based voice integration was built using `@elevenlabs/client` SDK. An ElevenLabs agent was configured with agent ID `agent_01jwk33b9tek7br97s5an2sagn` and a comprehensive Dr. Kuzbury system prompt. The voice pipeline worked in automated testing (WebRTC handshake successful, agent responded with greeting) but was unreliable in practice. **Decision: Rolled back to text-based chat.** The ElevenLabs dependency still exists in `package.json` but is unused. The agent is still live in the ElevenLabs dashboard and can be re-integrated later.

2. **FastAPI Backend with PostgreSQL/TimescaleDB/pgvector** — A backend was scaffolded in `backend/` with SQL schemas for a dual-engine architecture. The `requirements.txt` was installed and `uvicorn` runs successfully, but the endpoints are stubs that return mock data. The backend is NOT connected to the frontend. It was designed as a future production layer to move AI calls server-side and add proper vector memory for Dr. Kuzbury.

### Critical patterns to follow
1. **Image paths:** Always use `` `${import.meta.env.BASE_URL}filename` `` — NEVER hardcode `/filename`. GitHub Pages serves from `/shahbaz-health-dashboard/` subpath.
2. **Supabase queries:** Use the `supabase` client created in `App.jsx` line 14.
3. **Gemini Vision pattern:** `model.generateContent([{ inlineData: { mimeType, data: base64 } }, { text: prompt }])` with `responseMimeType: 'application/json'`.
4. **Component pattern:** Each component = `.jsx` + `.css` pair in `src/components/`.
5. **Data flow:** `App.jsx` owns ALL state → passes as props to children → `loadData()` refreshes everything on mount.
6. **Gemini history formatting:** Gemini chat API requires strict alternating user/model roles, must start with user. See the complex formatting logic in `gemini.js` lines 246-274.

---

## 11. DR. KUZBURY — PERSONA SPECIFICATION

### Character
- **Name:** Dr. Kuzbury
- **Role:** Personal AI Cardiologist — warm, expert, deeply familiar with patient
- **Tone:** Warm, professional, clinically authoritative, never alarmist
- **Communication:** Speak to Shahbaz as an intelligent peer. Use his name naturally but not every sentence.
- **Avatar:** `public/dr_kuzbury.jpg` — 3D cartoon doctor character

### System Prompt (Current — only 6 lines, needs expansion)
Located in `src/lib/gemini.js` lines 237-243:
```
You are Dr. Kuzbury, a personal AI Cardiologist.
Your patient is Shahbaz (45y). He has ASHD of native coronary artery, chronic IHD, old myocardial infarction (OMI), and hyperlipidaemia.
Targets: LDL-C <55 mg/dL, BP <130/80 mmHg, resting HR 55-65 bpm.
Tone: Warm, professional, clinically authoritative, never alarmist. Speak as a senior cardiologist to an intelligent patient.
Provide advice, interpret his metrics/symptoms, and politely add caveats that formal clinical changes require his human cardiologist's approval.
If he mentions chest pain >7/10 or BP >180/110, immediately advise calling emergency services (112 in KSA / 999 in UK).
Keep responses concise, peer-level, and conversational (1-3 small paragraphs max).
```

### What Kuzbury should know (but currently doesn't)
- Drug-specific side effects: statin myalgia, beta-blocker fatigue/bradycardia, aspirin GI bleeding
- ESC 2024 specific recommendations for post-MI secondary prevention
- AHA 2025 ASCVD risk reduction protocols
- Mediterranean diet guidance for post-MI patients
- Exercise: 150 min moderate exercise/week post-MI
- Post-MI mental health awareness (depression, anxiety)
- **LIVE PATIENT DATA** — vitals, labs, medication adherence, symptoms (the `buildPatientContext()` function that needs to be written)

### ElevenLabs Voice Agent (Dormant)
A full system prompt was configured in the ElevenLabs dashboard for voice conversations. Key elements:
- Warm, unhurried British pronunciation
- SSML-style pauses and emphasis for clinical terms
- Full clinical profile injected
- Red flag escalation protocols
- Tool capability: `log_health_event` (was wired to Gemini extraction + FastAPI ingestion)

The agent is live and tested but the frontend integration was removed. The `@elevenlabs/client` package is still in `package.json`.

---

## 12. ACTION PLAN (PRIORITIZED SPRINTS)

### 🔴 SPRINT 1 — AI Intelligence (Highest ROI, no new DB tables needed)

#### S1.1 — Enhanced System Prompt (~30 min)
**File:** `src/lib/gemini.js` → `chatWithKuzbury()` function  
Expand the 6-line system prompt to include full clinical profile, drug side effects, ESC/AHA guidelines, red flag matrix, lifestyle guidance, and post-MI mental health awareness.

#### S1.2 — Context Injection / RAG-lite (~2 hrs)
**Files:** `src/lib/gemini.js` + `src/components/KuzburyChat.jsx`  
1. Create `buildPatientContext(supabase)` function in `gemini.js` that queries Supabase for:
   - Latest vitals (RHR, HRV, SpO2, weight)
   - Latest labs (LDL, HbA1c, etc. with dates)
   - BP trend (last reading, how many readings exist)
   - Medication adherence (30-day %, today's log)
   - Recent symptoms (from `symptom_log` table when it exists)
   - Health score (90-day average + trend)
2. Pass `supabase` prop from `App.jsx` → `KuzburyChat.jsx` (currently NOT passed)
3. Prepend live context to each `chatWithKuzbury()` call
4. **FIX THE LYING GREETING** — change to honest message

#### S1.3 — Proactive Daily Briefing (~1.5 hrs)
**Files:** `src/lib/gemini.js` + `src/App.jsx`  
Add `generateDailyBriefing(supabase)` — call on app load, display on Overview tab.

---

### 🟠 SPRINT 2 — Data Tracking (Critical Gaps)
- **S2.1:** BP Quick Logger component with floating action button
- **S2.2:** Lab Result Entry Form on Clinical tab
- **S2.3:** Structured Symptom Diary + new `symptom_log` Supabase table + wire voice extraction to persist

### 🟡 SPRINT 3 — AI Intelligence (High Value)
- **S3.1:** Replace rule-based insights with Gemini-powered trend analysis
- **S3.2:** Symptom-Vitals correlation engine

### 🟢 SPRINT 4 — More Data Tracking
- **S4.1:** Exercise Session Logger + new `exercise_log` table
- **S4.2:** Apple Health incremental re-sync (`--since` flag on `import-data.mjs`)

### 🔵 SPRINT 5 — Meal Photo Logging
- **S5.1:** Photo → Gemini Vision → meal description + metabolic risk flags → `meal_log` table

### ⚪ SPRINT 6 — Security & Polish
- Move Supabase URL + anon key to `.env.local` + GitHub secrets
- Move Gemini API key to backend (currently client-side)
- Add Supabase Auth + RLS policies
- Remove orphaned `VoiceCapture.jsx` + `VoiceCapture.css`
- Mobile responsive tabs
- Proper favicon + page title
- FastAPI backend: connect real DB, move LLM server-side
- Re-evaluate ElevenLabs voice integration
- Custom domain for GitHub Pages

---

## 13. GIT STATUS

### Committed and pushed
All source code is committed to `main`. The latest commit is:
```
db673ac docs: Update CLAUDE.md baseline — GitHub Pages + CI/CD complete
```

### Uncommitted files
- `HANDOVER.md` (untracked) — supplementary handover doc
- `README.md` (untracked) — basic readme

### Recommendation
Commit and push everything before starting Cowork:
```bash
cd ~/Desktop/Antigravity/shahbaz-health-dashboard
git add -A
git commit -m "docs: Add HANDOVER.md and README.md"
git push origin main
```

---

## 14. CLAUDE COWORK SETUP INSTRUCTIONS

### Step 1: Navigate to the project
```bash
cd ~/Desktop/Antigravity/shahbaz-health-dashboard
```

### Step 2: Ensure `.env.local` exists
```bash
cat .env.local
# Should show:
# VITE_GEMINI_API_KEY=AIzaSyBZH1oHDUdndaz_E1QdRqHWM0JmkCs6xeA
# VITE_ELEVENLABS_AGENT_ID=agent_01jwk33b9tek7br97s5an2sagn
```

### Step 3: Start the dev server
```bash
npm run dev
```

### Step 4: Open Claude Cowork and point it to this directory
Tell Claude Cowork to read `CLAUDE.md` first — it is the master context file containing everything about the project, patient profile, database schema, file structure, completed work, action plan, and known bugs.

### Step 5: First task
Start with **Sprint 1.1** — expanding Dr. Kuzbury's system prompt. This is a 30-minute task with the highest ROI because it immediately makes the AI doctor smarter without any database changes.

---

## 15. WHAT "LOSE NOTHING" MEANS

This document preserves:
- ✅ Full patient clinical profile and targets
- ✅ Complete Supabase database schema (9 tables + 3 planned)
- ✅ All API keys and connection strings
- ✅ Every file and its purpose
- ✅ Known bugs with exact file/line references
- ✅ Architectural decisions (what was tried, what was kept, what was abandoned)
- ✅ Dr. Kuzbury persona specification (chat + voice)
- ✅ ElevenLabs agent configuration and system prompt
- ✅ FastAPI backend schemas and deployment guide
- ✅ Complete sprint roadmap with time estimates
- ✅ Git status and uncommitted work
- ✅ Critical code patterns (image paths, Gemini history formatting, Supabase client usage)
- ✅ Apple Health data import pipeline details
- ✅ CI/CD workflow and GitHub Pages configuration
