// Create an onboarding link for Stripe Connect accounts
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

    // Get user profile with Connect account ID
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('stripe_connect_account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile.stripe_connect_account_id) {
      return errorResponse(res, 'No Connect account found. Please create one first.', 404);
    }

    const accountId = profile.stripe_connect_account_id;
    const appUrl = process.env.APP_URL || 'http://localhost:8000';

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/pages/owner-dashboard.html?connect=refresh`,
      return_url: `${appUrl}/pages/owner-dashboard.html?connect=success`,
      type: 'account_onboarding',
    });

    return successResponse(res, {
      url: accountLink.url,
      accountId: accountId,
    });
  } catch (error) {
    console.error('Error creating account link:', error);
    return errorResponse(res, error.message || 'Failed to create account link', 500);
  }
};
