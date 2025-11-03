# Configuration Setup

This project uses a `config.js` file to store sensitive API keys and configuration data.

## Initial Setup

1. **Copy the example config file:**
   ```bash
   cp config.example.js config.js
   ```

2. **Add your API keys to `config.js`:**
   - Google Maps API key
   - Any other API keys you need

3. **Never commit `config.js`:**
   - The file is already in `.gitignore`
   - Only commit `config.example.js` as a template

## Security Notes

✅ **What's Protected:**
- `config.js` - Contains your actual API keys (gitignored)
- `assets/js/env.js` - Contains Supabase keys (gitignored)

✅ **What's Safe to Commit:**
- `config.example.js` - Template with placeholder values
- All other code files

⚠️ **Important:**
- Never commit API keys to version control
- Keep `config.js` local only
- Share `config.example.js` with your team instead

## For New Team Members

If you're setting up this project for the first time:

1. Copy `config.example.js` to `config.js`
2. Ask your team lead for the actual API keys
3. Add the keys to your local `config.js`
4. The file will be ignored by git automatically

## Current API Keys Needed

- **Google Maps API Key** - For map display on search results page
  - Get one at: https://console.cloud.google.com/
  - Enable: Maps JavaScript API + Places API
  
- **Supabase Keys** - For database and authentication
  - Located in `assets/js/env.js`
  - Get from your Supabase project dashboard

