# Quick Fix - Property Cards Not Loading

## 🎯 The Problem
You have 11 properties in the database, but the cards show "ID: null" and "Title: No title".

## ✅ Quick Fix Script

**Run this in your browser console to manually load and render the properties:**

```javascript
// Quick fix: Manually load and render properties
(async function() {
    console.log('🔧 Starting quick fix...');

    // 1. Fetch properties
    const properties = await window.PropertyService.getProperties();
    console.log('✅ Fetched', properties.length, 'properties');

    // 2. Get the container
    const container = document.querySelector('.properties-grid, #propertiesGrid, .property-grid');
    if (!container) {
        console.error('❌ Could not find property container');
        return;
    }

    console.log('✅ Found container');

    // 3. Clear existing cards
    container.innerHTML = '';

    // 4. Render each property using PropertyCard component
    properties.forEach(property => {
        const card = window.PropertyCard.render(property, {
            linkToDetail: true,
            showWishlist: true,
            lazyLoad: false
        });
        container.appendChild(card);
    });

    console.log('✅ Rendered', properties.length, 'property cards');
    console.log('🎉 Done! Try clicking a card now.');
})();
```

**After running this:**
1. You should see 11 property cards with real data
2. Click any card
3. It should navigate to the detail page with the correct ID
4. The property should load!

---

## 🔍 Permanent Fix Needed

The script above is a temporary fix. The real issue is in one of these files:
- `assets/js/properties.js`
- `assets/js/home.js`
- Or the page isn't loading these scripts correctly

**To find the root cause, tell me:**
1. Which page are you on? (run: `console.log(window.location.pathname)`)
2. After running the quick fix, do the cards now show real data?
3. After clicking a card, does the detail page load correctly?

---

## 🐛 If Quick Fix Doesn't Work

If the script above fails, run this diagnostic:

```javascript
// Diagnostic
console.log('PropertyCard exists:', !!window.PropertyCard);
console.log('PropertyService exists:', !!window.PropertyService);
console.log('Container selector:', document.querySelector('.properties-grid, #propertiesGrid, .property-grid'));

// List all elements with "propert" in class name
const allElements = document.querySelectorAll('[class*="propert"]');
console.log('Elements with "propert" in class:', allElements.length);
allElements.forEach((el, i) => {
    console.log(`${i + 1}.`, el.className);
});
```

This will tell us the exact container name to use.
