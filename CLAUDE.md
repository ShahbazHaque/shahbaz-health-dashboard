# Health Dashboard — Project Context

**Last Updated:** 2026-10-14 (Security Hardening Complete)
**Priority:** PRODUCTION-READY

---

## ⚠️ SECURITY NOTICE
This file previously contained sensitive information (API keys, personal medical details). 
All secrets have been removed and the codebase has been secured.

See **SECURITY_SETUP.md** for complete setup instructions.

---

## Mission
Build a secure, AI-powered personal health monitoring dashboard.

## Stack
- **Frontend:** React 19 + Vite 7
- **Database:** Supabase (PostgreSQL with RLS)
- **AI:** xAI Grok 2 Vision (server-side calls only)
- **Auth:** Supabase Auth (magic link)
- **Deployment:** Vercel
- **URL:** https://shahbaz-heart-health.vercel.app

---

## Environment Variables (Required)

All configuration is via environment variables. No hardcoded keys.

**Local development** (`.env.local`):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
XAI_API_KEY=your_xai_api_key_here
```

**Production** (Vercel Dashboard → Environment Variables):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `XAI_API_KEY` (for serverless functions)

See `.env.example` for complete list.

---

## Security Features

✅ **Authentication:** Supabase magic link (no passwords)
✅ **Row-Level Security:** Owner-only database access
✅ **Server-Side AI:** All Grok API calls via Vercel functions
✅ **No Secrets in Code:** All keys from env vars only
✅ **Migration SQL:** `supabase-rls-migration.sql` ready to apply

---

## Database Schema

10 tables with RLS enabled:
- `profile` — Patient profile (1 row)
- `vitals` — HR, HRV, BP, SpO2, steps
- `body_composition` — Weight, BMI, body fat
- `daily_summary` — Pre-computed aggregates
- `health_insights` — AI-generated insights
- `medications` — Active medication list
- `medication_log` — Daily adherence
- `lab_results` — Lab test results
- `ecg_results` — ECG findings
- `exercise_log` — Workout sessions

---

## Key Features

### AI Intelligence (xAI Grok)
- **Dr. Kuzbury Chat:** Clinical AI assistant with live patient context
- **Vision Scanning:** Medicine labels, lab reports, ECG printouts
- **Trend Insights:** 90-day pattern analysis
- **Daily Briefings:** Personalized morning summaries
- **Voice Dictation:** Structured health logging

### Data Capture
- Apple Health XML import (HR, HRV, steps, weight, BP)
- Fitbit/Google Health API sync
- Quick BP logger (floating action button)
- Lab result manual entry + photo scan
- Exercise logging
- Weight tracking

### Clinical Dashboard
- 8-tab interface: Overview, Medications, Vitals, Body, Clinical, Insights, Add Data, Report
- 100-point cardiovascular health score
- Medication adherence heatmap
- Clinician-ready PDF report
- Clinical target bands (ESC 2024, AHA 2025 guidelines)

---

## Completed Security Hardening

### ✅ Phase 1: Remove Secrets from Code
- [x] Removed all hardcoded API keys
- [x] Removed hardcoded Supabase credentials
- [x] Updated all scripts (import-data.mjs, import-fitbit.mjs, compute-summaries.mjs)
- [x] Created `.env.example`
- [x] Deleted duplicate "Shahbaz Healthcare App/" folder

### ✅ Phase 2: Server-Side AI
- [x] Created 5 Vercel serverless functions under `/api`:
  - `chat.js` — Dr. Kuzbury chat
  - `scan-vision.js` — Medicine/lab/ECG scanning
  - `generate-insights.js` — 90-day trend analysis
  - `daily-briefing.js` — Morning summary
  - `extract-voice.js` — Voice transcription parsing
- [x] Replaced `@google/generative-ai` with `openai` package (xAI compatible)
- [x] Created new `src/lib/xai.js` client library
- [x] Updated all components to use new API endpoints
- [x] Removed all client-side AI key access

### ✅ Phase 3: Authentication
- [x] Created `AuthGate.jsx` component (magic link UI)
- [x] Integrated Auth wrapper in `App.jsx`
- [x] Added sign-out button

### ✅ Phase 4: Row-Level Security
- [x] Created `supabase-rls-migration.sql` with owner-only policies
- [x] Documented manual migration steps in SECURITY_SETUP.md

### ✅ Phase 5: Documentation
- [x] Comprehensive README.md
- [x] Complete SECURITY_SETUP.md guide
- [x] Redacted CLAUDE.md (this file)
- [x] Redacted HANDOVER.md
- [x] Redacted COWORK_MIGRATION.md

---

## Setup Instructions

**For the owner to deploy:**

1. **Clone repo and install:**
   ```bash
   git clone <repo-url>
   cd shahbaz-health-dashboard
   npm install
   ```

2. **Follow SECURITY_SETUP.md step-by-step:**
   - Get new xAI API key
   - Configure Supabase env vars
   - Create auth user in Supabase
   - Run RLS migration (replace UUID)
   - Test authentication locally
   - Set Vercel env vars
   - Deploy to Vercel
   - Test production

3. **Build verification:**
   ```bash
   npm run build  # Must succeed with no errors
   ```

---

## Known Issues (Post-Security)

1. **Build must pass:** Verify `npm run build` succeeds before deploying
2. **RLS not auto-applied:** Owner must manually run migration in Supabase
3. **Auth user required:** Must create user before testing
4. **ENV vars in Vercel:** Must be set before first deploy

---

## Session Startup Checklist (For Development)

1. Check `.env.local` exists with valid keys
2. Run `npm run dev`
3. Open http://localhost:5173
4. Test auth flow
5. Verify all tabs load
6. Test AI chat and scanning

---

## Git History Note

If you cloned this repo before 2026-10-14, the git history may contain:
- Old Google Gemini API key (revoked)
- Personal medical information
- Hardcoded Supabase keys

**Recommendation:** See SECURITY_SETUP.md Step 8 for git history cleanup.

---

## Current Sprint Status

**All security sprints complete:**
- Sprint 1-5: Features ✅ (completed earlier)
- Sprint 6: Security & Polish ✅ (completed 2026-10-14)

**Next up:** Owner deploys to production following SECURITY_SETUP.md

---

## Links

- **Live Site:** https://shahbaz-heart-health.vercel.app
- **GitHub:** (private repository recommended)
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Vercel Dashboard:** https://vercel.com/dashboard
- **xAI Console:** https://console.x.ai/

---

**All sensitive information has been removed from this file. For configuration, see .env.example and SECURITY_SETUP.md.**
