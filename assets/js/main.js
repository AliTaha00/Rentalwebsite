// Main JavaScript File
// Contains global functionality and utilities used across the site

class ViewVistaApp {
    constructor() {
        this.init();
    }

    init() {
        this.setupGlobalEventListeners();
        this.setupNavigation();
        this.setupScrollEffects();
        this.setupModalHandlers();
        this.initializeComponents();
    }

    // Setup global event listeners
    setupGlobalEventListeners() {
        // Handle page load
        window.addEventListener('load', () => {
            this.handlePageLoad();
        });

        // Handle resize
        window.addEventListener('resize', this.debounce(() => {
            this.handleResize();
        }, 250));

        // Handle scroll
        window.addEventListener('scroll', this.throttle(() => {
            this.handleScroll();
        }, 16)); // ~60fps

        // Handle clicks outside elements (for dropdowns, modals, etc.)
        document.addEventListener('click', (e) => {
            this.handleOutsideClick(e);
        });
    }

    // Setup navigation functionality
    setupNavigation() {
        const navbar = document.querySelector('.navbar');
        const navToggle = document.querySelector('.nav-toggle');
        const navMenu = document.querySelector('.nav-menu');

        // Mobile menu toggle
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                this.toggleMobileMenu();
            });
        }

        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    this.smoothScrollTo(target);
                }
            });
        });

        // Update active nav items based on scroll position
        this.updateActiveNavItems();
    }

    // Toggle mobile menu
    toggleMobileMenu() {
        const navMenu = document.querySelector('.nav-menu');
        const navToggle = document.querySelector('.nav-toggle');
        
        if (!navMenu || !navToggle) return;

        const isOpen = navMenu.classList.contains('active');
        
        if (isOpen) {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
            document.body.style.overflow = '';
        } else {
            navMenu.classList.add('active');
            navToggle.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    // Setup scroll effects
    setupScrollEffects() {
        // Navbar scroll effect
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            this.updateNavbarOnScroll();
        }

        // Intersection Observer for animations
        this.setupIntersectionObserver();
    }

    // Update navbar appearance on scroll
    updateNavbarOnScroll() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        const scrolled = window.scrollY > 50;
        navbar.classList.toggle('scrolled', scrolled);
    }

    // Setup Intersection Observer for animations
    setupIntersectionObserver() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);

        // Observe elements that should animate in
        document.querySelectorAll('.feature-card, .step, .hero-content, .hero-image').forEach(el => {
            observer.observe(el);
        });
    }

    // Update active navigation items
    updateActiveNavItems() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link[href^="#"]');

        if (sections.length === 0 || navLinks.length === 0) return;

        window.addEventListener('scroll', this.throttle(() => {
            let current = '';
            const scrollPos = window.scrollY + 100;

            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.offsetHeight;
                
                if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                    current = section.getAttribute('id');
                }
            });

            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${current}`) {
                    link.classList.add('active');
                }
            });
        }, 100));
    }

    // Setup modal handlers
    setupModalHandlers() {
        // Close modals on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    // Close all open modals
    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        });
    }

    // Initialize components
    initializeComponents() {
        this.initializeForms();
        this.initializeTooltips();
        this.initializeImageLoading();
    }

    // Initialize forms
    initializeForms() {
        // Add loading states to all forms
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', () => {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn && !submitBtn.disabled) {
                    submitBtn.classList.add('loading');
                }
            });
        });
    }

    // Initialize tooltips (basic implementation)
    initializeTooltips() {
        document.querySelectorAll('[data-tooltip]').forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                this.showTooltip(e.target, e.target.getAttribute('data-tooltip'));
            });
            
            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }

    // Show tooltip
    showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        tooltip.style.position = 'absolute';
        tooltip.style.background = '#333';
        tooltip.style.color = 'white';
        tooltip.style.padding = '0.5rem';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '0.875rem';
        tooltip.style.zIndex = '10000';
        tooltip.style.pointerEvents = 'none';

        document.body.appendChild(tooltip);

        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
    }

    // Hide tooltip
    hideTooltip() {
        const tooltip = document.querySelector('.tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    // Initialize lazy image loading
    initializeImageLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.classList.remove('lazy');
                            imageObserver.unobserve(img);
                        }
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    // Handle page load
    handlePageLoad() {
        // Remove loading classes
        document.body.classList.remove('loading');
        
        // Initialize page-specific functionality
        this.initializePageSpecificFeatures();
    }

    // Handle window resize
    handleResize() {
        // Close mobile menu on desktop
        if (window.innerWidth > 768) {
            const navMenu = document.querySelector('.nav-menu');
            const navToggle = document.querySelector('.nav-toggle');
            
            if (navMenu && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                navToggle?.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
    }

    // Handle scroll
    handleScroll() {
        this.updateNavbarOnScroll();
    }

    // Handle outside clicks
    handleOutsideClick(e) {
        // Close mobile menu if clicking outside
        const navMenu = document.querySelector('.nav-menu');
        const navToggle = document.querySelector('.nav-toggle');
        
        if (navMenu && navMenu.classList.contains('active') && 
            !navMenu.contains(e.target) && !navToggle?.contains(e.target)) {
            this.toggleMobileMenu();
        }

        // Close dropdowns if clicking outside
        document.querySelectorAll('.dropdown.active').forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }

    // Initialize page-specific features
    initializePageSpecificFeatures() {
        const currentPage = this.getCurrentPage();
        
        switch (currentPage) {
            case 'home':
                this.initializeHomePage();
                break;
            case 'properties':
                this.initializePropertiesPage();
                break;
            case 'dashboard':
                this.initializeDashboardPage();
                break;
        }
    }

    // Get current page name
    getCurrentPage() {
        const path = window.location.pathname;
        
        if (path === '/' || path.endsWith('index.html')) {
            return 'home';
        } else if (path.includes('properties')) {
            return 'properties';
        } else if (path.includes('dashboard')) {
            return 'dashboard';
        }
        
        return 'other';
    }

    // Initialize home page features
    initializeHomePage() {
        // Add any home page specific functionality here
        console.log('Home page initialized');
    }

    // Initialize properties page features
    initializePropertiesPage() {
        // Add properties page specific functionality here
        console.log('Properties page initialized');
    }

    // Initialize dashboard page features
    initializeDashboardPage() {
        // Add dashboard page specific functionality here
        console.log('Dashboard page initialized');
    }

    // Smooth scroll to element
    smoothScrollTo(element) {
        const offsetTop = element.offsetTop - 100; // Account for fixed navbar
        
        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
        });
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

    // Utility: Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Utility: Show loading state
    showLoading(element = document.body) {
        element.classList.add('loading');
    }

    // Utility: Hide loading state
    hideLoading(element = document.body) {
        element.classList.remove('loading');
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
            month: 'long',
            day: 'numeric'
        };
        
        return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(new Date(date));
    }

    // Utility: Validate email
    isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    // Utility: Sanitize HTML to prevent XSS
    sanitizeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.viewVistaApp = new ViewVistaApp();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewVistaApp;
}