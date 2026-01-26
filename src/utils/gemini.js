require('dotenv').config();
const { GoogleGenAI, Modality } = require('@google/genai');
const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');

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

async function initializeGeminiSession(apiKey, customPrompt = '', profile = 'interview', language = 'en-US', isReconnect = false) {
    if (isInitializingSession) return { success: false, error: 'Initialization already in progress' };
    isInitializingSession = true;

    // Refresh settings cache on session start
    settingsCache = {};
    const keysToCache = ['safetyTimeout', 'followUpDelay', 'silenceTrigger', 'googleSearchEnabled', 'apiKey'];
    for (const key of keysToCache) {
        await getStoredSetting(key, '');
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

    const client = new GoogleGenAI({
        vertexai: false,
        apiKey: apiKey,
        httpOptions: { apiVersion: 'v1alpha' },
    });

    const enabledTools = await getEnabledTools();
    const systemPrompt = getSystemPrompt(profile, customPrompt, enabledTools.some(t => t.googleSearch));

    try {
        const session = await client.live.connect({
            model: 'gemini-2.0-flash-exp',
            callbacks: {
                onopen: function () {
                    console.log('Gemini Live session connected!');
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
                responseModalities: [Modality.TEXT],
                outputAudioTranscription: {},
                tools: enabledTools,
                inputAudioTranscription: { model: 'default', enableAutomaticPunctuation: true },
                contextWindowCompression: { slidingWindow: {} },
                speechConfig: { languageCode: 'en-US', alternativeLanguageCodes: [] },
                systemInstruction: { parts: [{ text: systemPrompt }] },
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
    let systemAudioPath = app.isPackaged ? path.join(process.resourcesPath, 'SystemAudioDump') : path.join(__dirname, '../assets', 'SystemAudioDump');
    systemAudioProc = spawn(systemAudioPath, [], { stdio: ['ignore', 'pipe', 'pipe'] });
    if (!systemAudioProc.pid) return false;
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
    ipcMain.handle('initialize-gemini', async (event, apiKey, customPrompt, profile, language) => {
        const result = await initializeGeminiSession(apiKey, customPrompt, profile, language);
        return { success: result.success, error: result.error };
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
