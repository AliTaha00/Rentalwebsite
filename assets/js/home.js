// Home Page JavaScript
// Handles homepage-specific functionality and interactions

class HomePage {
    constructor() {
        this.init();
    }

    init() {
        this.setupHeroInteractions();
        this.setupFeatureAnimations();
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

    // Add scroll indicator to hero section
    addScrollIndicator() {
        const hero = document.querySelector('.hero');
        if (!hero || window.innerHeight >= hero.offsetHeight) return;

        const scrollIndicator = document.createElement('div');
        scrollIndicator.className = 'scroll-indicator';
        scrollIndicator.innerHTML = `
            <div class="scroll-arrow">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <p>Scroll to explore</p>
        `;

        hero.appendChild(scrollIndicator);

        // Hide indicator when user scrolls
        window.addEventListener('scroll', () => {
            if (window.scrollY > 100) {
                scrollIndicator.style.opacity = '0';
            } else {
                scrollIndicator.style.opacity = '1';
            }
        }, { once: false });
    }

    // Setup feature card animations
    setupFeatureAnimations() {
        const featureCards = document.querySelectorAll('.feature-card');
        
        featureCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                this.animateFeatureCard(card, 'enter');
            });
            
            card.addEventListener('mouseleave', () => {
                this.animateFeatureCard(card, 'leave');
            });
        });
    }

    // Animate feature cards
    animateFeatureCard(card, action) {
        const icon = card.querySelector('.feature-icon');
        
        if (action === 'enter') {
            icon.style.transform = 'scale(1.1) rotate(5deg)';
            icon.style.transition = 'transform 0.3s ease';
        } else {
            icon.style.transform = 'scale(1) rotate(0deg)';
        }
    }

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

    // Track button clicks (placeholder for analytics)
    trackButtonClick(action, section) {
        console.log(`Button clicked: ${action} in ${section}`);
        
        // TODO: Implement actual analytics tracking
        // if (window.gtag) {
        //     gtag('event', 'click', {
        //         event_category: 'cta_button',
        //         event_label: `${section}_${action}`
        //     });
        // }
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

    // Initialize hero image carousel (if multiple images are added later)
    initializeHeroCarousel() {
        const heroImages = document.querySelectorAll('.hero-image img');
        if (heroImages.length <= 1) return;

        let currentImage = 0;
        const totalImages = heroImages.length;

        // Hide all images except first
        heroImages.forEach((img, index) => {
            if (index !== 0) {
                img.style.opacity = '0';
            }
        });

        // Auto-rotate images
        setInterval(() => {
            heroImages[currentImage].style.opacity = '0';
            currentImage = (currentImage + 1) % totalImages;
            heroImages[currentImage].style.opacity = '1';
        }, 5000);
    }

    // Add property showcase preview
    addPropertyShowcase() {
        const showcase = document.createElement('section');
        showcase.className = 'property-showcase';
        showcase.innerHTML = `
            <div class="container">
                <h2>Featured Properties</h2>
                <p>Discover some of our most popular properties with stunning views</p>
                <div class="properties-grid">
                    ${this.generatePreviewProperties()}
                </div>
                <div class="showcase-cta">
                    <a href="/pages/properties.html" class="btn btn-primary">View All Properties</a>
                </div>
            </div>
        `;

        // Insert before footer
        const footer = document.querySelector('.footer');
        if (footer) {
            footer.parentNode.insertBefore(showcase, footer);
        }
    }

    // Generate preview property cards
    generatePreviewProperties() {
        const properties = [
            {
                title: 'Mountain Vista Cabin',
                location: 'Colorado Rockies',
                price: '$150',
                image: 'placeholder-mountain.jpg',
                rating: 4.9
            },
            {
                title: 'Ocean View Apartment', 
                location: 'Malibu, California',
                price: '$250',
                image: 'placeholder-ocean.jpg',
                rating: 4.8
            },
            {
                title: 'City Skyline Loft',
                location: 'New York, NY',
                price: '$300',
                image: 'placeholder-city.jpg',
                rating: 4.7
            }
        ];

        return properties.map(property => `
            <div class="property-preview-card">
                <div class="property-image">
                    <div class="image-placeholder">${property.title}</div>
                </div>
                <div class="property-info">
                    <h4>${property.title}</h4>
                    <p class="location">${property.location}</p>
                    <div class="property-rating">
                        <span class="stars">${'★'.repeat(Math.floor(property.rating))}</span>
                        <span class="rating-number">${property.rating}</span>
                    </div>
                    <div class="property-price">
                        <span class="price">${property.price}</span>
                        <span class="period">/night</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Initialize testimonials carousel
    initializeTestimonials() {
        const testimonials = [
            {
                text: "ViewVista helped us find the perfect mountain retreat. The views were absolutely breathtaking!",
                author: "Sarah Johnson",
                role: "Travel Enthusiast"
            },
            {
                text: "As a property owner, I love how easy it is to manage my listings and connect with guests.",
                author: "Michael Chen",
                role: "Property Owner"
            },
            {
                text: "The booking process was seamless and the customer service was exceptional.",
                author: "Emily Rodriguez",
                role: "Frequent Traveler"
            }
        ];

        // Add testimonials section if desired
        // Implementation would go here
    }

    // Add scroll-triggered counters for statistics
    addScrollCounters() {
        const stats = [
            { label: 'Properties Listed', target: 1250, suffix: '+' },
            { label: 'Happy Guests', target: 5000, suffix: '+' },
            { label: 'Cities Covered', target: 150, suffix: '+' },
            { label: 'Average Rating', target: 4.8, suffix: '/5' }
        ];

        // Implementation would animate numbers when section comes into view
    }

    // Handle newsletter signup (if added)
    setupNewsletterSignup() {
        const newsletterForm = document.querySelector('.newsletter-form');
        if (!newsletterForm) return;

        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleNewsletterSignup(newsletterForm);
        });
    }

    // Handle newsletter signup
    async handleNewsletterSignup(form) {
        const email = form.querySelector('input[type="email"]').value;
        
        if (!email || !window.viewVistaApp.isValidEmail(email)) {
            this.showNewsletterError('Please enter a valid email address');
            return;
        }

        try {
            // TODO: Implement newsletter signup
            console.log('Newsletter signup:', email);
            this.showNewsletterSuccess('Thank you for subscribing!');
            form.reset();
        } catch (error) {
            this.showNewsletterError('Something went wrong. Please try again.');
        }
    }

    // Show newsletter success message
    showNewsletterSuccess(message) {
        // Implementation for showing success message
    }

    // Show newsletter error message
    showNewsletterError(message) {
        // Implementation for showing error message
    }
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