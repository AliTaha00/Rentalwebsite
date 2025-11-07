'use strict';

class ProfileManager {
    #supabaseClient;
    #userProfile = null;
    #currentEditField = null;
    #hasChanges = false;

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
            console.error('Profile init error:', error);
            this.#showError('Failed to initialize profile page');
        }
    }

    #setup() {
        this.#setupEventListeners();
        this.#loadProfile();
    }

    #setupEventListeners() {
        // Edit buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const field = btn.getAttribute('data-field');
                this.#toggleEditMode(field);
            });
        });

        // Save button
        const saveBtn = document.getElementById('saveProfileBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.#saveProfile());
        }

        // Profile photo click
        const profileAvatar = document.getElementById('profileAvatarXL');
        if (profileAvatar) {
            profileAvatar.addEventListener('click', () => this.#openPhotoModal());
        }

        // Photo modal
        const closeModal = document.getElementById('closePhotoModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.#closePhotoModal());
        }

        const uploadBtn = document.getElementById('uploadPhotoBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                document.getElementById('photoUpload').click();
            });
        }

        const photoUpload = document.getElementById('photoUpload');
        if (photoUpload) {
            photoUpload.addEventListener('change', (e) => this.#handlePhotoUpload(e));
        }

        // Close modal on backdrop click
        const modal = document.getElementById('photoModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.#closePhotoModal();
                }
            });
        }

        // Handle Enter key in inputs
        document.querySelectorAll('.detail-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.#toggleEditMode(input.id.replace('input', '').charAt(0).toLowerCase() + input.id.replace('input', '').slice(1));
                }
            });
        });
    }

    async #loadProfile() {
        try {
            const user = this.#supabaseClient.getCurrentUser();
            if (!user) return;

            // Try to load from database
            if (this.#supabaseClient.supabase) {
                const { data, error } = await this.#supabaseClient.supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (data) {
                    this.#userProfile = data;
                    this.#populateProfile(data, user);
                    return;
                }
            }

            // Fallback to user metadata
            this.#populateProfile(null, user);
        } catch (error) {
            console.error('Load profile error:', error);
            // Use metadata as fallback
            const user = this.#supabaseClient.getCurrentUser();
            if (user) {
                this.#populateProfile(null, user);
            }
        }
    }

    #populateProfile(profile, user) {
        const metadata = user.user_metadata || {};

        // Full name
        const fullName = profile?.first_name && profile?.last_name 
            ? `${profile.first_name} ${profile.last_name}`
            : metadata.first_name && metadata.last_name
                ? `${metadata.first_name} ${metadata.last_name}`
                : metadata.firstName && metadata.lastName
                    ? `${metadata.firstName} ${metadata.lastName}`
                    : user.email?.split('@')[0] || 'User';

        // Email
        const email = user.email || 'user@example.com';

        // Phone
        const phone = profile?.phone || metadata.phone || '+1 (555) 123-4567';

        // Bio
        const bio = profile?.bio || 'Experienced property manager and avid traveler. I love hosting guests from around the world and sharing the best my city has to offer. My properties are always clean, comfortable, and ready for you to call home.';

        // Update display elements
        document.getElementById('profileNameDisplay').textContent = this.#sanitize(fullName);
        document.getElementById('displayFullName').textContent = this.#sanitize(fullName);
        document.getElementById('displayEmail').textContent = this.#sanitize(email);
        document.getElementById('displayPhone').textContent = this.#sanitize(phone);
        document.getElementById('displayAbout').textContent = this.#sanitize(bio);

        // Update input elements
        document.getElementById('inputFullName').value = fullName;
        document.getElementById('inputEmail').value = email;
        document.getElementById('inputPhone').value = phone;
        document.getElementById('inputAbout').value = bio;

        // Update avatar
        const initials = fullName.charAt(0).toUpperCase();
        document.getElementById('avatarInitials').textContent = initials;

        // Store current values for comparison
        this.#currentValues = {
            fullName,
            email,
            phone,
            about: bio
        };
    }

    #toggleEditMode(field) {
        if (this.#currentEditField && this.#currentEditField !== field) {
            this.#cancelEdit(this.#currentEditField);
        }

        const displayElement = document.getElementById(`display${field.charAt(0).toUpperCase() + field.slice(1)}`);
        const inputElement = document.getElementById(`input${field.charAt(0).toUpperCase() + field.slice(1)}`);
        const editBtn = document.querySelector(`[data-field="${field}"]`);

        if (inputElement.style.display === 'none') {
            // Enter edit mode
            displayElement.style.display = 'none';
            inputElement.style.display = 'block';
            inputElement.focus();
            
            if (inputElement.tagName === 'TEXTAREA') {
                inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
            }

            editBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            editBtn.style.borderColor = '#10b981';
            editBtn.style.background = '#ecfdf5';

            this.#currentEditField = field;
            this.#hasChanges = true;
        } else {
            // Exit edit mode
            displayElement.textContent = this.#sanitize(inputElement.value);
            displayElement.style.display = 'block';
            inputElement.style.display = 'none';

            editBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            `;
            editBtn.style.borderColor = '';
            editBtn.style.background = '';

            this.#currentEditField = null;
        }
    }

    #cancelEdit(field) {
        const displayElement = document.getElementById(`display${field.charAt(0).toUpperCase() + field.slice(1)}`);
        const inputElement = document.getElementById(`input${field.charAt(0).toUpperCase() + field.slice(1)}`);
        const editBtn = document.querySelector(`[data-field="${field}"]`);

        inputElement.value = displayElement.textContent;
        displayElement.style.display = 'block';
        inputElement.style.display = 'none';

        editBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        `;
        editBtn.style.borderColor = '';
        editBtn.style.background = '';
    }

    async #saveProfile() {
        if (!this.#hasChanges) {
            this.#showNotification('No changes to save', 'info');
            return;
        }

        try {
            const user = this.#supabaseClient.getCurrentUser();
            if (!user) {
                this.#showError('User not authenticated');
                return;
            }

            // Get values
            const fullName = document.getElementById('inputFullName').value.trim();
            const [firstName = '', ...lastNameParts] = fullName.split(' ');
            const lastName = lastNameParts.join(' ');
            const email = document.getElementById('inputEmail').value.trim();
            const phone = document.getElementById('inputPhone').value.trim();
            const bio = document.getElementById('inputAbout').value.trim();

            // Prepare profile data
            const profileData = {
                user_id: user.id,
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone,
                bio: bio,
                updated_at: new Date().toISOString()
            };

            if (this.#supabaseClient.supabase) {
                // Update or insert profile
                const { error } = await this.#supabaseClient.supabase
                    .from('user_profiles')
                    .upsert([profileData], { onConflict: 'user_id' });

                if (error) throw error;

                this.#showNotification('Profile updated successfully!', 'success');
                this.#hasChanges = false;
                
                // Reload profile
                await this.#loadProfile();
            } else {
                this.#showError('Database not configured');
            }
        } catch (error) {
            console.error('Save profile error:', error);
            this.#showError('Failed to save profile. Please try again.');
        }
    }

    #openPhotoModal() {
        const modal = document.getElementById('photoModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    #closePhotoModal() {
        const modal = document.getElementById('photoModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async #handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.#showError('Please select an image file');
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.#showError('Image size must be less than 5MB');
            return;
        }

        try {
            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.getElementById('profilePhotoImg');
                if (img) {
                    img.src = e.target.result;
                    img.style.display = 'block';
                    document.getElementById('avatarInitials').style.display = 'none';
                }
            };
            reader.readAsDataURL(file);

            this.#closePhotoModal();
            this.#showNotification('Photo upload feature coming soon!', 'info');
            this.#hasChanges = true;
        } catch (error) {
            console.error('Photo upload error:', error);
            this.#showError('Failed to upload photo');
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

    #sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ProfileManager();
});

