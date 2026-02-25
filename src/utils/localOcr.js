const { getOCRWorker } = require('./ocrWorker');

/**
 * Perform Local OCR using Persistent Tesseract Worker
 * @param {string} base64Image - Base64 encoded image string (without data prefix)
 * @returns {Promise<string|null>} - Extracted text or null if failed
 */
async function performLocalOCR(base64Image) {
    let timeoutId;
    try {
        console.log('[OCR] Processing with Persistent Worker...');

        // Construct standard data URI
        const imageUri = `data:image/jpeg;base64,${base64Image}`;

        // Get the persistent worker
        const worker = await getOCRWorker();
        if (!worker) {
            console.error('[OCR] Initialization failed.');
            return null;
        }

        // Add a safety timeout (15 seconds) to prevent infinite hang
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('OCR Timeout')), 15000);
        });

        // Perform recognition with timeout
        const recognitionPromise = (async () => {
            const result = await worker.recognize(imageUri);
            return result.data.text;
        })();

        const text = await Promise.race([recognitionPromise, timeoutPromise]);
        clearTimeout(timeoutId);

        if (text && text.trim().length > 0) {
            console.log(`[OCR] Extracted ${text.length} characters.`);
            return text.trim();
        }

        return null;

    } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('[OCR] Local OCR Error or Timeout:', error.message);
        return null;
    }
}

module.exports = {
    performLocalOCR
};
