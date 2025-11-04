# Stripe Integration Setup Guide

This guide will help you set up Stripe Connect marketplace payments for RentThatView.

## Overview

The Stripe integration includes:
- **Stripe Connect** for property owners to receive payments
- **Stripe Checkout** for guests to pay for bookings
- **Webhook handling** for payment status updates
- **Platform fees** - automatically take a percentage of each booking

## Prerequisites

1. A Stripe account (sign up at https://stripe.com)
2. Vercel account for deployment (or compatible serverless hosting)
3. Supabase project with the database schema updated

---

## Step 1: Database Migration

Run the migration to add Stripe-specific columns to your database:

```sql
-- In your Supabase SQL Editor, run:
-- File: config/migrations/001_add_stripe_columns.sql
```

This adds:
- `stripe_connect_account_id` to `user_profiles`
- `stripe_connect_onboarding_complete` to `user_profiles`
- `stripe_session_id` to `bookings`
- Additional payment tracking fields

---

## Step 2: Get Your Stripe API Keys

### Test Mode (Development)
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)

### Live Mode (Production)
1. Complete your Stripe account setup
2. Go to https://dashboard.stripe.com/apikeys
3. Copy your **Publishable key** (starts with `pk_live_`)
4. Copy your **Secret key** (starts with `sk_live_`)

⚠️ **NEVER commit your secret keys to git!**

---

## Step 3: Configure Environment Variables

### For Local Development

Update `assets/js/env.js`:

```javascript
window.ENV = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_YOUR_KEY_HERE'
};
```

### For Vercel Deployment

Add these environment variables in your Vercel dashboard (Settings → Environment Variables):

```
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=(leave empty for now, we'll add this after webhooks)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
APP_URL=https://yourdomain.com
PLATFORM_FEE_PERCENT=10
```

**Important:** Use the **Service Role Key** from Supabase (not the anon key) for server-side operations.

---

## Step 4: Install Dependencies

Run in your project directory:

```bash
npm install
```

This will install:
- `stripe` - Stripe Node.js SDK
- `@supabase/supabase-js` - Supabase client for API functions

---

## Step 5: Deploy to Vercel

```bash
# Install Vercel CLI if you haven't already
npm install -g vercel

# Deploy
vercel --prod
```

After deployment, your API endpoints will be available at:
- `https://yourdomain.com/api/stripe/create-connect-account`
- `https://yourdomain.com/api/stripe/create-account-link`
- `https://yourdomain.com/api/stripe/check-connect-status`
- `https://yourdomain.com/api/stripe/create-checkout-session`
- `https://yourdomain.com/api/stripe/webhook`

---

## Step 6: Set Up Webhooks

Webhooks are crucial for updating booking status when payments succeed.

### Development (using Stripe CLI)

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login:
   ```bash
   stripe login
   ```
