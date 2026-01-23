const { BrowserWindow, globalShortcut, ipcMain, screen, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('os');

let mouseEventsIgnored = false;
let windowResizing = false;
let resizeAnimation = null;
const RESIZE_ANIMATION_DURATION = 500; // milliseconds

function ensureDataDirectories() {
    const homeDir = os.homedir();
    const interviewCrackerDir = path.join(homeDir, 'desire-ai');
    const dataDir = path.join(interviewCrackerDir, 'data');
    const imageDir = path.join(dataDir, 'image');
    const audioDir = path.join(dataDir, 'audio');

    [interviewCrackerDir, dataDir, imageDir, audioDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    return { imageDir, audioDir };
}

function createWindow(sendToRenderer, geminiSessionRef) {
    // Get layout preference (default to 'normal')
    let windowWidth = 1100;
    let windowHeight = 600;

    const mainWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        minWidth: 400,
        minHeight: 300,
        frame: false,
        transparent: true,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // TODO: change to true
            backgroundThrottling: false,
            enableBlinkFeatures: 'GetDisplayMedia',
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
        backgroundColor: '#00000000',
    });

    const { session, desktopCapturer } = require('electron');
    session.defaultSession.setDisplayMediaRequestHandler(
        (request, callback) => {
            desktopCapturer.getSources({ types: ['screen'] }).then(sources => {
                callback({ video: sources[0], audio: 'loopback' });
            });
        },
        { useSystemPicker: true }
    );

    mainWindow.setResizable(true);
    mainWindow.setContentProtection(true);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Center window at the top of the screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;
    const x = Math.floor((screenWidth - windowWidth) / 2);
    const y = 0;
    mainWindow.setPosition(x, y);

    if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }

    mainWindow.loadFile(path.join(__dirname, '../index.html'));

    // Show the window after loading
    mainWindow.showInactive();

    // Allow renderer to handle zoom
    mainWindow.webContents.setZoomFactor(1);


    // After window is created, check for layout preference and resize if needed
    mainWindow.webContents.once('dom-ready', () => {
        setTimeout(() => {
            const defaultKeybinds = getDefaultKeybinds();
            let keybinds = defaultKeybinds;

            mainWindow.webContents
                .executeJavaScript(
                    `
                try {
                    const savedKeybinds = localStorage.getItem('customKeybinds');
                    const savedSize = localStorage.getItem('windowSize');
                    const savedPos = localStorage.getItem('windowPosition');
                    
                    return {
                        keybinds: savedKeybinds ? JSON.parse(savedKeybinds) : null,
                        size: savedSize ? JSON.parse(savedSize) : null,
                        position: savedPos ? JSON.parse(savedPos) : null
                    };
                } catch (e) {
                    return { keybinds: null, size: null, position: null };
                }
            `
                )
                .then(async savedSettings => {
                    if (savedSettings.keybinds) {
                        keybinds = { ...defaultKeybinds, ...savedSettings.keybinds };
                    }

                    if (savedSettings.size) {
                        mainWindow.setSize(savedSettings.size.width, savedSettings.size.height);
                    }
                    if (savedSettings.position) {
                        mainWindow.setPosition(savedSettings.position.x, savedSettings.position.y);
                    }

                    // Apply content protection setting via IPC handler
                    try {
                        const contentProtection = await mainWindow.webContents.executeJavaScript(
                            'window.interviewCracker ? window.interviewCracker.getContentProtection() : true'
                        );
                        mainWindow.setContentProtection(contentProtection);
                        console.log('Content protection loaded from settings:', contentProtection);
                    } catch (error) {
                        console.error('Error loading content protection:', error);
                        mainWindow.setContentProtection(true);
                    }

                    updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef);
                })
                .catch(() => {
                    // Default to content protection enabled
                    mainWindow.setContentProtection(true);
                    updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef);
                });
        }, 150);
    });

    // Save window size and position on change
    const saveBounds = () => {
        if (mainWindow.isDestroyed()) return;
        const bounds = mainWindow.getBounds();
        mainWindow.webContents.executeJavaScript(`
            localStorage.setItem('windowSize', JSON.stringify({ width: ${bounds.width}, height: ${bounds.height} }));
            localStorage.setItem('windowPosition', JSON.stringify({ x: ${bounds.x}, y: ${bounds.y} }));
        `).catch(err => console.error('Failed to save window bounds:', err));
    };

    mainWindow.on('resize', saveBounds);
    mainWindow.on('move', saveBounds);

    setupWindowIpcHandlers(mainWindow, sendToRenderer, geminiSessionRef);
    setupMenu();

    return mainWindow;
}

