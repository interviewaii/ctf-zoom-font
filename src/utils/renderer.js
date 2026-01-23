// renderer.js
const { ipcRenderer } = require('electron');

let mediaStream = null;
let screenshotInterval = null;
let audioContext = null;
let audioProcessor = null;
let micAudioProcessor = null;
let audioBuffer = [];
const SAMPLE_RATE = 24000;
const AUDIO_CHUNK_DURATION = 0.02; // seconds - extreme speed
const BUFFER_SIZE = 1024; // Minimal buffer size for lowest possible latency (~42ms)

let hiddenVideo = null;
let offscreenCanvas = null;
let offscreenContext = null;
let currentImageQuality = 'medium'; // Store current image quality for manual screenshots

const isLinux = process.platform === 'linux';
const isMacOS = process.platform === 'darwin';

// Token tracking system for rate limiting
let tokenTracker = {
    tokens: [], // Array of {timestamp, count, type} objects
    audioStartTime: null,

    // Add tokens to the tracker
    addTokens(count, type = 'image') {
        const now = Date.now();
        this.tokens.push({
            timestamp: now,
            count: count,
            type: type,
        });

        // Clean old tokens (older than 1 minute)
        this.cleanOldTokens();
    },

    // Calculate image tokens based on Gemini 2.0 rules
    calculateImageTokens(width, height) {
        // Images ≤384px in both dimensions = 258 tokens
        if (width <= 384 && height <= 384) {
            return 258;
        }

        // Larger images are tiled into 768x768 chunks, each = 258 tokens
        const tilesX = Math.ceil(width / 768);
        const tilesY = Math.ceil(height / 768);
        const totalTiles = tilesX * tilesY;

        return totalTiles * 258;
    },

    // Track audio tokens continuously
    trackAudioTokens() {
        if (!this.audioStartTime) {
            this.audioStartTime = Date.now();
            return;
        }

        const now = Date.now();
        const elapsedSeconds = (now - this.audioStartTime) / 1000;

        // Audio = 32 tokens per second
        const audioTokens = Math.floor(elapsedSeconds * 32);

        if (audioTokens > 0) {
            this.addTokens(audioTokens, 'audio');
            this.audioStartTime = now;
        }
    },

    // Clean tokens older than 1 minute
    cleanOldTokens() {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        this.tokens = this.tokens.filter(token => token.timestamp > oneMinuteAgo);
    },

    // Get total tokens in the last minute
    getTokensInLastMinute() {
        this.cleanOldTokens();
        return this.tokens.reduce((total, token) => total + token.count, 0);
    },

    // Check if we should throttle based on settings
    shouldThrottle() {
        // Get rate limiting settings from localStorage
        const throttleEnabled = localStorage.getItem('throttleTokens') === 'true';
        if (!throttleEnabled) {
            return false;
        }

        const maxTokensPerMin = parseInt(localStorage.getItem('maxTokensPerMin') || '1000000', 10);
        const throttleAtPercent = parseInt(localStorage.getItem('throttleAtPercent') || '75', 10);

        const currentTokens = this.getTokensInLastMinute();
        const throttleThreshold = Math.floor((maxTokensPerMin * throttleAtPercent) / 100);

        console.log(`Token check: ${currentTokens}/${maxTokensPerMin} (throttle at ${throttleThreshold})`);

        return currentTokens >= throttleThreshold;
    },

    // Reset the tracker
    reset() {
        this.tokens = [];
        this.audioStartTime = null;
    },
};

// Track audio tokens every second for faster response
setInterval(() => {
    tokenTracker.trackAudioTokens();
}, 1000);

function interviewCrackerElement() {
    return document.getElementById('interview-ai');
}

function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Improved scaling to prevent clipping
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function initializeGemini(profile = 'interview', language = 'en-US') {
    // Pass profile and language first, then customPrompt, and null for apiKey to use rotation
    const success = await ipcRenderer.invoke('initialize-gemini', profile, language, localStorage.getItem('customPrompt') || '', null);
    if (success) {
        interviewCrackerElement().setStatus('Live');
    } else {
        interviewCrackerElement().setStatus('error');
    }
}

// Listen for status updates
ipcRenderer.on('update-status', (event, status) => {
    console.log('Status update:', status);
    interviewCrackerElement().setStatus(status);
});

// Listen for responses - REMOVED: This is handled in InterviewCrackerApp.js to avoid duplicates
// ipcRenderer.on('update-response', (event, response) => {
//     console.log('Gemini response:', response);
//     cheddar.e().setResponse(response);
//     // You can add UI elements to display the response if needed
// });

