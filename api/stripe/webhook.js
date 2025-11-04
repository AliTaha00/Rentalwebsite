// Handle Stripe webhooks for payment and Connect events
const {
  stripe,
  getSupabaseAdmin,
  errorResponse,
  successResponse,
} = require('../_utils');

// Disable body parsing for webhooks (we need raw body)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to get raw body
const getRawBody = (req) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
};

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405);
  }

  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      return errorResponse(res, 'No signature provided', 400);
    }

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return errorResponse(res, `Webhook signature verification failed: ${err.message}`, 400);
    }

    const supabase = getSupabaseAdmin();

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const bookingId = session.metadata.booking_id;

        if (bookingId) {
          // Update booking status to confirmed
          const { error } = await supabase
            .from('bookings')
            .update({
              status: 'confirmed',
              payment_status: 'paid',
              updated_at: new Date().toISOString(),
            })
            .eq('id', bookingId);

          if (error) {
            console.error('Error updating booking status:', error);
          } else {
            console.log(`Booking ${bookingId} confirmed and marked as paid`);
          }

          // Create payment transaction record
          const { error: txError } = await supabase
            .from('payment_transactions')
            .insert({
              booking_id: bookingId,
              stripe_payment_intent_id: session.payment_intent,
              stripe_session_id: session.id,
              amount: session.amount_total / 100,
              currency: session.currency,
              status: 'succeeded',
              payment_method: 'card',
              created_at: new Date().toISOString(),
            });

          if (txError) {
            console.error('Error creating transaction record:', txError);
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const bookingId = paymentIntent.metadata.booking_id;

        if (bookingId) {
          console.log(`Payment succeeded for booking ${bookingId}`);

          // Update transaction if it exists
          const { error } = await supabase
            .from('payment_transactions')
            .update({
              status: 'succeeded',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_payment_intent_id', paymentIntent.id);

          if (error) {
            console.error('Error updating transaction:', error);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const bookingId = paymentIntent.metadata.booking_id;

        if (bookingId) {
          console.log(`Payment failed for booking ${bookingId}`);

          // Update booking status
          const { error } = await supabase
            .from('bookings')
            .update({
              payment_status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', bookingId);

          if (error) {
            console.error('Error updating booking payment status:', error);
          }

          // Update transaction
          const { error: txError } = await supabase
            .from('payment_transactions')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_payment_intent_id', paymentIntent.id);

          if (txError) {
            console.error('Error updating transaction:', txError);
          }
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object;
        const userId = account.metadata?.user_id;

        if (userId) {
          // Update user profile with account status
          const { error } = await supabase
            .from('user_profiles')
            .update({
              stripe_connect_onboarding_complete: account.details_submitted && account.charges_enabled,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (error) {
            console.error('Error updating user profile:', error);
          } else {
            console.log(`Updated Connect status for user ${userId}`);
          }
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;

        // Find transaction by payment intent
        const { data: transaction } = await supabase
          .from('payment_transactions')
          .select('booking_id')
          .eq('stripe_payment_intent_id', charge.payment_intent)
          .single();

        if (transaction) {
          // Update booking status to cancelled
          const { error } = await supabase
            .from('bookings')
            .update({
              status: 'cancelled',
              payment_status: 'refunded',
              updated_at: new Date().toISOString(),
            })
            .eq('id', transaction.booking_id);

          if (error) {
            console.error('Error updating booking for refund:', error);
          }

          // Update transaction status
          const { error: txError } = await supabase
            .from('payment_transactions')
            .update({
              status: 'refunded',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_payment_intent_id', charge.payment_intent);

          if (txError) {
            console.error('Error updating transaction for refund:', txError);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return 200 to acknowledge receipt of the event
    return successResponse(res, { received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return errorResponse(res, error.message || 'Webhook processing failed', 500);
  }
};
