/**
 * Stripe Checkout Integration for Booking Payments
 * Handles payment flow for renters booking properties
 */

class StripeCheckoutManager {
  constructor() {
    this.apiUrl = window.location.origin;
    this.initialized = false;
  }

  /**
   * Initialize the Stripe Checkout manager
   */
  async init() {
    if (this.initialized) return;

    try {
      // Check URL parameters for payment status
      const urlParams = new URLSearchParams(window.location.search);
      const paymentParam = urlParams.get('payment');
      const bookingId = urlParams.get('booking_id');

      if (paymentParam === 'success' && bookingId) {
        this.showPaymentSuccess(bookingId);
        this.cleanUrl();
      } else if (paymentParam === 'cancelled' && bookingId) {
        this.showPaymentCancelled(bookingId);
        this.cleanUrl();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing Stripe Checkout:', error);
    }
  }

  /**
   * Clean URL parameters
   */
  cleanUrl() {
    const url = new URL(window.location);
    url.searchParams.delete('payment');
    url.searchParams.delete('booking_id');
    window.history.replaceState({}, document.title, url.pathname + url.search);
  }

  /**
   * Create a checkout session and redirect to Stripe
   * @param {string} bookingId - The booking ID to process payment for
   */
  async createCheckoutSession(bookingId) {
    try {
      if (!bookingId) {
        throw new Error('Booking ID is required');
      }

      const token = window.supabaseClient.session?.access_token;
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Show loading state
      if (window.UI) {
        window.UI.showToast('Redirecting to secure payment...', 'info');
      }

      const response = await fetch(`${this.apiUrl}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      if (window.UI) {
        window.UI.showToast(error.message || 'Failed to start payment', 'error');
      }
      throw error;
    }
  }

  /**
   * Show payment success message
   * @param {string} bookingId - The booking ID
   */
  showPaymentSuccess(bookingId) {
    if (window.UI) {
      window.UI.showToast('Payment successful! Your booking is confirmed.', 'success');
    }

    // Dispatch custom event for other components to listen to
    window.dispatchEvent(new CustomEvent('payment:success', {
      detail: { bookingId },
    }));
  }

  /**
   * Show payment cancelled message
   * @param {string} bookingId - The booking ID
   */
  showPaymentCancelled(bookingId) {
    if (window.UI) {
      window.UI.showToast('Payment was cancelled. You can try again anytime.', 'info');
    }

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('payment:cancelled', {
      detail: { bookingId },
    }));
  }

  /**
   * Add payment button to a booking element
   * @param {HTMLElement} element - The element to add button to
   * @param {string} bookingId - The booking ID
   * @param {string} buttonText - Optional button text
   */
  addPaymentButton(element, bookingId, buttonText = 'Pay Now') {
    if (!element) return;

    const button = document.createElement('button');
    button.className = 'btn btn-primary payment-btn';
    button.textContent = buttonText;
    button.dataset.bookingId = bookingId;

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      button.disabled = true;
      button.textContent = 'Processing...';

      try {
        await this.createCheckoutSession(bookingId);
      } catch (error) {
        button.disabled = false;
        button.textContent = buttonText;
      }
    });

    element.appendChild(button);
    return button;
  }

  /**
   * Check if a booking needs payment
   * @param {object} booking - Booking object from database
   * @returns {boolean}
   */
  needsPayment(booking) {
    return booking.status === 'pending' &&
           (!booking.payment_status || booking.payment_status === 'unpaid');
  }

  /**
   * Get payment status display text
   * @param {object} booking - Booking object
   * @returns {object} - Status object with text and class
   */
  getPaymentStatusDisplay(booking) {
    const status = booking.payment_status || 'unpaid';

    const statusMap = {
      paid: { text: 'Paid', class: 'status-success' },
      unpaid: { text: 'Payment Required', class: 'status-warning' },
      failed: { text: 'Payment Failed', class: 'status-error' },
      refunded: { text: 'Refunded', class: 'status-info' },
    };

    return statusMap[status] || { text: 'Unknown', class: 'status-default' };
  }

  /**
   * Render payment status badge
   * @param {object} booking - Booking object
   * @returns {string} - HTML string
   */
  renderPaymentStatus(booking) {
    const status = this.getPaymentStatusDisplay(booking);
    return `<span class="payment-status-badge ${status.class}">${status.text}</span>`;
  }
}

// Initialize global instance
window.stripeCheckoutManager = new StripeCheckoutManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.stripeCheckoutManager.init();
  });
} else {
  window.stripeCheckoutManager.init();
}
