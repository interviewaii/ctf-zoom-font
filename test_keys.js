const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

const keys = [
    { name: 'Paid Key', key: 'AIzaSyBd6PruB7A-x6yG9XGFU3HklgZdlzjMt9M' },
    { name: 'Free Key', key: 'AIzaSyBnUAvUZVUI-_6fjS6C-3lxEjxDpYNIHhE' }
];

const modelName = 'gemini-2.0-flash-exp';

async function testKey(keyInfo) {
    console.log(`\nTesting ${keyInfo.name}...`);
    try {
        const client = new GoogleGenAI({ apiKey: keyInfo.key });

        // Try simple generation
        const response = await client.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
        });

        console.log(`✅ ${keyInfo.name} SUCCESS! Generated response.`);
        return true;
    } catch (error) {
        console.error(`❌ ${keyInfo.name} FAILED:`, error.message);
        return false;
    }
}

async function runTests() {
    console.log('Starting API Key Tests for model:', modelName);
    let output = '';

    for (const key of keys) {
        const result = await testKey(key);
        output += `${key.name}: ${result ? 'SUCCESS' : 'FAILED'}\n`;
    }

    fs.writeFileSync('test_results.txt', output);
    console.log('Results written to test_results.txt');
}

runTests();
