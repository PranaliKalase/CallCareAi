-- Migration: Add Ambulance Driver System

-- Ambulance Drivers Table
CREATE TABLE IF NOT EXISTS "public"."ambulance_drivers" (
    "id" UUID PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "full_name" TEXT,
    "phone" TEXT,
    "vehicle_number" TEXT,
    "license_number" TEXT,
    "type" TEXT, -- e.g., 'ALS', 'BLS', 'Emergency'
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "available" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Real-time tracking capabilities
ALTER PUBLICATION supabase_realtime ADD TABLE ambulance_drivers;

-- Policies for Ambulance Drivers
ALTER TABLE "public"."ambulance_drivers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all" ON "public"."ambulance_drivers";
CREATE POLICY "Enable read access for all" ON "public"."ambulance_drivers" FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all" ON "public"."ambulance_drivers";
CREATE POLICY "Enable insert access for all" ON "public"."ambulance_drivers" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update access for all" ON "public"."ambulance_drivers";
CREATE POLICY "Enable update access for all" ON "public"."ambulance_drivers" FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Enable delete access for all" ON "public"."ambulance_drivers";
CREATE POLICY "Enable delete access for all" ON "public"."ambulance_drivers" FOR DELETE USING (true);

-- Ambulance Requests Table
CREATE TABLE IF NOT EXISTS "public"."ambulance_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    "patient_id" UUID NOT NULL, 
    "patient_name" TEXT,
    "patient_phone" TEXT,
    "driver_id" UUID REFERENCES "public"."ambulance_drivers"("id") ON DELETE SET NULL,
    "pickup_lat" DOUBLE PRECISION NOT NULL,
    "pickup_lng" DOUBLE PRECISION NOT NULL,
    "dropoff_hospital_id" UUID, -- Nullable, depends on user choice
    "status" TEXT NOT NULL DEFAULT 'requesting', -- 'requesting', 'accepted', 'en_route', 'arriving', 'completed', 'cancelled'
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Real-time tracking capabilities for requests
ALTER PUBLICATION supabase_realtime ADD TABLE ambulance_requests;

-- Policies for Ambulance Requests
ALTER TABLE "public"."ambulance_requests" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all" ON "public"."ambulance_requests";
CREATE POLICY "Enable read access for all" ON "public"."ambulance_requests" FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all" ON "public"."ambulance_requests";
CREATE POLICY "Enable insert access for all" ON "public"."ambulance_requests" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update access for all" ON "public"."ambulance_requests";
CREATE POLICY "Enable update access for all" ON "public"."ambulance_requests" FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Enable delete access for all" ON "public"."ambulance_requests";
CREATE POLICY "Enable delete access for all" ON "public"."ambulance_requests" FOR DELETE USING (true);

-- 3. Turn on WebSockets / Realtime for these tables
alter publication supabase_realtime add table ambulance_drivers;
alter publication supabase_realtime add table ambulance_requests;
