# 🏥 Personal Health Dashboard

A secure, AI-powered cardiovascular health monitoring dashboard built with React, Vite, Supabase, and xAI Grok.

**Live Demo:** [https://shahbaz-heart-health.vercel.app](https://shahbaz-heart-health.vercel.app)

---

## 🌟 Features

### 📊 **Comprehensive Health Tracking**
- **Vital Signs Monitoring**: Heart rate, HRV, Blood pressure, SpO2, Respiratory rate
- **Body Composition**: Weight, BMI, Body fat percentage, Lean mass
- **Lab Results Management**: LDL, HDL, Cholesterol, Triglycerides, HbA1c, ApoB, Lp(a)
- **ECG Reports**: Upload and AI-extract ECG findings
- **Medication Tracking**: Full CRUD, dosage logging, 14-day adherence heatmap
- **Exercise Logging**: Track workouts, duration, intensity, HR zones
- **Daily Health Score**: 100-point cardiovascular recovery index

### 🤖 **AI-Powered Clinical Intelligence**
- **Dr. Kuzbury AI Cardiologist**: Chat interface with real-time patient context
- **AI-Generated Insights**: 90-day trend analysis with actionable recommendations
- **Daily Health Briefings**: Personalized morning summary with clinical guidance
- **Voice Dictation**: Hands-free health logging with structured data extraction
- **Vision AI Scanning**: Medicine labels, lab reports, ECG printouts

### 🔒 **Security & Privacy**
- **Supabase Authentication**: Email magic link (no passwords)
- **Row-Level Security (RLS)**: Owner-only database access
- **Server-Side AI Calls**: No API keys exposed to browser
- **HIPAA-Aware Architecture**: Encrypted data at rest and in transit

### 📱 **Modern UX**
- **8-Tab Dashboard**: Overview, Medications, Vitals, Body, Clinical, Insights, Add Data, Report
- **Dark Theme**: Eye-friendly cardiovascular health UI
- **Mobile Responsive**: Works on desktop, tablet, and phone
- **Printable Reports**: A4-format clinician summary for appointments
- **Apple Health Import**: One-click sync from iPhone Health app export

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 7, Recharts 3 |
| **Backend** | Vercel Serverless Functions (Node.js) |
| **Database** | Supabase (PostgreSQL) |
| **AI** | xAI Grok 2 Vision (via OpenAI-compatible API) |
| **Auth** | Supabase Auth (Magic Link) |
| **Deployment** | Vercel |
| **Data Import** | Apple Health XML, Fitbit API, Manual Entry |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase project
- xAI API key from [console.x.ai](https://console.x.ai/)
- Vercel account (for deployment)

### 1. Clone and Install
```bash
git clone https://github.com/ShahbazHaque/shahbaz-health-dashboard.git
cd shahbaz-health-dashboard
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
XAI_API_KEY=your_xai_api_key
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 4. Build for Production
```bash
npm run build
npm run preview  # Test production build locally
```

---

## 📦 Deployment

### Deploy to Vercel

1. **Push to GitHub** (make sure `.env.local` is in `.gitignore`)
2. **Connect Vercel** to your GitHub repo
3. **Set Environment Variables** in Vercel Dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `XAI_API_KEY` (for serverless functions)
4. **Deploy** — Vercel auto-builds from `main` branch

---

## 🔐 Security Setup

⚠️ **CRITICAL: Before going live, follow the complete security setup guide:**

See **[SECURITY_SETUP.md](./SECURITY_SETUP.md)** for:
- Supabase RLS migration instructions
- Auth user creation
- API key rotation
- Making the repository private
- Git history cleanup (optional)

---

## 📊 Database Schema

The app uses 9+ Supabase tables with Row-Level Security:

| Table | Description | Rows |
|-------|-------------|------|
| `profile` | Patient profile | 1 |
| `vitals` | Heart rate, HRV, BP, SpO2, steps | ~1.3M |
| `body_composition` | Weight, BMI, body fat | ~1.4K |
| `daily_summary` | Pre-computed daily aggregates | ~3.1K |
| `health_insights` | AI-generated insights | ~10 |
| `medications` | Active medication regimen | ~3 |
| `medication_log` | Daily adherence logs | ~90+ |
| `lab_results` | Lab test results | ~34 |
| `ecg_results` | ECG findings | Variable |
| `exercise_log` | Workout sessions | Variable |

---

## 🧪 Import Data

### Apple Health Export
1. iPhone → Health app → Profile → Export All Health Data
2. Upload the ZIP file via **Add Data** tab
3. Import processes vitals, body composition, steps, HR, HRV

```bash
# Or via CLI:
node import-data.mjs ~/Downloads/export.zip
```

### Fitbit/Google Health API
```bash
node import-fitbit.mjs --client-id YOUR_ID --client-secret YOUR_SECRET
```

### Manual Entry
- **Quick BP Logger**: Floating action button on Overview/Vitals tabs
- **Lab Results Form**: Manual entry or AI scan of lab report photo
- **Medicine Labels**: Photo scan with AI extraction
- **ECG Reports**: Upload printout image for AI interpretation

---

## 🤖 AI Models Used

| Function | Model | Endpoint |
|----------|-------|----------|
| **Chat** | `grok-beta` | `/api/chat` |
| **Vision** | `grok-vision-beta` | `/api/scan-vision` |
| **Insights** | `grok-beta` | `/api/generate-insights` |
| **Daily Briefing** | `grok-beta` | `/api/daily-briefing` |
| **Voice Extraction** | `grok-beta` | `/api/extract-voice` |

All AI calls are server-side Vercel functions — no API keys in the browser.

---

## 📝 Project Structure

```
shahbaz-health-dashboard/
├── api/                        # Vercel serverless functions
│   ├── chat.js                 # Dr. Kuzbury chat endpoint
│   ├── scan-vision.js          # Medicine/lab/ECG scanning
│   ├── generate-insights.js    # 90-day trend insights
│   ├── daily-briefing.js       # Morning health summary
│   └── extract-voice.js        # Voice transcription parsing
├── src/
│   ├── components/
│   │   ├── AuthGate.jsx        # Supabase Auth wrapper
│   │   ├── KuzburyChat.jsx     # AI chat interface
│   │   ├── MedicationManager.jsx
│   │   ├── DataCapture.jsx     # Multi-modal data entry
│   │   ├── BPLogger.jsx
│   │   ├── LabEntryForm.jsx
│   │   ├── ExerciseLogger.jsx
│   │   ├── GlidePathChart.jsx  # Clinical trend chart
│   │   └── ClinicianReport.jsx # PDF-ready A4 report
│   ├── lib/
│   │   ├── xai.js              # xAI Grok client functions
│   │   └── patientProfile.js   # Profile utilities
│   ├── App.jsx                 # Main 8-tab dashboard
│   └── App.css
├── import-data.mjs             # Apple Health XML importer
├── import-fitbit.mjs           # Fitbit API sync
├── compute-summaries.mjs       # Daily summary recomputation
├── supabase-rls-migration.sql  # Database security policies
├── package.json
├── .env.example
├── SECURITY_SETUP.md           # 🔒 Complete security guide
└── README.md                   # This file
```

---

## 🧑‍⚕️ Clinical Targets

The dashboard is configured for **post-MI secondary prevention** based on:
- **ESC 2024 Guidelines** (European Society of Cardiology)
- **AHA 2025 ASCVD Protocol** (American Heart Association)

**Target Metrics:**
- **LDL-C**: <55 mg/dL (<1.4 mmol/L)
- **Blood Pressure**: <130/80 mmHg
- **Resting Heart Rate**: 55-65 bpm (beta-blocker optimized)
- **HbA1c**: <5.7% (non-diabetic)
- **Medication Adherence**: ≥95%

---

## 📜 License

This project is for personal health management use. Not licensed for commercial distribution.

**Medical Disclaimer:** This dashboard is a data visualization and tracking tool. It does NOT provide medical advice, diagnosis, or treatment. Always consult licensed healthcare professionals for medical decisions. The AI assistant (Dr. Kuzbury) is for informational purposes only and should never replace professional medical care.

---

## 🤝 Contributing

This is a personal health project and is not currently accepting external contributions.

---

## 📧 Support

For setup questions or technical issues, open a GitHub issue.

---

## 🔗 Links

- **Supabase**: [supabase.com](https://supabase.com)
- **xAI Grok API**: [console.x.ai](https://console.x.ai/)
- **Vercel**: [vercel.com](https://vercel.com)
- **React**: [react.dev](https://react.dev)
- **Vite**: [vite.dev](https://vite.dev)

---

**Built with ❤️ for personal cardiovascular health management**
