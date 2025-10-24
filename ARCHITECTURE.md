# RentThatView - Architecture Documentation

## Overview

RentThatView is a vacation rental platform built with vanilla JavaScript and Supabase, featuring a clean, modular architecture designed for scalability and maintainability.

## Architecture Improvements (Latest Update)

### 1. CSS Architecture

#### Design System (`_variables.css`)
Centralized design tokens for consistent theming:
- **Color System**: Primary, secondary, semantic colors with light variants
- **Spacing Scale**: 8px-based spacing system (xs, sm, md, lg, xl, 2xl, 3xl)
- **Typography Scale**: Consistent font sizes, weights, and line heights
- **Design Tokens**: Border radius, shadows, transitions, z-index layers

#### Component Library (`_components.css`)
Reusable UI components:
- **Property Card**: Hover effects, image lazy loading, responsive design
- **Buttons**: Primary, secondary, outline, ghost variants with sizes
- **Forms**: Input, select, textarea with consistent styling and focus states
- **Loading States**: Spinners and skeleton screens
- **Badges & Cards**: Semantic color variants
- **Grid Layouts**: Auto-fit and auto-fill responsive grids

### 2. JavaScript Architecture

#### Service Layer (`/assets/js/services/`)

**PropertyService** (`property-service.js`)
- Centralized data access for all property-related operations
- Built-in caching mechanism (5-minute TTL)
- Methods:
  - `getProperties(filters)` - Fetch with advanced filtering
  - `getPropertyById(id)` - Single property with owner info
  - `getPropertyAvailability(id, startDate, endDate)` - Date range availability
  - `getPropertyReviews(id, limit)` - Property reviews with user data
  - `searchProperties(params)` - Advanced search with sorting
  - `getFeaturedProperties(limit)` - Featured listings
  - `getPropertiesByOwner(ownerId)` - Owner's properties

#### Component Layer (`/assets/js/components/`)

**PropertyCard** (`property-card.js`)
- Reusable property card renderer
- Features:
  - Lazy image loading with Intersection Observer
  - Wishlist functionality
  - XSS protection with HTML escaping
  - Flexible rendering options
  - Skeleton loading states
- Methods:
  - `PropertyCard.render(property, options)` - Create card element
  - `PropertyCard.renderSkeleton()` - Loading placeholder

#### Page Layer (`/assets/js/pages/`)

**PropertyDetailPage** (`property-detail.js`)
- Complete property detail view
- Features:
  - Image gallery with lightbox
  - Host information display
  - Amenities grid
  - Reviews section
  - Booking card with date picker (Flatpickr)
  - Price calculation (nightly rate, cleaning fee, service fee)
  - Share and save functionality
- Responsive design for mobile, tablet, desktop

### 3. Page Structure

#### Property Detail Page (`/pages/property-detail.html`)
New dedicated page for viewing full property information:
- **URL Pattern**: `/pages/property-detail.html?id={uuid}`
- **Sections**:
  - Property header (title, location, rating)
  - Image gallery (up to 5 images with "show all" button)
  - Host information
  - Property details (beds, baths, guests, type)
  - Description
  - Amenities grid
  - Reviews with ratings
  - Booking sidebar (sticky on desktop)
- **Loading States**: Skeleton screens, error handling
- **Authentication Integration**: Login required for booking

## File Structure

