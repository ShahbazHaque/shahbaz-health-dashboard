import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, PieChart, Pie, Cell } from 'recharts';
import KuzburyChat from './components/KuzburyChat';
import MedicationManager from './components/MedicationManager';
import GlidePathChart from './components/GlidePathChart';
import ClinicianReport from './components/ClinicianReport';
import DataCapture from './components/DataCapture';
import BPLogger from './components/BPLogger';
import LabEntryForm from './components/LabEntryForm';
import ExerciseLogger from './components/ExerciseLogger';
import WeightLogger from './components/WeightLogger';
import GoogleHealthSync from './components/GoogleHealthSync';
import { generateDailyBriefing, generateAIInsights, getTimeOfDayGreeting, computeHealthScore } from './lib/gemini';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

// Supabase config
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ajgeanhsqhzrwtwfrkdu.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqZ2VhbmhzcWh6cnd0d2Zya2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzgwNjMsImV4cCI6MjA4Nzc1NDA2M30.YoVNvwuAsHFu0ncloquZXcAIP-P0El6YvJnAzQhtsoc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Apple Health XML metric mapping
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

// Fetch latest recorded_at per metric to support incremental sync
async function fetchMetricCutoffs() {
  const metricCutoffs = {};
  const bodyCutoffs = {};

  try {
    const vitalTypes = Object.values(METRIC_MAP).filter(m => m.table === 'vitals').map(m => m.type);
    const vitalCutoffQueries = await Promise.all(
      vitalTypes.map(type =>
        supabase.from('vitals')
          .select('recorded_at')
          .eq('metric_type', type)
          .order('recorded_at', { ascending: false })
          .limit(1)
      )
    );
    vitalTypes.forEach((type, i) => {
      const row = vitalCutoffQueries[i]?.data?.[0];
      if (row) metricCutoffs[type] = row.recorded_at;
    });

    const bodyTypes = Object.values(METRIC_MAP).filter(m => m.table === 'body_composition').map(m => m.type);
    const bodyCutoffQueries = await Promise.all(
      bodyTypes.map(type =>
        supabase.from('body_composition')
          .select('recorded_at')
          .eq('metric_type', type)
          .order('recorded_at', { ascending: false })
          .limit(1)
      )
    );
    bodyTypes.forEach((type, i) => {
      const row = bodyCutoffQueries[i]?.data?.[0];
      if (row) bodyCutoffs[type] = row.recorded_at;
    });
  } catch (e) {
    console.warn('Could not fetch metric cutoffs for incremental sync:', e);
  }

  return { metricCutoffs, bodyCutoffs };
}

// Parse Apple Health XML using streaming chunked reader (supports 2GB+ files without browser memory errors)
async function parseAppleHealthStream(fileOrBlob, onProgress, cutoffs = {}) {
  const { metricCutoffs = {}, bodyCutoffs = {} } = cutoffs;
  const vitals = [];
  const bodyComp = [];
  let skipped = 0;

  const stream = fileOrBlob.stream ? fileOrBlob.stream() : null;
  if (!stream) {
    // Fallback if stream() is unsupported
    const xmlText = await fileOrBlob.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const records = doc.querySelectorAll('Record');
    records.forEach((record) => {
      const type = record.getAttribute('type');
      const mapping = METRIC_MAP[type];
      if (!mapping) return;
      const recordedAt = record.getAttribute('startDate') || record.getAttribute('creationDate') || '';
      const cutoffMap = mapping.table === 'vitals' ? metricCutoffs : bodyCutoffs;
      const cutoff = cutoffMap[mapping.type];
      if (cutoff && recordedAt <= cutoff) { skipped++; return; }
      let value = parseFloat(record.getAttribute('value'));
      if (isNaN(value)) return;
      if (type === 'HKQuantityTypeIdentifierOxygenSaturation' && value <= 1) value *= 100;
      const entry = { recorded_at: recordedAt, metric_type: mapping.type, value: Math.round(value * 100) / 100, unit: mapping.unit, source: 'apple_health' };
      if (mapping.table === 'vitals') vitals.push(entry); else bodyComp.push(entry);
    });
    return { vitals, bodyComp, totalParsed: vitals.length + bodyComp.length, skipped };
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let leftover = '';
  const totalBytes = fileOrBlob.size || 1;
  let readBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    readBytes += value.byteLength;
    if (onProgress) onProgress(Math.min(45, Math.round((readBytes / totalBytes) * 45)));

    const chunk = leftover + decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    leftover = lines.pop() || '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes('<Record ')) continue;

      const typeMatch = line.match(/type="([^"]+)"/);
      if (!typeMatch) continue;
      const mapping = METRIC_MAP[typeMatch[1]];
      if (!mapping) continue;

      const dateMatch = line.match(/(?:startDate|creationDate)="([^"]+)"/);
      const recordedAt = dateMatch ? dateMatch[1] : '';
      const cutoff = mapping.table === 'vitals' ? metricCutoffs[mapping.type] : bodyCutoffs[mapping.type];
      if (cutoff && recordedAt <= cutoff) {
        skipped++;
        continue;
      }

      const valMatch = line.match(/value="([^"]+)"/);
      if (!valMatch) continue;
      let val = parseFloat(valMatch[1]);
      if (isNaN(val)) continue;
      if (mapping.type === 'blood_oxygen' && val <= 1) val = val * 100;

      const entry = {
        recorded_at: recordedAt,
        metric_type: mapping.type,
        value: Math.round(val * 100) / 100,
        unit: mapping.unit,
        source: 'apple_health',
      };

      if (mapping.table === 'vitals') vitals.push(entry);
      else bodyComp.push(entry);
    }
  }

  return { vitals, bodyComp, totalParsed: vitals.length + bodyComp.length, skipped };
}

