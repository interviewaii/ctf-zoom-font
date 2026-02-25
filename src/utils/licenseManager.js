/**
 * License Manager - Handles license key generation, validation, and usage tracking
 */

const BACKEND_URL = 'https://interview-ai-backend.onrender.com';
export let serverTimeOffset = 0; // ms to add to local time to get server time
let lastSyncTime = 0;

/**
 * Get current synchronized time
 */
export function getSynchronizedTime() {
    return Date.now() + serverTimeOffset;
}

/**
 * Get device ID for server calls
 */
async function _getDeviceIdSafe() {
    try {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            const machineId = await ipcRenderer.invoke('get-machine-id');
            if (machineId) return machineId;
        }
    } catch (e) { }
    return localStorage.getItem('deviceId') || 'unknown';
}

// License Tiers
export const LICENSE_TIERS = {
    HOUR1: {
        code: 'HR01',
        name: '1 Hour Plan',
        interviewsPerDay: 0,
        responsesPerDay: 0,
        durationHours: 1,
        description: 'Unlimited responses for 1 hour'
    },
    HOUR2: {
        code: 'HR02',
        name: '2 Hour Plan',
        interviewsPerDay: 0,
        responsesPerDay: 0,
        durationHours: 2,
        description: 'Unlimited responses for 2 hours'
    },
    WEEKLY: {
        code: 'WEEK',
        name: 'Weekly Plan',
        interviewsPerDay: 0,
        responsesPerDay: 0,
        duration: 7,
        description: 'Unlimited interviews and responses'
    },
    MONTHLY: {
        code: 'MNTH',
        name: 'Monthly Plan',
        interviewsPerDay: 0,
        responsesPerDay: 0,
        duration: 30,
        description: 'Unlimited interviews and responses'
    },
    DAILY: {
        code: 'DALY',
        name: 'Daily Plan',
        interviewsPerDay: 0,
        responsesPerDay: 0,
        duration: 1,
        description: 'Unlimited interviews and responses'
    }
};

/**
 * Generate checksum for license key validation
 */
function generateChecksum(tier, deviceHash, expiry) {
    const combined = `${tier}${deviceHash}${expiry}SECRET_SALT_2025`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 4).toUpperCase();
}

/**
 * Generate license key for a specific device and tier
 */
export function generateLicenseKey(deviceId, tierCode, expiryDate = null) {
    const deviceHash = deviceId.substring(0, 8).toUpperCase();
    const expiry = expiryDate ? formatDate(expiryDate) : '';
    const checksum = generateChecksum(tierCode, deviceHash, expiry);

    if (expiry) {
        return `${tierCode}-${deviceHash}-${expiry}-${checksum}`;
    } else {
        return `${tierCode}-${deviceHash}-${checksum}`;
    }
}

/**
 * Format date as YYYYMMDD
 */
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Parse license key and extract components
 */
export function parseLicenseKey(key) {
    const parts = key.split('-');

    if (parts.length < 3) {
        return null;
    }

    const tier = parts[0];
    const deviceHash = parts[1];
    const hasExpiry = parts.length === 4;
    const expiry = hasExpiry ? parts[2] : null;
    const checksum = hasExpiry ? parts[3] : parts[2];

    return { tier, deviceHash, expiry, checksum };
}

/**
 * Validate license key format and checksum
 */
export function validateLicenseKey(key, currentDeviceId) {
    const parsed = parseLicenseKey(key);
    if (!parsed) return { valid: false, error: 'Invalid key format' };

    const { tier, deviceHash, expiry, checksum } = parsed;

    // Verify tier exists
    const tierInfo = Object.values(LICENSE_TIERS).find(t => t.code === tier);
    if (!tierInfo) {
        return { valid: false, error: 'Invalid license tier' };
    }

    // Verify device hash matches
    const currentDeviceHash = currentDeviceId.substring(0, 8).toUpperCase();
    if (deviceHash !== currentDeviceHash) {
        return { valid: false, error: 'License key is for a different device' };
    }

    // Verify checksum
    const expectedChecksum = generateChecksum(tier, deviceHash, expiry || '');
    if (checksum !== expectedChecksum) {
        return { valid: false, error: 'Invalid license key (checksum mismatch)' };
    }

    // Check expiry
    if (expiry) {
        const expiryDate = parseDate(expiry);
        const now = new Date();
        if (now > expiryDate) {
            return { valid: false, error: 'License key has expired' };
        }
    }

    return { valid: true, tier: tierInfo, expiry };
}

