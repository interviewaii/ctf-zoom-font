const Tesseract = require('tesseract.js');

let worker = null;
let isInitializing = false;

/**
 * Get or create a persistent Tesseract worker
 */
async function getOCRWorker() {
    if (worker) return worker;

    if (isInitializing) {
        console.log('[OCR] Already initializing, waiting...');
        while (isInitializing) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        return worker;
    }

    isInitializing = true;
    try {
        console.log('[OCR] Initializing persistent Tesseract worker (v5)...');

        // In v5, createWorker handles initialization if language is passed
        const newWorker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                if (m.status === 'recognizing text' && m.progress === 1) {
                    // console.log('[OCR] Recognition step complete');
                }
            },
            errorHandler: err => console.error('[OCR] Tesseract Internal Error:', err)
        });

        worker = newWorker;
        console.log('[OCR] Persistent worker initialized and ready.');
        return worker;
    } catch (error) {
        console.error('[OCR] CRITICAL: Failed to initialize persistent worker:', error);
        worker = null;
        return null;
    } finally {
        isInitializing = false;
    }
}

/**
 * Terminate the worker
 */
async function terminateOCRWorker() {
    try {
        if (worker) {
            console.log('[OCR] Terminating persistent worker...');
            await worker.terminate();
            worker = null;
            console.log('[OCR] Worker terminated successfully.');
        }
    } catch (error) {
        console.error('[OCR] Error during worker termination:', error);
    }
}

module.exports = {
    getOCRWorker,
    terminateOCRWorker
};
