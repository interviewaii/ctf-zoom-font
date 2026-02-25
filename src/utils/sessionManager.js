/**
 * SessionManager - Manages user-specific session state
 * Prevents response overlap when multiple users run the application
 */

class SessionManager {
    constructor(userId) {
        this.userId = userId;
        this.sessionId = null;
        this.conversationHistory = [];
        this.sessionParams = null;
        this.isGeneratingFlag = false;
        this.resumeContext = '';

        // Audio processing state
        this.audioChunksForTranscription = [];
        this.receivedAudioBuffer = [];
        this.lastSentTranscription = "";
        this.lastSentTimestamp = 0;
        this.lastImageAnalysisTimestamp = 0;
        this.silenceTimer = null;
        this.manualTranscriptionBuffer = "";
        this.isManualMode = false;
        this.lastPartialResults = "";
        this.isTranscribing = false;
        this.messageBuffer = "";
        this.currentStream = null;
        this.ignorePendingResults = false;
        this.hasSpeechInActiveBuffer = false; // New flag for better VAD tracking
        this.isSilenceTimerActive = false; // Prevents double-waiting during silence

        const displayId = (typeof userId === 'string') ? userId : 'unknown';
        console.log(`[SessionManager] Created session for user: ${displayId.substring(0, 8)}...`);
    }

    /**
     * Get the user ID for this session
     */
    getUserId() {
        return this.userId;
    }

    /**
     * Initialize a new conversation session
     */
    initializeSession(params = {}) {
        this.sessionId = Date.now().toString();
        this.conversationHistory = [];
        this.sessionParams = {
            apiKey: params.apiKey || '',
            customPrompt: params.customPrompt || '',
            resumeContext: params.resumeContext || this.resumeContext,
            profile: params.profile || 'interview',
            language: params.language || 'en-US',
        };
        this.isGeneratingFlag = false;
        this.ignorePendingResults = false;
        this.hasSpeechInActiveBuffer = false;

        console.log(`[SessionManager] New session initialized for user ${this.userId.substring(0, 8)}...: ${this.sessionId}`);

        return this.sessionId;
    }

    /**
     * Save a conversation turn
     */
    saveConversationTurn(transcription, aiResponse) {
        if (!this.sessionId) {
            this.initializeSession();
        }

        const conversationTurn = {
            timestamp: Date.now(),
            transcription: transcription.trim(),
            ai_response: aiResponse.trim(),
        };

        this.conversationHistory.push(conversationTurn);

        // Prevent memory creep for long sessions (2-3 hours)
        if (this.conversationHistory.length > 50) {
            this.conversationHistory = this.conversationHistory.slice(-50);
            console.log(`[SessionManager] Trimmed conversation history to last 50 turns for user ${this.userId.substring(0, 8)}...`);
        }

        console.log(`[SessionManager] Saved conversation turn for user ${this.userId.substring(0, 8)}...:`, {
            transcription: transcription.substring(0, 50) + '...',
            responseLength: aiResponse.length
        });

        return conversationTurn;
    }

    /**
     * Get conversation history
     */
    getConversationHistory() {
        return this.conversationHistory;
    }

    /**
     * Get session parameters
     */
    getSessionParams() {
        return this.sessionParams || {};
    }

    /**
     * Get current session ID
     */
    getSessionId() {
        return this.sessionId;
    }

    /**
     * Set resume context for this user
     */
    setResumeContext(resumeText) {
        this.resumeContext = resumeText;
        if (this.sessionParams) {
            this.sessionParams.resumeContext = resumeText;
        }
        console.log(`[SessionManager] Resume context updated for user ${this.userId.substring(0, 8)}...: ${resumeText.length} chars`);
    }

    /**
     * Get resume context for this user
     */
    getResumeContext() {
        return this.resumeContext;
    }

    /**
     * Clear session data
     */
    clearSession() {
        this.sessionId = null;
        this.conversationHistory = [];
        this.isGeneratingFlag = false;
        this.stopProcessing(); // Ensure all buffers are cleared
        console.log(`[SessionManager] Session cleared for user ${this.userId.substring(0, 8)}...`);
    }

    /**
     * Immediately stop all processing and clear buffers
     */
    stopProcessing() {
        this.receivedAudioBuffer = [];
        this.audioChunksForTranscription = [];
        this.manualTranscriptionBuffer = "";
        this.messageBuffer = "";

        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }

        // Cancel any active stream if possible (though stream control is usually in the caller)
        if (this.currentStream && this.currentStream.controller) {
            try {
                this.currentStream.controller.abort();
            } catch (e) {
                // Ignore abort errors
            }
        }
        this.currentStream = null;

        this.isTranscribing = false;
        this.isGeneratingFlag = false;
        this.ignorePendingResults = true;
        this.hasSpeechInActiveBuffer = false;
        console.log(`[SessionManager] Stopped processing and cleared buffers for user ${this.userId.substring(0, 8)}...`);
    }

    /**
     * Check if AI is currently generating a response
     */
    isGenerating() {
        return this.isGeneratingFlag;
    }

    /**
     * Set the generating flag
     */
    setGenerating(value) {
        this.isGeneratingFlag = value;
        console.log(`[SessionManager] isGenerating set to ${value} for user ${this.userId.substring(0, 8)}...`);
    }

    /**
     * Get session data for persistence
     */
    getSessionData() {
        return {
            userId: this.userId,
            sessionId: this.sessionId,
            conversationHistory: this.conversationHistory,
            sessionParams: this.sessionParams,
            resumeContext: this.resumeContext,
        };
    }

    /**
     * Restore session from saved data
     */
    restoreSession(sessionData) {
        if (sessionData.userId !== this.userId) {
            console.warn(`[SessionManager] User ID mismatch during restore. Expected ${this.userId}, got ${sessionData.userId}`);
            return false;
        }

        this.sessionId = sessionData.sessionId;
        this.conversationHistory = sessionData.conversationHistory || [];
        this.sessionParams = sessionData.sessionParams;
        this.resumeContext = sessionData.resumeContext || '';

        console.log(`[SessionManager] Session restored for user ${this.userId.substring(0, 8)}...`);
        return true;
    }
}

module.exports = { SessionManager };
