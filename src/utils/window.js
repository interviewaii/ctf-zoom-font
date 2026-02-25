const { BrowserWindow, globalShortcut, ipcMain, screen, Menu, app } = require('electron');
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

function createWindow(sendToRenderer, sessionRef) {
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
            contextIsolation: false,
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

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;
    const x = Math.floor((screenWidth - windowWidth) / 2);
    const y = 0;
    mainWindow.setPosition(x, y);

    if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }

    mainWindow.loadFile(path.join(__dirname, '../index.html'));
    mainWindow.showInactive();
    mainWindow.webContents.setZoomFactor(1);

    mainWindow.webContents.once('dom-ready', () => {
        setTimeout(() => {
            const defaultKeybinds = getDefaultKeybinds();
            let keybinds = defaultKeybinds;

            mainWindow.webContents
                .executeJavaScript(`
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
            `)
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

                    try {
                        const contentProtection = await mainWindow.webContents.executeJavaScript(
                            'window.interviewCracker ? window.interviewCracker.getContentProtection() : true'
                        );
                        mainWindow.setContentProtection(contentProtection);
                    } catch (error) {
                        mainWindow.setContentProtection(true);
                    }

                    updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, sessionRef);
                })
                .catch(() => {
                    mainWindow.setContentProtection(true);
                    updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, sessionRef);
                });
        }, 150);
    });

    // Debounced saveBounds — only fires 500ms AFTER user stops resizing/moving
    // Calling executeJavaScript on every resize event is a major performance killer
    let saveBoundsTimer = null;
    const saveBounds = () => {
        if (mainWindow.isDestroyed()) return;
        clearTimeout(saveBoundsTimer);
        saveBoundsTimer = setTimeout(() => {
            if (mainWindow.isDestroyed()) return;
            const bounds = mainWindow.getBounds();
            mainWindow.webContents.executeJavaScript(`
                localStorage.setItem('windowSize', JSON.stringify({ width: ${bounds.width}, height: ${bounds.height} }));
                localStorage.setItem('windowPosition', JSON.stringify({ x: ${bounds.x}, y: ${bounds.y} }));
            `).catch(() => { });
        }, 500);
    };

    mainWindow.on('resize', saveBounds);
    mainWindow.on('move', saveBounds);

    setupWindowIpcHandlers(mainWindow, sendToRenderer, sessionRef);
    setupMenu();

    return mainWindow;
}