// Upload to Supabase in batches
async function uploadToSupabase(vitals, bodyComp, onProgress) {
  const batchSize = 500;
  const totalBatches = Math.ceil(vitals.length / batchSize) + Math.ceil(bodyComp.length / batchSize);
  let completedBatches = 0;

  for (let i = 0; i < vitals.length; i += batchSize) {
    const batch = vitals.slice(i, i + batchSize);
    await supabase.from('vitals').insert(batch);
    completedBatches++;
    if (onProgress) onProgress(50 + Math.round((completedBatches / Math.max(1, totalBatches)) * 45));
  }

  for (let i = 0; i < bodyComp.length; i += batchSize) {
    const batch = bodyComp.slice(i, i + batchSize);
    await supabase.from('body_composition').insert(batch);
    completedBatches++;
    if (onProgress) onProgress(50 + Math.round((completedBatches / Math.max(1, totalBatches)) * 45));
  }
}

// Compute daily summaries
async function computeDailySummaries() {
  const { data: vitalsData } = await supabase.from('vitals').select('*').order('recorded_at', { ascending: true });
  const { data: bodyData } = await supabase.from('body_composition').select('*').order('recorded_at', { ascending: true });
  if (!vitalsData && !bodyData) return;

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

    // Health score: 100-Point Post-MI Cardiovascular Recovery Index
    const scoreResult = computeHealthScore({
      restingHR: rhr,
      hrv: hrvVal,
      spo2: spo2,
      steps: sum(d.steps),
    });
    const score = scoreResult.totalScore;

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

  // Upsert in batches
  for (let i = 0; i < summaries.length; i += 200) {
    await supabase.from('daily_summary').upsert(summaries.slice(i, i + 200), { onConflict: 'date' });
  }
}

// Generate insights
async function generateInsights(summaries) {
  if (!summaries || summaries.length < 3) return [];
  const insights = [];
  const recent = summaries.slice(-7);
  const older = summaries.slice(-30, -7);

  const avgRecent = (key) => { const vals = recent.filter(s => s[key] != null).map(s => s[key]); return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null; };
  const avgOlder = (key) => { const vals = older.filter(s => s[key] != null).map(s => s[key]); return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null; };

  const recentRHR = avgRecent('resting_heart_rate');
  const olderRHR = avgOlder('resting_heart_rate');
  if (recentRHR && olderRHR) {
    const diff = recentRHR - olderRHR;
    if (Math.abs(diff) > 3) {
      insights.push({
        date: recent[recent.length - 1]?.date,
        category: 'vitals',
        severity: diff > 5 ? 'warning' : 'info',
        title: diff > 0 ? 'Resting Heart Rate Increasing' : 'Resting Heart Rate Improving',
        description: `Your resting HR has ${diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(Math.round(diff))} bpm this week vs the prior 3 weeks. ${diff > 0 ? 'Consider checking stress levels and sleep quality.' : 'Great sign of improving cardiovascular fitness!'}`,
        metric_type: 'resting_heart_rate',
      });
    }
  }

  const recentHRV = avgRecent('hrv_avg');
  if (recentHRV) {
    if (recentHRV < 25) {
      insights.push({ date: recent[recent.length - 1]?.date, category: 'vitals', severity: 'warning', title: 'Low HRV Detected', description: 'Your heart rate variability is below 25ms this week, suggesting elevated stress or fatigue. Focus on recovery, sleep, and stress management.', metric_type: 'hrv' });
    } else if (recentHRV > 60) {
      insights.push({ date: recent[recent.length - 1]?.date, category: 'vitals', severity: 'info', title: 'Excellent HRV', description: 'Your HRV is above 60ms, indicating strong autonomic nervous system health and good recovery capacity.', metric_type: 'hrv' });
    }
  }

  const recentWeight = recent.filter(s => s.weight_kg).map(s => s.weight_kg);
  const olderWeight = older.filter(s => s.weight_kg).map(s => s.weight_kg);
  if (recentWeight.length && olderWeight.length) {
    const wDiff = recentWeight[recentWeight.length - 1] - olderWeight[0];
    if (Math.abs(wDiff) > 1) {
      insights.push({ date: recent[recent.length - 1]?.date, category: 'body', severity: Math.abs(wDiff) > 3 ? 'warning' : 'info', title: `Weight ${wDiff > 0 ? 'Gain' : 'Loss'} Trend`, description: `You've ${wDiff > 0 ? 'gained' : 'lost'} approximately ${Math.abs(Math.round(wDiff * 10) / 10)} kg over the past month.`, metric_type: 'weight' });
    }
  }

  const recentSpo2 = avgRecent('blood_oxygen_avg');
  if (recentSpo2 && recentSpo2 < 95) {
    insights.push({ date: recent[recent.length - 1]?.date, category: 'vitals', severity: 'alert', title: 'Low Blood Oxygen', description: `Average SpO2 is ${Math.round(recentSpo2)}%. Normal is 95-100%. If this persists, consider consulting a healthcare professional.`, metric_type: 'blood_oxygen' });
  }

  // Save insights
  if (insights.length) {
    await supabase.from('health_insights').insert(insights);
  }
  return insights;
}

// =================== COMPONENTS ===================

