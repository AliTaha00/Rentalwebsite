# Google Maps API Setup Instructions

## Step 1: Get a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Maps JavaScript API**
   - **Places API** (for autocomplete features)
4. Go to **APIs & Services** > **Credentials**
5. Click **Create Credentials** > **API Key**
6. Copy your API key

## Step 2: Secure Your API Key

1. Click on your new API key to configure it
2. Under **Application restrictions**, select **HTTP referrers**
3. Add your website domains:
   - `http://localhost:*`
   - `http://127.0.0.1:*`
   - `https://yourdomain.com/*`
4. Under **API restrictions**, select **Restrict key**
5. Select only the APIs you need:
   - Maps JavaScript API
   - Places API

## Step 3: Add API Key to Your Project

### Option 1: Direct Replacement (Quick Setup)
1. Open `pages/search-results.html`
2. Find the line:
   ```html
   <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places"></script>
   ```
3. Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual API key

### Option 2: Environment Variable (Recommended for Production)
1. Create a `config.js` file (add to `.gitignore`):
   ```javascript
   const GOOGLE_MAPS_CONFIG = {
       apiKey: 'YOUR_API_KEY_HERE'
   };
   ```

2. Update `pages/search-results.html` to load the key dynamically:
   ```html
   <script src="../config.js"></script>
   <script>
       const script = document.createElement('script');
       script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_CONFIG.apiKey}&libraries=places`;
       document.head.appendChild(script);
   </script>
   ```

## Step 4: Test Your Implementation

1. Open your website in a browser
2. Navigate to the search results page
3. The map should load and display markers with property prices
4. Click on markers to see property details in an info window

## Features Implemented

✅ **Google Maps Integration**
- Interactive map with custom styling
- Disabled POI labels for cleaner look
- Fullscreen control enabled

✅ **Custom Price Markers**
- White background with green border
- Shows property price on each marker
- Hover effects for better UX
- Automatic fallback for older browsers

✅ **Info Windows**
- Property image preview
- Property title
- Price per night
- Clickable to view full property details

✅ **Auto-Fit Bounds**
- Map automatically zooms to show all properties
- Adjusts zoom level based on property locations
- Single property gets appropriate zoom level

✅ **Map Toggle**
- Switch between list and map view
- Proper resize handling when toggling
- Mobile-responsive (map goes fullscreen on mobile)

## Pricing & Limits

Google Maps offers a generous free tier:
- **$200 free credit per month**
- Maps JavaScript API: ~28,000 free loads per month
- Most small to medium websites stay within free limits

## Troubleshooting

### Map doesn't load
- Check browser console for errors
- Verify API key is correct
- Ensure Maps JavaScript API is enabled in Google Cloud Console
- Check domain restrictions match your current domain

### Markers don't show
- Verify property data has valid latitude/longitude
- Check console for JavaScript errors
- Try clearing browser cache

### "This page can't load Google Maps correctly"
- API key is missing or invalid
- Billing is not enabled (even for free tier)
- Domain restrictions are too strict

## Need Help?

- [Google Maps JavaScript API Documentation](https://developers.google.com/maps/documentation/javascript)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)