async function startCapture(screenshotIntervalSeconds = 2, imageQuality = 'medium') {
    // Store the image quality for manual screenshots
    currentImageQuality = imageQuality;

    // Reset token tracker when starting new capture session
    tokenTracker.reset();
    console.log('🎯 Token tracker reset for new capture session');

    try {
        if (isMacOS) {
            // On macOS, use SystemAudioDump for audio and getDisplayMedia for screen
            console.log('Starting macOS capture with SystemAudioDump...');

            // Start macOS audio capture
            const audioResult = await ipcRenderer.invoke('start-macos-audio');
            if (!audioResult.success) {
                throw new Error('Failed to start macOS audio capture: ' + audioResult.error);
            }

            // Get screen capture for screenshots
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // Don't use browser audio on macOS
            });

            console.log('macOS screen capture started - audio handled by SystemAudioDump');
        } else if (isLinux) {
            // Linux - use display media for screen capture and getUserMedia for microphone
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // Don't use system audio loopback on Linux
            });

            // Get microphone input for Linux
            let micStream = null;
            try {
                micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false,
                });

                console.log('Linux microphone capture started');

                // Setup audio processing for microphone on Linux
                setupLinuxMicProcessing(micStream);
            } catch (micError) {
                console.warn('Failed to get microphone access on Linux:', micError);
                // Continue without microphone if permission denied
            }

            console.log('Linux screen capture started');
        } else {
            // Windows - use display media with loopback for system audio
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: {
                    sampleRate: SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            console.log('Windows capture started with loopback audio');

            // Setup audio processing for Windows loopback audio only
            setupWindowsLoopbackProcessing();
        }

        console.log('MediaStream obtained:', {
            hasVideo: mediaStream.getVideoTracks().length > 0,
            hasAudio: mediaStream.getAudioTracks().length > 0,
            videoTrack: mediaStream.getVideoTracks()[0]?.getSettings(),
        });

        // Start capturing screenshots - check if manual mode
        if (screenshotIntervalSeconds === 'manual' || screenshotIntervalSeconds === 'Manual') {
            console.log('Manual mode enabled - screenshots will be captured on demand only');
            // Don't start automatic capture in manual mode
        } else {
            const intervalMilliseconds = parseInt(screenshotIntervalSeconds) * 1000;

            const scheduleNextCapture = () => {
                screenshotInterval = setTimeout(async () => {
                    await captureScreenshot(imageQuality);
                    scheduleNextCapture();
                }, intervalMilliseconds);
            };

            // Capture first screenshot immediately and start the loop
            setTimeout(async () => {
                await captureScreenshot(imageQuality);
                scheduleNextCapture();
            }, 100);
        }
    } catch (err) {
        console.error('Error starting capture:', err);
        interviewCrackerElement().setStatus('error');
    }
}

function setupLinuxMicProcessing(micStream) {
    // Setup microphone audio processing for Linux
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    // Store processor reference for cleanup
    audioProcessor = micProcessor;
}

function setupWindowsLoopbackProcessing() {
    // Setup audio processing for Windows loopback audio only
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
}

async function captureScreenshot(imageQuality = 'medium', isManual = false) {
    console.log(`Capturing ${isManual ? 'manual' : 'automated'} screenshot...`);
    if (!mediaStream) return;

    // Check rate limiting for automated screenshots only
    if (!isManual && tokenTracker.shouldThrottle()) {
        console.log('⚠️ Automated screenshot skipped due to rate limiting');
        return;
    }

    // Lazy init of video element
    if (!hiddenVideo) {
        hiddenVideo = document.createElement('video');
        hiddenVideo.srcObject = mediaStream;
        hiddenVideo.muted = true;
        hiddenVideo.playsInline = true;
        await hiddenVideo.play();

        await new Promise(resolve => {
            if (hiddenVideo.readyState >= 2) return resolve();
            hiddenVideo.onloadedmetadata = () => resolve();
        });

        // Lazy init of canvas based on video dimensions with downscaling
        offscreenCanvas = document.createElement('canvas');
        const maxDim = 1024;
        let width = hiddenVideo.videoWidth;
        let height = hiddenVideo.videoHeight;

        if (width > maxDim || height > maxDim) {
            if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
            } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
            }
            console.log(`Downscaling screenshot from ${hiddenVideo.videoWidth}x${hiddenVideo.videoHeight} to ${width}x${height}`);
        }

        offscreenCanvas.width = width;
        offscreenCanvas.height = height;
        offscreenContext = offscreenCanvas.getContext('2d');
    }

    // Check if video is ready
    if (hiddenVideo.readyState < 2) {
        console.warn('Video not ready yet, skipping screenshot');
        return;
    }

    offscreenContext.drawImage(hiddenVideo, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Optimization: Skip blank check (getImageData is slow GPU sync)

    let qualityValue;
    switch (imageQuality) {
        case 'high': qualityValue = 0.9; break;
        case 'medium': qualityValue = 0.7; break;
        case 'low': qualityValue = 0.5; break;
        default: qualityValue = 0.7;
    }

    // Faster synchronous encoding
    const base64data = offscreenCanvas.toDataURL('image/jpeg', qualityValue).split(',')[1];

    if (!base64data || base64data.length < 100) {
        console.error('Invalid image data generated');
        return;
    }

    // Skip if image hasn't changed
    if (!isManual && window.lastSentImage === base64data) return;
    window.lastSentImage = base64data;

    const result = await ipcRenderer.invoke('send-image-content', {
        data: base64data,
    });

    if (result.success) {
        // Track tokens silently
        const imageTokens = tokenTracker.calculateImageTokens(offscreenCanvas.width, offscreenCanvas.height);
        tokenTracker.addTokens(imageTokens, 'image');
    } else {
        console.error('Failed to send image:', result.error);
    }
}

