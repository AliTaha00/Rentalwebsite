# RentThatView

> **Status: Work in Progress** -- This project is actively under development. Some features are fully built, others are partially implemented or planned.

A vacation rental platform specializing in properties with exceptional views -- mountain, ocean, city skyline, and countryside. Built as a vanilla JavaScript web application with a Supabase backend.

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Database:** PostgreSQL with PostGIS for location queries
- **Hosting:** Static hosting (Vercel, Netlify, GitHub Pages)

## What's Built

### Pages
- **Homepage** with hero section, featured properties, and search
- **Property listings** with grid view and filtering
- **Property detail page** with image gallery, amenities, and reviews
- **Search results** with location/date/guest filtering
- **Owner dashboard** -- manage properties, view bookings, availability calendar
- **Renter dashboard** -- upcoming trips, booking history, wishlist
- **Property form** -- create and edit listings with image upload
- **Profile and settings pages**
- **Login / Register** with owner vs. renter account types
- **About page**

### Core Features
- Supabase authentication with email sign-up and role-based access
- Dual account system (property owners and renters)
- Property CRUD with image upload to Supabase Storage
- Reusable PropertyCard component with lazy loading
- PropertyService layer with client-side caching
- CSS design system with variables and reusable component classes
- Row Level Security (RLS) on all database tables
- Responsive, mobile-first layout
- Toast notification system

### Database
Full PostgreSQL schema with tables for users, properties, images, availability, bookings, reviews, messages, wishlists, and payments. Includes RLS policies, indexes, and automatic triggers. See `config/database-schema.sql`.

## What's In Progress / Planned

- Booking flow with payment processing (schema ready, UI not complete)
- Messaging between guests and hosts (schema ready, UI placeholder)
- Wishlist management UI
- Review submission UI
- Geographic radius search using PostGIS
- Admin panel

## Project Structure

```
index.html                          # Homepage
pages/                              # All other pages
assets/
  css/                              # Stylesheets (_variables, _components, page-specific)
  js/                               # JavaScript
    supabase-client.js              #   Supabase SDK wrapper and auth state
    main.js                         #   Navigation, profile dropdown, auth UI sync
    ui.js                           #   Toast notifications, modals
    components/property-card.js     #   Reusable property card component
    services/property-service.js    #   Property data layer with caching
    pages/                          #   Page-specific controllers
config/
  database-schema.sql               # Full database schema
  supabase-setup.md                 # Setup guide
```

## Local Development

1. Clone the repo
2. Create a [Supabase](https://supabase.com) project and run the schema from `config/database-schema.sql`
3. Copy `config.example.js` to `assets/js/env.js` and add your Supabase credentials
4. Serve with any static server:
   ```bash
   python -m http.server 8000
   ```
5. Open `http://localhost:8000`

See `config/supabase-setup.md` for detailed backend setup instructions.
