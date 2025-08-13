// Dashboard JavaScript
// Handles dashboard functionality for both renter and owner dashboards

class DashboardManager {
    constructor() {
        this.supabaseClient = window.supabaseClient;
        this.userProfile = null;
        this.userType = null;
        this.isLoaded = false;
        
        this.init();
    }

    async init() {
        try {
            // Wait for Supabase to be initialized
            await this.supabaseClient.waitForInit();
            
            if (this.checkAuthentication()) {
                this.setupEventListeners();
                this.loadUserData();
                this.determineUserType();
            }
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            this.showError('Failed to initialize dashboard. Please refresh the page.');
        }
    }

    // Check if user is authenticated
    checkAuthentication() {
        if (!this.supabaseClient.isAuthenticated()) {
            console.log('No user found, waiting for auth state...');
            // Wait a moment for auth state to load, then check again
            setTimeout(() => {
                if (!this.supabaseClient.isAuthenticated()) {
                    console.log('Still no user after wait, redirecting to login');
                    window.location.href = 'login.html';
                } else {
                    console.log('User found after wait, loading dashboard');
                    this.setupEventListeners();
                    this.loadUserData();
                    this.determineUserType();
                }
            }, 1000);
            return false;
        }
        return true;
    }

    // Setup event listeners
    setupEventListeners() {
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Quick action buttons
        this.setupQuickActions();
    }

    // Setup quick action button handlers
    setupQuickActions() {
        // Add any quick action buttons here
        const quickActionBtns = document.querySelectorAll('.quick-actions .btn');
        quickActionBtns.forEach(btn => {
            if (btn.textContent.includes('Add New Property')) {
                btn.addEventListener('click', () => this.navigateToPropertyForm());
            } else if (btn.textContent.includes('Edit Profile')) {
                btn.addEventListener('click', () => this.handleEditProfile());
            }
        });
    }

    // Determine user type from current page
    determineUserType() {
        const currentPath = window.location.pathname;
        if (currentPath.includes('owner-dashboard')) {
            this.userType = 'owner';
        } else if (currentPath.includes('renter-dashboard')) {
            this.userType = 'renter';
        }
    }

