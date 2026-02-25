if (require('electron-squirrel-startup')) {
    process.exit(0);
}
const fs = require('fs');
const path = require('path');
const os = require('os');
const { app, BrowserWindow, shell, ipcMain, desktopCapturer } = require('electron');

/**
 * Robust .env loader that works in dev and packaged modes
 */
function loadEnv() {
    const possiblePaths = [
        path.join(process.cwd(), '.env'),
        path.join(path.dirname(process.execPath), '.env'),
        process.resourcesPath ? path.join(process.resourcesPath, '.env') : null,
        path.join(__dirname, '..', '.env')
    ].filter(Boolean); // Remove null entries

    let found = false;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            require('dotenv').config({ path: p });
            console.log('✅ Loaded .env from:', p);
            found = true;
            break;
        }
    }

    if (!found) {
        require('dotenv').config();
        console.warn('⚠️ No .env file found in standard locations, using default dotenv.config()');
    }
}

loadEnv();
// os and path are already required above
const { createWindow, updateGlobalShortcuts } = require('./utils/window');
const { setupAIHandlers, stopMacOSAudioCapture, sendToRenderer, triggerManualAnswer, setManualMode } = require('./utils/groq');
const { getInputSimulator } = require('./remote/SimpleInputSimulator');

const sessionRef = {
    current: null,
    triggerManualAnswer: triggerManualAnswer,
    setManualMode: setManualMode
};
let mainWindow = null;

function createMainWindow() {
    mainWindow = createWindow(sendToRenderer, sessionRef);
    return mainWindow;
}

// Transparent window + GPU compositing = constant DWM alpha compositing = 88% CPU
// Software rendering is actually FASTER for transparent Electron windows on Windows
app.disableHardwareAcceleration();

// ── V8 Memory ─────────────────────────────────────────────────────────────────
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=2048');

// ── CPU REDUCTION SWITCHES ────────────────────────────────────────────────────
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-features',
    'HardwareMediaKeyHandling,MediaSessionService,TranslateUI,AutofillServerCommunication,AutofillCreditCardEnabler'
);
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-hang-monitor');
app.commandLine.appendSwitch('disable-sync');
// ─────────────────────────────────────────────────────────────────────────────

// ── SINGLE INSTANCE LOCK ──────────────────────────────────────────────────────
// Prevents duplicate windows when user double-clicks EXE or runs it twice
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    // Another instance already running — quit this one immediately
    app.quit();
} else {
    // Focus the existing window if a second instance is launched
    app.on('second-instance', () => {
        const wins = BrowserWindow.getAllWindows();
        if (wins.length > 0) {
            const win = wins[0];
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    app.whenReady().then(() => {
        createMainWindow();
        setupGeneralIpcHandlers();
        setupAIHandlers(sessionRef);
        setupRemoteAssistanceHandlers();
        console.log('🚀 [Optimization] App initialized with memory-efficient settings.');
    });
}
// ─────────────────────────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
    stopMacOSAudioCapture();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopMacOSAudioCapture();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

function setupGeneralIpcHandlers() {
    ipcMain.handle('quit-application', async event => {
        try {
            stopMacOSAudioCapture();
            app.quit();
            return { success: true };
        } catch (error) {
            console.error('Error quitting application:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('open-external', async (event, url) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (error) {
            console.error('Error opening external URL:', error);
            return { success: false, error: error.message };
        }
    });


    ipcMain.handle('update-content-protection', async event => {
        try {
            if (mainWindow) {
                // Get content protection setting from localStorage via window.cheddar
                const contentProtection = await mainWindow.webContents.executeJavaScript(
                    'window.interviewAI ? window.interviewAI.getContentProtection() : true'
                );
                mainWindow.setContentProtection(contentProtection);
                console.log('Content protection updated:', contentProtection);
            }
            return { success: true };
        } catch (error) {
            console.error('Error updating content protection:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-machine-id', async () => {
        try {
            const { machineIdSync } = require('node-machine-id');
            const machineId = machineIdSync();
            return machineId;
        } catch (error) {
            console.error('Error getting machine ID:', error);
            return null;
        }
    });
    ipcMain.on('close-app', () => {
        stopMacOSAudioCapture();
        app.quit();
    });
}

function setupRemoteAssistanceHandlers() {
    // Initialize input simulator
    const inputSimulator = getInputSimulator();
    inputSimulator.registerIpcHandlers(ipcMain);

    // Handle screen source requests for screen capture
    ipcMain.handle('get-screen-sources', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'], // Include both screens and windows
                thumbnailSize: { width: 150, height: 150 }
            });

            return sources.map(source => ({
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail.toDataURL(),
                type: source.id.startsWith('screen') ? 'screen' : 'window'
            }));
        } catch (error) {
            console.error('Error getting screen sources:', error);
            return [];
        }
    });

    // Handle request for main app window source specifically
    ipcMain.handle('get-app-window-source', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['window'],
                thumbnailSize: { width: 150, height: 150 }
            });

            console.log('Available windows:', sources.map(s => s.name));

            // Get the main window's native window ID  
            if (mainWindow && !mainWindow.isDestroyed()) {
                const windowId = mainWindow.getMediaSourceId();
                console.log('Main window ID:', windowId);

                // Find by exact window ID match
                const appWindow = sources.find(source => source.id === windowId);

                if (appWindow) {
                    console.log('Found app window by ID:', appWindow.name);
                    return {
                        id: appWindow.id,
                        name: appWindow.name,
                        thumbnail: appWindow.thumbnail.toDataURL(),
                        type: 'window'
                    };
                }
            }

            // Fallback: Try to find by name
            const appWindow = sources.find(source =>
                source.name.toLowerCase().includes('interview') ||
                source.name.toLowerCase().includes('desire') ||
                source.name.toLowerCase().includes(app.getName().toLowerCase())
            );

            if (appWindow) {
                console.log('Found app window by name:', appWindow.name);
                return {
                    id: appWindow.id,
                    name: appWindow.name,
                    thumbnail: appWindow.thumbnail.toDataURL(),
                    type: 'window'
                };
            }

            console.warn('App window not found! Available windows:', sources.map(s => s.name));
            return null;
        } catch (error) {
            console.error('Error getting app window source:', error);
            return null;
        }
    });

    console.log('Remote assistance handlers initialized');
}
