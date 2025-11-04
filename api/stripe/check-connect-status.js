// Check the status of a Stripe Connect account
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

  // Only allow GET
  if (req.method !== 'GET') {
    return errorResponse(res, 'Method not allowed', 405);
  }

  try {
    // Verify user authentication
    const user = await verifyAuth(req);
    const supabase = getSupabaseAdmin();

    // Get user profile with Connect account ID
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('stripe_connect_account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile.stripe_connect_account_id) {
      return successResponse(res, {
        hasAccount: false,
        isComplete: false,
      });
    }

    const accountId = profile.stripe_connect_account_id;

    // Retrieve account details from Stripe
    const account = await stripe.accounts.retrieve(accountId);

    // Check if account is fully onboarded
    const isComplete = account.details_submitted && account.charges_enabled;

    return successResponse(res, {
      hasAccount: true,
      isComplete: isComplete,
      accountId: accountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements,
    });
  } catch (error) {
    console.error('Error checking Connect status:', error);
    return errorResponse(res, error.message || 'Failed to check Connect status', 500);
  }
};
