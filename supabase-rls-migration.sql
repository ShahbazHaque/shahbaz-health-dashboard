-- ============================================================================
-- Supabase RLS (Row Level Security) Migration
-- Health Dashboard - Single Owner Security Model
-- ============================================================================
-- 
-- IMPORTANT: DO NOT RUN THIS AUTOMATICALLY ON THE LIVE DATABASE
-- 
-- Instructions:
-- 1. Make sure the owner's auth user is created in Supabase Auth
-- 2. Identify the owner's user ID (UUID) from Supabase Dashboard > Authentication > Users
-- 3. Replace 'YOUR_USER_ID_HERE' below with the actual UUID
-- 4. Review all policies carefully
-- 5. Run this migration in Supabase Dashboard > SQL Editor
-- 6. Test authentication and data access thoroughly
-- 
-- ============================================================================

-- Step 1: Enable RLS on all health tables
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

-- Step 2: Drop existing policies if any
DROP POLICY IF EXISTS "Owner can view profile" ON profile;
DROP POLICY IF EXISTS "Owner can update profile" ON profile;
DROP POLICY IF EXISTS "Owner can view vitals" ON vitals;
DROP POLICY IF EXISTS "Owner can insert vitals" ON vitals;
DROP POLICY IF EXISTS "Owner can update vitals" ON vitals;
DROP POLICY IF EXISTS "Owner can delete vitals" ON vitals;
DROP POLICY IF EXISTS "Owner can view body_composition" ON body_composition;
DROP POLICY IF EXISTS "Owner can insert body_composition" ON body_composition;
DROP POLICY IF EXISTS "Owner can update body_composition" ON body_composition;
DROP POLICY IF EXISTS "Owner can delete body_composition" ON body_composition;
DROP POLICY IF EXISTS "Owner can view daily_summary" ON daily_summary;
DROP POLICY IF EXISTS "Owner can insert daily_summary" ON daily_summary;
DROP POLICY IF EXISTS "Owner can update daily_summary" ON daily_summary;
DROP POLICY IF EXISTS "Owner can delete daily_summary" ON daily_summary;
DROP POLICY IF EXISTS "Owner can view health_insights" ON health_insights;
DROP POLICY IF EXISTS "Owner can insert health_insights" ON health_insights;
DROP POLICY IF EXISTS "Owner can update health_insights" ON health_insights;
DROP POLICY IF EXISTS "Owner can delete health_insights" ON health_insights;
DROP POLICY IF EXISTS "Owner can view medications" ON medications;
DROP POLICY IF EXISTS "Owner can insert medications" ON medications;
DROP POLICY IF EXISTS "Owner can update medications" ON medications;
DROP POLICY IF EXISTS "Owner can delete medications" ON medications;
DROP POLICY IF EXISTS "Owner can view medication_log" ON medication_log;
DROP POLICY IF EXISTS "Owner can insert medication_log" ON medication_log;
DROP POLICY IF EXISTS "Owner can update medication_log" ON medication_log;
DROP POLICY IF EXISTS "Owner can delete medication_log" ON medication_log;
DROP POLICY IF EXISTS "Owner can view lab_results" ON lab_results;
DROP POLICY IF EXISTS "Owner can insert lab_results" ON lab_results;
DROP POLICY IF EXISTS "Owner can update lab_results" ON lab_results;
DROP POLICY IF EXISTS "Owner can delete lab_results" ON lab_results;
DROP POLICY IF EXISTS "Owner can view ecg_results" ON ecg_results;
DROP POLICY IF EXISTS "Owner can insert ecg_results" ON ecg_results;
DROP POLICY IF EXISTS "Owner can update ecg_results" ON ecg_results;
DROP POLICY IF EXISTS "Owner can delete ecg_results" ON ecg_results;
DROP POLICY IF EXISTS "Owner can view exercise_log" ON exercise_log;
DROP POLICY IF EXISTS "Owner can insert exercise_log" ON exercise_log;
DROP POLICY IF EXISTS "Owner can update exercise_log" ON exercise_log;
DROP POLICY IF EXISTS "Owner can delete exercise_log" ON exercise_log;

-- Step 3: Create owner-only policies for each table
-- Replace 'YOUR_USER_ID_HERE' with the actual user UUID

-- Profile table
CREATE POLICY "Owner can view profile" ON profile
    FOR SELECT USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can update profile" ON profile
    FOR UPDATE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

-- Vitals table
CREATE POLICY "Owner can view vitals" ON vitals
    FOR SELECT USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can insert vitals" ON vitals
    FOR INSERT WITH CHECK (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can update vitals" ON vitals
    FOR UPDATE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can delete vitals" ON vitals
    FOR DELETE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

-- Body composition table
CREATE POLICY "Owner can view body_composition" ON body_composition
    FOR SELECT USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can insert body_composition" ON body_composition
    FOR INSERT WITH CHECK (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can update body_composition" ON body_composition
    FOR UPDATE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can delete body_composition" ON body_composition
    FOR DELETE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

-- Daily summary table
CREATE POLICY "Owner can view daily_summary" ON daily_summary
    FOR SELECT USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can insert daily_summary" ON daily_summary
    FOR INSERT WITH CHECK (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can update daily_summary" ON daily_summary
    FOR UPDATE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can delete daily_summary" ON daily_summary
    FOR DELETE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

-- Health insights table
CREATE POLICY "Owner can view health_insights" ON health_insights
    FOR SELECT USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can insert health_insights" ON health_insights
    FOR INSERT WITH CHECK (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can update health_insights" ON health_insights
    FOR UPDATE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can delete health_insights" ON health_insights
    FOR DELETE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

-- Medications table
CREATE POLICY "Owner can view medications" ON medications
    FOR SELECT USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can insert medications" ON medications
    FOR INSERT WITH CHECK (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can update medications" ON medications
    FOR UPDATE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can delete medications" ON medications
    FOR DELETE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

-- Medication log table
CREATE POLICY "Owner can view medication_log" ON medication_log
    FOR SELECT USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can insert medication_log" ON medication_log
    FOR INSERT WITH CHECK (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can update medication_log" ON medication_log
    FOR UPDATE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can delete medication_log" ON medication_log
    FOR DELETE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

-- Lab results table
CREATE POLICY "Owner can view lab_results" ON lab_results
    FOR SELECT USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can insert lab_results" ON lab_results
    FOR INSERT WITH CHECK (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can update lab_results" ON lab_results
    FOR UPDATE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can delete lab_results" ON lab_results
    FOR DELETE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

-- ECG results table
CREATE POLICY "Owner can view ecg_results" ON ecg_results
    FOR SELECT USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can insert ecg_results" ON ecg_results
    FOR INSERT WITH CHECK (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can update ecg_results" ON ecg_results
    FOR UPDATE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can delete ecg_results" ON ecg_results
    FOR DELETE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

-- Exercise log table
CREATE POLICY "Owner can view exercise_log" ON exercise_log
    FOR SELECT USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can insert exercise_log" ON exercise_log
    FOR INSERT WITH CHECK (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can update exercise_log" ON exercise_log
    FOR UPDATE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

CREATE POLICY "Owner can delete exercise_log" ON exercise_log
    FOR DELETE USING (auth.uid() = 'YOUR_USER_ID_HERE'::uuid);

-- ============================================================================
-- Verification queries (run AFTER migration)
-- ============================================================================

-- Check that RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'profile', 'vitals', 'body_composition', 'daily_summary', 
    'health_insights', 'medications', 'medication_log', 
    'lab_results', 'ecg_results', 'exercise_log'
)
ORDER BY tablename;

-- List all policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
