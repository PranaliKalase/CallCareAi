-- ═══════════════════════════════════════════════════════
-- Run this ENTIRE script in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Add doctor_id column to hospital_slots
ALTER TABLE public.hospital_slots 
ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE;

-- 2. Drop the old unique constraint (hospital-wide)
ALTER TABLE public.hospital_slots 
DROP CONSTRAINT IF EXISTS hospital_slots_hospital_id_slot_date_start_time_key;

-- 3. Add the new unique constraint (per-doctor)
ALTER TABLE public.hospital_slots 
ADD CONSTRAINT hospital_slots_doctor_key UNIQUE(hospital_id, doctor_id, slot_date, start_time);

-- 4. Allow approved doctors to manage their own slots (FIXES the 403 error)
DROP POLICY IF EXISTS "Doctors can manage their own slots" ON public.hospital_slots;
CREATE POLICY "Doctors can manage their own slots"
    ON public.hospital_slots FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.doctors
            WHERE id = auth.uid()
              AND id = doctor_id
              AND is_approved = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.doctors
            WHERE id = auth.uid()
              AND id = doctor_id
              AND is_approved = true
        )
    );
