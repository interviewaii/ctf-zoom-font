require('dotenv').config();
const { GoogleGenAI, Modality } = require('@google/genai');
const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');

<<<<<<< HEAD
=======
require('dotenv').config();

// API Keys for rotation
const API_KEYS = [
    process.env.GEMINI_API_KEY || 'AIzaSyBivEvTpvGpZJgqlHyU3-7hQDexi7cow6s',
    'AIzaSyDin5_72rCSSjCHw93DejGfZLt783iUEe0',
    'AIzaSyCHjyKxKLGP1NEaah3oyU2t64LG6b8BMMQ',
    'AIzaSyBd6PruB7A-x6yG9XGFU3HklgZdlzjMt9M'
];
let currentKeyIndex = 0;

>>>>>>> c6c2f3a2df78b66535485f66507fb0c30929bc2a
// Conversation tracking variables
let currentSessionId = null;
let currentTranscription = '';
let conversationHistory = [];
let screenAnalysisHistory = [];
let currentProfile = null;
let currentCustomPrompt = null;
let isInitializingSession = false;
let currentResponseId = 0; // Track active response turn for race condition
let geminiStartTime = null;
let geminiPrompt = '';
let isProcessingResponse = false; // Track if we are currently receiving a response
let lastResponseTime = 0; // Prevent double responses within a short window

let activeSession = null; // Store active session reference
let voiceTimeout = null; // Global voice timeout for silence detection
let settingsCache = {}; // Cache for settings to avoid slow IPC/localStorage lookups
let isWaitingForResponse = false; // Lock to prevent multiple triggers for the same transcription
let lastTriggeredTranscription = ''; // Track last sent text to avoid duplicates

function formatSpeakerResults(results) {
    let text = '';
    for (const result of results) {
        if (result.transcript) {
            text += result.transcript + ' ';
        }
    }
    return text.trim();
}

module.exports.formatSpeakerResults = formatSpeakerResults;

// Audio capture variables
let systemAudioProc = null;
let messageBuffer = '';

// Reconnection variables
let isUserClosing = false;
let sessionParams = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 2000;

function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

// Fast Trigger - manually trigger response after silence
async function triggerGeminiResponse(transcription) {
    if (!transcription || transcription.trim().length === 0) return;

    // Only check if we're ACTIVELY getting a response from Gemini (text streaming)
    if (isProcessingResponse) {
        return; // Don't interrupt while AI is talking
    }

    if (activeSession) {
        try {
            isWaitingForResponse = true;
            lastTriggeredTranscription = transcription.trim();
            geminiPrompt = transcription;
            lastResponseTime = Date.now();
            console.log(`⚡ [FAST TRIGGER] Sending: "${transcription.substring(0, 50)}..."`);
            await activeSession.sendRealtimeInput({ text: transcription.trim() });
        } catch (err) {
            console.error('❌ [FAST TRIGGER] Failed:', err);
            isWaitingForResponse = false;
        }
    }
}

// Build context message for session restoration
function buildContextMessage() {
    const lastTurns = conversationHistory.slice(-20);
    const validTurns = lastTurns.filter(turn => turn.transcription?.trim() && turn.ai_response?.trim());

    if (validTurns.length === 0) return null;

    const contextLines = validTurns.map(turn =>
        `[Interviewer]: ${turn.transcription.trim()}\n[Your answer]: ${turn.ai_response.trim()}`
    );

    return `Session reconnected. Here's the conversation so far:\n\n${contextLines.join('\n\n')}\n\nContinue from here.`;
}

// Conversation management functions
function initializeNewSession(profile = null, customPrompt = null) {
    currentSessionId = Date.now().toString();
    currentTranscription = '';
    conversationHistory = [];
    screenAnalysisHistory = [];
    currentProfile = profile;
    currentCustomPrompt = customPrompt;
    console.log('New conversation session started:', currentSessionId, 'profile:', profile);

    if (profile) {
        sendToRenderer('save-session-context', {
            sessionId: currentSessionId,
            profile: profile,
            customPrompt: customPrompt || ''
        });
    }
}

