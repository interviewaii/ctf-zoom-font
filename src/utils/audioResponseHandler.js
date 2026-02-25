// ========================================
// AUDIO RESPONSE HANDLER
// Clean implementation of audio capture and line-by-line response streaming
// ========================================

const { ipcRenderer } = require('electron');

const SAMPLE_RATE = 16000;          // Match main process Whisper expectation (16kHz)
const BUFFER_SIZE = 4096;           // Larger buffer = fewer interrupts
const AUDIO_CHUNK_DURATION = 0.25;  // 250ms chunks → 4 IPC calls/sec instead of 20

// Audio listening state
let micStream = null;
let micAudioContext = null;
let micAudioProcessor = null;
let currentResponseBuffer = '';

/**
 * Convert Float32 audio to Int16 PCM
 */
function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

/**
 * Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// ========================================
// 1. START AUDIO LISTENING
// ========================================
async function startAudioListening() {
    console.log('🎤 Starting microphone audio listening...');

    try {
        // Request microphone access
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

        console.log('✅ Microphone access granted');

        // Create audio context
        micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });

        if (micAudioContext.state === 'suspended') {
            await micAudioContext.resume();
        }

        const micSource = micAudioContext.createMediaStreamSource(micStream);
        micAudioProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

        let audioBuffer = [];
        const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

        micAudioProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            audioBuffer.push(...inputData);

            // Process audio in chunks (synchronous — no await inside audio callback)
            while (audioBuffer.length >= samplesPerChunk) {
                const chunk = audioBuffer.splice(0, samplesPerChunk);
                sendAudioToGroq(chunk); // fire-and-forget, NOT awaited
            }
        };

        micSource.connect(micAudioProcessor);

        console.log('🎤 Microphone is now listening and sending to Groq');
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to start audio listening:', error);
        return { success: false, error: error.message };
    }
}

// ========================================
// 2. SEND AUDIO TO GROQ
// ========================================
// Fire-and-forget — use invoke (not send) because main process uses ipcMain.handle
function sendAudioToGroq(audioChunk) {
    try {
        const pcmData16 = convertFloat32ToInt16(audioChunk);
        const base64Data = arrayBufferToBase64(pcmData16.buffer);
        // .catch() keeps non-blocking — ipcMain.handle requires invoke, not send
        ipcRenderer.invoke('send-audio-content', {
            data: base64Data,
            mimeType: 'audio/pcm;rate=16000',
        }).catch(() => { });
    } catch (error) {
        // Silently ignore — audio errors are expected during stop
    }
}

/**
 * Stop audio listening
 */
function stopAudioListening() {
    console.log('🛑 Stopping microphone audio listening...');

    if (micAudioProcessor) {
        micAudioProcessor.disconnect();
        micAudioProcessor = null;
    }

    if (micAudioContext) {
        micAudioContext.close();
        micAudioContext = null;
    }

    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }

    console.log('✅ Microphone stopped');
}

// ========================================
// 3. DISPLAY NEW RESPONSE
// ========================================
function displayNewResponse() {
    console.log('📝 Creating new response card');

    // Reset buffer for new response
    currentResponseBuffer = '';

    // Get AssistantView
    const assistantView = document.querySelector('assistant-view');
    if (!assistantView) {
        console.warn('AssistantView not found');
        return null;
    }

    // Add empty response to start
    const responses = assistantView.responses || [];
    assistantView.responses = [...responses, ''];
    assistantView.requestUpdate();

    return assistantView;
}

// ========================================
// 4. UPDATE RESPONSE LINE BY LINE
// ========================================
function updateResponseLineByLine(textChunk) {
    if (!textChunk) return;

    // Strip timing prefix like [2.3s] if present
    const cleanedChunk = textChunk.replace(/^\[\d+\.\d+s\]\s*/, '');

    // Add to buffer
    currentResponseBuffer += cleanedChunk;

    // Get AssistantView and update its responses
    const assistantView = document.querySelector('assistant-view');
    if (!assistantView) return;

    // Update the current (last) response in the array
    const responses = assistantView.responses || [];
    if (responses.length === 0) {
        // Create first response
        assistantView.responses = [currentResponseBuffer];
    } else {
        // Update last response
        responses[responses.length - 1] = currentResponseBuffer;
        assistantView.responses = [...responses]; // Trigger update
    }

    assistantView.requestUpdate();
}

// ========================================
// 5. COPY RESPONSE TO CLIPBOARD
// ========================================
async function copyResponseToClipboard(responseIndex = -1) {
    const assistantView = document.querySelector('assistant-view');
    if (!assistantView) {
        console.error('AssistantView not found');
        return { success: false, error: 'AssistantView not found' };
    }

    const responses = assistantView.responses || [];

    // If index is -1, copy the last response
    const index = responseIndex === -1 ? responses.length - 1 : responseIndex;

    if (index < 0 || index >= responses.length) {
        console.error('Invalid response index');
        return { success: false, error: 'Invalid response index' };
    }

    const responseToCopy = responses[index];

    try {
        await navigator.clipboard.writeText(responseToCopy);
        console.log('✅ Response copied to clipboard');
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to copy response:', error);
        return { success: false, error: error.message };
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

// Listen for streaming response chunks from Groq
ipcRenderer.on('update-response-stream', (event, textChunk) => {
    // No console.log here — called dozens of times per response, kills performance
    updateResponseLineByLine(textChunk);
});

// Listen for complete responses (fallback)
ipcRenderer.on('update-response', (event, fullResponse) => {
    console.log('📥 Received complete response');

    const assistantView = document.querySelector('assistant-view');
    if (!assistantView) return;

    // Check if we need to create new response
    if (!assistantView.responses || assistantView.responses.length === 0 || currentResponseBuffer !== fullResponse) {
        // Strip timing prefix if present
        const cleanedResponse = fullResponse.replace(/^\[\d+\.\d+s\]\s*/, '');

        if (currentResponseBuffer !== cleanedResponse) {
            displayNewResponse();
            currentResponseBuffer = cleanedResponse;
            updateResponseLineByLine(cleanedResponse);
        }
    }
});

// ========================================
// EXPORTS
// ========================================

module.exports = {
    startAudioListening,
    stopAudioListening,
    sendAudioToGroq,
    displayNewResponse,
    updateResponseLineByLine,
    copyResponseToClipboard,
};

// Also expose globally for easy access
if (typeof window !== 'undefined') {
    window.audioResponseHandler = {
        startAudioListening,
        stopAudioListening,
        sendAudioToGroq,
        displayNewResponse,
        updateResponseLineByLine,
        copyResponseToClipboard,
    };
}
