-- RentThatView Database Schema
-- Supabase PostgreSQL Schema with Row Level Security

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =====================================================
-- USER PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('owner', 'renter')),
    business_name VARCHAR(200), -- For property owners
    profile_image_url TEXT,
    bio TEXT,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50),
    postal_code VARCHAR(20),
    date_of_birth DATE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    identity_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id),
    UNIQUE(email)
);

-- =====================================================
-- PROPERTIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    property_type VARCHAR(50) NOT NULL, -- house, apartment, cabin, etc.
    view_type VARCHAR(100) NOT NULL, -- mountain, ocean, city, forest, etc.
    
    -- Location
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    country VARCHAR(50) NOT NULL,
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location GEOGRAPHY(POINT, 4326), -- PostGIS point for spatial queries
    
    -- Property details
    bedrooms INTEGER,
    bathrooms DECIMAL(3,1),
    max_guests INTEGER NOT NULL,
    property_size INTEGER, -- square feet/meters
    
    -- Pricing
    base_price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    cleaning_fee DECIMAL(10, 2) DEFAULT 0,
    service_fee_percentage DECIMAL(5, 2) DEFAULT 0,
    min_stay INTEGER DEFAULT 1,
    max_stay INTEGER,
    
    -- Amenities (JSON array)
    amenities JSONB DEFAULT '[]',
    
    -- House rules and policies
    house_rules TEXT,
    cancellation_policy VARCHAR(50) DEFAULT 'moderate',
    check_in_time TIME DEFAULT '15:00',
    check_out_time TIME DEFAULT '11:00',
    
    -- Status and verification
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMPTZ,
    featured BOOLEAN DEFAULT FALSE,
    
    -- SEO and search
    slug VARCHAR(300) UNIQUE,
    meta_title VARCHAR(200),
    meta_description TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PROPERTY IMAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS property_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(200),
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    image_type VARCHAR(50) DEFAULT 'interior', -- interior, exterior, view, amenity
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PROPERTY AVAILABILITY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS property_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    price_override DECIMAL(10, 2), -- Override base price for specific dates
    min_stay_override INTEGER, -- Override min stay for specific dates
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(property_id, date)
);

-- =====================================================
-- BOOKINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE RESTRICT,
    guest_id UUID REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
    owner_id UUID REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
    
    -- Booking details
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    num_guests INTEGER NOT NULL,
    
    -- Pricing breakdown
    base_amount DECIMAL(10, 2) NOT NULL,
    cleaning_fee DECIMAL(10, 2) DEFAULT 0,
    service_fee DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'refunded')),
    
    -- Payment information
    payment_intent_id VARCHAR(200), -- Stripe payment intent ID
    payment_status VARCHAR(20) DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    
    -- Special requests and notes
    guest_message TEXT,
    special_requests TEXT,
    owner_notes TEXT,
    
    -- Timestamps
    booking_date TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- REVIEWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    reviewee_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    review_type VARCHAR(20) NOT NULL CHECK (review_type IN ('guest_to_owner', 'owner_to_guest')),
    
    -- Ratings (1-5 scale)
    overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
    accuracy_rating INTEGER CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    location_rating INTEGER CHECK (location_rating >= 1 AND location_rating <= 5),
    value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
    
    -- Review content
    review_title VARCHAR(200),
    review_text TEXT NOT NULL,
    
    -- Status
    is_published BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    
    -- Response
    response_text TEXT,
    response_date TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(booking_id, review_type)
);

-- =====================================================
-- MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    
    message_text TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'booking_update')),
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- WISHLISTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS wishlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, property_id)
);

-- =====================================================
-- PAYMENT TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE RESTRICT,
    stripe_payment_intent_id VARCHAR(200),
    stripe_charge_id VARCHAR(200),
    
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('payment', 'refund', 'payout')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
    
    -- Fee breakdown
    platform_fee DECIMAL(10, 2) DEFAULT 0,
    payment_processing_fee DECIMAL(10, 2) DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    failure_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SEARCH LOGS TABLE (for analytics)
-- =====================================================
CREATE TABLE IF NOT EXISTS search_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    
    search_query TEXT,
    location VARCHAR(200),
    check_in_date DATE,
    check_out_date DATE,
    num_guests INTEGER,
    price_min DECIMAL(10, 2),
    price_max DECIMAL(10, 2),
    property_type VARCHAR(50),
    amenities JSONB,
    
    results_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_type ON user_profiles(account_type);

-- Properties indexes
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_is_active ON properties(is_active);
CREATE INDEX IF NOT EXISTS idx_properties_featured ON properties(featured);
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_properties_city_state ON properties(city, state);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(base_price);
CREATE INDEX IF NOT EXISTS idx_properties_view_type ON properties(view_type);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);

-- Property images indexes
CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_property_images_is_primary ON property_images(is_primary);

