const { GoogleGenAI } = require('@google/genai');

async function testSpecificKey() {
    const apiKey = 'AIzaSyCVeM0WTrPXhyibT1Qy2iAjC0QK4aM5dAY';
    console.log('Testing key: AIzaSyCVeM0WTrPXhyibT1Qy2iAjC0QK4aM5dAY');
    try {
        const client = new GoogleGenAI({ apiKey: apiKey });
        const response = await client.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{ role: 'user', parts: [{ text: 'Hello, are you working?' }] }]
        });
        console.log('✅ SUCCESS! Response:', JSON.stringify(response, null, 2));
    } catch (error) {
        console.error('❌ FAILED:', error.message);
    }
}

testSpecificKey();
