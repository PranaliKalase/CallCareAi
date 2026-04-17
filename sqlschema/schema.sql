-- ==============================================================================
-- Careplus — Complete Database Schema (Fresh Install)
-- ==============================================================================
-- Run this ENTIRE script in your Supabase SQL Editor.
-- This creates everything from scratch — no migrations needed.
-- ==============================================================================


-- ┌─────────────────────────────────────────────┐
-- │  1. PATIENTS TABLE                          │
-- └─────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.patients (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    age INTEGER,
    blood_group TEXT,
    role TEXT DEFAULT 'patient',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view patients" ON public.patients;
CREATE POLICY "Anyone can view patients"
    ON public.patients FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can insert own patient profile" ON public.patients;
CREATE POLICY "Users can insert own patient profile"
    ON public.patients FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own patient profile" ON public.patients;
CREATE POLICY "Users can update own patient profile"
    ON public.patients FOR UPDATE
    USING (auth.uid() = id);


-- ┌─────────────────────────────────────────────┐
-- │  2. HOSPITAL ADMINS TABLE                   │
-- └─────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.hospital_admins (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    description TEXT,
    phone TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    role TEXT DEFAULT 'hospital',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.hospital_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view hospital admins" ON public.hospital_admins;
CREATE POLICY "Anyone can view hospital admins"
    ON public.hospital_admins FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can insert own hospital admin profile" ON public.hospital_admins;
CREATE POLICY "Users can insert own hospital admin profile"
    ON public.hospital_admins FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own hospital admin profile" ON public.hospital_admins;
CREATE POLICY "Users can update own hospital admin profile"
    ON public.hospital_admins FOR UPDATE
    USING (auth.uid() = id);


-- ┌─────────────────────────────────────────────┐
-- │  3. DOCTORS TABLE                           │
-- └─────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.doctors (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    hospital_name TEXT,
    hospital_id UUID REFERENCES public.hospital_admins(id) ON DELETE SET NULL,
    specialization TEXT,
    license_number TEXT,
    proof_url TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    role TEXT DEFAULT 'doctor',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view doctors" ON public.doctors;
CREATE POLICY "Anyone can view doctors"
    ON public.doctors FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can insert own doctor profile" ON public.doctors;
CREATE POLICY "Users can insert own doctor profile"
    ON public.doctors FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own doctor profile" ON public.doctors;
CREATE POLICY "Users can update own doctor profile"
    ON public.doctors FOR UPDATE
    USING (auth.uid() = id);

-- Hospital admins can update doctor profiles (for approval)
DROP POLICY IF EXISTS "Hospital can approve doctors" ON public.doctors;
CREATE POLICY "Hospital can approve doctors"
    ON public.doctors FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.hospital_admins
            WHERE id = auth.uid()
        )
    );


-- ┌─────────────────────────────────────────────┐
-- │  4. HOSPITAL SLOTS TABLE                    │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.hospital_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID REFERENCES public.hospital_admins(id) ON DELETE CASCADE,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_booked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(hospital_id, slot_date, start_time)
);

ALTER TABLE public.hospital_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view hospital slots" ON public.hospital_slots;
CREATE POLICY "Anyone can view hospital slots"
    ON public.hospital_slots FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Hospitals can manage their own slots" ON public.hospital_slots;
CREATE POLICY "Hospitals can manage their own slots"
    ON public.hospital_slots FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.hospital_admins
            WHERE id = auth.uid() AND id = hospital_id
        )
    );


-- ┌─────────────────────────────────────────────┐
-- │  5. APPOINTMENTS TABLE                       │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES public.hospital_admins(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
    slot_id UUID REFERENCES public.hospital_slots(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'confirmed',
    token_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to auto-generate token number
CREATE OR REPLACE FUNCTION public.generate_token_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.token_number := 'CP-' || UPPER(SUBSTRING(NEW.id::text, 1, 8));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_generate_token
    BEFORE INSERT ON public.appointments
    FOR EACH ROW EXECUTE PROCEDURE public.generate_token_number();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own appointments or related profiles" ON public.appointments;
CREATE POLICY "Users can view own appointments or related profiles"
    ON public.appointments FOR SELECT
    USING (
        auth.uid() = patient_id OR
        EXISTS (SELECT 1 FROM public.hospital_admins WHERE id = auth.uid() AND id = hospital_id) OR
        EXISTS (SELECT 1 FROM public.doctors WHERE id = auth.uid() AND id = doctor_id)
    );

DROP POLICY IF EXISTS "Patients can book appointments" ON public.appointments;
CREATE POLICY "Patients can book appointments"
    ON public.appointments FOR INSERT
    WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Related admins and doctors can update appointments" ON public.appointments;
CREATE POLICY "Related admins and doctors can update appointments"
    ON public.appointments FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM public.hospital_admins WHERE id = auth.uid() AND id = hospital_id) OR
        EXISTS (SELECT 1 FROM public.doctors WHERE id = auth.uid() AND id = doctor_id)
    );


-- ┌─────────────────────────────────────────────┐
-- │  6. AUTO-INSERT TRIGGER                     │
-- │  Creates a profile row when a user signs up │
-- └─────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    extracted_role TEXT := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');
BEGIN
    IF extracted_role = 'doctor' THEN
        INSERT INTO public.doctors (id, full_name, is_approved, hospital_name)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Doctor'),
            FALSE,
            NEW.raw_user_meta_data->>'hospital_name'
        );
    ELSIF extracted_role = 'hospital' THEN
        INSERT INTO public.hospital_admins (id, full_name)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Hospital')
        );
    ELSE
        INSERT INTO public.patients (id, full_name)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Patient')
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Prevent auth failure if the profile insert fails
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ┌─────────────────────────────────────────────┐
-- │  7. STORAGE BUCKET FOR DOCUMENTS            │
-- │  Used for doctor certificate uploads        │
-- └─────────────────────────────────────────────┘

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can upload documents" ON storage.objects;
CREATE POLICY "Anyone can upload documents"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;
CREATE POLICY "Anyone can view documents"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'documents');


-- ┌─────────────────────────────────────────────┐
-- │  8. RELOAD POSTGREST SCHEMA CACHE           │
-- └─────────────────────────────────────────────┘

NOTIFY pgrst, 'reload schema';
