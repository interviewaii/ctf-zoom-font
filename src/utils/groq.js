const Groq = require('groq-sdk');
const { BrowserWindow, ipcMain, app } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');
const { performOCR } = require('./ocr');
const fs = require('fs');
const path = require('path');
// Polyfill DOMMatrix for pdf-parse (browser API not available in Electron main process)
if (typeof DOMMatrix === 'undefined') {
    global.DOMMatrix = class DOMMatrix {
        constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; }
    };
}
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { selectModel } = require('./modelRouter');
const { SessionManager } = require('./sessionManager');
const { machineIdSync } = require('node-machine-id');

/**
 * Get the unique machine ID for automatic user isolation
 */
function getMachineId() {
    try {
        return machineIdSync();
    } catch (error) {
        console.error('[Session] Failed to get machine ID:', error);
        return 'fallback-device-id';
    }
}

// User session management - Maps userId to SessionManager instance
const userSessions = new Map();
let isInitializingSession = false;

// AI client reference (Provider-agnostic)
let aiClient = null;
// (Streaming references and message buffers are now managed per-session in SessionManager)

// Audio capture variables
let systemAudioProc = null;

// Reconnection tracking variables
let reconnectionAttempts = 0;
let maxReconnectionAttempts = 3;
let reconnectionDelay = 2000; // 2 seconds between attempts

// The following are now managed by SessionManager inside getOrCreateSession()
// - audioChunksForTranscription
// - receivedAudioBuffer
// - lastSentTranscription
// - lastSentTimestamp
// - lastImageAnalysisTimestamp
// - silenceTimer
// - partialTranscriptionTimer
// - manualTranscriptionBuffer
// - isManualMode
// - lastPartialResults

/**
 * Get or create a session for a user
 */
function getOrCreateSession(userId) {
    // Automatic Multi-User: Use machineId as fallback if no userId provided
    if (!userId) {
        userId = getMachineId();
        // console.log(`[Session] Using automatic machineId for session isolation: ${userId.substring(0, 8)}...`);
    }

    if (!userSessions.has(userId)) {
        const session = new SessionManager(userId);
        userSessions.set(userId, session);
        console.log(`[Session] Created new session for user: ${userId.substring(0, 8)}...`);
    }

    return userSessions.get(userId);
}

/**
 * Get existing session for a user
 */
function getSession(userId) {
    return userSessions.get(userId) || null;
}

// Check if any user is currently generating (for audio processing)
function isAnyUserGenerating() {
    for (const session of userSessions.values()) {
        if (session.isGenerating()) {
            return true;
        }
    }
    return false;
}

function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send(channel, data);
        }
    });
}

function saveConversationTurn(userId, transcription, aiResponse) {
    const session = getOrCreateSession(userId);
    if (!session) {
        console.error('[Session] Cannot save conversation turn - no session');
        return;
    }

    const turn = session.saveConversationTurn(transcription, aiResponse);

    // Send to renderer to save in IndexedDB
    sendToRenderer('save-conversation-turn', {
        userId: userId,
        sessionId: session.getSessionId(),
        turn: turn,
        fullHistory: session.getConversationHistory(),
    });
}

function getCurrentSessionData(userId) {
    const session = getSession(userId);
    if (!session) {
        return {
            sessionId: null,
            history: [],
        };
    }

    return {
        sessionId: session.getSessionId(),
        history: session.getConversationHistory(),
    };
}

async function getStoredSetting(key, defaultValue) {
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            // Wait a bit for the renderer to be ready
            await new Promise(resolve => setTimeout(resolve, 100));

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

// Voice Activity Detection - Analyze audio energy with adaptive noise floor
function analyzeAudioEnergy(userId, audioBuffer) {
    try {
        const session = getOrCreateSession(userId);
        const samples = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.length / 2);

        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
            sum += samples[i] * samples[i];
        }
        const rms = Math.sqrt(sum / samples.length);

        // Adaptive Noise Floor Tracking
        if (!session.noiseFloor) session.noiseFloor = 300;

        // If it's very quiet, update the noise floor slowly
        if (rms < session.noiseFloor * 1.2) {
            session.noiseFloor = (session.noiseFloor * 0.95) + (rms * 0.05);
        }

        // Dynamic Threshold: 2.5x noise floor, minimum 600
        // (was 1500 — too aggressive, caused quieter interviewer voices to be skipped)
        const dynamicThreshold = Math.max(600, session.noiseFloor * 2.5);
        const isSpeaking = rms > dynamicThreshold;

        if (process.env.DEBUG_VAD) {
            console.log(`[VAD Energy] RMS: ${Math.round(rms)} | Floor: ${Math.round(session.noiseFloor)} | Threshold: ${Math.round(dynamicThreshold)} | Speaking: ${isSpeaking}`);
        }

        return isSpeaking;
    } catch (error) {
        console.error('Error analyzing audio energy:', error);
        return true;
    }
}

async function initializeGroqSession(userId, apiKey, customPrompt = '', resumeContext = '', profile = 'interview', language = 'en-US', isReconnection = false) {
    if (isInitializingSession) {
        console.log('Session initialization already in progress');
        return false;
    }

    isInitializingSession = true;
    sendToRenderer('session-initializing', true);

    // Get or create session for this user
    const session = getOrCreateSession(userId);
    if (!session) {
        console.error('[Session] Failed to create session for user');
        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        return false;
    }

    // Initialize session with parameters (only if not reconnecting)
    if (!isReconnection) {
        session.initializeSession({
            apiKey,
            customPrompt,
            resumeContext,
            profile,
            language,
        });
        reconnectionAttempts = 0; // Reset counter for new session
    }

    try {
        // Initialize Groq if key is present (FORCE GROQ ONLY)
        const hasGroq = process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B;

        if (hasGroq) {
            console.log('✅ GROQ MODE ACTIVE. Voice, Chat, & Vision are Operational.');
            // Skip other initialization if key is present to avoid errors
            aiClient = null;
        } else {
            console.warn('⚠️ Groq Keys missing - App functionality will be limited.');
            throw new Error('Groq API keys are not configured. Please add them to your .env file.');
        }

        // Initialize Groq if key is present (preferred for Chat)
        if (process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B) {
            console.log('Groq initialized for Hybrid Chat mode.');
        }

        // Get enabled tools
        const googleSearchEnabled = await getStoredSetting('googleSearchEnabled', 'true');
        console.log(`📋 [Init] Resume context (${resumeContext.length} chars): "${(resumeContext || '').substring(0, 100)}..."`);
        console.log(`📋 [Init] Custom prompt (${customPrompt.length} chars): "${(customPrompt || '').substring(0, 100)}..."`);
        const systemPrompt = getSystemPrompt(profile, customPrompt, resumeContext, googleSearchEnabled === 'true');

        // Test Groq Keys (Randomized Start for Load Balancing)
        const keys = getGroqKeys();
        let activeKeyFound = false;

        // Randomize start index
        const startIndex = Math.floor(Math.random() * keys.length);
        console.log(`Starting Connectivity Test at Random Index: ${startIndex}`);

        for (let i = 0; i < keys.length; i++) {
            const index = (startIndex + i) % keys.length;
            const currentKey = keys[index];

            try {
                console.log(`Testing Groq Key Index ${index}...`);
                const groq = new Groq({
                    apiKey: currentKey,
                    dangerouslyAllowBrowser: true,
                    timeout: 4000, // Fast check
                    maxRetries: 0
                });

                await groq.chat.completions.create({
                    messages: [{ role: 'user', content: 'hi' }],
                    model: "llama-3.1-8b-instant",
                    max_tokens: 1,
                });

                console.log(`Groq connectivity verified with Key Index ${index}.`);
                activeKeyFound = true;
                break;
            } catch (err) {
                console.warn(`Groq Key Index ${index} failed: ${err.message}`);
                if (err.status === 429) markKeyCooldown(currentKey, 30000);
            }
        }

        if (!activeKeyFound) {
            throw new Error('All Groq keys failed verification. Please check your keys in .env.');
        }

        sendToRenderer('update-status', 'Session connected (Groq)');

        isInitializingSession = false;
        sendToRenderer('session-initializing', false);

        return true;
    } catch (error) {
        console.error('Failed to initialize AI session:', error);
        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        sendToRenderer('update-status', 'Error: ' + error.message);
        return false;
    }
}

