-- Remove existing tables to prevent conflicts when re-running
DROP TABLE IF EXISTS "public"."ambulance_bookings" CASCADE;
DROP TABLE IF EXISTS "public"."ambulances" CASCADE;

-- Create ambulances table
CREATE TABLE "public"."ambulances" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "driver_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT TRUE,
    "type" TEXT NOT NULL DEFAULT 'ALS', -- ALS, BLS, NICU
    "speed_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY ("id")
);

-- Enable RLS (Allow read/write for all for simplicity in demo)
ALTER TABLE "public"."ambulances" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON "public"."ambulances" FOR SELECT USING (true);
CREATE POLICY "Enable update access for all users" ON "public"."ambulances" FOR UPDATE USING (true);

-- Create ambulance bookings table
CREATE TABLE "public"."ambulance_bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ambulance_id" UUID REFERENCES "public"."ambulances"("id") ON DELETE CASCADE,
    "patient_id" UUID NOT NULL, -- references users but keeping it unrestrictd for demo
    "pickup_lat" DOUBLE PRECISION NOT NULL,
    "pickup_lng" DOUBLE PRECISION NOT NULL,
    "dropoff_hospital_id" UUID, -- Can be null if they just want an ambulance
    "status" TEXT NOT NULL DEFAULT 'requesting', -- requesting, confirmed, en_route, arriving, completed
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY ("id")
);

-- Enable RLS
ALTER TABLE "public"."ambulance_bookings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert access for all users" ON "public"."ambulance_bookings" FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable select access for all users" ON "public"."ambulance_bookings" FOR SELECT USING (true);
CREATE POLICY "Enable update access for all users" ON "public"."ambulance_bookings" FOR UPDATE USING (true);

-- Turn on WebSockets / Realtime for both tables
alter publication supabase_realtime add table ambulances;
alter publication supabase_realtime add table ambulance_bookings;

-- Insert 10 Dummy Ambulances scattered around Mumbai coordinates
INSERT INTO "public"."ambulances" ("driver_name", "phone", "lat", "lng", "type", "available") VALUES
('Ramesh Kumar', '+91 9800000001', 19.0800, 72.8800, 'ALS', true),
('Suresh Patil', '+91 9800000002', 19.0710, 72.8700, 'BLS', true),
('Amit Sharma', '+91 9800000003', 19.0650, 72.8650, 'NICU', true),
('Vijay Singh', '+91 9800000004', 19.0900, 72.8900, 'ALS', true),
('Rahul Verma', '+91 9800000005', 19.0850, 72.8550, 'BLS', true),
('Mohammed Ali', '+91 9800000006', 19.0550, 72.8450, 'ALS', true),
('Prakash Jadhav', '+91 9800000007', 19.0950, 72.8600, 'NICU', true),
('Kishore Mane', '+91 9800000008', 19.1000, 72.8750, 'ALS', true),
('Dinesh Kadam', '+91 9800000009', 19.0400, 72.8500, 'BLS', true),
('Swapnil Desai', '+91 9800000010', 19.0770, 72.8950, 'ALS', true);
