import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class AssistantView extends LitElement {
    static styles = css`
        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .main-flex-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            flex: 1 1 auto;
        }

        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
        }

        .response-container {
            flex: 1 1 auto;
            min-height: 60px;
            max-height: 80vh;
            overflow-y: auto;
            border-radius: var(--border-radius);
            font-size: var(--response-font-size);
            line-height: 1.6;
            background: linear-gradient(135deg, var(--card-background) 0%, var(--background-transparent) 100%);
            padding: 20px;
            scroll-behavior: smooth;
            border: 1px solid var(--card-border);
            backdrop-filter: blur(10px);
            box-shadow: inset 0 1px 0 var(--card-border);
            position: relative;
            animation: fadeInScale 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes fadeInScale {
            from {
                opacity: 0;
                transform: scale(0.98);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        .response-container::-webkit-scrollbar {
            width: 8px;
        }

        .response-container::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 4px;
        }

        .response-container::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, var(--scrollbar-thumb) 0%, var(--card-border) 100%);
            border-radius: 4px;
            border: 1px solid var(--card-border);
        }

        .response-container::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, var(--scrollbar-thumb-hover) 0%, var(--accent-color) 100%);
        }

        /* Enhanced Markdown styling */
        .response-container h1,
        .response-container h2,
        .response-container h3,
        .response-container h4,
        .response-container h5,
        .response-container h6 {
            margin: 1.2em 0 0.6em 0;
            color: var(--text-color);
            font-weight: 600;
            position: relative;
            padding-left: 12px;
            animation: slideInLeft 0.5s ease-out;
        }

        .response-container h1::before,
        .response-container h2::before,
        .response-container h3::before,
        .response-container h4::before,
        .response-container h5::before,
        .response-container h6::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: linear-gradient(180deg, var(--accent-color) 0%, var(--secondary-color) 100%);
            border-radius: 2px;
        }

        @keyframes slideInLeft {
            from {
                opacity: 0;
                transform: translateX(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .response-container h1 {
            font-size: 1.8em;
        }
        .response-container h2 {
            font-size: 1.5em;
        }
        .response-container h3 {
            font-size: 1.3em;
        }
        .response-container h4 {
            font-size: 1.1em;
        }
        .response-container h5 {
            font-size: 1em;
        }
        .response-container h6 {
            font-size: 0.9em;
        }

        .response-container p {
            margin: 0.8em 0;
            color: var(--text-color);
            animation: fadeInUp 0.6s ease-out;
            animation-fill-mode: both;
        }

        .response-container p:nth-child(1) { animation-delay: 0.1s; }
        .response-container p:nth-child(2) { animation-delay: 0.2s; }
        .response-container p:nth-child(3) { animation-delay: 0.3s; }
        .response-container p:nth-child(4) { animation-delay: 0.4s; }
        .response-container p:nth-child(5) { animation-delay: 0.5s; }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(15px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .response-container ul,
        .response-container ol {
            margin: 0.8em 0;
            padding-left: 2em;
            color: var(--text-color);
        }

        .response-container li {
            margin: 0.4em 0;
            animation: slideInLeft 0.5s ease-out;
            animation-fill-mode: both;
            padding-left: 8px;
            position: relative;
        }

        .response-container li::before {
            content: '•';
            color: var(--focus-border-color);
            font-weight: bold;
            position: absolute;
            left: -8px;
            animation: bulletPulse 0.6s ease-out;
        }

        @keyframes bulletPulse {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }

        .response-container li:nth-child(1) { animation-delay: 0.1s; }
        .response-container li:nth-child(2) { animation-delay: 0.2s; }
        .response-container li:nth-child(3) { animation-delay: 0.3s; }
        .response-container li:nth-child(4) { animation-delay: 0.4s; }
        .response-container li:nth-child(5) { animation-delay: 0.5s; }

        .response-container blockquote {
            margin: 1em 0;
            padding: 1em 1.5em;
            border-left: 4px solid var(--focus-border-color);
            background: linear-gradient(135deg, var(--input-background) 0%, var(--card-background) 100%);
            font-style: italic;
            border-radius: 0 8px 8px 0;
            position: relative;
            animation: slideInRight 0.6s ease-out;
            box-shadow: 0 2px 8px var(--shadow-color, rgba(0, 0, 0, 0.1));
        }

        .response-container blockquote::before {
            content: '"';
            position: absolute;
            top: -10px;
            left: 10px;
            font-size: 3em;
            color: var(--focus-border-color);
            opacity: 0.3;
            font-family: serif;
        }

        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(20px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .response-container code {
            background: var(--button-background);
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.85em;
        }

        .response-container pre {
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 6px;
            padding: 1em;
            overflow-x: auto;
            margin: 1em 0;
            position: relative;
        }

        .response-container pre code {
            background: none;
            padding: 0;
            border-radius: 0;
        }

        /* Copy button styles */
        .copy-button {
            position: absolute;
            top: 8px;
            right: 8px;
            background: var(--button-background);
            border: 1px solid var(--card-border);
            color: var(--text-color);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            opacity: 0.7;
        }

        .copy-button:hover {
            background: var(--hover-background);
            opacity: 1;
        }

        .copy-button.copied {
            background: rgba(52, 211, 153, 0.2);
            border-color: rgba(52, 211, 153, 0.4);
            color: #34d399;
        }

        /* Enhanced code block styling */
        .response-container pre {
            background: var(--input-background) !important;
            border: 1px solid var(--card-border) !important;
            border-radius: 12px !important;
            padding: 20px !important;
            margin: 20px 0 !important;
            position: relative !important;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Roboto Mono', monospace !important;
            font-size: 14px !important;
            line-height: 1.6 !important;
            overflow-x: auto !important;
            backdrop-filter: blur(15px) !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
            animation: slideInUp 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
            transition: all 0.3s ease !important;
        }

        .response-container pre:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3) !important;
            border-color: var(--accent-color) !important;
        }

        .response-container pre code {
            background: none !important;
            padding: 0 !important;
            border-radius: 0 !important;
            color: var(--text-color) !important;
        }

        /* Enhanced Loading indicator styles */
        .loading-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            color: var(--text-color);
            font-size: 16px;
            background: var(--card-background);
            border-radius: 16px;
            margin: 16px 0;
            border: 1px solid var(--card-border);
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            animation: slideInUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            position: relative;
            overflow: hidden;
        }

        .loading-indicator::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, var(--accent-color), transparent);
            animation: shimmer 2s infinite;
        }

        .loading-spinner {
            width: 24px;
            height: 24px;
            border: 3px solid var(--card-border);
            border-top: 3px solid var(--accent-color);
            border-radius: 50%;
            animation: spin 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
            margin-right: 16px;
            box-shadow: 0 0 20px var(--accent-color);
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
        }

        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .loading-text {
            font-weight: 600;
            color: var(--text-color);
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }

        .shortcut-hint {
            position: absolute;
            top: 16px;
            right: 16px;
            color: var(--description-color);
            font-size: 12px;
            font-weight: 500;
            opacity: 0;
            background: var(--card-background);
            padding: 8px 12px;
            border-radius: 8px;
            backdrop-filter: blur(15px);
            border: 1px solid var(--card-border);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            animation: fadeInSlide 0.6s ease-out 0.5s forwards;
            transform: translateX(20px);
        }

        @keyframes fadeInSlide {
            to {
                opacity: 0.8;
                transform: translateX(0);
            }
        }

        .shortcut-hint:hover {
            opacity: 1 !important;
            transform: translateX(0) scale(1.05);
            transition: all 0.3s ease;
        }

        /* VS Code-like syntax highlighting colors with transparent background */
        .response-container .hljs {
            background: transparent !important;
            color: #f7f7fa !important;
        }

        .response-container .hljs-keyword {
            color: #569cd6 !important;
        }

        .response-container .hljs-string {
            color: #ce9178 !important;
        }

        .response-container .hljs-comment {
            color: #6a9955 !important;
        }

        .response-container .hljs-function {
            color: #dcdcaa !important;
        }

        .response-container .hljs-number {
            color: #b5cea8 !important;
        }

        .response-container .hljs-operator {
            color: #d4d4d4 !important;
        }

        .response-container .hljs-punctuation {
            color: #d4d4d4 !important;
        }

        .response-container .hljs-variable {
            color: #9cdcfe !important;
        }

        .response-container .hljs-property {
            color: #9cdcfe !important;
        }

        .response-container .hljs-class {
            color: #4ec9b0 !important;
        }

        .response-container .hljs-built_in {
            color: #4ec9b0 !important;
        }

        .response-container .hljs-title {
            color: #dcdcaa !important;
        }

        .response-container .hljs-params {
            color: #9cdcfe !important;
        }

        .response-container .hljs-literal {
            color: #569cd6 !important;
        }

        .response-container .hljs-type {
            color: #4ec9b0 !important;
        }

        .response-container .hljs-regexp {
            color: #d16969 !important;
        }

        .response-container .hljs-symbol {
            color: #dcdcaa !important;
        }

        .response-container .hljs-tag {
            color: #569cd6 !important;
        }

        .response-container .hljs-attr {
            color: #9cdcfe !important;
        }

        .response-container .hljs-value {
            color: #ce9178 !important;
        }

        /* Copy button styles */
        .copy-button {
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: var(--text-color);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            opacity: 0.7;
        }

        .copy-button:hover {
            background: rgba(255, 255, 255, 0.2);
            opacity: 1;
        }

        .copy-button.copied {
            background: rgba(52, 211, 153, 0.2);
            border-color: rgba(52, 211, 153, 0.4);
            color: #34d399;
        }

        /* VS Code-like syntax highlighting */
        .response-container .hljs {
            background: #1e1e1e;
            color: #d4d4d4;
        }

        .response-container .hljs-keyword {
            color: #569cd6;
        }

        .response-container .hljs-string {
            color: #ce9178;
        }

        .response-container .hljs-comment {
            color: #6a9955;
        }

        .response-container .hljs-function {
            color: #dcdcaa;
        }

        .response-container .hljs-number {
            color: #b5cea8;
        }

        .response-container .hljs-operator {
            color: #d4d4d4;
        }

        .response-container .hljs-punctuation {
            color: #d4d4d4;
        }

        .response-container .hljs-variable {
            color: #9cdcfe;
        }

        .response-container .hljs-property {
            color: #9cdcfe;
        }

        .response-container .hljs-class {
            color: #4ec9b0;
        }

        .response-container .hljs-built_in {
            color: #4ec9b0;
        }

        .response-container .hljs-title {
            color: #dcdcaa;
        }

        .response-container .hljs-params {
            color: #9cdcfe;
        }

        .response-container .hljs-literal {
            color: #569cd6;
        }

        .response-container .hljs-type {
            color: #4ec9b0;
        }

        .response-container .hljs-regexp {
            color: #d16969;
        }

        .response-container .hljs-symbol {
            color: #dcdcaa;
        }

        .response-container .hljs-tag {
            color: #569cd6;
        }

        .response-container .hljs-attr {
            color: #9cdcfe;
        }

        .response-container .hljs-value {
            color: #ce9178;
        }

        .response-container a {
            color: var(--link-color);
            text-decoration: none;
        }

        .response-container a:hover {
            text-decoration: underline;
        }

        .response-container strong,
        .response-container b {
            font-weight: 600;
            color: var(--text-color);
        }

        .response-container em,
        .response-container i {
            font-style: italic;
        }

        .response-container hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 2em 0;
        }

        .response-container table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }

        .response-container th,
        .response-container td {
            border: 1px solid var(--border-color);
            padding: 0.5em;
            text-align: left;
        }

        .response-container th {
            background: var(--input-background);
            font-weight: 600;
        }

        .response-container::-webkit-scrollbar {
            width: 8px;
        }

        .response-container::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 4px;
        }

        .response-container::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 4px;
        }

        .response-container::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        .text-input-container {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 18px 0 0 0;
        }

        #textInput {
            flex: 1 1 auto;
            background: var(--input-background);
            border: 1.5px solid var(--button-border);
            color: var(--text-color);
            border-radius: 18px;
            font-size: 15px;
            padding: 10px 16px;
            height: 40px;
            outline: none;
            box-shadow: none;
            transition: border 0.2s, box-shadow 0.2s, background 0.2s;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            letter-spacing: 0.2px;
        }
        #textInput:focus {
            border: 1.5px solid var(--focus-border-color);
            background: var(--input-focus-background);
            box-shadow: 0 0 0 2px var(--focus-box-shadow);
        }
        #textInput::placeholder {
            color: var(--placeholder-color);
            opacity: 1;
            font-size: 14px;
            letter-spacing: 0.1px;
        }

        .text-input-container button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 0 14px;
            height: 40px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 70px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .text-input-container button:hover {
            background: var(--button-hover-background);
            border-color: var(--button-hover-border, var(--button-border));
        }

        .nav-button {
            background: var(--button-background);
            border: 1.5px solid var(--button-border);
            color: var(--text-color);
            border-radius: 50%;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: none;
            transition: background 0.2s, border 0.2s, color 0.2s, box-shadow 0.2s;
            cursor: pointer;
            outline: none;
        }
        .nav-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .nav-button:hover:not(:disabled) {
            background: var(--button-hover-background);
            color: var(--text-color);
            border-color: var(--button-hover-border, var(--button-border));
        }
        .nav-button svg {
            width: 20px;
            height: 20px;
            stroke: currentColor;
            transition: stroke 0.2s;
        }
        .nav-button:hover svg {
            stroke: currentColor;
        }

        .response-counter {
            font-size: 13px;
            color: var(--text-color);
            white-space: nowrap;
            min-width: 70px;
            text-align: center;
            background: var(--button-background);
            border: 1px solid var(--button-border);
            border-radius: 10px;
            height: 36px;
            padding: 0 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
            font-weight: 500;
        }
    `;

    static properties = {
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        selectedProfile: { type: String },
        onSendText: { type: Function },
        isProcessingScreenshot: { type: Boolean },
    };

    constructor() {
        super();
        this.responses = [];
        this.currentResponseIndex = -1;
        this.selectedProfile = 'interview';
        this.onSendText = () => {};
        this.isProcessingScreenshot = false;
    }

    getProfileNames() {
        return {
            interview: 'Job Interview',
            sales: 'Sales Call',
            meeting: 'Business Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
        };
    }

    getCurrentResponse() {
        const profileNames = this.getProfileNames();
        return this.responses.length > 0 && this.currentResponseIndex >= 0
            ? this.responses[this.currentResponseIndex]
            : `Hello! How can I help you today?`;
    }

    renderMarkdown(content) {
        // Check if marked is available
        if (typeof window !== 'undefined' && window.marked) {
            try {
                // Configure marked for better security and formatting
                window.marked.setOptions({
                    breaks: true,
                    gfm: true,
                    sanitize: true, // Never trust AI responses for HTML!
                });
                let rendered = window.marked.parse(content);
                
                // Add copy buttons to code blocks
                rendered = this.addCopyButtonsToCodeBlocks(rendered);
                
                console.log('Markdown rendered successfully');
                return rendered;
            } catch (error) {
                console.warn('Error parsing markdown:', error);
                return content; // Fallback to plain text
            }
        }
        console.log('Marked not available, using plain text');
        return content; // Fallback if marked is not available
    }

    addCopyButtonsToCodeBlocks(html) {
        // Replace <pre><code> blocks with copy button and syntax highlighting
        return html.replace(
            /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g,
            (match, codeContent) => {
                const cleanCode = codeContent
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'");
                
                // Apply syntax highlighting if highlight.js is available
                let highlightedCode = codeContent;
                if (window.hljs) {
                    try {
                        // Try to detect language from code content
                        const language = this.detectLanguage(cleanCode);
                        if (language) {
                            highlightedCode = window.hljs.highlight(cleanCode, { language }).value;
                        } else {
                            highlightedCode = window.hljs.highlightAuto(cleanCode).value;
                        }
                    } catch (error) {
                        console.warn('Syntax highlighting failed:', error);
                        highlightedCode = codeContent;
                    }
                }
                
                return `<pre><code class="hljs">${highlightedCode}</code><button class="copy-button" onclick="copyCode(this, \`${cleanCode.replace(/`/g, '\\`')}\`)">Copy</button></pre>`;
            }
        );
    }

    detectLanguage(code) {
        // Simple language detection based on code patterns
        const patterns = {
            'javascript': /(function|const|let|var|=>|console\.|\.js$)/i,
            'python': /(def |import |from |print\(|\.py$)/i,
            'java': /(public |class |import |System\.|\.java$)/i,
            'cpp': /(#include|std::|cout|cin|\.cpp$|\.h$)/i,
            'csharp': /(using |namespace |class |Console\.|\.cs$)/i,
            'php': /(<\?php|echo |function |\$[a-zA-Z_])/i,
            'ruby': /(def |puts |require |\.rb$)/i,
            'go': /(package |import |func |fmt\.|\.go$)/i,
            'rust': /(fn |let |mut |println!|\.rs$)/i,
            'sql': /(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|FROM|WHERE)/i,
            'html': /(<html|<head|<body|<div|<span|<p>)/i,
            'css': /(\.|#|\{|margin|padding|color|background)/i,
            'bash': /(#!\/bin|echo |ls |cd |mkdir|rm |chmod)/i
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
            if (pattern.test(code)) {
                return lang;
            }
        }
        return null;
    }

    getResponseCounter() {
        return this.responses.length > 0 ? `${this.currentResponseIndex + 1}/${this.responses.length}` : '';
    }

    navigateToPreviousResponse() {
        if (this.currentResponseIndex > 0) {
            this.currentResponseIndex--;
            this.dispatchEvent(
                new CustomEvent('response-index-changed', {
                    detail: { index: this.currentResponseIndex },
                })
            );
            this.requestUpdate();
        }
    }

    navigateToNextResponse() {
        if (this.currentResponseIndex < this.responses.length - 1) {
            this.currentResponseIndex++;
            this.dispatchEvent(
                new CustomEvent('response-index-changed', {
                    detail: { index: this.currentResponseIndex },
                })
            );
            this.requestUpdate();
        }
    }

    scrollResponseUp() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) {
            const scrollAmount = container.clientHeight * 0.3; // Scroll 30% of container height
            container.scrollTop = Math.max(0, container.scrollTop - scrollAmount);
        }
    }

    scrollResponseDown() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) {
            const scrollAmount = container.clientHeight * 0.3; // Scroll 30% of container height
            container.scrollTop = Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + scrollAmount);
        }
    }

    loadFontSize() {
        const fontSize = localStorage.getItem('fontSize');
        if (fontSize !== null) {
            const fontSizeValue = parseInt(fontSize, 10) || 20;
            const root = document.documentElement;
            root.style.setProperty('--response-font-size', `${fontSizeValue}px`);
        }
    }

    connectedCallback() {
        super.connectedCallback();

        // Load and apply font size
        this.loadFontSize();

        // Add copy function to global scope
        window.copyCode = (button, code) => {
            navigator.clipboard.writeText(code).then(() => {
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.classList.add('copied');
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy code:', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = code;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.classList.add('copied');
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove('copied');
                }, 2000);
            });
        };

        // Add function to control screenshot processing state
        window.setScreenshotProcessing = (isProcessing) => {
            this.isProcessingScreenshot = isProcessing;
            this.requestUpdate();
        };

        // Set up IPC listeners for keyboard shortcuts
        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            this.handlePreviousResponse = () => {
                console.log('Received navigate-previous-response message');
                this.navigateToPreviousResponse();
            };

            this.handleNextResponse = () => {
                console.log('Received navigate-next-response message');
                this.navigateToNextResponse();
            };

            this.handleScrollUp = () => {
                console.log('Received scroll-response-up message');
                this.scrollResponseUp();
            };

            this.handleScrollDown = () => {
                console.log('Received scroll-response-down message');
                this.scrollResponseDown();
            };

            ipcRenderer.on('navigate-previous-response', this.handlePreviousResponse);
            ipcRenderer.on('navigate-next-response', this.handleNextResponse);
            ipcRenderer.on('scroll-response-up', this.handleScrollUp);
            ipcRenderer.on('scroll-response-down', this.handleScrollDown);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        // Clean up IPC listeners
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            if (this.handlePreviousResponse) {
                ipcRenderer.removeListener('navigate-previous-response', this.handlePreviousResponse);
            }
            if (this.handleNextResponse) {
                ipcRenderer.removeListener('navigate-next-response', this.handleNextResponse);
            }
            if (this.handleScrollUp) {
                ipcRenderer.removeListener('scroll-response-up', this.handleScrollUp);
            }
            if (this.handleScrollDown) {
                ipcRenderer.removeListener('scroll-response-down', this.handleScrollDown);
            }
        }
    }

    async handleSendText() {
        const textInput = this.shadowRoot.querySelector('#textInput');
        if (textInput && textInput.value.trim()) {
            const message = textInput.value.trim();
            textInput.value = ''; // Clear input
            await this.onSendText(message);
        }
    }

    handleTextKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendText();
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = this.shadowRoot.querySelector('.response-container');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 0);
    }

    firstUpdated() {
        super.firstUpdated();
        this.updateResponseContent();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('responses') || changedProperties.has('currentResponseIndex')) {
            this.updateResponseContent();
        }
    }

    updateResponseContent() {
        console.log('updateResponseContent called');
        const container = this.shadowRoot.querySelector('#responseContainer');
        if (container) {
            const currentResponse = this.getCurrentResponse();
            console.log('Current response:', currentResponse);
            const renderedResponse = this.renderMarkdown(currentResponse);
            console.log('Rendered response:', renderedResponse);
            container.innerHTML = renderedResponse;
        } else {
            console.log('Response container not found');
        }
    }

    render() {
        const currentResponse = this.getCurrentResponse();
        const responseCounter = this.getResponseCounter();

        return html`
            <div class="main-flex-container">
                <div class="response-container" id="responseContainer">
                    ${this.isProcessingScreenshot ? html`
                        <div class="loading-indicator">
                            <div class="loading-spinner"></div>
                            <span class="loading-text">Analyzing screenshot for questions...</span>
                        </div>
                    ` : ''}
                </div>
                <div class="shortcut-hint">Press the analyze shortcut to capture the screen</div>
                <div class="text-input-container">
                    <button class="nav-button" @click=${this.navigateToPreviousResponse} ?disabled=${this.currentResponseIndex <= 0}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 5l-4 4 4 4"/>
                        </svg>
                    </button>

                    ${this.responses.length > 0 ? html` <span class="response-counter">${responseCounter}</span> ` : ''}

                    <input type="text" id="textInput" placeholder="Type your question..." @keydown=${this.handleTextKeydown} />

                    <button class="nav-button" @click=${this.navigateToNextResponse} ?disabled=${this.currentResponseIndex >= this.responses.length - 1}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M7 5l4 4-4 4"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }
}

customElements.define('assistant-view', AssistantView);
