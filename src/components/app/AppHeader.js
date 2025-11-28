import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class AppHeader extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
            user-select: none;
        }

        .header {
            -webkit-app-region: drag;
            display: flex;
            align-items: center;
            padding: 9px 20px !important;
            min-height: 44px !important;
            border: 1px solid var(--card-border);
            background: var(--header-background) !important;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border-radius: var(--border-radius);
        }

        .header-title {
            flex: 1;
            font-size: 16px !important;
            font-weight: 600;
            -webkit-app-region: drag;
        }

        .header-actions {
            display: flex;
            gap: 12px !important;
            align-items: center;
            -webkit-app-region: no-drag;
        }

        .header-actions span {
            font-size: var(--header-font-size-small);
            color: var(--header-actions-color);
        }

        .button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 7px 14px !important;
            border-radius: 12px !important;
            font-size: 13px !important;
            font-weight: 500;
        }

        .icon-button {
            background: none;
            color: var(--icon-button-color);
            border: none;
            padding: 7px 14px !important;
            border-radius: 12px !important;
            font-size: 13px !important;
            font-weight: 500;
            display: flex;
            opacity: 0.6;
            transition: opacity 0.2s ease;
        }

        .icon-button svg {
            width: 22px !important;
            height: 22px !important;
        }

        .icon-button:hover {
            background: var(--hover-background);
            opacity: 1;
        }

        .button:hover {
            background: var(--hover-background);
        }

        :host([isclickthrough]) .button:hover,
        :host([isclickthrough]) .icon-button:hover {
            background: transparent;
        }

        .key {
            background: var(--key-background);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
            margin: 0px;
        }

        .header-nav {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-right: 24px;
        }
        .pill-button {
            background: var(--button-background);
            color: var(--text-color, #fff);
            border: none;
            border-radius: 24px;
            padding: 8px 22px;
            font-size: 1rem;
            font-weight: 500;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            display: flex;
            align-items: center;
            transition: background 0.2s, box-shadow 0.2s;
            outline: none;
        }
        .pill-button:hover {
            background: var(--hover-background);
            box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }

        .listening-toggle {
            background: var(--button-background) !important;
            color: var(--text-color) !important;
            border: 1.5px solid var(--button-border) !important;
            box-shadow: none;
            border-radius: 16px !important;
            font-weight: 600;
            font-size: 13px;
            height: 36px;
            padding: 0 16px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }

        .listening-toggle:hover {
            background: var(--button-hover-background) !important;
            color: var(--text-color) !important;
            border-color: var(--button-hover-border, var(--button-border)) !important;
            transform: translateY(-2px) scale(1.04);
        }

        .listening-toggle[data-listening="true"] {
            background: rgba(255, 68, 68, 0.10) !important;
            border-color: #ff6b6b !important;
            color: #ff6b6b !important;
        }

        .listening-toggle[data-listening="true"]:hover {
            background: rgba(255, 68, 68, 0.18) !important;
            border-color: #ff6b6b !important;
            color: #fff !important;
        }
        .status-animate {
            animation: statusFadeIn 0.5s, statusPulse 1.2s infinite;
            display: inline-block;
        }
        @keyframes statusFadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes statusPulse {
            0% { filter: brightness(1); }
            50% { filter: brightness(1.5); }
            100% { filter: brightness(1); }
        }
        .screen-share-toggle-btn {
            background: var(--button-background);
            color: var(--text-color);
            border: 1.5px solid var(--button-border);
            border-radius: 14px;
            font-weight: 600;
            font-size: 13px;
            height: 36px;
            padding: 0 12px;
            margin-left: 10px;
            display: inline-flex;
            align-items: center;
            gap: 7px;
            box-shadow: none;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }
        .screen-share-toggle-btn:hover {
            background: var(--button-hover-background);
            color: var(--text-color);
            border-color: var(--button-hover-border, var(--button-border));
            transform: translateY(-2px) scale(1.04);
        }
        .screen-share-toggle-btn svg {
            margin-right: 0px;
        }

        /* Theme toggle button specific styles */
        .theme-toggle {
            position: relative;
            overflow: hidden;
        }

        .theme-toggle svg {
            transition: transform 0.2s ease;
        }

        .theme-toggle:hover svg {
            transform: scale(1.1);
        }

        .theme-toggle:active svg {
            transform: scale(0.95);
        }
    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        onCustomizeClick: { type: Function },
        onHelpClick: { type: Function },
        onHistoryClick: { type: Function },
        onCloseClick: { type: Function },
        onBackClick: { type: Function },
        onHideToggleClick: { type: Function },
        onToggleListening: { type: Function },
        isListening: { type: Boolean },
        isClickThrough: { type: Boolean, reflect: true },
        advancedMode: { type: Boolean },
        onAdvancedClick: { type: Function },
        onLoginClick: { type: Function },
        onUpgradeClick: { type: Function },
        isScreenShareVisible: { type: Boolean },
        isDarkMode: { type: Boolean },
        onToggleTheme: { type: Function },
    };

    constructor() {
        super();
        this.currentView = 'main';
        this.statusText = '';
        this.startTime = null;
        this.onCustomizeClick = () => {};
        this.onHelpClick = () => {};
        this.onHistoryClick = () => {};
        this.onCloseClick = () => {};
        this.onBackClick = () => {};
        this.onHideToggleClick = () => {};
        this.onToggleListening = () => {};
        this.isListening = false;
        this.isClickThrough = false;
        this.advancedMode = false;
        this.onAdvancedClick = () => {};
        this.onLoginClick = () => {};
        this.onUpgradeClick = () => {};
        this.isScreenShareVisible = false;
        this.isDarkMode = localStorage.getItem('isDarkMode') !== 'false'; // Default to dark mode
        this.onToggleTheme = () => {};
        this._timerInterval = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._startTimer();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopTimer();
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        // Start/stop timer based on view change
        if (changedProperties.has('currentView')) {
            if (this.currentView === 'assistant' && this.startTime) {
                this._startTimer();
            } else {
                this._stopTimer();
            }
        }

        // Start timer when startTime is set
        if (changedProperties.has('startTime')) {
            if (this.startTime && this.currentView === 'assistant') {
                this._startTimer();
            } else if (!this.startTime) {
                this._stopTimer();
            }
        }

        // Handle theme changes
        if (changedProperties.has('isDarkMode')) {
            console.log('AppHeader: Theme changed to', this.isDarkMode ? 'dark' : 'light');
        }
    }

    _startTimer() {
        // Clear any existing timer
        this._stopTimer();

        // Only start timer if we're in assistant view and have a start time
        if (this.currentView === 'assistant' && this.startTime) {
            this._timerInterval = setInterval(() => {
                // Trigger a re-render by requesting an update
                this.requestUpdate();
            }, 1000); // Update every second
        }
    }

    _stopTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    getViewTitle() {
        const titles = {
            onboarding: '',
            main: '',
            customize: 'Customize',
            help: 'Help & Shortcuts',
            history: 'Conversation History',
            advanced: 'Advanced Tools',
            assistant: '',
        };
        return titles[this.currentView] || '';
    }

    getElapsedTime() {
        if (this.currentView === 'assistant' && this.startTime) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            return `${elapsed}s`;
        }
        return '';
    }

    isNavigationView() {
        const navigationViews = ['customize', 'help', 'history', 'advanced'];
        return navigationViews.includes(this.currentView);
    }

    toggleScreenShareVisibility() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('toggle-screen-share-visibility', !this.isScreenShareVisible);
        }
        this.isScreenShareVisible = !this.isScreenShareVisible;
    }

    render() {
        const elapsedTime = this.getElapsedTime();

        return html`
            <div class="header">
                <!-- Removed Log in, Buy Now, and Test Alert buttons -->
                <div class="header-nav">
                </div>
                <div class="header-title">${this.getViewTitle()}</div>
                <div class="header-actions">
                    ${this.currentView === 'assistant'
                        ? html`
                              <span>${elapsedTime}</span>
                              <button class="listening-toggle" @click=${this.onToggleListening} ?data-listening=${this.isListening}>
                                  ${this.isListening ? 'Stop' : 'Start'} Listening
                              </button>
                              <span class="status-animate">${this.statusText}</span>
                              <button class="screen-share-toggle-btn" @click=${this.toggleScreenShareVisibility.bind(this)} title="${this.isScreenShareVisible ? 'Hide' : 'Reveal'}">
                                ${this.isScreenShareVisible
                                  ? html`<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="11" cy="11" rx="7" ry="4.5"/><circle cx="11" cy="11" r="2.2"/></svg> Reveal`
                                  : html`<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="11" cy="11" rx="7" ry="4.5"/><path d="M4 4l14 14"/></svg> Reveal`}
                              </button>
                          `
                        : ''}
                    ${this.currentView === 'main'
                        ? html`
                              <button class="icon-button" @click=${this.onHistoryClick} title="History">
                                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                  <rect x="3.5" y="4.5" width="15" height="13" rx="2.5"/>
                                  <path d="M7 8h8M7 11h5"/>
                                </svg>
                              </button>
                              <button class="icon-button theme-toggle" @click=${this.onToggleTheme} title="${this.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}">
                                ${this.isDarkMode 
                                  ? html`<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                      <circle cx="11" cy="11" r="5"/>
                                      <path d="M11 1v2M11 19v2M1 11h2M19 11h2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M4.22 16.36l-1.42 1.42M16.36 4.22l-1.42-1.42"/>
                                    </svg>`
                                  : html`<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                                    </svg>`
                                }
                              </button>
                              ${this.advancedMode
                                  ? html`
                                        <button class="icon-button" @click=${this.onAdvancedClick} title="Advanced Tools">
                                            <?xml version="1.0" encoding="UTF-8"?><svg
                                                width="24px"
                                                stroke-width="1.7"
                                                height="24px"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                                color="currentColor"
                                            >
                                                <path d="M18.5 15L5.5 15" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path>
                                                <path
                                                    d="M16 4L8 4"
                                                    stroke="currentColor"
                                                    stroke-width="1.7"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                ></path>
                                                <path
                                                    d="M9 4.5L9 10.2602C9 10.7376 8.82922 11.1992 8.51851 11.5617L3.48149 17.4383C3.17078 17.8008 3 18.2624 3 18.7398V19C3 20.1046 3.89543 21 5 21L19 21C20.1046 21 21 20.1046 21 19V18.7398C21 18.2624 20.8292 17.8008 20.5185 17.4383L15.4815 11.5617C15.1708 11.1992 15 10.7376 15 10.2602L15 4.5"
                                                    stroke="currentColor"
                                                    stroke-width="1.7"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                ></path>
                                                <path
                                                    d="M12 9.01L12.01 8.99889"
                                                    stroke="currentColor"
                                                    stroke-width="1.7"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                ></path>
                                                <path
                                                    d="M11 2.01L11.01 1.99889"
                                                    stroke="currentColor"
                                                    stroke-width="1.7"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                ></path>
                                            </svg>
                                        </button>
                                    `
                                  : ''}
                              <button class="icon-button" @click=${this.onCustomizeClick} title="Settings">
                                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                  <circle cx="11" cy="11" r="3.5"/>
                                  <path d="M19 11a8 8 0 0 0-.2-1.7l1.6-1.2a1 1 0 0 0-1.2-1.6l-1.6 1.2A8 8 0 0 0 11 3V1.5a1 1 0 0 0-2 0V3a8 8 0 0 0-3.8 1.7l-1.6-1.2a1 1 0 0 0-1.2 1.6l1.6 1.2A8 8 0 0 0 3 11H1.5a1 1 0 0 0 0 2H3a8 8 0 0 0 1.7 3.8l-1.2 1.6a1 1 0 0 0 1.6 1.2l1.2-1.6A8 8 0 0 0 11 19v1.5a1 1 0 0 0 2 0V19a8 8 0 0 0 3.8-1.7l1.2 1.6a1 1 0 0 0 1.6-1.2l-1.2-1.6A8 8 0 0 0 19 13h1.5a1 1 0 0 0 0-2H19z"/>
                                </svg>
                              </button>
                              <button class="icon-button" @click=${this.onHelpClick} title="Help">
                                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                  <circle cx="11" cy="11" r="8.5"/>
                                  <path d="M11 15v-1.2c0-1.2 2-1.6 2-3.3a2 2 0 1 0-4 0"/>
                                  <circle cx="11" cy="16.2" r="0.7" fill="currentColor"/>
                                </svg>
                              </button>
                          `
                        : ''}
                    ${this.currentView === 'assistant'
                        ? html`
                              <button @click=${this.onHideToggleClick} class="listening-toggle">
                                  Hide&nbsp;&nbsp;<span class="key" style="pointer-events: none;">${window.cheddar?.isMacOS ? 'Cmd' : 'Ctrl'}</span
                                  >&nbsp;&nbsp;<span class="key">&bsol;</span>
                              </button>
                              <button @click=${this.onCloseClick} class="icon-button window-close">
                                  <?xml version="1.0" encoding="UTF-8"?><svg
                                      width="24px"
                                      height="24px"
                                      stroke-width="1.7"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      color="currentColor"
                                  >
                                      <path
                                          d="M6.75827 17.2426L12.0009 12M17.2435 6.75736L12.0009 12M12.0009 12L6.75827 6.75736M12.0009 12L17.2435 17.2426"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                  </svg>
                              </button>
                          `
                        : html`
                              <button @click=${this.isNavigationView() ? this.onBackClick : this.onCloseClick} class="icon-button window-close" title="Close">
                                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                  <circle cx="11" cy="11" r="8.5" fill="var(--danger-color)"/>
                                  <line x1="8.5" y1="8.5" x2="13.5" y2="13.5" stroke="var(--text-color)" stroke-width="1.5" stroke-linecap="round"/>
                                  <line x1="13.5" y1="8.5" x2="8.5" y2="13.5" stroke="var(--text-color)" stroke-width="1.5" stroke-linecap="round"/>
                                </svg>
                              </button>
                          `}
                </div>
            </div>
        `;
    }
}

customElements.define('app-header', AppHeader);
