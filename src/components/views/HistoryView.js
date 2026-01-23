import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { resizeLayout } from '../../utils/windowResize.js';

export class HistoryView extends LitElement {
    static styles = css`
        * {
            font-family:
                'Inter',
                -apple-system,
                BlinkMacSystemFont,
                sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            padding: 12px;
            margin: 0 auto;
            max-width: 700px;
        }

        .history-container {
            display: grid;
            gap: 12px;
            padding-bottom: 20px;
        }

        .history-tabs {
            display: flex;
            gap: 12px;
            margin-bottom: 18px;
            justify-content: center;
        }

        .tab-btn {
            background: var(--button-background);
            color: var(--text-color);
            border: 1.5px solid var(--card-border);
            border-radius: 18px 18px 0 0;
            font-weight: 600;
            font-size: 15px;
            padding: 10px 22px;

            transition: all 0.2s ease;
        }

        .tab-btn.active, .tab-btn:hover {
            background: var(--hover-background);
            color: var(--text-color);
            border-bottom: 2.5px solid var(--accent-color);
        }

        .history-tab-content {
            min-height: 320px;
        }

        .history-card {
            background: var(--card-background);
            border: 1.5px solid var(--card-border);
            border-radius: 18px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            padding: 32px 28px 24px 28px;
            margin: 0 auto;
            max-width: 420px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 18px;
        }

        .card-title {
            font-size: 18px;
            font-weight: 700;
            color: var(--text-color);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .card-content {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .sessions-list {
            max-height: 300px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .session-item {
            background: var(--button-background);
            border: 1.5px solid var(--card-border);
            border-radius: 12px;
            padding: 12px;

            transition: all 0.2s ease;
        }

        .session-item:hover {
            background: var(--hover-background);
            border-color: var(--accent-color);
            transform: translateY(-1px);
        }

        .session-item.selected {
            background: var(--screen-option-selected-background);
            border-color: var(--accent-color);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .session-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }

        .session-date {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-color);
        }

        .session-time {
            font-size: 11px;
            color: var(--description-color);
        }

        .session-preview {
            font-size: 11px;
            color: var(--description-color);
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .conversation-view {
            max-height: 300px;
            overflow-y: auto;
            background: var(--card-background);
            border: 1.5px solid var(--card-border);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .message {
            padding: 10px 12px;
            border-radius: 8px;
            font-size: 12px;
            line-height: 1.4;
            position: relative;
        }

        .message.user {
            background: rgba(88, 101, 242, 0.15);
            border-left: 3px solid var(--primary-color);
            margin-left: 8px;
        }

        .message.ai {
            background: rgba(237, 66, 69, 0.15);
            border-left: 3px solid var(--danger-color);
            margin-left: 8px;
        }

        .back-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .back-button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1.5px solid var(--card-border);
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 500;

            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
        }

        .back-button:hover {
            background: var(--hover-background);
            border-color: var(--accent-color);
        }

        .legend {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: var(--description-color);
        }

        .legend-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .legend-dot.user {
            background-color: #5865f2;
        }

        .legend-dot.ai {
            background-color: #ed4245;
        }

        .empty-state {
            text-align: center;
            color: var(--description-color);
            font-size: 12px;
            padding: 20px;
        }

        .empty-state-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 6px;
            color: var(--text-color);
        }

        .loading {
            text-align: center;
            color: var(--description-color);
            font-size: 12px;
            padding: 20px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px;
            margin-top: 8px;
        }

        .stat-item {
            background: var(--button-background);
            border: 1.5px solid var(--card-border);
            border-radius: 8px;
            padding: 12px;
            text-align: center;
        }

        .stat-number {
            font-size: 18px;
            font-weight: 700;
            color: var(--text-color);
            margin-bottom: 4px;
        }

        .stat-label {
            font-size: 10px;
            color: var(--description-color);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .form-description {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
            margin-top: 2px;
        }

        /* Scrollbar styles */
        .sessions-list::-webkit-scrollbar,
        .conversation-view::-webkit-scrollbar {
            width: 6px;
        }

        .sessions-list::-webkit-scrollbar-track,
        .conversation-view::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
        }

        .sessions-list::-webkit-scrollbar-thumb,
        .conversation-view::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .sessions-list::-webkit-scrollbar-thumb:hover,
        .conversation-view::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }
    `;

    static properties = {
        sessions: { type: Array },
        selectedSession: { type: Object },
        loading: { type: Boolean },
        activeTab: { type: String },
    };

    constructor() {
        super();
        this.sessions = [];
        this.selectedSession = null;
        this.loading = true;
        this.activeTab = 'sessions';
        this.loadSessions();
    }

    connectedCallback() {
        super.connectedCallback();
        // Resize window for this view
        resizeLayout();
    }

