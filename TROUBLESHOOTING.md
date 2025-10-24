# Troubleshooting Guide - "Property Not Found" Error

## 🔍 The Problem

When you click on a property card, you see "Property Not Found" on the detail page.

## 📋 Diagnosis Steps

### Step 1: Open Browser DevTools (F12)

1. Press **F12** to open Developer Tools
2. Click on the **Console** tab
3. Look for error messages

You should see debug logs like:
```
Property Detail Page - Initializing...
Property ID: some-uuid-here
Supabase initialized
Fetching property with ID: some-uuid-here
```

### Step 2: Check for Common Errors

Look for these specific error messages in the console:

#### Error A: "Supabase configuration missing"
**Cause**: Supabase credentials not configured

**Fix**: Set up your Supabase credentials

#### Error B: "PropertyService not loaded"
**Cause**: JavaScript files not loading in correct order

**Fix**: Check that property-service.js is included before property-detail.js

#### Error C: "Property not found in database"
**Cause**: No properties exist in your Supabase database

**Fix**: Add test data to your database (see below)

---

## ✅ Solution 1: Configure Supabase

### Option A: Using Browser Console (Quick for Testing)

1. Open browser console (F12)
2. Run these commands (replace with YOUR credentials):

```javascript
localStorage.setItem('SUPABASE_URL', 'https://your-project.supabase.co');
localStorage.setItem('SUPABASE_ANON_KEY', 'your-anon-key-here');
```

3. Refresh the page

### Option B: Using env.js (Recommended)

1. Create `assets/js/env.js` if it doesn't exist:

```javascript
window.ENV = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key-here'
};
```

2. Make sure it's loaded in your HTML:
```html
<script src="../assets/js/env.js"></script>
<script src="../assets/js/supabase-client.js"></script>
```

### Where to Find Your Supabase Credentials:

