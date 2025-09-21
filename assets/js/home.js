// Home Page JavaScript (lean)
// Essentials only: hero button micro-interaction, CTA tracking hook, search redirect, signup redirect

class HomePage {
    constructor() {
        this.init();
    }

    init() {
        this.setupHeroInteractions();
        this.setupCallToActionButtons();
        this.initializeSearchPreview();
        this.handleAccountTypeRedirection();
    }

    // Setup hero section interactions
    setupHeroInteractions() {
        const heroButtons = document.querySelectorAll('.hero-buttons .btn');
        
        heroButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Add click animation
                button.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    button.style.transform = '';
                }, 150);
            });
        });

        // Add scroll indicator if hero is tall enough
        this.addScrollIndicator();
    }

    // Add scroll indicator to hero section (removed for simplicity/bloat)
    addScrollIndicator() {}

    // Feature card animations removed to reduce JS bloat
    setupFeatureAnimations() {}
    animateFeatureCard() {}

    // Setup call-to-action buttons
    setupCallToActionButtons() {
        // Handle "Find Your Perfect View" button
        const findViewBtn = document.querySelector('a[href*="type=renter"]');
        if (findViewBtn) {
            findViewBtn.addEventListener('click', (e) => {
                this.trackButtonClick('find_view', 'hero');
            });
        }

        // Handle "List Your Property" button  
        const listPropertyBtn = document.querySelector('a[href*="type=owner"]');
        if (listPropertyBtn) {
            listPropertyBtn.addEventListener('click', (e) => {
                this.trackButtonClick('list_property', 'hero');
            });
        }

        // Handle footer CTA buttons
        document.querySelectorAll('.footer a[href*="register"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.trackButtonClick('footer_signup', 'footer');
            });
        });
    }

    // Track button clicks (hook for analytics; no console noise)
    trackButtonClick(action, section) {
        if (window.gtag) {
            window.gtag('event', 'click', {
                event_category: 'cta_button',
                event_label: `${section}_${action}`
            });
        }
    }

    // Initialize search preview (for future search functionality)
    initializeSearchPreview() {
        const searchForm = document.querySelector('.search-form');
        if (!searchForm) return;

        const searchButton = searchForm.querySelector('button');
        const locationInput = searchForm.querySelector('input[type="text"]');
        const priceSelect = searchForm.querySelector('select');

        if (searchButton) {
            searchButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSearchPreview();
            });
        }

        // Add enter key support for search
        if (locationInput) {
            locationInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleSearchPreview();
                }
            });
        }
    }

    // Handle search preview (placeholder)
    handleSearchPreview() {
        const searchForm = document.querySelector('.search-form');
        if (!searchForm) return;

        const location = searchForm.querySelector('input[type="text"]')?.value;
        const priceRange = searchForm.querySelector('select')?.value;

        // For now, redirect to properties page with search parameters
        const searchParams = new URLSearchParams();
        if (location) searchParams.set('location', location);
        if (priceRange) searchParams.set('price', priceRange);

        window.location.href = `/pages/properties.html?${searchParams.toString()}`;
    }

    // Handle account type redirection from URL
    handleAccountTypeRedirection() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const type = urlParams.get('type');

        if (action === 'signup') {
            if (type === 'owner' || type === 'renter') {
                // Redirect to registration with account type
                window.location.href = `/pages/register.html?type=${type}`;
            } else {
                // Redirect to registration without type
                window.location.href = '/pages/register.html';
            }
        }
    }

    // Optional hero carousel removed
    initializeHeroCarousel() {}

    // Static showcase removed (keeps HTML light and static)
    addPropertyShowcase() {}

    // Generate preview property cards
    generatePreviewProperties() { return ''; }

    // Testimonials removed
    initializeTestimonials() {}

    // Scroll counters removed
    addScrollCounters() {}

    // Newsletter signup removed
    setupNewsletterSignup() {}

    async handleNewsletterSignup() {}

    // Show newsletter success message
    showNewsletterSuccess() {}

    // Show newsletter error message
    showNewsletterError() {}
}

// Initialize home page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the home page
    const isHomePage = window.location.pathname === '/' || 
                      window.location.pathname.endsWith('index.html') ||
                      window.location.pathname === '';
    
    if (isHomePage) {
        window.homePage = new HomePage();
    }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HomePage;
}