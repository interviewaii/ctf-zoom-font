import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { AppHeader } from './AppHeader.js';
import { MainView } from '../views/MainView.js';
import { CustomizeView } from '../views/CustomizeView.js';
import { HelpView } from '../views/HelpView.js';
import { HistoryView } from '../views/HistoryView.js';
import { AssistantView } from '../views/AssistantView.js';
import { OnboardingView } from '../views/OnboardingView.js';
import { AdvancedView } from '../views/AdvancedView.js';

export class InterviewCrackerApp extends LitElement {
    static styles = css`
        * {
            box-sizing: border-box;
            font-family:
                'Inter',
                -apple-system,
                BlinkMacSystemFont,
                sans-serif;
            margin: 0px;
            padding: 0px;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            width: 100%;
            height: 100vh;
            background: transparent !important;
            color: var(--text-color);
        }
        .window-container {
            height: 100vh;
            border-radius: var(--border-radius);
            overflow: hidden;
            box-shadow: 
                0 20px 60px rgba(31, 38, 135, 0.25),
                0 8px 32px rgba(0, 0, 0, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            background: var(--background-transparent) !important;
            backdrop-filter: blur(var(--glass-blur, 8px));
            -webkit-backdrop-filter: blur(var(--glass-blur, 8px));
            border: 1.5px solid var(--card-border);
            animation: windowAppear 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            position: relative;
            transition: all 0.3s ease-in-out;
        }

        .window-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: transparent !important;
            pointer-events: none;
            border-radius: 20px;
        }

        @keyframes windowAppear {
            from {
                opacity: 0;
                transform: scale(0.95) translateY(20px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }
        .container {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: none;
        }
        .main-content {
            flex: 1;
            padding: var(--main-content-padding);
            overflow: hidden;
            margin-top: var(--main-content-margin-top);
            border-radius: var(--content-border-radius);
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            background: var(--main-content-background) !important;
            backdrop-filter: blur(var(--glass-blur, 8px));
            -webkit-backdrop-filter: blur(var(--glass-blur, 8px));
            box-shadow: 
                0 8px 32px var(--shadow-color, rgba(31, 38, 135, 0.15)),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            border: 1.5px solid var(--card-border);
            animation: slideInUp 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            /* Hide scrollbar in non-WebKit as well */
            -ms-overflow-style: none;
            scrollbar-width: none;
        }

        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .main-content.with-border {
            border: 1px solid var(--border-color);
        }

        .main-content.assistant-view {
            padding: 10px;
            border: none;
        }

        .main-content.onboarding-view {
            padding: 0;
            border: none;
            background: transparent;
        }

        .view-container {
            opacity: 1;
            transform: translateY(0);
            transition:
                opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            height: 100%;
            animation: fadeInScale 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .view-container.entering {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
        }

        @keyframes fadeInScale {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        ::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
        }

        ::-webkit-scrollbar-track { background: transparent !important; }

        ::-webkit-scrollbar-thumb { background: transparent !important; border: none !important; }

        ::-webkit-scrollbar-thumb:hover { background: transparent !important; }

        ::-webkit-scrollbar-corner {
            background: transparent;
        }
    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        isRecording: { type: Boolean },
        sessionActive: { type: Boolean },
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        isListening: { type: Boolean },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        advancedMode: { type: Boolean },
        isDarkMode: { type: Boolean },
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
    };

    constructor() {
        super();
        // Check if onboarding has been completed
        const onboardingCompleted = localStorage.getItem('onboardingCompleted');
        this.currentView = onboardingCompleted ? 'main' : 'onboarding';
        this.statusText = '';
        this.startTime = null;
        this.isRecording = false;
        this.sessionActive = false;
        this.selectedProfile = localStorage.getItem('selectedProfile') || 'interview';
        this.selectedLanguage = localStorage.getItem('selectedLanguage') || 'en-US';
        this.selectedScreenshotInterval = localStorage.getItem('selectedScreenshotInterval') || '5';
        this.selectedImageQuality = localStorage.getItem('selectedImageQuality') || 'medium';
        this.layoutMode = localStorage.getItem('layoutMode') || 'normal';
        this.advancedMode = localStorage.getItem('advancedMode') === 'true';
        this.isDarkMode = localStorage.getItem('isDarkMode') !== 'false'; // Default to dark mode
        this.responses = [];
        this.currentResponseIndex = -1;
        this.isListening = false;
        this._viewInstances = new Map();
        this._isClickThrough = false;

        // Apply layout mode to document root
        this.updateLayoutMode();

        // Apply initial theme
        this.applyTheme();

        // Sync theme state with localStorage
        this.syncThemeState();
    }

    connectedCallback() {
        super.connectedCallback();

        // Set up IPC listeners if needed
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('update-response', (_, response) => {
                this.setResponse(response);
            });
            ipcRenderer.on('update-status', (_, status) => {
                this.setStatus(status);
            });
            ipcRenderer.on('click-through-toggled', (_, isEnabled) => {
                this._isClickThrough = isEnabled;
            });
        }

        // Add functions to window.desireAI for IPC callbacks
        this.setupInterviewCrackerCallbacks();

        // Add theme toggle to window for debugging
        window.toggleTheme = () => this.handleToggleTheme();
        window.getCurrentTheme = () => this.isDarkMode ? 'dark' : 'light';
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('update-response');
            ipcRenderer.removeAllListeners('update-status');
            ipcRenderer.removeAllListeners('click-through-toggled');
        }
    }

    setupInterviewCrackerCallbacks() {
        // Initialize window.interviewCracker and window.desireAI if they don't exist
        if (!window.interviewCracker) {
            window.interviewCracker = {};
        }
        if (!window.interviewAI) {
            window.interviewAI = window.interviewCracker;
        }

        // Add functions to get current view and layout mode
        window.interviewAI.getCurrentView = window.interviewCracker.getCurrentView = () => {
            return this.currentView;
        };

        window.interviewAI.getLayoutMode = window.interviewCracker.getLayoutMode = () => {
            return this.layoutMode;
        };

        // Add function to set status
        window.interviewAI.setStatus = window.interviewCracker.setStatus = (status) => {
            this.setStatus(status);
        };
    }

    setStatus(text) {
        this.statusText = text;
    }

    setResponse(response) {
        this.responses.push(response);

        // If user is viewing the latest response (or no responses yet), auto-navigate to new response
        if (this.currentResponseIndex === this.responses.length - 2 || this.currentResponseIndex === -1) {
            this.currentResponseIndex = this.responses.length - 1;
        }

        // Hide loading indicator when response is received
        if (window.setScreenshotProcessing) {
            window.setScreenshotProcessing(false);
        }

        this.requestUpdate();
    }

    // Header event handlers
    handleCustomizeClick() {
        this.currentView = 'customize';
        this.requestUpdate();
    }

    handleHelpClick() {
        this.currentView = 'help';
        this.requestUpdate();
    }

    handleHistoryClick() {
        this.currentView = 'history';
        this.requestUpdate();
    }

    handleAdvancedClick() {
        this.currentView = 'advanced';
        this.requestUpdate();
    }

    handleLoginClick() {
        // TODO: Implement login functionality
        console.log('Login clicked');
    }

    async handleUpgradeClick() {
        // UPI deeplink for payment
        const upiDeeplink = 'upi://pay?pa=9420700711@ybl&pn=interview-ai&am=10&tn=software%20buy&cu=INR';

        // Show payment confirmation dialog
        const confirmed = confirm(
            'Upgrade to InterviewAI Pro\n\n' +
            '📱 UPI ID: 9420700711@ybl\n' +
            '📝 Note: software buy\n\n' +
            'Click OK to open UPI payment app\n' +
            'Or pay manually and contact us for activation.'
        );

        if (confirmed) {
            try {
                if (window.require) {
                    const { ipcRenderer } = window.require('electron');
                    await ipcRenderer.invoke('open-external', upiDeeplink);
                } else {
                    // Fallback for web environment
                    window.open(upiDeeplink, '_blank');
                }
            } catch (error) {
                console.error('Failed to open UPI payment:', error);
                // Fallback: show payment info
                alert('UPI Payment\n\nUPI ID: 9420700711@ybl\nAmount: ₹10\nNote: software buy\n\nPlease pay using any UPI app and contact us for activation.');
            }
        }
    }

    async handleClose() {
        if (this.currentView === 'customize' || this.currentView === 'help' || this.currentView === 'history') {
            this.currentView = 'main';
        } else if (this.currentView === 'assistant') {
            if (window.interviewAI) {
                window.interviewAI.stopCapture();
            }

            // Close the session
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('close-session');
            }
            this.sessionActive = false;
            this.currentView = 'main';
            console.log('Session closed');
        } else {
            // Quit the entire application
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('quit-application');
            }
        }
    }

    async handleHideToggle() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('toggle-window-visibility');
        }
    }

    async handleToggleListening() {
        console.log('handleToggleListening called!', this.isListening);
        console.log('window.interviewAI available:', !!window.interviewAI);
        if (window.interviewAI) {
            console.log('window.interviewAI methods:', Object.keys(window.interviewAI));
        }

        try {
            if (this.isListening) {
                // Stop listening
                console.log('Stopping listening...');
                if (window.interviewAI && window.interviewAI.stopCapture) {
                    window.interviewAI.stopCapture();
                } else {
                    console.error('window.interviewAI or stopCapture not available');
                }
                this.isListening = false;
                this.setStatus('Listening stopped');
                console.log('Listening stopped successfully');
            } else {
                // Start listening
                console.log('Starting listening...');
                if (window.interviewAI && window.interviewAI.startCapture) {
                    await window.interviewAI.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
                } else {
                    console.error('window.interviewAI or startCapture not available');
                }
                this.isListening = true;
                this.setStatus('Listening started...');
                console.log('Listening started successfully');
            }
        } catch (error) {
            console.error('Error toggling listening:', error);
            this.setStatus('Error: ' + error.message);
        }
    }

    // Main view event handlers
    async handleStart() {
        if (window.interviewAI) {
            await window.interviewAI.initializeGemini(this.selectedProfile, this.selectedLanguage);
            // Pass the screenshot interval as string (including 'manual' option)
            window.interviewAI.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
        }
        this.responses = [];
        this.currentResponseIndex = -1;
        this.isListening = true;
        this.startTime = Date.now();
        this.currentView = 'assistant';
    }

    async handleAPIKeyHelp() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', 'https://ai.google.dev/');
        }
    }

    // Customize view event handlers
    handleProfileChange(profile) {
        this.selectedProfile = profile;
    }

    handleLanguageChange(language) {
        this.selectedLanguage = language;
    }

    handleScreenshotIntervalChange(interval) {
        this.selectedScreenshotInterval = interval;
    }

    handleImageQualityChange(quality) {
        this.selectedImageQuality = quality;
        localStorage.setItem('selectedImageQuality', quality);
    }

    handleAdvancedModeChange(advancedMode) {
        this.advancedMode = advancedMode;
        localStorage.setItem('advancedMode', advancedMode.toString());
    }

    handleBackClick() {
        this.currentView = 'main';
        this.requestUpdate();
    }

    // Help view event handlers
    async handleExternalLinkClick(url) {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', url);
        }
    }

    // Assistant view event handlers
    async handleSendText(message) {
        if (window.interviewAI) {
            const result = await window.interviewAI.sendTextMessage(message);

            if (!result.success) {
                console.error('Failed to send message:', result.error);
                this.setStatus('Error sending message: ' + result.error);
            } else {
                this.setStatus('Message sent...');
            }
        }
    }

    handleResponseIndexChanged(e) {
        this.currentResponseIndex = e.detail.index;
    }

    // Onboarding event handlers
    handleOnboardingComplete() {
        this.currentView = 'main';
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        // Only notify main process of view change if the view actually changed
        if (changedProperties.has('currentView') && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('view-changed', this.currentView);

            // Add a small delay to smooth out the transition
            const viewContainer = this.shadowRoot?.querySelector('.view-container');
            if (viewContainer) {
                viewContainer.classList.add('entering');
                requestAnimationFrame(() => {
                    viewContainer.classList.remove('entering');
                });
            }
        }

        // Only update localStorage when these specific properties change
        if (changedProperties.has('selectedProfile')) {
            localStorage.setItem('selectedProfile', this.selectedProfile);
        }
        if (changedProperties.has('selectedLanguage')) {
            localStorage.setItem('selectedLanguage', this.selectedLanguage);
        }
        if (changedProperties.has('selectedScreenshotInterval')) {
            localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        }
        if (changedProperties.has('selectedImageQuality')) {
            localStorage.setItem('selectedImageQuality', this.selectedImageQuality);
        }
        if (changedProperties.has('layoutMode')) {
            this.updateLayoutMode();
        }
        if (changedProperties.has('advancedMode')) {
            localStorage.setItem('advancedMode', this.advancedMode.toString());
        }
        if (changedProperties.has('isDarkMode')) {
            localStorage.setItem('isDarkMode', this.isDarkMode.toString());
        }
    }

    renderCurrentView() {
        // Only re-render the view if it hasn't been cached or if critical properties changed
        const viewKey = `${this.currentView}-${this.selectedProfile}-${this.selectedLanguage}`;

        switch (this.currentView) {
            case 'onboarding':
                return html`
                    <onboarding-view .onComplete=${() => this.handleOnboardingComplete()} .onClose=${() => this.handleClose()}></onboarding-view>
                `;

            case 'main':
                return html`
                    <main-view
                        .onStart=${() => this.handleStart()}
                        .onAPIKeyHelp=${() => this.handleAPIKeyHelp()}
                        .onLayoutModeChange=${layoutMode => this.handleLayoutModeChange(layoutMode)}
                    ></main-view>
                `;

            case 'customize':
                return html`
                    <customize-view
                        .selectedProfile=${this.selectedProfile}
                        .selectedLanguage=${this.selectedLanguage}
                        .selectedScreenshotInterval=${this.selectedScreenshotInterval}
                        .selectedImageQuality=${this.selectedImageQuality}
                        .layoutMode=${this.layoutMode}
                        .advancedMode=${this.advancedMode}
                        .onProfileChange=${profile => this.handleProfileChange(profile)}
                        .onLanguageChange=${language => this.handleLanguageChange(language)}
                        .onScreenshotIntervalChange=${interval => this.handleScreenshotIntervalChange(interval)}
                        .onImageQualityChange=${quality => this.handleImageQualityChange(quality)}
                        .onLayoutModeChange=${layoutMode => this.handleLayoutModeChange(layoutMode)}
                        .onAdvancedModeChange=${advancedMode => this.handleAdvancedModeChange(advancedMode)}
                    ></customize-view>
                `;

            case 'help':
                return html` <help-view .onExternalLinkClick=${url => this.handleExternalLinkClick(url)}></help-view> `;

            case 'history':
                return html` <history-view></history-view> `;

            case 'advanced':
                return html` <advanced-view></advanced-view> `;

            case 'assistant':
                return html`
                    <assistant-view
                        .responses=${this.responses}
                        .currentResponseIndex=${this.currentResponseIndex}
                        .selectedProfile=${this.selectedProfile}
                        .onSendText=${message => this.handleSendText(message)}
                        @response-index-changed=${this.handleResponseIndexChanged}
                    ></assistant-view>
                `;

            default:
                return html`<div>Unknown view: ${this.currentView}</div>`;
        }
    }

    render() {
        const mainContentClass = `main-content ${this.currentView === 'assistant' ? 'assistant-view' : this.currentView === 'onboarding' ? 'onboarding-view' : 'with-border'
            }`;

        return html`
            <div class="window-container">
                <div class="container">
                    <app-header
                        .currentView=${this.currentView}
                        .statusText=${this.statusText}
                        .startTime=${this.startTime}
                        .advancedMode=${this.advancedMode}
                        .isListening=${this.isListening}
                        .isDarkMode=${this.isDarkMode}
                        .onCustomizeClick=${() => this.handleCustomizeClick()}
                        .onHelpClick=${() => this.handleHelpClick()}
                        .onHistoryClick=${() => this.handleHistoryClick()}
                        .onAdvancedClick=${() => this.handleAdvancedClick()}
                        .onLoginClick=${() => this.handleLoginClick()}
                        .onUpgradeClick=${() => this.handleUpgradeClick()}
                        .onCloseClick=${() => this.handleClose()}
                        .onBackClick=${() => this.handleBackClick()}
                        .onHideToggleClick=${() => this.handleHideToggle()}
                        .onToggleListening=${this.handleToggleListening.bind(this)}
                        .onToggleTheme=${() => this.handleToggleTheme()}
                        ?isClickThrough=${this._isClickThrough}
                    ></app-header>
                    <div class="${mainContentClass}">
                        <div class="view-container">${this.renderCurrentView()}</div>
                    </div>
                </div>
            </div>
        `;
    }

    updateLayoutMode() {
        // Apply or remove compact layout class to document root
        if (this.layoutMode === 'compact') {
            document.documentElement.classList.add('compact-layout');
        } else {
            document.documentElement.classList.remove('compact-layout');
        }
    }

    applyTheme() {
        try {
            // Apply theme to document root
            if (this.isDarkMode) {
                document.documentElement.removeAttribute('data-theme');
                // Set dark theme specific backdrop filter
                document.body.style.backdropFilter = 'blur(8px)';
                document.body.style.webkitBackdropFilter = 'blur(8px)';
                // Clear any light-theme-specific filters
                document.body.style.filter = '';
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                // Set light theme enhanced glass effect
                document.body.style.backdropFilter = 'blur(var(--glass-blur, 12px))';
                document.body.style.webkitBackdropFilter = 'blur(var(--glass-blur, 12px))';
                // Apply additional light theme glass effect properties
                document.body.style.filter = `saturate(var(--glass-saturation, 180%)) brightness(var(--glass-brightness, 1.15))`;
            }

            // Force a repaint to ensure theme is applied
            document.documentElement.style.display = 'none';
            document.documentElement.offsetHeight; // Trigger reflow
            document.documentElement.style.display = '';

            // Apply enhanced glass effect to window container
            const windowContainer = this.shadowRoot?.querySelector('.window-container');
            if (windowContainer) {
                if (this.isDarkMode) {
                    windowContainer.style.backdropFilter = 'blur(8px)';
                    windowContainer.style.webkitBackdropFilter = 'blur(8px)';
                } else {
                    windowContainer.style.backdropFilter = 'blur(var(--glass-blur, 12px))';
                    windowContainer.style.webkitBackdropFilter = 'blur(var(--glass-blur, 12px))';
                }
            }
        } catch (error) {
            console.error('Error applying theme:', error);
        }
    }

    handleToggleTheme() {
        try {
            this.isDarkMode = !this.isDarkMode;
            localStorage.setItem('isDarkMode', this.isDarkMode.toString());
            this.applyTheme();
            this.requestUpdate();

            // Log theme change for debugging
            console.log('Theme toggled to:', this.isDarkMode ? 'dark' : 'light');
        } catch (error) {
            console.error('Error toggling theme:', error);
            // Revert on error
            this.isDarkMode = !this.isDarkMode;
        }
    }

    syncThemeState() {
        try {
            const savedTheme = localStorage.getItem('isDarkMode');
            if (savedTheme !== null) {
                this.isDarkMode = savedTheme === 'true';
                this.applyTheme();
            }
        } catch (error) {
            console.error('Error syncing theme state:', error);
        }
    }

    async handleLayoutModeChange(layoutMode) {
        this.layoutMode = layoutMode;
        localStorage.setItem('layoutMode', layoutMode);
        this.updateLayoutMode();

        // Notify main process about layout change for window resizing
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-sizes');
            } catch (error) {
                console.error('Failed to update sizes in main process:', error);
            }
        }

        this.requestUpdate();
    }
}

customElements.define('interview-ai-app', InterviewCrackerApp);