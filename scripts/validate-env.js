/**
 * Environment Validation Script
 * Validates that all required environment variables are set before deployment
 * Run this script with: npm run validate
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Required environment variables
const REQUIRED_VARS = {
  'SUPABASE_URL': {
    description: 'Supabase project URL',
    example: 'https://xxxxx.supabase.co',
    pattern: /^https:\/\/.+\.supabase\.co$/
  },
  'SUPABASE_ANON_KEY': {
    description: 'Supabase anonymous key',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
  }
};

// Optional environment variables
const OPTIONAL_VARS = {
  'STRIPE_PUBLISHABLE_KEY': {
    description: 'Stripe publishable key (for payment processing)',
    pattern: /^pk_(test|live)_[A-Za-z0-9]+$/
  },
  'GOOGLE_MAPS_API_KEY': {
    description: 'Google Maps API key (for location search)',
    pattern: /^AIza[A-Za-z0-9_-]{35}$/
  },
  'SENTRY_DSN': {
    description: 'Sentry DSN (for error monitoring)',
    pattern: /^https:\/\/[a-f0-9]+@[a-z0-9]+\.ingest\.sentry\.io\/\d+$/
  },
  'GOOGLE_ANALYTICS_ID': {
    description: 'Google Analytics Tracking ID',
    pattern: /^(UA-\d+-\d+|G-[A-Z0-9]+)$/
  }
};

/**
 * Check if env.js file exists and parse it
 */
function checkEnvFile() {
  const envPath = path.join(__dirname, '..', 'assets', 'js', 'env.js');

  if (!fs.existsSync(envPath)) {
    console.error(`${colors.red}✗ Error: env.js file not found at assets/js/env.js${colors.reset}`);
    console.log(`${colors.yellow}  Create it from .env.example or config.example.js${colors.reset}\n`);
    return null;
  }

  try {
    const content = fs.readFileSync(envPath, 'utf8');

    // Extract environment variables from window.ENV object
    const envMatch = content.match(/window\.ENV\s*=\s*\{([^}]+)\}/s);
    if (!envMatch) {
      console.error(`${colors.red}✗ Error: Invalid env.js format${colors.reset}`);
      console.log(`${colors.yellow}  Expected: window.ENV = { ... }${colors.reset}\n`);
      return null;
    }

    const envVars = {};
    const envContent = envMatch[1];

    // Parse each key-value pair
    const keyValueRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = keyValueRegex.exec(envContent)) !== null) {
      envVars[match[1]] = match[2];
    }

    return envVars;
  } catch (error) {
    console.error(`${colors.red}✗ Error reading env.js: ${error.message}${colors.reset}\n`);
    return null;
  }
}

/**
 * Validate a single environment variable
 */
function validateVar(name, value, config) {
  const errors = [];
  const warnings = [];

  // Check if value exists
  if (!value || value.trim() === '') {
    errors.push('Missing or empty');
    return { valid: false, errors, warnings };
  }

  // Check for placeholder values
  const placeholders = ['your-', 'xxxxx', 'example', 'test-key', 'placeholder'];
  if (placeholders.some(placeholder => value.toLowerCase().includes(placeholder))) {
    errors.push('Contains placeholder value - replace with actual credentials');
    return { valid: false, errors, warnings };
  }

  // Validate pattern if provided
  if (config.pattern && !config.pattern.test(value)) {
    errors.push(`Invalid format. Expected pattern: ${config.example || 'see documentation'}`);
    return { valid: false, errors, warnings };
  }

  // Additional warnings
  if (name.includes('KEY') && value.length < 20) {
    warnings.push('Key seems unusually short');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Main validation function
 */
function validateEnvironment() {
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║   RentThatView Environment Validator       ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════╝${colors.reset}\n`);

  // Check env.js file
  console.log(`${colors.blue}➤ Checking environment file...${colors.reset}`);
  const envVars = checkEnvFile();

  if (!envVars) {
    console.log(`\n${colors.red}✗ Validation failed - env.js file issue${colors.reset}\n`);
    process.exit(1);
  }

  console.log(`${colors.green}✓ env.js file found and parsed${colors.reset}\n`);

  // Validate required variables
  console.log(`${colors.blue}➤ Validating required variables...${colors.reset}\n`);

  let hasErrors = false;
  let hasWarnings = false;

  Object.entries(REQUIRED_VARS).forEach(([name, config]) => {
    const value = envVars[name];
    const result = validateVar(name, value, config);

    if (result.valid) {
      console.log(`${colors.green}  ✓ ${name}${colors.reset}`);
      console.log(`    ${colors.cyan}${config.description}${colors.reset}`);
    } else {
      hasErrors = true;
      console.log(`${colors.red}  ✗ ${name}${colors.reset}`);
      console.log(`    ${colors.cyan}${config.description}${colors.reset}`);
      result.errors.forEach(error => {
        console.log(`    ${colors.red}→ ${error}${colors.reset}`);
      });
    }

    if (result.warnings.length > 0) {
      hasWarnings = true;
      result.warnings.forEach(warning => {
        console.log(`    ${colors.yellow}⚠ ${warning}${colors.reset}`);
      });
    }

    console.log('');
  });

  // Check optional variables
  console.log(`${colors.blue}➤ Checking optional variables...${colors.reset}\n`);

  Object.entries(OPTIONAL_VARS).forEach(([name, config]) => {
    const value = envVars[name];

    if (!value || value.trim() === '') {
      console.log(`${colors.yellow}  - ${name}${colors.reset}`);
      console.log(`    ${colors.cyan}${config.description} (not configured)${colors.reset}\n`);
    } else {
      const result = validateVar(name, value, config);

      if (result.valid) {
        console.log(`${colors.green}  ✓ ${name}${colors.reset}`);
        console.log(`    ${colors.cyan}${config.description}${colors.reset}\n`);
      } else {
        hasWarnings = true;
        console.log(`${colors.yellow}  ⚠ ${name}${colors.reset}`);
        console.log(`    ${colors.cyan}${config.description}${colors.reset}`);
        result.errors.forEach(error => {
          console.log(`    ${colors.yellow}→ ${error}${colors.reset}`);
        });
        console.log('');
      }
    }
  });

  // Print summary
  console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);

  if (hasErrors) {
    console.log(`${colors.red}✗ Validation FAILED${colors.reset}`);
    console.log(`${colors.yellow}  Please fix the errors above before deploying${colors.reset}\n`);
    process.exit(1);
  } else if (hasWarnings) {
    console.log(`${colors.yellow}⚠ Validation passed with warnings${colors.reset}`);
    console.log(`${colors.yellow}  Consider addressing the warnings above${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.green}✓ All validations passed!${colors.reset}`);
    console.log(`${colors.green}  Environment is properly configured${colors.reset}\n`);
    process.exit(0);
  }
}

// Run validation
if (require.main === module) {
  validateEnvironment();
}

module.exports = { validateEnvironment, checkEnvFile };
