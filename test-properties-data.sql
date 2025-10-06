-- Test Properties Data for RentThatView
-- Insert 10 diverse properties for testing

-- Property 1: Luxury Beach Villa in Malibu
INSERT INTO properties (title, description, property_type, address, city, state, country, latitude, longitude, base_price, bedrooms, bathrooms, max_guests, amenities, view_type, owner_id)
VALUES (
    'Stunning Oceanfront Villa',
    'Experience luxury living in this breathtaking beachfront property with panoramic ocean views. Features a private pool, direct beach access, and modern amenities throughout.',
    'villa',
    '123 Pacific Coast Highway',
    'Malibu',
    'California',
    'United States',
    34.0259,
    -118.7798,
    850.00,
    5,
    4,
    10,
    '["WiFi", "Pool", "Beach Access", "Air Conditioning", "Kitchen", "Parking", "TV", "Washer/Dryer"]'::jsonb,
    'Ocean View',
    (SELECT user_id FROM user_profiles WHERE account_type = 'owner' LIMIT 1)
);

-- Property 2: Mountain Cabin in Aspen
INSERT INTO properties (title, description, property_type, address, city, state, country, latitude, longitude, base_price, bedrooms, bathrooms, max_guests, amenities, view_type, owner_id)
VALUES (
    'Cozy Mountain Retreat',
    'Charming log cabin nestled in the mountains with stunning alpine views. Perfect for ski trips or summer hiking adventures. Features a stone fireplace and hot tub.',
    'cabin',
    '456 Aspen Highlands Drive',
    'Aspen',
    'Colorado',
    'United States',
    39.1911,
    -106.8175,
    425.00,
    3,
    2,
    6,
    '["WiFi", "Fireplace", "Hot Tub", "Heating", "Kitchen", "Parking", "Mountain Views"]'::jsonb,
    'Mountain View',
    (SELECT user_id FROM user_profiles WHERE account_type = 'owner' LIMIT 1)
);

-- Property 3: City Skyline Penthouse in New York
INSERT INTO properties (title, description, property_type, address, city, state, country, latitude, longitude, base_price, bedrooms, bathrooms, max_guests, amenities, view_type, owner_id)
VALUES (
    'Manhattan Skyline Penthouse',
    'Luxurious penthouse in the heart of Manhattan with floor-to-ceiling windows showcasing breathtaking city views. Modern design with high-end finishes.',
    'apartment',
    '789 Park Avenue, Penthouse',
    'New York',
    'New York',
    'United States',
    40.7736,
    -73.9566,
    950.00,
    4,
    3,
    8,
    '["WiFi", "Air Conditioning", "Elevator", "Gym", "Doorman", "Kitchen", "Parking", "City Views"]'::jsonb,
    'City Skyline View',
    (SELECT user_id FROM user_profiles WHERE account_type = 'owner' LIMIT 1)
);

-- Property 4: Countryside Villa in Tuscany
INSERT INTO properties (title, description, property_type, address, city, state, country, latitude, longitude, base_price, bedrooms, bathrooms, max_guests, amenities, view_type, owner_id)
VALUES (
    'Tuscan Vineyard Estate',
    'Authentic Italian villa surrounded by vineyards and rolling hills. Features traditional architecture, a pool, and outdoor dining area with spectacular countryside views.',
    'villa',
    'Via Chianti 45',
    'Florence',
    'Tuscany',
    'Italy',
    43.7696,
    11.2558,
    625.00,
    6,
    5,
    12,
    '["WiFi", "Pool", "Kitchen", "Fireplace", "Parking", "Garden", "BBQ", "Wine Cellar"]'::jsonb,
    'Countryside View',
    (SELECT user_id FROM user_profiles WHERE account_type = 'owner' LIMIT 1)
);

-- Property 5: Beachfront Bungalow in Bali
INSERT INTO properties (title, description, property_type, address, city, state, country, latitude, longitude, base_price, bedrooms, bathrooms, max_guests, amenities, view_type, owner_id)
VALUES (
    'Tropical Paradise Bungalow',
    'Private beachfront bungalow with direct ocean access. Wake up to the sound of waves and enjoy stunning sunsets from your private deck.',
    'bungalow',
    'Jalan Pantai Seminyak 12',
    'Seminyak',
    'Bali',
    'Indonesia',
    -8.6905,
    115.1683,
    275.00,
    2,
    2,
    4,
    '["WiFi", "Beach Access", "Air Conditioning", "Kitchen", "Outdoor Shower", "Surfboard Storage"]'::jsonb,
    'Ocean View',
    (SELECT user_id FROM user_profiles WHERE account_type = 'owner' LIMIT 1)
);

