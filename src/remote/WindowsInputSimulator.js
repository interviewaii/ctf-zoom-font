const { exec } = require('child_process');
const { screen } = require('electron');
const util = require('util');
const path = require('path');
const execPromise = util.promisify(exec);

/**
 * Simple Windows Input Simulator using Python + ctypes
 * Fallback when robotjs/@nut-tree are not available
 */
class WindowsInputSimulator {
    constructor() {
        this.platform = process.platform;
        this.isWindows = this.platform === 'win32';
        this.pythonScript = path.join(__dirname, 'python_input.py');

        if (!this.isWindows) {
            console.warn('WindowsInputSimulator only works on Windows');
        }

        console.log('Initialized Windows Python input simulator');
    }

    /**
     * Simulate mouse movement using PowerShell
     */
    async simulateMouseMove(x, y) {
        if (!this.isWindows) return;

        const display = screen.getPrimaryDisplay();
        const { width, height } = display.size;
        const screenX = Math.round(x * width);
        const screenY = Math.round(y * height);

        const script = `
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${screenX}, ${screenY})
        `;

        try {
            await execPromise(`powershell -Command "${script.replace(/\n/g, ' ')}"`);
        } catch (error) {
            // Ignore errors for performance
        }
    }

    /**
     * Simulate mouse click using PowerShell
     */
    async simulateMouseClick(button, down) {
        if (!this.isWindows) return;

        const eventMap = {
            left: down ? 0x0002 : 0x0004,
            right: down ? 0x0008 : 0x0010,
            middle: down ? 0x0020 : 0x0040
        };

        const event = eventMap[button] || eventMap.left;

        // Use a simpler approach with Add-Type and inline C#
        // Encode the script in base64 to avoid all quote escaping issues
        const script = `
Add-Type -Name User32 -Namespace Win32 -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int dwData, int extraInfo);' -ErrorAction SilentlyContinue
[Win32.User32]::mouse_event(${event}, 0, 0, 0, 0)
        `.trim();

        const base64Script = Buffer.from(script, 'utf16le').toString('base64');

        try {
            await execPromise(`powershell -EncodedCommand ${base64Script}`);
        } catch (error) {
            // Silently ignore - likely type already defined
            try {
                // Try again without Add-Type
                const retryScript = `[Win32.User32]::mouse_event(${event}, 0, 0, 0, 0)`;
                const retryBase64 = Buffer.from(retryScript, 'utf16le').toString('base64');
                await execPromise(`powershell -EncodedCommand ${retryBase64}`);
            } catch (retryError) {
                console.error('Error simulating click:', retryError.message);
            }
        }
    }

    /**
     * Simulate key press using PowerShell SendKeys
     */
    async simulateKeyPress(key) {
        if (!this.isWindows) return;

        // Map web keys to SendKeys format
        const keyMap = {
            'Enter': '{ENTER}',
            'Backspace': '{BACKSPACE}',
            'Tab': '{TAB}',
            'Escape': '{ESC}',
            'Delete': '{DELETE}',
            'ArrowUp': '{UP}',
            'ArrowDown': '{DOWN}',
            'ArrowLeft': '{LEFT}',
            'ArrowRight': '{RIGHT}',
            ' ': ' '
        };

        const mappedKey = keyMap[key] || key;

        const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${mappedKey}')
        `.trim();

        const base64Script = Buffer.from(script, 'utf16le').toString('base64');

        try {
            await execPromise(`powershell -EncodedCommand ${base64Script}`);
        } catch (error) {
            console.error('Error simulating key:', error.message);
        }
    }

    /**
     * Simulate input event using Python script
     */
    async simulateEvent(event) {
        if (!this.isWindows) return;

        try {
            const eventJson = JSON.stringify(event).replace(/"/g, '\\"');
            await execPromise(`python "${this.pythonScript}" "${eventJson}"`);
        } catch (error) {
            // Silently ignore errors for performance
        }
    }
}

module.exports = { WindowsInputSimulator };
