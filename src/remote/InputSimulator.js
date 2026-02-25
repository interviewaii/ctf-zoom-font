const { screen, ipcMain, desktopCapturer } = require('electron');

/**
 * InputSimulator - Handles remote input simulation (mouse, keyboard)
 * Cross-platform using different approaches for Windows/Mac/Linux
 */
class InputSimulator {
    constructor() {
        this.robotjs = null;
        this.nutjs = null;
        this.platform = process.platform;
        this.isInitialized = false;
        this.rateLimiter = {
            lastEventTime: 0,
            eventsPerSecond: 0,
            maxEventsPerSecond: 100 // Prevent flooding
        };

        this.initialize();
    }

    /**
     * Initialize input simulation library
     */
    async initialize() {
        try {
            // Try to load @nut-tree/nut-js (cross-platform, recommended)
            try {
                const { mouse, keyboard, Key, Button } = await import('@nut-tree/nut-js');
                this.nutjs = { mouse, keyboard, Key, Button };
                console.log('Initialized @nut-tree/nut-js for input simulation');
                this.isInitialized = true;
                return;
            } catch (error) {
                console.warn('@nut-tree/nut-js not available:', error.message);
            }

            // Fallback: Try robotjs (Windows/Mac, native)
            try {
                this.robotjs = require('robotjs');
                console.log('Initialized robotjs for input simulation');
                this.isInitialized = true;
                return;
            } catch (error) {
                console.warn('robotjs not available:', error.message);
            }

            // Fallback: Use Windows PowerShell (Windows only)
            if (process.platform === 'win32') {
                const { WindowsInputSimulator } = require('./WindowsInputSimulator');
                this.windowsSim = new WindowsInputSimulator();
                console.log('Initialized Windows PowerShell input simulator');
                this.isInitialized = true;
                return;
            }

            console.error('No input simulation library available. Remote control will not work.');
            this.isInitialized = false;

        } catch (error) {
            console.error('Error initializing input simulator:', error);
            this.isInitialized = false;
        }
    }

    /**
     * Check if rate limit allows this event
     * @returns {boolean} True if event is allowed
     */
    checkRateLimit() {
        const now = Date.now();
        const timeDiff = now - this.rateLimiter.lastEventTime;

        if (timeDiff < 1000) {
            this.rateLimiter.eventsPerSecond++;

            if (this.rateLimiter.eventsPerSecond > this.rateLimiter.maxEventsPerSecond) {
                console.warn('Rate limit exceeded for input events');
                return false;
            }
        } else {
            this.rateLimiter.eventsPerSecond = 1;
            this.rateLimiter.lastEventTime = now;
        }

        return true;
    }

    /**
     * Simulate input event from remote viewer
     * @param {Object} event - Event data {type, x, y, button, key, etc.}
     */
    async simulateEvent(event) {
        console.log('InputSimulator: simulateEvent called with:', event.type);
        console.log('InputSimulator: isInitialized:', this.isInitialized);
        console.log('InputSimulator: Using library:', this.nutjs ? 'nutjs' : this.robotjs ? 'robotjs' : this.windowsSim ? 'windowsSim' : 'none');

        if (!this.isInitialized) {
            console.error('Input simulator not initialized');
            return;
        }

        if (!this.checkRateLimit()) {
            return; // Rate limited
        }

        try {
            switch (event.type) {
                case 'mousemove':
                    console.log('InputSimulator: Simulating mouse move to', event.x, event.y);
                    await this.simulateMouseMove(event.x, event.y);
                    break;

                case 'mousedown':
                case 'mouseup':
                    console.log('InputSimulator: Simulating mouse', event.type, event.button);
                    await this.simulateMouseClick(event.button, event.type === 'mousedown');
                    break;

                case 'click':
                    console.log('InputSimulator: Simulating click', event.button);
                    await this.simulateMouseClick(event.button || 'left', true);
                    await this.simulateMouseClick(event.button || 'left', false);
                    break;

                case 'dblclick':
                    console.log('InputSimulator: Simulating double click');
                    await this.simulateDoubleClick(event.button || 'left');
                    break;

                case 'scroll':
                    console.log('InputSimulator: Simulating scroll');
                    await this.simulateScroll(event.deltaX, event.deltaY);
                    break;

                case 'keydown':
                case 'keyup':
                    console.log('InputSimulator: Simulating key', event.type, event.key);
                    await this.simulateKey(event.key, event.type === 'keydown');
                    break;

                case 'keypress':
                    console.log('InputSimulator: Simulating keypress', event.key);
                    await this.simulateKeyPress(event.key);
                    break;

                default:
                    console.warn(`Unknown event type: ${event.type}`);
            }
        } catch (error) {
            console.error('Error simulating input event:', error);
        }
    }