function HealthScoreRing({ score }) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="score-ring-container">
      <div className="score-ring">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
          <circle cx="90" cy="90" r={radius} fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
        </svg>
        <div className="score-value">
          <div className="number" style={{ color }}>{score}</div>
          <div className="label">Health Score</div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, unit, icon, color, trend, trendLabel, sparkData, sparkKey }) {
  const bgGlow = `rgba(${color === '#ef4444' ? '239,68,68' : color === '#3b82f6' ? '59,130,246' : color === '#10b981' ? '16,185,129' : color === '#8b5cf6' ? '139,92,246' : color === '#f59e0b' ? '245,158,11' : '6,182,212'}, 0.12)`;
  return (
    <div className="card fade-in">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <div className="card-icon" style={{ background: bgGlow, color }}>{icon}</div>
      </div>
      <div className="card-value" style={{ color }}>{value}<span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>{unit}</span></div>
      {trendLabel && (
        <div className={`card-trend ${trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : 'trend-neutral'}`}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {trendLabel}
        </div>
      )}
      {sparkData && sparkData.length > 1 && (
        <div className="mini-chart">
          <ResponsiveContainer width="100%" height={50}>
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey={sparkKey || 'value'} stroke={color} fill={`url(#grad-${title})`} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children, icon, color }) {
  const bgGlow = `rgba(${color === '#ef4444' ? '239,68,68' : color === '#3b82f6' ? '59,130,246' : color === '#10b981' ? '16,185,129' : color === '#8b5cf6' ? '139,92,246' : '245,158,11'}, 0.12)`;
  return (
    <div className="card chart-card fade-in">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <div className="card-icon" style={{ background: bgGlow, color }}>{icon}</div>
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: '14px', fontWeight: 600, color: p.color, marginBottom: '2px' }}>
          {p.name}: {typeof p.value === 'number' ? Math.round(p.value * 10) / 10 : p.value} {p.unit || ''}
        </div>
      ))}
    </div>
  );
}

function UploadModal({ onClose, onUploadComplete }) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, parsing, uploading, computing, done, error
  const [stats, setStats] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    try {
      setStatus('parsing');
      setProgress(5);
      let targetBlob;

      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const xmlFile = Object.keys(zip.files).find(f => f.includes('export.xml'));
        if (!xmlFile) throw new Error('Could not find export.xml in the zip file');
        targetBlob = await zip.files[xmlFile].async('blob');
      } else {
        targetBlob = file;
      }

      setProgress(10);
      const cutoffs = await fetchMetricCutoffs();

      setProgress(15);
      const { vitals, bodyComp, totalParsed, skipped } = await parseAppleHealthStream(targetBlob, setProgress, cutoffs);
      setStats({ vitals: vitals.length, bodyComp: bodyComp.length, total: totalParsed, skipped });

      if (totalParsed === 0) {
        if (skipped > 0) {
          // All data was already up to date!
          setStatus('done');
          setProgress(100);
          setTimeout(() => onUploadComplete(), 1500);
          return;
        }
        setStatus('error');
        return;
      }

      setStatus('uploading');
      await uploadToSupabase(vitals, bodyComp, setProgress);

      setStatus('computing');
      setProgress(96);
      await computeDailySummaries();

      setProgress(100);
      setStatus('done');
      setTimeout(() => onUploadComplete(), 1500);
    } catch (err) {
      console.error('Upload error:', err);
      setStatus('error');
    }
  };

  const handleDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  return (
    <div className="upload-overlay" onClick={(e) => { if (e.target === e.currentTarget && status === 'idle') onClose(); }}>
      <div className="upload-modal">
        {status === 'idle' && (<>
          <h2>Import Apple Health Data</h2>
          <p>Upload your Apple Health export (.zip or .xml) to populate your dashboard</p>
          <div className={`upload-dropzone ${dragging ? 'dragging' : ''}`}
            onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}>
            <div className="icon">📱</div>
            <div className="text">Drag & drop your Apple Health export here<br />or <strong>click to browse</strong></div>
          </div>
          <input ref={fileInputRef} type="file" accept=".xml,.zip" style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files[0])} />
          <button className="btn btn-secondary" onClick={onClose} style={{ margin: '0 auto' }}>Cancel</button>
        </>)}

        {(status === 'parsing' || status === 'uploading' || status === 'computing') && (<>
          <h2>{status === 'parsing' ? '🔍 Parsing Health Data...' : status === 'uploading' ? '☁️ Uploading to Database...' : '🧮 Computing Summaries...'}</h2>
          <p style={{ marginBottom: '8px' }}>{status === 'parsing' ? 'Reading your Apple Health records' : status === 'uploading' ? `Syncing ${stats?.total?.toLocaleString() || ''} records to Supabase` : 'Generating daily summaries & health scores'}</p>
          <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div>
          <p style={{ fontSize: '13px', marginTop: '12px', color: 'var(--text-muted)' }}>{progress}% complete</p>
        </>)}

        {status === 'done' && (<>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
          <h2>Import Complete!</h2>
          <p>{stats?.total?.toLocaleString()} health records imported successfully</p>
        </>)}

        {status === 'error' && (<>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
          <h2>Import Issue</h2>
          <p>Could not parse health records from the file. Make sure it's a valid Apple Health export.</p>
          <button className="btn btn-primary" onClick={() => { setStatus('idle'); setProgress(0); }} style={{ margin: '0 auto' }}>Try Again</button>
        </>)}
      </div>
    </div>
  );
}

