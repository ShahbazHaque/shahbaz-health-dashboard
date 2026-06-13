import React, { useState, useRef, useCallback } from 'react';
import { Upload, Camera, FileText, Heart, Activity, Loader, CheckCircle, AlertTriangle, X, Pill, Clipboard, Zap, Smartphone } from 'lucide-react';
import { fileToBase64, scanMedicineLabel, scanLabResults, scanECGReport } from '../lib/gemini';
import JSZip from 'jszip';
import './DataCapture.css';

// ─── Apple Health metric map (duplicated from App.jsx for self-containment) ───
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
    'HKQuantityTypeIdentifierStepCount': { table: 'vitals', type: 'steps', unit: 'count' },
    'HKQuantityTypeIdentifierActiveEnergyBurned': { table: 'vitals', type: 'active_calories', unit: 'kcal' },
};

const SCAN_TYPES = [
    { id: 'medicine', icon: '💊', title: 'Scan Medicine Label', desc: 'Snap a photo of your medicine box, bottle, or prescription label', badge: 'AI Vision', badgeClass: 'ai' },
    { id: 'lab', icon: '📋', title: 'Scan Lab Results', desc: 'Upload blood work, lipid panel, or any lab report photo/screenshot', badge: 'AI Vision', badgeClass: 'ai' },
    { id: 'ecg', icon: '📊', title: 'Scan ECG Report', desc: 'Upload ECG printout or cardiology report image', badge: 'AI Vision', badgeClass: 'ai' },
    { id: 'apple_health', icon: '📱', title: 'Upload Apple Health', desc: 'Import your latest vitals from iPhone Health app export (.zip)', badge: 'Import', badgeClass: '' },
    { id: 'bp', icon: '🩺', title: 'Quick BP Entry', desc: 'Log a blood pressure reading in under 30 seconds', badge: 'Manual', badgeClass: 'manual' },
];

