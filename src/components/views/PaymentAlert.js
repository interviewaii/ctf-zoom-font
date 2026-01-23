import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { getDeviceIdForDisplay } from '../../utils/deviceId.js';

export class PaymentAlert extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', sans-serif;
            box-sizing: border-box;
        }

        input {
            user-select: text !important;
            -webkit-user-select: text !important;
            cursor: text !important;
        }

        :host {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }

        .overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            animation: overlayFadeIn 0.2s ease-out;
        }

        @keyframes overlayFadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }

        .alert-container {
            position: relative;
            background: linear-gradient(135deg, 
                rgba(25, 20, 50, 0.95) 0%, 
                rgba(20, 15, 40, 0.98) 100%);
            backdrop-filter: blur(30px) saturate(180%);
            -webkit-backdrop-filter: blur(30px) saturate(180%);
            border: 2px solid rgba(0, 200, 255, 0.6);
            border-radius: 12px;
            padding: 20px 18px 16px 18px;
            max-width: 360px;
            width: 100%;
            max-height: 85vh;
            overflow-y: auto;
            margin: auto;
            box-shadow: 
                0 25px 70px rgba(0, 200, 255, 0.5),
                0 10px 40px rgba(0, 0, 0, 0.8),
                0 0 0 1px rgba(0, 200, 255, 0.4),
                inset 0 1px 0 rgba(0, 200, 255, 0.25);
            animation: popupSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            transform-origin: center;
        }

        /* Custom scrollbar */
        .alert-container::-webkit-scrollbar {
            width: 8px;
        }

        .alert-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
        }

        .alert-container::-webkit-scrollbar-thumb {
            background: rgba(102, 126, 234, 0.5);
            border-radius: 10px;
        }

        .alert-container::-webkit-scrollbar-thumb:hover {
            background: rgba(102, 126, 234, 0.7);
        }

        @keyframes popupSlideIn {
            from {
                opacity: 0;
                transform: scale(0.95) translateY(10px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }

        .icon-container {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, rgba(0, 200, 255, 0.2), rgba(0, 100, 255, 0.1));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 12px auto;
            box-shadow: 0 0 20px rgba(0, 200, 255, 0.3);
            border: 1px solid rgba(0, 200, 255, 0.3);
        }

        .icon-container svg {
            width: 24px;
            height: 24px;
            fill: #00c8ff;
            filter: drop-shadow(0 0 5px rgba(0, 200, 255, 0.8));
        }

        .title {
            color: #ffffff;
            font-size: 20px;
            font-weight: 700;
            margin: 0 0 6px 0;
            text-align: center;
            letter-spacing: -0.02em;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        }

        .subtitle {
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            margin: 0 0 16px 0;
            text-align: center;
            line-height: 1.4;
        }

        .payment-info {
            background: rgba(255, 255, 255, 0.03);
            border-radius: 10px;
            padding: 12px;
            margin-bottom: 16px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .payment-row {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .payment-row:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
        }

        .payment-icon {
            width: 28px;
            height: 28px;
            background: rgba(102, 126, 234, 0.1);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 10px;
            flex-shrink: 0;
        }

        .payment-icon svg {
            width: 14px;
            height: 14px;
            stroke: #667eea;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
        }

        .payment-details {
            flex: 1;
        }

        .payment-label {
            color: rgba(255, 255, 255, 0.9);
            font-size: 13px;
            font-weight: 500;
        }

        .payment-value {
            color: rgba(255, 255, 255, 0.6);
            font-size: 11px;
        }

        .input-container {
            margin-bottom: 16px;
        }

        .input-label {
            display: block;
            color: rgba(255, 255, 255, 0.8);
            font-size: 12px;
            margin-bottom: 6px;
            font-weight: 500;
        }

        .activation-input {
            width: 100%;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 10px 12px;
            color: #fff;
            font-size: 14px;
            font-family: 'Monaco', 'Consolas', monospace;
            transition: all 0.2s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .activation-input:focus {
            outline: none;
            border-color: #667eea;
            background: rgba(0, 0, 0, 0.4);
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
        }

        .activation-input::placeholder {
            color: rgba(255, 255, 255, 0.3);
            text-transform: none;
            letter-spacing: normal;
        }

        .button-group {
            display: flex;
            gap: 10px;
        }

        .button {
            flex: 1;
            padding: 10px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        .button-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .button-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
        }

        .button-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .button-secondary:hover {
            background: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.2);
        }

        .button-whatsapp {
            background: #25D366;
            color: white;
        }
        
        .button-whatsapp:hover {
            background: #20bd5a;
        }

        .button-gmail {
            background: #EA4335;
            color: white;
        }
        
        .button-gmail:hover {
            background: #d33828;
        }

        .button-small {
            padding: 8px 12px;
            font-size: 12px;
        }

        .close-button {
            position: absolute;
            top: 12px;
            right: 12px;
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            font-size: 20px;
            cursor: pointer;
            padding: 4px;
            line-height: 1;
            border-radius: 4px;
            transition: all 0.2s ease;
            z-index: 10;
        }

        .close-button:hover {
            color: white;
            background: rgba(255, 255, 255, 0.1);
        }

        .error-message {
            color: #ff6b6b;
            font-size: 12px;
            margin-top: 6px;
            display: flex;
            align-items: center;
            gap: 4px;
            animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }

        @keyframes shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
            40%, 60% { transform: translate3d(4px, 0, 0); }
        }

        .success-message {
            color: #51cf66;
            font-size: 12px;
            margin-top: 6px;
            display: flex;
            align-items: center;
            gap: 4px;
            animation: successPulse 0.5s ease-out;
        }

        @keyframes successPulse {
            0% { transform: scale(0.8); opacity: 0; }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); opacity: 1; }
        }

        .copy-button {
            background: rgba(102, 126, 234, 0.2);
            border: 1px solid rgba(102, 126, 234, 0.3);
            color: #667eea;
            padding: 4px 12px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-left: 8px;
        }

        .copy-button:hover {
            background: rgba(102, 126, 234, 0.3);
            border-color: rgba(102, 126, 234, 0.5);
            transform: translateY(-1px);
        }

        .copy-button svg {
            width: 12px;
            height: 12px;
        }

        .copy-success {
            color: #51cf66;
            font-size: 12px;
            margin-left: 8px;
            animation: fadeInCopy 0.3s ease;
        }

        @keyframes fadeInCopy {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;

    static properties = {
        onClose: { type: Function },
        onActivate: { type: Function },
        onPayNow: { type: Function },
        activationCode: { type: String },
        errorMessage: { type: String },
        successMessage: { type: String },
        deviceId: { type: String },
        copySuccess: { type: Boolean },
    };

    constructor() {
        super();
        this.onClose = () => { };
        this.onActivate = () => { };
        this.onPayNow = () => { };
        this.activationCode = '';
        this.errorMessage = '';
        this.successMessage = '';
        this.deviceId = '';
        this.copySuccess = false;
        this.loadDeviceId();
    }

    async loadDeviceId() {
        this.deviceId = await getDeviceIdForDisplay();
        this.requestUpdate();
    }

    handleInputChange(e) {
        this.activationCode = e.target.value.toUpperCase();
        this.errorMessage = '';
        this.successMessage = '';
    }

    handleActivateClick() {
        if (!this.activationCode.trim()) {
            this.errorMessage = 'Please enter an activation code';
            return;
        }

        // Clear previous messages
        this.errorMessage = '';
        this.successMessage = '';

        // Call the parent's activation handler which will validate the license key
        // The parent (InterviewCrackerApp) will handle the actual validation
        this.onActivate(this.activationCode.trim());
    }

    handleKeyDown(e) {
        // Allow copy/paste shortcuts
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'a')) {
            e.stopPropagation();
        }
        if (e.key === 'Enter') {
            this.handleActivateClick();
        }
    }

    handleOverlayClick(e) {
        if (e.target === e.currentTarget) {
            this.onClose();
        }
    }

    handlePaste(e) {
        // Ensure paste works by stopping propagation of any blocking events
        e.stopPropagation();
    }

    async handleCopyDeviceId() {
        try {
            await navigator.clipboard.writeText(this.deviceId);
            this.copySuccess = true;
            this.requestUpdate();
            setTimeout(() => {
                this.copySuccess = false;
                this.requestUpdate();
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }

    handleCloseClick(e) {
        e.stopPropagation();
        e.preventDefault();
        console.log('Close button clicked');
        this.onClose();
    }

    handleOpenGmail() {
        const recipients = 'interviewcrackertips@gmail.com';
        const subject = encodeURIComponent(`License Activation Request - Device: ${this.deviceId}`);
        const body = encodeURIComponent(`I have made the payment.

Device ID: ${this.deviceId}
Plan: (Please specify Weekly/Monthly/Daily)
Transaction ID: (Please enter your UPI Ref/Transaction ID here)

Please send me the activation key.`);

        const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipients}&su=${subject}&body=${body}`;

        // Open in default browser
        if (window.require) {
            const { shell } = window.require('electron');
            shell.openExternal(gmailLink);
        } else {
            window.open(gmailLink, '_blank');
        }
    }

    handleOpenWhatsApp() {
        const phoneNumber = '919420700711';
        const message = encodeURIComponent(`I have made the payment.

Device ID: ${this.deviceId}
Plan: (Please specify Weekly/Monthly/Daily)
Transaction ID: (Please enter your UPI Ref/Transaction ID here)

Please send me the activation key.`);

        const whatsappLink = `https://wa.me/${phoneNumber}?text=${message}`;

        // Open in default browser
        if (window.require) {
            const { shell } = window.require('electron');
            shell.openExternal(whatsappLink);
        } else {
            window.open(whatsappLink, '_blank');
        }
    }

    render() {
        return html`
            <div class="overlay" @click=${this.handleOverlayClick}>
                <div class="alert-container">
                    <button class="close-button" @click=${this.handleCloseClick}>×</button>
                    
                    <div class="icon-container">
                        <svg viewBox="0 0 24 24">
                            <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"/>
                        </svg>
                    </div>

                    <h2 class="title">Upgrade to Pro</h2>
                    <p class="subtitle">
                        ${this.deviceId ? html`<strong style="color: #667eea; font-size: 16px;">Your Device ID: ${this.deviceId}
                        <button class="copy-button" @click=${this.handleCopyDeviceId}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copy
                        </button>
                        ${this.copySuccess ? html`<span class="copy-success">✓ Copied!</span>` : ''}
                        </strong>` : ''}
                    </p>

                    
                    <div style="text-align: center; margin: 6px 0; background: white; padding: 4px; border-radius: 8px; overflow: hidden;">
                        <img src="./assets/payment-qr.jpg?v=${Date.now()}" alt="Payment QR Code" style="width: 100%; max-width: 150px; height: auto; display: block; margin: 0 auto;">
                        <div style="color: #333; font-size: 10px; margin-top: 2px; font-weight: 600; padding-bottom: 2px;">Scan to Pay via UPI</div>
                    </div>

                    <div class="payment-info" style="margin-bottom: 4px; padding: 6px;">
                        <div class="payment-row">
                            <div class="payment-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                                </svg>
                            </div>
                            <div class="payment-details">
                                <div class="payment-label">📅 Weekly Plan</div>
                            </div>
                        </div>

                        <div class="payment-row">
                            <div class="payment-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                                </svg>
                            </div>
                            <div class="payment-details">
                                <div class="payment-label">📆 Monthly Plan</div>
                            </div>
                        </div>

                        <div class="payment-row">
                            <div class="payment-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                                </svg>
                            </div>
                            <div class="payment-details">
                                <div class="payment-label">⚡ Daily Plan</div>
                            </div>
                        </div>
                    </div>


                    <div class="input-container" style="margin-bottom: 4px;">
                        <label class="input-label">Enter your license key:</label>
                        <input
                            type="text"
                            class="activation-input"
                            placeholder="e.g., WEEK-A3F7B2C1-X9K2"
                            .value=${this.activationCode}
                            @input=${this.handleInputChange}
                            @keydown=${this.handleKeyDown}
                            @paste=${this.handlePaste}
                        />
                        <small style="opacity: 0.7; font-size: 11px; margin-top: 4px; display: block;">
                            📧 Send your Device ID to get a license key<br>
                            💳 Or pay via UPI and contact us for activation
                        </small>
                        ${this.errorMessage ? html`<div class="error-message">${this.errorMessage}</div>` : ''}
                        ${this.successMessage ? html`<div class="success-message">${this.successMessage}</div>` : ''}
                    </div>

                    <div class="button-group" style="flex-direction: column; gap: 5px;">
                        <button class="button button-primary" style="width: 100%; padding: 12px; font-size: 13px;" @click=${this.handleActivateClick}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            Activate License
                        </button>
                        
                        <div style="display: flex; gap: 8px;">
                            <button class="button button-whatsapp button-small" @click=${this.handleOpenWhatsApp}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                </svg>
                                WhatsApp
                            </button>
                            <button class="button button-gmail button-small" @click=${this.handleOpenGmail}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                                Email
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('payment-alert', PaymentAlert);
