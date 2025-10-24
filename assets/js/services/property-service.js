/**
 * PropertyService
 * Centralized service for all property-related data operations
 */

'use strict';

class PropertyService {
    constructor() {
        this.supabaseClient = window.supabaseClient;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Fetch all properties with optional filters
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Array>} Array of properties
     */
    async getProperties(filters = {}) {
        try {
            let query = this.supabaseClient.supabase
                .from('properties')
                .select(`
                    *,
                    property_images (
                        id,
                        image_url,
                        display_order
                    )
                `)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            // Apply filters
            if (filters.location) {
                query = query.or(`city.ilike.%${filters.location}%,state.ilike.%${filters.location}%,country.ilike.%${filters.location}%`);
            }

            if (filters.viewType) {
                query = query.ilike('view_type', `%${filters.viewType}%`);
            }

            if (filters.propertyType) {
                query = query.eq('property_type', filters.propertyType);
            }

            if (filters.minPrice) {
                query = query.gte('base_price', filters.minPrice);
            }

            if (filters.maxPrice) {
                query = query.lte('base_price', filters.maxPrice);
            }

            if (filters.minGuests) {
                query = query.gte('max_guests', filters.minGuests);
            }

            if (filters.bedrooms) {
                query = query.gte('bedrooms', filters.bedrooms);
            }

            if (filters.amenities && filters.amenities.length > 0) {
                // Filter by amenities (JSONB contains)
                filters.amenities.forEach(amenity => {
                    query = query.contains('amenities', [amenity]);
                });
            }

            const { data, error } = await query;

            if (error) throw error;

            // Process images
            return this.#processProperties(data);
        } catch (error) {
            console.error('Error fetching properties:', error);
            throw new Error('Failed to load properties');
        }
    }

    /**
     * Get a single property by ID
     * @param {string} propertyId - Property UUID
     * @returns {Promise<Object>} Property object
     */
    async getPropertyById(propertyId) {
        // Check cache first
        const cacheKey = `property_${propertyId}`;
        const cached = this.#getCached(cacheKey);
        if (cached) return cached;

        try {
            const { data, error } = await this.supabaseClient.supabase
                .from('properties')
                .select(`
                    *,
                    property_images (
                        id,
                        image_url,
                        display_order
                    ),
                    user_profiles!properties_owner_id_fkey (
                        id,
                        first_name,
                        last_name,
                        profile_image_url,
                        bio
                    )
                `)
                .eq('id', propertyId)
                .eq('is_active', true)
                .single();

            if (error) throw error;
            if (!data) throw new Error('Property not found');

            const property = this.#processProperty(data);

            // Cache the result
            this.#setCache(cacheKey, property);

            return property;
        } catch (error) {
            console.error('Error fetching property:', error);
            throw new Error('Failed to load property details');
        }
    }

    /**
     * Get property availability for date range
     * @param {string} propertyId - Property UUID
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Availability records
     */
    async getPropertyAvailability(propertyId, startDate, endDate) {
        try {
            const { data, error } = await this.supabaseClient.supabase
                .from('property_availability')
                .select('*')
                .eq('property_id', propertyId)
                .gte('date', startDate.toISOString().split('T')[0])
                .lte('date', endDate.toISOString().split('T')[0])
                .order('date', { ascending: true });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching availability:', error);
            return [];
        }
    }

    /**
     * Get property reviews
     * @param {string} propertyId - Property UUID
     * @param {number} limit - Number of reviews to fetch
     * @returns {Promise<Array>} Reviews
     */
    async getPropertyReviews(propertyId, limit = 10) {
        try {
            const { data, error } = await this.supabaseClient.supabase
                .from('reviews')
                .select(`
                    *,
                    user_profiles!reviews_reviewer_id_fkey (
                        first_name,
                        last_name,
                        profile_image_url
                    )
                `)
                .eq('property_id', propertyId)
                .eq('review_type', 'property')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching reviews:', error);
            return [];
        }
    }