    // Load user data and populate dashboard
    async loadUserData() {
        if (this.isLoaded) {
            console.log('Dashboard already loaded, skipping');
            return;
        }
        
        try {
            const user = this.supabaseClient.getCurrentUser();
            
            if (!user) {
                console.warn('No user found');
                return;
            }
            
            this.isLoaded = true;

            // Update user name display
            this.updateUserNameDisplay(user);

            // Load user profile from database if Supabase is configured
            if (this.supabaseClient.supabase) {
                await this.loadUserProfile(user.id);
                await this.loadDashboardData();
            } else {
                // Use sample data if Supabase not configured
                this.loadSampleData();
            }

        } catch (error) {
            console.error('Error loading user data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    // Update user name display
    updateUserNameDisplay(user) {
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            const firstName = user.user_metadata?.first_name || 
                            user.user_metadata?.firstName ||
                            user.email?.split('@')[0] || 
                            'User';
            userNameElement.textContent = firstName;
        }
    }

    // Load user profile from database
    async loadUserProfile(userId) {
        try {
            const { data, error } = await this.supabaseClient.supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                console.warn('User profile not found, creating...');
                // Profile might not exist yet, create it
                await this.createUserProfile(userId);
                return;
            }

            this.userProfile = data;
            
            // Update display with profile data
            const userNameElement = document.getElementById('userName');
            if (userNameElement && data.first_name) {
                userNameElement.textContent = data.first_name;
            }

        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    // Create user profile if it doesn't exist
    async createUserProfile(userId) {
        try {
            const user = this.supabaseClient.getCurrentUser();
            const metadata = user.user_metadata || {};

            const profileData = {
                user_id: userId,
                email: user.email,
                first_name: metadata.first_name || metadata.firstName || '',
                last_name: metadata.last_name || metadata.lastName || '',
                phone: metadata.phone || '',
                account_type: metadata.account_type || this.userType || 'renter',
                business_name: metadata.business_name || metadata.businessName || null,
                is_active: true,
                email_verified: !!user.email_confirmed_at,
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.supabaseClient.supabase
                .from('user_profiles')
                .insert([profileData])
                .select()
                .single();

            if (error) throw error;

            this.userProfile = data;
            console.log('User profile created successfully');

        } catch (error) {
            console.error('Error creating user profile:', error);
        }
    }

    // Load dashboard-specific data
    async loadDashboardData() {
        if (this.userType === 'owner') {
            await this.loadOwnerData();
        } else {
            await this.loadRenterData();
        }
    }

    // Load owner-specific data
    async loadOwnerData() {
        try {
            const userId = this.supabaseClient.getCurrentUser()?.id;
            
            // Load properties
            const { data: properties, error: propertiesError } = await this.supabaseClient.supabase
                .from('properties')
                .select('*, property_images(image_url, is_primary)')
                .eq('owner_id', userId)
                .eq('is_active', true);

            if (propertiesError) throw propertiesError;

            // Load bookings with property and guest details
            const { data: bookings, error: bookingsError } = await this.supabaseClient.supabase
                .from('bookings')
                .select(`
                    *,
                    properties(title, city, state),
                    user_profiles!bookings_guest_id_fkey(first_name, last_name, email)
                `)
                .eq('owner_id', userId)
                .order('created_at', { ascending: false });

            if (bookingsError) throw bookingsError;

            // Load reviews
            const { data: reviews, error: reviewsError } = await this.supabaseClient.supabase
                .from('reviews')
                .select('overall_rating')
                .eq('reviewee_id', userId)
                .eq('review_type', 'guest_to_owner');

            if (reviewsError) throw reviewsError;

            // Update dashboard with real data
            this.updateOwnerStats(properties, bookings, reviews);
            this.updatePropertiesGrid(properties);
            this.updateBookingRequests(bookings);
            this.setupAvailabilityCalendar(properties);

        } catch (error) {
            console.error('Error loading owner data:', error);
            this.loadSampleOwnerData();
        }
    }

    // Load renter-specific data
    async loadRenterData() {
        try {
            const userId = this.supabaseClient.getCurrentUser()?.id;
            
            // Load bookings with property details
            const { data: bookings, error: bookingsError } = await this.supabaseClient.supabase
                .from('bookings')
                .select(`
                    *,
                    properties(title, city, state, property_images(image_url, is_primary))
                `)
                .eq('guest_id', userId)
                .order('created_at', { ascending: false });

            if (bookingsError) throw bookingsError;

            // Load wishlist
            const { data: wishlist, error: wishlistError } = await this.supabaseClient.supabase
                .from('wishlists')
                .select('*, properties(title, city, state, base_price)')
                .eq('user_id', userId);

            if (wishlistError) throw wishlistError;

            // Load reviews given
            const { data: reviews, error: reviewsError } = await this.supabaseClient.supabase
                .from('reviews')
                .select('*')
                .eq('reviewer_id', userId)
                .eq('review_type', 'guest_to_owner');

            if (reviewsError) throw reviewsError;

            // Update dashboard with real data
            this.updateRenterStats(bookings, wishlist, reviews);
            this.updateRenterBookings(bookings);
            this.updateWishlist(wishlist);

        } catch (error) {
            console.error('Error loading renter data:', error);
            this.loadSampleRenterData();
        }
    }

    // Update owner statistics
    updateOwnerStats(properties, bookings, reviews) {
        // Total properties
        const totalPropertiesEl = document.getElementById('totalProperties');
        if (totalPropertiesEl) {
            totalPropertiesEl.textContent = properties.length;
        }

        // Pending bookings (requests needing review)
        const pendingBookings = bookings.filter(b => b.status === 'pending').length;
        const pendingBookingsEl = document.getElementById('pendingBookings');
        if (pendingBookingsEl) {
            pendingBookingsEl.textContent = pendingBookings;
        }

        // Active bookings
        const activeBookings = bookings.filter(b => b.status === 'confirmed').length;
        const activeBookingsEl = document.getElementById('activeBookings');
        if (activeBookingsEl) {
            activeBookingsEl.textContent = activeBookings;
        }

        // Monthly earnings (placeholder calculation)
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

        // Average rating
        const averageRatingEl = document.getElementById('averageRating');
        if (averageRatingEl && reviews.length > 0) {
            const avgRating = reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length;
            averageRatingEl.textContent = avgRating.toFixed(1);
        }
    }

    // Update renter statistics
    updateRenterStats(bookings, wishlist, reviews) {
        // Upcoming bookings
        const upcomingBookings = bookings.filter(b => 
            b.status === 'confirmed' && new Date(b.check_in_date) > new Date()
        ).length;
        const upcomingBookingsEl = document.getElementById('upcomingBookings');
        if (upcomingBookingsEl) {
            upcomingBookingsEl.textContent = upcomingBookings;
        }

        // Completed bookings
        const completedBookings = bookings.filter(b => b.status === 'completed').length;
        const completedBookingsEl = document.getElementById('completedBookings');
        if (completedBookingsEl) {
            completedBookingsEl.textContent = completedBookings;
        }

        // Wishlist count
        const wishlistCountEl = document.getElementById('wishlistCount');
        if (wishlistCountEl) {
            wishlistCountEl.textContent = wishlist.length;
        }

        // Reviews given
        const reviewsGivenEl = document.getElementById('reviewsGiven');
        if (reviewsGivenEl) {
            reviewsGivenEl.textContent = reviews.length;
        }
    }

    // Update properties grid for owners
    updatePropertiesGrid(properties) {
        const propertiesGrid = document.getElementById('propertiesGrid');
        if (!propertiesGrid) return;

        if (properties.length === 0) {
            // Keep empty state
            return;
        }

        // Clear empty state
        propertiesGrid.innerHTML = '';

        // Add property cards
        properties.forEach(property => {
            const propertyCard = this.createPropertyCard(property);
            propertiesGrid.appendChild(propertyCard);
        });
    }

    // Create property card element
    createPropertyCard(property) {
        const card = document.createElement('div');
        card.className = 'property-card-dashboard';
        
        const primaryImage = property.property_images?.find(img => img.is_primary);
        const imageUrl = primaryImage?.image_url;

        card.innerHTML = `
            <div class="property-status ${property.is_active ? 'active' : 'inactive'}" data-action="toggle-status" data-id="${property.id}" title="Click to ${property.is_active ? 'deactivate' : 'activate'}" style="cursor: pointer;">
                ${property.is_active ? 'Active' : 'Inactive'}
            </div>
            ${imageUrl ? `<img src="${window.viewVistaApp.sanitizeHTML(imageUrl)}" alt="${window.viewVistaApp.sanitizeHTML(property.title)}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 6px; margin-bottom: 1rem;">` : ''}
            <h4>${window.viewVistaApp.sanitizeHTML(property.title)}</h4>
            <p>${window.viewVistaApp.sanitizeHTML(property.city)}, ${window.viewVistaApp.sanitizeHTML(property.state)}</p>
            <p><strong>$${property.base_price}/night</strong></p>
            <div class="property-actions">
                <button class="btn btn-secondary" data-action="edit" data-id="${property.id}">Edit</button>
                <button class="btn btn-danger" data-action="delete" data-id="${property.id}" data-title="${window.viewVistaApp.sanitizeHTML(property.title)}">Delete</button>
                <button class="btn btn-primary" data-action="analytics" data-id="${property.id}">Analytics</button>
            </div>
        `;

        // Wire action buttons
        const editBtn = card.querySelector('[data-action="edit"]');
        const deleteBtn = card.querySelector('[data-action="delete"]');
        const statusToggle = card.querySelector('[data-action="toggle-status"]');

        if (editBtn) {
            editBtn.addEventListener('click', () => this.navigateToPropertyForm(property.id));
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.handleDeleteProperty(property.id, property.title));
        }

        if (statusToggle) {
            statusToggle.addEventListener('click', () => this.handleTogglePropertyStatus(property.id, property.is_active));
        }

        return card;
    }

    // Load sample data when Supabase is not configured
    loadSampleData() {
        if (this.userType === 'owner') {
            this.loadSampleOwnerData();
        } else {
            this.loadSampleRenterData();
        }
    }

    // Load sample owner data
    loadSampleOwnerData() {
        // Update stats with sample data
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

    // Load sample renter data
    loadSampleRenterData() {
        // Update stats with sample data
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

    // Handle logout
    async handleLogout() {
        console.log('Logout button clicked, attempting to sign out...');
        try {
            await this.supabaseClient.signOut();
            console.log('Sign out completed');
            // Redirect will be handled by supabaseClient
        } catch (error) {
            console.error('Logout error:', error);
            this.showError('Failed to logout. Please try again.');
        }
    }

    // Navigate to property form (create or edit)
    navigateToPropertyForm(propertyId = null) {
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

    // Handle edit profile (placeholder)
    handleEditProfile() {
        this.showNotification('Profile editing feature coming soon!', 'info');
    }

    // Handle delete property
    async handleDeleteProperty(propertyId, propertyTitle) {
        // Show confirmation dialog
        const confirmed = await this.showConfirmDialog(
            'Delete Property',
            `Are you sure you want to delete "${propertyTitle}"? This action cannot be undone.`,
            'Delete',
            'btn-danger'
        );

        if (!confirmed) return;

        try {
            if (!this.supabaseClient.supabase) {
                this.showError('Database not configured');
                return;
            }

            // Delete property images from storage first
            await this.deletePropertyImages(propertyId);

            // Delete property record (cascade will handle property_images table)
            const { error } = await this.supabaseClient.supabase
                .from('properties')
                .delete()
                .eq('id', propertyId)
                .eq('owner_id', this.supabaseClient.getCurrentUser()?.id); // Additional security check

            if (error) throw error;

            this.showNotification('Property deleted successfully', 'success');
            
            // Reload dashboard data
            this.isLoaded = false;
            this.loadUserData();

        } catch (error) {
            console.error('Error deleting property:', error);
            this.showError('Failed to delete property. Please try again.');
        }
    }

    // Delete property images from storage
    async deletePropertyImages(propertyId) {
        try {
            const userId = this.supabaseClient.getCurrentUser()?.id;
            if (!userId) return;

            // List all files in the property folder
            const { data: files, error: listError } = await this.supabaseClient.supabase
                .storage
                .from('property-images')
                .list(`properties/${userId}/${propertyId}`, { recursive: true });

            if (listError) {
                console.warn('Could not list property images for deletion:', listError);
                return;
            }

            if (!files || files.length === 0) return;

            // Delete all files in the property folder
            const filesToDelete = files.map(file => `properties/${userId}/${propertyId}/${file.name}`);
            
            const { error: deleteError } = await this.supabaseClient.supabase
                .storage
                .from('property-images')
                .remove(filesToDelete);

            if (deleteError) {
                console.warn('Could not delete some property images:', deleteError);
            }

        } catch (error) {
            console.warn('Error deleting property images:', error);
            // Don't throw - let property deletion continue
        }
    }

    // Handle toggle property status
    async handleTogglePropertyStatus(propertyId, currentStatus) {
        const newStatus = !currentStatus;
        const action = newStatus ? 'activate' : 'deactivate';

        try {
            if (!this.supabaseClient.supabase) {
                this.showError('Database not configured');
                return;
            }

            const { error } = await this.supabaseClient.supabase
                .from('properties')
                .update({ is_active: newStatus })
                .eq('id', propertyId)
                .eq('owner_id', this.supabaseClient.getCurrentUser()?.id); // Additional security check

            if (error) throw error;

            this.showNotification(`Property ${action}d successfully`, 'success');
            
            // Reload dashboard data
            this.isLoaded = false;
            this.loadUserData();

        } catch (error) {
            console.error(`Error ${action}ing property:`, error);
            this.showError(`Failed to ${action} property. Please try again.`);
        }
    }

    // Show confirmation dialog
    showConfirmDialog(title, message, confirmText = 'Confirm', buttonClass = 'btn-primary') {
        return new Promise((resolve) => {
            // Create modal overlay
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

            // Create modal
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white;
                padding: 2rem;
                border-radius: 8px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            `;

            modal.innerHTML = `
                <h3 style="margin-top: 0; margin-bottom: 1rem;">${title}</h3>
                <p style="margin-bottom: 2rem;">${message}</p>
                <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                    <button class="btn btn-secondary" id="cancelBtn">Cancel</button>
                    <button class="btn ${buttonClass}" id="confirmBtn">${confirmText}</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Handle buttons
            const cancelBtn = modal.querySelector('#cancelBtn');
            const confirmBtn = modal.querySelector('#confirmBtn');

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

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            });

            // Focus confirm button
            confirmBtn.focus();
        });
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type}`;
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '10000';
        notification.style.minWidth = '250px';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Show error message
    showError(message) {
        this.showNotification(message, 'error');
    }

    // Update booking requests for owners
    updateBookingRequests(bookings) {
        const bookingRequestsContainer = document.getElementById('bookingRequestsContainer');
        if (!bookingRequestsContainer) return;

        const pendingBookings = bookings.filter(b => b.status === 'pending');
        const recentBookings = bookings.filter(b => ['confirmed', 'completed'].includes(b.status)).slice(0, 5);

        if (pendingBookings.length === 0 && recentBookings.length === 0) {
            bookingRequestsContainer.innerHTML = `
                <div class="no-bookings">
                    <p><em>No booking requests yet.</em></p>
                </div>
            `;
            return;
        }

        bookingRequestsContainer.innerHTML = `
            ${pendingBookings.length > 0 ? `
                <div class="booking-section">
                    <h4 style="color: #f39c12; margin-bottom: 1rem;">⏳ Pending Requests (${pendingBookings.length})</h4>
                    <div class="booking-cards">
                        ${pendingBookings.map(booking => this.createBookingCard(booking, true)).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${recentBookings.length > 0 ? `
                <div class="booking-section" style="margin-top: 2rem;">
                    <h4 style="margin-bottom: 1rem;">📅 Recent Bookings</h4>
                    <div class="booking-cards">
                        ${recentBookings.map(booking => this.createBookingCard(booking, false)).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        // Set up event listeners for booking actions
        this.setupBookingActions();
    }

    // Create booking card HTML
    createBookingCard(booking, isPending) {
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

        return `
            <div class="booking-card" style="
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 1rem;
                background: white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
                <div class="booking-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 0.75rem;
                ">
                    <div>
                        <h5 style="margin: 0 0 0.25rem 0; color: #2c3e50;">
                            ${window.viewVistaApp.sanitizeHTML(property?.title || 'Property')}
                        </h5>
                        <p style="margin: 0; color: #666; font-size: 0.9rem;">
                            ${window.viewVistaApp.sanitizeHTML(guest?.first_name || 'Guest')} ${window.viewVistaApp.sanitizeHTML(guest?.last_name || '')}
                        </p>
                    </div>
                    <span class="booking-status" style="
                        background: ${statusColors[booking.status] || '#95a5a6'};
                        color: white;
                        padding: 0.25rem 0.75rem;
                        border-radius: 12px;
                        font-size: 0.8rem;
                        font-weight: 500;
                        text-transform: capitalize;
                    ">
                        ${booking.status}
                    </span>
                </div>

                <div class="booking-details" style="margin-bottom: 0.75rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.9rem;">
                        <div><strong>Check-in:</strong> ${this.formatDate(booking.check_in_date)}</div>
                        <div><strong>Check-out:</strong> ${this.formatDate(booking.check_out_date)}</div>
                        <div><strong>Guests:</strong> ${booking.num_guests}</div>
                        <div><strong>Nights:</strong> ${nights}</div>
                    </div>
                    <div style="margin-top: 0.5rem; font-weight: 500; color: #27ae60;">
                        Total: $${booking.total_amount}
                    </div>
                    ${booking.special_requests ? `
                        <div style="margin-top: 0.5rem; padding: 0.5rem; background: #f8f9fa; border-radius: 4px; font-size: 0.85rem;">
                            <strong>Special Requests:</strong> ${window.viewVistaApp.sanitizeHTML(booking.special_requests)}
                        </div>
                    ` : ''}
                </div>

                ${isPending ? `
                    <div class="booking-actions" style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-success" data-action="approve" data-booking-id="${booking.id}" 
                                style="flex: 1; padding: 0.5rem; font-size: 0.85rem;">
                            ✓ Approve
                        </button>
                        <button class="btn btn-danger" data-action="decline" data-booking-id="${booking.id}"
                                style="flex: 1; padding: 0.5rem; font-size: 0.85rem;">
                            ✗ Decline
                        </button>
                        <button class="btn btn-secondary" data-action="message" data-booking-id="${booking.id}"
                                style="padding: 0.5rem; font-size: 0.85rem;">
                            💬
                        </button>
                    </div>
                ` : `
                    <div class="booking-info" style="font-size: 0.8rem; color: #666;">
                        Booked on ${this.formatDate(booking.created_at)}
                    </div>
                `}
            </div>
        `;
    }

    // Setup booking action event listeners
    setupBookingActions() {
        document.querySelectorAll('[data-action="approve"]').forEach(btn => {
            btn.addEventListener('click', () => this.handleBookingAction(btn.dataset.bookingId, 'approve'));
        });

        document.querySelectorAll('[data-action="decline"]').forEach(btn => {
            btn.addEventListener('click', () => this.handleBookingAction(btn.dataset.bookingId, 'decline'));
        });

        document.querySelectorAll('[data-action="message"]').forEach(btn => {
            btn.addEventListener('click', () => this.handleBookingMessage(btn.dataset.bookingId));
        });
    }

    // Handle booking approve/decline
    async handleBookingAction(bookingId, action) {
        const newStatus = action === 'approve' ? 'confirmed' : 'cancelled';
        const actionText = action === 'approve' ? 'approve' : 'decline';

        const confirmed = await this.showConfirmDialog(
            `${action === 'approve' ? 'Approve' : 'Decline'} Booking`,
            `Are you sure you want to ${actionText} this booking request?`,
            action === 'approve' ? 'Approve' : 'Decline',
            action === 'approve' ? 'btn-success' : 'btn-danger'
        );

        if (!confirmed) return;

        try {
            const { error } = await this.supabaseClient.supabase
                .from('bookings')
                .update({ 
                    status: newStatus,
                    confirmed_at: action === 'approve' ? new Date().toISOString() : null
                })
                .eq('id', bookingId)
                .eq('owner_id', this.supabaseClient.getCurrentUser()?.id);

            if (error) throw error;

            this.showNotification(`Booking ${action}d successfully!`, 'success');
            
            // Reload dashboard data
            this.isLoaded = false;
            this.loadUserData();

        } catch (error) {
            console.error(`Error ${actionText}ing booking:`, error);
            this.showError(`Failed to ${actionText} booking. Please try again.`);
        }
    }

    // Handle booking message (placeholder)
    handleBookingMessage(bookingId) {
        this.showNotification('Messaging feature coming soon!', 'info');
    }

    // Setup availability calendar
    setupAvailabilityCalendar(properties) {
        const propertySelect = document.getElementById('calendarPropertySelect');
        const bulkBtn = document.getElementById('bulkAvailabilityBtn');
        
        if (!propertySelect) return;

        // Populate property selector
        propertySelect.innerHTML = '<option value="">Select a property...</option>';
        properties.forEach(property => {
            const option = document.createElement('option');
            option.value = property.id;
            option.textContent = `${property.title} - ${property.city}, ${property.state}`;
            propertySelect.appendChild(option);
        });

        // Handle property selection
        propertySelect.addEventListener('change', (e) => {
            const propertyId = e.target.value;
            if (propertyId) {
                this.loadPropertyCalendar(propertyId);
                if (bulkBtn) bulkBtn.disabled = false;
            } else {
                this.clearCalendar();
                if (bulkBtn) bulkBtn.disabled = true;
            }
        });

        // Handle bulk availability
        if (bulkBtn) {
            bulkBtn.addEventListener('click', () => {
                const propertyId = propertySelect.value;
                if (propertyId) {
                    this.showBulkAvailabilityModal(propertyId);
                }
            });
        }
    }

    // Load calendar for specific property
    async loadPropertyCalendar(propertyId) {
        try {
            const container = document.getElementById('availabilityCalendarContainer');
            if (!container) return;

            container.innerHTML = '<div style="text-align: center; padding: 2rem;">Loading calendar...</div>';

            // Load availability data for the next 12 months
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 12);

            // Load existing availability and bookings
            const [availabilityResult, bookingsResult] = await Promise.all([
                this.supabaseClient.supabase
                    .from('property_availability')
                    .select('*')
                    .eq('property_id', propertyId)
                    .gte('date', startDate.toISOString().split('T')[0])
                    .lte('date', endDate.toISOString().split('T')[0]),
                
                this.supabaseClient.supabase
                    .from('bookings')
                    .select('check_in_date, check_out_date, status')
                    .eq('property_id', propertyId)
                    .in('status', ['confirmed', 'pending'])
                    .gte('check_in_date', startDate.toISOString().split('T')[0])
                    .lte('check_out_date', endDate.toISOString().split('T')[0])
            ]);

            if (availabilityResult.error) throw availabilityResult.error;
            if (bookingsResult.error) throw bookingsResult.error;

            this.renderCalendar(propertyId, availabilityResult.data || [], bookingsResult.data || []);

        } catch (error) {
            console.error('Error loading calendar:', error);
            const container = document.getElementById('availabilityCalendarContainer');
            if (container) {
                container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;">Error loading calendar. Please try again.</div>';
            }
        }
    }

    // Render calendar
    renderCalendar(propertyId, availabilityData, bookingsData) {
        const container = document.getElementById('availabilityCalendarContainer');
        if (!container) return;

        // Create calendar HTML
        const currentDate = new Date();
        const months = [];
        
        // Generate 6 months of calendar
        for (let i = 0; i < 6; i++) {
            const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
            months.push(this.renderMonth(monthDate, propertyId, availabilityData, bookingsData));
        }

        container.innerHTML = `
            <div class="calendar-legend" style="
                display: flex;
                justify-content: center;
                gap: 2rem;
                margin-bottom: 1.5rem;
                padding: 1rem;
                background: #f8f9fa;
                border-radius: 8px;
                font-size: 0.9rem;
            ">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 16px; height: 16px; background: #27ae60; border-radius: 3px;"></div>
                    <span>Available</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 16px; height: 16px; background: #e74c3c; border-radius: 3px;"></div>
                    <span>Blocked</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 16px; height: 16px; background: #3498db; border-radius: 3px;"></div>
                    <span>Booked</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 16px; height: 16px; background: #f39c12; border-radius: 3px;"></div>
                    <span>Pending</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 16px; height: 16px; background: #95a5a6; border-radius: 3px;"></div>
                    <span>Past</span>
                </div>
            </div>
            <div class="calendar-grid" style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
            ">
                ${months.join('')}
            </div>
        `;

        // Setup date click handlers
        this.setupCalendarClickHandlers(propertyId);
    }

    // Render individual month
    renderMonth(monthDate, propertyId, availabilityData, bookingsData) {
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const days = [];
        const currentDay = new Date(startDate);
        
        // Generate 42 days (6 weeks)
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
                // Check bookings
                const booking = bookingsData.find(b => {
                    const checkIn = new Date(b.check_in_date);
                    const checkOut = new Date(b.check_out_date);
                    return currentDay >= checkIn && currentDay < checkOut;
                });
                
                if (booking) {
                    status = booking.status === 'confirmed' ? 'booked' : 'pending';
                    statusColor = booking.status === 'confirmed' ? '#3498db' : '#f39c12';
                } else {
                    // Check availability settings
                    const availability = availabilityData.find(a => a.date === dateStr);
                    if (availability && !availability.is_available) {
                        status = 'blocked';
                        statusColor = '#e74c3c';
                    }
                }
            }
            
            days.push(`
                <div class="calendar-day ${!isCurrentMonth ? 'other-month' : ''}" 
                     data-date="${dateStr}" 
                     data-property-id="${propertyId}"
                     data-status="${status}"
                     style="
                        padding: 0.75rem 0.5rem;
                        text-align: center;
                        cursor: ${isPast || status === 'booked' ? 'default' : 'pointer'};
                        background: ${statusColor};
                        color: ${status === 'available' || isPast ? 'white' : 'white'};
                        opacity: ${!isCurrentMonth ? '0.3' : '1'};
                        border-radius: 4px;
                        font-size: 0.9rem;
                        transition: all 0.2s ease;
                        position: relative;
                     "
                     ${isPast || status === 'booked' ? '' : 'title="Click to toggle availability"'}>
                    ${currentDay.getDate()}
                </div>
            `);
            
            currentDay.setDate(currentDay.getDate() + 1);
        }
        
        return `
            <div class="month-calendar" style="background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                <div class="month-header" style="
                    background: #2c3e50;
                    color: white;
                    padding: 1rem;
                    text-align: center;
                    font-weight: 600;
                ">
                    ${monthName}
                </div>
                <div class="week-headers" style="
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    background: #34495e;
                    color: white;
                ">
                    ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => 
                        `<div style="padding: 0.5rem; text-align: center; font-size: 0.85rem; font-weight: 500;">${day}</div>`
                    ).join('')}
                </div>
                <div class="days-grid" style="
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 1px;
                    background: #ecf0f1;
                ">
                    ${days.join('')}
                </div>
            </div>
        `;
    }

    // Setup calendar click handlers
    setupCalendarClickHandlers(propertyId) {
        document.querySelectorAll('.calendar-day').forEach(day => {
            const status = day.dataset.status;
            
            if (status !== 'past' && status !== 'booked' && status !== 'pending') {
                day.addEventListener('click', () => this.toggleDateAvailability(propertyId, day));
                
                // Hover effects
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

    // Toggle date availability
    async toggleDateAvailability(propertyId, dayElement) {
        const date = dayElement.dataset.date;
        const currentStatus = dayElement.dataset.status;
        const newAvailable = currentStatus === 'blocked';

        try {
            // Update database
            const { error } = await this.supabaseClient.supabase
                .from('property_availability')
                .upsert([{
                    property_id: propertyId,
                    date: date,
                    is_available: newAvailable
                }]);

            if (error) throw error;

            // Update UI
            const newStatus = newAvailable ? 'available' : 'blocked';
            const newColor = newAvailable ? '#27ae60' : '#e74c3c';
            
            dayElement.dataset.status = newStatus;
            dayElement.style.background = newColor;

            this.showNotification(`Date ${newAvailable ? 'unblocked' : 'blocked'} successfully`, 'success');

        } catch (error) {
            console.error('Error updating availability:', error);
            this.showError('Failed to update availability. Please try again.');
        }
    }

    // Clear calendar
    clearCalendar() {
        const container = document.getElementById('availabilityCalendarContainer');
        if (container) {
            container.innerHTML = `
                <div class="calendar-empty-state" style="text-align: center; padding: 2rem; color: #666;">
                    <p>Select a property to manage its availability calendar.</p>
                </div>
            `;
        }
    }

    // Show bulk availability modal
    showBulkAvailabilityModal(propertyId) {
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

        modal.innerHTML = `
            <div class="bulk-modal" style="
                background: white;
                border-radius: 12px;
                padding: 2rem;
                max-width: 400px;
                width: 90%;
            ">
                <h3 style="margin: 0 0 1.5rem 0;">Bulk Availability Update</h3>
                
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem;">Start Date:</label>
                    <input type="date" id="bulkStartDate" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem;">End Date:</label>
                    <input type="date" id="bulkEndDate" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem;">Action:</label>
                    <select id="bulkAction" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="block">Block dates (unavailable)</option>
                        <option value="unblock">Unblock dates (available)</option>
                    </select>
                </div>
                
                <div class="modal-actions" style="display: flex; gap: 1rem;">
                    <button class="btn btn-secondary bulk-cancel" style="flex: 1;">Cancel</button>
                    <button class="btn btn-primary bulk-apply" style="flex: 1;">Apply</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Set minimum dates
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('bulkStartDate').min = today;
        document.getElementById('bulkEndDate').min = today;

        // Handle actions
        modal.querySelector('.bulk-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('.bulk-apply').addEventListener('click', () => {
            this.applyBulkAvailability(propertyId, modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // Apply bulk availability changes
    async applyBulkAvailability(propertyId, modal) {
        const startDate = document.getElementById('bulkStartDate').value;
        const endDate = document.getElementById('bulkEndDate').value;
        const action = document.getElementById('bulkAction').value;

        if (!startDate || !endDate) {
            this.showError('Please select both start and end dates');
            return;
        }

        if (new Date(endDate) <= new Date(startDate)) {
            this.showError('End date must be after start date');
            return;
        }

        try {
            const isAvailable = action === 'unblock';
            const dates = [];
            const current = new Date(startDate);
            const end = new Date(endDate);

            // Generate date range
            while (current <= end) {
                dates.push({
                    property_id: propertyId,
                    date: current.toISOString().split('T')[0],
                    is_available: isAvailable
                });
                current.setDate(current.getDate() + 1);
            }

            // Batch update
            const { error } = await this.supabaseClient.supabase
                .from('property_availability')
                .upsert(dates);

            if (error) throw error;

            this.showNotification(`${dates.length} dates ${action}ed successfully!`, 'success');
            modal.remove();

            // Reload calendar
            this.loadPropertyCalendar(propertyId);

        } catch (error) {
            console.error('Error applying bulk availability:', error);
            this.showError('Failed to update availability. Please try again.');
        }
    }

    // Update renter bookings
    updateRenterBookings(bookings) {
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
            renterBookingsContainer.innerHTML = `
                <div class="no-bookings">
                    <p><em>No bookings yet. <a href="properties.html">Browse properties</a> to make your first booking!</em></p>
                </div>
            `;
            return;
        }

        renterBookingsContainer.innerHTML = `
            ${pendingBookings.length > 0 ? `
                <div class="booking-section">
                    <h4 style="color: #f39c12; margin-bottom: 1rem;">⏳ Pending Requests (${pendingBookings.length})</h4>
                    <div class="booking-cards">
                        ${pendingBookings.map(booking => this.createRenterBookingCard(booking)).join('')}
                    </div>
                </div>
            ` : ''}

            ${upcomingBookings.length > 0 ? `
                <div class="booking-section" style="margin-top: 2rem;">
                    <h4 style="color: #27ae60; margin-bottom: 1rem;">✈️ Upcoming Trips (${upcomingBookings.length})</h4>
                    <div class="booking-cards">
                        ${upcomingBookings.map(booking => this.createRenterBookingCard(booking)).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${pastBookings.length > 0 ? `
                <div class="booking-section" style="margin-top: 2rem;">
                    <h4 style="margin-bottom: 1rem;">🏁 Past Trips</h4>
                    <div class="booking-cards">
                        ${pastBookings.map(booking => this.createRenterBookingCard(booking)).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    // Create renter booking card
    createRenterBookingCard(booking) {
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

        return `
            <div class="booking-card" style="
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 1rem;
                background: white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                display: flex;
                gap: 1rem;
            ">
                ${imageUrl ? `
                    <div class="booking-image" style="
                        width: 100px;
                        height: 80px;
                        border-radius: 6px;
                        overflow: hidden;
                        flex-shrink: 0;
                    ">
                        <img src="${window.viewVistaApp.sanitizeHTML(imageUrl)}" 
                             alt="${window.viewVistaApp.sanitizeHTML(property?.title || 'Property')}"
                             style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                ` : ''}
                
                <div class="booking-content" style="flex: 1;">
                    <div class="booking-header" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 0.5rem;
                    ">
                        <div>
                            <h5 style="margin: 0 0 0.25rem 0; color: #2c3e50;">
                                ${window.viewVistaApp.sanitizeHTML(property?.title || 'Property')}
                            </h5>
                            <p style="margin: 0; color: #666; font-size: 0.9rem;">
                                ${window.viewVistaApp.sanitizeHTML(property?.city || '')}, ${window.viewVistaApp.sanitizeHTML(property?.state || '')}
                            </p>
                        </div>
                        <span class="booking-status" style="
                            background: ${statusColors[booking.status] || '#95a5a6'};
                            color: white;
                            padding: 0.25rem 0.75rem;
                            border-radius: 12px;
                            font-size: 0.8rem;
                            font-weight: 500;
                            text-transform: capitalize;
                        ">
                            ${booking.status}
                        </span>
                    </div>

                    <div class="booking-details" style="font-size: 0.9rem; color: #666;">
                        <div style="margin-bottom: 0.25rem;">
                            📅 ${this.formatDate(booking.check_in_date)} - ${this.formatDate(booking.check_out_date)} (${nights} night${nights > 1 ? 's' : ''})
                        </div>
                        <div style="margin-bottom: 0.25rem;">
                            👥 ${booking.num_guests} guest${booking.num_guests > 1 ? 's' : ''}
                        </div>
                        <div style="font-weight: 500; color: #27ae60;">
                            💰 $${booking.total_amount} total
                        </div>
                    </div>

                    ${booking.status === 'pending' ? `
                        <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #f39c12;">
                            ⏳ Waiting for host approval
                        </div>
                    ` : isUpcoming && booking.status === 'confirmed' ? `
                        <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #27ae60;">
                            ✅ Confirmed - Get ready for your trip!
                        </div>
                    ` : isPast && booking.status !== 'cancelled' ? `
                        <div style="margin-top: 0.5rem;">
                            <button class="btn btn-sm btn-primary" onclick="alert('Review feature coming soon!')" 
                                    style="padding: 0.25rem 0.75rem; font-size: 0.8rem;">
                                ⭐ Write Review
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Update wishlist (placeholder implementation)
    updateWishlist(wishlist) {
        // This would populate the wishlist section
        // Implementation depends on specific requirements
    }

    // Utility: Format currency
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    // Utility: Format date
    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(new Date(date));
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on a dashboard page
    const isDashboardPage = window.location.pathname.includes('dashboard');
    
    if (isDashboardPage) {
        window.dashboardManager = new DashboardManager();
    }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardManager;
}