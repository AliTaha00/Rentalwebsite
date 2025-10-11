// Main JavaScript: site-wide essentials only
// - Mobile nav toggle
// - Smooth anchor scrolling
// - Navbar scrolled state
// - HTML sanitization utility (used across pages)

class RentThatViewApp {
    constructor() {
        this.setupNavigation();
        this.setupScrollHandler();
        this.setupProfileDropdown();
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

        // Show/hide profile icon
        const navProfile = document.querySelector('.nav-profile');
        if (navProfile) {
            if (user) {
                navProfile.style.display = 'block';
                this.updateProfileInfo(user);
            } else {
                navProfile.style.display = 'none';
            }
        }

        if (user) {
            // Convert Login to Dashboard
            if (loginLink) {
                const userType = user.user_metadata?.account_type === 'owner' ? 'owner' : 'renter';
                const dashboardPath = this.makePath(`pages/${userType}-dashboard.html`);
                loginLink.textContent = 'Dashboard';
                loginLink.classList.remove('login-btn');
                loginLink.classList.add('nav-link');
                loginLink.href = dashboardPath;
                loginLink.onclick = (e) => {
                    e.preventDefault();
                    auth.redirectToDashboard();
                };
            }
            
            // Convert Get Started to Logout
            if (registerLink) {
                registerLink.textContent = 'Logout';
                registerLink.classList.remove('register-btn');
                registerLink.classList.add('nav-link', 'logout-btn');
                registerLink.href = '#';
                registerLink.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try { 
                        console.log('Logging out...');
                        await auth.waitForInit(); // Ensure Supabase is initialized
                        await auth.signOut();
                        console.log('Logout successful');
                        // signOut will trigger auth state change and redirect to home
                    } catch (error) {
                        console.error('Logout error:', error);
                        // Don't show error for session missing - just proceed
                        if (!error.message.includes('session')) {
                            alert('Failed to logout: ' + error.message);
                        } else {
                            // Session already cleared, just reload
                            window.location.reload();
                        }
                    }
                };
            }
        } else {
            // Restore original Login link
            if (loginLink) {
                loginLink.textContent = 'Login';
                loginLink.href = this.makePath('pages/login.html');
                loginLink.onclick = null;
                loginLink.classList.remove('nav-link');
                loginLink.classList.add('login-btn');
            }
            
            // Restore original Get Started button
            if (registerLink) {
                registerLink.textContent = 'Get Started';
                registerLink.href = this.makePath('pages/register.html');
                registerLink.onclick = null;
                registerLink.classList.remove('logout-btn');
                registerLink.classList.add('register-btn');
            }
        }
    }

    // Build path that works on root or /pages/
    makePath(pagePath) {
        return window.location.pathname.includes('/pages/') ? pagePath.split('/').pop() : pagePath;
    }

    // Update profile info in dropdown
    updateProfileInfo(user) {
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profileInitials = document.getElementById('profileInitials');
        
        if (profileEmail) profileEmail.textContent = user.email || '';
        
        const displayName = user.user_metadata?.full_name || user.user_metadata?.first_name || user.email?.split('@')[0] || 'User';
        if (profileName) profileName.textContent = displayName;
        
        // Generate initials
        const initials = displayName.split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        if (profileInitials) profileInitials.textContent = initials;
    }

    // Setup profile dropdown functionality
    setupProfileDropdown() {
        const profileBtn = document.getElementById('profileIconBtn');
        const profileDropdown = document.getElementById('profileDropdown');
        
        if (profileBtn && profileDropdown) {
            profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('show');
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.nav-profile')) {
                    profileDropdown.classList.remove('show');
                }
            });
            
            // Handle dropdown links
            const dashboardLink = document.getElementById('profileDashboardLink');
            if (dashboardLink) {
                dashboardLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    const auth = window.supabaseClient;
                    if (auth) {
                        auth.redirectToDashboard();
                    }
                });
            }
            
            const logoutBtn = document.getElementById('profileLogoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const auth = window.supabaseClient;
                    if (auth) {
                        try {
                            await auth.waitForInit();
                            await auth.signOut();
                        } catch (error) {
                            console.error('Logout error:', error);
                        }
                    }
                });
            }
            
            const settingsLink = document.getElementById('profileSettingsLink');
            if (settingsLink) {
                settingsLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    alert('Profile settings coming soon!');
                });
            }
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.viewVistaApp = new RentThatViewApp();
});

// CommonJS export (for tests/tooling)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RentThatViewApp;
}