function saveConversationTurn(transcription, aiResponse) {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const conversationTurn = {
        timestamp: Date.now(),
        transcription: transcription.trim(),
        ai_response: aiResponse.trim(),
    };

    conversationHistory.push(conversationTurn);
    console.log('Saved conversation turn:', conversationTurn);

    sendToRenderer('save-conversation-turn', {
        sessionId: currentSessionId,
        turn: conversationTurn,
        fullHistory: conversationHistory,
    });
}

function saveScreenAnalysis(prompt, response, model) {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const analysisEntry = {
        timestamp: Date.now(),
        prompt: prompt,
        response: response.trim(),
        model: model
    };

    screenAnalysisHistory.push(analysisEntry);
    console.log('Saved screen analysis:', analysisEntry);

    sendToRenderer('save-screen-analysis', {
        sessionId: currentSessionId,
        analysis: analysisEntry,
        fullHistory: screenAnalysisHistory,
        profile: currentProfile,
        customPrompt: currentCustomPrompt
    });
}

function getCurrentSessionData() {
    return {
        sessionId: currentSessionId,
        history: conversationHistory,
    };
}

<<<<<<< HEAD
=======
async function sendReconnectionContext() {
    // INTENTIONALLY DISABLED to prevent context bleeding
    // We want the model to treat every session as a fresh start for new questions
    console.log('Reconnection context disabled to ensure question independence.');
    return;
}

>>>>>>> c6c2f3a2df78b66535485f66507fb0c30929bc2a
async function getEnabledTools() {
    const tools = [];
    const googleSearchEnabled = await getStoredSetting('googleSearchEnabled', 'false');
    if (googleSearchEnabled === 'true') {
        tools.push({ googleSearch: {} });
    }
    return tools;
}

async function getApiKey() {
    if (process.env.GEMINI_API_KEY) {
        return process.env.GEMINI_API_KEY;
    }
    const storedKey = await getStoredSetting('apiKey', '');
    if (storedKey) return storedKey;
    return 'AIzaSyCVeM0WTrPXhyibT1Qy2iAjC0QK4aM5dAY';
}

async function getStoredSetting(key, defaultValue) {
    if (settingsCache[key] !== undefined) return settingsCache[key];
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            const value = await windows[0].webContents.executeJavaScript(`
                (function() {
                    try {
                        if (typeof localStorage === 'undefined') return '${defaultValue}';
                        return localStorage.getItem('${key}') || '${defaultValue}';
                    } catch (e) {
                        return '${defaultValue}';
                    }
                })()
            `);
            settingsCache[key] = value;
            return value;
        }
    } catch (error) {
        console.error('Error getting stored setting:', error.message);
    }
    return defaultValue;
}

