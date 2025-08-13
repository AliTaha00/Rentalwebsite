-- Storage Policies for property-images bucket
-- Run these in Supabase SQL Editor

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read property images" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload property images" ON storage.objects;
DROP POLICY IF EXISTS "Owners update property images" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete property images" ON storage.objects;

-- Public read (allows viewing images)
CREATE POLICY "Public read property images" ON storage.objects
FOR SELECT USING (bucket_id = 'property-images');

-- Owners can upload into properties/{user_id}/{property_id}/...
CREATE POLICY "Owners upload property images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'property-images'
  AND (storage.foldername(name))[1] = 'properties'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Owners can update/replace their files
CREATE POLICY "Owners update property images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'property-images'
  AND (storage.foldername(name))[1] = 'properties'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Owners can delete their files
CREATE POLICY "Owners delete property images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'property-images'
  AND (storage.foldername(name))[1] = 'properties'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
