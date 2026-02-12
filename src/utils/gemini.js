const { GoogleGenAI } = require('@google/genai');
const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');

require('dotenv').config();

// API Keys for rotation
const API_KEYS = [
    process.env.GEMINI_API_KEY || 'AIzaSyBivEvTpvGpZJgqlHyU3-7hQDexi7cow6s',
    'AIzaSyDin5_72rCSSjCHw93DejGfZLt783iUEe0',
    'AIzaSyCHjyKxKLGP1NEaah3oyU2t64LG6b8BMMQ',
    'AIzaSyBd6PruB7A-x6yG9XGFU3HklgZdlzjMt9M'
];
let currentKeyIndex = 0;

// Conversation tracking variables
let currentSessionId = null;
let currentTranscription = '';
let lastRequestTime = null;
let isFirstChunk = true;
let conversationHistory = [];
let isInitializingSession = false;

// Audio capture variables
let systemAudioProc = null;
let messageBuffer = '';

// Reconnection tracking variables
let reconnectionAttempts = 0;
let maxReconnectionAttempts = 3;
let reconnectionDelay = 500; // Reduced to 500ms for faster recovery
let lastSessionParams = null;

function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

// Conversation management functions
function initializeNewSession() {
    currentSessionId = Date.now().toString();
    currentTranscription = '';
    conversationHistory = [];
    console.log('New conversation session started:', currentSessionId);
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

    // Send to renderer to save in IndexedDB
    sendToRenderer('save-conversation-turn', {
        sessionId: currentSessionId,
        turn: conversationTurn,
        fullHistory: conversationHistory,
    });
}

function getCurrentSessionData() {
    return {
        sessionId: currentSessionId,
        history: conversationHistory,
    };
}

async function sendReconnectionContext() {
    // INTENTIONALLY DISABLED to prevent context bleeding
    // We want the model to treat every session as a fresh start for new questions
    console.log('Reconnection context disabled to ensure question independence.');
    return;
}

async function getEnabledTools() {
    const tools = [];

    // Check if Google Search is enabled (default: false for speed)
    const googleSearchEnabled = await getStoredSetting('googleSearchEnabled', 'false');
    console.log('Google Search enabled:', googleSearchEnabled);

    if (googleSearchEnabled === 'true') {
        tools.push({ googleSearch: {} });
        console.log('⚠️ WARNING: Google Search is ENABLED. This will significantly SLOW DOWN responses.');
    } else {
        console.log('Google Search tool disabled (Fast Mode)');
    }

    return tools;
}

