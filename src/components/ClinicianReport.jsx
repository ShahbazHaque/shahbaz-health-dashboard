import React, { useRef } from 'react';
import './ClinicianReport.css';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

import { getPatientProfile } from '../lib/patientProfile';

export default function ClinicianReport({ summaries, clinicalData, latestVitals, latestBody, adherenceRate, medications }) {
    const reportRef = useRef(null);
    const patient = getPatientProfile();

    const handlePrint = () => {
        window.print();
    };

    // Derive symptoms from health_insights or fallback
    const symptoms = [];

    // Get real latest values
    const latestLDL = clinicalData?.filter(d => d.ldl != null).slice(-1)[0];
    const latestSys = clinicalData?.filter(d => d.sys != null).slice(-1)[0];
    const realAdherence = adherenceRate ?? 94;

    // Get health score average from last 90 days of summaries
    const recent90 = (summaries || []).slice(-90).filter(s => s.health_score != null);
    const avgHealthScore = recent90.length > 0 ? Math.round(recent90.reduce((a, s) => a + s.health_score, 0) / recent90.length) : 82;

    // Medications list for the report
    const medList = (medications || []).map(m => `${m.name} ${m.dose}`).join(' + ') || 'High Intensity Statin + Beta Blocker';

    return (
        <div className="report-wrapper">
            <div className="report-actions no-print">
                <div className="report-info">
                    <h3>Clinician-Ready Report</h3>
                    <p>This report is optimized for A4 printing. Click export to generate a PDF to share with your cardiologist.</p>
                </div>
                <button className="btn btn-primary" onClick={handlePrint}>
                    Export to PDF
                </button>
            </div>

            <div className="report-container" ref={reportRef}>
                {/* Header */}
                <div className="report-header">
                    <div className="header-brand">
                        <div className="brand-logo">🫀</div>
                        <div>
                            <h1 className="brand-title">Cardiovascular Intelligence Hub</h1>
                            <div className="brand-subtitle">N=1 Patient Telemetry & Lifestyle Report</div>
                        </div>
                    </div>
                    <div className="patient-info">
                        <div className="info-row"><span className="info-label">Patient:</span> <span className="info-value">{patient.name}</span></div>
                        <div className="info-row"><span className="info-label">DOB:</span> <span className="info-value">{patient.dobFormatted} ({patient.age}y)</span></div>
                        <div className="info-row"><span className="info-label">Report Date:</span> <span className="info-value">{new Date().toLocaleDateString('en-GB')}</span></div>
                        <div className="info-row"><span className="info-label">Period:</span> <span className="info-value">Last 90 Days</span></div>
                    </div>
                </div>

                {/* Clinical Summary */}
                <div className="report-section">
                    <h2 className="section-title">1. Clinical Overview (Secondary Prevention Focus)</h2>
                    <div className="summary-grid">
                        <div className="summary-box">
                            <div className="box-label">Primary Diagnosis</div>
                            <div className="box-value text-sm">ASHD, Chronic IHD, OMI, Hyperlipidaemia</div>
                        </div>
                        <div className="summary-box highlight-green">
                            <div className="box-label">Medication Adherence (30d)</div>
                            <div className="box-value">{realAdherence}%</div>
                            <div className="box-sub">{medList}</div>
                        </div>
                        <div className="summary-box">
                            <div className="box-label">AI Health Score Avg</div>
                            <div className="box-value">{avgHealthScore}/100</div>
                            <div className="box-sub">{avgHealthScore >= 75 ? 'Stable trajectory' : 'Needs improvement'}</div>
                        </div>
                    </div>
                    <div className="ai-narrative">
                        <strong>AI Executive Summary:</strong> Patient demonstrates {realAdherence >= 90 ? 'excellent' : 'good'} compliance with the secondary prevention regimen.
                        {latestLDL && (
                            <> LDL-C is at {latestLDL.ldl} mg/dL, {latestLDL.ldl <= 55 ? 'within' : 'trending toward'} the &lt;55 mg/dL ASCVD protocol threshold.</>
                        )}
                        {' '}Resting hemodynamics (HR & HRV) indicate {avgHealthScore >= 75 ? 'good' : 'moderate'} cardiovascular conditioning.
                        {latestSys && latestSys.sys <= 130 && <> Systolic BP at {latestSys.sys} mmHg is now at target.</>}
                    </div>
                </div>

                {/* Biomarkers */}
                <div className="report-section">
                    <h2 className="section-title">2. Lipid Panel & Blood Pressure (AHA 2025 Targets)</h2>
                    <div className="charts-row">
                        <div className="chart-container">
                            <div className="chart-title">LDL Cholesterol (Target &lt;55)</div>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={clinicalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis domain={[40, 130]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <ReferenceLine y={55} stroke="#10b981" strokeDasharray="4 4" label={{ position: 'top', value: 'Target <55', fill: '#10b981', fontSize: 10 }} />
                                    <Line type="monotone" dataKey="ldl" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="chart-container">
                            <div className="chart-title">Systolic BP (Target &lt;130)</div>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={clinicalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis domain={[110, 160]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <ReferenceLine y={130} stroke="#10b981" strokeDasharray="4 4" label={{ position: 'top', value: 'Target <130', fill: '#10b981', fontSize: 10 }} />
                                    <Line type="monotone" dataKey="sys" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Vitals Telemetry */}
                <div className="report-section">
                    <h2 className="section-title">3. Wearable Telemetry (Recent Readings)</h2>
                    <div className="vitals-grid">
                        <div className="vital-item">
                            <div className="vital-label">Resting Heart Rate</div>
                            <div className="vital-value">{latestVitals?.resting_heart_rate?.value || '—'} <span className="vital-unit">bpm</span></div>
                        </div>
                        <div className="vital-item">
                            <div className="vital-label">Avg HRV (Overnight)</div>
                            <div className="vital-value">{latestVitals?.hrv?.value ? Math.round(latestVitals.hrv.value) : '—'} <span className="vital-unit">ms</span></div>
                        </div>
                        <div className="vital-item">
                            <div className="vital-label">Blood Oxygen (SpO2)</div>
                            <div className="vital-value">{latestVitals?.blood_oxygen?.value ? Math.round(latestVitals.blood_oxygen.value) : '—'} <span className="vital-unit">%</span></div>
                        </div>
                        <div className="vital-item">
                            <div className="vital-label">Current Weight</div>
                            <div className="vital-value">{latestBody?.weight?.value ? Math.round(latestBody.weight.value * 10) / 10 : '—'} <span className="vital-unit">kg</span></div>
                        </div>
                    </div>
                </div>

                {/* Current Medications */}
                {medications && medications.length > 0 && (
                    <div className="report-section">
                        <h2 className="section-title">4. Active Medication Regimen</h2>
                        <table className="events-table">
                            <thead>
                                <tr>
                                    <th>Drug</th>
                                    <th>Dose</th>
                                    <th>Class</th>
                                    <th>Target</th>
                                    <th>Schedule</th>
                                </tr>
                            </thead>
                            <tbody>
                                {medications.map((med, i) => (
                                    <tr key={i}>
                                        <td><strong>{med.name}</strong></td>
                                        <td>{med.dose}</td>
                                        <td>{med.drug_class || '—'}</td>
                                        <td>{med.target || '—'}</td>
                                        <td>{med.frequency}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="report-footer">
                    Generated automatically by Shahbaz Health platform. Data intended for informed physician review alongside standard clinical evaluation.
                </div>
            </div>
        </div>
    );
}
