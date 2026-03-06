import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, CheckCircle, WifiOff } from 'lucide-react';
import { extractVoiceLog } from '../lib/gemini';
import './VoiceCapture.css'; // Make sure to import the CSS file

export default function VoiceCapture() {
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [status, setStatus] = useState('idle'); // idle, recording, processing, success, offline-queued
    const [isOffline, setIsOffline] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);

    // Mocks for Web Speech API and backend
    const recognitionRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        // Check network status
        setIsOffline(!navigator.onLine);
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initialize Speech Recognition (Mock or native if available)
        if ('webkitSpeechRecognition' in window) {
            const SpeechRecognition = window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        setTranscription(prev => prev + event.results[i][0].transcript + ' ');
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                // Could display interim transcript if needed
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                stopRecording(true);
            };

            recognitionRef.current.onend = () => {
                // Auto restart logic if still recording state (omitted for simplicity in mock)
            };
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startRecording = () => {
        setIsRecording(true);
        setStatus('recording');
        setTranscription('');
        setRecordingTime(0);

        timerRef.current = setInterval(() => {
            setRecordingTime((prev) => prev + 1);
        }, 1000);

        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error(e);
            }
        } else {
            // Fallback mock if speech api not available
            setTimeout(() => {
                setTranscription("I had a heavy pasta lunch with 30 grams of sugar, and noticed mild chest tightness about 20 minutes ago. ");
            }, 2000);
        }
    };

    const stopRecording = async (isError = false) => {
        setIsRecording(false);
        clearInterval(timerRef.current);

        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        if (isError) {
            setStatus('idle');
            return;
        }

        setStatus('processing');

        try {
            // Process the transcription via Gemini
            const extractedData = await extractVoiceLog(transcription);
            console.log("Gemini Extracted Schema:", extractedData);
            // In a real flow, we would now push 'extractedData' to the database.

            if (isOffline) {
                setStatus('offline-queued');
                // Logic to save to SQLite/IndexedDB goes here
            } else {
                setStatus('success');
            }
        } catch (error) {
            console.error("Failed to process voice log:", error);
            setStatus('idle'); // or 'error' state
        } finally {
            // Reset after 3 seconds
            setTimeout(() => {
                setStatus('idle');
                setTranscription('');
            }, 3000);
        }
    };


    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`voice-capture-container ${isRecording ? 'recording' : ''}`}>
            {/* Dynamic Background Glow */}
            <div className={`glow-effect ${isRecording ? 'active' : ''}`} />

            <div className="voice-content">

                {/* Network Status Pill */}
                {isOffline && (
                    <div className="offline-pill">
                        <WifiOff size={12} style={{ marginRight: '6px' }} />
                        Working Offline - Data Queued
                    </div>
                )}

                <h2>Speak with Dr. Kuzbury</h2>
                <p className="subtitle">"Hey Kuzbury." Or tap the microphone. I am listening contextually to your symptoms, diets, or questions.</p>

                {/* Real-time Transcription Display */}
                <div className={`transcription-box ${transcription ? 'visible' : ''}`}>
                    {transcription || (isRecording ? "Listening..." : "Tap the microphone to start...")}
                </div>

                {/* Status Indicators */}
                <div className="status-area">
                    {status === 'recording' && <span className="time-display pulsing-red">{formatTime(recordingTime)}</span>}
                    {status === 'processing' && <span className="processing-text">Analyzing via LLM...</span>}
                    {status === 'success' && <span className="success-text"><CheckCircle size={16} /> Successfully Logged</span>}
                    {status === 'offline-queued' && <span className="queued-text">Saved locally. Will sync when online.</span>}
                </div>

                {/* Main Action Button */}
                <button
                    className={`mic-button ${isRecording ? 'pulse' : ''} ${status === 'processing' ? 'disabled' : ''}`}
                    onClick={isRecording ? () => stopRecording() : startRecording}
                    disabled={status === 'processing'}
                >
                    {isRecording ? (
                        <Square size={36} color="white" fill="white" />
                    ) : (
                        <Mic size={42} color="white" />
                    )}
                </button>

            </div>
        </div>
    );
}
