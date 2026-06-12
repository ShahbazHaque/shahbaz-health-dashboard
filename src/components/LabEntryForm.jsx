import React, { useState } from 'react';
import { X, FlaskConical } from 'lucide-react';

// Metric definitions: label, metric_type (matches lab_results table), unit, target hint, sane range
const METRICS = [
  { label: 'LDL Cholesterol', type: 'ldl_cholesterol', unit: 'mg/dL', target: '< 55 (ASCVD target)', min: 10, max: 400 },
  { label: 'HDL Cholesterol', type: 'hdl_cholesterol', unit: 'mg/dL', target: '> 40', min: 10, max: 150 },
  { label: 'Total Cholesterol', type: 'total_cholesterol', unit: 'mg/dL', target: '< 155', min: 50, max: 500 },
  { label: 'Triglycerides', type: 'triglycerides', unit: 'mg/dL', target: '< 150', min: 20, max: 1500 },
  { label: 'HbA1c', type: 'hba1c', unit: '%', target: '< 5.7', min: 3, max: 16 },
  { label: 'ApoB', type: 'apob', unit: 'mg/dL', target: '< 65', min: 20, max: 300 },
  { label: 'Lp(a)', type: 'lpa', unit: 'nmol/L', target: '< 75', min: 0, max: 600 },
  { label: 'Systolic BP (from lab visit)', type: 'systolic_bp', unit: 'mmHg', target: '< 130', min: 70, max: 250 },
  { label: 'Diastolic BP (from lab visit)', type: 'diastolic_bp', unit: 'mmHg', target: '< 80', min: 40, max: 150 },
];

const inputStyle = (invalid) => ({
  width: '100%', padding: '10px', borderRadius: '8px', fontSize: '15px',
  background: 'var(--bg-page, #0d0d1a)',
  border: `1px solid ${invalid ? '#ff4444' : 'var(--border, #333)'}`,
  color: 'var(--text-primary, #fff)', outline: 'none'
});

const labelStyle = {
  fontSize: '12px', color: 'var(--text-secondary, #888)',
  marginBottom: '6px', display: 'block'
};

export default function LabEntryForm({ supabase, onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0];
  const [testDate, setTestDate] = useState(today);
  const [metricType, setMetricType] = useState(METRICS[0].type);
  const [value, setValue] = useState('');
  const [labName, setLabName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const metric = METRICS.find(m => m.type === metricType);
  const numVal = parseFloat(value);
  const isValidValue = value === '' || (!isNaN(numVal) && numVal >= metric.min && numVal <= metric.max);
  const isValidDate = testDate !== '' && testDate <= today;
  const canSave = value !== '' && isValidValue && isValidDate;

  const handleSave = async (addAnother) => {
    if (!canSave) return;
    setSaving(true);
    setError('');

    const combinedNotes = [labName ? `Lab: ${labName}` : '', notes].filter(Boolean).join('. ') || null;

    try {
      const { error: insErr } = await supabase.from('lab_results').insert({
        test_date: testDate,
        metric_type: metricType,
        value: numVal,
        unit: metric.unit,
        source: 'manual_entry',
        notes: combinedNotes
      });
      if (insErr) throw insErr;

      if (onSaved) onSaved();

      if (addAnother) {
        // Keep date + lab name, clear value/notes, move to next metric for fast multi-entry
        setSavedCount(c => c + 1);
        const idx = METRICS.findIndex(m => m.type === metricType);
        setMetricType(METRICS[(idx + 1) % METRICS.length].type);
        setValue('');
        setNotes('');
      } else {
        setSuccess(true);
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      console.error('Lab result save error:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card, #1a1a2e)', borderRadius: '16px',
        padding: '28px', maxWidth: '440px', width: '100%',
        border: '1px solid var(--border, #333)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        maxHeight: '90vh', overflowY: 'auto'
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FlaskConical size={22} color="var(--accent, #00cc88)" />
            <h3 style={{ margin: 0, color: 'var(--text-primary, #fff)' }}>Add Lab Result</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={20} color="var(--text-secondary, #888)" />
          </button>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
            <p style={{ color: 'var(--accent, #00cc88)', fontWeight: '600', fontSize: '16px' }}>
              {savedCount > 0 ? `${savedCount + 1} Lab Results Saved` : 'Lab Result Saved'}
            </p>
          </div>
        ) : (
          <>
            {savedCount > 0 && (
              <div style={{
                background: 'rgba(0,204,136,0.1)', border: '1px solid rgba(0,204,136,0.3)',
                borderRadius: '8px', padding: '8px 12px', marginBottom: '16px',
                fontSize: '13px', color: 'var(--accent, #00cc88)'
              }}>
                ✓ {savedCount} result{savedCount > 1 ? 's' : ''} saved this session
              </div>
            )}

            {/* Date */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Test Date</label>
              <input type="date" value={testDate} max={today}
                onChange={e => setTestDate(e.target.value)}
                style={inputStyle(!isValidDate)} />
            </div>

            {/* Metric */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Test / Biomarker</label>
              <select value={metricType} onChange={e => { setMetricType(e.target.value); setValue(''); }}
                style={{ ...inputStyle(false), cursor: 'pointer' }}>
                {METRICS.map(m => (
                  <option key={m.type} value={m.type}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Value + Unit */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>Value</label>
                <input type="number" step="any" value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={`${metric.min}–${metric.max}`}
                  style={{ ...inputStyle(!isValidValue), fontSize: '18px', fontWeight: '600', textAlign: 'center' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Unit</label>
                <input type="text" value={metric.unit} readOnly disabled
                  style={{ ...inputStyle(false), textAlign: 'center', opacity: 0.7, cursor: 'default' }} />
              </div>
            </div>

            {/* Target hint */}
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #888)', marginBottom: '16px' }}>
              Target: {metric.target}
              {!isValidValue && value !== '' && (
                <span style={{ color: '#ff4444' }}> — value looks out of range ({metric.min}–{metric.max})</span>
              )}
            </div>

            {/* Lab Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Lab Name (optional)</label>
              <input type="text" value={labName} onChange={e => setLabName(e.target.value)}
                placeholder="e.g. Al Borg, NHS, Bupa..."
                style={inputStyle(false)} />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Notes (optional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Fasting, post-medication change..."
                style={inputStyle(false)} />
            </div>

            {error && <p style={{ color: '#ff4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => handleSave(true)} disabled={!canSave || saving}
                style={{
                  flex: 1, padding: '14px', borderRadius: '10px',
                  cursor: canSave && !saving ? 'pointer' : 'not-allowed',
                  fontSize: '14px', fontWeight: '600',
                  background: 'var(--bg-page, #0d0d1a)',
                  color: canSave ? 'var(--accent, #00cc88)' : 'var(--text-secondary, #888)',
                  border: `1px solid ${canSave ? 'var(--accent, #00cc88)' : 'var(--border, #333)'}`,
                  opacity: saving ? 0.7 : 1
                }}>
                {saving ? 'Saving...' : 'Save + Add Another'}
              </button>
              <button onClick={() => handleSave(false)} disabled={!canSave || saving}
                style={{
                  flex: 1, padding: '14px', borderRadius: '10px',
                  cursor: canSave && !saving ? 'pointer' : 'not-allowed',
                  fontSize: '14px', fontWeight: '600', border: 'none',
                  background: canSave ? 'var(--accent, #00cc88)' : 'var(--border, #333)',
                  color: canSave ? '#000' : 'var(--text-secondary, #888)',
                  opacity: saving ? 0.7 : 1
                }}>
                {saving ? 'Saving...' : 'Save & Close'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
