/**
 * Google Health / Fitbit Web API Integration Client Library
 * Handles OAuth 2.0 authorization, token management, intraday metric fetching,
 * and automated database sync to Supabase vitals and daily summaries.
 */

const FITBIT_AUTH_BASE = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
const FITBIT_API_BASE = 'https://api.fitbit.com';

/**
 * Generate Fitbit OAuth 2.0 Authorization URL
 */
export function generateFitbitAuthUrl(clientId, redirectUri = 'http://localhost') {
    const scopes = encodeURIComponent('activity heartrate sleep profile weight cardio_fitness');
    return `${FITBIT_AUTH_BASE}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`;
}

/**
 * Exchange Authorization Code for Access & Refresh Tokens
 */
export async function exchangeAuthCodeForTokens({ clientId, clientSecret, redirectUri = 'http://localhost', authCode }) {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const headers = {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: authCode
    });

    const response = await fetch(FITBIT_TOKEN_URL, {
        method: 'POST',
        headers,
        body: body.toString()
    });

    const data = await response.json();
    if (!response.ok || data.errors) {
        throw new Error(data.errors?.[0]?.message || 'OAuth token exchange failed.');
    }

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        userId: data.user_id
    };
}

/**
 * Refresh expired access token using Refresh Token
 */
export async function refreshFitbitToken({ clientId, clientSecret, refreshToken }) {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const headers = {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    const response = await fetch(FITBIT_TOKEN_URL, {
        method: 'POST',
        headers,
        body: body.toString()
    });

    const data = await response.json();
    if (!response.ok || data.errors) {
        throw new Error(data.errors?.[0]?.message || 'Token refresh failed.');
    }

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in
    };
}

/**
 * Fetch Intraday Heart Rate Data from Fitbit API
 */
export async function fetchFitbitHeartRate(accessToken, date = 'today') {
    const url = `${FITBIT_API_BASE}/1/user/-/activities/heart/date/${date}/1d.json`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error(`Heart Rate API returned HTTP ${response.status}`);
    return response.json();
}

/**
 * Fetch HRV (SDNN) Data from Fitbit API
 */
export async function fetchFitbitHRV(accessToken, date = 'today') {
    const url = `${FITBIT_API_BASE}/1/user/-/hrv/date/${date}.json`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error(`HRV API returned HTTP ${response.status}`);
    return response.json();
}

/**
 * Fetch Steps Data from Fitbit API
 */
export async function fetchFitbitSteps(accessToken, date = 'today') {
    const url = `${FITBIT_API_BASE}/1/user/-/activities/steps/date/${date}/1d.json`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error(`Steps API returned HTTP ${response.status}`);
    return response.json();
}

/**
 * Parse Fitbit JSON responses into standard vitals schema and upload to Supabase
 */
export async function syncGoogleHealthToSupabase({ accessToken, supabase, date = 'today', onProgress }) {
    const vitalsToInsert = [];
    const dateStr = date === 'today' ? new Date().toISOString().split('T')[0] : date;

    if (onProgress) onProgress(15, 'Fetching Google Health / Fitbit Heart Rate data...');
    try {
        const heartData = await fetchFitbitHeartRate(accessToken, dateStr);

        // Parse resting heart rate summary
        const restingHR = heartData?.['activities-heart']?.[0]?.value?.restingHeartRate;
        if (restingHR) {
            vitalsToInsert.push({
                recorded_at: `${dateStr}T12:00:00Z`,
                metric_type: 'resting_heart_rate',
                value: restingHR,
                unit: 'bpm',
                source: 'google_health',
                notes: 'Google Health / Fitbit REST API'
            });
        }

        // Parse intraday heart rate dataset
        const intraday = heartData?.['activities-heart-intraday']?.dataset || [];
        intraday.forEach((sample) => {
            if (sample.time && sample.value) {
                vitalsToInsert.push({
                    recorded_at: `${dateStr}T${sample.time}Z`,
                    metric_type: 'heart_rate',
                    value: sample.value,
                    unit: 'bpm',
                    source: 'google_health'
                });
            }
        });
    } catch (err) {
        console.warn('Heart rate fetch notice:', err.message);
    }

    if (onProgress) onProgress(40, 'Fetching Google Health HRV & Recovery metrics...');
    try {
        const hrvData = await fetchFitbitHRV(accessToken, dateStr);
        const hrvValue = hrvData?.hrv?.[0]?.value?.dailyRmssd || hrvData?.hrv?.[0]?.value?.deepRmssd;
        if (hrvValue) {
            vitalsToInsert.push({
                recorded_at: `${dateStr}T08:00:00Z`,
                metric_type: 'hrv',
                value: Math.round(hrvValue * 10) / 10,
                unit: 'ms',
                source: 'google_health',
                notes: 'Google Health / Fitbit HRV'
            });
        }
    } catch (err) {
        console.warn('HRV fetch notice:', err.message);
    }

    if (onProgress) onProgress(65, 'Fetching Activity & Daily Step Count...');
    try {
        const stepsData = await fetchFitbitSteps(accessToken, dateStr);
        const totalSteps = stepsData?.['activities-steps']?.[0]?.value;
        if (totalSteps) {
            vitalsToInsert.push({
                recorded_at: `${dateStr}T23:59:00Z`,
                metric_type: 'steps',
                value: parseInt(totalSteps, 10),
                unit: 'count',
                source: 'google_health'
            });
        }
    } catch (err) {
        console.warn('Steps fetch notice:', err.message);
    }

    if (vitalsToInsert.length === 0) {
        return { count: 0, message: 'No new metrics returned from API for date ' + dateStr };
    }

    if (onProgress) onProgress(85, `Uploading ${vitalsToInsert.length} metrics to Supabase database...`);

    // Batch insert into Supabase
    const BATCH_SIZE = 300;
    for (let i = 0; i < vitalsToInsert.length; i += BATCH_SIZE) {
        const batch = vitalsToInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('vitals').insert(batch);
        if (error) {
            console.error('Supabase batch insert error:', error);
            throw new Error(`Failed to store Google Health metrics in Supabase: ${error.message}`);
        }
    }

    if (onProgress) onProgress(100, 'Google Health API Sync Complete!');

    return {
        count: vitalsToInsert.length,
        date: dateStr
    };
}