/**
 * Get synchronized server time
 */
async function getServerTime() {
    const now = Date.now();
    // Cache sync for 5 minutes
    if (lastSyncTime && (now - lastSyncTime < 5 * 60 * 1000)) {
        return now + serverTimeOffset;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/time`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            mode: 'cors'
        });
        const data = await response.json();
        if (data.success && data.timestamp) {
            serverTimeOffset = data.timestamp - Date.now();
            lastSyncTime = Date.now();
            return data.timestamp;
        }
    } catch (e) {
        console.warn('[License] Failed to sync with server time, using local clock.', e);
    }
    return Date.now(); // Fallback to local time
}

/**
 * Parse date from YYYYMMDD format
 */
function parseDate(dateStr) {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day, 23, 59, 59);
}

/**
 * Activate license
 * Automatically replaces existing license if present (allows upgrades without uninstall)
 */
/**
 * Check if a key has been burned (used and expired - one-time use)
 */
function isKeyBurned(key) {
    try {
        const burned = JSON.parse(localStorage.getItem('burnedKeys') || '[]');
        return burned.includes(key);
    } catch { return false; }
}

/**
 * Permanently burn a key so it can never be re-used
 */
function burnKey(key) {
    try {
        const burned = JSON.parse(localStorage.getItem('burnedKeys') || '[]');
        if (!burned.includes(key)) {
            burned.push(key);
            localStorage.setItem('burnedKeys', JSON.stringify(burned));
        }
    } catch (e) { console.error('[License] Failed to burn key:', e); }
}

/**
 * Remove a key from the burned list (allows re-activation)
 */
function unburnKey(key) {
    try {
        const burned = JSON.parse(localStorage.getItem('burnedKeys') || '[]');
        const idx = burned.indexOf(key);
        if (idx !== -1) {
            burned.splice(idx, 1);
            localStorage.setItem('burnedKeys', JSON.stringify(burned));
        }
    } catch (e) { /* ignore */ }
}

export async function activateLicense(key, deviceId) {
    // Allow re-activation: unburn the key if it was previously burned
    // (hourly keys for the same device produce identical strings, so a new purchase = same key)
    unburnKey(key);

    // 2. Local format and checksum validation
    const validation = validateLicenseKey(key, deviceId);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    // 3. SERVER-SIDE VALIDATION (optional — works offline too)
    let serverExpiry = null;
    try {
        const response = await fetch(`${BACKEND_URL}/api/license/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: key, deviceId: deviceId }),
            mode: 'cors'
        });

        const contentType = response.headers.get('content-type');
        if (response.ok && contentType && contentType.includes('application/json')) {
            const serverData = await response.json();
            if (serverData.success && serverData.expiryDate) {
                serverExpiry = serverData.expiryDate;
            }
            // If server explicitly rejects (e.g. key locked to another device), respect that
            if (!serverData.success && response.status === 403) {
                return { success: false, error: serverData.error || 'License rejected by server.' };
            }
        }
    } catch (e) {
        console.warn('[License] Server unavailable, proceeding with local-only activation.', e.message);
    }

    // 4. STORE LICENSE LOCALLY (works even if server was down)
    const tier = validation.tier;
    const expiry = serverExpiry ? formatDate(new Date(serverExpiry)) : validation.expiry;

    const existingLicense = getLicenseInfo();
    const isUpgrade = existingLicense && existingLicense.tier.code !== tier.code;

    localStorage.setItem('licenseKey', key);
    localStorage.setItem('licenseTier', tier.code);
    localStorage.setItem('licenseExpiry', expiry || '');
    localStorage.setItem('licenseActivatedDate', new Date().toISOString());

    // For hourly plans: store the precise expiry timestamp in ms
    if (tier.durationHours) {
        const expiryMs = Date.now() + serverTimeOffset + (tier.durationHours * 60 * 60 * 1000);
        localStorage.setItem('licenseExpiryTimestamp', expiryMs.toString());
    } else {
        localStorage.removeItem('licenseExpiryTimestamp');
    }

    resetUsageTracking();

    return {
        success: true,
        tier: tier.name,
        deviceId: deviceId.substring(0, 8).toUpperCase(),
        isUpgrade: isUpgrade,
        previousTier: existingLicense ? existingLicense.tier.name : null
    };
}

