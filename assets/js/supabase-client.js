// Supabase Client Configuration
// This file handles the connection to Supabase and provides utility functions

class SupabaseClient {
    constructor() {
        // Read from runtime (localStorage for dev, window.ENV for hosted). Never hardcode.
        this.supabaseUrl = this.getConfig('SUPABASE_URL');
        this.supabaseKey = this.getConfig('SUPABASE_ANON_KEY');
        
        // Initialize Supabase client (will be loaded from CDN)
        this.supabase = null;
        this.user = null;
        this.session = null;
        this._isRedirecting = false;
        this._isInitializing = true;
        this._initPromise = null;
        
        this._initPromise = this.init();
    }

    // Get configuration from environment or local storage
    getConfig(key) {
        // In production, these should come from environment variables
        // For development, you can set them in localStorage temporarily
        return localStorage.getItem(key) || window.ENV?.[key];
    }

    // Wait for initialization to complete
    async waitForInit() {
        if (this._initPromise) {
            await this._initPromise;
        }
    }

    // Initialize Supabase
    async init() {
        try {
            // Load Supabase from CDN if not already loaded
            if (typeof supabase === 'undefined') {
                await this.loadSupabaseSDK();
            }
            
            if (!this.supabaseUrl || !this.supabaseKey) {
                console.warn('Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
                return;
            }

            // Create Supabase client
            this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);

            // Set up auth state listener
            this.supabase.auth.onAuthStateChange((event, session) => {
                this.session = session;
                this.user = session?.user || null;
                this.handleAuthStateChange(event, session);
            });

            // Get initial session
            const { data: { session } } = await this.supabase.auth.getSession();
            this.session = session;
            this.user = session?.user || null;
            try {
                window.dispatchEvent(new CustomEvent('auth:state', {
                    detail: { event: 'INITIAL_SESSION', user: this.user }
                }));
            } catch {}

        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
        } finally {
            // Mark initialization as complete
            this._isInitializing = false;
        }
    }

    // Load Supabase SDK from CDN
    loadSupabaseSDK() {
        return new Promise((resolve, reject) => {
            if (typeof window.supabase !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Handle authentication state changes
    handleAuthStateChange(event, session) {
        console.log('Auth state change:', event, session ? 'with session' : 'no session');
        
        if (event === 'SIGNED_IN') {
            // Only redirect if not initializing and not already on a dashboard page
            if (!this._isInitializing) {
                this.redirectToDashboardIfNeeded();
            } else {
                setTimeout(() => {
                    if (this.isAuthenticated()) {
                        this.redirectToDashboardIfNeeded();
                    }
                }, 1000);
            }
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out, redirecting to home...');
            this.redirectToHome();
        }

        // Notify listeners (e.g., nav UI) about auth state changes
        try {
            window.dispatchEvent(new CustomEvent('auth:state', {
                detail: { event, user: this.user }
            }));
        } catch {}
    }

    // Authentication methods
    async signUp(email, password, additionalData = {}) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: additionalData
            }
        });

        if (error) {
            throw error;
        }

        return data;
    }

