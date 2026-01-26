// Load the audio response handler
// Include this file in your index.html or main entry point

const audioHandler = require('./utils/audioResponseHandler');

console.log('✅ Audio Response Handler loaded');
console.log('Available functions:');
console.log('  - window.audioResponseHandler.startAudioListening()');
console.log('  - window.audioResponseHandler.sendAudioToGemini()');
console.log('  - window.audioResponseHandler.displayNewResponse()');
console.log('  - window.audioResponseHandler.updateResponseLineByLine()');
console.log('  - window.audioResponseHandler.copyResponseToClipboard()');
