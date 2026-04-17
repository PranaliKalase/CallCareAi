-- ═══════════════════════════════════════════════════════
-- Run this in your Supabase SQL Editor
-- Creates a function that allows a user to delete their own account
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_role TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Determine user role
  IF EXISTS (SELECT 1 FROM public.doctors WHERE id = current_user_id) THEN
    user_role := 'doctor';
  ELSIF EXISTS (SELECT 1 FROM public.hospital_admins WHERE id = current_user_id) THEN
    user_role := 'hospital';
  ELSE
    user_role := 'patient';
  END IF;

  -- Delete patient reports (as doctor or patient)
  DELETE FROM public.patient_reports WHERE doctor_id = current_user_id;
  DELETE FROM public.patient_reports WHERE patient_id = current_user_id;

  -- Delete appointments
  DELETE FROM public.appointments WHERE patient_id = current_user_id;
  DELETE FROM public.appointments WHERE doctor_id = current_user_id;
  DELETE FROM public.appointments WHERE hospital_id = current_user_id;

  -- Delete hospital slots
  DELETE FROM public.hospital_slots WHERE doctor_id = current_user_id;
  DELETE FROM public.hospital_slots WHERE hospital_id = current_user_id;

  -- Delete from role-specific table
  DELETE FROM public.doctors WHERE id = current_user_id;
  DELETE FROM public.hospital_admins WHERE id = current_user_id;
  DELETE FROM public.patients WHERE id = current_user_id;

  -- Delete the auth user (requires SECURITY DEFINER)
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
