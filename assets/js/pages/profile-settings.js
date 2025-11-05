/**
 * Profile Settings Page
 * Handles user profile management and settings
 */

'use strict';

class ProfileSettingsPage {
    constructor() {
        this.supabase = null;
        this.user = null;
        this.profile = null;
        this.photoFile = null;

        this.init();
    }

    async init() {
        try {
            // Wait for Supabase to be ready
            await window.supabaseClient.waitForInit();
            this.supabase = window.supabaseClient.supabase;

            // Check authentication
            if (!window.supabaseClient.requireAuth()) {
                return;
            }

            this.user = window.supabaseClient.getCurrentUser();

            // Load user profile
            await this.loadProfile();

            // Setup event listeners
            this.setupEventListeners();

        } catch (error) {
            console.error('Error initializing profile settings:', error);
            this.showError('Failed to load profile settings');
        }
    }

    async loadProfile() {
        try {
            const { data, error } = await this.supabase
                .from('user_profiles')
                .select('*')
                .eq('id', this.user.id)
                .single();

            if (error) throw error;

            this.profile = data;
            this.populateForm();
        } catch (error) {
            console.error('Error loading profile:', error);
            this.showError('Failed to load profile data');
        }
    }

    populateForm() {
        // Personal Information
        document.getElementById('firstName').value = this.profile.first_name || '';
        document.getElementById('lastName').value = this.profile.last_name || '';
        document.getElementById('email').value = this.user.email || '';
        document.getElementById('phone').value = this.profile.phone || '';
        document.getElementById('bio').value = this.profile.bio || '';

        // Profile Photo
        this.updateProfilePhoto();

        // Preferences
        document.getElementById('language').value = this.profile.language || 'en';
        document.getElementById('currency').value = this.profile.preferred_currency || 'USD';
        document.getElementById('emailNotifications').checked = this.profile.email_notifications !== false;
        document.getElementById('marketingEmails').checked = this.profile.marketing_emails !== false;
    }

    updateProfilePhoto() {
        const avatarLarge = document.getElementById('profileAvatarLarge');
        const avatarInitials = document.getElementById('avatarInitials');

        if (this.profile.profile_image_url) {
            avatarLarge.innerHTML = `<img src="${this.profile.profile_image_url}" alt="Profile">`;
        } else {
            const initials = this.getInitials(this.profile.first_name, this.profile.last_name);
            avatarInitials.textContent = initials;
        }
    }

    getInitials(firstName, lastName) {
        const first = firstName ? firstName.charAt(0).toUpperCase() : '';
        const last = lastName ? lastName.charAt(0).toUpperCase() : '';
        return first + last || 'U';
    }

    setupEventListeners() {
        // Photo upload
        document.getElementById('photoUpload').addEventListener('change', (e) => {
            this.handlePhotoUpload(e);
        });

        document.getElementById('removePhotoBtn').addEventListener('click', () => {
            this.removePhoto();
        });

        // Personal Info Form
        document.getElementById('personalInfoForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePersonalInfo();
        });

        document.getElementById('cancelPersonalInfo').addEventListener('click', () => {
            this.populateForm();
        });

        // Password Form
        document.getElementById('passwordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });

        document.getElementById('cancelPassword').addEventListener('click', () => {
            document.getElementById('passwordForm').reset();
        });

        // Preferences Form
        document.getElementById('preferencesForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePreferences();
        });

        document.getElementById('cancelPreferences').addEventListener('click', () => {
            this.populateForm();
        });

        // Delete Account
        document.getElementById('deleteAccountBtn').addEventListener('click', () => {
            this.confirmDeleteAccount();
        });

