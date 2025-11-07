'use strict';

class SettingsManager {
    #supabaseClient;
    #currentUser;

    constructor() {
        this.#supabaseClient = window.supabaseClient;
        this.#init();
    }

    async #init() {
        try {
            await this.#supabaseClient.waitForInit();

            if (!this.#supabaseClient.isAuthenticated()) {
                setTimeout(() => {
                    if (!this.#supabaseClient.isAuthenticated()) {
                        window.location.href = 'login.html';
                    } else {
                        this.#setup();
                    }
                }, 1000);
                return;
            }

            this.#setup();
        } catch (error) {
            console.error('Settings init error:', error);
            this.#showError('Failed to initialize settings page');
        }
    }

    #setup() {
        this.#currentUser = this.#supabaseClient.getCurrentUser();
        this.#setupEventListeners();
        this.#loadSettings();
    }

    #setupEventListeners() {
        // Password form
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.#handlePasswordChange();
            });
        }

        // Notifications form
        const notificationsForm = document.getElementById('notificationsForm');
        if (notificationsForm) {
            notificationsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.#handleNotificationSettings();
            });
        }

        // Account preferences form
        const accountPreferencesForm = document.getElementById('accountPreferencesForm');
        if (accountPreferencesForm) {
            accountPreferencesForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.#handleAccountPreferences();
            });
        }

        // Delete account button
        const deleteBtn = document.getElementById('deleteAccountBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.#handleDeleteAccount());
        }
    }

    async #loadSettings() {
        try {
            if (!this.#currentUser || !this.#supabaseClient.supabase) return;

            // Load user preferences
            const { data, error } = await this.#supabaseClient.supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', this.#currentUser.id)
                .single();

            if (data) {
                // Populate notification settings
                if (data.email_notifications !== undefined) {
                    document.getElementById('emailBookings').checked = data.email_notifications;
                }

                // Populate account preferences
                if (data.language) {
                    document.getElementById('language').value = data.language;
                }
                if (data.currency) {
                    document.getElementById('currency').value = data.currency;
                }
            }
        } catch (error) {
            console.error('Load settings error:', error);
        }
    }

    async #handlePasswordChange() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validate passwords
        if (newPassword !== confirmPassword) {
            this.#showError('New passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            this.#showError('Password must be at least 8 characters long');
            return;
        }

        if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword)) {
            this.#showError('Password must contain uppercase and lowercase letters');
            return;
        }

        if (!/[0-9]/.test(newPassword)) {
            this.#showError('Password must contain at least one number');
            return;
        }

        if (!/[^A-Za-z0-9]/.test(newPassword)) {
            this.#showError('Password must contain at least one special character');
            return;
        }

        try {
            if (!this.#supabaseClient.supabase) {
                this.#showError('Authentication service not available');
                return;
            }

            const { error } = await this.#supabaseClient.supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            this.#showNotification('Password updated successfully!', 'success');

            // Clear form
            document.getElementById('passwordForm').reset();
        } catch (error) {
            console.error('Password change error:', error);
            this.#showError(error.message || 'Failed to update password');
        }
    }

    async #handleNotificationSettings() {
        try {
            if (!this.#currentUser || !this.#supabaseClient.supabase) {
                this.#showError('Database not configured');
                return;
            }

            const emailBookings = document.getElementById('emailBookings').checked;
            const emailMessages = document.getElementById('emailMessages').checked;
            const emailPromotions = document.getElementById('emailPromotions').checked;
            const emailTips = document.getElementById('emailTips').checked;

            const { error } = await this.#supabaseClient.supabase
                .from('user_profiles')
                .upsert([{
                    user_id: this.#currentUser.id,
                    email_notifications: emailBookings,
                    message_notifications: emailMessages,
                    promotional_emails: emailPromotions,
                    tips_emails: emailTips,
                    updated_at: new Date().toISOString()
                }], { onConflict: 'user_id' });

            if (error) throw error;

            this.#showNotification('Notification preferences saved!', 'success');
        } catch (error) {
            console.error('Save notification settings error:', error);
            this.#showError('Failed to save notification preferences');
        }
    }

    async #handleAccountPreferences() {
        try {
            if (!this.#currentUser || !this.#supabaseClient.supabase) {
                this.#showError('Database not configured');
                return;
            }

            const language = document.getElementById('language').value;
            const currency = document.getElementById('currency').value;

            const { error } = await this.#supabaseClient.supabase
                .from('user_profiles')
                .upsert([{
                    user_id: this.#currentUser.id,
                    language: language,
                    currency: currency,
                    updated_at: new Date().toISOString()
                }], { onConflict: 'user_id' });

            if (error) throw error;

            this.#showNotification('Account preferences saved!', 'success');
        } catch (error) {
            console.error('Save account preferences error:', error);
            this.#showError('Failed to save account preferences');
        }
    }

    async #handleDeleteAccount() {
        const confirmed = confirm(
            'Are you absolutely sure you want to delete your account? This action cannot be undone.\n\nAll your data, including:\n- Profile information\n- Properties (if you are a host)\n- Bookings and reservations\n- Messages\n\nwill be permanently deleted.'
        );

        if (!confirmed) return;

        const doubleConfirm = confirm(
            'This is your last chance. Are you REALLY sure you want to delete your account?'
        );

        if (!doubleConfirm) return;

        try {
            if (!this.#currentUser || !this.#supabaseClient.supabase) {
                this.#showError('Database not configured');
                return;
            }

            // Here you would typically:
            // 1. Delete user's properties
            // 2. Delete user's bookings
            // 3. Delete user's messages
            // 4. Delete user's profile
            // 5. Delete the auth user

            // For now, we'll just show a message
            this.#showNotification('Account deletion feature coming soon. Please contact support.', 'info');
            
            // Uncomment when ready to implement:
            /*
            const { error } = await this.#supabaseClient.supabase.rpc('delete_user_account', {
                user_id: this.#currentUser.id
            });

            if (error) throw error;

            this.#showNotification('Account deleted. You will be logged out.', 'success');
            
            setTimeout(() => {
                this.#supabaseClient.logout();
            }, 2000);
            */
        } catch (error) {
            console.error('Delete account error:', error);
            this.#showError('Failed to delete account. Please contact support.');
        }
    }

    #showNotification(message, type = 'info') {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(message, type);
        } else {
            alert(message);
        }
    }

    #showError(message) {
        this.#showNotification(message, 'error');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});