-- Property 6: Desert Oasis in Dubai
INSERT INTO properties (title, description, property_type, address, city, state, country, latitude, longitude, base_price, bedrooms, bathrooms, max_guests, amenities, view_type, owner_id)
VALUES (
    'Luxury Desert Villa',
    'Modern architectural masterpiece in the desert with infinity pool overlooking sand dunes. Experience luxury in a unique desert setting.',
    'villa',
    'Dubai Desert Conservation Reserve',
    'Dubai',
    'Dubai',
    'United Arab Emirates',
    25.2048,
    55.2708,
    720.00,
    4,
    4,
    8,
    '["WiFi", "Pool", "Air Conditioning", "Kitchen", "Parking", "Private Chef Available", "Desert Views"]'::jsonb,
    'Countryside View',
    (SELECT user_id FROM user_profiles WHERE account_type = 'owner' LIMIT 1)
);

-- Property 7: Lakeside Cottage in Swiss Alps
INSERT INTO properties (title, description, property_type, address, city, state, country, latitude, longitude, base_price, bedrooms, bathrooms, max_guests, amenities, view_type, owner_id)
VALUES (
    'Alpine Lake Cottage',
    'Charming cottage on the shores of a pristine alpine lake. Surrounded by mountains and perfect for a peaceful getaway.',
    'cottage',
    'Seestrasse 78',
    'Lucerne',
    'Lucerne',
    'Switzerland',
    47.0502,
    8.3093,
    485.00,
    3,
    2,
    6,
    '["WiFi", "Heating", "Fireplace", "Kitchen", "Parking", "Boat Dock", "Lake Access"]'::jsonb,
    'Mountain View',
    (SELECT user_id FROM user_profiles WHERE account_type = 'owner' LIMIT 1)
);

-- Property 8: Historic Apartment in Paris
INSERT INTO properties (title, description, property_type, address, city, state, country, latitude, longitude, base_price, bedrooms, bathrooms, max_guests, amenities, view_type, owner_id)
VALUES (
    'Parisian Charm with Eiffel Views',
    'Beautiful apartment in a historic Haussmann building with balcony views of the Eiffel Tower. Classic Parisian elegance meets modern comfort.',
    'apartment',
    '16 Avenue Paul Doumer',
    'Paris',
    'Île-de-France',
    'France',
    48.8629,
    2.2877,
    565.00,
    2,
    1,
    4,
    '["WiFi", "Heating", "Kitchen", "Elevator", "City Views", "Balcony"]'::jsonb,
    'City Skyline View',
    (SELECT user_id FROM user_profiles WHERE account_type = 'owner' LIMIT 1)
);

-- Property 9: Coastal Cliffside House in Santorini
INSERT INTO properties (title, description, property_type, address, city, state, country, latitude, longitude, base_price, bedrooms, bathrooms, max_guests, amenities, view_type, owner_id)
VALUES (
    'Iconic Santorini Cave House',
    'Traditional cave house carved into the caldera with breathtaking sunset views. Private infinity pool and authentic Greek architecture.',
    'house',
    'Oia Main Street',
    'Oia',
    'Santorini',
    'Greece',
    36.4618,
    25.3753,
    680.00,
    3,
    3,
    6,
    '["WiFi", "Pool", "Air Conditioning", "Kitchen", "Outdoor Dining", "Ocean Views", "Cave Architecture"]'::jsonb,
    'Ocean View',
    (SELECT user_id FROM user_profiles WHERE account_type = 'owner' LIMIT 1)
);

-- Property 10: Modern Apartment in Tokyo
INSERT INTO properties (title, description, property_type, address, city, state, country, latitude, longitude, base_price, bedrooms, bathrooms, max_guests, amenities, view_type, owner_id)
VALUES (
    'Tokyo Skyline Apartment',
    'Ultra-modern apartment in Shibuya with panoramic views of the Tokyo skyline. Walking distance to major attractions and nightlife.',
    'apartment',
    '2-24-12 Shibuya',
    'Tokyo',
    'Tokyo',
    'Japan',
    35.6595,
    139.7004,
    385.00,
    2,
    1,
    4,
    '["WiFi", "Air Conditioning", "Elevator", "Kitchen", "City Views", "Near Metro"]'::jsonb,
    'City Skyline View',
    (SELECT user_id FROM user_profiles WHERE account_type = 'owner' LIMIT 1)
);

-- Verify the inserts
SELECT COUNT(*) as total_properties FROM properties;

