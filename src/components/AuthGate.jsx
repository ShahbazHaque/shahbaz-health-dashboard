/**
 * AuthGate Component
 * Handles authentication for the health dashboard
 * Only allows single-owner access via email magic link
 */

import React, { useState, useEffect } from 'react';
import { Mail, Loader, Heart, Shield, Lock } from 'lucide-react';
import './AuthGate.css';

export default function AuthGate({ supabase, onAuthenticated, children }) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
            if (session) {
                onAuthenticated(session);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                onAuthenticated(session);
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase, onAuthenticated]);

    const handleSignIn = async (e) => {
        e.preventDefault();
        setError('');
        setSending(true);

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email: email.trim(),
                options: {
                    emailRedirectTo: window.location.origin,
                }
            });

            if (error) throw error;

            setSent(true);
        } catch (err) {
            setError(err.message || 'Failed to send magic link');
            console.error('Auth error:', err);
        } finally {
            setSending(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setSent(false);
        setEmail('');
    };

    if (loading) {
        return (
            <div className="auth-loading">
                <Loader className="spin" size={48} />
                <p>Loading...</p>
            </div>
        );
    }

    // User is authenticated - render children
    if (session) {
        return (
            <>
                {children}
                <button className="sign-out-btn" onClick={handleSignOut} title="Sign Out">
                    <Lock size={16} /> Sign Out
                </button>
            </>
        );
    }

    // Not authenticated - show login screen
    return (
        <div className="auth-gate">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-icon">
                        <Heart size={48} />
                    </div>
                    <h1>Dr. Kuzbury</h1>
                    <p className="subtitle">Personal AI Cardiologist</p>
                    <div className="security-badge">
                        <Shield size={16} />
                        <span>Secure Health Dashboard</span>
                    </div>
                </div>

                {!sent ? (
                    <form className="auth-form" onSubmit={handleSignIn}>
                        <p className="auth-instructions">
                            This dashboard is protected. Please sign in with your authorized email address.
                        </p>

                        <div className="form-group">
                            <label htmlFor="email">
                                <Mail size={16} />
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                required
                                disabled={sending}
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="auth-error">
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={sending || !email.trim()} className="sign-in-btn">
                            {sending ? (
                                <>
                                    <Loader className="spin" size={16} />
                                    Sending Magic Link...
                                </>
                            ) : (
                                <>
                                    <Mail size={16} />
                                    Send Magic Link
                                </>
                            )}
                        </button>

                        <p className="auth-note">
                            A secure sign-in link will be sent to your email. No password required.
                        </p>
                    </form>
                ) : (
                    <div className="auth-success">
                        <div className="success-icon">✉️</div>
                        <h2>Check Your Email</h2>
                        <p>
                            We've sent a magic link to <strong>{email}</strong>.
                        </p>
                        <p className="instructions">
                            Click the link in the email to sign in. The link will expire in 60 minutes.
                        </p>
                        <button onClick={() => setSent(false)} className="back-btn">
                            Didn't receive it? Try again
                        </button>
                    </div>
                )}

                <div className="auth-footer">
                    <p>Protected by Supabase Auth</p>
                </div>
            </div>
        </div>
    );
}