async function captureManualScreenshot(imageQuality = null) {
    console.log('Manual screenshot triggered');

    // Show loading indicator
    if (window.setScreenshotProcessing) {
        window.setScreenshotProcessing(true);
    }

    // Update status to show processing
    if (window.interviewCracker && window.interviewCracker.setStatus) {
        window.interviewCracker.setStatus('Taking screenshot and analyzing question...');
    }

    const quality = imageQuality || currentImageQuality;
    await captureScreenshot(quality, true); // Pass true for isManual

    // Update status to show AI processing
    if (window.interviewCracker && window.interviewCracker.setStatus) {
        window.interviewCracker.setStatus('AI analyzing screenshot for questions...');
    }

    // Removed artificial delay for instant response
    try {
        await sendTextMessage(`Analyze this screenshot and identify any questions or problems. Provide a direct, concise answer immediately.
        
**For Code:** Provide ONLY the working code and a 1-sentence explanation.
**For MCQ:** Provide ONLY the correct option and a 1-sentence reason.
**For Text:** Provide a direct, concise answer.

No preamble, no "Question Detected", no conversational filler. Just the answer.`);
    } catch (error) {
        console.error('Error sending screenshot analysis message:', error);
        // Hide loading indicator on error
        if (window.setScreenshotProcessing) {
            window.setScreenshotProcessing(false);
        }
        // Update status to show error
        if (window.interviewCracker && window.interviewCracker.setStatus) {
            window.interviewCracker.setStatus('Error analyzing screenshot');
        }
    }
}

// Expose functions to global scope for external access
window.captureManualScreenshot = captureManualScreenshot;

function stopCapture() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    // Stop macOS audio capture if running
    if (isMacOS) {
        ipcRenderer.invoke('stop-macos-audio').catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }

    // Clean up hidden elements
    if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.srcObject = null;
        hiddenVideo = null;
    }
    offscreenCanvas = null;
    offscreenContext = null;
}

// Send text message to Gemini
async function sendTextMessage(text) {
    if (!text || text.trim().length === 0) {
        console.warn('Cannot send empty text message');
        return { success: false, error: 'Empty message' };
    }

    try {
        const result = await ipcRenderer.invoke('send-text-message', text);
        if (result.success) {
            console.log('Text message sent successfully');
        } else {
            console.error('Failed to send text message:', result.error);
        }
        return result;
    } catch (error) {
        console.error('Error sending text message:', error);
        return { success: false, error: error.message };
    }
}

// Conversation storage functions using IndexedDB
let conversationDB = null;

