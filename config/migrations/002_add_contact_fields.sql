-- Migration: Add contact and external booking fields to properties
-- This allows owners to list contact information and external booking links
-- instead of direct platform bookings

-- Add contact and external booking fields to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS external_booking_url TEXT,
ADD COLUMN IF NOT EXISTS booking_instructions TEXT;

-- Add comment to explain the fields
COMMENT ON COLUMN properties.owner_phone IS 'Owner contact phone number for direct inquiries';
COMMENT ON COLUMN properties.owner_email IS 'Owner contact email for direct inquiries';
COMMENT ON COLUMN properties.external_booking_url IS 'URL to external booking site (e.g., Airbnb, VRBO, owner website)';
COMMENT ON COLUMN properties.booking_instructions IS 'Special instructions for contacting owner or booking';