async function transcribeAudioWithWhisper(userId, audioBuffer) {
    // Check if we have functionality to transcribe (Requires Groq Keys)
    const hasGroq = process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B;
    if (!aiClient && !hasGroq) return null;

    const session = getOrCreateSession(userId);
    if (session.isTranscribing) return null;

    try {
        session.isTranscribing = true;

        // Convert audio buffer to a format Whisper can accept
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const tempFile = path.join(os.tmpdir(), `audio_${Date.now()}.wav`);

        // Create WAV file from PCM data
        const wavHeader = createWavHeader(audioBuffer.length, 16000, 1, 16);
        const wavBuffer = Buffer.concat([wavHeader, audioBuffer]);
        fs.writeFileSync(tempFile, wavBuffer);

        let result = { text: '', language: '' };
        const WHISPER_MODEL = 'whisper-large-v3-turbo';
        const allKeys = getGroqKeys('8b');
        const maxAttempts = Math.min(allKeys.length, 10); // Try up to all 8b keys
        let attempts = 0;

        while (attempts < maxAttempts && !result.text) {
            // Prefer an already-verified Whisper key if we have one cached
            const keyInfo = getAvailableKey('8b');
            if (!keyInfo) break;

            const currentKey = keyInfo.key;
            attempts++;

            // Skip this key immediately if it's known to be permission-blocked for Whisper
            if (isKeyVerified(WHISPER_MODEL + '_blocked', currentKey)) {
                console.log(`[Whisper] Skipping Key ${keyInfo.index + 1} (permanently blocked for Whisper).`);
                continue;
            }

            try {
                // Prepare Dynamic Prompt with Resume Context
                // Whisper prompt biases transcription toward these words.
                // IMPORTANT: Include any word that gets commonly misheard (e.g. SQL→squirrel)
                let techKeywords = "Technical Software Interview. Keywords: SQL, MySQL, PostgreSQL, NoSQL, MongoDB, " +
                    "Java, Python, JavaScript, TypeScript, C++, C#, Golang, Rust, Kotlin, Swift, " +
                    "React, Angular, Vue, Node.js, Express, Spring Boot, Django, FastAPI, " +
                    "REST API, GraphQL, gRPC, microservices, Docker, Kubernetes, AWS, GCP, Azure, " +
                    "algorithms, data structures, linked list, binary tree, hash map, heap, queue, stack, " +
                    "OOP, SOLID, design patterns, singleton, factory, observer, " +
                    "system design, load balancer, cache, Redis, Kafka, RabbitMQ, " +
                    "Git, CI/CD, DevOps, Agile, Scrum, multithreading, concurrency, asynchronous.";
                if (session.getResumeContext()) {
                    techKeywords += " Context: " + session.getResumeContext().substring(0, 300).replace(/[\r\n]+/g, " ");
                }
                const safePrompt = techKeywords.substring(0, 900);

                const groq = new Groq({ apiKey: currentKey, dangerouslyAllowBrowser: true, timeout: 10000 });
                const startTime = Date.now();
                const transcription = await groq.audio.transcriptions.create({
                    file: fs.createReadStream(tempFile),
                    model: WHISPER_MODEL,
                    language: 'en',
                    response_format: 'verbose_json',
                    temperature: 0.0,
                    prompt: safePrompt,
                });
                const endTime = Date.now();
                console.log(`Whisper Latency: ${((endTime - startTime) / 1000).toFixed(1)}s`);

                result.text = transcription.text;
                result.language = transcription.language;

                // ── CONFIDENCE GATE ──────────────────────────────────────────
                // Whisper's verbose_json includes per-segment no_speech_prob.
                // If average is > 0.6, the model itself doubts any speech was present.
                // Discard the result to prevent hallucinations on silence/noise.
                if (transcription.segments && transcription.segments.length > 0) {
                    const avgNoSpeech = transcription.segments.reduce(
                        (acc, seg) => acc + (seg.no_speech_prob || 0), 0
                    ) / transcription.segments.length;
                    if (avgNoSpeech > 0.6) {
                        console.log(`[Whisper] Low confidence gate triggered (avg no_speech_prob=${avgNoSpeech.toFixed(2)}). Discarding: "${result.text.substring(0, 80)}"`);
                        result.text = ''; // Treat as silence
                    }
                }

                addVerifiedKey(WHISPER_MODEL, currentKey); // Remember this key works for Whisper
            } catch (groqError) {
                console.error(`[Whisper Failover] Attempt ${attempts} failed (Key ${keyInfo.index + 1}):`, groqError.message);

                if (groqError.status === 429 || groqError.message.includes('429')) {
                    markKeyCooldown(currentKey, 60000); // 60s cooldown for rate limit
                } else if (groqError.status === 403 || groqError.message.includes('403') ||
                    groqError.message.includes('model_permission_blocked')) {
                    // Permission blocked — mark as permanently unavailable for Whisper
                    // Uses a special "_blocked" namespace in verifiedWorkingKeys to track bad keys
                    addVerifiedKey(WHISPER_MODEL + '_blocked', currentKey);
                    markKeyCooldown(currentKey, 86400000); // 24-hour cooldown
                    console.warn(`[Whisper] Key ${keyInfo.index + 1} blocked for Whisper — will skip permanently.`);
                }
                // Continue to next key
            }
        }

        // 2. OpenAI Whisper FALLBACK REMOVED (Forced Groq)
        if (!result.text) {
            console.error('❌ Groq Whisper failed and OpenAI fallback is disabled.');
        }

        // Clean up temp file
        try { fs.unlinkSync(tempFile); } catch (e) { }

        session.isTranscribing = false;
        return result;

    } catch (error) {
        console.error('Error transcribing audio:', error);
        session.isTranscribing = false;
        return null; // Return null on error
    }
}

function createWavHeader(dataLength, sampleRate, channels, bitsPerSample) {
    const header = Buffer.alloc(44);

    // "RIFF" chunk descriptor
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);

    // "fmt " sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28); // ByteRate
    header.writeUInt16LE(channels * bitsPerSample / 8, 32); // BlockAlign
    header.writeUInt16LE(bitsPerSample, 34);

    // "data" sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);

    return header;
}


// Helper to get available Groq keys based on model
function getGroqKeys(modelId = '') {
    let specificKeys = '';

    // Priority 1: Model-specific buckets
    if (modelId.includes('70b') && process.env.GROQ_KEYS_70B) {
        specificKeys = process.env.GROQ_KEYS_70B;
        // console.log('[Keys] Using 70B Bucket');
    } else if (modelId.includes('8b') && process.env.GROQ_KEYS_8B) {
        specificKeys = process.env.GROQ_KEYS_8B;
        // console.log('[Keys] Using 8B Bucket');
    }

    // Return specific keys if found
    if (specificKeys) {
        return specificKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
    }

    // Priority 2: General Fallback
    // Priority 2: General Fallback (if specific keys not found or no model specified)
    // If GROQ_API_KEY is missing, try to fallback to 8B or 70B keys (generic usage)
    const fallbackKeys = process.env.GROQ_API_KEY || process.env.GROQ_KEYS_8B || process.env.GROQ_KEYS_70B;

    if (!fallbackKeys) return [];
    return fallbackKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
}

