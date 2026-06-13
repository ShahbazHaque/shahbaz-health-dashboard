import React, { useState, useEffect } from 'react';
import { X, Dumbbell } from 'lucide-react';

const EXERCISE_TYPES = [
  { value: 'walking', label: '🚶 Walking' },
  { value: 'cycling', label: '🚴 Cycling' },
  { value: 'swimming', label: '🏊 Swimming' },
  { value: 'strength', label: '🏋️ Strength Training' },
  { value: 'yoga', label: '🧘 Yoga / Stretching' },
  { value: 'running', label: '🏃 Running / Jogging' },
  { value: 'other', label: '⚡ Other' },
];

const INTENSITIES = [
  { value: 'light', label: 'Light', desc: 'Easy, can sing', color: '#00cc88' },
  { value: 'moderate', label: 'Moderate', desc: 'Can talk, slight breathlessness', color: '#ffaa00' },
  { value: 'vigorous', label: 'Vigorous', desc: 'Hard, minimal talking', color: '#ff6b35' },
];

const inp = (invalid) => ({
  width: '100%', padding: '10px', borderRadius: '8px', fontSize: '15px',
  background: 'var(--bg-page, #0d0d1a)',
  border: `1px solid ${invalid ? '#ff4444' : 'var(--border, #333)'}`,
  color: 'var(--text-primary, #fff)', outline: 'none', boxSizing: 'border-box',
});

const lbl = { fontSize: '12px', color: 'var(--text-secondary, #888)', marginBottom: '6px', display: 'block' };

