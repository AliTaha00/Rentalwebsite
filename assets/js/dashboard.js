'use strict';

class DashboardManager {
    #supabaseClient;
    #userProfile = null;
    #userType = null;
    #isLoaded = false;

    constructor() {
        this.#supabaseClient = window.supabaseClient;
        this.#init();
    }

    async #init() {
        try {
            await this.#supabaseClient.waitForInit();

            if (this.#checkAuthentication()) {
                this.#setupEventListeners();
                this.#loadUserData();
                this.#determineUserType();
            }
        } catch (error) {
            this.#showError('Failed to initialize dashboard. Please refresh the page.');
        }
    }

    #checkAuthentication() {
        if (!this.#supabaseClient.isAuthenticated()) {
            setTimeout(() => {
                if (!this.#supabaseClient.isAuthenticated()) {
                    window.location.href = 'login.html';
                } else {
                    this.#setupEventListeners();
                    this.#loadUserData();
                    this.#determineUserType();
                }
            }, 1000);
            return false;
        }
        return true;
    }

    #setupEventListeners() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.#handleLogout());
        }

        // Dashboard logout button
        const dashboardLogoutBtn = document.getElementById('dashboardLogoutBtn');
        if (dashboardLogoutBtn) {
            dashboardLogoutBtn.addEventListener('click', () => this.#handleLogout());
        }

        this.#setupQuickActions();
    }

    #setupQuickActions() {
        const quickActionBtns = document.querySelectorAll('.quick-actions .btn');
        quickActionBtns.forEach(btn => {
            if (btn.textContent.includes('Add New Property')) {
                btn.addEventListener('click', () => this.#navigateToPropertyForm());
            } else if (btn.textContent.includes('Edit Profile')) {
                btn.addEventListener('click', () => this.#handleEditProfile());
            }
        });
    }

    #determineUserType() {
        const currentPath = window.location.pathname;
        if (currentPath.includes('owner-dashboard')) {
            this.#userType = 'owner';
        } else if (currentPath.includes('renter-dashboard')) {
            this.#userType = 'renter';
        }
    }

    async #loadUserData() {
        if (this.#isLoaded) {
            return;
        }

        try {
            const user = this.#supabaseClient.getCurrentUser();

            if (!user) {
                return;
            }

            this.#isLoaded = true;

            this.#updateUserNameDisplay(user);

            if (this.#supabaseClient.supabase) {
                await this.#loadUserProfile(user.id);
                await this.#loadDashboardData();
            } else {
                this.#loadSampleData();
            }

        } catch (error) {
            this.#showError('Failed to load dashboard data');
        }
    }

    #updateUserNameDisplay(user) {
        const firstName = user.user_metadata?.first_name ||
                        user.user_metadata?.firstName ||
                        user.email?.split('@')[0] ||
                        'User';
        
        const sanitizedName = this.#sanitize(firstName);
        const email = user.email || 'user@example.com';
        
        // Update main userName if it exists
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = sanitizedName;
        }
        
        // Update sidebar userName (old layout)
        const userNameSidebarElement = document.getElementById('userNameSidebar');
        if (userNameSidebarElement) {
            userNameSidebarElement.textContent = sanitizedName;
        }
        
        // Update sidebar profile (new layout)
        const sidebarProfileName = document.getElementById('sidebarProfileName');
        if (sidebarProfileName) {
            sidebarProfileName.textContent = sanitizedName;
        }
        
        const sidebarProfileEmail = document.getElementById('sidebarProfileEmail');
        if (sidebarProfileEmail) {
            sidebarProfileEmail.textContent = this.#sanitize(email);
        }
        
        // Update profile avatar initials
        const initials = sanitizedName.charAt(0).toUpperCase();
        const profileAvatarInitials = document.getElementById('profileAvatarInitials');
        if (profileAvatarInitials) {
            profileAvatarInitials.textContent = initials;
        }
    }

    async #loadUserProfile(userId) {
        try {
            const { data, error } = await this.#supabaseClient.supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                await this.#createUserProfile(userId);
                return;
            }

            this.#userProfile = data;

            if (data.first_name) {
                const sanitizedName = this.#sanitize(data.first_name);
                
                const userNameElement = document.getElementById('userName');
                if (userNameElement) {
                    userNameElement.textContent = sanitizedName;
                }
                
                const userNameSidebarElement = document.getElementById('userNameSidebar');
                if (userNameSidebarElement) {
                    userNameSidebarElement.textContent = sanitizedName;
                }
            }

        } catch (error) {
        }
    }

    async #createUserProfile(userId) {
        try {
            const user = this.#supabaseClient.getCurrentUser();
            const metadata = user.user_metadata || {};

            const profileData = {
                user_id: userId,
                email: user.email?.toLowerCase().trim(),
                first_name: metadata.first_name || metadata.firstName || '',
                last_name: metadata.last_name || metadata.lastName || '',
                phone: metadata.phone || '',
                account_type: metadata.account_type || this.#userType || 'renter',
                business_name: metadata.business_name || metadata.businessName || null,
                is_active: true,
                email_verified: !!user.email_confirmed_at,
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.#supabaseClient.supabase
                .from('user_profiles')
                .insert([profileData])
                .select()
                .single();

            if (error) throw error;

            this.#userProfile = data;

        } catch (error) {
        }
    }

    async #loadDashboardData() {
        if (this.#userType === 'owner') {
            await this.#loadOwnerData();
        } else {
            await this.#loadRenterData();
        }
    }

    async #loadOwnerData() {
        try {
            const userId = this.#supabaseClient.getCurrentUser()?.id;

            const { data: properties, error: propertiesError } = await this.#supabaseClient.supabase
                .from('properties')
                .select('*, property_images(image_url, is_primary)')
                .eq('owner_id', userId)
                .eq('is_active', true);

            if (propertiesError) throw propertiesError;

            const { data: bookings, error: bookingsError } = await this.#supabaseClient.supabase
                .from('bookings')
                .select(`
                    *,
                    properties(title, city, state),
                    user_profiles!bookings_guest_id_fkey(first_name, last_name, email)
                `)
                .eq('owner_id', userId)
                .order('created_at', { ascending: false });

            if (bookingsError) throw bookingsError;

            const { data: reviews, error: reviewsError } = await this.#supabaseClient.supabase
                .from('reviews')
                .select('overall_rating')
                .eq('reviewee_id', userId)
                .eq('review_type', 'guest_to_owner');

            if (reviewsError) throw reviewsError;

            this.#updateOwnerStats(properties, bookings, reviews);
            this.#updatePropertiesGrid(properties);
            this.#updateBookingRequests(bookings);
            this.#setupAvailabilityCalendar(properties);

        } catch (error) {
            this.#loadSampleOwnerData();
        }
    }

    async #loadRenterData() {
        try {
            const userId = this.#supabaseClient.getCurrentUser()?.id;

            const { data: bookings, error: bookingsError } = await this.#supabaseClient.supabase
                .from('bookings')
                .select(`
                    *,
                    properties(title, city, state, property_images(image_url, is_primary))
                `)
                .eq('guest_id', userId)
                .order('created_at', { ascending: false });

            if (bookingsError) throw bookingsError;

            const { data: wishlist, error: wishlistError } = await this.#supabaseClient.supabase
                .from('wishlists')
                .select(`
                    id,
                    property_id,
                    created_at,
                    properties (
                        id,
                        title,
                        city,
                        state,
                        base_price,
                        view_type
                    )
                `)
                .eq('user_id', userId);

            if (wishlistError) {
                console.error('Wishlist error:', wishlistError);
                throw wishlistError;
            }

            console.log('Wishlist data fetched:', wishlist);

            const { data: reviews, error: reviewsError } = await this.#supabaseClient.supabase
                .from('reviews')
                .select('*')
                .eq('reviewer_id', userId)
                .eq('review_type', 'guest_to_owner');

            if (reviewsError) throw reviewsError;

            this.#updateRenterStats(bookings, wishlist, reviews);
            this.#updateRenterBookings(bookings);
            this.#updateWishlist(wishlist);

        } catch (error) {
            this.#loadSampleRenterData();
        }
    }

    #updateOwnerStats(properties, bookings, reviews) {
        const totalPropertiesEl = document.getElementById('totalProperties');
        if (totalPropertiesEl) {
            totalPropertiesEl.textContent = properties.length;
        }

        const pendingBookings = bookings.filter(b => b.status === 'pending').length;
        const pendingBookingsEl = document.getElementById('pendingBookings');
        if (pendingBookingsEl) {
            pendingBookingsEl.textContent = pendingBookings;
        }

        const activeBookings = bookings.filter(b => b.status === 'confirmed').length;
        const activeBookingsEl = document.getElementById('activeBookings');
        if (activeBookingsEl) {
            activeBookingsEl.textContent = activeBookings;
        }

        const monthlyEarningsEl = document.getElementById('monthlyEarnings');
        if (monthlyEarningsEl) {
            const thisMonth = new Date().getMonth();
            const thisYear = new Date().getFullYear();
            const monthlyBookings = bookings.filter(b => {
                const bookingDate = new Date(b.created_at);
                return bookingDate.getMonth() === thisMonth &&
                       bookingDate.getFullYear() === thisYear &&
                       b.status === 'completed';
            });
            const earnings = monthlyBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
            monthlyEarningsEl.textContent = `$${earnings.toFixed(0)}`;
        }

        const averageRatingEl = document.getElementById('averageRating');
        if (averageRatingEl && reviews.length > 0) {
            const avgRating = reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length;
            averageRatingEl.textContent = avgRating.toFixed(1);
        }
    }

    #updateRenterStats(bookings, wishlist, reviews) {
        const upcomingBookings = bookings.filter(b =>
            b.status === 'confirmed' && new Date(b.check_in_date) > new Date()
        ).length;
        const upcomingBookingsEl = document.getElementById('upcomingBookings');
        if (upcomingBookingsEl) {
            upcomingBookingsEl.textContent = upcomingBookings;
        }

        const completedBookings = bookings.filter(b => b.status === 'completed').length;
        const completedBookingsEl = document.getElementById('completedBookings');
        if (completedBookingsEl) {
            completedBookingsEl.textContent = completedBookings;
        }

        const wishlistCountEl = document.getElementById('wishlistCount');
        if (wishlistCountEl) {
            wishlistCountEl.textContent = wishlist.length;
        }

        const reviewsGivenEl = document.getElementById('reviewsGiven');
        if (reviewsGivenEl) {
            reviewsGivenEl.textContent = reviews.length;
        }
    }

    #updatePropertiesGrid(properties) {
        const propertiesGrid = document.getElementById('propertiesGrid');
        if (!propertiesGrid) return;

        if (properties.length === 0) {
            return;
        }

        propertiesGrid.innerHTML = '';

        properties.forEach(property => {
            const propertyCard = this.#createPropertyCard(property);
            propertiesGrid.appendChild(propertyCard);
        });
    }

    #createPropertyCard(property) {
        const card = document.createElement('div');
        card.className = 'property-card-dashboard';

        const primaryImage = property.property_images?.find(img => img.is_primary);
        const imageUrl = primaryImage?.image_url;
        const title = this.#sanitize(property.title);
        const city = this.#sanitize(property.city);
        const state = this.#sanitize(property.state);
        const price = parseFloat(property.base_price) || 0;

        const statusDiv = document.createElement('div');
        statusDiv.className = `property-status ${property.is_active ? 'active' : 'inactive'}`;
        statusDiv.setAttribute('data-action', 'toggle-status');
        statusDiv.setAttribute('data-id', property.id);
        statusDiv.style.cursor = 'pointer';
        statusDiv.title = `Click to ${property.is_active ? 'deactivate' : 'activate'}`;
        statusDiv.textContent = property.is_active ? 'Active' : 'Inactive';

        if (imageUrl) {
            const img = document.createElement('img');
            img.src = this.#sanitize(imageUrl);
            img.alt = title;
            img.style.cssText = 'width: 100%; height: 200px; object-fit: cover; border-radius: 6px; margin-bottom: 1rem;';
            card.appendChild(img);
        }

        const titleEl = document.createElement('h4');
        titleEl.textContent = title;

        const locationEl = document.createElement('p');
        locationEl.textContent = `${city}, ${state}`;

        const priceEl = document.createElement('p');
        const priceStrong = document.createElement('strong');
        priceStrong.textContent = `$${price}/night`;
        priceEl.appendChild(priceStrong);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'property-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary';
        editBtn.textContent = 'Edit';
        editBtn.setAttribute('data-action', 'edit');
        editBtn.setAttribute('data-id', property.id);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.setAttribute('data-action', 'delete');
        deleteBtn.setAttribute('data-id', property.id);

        const analyticsBtn = document.createElement('button');
        analyticsBtn.className = 'btn btn-primary';
        analyticsBtn.textContent = 'Analytics';
        analyticsBtn.setAttribute('data-action', 'analytics');
        analyticsBtn.setAttribute('data-id', property.id);

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        actionsDiv.appendChild(analyticsBtn);

        card.appendChild(statusDiv);
        card.appendChild(titleEl);
        card.appendChild(locationEl);
        card.appendChild(priceEl);
        card.appendChild(actionsDiv);

        editBtn.addEventListener('click', () => this.#navigateToPropertyForm(property.id));
        deleteBtn.addEventListener('click', () => this.#handleDeleteProperty(property.id, property.title));
        statusDiv.addEventListener('click', () => this.#handleTogglePropertyStatus(property.id, property.is_active));

        return card;
    }

    #loadSampleData() {
        if (this.#userType === 'owner') {
            this.#loadSampleOwnerData();
        } else {
            this.#loadSampleRenterData();
        }
    }

    #loadSampleOwnerData() {
        const elements = [
            { id: 'totalProperties', value: '2' },
            { id: 'activeBookings', value: '5' },
            { id: 'monthlyEarnings', value: '$1,250' },
            { id: 'averageRating', value: '4.8' }
        ];

        elements.forEach(({ id, value }) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    #loadSampleRenterData() {
        const elements = [
            { id: 'upcomingBookings', value: '1' },
            { id: 'completedBookings', value: '3' },
            { id: 'wishlistCount', value: '7' },
            { id: 'reviewsGiven', value: '3' }
        ];

        elements.forEach(({ id, value }) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    async #handleLogout() {
        try {
            await this.#supabaseClient.waitForInit();
            await this.#supabaseClient.signOut();
        } catch (error) {
            if (!error.message.includes('session')) {
                this.#showError('Failed to logout: ' + error.message);
            } else {
                this.#supabaseClient.redirectToHome();
            }
        }
    }

    #navigateToPropertyForm(propertyId = null) {
        const base = 'property-form.html';
        if (window.location.protocol === 'file:') {
            const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            const target = propertyId ? `${currentDir}/${base}?id=${encodeURIComponent(propertyId)}` : `${currentDir}/${base}`;
            window.location.href = target;
        } else {
            const target = propertyId ? `${base}?id=${encodeURIComponent(propertyId)}` : base;
            window.location.href = target;
        }
    }

    #handleEditProfile() {
        this.#showNotification('Profile editing feature coming soon!', 'info');
    }

    async #handleDeleteProperty(propertyId, propertyTitle) {
        const confirmed = await this.#showConfirmDialog(
            'Delete Property',
            `Are you sure you want to delete "${this.#sanitize(propertyTitle)}"? This action cannot be undone.`,
            'Delete',
            'btn-danger'
        );

        if (!confirmed) return;

        try {
            if (!this.#supabaseClient.supabase) {
                this.#showError('Database not configured');
                return;
            }

            await this.#deletePropertyImages(propertyId);

            const { error } = await this.#supabaseClient.supabase
                .from('properties')
                .delete()
                .eq('id', propertyId)
                .eq('owner_id', this.#supabaseClient.getCurrentUser()?.id);

            if (error) throw error;

            this.#showNotification('Property deleted successfully', 'success');

            this.#isLoaded = false;
            this.#loadUserData();

        } catch (error) {
            this.#showError('Failed to delete property. Please try again.');
        }
    }

    async #deletePropertyImages(propertyId) {
        try {
            const userId = this.#supabaseClient.getCurrentUser()?.id;
            if (!userId) return;

            const { data: files, error: listError } = await this.#supabaseClient.supabase
                .storage
                .from('property-images')
                .list(`properties/${userId}/${propertyId}`, { recursive: true });

            if (listError) {
                return;
            }

            if (!files || files.length === 0) return;

            const filesToDelete = files.map(file => `properties/${userId}/${propertyId}/${file.name}`);

            await this.#supabaseClient.supabase
                .storage
                .from('property-images')
                .remove(filesToDelete);

        } catch (error) {
        }
    }

    async #handleTogglePropertyStatus(propertyId, currentStatus) {
        const newStatus = !currentStatus;
        const action = newStatus ? 'activate' : 'deactivate';

        try {
            if (!this.#supabaseClient.supabase) {
                this.#showError('Database not configured');
                return;
            }

            const { error } = await this.#supabaseClient.supabase
                .from('properties')
                .update({ is_active: newStatus })
                .eq('id', propertyId)
                .eq('owner_id', this.#supabaseClient.getCurrentUser()?.id);

            if (error) throw error;

            this.#showNotification(`Property ${action}d successfully`, 'success');

            this.#isLoaded = false;
            this.#loadUserData();

        } catch (error) {
            this.#showError(`Failed to ${action} property. Please try again.`);
        }
    }

    #showConfirmDialog(title, message, confirmText = 'Confirm', buttonClass = 'btn-primary') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white;
                padding: 2rem;
                border-radius: 8px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            `;

            const titleEl = document.createElement('h3');
            titleEl.style.cssText = 'margin-top: 0; margin-bottom: 1rem;';
            titleEl.textContent = title;

            const messageEl = document.createElement('p');
            messageEl.style.cssText = 'margin-bottom: 2rem;';
            messageEl.textContent = message;

            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = 'display: flex; gap: 1rem; justify-content: flex-end;';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = 'Cancel';

            const confirmBtn = document.createElement('button');
            confirmBtn.className = `btn ${buttonClass}`;
            confirmBtn.textContent = confirmText;

            actionsDiv.appendChild(cancelBtn);
            actionsDiv.appendChild(confirmBtn);

            modal.appendChild(titleEl);
            modal.appendChild(messageEl);
            modal.appendChild(actionsDiv);

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const cleanup = () => {
                document.body.removeChild(overlay);
            };

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            });

            confirmBtn.focus();
        });
    }

    #showNotification(message, type = 'info') {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(message, type);
            return;
        }
        const fallback = document.createElement('div');
        fallback.className = `alert alert-${type}`;
        fallback.textContent = message;
        document.body.appendChild(fallback);
        setTimeout(() => fallback.remove(), 3000);
    }

    #showError(message) {
        this.#showNotification(message, 'error');
    }

    #updateBookingRequests(bookings) {
        const bookingRequestsContainer = document.getElementById('bookingRequestsContainer');
        if (!bookingRequestsContainer) return;

        const pendingBookings = bookings.filter(b => b.status === 'pending');
        const recentBookings = bookings.filter(b => ['confirmed', 'completed'].includes(b.status)).slice(0, 5);

        if (pendingBookings.length === 0 && recentBookings.length === 0) {
            const noBookingsDiv = document.createElement('div');
            noBookingsDiv.className = 'no-bookings';
            const p = document.createElement('p');
            const em = document.createElement('em');
            em.textContent = 'No booking requests yet.';
            p.appendChild(em);
            noBookingsDiv.appendChild(p);
            bookingRequestsContainer.innerHTML = '';
            bookingRequestsContainer.appendChild(noBookingsDiv);
            return;
        }

        bookingRequestsContainer.innerHTML = '';

        if (pendingBookings.length > 0) {
            const pendingSection = this.#createBookingSection(
                `⏳ Pending Requests (${pendingBookings.length})`,
                pendingBookings,
                true,
                '#f39c12'
            );
            bookingRequestsContainer.appendChild(pendingSection);
        }

        if (recentBookings.length > 0) {
            const recentSection = this.#createBookingSection(
                '📅 Recent Bookings',
                recentBookings,
                false
            );
            recentSection.style.marginTop = '2rem';
            bookingRequestsContainer.appendChild(recentSection);
        }

        this.#setupBookingActions();
    }

    #createBookingSection(title, bookings, isPending, titleColor = null) {
        const section = document.createElement('div');
        section.className = 'booking-section';

        const h4 = document.createElement('h4');
        h4.style.marginBottom = '1rem';
        if (titleColor) {
            h4.style.color = titleColor;
        }
        h4.textContent = title;

        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'booking-cards';

        bookings.forEach(booking => {
            const card = this.#createBookingCardElement(booking, isPending);
            cardsDiv.appendChild(card);
        });

        section.appendChild(h4);
        section.appendChild(cardsDiv);

        return section;
    }

    #createBookingCardElement(booking, isPending) {
        const card = document.createElement('div');
        card.className = 'booking-card';
        card.style.cssText = `
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;

        const guest = booking.user_profiles;
        const property = booking.properties;
        const checkIn = new Date(booking.check_in_date);
        const checkOut = new Date(booking.check_out_date);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        const statusColors = {
            pending: '#f39c12',
            confirmed: '#27ae60',
            completed: '#3498db',
            cancelled: '#e74c3c'
        };

        const headerDiv = document.createElement('div');
        headerDiv.className = 'booking-header';
        headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;';

        const headerInfo = document.createElement('div');
        const h5 = document.createElement('h5');
        h5.style.cssText = 'margin: 0 0 0.25rem 0; color: #2c3e50;';
        h5.textContent = this.#sanitize(property?.title || 'Property');

        const guestP = document.createElement('p');
        guestP.style.cssText = 'margin: 0; color: #666; font-size: 0.9rem;';
        guestP.textContent = `${this.#sanitize(guest?.first_name || 'Guest')} ${this.#sanitize(guest?.last_name || '')}`;

        headerInfo.appendChild(h5);
        headerInfo.appendChild(guestP);

        const statusSpan = document.createElement('span');
        statusSpan.className = 'booking-status';
        statusSpan.style.cssText = `
            background: ${statusColors[booking.status] || '#95a5a6'};
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
            text-transform: capitalize;
        `;
        statusSpan.textContent = booking.status;

        headerDiv.appendChild(headerInfo);
        headerDiv.appendChild(statusSpan);

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'booking-details';
        detailsDiv.style.marginBottom = '0.75rem';

        const detailsGrid = document.createElement('div');
        detailsGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.9rem;';

        const checkInDiv = document.createElement('div');
        checkInDiv.innerHTML = `<strong>Check-in:</strong> ${this.#formatDate(booking.check_in_date)}`;

        const checkOutDiv = document.createElement('div');
        checkOutDiv.innerHTML = `<strong>Check-out:</strong> ${this.#formatDate(booking.check_out_date)}`;

        const guestsDiv = document.createElement('div');
        guestsDiv.innerHTML = `<strong>Guests:</strong> ${parseInt(booking.num_guests) || 0}`;

        const nightsDiv = document.createElement('div');
        nightsDiv.innerHTML = `<strong>Nights:</strong> ${nights}`;

        detailsGrid.appendChild(checkInDiv);
        detailsGrid.appendChild(checkOutDiv);
        detailsGrid.appendChild(guestsDiv);
        detailsGrid.appendChild(nightsDiv);

        const totalDiv = document.createElement('div');
        totalDiv.style.cssText = 'margin-top: 0.5rem; font-weight: 500; color: #27ae60;';
        totalDiv.textContent = `Total: $${parseFloat(booking.total_amount) || 0}`;

        detailsDiv.appendChild(detailsGrid);
        detailsDiv.appendChild(totalDiv);

        if (booking.special_requests) {
            const requestsDiv = document.createElement('div');
            requestsDiv.style.cssText = 'margin-top: 0.5rem; padding: 0.5rem; background: #f8f9fa; border-radius: 4px; font-size: 0.85rem;';
            requestsDiv.innerHTML = `<strong>Special Requests:</strong> ${this.#sanitize(booking.special_requests)}`;
            detailsDiv.appendChild(requestsDiv);
        }

        card.appendChild(headerDiv);
        card.appendChild(detailsDiv);

        if (isPending) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'booking-actions';
            actionsDiv.style.cssText = 'display: flex; gap: 0.5rem;';

            const approveBtn = document.createElement('button');
            approveBtn.className = 'btn btn-success';
            approveBtn.setAttribute('data-action', 'approve');
            approveBtn.setAttribute('data-booking-id', booking.id);
            approveBtn.style.cssText = 'flex: 1; padding: 0.5rem; font-size: 0.85rem;';
            approveBtn.textContent = '✓ Approve';

            const declineBtn = document.createElement('button');
            declineBtn.className = 'btn btn-danger';
            declineBtn.setAttribute('data-action', 'decline');
            declineBtn.setAttribute('data-booking-id', booking.id);
            declineBtn.style.cssText = 'flex: 1; padding: 0.5rem; font-size: 0.85rem;';
            declineBtn.textContent = '✗ Decline';

            const messageBtn = document.createElement('button');
            messageBtn.className = 'btn btn-secondary';
            messageBtn.setAttribute('data-action', 'message');
            messageBtn.setAttribute('data-booking-id', booking.id);
            messageBtn.style.cssText = 'padding: 0.5rem; font-size: 0.85rem;';
            messageBtn.textContent = '💬';

            actionsDiv.appendChild(approveBtn);
            actionsDiv.appendChild(declineBtn);
            actionsDiv.appendChild(messageBtn);

            card.appendChild(actionsDiv);
        } else {
            const infoDiv = document.createElement('div');
            infoDiv.className = 'booking-info';
            infoDiv.style.cssText = 'font-size: 0.8rem; color: #666;';
            infoDiv.textContent = `Booked on ${this.#formatDate(booking.created_at)}`;
            card.appendChild(infoDiv);
        }

        return card;
    }

    #setupBookingActions() {
        document.querySelectorAll('[data-action="approve"]').forEach(btn => {
            btn.addEventListener('click', () => this.#handleBookingAction(btn.dataset.bookingId, 'approve'));
        });

        document.querySelectorAll('[data-action="decline"]').forEach(btn => {
            btn.addEventListener('click', () => this.#handleBookingAction(btn.dataset.bookingId, 'decline'));
        });

        document.querySelectorAll('[data-action="message"]').forEach(btn => {
            btn.addEventListener('click', () => this.#handleBookingMessage(btn.dataset.bookingId));
        });
    }

    async #handleBookingAction(bookingId, action) {
        const newStatus = action === 'approve' ? 'confirmed' : 'cancelled';
        const actionText = action === 'approve' ? 'approve' : 'decline';

        const confirmed = await this.#showConfirmDialog(
            `${action === 'approve' ? 'Approve' : 'Decline'} Booking`,
            `Are you sure you want to ${actionText} this booking request?`,
            action === 'approve' ? 'Approve' : 'Decline',
            action === 'approve' ? 'btn-success' : 'btn-danger'
        );

        if (!confirmed) return;

        try {
            const { error } = await this.#supabaseClient.supabase
                .from('bookings')
                .update({
                    status: newStatus,
                    confirmed_at: action === 'approve' ? new Date().toISOString() : null
                })
                .eq('id', bookingId)
                .eq('owner_id', this.#supabaseClient.getCurrentUser()?.id);

            if (error) throw error;

            this.#showNotification(`Booking ${action}d successfully!`, 'success');

            this.#isLoaded = false;
            this.#loadUserData();

        } catch (error) {
            this.#showError(`Failed to ${actionText} booking. Please try again.`);
        }
    }

    #handleBookingMessage(bookingId) {
        this.#showNotification('Messaging feature coming soon!', 'info');
    }

    #setupAvailabilityCalendar(properties) {
        const propertySelect = document.getElementById('calendarPropertySelect');
        const bulkBtn = document.getElementById('bulkAvailabilityBtn');

        if (!propertySelect) return;

        propertySelect.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a property...';
        propertySelect.appendChild(defaultOption);

        properties.forEach(property => {
            const option = document.createElement('option');
            option.value = property.id;
            option.textContent = `${this.#sanitize(property.title)} - ${this.#sanitize(property.city)}, ${this.#sanitize(property.state)}`;
            propertySelect.appendChild(option);
        });

        propertySelect.addEventListener('change', (e) => {
            const propertyId = e.target.value;
            if (propertyId) {
                this.#loadPropertyCalendar(propertyId);
                if (bulkBtn) bulkBtn.disabled = false;
            } else {
                this.#clearCalendar();
                if (bulkBtn) bulkBtn.disabled = true;
            }
        });

        if (bulkBtn) {
            bulkBtn.addEventListener('click', () => {
                const propertyId = propertySelect.value;
                if (propertyId) {
                    this.#showBulkAvailabilityModal(propertyId);
                }
            });
        }
    }

    async #loadPropertyCalendar(propertyId) {
        try {
            const container = document.getElementById('availabilityCalendarContainer');
            if (!container) return;

            container.textContent = 'Loading calendar...';
            container.style.cssText = 'text-align: center; padding: 2rem;';

            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 12);

            const [availabilityResult, bookingsResult] = await Promise.all([
                this.#supabaseClient.supabase
                    .from('property_availability')
                    .select('*')
                    .eq('property_id', propertyId)
                    .gte('date', startDate.toISOString().split('T')[0])
                    .lte('date', endDate.toISOString().split('T')[0]),

                this.#supabaseClient.supabase
                    .from('bookings')
                    .select('check_in_date, check_out_date, status')
                    .eq('property_id', propertyId)
                    .in('status', ['confirmed', 'pending'])
                    .gte('check_in_date', startDate.toISOString().split('T')[0])
                    .lte('check_out_date', endDate.toISOString().split('T')[0])
            ]);

            if (availabilityResult.error) throw availabilityResult.error;
            if (bookingsResult.error) throw bookingsResult.error;

            this.#renderCalendar(propertyId, availabilityResult.data || [], bookingsResult.data || []);

        } catch (error) {
            const container = document.getElementById('availabilityCalendarContainer');
            if (container) {
                container.textContent = 'Error loading calendar. Please try again.';
                container.style.cssText = 'text-align: center; padding: 2rem; color: #e74c3c;';
            }
        }
    }

    #renderCalendar(propertyId, availabilityData, bookingsData) {
        const container = document.getElementById('availabilityCalendarContainer');
        if (!container) return;

        container.innerHTML = '';

        const legend = this.#createCalendarLegend();
        container.appendChild(legend);

        const grid = document.createElement('div');
        grid.className = 'calendar-grid';
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;';

        const currentDate = new Date();

        for (let i = 0; i < 6; i++) {
            const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
            const monthEl = this.#renderMonth(monthDate, propertyId, availabilityData, bookingsData);
            grid.appendChild(monthEl);
        }

        container.appendChild(grid);

        this.#setupCalendarClickHandlers(propertyId);
    }

    #createCalendarLegend() {
        const legend = document.createElement('div');
        legend.className = 'calendar-legend';
        legend.style.cssText = `
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 8px;
            font-size: 0.9rem;
        `;

        const items = [
            { color: '#27ae60', label: 'Available' },
            { color: '#e74c3c', label: 'Blocked' },
            { color: '#3498db', label: 'Booked' },
            { color: '#f39c12', label: 'Pending' },
            { color: '#95a5a6', label: 'Past' }
        ];

        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';

            const colorBox = document.createElement('div');
            colorBox.style.cssText = `width: 16px; height: 16px; background: ${item.color}; border-radius: 3px;`;

            const span = document.createElement('span');
            span.textContent = item.label;

            itemDiv.appendChild(colorBox);
            itemDiv.appendChild(span);
            legend.appendChild(itemDiv);
        });

        return legend;
    }

    #renderMonth(monthDate, propertyId, availabilityData, bookingsData) {
        const monthContainer = document.createElement('div');
        monthContainer.className = 'month-calendar';
        monthContainer.style.cssText = 'background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;';

        const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const header = document.createElement('div');
        header.className = 'month-header';
        header.style.cssText = 'background: #2c3e50; color: white; padding: 1rem; text-align: center; font-weight: 600;';
        header.textContent = monthName;

        const weekHeaders = document.createElement('div');
        weekHeaders.className = 'week-headers';
        weekHeaders.style.cssText = 'display: grid; grid-template-columns: repeat(7, 1fr); background: #34495e; color: white;';

        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.style.cssText = 'padding: 0.5rem; text-align: center; font-size: 0.85rem; font-weight: 500;';
            dayHeader.textContent = day;
            weekHeaders.appendChild(dayHeader);
        });

        const daysGrid = document.createElement('div');
        daysGrid.className = 'days-grid';
        daysGrid.style.cssText = 'display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: #ecf0f1;';

        const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const currentDay = new Date(startDate);

        for (let i = 0; i < 42; i++) {
            const dateStr = currentDay.toISOString().split('T')[0];
            const isCurrentMonth = currentDay.getMonth() === monthDate.getMonth();
            const isPast = currentDay < today;

            let status = 'available';
            let statusColor = '#27ae60';

            if (isPast) {
                status = 'past';
                statusColor = '#95a5a6';
            } else {
                const booking = bookingsData.find(b => {
                    const checkIn = new Date(b.check_in_date);
                    const checkOut = new Date(b.check_out_date);
                    return currentDay >= checkIn && currentDay < checkOut;
                });

                if (booking) {
                    status = booking.status === 'confirmed' ? 'booked' : 'pending';
                    statusColor = booking.status === 'confirmed' ? '#3498db' : '#f39c12';
                } else {
                    const availability = availabilityData.find(a => a.date === dateStr);
                    if (availability && !availability.is_available) {
                        status = 'blocked';
                        statusColor = '#e74c3c';
                    }
                }
            }

            const dayEl = document.createElement('div');
            dayEl.className = `calendar-day ${!isCurrentMonth ? 'other-month' : ''}`;
            dayEl.setAttribute('data-date', dateStr);
            dayEl.setAttribute('data-property-id', propertyId);
            dayEl.setAttribute('data-status', status);
            dayEl.style.cssText = `
                padding: 0.75rem 0.5rem;
                text-align: center;
                cursor: ${isPast || status === 'booked' ? 'default' : 'pointer'};
                background: ${statusColor};
                color: white;
                opacity: ${!isCurrentMonth ? '0.3' : '1'};
                border-radius: 4px;
                font-size: 0.9rem;
                transition: all 0.2s ease;
                position: relative;
            `;
            if (!(isPast || status === 'booked')) {
                dayEl.title = 'Click to toggle availability';
            }
            dayEl.textContent = currentDay.getDate();

            daysGrid.appendChild(dayEl);

            currentDay.setDate(currentDay.getDate() + 1);
        }

        monthContainer.appendChild(header);
        monthContainer.appendChild(weekHeaders);
        monthContainer.appendChild(daysGrid);

        return monthContainer;
    }

    #setupCalendarClickHandlers(propertyId) {
        document.querySelectorAll('.calendar-day').forEach(day => {
            const status = day.dataset.status;

            if (status !== 'past' && status !== 'booked' && status !== 'pending') {
                day.addEventListener('click', () => this.#toggleDateAvailability(propertyId, day));

                day.addEventListener('mouseenter', () => {
                    if (status === 'available') {
                        day.style.background = '#e74c3c';
                        day.style.transform = 'scale(1.05)';
                    } else if (status === 'blocked') {
                        day.style.background = '#27ae60';
                        day.style.transform = 'scale(1.05)';
                    }
                });

                day.addEventListener('mouseleave', () => {
                    const originalColor = status === 'available' ? '#27ae60' : '#e74c3c';
                    day.style.background = originalColor;
                    day.style.transform = 'scale(1)';
                });
            }
        });
    }

    async #toggleDateAvailability(propertyId, dayElement) {
        const date = dayElement.dataset.date;
        const currentStatus = dayElement.dataset.status;
        const newAvailable = currentStatus === 'blocked';

        try {
            const { error } = await this.#supabaseClient.supabase
                .from('property_availability')
                .upsert([{
                    property_id: propertyId,
                    date: date,
                    is_available: newAvailable
                }]);

            if (error) throw error;

            const newStatus = newAvailable ? 'available' : 'blocked';
            const newColor = newAvailable ? '#27ae60' : '#e74c3c';

            dayElement.dataset.status = newStatus;
            dayElement.style.background = newColor;

            this.#showNotification(`Date ${newAvailable ? 'unblocked' : 'blocked'} successfully`, 'success');

        } catch (error) {
            this.#showError('Failed to update availability. Please try again.');
        }
    }

    #clearCalendar() {
        const container = document.getElementById('availabilityCalendarContainer');
        if (container) {
            container.innerHTML = '';
            const emptyState = document.createElement('div');
            emptyState.className = 'calendar-empty-state';
            emptyState.style.cssText = 'text-align: center; padding: 2rem; color: #666;';
            const p = document.createElement('p');
            p.textContent = 'Select a property to manage its availability calendar.';
            emptyState.appendChild(p);
            container.appendChild(emptyState);
        }
    }

    #showBulkAvailabilityModal(propertyId) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'bulk-modal';
        modalContent.style.cssText = 'background: white; border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%;';

        const h3 = document.createElement('h3');
        h3.style.margin = '0 0 1.5rem 0';
        h3.textContent = 'Bulk Availability Update';

        const startGroup = document.createElement('div');
        startGroup.className = 'form-group';
        startGroup.style.marginBottom = '1rem';
        const startLabel = document.createElement('label');
        startLabel.style.cssText = 'display: block; margin-bottom: 0.5rem;';
        startLabel.textContent = 'Start Date:';
        const startInput = document.createElement('input');
        startInput.type = 'date';
        startInput.id = 'bulkStartDate';
        startInput.style.cssText = 'width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;';
        startGroup.appendChild(startLabel);
        startGroup.appendChild(startInput);

        const endGroup = document.createElement('div');
        endGroup.className = 'form-group';
        endGroup.style.marginBottom = '1rem';
        const endLabel = document.createElement('label');
        endLabel.style.cssText = 'display: block; margin-bottom: 0.5rem;';
        endLabel.textContent = 'End Date:';
        const endInput = document.createElement('input');
        endInput.type = 'date';
        endInput.id = 'bulkEndDate';
        endInput.style.cssText = 'width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;';
        endGroup.appendChild(endLabel);
        endGroup.appendChild(endInput);

        const actionGroup = document.createElement('div');
        actionGroup.className = 'form-group';
        actionGroup.style.marginBottom = '1.5rem';
        const actionLabel = document.createElement('label');
        actionLabel.style.cssText = 'display: block; margin-bottom: 0.5rem;';
        actionLabel.textContent = 'Action:';
        const actionSelect = document.createElement('select');
        actionSelect.id = 'bulkAction';
        actionSelect.style.cssText = 'width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;';
        const blockOption = document.createElement('option');
        blockOption.value = 'block';
        blockOption.textContent = 'Block dates (unavailable)';
        const unblockOption = document.createElement('option');
        unblockOption.value = 'unblock';
        unblockOption.textContent = 'Unblock dates (available)';
        actionSelect.appendChild(blockOption);
        actionSelect.appendChild(unblockOption);
        actionGroup.appendChild(actionLabel);
        actionGroup.appendChild(actionSelect);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'modal-actions';
        actionsDiv.style.cssText = 'display: flex; gap: 1rem;';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary bulk-cancel';
        cancelBtn.style.flex = '1';
        cancelBtn.textContent = 'Cancel';
        const applyBtn = document.createElement('button');
        applyBtn.className = 'btn btn-primary bulk-apply';
        applyBtn.style.flex = '1';
        applyBtn.textContent = 'Apply';
        actionsDiv.appendChild(cancelBtn);
        actionsDiv.appendChild(applyBtn);

        modalContent.appendChild(h3);
        modalContent.appendChild(startGroup);
        modalContent.appendChild(endGroup);
        modalContent.appendChild(actionGroup);
        modalContent.appendChild(actionsDiv);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        const today = new Date().toISOString().split('T')[0];
        startInput.min = today;
        endInput.min = today;

        cancelBtn.addEventListener('click', () => modal.remove());
        applyBtn.addEventListener('click', () => {
            this.#applyBulkAvailability(propertyId, modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    async #applyBulkAvailability(propertyId, modal) {
        const startDate = document.getElementById('bulkStartDate').value;
        const endDate = document.getElementById('bulkEndDate').value;
        const action = document.getElementById('bulkAction').value;

        if (!startDate || !endDate) {
            this.#showError('Please select both start and end dates');
            return;
        }

        if (new Date(endDate) <= new Date(startDate)) {
            this.#showError('End date must be after start date');
            return;
        }

        try {
            const isAvailable = action === 'unblock';
            const dates = [];
            const current = new Date(startDate);
            const end = new Date(endDate);

            while (current <= end) {
                dates.push({
                    property_id: propertyId,
                    date: current.toISOString().split('T')[0],
                    is_available: isAvailable
                });
                current.setDate(current.getDate() + 1);
            }

            const { error } = await this.#supabaseClient.supabase
                .from('property_availability')
                .upsert(dates);

            if (error) throw error;

            this.#showNotification(`${dates.length} dates ${action}ed successfully!`, 'success');
            modal.remove();

            this.#loadPropertyCalendar(propertyId);

        } catch (error) {
            this.#showError('Failed to update availability. Please try again.');
        }
    }

    #updateRenterBookings(bookings) {
        const renterBookingsContainer = document.getElementById('renterBookingsContainer');
        if (!renterBookingsContainer) return;

        const upcomingBookings = bookings.filter(b =>
            b.status === 'confirmed' && new Date(b.check_in_date) > new Date()
        );
        const pastBookings = bookings.filter(b =>
            ['completed', 'confirmed'].includes(b.status) && new Date(b.check_out_date) <= new Date()
        ).slice(0, 5);
        const pendingBookings = bookings.filter(b => b.status === 'pending');

        if (bookings.length === 0) {
            renterBookingsContainer.innerHTML = '';
            const noBookingsDiv = document.createElement('div');
            noBookingsDiv.className = 'no-bookings';
            const p = document.createElement('p');
            const em = document.createElement('em');
            em.textContent = 'No bookings yet. ';
            const a = document.createElement('a');
            a.href = '../index.html';
            a.textContent = 'Browse properties';
            const text = document.createTextNode(' to make your first booking!');
            p.appendChild(em);
            em.appendChild(a);
            em.appendChild(text);
            noBookingsDiv.appendChild(p);
            renterBookingsContainer.appendChild(noBookingsDiv);
            return;
        }

        renterBookingsContainer.innerHTML = '';

        if (pendingBookings.length > 0) {
            const pendingSection = this.#createRenterBookingSection(
                `⏳ Pending Requests (${pendingBookings.length})`,
                pendingBookings,
                '#f39c12'
            );
            renterBookingsContainer.appendChild(pendingSection);
        }

        if (upcomingBookings.length > 0) {
            const upcomingSection = this.#createRenterBookingSection(
                `✈️ Upcoming Trips (${upcomingBookings.length})`,
                upcomingBookings,
                '#27ae60'
            );
            upcomingSection.style.marginTop = '2rem';
            renterBookingsContainer.appendChild(upcomingSection);
        }

        if (pastBookings.length > 0) {
            const pastSection = this.#createRenterBookingSection(
                '🏁 Past Trips',
                pastBookings
            );
            pastSection.style.marginTop = '2rem';
            renterBookingsContainer.appendChild(pastSection);
        }
    }

    #createRenterBookingSection(title, bookings, titleColor = null) {
        const section = document.createElement('div');
        section.className = 'booking-section';

        const h4 = document.createElement('h4');
        h4.style.marginBottom = '1rem';
        if (titleColor) {
            h4.style.color = titleColor;
        }
        h4.textContent = title;

        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'booking-cards';

        bookings.forEach(booking => {
            const card = this.#createRenterBookingCard(booking);
            cardsDiv.appendChild(card);
        });

        section.appendChild(h4);
        section.appendChild(cardsDiv);

        return section;
    }

    #createRenterBookingCard(booking) {
        const card = document.createElement('div');
        card.className = 'booking-card';
        card.style.cssText = `
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            gap: 1rem;
        `;

        const property = booking.properties;
        const primaryImage = property?.property_images?.find(img => img.is_primary);
        const imageUrl = primaryImage?.image_url;
        const checkIn = new Date(booking.check_in_date);
        const checkOut = new Date(booking.check_out_date);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        const isUpcoming = new Date(booking.check_in_date) > new Date();
        const isPast = new Date(booking.check_out_date) <= new Date();

        const statusColors = {
            pending: '#f39c12',
            confirmed: '#27ae60',
            completed: '#3498db',
            cancelled: '#e74c3c'
        };

        if (imageUrl) {
            const imageDiv = document.createElement('div');
            imageDiv.className = 'booking-image';
            imageDiv.style.cssText = 'width: 100px; height: 80px; border-radius: 6px; overflow: hidden; flex-shrink: 0;';

            const img = document.createElement('img');
            img.src = this.#sanitize(imageUrl);
            img.alt = this.#sanitize(property?.title || 'Property');
            img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';

            imageDiv.appendChild(img);
            card.appendChild(imageDiv);
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'booking-content';
        contentDiv.style.flex = '1';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'booking-header';
        headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;';

        const headerInfo = document.createElement('div');
        const h5 = document.createElement('h5');
        h5.style.cssText = 'margin: 0 0 0.25rem 0; color: #2c3e50;';
        h5.textContent = this.#sanitize(property?.title || 'Property');

        const locationP = document.createElement('p');
        locationP.style.cssText = 'margin: 0; color: #666; font-size: 0.9rem;';
        locationP.textContent = `${this.#sanitize(property?.city || '')}, ${this.#sanitize(property?.state || '')}`;

        headerInfo.appendChild(h5);
        headerInfo.appendChild(locationP);

        const statusSpan = document.createElement('span');
        statusSpan.className = 'booking-status';
        statusSpan.style.cssText = `
            background: ${statusColors[booking.status] || '#95a5a6'};
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
            text-transform: capitalize;
        `;
        statusSpan.textContent = booking.status;

        headerDiv.appendChild(headerInfo);
        headerDiv.appendChild(statusSpan);

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'booking-details';
        detailsDiv.style.cssText = 'font-size: 0.9rem; color: #666;';

        const datesDiv = document.createElement('div');
        datesDiv.style.marginBottom = '0.25rem';
        datesDiv.textContent = `📅 ${this.#formatDate(booking.check_in_date)} - ${this.#formatDate(booking.check_out_date)} (${nights} night${nights > 1 ? 's' : ''})`;

        const guestsDiv = document.createElement('div');
        guestsDiv.style.marginBottom = '0.25rem';
        const numGuests = parseInt(booking.num_guests) || 0;
        guestsDiv.textContent = `👥 ${numGuests} guest${numGuests > 1 ? 's' : ''}`;

        const totalDiv = document.createElement('div');
        totalDiv.style.cssText = 'font-weight: 500; color: #27ae60;';
        totalDiv.textContent = `💰 $${parseFloat(booking.total_amount) || 0} total`;

        detailsDiv.appendChild(datesDiv);
        detailsDiv.appendChild(guestsDiv);
        detailsDiv.appendChild(totalDiv);

        contentDiv.appendChild(headerDiv);
        contentDiv.appendChild(detailsDiv);

        if (booking.status === 'pending') {
            const statusDiv = document.createElement('div');
            statusDiv.style.cssText = 'margin-top: 0.5rem; font-size: 0.85rem; color: #f39c12;';
            statusDiv.textContent = '⏳ Inquiry Pending';
            contentDiv.appendChild(statusDiv);
        } else if (isUpcoming && booking.status === 'confirmed') {
            const statusDiv = document.createElement('div');
            statusDiv.style.cssText = 'margin-top: 0.5rem; font-size: 0.85rem; color: #27ae60;';
            statusDiv.textContent = '✅ Confirmed - Get ready for your trip!';
            contentDiv.appendChild(statusDiv);
        } else if (isPast && booking.status !== 'cancelled') {
            const actionDiv = document.createElement('div');
            actionDiv.style.marginTop = '0.5rem';
            const reviewBtn = document.createElement('button');
            reviewBtn.className = 'btn btn-sm btn-primary';
            reviewBtn.style.cssText = 'padding: 0.25rem 0.75rem; font-size: 0.8rem;';
            reviewBtn.textContent = '⭐ Write Review';
            reviewBtn.addEventListener('click', () => {
                this.#showNotification('Review feature coming soon!', 'info');
            });
            actionDiv.appendChild(reviewBtn);
            contentDiv.appendChild(actionDiv);
        }

        card.appendChild(contentDiv);

        return card;
    }

    #updateWishlist(wishlist) {
        console.log('Updating wishlist:', wishlist);
        const wishlistGrid = document.getElementById('wishlistGrid');
        if (!wishlistGrid) return;

        if (!wishlist || wishlist.length === 0) {
            console.log('No wishlist items found');
            wishlistGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">♥</div>
                    <h3>No saved properties</h3>
                    <p>Save properties you love to easily find them later.</p>
                    <a href="../index.html" class="btn btn-primary">Browse Properties</a>
                </div>
            `;
            return;
        }

        wishlistGrid.innerHTML = wishlist.map(item => {
            console.log('Processing wishlist item:', item);
            const property = item.properties;
            console.log('Property data:', property);
            if (!property) {
                console.warn('No property data for item:', item);
                return '';
            }

            const imageUrl = this.#getPropertyImageUrl(property.view_type);
            return `
                <div class="property-card-dashboard wishlist-card" data-property-id="${property.id}">
                    <img src="${imageUrl}"
                         alt="${property.title}"
                         onerror="this.src='https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&auto=format&fit=crop&q=80'">
                    <div class="property-card-content">
                        <h4>${property.title}</h4>
                        <p class="property-location">${property.city}, ${property.state}</p>
                        <p class="property-price">$${property.base_price}/night</p>
                        <div class="property-actions">
                            <button class="btn btn-primary btn-sm view-details-btn" data-property-id="${property.id}">
                                View Details
                            </button>
                            <button class="btn btn-secondary btn-sm remove-wishlist-btn" data-wishlist-id="${item.id}">
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners to the buttons
        this.#setupWishlistButtons();
    }

    #setupWishlistButtons() {
        // View Details buttons
        const viewDetailsBtns = document.querySelectorAll('.view-details-btn');
        viewDetailsBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const propertyId = btn.getAttribute('data-property-id');
                window.location.href = `property-detail.html?id=${propertyId}`;
            });
        });

        // Remove buttons
        const removeBtns = document.querySelectorAll('.remove-wishlist-btn');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const wishlistId = btn.getAttribute('data-wishlist-id');
                this.removeFromWishlist(wishlistId);
            });
        });
    }

    async removeFromWishlist(wishlistId) {
        try {
            const { error } = await this.#supabaseClient.supabase
                .from('wishlists')
                .delete()
                .eq('id', wishlistId);

            if (error) throw error;

            // Reload renter data to refresh the display
            await this.#loadRenterData();

            if (window.UI?.showToast) {
                window.UI.showToast('Removed from saved properties', 'success');
            }
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            if (window.UI?.showToast) {
                window.UI.showToast('Failed to remove property', 'error');
            }
        }
    }

    #getPropertyImageUrl(viewType) {
        const imageMap = {
            'Mountain View': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop&q=80',
            'Ocean View': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop&q=80',
            'City View': 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&auto=format&fit=crop&q=80',
            'Lake View': 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&auto=format&fit=crop&q=80',
            'Forest View': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&auto=format&fit=crop&q=80',
            'default': 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&auto=format&fit=crop&q=80'
        };
        return imageMap[viewType] || imageMap['default'];
    }

    #formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    #formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };

        return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(new Date(date));
    }

    #sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Modal Management Class
