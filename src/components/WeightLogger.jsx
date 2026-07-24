import React, { useState } from 'react';
import { X, Scale, AlertCircle, CheckCircle } from 'lucide-react';

export default function WeightLogger({ supabase, onClose, onSaved }) {
    const [weight, setWeight] = useState('');
    const [recordedAt, setRecordedAt] = useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    });
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const weightVal = parseFloat(weight);
        if (isNaN(weightVal) || weightVal <= 30 || weightVal >= 300) {
            setError('Please enter a valid body weight between 30 and 300 kg.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const timestamp = new Date(recordedAt).toISOString();
            const { error: dbError } = await supabase.from('body_composition').insert([
                {
                    metric_type: 'weight',
                    value: Math.round(weightVal * 10) / 10,
                    unit: 'kg',
                    source: 'manual',
                    recorded_at: timestamp,
                    notes: notes.trim() || null,
                }
            ]);

            if (dbError) throw dbError;

            setSuccess(true);
            setTimeout(() => {
                onSaved?.();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('Weight save error:', err);
            setError(err.message || 'Failed to save weight entry.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '440px',
                padding: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', right: '16px', top: '16px',
                        background: 'transparent', border: 'none', color: 'var(--text-muted)',
                        cursor: 'pointer', padding: '4px'
                    }}
                >
                    <X size={20} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '10px',
                        background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Scale size={22} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>Log Body Weight</h3>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Track fluid retention and weight trajectory</p>
                    </div>
                </div>

                {error && (
                    <div style={{
                        padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444',
                        fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'
                    }}>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{
                        padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981',
                        fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'
                    }}>
                        <CheckCircle size={16} />
                        Weight logged successfully!
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            Weight (kg) *
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                step="0.1"
                                placeholder="e.g. 78.5"
                                value={weight}
                                onChange={(e) => setWeight(e.target.value)}
                                required
                                style={{
                                    width: '100%', padding: '12px 14px', borderRadius: '8px',
                                    background: 'var(--bg-page)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600,
                                    outline: 'none'
                                }}
                            />
                            <span style={{ position: 'absolute', right: '14px', top: '12px', color: 'var(--text-muted)', fontSize: '14px' }}>kg</span>
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            Date & Time *
                        </label>
                        <input
                            type="datetime-local"
                            value={recordedAt}
                            onChange={(e) => setRecordedAt(e.target.value)}
                            required
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px',
                                background: 'var(--bg-page)', border: '1px solid var(--border)',
                                color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            Notes (optional)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Morning fasting weight"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px',
                                background: 'var(--bg-page)', border: '1px solid var(--border)',
                                color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '8px',
                                background: 'transparent', border: '1px solid var(--border)',
                                color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || success}
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600 }}
                        >
                            {loading ? 'Saving...' : 'Save Weight'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