async function getStoredSetting(key, defaultValue) {
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            // Removed delay for maximum speed

            // Try to get setting from renderer process localStorage
            const value = await windows[0].webContents.executeJavaScript(`
                (function() {
                    try {
                        if (typeof localStorage === 'undefined') {
                            console.log('localStorage not available yet for ${key}');
                            return '${defaultValue}';
                        }
                        const stored = localStorage.getItem('${key}');
                        console.log('Retrieved setting ${key}:', stored);
                        return stored || '${defaultValue}';
                    } catch (e) {
                        console.error('Error accessing localStorage for ${key}:', e);
                        return '${defaultValue}';
                    }
                })()
            `);
            return value;
        }
    } catch (error) {
        console.error('Error getting stored setting for', key, ':', error.message);
    }
    console.log('Using default value for', key, ':', defaultValue);
    return defaultValue;
}

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

    isInitializingSession = true;
    sendToRenderer('session-initializing', true);

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
    }

    // Use rotated API key if none provided or if we want to load balance
    const effectiveApiKey = apiKey || API_KEYS[currentKeyIndex];
    console.log(`Using API Key index: ${currentKeyIndex}`);

    // COMPLETELY NEW CLIENT INSTANCE for every session to prevent state leakage
    const client = new GoogleGenAI({
        vertexai: false,
        apiKey: effectiveApiKey,
    });

    // Get enabled tools first to determine Google Search status
    const enabledTools = await getEnabledTools();
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

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
    try {
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

        const session = await client.live.connect({
            model: modelName,
            callbacks: {
                onopen: function () {
                    console.log('Gemini Live session opened successfully');
                    console.log('VAD configured: silenceDurationMs=300, EndSensitivity=HIGH');
                    sendToRenderer('update-status', 'Live session connected');
                },
                onmessage: function (message) {
                    // console.log('----------------', JSON.stringify(message, null, 2));

                    // Handle transcription input
                    if (message.serverContent?.inputTranscription?.text) {
                        console.log('🎤 Transcription:', message.serverContent.inputTranscription.text);
                        currentTranscription += message.serverContent.inputTranscription.text;
                    }

                    // Handle AI model response
                    if (message.serverContent?.modelTurn?.parts) {
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
                            }
                        }
                    }

                    if (message.serverContent?.generationComplete) {
                        console.log('Generation complete, sending response:', messageBuffer.substring(0, 50) + '...');
                        sendToRenderer('update-response', messageBuffer);

                        // Save conversation turn when we have both transcription and AI response
                        if (currentTranscription && messageBuffer) {
                            saveConversationTurn(currentTranscription, messageBuffer);
                            currentTranscription = ''; // Reset for next turn
                        }

                        messageBuffer = '';
                    }

                    if (message.serverContent?.turnComplete) {
                        // Fallback: If we have a buffer but didn't get generationComplete, send it now
                        if (messageBuffer.length > 0) {
                            sendToRenderer('update-response', messageBuffer);

                            if (currentTranscription && messageBuffer) {
                                saveConversationTurn(currentTranscription, messageBuffer);
                                currentTranscription = '';
                            }
                            messageBuffer = '';
                        }
                        sendToRenderer('update-status', 'Listening...');
                        isFirstChunk = true;
                        lastRequestTime = null;
                    }
                },
                onerror: function (e) {
                    console.error('Gemini Live session error:', e);
                    console.error('Error message:', e.message);

                    const isApiKeyError = e.message && (
                        e.message.includes('API key not valid') ||
                        e.message.includes('invalid API key') ||
                        e.message.includes('authentication failed') ||
                        e.message.includes('unauthorized')
                    );

                    if (isApiKeyError || e.message?.includes('Resource has been exhausted')) {
                        console.log('API Key error or limit reached - rotating key');
                        currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;

                        if (lastSessionParams && reconnectionAttempts < maxReconnectionAttempts) {
                            setTimeout(() => attemptReconnection(), 1000);
                        }
                        return;
                    }

                    sendToRenderer('update-status', 'Error: ' + e.message);
                },
                onclose: function (e) {
                    console.log('Gemini Live session closed:', e);

                    // Check if the session closed due to invalid API key
                    const isApiKeyError =
                        e.reason &&
                        (e.reason.includes('API key not valid') ||
                            e.reason.includes('invalid API key') ||
                            e.reason.includes('authentication failed') ||
                            e.reason.includes('unauthorized'));

                    if (isApiKeyError) {
                        console.log('Session closed due to invalid API key - stopping reconnection attempts');
                        lastSessionParams = null; // Clear session params to prevent reconnection
                        reconnectionAttempts = maxReconnectionAttempts; // Stop further attempts
                        sendToRenderer('update-status', 'Session closed: Invalid API key');
                        return;
                    }

                    // Attempt automatic reconnection for server-side closures
                    if (lastSessionParams && reconnectionAttempts < maxReconnectionAttempts) {
                        console.log('Attempting automatic reconnection...');
                        attemptReconnection();
                    } else {
                        sendToRenderer('update-status', 'Session closed');
                    }
                },
            },
            config: {
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
            },
        });

        console.log('Gemini session object created:', !!session);
        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        return session;
    } catch (error) {
        console.error('Failed to initialize Gemini session (catch block):', error);

        // Rotate key and retry if it's an API key error
        const isApiKeyError = error.message && (
            error.message.includes('API key not valid') ||
            error.message.includes('invalid API key') ||
            error.message.includes('authentication failed') ||
            error.message.includes('unauthorized') ||
            error.message.includes('Resource has been exhausted')
        );

        if (isApiKeyError) {
            console.log('API Key error in catch block - rotating key and retrying');
            currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
            isInitializingSession = false;

            if (lastSessionParams && reconnectionAttempts < maxReconnectionAttempts) {
                return attemptReconnection();
            }
        }

        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        sendToRenderer('update-status', 'Error: ' + error.message);
        return null;
    }
}