class DashboardModalManager {
    constructor() {
        this.#init();
    }

    #init() {
        this.#setupModalTriggers();
        this.#setupModalCloseButtons();
        this.#setupBackdropClose();
        this.#setupFormHandlers();
    }

    #setupModalTriggers() {
        // Handle modal trigger clicks
        document.querySelectorAll('[data-modal-trigger]').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const modalId = trigger.getAttribute('data-modal-trigger');
                this.#openModal(modalId);
            });
        });
    }

    #setupModalCloseButtons() {
        // Handle close button clicks
        document.querySelectorAll('.dashboard-modal-close, [data-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = btn.getAttribute('data-modal');
                if (modalId) {
                    this.#closeModal(modalId);
                } else if (btn.classList.contains('dashboard-modal-close')) {
                    const overlay = btn.closest('.dashboard-modal-overlay');
                    if (overlay) {
                        this.#closeModal(overlay.id);
                    }
                }
            });
        });
    }

    #setupBackdropClose() {
        // Close modal when clicking backdrop
        document.querySelectorAll('.dashboard-modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.#closeModal(overlay.id);
                }
            });
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.dashboard-modal-overlay.active');
                if (activeModal) {
                    this.#closeModal(activeModal.id);
                }
            }
        });
    }

    #setupFormHandlers() {
        // Profile form
        const profileForm = document.getElementById('modalProfileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.#handleProfileSave();
            });
        }

        // Password form
        const passwordForm = document.getElementById('modalPasswordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.#handlePasswordChange();
            });
        }

        // Notifications form
        const notificationsForm = document.getElementById('modalNotificationsForm');
        if (notificationsForm) {
            notificationsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.#handleNotificationsUpdate();
            });
        }

        // Account preferences form
        const accountPreferencesForm = document.getElementById('modalAccountPreferencesForm');
        if (accountPreferencesForm) {
            accountPreferencesForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.#handleAccountPreferencesUpdate();
            });
        }

        // Delete account button
        const deleteBtn = document.getElementById('modalDeleteAccountBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.#handleDeleteAccount();
            });
        }
    }

    #openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Load data into modal if it's the profile modal
            if (modalId === 'profileModal') {
                this.#loadProfileData();
            } else if (modalId === 'settingsModal') {
                this.#loadSettingsData();
            }

            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    #closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    #loadProfileData() {
        if (!window.supabaseClient) return;

        const user = window.supabaseClient.getCurrentUser();
        if (!user) return;

        const metadata = user.user_metadata || {};
        
        // Full name
        const fullName = metadata.first_name && metadata.last_name 
            ? `${metadata.first_name} ${metadata.last_name}`
            : metadata.firstName && metadata.lastName
                ? `${metadata.firstName} ${metadata.lastName}`
                : user.email?.split('@')[0] || 'User';

        // Update modal fields
        const modalFullName = document.getElementById('modalFullName');
        const modalEmail = document.getElementById('modalEmail');
        const modalPhone = document.getElementById('modalPhone');
        const modalBio = document.getElementById('modalBio');
        const modalProfileName = document.getElementById('modalProfileName');
        const modalAvatarInitials = document.getElementById('modalAvatarInitials');

        if (modalFullName) modalFullName.value = fullName;
        if (modalEmail) modalEmail.value = user.email || '';
        if (modalPhone) modalPhone.value = metadata.phone || '';
        if (modalBio) modalBio.value = metadata.bio || '';
        if (modalProfileName) modalProfileName.textContent = fullName;
        if (modalAvatarInitials) modalAvatarInitials.textContent = fullName.charAt(0).toUpperCase();
    }

    #loadSettingsData() {
        // Load settings from localStorage or user metadata
        const savedLanguage = localStorage.getItem('user_language') || 'en';
        const savedCurrency = localStorage.getItem('user_currency') || 'USD';

        const modalLanguage = document.getElementById('modalLanguage');
        const modalCurrency = document.getElementById('modalCurrency');

        if (modalLanguage) modalLanguage.value = savedLanguage;
        if (modalCurrency) modalCurrency.value = savedCurrency;
    }

    async #handleProfileSave() {
        if (!window.supabaseClient || !window.supabaseClient.supabase) {
            this.#showNotification('Database not configured', 'error');
            return;
        }

        const fullName = document.getElementById('modalFullName').value.trim();
        const phone = document.getElementById('modalPhone').value.trim();
        const bio = document.getElementById('modalBio').value.trim();

        const [firstName = '', ...lastNameParts] = fullName.split(' ');
        const lastName = lastNameParts.join(' ');

        try {
            const user = window.supabaseClient.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await window.supabaseClient.supabase
                .from('user_profiles')
                .upsert([{
                    user_id: user.id,
                    first_name: firstName,
                    last_name: lastName,
                    phone: phone,
                    bio: bio,
                    updated_at: new Date().toISOString()
                }], { onConflict: 'user_id' });

            if (error) throw error;

            this.#showNotification('Profile updated successfully!', 'success');
            this.#closeModal('profileModal');

            // Reload dashboard data
            if (window.dashboardManager) {
                window.location.reload();
            }
        } catch (error) {
            console.error('Profile save error:', error);
            this.#showNotification('Failed to save profile', 'error');
        }
    }

    async #handlePasswordChange() {
        if (!window.supabaseClient || !window.supabaseClient.supabase) {
            this.#showNotification('Authentication service not available', 'error');
            return;
        }

        const newPassword = document.getElementById('modalNewPassword').value;
        const confirmPassword = document.getElementById('modalConfirmPassword').value;

        if (newPassword !== confirmPassword) {
            this.#showNotification('Passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 8) {
            this.#showNotification('Password must be at least 8 characters', 'error');
            return;
        }

        try {
            const { error } = await window.supabaseClient.supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            this.#showNotification('Password updated successfully!', 'success');
            document.getElementById('modalPasswordForm').reset();
            this.#closeModal('settingsModal');
        } catch (error) {
            console.error('Password change error:', error);
            this.#showNotification(error.message || 'Failed to update password', 'error');
        }
    }

    async #handleNotificationsUpdate() {
        if (!window.supabaseClient || !window.supabaseClient.supabase) {
            this.#showNotification('Database not configured', 'error');
            return;
        }

        const emailBookings = document.getElementById('modalEmailBookings').checked;
        const emailMessages = document.getElementById('modalEmailMessages').checked;
        const emailPromotions = document.getElementById('modalEmailPromotions').checked;

        try {
            const user = window.supabaseClient.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await window.supabaseClient.supabase
                .from('user_profiles')
                .upsert([{
                    user_id: user.id,
                    email_notifications: emailBookings,
                    message_notifications: emailMessages,
                    promotional_emails: emailPromotions,
                    updated_at: new Date().toISOString()
                }], { onConflict: 'user_id' });

            if (error) throw error;

            this.#showNotification('Notification preferences saved!', 'success');
        } catch (error) {
            console.error('Notifications update error:', error);
            this.#showNotification('Failed to save preferences', 'error');
        }
    }

    async #handleAccountPreferencesUpdate() {
        const language = document.getElementById('modalLanguage').value;
        const currency = document.getElementById('modalCurrency').value;

        localStorage.setItem('user_language', language);
        localStorage.setItem('user_currency', currency);

        if (window.supabaseClient && window.supabaseClient.supabase) {
            try {
                const user = window.supabaseClient.getCurrentUser();
                if (user) {
                    await window.supabaseClient.supabase
                        .from('user_profiles')
                        .upsert([{
                            user_id: user.id,
                            language: language,
                            currency: currency,
                            updated_at: new Date().toISOString()
                        }], { onConflict: 'user_id' });
                }
            } catch (error) {
                console.error('Account preferences update error:', error);
            }
        }

        this.#showNotification('Account preferences saved!', 'success');
    }

    async #handleDeleteAccount() {
        const confirmed = confirm(
            'Are you absolutely sure you want to delete your account? This action cannot be undone.\n\nAll your data will be permanently deleted.'
        );

        if (!confirmed) return;

        const doubleConfirm = confirm(
            'This is your last chance. Are you REALLY sure?'
        );

        if (!doubleConfirm) return;

        this.#showNotification('Account deletion feature coming soon. Please contact support.', 'info');
    }

    #showNotification(message, type = 'info') {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(message, type);
        } else {
            alert(message);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const isDashboardPage = window.location.pathname.includes('dashboard');

    if (isDashboardPage) {
        window.dashboardManager = new DashboardManager();
        window.modalManager = new DashboardModalManager();
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardManager;
}