    /**
     * Simulate mouse movement
     * @param {number} x - X coordinate (normalized 0-1)
     * @param {number} y - Y coordinate (normalized 0-1)
     */
    async simulateMouseMove(x, y) {
        // Convert normalized coordinates to screen coordinates
        const display = screen.getPrimaryDisplay();
        const { width, height } = display.size;
        const screenX = Math.round(x * width);
        const screenY = Math.round(y * height);

        if (this.nutjs) {
            await this.nutjs.mouse.setPosition({ x: screenX, y: screenY });
        } else if (this.robotjs) {
            this.robotjs.moveMouse(screenX, screenY);
        } else if (this.windowsSim) {
            await this.windowsSim.simulateMouseMove(x, y);
        }
    }

    /**
     * Simulate mouse click
     * @param {string} button - 'left', 'right', or 'middle'
     * @param {boolean} down - True for mousedown, false for mouseup
     */
    async simulateMouseClick(button, down) {
        if (this.nutjs) {
            const buttons = {
                'left': this.nutjs.Button.LEFT,
                'right': this.nutjs.Button.RIGHT,
                'middle': this.nutjs.Button.MIDDLE
            };

            const btn = buttons[button] || this.nutjs.Button.LEFT;

            if (down) {
                await this.nutjs.mouse.pressButton(btn);
            } else {
                await this.nutjs.mouse.releaseButton(btn);
            }
        } else if (this.robotjs) {
            const state = down ? 'down' : 'up';
            this.robotjs.mouseToggle(state, button);
        } else if (this.windowsSim) {
            await this.windowsSim.simulateMouseClick(button, down);
        }
    }

    /**
     * Simulate double click
     * @param {string} button - 'left', 'right', or 'middle'
     */
    async simulateDoubleClick(button) {
        if (this.nutjs) {
            const buttons = {
                'left': this.nutjs.Button.LEFT,
                'right': this.nutjs.Button.RIGHT,
                'middle': this.nutjs.Button.MIDDLE
            };
            const btn = buttons[button] || this.nutjs.Button.LEFT;
            await this.nutjs.mouse.doubleClick(btn);
        } else if (this.robotjs) {
            this.robotjs.mouseClick(button, true); // true for double-click
        }
    }

    /**
     * Simulate scroll wheel
     * @param {number} deltaX - Horizontal scroll
     * @param {number} deltaY - Vertical scroll
     */
    async simulateScroll(deltaX, deltaY) {
        if (this.nutjs) {
            // nut.js scroll is more limited
            const scrollAmount = Math.sign(deltaY) * 3;
            await this.nutjs.mouse.scrollDown(Math.abs(scrollAmount));
        } else if (this.robotjs) {
            // robotjs scroll: positive = down, negative = up
            this.robotjs.scrollMouse(Math.round(deltaX), Math.round(deltaY));
        }
    }

    /**
     * Simulate key press/release
     * @param {string} key - Key name
     * @param {boolean} down - True for keydown, false for keyup
     */
    async simulateKey(key, down) {
        const mappedKey = this.mapKey(key);

        if (this.nutjs) {
            if (down) {
                await this.nutjs.keyboard.pressKey(mappedKey);
            } else {
                await this.nutjs.keyboard.releaseKey(mappedKey);
            }
        } else if (this.robotjs) {
            const state = down ? 'down' : 'up';
            this.robotjs.keyToggle(mappedKey, state);
        }
    }

    /**
     * Simulate key press (down + up)
     * @param {string} key - Key name
     */
    async simulateKeyPress(key) {
        await this.simulateKey(key, true);
        await this.simulateKey(key, false);

        // Fallback for windowsSim
        if (this.windowsSim && !this.nutjs && !this.robotjs) {
            await this.windowsSim.simulateKeyPress(key);
        }
    }

    /**
     * Map web key names to library key names
     * @param {string} key - Web key name
     * @returns {string} Library key name
     */
    mapKey(key) {
        // Common key mappings
        const keyMap = {
            'Enter': 'enter',
            'Backspace': 'backspace',
            'Tab': 'tab',
            'Escape': 'escape',
            'Delete': 'delete',
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'Shift': 'shift',
            'Control': 'control',
            'Alt': 'alt',
            'Meta': 'command',
            ' ': 'space'
        };

        return keyMap[key] || key.toLowerCase();
    }

    /**
     * Register IPC handlers for input simulation
     * @param {Electron.IpcMain} ipcMain - Electron IPC main
     */
    registerIpcHandlers(ipcMain) {
        // DISABLED: Remote control causes crashes
        // Keeping view-only mode working
        /*
        ipcMain.on('simulate-input', (event, inputEvent) => {
            console.log('InputSimulator: Received simulate-input event:', inputEvent);
            this.simulateEvent(inputEvent);
        });
        */
        console.log('InputSimulator: Remote control disabled (view-only mode)');
    }
}

// Export singleton instance
let instance = null;

function getInputSimulator() {
    if (!instance) {
        instance = new InputSimulator();
    }
    return instance;
}

module.exports = { InputSimulator, getInputSimulator };
