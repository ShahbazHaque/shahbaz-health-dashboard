-- ============================================================================
-- Supabase RLS (Row Level Security) Migration
-- Health Dashboard - Single Owner Security Model
-- ============================================================================
-- 
-- PHONE-FRIENDLY: Just paste and run - no manual editing required!
-- 
-- How it works:
-- 1. Create an app_config table with a single row storing the owner's email
-- 2. RLS policies check if auth.email() matches the owner email in app_config
-- 3. All health data is accessible only to the authenticated owner
--
-- Instructions:
-- 1. Create your auth user first: Supabase Dashboard > Authentication > Users > Add User
-- 2. Paste this ENTIRE file into: Supabase Dashboard > SQL Editor > New Query
-- 3. Click "Run" - that's it!
-- 
-- ============================================================================

-- Step 1: Create app_config table to store owner email
CREATE TABLE IF NOT EXISTS app_config (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE,
    owner_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = TRUE)
);

-- Insert placeholder owner email (update this after running the migration)
-- IMPORTANT: After running this migration, update the owner_email with your actual auth user email:
-- UPDATE app_config SET owner_email = 'your_actual_email@example.com', updated_at = NOW();
INSERT INTO app_config (owner_email)
VALUES ('PLACEHOLDER_EMAIL_UPDATE_AFTER_MIGRATION@example.com')
ON CONFLICT (id) DO NOTHING;

-- Disable RLS on app_config (it's a single-row config table, doesn't need RLS)
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config readable by authenticated users" ON app_config
    FOR SELECT USING (auth.role() = 'authenticated');

-- Step 2: Helper function to check if current user is the owner
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM app_config
        WHERE owner_email = auth.email()
    );
$$;

-- Step 3: Enable RLS on all health tables
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_composition ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecg_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_log ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if any (idempotent)
DO $$ 
BEGIN
    -- Profile
    DROP POLICY IF EXISTS "Owner can view profile" ON profile;
    DROP POLICY IF EXISTS "Owner can update profile" ON profile;
    
    -- Vitals
    DROP POLICY IF EXISTS "Owner can view vitals" ON vitals;
    DROP POLICY IF EXISTS "Owner can insert vitals" ON vitals;
    DROP POLICY IF EXISTS "Owner can update vitals" ON vitals;
    DROP POLICY IF EXISTS "Owner can delete vitals" ON vitals;
    
    -- Body composition
    DROP POLICY IF EXISTS "Owner can view body_composition" ON body_composition;
    DROP POLICY IF EXISTS "Owner can insert body_composition" ON body_composition;
    DROP POLICY IF EXISTS "Owner can update body_composition" ON body_composition;
    DROP POLICY IF EXISTS "Owner can delete body_composition" ON body_composition;
    
    -- Daily summary
    DROP POLICY IF EXISTS "Owner can view daily_summary" ON daily_summary;
    DROP POLICY IF EXISTS "Owner can insert daily_summary" ON daily_summary;
    DROP POLICY IF EXISTS "Owner can update daily_summary" ON daily_summary;
    DROP POLICY IF EXISTS "Owner can delete daily_summary" ON daily_summary;
    
    -- Health insights
    DROP POLICY IF EXISTS "Owner can view health_insights" ON health_insights;
    DROP POLICY IF EXISTS "Owner can insert health_insights" ON health_insights;
    DROP POLICY IF EXISTS "Owner can update health_insights" ON health_insights;
    DROP POLICY IF EXISTS "Owner can delete health_insights" ON health_insights;
    
    -- Medications
    DROP POLICY IF EXISTS "Owner can view medications" ON medications;
    DROP POLICY IF EXISTS "Owner can insert medications" ON medications;
    DROP POLICY IF EXISTS "Owner can update medications" ON medications;
    DROP POLICY IF EXISTS "Owner can delete medications" ON medications;
    
    -- Medication log
    DROP POLICY IF EXISTS "Owner can view medication_log" ON medication_log;
    DROP POLICY IF EXISTS "Owner can insert medication_log" ON medication_log;
    DROP POLICY IF EXISTS "Owner can update medication_log" ON medication_log;
    DROP POLICY IF EXISTS "Owner can delete medication_log" ON medication_log;
    
    -- Lab results
    DROP POLICY IF EXISTS "Owner can view lab_results" ON lab_results;
    DROP POLICY IF EXISTS "Owner can insert lab_results" ON lab_results;
    DROP POLICY IF EXISTS "Owner can update lab_results" ON lab_results;
    DROP POLICY IF EXISTS "Owner can delete lab_results" ON lab_results;
    
    -- ECG results
    DROP POLICY IF EXISTS "Owner can view ecg_results" ON ecg_results;
    DROP POLICY IF EXISTS "Owner can insert ecg_results" ON ecg_results;
    DROP POLICY IF EXISTS "Owner can update ecg_results" ON ecg_results;
    DROP POLICY IF EXISTS "Owner can delete ecg_results" ON ecg_results;
    
    -- Exercise log
    DROP POLICY IF EXISTS "Owner can view exercise_log" ON exercise_log;
    DROP POLICY IF EXISTS "Owner can insert exercise_log" ON exercise_log;
    DROP POLICY IF EXISTS "Owner can update exercise_log" ON exercise_log;
    DROP POLICY IF EXISTS "Owner can delete exercise_log" ON exercise_log;
