import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ajgeanhsqhzrwtwfrkdu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqZ2VhbmhzcWh6cnd0d2Zya2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzgwNjMsImV4cCI6MjA4Nzc1NDA2M30.YoVNvwuAsHFu0ncloquZXcAIP-P0El6YvJnAzQhtsoc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function computeSummaries() {
    console.log('Fetching all vitals to compute summaries...');
    let vitalsData = [];
    let from = 0;
    const STEP = 10000;
    while (true) {
        const { data, error } = await supabase.from('vitals').select('recorded_at, metric_type, value').range(from, from + STEP - 1);
        if (error) { console.error(error); break; }
        if (!data || data.length === 0) break;
        vitalsData.push(...data);
        from += STEP;
        process.stdout.write(`\rFetched ${vitalsData.length} vital rows...`);
        if (data.length < STEP) break;
    }

    let bodyData = [];
    from = 0;
    while (true) {
        const { data, error } = await supabase.from('body_composition').select('recorded_at, metric_type, value').range(from, from + STEP - 1);
        if (error) { console.error(error); break; }
        if (!data || data.length === 0) break;
        bodyData.push(...data);
        from += STEP;
        process.stdout.write(`\rFetched ${bodyData.length} body rows...`);
        if (data.length < STEP) break;
    }

    console.log('\nComputing daily maps...');
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

    console.log(`\nUploading ${summaries.length} daily summaries...`);
    for (let i = 0; i < summaries.length; i += 200) {
        process.stdout.write(`\rUploading summaries ${i}/${summaries.length}`);
        await supabase.from('daily_summary').upsert(summaries.slice(i, i + 200), { onConflict: 'date' });
    }

    console.log('\n\n✅ Summaries generated successfully!');
    process.exit(0);
}

computeSummaries().catch(console.error);
