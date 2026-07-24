/**
 * Patient Profile Manager
 * Manages Shahbaz's profile details (DOB, Age, Diagnoses) dynamically
 * across local storage, Supabase, and AI context.
 */

const DEFAULT_DOB = '1975-12-24'; // Updated patient DOB: 24 Dec 1975

/**
 * Calculate age based on DOB string and current date
 */
export function calculateAge(dobInput) {
    const dob = new Date(dobInput);
    if (isNaN(dob.getTime())) return 50; // default to 50 if unparseable
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
}

/**
 * Parse flexible date strings like '24 dec 1975', '24/12/1975', '1975-12-24' into ISO YYYY-MM-DD
 */
export function parseDateString(str) {
    if (!str) return DEFAULT_DOB;
    const clean = str.trim();

    // Already ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

    // DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        const year = ddmmyyyy[3];
        return `${year}-${month}-${day}`;
    }

    // Standard Date.parse (handles '24 dec 1975', 'December 24, 1975')
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }

    return DEFAULT_DOB;
}

/**
 * Format DOB for clinical display (e.g., '24 Dec 1975')
 */
export function formatDobForDisplay(isoDateStr) {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return '24 Dec 1975';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Get active Patient Profile
 */
export function getPatientProfile() {
    let dobIso = DEFAULT_DOB;
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            dobIso = window.localStorage.getItem('patient_dob') || DEFAULT_DOB;
        }
    } catch (e) {
        dobIso = DEFAULT_DOB;
    }

    const age = calculateAge(dobIso);
    const dobFormatted = formatDobForDisplay(dobIso);

    return {
        name: 'Shahbaz',
        dobISO: dobIso,
        dobFormatted,
        age,
        diagnoses: [
            'Atherosclerotic Heart Disease (ASHD) of native coronary artery',
            'Chronic Ischaemic Heart Disease (IHD)',
            'Old Myocardial Infarction (OMI)',
            'Hyperlipidaemia'
        ],
        clinicalTargets: {
            ldl: '<55 mg/dL',
            bp: '<130/80 mmHg',
            rhr: '55-65 bpm',
            hba1c: '<5.7%'
        }
    };
}

/**
 * Update Patient DOB in LocalStorage & Supabase
 */
export async function updatePatientDob(rawDobInput, supabase = null) {
    const isoDate = parseDateString(rawDobInput);
    const age = calculateAge(isoDate);
    const dobFormatted = formatDobForDisplay(isoDate);

    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('patient_dob', isoDate);
        }
    } catch (e) {
        console.warn('LocalStorage write warning:', e);
    }

    if (supabase) {
        try {
            await supabase.from('patient_profiles').upsert({
                first_name: 'Shahbaz',
                dob: isoDate,
                primary_diagnoses: JSON.stringify(['ASHD', 'IHD', 'OMI', 'Hyperlipidaemia']),
                clinical_targets: JSON.stringify({ ldl_c_max: 55, bp_sys_max: 130, hr_rest_min: 55, hr_rest_max: 65 })
            });
        } catch (err) {
            console.warn('Supabase profile sync notice:', err.message);
        }
    }

    return { isoDate, dobFormatted, age };
}
