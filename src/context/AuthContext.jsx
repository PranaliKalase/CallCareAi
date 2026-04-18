import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const authOperationInProgress = useRef(false);
  const initialLoadDone = useRef(false);

  const fetchProfile = useCallback(async (currentUser) => {
    if (!currentUser) return null;
    const userId = currentUser.id;
    const meta = currentUser.user_metadata || {};
    const role = meta.role || 'patient';
    const tableName = role === 'doctor' ? 'doctors' : role === 'hospital' ? 'hospital_admins' : role === 'driver' ? 'ambulance_drivers' : 'patients';

    try {
      const { data } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) return { ...data, role };

      const updates = { id: userId, full_name: meta.full_name || 'User', role };
      await supabase.from(tableName).upsert(updates, { onConflict: 'id' });
      return updates;
    } catch (err) {
      return { id: userId, role, full_name: meta.full_name || 'User' };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session?.user) {
          const meta = session.user.user_metadata || {};
          const role = meta.role || 'patient';
          // Set user + minimal profile immediately (no DB wait)
          setUser(session.user);
          setProfile({ id: session.user.id, role, full_name: meta.full_name || 'User' });
          setLoading(false);
          initialLoadDone.current = true;

          // Fetch full profile in background
          fetchProfile(session.user).then(fullProfile => {
            if (!cancelled && fullProfile) setProfile(fullProfile);
          });
          return;
        }
      } catch (err) {
        console.error('Auth bootstrap error:', err);
      }
      if (!cancelled) {
        setLoading(false);
        initialLoadDone.current = true;
      }
    };

    bootstrap();

    const safetyTimer = setTimeout(() => {
      if (!cancelled && !initialLoadDone.current) {
        setLoading(false);
      }
    }, 1500);

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;
        if (authOperationInProgress.current) return;

        // Skip INITIAL_SESSION — bootstrap already handles it
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Just update user object, no need to re-fetch profile
          if (!cancelled) setUser(session.user);
          return;
        }

        if (['SIGNED_IN', 'USER_UPDATED'].includes(event) && session?.user) {
          const prof = await fetchProfile(session.user);
          if (!cancelled) {
            setUser(session.user);
            setProfile(prof);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      listener?.subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  // ── Sign In ──
  const signIn = async (email, password) => {
    authOperationInProgress.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data?.user) {
        const metaRole = data.user.user_metadata?.role || 'patient';

        if (metaRole === 'doctor') {
          const { data: docData } = await supabase
            .from('doctors')
            .select('is_approved')
            .eq('id', data.user.id)
            .maybeSingle();

          if (!docData || docData.is_approved !== true) {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            throw new Error('Your account is pending approval from your hospital.');
          }
        }

        // Set user immediately so ProtectedRoute redirects instantly
        const meta = data.user.user_metadata || {};
        setUser(data.user);
        setProfile({ id: data.user.id, role: metaRole, full_name: meta.full_name || 'User' });
        setLoading(false);

        // Fetch full profile in background (non-blocking)
        fetchProfile(data.user).then(fullProfile => {
          if (fullProfile) setProfile(fullProfile);
        });
      }
    } finally {
      authOperationInProgress.current = false;
    }
  };

  const signUp = async (email, password, full_name, role, specialization, hospital_name, license_number, proofFile, address, city, state, phone, hospital_id, vehicle_number, driver_type) => {
    authOperationInProgress.current = true;
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name, role, specialization, hospital_name, license_number, address, city, state, phone, hospital_id, vehicle_number, driver_type }
        }
      });

      if (error) throw error;

      if (data.user && data.session) {
        let updates = { id: data.user.id, full_name };
        let tableName = 'patients';

        if (role === 'doctor') {
          tableName = 'doctors';
          if (specialization) updates.specialization = specialization;
          if (hospital_name) updates.hospital_name = hospital_name;
          if (hospital_id) updates.hospital_id = hospital_id;
          if (license_number) updates.license_number = license_number;

          if (proofFile) {
            const fileExt = proofFile.name.split('.').pop();
            const fileName = `${data.user.id}-${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, proofFile);
            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);
              updates.proof_url = publicUrl;
            }
          }
        } else if (role === 'hospital') {
          tableName = 'hospital_admins';
          if (address) updates.address = address;
          if (city) updates.city = city;
          if (state) updates.state = state;
          if (phone) updates.phone = phone;
        } else if (role === 'driver') {
          tableName = 'ambulance_drivers';
          if (phone) updates.phone = phone;
          if (vehicle_number) updates.vehicle_number = vehicle_number;
          if (license_number) updates.license_number = license_number;
          if (driver_type) updates.type = driver_type;
        }

        updates.role = role;
        await supabase.from(tableName).upsert(updates, { onConflict: 'id' });

        if (role === 'doctor') {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          throw new Error("Registration successful! Your account is pending approval from the hospital.");
        } else {
          const profileData = await fetchProfile(data.user);
          setProfile(profileData);
          setUser(data.user);
          setLoading(false);
        }
      }
    } finally {
      authOperationInProgress.current = false;
    }
  };

  const signOut = async () => {
    authOperationInProgress.current = true;
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setLoading(false);
      authOperationInProgress.current = false;
      window.location.href = '/auth';
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