function setupMenu() {
    const template = [
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
                { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'delete' },
                { type: 'separator' }, { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
                { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
                { type: 'separator' }, { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }]
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function getDefaultKeybinds() {
    const isMac = process.platform === 'darwin';
    return {
        moveUp: 'Shift+Up',
        moveDown: 'Shift+Down',
        moveLeft: 'Shift+Left',
        moveRight: 'Shift+Right',
        toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
        toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
        nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
        previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
        nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
        scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
        scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
    };
}

function updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, sessionRef) {
    globalShortcut.unregisterAll();

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const moveIncrement = 50;

    const movementActions = {
        moveUp: () => {
            if (!mainWindow.isVisible()) return;
            const [x, y] = mainWindow.getPosition();
            mainWindow.setPosition(x, Math.max(0, y - moveIncrement));
        },
        moveDown: () => {
            if (!mainWindow.isVisible()) return;
            const [x, y] = mainWindow.getPosition();
            const [w, h] = mainWindow.getSize();
            mainWindow.setPosition(x, Math.min(height - h, y + moveIncrement));
        },
        moveLeft: () => {
            if (!mainWindow.isVisible()) return;
            const [x, y] = mainWindow.getPosition();
            mainWindow.setPosition(Math.max(0, x - moveIncrement), y);
        },
        moveRight: () => {
            if (!mainWindow.isVisible()) return;
            const [x, y] = mainWindow.getPosition();
            const [w, h] = mainWindow.getSize();
            mainWindow.setPosition(Math.min(width - w, x + moveIncrement), y);
        },
    };

    Object.keys(movementActions).forEach(action => {
        const keybind = keybinds[action];
        if (keybind) {
            try {
                globalShortcut.register(keybind, movementActions[action]);
            } catch (error) {
                console.error(`Failed to register ${action}:`, error);
            }
        }
    });

    if (keybinds.toggleVisibility) {
        globalShortcut.register(keybinds.toggleVisibility, () => {
            if (mainWindow.isVisible()) mainWindow.hide();
            else mainWindow.showInactive();
        });
    }

    if (keybinds.toggleClickThrough) {
        globalShortcut.register(keybinds.toggleClickThrough, () => {
            mouseEventsIgnored = !mouseEventsIgnored;
            mainWindow.setIgnoreMouseEvents(mouseEventsIgnored, { forward: true });
            mainWindow.webContents.send('click-through-toggled', mouseEventsIgnored);
        });
    }

    if (keybinds.nextStep) {
        globalShortcut.register(keybinds.nextStep, () => {
            const isMac = process.platform === 'darwin';
            const shortcutKey = isMac ? 'cmd+enter' : 'ctrl+enter';
            mainWindow.webContents.executeJavaScript(`
                if (window.interviewCracker && window.interviewCracker.handleShortcut) {
                    window.interviewCracker.handleShortcut('${shortcutKey}');
                }
            `);
        });
    }

    if (keybinds.previousResponse) {
        globalShortcut.register(keybinds.previousResponse, () => sendToRenderer('navigate-previous-response'));
    }
    if (keybinds.nextResponse) {
        globalShortcut.register(keybinds.nextResponse, () => sendToRenderer('navigate-next-response'));
    }
    if (keybinds.scrollUp) {
        globalShortcut.register(keybinds.scrollUp, () => sendToRenderer('scroll-response-up'));
    }
    if (keybinds.scrollDown) {
        globalShortcut.register(keybinds.scrollDown, () => sendToRenderer('scroll-response-down'));
    }

    // Register Trigger Answer Shortcut (F2)
    if (keybinds.triggerAnswer || 'F2') {
        const key = keybinds.triggerAnswer || 'F2';
        try {
            globalShortcut.register(key, () => {
                console.log('Trigger Answer shortcut triggered (F2)');
                if (sessionRef && typeof sessionRef.triggerManualAnswer === 'function') {
                    sessionRef.triggerManualAnswer();
                }
            });
        } catch (error) {
            console.error(`Failed to register triggerAnswer:`, error);
        }
    }

    // Register Enable Manual Mode Shortcut (F3)
    if (keybinds.enableManualMode || 'F3') {
        const key = keybinds.enableManualMode || 'F3';
        try {
            globalShortcut.register(key, () => {
                console.log('Enable Manual Mode shortcut triggered (F3)');
                if (sessionRef && typeof sessionRef.setManualMode === 'function') {
                    sessionRef.setManualMode(true);
                }
            });
        } catch (error) {
            console.error(`Failed to register enableManualMode:`, error);
        }
    }

    // Register Enable Auto Mode Shortcut (F4)
    if (keybinds.enableAutoMode || 'F4') {
        const key = keybinds.enableAutoMode || 'F4';
        try {
            globalShortcut.register(key, () => {
                console.log('Enable Auto Mode shortcut triggered (F4)');
                if (sessionRef && typeof sessionRef.setManualMode === 'function') {
                    sessionRef.setManualMode(false);
                }
            });
        } catch (error) {
            console.error(`Failed to register enableAutoMode:`, error);
        }
    }
}

function setupWindowIpcHandlers(mainWindow, sendToRenderer, sessionRef) {
    ipcMain.on('move-window', (event, direction) => {
        if (mainWindow.isDestroyed()) return;
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        const bounds = mainWindow.getBounds();
        const moveIncrement = 50;
        let newX = bounds.x, newY = bounds.y;

        switch (direction) {
            case 'up': newY = Math.max(0, bounds.y - moveIncrement); break;
            case 'down': newY = Math.min(height - bounds.height, bounds.y + moveIncrement); break;
            case 'left': newX = Math.max(0, bounds.x - moveIncrement); break;
            case 'right': newX = Math.min(width - bounds.width, bounds.x + moveIncrement); break;
        }
        mainWindow.setBounds({ x: newX, y: newY, width: bounds.width, height: bounds.height });
        mainWindow.webContents.send('window-moved', { x: newX, y: newY });
    });

    ipcMain.on('view-changed', (event, view) => {
        if (view !== 'assistant' && !mainWindow.isDestroyed()) {
            mainWindow.setIgnoreMouseEvents(false);
        }
    });

    ipcMain.handle('window-minimize', () => {
        if (!mainWindow.isDestroyed()) mainWindow.minimize();
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (!mainWindow.isDestroyed()) {
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer, sessionRef);
        }
    });

    ipcMain.handle('toggle-window-visibility', async () => {
        if (mainWindow.isDestroyed()) return { success: false };
        if (mainWindow.isVisible()) mainWindow.hide();
        else mainWindow.showInactive();
        return { success: true };
    });

    ipcMain.handle('toggle-screen-share-visibility', async (event, shouldShow) => {
        if (mainWindow.isDestroyed()) return { success: false };
        mainWindow.setContentProtection(!shouldShow);
        return { success: true };
    });

    function animateWindowResize(mainWindow, targetWidth, targetHeight, layoutMode) {
        return new Promise(resolve => {
            if (mainWindow.isDestroyed()) return resolve();
            if (resizeAnimation) clearInterval(resizeAnimation);

            const [startWidth, startHeight] = mainWindow.getSize();
            if (startWidth === targetWidth && startHeight === targetHeight) return resolve();

            // In packaged mode: skip animation, set size instantly (no IPC overhead)
            if (app.isPackaged) {
                mainWindow.setSize(targetWidth, targetHeight);
                const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
                mainWindow.setPosition(Math.floor((screenWidth - targetWidth) / 2), 0);
                return resolve();
            }

            windowResizing = true;
            mainWindow.setResizable(true);

            const frameRate = 30; // Reduced from 60fps — still smooth, half the IPC calls
            const totalFrames = Math.floor(RESIZE_ANIMATION_DURATION / (1000 / frameRate));
            let currentFrame = 0;
            const widthDiff = targetWidth - startWidth;
            const heightDiff = targetHeight - startHeight;
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width: screenWidth } = primaryDisplay.workAreaSize;

            resizeAnimation = setInterval(() => {
                currentFrame++;
                const progress = currentFrame / totalFrames;
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                const currentWidth = Math.round(startWidth + widthDiff * easedProgress);
                const currentHeight = Math.round(startHeight + heightDiff * easedProgress);

                if (!mainWindow || mainWindow.isDestroyed()) {
                    clearInterval(resizeAnimation);
                    windowResizing = false;
                    return;
                }
                mainWindow.setSize(currentWidth, currentHeight);
                mainWindow.setPosition(Math.floor((screenWidth - currentWidth) / 2), 0);

                if (currentFrame >= totalFrames) {
                    clearInterval(resizeAnimation);
                    windowResizing = false;
                    if (!mainWindow.isDestroyed()) {
                        mainWindow.setResizable(false);
                        mainWindow.setSize(targetWidth, targetHeight);
                        mainWindow.setPosition(Math.floor((screenWidth - targetWidth) / 2), 0);
                    }
                    resolve();
                }
            }, 1000 / frameRate);
        });
    }

    ipcMain.handle('update-sizes', async () => {
        await animateWindowResize(mainWindow, 1100, 600, 'forced initial size');
        return { success: true };
    });

    ipcMain.handle('manual-resize', async () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setResizable(true);
            return { success: true };
        }
        return { success: false };
    });
}

module.exports = {
    ensureDataDirectories,
    createWindow,
    getDefaultKeybinds,
    updateGlobalShortcuts,
    setupWindowIpcHandlers,
};