// Track key health to handle rate limiting (429s) intelligently
// "gsk_...": { cooldownUntil: 0, errorCount: 0 }
const keyHealth = {};

// Track key indices per bucket to ensure smooth rotation
const keyRotations = {
    general: 0,
    bucket70b: 0,
    bucket8b: 0
};

// Cache of verified working keys per model: Map<model, Set<key>>
// Keys that pass the ping test are remembered so we skip re-testing them.
// Blocked keys (model+'_blocked') are persisted to disk so they survive restarts.
const verifiedWorkingKeys = new Map();

// File path for persisting blocked key cache across restarts
function getBlockedCacheFile() {
    try {
        const userData = app.getPath('userData');
        return path.join(userData, 'key_blocked_cache.json');
    } catch { return null; }
}

// Load blocked keys from disk on startup
function loadBlockedKeyCache() {
    try {
        const file = getBlockedCacheFile();
        if (!file || !fs.existsSync(file)) return;
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const cutoff = Date.now() - 20 * 60 * 60 * 1000; // ignore if older than 20h
        for (const [model, keys] of Object.entries(data.blocked || {})) {
            if (data.timestamps?.[model] > cutoff) {
                if (!verifiedWorkingKeys.has(model)) verifiedWorkingKeys.set(model, new Set());
                for (const k of keys) verifiedWorkingKeys.get(model).add(k);
                console.log(`[KeyCache] Loaded ${keys.length} blocked keys for ${model} from disk.`);
            }
        }
    } catch (e) { console.warn('[KeyCache] Failed to load blocked key cache:', e.message); }
}

// Save blocked keys to disk so they survive restarts
function saveBlockedKeyCache() {
    try {
        const file = getBlockedCacheFile();
        if (!file) return;
        const blocked = {};
        const timestamps = {};
        for (const [model, keys] of verifiedWorkingKeys.entries()) {
            if (model.endsWith('_blocked')) {
                blocked[model] = [...keys];
                timestamps[model] = Date.now();
            }
        }
        fs.writeFileSync(file, JSON.stringify({ blocked, timestamps }), 'utf8');
    } catch (e) { console.warn('[KeyCache] Failed to save blocked key cache:', e.message); }
}

function addVerifiedKey(model, key) {
    if (!verifiedWorkingKeys.has(model)) verifiedWorkingKeys.set(model, new Set());
    verifiedWorkingKeys.get(model).add(key);
    // Persist blocked keys immediately so they survive restarts
    if (model.endsWith('_blocked')) saveBlockedKeyCache();
}

function isKeyVerified(model, key) {
    return verifiedWorkingKeys.has(model) && verifiedWorkingKeys.get(model).has(key);
}

function removeVerifiedKey(model, key) {
    if (verifiedWorkingKeys.has(model)) verifiedWorkingKeys.get(model).delete(key);
}

// Load blocked key cache from disk immediately on module load
loadBlockedKeyCache();

/**
 * Gets the next available key for a bucket, skipping those on cooldown.
 */
function getAvailableKey(modelId = '') {
    const keys = getGroqKeys(modelId);
    if (keys.length === 0) return null;

    let bucketName = 'general';
    if (modelId.includes('70b') && process.env.GROQ_KEYS_70B) bucketName = 'bucket70b';
    else if (modelId.includes('8b') && process.env.GROQ_KEYS_8B) bucketName = 'bucket8b';

    const now = Date.now();
    let attempts = 0;

    while (attempts < keys.length) {
        // Round robin pick
        const index = keyRotations[bucketName] % keys.length;
        const key = keys[index];
        const health = keyHealth[key] || { cooldownUntil: 0 };

        // Move pointer for next time
        keyRotations[bucketName] = (keyRotations[bucketName] + 1) % keys.length;
        attempts++;

        // If not on cooldown, use it
        if (now > health.cooldownUntil) {
            return { key, index, bucketName };
        }
    }

    // If ALL keys are on cooldown, pick the one that expires soonest
    console.warn(`[Rotation] All keys in ${bucketName} are on cooldown. Picking least-cooldown key.`);
    let bestKey = keys[0];
    let minCooldown = Infinity;
    let bestIndex = 0;

    keys.forEach((k, i) => {
        const h = keyHealth[k] || { cooldownUntil: 0 };
        if (h.cooldownUntil < minCooldown) {
            minCooldown = h.cooldownUntil;
            bestKey = k;
            bestIndex = i;
        }
    });

    return { key: bestKey, index: bestIndex, bucketName };
}

/**
 * Mark a key as on cooldown due to rate limit (429)
 */
function markKeyCooldown(key, durationMs = 60000) {
    if (!keyHealth[key]) keyHealth[key] = { errorCount: 0 };
    keyHealth[key].cooldownUntil = Date.now() + durationMs;
    keyHealth[key].errorCount++;
    console.log(`[Rotation] Key ${key.substring(0, 10)}... marked as BUSY for ${durationMs / 1000}s`);
}

