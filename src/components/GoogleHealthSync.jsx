import React, { useState, useEffect } from 'react';
import { X, Globe, Key, ShieldCheck, RefreshCw, CheckCircle, AlertCircle, ExternalLink, Activity } from 'lucide-react';
import { generateFitbitAuthUrl, exchangeAuthCodeForTokens, syncGoogleHealthToSupabase } from '../lib/fitbit';

export default function GoogleHealthSync({ supabase, onClose, onSynced }) {
    const [clientId, setClientId] = useState(() => localStorage.getItem('fitbit_client_id') || '');
    const [clientSecret, setClientSecret] = useState(() => localStorage.getItem('fitbit_client_secret') || '');
    const [authCode, setAuthCode] = useState('');
    const [tokens, setTokens] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('fitbit_tokens')) || null;
        } catch (e) {
            return null;
        }
    });

    const [status, setStatus] = useState('idle'); // idle | authenticating | syncing | success | error
    const [progressPct, setProgressPct] = useState(0);
    const [statusMsg, setStatusMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleOpenAuthUrl = () => {
        if (!clientId.trim()) {
            setErrorMsg('Please enter your Client ID from dev.fitbit.com');
            return;
        }
        localStorage.setItem('fitbit_client_id', clientId.trim());
        if (clientSecret.trim()) localStorage.setItem('fitbit_client_secret', clientSecret.trim());

        const authUrl = generateFitbitAuthUrl(clientId.trim());
        window.open(authUrl, '_blank');
    };

    const handleExchangeCode = async (e) => {
        e.preventDefault();
        if (!clientId.trim() || !clientSecret.trim() || !authCode.trim()) {
            setErrorMsg('Please enter Client ID, Client Secret, and Authorization Code.');
            return;
        }

        setStatus('authenticating');
        setErrorMsg('');
        setStatusMsg('Exchanging authorization code for API tokens...');

        try {
            const tokenResult = await exchangeAuthCodeForTokens({
                clientId: clientId.trim(),
                clientSecret: clientSecret.trim(),
                authCode: authCode.trim()
            });

            localStorage.setItem('fitbit_client_id', clientId.trim());
            localStorage.setItem('fitbit_client_secret', clientSecret.trim());
            localStorage.setItem('fitbit_tokens', JSON.stringify(tokenResult));

            setTokens(tokenResult);
            setStatus('idle');
            setStatusMsg('✅ Connected to Google Health API successfully!');
        } catch (err) {
            console.error('Exchange token error:', err);
            setStatus('error');
            setErrorMsg(err.message || 'Token exchange failed.');
        }
    };

    const handleSyncData = async () => {
        if (!tokens?.accessToken) {
            setErrorMsg('Please authorize with Google Health / Fitbit first.');
            return;
        }

        setStatus('syncing');
        setErrorMsg('');
        setProgressPct(10);
        setStatusMsg('Initializing Google Health API sync...');

        try {
            const result = await syncGoogleHealthToSupabase({
                accessToken: tokens.accessToken,
                supabase,
                date: 'today',
                onProgress: (pct, msg) => {
                    setProgressPct(pct);
                    setStatusMsg(msg);
                }
            });

            setStatus('success');
            setStatusMsg(`✅ Sync complete! Inserted ${result.count} health metrics for ${result.date}.`);
            setTimeout(() => {
                onSynced?.();
            }, 1500);
        } catch (err) {
            console.error('Google Health sync error:', err);
            setStatus('error');
            setErrorMsg(err.message || 'Google Health API sync failed.');
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)', position: 'relative'
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
                        width: '44px', height: '44px', borderRadius: '12px',
                        background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Globe size={24} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>Google Health / Fitbit API Sync</h3>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Automated intraday Heart Rate, HRV, & Activity Sync</p>
                    </div>
                </div>

                {errorMsg && (
                    <div style={{
                        padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444',
                        fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'
                    }}>
                        <AlertCircle size={16} />
                        {errorMsg}
                    </div>
                )}

                {tokens ? (
                    <div>
                        <div style={{
                            padding: '14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981',
                            fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'
                        }}>
                            <ShieldCheck size={20} />
                            <div>
                                <strong>Google Health API Connected</strong>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    Token active (User ID: {tokens.userId || 'Linked'})
                                </div>
                            </div>
                        </div>

                        {status === 'syncing' && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    <span>{statusMsg}</span>
                                    <span>{progressPct}%</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'var(--bg-page)', overflow: 'hidden' }}>
                                    <div style={{ width: `${progressPct}%`, height: '100%', background: '#06b6d4', transition: 'width 0.3s' }} />
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => { localStorage.removeItem('fitbit_tokens'); setTokens(null); }}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '8px',
                                    background: 'transparent', border: '1px solid var(--border)',
                                    color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600
                                }}
                            >
                                Re-Authorize
                            </button>
                            <button
                                onClick={handleSyncData}
                                disabled={status === 'syncing'}
                                className="btn btn-primary"
                                style={{ flex: 2, padding: '12px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                <RefreshCw size={16} className={status === 'syncing' ? 'spin' : ''} />
                                {status === 'syncing' ? 'Syncing Data...' : "Sync Today's Data"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleExchangeCode}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                            Enter your confidential <strong>Client ID</strong> & <strong>Client Secret</strong> from <a href="https://dev.fitbit.com" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>dev.fitbit.com</a>:
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Client ID</label>
                            <input
                                type="text"
                                placeholder="YOUR_CLIENT_ID"
                                value={clientId}
                                onChange={(e) => setClientId(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-page)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Client Secret</label>
                            <input
                                type="password"
                                placeholder="YOUR_CLIENT_SECRET"
                                value={clientSecret}
                                onChange={(e) => setClientSecret(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-page)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                            <button
                                type="button"
                                onClick={handleOpenAuthUrl}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '8px',
                                    background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.3)',
                                    color: '#06b6d4', cursor: 'pointer', fontWeight: 600, fontSize: '12px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                }}
                            >
                                1. Authorize App <ExternalLink size={14} />
                            </button>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Authorization Code (from redirect URL)</label>
                            <input
                                type="text"
                                placeholder="Paste code here..."
                                value={authCode}
                                onChange={(e) => setAuthCode(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-page)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={status === 'authenticating'}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', fontWeight: 600 }}
                        >
                            {status === 'authenticating' ? 'Connecting...' : '2. Connect & Save Tokens'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