async function initConversationStorage() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ConversationHistory', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            conversationDB = request.result;
            resolve(conversationDB);
        };

        request.onupgradeneeded = event => {
            const db = event.target.result;

            // Create sessions store
            if (!db.objectStoreNames.contains('sessions')) {
                const sessionStore = db.createObjectStore('sessions', { keyPath: 'sessionId' });
                sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

async function saveConversationSession(sessionId, conversationHistory) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');

    const sessionData = {
        sessionId: sessionId,
        timestamp: parseInt(sessionId),
        conversationHistory: conversationHistory,
        lastUpdated: Date.now(),
    };

    return new Promise((resolve, reject) => {
        const request = store.put(sessionData);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getConversationSession(sessionId) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');

    return new Promise((resolve, reject) => {
        const request = store.get(sessionId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getAllConversationSessions() {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
        const request = index.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            // Sort by timestamp descending (newest first)
            const sessions = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sessions);
        };
    });
}

// Listen for conversation data from main process
ipcRenderer.on('save-conversation-turn', async (event, data) => {
    try {
        await saveConversationSession(data.sessionId, data.fullHistory);
        console.log('Conversation session saved:', data.sessionId);
    } catch (error) {
        console.error('Error saving conversation session:', error);
    }
});

// Initialize conversation storage when renderer loads
initConversationStorage().catch(console.error);

// Handle shortcuts based on current view
function handleShortcut(shortcutKey) {
    console.log('Handling shortcut:', shortcutKey);

    // Get current view from the app
    const currentView = window.interviewCracker.getCurrentView ? window.interviewCracker.getCurrentView() : null;
    console.log('Current view:', currentView);

    if (shortcutKey === 'ctrl+enter' || shortcutKey === 'cmd+enter') {
        if (currentView === 'main') {
            // Trigger the start session from main view
            console.log('Triggering start session from main view');

            // First try to get the app component and call handleStart directly
            const appElement = document.querySelector('interview-ai-app');
            if (appElement && typeof appElement.handleStart === 'function') {
                appElement.handleStart();
            } else {
                // Fallback: simulate click on the start button
                const mainView = document.querySelector('main-view');
                if (mainView) {
                    const startButton = mainView.shadowRoot?.querySelector('.start-button');
                    if (startButton && !startButton.classList.contains('initializing')) {
                        startButton.click();
                    } else {
                        console.warn('Start button not available or initializing');
                    }
                } else {
                    console.warn('Could not find main-view element');
                }
            }
        } else {
            // In other views, take manual screenshot
            console.log('Taking manual screenshot from current view');
            captureManualScreenshot();
        }
    }
}

window.interviewAI = window.interviewCracker = {
    initializeGemini,
    startCapture,
    stopCapture,
    sendTextMessage,
    handleShortcut,
    // Conversation history functions
    getAllConversationSessions,
    getConversationSession,
    initConversationStorage,
    // Content protection function
    getContentProtection: () => {
        const contentProtection = localStorage.getItem('contentProtection');
        return contentProtection !== null ? contentProtection === 'true' : true;
    },
    isLinux: isLinux,
    isMacOS: isMacOS,
    e: interviewCrackerElement,

    // Storage functions for CustomizeView
    storage: {
        async getPreferences() {
            return {
                googleSearchEnabled: localStorage.getItem('googleSearchEnabled') === 'true',
                backgroundTransparency: parseFloat(localStorage.getItem('backgroundTransparency') || '0.8'),
                fontSize: parseInt(localStorage.getItem('fontSize') || '20', 10),
                audioMode: localStorage.getItem('audioMode') || 'speaker_only',
                customPrompt: localStorage.getItem('customPrompt') || '',
                theme: localStorage.getItem('theme') || 'dark'
            };
        },
        async getKeybinds() {
            const saved = localStorage.getItem('customKeybinds');
            return saved ? JSON.parse(saved) : null;
        },
        async setKeybinds(keybinds) {
            if (keybinds === null) {
                localStorage.removeItem('customKeybinds');
            } else {
                localStorage.setItem('customKeybinds', JSON.stringify(keybinds));
            }
        },
        async updatePreference(key, value) {
            localStorage.setItem(key, value.toString());
        },
        async clearAll() {
            localStorage.clear();
        }
    },

    // Theme functions for CustomizeView
    theme: {
        getAll() {
            return [
                { value: 'dark', name: 'Dark' },
                { value: 'light', name: 'Light' }
            ];
        },
        get(themeName) {
            const themes = {
                dark: {
                    background: 'rgba(0, 0, 0, 0.3)',
                    text: '#f7f7fa'
                },
                light: {
                    background: 'rgba(255, 255, 255, 0.3)',
                    text: '#1f2937'
                }
            };
            return themes[themeName] || themes.dark;
        },
        async save(themeName) {
            localStorage.setItem('theme', themeName);
            // Apply theme to document
            document.documentElement.setAttribute('data-theme', themeName);
        },
        applyBackgrounds(backgroundColor, transparency) {
            // Apply background with transparency
            const root = document.documentElement;
            root.style.setProperty('--background-transparent', backgroundColor.replace(/[\d.]+\)$/, `${transparency})`));
        }
    }
};