function killExistingSystemAudioDump() {
    return new Promise(resolve => {
        console.log('Checking for existing SystemAudioDump processes...');

        // Kill any existing SystemAudioDump processes
        const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
            stdio: 'ignore',
        });

        killProc.on('close', code => {
            if (code === 0) {
                console.log('Killed existing SystemAudioDump processes');
            } else {
                console.log('No existing SystemAudioDump processes found');
            }
            resolve();
        });

        killProc.on('error', err => {
            console.log('Error checking for existing processes (this is normal):', err.message);
            resolve();
        });

        // Timeout after 2 seconds
        setTimeout(() => {
            killProc.kill();
            resolve();
        }, 2000);
    });
}

async function startMacOSAudioCapture(geminiSessionRef) {
    if (process.platform !== 'darwin') return false;

    // Kill any existing SystemAudioDump processes first
    await killExistingSystemAudioDump();

    console.log('Starting macOS audio capture with SystemAudioDump...');

    const { app } = require('electron');
    const path = require('path');

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

    systemAudioProc.stdout.on('data', data => {
        audioBuffer = Buffer.concat([audioBuffer, data]);

        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);

            const monoChunk = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;
            const base64Data = monoChunk.toString('base64');
            sendAudioToGemini(base64Data, geminiSessionRef);

            if (process.env.DEBUG_AUDIO) {
                console.log(`Processed audio chunk: ${chunk.length} bytes`);
                saveDebugAudio(monoChunk, 'system_audio');
            }
        }

        const maxBufferSize = SAMPLE_RATE * BYTES_PER_SAMPLE * 1;
        if (audioBuffer.length > maxBufferSize) {
            audioBuffer = audioBuffer.slice(-maxBufferSize);
        }
    });

    systemAudioProc.stderr.on('data', data => {
        console.error('SystemAudioDump stderr:', data.toString());
    });

    systemAudioProc.on('close', code => {
        console.log('SystemAudioDump process closed with code:', code);
        systemAudioProc = null;
    });

    systemAudioProc.on('error', err => {
        console.error('SystemAudioDump process error:', err);
        systemAudioProc = null;
    });

    return true;
}

function convertStereoToMono(stereoBuffer) {
    const samples = stereoBuffer.length / 4;
    const monoBuffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const leftSample = stereoBuffer.readInt16LE(i * 4);
        monoBuffer.writeInt16LE(leftSample, i * 2);
    }

    return monoBuffer;
}

function stopMacOSAudioCapture() {
    if (systemAudioProc) {
        console.log('Stopping SystemAudioDump...');
        systemAudioProc.kill('SIGTERM');
        systemAudioProc = null;
    }
}

async function sendAudioToGemini(base64Data, geminiSessionRef) {
    if (!geminiSessionRef.current) return;

    try {
        // process.stdout.write('.');
        await geminiSessionRef.current.sendRealtimeInput({
            audio: {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            },
        });
    } catch (error) {
        console.error('Error sending audio to Gemini:', error);
    }
}