1. Go to [supabase.com](https://supabase.com)
2. Open your project
3. Click **Settings** (gear icon) → **API**
4. Copy:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

---

## ✅ Solution 2: Add Test Properties to Database

If Supabase is connected but you still see "Property not found", you need to add properties to your database.

### Quick Test Property (SQL)

1. Go to Supabase Dashboard
2. Click **SQL Editor**
3. Run this query to add a test property:

```sql
-- First, you need a test user (if you don't have one)
-- Sign up through your app first, then get your user ID from the auth.users table

-- Add a test property (replace USER_ID with your actual user ID)
INSERT INTO properties (
    owner_id,
    title,
    description,
    property_type,
    view_type,
    address,
    city,
    state,
    country,
    bedrooms,
    bathrooms,
    max_guests,
    base_price,
    amenities,
    is_active
) VALUES (
    'YOUR_USER_ID_HERE',  -- Replace with actual user ID
    'Stunning Mountain Retreat',
    'Beautiful cabin with breathtaking mountain views. Perfect for a peaceful getaway.',
    'cabin',
    'Mountain View',
    '123 Mountain Road',
    'Aspen',
    'Colorado',
    'United States',
    3,
    2,
    6,
    250.00,
    '["wifi", "parking", "kitchen", "heating"]'::jsonb,
    true
);

-- Add a test image for the property
INSERT INTO property_images (
    property_id,
    image_url,
    display_order
) VALUES (
    (SELECT id FROM properties WHERE title = 'Stunning Mountain Retreat' LIMIT 1),
    'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&auto=format&fit=crop&q=80',
    1
);
```

### How to Get Your User ID:

**Option 1: Through SQL**
```sql
-- Run this in Supabase SQL Editor
SELECT id, email FROM auth.users;
```

**Option 2: Through Browser Console**
```javascript
// Run this in browser console after logging in
console.log(window.supabaseClient.user.id);
```

### Add Multiple Test Properties:

```sql
-- Mountain View Property
INSERT INTO properties (owner_id, title, description, property_type, view_type, address, city, state, country, bedrooms, bathrooms, max_guests, base_price, amenities, is_active)
VALUES ('YOUR_USER_ID', 'Cozy Mountain Cabin', 'Escape to the mountains in this charming cabin.', 'cabin', 'Mountain View', '456 Pine Trail', 'Boulder', 'Colorado', 'United States', 2, 1, 4, 150.00, '["wifi", "parking", "kitchen"]'::jsonb, true);

-- Ocean View Property
INSERT INTO properties (owner_id, title, description, property_type, view_type, address, city, state, country, bedrooms, bathrooms, max_guests, base_price, amenities, is_active)
VALUES ('YOUR_USER_ID', 'Beachfront Paradise', 'Wake up to ocean waves and stunning sunrises.', 'house', 'Ocean View', '789 Beach Ave', 'Malibu', 'California', 'United States', 4, 3, 8, 450.00, '["wifi", "parking", "pool", "kitchen"]'::jsonb, true);

-- City View Property
INSERT INTO properties (owner_id, title, description, property_type, view_type, address, city, state, country, bedrooms, bathrooms, max_guests, base_price, amenities, is_active)
VALUES ('YOUR_USER_ID', 'Downtown Skyline Loft', 'Modern loft with panoramic city views.', 'apartment', 'City Skyline View', '321 Main St', 'New York', 'New York', 'United States', 1, 1, 2, 200.00, '["wifi", "parking"]'::jsonb, true);
```

---

## ✅ Solution 3: Check Database Schema

Make sure your database has the correct schema:

1. Go to Supabase Dashboard
2. Click **Table Editor**
3. Verify these tables exist:
   - `properties`
   - `property_images`
   - `user_profiles`

If tables are missing, run the schema from `config/database-schema.sql`

---

## ✅ Solution 4: Check RLS Policies

Row Level Security (RLS) might be blocking access:

### Temporarily Disable RLS for Testing:

```sql
-- In Supabase SQL Editor
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE property_images DISABLE ROW LEVEL SECURITY;
```

**⚠️ Warning**: Only do this for testing! Re-enable it for production.

### Or Add Permissive Policy:

```sql
-- Allow anyone to read properties
CREATE POLICY "Enable read access for all users" ON properties
FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON property_images
FOR SELECT USING (true);
```

---

## 🔍 Detailed Console Check

After refreshing the page, check for these logs in console:

### ✅ Success Logs (What you want to see):
```
Property Detail Page - Initializing...
Property ID: abc-123-def-456
Supabase initialized
Fetching property with ID: abc-123-def-456
Property loaded successfully: Stunning Mountain Retreat
```

### ❌ Error Logs (What to fix):

**"Property not found in database"**
- No property exists with that ID
- Add test properties (see Solution 2)

**"Failed to load property details"**
- Supabase query failed
- Check RLS policies (see Solution 4)

**"PropertyService not loaded"**
- JavaScript loading order issue
- Check HTML includes property-service.js before property-detail.js

**"Supabase configuration missing"**
- Credentials not set
- Configure Supabase (see Solution 1)

---

## 🧪 Testing Checklist

After applying fixes, verify:

- [ ] Console shows "Supabase initialized"
- [ ] Console shows "Property loaded successfully"
- [ ] Property detail page shows property info
- [ ] Images load correctly
- [ ] No red errors in console

---

## 🚨 Still Not Working?

### Collect This Debug Info:

1. **Browser Console Logs**: Copy all console output
2. **Network Tab**: Check for failed requests (F12 → Network tab)
3. **Property ID**: Note the ID from the URL (`?id=...`)
4. **Supabase Status**: Check Supabase dashboard for project status

### Common Final Issues:

**Issue**: Properties show on listing page but not detail page
**Fix**: Property IDs might not match. Check that the property ID in the URL actually exists in your database.

**Issue**: Images don't load
**Fix**: Add property_images records or update image URLs in database.

**Issue**: "Cannot read property of undefined"
**Fix**: Check that all required fields exist in your property records.

---

## 📞 Quick Support Checklist

Run these commands in browser console and share the output:

```javascript
// Check configuration
console.log('Supabase URL:', localStorage.getItem('SUPABASE_URL') || window.ENV?.SUPABASE_URL);
console.log('Supabase connected:', !!window.supabaseClient?.supabase);
console.log('PropertyService loaded:', !!window.PropertyService);
console.log('Current user:', window.supabaseClient?.user?.email);

// Test property fetch
const testId = new URLSearchParams(window.location.search).get('id');
console.log('Property ID from URL:', testId);

// Try fetching property
if (window.PropertyService && testId) {
    window.PropertyService.getPropertyById(testId)
        .then(p => console.log('Property found:', p))
        .catch(e => console.error('Property error:', e));
}
```

---

## 🎯 Most Common Solution

**90% of "Property Not Found" errors are caused by:**
1. **No test data in database** → Add properties using SQL above
2. **Supabase not configured** → Set credentials in localStorage or env.js
3. **Wrong user ID** → Make sure properties have your user's ID as owner_id

Start with these three checks! 🚀
