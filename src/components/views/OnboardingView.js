import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class OnboardingView extends LitElement {
    static styles = css`
        * {
            font-family:
                'Inter',
                -apple-system,
                BlinkMacSystemFont,
                'Segoe UI',
                Roboto,
                sans-serif;
            cursor: default;
            user-select: none;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :host {
            display: block;
            height: 100%;
            width: 100%;
            position: fixed;
            top: 0;
            left: 0;
            overflow: hidden;
        }

        .onboarding-container {
            position: relative;
            width: 100%;
            height: 100%;
            background: var(--background-transparent);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            overflow: hidden;
        }

        /* Subtle animated background */
        .background-pattern {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            opacity: 0.1;
            background: 
                radial-gradient(circle at 20% 80%, var(--primary-color) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, var(--secondary-color) 0%, transparent 50%),
                radial-gradient(circle at 40% 40%, var(--accent-color) 0%, transparent 50%);
            animation: backgroundShift 20s ease-in-out infinite;
        }

        @keyframes backgroundShift {
            0%, 100% {
                transform: scale(1) rotate(0deg);
            }
            50% {
                transform: scale(1.1) rotate(1deg);
            }
        }

        .content-wrapper {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 24px;
            max-width: 520px;
            margin: 0 auto;
        }

        .slide-card {
            background: var(--card-background);
            backdrop-filter: blur(18px) saturate(180%);
            -webkit-backdrop-filter: blur(18px) saturate(180%);
            border: 1.5px solid var(--card-border);
            border-radius: var(--border-radius);
            padding: 22px 22px 18px;
            text-align: center;
            max-width: 460px;
            width: 100%;
            box-shadow: 0 8px 32px rgba(127, 188, 251, 0.10), 0 1.5px 6px rgba(0,0,0,0.04);
            animation: slideInUp 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            position: relative;
            overflow: hidden;
            max-height: 66vh;
            overflow-y: auto;
        }

        /* Custom scrollbar styles for slide cards */
        .slide-card::-webkit-scrollbar {
            width: 8px;
        }

        .slide-card::-webkit-scrollbar-track {
            background: var(--button-background);
            border-radius: 4px;
            margin: 4px;
        }

        .slide-card::-webkit-scrollbar-thumb {
            background: var(--primary-color);
            border-radius: 4px;
            border: 1px solid var(--button-border);
        }

        .slide-card::-webkit-scrollbar-thumb:hover {
            background: var(--focus-border-color);
        }

        .slide-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--start-button-background);
            background-size: 200% 100%;
            animation: gradientShift 4s ease infinite;
        }

        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .slide-icon {
            width: 64px;
            height: 64px;
            margin: 8px auto 16px;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
            border: 1.5px solid rgba(255, 255, 255, 0.15);
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: var(--text-color);
            transition: all 0.3s ease;
            animation: iconGlow 3s ease-in-out infinite;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }

        .logo-icon {
            width: 36px;
            height: 36px;
            object-fit: contain;
            border-radius: 8px;
            filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.15));
            transition: transform 0.3s ease;
        }

        .slide-icon:hover .logo-icon {
            transform: scale(1.1);
        }

        @keyframes iconGlow {
            0%, 100% {
                box-shadow: 0 0 0 0 rgba(127, 188, 251, 0.3);
            }
            50% {
                box-shadow: 0 0 20px 0 rgba(127, 188, 251, 0.5);
            }
        }

        .slide-title {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 6px;
            color: var(--text-color);
            line-height: 1.2;
            letter-spacing: 0.5px;
        }

        .subtitle {
            font-size: 13px;
            color: var(--description-color);
            margin-bottom: 12px;
        }

        .slide-content {
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 16px;
            color: var(--description-color);
            font-weight: 400;
        }

        .divider {
            height: 1px;
            background: var(--border-color);
            margin: 10px 0 14px;
        }

        .context-textarea {
            width: 100%;
            height: 110px;
            padding: 16px;
            border: 1.5px solid var(--button-border);
            border-radius: var(--border-radius);
            background: var(--input-background);
            color: var(--text-color);
            font-size: 14px;
            font-family: inherit;
            resize: vertical;
            transition: all 0.3s ease;
            margin-bottom: 16px;
        }

        .context-textarea::placeholder {
            color: var(--placeholder-color);
            font-size: 16px;
        }

        .context-textarea:focus {
            outline: none;
            border-color: var(--focus-border-color);
            background: var(--input-focus-background);
            box-shadow: 0 0 0 3px var(--focus-box-shadow);
        }

        .context-section {
            width: 100%;
            margin-bottom: 24px;
        }

        .context-header {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            margin-bottom: 10px;
            gap: 4px;
        }

        .context-label {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color);
        }

        .context-optional {
            font-size: 13px;
            color: var(--description-color);
            font-style: italic;
        }

        .context-tips {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 10px;
            padding: 12px;
            background: var(--button-background);
            border: 1px solid var(--button-border);
            border-radius: var(--border-radius);
        }

        .tip-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--description-color);
        }

        .tip-icon {
            font-size: 14px;
            width: 20px;
            text-align: center;
        }

        .feature-list {
            display: grid;
            gap: 8px;
            margin-top: 10px;
        }

        .feature-item {
            display: flex;
            align-items: center;
            padding: 10px 12px;
            background: var(--button-background);
            border: 1px solid var(--button-border);
            border-radius: var(--border-radius);
            font-size: 14px;
            color: var(--text-color);
            transition: all 0.3s ease;
        }

        .feature-item:hover {
            background: var(--hover-background);
            border-color: var(--focus-border-color);
            transform: translateX(5px);
        }

        .feature-icon {
            font-size: 18px;
            margin-right: 12px;
            width: 22px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--key-background);
            border: 1px solid var(--key-border);
            border-radius: 8px;
            color: var(--primary-color);
        }

        .actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 12px;
        }

        .primary-button {
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
            width: 100%;
            justify-content: center;
        }

        .primary-button:hover {
            background: var(--hover-background);
            border-color: var(--accent-color);
            transform: translateY(-2px);
        }

        .primary-button:active {
            transform: translateY(0);
        }

        .link-button {
            background: var(--button-background);
            border: 1.5px solid var(--button-border);
            color: var(--text-color);
            padding: 10px 20px;
            border-radius: var(--border-radius);
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            width: 100%;
        }

        .link-button:hover {
            background: var(--hover-background);
            border-color: var(--focus-border-color);
            transform: translateY(-2px);
        }

        .context-toggle {
            font-size: 13px;
            color: var(--link-color);
            cursor: pointer;
            user-select: none;
            margin: 2px 0 8px;
        }

        .context-toggle:hover {
            color: var(--link-hover-color);
            text-decoration: underline;
        }
        
    `;

    static properties = {
        contextText: { type: String },
        onComplete: { type: Function },
        onClose: { type: Function },
        _showContext: { type: Boolean, state: true },
    };

    constructor() {
        super();
        this.contextText = '';
        this.onComplete = () => { };
        this.onClose = () => { };
        this._showContext = false;
    }

    handleContextInput(e) {
        this.contextText = e.target.value;
    }

    completeOnboarding() {
        if (this.contextText.trim()) {
            localStorage.setItem('customPrompt', this.contextText.trim());
        }
        localStorage.setItem('onboardingCompleted', 'true');
        this.onComplete();
    }

    render() {
        return html`
            <div class="onboarding-container">
                <!-- Subtle background pattern -->
                <div class="background-pattern"></div>

                <div class="content-wrapper">
                    <div class="slide-card">
                        <div class="slide-icon">
                            <img src="assets/logo.jpg" alt="Interview Cracker AI Logo" class="logo-icon">
                        </div>
                        <div class="slide-title">Welcome to Interview Cracker AI</div>
                        <div class="subtitle">Smart, private, real-time assistance during interviews and meetings</div>

                        <!-- Commented out other sections for single card design -->
                        <!-- <div class="divider"></div>

                        <div class="slide-icon">🔒</div>
                        <div class="slide-title">100% Private & Secure</div>
                        <div class="slide-content">Completely invisible to screen sharing and recording software. Your secret advantage stays hidden from everyone.</div>

                        <div class="divider"></div>

                        <div class="slide-icon">📝</div>
                        <div class="slide-title">Add Your Context</div>
                        <div class="slide-content context-toggle" @click=${() => (this._showContext = !this._showContext)}>
                            ${this._showContext ? 'Hide details ▲' : 'Add optional details ▼'}
                        </div>
                        ${this._showContext ? html`<div class="context-section">
                            <div class="context-header">
                                <span class="context-label">📋 What would you like to share?</span>
                            </div>
                            <textarea
                                class="context-textarea"
                                placeholder="Share your resume, job description, or any relevant information to help the AI provide better assistance..."
                                .value=${this.contextText}
                                @input=${this.handleContextInput}
                            ></textarea>
                            <div class="context-tips">
                                <div class="tip-item"><span class="tip-icon">💡</span>Include role, stack, and any specific areas you want help with</div>
                                <div class="tip-item"><span class="tip-icon">📎</span>You can always change this later from Customize</div>
                            </div>
                        </div>` : ''}

                        <div class="divider"></div>

                        <div class="slide-icon">⚡</div>
                        <div class="slide-title">Powerful Features</div>
                        <div class="slide-content">Explore advanced customization options and tools to enhance your interview experience.</div>
                        <div class="feature-list">
                            <div class="feature-item">
                                <div class="feature-icon">🎨</div>
                                <span>Customize AI behavior and responses</span>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">📚</div>
                                <span>Review conversation history</span>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">🔧</div>
                                <span>Adjust capture settings and intervals</span>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">⚙️</div>
                                <span>Advanced mode for power users</span>
                            </div>
                        </div>

                        <div class="divider"></div>

                        <div class="slide-icon">🎯</div>
                        <div class="slide-title">Ready to Ace Your Interview!</div>
                        <div class="slide-content">You're all set! Start your session and let our AI assistant help you succeed. Good luck!</div>

                        <div class="actions">
                            <button class="link-button" @click=${() => (this._showContext = true)}>Add context</button>
                            <button class="primary-button" @click=${this.completeOnboarding}>Get Started</button>
                        </div> -->

                        <div class="actions">
                            <button class="primary-button" @click=${this.completeOnboarding}>Get Started</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('onboarding-view', OnboardingView);
