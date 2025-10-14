// Supabase Client Configuration
// This file handles the connection to Supabase and provides utility functions

class SupabaseClient {
    constructor() {
        this.supabaseUrl = this.#getConfig('SUPABASE_URL');
        this.supabaseKey = this.#getConfig('SUPABASE_ANON_KEY');
        this.supabase = null;
        this.user = null;
        this.session = null;
        this._isRedirecting = false;
        this._isInitializing = true;
        this._initPromise = this.init();
    }

    #getConfig(key) {
        return localStorage.getItem(key) || window.ENV?.[key];
    }

    async waitForInit() {
        await this._initPromise;
    }

    async init() {
        try {
            if (typeof supabase === 'undefined') {
                await this.#loadSupabaseSDK();
            }

            if (!this.supabaseUrl || !this.supabaseKey) {
                throw new Error('Supabase configuration missing');
            }

            this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);

            this.supabase.auth.onAuthStateChange((event, session) => {
                this.session = session;
                this.user = session?.user || null;
                this.#handleAuthStateChange(event, session);
            });

            const { data: { session } } = await this.supabase.auth.getSession();
            this.session = session;
            this.user = session?.user || null;

            window.dispatchEvent(new CustomEvent('auth:state', {
                detail: { event: 'INITIAL_SESSION', user: this.user }
            }));
        } catch (error) {
            console.error('Supabase initialization failed:', error.message);
            throw error;
        } finally {
            this._isInitializing = false;
        }
    }

    #loadSupabaseSDK() {
        return new Promise((resolve, reject) => {
            if (typeof window.supabase !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.integrity = 'sha384-placeholder';
            script.crossOrigin = 'anonymous';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Supabase SDK'));
            document.head.appendChild(script);
        });
    }

    #handleAuthStateChange(event, session) {
        if (event === 'SIGNED_IN' && !this._isInitializing) {
            this.#redirectToDashboardIfNeeded();
        } else if (event === 'SIGNED_OUT') {
            this.#redirectToHome();
        }

        window.dispatchEvent(new CustomEvent('auth:state', {
            detail: { event, user: this.user }
        }));
    }

    async signUp(email, password, additionalData = {}) {
        this.#ensureInitialized();
        this.#validateEmail(email);
        this.#validatePassword(password);

        const { data, error } = await this.supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: { data: additionalData }
        });

        if (error) throw error;
        return data;
    }

    async signIn(email, password) {
        this.#ensureInitialized();
        this.#validateEmail(email);

        const { data, error } = await this.supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password
        });

        if (error) throw error;
        return data;
    }

    async signOut() {
        this.#ensureInitialized();

        const { data: { session } } = await this.supabase.auth.getSession();

        if (!session) {
            this.session = null;
            this.user = null;
            this.#handleAuthStateChange('SIGNED_OUT', null);
            return;
        }

        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
    }

    async resetPassword(email) {
        this.#ensureInitialized();
        this.#validateEmail(email);

        const redirectUrl = new URL('/pages/reset-password.html', window.location.origin);
        const { error } = await this.supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: redirectUrl.href
        });

        if (error) throw error;
    }

    #ensureInitialized() {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
    }

    #validateEmail(email) {
        if (!email || typeof email !== 'string') {
            throw new Error('Invalid email');
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            throw new Error('Invalid email format');
        }
    }

    #validatePassword(password) {
        if (!password || typeof password !== 'string') {
            throw new Error('Invalid password');
        }
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }
    }

    isAuthenticated() {
        return !!this.user;
    }

    getCurrentUser() {
        return this.user;
    }

    getCurrentSession() {
        return this.session;
    }

    #redirectToDashboardIfNeeded() {
        if (this._isRedirecting) return;

        const { pathname } = window.location;
        const userType = this.user?.user_metadata?.account_type || 'renter';
        const dashboardPage = `${userType}-dashboard`;

        if (pathname.includes(dashboardPage)) return;

        const isAuthPage = pathname.includes('login.html') || pathname.includes('register.html');
        if (!isAuthPage) return;

        this._isRedirecting = true;
        this.#redirectToDashboard();
    }

    #redirectToDashboard() {
        const userType = this.user?.user_metadata?.account_type || 'renter';
        const dashboard = `${userType}-dashboard.html`;
        const isInPages = window.location.pathname.includes('/pages/');

        window.location.href = isInPages ? dashboard : `pages/${dashboard}`;
        this._isRedirecting = false;
    }

    #redirectToHome() {
        const isInPages = window.location.pathname.includes('/pages/');
        window.location.href = isInPages ? '../index.html' : '/';
    }

    requireAuth() {
        if (!this.isAuthenticated()) {
            this.#redirectToLogin();
            return false;
        }
        return true;
    }

    requireOwner() {
        if (!this.isAuthenticated() || this.user?.user_metadata?.account_type !== 'owner') {
            this.#redirectToLogin();
            return false;
        }
        return true;
    }

    requireRenter() {
        if (!this.isAuthenticated() || this.user?.user_metadata?.account_type !== 'renter') {
            this.#redirectToLogin();
            return false;
        }
        return true;
    }

    #redirectToLogin() {
        const isInPages = window.location.pathname.includes('/pages/');
        window.location.href = isInPages ? 'login.html' : 'pages/login.html';
    }
}

window.supabaseClient = new SupabaseClient();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseClient;
}