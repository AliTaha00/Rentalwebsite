/**
 * Property Detail Page
 * Handles property detail page logic
 */

'use strict';

class PropertyDetailPage {
    constructor() {
        this.propertyId = new URLSearchParams(window.location.search).get('id');
        this.property = null;
        this.selectedDates = { checkIn: null, checkOut: null };
        this.flatpickrInstance = null;

        if (!this.propertyId) {
            this.showError();
            return;
        }

        this.init();
    }

    async init() {
        try {
            console.log('Property Detail Page - Initializing...');
            console.log('Property ID:', this.propertyId);

            await window.supabaseClient.waitForInit();
            console.log('Supabase initialized');

            await this.loadPropertyData();
            console.log('Property data loaded:', this.property);

            this.render();
            this.setupEventListeners();
            await this.checkIfSaved();
        } catch (error) {
            console.error('Error initializing property detail page:', error);
            console.error('Error details:', error.message);
            this.showError(error.message);
        }
    }

    async loadPropertyData() {
        try {
            console.log('Fetching property with ID:', this.propertyId);

            // Check if PropertyService exists
            if (!window.PropertyService) {
                throw new Error('PropertyService not loaded. Check if property-service.js is included.');
            }

            this.property = await window.PropertyService.getPropertyById(this.propertyId);

            if (!this.property) {
                throw new Error('Property not found in database');
            }

            console.log('Property loaded successfully:', this.property.title);
        } catch (error) {
            console.error('Error loading property:', error);
            throw error;
        }
    }

    render() {
        if (!this.property) {
            this.showError();
            return;
        }

        // Hide loading, show content
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('propertyContent').style.display = 'block';

        // Update page title
        document.title = `${this.property.title} - RentThatView`;

        // Render sections
        this.renderHeader();
        this.renderGallery();
        this.renderHostInfo();
        this.renderPropertyDetails();
        this.renderDescription();
        this.renderAmenities();
        this.renderBookingCard();
        this.loadReviews();
    }

