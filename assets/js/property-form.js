// Property Form Logic (Create/Edit)

class PropertyFormManager {
    constructor() {
        this.supabaseClient = window.supabaseClient;
        this.form = document.getElementById('propertyForm');
        this.formTitle = document.getElementById('formTitle');
        this.photosInput = document.getElementById('photos');
        this.saveBtn = document.getElementById('saveBtn');
        this.editPropertyId = null; // from query param ?id=

        this.init();
    }

    async init() {
        try {
            await this.supabaseClient.waitForInit();

            if (!this.supabaseClient.isAuthenticated()) {
                window.location.href = 'login.html';
                return;
            }

            // Restrict to owners only
            const userType = this.supabaseClient.getCurrentUser()?.user_metadata?.account_type;
            if (userType !== 'owner') {
                this.showError('Access denied. Owner account required.');
                setTimeout(() => { this.safeNavigate('index.html'); }, 800);
                return;
            }

            this.parseQueryParams();
            this.setupEventListeners();

            if (this.editPropertyId) {
                this.formTitle.textContent = 'Edit Property';
                await this.loadProperty(this.editPropertyId);
            }
        } catch (error) {
            console.error('Property form initialization error:', error);
            this.showError('Failed to initialize property form. Please refresh the page.');
        }
    }

    parseQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) this.editPropertyId = id;
    }

    setupEventListeners() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit();
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try { await this.supabaseClient.signOut(); } catch {}
            });
        }
    }

    async loadProperty(propertyId) {
        try {
            const { data, error } = await this.supabaseClient.supabase
                .from('properties')
                .select('*')
                .eq('id', propertyId)
                .single();

            if (error) throw error;

            // Basic client-side ownership check (RLS also enforces this)
            const uid = this.supabaseClient.getCurrentUser()?.id;
            if (data.owner_id && data.owner_id !== uid) {
                this.showError('You are not allowed to edit this property.');
                setTimeout(() => { this.safeNavigate('owner-dashboard.html'); }, 800);
                return;
            }

            this.fillForm(data);
        } catch (error) {
            console.error('Failed to load property:', error);
            this.showError('Could not load property for editing.');
        }
    }

    fillForm(p) {
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

        // Amenities
        if (Array.isArray(p.amenities)) {
            document.querySelectorAll('.amenity').forEach(cb => {
                cb.checked = p.amenities.includes(cb.value);
            });
        }
    }

    collectFormData() {
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
            is_active: true
        };

        // Basic required validation
        const required = ['title','property_type','view_type','description','address','city','state','country','max_guests','base_price'];
        for (const key of required) {
            if (!data[key] && data[key] !== 0) {
                this.showError(`Missing required field: ${key.replace('_',' ')}`);
                return null;
            }
        }

        return data;
    }

    async handleSubmit() {
        if (!this.supabaseClient.supabase) {
            this.showError('Supabase is not configured.');
            return;
        }

        const user = this.supabaseClient.getCurrentUser();
        if (!user) {
            this.showError('You must be logged in.');
            return;
        }

        const data = this.collectFormData();
        if (!data) return;

        // Disable button during submit
        this.saveBtn.disabled = true;
        this.saveBtn.textContent = 'Saving...';

        try {
            let propertyId = this.editPropertyId;
            if (!propertyId) {
                // Insert new property
                const payload = { ...data, owner_id: user.id };
                const { data: inserted, error } = await this.supabaseClient.supabase
                    .from('properties')
                    .insert([payload])
                    .select('id')
                    .single();
                if (error) throw error;
                propertyId = inserted.id;
            } else {
                // Update existing
                const { error } = await this.supabaseClient.supabase
                    .from('properties')
                    .update(data)
                    .eq('id', propertyId);
                if (error) throw error;
            }

            // Upload images if provided
            if (this.photosInput && this.photosInput.files && this.photosInput.files.length > 0) {
                await this.uploadImages(propertyId, Array.from(this.photosInput.files));
            }

            this.showSuccess('Property saved successfully!');
            setTimeout(() => { window.location.href = 'owner-dashboard.html'; }, 800);
        } catch (error) {
            console.error('Failed to save property:', error);
            this.showError(error.message || 'Failed to save property.');
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = 'Save Property';
        }
    }

    async uploadImages(propertyId, files) {
        // Security: enforce limits and types
        const MAX_FILES = 10;
        const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

        if (files.length > MAX_FILES) {
            this.showError(`Please upload ${MAX_FILES} images or fewer.`);
            files = files.slice(0, MAX_FILES);
        }

        const userId = this.supabaseClient.getCurrentUser()?.id;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!ALLOWED_TYPES.includes(file.type)) {
                this.showError(`Unsupported file type: ${file.type || 'unknown'}`);
                continue;
            }
            if (file.size > MAX_SIZE_BYTES) {
                this.showError(`File too large: ${file.name}`);
                continue;
            }

            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const safeTs = Date.now();
            // Path includes user id so storage policy can restrict writes
            const path = `properties/${userId}/${propertyId}/gallery/${safeTs}_${i}.${ext}`;

            const { error: uploadError } = await this.supabaseClient.supabase
                .storage.from('property-images')
                .upload(path, file, { upsert: false, contentType: file.type });

            if (uploadError) throw uploadError;

            const { data: publicUrl } = this.supabaseClient.supabase
                .storage.from('property-images')
                .getPublicUrl(path);

            // Save image record
            const { error: imageError } = await this.supabaseClient.supabase
                .from('property_images')
                .insert([{ property_id: propertyId, image_url: publicUrl.publicUrl, is_primary: i === 0 }]);

            if (imageError) throw imageError;
        }
    }

    safeNavigate(relative) {
        if (window.location.protocol === 'file:') {
            const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            window.location.href = `${currentDir}/${relative}`;
        } else {
            window.location.href = relative;
        }
    }

    showError(message) {
        this.showBanner(message, 'error');
    }

    showSuccess(message) {
        this.showBanner(message, 'success');
    }

    showBanner(message, type) {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        alert.style.position = 'fixed';
        alert.style.top = '20px';
        alert.style.right = '20px';
        alert.style.zIndex = '10000';
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 3000);
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