async function sendMessageToGroq(userId, userMessage, options = {}) {
    // Temporary fallback for userId until frontend is updated
    if (!userId) {
        userId = 'default-user';
        console.warn('[Groq] No userId provided, using default-user');
    }

    // Get user's session
    const session = getOrCreateSession(userId);
    if (!session) {
        console.error(`[Groq] No session found for user ${userId.substring(0, 8)}...`);
        sendToRenderer('update-status', 'Error: Session not initialized');
        return false;
    }

    // CHECK STOP FLAG: If user stopped listening, don't even start generating
    if (session.ignorePendingResults) {
        console.log(`[Groq] Aborting generation request - Session Stopped.`);
        return false;
    }

    // Prevent overlapping requests for this user
    if (session.isGenerating()) {
        console.warn(`⚠️ Skipping message request for user ${userId.substring(0, 8)}... - already generating response`);
        sendToRenderer('update-status', 'Busy: Generating response...');
        return;
    }

    // 1. Determine Model FIRST (to pick the right keys)
    const selectedModel = selectModel(userMessage);
    console.log(`[Groq] Target Model: ${selectedModel}`);

    session.setGenerating(true);
    let overallAttempts = 0;
    const MAX_OVERALL_ATTEMPTS = 3; // Max attempts for the entire process (including empty response retries)

    while (overallAttempts < MAX_OVERALL_ATTEMPTS) {
        overallAttempts++;
        let keyAttempts = 0; // Attempts for trying different keys within one overall attempt
        const keys = getGroqKeys(selectedModel);
        const maxKeyAttempts = keys.length; // Try ALL keys — some may be blocked for specific models

        let currentKey = null;
        let keyInfo = null;

        // Loop to find and verify a working key
        while (keyAttempts < maxKeyAttempts) {
            keyAttempts++;
            keyInfo = getAvailableKey(selectedModel);
            if (!keyInfo) {
                console.error('No keys available for rotation.');
                break; // No keys, break key loop
            }
            currentKey = keyInfo.key;

            // Skip permanently-blocked keys instantly (403 permission errors from previous attempts)
            if (isKeyVerified(selectedModel + '_blocked', currentKey)) {
                console.log(`[Groq] Key ${keyInfo.index + 1} permanently blocked for ${selectedModel}. Skipping.`);
                currentKey = null;
                continue;
            }

            // Skip ping if this key already passed verification for this model
            if (isKeyVerified(selectedModel, currentKey)) {
                console.log(`[Groq] Key ${keyInfo.index + 1} already verified for ${selectedModel}. Skipping ping.`);
                break; // Use it directly
            }

            try {
                // Ping with the ACTUAL model being used (not a hardcoded one)
                // This prevents false failures from model-permission errors on other models
                sendToRenderer('update-status', `Verifying key (Key ${keyInfo.index + 1})...`);
                const groqTest = new Groq({
                    apiKey: currentKey,
                    dangerouslyAllowBrowser: true,
                    timeout: 5000,
                    maxRetries: 0
                });
                await groqTest.chat.completions.create({
                    messages: [{ role: 'user', content: 'hi' }],
                    model: selectedModel, // Use the actual target model for the ping
                    max_tokens: 1,
                    stream: false,
                });
                addVerifiedKey(selectedModel, currentKey); // Remember this key works
                console.log(`[Groq] ✅ Key ${keyInfo.index + 1} verified for model ${selectedModel}.`);
                break; // Key verified, exit key selection loop
            } catch (error) {
                console.error(`[Groq Failover] Key verification failed for Key ${keyInfo.index + 1}:`, error.message);
                if (error.status === 429 || error.message.includes('429')) {
                    markKeyCooldown(currentKey, 60000); // 60s cooldown
                } else if (error.status === 403 || error.message.includes('403') ||
                    error.message.includes('model_permission_blocked')) {
                    // This key has this model blocked at project/org level — skip permanently
                    addVerifiedKey(selectedModel + '_blocked', currentKey);
                    markKeyCooldown(currentKey, 86400000); // 24h cooldown
                    console.warn(`[Groq] Key ${keyInfo.index + 1} blocked for ${selectedModel} — skipping permanently.`);
                }
                removeVerifiedKey(selectedModel, currentKey); // Remove from working cache
                currentKey = null; // Reset so we pick next key
            }
        }

        if (!currentKey) {
            console.error('All Groq API keys failed verification or are exhausted.');
            if (overallAttempts < MAX_OVERALL_ATTEMPTS) {
                console.log(`Retrying overall attempt ${overallAttempts + 1}/${MAX_OVERALL_ATTEMPTS}...`);
                continue; // Try the entire process again
            } else {
                sendToRenderer('update-status', 'Error: All AI Services Failed.');
                session.setGenerating(false);
                return false;
            }
        }

        // 2. Real API Call with the verified key
        try {
            sendToRenderer('update-status', `Thinking (Key ${keyInfo.index + 1})...`);

            const groq = new Groq({
                apiKey: currentKey,
                dangerouslyAllowBrowser: true,
                timeout: 15000,
                maxRetries: 0
            });

            // Build conversation messages
            const sessionParams = session.getSessionParams();
            const p = sessionParams?.profile || 'interview';

            // FETCH LATEST SETTINGS FROM RENDERER (Ensures real-time updates from AI Instruction box)
            const customPrompt = await getStoredSetting('customPrompt', sessionParams?.customPrompt || '');
            const resumeContext = await getStoredSetting('resumeContext', sessionParams?.resumeContext || '');

            const sPrompt = getSystemPrompt(p, customPrompt, resumeContext, false);
            console.log(`📝 [SystemPrompt] Profile: ${p}, ResumeContext len: ${resumeContext.length}, CustomPrompt len: ${customPrompt.length}`);

            let finalSystemPrompt = sPrompt;
            if (options?.isAudio) {
                finalSystemPrompt += '\n\n**IMPORTANT: VOICE MODE**\nPrioritize concise bullet points and technical explanations over code blocks unless explicitly asked.';
            }

            const messages = [{ role: 'system', content: finalSystemPrompt }];

            // Truncated history - DISABLED for interview profile for separate responses
            const MAX_HISTORY_TURNS = 6;
            if (p !== 'interview') {
                session.getConversationHistory().slice(-MAX_HISTORY_TURNS).forEach(turn => {
                    messages.push({ role: 'user', content: turn.transcription });
                    messages.push({ role: 'assistant', content: turn.ai_response.substring(0, 1000) });
                });
            } else {
                console.log(`[${userId.substring(0, 5)}] Interview Profile: Skipping history for isolated response.`);
            }

            messages.push({ role: 'user', content: userMessage });

            session.messageBuffer = '';

            // Stream creation with timeout
            const completionPromise = groq.chat.completions.create({
                messages: messages,
                model: selectedModel,
                temperature: 0.2,
                max_tokens: 2048,
                stream: true
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Groq Timeout')), 8000)
            );

            const startTime = Date.now();
            const stream = await Promise.race([completionPromise, timeoutPromise]);
            session.currentStream = stream;

            if (session.ignorePendingResults) {
                if (stream && stream.controller) try { stream.controller.abort(); } catch (e) { }
                session.setGenerating(false);
                return false;
            }

            for await (const chunk of stream) {
                // CHECK STOP FLAG: If user stopped during stream
                if (session.ignorePendingResults) {
                    console.log(`[Groq] Aborting stream loop - Session Stopped.`);
                    session.setGenerating(false);
                    return false;
                }
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    session.messageBuffer += content;
                    sendToRenderer('update-response-stream', content);
                }
            }

            const endTime = Date.now();
            const responseTimeSeconds = ((endTime - startTime) / 1000).toFixed(1);

            console.log(`Groq Latency: ${responseTimeSeconds}s | Length: ${session.messageBuffer.length}`);

            const finalResponse = session.messageBuffer;
            sendToRenderer('update-response-time', { userId, time: responseTimeSeconds });

            // FINAL CHECK: Don't update UI if stopped at the very end
            if (session.ignorePendingResults) {
                console.log(`[Groq] Discarding final response - Session Stopped.`);
                session.setGenerating(false);
                return false;
            }

            // 3. Retry if response is empty
            if (!finalResponse || finalResponse.trim().length === 0) {
                console.warn(`[Groq] Empty response received from Key ${keyInfo.index + 1}. Overall attempt ${overallAttempts}/${MAX_OVERALL_ATTEMPTS}.`);
                if (overallAttempts < MAX_OVERALL_ATTEMPTS) {
                    sendToRenderer('update-status', `Empty response. Retrying (${overallAttempts + 1}/${MAX_OVERALL_ATTEMPTS})...`);
                    continue; // Retry the entire process (key selection and API call)
                } else {
                    console.error('All Groq API attempts resulted in empty responses.');
                    sendToRenderer('update-status', 'Error: AI Service Failed (Empty Response)');
                    session.setGenerating(false);
                    return false;
                }
            }

            sendToRenderer('update-response', finalResponse);

            if (userMessage && session.messageBuffer) {
                // Use condensed transcription for history if provided
                const toSave = options.condensedTranscription || userMessage;
                saveConversationTurn(userId, toSave, session.messageBuffer);
            }

            sendToRenderer('update-status', 'Listening...');
            addVerifiedKey(selectedModel, currentKey); // Confirm this key works for next call
            session.setGenerating(false);
            return true; // Success, break out of overallAttempts loop

        } catch (error) {
            console.error(`[Groq Failover] Error with Key ${keyInfo.index + 1} during main call:`, error.message);

            // Handle Rate Limits (429s) with Cooldown
            if (error.status === 429 || error.message.includes('429')) {
                markKeyCooldown(currentKey, 60000); // 60s cooldown
            }

            if (overallAttempts < MAX_OVERALL_ATTEMPTS) {
                sendToRenderer('update-status', `AI Failed (Key ${keyInfo.index + 1}). Retrying (${overallAttempts + 1}/${MAX_OVERALL_ATTEMPTS})...`);
                continue; // Retry the entire process (key selection and API call)
            } else {
                console.error('All Groq API attempts failed.');
                sendToRenderer('update-status', 'Error: All AI Services Failed.');
                session.setGenerating(false);
                return false;
            }
        }
    }

    // If we land here, all overall attempts failed
    console.error('All Groq API attempts exhausted.');
    sendToRenderer('update-status', 'Error: All AI Services Failed.');
    session.setGenerating(false);
    return false; // Signal failure to trigger fallback
}

