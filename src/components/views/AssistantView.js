import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { resizeLayout } from '../../utils/windowResize.js';

export class AssistantView extends LitElement {
    static styles = css`
        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            cursor: default !important;
        }

        * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            cursor: default !important;
        }

        .response-container {
            height: calc(100% - 50px);
            overflow-y: auto;
            font-size: var(--response-font-size, 16px);
            line-height: 1.6;
            background: var(--bg-primary);
            padding: 12px;
            scroll-behavior: smooth;
            user-select: text;
        }

        .response-container * {
            user-select: text;
        }

        /* Markdown styling */
        .response-container h1, .response-container h2, .response-container h3,
        .response-container h4, .response-container h5, .response-container h6 {
            margin: 1em 0 0.5em 0;
            color: var(--text-color);
            font-weight: 600;
        }

        .response-container h1 { font-size: 1.6em; }
        .response-container h2 { font-size: 1.4em; }
        .response-container h3 { font-size: 1.2em; }

        .response-container p { margin: 0.6em 0; color: var(--text-color); }
        .response-container ul, .response-container ol { margin: 0.6em 0; padding-left: 1.5em; color: var(--text-color); }
        .response-container li { margin: 0.3em 0; }

        .response-container code {
            background: rgba(255, 255, 255, 0.1);
            padding: 0.2em 0.4em;
            border-radius: 6px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 0.9em;
            word-break: break-word;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .response-container pre {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 16px;
            overflow-x: auto;
            margin: 1.2em 0;
            position: relative;
        }

        .response-container pre code {
            background: none;
            padding: 0;
            display: block;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 0.9em;
            line-height: 1.5;
            color: #e0e0e0;
        }

        .copy-button {
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            transition: all 0.2s ease;
            backdrop-filter: blur(4px);
            z-index: 10;
        }

        .copy-button:hover { background: rgba(255, 255, 255, 0.2); color: #fff; }
        .copy-button.copied { background: #4CAF50; color: #fff; border-color: #4CAF50; }

        .red-separator {
            height: 2px;
            background: #ff4d4d;
            margin: 32px 0;
            width: 100%;
            opacity: 0.8;
            box-shadow: 0 0 10px rgba(255, 77, 77, 0.3);
            border-radius: 2px;
        }

        .response-item {
            animation: fadeIn 0.4s ease-out;
            margin-bottom: 8px;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .response-item.latest {
            border-left: 2px solid var(--accent-color, #ff4d4d);
            padding-left: 12px;
            margin-left: -12px;
        }

        /* ── Pagination styles ── */
        .pagination-wrapper {
            display: flex;
            flex-direction: column;
            height: calc(100% - 50px);
            overflow: hidden;
        }

        .pagination-response {
            flex: 1;
            overflow-y: auto;
            font-size: var(--response-font-size, 16px);
            line-height: 1.6;
            background: var(--bg-primary);
            padding: 12px 12px 8px 12px;
            user-select: text;
            scroll-behavior: smooth;
        }

        .pagination-response * {
            user-select: text;
        }

        .text-input-container {
            display: flex;
            gap: 8px;
            margin-top: 8px;
            align-items: center;
            flex-wrap: wrap;
            padding: 4px 12px;
        }

        .text-input-container input {
            flex: 1;
            background: transparent;
            color: var(--text-color);
            border: none;
            border-bottom: 1px solid var(--border-color);
            padding: 8px 4px;
            font-size: 13px;
        }

        .text-input-container input:focus { outline: none; border-bottom-color: var(--text-color); }

        .nav-button {
            background: transparent;
            color: var(--text-secondary);
            border: none;
            padding: 6px;
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.1s ease;
        }

        .nav-button:hover { background: var(--hover-background); color: var(--text-color); }

        .shortcut-toggle {
            background: var(--bg-secondary);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
        }

        .shortcut-help {
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: var(--card-background);
            border: 1px solid var(--card-border);
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 300px;
            font-size: 12px;
            color: var(--text-color);
            display: none;
            z-index: 1000;
        }
        .shortcut-help.visible { display: block; }

        .notes-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--bg-primary);
            z-index: 200;
            display: flex;
            flex-direction: column;
            animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }

        .notes-overlay-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 20px;
            border-bottom: 1px solid var(--border-color);
        }

        .notes-overlay-content { flex: 1; overflow: hidden; }

        .screen-answer-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            background: var(--btn-primary-bg, #ffffff);
            color: var(--btn-primary-text, #000000);
            border: none;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.15s ease;
        }

        .screen-answer-btn:hover { background: var(--btn-primary-hover, #f0f0f0); }

        .corner-resize {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 16px;
            height: 16px;
            cursor: nwse-resize !important;
            background: var(--bg-secondary);
            border-top-left-radius: 4px;
        }
    `;