<<<<<<< HEAD
async function initializeGeminiSession(apiKey, customPrompt = '', profile = 'interview', language = 'en-US', isReconnect = false) {
    if (isInitializingSession) return { success: false, error: 'Initialization already in progress' };
=======
function getSpeedConfig(speedSetting) {
    // Speed setting: '1' = Fast, '2' = Medium (default), '3' = Slow
    const configs = {
        '1': {
            name: 'Fast',
            silenceThreshold: 0.8, // More sensitive to silence
            description: '~1 second response time'
        },
        '2': {
            name: 'Medium',
            silenceThreshold: 1.0, // Default sensitivity
            description: '~2 second response time'
        },
        '3': {
            name: 'Slow',
            silenceThreshold: 1.5, // Less sensitive, waits longer
            description: '~3 second response time'
        }
    };

    const config = configs[speedSetting] || configs['2'];
    console.log(`Response speed configured: ${config.name} (${config.description})`);
    return config;
}

async function attemptReconnection() {
    if (!lastSessionParams || reconnectionAttempts >= maxReconnectionAttempts) {
        console.log('Max reconnection attempts reached or no session params stored');
        sendToRenderer('update-status', 'Session closed');
        return false;
    }

    reconnectionAttempts++;
    console.log(`Attempting reconnection ${reconnectionAttempts}/${maxReconnectionAttempts}...`);

    // Wait before attempting reconnection
    await new Promise(resolve => setTimeout(resolve, reconnectionDelay));

    try {
        const session = await initializeGeminiSession(
            lastSessionParams.apiKey,
            lastSessionParams.customPrompt,
            lastSessionParams.resumeContext,
            lastSessionParams.profile,
            lastSessionParams.language,
            true // isReconnection flag
        );

        if (session && global.geminiSessionRef) {
            global.geminiSessionRef.current = session;
            reconnectionAttempts = 0; // Reset counter on successful reconnection
            console.log('Live session reconnected');

            // Send context message with previous transcriptions
            await sendReconnectionContext();

            return true;
        }
    } catch (error) {
        console.error(`Reconnection attempt ${reconnectionAttempts} failed:`, error);
    }

    // If this attempt failed, try again
    if (reconnectionAttempts < maxReconnectionAttempts) {
        return attemptReconnection();
    } else {
        console.log('All reconnection attempts failed');
        sendToRenderer('update-status', 'Session closed');
        return false;
    }
}

async function initializeGeminiSession(apiKey, customPrompt = '', resumeContext = '', profile = 'interview', language = 'en-US', isReconnection = false) {
    if (isInitializingSession) {
        console.log('Session initialization already in progress');
        return false;
    }

>>>>>>> c6c2f3a2df78b66535485f66507fb0c30929bc2a
    isInitializingSession = true;

<<<<<<< HEAD
    // Refresh settings cache on session start
    settingsCache = {};
    const keysToCache = ['safetyTimeout', 'followUpDelay', 'silenceTrigger', 'googleSearchEnabled', 'apiKey'];
    for (const key of keysToCache) {
        await getStoredSetting(key, '');
=======
    // Store session parameters for reconnection (only if not already reconnecting)
    if (!isReconnection) {
        lastSessionParams = {
            apiKey,
            customPrompt,
            resumeContext,
            profile,
            language,
        };
        reconnectionAttempts = 0; // Reset counter for new session
>>>>>>> c6c2f3a2df78b66535485f66507fb0c30929bc2a
    }

    if (!apiKey) {
        apiKey = await getStoredSetting('apiKey', '');
    }

    if (!apiKey) {
        isInitializingSession = false;
        return { success: false, error: 'No API key configured.' };
    }

    if (activeSession) {
        try { await activeSession.close(); } catch (e) { }
        activeSession = null;
    }

    if (!isReconnect) {
        sendToRenderer('session-initializing', true);
        sessionParams = { apiKey, customPrompt, profile, language };
        reconnectAttempts = 0;
        initializeNewSession(profile, customPrompt);
    }

    // COMPLETELY NEW CLIENT INSTANCE for every session to prevent state leakage
    const client = new GoogleGenAI({
        vertexai: false,
        apiKey: apiKey,
        httpOptions: { apiVersion: 'v1alpha' },
    });

    const enabledTools = await getEnabledTools();
<<<<<<< HEAD
    const systemPrompt = getSystemPrompt(profile, customPrompt, enabledTools.some(t => t.googleSearch));
=======
    const googleSearchEnabled = enabledTools.some(tool => tool.googleSearch);

    // Get response speed configuration
    const responseSpeed = await getStoredSetting('responseSpeed', '2');
    const speedConfig = getSpeedConfig(responseSpeed);

    const systemPrompt = getSystemPrompt(profile, customPrompt, resumeContext, googleSearchEnabled);

    // Initialize new conversation session (only if not reconnecting)
    if (!isReconnection) {
        initializeNewSession();
        // FORCE CLEAN SLATE: If there's an existing session, kill it.
        if (global.geminiSessionRef && global.geminiSessionRef.current) {
            console.log('Force-closing previous session for clean slate.');
            try {
                // We rely on the garbage collector mostly, but setting to null helps
                global.geminiSessionRef.current = null;
            } catch (e) {
                console.error('Error clearing previous session:', e);
            }
        }
    }
>>>>>>> c6c2f3a2df78b66535485f66507fb0c30929bc2a

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
    try {
<<<<<<< HEAD
=======
        console.log(`Initializing Gemini session with model: ${modelName}`);
        const keyToMask = effectiveApiKey || 'undefined';
        const maskedKey = keyToMask !== 'undefined' ? `${keyToMask.substring(0, 4)}...${keyToMask.substring(keyToMask.length - 4)}` : 'undefined';
        console.log('API Key (masked):', maskedKey);

        if (!client.live) {
            console.error('client.live is undefined. Check @google/genai version.');
            if (client.aio && client.aio.live) {
                console.log('Found client.aio.live, using that instead.');
                // Adjust if necessary, but for now just log it.
            }
        }

>>>>>>> c6c2f3a2df78b66535485f66507fb0c30929bc2a
        const session = await client.live.connect({
            model: modelName,
            callbacks: {
                onopen: function () {
<<<<<<< HEAD
                    console.log('Gemini Live session connected!');
=======
                    console.log('Gemini Live session opened successfully');
                    console.log('VAD configured: silenceDurationMs=300, EndSensitivity=HIGH');
>>>>>>> c6c2f3a2df78b66535485f66507fb0c30929bc2a
                    sendToRenderer('update-status', 'Live session connected');
                },
                onmessage: function (message) {
                    // console.log('📥 [GEMINI MESSAGE]', JSON.stringify(message, null, 2));

                    if (message.serverContent?.inputTranscription?.results) {
                        const newPart = formatSpeakerResults(message.serverContent.inputTranscription.results);
                        if (newPart && newPart.trim()) {
                            // ✅ ACCUMULATE properly - build the full sentence from fragments
                            if (!currentTranscription.endsWith(newPart)) {
                                currentTranscription += (currentTranscription ? ' ' : '') + newPart;
                            }
                            console.log(`✅ [VOICE INPUT] "${currentTranscription}"`);
                            sendToRenderer('live-transcription', { text: currentTranscription });
                            // ⚡ TURN-BASED: No manual triggers here. Wait for turnComplete.
                        }
                    } else if (message.serverContent?.inputTranscription?.text) {
                        const text = message.serverContent.inputTranscription.text;
                        if (text.trim() !== '') {
                            // ✅ ACCUMULATE properly
                            if (!currentTranscription.endsWith(text.trim())) {
                                currentTranscription += (currentTranscription ? ' ' : '') + text.trim();
                            }
                            console.log(`✅ [VOICE INPUT] "${currentTranscription}"`);
                            sendToRenderer('live-transcription', { text: currentTranscription });
                            // ⚡ TURN-BASED: No manual triggers here. Wait for turnComplete.
                        }
                    }

                    if (message.serverContent?.modelTurn?.parts) {
<<<<<<< HEAD
                        const parts = message.serverContent.modelTurn.parts;
                        for (const part of parts) {
                            if (part.text) {
                                const text = part.text;
                                if (text.trim() === '') continue;

                                const isNewResponse = !isProcessingResponse;
                                if (isNewResponse) {
                                    isProcessingResponse = true;
                                    isWaitingForResponse = false; // Reset lock when AI starts talking
                                    lastResponseTime = Date.now();
                                    geminiStartTime = Date.now();
                                    messageBuffer = text;
                                    console.log(`🚀 [GEMINI] Starting new response...`);
                                } else {
                                    messageBuffer += text;
                                }
                                sendToRenderer(isNewResponse ? 'new-response' : 'update-response', { text: messageBuffer, source: 'gemini' });
=======
                        for (const part of message.serverContent.modelTurn.parts) {
                            if (part.text) {
                                // Filter out internal monologue/thinking lines
                                // Split by newlines to handle multi-line chunks correctly

                                // Split by newlines to handle multi-line chunks correctly
                                const lines = part.text.split('\n');
                                const cleanedLines = [];

                                // Ultra-comprehensive thinking patterns to catch ALL variations
                                const thinkingPatterns = [
                                    // Original patterns
                                    /^(\*\*|#|##)?\s*(Relating|Connecting|Framing|Assessing|Understanding|Zeroing|Reflecting|Defining|Refining|Crafting|Interpreting|Solidifying|Analyzing|Strategy|Strategies|Strategizing|Thinking|Planning|Formulating|Consolidating|Breaking down|Expanding|Clarifying|Contextualizing|Developing|Delivering|Final|Structuring|Elaborating|Composing|I('ve)? (refined|explored|crafted|drafted|structured|created|finalized|finalise|ready|prepared|broken down|outlined|completed|selected|formatted))/i,
                                    /^I('m| am) (now|currently|refining|concentrating|tailoring|highlighting|focusing|emphasizing|planning|satisfied|presenting|elaborating|thinking|reflecting|zeroing|connecting|relating|formulating|starting|distilling|crafting|focused)/i,
                                    /^I (plan to|will|have) (mention|state|explain|highlight|include|outlined|crafted|prepared|completed|selected|verified|generated|removed|ensured|considered|successfully)/i,
                                    /^My (focus|goal|plan|aim|instruction|latest focus|approach|thoughts|task) (is|are|was|were|expands|now)/i,
                                    /^Assuming (a|the) (standard|professional|level)/i,
                                    /^(Key features include|The summary|The response|This response|I'll then|I'll highlight|I've highlighted|I am now incorporating)/i,
                                    /^(The focus is on|My latest focus)/i,
                                    // Catch "Generating" at start of line
                                    /^Generating/i,
                                    // Catch "My task is" or "My task was"
                                    /^My task (is|was)/i,
                                    // Catch "I have generated" or "I have successfully"
                                    /^I have (generated|successfully|removed|ensured|considered|selected|formatted)/i,
                                    // Catch any line with "adhering to all instructions" or similar
                                    /(adhering to|fulfills all|meets all|all requirements|all instructions|all specifications)/i,
                                    // Catch "making it ready for presentation"
                                    /(ready for presentation|ready for|making it)/i,
                                    // Catch "The response is concise" or similar self-assessment
                                    /^The response (is|was|fulfills|meets)/i,
                                    // Catch "I considered all the elements"
                                    /I considered/i,
                                    // Catch any line starting with "Each bullet point"
                                    /^Each bullet/i
                                ];

                                for (const line of lines) {
                                    let isThinkingLine = false;
                                    for (const pattern of thinkingPatterns) {
                                        if (pattern.test(line)) {
                                            console.log('Stripped thinking line:', line);
                                            isThinkingLine = true;
                                            break;
                                        }
                                    }
                                    if (!isThinkingLine) {
                                        cleanedLines.push(line);
                                    }
                                }

                                const cleanedText = cleanedLines.join('\n');

                                if (cleanedText.trim().length === 0) {
                                    // If the entire chunk was thinking lines, skip it
                                    continue;
                                }

                                let timingPrefix = '';
                                if (messageBuffer === '' && lastRequestTime) {
                                    const duration = (Date.now() - lastRequestTime) / 1000;
                                    timingPrefix = `[${duration.toFixed(1)}s] `;
                                }

                                const fullText = timingPrefix + cleanedText;
                                messageBuffer += fullText;
                                sendToRenderer('update-response-stream', fullText);
>>>>>>> c6c2f3a2df78b66535485f66507fb0c30929bc2a
                            }
                        }
                    }

                    if (message.serverContent?.generationComplete) {
                        console.log('🏁 [GEMINI] Generation complete');
                        if (messageBuffer.trim() !== '') {
                            sendToRenderer('update-response', { text: messageBuffer, source: 'gemini' });
                            if (currentTranscription || geminiPrompt) {
                                saveConversationTurn(currentTranscription || geminiPrompt, messageBuffer);
                            }
                        }
                        messageBuffer = '';
                        geminiStartTime = null;
                        isProcessingResponse = false;
                        isWaitingForResponse = false; // Ensure lock is reset
                        geminiPrompt = '';
                        lastTriggeredTranscription = ''; // Clear last sent text
                    }

                    if (message.serverContent?.turnComplete) {
                        console.log('🎯 [TURN COMPLETE]');
                        if (currentTranscription.trim().length > 0) {
                            const transcriptToTrigger = currentTranscription;
                            // ⚡ TRIGGER: Now that the turn is complete, send the full accumulated transcription
                            triggerGeminiResponse(transcriptToTrigger);

                            geminiPrompt = currentTranscription;
                            currentTranscription = '';
                            sendToRenderer('live-transcription', { text: '' });
                        }
                    } else if (message.serverContent?.setupComplete) {
                        console.log('[EVENT] Setup complete');
                    }
                },
                onerror: function (e) {
                    console.log('Session error:', e.message);
                    isProcessingResponse = false;
                    isWaitingForResponse = false;
                    sendToRenderer('update-status', 'Error: ' + e.message);
                },
                onclose: function (e) {
                    console.log('Session closed:', e.reason);
                    if (global.geminiSessionRef) global.geminiSessionRef.current = null;
                    activeSession = null;
                    isProcessingResponse = false;
                    isWaitingForResponse = false;
                    if (isUserClosing) {
                        isUserClosing = false;
                        sendToRenderer('update-status', 'Session closed');
                        return;
                    }
                    if (sessionParams && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        setTimeout(() => { if (!activeSession && !isInitializingSession) attemptReconnect(); }, RECONNECT_DELAY);
                    } else {
                        sendToRenderer('update-status', 'Session closed');
                    }
                },
            },
            config: {
<<<<<<< HEAD
                responseModalities: [Modality.TEXT],
                outputAudioTranscription: {},
                tools: enabledTools,
                inputAudioTranscription: { model: 'default', enableAutomaticPunctuation: true },
                contextWindowCompression: { slidingWindow: {} },
                speechConfig: { languageCode: 'en-US', alternativeLanguageCodes: [] },
                systemInstruction: { parts: [{ text: systemPrompt }] },
=======
                realtimeInputConfig: {
                    automaticActivityDetection: {
                        disabled: false,
                        // Shorter silence duration = faster response (300ms instead of default ~1000ms)
                        startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                        endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
                        prefixPaddingMs: 100,
                        silenceDurationMs: 300,
                    }
                },
                responseModalities: ['AUDIO'],
                tools: enabledTools,
                inputAudioTranscription: {}, // Ensure this is enabled for voice
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
                    languageCode: language
                },
                systemInstruction: {
                    parts: [{ text: systemPrompt }],
                },
>>>>>>> c6c2f3a2df78b66535485f66507fb0c30929bc2a
            },
        });

        activeSession = session;
        if (global.geminiSessionRef) global.geminiSessionRef.current = session;
        isInitializingSession = false;
        if (!isReconnect) sendToRenderer('session-initializing', false);
        return { success: true, session: session };
    } catch (error) {
        console.error('Failed to initialize Gemini session:', error);
        isInitializingSession = false;
        activeSession = null;
        if (global.geminiSessionRef) global.geminiSessionRef.current = null;
        if (!isReconnect) sendToRenderer('session-initializing', false);
        return { success: false, error: error.message };
    }
}

async function attemptReconnect() {
    reconnectAttempts++;
    messageBuffer = '';
    currentTranscription = '';
    sendToRenderer('update-status', `Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
    try {
        const result = await initializeGeminiSession(sessionParams.apiKey, sessionParams.customPrompt, sessionParams.profile, sessionParams.language, true);
        if (result.success && result.session) {
            const contextMessage = buildContextMessage();
            if (contextMessage) await result.session.sendRealtimeInput({ text: contextMessage });
            sendToRenderer('update-status', 'Reconnected! Listening...');
            return true;
        }
    } catch (error) { console.error('Reconnect failed:', error); }
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) return attemptReconnect();
    sendToRenderer('reconnect-failed', { message: 'Max reconnection attempts reached.' });
    return false;
}

function killExistingSystemAudioDump() {
    return new Promise(resolve => {
        const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], { stdio: 'ignore' });
        killProc.on('close', () => resolve());
        killProc.on('error', () => resolve());
        setTimeout(() => { killProc.kill(); resolve(); }, 2000);
    });
}

async function startMacOSAudioCapture() {
    if (process.platform !== 'darwin') return false;
    await killExistingSystemAudioDump();
    const { app } = require('electron');
    const path = require('path');
<<<<<<< HEAD
    let systemAudioPath = app.isPackaged ? path.join(process.resourcesPath, 'SystemAudioDump') : path.join(__dirname, '../assets', 'SystemAudioDump');
    systemAudioProc = spawn(systemAudioPath, [], { stdio: ['ignore', 'pipe', 'pipe'] });
    if (!systemAudioProc.pid) return false;
=======

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'SystemAudioDump');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'SystemAudioDump');
    }

    console.log('SystemAudioDump path:', systemAudioPath);

    systemAudioProc = spawn(systemAudioPath, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (!systemAudioProc.pid) {
        console.error('Failed to start SystemAudioDump');
        return false;
    }

    console.log('SystemAudioDump started with PID:', systemAudioProc.pid);

    // Get audio chunk speed setting (1-4 scale with 0.5 increments)
    const audioChunkSpeed = await getStoredSetting('audioChunkSpeed', '1');
    const speedMultiplier = {
        '1': 0.03,   // 30ms chunks - Fastest (Google recommended)
        '1.5': 0.05, // 50ms chunks
        '2': 0.07,   // 70ms chunks
        '2.5': 0.08, // 80ms chunks
        '3': 0.1,    // 100ms chunks - Original default
        '3.5': 0.15, // 150ms chunks
        '4': 0.27    // 270ms chunks - Slowest
    };
    const CHUNK_DURATION = speedMultiplier[audioChunkSpeed] || 0.03;
    console.log(`Audio chunk speed: ${audioChunkSpeed} (${CHUNK_DURATION * 1000}ms chunks)`);

    const SAMPLE_RATE = 24000;
    const BYTES_PER_SAMPLE = 2;
    const CHANNELS = 2;
    const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

    let audioBuffer = Buffer.alloc(0);

>>>>>>> c6c2f3a2df78b66535485f66507fb0c30929bc2a
    systemAudioProc.stdout.on('data', data => {
        if (activeSession) activeSession.sendRealtimeInput({ audio: { data: data.toString('base64'), mimeType: 'audio/pcm;rate=24000' } });
    });
    return true;
}

function stopMacOSAudioCapture() {
    if (systemAudioProc) {
        systemAudioProc.kill();
        systemAudioProc = null;
    }
}

function getAvailableModel() { return 'gemini-2.0-flash-exp'; }

async function sendImageToGeminiHttp(base64Data, prompt) {
    const thisResponseId = ++currentResponseId;
    const model = getAvailableModel();
    const apiKey = await getApiKey();
    if (!apiKey) return { success: false, error: 'No API key configured' };
    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        const contents = [{ inlineData: { mimeType: 'image/jpeg', data: base64Data } }, { text: prompt }];
        const response = await ai.models.generateContentStream({ model: model, contents: contents });
        let fullText = '';
        let isFirst = true;
        for await (const chunk of response) {
            if (currentResponseId !== thisResponseId) break;
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                sendToRenderer(isFirst ? 'new-response' : 'update-response', { text: `Q: ${prompt}\n\n[Gemini...] ${fullText}`, source: 'gemini' });
                isFirst = false;
            }
        }
        if (currentResponseId === thisResponseId) {
            const finalText = `Q: ${prompt}\n\n${fullText}`;
            sendToRenderer('update-response', { text: finalText, source: 'gemini' });
            saveScreenAnalysis(prompt, finalText, model);
            return { success: true, text: finalText, model: model };
        }
        return { success: true, text: fullText, model: model };
    } catch (error) {
        console.error('Error sending image:', error);
        return { success: false, error: error.message };
    }
}

function setupGeminiIpcHandlers(geminiSessionRef) {
    global.geminiSessionRef = geminiSessionRef;
<<<<<<< HEAD
    ipcMain.handle('initialize-gemini', async (event, apiKey, customPrompt, profile, language) => {
        const result = await initializeGeminiSession(apiKey, customPrompt, profile, language);
        return { success: result.success, error: result.error };
=======

    ipcMain.handle('initialize-gemini', async (event, profile = 'interview', language = 'en-US', customPrompt = '', resumeContext = '', apiKey = null) => {
        console.log('IPC initialize-gemini called with:', { profile, language, hasCustomPrompt: !!customPrompt, hasResume: !!resumeContext, hasApiKey: !!apiKey });
        const session = await initializeGeminiSession(apiKey, customPrompt, resumeContext, profile, language);
        if (session) {
            geminiSessionRef.current = session;
            return true;
        }
        return false;
>>>>>>> c6c2f3a2df78b66535485f66507fb0c30929bc2a
    });
    ipcMain.handle('send-audio-content', async (event, { data, mimeType }) => {
        if (!activeSession) {
            if (isInitializingSession) return { success: false };
            const apiKey = await getApiKey();
            if (apiKey) initializeGeminiSession(apiKey);
        }
        if (!activeSession) return { success: false };
        try {
            await activeSession.sendRealtimeInput({ audio: { data: data, mimeType: mimeType } });
            return { success: true };
        } catch (e) { return { success: false }; }
    });
    ipcMain.handle('send-mic-audio-content', async (event, { data, mimeType }) => {
        if (!activeSession) {
            if (isInitializingSession) return { success: false };
            const apiKey = await getApiKey();
            if (apiKey) initializeGeminiSession(apiKey);
        }
        if (!activeSession) return { success: false };
        try {
            await activeSession.sendRealtimeInput({ audio: { data: data, mimeType: mimeType } });
            return { success: true };
        } catch (e) { return { success: false }; }
    });
    ipcMain.handle('send-image-content', async (event, { data, prompt }) => {
        return await sendImageToGeminiHttp(data, prompt);
    });
    ipcMain.handle('send-text-message', async (event, text) => {
        if (!activeSession) {
            const apiKey = await getApiKey();
            if (apiKey) await initializeGeminiSession(apiKey);
        }
        if (!activeSession) return { success: false };
        try {
            geminiStartTime = Date.now();
            geminiPrompt = text;
            await activeSession.sendRealtimeInput({ text: text.trim() });
            return { success: true };
        } catch (e) { return { success: false }; }
    });
    ipcMain.on('update-setting-cache', (event, { key, value }) => {
        settingsCache[key] = value;
        console.log(`⚙️ [CACHE] Updated ${key} = ${value}`);
    });
    ipcMain.handle('start-macos-audio', async () => { return { success: await startMacOSAudioCapture() }; });
    ipcMain.handle('stop-macos-audio', async () => { stopMacOSAudioCapture(); return { success: true }; });
}

module.exports = {
    initializeGeminiSession,
    setupGeminiIpcHandlers,
    stopMacOSAudioCapture,
    sendToRenderer,
};