```
Rentalwebsite/
├── assets/
│   ├── css/
│   │   ├── _variables.css         # Design system tokens
│   │   ├── _components.css        # Reusable UI components
│   │   ├── main.css               # Global styles, navbar, footer
│   │   ├── properties.css         # Property listing styles
│   │   ├── property-detail.css    # Property detail page styles
│   │   ├── search-results.css     # Search results page styles
│   │   ├── dashboard.css          # Dashboard styles
│   │   ├── home.css               # Homepage styles
│   │   └── auth.css               # Authentication pages styles
│   │
│   └── js/
│       ├── core/
│       │   ├── supabase-client.js # Supabase connection & auth
│       │   ├── main.js            # App initialization, navigation
│       │   └── ui.js              # Toast notifications, modals
│       │
│       ├── components/
│       │   └── property-card.js   # Reusable property card
│       │
│       ├── services/
│       │   └── property-service.js # Property data operations
│       │
│       └── pages/
│           ├── property-detail.js  # Property detail page logic
│           ├── properties.js       # Property listing page
│           ├── dashboard.js        # Dashboard logic
│           ├── property-form.js    # Property CRUD
│           ├── search-results.js   # Search results logic
│           ├── auth.js             # Auth form handlers
│           ├── login.js            # Login page logic
│           └── register.js         # Registration logic
│
├── pages/
│   ├── property-detail.html       # NEW: Property detail page
│   ├── properties.html            # Property listings
│   ├── search-results.html        # Search results
│   ├── owner-dashboard.html       # Owner dashboard
│   ├── renter-dashboard.html      # Renter dashboard
│   ├── property-form.html         # Property add/edit
│   ├── login.html                 # Login page
│   ├── register.html              # Registration page
│   └── about.html                 # About page
│
├── config/
│   ├── database-schema.sql        # Complete database schema
│   └── supabase-setup.md          # Setup instructions
│
├── index.html                     # Homepage
├── CLAUDE.md                      # Project instructions for Claude
├── ARCHITECTURE.md                # This file
└── README.md                      # Project overview

```

## Design Patterns

### 1. Class-Based Architecture
All major features are implemented as ES6 classes:
- Single responsibility principle
- Encapsulation with private methods (`#methodName`)
- Clear initialization patterns with `async init()`

### 2. Service Layer Pattern
Data operations abstracted into service classes:
- Centralized API calls
- Built-in caching
- Error handling
- Data transformation

### 3. Component Pattern
Reusable UI components as static classes:
- Pure render functions
- No internal state
- Props-based configuration
- XSS protection

### 4. Event-Driven Communication
Custom events for cross-component communication:
- `auth:state` - Authentication state changes
- Decoupled components
- Easy to extend

### 5. Global Singleton Pattern
Core services exposed as window globals:
- `window.supabaseClient` - Database & auth
- `window.PropertyService` - Property operations
- `window.viewVistaApp` - Main app controller
- `window.UI` - UI utilities

## Routing

### Client-Side
- Query parameter-based routing (e.g., `?id=uuid`)
- Manual navigation handling
- Path detection for page context

### Pages
- `/` - Homepage with search and featured properties
- `/pages/properties.html` - Browse all properties
- `/pages/property-detail.html?id={uuid}` - **NEW** Property details
- `/pages/search-results.html?location=...` - Search results
- `/pages/owner-dashboard.html` - Owner dashboard
- `/pages/renter-dashboard.html` - Renter dashboard
- `/pages/property-form.html` - Add/edit property
- `/pages/login.html` - Login
- `/pages/register.html` - Registration

## Data Flow

### Property Listing Flow
```
User visits page
    ↓
PropertyService.getProperties(filters)
    ↓
Supabase query with filters & joins
    ↓
Process images & amenities
    ↓
PropertyCard.render() for each property
    ↓
Append to DOM
```

### Property Detail Flow
```
User clicks property card
    ↓
Navigate to property-detail.html?id={uuid}
    ↓
PropertyDetailPage.init()
    ↓
PropertyService.getPropertyById(id)
    ↓
Fetch property, images, owner info
    ↓
Render sections (gallery, details, amenities, reviews)
    ↓
Setup booking form & event listeners
```

### Booking Flow (Future)
```
User selects dates & guests
    ↓
Calculate total price (base + fees)
    ↓
User clicks "Reserve"
    ↓
Check authentication
    ↓
Validate availability
    ↓
Create booking record
    ↓
Process payment
    ↓
Send confirmation
```

