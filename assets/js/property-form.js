'use strict';

class PropertyFormManager {
    constructor() {
        this.supabaseClient = window.supabaseClient;
        this.form = document.getElementById('propertyForm');
        this.formTitle = document.getElementById('formTitle');
        this.photosInput = document.getElementById('photos');
        this.saveBtn = document.getElementById('saveBtn');
        this.deleteBtn = document.getElementById('deleteBtn');
        this.editPropertyId = null;

        this.#init();
    }

    async #init() {
        try {
            await this.supabaseClient.waitForInit();

            if (!this.supabaseClient.isAuthenticated()) {
                window.location.href = 'login.html';
                return;
            }

            const userType = this.supabaseClient.getCurrentUser()?.user_metadata?.account_type;
            if (userType !== 'owner') {
                this.#showError('Access denied. Owner account required.');
                setTimeout(() => { this.#safeNavigate('index.html'); }, 800);
                return;
            }

            this.#parseQueryParams();
            this.#setupEventListeners();

            if (this.editPropertyId) {
                this.formTitle.textContent = 'Edit Property';
                if (this.deleteBtn) this.deleteBtn.style.display = 'inline-block';
                await this.#loadProperty(this.editPropertyId);
            }
        } catch (error) {
            this.#showError('Failed to initialize property form. Please refresh the page.');
        }
    }

    #parseQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) this.editPropertyId = id;
    }

