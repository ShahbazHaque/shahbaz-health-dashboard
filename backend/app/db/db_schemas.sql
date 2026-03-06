-- -----------------------------------------------------------------------------
-- DRA KUZBURY BACKEND DATABASE SCHEMAS
-- Dual-Engine Architecture: PostgreSQL (Relational) + TimescaleDB (Time-Series)
-- -----------------------------------------------------------------------------

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS timescaledb; 
CREATE EXTENSION IF NOT EXISTS vector;      -- For pgvector (Long-term semantic memory)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. POSTGRESQL RELATIONAL ENGINE (Core Identity & State)
-- -----------------------------------------------------------------------------

CREATE TABLE patient_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    dob DATE NOT NULL,
    primary_diagnoses JSONB NOT NULL, -- e.g. ["ASHD", "IHD", "OMI", "Hyperlipidaemia"]
    clinical_targets JSONB,           -- e.g. {"ldl_c_max": 55, "bp_sys_max": 130, "hr_rest_min": 55, "hr_rest_max": 65}
    timezone VARCHAR(50) DEFAULT 'Asia/Riyadh',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE active_medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patient_profiles(id),
    drug_name VARCHAR(100) NOT NULL,
    drug_class VARCHAR(100), -- e.g., "High-Intensity Statin", "Beta Blocker"
    dose VARCHAR(50) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    prescribing_physician VARCHAR(150),
    is_active BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE medication_adherence_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID REFERENCES active_medications(id),
    scheduled_time TIMESTAMPTZ NOT NULL,
    taken_time TIMESTAMPTZ,
    status VARCHAR(20) CHECK (status IN ('TAKEN', 'MISSED', 'SKIPPED')),
    notes TEXT
);

-- -----------------------------------------------------------------------------
-- 2. TIMESCALEDB TIME-SERIES ENGINE (Passive Telemetry)
-- -----------------------------------------------------------------------------

CREATE TABLE biometric_telemetry (
    time TIMESTAMPTZ NOT NULL,
    patient_id UUID REFERENCES patient_profiles(id),
    metric_type VARCHAR(50) NOT NULL, -- 'HR_REST', 'SBP', 'DBP', 'HRV', 'LDL_C', 'SPO2'
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(20) NOT NULL,        -- 'bpm', 'mmHg', 'ms', 'mg/dL', '%'
    source VARCHAR(50)                -- 'AppleWatch', 'ManualEntry', 'LabReport'
);

-- Convert to TimescaleDB Hypertable partitioned by time
SELECT create_hypertable('biometric_telemetry', 'time');

-- Create index on the UUID for faster aggregate querying per patient
CREATE INDEX ix_biometric_patient_time ON biometric_telemetry (patient_id, time DESC);

-- -----------------------------------------------------------------------------
-- 3. DR. KUZBURY AI MEMORY ARCHITECTURE (Mem0 / Vector Store)
-- -----------------------------------------------------------------------------

CREATE TABLE voice_event_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patient_profiles(id),
    event_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    raw_transcription TEXT NOT NULL,
    extracted_json JSONB NOT NULL,    -- Evaluated against HealthEventSchema
    is_escalated BOOLEAN DEFAULT FALSE,
    escalation_reason TEXT
);

CREATE TABLE kuzbury_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patient_profiles(id),
    memory_tier VARCHAR(20) CHECK (memory_tier IN ('EPISODIC', 'SEMANTIC')),
    memory_content TEXT NOT NULL,
    embedding vector(768),            -- pgvector column for similarity search against guidelines/history
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMPTZ
);
