// Supabase Client Configuration
// This file handles the connection to Supabase and provides utility functions

class SupabaseClient {
    constructor() {
        // These will be set from environment variables or config
        this.supabaseUrl = this.getConfig('SUPABASE_URL') || 'https://jdiowyithfsgmjvfwlpq.supabase.co';
        this.supabaseKey = this.getConfig('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkaW93eWl0aGZzZ21qdmZ3bHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzOTM4MDQsImV4cCI6MjA2OTk2OTgwNH0.WoUSHajc9yIkI0T1lxwBd_oRR-nrEOPCaia8W4fFgDU';
        
        // Initialize Supabase client (will be loaded from CDN)
        this.supabase = null;
        this.user = null;
        this.session = null;
        this._isRedirecting = false;
        this._isInitializing = true;
        
        this.init();
    }

    // Get configuration from environment or local storage
    getConfig(key) {
        // In production, these should come from environment variables
        // For development, you can set them in localStorage temporarily
        return localStorage.getItem(key) || window.ENV?.[key];
    }

    // Initialize Supabase
    async init() {
        try {
            // Load Supabase from CDN if not already loaded
            if (typeof supabase === 'undefined') {
                await this.loadSupabaseSDK();
            }
            
            if (!this.supabaseUrl || !this.supabaseKey || 
                this.supabaseUrl === 'YOUR_SUPABASE_URL' || 
                this.supabaseKey === 'YOUR_SUPABASE_ANON_KEY') {
                console.warn('Supabase configuration not found. Please set SUPABASE_URL and SUPABASE_ANON_KEY.');
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
        if (event === 'SIGNED_IN') {
            console.log('User signed in:', session.user);
            // Only redirect if not initializing and not already on a dashboard page
            if (!this._isInitializing) {
                this.redirectToDashboardIfNeeded();
            }
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
            this.redirectToHome();
        }
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
        console.log('signOut called, supabase:', !!this.supabase);
        
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        console.log('Calling supabase.auth.signOut()...');
        const { error } = await this.supabase.auth.signOut();
        
        if (error) {
            console.error('Supabase signOut error:', error);
            throw error;
        }
        
        console.log('Supabase signOut successful');
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
        if (this._isRedirecting) {
            console.log('Redirect already in progress, skipping');
            return;
        }

        const currentPath = window.location.pathname;
        const userType = this.user?.user_metadata?.account_type || 'renter';
        
        console.log('Redirect check:', {
            currentPath,
            userType,
            isRedirecting: this._isRedirecting,
            isInitializing: this._isInitializing
        });
        
        // Check if already on correct dashboard
        if (userType === 'owner' && currentPath.includes('owner-dashboard')) {
            console.log('Already on owner dashboard, no redirect needed');
            return;
        }
        
        if (userType === 'renter' && currentPath.includes('renter-dashboard')) {
            console.log('Already on renter dashboard, no redirect needed');
            return;
        }
        
        // Only redirect from auth pages or home page
        const shouldRedirect = currentPath.includes('login.html') || 
                              currentPath.includes('register.html') || 
                              currentPath === '/' || 
                              currentPath.includes('index.html');
        
        console.log('Should redirect check:', {
            shouldRedirect,
            includesLogin: currentPath.includes('login.html'),
            includesRegister: currentPath.includes('register.html'),
            isRoot: currentPath === '/',
            includesIndex: currentPath.includes('index.html')
        });
        
        if (!shouldRedirect) {
            console.log('Not on auth page, no redirect needed');
            return;
        }

        console.log(`Redirecting ${userType} to dashboard`);
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
        
        console.log('Executing redirect:', {
            currentPath,
            isInPagesFolder,
            userType
        });
        
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
        
        console.log('Redirecting to:', targetUrl);
        
        // Handle file:// protocol by using absolute path
        if (window.location.protocol === 'file:') {
            const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            const absoluteUrl = currentDir + '/' + targetUrl;
            console.log('File protocol detected, using absolute path:', absoluteUrl);
            window.location.href = absoluteUrl;
        } else {
            window.location.href = targetUrl;
        }
    }

    redirectToHome() {
        console.log('Redirecting to home...');
        
        const currentPath = window.location.pathname;
        console.log('Current path:', currentPath);
        
        if (window.location.protocol === 'file:') {
            // For file protocol, we need to construct the exact path to index.html
            if (currentPath.includes('/pages/')) {
                // We're in the pages folder, go back to parent and find index.html
                const projectRoot = currentPath.substring(0, currentPath.indexOf('/pages/'));
                const homeUrl = projectRoot + '/index.html';
                console.log('File protocol detected, redirecting to:', homeUrl);
                window.location.href = homeUrl;
            } else {
                // We might already be in root, just go to index.html
                const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
                const homeUrl = currentDir + '/index.html';
                console.log('File protocol detected, redirecting to:', homeUrl);
                window.location.href = homeUrl;
            }
        } else {
            // For web servers
            if (currentPath !== '/' && !currentPath.includes('index.html')) {
                console.log('Redirecting to root');
                window.location.href = '/';
            } else {
                console.log('Already on home page');
            }
        }
    }

    // Security helpers
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/pages/login.html';
            return false;
        }
        return true;
    }

    requireOwner() {
        if (!this.isAuthenticated() || this.user?.user_metadata?.account_type !== 'owner') {
            window.location.href = '/pages/login.html';
            return false;
        }
        return true;
    }

    requireRenter() {
        if (!this.isAuthenticated() || this.user?.user_metadata?.account_type !== 'renter') {
            window.location.href = '/pages/login.html';
            return false;
        }
        return true;
    }
}

// Global instance
window.supabaseClient = new SupabaseClient();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseClient;
}