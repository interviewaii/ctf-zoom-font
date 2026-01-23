const { GoogleGenAI } = require('@google/genai');

async function testGemini() {
    // TODO: Replace with your own Google Gemini API key
    // Get your API key from: https://ai.google.dev/
    const apiKey = 'YOUR_GEMINI_API_KEY_HERE';
    const client = new GoogleGenAI({
        vertexai: false,
        apiKey: apiKey,
    });

    console.log('Connecting to Gemini Live...');

    try {
        const session = await client.live.connect({
            model: 'gemini-2.0-flash-exp',
            callbacks: {
                onopen: () => {
                    console.log('Session opened!');
                    // Send a message immediately after open
                    setTimeout(() => {
                        console.log('Sending "Hello" to model...');
                        session.sendRealtimeInput({ text: 'Hello, are you there?' });
                    }, 1000);
                },
                onmessage: (message) => {
                    // console.log('Received message:', JSON.stringify(message, null, 2));
                    if (message.serverContent?.modelTurn?.parts) {
                        message.serverContent.modelTurn.parts.forEach(part => {
                            if (part.text) {
                                console.log('Model says:', part.text);
                            }
                        });
                    }
                    if (message.serverContent?.turnComplete) {
                        console.log('Turn complete.');
                        process.exit(0);
                    }
                },
                onerror: (err) => {
                    console.error('Error:', err);
                },
                onclose: (evt) => {
                    console.log('Closed:', evt);
                }
            },
            config: {
                responseModalities: ['TEXT'],
                speechConfig: { languageCode: 'en-US' },
            }
        });
    } catch (error) {
        console.error('Connection failed:', error);
    }
}

testGemini();
