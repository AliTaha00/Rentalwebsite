class HomePage {
    constructor() {
        this.#init();
    }

    #init() {
        this.#setupHeroInteractions();
        this.#setupCallToActionButtons();
        this.#initializeSearchPreview();
        this.#handleAccountTypeRedirection();
    }

    #setupHeroInteractions() {
        const heroButtons = document.querySelectorAll('.hero-buttons .btn');
        heroButtons.forEach(button => {
            button.addEventListener('click', () => {
                button.style.transform = 'scale(0.95)';
                setTimeout(() => button.style.transform = '', 150);
            });
        });
    }

    #setupCallToActionButtons() {
        const findViewBtn = document.querySelector('a[href*="type=renter"]');
        findViewBtn?.addEventListener('click', () => this.#trackButtonClick('find_view', 'hero'));

        const listPropertyBtn = document.querySelector('a[href*="type=owner"]');
        listPropertyBtn?.addEventListener('click', () => this.#trackButtonClick('list_property', 'hero'));

        document.querySelectorAll('.footer a[href*="register"]').forEach(btn => {
            btn.addEventListener('click', () => this.#trackButtonClick('footer_signup', 'footer'));
        });
    }

    #trackButtonClick(action, section) {
        if (window.gtag) {
            window.gtag('event', 'click', {
                event_category: 'cta_button',
                event_label: `${section}_${action}`
            });
        }
    }

    #initializeSearchPreview() {
        const searchForm = document.querySelector('.search-form');
        if (!searchForm) return;

        const searchButton = searchForm.querySelector('button');
        const locationInput = searchForm.querySelector('input[type="text"]');

        searchButton?.addEventListener('click', (e) => {
            e.preventDefault();
            this.#handleSearchPreview();
        });

        locationInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.#handleSearchPreview();
            }
        });
    }

    #handleSearchPreview() {
        const searchForm = document.querySelector('.search-form');
        if (!searchForm) return;

        const location = searchForm.querySelector('input[type="text"]')?.value.trim();
        const priceRange = searchForm.querySelector('select')?.value;

        const searchParams = new URLSearchParams();
        if (location) searchParams.set('location', location);
        if (priceRange) searchParams.set('price', priceRange);

        window.location.href = `/pages/properties.html?${searchParams.toString()}`;
    }

    #handleAccountTypeRedirection() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const type = urlParams.get('type');

        if (action === 'signup' && (type === 'owner' || type === 'renter')) {
            window.location.href = `/pages/register.html?type=${type}`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const { pathname } = window.location;
    const isHomePage = pathname === '/' || pathname.endsWith('index.html') || pathname === '';

    if (isHomePage) {
        window.homePage = new HomePage();
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HomePage;
}
