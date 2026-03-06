# Shahbaz Health Dashboard - Project Context

## Quick Resume
**Path:** `/Users/shahbazhaque/Desktop/Antigravity/shahbaz-health-dashboard/`
**Stack:** React 19 + Vite 7 + Supabase + Google Gemini 2.5 Flash
**Supabase Project ID:** `ajgeanhsqhzrwtwfrkdu`
**Run:** `cd /Users/shahbazhaque/Desktop/Antigravity/shahbaz-health-dashboard && npm run dev`
**URL:** `http://localhost:5173`

## What This Is
Personal AI Cardiologist dashboard ("Dr. Kuzbury") for Shahbaz (45y, ASHD/OMI/Hyperlipidaemia).
- Apple Health data import (1.3M+ vitals records in Supabase)
- AI chat with Dr. Kuzbury persona (Gemini 2.5 Flash)
- Voice dictation for symptom logging (Web Speech API)
- Clinical biomarker tracking (LDL, HbA1c, ApoB, BP)
- Medication management with adherence tracking
- PDF-printable clinician report

## Supabase Tables (7 total)
| Table | Rows | Purpose |
|-------|------|---------|
| `profile` | 1 | Patient profile (Shahbaz) |
| `vitals` | 1,318,961 | Apple Watch telemetry (HR, HRV, SpO2, steps, etc.) |
| `body_composition` | 1,442 | Weight, BMI, body fat from Apple Health |
| `daily_summary` | 3,141 | Pre-computed daily aggregates + health score |
| `health_insights` | 10 | AI-generated trend insights |
| `medications` | 3 | Active medication regimen (Rosuvastatin, Bisoprolol, Aspirin) |
| `medication_log` | 90+ | Daily adherence log (taken/missed per med per day) |
| `lab_results` | 34 | LDL, Total Chol, HDL, Triglycerides, HbA1c, ApoB, Lp(a), BP |

## File Structure
```
src/
  App.jsx                    # Main app - 7-tab dashboard, Supabase data loading
  App.css                    # Dark theme, CSS variables
  components/
    KuzburyChat.jsx          # AI cardiologist chat (Gemini + voice)
    KuzburyChat.css
    MedicationManager.jsx    # CRUD meds, Log Dose, adherence heatmap (Supabase-connected)
    MedicationManager.css
    GlidePathChart.jsx       # Reusable biometric trend chart with clinical target bands
    ClinicianReport.jsx      # A4 printable PDF report (live Supabase data)
    ClinicianReport.css
    VoiceCapture.jsx         # Standalone voice capture (orphaned - not rendered)
    VoiceCapture.css
  lib/
    gemini.js                # Gemini AI client (extraction schema + Kuzbury chat)
backend/
  app/main.py                # FastAPI skeleton (stub endpoints only)
  app/db/db_schemas.sql      # PostgreSQL + TimescaleDB + pgvector schema design
  requirements.txt
compute-summaries.mjs        # Node script: recompute daily_summary from raw vitals
import-data.mjs              # Node script: Apple Health XML ZIP import to Supabase
```

## What's Done (Priority 1 - Complete)
- [x] Apple Health data import pipeline
- [x] Dr. Kuzbury AI chat with Gemini 2.5 Flash
- [x] Voice dictation (Web Speech API)
- [x] Medication Manager wired to Supabase (CRUD, Log Dose, real adherence)
- [x] Clinical biomarkers from real `lab_results` table (no more Math.random())
- [x] Clinician Report pulling live data (adherence, vitals, meds, lab results)
- [x] Health score computation + insights generation
- [x] 7-tab dashboard UI with dark theme

## What's Next (Priority 2 - Security)
- [ ] Move Supabase credentials to `.env.local` (currently hardcoded in App.jsx, import-data.mjs, compute-summaries.mjs)
- [ ] Move Gemini API key to backend (stop exposing client-side)
- [ ] Add Supabase Auth for user login
- [ ] Enable proper RLS policies on all tables
- [ ] ElevenLabs voice agent integration (agent ID in .env but no code yet)

## What's Next (Priority 3 - Polish)
- [ ] Mobile responsive nav tabs
- [ ] Proper favicon and page title (currently "shahbaz-health-dashboard")
- [ ] Wire orphaned VoiceCapture.jsx or remove it
- [ ] Error handling for failed Supabase queries (loading/error states)
- [ ] FastAPI backend: connect real DB, move LLM calls server-side

## Key API Keys Needed
- `VITE_GEMINI_API_KEY` - Google Gemini (in .env.local)
- Supabase URL + anon key (currently hardcoded - needs migration to env vars)
- `VITE_ELEVENLABS_AGENT_ID` - ElevenLabs (in .env.local but unused)

## Important Notes
- Supabase anon key is hardcoded in 3 files - security risk, fix in Priority 2
- The `backend/` FastAPI is a stub - all AI calls currently happen client-side via Gemini
- `Prompt Solution/` directory in sibling project (shahbaz-health) is unrelated
- Build is clean: `npx vite build` passes with 0 errors
