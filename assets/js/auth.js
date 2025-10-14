class AuthManager {
    #client;
    #emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    #passwordRules = {
        minLength: 8,
        requireNumbers: true,
        requireLetters: true,
        requireSpecialChars: false
    };

    constructor() {
        this.#client = window.supabaseClient;
        this.currentForm = null;
        this.isProcessing = false;
        this.init();
    }

    async init() {
        try {
            await this.#client.waitForInit();
            this.#checkAuthRedirect();
        } catch (error) {
            console.error('Auth initialization failed:', error.message);
            this.showError('Authentication system unavailable. Please refresh the page.');
        }
    }

    #checkAuthRedirect() {
        const { pathname } = window.location;
        const isAuthPage = pathname.includes('login.html') || pathname.includes('register.html');

        if (isAuthPage && this.#client.isAuthenticated()) {
            const userType = this.#client.getCurrentUser()?.user_metadata?.account_type || 'renter';
            const dashboard = `${userType}-dashboard.html`;
            const isInPages = pathname.includes('/pages/');
            window.location.href = isInPages ? dashboard : `pages/${dashboard}`;
        }
    }

    validateEmail(email) {
        return this.#emailRegex.test(email);
    }

    validatePassword(password) {
        const errors = [];

        if (password.length < this.#passwordRules.minLength) {
            errors.push(`Password must be at least ${this.#passwordRules.minLength} characters long`);
        }

        if (this.#passwordRules.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (this.#passwordRules.requireLetters && !/[a-zA-Z]/.test(password)) {
            errors.push('Password must contain at least one letter');
        }

        if (this.#passwordRules.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    validatePasswordMatch(password, confirmPassword) {
        return password === confirmPassword;
    }

    validatePhone(phone) {
        const cleaned = phone.replace(/[\s\-\(\)]/g, '');
        return /^[\+]?[1-9][\d]{9,14}$/.test(cleaned);
    }

    showFieldError(fieldName, message) {
        const field = document.getElementById(fieldName);
        const formGroup = field?.closest('.form-group');

        if (!formGroup) return;

        this.clearFieldError(fieldName);
        formGroup.classList.add('error');

        const errorElement = document.createElement('div');
        errorElement.className = 'form-error';
        errorElement.textContent = message;
        formGroup.appendChild(errorElement);

        field.focus();
    }

    clearFieldError(fieldName) {
        const field = document.getElementById(fieldName);
        const formGroup = field?.closest('.form-group');

        if (!formGroup) return;

        formGroup.classList.remove('error');
        const errorElement = formGroup.querySelector('.form-error');
        errorElement?.remove();
    }

    clearAllErrors() {
        document.querySelectorAll('.form-error').forEach(el => el.remove());
        document.querySelectorAll('.form-group.error').forEach(el => el.classList.remove('error'));
        document.querySelectorAll('.alert').forEach(el => el.remove());
    }

    showError(message, container = null) {
        if (window.UI?.showToast) {
            window.UI.showToast(message, 'error');
            return;
        }

        const targetContainer = container || document.querySelector('.auth-form, .auth-card');
        if (!targetContainer) {
            alert(message);
            return;
        }

        targetContainer.querySelectorAll('.alert').forEach(el => el.remove());

        const alertElement = document.createElement('div');
        alertElement.className = 'alert alert-error';
        alertElement.setAttribute('role', 'alert');
        alertElement.textContent = message;
        targetContainer.insertBefore(alertElement, targetContainer.firstChild);

        setTimeout(() => alertElement.remove(), 5000);
    }

    showSuccess(message, container = null) {
        if (window.UI?.showToast) {
            window.UI.showToast(message, 'success');
            return;
        }

        const targetContainer = container || document.querySelector('.auth-form, .auth-card');
        if (!targetContainer) {
            alert(message);
            return;
        }

        targetContainer.querySelectorAll('.alert').forEach(el => el.remove());

        const alertElement = document.createElement('div');
        alertElement.className = 'alert alert-success';
        alertElement.setAttribute('role', 'status');
        alertElement.textContent = message;
        targetContainer.insertBefore(alertElement, targetContainer.firstChild);

        setTimeout(() => alertElement.remove(), 3000);
    }

    setFormLoading(isLoading, formElement = null) {
        const form = formElement || this.currentForm || document.querySelector('form');
        if (!form) return;

        const submitButton = form.querySelector('button[type="submit"]');
        const inputs = form.querySelectorAll('input, select, textarea');

        this.isProcessing = isLoading;

        if (submitButton) {
            submitButton.disabled = isLoading;
            if (isLoading) {
                submitButton.dataset.originalText = submitButton.textContent;
                submitButton.textContent = 'Processing...';
            } else {
                submitButton.textContent = submitButton.dataset.originalText || 'Submit';
            }
        }

        inputs.forEach(input => input.disabled = isLoading);
    }

    handleAuthError(error) {
        console.error('Auth error:', error.message);

        const errorMessages = {
            'Invalid login credentials': 'Invalid email or password. Please try again.',
            'Email rate limit exceeded': 'Too many attempts. Please wait before trying again.',
            'User already registered': 'An account with this email already exists.',
            'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
            'Unable to validate email address: invalid format': 'Please enter a valid email address.',
            'Signup requires a valid password': 'Please enter a valid password.'
        };

        const userMessage = errorMessages[error.message] || error.message || 'An unexpected error occurred.';
        this.showError(userMessage);
    }

    getUrlParameter(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    setUrlParameter(name, value) {
        const url = new URL(window.location);
        if (value) {
            url.searchParams.set(name, value);
        } else {
            url.searchParams.delete(name);
        }
        window.history.replaceState({}, '', url);
    }

    sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    addRealTimeValidation(form) {
        if (!form) return;

        const emailField = form.querySelector('#email');
        const passwordField = form.querySelector('#password');
        const confirmPasswordField = form.querySelector('#confirmPassword');
        const phoneField = form.querySelector('#phone');

        emailField?.addEventListener('blur', () => {
            const value = emailField.value.trim();
            if (value && !this.validateEmail(value)) {
                this.showFieldError('email', 'Please enter a valid email address');
            } else {
                this.clearFieldError('email');
            }
        });

        passwordField?.addEventListener('input', () => {
            const value = passwordField.value;
            if (value) {
                const validation = this.validatePassword(value);
                if (!validation.isValid) {
                    this.showFieldError('password', validation.errors[0]);
                } else {
                    this.clearFieldError('password');
                }
            }
        });

        if (confirmPasswordField && passwordField) {
            confirmPasswordField.addEventListener('blur', () => {
                const value = confirmPasswordField.value;
                if (value && !this.validatePasswordMatch(passwordField.value, value)) {
                    this.showFieldError('confirmPassword', 'Passwords do not match');
                } else {
                    this.clearFieldError('confirmPassword');
                }
            });
        }

        phoneField?.addEventListener('blur', () => {
            const value = phoneField.value.trim();
            if (value && !this.validatePhone(value)) {
                this.showFieldError('phone', 'Please enter a valid phone number');
            } else {
                this.clearFieldError('phone');
            }
        });
    }
}

window.authManager = new AuthManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