        // Header Logout Button
        const headerLogoutBtn = document.getElementById('headerLogoutBtn');
        if (headerLogoutBtn) {
            console.log('Header logout button found and handler attached');
            headerLogoutBtn.addEventListener('click', () => {
                console.log('Header logout button clicked');
                this.handleLogout();
            });
        } else {
            console.warn('Header logout button not found');
        }
    }

    async handleLogout() {
        try {
            await this.supabase.auth.signOut();

            // Show success message
            this.showSuccess('Successfully logged out');

            // Redirect to home page
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 500);
        } catch (error) {
            console.error('Logout error:', error);
            // Even if error, redirect to home
            window.location.href = '../index.html';
        }
    }

    async handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('Please select an image file');
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            this.showError('Image size must be less than 5MB');
            return;
        }

        try {
            this.showLoading('Uploading photo...');

            // Delete old photo if exists
            if (this.profile.profile_image_url) {
                const oldPath = this.profile.profile_image_url.split('/').pop();
                await this.supabase.storage
                    .from('profile-images')
                    .remove([`${this.user.id}/${oldPath}`]);
            }

            // Upload new photo
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${this.user.id}/${fileName}`;

            const { error: uploadError } = await this.supabase.storage
                .from('profile-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = this.supabase.storage
                .from('profile-images')
                .getPublicUrl(filePath);

            // Update profile
            const { error: updateError } = await this.supabase
                .from('user_profiles')
                .update({ profile_image_url: publicUrl })
                .eq('id', this.user.id);

            if (updateError) throw updateError;

            this.profile.profile_image_url = publicUrl;
            this.updateProfilePhoto();
            this.showSuccess('Profile photo updated successfully');

        } catch (error) {
            console.error('Error uploading photo:', error);
            this.showError('Failed to upload photo');
        }
    }

    async removePhoto() {
        if (!this.profile.profile_image_url) {
            this.showError('No photo to remove');
            return;
        }

        if (!confirm('Are you sure you want to remove your profile photo?')) {
            return;
        }

        try {
            this.showLoading('Removing photo...');

            // Delete from storage
            const oldPath = this.profile.profile_image_url.split('/').pop();
            await this.supabase.storage
                .from('profile-images')
                .remove([`${this.user.id}/${oldPath}`]);

            // Update profile
            const { error } = await this.supabase
                .from('user_profiles')
                .update({ profile_image_url: null })
                .eq('id', this.user.id);

            if (error) throw error;

            this.profile.profile_image_url = null;
            this.updateProfilePhoto();
            this.showSuccess('Profile photo removed successfully');

        } catch (error) {
            console.error('Error removing photo:', error);
            this.showError('Failed to remove photo');
        }
    }

    async savePersonalInfo() {
        try {
            this.showLoading('Saving changes...');

            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const bio = document.getElementById('bio').value.trim();

            if (!firstName || !lastName) {
                this.showError('First name and last name are required');
                return;
            }

            const { error } = await this.supabase
                .from('user_profiles')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    phone: phone || null,
                    bio: bio || null
                })
                .eq('id', this.user.id);

            if (error) throw error;

            // Update local profile
            this.profile.first_name = firstName;
            this.profile.last_name = lastName;
            this.profile.phone = phone;
            this.profile.bio = bio;

            this.updateProfilePhoto();
            this.showSuccess('Personal information updated successfully');

        } catch (error) {
            console.error('Error saving personal info:', error);
            this.showError('Failed to save changes');
        }
    }

    async changePassword() {
        try {
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // Validate passwords
            if (newPassword !== confirmPassword) {
                this.showError('New passwords do not match');
                return;
            }

            if (newPassword.length < 8) {
                this.showError('Password must be at least 8 characters long');
                return;
            }

            if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(newPassword)) {
                this.showError('Password must contain uppercase, lowercase, number, and special character');
                return;
            }

            this.showLoading('Updating password...');

            // Update password using Supabase Auth
            const { error } = await this.supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            document.getElementById('passwordForm').reset();
            this.showSuccess('Password updated successfully');

        } catch (error) {
            console.error('Error changing password:', error);
            this.showError('Failed to update password. Please check your current password.');
        }
    }

    async savePreferences() {
        try {
            this.showLoading('Saving preferences...');

            const language = document.getElementById('language').value;
            const currency = document.getElementById('currency').value;
            const emailNotifications = document.getElementById('emailNotifications').checked;
            const marketingEmails = document.getElementById('marketingEmails').checked;

            const { error } = await this.supabase
                .from('user_profiles')
                .update({
                    language: language,
                    preferred_currency: currency,
                    email_notifications: emailNotifications,
                    marketing_emails: marketingEmails
                })
                .eq('id', this.user.id);

            if (error) throw error;

            this.showSuccess('Preferences saved successfully');

        } catch (error) {
            console.error('Error saving preferences:', error);
            this.showError('Failed to save preferences');
        }
    }

    async confirmDeleteAccount() {
        const confirmation = prompt(
            'WARNING: This action cannot be undone!\n\n' +
            'All your data, including properties and bookings, will be permanently deleted.\n\n' +
            'Type "DELETE" to confirm:'
        );

        if (confirmation !== 'DELETE') {
            return;
        }

        try {
            this.showLoading('Deleting account...');

            // Note: In production, you'd want to handle this server-side
            // to ensure all related data is properly cleaned up
            const { error } = await this.supabase.auth.admin.deleteUser(this.user.id);

            if (error) throw error;

            this.showSuccess('Account deleted successfully');

            // Sign out and redirect
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);

        } catch (error) {
            console.error('Error deleting account:', error);
            this.showError('Failed to delete account. Please contact support.');
        }
    }

    showSuccess(message) {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(message, 'success');
        } else {
            alert(message);
        }
    }

    showError(message) {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(message, 'error');
        } else {
            alert(message);
        }
    }

    showLoading(message) {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(message, 'info');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.profileSettingsPage = new ProfileSettingsPage();
});
