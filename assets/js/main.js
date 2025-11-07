class RentThatViewApp {
    constructor() {
        this.#setupNavigation();
        this.#setupScrollHandler();
        this.#setupProfileDropdown();
        this.#syncAuthNav();

        window.addEventListener('auth:state', () => this.#syncAuthNav());

        if (window.supabaseClient?.waitForInit) {
            window.supabaseClient.waitForInit()
                .then(() => this.#syncAuthNav())
                .catch(err => console.error('Auth sync failed:', err.message));
        }
    }

    #setupNavigation() {
        const navToggle = document.querySelector('.nav-toggle');
        const navMenu = document.querySelector('.nav-menu');

        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                const isOpen = navMenu.classList.contains('active');
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
                document.body.style.overflow = isOpen ? '' : 'hidden';
            });

            document.addEventListener('click', (e) => {
                if (navMenu.classList.contains('active') &&
                    !navMenu.contains(e.target) &&
                    !navToggle.contains(e.target)) {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        }

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const href = anchor.getAttribute('href');
                
                // Skip if href is just "#" or empty
                if (!href || href === '#') return;
                
                try {
                    const target = document.querySelector(href);
                    if (!target) return;

                    e.preventDefault();
                    const offsetTop = Math.max(0, target.offsetTop - 100);
                    window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                } catch (error) {
                    // Invalid selector, skip
                    return;
                }
            });
        });
    }

    #setupScrollHandler() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        const updateNav = () => navbar.classList.toggle('scrolled', window.scrollY > 50);
        updateNav();

        window.addEventListener('scroll', this.#throttle(updateNav, 50));
        window.addEventListener('resize', this.#debounce(() => {
            if (window.innerWidth > 768) {
                const navMenu = document.querySelector('.nav-menu');
                const navToggle = document.querySelector('.nav-toggle');
                if (navMenu?.classList.contains('active')) {
                    navMenu.classList.remove('active');
                    navToggle?.classList.remove('active');
                    document.body.style.overflow = '';
                }
            }
        }, 200));
    }

    #debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    #throttle(func, limit) {
        let waiting = false;
        return (...args) => {
            if (!waiting) {
                func(...args);
                waiting = true;
                setTimeout(() => (waiting = false), limit);
            }
        };
    }

    sanitizeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    #syncAuthNav() {
        const auth = window.supabaseClient;
        if (!auth) return;

        const user = auth.getCurrentUser();
        const navProfile = document.querySelector('.nav-profile');
        const navAuth = document.querySelector('.nav-auth');

        if (navProfile && navAuth) {
            if (user) {
                navProfile.style.display = 'block';
                navAuth.style.display = 'none';
                this.#updateProfileInfo(user);
            } else {
                navProfile.style.display = 'none';
                navAuth.style.display = 'flex';
            }
        }
    }

    #updateProfileInfo(user) {
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profileInitials = document.getElementById('profileInitials');

        if (profileEmail) {
            profileEmail.textContent = user.email || '';
        }

        const displayName = user.user_metadata?.full_name ||
            user.user_metadata?.first_name ||
            user.email?.split('@')[0] ||
            'User';

        if (profileName) {
            profileName.textContent = displayName;
        }

        if (profileInitials) {
            const initials = displayName.split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
            profileInitials.textContent = initials;
        }
    }

    #setupProfileDropdown() {
        const profileBtn = document.getElementById('profileIconBtn');
        const profileDropdown = document.getElementById('profileDropdown');

        if (!profileBtn || !profileDropdown) return;

        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-profile')) {
                profileDropdown.classList.remove('show');
            }
        });

        const dashboardLink = document.getElementById('profileDashboardLink');
        if (dashboardLink) {
            dashboardLink.addEventListener('click', (e) => {
                e.preventDefault();
                const auth = window.supabaseClient;
                if (!auth) return;

                const userType = auth.getCurrentUser()?.user_metadata?.account_type || 'renter';
                const dashboard = `${userType}-dashboard.html`;
                const isInPages = window.location.pathname.includes('/pages/');
                window.location.href = isInPages ? dashboard : `pages/${dashboard}`;
            });
        }

        const logoutBtn = document.getElementById('profileLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const auth = window.supabaseClient;
                if (!auth) return;

                try {
                    await auth.waitForInit();
                    await auth.signOut();

                    // Show success message
                    if (window.UI?.showToast) {
                        window.UI.showToast('Successfully logged out', 'success');
                    }

                    // Redirect to home page after brief delay
                    setTimeout(() => {
                        const isInPages = window.location.pathname.includes('/pages/');
                        window.location.href = isInPages ? '../index.html' : '/';
                    }, 500);
                } catch (error) {
                    console.error('Logout error:', error.message);
                    // Even if there's an error, clear session and redirect
                    auth.user = null;
                    auth.session = null;
                    const isInPages = window.location.pathname.includes('/pages/');
                    window.location.href = isInPages ? '../index.html' : '/';
                }
            });
        }

        const settingsLink = document.getElementById('profileSettingsLink');
        if (settingsLink) {
            // Settings link href is already set in HTML to profile-settings.html
            // No need for preventDefault - let default link behavior work
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.viewVistaApp = new RentThatViewApp();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RentThatViewApp;
}
