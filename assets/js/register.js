class RegistrationManager {
    #authManager;
    #supabaseClient;
    #selectedAccountType = null;

    constructor() {
        this.#authManager = window.authManager;
        this.#supabaseClient = window.supabaseClient;
        this.init();
    }

    async init() {
        try {
            await this.#supabaseClient.waitForInit();
            this.#setupAccountTypeSelection();
            this.#setupRegistrationForm();
            this.#handleUrlParameters();
        } catch (error) {
            console.error('Registration initialization failed:', error.message);
            this.#authManager.showError('Failed to initialize registration. Please refresh the page.');
        }
    }

    #setupAccountTypeSelection() {
        const selectButtons = document.querySelectorAll('.select-type-btn');
        const backButton = document.getElementById('back-to-selection');

        selectButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const accountType = button.getAttribute('data-type');
                this.#selectAccountType(accountType);
            });
        });

        backButton?.addEventListener('click', (e) => {
            e.preventDefault();
            this.#showAccountTypeSelection();
        });

        document.querySelectorAll('.account-type-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (!e.target.classList.contains('select-type-btn')) {
                    const button = option.querySelector('.select-type-btn');
                    button?.click();
                }
            });
        });
    }

    #selectAccountType(accountType) {
        this.#selectedAccountType = accountType;
        this.#authManager.setUrlParameter('type', accountType);

        const formTitle = document.getElementById('form-title');
        const formSubtitle = document.getElementById('form-subtitle');
        const ownerFields = document.getElementById('owner-fields');
        const accountTypeField = document.getElementById('accountType');

        if (accountType === 'owner') {
            if (formTitle) formTitle.textContent = 'Create Property Owner Account';
            if (formSubtitle) formSubtitle.textContent = 'Start listing your beautiful properties';
            if (ownerFields) ownerFields.style.display = 'block';
        } else {
            if (formTitle) formTitle.textContent = 'Create Renter Account';
            if (formSubtitle) formSubtitle.textContent = 'Start discovering amazing views';
            if (ownerFields) ownerFields.style.display = 'none';
        }

        if (accountTypeField) {
            accountTypeField.value = accountType;
        }

        this.#showRegistrationForm();
    }

    #showAccountTypeSelection() {
        const typeSelection = document.getElementById('account-type-selection');
        const registrationForm = document.getElementById('registration-form');

        if (typeSelection) typeSelection.style.display = 'block';
        if (registrationForm) registrationForm.style.display = 'none';

        this.#authManager.setUrlParameter('type', null);
        this.#selectedAccountType = null;
    }

    #showRegistrationForm() {
        const typeSelection = document.getElementById('account-type-selection');
        const registrationForm = document.getElementById('registration-form');

        if (typeSelection) typeSelection.style.display = 'none';
        if (registrationForm) registrationForm.style.display = 'block';

        const firstInput = registrationForm?.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    #handleUrlParameters() {
        const typeParam = this.#authManager.getUrlParameter('type');
        if (typeParam === 'owner' || typeParam === 'renter') {
            this.#selectAccountType(typeParam);
        }
    }

    #setupRegistrationForm() {
        const form = document.getElementById('registerForm');
        if (!form) return;

        this.#authManager.addRealTimeValidation(form);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.#handleRegistration(form);
        });

        this.#setupInputFormatting(form);
    }

    #setupInputFormatting(form) {
        const phoneField = form.querySelector('#phone');
        if (!phoneField) return;

        phoneField.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 10) {
                value = value.slice(0, 10);
                value = value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
            } else if (value.length >= 6) {
                value = value.replace(/(\d{3})(\d{3})/, '($1) $2-');
            } else if (value.length >= 3) {
                value = value.replace(/(\d{3})/, '($1) ');
            }
            e.target.value = value;
        });
    }

    async #handleRegistration(form) {
        if (this.#authManager.isProcessing) return;

        try {
            this.#authManager.clearAllErrors();
            this.#authManager.setFormLoading(true, form);

            const formData = this.#validateRegistrationForm(form);
            if (!formData) {
                this.#authManager.setFormLoading(false, form);
                return;
            }

            this.#showLoadingState();

            const authData = await this.#supabaseClient.signUp(
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

            if (authData.user) {
                await this.#createUserProfile(authData.user.id, formData);
                this.#showSuccessState();
            }
        } catch (error) {
            console.error('Registration error:', error.message);
            this.#authManager.handleAuthError(error);
            this.#showRegistrationForm();
        } finally {
            this.#authManager.setFormLoading(false, form);
        }
    }

    #validateRegistrationForm(form) {
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

        const passwordValidation = this.#authManager.validatePassword(data.password);
        if (!passwordValidation.isValid) {
            this.#authManager.showFieldError('password', passwordValidation.errors[0]);
            return null;
        }

        if (!data.confirmPassword) {
            this.#authManager.showFieldError('confirmPassword', 'Please confirm your password');
            return null;
        }

        if (!this.#authManager.validatePasswordMatch(data.password, data.confirmPassword)) {
            this.#authManager.showFieldError('confirmPassword', 'Passwords do not match');
            return null;
        }

        if (!data.firstName) {
            this.#authManager.showFieldError('firstName', 'First name is required');
            return null;
        }

        if (!data.lastName) {
            this.#authManager.showFieldError('lastName', 'Last name is required');
            return null;
        }

        if (!data.phone) {
            this.#authManager.showFieldError('phone', 'Phone number is required');
            return null;
        }

        if (!this.#authManager.validatePhone(data.phone)) {
            this.#authManager.showFieldError('phone', 'Please enter a valid phone number');
            return null;
        }

        if (!data.accountType) {
            this.#authManager.showError('Please select an account type');
            return null;
        }

        if (!data.agreeTerms) {
            this.#authManager.showFieldError('agreeTerms', 'You must agree to the terms and conditions');
            return null;
        }

        return data;
    }

    async #createUserProfile(userId, formData) {
        if (!this.#supabaseClient.supabase) {
            throw new Error('Supabase client not initialized');
        }

        const profileData = {
            user_id: userId,
            email: formData.email.toLowerCase(),
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            account_type: formData.accountType,
            business_name: formData.businessName || null,
            address: formData.address || null,
            email_verified: false,
            is_active: true,
            created_at: new Date().toISOString()
        };

        const { data, error } = await this.#supabaseClient.supabase
            .from('user_profiles')
            .insert([profileData]);

        if (error) {
            throw error;
        }

        return data;
    }

    #showLoadingState() {
        const loadingState = document.getElementById('loading-state');
        const registrationForm = document.getElementById('registration-form');

        if (registrationForm) registrationForm.style.display = 'none';
        if (loadingState) loadingState.style.display = 'block';
    }

    #showSuccessState() {
        const successState = document.getElementById('success-state');
        const loadingState = document.getElementById('loading-state');

        if (loadingState) loadingState.style.display = 'none';
        if (successState) successState.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RegistrationManager();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RegistrationManager;
}
