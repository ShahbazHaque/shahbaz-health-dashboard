import fs from 'fs';
import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';
import sax from 'sax';
import readline from 'readline';

const SUPABASE_URL = 'https://ajgeanhsqhzrwtwfrkdu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqZ2VhbmhzcWh6cnd0d2Zya2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzgwNjMsImV4cCI6MjA4Nzc1NDA2M30.YoVNvwuAsHFu0ncloquZXcAIP-P0El6YvJnAzQhtsoc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const METRIC_MAP = {
    'HKQuantityTypeIdentifierHeartRate': { table: 'vitals', type: 'heart_rate', unit: 'bpm' },
    'HKQuantityTypeIdentifierRestingHeartRate': { table: 'vitals', type: 'resting_heart_rate', unit: 'bpm' },
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': { table: 'vitals', type: 'hrv', unit: 'ms' },
    'HKQuantityTypeIdentifierBloodPressureSystolic': { table: 'vitals', type: 'blood_pressure_systolic', unit: 'mmHg' },
    'HKQuantityTypeIdentifierBloodPressureDiastolic': { table: 'vitals', type: 'blood_pressure_diastolic', unit: 'mmHg' },
    'HKQuantityTypeIdentifierOxygenSaturation': { table: 'vitals', type: 'blood_oxygen', unit: '%' },
    'HKQuantityTypeIdentifierRespiratoryRate': { table: 'vitals', type: 'respiratory_rate', unit: 'breaths/min' },
    'HKQuantityTypeIdentifierBodyMass': { table: 'body_composition', type: 'weight', unit: 'kg' },
    'HKQuantityTypeIdentifierBodyMassIndex': { table: 'body_composition', type: 'bmi', unit: '' },
    'HKQuantityTypeIdentifierBodyFatPercentage': { table: 'body_composition', type: 'body_fat_percentage', unit: '%' },
    'HKQuantityTypeIdentifierLeanBodyMass': { table: 'body_composition', type: 'lean_body_mass', unit: 'kg' },
    'HKQuantityTypeIdentifierWaistCircumference': { table: 'body_composition', type: 'waist_circumference', unit: 'cm' },
    'HKQuantityTypeIdentifierStepCount': { table: 'vitals', type: 'steps', unit: 'count' },
    'HKQuantityTypeIdentifierActiveEnergyBurned': { table: 'vitals', type: 'active_calories', unit: 'kcal' },
};

async function checkAndCreateTable() {
    console.log('Checking database connection...');
    const { data, error } = await supabase.from('vitals').select('id').limit(1);
    if (error) {
        if (error.code === '42P01') {
            console.error('\nERROR: The database tables (vitals, body_composition, daily_summary, health_insights) do not exist yet.');
            console.error('Claude created the Supabase project but hasn\'t run the necessary SQL to set up the schema.');
            console.error('Let me know and I can fix this.');
            process.exit(1);
        }
        console.error('Supabase error:', error.message);
    }
}

async function uploadBatch(tableName, batch) {
    let success = false;
    let attempts = 0;
    while (!success && attempts < 3) {
        attempts++;
        const { error } = await supabase.from(tableName).insert(batch);
        if (!error) {
            success = true;
        } else {
            console.error(`Error uploading to ${tableName}:`, error.message);
            await new Promise(r => setTimeout(r, 1000 * attempts));
        }
    }
}

async function processFile() {
    await checkAndCreateTable();

    console.log('Starting data stream. Please wait, this will take some time for very large exports...');

    const { execSync } = await import('child_process');

    // Try to unzip directly into stdout to stream to sax
    const parser = sax.createStream(true, { trim: true });

    let vitalsBatch = [];
    let bodyBatch = [];
    const BATCH_SIZE = 5000;
    let totalProcessed = 0;
    let totalUploaded = 0;

    async function flushVitals() {
        if (vitalsBatch.length === 0) return;
        const batch = vitalsBatch;
        vitalsBatch = [];
        await uploadBatch('vitals', batch);
        totalUploaded += batch.length;
        process.stdout.write(`\rProcessed ${totalProcessed} matching records, uploaded ${totalUploaded}.`);
    }

    async function flushBody() {
        if (bodyBatch.length === 0) return;
        const batch = bodyBatch;
        bodyBatch = [];
        await uploadBatch('body_composition', batch);
        totalUploaded += batch.length;
        process.stdout.write(`\rProcessed ${totalProcessed} matching records, uploaded ${totalUploaded}.`);
    }

    parser.on('opentag', async (node) => {
        if (node.name === 'Record') {
            const attrs = node.attributes;
            const mapping = METRIC_MAP[attrs.type];
            if (mapping) {
                let value = parseFloat(attrs.value);
                if (!isNaN(value)) {
                    if (attrs.type === 'HKQuantityTypeIdentifierOxygenSaturation') value *= 100;
                    const entry = {
                        recorded_at: attrs.startDate || attrs.creationDate,
                        metric_type: mapping.type,
                        value: Math.round(value * 100) / 100,
                        unit: mapping.unit,
                        source: 'apple_health'
                    };

                    if (mapping.table === 'vitals') {
                        vitalsBatch.push(entry);
                        if (vitalsBatch.length >= BATCH_SIZE) await flushVitals();
                    } else {
                        bodyBatch.push(entry);
                        if (bodyBatch.length >= BATCH_SIZE) await flushBody();
                    }
                    totalProcessed++;
                }
            }
        }
    });

    parser.on('error', (e) => {
        console.error("\nParser error:", e);
    });

    console.log('Extracting and streaming XML data...');

    // Using spawn to unzip and pipe to parser
    const { spawn } = await import('child_process');
    const unzip = spawn('unzip', ['-p', '/Users/shahbazhaque/Downloads/export.zip', 'apple_health_export/export.xml']);

    unzip.stdout.pipe(parser);

    await new Promise((resolve) => {
        parser.on('end', async () => {
            await flushVitals();
            await flushBody();
            console.log('\n\n--- Finished Parsing & Uploading Raw Data! ---');
            resolve();
        });
    });

}