    static properties = {
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        selectedProfile: { type: String },
        onSendText: { type: Function },
        flashCount: { type: Number },
        flashLiteCount: { type: Number },
        showNotes: { type: Boolean },
        showShortcuts: { type: Boolean },
        responseFontSize: { type: Number },
        windowShape: { type: String },
        liveTranscription: { type: String },
        responseStyle: { type: String }, // 'scroll' | 'paginate'
    };

    constructor() {
        super();
        this.responses = [];
        this.currentResponseIndex = -1;
        this.selectedProfile = 'interview';
        this.onSendText = () => { };
        this.flashCount = 0;
        this.flashLiteCount = 0;
        this.showNotes = false;
        this.showShortcuts = false;
        this.responseFontSize = parseInt(localStorage.getItem('responseFontSize')) || 16;
        this.windowShape = localStorage.getItem('windowShape') || 'rounded';
        this.liveTranscription = '';
        this.responseStyle = localStorage.getItem('responseStyle') || 'paginate';
        this._renderedMarkdownCache = new Map();
    }

    getProfileNames() {
        return {
            interview: 'Job Interview',
            sales: 'Sales Call',
            meeting: 'Business Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
            exam: 'Exam Assistant',
        };
    }

    renderMarkdown(content) {
        if (this._renderedMarkdownCache.has(content)) {
            return this._renderedMarkdownCache.get(content);
        }

        if (typeof window !== 'undefined' && window.marked) {
            try {
                window.marked.setOptions({ breaks: true, gfm: true, sanitize: false });
                const rendered = window.marked.parse(content);
                this._renderedMarkdownCache.set(content, rendered);
                return rendered;
            } catch (error) {
                console.warn('Error parsing markdown:', error);
                return content;
            }
        }
        return content;
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        const responsesChanged = changedProperties.has('responses');
        const indexChanged = changedProperties.has('currentResponseIndex');

        if (responsesChanged || indexChanged) {
            console.log('📄 [AssistantView] updated() fired. responsesChanged:', responsesChanged, 'indexChanged:', indexChanged);
            console.log('📄 [AssistantView] currentResponseIndex:', this.currentResponseIndex, 'responses.length:', this.responses.length);
            console.log('📄 [AssistantView] responseStyle:', this.responseStyle);

            const container = this.shadowRoot.querySelector('#responseContainer');
            if (container) {
                const responseItems = container.querySelectorAll('.response-item[data-response-index]');

                const oldResponses = changedProperties.get('responses');
                const isStreamingUpdate = responsesChanged && oldResponses &&
                    this.responses.length === oldResponses.length &&
                    this.responses.length > 0;

                if (isStreamingUpdate) {
                    const lastIndex = this.responses.length - 1;
                    const lastItem = container.querySelector(`.response-item[data-response-index="${lastIndex}"]`);
                    if (lastItem) {
                        const markdownDiv = lastItem.querySelector('.markdown-content');
                        if (markdownDiv) {
                            markdownDiv.innerHTML = this.renderMarkdown(this.responses[lastIndex]);
                        }
                    }
                } else {
                    responseItems.forEach((item) => {
                        const index = parseInt(item.getAttribute('data-response-index'));
                        const markdownDiv = item.querySelector('.markdown-content');
                        if (markdownDiv && this.responses[index]) {
                            const newHtml = this.renderMarkdown(this.responses[index]);
                            if (markdownDiv.innerHTML !== newHtml) {
                                markdownDiv.innerHTML = newHtml;
                            }
                        }
                    });
                }
            }

            // For pagination: update the single response pane
            const paginationContent = this.shadowRoot.querySelector('.pagination-content');
            if (paginationContent && this.responseStyle === 'paginate') {
                const idx = this.currentResponseIndex;
                console.log('📄 [AssistantView] Pagination render: idx =', idx, 'response exists:', idx >= 0 && idx < this.responses.length);
                if (idx >= 0 && idx < this.responses.length) {
                    const responseText = this.responses[idx];
                    console.log('📄 [AssistantView] Rendering response at index', idx, '- length:', responseText?.length || 0, '- preview:', (responseText || '').substring(0, 80));
                    paginationContent.innerHTML = this.renderMarkdown(responseText);
                } else {
                    console.log('📄 [AssistantView] No response at index', idx, '- clearing content');
                    paginationContent.innerHTML = '';
                }
            } else if (this.responseStyle === 'paginate') {
                console.log('📄 [AssistantView] WARNING: .pagination-content NOT found in shadow DOM!');
            }

            this.addCopyButtons();
            // Only auto-scroll in scroll mode
            if (this.responseStyle === 'scroll') {
                this.scrollToBottom();
            }
        }
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            const container = this.shadowRoot.querySelector('.response-container');
            if (container) {
                // Smooth scroll to bottom
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
            }
        });
    }

    addCopyButtons() {
        const container = this.shadowRoot.querySelector('#responseContainer');
        if (!container) return;
        const preBlocks = container.querySelectorAll('pre');
        preBlocks.forEach(pre => {
            if (pre.querySelector('.copy-button')) return;
            const button = document.createElement('button');
            button.className = 'copy-button';
            button.textContent = 'Copy';
            button.onclick = () => {
                const code = pre.querySelector('code');
                const textToCopy = code ? code.textContent : pre.textContent;
                this.copyCode(textToCopy, button);
            };
            pre.appendChild(button);
        });
    }

    async copyCode(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.classList.add('copied');
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    }

    toggleShortcuts() {
        this.showShortcuts = !this.showShortcuts;
        this.requestUpdate();
    }

    toggleNotes() {
        this.showNotes = !this.showNotes;
        this.requestUpdate();
    }

    handleTextKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendText();
        }
    }

    async handleSendText() {
        const textInput = this.shadowRoot.querySelector('#textInput');
        if (textInput && textInput.value.trim()) {
            const message = textInput.value.trim();
            textInput.value = '';

            // Actually send the message to Groq
            if (window.cheatingDaddy && window.cheatingDaddy.sendTextMessage) {
                window.cheatingDaddy.sendTextMessage(message);
            }

            // Also ensure window is resizable if needed
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.invoke('manual-resize');
            }
        }
    }

    async handleScreenAnswer() {
        if (window.captureManualScreenshot) {
            window.captureManualScreenshot();
            setTimeout(() => this.loadLimits(), 1000);
        }
    }

    async loadLimits() {
        if (window.interviewAI?.storage?.getTodayLimits) {
            const limits = await window.interviewAI.storage.getTodayLimits();
            this.flashCount = limits.flash?.count || 0;
            this.flashLiteCount = limits.flashLite?.count || 0;
        }
    }

    getTotalUsed() { return this.flashCount + this.flashLiteCount; }
    getTotalAvailable() { return 40; }

    connectedCallback() {
        super.connectedCallback();
        this.loadLimits();
        this.handleKeyDown = (e) => {
            if (e.shiftKey && (e.key === '+' || e.key === '=')) { e.preventDefault(); this.adjustResponseFontSize(2); }
            if (e.shiftKey && (e.key === '-' || e.key === '_')) { e.preventDefault(); this.adjustResponseFontSize(-2); }
        };
        window.addEventListener('keydown', this.handleKeyDown);

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            this.handlePreviousResponse = () => this.navigateToPreviousResponse();
            this.handleNextResponse = () => this.navigateToNextResponse();
            this.handleScrollUp = () => this.scrollResponseUp();
            this.handleScrollDown = () => this.scrollResponseDown();

            ipcRenderer.on('navigate-previous-response', this.handlePreviousResponse);
            ipcRenderer.on('navigate-next-response', this.handleNextResponse);
            ipcRenderer.on('scroll-response-up', this.handleScrollUp);
            ipcRenderer.on('scroll-response-down', this.handleScrollDown);

            // Response handling
            this.handleNewResponse = (e, text) => {
                this.responses = [...this.responses, text];
                this.currentResponseIndex = this.responses.length - 1;
                this.requestUpdate();
                this.scrollToBottom();
            };

            this.handleUpdateResponse = (e, text) => {
                if (this.responses.length > 0) {
                    const newResponses = [...this.responses];
                    newResponses[newResponses.length - 1] = text;
                    this.responses = newResponses;
                    this.requestUpdate();
                    this.scrollToBottom();
                }
            };

            ipcRenderer.on('new-response', this.handleNewResponse);
            ipcRenderer.on('update-response', this.handleUpdateResponse);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this.handleKeyDown);
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeListener('navigate-previous-response', this.handlePreviousResponse);
            ipcRenderer.removeListener('navigate-next-response', this.handleNextResponse);
            ipcRenderer.removeListener('scroll-response-up', this.handleScrollUp);
            ipcRenderer.removeListener('scroll-response-down', this.handleScrollDown);

            if (this.handleNewResponse) ipcRenderer.removeListener('new-response', this.handleNewResponse);
            if (this.handleUpdateResponse) ipcRenderer.removeListener('update-response', this.handleUpdateResponse);
        }
    }

    navigateToPreviousResponse() {
        if (this.currentResponseIndex > 0) {
            this.currentResponseIndex--;
            this.requestUpdate();
        }
    }

    navigateToNextResponse() {
        if (this.currentResponseIndex < this.responses.length - 1) {
            this.currentResponseIndex++;
            this.requestUpdate();
        }
    }

    scrollResponseUp() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) container.scrollTop = Math.max(0, container.scrollTop - container.clientHeight * 0.3);
    }

    scrollResponseDown() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) container.scrollTop = Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + container.clientHeight * 0.3);
    }

    render() {
        const profileNames = this.getProfileNames();
        const defaultMessage = `Hey, I'm listening to your ${profileNames[this.selectedProfile] || 'session'}...`;

        let borderRadius = '0px';
        if (this.windowShape === 'rounded') borderRadius = '24px';
        if (this.windowShape === 'circle') borderRadius = '100px';

        const isPaginate = this.responseStyle === 'paginate';
        const total = this.responses.length;
        const idx = this.currentResponseIndex;

        return html`
            <style>
                :host { border-radius: ${borderRadius}; overflow: hidden; }
                .response-container { border-radius: ${borderRadius} ${borderRadius} 0 0; }

                /* Pagination markdown styles (mirror .response-container markdown) */
                .pagination-content h1, .pagination-content h2, .pagination-content h3,
                .pagination-content h4, .pagination-content h5, .pagination-content h6 {
                    margin: 1em 0 0.5em 0; color: var(--text-color); font-weight: 600;
                }
                .pagination-content h1 { font-size: 1.6em; }
                .pagination-content h2 { font-size: 1.4em; }
                .pagination-content h3 { font-size: 1.2em; }
                .pagination-content p { margin: 0.6em 0; color: var(--text-color); }
                .pagination-content ul, .pagination-content ol { margin: 0.6em 0; padding-left: 1.5em; color: var(--text-color); }
                .pagination-content li { margin: 0.3em 0; }
                .pagination-content code {
                    background: rgba(255,255,255,0.1); padding: 0.2em 0.4em;
                    border-radius: 6px; font-family: 'SF Mono', Monaco, monospace;
                    font-size: 0.9em; word-break: break-word;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .pagination-content pre {
                    background: var(--bg-secondary); border: 1px solid var(--border-color);
                    border-radius: 12px; padding: 16px; overflow-x: auto;
                    margin: 1.2em 0; position: relative;
                }
                .pagination-content pre code {
                    background: none; padding: 0; display: block; white-space: pre-wrap;
                    word-wrap: break-word; font-size: 0.9em; line-height: 1.5; color: #e0e0e0;
                }
                .pagination-response::-webkit-scrollbar { width: 6px; }
                .pagination-response::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); }
                .pagination-response::-webkit-scrollbar-thumb {
                    background: var(--primary-color, #7fbcfa); border-radius: 3px;
                }
                .pagination-nav { border-bottom: 1px solid var(--border-color); }
            </style>

            ${isPaginate ? html`
                <!-- ═══ PAGINATION MODE ═══ -->
                <div class="pagination-wrapper" style="height: 100%;">
                    <div class="pagination-response" style="--response-font-size: ${this.responseFontSize}px">
                        ${total === 0 ? html`
                            <div style="opacity:0.6; font-style:italic; color:var(--text-color)">${defaultMessage}</div>
                        ` : html`
                            <div class="pagination-content" style="color:var(--text-color)"></div>
                        `}
                        ${this.liveTranscription ? html`
                            <div style="opacity:0.7; font-style:italic; color:var(--accent-color,#7fbcfa); margin-top:10px;">
                                <span style="font-size:0.8em; text-transform:uppercase; letter-spacing:1px; margin-right:8px;">Listening:</span>
                                "${this.liveTranscription}"
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : html`
                <!-- ═══ SCROLL MODE ═══ -->
                <div class="response-container" id="responseContainer" style="--response-font-size: ${this.responseFontSize}px">
                    ${this.responses.length === 0 ? html`
                        <div class="response-item" style="opacity: 0.6; font-style: italic;">${defaultMessage}</div>
                    ` : this.responses.map((response, index) => html`
                        <div class="red-separator"></div>
                        <div class="response-item ${index === this.responses.length - 1 ? 'latest' : ''}" data-response-index="${index}">
                            <div class="markdown-content"></div>
                        </div>
                    `)}
                    ${this.liveTranscription ? html`
                        <div class="response-item live-transcription" style="opacity: 0.7; font-style: italic; color: var(--accent-color, #7fbcfa); margin-top: 10px;">
                            <span style="font-size: 0.8em; text-transform: uppercase; letter-spacing: 1px; margin-right: 8px;">Listening:</span>
                            "${this.liveTranscription}"
                        </div>
                    ` : ''}
                </div>
            `}

            <div class="text-input-container">
                <button class="shortcut-toggle" @click=${this.toggleShortcuts}>Shortcuts</button>
                <div class="shortcut-help ${this.showShortcuts ? 'visible' : ''}">
                    <strong>Keyboard Shortcuts</strong>
                    <ul>
                        <li><kbd>Shift + +</kbd>: Font Size +</li>
                        <li><kbd>Shift + -</kbd>: Font Size -</li>
                        <li><kbd>Ctrl + +</kbd>: Zoom In</li>
                        <li><kbd>Ctrl + -</kbd>: Zoom Out</li>
                        <li><kbd>Shift + Arrows</kbd>: Move Window</li>
                        <li><kbd>Ctrl + \\</kbd>: Toggle Visibility</li>
                        <li><kbd>Ctrl + M</kbd>: Toggle Click-through</li>
                        <li><kbd>Ctrl + Enter</kbd>: Start/Screenshot</li>
                        ${isPaginate ? html`
                            <li><kbd>Ctrl + Shift + [</kbd>: Previous Response</li>
                            <li><kbd>Ctrl + Shift + ]</kbd>: Next Response</li>
                        ` : ''}
                    </ul>
                </div>
                <button class="nav-button" @click=${this.scrollToBottom} title="Scroll to bottom">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>

                <input type="text" id="textInput" placeholder="Type a message..." @keydown=${this.handleTextKeydown} />

                <div class="screen-answer-btn-wrapper">
                    <button class="screen-answer-btn" @click=${this.handleScreenAnswer}>
                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z"/></svg>
                        <span>Analyze</span>
                        <span class="usage-count">(${this.getTotalUsed()}/40)</span>
                    </button>
                </div>
                
                <button class="nav-button" @click=${this.toggleNotes} title="My Notes">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                </button>
            </div>

            ${this.showNotes ? html`
                <div class="notes-overlay">
                    <div class="notes-overlay-header">
                        <div style="font-weight: 600;">My Notes</div>
                        <button class="close-notes-btn" @click=${this.toggleNotes}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                    <div class="notes-overlay-content">
                        <notes-view .onHomeClick=${() => this.toggleNotes()}></notes-view>
                    </div>
                    <div class="corner-resize" @click=${this.manualResize}></div>
                </div>
            ` : ''}
        `;
    }
}

customElements.define('assistant-view', AssistantView);
