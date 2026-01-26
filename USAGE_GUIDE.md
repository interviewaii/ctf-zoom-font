# Audio Response Handler - Usage Guide

## Overview
Clean implementation of microphone audio capture and line-by-line response streaming.

## Functions

### 1. `startAudioListening()`
**Purpose**: Captures microphone audio and sends it to Gemini

**Usage**:
```javascript
// Start listening to microphone
const result = await window.audioResponseHandler.startAudioListening();
if (result.success) {
    console.log('Microphone is now listening!');
}
```

**What it does**:
- Requests microphone permission
- Captures audio in 50ms chunks
- Automatically sends audio to Gemini via `sendAudioToGemini()`

---

### 2. `sendAudioToGemini(audioChunk)`
**Purpose**: Sends audio chunks to Gemini in real-time

**Usage**:
```javascript
// This is called automatically by startAudioListening()
// But you can also call it manually:
const audioData = new Float32Array([...]); // Your audio data
await window.audioResponseHandler.sendAudioToGemini(audioData);
```

**What it does**:
- Converts Float32 audio to Int16 PCM
- Encodes to Base64
- Sends to Gemini via IPC

---

### 3. `displayNewResponse()`
**Purpose**: Creates a new response card in the UI

**Usage**:
```javascript
// Create a new response card
window.audioResponseHandler.displayNewResponse();
```

**What it does**:
- Resets the response buffer
- Adds empty response to AssistantView
- Prepares for new content

---

### 4. `updateResponseLineByLine(textChunk)`
**Purpose**: Updates response as lines come in from Gemini

**Usage**:
```javascript
// This is called automatically when Gemini sends responses
// But you can also call it manually:
window.audioResponseHandler.updateResponseLineByLine('Hello ');
window.audioResponseHandler.updateResponseLineByLine('world!');
// Result: "Hello world!"
```

**What it does**:
- Strips timing prefixes like `[2.3s]`
- Appends text to current response buffer
- Updates the UI in real-time

---

### 5. `copyResponseToClipboard(responseIndex)`
**Purpose**: Copies a response to clipboard

**Usage**:
```javascript
// Copy the last response
await window.audioResponseHandler.copyResponseToClipboard();

// Copy a specific response (by index)
await window.audioResponseHandler.copyResponseToClipboard(0); // First response
await window.audioResponseHandler.copyResponseToClipboard(1); // Second response
```

**What it does**:
- Gets response from AssistantView
- Copies full text to clipboard
- Returns success status

---

## Complete Example

```javascript
// 1. Start microphone listening
await window.audioResponseHandler.startAudioListening();

// 2. Gemini automatically receives audio and starts responding

// 3. Responses appear line-by-line automatically via IPC events
//    (You don't need to call displayNewResponse or updateResponseLineByLine manually)

// 4. Copy the latest response to clipboard
await window.audioResponseHandler.copyResponseToClipboard();

// 5. Stop listening when done
await window.audioResponseHandler.stopAudioListening();
```

## How It Works

### Audio Flow:
```
Microphone → startAudioListening() → sendAudioToGemini() → IPC → Gemini API
```

### Response Flow:
```
Gemini API → IPC Event 'update-response-stream' → updateResponseLineByLine() → UI Update
```

## Integration

Add to your `index.html` or preload script:

```html
<script src="./src/loadAudioHandler.js"></script>
```

Or import in your JavaScript:

```javascript
const audioHandler = require('./utils/audioResponseHandler');
```

## IPC Events

The handler listens to these IPC events from the main process:

- `update-response-stream`: Real-time text chunks from Gemini
- `update-response`: Complete response (fallback)

These are already set up in `gemini.js` - no additional configuration needed!

## Features

✅ **Automatic Response Display**: Responses appear automatically as Gemini sends them
✅ **Clean Text**: Removes timing prefixes like `[2.3s]` from responses  
✅ **Real-time Updates**: Shows text as it arrives, line by line
✅ **Easy Copy**: One function to copy any response to clipboard
✅ **No Manual Calls Needed**: Audio and responses work automatically once started

## Troubleshooting

**Microphone not working?**
- Check browser permissions
- Try HTTPS (some browsers require secure context)

**Responses not showing?**
- Check `assistant-view` element exists
- Check console for IPC event logs

**No audio being sent?**
- Check `gemini.js` has active session
- Verify IPC handlers are registered