function setupGeminiIpcHandlers(geminiSessionRef) {
    // Store the geminiSessionRef globally for reconnection access
    global.geminiSessionRef = geminiSessionRef;

    ipcMain.handle('initialize-gemini', async (event, profile = 'interview', language = 'en-US', customPrompt = '', resumeContext = '', apiKey = null) => {
        console.log('IPC initialize-gemini called with:', { profile, language, hasCustomPrompt: !!customPrompt, hasResume: !!resumeContext, hasApiKey: !!apiKey });
        const session = await initializeGeminiSession(apiKey, customPrompt, resumeContext, profile, language);
        if (session) {
            geminiSessionRef.current = session;
            return true;
        }
        return false;
    });

    ipcMain.handle('send-audio-content', async (event, { data, mimeType }) => {
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };
        try {
            // process.stdout.write('.');
            if (isFirstChunk && !lastRequestTime) {
                lastRequestTime = Date.now();
            }
            await geminiSessionRef.current.sendRealtimeInput({
                audio: { data: data, mimeType: mimeType },
            });
            return { success: true };
        } catch (error) {
            console.error('Error sending audio:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-image-content', async (event, { data, debug }) => {
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };

        try {
            if (!data || typeof data !== 'string') {
                console.error('Invalid image data received');
                return { success: false, error: 'Invalid image data' };
            }

            const buffer = Buffer.from(data, 'base64');

            if (buffer.length < 1000) {
                console.error(`Image buffer too small: ${buffer.length} bytes`);
                return { success: false, error: 'Image buffer too small' };
            }

            // process.stdout.write('!');
            lastRequestTime = Date.now();
            isFirstChunk = true;
            await geminiSessionRef.current.sendRealtimeInput({
                media: { data: data, mimeType: 'image/jpeg' },
            });

            return { success: true };
        } catch (error) {
            console.error('Error sending image:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-text-message', async (event, text) => {
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };

        try {
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                return { success: false, error: 'Invalid text message' };
            }

            console.log('Sending text message:', text);
            lastRequestTime = Date.now();
            isFirstChunk = true;
            await geminiSessionRef.current.sendRealtimeInput({ text: text.trim() });
            return { success: true };
        } catch (error) {
            console.error('Error sending text:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-macos-audio', async event => {
        if (process.platform !== 'darwin') {
            return {
                success: false,
                error: 'macOS audio capture only available on macOS',
            };
        }

        try {
            const success = await startMacOSAudioCapture(geminiSessionRef);
            return { success };
        } catch (error) {
            console.error('Error starting macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async event => {
        try {
            stopMacOSAudioCapture();
            return { success: true };
        } catch (error) {
            console.error('Error stopping macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async event => {
        try {
            stopMacOSAudioCapture();

            // Clear session params to prevent reconnection when user closes session
            lastSessionParams = null;

            // Cleanup any pending resources and stop audio/video capture
            if (geminiSessionRef.current) {
                await geminiSessionRef.current.close();
                geminiSessionRef.current = null;
            }

            return { success: true };
        } catch (error) {
            console.error('Error closing session:', error);
            return { success: false, error: error.message };
        }
    });

    // Conversation history IPC handlers
    ipcMain.handle('get-current-session', async event => {
        try {
            return { success: true, data: getCurrentSessionData() };
        } catch (error) {
            console.error('Error getting current session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-new-session', async event => {
        try {
            initializeNewSession();
            return { success: true, sessionId: currentSessionId };
        } catch (error) {
            console.error('Error starting new session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-google-search-setting', async (event, enabled) => {
        try {
            console.log('Google Search setting updated to:', enabled);
            // The setting is already saved in localStorage by the renderer
            // This is just for logging/confirmation
            return { success: true };
        } catch (error) {
            console.error('Error updating Google Search setting:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = {
    initializeGeminiSession,
    getEnabledTools,
    getStoredSetting,
    sendToRenderer,
    initializeNewSession,
    saveConversationTurn,
    getCurrentSessionData,
    sendReconnectionContext,
    killExistingSystemAudioDump,
    startMacOSAudioCapture,
    convertStereoToMono,
    stopMacOSAudioCapture,
    sendAudioToGemini,
    setupGeminiIpcHandlers,
    attemptReconnection,
};