    renderHeader() {
        document.getElementById('propertyTitle').textContent = this.property.title;

        // Location
        const locationEl = document.getElementById('propertyLocation');
        locationEl.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span>${this.escapeHtml(this.property.city)}, ${this.escapeHtml(this.property.state || this.property.country)}</span>
        `;

        // Rating (placeholder if no reviews)
        const ratingEl = document.getElementById('propertyRating');
        if (this.property.average_rating) {
            ratingEl.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
                <span><strong>${this.property.average_rating.toFixed(1)}</strong> (${this.property.review_count || 0} reviews)</span>
            `;
        } else {
            ratingEl.innerHTML = `<span>No reviews yet</span>`;
        }
    }

    renderGallery() {
        const galleryGrid = document.getElementById('galleryGrid');
        const images = this.property.images || [];

        if (images.length === 0) {
            // Show placeholder
            galleryGrid.innerHTML = `
                <div class="gallery-item">
                    <img src="https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&auto=format&fit=crop&q=80" alt="Property">
                </div>
            `;
            return;
        }

        // Show up to 5 images
        const displayImages = images.slice(0, 5);
        galleryGrid.innerHTML = displayImages.map((img, index) => `
            <div class="gallery-item" data-index="${index}">
                <img src="${img.image_url}" alt="${this.escapeHtml(img.caption || this.property.title)}">
                ${index === 4 && images.length > 5 ? `
                    <button class="gallery-show-all">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M4 4h7V11H4zm9 0h7V11h-7zM4 13h7v7H4zm9 0h7v7h-7z"/>
                        </svg>
                        <span>Show all ${images.length} photos</span>
                    </button>
                ` : ''}
            </div>
        `).join('');

        // Setup gallery click handlers
        galleryGrid.querySelectorAll('.gallery-item').forEach(item => {
            item.addEventListener('click', () => {
                // TODO: Open full-screen gallery lightbox
                if (window.UI?.showToast) {
                    window.UI.showToast('Full gallery view coming soon!', 'info');
                }
            });
        });
    }

    renderHostInfo() {
        const hostInfo = document.getElementById('hostInfo');
        const owner = this.property.user_profiles;

        if (!owner) {
            hostInfo.innerHTML = '<p>Host information not available</p>';
            return;
        }

        const hostName = `${owner.first_name} ${owner.last_name}`;
        const hostAvatar = owner.profile_image_url || this.getInitialsAvatar(hostName);

        hostInfo.innerHTML = `
            <div class="host-avatar">
                ${owner.profile_image_url
                    ? `<img src="${owner.profile_image_url}" alt="${this.escapeHtml(hostName)}">`
                    : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--primary-light); font-size: 24px; font-weight: bold; color: var(--primary-color);">${this.getInitials(hostName)}</div>`
                }
            </div>
            <div class="host-details">
                <h3>Hosted by ${this.escapeHtml(hostName)}</h3>
                <div class="host-stats">
                    <span>Joined 2024</span>
                </div>
            </div>
        `;
    }

    renderPropertyDetails() {
        const detailsList = document.getElementById('propertyDetailsList');

        const details = [
            {
                icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 9.556V3h-2v2H6V3H4v6.556C2.81 10.25 2 11.526 2 13v4a1 1 0 0 0 1 1h1v4h2v-4h12v4h2v-4h1a1 1 0 0 0 1-1v-4c0-1.474-.811-2.75-2-3.444z"/></svg>',
                label: 'Bedrooms',
                value: this.property.bedrooms || 'N/A'
            },
            {
                icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 10h-2V4h-3v6H8V4H5v6H3a1 1 0 0 0-1 1v2c0 1.86 1.28 3.41 3 3.86V20a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3h6v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3.14c1.72-.45 3-2 3-3.86v-2a1 1 0 0 0-1-1z"/></svg>',
                label: 'Bathrooms',
                value: this.property.bathrooms || 'N/A'
            },
            {
                icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
                label: 'Max Guests',
                value: this.property.max_guests || 'N/A'
            },
            {
                icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/></svg>',
                label: 'Property Type',
                value: this.formatPropertyType(this.property.property_type)
            }
        ];

        detailsList.innerHTML = details.map(detail => `
            <div class="detail-item">
                <div class="detail-icon">${detail.icon}</div>
                <div class="detail-content">
                    <h4>${detail.value}</h4>
                    <p>${detail.label}</p>
                </div>
            </div>
        `).join('');
    }

    renderDescription() {
        const descriptionEl = document.getElementById('propertyDescription');
        const description = this.property.description || 'No description available.';

        descriptionEl.innerHTML = `<p>${this.escapeHtml(description)}</p>`;
    }

    renderAmenities() {
        const amenitiesGrid = document.getElementById('amenitiesGrid');
        const amenities = this.property.amenities || [];

        if (amenities.length === 0) {
            amenitiesGrid.innerHTML = '<p>No amenities listed</p>';
            return;
        }

        const amenityIcons = {
            'wifi': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>',
            'parking': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z"/></svg>',
            'pool': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 21c-1.11 0-1.73-.37-2.18-.64-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.46.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.46.27-1.08.64-2.19.64-1.11 0-1.73-.37-2.18-.64-.37-.23-.6-.36-1.15-.36s-.78.13-1.15.36c-.46.27-1.08.64-2.19.64v-2c.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64s1.73.37 2.18.64c.37.23.59.36 1.15.36.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64 1.11 0 1.73.37 2.18.64.37.22.6.36 1.15.36s.78-.13 1.15-.36c.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.23.59.36 1.15.36v2zm0-4.5c-1.11 0-1.73-.37-2.18-.64-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.45.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.45.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36s-.78.13-1.15.36c-.47.27-1.09.64-2.2.64v-2c.56 0 .78-.13 1.15-.36.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.22.6.36 1.15.36.56 0 .78-.13 1.15-.36.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.22.6.36 1.15.36s.78-.13 1.15-.36c.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.22.6.36 1.15.36v2zM8.67 12c.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64 1.11 0 1.73.37 2.18.64.37.22.6.36 1.15.36s.78-.13 1.15-.36c.12-.07.26-.15.41-.23L10.48 5C8.93 3.45 7.5 2.99 5 3v2.5c1.82-.01 2.89.39 4 1.5l1 1-3.25 3.25c.31.12.56.27.77.39.37.23.59.36 1.15.36z"/></svg>',
            'kitchen': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2.01L6 2c-1.1 0-2 .89-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.11-.9-1.99-2-1.99zM18 20H6v-9.02h12V20zm0-11H6V4h12v5zM8 5h2v3H8zm0 7h2v5H8z"/></svg>',
            'petFriendly': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 9.5m-2.5 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M9 5.5m-2.5 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0m6.5 0m-2.5 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0m2.5 4m-2.5 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M9.63 17.93c-.56-.37-1.08-.86-2.13-.86s-1.56.49-2.13.86c-.57.37-.94.57-1.71.57S2.19 17.54 2 17.4v2.07c.19.14 1.44 1.03 2.66 1.03.53 0 1.03-.11 1.34-.25.31-.14.62-.27 1-.27.37 0 .69.13 1 .27.31.14.81.25 1.34.25 1.22 0 2.47-.89 2.66-1.03v-2.07c-.19.14-1.47.53-2.37.53-.77 0-1.14-.2-1.71-.57z"/></svg>',
            'default': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
        };

        amenitiesGrid.innerHTML = amenities.map(amenity => `
            <div class="amenity-item">
                <div class="amenity-icon">
                    ${amenityIcons[amenity] || amenityIcons.default}
                </div>
                <span>${this.formatAmenity(amenity)}</span>
            </div>
        `).join('');
    }

    renderBookingCard() {
        const priceAmount = document.getElementById('priceAmount');
        priceAmount.textContent = `$${this.formatPrice(this.property.base_price)}`;

        // Setup date picker
        this.flatpickrInstance = flatpickr('#dateRange', {
            mode: 'range',
            minDate: 'today',
            dateFormat: 'M j',
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    this.selectedDates.checkIn = selectedDates[0];
                    this.selectedDates.checkOut = selectedDates[1];
                    this.updateBookingSummary();
                }
            }
        });
    }

    updateBookingSummary() {
        if (!this.selectedDates.checkIn || !this.selectedDates.checkOut) {
            document.getElementById('bookingSummary').style.display = 'none';
            return;
        }

        const nights = Math.ceil((this.selectedDates.checkOut - this.selectedDates.checkIn) / (1000 * 60 * 60 * 24));
        const basePrice = this.property.base_price;
        const subtotal = basePrice * nights;
        const cleaningFee = this.property.cleaning_fee || 0;
        const serviceFee = subtotal * (this.property.service_fee_percentage || 0) / 100;
        const total = subtotal + cleaningFee + serviceFee;

        document.getElementById('nightsLabel').textContent = `$${this.formatPrice(basePrice)} x ${nights} night${nights > 1 ? 's' : ''}`;
        document.getElementById('subtotal').textContent = `$${this.formatPrice(subtotal)}`;

        if (cleaningFee > 0) {
            document.getElementById('cleaningFeeRow').style.display = 'flex';
            document.getElementById('cleaningFee').textContent = `$${this.formatPrice(cleaningFee)}`;
        }

        if (serviceFee > 0) {
            document.getElementById('serviceFeeRow').style.display = 'flex';
            document.getElementById('serviceFee').textContent = `$${this.formatPrice(serviceFee)}`;
        }

        document.getElementById('totalPrice').textContent = `$${this.formatPrice(total)}`;
        document.getElementById('bookingSummary').style.display = 'block';
    }

    async loadReviews() {
        try {
            const reviews = await window.PropertyService.getPropertyReviews(this.propertyId, 5);

            if (reviews.length === 0) {
                document.getElementById('reviewsSection').style.display = 'none';
                return;
            }

            const reviewList = document.getElementById('reviewList');
            reviewList.innerHTML = reviews.map(review => {
                const reviewerName = `${review.user_profiles.first_name} ${review.user_profiles.last_name}`;
                return `
                    <div class="review-item">
                        <div class="review-header">
                            <div class="reviewer-avatar">
                                ${review.user_profiles.profile_image_url
                                    ? `<img src="${review.user_profiles.profile_image_url}" alt="${this.escapeHtml(reviewerName)}">`
                                    : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--primary-light); font-weight: bold; color: var(--primary-color);">${this.getInitials(reviewerName)}</div>`
                                }
                            </div>
                            <div class="reviewer-info">
                                <h4>${this.escapeHtml(reviewerName)}</h4>
                                <div class="review-date">${this.formatDate(review.created_at)}</div>
                            </div>
                        </div>
                        <div class="review-rating">
                            ${this.renderStars(review.rating)}
                        </div>
                        <div class="review-text">${this.escapeHtml(review.review_text)}</div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading reviews:', error);
        }
    }

    setupEventListeners() {
        // Booking form submission
        document.getElementById('bookingForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBooking();
        });

        // Share button
        document.getElementById('shareBtn').addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({
                    title: this.property.title,
                    url: window.location.href
                });
            } else {
                navigator.clipboard.writeText(window.location.href);
                if (window.UI?.showToast) {
                    window.UI.showToast('Link copied to clipboard!', 'success');
                }
            }
        });

        // Save button
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.addEventListener('click', async () => {
            await this.toggleWishlist();
        });
    }

    async handleBooking() {
        const isAuthenticated = window.supabaseClient?.isAuthenticated();

        if (!isAuthenticated) {
            if (window.UI?.showToast) {
                window.UI.showToast('Please log in to make a reservation', 'info');
            }
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            return;
        }

        if (!this.selectedDates.checkIn || !this.selectedDates.checkOut) {
            if (window.UI?.showToast) {
                window.UI.showToast('Please select check-in and check-out dates', 'warning');
            }
            return;
        }

        try {
            const user = window.supabaseClient.user;

            // Get guest count
            const guestCount = parseInt(document.getElementById('guestCount')?.value || 1);

            // Calculate nights
            const checkIn = new Date(this.selectedDates.checkIn);
            const checkOut = new Date(this.selectedDates.checkOut);
            const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

            // Calculate total price
            const basePrice = parseFloat(this.property.base_price);
            const cleaningFee = parseFloat(this.property.cleaning_fee || 0);
            const totalAmount = (basePrice * nights) + cleaningFee;

            // Show loading
            if (window.UI?.showToast) {
                window.UI.showToast('Creating booking...', 'info');
            }

            // Create booking in database
            const { data: booking, error } = await window.supabaseClient.supabase
                .from('bookings')
                .insert({
                    property_id: this.propertyId,
                    guest_id: user.id,
                    check_in_date: this.selectedDates.checkIn,
                    check_out_date: this.selectedDates.checkOut,
                    num_guests: guestCount,
                    total_amount: totalAmount,
                    status: 'pending',
                    payment_status: 'unpaid'
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            if (window.UI?.showToast) {
                window.UI.showToast('Booking created! Redirecting to payment...', 'success');
            }

            // Redirect to renter dashboard where they can pay
            setTimeout(() => {
                window.location.href = 'renter-dashboard.html';
            }, 1500);

        } catch (error) {
            console.error('Error creating booking:', error);
            if (window.UI?.showToast) {
                window.UI.showToast('Failed to create booking. Please try again.', 'error');
            }
        }
    }

    async checkIfSaved() {
        const isAuthenticated = window.supabaseClient?.isAuthenticated();
        if (!isAuthenticated) return;

        try {
            const user = window.supabaseClient.user;
            if (!user) return;

            const { data, error } = await window.supabaseClient.supabase
                .from('wishlists')
                .select('id')
                .eq('user_id', user.id)
                .eq('property_id', this.propertyId)
                .single();

            if (data) {
                const saveBtn = document.getElementById('saveBtn');
                const textSpan = saveBtn?.querySelector('span');
                const svg = saveBtn?.querySelector('svg');

                if (saveBtn) {
                    saveBtn.classList.add('saved');
                    if (textSpan) textSpan.textContent = 'Saved';
                    if (svg) svg.setAttribute('fill', 'currentColor');
                }
            }
        } catch (error) {
            // Property not in wishlist, which is fine
            console.log('Property not in wishlist');
        }
    }

    async toggleWishlist() {
        const isAuthenticated = window.supabaseClient?.isAuthenticated();
        if (!isAuthenticated) {
            if (window.UI?.showToast) {
                window.UI.showToast('Please log in to save properties', 'info');
            }
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            return;
        }

        const saveBtn = document.getElementById('saveBtn');
        const textSpan = saveBtn?.querySelector('span');
        const svg = saveBtn?.querySelector('svg');
        const isSaved = saveBtn.classList.contains('saved');

        try {
            const user = window.supabaseClient.user;
            if (!user) return;

            if (isSaved) {
                // Remove from wishlist
                const { error } = await window.supabaseClient.supabase
                    .from('wishlists')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('property_id', this.propertyId);

                if (error) throw error;

                saveBtn.classList.remove('saved');
                if (textSpan) textSpan.textContent = 'Save';
                if (svg) svg.setAttribute('fill', 'none');
            } else {
                // Add to wishlist
                const { error } = await window.supabaseClient.supabase
                    .from('wishlists')
                    .insert({
                        user_id: user.id,
                        property_id: this.propertyId
                    });

                if (error) throw error;

                saveBtn.classList.add('saved');
                if (textSpan) textSpan.textContent = 'Saved';
                if (svg) svg.setAttribute('fill', 'currentColor');
            }
        } catch (error) {
            console.error('Error toggling wishlist:', error);
            if (window.UI?.showToast) {
                window.UI.showToast('Failed to update saved properties', 'error');
            }
        }
    }

    showError(message = null) {
        document.getElementById('loadingState').style.display = 'none';
        const errorState = document.getElementById('errorState');
        errorState.style.display = 'block';

        // Add error details if provided
        if (message) {
            const errorMsg = errorState.querySelector('p');
            if (errorMsg) {
                errorMsg.innerHTML = `
                    The property you're looking for doesn't exist or has been removed.<br><br>
                    <small style="color: var(--text-muted);">Error: ${this.escapeHtml(message)}</small>
                `;
            }
        }

        // Log helpful debugging info
        console.log('=== Property Detail Page Debug Info ===');
        console.log('Property ID:', this.propertyId);
        console.log('Supabase connected:', !!window.supabaseClient?.supabase);
        console.log('PropertyService loaded:', !!window.PropertyService);
        console.log('Current URL:', window.location.href);
    }

    // Helper methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    formatPrice(price) {
        return Number(price).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }

    formatPropertyType(type) {
        return type.charAt(0).toUpperCase() + type.slice(1);
    }

    formatAmenity(amenity) {
        return amenity.split(/[-_]/).map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }

    getInitialsAvatar(name) {
        if (!name) return '';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    renderStars(rating) {
        const stars = [];
        for (let i = 0; i < 5; i++) {
            stars.push(`
                <svg viewBox="0 0 24 24" width="14" height="14" fill="${i < rating ? 'currentColor' : 'none'}" stroke="currentColor">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
            `);
        }
        return stars.join('');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.propertyDetailPage = new PropertyDetailPage();
});