3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to http://localhost:8000/api/stripe/webhook
   ```
4. Copy the webhook signing secret (starts with `whsec_`) and add to your local env

### Production (Vercel)

1. Go to https://dashboard.stripe.com/webhooks
2. Click **Add endpoint**
3. Enter your webhook URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `account.updated`
   - `charge.refunded`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add it to Vercel environment variables as `STRIPE_WEBHOOK_SECRET`
7. Redeploy your app

---

## Step 7: Update Content Security Policy

The `vercel.json` file has already been updated to allow Stripe domains. Ensure these are present:

```json
{
  "script-src": "... https://js.stripe.com",
  "connect-src": "... https://api.stripe.com https://checkout.stripe.com",
  "frame-src": "https://checkout.stripe.com https://js.stripe.com",
  "form-action": "... https://checkout.stripe.com"
}
```

---

## Step 8: Test the Integration

### Testing as a Property Owner

1. Sign up with account type "Owner"
2. Go to Owner Dashboard
3. You should see a "Set Up Payment Account" section
4. Click "Set Up Payment Account"
5. Complete the Stripe Connect onboarding (in test mode, use test data)
6. Return to dashboard - you should see "Payment Account Active"

### Testing as a Renter

1. Sign up with account type "Renter"
2. Browse properties and create a booking
3. Go to Renter Dashboard
4. Find your pending booking
5. Click "Pay Now"
6. You'll be redirected to Stripe Checkout
7. Use test card: `4242 4242 4242 4242`, any future date, any CVC
8. Complete payment
9. You should be redirected back with success message
10. Booking status should update to "confirmed"

### Test Cards

Use these test card numbers in **test mode only**:
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **Requires authentication:** 4000 0025 0000 3155

More test cards: https://stripe.com/docs/testing

---

## How It Works

### For Property Owners

1. Owner signs up and goes to dashboard
2. System creates a Stripe Connect Express account
3. Owner completes onboarding (identity verification, bank details)
4. Owner can now receive payments for bookings
5. Payments are automatically split:
   - Platform fee (default 10%) goes to your platform account
   - Remainder goes directly to the owner's connected account

### For Renters (Guests)

1. Renter creates a booking
2. Booking is created with status "pending"
3. Renter clicks "Pay Now"
4. System creates a Stripe Checkout session with:
   - Destination charge to property owner
   - Application fee for platform
5. Renter completes payment on Stripe Checkout
6. Webhook receives `checkout.session.completed` event
7. Booking status updated to "confirmed"
8. Payment transaction record created

---

## Platform Fee Configuration

The platform fee is set via the `PLATFORM_FEE_PERCENT` environment variable (default: 10%).

To change it:
1. Update in Vercel environment variables
2. Redeploy the app

Example: For a $100 booking with 10% platform fee:
- Guest pays: $100
- Platform receives: $10
- Property owner receives: $90

---

## Security Best Practices

✅ **DO:**
- Use environment variables for all API keys
- Use Service Role Key only in serverless functions
- Verify webhook signatures
- Use HTTPS in production
- Enable RLS policies in Supabase

❌ **DON'T:**
- Commit API keys to git
- Expose secret keys in client-side code
- Skip webhook signature verification
- Use test keys in production

---

## Troubleshooting

### "No authorization header" error
- Ensure user is logged in
- Check that `Authorization` header is being sent with API requests

### "Property owner has not set up payments yet"
- Owner must complete Stripe Connect onboarding first
- Check `stripe_connect_account_id` in user_profiles table

### "Webhook signature verification failed"
- Ensure `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint secret
- Check that you're using the correct secret for test/live mode

### Payment succeeded but booking not confirmed
- Check webhook logs in Stripe Dashboard
- Verify webhook endpoint is receiving events
- Check Vercel function logs for errors

### Owner can't complete onboarding
- Ensure `APP_URL` environment variable is set correctly
- Check that return_url and refresh_url are accessible
- Verify owner has a valid email in their profile

---

## Going Live

Before switching to production:

1. ✅ Complete Stripe account activation
2. ✅ Switch to live API keys in Vercel
3. ✅ Update webhook endpoint with live mode secret
4. ✅ Test the entire flow with real bank accounts
5. ✅ Review and understand Stripe fees
6. ✅ Set up bank account for platform fees
7. ✅ Configure payout schedule in Stripe Dashboard
8. ✅ Review and comply with Stripe's terms of service

---

## Support & Resources

- **Stripe Documentation:** https://stripe.com/docs
- **Stripe Connect Guide:** https://stripe.com/docs/connect
- **Stripe Checkout:** https://stripe.com/docs/payments/checkout
- **Stripe Testing:** https://stripe.com/docs/testing
- **Stripe Dashboard:** https://dashboard.stripe.com

---

## File Reference

**New files added:**
- `api/_utils.js` - Shared utilities for API functions
- `api/stripe/create-connect-account.js` - Create Connect account
- `api/stripe/create-account-link.js` - Generate onboarding link
- `api/stripe/check-connect-status.js` - Check account status
- `api/stripe/create-checkout-session.js` - Create payment session
- `api/stripe/webhook.js` - Handle Stripe events
- `assets/js/stripe-connect.js` - Connect UI and management
- `assets/js/stripe-checkout.js` - Checkout flow management
- `assets/css/stripe.css` - Stripe UI styling
- `config/migrations/001_add_stripe_columns.sql` - Database migration

**Modified files:**
- `package.json` - Added Stripe dependencies
- `config.example.js` - Added Stripe config
- `.env.example` - Added Stripe environment variables
- `vercel.json` - Updated CSP for Stripe domains
- `pages/owner-dashboard.html` - Added Connect UI
- `pages/renter-dashboard.html` - Added payment UI
- `assets/js/dashboard.js` - Added payment button logic

---

## Next Steps

After completing the setup:
1. Test thoroughly in test mode
2. Consider implementing refund functionality
3. Add email notifications for payments
4. Set up monitoring and alerts
5. Review Stripe Dashboard regularly for insights

Need help? Check the Stripe documentation or reach out to Stripe support!
