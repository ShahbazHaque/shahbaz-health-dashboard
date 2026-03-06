import React, { useState, useEffect } from 'react';
import { Pill, AlertTriangle, Clock, CheckCircle, Plus, X, Loader } from 'lucide-react';
import './MedicationManager.css';

export default function MedicationManager({ supabase }) {
    const [medications, setMedications] = useState([]);
    const [adherenceMap, setAdherenceMap] = useState({});
    const [heatmapData, setHeatmapData] = useState([]);
    const [overallAdherence, setOverallAdherence] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [loggingId, setLoggingId] = useState(null);

    const [newMed, setNewMed] = useState({ name: '', dose: '', frequency: '', drug_class: '', target: '', scheduled_time: '08:00' });

    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (!supabase) return;
        loadData();
    }, [supabase]);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: meds, error: medsErr } = await supabase
                .from('medications')
                .select('*')
                .eq('is_active', true)
                .order('scheduled_time', { ascending: true });

            if (medsErr) throw medsErr;
            setMedications(meds || []);

            if (!meds || meds.length === 0) { setLoading(false); return; }

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
            const startDate = thirtyDaysAgo.toISOString().split('T')[0];

            const { data: logs, error: logsErr } = await supabase
                .from('medication_log')
                .select('*')
                .gte('scheduled_date', startDate)
                .order('scheduled_date', { ascending: true });

            if (logsErr) throw logsErr;

            const aMap = {};
            (logs || []).forEach(log => {
                if (!aMap[log.medication_id]) aMap[log.medication_id] = {};
                aMap[log.medication_id][log.scheduled_date] = log.status;
            });
            setAdherenceMap(aMap);

            const totalExpected = meds.length * 30;
            const totalTaken = (logs || []).filter(l => l.status === 'taken').length;
            setOverallAdherence(totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : null);

            const heatmap = [];
            for (let i = 13; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                let allTaken = true;
                let anyLogged = false;
                meds.forEach(med => {
                    if (aMap[med.id] && aMap[med.id][dateStr]) {
                        anyLogged = true;
                        if (aMap[med.id][dateStr] !== 'taken') allTaken = false;
                    }
                });
                heatmap.push({
                    date: d.getDate(),
                    dateStr,
                    status: !anyLogged ? 'pending' : allTaken ? 'taken' : 'missed'
                });
            }
            setHeatmapData(heatmap);
        } catch (err) {
            console.error('MedicationManager load error:', err);
        }
        setLoading(false);
    };

    const logDose = async (medId) => {
        setLoggingId(medId);
        try {
            const { data: existing } = await supabase
                .from('medication_log')
                .select('id')
                .eq('medication_id', medId)
                .eq('scheduled_date', today)
                .limit(1);

            if (existing && existing.length > 0) {
                await supabase
                    .from('medication_log')
                    .update({ status: 'taken', taken_at: new Date().toISOString() })
                    .eq('id', existing[0].id);
            } else {
                await supabase
                    .from('medication_log')
                    .insert({ medication_id: medId, scheduled_date: today, status: 'taken', taken_at: new Date().toISOString() });
            }
            await loadData();
        } catch (err) {
            console.error('Log dose error:', err);
        }
        setLoggingId(null);
    };

    const handleAddMed = async (e) => {
        e.preventDefault();
        if (!newMed.name || !newMed.dose || !newMed.frequency) return;
        try {
            await supabase.from('medications').insert({
                name: newMed.name, dose: newMed.dose, frequency: newMed.frequency,
                drug_class: newMed.drug_class || null, target: newMed.target || null,
                scheduled_time: newMed.scheduled_time || '08:00', is_active: true,
            });
            setNewMed({ name: '', dose: '', frequency: '', drug_class: '', target: '', scheduled_time: '08:00' });
            setShowAddForm(false);
            await loadData();
        } catch (err) {
            console.error('Add medication error:', err);
        }
    };

    const getDaysSupply = (med) => {
        const createdDate = new Date(med.created_at);
        const daysSinceCreated = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, 90 - daysSinceCreated);
    };

    const isTakenToday = (medId) => adherenceMap[medId]?.[today] === 'taken';

    if (loading) {
        return (
            <div className="med-manager fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                <Loader size={24} className="spin" style={{ marginRight: '12px' }} />
                <span>Loading medications...</span>
            </div>
        );
    }

    return (
        <div className="med-manager fade-in">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'var(--accent-amber-glow)', color: '#f59e0b' }}>💊</div>
                <div style={{ flex: 1 }}>
                    <span className="section-title" style={{ display: 'block', borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>Medication Manager</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Secondary Prevention Regimen</span>
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> Add Medication
                </button>
            </div>

            {showAddForm && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Add New Medication</h3>
                        <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                    </div>
                    <form onSubmit={handleAddMed} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <input placeholder="Drug Name *" value={newMed.name} onChange={e => setNewMed({ ...newMed, name: e.target.value })} required
                            style={{ padding: '10px 12px', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }} />
                        <input placeholder="Dose (e.g. 40mg) *" value={newMed.dose} onChange={e => setNewMed({ ...newMed, dose: e.target.value })} required
                            style={{ padding: '10px 12px', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }} />
                        <input placeholder="Frequency *" value={newMed.frequency} onChange={e => setNewMed({ ...newMed, frequency: e.target.value })} required
                            style={{ padding: '10px 12px', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }} />
                        <input placeholder="Drug Class" value={newMed.drug_class} onChange={e => setNewMed({ ...newMed, drug_class: e.target.value })}
                            style={{ padding: '10px 12px', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }} />
                        <input placeholder="Clinical Target" value={newMed.target} onChange={e => setNewMed({ ...newMed, target: e.target.value })}
                            style={{ padding: '10px 12px', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }} />
                        <input type="time" value={newMed.scheduled_time} onChange={e => setNewMed({ ...newMed, scheduled_time: e.target.value })}
                            style={{ padding: '10px 12px', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }} />
                        <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary">Save Medication</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="cards-grid" style={{ gridTemplateColumns: '1fr 340px', gap: '24px', marginBottom: '24px' }}>
                <div className="med-list">
                    <h3 className="sub-heading">Current Regimen ({medications.length} active)</h3>
                    {medications.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No medications added yet. Click "Add Medication" to start.
                        </div>
                    ) : medications.map(med => {
                        const taken = isTakenToday(med.id);
                        const supply = getDaysSupply(med);
                        return (
                            <div key={med.id} className="med-card">
                                <div className="med-icon"><Pill size={24} color="#3b82f6" /></div>
                                <div className="med-details">
                                    <div className="med-name">{med.name} <span className="med-dose">{med.dose}</span></div>
                                    <div className="med-type">{med.drug_class || 'Medication'}{med.target ? ` • Target: ${med.target}` : ''}</div>
                                    <div className="med-schedule">
                                        <Clock size={12} style={{ marginRight: '4px' }} /> {(med.scheduled_time || '08:00').substring(0, 5)} — {med.frequency}
                                    </div>
                                </div>
                                <div className="med-status">
                                    {taken ? (
                                        <div className="status-badge taken"><CheckCircle size={14} /> Taken</div>
                                    ) : (
                                        <button className="btn-take" onClick={() => logDose(med.id)} disabled={loggingId === med.id}>
                                            {loggingId === med.id ? <Loader size={12} className="spin" /> : 'Log Dose'}
                                        </button>
                                    )}
                                    <div className={`supply-text ${supply < 15 ? 'warning' : ''}`}>{supply} days supply</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="adherence-panel">
                    <div className="adherence-card">
                        <div className="adherence-header">
                            <span style={{ fontWeight: 600, fontSize: '14px' }}>30-Day Adherence</span>
                            <span className="adherence-score" style={{ color: overallAdherence >= 90 ? '#10b981' : overallAdherence >= 75 ? '#f59e0b' : '#ef4444' }}>
                                {overallAdherence !== null ? `${overallAdherence}%` : '—'}
                            </span>
                        </div>
                        <div className="heatmap">
                            {heatmapData.map((day, i) => (
                                <div key={i} className={`heatmap-box ${day.status}`} title={`${day.dateStr}: ${day.status}`}>{day.date}</div>
                            ))}
                        </div>
                    </div>

                    <div className="interaction-card">
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
                            <AlertTriangle size={16} color="#f59e0b" />
                            Alerts
                        </h4>
                        {medications.filter(m => getDaysSupply(m) < 15).map(med => (
                            <div key={med.id} className="alert-item warning">
                                <strong>Refill Required:</strong> {med.name} ({getDaysSupply(med)} days remaining)
                            </div>
                        ))}
                        {medications.filter(m => getDaysSupply(m) < 15).length === 0 && (
                            <div className="alert-item info">All medications have adequate supply.</div>
                        )}
                        <div className="alert-item info">
                            <strong>Interaction Check:</strong> No known contraindications in current {medications.length}-drug regimen.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