## Authentication Flow

```
User signs up/logs in
    ↓
Supabase Auth creates user
    ↓
supabase-client.js receives auth state change
    ↓
Emit 'auth:state' custom event
    ↓
Update UI (show profile dropdown)
    ↓
Redirect to dashboard based on account_type
```

## Responsive Design

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Mobile-First Approach
- Base styles for mobile
- Progressive enhancement for larger screens
- Touch-friendly interactions
- Simplified layouts on small screens

## Performance Optimizations

### 1. Lazy Loading
- Images load only when visible (Intersection Observer)
- Reduces initial page load
- Improves perceived performance

### 2. Caching
- PropertyService caches API responses (5 min TTL)
- Reduces redundant database queries
- Faster subsequent page loads

### 3. Code Organization
- Modular JavaScript files
- Load only required scripts per page
- Reduced initial bundle size

### 4. CSS Optimization
- Shared component styles loaded once
- Page-specific styles loaded as needed
- CSS variables for instant theme changes

## Security

### 1. Row Level Security (RLS)
- All database operations enforced at DB level
- Users can only access/modify their own data
- Property owners can only edit their properties

### 2. XSS Protection
- All user input escaped before rendering
- `escapeHtml()` utility in components
- No direct innerHTML with user data

### 3. Authentication
- Supabase Auth handles tokens securely
- HTTP-only cookies
- Automatic token refresh

### 4. Input Validation
- Client-side validation for UX
- Server-side validation via Supabase policies
- Type checking on form submissions

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile: iOS Safari 12+, Chrome Android 90+

## Future Enhancements

### Short Term
1. **Booking System**: Complete reservation flow with payments
2. **Review System**: Full review submission UI
3. **Messaging**: Real-time messaging between guests and hosts
4. **Wishlist**: Complete wishlist functionality
5. **Image Gallery**: Full-screen lightbox for property images

### Medium Term
1. **State Management**: Lightweight state management library
2. **Client-Side Routing**: SPA-like navigation without page reloads
3. **Build System**: Vite/esbuild for bundling
4. **TypeScript**: Type safety and better DX
5. **Testing**: Unit and integration tests

### Long Term
1. **Mobile App**: React Native or PWA
2. **Admin Dashboard**: Platform management interface
3. **Analytics**: Property performance metrics
4. **Search Optimization**: PostGIS geographic queries
5. **AI Features**: Smart pricing, recommendation engine

## Development Workflow

### Local Development
1. Install a local web server (Python HTTP server, Live Server, etc.)
2. Set up Supabase credentials in localStorage or `env.js`
3. Run database migrations from `config/database-schema.sql`
4. Start the server and navigate to `index.html`

### Adding New Features
1. Create component in `/components` if reusable
2. Create service method in `/services` for data operations
3. Create page-specific logic in `/pages`
4. Update styles in appropriate CSS file
5. Test across breakpoints and browsers

### Code Style
- Use ES6+ features (classes, arrow functions, async/await)
- Private methods with `#` prefix
- Descriptive variable names
- JSDoc comments for public methods
- DRY principle - extract common logic

## Troubleshooting

### Common Issues

**Property cards not showing:**
- Check Supabase connection in browser console
- Verify `is_active = true` on properties
- Check PropertyService cache

**Images not loading:**
- Verify Supabase Storage policies
- Check image URLs in database
- Test image URLs directly in browser

**Authentication errors:**
- Clear localStorage and refresh
- Check Supabase Auth settings
- Verify RLS policies

**Booking not working:**
- Verify user is authenticated
- Check date selection
- Review console for errors

## Resources

- **Supabase Docs**: https://supabase.com/docs
- **Flatpickr**: https://flatpickr.js.org/
- **MDN Web Docs**: https://developer.mozilla.org/

---

**Last Updated**: 2024
**Architecture Version**: 2.0
