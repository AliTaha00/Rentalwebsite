# RentThatView - Premium Property Rentals with Stunning Views

RentThatView is a modern rental property platform that connects property owners with travelers seeking accommodations with beautiful views. Built with **clean architecture**, **scalability**, and **user experience** in mind.

## ✨ Latest Updates (Architecture v2.0)

### 🎉 New Features
- ✅ **Property Detail Page**: Comprehensive property viewing with image gallery, amenities, reviews, and booking
- ✅ **Modular Component System**: Reusable PropertyCard component with lazy loading
- ✅ **Service Layer Architecture**: Centralized PropertyService with caching
- ✅ **Design System**: CSS variables and component library for consistent styling
- ✅ **Enhanced Performance**: Lazy image loading, caching, and optimized queries

### 📐 Architecture Improvements
- **CSS Variables** (`_variables.css`): Design tokens for colors, spacing, typography
- **Component Library** (`_components.css`): Reusable UI components (cards, buttons, forms, badges)
- **PropertyCard Component**: Reusable property card with lazy loading and wishlist support
- **PropertyService**: Centralized data operations with built-in caching (5-min TTL)
- **Page-Specific Logic**: Modular page controllers in `/assets/js/pages/`

> 📖 **Full architecture documentation**: See [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🌟 Features

### Core Functionality
- **Property Detail Pages**: Full property information with booking functionality
- **Dual Account Types**: Separate registration flows for property owners and renters
- **Advanced Property Search**: Filter by location, price, view type, amenities, and dates
- **Image Gallery**: Beautiful property showcases with lazy loading
- **Secure Authentication**: Supabase-powered auth with email verification
- **Review System**: Built-in rating and review system for properties and users
- **Responsive Design**: Mobile-first approach with modern, clean interface
- **Real-time Communication**: Message system between guests and hosts (schema ready)

### Security Features
- **Row Level Security (RLS)**: Database-level security policies
- **Role-based Access Control**: Different permissions for owners vs renters
- **Input Validation**: Client and server-side validation
- **Secure File Upload**: Protected image storage with access controls
- **Environment Configuration**: Secure API key management

### Production-Ready Architecture
- **Clean Architecture**: Service layer, component system, and modular pages
- **Reusable Components**: PropertyCard, form components, UI utilities
- **Performance Optimized**: Lazy loading, caching, skeleton screens
- **Design System**: CSS variables for consistent theming
- **Comprehensive Database**: PostgreSQL schema with RLS policies
- **Payment Integration**: Stripe-ready for secure transactions
- **API-First Design**: Easy integration with mobile apps or third-party services

## 🚀 Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Supabase (PostgreSQL, Authentication, Storage)
- **Database**: PostgreSQL with PostGIS for location features
- **Storage**: Supabase Storage for image management
- **Payments**: Stripe (integration ready)
- **Deployment**: Static hosting compatible (Netlify, Vercel, GitHub Pages)

## 📁 Project Structure

```
Rentalwebsite/
├── index.html                      # Homepage with featured properties
├── README.md                       # Project overview (this file)
├── ARCHITECTURE.md                 # Detailed architecture documentation
├── CLAUDE.md                       # Project instructions for Claude Code
│
├── assets/
│   ├── css/
│   │   ├── _variables.css         # ✨ Design system tokens
│   │   ├── _components.css        # ✨ Reusable UI components
│   │   ├── main.css               # Global styles, navbar, footer
│   │   ├── property-detail.css    # ✨ Property detail page styles
│   │   ├── properties.css         # Property listing styles
│   │   ├── search-results.css     # Search results styles
│   │   ├── dashboard.css          # Dashboard styles
│   │   ├── home.css               # Homepage styles
│   │   └── auth.css               # Authentication pages
│   │
│   └── js/
│       ├── supabase-client.js     # Supabase SDK wrapper & auth
│       ├── main.js                # App initialization, navigation
│       ├── ui.js                  # Toast notifications, modals
│       │
│       ├── components/
│       │   └── property-card.js   # ✨ Reusable property card
│       │
│       ├── services/
│       │   └── property-service.js # ✨ Property data operations
│       │
│       └── pages/
│           ├── property-detail.js  # ✨ Property detail page logic
│           ├── properties.js       # Property listing logic
│           ├── dashboard.js        # Dashboard logic
│           ├── property-form.js    # Property CRUD
│           ├── search-results.js   # Search results logic
│           ├── auth.js             # Auth form handlers
│           ├── login.js            # Login logic
│           ├── register.js         # Registration logic
│           └── home.js             # Homepage interactions
│
├── pages/
│   ├── property-detail.html       # ✨ Property detail page (NEW)
│   ├── properties.html            # Property listings
│   ├── search-results.html        # Search results
│   ├── owner-dashboard.html       # Owner dashboard
│   ├── renter-dashboard.html      # Renter dashboard
│   ├── property-form.html         # Property add/edit
│   ├── login.html                 # Login page
│   ├── register.html              # Registration
│   └── about.html                 # About page
│
└── config/
    ├── database-schema.sql        # Complete database schema
    └── supabase-setup.md          # Supabase setup guide

✨ = New or significantly updated in v2.0
```

## 🛠️ Setup Instructions

### 1. Clone and Basic Setup
```bash
git clone <repository-url>
cd Rentalwebsite
```

### 2. Supabase Configuration
1. Create a new project at [Supabase](https://supabase.com)
2. Follow the detailed setup guide in `config/supabase-setup.md`
3. Run the SQL schema from `config/database-schema.sql`
4. Configure your environment variables

### 3. Local Development
For local development, you can:
- Use a simple HTTP server: `python -m http.server 8000`
- Or use Live Server extension in VS Code
- Open `http://localhost:8000` in your browser

### 4. Environment Configuration

Pick ONE of the following:

- Quick dev (local only):
```javascript
localStorage.setItem('SUPABASE_URL', 'https://YOUR-PROJECT-ref.supabase.co');
localStorage.setItem('SUPABASE_ANON_KEY', 'YOUR_PUBLIC_ANON_KEY');
```

- For all users (recommended for deploy):
1) Copy `assets/js/env.example.js` to `assets/js/env.js`
2) Fill in your Supabase URL and anon key
3) Ensure `env.js` is loaded before `supabase-client.js` in all HTML pages:
```html
<script src="assets/js/env.js"></script>
<script src="assets/js/supabase-client.js"></script>
```
Notes:
- Only the public ANON key should be used on the client.
- Add your site domain to Supabase Auth → URL Config → Redirect URLs if you use OAuth.

