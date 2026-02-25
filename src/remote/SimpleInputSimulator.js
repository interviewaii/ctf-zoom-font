const { screen } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

/**
 * Fast Input Simulator using persistent Python process
 * Keeps one Python process running to avoid spawning overhead and crashes
 */
class FastInputSimulator {
    constructor() {
        this.platform = process.platform;
        this.isWindows = this.platform === 'win32';
        this.isInitialized = false;
        this.pythonProcess = null;

        console.log('Initializing FastInputSimulator...');
    }

    async initialize() {
        if (!this.isWindows) {
            console.warn('FastInputSimulator only works on Windows');
            return;
        }

        try {
            // Start persistent Python process
            const pythonScript = path.join(__dirname, 'python_input_persistent.py');
            this.pythonProcess = spawn('python', [pythonScript]);

            this.pythonProcess.stderr.on('data', (data) => {
                console.log('Python:', data.toString().trim());
            });

            this.pythonProcess.on('error', (error) => {
                console.error('Python process error:', error);
                this.isInitialized = false;
            });

            this.pythonProcess.on('exit', (code) => {
                console.log('Python process exited with code:', code);
                this.isInitialized = false;
            });

            // Wait a bit for process to start
            await new Promise(resolve => setTimeout(resolve, 500));

            this.isInitialized = true;
            console.log('FastInputSimulator: Initialized with persistent Python process');
        } catch (error) {
            console.error('FastInputSimulator: Initialization failed:', error.message);
            this.isInitialized = false;
        }
    }

    /**
     * Send event to persistent Python process
     */
    async sendEvent(event) {
        if (!this.isInitialized || !this.pythonProcess) {
            return;
        }

        try {
            // Base64 encode JSON
            const eventJson = JSON.stringify(event);
            const base64Event = Buffer.from(eventJson).toString('base64');

            // Send to Python process via stdin
            this.pythonProcess.stdin.write(base64Event + '\n');
        } catch (error) {
            console.error('Error sending event:', error.message);
        }
    }

    /**
     * Simulate mouse movement
     */
    async simulateMouseMove(x, y) {
        await this.sendEvent({
            type: 'mousemove',
            x: x,
            y: y
        });
    }

    /**
     * Simulate mouse click
     */
    async simulateMouseClick(button, down) {
        await this.sendEvent({
            type: down ? 'mousedown' : 'mouseup',
            button: button || 'left'
        });
    }

    /**
     * Simulate keyboard key press
     */
    async simulateKeyPress(key) {
        await this.sendEvent({
            type: 'keypress',
            key: key
        });
    }

    /**
     * Simulate input event
     */
    async simulateEvent(event) {
        if (!this.isInitialized) {
            console.warn('⚠️ Simulator not initialized!');
            return;
        }

        try {
            switch (event.type) {
                case 'mousemove':
                    await this.simulateMouseMove(event.x, event.y);
                    break;

                case 'mousedown':
                    await this.simulateMouseClick(event.button || 'left', true);
                    break;

                case 'mouseup':
                    await this.simulateMouseClick(event.button || 'left', false);
                    break;

                case 'click':
                    await this.simulateMouseClick(event.button || 'left', true);
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await this.simulateMouseClick(event.button || 'left', false);
                    break;

                case 'keypress':
                case 'keydown':
                    await this.simulateKeyPress(event.key);
                    break;
            }
        } catch (error) {
            console.error('❌ Error in simulateEvent:', error);
        }
    }

    /**
     * Register IPC handlers for input simulation
     */
    registerIpcHandlers(ipcMain) {
        ipcMain.on('simulate-input', (event, inputEvent) => {
            this.simulateEvent(inputEvent);
        });
        console.log('FastInputSimulator: IPC handlers registered');
    }

    /**
     * Cleanup - kill Python process
     */
    cleanup() {
        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }
    }
}

// Singleton instance
let inputSimulatorInstance = null;

/**
 * Get or create the input simulator instance
 */
function getInputSimulator() {
    if (!inputSimulatorInstance) {
        inputSimulatorInstance = new FastInputSimulator();
        inputSimulatorInstance.initialize();
    }
    return inputSimulatorInstance;
}

module.exports = { FastInputSimulator, getInputSimulator };