// =================== MAIN APP ===================

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState([]);
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);
  const [latestVitals, setLatestVitals] = useState({});
  const [latestBody, setLatestBody] = useState({});
  const [hasData, setHasData] = useState(false);
  const [dbError, setDbError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setDbError(null);
    try {
      // Fetch daily summaries (last 365 days, most recent first then reverse for charts)
      const { data: sumData, error: sumError } = await supabase.from('daily_summary').select('*').order('date', { ascending: false }).limit(365);
      if (sumError) {
        console.error('Supabase daily_summary error:', sumError);
        setDbError(sumError.message || 'Database fetch failed');
      }
      setSummaries((sumData || []).reverse());
      setHasData((sumData || []).length > 0);

      // Fetch latest vitals by type
      const vitalTypes = ['heart_rate', 'resting_heart_rate', 'hrv', 'blood_oxygen', 'blood_pressure_systolic', 'blood_pressure_diastolic', 'respiratory_rate'];
      const vMap = {};
      for (const vt of vitalTypes) {
        const { data } = await supabase.from('vitals').select('*').eq('metric_type', vt).order('recorded_at', { ascending: false }).limit(1);
        if (data && data[0]) vMap[vt] = data[0];
      }
      setLatestVitals(vMap);

      // Fetch latest body composition
      const bodyTypes = ['weight', 'bmi', 'body_fat_percentage', 'lean_body_mass'];
      const bMap = {};
      for (const bt of bodyTypes) {
        const { data } = await supabase.from('body_composition').select('*').eq('metric_type', bt).order('recorded_at', { ascending: false }).limit(1);
        if (data && data[0]) bMap[bt] = data[0];
      }
      setLatestBody(bMap);

      // Fetch lab results
      const { data: labData } = await supabase.from('lab_results').select('*').order('test_date', { ascending: true });
      setLabResults(labData || []);

      // Fetch medications
      const { data: medsData } = await supabase.from('medications').select('*').eq('is_active', true).order('scheduled_time', { ascending: true });
      setMedications(medsData || []);

      // Fetch 30-day adherence rate
      if (medsData && medsData.length > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        const startDate = thirtyDaysAgo.toISOString().split('T')[0];
        const { data: logData } = await supabase.from('medication_log').select('status').gte('scheduled_date', startDate);
        if (logData) {
          const total = logData.length;
          const taken = logData.filter(l => l.status === 'taken').length;
          setAdherenceRate(total > 0 ? Math.round((taken / total) * 100) : null);
        }
      }

      // Fetch insights
      const { data: insData } = await supabase.from('health_insights').select('*').order('created_at', { ascending: false }).limit(10);
      setInsights(insData || []);

      // Generate new AI insights if none stored (or stale >24h)
      if (sumData && sumData.length > 7) {
        const needsRefresh = !insData || insData.length === 0 ||
          (insData[0]?.created_at && new Date() - new Date(insData[0].created_at) > 24 * 60 * 60 * 1000);
        if (needsRefresh) {
          setInsightsLoading(true);
          setInsightsError(null);
          try {
            const newInsights = await generateAIInsights(supabase);
            if (newInsights.length > 0) setInsights(newInsights);
            else if (!insData || insData.length === 0) {
              setInsightsError('No insights returned. Your Gemini API key may be invalid — update VITE_GEMINI_API_KEY in Vercel.');
            }
          } catch (err) {
            console.error('Auto insights error:', err);
            if (!insData || insData.length === 0) {
              setInsightsError('Gemini API key may be blocked. Go to https://aistudio.google.com to generate a new key.');
            }
          } finally {
            setInsightsLoading(false);
          }
        }
      }
    } catch (err) {
      console.error('Load error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData().then(() => {
      // Generate daily briefing after data loads
      setBriefingLoading(true);
      generateDailyBriefing(supabase).then(briefing => {
        setDailyBriefing(briefing);
        setBriefingLoading(false);
      }).catch(() => setBriefingLoading(false));
    });
  }, []);

  // Lab results and medications state
  const [labResults, setLabResults] = useState([]);
  const [medications, setMedications] = useState([]);
  const [adherenceRate, setAdherenceRate] = useState(null);

  // Compute live 100-Point Post-MI Cardiovascular Recovery Index
  const liveHealthResult = useMemo(() => {
    const safeLabs = Array.isArray(labResults) ? labResults : [];
    const safeVitals = latestVitals || {};
    const safeBody = latestBody || {};
    const ldlVal = safeLabs.find(l => l?.metric_type === 'ldl_cholesterol')?.value;
    const hba1cVal = safeLabs.find(l => l?.metric_type === 'hba1c')?.value;
    const weightVal = safeBody.weight?.value ? parseFloat(safeBody.weight.value) : null;
    const prevWeightVal = summaries.length > 7 ? summaries[summaries.length - 7]?.weight_kg : null;
    const weightChange7d = (weightVal && prevWeightVal) ? Math.round((weightVal - prevWeightVal) * 10) / 10 : null;

    return computeHealthScore({
      adherenceRate,
      systolicBP: safeVitals.blood_pressure_systolic?.value,
      diastolicBP: safeVitals.blood_pressure_diastolic?.value,
      restingHR: safeVitals.resting_heart_rate?.value,
      ldl: ldlVal ? parseFloat(ldlVal) : null,
      hba1c: hba1cVal ? parseFloat(hba1cVal) : null,
      hrv: safeVitals.hrv?.value,
      spo2: safeVitals.blood_oxygen?.value,
      steps: safeVitals.steps?.value,
      weight: weightVal,
      weightChange7d,
    });
  }, [adherenceRate, latestVitals, latestBody, labResults, summaries]);

  const latestSummary = summaries.length ? summaries[summaries.length - 1] : null;
  const prevSummary = summaries.length > 1 ? summaries[summaries.length - 2] : null;
  const healthScore = liveHealthResult.totalScore || latestSummary?.health_score || 0;

  const formatDate = (d) => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };

  const chartData = useMemo(() => summaries.slice(-90).map(s => ({
    ...s,
    label: formatDate(s.date),
  })), [summaries]);

  const weeklyScores = useMemo(() => {
    const weeks = [];
    for (let i = 0; i < summaries.length; i += 7) {
      const week = summaries.slice(i, i + 7);
      const avg = week.filter(s => s.health_score).reduce((a, s) => a + s.health_score, 0) / week.filter(s => s.health_score).length;
      weeks.push({ label: formatDate(week[0]?.date), score: Math.round(avg || 0) });
    }
    return weeks.slice(-12);
  }, [summaries]);

  // Daily briefing state
  const [dailyBriefing, setDailyBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  // BP Logger modal state
  const [showBPLogger, setShowBPLogger] = useState(false);

  // Lab Entry modal state
  const [showLabEntry, setShowLabEntry] = useState(false);

  // Exercise Logger modal state
  const [showExerciseLogger, setShowExerciseLogger] = useState(false);

  // Weight Logger modal state
  const [showWeightLogger, setShowWeightLogger] = useState(false);

  // Google Health API Sync modal state
  const [showGoogleHealthSync, setShowGoogleHealthSync] = useState(false);

  // Build clinicalData from real lab_results table
  const clinicalData = useMemo(() => {
    if (!labResults || labResults.length === 0) return [];

    // Group by test_date
    const byDate = {};
    labResults.forEach(lr => {
      const d = lr.test_date;
      if (!byDate[d]) byDate[d] = {};
      byDate[d][lr.metric_type] = lr.value;
    });

    // Get unique dates sorted ascending, build chart data
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, metrics]) => ({
        date: new Date(date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
        rawDate: date,
        ldl: metrics.ldl_cholesterol ? Number(metrics.ldl_cholesterol) : undefined,
        hba1c: metrics.hba1c ? Number(metrics.hba1c) : undefined,
        sys: metrics.systolic_bp ? Number(metrics.systolic_bp) : undefined,
        dia: metrics.diastolic_bp ? Number(metrics.diastolic_bp) : undefined,
        total_chol: metrics.total_cholesterol ? Number(metrics.total_cholesterol) : undefined,
        hdl: metrics.hdl_cholesterol ? Number(metrics.hdl_cholesterol) : undefined,
        trig: metrics.triglycerides ? Number(metrics.triglycerides) : undefined,
        apob: metrics.apob ? Number(metrics.apob) : undefined,
        lpa: metrics.lpa ? Number(metrics.lpa) : undefined,
      }));
  }, [labResults]);

  // ====== RENDER ======
  if (loading) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="loading-pulse" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❤️</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading your health data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploadComplete={() => { setShowUpload(false); loadData(); }} />}
      {showWeightLogger && <WeightLogger supabase={supabase} onClose={() => setShowWeightLogger(false)} onSaved={() => { setShowWeightLogger(false); loadData(); }} />}
      {showGoogleHealthSync && <GoogleHealthSync supabase={supabase} onClose={() => setShowGoogleHealthSync(false)} onSynced={() => { setShowGoogleHealthSync(false); loadData(); }} />}

      {/* Header */}
      <div className="header no-print">
        <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src={`${import.meta.env.BASE_URL}dr_kuzbury.jpg`} alt="Dr. Kuzbury" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} />
          <div>
            <h1 style={{ margin: 0, padding: 0 }}>Dr. Kuzbury</h1>
            <p style={{ margin: '4px 0 0 0', padding: 0 }}>{hasData ? `AI Cardiologist • Last sync: ${latestSummary?.date || 'N/A'}` : 'Your Personal AI Cardiologist'}</p>
          </div>
        </div>
        <div className="header-right">
          <button className="btn btn-secondary" onClick={() => setShowGoogleHealthSync(true)}>🌐 Google Health API</button>
          <button className="btn btn-secondary" onClick={() => setShowWeightLogger(true)}>⚖️ Log Weight</button>
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
            📱 {hasData ? 'Update Data' : 'Import Apple Health'}
          </button>
          <button className="btn btn-secondary" onClick={loadData}>🔄 Refresh</button>
        </div>
      </div>

      {dbError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', color: '#ff6666'
        }}>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>⚠️ Database Connection Error</div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            Unable to connect to Supabase database (<strong>ajgeanhsqhzrwtwfrkdu.supabase.co</strong>): <em>{dbError}</em>
            <br />
            If your free-tier Supabase project is <strong>paused due to 7 days of inactivity</strong>, log into <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>Supabase Dashboard</a> and click <strong>Restore Project</strong>.
          </p>
        </div>
      )}

      {!hasData ? (
        <div className="empty-state">
          <img src={`${import.meta.env.BASE_URL}dr_kuzbury.jpg`} alt="Dr. Kuzbury" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(255,255,255,0.1)', marginBottom: '24px' }} />
          <h3>"{getTimeOfDayGreeting()} Shahbaz, I'm Dr. Kuzbury."</h3>
          <p>Import your base historical vitals from Apple Health so I can begin formulating your N=1 clinical baseline and trajectory.</p>
          <button className="btn btn-primary" onClick={() => setShowUpload(true)} style={{ margin: '0 auto' }}>
            📱 Import Apple Health Data
          </button>
          <div style={{ marginTop: '40px', textAlign: 'left', maxWidth: '480px', margin: '40px auto 0' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>How to export from iPhone:</p>
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '2' }}>
              1. Open the <strong style={{ color: 'var(--text-secondary)' }}>Health</strong> app<br />
              2. Tap your profile picture (top-right)<br />
              3. Scroll down → <strong style={{ color: 'var(--text-secondary)' }}>Export All Health Data</strong><br />
              4. Share the .zip file to your computer<br />
              5. Upload it here
            </div>
          </div>
        </div>
      ) : (<>
        {/* Navigation */}
        <div className="nav-tabs no-print">
          {['overview', 'medications', 'vitals', 'body', 'clinical', 'insights', 'add-data', 'report'].map(tab => (
            <button key={tab} className={`nav-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab === 'overview' ? '📊 Overview' : tab === 'medications' ? '💊 Medications' : tab === 'vitals' ? '❤️ Vitals' : tab === 'body' ? '🏋️ Body' : tab === 'clinical' ? '🩸 Clinical' : tab === 'insights' ? '💡 Insights' : tab === 'add-data' ? '➕ Add Data' : '📄 Report'}
            </button>
          ))}
        </div>

        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && (<>
          {/* Daily Briefing */}
          {(dailyBriefing || briefingLoading) && (
            <div className="card fade-in" style={{ marginBottom: '24px', borderLeft: '4px solid var(--accent)' }}>
              <div className="card-header">
                <span className="card-icon">🩺</span>
                <h3>Daily Briefing from Dr. Kuzbury</h3>
              </div>
              {briefingLoading ? (
                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Analysing your latest health data...</p>
              ) : (
                <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{dailyBriefing}</p>
              )}
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <KuzburyChat supabase={supabase} />
          </div>
          <div className="cards-grid" style={{ gridTemplateColumns: '300px 1fr', marginBottom: '24px' }}>
            {/* Health Score */}
            <div className="card fade-in">
              <div className="card-header">
                <span className="card-title">Overall Health Score</span>
                <span className={`badge ${healthScore >= 80 ? 'badge-green' : healthScore >= 60 ? 'badge-amber' : 'badge-red'}`}>
                  {healthScore >= 80 ? '● Excellent' : healthScore >= 60 ? '● Good' : '● Needs Attention'}
                </span>
              </div>
              <HealthScoreRing score={healthScore} />
              <div className="stat-row">
                <div className="stat-item"><div className="stat-label">7-Day Avg</div><div className="stat-value">{Math.round(summaries.slice(-7).filter(s => s.health_score).reduce((a, s) => a + s.health_score, 0) / Math.max(1, summaries.slice(-7).filter(s => s.health_score).length))}</div></div>
                <div className="stat-item"><div className="stat-label">30-Day Avg</div><div className="stat-value">{Math.round(summaries.slice(-30).filter(s => s.health_score).reduce((a, s) => a + s.health_score, 0) / Math.max(1, summaries.slice(-30).filter(s => s.health_score).length))}</div></div>
                <div className="stat-item"><div className="stat-label">Best</div><div className="stat-value">{Math.max(...summaries.filter(s => s.health_score).map(s => s.health_score), 0)}</div></div>
              </div>
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '11px', lineHeight: '1.8' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Recovery Pillars (100 pts):</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>💊 Meds Adherence:</span><strong style={{ color: '#10b981' }}>{liveHealthResult.pillars?.adherence ?? 0}/30</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🩺 BP & RHR:</span><strong style={{ color: '#3b82f6' }}>{liveHealthResult.pillars?.bpRhr ?? 0}/25</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🧪 Biomarkers (LDL/A1c):</span><strong style={{ color: '#8b5cf6' }}>{liveHealthResult.pillars?.biomarkers ?? 0}/25</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🫁 HRV & SpO2:</span><strong style={{ color: '#06b6d4' }}>{liveHealthResult.pillars?.autonomic ?? 0}/15</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>👟 Activity:</span><strong style={{ color: '#f59e0b' }}>{liveHealthResult.pillars?.activity ?? 0}/5</strong></div>
              </div>
            </div>

            {/* Weekly Health Score Trend */}
            <ChartCard title="Health Score Trend" icon="📈" color="#10b981">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[40, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="health_score" name="Health Score" stroke="#10b981" fill="url(#scoreGrad)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Quick Stats */}
          <div className="cards-grid cards-grid-4">
            <MetricCard title="Resting Heart Rate" value={latestSummary?.resting_heart_rate || '—'} unit="bpm" icon="❤️" color="#ef4444"
              trend={prevSummary && latestSummary ? latestSummary.resting_heart_rate - prevSummary.resting_heart_rate : 0}
              trendLabel={prevSummary ? `${Math.abs(Math.round((latestSummary?.resting_heart_rate || 0) - (prevSummary?.resting_heart_rate || 0)))} from yesterday` : null}
              sparkData={chartData.filter(d => d.resting_heart_rate)} sparkKey="resting_heart_rate" />
            <MetricCard title="HRV" value={latestSummary?.hrv_avg || '—'} unit="ms" icon="📊" color="#8b5cf6"
              trend={prevSummary && latestSummary ? latestSummary.hrv_avg - prevSummary.hrv_avg : 0}
              trendLabel={prevSummary ? `${Math.abs(Math.round((latestSummary?.hrv_avg || 0) - (prevSummary?.hrv_avg || 0)))} ms change` : null}
              sparkData={chartData.filter(d => d.hrv_avg)} sparkKey="hrv_avg" />
            <MetricCard title="Blood Oxygen" value={latestSummary?.blood_oxygen_avg || '—'} unit="%" icon="🫁" color="#06b6d4"
              sparkData={chartData.filter(d => d.blood_oxygen_avg)} sparkKey="blood_oxygen_avg" />
            <MetricCard title="Weight" value={latestSummary?.weight_kg || latestBody?.weight?.value || '—'} unit="kg" icon="⚖️" color="#f59e0b"
              sparkData={chartData.filter(d => d.weight_kg)} sparkKey="weight_kg" />
          </div>
        </>)}

        {/* ===== MEDICATIONS TAB ===== */}
        {activeTab === 'medications' && (
          <MedicationManager supabase={supabase} />
        )}

        {/* ===== VITALS TAB ===== */}
        {activeTab === 'vitals' && (<>
          <div className="section-header">
            <div className="section-icon" style={{ background: 'var(--accent-red-glow)', color: 'var(--accent-red)' }}>❤️</div>
            <span className="section-title">Heart & Vitals</span>
          </div>
          <div className="cards-grid cards-grid-3" style={{ marginBottom: '24px' }}>
            <MetricCard title="Heart Rate (Latest)" value={latestVitals.heart_rate?.value || latestSummary?.avg_heart_rate || '—'} unit="bpm" icon="💓" color="#ef4444"
              sparkData={chartData.filter(d => d.avg_heart_rate).map(d => ({ ...d, value: d.avg_heart_rate }))} />
            <MetricCard title="Resting HR" value={latestVitals.resting_heart_rate?.value || latestSummary?.resting_heart_rate || '—'} unit="bpm" icon="😴" color="#3b82f6"
              sparkData={chartData.filter(d => d.resting_heart_rate).map(d => ({ ...d, value: d.resting_heart_rate }))} />
            <MetricCard title="HRV" value={latestVitals.hrv?.value ? Math.round(latestVitals.hrv.value * 10) / 10 : (latestSummary?.hrv_avg ? Math.round(latestSummary.hrv_avg * 10) / 10 : '—')} unit="ms" icon="📊" color="#8b5cf6"
              sparkData={chartData.filter(d => d.hrv_avg).map(d => ({ ...d, value: d.hrv_avg }))} />
          </div>
          <div className="cards-grid" style={{ marginBottom: '24px' }}>
            <ChartCard title="Heart Rate Trends (90 days)" icon="❤️" color="#ef4444">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="max_heart_rate" name="Max HR" stroke="#ef444480" fill="none" strokeWidth={1} dot={false} strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="avg_heart_rate" name="Avg HR" stroke="#ef4444" fill="url(#hrGrad)" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="resting_heart_rate" name="Resting HR" stroke="#3b82f6" fill="none" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="HRV Trend (90 days)" icon="📊" color="#8b5cf6">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData.filter(d => d.hrv_avg)}>
                  <defs>
                    <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="hrv_avg" name="HRV" stroke="#8b5cf6" fill="url(#hrvGrad)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="cards-grid cards-grid-3">
            <MetricCard title="Blood Oxygen (SpO2)" value={latestVitals.blood_oxygen?.value ? Math.round(latestVitals.blood_oxygen.value * 10) / 10 : (latestSummary?.blood_oxygen_avg ? Math.round(latestSummary.blood_oxygen_avg * 10) / 10 : '—')} unit="%" icon="🫁" color="#06b6d4"
              sparkData={chartData.filter(d => d.blood_oxygen_avg).map(d => ({ ...d, value: d.blood_oxygen_avg }))} />
            <MetricCard title="Blood Pressure" value={latestVitals.blood_pressure_systolic ? `${Math.round(latestVitals.blood_pressure_systolic.value)}/${Math.round(latestVitals.blood_pressure_diastolic?.value || 0)}` : '—'} unit="mmHg" icon="🩺" color="#f59e0b" />
            <MetricCard title="Respiratory Rate" value={latestVitals.respiratory_rate?.value ? Math.round(latestVitals.respiratory_rate.value * 10) / 10 : '—'} unit="/min" icon="🌬️" color="#10b981" />
          </div>
        </>)}

        {/* ===== BODY TAB ===== */}
        {activeTab === 'body' && (<>
          <div className="section-header">
            <div className="section-icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>🏋️</div>
            <span className="section-title">Body Composition</span>
          </div>
          <div className="cards-grid cards-grid-4" style={{ marginBottom: '24px' }}>
            <MetricCard title="Weight" value={latestBody.weight?.value ? Math.round(latestBody.weight.value * 10) / 10 : '—'} unit="kg" icon="⚖️" color="#f59e0b"
              sparkData={chartData.filter(d => d.weight_kg).map(d => ({ ...d, value: d.weight_kg }))} />
            <MetricCard title="BMI" value={latestBody.bmi?.value ? Math.round(latestBody.bmi.value * 10) / 10 : '—'} unit="" icon="📐" color="#3b82f6" />
            <MetricCard title="Body Fat" value={latestBody.body_fat_percentage?.value ? Math.round(latestBody.body_fat_percentage.value * 10) / 10 : '—'} unit="%" icon="🔥" color="#ef4444"
              sparkData={chartData.filter(d => d.body_fat_pct).map(d => ({ ...d, value: d.body_fat_pct }))} />
            <MetricCard title="Lean Mass" value={latestBody.lean_body_mass?.value ? Math.round(latestBody.lean_body_mass.value * 10) / 10 : '—'} unit="kg" icon="💪" color="#10b981" />
          </div>
          <div className="cards-grid">
            <ChartCard title="Weight Trend" icon="⚖️" color="#f59e0b">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData.filter(d => d.weight_kg)}>
                  <defs>
                    <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="weight_kg" name="Weight" stroke="#f59e0b" fill="url(#weightGrad)" strokeWidth={2.5} dot={{ r: 3, fill: '#f59e0b' }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Body Fat % Trend" icon="🔥" color="#ef4444">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData.filter(d => d.body_fat_pct)}>
                  <defs>
                    <linearGradient id="bfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="body_fat_pct" name="Body Fat %" stroke="#ef4444" fill="url(#bfGrad)" strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444' }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>)}

        {/* ===== CLINICAL TAB ===== */}
        {activeTab === 'clinical' && (<>
          <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="section-icon" style={{ background: 'var(--accent-red-glow)', color: '#ef4444' }}>🩸</div>
              <span className="section-title">Clinical Biomarkers & Targets</span>
            </div>
            <button className="btn btn-primary" onClick={() => setShowLabEntry(true)}>+ Add Lab Result</button>
          </div>
          <div style={{ marginBottom: '24px', opacity: 0.8, fontSize: '14px' }}>
            Tracking secondary prevention longevity pathways based on 2025 AHA/ACC Chronic Coronary Disease guidelines.
          </div>

          {clinicalData.length > 0 ? (
            <div className="cards-grid" style={{ marginBottom: '24px' }}>
              <GlidePathChart
                title="LDL Cholesterol Trajectory"
                data={clinicalData.filter(d => d.ldl != null)}
                dataKey="ldl"
                color="#f59e0b"
                targetMax={55}
                targetLabel="< 55 mg/dL (ASCVD Target)"
                unit="mg/dL"
                yDomain={[40, 130]}
              />
              <GlidePathChart
                title="Systolic Blood Pressure Trend"
                data={clinicalData.filter(d => d.sys != null)}
                dataKey="sys"
                color="#ef4444"
                targetMax={130}
                targetLabel="< 130 mmHg"
                unit="mmHg"
                yDomain={[110, 160]}
              />
            </div>
          ) : (
            <div className="card fade-in" style={{ padding: '40px', textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🩸</div>
              <h3 style={{ marginBottom: '8px' }}>No Lab Results Yet</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Click "+ Add Lab Result" above to enter your first blood test, or scan a lab report in the Add Data tab.</p>
            </div>
          )}

          <div className="cards-grid cards-grid-3">
            {(() => {
              const latest = clinicalData.length ? clinicalData[clinicalData.length - 1] : {};
              return (<>
                <MetricCard title="Latest LDL-C" value={latest.ldl ?? '—'} unit="mg/dL" icon="🩸" color={latest.ldl && latest.ldl <= 55 ? '#10b981' : '#f59e0b'} />
                <MetricCard title="HbA1c" value={latest.hba1c ?? '—'} unit="%" icon="🍬" color="#3b82f6" />
                <MetricCard title="ApoB" value={latest.apob ?? '—'} unit="mg/dL" icon="🧬" color={latest.apob && latest.apob <= 65 ? '#10b981' : '#f59e0b'} />
              </>);
            })()}
          </div>
        </>)}

        {/* ===== INSIGHTS TAB ===== */}
        {activeTab === 'insights' && (<>
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="section-icon" style={{ background: 'var(--accent-purple-glow)', color: 'var(--accent-purple)' }}>💡</div>
              <span className="section-title">AI Health Insights</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '10px', background: 'rgba(0,204,136,0.1)', border: '1px solid rgba(0,204,136,0.2)' }}>
                Powered by Gemini
              </span>
            </div>
            <button
              onClick={async () => {
                setInsightsLoading(true);
                setInsightsError(null);
                try {
                  const fresh = await generateAIInsights(supabase);
                  if (fresh.length > 0) {
                    setInsights(fresh);
                  } else {
                    setInsightsError('No insights returned. Check that your Gemini API key is valid in Vercel → Settings → Environment Variables.');
                  }
                } catch (err) {
                  console.error('Insights refresh error:', err);
                  const msg = err?.message || '';
                  if (msg.includes('403') || msg.includes('API_KEY') || msg.includes('key')) {
                    setInsightsError('Gemini API key is blocked or invalid. Go to https://aistudio.google.com to generate a new key, then update VITE_GEMINI_API_KEY in Vercel.');
                  } else {
                    setInsightsError(`Failed to generate insights: ${msg || 'Unknown error'}`);
                  }
                } finally {
                  setInsightsLoading(false);
                }
              }}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)',
                background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              ↻ Refresh
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
            Dr. Kuzbury analyses your 90-day trends and lab history to surface clinically meaningful patterns. Refreshed every 24 hours.
          </p>
          {insightsError ? (
            <div style={{
              background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)',
              borderRadius: '12px', padding: '20px 24px', marginBottom: '20px'
            }}>
              <div style={{ color: '#ff6666', fontWeight: '600', marginBottom: '8px' }}>⚠️ Insights Unavailable</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>{insightsError}</p>
            </div>
          ) : insightsLoading ? (
            <div className="empty-state" style={{ padding: '40px' }}>
              <div className="icon">💡</div>
              <h3>Generating insights…</h3>
              <p>Analysing 90-day trend data. This takes a few seconds.</p>
            </div>
          ) : insights.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px' }}>
              <div className="icon">💡</div>
              <h3>No insights yet</h3>
              <p>Click Refresh to generate your first AI health analysis.</p>
            </div>
          ) : (
            insights.map((insight, i) => {
              const severityColors = { alert: '#ff4444', warning: '#ffaa00', info: '#00cc88' };
              const severityIcons = { alert: '🚨', warning: '⚠️', info: '✅' };
              const color = severityColors[insight.severity] || '#00cc88';
              return (
                <div key={i} className="insight-item fade-in" style={{
                  animationDelay: `${i * 0.05}s`,
                  borderLeft: `3px solid ${color}`,
                  paddingLeft: '16px',
                  marginBottom: '16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span>{severityIcons[insight.severity] || '💡'}</span>
                    <div className="insight-title" style={{ color }}>{insight.title}</div>
                  </div>
                  <div className="insight-desc">{insight.description}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    {insight.date} · {insight.category}
                    {insight.metric_type && ` · ${insight.metric_type.replace(/_/g, ' ')}`}
                  </div>
                </div>
              );
            })
          )}
        </>)}
        {/* ===== ADD DATA TAB ===== */}
        {activeTab === 'add-data' && (
          <DataCapture supabase={supabase} onDataAdded={loadData} />
        )}

        {/* ===== REPORT TAB ===== */}
        {activeTab === 'report' && (
          <ClinicianReport
            summaries={summaries}
            clinicalData={clinicalData}
            latestVitals={latestVitals}
            latestBody={latestBody}
            adherenceRate={adherenceRate}
            medications={medications}
          />
        )}
      </>)}

      {/* Exercise Logger FAB — visible on Vitals tab */}
      {activeTab === 'vitals' && (
        <button
          onClick={() => setShowExerciseLogger(true)}
          title="Log Exercise Session"
          style={{
            position: 'fixed', bottom: '96px', right: '28px', zIndex: 900,
            width: '56px', height: '56px', borderRadius: '50%', border: 'none',
            background: '#6c63ff', color: '#fff', cursor: 'pointer',
            fontSize: '22px', fontWeight: '700', boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={e => e.target.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.target.style.transform = 'scale(1)'}
        >
          🏃
        </button>
      )}

      {/* BP Logger FAB — visible on Overview and Vitals tabs */}
      {(activeTab === 'overview' || activeTab === 'vitals') && (
        <button
          onClick={() => setShowBPLogger(true)}
          title="Log Blood Pressure"
          style={{
            position: 'fixed', bottom: '28px', right: '28px', zIndex: 900,
            width: '56px', height: '56px', borderRadius: '50%', border: 'none',
            background: 'var(--accent, #00cc88)', color: '#000', cursor: 'pointer',
            fontSize: '24px', fontWeight: '700', boxShadow: '0 4px 20px rgba(0,204,136,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={e => e.target.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.target.style.transform = 'scale(1)'}
        >
          🩸
        </button>
      )}

      {/* BP Logger Modal */}
      {showLabEntry && (
        <LabEntryForm
          supabase={supabase}
          onClose={() => setShowLabEntry(false)}
          onSaved={loadData}
        />
      )}

      {showBPLogger && (
        <BPLogger
          supabase={supabase}
          onClose={() => setShowBPLogger(false)}
          onSaved={loadData}
        />
      )}

      {showExerciseLogger && (
        <ExerciseLogger
          supabase={supabase}
          onClose={() => setShowExerciseLogger(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