## 🗄️ Database Schema

The database includes the following main tables:
- **user_profiles**: User information and account types
- **properties**: Property listings with location and pricing
- **property_images**: Property photo management
- **property_availability**: Calendar and pricing overrides
- **bookings**: Reservation management with payment tracking
- **reviews**: Rating and review system
- **messages**: Communication between users
- **wishlists**: User saved properties
- **payment_transactions**: Financial transaction logs

All tables include comprehensive Row Level Security policies.

## 🔐 Security Features

### Database Security
- Row Level Security (RLS) on all tables
- User-specific data access policies
- Secure file upload with access controls
- SQL injection prevention through parameterized queries

### Authentication Security
- Email verification (configurable)
- Secure password requirements
- Session management by Supabase
- Role-based access control

### Frontend Security
- Input sanitization and validation
- XSS prevention
- CSRF protection through Supabase
- Secure environment variable handling

## 🎨 Design System

### CSS Architecture
- **main.css**: Global utilities, components, and base styles
- **auth.css**: Authentication-specific styling with animations
- **home.css**: Homepage hero sections, features, and call-to-actions
- Responsive design with mobile-first approach
- Modern CSS Grid and Flexbox layouts

### Color Palette
- Primary: `#2563eb` (Blue)
- Secondary: `#1f2937` (Dark Gray)
- Background: `#fafafa` (Light Gray)
- Text: `#333333` (Dark)
- Success: `#10b981` (Green)
- Error: `#dc2626` (Red)