END $$;

-- Step 5: Create owner-only policies using is_owner() function

-- Profile table
CREATE POLICY "Owner can view profile" ON profile
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can update profile" ON profile
    FOR UPDATE USING (is_owner());

-- Vitals table
CREATE POLICY "Owner can view vitals" ON vitals
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert vitals" ON vitals
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update vitals" ON vitals
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete vitals" ON vitals
    FOR DELETE USING (is_owner());

-- Body composition table
CREATE POLICY "Owner can view body_composition" ON body_composition
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert body_composition" ON body_composition
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update body_composition" ON body_composition
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete body_composition" ON body_composition
    FOR DELETE USING (is_owner());

-- Daily summary table
CREATE POLICY "Owner can view daily_summary" ON daily_summary
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert daily_summary" ON daily_summary
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update daily_summary" ON daily_summary
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete daily_summary" ON daily_summary
    FOR DELETE USING (is_owner());

-- Health insights table
CREATE POLICY "Owner can view health_insights" ON health_insights
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert health_insights" ON health_insights
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update health_insights" ON health_insights
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete health_insights" ON health_insights
    FOR DELETE USING (is_owner());

-- Medications table
CREATE POLICY "Owner can view medications" ON medications
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert medications" ON medications
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update medications" ON medications
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete medications" ON medications
    FOR DELETE USING (is_owner());

-- Medication log table
CREATE POLICY "Owner can view medication_log" ON medication_log
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert medication_log" ON medication_log
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update medication_log" ON medication_log
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete medication_log" ON medication_log
    FOR DELETE USING (is_owner());

-- Lab results table
CREATE POLICY "Owner can view lab_results" ON lab_results
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert lab_results" ON lab_results
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update lab_results" ON lab_results
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete lab_results" ON lab_results
    FOR DELETE USING (is_owner());

-- ECG results table
CREATE POLICY "Owner can view ecg_results" ON ecg_results
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert ecg_results" ON ecg_results
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update ecg_results" ON ecg_results
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete ecg_results" ON ecg_results
    FOR DELETE USING (is_owner());

-- Exercise log table
CREATE POLICY "Owner can view exercise_log" ON exercise_log
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert exercise_log" ON exercise_log
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update exercise_log" ON exercise_log
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete exercise_log" ON exercise_log
    FOR DELETE USING (is_owner());

-- ============================================================================
-- Post-Migration: Update Owner Email
-- ============================================================================
-- Run this command separately AFTER creating your auth user:
-- 
-- UPDATE app_config 
-- SET owner_email = 'your_actual_email@example.com', 
--     updated_at = NOW();
--
-- Replace 'your_actual_email@example.com' with the email you used when 
-- creating the auth user in Step 1.
-- ============================================================================

-- ============================================================================
-- Verification queries (run AFTER updating owner_email)
-- ============================================================================

-- Check that RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'profile', 'vitals', 'body_composition', 'daily_summary', 
    'health_insights', 'medications', 'medication_log', 
    'lab_results', 'ecg_results', 'exercise_log', 'app_config'
)
ORDER BY tablename;

-- Check owner email is set
SELECT owner_email, created_at, updated_at FROM app_config;

-- List all policies
SELECT schemaname, tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- ============================================================================
-- Success! RLS is now enabled with email-based owner verification.
-- No manual UUID editing required - just update the owner_email after running.
-- ============================================================================
