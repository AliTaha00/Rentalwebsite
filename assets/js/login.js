// Login Page JavaScript
// Handles user authentication and forgot password functionality

class LoginManager {
    constructor() {
        this.authManager = window.authManager;
        this.supabaseClient = window.supabaseClient;
        
        this.init();
    }

    async init() {
        try {
            // Wait for Supabase to be initialized
            await this.supabaseClient.waitForInit();
            
            this.setupLoginForm();
            this.setupForgotPassword();
            this.setupSocialLogin();
            this.handleRememberMe();
        } catch (error) {
            console.error('Login initialization error:', error);
            this.authManager.showError('Failed to initialize login. Please refresh the page.');
        }
    }

    // Setup login form
    setupLoginForm() {
        const form = document.getElementById('loginForm');
        if (!form) return;

        // Add real-time validation
        this.authManager.addRealTimeValidation(form);

        // Handle form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin(form);
        });

        // Auto-fill remembered email
        this.loadRememberedEmail();
    }

    // Handle login
    async handleLogin(form) {
        if (this.authManager.isProcessing) return;

        try {
            // Clear previous errors
            this.authManager.clearAllErrors();
            
            // Set loading state
            this.authManager.setFormLoading(true, form);

            // Validate form
            const formData = this.validateLoginForm(form);
            if (!formData) {
                this.authManager.setFormLoading(false, form);
                return;
            }

            // Attempt sign in
            const { user, session } = await this.supabaseClient.signIn(formData.email, formData.password);

            if (user) {
                // Handle remember me
                if (formData.rememberMe) {
                    localStorage.setItem('rememberedEmail', formData.email);
                } else {
                    localStorage.removeItem('rememberedEmail');
                }

                // Success - Supabase client will handle redirect
                console.log('Login successful');
            }

        } catch (error) {
            console.error('Login error:', error);
            this.authManager.handleAuthError(error);
        } finally {
            this.authManager.setFormLoading(false, form);
        }
    }

    // Validate login form
    validateLoginForm(form) {
        // Use direct DOM access instead of FormData for more reliable field capture
        const data = {
            email: form.querySelector('#email')?.value?.trim(),
            password: form.querySelector('#password')?.value,
            rememberMe: form.querySelector('#rememberMe')?.checked
        };

        // Validate required fields
        if (!data.email) {
            this.authManager.showFieldError('email', 'Email is required');
            return null;
        }

        if (!this.authManager.validateEmail(data.email)) {
            this.authManager.showFieldError('email', 'Please enter a valid email address');
            return null;
        }

        if (!data.password) {
            this.authManager.showFieldError('password', 'Password is required');
            return null;
        }

        return data;
    }

    // Setup forgot password functionality
    setupForgotPassword() {
        const forgotPasswordLink = document.querySelector('.forgot-password-link');
        const modal = document.getElementById('forgot-password-modal');
        const closeButton = modal?.querySelector('.modal-close');
        const form = document.getElementById('forgotPasswordForm');

        // Show modal
        if (forgotPasswordLink && modal) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showForgotPasswordModal();
            });
        }

        // Close modal
        if (closeButton && modal) {
            closeButton.addEventListener('click', () => {
                this.hideForgotPasswordModal();
            });

            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideForgotPasswordModal();
                }
            });
        }

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal?.style.display === 'flex') {
                this.hideForgotPasswordModal();
            }
        });

        // Handle form submission
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleForgotPassword(form);
            });

            // Add email validation
            const emailField = form.querySelector('#resetEmail');
            if (emailField) {
                emailField.addEventListener('blur', () => {
                    if (emailField.value && !this.authManager.validateEmail(emailField.value)) {
                        this.authManager.showFieldError('resetEmail', 'Please enter a valid email address');
                    } else {
                        this.authManager.clearFieldError('resetEmail');
                    }
                });
            }
        }
    }

    // Show forgot password modal
    showForgotPasswordModal() {
        const modal = document.getElementById('forgot-password-modal');
        if (!modal) return;

        modal.style.display = 'flex';
        
        // Focus email field
        const emailField = modal.querySelector('#resetEmail');
        if (emailField) {
            setTimeout(() => emailField.focus(), 100);
        }

        // Pre-fill with login email if available
        const loginEmail = document.getElementById('email')?.value;
        if (loginEmail && emailField) {
            emailField.value = loginEmail;
        }
    }

    // Hide forgot password modal
    hideForgotPasswordModal() {
        const modal = document.getElementById('forgot-password-modal');
        if (!modal) return;

        modal.style.display = 'none';
        
        // Clear form
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            this.authManager.clearAllErrors();
        }
    }

    // Handle forgot password
    async handleForgotPassword(form) {
        if (this.authManager.isProcessing) return;

        try {
            // Clear previous errors
            this.authManager.clearAllErrors();
            
            // Set loading state
            this.authManager.setFormLoading(true, form);

            // Validate email
            const formData = new FormData(form);
            const email = formData.get('resetEmail')?.trim();

            if (!email) {
                this.authManager.showFieldError('resetEmail', 'Email is required');
                return;
            }

            if (!this.authManager.validateEmail(email)) {
                this.authManager.showFieldError('resetEmail', 'Please enter a valid email address');
                return;
            }

            // Send reset email
            await this.supabaseClient.resetPassword(email);

            // Show success message
            this.authManager.showSuccess(
                'Password reset link sent! Please check your email and follow the instructions.',
                form
            );

            // Close modal after delay
            setTimeout(() => {
                this.hideForgotPasswordModal();
            }, 2000);

        } catch (error) {
            console.error('Password reset error:', error);
            this.authManager.handleAuthError(error);
        } finally {
            this.authManager.setFormLoading(false, form);
        }
    }

    // Setup social login (placeholder for future implementation)
    setupSocialLogin() {
        const googleButton = document.querySelector('.google-btn');
        
        if (googleButton) {
            googleButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSocialLogin('google');
            });
        }
    }

    // Handle social login (placeholder)
    async handleSocialLogin(provider) {
        try {
            this.authManager.showError('Social login will be available soon!');
            
            // TODO: Implement social login with Supabase
            // const { data, error } = await this.supabaseClient.supabase.auth.signInWithOAuth({
            //     provider: provider,
            //     options: {
            //         redirectTo: `${window.location.origin}/pages/dashboard.html`
            //     }
            // });
        } catch (error) {
            console.error('Social login error:', error);
            this.authManager.handleAuthError(error);
        }
    }

    // Handle remember me functionality
    handleRememberMe() {
        const rememberCheckbox = document.getElementById('rememberMe');
        
        if (rememberCheckbox) {
            // Load saved preference
            const savedPreference = localStorage.getItem('rememberMePreference');
            if (savedPreference === 'true') {
                rememberCheckbox.checked = true;
            }

            // Save preference when changed
            rememberCheckbox.addEventListener('change', () => {
                localStorage.setItem('rememberMePreference', rememberCheckbox.checked);
            });
        }
    }

    // Load remembered email
    loadRememberedEmail() {
        const emailField = document.getElementById('email');
        const rememberedEmail = localStorage.getItem('rememberedEmail');
        
        if (emailField && rememberedEmail) {
            emailField.value = rememberedEmail;
            
            // Focus password field instead
            const passwordField = document.getElementById('password');
            if (passwordField) {
                passwordField.focus();
            }
        }
    }

    // Utility: Check for password reset token in URL
    checkPasswordResetToken() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        if (error) {
            this.authManager.showError(errorDescription || 'An error occurred during password reset');
            return;
        }

        // Check for successful reset (implementation depends on your reset flow)
        const message = urlParams.get('message');
        if (message === 'password-updated') {
            this.authManager.showSuccess('Password updated successfully! Please sign in with your new password.');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const loginManager = new LoginManager();
    
    // Check for password reset tokens
    loginManager.checkPasswordResetToken();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginManager;
}