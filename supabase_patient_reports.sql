-- ══════════════════════════════════════════════════════════════
-- Patient Reports / Progress Notes / Prescriptions Table
-- Run this in your Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Drop existing table if needed (safe re-run)
DROP TABLE IF EXISTS public.patient_reports CASCADE;

CREATE TABLE public.patient_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES public.hospital_admins(id) ON DELETE SET NULL,

  -- Clinical data
  diagnosis TEXT,
  symptoms TEXT,
  notes TEXT,
  prescription TEXT,
  follow_up_date DATE,

  -- Vitals (optional)
  blood_pressure VARCHAR(20),
  heart_rate INTEGER,
  temperature DECIMAL(4,1),
  weight DECIMAL(5,1),
  spo2 INTEGER,

  -- Status
  report_type VARCHAR(30) DEFAULT 'progress' CHECK (report_type IN ('progress', 'follow_up', 'discharge', 'lab_result')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_patient_reports_patient ON public.patient_reports(patient_id);
CREATE INDEX idx_patient_reports_doctor ON public.patient_reports(doctor_id);
CREATE INDEX idx_patient_reports_appointment ON public.patient_reports(appointment_id);

-- ── Row Level Security ──
ALTER TABLE public.patient_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can read reports (patients see their own, doctors see theirs)
-- We use permissive policies so any matching policy grants access
DROP POLICY IF EXISTS "Patients can view their own reports" ON public.patient_reports;
CREATE POLICY "Patients can view their own reports"
  ON public.patient_reports FOR SELECT
  USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Doctors can view their own reports" ON public.patient_reports;
CREATE POLICY "Doctors can view their own reports"
  ON public.patient_reports FOR SELECT
  USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Hospital admins can view their reports" ON public.patient_reports;
CREATE POLICY "Hospital admins can view their reports"
  ON public.patient_reports FOR SELECT
  USING (auth.uid() = hospital_id);

-- Doctors can insert reports
DROP POLICY IF EXISTS "Doctors can insert reports" ON public.patient_reports;
CREATE POLICY "Doctors can insert reports"
  ON public.patient_reports FOR INSERT
  WITH CHECK (auth.uid() = doctor_id);

-- Doctors can update their own reports
DROP POLICY IF EXISTS "Doctors can update their reports" ON public.patient_reports;
CREATE POLICY "Doctors can update their reports"
  ON public.patient_reports FOR UPDATE
  USING (auth.uid() = doctor_id);

-- Reload PostgREST schema cache so Supabase picks up the new table immediately
NOTIFY pgrst, 'reload schema';