    async loadSessions() {
        try {
            this.loading = true;
            if (window.interviewCracker && window.interviewCracker.getAllConversationSessions) {
                this.sessions = await window.interviewCracker.getAllConversationSessions();
            }
        } catch (error) {
            console.error('Error loading conversation sessions:', error);
            this.sessions = [];
        } finally {
            this.loading = false;
        }
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    getSessionPreview(session) {
        if (!session.conversationHistory || session.conversationHistory.length === 0) {
            return 'No conversation yet';
        }

        const firstTurn = session.conversationHistory[0];
        const preview = firstTurn.transcription || firstTurn.ai_response || 'Empty conversation';
        return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
    }

    handleSessionClick(session) {
        this.selectedSession = session;
        this.activeTab = 'conversation';
    }

    handleBackClick() {
        this.selectedSession = null;
        this.activeTab = 'sessions';
    }

    setTab(tab) {
        this.activeTab = tab;
        if (tab === 'sessions') {
            this.selectedSession = null;
        }
    }

    getStats() {
        const totalSessions = this.sessions.length;
        const totalMessages = this.sessions.reduce((total, session) => {
            return total + (session.conversationHistory ? session.conversationHistory.length : 0);
        }, 0);
        const recentSessions = this.sessions.filter(session => {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return new Date(session.timestamp) > oneWeekAgo;
        }).length;

        return { totalSessions, totalMessages, recentSessions };
    }

    renderSessionsList() {
        if (this.loading) {
            return html`<div class="loading">Loading conversation history...</div>`;
        }

        if (this.sessions.length === 0) {
            return html`
                <div class="empty-state">
                    <div class="empty-state-title">No conversations yet</div>
                    <div>Start a session to see your conversation history here</div>
                </div>
            `;
        }

        return html`
            <div class="sessions-list">
                ${this.sessions.map(
            session => html`
                        <div class="session-item" @click=${() => this.handleSessionClick(session)}>
                            <div class="session-header">
                                <div class="session-date">${this.formatDate(session.timestamp)}</div>
                                <div class="session-time">${this.formatTime(session.timestamp)}</div>
                            </div>
                            <div class="session-preview">${this.getSessionPreview(session)}</div>
                        </div>
                    `
        )}
            </div>
        `;
    }

    renderConversationView() {
        if (!this.selectedSession) return html``;

        const { conversationHistory } = this.selectedSession;

        // Flatten the conversation turns into individual messages
        const messages = [];
        if (conversationHistory) {
            conversationHistory.forEach(turn => {
                if (turn.transcription) {
                    messages.push({
                        type: 'user',
                        content: turn.transcription,
                        timestamp: turn.timestamp,
                    });
                }
                if (turn.ai_response) {
                    messages.push({
                        type: 'ai',
                        content: turn.ai_response,
                        timestamp: turn.timestamp,
                    });
                }
            });
        }

        return html`
            <div class="back-header">
                <button class="back-button" @click=${this.handleBackClick}>
                    <svg
                        width="16px"
                        height="16px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="currentColor"
                    >
                        <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                    Back to Sessions
                </button>
                <div class="legend">
                    <div class="legend-item">
                        <div class="legend-dot user"></div>
                        <span>Them</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot ai"></div>
                        <span>Suggestion</span>
                    </div>
                </div>
            </div>
            <div class="conversation-view">
                ${messages.length > 0
                ? messages.map(message => html`
                        <div class="message ${message.type}" .innerHTML=${window.marked ? window.marked.parse(message.content) : message.content}></div>
                    `)
                : html`<div class="empty-state">No conversation data available</div>`}
            </div>
        `;
    }

    render() {
        const stats = this.getStats();

        return html`
            <div class="history-tabs">
                <button class="tab-btn ${this.activeTab === 'sessions' ? 'active' : ''}" @click=${() => this.setTab('sessions')}>
                    <span>📋</span> Sessions
                </button>
                <button class="tab-btn ${this.activeTab === 'conversation' ? 'active' : ''}" @click=${() => this.setTab('conversation')} ?disabled=${!this.selectedSession}>
                    <span>💬</span> Conversation
                </button>
                <button class="tab-btn ${this.activeTab === 'stats' ? 'active' : ''}" @click=${() => this.setTab('stats')}>
                    <span>📊</span> Stats
                </button>
            </div>
            <div class="history-tab-content">
                ${this.activeTab === 'sessions' ? html`
                    <div class="history-card">
                        <div class="card-title"><span>📋</span> Conversation Sessions</div>
                        <div class="card-content">
                            ${this.renderSessionsList()}
                        </div>
                    </div>
                ` : ''}
                ${this.activeTab === 'conversation' ? html`
                    <div class="history-card">
                        <div class="card-title"><span>💬</span> Conversation Details</div>
                        <div class="card-content">
                            ${this.renderConversationView()}
                        </div>
                    </div>
                ` : ''}
                ${this.activeTab === 'stats' ? html`
                    <div class="history-card">
                        <div class="card-title"><span>📊</span> Conversation Stats</div>
                        <div class="card-content">
                            <div class="stats-grid">
                                <div class="stat-item">
                                    <div class="stat-number">${stats.totalSessions}</div>
                                    <div class="stat-label">Total Sessions</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number">${stats.totalMessages}</div>
                                    <div class="stat-label">Total Messages</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number">${stats.recentSessions}</div>
                                    <div class="stat-label">This Week</div>
                                </div>
                            </div>
                            <div class="form-description">
                                Track your conversation activity and engagement over time.
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
}

customElements.define('history-view', HistoryView);
