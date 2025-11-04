// Create a Stripe Connect account for property owners
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
    const supabase = getSupabaseAdmin();

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('account_type, stripe_connect_account_id, email, full_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return errorResponse(res, 'User profile not found', 404);
    }

    // Verify user is an owner
    if (profile.account_type !== 'owner') {
      return errorResponse(res, 'Only property owners can create Connect accounts', 403);
    }

    // Check if user already has a Connect account
    if (profile.stripe_connect_account_id) {
      return successResponse(res, {
        accountId: profile.stripe_connect_account_id,
        alreadyExists: true,
      });
    }

    // Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      country: req.body.country || 'US', // Default to US, can be changed
      email: profile.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: {
        user_id: user.id,
        platform: 'RentThatView',
      },
    });

    // Save Connect account ID to user profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        stripe_connect_account_id: account.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error saving Connect account ID:', updateError);
      // Don't fail the request, just log the error
    }

    return successResponse(res, {
      accountId: account.id,
      alreadyExists: false,
    });
  } catch (error) {
    console.error('Error creating Connect account:', error);
    return errorResponse(res, error.message || 'Failed to create Connect account', 500);
  }
};
