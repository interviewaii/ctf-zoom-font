/**
 * License Manager - Handles license key generation, validation, and usage tracking
 */

// License Tiers
export const LICENSE_TIERS = {
    WEEKLY: {
        code: 'WEEK',
        name: 'Weekly Plan',
        interviewsPerDay: 0,
        responsesPerDay: 0,
        duration: 7, // 7 days
        description: 'Unlimited interviews and responses'
    },
    MONTHLY: {
        code: 'MNTH',
        name: 'Monthly Plan',
        interviewsPerDay: 0,
        responsesPerDay: 0,
        duration: 30, // 30 days
        description: 'Unlimited interviews and responses'
    },
    DAILY: {
        code: 'DALY',
        name: 'Daily Plan',
        interviewsPerDay: 0,
        responsesPerDay: 0,
        duration: 1, // 1 day
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
export async function activateLicense(key, deviceId) {
    const validation = validateLicenseKey(key, deviceId);

    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    const { tier, expiry } = validation;

    // Check if there's an existing license
    const existingLicense = getLicenseInfo();
    const isUpgrade = existingLicense && existingLicense.tier.code !== tier.code;

    // Store new license information (replaces old one automatically)
    localStorage.setItem('licenseKey', key);
    localStorage.setItem('licenseTier', tier.code);
    localStorage.setItem('licenseExpiry', expiry || '');
    localStorage.setItem('licenseActivatedDate', new Date().toISOString());

    // Reset usage tracking for new license period
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

    // Check generic duration-based expiry (for all tiers with duration)
    if (info.tier.duration && info.activatedDate) {
        const expiryDate = new Date(info.activatedDate);
        expiryDate.setDate(expiryDate.getDate() + info.tier.duration);
        expiryDate.setHours(23, 59, 59, 999); // Set to end of day to give users full last day
        if (new Date() > expiryDate) {
            return false;
        }
    }

    // Check expiry date if set
    if (info.expiry && new Date() > info.expiry) {
        return false;
    }

    return true;
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
 * Check if user can get more responses
 */
export function canGetResponse() {
    if (!isLicenseValid()) {
        return { allowed: false, reason: 'No valid license' };
    }

    const info = getLicenseInfo();
    checkAndResetDaily();

    // Check daily response limit from tier configuration
    if (info.tier.responsesPerDay > 0) {
        const dailyResponses = parseInt(localStorage.getItem('dailyResponses') || '0');
        if (dailyResponses >= info.tier.responsesPerDay) {
            return {
                allowed: false,
                reason: `Daily response limit reached (${info.tier.responsesPerDay} per day)`
            };
        }
    }

    return { allowed: true };
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
    localStorage.removeItem('usageDate');
    localStorage.removeItem('dailyResponses');
    localStorage.removeItem('dailyInterviews');
    localStorage.removeItem('weeklyInterviews');
    localStorage.removeItem('weekStartDate');
}
