import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { resizeLayout } from '../../utils/windowResize.js';

export class MainView extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
            user-select: none;
        }

        .main-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            padding: 20px;
            text-align: center;
            background: var(--card-background) !important;
            backdrop-filter: blur(18px) saturate(180%);
            -webkit-backdrop-filter: blur(18px) saturate(180%);
            border: 1.5px solid var(--card-border);
            box-shadow: 0 8px 32px var(--shadow-color, rgba(0,0,0,0.12)), 0 1.5px 6px var(--shadow-color, rgba(0,0,0,0.06));
            border-radius: var(--border-radius);
            margin: 10px;
            max-width: 400px;
            margin: 0 auto;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }

        .welcome {
            font-size: 24px;
            margin-bottom: 24px;
            font-weight: 700;
            text-align: center;
            color: var(--text-color);
            background: none;
            -webkit-background-clip: unset;
            -webkit-text-fill-color: unset;
            background-clip: unset;
            letter-spacing: 0.5px;
            animation: fadeInUp 0.8s ease-out;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .logo {
            width: 28px;
            height: 28px;
            object-fit: contain;
            border-radius: 6px;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
            transition: transform 0.2s ease;
        }

        .logo:hover {
            transform: scale(1.05);
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .input-group {
            display: flex;
            justify-content: center;
            margin: 16px 0;
            align-items: center;
            animation: fadeInUp 0.8s ease-out 0.1s both;
        }



        .start-button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1.5px solid var(--card-border);
            padding: 10px 22px;
            border-radius: 18px;
            font-size: 15px;
            font-weight: 600;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
            cursor: pointer;
        }

        .start-button:hover {
            background: var(--hover-background);
            border-color: var(--accent-color);
            transform: translateY(-2px);
        }

        .start-button.initializing {
            opacity: 0.5;
        }

        .start-button.initializing:hover {
            background: var(--start-button-background);
            border-color: var(--start-button-border);
        }

        .shortcut-icons {
            display: flex;
            align-items: center;
            gap: 2px;
            margin-left: 4px;
        }

        .shortcut-icons svg {
            width: 14px;
            height: 14px;
        }

        .shortcut-icons svg path {
            stroke: currentColor;
        }

        .description {
            color: var(--description-color);
            font-size: 14px;
            margin: 16px 0;
            line-height: 1.5;
            text-align: center;
            opacity: 0.9;
            animation: fadeInUp 0.8s ease-out 0.2s both;
            background: none;
        }

        .link {
            color: var(--link-color);
            text-decoration: underline;
            cursor: pointer;
        }

        .shortcut-hint {
            color: var(--description-color);
            font-size: 11px;
            opacity: 0.8;
        }

        .listening-toggle {
            background: var(--button-background) !important;
            border: 1.5px solid var(--button-border) !important;
            color: var(--text-color) !important;
            padding: 0 18px !important;
            height: 42px !important;
            border-radius: 16px !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 140px;
            box-shadow: none;
            position: relative;
            overflow: hidden;
        }

        .listening-toggle:hover {
            transform: translateY(-3px) scale(1.05);
            background: var(--button-hover-background) !important;
            border-color: var(--button-hover-border, var(--button-border)) !important;
        }
        .listening-toggle[data-listening="true"] {
            background: var(--danger-background) !important;
            border-color: var(--danger-color) !important;
            color: var(--danger-color) !important;
        }
        .listening-toggle[data-listening="true"]:hover {
            background: var(--danger-background) !important;
            border-color: var(--danger-color) !important;
        }
        .shortcut-icons {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            vertical-align: middle;
            white-space: nowrap;
        }

        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 500px;
        }
    `;

    static properties = {
        onStart: { type: Function },
        onAPIKeyHelp: { type: Function },
        isInitializing: { type: Boolean },
        onLayoutModeChange: { type: Function },
    };

    constructor() {
        super();
        this.onStart = () => { };
        this.onAPIKeyHelp = () => { };
        this.isInitializing = false;
        this.onLayoutModeChange = () => { };
        this.boundKeydownHandler = this.handleKeydown.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        window.electron?.ipcRenderer?.on('session-initializing', (event, isInitializing) => {
            this.isInitializing = isInitializing;
        });

        // Add keyboard event listener for Ctrl+Enter (or Cmd+Enter on Mac)
        document.addEventListener('keydown', this.boundKeydownHandler);

        // Load and apply layout mode on startup
        this.loadLayoutMode();
        // Resize window for this view
        resizeLayout();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.electron?.ipcRenderer?.removeAllListeners('session-initializing');
        // Remove keyboard event listener
        document.removeEventListener('keydown', this.boundKeydownHandler);
    }

    handleKeydown(e) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isStartShortcut = isMac ? e.metaKey && e.key === 'Enter' : e.ctrlKey && e.key === 'Enter';

        if (isStartShortcut) {
            e.preventDefault();
            this.handleStartClick();
        }
    }



    handleStartClick() {
        if (this.isInitializing) {
            return;
        }
        this.onStart();
    }

    handleAPIKeyHelpClick() {
        this.onAPIKeyHelp();
    }

    handleResetOnboarding() {
        localStorage.removeItem('onboardingCompleted');
        // Refresh the page to trigger onboarding
        window.location.reload();
    }

    loadLayoutMode() {
        const savedLayoutMode = localStorage.getItem('layoutMode');
        if (savedLayoutMode && savedLayoutMode !== 'normal') {
            // Notify parent component to apply the saved layout mode
            this.onLayoutModeChange(savedLayoutMode);
        }
    }



    getStartButtonText() {
        return html`Start Interview`;
    }

    render() {
        return html`
            <div class="main-container">
                <div class="welcome">
                    <img src="assets/logo.jpg" alt="Interview Cracker AI Logo" class="logo">
                    Interview Cracker AI
                </div>

                <div class="input-group">
                    <button @click=${this.handleStartClick} class="listening-toggle ${this.isInitializing ? 'initializing' : ''}">
                        ${this.getStartButtonText()}
                    </button>
                </div>
                <p class="description">
                    ✨ Ready to start your AI assistant session<br>
                    <span style="font-size: 12px; opacity: 0.7; margin-top: 6px; display: block;">
                    Your intelligent companion for interviews and meetings
                    </span>
                </p>
            </div>
        `;
    }
}

customElements.define('main-view', MainView);
