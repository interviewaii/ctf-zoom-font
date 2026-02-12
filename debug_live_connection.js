require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function debugLiveConnection() {
    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyAJuQFoLkLZfjAF9Ff0cdG6Kulfi5aatwM';
    console.log('--- Debugging Live SDK Connection ---');
    console.log(`Model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025'}`);
    console.log('API Version: v1alpha');

    const client = new GoogleGenAI({
        vertexai: false,
        apiKey: apiKey,
        httpOptions: { apiVersion: 'v1beta' },
    });

    try {
        console.log('Attempting to connect...');
        const session = await client.live.connect({
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025',
            callbacks: {
                onopen: () => {
                    console.log('✅ Connection opened!');
                },
                onmessage: (message) => {
                    console.log('📥 Received message type:', Object.keys(message).join(', '));
                    if (message.serverContent?.modelTurn?.parts) {
                        message.serverContent.modelTurn.parts.forEach(part => {
                            console.log('🤖 AI Response Part:', JSON.stringify(part));
                        });
                    }
                    if (message.serverContent?.turnComplete) {
                        console.log('🎯 Turn complete.');
                        process.exit(0);
                    }
                },
                onerror: (err) => {
                    console.error('❌ SDK Error:', err);
                },
                onclose: (evt) => {
                    console.log('🚪 Connection closed:', evt.reason || 'No reason provided');
                }
            },
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
                    languageCode: 'en-US'
                }
            }
        });

        console.log('Sending test message...');
        await session.sendRealtimeInput({ text: 'Hello, are you working?' });
    } catch (error) {
        console.error('❌ Connection failed:', error);
    }
}

// Timeout after 15 seconds
setTimeout(() => {
    console.log('⏳ Timeout: No response received after 15s');
    process.exit(1);
}, 15000);

debugLiveConnection();
