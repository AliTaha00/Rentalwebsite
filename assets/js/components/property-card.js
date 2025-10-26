/**
 * PropertyCard Component
 * Reusable property card renderer
 */

'use strict';

class PropertyCard {
    /**
     * Create a property card HTML element
     * @param {Object} property - Property data object
     * @param {Object} options - Rendering options
     * @returns {HTMLElement} Property card element
     */
    static render(property, options = {}) {
        const {
            showWishlist = false,
            linkToDetail = true,
            lazyLoad = true
        } = options;

        const card = document.createElement('div');
        card.className = 'property-card';
        card.dataset.propertyId = property.id;

        // Build image URL (handle both Supabase Storage and placeholder)
        const imageUrl = this.#getImageUrl(property);

        // Property card content
        card.innerHTML = `
            ${linkToDetail ? `<a href="property-detail.html?id=${property.id}" class="property-card-link">` : ''}
                <div class="property-card-image">
                    <img
                        src="${lazyLoad ? '' : imageUrl}"
                        ${lazyLoad ? `data-src="${imageUrl}"` : ''}
                        alt="${this.#escapeHtml(property.title)}"
                        ${lazyLoad ? 'loading="lazy"' : ''}
                    >
                    ${property.view_type ? `<span class="property-card-badge">${this.#formatViewType(property.view_type)}</span>` : ''}
                    ${showWishlist ? '<button class="wishlist-btn" aria-label="Add to wishlist"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></button>' : ''}
                </div>
                <div class="property-card-content">
                    <h3 class="property-card-title">${this.#escapeHtml(property.title)}</h3>
                    <div class="property-card-location">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                        <span>${this.#escapeHtml(property.city)}, ${this.#escapeHtml(property.state || property.country)}</span>
                    </div>
                    <div class="property-card-details">
                        ${property.bedrooms ? `
                            <div class="property-card-detail">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                    <path d="M20 9.556V3h-2v2H6V3H4v6.556C2.81 10.25 2 11.526 2 13v4a1 1 0 0 0 1 1h1v4h2v-4h12v4h2v-4h1a1 1 0 0 0 1-1v-4c0-1.474-.811-2.75-2-3.444zM11 9a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                                </svg>
                                <span>${property.bedrooms} bed${property.bedrooms > 1 ? 's' : ''}</span>
                            </div>
                        ` : ''}
                        ${property.bathrooms ? `
                            <div class="property-card-detail">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                    <path d="M21 10h-2V4h-3v6H8V4H5v6H3a1 1 0 0 0-1 1v2c0 1.86 1.28 3.41 3 3.86V20a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3h6v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3.14c1.72-.45 3-2 3-3.86v-2a1 1 0 0 0-1-1z"/>
                                </svg>
                                <span>${property.bathrooms} bath${property.bathrooms > 1 ? 's' : ''}</span>
                            </div>
                        ` : ''}
                        ${property.max_guests ? `
                            <div class="property-card-detail">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                                </svg>
                                <span>${property.max_guests} guest${property.max_guests > 1 ? 's' : ''}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="property-card-footer">
                        <div class="property-card-price">
                            $${this.#formatPrice(property.base_price)}
                            <span class="property-card-price-unit">/night</span>
                        </div>
                        ${property.average_rating ? `
                            <div class="property-card-rating">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                                </svg>
                                <span>${property.average_rating.toFixed(1)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ${linkToDetail ? '</a>' : ''}
        `;

        // Setup lazy loading if enabled
        if (lazyLoad) {
            this.#setupLazyLoading(card);
        }

        // Setup wishlist button if shown
        if (showWishlist) {
            this.#setupWishlistButton(card, property.id);
        }

        return card;
    }

    /**
     * Get image URL for property
     */
    static #getImageUrl(property) {
        // If property has images array
        if (property.images && property.images.length > 0) {
            return property.images[0].image_url || property.images[0];
        }

        // If property has primary_image
        if (property.primary_image) {
            return property.primary_image;
        }

        // Placeholder based on view type
        const viewType = property.view_type || 'default';
        return `https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&auto=format&fit=crop&q=80`;
    }

    /**
     * Format view type for display
     */
    static #formatViewType(viewType) {
        return viewType
            .split(/[-_\s]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Format price with thousands separator
     */
    static #formatPrice(price) {
        return Number(price).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }

    /**
     * Escape HTML to prevent XSS
     */
    static #escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    /**
     * Setup intersection observer for lazy loading
     */
    static #setupLazyLoading(card) {
        const img = card.querySelector('img[data-src]');
        if (!img) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px'
        });

        observer.observe(img);
    }

    /**
     * Setup wishlist button functionality
     */
    static #setupWishlistButton(card, propertyId) {
        const wishlistBtn = card.querySelector('.wishlist-btn');
        if (!wishlistBtn) return;

        wishlistBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isAuthenticated = window.supabaseClient?.isAuthenticated();
            if (!isAuthenticated) {
                if (window.UI?.showToast) {
                    window.UI.showToast('Please log in to add to wishlist', 'info');
                }
                return;
            }

            try {
                wishlistBtn.classList.toggle('active');
                // TODO: Implement wishlist API call
                if (window.UI?.showToast) {
                    window.UI.showToast('Added to wishlist!', 'success');
                }
            } catch (error) {
                console.error('Wishlist error:', error);
                if (window.UI?.showToast) {
                    window.UI.showToast('Failed to update wishlist', 'error');
                }
            }
        });
    }

    /**
     * Render a loading skeleton card
     */
    static renderSkeleton() {
        const skeleton = document.createElement('div');
        skeleton.className = 'property-card';
        skeleton.innerHTML = `
            <div class="property-card-image loading-skeleton skeleton-image"></div>
            <div class="property-card-content">
                <div class="loading-skeleton skeleton-title"></div>
                <div class="loading-skeleton skeleton-text" style="width: 60%;"></div>
                <div style="display: flex; gap: 12px; margin: 12px 0;">
                    <div class="loading-skeleton skeleton-text" style="width: 80px;"></div>
                    <div class="loading-skeleton skeleton-text" style="width: 80px;"></div>
                </div>
                <div class="property-card-footer">
                    <div class="loading-skeleton skeleton-text" style="width: 100px;"></div>
                    <div class="loading-skeleton skeleton-text" style="width: 60px;"></div>
                </div>
            </div>
        `;
        return skeleton;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PropertyCard = PropertyCard;
}