    /**
     * Search properties with advanced filters
     * @param {Object} searchParams - Search parameters
     * @returns {Promise<Array>} Search results
     */
    async searchProperties(searchParams) {
        const {
            location = '',
            checkIn = null,
            checkOut = null,
            guests = 1,
            viewType = '',
            propertyType = '',
            minPrice = null,
            maxPrice = null,
            amenities = [],
            sortBy = 'relevance'
        } = searchParams;

        const filters = {
            location,
            viewType,
            propertyType,
            minPrice,
            maxPrice,
            minGuests: guests,
            amenities
        };

        let properties = await this.getProperties(filters);

        // If dates provided, check availability
        if (checkIn && checkOut) {
            properties = await this.#filterByAvailability(properties, checkIn, checkOut);
        }

        // Sort results
        properties = this.#sortProperties(properties, sortBy);

        return properties;
    }

    /**
     * Get featured properties
     * @param {number} limit - Number of properties to return
     * @returns {Promise<Array>} Featured properties
     */
    async getFeaturedProperties(limit = 8) {
        try {
            const { data, error } = await this.supabaseClient.supabase
                .from('properties')
                .select(`
                    *,
                    property_images (
                        id,
                        image_url,
                        display_order
                    )
                `)
                .eq('is_active', true)
                .eq('featured', true)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return this.#processProperties(data || []);
        } catch (error) {
            console.error('Error fetching featured properties:', error);
            return [];
        }
    }

    /**
     * Get properties by owner
     * @param {string} ownerId - Owner user ID
     * @returns {Promise<Array>} Owner's properties
     */
    async getPropertiesByOwner(ownerId) {
        try {
            const { data, error } = await this.supabaseClient.supabase
                .from('properties')
                .select(`
                    *,
                    property_images (
                        id,
                        image_url,
                        display_order
                    )
                `)
                .eq('owner_id', ownerId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return this.#processProperties(data || []);
        } catch (error) {
            console.error('Error fetching owner properties:', error);
            throw new Error('Failed to load your properties');
        }
    }

    /**
     * Process properties array (sort images, add computed fields)
     */
    #processProperties(properties) {
        return properties.map(property => this.#processProperty(property));
    }

    /**
     * Process single property
     */
    #processProperty(property) {
        // Sort images by display_order
        if (property.property_images && property.property_images.length > 0) {
            property.images = property.property_images
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
            property.primary_image = property.images[0]?.image_url;
        } else {
            property.images = [];
            property.primary_image = null;
        }

        // Parse amenities if it's a string
        if (typeof property.amenities === 'string') {
            try {
                property.amenities = JSON.parse(property.amenities);
            } catch (e) {
                property.amenities = [];
            }
        }

        // Add computed fields
        property.full_address = [
            property.address,
            property.city,
            property.state,
            property.country
        ].filter(Boolean).join(', ');

        return property;
    }

    /**
     * Filter properties by availability
     */
    async #filterByAvailability(properties, checkIn, checkOut) {
        const availableProperties = [];

        for (const property of properties) {
            const availability = await this.getPropertyAvailability(
                property.id,
                new Date(checkIn),
                new Date(checkOut)
            );

            // Check if all dates are available
            const isAvailable = availability.every(day => day.is_available);

            if (isAvailable) {
                availableProperties.push(property);
            }
        }

        return availableProperties;
    }

    /**
     * Sort properties by criteria
     */
    #sortProperties(properties, sortBy) {
        switch (sortBy) {
            case 'price_low':
                return properties.sort((a, b) => a.base_price - b.base_price);
            case 'price_high':
                return properties.sort((a, b) => b.base_price - a.base_price);
            case 'rating':
                return properties.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
            case 'newest':
                return properties.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            default:
                return properties;
        }
    }

    /**
     * Cache management
     */
    #getCached(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const { data, timestamp } = cached;
        if (Date.now() - timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }

        return data;
    }

    #setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Export as global singleton
if (typeof window !== 'undefined') {
    window.PropertyService = new PropertyService();
}
