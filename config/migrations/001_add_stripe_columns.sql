-- Migration: Add Stripe Connect and Payment columns
-- Run this migration after the initial schema setup

-- Add Stripe Connect fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN DEFAULT FALSE;

-- Add index for faster Connect account lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_connect
ON user_profiles(stripe_connect_account_id)
WHERE stripe_connect_account_id IS NOT NULL;

-- Add Stripe session tracking to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(200);

-- Add index for session lookups
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session
ON bookings(stripe_session_id)
WHERE stripe_session_id IS NOT NULL;

-- Add additional Stripe fields to payment_transactions
ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'card';

-- Add index for transaction lookups
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_session
ON payment_transactions(stripe_session_id)
WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_intent
ON payment_transactions(stripe_payment_intent_id)
WHERE stripe_payment_intent_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.stripe_connect_account_id IS 'Stripe Connect account ID for property owners to receive payments';
COMMENT ON COLUMN user_profiles.stripe_connect_onboarding_complete IS 'Whether the owner has completed Stripe Connect onboarding';
COMMENT ON COLUMN bookings.stripe_session_id IS 'Stripe Checkout Session ID for payment tracking';
COMMENT ON COLUMN payment_transactions.stripe_session_id IS 'Stripe Checkout Session ID associated with this transaction';
COMMENT ON COLUMN payment_transactions.payment_method IS 'Payment method used (card, bank_transfer, etc.)';