function setupMenu() {
    const template = [
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { role: 'close' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function getDefaultKeybinds() {
    const isMac = process.platform === 'darwin';
    return {
        moveUp: isMac ? 'Shift+Up' : 'Shift+Up',
        moveDown: isMac ? 'Shift+Down' : 'Shift+Down',
        moveLeft: isMac ? 'Shift+Left' : 'Shift+Left',
        moveRight: isMac ? 'Shift+Right' : 'Shift+Right',
        toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
        toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
        nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
        previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
        nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
        scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
        scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
    };
}

function updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef) {
    console.log('Updating global shortcuts with:', keybinds);

    // Unregister all existing shortcuts
    globalShortcut.unregisterAll();

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const moveIncrement = Math.floor(Math.min(width, height) * 0.1);

    // Register window movement shortcuts with boundary checking
    const movementActions = {
        moveUp: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            const [windowWidth, windowHeight] = mainWindow.getSize();
            const newY = Math.max(0, currentY - moveIncrement);
            mainWindow.setPosition(currentX, newY);
            console.log(`Window moved UP to position: (${currentX}, ${newY})`);
        },
        moveDown: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            const [windowWidth, windowHeight] = mainWindow.getSize();
            const maxY = height - windowHeight;
            const newY = Math.min(maxY, currentY + moveIncrement);
            mainWindow.setPosition(currentX, newY);
            console.log(`Window moved DOWN to position: (${currentX}, ${newY})`);
        },
        moveLeft: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            const [windowWidth, windowHeight] = mainWindow.getSize();
            const newX = Math.max(0, currentX - moveIncrement);
            mainWindow.setPosition(newX, currentY);
            console.log(`Window moved LEFT to position: (${newX}, ${currentY})`);
        },
        moveRight: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            const [windowWidth, windowHeight] = mainWindow.getSize();
            const maxX = width - windowWidth;
            const newX = Math.min(maxX, currentX + moveIncrement);
            mainWindow.setPosition(newX, currentY);
            console.log(`Window moved RIGHT to position: (${newX}, ${currentY})`);
        },
    };

    // Register each movement shortcut
    Object.keys(movementActions).forEach(action => {
        const keybind = keybinds[action];
        if (keybind) {
            try {
                const success = globalShortcut.register(keybind, movementActions[action]);
                if (success) {
                    console.log(`✅ Registered global shortcut ${action}: ${keybind}`);
                } else {
                    console.error(`❌ Failed to register global shortcut ${action}: ${keybind} (already in use or invalid)`);

                    // Try fallback with Arrow suffix if it's a simple direction
                    if (['Up', 'Down', 'Left', 'Right'].includes(keybind.split('+').pop())) {
                        const fallback = keybind.replace(/Up|Down|Left|Right/, (m) => m + 'Arrow');
                        const fallbackSuccess = globalShortcut.register(fallback, movementActions[action]);
                        if (fallbackSuccess) {
                            console.log(`✅ Registered fallback global shortcut ${action}: ${fallback}`);
                        }
                    }
                }
            } catch (error) {
                console.error(`💥 Error registering ${action} (${keybind}):`, error);
            }
        }
    });

    // Register toggle visibility shortcut
    if (keybinds.toggleVisibility) {
        try {
            globalShortcut.register(keybinds.toggleVisibility, () => {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.showInactive();
                }
            });
            console.log(`Registered toggleVisibility: ${keybinds.toggleVisibility}`);
        } catch (error) {
            console.error(`Failed to register toggleVisibility (${keybinds.toggleVisibility}):`, error);
        }
    }

    // Register toggle click-through shortcut
    if (keybinds.toggleClickThrough) {
        try {
            globalShortcut.register(keybinds.toggleClickThrough, () => {
                mouseEventsIgnored = !mouseEventsIgnored;
                if (mouseEventsIgnored) {
                    mainWindow.setIgnoreMouseEvents(true, { forward: true });
                    console.log('Mouse events ignored');
                } else {
                    mainWindow.setIgnoreMouseEvents(false);
                    console.log('Mouse events enabled');
                }
                mainWindow.webContents.send('click-through-toggled', mouseEventsIgnored);
            });
            console.log(`Registered toggleClickThrough: ${keybinds.toggleClickThrough}`);
        } catch (error) {
            console.error(`Failed to register toggleClickThrough (${keybinds.toggleClickThrough}):`, error);
        }
    }

    // Register next step shortcut (either starts session or takes screenshot based on view)
    if (keybinds.nextStep) {
        try {
            globalShortcut.register(keybinds.nextStep, async () => {
                console.log('Next step shortcut triggered');
                try {
                    // Determine the shortcut key format
                    const isMac = process.platform === 'darwin';
                    const shortcutKey = isMac ? 'cmd+enter' : 'ctrl+enter';

                    // Use the new handleShortcut function
                    mainWindow.webContents.executeJavaScript(`
                        if (window.interviewCracker && window.interviewCracker.handleShortcut) {
  window.interviewCracker.handleShortcut('${shortcutKey}');
                        } else {
                            console.log('handleShortcut function not available');
                        }
                    `);
                } catch (error) {
                    console.error('Error handling next step shortcut:', error);
                }
            });
            console.log(`Registered nextStep: ${keybinds.nextStep}`);
        } catch (error) {
            console.error(`Failed to register nextStep (${keybinds.nextStep}):`, error);
        }
    }

    // Register previous response shortcut
    if (keybinds.previousResponse) {
        try {
            globalShortcut.register(keybinds.previousResponse, () => {
                console.log('Previous response shortcut triggered');
                sendToRenderer('navigate-previous-response');
            });
            console.log(`Registered previousResponse: ${keybinds.previousResponse}`);
        } catch (error) {
            console.error(`Failed to register previousResponse (${keybinds.previousResponse}):`, error);
        }
    }

    // Register next response shortcut
    if (keybinds.nextResponse) {
        try {
            globalShortcut.register(keybinds.nextResponse, () => {
                console.log('Next response shortcut triggered');
                sendToRenderer('navigate-next-response');
            });
            console.log(`Registered nextResponse: ${keybinds.nextResponse}`);
        } catch (error) {
            console.error(`Failed to register nextResponse (${keybinds.nextResponse}):`, error);
        }
    }

    // Register scroll up shortcut
    if (keybinds.scrollUp) {
        try {
            globalShortcut.register(keybinds.scrollUp, () => {
                console.log('Scroll up shortcut triggered');
                sendToRenderer('scroll-response-up');
            });
            console.log(`Registered scrollUp: ${keybinds.scrollUp}`);
        } catch (error) {
            console.error(`Failed to register scrollUp (${keybinds.scrollUp}):`, error);
        }
    }

    // Register scroll down shortcut
    if (keybinds.scrollDown) {
        try {
            globalShortcut.register(keybinds.scrollDown, () => {
                console.log('Scroll down shortcut triggered');
                sendToRenderer('scroll-response-down');
            });
            console.log(`Registered scrollDown: ${keybinds.scrollDown}`);
        } catch (error) {
            console.error(`Failed to register scrollDown (${keybinds.scrollDown}):`, error);
        }
    }
}