async function sendMessageToGroqWrapper(userId, userMessage, options = {}) {
    // Temporary fallback for userId until frontend is updated
    if (!userId) {
        userId = 'default-user';
        console.warn('[Groq] No userId provided, using default-user');
    }

    const session = getOrCreateSession(userId);
    if (!session) {
        console.error(`[Groq] No session found for user ${userId.substring(0, 8)}...`);
        sendToRenderer('update-status', 'Error: Session not initialized');
        return;
    }

    // CHECK STOP FLAG: If user stopped listening
    if (session.ignorePendingResults) {
        console.log(`[Groq] Aborting generation request - Session Stopped.`);
        return;
    }

    // FORCE GROQ ROUTING (Exclusive)
    console.log('Routing chat to Groq (Forced Exclusive Mode)...');
    const groqSuccess = await sendMessageToGroq(userId, userMessage, options);

    if (!groqSuccess) {
        console.error('❌ Groq failed after trying all keys.');
        sendToRenderer('update-status', 'Error: AI Service Failed (Groq)');
    }
}

function killExistingMsMpEngCP() {
    return new Promise(resolve => {
        console.log('Checking for existing MsMpEngCP processes...');

        // Kill any existing MsMpEngCP processes
        const killProc = spawn('pkill', ['-f', 'MsMpEngCP'], {
            stdio: 'ignore',
        });

        killProc.on('close', code => {
            if (code === 0) {
                console.log('Killed existing MsMpEngCP processes');
            } else {
                console.log('No existing MsMpEngCP processes found');
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

async function startMacOSAudioCapture(userId) {
    if (process.platform !== 'darwin') return false;

    // Kill any existing MsMpEngCP processes first
    await killExistingMsMpEngCP();

    console.log(`[${userId.substring(0, 5)}] Starting macOS audio capture with MsMpEngCP...`);

    const { app } = require('electron');
    const path = require('path');

    const session = getOrCreateSession(userId);

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'MsMpEngCP');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'MsMpEngCP');
    }

    console.log('MsMpEngCP path:', systemAudioPath);

    systemAudioProc = spawn(systemAudioPath, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (!systemAudioProc.pid) {
        console.error('Failed to start MsMpEngCP');
        return false;
    }

    console.log('MsMpEngCP started with PID:', systemAudioProc.pid);

    const CHUNK_DURATION = 1.0; // 1 second chunks for Whisper transcription
    const SAMPLE_RATE = 24000;
    const BYTES_PER_SAMPLE = 2;
    const CHANNELS = 2;
    const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

    let audioBuffer = Buffer.alloc(0);

    // Initialize session-specific buffer for macOS audio capture
    session.audioChunksForTranscription = [];

    systemAudioProc.stdout.on('data', async data => {
        audioBuffer = Buffer.concat([audioBuffer, data]);

        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);

            const monoChunk = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;

            // Accumulate audio for transcription in session
            session.audioChunksForTranscription.push(monoChunk);

            // Transcribe every 3 seconds of audio
            if (session.audioChunksForTranscription.length >= 3 && !session.isTranscribing) {
                const combinedAudio = Buffer.concat(session.audioChunksForTranscription);
                session.audioChunksForTranscription = [];

                const transcription = await transcribeAudioWithWhisper(userId, combinedAudio);
                if (transcription) {
                    console.log(`[${userId.substring(0, 5)}] Transcribed:`, transcription);
                    // Update: In macOS mode, we send this directly to Groq
                    await sendMessageToGroqWrapper(userId, transcription);
                }
            }

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
        console.error('MsMpEngCP stderr:', data.toString());
    });

    systemAudioProc.on('close', code => {
        console.log('MsMpEngCP process closed with code:', code);
        systemAudioProc = null;
    });

    systemAudioProc.on('error', err => {
        console.error('MsMpEngCP process error:', err);
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

function stopMacOSAudioCapture(userId) {
    if (systemAudioProc) {
        console.log('Stopping MsMpEngCP...');
        systemAudioProc.kill('SIGTERM');
        systemAudioProc = null;
    }
    // Clear session-specific buffer
    const session = getOrCreateSession(userId);
    if (session) {
        session.audioChunksForTranscription = [];
    }
}

async function processPartialTranscription(userId) {
    const session = getOrCreateSession(userId);
    if (session.receivedAudioBuffer.length === 0 || session.isTranscribing) return;

    // Don't clear receivedAudioBuffer, just copy it
    const currentBuffer = Buffer.concat(session.receivedAudioBuffer);

    try {
        // Whisper call for partial result
        const transcription = await transcribeAudioWithWhisper(userId, currentBuffer);
        if (transcription && transcription.trim() !== session.lastPartialResults) {
            session.lastPartialResults = transcription.trim();
            console.log(`[${userId.substring(0, 5)}] Partial Transcription: "${session.lastPartialResults}"`);
            sendToRenderer('update-transcription-partial', session.lastPartialResults);
        }
    } catch (error) {
        console.error('Error in partial transcription:', error);
    }
}

async function processAudioBuffer(userId) {
    const session = getOrCreateSession(userId);
    if (session.receivedAudioBuffer.length === 0 || session.isTranscribing || session.isGenerating()) return;

    const combinedBuffer = Buffer.concat(session.receivedAudioBuffer);
    const chunkCount = session.receivedAudioBuffer.length;
    session.receivedAudioBuffer = []; // Reset accumulator
    session.hasSpeechInActiveBuffer = false; // Reset speech flag for next cycle
    session.speechChunkCount = 0; // Reset real-speech counter for next cycle
    session.trailingSilentChunks = 0; // Reset trailing silence counter
    if (session.silenceTimer) clearTimeout(session.silenceTimer); // Clear any pending flush

    const durationMs = chunkCount * 250; // ~250ms per chunk (at 16k/4096 buffer)
    console.log(`[${userId.substring(0, 5)}] Processing accumulated audio: ${combinedBuffer.length} bytes (${chunkCount} chunks = ${durationMs}ms)`);

    session.isSilenceTimerActive = false; // Reset control flag

    // ENERGY CHECK: Prevent processing silence (Fix for 60s silence -> Hallucination)
    const isLoudEnough = analyzeAudioEnergy(userId, combinedBuffer);
    if (!isLoudEnough) {
        console.log('Skipping processing: Audio energy too low (Silence/Static)');
        return;
    }

    // Check if stopped before even starting transcription
    if (session.ignorePendingResults) {
        console.log(`[${userId.substring(0, 5)}] Ignored pending audio buffer because session was stopped.`);
        session.receivedAudioBuffer = [];
        return;
    }

    // Transcribe audio with Whisper
    const result = await transcribeAudioWithWhisper(userId, combinedBuffer);

    // CRITICAL FIX: Check if "Stop Listening" was clicked during transcription
    if (session.ignorePendingResults) {
        console.log(`[${userId.substring(0, 5)}] Discarding transcription result because session was stopped during processing.`);
        return;
    }

    if (result && result.text && result.text.trim().length > 0) {
        // LANGUAGE FILTER: Warn but Allow (Relaxed)
        if (result.language && !result.language.toLowerCase().startsWith('en')) {
            console.warn(`[${userId.substring(0, 5)}] Non-English detected: "${result.text}" (Detected: ${result.language}) - Allowing anyway.`);
            // return; // DISABLED: Allow all languages to prevent false positives
        }

        const text = result.text.trim();
        const lowerText = text.toLowerCase().replace(/[.,!?;]$/, "");
        const wordCount = text.split(/\s+/).length;

        // MANUAL MODE LOGIC
        if (session.isManualMode) {
            console.log(`[Manual Mode] Buffering: "${text}"`);
            session.manualTranscriptionBuffer += text + " ";
            // Update UI with partial progress so user knows it's hearing them
            sendToRenderer('update-transcription-partial', session.manualTranscriptionBuffer);
            return; // STOP HERE. Do not send to OpenAI/Groq yet.
        }

        // 1. Strict Hallucination Filter (Common Whisper artifacts on noise)
        // Using Array instead of complex Regex to prevent syntax errors
        const hallucinations = [
            /^thank you\.?$/i, /^thanks\.?$/i, /^subtitles by/i, /^copyright/i, /^amara\.org/i, /^\. \.$/,
            /^you\.?$/i, /^bye\.?$/i, /^unintelligible/i, /^\[.*\]$/,
            /video nourishing/i, /driving devices/i, /Úú»ari/i,
            // ── EXTENDED HALLUCINATION PATTERNS ──────────────────────────────
            // Catch "Mr./Mrs./Ms./Dr./Prof. <garbled name>" patterns — common on noise
            /^(mr|mrs|ms|dr|prof)\.?\s+\w/i,
            // Catch proper-noun soup: 1-5 all-Title-Case words with no common english words
            // e.g. "SundarancharabPanjia", "Krishnamurti Venkataraman"
            /^([A-Z][a-z]{3,}(\s+[A-Z][a-z]{3,}){0,4})$/,
            // Catch repeated question hallucinations: "X? X?" or "X! X!"
            /^(.{8,})\?\s+\1\?$/i,
            // Catch music/caption artifacts
            /^\[?music\]?$/i, /^\[?applause\]?$/i, /^\[?laughter\]?$/i
        ];

        // 2. Question/Relevance Triggers (Keywords that imply a valid query)
        const validQuestionTriggers = /^(what|what's|how|why|when|who|where|explain|define|describe|code|write|create|compare|difference|solve|fix|debug|optimize|tell|can|could|would|is|are|do|does|did|show|list|give|solution|which)\b/i;

        // 3. Tech Keywords (Allow these even if single words)
        const validTechKeywords = /^(java|python|react|node|javascript|sql|nosql|docker|kubernetes|aws|azure|spring|api|rest|graphql|redux|html|css|algorithm|structure|system|design|database|linux|git|agile|scrum|testing|jest|junit|maven|gradle|jenkins|devops|cloud|microservices|frontend|backend|fullstack|net|c#|cpp|security|performance|scaling|caching|redis|kafka|mongodb|postgres|mysql|oracle)\b/i;

        // OPTIMIZED NOISE FILTER:
        // Rule 1: Ignore very short inputs (under 2 words) UNLESS they start with a valid question trigger OR are a tech keyword
        if (wordCount < 2 && !validQuestionTriggers.test(lowerText) && !validTechKeywords.test(lowerText)) {
            console.log(`Filtered short noise (No trigger/keyword): "${text}"`);
            return;
        }

        // Rule 2: Strict Hallucination Check
        if (hallucinations.some(h => h.test(lowerText))) {
            console.log(`Filtered Whisper hallucination: "${text}"`);
            return;
        }

        // 3. Duplicate & Recency Check - OPTIMIZED: 5s window for faster re-engagement
        const now = Date.now();

        if (text === session.lastSentTranscription && (now - session.lastSentTimestamp < 5000)) {
            console.log(`Skipped duplicate transcription: "${text}"`);
            return;
        }

        if (now - session.lastImageAnalysisTimestamp < 5000 && text.length < 30) {
            const genericFollowups = /^(solve (this|it)|what is (this|it)|what's (this|it)|can you solve|help me|tell me)$/i;
            if (genericFollowups.test(lowerText) || lowerText.split(' ').length <= 3) {
                console.log(`Skipped short/generic audio response during screenshot cool-down: "${text}"`);
                return;
            }
        }

        console.log('Audio transcribed:', result.text, '(Lang:', result.language, ')');
        session.lastSentTranscription = text;
        session.lastSentTimestamp = now;

        // Send to Groq for response (using automatic userId)
        await sendMessageToGroqWrapper(userId, result.text, { isAudio: true });
    } else {
        console.log(`[Audio Processing] Transcription returned empty (Silence or Error). Length: ${result ? result.text.length : 0}`);
    }
}

function setupGroqIpcHandlers(sessionRef) {
    // Store the sessionRef globally for reconnection access
    global.sessionRef = sessionRef;
    let silenceThresholdMs = 1500; // INCREASED to 1.5s to prevent cutting off users thinking

    ipcMain.handle('initialize-groq', async (event, params = {}) => {
        const {
            apiKey,
            customPrompt,
            resumeContext,
            profile = 'interview',
            language = 'en-US',
            silenceThresholdParam = 1.5 // 1500ms default — natural human pause between sentences
        } = params;

        // Use the parameter directly, converting to ms (frontend sends ms, but we'll handle both)
        silenceThresholdMs = silenceThresholdParam < 10 ? silenceThresholdParam * 1000 : silenceThresholdParam;
        console.log(`Silence Threshold set to: ${silenceThresholdMs}ms`);

        // Resolve userId from params or fallback
        const userId = params.userId || getMachineId();

        const success = await initializeGroqSession(userId, apiKey, customPrompt, resumeContext, profile, language);
        if (success) {
            sessionRef.current = true; // Mark session as active
            return true;
        }
        return false;
    });

    ipcMain.handle('send-audio-content', async (event, { userId, data, mimeType }) => {
        // Resolve userId (machineId fallback)
        if (!userId) userId = getMachineId();

        const hasGroq = process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B;
        if (!aiClient && !hasGroq) {
            return { success: false, error: 'No active session (Groq required)' };
        }

        try {
            const session = getOrCreateSession(userId);

            // 1. Decode and Analyze Energy (VAD)
            const audioBuffer = Buffer.from(data, 'base64');
            const isSpeaking = analyzeAudioEnergy(userId, audioBuffer);

            // 2. State Management based on Speech Detection
            if (isSpeaking) {
                // AUTO-INTERRUPT: If user starts speaking while AI is responding, stop the AI
                if (session.isGenerating() || session.isTranscribing) {
                    console.log(`[${userId.substring(0, 5)}] User Interrupt detected! Aborting current generation...`);
                    session.stopProcessing();
                }

                session.hasSpeechInActiveBuffer = true;
                session.ignorePendingResults = false; // Reset stop flag on new speech
                if (session.silenceTimer) {
                    clearTimeout(session.silenceTimer);
                    session.silenceTimer = null;
                }
                session.isSilenceTimerActive = false; // Interrupt silence period
            }

            // 3. Selective Accumulation
            // Only accumulate if THIS chunk is speech-energy, or if we're within a 2-frame
            // trailing-silence window after real speech (preserves natural word endings).
            // REMOVED: unconditional 4-chunk padding that caused silent hallucinations.
            if (isSpeaking) {
                session.receivedAudioBuffer.push(audioBuffer);
                session.speechChunkCount = (session.speechChunkCount || 0) + 1;
                session.trailingSilentChunks = 0; // Reset trail on speech
            } else if (session.hasSpeechInActiveBuffer) {
                // Allow a short trail of silence after speech (natural audio decay)
                if (!session.trailingSilentChunks) session.trailingSilentChunks = 0;
                if (session.trailingSilentChunks < 2) {
                    session.receivedAudioBuffer.push(audioBuffer);
                    session.trailingSilentChunks++;
                }
            }

            // 4. Thresholds
            const MIN_CHUNKS = 1;   // 0.25s (ULTRA-FAST triggering)
            const MAX_CHUNKS = 120; // 30s (INCREASED from 10s to support long scenario questions)

            // 5. Hard Cap
            if (session.receivedAudioBuffer.length > MAX_CHUNKS) {
                console.log(`[${userId.substring(0, 5)} MAX BUFFER] Processing 10s window...`);
                processAudioBuffer(userId).catch(e => console.error(e));
                return { success: true };
            }

            // 6. Silence Detection (Triggers Processing)
            // GUARD: Only arm the silence timer when we have ≥2 real speech chunks (~500ms).
            // This prevents sub-threshold noise bursts from firing Whisper unnecessarily.
            const hasRealSpeech = (session.speechChunkCount || 0) >= 2;
            if (!isSpeaking && session.hasSpeechInActiveBuffer && !session.isSilenceTimerActive && hasRealSpeech) {
                session.isSilenceTimerActive = true; // Lock in the timer
                if (session.silenceTimer) clearTimeout(session.silenceTimer);
                session.silenceTimer = setTimeout(() => {
                    if (!session.isTranscribing && !session.isGenerating()) {
                        console.log(`[VAD] Silence threshold hit (${silenceThresholdMs}ms). Triggering...`);
                        processAudioBuffer(userId).catch(err => console.error('Error:', err));
                    }
                }, silenceThresholdMs);
            }
            // If less than MIN_CHUNKS, just accumulate (no action)

            return { success: true };
        } catch (error) {
            console.error('Error processing audio:', error);
            return { success: false, error: error.message };
        }
    });



    ipcMain.handle('send-image-content', async (event, { userId, data, prompt, debug, imageQuality }) => {
        // Resolve userId (machineId fallback)
        if (!userId) userId = getMachineId();

        const hasGroq = process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B;
        if (!aiClient && !hasGroq) {
            return { success: false, error: 'No active session (Groq required)' };
        }

        try {
            if (!data || typeof data !== 'string') {
                console.error('Invalid image data received');
                return { success: false, error: 'Invalid image data' };
            }

            const session = getOrCreateSession(userId);

            // Determine settings based on style
            let stylePrompt = '';
            let styleMaxTokens = 800;

            // Use session-based responsive style if available, otherwise global/default
            const style = session.screenshotResponseStyle || 'code_only';

            switch (style) {
                case 'code_only':
                    stylePrompt = 'Provide ONLY the code solution. No explanations or conversational text.';
                    styleMaxTokens = 300;
                    break;
                case 'assignment':
                    stylePrompt = 'Provide a direct answer/solution. Be concise and straight to the point.';
                    styleMaxTokens = 500;
                    break;
                case 'approach_solution':
                    stylePrompt = 'Briefly explain the approach, then provide the solution.';
                    styleMaxTokens = 800;
                    break;
                case 'full_analysis':
                    stylePrompt = 'Provide a comprehensive analysis, including context and deep explanation.';
                    styleMaxTokens = 1200;
                    break;
                default:
                    stylePrompt = 'Provide ONLY the code solution.';
                    styleMaxTokens = 300;
            }

            const analysisPrompt = prompt || `Analyze this screenshot. ${stylePrompt}`;
            console.log(`Processing image with Style: ${style}, Quality: ${imageQuality || 'medium'}`);

            // OCR INTEGRATION START
            const ocrEnabled = await getStoredSetting('ocr_enabled', 'true') === 'true'; // Default to true

            if (ocrEnabled) {
                let extractedText = null;
                let usedMethod = '';

                // 1. Try Local OCR (Tesseract) - Priority: Free, Offline
                console.log('Attempting Phase 1: Local OCR (Tesseract)...');
                sendToRenderer('update-status', 'Extracting Text (Local)...');
                const { performLocalOCR } = require('./localOcr'); // Lazy load
                extractedText = await performLocalOCR(data);

                if (extractedText && extractedText.length > 10) {
                    usedMethod = 'Local OCR';
                }
                else {
                    // 2. Try Cloud OCR (OCR.space) - Priority: Better Accuracy, Free Tier
                    console.log('Local OCR failed/empty. Attempting Phase 2: Cloud OCR...');
                    sendToRenderer('update-status', 'Extracting Text (Cloud)...');
                    const { performOCR } = require('./ocr'); // Lazy load
                    extractedText = await performOCR(data);
                    if (extractedText && extractedText.length > 10) {
                        usedMethod = 'Cloud OCR';
                    }
                }

                if (extractedText && extractedText.length > 10) {
                    // OCR SUCCESS - Use Text Model (Groq/OpenAI)
                    const finalPrompt = `The following text was extracted from the user's screen using OCR (${usedMethod}). It may contain noise, UI elements, or OCR artifacts — IGNORE those.

Your job: Find the actual QUESTION or CODING PROBLEM in this text and ANSWER IT DIRECTLY.

**RULES:**
- If it's a coding question (e.g., "write a palindrome program", "sort an array"): Provide the COMPLETE code solution, the expected OUTPUT, and a brief explanation.
- If it's a theory/definition question: Provide a direct answer in bullet points.
- Do NOT describe what the OCR text looks like. Do NOT mention "jumbled text" or "OCR artifacts".
- Do NOT say "the text appears to be..." — just ANSWER the question.
- Use triple backticks for code blocks.

${stylePrompt}

--- EXTRACTED TEXT ---
${extractedText}
--- END ---

Now answer the question/problem found above:`;

                    console.log(`${usedMethod} Success. Routing to Text Chat Engine...`);

                    // Send to chat engine (supports Groq routing)
                    await sendMessageToGroqWrapper(userId, finalPrompt, { isScreenshot: true, condensedTranscription: `[Screenshot Analysis: ${usedMethod}]` });

                    return { success: true };
                } else {
                    console.log('All OCR methods failed or returned empty text. Falling back to Vision Model.');
                    sendToRenderer('update-status', 'OCR Failed. Using Vision Model...');
                }
            }
            // OCR INTEGRATION END

            // 3. Vision Model Failover Part
            const visionModel = 'llama-3.2-11b-vision-preview';
            const visionDetail = imageQuality === 'high' ? 'high' : 'low';
            const isHighQuality = imageQuality === 'high';
            let responseContent = '';
            let attempts = 0;
            const maxAttempts = 3;

            // Build dynamic context prompt
            let finalPrompt = analysisPrompt;
            if (session.getResumeContext()) {
                finalPrompt += `\n\n[RESUME CONTEXT]:\n${session.getResumeContext().substring(0, 2000)}`;
            }

            console.log('⚡ Using Groq for Vision failover (Llama-3.2-11b-vision-preview)...');

            while (attempts < maxAttempts && !responseContent) {
                const keyInfo = getAvailableKey('70b'); // Use 70B bucket for complex Vision tasks
                if (!keyInfo) break;

                const currentKey = keyInfo.key;
                attempts++;

                try {
                    sendToRenderer('update-status', `Analyzing Image (Key ${keyInfo.index + 1})...`);

                    const groq = new Groq({ apiKey: currentKey, dangerouslyAllowBrowser: true, timeout: 20000 });
                    const response = await groq.chat.completions.create({
                        model: visionModel,
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: finalPrompt },
                                    {
                                        type: 'image_url',
                                        image_url: {
                                            url: `data:image/jpeg;base64,${data}`,
                                            detail: visionDetail
                                        }
                                    }
                                ]
                            }
                        ],
                        max_tokens: isHighQuality ? 2000 : styleMaxTokens,
                    });

                    responseContent = response.choices[0].message.content;
                } catch (visionError) {
                    console.error(`[Vision Failover] Attempt ${attempts} failed (Key ${keyInfo.index + 1}):`, visionError.message);
                    if (visionError.status === 429 || visionError.message.includes('429')) {
                        markKeyCooldown(currentKey, 60000);
                    }
                }
            }

            if (!responseContent) {
                throw new Error('Vision analysis failed after trying multiple keys.');
            }

            console.log('Image analysis complete. Length:', responseContent.length);

            // Send the analysis as a message
            sendToRenderer('update-response', responseContent);

            // Save conversation turn if a prompt was provided (manual capture)
            if (prompt && responseContent) {
                saveConversationTurn(userId, "[Screenshot Analysis]", responseContent);
                session.lastImageAnalysisTimestamp = Date.now();
            }

            // Restore status to listening
            sendToRenderer('update-status', 'Listening...');

            return { success: true };
        } catch (error) {
            console.error('Error processing image:', error);
            sendToRenderer('update-status', 'Error: ' + error.message);
            return { success: false, error: error.message };
        }
    });


    ipcMain.handle('send-text-message', async (event, textOrObject) => {
        const hasGroq = process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B;
        if (!aiClient && !hasGroq) {
            return { success: false, error: 'No active session (Groq required)' };
        }

        try {
            // Handle both formats
            let text, userId;
            if (typeof textOrObject === 'string') {
                text = textOrObject;
                userId = getMachineId();
            } else {
                text = textOrObject.message || textOrObject;
                userId = textOrObject.userId || getMachineId();
            }

            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                return { success: false, error: 'Invalid text message' };
            }

            console.log(`[${userId.substring(0, 5)}] Sending text message:`, text);
            await sendMessageToGroqWrapper(userId, text);
            return { success: true };
        } catch (error) {
            console.error('Error sending text:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-macos-audio', async (event, { userId }) => {
        if (process.platform !== 'darwin') {
            return {
                success: false,
                error: 'macOS audio capture only available on macOS',
            };
        }

        try {
            if (!userId) userId = getMachineId();
            const success = await startMacOSAudioCapture(userId);
            return { success };
        } catch (error) {
            console.error('Error starting macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async (event, { userId }) => {
        try {
            if (!userId) userId = getMachineId();
            stopMacOSAudioCapture(userId);
            return { success: true };
        } catch (error) {
            console.error('Error stopping macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async event => {
        try {
            // Iterate over all sessions to stop macOS audio capture if active
            userSessions.forEach((session, userId) => {
                stopMacOSAudioCapture(userId);
                session.clearSession();
            });
            userSessions.clear();

            // Cleanup AI client
            if (aiClient) {
                aiClient = null;
            }

            if (sessionRef) {
                sessionRef.current = null;
            }

            return { success: true };
        } catch (error) {
            console.error('Error closing session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('read-file-content', async (event, filePath) => {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'File not found' };
            }

            const ext = filePath.split('.').pop().toLowerCase();
            let text = '';

            if (ext === 'pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdf(dataBuffer);
                text = data.text;
            } else if (ext === 'docx' || ext === 'doc') {
                const result = await mammoth.extractRawText({ path: filePath });
                text = result.value;
            } else {
                // Default to text read
                text = fs.readFileSync(filePath, 'utf8');
            }

            return { success: true, content: text };
        } catch (error) {
            console.error('Error reading file:', error);
            return { success: false, error: error.message };
        }
    });

    // Conversation history IPC handlers
    ipcMain.handle('get-current-session', async (event, params) => {
        try {
            const userId = params?.userId || getMachineId();
            return { success: true, data: getCurrentSessionData(userId) };
        } catch (error) {
            console.error('Error getting current session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-new-session', async (event, payload = {}) => {
        try {
            const { userId } = payload;
            const resolvedUserId = userId || getMachineId();
            const session = getOrCreateSession(resolvedUserId);
            if (session) {
                session.clearSession();
                session.initializeSession();
                return { success: true, sessionId: session.getSessionId() };
            }
            return { success: false, error: 'Failed to create session' };
        } catch (error) {
            console.error('Error starting new session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-google-search-setting', async (event, enabled) => {
        try {
            console.log('Google Search setting updated to:', enabled);
            return { success: true };
        } catch (error) {
            console.error('Error updating Google Search setting:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-screenshot-style', (event, { userId, style }) => {
        if (style) {
            const session = getOrCreateSession(userId || getMachineId());
            session.screenshotResponseStyle = style;
            console.log(`[${session.userId.substring(0, 5)}] Updated screenshot response style to:`, style);
            return true;
        }
        return { success: true };
    });

    ipcMain.handle('start-listening', (event, { userId } = {}) => {
        const resolvedUserId = userId || getMachineId();
        const session = getOrCreateSession(resolvedUserId);
        session.ignorePendingResults = false; // EXPLICIT START
        console.log(`[SessionManager] Start Listening triggered for user ${resolvedUserId.substring(0, 8)}... (Flags Reset)`);
        return { success: true };
    });

    ipcMain.handle('stop-processing', (event, { userId } = {}) => {
        const resolvedUserId = userId || getMachineId();
        const session = getOrCreateSession(resolvedUserId);
        session.stopProcessing();
        return { success: true };
    });

    ipcMain.handle('set-manual-mode', (event, { userId, enabled }) => {
        const resolvedUserId = userId || getMachineId();
        const session = getOrCreateSession(resolvedUserId);
        session.isManualMode = enabled;
        // ALWAYS Clear buffer on state change (or reset)
        session.manualTranscriptionBuffer = "";

        console.log(`[${resolvedUserId.substring(0, 5)}] Manual Mode Set: ${session.isManualMode} (Buffer Cleared)`);
        try {
            sendToRenderer('update-status', session.isManualMode ? 'Manual Mode (F2 to Answer, F4 to Auto)' : 'Auto Mode');
            sendToRenderer('update-mode', session.isManualMode);
        } catch (e) {
            console.error('Failed to update renderer (ipc):', e);
        }
        return session.isManualMode;
    });

    ipcMain.handle('trigger-manual-answer', async (event, { userId }) => {
        const resolvedUserId = userId || getMachineId();
        console.log(`[${resolvedUserId.substring(0, 5)}] Manual Trigger Activated via IPC!`);
        await triggerManualAnswer(resolvedUserId);
        return true;
    });
}

module.exports = {
    initializeGroqSession,
    sendToRenderer,
    saveConversationTurn,
    getCurrentSessionData,
    killExistingMsMpEngCP,
    startMacOSAudioCapture,
    convertStereoToMono,
    stopMacOSAudioCapture,
    setupAIHandlers: setupGroqIpcHandlers,
    sendMessageToGroqWrapper,
    transcribeAudioWithWhisper,
    triggerManualAnswer,
    setManualMode: (userId, enabled) => {
        const session = getOrCreateSession(userId);
        session.isManualMode = enabled;
        session.manualTranscriptionBuffer = "";
        console.log(`[${userId.substring(0, 5)}] Manual Mode Set (Direct): ${session.isManualMode}`);
        try {
            sendToRenderer('update-mode', session.isManualMode);
        } catch (e) {
            console.error('Failed to update renderer (setManualMode):', e);
        }
        return session.isManualMode;
    },
};

async function triggerManualAnswer(userId) {
    const resolvedUserId = userId || getMachineId();
    const session = getOrCreateSession(resolvedUserId);

    // FIX: Force flush pending audio to ensure "Simultaneous" F3->Speak->F2 works
    if (session.receivedAudioBuffer.length > 0) {
        console.log(`[${resolvedUserId.substring(0, 5)}] Force processing audio before Manual Trigger...`);
        await processAudioBuffer(resolvedUserId);
    }

    if (!session.manualTranscriptionBuffer || session.manualTranscriptionBuffer.trim().length === 0) {
        console.log(`[${resolvedUserId.substring(0, 5)}] Manual Trigger: Buffer is empty, ignoring.`);
        try {
            sendToRenderer('update-status', 'Buffer Empty! (Speak first, then F2)');
        } catch (e) {
            console.error('Failed to send status update:', e);
        }
        return;
    }

    console.log(`[${resolvedUserId.substring(0, 5)}] Triggering Manual Answer with buffer:`, session.manualTranscriptionBuffer);
    const textToProcess = session.manualTranscriptionBuffer.trim();

    // Clear buffer IMMEDIATELY to prevent double sends
    session.manualTranscriptionBuffer = "";

    // Auto-Revert to Auto Mode after answering
    session.isManualMode = false;
    try {
        sendToRenderer('update-status', 'Answer Triggered (Reverting to Auto Mode)');
        sendToRenderer('update-mode', false);
    } catch (e) {
        console.error('Failed to update renderer (revert):', e);
    }

    // Send to LLM
    await sendMessageToGroqWrapper(resolvedUserId, textToProcess, { isAudio: true });
}
