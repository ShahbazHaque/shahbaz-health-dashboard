#!/usr/bin/env node

/**
 * Google Health / Fitbit API Sync Script (Node CLI Edition)
 * Based on confidential OAuth authorization code flow.
 * 
 * Usage:
 *   node import-fitbit.mjs --client-id YOUR_ID --client-secret YOUR_SECRET
 */

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import readline from 'readline';
import 'dotenv/config';

// Configuration
const CLIENT_ID = process.env.FITBIT_CLIENT_ID || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ajgeanhsqhzrwtwfrkdu.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqZ2VhbmhzcWh6cnd0d2Zya2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzgwNjMsImV4cCI6MjA4Nzc1NDA2M30.YoVNvwuAsHFu0ncloquZXcAIP-P0El6YvJnAzQhtsoc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function askQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(query, (ans) => { rl.close(); resolve(ans.trim()); }));
}

async function getAccessToken(clientId, clientSecret) {
    const authUrl = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=activity%20heartrate%20sleep%20profile`;

    console.log("\n============================================================");
    console.log("🌐 GOOGLE HEALTH / FITBIT OAUTH AUTHORIZATION");
    console.log("============================================================");
    console.log(`1. Go to this URL in your browser:\n\n   ${authUrl}\n`);
    console.log("2. Authorize the app. You will be redirected to a 'localhost' error page.");
    console.log("3. Copy the code from the URL (everything after code= and before # or &)");

    const authCode = await askQuestion("\nEnter the Authorization Code here: ");
    if (!authCode) {
        console.error("❌ Error: No authorization code entered.");
        return null;
    }

    console.log("\nExchanging Authorization Code for Access Token...");
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://api.fitbit.com/oauth2/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            code: authCode
        }).toString()
    });

    const tokens = await response.json();
    if (tokens.access_token) {
        console.log("\n✅ Authentication Successful!");
        return tokens.access_token;
    } else {
        console.error("\n❌ Error exchanging code:", tokens);
        return null;
    }
}

async function fetchHeartRate(accessToken, date = 'today') {
    const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d.json`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (response.ok) {
        return response.json();
    } else {
        console.error(`❌ Error fetching data: HTTP ${response.status}`);
        return null;
    }
}

async function uploadToSupabase(heartData, dateStr) {
    const vitals = [];
    const restingHR = heartData?.['activities-heart']?.[0]?.value?.restingHeartRate;

    if (restingHR) {
        vitals.push({
            recorded_at: `${dateStr}T12:00:00Z`,
            metric_type: 'resting_heart_rate',
            value: restingHR,
            unit: 'bpm',
            source: 'google_health',
            notes: 'Fitbit REST API'
        });
    }

    const intraday = heartData?.['activities-heart-intraday']?.dataset || [];
    intraday.forEach((sample) => {
        if (sample.time && sample.value) {
            vitals.push({
                recorded_at: `${dateStr}T${sample.time}Z`,
                metric_type: 'heart_rate',
                value: sample.value,
                unit: 'bpm',
                source: 'google_health'
            });
        }
    });

    if (vitals.length > 0) {
        console.log(`\nUploading ${vitals.length} Google Health vitals to Supabase...`);
        const { error } = await supabase.from('vitals').insert(vitals);
        if (error) {
            console.error("❌ Supabase upload failed:", error);
        } else {
            console.log(`✅ Upload Complete! Saved ${vitals.length} records to Supabase database.`);
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    let clientId = CLIENT_ID;
    let clientSecret = CLIENT_SECRET;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--client-id' && args[i + 1]) clientId = args[i + 1];
        if (args[i] === '--client-secret' && args[i + 1]) clientSecret = args[i + 1];
    }

    if (clientId === 'YOUR_CLIENT_ID' || clientSecret === 'YOUR_CLIENT_SECRET') {
        console.log("\n⚠️  Notice: Please provide your Fitbit/Google Client ID & Client Secret:");
        clientId = await askQuestion("Enter Client ID: ");
        clientSecret = await askQuestion("Enter Client Secret: ");
    }

    const token = await getAccessToken(clientId, clientSecret);
    if (!token) return;

    const dateStr = new Date().toISOString().split('T')[0];
    const heartData = await fetchHeartRate(token, dateStr);

    if (heartData) {
        console.log("\n--- Raw JSON Data (Snippet) ---");
        console.log(JSON.stringify(heartData, null, 2).slice(0, 500) + "...\n");

        const intraday = heartData['activities-heart-intraday']?.dataset || [];
        console.log(`Intraday Samples Found: ${intraday.length}`);
        if (intraday.length > 0) {
            console.log("Sample Data (First 5 records):");
            console.table(intraday.slice(0, 5));
        }

        await uploadToSupabase(heartData, dateStr);
    }
}

main().catch(console.error);
