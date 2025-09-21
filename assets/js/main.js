// Main JavaScript: site-wide essentials only
// - Mobile nav toggle
// - Smooth anchor scrolling
// - Navbar scrolled state
// - HTML sanitization utility (used across pages)

class ViewVistaApp {
    constructor() {
        this.setupNavigation();
        this.setupScrollHandler();
        this.syncAuthNav();
        window.addEventListener('auth:state', () => this.syncAuthNav());
        // Ensure nav syncs after Supabase finishes initializing
        if (window.supabaseClient?.waitForInit) {
            window.supabaseClient.waitForInit().then(() => this.syncAuthNav()).catch(() => {});
        }
    }

    // Mobile navigation + smooth anchors
    setupNavigation() {
        const navToggle = document.querySelector('.nav-toggle');
        const navMenu = document.querySelector('.nav-menu');

        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                const isOpen = navMenu.classList.contains('active');
                navMenu.classList.toggle('active', !isOpen);
                navToggle.classList.toggle('active', !isOpen);
                document.body.style.overflow = isOpen ? '' : 'hidden';
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (navMenu.classList.contains('active') &&
                    !navMenu.contains(e.target) && !navToggle.contains(e.target)) {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        }

        // Smooth scrolling for on-page anchors (only if target exists)
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const href = anchor.getAttribute('href');
                const target = href ? document.querySelector(href) : null;
                if (!target) return; // allow other handlers (e.g., Dashboard/Logout) to run
                e.preventDefault();
                const offsetTop = Math.max(0, target.offsetTop - 100);
                window.scrollTo({ top: offsetTop, behavior: 'smooth' });
            });
        });
    }

    // Navbar scrolled state
    setupScrollHandler() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;
        const update = () => navbar.classList.toggle('scrolled', window.scrollY > 50);
        update();
        window.addEventListener('scroll', this.throttle(update, 50));
        window.addEventListener('resize', this.debounce(() => {
            // Ensure mobile menu is closed on desktop resize
            if (window.innerWidth > 768) {
                const navMenu = document.querySelector('.nav-menu');
                const navToggle = document.querySelector('.nav-toggle');
                if (navMenu && navMenu.classList.contains('active')) {
                    navMenu.classList.remove('active');
                    navToggle && navToggle.classList.remove('active');
                    document.body.style.overflow = '';
                }
            }
        }, 200));
    }

    // Utility: Debounce
    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    // Utility: Throttle
    throttle(func, limit) {
        let waiting = false;
        return (...args) => {
            if (!waiting) {
                func(...args);
                waiting = true;
                setTimeout(() => (waiting = false), limit);
            }
        };
    }

    // Utility: Sanitize HTML (used by other modules)
    sanitizeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Update nav to reflect auth state (works on any page)
    syncAuthNav() {
        const auth = window.supabaseClient;
        if (!auth) return;
        const user = auth.getCurrentUser();
        const navMenu = document.querySelector('.nav-menu');
        if (!navMenu) return;

        const loginLink = navMenu.querySelector('a[href*="login.html"], .login-btn');
        const registerLink = navMenu.querySelector('a[href*="register.html"], .register-btn');

        if (user) {
            if (loginLink) {
                const userType = user.user_metadata?.account_type === 'owner' ? 'owner' : 'renter';
                const dashboardPath = this.makePath(`pages/${userType}-dashboard.html`);
                loginLink.textContent = 'Dashboard';
                loginLink.classList.remove('login-btn');
                loginLink.href = dashboardPath;
                loginLink.onclick = (e) => {
                    e.preventDefault();
                    auth.redirectToDashboard();
                };
                // Mark as the canonical dashboard link
                loginLink.setAttribute('data-dashboard-link', 'true');
                // Hide any other dashboard-like links in the nav to avoid duplicates
                navMenu.querySelectorAll('a').forEach(a => {
                    if (a === loginLink) return;
                    const href = a.getAttribute('href') || '';
                    const txt = (a.textContent || '').toLowerCase();
                    if (/owner-dashboard\.html|renter-dashboard\.html/.test(href) || txt.includes('dashboard')) {
                        a.style.display = 'none';
                    }
                });
            }
            if (registerLink) {
                registerLink.textContent = 'Logout';
                registerLink.classList.remove('register-btn');
                registerLink.href = this.makePath('pages/login.html');
                registerLink.onclick = async (e) => {
                    e.preventDefault();
                    try { await auth.signOut(); } catch {}
                };
            }
        } else {
            if (loginLink) {
                loginLink.textContent = 'Login';
                loginLink.href = this.makePath('pages/login.html');
                loginLink.onclick = null;
                loginLink.classList.add('login-btn');
            }
            if (registerLink) {
                registerLink.textContent = 'Get Started';
                registerLink.href = this.makePath('pages/register.html');
                registerLink.onclick = null;
                registerLink.classList.add('register-btn');
            }
        }
    }

    // Build path that works on root or /pages/
    makePath(pagePath) {
        return window.location.pathname.includes('/pages/') ? pagePath.split('/').pop() : pagePath;
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.viewVistaApp = new ViewVistaApp();
});

// CommonJS export (for tests/tooling)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewVistaApp;
}