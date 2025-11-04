// Create a Stripe Checkout session for booking payments
const {
  stripe,
  getSupabaseAdmin,
  corsHeaders,
  handleCors,
  errorResponse,
  successResponse,
  verifyAuth,
} = require('../_utils');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', corsHeaders['Access-Control-Allow-Credentials']);
  res.setHeader('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
  res.setHeader('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);

  // Handle CORS preflight
  if (handleCors(req, res)) return;

  // Only allow POST
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405);
  }

  try {
    // Verify user authentication
    const user = await verifyAuth(req);
    const { bookingId } = req.body;

    if (!bookingId) {
      return errorResponse(res, 'Booking ID is required', 400);
    }

    const supabase = getSupabaseAdmin();

    // Get booking details with property and owner information
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        properties!inner(
          id,
          title,
          owner_id,
          user_profiles!properties_owner_id_fkey(
            stripe_connect_account_id
          )
        )
      `)
      .eq('id', bookingId)
      .eq('guest_id', user.id)
      .single();

    if (bookingError || !booking) {
      return errorResponse(res, 'Booking not found', 404);
    }

    // Verify booking is in correct status
    if (booking.status !== 'pending') {
      return errorResponse(res, `Cannot process payment for booking with status: ${booking.status}`, 400);
    }

    // Check if owner has completed Connect onboarding
    const ownerConnectAccountId = booking.properties.user_profiles?.stripe_connect_account_id;

    if (!ownerConnectAccountId) {
      return errorResponse(res, 'Property owner has not set up payments yet', 400);
    }

    // Verify the Connect account is ready
    const account = await stripe.accounts.retrieve(ownerConnectAccountId);
    if (!account.charges_enabled) {
      return errorResponse(res, 'Property owner cannot receive payments yet', 400);
    }

    // Calculate amounts
    const totalAmount = Math.round(parseFloat(booking.total_price) * 100); // Convert to cents
    const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '10');
    const platformFee = Math.round(totalAmount * (platformFeePercent / 100));

    const appUrl = process.env.APP_URL || 'http://localhost:8000';

    // Create Checkout Session with destination charge
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: booking.properties.title,
              description: `Booking from ${booking.check_in_date} to ${booking.check_out_date}`,
            },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: ownerConnectAccountId,
        },
        metadata: {
          booking_id: bookingId,
          guest_id: user.id,
          property_id: booking.property_id,
          owner_id: booking.properties.owner_id,
        },
      },
      metadata: {
        booking_id: bookingId,
        guest_id: user.id,
        property_id: booking.property_id,
      },
      success_url: `${appUrl}/pages/renter-dashboard.html?payment=success&booking_id=${bookingId}`,
      cancel_url: `${appUrl}/pages/renter-dashboard.html?payment=cancelled&booking_id=${bookingId}`,
      customer_email: user.email,
    });

    // Update booking with Stripe session ID
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error updating booking with session ID:', updateError);
    }

    return successResponse(res, {
      sessionId: session.id,
      url: session.url,
      bookingId: bookingId,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return errorResponse(res, error.message || 'Failed to create checkout session', 500);
  }
};
