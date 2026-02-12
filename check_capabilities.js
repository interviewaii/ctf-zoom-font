const https = require('https');

const apiKey = 'AIzaSyAJuQFoLkLZfjAF9Ff0cdG6Kulfi5aatwM';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(body);
            const liveModels = parsed.models.filter(m => m.supportedGenerationMethods.includes('bidiGenerateContent'));
            console.log('--- Models supporting Live API (bidiGenerateContent) ---');
            liveModels.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`));

            if (liveModels.length === 0) {
                console.log('\n❌ NO models support bidiGenerateContent for this key.');
                console.log('\n--- All Models ---');
                parsed.models.slice(0, 10).forEach(m => console.log(`- ${m.name}`));
            }
        } catch (e) {
            console.error('Error parsing response:', e);
            console.log('Body:', body);
        }
    });
}).on('error', (e) => console.error(e));