export default function ExerciseLogger({ supabase, onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [exerciseType, setExerciseType] = useState('walking');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState('moderate');
  const [maxHR, setMaxHR] = useState('');
  const [avgHR, setAvgHR] = useState('');
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // HR zone guidance based on age 45 — max HR ≈ 175 bpm
  const TARGET_HR = { light: '88–105', moderate: '105–131', vigorous: '131–157' };

  const isValidDuration = duration === '' || (parseInt(duration) > 0 && parseInt(duration) <= 480);
  const isValidMaxHR = maxHR === '' || (parseInt(maxHR) >= 30 && parseInt(maxHR) <= 220);
  const isValidAvgHR = avgHR === '' || (parseInt(avgHR) >= 30 && parseInt(avgHR) <= 220);
  const canSave = date && exerciseType && duration && isValidDuration && intensity && isValidMaxHR && isValidAvgHR;

  // Warn if HR too high for post-MI patient
  const hrWarning = (parseInt(maxHR) > 157) ? 'Max HR above vigorous zone target for age 45 (>157 bpm). Was this intentional?' : null;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');

    try {
      const { error: insErr } = await supabase.from('exercise_log').insert({
        date,
        exercise_type: exerciseType,
        duration_minutes: parseInt(duration),
        intensity,
        max_hr: maxHR ? parseInt(maxHR) : null,
        avg_hr: avgHR ? parseInt(avgHR) : null,
        distance_km: distance ? parseFloat(distance) : null,
        calories: calories ? parseInt(calories) : null,
        symptoms_during: symptoms || null,
        notes: notes || null,
      });
      if (insErr) throw insErr;

      if (onSaved) onSaved();
      setSuccess(true);
      setTimeout(() => onClose(), 1800);
    } catch (err) {
      console.error('Exercise log save error:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const selectedType = EXERCISE_TYPES.find(t => t.value === exerciseType);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card, #1a1a2e)', borderRadius: '16px', padding: '28px',
        maxWidth: '480px', width: '100%', border: '1px solid var(--border, #333)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto'
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Dumbbell size={22} color="var(--accent, #00cc88)" />
            <h3 style={{ margin: 0, color: 'var(--text-primary, #fff)' }}>Log Exercise</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={20} color="var(--text-secondary, #888)" />
          </button>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
            <p style={{ color: 'var(--accent, #00cc88)', fontWeight: '600', fontSize: '16px' }}>Exercise Logged!</p>
            <p style={{ color: 'var(--text-secondary, #888)', fontSize: '13px' }}>
              {selectedType?.label} · {duration} min · {intensity}
            </p>
          </div>
        ) : (
          <>
            {/* Date */}
            <div style={{ marginBottom: '16px' }}>
              <label style={lbl}>Date</label>
              <input type="date" value={date} max={today}
                onChange={e => setDate(e.target.value)} style={inp(false)} />
            </div>

            {/* Exercise Type */}
            <div style={{ marginBottom: '16px' }}>
              <label style={lbl}>Exercise Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {EXERCISE_TYPES.map(t => (
                  <button key={t.value} onClick={() => setExerciseType(t.value)}
                    style={{
                      padding: '10px 8px', borderRadius: '8px', cursor: 'pointer',
                      fontSize: '13px', textAlign: 'left',
                      background: exerciseType === t.value ? 'rgba(0,204,136,0.15)' : 'var(--bg-page, #0d0d1a)',
                      color: exerciseType === t.value ? 'var(--accent, #00cc88)' : 'var(--text-secondary, #888)',
                      border: `1px solid ${exerciseType === t.value ? 'var(--accent, #00cc88)' : 'var(--border, #333)'}`,
                      fontWeight: exerciseType === t.value ? '600' : '400',
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div style={{ marginBottom: '16px' }}>
              <label style={lbl}>Duration (minutes)</label>
              <input type="number" value={duration} min="1" max="480"
                onChange={e => setDuration(e.target.value)} placeholder="e.g. 30"
                style={{ ...inp(!isValidDuration && duration !== ''), fontSize: '18px', fontWeight: '600', textAlign: 'center' }} />
            </div>

            {/* Intensity */}
            <div style={{ marginBottom: '16px' }}>
              <label style={lbl}>Intensity</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {INTENSITIES.map(lvl => (
                  <button key={lvl.value} onClick={() => setIntensity(lvl.value)}
                    style={{
                      flex: 1, padding: '10px 6px', borderRadius: '8px', cursor: 'pointer',
                      textAlign: 'center',
                      background: intensity === lvl.value ? `${lvl.color}22` : 'var(--bg-page, #0d0d1a)',
                      color: intensity === lvl.value ? lvl.color : 'var(--text-secondary, #888)',
                      border: `1px solid ${intensity === lvl.value ? lvl.color : 'var(--border, #333)'}`,
                      fontWeight: intensity === lvl.value ? '600' : '400',
                    }}>
                    <div style={{ fontSize: '13px' }}>{lvl.label}</div>
                    <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>{lvl.desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #666)', marginTop: '6px' }}>
                Target HR for age 45: {TARGET_HR[intensity]} bpm
              </div>
            </div>

            {/* HR fields */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Avg HR (optional)</label>
                <input type="number" value={avgHR} min="30" max="220"
                  onChange={e => setAvgHR(e.target.value)} placeholder="bpm"
                  style={{ ...inp(!isValidAvgHR && avgHR !== ''), textAlign: 'center' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Max HR (optional)</label>
                <input type="number" value={maxHR} min="30" max="220"
                  onChange={e => setMaxHR(e.target.value)} placeholder="bpm"
                  style={{ ...inp(!isValidMaxHR && maxHR !== ''), textAlign: 'center' }} />
              </div>
            </div>

            {hrWarning && (
              <div style={{
                background: 'rgba(255,170,0,0.12)', border: '1px solid #ffaa00',
                borderRadius: '8px', padding: '10px 12px', marginBottom: '16px',
                fontSize: '12px', color: '#ffcc44'
              }}>⚠️ {hrWarning}</div>
            )}

            {/* Distance + Calories */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Distance km (optional)</label>
                <input type="number" step="0.1" value={distance}
                  onChange={e => setDistance(e.target.value)} placeholder="e.g. 3.5"
                  style={{ ...inp(false), textAlign: 'center' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Calories (optional)</label>
                <input type="number" value={calories}
                  onChange={e => setCalories(e.target.value)} placeholder="kcal"
                  style={{ ...inp(false), textAlign: 'center' }} />
              </div>
            </div>

            {/* Symptoms */}
            <div style={{ marginBottom: '16px' }}>
              <label style={lbl}>Symptoms during exercise (optional)</label>
              <input type="text" value={symptoms}
                onChange={e => setSymptoms(e.target.value)}
                placeholder="e.g. None, mild breathlessness, chest tightness..."
                style={inp(false)} />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={lbl}>Notes (optional)</label>
              <input type="text" value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Morning walk, felt good, hilly route..."
                style={inp(false)} />
            </div>

            {error && <p style={{ color: '#ff4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

            <button onClick={handleSave} disabled={!canSave || saving}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px',
                cursor: canSave && !saving ? 'pointer' : 'not-allowed',
                fontSize: '15px', fontWeight: '600', border: 'none',
                background: canSave ? 'var(--accent, #00cc88)' : 'var(--border, #333)',
                color: canSave ? '#000' : 'var(--text-secondary, #888)',
                opacity: saving ? 0.7 : 1
              }}>
              {saving ? 'Saving…' : 'Log Exercise Session'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
