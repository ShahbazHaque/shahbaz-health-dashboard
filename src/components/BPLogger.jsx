import React, { useState } from 'react';
import { X, Activity, AlertTriangle } from 'lucide-react';

export default function BPLogger({ supabase, onClose, onSaved }) {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [position, setPosition] = useState('sitting');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const sysVal = parseInt(systolic);
  const diaVal = parseInt(diastolic);
  const hrVal = parseInt(heartRate);

  // Validation
  const isValidSys = systolic === '' || (sysVal >= 70 && sysVal <= 250);
  const isValidDia = diastolic === '' || (diaVal >= 40 && diaVal <= 150);
  const isValidHR = heartRate === '' || (hrVal >= 30 && hrVal <= 220);
  const canSave = systolic && diastolic && isValidSys && isValidDia && isValidHR;

  // Alerts
  const isCriticalHigh = sysVal > 180 || diaVal > 110;
  const isCriticalLow = sysVal > 0 && sysVal < 90;
  const isElevated = sysVal > 130 || diaVal > 80;

  // BP category
  const getBPCategory = () => {
    if (!systolic || !diastolic) return null;
    if (isCriticalHigh) return { label: 'Hypertensive Crisis', color: '#ff4444' };
    if (sysVal >= 140 || diaVal >= 90) return { label: 'High (Stage 2)', color: '#ff6b35' };
    if (sysVal >= 130 || diaVal >= 80) return { label: 'Elevated', color: '#ffaa00' };
    if (sysVal >= 120) return { label: 'Above Target', color: '#ffd700' };
    if (sysVal < 90) return { label: 'Low — Monitor', color: '#4488ff' };
    return { label: 'On Target ✓', color: '#00cc88' };
  };

  const category = getBPCategory();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');

    const now = new Date().toISOString();

    try {
      // Write systolic
      const { error: sysErr } = await supabase.from('vitals').insert({
        recorded_at: now,
        metric_type: 'blood_pressure_systolic',
        value: sysVal,
        unit: 'mmHg',
        source: 'manual_entry',
        notes: `Position: ${position}${notes ? '. ' + notes : ''}`
      });
      if (sysErr) throw sysErr;

      // Write diastolic
      const { error: diaErr } = await supabase.from('vitals').insert({
        recorded_at: now,
        metric_type: 'blood_pressure_diastolic',
        value: diaVal,
        unit: 'mmHg',
        source: 'manual_entry',
        notes: `Position: ${position}${notes ? '. ' + notes : ''}`
      });
      if (diaErr) throw diaErr;

      // Write HR if provided
      if (heartRate) {
        const { error: hrErr } = await supabase.from('vitals').insert({
          recorded_at: now,
          metric_type: 'heart_rate',
          value: hrVal,
          unit: 'bpm',
          source: 'manual_entry',
          notes: `With BP reading. Position: ${position}`
        });
        if (hrErr) throw hrErr;
      }

      setSuccess(true);
      if (onSaved) onSaved();
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      console.error('BP save error:', err);
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
        padding: '28px', maxWidth: '420px', width: '100%',
        border: '1px solid var(--border, #333)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={22} color="var(--accent, #00cc88)" />
            <h3 style={{ margin: 0, color: 'var(--text-primary, #fff)' }}>Log Blood Pressure</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={20} color="var(--text-secondary, #888)" />
          </button>
        </div>

        {/* Critical Alert */}
        {isCriticalHigh && (
          <div style={{
            background: 'rgba(255,68,68,0.15)', border: '1px solid #ff4444',
            borderRadius: '10px', padding: '12px', marginBottom: '16px',
            display: 'flex', alignItems: 'flex-start', gap: '10px'
          }}>
            <AlertTriangle size={20} color="#ff4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ color: '#ff6666', fontSize: '13px', lineHeight: '1.4' }}>
              <strong>Hypertensive Crisis.</strong> If you have symptoms (headache, chest pain, vision changes), call <strong>112</strong> (KSA) or <strong>999</strong> (UK) immediately.
            </div>
          </div>
        )}
        {isCriticalLow && (
          <div style={{
            background: 'rgba(68,136,255,0.15)', border: '1px solid #4488ff',
            borderRadius: '10px', padding: '12px', marginBottom: '16px',
            display: 'flex', alignItems: 'flex-start', gap: '10px'
          }}>
            <AlertTriangle size={20} color="#4488ff" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ color: '#88bbff', fontSize: '13px' }}>
              <strong>Low BP detected.</strong> If dizzy or lightheaded, sit down and hydrate. Contact your doctor if persistent.
            </div>
          </div>
        )}

        {success ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
            <p style={{ color: 'var(--accent, #00cc88)', fontWeight: '600', fontSize: '16px' }}>BP Logged Successfully</p>
            <p style={{ color: 'var(--text-secondary, #888)', fontSize: '13px' }}>
              {sysVal}/{diaVal} mmHg{heartRate ? ` • HR ${hrVal} bpm` : ''}
            </p>
          </div>
        ) : (
          <>
            {/* BP Inputs */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary, #888)', marginBottom: '6px', display: 'block' }}>Systolic (top)</label>
                <input type="number" value={systolic} onChange={e => setSystolic(e.target.value)}
                  placeholder="120" min="70" max="250"
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px', fontSize: '20px', fontWeight: '600',
                    textAlign: 'center', background: 'var(--bg-page, #0d0d1a)',
                    border: `1px solid ${!isValidSys ? '#ff4444' : 'var(--border, #333)'}`,
                    color: 'var(--text-primary, #fff)', outline: 'none'
                  }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '12px', fontSize: '24px', color: 'var(--text-secondary, #888)' }}>/</div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary, #888)', marginBottom: '6px', display: 'block' }}>Diastolic (bottom)</label>
                <input type="number" value={diastolic} onChange={e => setDiastolic(e.target.value)}
                  placeholder="80" min="40" max="150"
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px', fontSize: '20px', fontWeight: '600',
                    textAlign: 'center', background: 'var(--bg-page, #0d0d1a)',
                    border: `1px solid ${!isValidDia ? '#ff4444' : 'var(--border, #333)'}`,
                    color: 'var(--text-primary, #fff)', outline: 'none'
                  }} />
              </div>
            </div>

            {/* BP Category Badge */}
            {category && (
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{
                  display: 'inline-block', padding: '4px 14px', borderRadius: '20px',
                  fontSize: '13px', fontWeight: '600',
                  background: `${category.color}22`, color: category.color,
                  border: `1px solid ${category.color}44`
                }}>
                  {category.label} • Target: &lt;130/80
                </span>
              </div>
            )}

            {/* Heart Rate */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary, #888)', marginBottom: '6px', display: 'block' }}>Heart Rate (optional)</label>
              <input type="number" value={heartRate} onChange={e => setHeartRate(e.target.value)}
                placeholder="72 bpm" min="30" max="220"
                style={{
                  width: '100%', padding: '10px', borderRadius: '8px', fontSize: '15px',
                  background: 'var(--bg-page, #0d0d1a)',
                  border: `1px solid ${!isValidHR ? '#ff4444' : 'var(--border, #333)'}`,
                  color: 'var(--text-primary, #fff)', outline: 'none'
                }} />
            </div>

            {/* Position */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary, #888)', marginBottom: '6px', display: 'block' }}>Position</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['sitting', 'standing', 'lying'].map(pos => (
                  <button key={pos} onClick={() => setPosition(pos)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer',
                      fontSize: '13px', textTransform: 'capitalize',
                      background: position === pos ? 'var(--accent, #00cc88)' : 'var(--bg-page, #0d0d1a)',
                      color: position === pos ? '#000' : 'var(--text-secondary, #888)',
                      border: `1px solid ${position === pos ? 'var(--accent, #00cc88)' : 'var(--border, #333)'}`,
                      fontWeight: position === pos ? '600' : '400'
                    }}>
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary, #888)', marginBottom: '6px', display: 'block' }}>Notes (optional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. After exercise, stressed, resting..."
                style={{
                  width: '100%', padding: '10px', borderRadius: '8px', fontSize: '14px',
                  background: 'var(--bg-page, #0d0d1a)', border: '1px solid var(--border, #333)',
                  color: 'var(--text-primary, #fff)', outline: 'none'
                }} />
            </div>

            {error && <p style={{ color: '#ff4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

            {/* Save Button */}
            <button onClick={handleSave} disabled={!canSave || saving}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px', cursor: canSave && !saving ? 'pointer' : 'not-allowed',
                fontSize: '15px', fontWeight: '600', border: 'none',
                background: canSave ? 'var(--accent, #00cc88)' : 'var(--border, #333)',
                color: canSave ? '#000' : 'var(--text-secondary, #888)',
                opacity: saving ? 0.7 : 1
              }}>
              {saving ? 'Saving...' : 'Log BP Reading'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
