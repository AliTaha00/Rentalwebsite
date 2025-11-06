/**
 * Client-side Environment Validator
 * Validates environment configuration when the app loads
 * Include this script after env.js in your HTML files
 */

(function() {
  'use strict';

  const ENV_VALIDATOR = {
    /**
     * Check if required environment variables are set
     */
    validate() {
      const errors = [];
      const warnings = [];

      // Check if window.ENV exists
      if (typeof window.ENV === 'undefined') {
        errors.push('Environment configuration (window.ENV) is not defined');
        errors.push('Create assets/js/env.js from config.example.js');
        this.showError(errors);
        return false;
      }

      const env = window.ENV;

      // Required variables
      const required = {
        SUPABASE_URL: {
          test: (val) => val && val.startsWith('https://') && val.includes('supabase.co'),
          error: 'Invalid Supabase URL. Expected format: https://xxxxx.supabase.co'
        },
        SUPABASE_ANON_KEY: {
          test: (val) => val && val.startsWith('eyJ') && val.length > 100,
          error: 'Invalid Supabase anonymous key. Should be a JWT token starting with eyJ'
        },
        GOOGLE_MAPS_API_KEY: {
          test: (val) => val && (val.startsWith('AIza') || val.length > 30),
          error: 'Invalid Google Maps API key. Expected format: AIzaSyXXXXXXXXXXXX'
        }
      };

      // Check required variables
      Object.entries(required).forEach(([key, config]) => {
        const value = env[key];

        if (!value || value.trim() === '') {
          errors.push(`Missing required environment variable: ${key}`);
        } else if (this.isPlaceholder(value)) {
          errors.push(`${key} contains placeholder value. Replace with actual credentials.`);
        } else if (!config.test(value)) {
          warnings.push(`${key}: ${config.error}`);
        }
      });

      // Check optional but recommended variables
      if (!env.SENTRY_DSN) {
        warnings.push('SENTRY_DSN not configured - Error monitoring disabled');
      }

      // Stripe is not used

      // Display results
      if (errors.length > 0) {
        this.showError(errors);
        return false;
      }

      if (warnings.length > 0) {
        this.showWarnings(warnings);
      }

      // Store validation timestamp
      sessionStorage.setItem('env_validated', new Date().toISOString());

      return true;
    },

    /**
     * Check if value is a placeholder
     */
    isPlaceholder(value) {
      const placeholders = [
        'your-',
        'xxxxx',
        'example',
        'test-key',
        'placeholder',
        'your_',
        'INSERT_',
        'REPLACE_'
      ];
      const lowerValue = value.toLowerCase();
      return placeholders.some(p => lowerValue.includes(p));
    },

    /**
     * Show error overlay
     */
    showError(errors) {
      console.error('❌ Environment Configuration Errors:', errors);

      // Only show overlay in development
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const overlay = this.createOverlay(
          'Environment Configuration Error',
          errors,
          'error'
        );
        document.body.appendChild(overlay);
      } else {
        // In production, just log to console and show generic error
        alert('Application configuration error. Please contact support.');
      }
    },

    /**
     * Show warning overlay (dev only)
     */
    showWarnings(warnings) {
      console.warn('⚠️ Environment Configuration Warnings:', warnings);

      // Only show in development
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const overlay = this.createOverlay(
          'Environment Configuration Warnings',
          warnings,
          'warning'
        );
        document.body.appendChild(overlay);

        // Auto-hide warnings after 10 seconds
        setTimeout(() => {
          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), 300);
        }, 10000);
      }
    },

    /**
     * Create error/warning overlay
     */
    createOverlay(title, messages, type) {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 500px;
        background: ${type === 'error' ? '#fee' : '#ffc'};
        border: 2px solid ${type === 'error' ? '#c33' : '#fa0'};
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        transition: opacity 0.3s;
      `;

      const titleEl = document.createElement('h3');
      titleEl.textContent = `${type === 'error' ? '❌' : '⚠️'} ${title}`;
      titleEl.style.cssText = `
        margin: 0 0 15px 0;
        color: ${type === 'error' ? '#c33' : '#c80'};
        font-size: 18px;
      `;
      overlay.appendChild(titleEl);

      const list = document.createElement('ul');
      list.style.cssText = `
        margin: 0;
        padding-left: 20px;
        color: #333;
      `;

      messages.forEach(msg => {
        const item = document.createElement('li');
        item.textContent = msg;
        item.style.marginBottom = '8px';
        list.appendChild(item);
      });

      overlay.appendChild(list);

      // Add instructions
      const instructions = document.createElement('p');
      instructions.style.cssText = `
        margin: 15px 0 0 0;
        padding-top: 15px;
        border-top: 1px solid ${type === 'error' ? '#c99' : '#fc6'};
        font-size: 14px;
        color: #666;
      `;
      instructions.innerHTML = `
        <strong>Fix:</strong><br>
        1. Copy <code>config.example.js</code> to <code>assets/js/env.js</code><br>
        2. Replace placeholder values with actual credentials<br>
        3. See <code>CONFIG_SETUP.md</code> for details
      `;
      overlay.appendChild(instructions);

      // Add close button
      if (type === 'warning') {
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Dismiss';
        closeBtn.style.cssText = `
          margin-top: 15px;
          padding: 8px 16px;
          background: #666;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        `;
        closeBtn.onclick = () => {
          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), 300);
        };
        overlay.appendChild(closeBtn);
      }

      return overlay;
    },

    /**
     * Initialize validator
     */
    init() {
      // Don't validate on every page load in production
      const lastValidated = sessionStorage.getItem('env_validated');
      if (lastValidated) {
        const timeSinceValidation = Date.now() - new Date(lastValidated).getTime();
        // Re-validate every 30 minutes
        if (timeSinceValidation < 30 * 60 * 1000) {
          return true;
        }
      }

      return this.validate();
    }
  };

  // Auto-run validation when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ENV_VALIDATOR.init();
    });
  } else {
    ENV_VALIDATOR.init();
  }

  // Expose validator globally for manual checks
  window.ENV_VALIDATOR = ENV_VALIDATOR;

})();