-- Availability indexes
CREATE INDEX IF NOT EXISTS idx_availability_property_date ON property_availability(property_id, date);
CREATE INDEX IF NOT EXISTS idx_availability_date_available ON property_availability(date, is_available);

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_id ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner_id ON bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_property_id ON reviews(property_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_published ON reviews(is_published);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_unread ON messages(recipient_id, is_read, created_at);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- User profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Public profiles for property owners and reviews
DROP POLICY IF EXISTS "Public can view active user profiles" ON user_profiles;
CREATE POLICY "Public can view active user profiles" ON user_profiles
    FOR SELECT USING (is_active = true);

-- Properties policies
DROP POLICY IF EXISTS "Anyone can view active properties" ON properties;
CREATE POLICY "Anyone can view active properties" ON properties
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Owners can manage their properties" ON properties;
CREATE POLICY "Owners can manage their properties" ON properties
    FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can INSERT properties" ON properties;
CREATE POLICY "Owners can INSERT properties" ON properties
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Property images policies
DROP POLICY IF EXISTS "Anyone can view property images" ON property_images;
CREATE POLICY "Anyone can view property images" ON property_images
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM properties 
            WHERE properties.id = property_images.property_id 
            AND properties.is_active = true
        )
    );

DROP POLICY IF EXISTS "Owners can manage their property images" ON property_images;
CREATE POLICY "Owners can manage their property images" ON property_images
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM properties 
            WHERE properties.id = property_images.property_id 
            AND properties.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can INSERT their property images" ON property_images;
CREATE POLICY "Owners can INSERT their property images" ON property_images
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM properties
            WHERE properties.id = property_images.property_id
              AND properties.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can UPDATE their property images" ON property_images;
CREATE POLICY "Owners can UPDATE their property images" ON property_images
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM properties
            WHERE properties.id = property_images.property_id
              AND properties.owner_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM properties
            WHERE properties.id = property_images.property_id
              AND properties.owner_id = auth.uid()
        )
    );

-- Bookings policies
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
CREATE POLICY "Users can view their own bookings" ON bookings
    FOR SELECT USING (auth.uid() = guest_id OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "Guests can create bookings" ON bookings;
CREATE POLICY "Guests can create bookings" ON bookings
    FOR INSERT WITH CHECK (auth.uid() = guest_id);

DROP POLICY IF EXISTS "Guests and owners can update their bookings" ON bookings;
CREATE POLICY "Guests and owners can update their bookings" ON bookings
    FOR UPDATE USING (auth.uid() = guest_id OR auth.uid() = owner_id);

-- Reviews policies
DROP POLICY IF EXISTS "Anyone can view published reviews" ON reviews;
CREATE POLICY "Anyone can view published reviews" ON reviews
    FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Users can create reviews for their bookings" ON reviews;
CREATE POLICY "Users can create reviews for their bookings" ON reviews
    FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Users can update their own reviews" ON reviews;
CREATE POLICY "Users can update their own reviews" ON reviews
    FOR UPDATE USING (auth.uid() = reviewer_id);

-- Messages policies
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
CREATE POLICY "Users can view their own messages" ON messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Recipients can update message read status" ON messages;
CREATE POLICY "Recipients can update message read status" ON messages
    FOR UPDATE USING (auth.uid() = recipient_id);

-- Wishlists policies
DROP POLICY IF EXISTS "Users can manage their own wishlists" ON wishlists;
CREATE POLICY "Users can manage their own wishlists" ON wishlists
    FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

-- Storage policies for property-images bucket
DROP POLICY IF EXISTS "Public read property images" ON storage.objects;
CREATE POLICY "Public read property images" ON storage.objects
    FOR SELECT USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "Owners upload property images" ON storage.objects;
CREATE POLICY "Owners upload property images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'property-images'
        AND (storage.foldername(name))[1] = 'properties'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Owners update property images" ON storage.objects;
CREATE POLICY "Owners update property images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'property-images'
        AND (storage.foldername(name))[1] = 'properties'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Owners delete property images" ON storage.objects;
CREATE POLICY "Owners delete property images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'property-images'
        AND (storage.foldername(name))[1] = 'properties'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE
    ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE
    ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE
    ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE
    ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically set property location from lat/lng
CREATE OR REPLACE FUNCTION set_property_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_property_location_trigger ON properties;
CREATE TRIGGER set_property_location_trigger 
    BEFORE INSERT OR UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION set_property_location();

-- Function to generate property slug
CREATE OR REPLACE FUNCTION generate_property_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Generate base slug from title and city
    base_slug := lower(regexp_replace(
        NEW.title || '-' || NEW.city, 
        '[^a-zA-Z0-9]+', '-', 'g'
    ));
    base_slug := trim(both '-' from base_slug);
    
    final_slug := base_slug;
    
    -- Check for uniqueness and append counter if needed
    WHILE EXISTS (SELECT 1 FROM properties WHERE slug = final_slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.slug := final_slug;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS generate_property_slug_trigger ON properties;
CREATE TRIGGER generate_property_slug_trigger 
    BEFORE INSERT OR UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION generate_property_slug();

-- =====================================================
-- SCHEMA SETUP COMPLETE
-- =====================================================
