// Authentication Utilities and Helpers
// This file contains common authentication functions used across auth pages

class AuthManager {
    constructor() {
        this.client = window.supabaseClient;
        this.currentForm = null;
        this.isProcessing = false;
        
        this.init();
    }

    async init() {
        try {
            // Wait for Supabase to be initialized
            await this.client.waitForInit();
            
            this.setupFormValidation();
            this.setupErrorHandling();
            this.checkAuthRedirect();
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.showError('Failed to initialize authentication. Please refresh the page.');
        }
    }

    // Check if user is already authenticated and redirect
    checkAuthRedirect() {
        // Only redirect if we're on auth pages and user is already logged in
        const authPages = ['/pages/login.html', '/pages/register.html'];
        const currentPath = window.location.pathname;
        
        if (authPages.includes(currentPath) && this.client.isAuthenticated()) {
            this.client.redirectToDashboardIfNeeded();
        }
    }

    // Form validation setup
    setupFormValidation() {
        // Password strength validation
        this.passwordRules = {
            minLength: 8,
            requireNumbers: true,
            requireLetters: true,
            requireSpecialChars: false
        };

        // Email validation regex
        this.emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    }

    // Error handling setup
    setupErrorHandling() {
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showError('An unexpected error occurred. Please try again.');
        });
    }

    // Validate email format
    validateEmail(email) {
        return this.emailRegex.test(email);
    }

    // Validate password strength
    validatePassword(password) {
        const errors = [];

        if (password.length < this.passwordRules.minLength) {
            errors.push(`Password must be at least ${this.passwordRules.minLength} characters long`);
        }

        if (this.passwordRules.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (this.passwordRules.requireLetters && !/[a-zA-Z]/.test(password)) {
            errors.push('Password must contain at least one letter');
        }

        if (this.passwordRules.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Validate passwords match
    validatePasswordMatch(password, confirmPassword) {
        return password === confirmPassword;
    }

    // Validate phone number (basic)
    validatePhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
    }

    // Show form errors
    showFieldError(fieldName, message) {
        const field = document.getElementById(fieldName);
        const formGroup = field?.closest('.form-group');
        
        if (!formGroup) return;

        // Remove existing error
        this.clearFieldError(fieldName);

        // Add error class
        formGroup.classList.add('error');

        // Add error message
        const errorElement = document.createElement('div');
        errorElement.className = 'form-error';
        errorElement.textContent = message;
        formGroup.appendChild(errorElement);

        // Focus the field
        field.focus();
    }

    // Clear field error
    clearFieldError(fieldName) {
        const field = document.getElementById(fieldName);
        const formGroup = field?.closest('.form-group');
        
        if (!formGroup) return;

        formGroup.classList.remove('error');
        const errorElement = formGroup.querySelector('.form-error');
        if (errorElement) {
            errorElement.remove();
        }
    }

    // Clear all form errors
    clearAllErrors() {
        const errorElements = document.querySelectorAll('.form-error');
        errorElements.forEach(error => error.remove());

        const errorGroups = document.querySelectorAll('.form-group.error');
        errorGroups.forEach(group => group.classList.remove('error'));

        // Clear alert messages
        const alerts = document.querySelectorAll('.alert');
        alerts.forEach(alert => alert.remove());
    }

    // Show general error message
    showError(message, container = null) {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(message, 'error');
            return;
        }
        const targetContainer = container || document.querySelector('.auth-form') || document.querySelector('.auth-card');
        if (!targetContainer) { alert(message); return; }
        const existingAlerts = targetContainer.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());
        const alertElement = document.createElement('div');
        alertElement.className = 'alert alert-error';
        alertElement.textContent = message;
        targetContainer.insertBefore(alertElement, targetContainer.firstChild);
        setTimeout(() => { alertElement.remove(); }, 5000);
    }

    // Show success message
    showSuccess(message, container = null) {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(message, 'success');
            return;
        }
        const targetContainer = container || document.querySelector('.auth-form') || document.querySelector('.auth-card');
        if (!targetContainer) { alert(message); return; }
        const existingAlerts = targetContainer.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());
        const alertElement = document.createElement('div');
        alertElement.className = 'alert alert-success';
        alertElement.textContent = message;
        targetContainer.insertBefore(alertElement, targetContainer.firstChild);
        setTimeout(() => { alertElement.remove(); }, 3000);
    }

    // Set form loading state
    setFormLoading(isLoading, formElement = null) {
        const form = formElement || this.currentForm || document.querySelector('form');
        
        if (!form) return;

        const submitButton = form.querySelector('button[type="submit"]');
        const inputs = form.querySelectorAll('input, select, textarea');

        if (isLoading) {
            this.isProcessing = true;
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Processing...';
            }
            inputs.forEach(input => input.disabled = true);
        } else {
            this.isProcessing = false;
            if (submitButton) {
                submitButton.disabled = false;
                // Restore original text based on form type
                if (form.id === 'loginForm') {
                    submitButton.textContent = 'Sign In';
                } else if (form.id === 'registerForm') {
                    submitButton.textContent = 'Create Account';
                } else if (form.id === 'forgotPasswordForm') {
                    submitButton.textContent = 'Send Reset Link';
                }
            }
            inputs.forEach(input => input.disabled = false);
        }
    }

    // Handle authentication errors with user-friendly messages
    handleAuthError(error) {
        console.error('Auth error:', error);

        let userMessage = 'An unexpected error occurred. Please try again.';

        if (error.message) {
            switch (error.message) {
                case 'Invalid login credentials':
                    userMessage = 'Invalid email or password. Please try again.';
                    break;
                case 'Email rate limit exceeded':
                    userMessage = 'Too many attempts. Please wait a few minutes before trying again.';
                    break;
                case 'User already registered':
                    userMessage = 'An account with this email already exists. Please sign in instead.';
                    break;
                case 'Password should be at least 6 characters':
                    userMessage = 'Password must be at least 6 characters long.';
                    break;
                case 'Unable to validate email address: invalid format':
                    userMessage = 'Please enter a valid email address.';
                    break;
                case 'Signup requires a valid password':
                    userMessage = 'Please enter a valid password.';
                    break;
                default:
                    userMessage = error.message;
            }
        }

        this.showError(userMessage);
    }

    // Utility to get URL parameters
    getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    // Utility to set URL parameters without reload
    setUrlParameter(name, value) {
        const url = new URL(window.location);
        if (value) {
            url.searchParams.set(name, value);
        } else {
            url.searchParams.delete(name);
        }
        window.history.replaceState({}, '', url);
    }

    // Sanitize input to prevent XSS
    sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    // Format phone number for display
    formatPhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return '(' + match[1] + ') ' + match[2] + '-' + match[3];
        }
        return phone;
    }

    // Check if device is mobile
    isMobile() {
        return window.innerWidth <= 768;
    }

    // Add real-time validation to form fields
    addRealTimeValidation(form) {
        const emailField = form.querySelector('#email');
        const passwordField = form.querySelector('#password');
        const confirmPasswordField = form.querySelector('#confirmPassword');
        const phoneField = form.querySelector('#phone');

        if (emailField) {
            emailField.addEventListener('blur', () => {
                if (emailField.value && !this.validateEmail(emailField.value)) {
                    this.showFieldError('email', 'Please enter a valid email address');
                } else {
                    this.clearFieldError('email');
                }
            });
        }

        if (passwordField) {
            passwordField.addEventListener('input', () => {
                if (passwordField.value) {
                    const validation = this.validatePassword(passwordField.value);
                    if (!validation.isValid) {
                        this.showFieldError('password', validation.errors[0]);
                    } else {
                        this.clearFieldError('password');
                    }
                }
            });
        }

        if (confirmPasswordField && passwordField) {
            confirmPasswordField.addEventListener('blur', () => {
                if (confirmPasswordField.value && !this.validatePasswordMatch(passwordField.value, confirmPasswordField.value)) {
                    this.showFieldError('confirmPassword', 'Passwords do not match');
                } else {
                    this.clearFieldError('confirmPassword');
                }
            });
        }

        if (phoneField) {
            phoneField.addEventListener('blur', () => {
                if (phoneField.value && !this.validatePhone(phoneField.value)) {
                    this.showFieldError('phone', 'Please enter a valid phone number');
                } else {
                    this.clearFieldError('phone');
                }
            });
        }
    }
}

// Global instance
window.authManager = new AuthManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}