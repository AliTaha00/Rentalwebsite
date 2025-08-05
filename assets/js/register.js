// Registration Page JavaScript
// Handles account type selection and user registration flow

class RegistrationManager {
    constructor() {
        this.authManager = window.authManager;
        this.supabaseClient = window.supabaseClient;
        this.selectedAccountType = null;
        
        this.init();
    }

    init() {
        this.setupAccountTypeSelection();
        this.setupRegistrationForm();
        this.handleUrlParameters();
    }

    // Setup account type selection
    setupAccountTypeSelection() {
        const typeSelection = document.getElementById('account-type-selection');
        const registrationForm = document.getElementById('registration-form');
        const selectButtons = document.querySelectorAll('.select-type-btn');
        const backButton = document.getElementById('back-to-selection');

        // Handle account type selection
        selectButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const accountType = button.getAttribute('data-type');
                this.selectAccountType(accountType);
            });
        });

        // Handle back button
        if (backButton) {
            backButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAccountTypeSelection();
            });
        }

        // Handle account type option hover/click for better UX
        const accountOptions = document.querySelectorAll('.account-type-option');
        accountOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                if (!e.target.classList.contains('select-type-btn')) {
                    const button = option.querySelector('.select-type-btn');
                    if (button) {
                        button.click();
                    }
                }
            });
        });
    }

    // Select account type and show registration form
    selectAccountType(accountType) {
        this.selectedAccountType = accountType;
        
        // Update URL parameter
        this.authManager.setUrlParameter('type', accountType);
        
        // Update form title and subtitle
        const formTitle = document.getElementById('form-title');
        const formSubtitle = document.getElementById('form-subtitle');
        const ownerFields = document.getElementById('owner-fields');
        const accountTypeField = document.getElementById('accountType');

        if (accountType === 'owner') {
            formTitle.textContent = 'Create Property Owner Account';
            formSubtitle.textContent = 'Start listing your beautiful properties';
            if (ownerFields) ownerFields.style.display = 'block';
        } else {
            formTitle.textContent = 'Create Renter Account';
            formSubtitle.textContent = 'Start discovering amazing views';
            if (ownerFields) ownerFields.style.display = 'none';
        }

        // Set hidden field value
        if (accountTypeField) {
            accountTypeField.value = accountType;
        }

        // Show registration form
        this.showRegistrationForm();
    }

    // Show account type selection
    showAccountTypeSelection() {
        const typeSelection = document.getElementById('account-type-selection');
        const registrationForm = document.getElementById('registration-form');

        if (typeSelection) typeSelection.style.display = 'block';
        if (registrationForm) registrationForm.style.display = 'none';

        // Clear URL parameter
        this.authManager.setUrlParameter('type', null);
        this.selectedAccountType = null;
    }

    // Show registration form
    showRegistrationForm() {
        const typeSelection = document.getElementById('account-type-selection');
        const registrationForm = document.getElementById('registration-form');

        if (typeSelection) typeSelection.style.display = 'none';
        if (registrationForm) registrationForm.style.display = 'block';

        // Focus first input
        const firstInput = registrationForm.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    // Handle URL parameters for direct linking
    handleUrlParameters() {
        const typeParam = this.authManager.getUrlParameter('type');
        if (typeParam && (typeParam === 'owner' || typeParam === 'renter')) {
            this.selectAccountType(typeParam);
        }
    }

    // Setup registration form
    setupRegistrationForm() {
        const form = document.getElementById('registerForm');
        if (!form) return;

        // Add real-time validation
        this.authManager.addRealTimeValidation(form);

        // Handle form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegistration(form);
        });

        // Add input formatting
        this.setupInputFormatting(form);
    }

    // Setup input formatting
    setupInputFormatting(form) {
        const phoneField = form.querySelector('#phone');
        
        if (phoneField) {
            phoneField.addEventListener('input', (e) => {
                // Format phone number as user types
                let value = e.target.value.replace(/\D/g, '');
                if (value.length >= 6) {
                    value = value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
                } else if (value.length >= 3) {
                    value = value.replace(/(\d{3})(\d{0,3})/, '($1) $2');
                }
                e.target.value = value;
            });
        }
    }

    // Handle registration
    async handleRegistration(form) {
        if (this.authManager.isProcessing) return;

        try {
            // Clear previous errors
            this.authManager.clearAllErrors();
            
            // Set loading state
            this.authManager.setFormLoading(true, form);

            // Validate form
            const formData = this.validateRegistrationForm(form);
            if (!formData) {
                this.authManager.setFormLoading(false, form);
                return;
            }

            // Show loading state
            this.showLoadingState();

            // Create user account
            const authData = await this.supabaseClient.signUp(
                formData.email, 
                formData.password,
                {
                    account_type: formData.accountType,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    phone: formData.phone,
                    business_name: formData.businessName || null
                }
            );

            // Create user profile in database
            if (authData.user && !authData.user.email_confirmed_at) {
                // User needs to confirm email
                this.showSuccessState();
            } else if (authData.user) {
                // Auto-confirmed (if email confirmation is disabled)
                await this.createUserProfile(authData.user.id, formData);
                this.showSuccessState();
            }

        } catch (error) {
            console.error('Registration error:', error);
            this.authManager.handleAuthError(error);
            this.showRegistrationForm();
        } finally {
            this.authManager.setFormLoading(false, form);
        }
    }

    // Validate registration form
    validateRegistrationForm(form) {
        // Use direct DOM access instead of FormData for more reliable field capture
        const data = {
            email: form.querySelector('#email')?.value?.trim(),
            password: form.querySelector('#password')?.value,
            confirmPassword: form.querySelector('#confirmPassword')?.value,
            firstName: form.querySelector('#firstName')?.value?.trim(),
            lastName: form.querySelector('#lastName')?.value?.trim(),
            phone: form.querySelector('#phone')?.value?.trim(),
            accountType: form.querySelector('#accountType')?.value,
            businessName: form.querySelector('#businessName')?.value?.trim(),
            address: form.querySelector('#address')?.value?.trim(),
            agreeTerms: form.querySelector('#agreeTerms')?.checked
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

        const passwordValidation = this.authManager.validatePassword(data.password);
        if (!passwordValidation.isValid) {
            this.authManager.showFieldError('password', passwordValidation.errors[0]);
            return null;
        }

        if (!data.confirmPassword) {
            this.authManager.showFieldError('confirmPassword', 'Please confirm your password');
            return null;
        }

        if (!this.authManager.validatePasswordMatch(data.password, data.confirmPassword)) {
            this.authManager.showFieldError('confirmPassword', 'Passwords do not match');
            return null;
        }

        if (!data.firstName) {
            this.authManager.showFieldError('firstName', 'First name is required');
            return null;
        }

        if (!data.lastName) {
            this.authManager.showFieldError('lastName', 'Last name is required');
            return null;
        }

        if (!data.phone) {
            this.authManager.showFieldError('phone', 'Phone number is required');
            return null;
        }

        if (!this.authManager.validatePhone(data.phone)) {
            this.authManager.showFieldError('phone', 'Please enter a valid phone number');
            return null;
        }

        if (!data.accountType) {
            this.authManager.showError('Please select an account type');
            return null;
        }

        if (!data.agreeTerms) {
            this.authManager.showFieldError('agreeTerms', 'You must agree to the terms and conditions');
            return null;
        }

        return data;
    }

    // Create user profile in database
    async createUserProfile(userId, formData) {
        const profileData = {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            account_type: formData.accountType,
            business_name: formData.businessName || null,
            address: formData.address || null,
            email_verified: false,
            created_at: new Date().toISOString()
        };

        await this.supabaseClient.insertUserProfile(userId, profileData);
    }

    // Show loading state
    showLoadingState() {
        const loadingState = document.getElementById('loading-state');
        const registrationForm = document.getElementById('registration-form');

        if (registrationForm) registrationForm.style.display = 'none';
        if (loadingState) loadingState.style.display = 'block';
    }

    // Show success state
    showSuccessState() {
        const successState = document.getElementById('success-state');
        const loadingState = document.getElementById('loading-state');

        if (loadingState) loadingState.style.display = 'none';
        if (successState) successState.style.display = 'block';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new RegistrationManager();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RegistrationManager;
}