    #setupEventListeners() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.#handleSubmit();
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try { await this.supabaseClient.signOut(); } catch {}
            });
        }

        if (this.deleteBtn) {
            this.deleteBtn.addEventListener('click', () => this.#handleDeleteProperty());
        }
    }

    async #loadProperty(propertyId) {
        try {
            const { data, error } = await this.supabaseClient.supabase
                .from('properties')
                .select(`
                    *,
                    property_images(id, image_url, is_primary, display_order)
                `)
                .eq('id', propertyId)
                .single();

            if (error) throw error;

            const uid = this.supabaseClient.getCurrentUser()?.id;
            if (data.owner_id && data.owner_id !== uid) {
                this.#showError('You are not allowed to edit this property.');
                setTimeout(() => { this.#safeNavigate('owner-dashboard.html'); }, 800);
                return;
            }

            this.#fillForm(data);
            this.#displayExistingImages(data.property_images || []);
        } catch (error) {
            this.#showError('Could not load property for editing.');
        }
    }

    #fillForm(p) {
        const set = (id, v) => { const el = document.getElementById(id); if (el && v !== null && v !== undefined) el.value = v; };
        set('title', p.title);
        set('property_type', p.property_type);
        set('view_type', p.view_type);
        set('description', p.description);
        set('address', p.address);
        set('city', p.city);
        set('state', p.state);
        set('country', p.country);
        set('postal_code', p.postal_code);
        set('bedrooms', p.bedrooms);
        set('bathrooms', p.bathrooms);
        set('max_guests', p.max_guests);
        set('property_size', p.property_size);
        set('base_price', p.base_price);
        set('currency', p.currency);
        set('cleaning_fee', p.cleaning_fee);
        set('min_stay', p.min_stay);
        set('house_rules', p.house_rules);
        set('cancellation_policy', p.cancellation_policy);
        set('check_in_time', p.check_in_time);
        set('check_out_time', p.check_out_time);
        set('owner_phone', p.owner_phone);
        set('owner_email', p.owner_email);
        set('external_booking_url', p.external_booking_url);
        set('booking_instructions', p.booking_instructions);

        if (Array.isArray(p.amenities)) {
            document.querySelectorAll('.amenity').forEach(cb => {
                cb.checked = p.amenities.includes(cb.value);
            });
        }
    }

    #collectFormData() {
        const read = (id) => document.getElementById(id)?.value?.trim() || null;
        const num = (id) => {
            const v = document.getElementById(id)?.value;
            if (v === '' || v == null) return null;
            const n = Number(v);
            return Number.isNaN(n) ? null : n;
        };

        const amenities = Array.from(document.querySelectorAll('.amenity:checked')).map(cb => cb.value);

        const data = {
            title: read('title'),
            property_type: read('property_type'),
            view_type: read('view_type'),
            description: read('description'),
            address: read('address'),
            city: read('city'),
            state: read('state'),
            country: read('country'),
            postal_code: read('postal_code'),
            bedrooms: num('bedrooms'),
            bathrooms: num('bathrooms'),
            max_guests: num('max_guests'),
            property_size: num('property_size'),
            base_price: num('base_price'),
            currency: read('currency') || 'USD',
            cleaning_fee: num('cleaning_fee'),
            min_stay: num('min_stay') ?? 1,
            amenities,
            house_rules: read('house_rules'),
            cancellation_policy: read('cancellation_policy') || 'moderate',
            check_in_time: read('check_in_time') || '15:00',
            check_out_time: read('check_out_time') || '11:00',
            owner_phone: read('owner_phone'),
            owner_email: read('owner_email'),
            external_booking_url: read('external_booking_url'),
            booking_instructions: read('booking_instructions'),
            is_active: true
        };

        const required = ['title','property_type','view_type','description','address','city','state','country','max_guests','base_price'];
        for (const key of required) {
            if (!data[key] && data[key] !== 0) {
                this.#showError(`Missing required field: ${key.replace('_',' ')}`);
                return null;
            }
        }

        return data;
    }

    async #handleSubmit() {
        if (!this.supabaseClient.supabase) {
            this.#showError('Supabase is not configured.');
            return;
        }

        const user = this.supabaseClient.getCurrentUser();
        if (!user) {
            this.#showError('You must be logged in.');
            return;
        }

        const data = this.#collectFormData();
        if (!data) return;

        this.saveBtn.disabled = true;
        this.saveBtn.textContent = 'Saving...';

        try {
            let propertyId = this.editPropertyId;
            if (!propertyId) {
                const payload = { ...data, owner_id: user.id };
                const { data: inserted, error } = await this.supabaseClient.supabase
                    .from('properties')
                    .insert([payload])
                    .select('id')
                    .single();
                if (error) throw error;
                propertyId = inserted.id;
            } else {
                const { error } = await this.supabaseClient.supabase
                    .from('properties')
                    .update(data)
                    .eq('id', propertyId);
                if (error) throw error;
            }

            if (this.photosInput && this.photosInput.files && this.photosInput.files.length > 0) {
                await this.#uploadImages(propertyId, Array.from(this.photosInput.files));
            }

            this.#showSuccess('Property saved successfully!');
            setTimeout(() => { window.location.href = 'owner-dashboard.html'; }, 800);
        } catch (error) {
            this.#showError(error.message || 'Failed to save property.');
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = 'Save Property';
        }
    }

    async #uploadImages(propertyId, files) {
        const MAX_FILES = 10;
        const MAX_SIZE_BYTES = 5 * 1024 * 1024;
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

        if (files.length > MAX_FILES) {
            this.#showError(`Please upload ${MAX_FILES} images or fewer.`);
            files = files.slice(0, MAX_FILES);
        }

        const userId = this.supabaseClient.getCurrentUser()?.id;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!ALLOWED_TYPES.includes(file.type)) {
                this.#showError(`Unsupported file type: ${file.type || 'unknown'}`);
                continue;
            }
            if (file.size > MAX_SIZE_BYTES) {
                this.#showError(`File too large: ${file.name}`);
                continue;
            }

            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const safeTs = Date.now();
            const path = `properties/${userId}/${propertyId}/gallery/${safeTs}_${i}.${ext}`;

            const { error: uploadError } = await this.supabaseClient.supabase
                .storage.from('property-images')
                .upload(path, file, { upsert: false, contentType: file.type });

            if (uploadError) throw uploadError;

            const { data: publicUrl } = this.supabaseClient.supabase
                .storage.from('property-images')
                .getPublicUrl(path);

            const { error: imageError } = await this.supabaseClient.supabase
                .from('property_images')
                .insert([{ property_id: propertyId, image_url: publicUrl.publicUrl, is_primary: i === 0 }]);

            if (imageError) throw imageError;
        }
    }

    #safeNavigate(relative) {
        if (window.location.protocol === 'file:') {
            const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            window.location.href = `${currentDir}/${relative}`;
        } else {
            window.location.href = relative;
        }
    }

    #sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    #showError(message) {
        this.#showBanner(message, 'error');
    }

    #showSuccess(message) {
        this.#showBanner(message, 'success');
    }

    #showBanner(message, type) {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(message, type);
            return;
        }
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 3000);
    }

    #displayExistingImages(images) {
        let container = document.getElementById('existingImagesContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'existingImagesContainer';
            container.style.cssText = `
                margin-bottom: 1rem;
                padding: 1rem;
                border: 1px solid #ddd;
                border-radius: 6px;
                background: #f9f9f9;
            `;

            const photosInput = this.photosInput;
            if (photosInput && photosInput.parentNode) {
                const label = photosInput.previousElementSibling;
                if (label && label.tagName === 'LABEL') {
                    photosInput.parentNode.insertBefore(container, label);
                } else {
                    photosInput.parentNode.insertBefore(container, photosInput);
                }
            }
        }

        container.textContent = '';

        if (images.length === 0) {
            const emptyMsg = document.createElement('p');
            const emText = document.createElement('em');
            emText.textContent = 'No images uploaded yet.';
            emptyMsg.appendChild(emText);
            container.appendChild(emptyMsg);
            return;
        }

        const sortedImages = [...images].sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return (a.display_order || 0) - (b.display_order || 0);
        });

        const title = document.createElement('h4');
        title.style.cssText = 'margin: 0 0 1rem 0;';
        title.textContent = 'Existing Images';
        container.appendChild(title);

        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem;';
        container.appendChild(grid);

        sortedImages.forEach(img => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            imageItem.dataset.imageId = img.id;
            imageItem.style.cssText = `
                position: relative;
                border: 2px solid ${img.is_primary ? '#28a745' : '#ddd'};
                border-radius: 6px;
                overflow: hidden;
                background: white;
            `;

            const imgEl = document.createElement('img');
            imgEl.src = this.#sanitize(img.image_url);
            imgEl.alt = 'Property image';
            imgEl.style.cssText = 'width: 100%; height: 120px; object-fit: cover; display: block;';
            imageItem.appendChild(imgEl);

            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'padding: 0.5rem; font-size: 0.85rem;';

            if (img.is_primary) {
                const primaryLabel = document.createElement('div');
                primaryLabel.style.cssText = 'color: #28a745; font-weight: bold; margin-bottom: 0.25rem;';
                primaryLabel.textContent = '✓ Primary';
                infoDiv.appendChild(primaryLabel);
            }

            const btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'display: flex; gap: 0.25rem;';

            if (!img.is_primary) {
                const setPrimaryBtn = document.createElement('button');
                setPrimaryBtn.type = 'button';
                setPrimaryBtn.className = 'btn-small btn-primary';
                setPrimaryBtn.style.cssText = 'flex: 1; padding: 0.25rem; font-size: 0.75rem;';
                setPrimaryBtn.textContent = 'Set Primary';
                setPrimaryBtn.addEventListener('click', () => this.setPrimaryImage(img.id));
                btnContainer.appendChild(setPrimaryBtn);
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn-small btn-danger';
            deleteBtn.style.cssText = 'flex: 1; padding: 0.25rem; font-size: 0.75rem;';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => this.deleteImage(img.id));
            btnContainer.appendChild(deleteBtn);

            infoDiv.appendChild(btnContainer);
            imageItem.appendChild(infoDiv);
            grid.appendChild(imageItem);
        });

        const tip = document.createElement('p');
        tip.style.cssText = 'margin-top: 1rem; font-size: 0.9rem; color: #666;';
        const strong = document.createElement('strong');
        strong.textContent = 'Tip:';
        tip.appendChild(strong);
        const tipText = document.createTextNode(' The primary image will be shown as the main photo on your listing.');
        tip.appendChild(tipText);
        container.appendChild(tip);
    }

    async setPrimaryImage(imageId) {
        try {
            if (!this.supabaseClient.supabase) {
                this.#showError('Database not configured');
                return;
            }

            await this.supabaseClient.supabase
                .from('property_images')
                .update({ is_primary: false })
                .eq('property_id', this.editPropertyId);

            const { error } = await this.supabaseClient.supabase
                .from('property_images')
                .update({ is_primary: true })
                .eq('id', imageId);

            if (error) throw error;

            this.#showSuccess('Primary image updated successfully');

            if (this.editPropertyId) {
                await this.#loadProperty(this.editPropertyId);
            }

        } catch (error) {
            this.#showError('Failed to set primary image');
        }
    }

    async deleteImage(imageId) {
        try {
            if (!confirm('Are you sure you want to delete this image?')) {
                return;
            }

            if (!this.supabaseClient.supabase) {
                this.#showError('Database not configured');
                return;
            }

            const { data: imageData, error: fetchError } = await this.supabaseClient.supabase
                .from('property_images')
                .select('image_url')
                .eq('id', imageId)
                .single();

            if (fetchError) throw fetchError;

            const { error: dbError } = await this.supabaseClient.supabase
                .from('property_images')
                .delete()
                .eq('id', imageId);

            if (dbError) throw dbError;

            if (imageData?.image_url) {
                const url = new URL(imageData.image_url);
                const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/property-images\/(.+)/);
                if (pathMatch) {
                    const filePath = pathMatch[1];
                    await this.supabaseClient.supabase
                        .storage
                        .from('property-images')
                        .remove([filePath]);
                }
            }

            this.#showSuccess('Image deleted successfully');

            if (this.editPropertyId) {
                await this.#loadProperty(this.editPropertyId);
            }

        } catch (error) {
            this.#showError('Failed to delete image');
        }
    }

    async #handleDeleteProperty() {
        if (!this.editPropertyId) return;

        const confirmed = confirm('Are you sure you want to delete this property? This action cannot be undone.');
        if (!confirmed) return;

        try {
            if (!this.supabaseClient.supabase) {
                this.#showError('Database not configured');
                return;
            }

            this.deleteBtn.disabled = true;
            this.deleteBtn.textContent = 'Deleting...';

            await this.#deleteAllPropertyImages(this.editPropertyId);

            const { error } = await this.supabaseClient.supabase
                .from('properties')
                .delete()
                .eq('id', this.editPropertyId)
                .eq('owner_id', this.supabaseClient.getCurrentUser()?.id);

            if (error) throw error;

            this.#showSuccess('Property deleted successfully! Redirecting...');
            setTimeout(() => { this.#safeNavigate('owner-dashboard.html'); }, 1500);

        } catch (error) {
            this.#showError('Failed to delete property. Please try again.');
            this.deleteBtn.disabled = false;
            this.deleteBtn.textContent = 'Delete Property';
        }
    }

    async #deleteAllPropertyImages(propertyId) {
        try {
            const userId = this.supabaseClient.getCurrentUser()?.id;
            if (!userId) return;

            const { data: files, error: listError } = await this.supabaseClient.supabase
                .storage
                .from('property-images')
                .list(`properties/${userId}/${propertyId}`, { recursive: true });

            if (listError) {
                return;
            }

            if (!files || files.length === 0) return;

            const filesToDelete = files.map(file => `properties/${userId}/${propertyId}/${file.name}`);

            const { error: deleteError } = await this.supabaseClient.supabase
                .storage
                .from('property-images')
                .remove(filesToDelete);

            if (deleteError) {
            }

        } catch (error) {
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('property-form.html')) {
        window.propertyFormManager = new PropertyFormManager();
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PropertyFormManager;
}
