/**
 * Device ID utility for device-locked activation
 * Generates unique device identifiers and manages activation hashing
 */

/**
 * Get unique device identifier
 * Uses Electron's machine ID or generates a persistent fallback
 */
export async function getDeviceId() {
    try {
        // Try to get machine ID from Electron
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            const machineId = await ipcRenderer.invoke('get-machine-id');
            if (machineId) {
                console.log('Using Electron machine ID:', machineId.substring(0, 8) + '...');
                return machineId;
            }
        }
    } catch (error) {
        console.warn('Failed to get machine ID from Electron:', error);
    }

    // Fallback: Generate or retrieve persistent device ID from localStorage
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        // Generate a unique ID based on browser fingerprint
        deviceId = await generateFallbackDeviceId();
        localStorage.setItem('deviceId', deviceId);
        console.log('Generated fallback device ID:', deviceId.substring(0, 8) + '...');
    } else {
        console.log('Using stored device ID:', deviceId.substring(0, 8) + '...');
    }
    return deviceId;
}

/**
 * Get device ID formatted for display to user
 */
export async function getDeviceIdForDisplay() {
    const deviceId = await getDeviceId();
    return deviceId.substring(0, 8).toUpperCase();
}

/**
 * Generate fallback device ID using browser fingerprint
 */
async function generateFallbackDeviceId() {
    const fingerprint = [
        navigator.userAgent,
        navigator.language,
        new Date().getTimezoneOffset(),
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        navigator.hardwareConcurrency || 'unknown',
        navigator.platform
        // Removed random component - device ID must be deterministic!
    ].join('|');

    return await hashString(fingerprint);
}

/**
 * Hash a string using SHA-256
 */
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create activation hash from code and device ID
 */
export async function hashActivation(code, deviceId) {
    const combined = `${code}:${deviceId}`;
    return await hashString(combined);
}

/**
 * Verify activation code against stored hash
 */
export async function verifyActivation(code, storedHash) {
    if (!storedHash || storedHash === 'true') {
        // Legacy activation (no device binding)
        return true;
    }

    const deviceId = await getDeviceId();
    const expectedHash = await hashActivation(code, deviceId);
    return expectedHash === storedHash;
}

/**
 * Check if activation is valid for current device
 */
export async function isActivationValid() {
    const activationData = localStorage.getItem('isActivated');

    if (!activationData || activationData === 'false') {
        return false;
    }

    if (activationData === 'true') {
        // Legacy activation - migrate to device-locked
        console.warn('Legacy activation detected - not device-locked');
        return true;
    }

    // Device-locked activation - verify it matches current device
    const storedCode = localStorage.getItem('activationCode');
    if (!storedCode) {
        // No code stored, but activation hash exists - assume valid
        return true;
    }

    return await verifyActivation(storedCode, activationData);
}

/**
 * Activate with device locking
 */
export async function activateWithDeviceLock(code) {
    const deviceId = await getDeviceId();
    const activationHash = await hashActivation(code, deviceId);

    // Store the hash and the code (for verification)
    localStorage.setItem('isActivated', activationHash);
    localStorage.setItem('activationCode', code);

    return {
        success: true,
        deviceId: deviceId.substring(0, 8) + '...' // Show partial ID for reference
    };
}

/**
 * Deactivate (clear activation)
 */
export function deactivate() {
    localStorage.removeItem('isActivated');
    localStorage.removeItem('activationCode');
}
