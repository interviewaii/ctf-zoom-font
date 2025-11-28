import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { resizeLayout } from '../../utils/windowResize.js';

export class HelpView extends LitElement {
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

        .help-container {
            display: grid;
            gap: 12px;
            padding-bottom: 20px;
        }

        .help-tabs {
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
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .tab-btn.active, .tab-btn:hover {
            background: var(--hover-background);
            color: var(--text-color);
            border-bottom: 2.5px solid var(--accent-color);
        }

        .help-tab-content {
            min-height: 320px;
        }

        .help-card {
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

        .option-group {
            background: var(--card-background);
            border: 1px solid var(--card-border);
            border-radius: 6px;
            padding: 16px;
            backdrop-filter: blur(10px);
        }

        .option-label {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            color: var(--text-color);
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .option-label::before {
            content: '';
            width: 3px;
            height: 14px;
            background: var(--accent-color);
            border-radius: 1.5px;
        }

        .description {
            color: var(--description-color);
            font-size: 12px;
            line-height: 1.4;
        }

        .description strong {
            color: var(--text-color);
            font-weight: 500;
        }

        .description br {
            margin-bottom: 3px;
        }

        .link {
            color: var(--link-color);
            text-decoration: none;
            cursor: pointer;
            transition: color 0.15s ease;
        }

        .link:hover {
            color: var(--link-hover-color);
            text-decoration: underline;
        }

        .key {
            background: var(--key-background);
            color: var(--text-color);
            border: 1px solid var(--key-border);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
            font-weight: 500;
            margin: 0 1px;
            white-space: nowrap;
        }

        .keyboard-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 12px;
            margin-top: 8px;
        }

        .keyboard-group {
            background: var(--input-background, rgba(0, 0, 0, 0.2));
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.1));
            border-radius: 4px;
            padding: 10px;
        }

        .keyboard-group-title {
            font-weight: 600;
            font-size: 12px;
            color: var(--text-color);
            margin-bottom: 6px;
            padding-bottom: 3px;
        }