/**
 * Get current license information
 */
export function getLicenseInfo() {
    const key = localStorage.getItem('licenseKey');
    const tierCode = localStorage.getItem('licenseTier');
    const expiry = localStorage.getItem('licenseExpiry');
    const activatedDate = localStorage.getItem('licenseActivatedDate');

    if (!key || !tierCode) {
        return null;
    }

    const tier = Object.values(LICENSE_TIERS).find(t => t.code === tierCode);
    if (!tier) {
        return null;
    }

    return {
        key,
        tier,
        expiry: expiry ? parseDate(expiry) : null,
        activatedDate: activatedDate ? new Date(activatedDate) : null
    };
}

/**
 * Check if license is still valid
 */
export function isLicenseValid() {
    const info = getLicenseInfo();
    if (!info) return false;

    const key = localStorage.getItem('licenseKey');

    // Use synchronized time to prevent backdating exploits
    const nowTs = Date.now() + serverTimeOffset;
    const now = new Date(nowTs);

    // Trigger background sync for next time
    getServerTime();

    // HOURLY: Check minute-precision expiry timestamp
    if (info.tier.durationHours) {
        const expiryTimestamp = parseInt(localStorage.getItem('licenseExpiryTimestamp') || '0');
        if (!expiryTimestamp || nowTs > expiryTimestamp) {
            // Key has expired — burn it so it can never be reused
            if (key) burnKey(key);
            return false;
        }
        return true;
    }

    // DAY-BASED: Check day-based duration expiry
    if (info.tier.duration && info.activatedDate) {
        const expiryDate = new Date(info.activatedDate);
        expiryDate.setDate(expiryDate.getDate() + info.tier.duration);
        expiryDate.setHours(23, 59, 59, 999);
        if (now > expiryDate) {
            if (key) burnKey(key);
            return false;
        }
    }

    // Check explicit expiry date if set
    if (info.expiry && now > info.expiry) {
        if (key) burnKey(key);
        return false;
    }

    return true;
}

/**
 * Check with the server if the current license has been banned by admin.
 * Returns { banned: true, message } or { banned: false }.
 * Silently returns { banned: false } if server is unreachable.
 */