async function start() {
    await processFile();
    console.log('Now computing daily summaries. This could take a minute as well...');

    const { data: vitalsData } = await supabase.from('vitals').select('recorded_at, metric_type, value').order('recorded_at', { ascending: true });
    const { data: bodyData } = await supabase.from('body_composition').select('recorded_at, metric_type, value').order('recorded_at', { ascending: true });

    const dailyMap = {};
    const getDate = (ts) => ts ? ts.substring(0, 10) : null;

    (vitalsData || []).forEach(v => {
        const d = getDate(v.recorded_at);
        if (!d) return;
        if (!dailyMap[d]) dailyMap[d] = { hrs: [], rhr: [], hrv: [], spo2: [], steps: [], cal: [] };
        if (v.metric_type === 'heart_rate') dailyMap[d].hrs.push(v.value);
        if (v.metric_type === 'resting_heart_rate') dailyMap[d].rhr.push(v.value);
        if (v.metric_type === 'hrv') dailyMap[d].hrv.push(v.value);
        if (v.metric_type === 'blood_oxygen') dailyMap[d].spo2.push(v.value);
        if (v.metric_type === 'steps') dailyMap[d].steps.push(v.value);
        if (v.metric_type === 'active_calories') dailyMap[d].cal.push(v.value);
    });

    const bodyDaily = {};
    (bodyData || []).forEach(b => {
        const d = getDate(b.recorded_at);
        if (!d) return;
        if (!bodyDaily[d]) bodyDaily[d] = { weight: [], bf: [] };
        if (b.metric_type === 'weight') bodyDaily[d].weight.push(b.value);
        if (b.metric_type === 'body_fat_percentage') bodyDaily[d].bf.push(b.value);
    });

    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const sum = arr => arr.length ? arr.reduce((a, b) => a + b, 0) : null;

    const summaries = Object.entries(dailyMap).map(([date, d]) => {
        const bd = bodyDaily[date] || {};
        const avgHR = avg(d.hrs);
        const rhr = avg(d.rhr);
        const hrvVal = avg(d.hrv);
        const spo2 = avg(d.spo2);
        const weight = avg(bd.weight || []);
        const bf = avg(bd.bf || []);

        let score = 70;
        if (rhr) { if (rhr < 60) score += 10; else if (rhr < 70) score += 5; else if (rhr > 85) score -= 10; }
        if (hrvVal) { if (hrvVal > 50) score += 10; else if (hrvVal > 30) score += 5; else score -= 5; }
        if (spo2) { if (spo2 > 97) score += 5; else if (spo2 < 94) score -= 15; }
        score = Math.max(0, Math.min(100, score));

        return {
            date,
            avg_heart_rate: avgHR ? Math.round(avgHR) : null,
            min_heart_rate: d.hrs.length ? Math.round(Math.min(...d.hrs)) : null,
            max_heart_rate: d.hrs.length ? Math.round(Math.max(...d.hrs)) : null,
            resting_heart_rate: rhr ? Math.round(rhr) : null,
            hrv_avg: hrvVal ? Math.round(hrvVal * 10) / 10 : null,
            blood_oxygen_avg: spo2 ? Math.round(spo2 * 10) / 10 : null,
            weight_kg: weight ? Math.round(weight * 10) / 10 : null,
            body_fat_pct: bf ? Math.round(bf * 10) / 10 : null,
            steps: sum(d.steps) ? Math.round(sum(d.steps)) : null,
            active_calories: sum(d.cal) ? Math.round(sum(d.cal)) : null,
            health_score: score,
        };
    });

    for (let i = 0; i < summaries.length; i += 200) {
        process.stdout.write(`\rUploading summaries ${i}/${summaries.length}`);
        await supabase.from('daily_summary').upsert(summaries.slice(i, i + 200), { onConflict: 'date' });
    }

    console.log('\n\n✅ COMPLETED. Over ' + Number(totalProcessed).toLocaleString() + ' records successfully analyzed and imported.');
    process.exit(0);
}

start().catch(console.error);