## 🔄 User Flows

### Registration Flow
1. Account type selection (Owner vs Renter)
2. Form completion with role-specific fields
3. Email verification (optional)
4. Redirect to appropriate dashboard

### Property Search Flow
1. Location and date-based search
2. Advanced filtering options
3. Grid/list view results
4. Property detail modal or page
5. Booking initiation

### Booking Flow (Ready for Implementation)
1. Date selection and guest count
2. Price calculation with fees
3. Stripe payment processing
4. Confirmation and communication

## 🚀 Deployment

### Static Hosting (Recommended)
This project is designed for static hosting:
- **Netlify**: Drag and drop deployment
- **Vercel**: GitHub integration
- **GitHub Pages**: Free hosting option
- **AWS S3**: Scalable static hosting

### Environment Variables for Production
```
SUPABASE_URL=your-production-url
SUPABASE_ANON_KEY=your-production-anon-key
```

## 📈 Future Enhancements

### Short Term (Next Sprint)
1. **Booking System**: Complete reservation flow with payment processing
2. **Review Submission**: UI for guests to leave reviews
3. **Wishlist Functionality**: Save and manage favorite properties
4. **Image Gallery Lightbox**: Full-screen image viewer
5. **Messaging System**: Real-time chat between guests and hosts

### Medium Term
1. **State Management**: Lightweight state management library
2. **Client-Side Routing**: SPA-like navigation
3. **Build System**: Vite/esbuild for bundling and optimization
4. **TypeScript Migration**: Type safety and better developer experience
5. **Testing Suite**: Unit and integration tests

### Long-term Features
- Mobile application (React Native/Flutter)
- Advanced search with map integration
- Multi-language support
- Push notifications
- Advanced analytics dashboard
- Social login integration
- Calendar sync with external platforms

## 🤝 Contributing

### Development Guidelines
1. Follow the established file structure
2. Use semantic HTML and accessible design
3. Maintain consistent code formatting
4. Test authentication flows thoroughly
5. Ensure mobile responsiveness
6. Follow security best practices

### Code Standards
- Use modern JavaScript (ES6+)
- Comment complex functionality
- Validate all user inputs
- Handle errors gracefully
- Optimize for performance

## 📝 API Documentation

### Supabase Client Usage
```javascript
// Authentication
await supabaseClient.signUp(email, password, userData);
await supabaseClient.signIn(email, password);
await supabaseClient.signOut();

// Database Operations
await supabaseClient.insertUserProfile(userId, profileData);
const profile = await supabaseClient.getUserProfile(userId);

// Security Checks
if (supabaseClient.requireAuth()) {
  // User is authenticated
}
```

### Database Queries
The schema includes optimized indexes and queries for:
- Property search by location and availability
- User authentication and authorization
- Booking management and conflicts
- Review aggregation and display
- Message threading and notifications

## 🔧 Troubleshooting

### Common Issues
1. **Supabase not connecting**: Check URL and API key configuration
2. **Authentication errors**: Verify redirect URLs in Supabase dashboard
3. **RLS policy issues**: Ensure policies match user roles
4. **File upload failures**: Check storage policies and bucket configuration

### Debug Mode
Enable debug logging by setting:
```javascript
localStorage.setItem('DEBUG', 'true');
```

## 📄 License

This project is designed as a foundation for rental property platforms. Please ensure compliance with local regulations regarding vacation rentals and payment processing.

## 📞 Support

For technical issues or questions:
1. Check the troubleshooting guide in `config/supabase-setup.md`
2. Review Supabase documentation
3. Check browser console for error messages
4. Verify network connectivity and CORS settings

---

**RentThatView** - Connecting travelers with unforgettable views 🏔️🌊🏙️