/**
 * Stripe Connect Integration for Property Owners
 * Handles Connect account creation and onboarding
 */

class StripeConnectManager {
  constructor() {
    this.apiUrl = window.location.origin;
    this.connectStatus = null;
    this.initialized = false;
  }

  /**
   * Initialize the Stripe Connect manager
   */
  async init() {
    if (this.initialized) return;

    try {
      // Check URL parameters for Connect status
      const urlParams = new URLSearchParams(window.location.search);
      const connectParam = urlParams.get('connect');

      if (connectParam === 'success') {
        this.showConnectSuccess();
        // Remove the parameter from URL
        this.cleanUrl();
      } else if (connectParam === 'refresh') {
        this.showConnectRefresh();
        this.cleanUrl();
      }

      // Check current Connect status
      await this.checkConnectStatus();

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing Stripe Connect:', error);
    }
  }

  /**
   * Clean URL parameters
   */
  cleanUrl() {
    const url = new URL(window.location);
    url.searchParams.delete('connect');
    window.history.replaceState({}, document.title, url.pathname + url.search);
  }

  /**
   * Check if user has completed Connect onboarding
   */
  async checkConnectStatus() {
    try {
      if (!window.supabaseClient || !window.supabaseClient.user) {
        return null;
      }

      const token = window.supabaseClient.session?.access_token;
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${this.apiUrl}/api/stripe/check-connect-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check Connect status');
      }

      this.connectStatus = await response.json();
      return this.connectStatus;
    } catch (error) {
      console.error('Error checking Connect status:', error);
      return null;
    }
  }

  /**
   * Create a new Connect account
   */
  async createConnectAccount(country = 'US') {
    try {
      const token = window.supabaseClient.session?.access_token;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${this.apiUrl}/api/stripe/create-connect-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ country }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create Connect account');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating Connect account:', error);
      throw error;
    }
  }

  /**
   * Get onboarding link for Connect account
   */
  async getOnboardingLink() {
    try {
      const token = window.supabaseClient.session?.access_token;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${this.apiUrl}/api/stripe/create-account-link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create onboarding link');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Error getting onboarding link:', error);
      throw error;
    }
  }

  /**
   * Start the Connect onboarding process
   */
  async startOnboarding() {
    try {
      // Show loading state
      if (window.UI) {
        window.UI.showToast('Setting up your payment account...', 'info');
      }

      // Check if account exists
      let status = await this.checkConnectStatus();

      // Create account if it doesn't exist
      if (!status || !status.hasAccount) {
        await this.createConnectAccount();
        status = await this.checkConnectStatus();
      }

      // If already complete, show message
      if (status.isComplete) {
        if (window.UI) {
          window.UI.showToast('Your payment account is already set up!', 'success');
        }
        return;
      }

      // Get onboarding link and redirect
      const onboardingUrl = await this.getOnboardingLink();
      window.location.href = onboardingUrl;
    } catch (error) {
      console.error('Error starting onboarding:', error);
      if (window.UI) {
        window.UI.showToast(error.message || 'Failed to start onboarding', 'error');
      }
    }
  }

  /**
   * Show success message
   */
  showConnectSuccess() {
    if (window.UI) {
      window.UI.showToast('Payment account setup complete! You can now receive payments.', 'success');
    }
  }

  /**
   * Show refresh message
   */
  showConnectRefresh() {
    if (window.UI) {
      window.UI.showToast('Please complete your payment account setup.', 'info');
    }
  }

  /**
   * Render Connect status UI
   * @param {HTMLElement} container - Container element to render into
   */
  async renderConnectStatus(container) {
    if (!container) return;

    const status = await this.checkConnectStatus();

    if (!status) {
      container.innerHTML = `
        <div class="connect-status-error">
          <p>Unable to load payment account status.</p>
        </div>
      `;
      return;
    }

    if (status.isComplete) {
      container.innerHTML = `
        <div class="connect-status-complete">
          <div class="status-icon">✓</div>
          <h3>Payment Account Active</h3>
          <p>You're all set to receive payments from bookings.</p>
        </div>
      `;
    } else if (status.hasAccount) {
      container.innerHTML = `
        <div class="connect-status-incomplete">
          <div class="status-icon">⚠</div>
          <h3>Complete Payment Setup</h3>
          <p>Finish setting up your payment account to start receiving bookings.</p>
          <button id="continueOnboardingBtn" class="btn btn-primary">
            Continue Setup
          </button>
        </div>
      `;

      document.getElementById('continueOnboardingBtn')?.addEventListener('click', () => {
        this.startOnboarding();
      });
    } else {
      container.innerHTML = `
        <div class="connect-status-none">
          <div class="status-icon">💳</div>
          <h3>Set Up Payments</h3>
          <p>Connect your payment account to receive payments from guests.</p>
          <button id="startOnboardingBtn" class="btn btn-primary">
            Set Up Payment Account
          </button>
        </div>
      `;

      document.getElementById('startOnboardingBtn')?.addEventListener('click', () => {
        this.startOnboarding();
      });
    }
  }

  /**
   * Check if owner can accept bookings (has completed Connect onboarding)
   */
  async canAcceptBookings() {
    const status = await this.checkConnectStatus();
    return status?.isComplete || false;
  }
}

// Initialize global instance
window.stripeConnectManager = new StripeConnectManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.stripeConnectManager.init();
  });
} else {
  window.stripeConnectManager.init();
}
