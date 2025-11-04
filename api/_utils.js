// Shared utilities for Vercel API functions
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Initialize Supabase with service role key (for admin operations)
const getSupabaseAdmin = () => {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*', // Update with your domain in production
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
};

// Handle CORS preflight
const handleCors = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).json({});
    return true;
  }
  return false;
};

// Error response helper
const errorResponse = (res, message, statusCode = 400) => {
  return res.status(statusCode).json({
    error: message,
  });
};

// Success response helper
const successResponse = (res, data, statusCode = 200) => {
  return res.status(statusCode).json(data);
};

// Verify authentication from request
const verifyAuth = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('No authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = getSupabaseAdmin();

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error('Invalid token');
  }

  return user;
};

module.exports = {
  stripe,
  getSupabaseAdmin,
  corsHeaders,
  handleCors,
  errorResponse,
  successResponse,
  verifyAuth,
};
