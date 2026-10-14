-- ============================================================================
-- Supabase RLS (Row Level Security) Migration
-- Health Dashboard - Single Owner Security Model
-- ============================================================================
-- 
-- PHONE-FRIENDLY: Edit one line below, paste entire file, and run!
-- 
-- ⚠️ STEP 1: SET YOUR EMAIL HERE (the email you'll use to log in):
-- ============================================================================

DO $$ 
DECLARE
    v_owner_email TEXT := 'YOUR_EMAIL_HERE@example.com';  -- ← EDIT THIS LINE ONLY
BEGIN
    -- Create app_config table to store owner email
    CREATE TABLE IF NOT EXISTS app_config (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE,
        owner_email TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT single_row CHECK (id = TRUE)
    );

    -- Insert owner email (will fail silently if row already exists)
    INSERT INTO app_config (owner_email)
    VALUES (v_owner_email)
    ON CONFLICT (id) DO UPDATE 
    SET owner_email = v_owner_email, 
        updated_at = NOW();

    RAISE NOTICE 'Owner email set to: %', v_owner_email;
END $$;

-- ============================================================================
-- Security: app_config is READ-ONLY for authenticated users
-- ============================================================================

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Config readable by authenticated users" ON app_config;
CREATE POLICY "Config readable by authenticated users" ON app_config
    FOR SELECT USING (auth.role() = 'authenticated');

-- No INSERT, UPDATE, or DELETE policies - only admins can modify via SQL
-- This prevents any user (even the owner) from changing the owner email via the app

-- ============================================================================
-- Helper function to check if current user is the owner
-- ============================================================================

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

-- ============================================================================
-- Enable RLS on all health tables (with existence checks)
-- ============================================================================

DO $$ 
BEGIN
    -- Enable RLS on each table if it exists
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient_profiles') THEN
        ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'vitals') THEN
        ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'body_composition') THEN
        ALTER TABLE body_composition ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_summary') THEN
        ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'health_insights') THEN
        ALTER TABLE health_insights ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medications') THEN
        ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medication_log') THEN
        ALTER TABLE medication_log ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lab_results') THEN
        ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ecg_results') THEN
        ALTER TABLE ecg_results ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'exercise_log') THEN
        ALTER TABLE exercise_log ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================================
-- Drop existing policies (idempotent)
-- ============================================================================

DO $$ 
BEGIN
    -- Patient profiles
    DROP POLICY IF EXISTS "Owner can view patient_profiles" ON patient_profiles;
    DROP POLICY IF EXISTS "Owner can insert patient_profiles" ON patient_profiles;
    DROP POLICY IF EXISTS "Owner can update patient_profiles" ON patient_profiles;
    DROP POLICY IF EXISTS "Owner can delete patient_profiles" ON patient_profiles;
    
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

-- ============================================================================
-- Create owner-only policies using is_owner() function
-- ============================================================================

-- Patient profiles table (full CRUD)
CREATE POLICY "Owner can view patient_profiles" ON patient_profiles
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert patient_profiles" ON patient_profiles
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update patient_profiles" ON patient_profiles
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete patient_profiles" ON patient_profiles
    FOR DELETE USING (is_owner());

-- Vitals table (full CRUD)
CREATE POLICY "Owner can view vitals" ON vitals
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert vitals" ON vitals
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update vitals" ON vitals
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete vitals" ON vitals
    FOR DELETE USING (is_owner());

-- Body composition table (full CRUD)
CREATE POLICY "Owner can view body_composition" ON body_composition
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert body_composition" ON body_composition
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update body_composition" ON body_composition
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete body_composition" ON body_composition
    FOR DELETE USING (is_owner());

-- Daily summary table (full CRUD)
CREATE POLICY "Owner can view daily_summary" ON daily_summary
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert daily_summary" ON daily_summary
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update daily_summary" ON daily_summary
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete daily_summary" ON daily_summary
    FOR DELETE USING (is_owner());

-- Health insights table (full CRUD)
CREATE POLICY "Owner can view health_insights" ON health_insights
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert health_insights" ON health_insights
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update health_insights" ON health_insights
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete health_insights" ON health_insights
    FOR DELETE USING (is_owner());

-- Medications table (full CRUD)
CREATE POLICY "Owner can view medications" ON medications
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert medications" ON medications
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update medications" ON medications
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete medications" ON medications
    FOR DELETE USING (is_owner());

-- Medication log table (full CRUD)
CREATE POLICY "Owner can view medication_log" ON medication_log
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert medication_log" ON medication_log
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update medication_log" ON medication_log
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete medication_log" ON medication_log
    FOR DELETE USING (is_owner());

-- Lab results table (full CRUD)
CREATE POLICY "Owner can view lab_results" ON lab_results
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert lab_results" ON lab_results
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update lab_results" ON lab_results
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete lab_results" ON lab_results
    FOR DELETE USING (is_owner());

-- ECG results table (full CRUD)
CREATE POLICY "Owner can view ecg_results" ON ecg_results
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert ecg_results" ON ecg_results
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update ecg_results" ON ecg_results
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete ecg_results" ON ecg_results
    FOR DELETE USING (is_owner());

-- Exercise log table (full CRUD)
CREATE POLICY "Owner can view exercise_log" ON exercise_log
    FOR SELECT USING (is_owner());

CREATE POLICY "Owner can insert exercise_log" ON exercise_log
    FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owner can update exercise_log" ON exercise_log
    FOR UPDATE USING (is_owner());

CREATE POLICY "Owner can delete exercise_log" ON exercise_log
    FOR DELETE USING (is_owner());

-- ============================================================================
-- Verification queries (run AFTER the migration completes)
-- ============================================================================

-- Check that RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'patient_profiles', 'vitals', 'body_composition', 'daily_summary', 
    'health_insights', 'medications', 'medication_log', 
    'lab_results', 'ecg_results', 'exercise_log', 'app_config'
)
ORDER BY tablename;

-- Check owner email is set correctly
SELECT owner_email, created_at, updated_at FROM app_config;

-- List all policies
SELECT schemaname, tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- ============================================================================
-- Success! 
-- ============================================================================
-- RLS is now enabled with email-based owner verification.
-- Owner email set at the top of this script - edit once, run once.
-- app_config is read-only (no user can modify owner email via the app).
-- All 10 health tables have full CRUD policies for the owner.
-- ============================================================================