        .shortcut-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 3px 0;
            font-size: 11px;
        }

        .shortcut-description {
            color: var(--description-color, rgba(255, 255, 255, 0.7));
        }

        .shortcut-keys {
            display: flex;
            gap: 2px;
        }

        .profiles-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 8px;
        }

        .profile-item {
            background: var(--input-background, rgba(0, 0, 0, 0.2));
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.1));
            border-radius: 4px;
            padding: 8px;
        }

        .profile-name {
            font-weight: 600;
            font-size: 12px;
            color: var(--text-color);
            margin-bottom: 3px;
        }

        .profile-description {
            font-size: 10px;
            color: var(--description-color, rgba(255, 255, 255, 0.6));
            line-height: 1.3;
        }

        .community-links {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }

        .community-link {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            background: var(--input-background, rgba(0, 0, 0, 0.2));
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.1));
            border-radius: 4px;
            text-decoration: none;
            color: var(--link-color, #007aff);
            font-size: 11px;
            font-weight: 500;
            transition: all 0.15s ease;
            cursor: pointer;
        }

        .community-link:hover {
            background: var(--input-hover-background, rgba(0, 0, 0, 0.3));
            border-color: var(--link-color, #007aff);
        }

        .usage-steps {
            counter-reset: step-counter;
        }

        .usage-step {
            counter-increment: step-counter;
            position: relative;
            padding-left: 24px;
            margin-bottom: 6px;
            font-size: 11px;
            line-height: 1.3;
        }

        .usage-step::before {
            content: counter(step-counter);
            position: absolute;
            left: 0;
            top: 0;
            width: 16px;
            height: 16px;
            background: var(--link-color, #007aff);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: 600;
        }

        .usage-step strong {
            color: var(--text-color);
        }

        .form-description {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
            margin-top: 2px;
        }

        .shortcuts-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            border-radius: 4px;
            overflow: hidden;
        }

        .shortcuts-table th,
        .shortcuts-table td {
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1px solid var(--table-border, rgba(255, 255, 255, 0.08));
        }

        .shortcuts-table th {
            background: var(--table-header-background, rgba(255, 255, 255, 0.04));
            font-weight: 600;
            font-size: 11px;
            color: var(--label-color, rgba(255, 255, 255, 0.8));
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .shortcuts-table td {
            vertical-align: middle;
        }

        .shortcuts-table .action-name {
            font-weight: 500;
            color: var(--text-color);
            font-size: 12px;
        }

        .shortcuts-table .action-description {
            font-size: 10px;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
            margin-top: 1px;
        }

        .shortcuts-table tr:hover {
            background: var(--table-row-hover, rgba(255, 255, 255, 0.02));
        }

        .shortcuts-table tr:last-child td {
            border-bottom: none;
        }
    `;

    static properties = {
        onExternalLinkClick: { type: Function },
        keybinds: { type: Object },
        activeTab: { type: String },
    };

    constructor() {
        super();
        this.onExternalLinkClick = () => { };
        this.keybinds = this.getDefaultKeybinds();
        this.loadKeybinds();
        this.activeTab = 'shortcuts';
    }

    connectedCallback() {
        super.connectedCallback();
        // Resize window for this view
        resizeLayout();
    }

    getDefaultKeybinds() {
        const isMac = window.interviewAI?.isMacOS || navigator.platform.includes('Mac');
        return {
            moveUp: isMac ? 'Alt+Up' : 'Ctrl+Up',
            moveDown: isMac ? 'Alt+Down' : 'Ctrl+Down',
            moveLeft: isMac ? 'Alt+Left' : 'Ctrl+Left',
            moveRight: isMac ? 'Alt+Right' : 'Ctrl+Right',
            toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
            toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
            nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
            previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
            nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
            scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
            scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
        };
    }

    loadKeybinds() {
        const savedKeybinds = localStorage.getItem('customKeybinds');
        if (savedKeybinds) {
            try {
                this.keybinds = { ...this.getDefaultKeybinds(), ...JSON.parse(savedKeybinds) };
            } catch (e) {
                console.error('Failed to parse saved keybinds:', e);
                this.keybinds = this.getDefaultKeybinds();
            }
        }
    }

    formatKeybind(keybind) {
        return keybind.split('+').map(key => html`<span class="key">${key}</span>`);
    }

    handleExternalLinkClick(url) {
        this.onExternalLinkClick(url);
    }

    setTab(tab) {
        this.activeTab = tab;
    }

    getKeybindActions() {
        return [
            {
                key: 'moveUp',
                name: 'Move Window Up',
                description: 'Move the application window up',
            },
            {
                key: 'moveDown',
                name: 'Move Window Down',
                description: 'Move the application window down',
            },
            {
                key: 'moveLeft',
                name: 'Move Window Left',
                description: 'Move the application window left',
            },
            {
                key: 'moveRight',
                name: 'Move Window Right',
                description: 'Move the application window right',
            },
            {
                key: 'toggleVisibility',
                name: 'Toggle Window Visibility',
                description: 'Show/hide the application window',
            },
            {
                key: 'toggleClickThrough',
                name: 'Toggle Click-through Mode',
                description: 'Enable/disable click-through functionality',
            },
            {
                key: 'nextStep',
                name: 'Analyze Screen / Start',
                description: 'From Home: start session. Otherwise: capture screen and analyze instantly',
            },
            {
                key: 'previousResponse',
                name: 'Previous Response',
                description: 'Navigate to the previous AI response',
            },
            {
                key: 'nextResponse',
                name: 'Next Response',
                description: 'Navigate to the next AI response',
            },
            {
                key: 'scrollUp',
                name: 'Scroll Response Up',
                description: 'Scroll the AI response content up',
            },
            {
                key: 'scrollDown',
                name: 'Scroll Response Down',
                description: 'Scroll the AI response content down',
            },
        ];
    }

    render() {
        const isMacOS = window.interviewAI?.isMacOS || false;
        const isLinux = window.interviewAI?.isLinux || false;
        const keybindActions = this.getKeybindActions();

        return html`
            <div class="help-tabs">
                <button class="tab-btn ${this.activeTab === 'shortcuts' ? 'active' : ''}" @click=${() => this.setTab('shortcuts')}>
                    <span>⌨️</span> Shortcuts
                </button>
                <button class="tab-btn ${this.activeTab === 'usage' ? 'active' : ''}" @click=${() => this.setTab('usage')}>
                    <span>📖</span> How to Use
                </button>
                <button class="tab-btn ${this.activeTab === 'profiles' ? 'active' : ''}" @click=${() => this.setTab('profiles')}>
                    <span>🧑‍💼</span> Profiles
                </button>
                <button class="tab-btn ${this.activeTab === 'support' ? 'active' : ''}" @click=${() => this.setTab('support')}>
                    <span>💬</span> Support
                </button>
            </div>
            <div class="help-tab-content">
                ${this.activeTab === 'shortcuts' ? html`
                    <div class="help-card">
                        <div class="card-title"><span>⌨️</span> Keyboard Shortcuts</div>
                        <div class="card-content">
                            <table class="shortcuts-table">
                                <thead>
                                    <tr><th>Action</th><th>Shortcut</th><th>Description</th></tr>
                                </thead>
                                <tbody>
                                    ${keybindActions.map(action => html`
                                        <tr>
                                            <td class="action-name">${action.name}</td>
                                            <td><div class="shortcut-keys">${this.formatKeybind(this.keybinds[action.key] || '')}</div></td>
                                            <td class="action-description">${action.description}</td>
                                        </tr>
                                    `)}
                                    <tr>
                                        <td class="action-name">Send Message</td>
                                        <td><div class="shortcut-keys"><span class="key">Enter</span></div></td>
                                        <td class="action-description">Send message to AI</td>
                                    </tr>
                                    <tr>
                                        <td class="action-name">New Line</td>
                                        <td><div class="shortcut-keys"><span class="key">Shift</span><span class="key">Enter</span></div></td>
                                        <td class="action-description">New line in text input</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div class="form-description" style="margin-top: 12px; font-style: italic; text-align: center;">
                                💡 You can customize these shortcuts in the Settings page!
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${this.activeTab === 'usage' ? html`
                    <div class="help-card">
                        <div class="card-title"><span>📖</span> How to Use</div>
                        <div class="card-content">
                            <div class="usage-steps">
                                <div class="usage-step"><strong>Start:</strong> Click <em>Start Interview</em></div>
                                <div class="usage-step"><strong>Customize:</strong> Pick your AI profile, language, and add optional custom instructions from Settings</div>
                                <div class="usage-step">
                                    <strong>Position Window:</strong> Use keyboard shortcuts to move the window to your desired location
                                </div>
                                <div class="usage-step">
                                    <strong>Click-through Mode:</strong> Use ${this.formatKeybind(this.keybinds.toggleClickThrough)} to make the window
                                    click-through
                                </div>
                                <div class="usage-step"><strong>Analyze Screen:</strong> Press ${this.formatKeybind(this.keybinds.nextStep)} anytime to capture the current screen and get an answer. On the Home screen, the same shortcut starts the session.</div>
                                <div class="usage-step"><strong>Ask via Text:</strong> Type your question and press <span class="key">Enter</span> (use <span class="key">Shift</span><span class="key">Enter</span> for a new line)</div>
                                <div class="usage-step">
                                    <strong>Navigate Responses:</strong> Use ${this.formatKeybind(this.keybinds.previousResponse)} and
                                    ${this.formatKeybind(this.keybinds.nextResponse)} to browse through AI responses
                                </div>
                                <div class="usage-step"><strong>Scroll Answers:</strong> Use ${this.formatKeybind(this.keybinds.scrollUp)} and ${this.formatKeybind(this.keybinds.scrollDown)} to scroll</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${this.activeTab === 'profiles' ? html`
                    <div class="help-card">
                        <div class="card-title"><span>🧑‍💼</span> Supported Profiles</div>
                        <div class="card-content">
                            <div class="profiles-grid">
                                <div class="profile-item">
                                    <div class="profile-name">Job Interview</div>
                                    <div class="profile-description">Get help with interview questions and responses</div>
                                </div>
                                <div class="profile-item">
                                    <div class="profile-name">Coding Interview</div>
                                    <div class="profile-description">Get help with programming questions and technical problems</div>
                                </div>
                                <div class="profile-item">
                                    <div class="profile-name">Sales Call</div>
                                    <div class="profile-description">Assistance with sales conversations and objection handling</div>
                                </div>
                                <div class="profile-item">
                                    <div class="profile-name">Business Meeting</div>
                                    <div class="profile-description">Support for professional meetings and discussions</div>
                                </div>
                                <div class="profile-item">
                                    <div class="profile-name">Presentation</div>
                                    <div class="profile-description">Help with presentations and public speaking</div>
                                </div>
                                <div class="profile-item">
                                    <div class="profile-name">Negotiation</div>
                                    <div class="profile-description">Guidance for business negotiations and deals</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${this.activeTab === 'support' ? html`
                    <div class="help-card">
                        <div class="card-title"><span>💬</span> Support & Audio</div>
                        <div class="card-content">
                            <div class="description">
                                <strong>Audio Input:</strong> The AI listens to conversations and provides contextual assistance based on what it hears.
                            </div>
                            <div class="description">
                                <strong>Community:</strong> Join our community for tips, updates, and support.
                            </div>
                            <div class="community-links">
                                <!-- Community links can be added here -->
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
}

customElements.define('help-view', HelpView);
