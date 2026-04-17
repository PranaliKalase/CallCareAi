-- ==============================================================================
-- Careplus — Drop Everything (Nuclear Reset)
-- ==============================================================================
-- WARNING: This will DELETE all tables, data, triggers, functions,
--          and storage policies. Run this before schema.sql for a clean slate.
-- ==============================================================================


-- 1. Drop trigger first (depends on function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop the trigger function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Drop all RLS policies on tables
DO $$ DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 4. Drop tables (CASCADE handles any remaining dependencies)
DROP TABLE IF EXISTS public.doctors CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.hospital_admins CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;  -- legacy table if it exists

-- 5. Drop storage policies for documents bucket
DO $$ DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- 6. Remove the documents bucket
--    NOTE: Supabase blocks direct SQL deletes on storage tables.
--    To fully clear stored files and buckets, go to Supabase Dashboard → Storage → 
--    select "documents" bucket → delete all files, then delete the bucket.

-- 7. Delete all auth users (optional — uncomment if you want a full wipe)
-- DELETE FROM auth.users;

-- 8. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
