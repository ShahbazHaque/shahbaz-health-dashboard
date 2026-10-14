# 🔒 Security Setup Guide

**IMPORTANT:** Complete ALL steps below before deploying to production or making the repository public.

---

## ⚠️ Current Security Issues (Before Setup)

If you've just cloned this repository, the following security gaps exist:
- ✅ **FIXED:** No hardcoded API keys in source code
- ✅ **FIXED:** All AI calls moved to server-side Vercel functions
- ✅ **FIXED:** Hardcoded Supabase keys removed
- ⚠️ **TODO:** Supabase Row-Level Security (RLS) not yet enabled
- ⚠️ **TODO:** Auth user not yet created
- ⚠️ **TODO:** Repository may still contain sensitive information in git history

---

## 🛠️ Complete Security Setup (Step-by-Step)

### Step 1: Rotate xAI API Key (If Previously Exposed)

If you previously had an xAI or Gemini API key committed to this repository:

1. **Revoke old key:**
   - Go to [https://console.x.ai/](https://console.x.ai/) (or Google AI Studio if using old Gemini key)
   - Delete the compromised API key immediately

2. **Generate new xAI key:**
   - In xAI Console → **API Keys** → **Create New Key**
   - Copy the key (starts with `xai-...` or similar)
   - **NEVER commit this key to git**

3. **Set in Vercel:**
   - Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
   - Add `XAI_API_KEY` = `your_new_key_here`
   - Scope: **Production, Preview, Development** (select all)
   - Click **Save**

---

### Step 2: Configure Supabase Environment Variables

1. **Get Supabase credentials:**
   - Open [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project → **Settings** → **API**
   - Copy:
     - **Project URL** (e.g., `https://abcdefghij.supabase.co`)
     - **anon public** key (long JWT string starting with `eyJ...`)

2. **Set in Vercel:**
   - `VITE_SUPABASE_URL` = `your_project_url`
   - `VITE_SUPABASE_ANON_KEY` = `your_anon_key`

3. **Set in local development:**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your actual values. **NEVER commit `.env.local` to git.**

---

### Step 3: Create Supabase Auth User

1. **Go to Supabase Dashboard:**
   - Your Project → **Authentication** → **Users** → **Add User**

2. **Create owner account:**
   - **Email:** Your personal email (the one that will access the dashboard)
   - **Password:** Leave blank (we use magic link, no passwords)
   - **Auto Confirm User:** ✅ Yes
   - Click **Create User**

3. **Note your email:**
   - Remember the email you used — you'll need it in Step 4

---

### Step 4: Enable Row-Level Security (RLS)

This is **CRITICAL** — without RLS, your health data is accessible to anyone with your Supabase URL.

**✨ NEW: Phone-friendly migration — no manual editing required!**

1. **Open Supabase Dashboard:**
   - Your Project → **SQL Editor** → **New Query**

2. **Copy the entire migration:**
   - Open `supabase-rls-migration.sql` from this repository
   - Select ALL text (Ctrl+A or Cmd+A)
   - Copy to clipboard

3. **Paste and run:**
   - Paste into Supabase SQL Editor
   - Click **Run**
   - Wait for "Success. No rows returned."

4. **Update owner email (one command):**
   - In the same SQL Editor, run this single command:
   ```sql
   UPDATE app_config 
   SET owner_email = 'your_actual_email@example.com', 
       updated_at = NOW();
   ```
   - Replace `your_actual_email@example.com` with the email from Step 3

5. **Verify it worked:**
   - Run this query:
   ```sql
   SELECT owner_email FROM app_config;
   ```
   - Should return your email

6. **Verify RLS is enabled:**
   - Run the verification queries at the bottom of the migration file
   - All tables should show `rowsecurity = true`

---

### Step 5: Test Authentication

**Before deploying to production, test the auth flow:**

1. **Local test:**
   ```bash
   npm run dev
   ```
   - Open [http://localhost:5173](http://localhost:5173)
   - You should see the **Auth Gate** login screen
   - Enter your email (the one you created in Step 3)
   - Check your email for the magic link
   - Click the link → should redirect and sign you in
   - Verify you can see the dashboard and load data

2. **Test sign-out:**
   - Click **Sign Out** button (top right)
   - Verify you're redirected to login screen
   - Verify data is no longer accessible

3. **Test with wrong email:**
   - Try signing in with a different email (not the owner)
   - Even if they get a magic link, they should see **empty tables** (RLS blocks access)

---

### Step 6: Deploy to Vercel

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Security setup: Remove secrets, add auth, enable RLS"
   git push origin main
   ```

2. **Trigger Vercel deployment:**
   - Vercel auto-deploys from `main` branch
   - Monitor build logs in Vercel Dashboard

3. **Test production:**
   - Visit your Vercel URL: `https://your-project.vercel.app`
   - Verify auth gate appears
   - Sign in and test all features

---

### Step 7: Make Repository Private (Recommended)

Even with secrets removed, health data schemas and AI prompts are visible in a public repo.

**GitHub:**
1. Go to your repo → **Settings** → **Danger Zone**
2. Click **Change visibility** → **Make private**
3. Confirm

**Benefits:**
- Medical history and clinical details stay private
- Patient profile information not publicly searchable
- AI prompts and data models remain confidential

---

### Step 8: Clean Git History (Optional but Recommended)

If you previously committed secrets, they're still in git history even after deletion.

⚠️ **WARNING:** This rewrites history. Coordinate with any collaborators first.

**Option A: Use BFG Repo-Cleaner (Easiest)**
```bash
# Install BFG (macOS)
brew install bfg

# Clone a fresh copy
git clone --mirror https://github.com/YourUsername/shahbaz-health-dashboard.git

# Remove file with secrets
cd shahbaz-health-dashboard.git
bfg --delete-files CLAUDE.md
bfg --delete-files HANDOVER.md
bfg --delete-files COWORK_MIGRATION.md

# Cleanup
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (⚠️ destructive!)
git push --force
```

**Option B: Start Fresh (Nuclear Option)**
```bash
# Export current clean code
git checkout main
tar -czf clean-code-backup.tar.gz .

# Delete .git folder and re-init
rm -rf .git
git init
git add .
git commit -m "Initial commit (clean)"

# Force push to GitHub
git remote add origin https://github.com/YourUsername/shahbaz-health-dashboard.git
git push -u --force origin main
```

---

## ✅ Security Checklist

Before going live, verify **ALL** items:

### API Keys
- [ ] Old xAI/Gemini API keys revoked
- [ ] New xAI API key generated and set in Vercel
- [ ] `XAI_API_KEY` never appears in source code
- [ ] `.env.local` is in `.gitignore` and never committed
- [ ] No API keys in git history (if cleaned)

### Supabase
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in Vercel
- [ ] No hardcoded Supabase credentials in source code
- [ ] Auth user created in Supabase Dashboard
- [ ] User UUID copied and ready for RLS migration

### Row-Level Security
- [ ] RLS migration SQL reviewed and UUID replaced
- [ ] Migration executed successfully in Supabase SQL Editor
- [ ] Owner email updated with single UPDATE command
- [ ] All 11 tables show `rowsecurity = true` (including app_config)
- [ ] Policies created for all tables (40+ total policies)
- [ ] Verification queries run successfully

### Authentication
- [ ] Auth tested locally (sign in, sign out)
- [ ] Auth tested in production
- [ ] Unauthorized emails cannot access data
- [ ] Magic link email delivery confirmed

### Deployment
- [ ] Vercel environment variables set
- [ ] Build passing (`npm run build` succeeds)
- [ ] Production site accessible
- [ ] All tabs and features working
- [ ] AI chat responding (no API key errors)
- [ ] Vision scanning working (medicine/lab/ECG)

### Repository
- [ ] Repository made private (if desired)
- [ ] Git history cleaned (if previously had secrets)
- [ ] No personal medical information in public files
- [ ] CLAUDE.md and HANDOVER.md redacted or deleted

---

## 🔐 Ongoing Security Best Practices

### DO:
- ✅ Rotate API keys every 90 days
- ✅ Use strong, unique Supabase project passwords
- ✅ Enable 2FA on Supabase, Vercel, xAI accounts
- ✅ Monitor Vercel function logs for suspicious activity
- ✅ Keep dependencies updated (`npm audit`, `npm update`)
- ✅ Back up Supabase data regularly (Project Settings → Database → Backups)

### DON'T:
- ❌ Commit API keys, even in comments or docs
- ❌ Share your Supabase service_role key (only use anon key)
- ❌ Disable RLS policies "temporarily" and forget to re-enable
- ❌ Use the same API key across multiple projects
- ❌ Store passwords in browser autofill for production accounts

---

## 🚨 Emergency: API Key Leaked

If you accidentally commit an API key:

1. **Immediately revoke it** in the provider's dashboard
2. **Generate a new key** and update Vercel/local env
3. **Force push a commit** that removes the key from HEAD
4. **Clean git history** (see Step 8 above)
5. **Make repo private** while cleaning
6. **Notify provider** (xAI, Supabase) if key was public >24 hours
7. **Monitor for unauthorized usage** in provider dashboards

---

## 📞 Need Help?

- **Supabase Auth Issues:** [https://supabase.com/docs/guides/auth](https://supabase.com/docs/guides/auth)
- **Vercel Environment Variables:** [https://vercel.com/docs/concepts/projects/environment-variables](https://vercel.com/docs/concepts/projects/environment-variables)
- **RLS Troubleshooting:** [https://supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security)
- **xAI API Docs:** [https://docs.x.ai/](https://docs.x.ai/)

---

**Once all steps are complete, you have a production-grade secure health dashboard. 🎉**
