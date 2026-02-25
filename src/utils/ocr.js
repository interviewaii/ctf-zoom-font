const { BrowserWindow } = require('electron');

async function getStoredSetting(key, defaultValue) {
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            // Wait a bit for the renderer to be ready (if needed)
            const value = await windows[0].webContents.executeJavaScript(`localStorage.getItem('${key}')`);
            return value || defaultValue;
        }
    } catch (error) {
        // console.error('Error getting stored setting for', key, ':', error.message);
    }
    return defaultValue;
}

/**
 * Perform OCR on a base64 image using OCR.space API with Timeout
 * @param {string} base64Image - Base64 encoded image string (without data:image/jpeg;base64 prefix)
 * @param {string} apiKey - Optional override, otherwise uses process.env.OCR_API_KEY
 * @returns {Promise<string|null>} - Extracted text or null if failed
 */
async function performOCR(base64Image, apiKey = '') {
    // 1. Determine API Key (Prioritize Env Var, then Argument, then hardcoded fallback for dev)
    const key = process.env.OCR_API_KEY || (apiKey && apiKey.trim().length > 0 ? apiKey : 'helloworld');

    // 10 Second Limit
    const TIMEOUT_MS = 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const formData = new FormData();
        formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('scale', 'true'); // Auto-scale for better accuracy
        formData.append('OCREngine', '2'); // Use Engine 2 (better for numbers/special chars)

        console.log(`Sending OCR request to OCR.space (Engine 2)... Key: ${key.substring(0, 4)}... (Timeout: 10s)`);

        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            headers: {
                'apikey': key,
            },
            body: formData,
            signal: controller.signal // Bind timeout signal
        });

        clearTimeout(timeoutId); // Clear timeout on response

        if (!response.ok) {
            console.error(`OCR API HTTP Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const result = await response.json();

        if (result.IsErroredOnProcessing) {
            console.error('OCR API Error:', result.ErrorMessage);
            return null;
        }

        if (result.ParsedResults && result.ParsedResults.length > 0) {
            const text = result.ParsedResults[0].ParsedText;
            console.log(`OCR Success! Extracted ${text.length} chars.`);
            return text;
        }

        return null;

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('OCR Request Timed Out (10s limit exceeded).');
        } else {
            console.error('OCR Request Failed:', error.message);
        }
        return null; // Return null so we fall back to Vision Model
    } finally {
        clearTimeout(timeoutId); // Ensure cleanup
    }
}

module.exports = {
    performOCR,
    getStoredSetting
};
