// Properties Page JavaScript
// Handles property search, filtering, display, and user interactions

class PropertiesManager {
    constructor() {
        this.supabaseClient = window.supabaseClient;
        this.properties = [];
        this.filteredProperties = [];
        this.currentPage = 1;
        this.propertiesPerPage = 12;
        this.currentView = 'grid';
        this.currentFilters = {};
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupAdvancedFilters();
        this.setupViewControls();
        this.setupPagination();
        this.handleUrlParameters();
        this.loadProperties();
        this.updateAuthUI();
    }

    // Setup event listeners
    setupEventListeners() {
        const searchForm = document.getElementById('propertySearchForm');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSearch();
            });
        }

        // Real-time search on input
        const locationInput = document.getElementById('location');
        if (locationInput) {
            locationInput.addEventListener('input', this.debounce(() => {
                this.handleSearch();
            }, 500));
        }

        // Date inputs
        const checkInInput = document.getElementById('checkIn');
        const checkOutInput = document.getElementById('checkOut');
        
        if (checkInInput && checkOutInput) {
            checkInInput.addEventListener('change', () => this.handleSearch());
            checkOutInput.addEventListener('change', () => this.validateDates());
        }

        // Sort dropdown
        const sortSelect = document.getElementById('sortBy');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => this.handleSort());
        }

        // Filter inputs
        this.setupFilterListeners();
    }

    // Setup filter input listeners
    setupFilterListeners() {
        const filterInputs = document.querySelectorAll('#advancedFilters input, #advancedFilters select');
        filterInputs.forEach(input => {
            const eventType = input.type === 'checkbox' ? 'change' : 'input';
            input.addEventListener(eventType, this.debounce(() => {
                this.handleSearch();
            }, 300));
        });
    }

    // Setup advanced filters toggle
    setupAdvancedFilters() {
        const advancedToggle = document.getElementById('advancedToggle');
        const advancedFilters = document.getElementById('advancedFilters');
        
        if (advancedToggle && advancedFilters) {
            advancedToggle.addEventListener('click', () => {
                const isVisible = advancedFilters.style.display !== 'none';
                
                if (isVisible) {
                    advancedFilters.style.display = 'none';
                    advancedToggle.classList.remove('active');
                } else {
                    advancedFilters.style.display = 'block';
                    advancedToggle.classList.add('active');
                }
            });
        }
    }

    // Setup view controls (grid/list)
    setupViewControls() {
        const viewButtons = document.querySelectorAll('.view-btn');
        const propertiesGrid = document.getElementById('propertiesGrid');
        
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                this.currentView = view;
                
                // Update button states
                viewButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update grid class
                if (propertiesGrid) {
                    propertiesGrid.classList.toggle('list-view', view === 'list');
                }
                
                // Re-render properties with new view
                this.renderProperties();
            });
        });
    }

    // Setup pagination
    setupPagination() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        }
    }

    // Handle URL parameters for bookmarkable searches
    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Pre-fill form from URL parameters
        const location = urlParams.get('location');
        const checkIn = urlParams.get('checkin');
        const checkOut = urlParams.get('checkout');
        const guests = urlParams.get('guests');
        const viewType = urlParams.get('view_type');
        const propertyType = urlParams.get('property_type');
        const minPrice = urlParams.get('min_price');
        const maxPrice = urlParams.get('max_price');

        if (location) {
            const locationInput = document.getElementById('location');
            if (locationInput) locationInput.value = location;
        }

        if (checkIn) {
            const checkInInput = document.getElementById('checkIn');
            if (checkInInput) checkInInput.value = checkIn;
        }

        if (checkOut) {
            const checkOutInput = document.getElementById('checkOut');
            if (checkOutInput) checkOutInput.value = checkOut;
        }

        if (guests) {
            const guestsSelect = document.getElementById('guests');
            if (guestsSelect) guestsSelect.value = guests;
        }

        if (viewType) {
            const viewTypeSelect = document.getElementById('viewType');
            if (viewTypeSelect) viewTypeSelect.value = viewType;
        }

        if (propertyType) {
            const propertyTypeSelect = document.getElementById('propertyType');
            if (propertyTypeSelect) propertyTypeSelect.value = propertyType;
        }

        if (minPrice) {
            const minPriceInput = document.getElementById('minPrice');
            if (minPriceInput) minPriceInput.value = minPrice;
        }

        if (maxPrice) {
            const maxPriceInput = document.getElementById('maxPrice');
            if (maxPriceInput) maxPriceInput.value = maxPrice;
        }
    }

    // Update URL with current search parameters
    updateUrl() {
        const formData = this.getFormData();
        const params = new URLSearchParams();
        
        Object.keys(formData).forEach(key => {
            if (formData[key] && formData[key].length > 0) {
                params.set(key, formData[key]);
            }
        });
        
        const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
        window.history.replaceState({}, '', newUrl);
    }

    // Get form data
    getFormData() {
        const form = document.getElementById('propertySearchForm');
        if (!form) return {};

        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            if (key === 'amenities') {
                if (!data.amenities) data.amenities = [];
                data.amenities.push(value);
            } else {
                data[key] = value;
            }
        }
        
        // Get checked amenities separately
        const amenityCheckboxes = form.querySelectorAll('input[name="amenities"]:checked');
        data.amenities = Array.from(amenityCheckboxes).map(cb => cb.value);
        
        return data;
    }

    // Validate date inputs
    validateDates() {
        const checkIn = document.getElementById('checkIn');
        const checkOut = document.getElementById('checkOut');
        
        if (checkIn && checkOut && checkIn.value && checkOut.value) {
            const checkInDate = new Date(checkIn.value);
            const checkOutDate = new Date(checkOut.value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Check-in can't be in the past
            if (checkInDate < today) {
                checkIn.value = today.toISOString().split('T')[0];
                this.showNotification('Check-in date cannot be in the past', 'warning');
            }
            
            // Check-out must be after check-in
            if (checkOutDate <= checkInDate) {
                const nextDay = new Date(checkInDate);
                nextDay.setDate(nextDay.getDate() + 1);
                checkOut.value = nextDay.toISOString().split('T')[0];
                this.showNotification('Check-out date must be after check-in date', 'warning');
            }
        }
        
        this.handleSearch();
    }

    // Handle search form submission
    async handleSearch() {
        if (this.isLoading) return;
        
        this.currentPage = 1;
        const formData = this.getFormData();
        this.currentFilters = formData;
        
        // Update URL
        this.updateUrl();
        
        // Apply filters to properties
        this.applyFilters();
        
        // Log search for analytics
        this.logSearch(formData);
    }

    // Handle sorting
    handleSort() {
        const sortSelect = document.getElementById('sortBy');
        if (!sortSelect) return;
        
        const sortBy = sortSelect.value;
        this.sortProperties(sortBy);
        this.renderProperties();
    }

    // Load properties from database
    async loadProperties() {
        this.showLoading(true);
        
        try {
            if (!this.supabaseClient.supabase) {
                // Use sample data if Supabase not configured
                this.properties = this.getSampleProperties();
            } else {
                const { data, error } = await this.supabaseClient.supabase
                    .from('properties')
                    .select(`
                        *,
                        property_images(image_url, is_primary),
                        user_profiles(first_name, last_name, profile_image_url),
                        reviews(overall_rating)
                    `)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                
                this.properties = data.map(property => this.processProperty(property));
            }
            
            this.filteredProperties = [...this.properties];
            this.applyFilters();
            
        } catch (error) {
            console.error('Error loading properties:', error);
            this.showError('Failed to load properties. Using sample data.');
            this.properties = this.getSampleProperties();
            this.filteredProperties = [...this.properties];
            this.renderProperties();
        } finally {
            this.showLoading(false);
        }
    }

    // Process property data from database
    processProperty(property) {
        // Calculate average rating
        const ratings = property.reviews || [];
        const avgRating = ratings.length > 0 
            ? ratings.reduce((sum, review) => sum + review.overall_rating, 0) / ratings.length 
            : 0;
        
        // Get primary image
        const images = property.property_images || [];
        const primaryImage = images.find(img => img.is_primary) || images[0];
        
        return {
            ...property,
            averageRating: avgRating,
            reviewCount: ratings.length,
            primaryImage: primaryImage?.image_url || null,
            ownerName: property.user_profiles 
                ? `${property.user_profiles.first_name} ${property.user_profiles.last_name}`
                : 'Host',
            images: images.map(img => img.image_url)
        };
    }

    // Apply filters to properties
    applyFilters() {
        const filters = this.currentFilters;
        let filtered = [...this.properties];
        
        // Location filter
        if (filters.location) {
            const location = filters.location.toLowerCase();
            filtered = filtered.filter(property => 
                property.city.toLowerCase().includes(location) ||
                property.state.toLowerCase().includes(location) ||
                property.country.toLowerCase().includes(location) ||
                property.title.toLowerCase().includes(location)
            );
        }
        
        // Guest count filter
        if (filters.guests) {
            const guestCount = parseInt(filters.guests.replace('+', ''));
            filtered = filtered.filter(property => property.max_guests >= guestCount);
        }
        
        // Price range filter
        if (filters.minPrice) {
            const minPrice = parseFloat(filters.minPrice);
            filtered = filtered.filter(property => property.base_price >= minPrice);
        }
        
        if (filters.maxPrice) {
            const maxPrice = parseFloat(filters.maxPrice);
            filtered = filtered.filter(property => property.base_price <= maxPrice);
        }
        
        // View type filter
        if (filters.viewType) {
            filtered = filtered.filter(property => 
                property.view_type.toLowerCase() === filters.viewType.toLowerCase()
            );
        }
        
        // Property type filter
        if (filters.propertyType) {
            filtered = filtered.filter(property => 
                property.property_type.toLowerCase() === filters.propertyType.toLowerCase()
            );
        }
        
        // Amenities filter
        if (filters.amenities && filters.amenities.length > 0) {
            filtered = filtered.filter(property => {
                const propertyAmenities = property.amenities || [];
                return filters.amenities.every(amenity => 
                    propertyAmenities.includes(amenity)
                );
            });
        }
        
        // Date availability filter (would need to check availability table)
        if (filters.checkIn && filters.checkOut) {
            // This would require a more complex query to check availability
            // For now, we'll skip this filter in the frontend
        }
        
        this.filteredProperties = filtered;
        this.renderProperties();
    }

    // Sort properties
    sortProperties(sortBy) {
        switch (sortBy) {
            case 'price_low':
                this.filteredProperties.sort((a, b) => a.base_price - b.base_price);
                break;
            case 'price_high':
                this.filteredProperties.sort((a, b) => b.base_price - a.base_price);
                break;
            case 'rating':
                this.filteredProperties.sort((a, b) => b.averageRating - a.averageRating);
                break;
            case 'newest':
                this.filteredProperties.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            default: // relevance
                // Keep original order or implement relevance scoring
                break;
        }
    }

    // Render properties
    renderProperties() {
        const grid = document.getElementById('propertiesGrid');
        if (!grid) return;
        
        // Calculate pagination
        const totalProperties = this.filteredProperties.length;
        const totalPages = Math.ceil(totalProperties / this.propertiesPerPage);
        const startIndex = (this.currentPage - 1) * this.propertiesPerPage;
        const endIndex = startIndex + this.propertiesPerPage;
        const currentProperties = this.filteredProperties.slice(startIndex, endIndex);
        
        // Update results count
        this.updateResultsCount(totalProperties);
        
        // Show no results if empty
        if (totalProperties === 0) {
            this.showNoResults();
            return;
        }
        
        // Hide no results and loading states
        this.hideNoResults();
        this.showLoading(false);
        
        // Render property cards
        grid.innerHTML = currentProperties.map(property => this.renderPropertyCard(property)).join('');
        
        // Setup property card event listeners
        this.setupPropertyCardListeners();
        
        // Update pagination
        this.updatePagination(totalPages);
    }

    // Render individual property card
    renderPropertyCard(property) {
        const imageUrl = property.primaryImage || property.images?.[0];
        const hasImage = imageUrl && imageUrl !== null;
        
        return `
            <div class="property-card" data-property-id="${property.id}" tabindex="0">
                <div class="property-image">
                    ${hasImage 
                        ? `<img src="${imageUrl}" alt="${property.title}" loading="lazy">`
                        : `<div class="image-placeholder">${property.title}</div>`
                    }
                    ${property.featured ? '<div class="property-badge">Featured</div>' : ''}
                    <button class="wishlist-btn" data-property-id="${property.id}" aria-label="Add to wishlist">
                        <span>♡</span>
                    </button>
                </div>
                <div class="property-info">
                    <h3 class="property-title">${property.title}</h3>
                    <p class="property-location">
                        <span class="location-icon">📍</span>
                        ${property.city}, ${property.state}
                    </p>
                    <div class="property-features">
                        ${property.bedrooms ? `<span>${property.bedrooms} bed${property.bedrooms > 1 ? 's' : ''}</span>` : ''}
                        ${property.bathrooms ? `<span>${property.bathrooms} bath${property.bathrooms > 1 ? 's' : ''}</span>` : ''}
                        ${property.max_guests ? `<span>${property.max_guests} guest${property.max_guests > 1 ? 's' : ''}</span>` : ''}
                    </div>
                    ${property.averageRating > 0 ? `
                        <div class="property-rating">
                            <span class="stars">${'★'.repeat(Math.floor(property.averageRating))}${'☆'.repeat(5 - Math.floor(property.averageRating))}</span>
                            <span class="rating-number">${property.averageRating.toFixed(1)}</span>
                            <span class="rating-count">(${property.reviewCount} review${property.reviewCount !== 1 ? 's' : ''})</span>
                        </div>
                    ` : ''}
                    <div class="property-price">
                        <span class="price">$${property.base_price}</span>
                        <span class="period">/night</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Setup property card event listeners
    setupPropertyCardListeners() {
        const propertyCards = document.querySelectorAll('.property-card');
        const wishlistBtns = document.querySelectorAll('.wishlist-btn');
        
        propertyCards.forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.wishlist-btn')) {
                    const propertyId = card.getAttribute('data-property-id');
                    this.showPropertyModal(propertyId);
                }
            });
            
            // Keyboard support
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const propertyId = card.getAttribute('data-property-id');
                    this.showPropertyModal(propertyId);
                }
            });
        });
        
        wishlistBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const propertyId = btn.getAttribute('data-property-id');
                this.toggleWishlist(propertyId, btn);
            });
        });
    }

    // Show property modal
    showPropertyModal(propertyId) {
        const property = this.properties.find(p => p.id === propertyId);
        if (!property) return;
        
        const modal = document.getElementById('propertyModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        
        if (modal && modalTitle && modalBody) {
            modalTitle.textContent = property.title;
            modalBody.innerHTML = this.renderPropertyModalContent(property);
            
            // Show modal
            modal.style.display = 'flex';
            
            // Setup modal close
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
            
            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
    }

    // Render property modal content
    renderPropertyModalContent(property) {
        const imageUrl = property.primaryImage || property.images?.[0];
        const hasImage = imageUrl && imageUrl !== null;
        
        return `
            ${hasImage 
                ? `<img src="${imageUrl}" alt="${property.title}" class="modal-property-image">`
                : `<div class="image-placeholder" style="height: 300px;">${property.title}</div>`
            }
            <div class="modal-property-content">
                <div class="modal-property-header">
                    <div>
                        <h2 class="modal-property-title">${property.title}</h2>
                        <p class="modal-property-location">
                            📍 ${property.address || `${property.city}, ${property.state}, ${property.country}`}
                        </p>
                    </div>
                    <div class="modal-property-price">
                        <div class="modal-price">$${property.base_price}</div>
                        <div class="modal-period">/night</div>
                    </div>
                </div>
                
                <div class="modal-property-details">
                    <div class="detail-section">
                        <h4>Property Details</h4>
                        <p><strong>Type:</strong> ${property.property_type}</p>
                        <p><strong>View:</strong> ${property.view_type}</p>
                        ${property.bedrooms ? `<p><strong>Bedrooms:</strong> ${property.bedrooms}</p>` : ''}
                        ${property.bathrooms ? `<p><strong>Bathrooms:</strong> ${property.bathrooms}</p>` : ''}
                        <p><strong>Max Guests:</strong> ${property.max_guests}</p>
                        ${property.property_size ? `<p><strong>Size:</strong> ${property.property_size} sq ft</p>` : ''}
                    </div>
                    
                    <div class="detail-section">
                        <h4>Description</h4>
                        <p>${property.description || 'No description available.'}</p>
                    </div>
                    
                    ${property.amenities && property.amenities.length > 0 ? `
                        <div class="detail-section">
                            <h4>Amenities</h4>
                            <ul>
                                ${property.amenities.map(amenity => `<li>${amenity}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    <div class="detail-section">
                        <h4>Pricing</h4>
                        <p><strong>Base Price:</strong> $${property.base_price}/night</p>
                        ${property.cleaning_fee ? `<p><strong>Cleaning Fee:</strong> $${property.cleaning_fee}</p>` : ''}
                        ${property.min_stay ? `<p><strong>Minimum Stay:</strong> ${property.min_stay} night${property.min_stay > 1 ? 's' : ''}</p>` : ''}
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="document.getElementById('propertyModal').style.display='none'">
                        Close
                    </button>
                    <button class="btn btn-primary" onclick="alert('Booking functionality coming soon!')">
                        Book Now
                    </button>
                </div>
            </div>
        `;
    }

    // Toggle wishlist
    async toggleWishlist(propertyId, button) {
        if (!this.supabaseClient.isAuthenticated()) {
            this.showNotification('Please sign in to save properties to your wishlist', 'info');
            return;
        }
        
        try {
            const isActive = button.classList.contains('active');
            
            if (isActive) {
                // Remove from wishlist
                button.classList.remove('active');
                button.innerHTML = '<span>♡</span>';
                this.showNotification('Removed from wishlist', 'success');
            } else {
                // Add to wishlist
                button.classList.add('active');
                button.innerHTML = '<span>♥</span>';
                this.showNotification('Added to wishlist', 'success');
            }
            
            // TODO: Implement actual wishlist API calls when Supabase is configured
            
        } catch (error) {
            console.error('Error updating wishlist:', error);
            this.showNotification('Failed to update wishlist', 'error');
        }
    }

    // Pagination
    goToPage(page) {
        const totalPages = Math.ceil(this.filteredProperties.length / this.propertiesPerPage);
        
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.renderProperties();
        
        // Scroll to top of results
        document.querySelector('.search-results').scrollIntoView({ behavior: 'smooth' });
    }

    // Update pagination UI
    updatePagination(totalPages) {
        const pagination = document.getElementById('pagination');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const paginationNumbers = document.getElementById('paginationNumbers');
        
        if (!pagination) return;
        
        // Show/hide pagination
        pagination.style.display = totalPages > 1 ? 'flex' : 'none';
        
        if (totalPages <= 1) return;
        
        // Update previous/next buttons
        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages;
        }
        
        // Update page numbers
        if (paginationNumbers) {
            paginationNumbers.innerHTML = this.generatePaginationNumbers(totalPages);
            
            // Setup page number clicks
            const pageNumbers = paginationNumbers.querySelectorAll('.pagination-number');
            pageNumbers.forEach(btn => {
                btn.addEventListener('click', () => {
                    const page = parseInt(btn.textContent);
                    this.goToPage(page);
                });
            });
        }
    }

    // Generate pagination numbers
    generatePaginationNumbers(totalPages) {
        const maxVisible = 7;
        let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }
        
        const numbers = [];
        
        // First page
        if (start > 1) {
            numbers.push(`<button class="pagination-number" data-page="1">1</button>`);
            if (start > 2) {
                numbers.push(`<span class="pagination-ellipsis">...</span>`);
            }
        }
        
        // Page numbers
        for (let i = start; i <= end; i++) {
            const isActive = i === this.currentPage ? 'active' : '';
            numbers.push(`<button class="pagination-number ${isActive}" data-page="${i}">${i}</button>`);
        }
        
        // Last page
        if (end < totalPages) {
            if (end < totalPages - 1) {
                numbers.push(`<span class="pagination-ellipsis">...</span>`);
            }
            numbers.push(`<button class="pagination-number" data-page="${totalPages}">${totalPages}</button>`);
        }
        
        return numbers.join('');
    }

    // Update results count
    updateResultsCount(count) {
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            const text = count === 0 
                ? 'No properties found'
                : count === 1 
                    ? '1 property found'
                    : `${count} properties found`;
            resultsCount.textContent = text;
        }
    }

    // Show/hide loading state
    showLoading(show) {
        const loadingState = document.getElementById('loadingState');
        const propertiesGrid = document.getElementById('propertiesGrid');
        
        this.isLoading = show;
        
        if (loadingState) {
            loadingState.style.display = show ? 'block' : 'none';
        }
        
        if (show && propertiesGrid) {
            propertiesGrid.innerHTML = '<div class="loading-properties" id="loadingState"><div class="loading-spinner"></div><p>Finding amazing properties for you...</p></div>';
        }
    }

    // Show/hide no results state
    showNoResults() {
        const noResults = document.getElementById('noResults');
        const pagination = document.getElementById('pagination');
        
        if (noResults) noResults.style.display = 'block';
        if (pagination) pagination.style.display = 'none';
        
        document.getElementById('propertiesGrid').innerHTML = '';
    }

    hideNoResults() {
        const noResults = document.getElementById('noResults');
        if (noResults) noResults.style.display = 'none';
    }

    // Clear all filters
    clearFilters() {
        const form = document.getElementById('propertySearchForm');
        if (form) {
            form.reset();
            this.currentFilters = {};
            this.applyFilters();
            this.updateUrl();
        }
    }

    // Update authentication UI
    updateAuthUI() {
        const authLink = document.getElementById('auth-link');
        const registerLink = document.getElementById('register-link');
        
        if (this.supabaseClient.isAuthenticated()) {
            if (authLink) {
                authLink.textContent = 'Dashboard';
                authLink.href = '#dashboard';
                authLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.supabaseClient.redirectToDashboardIfNeeded();
                });
            }
            
            if (registerLink) {
                registerLink.textContent = 'Logout';
                registerLink.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await this.supabaseClient.signOut();
                });
            }
        }
    }

    // Log search for analytics
    async logSearch(searchData) {
        if (!this.supabaseClient.supabase) return;
        
        try {
            const sessionId = this.getSessionId();
            
            await this.supabaseClient.supabase
                .from('search_logs')
                .insert([{
                    user_id: this.supabaseClient.user?.id || null,
                    session_id: sessionId,
                    search_query: searchData.location || null,
                    location: searchData.location || null,
                    check_in_date: searchData.checkIn || null,
                    check_out_date: searchData.checkOut || null,
                    num_guests: searchData.guests ? parseInt(searchData.guests.replace('+', '')) : null,
                    price_min: searchData.minPrice ? parseFloat(searchData.minPrice) : null,
                    price_max: searchData.maxPrice ? parseFloat(searchData.maxPrice) : null,
                    property_type: searchData.propertyType || null,
                    amenities: searchData.amenities || [],
                    results_count: this.filteredProperties.length
                }]);
        } catch (error) {
            console.error('Error logging search:', error);
        }
    }

    // Get or create session ID
    getSessionId() {
        let sessionId = sessionStorage.getItem('search_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('search_session_id', sessionId);
        }
        return sessionId;
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type}`;
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '10000';
        notification.style.minWidth = '250px';
        
        document.body.appendChild(notification);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Show error message
    showError(message) {
        this.showNotification(message, 'error');
    }

    // Utility: Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Get sample properties (for when Supabase is not configured)
    getSampleProperties() {
        return [
            {
                id: 'sample-1',
                title: 'Mountain Vista Cabin',
                description: 'A cozy cabin with breathtaking mountain views. Perfect for a peaceful getaway with hiking trails right outside your door.',
                property_type: 'cabin',
                view_type: 'mountain',
                address: '123 Mountain View Road',
                city: 'Aspen',
                state: 'Colorado',
                country: 'United States',
                bedrooms: 2,
                bathrooms: 1.5,
                max_guests: 4,
                base_price: 150,
                currency: 'USD',
                cleaning_fee: 50,
                min_stay: 2,
                amenities: ['wifi', 'parking', 'kitchen', 'fireplace'],
                is_active: true,
                featured: true,
                averageRating: 4.8,
                reviewCount: 23,
                primaryImage: null,
                images: [],
                created_at: '2024-01-15T00:00:00Z'
            },
            {
                id: 'sample-2',
                title: 'Ocean View Apartment',
                description: 'Modern apartment with stunning ocean views. Wake up to the sound of waves and enjoy spectacular sunsets from your private balcony.',
                property_type: 'apartment',
                view_type: 'ocean',
                address: '456 Coastal Highway',
                city: 'Malibu',
                state: 'California',
                country: 'United States',
                bedrooms: 1,
                bathrooms: 1,
                max_guests: 2,
                base_price: 250,
                currency: 'USD',
                cleaning_fee: 75,
                min_stay: 3,
                amenities: ['wifi', 'pool', 'kitchen', 'balcony'],
                is_active: true,
                featured: false,
                averageRating: 4.9,
                reviewCount: 15,
                primaryImage: null,
                images: [],
                created_at: '2024-01-10T00:00:00Z'
            },
            {
                id: 'sample-3',
                title: 'City Skyline Loft',
                description: 'Industrial loft with panoramic city views. Located in the heart of downtown with easy access to restaurants and entertainment.',
                property_type: 'loft',
                view_type: 'city',
                address: '789 Downtown Street',
                city: 'New York',
                state: 'New York',
                country: 'United States',
                bedrooms: 1,
                bathrooms: 1,
                max_guests: 3,
                base_price: 300,
                currency: 'USD',
                cleaning_fee: 100,
                min_stay: 1,
                amenities: ['wifi', 'gym', 'kitchen', 'rooftop'],
                is_active: true,
                featured: false,
                averageRating: 4.6,
                reviewCount: 31,
                primaryImage: null,
                images: [],
                created_at: '2024-01-05T00:00:00Z'
            },
            {
                id: 'sample-4',
                title: 'Forest Retreat House',
                description: 'Secluded house surrounded by ancient trees. Perfect for nature lovers seeking tranquility and fresh air.',
                property_type: 'house',
                view_type: 'forest',
                address: '321 Forest Lane',
                city: 'Portland',
                state: 'Oregon',
                country: 'United States',
                bedrooms: 3,
                bathrooms: 2,
                max_guests: 6,
                base_price: 200,
                currency: 'USD',
                cleaning_fee: 80,
                min_stay: 2,
                amenities: ['wifi', 'parking', 'kitchen', 'fireplace', 'petFriendly'],
                is_active: true,
                featured: true,
                averageRating: 4.7,
                reviewCount: 18,
                primaryImage: null,
                images: [],
                created_at: '2024-01-12T00:00:00Z'
            },
            {
                id: 'sample-5',
                title: 'Lake House Villa',
                description: 'Luxurious villa overlooking a pristine lake. Features private dock and stunning sunrise views.',
                property_type: 'villa',
                view_type: 'lake',
                address: '654 Lakeshore Drive',
                city: 'Lake Tahoe',
                state: 'California',
                country: 'United States',
                bedrooms: 4,
                bathrooms: 3,
                max_guests: 8,
                base_price: 400,
                currency: 'USD',
                cleaning_fee: 150,
                min_stay: 3,
                amenities: ['wifi', 'parking', 'kitchen', 'pool', 'dock'],
                is_active: true,
                featured: true,
                averageRating: 4.9,
                reviewCount: 27,
                primaryImage: null,
                images: [],
                created_at: '2024-01-08T00:00:00Z'
            },
            {
                id: 'sample-6',
                title: 'Countryside Cottage',
                description: 'Charming cottage in rolling hills with panoramic countryside views. Perfect for a romantic getaway.',
                property_type: 'cottage',
                view_type: 'countryside',
                address: '987 Country Road',
                city: 'Napa',
                state: 'California',
                country: 'United States',
                bedrooms: 2,
                bathrooms: 1,
                max_guests: 4,
                base_price: 180,
                currency: 'USD',
                cleaning_fee: 60,
                min_stay: 2,
                amenities: ['wifi', 'parking', 'kitchen', 'garden'],
                is_active: true,
                featured: false,
                averageRating: 4.5,
                reviewCount: 12,
                primaryImage: null,
                images: [],
                created_at: '2024-01-20T00:00:00Z'
            }
        ];
    }
}

// Global function for clearing filters (called from HTML)
window.clearFilters = function() {
    if (window.propertiesManager) {
        window.propertiesManager.clearFilters();
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the properties page
    const isPropertiesPage = window.location.pathname.includes('properties.html') ||
                            window.location.pathname.endsWith('properties');
    
    if (isPropertiesPage) {
        window.propertiesManager = new PropertiesManager();
    }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PropertiesManager;
}