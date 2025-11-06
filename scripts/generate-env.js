#!/usr/bin/env node
/**
 * Generate env.js from environment variables
 * This script helps create the env.js file from environment variables
 * Useful for CI/CD pipelines and automated deployments
 *
 * Usage:
 *   node scripts/generate-env.js
 *
 * Or in deployment:
 *   SUPABASE_URL=xxx SUPABASE_ANON_KEY=yyy node scripts/generate-env.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

// Environment variables to include in env.js
const ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'GOOGLE_MAPS_API_KEY',
  'SENTRY_DSN',
  'GOOGLE_ANALYTICS_ID'
];

/**
 * Read environment variables
 */
function readEnvVars() {
  const env = {};

  ENV_VARS.forEach(key => {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  });

  return env;
}

/**
 * Generate env.js content
 */
function generateEnvContent(env) {
  const entries = Object.entries(env)
    .map(([key, value]) => `  ${key}: '${value}'`)
    .join(',\n');

  return `/**
 * RentThatView Environment Configuration
 *
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * Generated: ${new Date().toISOString()}
 *
 * This file contains environment-specific configuration.
 * It should NEVER be committed to version control.
 *
 * To regenerate:
 *   node scripts/generate-env.js
 */

window.ENV = {
${entries}
};
`;
}

/**
 * Validate environment variables
 */
function validateEnv(env) {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GOOGLE_MAPS_API_KEY'];
  const missing = required.filter(key => !env[key]);

  if (missing.length > 0) {
    console.error(`${colors.red}✗ Missing required environment variables:${colors.reset}`);
    missing.forEach(key => {
      console.error(`  ${colors.red}• ${key}${colors.reset}`);
    });
    console.log(`\n${colors.yellow}Set them as environment variables or in .env file${colors.reset}\n`);
    return false;
  }

  // Validate formats
  if (!env.SUPABASE_URL.startsWith('https://')) {
    console.error(`${colors.red}✗ SUPABASE_URL must start with https://${colors.reset}\n`);
    return false;
  }

  if (!env.SUPABASE_URL.includes('supabase.co')) {
    console.warn(`${colors.yellow}⚠ SUPABASE_URL doesn't look like a valid Supabase URL${colors.reset}\n`);
  }

  if (!env.SUPABASE_ANON_KEY.startsWith('eyJ')) {
    console.error(`${colors.red}✗ SUPABASE_ANON_KEY doesn't look like a valid JWT${colors.reset}\n`);
    return false;
  }

  return true;
}

/**
 * Write env.js file
 */
function writeEnvFile(content) {
  const outputPath = path.join(__dirname, '..', 'assets', 'js', 'env.js');
  const outputDir = path.dirname(outputPath);

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    fs.writeFileSync(outputPath, content, 'utf8');
    return outputPath;
  } catch (error) {
    console.error(`${colors.red}✗ Failed to write env.js: ${error.message}${colors.reset}\n`);
    return null;
  }
}

/**
 * Main function
 */
function main() {
  console.log(`\n${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}   RentThatView Environment Generator      ${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);

  // Read environment variables
  console.log(`${colors.cyan}➤ Reading environment variables...${colors.reset}\n`);
  const env = readEnvVars();

  if (Object.keys(env).length === 0) {
    console.error(`${colors.red}✗ No environment variables found${colors.reset}`);
    console.log(`\n${colors.yellow}Set them as environment variables first:${colors.reset}`);
    console.log(`  ${colors.cyan}export SUPABASE_URL="https://xxx.supabase.co"${colors.reset}`);
    console.log(`  ${colors.cyan}export SUPABASE_ANON_KEY="eyJxxx..."${colors.reset}`);
    console.log(`  ${colors.cyan}export GOOGLE_MAPS_API_KEY="AIzaxxx..."${colors.reset}\n`);
    process.exit(1);
  }

  // Show what we found
  console.log(`${colors.green}Found ${Object.keys(env).length} environment variables:${colors.reset}`);
  Object.keys(env).forEach(key => {
    const value = env[key];
    const preview = value.length > 20 ? value.substring(0, 20) + '...' : value;
    console.log(`  ${colors.green}✓ ${key}${colors.reset} = ${preview}`);
  });
  console.log('');

  // Validate
  console.log(`${colors.cyan}➤ Validating environment variables...${colors.reset}\n`);
  if (!validateEnv(env)) {
    console.error(`${colors.red}✗ Validation failed${colors.reset}\n`);
    process.exit(1);
  }

  console.log(`${colors.green}✓ All validations passed${colors.reset}\n`);

  // Generate content
  console.log(`${colors.cyan}➤ Generating env.js...${colors.reset}\n`);
  const content = generateEnvContent(env);

  // Write file
  const outputPath = writeEnvFile(content);
  if (!outputPath) {
    process.exit(1);
  }

  console.log(`${colors.green}✓ Successfully generated env.js${colors.reset}`);
  console.log(`  ${colors.cyan}Location: ${outputPath}${colors.reset}\n`);

  // Show optional variables
  const optional = ENV_VARS.filter(key => !env[key]);
  if (optional.length > 0) {
    console.log(`${colors.yellow}ℹ Optional variables not set:${colors.reset}`);
    optional.forEach(key => {
      console.log(`  ${colors.yellow}• ${key}${colors.reset}`);
    });
    console.log('');
  }

  console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}✓ Environment configuration complete!${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);

  console.log(`${colors.yellow}⚠ IMPORTANT:${colors.reset}`);
  console.log(`  ${colors.yellow}• env.js contains sensitive credentials${colors.reset}`);
  console.log(`  ${colors.yellow}• Never commit env.js to version control${colors.reset}`);
  console.log(`  ${colors.yellow}• It's already in .gitignore${colors.reset}\n`);
}

// Run
if (require.main === module) {
  main();
}

module.exports = { generateEnvContent, validateEnv };
