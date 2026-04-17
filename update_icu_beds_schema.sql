-- Run this in your Supabase SQL Editor
-- This adds the available_icu_beds column to the hospital_admins table

ALTER TABLE hospital_admins 
ADD COLUMN IF NOT EXISTS available_icu_beds INTEGER DEFAULT 0;

-- Allow hospital admins to update their own row
CREATE POLICY "Hospitals can update their own ICU beds" 
ON hospital_admins 
FOR UPDATE 
USING (auth.uid() = id);