export async function checkLicenseBanStatus() {
    const key = localStorage.getItem('licenseKey');
    if (!key) return { banned: false };

    try {
        const deviceId = await _getDeviceIdSafe();
        const response = await fetch(`${BACKEND_URL}/api/license/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: key, deviceId: deviceId }),
            mode: 'cors'
        });

        const ct = response.headers.get('content-type');
        if (response.ok && ct && ct.includes('application/json')) {
            const data = await response.json();
            if (data.status === 'banned') {
                // Burn the key locally so it can't be reused
                burnKey(key);
                // Clear all license data
                localStorage.removeItem('licenseKey');
                localStorage.removeItem('licenseTier');
                localStorage.removeItem('licenseExpiry');
                localStorage.removeItem('licenseActivatedDate');
                localStorage.removeItem('licenseExpiryTimestamp');
                return { banned: true, message: data.message || 'Your license has been banned by the administrator.' };
            }
        }
    } catch (e) {
        // Server unreachable — don't block the user
    }
    return { banned: false };
}

/**
 * Reset usage tracking
 */
function resetUsageTracking() {
    const today = new Date().toDateString();
    localStorage.setItem('usageDate', today);
    localStorage.setItem('dailyResponses', '0');
    localStorage.setItem('dailyInterviews', '0');
    localStorage.setItem('weeklyInterviews', '0');
    localStorage.setItem('weekStartDate', today);
}

/**
 * Check and reset daily usage if needed
 */
function checkAndResetDaily() {
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem('usageDate');

    if (lastDate !== today) {
        localStorage.setItem('usageDate', today);
        localStorage.setItem('dailyResponses', '0');
        localStorage.setItem('dailyInterviews', '0');
    }
}

/**
 * Check and reset weekly usage if needed
 */
function checkAndResetWeekly() {
    const today = new Date();
    const weekStart = localStorage.getItem('weekStartDate');

    if (!weekStart) {
        localStorage.setItem('weekStartDate', today.toDateString());
        localStorage.setItem('weeklyInterviews', '0');
        return;
    }

    const weekStartDate = new Date(weekStart);
    const daysDiff = Math.floor((today - weekStartDate) / (1000 * 60 * 60 * 24));

    // Reset if 7 days have passed
    if (daysDiff >= 7) {
        localStorage.setItem('weekStartDate', today.toDateString());
        localStorage.setItem('weeklyInterviews', '0');
    }
}

/**
 * Check if user can start a new interview
 */
export function canStartInterview() {
    if (!isLicenseValid()) {
        return { allowed: false, reason: 'No valid license' };
    }

    const info = getLicenseInfo();
    checkAndResetDaily();
    checkAndResetWeekly();

    const dailyInterviews = parseInt(localStorage.getItem('dailyInterviews') || '0');

    // Check daily interview limit from tier configuration
    if (info.tier.interviewsPerDay) {
        if (dailyInterviews >= info.tier.interviewsPerDay) {
            return {
                allowed: false,
                reason: `Daily interview limit reached (${info.tier.interviewsPerDay} per day)`
            };
        }
    }

    return { allowed: true };
}

/**
 * Track interview start
 */
export function trackInterviewStart() {
    checkAndResetDaily();
    checkAndResetWeekly();

    const dailyInterviews = parseInt(localStorage.getItem('dailyInterviews') || '0');
    const weeklyInterviews = parseInt(localStorage.getItem('weeklyInterviews') || '0');

    localStorage.setItem('dailyInterviews', (dailyInterviews + 1).toString());
    localStorage.setItem('weeklyInterviews', (weeklyInterviews + 1).toString());
}

/**
 * Check if user can get more responses — UNLIMITED for all users
 */
export function canGetResponse() {
    return { allowed: true }; // All plans have unlimited responses
}

/**
 * Track response
 */
export function trackResponse() {
    checkAndResetDaily();

    const dailyResponses = parseInt(localStorage.getItem('dailyResponses') || '0');
    localStorage.setItem('dailyResponses', (dailyResponses + 1).toString());
}

/**
 * Get usage statistics
 */
export function getUsageStats() {
    checkAndResetDaily();
    checkAndResetWeekly();

    return {
        dailyResponses: parseInt(localStorage.getItem('dailyResponses') || '0'),
        dailyInterviews: parseInt(localStorage.getItem('dailyInterviews') || '0'),
        weeklyInterviews: parseInt(localStorage.getItem('weeklyInterviews') || '0')
    };
}

/**
 * Deactivate license
 */
export function deactivateLicense() {
    localStorage.removeItem('licenseKey');
    localStorage.removeItem('licenseTier');
    localStorage.removeItem('licenseExpiry');
    localStorage.removeItem('licenseActivatedDate');
    localStorage.removeItem('licenseExpiryTimestamp');
    localStorage.removeItem('usageDate');
    localStorage.removeItem('dailyResponses');
    localStorage.removeItem('dailyInterviews');
    localStorage.removeItem('weeklyInterviews');
    localStorage.removeItem('weekStartDate');
    // NOTE: we intentionally do NOT clear 'burnedKeys' — expired keys stay burned forever
}