function setupWindowIpcHandlers(mainWindow, sendToRenderer, geminiSessionRef) {
    // Remove existing listeners to avoid duplicates
    ipcMain.removeAllListeners('move-window');
    ipcMain.removeAllListeners('view-changed');
    ipcMain.removeHandler('window-minimize');
    ipcMain.removeAllListeners('update-keybinds');
    ipcMain.removeHandler('toggle-window-visibility');
    ipcMain.removeHandler('toggle-screen-share-visibility');
    ipcMain.removeHandler('update-sizes');
    ipcMain.removeHandler('manual-resize');

    // Handle window movement via IPC (for Shift+Arrow keys from renderer)
    ipcMain.on('move-window', (event, direction) => {
        console.log('📨 Received move-window IPC message:', direction);

        if (mainWindow.isDestroyed()) {
            console.log('⚠️ Window is destroyed, cannot move');
            return;
        }

        try {
            // Get screen dimensions
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width, height } = primaryDisplay.workAreaSize;

            const bounds = mainWindow.getBounds();
            const moveIncrement = 50; // Fixed 50px increment for better control

            let newX = bounds.x;
            let newY = bounds.y;

            switch (direction) {
                case 'up':
                    newY = Math.max(0, bounds.y - moveIncrement);
                    break;
                case 'down':
                    const maxY = height - bounds.height;
                    newY = Math.min(maxY, bounds.y + moveIncrement);
                    break;
                case 'left':
                    newX = Math.max(0, bounds.x - moveIncrement);
                    break;
                case 'right':
                    const maxX = width - bounds.width;
                    newX = Math.min(maxX, bounds.x + moveIncrement);
                    break;
                default:
                    console.log('⚠️ Unknown direction:', direction);
                    return;
            }

            mainWindow.setBounds({
                x: newX,
                y: newY,
                width: bounds.width,
                height: bounds.height
            });
            console.log(`✅ Window moved ${direction.toUpperCase()} to position: (${newX}, ${newY})`);

            // Notify renderer about the move to ensure state is synced if needed
            mainWindow.webContents.send('window-moved', { x: newX, y: newY });
        } catch (error) {
            console.error('💥 Error moving window:', error);
        }
    });

    ipcMain.on('view-changed', (event, view) => {
        if (view !== 'assistant' && !mainWindow.isDestroyed()) {
            mainWindow.setIgnoreMouseEvents(false);
        }
    });

    ipcMain.handle('window-minimize', () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.minimize();
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (!mainWindow.isDestroyed()) {
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer, geminiSessionRef);
        }
    });

    ipcMain.handle('toggle-window-visibility', async event => {
        try {
            if (mainWindow.isDestroyed()) {
                return { success: false, error: 'Window has been destroyed' };
            }

            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.showInactive();
            }
            return { success: true };
        } catch (error) {
            console.error('Error toggling window visibility:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('toggle-screen-share-visibility', async (event, shouldShow) => {
        try {
            if (mainWindow.isDestroyed()) {
                return { success: false, error: 'Window has been destroyed' };
            }
            if (shouldShow) {
                mainWindow.setContentProtection(false);
            } else {
                mainWindow.setContentProtection(true);
            }
            return { success: true };
        } catch (error) {
            console.error('Error toggling screen share visibility:', error);
            return { success: false, error: error.message };
        }
    });

    function animateWindowResize(mainWindow, targetWidth, targetHeight, layoutMode) {
        return new Promise(resolve => {
            // Check if window is destroyed before starting animation
            if (mainWindow.isDestroyed()) {
                console.log('Cannot animate resize: window has been destroyed');
                resolve();
                return;
            }

            // Clear any existing animation
            if (resizeAnimation) {
                clearInterval(resizeAnimation);
                resizeAnimation = null;
            }

            const [startWidth, startHeight] = mainWindow.getSize();

            // If already at target size, no need to animate
            if (startWidth === targetWidth && startHeight === targetHeight) {
                console.log(`Window already at target size for ${layoutMode} mode`);
                resolve();
                return;
            }

            console.log(`Starting animated resize from ${startWidth}x${startHeight} to ${targetWidth}x${targetHeight}`);

            windowResizing = true;
            mainWindow.setResizable(true);

            const frameRate = 60; // 60 FPS
            const totalFrames = Math.floor(RESIZE_ANIMATION_DURATION / (1000 / frameRate));
            let currentFrame = 0;

            const widthDiff = targetWidth - startWidth;
            const heightDiff = targetHeight - startHeight;

            const primaryDisplay = screen.getPrimaryDisplay();
            const { width: screenWidth } = primaryDisplay.workAreaSize;

            resizeAnimation = setInterval(() => {
                currentFrame++;
                const progress = currentFrame / totalFrames;

                // Use easing function (ease-out)
                const easedProgress = 1 - Math.pow(1 - progress, 3);

                const currentWidth = Math.round(startWidth + widthDiff * easedProgress);
                const currentHeight = Math.round(startHeight + heightDiff * easedProgress);

                if (!mainWindow || mainWindow.isDestroyed()) {
                    clearInterval(resizeAnimation);
                    resizeAnimation = null;
                    windowResizing = false;
                    return;
                }
                mainWindow.setSize(currentWidth, currentHeight);

                // Re-center the window during animation
                const x = Math.floor((screenWidth - currentWidth) / 2);
                const y = 0;
                mainWindow.setPosition(x, y);

                if (currentFrame >= totalFrames) {
                    clearInterval(resizeAnimation);
                    resizeAnimation = null;
                    windowResizing = false;

                    // Check if window is still valid before final operations
                    if (!mainWindow.isDestroyed()) {
                        mainWindow.setResizable(false);

                        // Ensure final size is exact
                        mainWindow.setSize(targetWidth, targetHeight);
                        const finalX = Math.floor((screenWidth - targetWidth) / 2);
                        mainWindow.setPosition(finalX, 0);
                    }

                    console.log(`Animation complete: ${targetWidth}x${targetHeight}`);
                    resolve();
                }
            }, 1000 / frameRate);
        });
    }

    // In setupWindowIpcHandlers, override update-sizes to always use initial size
    ipcMain.handle('update-sizes', async event => {
        try {
            const targetWidth = 1100;
            const targetHeight = 600;
            const [currentWidth, currentHeight] = mainWindow.getSize();
            if (windowResizing) {
                console.log('Interrupting current resize animation');
            }
            await animateWindowResize(mainWindow, targetWidth, targetHeight, `forced initial size`);
            return { success: true };
        } catch (error) {
            console.error('Error updating sizes:', error);
            return { success: false, error: error.message };
        }
    });
}

ipcMain.handle('manual-resize', async (event) => {
    try {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setResizable(true);
            return { success: true };
        }
        return { success: false, error: 'Window not available' };
    } catch (e) {
        console.error('manual-resize error', e);
        return { success: false, error: e.message };
    }
});

module.exports = {
    ensureDataDirectories,
    createWindow,
    getDefaultKeybinds,
    updateGlobalShortcuts,
    setupWindowIpcHandlers,
};
