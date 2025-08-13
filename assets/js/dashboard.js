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

            // Load bookings
            const { data: bookings, error: bookingsError } = await this.supabaseClient.supabase
                .from('bookings')
                .select('*')
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
            this.updateRecentBookings(bookings);

        } catch (error) {
            console.error('Error loading owner data:', error);
            this.loadSampleOwnerData();
        }
    }

    // Load renter-specific data
    async loadRenterData() {
        try {
            const userId = this.supabaseClient.getCurrentUser()?.id;
            
            // Load bookings
            const { data: bookings, error: bookingsError } = await this.supabaseClient.supabase
                .from('bookings')
                .select('*, properties(title, city, state)')
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
            this.updateUpcomingBookings(bookings);
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

    // Update recent bookings (placeholder implementation)
    updateRecentBookings(bookings) {
        // This would populate the recent bookings section
        // Implementation depends on specific requirements
    }

    // Update upcoming bookings (placeholder implementation)
    updateUpcomingBookings(bookings) {
        // This would populate the upcoming bookings section
        // Implementation depends on specific requirements
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