# 📱 Phone-Friendly Setup Guide

**Complete setup from your phone in under 5 minutes**

---

## ⚠️ CRITICAL: Site Currently Broken

**The live site at shahbaz-heart-health.vercel.app is currently broken because:**

1. ❌ Hardcoded Supabase fallback keys were removed (security fix)
2. ❌ `VITE_SUPABASE_URL` not set in Vercel
3. ❌ `VITE_SUPABASE_ANON_KEY` not set in Vercel  
4. ❌ `XAI_API_KEY` not set in Vercel
5. ❌ RLS not enabled in Supabase (data currently unprotected)

**The app will show an error until you complete the 4 steps below.**

---

## 🚀 Quick Setup (4 Steps)

### Step 1: Get xAI API Key (2 minutes)
1. On your phone, go to [console.x.ai](https://console.x.ai/)
2. Sign in or create account
3. Go to **API Keys** → **Create New Key**
4. Copy the key (starts with `xai-...`)
5. **Keep this tab open** — you'll paste it in Step 2

### Step 2: Set Vercel Environment Variables (2 minutes)
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Open your project (shahbaz-health-dashboard)
3. Tap **Settings** → **Environment Variables**
4. Add these 3 variables (tap **Add** for each):

**Variable 1:**
- **Key:** `XAI_API_KEY`
- **Value:** (paste the key from Step 1)
- **Environments:** Select all 3 (Production, Preview, Development)
- Tap **Save**

**Variable 2:**
- **Key:** `VITE_SUPABASE_URL`
- **Value:** `https://ajgeanhsqhzrwtwfrkdu.supabase.co`
- **Environments:** Select all 3
- Tap **Save**

**Variable 3:**
- **Key:** `VITE_SUPABASE_ANON_KEY`
- **Value:** Get from [Supabase Dashboard](https://supabase.com/dashboard)
  - Open your project
  - Tap **Settings** → **API**
  - Copy the **anon public** key (long text starting with `eyJ...`)
  - Paste here
- **Environments:** Select all 3
- Tap **Save**

5. **Redeploy:** Tap **Deployments** → Latest deployment → **⋮** → **Redeploy**

### Step 3: Create Auth User (1 minute)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Your project → **Authentication** → **Users** → **Add User**
3. **Email:** Your email
4. **Auto Confirm User:** ✅ Turn ON
5. Leave password blank
6. Tap **Create User**
7. **Remember your email** — you need it for Step 4

### Step 4: Enable Security (1 minute)
1. Still in Supabase, tap **SQL Editor** → **New Query**
2. On your computer/tablet, go to the GitHub repo → `supabase-rls-migration.sql`
3. **Select all text** → Copy
4. Paste into SQL Editor on your phone
5. Tap **Run**
6. Wait for "Success. No rows returned."
7. In the same SQL Editor, type this (replace with your actual email):
   ```sql
   UPDATE app_config 
   SET owner_email = 'your@email.com', 
       updated_at = NOW();
   ```
8. Tap **Run** again

---

## ✅ Done!

Your site is now:
- ✅ Live and working
- ✅ Secured with authentication
- ✅ Protected with Row-Level Security
- ✅ Using xAI Grok (latest models)

**Test it:**
1. Go to [shahbaz-heart-health.vercel.app](https://shahbaz-heart-health.vercel.app)
2. Sign in with your email
3. Check email for magic link
4. Click link → dashboard loads

---

## 🐛 Troubleshooting

**"Missing Supabase configuration" error:**
- Go back to Step 2 and verify all 3 env vars are set in Vercel

**"AI service unavailable":**
- Check `XAI_API_KEY` is correct in Vercel

**Login works but no data:**
- Make sure you ran the UPDATE command in Step 4 with your actual email

**Still broken?**
- Vercel → **Deployments** → Latest → View logs
- Look for error messages

---

## 📋 What Changed (Technical)

**Security fixes applied:**
- Removed all hardcoded API keys
- Moved AI calls to server-side (Vercel functions)
- Added Supabase Auth (magic link login)
- Enabled Row-Level Security (owner-only data access)
- Upgraded to latest xAI Grok models (`grok-beta`, `grok-vision-beta`)

**Models now used:**
- `grok-beta` — Chat, insights, daily briefing
- `grok-vision-beta` — Medicine labels, lab reports, ECG scanning

**RLS Migration:**
- No manual UUID editing required
- Just paste and run, then update one email

---

**Total setup time: ~5 minutes from your phone**
