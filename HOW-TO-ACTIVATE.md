# How to Get Your Device ID and Activate License

## Step 1: Get Your Device ID

**Option A: From the Payment Alert (Easiest)**
1. Start the app
2. Generate 10 responses to trigger the alert
3. Your Device ID will be displayed prominently
4. Copy the Device ID (e.g., `A3F7B2C1`)

**Option B: From Browser Console**
1. Open the app
2. Press `F12` to open Developer Tools
3. Go to "Console" tab
4. Type: `localStorage.getItem('deviceId')`
5. Copy the first 8 characters

**Option C: Check Console Logs**
1. Open the app
2. Press `F12` → Console tab
3. Look for: `"Using Electron machine ID: A3F7B2C1..."`
4. Copy the first 8 characters shown

---

## Step 2: Send Device ID to Get License

Send your Device ID to the admin to get your license key.

**Example:**
- Your Device ID: `A3F7B2C1`
- You'll receive: `WEEK-A3F7B2C1-X9K2`

---

## Step 3: Activate License

1. Open the app
2. Generate 10 responses (if not already done)
3. Payment alert appears
4. Enter your license key in the input field
5. Click "Activate"
6. ✅ Done!

---

## Troubleshooting

### "No valid license" error

**Cause:** Device ID changed or doesn't match

**Solution:**
1. Open Console (`F12`)
2. Check current Device ID:
   ```javascript
   localStorage.getItem('deviceId')
   ```
3. If it's different from your license, clear and regenerate:
   ```javascript
   localStorage.clear()
   location.reload()
   ```
4. Get the NEW Device ID
5. Request a new license key with the new Device ID

### Device ID keeps changing

**This should NOT happen anymore!** The device ID is now persistent.

If it still changes:
1. Make sure you're using Electron (not browser)
2. Check console for "Using Electron machine ID" message
3. If you see "Generated fallback device ID", the Electron machine ID isn't working

---

## For Admin: Generating License Keys

1. Open `license-generator.html` in browser
2. Enter user's Device ID
3. Select tier (Weekly/Monthly/Daily)
4. Click "Generate License Key"
5. Copy and send to user

**Important:** The Device ID in the license MUST match the user's actual Device ID!