    async signIn(email, password) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        return data;
    }

    async signOut() {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        // Check if there's an active session
        const { data: { session } } = await this.supabase.auth.getSession();
        
        if (!session) {
            // No session to sign out from, just clear local state
            console.log('No active session, clearing local state');
            this.session = null;
            this.user = null;
            // Manually trigger the signed out event
            this.handleAuthStateChange('SIGNED_OUT', null);
            return;
        }
        
        const { error } = await this.supabase.auth.signOut();
        
        if (error) {
            throw error;
        }
    }

    async resetPassword(email) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/pages/reset-password.html`
        });

        if (error) {
            throw error;
        }
    }

    // Database operations
    async insertUserProfile(userId, profileData) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        const { data, error } = await this.supabase
            .from('user_profiles')
            .insert([{
                user_id: userId,
                ...profileData
            }]);

        if (error) {
            throw error;
        }

        return data;
    }

    async getUserProfile(userId) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        const { data, error } = await this.supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    // Utility methods
    isAuthenticated() {
        return !!this.user;
    }

    getCurrentUser() {
        return this.user;
    }

    getCurrentSession() {
        return this.session;
    }

    // Navigation helpers
    redirectToDashboardIfNeeded() {
        // Prevent multiple rapid redirects
        if (this._isRedirecting) return;

        const currentPath = window.location.pathname;
        const userType = this.user?.user_metadata?.account_type || 'renter';
        
        // Check if already on correct dashboard
        if (userType === 'owner' && currentPath.includes('owner-dashboard')) return;
        if (userType === 'renter' && currentPath.includes('renter-dashboard')) return;
        
        // Only redirect from auth pages (not home) to avoid jarring jumps
        const shouldRedirect = currentPath.includes('login.html') || 
                              currentPath.includes('register.html');
        if (!shouldRedirect) return;
        this._isRedirecting = true;
        
        // Add small delay to prevent rapid redirects
        setTimeout(() => {
            this.redirectToDashboard();
            this._isRedirecting = false;
        }, 100);
    }

    redirectToDashboard() {
        // Determine dashboard based on user type
        const currentPath = window.location.pathname;
        const isInPagesFolder = currentPath.includes('/pages/');
        const userType = this.user?.user_metadata?.account_type || 'renter';
        
        let targetUrl;
        
        if (userType === 'owner') {
            if (isInPagesFolder) {
                targetUrl = 'owner-dashboard.html';
            } else {
                targetUrl = 'pages/owner-dashboard.html';
            }
        } else {
            if (isInPagesFolder) {
                targetUrl = 'renter-dashboard.html';
            } else {
                targetUrl = 'pages/renter-dashboard.html';
            }
        }
        
        // Handle file:// protocol by using absolute path
        if (window.location.protocol === 'file:') {
            const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            window.location.href = currentDir + '/' + targetUrl;
        } else {
            window.location.href = targetUrl;
        }
    }

    redirectToHome() {
        const currentPath = window.location.pathname;
        console.log('Redirecting to home from:', currentPath);
        
        if (window.location.protocol === 'file:') {
            // For file protocol, we need to construct the exact path to index.html
            if (currentPath.includes('/pages/')) {
                // We're in the pages folder, go back to parent and find index.html
                const projectRoot = currentPath.substring(0, currentPath.indexOf('/pages/'));
                window.location.href = projectRoot + '/index.html';
            } else {
                // Already in root, reload to clear state
                window.location.reload();
            }
        } else {
            // For web servers - redirect to index.html (properties page)
            if (currentPath !== '/' && !currentPath.includes('index.html')) {
                window.location.href = '/';
            } else {
                // Already on home page, just reload to update UI
                window.location.reload();
            }
        }
    }

    // Security helpers
    requireAuth() {
        if (!this.isAuthenticated()) {
            // Use relative path to work on file:// and various hosts
            const base = 'pages/login.html';
            if (window.location.pathname.includes('/pages/')) {
                window.location.href = 'login.html';
            } else {
                window.location.href = base;
            }
            return false;
        }
        return true;
    }

    requireOwner() {
        if (!this.isAuthenticated() || this.user?.user_metadata?.account_type !== 'owner') {
            const base = 'pages/login.html';
            window.location.href = window.location.pathname.includes('/pages/') ? 'login.html' : base;
            return false;
        }
        return true;
    }

    requireRenter() {
        if (!this.isAuthenticated() || this.user?.user_metadata?.account_type !== 'renter') {
            const base = 'pages/login.html';
            window.location.href = window.location.pathname.includes('/pages/') ? 'login.html' : base;
            return false;
        }
        return true;
    }

    // Helper to navigate to property form
    redirectToPropertyForm(propertyId = null) {
        const base = 'property-form.html';
        if (window.location.protocol === 'file:') {
            const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            const target = propertyId ? `${currentDir}/${base}?id=${encodeURIComponent(propertyId)}` : `${currentDir}/${base}`;
            window.location.href = target;
        } else {
            const target = propertyId ? `${base}?id=${encodeURIComponent(propertyId)}` : base;
            window.location.href = target;
        }
    }
}

// Global instance
window.supabaseClient = new SupabaseClient();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseClient;
}