class LoginManager {
    #authManager;
    #supabaseClient;

    constructor() {
        this.#authManager = window.authManager;
        this.#supabaseClient = window.supabaseClient;
        this.init();
    }

    async init() {
        try {
            await this.#supabaseClient.waitForInit();
            this.#setupLoginForm();
            this.#setupForgotPassword();
            this.#checkPasswordResetToken();
        } catch (error) {
            console.error('Login initialization failed:', error.message);
            this.#authManager.showError('Failed to initialize login. Please refresh the page.');
        }
    }

    #setupLoginForm() {
        const form = document.getElementById('loginForm');
        if (!form) return;

        this.#authManager.addRealTimeValidation(form);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.#handleLogin(form);
        });

        this.#loadRememberedEmail();
        this.#setupRememberMe();
    }

    async #handleLogin(form) {
        if (this.#authManager.isProcessing) return;

        try {
            this.#authManager.clearAllErrors();
            this.#authManager.setFormLoading(true, form);

            const formData = this.#validateLoginForm(form);
            if (!formData) {
                this.#authManager.setFormLoading(false, form);
                return;
            }

            const { user } = await this.#supabaseClient.signIn(formData.email, formData.password);

            if (user) {
                if (formData.rememberMe) {
                    localStorage.setItem('rememberedEmail', formData.email);
                } else {
                    localStorage.removeItem('rememberedEmail');
                }
            }
        } catch (error) {
            this.#authManager.handleAuthError(error);
        } finally {
            this.#authManager.setFormLoading(false, form);
        }
    }

    #validateLoginForm(form) {
        const data = {
            email: form.querySelector('#email')?.value?.trim(),
            password: form.querySelector('#password')?.value,
            rememberMe: form.querySelector('#rememberMe')?.checked
        };

        if (!data.email) {
            this.#authManager.showFieldError('email', 'Email is required');
            return null;
        }

        if (!this.#authManager.validateEmail(data.email)) {
            this.#authManager.showFieldError('email', 'Please enter a valid email address');
            return null;
        }

        if (!data.password) {
            this.#authManager.showFieldError('password', 'Password is required');
            return null;
        }

        return data;
    }

    #setupForgotPassword() {
        const forgotPasswordLink = document.querySelector('.forgot-password-link');
        const modal = document.getElementById('forgot-password-modal');
        const closeButton = modal?.querySelector('.modal-close');
        const form = document.getElementById('forgotPasswordForm');

        forgotPasswordLink?.addEventListener('click', (e) => {
            e.preventDefault();
            this.#showForgotPasswordModal();
        });

        closeButton?.addEventListener('click', () => {
            this.#hideForgotPasswordModal();
        });

        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.#hideForgotPasswordModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal?.style.display === 'flex') {
                this.#hideForgotPasswordModal();
            }
        });

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.#handleForgotPassword(form);
        });

        const emailField = form?.querySelector('#resetEmail');
        emailField?.addEventListener('blur', () => {
            const value = emailField.value.trim();
            if (value && !this.#authManager.validateEmail(value)) {
                this.#authManager.showFieldError('resetEmail', 'Please enter a valid email address');
            } else {
                this.#authManager.clearFieldError('resetEmail');
            }
        });
    }

    #showForgotPasswordModal() {
        const modal = document.getElementById('forgot-password-modal');
        if (!modal) return;

        modal.style.display = 'flex';

        const emailField = modal.querySelector('#resetEmail');
        if (emailField) {
            setTimeout(() => emailField.focus(), 100);
            const loginEmail = document.getElementById('email')?.value.trim();
            if (loginEmail) {
                emailField.value = loginEmail;
            }
        }
    }

    #hideForgotPasswordModal() {
        const modal = document.getElementById('forgot-password-modal');
        if (!modal) return;

        modal.style.display = 'none';

        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            this.#authManager.clearAllErrors();
        }
    }

    async #handleForgotPassword(form) {
        if (this.#authManager.isProcessing) return;

        try {
            this.#authManager.clearAllErrors();
            this.#authManager.setFormLoading(true, form);

            const email = form.querySelector('#resetEmail')?.value?.trim();

            if (!email) {
                this.#authManager.showFieldError('resetEmail', 'Email is required');
                return;
            }

            if (!this.#authManager.validateEmail(email)) {
                this.#authManager.showFieldError('resetEmail', 'Please enter a valid email address');
                return;
            }

            await this.#supabaseClient.resetPassword(email);

            this.#authManager.showSuccess(
                'Password reset link sent! Please check your email.',
                form
            );

            setTimeout(() => {
                this.#hideForgotPasswordModal();
            }, 2000);
        } catch (error) {
            this.#authManager.handleAuthError(error);
        } finally {
            this.#authManager.setFormLoading(false, form);
        }
    }

    #setupRememberMe() {
        const rememberCheckbox = document.getElementById('rememberMe');
        if (!rememberCheckbox) return;

        const savedPreference = localStorage.getItem('rememberMePreference');
        if (savedPreference === 'true') {
            rememberCheckbox.checked = true;
        }

        rememberCheckbox.addEventListener('change', () => {
            localStorage.setItem('rememberMePreference', rememberCheckbox.checked.toString());
        });
    }

    #loadRememberedEmail() {
        const emailField = document.getElementById('email');
        const rememberedEmail = localStorage.getItem('rememberedEmail');

        if (emailField && rememberedEmail) {
            emailField.value = rememberedEmail;
            const passwordField = document.getElementById('password');
            passwordField?.focus();
        }
    }

    #checkPasswordResetToken() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        if (error) {
            this.#authManager.showError(errorDescription || 'An error occurred during password reset');
            return;
        }

        const message = urlParams.get('message');
        if (message === 'password-updated') {
            this.#authManager.showSuccess('Password updated successfully! Please sign in with your new password.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LoginManager();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginManager;
}
