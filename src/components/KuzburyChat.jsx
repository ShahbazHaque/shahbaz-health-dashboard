import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, WifiOff, Loader, Send } from 'lucide-react';
import { extractVoiceLog, chatWithKuzbury, buildPatientContext, getTimeOfDayGreeting } from '../lib/gemini';
import './KuzburyChat.css';

export default function KuzburyChat({ supabase }) {
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [status, setStatus] = useState('idle'); // idle, recording, processing, success, offline-queued
    const [isOffline, setIsOffline] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [patientContext, setPatientContext] = useState('');

    const [chatHistory, setChatHistory] = useState([
        { role: 'model', text: `${getTimeOfDayGreeting()} Shahbaz. I'm Dr. Kuzbury, your AI cardiologist. I'm loading your latest health data now — feel free to ask me anything about your cardiovascular health.` }
    ]);

    const recognitionRef = useRef(null);
    const timerRef = useRef(null);
    const scrollRef = useRef(null);

    // Initial setup
    useEffect(() => {
        setIsOffline(!navigator.onLine);
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Native Browser Voice Setup
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
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                stopRecording(true);
            };
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Load patient context from Supabase on mount
    useEffect(() => {
        if (supabase) {
            buildPatientContext(supabase).then(ctx => {
                setPatientContext(ctx);
                console.log('Patient context loaded for Dr. Kuzbury');
            }).catch(e => console.error('Failed to load patient context:', e));
        }
    }, [supabase]);

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatHistory, transcription]);

    const startRecording = () => {
        setIsRecording(true);
        setStatus('recording');
        // Do not clear transcription here so they can append voice to text
        setRecordingTime(0);

        timerRef.current = setInterval(() => {
            setRecordingTime((prev) => prev + 1);
        }, 1000);

        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error("Mic start err:", e);
            }
        }
    };

    const stopRecording = (isError = false) => {
        setIsRecording(false);
        clearInterval(timerRef.current);

        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        if (isError) {
            setStatus('idle');
            return;
        }

        setStatus('idle');
    };

    const handleSend = async () => {
        if (!transcription.trim()) return;

        // Ensure mic stops
        if (isRecording) {
            stopRecording();
        }

        const userMessage = transcription.trim();
        setStatus('processing');
        setTranscription('');

        // 1. Instantly show user message
        const newMsg = { role: 'user', text: userMessage };
        setChatHistory(prev => [...prev, newMsg]);

        try {
            // Local Data Extractor (background)
            extractVoiceLog(userMessage).then(data => {
                if (data) console.log("Extracted Health Event:", data);
            }).catch(e => console.error("Silent extraction failed:", e));

            // Execute Gemini Chat Inference with live patient context
            const responseText = await chatWithKuzbury(userMessage, chatHistory, patientContext, supabase);

            // Render Model Response
            setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);

        } catch (error) {
            console.error("Failed to process message:", error);
            const greeting = new Date().getHours() < 12 ? 'Good morning' : (new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening');
            const fallbackText = `${greeting}, Shahbaz. Dr. Kuzbury here. I am monitoring your cardiovascular recovery parameters.\n\nAs your personal AI cardiologist, I am here to help you manage your post-MI care, review your vital sign trends, track medication adherence, and evaluate your lipid targets.\n\nWhat can I clarify for you regarding your heart health today?`;
            setChatHistory(prev => [...prev, { role: 'model', text: fallbackText }]);
        } finally {
            setStatus('idle');
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`kuzbury-container ${isRecording ? 'recording' : ''}`}>
            <div className={`glow-effect ${isRecording ? 'active' : ''}`} />

            <div className="kuzbury-content">
                {isOffline && (
                    <div className="offline-pill">
                        <WifiOff size={12} style={{ marginRight: '6px' }} />
                        Working Offline - Episodic Memory Only
                    </div>
                )}

                <div className="kuzbury-header">
                    <img src={`${import.meta.env.BASE_URL}dr_kuzbury.jpg`} alt="Dr. Kuzbury" className="avatar" />
                    <div>
                        <h2>Dr. Kuzbury is online</h2>
                        <p className="subtitle">Your N=1 AI Cardiologist</p>
                    </div>
                </div>

                {/* Chat History View */}
                <div className="chat-window" ref={scrollRef}>
                    {chatHistory.map((msg, i) => (
                        <div key={i} className={`chat-bubble ${msg.role}`}>
                            {msg.role === 'model' && <img src={`${import.meta.env.BASE_URL}dr_kuzbury.jpg`} alt="Dr. Kuzbury" className="chat-avatar" />}
                            <div className="chat-text">{msg.text}</div>
                        </div>
                    ))}

                    {/* Processing Indicator */}
                    {status === 'processing' && (
                        <div className="chat-bubble model processing">
                            <img src={`${import.meta.env.BASE_URL}dr_kuzbury.jpg`} alt="Dr. Kuzbury" className="chat-avatar" />
                            <div className="chat-text"><Loader size={16} className="spin" /> Analyzing Clinical Data...</div>
                        </div>
                    )}
                </div>

                {/* Input Controls Area */}
                <div className="controls-area" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', background: 'var(--bg-card-hover)', padding: '16px', borderRadius: '12px' }}>

                    <button
                        className={`mic-button small ${isRecording ? 'pulse error' : ''} ${status === 'processing' ? 'disabled' : ''}`}
                        onClick={isRecording ? () => stopRecording() : startRecording}
                        disabled={status === 'processing'}
                        style={{ width: '40px', height: '40px', flexShrink: 0 }}
                    >
                        {isRecording ? <Square size={18} color="white" fill="white" /> : <Mic size={18} color="white" />}
                    </button>

                    <div style={{ flex: 1, margin: '0 12px', position: 'relative' }}>
                        <textarea
                            value={transcription}
                            onChange={(e) => setTranscription(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder={isRecording ? `Listening... (${formatTime(recordingTime)})` : "Type a message or use dictation..."}
                            disabled={status === 'processing'}
                            rows={1}
                            style={{
                                width: '100%',
                                padding: '12px',
                                paddingRight: '40px',
                                borderRadius: '10px',
                                background: 'var(--bg-page)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                resize: 'none',
                                fontFamily: 'inherit',
                                fontSize: '14px',
                                lineHeight: '1.4',
                                maxHeight: '100px',
                                overflowY: 'auto'
                            }}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleSend}
                            disabled={status === 'processing' || !transcription.trim()}
                            style={{ position: 'absolute', right: '4px', top: '4px', bottom: '4px', width: '36px', height: 'auto', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}>
                            <Send size={16} />
                        </button>
                    </div>

                </div>

            </div>
        </div>
    );
}
