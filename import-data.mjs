/**
 * Shahbaz Health Dashboard — Apple Health Import Script
 *
 * Usage:
 *   node import-data.mjs <path-to-file> [--since YYYY-MM-DD] [--skip-summaries]
 *
 * Examples:
 *   # Import full export ZIP
 *   node import-data.mjs ~/Downloads/export.zip
 *
 *   # Import from extracted XML directly
 *   node import-data.mjs ~/Desktop/apple_health_export/export.xml
 *
 *   # Only import data since a date (incremental re-sync)
 *   node import-data.mjs ~/Downloads/export.zip --since 2026-01-01
 *
 *   # Import without recomputing daily summaries
 *   node import-data.mjs ~/Downloads/export.zip --skip-summaries
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import sax from 'sax';

const SUPABASE_URL = 'https://ajgeanhsqhzrwtwfrkdu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqZ2VhbmhzcWh6cnd0d2Zya2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzgwNjMsImV4cCI6MjA4Nzc1NDA2M30.YoVNvwuAsHFu0ncloquZXcAIP-P0El6YvJnAzQhtsoc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Metric map ───────────────────────────────────────────────────────────────
const METRIC_MAP = {
    'HKQuantityTypeIdentifierHeartRate':              { table: 'vitals',           type: 'heart_rate',            unit: 'bpm' },
    'HKQuantityTypeIdentifierRestingHeartRate':       { table: 'vitals',           type: 'resting_heart_rate',    unit: 'bpm' },
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': { table: 'vitals',         type: 'hrv',                   unit: 'ms' },
    'HKQuantityTypeIdentifierBloodPressureSystolic':  { table: 'vitals',           type: 'blood_pressure_systolic', unit: 'mmHg' },
    'HKQuantityTypeIdentifierBloodPressureDiastolic': { table: 'vitals',           type: 'blood_pressure_diastolic', unit: 'mmHg' },
    'HKQuantityTypeIdentifierOxygenSaturation':       { table: 'vitals',           type: 'blood_oxygen',          unit: '%' },
    'HKQuantityTypeIdentifierRespiratoryRate':        { table: 'vitals',           type: 'respiratory_rate',      unit: 'breaths/min' },
    'HKQuantityTypeIdentifierStepCount':              { table: 'vitals',           type: 'steps',                 unit: 'count' },
    'HKQuantityTypeIdentifierActiveEnergyBurned':     { table: 'vitals',           type: 'active_calories',       unit: 'kcal' },
    'HKQuantityTypeIdentifierBodyMass':               { table: 'body_composition', type: 'weight',                unit: 'kg' },
    'HKQuantityTypeIdentifierBodyMassIndex':          { table: 'body_composition', type: 'bmi',                   unit: '' },
    'HKQuantityTypeIdentifierBodyFatPercentage':      { table: 'body_composition', type: 'body_fat_percentage',   unit: '%' },
    'HKQuantityTypeIdentifierLeanBodyMass':           { table: 'body_composition', type: 'lean_body_mass',        unit: 'kg' },
    'HKQuantityTypeIdentifierWaistCircumference':     { table: 'body_composition', type: 'waist_circumference',   unit: 'cm' },
};

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: node import-data.mjs <file> [--since YYYY-MM-DD] [--skip-summaries]

  <file>             Path to export.zip or export.xml from Apple Health
  --since DATE       Only import records on or after this date (incremental sync)
  --skip-summaries   Skip recomputing daily_summary table after import
  --help             Show this help

Examples:
  node import-data.mjs ~/Downloads/export.zip
  node import-data.mjs ~/Desktop/apple_health_export\\ 2/export.xml --since 2026-01-01
`);
    process.exit(0);
}

const filePath = path.resolve(args[0].replace(/^~/, process.env.HOME));
const sinceIdx = args.indexOf('--since');
const sinceDate = sinceIdx !== -1 ? args[sinceIdx + 1] : null;
const skipSummaries = args.includes('--skip-summaries');

if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
}

if (sinceDate && !/^\d{4}-\d{2}-\d{2}$/.test(sinceDate)) {
    console.error(`❌ --since date must be YYYY-MM-DD format. Got: ${sinceDate}`);
    process.exit(1);
}

const isZip = filePath.endsWith('.zip');
const isXml = filePath.endsWith('.xml');

if (!isZip && !isXml) {
    console.error(`❌ File must be a .zip or .xml file. Got: ${filePath}`);
    process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function uploadBatch(tableName, batch) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        const { error } = await supabase.from(tableName).insert(batch);
        if (!error) return;
        console.error(`\n⚠️  Upload error (attempt ${attempt}/3) on ${tableName}: ${error.message}`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
    }
}

// ─── Main import ─────────────────────────────────────────────────────────────
async function importData() {
    const stat = fs.statSync(filePath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(0);

    console.log(`\n📱 Apple Health Import`);
    console.log(`   File:   ${filePath}`);
    console.log(`   Size:   ${sizeMB} MB`);
    console.log(`   Since:  ${sinceDate || 'all time'}`);
    console.log(`\nChecking database connection...`);

    const { error: dbErr } = await supabase.from('vitals').select('id').limit(1);
    if (dbErr && dbErr.code === '42P01') {
        console.error('❌ Database tables not found. Run the schema migration first.');
        process.exit(1);
    }

    const parser = sax.createStream(true, { trim: true });

    let vitalsBatch = [];
    let bodyBatch = [];
    const BATCH_SIZE = 5000;
    let totalProcessed = 0;
    let totalUploaded = 0;
    let totalSkipped = 0;

    async function flushVitals() {
        if (!vitalsBatch.length) return;
        const batch = vitalsBatch; vitalsBatch = [];
        await uploadBatch('vitals', batch);
        totalUploaded += batch.length;
    }
    async function flushBody() {
        if (!bodyBatch.length) return;
        const batch = bodyBatch; bodyBatch = [];
        await uploadBatch('body_composition', batch);
        totalUploaded += batch.length;
    }

    parser.on('opentag', async (node) => {
        if (node.name !== 'Record') return;
        const attrs = node.attributes;
        const mapping = METRIC_MAP[attrs.type];
        if (!mapping) return;

        // Apply --since filter
        if (sinceDate) {
            const recordDate = (attrs.startDate || attrs.creationDate || '').substring(0, 10);
            if (recordDate < sinceDate) { totalSkipped++; return; }
        }

        let value = parseFloat(attrs.value);
        if (isNaN(value)) return;

        // SpO2 comes as 0-1 fraction — convert to percentage
        if (attrs.type === 'HKQuantityTypeIdentifierOxygenSaturation') value *= 100;

        const entry = {
            recorded_at: attrs.startDate || attrs.creationDate,
            metric_type: mapping.type,
            value: Math.round(value * 100) / 100,
            unit: mapping.unit,
            source: 'apple_health',
        };

        if (mapping.table === 'vitals') {
            vitalsBatch.push(entry);
            if (vitalsBatch.length >= BATCH_SIZE) await flushVitals();
        } else {
            bodyBatch.push(entry);
            if (bodyBatch.length >= BATCH_SIZE) await flushBody();
        }
        totalProcessed++;
        if (totalProcessed % 10000 === 0) {
            process.stdout.write(`\r   Parsed ${totalProcessed.toLocaleString()} records, uploaded ${totalUploaded.toLocaleString()}...`);
        }
    });

    parser.on('error', (e) => {
        // SAX often throws on large files due to entity refs — log and continue
        console.error('\n⚠️  Parser warning:', e.message);
        parser._parser.error = null;
        parser._parser.resume();
    });

    console.log(`\nStreaming XML data... (this may take several minutes for large files)\n`);

    if (isZip) {
        // Pipe: unzip -p <file> <xml-entry> | sax parser
        const { spawn } = await import('child_process');
        // Try both common archive structures
        const entries = ['apple_health_export/export.xml', 'export.xml'];
        let launched = false;
        for (const entry of entries) {
            const unzip = spawn('unzip', ['-p', filePath, entry]);
            // Test if entry exists by checking first byte
            await new Promise((resolve) => {
                unzip.stdout.once('data', () => {
                    // Entry found — pipe to parser
                    unzip.stdout.pipe(parser);
                    launched = true;
                    resolve();
                });
                unzip.stderr.once('data', () => resolve());
                unzip.once('close', () => resolve());
            });
            if (launched) break;
        }
        if (!launched) {
            console.error('❌ Could not find export.xml inside the ZIP. Try passing the .xml file directly instead.');
            process.exit(1);
        }
    } else {
        // Stream raw XML file directly
        fs.createReadStream(filePath).pipe(parser);
    }

    await new Promise((resolve) => {
        parser.on('end', async () => {
            await flushVitals();
            await flushBody();
            resolve();
        });
    });

    console.log(`\n\n✅ Import complete!`);
    console.log(`   Records parsed:   ${totalProcessed.toLocaleString()}`);
    console.log(`   Records uploaded: ${totalUploaded.toLocaleString()}`);
    if (sinceDate) console.log(`   Records skipped (before ${sinceDate}): ${totalSkipped.toLocaleString()}`);
}

// ─── Daily summaries ──────────────────────────────────────────────────────────
async function recomputeSummaries(sinceDate) {
    console.log('\nRecomputing daily summaries...');

    const query = supabase.from('vitals').select('recorded_at, metric_type, value').order('recorded_at', { ascending: true });
    if (sinceDate) query.gte('recorded_at', sinceDate + 'T00:00:00');

    const { data: vitalsData } = await query;
    const { data: bodyData } = await supabase.from('body_composition').select('recorded_at, metric_type, value').order('recorded_at', { ascending: true });

    const dailyMap = {};
    const getDate = (ts) => ts?.substring(0, 10);

    (vitalsData || []).forEach(v => {
        const d = getDate(v.recorded_at);
        if (!d) return;
        if (!dailyMap[d]) dailyMap[d] = { hrs: [], rhr: [], hrv: [], spo2: [], steps: [], cal: [] };
        if (v.metric_type === 'heart_rate')        dailyMap[d].hrs.push(v.value);
        if (v.metric_type === 'resting_heart_rate') dailyMap[d].rhr.push(v.value);
        if (v.metric_type === 'hrv')               dailyMap[d].hrv.push(v.value);
        if (v.metric_type === 'blood_oxygen')      dailyMap[d].spo2.push(v.value);
        if (v.metric_type === 'steps')             dailyMap[d].steps.push(v.value);
        if (v.metric_type === 'active_calories')   dailyMap[d].cal.push(v.value);
    });

    const bodyDaily = {};
    (bodyData || []).forEach(b => {
        const d = getDate(b.recorded_at);
        if (!d) return;
        if (!bodyDaily[d]) bodyDaily[d] = { weight: [], bf: [] };
        if (b.metric_type === 'weight')              bodyDaily[d].weight.push(b.value);
        if (b.metric_type === 'body_fat_percentage') bodyDaily[d].bf.push(b.value);
    });

    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const sum = arr => arr.length ? arr.reduce((a, b) => a + b, 0) : null;

    const summaries = Object.entries(dailyMap).map(([date, d]) => {
        const bd = bodyDaily[date] || {};
        const avgHR = avg(d.hrs);
        const avgRHR = avg(d.rhr);
        const avgHRV = avg(d.hrv);
        const avgSpo2 = avg(d.spo2);
        const stepCount = sum(d.steps);
        const cal = sum(d.cal);
        const weight = bd.weight?.length ? avg(bd.weight) : null;

        let score = 70;
        if (avgRHR) score += avgRHR < 60 ? 10 : avgRHR < 70 ? 5 : avgRHR < 80 ? 0 : -10;
        if (avgHRV) score += avgHRV > 50 ? 10 : avgHRV > 30 ? 5 : avgHRV > 20 ? 0 : -10;
        if (stepCount) score += stepCount > 10000 ? 10 : stepCount > 7500 ? 7 : stepCount > 5000 ? 4 : 0;
        if (avgSpo2) score += avgSpo2 >= 97 ? 5 : avgSpo2 >= 95 ? 0 : avgSpo2 >= 90 ? -10 : -20;
        score = Math.max(0, Math.min(100, Math.round(score)));

        return {
            date,
            avg_hr: avgHR ? Math.round(avgHR) : null,
            avg_rhr: avgRHR ? Math.round(avgRHR) : null,
            avg_hrv: avgHRV ? Math.round(avgHRV * 10) / 10 : null,
            blood_oxygen_avg: avgSpo2 ? Math.round(avgSpo2 * 10) / 10 : null,
            step_count: stepCount ? Math.round(stepCount) : null,
            weight_kg: weight ? Math.round(weight * 10) / 10 : null,
            body_fat_pct: bd.bf?.length ? Math.round(avg(bd.bf) * 10) / 10 : null,
            active_calories: cal ? Math.round(cal) : null,
            health_score: score,
        };
    });

    // Upsert in batches
    for (let i = 0; i < summaries.length; i += 200) {
        await supabase.from('daily_summary').upsert(summaries.slice(i, i + 200), { onConflict: 'date' });
        process.stdout.write(`\r   Upserted ${Math.min(i + 200, summaries.length)} / ${summaries.length} daily summaries...`);
    }

    console.log(`\n✅ Daily summaries done — ${summaries.length} days processed.`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────
(async () => {
    try {
        await importData();
        if (!skipSummaries) {
            await recomputeSummaries(sinceDate);
        }
        console.log('\n🎉 All done! Refresh the dashboard to see your updated data.\n');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Fatal error:', err);
        process.exit(1);
    }
})();