export default function DataCapture({ supabase, onDataAdded }) {
    const [activeModal, setActiveModal] = useState(null); // 'medicine'|'lab'|'ecg'|'apple_health'|'bp'
    const [mode, setMode] = useState('idle'); // 'idle'|'uploading'|'processing'|'review'|'saving'|'success'|'error'
    const [extractedData, setExtractedData] = useState(null);
    const [editData, setEditData] = useState({});
    const [previewUrl, setPreviewUrl] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [dragging, setDragging] = useState(false);

    // Apple Health state
    const [ahProgress, setAhProgress] = useState(0);
    const [ahStatus, setAhStatus] = useState('idle');
    const [ahStats, setAhStats] = useState(null);

    // BP state
    const [bpData, setBpData] = useState({ systolic: '', diastolic: '', hr: '', position: 'sitting', notes: '' });

    const fileInputRef = useRef(null);

    // ─── Helpers ───
    const resetModal = () => {
        setActiveModal(null);
        setMode('idle');
        setExtractedData(null);
        setEditData({});
        setPreviewUrl(null);
        setErrorMsg('');
        setDragging(false);
        setAhProgress(0);
        setAhStatus('idle');
        setAhStats(null);
        setBpData({ systolic: '', diastolic: '', hr: '', position: 'sitting', notes: '' });
    };

    const confidenceLevel = (c) => c >= 0.85 ? 'high' : c >= 0.6 ? 'medium' : 'low';
    const confidenceLabel = (c) => `${Math.round(c * 100)}% confidence`;

    const formatMetricName = (type) => type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // ─── Photo scan handler ───
    const handlePhotoFile = async (file) => {
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setMode('error');
            setErrorMsg('Only JPEG, PNG, or WebP images are supported.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setMode('error');
            setErrorMsg('Image is too large (max 10MB). Try a smaller photo.');
            return;
        }

        // Show preview
        setPreviewUrl(URL.createObjectURL(file));
        setMode('processing');

        try {
            const base64 = await fileToBase64(file);
            let result;

            if (activeModal === 'medicine') {
                result = await scanMedicineLabel(base64, file.type);
                setEditData({
                    drug_name: result.drug_name || '',
                    dose: result.dose || '',
                    frequency: result.frequency || 'Once daily',
                    drug_class: result.drug_class || '',
                    route: result.route || 'oral',
                    target: result.target || '',
                    notes: '',
                });
            } else if (activeModal === 'lab') {
                result = await scanLabResults(base64, file.type);
                setEditData({
                    test_date: result.test_date || new Date().toISOString().split('T')[0],
                    lab_name: result.lab_name || '',
                    results: result.results || [],
                    notes: '',
                });
            } else if (activeModal === 'ecg') {
                result = await scanECGReport(base64, file.type);
                setEditData({
                    interpretation: result.interpretation || '',
                    heart_rate: result.heart_rate || '',
                    qtc_interval: result.qtc_interval || '',
                    axis_degrees: result.axis_degrees || '',
                    rhythm: result.rhythm || '',
                    abnormalities: (result.abnormalities || []).join(', '),
                    recommendations: result.recommendations || '',
                    test_datetime: result.test_datetime || new Date().toISOString().slice(0, 16),
                    notes: '',
                });
            }

            setExtractedData(result);

            if (result.confidence && result.confidence < 0.5) {
                setMode('error');
                setErrorMsg(`Image quality too low to extract reliably. ${result.extraction_notes || 'Try a clearer photo.'}`);
            } else {
                setMode('review');
            }
        } catch (err) {
            console.error('Scan error:', err);
            setMode('error');
            setErrorMsg('Failed to process image. Please try again or use manual entry.');
        }
    };

    // ─── Save handlers ───
    const saveMedicine = async () => {
        setMode('saving');
        try {
            const { error } = await supabase.from('medications').insert({
                name: editData.drug_name,
                dose: editData.dose,
                frequency: editData.frequency,
                drug_class: editData.drug_class || null,
                target: editData.target || null,
                scheduled_time: '08:00',
                is_active: true,
            });
            if (error) throw error;
            setMode('success');
            onDataAdded?.();
            setTimeout(resetModal, 2000);
        } catch (err) {
            console.error('Save error:', err);
            setMode('error');
            setErrorMsg(`Save failed: ${err.message}`);
        }
    };

    const saveLabResults = async () => {
        setMode('saving');
        try {
            const rows = (editData.results || []).map(r => ({
                test_date: editData.test_date,
                metric_type: r.metric_type,
                value: Number(r.value),
                unit: r.unit || 'mg/dL',
                lab_name: editData.lab_name || null,
                notes: editData.notes || null,
            }));
            const { error } = await supabase.from('lab_results').insert(rows);
            if (error) throw error;
            setMode('success');
            onDataAdded?.();
            setTimeout(resetModal, 2000);
        } catch (err) {
            console.error('Save error:', err);
            setMode('error');
            setErrorMsg(`Save failed: ${err.message}`);
        }
    };

    const saveECG = async () => {
        setMode('saving');
        try {
            const { error } = await supabase.from('ecg_results').insert({
                test_datetime: editData.test_datetime || new Date().toISOString(),
                interpretation: editData.interpretation,
                heart_rate: editData.heart_rate ? Number(editData.heart_rate) : null,
                qtc_interval: editData.qtc_interval ? Number(editData.qtc_interval) : null,
                axis_degrees: editData.axis_degrees ? Number(editData.axis_degrees) : null,
                abnormalities: editData.abnormalities ? editData.abnormalities.split(',').map(s => s.trim()).filter(Boolean) : [],
                recommendations: editData.recommendations || null,
                source: 'gemini_vision',
                extraction_confidence: extractedData?.confidence || null,
                raw_extraction: extractedData,
                notes: editData.notes || null,
            });
            if (error) throw error;
            setMode('success');
            onDataAdded?.();
            setTimeout(resetModal, 2000);
        } catch (err) {
            console.error('Save error:', err);
            setMode('error');
            setErrorMsg(`Save failed: ${err.message}`);
        }
    };

    const saveBP = async () => {
        const sys = Number(bpData.systolic);
        const dia = Number(bpData.diastolic);
        if (!sys || !dia || sys < 70 || sys > 250 || dia < 40 || dia > 150) {
            setMode('error');
            setErrorMsg('Please enter valid BP values (Systolic 70-250, Diastolic 40-150).');
            return;
        }
        setMode('saving');
        try {
            const now = new Date().toISOString();
            const { error: e1 } = await supabase.from('vitals').insert({
                recorded_at: now, metric_type: 'blood_pressure_systolic', value: sys, unit: 'mmHg', source: 'manual'
            });
            const { error: e2 } = await supabase.from('vitals').insert({
                recorded_at: now, metric_type: 'blood_pressure_diastolic', value: dia, unit: 'mmHg', source: 'manual'
            });
            if (e1 || e2) throw (e1 || e2);
            if (bpData.hr) {
                await supabase.from('vitals').insert({
                    recorded_at: now, metric_type: 'heart_rate', value: Number(bpData.hr), unit: 'bpm', source: 'manual'
                });
            }
            setMode('success');
            onDataAdded?.();
            setTimeout(resetModal, 2000);
        } catch (err) {
            console.error('Save error:', err);
            setMode('error');
            setErrorMsg(`Save failed: ${err.message}`);
        }
    };

    // ─── Apple Health upload ───
    const handleAppleHealthFile = async (file) => {
        if (!file) return;

        // Files > 150 MB will crash the browser tab — route to CLI
        const MB = file.size / (1024 * 1024);
        if (MB > 150) {
            setAhStatus('too_large');
            setAhStats({ fileMB: Math.round(MB), fileName: file.name });
            return;
        }

        try {
            setAhStatus('parsing');
            setAhProgress(5);

            let xmlText;
            if (file.name.endsWith('.zip')) {
                const zip = await JSZip.loadAsync(file);
                const xmlFile = Object.keys(zip.files).find(f => f.includes('export.xml'));
                if (!xmlFile) throw new Error('Could not find export.xml in the zip file');
                xmlText = await zip.files[xmlFile].async('string');
            } else {
                xmlText = await file.text();
            }

            setAhProgress(15);

            // Parse XML
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlText, 'text/xml');
            const records = doc.querySelectorAll('Record');

            const vitals = [];
            const bodyComp = [];
            let processed = 0;

            records.forEach((rec) => {
                const type = rec.getAttribute('type');
                const mapping = METRIC_MAP[type];
                if (!mapping) return;

                let val = parseFloat(rec.getAttribute('value'));
                if (isNaN(val)) return;
                if (mapping.type === 'blood_oxygen' && val <= 1) val = val * 100;

                const entry = {
                    recorded_at: rec.getAttribute('startDate'),
                    metric_type: mapping.type,
                    value: val,
                    unit: mapping.unit,
                    source: 'apple_health',
                };

                if (mapping.table === 'vitals') vitals.push(entry);
                else bodyComp.push(entry);

                processed++;
                if (processed % 5000 === 0) {
                    setAhProgress(15 + Math.min(35, Math.round((processed / records.length) * 35)));
                }
            });

            setAhStats({ vitals: vitals.length, bodyComp: bodyComp.length, total: processed });

            if (processed === 0) {
                setAhStatus('error');
                return;
            }

            // Upload
            setAhStatus('uploading');
            const batchSize = 500;
            const totalBatches = Math.ceil(vitals.length / batchSize) + Math.ceil(bodyComp.length / batchSize);
            let completedBatches = 0;

            for (let i = 0; i < vitals.length; i += batchSize) {
                await supabase.from('vitals').insert(vitals.slice(i, i + batchSize));
                completedBatches++;
                setAhProgress(50 + Math.round((completedBatches / totalBatches) * 40));
            }
            for (let i = 0; i < bodyComp.length; i += batchSize) {
                await supabase.from('body_composition').insert(bodyComp.slice(i, i + batchSize));
                completedBatches++;
                setAhProgress(50 + Math.round((completedBatches / totalBatches) * 40));
            }

            setAhStatus('done');
            setAhProgress(100);
            onDataAdded?.();
        } catch (err) {
            console.error('Apple Health upload error:', err);
            setAhStatus('error');
        }
    };

    // ─── Drop/drag handlers ───
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (activeModal === 'apple_health') handleAppleHealthFile(file);
        else handlePhotoFile(file);
    }, [activeModal]);

    const handleConfirmSave = () => {
        if (activeModal === 'medicine') saveMedicine();
        else if (activeModal === 'lab') saveLabResults();
        else if (activeModal === 'ecg') saveECG();
    };

    // ─── Render helpers ───
    const renderDropzone = (accept, hint) => (
        <div
            className={`upload-dropzone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
        >
            <div className="drop-icon">{activeModal === 'apple_health' ? '📱' : '📷'}</div>
            <div className="drop-text">Drop file here or <span className="browse-link">browse</span></div>
            <div className="drop-hint">{hint}</div>
            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files[0];
                    if (activeModal === 'apple_health') handleAppleHealthFile(file);
                    else handlePhotoFile(file);
                    e.target.value = '';
                }}
            />
        </div>
    );

    const renderProcessing = () => (
        <div className="processing-state">
            <Loader size={48} className="spin-icon" style={{ display: 'inline-block' }} />
            <h4>Analyzing with Gemini Vision...</h4>
            <p>Extracting structured data from your image</p>
        </div>
    );

    const renderSuccess = () => (
        <div className="state-message">
            <div className="state-icon">✅</div>
            <h4>Saved successfully!</h4>
            <p>Your data has been added to the dashboard.</p>
        </div>
    );

    const renderError = () => (
        <div className="state-message">
            <div className="state-icon">⚠️</div>
            <h4>Something went wrong</h4>
            <p>{errorMsg}</p>
            <div className="modal-buttons" style={{ justifyContent: 'center', marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => { setMode('idle'); setErrorMsg(''); }}>Try Again</button>
                <button className="btn btn-primary" onClick={resetModal}>Close</button>
            </div>
        </div>
    );

    // ─── Medicine review form ───
    const renderMedicineReview = () => (
        <>
            <div className={`confidence-badge ${confidenceLevel(extractedData?.confidence || 0)}`}>
                🤖 {confidenceLabel(extractedData?.confidence || 0)}
            </div>
            {previewUrl && <div className="image-preview"><img src={previewUrl} alt="Scanned" /></div>}
            <div className="review-form">
                <div className="form-field">
                    <label>Drug Name</label>
                    <input value={editData.drug_name} onChange={e => setEditData({ ...editData, drug_name: e.target.value })} />
                </div>
                <div className="form-row">
                    <div className="form-field">
                        <label>Dose</label>
                        <input value={editData.dose} onChange={e => setEditData({ ...editData, dose: e.target.value })} />
                    </div>
                    <div className="form-field">
                        <label>Frequency</label>
                        <input value={editData.frequency} onChange={e => setEditData({ ...editData, frequency: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-field">
                        <label>Drug Class</label>
                        <input value={editData.drug_class} onChange={e => setEditData({ ...editData, drug_class: e.target.value })} />
                    </div>
                    <div className="form-field">
                        <label>Clinical Target</label>
                        <input value={editData.target} onChange={e => setEditData({ ...editData, target: e.target.value })} placeholder="e.g. LDL <55 mg/dL" />
                    </div>
                </div>
                <div className="form-field">
                    <label>Notes (optional)</label>
                    <textarea value={editData.notes} onChange={e => setEditData({ ...editData, notes: e.target.value })} placeholder="Any additional notes..." />
                </div>
            </div>
        </>
    );

    // ─── Lab results review form ───
    const renderLabReview = () => (
        <>
            <div className={`confidence-badge ${confidenceLevel(extractedData?.confidence || 0)}`}>
                🤖 {confidenceLabel(extractedData?.confidence || 0)}
            </div>
            {previewUrl && <div className="image-preview"><img src={previewUrl} alt="Scanned" /></div>}
            <div className="review-form">
                <div className="form-row">
                    <div className="form-field">
                        <label>Test Date</label>
                        <input type="date" value={editData.test_date} onChange={e => setEditData({ ...editData, test_date: e.target.value })} />
                    </div>
                    <div className="form-field">
                        <label>Lab Name</label>
                        <input value={editData.lab_name} onChange={e => setEditData({ ...editData, lab_name: e.target.value })} />
                    </div>
                </div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Extracted Values ({(editData.results || []).length} found)
                </label>
                {(editData.results || []).map((r, i) => (
                    <div key={i} className="lab-result-item">
                        <span className="metric-name">{formatMetricName(r.metric_type)}</span>
                        <input
                            className="metric-value"
                            value={r.value}
                            onChange={e => {
                                const updated = [...editData.results];
                                updated[i] = { ...updated[i], value: e.target.value };
                                setEditData({ ...editData, results: updated });
                            }}
                            style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '14px', textAlign: 'center' }}
                        />
                        <span className={`metric-flag ${r.flag || 'normal'}`}>{r.flag || 'normal'}</span>
                    </div>
                ))}
                {extractedData?.extraction_notes && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                        AI Note: {extractedData.extraction_notes}
                    </div>
                )}
            </div>
        </>
    );

    // ─── ECG review form ───
    const renderECGReview = () => (
        <>
            <div className={`confidence-badge ${confidenceLevel(extractedData?.confidence || 0)}`}>
                🤖 {confidenceLabel(extractedData?.confidence || 0)}
            </div>
            {previewUrl && <div className="image-preview"><img src={previewUrl} alt="Scanned" /></div>}
            <div className="review-form">
                <div className="form-field">
                    <label>Interpretation</label>
                    <textarea value={editData.interpretation} onChange={e => setEditData({ ...editData, interpretation: e.target.value })} rows={2} />
                </div>
                <div className="form-row">
                    <div className="form-field">
                        <label>Heart Rate (bpm)</label>
                        <input type="number" value={editData.heart_rate} onChange={e => setEditData({ ...editData, heart_rate: e.target.value })} />
                    </div>
                    <div className="form-field">
                        <label>QTc Interval (ms)</label>
                        <input type="number" value={editData.qtc_interval} onChange={e => setEditData({ ...editData, qtc_interval: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-field">
                        <label>Rhythm</label>
                        <input value={editData.rhythm || ''} onChange={e => setEditData({ ...editData, rhythm: e.target.value })} />
                    </div>
                    <div className="form-field">
                        <label>Axis (degrees)</label>
                        <input type="number" value={editData.axis_degrees} onChange={e => setEditData({ ...editData, axis_degrees: e.target.value })} />
                    </div>
                </div>
                <div className="form-field">
                    <label>Abnormalities</label>
                    <input value={editData.abnormalities} onChange={e => setEditData({ ...editData, abnormalities: e.target.value })} placeholder="Comma-separated list" />
                </div>
                <div className="form-field">
                    <label>Date/Time</label>
                    <input type="datetime-local" value={editData.test_datetime} onChange={e => setEditData({ ...editData, test_datetime: e.target.value })} />
                </div>
                <div className="form-field">
                    <label>Recommendations</label>
                    <textarea value={editData.recommendations} onChange={e => setEditData({ ...editData, recommendations: e.target.value })} rows={2} />
                </div>
            </div>
        </>
    );

    // ─── BP Quick Entry form ───
    const renderBPForm = () => (
        <div className="bp-form-grid">
            <div className="form-field">
                <label>Systolic (mmHg) *</label>
                <input type="number" placeholder="120" value={bpData.systolic} onChange={e => setBpData({ ...bpData, systolic: e.target.value })} />
            </div>
            <div className="form-field">
                <label>Diastolic (mmHg) *</label>
                <input type="number" placeholder="80" value={bpData.diastolic} onChange={e => setBpData({ ...bpData, diastolic: e.target.value })} />
            </div>
            <div className="form-field">
                <label>Heart Rate (bpm)</label>
                <input type="number" placeholder="72" value={bpData.hr} onChange={e => setBpData({ ...bpData, hr: e.target.value })} />
            </div>
            <div className="form-field">
                <label>Position</label>
                <select value={bpData.position} onChange={e => setBpData({ ...bpData, position: e.target.value })}>
                    <option value="sitting">Sitting</option>
                    <option value="standing">Standing</option>
                    <option value="lying">Lying down</option>
                </select>
            </div>
            <div className="form-field full-width">
                <label>Notes (optional)</label>
                <input value={bpData.notes} onChange={e => setBpData({ ...bpData, notes: e.target.value })} placeholder="e.g. After morning walk" />
            </div>
            {bpData.systolic && Number(bpData.systolic) > 180 && (
                <div className="full-width" style={{ background: 'rgba(239,68,68,0.15)', padding: '12px 16px', borderRadius: '10px', color: '#ef4444', fontSize: '13px', fontWeight: 500 }}>
                    ⚠️ Systolic &gt;180 mmHg — if you're experiencing symptoms, seek medical attention immediately (112 KSA / 999 UK).
                </div>
            )}
        </div>
    );

    // ─── Apple Health upload UI ───
    const renderAppleHealth = () => {
        if (ahStatus === 'idle') {
            return (
                <>
                    {renderDropzone('.zip,.xml', 'Apple Health export (.zip or .xml) — files under 150 MB only')}
                    <div style={{
                        marginTop: '16px', padding: '14px 16px', borderRadius: '10px',
                        background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.3)',
                        fontSize: '13px', color: 'var(--text-secondary)'
                    }}>
                        <strong style={{ color: '#a78bfa' }}>💡 Full export too large?</strong> Apple Health exports are usually 1–3 GB. Use the terminal script instead:
                        <pre style={{
                            marginTop: '10px', padding: '10px 12px', borderRadius: '8px',
                            background: 'rgba(0,0,0,0.4)', color: '#00cc88', fontSize: '12px',
                            overflowX: 'auto', whiteSpace: 'pre-wrap', userSelect: 'all', cursor: 'text'
                        }}>
{`cd ~/Desktop/Antigravity/shahbaz-health-dashboard
node import-data.mjs ~/Desktop/apple_health_export\\ 2/export.xml`}
                        </pre>
                        <div style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            For incremental re-sync (only new data):{' '}
                            <code style={{ color: '#00cc88' }}>--since 2026-01-01</code>
                        </div>
                    </div>
                </>
            );
        }
        if (ahStatus === 'too_large') {
            return (
                <div style={{ padding: '8px 0' }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <div style={{ fontSize: '36px', marginBottom: '8px' }}>📦</div>
                        <h4 style={{ color: 'var(--text-primary)', margin: '0 0 6px' }}>File too large for browser</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                            <strong>{ahStats?.fileName}</strong> is {ahStats?.fileMB} MB. Apple Health exports must be imported via the terminal script.
                        </p>
                    </div>
                    <div style={{
                        padding: '14px 16px', borderRadius: '10px',
                        background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)',
                    }}>
                        <p style={{ color: '#a78bfa', fontWeight: '600', fontSize: '13px', margin: '0 0 10px' }}>Run this in Terminal:</p>
                        <pre style={{
                            margin: '0 0 12px', padding: '10px 12px', borderRadius: '8px',
                            background: 'rgba(0,0,0,0.5)', color: '#00cc88', fontSize: '12px',
                            overflowX: 'auto', whiteSpace: 'pre-wrap', userSelect: 'all', cursor: 'text'
                        }}>
{`cd ~/Desktop/Antigravity/shahbaz-health-dashboard
node import-data.mjs ~/Desktop/apple_health_export\\ 2/export.xml`}
                        </pre>
                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 6px' }}>
                            Or for incremental sync (only import data since a date — much faster):
                        </p>
                        <pre style={{
                            margin: 0, padding: '10px 12px', borderRadius: '8px',
                            background: 'rgba(0,0,0,0.5)', color: '#00cc88', fontSize: '12px',
                            overflowX: 'auto', whiteSpace: 'pre-wrap', userSelect: 'all', cursor: 'text'
                        }}>
{`node import-data.mjs ~/Desktop/apple_health_export\\ 2/export.xml --since 2026-01-01`}
                        </pre>
                    </div>
                    <button className="btn btn-secondary" style={{ marginTop: '16px', width: '100%' }} onClick={() => setAhStatus('idle')}>← Back</button>
                </div>
            );
        }
        if (ahStatus === 'error') {
            return (
                <div className="state-message">
                    <div className="state-icon">⚠️</div>
                    <h4>Upload failed</h4>
                    <p>Could not process the file. Make sure it's a valid Apple Health export under 150 MB, or use the terminal script for large exports.</p>
                    <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={() => setAhStatus('idle')}>Try Again</button>
                </div>
            );
        }
        if (ahStatus === 'done') {
            return (
                <div className="state-message">
                    <div className="state-icon">✅</div>
                    <h4>Import complete!</h4>
                    <p>{ahStats?.total?.toLocaleString()} health records imported ({ahStats?.vitals?.toLocaleString()} vitals, {ahStats?.bodyComp?.toLocaleString()} body comp)</p>
                </div>
            );
        }
        return (
            <div className="processing-state">
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {ahStatus === 'parsing' ? '🔍 Parsing health data...' : '☁️ Uploading to database...'}
                </div>
                <div style={{ background: 'var(--bg-page)', borderRadius: '8px', height: '8px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ background: '#3b82f6', height: '100%', width: `${ahProgress}%`, transition: 'width 0.3s ease', borderRadius: '8px' }} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ahProgress}% complete</div>
            </div>
        );
    };

    // ─── Modal content router ───
    const renderModalContent = () => {
        if (mode === 'processing') return renderProcessing();
        if (mode === 'success') return renderSuccess();
        if (mode === 'error') return renderError();
        if (mode === 'saving') return (
            <div className="processing-state">
                <Loader size={32} className="spin-icon" style={{ display: 'inline-block' }} />
                <h4>Saving to database...</h4>
            </div>
        );

        if (activeModal === 'bp') {
            return (
                <>
                    {renderBPForm()}
                    <div className="modal-buttons">
                        <button className="btn btn-secondary" onClick={resetModal}>Cancel</button>
                        <button className="btn btn-primary" onClick={saveBP} disabled={!bpData.systolic || !bpData.diastolic}>
                            Save BP Reading
                        </button>
                    </div>
                </>
            );
        }

        if (activeModal === 'apple_health') {
            return renderAppleHealth();
        }

        // Photo scan types
        if (mode === 'idle') {
            return (
                <>
                    {renderDropzone('image/jpeg,image/png,image/webp', 'JPEG, PNG, or WebP — max 10MB')}
                </>
            );
        }

        if (mode === 'review') {
            return (
                <>
                    {activeModal === 'medicine' && renderMedicineReview()}
                    {activeModal === 'lab' && renderLabReview()}
                    {activeModal === 'ecg' && renderECGReview()}
                    <div className="modal-buttons">
                        <button className="btn btn-secondary" onClick={() => { setMode('idle'); setPreviewUrl(null); setExtractedData(null); }}>
                            Rescan
                        </button>
                        <button className="btn btn-primary" onClick={handleConfirmSave}>
                            Confirm & Save
                        </button>
                    </div>
                </>
            );
        }

        return null;
    };

    const getModalTitle = () => {
        const titles = {
            medicine: ['💊', 'Scan Medicine Label', 'Take a photo of your medicine packaging'],
            lab: ['📋', 'Scan Lab Results', 'Upload a photo or screenshot of your lab report'],
            ecg: ['📊', 'Scan ECG Report', 'Upload your ECG printout or report'],
            apple_health: ['📱', 'Upload Apple Health Data', 'Import your latest vitals from iPhone'],
            bp: ['🩺', 'Quick Blood Pressure Entry', 'Log your reading in seconds'],
        };
        return titles[activeModal] || ['', '', ''];
    };

    // ─── MAIN RENDER ───
    return (
        <div className="data-capture">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>➕</div>
                <div style={{ flex: 1 }}>
                    <span className="section-title" style={{ display: 'block', borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>Add Data</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Snap photos, upload exports, or log readings — AI handles the rest</span>
                </div>
            </div>

            {/* Card Grid */}
            <div className="scan-cards-grid">
                {SCAN_TYPES.map(card => (
                    <div key={card.id} className="scan-card" onClick={() => { resetModal(); setActiveModal(card.id); }}>
                        <div className="scan-card-icon">{card.icon}</div>
                        <div className="scan-card-title">{card.title}</div>
                        <div className="scan-card-desc">{card.desc}</div>
                        <div className={`scan-card-badge ${card.badgeClass}`}>{card.badge}</div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {activeModal && (
                <div className="scan-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) resetModal(); }}>
                    <div className="scan-modal">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <h3>{getModalTitle()[0]} {getModalTitle()[1]}</h3>
                            <button onClick={resetModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <p className="subtitle">{getModalTitle()[2]}</p>
                        {renderModalContent()}
                    </div>
                </div>
            )}
        </div>
    );
}
